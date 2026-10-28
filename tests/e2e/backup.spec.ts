import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { readRecord, stored, waitForReady, writeRecord } from "./storage";

const SETTINGS_KEY = "kernelhub:skincare:settings:v1";
const DAY_KEY = "kernelhub:skincare:day:";

test.use({ reducedMotion: "reduce" });

const localToday = (page: Page) =>
  page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });

async function seedSkincare(page: Page) {
  const settings = {
    version: 1,
    transitionMinute: 960,
    products: [
      {
        id: "shared",
        name: "Hidratante de teste",
        brand: "Marca",
        kind: "moisturizer",
        shelf: 2,
        periods: ["am", "pm"],
        archived: false,
        createdAt: "2026-10-01T08:00:00.000Z",
      },
    ],
    routines: { am: ["shared"], pm: ["shared"] },
  };
  await writeRecord(page, JSON.stringify(settings), SETTINGS_KEY);
  await page
    .getByRole("button", { name: "Abrir armário de skincare", exact: true })
    .click();
  const root = page.locator('.skincare-module[aria-busy="false"]');
  await expect(root).toBeVisible();
  await root.getByRole("button", { name: "Manhã (AM)", exact: true }).click();
  await root
    .getByRole("button", {
      name: "Usar Hidratante de teste (AM)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => {
      const raw = await readRecord(page, DAY_KEY + (await localToday(page)));
      return raw ? JSON.parse(raw).entries.am.shared?.status : null;
    })
    .toBe("used");
  return root;
}

async function addPhoto(page: Page, root: ReturnType<Page["locator"]>) {
  await root.getByRole("button", { name: "Fotos", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#88aa66";
    context.fillRect(0, 0, 4, 4);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await root
    .getByLabel("Foto de acompanhamento", { exact: true })
    .setInputFiles({
      name: "rosto.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await root.getByLabel(/^Nota/).fill("Luz da janela");
  await root.getByRole("button", { name: "Salvar foto", exact: true }).click();
  await expect(root.getByText("Foto salva neste dispositivo.")).toBeVisible();
}

const photoCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ metas: number; blobs: number; blobSize: number }>(
        (resolve, reject) => {
          const request = indexedDB.open("kernelhub", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("records", "readonly");
            const store = transaction.objectStore("records");
            const range = (prefix: string) =>
              IDBKeyRange.bound(prefix, `${prefix}￿`);
            const metas = store.count(range("kernelhub:skincare:photo-meta:"));
            const blobs = store.getAll(range("kernelhub:skincare:photo-blob:"));
            transaction.oncomplete = () => {
              db.close();
              resolve({
                metas: metas.result,
                blobs: blobs.result.length,
                blobSize: (blobs.result as Blob[]).reduce(
                  (sum, blob) => sum + blob.size,
                  0,
                ),
              });
            };
            transaction.onabort = () => reject(transaction.error);
          };
        },
      ),
  );

async function openBackupTab(page: Page) {
  await page.getByRole("button", { name: "Meu espaço", exact: true }).click();
  await page
    .getByRole("button", { name: "Dados & privacidade", exact: true })
    .click();
}

async function exportBackup(page: Page, photos: boolean) {
  await openBackupTab(page);
  const checkbox = page.getByLabel("Incluir fotos do skincare", {
    exact: false,
  });
  await checkbox.setChecked(photos);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar backup", exact: true })
    .click();
  const path = await (await downloaded).path();
  return readFile(path!, "utf8");
}

test("a full backup moves the workspace, skincare history and photos to a clean profile", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/");
  await waitForReady(page);
  const root = await seedSkincare(page);
  await addPhoto(page, root);
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(1750);
  const today = await localToday(page);

  const text = await exportBackup(page, true);
  const file = JSON.parse(text);
  expect(file.format).toBe("kernelhub-backup");
  expect(file.version).toBe(2);
  expect(file.core.waterMl).toBe(1750);
  expect(file.skincare.settings.products[0].name).toBe("Hidratante de teste");
  expect(file.skincare.days.map((day: { day: string }) => day.day)).toContain(
    today,
  );
  expect(file.skincare.photos).toHaveLength(1);
  expect(file.skincare.photos[0].meta.note).toBe("Luz da janela");
  expect(file.skincare.photos[0].data.length).toBeGreaterThan(40);

  // A brand-new browser profile has none of this data.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: page.viewportSize() ?? { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  try {
    const fresh = await context.newPage();
    await fresh.goto("/");
    await waitForReady(fresh);
    await expect
      .poll(async () => {
        const raw = await readRecord(fresh, SETTINGS_KEY);
        return raw ? JSON.parse(raw).products.length : 0;
      })
      .toBe(0);
    expect((await stored(fresh)).waterMl).toBe(1500);
    await openBackupTab(fresh);
    await fresh.getByLabel("Arquivo de backup").setInputFiles({
      name: "kernelhub.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    const confirm = fresh.getByRole("alert").filter({
      hasText: "Restaurar este backup?",
    });
    await expect(confirm).toContainText("1 produto e 1 dia de histórico");
    await expect(confirm).toContainText("com 1 foto");
    // Nothing changes until the person confirms.
    expect((await stored(fresh)).waterMl).toBe(1500);
    await fresh
      .getByRole("button", { name: "Restaurar registros", exact: true })
      .click();
    await expect.poll(async () => (await stored(fresh)).waterMl).toBe(1750);
    const settings = JSON.parse((await readRecord(fresh, SETTINGS_KEY))!);
    expect(settings.products[0].name).toBe("Hidratante de teste");
    const day = JSON.parse((await readRecord(fresh, DAY_KEY + today))!);
    expect(day.entries.am.shared.status).toBe("used");
    const photos = await photoCount(fresh);
    expect(photos.metas).toBe(1);
    expect(photos.blobs).toBe(1);
    expect(photos.blobSize).toBeGreaterThan(100);

    // The restored photo is really readable, not just a record.
    await fresh
      .getByRole("button", { name: "Abrir armário de skincare", exact: true })
      .click();
    const restored = fresh.locator('.skincare-module[aria-busy="false"]');
    await restored.getByRole("button", { name: "Fotos", exact: true }).click();
    await expect(restored.getByRole("img")).toHaveCount(1);
    await expect
      .poll(() =>
        restored
          .getByRole("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("a backup without photos replaces the cabinet but keeps the photos already here", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/");
  await waitForReady(page);
  const root = await seedSkincare(page);
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await root.waitFor({ state: "detached" });
  const text = await exportBackup(page, false);
  expect(JSON.parse(text).skincare.photos).toBeNull();

  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: page.viewportSize() ?? { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  try {
    const other = await context.newPage();
    await other.goto("/");
    await waitForReady(other);
    await other
      .getByRole("button", { name: "Abrir armário de skincare", exact: true })
      .click();
    const otherRoot = other.locator('.skincare-module[aria-busy="false"]');
    await expect(otherRoot).toBeVisible();
    await addPhoto(other, otherRoot);
    expect((await photoCount(other)).metas).toBe(1);
    await other.getByRole("button", { name: "Fechar painel" }).click();
    await openBackupTab(other);
    await other.getByLabel("Arquivo de backup").setInputFiles({
      name: "sem-fotos.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(
      other.getByRole("alert").filter({ hasText: "Restaurar este backup?" }),
    ).toContainText("as atuais serão mantidas");
    await other
      .getByRole("button", { name: "Restaurar registros", exact: true })
      .click();
    await expect
      .poll(async () => {
        const raw = await readRecord(other, SETTINGS_KEY);
        return raw ? JSON.parse(raw).products.length : 0;
      })
      .toBe(1);
    expect((await photoCount(other)).metas).toBe(1);
  } finally {
    await context.close();
  }
});

test("a corrupted full backup is refused and leaves everything as it was", async ({
  page,
}) => {
  await page.goto("/");
  await waitForReady(page);
  await seedSkincare(page);
  await page.getByRole("button", { name: "Fechar painel" }).click();
  const text = await exportBackup(page, false);
  const broken = JSON.parse(text);
  broken.skincare.settings.products[0].shelf = 9;
  const before = await readRecord(page, SETTINGS_KEY);
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "corrompido.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(broken)),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "não é um backup válido",
  );
  expect(await readRecord(page, SETTINGS_KEY)).toBe(before);
});
