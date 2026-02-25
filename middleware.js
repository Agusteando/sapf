// middleware.js
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "sapf_session";

// Base64url decode mirroring lib/auth.js behavior
function fromB64url(str) {
  const pad = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  // Use atob for Edge/browser environment
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Base64url encode for ArrayBuffer results (HMAC digest)
function toB64url(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifySessionEdge(value, secret) {
  try {
    if (!value) {
      console.log("[middleware] No cookie value");
      return null;
    }
    const parts = value.split(".");
    if (parts.length !== 2) {
      console.log("[middleware] Invalid cookie format");
      return null;
    }
    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) {
      console.log("[middleware] Missing payload/signature");
      return null;
    }

    // Decode payload
    const payloadStr = fromB64url(payloadB64);
    console.log("[middleware] Decoded payload:", payloadStr.slice(0, 100) + "...");

    // Import HMAC key and compute expected signature over the UTF-8 payload string
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign", "verify"]
    );

    const expectedSigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payloadStr));
    const expectedSigB64 = toB64url(expectedSigBuf);

    const ok = sigB64 === expectedSigB64;
    console.log("[middleware] Signature verification:", ok, {
      providedSigPreview: sigB64.substring(0, 16),
      expectedSigPreview: expectedSigB64.substring(0, 16),
    });
    if (!ok) return null;

    // Validate payload claims
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      console.log("[middleware] Token expired");
      return null;
    }
    if (!payload.email) {
      console.log("[middleware] No email in payload");
      return null;
    }
    console.log("[middleware] Session valid for:", payload.email);
    return payload;
  } catch (e) {
    console.error("[middleware] verifySessionEdge error:", e);
    return null;
  }
}

export async function middleware(request) {
  const url = request.nextUrl;
  const path = url.pathname;

  // Allow auth endpoints, healthcheck and static assets without session
  const isAuthEndpoint = path.startsWith("/api/auth/");
  const isLoginPage = path === "/login";
  const isHealth = path === "/api/health";
  const isStatic =
    path.startsWith("/_next/") ||
    path === "/favicon.ico" ||
    path.startsWith("/.well-known/") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".webp") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico") ||
    path.endsWith(".txt") ||
    path.endsWith(".xml") ||
    path.endsWith(".html");

  if (isStatic || isAuthEndpoint || isHealth) {
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
  console.log(
    "[middleware] Secret source:",
    secret === "dev-auth-secret-change-me" ? "DEVELOPMENT FALLBACK (insecure)" : "ENV VAR"
  );

  const session = await verifySessionEdge(sessionValue, secret);

  console.log("[middleware]", {
    path,
    hasSession: !!session,
    hasCookie: !!sessionValue,
    isLoginPage,
  });

  // If on login page and authenticated, redirect to home
  if (isLoginPage) {
    if (session) {
      console.log("[middleware] Authenticated user on /login, redirecting to /");
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // For all other requests, require valid session
  if (!session) {
    console.log("[middleware] No valid session, redirecting to /login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const res = NextResponse.next();
  res.headers.set("x-auth", "ok");
  return res;
}

export const config = {
  matcher: ["/((?!site.webmanifest|robots.txt|sitemap.xml).*)"],
};