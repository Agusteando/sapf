
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
      from: fromParam
    } = body || {};

    console.log("[api/send-email][POST] received fields:", {
      hasTo: Boolean(to),
      hasSubject: Boolean(subject),
      hasHtml: Boolean(html || message),
      hasTemplate: Boolean(template),
      hasAttachments: Array.isArray(attachments) ? attachments.length : 0
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

    const payload = {
      to,
      alias: alias || sessionName || "SAPF",
      subject,
      html: html || message || "",
      message: message || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      data: data || {},
      template: template || "",
      from
    };

    console.log("[api/send-email] forwarding to external service. to:", Array.isArray(to) ? to.length : 1);

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
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ ok: true, message: "Email sent successfully", upstreamStatus: upstreamRes.status }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error) {
    console.error("[api/send-email][POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
