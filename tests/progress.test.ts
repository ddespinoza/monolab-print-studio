import { describe, expect, it } from "vitest";
import { PROGRESS_STEPS, activeStep, stepStates } from "@/lib/progress";

describe("progress steps", () => {
  it("has the four customer-facing stages in order", () => {
    expect(PROGRESS_STEPS).toEqual(["Cotización", "Confirmación", "Producción", "Retiro"]);
  });
  it.each([
    ["Cotizado", 1],
    ["Confirmado", 2],
    ["En cola", 2],
    ["Imprimiendo", 2],
    ["Listo", 3],
    ["Entregado", 4],
  ])("%s is at step %i", (estado, step) => {
    expect(activeStep(estado)).toBe(step);
  });
  it("falls back to the first step for unknown states", () => {
    expect(activeStep("Nuevo")).toBe(0);
    expect(activeStep("")).toBe(0);
  });
  it("marks earlier steps done, the current one now, the rest pending", () => {
    expect(stepStates(1)).toEqual(["done", "now", "todo", "todo"]);
    expect(stepStates(3)).toEqual(["done", "done", "done", "now"]);
  });
  it("marks everything done once delivered", () => {
    expect(stepStates(4)).toEqual(["done", "done", "done", "done"]);
  });
});
