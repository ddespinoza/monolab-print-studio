import { describe, expect, it } from "vitest";
import { ESTADOS, MAX_FILES, orderSchema } from "@/lib/validation";

const token = "a".repeat(32);
const valid = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  whatsapp: "+57 300 123 4567",
  ciudad: "Medellín",
  material: "PETG",
  color: "Negro",
  relleno: 20,
  cantidad: 1,
  notas: "",
  empresa: "",
  files: [{ token, volumeCm3: 12.1, size: { x: 60, y: 40, z: 20 }, name: "tapa.stl" }],
};
const manyFiles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...valid.files[0], token: String(i).padStart(32, "0") }));
const fail = (patch: object) => orderSchema.safeParse({ ...valid, ...patch }).success === false;

describe("orderSchema", () => {
  it("accepts a valid order", () => {
    expect(orderSchema.safeParse(valid).success).toBe(true);
  });
  it("applies defaults for relleno and cantidad", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.relleno;
    delete rest.cantidad;
    const r = orderSchema.parse(rest);
    expect(r.relleno).toBe(20);
    expect(r.cantidad).toBe(1);
  });
  it.each([
    ["short name", { nombre: "A" }],
    ["long name", { nombre: "A".repeat(81) }],
    ["bad email", { email: "nope" }],
    ["bad phone", { whatsapp: "abc" }],
    ["short city", { ciudad: "M" }],
    ["missing material", { material: "" }],
    ["long color", { color: "x".repeat(41) }],
    ["relleno 30", { relleno: 30 }],
    ["cantidad 0", { cantidad: 0 }],
    ["cantidad 101", { cantidad: 101 }],
    ["cantidad 1.5", { cantidad: 1.5 }],
    ["long notes", { notas: "x".repeat(501) }],
    ["no files", { files: [] }],
    ["11 files", { files: manyFiles(MAX_FILES + 1) }],
    ["bad token", { files: [{ ...valid.files[0], token: "../etc" }] }],
    ["negative volume", { files: [{ ...valid.files[0], volumeCm3: -1 }] }],
  ])("rejects %s", (_n, patch) => {
    expect(fail(patch)).toBe(true);
  });
  it("accepts 1 and 10 files", () => {
    expect(fail({ files: manyFiles(MAX_FILES) })).toBe(false);
  });
  it("gives Spanish error messages", () => {
    const r = orderSchema.safeParse({ ...valid, email: "nope" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/correo/i);
  });
  it("rejects duplicate tokens", () => {
    expect(fail({ files: [valid.files[0], valid.files[0]] })).toBe(true);
  });
});

describe("ESTADOS", () => {
  it("has the 6 states, no Enviado", () => {
    expect(ESTADOS).toEqual(["Nuevo", "En cola", "Imprimiendo", "Listo", "Entregado", "Cancelado"]);
  });
});
