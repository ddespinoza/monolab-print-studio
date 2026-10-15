/**
 * Live integration test against real Google and SMTP. Never runs in CI.
 * Creates a TEST-ML-XXXX Drive folder and sheet row, verifies them, deletes them,
 * and sends exactly one email to OPERATOR_EMAIL.
 */
import { Readable } from "node:stream";
import { parseEnv } from "@/lib/config";
import { driveFrom, sheetsFrom } from "@/lib/google";
import { createMailer, createSmtpTransport } from "@/lib/mailer";
import { buildOrderRow } from "@/lib/order-row";
import { buildEmail, DEFAULT_TEMPLATES } from "@/lib/templates";
import { formatTimestamp } from "@/lib/time";

async function main(): Promise<void> {
  const cfg = parseEnv(process.env);
  if (cfg.mock || cfg.nodeEnv === "production" || !cfg.google) {
    throw new Error("test:live refuses to run with MOCK_APIS=true or NODE_ENV=production");
  }
  const id = `TEST-ML-${String(Date.now()).slice(-6)}`;
  const drive = driveFrom(cfg.google);
  const sheets = sheetsFrom(cfg.google, cfg.sheetTab);
  const mailer = createMailer(createSmtpTransport(cfg.smtp), cfg);

  const folder = await drive.createOrderFolder(id);
  let rowNumber: number | undefined;
  try {
    await drive.uploadFile(folder.id, "test.stl", () =>
      Readable.from(["solid test\nendsolid test\n"]),
    );
    const order = {
      nombre: "TEST",
      email: cfg.operatorEmail,
      whatsapp: "+56 9 0000 0000",
      ciudad: "TEST",
      material: "PLA",
      color: "",
      relleno: 20 as const,
      cantidad: 1,
      notas: "live test",
      empresa: "",
      files: [
        { token: "0".repeat(32), name: "test.stl", volumeCm3: 1, size: { x: 1, y: 1, z: 1 } },
      ],
    };
    const appended = await sheets.appendOrder(
      buildOrderRow({ id, fecha: formatTimestamp(new Date()), order, driveLink: folder.link }),
    );
    rowNumber = appended.rowNumber;
    if (!(await sheets.readIds()).includes(id))
      throw new Error("Appended row not found when reading back");
    const mail = buildEmail(DEFAULT_TEMPLATES.Recibido, {
      nombre: "TEST",
      orderId: id,
      resumen: "• prueba",
      whatsappLink: cfg.siteUrl,
      sitio: cfg.siteUrl,
    });
    await mailer.send({ to: cfg.operatorEmail, ...mail });
    console.log(`OK  folder=${folder.id} row=${rowNumber} mail=sent`);
  } finally {
    if (rowNumber !== undefined) await sheets.deleteRow(rowNumber);
    await drive.remove(folder.id);
    console.log("OK  cleaned up test folder and row");
  }
}

main().catch((error: unknown) => {
  console.error("FAIL", error);
  process.exit(1);
});
