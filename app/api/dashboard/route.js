
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause } from "@/lib/schema";
import { wrapCache, getCache } from "@/lib/cache";
import { computeWeakETagFromString } from "@/lib/etag";

export const runtime = "nodejs";

// Simple in-memory throttle map to short-circuit identical, rapid repeat requests per client+query.
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

function schoolYearRange(schoolYear) {
  if (!schoolYear) return null;
  const [startYear, endYear] = schoolYear.split("-").map(Number);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return null;
  return {
    start: `${startYear}-08-01 00:00:00`,
    endExclusive: `${endYear}-08-01 00:00:00`,
  };
}

function cacheKey({ campus, status, schoolYear, month, showAllOpen }) {
  return `dashboard:${campus || "all"}:${status ?? "all"}:${schoolYear || ""}:${month || ""}:${showAllOpen ? "openAll" : "filtered"}`;
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
    const includeFollowups = searchParams.get("includeFollowups") === "true";
    const ifNoneMatch = request.headers.get("if-none-match") || "";

    console.log("[api/dashboard][GET] params:", {
      campus, status, schoolYear, month, showAllOpen, includeFollowups
    });

    // Server-side throttle: if identical query from same client repeats within the below window, short-circuit.
    const ip = getClientIp(request);
    const throttleKey = `${ip}|campus=${campus || ""}|status=${status || ""}|sy=${schoolYear || ""}|m=${month || ""}|open=${showAllOpen ? "1" : "0"}|fu=${includeFollowups ? "1" : "0"}`;
    const last = throttleMap.get(throttleKey)?.ts || 0;
    const nowTs = Date.now();
    const isOpenAll = showAllOpen && status === "0";
    const throttleWindowMs = isOpenAll ? 1500 : 700; // conservative; complements server microcache
    if (nowTs - last < throttleWindowMs) {
      // Minimal log to confirm throttle effectiveness
      console.warn("[api/dashboard] throttled repeat request:", throttleKey);
      const res204 = new NextResponse(null, { status: 204 });
      res204.headers.set("x-throttle", "dashboard");
      return res204;
    }
    throttleMap.set(throttleKey, { ts: nowTs });

    const key = cacheKey({ campus, status, schoolYear, month, showAllOpen });
    const hadCached = Boolean(getCache(key));

    // Tuned TTLs; openAll view is most spammy => longer TTL.
    const ttlMs = isOpenAll ? 30_000 : 8_000;

    const result = await wrapCache(key, ttlMs, async () => {
      const pool = await getConnection();

      // Build WHERE parts: use normalized school_code/campus matching to tolerate label/code/case/space differences
      const campusClause = campus
        ? await buildNormalizedCampusClause(pool, "f", campus)
        : { clause: "1=1", params: [] };

      let dateClause = "1=1";
      const dateParams = [];
      if (isOpenAll) {
        // explicitly skip date filter for open-all to let operators scan all open tickets
        console.log("[api/dashboard] openAll => skipping dateClause");
      } else if (month) {
        const r = monthRange(month);
        if (r) {
          dateClause = "f.fecha >= ? AND f.fecha < ?";
          dateParams.push(r.start, r.endExclusive);
        }
      } else if (schoolYear) {
        const r = schoolYearRange(schoolYear);
        if (r) {
          dateClause = "f.fecha >= ? AND f.fecha < ?";
          dateParams.push(r.start, r.endExclusive);
        }
      } else {
        dateClause = "MONTH(f.fecha) = MONTH(NOW()) AND YEAR(f.fecha) = YEAR(NOW())";
      }

      let statusClause = "1=1";
      const statusParams = [];
      if (status !== null && status !== undefined && status !== "") {
        statusClause = "f.status = ?";
        statusParams.push(status);
      }

      // Dynamically limit rows and optionally skip followups to avoid hammering DB.
      const rowLimit = isOpenAll ? 150 : 400;
      const shouldFetchFollowups = includeFollowups ? true : !isOpenAll; // explicit override if requested

      const ticketsSql = `
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
        WHERE ${campusClause.clause} AND ${dateClause} AND ${statusClause}
        ORDER BY f.fecha DESC
        LIMIT ${rowLimit}
      `;
      const tParams = [...campusClause.params, ...dateParams, ...statusParams];

      const kpiSql = `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN f.status = '0' THEN 1 ELSE 0 END) AS abiertos,
          SUM(CASE WHEN f.status = '1' THEN 1 ELSE 0 END) AS cerrados,
          SUM(CASE WHEN f.is_complaint = 1 THEN 1 ELSE 0 END) AS quejas,
          AVG(CASE WHEN f.status = '1' THEN TIMESTAMPDIFF(HOUR, f.fecha, COALESCE(f.updated_at, NOW())) END) AS avg_resolucion_horas
        FROM fichas_atencion f
        WHERE ${campusClause.clause} AND ${dateClause}
      `;
      const kParams = [...campusClause.params, ...dateParams];

      console.log("[api/dashboard] tickets SQL:", ticketsSql.replace(/\s+/g, " ").trim());
      console.log("[api/dashboard] tickets params:", tParams);
      console.log("[api/dashboard] kpi SQL:", kpiSql.replace(/\s+/g, " ").trim());
      console.log("[api/dashboard] kpi params:", kParams);
      console.log("[api/dashboard] shouldFetchFollowups:", shouldFetchFollowups, "rowLimit:", rowLimit);

      const [[tickets], [kpi]] = await Promise.all([
        pool.execute(ticketsSql, tParams),
        pool.execute(kpiSql, kParams),
      ]);

      console.log("[api/dashboard] tickets count:", tickets?.length || 0);

      // If no tickets returned, log distinct campus labels (prefer school_code) to help diagnose mismatches
      if (Array.isArray(tickets) && tickets.length === 0 && campus) {
        try {
          const [distinct] = await pool.execute(
            `SELECT 
               TRIM(UPPER(COALESCE(school_code, campus))) AS campus_norm, 
               school_code AS school_code_raw,
               campus AS campus_raw,
               COUNT(*) AS cnt
             FROM fichas_atencion
             GROUP BY campus_norm, school_code_raw, campus_raw
             ORDER BY cnt DESC
             LIMIT 20`
          );
          console.warn("[api/dashboard] No tickets found. Top distinct campus values (school_code first):", distinct);
        } catch (e) {
          console.warn("[api/dashboard] distinct campus probe failed:", e?.message || e);
        }
      }

      // Batch followups only when explicitly allowed
      let followupsCount = 0;
      if (shouldFetchFollowups && tickets.length > 0) {
        const folios = tickets.map((t) => t.folio_number || String(t.id).padStart(5, "0"));
        const placeholders = folios.map(() => "?").join(", ");
        const fuSql = `SELECT * FROM seguimiento WHERE ticket_id IN (${placeholders}) ORDER BY fecha ASC`;
        console.log("[api/dashboard] followups SQL:", fuSql, "folios:", folios.length);
        const [rows] = await pool.execute(fuSql, folios);
        followupsCount = rows?.length || 0;
        const byTicket = new Map();
        for (const row of rows) {
          const list = byTicket.get(row.ticket_id) || [];
          list.push(row);
          byTicket.set(row.ticket_id, list);
        }
        for (const t of tickets) {
          const folio = t.folio_number || String(t.id).padStart(5, "0");
          t.followups = byTicket.get(folio) || [];
        }
      } else if (!shouldFetchFollowups) {
        console.log("[api/dashboard] followups skipped.");
      }

      const k = kpi?.[0] || {
        total: 0,
        abiertos: 0,
        cerrados: 0,
        quejas: 0,
        avg_resolucion_horas: null,
      };

      console.log("[api/dashboard] KPI:", k, "followupsCount:", followupsCount);

      return { tickets, kpi: k, _debug: { followupsCount } };
    });

    const jsonStr = JSON.stringify(result);
    const etag = computeWeakETagFromString(jsonStr);

    // If client already has same payload, short-circuit to 304.
    if (ifNoneMatch && ifNoneMatch === etag) {
      const res304 = new NextResponse(null, { status: 304 });
      res304.headers.set("ETag", etag);
      res304.headers.set("x-cache", "dashboard-304");
      res304.headers.set("x-microcache", hadCached ? "HIT" : "MISS");
      res304.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
      return res304;
    }

    const res = new NextResponse(jsonStr, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "ETag": etag,
        "x-cache": "dashboard",
        "x-microcache": hadCached ? "HIT" : "MISS",
        "x-followups-count": String(result?._debug?.followupsCount ?? 0),
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
    return res;
  } catch (error) {
    console.error("[api/dashboard][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
