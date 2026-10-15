import { describe, expect, it } from "vitest";
import type { OrderInput } from "@/lib/validation";
import { HEADERS, buildOrderRow, parseOrderRow } from "@/lib/order-row";

const order: OrderInput = {
  nombre: '=HYPERLINK("x")',
  paciente: "A. P.",
  email: "ana@example.com",
  whatsapp: "+56 9 4862 3705",
  resina: "Estándar",
  entrega: "Flash",
  cantidad: 2,
  notas: "+cmd",
  empresa: "",
  files: [
    {
      token: "a".repeat(32),
      name: "caja.stl",
      volumeCm3: 96.3,
      size: { x: 120, y: 80, z: 40 },
      scalePercent: 100,
    },
    {
      token: "b".repeat(32),
      name: "tapa.obj",
      volumeCm3: 12.1,
      size: { x: 60, y: 40, z: 20 },
      scalePercent: 75,
    },
  ],
};

describe("buildOrderRow", () => {
  const row = buildOrderRow({
    id: "ML-0001",
    fecha: "2025-06-12 14:03",
    order,
    driveLink: "https://drive/x",
  });
  it("has 20 columns matching the headers", () => {
    expect(HEADERS).toHaveLength(20);
    expect(row).toHaveLength(20);
    expect(row.slice(0, 3)).toEqual(["ML-0001", "2025-06-12 14:03", "Nuevo"]);
  });
  it("stores patient initials, delivery option and fee", () => {
    expect(row[6]).toBe("A. P.");
    expect(row[7]).toBe("Flash");
    expect(row[8]).toBe("10000");
  });
  it("sums volume, counts files and writes per-file detail with scale", () => {
    expect(row[10]).toBe("2");
    expect(row[11]).toBe("108.4");
    expect(row[12]).toBe(
      "caja.stl — 96.3 cm³ (120×80×40)\ntapa.obj — 12.1 cm³ (60×40×20) · escala 75 %",
    );
  });
  it("neutralises formulas in user text", () => {
    expect(row[3].startsWith("'")).toBe(true);
    expect(row[15]).toBe("'+cmd");
  });
  it("leaves Cotización and Confirmado empty and marks Nuevo as notified", () => {
    expect(row[16]).toBe("");
    expect(row[17]).toBe("");
    expect(row[18]).toBe("Nuevo");
    expect(row[19]).toBe("2025-06-12 14:03");
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
      paciente: "A. P.",
      entrega: "Flash",
      tarifa: "10000",
      resina: "Estándar",
      cotizacion: "",
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
