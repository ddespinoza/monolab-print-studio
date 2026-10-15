import { describe, expect, it, vi } from "vitest";
import { manualSend, type ManualSendDeps } from "@/lib/manual-send";
import type { OrderRow } from "@/lib/order-row";

const base: OrderRow = {
  rowNumber: 2,
  id: "ML-0001",
  fecha: "",
  estado: "Listo",
  nombre: "Ana",
  email: "ana@example.com",
  telefono: "+56 9",
  paciente: "A. P.",
  entrega: "Flash",
  tarifa: "10000",
  drive: "",
  nArchivos: "1",
  volumen: "1.0",
  detalle: "a.stl — 1.0 cm³ (1×1×1)",
  resina: "Estándar",
  cantidad: "1",
  notas: "",
  cotizacion: "",
  confirmado: "",
  notificado: "En cola",
  ultima: "",
};
const DRIVE = "https://drive.google.com/drive/folders/1AbC-dEf_9";
const row = (patch: Partial<OrderRow>): OrderRow => ({ ...base, ...patch });

function deps(orders: OrderRow[], over: Partial<ManualSendDeps> = {}): ManualSendDeps {
  return {
    readOrders: vi.fn().mockResolvedValue(orders),
    readTemplates: vi.fn().mockResolvedValue(new Map()),
    readConfig: vi.fn().mockResolvedValue({
      RETIRO_DIRECCION: "Calle 1",
      RETIRO_HORARIO: "L-V",
      ENVIO_AUTOMATICO: "NO",
    }),
    send: vi.fn().mockResolvedValue(undefined),
    markNotified: vi.fn().mockResolvedValue(undefined),
    sweep: vi.fn().mockResolvedValue(0),
    confirmLink: (o: OrderRow) => `https://monolabprintstudio.cl/confirmar/${o.id}.tok`,
    siteUrl: "https://monolabprintstudio.cl",
    whatsappNumber: "56912345678",
    now: () => new Date("2025-06-12T18:03:00Z"),
    operatorEmail: "op@example.com",
    logSend: vi.fn().mockResolvedValue(undefined),
    removeFolder: vi.fn().mockResolvedValue(undefined),
    markFilesDeleted: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("manualSend: one order", () => {
  it("sends the template for the row's current Estado, marks it and logs it", async () => {
    const d = deps([row({})]);
    const { results } = await manualSend(d, { action: "row", orderId: "ML-0001" });
    expect(results).toEqual([
      expect.objectContaining({ orderId: "ML-0001", estado: "Listo", status: "sent" }),
    ]);
    const mail = vi.mocked(d.send).mock.calls[0][0];
    expect(mail.to).toBe("ana@example.com");
    expect(mail.subject).toBe("Pedido ML-0001 — listo para entrega");
    expect(mail.text).toContain("Retiro en: Calle 1");
    expect(d.markNotified).toHaveBeenCalledWith(2, "Listo", "2025-06-12 14:03");
    expect(d.logSend).toHaveBeenCalledWith([
      "2025-06-12 14:03",
      "ML-0001",
      "Listo",
      "ana@example.com",
      "Enviado",
      "Botón",
    ]);
  });
  it("sends the quote with the confirm link", async () => {
    const d = deps([row({ estado: "Cotizado", cotizacion: "$45.000 CLP" })]);
    await manualSend(d, { action: "row", orderId: "ML-0001" });
    const mail = vi.mocked(d.send).mock.calls[0][0];
    expect(mail.subject).toBe("Pedido ML-0001 — cotización");
    expect(mail.text).toContain("$45.000 CLP");
    expect(mail.text).toContain("https://monolabprintstudio.cl/confirmar/ML-0001.tok");
  });
  it("refuses unknown orders, Nuevo, missing email and Cotizado without a quote", async () => {
    const cases: [OrderRow[], string][] = [
      [[row({})], "ML-9999"],
      [[row({ estado: "Nuevo" })], "ML-0001"],
      [[row({ email: " " })], "ML-0001"],
      [[row({ estado: "Cotizado", cotizacion: " " })], "ML-0001"],
    ];
    for (const [orders, orderId] of cases) {
      const d = deps(orders);
      const { results } = await manualSend(d, { action: "row", orderId });
      expect(results[0].status).toBe("refused");
      expect(results[0].message.length).toBeGreaterThan(5);
      expect(d.send).not.toHaveBeenCalled();
      expect(d.markNotified).not.toHaveBeenCalled();
    }
  });
  it("asks before repeating an email already sent, and sends when forced", async () => {
    const orders = [row({ notificado: "Listo" })];
    const d = deps(orders);
    expect((await manualSend(d, { action: "row", orderId: "ML-0001" })).results[0].status).toBe(
      "already_sent",
    );
    expect(d.send).not.toHaveBeenCalled();
    const forced = await manualSend(d, { action: "row", orderId: "ML-0001", force: true });
    expect(forced.results[0].status).toBe("sent");
    expect(d.send).toHaveBeenCalledTimes(1);
  });
  it("reports a send failure without marking the row, and logs it", async () => {
    const d = deps([row({})], { send: vi.fn().mockRejectedValue(new Error("smtp down")) });
    const { results } = await manualSend(d, { action: "row", orderId: "ML-0001" });
    expect(results[0].status).toBe("failed");
    expect(d.markNotified).not.toHaveBeenCalled();
    expect(vi.mocked(d.logSend).mock.calls[0][0][4]).toBe("Falló");
  });
  it("still reports sent when only the sheet write-back fails", async () => {
    const d = deps([row({})], { markNotified: vi.fn().mockRejectedValue(new Error("quota")) });
    const { results } = await manualSend(d, { action: "row", orderId: "ML-0001" });
    expect(results[0].status).toBe("sent");
    expect(results[0].message).toMatch(/registrar/i);
  });
  it("does not fail when the log write fails", async () => {
    const d = deps([row({})], { logSend: vi.fn().mockRejectedValue(new Error("quota")) });
    expect((await manualSend(d, { action: "row", orderId: "ML-0001" })).results[0].status).toBe(
      "sent",
    );
  });
});

describe("manualSend: preview", () => {
  it("sends to the operator only, prefixed, without marking the row", async () => {
    const d = deps([row({ notificado: "Listo" })]);
    const { results } = await manualSend(d, { action: "test", orderId: "ML-0001" });
    expect(results[0].status).toBe("test_sent");
    const mail = vi.mocked(d.send).mock.calls[0][0];
    expect(mail.to).toBe("op@example.com");
    expect(mail.subject).toBe("[PRUEBA] Pedido ML-0001 — listo para entrega");
    expect(d.markNotified).not.toHaveBeenCalled();
    expect(vi.mocked(d.logSend).mock.calls[0][0][5]).toBe("Prueba");
  });
});

describe("manualSend: pending", () => {
  it("sends every pending order, one failure does not stop the rest", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp")).mockResolvedValue(undefined);
    const d = deps(
      [
        row({ id: "ML-0001" }),
        row({ rowNumber: 3, id: "ML-0002" }),
        row({ rowNumber: 4, id: "ML-0003", notificado: "Listo" }),
        row({ rowNumber: 5, id: "ML-0004", estado: "Cotizado", cotizacion: "" }),
      ],
      { send },
    );
    const { results } = await manualSend(d, { action: "pending" });
    expect(results.map((r) => [r.orderId, r.status])).toEqual([
      ["ML-0001", "failed"],
      ["ML-0002", "sent"],
      ["ML-0004", "refused"],
    ]);
  });
  it("returns an empty result when nothing is pending", async () => {
    expect(
      (await manualSend(deps([row({ notificado: "Listo" })]), { action: "pending" })).results,
    ).toEqual([]);
  });
  it("sends at most 50 per call", async () => {
    const orders = Array.from({ length: 60 }, (_, i) => row({ rowNumber: i + 2, id: `ML-${i}` }));
    const d = deps(orders);
    const { results } = await manualSend(d, { action: "pending" });
    expect(results).toHaveLength(50);
  });
});

describe("manualSend: concurrency", () => {
  it("rejects a second call while one is running", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const d = deps([row({})], { send: vi.fn().mockReturnValue(gate) });
    const first = manualSend(d, { action: "row", orderId: "ML-0001" });
    await expect(manualSend(d, { action: "pending" })).rejects.toThrow(/already running/);
    release();
    await first;
  });
});

describe("manualSend: purge (delete an order's files)", () => {
  const finished = (patch: Partial<OrderRow> = {}) =>
    row({ estado: "Entregado", drive: DRIVE, ...patch });

  it("deletes the Drive folder of a delivered order, marks the row and logs it", async () => {
    const d = deps([finished()]);
    const { results } = await manualSend(d, { action: "purge", orderId: "ML-0001" });
    expect(results[0]).toMatchObject({ orderId: "ML-0001", status: "purged" });
    expect(results[0].message).toMatch(/eliminados/i);
    expect(d.removeFolder).toHaveBeenCalledWith("1AbC-dEf_9");
    expect(d.markFilesDeleted).toHaveBeenCalledWith(2, "Eliminado 2025-06-12 14:03");
    expect(d.send).not.toHaveBeenCalled();
    expect(d.logSend).toHaveBeenCalledWith([
      "2025-06-12 14:03",
      "ML-0001",
      "Entregado",
      "ana@example.com",
      "Archivos eliminados",
      "Eliminación",
    ]);
  });
  it("also works for cancelled orders and for the mock drive link", async () => {
    const d = deps([finished({ estado: "Cancelado", drive: "mock://drive/ML-0001_-_A.P." })]);
    expect((await manualSend(d, { action: "purge", orderId: "ML-0001" })).results[0].status).toBe(
      "purged",
    );
    expect(d.removeFolder).toHaveBeenCalledWith("ML-0001_-_A.P.");
  });
  it.each(["Nuevo", "Cotizado", "Confirmado", "En cola", "Imprimiendo", "Listo"])(
    "refuses while the order is %s",
    async (estado) => {
      const d = deps([finished({ estado, cotizacion: "x" })]);
      const { results } = await manualSend(d, { action: "purge", orderId: "ML-0001" });
      expect(results[0].status).toBe("refused");
      expect(results[0].message).toMatch(/Entregado o Cancelado/);
      expect(d.removeFolder).not.toHaveBeenCalled();
    },
  );
  it("refuses an unknown order, an already-deleted order and a row without a folder", async () => {
    const d = deps([
      finished({ drive: "Eliminado 2025-06-10 09:00" }),
      finished({ id: "ML-0002", rowNumber: 3, drive: "" }),
    ]);
    expect((await manualSend(d, { action: "purge", orderId: "ML-9999" })).results[0].status).toBe(
      "refused",
    );
    const done = (await manualSend(d, { action: "purge", orderId: "ML-0001" })).results[0];
    expect(done).toMatchObject({ status: "refused" });
    expect(done.message).toMatch(/ya fueron eliminados/i);
    const none = (await manualSend(d, { action: "purge", orderId: "ML-0002" })).results[0];
    expect(none.status).toBe("refused");
    expect(none.message).toMatch(/carpeta/i);
    expect(d.removeFolder).not.toHaveBeenCalled();
  });
  it("does not mark the row when Drive refuses, and reports failure", async () => {
    const d = deps([finished()], { removeFolder: vi.fn().mockRejectedValue(new Error("403")) });
    const { results } = await manualSend(d, { action: "purge", orderId: "ML-0001" });
    expect(results[0].status).toBe("failed");
    expect(d.markFilesDeleted).not.toHaveBeenCalled();
    expect(vi.mocked(d.logSend).mock.calls[0][0][4]).toBe("Falló");
  });
  it("still reports purged, with a warning, when only the sheet write-back fails", async () => {
    const d = deps([finished()], {
      markFilesDeleted: vi.fn().mockRejectedValue(new Error("quota")),
    });
    const { results } = await manualSend(d, { action: "purge", orderId: "ML-0001" });
    expect(results[0].status).toBe("purged");
    expect(results[0].message).toMatch(/planilla/i);
  });
});
