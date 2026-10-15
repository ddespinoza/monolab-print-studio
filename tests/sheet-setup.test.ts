import { describe, expect, it, vi } from "vitest";
import { HEADERS } from "@/lib/order-row";
import { parsePlantillas } from "@/lib/sheet-templates";
import {
  ENVIOS_HEADERS,
  INGRESOS_HEADERS,
  buildPlantillasRows,
  mergeConfigRows,
  setupSheet,
} from "@/lib/sheet-setup";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { ESTADOS } from "@/lib/validation";

describe("buildPlantillasRows", () => {
  const rows = buildPlantillasRows();
  it("has a header, one row per notifiable state and the Pago mail last, without the footer or Recibido", () => {
    expect(rows[0]).toEqual(["Estado", "Asunto", "Mensaje"]);
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      ...ESTADOS.filter((e) => e !== "Nuevo"),
      "Pago",
    ]);
    for (const r of rows.slice(1)) expect(r[2]).not.toContain("Atentamente");
  });
  it("round-trips through the Plantillas parser", () => {
    const parsed = parsePlantillas(rows.slice(1));
    expect(parsed.get("Listo")).toEqual({
      subject: DEFAULT_TEMPLATES.Listo.subject,
      body: DEFAULT_TEMPLATES.Listo.body,
    });
    expect(parsed.size).toBe(8);
    expect(parsed.get("Pago")?.body).toContain("{{datosPago}}");
  });
});

describe("mergeConfigRows", () => {
  it("adds missing keys with defaults and keeps what the operator wrote", () => {
    const merged = mergeConfigRows([
      ["Clave", "Valor"],
      ["RETIRO_DIRECCION", "Av. Real 1"],
    ]);
    expect(merged).toContainEqual(["RETIRO_DIRECCION", "Av. Real 1"]);
    expect(merged.find((r) => r[0] === "RETIRO_HORARIO")?.[1]).toMatch(/previa coordinación/i);
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
    expect(writes.find((w) => w.range === "Plantillas!A1")?.requestBody.values).toHaveLength(9);
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
        ["ELIMINAR_ARCHIVOS_DIAS", "45"],
        ["BANCO_TITULAR", ""],
        ["BANCO_RUT", ""],
        ["BANCO_BANCO", ""],
        ["BANCO_TIPO_CUENTA", ""],
        ["BANCO_CUENTA", ""],
        ["BANCO_CORREO", ""],
      ],
      Ingresos: [["Fecha"]],
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
  it("adds the Enviar header in U1 and a checkbox column, without touching an existing U1", async () => {
    const f = fakeClient({ Pedidos: [] });
    await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    const u1 = f.update.mock.calls.map((c) => c[0]).find((c) => c.range === "Pedidos!U1");
    expect(u1?.requestBody.values).toEqual([["Enviar"]]);
    const requests = f.batchUpdate.mock.calls.flatMap((c) => c[0].requestBody.requests);
    const boxes = requests.find(
      (r: { setDataValidation?: { rule: { condition: { type: string } } } }) =>
        r.setDataValidation?.rule.condition.type === "BOOLEAN",
    );
    expect(boxes.setDataValidation.range).toMatchObject({
      startColumnIndex: 20,
      endColumnIndex: 21,
      startRowIndex: 1,
    });
    const g = fakeClient({ Pedidos: [[...HEADERS, "Enviar"]] });
    await setupSheet(g.client as never, cfg, { sleep: vi.fn() });
    expect(g.update.mock.calls.map((c) => c[0].range)).not.toContain("Pedidos!U1");
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
    expect(writes.find((w) => w.range === "Config!A1")?.requestBody.values).toContainEqual([
      "ELIMINAR_ARCHIVOS_DIAS",
      "30",
    ]);
  });
});

describe("setupSheet: payment additions", () => {
  const cfg = { sheetId: "SID", sheetTab: "Pedidos" };
  const run = async (existing: Record<string, string[][]>) => {
    const f = fakeClient(existing);
    const report = await setupSheet(f.client as never, cfg, { sleep: vi.fn() });
    return { f, report, writes: f.update.mock.calls.map((c) => c[0]) };
  };
  it("adds the Pago and Fecha compromiso headers in V1 and W1 without touching existing ones", async () => {
    const { writes } = await run({ Pedidos: [[...HEADERS, "Enviar"]] });
    expect(writes.find((w) => w.range === "Pedidos!V1")?.requestBody.values).toEqual([["Pago"]]);
    expect(writes.find((w) => w.range === "Pedidos!W1")?.requestBody.values).toEqual([
      ["Fecha compromiso"],
    ]);
    const done = await run({ Pedidos: [[...HEADERS, "Enviar", "Pago", "Fecha compromiso"]] });
    const ranges = done.writes.map((w) => w.range);
    expect(ranges).not.toContain("Pedidos!V1");
    expect(ranges).not.toContain("Pedidos!W1");
  });
  it("creates the Ingresos ledger tab with headers", async () => {
    const { writes, report } = await run({ Pedidos: [] });
    expect(report.created).toContain("Ingresos");
    expect(writes.find((w) => w.range === "Ingresos!A1")?.requestBody.values[0]).toEqual([
      ...INGRESOS_HEADERS,
    ]);
  });
  it("seeds the six empty BANCO_* keys in Config and keeps filled ones", () => {
    const merged = mergeConfigRows([
      ["Clave", "Valor"],
      ["BANCO_RUT", "11.111.111-1"],
    ]);
    for (const key of [
      "BANCO_TITULAR",
      "BANCO_BANCO",
      "BANCO_TIPO_CUENTA",
      "BANCO_CUENTA",
      "BANCO_CORREO",
    ])
      expect(merged).toContainEqual([key, ""]);
    expect(merged).toContainEqual(["BANCO_RUT", "11.111.111-1"]);
    expect(merged.filter((r) => r[0] === "BANCO_RUT")).toHaveLength(1);
  });
  it("appends the missing Pago template below the operator's rows and never edits theirs", async () => {
    const { writes } = await run({
      Pedidos: [],
      Plantillas: [
        ["Estado", "Asunto", "Mensaje"],
        ["Listo", "mi asunto", "mi mensaje"],
      ],
    });
    const w = writes.find((x) => x.range === "Plantillas!A3");
    expect(w?.requestBody.values).toEqual([
      ["Pago", DEFAULT_TEMPLATES.Pago.subject, DEFAULT_TEMPLATES.Pago.body],
    ]);
    expect(writes.map((x) => x.range)).not.toContain("Plantillas!A1");
  });
  it("does not add Pago again when the operator already has it", async () => {
    const { writes } = await run({
      Pedidos: [],
      Plantillas: [
        ["Estado", "Asunto", "Mensaje"],
        ["Pago", "x", "y"],
      ],
    });
    expect(writes.some((x) => x.range.startsWith("Plantillas!"))).toBe(false);
  });
});
