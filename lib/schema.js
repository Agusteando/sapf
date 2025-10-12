
/**
 * Runtime schema helpers to safely build dynamic WHERE clauses based on actual DB columns.
 * Adds minimal debugging logs to validate runtime assumptions.
 *
 * Note: Do not import mysql here. We receive a pooled connection (from lib/db) as an argument.
 */

import { campusSynonyms, normalizeForSql } from "./campus.js";

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

/**
 * Build a normalized campus clause that tolerates case/whitespace differences and accepts synonyms
 * (short code vs human label) across whichever columns exist among: campus, plantel, escuela.
 * Returns { clause: string, params: any[] }
 */
export async function buildNormalizedCampusClause(pool, alias, campusValue) {
  const cols = await getFichasColumns(pool);
  const candidates = ["campus", "plantel", "escuela"].filter((c) => cols.has(c));
  if (candidates.length === 0 || !campusValue) {
    console.warn("[lib/schema] No campus-like columns found or no campusValue; skipping normalized campus filter");
    return { clause: "1=1", params: [] };
  }

  const synonyms = campusSynonyms(campusValue);
  const normalized = synonyms.map((s) => normalizeForSql(s));
  // Deduplicate normalized values
  const normSet = Array.from(new Set(normalized));
  console.log("[lib/schema] Normalized campus synonyms:", normSet);

  const prefix = alias ? `${alias}.` : "";
  const perCol = candidates.map((c) => {
    const colExpr = `TRIM(UPPER(${prefix}${c}))`;
    const placeholders = normSet.map(() => "?").join(", ");
    return `${colExpr} IN (${placeholders})`;
  });

  const clause = `(${perCol.join(" OR ")})`;
  // For each column we need to pass all normalized synonyms
  const params = candidates.flatMap(() => normSet);
  return { clause, params };
}
