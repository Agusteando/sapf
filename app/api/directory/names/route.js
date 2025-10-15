
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { wrapCache } from "@/lib/cache";
import { getDisplayNames } from "@/lib/googleDirectory";

export const runtime = "nodejs";

function splitDomains(envVal) {
  return String(envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isInstitutional(email, allowedDomains) {
  const m = String(email || "").toLowerCase().match(/^[^@]+@([^@]+)$/);
  const d = m ? m[1] : "";
  if (!d) return false;
  if (allowedDomains.length === 0) return true; // if not specified, consider all as institutional
  return allowedDomains.includes(d);
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const connection = await getConnection();

    const [rows] = await connection.execute(
      `
      SELECT DISTINCT LOWER(TRIM(email)) AS email FROM deptos_map WHERE email IS NOT NULL AND email <> ''
      UNION
      SELECT DISTINCT LOWER(TRIM(supervisor_email)) AS email FROM deptos_map WHERE supervisor_email IS NOT NULL AND supervisor_email <> ''
      `
    );

    const rawEmails = Array.isArray(rows) ? rows.map((r) => String(r.email || "").toLowerCase()) : [];
    const unique = Array.from(new Set(rawEmails)).filter(Boolean);

    const allowedDomains = splitDomains(process.env.INTERNAL_EMAIL_DOMAINS || process.env.AUTH_ALLOWED_DOMAINS || "");

    const institutional = unique.filter((e) => isInstitutional(e, allowedDomains));

    const key = "gdir:pre:names";
    const ttl = 6 * 60 * 60 * 1000; // 6 hours

    const names = await wrapCache(key, ttl, async () => {
      console.log("[api/directory/names] resolving display names for", institutional.length, "emails");
      const map = await getDisplayNames(institutional);
      return map;
    });

    const res = NextResponse.json({
      ok: true,
      count: Object.keys(names || {}).length,
      domainsUsed: allowedDomains,
      generatedAt: new Date().toISOString(),
      names: names || {},
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[api/directory/names][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
