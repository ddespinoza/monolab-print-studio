import { z } from "zod";
import { bearerMatches } from "@/lib/bearer";
import { logger } from "@/lib/logger";
import { manualSend } from "@/lib/manual-send";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const orderId = z.string().regex(/^ML-\d{4,}$/);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("row"), orderId, force: z.boolean().optional() }),
  z.object({ action: z.literal("test"), orderId }),
  z.object({ action: z.literal("purge"), orderId }),
  z.object({ action: z.literal("payment"), orderId }),
  z.object({
    action: z.literal("markpaid"),
    orderId,
    amount: z.number().int().positive().max(100_000_000),
    method: z.string().max(40).optional(),
  }),
  z.object({ action: z.literal("pending") }),
]);

/** Called by the Apps Script buttons in the sheet. Sends the email for an order's current Estado. */
export async function POST(req: Request): Promise<Response> {
  const rt = getRuntime();
  const secret = rt.config.sheetSecret;
  if (!secret) return Response.json({ error: "disabled" }, { status: 503, headers: noStore });
  if (!bearerMatches(req, secret))
    return new Response("Unauthorized", { status: 401, headers: noStore });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  try {
    return Response.json(await manualSend(rt.sendDeps(), parsed.data), { headers: noStore });
  } catch (error) {
    logger.error("send failed", { error: String(error) });
    const busy = String(error).includes("already running");
    return Response.json(
      { error: busy ? "busy" : "failed" },
      { status: busy ? 409 : 500, headers: noStore },
    );
  }
}
