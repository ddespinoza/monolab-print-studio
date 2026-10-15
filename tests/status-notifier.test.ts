import { describe, expect, it, vi } from "vitest";
import { findPending, runTick, type TickDeps } from "@/lib/status-notifier";
import type { OrderRow } from "@/lib/order-row";

const base: OrderRow = {
  rowNumber: 2,
  id: "ML-0001",
  fecha: "",
  estado: "En cola",
  nombre: "Ana",
  email: "ana@example.com",
  whatsapp: "+56 9",
  ciudad: "X",
  entrega: "Retiro",
  drive: "",
  nArchivos: "1",
  volumen: "1.0",
  detalle: "a.stl — 1.0 cm³ (1×1×1)",
  material: "PLA",
  color: "",
  relleno: "20",
  cantidad: "1",
  notas: "",
  notificado: "Nuevo",
  ultima: "",
};
const row = (patch: Partial<OrderRow>): OrderRow => ({ ...base, ...patch });

describe("findPending", () => {
  it("picks rows whose Estado differs from Estado notificado", () => {
    expect(findPending([row({})]).map((p) => p.order.id)).toEqual(["ML-0001"]);
  });
  it("skips Nuevo, already-notified, blank, unknown and email-less rows", () => {
    const rows = [
      row({ estado: "Nuevo", notificado: "" }),
      row({ estado: "Listo", notificado: "Listo" }),
      row({ estado: "" }),
      row({ estado: "Enviado" }),
      row({ email: " " }),
    ];
    expect(findPending(rows)).toEqual([]);
  });
  it("re-notifies when Estado notificado is cleared", () => {
    expect(findPending([row({ estado: "Listo", notificado: "" })])).toHaveLength(1);
  });
});

function deps(orders: OrderRow[], over: Partial<TickDeps> = {}): TickDeps {
  return {
    readOrders: vi.fn().mockResolvedValue(orders),
    readTemplates: vi.fn().mockResolvedValue(new Map()),
    readConfig: vi.fn().mockResolvedValue({ RETIRO_DIRECCION: "Calle 1", RETIRO_HORARIO: "L-V" }),
    send: vi.fn().mockResolvedValue(undefined),
    markNotified: vi.fn().mockResolvedValue(undefined),
    sweep: vi.fn().mockResolvedValue(3),
    siteUrl: "https://monolabprintstudio.cl",
    whatsappNumber: "56912345678",
    now: () => new Date("2025-06-12T18:03:00Z"),
    ...over,
  };
}

describe("runTick", () => {
  it("sends one email per pending row, marks it, and reports counts", async () => {
    const d = deps([row({}), row({ rowNumber: 3, id: "ML-0002", estado: "Listo" })]);
    const r = await runTick(d);
    expect(r).toEqual({ processed: 2, failed: 0, swept: 3, fallbacks: 2 });
    expect(d.send).toHaveBeenCalledTimes(2);
    expect(d.markNotified).toHaveBeenCalledWith(3, "Listo", "2025-06-12 14:03");
    const mail = vi.mocked(d.send).mock.calls[1][0];
    expect(mail.to).toBe("ana@example.com");
    expect(mail.subject).toBe("Pedido ML-0002 — listo para entrega");
    expect(mail.text).toContain("Retiro en: Calle 1");
  });
  it("uses a Plantillas override and counts no fallback", async () => {
    const d = deps([row({})], {
      readTemplates: vi
        .fn()
        .mockResolvedValue(
          new Map([
            ["En cola", { subject: "Pedido {{orderId}} — custom", body: "Hola {{nombre}}" }],
          ]),
        ),
    });
    const r = await runTick(d);
    expect(r.fallbacks).toBe(0);
    expect(vi.mocked(d.send).mock.calls[0][0].subject).toBe("Pedido ML-0001 — custom");
  });
  it("does not mark a row when sending fails, and continues", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp")).mockResolvedValue(undefined);
    const d = deps([row({}), row({ rowNumber: 3, id: "ML-0002" })], { send });
    const r = await runTick(d);
    expect(r).toMatchObject({ processed: 1, failed: 1 });
    expect(d.markNotified).toHaveBeenCalledTimes(1);
    expect(d.markNotified).toHaveBeenCalledWith(3, "En cola", expect.any(String));
  });
  it("is idempotent: nothing pending means nothing sent", async () => {
    const d = deps([row({ notificado: "En cola" })]);
    expect(await runTick(d)).toEqual({ processed: 0, failed: 0, swept: 3, fallbacks: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });
  it("rejects overlapping ticks", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const d = deps([row({})], { send: vi.fn().mockReturnValue(gate) });
    const first = runTick(d);
    await expect(runTick(d)).rejects.toThrow(/already running/);
    release();
    await first;
    await expect(runTick(deps([]))).resolves.toBeDefined();
  });
});
