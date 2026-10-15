import { describe, expect, it, vi } from "vitest";
import { cachedLoader, isAutomatic, parseConfig } from "@/lib/sheet-config";

describe("parseConfig", () => {
  it("reads key/value rows", () => {
    expect(
      parseConfig([
        ["Clave", "Valor"],
        ["RETIRO_DIRECCION", "Calle 1"],
        ["RETIRO_HORARIO", "Lun-Vie"],
      ]),
    ).toEqual({
      RETIRO_DIRECCION: "Calle 1",
      RETIRO_HORARIO: "Lun-Vie",
      ENVIO_AUTOMATICO: "NO",
      ELIMINAR_ARCHIVOS_DIAS: 30,
      BANCO: null,
    });
  });
  describe("bank data (BANCO_*)", () => {
    const full: string[][] = [
      ["BANCO_TITULAR", "Ana Pérez"],
      ["BANCO_RUT", "11.111.111-1"],
      ["BANCO_BANCO", "Banco Ejemplo"],
      ["BANCO_TIPO_CUENTA", "Cuenta Vista"],
      ["BANCO_CUENTA", "000123"],
      ["BANCO_CORREO", "pagos@example.cl"],
    ];
    it("reads the six keys into one object", () => {
      expect(parseConfig(full).BANCO).toEqual({
        titular: "Ana Pérez",
        rut: "11.111.111-1",
        banco: "Banco Ejemplo",
        tipo: "Cuenta Vista",
        cuenta: "000123",
        correo: "pagos@example.cl",
      });
    });
    it("is null when any required key is missing or blank (never a half-filled account)", () => {
      for (const key of [
        "BANCO_TITULAR",
        "BANCO_RUT",
        "BANCO_BANCO",
        "BANCO_TIPO_CUENTA",
        "BANCO_CUENTA",
      ]) {
        expect(parseConfig(full.filter((r) => r[0] !== key)).BANCO).toBeNull();
        expect(parseConfig(full.map((r) => (r[0] === key ? [key, "  "] : r))).BANCO).toBeNull();
      }
    });
    it("treats the notice email as optional", () => {
      const noMail = parseConfig(full.filter((r) => r[0] !== "BANCO_CORREO")).BANCO;
      expect(noMail?.correo).toBe("");
    });
    it("keeps each value on one line", () => {
      const evil = full.map((r) => (r[0] === "BANCO_TITULAR" ? [r[0], "Ana\nBcc: x@y.z"] : r));
      expect(parseConfig(evil).BANCO?.titular).toBe("Ana Bcc: x@y.z");
    });
  });
  it("reads ELIMINAR_ARCHIVOS_DIAS: 30 by default, a whole number of days, 0/NO turns it off, garbage fails closed", () => {
    const days = (v?: string): number =>
      parseConfig(v === undefined ? [] : [["ELIMINAR_ARCHIVOS_DIAS", v]]).ELIMINAR_ARCHIVOS_DIAS;
    expect(days()).toBe(30);
    expect(days("  ")).toBe(30);
    expect(days("45")).toBe(45);
    expect(days(" 7 ")).toBe(7);
    for (const off of ["0", "NO", "no", "No"]) expect(days(off)).toBe(0);
    for (const bad of ["abc", "-5", "2.5", "30 días", "1e3"]) expect(days(bad)).toBe(0);
  });
  it("sends manually unless ENVIO_AUTOMATICO says SI (any case, with or without accent)", () => {
    expect(parseConfig([]).ENVIO_AUTOMATICO).toBe("NO");
    for (const v of ["SI", "si", " Sí ", "SÍ"])
      expect(isAutomatic(parseConfig([["ENVIO_AUTOMATICO", v]]))).toBe(true);
    for (const v of ["NO", "", "quizás", "true"])
      expect(isAutomatic(parseConfig([["ENVIO_AUTOMATICO", v]]))).toBe(false);
  });
  it("uses defaults for missing or blank values", () => {
    const c = parseConfig([["RETIRO_DIRECCION", "  "]]);
    expect(c.RETIRO_DIRECCION.length).toBeGreaterThan(0);
    expect(c.RETIRO_HORARIO.length).toBeGreaterThan(0);
  });
});

describe("cachedLoader", () => {
  it("caches for 5 minutes then reloads", async () => {
    let t = 0;
    const load = vi.fn().mockResolvedValue({ a: 1 });
    const get = cachedLoader(load, 300_000, () => t);
    await get();
    t = 299_999;
    await get();
    expect(load).toHaveBeenCalledTimes(1);
    t = 300_001;
    await get();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("serves stale data when a reload fails", async () => {
    let t = 0;
    const load = vi.fn().mockResolvedValueOnce({ a: 1 }).mockRejectedValueOnce(new Error("down"));
    const get = cachedLoader(load, 1000, () => t);
    await get();
    t = 5000;
    expect(await get()).toEqual({ a: 1 });
  });
  it("throws when the first load fails", async () => {
    const get = cachedLoader(vi.fn().mockRejectedValue(new Error("down")), 1000, () => 0);
    await expect(get()).rejects.toThrow("down");
  });
});
