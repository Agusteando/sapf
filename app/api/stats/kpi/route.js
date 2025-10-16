
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause, originIsParentConditionExpr } from "@/lib/schema";
import { getCache, setCache } from "@/lib/cache";
import { computeWeakETagFromString } from "@/lib/etag";

export const runtime = "nodejs";

// Lightweight server-side throttle to suppress accidental rapid repeats per client+query
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
    const ifNoneMatch = request.headers.get("if-none-match") || "";

    // Server-side throttle
    const ip = getClientIp(request);
    const tKey = `${ip}|kpi|campus=${campus || ""}|sy=${schoolYear || ""}|m=${month || ""}`;
    const last = throttleMap.get(tKey)?.ts || 0;
    const nowTs = Date.now();
    const throttleWindowMs = 700;
    if (nowTs - last < throttleWindowMs) {
      const res204 = new NextResponse(null, { status: 204 });
      res204.headers.set("x-throttle", "kpi");
      return res204;
    }
    throttleMap.set(tKey, { ts: nowTs });

    const cacheKey = key(campus, schoolYear, month);
    const cached = getCache(cacheKey);
    if (cached) {
      const jsonStr = JSON.stringify(cached);
      const etag = computeWeakETagFromString(jsonStr);
      if (ifNoneMatch && ifNoneMatch === etag) {
        const res304 = new NextResponse(null, { status: 304 });
        res304.headers.set("ETag", etag);
        res304.headers.set("x-cache", "HIT");
        res304.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
        return res304;
      }
      const res = new NextResponse(jsonStr, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "ETag": etag,
          "x-cache": "HIT",
          "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
        },
      });
      return res;
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
    const parentCond = await originIsParentConditionExpr(pool, "");

    const [rows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END) AS abiertos,
        SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) AS cerrados,
        SUM(CASE WHEN is_complaint = 1 THEN 1 ELSE 0 END) AS quejas,
        SUM(CASE WHEN ${parentCond} THEN 1 ELSE 0 END) AS padres,
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
      padres: 0,
      avg_resolucion_horas: null,
    };

    // Increase TTL to further dampen pressure on DB (and logs)
    setCache(cacheKey, result, 30 * 1000);

    const jsonStr = JSON.stringify(result);
    const etag = computeWeakETagFromString(jsonStr);

    if (ifNoneMatch && ifNoneMatch === etag) {
      const res304 = new NextResponse(null, { status: 304 });
      res304.headers.set("ETag", etag);
      res304.headers.set("x-cache", "MISS-304");
      res304.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
      return res304;
    }

    const res = new NextResponse(jsonStr, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "ETag": etag,
        "x-cache": "MISS",
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
    return res;
  } catch (error) {
    console.error("[api/stats/kpi][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
