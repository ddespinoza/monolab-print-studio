import { PUBLIC_EMAIL, SITE_NAME } from "@/lib/content";
import { escapeHtml } from "@/lib/sanitize";

/** Email clients ignore CSS variables, so the palette is mirrored here (with templates.ts's former map, the only hex literals outside tokens.css). */
export const EMAIL_COLORS = {
  prussianBlue: "#14213d",
  deepBlue: "#0d172a",
  orange: "#fca311",
  goldLight: "#ffd166",
  white: "#ffffff",
  bgSurface: "#f8fafc",
  borderLight: "#e2e8f0",
  textMain: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
} as const;

const c = EMAIL_COLORS;
const FONT = "font-family:Arial,Helvetica,sans-serif";

/** Badge text per Estado; `tone` picks the badge colour (action = orange, quiet = blue, off = grey). */
const BADGES: Record<string, { label: string; tone: "action" | "quiet" | "off" }> = {
  Recibido: { label: "Pedido recibido", tone: "quiet" },
  Cotizado: { label: "Cotización lista", tone: "action" },
  Confirmado: { label: "Cotización confirmada", tone: "quiet" },
  "En cola": { label: "En cola de impresión", tone: "quiet" },
  Imprimiendo: { label: "En producción", tone: "quiet" },
  Listo: { label: "Listo para retiro", tone: "action" },
  Entregado: { label: "Entregado", tone: "quiet" },
  Cancelado: { label: "Cancelado", tone: "off" },
};

const TONES = {
  action: { bg: c.orange, fg: c.prussianBlue },
  quiet: { bg: c.prussianBlue, fg: c.white },
  off: { bg: c.textMuted, fg: c.white },
} as const;

type Vars = Record<string, string>;

const URL_RE = /https?:\/\/[^\s<]+/g;
const SUMMARY_LABELS = ["Paciente", "Resina", "Copias", "Entrega"] as const;

function paragraph(inner: string): string {
  return `<p style="margin:0 0 16px;line-height:1.6;font-size:15px;color:${c.textSecondary}">${inner}</p>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px"><tr><td bgcolor="${c.orange}" style="background:${c.orange};border-radius:8px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;${FONT};font-size:16px;font-weight:700;color:${c.prussianBlue};text-decoration:none">${label}</a></td></tr></table>`;
}

/** Inline text with links: WhatsApp URLs become a small labelled link, other URLs stay readable. */
function inline(text: string, vars: Vars): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out += escapeHtml(text.slice(last, m.index));
    const url = m[0];
    const href = escapeHtml(url);
    out +=
      vars.whatsappLink && url === vars.whatsappLink
        ? `<a href="${href}" style="display:inline-block;margin-left:4px;padding:4px 12px;border:1px solid ${c.prussianBlue};border-radius:999px;color:${c.prussianBlue};font-weight:700;font-size:14px;text-decoration:none">Abrir WhatsApp</a>`
        : `<a href="${href}" style="color:${c.prussianBlue};text-decoration:underline">${href}</a>`;
    last = (m.index ?? 0) + url.length;
  }
  return out + escapeHtml(text.slice(last));
}

function summaryTable(lines: readonly string[]): string {
  const rows = lines.map((line) => {
    const item = line.replace(/^•\s*/, "");
    const label = SUMMARY_LABELS.find((l) => item.startsWith(`${l}: `));
    const [name, value] = label ? [label, item.slice(label.length + 2)] : ["Archivo", item];
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid ${c.borderLight};${FONT};font-size:13px;font-weight:700;color:${c.textMuted};width:90px;vertical-align:top">${escapeHtml(name)}</td><td style="padding:8px 12px;border-bottom:1px solid ${c.borderLight};${FONT};font-size:14px;color:${c.textMain}">${escapeHtml(value)}</td></tr>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${c.bgSurface};border:1px solid ${c.borderLight};border-radius:8px">${rows.join("")}</table>`;
}

function callout(text: string): string {
  return `<div style="margin:0 0 20px;padding:16px 18px;border-left:4px solid ${c.orange};background:${c.bgSurface};${FONT};font-size:17px;font-weight:700;line-height:1.5;color:${c.textMain}">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
}

/** Alternates paragraphs and summary tables for a block that mixes text lines and "• " lines. */
function runs(lines: readonly string[], vars: Vars): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const bullet = lines[i].startsWith("• ");
    let j = i;
    while (j < lines.length && lines[j].startsWith("• ") === bullet) j++;
    const run = lines.slice(i, j);
    out.push(
      bullet ? summaryTable(run) : paragraph(inline(run.join("\n"), vars).replace(/\n/g, "<br>")),
    );
    i = j;
  }
  return out.join("");
}

function blocks(body: string, vars: Vars): string {
  const quote = (vars.cotizacion ?? "").trim();
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => {
      const lines = block.split("\n");
      if (quote !== "" && block === quote) return callout(block);
      if (lines.some((l) => l.startsWith("• "))) return runs(lines, vars);
      // A confirm-link line becomes a button; the lines before it stay a paragraph.
      const at = vars.confirmLink ? lines.indexOf(vars.confirmLink) : -1;
      if (at >= 0) {
        const before = lines.slice(0, at).join("\n");
        const after = lines.slice(at + 1).join("\n");
        return (
          (before ? paragraph(inline(before, vars).replace(/\n/g, "<br>")) : "") +
          button(vars.confirmLink, "Confirmar cotización") +
          (after ? paragraph(inline(after, vars).replace(/\n/g, "<br>")) : "")
        );
      }
      return paragraph(inline(block, vars).replace(/\n/g, "<br>"));
    })
    .join("");
}

function header(sitio: string | undefined): string {
  const mark = sitio
    ? `<img src="${escapeHtml(sitio)}/brand/logo-email.png" alt="${SITE_NAME}" width="200" height="40" style="display:block;border:0;height:40px;width:200px">`
    : `<span style="${FONT};font-size:18px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:${c.white}">${SITE_NAME}</span>`;
  return `<tr><td bgcolor="${c.prussianBlue}" style="background:${c.prussianBlue};padding:20px 28px;border-bottom:4px solid ${c.orange}">${mark}</td></tr>`;
}

function titleBlock(estado: string | undefined, orderId: string | undefined): string {
  const badge = estado ? BADGES[estado] : undefined;
  if (!badge && !orderId) return "";
  const tone = TONES[badge?.tone ?? "quiet"];
  const pill = badge
    ? `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${tone.bg};color:${tone.fg};${FONT};font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">${badge.label}</span>`
    : "";
  const id = orderId
    ? `<div style="margin-top:10px;${FONT};font-size:22px;font-weight:900;color:${c.prussianBlue}">Pedido ${escapeHtml(orderId)}</div>`
    : "";
  return `<tr><td style="padding:28px 28px 0">${pill}${id}</td></tr>`;
}

function footer(sitio: string | undefined): string {
  const site = sitio
    ? `<a href="${escapeHtml(sitio)}" style="color:${c.goldLight};text-decoration:none">${escapeHtml(sitio.replace(/^https?:\/\//, ""))}</a> · `
    : "";
  return `<tr><td bgcolor="${c.deepBlue}" style="background:${c.deepBlue};padding:20px 28px;${FONT};font-size:12px;line-height:1.6;color:${c.borderLight}"><strong style="color:${c.white};letter-spacing:2px;text-transform:uppercase">${SITE_NAME}</strong><br>Impresión 3D en resina para odontología · Santiago, Chile<br>${site}<a href="mailto:${PUBLIC_EMAIL}" style="color:${c.goldLight};text-decoration:none">${PUBLIC_EMAIL}</a></td></tr>`;
}

/**
 * Branded HTML for a customer email. `body` is the rendered template text without the signature;
 * layout pieces are recognised from the text so templates edited in the sheet keep working.
 */
export function renderEmailHtml(body: string, vars: Vars, estado?: string): string {
  const firstLine =
    body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .find((p) => p !== "" && !p.endsWith(":")) ?? "";
  const preheader = escapeHtml(firstLine.replace(/\s+/g, " ").slice(0, 110));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:${c.bgSurface};${FONT};color:${c.textSecondary}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.bgSurface}">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${c.white};border:1px solid ${c.borderLight};border-radius:8px;overflow:hidden">
${header(vars.sitio)}
${titleBlock(estado, vars.orderId)}
<tr><td style="padding:24px 28px 8px">${blocks(body, vars)}${paragraph('Atentamente,<br><strong style="color:' + c.textMain + '">Equipo ' + SITE_NAME + "</strong>")}</td></tr>
${footer(vars.sitio)}
</table></td></tr></table></body></html>`;
}
