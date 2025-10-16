
import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { credential } = await request.json();
    console.log("[api/auth/login][POST] credential present:", Boolean(credential));

    if (!credential) {
      return NextResponse.json({ error: "Falta token de Google." }, { status: 400 });
    }

    // Validate ID token using Google tokeninfo endpoint
    const tokeninfoRes = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential),
      { method: "GET", cache: "no-store" }
    );

    if (!tokeninfoRes.ok) {
      const body = await tokeninfoRes.text();
      console.error("[api/auth/login] tokeninfo not ok:", body);
      return NextResponse.json({ error: "Token de Google inválido." }, { status: 401 });
    }

    const tokeninfo = await tokeninfoRes.json();
    const email = tokeninfo.email;
    const emailVerified = tokeninfo.email_verified === "true" || tokeninfo.email_verified === true;
    const aud = tokeninfo.aud;

    const expectedAud = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GSI_CLIENT_ID || "";
    if (expectedAud && aud !== expectedAud) {
      console.warn("[api/auth/login] Audience mismatch", { aud, expectedAud });
      return NextResponse.json({ error: "Audiencia inválida." }, { status: 401 });
    }

    if (!email || !emailVerified) {
      return NextResponse.json({ error: "Email no verificado." }, { status: 401 });
    }

    // Optional allowlists
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
    const emailAllowed = allowedEmails.length === 0 || allowedEmails.includes(email.toLowerCase());
    if (!domainAllowed && !emailAllowed) {
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
    console.log("[api/auth/login] login OK:", user.email);
    return res;
  } catch (error) {
    console.error("[api/auth/login][POST] error:", error);
    return NextResponse.json({ error: "Error de autenticación." }, { status: 500 });
  }
}
