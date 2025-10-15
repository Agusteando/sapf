
/**
 * UI helpers for department option shaping and labels.
 * Avoids duplicating mapping logic across client components.
 */

export function combinedEmailLabel(email, displayName = "") {
  const e = String(email || "").trim();
  const name = String(displayName || "").trim();
  if (e && name) return `${name} <${e}>`;
  return e;
}

export function departmentOptions(depts = {}, namesMap = {}) {
  return Object.keys(depts || {}).map((deptName) => {
    const entry = depts[deptName]?.[0] || {};
    const email = entry.email || "";
    const nameFromMap = namesMap[String(email).toLowerCase()] || entry.email_display_name || "";
    const combined = combinedEmailLabel(email, nameFromMap);
    return {
      value: deptName,
      label: deptName,
      email,
      displayName: nameFromMap,
      combined
    };
  });
}
