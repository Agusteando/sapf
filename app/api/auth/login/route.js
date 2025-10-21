
import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";
import { getConnection } from "@/lib/db";
import { createOrUpdateUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskToken(tok = "") {
  const s = String(tok || "");
  if (!s) return "";
  return `len:${s.length}:${s.slice(-10)}`;
}
function clientIp(request) {
  const xf = request.headers.get("x-forwarded-for") || "";
  const xr = request.headers.get("x-real-ip") || "";
  const ip = (xf.split(",")[0] || xr || "anon").trim();
  return ip || "anon";
}
function maybeDebugHeader(res, key, value) {
  try {
    if (process.env.AUTH_DEBUG_HEADERS === "1") {
      res.headers.set(key, String(value));
    }
  } catch {}
}

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  const ip = clientIp(request);
  try {
    const body = await request.json().catch(() => ({}));
    const credential = body?.credential || "";
    console.log("[api/auth/login][POST] start", { hasCredential: Boolean(credential), credInfo: maskToken(credential), ip });

    if (!credential) {
      const res = NextResponse.json({ error: "Falta token de Google.", code: "MISSING_CREDENTIAL" }, { status: 400 });
      maybeDebugHeader(res, "x-auth-step", "missing-credential");
      return res;
    }

    let tokeninfoRes;
    try {
      const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential);
      tokeninfoRes = await fetch(url, { method: "GET", cache: "no-store" });
    } catch (err) {
      console.error("[api/auth/login] tokeninfo fetch error:", err?.message || err);
      const res = NextResponse.json({ error: "No se pudo verificar token (red).", code: "TOKENINFO_NETWORK" }, { status: 502 });
      maybeDebugHeader(res, "x-auth-step", "tokeninfo-network");
      return res;
    }

    if (!tokeninfoRes.ok) {
      const bodyText = await tokeninfoRes.text().catch(() => "");
      console.error("[api/auth/login] tokeninfo not ok:", tokeninfoRes.status, bodyText.slice(0, 300));
      const res = NextResponse.json({ error: "Token de Google inválido.", code: "TOKENINFO_INVALID", status: tokeninfoRes.status }, { status: 401 });
      maybeDebugHeader(res, "x-auth-step", "tokeninfo-invalid");
      return res;
    }

    const tokeninfo = await tokeninfoRes.json().catch(() => ({}));
    const email = tokeninfo.email;
    const emailVerified = tokeninfo.email_verified === "true" || tokeninfo.email_verified === true;
    const aud = tokeninfo.aud;
    const hd = tokeninfo.hd || (email && email.split("@")[1]) || "";
    const expectedAud = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GSI_CLIENT_ID || "";

    console.log("[api/auth/login] tokeninfo parsed:", {
      aud, expectedAud, audMatch: !expectedAud || aud === expectedAud,
      emailPresent: Boolean(email), emailVerified, hd
    });

    if (expectedAud && aud !== expectedAud) {
      console.warn("[api/auth/login] Audience mismatch", { aud, expectedAud, ip });
      const res = NextResponse.json({ error: "Audiencia inválida.", code: "AUDIENCE_MISMATCH", aud, expected: expectedAud }, { status: 401 });
      maybeDebugHeader(res, "x-auth-step", "audience-mismatch");
      return res;
    }

    if (!email || !emailVerified) {
      const res = NextResponse.json({ error: "Email no verificado.", code: "EMAIL_NOT_VERIFIED" }, { status: 401 });
      maybeDebugHeader(res, "x-auth-step", "email-not-verified");
      return res;
    }

    const allowedDomains = (process.env.AUTH_ALLOWED_DOMAINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";

    const domainAllowed = allowedDomains.length === 0 || allowedDomains.includes(domain);
    const emailAllowed = allowedEmails.length === 0 || allowedEmails.includes(String(email || "").toLowerCase());

    console.log("[api/auth/login] allow-check:", {
      domain, allowedDomains, domainAllowed,
      email, allowedEmails, emailAllowed
    });

    if (!domainAllowed && !emailAllowed) {
      const res = NextResponse.json({ error: "Acceso restringido a correo institucional.", code: "ACCESS_DENIED" }, { status: 403 });
      maybeDebugHeader(res, "x-auth-step", "access-denied");
      return res;
    }

    const user = {
      email,
      name: tokeninfo.name || "",
      picture: tokeninfo.picture || "",
    };

    // Persist/Update user as non-admin (rol remains unchanged unless previously admin)
    let dbUser = null;
    try {
      const pool = await getConnection();
      dbUser = await createOrUpdateUser(pool, {
        email: user.email,
        name: user.name,
        picture: user.picture,
        hd,
        isAdmin: false
      });
    } catch (err) {
      const code = err?.code || "USER_UPSERT_FAIL";
      const expose = process.env.AUTH_EXPOSE_ERRORS === "1";
      const payload = {
        error: "No se pudo registrar usuario.",
        code,
        hint: err?.hint || undefined
      };
      if (expose && err?.ddl) payload.ddl = err.ddl;
      console.error("[api/auth/login] user upsert error:", code, err?.message || err);
      const res = NextResponse.json(payload, { status: 500 });
      maybeDebugHeader(res, "x-auth-step", "user-upsert-fail");
      maybeDebugHeader(res, "x-users-error-code", code);
      if (err?.hint) maybeDebugHeader(res, "x-users-hint", err.hint);
      if (expose && err?.ddl) maybeDebugHeader(res, "x-users-ddl-available", "1");
      return res;
    }

    let cookie = "";
    try {
      cookie = createSessionCookie({ user, maxAgeSeconds: 8 * 60 * 60 });
    } catch (err) {
      console.error("[api/auth/login] createSessionCookie error:", err?.message || err);
      const res = NextResponse.json({ error: "No se pudo crear sesión.", code: "COOKIE_CREATE_FAIL" }, { status: 500 });
      maybeDebugHeader(res, "x-auth-step", "cookie-fail");
      return res;
    }

    const res = NextResponse.json({ ok: true, user, dbUser });
    res.headers.append("Set-Cookie", cookie);
    res.headers.set("x-auth-issued", "true");
    res.headers.set("x-auth-route", "login");
    res.headers.set("x-user-upsert", "ok");
    maybeDebugHeader(res, "x-auth-email", user.email);
    maybeDebugHeader(res, "x-auth-domain", hd);
    maybeDebugHeader(res, "x-auth-admin", "0");

    // Debug: log cookie being set and selected response headers
    try {
      console.log("[api/auth/login] Cookie being set:", cookie ? cookie.substring(0, 100) + "..." : "NONE");
      console.log("[api/auth/login] Response headers:", {
        setCookie: res.headers.get("set-cookie"),
        xAuthIssued: res.headers.get("x-auth-issued"),
      });
    } catch (e) {
      console.warn("[api/auth/login] header logging failed:", e?.message || e);
    }

    console.log("[api/auth/login] OK", { email: user.email, dbUserId: dbUser?.id, ip });
    return res;
  } catch (error) {
    console.error("[api/auth/login][POST] error:", error?.message || error);
    const res = NextResponse.json({ error: "Error de autenticación.", code: "GENERIC_AUTH_ERROR" }, { status: 500 });
    maybeDebugHeader(res, "x-auth-step", "catch-all");
    return res;
  }
}
