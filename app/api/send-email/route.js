
import { NextResponse } from "next/server";
import { verifySessionValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function splitEmails(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean).map((s) => String(s).trim()).filter(Boolean);
  return String(input)
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function domainOf(email) {
  const m = String(email).toLowerCase().match(/^[^@]+@([^@]+)$/);
  return m ? m[1] : "";
}

function isInternalEmail(email, allowedDomains) {
  const d = domainOf(email);
  if (!d) return false;
  return allowedDomains.includes(d);
}

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const body = await request.json();
    const {
      to,
      alias,
      subject,
      html,
      message,
      attachments,
      data,
      template,
      from: fromParam,
      scope
    } = body || {};

    console.log("[api/send-email][POST] received fields:", {
      hasTo: Boolean(to),
      hasSubject: Boolean(subject),
      hasHtml: Boolean(html || message),
      hasTemplate: Boolean(template),
      hasAttachments: Array.isArray(attachments) ? attachments.length : 0,
      scope
    });

    if (!to || !subject || !(html || message)) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: to, subject, html/message" },
        { status: 400 }
      );
    }

    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = parseCookie(cookieHeader);
    const sessionRaw = cookies[SESSION_COOKIE_NAME];
    const session = verifySessionValue(sessionRaw);
    const sessionEmail = session?.email || "";
    const sessionName = session?.name || "";

    const from = fromParam || sessionEmail;
    if (!from) {
      console.warn("[api/send-email] Missing sender; provide body.from or ensure authenticated session.");
      return NextResponse.json({ error: "Falta remitente (from)" }, { status: 400 });
    }

    const recipients = splitEmails(to);

    // Internal email guard: only allow external recipients for nursing scope.
    const allowedDomains = (process.env.INTERNAL_EMAIL_DOMAINS || process.env.AUTH_ALLOWED_DOMAINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // If no allowed domains configured, we default to blocking all external recipients (fail closed),
    // unless this is explicitly a nursing scope request.
    const isNursingScope = scope === "nursing";
    if (!isNursingScope) {
      if (allowedDomains.length === 0) {
        // Block everything to be safe
        console.warn("[api/send-email] No INTERNAL_EMAIL_DOMAINS configured; blocking non-nursing outbound email.");
        return NextResponse.json(
          { error: "Envío de correos externos deshabilitado. Solo permitido para Reporte de Enfermería." },
          { status: 403 }
        );
      }
      const invalid = recipients.filter((r) => !isInternalEmail(r, allowedDomains));
      if (invalid.length > 0) {
        console.warn("[api/send-email] Blocking external recipients on non-nursing scope:", invalid);
        return NextResponse.json(
          { error: "Destinatarios externos no permitidos en esta sección.", invalid },
          { status: 403 }
        );
      }
    }

    const payload = {
      to: recipients,
      alias: alias || sessionName || "SAPF",
      subject,
      html: html || message || "",
      message: message || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      data: data || {},
      template: template || "",
      from
    };

    console.log("[api/send-email] forwarding to external service", {
      scope: isNursingScope ? "nursing" : "internal-only",
      toCount: recipients.length
    });

    const upstreamRes = await fetch("https://observaciones.casitaapps.com/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const text = await upstreamRes.text();
    const ok = upstreamRes.ok;

    console.log("[api/send-email] upstream status:", upstreamRes.status, "length:", text.length);

    if (!ok) {
      return new NextResponse(
        JSON.stringify({ error: "Upstream email send failed", status: upstreamRes.status, detail: text.slice(0, 300) }),
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "x-email-scope": isNursingScope ? "nursing" : "internal" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ ok: true, message: "Email sent successfully", upstreamStatus: upstreamRes.status }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "x-email-scope": isNursingScope ? "nursing" : "internal" } }
    );
  } catch (error) {
    console.error("[api/send-email][POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
