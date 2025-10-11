
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getCache, setCache } from "@/lib/cache";

export const runtime = "nodejs";

function currentSchoolYearLabel(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const cacheKey = "stats:school-years";
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-cache": "HIT" } });
    }

    const pool = await getConnection();

    const [[minRow]] = await pool.execute("SELECT MIN(fecha) as minFecha FROM fichas_atencion");
    const [[maxRow]] = await pool.execute("SELECT MAX(fecha) as maxFecha FROM fichas_atencion");

    const min = minRow?.minFecha ? new Date(minRow.minFecha) : null;
    const max = maxRow?.maxFecha ? new Date(maxRow.maxFecha) : null;

    const items = [];
    if (min && max) {
      // generate from Aug(minYear-1) to Aug(maxYear) school years
      const minYear = min.getUTCFullYear();
      const maxYear = max.getUTCFullYear();
      const startYear = min.getUTCMonth() >= 7 ? minYear : minYear - 1; // includes year starting before min if started earlier in Aug
      const endYear = max.getUTCMonth() >= 7 ? maxYear : maxYear - 1;

      for (let y = endYear; y >= startYear; y--) {
        items.push(`${y}-${y + 1}`);
      }
    } else {
      items.push(currentSchoolYearLabel());
    }

    const payload = { items, default: currentSchoolYearLabel() };
    setCache(cacheKey, payload, 60 * 60 * 1000);

    const res = NextResponse.json(payload);
    res.headers.set("x-cache", "MISS");
    return res;
  } catch (error) {
    console.error("[api/stats/school-years][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
