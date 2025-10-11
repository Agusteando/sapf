
import { NextResponse } from "next/server";

// Enforce auth across the app, except for login page and auth endpoints.
// Verifies the HMAC-signed cookie using Edge WebCrypto to avoid Node-only APIs.

const SESSION_COOKIE_NAME = "sapf_session";

// Base64url helpers for Edge
function base64UrlToUint8Array(str) {
  const padLength = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function base64UrlDecodeToString(str) {
  const padLength = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const raw = atob(base64);
  let s = "";
  for (let i = 0; i < raw.length; i++) s += String.fromCharCode(raw.charCodeAt(i));
  return s;
}

async function verifySessionEdge(value, secret) {
  try {
    if (!value) return null;
    const [payloadB64, sigB64] = value.split(".");
    if (!payloadB64 || !sigB64) return null;
    const payloadStr = base64UrlDecodeToString(payloadB64);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );

    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToUint8Array(sigB64),
      enc.encode(payloadStr)
    );
    if (!ok) return null;

    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (!payload.email) return null;
    return payload;
  } catch (e) {
    console.error("[middleware] verifySessionEdge error:", e);
    return null;
  }
}

export async function middleware(request) {
  const url = request.nextUrl;
  const path = url.pathname;

  // Public paths
  const isAuthEndpoint = path.startsWith("/api/auth/");
  const isLoginPage = path === "/login";
  const isStatic =
    path.startsWith("/_next/") ||
    path === "/favicon.ico" ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".webp") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico") ||
    path.endsWith(".txt") ||
    path.endsWith(".xml");

  if (isStatic || isAuthEndpoint || isLoginPage) {
    return NextResponse.next();
  }

  // Read session cookie
  const cookieHeader = request.headers.get("cookie") || "";
  let sessionValue = null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE_NAME) {
      sessionValue = rest.join("=");
      break;
    }
  }

  const secret = process.env.AUTH_SECRET || "dev-auth-secret-change-me";
  const session = await verifySessionEdge(sessionValue, secret);

  if (!session) {
    const to = new URL("/login", request.url);
    return NextResponse.redirect(to);
  }

  // If authenticated user hits /login, redirect home
  if (isLoginPage) {
    const to = new URL("/", request.url);
    return NextResponse.redirect(to);
  }

  const res = NextResponse.next();
  res.headers.set("x-auth", "ok");
  return res;
}

export const config = {
  matcher: [
    "/((?!site.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
