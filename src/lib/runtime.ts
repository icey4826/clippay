// Where we're running. Local dev and scripts run on Node (JSON file, sharp); the deployed app runs on
// Cloudflare Workers (D1, Images binding). Only the minimal binding shapes we use are typed here.

export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): ImageTransformer;
}
interface ImageTransformer {
  transform(options: { width?: number; height?: number; fit?: "scale-down" | "squeeze" | "contain" }): ImageTransformer;
  output(options: { format: "image/jpeg" | "image/png"; quality?: number }): Promise<{ response(): Response }>;
}

export interface CloudflareEnv {
  DB: D1Database;
  IMAGES: ImagesBinding;
}

/** Bindings for the current request. Only valid on Workers. */
export async function cfEnv(): Promise<CloudflareEnv> {
  // Imported lazily so Node scripts never load the adapter.
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv;
}
