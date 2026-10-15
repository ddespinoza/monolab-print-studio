import type { sheets_v4 } from "googleapis";
import { HEADERS } from "@/lib/order-row";
import { withRetry, type RetryOptions } from "@/lib/retry";
import { CONFIG_DEFAULTS } from "@/lib/sheet-config";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";
import { ESTADOS } from "@/lib/validation";

const NOTIFIABLE = ESTADOS.filter((e) => e !== "Nuevo");

/** Plantillas tab content: Estado | Asunto | Mensaje. The footer is appended at send time, so it is not seeded. */
export function buildPlantillasRows(): string[][] {
  return [
    ["Estado", "Asunto", "Mensaje"],
    ...NOTIFIABLE.map((e) => [
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
    if (!rows.some((r) => r[0] === key)) rows.push([key, value]);
  }
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
  for (const title of [pedidos, "Plantillas", "Config"]) {
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

  if ((await read(`${pedidos}!A1:A1`)).length === 0) {
    await write(`${pedidos}!A1`, [[...HEADERS]]);
    report.seeded.push(pedidos);
  }
  if ((await read("Plantillas!A1:C")).length === 0) {
    await write("Plantillas!A1", buildPlantillasRows());
    report.seeded.push("Plantillas");
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
