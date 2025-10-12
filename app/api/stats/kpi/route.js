
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause } from "@/lib/schema";
import { getCache, setCache } from "@/lib/cache";

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

function key(campus, schoolYear, month) {
  return `stats:kpi:${campus || "all"}:${schoolYear || ""}:${month || ""}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get("campus");
    const schoolYear = searchParams.get("schoolYear");
    const month = searchParams.get("month");

    const cacheKey = key(campus, schoolYear, month);
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-cache": "HIT" } });
    }

    const pool = await getConnection();

    const campusClause = campus
      ? await buildNormalizedCampusClause(pool, "", campus)
      : { clause: "1=1", params: [] };

    let dateClause = "1=1";
    const dateParams = [];
    if (month) {
      const r = monthRange(month);
      if (r) {
        dateClause = "fecha >= ? AND fecha < ?";
        dateParams.push(r.start, r.endExclusive);
      }
    } else if (schoolYear) {
      const r = schoolYearRange(schoolYear);
      if (r) {
        dateClause = "fecha >= ? AND fecha < ?";
        dateParams.push(r.start, r.endExclusive);
      }
    } else {
      dateClause = "MONTH(fecha) = MONTH(NOW()) AND YEAR(fecha) = YEAR(NOW())";
    }

    const where = [campusClause.clause, dateClause].join(" AND ");

    const [rows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END) AS abiertos,
        SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) AS cerrados,
        SUM(CASE WHEN is_complaint = 1 THEN 1 ELSE 0 END) AS quejas,
        AVG(CASE WHEN status = '1' THEN TIMESTAMPDIFF(HOUR, fecha, COALESCE(updated_at, NOW())) END) AS avg_resolucion_horas
      FROM fichas_atencion
      WHERE ${where}
    `,
      [...campusClause.params, ...dateParams]
    );

    const result = rows?.[0] || {
      total: 0,
      abiertos: 0,
      cerrados: 0,
      quejas: 0,
      avg_resolucion_horas: null,
    };

    setCache(cacheKey, result, 10 * 1000);
    const res = NextResponse.json(result);
    res.headers.set("x-cache", "MISS");
    return res;
  } catch (error) {
    console.error("[api/stats/kpi][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
