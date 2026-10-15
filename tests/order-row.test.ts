import { describe, expect, it } from "vitest";
import type { OrderInput } from "@/lib/validation";
import { HEADERS, buildOrderRow, parseOrderRow } from "@/lib/order-row";

const order: OrderInput = {
  nombre: '=HYPERLINK("x")',
  email: "ana@example.com",
  whatsapp: "+57 300 123 4567",
  ciudad: "Medellín",
  material: "PETG",
  color: "Negro",
  relleno: 20,
  cantidad: 2,
  notas: "+cmd",
  empresa: "",
  files: [
    { token: "a".repeat(32), name: "caja.stl", volumeCm3: 96.3, size: { x: 120, y: 80, z: 40 } },
    { token: "b".repeat(32), name: "tapa.stl", volumeCm3: 12.1, size: { x: 60, y: 40, z: 20 } },
  ],
};

describe("buildOrderRow", () => {
  const row = buildOrderRow({
    id: "ML-0001",
    fecha: "2025-06-12 14:03",
    order,
    driveLink: "https://drive/x",
  });
  it("has 19 columns matching the headers", () => {
    expect(HEADERS).toHaveLength(19);
    expect(row).toHaveLength(19);
    expect(row.slice(0, 3)).toEqual(["ML-0001", "2025-06-12 14:03", "Nuevo"]);
  });
  it("sums volume, counts files and writes per-file detail", () => {
    expect(row[9]).toBe("2");
    expect(row[10]).toBe("108.4");
    expect(row[11]).toBe("caja.stl — 96.3 cm³ (120×80×40)\ntapa.stl — 12.1 cm³ (60×40×20)");
  });
  it("neutralises formulas in user text", () => {
    expect(row[3].startsWith("'")).toBe(true);
    expect(row[16]).toBe("'+cmd");
  });
  it("marks Nuevo as already notified and pickup delivery", () => {
    expect(row[7]).toBe("Retiro");
    expect(row[17]).toBe("Nuevo");
    expect(row[18]).toBe("2025-06-12 14:03");
  });
});

describe("parseOrderRow", () => {
  it("round-trips and tolerates short rows", () => {
    const built = buildOrderRow({
      id: "ML-0001",
      fecha: "f",
      order: { ...order, nombre: "Ana", notas: "" },
      driveLink: "d",
    });
    const parsed = parseOrderRow(built, 5);
    expect(parsed).toMatchObject({
      rowNumber: 5,
      id: "ML-0001",
      estado: "Nuevo",
      nombre: "Ana",
      email: "ana@example.com",
      notificado: "Nuevo",
    });
    expect(parseOrderRow(["ML-0002"], 6)).toMatchObject({
      id: "ML-0002",
      estado: "",
      email: "",
      notificado: "",
    });
  });
});
