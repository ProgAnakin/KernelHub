import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { stored, waitForReady } from "./storage";

const beforeMidnight = new Date("2026-10-22T21:59:00Z");
const afterMidnight = new Date("2026-10-22T22:01:00Z");
test.use({ timezoneId: "Europe/Rome" });

async function blockWrites(page: Page) {
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as typeof window & { allowDatabase: () => void }).allowDatabase =
      () => {
        IDBObjectStore.prototype.put = put;
      };
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "kernelhub:state:v1")
        throw new DOMException("Test quota", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
}
const allowWrites = (page: Page) =>
  page.evaluate(() =>
    (window as typeof window & { allowDatabase: () => void }).allowDatabase(),
  );
const water = (page: Page) =>
  page.getByRole("button", { name: "Adicionar 250 ml de água", exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(beforeMidnight);
  await page.goto("/");
  await waitForReady(page);
});

test("retry after midnight saves yesterday's pending water before rolling the day", async ({
  page,
}) => {
  await blockWrites(page);
  await water(page).click();
  await expect(page.locator(".kp-water strong")).toContainText("1,75");
  expect((await stored(page)).waterMl).toBe(1500);
  await page.clock.setFixedTime(afterMidnight);
  await allowWrites(page);
  await water(page).click();
  await expect.poll(async () => (await stored(page)).day).toBe("2026-10-23");
  const saved = await stored(page);
  expect(saved.waterMl).toBe(250);
  expect(saved.history.find((day) => day.day === "2026-10-22")?.waterMl).toBe(
    1750,
  );
  expect(saved.journal[1].createdAt).toBe(beforeMidnight.toISOString());
  await expect(
    page.getByText("O navegador bloqueou o armazenamento.", { exact: false }),
  ).toBeHidden();
});

test("an already archived day preserves both snapshots until explicit backup selection", async ({
  page,
  context,
}) => {
  await blockWrites(page);
  await water(page).click();
  await expect(page.locator(".kp-water strong")).toContainText("1,75");
  await page.clock.setFixedTime(afterMidnight);
  const other = await context.newPage();
  await other.clock.setFixedTime(afterMidnight);
  await other.goto("/");
  await waitForReady(other);
  await water(other).click();
  await water(other).click();
  await expect.poll(async () => (await stored(other)).waterMl).toBe(500);
  await allowWrites(page);
  await water(page).click();
  const notice = page.getByText("Há registros pendentes de outro dia", {
    exact: false,
  });
  await expect(notice).toBeVisible();
  const canonical = await stored(page);
  expect(canonical.waterMl).toBe(500);
  expect(
    canonical.history.find((day) => day.day === "2026-10-22")?.waterMl,
  ).toBe(1500);
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page
    .getByRole("button", { name: "Dados & privacidade", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar backup", exact: true })
    .click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).not.toBeNull();
  const contents = await readFile(path!, "utf8");
  // The envelope carries the in-memory session, not the newer stored state.
  const session = JSON.parse(contents).core;
  expect(session.waterMl).toBe(250);
  expect(
    session.history.find((day: { day: string }) => day.day === "2026-10-22")
      .waterMl,
  ).toBe(1750);
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "selected-session.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  expect((await stored(page)).waterMl).toBe(500);
  await page
    .getByRole("button", { name: "Restaurar registros", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(250);
  expect(
    (await stored(page)).history.find((day) => day.day === "2026-10-22")
      ?.waterMl,
  ).toBe(1750);
  await expect(notice).toBeHidden();
});
