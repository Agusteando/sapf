
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

    const key = cacheKey({ campus, status, schoolYear, month, showAllOpen });

    const result = await wrapCache(key, 5000, async () => {
      const pool = await getConnection();

      // Build WHERE parts
      const campusClause = campus
        ? await buildCampusClause(pool, "f", campus)
        : { clause: "1=1", params: [] };

      let dateClause = "1=1";
      const dateParams = [];
      if (showAllOpen && status === "0") {
        // no date filter for open-all
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

      // Tickets query
      const ticketsSql = `
        SELECT 
          f.*,
          LPAD(f.id, 5, "0") as folio_number,
          DATE_FORMAT(f.fecha, "%Y-%m-%d %H:%i:%s") as fecha
        FROM fichas_atencion f
        WHERE ${campusClause.clause} AND ${dateClause} AND ${statusClause}
        ORDER BY f.fecha DESC
        LIMIT 500
      `;
      const tParams = [...campusClause.params, ...dateParams, ...statusParams];

      // KPI query
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

      const [[tickets], [kpi]] = await Promise.all([
        pool.execute(ticketsSql, tParams),
        pool.execute(kpiSql, kParams),
      ]);

      // Batch followups
      if (tickets.length > 0) {
        const folios = tickets.map((t) => t.folio_number || String(t.id).padStart(5, "0"));
        const placeholders = folios.map(() => "?").join(", ");
        const [rows] = await pool.execute(
          `SELECT * FROM seguimiento WHERE ticket_id IN (${placeholders}) ORDER BY fecha ASC`,
          folios
        );
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
      }

      const k = kpi?.[0] || {
        total: 0,
        abiertos: 0,
        cerrados: 0,
        quejas: 0,
        avg_resolucion_horas: null,
      };

      return { tickets, kpi: k };
    });

    return NextResponse.json(result, {
      headers: {
        "x-cache": "dashboard",
      },
    });
  } catch (error) {
    console.error("[api/dashboard][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
