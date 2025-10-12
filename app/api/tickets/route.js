
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause } from "@/lib/schema";
import { wrapCache, getCache } from "@/lib/cache";

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

    console.log("[api/tickets][GET] query params:", {
      campus, status, schoolYear, month, showAllOpen,
    });

    const key = buildKey({ campus, status, schoolYear, month, showAllOpen });
    const hadCached = Boolean(getCache(key));

    // More generous microcache for openAll to cut DB load drastically
    const ttl = status === "0" && showAllOpen ? 25_000 : 10_000;

    const resultRows = await wrapCache(key, ttl, async () => {
      const pool = await getConnection();

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
          f.contact_method,
          f.phone_number,
          f.parent_email,
          f.target_department,
          f.department_email,
          f.appointment_date
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

      const isOpenAll = showAllOpen && status === "0";

      if (isOpenAll) {
        console.log("[api/tickets][GET] openAll=true => skipping date filter");
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

      const rowLimit = isOpenAll ? 150 : 400;
      query += ` ORDER BY f.fecha DESC LIMIT ${rowLimit}`;

      console.log("[api/tickets][GET] SQL:", query.replace(/\s+/g, " ").trim());
      console.log("[api/tickets][GET] Params:", qParams);

      const [rows] = await pool.execute(query, qParams);
      console.log("[api/tickets][GET] tickets rows:", rows?.length || 0);

      // If no tickets returned, log distinct campus values to help diagnose mismatches
      if (Array.isArray(rows) && rows.length === 0 && campus) {
        try {
          const [distinct] = await pool.execute(
            `SELECT TRIM(UPPER(campus)) AS campus_norm, campus AS raw, COUNT(*) AS cnt
             FROM fichas_atencion
             GROUP BY campus_norm, raw
             ORDER BY cnt DESC
             LIMIT 20`
          );
          console.warn("[api/tickets][GET] No tickets found. Top distinct campus values:", distinct);
        } catch (e) {
          console.warn("[api/tickets][GET] distinct campus probe failed:", e?.message || e);
        }
      }

      // Avoid followups in heavy openAll mode
      if (!isOpenAll && rows.length > 0) {
        const folios = rows.map((t) => t.folio_number || String(t.id).padStart(5, "0"));
        const placeholders = folios.map(() => "?").join(", ");
        const fuSql = `SELECT * FROM seguimiento WHERE ticket_id IN (${placeholders}) ORDER BY fecha ASC`;
        console.log("[api/tickets][GET] Followups SQL:", fuSql, "count folios:", folios.length);
        const [fu] = await pool.execute(fuSql, folios);
        console.log("[api/tickets][GET] followups rows:", fu?.length || 0);

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
      } else if (isOpenAll) {
        console.log("[api/tickets][GET] Skipping followups for openAll view to reduce load.");
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
    });

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
        appointment_date || null,
        target_department,
        department_email,
        created_by,
        original_department,
        status || "0",
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
          appointment_date || null,
          status || "0",
        ]
      );
      console.log("[api/tickets][POST] inserted initial seguimiento for folio:", folioNumber);
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
