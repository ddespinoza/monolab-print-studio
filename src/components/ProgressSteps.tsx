import { PROGRESS_STEPS, stepStates } from "@/lib/progress";

/** Four-stage progress line; `active` is the index from `activeStep` (4 = everything done). */
export function ProgressSteps({ active }: { active: number }) {
  const states = stepStates(active);
  return (
    <ol className="steps" aria-label="Progreso del pedido">
      {PROGRESS_STEPS.map((label, i) => (
        <li key={label} className={states[i] === "todo" ? "" : states[i]}>
          {label}
          {states[i] === "now" && <span className="sr-only"> (etapa actual)</span>}
        </li>
      ))}
    </ol>
  );
}
