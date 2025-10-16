
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export const runtime = "nodejs";

// Simple in-memory rate limiter per IP
const rl = new Map(); // ip -> { ts, count }
const WINDOW_MS = 60_000;
const MAX_REQ = 8;

function getClientIp(request) {
  const xf = request.headers.get("x-forwarded-for") || "";
  const xr = request.headers.get("x-real-ip") || "";
  const ip = (xf.split(",")[0] || xr || "anon").trim();
  return ip || "anon";
}

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function normalizeMatricula(m) {
  return String(m || "").trim().toUpperCase();
}

// Map matricula prefix (first 2 chars) to campus codes
function campusCandidatesFromMatricula(matricula) {
  const m = normalizeMatricula(matricula);
  const prefix = m.slice(0, 2);
  switch (prefix) {
    case "PM": return ["PMA", "PMB"]; // primaria alta/baja metepec
    case "PT": return ["PT"];
    case "SM": return ["SM"];
    case "ST": return ["ST"];
    case "CM": return ["CM"];
    case "CT": return ["CT"];
    case "DM": return ["DM"];
    default: return [];
  }
}

export async function OPTIONS(request, context = { params: {} }) {
  const params = await context.params;
  const origin = request.headers.get("origin") || "*";
  const res = new NextResponse(null, { status: 204 });
  const h = corsHeaders(origin);
  Object.entries(h).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  const origin = request.headers.get("origin") || "*";
  try {
    const ip = getClientIp(request);
    const t = Date.now();
    const e = rl.get(ip) || { ts: t, count: 0 };
    if (t - e.ts > WINDOW_MS) {
      e.ts = t; e.count = 0;
    }
    e.count += 1;
    rl.set(ip, e);
    if (e.count > MAX_REQ) {
      const tooMany = NextResponse.json({ error: "Demasiadas solicitudes; intenta de nuevo más tarde." }, { status: 429 });
      const h = corsHeaders(origin);
      Object.entries(h).forEach(([k, v]) => tooMany.headers.set(k, v));
      tooMany.headers.set("x-rate-limit", `${e.count}/${MAX_REQ}/${WINDOW_MS}ms`);
      return tooMany;
    }

    const payload = await request.json().catch(() => ({}));
    const {
      matricula,
      parent_name,
      parent_email,
      phone_number,
      student_name,
      campus: campusInput,
      reason,
      is_complaint,
      target_department
    } = payload || {};

    console.log("[api/public/parent-tickets][POST] incoming:", {
      hasMatricula: Boolean(matricula),
      hasReason: Boolean(reason),
      parent_name_len: (parent_name || "").length,
      student_name_len: (student_name || "").length,
      campusInput,
      is_complaint,
      target_department
    });

    if (!matricula || !reason) {
      const bad = NextResponse.json({ error: "Faltan campos requeridos: matricula, reason" }, { status: 400 });
      const h = corsHeaders(origin);
      Object.entries(h).forEach(([k, v]) => bad.headers.set(k, v));
      return bad;
    }

    // Infer campus from matricula if not provided
    let campus = String(campusInput || "").trim().toUpperCase();
    if (!campus) {
      const candidates = campusCandidatesFromMatricula(matricula);
      campus = candidates[0] || ""; // pick first guess if multiple
    }
    if (!campus) {
      console.warn("[api/public/parent-tickets] campus could not be inferred from matricula:", matricula);
    }

    const pool = await getConnection();

    // Parent-origin tickets: mark using internal heuristics-compatible fields
    const created_by = "Padres";
    const original_department = "Reporte de Padres";
    const contact_method = "parent";

    // Persist
    const [result] = await pool.execute(
      `INSERT INTO fichas_atencion (
        fecha,
        parent_name,
        reason,
        resolution,
        initial_action,
        campus,
        contact_method,
        department_email,
        updated_at,
        status,
        target_department,
        is_complaint,
        appointment_date,
        student_name,
        phone_number,
        parent_email,
        school_code,
        created_by,
        original_department
      ) VALUES (
        NOW(), ?, ?, '', '', ?, ?, '', NOW(), '0', ?, ?, NULL, ?, ?, ?, ?, ?, ?
      )`,
      [
        parent_name || "",
        reason,
        campus || "",
        contact_method,
        target_department || "",
        is_complaint ? 1 : 0,
        student_name || "",
        phone_number || "",
        parent_email || "",
        campus || "",
        created_by,
        original_department
      ]
    );

    const ticketId = result.insertId;
    const folioNumber = String(ticketId).padStart(5, "0");
    console.log("[api/public/parent-tickets] inserted ticketId:", ticketId, "folio:", folioNumber);

    const ok = NextResponse.json({ success: true, ticketId, folioNumber });
    const h = corsHeaders(origin);
    Object.entries(h).forEach(([k, v]) => ok.headers.set(k, v));
    return ok;
  } catch (error) {
    console.error("[api/public/parent-tickets][POST] error:", error);
    const err = NextResponse.json({ error: "Error al registrar la solicitud." }, { status: 500 });
    const h = corsHeaders(origin);
    Object.entries(h).forEach(([k, v]) => err.headers.set(k, v));
    return err;
  }
}
