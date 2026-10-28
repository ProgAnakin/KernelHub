import { test, expect } from "@playwright/test";
import { readRecord, stored, waitForReady } from "./storage";

const SETTINGS_KEY = "kernelhub:skincare:settings:v1";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

async function openProductForm(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Abrir armário de skincare", exact: true })
    .click();
  const root = page.locator('.skincare-module[aria-busy="false"]');
  await expect(root).toBeVisible();
  await root.getByRole("button", { name: "Produtos", exact: true }).click();
  await root
    .getByRole("button", { name: "Adicionar produto", exact: true })
    .click();
  return root;
}

test("a half-filled product survives tab switches and asks before the panel closes", async ({
  page,
}) => {
  const root = await openProductForm(page);
  const name = root.getByLabel("Nome do produto", { exact: true });
  await name.fill("Sérum de vitamina C");

  // Leaving the Products tab must not drop the form.
  await root.getByRole("button", { name: "A rotina", exact: true }).click();
  await root.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(name).toHaveValue("Sérum de vitamina C");

  const dialog = page.getByRole("dialog").first();
  await dialog
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Descartar o que você preencheu?");
  await expect(
    confirm.getByRole("button", { name: "Continuar editando" }),
  ).toBeFocused();
  await expect(name).toHaveValue("Sérum de vitamina C");

  // Escape on the confirmation keeps editing; it does not close the panel.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(name).toHaveValue("Sérum de vitamina C");

  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Descartar e fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await readRecord(page, SETTINGS_KEY)).not.toContain("vitamina");

  // The discarded draft is gone on the next visit.
  const again = await openProductForm(page);
  await expect(
    again.getByLabel("Nome do produto", { exact: true }),
  ).toHaveValue("");
});

test("clean panels close at once and a saved form is no longer a draft", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  const dialog = page.getByRole("dialog");
  // Untouched: no confirmation.
  await dialog.getByRole("button", { name: "Fechar painel" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page.getByLabel("Água (ml)", { exact: true }).fill("2750");
  await dialog.getByRole("button", { name: "Fechar painel" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Continuar editando" }).click();
  await page.getByRole("button", { name: "Salvar minhas metas" }).click();
  await expect
    .poll(async () => (await stored(page)).targets.waterMl)
    .toBe(2750);
  // Saved values are the new baseline, even before the state echo arrives.
  await dialog.getByRole("button", { name: "Fechar painel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("a target field can be cleared while typing instead of snapping to zero", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  const water = page.getByLabel("Água (ml)", { exact: true });
  await water.fill("");
  await expect(water).toHaveValue("");
  await page.getByRole("button", { name: "Salvar minhas metas" }).click();
  // The browser blocks the submit and flags the empty field; nothing is saved.
  expect(
    await water.evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);
  expect((await stored(page)).targets.waterMl).toBe(2500);
});

test("a meal accepts decimal grams from a label and keeps exact totals", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Registrar refeição" }).click();
  await page.getByLabel("Nome da refeição").fill("Iogurte");
  await page.locator("#protein").fill("7.5");
  await page.locator("#carbs").fill("12.3");
  await page.locator("#fat").fill("2.5");
  await page.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await stored(page)).nutrition)
    .toEqual({ protein: 121.5, carbs: 198.3, fat: 50.5 });
});
