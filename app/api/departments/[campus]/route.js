
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    console.log("[api/departments][GET] campus:", campus);
    const connection = await getConnection();
    const [rows] = await connection.execute(
      "SELECT * FROM deptos_map WHERE campus = ?",
      [campus]
    );
    console.log("[api/departments][GET] rows:", rows?.length ?? 0);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[api/departments][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    const { email, department_name, supervisor_email } = await request.json();
    console.log("[api/departments][PUT] campus:", campus, {
      email,
      department_name,
      supervisor_email,
    });
    const connection = await getConnection();
    await connection.execute(
      "UPDATE deptos_map SET department_name = ?, supervisor_email = ? WHERE email = ? AND campus = ?",
      [department_name, supervisor_email, email, campus]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/departments][PUT] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
