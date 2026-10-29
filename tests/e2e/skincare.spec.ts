import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { DayLog, Product, Settings } from "../../lib/skincare";
import { readRecord, waitForReady, writeRecord } from "./storage";

const SETTINGS_KEY = "kernelhub:skincare:settings:v1";
const DAY_KEY = "kernelhub:skincare:day:";
const afternoon = new Date("2026-10-23T15:59:50+02:00");
const product = (
  id: string,
  name: string,
  periods: Product["periods"] = ["am", "pm"],
): Product => ({
  id,
  name,
  brand: "Cuidados de teste",
  kind: "moisturizer",
  shelf: 2,
  periods,
  archived: false,
  createdAt: "2026-10-23T08:00:00Z",
});
const read = async <T>(page: Page, key: string): Promise<T | null> => {
  const raw = await readRecord(page, key);
  return raw === null ? null : (JSON.parse(raw) as T);
};
const settings = (page: Page) => read<Settings>(page, SETTINGS_KEY);
const log = (page: Page, day = "2026-10-23") =>
  read<DayLog>(page, DAY_KEY + day);
const moduleRoot = (page: Page) => page.locator(".skincare-module");
const mode = (page: Page, period: "am" | "pm") =>
  moduleRoot(page).getByRole("button", {
    name: period === "am" ? "Manhã (AM)" : "Noite (PM)",
    exact: true,
  });

async function openSkincare(page: Page) {
  await page
    .getByRole("button", { name: "Abrir meus cuidados", exact: true })
    .click();
  await expect(
    page.locator('.skincare-module[aria-busy="false"]'),
  ).toBeVisible();
}
async function seedProducts(page: Page, products: Product[]) {
  const value: Settings = {
    version: 1,
    transitionMinute: 960,
    products,
    routines: {
      am: products
        .filter((item) => item.periods.includes("am"))
        .map((item) => item.id),
      pm: products
        .filter((item) => item.periods.includes("pm"))
        .map((item) => item.id),
    },
  };
  await writeRecord(page, JSON.stringify(value), SETTINGS_KEY);
  await openSkincare(page);
  await expect
    .poll(async () => (await log(page))?.plans.am.length)
    .toBe(value.routines.am.length);
}
async function showRoutine(page: Page) {
  await moduleRoot(page)
    .getByRole("button", { name: "A rotina", exact: true })
    .click();
}
async function createProduct(
  page: Page,
  name: string,
  periods: "both" | "am" | "pm" = "both",
) {
  const root = moduleRoot(page);
  await root.getByRole("button", { name: "Produtos", exact: true }).click();
  await root
    .getByRole("button", { name: "Adicionar produto", exact: true })
    .click();
  await root.getByLabel("Nome do produto", { exact: true }).fill(name);
  await root
    .getByLabel("Marca (opcional)", { exact: true })
    .fill("Marca de teste");
  await root
    .getByLabel("Tipo de produto", { exact: false })
    .selectOption("moisturizer");
  await root.getByLabel("Prateleira", { exact: false }).selectOption("2");
  await root
    .getByLabel("Usar na manhã (AM)", { exact: true })
    .setChecked(periods !== "pm");
  await root
    .getByLabel("Usar na noite (PM)", { exact: true })
    .setChecked(periods !== "am");
  await root
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(
    root.getByLabel("Nome do produto", { exact: true }),
  ).toBeHidden();
}

// Local Rome time is deliberately different from UTC at these boundaries.
test.use({ timezoneId: "Europe/Rome", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: afternoon });
  await page.goto("/");
  await waitForReady(page);
});

test("skincare switches at 16h while open, permits manual override and preserves a custom transition", async ({
  page,
}) => {
  await openSkincare(page);
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(10_001);
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await mode(page, "am").click();
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await moduleRoot(page)
    .getByRole("button", { name: "Seguir horário automático", exact: true })
    .click();
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await moduleRoot(page)
    .getByText("Horário automático", { exact: true })
    .click();
  await moduleRoot(page)
    .getByLabel("Trocar para a noite às", { exact: true })
    .fill("18:30");
  await moduleRoot(page)
    .getByRole("button", { name: "Salvar horário", exact: true })
    .click();
  await expect
    .poll(async () => (await settings(page))?.transitionMinute)
    .toBe(1110);
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await mode(page, "pm").click();
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await moduleRoot(page)
    .getByRole("button", { name: "Seguir horário automático", exact: true })
    .click();
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await page.clock.setFixedTime(new Date("2026-10-23T18:30:00+02:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  expect((await settings(page))?.transitionMinute).toBe(1110);
});

test("one shared product keeps separate AM and PM checks, reasons and correction after reload", async ({
  page,
}) => {
  await openSkincare(page);
  await createProduct(page, "Hidratante compartilhado");
  const shared = (await settings(page))!.products.find(
    (item) => item.name === "Hidratante compartilhado",
  )!;
  const configured = (await settings(page))!;
  expect(configured.products).toHaveLength(1);
  expect(configured.routines.am).toEqual([shared.id]);
  expect(configured.routines.pm).toEqual([shared.id]);
  await showRoutine(page);
  await mode(page, "am").click();
  await moduleRoot(page)
    .getByRole("button", {
      name: "Usar Hidratante compartilhado (AM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.am[shared.id]?.status)
    .toBe("used");
  expect((await log(page))!.entries.pm[shared.id]).toBeUndefined();
  await expect(
    moduleRoot(page).getByRole("progressbar", {
      name: "Conclusão AM",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(
    moduleRoot(page).getByRole("progressbar", {
      name: "Conclusão PM",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "0");
  await mode(page, "pm").click();
  await moduleRoot(page)
    .getByRole("button", {
      name: "Não usar Hidratante compartilhado (PM)",
      exact: true,
    })
    .click();
  await moduleRoot(page)
    .getByLabel("Motivo para não usar Hidratante compartilhado", {
      exact: true,
    })
    .fill("Esqueci o produto na viagem.");
  await moduleRoot(page)
    .getByRole("button", { name: "Salvar não uso", exact: true })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.pm[shared.id]?.status)
    .toBe("skipped");
  const previous = (await log(page))!;
  expect(previous.entries.pm[shared.id].reason).toBe(
    "Esqueci o produto na viagem.",
  );
  expect(previous.entries.am[shared.id].status).toBe("used");
  await expect(
    moduleRoot(page).getByRole("progressbar", {
      name: "Conclusão PM",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    moduleRoot(page).locator(".sk-metrics > div").nth(1),
  ).toContainText("0 pendentes · 1 não usados");
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await moduleRoot(page)
    .getByRole("button", {
      name: "Voltar a pendente: Hidratante compartilhado (PM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.pm[shared.id]?.status)
    .toBe("pending");
  expect((await log(page))!.entries.pm[shared.id].reason).toBe("");
  await moduleRoot(page)
    .getByRole("button", {
      name: "Usar Hidratante compartilhado (PM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.pm[shared.id]?.status)
    .toBe("used");
  const corrected = (await log(page))!;
  expect(Object.keys(corrected.entries.am)).toEqual([shared.id]);
  expect(Object.keys(corrected.entries.pm)).toEqual([shared.id]);
  expect(corrected.entries.pm[shared.id].reason).toBe("");
  expect(corrected.entries.am).toEqual(previous.entries.am);
  await expect(
    moduleRoot(page).getByRole("progressbar", {
      name: "Conclusão PM",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "100");
});

test("midnight returns to AM with empty checks and leaves yesterday's records intact", async ({
  page,
}) => {
  await page.clock.setSystemTime(new Date("2026-10-23T23:59:00+02:00"));
  const shared = product("shared", "Creme da rotina");
  await seedProducts(page, [shared]);
  await expect(mode(page, "pm")).toHaveAttribute("aria-pressed", "true");
  await moduleRoot(page)
    .getByRole("button", { name: "Usar Creme da rotina (PM)", exact: true })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.pm.shared?.status)
    .toBe("used");
  await mode(page, "am").click();
  await mode(page, "pm").click();
  const yesterday = await log(page);
  await moduleRoot(page)
    .getByRole("button", { name: "Fotos", exact: true })
    .click();
  await expect(
    moduleRoot(page).getByLabel("Data da foto", { exact: true }),
  ).toHaveValue("2026-10-23");
  await page.clock.fastForward(60_001);
  await expect(
    moduleRoot(page).getByLabel("Data da foto", { exact: true }),
  ).toHaveValue("2026-10-24");
  await showRoutine(page);
  await expect(mode(page, "am")).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await log(page, "2026-10-24"))?.day)
    .toBe("2026-10-24");
  const today = (await log(page, "2026-10-24"))!;
  expect(today.entries).toEqual({ am: {}, pm: {} });
  expect(today.plans.am.map((item) => item.id)).toEqual(["shared"]);
  expect(today.plans.pm.map((item) => item.id)).toEqual(["shared"]);
  expect(await log(page)).toEqual(yesterday);
  await mode(page, "pm").click();
  expect((await log(page, "2026-10-24"))!.entries).toEqual({ am: {}, pm: {} });
  await moduleRoot(page)
    .getByRole("button", { name: "Fotos", exact: true })
    .click();
  await moduleRoot(page)
    .getByLabel("Data da foto", { exact: true })
    .fill("2026-10-22");
  await page.clock.setSystemTime(new Date("2026-10-25T00:01:00+02:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(async () => (await log(page, "2026-10-25"))?.day)
    .toBe("2026-10-25");
  await expect(
    moduleRoot(page).getByLabel("Data da foto", { exact: true }),
  ).toHaveValue("2026-10-22");
});

test("AM ordering changes independently and only corresponding products appear in each routine", async ({
  page,
}) => {
  await seedProducts(page, [
    product("one", "Limpeza compartilhada"),
    product("two", "Hidratação compartilhada"),
    product("night", "Produto noturno", ["pm"]),
  ]);
  await mode(page, "am").click();
  await expect(
    moduleRoot(page).locator("ol.sk-routine-list [data-product-id]"),
  ).toHaveCount(2);
  await expect(
    moduleRoot(page).locator("ol.sk-routine-list"),
  ).not.toContainText("Produto noturno");
  await moduleRoot(page)
    .getByRole("button", {
      name: "Subir Hidratação compartilhada (AM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await settings(page))?.routines.am)
    .toEqual(["two", "one"]);
  expect((await settings(page))!.routines.pm).toEqual(["one", "two", "night"]);
  await mode(page, "pm").click();
  await expect(
    moduleRoot(page).locator("ol.sk-routine-list [data-product-id]"),
  ).toHaveCount(3);
  await expect(moduleRoot(page).locator("ol.sk-routine-list")).toContainText(
    "Produto noturno",
  );
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  expect((await settings(page))!.routines.am).toEqual(["two", "one"]);
  expect((await settings(page))!.routines.pm).toEqual(["one", "two", "night"]);
});

test("two tabs retain independent period writes and an unsuccessful save cannot change a check", async ({
  page,
  context,
}) => {
  await seedProducts(page, [product("shared", "Cuidado compartilhado")]);
  await mode(page, "am").click();
  const other = await context.newPage();
  await other.clock.install({ time: afternoon });
  await other.goto("/");
  await waitForReady(other);
  await openSkincare(other);
  await mode(other, "pm").click();
  await Promise.all([
    moduleRoot(page)
      .getByRole("button", {
        name: "Usar Cuidado compartilhado (AM)",
        exact: true,
      })
      .click(),
    moduleRoot(other)
      .getByRole("button", {
        name: "Usar Cuidado compartilhado (PM)",
        exact: true,
      })
      .click(),
  ]);
  await expect
    .poll(async () => (await log(page))?.entries.am.shared?.status)
    .toBe("used");
  await expect
    .poll(async () => (await log(page))?.entries.pm.shared?.status)
    .toBe("used");
  const committed = await log(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (
      window as typeof window & { restoreSkincareWrites: () => void }
    ).restoreSkincareWrites = () => {
      IDBObjectStore.prototype.put = put;
    };
    IDBObjectStore.prototype.put = function (value, key) {
      if (typeof key === "string" && key.startsWith("kernelhub:skincare:"))
        throw new DOMException("Test quota", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await moduleRoot(page)
    .getByRole("button", {
      name: "Voltar a pendente: Cuidado compartilhado (AM)",
      exact: true,
    })
    .click();
  await expect(moduleRoot(page).getByRole("alert")).toBeVisible();
  expect(await log(page)).toEqual(committed);
  await page.evaluate(() =>
    (
      window as typeof window & { restoreSkincareWrites: () => void }
    ).restoreSkincareWrites(),
  );
  await moduleRoot(page)
    .getByRole("button", {
      name: "Voltar a pendente: Cuidado compartilhado (AM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.am.shared?.status)
    .toBe("pending");
  expect((await log(page))!.entries.pm.shared.status).toBe("used");
});

test("populated cabinet keeps three shelves, accessible controls and a narrow-screen layout", async ({
  page,
}) => {
  await seedProducts(page, [product("shared", "Cuidado diário")]);
  await expect(moduleRoot(page).locator(".sk-shelf")).toHaveCount(3);
  const accessibility = await new AxeBuilder({ page })
    .include(".skincare-module")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    // The settled layout must fit; a resize animation may lag under load.
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect
      .poll(() =>
        moduleRoot(page).evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
  }
});

test("history filters retain old dated AM/PM plans and distinguish skipped from pending", async ({
  page,
}) => {
  const shared = product("shared", "Hidratante do histórico");
  const spare = product("spare", "Sérum pendente", ["am"]);
  const snapshot = (item: Product) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    kind: item.kind,
    shelf: item.shelf,
  });
  const old: DayLog = {
    day: "2025-01-02",
    plans: { am: [snapshot(shared), snapshot(spare)], pm: [snapshot(shared)] },
    entries: {
      am: {
        shared: {
          status: "used",
          reason: "",
          updatedAt: "2025-01-02T08:00:00Z",
        },
      },
      pm: {
        shared: {
          status: "skipped",
          reason: "Rotina interrompida na viagem.",
          updatedAt: "2025-01-02T20:00:00Z",
        },
      },
    },
  };
  await writeRecord(page, JSON.stringify(old), DAY_KEY + old.day);
  await seedProducts(page, [shared, spare]);
  await moduleRoot(page)
    .getByRole("button", { name: "Histórico", exact: true })
    .click();
  const history = page.getByRole("region", {
    name: "Histórico de skincare",
    exact: true,
  });
  await history.getByLabel("De", { exact: true }).fill("10000-01-01");
  await expect(history.getByRole("alert")).toBeVisible();
  await expect(moduleRoot(page)).toBeVisible();
  await history.getByLabel("De", { exact: true }).fill(old.day);
  await history.getByLabel("Até", { exact: true }).fill(old.day);
  await history.getByLabel("Período", { exact: false }).selectOption("pm");
  await history.getByLabel("Produto", { exact: false }).selectOption("shared");
  await history.getByLabel("Status", { exact: false }).selectOption("skipped");
  await expect(history.locator(".skh-history-row")).toHaveCount(1);
  await expect(history.locator(".skh-history-row")).toContainText(
    "Rotina interrompida na viagem.",
  );
  await expect(history.locator(".skh-history-row")).toContainText("PM");
  await history.getByLabel("Período", { exact: false }).selectOption("am");
  await history.getByLabel("Produto", { exact: false }).selectOption("spare");
  await history.getByLabel("Status", { exact: false }).selectOption("pending");
  await expect(history.locator(".skh-history-row")).toHaveCount(1);
  await expect(history.locator(".skh-history-row")).toContainText(
    "Sérum pendente",
  );
  await expect(history.locator(".skh-history-row")).toContainText("Pendente");
  expect(await log(page, old.day)).toEqual(old);
});

test("dated progress photos remain local and expose the actual routines between them", async ({
  page,
}) => {
  await seedProducts(page, [product("shared", "Cuidado entre fotos")]);
  await mode(page, "am").click();
  await moduleRoot(page)
    .getByRole("button", { name: "Usar Cuidado entre fotos (AM)", exact: true })
    .click();
  await expect
    .poll(async () => (await log(page))?.entries.am.shared?.status)
    .toBe("used");
  await moduleRoot(page)
    .getByRole("button", { name: "Fotos", exact: true })
    .click();
  const photos = page.getByRole("region", {
    name: "Fotos de acompanhamento de skincare",
    exact: true,
  });
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#bbaacc";
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const photoRecords = () =>
    page.evaluate(
      () =>
        new Promise<{ id: string; day: string; type: string }[]>(
          (resolve, reject) => {
            const request = indexedDB.open("kernelhub", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("records", "readonly");
              const range = IDBKeyRange.bound(
                "kernelhub:skincare:photo-meta:",
                "kernelhub:skincare:photo-meta:\uffff",
              );
              const get = transaction.objectStore("records").getAll(range);
              transaction.oncomplete = () => {
                db.close();
                resolve(get.result.map((raw) => JSON.parse(raw)));
              };
              transaction.onabort = () => {
                db.close();
                reject(transaction.error);
              };
            };
          },
        ),
    );
  for (const [index, day] of ["2026-10-22", "2026-10-23"].entries()) {
    await photos
      .getByLabel("Foto de acompanhamento", { exact: true })
      .setInputFiles({
        name: `evolucao-${index}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
    await photos.getByLabel("Data da foto", { exact: true }).fill(day);
    await photos.getByLabel(/^Nota/).fill(index === 0 ? "Antes" : "Depois");
    await photos
      .getByRole("button", { name: "Salvar foto", exact: true })
      .click();
    await expect
      .poll(async () => (await photoRecords()).length)
      .toBe(index + 1);
  }
  const saved = await photoRecords();
  expect(saved.every((item) => item.type === "image/jpeg")).toBe(true);
  await photos
    .getByLabel("Primeira foto", { exact: false })
    .selectOption(saved.find((item) => item.day === "2026-10-22")!.id);
  await photos
    .getByLabel("Segunda foto", { exact: false })
    .selectOption(saved.find((item) => item.day === "2026-10-23")!.id);
  const range = photos.locator('[aria-label="Rotinas entre fotos"]');
  await expect(range).toBeVisible();
  await expect(range).toContainText("Cuidado entre fotos");
  await expect(range).toContainText("Usado");
  await page.reload();
  await waitForReady(page);
  await openSkincare(page);
  await moduleRoot(page)
    .getByRole("button", { name: "Fotos", exact: true })
    .click();
  await expect.poll(async () => (await photoRecords()).length).toBe(2);
  await expect(photos.getByRole("img")).toHaveCount(2);
});
