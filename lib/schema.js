
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
 * Expose a safe way to check if a column exists in fichas_atencion.
 */
export async function hasFichasColumn(pool, name) {
  const cols = await getFichasColumns(pool);
  return cols.has(name);
}

/**
 * Build a safe campus clause using whichever columns exist among: school_code, campus, plantel, escuela.
 * Prefer school_code when available (matches production data semantics).
 * - alias: optional table alias (e.g., 'f'). If falsy, no alias prefix will be used.
 * - campusValue: string value to match against.
 * Returns { clause: string, params: any[] }
 */
export async function buildCampusClause(pool, alias, campusValue) {
  const cols = await getFichasColumns(pool);
  const candidates = ["school_code", "campus", "plantel", "escuela"].filter((c) => cols.has(c));

  if (candidates.length === 0 || !campusValue) {
    console.warn("[lib/schema] No campus-like columns found or no campusValue; skipping campus filter");
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
 * (short code vs human label) across whichever columns exist among: school_code, campus, plantel, escuela.
 * Returns { clause: string, params: any[] }
 */
export async function buildNormalizedCampusClause(pool, alias, campusValue) {
  const cols = await getFichasColumns(pool);
  const candidates = ["school_code", "campus", "plantel", "escuela"].filter((c) => cols.has(c));
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

/**
 * Internal: CASE expression to compute a normalized origin when no explicit column exists.
 * "parent" if likely from a parent/portal; else "internal".
 */
function originCaseExprInternal(alias) {
  const a = alias ? `${alias}.` : "";
  return `CASE
    WHEN LOWER(${a}contact_method) IN ('parent','padres','parent-portal','portal-padres','portal_padres')
      OR LOWER(${a}created_by) LIKE '%parent%'
      OR LOWER(${a}original_department) LIKE '%padre%'
      OR LOWER(${a}original_department) LIKE '%portal%'
    THEN 'parent'
    ELSE 'internal'
  END`;
}

/**
 * Build an expression that yields 'parent' or 'internal' depending on available columns
 * (origin, entry_type, source) or computed heuristics.
 */
export async function buildOriginExpr(pool, alias) {
  const a = alias ? `${alias}.` : "";
  const hasOrigin = await hasFichasColumn(pool, "origin");
  const hasEntryType = await hasFichasColumn(pool, "entry_type");
  const hasSource = await hasFichasColumn(pool, "source");
  if (hasOrigin) return `LOWER(${a}origin)`;
  if (hasEntryType) return `LOWER(${a}entry_type)`;
  if (hasSource) return `LOWER(${a}source)`;
  return originCaseExprInternal(alias);
}

/**
 * Build an expression that yields numeric priority level (2 for high, 1 for normal).
 * If a "priority" column exists, prefer it (coalescing to computed).
 */
export async function buildPriorityExpr(pool, alias) {
  const a = alias ? `${alias}.` : "";
  const hasPriority = await hasFichasColumn(pool, "priority");
  const originCase = originCaseExprInternal(alias);
  const computed = `CASE WHEN (${originCase}) = 'parent' THEN 2 ELSE 1 END`;
  if (hasPriority) {
    return `COALESCE(${a}priority, ${computed})`;
  }
  return computed;
}

/**
 * Build a condition expression that is true when the origin is "parent", using columns or heuristics.
 * Useful for KPIs (SUM(CASE WHEN (...) THEN 1 ELSE 0 END)).
 */
export async function originIsParentConditionExpr(pool, alias) {
  const originExpr = await buildOriginExpr(pool, alias);
  return `(${originExpr}) = 'parent'`;
}
