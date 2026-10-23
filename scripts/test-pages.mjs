import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";

async function record(page, database, store, key) {
  const raw = await page.evaluate(
    ({ database, store, key }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          let transaction;
          let request;
          try {
            transaction = db.transaction(store, "readonly");
            request = transaction.objectStore(store).get(key);
          } catch (error) {
            db.close();
            reject(error);
            return;
          }
          let value = null;
          request.onsuccess = () => {
            value = request.result;
          };
          transaction.oncomplete = () => {
            db.close();
            resolve(value);
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    { database, store, key },
  );
  if (raw === undefined || raw === null) return null;
  assert.equal(typeof raw, "string", "IndexedDB record contains JSON text");
  return JSON.parse(raw);
}

const stored = (page) =>
  record(page, "kernelhub", "records", "kernelhub:state:v1");
const healthRecord = (page) =>
  record(page, "kernelhub-health", "snapshots", "latest");

const base =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "/KernelHub").replace(/\/$/, "") + "/";
const root = resolve("out");
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
let slowNavigation = false;
const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    let file = resolve(root, pathname.slice(base.length) || "index.html");
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    if (statSync(file).isDirectory()) file = resolve(file, "index.html");
    response.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    const content = readFileSync(file);
    if (
      slowNavigation &&
      (pathname === base || pathname === `${base}index.html`)
    )
      setTimeout(() => response.end(content), 8000);
    else response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + base);
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  const manifest = await (
    await page.request.get(origin + base + "manifest.webmanifest")
  ).json();
  assert.equal(manifest.start_url, base);
  assert.equal(manifest.scope, base);
  for (const icon of manifest.icons)
    assert.equal((await page.request.get(origin + icon.src)).status(), 200);
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(1750);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  assert.equal(
    await healthRecord(page),
    null,
    "No health import was performed during the initial online visit",
  );
  slowNavigation = true;
  const reloadStarted = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.ok(
    performance.now() - reloadStarted < 6500,
    "Cached shell opens before the stalled 8s navigation completes",
  );
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  slowNavigation = false;
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  await page
    .getByRole("button", { name: "Adicionar 250 ml de água", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).waterMl).toBe(2000);
  // The first actual XML parse happens after going offline and reloading. Its
  // worker and every bootstrap/import dependency must come from the app cache.
  await page
    .getByRole("button", { name: "Fontes e conexões", exact: true })
    .click();
  const start = new Date(Date.now() - 2 * 3600_000).toISOString();
  const end = new Date(Date.now() - 3600_000).toISOString();
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "offline-export.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(
      `<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio offline de teste" unit="count" value="1800" startDate="${start}" endDate="${end}"/></HealthData>`,
    ),
  });
  const importer = page.getByRole("region", { name: "Importação Apple Saúde" });
  await expect(
    importer.getByText("Arquivo importado", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(importer).toContainText("1 de 8 métricas");
  await expect
    .poll(async () => (await healthRecord(page))?.metrics.steps.value)
    .toBe(1800);
  const health = await healthRecord(page);
  assert.equal(health.fileName, "offline-export.xml");
  assert.equal(health.metrics.steps.samples, 1);
  assert.equal(health.metrics.sleepHours.value, null);
  assert.ok(
    Object.entries(health.metrics)
      .filter(([metric]) => metric !== "steps")
      .every(([, reading]) => reading.value === null),
    "Metrics absent from the XML remain empty",
  );
  assert.deepEqual(health.sources, ["Relógio offline de teste"]);
  assert.equal(health.coverage.records, 1);
  assert.equal(health.coverage.acceptedRecords, 1);
  assert.equal(health.coverage.ignoredRecords, 0);
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await expect(
    page.getByRole("button", { name: "Fontes e conexões", exact: true }),
  ).toContainText("1 fonte com dados");
  const panorama = page.getByRole("region", {
    name: "Panorama de saúde",
    exact: true,
  });
  await expect(panorama).toContainText("1/8 medidas · XML local");
  await expect(panorama.locator(".kp-sleep-value")).toHaveText("—");
  await expect(panorama.locator(".kp-preview-tag")).toHaveCount(0);
  await expect(
    page.getByRole("region", {
      name: "Panorama de saúde ilustrativo",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('.app-background[aria-busy="false"]').waitFor();
  await expect(panorama).toContainText("1/8 medidas · XML local");
  await expect(panorama.locator(".kp-sleep-value")).toHaveText("—");
  assert.deepEqual(await healthRecord(page), health);
  assert.equal((await stored(page)).waterMl, 2000);
  assert.deepEqual(errors, []);
  console.log(
    "Static Pages build: prefixed assets, manifest, slow-network fallback, offline records and first offline XML worker import passed.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
