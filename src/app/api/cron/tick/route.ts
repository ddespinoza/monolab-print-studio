import { timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import { getRuntime } from "@/lib/runtime";
import { runTick } from "@/lib/status-notifier";

export const dynamic = "force-dynamic";

function authorised(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: Request): Promise<Response> {
  const rt = getRuntime();
  if (!authorised(req, rt.config.cronSecret))
    return new Response("Unauthorized", { status: 401, headers: noStore });
  try {
    return Response.json(await runTick(rt.tickDeps()), { headers: noStore });
  } catch (error) {
    logger.error("tick failed", { error: String(error) });
    const busy = String(error).includes("already running");
    return Response.json(
      { error: busy ? "busy" : "failed" },
      { status: busy ? 409 : 500, headers: noStore },
    );
  }
}
