
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getCache, setCache } from "@/lib/cache";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const cacheKey = "stats:usage:current-month";
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-cache": "HIT" } });
    }

    const connection = await getConnection();

    const [stats] = await connection.execute(`
      SELECT 
        campus as label,
        COUNT(*) as conteo
      FROM fichas_atencion
      WHERE MONTH(fecha) = MONTH(NOW())
        AND YEAR(fecha) = YEAR(NOW())
      GROUP BY campus
      ORDER BY conteo DESC
    `);

    setCache(cacheKey, stats, 60 * 1000);
    const res = NextResponse.json(stats);
    res.headers.set("x-cache", "MISS");
    return res;
  } catch (error) {
    console.error("[api/stats/usage][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
