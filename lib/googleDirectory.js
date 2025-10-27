
import { google } from "googleapis";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Google Admin SDK Directory integration for resolving user display profiles.
 * - Reads credentials from GOOGLE_APPLICATION_CREDENTIALS (credentials.json), or env vars.
 * - Auth via service account JWT with domain-wide delegation (GOOGLE_DELEGATED_USER).
 * - Fetches user.name.fullName and photo URLs (thumbnailPhotoUrl / photos[0].photoUrl).
 * - Returns a map keyed by lowercase email for backward compatibility.
 *
 * Supported environment variables:
 *   - GOOGLE_APPLICATION_CREDENTIALS: path to credentials.json (preferred).
 *   - GOOGLE_CREDENTIALS_JSON or GOOGLE_SA_CREDENTIALS: JSON string blob of credentials.
 *   - GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY: pair of values (private key may include \n).
 *   - GOOGLE_DELEGATED_USER (preferred) or GOOGLE_DELEGATED_SUBJECT/ADMIN_IMPERSONATE_EMAIL for subject.
 */

const SCOPES = ["https://www.googleapis.com/auth/admin.directory.user.readonly"];

let jwtClientSingleton = null;
let directoryServiceSingleton = null;
let authReady = false;

// Minimal log helper (avoids leaking secrets)
function safeLog(label, obj) {
  try {
    const clone = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const lk = k.toLowerCase();
      if (lk.includes("key") || lk.includes("secret")) {
        clone[k] = "hidden";
      } else if (lk.includes("email")) {
        const s = String(v || "");
        clone[k] = s ? `len:${s.length}:${s.slice(-4)}` : "";
      } else if (lk.includes("path")) {
        const s = String(v || "");
        clone[k] = s ? `${s.slice(0, 2)}…${s.slice(-10)}` : "";
      } else {
        clone[k] = v;
      }
    }
    console.log(`[googleDirectory] ${label}:`, clone);
  } catch {
    // ignore
  }
}

function normalizePrivateKey(pk) {
  if (!pk) return "";
  let key = String(pk);
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  // Ensure proper PEM boundaries exist if the file had them stripped
  if (!/-----BEGIN [A-Z ]+ PRIVATE KEY-----/.test(key)) {
    // We cannot fabricate a valid PEM; return as-is and let auth fail with clear logs
    return key.trim();
  }
  return key;
}

/**
 * Attempt to load a service account from a credentials.json file path.
 * Returns: { client_email, private_key, keyFilePath, fileType }
 */
async function loadServiceAccountFromFile() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_ADC || "";
  if (!p) return null;
  try {
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    const fileContent = await readFile(abs);
    const parsed = JSON.parse(fileContent.toString());
    const fileType = parsed.type || "";
    let client_email = parsed.client_email || parsed.clientEmail || "";
    let private_key = normalizePrivateKey(parsed.private_key || parsed.privateKey || "");

    // Log type to help diagnose when a non-service account file is provided
    safeLog("Loaded service account from file", { path: abs, client_email, type: fileType });

    // If the JSON is not of type "service_account", it likely lacks a private_key
    if (fileType && fileType !== "service_account") {
      console.warn("[googleDirectory] credentials.json type is not 'service_account'. Provide a Service Account key JSON for domain-wide delegation.");
    }

    // If private_key is missing in file, we can still pass keyFilePath to google-auth-library,
    // which supports JSON key files directly.
    const keyFilePath = abs;

    if (!client_email && parsed?.client_email) {
      client_email = parsed.client_email;
    }

    return { client_email, private_key, keyFilePath, fileType };
  } catch (e) {
    console.warn("[googleDirectory] Failed to read GOOGLE_APPLICATION_CREDENTIALS:", e?.message || e);
    return null;
  }
}

/**
 * Normalize and parse service account credentials from environment variables.
 * Returns: { client_email, private_key, keyFilePath }
 */
async function loadServiceAccountFromEnv() {
  // 1) Try credentials.json via GOOGLE_APPLICATION_CREDENTIALS
  const fromFile = await loadServiceAccountFromFile();
  if (fromFile) return fromFile;

  // 2) Try full JSON blob
  const json = process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_SA_CREDENTIALS;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      let client_email = parsed.client_email || parsed.clientEmail || "";
      let private_key = normalizePrivateKey(parsed.private_key || parsed.privateKey || "");
      if (!client_email || !private_key) {
        throw new Error("Invalid GOOGLE_CREDENTIALS_JSON: missing client_email or private_key");
      }
      safeLog("Loaded service account from GOOGLE_CREDENTIALS_JSON", { client_email, type: parsed.type || "" });
      return { client_email, private_key, keyFilePath: "" };
    } catch (e) {
      console.error("[googleDirectory] Failed to parse GOOGLE_CREDENTIALS_JSON:", e?.message || e);
    }
  }

  // 3) Fallback to pair variables
  const client_email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GCP_CLIENT_EMAIL || "";
  const private_key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY || "");

  if (client_email && private_key) {
    safeLog("Loaded service account from env pair", { client_email });
    return { client_email, private_key, keyFilePath: "" };
  }

  throw new Error(
    "Missing Google service account credentials in env. Provide GOOGLE_APPLICATION_CREDENTIALS (service account JSON), or GOOGLE_CREDENTIALS_JSON, or GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY."
  );
}

/**
 * Initialize and memoize JWT client and Admin SDK directory service.
 */
async function getDirectoryService() {
  if (directoryServiceSingleton && authReady) return directoryServiceSingleton;

  const subject =
    process.env.GOOGLE_DELEGATED_USER ||
    process.env.GOOGLE_DELEGATED_SUBJECT ||
    process.env.ADMIN_IMPERSONATE_EMAIL ||
    "";

  if (!subject) {
    console.warn("[googleDirectory] Missing GOOGLE_DELEGATED_USER/GOOGLE_DELEGATED_SUBJECT/ADMIN_IMPERSONATE_EMAIL; domain-wide delegation requires a subject.");
  }

  const { client_email, private_key, keyFilePath, fileType } = await loadServiceAccountFromEnv();

  // Build JWT using options object: prefer in-memory key; otherwise pass keyFile path
  const jwtOptions = {
    email: client_email,
    key: private_key && private_key.trim().length > 0 ? private_key : undefined,
    keyFile: (!private_key || private_key.trim().length === 0) && keyFilePath ? keyFilePath : undefined,
    scopes: SCOPES,
    subject: subject || undefined,
  };

  // Helpful debug (no secrets)
  safeLog("JWT options prepared", {
    hasKey: Boolean(jwtOptions.key),
    hasKeyFile: Boolean(jwtOptions.keyFile),
    subject: subject || "",
    fileType: fileType || "",
  });

  if (!jwtOptions.key && !jwtOptions.keyFile) {
    throw new Error("No key or keyFile available for JWT. Ensure credentials.json is a Service Account key or provide GOOGLE_PRIVATE_KEY.");
  }

  jwtClientSingleton = new google.auth.JWT(jwtOptions);

  try {
    await jwtClientSingleton.authorize();
    authReady = true;
  } catch (e) {
    authReady = false;
    console.error("[googleDirectory] JWT authorize failed:", e?.message || e);
    // Provide an extra hint when the file wasn't a service account
    if (fileType && fileType !== "service_account") {
      console.warn("[googleDirectory] Hint: Provided credentials file is not a Service Account key. Download a JSON key from IAM > Service Accounts and set GOOGLE_APPLICATION_CREDENTIALS to its path.");
    }
    throw e;
  }

  directoryServiceSingleton = google.admin({
    version: "directory_v1",
    auth: jwtClientSingleton,
  });

  safeLog("Admin SDK initialized", {
    hasSubject: Boolean(subject),
    scopeCount: SCOPES.length,
    client_email,
  });

  return directoryServiceSingleton;
}

/**
 * Extract a friendly name and photo URL from a Directory user resource.
 * - Prefers user.name.fullName
 * - Photo URL: user.thumbnailPhotoUrl, or fallback to first user.photos[].photoUrl
 */
function extractProfileFromUser(user) {
  if (!user || typeof user !== "object") return { name: "", photoUrl: "" };
  const name = user?.name?.fullName || user?.name?.givenName || "";
  let photoUrl = "";

  if (user.thumbnailPhotoUrl) {
    photoUrl = user.thumbnailPhotoUrl;
  } else if (Array.isArray(user.photos) && user.photos.length > 0) {
    const p = user.photos.find((ph) => ph?.photoUrl);
    if (p?.photoUrl) photoUrl = p.photoUrl;
  }

  return { name: String(name || "").trim(), photoUrl: String(photoUrl || "").trim() };
}

/**
 * Small async pool to throttle concurrent GET calls to Directory API.
 */
async function asyncPool(items, limit, worker) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = Promise.resolve()
      .then(() => worker(item))
      .then((res) => {
        executing.delete(p);
        return res;
      })
      .catch((err) => {
        executing.delete(p);
        console.warn("[googleDirectory] worker error:", err?.message || err);
      });
    results.push(p);
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Fetch a single Directory user by email using users.get
 */
async function fetchDirectoryUserByEmail(service, email) {
  try {
    const res = await service.users.get({
      userKey: email,
      projection: "full",
      viewType: "admin_view",
    });
    return res?.data || null;
  } catch (e) {
    const code = e?.code || e?.response?.status || "ERR";
    if (code === 404) {
      console.warn("[googleDirectory] user not found:", email);
    } else if (code === 403) {
      console.warn("[googleDirectory] access denied for:", email, "— verify Admin SDK scopes and domain-wide delegation.");
    } else {
      console.warn("[googleDirectory] users.get failed", { email, code, msg: e?.message || e });
    }
    return null;
  }
}

/**
 * Main function expected by the application.
 * Input: string[] of emails
 * Output: Map keyed by lowercase email => { name: fullName, photoUrl }
 *
 * - Uses Admin SDK users.get per email for precision.
 * - Keeps output compatible with previous implementation.
 * - Gracefully handles missing/forbidden users and continues.
 */
export async function getDisplayProfiles(emails) {
  try {
    const service = await getDirectoryService();

    const unique = Array.from(
      new Set(
        (Array.isArray(emails) ? emails : [])
          .map((e) => String(e || "").trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
      )
    );

    if (unique.length === 0) {
      return {};
    }

    const concurrency = Number(process.env.GDIR_CONCURRENCY || 6);
    console.log("[googleDirectory] Resolving profiles via Admin SDK", {
      count: unique.length,
      concurrency,
    });

    const results = {};

    await asyncPool(unique, concurrency, async (email) => {
      const user = await fetchDirectoryUserByEmail(service, email);
      if (!user) return;
      const { name, photoUrl } = extractProfileFromUser(user);
      results[email] = { name, photoUrl };
    });

    const found = Object.keys(results).length;
    const missing = unique.length - found;
    console.log("[googleDirectory] Profiles resolved", { found, missing });

    return results;
  } catch (e) {
    console.error("[googleDirectory] getDisplayProfiles fatal error:", e?.message || e);
    return {};
  }
}
