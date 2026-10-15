/** Customer-facing stages shown on the confirmation page; they match the Estado flow in the sheet. */
export const PROGRESS_STEPS = ["Cotización", "Confirmación", "Producción", "Retiro"] as const;

export type StepState = "done" | "now" | "todo";

const STEP_BY_ESTADO: Record<string, number> = {
  Cotizado: 1,
  Confirmado: 2,
  "En cola": 2,
  Imprimiendo: 2,
  Listo: 3,
  Entregado: 4,
};

/** Index of the step that is current; 4 means every step is done. Unknown states start at step 0. */
export function activeStep(estado: string): number {
  return STEP_BY_ESTADO[estado] ?? 0;
}

export function stepStates(active: number): StepState[] {
  return PROGRESS_STEPS.map((_, i) => (i < active ? "done" : i === active ? "now" : "todo"));
}
