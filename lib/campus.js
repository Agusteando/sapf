
/**
 * Campus mapping and normalization helpers.
 * Provides synonyms between short codes and human-readable labels,
 * returning canonical variants for broader matching in SQL filters.
 *
 * This list is authoritative for campus selection across the app.
 * Includes legacy synonyms (e.g., PMA/PMB) to remain compatible with historical data.
 */

export const CAMPUS_MAP = {
  PMA: "Primaria Metepec Alta",
    PMB: "Primaria Metepec Baja",
  PT: "Primaria Toluca",
  SM: "Secundaria Metepec",
  ST: "Secundaria Toluca",
  "PREES TOL": "Preescolar Toluca",
  "PREES MET": "Preescolar Metepec",
  CT: "Casita Toluca",
  CM: "Casita Metepec",
  DM: "Desarrollo Metepec",
  CO: "Casita Ocoyoacac",
  DC: "Desarrollo Calimaya",
};

// Legacy or additional synonyms that may exist in historical records or external systems.
// Keys and values will be normalized in campusSynonyms; keep them as-is here for clarity.
const EXTRA_SYNONYMS = {
  // Consolidate Primaria Metepec
  PM: ["PMA", "PMB", "Primaria Alta Metepec", "Primaria Baja Metepec", "PRIMARIA METEPEC", "Primaria Metepec"],
  PMA: ["PM", "PMB", "Primaria Metepec", "Primaria Alta Metepec"],
  PMB: ["PM", "PMA", "Primaria Metepec", "Primaria Baja Metepec"],

  // Preescolar variants
  "PREES TOL": ["PREES-TOL", "PREES_TOL", "Preescolar Toluca", "PREESCOLAR TOLUCA"],
  "PREES MET": ["PREES-MET", "PREES_MET", "Preescolar Metepec", "PREESCOLAR METEPEC"],

  // Casita and others
  CT: ["Casita Toluca"],
  CM: ["Casita Metepec"],
  DM: ["Desarrollo Metepec"],

  PT: ["Primaria Toluca"],
  SM: ["Secundaria Metepec"],
  ST: ["Secundaria Toluca"],

  // New planteles and friendly aliases
  CO: ["Casita Ocoyoacac", "Ocoyoacac"],
  DC: ["Desarrollo Calimaya", "Calimaya"],
};

/**
 * Return an array of synonyms (both code and label) for a given input.
 * - Always include the original input raw.
 * - If input is a code in CAMPUS_MAP, include the long label and extra synonyms.
 * - If input matches a long label, include its code.
 * - Include legacy aliases from EXTRA_SYNONYMS for tolerant matching (e.g., PMA/PMB <-> PM).
 */
export function campusSynonyms(input) {
  if (!input) return [];
  const raw = String(input).trim();
  const out = new Set([raw]);

  // If input is code, add long label and extras
  if (Object.prototype.hasOwnProperty.call(CAMPUS_MAP, raw)) {
    out.add(CAMPUS_MAP[raw]);
    const extras = EXTRA_SYNONYMS[raw] || [];
    for (const s of extras) out.add(s);
  }

  // If input is a label, add matching code
  for (const [code, label] of Object.entries(CAMPUS_MAP)) {
    if (label.toLowerCase() === raw.toLowerCase()) {
      out.add(code);
      const extras = EXTRA_SYNONYMS[code] || [];
      for (const s of extras) out.add(s);
    }
  }

  // If input is a legacy alias (e.g., PMA/PMB), add linked family
  const legacyKey = Object.keys(EXTRA_SYNONYMS).find((k) =>
    EXTRA_SYNONYMS[k].some((syn) => syn.toLowerCase() === raw.toLowerCase())
  );
  if (legacyKey) {
    out.add(legacyKey);
    out.add(CAMPUS_MAP[legacyKey] || legacyKey);
    const extras = EXTRA_SYNONYMS[legacyKey] || [];
    for (const s of extras) out.add(s);
  }

  return Array.from(out);
}

/**
 * Normalize a string for SQL UPPER/TRIM comparisons.
 * - Trim whitespace
 * - Collapse internal whitespace to single space
 * - Uppercase
 */
export function normalizeForSql(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}
