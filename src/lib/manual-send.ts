import { logger } from "@/lib/logger";
import type { OrderRow } from "@/lib/order-row";
import { exclusive, findPending, prepareEmail, type TickDeps } from "@/lib/status-notifier";
import type { TemplateKey } from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";
import { ESTADOS } from "@/lib/validation";

export const MAX_PER_CALL = 50;

export type SendRequest =
  | { action: "row"; orderId: string; force?: boolean }
  | { action: "test"; orderId: string }
  /** Permanently deletes the order's Drive folder (only for Entregado or Cancelado orders). */
  | { action: "purge"; orderId: string }
  | { action: "pending" };

export type SendStatus = "sent" | "test_sent" | "already_sent" | "purged" | "refused" | "failed";

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
}

const FINISHED = new Set(["Entregado", "Cancelado"]);

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

    const purge = async (order: OrderRow): Promise<SendResult> => {
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
        await log(order, "Falló", "Eliminación");
        return result("failed", "No se pudieron eliminar los archivos. Inténtelo de nuevo.");
      }
      let message = "Archivos eliminados de forma definitiva.";
      try {
        await deps.markFilesDeleted(order.rowNumber, `Eliminado ${formatTimestamp(deps.now())}`);
      } catch (error) {
        logger.error("purge: could not mark row", { orderId: order.id, error: String(error) });
        message += " No se pudo anotar en la planilla: anótelo a mano en «Archivos (Drive)».";
      }
      await log(order, "Archivos eliminados", "Eliminación");
      return result("purged", message);
    };

    if (req.action === "pending") {
      const results: SendResult[] = [];
      for (const { order } of findPending(orders).slice(0, MAX_PER_CALL))
        results.push(await sendOne(order, { preview: false, force: false }));
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
