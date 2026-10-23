import { chromium, devices } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const origin = process.env.SCREENSHOT_URL ?? "http://localhost:3030";
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
  await page.clock.install({ time: new Date("2026-10-23T10:30:00+02:00") });
  await page.goto(origin);
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  await page.screenshot({ path: "docs/images/iphone-today.png" });
  await page
    .getByRole("button", { name: "Fontes e conexões", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.waitForFunction(
    () =>
      Number(
        getComputedStyle(document.querySelector(".bottom-sheet")).opacity,
      ) > 0.995,
  );
  await page.screenshot({ path: "docs/images/iphone-sources.png" });
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page.clock.runFor(500);
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Iniciar foco", exact: true }).click();
  await page.getByRole("button", { name: /^50\s?min$/ }).click();
  await page
    .getByLabel("Uma intenção", { exact: false })
    .fill("Construir a próxima etapa do projeto");
  await page.waitForFunction(
    () =>
      Number(
        getComputedStyle(document.querySelector(".bottom-sheet")).opacity,
      ) > 0.995,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Iniciar foco", exact: true })
    .click();
  await page.getByRole("button", { name: "Pausar", exact: true }).waitFor();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.locator(".sheet-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: "docs/images/iphone-focus.png" });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    locale: "pt-BR",
    timezoneId: "Europe/Rome",
    reducedMotion: "reduce",
  });
  const overview = await desktop.newPage();
  await overview.clock.setFixedTime(new Date("2026-10-23T10:30:00+02:00"));
  await overview.goto(origin);
  await overview.locator('.app-background[aria-busy="false"]').waitFor();
  await overview.screenshot({
    path: "docs/images/overview.png",
    fullPage: true,
  });
  console.log("Demo-only screenshots saved in docs/images.");
} finally {
  await browser.close();
}
