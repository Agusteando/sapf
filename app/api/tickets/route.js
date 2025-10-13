
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause } from "@/lib/schema";
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

    const isOpenAll = showAllOpen && status === "0";

    // Server-side throttle per IP+query to prevent spammy calls
    const ip = getClientIp(request);
    const tKey = `${ip}|tickets|campus=${campus || ""}|status=${status || ""}|openAll=${isOpenAll ? "1" : "0"}|sy=${schoolYear || ""}|m=${month || ""}`;
    const last = throttleMap.get(tKey)?.ts || 0;
    const nowTs = Date.now();
    const windowMs = isOpenAll ? 2500 : 900;
    if (nowTs - last < windowMs) {
      const res204 = new NextResponse(null, { status: 204 });
      res204.headers.set("x-throttle", "tickets");
      res204.headers.set("x-throttle-window", String(windowMs));
      res204.headers.set("Cache-Control", "no-store");
      return res204;
    }
    throttleMap.set(tKey, { ts: nowTs });

    console.log("[api/tickets][GET] query params:", {
      campus, status, schoolYear, month, showAllOpen,
    });

    const key = buildKey({ campus, status, schoolYear, month, showAllOpen });
    const hadCached = Boolean(getCache(key));

    // More generous microcache for openAll to cut DB load drastically
    const ttl = status === "0" && showAllOpen ? 60_000 : 10_000;

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
          f.school_code,
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

      const isOpenAllLocal = isOpenAll;

      if (isOpenAllLocal) {
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

      const rowLimit = isOpenAllLocal ? 150 : 400;
      query += ` ORDER BY f.fecha DESC LIMIT ${rowLimit}`;

      console.log("[api/tickets][GET] ParamsLen:", qParams.length, "rowLimit:", rowLimit);

      const [rows] = await pool.execute(query, qParams);
      console.log("[api/tickets][GET] tickets rows:", rows?.length || 0);

      // Avoid followups in heavy openAll mode
      if (!isOpenAllLocal && rows.length > 0) {
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
      } else if (isOpenAllLocal) {
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
        campus, // legacy campus field (may be numeric/text in older rows)
        contact_method,
        department_email,
        status || "0",
        target_department || "",
        is_complaint ? 1 : 0,
        appointment_date || null,
        student_name,
        phone_number,
        parent_email,
        campus, // school_code: use selected campus code (e.g., PT, ST, etc.)
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
