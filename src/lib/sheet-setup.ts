import type { sheets_v4 } from "googleapis";
import { HEADERS } from "@/lib/order-row";
import { withRetry, type RetryOptions } from "@/lib/retry";
import { BANK_KEYS, CONFIG_DEFAULTS } from "@/lib/sheet-config";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";
import { ESTADOS } from "@/lib/validation";

/** Envíos tab: one row per email the buttons send or try to send. */
export const ENVIOS_HEADERS = [
  "Fecha",
  "ID Pedido",
  "Estado",
  "Destinatario",
  "Resultado",
  "Origen",
] as const;

/** Ingresos tab: one row per payment received (written by «Marcar pagado»). */
export const INGRESOS_HEADERS = ["Fecha", "ID Pedido", "Monto (CLP)", "Método", "Nota"] as const;

/** Columns V and W of Pedidos, after the Enviar checkbox in U. */
const PAGO_HEADERS = ["Pago", "Fecha compromiso"] as const;
const PAGO_COLUMN_INDEX = 21;

/** Column U of Pedidos: tick it and the sheet script sends that row's email. Not part of an order row (A-T). */
export const ENVIAR_HEADER = "Enviar";
const ENVIAR_COLUMN_INDEX = 20;

const NOTIFIABLE = ESTADOS.filter((e) => e !== "Nuevo");

/** Plantillas tab content: Estado | Asunto | Mensaje. The footer is appended at send time, so it is not seeded. */
export function buildPlantillasRows(): string[][] {
  return [
    ["Estado", "Asunto", "Mensaje"],
    ...[...NOTIFIABLE, "Pago" as const].map((e) => [
      e,
      DEFAULT_TEMPLATES[e as TemplateKey].subject,
      DEFAULT_TEMPLATES[e as TemplateKey].body,
    ]),
  ];
}

/** Keeps every row the operator already has and appends defaults for missing keys. */
export function mergeConfigRows(existing: readonly (readonly string[])[]): string[][] {
  const rows = existing.length > 0 ? existing.map((r) => [...r]) : [["Clave", "Valor"]];
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    if (!rows.some((r) => r[0] === key)) rows.push([key, String(value)]);
  }
  for (const key of Object.keys(BANK_KEYS))
    if (!rows.some((r) => r[0] === key)) rows.push([key, ""]);
  return rows;
}

export interface SetupReport {
  created: string[];
  seeded: string[];
}

/**
 * Idempotent: creates the Plantillas and Config tabs when missing, writes headers and defaults only into empty
 * tabs (operator edits are never overwritten), and (re)installs the Estado dropdown on the Pedidos tab.
 */
export async function setupSheet(
  client: Pick<sheets_v4.Sheets, "spreadsheets">,
  cfg: { sheetId: string; sheetTab: string },
  retry: RetryOptions = {},
): Promise<SetupReport> {
  const { sheetId: spreadsheetId, sheetTab: pedidos } = cfg;
  const api = client.spreadsheets;
  const report: SetupReport = { created: [], seeded: [] };

  const meta = await withRetry(
    () => api.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" }),
    retry,
  );
  const ids = new Map<string, number>();
  for (const s of meta.data.sheets ?? []) {
    if (s.properties?.title && typeof s.properties.sheetId === "number")
      ids.set(s.properties.title, s.properties.sheetId);
  }
  for (const title of [pedidos, "Plantillas", "Config", "Envíos", "Ingresos"]) {
    if (ids.has(title)) continue;
    const res = await withRetry(
      () =>
        api.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title } } }] },
        }),
      retry,
    );
    ids.set(title, res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? -1);
    report.created.push(title);
  }

  const read = async (range: string): Promise<string[][]> =>
    (
      (await withRetry(() => api.values.get({ spreadsheetId, range }), retry)).data.values ?? []
    ).map((r) => r.map(String));
  const write = (range: string, values: string[][]): Promise<unknown> =>
    withRetry(
      () =>
        api.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values },
        }),
      retry,
    );

  const header = await read(`${pedidos}!A1:W1`);
  if (header.length === 0) {
    await write(`${pedidos}!A1`, [[...HEADERS]]);
    report.seeded.push(pedidos);
  } else if (header[0]?.[5] === "WhatsApp") {
    await write(`${pedidos}!F1`, [["Teléfono"]]);
    report.seeded.push(`${pedidos} F1`);
  }
  if ((header[0]?.[ENVIAR_COLUMN_INDEX] ?? "") === "") {
    await write(`${pedidos}!U1`, [[ENVIAR_HEADER]]);
    report.seeded.push(`${pedidos} U1`);
  }
  for (const [i, name] of PAGO_HEADERS.entries()) {
    if ((header[0]?.[PAGO_COLUMN_INDEX + i] ?? "") === "") {
      await write(`${pedidos}!${String.fromCharCode(86 + i)}1`, [[name]]);
      report.seeded.push(`${pedidos} ${String.fromCharCode(86 + i)}1`);
    }
  }
  const plantillas = await read("Plantillas!A1:C");
  if (plantillas.length === 0) {
    await write("Plantillas!A1", buildPlantillasRows());
    report.seeded.push("Plantillas");
  } else if (!plantillas.some((r) => (r[0] ?? "").trim() === "Pago")) {
    // New template keys are appended below the operator's rows; their own rows are never touched.
    await write(`Plantillas!A${plantillas.length + 1}`, [
      ["Pago", DEFAULT_TEMPLATES.Pago.subject, DEFAULT_TEMPLATES.Pago.body],
    ]);
    report.seeded.push("Plantillas Pago");
  }
  if ((await read("Ingresos!A1:E1")).length === 0) {
    await write("Ingresos!A1", [[...INGRESOS_HEADERS]]);
    report.seeded.push("Ingresos");
  }
  if ((await read("Envíos!A1:F1")).length === 0) {
    await write("Envíos!A1", [[...ENVIOS_HEADERS]]);
    report.seeded.push("Envíos");
  }
  const config = await read("Config!A1:B");
  const merged = mergeConfigRows(config);
  if (merged.length !== config.length) {
    await write("Config!A1", merged);
    report.seeded.push("Config");
  }

  const pedidosId = ids.get(pedidos);
  await withRetry(
    () =>
      api.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              setDataValidation: {
                range: {
                  sheetId: pedidosId,
                  startRowIndex: 1,
                  endRowIndex: 2000,
                  startColumnIndex: 2,
                  endColumnIndex: 3,
                },
                rule: {
                  condition: {
                    type: "ONE_OF_LIST",
                    values: ESTADOS.map((e) => ({ userEnteredValue: e })),
                  },
                  showCustomUi: true,
                  strict: true,
                },
              },
            },
            {
              setDataValidation: {
                range: {
                  sheetId: pedidosId,
                  startRowIndex: 1,
                  endRowIndex: 2000,
                  startColumnIndex: ENVIAR_COLUMN_INDEX,
                  endColumnIndex: ENVIAR_COLUMN_INDEX + 1,
                },
                rule: { condition: { type: "BOOLEAN" }, strict: true },
              },
            },
            {
              updateSheetProperties: {
                properties: { sheetId: pedidosId, gridProperties: { frozenRowCount: 1 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      }),
    retry,
  );
  return report;
}
