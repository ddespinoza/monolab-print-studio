import { bearerMatches } from "@/lib/bearer";
import { logger } from "@/lib/logger";
import { manualSend } from "@/lib/manual-send";
import { getRuntime } from "@/lib/runtime";
import { runTick } from "@/lib/status-notifier";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Deletes files past the retention period. Never fails the tick: a problem here is logged and retried next time. */
async function expireFiles(rt: ReturnType<typeof getRuntime>): Promise<number> {
  try {
    const { results } = await manualSend(rt.sendDeps(), { action: "expire" });
    return results.filter((r) => r.status === "purged").length;
  } catch (error) {
    logger.error("retention run failed", { error: String(error) });
    return 0;
  }
}

export async function GET(req: Request): Promise<Response> {
  const rt = getRuntime();
  if (!bearerMatches(req, rt.config.cronSecret))
    return new Response("Unauthorized", { status: 401, headers: noStore });
  try {
    const tick = await runTick(rt.tickDeps());
    return Response.json({ ...tick, purged: await expireFiles(rt) }, { headers: noStore });
  } catch (error) {
    logger.error("tick failed", { error: String(error) });
    const busy = String(error).includes("already running");
    return Response.json(
      { error: busy ? "busy" : "failed" },
      { status: busy ? 409 : 500, headers: noStore },
    );
  }
}
