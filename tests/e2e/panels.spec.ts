import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { waitForReady } from "./storage";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

test("laptop and wide desktop use a full workspace and keep the editing draft on resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .getByRole("button", { name: "Abrir armário de skincare", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box?.width;
    })
    .toBe(1366);
  expect((await dialog.boundingBox())!.height).toBe(768);
  await expect(page.locator(".sheet-drag-zone")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Expandir painel" }),
  ).toBeHidden();
  const columns = await page
    .locator(".sk-routine-workspace")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(2);
  await dialog.getByRole("button", { name: "Produtos", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Adicionar produto", exact: true })
    .click();
  await dialog
    .getByLabel("Nome do produto", { exact: true })
    .fill("Creme em edição");
  const notebookTitleSize = await page
    .locator("#sheet-title")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(
    dialog.getByLabel("Nome do produto", { exact: true }),
  ).toHaveValue("Creme em edição");
  expect((await dialog.boundingBox())!.width).toBe(1920);
  expect(
    await page
      .locator("#sheet-title")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThan(notebookTitleSize);
  const form = await page.locator(".sk-product-form").boundingBox();
  const library = await page.locator(".sk-product-library").boundingBox();
  expect(form!.x + form!.width).toBeLessThan(library!.x);
  await expect(
    page.getByText("Voltar ao painel", { exact: true }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "Abrir armário de skincare",
      exact: true,
    }),
  ).toBeFocused();
});

test("mobile opens taller, expands and collapses by button and swipe, then closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Fontes e conexões", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-expanded", "false");
  const initial = (await dialog.boundingBox())!;
  expect(initial.height).toBeGreaterThan(844 * 0.8);
  await page
    .getByRole("button", { name: "Expandir painel", exact: true })
    .click();
  await expect(dialog).toHaveAttribute("data-expanded", "true");
  expect((await dialog.boundingBox())!.height).toBeGreaterThan(
    initial.height + 60,
  );
  await page
    .getByRole("button", { name: "Reduzir painel", exact: true })
    .click();
  const drag = async (delta: number) => {
    await page.locator(".sheet-drag-zone").hover();
    const box = (await page.locator(".sheet-drag-zone").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2 + delta,
      { steps: 12 },
    );
    await page.mouse.up();
  };
  await drag(-90);
  await expect(dialog).toHaveAttribute("data-expanded", "true");
  await drag(110);
  await expect(dialog).toHaveAttribute("data-expanded", "false");
  await drag(110);
  await expect(dialog).toBeHidden();
});

test("mobile editing expands and follows the visible viewport without losing input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page.getByLabel("Nome da refeição").fill("Almoço em edição");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-expanded", "true");
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      get: () => 400,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".sheet-layer")).toHaveAttribute(
    "data-keyboard",
    "true",
  );
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(401);
  await expect(page.getByLabel("Nome da refeição")).toHaveValue(
    "Almoço em edição",
  );
  await expect(
    page.getByRole("button", { name: "Fechar painel", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.locator(".sheet-layer")).toHaveAttribute(
    "data-desktop",
    "true",
  );
  await expect(page.getByLabel("Nome da refeição")).toHaveValue(
    "Almoço em edição",
  );
  await expect
    .poll(async () => Math.round((await dialog.boundingBox())!.height))
    .toBe(768);
});
