
/**
 * Resolve a profile object from a profiles map keyed by lowercase email.
 * - profiles: { [emailLower]: { name: string, photoUrl: string } }
 * - email: string (any case)
 * - fallbackName: used when profile missing or name empty
 */
export function resolveProfile(profiles, email, fallbackName = "") {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return { email: "", name: String(fallbackName || "").trim(), photoUrl: "" };
  const rec = profiles?.[key] || null;
  if (!rec) return { email: key, name: String(fallbackName || "").trim(), photoUrl: "" };
  const name = String(rec?.name || fallbackName || "").trim();
  const photoUrl = String(rec?.photoUrl || "").trim();
  return { email: key, name, photoUrl };
}

/**
 * Heuristic to pick the most relevant internal email for a ticket to display.
 * Prefers department_email; otherwise tries created_by if it looks like an email.
 */
export function getTicketDisplayEmail(ticket) {
  const dep = String(ticket?.department_email || "").trim();
  if (dep && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dep)) return dep;
  const creator = String(ticket?.created_by || "").trim();
  if (creator && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(creator)) return creator;
  return "";
}

/**
 * Build a human-friendly display name when Directory name is absent.
 * Falls back to department names or generic label.
 */
export function fallbackDisplayName(ticket) {
  const t = ticket || {};
  const dept = String(t.target_department || t.original_department || "").trim();
  if (dept) return dept;
  const creator = String(t.created_by || "").trim();
  if (creator && !creator.includes("@")) return creator;
  if (t.parent_name) return `Atención a ${t.parent_name}`;
  return "Personal del plantel";
}
