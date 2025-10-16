
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildOriginExpr, buildPriorityExpr } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function followupEmailHTML({ folio, campus, dept, parentName, studentName, resolution, status }) {
  const statusText = status === "1" ? "Cerrado" : "Abierto";
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827;">
      <h2 style="color:#1d4ed8;margin-bottom:8px;">Nuevo seguimiento</h2>
      <p style="margin: 0 0 10px 0;">Folio: <strong>${folio}</strong> — Estatus: <strong>${statusText}</strong></p>
      <p style="margin: 0 0 10px 0;">Plantel: <strong>${campus}</strong></p>
      <p style="margin: 0 0 10px 0;">Departamento: <strong>${dept || "—"}</strong></p>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:12px 0"/>
      <p style="margin: 0 0 6px 0;"><strong>Padre/Madre/Tutor:</strong> ${parentName || "—"}</p>
      <p style="margin: 0 0 6px 0;"><strong>Alumno:</strong> ${studentName || "—"}</p>
      <h3 style="margin:12px 0 6px 0;">Seguimiento</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">${(resolution || "—").replace(/\n/g, "<br/>")}</div>
    </div>
  `;
}

function uniq(a) {
  return Array.from(new Set(a.map((s) => String(s || "").trim().toLowerCase()))).filter(Boolean);
}

async function emailDepartmentInternal(pool, { campus, deptName, subject, html, extraCc = [] }) {
  try {
    const [rows] = await pool.execute(
      "SELECT email, supervisor_email FROM deptos_map WHERE campus = ? AND department_name = ? LIMIT 1",
      [campus, deptName || ""]
    );
    const primary = rows?.[0]?.email || "";
    const sup = rows?.[0]?.supervisor_email || "";
    const recipients = uniq([primary, sup, ...extraCc]);
    if (recipients.length === 0) {
      console.warn("[api/tickets/:id][PUT] No recipients found for dept:", deptName, "campus:", campus);
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
      console.warn("[api/tickets/:id][PUT] department email failed:", res?.status, detail?.slice(0, 200));
    } else {
      console.log("[api/tickets/:id][PUT] department email sent to", recipients.length, "recipient(s).");
    }
  } catch (e) {
    console.warn("[api/tickets/:id][PUT] emailDepartmentInternal error:", e?.message || e);
  }
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const id = params.id;
    console.log("[api/tickets/:id][GET] id:", id);
    const connection = await getConnection();

    const originExpr = await buildOriginExpr(connection, "");
    const priorityExpr = await buildPriorityExpr(connection, "");

    const [tickets] = await connection.execute(
      `SELECT 
         id,
         LPAD(id, 5, "0") as folio_number,
         fecha,
         status,
         created_by,
         original_department,
         parent_name,
         student_name,
         reason,
         resolution,
         is_complaint,
         campus,
         school_code,
         contact_method,
         phone_number,
         parent_email,
         target_department,
         department_email,
         appointment_date,
         ${originExpr} AS origin,
         ${priorityExpr} AS priority_level
       FROM fichas_atencion 
       WHERE id = ?`,
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const folioNumber = tickets[0].folio_number;
    const [followups] = await connection.execute(
      "SELECT * FROM seguimiento WHERE ticket_id = ? ORDER BY fecha ASC",
      [folioNumber]
    );
    console.log("[api/tickets/:id][GET] followups count:", followups?.length || 0);

    tickets[0].followups = followups;

    return NextResponse.json(tickets[0]);
  } catch (error) {
    console.error("[api/tickets/:id][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const id = params.id;
    const { resolution, status, target_department, cc_emails } = await request.json();
    console.log("[api/tickets/:id][PUT] id:", id, { status, target_department, has_resolution: Boolean(resolution), cc_count: Array.isArray(cc_emails) ? cc_emails.length : 0 });

    const connection = await getConnection();

    await connection.execute(
      "UPDATE fichas_atencion SET resolution = ?, status = ?, updated_at = NOW() WHERE id = ?",
      [resolution || "", status, id]
    );

    const [tickets] = await connection.execute(
      "SELECT *, LPAD(id, 5, '0') as folio_number FROM fichas_atencion WHERE id = ?",
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found after update" }, { status: 404 });
    }

    const ticket = tickets[0];
    const folioNumber = ticket.folio_number;

    // Append seguimiento whenever a non-empty resolution is provided
    const shouldAppendFollowup = typeof resolution === "string" && resolution.trim().length > 0;
    if (shouldAppendFollowup) {
      const followupTarget =
        (target_department && String(target_department)) ||
        ticket.target_department ||
        ticket.original_department ||
        "";

      await connection.execute(
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
          ticket.parent_name,
          ticket.reason,
          resolution || "",
          ticket.campus,
          ticket.contact_method,
          ticket.department_email,
          status,
          followupTarget,
          ticket.is_complaint ? 1 : 0,
          ticket.appointment_date || null,
          ticket.student_name,
          ticket.phone_number,
          ticket.parent_email,
          ticket.school_code || ticket.campus || "",
        ]
      );
      console.log("[api/tickets/:id][PUT] appended seguimiento for folio:", folioNumber, "target:", followupTarget);

      // Mandatory internal notification to the department on follow-up
      const subject = `Seguimiento al folio ${folioNumber} — ${followupTarget || "Departamento"}`;
      const html = followupEmailHTML({
        folio: folioNumber,
        campus: ticket.school_code || ticket.campus || "",
        dept: followupTarget || "",
        parentName: ticket.parent_name,
        studentName: ticket.student_name,
        resolution: resolution || "",
        status
      });
      const extraCc = Array.isArray(cc_emails) ? cc_emails : [];
      await emailDepartmentInternal(connection, {
        campus: ticket.school_code || ticket.campus || "",
        deptName: followupTarget || "",
        subject,
        html,
        extraCc
      });
    } else {
      console.log("[api/tickets/:id][PUT] resolution empty => no seguimiento appended");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/tickets/:id][PUT] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
