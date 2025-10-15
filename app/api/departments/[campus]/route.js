
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getDisplayNames } from "@/lib/googleDirectory";

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

    // Resolve display names for all present emails (service account + cache)
    const emails = [];
    for (const r of list) {
      if (r.email) emails.push(String(r.email).toLowerCase());
      if (r.supervisor_email) emails.push(String(r.supervisor_email).toLowerCase());
    }
    const namesMap = await getDisplayNames(emails);

    // Combine to a user-friendly label "Full Name <email>" when available
    function combinedLabel(email, fallbackName = "") {
      const e = String(email || "").trim();
      const key = e.toLowerCase();
      const name = String(namesMap[key] || fallbackName || "").trim();
      if (e && name) return `${name} <${e}>`;
      return e; // if no name, at least return email
    }

    const enriched = list.map((r) => {
      const email = r.email ? String(r.email).trim() : "";
      const sup = r.supervisor_email ? String(r.supervisor_email).trim() : "";
      const edn = namesMap[email.toLowerCase()] || "";
      const sdn = namesMap[sup.toLowerCase()] || "";
      return {
        ...r,
        email_display_name: edn, // Directory name (if available)
        supervisor_display_name: sdn, // Directory name (if available)
        email_combined_label: combinedLabel(email, edn || r.email_display_name || ""),
        supervisor_combined_label: combinedLabel(sup, sdn || r.supervisor_display_name || ""),
      };
    });

    console.log("[api/departments][GET] rows enriched:", enriched?.length ?? 0);
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
