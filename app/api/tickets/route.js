
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildCampusClause } from "@/lib/schema";
import { wrapCache } from "@/lib/cache";

export const runtime = "nodejs";

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

function buildKey({ campus, status, schoolYear, month, showAllOpen }) {
  return `tickets:${campus || "all"}:${status ?? "all"}:${schoolYear || ""}:${month || ""}:${showAllOpen ? "openAll" : "filtered"}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get("campus");
    const status = searchParams.get("status");
    const schoolYear = searchParams.get("schoolYear");
    const month = searchParams.get("month");
    const showAllOpen = searchParams.get("showAllOpen") === "true";

    const key = buildKey({ campus, status, schoolYear, month, showAllOpen });

    const tickets = await wrapCache(key, status === "0" ? 3000 : 10000, async () => {
      const pool = await getConnection();

      let query = `
        SELECT 
          f.*,
          LPAD(f.id, 5, "0") as folio_number,
          DATE_FORMAT(f.fecha, "%Y-%m-%d %H:%i:%s") as fecha
        FROM fichas_atencion f
        WHERE 1=1
      `;
      const qParams = [];

      if (campus) {
        const campusClause = await buildCampusClause(pool, "f", campus);
        query += ` AND ${campusClause.clause}`;
        qParams.push(...campusClause.params);
      }

      if (status !== null && status !== undefined && status !== "") {
        query += " AND f.status = ?";
        qParams.push(status);
      }

      if (showAllOpen && status === "0") {
        // no date filter
      } else if (month) {
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

      query += " ORDER BY f.fecha DESC LIMIT 500";

      const [rows] = await pool.execute(query, qParams);

      if (rows.length > 0) {
        const folios = rows.map((t) => t.folio_number || String(t.id).padStart(5, "0"));
        const placeholders = folios.map(() => "?").join(", ");
        const [fu] = await pool.execute(
          `SELECT * FROM seguimiento WHERE ticket_id IN (${placeholders}) ORDER BY fecha ASC`,
          folios
        );
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

    return NextResponse.json(tickets);
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
    } = await request.json();

    const pool = await getConnection();

    const [result] = await pool.execute(
      `INSERT INTO fichas_atencion (
        campus, contact_method, is_complaint, parent_name, student_name,
        phone_number, parent_email, reason, resolution, initial_action,
        appointment_date, target_department, department_email, created_by,
        original_department, status, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        campus,
        contact_method,
        is_complaint,
        parent_name,
        student_name,
        phone_number,
        parent_email,
        reason,
        resolution,
        resolution,
        appointment_date,
        target_department,
        department_email,
        created_by,
        original_department,
        status || "0",
      ]
    );

    const ticketId = result.insertId;
    const folioNumber = String(ticketId).padStart(5, "0");

    if (
      target_department &&
      (status === "0" || status === 0 || typeof status === "undefined")
    ) {
      await pool.execute(
        `INSERT INTO seguimiento (
          ticket_id, campus, contact_method, parent_name, student_name,
          phone_number, parent_email, reason, resolution, target_department,
          department_email, appointment_date, status, fecha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          folioNumber,
          campus,
          contact_method,
          parent_name,
          student_name,
          phone_number,
          parent_email,
          reason,
          resolution,
          target_department,
          department_email,
          appointment_date,
          status || "0",
        ]
      );
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
