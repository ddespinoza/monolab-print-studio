import { escapeHtml, stripLineBreaks } from "@/lib/sanitize";
import { ENTREGAS, type Estado } from "@/lib/validation";

export interface EmailTemplate {
  subject: string;
  body: string;
}
export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}
export type TemplateKey = Exclude<Estado, "Nuevo"> | "Recibido";

/** Email clients ignore CSS variables, so the palette is mirrored here (the only hex literals outside globals.css). */
const EMAIL_COLORS = {
  prussianBlue: "#14213d",
  orange: "#fca311",
  bgSurface: "#f8fafc",
  borderLight: "#e2e8f0",
  textMain: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
} as const;

const FOOTER = "Atentamente,\nEquipo Monolab Print Studio\n{{sitio}}";
const CONSULTAS = "¿Consultas? Escríbanos por WhatsApp: {{whatsappLink}}";

/** Approved copy (docs/SPEC.md section 16), without the footer, which is always appended. */
export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  Recibido: {
    subject: "Pedido {{orderId}} — recibido",
    body: `Estimado/a {{nombre}}:

Hemos recibido su pedido {{orderId}}. Sus archivos y datos quedaron registrados.

Revisaremos su solicitud y le enviaremos la confirmación en breve.

Resumen del pedido:
{{resumen}}

${CONSULTAS}`,
  },
  Cotizado: {
    subject: "Pedido {{orderId}} — cotización",
    body: `Estimado/a {{nombre}}:

Revisamos su pedido {{orderId}}. Esta es su cotización:

{{cotizacion}}

Para confirmarla, ingrese al siguiente enlace y presione «Confirmar cotización»:
{{confirmLink}}

Si desea cambiar algo, escríbanos por WhatsApp: {{whatsappLink}}`,
  },
  Confirmado: {
    subject: "Pedido {{orderId}} — cotización confirmada",
    body: `Estimado/a {{nombre}}:

Recibimos su confirmación del pedido {{orderId}}.

Lo pasaremos a la cola de impresión y le avisaremos cuando comience la producción.

${CONSULTAS}`,
  },
  "En cola": {
    subject: "Pedido {{orderId}} — en cola de impresión",
    body: `Estimado/a {{nombre}}:

Su pedido {{orderId}} fue confirmado y está en cola de impresión.

Le avisaremos cuando comience la producción.

${CONSULTAS}`,
  },
  Imprimiendo: {
    subject: "Pedido {{orderId}} — en producción",
    body: `Estimado/a {{nombre}}:

Su pedido {{orderId}} está en producción.

Le informaremos en cuanto esté terminado.

${CONSULTAS}`,
  },
  Listo: {
    subject: "Pedido {{orderId}} — listo para entrega",
    body: `Estimado/a {{nombre}}:

Su pedido {{orderId}} está terminado y listo para entrega.

Retiro en: {{retiro}}

Para coordinar el horario, responda este correo o escríbanos: {{whatsappLink}}`,
  },
  Entregado: {
    subject: "Pedido {{orderId}} — entregado",
    body: `Estimado/a {{nombre}}:

Confirmamos la entrega de su pedido {{orderId}}.

Gracias por confiar en Monolab Print Studio.

Guardamos sus archivos: si desea repetir su pedido, solo escríbanos. {{whatsappLink}}`,
  },
  Cancelado: {
    subject: "Pedido {{orderId}} — cancelado",
    body: `Estimado/a {{nombre}}:

Su pedido {{orderId}} ha sido cancelado.

Lamentamos cualquier inconveniente. Si desea retomarlo o tiene consultas, estamos a su disposición: {{whatsappLink}}`,
  },
};

/** Internal notification; not operator-editable and sent only to OPERATOR_EMAIL. */
export const OPERATOR_TEMPLATE: EmailTemplate = {
  subject: "[Monolab] Nuevo pedido {{orderId}} — {{nombre}}",
  body: `Nuevo pedido {{orderId}}
Cliente: {{nombre}} — {{whatsapp}}
Paciente: {{paciente}}
Archivos: {{nArchivos}} ({{volumenTotal}} cm³) — {{driveLink}}
Fila en planilla: {{filaLink}}
Estado inicial: Nuevo.

{{resumen}}`,
};

export type TemplateVars = Record<string, string>;

/** {{name}} substitution; unknown variables stay literal so a typo in the sheet never breaks mail. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => vars[name] ?? match);
}

export function whatsappLink(number: string, orderId: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola, consulto por mi pedido ${orderId}`)}`;
}

export interface ResumenInput {
  files: {
    name: string;
    volumeCm3: number;
    size: { x: number; y: number; z: number };
    scalePercent?: number;
  }[];
  paciente: string;
  resina: string;
  cantidad: number | string;
  /** Delivery option id (Flash, Normal). */
  entrega: string;
}

/** One line per file; shared by the sheet's "Detalle archivos" cell and the email summary. */
export function formatFileLine(f: ResumenInput["files"][number]): string {
  const scale =
    f.scalePercent !== undefined && f.scalePercent !== 100 ? ` · escala ${f.scalePercent} %` : "";
  return `${f.name} — ${f.volumeCm3.toFixed(1)} cm³ (${f.size.x}×${f.size.y}×${f.size.z})${scale}`;
}

/** Bulleted summary from already-formatted file lines (the sheet stores them as text). */
export function joinResumen(fileLines: readonly string[], o: Omit<ResumenInput, "files">): string {
  const option = ENTREGAS.find((e) => e.id === o.entrega);
  const entrega = option ? `${option.id} (${option.dias} días)` : o.entrega;
  return [
    ...fileLines.map((l) => `• ${l}`),
    `• Paciente: ${o.paciente}`,
    `• Resina: ${o.resina}`,
    `• Copias: ${o.cantidad}`,
    `• Entrega: ${entrega}`,
  ].join("\n");
}

export function buildResumen(o: ResumenInput): string {
  return joinResumen(o.files.map(formatFileLine), o);
}

function toHtml(text: string): string {
  const c = EMAIL_COLORS;
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) =>
      p
        .replace(
          /https?:\/\/[^\s<]+/g,
          (url) =>
            `<a href="${url}" style="color:${c.prussianBlue};text-decoration:underline">${url}</a>`,
        )
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${p}</p>`)
    .join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:${c.bgSurface};font-family:Arial,Helvetica,sans-serif;color:${c.textSecondary}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${c.borderLight}">
<tr><td style="background:${c.prussianBlue};padding:20px 24px;color:#ffffff;font-weight:900;letter-spacing:3px;text-transform:uppercase;border-bottom:4px solid ${c.orange}">Monolab Print Studio</td></tr>
<tr><td style="padding:24px;font-size:15px;color:${c.textSecondary}">${paragraphs}</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildEmail(template: EmailTemplate, vars: TemplateVars): BuiltEmail {
  const subject = stripLineBreaks(renderTemplate(template.subject, vars));
  const text = `${renderTemplate(template.body, vars)}\n\n${renderTemplate(FOOTER, vars)}\n`;
  return { subject, text, html: toHtml(text) };
}
