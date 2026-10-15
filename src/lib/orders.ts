import type { Readable } from "node:stream";
import type { DriveApi } from "@/lib/drive";
import { logger } from "@/lib/logger";
import { nextOrderNumber } from "@/lib/order-number";
import { buildOrderRow } from "@/lib/order-row";
import { folderName, sanitizeFilename } from "@/lib/sanitize";
import type { SheetsApi } from "@/lib/sheets";
import { totalVolumeCm3 } from "@/lib/stl-metrics";
import {
  buildEmail,
  buildResumen,
  DEFAULT_TEMPLATES,
  OPERATOR_TEMPLATE,
  whatsappLink,
} from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";
import type { OrderInput } from "@/lib/validation";

export class OrderError extends Error {
  constructor(
    public code: "missing_file" | "id_conflict",
    message: string,
  ) {
    super(message);
  }
}

export interface OrdersDeps {
  sheets: Pick<SheetsApi, "readIds" | "appendOrder" | "deleteRow">;
  drive: DriveApi;
  tmp: {
    exists(token: string): Promise<boolean>;
    open(token: string): Readable;
    remove(token: string): Promise<void>;
  };
  send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  siteUrl: string;
  whatsappNumber: string;
  operatorEmail: string;
  now: () => Date;
}

const MAX_ATTEMPTS = 3;

/** Orders are numbered from the sheet, so two submissions must never interleave in this process. */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Unique Drive names inside one order: a second "caja.stl" becomes "caja_2.stl". */
function driveNames(order: OrderInput): string[] {
  const seen = new Map<string, number>();
  return order.files.map((f) => {
    const name = sanitizeFilename(f.name);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : name.replace(/(\.[a-z]+)$/, `_${n}$1`);
  });
}

async function placeOrder(
  order: OrderInput,
  deps: OrdersDeps,
): Promise<{ id: string; rowLink: string; driveLink: string }> {
  const names = driveNames(order);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = nextOrderNumber(await deps.sheets.readIds());
    const folder = await deps.drive.createOrderFolder(folderName(id, order.paciente));
    try {
      for (const [i, file] of order.files.entries())
        await deps.drive.uploadFile(folder.id, names[i], () => deps.tmp.open(file.token));
    } catch (error) {
      await deps.drive.remove(folder.id).catch(() => undefined);
      throw error;
    }
    const { rowNumber, link } = await deps.sheets.appendOrder(
      buildOrderRow({ id, fecha: formatTimestamp(deps.now()), order, driveLink: folder.link }),
    );
    const duplicates = (await deps.sheets.readIds()).filter((x) => x === id).length > 1;
    if (!duplicates) return { id, rowLink: link, driveLink: folder.link };
    logger.warn("order id collision, retrying", { id, attempt });
    await deps.sheets.deleteRow(rowNumber);
    await deps.drive.remove(folder.id).catch(() => undefined);
  }
  throw new OrderError("id_conflict", "Could not reserve an order number");
}

/**
 * Stores an order: Drive folder with the files, one sheet row, then the two emails. The row is the commit
 * point; an email failure afterwards is logged but does not fail the order (the customer would resubmit).
 */
export async function createOrder(order: OrderInput, deps: OrdersDeps): Promise<{ id: string }> {
  for (const f of order.files) {
    if (!(await deps.tmp.exists(f.token)))
      throw new OrderError("missing_file", `Upload not found: ${f.token}`);
  }
  const { id, rowLink, driveLink } = await exclusive(() => placeOrder(order, deps));
  await Promise.all(order.files.map((f) => deps.tmp.remove(f.token).catch(() => undefined)));

  const resumen = buildResumen({
    files: order.files,
    paciente: order.paciente,
    resina: order.resina,
    cantidad: order.cantidad,
    entrega: order.entrega,
  });
  const customer = buildEmail(
    DEFAULT_TEMPLATES.Recibido,
    {
      nombre: order.nombre,
      orderId: id,
      resumen,
      whatsappLink: whatsappLink(deps.whatsappNumber, id),
      sitio: deps.siteUrl,
    },
    { estado: "Recibido" },
  );
  const operator = buildEmail(OPERATOR_TEMPLATE, {
    nombre: order.nombre,
    orderId: id,
    paciente: order.paciente,
    telefono: order.telefono,
    nArchivos: String(order.files.length),
    volumenTotal: totalVolumeCm3(order.files.map((f) => f.volumeCm3)).toFixed(1),
    driveLink,
    filaLink: rowLink,
    resumen,
  });
  for (const [to, mail] of [
    [order.email, customer],
    [deps.operatorEmail, operator],
  ] as const) {
    try {
      await deps.send({ to, ...mail });
    } catch (error) {
      logger.error("order email failed", {
        orderId: id,
        to: to === deps.operatorEmail ? "operator" : "customer",
        error: String(error),
      });
    }
  }
  return { id };
}
