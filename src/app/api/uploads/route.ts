import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { logger } from "@/lib/logger";
import { clientIp } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { sanitizeFilename } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number): Response => Response.json(body, { status });

/** One file per request, streamed raw to data/tmp (Cloudflare caps a request body at 100 MB). */
export async function PUT(req: Request): Promise<Response> {
  const rt = getRuntime();
  if (!rt.uploadLimiter.allow(clientIp(req.headers))) return json({ error: "rate_limited" }, 429);
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/\.(stl|obj|ply)$/i.test(name)) return json({ error: "bad_type" }, 400);
  const max = rt.config.maxUploadMb * 1_048_576;
  if (Number(req.headers.get("content-length") ?? 0) > max)
    return json({ error: "too_large" }, 413);
  if (!req.body) return json({ error: "empty" }, 400);
  try {
    const saved = await rt.tmp.save(Readable.fromWeb(req.body as unknown as NodeWebStream), max);
    if (saved.size === 0) {
      await rt.tmp.remove(saved.token);
      return json({ error: "empty" }, 400);
    }
    return json({ token: saved.token, name: sanitizeFilename(name), size: saved.size }, 201);
  } catch (error) {
    if (String(error).includes("too large")) return json({ error: "too_large" }, 413);
    logger.error("upload failed", { error: String(error) });
    return json({ error: "upload_failed" }, 500);
  }
}
