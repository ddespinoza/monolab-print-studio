/**
 * Writes one HTML file per email state with sample data, to open in a browser.
 * Usage: tsx scripts/preview-emails.ts <outDir> [siteUrl]   (siteUrl decides where the logo is loaded from)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildResumen, buildEmail, DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";

const [outDir, siteUrl = "https://monolabprintstudio.cl"] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: tsx scripts/preview-emails.ts <outDir> [siteUrl]");
mkdirSync(outDir, { recursive: true });

const vars = {
  nombre: "Dra. Camila Rojas",
  orderId: "ML-0042",
  sitio: siteUrl,
  whatsappLink: "https://wa.me/56948623705?text=Hola%2C%20consulto%20por%20mi%20pedido%20ML-0042",
  retiro: "Río Guadiana 8672, Las Condes, Santiago",
  cotizacion: "$32.000 CLP por 3 piezas (Resina Tough). Plazo: 7 días hábiles.",
  confirmLink: `${siteUrl}/confirmar/ML-0042.firma`,
  resumen: buildResumen({
    files: [
      { name: "arcada_superior.stl", volumeCm3: 12.99, size: { x: 62.9, y: 32.2, z: 54.5 } },
      {
        name: "guia_quirurgica.stl",
        volumeCm3: 4.14,
        size: { x: 18.8, y: 28.1, z: 39.5 },
        scalePercent: 100,
      },
    ],
    paciente: "C. R.",
    resina: "Resina Tough",
    cantidad: 3,
    entrega: "Normal",
  }),
};

for (const key of Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]) {
  const email = buildEmail(DEFAULT_TEMPLATES[key], vars, { estado: key });
  writeFileSync(join(outDir, `${key.replace(/\s+/g, "-")}.html`), email.html);
}
console.log(`wrote ${Object.keys(DEFAULT_TEMPLATES).length} previews to ${outDir}`);
