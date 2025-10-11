
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const parent_name = searchParams.get("parent_name");
    console.log("[api/search-duplicate][GET] parent_name:", parent_name);

    const connection = await getConnection();

    const [results] = await connection.execute(
      `SELECT COUNT(*) as dup, id 
       FROM fichas_atencion 
       WHERE parent_name = ? AND status = "0"
       GROUP BY id
       LIMIT 1`,
      [parent_name]
    );

    if (results.length > 0) {
      return NextResponse.json([{ dup: 1, id: results[0].id }]);
    } else {
      return NextResponse.json([{ dup: 0, id: null }]);
    }
  } catch (error) {
    console.error("[api/search-duplicate][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
