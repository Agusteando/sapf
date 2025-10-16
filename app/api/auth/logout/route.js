
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", clearSessionCookie());
    res.headers.set("x-auth-logout", "true");
    return res;
  } catch (error) {
    console.error("[api/auth/logout][POST] error:", error);
    return NextResponse.json({ error: "Error al cerrar sesión." }, { status: 500 });
  }
}
