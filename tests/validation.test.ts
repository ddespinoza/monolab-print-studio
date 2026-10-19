import { describe, expect, it } from "vitest";
import { ENTREGAS, ESTADOS, MAX_FILES, RESINAS, orderSchema } from "@/lib/validation";

const token = "a".repeat(32);
const file = {
  token,
  name: "tapa.stl",
  volumeCm3: 12.1,
  size: { x: 60, y: 40, z: 20 },
  scalePercent: 100,
};
const valid = {
  nombre: "Dra. Matías Gómez",
  paciente: "A. P.",
  email: "ana@example.com",
  telefono: "+56 9 4862 3705",
  resina: "Estándar",
  entrega: "Flash",
  cantidad: 1,
  notas: "",
  empresa: "",
  files: [file],
};
const manyFiles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...file, token: String(i).padStart(32, "0") }));
const fail = (patch: object) => orderSchema.safeParse({ ...valid, ...patch }).success === false;

describe("orderSchema", () => {
  it("accepts a valid order", () => {
    expect(orderSchema.safeParse(valid).success).toBe(true);
  });
  it("defaults cantidad to 1 and notas to empty", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.cantidad;
    delete rest.notas;
    const r = orderSchema.parse(rest);
    expect(r.cantidad).toBe(1);
    expect(r.notas).toBe("");
  });
  it.each([
    ["short name", { nombre: "A" }],
    ["long name", { nombre: "A".repeat(81) }],
    ["full patient name", { paciente: "Ana Pérez González" }],
    ["patient with digits", { paciente: "A1" }],
    ["five initials", { paciente: "A.B.C.D.E." }],
    ["bad email", { email: "nope" }],
    ["bad phone", { telefono: "abc" }],
    ["too short phone", { telefono: "+56 9 1234" }],
    ["foreign phone", { telefono: "+1 202 555 0143" }],
    ["unknown resin", { resina: "PLA" }],
    ["unknown delivery", { entrega: "Express" }],
    ["cantidad 0", { cantidad: 0 }],
    ["cantidad 101", { cantidad: 101 }],
    ["cantidad 1.5", { cantidad: 1.5 }],
    ["long notes", { notas: "x".repeat(501) }],
    ["no files", { files: [] }],
    ["11 files", { files: manyFiles(MAX_FILES + 1) }],
    ["bad token", { files: [{ ...file, token: "../etc" }] }],
    ["negative volume", { files: [{ ...file, volumeCm3: -1 }] }],
    ["scale 4 %", { files: [{ ...file, scalePercent: 4 }] }],
    ["scale 251 %", { files: [{ ...file, scalePercent: 251 }] }],
    ["duplicate tokens", { files: [file, file] }],
  ])("rejects %s", (_n, patch) => {
    expect(fail(patch)).toBe(true);
  });
  it.each(["A", "A. P.", "AP", "A.P.M.", "A-P", "A P M S", "Á.Ñ."])(
    "accepts initials %s",
    (paciente) => {
      expect(fail({ paciente })).toBe(false);
    },
  );
  it("accepts 1 and 10 files", () => {
    expect(fail({ files: manyFiles(MAX_FILES) })).toBe(false);
  });
  it("gives Spanish error messages", () => {
    const r = orderSchema.safeParse({ ...valid, email: "nope" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/correo/i);
  });
});

describe("constants", () => {
  it("has the 8 states, no Enviado", () => {
    expect(ESTADOS).toEqual([
      "Nuevo",
      "Cotizado",
      "Confirmado",
      "En cola",
      "Imprimiendo",
      "Listo",
      "Entregado",
      "Cancelado",
    ]);
  });
  it("lists the resins and delivery options", () => {
    expect(RESINAS).toEqual(["Estándar", "Resina Tough"]);
    expect(ENTREGAS.map((e) => [e.id, e.dias, e.tarifa])).toEqual([
      ["Flash", 2, 10000],
      ["Normal", 7, 7500],
    ]);
  });
});

describe("telefono", () => {
  it.each([
    "+56 9 4862 3705",
    "56948623705",
    "9 4862 3705",
    "(2) 2345 6789",
    "+56 2 2345 6789",
    "948623705",
  ])("accepts the Chilean number %s", (telefono) => {
    expect(orderSchema.safeParse({ ...valid, telefono }).success).toBe(true);
  });

  it("reports the error in Spanish", () => {
    const r = orderSchema.safeParse({ ...valid, telefono: "abc" });
    expect(JSON.stringify(r.error?.issues)).toContain("teléfono");
  });
});
