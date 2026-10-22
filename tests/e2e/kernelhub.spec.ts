import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  readRecord,
  stored,
  STORAGE_KEY,
  waitForReady,
  writeRecord,
} from "./storage";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

test("dashboard is usable, explicitly simulated and fits narrow screens", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Um pouco melhor.Todos os dias.",
  );
  await expect(page.getByText("Dados de demonstração")).toBeVisible();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const sizes = await page
      .locator(".dashboard-grid > .glass-card")
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width),
      );
    expect(sizes.every((size) => size >= width - 44)).toBe(true);
  }
  const nav = page.getByRole("navigation", { name: "Navegação do iPhone" });
  await nav.getByRole("button", { name: "Corpo", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Sua melhor base.",
  );
  await nav.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Biometria demonstrativa" }),
  ).toBeVisible();
});

test("check-in saves perceived wellbeing and optional body measurements", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Fazer meu check-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Energia percebida: 4, Boa", exact: true })
    .click();
  await page.getByLabel("Sono de ontem (h)").fill("7.5");
  await page.getByLabel("Peso (kg)", { exact: false }).fill("76.5");
  await page.getByLabel("Passos de hoje", { exact: false }).fill("8500");
  await page.getByRole("button", { name: "Salvar meu check-in" }).click();
  await expect
    .poll(async () => (await stored(page)).checkin)
    .toEqual({
      energy: 4,
      mood: 3,
      stress: 2,
      sleepHours: 7.5,
      weightKg: 76.5,
      steps: 8500,
    });
  await page.reload();
  await waitForReady(page);
  await expect(
    page.getByRole("button", { name: "Revisar meu check-in" }),
  ).toBeVisible();
});

test("focus logs completed work and permits correcting a session", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Registrar bloco de foco", exact: true })
    .click();
  await page
    .getByLabel("O que avançou?", { exact: false })
    .fill("Entreguei o fluxo de login.");
  await page.getByRole("button", { name: "Registrar bloco concluído" }).click();
  await expect
    .poll(async () => (await stored(page)).focusSessions.length)
    .toBe(1);
  await expect(
    page.getByRole("dialog").getByText("Entreguei o fluxo de login."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remover bloco de 25 minutos" })
    .click();
  await expect
    .poll(async () => (await stored(page)).focusSessions.length)
    .toBe(0);
});

test("personal targets drive the visible nutrition and water goals", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page.getByLabel("Água (ml)", { exact: true }).fill("3000");
  await page.getByLabel("Proteína (g)", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Salvar minhas metas" }).click();
  await expect
    .poll(async () => (await stored(page)).targets.waterMl)
    .toBe(3000);
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await expect(
    page.getByRole("region", { name: "Nutrição e hidratação" }),
  ).toContainText("3 L");
  await expect(
    page.getByRole("region", { name: "Nutrição e hidratação" }),
  ).toContainText("2.270");
});

test("backups validate before explicit replacement and preserve data on errors", async ({
  page,
}) => {
  const current = await stored(page);
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page.getByRole("button", { name: "Dados & privacidade" }).click();
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "não é um backup válido",
  );
  expect((await stored(page)).waterMl).toBe(current.waterMl);
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...current, waterMl: 2250 })),
  });
  await expect(page.getByText("Restaurar este backup?")).toBeVisible();
  expect((await stored(page)).waterMl).toBe(current.waterMl);
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "invalid-after-valid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByText("Restaurar este backup?")).not.toBeVisible();
  expect((await stored(page)).waterMl).toBe(current.waterMl);
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...current, waterMl: 2250 })),
  });
  await page
    .getByRole("button", { name: "Restaurar registros", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(2250);
});

test("personal space requires confirmation and stops displaying fictional integrations", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page.getByRole("button", { name: "Dados & privacidade" }).click();
  await page.getByRole("button", { name: "Criar meu espaço pessoal" }).click();
  expect((await stored(page)).mode).toBe("demo");
  await page.getByRole("button", { name: "Começar sem exemplos" }).click();
  await expect.poll(async () => (await stored(page)).mode).toBe("personal");
  await expect(page.locator(".battery-status")).toHaveText("—");
  await expect(page.locator(".deploy-status")).toHaveText("—deploys");
  await expect(page.getByText("Seu espaço · dados locais")).toBeVisible();
  expect((await stored(page)).history).toHaveLength(0);
  expect((await stored(page)).wishlist).toHaveLength(0);
});

test("invalid local data is preserved in a recovery file", async ({ page }) => {
  await writeRecord(page, '{"incompleto":');
  await page.reload();
  await waitForReady(page);
  await expect(
    page.getByText("Um registro antigo incompatível foi preservado.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(await readRecord(page, `${STORAGE_KEY}:recovery`)).toBe(
    '{"incompleto":',
  );
});

test("water and habits update and survive a reload", async ({ page }) => {
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(1750);
  await page
    .getByRole("checkbox", { name: "Suplementação", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Suplementação", exact: true }),
  ).toBeChecked();
  await page.reload();
  await waitForReady(page);
  await expect(
    page.getByRole("checkbox", { name: "Suplementação", exact: true }),
  ).toBeChecked();
  expect((await stored(page)).waterMl).toBe(1750);
});

test("strength sets, undo and running are real local actions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Continuar meu treino" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "Remada baixa: 2 séries concluídas",
      exact: true,
    })
    .click();
  await expect.poll(async () => (await stored(page)).exercises.row).toBe(2);
  await dialog
    .getByRole("button", { name: "Desfazer série de Remada baixa" })
    .click();
  await expect.poll(async () => (await stored(page)).exercises.row).toBe(1);
  await dialog.getByRole("button", { name: "Corrida", exact: true }).click();
  await dialog.getByRole("button", { name: "Registrar 1 km" }).click();
  await expect.poll(async () => (await stored(page)).runKm).toBe(1);
  await dialog.getByRole("button", { name: "Fechar painel" }).click();
  await expect(dialog).not.toBeVisible();
});

test("meal logging updates individual macros and calories", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Registrar refeição" }).click();
  await page.getByLabel("Nome da refeição").fill("Almoço");
  await page.locator("#protein").fill("30");
  await page.locator("#carbs").fill("40");
  await page.locator("#fat").fill("10");
  await page.getByRole("button", { name: "Salvar refeição" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(async () => (await stored(page)).nutrition)
    .toEqual({ protein: 144, carbs: 226, fat: 58 });
  await expect(
    page.getByRole("region", { name: "Nutrição e hidratação" }),
  ).toContainText("2.002");
});

test("learning records lessons and preserves an insight", async ({ page }) => {
  await page.getByRole("button", { name: "Continuar aprendendo" }).click();
  await page
    .getByRole("button", { name: "Concluir aula", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).courseProgress.architecture)
    .toBe(8);
  await page
    .getByLabel("O que ficou dessa aula?")
    .fill("O domínio deve ser independente da infraestrutura.");
  await page.getByRole("button", { name: "Guardar insight" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("O domínio deve ser independente da infraestrutura."),
  ).toBeVisible();
  await page.reload();
  await waitForReady(page);
  await page.getByRole("button", { name: "Continuar aprendendo" }).click();
  await expect(
    page.getByText("O domínio deve ser independente da infraestrutura."),
  ).toBeVisible();
});

test("wishlist supports creating, acquiring and reverting a planned item", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Organizar minha wishlist" }).click();
  await page
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await page.getByLabel("O que você quer adquirir?").fill("Fones para corrida");
  await page
    .getByLabel("Qual objetivo esse item atende?")
    .fill("Mais conforto ao correr");
  await page.getByLabel("Valor estimado (R$)").fill("199.9");
  await page.getByLabel("Prioridade", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Guardar nos meus planos" }).click();
  const item = page
    .locator(".wishlist-sheet-list>div")
    .filter({ hasText: "Fones para corrida" });
  await item.getByRole("button", { name: "Marcar como adquirido" }).click();
  await page.getByRole("button", { name: /Adquiridos/ }).click();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Voltar para planejados" }).click();
  await page.getByRole("button", { name: /Planejados/ }).click();
  await expect(item).toBeVisible();
  expect((await stored(page)).wishlist).toHaveLength(4);
});

test("activity filters distinguish commits, PRs and deploys", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Explorar atividade/ }).click();
  await expect(page.locator(".git-feed>div")).toHaveCount(6);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Deploys", exact: true })
    .click();
  await expect(page.locator(".git-feed>div")).toHaveCount(2);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Commits", exact: true })
    .click();
  await expect(page.locator(".git-feed>div")).toHaveCount(3);
});

test("sheet traps keyboard focus, restores it and dismisses by swipe", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Ver minha recuperação" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const handle = page.locator(".sheet-drag-zone");
  await handle.hover();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Drag handle unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 110, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(dialog).not.toBeVisible();
});

test("dashboard and lower sheet pass automated accessibility checks", async ({
  page,
}) => {
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.getByRole("button", { name: "Continuar meu treino" }).click();
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("PWA manifest, icons and first-visit offline interactions work", async ({
  page,
  context,
}) => {
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).status()).toBe(200);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await expect(
    page.getByText("Você está offline.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(1750);
  await context.setOffline(false);
});
