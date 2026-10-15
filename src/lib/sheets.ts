import type { sheets_v4 } from "googleapis";
import { parseOrderRow, type OrderRow } from "@/lib/order-row";
import { withRetry, type RetryOptions } from "@/lib/retry";

export interface SheetsApi {
  readIds(): Promise<string[]>;
  readOrders(): Promise<OrderRow[]>;
  readTab(tab: string): Promise<string[][]>;
  appendOrder(row: string[]): Promise<{ rowNumber: number; link: string }>;
  markNotified(rowNumber: number, estado: string, timestamp: string): Promise<void>;
  /** Customer confirmed the quote: Estado, Confirmado and the notified marks, in one request. */
  setConfirmed(rowNumber: number, timestamp: string): Promise<void>;
  /** Appends one row to the Envíos log tab (plain text, never evaluated as formulas). */
  appendLog(row: string[]): Promise<void>;
  /** Removes a whole row (used by the live test to clean up). */
  deleteRow(rowNumber: number): Promise<void>;
}

export const LOG_TAB = "Envíos";

export function rowFromRange(range: string): number {
  const match = /!\$?[A-Z]+(\d+)/.exec(range);
  if (!match) throw new Error(`Unexpected range from Sheets: ${range}`);
  return Number(match[1]);
}

/** Thin wrapper over Sheets values API. Writes are RAW so Sheets never evaluates user text as a formula. */
export function createSheetsApi(
  client: Pick<sheets_v4.Sheets, "spreadsheets">,
  cfg: { sheetId: string; sheetTab: string },
  retry: RetryOptions = {},
): SheetsApi {
  const { sheetId: spreadsheetId, sheetTab: tab } = cfg;
  const values = client.spreadsheets.values;
  const read = async (range: string): Promise<string[][]> => {
    const res = await withRetry(() => values.get({ spreadsheetId, range }), retry);
    return (res.data.values ?? []).map((r) => r.map(String));
  };
  return {
    async readIds() {
      return (await read(`${tab}!A2:A`)).map((r) => r[0] ?? "");
    },
    async readOrders() {
      return (await read(`${tab}!A2:T`)).map((r, i) => parseOrderRow(r, i + 2));
    },
    readTab: (name) => read(`${name}!A2:Z`),
    async appendOrder(row) {
      const res = await withRetry(
        () =>
          values.append({
            spreadsheetId,
            range: `${tab}!A:T`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] },
          }),
        retry,
      );
      const rowNumber = rowFromRange(res.data.updates?.updatedRange ?? "");
      return {
        rowNumber,
        link: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=A${rowNumber}:T${rowNumber}`,
      };
    },
    async markNotified(rowNumber, estado, timestamp) {
      await withRetry(
        () =>
          values.update({
            spreadsheetId,
            range: `${tab}!S${rowNumber}:T${rowNumber}`,
            valueInputOption: "RAW",
            requestBody: { values: [[estado, timestamp]] },
          }),
        retry,
      );
    },
    async appendLog(row) {
      await withRetry(
        () =>
          values.append({
            spreadsheetId,
            range: `${LOG_TAB}!A:F`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] },
          }),
        retry,
      );
    },
    async setConfirmed(rowNumber, timestamp) {
      const at = (range: string) => `${tab}!${range}`;
      await withRetry(
        () =>
          values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: "RAW",
              data: [
                { range: at(`C${rowNumber}`), values: [["Confirmado"]] },
                { range: at(`R${rowNumber}`), values: [[timestamp]] },
                { range: at(`S${rowNumber}:T${rowNumber}`), values: [["Confirmado", timestamp]] },
              ],
            },
          }),
        retry,
      );
    },
    async deleteRow(rowNumber) {
      const meta = await withRetry(
        () =>
          client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" }),
        retry,
      );
      const gid = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
      if (gid === undefined || gid === null) throw new Error(`Tab not found: ${tab}`);
      await withRetry(
        () =>
          client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: gid,
                      dimension: "ROWS",
                      startIndex: rowNumber - 1,
                      endIndex: rowNumber,
                    },
                  },
                },
              ],
            },
          }),
        retry,
      );
    },
  };
}
