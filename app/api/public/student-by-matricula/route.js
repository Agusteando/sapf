
import { NextResponse } from "next/server";
import { getStudentsForCampus } from "@/lib/students";

export const runtime = "nodejs";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function normalizeMatricula(m) {
  return String(m || "").trim().toUpperCase();
}

function campusCandidatesFromMatricula(matricula) {
  const m = normalizeMatricula(matricula);
  const prefix = m.slice(0, 2);
  switch (prefix) {
    case "PM": return ["PMA", "PMB"];
    case "PT": return ["PT"];
    case "SM": return ["SM"];
    case "ST": return ["ST"];
    case "CM": return ["CM"];
    case "CT": return ["CT"];
    case "DM": return ["DM"];
    default: return [];
  }
}

export async function OPTIONS(request, context = { params: {} }) {
  const params = await context.params;
  const origin = request.headers.get("origin") || "*";
  const res = new NextResponse(null, { status: 204 });
  const h = corsHeaders(origin);
  Object.entries(h).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  const origin = request.headers.get("origin") || "*";
  try {
    const { searchParams } = new URL(request.url);
    const matricula = normalizeMatricula(searchParams.get("matricula"));
    if (!matricula) {
      const bad = NextResponse.json({ error: "Parámetro matricula requerido" }, { status: 400 });
      const h = corsHeaders(origin);
      Object.entries(h).forEach(([k, v]) => bad.headers.set(k, v));
      return bad;
    }

    const candidates = campusCandidatesFromMatricula(matricula);
    console.log("[api/public/student-by-matricula] matricula:", matricula, "candidates:", candidates);

    let found = null;
    let campusUsed = "";

    for (const c of candidates) {
      try {
        const students = await getStudentsForCampus(c);
        const match = (students || []).find((s) => {
          const idVal = String(s?.matricula?.id || s?.matricula || "").trim().toUpperCase();
          return idVal === matricula;
        });
        if (match) {
          found = match;
          campusUsed = c;
          break;
        }
      } catch (e) {
        console.warn("[api/public/student-by-matricula] fetch campus failed", c, e?.message || e);
      }
    }

    if (!found) {
      const notFound = NextResponse.json({ ok: false, campusTried: candidates, student: null }, { status: 404 });
      const h = corsHeaders(origin);
      Object.entries(h).forEach(([k, v]) => notFound.headers.set(k, v));
      return notFound;
    }

    const fullName = `${found.nombres ?? ""} ${found.apellido_paterno ?? ""} ${found.apellido_materno ?? ""}`.trim();
    const padre = `${found.nombre_padre ?? ""} ${found.apellido_paterno_padre ?? ""}`.trim();
    const madre = `${found.nombre_madre ?? ""} ${found.apellido_paterno_madre ?? ""}`.trim();
    const emailPadre = found.email_padre || "";
    const emailMadre = found.email_madre || "";
    const telefono = found.telefono_padre || found.telefono_madre || "";

    const payload = {
      ok: true,
      campus: campusUsed,
      matricula,
      student: {
        fullName,
        nombres: found.nombres || "",
        apellido_paterno: found.apellido_paterno || "",
        apellido_materno: found.apellido_materno || "",
        grado: found.grado || "",
        grupo: found.grupo || "",
        photo: found?.matricula?.foto || ""
      },
      family: {
        padre,
        madre,
        email_sugerido: emailPadre || emailMadre || "",
        telefono: telefono || ""
      }
    };

    const res = NextResponse.json(payload);
    const h = corsHeaders(origin);
    Object.entries(h).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error) {
    console.error("[api/public/student-by-matricula][GET] error:", error);
    const err = NextResponse.json({ error: "Error buscando la matrícula." }, { status: 500 });
    const h = corsHeaders(origin);
    Object.entries(h).forEach(([k, v]) => err.headers.set(k, v));
    return err;
  }
}
