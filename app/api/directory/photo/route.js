
import { NextResponse } from "next/server";
import { getUserPhoto } from "@/lib/googleDirectory";
import { wrapCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache key builder
function photoCacheKey(email) {
  return `gdir:photo:${String(email || "").toLowerCase()}`;
}

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get("email") || "").trim().toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid or missing email" }, { status: 400 });
    }

    const key = photoCacheKey(email);
    const ttlMs = 6 * 60 * 60 * 1000; // 6 hours

    const cached = await wrapCache(key, ttlMs, async () => {
      console.log("[api/directory/photo][CACHE MISS] fetching photo for:", email);
      const photo = await getUserPhoto(email);
      if (!photo) return null;
      // We cannot store Buffers directly in cache layer; encode base64
      return { mimeType: photo.mimeType || "image/jpeg", b64: photo.buffer.toString("base64") };
    });

    if (!cached || !cached.b64) {
      console.warn("[api/directory/photo] no photo available for:", email);
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const buffer = Buffer.from(cached.b64, "base64");
    const res = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": cached.mimeType || "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=600",
        "x-photo-proxy": "google-directory",
      },
    });
    return res;
  } catch (e) {
    console.error("[api/directory/photo][GET] error:", e?.message || e);
    return NextResponse.json({ error: "Photo proxy error" }, { status: 500 });
  }
}
