
import crypto from "crypto";

// HMAC-signed session cookie utilities for Node runtime (API routes/server).
// Edge middleware uses WebCrypto to verify the same cookie format.

export const SESSION_COOKIE_NAME = "sapf_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET || "dev-auth-secret-change-me";
  if (!process.env.AUTH_SECRET) {
    console.warn("[lib/auth] AUTH_SECRET not set; using insecure development fallback.");
  }
  return secret;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlFromBuffer(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(payloadStr) {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(payloadStr, "utf8");
  return b64urlFromBuffer(h.digest());
}

export function createSessionCookie({ user, maxAgeSeconds = 8 * 60 * 60 }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.email,
    email: user.email,
    name: user.name || "",
    picture: user.picture || "",
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const payloadStr = JSON.stringify(payload);
  const value = `${b64url(payloadStr)}.${sign(payloadStr)}`;

  const secure = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return cookie;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production";
  return [
    `${SESSION_COOKIE_NAME}=deleted`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function fromB64url(str) {
  const pad = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64").toString("utf8");
}

export function verifySessionValue(value) {
  try {
    if (!value) return null;
    const [payloadB64, sig] = value.split(".");
    if (!payloadB64 || !sig) return null;
    const payloadStr = fromB64url(payloadB64);
    const expected = sign(payloadStr);
    if (sig !== expected) return null;
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (!payload.email) return null;
    return payload;
  } catch (e) {
    console.error("[lib/auth] verifySessionValue error:", e);
    return null;
  }
}
