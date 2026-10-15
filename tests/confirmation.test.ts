import { describe, expect, it, vi } from "vitest";
import { confirmOrder, viewConfirmation, type ConfirmDeps } from "@/lib/confirmation";
import { signConfirmToken } from "@/lib/confirm-token";
import type { OrderRow } from "@/lib/order-row";

const secret = "s".repeat(32);
const order: OrderRow = {
  rowNumber: 4,
  id: "ML-0001",
  fecha: "",
  estado: "Cotizado",
  nombre: "Dra. Gómez",
  email: "doc@example.com",
  telefono: "+56 9",
  paciente: "A. P.",
  entrega: "Flash",
  tarifa: "10000",
  drive: "https://drive/x",
  nArchivos: "2",
  volumen: "108.4",
  detalle: "a.stl — 1.0 cm³ (1×1×1)",
  resina: "Estándar",
  cantidad: "2",
  notas: "",
  cotizacion: "$45.000 CLP",
  confirmado: "",
  notificado: "Cotizado",
  ultima: "",
};
const token = signConfirmToken("ML-0001", order.cotizacion, secret);

function deps(rows: OrderRow[] = [order]): ConfirmDeps {
  return {
    secret,
    readOrders: vi.fn().mockResolvedValue(rows),
    setConfirmed: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    readTemplates: vi.fn().mockResolvedValue(new Map()),
    readConfig: vi.fn().mockResolvedValue({
      RETIRO_DIRECCION: "Calle 1",
      RETIRO_HORARIO: "L-V",
      ENVIO_AUTOMATICO: "NO",
    }),
    siteUrl: "https://monolabprintstudio.cl",
    whatsappNumber: "56948623705",
    operatorEmail: "ops@example.com",
    sheetLink: (n) => `https://sheet/#${n}`,
    now: () => new Date("2025-06-12T18:03:00Z"),
  };
}

describe("viewConfirmation", () => {
  it("returns the order id and quote for a valid link", async () => {
    expect(await viewConfirmation(token, deps())).toEqual({
      status: "ready",
      orderId: "ML-0001",
      cotizacion: "$45.000 CLP",
    });
  });
  it("is invalid for a bad token or an unknown order", async () => {
    expect(await viewConfirmation("nope", deps())).toEqual({ status: "invalid" });
    expect(await viewConfirmation(token, deps([]))).toEqual({ status: "invalid" });
  });
  it("reports already-confirmed when Estado is no longer Cotizado", async () => {
    expect(await viewConfirmation(token, deps([{ ...order, estado: "Confirmado" }]))).toEqual({
      status: "done",
      orderId: "ML-0001",
      estado: "Confirmado",
    });
  });
  it("carries the current Estado so the page can show how far the order is", async () => {
    for (const estado of ["En cola", "Imprimiendo", "Listo", "Entregado"])
      expect(await viewConfirmation(token, deps([{ ...order, estado }]))).toMatchObject({
        status: "done",
        estado,
      });
  });
  it("is invalid if the quote changed after the email was sent", async () => {
    expect(await viewConfirmation(token, deps([{ ...order, cotizacion: "$99.000" }]))).toEqual({
      status: "invalid",
    });
  });
});

describe("confirmOrder", () => {
  it("marks the row, emails the customer, and notifies the operator", async () => {
    const d = deps();
    expect(await confirmOrder(token, d)).toEqual({ status: "confirmed", orderId: "ML-0001" });
    expect(d.setConfirmed).toHaveBeenCalledWith(4, "2025-06-12 14:03");
    const mails = vi.mocked(d.send).mock.calls.map((c) => c[0]);
    expect(mails.map((m) => m.to)).toEqual(["doc@example.com", "ops@example.com"]);
    expect(mails[0].subject).toBe("Pedido ML-0001 — cotización confirmada");
    expect(mails[1].subject).toContain("ML-0001");
    expect(mails[1].text).toContain("https://sheet/#4");
  });
  it("does nothing for an invalid or already-confirmed link", async () => {
    const d = deps([{ ...order, estado: "Confirmado" }]);
    expect(await confirmOrder(token, d)).toEqual({
      status: "done",
      orderId: "ML-0001",
      estado: "Confirmado",
    });
    expect(d.setConfirmed).not.toHaveBeenCalled();
    const d2 = deps();
    expect(await confirmOrder("bad", d2)).toEqual({ status: "invalid" });
    expect(d2.setConfirmed).not.toHaveBeenCalled();
  });
  it("still confirms when the customer email fails, and reports it", async () => {
    const d = deps();
    vi.mocked(d.send).mockRejectedValueOnce(new Error("smtp")).mockResolvedValue(undefined);
    expect(await confirmOrder(token, d)).toEqual({ status: "confirmed", orderId: "ML-0001" });
    expect(d.setConfirmed).toHaveBeenCalled();
  });
});
