
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getDisplayProfiles } from "@/lib/googleDirectory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function splitDomains(envVal) {
  return String(envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function domainOf(email) {
  const m = String(email || "").toLowerCase().match(/^[^@]+@([^@]+)$/);
  return m ? m[1] : "";
}

function ensureNombrePrefix(nameLike) {
  const raw = String(nameLike || "").trim();
  if (!raw) return "";
  // Avoid double prefix
  return /^nombre\s*:/i.test(raw) ? raw : `Nombre: ${raw}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    console.log("[api/departments][GET] campus:", campus);
    const connection = await getConnection();
    const [rows] = await connection.execute(
      "SELECT * FROM deptos_map WHERE campus = ? ORDER BY department_name ASC",
      [campus]
    );

    const list = Array.isArray(rows) ? rows : [];

    const exists = list.some(
      (r) => String(r.department_name || "").trim().toLowerCase() === "enfermería"
    );

    if (!exists) {
      list.push({
        campus,
        department_name: "Enfermería",
        email: "",
        supervisor_email: "",
      });
      console.log("[api/departments][GET] injected fallback department 'Enfermería' for campus:", campus);
    }

    // Resolve display names and photos for all present emails
    const emails = [];
    for (const r of list) {
      if (r.email) emails.push(String(r.email).toLowerCase());
      if (r.supervisor_email) emails.push(String(r.supervisor_email).toLowerCase());
    }
    const profiles = await getDisplayProfiles(emails);

    // Load allowed domains to determine "institutional" emails
    const allowedDomains = splitDomains(process.env.INTERNAL_EMAIL_DOMAINS || process.env.AUTH_ALLOWED_DOMAINS || "");
    const isInstitutional = (email) => {
      const d = domainOf(email);
      if (!d) return false;
      // If a list is configured, enforce membership; otherwise, treat as institutional to keep UX consistent.
      return allowedDomains.length === 0 ? true : allowedDomains.includes(d);
    };

    // Build enriched response using Directory user's name.fullName (when available), prefixed with "Nombre: "
    const enriched = list.map((r) => {
      const email = r.email ? String(r.email).trim() : "";
      const sup = r.supervisor_email ? String(r.supervisor_email).trim() : "";
      const emailKey = email.toLowerCase();
      const supKey = sup.toLowerCase();

      // Prefer user.name.fullName if getDisplayProfiles provided it (as fullName), else fallback to name
      const fullNameRaw = profiles[emailKey]?.fullName || profiles[emailKey]?.name || "";
      const supFullNameRaw = profiles[supKey]?.fullName || profiles[supKey]?.name || "";

      const nameDisplay = isInstitutional(email) ? ensureNombrePrefix(fullNameRaw) : (fullNameRaw ? ensureNombrePrefix(fullNameRaw) : "");
      const supNameDisplay = isInstitutional(sup) ? ensureNombrePrefix(supFullNameRaw) : (supFullNameRaw ? ensureNombrePrefix(supFullNameRaw) : "");

      const photo = profiles[emailKey]?.photoUrl || "";
      const supPhoto = profiles[supKey]?.photoUrl || "";

      const emailCombined = nameDisplay && email ? `${nameDisplay} <${email}>` : email || "";
      const supCombined = supNameDisplay && sup ? `${supNameDisplay} <${sup}>` : sup || "";

      return {
        ...r,
        email_display_name: nameDisplay, // always prefixed "Nombre: ..." when available
        supervisor_display_name: supNameDisplay,
        email_photo_url: photo,
        supervisor_photo_url: supPhoto,
        email_combined_label: emailCombined,
        supervisor_combined_label: supCombined,
      };
    });

    console.log("[api/departments][GET] rows enriched:", enriched?.length ?? 0, {
      allowedDomains,
      sample: enriched.slice(0, 2).map((e) => ({
        dep: e.department_name,
        email: e.email,
        email_display_name: e.email_display_name,
        supervisor_email: e.supervisor_email,
        supervisor_display_name: e.supervisor_display_name
      }))
    });
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[api/departments][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    const { email, department_name, department_name: depNameAlias, supervisor_email } = await request.json();
    const department_name_input = department_name || depNameAlias;
    console.log("[api/departments][PUT] campus:", campus, {
      email,
      department_name: department_name_input,
      supervisor_email,
    });

    if (!department_name_input) {
      return NextResponse.json({ error: "department_name es requerido" }, { status: 400 });
    }

    const connection = await getConnection();
    const [result] = await connection.execute(
      "UPDATE deptos_map SET department_name = ?, supervisor_email = ?, email = ? WHERE department_name = ? AND campus = ?",
      [department_name_input, supervisor_email || "", email || "", department_name_input, campus]
    );

    if (result?.affectedRows === 0) {
      await connection.execute(
        "INSERT INTO deptos_map (campus, department_name, email, supervisor_email) VALUES (?, ?, ?, ?)",
        [campus, department_name_input, email || "", supervisor_email || ""]
      );
      console.log("[api/departments][PUT] inserted new record for:", department_name_input, "campus:", campus);
    } else {
      console.log("[api/departments][PUT] updated record for:", department_name_input, "campus:", campus);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/departments][PUT] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    const body = await request.json().catch(() => ({}));
    const department_name = String(body?.department_name || "").trim();

    console.log("[api/departments][DELETE] campus:", campus, "department:", department_name);

    if (!department_name) {
      return NextResponse.json({ error: "department_name es requerido" }, { status: 400 });
    }

    if (department_name.toLowerCase() === "enfermería") {
      return NextResponse.json({ error: "No se puede eliminar el departamento 'Enfermería'." }, { status: 400 });
    }

    const connection = await getConnection();
    const [resDel] = await connection.execute(
      "DELETE FROM deptos_map WHERE campus = ? AND department_name = ?",
      [campus, department_name]
    );

    const affected = Number(resDel?.affectedRows || 0);
    console.log("[api/departments][DELETE] affectedRows:", affected);

    if (affected === 0) {
      return NextResponse.json({ error: "Departamento no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, removed: { campus, department_name } });
  } catch (error) {
    console.error("[api/departments][DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
