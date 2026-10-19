import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, read } from "@/lib/store";

export const runtime = "nodejs";

// Serves a claim photo to the merchant. Paths come from the store, never from the URL.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const photo = await read((db) => db.claims[id]?.photos[Number(n) - 1]);
  if (!photo) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(join(DATA_DIR, photo.path));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
