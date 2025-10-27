
/**
 * UI helpers for rendering department options and email labels consistently.
 * Ensures Workspace full display name (user.name.fullName) is used and prefixed with "Nombre: ".
 */

function splitDomains(envVal) {
  return String(envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function domainOf(email) {
  const m = String(email || "").toLowerCase().match(/^[^@]+@([^@]+)$/);
  return m ? m[1] : "";
}

function isInstitutionalEmail(email) {
  const allowedDomains = splitDomains(process.env.INTERNAL_EMAIL_DOMAINS || process.env.AUTH_ALLOWED_DOMAINS || "");
  const d = domainOf(email);
  if (!d) return false;
  return allowedDomains.length === 0 ? true : allowedDomains.includes(d);
}

/**
 * Prefer Workspace user.name.fullName, fallback to .name and then provided fallback.
 */
function resolveFullName(profiles, email, fallbackName) {
  const key = String(email || "").toLowerCase();
  const prof = (profiles && typeof profiles === "object") ? profiles[key] : null;
  const full = (prof && (prof.fullName || prof.name)) || "";
  return full || String(fallbackName || "");
}

function ensureNombrePrefix(nameLike) {
  const raw = String(nameLike || "").trim();
  if (!raw) return "";
  return /^nombre\s*:/i.test(raw) ? raw : `Nombre: ${raw}`;
}

/**
 * Combined "Nombre: X <email>" when possible, else just email.
 */
export function combinedEmailLabel(email, name) {
  const e = String(email || "").trim();
  const n = String(name || "").trim();
  if (e && n) return `${ensureNombrePrefix(n)} <${e}>`;
  return e || "";
}

/**
 * Build department options for a searchable select.
 */
export function departmentOptions(departments, institutionalProfiles) {
  const out = [];
  if (!departments || typeof departments !== "object") return out;

  for (const [depName, rows] of Object.entries(departments)) {
    const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};

    const email = String(first.email || "").trim();
    const supEmail = String(first.supervisor_email || "").trim();

    // Prefer enriched names from API (already prefixed "Nombre: ..."), else resolve from profiles.
    const enrichedDisplay = String(first.email_display_name || "").trim();
    const fullName = enrichedDisplay
      ? enrichedDisplay.replace(/^nombre:\s*/i, "").trim()
      : resolveFullName(institutionalProfiles, email, "");

    const name = fullName ? ensureNombrePrefix(fullName) : "";

    const photoUrl =
      String(first.email_photo_url || "").trim() ||
      (institutionalProfiles?.[String(email).toLowerCase()]?.photoUrl || "");

    out.push({
      value: depName,
      label: depName,
      email,
      supervisorEmail: supEmail,
      name,
      photoUrl,
      combined: combinedEmailLabel(email, fullName),
    });
  }

  // Sort for stable UI
  out.sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "es"));
  return out;
}
