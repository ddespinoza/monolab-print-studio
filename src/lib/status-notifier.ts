import { logger } from "@/lib/logger";
import type { OrderRow } from "@/lib/order-row";
import { isAutomatic, type SheetConfig } from "@/lib/sheet-config";
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
  /** Absolute confirm link for an order's current quote. */
  confirmLink: (order: OrderRow) => string;
  siteUrl: string;
  whatsappNumber: string;
  now: () => Date;
}

export interface TickResult {
  processed: number;
  failed: number;
  /** Cotizado rows with no quote text yet: left pending until the operator fills it in. */
  skipped: number;
  swept: number;
  fallbacks: number;
  /** False when Config ENVIO_AUTOMATICO is not SI: the tick sent nothing. */
  automatic: boolean;
}

let running = false;

/** One send job at a time (cron tick or sheet button), so two mails never race on the same row. */
export async function exclusive<T>(task: () => Promise<T>): Promise<T> {
  if (running) throw new Error("A tick is already running");
  running = true;
  try {
    return await task();
  } finally {
    running = false;
  }
}

type MailDeps = Pick<TickDeps, "confirmLink" | "siteUrl" | "whatsappNumber">;

export function varsFor(order: OrderRow, deps: MailDeps, retiro: string): Record<string, string> {
  const fileLines = order.detalle.split("\n").filter((l) => l.trim() !== "");
  return {
    nombre: order.nombre,
    orderId: order.id,
    resumen: joinResumen(fileLines, order),
    cotizacion: order.cotizacion.trim(),
    confirmLink: deps.confirmLink(order),
    whatsappLink: whatsappLink(deps.whatsappNumber, order.id),
    sitio: deps.siteUrl,
    retiro,
  };
}

/** Renders the email for an order's Estado from the sheet template, or the built-in default. */
export function prepareEmail(
  order: OrderRow,
  estado: TemplateKey,
  deps: MailDeps,
  templates: ReadonlyMap<string, EmailTemplate>,
  config: SheetConfig,
): { mail: ReturnType<typeof buildEmail>; fallback: boolean } {
  const { template, fallback } = resolveTemplate(estado, templates);
  return { mail: buildEmail(template, varsFor(order, deps, config.RETIRO_DIRECCION)), fallback };
}

/**
 * One cron tick. At-least-once: the status mail is sent first and "Estado notificado" is written after,
 * so a failed write can repeat one email on the next tick. Overlapping ticks are refused.
 */
export function runTick(deps: TickDeps): Promise<TickResult> {
  return exclusive(async () => {
    const [orders, templates, config] = await Promise.all([
      deps.readOrders(),
      deps.readTemplates(),
      deps.readConfig(),
    ]);
    const automatic = isAutomatic(config);
    const result: TickResult = {
      processed: 0,
      failed: 0,
      skipped: 0,
      swept: 0,
      fallbacks: 0,
      automatic,
    };
    for (const { order, estado } of automatic ? findPending(orders) : []) {
      if (estado === "Cotizado" && order.cotizacion.trim() === "") {
        result.skipped++;
        logger.warn("quote not sent: Cotización is empty", { orderId: order.id });
        continue;
      }
      try {
        const { mail, fallback } = prepareEmail(order, estado, deps, templates, config);
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
  });
}
