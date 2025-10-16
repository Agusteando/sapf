
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause, buildOriginExpr, buildPriorityExpr } from "@/lib/schema";
import { wrapCache, getCache } from "@/lib/cache";

export const runtime = "nodejs";

// Lightweight server-side throttle to suppress rapid repeats per client+query
const throttleMap = new Map(); // key => { ts: number }
function getClientIp(request) {
  const xf = request.headers.get("x-forwarded-for") || "";
  const xr = request.headers.get("x-real-ip") || "";
  const ip = (xf.split(",")[0] || xr || "anon").trim();
  return ip || "anon";
}

function monthRange(yyyyMm) {
  const ok = /^\d{4}-\d{2}$/.test(yyyyMm);
  if (!ok) return null;
  const [yStr, mStr] = yyyyMm.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const next = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return {
    start: start.toISOString().slice(0, 19).replace("T", " "),
    endExclusive: next.toISOString().slice(0, 19).replace("T", " "),
  };
}

function getSchoolYearRange(schoolYear) {
  if (!schoolYear) return null;
  const [startYear, endYear] = schoolYear.split("-").map(Number);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return null;
  const start = `${startYear}-08-01 00:00:00`;
  const endExclusive = `${endYear}-08-01 00:00:00`;
  return { start, endExclusive };
}

function buildKey({ campus, status, schoolYear, month }) {
  return `tickets:${campus || "all"}:${status ?? "all"}:${schoolYear || ""}:${month || ""}`;
}

function buildTicketEmailHTML({ folio, campus, dept, parentName, studentName, reason, resolution, createdBy, contactMethod, appointmentDate }) {
  const appt = appointmentDate ? new Date(appointmentDate).toLocaleString("es-MX") : "—";
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827;">
      <h2 style="color:#1d4ed8;margin-bottom:8px;">Canalización de ficha</h2>
      <p style="margin: 0 0 10px 0;">Folio: <strong>${folio}</strong></p>
      <p style="margin: 0 0 10px 0;">Plantel: <strong>${campus}</strong></p>
      <p style="margin: 0 0 10px 0;">Departamento destino: <strong>${dept || "—"}</strong></p>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:12px 0"/>
      <p style="margin: 0 0 6px 0;"><strong>Padre/Madre/Tutor:</strong> ${parentName || "—"}</p>
      <p style="margin: 0 0 6px 0;"><strong>Alumno:</strong> ${studentName || "—"}</p>
      <p style="margin: 0 0 6px 0;"><strong>Medio de contacto:</strong> ${contactMethod || "—"}</p>
      <p style="margin: 0 0 6px 0;"><strong>Cita:</strong> ${appt}</p>
      <h3 style="margin:12px 0 6px 0;">Motivo</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">${(reason || "—").replace(/\n/g, "<br/>")}</div>
      <h3 style="margin:12px 0 6px 0;">Resolución / Acción</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">${(resolution || "—").replace(/\n/g, "<br/>")}</div>
      <p style="margin-top:12px;color:#6b7280;font-size:12px;">Creado por: ${createdBy || "—"}</p>
    </div>
  `;
}

function uniq(a) {
  return Array.from(new Set(a.map((s) => String(s || "").trim().toLowerCase()))).filter(Boolean);
}

async function emailDepartment({ campus, deptName, subject, html, extraCc = [] }, pool) {
  try {
    const [rows] = await pool.execute(
      "SELECT email, supervisor_email FROM deptos_map WHERE campus = ? AND department_name = ? LIMIT 1",
      [campus, deptName || ""]
    );
    const primary = rows?.[0]?.email || "";
    const sup = rows?.[0]?.supervisor_email || "";
    const recipients = uniq([primary, sup, ...extraCc]);
    if (recipients.length === 0) {
      console.warn("[api/tickets] No recipients found for dept:", deptName, "campus:", campus);
      return;
    }
    const url = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/,"");
    const endpoint = url ? `${url}/api/send-email` : `${new URL("/api/send-email", "http://localhost").toString()}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipients, subject, html, scope: "internal" }),
      cache: "no-store"
    }).catch(() => null);

    if (!res || !res.ok) {
      const detail = res ? await res.text().catch(() => "") : "no response";
      console.warn("[api/tickets] department email failed:", res?.status, detail?.slice(0, 200));
    } else {
      console.log("[api/tickets] department email sent to", recipients.length, "recipient(s).");
    }
  } catch (e) {
    console.warn("[api/tickets] emailDepartment error:", e?.message || e);
  }
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get("campus");
    const status = searchParams.get("status");
    const schoolYear = searchParams.get("schoolYear");
    const month = searchParams.get("month");

    // Server-side throttle per IP+query to prevent spammy calls
    const ip = getClientIp(request);
    const tKey = `${ip}|tickets|campus=${campus || ""}|status=${status || ""}|sy=${schoolYear || ""}|m=${month || ""}`;
    const last = throttleMap.get(tKey)?.ts || 0;
    const nowTs = Date.now();
    const windowMs = 900;
    if (nowTs - last < windowMs) {
      const res204 = new NextResponse(null, { status: 204 });
      res204.headers.set("x-throttle", "tickets");
      res204.headers.set("x-throttle-window", String(windowMs));
      res204.headers.set("Cache-Control", "no-store");
      return res204;
    }
    throttleMap.set(tKey, { ts: nowTs });

    console.log("[api/tickets][GET] query params:", {
      campus, status, schoolYear, month,
    });

    const key = buildKey({ campus, status, schoolYear, month });
    const hadCached = Boolean(getCache(key));

    const ttl = 10_000;

    const resultRows = await wrapCache(key, ttl, async () => {
      const pool = await getConnection();

      const originExpr = await buildOriginExpr(pool, "f");
      const priorityExpr = await buildPriorityExpr(pool, "f");

      let query = `
        SELECT 
          f.id,
          LPAD(f.id, 5, "0") as folio_number,
          DATE_FORMAT(f.fecha, "%Y-%m-%d %H:%i:%s") as fecha,
          f.status,
          f.created_by,
          f.original_department,
          f.parent_name,
          f.student_name,
          f.reason,
          f.resolution,
          f.is_complaint,
          f.campus,
          f.school_code,
          f.contact_method,
          f.phone_number,
          f.parent_email,
          f.target_department,
          f.department_email,
          f.appointment_date,
          ${originExpr} AS origin,
          ${priorityExpr} AS priority_level
        FROM fichas_atencion f
        WHERE 1=1
      `;
      const qParams = [];

      if (campus) {
        const campusClause = await buildNormalizedCampusClause(pool, "f", campus);
        query += ` AND ${campusClause.clause}`;
        qParams.push(...campusClause.params);
      }

      if (status !== null && status !== undefined && status !== "") {
        query += " AND f.status = ?";
        qParams.push(status);
      }

      if (month) {
        const range = monthRange(month);
        if (range) {
          query += " AND f.fecha >= ? AND f.fecha < ?";
          qParams.push(range.start, range.endExclusive);
        }
      } else if (schoolYear) {
        const range = getSchoolYearRange(schoolYear);
        if (range) {
          query += " AND f.fecha >= ? AND f.fecha < ?";
          qParams.push(range.start, range.endExclusive);
        }
      } else {
        query += " AND MONTH(f.fecha) = MONTH(NOW()) AND YEAR(f.fecha) = YEAR(NOW())";
      }

      const rowLimit = 400;
      query += ` ORDER BY priority_level DESC, f.fecha DESC LIMIT ${rowLimit}`;

      console.log("[api/tickets][GET] ParamsLen:", qParams.length, "rowLimit:", rowLimit);

      const [rows] = await pool.execute(query, qParams);
      console.log("[api/tickets][GET] tickets rows:", rows?.length || 0);

      if (rows.length > 0) {
        const folios = rows.map((t) => t.folio_number || String(t.id).padStart(5, "0"));
        const placeholders = folios.map(() => "?").join(", ");
        const fuSql = `SELECT * FROM seguimiento WHERE ticket_id IN (${placeholders}) ORDER BY fecha ASC`;
        const [fu] = await pool.execute(fuSql, folios);
        const map = new Map();
        for (const r of fu) {
          const list = map.get(r.ticket_id) || [];
          list.push(r);
          map.set(r.ticket_id, list);
        }
        for (const t of rows) {
          const folio = t.folio_number || String(t.id).padStart(5, "0");
          t.followups = map.get(folio) || [];
        }
      }

      return rows;
    });

    const res = NextResponse.json(resultRows);
    res.headers.set("x-microcache", hadCached ? "HIT" : "MISS");
    res.headers.set("x-tickets-count", String(Array.isArray(resultRows) ? resultRows.length : 0));
    return res;
  } catch (error) {
    console.error("[api/tickets][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const {
      campus,
      contact_method,
      is_complaint,
      parent_name,
      student_name,
      phone_number,
      parent_email,
      reason,
      resolution,
      appointment_date,
      target_department,
      department_email,
      created_by,
      original_department,
      status,
      cc_emails
    } = await request.json();

    const pool = await getConnection();

    console.log("[api/tickets][POST] creating ticket with:", {
      campus,
      contact_method,
      is_complaint,
      parent_name_len: parent_name?.length || 0,
      student_name_len: student_name?.length || 0,
      target_department,
      original_department,
      has_appointment: Boolean(appointment_date),
      status,
      cc_count: Array.isArray(cc_emails) ? cc_emails.length : 0
    });

    // Insert ticket, persisting both school_code (preferred) and campus for legacy compatibility
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
        NOW(), ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        parent_name,
        reason,
        resolution,
        resolution,
        campus, // legacy campus field
        contact_method,
        department_email,
        status || "0",
        target_department || "",
        is_complaint ? 1 : 0,
        appointment_date || null,
        student_name,
        phone_number,
        parent_email,
        campus, // school_code
        created_by || "",
        original_department || "",
      ]
    );

    const ticketId = result.insertId;
    const folioNumber = String(ticketId).padStart(5, "0");
    console.log("[api/tickets][POST] inserted ticketId:", ticketId, "folio:", folioNumber);

    if (
      target_department &&
      (status === "0" || status === 0 || typeof status === "undefined")
    ) {
      await pool.execute(
        `INSERT INTO seguimiento (
          ticket_id,
          fecha,
          parent_name,
          reason,
          resolution,
          campus,
          contact_method,
          department_email,
          status,
          target_department,
          is_complaint,
          appointment_date,
          student_name,
          phone_number,
          parent_email,
          school_code
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          folioNumber,
          parent_name,
          reason,
          resolution,
          campus,
          contact_method,
          department_email,
          status || "0",
          target_department,
          is_complaint ? 1 : 0,
          appointment_date || null,
          student_name,
          phone_number,
          parent_email,
          campus, // school_code
        ]
      );
      console.log("[api/tickets][POST] inserted initial seguimiento for folio:", folioNumber);
    }

    // Mandatory internal notification if canalizado; include supervisor and additional CCs
    if (target_department) {
      const subject = `Canalización de ficha ${folioNumber} — ${target_department}`;
      const html = buildTicketEmailHTML({
        folio: folioNumber,
        campus,
        dept: target_department,
        parentName: parent_name,
        studentName: student_name,
        reason,
        resolution,
        createdBy: created_by || "",
        contactMethod: contact_method || "",
        appointmentDate: appointment_date || null
      });
      const extraCc = Array.isArray(cc_emails) ? cc_emails : [];
      await emailDepartment({ campus, deptName: target_department, subject, html, extraCc }, pool);
    }

    return NextResponse.json({
      success: true,
      ticketId,
      folioNumber,
    });
  } catch (error) {
    console.error("[api/tickets][POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
