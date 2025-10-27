
import { google } from "googleapis";
import { wrapCache } from "@/lib/cache";

// Internal memo cache for short-lived lookups to avoid repeated API calls
const mem = new Map();
const MEM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function ts() {
  return Date.now();
}
function nrm(e) {
  return String(e || "").trim().toLowerCase();
}

function getEnvCredentials() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  let private_key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  if (private_key.includes("\\n")) {
    private_key = private_key.replace(/\\n/g, "\n");
  }

  if (client_email && private_key) {
    return { client_email, private_key };
  }

  try {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "";
    if (raw) {
      const parsed = JSON.parse(raw);
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }
  } catch (e) {
    console.warn("[lib/googleDirectory] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", e?.message || e);
  }

  return { client_email: "", private_key: "" };
}

async function getDirectoryClient() {
  const { client_email, private_key } = getEnvCredentials();
  const subject =
    process.env.GDIR_IMPERSONATE ||
    process.env.GOOGLE_ADMIN_IMPERSONATE ||
    process.env.ADMIN_IMPERSONATOR_EMAIL ||
    "desarrollo.tecnologico@casitaiedis.edu.mx"; // sensible default aligned with example

  if (!client_email || !private_key || !subject) {
    console.warn("[lib/googleDirectory] Missing credentials/subject:", {
      hasClientEmail: !!client_email,
      hasPrivateKey: !!private_key,
      subjectPresent: !!subject,
    });
    return null;
  }

  const scopes = ["https://www.googleapis.com/auth/admin.directory.user.readonly"];
  const jwt = new google.auth.JWT(client_email, null, private_key, scopes, subject);
  await jwt.authorize();
  const service = google.admin({ version: "directory_v1", auth: jwt });
  return service;
}

async function fetchProfile(service, email) {
  try {
    const res = await service.users.get({
      userKey: email,
      projection: "full",
    });
    const data = res?.data || {};
    // The "golden" full display name as in your example (!admin listing uses name.fullName)
    const fullName = data?.name?.fullName || "";
    const photoUrl = data?.thumbnailPhotoUrl || "";
    return { name: fullName, photoUrl };
  } catch (e) {
    const code = e?.code || e?.response?.status || "ERR";
    const msg = e?.message || e?.response?.data || e;
    console.warn("[lib/googleDirectory] users.get failed:", email, code, String(msg).slice(0, 200));
    return { name: "", photoUrl: "" };
  }
}

/**
 * Resolves display profiles for emails, returning exact Directory fullName + photoUrl.
 * Output shape: { [normalizedEmail]: { name: fullName, photoUrl } }
 */
export async function getDisplayProfiles(input) {
  try {
    const list = Array.isArray(input)
      ? input
      : typeof input === "object" && input !== null
      ? Object.keys(input)
      : String(input || "").split(/[,;\s]+/g).filter(Boolean);

    const emails = Array.from(new Set(list.map(nrm))).filter(Boolean);
    if (emails.length === 0) return {};

    const out = {};
    const missing = [];
    const nowTs = ts();

    for (const e of emails) {
      const cached = mem.get(e);
      if (cached && nowTs - cached.ts < MEM_TTL_MS) {
        out[e] = { name: cached.name || "", photoUrl: cached.photoUrl || "" };
      } else {
        missing.push(e);
      }
    }

    if (missing.length === 0) return out;

    const key = `gdir:batch:${missing.sort().join(",")}`;
    const ttl = 5 * 60 * 1000;

    const fetched = await wrapCache(key, ttl, async () => {
      const map = {};
      const service = await getDirectoryClient();
      if (!service) {
        console.warn("[lib/googleDirectory] Directory client unavailable. Returning blanks for", missing.length, "emails");
        for (const m of missing) map[m] = { name: "", photoUrl: "" };
        return map;
      }
      console.log("[lib/googleDirectory] Fetching Directory profiles:", missing.length);
      // Serial fetch to be safe; adjust to limited concurrency if needed.
      for (const m of missing) {
        map[m] = await fetchProfile(service, m);
      }
      return map;
    });

    const stamped = ts();
    const final = { ...out };
    for (const [e, prof] of Object.entries(fetched || {})) {
      final[e] = { name: prof?.name || "", photoUrl: prof?.photoUrl || "" };
      mem.set(e, { name: final[e].name, photoUrl: final[e].photoUrl, ts: stamped });
    }
    return final;
  } catch (e) {
    console.error("[lib/googleDirectory] getDisplayProfiles fatal:", e?.message || e);
    return {};
  }
}
