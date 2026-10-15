import { describe, expect, it } from "vitest";
import { parsePlantillas, resolveTemplate } from "@/lib/sheet-templates";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

const rows = [
  ["Estado", "Asunto", "Mensaje"],
  ["En cola", "Pedido {{orderId}} — OK", "Hola {{nombre}}"],
  ["Listo", "", "sin asunto"],
  ["Inventado", "x", "y"],
  ["Imprimiendo", "Asunto", "   "],
  ["Cancelado", "Pedido {{orderId}} — cancelado", "Mensaje propio"],
];

describe("parsePlantillas", () => {
  it("keeps only valid rows for known states", () => {
    const m = parsePlantillas(rows);
    expect([...m.keys()].sort()).toEqual(["Cancelado", "En cola"]);
    expect(m.get("En cola")).toEqual({
      subject: "Pedido {{orderId}} — OK",
      body: "Hola {{nombre}}",
    });
  });
  it("tolerates short rows and empty input", () => {
    expect(parsePlantillas([["En cola"], []]).size).toBe(0);
    expect(parsePlantillas([]).size).toBe(0);
  });
});

describe("resolveTemplate", () => {
  const m = parsePlantillas(rows);
  it("uses the sheet row when valid", () => {
    expect(resolveTemplate("En cola", m)).toEqual({ template: m.get("En cola"), fallback: false });
  });
  it("falls back to the built-in default when missing or invalid", () => {
    expect(resolveTemplate("Listo", m)).toEqual({
      template: DEFAULT_TEMPLATES.Listo,
      fallback: true,
    });
    expect(resolveTemplate("Imprimiendo", m).fallback).toBe(true);
  });
});
