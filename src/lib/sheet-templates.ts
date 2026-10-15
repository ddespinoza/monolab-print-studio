import { ESTADOS } from "@/lib/validation";
import { DEFAULT_TEMPLATES, type EmailTemplate, type TemplateKey } from "@/lib/templates";

/** Estados with a template, plus «Pago» (transfer-details email, not an Estado). */
const NOTIFIABLE = new Set<string>([...ESTADOS.filter((e) => e !== "Nuevo"), "Pago"]);

/** Rows of the Plantillas tab (Estado | Asunto | Mensaje). Invalid rows are skipped, never fatal. */
export function parsePlantillas(rows: readonly (readonly string[])[]): Map<string, EmailTemplate> {
  const result = new Map<string, EmailTemplate>();
  for (const row of rows) {
    const estado = (row[0] ?? "").trim();
    const subject = (row[1] ?? "").trim();
    const body = (row[2] ?? "").trim();
    if (NOTIFIABLE.has(estado) && subject && body) result.set(estado, { subject, body });
  }
  return result;
}

export function resolveTemplate(
  key: TemplateKey,
  fromSheet: ReadonlyMap<string, EmailTemplate>,
): { template: EmailTemplate; fallback: boolean } {
  const template = fromSheet.get(key);
  return template
    ? { template, fallback: false }
    : { template: DEFAULT_TEMPLATES[key], fallback: true };
}
