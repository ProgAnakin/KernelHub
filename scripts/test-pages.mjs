import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";

async function stored(page) {
  const raw = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("kernelhub", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("records", "readonly");
          const request = transaction
            .objectStore("records")
            .get("kernelhub:state:v1");
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
  );
  assert.equal(typeof raw, "string", "KernelHub record exists after hydration");
  return JSON.parse(raw);
}

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
  assert.deepEqual(errors, []);
  console.log(
    "Static Pages build: prefixed assets, manifest, slow-network fallback and offline IndexedDB records passed.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
