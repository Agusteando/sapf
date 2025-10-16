
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionValue } from "@/lib/auth";
import { getConnection } from "@/lib/db";
import { CAMPUS_MAP } from "@/lib/campus";

const PREF_COOKIE = "sapf_pref";

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function readPrefCookie(header) {
  try {
    const cookies = parseCookie(header || "");
    const raw = cookies[PREF_COOKIE];
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const campus = typeof parsed.campus === "string" ? parsed.campus : "";
    const department_name = typeof parsed.department_name === "string" ? parsed.department_name : "";
    return { campus, department_name };
  } catch {
    return null;
  }
}

function prefCookieValue(pref) {
  const json = JSON.stringify({
    campus: String(pref?.campus || ""),
    department_name: String(pref?.department_name || "")
  });
  return `${PREF_COOKIE}=${encodeURIComponent(json)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${60 * 60 * 24 * 365}; ${process.env.NODE_ENV === "production" ? "Secure" : ""}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = parseCookie(cookieHeader);
    const sessionRaw = cookies[SESSION_COOKIE_NAME];
    const session = verifySessionValue(sessionRaw);
    if (!session?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const user = {
      email: session.email,
      name: session.name || "",
      picture: session.picture || ""
    };

    const pool = await getConnection();
    // Detect from deptos_map by matching email in email or supervisor_email
    const [rows] = await pool.execute(
      `SELECT campus, department_name FROM deptos_map 
       WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(supervisor_email)) = LOWER(TRIM(?))
       LIMIT 1`,
      [user.email, user.email]
    );

    const detected = rows?.[0]
      ? { campus: rows[0].campus || "", department_name: rows[0].department_name || "" }
      : { campus: "", department_name: "" };

    const pref = readPrefCookie(cookieHeader);

    const campusOptions = Object.entries(CAMPUS_MAP).map(([value, label]) => ({ value, label }));

    let departmentsForPref = [];
    if (pref?.campus) {
      const [deps] = await pool.execute(
        "SELECT DISTINCT department_name FROM deptos_map WHERE campus = ? ORDER BY department_name ASC",
        [pref.campus]
      );
      departmentsForPref = (deps || []).map((d) => d.department_name);
    }

    return NextResponse.json({
      ok: true,
      user,
      detected,
      preference: pref || null,
      campusOptions,
      departmentsForPref
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/profile][GET] error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Profile error" }, { status: 500 });
  }
}

export async function PUT(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const campus = String(body?.campus || "").trim();
    const department_name = String(body?.department_name || "").trim();

    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = parseCookie(cookieHeader);
    const sessionRaw = cookies[SESSION_COOKIE_NAME];
    const session = verifySessionValue(sessionRaw);

    if (!session?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!campus || !(campus in CAMPUS_MAP)) {
      return NextResponse.json({ ok: false, error: "Campus inválido" }, { status: 400 });
    }
    if (!department_name) {
      return NextResponse.json({ ok: false, error: "department_name requerido" }, { status: 400 });
    }

    const pool = await getConnection();
    // Validate that department exists for campus
    const [check] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM deptos_map WHERE campus = ? AND department_name = ?",
      [campus, department_name]
    );
    const exists = Number(check?.[0]?.cnt || 0) > 0;
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Departamento no existe para el plantel seleccionado" }, { status: 400 });
    }

    const res = NextResponse.json({
      ok: true,
      saved: { campus, department_name }
    });
    res.headers.append("Set-Cookie", prefCookieValue({ campus, department_name }));
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[api/profile][PUT] error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Profile save error" }, { status: 500 });
  }
}
