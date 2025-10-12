
/**
 * Campus mapping and normalization helpers.
 * Provides synonyms between short codes and human-readable labels,
 * returning canonical variants for broader matching in SQL filters.
 */

export const CAMPUS_MAP = {
  PMB: "Primaria Baja Metepec",
  PMA: "Primaria Alta Metepec",
  PT: "Primaria Toluca",
  SM: "Secundaria Metepec",
  ST: "Secundaria Toluca",
  CM: "Casita Metepec",
  CT: "Casita Toluca",
  DM: "Desarrollo Metepec",
};

/**
 * Return an array of synonyms (both code and label) for a given input.
 * If the input matches a known code, include the long label. If it matches a known label, include its code.
 * Always include the original input as well.
 */
export function campusSynonyms(input) {
  if (!input) return [];
  const raw = String(input).trim();
  const out = new Set([raw]);

  // If input is code, add long label
  if (CAMPUS_MAP[raw]) {
    out.add(CAMPUS_MAP[raw]);
  }

  // If input is one of the labels, add its code
  for (const [code, label] of Object.entries(CAMPUS_MAP)) {
    if (label.toLowerCase() === raw.toLowerCase()) {
      out.add(code);
    }
  }

  // Add commonly used safe variants (e.g., remove accents not assumed here)
  // Consumers will normalize case/whitespace later for SQL comparisons.

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
