import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signConfirmToken } from "@/lib/confirm-token";

process.loadEnvFile(".env");

test("an unknown link shows the unavailable state with a way back", async ({ page }) => {
  await page.goto("/confirmar/no-es-un-enlace");
  await expect(page.getByRole("alert")).toContainText("Enlace no disponible");
  await expect(page.getByRole("link", { name: "Volver al sitio" })).toBeVisible();
});

test("a customer opens the quote link, confirms, and sees how far the order is", async ({
  page,
  request,
}) => {
  const upload = await request.put("/api/uploads?name=cube.stl", {
    headers: { "content-type": "application/octet-stream" },
    data: await readFile("tests/fixtures/cube-10.stl"),
  });
  const { token: file } = await upload.json();
  const order = await request.post("/api/orders", {
    data: {
      nombre: "Dra. Rojas",
      paciente: "C. R.",
      email: "doc@example.com",
      telefono: "+56 9 4862 3705",
      resina: "Estándar",
      entrega: "Normal",
      cantidad: 1,
      notas: "",
      empresa: "",
      files: [
        {
          token: file,
          name: "cube.stl",
          volumeCm3: 1,
          size: { x: 10, y: 10, z: 10 },
          scalePercent: 100,
        },
      ],
    },
  });
  const { id } = await order.json();

  // The operator quotes the order in the (mock) sheet.
  const sheet = "data/smoke/mock/pedidos.json";
  const rows = JSON.parse(await readFile(sheet, "utf8")) as string[][];
  const row = rows.find((r) => r[0] === id) as string[];
  const quote = "$32.000 CLP por 1 pieza. Plazo: 7 días.";
  row[2] = "Cotizado";
  row[16] = quote;
  await writeFile(sheet, JSON.stringify(rows));

  const token = signConfirmToken(id, quote, process.env.CONFIRM_SECRET as string);
  await page.goto(`/confirmar/${token}`);
  await expect(page.getByRole("heading", { name: "Confirma tu cotización" })).toBeVisible();
  await expect(page.getByText(`Pedido ${id}`)).toBeVisible();
  await expect(page.getByText(quote)).toBeVisible();
  await expect(page.getByText("Cotización lista")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar cotización" }).click();
  await expect(page.getByRole("status")).toContainText("Gracias, quedó confirmada");
  await expect(page.getByRole("listitem").filter({ hasText: "Producción" })).toContainText(
    "etapa actual",
  );

  // Visiting the same link again shows the confirmed state, never the button.
  await page.goto(`/confirmar/${token}`);
  await expect(page.getByRole("button", { name: "Confirmar cotización" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Pedido " + id);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the confirmation card fits without sideways scrolling", async ({ page }) => {
    await page.goto("/confirmar/no-es-un-enlace");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
