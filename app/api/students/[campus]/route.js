
import { NextResponse } from "next/server";
import { getStudentsForCampus } from "@/lib/students";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const campus = params.campus;
    console.log("[api/students/:campus][GET] campus:", campus);
    const students = await getStudentsForCampus(campus);
    const res = NextResponse.json({ students });
    res.headers.set("x-students-cache", "memory");
    return res;
  } catch (error) {
    console.error("[api/students/:campus][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
