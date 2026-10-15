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
  await page.getByLabel("Teléfono *").fill("+56 9 4862 3705");
  await page.getByLabel("Correo electrónico *").fill("doc@example.com");
  await page.getByRole("button", { name: "Solicitar cotización" }).last().click();
  const panel = page.getByRole("status");
  await expect(panel).toContainText("Recibimos su solicitud");
  return (await panel.locator("p").first().textContent()) ?? "";
}

test("a customer uploads a model, sees metrics and places two sequential orders", async ({
  page,
}) => {
  const first = await placeOrder(page, "tests/fixtures/cube-10.stl");
  const second = await placeOrder(page, "tests/fixtures/cube-10.stl");
  expect(first).toMatch(/^ML-\d{4}$/);
  expect(Number(second.slice(3))).toBe(Number(first.slice(3)) + 1);
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

test("shows a loading screen in the viewer while a large model is being read", async ({ page }) => {
  await page.goto("/");
  // ~25 MB binary STL (500k triangles) so reading takes long enough to observe.
  const triangles = 500_000;
  const buffer = Buffer.alloc(84 + triangles * 50);
  buffer.writeUInt32LE(triangles, 80);
  for (let i = 0; i < triangles; i++) {
    const o = 84 + i * 50;
    const x = (i % 700) * 0.1;
    const y = Math.floor(i / 700) * 0.1;
    [x, y, 0, x + 0.1, y, 0, x, y + 0.1, 1].forEach((v, k) =>
      buffer.writeFloatLE(v, o + 12 + k * 4),
    );
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: "grande.stl",
    mimeType: "model/stl",
    buffer,
  });
  const loading = page.getByRole("status").filter({ hasText: "Leyendo grande.stl" });
  await expect(loading).toBeVisible({ timeout: 10_000 });
  await expect(loading).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole("img", { name: /Vista previa 3D/ })).toBeVisible();
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("has no horizontal scroll and stacks the viewer above the form", async ({ page }, info) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/box-20x10x5.stl");
    await expect(page.getByText("1,0 cm³").first()).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const viewer = await page.getByRole("img", { name: /Vista previa 3D/ }).boundingBox();
    const form = await page.getByRole("form", { name: "Datos de la solicitud" }).boundingBox();
    expect(viewer && form && viewer.y < form.y).toBe(true);
    await page.locator("#pedido").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("phone-order.png") });
  });

  test("has finger-sized controls and the WhatsApp button never covers the form", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/oversize.stl");
    await expect(page.getByText("AUTO", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Modo avanzado" }).click();
    const heights = await page
      .locator("#pedido button:visible")
      .evaluateAll((els) =>
        els.map((e) => [e.textContent?.trim(), e.getBoundingClientRect().height]),
      );
    const tooSmall = heights.filter(([, h]) => (h as number) < 40);
    expect(tooSmall).toEqual([]);
    await page.locator("#pedido").scrollIntoViewIfNeeded();
    await expect(page.locator("a.fixed")).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("a.fixed")).toBeVisible();
  });
});
