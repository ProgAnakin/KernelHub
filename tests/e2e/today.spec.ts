import { test, expect } from "@playwright/test";
import { goSection, stored, waitForReady } from "./storage";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

test("Hoje offers the next action and quick records inside the first screen", async ({
  page,
}) => {
  const next = page.getByRole("region", { name: "Próximo passo", exact: true });
  await expect(next).toBeVisible();
  const primary = next.getByRole("button", {
    name: "Próximo passo: Fazer meu check-in",
  });
  await expect(primary).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await primary.boundingBox())!;
  // The primary action is reachable without scrolling on a phone and a laptop.
  expect(box.y + box.height).toBeLessThan(viewport.height);
  const quick = next.getByRole("group", { name: "Atalhos de registro" });
  const waterBefore = (await stored(page)).waterMl;
  await quick.getByRole("button", { name: "Atalho: +250 ml de água" }).click();
  await expect
    .poll(async () => (await stored(page)).waterMl)
    .toBe(waterBefore + 250);
  await expect(page.getByRole("status")).toContainText("+250 ml");

  await primary.click();
  await expect(page.getByRole("dialog")).toContainText("Um momento para você.");
});

test("an imported file offers sleep, weight and steps for the check-in without saving them", async ({
  page,
}) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const record = (
    type: string,
    value: string,
    unit: string,
    start: string,
    end: string,
    source: string,
  ) =>
    `<Record type="${type}" sourceName="${source}" unit="${unit}" value="${value}" startDate="${start}" endDate="${end}"/>`;
  const xml = `<?xml version="1.0"?><HealthData>${[
    record(
      "HKCategoryTypeIdentifierSleepAnalysis",
      "HKCategoryValueSleepAnalysisAsleepCore",
      "",
      `${yesterday} 16:20:20 +0000`,
      `${today} 00:00:20 +0000`,
      "Relógio de teste",
    ),
    record(
      "HKQuantityTypeIdentifierStepCount",
      "8421",
      "count",
      `${today} 00:00:05 +0000`,
      `${today} 00:00:10 +0000`,
      "Relógio de teste",
    ),
    record(
      "HKQuantityTypeIdentifierBodyMass",
      "76.44",
      "kg",
      `${today} 00:00:05 +0000`,
      `${today} 00:00:06 +0000`,
      "Balança de teste",
    ),
  ].join("")}</HealthData>`;
  await page.getByRole("button", { name: /Fontes (?:&|e) conexões/ }).click();
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "export.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  await expect(
    page
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByText("Arquivo importado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel" }).click();

  await page
    .getByRole("button", { name: "Fazer meu check-in", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const sleep = dialog.getByRole("button", { name: /sono importado/ });
  await expect(sleep).toContainText("7h40");
  await expect(sleep).toContainText("Relógio de teste");
  await expect(dialog.getByLabel("Sono de ontem (h)")).toHaveValue("");
  await sleep.click();
  await expect(dialog.getByLabel("Sono de ontem (h)")).toHaveValue("7.7");
  await expect(sleep).toBeHidden();
  await dialog.getByRole("button", { name: /peso importado/ }).click();
  await dialog.getByRole("button", { name: /passos importados/ }).click();
  expect((await stored(page)).checkin).toBeNull();
  await dialog.getByRole("button", { name: "Salvar meu check-in" }).click();
  await expect
    .poll(async () => (await stored(page)).checkin)
    .toMatchObject({ sleepHours: 7.7, weightKg: 76.4, steps: 8421 });
});

test("today shows the rings; evolution keeps a 13-week grid that keeps gaps empty", async ({
  page,
}) => {
  const rings = page.getByRole("region", {
    name: "Ritmo de hoje e constância",
  });
  await expect(rings).toBeVisible();
  await expect(rings.getByRole("img").first()).toHaveAttribute(
    "aria-label",
    /Foco: \d+% da meta; Água: 60% da meta/,
  );
  await expect(page.locator(".kr-grid")).toHaveCount(0);
  await goSection(page, "evolucao");
  const card = page.getByRole("region", { name: "Constância" });
  await expect(card).toBeVisible();
  const grid = card.locator(".kr-grid i:not([data-level='pad'])");
  await expect(grid).toHaveCount(91);
  // Demo history covers only the last days; earlier days are "no record".
  expect(await card.locator(".kr-grid i[data-level='none']").count()).toBe(84);
  await card.getByRole("button", { name: "Água", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Água", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator(".kr-grid")).toHaveAttribute(
    "aria-label",
    /^Água: \d+ dias com meta alcançada em 7 dias/,
  );
});

test("sections live in the URL: reload keeps them and Back returns", async ({
  page,
}) => {
  const heading = page.getByRole("heading", { level: 1 });
  await page
    .getByRole("button", { name: "Corpo", exact: true })
    .first()
    .click();
  await expect(heading).toHaveText("Corpo");
  expect(new URL(page.url()).hash).toBe("#corpo");
  await page.reload();
  await waitForReady(page);
  await expect(heading).toHaveText("Corpo");
  await page.goBack();
  await expect(heading).toHaveText("Hoje");
  await page.goto("/#colecao");
  await waitForReady(page);
  await expect(heading).toHaveText("Coleção");
  await page.goto("/#evoluir");
  await waitForReady(page);
  await expect(heading).toHaveText("Foco");
});
