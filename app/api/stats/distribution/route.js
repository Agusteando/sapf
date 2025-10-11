
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildCampusClause } from "@/lib/schema";
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

function cacheKey(campus, schoolYear, month) {
  return `stats:distribution:${campus || "all"}:${schoolYear || ""}:${month || ""}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get("campus");
    const schoolYear = searchParams.get("schoolYear");
    const month = searchParams.get("month");

    console.log("[api/stats/distribution][GET] params:", {
      campus,
      schoolYear,
      month,
    });

    const key = cacheKey(campus, schoolYear, month);
    const cached = getCache(key);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-cache": "HIT" } });
    }

    const pool = await getConnection();

    const campusClause = campus
      ? await buildCampusClause(pool, "", campus)
      : { clause: "1=1", params: [] };

    let dateClause = "1=1";
    const dateParams = [];
    if (month) {
      const range = monthRange(month);
      if (range) {
        dateClause = "fecha >= ? AND fecha < ?";
        dateParams.push(range.start, range.endExclusive);
      }
    } else if (schoolYear) {
      const range = schoolYearRange(schoolYear);
      if (range) {
        dateClause = "fecha >= ? AND fecha < ?";
        dateParams.push(range.start, range.endExclusive);
      }
    } else {
      dateClause = "MONTH(fecha) = MONTH(NOW()) AND YEAR(fecha) = YEAR(NOW())";
    }

    const whereMain = [campusClause.clause, dateClause].filter(Boolean).join(" AND ");

    const query = `
      SELECT 
        original_department as depto,
        COUNT(*) * 100.0 / NULLIF((
          SELECT COUNT(*)
          FROM fichas_atencion
          WHERE ${whereMain}
        ), 0) as porc
      FROM fichas_atencion
      WHERE ${whereMain}
      GROUP BY original_department
      ORDER BY porc DESC
    `;

    const qParams = [
      ...campusClause.params,
      ...dateParams,
      ...campusClause.params,
      ...dateParams,
    ];

    const [distribution] = await pool.execute(query, qParams);

    setCache(key, distribution, 60 * 1000);

    const res = NextResponse.json(distribution);
    res.headers.set("x-cache", "MISS");
    return res;
  } catch (error) {
    console.error("[api/stats/distribution][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
