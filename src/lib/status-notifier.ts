import { logger } from "@/lib/logger";
import type { OrderRow } from "@/lib/order-row";
import type { SheetConfig } from "@/lib/sheet-config";
import { resolveTemplate } from "@/lib/sheet-templates";
import {
  buildEmail,
  joinResumen,
  whatsappLink,
  type EmailTemplate,
  type TemplateKey,
} from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";
import { ESTADOS } from "@/lib/validation";

export interface Pending {
  order: OrderRow;
  estado: TemplateKey;
}

const NOTIFIABLE = new Set<string>(ESTADOS.filter((e) => e !== "Nuevo"));

/** Pure diff: rows whose Estado changed since the last notification. Clearing "Estado notificado" re-sends. */
export function findPending(orders: readonly OrderRow[]): Pending[] {
  return orders
    .filter((o) => NOTIFIABLE.has(o.estado) && o.estado !== o.notificado && o.email.trim() !== "")
    .map((order) => ({ order, estado: order.estado as TemplateKey }));
}

export interface TickDeps {
  readOrders: () => Promise<OrderRow[]>;
  readTemplates: () => Promise<Map<string, EmailTemplate>>;
  readConfig: () => Promise<SheetConfig>;
  send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  markNotified: (rowNumber: number, estado: string, timestamp: string) => Promise<void>;
  /** Deletes stale tmp uploads; returns how many. */
  sweep: () => Promise<number>;
  siteUrl: string;
  whatsappNumber: string;
  now: () => Date;
}

export interface TickResult {
  processed: number;
  failed: number;
  swept: number;
  fallbacks: number;
}

let running = false;

function varsFor(order: OrderRow, deps: TickDeps, retiro: string): Record<string, string> {
  const fileLines = order.detalle.split("\n").filter((l) => l.trim() !== "");
  return {
    nombre: order.nombre,
    orderId: order.id,
    resumen: joinResumen(fileLines, order),
    whatsappLink: whatsappLink(deps.whatsappNumber, order.id),
    sitio: deps.siteUrl,
    retiro,
  };
}

/**
 * One cron tick. At-least-once: the status mail is sent first and "Estado notificado" is written after,
 * so a failed write can repeat one email on the next tick. Overlapping ticks are refused.
 */
export async function runTick(deps: TickDeps): Promise<TickResult> {
  if (running) throw new Error("A tick is already running");
  running = true;
  try {
    const [orders, templates, config] = await Promise.all([
      deps.readOrders(),
      deps.readTemplates(),
      deps.readConfig(),
    ]);
    const result: TickResult = { processed: 0, failed: 0, swept: 0, fallbacks: 0 };
    for (const { order, estado } of findPending(orders)) {
      try {
        const { template, fallback } = resolveTemplate(estado, templates);
        const mail = buildEmail(template, varsFor(order, deps, config.RETIRO_DIRECCION));
        await deps.send({ to: order.email.trim(), ...mail });
        await deps.markNotified(order.rowNumber, estado, formatTimestamp(deps.now()));
        result.processed++;
        if (fallback) result.fallbacks++;
      } catch (error) {
        result.failed++;
        logger.error("status notification failed", {
          orderId: order.id,
          estado,
          error: String(error),
        });
      }
    }
    try {
      result.swept = await deps.sweep();
    } catch (error) {
      logger.error("tmp sweep failed", { error: String(error) });
    }
    return result;
  } finally {
    running = false;
  }
}
