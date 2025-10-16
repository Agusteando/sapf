
import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validates Google ID token using Google tokeninfo endpoint, checks allowed domains/emails,
// and issues a signed, HttpOnly session cookie upon success.

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { credential } = await request.json();
    console.log("[api/auth/admin-login][POST] Received credential:", Boolean(credential));

    if (!credential) {
      return NextResponse.json({ error: "Falta token de Google." }, { status: 400 });
    }

    // Validate Google ID token using tokeninfo
    const tokeninfoRes = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential),
      { method: "GET", cache: "no-store" }
    );

    if (!tokeninfoRes.ok) {
      const errText = await tokeninfoRes.text();
      console.error("[api/auth/admin-login] tokeninfo error:", errText);
      return NextResponse.json({ error: "Token de Google inválido." }, { status: 401 });
    }

    const tokeninfo = await tokeninfoRes.json();

    // Expected audience (client id)
    const audience =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GSI_CLIENT_ID || "";
    if (!audience) {
      console.warn("[api/auth/admin-login] GOOGLE_CLIENT_ID/NEXT_PUBLIC_GSI_CLIENT_ID no configurado");
    }

    const audOK = !audience || tokeninfo.aud === audience;
    const email = tokeninfo.email;
    const emailVerified = tokeninfo.email_verified === "true" || tokeninfo.email_verified === true;
    const hd = tokeninfo.hd || (email && email.split("@")[1]) || "";

    if (!emailVerified || !email) {
      return NextResponse.json({ error: "Email no verificado." }, { status: 401 });
    }
    if (!audOK) {
      return NextResponse.json({ error: "Audiencia inválida." }, { status: 401 });
    }

    // Allow rules
    const allowedDomains = (process.env.AUTH_ALLOWED_DOMAINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // If allow lists exist, enforce them
    let domainAllowed = true;
    let emailAllowed = true;

    if (allowedDomains.length > 0) {
      domainAllowed = allowedDomains.includes(hd.toLowerCase());
    }
    if (allowedEmails.length > 0) {
      emailAllowed = allowedEmails.includes(email.toLowerCase());
    }

    if (!domainAllowed && !emailAllowed) {
      console.warn("[api/auth/admin-login] Acceso denegado por dominio/email:", { email, hd });
      return NextResponse.json({ error: "Acceso restringido a correo institucional." }, { status: 403 });
    }

    const user = {
      email,
      name: tokeninfo.name || "",
      picture: tokeninfo.picture || "",
    };

    const cookie = createSessionCookie({ user, maxAgeSeconds: 8 * 60 * 60 });
    const res = NextResponse.json({ ok: true, user });
    res.headers.append("Set-Cookie", cookie);
    res.headers.set("x-auth-issued", "true");
    console.log("[api/auth/admin-login] Login OK:", user.email);
    return res;
  } catch (error) {
    console.error("[api/auth/admin-login][POST] error:", error);
    return NextResponse.json({ error: "Error de autenticación." }, { status: 500 });
  }
}
