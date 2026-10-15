import { renderEmailHtml } from "@/lib/email-html";
import { stripLineBreaks } from "@/lib/sanitize";
import { ENTREGAS, type Estado } from "@/lib/order-options";
import type { BankData } from "@/lib/sheet-config";
export { whatsappLink } from "@/lib/whatsapp";

export interface EmailTemplate {
  subject: string;
  body: string;
}
export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}
/** "Pago" is not an Estado: it is the transfer-details email the operator sends on request. */
export type TemplateKey = Exclude<Estado, "Nuevo"> | "Recibido" | "Pago";

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

{{datosPago}}

${CONSULTAS}`,
  },
  Pago: {
    subject: "Pedido {{orderId}} — datos para el pago",
    body: `Estimado/a {{nombre}}:

Para completar su pedido {{orderId}}, estos son los datos para pagar por transferencia.

Su cotización:

{{cotizacion}}

{{datosPago}}

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

Por seguridad, sus archivos 3D se eliminan de forma definitiva una vez finalizado el pedido. Si desea repetirlo, deberá enviarlos nuevamente. {{whatsappLink}}`,
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
Cliente: {{nombre}} — {{telefono}}
Paciente: {{paciente}}
Archivos: {{nArchivos}} ({{volumenTotal}} cm³) — {{driveLink}}
Fila en planilla: {{filaLink}}
Estado inicial: Nuevo.

{{resumen}}`,
};

/**
 * The «Datos para transferir» block for `{{datosPago}}`: one self-contained paragraph (heading, account lines, how to
 * send the receipt), or "" when the bank data is incomplete so templates simply show nothing.
 */
export function bankBlock(bank: BankData | null, orderId: string): string {
  if (!bank) return "";
  return [
    "Datos para transferir",
    `Titular: ${bank.titular}`,
    `RUT: ${bank.rut}`,
    `Banco: ${bank.banco}`,
    `Tipo de cuenta: ${bank.tipo}`,
    `N° de cuenta: ${bank.cuenta}`,
    ...(bank.correo ? [`Correo: ${bank.correo}`] : []),
    `Envíe el comprobante de transferencia respondiendo este correo, indicando el pedido ${orderId}.`,
  ].join("\n");
}

export type TemplateVars = Record<string, string>;

/** {{name}} substitution; unknown variables stay literal so a typo in the sheet never breaks mail. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => vars[name] ?? match);
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

/** `estado` picks the badge in the HTML version (Recibido or an Estado); omit it for internal notices. */
export function buildEmail(
  template: EmailTemplate,
  vars: TemplateVars,
  options: { estado?: string } = {},
): BuiltEmail {
  const subject = stripLineBreaks(renderTemplate(template.subject, vars));
  const body = renderTemplate(template.body, vars).replace(/\n{3,}/g, "\n\n");
  const text = `${body}\n\n${renderTemplate(FOOTER, vars)}\n`;
  return { subject, text, html: renderEmailHtml(body, vars, options.estado) };
}
