import { confirmOrder } from "@/lib/confirmation";
import { logger } from "@/lib/logger";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/** The confirm page posts here; GET links are never state-changing because mail scanners prefetch them. */
export async function POST(req: Request): Promise<Response> {
  const token = String((await req.formData().catch(() => new FormData())).get("token") ?? "");
  try {
    await confirmOrder(token, getRuntime().confirmDeps());
  } catch (error) {
    logger.error("confirmation failed", { error: String(error) });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/confirmar/${encodeURIComponent(token)}` },
  });
}
