
/**
 * Runtime schema helpers to safely build dynamic WHERE clauses based on actual DB columns.
 * Adds minimal debugging logs to validate runtime assumptions.
 *
 * Note: Do not import mysql here. We receive a pooled connection (from lib/db) as an argument.
 */

let cachedColumns = null;
let loggedOnce = false;

/**
 * Fetch and cache available columns for fichas_atencion.
 * Uses the provided pool to avoid importing mysql in this module.
 */
async function getFichasColumns(pool) {
  if (cachedColumns) return cachedColumns;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM fichas_atencion");
    cachedColumns = new Set(rows.map((r) => r.Field));
    if (!loggedOnce) {
      console.log("[lib/schema] Cached fichas_atencion columns:", Array.from(cachedColumns));
      loggedOnce = true;
    }
  } catch (err) {
    console.error("[lib/schema] Error fetching table columns:", err);
    cachedColumns = new Set(); // Avoid repeated queries if it fails
  }
  return cachedColumns;
}

/**
 * Build a safe campus clause using whichever columns exist among: campus, plantel, escuela.
 * - alias: optional table alias (e.g., 'f'). If falsy, no alias prefix will be used.
 * - campusValue: string value to match against.
 * Returns { clause: string, params: any[] }
 */
export async function buildCampusClause(pool, alias, campusValue) {
  const cols = await getFichasColumns(pool);
  const candidates = ["campus", "plantel", "escuela"].filter((c) => cols.has(c));

  if (candidates.length === 0) {
    console.warn("[lib/schema] No campus-like columns found; skipping campus filter");
    return { clause: "1=1", params: [] };
  }

  const prefix = alias ? `${alias}.` : "";
  const parts = candidates.map((c) => `${prefix}${c} = ?`);
  const clause = `(${parts.join(" OR ")})`;
  const params = Array(candidates.length).fill(campusValue);
  return { clause, params };
}
