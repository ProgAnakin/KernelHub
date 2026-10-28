import { test, expect, type Page } from "@playwright/test";
import type { DayLog, Product, Settings } from "../../lib/skincare";
import { readRecord, waitForReady, writeRecord } from "./storage";

const SETTINGS_KEY = "kernelhub:skincare:settings:v1";
const DAY_KEY = "kernelhub:skincare:day:";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);
});

const product = (id: string, name: string): Product => ({
  id,
  name,
  brand: "Marca de teste",
  kind: "serum",
  shelf: 1,
  periods: ["am", "pm"],
  archived: false,
  createdAt: "2026-10-01T08:00:00.000Z",
});
const today = (page: Page) =>
  page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
async function openWith(page: Page, products: Product[]) {
  const settings: Settings = {
    version: 1,
    transitionMinute: 960,
    products,
    routines: {
      am: products.map((item) => item.id),
      pm: products.map((item) => item.id),
    },
  };
  await writeRecord(page, JSON.stringify(settings), SETTINGS_KEY);
  await page
    .getByRole("button", { name: "Abrir armário de skincare", exact: true })
    .click();
  const root = page.locator('.skincare-module[aria-busy="false"]');
  await expect(root).toBeVisible();
  await root.getByRole("button", { name: "Manhã (AM)", exact: true }).click();
  await expect(root.locator(".sk-step")).toHaveCount(products.length);
  return root;
}
const log = async (page: Page) =>
  JSON.parse(
    (await readRecord(page, DAY_KEY + (await today(page))))!,
  ) as DayLog;

test("one tap marks every pending product, keeps a skipped one and points at what is next", async ({
  page,
}) => {
  const root = await openWith(page, [
    product("a", "Limpador"),
    product("b", "Sérum"),
    product("c", "Hidratante"),
    product("d", "Protetor"),
  ]);
  // The first pending product is the next step.
  await expect(root.locator(".sk-step.is-next h4")).toHaveText("Limpador");
  await expect(root.locator(".sk-step.is-next .sk-status")).toHaveText(
    "Próximo",
  );
  await root
    .getByRole("button", { name: "Usar Limpador (AM)", exact: true })
    .click();
  await expect(root.locator(".sk-step.is-next h4")).toHaveText("Sérum");
  await root
    .getByRole("button", { name: "Não usar Sérum (AM)", exact: true })
    .click();
  await root.getByLabel("Motivo para não usar Sérum").fill("Pele irritada");
  await root.getByRole("button", { name: "Salvar não uso" }).click();
  await expect(root.locator(".sk-step.is-next h4")).toHaveText("Hidratante");

  const all = root.getByRole("button", {
    name: "Marcar 2 pendentes como usados",
  });
  await expect(all).toBeVisible();
  await all.click();
  await expect
    .poll(async () => {
      const entries = (await log(page)).entries.am;
      return ["a", "b", "c", "d"].map((id) => entries[id]?.status);
    })
    .toEqual(["used", "skipped", "used", "used"]);
  expect((await log(page)).entries.am.b.reason).toBe("Pele irritada");
  // Nothing from the evening was touched, and the shortcut is gone.
  expect((await log(page)).entries.pm).toEqual({});
  await expect(all).toBeHidden();
  await expect(root.locator(".sk-step.is-next")).toHaveCount(0);
});

test("a camera-sized original is accepted, shrunk, and its removal is asked on the photo", async ({
  page,
}) => {
  const root = await openWith(page, [product("a", "Limpador")]);
  await root.getByRole("button", { name: "Fotos", exact: true }).click();
  // ~13 MB of noise: far above the stored limit, as a real camera JPEG can be.
  const big = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1800;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(1800, 1800);
    // xorshift noise does not compress, so the PNG really is camera-sized.
    let seed = 2463534242;
    for (let i = 0; i < image.data.length; i += 4) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      image.data[i] = seed & 255;
      image.data[i + 1] = (seed >>> 8) & 255;
      image.data[i + 2] = (seed >>> 16) & 255;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), size: bytes.length };
  });
  expect(big.size).toBeGreaterThan(5 * 1024 * 1024);
  expect(big.size).toBeLessThan(25 * 1024 * 1024);
  await root
    .getByLabel("Foto de acompanhamento", { exact: true })
    .setInputFiles({
      name: "camera.png",
      mimeType: "image/png",
      buffer: Buffer.from(big.base64, "base64"),
    });
  await root.getByRole("button", { name: "Salvar foto", exact: true }).click();
  await expect(root.getByText("Foto salva neste dispositivo.")).toBeVisible({
    timeout: 20000,
  });
  const meta = await page.evaluate(
    () =>
      new Promise<{ size: number; type: string }>((resolve, reject) => {
        const request = indexedDB.open("kernelhub", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("records", "readonly");
          const get = transaction
            .objectStore("records")
            .getAll(
              IDBKeyRange.bound(
                "kernelhub:skincare:photo-meta:",
                "kernelhub:skincare:photo-meta:￿",
              ),
            );
          transaction.oncomplete = () => {
            db.close();
            resolve(JSON.parse(get.result[0]));
          };
        };
      }),
  );
  expect(meta.type).toBe("image/jpeg");
  expect(meta.size).toBeLessThan(5 * 1024 * 1024);

  const card = root.locator(".skh-photo").first();
  await card.getByRole("button", { name: /^Remover foto/ }).click();
  const confirm = card.getByRole("alert");
  await expect(confirm).toContainText("Remover esta foto?");
  await expect(root.locator(".skh-photo .inline-confirm")).toHaveCount(1);
  await confirm
    .getByRole("button", { name: "Confirmar remoção da foto" })
    .click();
  await expect(root.locator(".skh-photo")).toHaveCount(0);
});
