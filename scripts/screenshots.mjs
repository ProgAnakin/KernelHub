import { chromium, devices } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const origin = process.env.SCREENSHOT_URL ?? "http://localhost:3002";
mkdirSync("docs/images", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "pt-BR",
    timezoneId: "Europe/Rome",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-22T17:30:00+02:00"));
  await page.goto(origin);
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  await page.screenshot({ path: "docs/images/iphone-today.png" });
  await page
    .getByRole("button", { name: "Fazer meu check-in", exact: true })
    .click();
  await page.getByRole("button", { name: "Fechar painel" }).hover();
  await page
    .getByRole("button", { name: "Energia percebida: 4, Boa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Humor: 4, Bem", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        getComputedStyle(document.querySelector(".bottom-sheet")).opacity,
      ) > 0.995,
  );
  await page.screenshot({ path: "docs/images/iphone-checkin.png" });
  await page.getByLabel("Sono de ontem (h)").fill("7.5");
  await page.getByLabel("Peso (kg)", { exact: false }).fill("76.4");
  await page.getByLabel("Passos de hoje", { exact: false }).fill("8200");
  await page.getByRole("button", { name: "Salvar meu check-in" }).click();
  await page
    .getByRole("button", { name: "Registrar bloco de foco", exact: true })
    .click();
  await page.getByRole("button", { name: "50 min", exact: true }).click();
  await page
    .getByLabel("O que avançou?", { exact: false })
    .fill("Entreguei a próxima etapa do projeto.");
  await page.getByRole("button", { name: "Registrar bloco concluído" }).click();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.locator(".toast").waitFor({ state: "detached" });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/images/overview.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page.getByLabel("Nome da refeição").fill("Almoço");
  await page.locator("#protein").fill("30");
  await page.locator("#carbs").fill("45");
  await page.locator("#fat").fill("12");
  await page
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.locator(".toast").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page.locator(".meal-entry-list").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      Number(
        getComputedStyle(document.querySelector(".bottom-sheet")).opacity,
      ) > 0.995,
  );
  await page.screenshot({ path: "docs/images/iphone-nutrition.png" });
  console.log("Demo-only interface screenshots saved in docs/images.");
} finally {
  await browser.close();
}
