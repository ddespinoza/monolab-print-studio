import { join } from "node:path";
import { getConfig, type Config } from "@/lib/config";
import type { ConfirmDeps } from "@/lib/confirmation";
import { signConfirmToken } from "@/lib/confirm-token";
import type { DriveApi } from "@/lib/drive";
import { driveFrom, sheetsFrom } from "@/lib/google";
import { createMailer, createSmtpTransport, type Mailer } from "@/lib/mailer";
import { createMockDrive, createMockMailer, createMockSheets } from "@/lib/mock";
import type { OrdersDeps } from "@/lib/orders";
import { createLimiter, type Limiter } from "@/lib/rate-limit";
import { cachedLoader, parseConfig, type SheetConfig } from "@/lib/sheet-config";
import { parsePlantillas } from "@/lib/sheet-templates";
import type { SheetsApi } from "@/lib/sheets";
import type { ManualSendDeps } from "@/lib/manual-send";
import type { TickDeps } from "@/lib/status-notifier";
import type { EmailTemplate } from "@/lib/templates";
import { createTmpStore, type TmpStore } from "@/lib/tmp-store";

const DAY_MS = 24 * 3600_000;

export interface Runtime {
  config: Config;
  sheets: SheetsApi;
  drive: DriveApi;
  mailer: Mailer;
  tmp: TmpStore;
  uploadLimiter: Limiter;
  orderLimiter: Limiter;
  sheetConfig: () => Promise<SheetConfig>;
  templates: () => Promise<Map<string, EmailTemplate>>;
  ordersDeps: () => OrdersDeps;
  confirmDeps: () => ConfirmDeps;
  tickDeps: () => TickDeps;
  sendDeps: () => ManualSendDeps;
}

function build(config: Config): Runtime {
  const mockDir = join(config.dataDir, "mock");
  const real = config.google;
  const sheets =
    real && !config.mock ? sheetsFrom(real, config.sheetTab) : createMockSheets(mockDir);
  const drive = real && !config.mock ? driveFrom(real) : createMockDrive(mockDir);
  const mailer = !config.mock
    ? createMailer(createSmtpTransport(config.smtp), config)
    : createMockMailer(mockDir);
  const tmp = createTmpStore(join(config.dataDir, "tmp"));
  const sheetConfig = cachedLoader(async () => parseConfig(await sheets.readTab("Config")));
  const templates = async (): Promise<Map<string, EmailTemplate>> =>
    parsePlantillas(await sheets.readTab("Plantillas"));
  const sheetLink = (row: number): string =>
    real
      ? `https://docs.google.com/spreadsheets/d/${real.sheetId}/edit#gid=0&range=A${row}:T${row}`
      : `mock://sheet/row-${row}`;
  const send = (mail: Parameters<Mailer["send"]>[0]): Promise<void> => mailer.send(mail);
  const tickDeps = (): TickDeps => ({
    readOrders: () => sheets.readOrders(),
    readTemplates: templates,
    readConfig: sheetConfig,
    send,
    markNotified: (row, estado, ts) => sheets.markNotified(row, estado, ts),
    sweep: () => tmp.sweep(DAY_MS),
    confirmLink: (o) =>
      `${config.siteUrl}/confirmar/${signConfirmToken(o.id, o.cotizacion, config.confirmSecret)}`,
    siteUrl: config.siteUrl,
    whatsappNumber: config.whatsappNumber,
    now: () => new Date(),
  });

  return {
    config,
    sheets,
    drive,
    mailer,
    tmp,
    uploadLimiter: createLimiter({ max: 20, windowMs: 10 * 60_000 }),
    orderLimiter: createLimiter({ max: 10, windowMs: 10 * 60_000 }),
    sheetConfig,
    templates,
    ordersDeps: () => ({
      sheets,
      drive,
      tmp,
      send,
      siteUrl: config.siteUrl,
      whatsappNumber: config.whatsappNumber,
      operatorEmail: config.operatorEmail,
      now: () => new Date(),
    }),
    confirmDeps: () => ({
      secret: config.confirmSecret,
      readOrders: () => sheets.readOrders(),
      setConfirmed: (row, ts) => sheets.setConfirmed(row, ts),
      send,
      readTemplates: templates,
      readConfig: sheetConfig,
      siteUrl: config.siteUrl,
      whatsappNumber: config.whatsappNumber,
      operatorEmail: config.operatorEmail,
      sheetLink,
      now: () => new Date(),
    }),
    tickDeps,
    sendDeps: () => ({
      ...tickDeps(),
      operatorEmail: config.operatorEmail,
      logSend: (entry) => sheets.appendLog(entry),
      removeFolder: (id) => drive.remove(id),
      markFilesDeleted: (row, text) => sheets.markFilesDeleted(row, text),
      markPaid: (row) => sheets.markPaid(row),
      appendIngreso: (entry) => sheets.appendIngreso(entry),
    }),
  };
}

let runtime: Runtime | undefined;
export function getRuntime(): Runtime {
  return (runtime ??= build(getConfig()));
}

/** Test hook: rebuild from the current environment. */
export function resetRuntime(): void {
  runtime = undefined;
}
