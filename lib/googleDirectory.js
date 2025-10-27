
import { google } from "googleapis";
import { wrapCache } from "@/lib/cache";

/**
 * Minimal in-memory cache by email.
 * Each entry: { name, photoUrl, ts }
 */
const mem = new Map();
const MEM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function now() {
  return Date.now();
}

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function getEnvCredentials() {
  // Preferred explicit env vars
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  let private_key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  // Support for \n escaped newlines in env var
  if (private_key.includes("\\n")) {
    private_key = private_key.replace(/\\n/g, "\n");
  }

  if (client_email && private_key) {
    return { client_email, private_key };
  }

  // Fallback: JSON content in GOOGLE_APPLICATION_CREDENTIALS_JSON
  try {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "";
    if (raw) {
      const parsed = JSON.parse(raw);
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }
  } catch (e) {
    console.warn("[googleDirectory] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", e?.message || e);
  }

  return { client_email: "", private_key: "" };
}

async function getDirectoryClient() {
  const { client_email, private_key } = getEnvCredentials();
  const subject =
    process.env.GDIR_IMPERSONATE ||
    process.env.GOOGLE_ADMIN_IMPERSONATE ||
    process.env.ADMIN_IMPERSONATOR_EMAIL ||
    "";

  if (!client_email || !private_key || !subject) {
    console.warn("[googleDirectory] Missing credentials or impersonation subject. Fields present:", {
      hasClientEmail: !!client_email,
      hasPrivateKey: !!private_key,
      subject,
    });
    return null;
  }

  const scopes = ["https://www.googleapis.com/auth/admin.directory.user.readonly"];
  const jwtClient = new google.auth.JWT(client_email, null, private_key, scopes, subject);
  await jwtClient.authorize();
  const service = google.admin({ version: "directory_v1", auth: jwtClient });
  return service;
}

/**
 * Fetch user profile from Google Directory for a single email.
 */
async function fetchProfileForEmail(service, email) {
  try {
    const res = await service.users.get({
      userKey: email,
      projection: "full",
    });
    const data = res?.data || {};
    const name = data?.name?.fullName || "";
    const photoUrl = data?.thumbnailPhotoUrl || "";
    return { name, photoUrl };
  } catch (e) {
    const code = e?.code || e?.response?.status || "ERR";
    const msg = e?.message || e?.response?.data || e;
    console.warn("[googleDirectory] users.get failed:", email, code, String(msg).slice(0, 160));
    return { name: "", photoUrl: "" };
  }
}

/**
 * Get display profiles for institutional emails.
 * Returns an object keyed by normalized email => { name, photoUrl }.
 * Uses a small in-memory cache and upstream Directory API.
 */
export async function getDisplayProfiles(input) {
  try {
    const list = Array.isArray(input)
      ? input
      : typeof input === "object" && input !== null
      ? Object.keys(input)
      : String(input || "")
          .split(/[,;\s]+/g)
          .filter(Boolean);

    const emails = Array.from(
      new Set(list.map((e) => normalizeEmail(e)))
    ).filter(Boolean);

    if (emails.length === 0) return {};

    const result = {};
    const missing = [];

    const nowTs = now();
    for (const e of emails) {
      const cached = mem.get(e);
      if (cached && nowTs - cached.ts < MEM_TTL_MS) {
        result[e] = { name: cached.name || "", photoUrl: cached.photoUrl || "" };
      } else {
        missing.push(e);
      }
    }

    if (missing.length === 0) {
      return result;
    }

    // Use wrapCache to throttle a combined fetch window for the set
    const key = `gdir:batch:${missing.sort().join(",")}`;
    const ttl = 5 * 60 * 1000; // 5 minutes dedup window

    const fetchedMap = await wrapCache(key, ttl, async () => {
      const map = {};
      const service = await getDirectoryClient();
      if (!service) {
        console.warn("[googleDirectory] Directory client unavailable. Returning empty for missing entries.");
        for (const m of missing) {
          map[m] = { name: "", photoUrl: "" };
        }
        return map;
      }

      console.log("[googleDirectory] Fetching profiles for", missing.length, "emails.");
      // Sequential fetch to stay within QPS limits; can be batched/concurrent with p-limit if needed.
      for (const m of missing) {
        const prof = await fetchProfileForEmail(service, m);
        map[m] = prof;
      }
      return map;
    });

    const final = { ...result };
    const stamp = now();
    for (const [e, prof] of Object.entries(fetchedMap || {})) {
      final[e] = { name: prof?.name || "", photoUrl: prof?.photoUrl || "" };
      mem.set(e, { name: final[e].name, photoUrl: final[e].photoUrl, ts: stamp });
    }

    return final;
  } catch (e) {
    console.error("[googleDirectory] getDisplayProfiles fatal error:", e?.message || e);
    return {};
  }
}
