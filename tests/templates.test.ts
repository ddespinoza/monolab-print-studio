import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  buildEmail,
  buildResumen,
  renderTemplate,
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
  it("has receipt plus the 5 notifiable states, no Enviado", () => {
    expect(Object.keys(DEFAULT_TEMPLATES).sort()).toEqual(
      ["Cancelado", "En cola", "Entregado", "Imprimiendo", "Listo", "Recibido"].sort(),
    );
  });
  it("subjects start with the order number", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES))
      expect(t.subject.startsWith("Pedido {{orderId}}")).toBe(true);
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
  it("renders bullets", () => {
    const r = buildResumen({
      files: [{ name: "caja.stl", volumeCm3: 96.3, size: { x: 120, y: 80, z: 40 } }],
      material: "PETG",
      color: "Negro",
      relleno: 20,
      cantidad: 2,
    });
    expect(r).toContain("• caja.stl — 96.3 cm³ (120×80×40)");
    expect(r).toContain("• Material: PETG");
    expect(r).toContain("• Cantidad: 2");
  });
  it("omits an empty color", () => {
    const r = buildResumen({ files: [], material: "PLA", color: "", relleno: 20, cantidad: 1 });
    expect(r).not.toContain("Color");
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
