
/**
 * User persistence helpers.
 * - Ensures a "users" table exists.
 * - Creates or updates a user row on each successful Google login.
 * - Adds minimal debug logs to verify runtime behavior.
 */

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureUsersTable(pool) {
  // Create table if not exists
  const sql = `
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
  `;
  await pool.execute(sql);
}

export async function createOrUpdateUser(pool, { email, name = "", picture = "", hd = "", isAdmin = false }) {
  const e = normalizeEmail(email);
  if (!e) {
    throw new Error("createOrUpdateUser: email is required");
  }
  await ensureUsersTable(pool);

  // Upsert: insert if new, else update fields and increment login_count
  const upsertSql = `
    INSERT INTO users (email, name, picture, hd, provider, is_admin, login_count, last_login)
    VALUES (?, ?, ?, ?, 'google', ?, 1, NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      picture = VALUES(picture),
      hd = VALUES(hd),
      provider = 'google',
      is_admin = GREATEST(is_admin, VALUES(is_admin)), -- retain admin if already set; promote if requested
      login_count = login_count + 1,
      last_login = NOW();
  `;
  const upsertParams = [e, String(name || ""), String(picture || ""), String(hd || ""), isAdmin ? 1 : 0];
  const [result] = await pool.execute(upsertSql, upsertParams);
  console.log("[lib/users] upsert result:", { affectedRows: result?.affectedRows, insertId: result?.insertId, email: e });

  // Fetch the current row to return consistent shape to callers
  const [rows] = await pool.execute("SELECT id, email, name, picture, hd, provider, is_admin, login_count, created_at, updated_at, last_login FROM users WHERE email = ? LIMIT 1", [e]);
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) {
    console.warn("[lib/users] upsert follow-up fetch returned no row for email:", e);
  }
  return row;
}
