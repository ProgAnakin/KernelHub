import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import {
  stored as read,
  waitForReady,
  readRecord,
  writeRecord,
  STORAGE_KEY as KEY,
} from "./storage";

async function restore(page: Page, state: unknown) {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page.getByRole("button", { name: "Dados & privacidade" }).click();
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "test-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page
    .getByRole("button", { name: "Restaurar registros", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

test("concurrent tabs retain every action without echoing snapshots", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto("/");
  await waitForReady(other);
  await expect(other.locator(".kp-water strong")).toContainText("1,5");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    const target = window as typeof window & { writeCount: number };
    target.writeCount = 0;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "kernelhub:state:v1") target.writeCount++;
      return original.call(this, value, key);
    };
  });
  const burst = (target: Page) =>
    target.evaluate(() => {
      const button =
        document.querySelector<HTMLButtonElement>(".kp-water button")!;
      for (let i = 0; i < 5; i++) button.click();
    });
  await Promise.all([burst(page), burst(other)]);
  await expect.poll(async () => (await read(page)).waterMl).toBe(4000);
  await expect(page.locator(".kp-water strong")).toContainText("4");
  await expect(other.locator(".kp-water strong")).toContainText("4");
  await Promise.all([
    page.getByRole("checkbox", { name: "Suplementação", exact: true }).click(),
    other
      .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
      .click(),
  ]);
  await expect
    .poll(async () => (await read(page)).habits.supplements)
    .toBe(true);
  await expect.poll(async () => (await read(page)).waterMl).toBe(4250);
  await expect(
    other.getByRole("checkbox", { name: "Suplementação", exact: true }),
  ).toBeChecked();
  const writes = await page.evaluate(
    () => (window as typeof window & { writeCount: number }).writeCount,
  );
  expect(writes).toBeLessThanOrEqual(12);
});

test("a full storage keeps session changes and resumes saving without discarding them", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    const target = window as typeof window & { allowStorage: () => void };
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "kernelhub:state:v1")
        throw new DOMException("Test quota", "QuotaExceededError");
      return original.call(this, value, key);
    };
    target.allowStorage = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  const water = page.getByRole("button", {
    name: "Adicionar 250 ml de água",
    exact: true,
  });
  await water.click();
  await expect(page.locator(".kp-water strong")).toContainText("1,75");
  await water.click();
  await expect(page.locator(".kp-water strong")).toHaveText("2 / 2,5 L");
  await expect(
    page.getByText("O navegador bloqueou o armazenamento.", { exact: false }),
  ).toBeVisible();
  expect((await read(page)).waterMl).toBe(1500);
  await page.evaluate(() =>
    (window as typeof window & { allowStorage: () => void }).allowStorage(),
  );
  await water.click();
  await expect.poll(async () => (await read(page)).waterMl).toBe(2250);
  await expect(
    page.getByText("O navegador bloqueou o armazenamento.", { exact: false }),
  ).toBeHidden();
});

test("recovery remains visible after a second reload and preserves the first incompatible record", async ({
  page,
}) => {
  await writeRecord(page, "{invalid-first");
  await page.reload();
  const notice = page.getByText(
    "Um registro antigo incompatível foi preservado.",
    { exact: false },
  );
  await expect(notice).toBeVisible();
  await page.reload();
  await expect(notice).toBeVisible();
  await writeRecord(page, "{invalid-second");
  await page.reload();
  await expect(notice).toBeVisible();
  expect(await readRecord(page, `${KEY}:recovery`)).toBe("{invalid-first");
});

test("meal removal and confirmed correction keep nutrition totals consistent", async ({
  page,
}) => {
  const original = (await read(page)).nutrition;
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page.getByLabel("Nome da refeição").fill("Lanche para corrigir");
  await page.locator("#protein").fill("30");
  await page.locator("#carbs").fill("40");
  await page.locator("#fat").fill("10");
  await page
    .getByRole("button", { name: "Salvar refeição", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).meals.length).toBe(1);
  await page
    .getByRole("button", { name: "Registrar refeição", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Remover refeição Lanche para corrigir",
      exact: true,
    })
    .click();
  expect((await read(page)).meals).toHaveLength(1);
  await page
    .getByRole("button", { name: "Confirmar remoção", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).nutrition).toEqual(original);
  await page
    .getByRole("button", { name: "Corrigir total do dia", exact: true })
    .click();
  await page.locator("#correct-protein").fill("80");
  await page.locator("#correct-carbs").fill("90");
  await page.locator("#correct-fat").fill("30");
  await page
    .getByRole("button", { name: "Revisar correção", exact: true })
    .click();
  expect((await read(page)).nutrition).toEqual(original);
  await page
    .getByRole("button", { name: "Confirmar novo total", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).nutrition)
    .toEqual({ protein: 80, carbs: 90, fat: 30 });
  expect((await read(page)).meals).toHaveLength(0);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("older insights can be reached and removed and untrusted text remains literal", async ({
  page,
}) => {
  const state = await read(page);
  const payload = '<img src=x onerror="window.xssExecuted=1">';
  state.insights = Array.from({ length: 12 }, (_, i) => ({
    id: `test-note-${i}`,
    courseId: "architecture",
    text: i === 11 ? payload : `Insight ${i + 1}`,
    createdAt: new Date().toISOString(),
  }));
  await restore(page, state);
  await page
    .getByRole("button", { name: "Continuar aprendendo", exact: true })
    .click();
  await expect(page.getByText(payload, { exact: true })).toBeHidden();
  await page
    .getByRole("button", { name: "Mostrar mais insights (4)", exact: true })
    .click();
  await expect(page.getByText(payload, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as typeof window & { xssExecuted?: number }).xssExecuted,
    ),
  ).toBeUndefined();
  expect(await page.locator(".saved-insights img").count()).toBe(0);
  const note = page.locator("blockquote").filter({ hasText: payload });
  await note.getByRole("button", { name: /Remover insight de/ }).click();
  expect((await read(page)).insights).toHaveLength(12);
  await note
    .getByRole("button", { name: "Confirmar remoção", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).insights.length).toBe(11);
  await expect(page.getByText(payload, { exact: true })).toHaveCount(0);
});

test("fractional runs can be corrected and progress remains accessible above its target", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Continuar meu treino", exact: true })
    .click();
  await page.getByRole("button", { name: "Corrida", exact: true }).click();
  await page.getByLabel("Distância total de hoje (km)").fill("6.4");
  await page
    .getByRole("button", { name: "Salvar distância total", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).runKm).toBe(6.4);
  await expect(
    page.getByRole("progressbar", { name: "Meta de corrida" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page.getByLabel("Distância total de hoje (km)").fill("0");
  await page
    .getByRole("button", { name: "Salvar distância total", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).runKm).toBe(0);
});

test("static asset query floods cannot grow the offline cache and APIs stay uncached", async ({
  page,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const result = await page.evaluate(async () => {
    const keys = async () =>
      (
        await Promise.all(
          (await caches.keys())
            .filter((key) => key.startsWith("kernelhub-"))
            .map(async (key) =>
              (await (await caches.open(key)).keys()).map(
                (request) => request.url,
              ),
            ),
        )
      ).flat();
    const before = await keys();
    for (let i = 0; i < 40; i++) await fetch(`/icon.svg?local-test=${i}`);
    await fetch("/api/security-local-test");
    const after = await keys();
    return { before: before.length, after: after.length, urls: after };
  });
  expect(result.after).toBe(result.before);
  expect(
    result.urls.some(
      (url) => url.includes("/api/") || url.includes("local-test="),
    ),
  ).toBe(false);
});

test("production headers restrict framing and worker sources", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  const worker = await request.get("/sw.js");
  expect(worker.headers()["content-security-policy"]).toBe(
    "default-src 'none'; script-src 'self'; connect-src 'self'",
  );
  expect(worker.headers()["cache-control"]).toContain("no-store");
});

async function legacyOnly(page: Page, raw: string) {
  await page.evaluate(
    async ({ key, value }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("kernelhub");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      localStorage.setItem(key, value);
    },
    { key: KEY, value: raw },
  );
}

test("legacy localStorage records migrate only after a successful database commit", async ({
  page,
}) => {
  const state = await read(page);
  const { meals, ...legacy } = state;
  legacy.waterMl = 2750;
  await legacyOnly(page, JSON.stringify(legacy));
  await page.reload();
  await waitForReady(page);
  expect((await read(page)).waterMl).toBe(2750);
  expect((await read(page)).meals).toEqual([]);
  expect((await read(page)).wishlist).toEqual(state.wishlist);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).toBeNull();
});

test("failed migration keeps the legacy copy and can retry safely", async ({
  page,
}) => {
  const legacy = { ...(await read(page)), waterMl: 2750 };
  const raw = JSON.stringify(legacy);
  await legacyOnly(page, raw);
  await page.addInitScript(() => {
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
  await page.reload();
  await waitForReady(page);
  await expect(
    page.getByText("O navegador bloqueou o armazenamento.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    raw,
  );
  expect(await readRecord(page)).toBeNull();
  await page.evaluate(() =>
    (window as typeof window & { allowDatabase: () => void }).allowDatabase(),
  );
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).waterMl).toBe(3000);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).toBeNull();
});

test("retrying an aborted transaction preserves session IDs and a subsequent removal", async ({
  page,
}) => {
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
  await page
    .getByRole("button", { name: "Registrar bloco de foco", exact: true })
    .click();
  await page
    .getByLabel("O que avançou?", { exact: false })
    .fill("Registro durante indisponibilidade.");
  await page
    .getByRole("button", { name: "Registrar bloco concluído", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remover bloco de 25 minutos",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remover bloco de 25 minutos", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remover bloco de 25 minutos",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (window as typeof window & { allowDatabase: () => void }).allowDatabase(),
  );
  await page
    .getByRole("button", { name: "Registrar bloco concluído", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).focusSessions.length)
    .toBe(1);
  const persisted = await read(page);
  expect(persisted.focusSessions[0].outcome).toBe("");
  expect(
    persisted.journal.filter((entry) => entry.title === "Bloco de projeto"),
  ).toHaveLength(2);
  expect(
    persisted.journal.filter(
      (entry) => entry.title === "Bloco de foco removido",
    ),
  ).toHaveLength(1);
  expect(new Set(persisted.journal.map((entry) => entry.id)).size).toBe(
    persisted.journal.length,
  );
});

test("rapidly repeating a set target cannot overcount the completed sets", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Continuar meu treino", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Remada baixa: 2 séries concluídas",
      exact: true,
    })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect.poll(async () => (await read(page)).exercises.row).toBe(2);
  expect(
    (await read(page)).journal.filter(
      (entry) => entry.title === "Remada baixa",
    ),
  ).toHaveLength(1);
});

test("static HTML hydrates on later dates and in extreme time zones without replacing the tree", async ({
  browser,
}) => {
  for (const timezoneId of ["Europe/Rome", "Pacific/Kiritimati"]) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-10-24T12:00:00Z"));
    await page.goto("/");
    await waitForReady(page);
    expect((await read(page)).day).toBe(
      timezoneId === "Pacific/Kiritimati" ? "2026-10-25" : "2026-10-24",
    );
    expect(errors).toEqual([]);
    await context.close();
  }
});
