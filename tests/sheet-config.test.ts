import { describe, expect, it, vi } from "vitest";
import { cachedLoader, parseConfig } from "@/lib/sheet-config";

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
    });
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
