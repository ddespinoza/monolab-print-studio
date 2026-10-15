import { logger } from "@/lib/logger";
import { createOrder, OrderError } from "@/lib/orders";
import { clientIp } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { orderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number): Response => Response.json(body, { status });

export async function POST(req: Request): Promise<Response> {
  const rt = getRuntime();
  if (!rt.orderLimiter.allow(clientIp(req.headers))) return json({ error: "rate_limited" }, 429);
  const body: unknown = await req.json().catch(() => undefined);
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success)
    return json(
      {
        error: "invalid",
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      400,
    );
  // Honeypot: bots fill the hidden field. Pretend success and touch no Google API.
  if (parsed.data.empresa.trim() !== "") return json({ id: "ML-0000" }, 201);
  try {
    return json(await createOrder(parsed.data, rt.ordersDeps()), 201);
  } catch (error) {
    if (error instanceof OrderError && error.code === "missing_file")
      return json({ error: "missing_file" }, 400);
    logger.error("order failed", { error: String(error) });
    return json({ error: "unavailable" }, 503);
  }
}
