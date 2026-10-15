import { verifyConfirmToken } from "@/lib/confirm-token";
import { logger } from "@/lib/logger";
import type { OrderRow } from "@/lib/order-row";
import type { SheetConfig } from "@/lib/sheet-config";
import { resolveTemplate } from "@/lib/sheet-templates";
import { buildEmail, joinResumen, whatsappLink, type EmailTemplate } from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";

export interface ConfirmDeps {
  secret: string;
  readOrders: () => Promise<OrderRow[]>;
  setConfirmed: (rowNumber: number, timestamp: string) => Promise<void>;
  send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  readTemplates: () => Promise<Map<string, EmailTemplate>>;
  readConfig: () => Promise<SheetConfig>;
  siteUrl: string;
  whatsappNumber: string;
  operatorEmail: string;
  sheetLink: (rowNumber: number) => string;
  now: () => Date;
}

export type ConfirmView =
  | { status: "ready"; orderId: string; cotizacion: string }
  | { status: "done"; orderId: string }
  | { status: "invalid" };

/** Estados in which a quote was already accepted and work is under way or finished. */
const PAST_CONFIRMATION = new Set(["Confirmado", "En cola", "Imprimiendo", "Listo", "Entregado"]);

async function locate(
  token: string,
  deps: ConfirmDeps,
): Promise<{ view: ConfirmView; order?: OrderRow }> {
  const orders = await deps.readOrders();
  const orderId = verifyConfirmToken(
    token,
    (id) => orders.find((o) => o.id === id)?.cotizacion,
    deps.secret,
  );
  const order = orderId ? orders.find((o) => o.id === orderId) : undefined;
  if (!order) return { view: { status: "invalid" } };
  if (order.estado === "Cotizado")
    return { view: { status: "ready", orderId: order.id, cotizacion: order.cotizacion }, order };
  if (PAST_CONFIRMATION.has(order.estado))
    return { view: { status: "done", orderId: order.id }, order };
  return { view: { status: "invalid" } };
}

export async function viewConfirmation(token: string, deps: ConfirmDeps): Promise<ConfirmView> {
  return (await locate(token, deps)).view;
}

export type ConfirmResult = { status: "confirmed"; orderId: string } | ConfirmView;

const inFlight = new Set<string>();

/**
 * The customer clicked "Confirmar" (POST). Updates the sheet first, then sends the customer's
 * confirmation and the operator's notice; a failed email never undoes the confirmation.
 */
export async function confirmOrder(token: string, deps: ConfirmDeps): Promise<ConfirmResult> {
  const { view, order } = await locate(token, deps);
  if (view.status !== "ready" || !order) return view;
  if (inFlight.has(order.id)) return { status: "done", orderId: order.id };
  inFlight.add(order.id);
  try {
    await deps.setConfirmed(order.rowNumber, formatTimestamp(deps.now()));
    const [templates, config] = await Promise.all([deps.readTemplates(), deps.readConfig()]);
    const fileLines = order.detalle.split("\n").filter((l) => l.trim() !== "");
    const vars = {
      nombre: order.nombre,
      orderId: order.id,
      resumen: joinResumen(fileLines, order),
      whatsappLink: whatsappLink(deps.whatsappNumber, order.id),
      sitio: deps.siteUrl,
      retiro: config.RETIRO_DIRECCION,
    };
    const customer = buildEmail(resolveTemplate("Confirmado", templates).template, vars);
    const operator = {
      subject: `[Monolab] Cotización confirmada ${order.id}`,
      text: `El cliente confirmó la cotización del pedido ${order.id}.\nFila en planilla: ${deps.sheetLink(order.rowNumber)}\nSiguiente paso: pasar el Estado a En cola.\n`,
    };
    for (const mail of [
      { to: order.email.trim(), ...customer },
      {
        to: deps.operatorEmail,
        subject: operator.subject,
        text: operator.text,
        html: `<p>${operator.text.replace(/\n/g, "<br>")}</p>`,
      },
    ]) {
      try {
        await deps.send(mail);
      } catch (error) {
        logger.error("confirmation email failed", {
          orderId: order.id,
          to: mail.to === deps.operatorEmail ? "operator" : "customer",
          error: String(error),
        });
      }
    }
    return { status: "confirmed", orderId: order.id };
  } finally {
    inFlight.delete(order.id);
  }
}
