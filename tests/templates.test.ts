import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  buildEmail,
  OPERATOR_TEMPLATE,
  buildResumen,
  joinResumen,
  renderTemplate,
  bankBlock,
  whatsappLink,
} from "@/lib/templates";

describe("renderTemplate", () => {
  it("substitutes known variables", () => {
    expect(
      renderTemplate("Hola {{nombre}}, {{orderId}}", { nombre: "Ana", orderId: "ML-0001" }),
    ).toBe("Hola Ana, ML-0001");
  });
  it("keeps unknown variables literal and tolerates spaces", () => {
    expect(renderTemplate("{{ nombre }} {{foo}}", { nombre: "Ana" })).toBe("Ana {{foo}}");
  });
});

describe("DEFAULT_TEMPLATES", () => {
  it("has receipt, the 7 notifiable states and the payment mail, no Enviado", () => {
    expect(Object.keys(DEFAULT_TEMPLATES).sort()).toEqual(
      [
        "Cancelado",
        "Confirmado",
        "Cotizado",
        "En cola",
        "Entregado",
        "Imprimiendo",
        "Listo",
        "Pago",
        "Recibido",
      ].sort(),
    );
  });
  it("subjects start with the order number", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES))
      expect(t.subject.startsWith("Pedido {{orderId}}")).toBe(true);
  });
  it("Cotizado carries the quote text and the confirm link", () => {
    expect(DEFAULT_TEMPLATES.Cotizado.body).toContain("{{cotizacion}}");
    expect(DEFAULT_TEMPLATES.Cotizado.body).toContain("{{confirmLink}}");
  });
  it("Entregado tells the customer the files are deleted, never that they are kept", () => {
    const body = DEFAULT_TEMPLATES.Entregado.body;
    expect(body).not.toMatch(/guardamos sus archivos/i);
    expect(body).toMatch(/elimin/i);
    expect(body).toMatch(/nuevamente/i);
  });
  it("Listo mentions the retiro address variable", () => {
    expect(DEFAULT_TEMPLATES.Listo.body).toContain("{{retiro}}");
  });
});

describe("whatsappLink", () => {
  it("prefills the order id", () => {
    const link = whatsappLink("56912345678", "ML-0001");
    expect(link.startsWith("https://wa.me/56912345678?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("ML-0001");
  });
});

describe("buildResumen", () => {
  it("renders bullets with patient, resin, copies and delivery", () => {
    const r = buildResumen({
      files: [
        { name: "caja.stl", volumeCm3: 96.3, size: { x: 120, y: 80, z: 40 }, scalePercent: 100 },
      ],
      paciente: "A. P.",
      resina: "Estándar",
      cantidad: 2,
      entrega: "Flash",
    });
    expect(r).toContain("• caja.stl — 96.3 cm³ (120×80×40)");
    expect(r).toContain("• Paciente: A. P.");
    expect(r).toContain("• Resina: Estándar");
    expect(r).toContain("• Copias: 2");
    expect(r).toContain("• Entrega: Flash (2 días)");
  });
  it("falls back to the raw delivery id when unknown", () => {
    expect(joinResumen([], { paciente: "A", resina: "x", cantidad: 1, entrega: "Otro" })).toContain(
      "• Entrega: Otro",
    );
  });
});

describe("buildEmail", () => {
  const vars = {
    nombre: "Ana",
    orderId: "ML-0001",
    sitio: "https://monolabprintstudio.cl",
    whatsappLink: "https://wa.me/1?text=x",
    retiro: "Calle 1",
  };
  it("appends the standard footer and renders subject and text", () => {
    const e = buildEmail(DEFAULT_TEMPLATES["En cola"], vars);
    expect(e.subject).toBe("Pedido ML-0001 — en cola de impresión");
    expect(e.text).toContain("Estimado/a Ana:");
    expect(
      e.text
        .trimEnd()
        .endsWith("Atentamente,\nEquipo Monolab Print Studio\nhttps://monolabprintstudio.cl"),
    ).toBe(true);
  });
  it("escapes html in variables and strips line breaks from the subject", () => {
    const e = buildEmail(DEFAULT_TEMPLATES["En cola"], {
      ...vars,
      nombre: "<script>x</script>",
      orderId: "ML-1\r\nBcc: x",
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.subject).not.toMatch(/[\r\n]/);
  });
  it("turns urls into links and never contains the gmail address or stray hex colors outside the map", () => {
    const e = buildEmail(DEFAULT_TEMPLATES.Recibido, vars);
    expect(e.html).toContain('<a href="https://wa.me/1?text=x"');
    expect(e.html).not.toContain("gmail.com");
  });
});

describe("buildEmail html design", () => {
  const vars = {
    nombre: "Ana",
    orderId: "ML-0001",
    sitio: "https://monolabprintstudio.cl",
    whatsappLink: "https://wa.me/56948623705?text=Hola%20ML-0001",
    retiro: "Calle 1",
    cotizacion: "$45.000 CLP por 2 piezas. Plazo: 7 días.",
    confirmLink: "https://monolabprintstudio.cl/confirmar/abc.def",
    resumen: [
      "• caja.stl — 96.3 cm³ (120×80×40)",
      "• Paciente: A. P.",
      "• Resina: Estándar",
      "• Copias: 2",
      "• Entrega: Flash (2 días)",
    ].join("\n"),
  };
  const html = (key: keyof typeof DEFAULT_TEMPLATES, over: Record<string, string> = {}) =>
    buildEmail(DEFAULT_TEMPLATES[key], { ...vars, ...over }, { estado: key }).html;

  it("shows the logo from the site as an absolute PNG with alt text", () => {
    expect(html("Listo")).toContain(
      '<img src="https://monolabprintstudio.cl/brand/logo-email.png"',
    );
    expect(html("Listo")).toContain('alt="Monolab Print Studio"');
  });
  it("falls back to the brand name when no site address is known", () => {
    const e = buildEmail(DEFAULT_TEMPLATES.Listo, { nombre: "Ana", orderId: "ML-0001" });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("Monolab Print Studio");
  });
  it.each([
    ["Recibido", "Pedido recibido"],
    ["Cotizado", "Cotización lista"],
    ["Confirmado", "Cotización confirmada"],
    ["En cola", "En cola de impresión"],
    ["Imprimiendo", "En producción"],
    ["Listo", "Listo para retiro"],
    ["Entregado", "Entregado"],
    ["Cancelado", "Cancelado"],
  ] as const)("labels %s with a status badge", (key, label) => {
    const h = html(key);
    expect(h).toContain(`>${label}</span>`);
    expect(h).toContain("Pedido ML-0001");
  });
  it("has no badge for the operator notice (no estado given)", () => {
    const e = buildEmail(OPERATOR_TEMPLATE, { ...vars, paciente: "A. P.", telefono: "x" });
    expect(e.html).not.toContain("Pedido recibido");
  });
  it("renders the confirm link as a button, and keeps the full URL in the text version", () => {
    const e = buildEmail(DEFAULT_TEMPLATES.Cotizado, vars, { estado: "Cotizado" });
    expect(e.html).toContain(`href="${vars.confirmLink}"`);
    expect(e.html).toMatch(/>\s*Confirmar cotización\s*<\/a>/);
    expect(e.text).toContain(vars.confirmLink);
  });
  it("highlights the quote text in its own callout", () => {
    expect(html("Cotizado")).toMatch(
      /border-left:4px solid #fca311[^>]*>\$45\.000 CLP por 2 piezas\. Plazo: 7 días\./,
    );
  });
  it("renders the order summary as label/value rows", () => {
    const h = html("Recibido");
    expect(h).toContain(">Paciente</td>");
    expect(h).toContain(">A. P.</td>");
    expect(h).toContain(">Entrega</td>");
    expect(h).toContain(">Flash (2 días)</td>");
    expect(h).toContain("caja.stl — 96.3 cm³ (120×80×40)");
    expect(h).not.toContain("• Paciente");
  });
  it("turns the WhatsApp link into a labelled link", () => {
    expect(html("Listo")).toMatch(
      /href="https:\/\/wa\.me\/56948623705[^"]*"[^>]*>\s*Abrir WhatsApp\s*<\/a>/,
    );
  });
  it("signs once and ends with a footer that has the site, email and city", () => {
    const h = html("En cola");
    expect(h.match(/Atentamente/g)).toHaveLength(1);
    expect(h).toContain("contacto@monolabprintstudio.cl");
    expect(h).toContain("Santiago, Chile");
    expect(h).toContain("+56 9 4862 3705");
    expect(h).toContain('href="tel:+56948623705"');
  });
  it("includes a hidden preheader from the first paragraph", () => {
    expect(html("Listo")).toMatch(/display:none[^>]*>Su pedido ML-0001/);
  });
  it("escapes customer text everywhere and cannot break out of attributes", () => {
    const h = html("Cotizado", {
      nombre: "<script>alert(1)</script>",
      cotizacion: '<img src=x onerror=alert(1)> "q"',
      confirmLink: 'https://x.cl/c/a"onmouseover="alert(1)',
    });
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<img src=x");
    expect(h).not.toContain('"onmouseover="alert(1)');
  });
  it("keeps sheet-edited templates working: unknown layout still renders as paragraphs", () => {
    const e = buildEmail({ subject: "s", body: "Hola {{nombre}}\n\nSegundo párrafo" }, vars, {
      estado: "Listo",
    });
    expect(e.html).toContain("Hola Ana");
    expect(e.html).toContain("Segundo párrafo");
  });
});

const BANK = {
  titular: "Ana Pérez",
  rut: "11.111.111-1",
  banco: "Banco Ejemplo",
  tipo: "Cuenta Vista",
  cuenta: "000123",
  correo: "pagos@example.cl",
};

describe("bankBlock", () => {
  it("is empty without bank data", () => {
    expect(bankBlock(null, "ML-0001")).toBe("");
  });
  it("lists the account and tells the customer where to send the receipt", () => {
    const text = bankBlock(BANK, "ML-0001");
    expect(text.split("\n")[0]).toBe("Datos para transferir");
    for (const line of [
      "Titular: Ana Pérez",
      "RUT: 11.111.111-1",
      "Banco: Banco Ejemplo",
      "Tipo de cuenta: Cuenta Vista",
      "N° de cuenta: 000123",
      "Correo: pagos@example.cl",
    ])
      expect(text).toContain(line);
    expect(text).toMatch(/comprobante.*ML-0001/);
  });
  it("omits the Correo line when there is none", () => {
    expect(bankBlock({ ...BANK, correo: "" }, "ML-0001")).not.toContain("Correo:");
  });
});

describe("payment details in emails", () => {
  const vars = (datosPago: string) => ({
    nombre: "Ana",
    orderId: "ML-0001",
    cotizacion: "$45.000 CLP",
    whatsappLink: "https://wa.me/1",
    sitio: "https://monolabprintstudio.cl",
    datosPago,
  });
  it("Pago template shows the quote and the bank card in text and HTML", () => {
    const mail = buildEmail(DEFAULT_TEMPLATES.Pago, vars(bankBlock(BANK, "ML-0001")), {
      estado: "Pago",
    });
    expect(mail.subject).toBe("Pedido ML-0001 — datos para el pago");
    expect(mail.text).toContain("N° de cuenta: 000123");
    expect(mail.text).toContain("$45.000 CLP");
    expect(mail.html).toContain("Datos para transferir");
    expect(mail.html).toContain("000123");
    expect(mail.html).toContain("Datos de pago");
  });
  it("Confirmado template carries the bank card when configured", () => {
    const mail = buildEmail(DEFAULT_TEMPLATES.Confirmado, vars(bankBlock(BANK, "ML-0001")), {
      estado: "Confirmado",
    });
    expect(mail.text).toContain("Titular: Ana Pérez");
    expect(mail.html).toContain("11.111.111-1");
  });
  it("Confirmado is unchanged and leaves no gap when there is no bank data", () => {
    const mail = buildEmail(DEFAULT_TEMPLATES.Confirmado, vars(""), { estado: "Confirmado" });
    expect(mail.text).not.toMatch(/\n{3,}/);
    expect(mail.text).not.toContain("Datos para transferir");
    expect(mail.html).not.toContain("transferir");
  });
  it("escapes bank values in HTML", () => {
    const mail = buildEmail(
      { subject: "s", body: "{{datosPago}}" },
      vars(bankBlock({ ...BANK, titular: "<b>x</b>" }, "ML-0001")),
    );
    expect(mail.html).not.toContain("<b>x</b>");
  });
});
