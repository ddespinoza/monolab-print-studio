import { expect, test, type Page } from "@playwright/test";

async function placeOrder(page: Page, file: string): Promise<string> {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "100", {
    timeout: 20_000,
  });
  await expect(page.getByText("1,0 cm³").first()).toBeVisible();
  await page.getByLabel("Nombre del odontólogo/a *").fill("Dra. Matías Gómez");
  await page.getByLabel("Iniciales del paciente *").fill("A. P.");
  await page.getByLabel("WhatsApp *").fill("+56 9 4862 3705");
  await page.getByLabel("Correo electrónico *").fill("doc@example.com");
  await page.getByRole("button", { name: "Solicitar cotización" }).last().click();
  const panel = page.getByRole("status");
  await expect(panel).toContainText("Recibimos su solicitud");
  return (await panel.locator("p").first().textContent()) ?? "";
}

test("a customer uploads a model, sees metrics and places two sequential orders", async ({
  page,
}) => {
  expect(await placeOrder(page, "tests/fixtures/cube-10.stl")).toBe("ML-0001");
  expect(await placeOrder(page, "tests/fixtures/cube-10.stl")).toBe("ML-0002");
});

test("shows a Spanish error for unsupported or unreadable files and keeps the form locked", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("Solo aceptamos archivos STL, OBJ o PLY.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/broken.stl");
  await expect(page.getByText("No pudimos leer este archivo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar cotización" }).last()).toBeDisabled();
});

test("auto-fits an oversize model in simple mode and blocks it in advanced mode", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/oversize.stl");
  await expect(page.getByText("AUTO", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await page.getByRole("button", { name: "100 %", exact: true }).click();
  await expect(page.getByText("Este modelo excede el volumen de impresión")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar cotización" }).last()).toBeDisabled();
});
