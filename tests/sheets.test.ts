import { describe, expect, it, vi } from "vitest";
import { createSheetsApi, rowFromRange } from "@/lib/sheets";

function fake(over: Record<string, unknown> = {}) {
  const values = {
    get: vi.fn().mockResolvedValue({ data: { values: [["ML-0001"], ["ML-0002"]] } }),
    append: vi.fn().mockResolvedValue({ data: { updates: { updatedRange: "Pedidos!A5:T5" } } }),
    update: vi.fn().mockResolvedValue({ data: {} }),
    ...over,
  };
  const get = vi
    .fn()
    .mockResolvedValue({ data: { sheets: [{ properties: { title: "Pedidos", sheetId: 42 } }] } });
  const batchUpdate = vi.fn().mockResolvedValue({ data: {} });
  return { client: { spreadsheets: { values, get, batchUpdate } }, values, get, batchUpdate };
}

describe("rowFromRange", () => {
  it("extracts the first row number", () => {
    expect(rowFromRange("Pedidos!A5:T5")).toBe(5);
    expect(rowFromRange("'Mi Tab'!A12:S12")).toBe(12);
    expect(() => rowFromRange("garbage")).toThrow();
  });
});

describe("createSheetsApi", () => {
  const cfg = { sheetId: "SID", sheetTab: "Pedidos" };
  it("reads the ID column without the header", async () => {
    const { client, values } = fake();
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    expect(await api.readIds()).toEqual(["ML-0001", "ML-0002"]);
    expect(values.get).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: "SID", range: "Pedidos!A2:A" }),
    );
  });
  it("appends RAW and returns the row number and a direct link", async () => {
    const { client, values } = fake();
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    const r = await api.appendOrder(["ML-0003"]);
    expect(r).toEqual({
      rowNumber: 5,
      link: "https://docs.google.com/spreadsheets/d/SID/edit#gid=0&range=A5:T5",
    });
    expect(values.append).toHaveBeenCalledWith(
      expect.objectContaining({
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        range: "Pedidos!A:T",
        requestBody: { values: [["ML-0003"]] },
      }),
    );
  });
  it("reads orders from row 2 with row numbers", async () => {
    const { client } = fake({
      get: vi.fn().mockResolvedValue({ data: { values: [["ML-0001", "f", "Nuevo"]] } }),
    });
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    const orders = await api.readOrders();
    expect(orders[0]).toMatchObject({ rowNumber: 2, id: "ML-0001", estado: "Nuevo" });
  });
  it("writes Estado notificado and Última notificación in one update", async () => {
    const { client, values } = fake();
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    await api.markNotified(7, "Listo", "2025-06-12 14:03");
    expect(values.update).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "Pedidos!S7:T7",
        valueInputOption: "RAW",
        requestBody: { values: [["Listo", "2025-06-12 14:03"]] },
      }),
    );
  });
  it("writes the files-deleted mark into the Archivos (Drive) cell as plain text", async () => {
    const { client, values } = fake();
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    await api.markFilesDeleted(7, "Eliminado 2025-06-12 14:03");
    expect(values.update).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "Pedidos!J7",
        valueInputOption: "RAW",
        requestBody: { values: [["Eliminado 2025-06-12 14:03"]] },
      }),
    );
  });
  it("appends a send-log row to the Envíos tab as plain text", async () => {
    const { client, values } = fake();
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    await api.appendLog(["2025-06-12 14:03", "ML-0001", "Listo"]);
    expect(values.append).toHaveBeenCalledWith(
      expect.objectContaining({
        range: "Envíos!A:F",
        valueInputOption: "RAW",
        requestBody: { values: [["2025-06-12 14:03", "ML-0001", "Listo"]] },
      }),
    );
  });
  it("confirms an order: Estado, Confirmado, notified marks, in one batch", async () => {
    const batchUpdate = vi.fn().mockResolvedValue({ data: {} });
    const { client } = fake();
    (client.spreadsheets.values as unknown as Record<string, unknown>).batchUpdate = batchUpdate;
    await createSheetsApi(client as never, cfg, { sleep: vi.fn() }).setConfirmed(
      9,
      "2025-06-12 14:03",
    );
    expect(batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: "SID",
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: "Pedidos!C9", values: [["Confirmado"]] },
          { range: "Pedidos!R9", values: [["2025-06-12 14:03"]] },
          { range: "Pedidos!S9:T9", values: [["Confirmado", "2025-06-12 14:03"]] },
        ],
      },
    });
  });
  it("reads other tabs, skipping the header", async () => {
    const { client, values } = fake({
      get: vi.fn().mockResolvedValue({ data: { values: [["En cola", "a", "b"]] } }),
    });
    const api = createSheetsApi(client as never, cfg, { sleep: vi.fn() });
    expect(await api.readTab("Plantillas")).toEqual([["En cola", "a", "b"]]);
    expect(values.get).toHaveBeenCalledWith(expect.objectContaining({ range: "Plantillas!A2:Z" }));
  });
  it("retries transient failures", async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue({ data: { values: [] } });
    const { client } = fake({ get });
    const api = createSheetsApi(client as never, cfg, {
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    expect(await api.readIds()).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("deletes a row by looking up the tab's gid", async () => {
    const { client, batchUpdate } = fake();
    await createSheetsApi(client as never, cfg, { sleep: vi.fn() }).deleteRow(7);
    expect(batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: "SID",
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId: 42, dimension: "ROWS", startIndex: 6, endIndex: 7 },
            },
          },
        ],
      },
    });
  });
});
