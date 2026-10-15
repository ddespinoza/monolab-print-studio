import { logger } from "@/lib/logger";
import type { OrderRow } from "@/lib/order-row";
import { findPurgeable } from "@/lib/retention";
import { exclusive, findPending, prepareEmail, type TickDeps } from "@/lib/status-notifier";
import type { TemplateKey } from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";
import { ESTADOS } from "@/lib/validation";

export const MAX_PER_CALL = 50;
/** Folders deleted per automatic run, so one tick never spends long on Drive. */
export const MAX_EXPIRE_PER_CALL = 10;

export type SendRequest =
  | { action: "row"; orderId: string; force?: boolean }
  | { action: "test"; orderId: string }
  /** Permanently deletes the order's Drive folder (only for Entregado or Cancelado orders). */
  | { action: "purge"; orderId: string }
  /** Deletes the files of every order finished at least ELIMINAR_ARCHIVOS_DIAS ago. Called by the tick, not by the sheet. */
  | { action: "expire" }
  /** Emails the bank details («Pago» template). Not an Estado: no notified marks, can be repeated. */
  | { action: "payment"; orderId: string }
  /** Records a received payment: one Ingresos ledger row, then column V = Pagado. `amount` is whole CLP typed by the operator. */
  | { action: "markpaid"; orderId: string; amount: number; method?: string }
  | { action: "pending" };

export type SendStatus =
  "sent" | "test_sent" | "already_sent" | "purged" | "payment_sent" | "paid" | "refused" | "failed";

export interface SendResult {
  orderId: string;
  estado: string;
  status: SendStatus;
  /** Spanish text the sheet shows to the operator. */
  message: string;
}

export interface ManualSendDeps extends TickDeps {
  operatorEmail: string;
  /** Appends a row to the Envíos tab: date, order, Estado, recipient, result, origin. */
  logSend: (entry: string[]) => Promise<void>;
  /** Permanently deletes a Drive folder (and everything in it) by id. */
  removeFolder: (folderId: string) => Promise<void>;
  /** Writes "Eliminado <fecha>" into the order's Archivos (Drive) cell. */
  markFilesDeleted: (rowNumber: number, text: string) => Promise<void>;
  /** Sets column V (Pago) to "Pagado". */
  markPaid: (rowNumber: number) => Promise<void>;
  /** Appends a row to the Ingresos ledger: date, order, amount, method, note. */
  appendIngreso: (entry: string[]) => Promise<void>;
}

const FINISHED = new Set(["Entregado", "Cancelado"]);
/** Payment makes sense once the customer confirmed the quote and until the order is cancelled. */
const PAYABLE = new Set(["Confirmado", "En cola", "Imprimiendo", "Listo", "Entregado"]);

/** Folder id from the Archivos (Drive) cell: a Drive folder link or a mock:// link. */
export function driveFolderId(cell: string): string | undefined {
  return /\/folders\/([\w-]+)/.exec(cell)?.[1] ?? /^mock:\/\/drive\/(.+)$/.exec(cell.trim())?.[1];
}

const NOTIFIABLE = new Set<string>(ESTADOS.filter((e) => e !== "Nuevo"));

/** Why an order cannot be mailed, or undefined when it can. */
function refusal(order: OrderRow, preview: boolean): string | undefined {
  if (!NOTIFIABLE.has(order.estado))
    return `El estado «${order.estado || "vacío"}» no tiene correo. Cambie el Estado primero.`;
  if (order.email.trim() === "") return "El pedido no tiene correo del cliente.";
  if (!preview && order.estado === "Cotizado" && order.cotizacion.trim() === "")
    return "Escriba la Cotización antes de enviar el correo de cotización.";
  return undefined;
}

/**
 * Sends the email that matches an order's current Estado when the operator presses a sheet button.
 * Works in manual and automatic mode. Never throws for a single order: each outcome is a result row.
 */
export function manualSend(
  deps: ManualSendDeps,
  req: SendRequest,
): Promise<{ results: SendResult[] }> {
  return exclusive(async () => {
    const [orders, templates, config] = await Promise.all([
      deps.readOrders(),
      deps.readTemplates(),
      deps.readConfig(),
    ]);

    const log = async (order: OrderRow, outcome: string, origin: string): Promise<void> => {
      try {
        await deps.logSend([
          formatTimestamp(deps.now()),
          order.id,
          order.estado,
          order.email.trim(),
          outcome,
          origin,
        ]);
      } catch (error) {
        logger.error("send log write failed", { orderId: order.id, error: String(error) });
      }
    };

    const sendOne = async (
      order: OrderRow,
      mode: { preview: boolean; force: boolean },
    ): Promise<SendResult> => {
      const result = (status: SendStatus, message: string): SendResult => ({
        orderId: order.id,
        estado: order.estado,
        status,
        message,
      });
      const why = refusal(order, mode.preview);
      if (why) return result("refused", why);
      if (!mode.preview && !mode.force && order.notificado === order.estado)
        return result(
          "already_sent",
          `El correo «${order.estado}» ya se envió a ${order.email.trim()}.`,
        );
      const estado = order.estado as TemplateKey;
      try {
        const { mail } = prepareEmail(order, estado, deps, templates, config);
        if (mode.preview) {
          await deps.send({
            to: deps.operatorEmail,
            ...mail,
            subject: `[PRUEBA] ${mail.subject}`,
          });
          await log(order, "Enviado", "Prueba");
          return result("test_sent", `Prueba enviada a ${deps.operatorEmail}.`);
        }
        await deps.send({ to: order.email.trim(), ...mail });
      } catch (error) {
        logger.error("manual send failed", { orderId: order.id, estado, error: String(error) });
        await log(order, "Falló", mode.preview ? "Prueba" : "Botón");
        return result("failed", "No se pudo enviar el correo. Inténtelo de nuevo.");
      }
      let message = `Correo «${estado}» enviado a ${order.email.trim()}.`;
      try {
        await deps.markNotified(order.rowNumber, estado, formatTimestamp(deps.now()));
      } catch (error) {
        logger.error("manual send: could not mark row", {
          orderId: order.id,
          error: String(error),
        });
        message += " No se pudo registrar en la planilla: no lo reenvíe.";
      }
      await log(order, "Enviado", "Botón");
      return result("sent", message);
    };

    const purge = async (order: OrderRow, origin = "Eliminación"): Promise<SendResult> => {
      const result = (status: SendStatus, message: string): SendResult => ({
        orderId: order.id,
        estado: order.estado,
        status,
        message,
      });
      if (!FINISHED.has(order.estado))
        return result(
          "refused",
          "Los archivos solo se pueden eliminar cuando el pedido está Entregado o Cancelado.",
        );
      if (/^Eliminado\b/.test(order.drive.trim()))
        return result("refused", "Los archivos de este pedido ya fueron eliminados.");
      const folderId = driveFolderId(order.drive);
      if (!folderId)
        return result("refused", "El pedido no tiene una carpeta de archivos en Drive.");
      try {
        await deps.removeFolder(folderId);
      } catch (error) {
        logger.error("purge failed", { orderId: order.id, error: String(error) });
        await log(order, "Falló", origin);
        return result("failed", "No se pudieron eliminar los archivos. Inténtelo de nuevo.");
      }
      let message = "Archivos eliminados de forma definitiva.";
      try {
        await deps.markFilesDeleted(order.rowNumber, `Eliminado ${formatTimestamp(deps.now())}`);
      } catch (error) {
        logger.error("purge: could not mark row", { orderId: order.id, error: String(error) });
        message += " No se pudo anotar en la planilla: anótelo a mano en «Archivos (Drive)».";
      }
      await log(order, "Archivos eliminados", origin);
      return result("purged", message);
    };

    const payment = async (
      order: OrderRow,
      kind: "mail" | { amount: number; method: string },
    ): Promise<SendResult> => {
      const result = (status: SendStatus, message: string): SendResult => ({
        orderId: order.id,
        estado: order.estado,
        status,
        message,
      });
      if (!PAYABLE.has(order.estado))
        return result(
          "refused",
          "El pago se gestiona desde que el cliente confirma la cotización.",
        );
      if (order.pago === "Pagado") return result("refused", "Este pedido ya está pagado.");
      if (order.cotizacion.trim() === "")
        return result("refused", "Escriba la Cotización antes de gestionar el pago.");
      if (kind === "mail") {
        if (order.email.trim() === "")
          return result("refused", "El pedido no tiene correo del cliente.");
        if (!config.BANCO)
          return result("refused", "Complete los datos bancarios (BANCO_*) en Config primero.");
        try {
          const { mail } = prepareEmail(order, "Pago", deps, templates, config);
          await deps.send({ to: order.email.trim(), ...mail });
        } catch (error) {
          logger.error("payment email failed", { orderId: order.id, error: String(error) });
          await log(order, "Falló", "Pago");
          return result("failed", "No se pudo enviar el correo. Inténtelo de nuevo.");
        }
        await log(order, "Enviado", "Pago");
        return result("payment_sent", `Datos de pago enviados a ${order.email.trim()}.`);
      }
      if (!Number.isInteger(kind.amount) || kind.amount <= 0)
        return result("refused", "El monto debe ser un número entero de pesos mayor que cero.");
      try {
        await deps.appendIngreso([
          formatTimestamp(deps.now()),
          order.id,
          String(kind.amount),
          kind.method,
          "",
        ]);
      } catch (error) {
        logger.error("ledger write failed", { orderId: order.id, error: String(error) });
        await log(order, "Falló", "Pago");
        return result("failed", "No se pudo registrar el ingreso. Inténtelo de nuevo.");
      }
      let message = `Pago de $${kind.amount.toLocaleString("es-CL")} registrado.`;
      try {
        await deps.markPaid(order.rowNumber);
      } catch (error) {
        logger.error("payment: could not mark row", { orderId: order.id, error: String(error) });
        message +=
          " El ingreso quedó anotado, pero no se pudo marcar «Pagado» en la planilla: márquelo a mano y no lo registre otra vez.";
      }
      await log(order, "Pago registrado", "Pago");
      return result("paid", message);
    };

    if (req.action === "pending") {
      const results: SendResult[] = [];
      for (const { order } of findPending(orders).slice(0, MAX_PER_CALL))
        results.push(await sendOne(order, { preview: false, force: false }));
      return { results };
    }
    if (req.action === "expire") {
      const due = findPurgeable(orders, deps.now(), config.ELIMINAR_ARCHIVOS_DIAS);
      const results: SendResult[] = [];
      for (const order of due.slice(0, MAX_EXPIRE_PER_CALL))
        results.push(await purge(order, "Eliminación automática"));
      return { results };
    }
    const order = orders.find((o) => o.id === req.orderId);
    if (!order)
      return {
        results: [
          {
            orderId: req.orderId,
            estado: "",
            status: "refused",
            message: `No existe el pedido ${req.orderId}.`,
          },
        ],
      };
    if (req.action === "purge") return { results: [await purge(order)] };
    if (req.action === "payment") return { results: [await payment(order, "mail")] };
    if (req.action === "markpaid") {
      const method = (req.method ?? "").replace(/\s+/g, " ").trim() || "Transferencia";
      return { results: [await payment(order, { amount: req.amount, method })] };
    }
    return {
      results: [
        await sendOne(order, {
          preview: req.action === "test",
          force: req.action === "row" && req.force === true,
        }),
      ],
    };
  });
}
