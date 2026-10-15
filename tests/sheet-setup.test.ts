import { describe, expect, it, vi } from "vitest";
import { HEADERS } from "@/lib/order-row";
import { parsePlantillas } from "@/lib/sheet-templates";
import {
  ENVIOS_HEADERS,
  buildPlantillasRows,
  mergeConfigRows,
  setupSheet,
} from "@/lib/sheet-setup";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { ESTADOS } from "@/lib/validation";

describe("buildPlantillasRows", () => {
  const rows = buildPlantillasRows();
  it("has a header and one row per notifiable state, without the footer or Recibido", () => {
    expect(rows[0]).toEqual(["Estado", "Asunto", "Mensaje"]);
    expect(rows.slice(1).map((r) => r[0])).toEqual(ESTADOS.filter((e) => e !== "Nuevo"));
    for (const r of rows.slice(1)) expect(r[2]).not.toContain("Atentamente");
  });
  it("round-trips through the Plantillas parser", () => {
    const parsed = parsePlantillas(rows.slice(1));
    expect(parsed.get("Listo")).toEqual({
      subject: DEFAULT_TEMPLATES.Listo.subject,
      body: DEFAULT_TEMPLATES.Listo.body,
    });
    expect(parsed.size).toBe(7);
  });
});

describe("mergeConfigRows", () => {
  it("adds missing keys with defaults and keeps what the operator wrote", () => {
    const merged = mergeConfigRows([
      ["Clave", "Valor"],
      ["RETIRO_DIRECCION", "Av. Real 1"],
    ]);
    expect(merged).toContainEqual(["RETIRO_DIRECCION", "Av. Real 1"]);
    expect(merged.find((r) => r[0] === "RETIRO_HORARIO")?.[1]).toMatch(/confirmar/i);
    expect(merged.filter((r) => r[0] === "RETIRO_DIRECCION")).toHaveLength(1);
  });
});

function fakeClient(existing: Record<string, string[][]>) {
  const tabs = Object.keys(existing);
  const get = vi.fn().mockResolvedValue({
    data: { sheets: tabs.map((t, i) => ({ properties: { title: t, sheetId: i + 1 } })) },
  });
  const valuesGet = vi.fn().mockImplementation(async ({ range }: { range: string }) => ({
    data: { values: existing[range.split("!")[0]] ?? [] },
  }));
  const update = vi.fn().mockResolvedValue({ data: {} });
  const batchUpdate = vi
    .fn()
    .mockResolvedValue({ data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] } });
  return {
    client: { spreadsheets: { get, batchUpdate, values: { get: valuesGet, update } } },
    get,
    update,
    batchUpdate,
  };
}

describe("setupSheet", () => {
  const cfg = { sheetId: "SID", sheetTab: "Pedidos" };
  it("creates missing tabs, writes headers and defaults, and installs the Estado dropdown", async () => {
    const f = fakeClient({ Pedidos: [] });
    const report = await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    const writes = f.update.mock.calls.map((c) => c[0]);
    expect(writes.find((w) => w.range === "Pedidos!A1")?.requestBody.values[0]).toEqual([
      ...HEADERS,
    ]);
    expect(writes.find((w) => w.range === "Plantillas!A1")?.requestBody.values).toHaveLength(8);
    expect(writes.find((w) => w.range === "Config!A1")).toBeTruthy();
    const requests = f.batchUpdate.mock.calls.flatMap((c) => c[0].requestBody.requests);
    expect(requests.some((r: Record<string, unknown>) => "addSheet" in r)).toBe(true);
    const validation = requests.find((r: Record<string, unknown>) => "setDataValidation" in r);
    expect(
      validation.setDataValidation.rule.condition.values.map(
        (v: { userEnteredValue: string }) => v.userEnteredValue,
      ),
    ).toEqual([...ESTADOS]);
    expect(report.created).toEqual(expect.arrayContaining(["Plantillas", "Config"]));
  });
  it("never overwrites existing headers or templates the operator edited", async () => {
    const f = fakeClient({
      Pedidos: [["ID Pedido"]],
      Plantillas: [
        ["Estado", "Asunto", "Mensaje"],
        ["Listo", "mi asunto", "mi mensaje"],
      ],
      Config: [
        ["Clave", "Valor"],
        ["RETIRO_DIRECCION", "Calle 1"],
        ["RETIRO_HORARIO", "L-V"],
        ["ENVIO_AUTOMATICO", "SI"],
      ],
      Envíos: [["Fecha"]],
    });
    await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    const ranges = f.update.mock.calls.map((c) => c[0].range);
    expect(ranges).not.toContain("Pedidos!A1");
    expect(ranges).not.toContain("Plantillas!A1");
    expect(ranges).not.toContain("Config!A1");
    expect(ranges).not.toContain("Envíos!A1");
  });
  it("renames the old WhatsApp header in F1 to Teléfono and leaves other headers alone", async () => {
    const f = fakeClient({
      Pedidos: [[...HEADERS].map((h) => (h === "Teléfono" ? "WhatsApp" : h))],
    });
    await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    const w = f.update.mock.calls.map((c) => c[0]).find((c) => c.range === "Pedidos!F1");
    expect(w?.requestBody.values).toEqual([["Teléfono"]]);
    const g = fakeClient({ Pedidos: [[...HEADERS]] });
    await setupSheet(g.client as never, cfg, { sleep: vi.fn() });
    expect(g.update.mock.calls.map((c) => c[0].range)).not.toContain("Pedidos!F1");
  });
  it("creates the Envíos log tab with headers and defaults ENVIO_AUTOMATICO to NO", async () => {
    const f = fakeClient({ Pedidos: [] });
    const report = await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    const writes = f.update.mock.calls.map((c) => c[0]);
    expect(writes.find((w) => w.range === "Envíos!A1")?.requestBody.values[0]).toEqual([
      ...ENVIOS_HEADERS,
    ]);
    expect(report.created).toContain("Envíos");
    expect(writes.find((w) => w.range === "Config!A1")?.requestBody.values).toContainEqual([
      "ENVIO_AUTOMATICO",
      "NO",
    ]);
  });
});
