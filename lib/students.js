
/**
 * Cached student directory per campus, fetched from external service once and reused.
 * Avoids repeated "fetch-base" calls from browsers and reduces overall network I/O.
 * Minimal logs to verify caching behavior.
 */

import { wrapCache } from "./cache.js";

const STUDENT_SOURCE =
  process.env.STUDENT_API_URL || "https://matricula.casitaapps.com/fetch-base";
const STUDENT_TTL_MS = Number(process.env.STUDENT_CACHE_TTL_MS || 15 * 60 * 1000); // 15 minutes

// Normalize campus code for student directory fetches:
// - Consolidate PMA/PMB -> PM
// - Map Preescolar SAPF codes to upstream API codes:
//   PREES MET -> PREEM (Preescolar Metepec)
//   PREES TOL -> PREET (Preescolar Toluca)
export function normalizeCampusForStudents(campus) {
  const raw = String(campus || "");
  const c = raw.trim().toUpperCase();

  // Consolidate Primaria Metepec Alta/Baja to PM
  if (c === "PMB" || c === "PMA") return "PM";

  // Preescolar Metepec mappings
  if (c === "PREES MET" || c === "PREESCOLAR METEPEC" || c === "PREES_MET" || c === "PREES-MET") {
    return "PREEM";
  }

  // Preescolar Toluca mappings
  if (c === "PREES TOL" || c === "PREESCOLAR TOLUCA" || c === "PREES_TOL" || c === "PREES-TOL") {
    return "PREET";
  }

  return c;
}

async function fetchStudentsFromSource(campus) {
  const body = JSON.stringify({ data: { plantel: campus } });
  const url = STUDENT_SOURCE;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[lib/students] fetch-base failed:", res.status, text.slice(0, 256));
    throw new Error("fetch-base failed");
  }

  const payload = await res.json();

  // Normalize response to a flat array of student entries.
  let students = [];
  if (Array.isArray(payload)) {
    if (payload.length === 1 && typeof payload[0] === "object" && !Array.isArray(payload[0])) {
      students = Object.values(payload[0]).flat();
    } else {
      students = payload.flatMap((item) => {
        if (Array.isArray(item)) return item;
        if (item && typeof item === "object") return Object.values(item).flat();
        return [];
      });
    }
  } else if (payload && typeof payload === "object") {
    students = Object.values(payload).flat();
  }

  console.log("[lib/students] fetched", Array.isArray(students) ? students.length : 0, "records for campus:", campus);
  return students;
}

export async function getStudentsForCampus(campus) {
  const norm = normalizeCampusForStudents(campus);
  if (norm !== String(campus).toUpperCase()) {
    console.log("[lib/students] campus normalized for external fetch:", { requested: campus, normalized: norm });
  }
  const key = `students:${norm}`;
  return wrapCache(key, STUDENT_TTL_MS, () => fetchStudentsFromSource(norm));
}
