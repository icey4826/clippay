import { loadPhoto } from "@/lib/photos";
import { read } from "@/lib/store";

export const runtime = "nodejs";

// Serves a claim photo to the merchant. Keys come from the store, never from the URL.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const photo = await read((db) => db.claims[id]?.photos[Number(n) - 1]);
  const bytes = photo ? await loadPhoto(photo.path) : null;
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes as BodyInit, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
