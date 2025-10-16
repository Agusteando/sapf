
/**
 * Lightweight DB compat migrations to satisfy legacy triggers that reference old column names.
 * We add VIRTUAL generated alias columns when needed (e.g., padre -> parent_name) so triggers can read NEW.padre.
 * This is safe for MySQL 5.7+ and requires ALTER privileges. Logs are provided for verification.
 */

export async function columnExists(pool, table, column) {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return Number(rows?.[0]?.cnt || 0) > 0;
  } catch (e) {
    console.warn("[lib/migrations] columnExists error:", e?.message || e);
    return false;
  }
}

/**
 * Add a VIRTUAL generated alias column, e.g. ADD COLUMN padre VARCHAR(255) GENERATED ALWAYS AS (parent_name) VIRTUAL.
 * Note: For string aliases we use VARCHAR(255). For other data types, choose appropriate type if you add more mappings.
 */
export async function addVirtualAliasColumn(pool, table, legacyCol, baseExpr, dataType = "VARCHAR(255)") {
  try {
    const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${legacyCol}\` ${dataType} GENERATED ALWAYS AS (\`${baseExpr}\`) VIRTUAL`;
    await pool.execute(sql);
    console.log("[lib/migrations] Added virtual alias column", { table, legacyCol, baseExpr, dataType });
    return true;
  } catch (e) {
    // If it fails due to permissions or MySQL version, log and continue; callers should proceed gracefully.
    console.warn("[lib/migrations] addVirtualAliasColumn failed:", { table, legacyCol, baseExpr, dataType, error: e?.message || e });
    return false;
  }
}

/**
 * Ensure minimal legacy alias columns exist for fichas_atencion so triggers that reference old names do not fail.
 * Currently we only add 'padre' -> parent_name, based on observed trigger error. Extend mappings if new errors appear.
 */
export async function ensureLegacyAliasColumns(pool) {
  const table = "fichas_atencion";

  // Minimal mapping observed in error logs:
  const mappings = [
    { legacy: "padre", base: "parent_name", type: "VARCHAR(255)" },
  ];

  for (const m of mappings) {
    const exists = await columnExists(pool, table, m.legacy);
    if (!exists) {
      console.log("[lib/migrations] Missing legacy column detected; creating alias:", { legacy: m.legacy, base: m.base });
      await addVirtualAliasColumn(pool, table, m.legacy, m.base, m.type);
    }
  }
}
