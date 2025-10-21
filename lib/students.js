
/**
 * Cached student directory per campus, fetched from external service once and reused.
 * Avoids repeated "fetch-base" calls from browsers and reduces overall network I/O.
 * Minimal logs to verify caching behavior.
 */

import { wrapCache } from "./cache.js";

const STUDENT_SOURCE =
  process.env.STUDENT_API_URL || "https://bot.casitaapps.com/fetch-base";
const STUDENT_TTL_MS = Number(process.env.STUDENT_CACHE_TTL_MS || 15 * 60 * 1000); // 15 minutes

// Normalize campus code for student directory fetches:
// If PMB or PMA is requested, use PM as the consolidated source.
function normalizeCampusForStudents(campus) {
  const c = String(campus || "").toUpperCase();
  if (c === "PMB" || c === "PMA") return "PM";
  return c;
}

async function fetchStudentsFromSource(campus) {
  const body = JSON.stringify({ data: { plantel: campus } });
  const res = await fetch(STUDENT_SOURCE, {
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
  if (norm !== String(campus)) {
    console.log("[lib/students] campus normalized for students:", { requested: campus, normalized: norm });
  }
  const key = `students:${norm}`;
  return wrapCache(key, STUDENT_TTL_MS, () => fetchStudentsFromSource(norm));
}
