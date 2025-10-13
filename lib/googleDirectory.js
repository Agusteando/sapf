
import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { wrapCache } from "./cache.js";

const SCOPES = ["https://www.googleapis.com/auth/admin.directory.user.readonly"];
const CREDS_PATH = path.join(process.cwd(), "credentials.json");

// Cache keys
const KEY_SVC = "gdir:svc";
const TTL_SVC = 60 * 60 * 1000; // 1 hour
const TTL_USER = 24 * 60 * 60 * 1000; // 24 hours

async function buildService() {
  try {
    const json = await fs.readFile(CREDS_PATH, "utf8");
    const auth = JSON.parse(json);
    const subject = process.env.GSUITE_DELEGATED_ADMIN || "desarrollo.tecnologico@casitaiedis.edu.mx";
    const jwtClient = new google.auth.JWT(auth.client_email, null, auth.private_key, SCOPES, subject);
    await jwtClient.authorize();
    const service = google.admin({ version: "directory_v1", auth: jwtClient });
    console.log("[lib/googleDirectory] Service initialized with subject:", subject);
    return service;
  } catch (e) {
    console.warn("[lib/googleDirectory] Failed to init service:", e?.message || e);
    return null;
  }
}

async function getService() {
  return wrapCache(KEY_SVC, TTL_SVC, buildService);
}

async function fetchDisplayName(email) {
  try {
    const svc = await getService();
    if (!svc) return "";
    const res = await svc.users.get({ userKey: email });
    const full = res?.data?.name?.fullName || "";
    return full;
  } catch (e) {
    const code = e?.code || e?.status || "";
    if (code === 404) {
      console.log("[lib/googleDirectory] user not found:", email);
    } else {
      console.warn("[lib/googleDirectory] users.get failed:", email, e?.message || e);
    }
    return "";
  }
}

/**
 * Get display names for a batch of emails. Returns a mapping: {email: fullName}
 * Caches each email individually to avoid extra API calls.
 */
export async function getDisplayNames(emails) {
  const arr = Array.isArray(emails) ? emails : [];
  const unique = Array.from(new Set(arr.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)));
  const pairs = await Promise.all(
    unique.map((email) =>
      wrapCache(`gdir:user:${email}`, TTL_USER, async () => {
        const name = await fetchDisplayName(email);
        return { email, name };
      })
    )
  );
  const out = {};
  for (const p of pairs) {
    if (p && p.email) out[p.email] = p.name || "";
  }
  return out;
}
