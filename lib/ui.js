
/**
 * UI helpers for labels and options, enriched to include photo URLs when available.
 */

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

export function combinedEmailLabel(email, displayName = "") {
  const e = String(email || "").trim();
  const name = String(displayName || "").trim();
  if (!e) return "";
  if (name) return `${name} <${e}>`;
  return e;
}

/**
 * Build "canalizar a" department options from departments object:
 * departments: { [department_name]: [{ email, supervisor_email, email_display_name, supervisor_display_name, email_photo_url, supervisor_photo_url }] }
 * institutionalProfiles: { [emailLower]: { name, photoUrl } }
 */
export function departmentOptions(departments = {}, institutionalProfiles = {}) {
  const options = [];
  const names = Object.keys(departments || {});
  for (const deptName of names) {
    const list = departments[deptName] || [];
    const rec = list[0] || {};
    const email = rec.email || "";
    const supEmail = rec.supervisor_email || "";

    const emailLower = normalizeEmail(email);
    const supLower = normalizeEmail(supEmail);

    const displayName = rec.email_display_name || institutionalProfiles[emailLower]?.name || "";
    const supDisplayName = rec.supervisor_display_name || institutionalProfiles[supLower]?.name || "";

    const photoUrl =
      rec.email_photo_url ||
      institutionalProfiles[emailLower]?.photoUrl ||
      rec.supervisor_photo_url ||
      institutionalProfiles[supLower]?.photoUrl ||
      "";

    options.push({
      value: deptName,
      label: deptName,
      email,
      displayName,
      supEmail,
      supDisplayName,
      combined: combinedEmailLabel(email, displayName),
      supCombined: combinedEmailLabel(supEmail, supDisplayName),
      photoUrl,
    });
  }
  // Sort alphabetically by label, accent-aware for Spanish
  options.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return options;
}
