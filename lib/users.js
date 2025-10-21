
/**
 * User persistence helpers compatible with existing schema in control_coordinaciones.users
 * Columns observed:
 *   id (INT, PK, AUTO_INCREMENT)
 *   displayName (VARCHAR)
 *   email (VARCHAR, UNIQUE)
 *   photoURL (VARCHAR)
 *   plantel (VARCHAR, default 2)
 *   dir (INT)
 *   rol (INT, default 3)
 *   depto (VARCHAR)
 *   escuela (VARCHAR)
 *   created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
 *   updated_at (TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
 *   feedback (TEXT)
 *
 * Behavior:
 * - Detect the current schema and upsert accordingly.
 * - For admin logins, promote rol to 1 if a "rol" column exists (never downgrade existing admins).
 * - Adds precise logs and error codes to help diagnose issues.
 */

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const USERS_DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    picture TEXT NULL,
    hd VARCHAR(191) NOT NULL DEFAULT '',
    provider VARCHAR(64) NOT NULL DEFAULT 'google',
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    login_count INT NOT NULL DEFAULT 1,
    last_login DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`.trim();

async function getDbName(pool) {
  try {
    const [rows] = await pool.execute("SELECT DATABASE() as db");
    const db = rows?.[0]?.db || "";
    return String(db || "");
  } catch (err) {
    console.warn("[lib/users] getDbName error:", err?.message || err);
    return "";
  }
}

async function hasUsersTable(pool) {
  try {
    const db = await getDbName(pool);
    const [rows] = await pool.execute(
      "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users' LIMIT 1",
      [db]
    );
    const exists = Array.isArray(rows) && rows.length > 0;
    console.log("[lib/users] hasUsersTable:", { db, exists });
    return exists;
  } catch (err) {
    console.warn("[lib/users] hasUsersTable error:", err?.message || err);
    return false;
  }
}

async function getUsersColumns(pool) {
  try {
    const db = await getDbName(pool);
    const [cols] = await pool.execute(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users'",
      [db]
    );
    const set = new Set((cols || []).map((r) => r.COLUMN_NAME));
    console.log("[lib/users] users columns:", Array.from(set));
    return set;
  } catch (err) {
    console.warn("[lib/users] getUsersColumns error:", err?.message || err);
    return new Set();
  }
}

export async function ensureUsersTable(pool) {
  const exists = await hasUsersTable(pool);
  if (exists) return true;

  const autoCreate = process.env.USERS_AUTO_CREATE !== "0";
  if (!autoCreate) {
    const err = Object.assign(new Error("users table missing and auto-create disabled"), {
      code: "USERS_TABLE_MISSING",
      hint: "Create the users table manually or set USERS_AUTO_CREATE=1",
      ddl: USERS_DDL
    });
    console.error("[lib/users] users table missing and auto-create disabled");
    throw err;
  }

  try {
    await pool.execute(USERS_DDL);
    console.log("[lib/users] users table created");
    return true;
  } catch (err) {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    console.error("[lib/users] ensureUsersTable error:", code, msg);

    const denied = msg.toLowerCase().includes("create command denied") || code === "ER_TABLEACCESS_DENIED_ERROR";
    if (denied) {
      const e = Object.assign(new Error("DB user lacks CREATE privilege for users table"), {
        code: "USERS_CREATE_DENIED",
        cause: err,
        hint: "Grant CREATE privilege or run the DDL manually with a privileged user.",
        ddl: USERS_DDL
      });
      throw e;
    }
    throw Object.assign(new Error("ensureUsersTable failed"), { code: "USERS_TABLE_ERROR", cause: err });
  }
}

function deriveReturnRow(row) {
  // Normalize to a common shape used by callers.
  return {
    id: row?.id ?? row?.ID ?? null,
    email: row?.email ?? "",
    name: row?.displayName ?? row?.name ?? "",
    picture: row?.photoURL ?? row?.picture ?? "",
    rol: typeof row?.rol !== "undefined" ? row.rol : undefined,
    raw: row || null
  };
}

export async function createOrUpdateUser(pool, { email, name = "", picture = "", hd = "", isAdmin = false }) {
  const e = normalizeEmail(email);
  if (!e) {
    const msg = "createOrUpdateUser: email is required";
    console.error("[lib/users]", msg);
    throw Object.assign(new Error(msg), { code: "INVALID_EMAIL" });
  }

  // Ensure table exists (or provide precise errors)
  await ensureUsersTable(pool);

  // Detect columns to choose strategy
  const cols = await getUsersColumns(pool);
  const hasDisplayName = cols.has("displayName");
  const hasPhotoURL = cols.has("photoURL");
  const hasEmail = cols.has("email");
  const hasRol = cols.has("rol");
  const hasUpdatedAt = cols.has("updated_at");

  // Strategy A: Existing "displayName/email/photoURL/rol" schema
  if (hasDisplayName && hasPhotoURL && hasEmail) {
    try {
      // Build dynamic INSERT ... ON DUPLICATE KEY UPDATE
      const insertCols = ["email", "displayName", "photoURL"];
      const insertParams = [e, String(name || ""), String(picture || "")];

      if (hasRol) {
        // rol: 1 => admin, 3 => default user (keep your existing default)
        const roleVal = isAdmin ? 1 : 3;
        insertCols.push("rol");
        insertParams.push(roleVal);
      }

      const placeholders = insertCols.map(() => "?").join(", ");

      const updateParts = [
        "displayName = VALUES(displayName)",
        "photoURL = VALUES(photoURL)"
      ];
      if (hasRol) {
        // Promote to admin on duplicate if incoming is admin, never downgrade existing admin
        // If VALUES(rol)=1 (admin) then set LEAST(rol,1)=1; otherwise keep existing rol
        updateParts.push("rol = CASE WHEN VALUES(rol) = 1 THEN LEAST(rol, 1) ELSE rol END");
      }
      if (hasUpdatedAt) {
        updateParts.push("updated_at = CURRENT_TIMESTAMP");
      }

      const upsertSql = `
        INSERT INTO users (${insertCols.join(", ")})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE
          ${updateParts.join(", ")};
      `;

      const [result] = await pool.execute(upsertSql, insertParams);
      console.log("[lib/users] upsert (existing schema) executed:", {
        affectedRows: result?.affectedRows,
        insertId: result?.insertId,
        email: e,
        isAdmin
      });
    } catch (err) {
      const code = String(err?.code || "");
      const msg = String(err?.message || "");
      console.error("[lib/users] upsert (existing schema) error:", code, msg);
      throw Object.assign(new Error("user upsert failed"), { code: "USER_UPSERT_ERROR", cause: err });
    }

    try {
      const [rows] = await pool.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [e]);
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!row) {
        console.warn("[lib/users] upsert follow-up fetch returned no row for email:", e);
      } else {
        console.log("[lib/users] upsert fetch:", {
          id: row.id,
          email: row.email,
          rol: row.rol,
          displayName: row.displayName
        });
      }
      return deriveReturnRow(row);
    } catch (err) {
      console.error("[lib/users] fetch after upsert error:", err?.message || err);
      throw Object.assign(new Error("user fetch after upsert failed"), { code: "USER_FETCH_ERROR", cause: err });
    }
  }

  // Strategy B: Fallback to DDL schema (only if your DB actually uses that)
  // If you reach here, either the users table has an unknown shape or lacks required columns.
  // Fail clearly with guidance instead of writing to a mismatched schema.
  const err = Object.assign(new Error("Unsupported users schema: expected columns displayName/email/photoURL"), {
    code: "USERS_SCHEMA_UNSUPPORTED",
    hint: "Ensure the 'users' table includes columns: email (UNIQUE), displayName, photoURL. Or adapt the helper to your schema.",
  });
  console.error("[lib/users]", err.message);
  throw err;
}
