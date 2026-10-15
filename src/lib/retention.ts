import type { OrderRow } from "@/lib/order-row";
import { formatTimestamp } from "@/lib/time";

const FINISHED = new Set(["Entregado", "Cancelado"]);

/** "YYYY-MM-DD HH:mm" (sheet timestamp, studio time) as a comparable number of milliseconds, or NaN. */
function stamp(text: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(text.trim());
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
}

/**
 * Orders whose files are due for deletion, oldest first: Entregado or Cancelado, the finishing email was sent
 * (so "Última notificación" is when the clock started), at least `days` ago, and the Drive folder still exists.
 * `days` of 0 or less turns the rule off.
 */
export function findPurgeable(orders: readonly OrderRow[], now: Date, days: number): OrderRow[] {
  if (!(days > 0)) return [];
  const current = stamp(formatTimestamp(now));
  const limit = days * 86_400_000;
  return orders
    .map((order) => ({ order, since: stamp(order.ultima) }))
    .filter(
      ({ order, since }) =>
        FINISHED.has(order.estado) &&
        order.notificado === order.estado &&
        !/^Eliminado\b/.test(order.drive.trim()) &&
        order.drive.trim() !== "" &&
        current - since >= limit,
    )
    .sort((a, b) => a.since - b.since)
    .map(({ order }) => order);
}
