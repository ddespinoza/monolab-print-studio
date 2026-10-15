import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/order-row";
import { findPurgeable } from "@/lib/retention";

const DRIVE = "https://drive.google.com/drive/folders/1AbC-dEf_9";
const base: OrderRow = {
  rowNumber: 2,
  id: "ML-0001",
  fecha: "2025-04-01 10:00",
  estado: "Entregado",
  nombre: "Ana",
  email: "ana@example.com",
  telefono: "",
  paciente: "A. P.",
  entrega: "Normal",
  tarifa: "7500",
  drive: DRIVE,
  nArchivos: "1",
  volumen: "1.0",
  detalle: "",
  resina: "Estándar",
  cantidad: "1",
  notas: "",
  cotizacion: "",
  confirmado: "",
  notificado: "Entregado",
  ultima: "2025-05-13 14:00",
};
const row = (patch: Partial<OrderRow>): OrderRow => ({ ...base, ...patch });
// 2025-06-12 14:00 in Santiago (UTC-4)
const NOW = new Date("2025-06-12T18:00:00Z");

describe("findPurgeable", () => {
  it("picks finished orders whose finishing email is at least N days old", () => {
    expect(findPurgeable([row({})], NOW, 30)).toHaveLength(1);
    expect(
      findPurgeable([row({ estado: "Cancelado", notificado: "Cancelado" })], NOW, 30),
    ).toHaveLength(1);
  });
  it("treats exactly N days as due and one minute less as not due", () => {
    expect(findPurgeable([row({ ultima: "2025-05-13 14:00" })], NOW, 30)).toHaveLength(1);
    expect(findPurgeable([row({ ultima: "2025-05-13 14:01" })], NOW, 30)).toHaveLength(0);
  });
  it("uses the configured number of days", () => {
    expect(findPurgeable([row({ ultima: "2025-06-05 14:00" })], NOW, 7)).toHaveLength(1);
    expect(findPurgeable([row({ ultima: "2025-06-05 14:00" })], NOW, 8)).toHaveLength(0);
  });
  it("is off when days is 0 or negative", () => {
    expect(findPurgeable([row({})], NOW, 0)).toEqual([]);
    expect(findPurgeable([row({})], NOW, -1)).toEqual([]);
  });
  it("ignores orders that are not finished", () => {
    for (const estado of ["Nuevo", "Cotizado", "Confirmado", "En cola", "Imprimiendo", "Listo"])
      expect(findPurgeable([row({ estado, notificado: estado })], NOW, 30)).toEqual([]);
  });
  it("ignores orders whose finishing email was not sent (clock not started)", () => {
    expect(findPurgeable([row({ notificado: "Listo" })], NOW, 30)).toEqual([]);
    expect(findPurgeable([row({ ultima: "" })], NOW, 30)).toEqual([]);
    expect(findPurgeable([row({ ultima: "ayer" })], NOW, 30)).toEqual([]);
  });
  it("ignores already deleted files and rows without a folder", () => {
    expect(findPurgeable([row({ drive: "Eliminado 2025-06-01 10:00" })], NOW, 30)).toEqual([]);
    expect(findPurgeable([row({ drive: "" })], NOW, 30)).toEqual([]);
  });
  it("accepts mock folder links", () => {
    expect(findPurgeable([row({ drive: "mock://drive/ML-0001" })], NOW, 30)).toHaveLength(1);
  });
  it("returns the oldest first", () => {
    const a = row({ id: "ML-0002", rowNumber: 3, ultima: "2025-04-01 09:00" });
    const b = row({ id: "ML-0003", rowNumber: 4, ultima: "2025-03-01 09:00" });
    expect(findPurgeable([a, b], NOW, 30).map((o) => o.id)).toEqual(["ML-0003", "ML-0002"]);
  });
});
