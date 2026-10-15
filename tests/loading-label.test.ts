import { describe, expect, it } from "vitest";
import { loadingLabel } from "@/lib/loading-label";

const f = (name: string, parse: "reading" | "ready" | "error") => ({ name, parse });

describe("loadingLabel", () => {
  it("is undefined when nothing is being read", () => {
    expect(loadingLabel([])).toBeUndefined();
    expect(loadingLabel([f("a.stl", "ready"), f("b.stl", "error")])).toBeUndefined();
  });
  it("names one file", () => {
    expect(loadingLabel([f("caja.stl", "reading")])).toBe("Leyendo caja.stl…");
  });
  it("names two files and counts the rest", () => {
    expect(loadingLabel([f("a.stl", "reading"), f("b.obj", "reading")])).toBe(
      "Leyendo a.stl y b.obj…",
    );
    expect(
      loadingLabel([
        f("a.stl", "reading"),
        f("b.obj", "reading"),
        f("c.ply", "reading"),
        f("d.stl", "reading"),
      ]),
    ).toBe("Leyendo a.stl y 3 archivos más…");
  });
  it("ignores files that are already ready", () => {
    expect(loadingLabel([f("a.stl", "ready"), f("b.stl", "reading")])).toBe("Leyendo b.stl…");
  });
  it("shortens very long names in the middle, keeping the extension", () => {
    const long = `${"x".repeat(60)}.stl`;
    const label = loadingLabel([f(long, "reading")]) ?? "";
    expect(label.length).toBeLessThan(50);
    expect(label).toContain("….stl");
  });
});
