import { test, expect, type Page } from "@playwright/test";
import type { GitHubSnapshot } from "../../lib/github";
import type { HealthSnapshot } from "../../lib/health";
import type { FocusTimerRecord } from "../../lib/focus-timer";
import { stored, waitForReady } from "./storage";

const TEST_TIME = new Date("2026-10-23T12:00:00Z");
const HEALTH_RECORD_START = new Date(Date.now() - 2 * 3600_000).toISOString();
const HEALTH_RECORD_END = new Date(Date.now() - 3600_000).toISOString();

test.use({ timezoneId: "Europe/Rome", reducedMotion: "reduce" });

async function record<T>(
  page: Page,
  database: string,
  store: string,
  key: string,
): Promise<T | null> {
  return page.evaluate(
    ({ database, store, key }) =>
      new Promise<T | null>((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction(store, "readonly");
          const request = transaction.objectStore(store).get(key);
          let value: T | null = null;
          request.onsuccess = () => {
            value =
              typeof request.result === "string"
                ? (JSON.parse(request.result) as T)
                : null;
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
}

const githubRecord = (page: Page) =>
  record<{ username: string; snapshot: GitHubSnapshot }>(
    page,
    "kernelhub-integrations",
    "github",
    "connection",
  );
const healthRecord = (page: Page) =>
  record<HealthSnapshot>(page, "kernelhub-health", "snapshots", "latest");
const timerRecord = (page: Page) =>
  record<FocusTimerRecord>(
    page,
    "kernelhub",
    "records",
    "kernelhub:focus-timer:v1",
  );

async function openSources(page: Page) {
  await page.getByRole("button", { name: /Fontes (?:&|e) conexões/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function openTimer(page: Page) {
  await page
    .getByRole("button", { name: /^(?:Iniciar foco|Abrir meu cronômetro)$/ })
    .click();
  await expect(
    page.locator('.kh-focus-tracker[aria-busy="false"]'),
  ).toBeVisible();
}

test("GitHub connects public events without inventing commit or deploy counts and preserves a failed refresh", async ({
  page,
}) => {
  await page.clock.install({ time: TEST_TIME });
  let unavailable = false;
  const requests: string[] = [];
  await page.route("https://api.github.com/**", async (route) => {
    const request = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "accept,x-github-api-version",
      "access-control-allow-methods": "GET,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers, body: "" });
      return;
    }
    requests.push(request.url());
    if (unavailable) {
      await route.fulfill({
        status: 503,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ message: "Test provider outage" }),
      });
      return;
    }
    const events = [
      {
        id: "public-push",
        type: "PushEvent",
        created_at: TEST_TIME.toISOString(),
        repo: { name: "qa-kernel/project" },
        payload: { ref: "refs/heads/main", head: "a".repeat(40) },
      },
      {
        id: "public-pr",
        type: "PullRequestEvent",
        created_at: TEST_TIME.toISOString(),
        repo: { name: "qa-kernel/project" },
        payload: {
          action: "closed",
          number: 7,
          pull_request: {
            number: 7,
            merged: true,
            title: "Revisar importador",
          },
        },
      },
    ];
    const profile = { login: "qa-kernel", name: "Kernel QA", avatar_url: "" };
    await route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith("/events") ? events : profile,
      ),
    });
  });
  await page.goto("/");
  await waitForReady(page);
  await openSources(page);
  const connector = page.getByRole("region", { name: "Conexão GitHub" });
  await connector.getByLabel("Usuário público").fill("qa-kernel");
  await connector
    .getByRole("button", { name: "Conectar GitHub", exact: true })
    .click();
  await expect(
    connector.getByText("@qa-kernel", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await githubRecord(page))?.snapshot.statisticsToday)
    .toMatchObject({
      pushes: 1,
      commits: null,
      mergedPRs: 1,
      releases: 0,
      deployments: null,
    });
  const saved = await githubRecord(page);
  expect(saved?.snapshot.events).toHaveLength(2);
  expect(
    requests.every((url) =>
      url.startsWith("https://api.github.com/users/qa-kernel"),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const engineering = page.getByRole("region", {
    name: "Atividade de engenharia",
  });
  await expect(engineering).toContainText("Pushes não são commits ou deploys.");
  await expect(
    engineering
      .locator(".kp-code-stats > div")
      .filter({ hasText: "Pushes hoje" })
      .locator("strong"),
  ).toHaveText("1");
  await expect(
    engineering.getByText("ATIVIDADE DE EXEMPLO", { exact: true }),
  ).toHaveCount(0);
  await openSources(page);
  unavailable = true;
  await page.clock.fastForward(61_000);
  await connector
    .getByRole("button", { name: "Atualizar agora", exact: true })
    .click();
  await expect(connector.getByRole("alert")).toContainText(
    "GitHub está indisponível",
  );
  expect((await githubRecord(page))?.snapshot).toEqual(saved?.snapshot);
  for (const username of ["qa-kernel", "another-profile"]) {
    const attempts = requests.length;
    await page.clock.fastForward(61_000);
    await connector.getByLabel("Usuário público").fill(username);
    await connector
      .getByRole("button", { name: "Atualizar conexão", exact: true })
      .click();
    await expect.poll(() => requests.length).toBeGreaterThan(attempts);
    await expect(connector.getByRole("alert")).toContainText(
      "GitHub está indisponível",
    );
    expect(await githubRecord(page)).toEqual(saved);
    await expect(
      connector.getByText("@qa-kernel", { exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await waitForReady(page);
  await expect(
    page.getByRole("region", { name: "Atividade de engenharia" }),
  ).toContainText("@qa-kernel");
  expect(
    (await githubRecord(page))?.snapshot.statisticsToday.commits,
  ).toBeNull();
});

test("Apple Health XML is parsed by a worker and absent metrics remain empty through reload and invalid imports", async ({
  page,
}) => {
  await page.clock.setFixedTime(TEST_TIME);
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/");
  await waitForReady(page);
  await openSources(page);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><HealthData locale="pt_BR">
    <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio de teste" unit="count" value="4200" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/>
    <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Relógio de teste" unit="count/min" value="54" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/>
    <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Balança de teste" unit="kg" value="76.2" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/>
    <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Relógio de teste" unit="%" value="0.98" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/>
  </HealthData>`;
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "export.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  const importer = page.getByRole("region", { name: "Importação Apple Saúde" });
  await expect(
    importer.getByText("Arquivo importado", { exact: true }),
  ).toBeVisible();
  await expect(importer).toContainText("3 de 8 métricas");
  await expect
    .poll(async () => (await healthRecord(page))?.metrics.steps.value)
    .toBe(4200);
  const saved = await healthRecord(page);
  expect(saved?.metrics.restingHeartRate.value).toBe(54);
  expect(saved?.metrics.weightKg.value).toBe(76.2);
  expect(saved?.metrics.sleepHours.value).toBeNull();
  expect(saved?.metrics.hrvMs.value).toBeNull();
  expect(saved?.metrics.activeCalories.value).toBeNull();
  expect(saved?.coverage).toMatchObject({
    records: 4,
    acceptedRecords: 3,
    ignoredRecords: 1,
  });
  expect(workers.length).toBeGreaterThan(0);
  const coverage = page.getByRole("region", { name: "Cobertura de métricas" });
  await expect(
    coverage
      .locator(".kh-coverage-row")
      .filter({ hasText: "Sono" })
      .locator("b"),
  ).toHaveText("—");
  await expect(
    coverage
      .locator(".kh-coverage-row")
      .filter({ hasText: "Passos" })
      .locator("b"),
  ).toHaveText("4.200 passos");
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "hostile.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(
      '<!DOCTYPE HealthData SYSTEM "https://untrusted.invalid/health.dtd"><HealthData/>',
    ),
  });
  await expect(importer.getByRole("alert")).toBeVisible();
  expect(await healthRecord(page)).toEqual(saved);
  await page.reload();
  await waitForReady(page);
  await openSources(page);
  await expect(
    importer.getByText("Arquivo importado", { exact: true }),
  ).toBeVisible();
  expect((await healthRecord(page))?.metrics.sleepHours.value).toBeNull();
});

test("real focus timing excludes a pause, survives reload and completes a block once", async ({
  page,
}) => {
  await page.clock.install({ time: TEST_TIME });
  await page.goto("/");
  await waitForReady(page);
  await openTimer(page);
  await page
    .getByRole("group", { name: "Destino do foco" })
    .getByRole("button", { name: "Estudo", exact: true })
    .click();
  await page
    .getByLabel("Uma intenção", { exact: false })
    .fill("Revisar o modelo de domínio.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Iniciar foco", exact: true })
    .click();
  await expect
    .poll(async () => (await timerRecord(page))?.session?.category)
    .toBe("study");
  const started = await timerRecord(page);
  await page.clock.fastForward(65_000);
  await expect(page.getByRole("timer")).toHaveText(/^01:0[5-9]$/);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retomar", exact: true }),
  ).toBeVisible();
  const paused = await page.getByRole("timer").textContent();
  await page.clock.fastForward(120_000);
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.reload();
  await waitForReady(page);
  await openTimer(page);
  await expect(
    page.getByRole("button", { name: "Retomar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.getByRole("button", { name: "Retomar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pausar", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(65_000);
  await page
    .getByRole("button", { name: "Concluir bloco", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).focusSessions.length)
    .toBe(1);
  const persisted = await stored(page);
  expect(persisted.focusSessions[0]).toMatchObject({
    id: started?.session?.id,
    minutes: 2,
    category: "study",
    outcome: "Revisar o modelo de domínio.",
  });
  expect((await timerRecord(page))?.session).toBeNull();
  expect(
    persisted.journal.filter((entry) => entry.id === started?.session?.id),
  ).toHaveLength(1);
  await page.reload();
  await waitForReady(page);
  await openTimer(page);
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect(
    page.getByRole("button", { name: "Concluir bloco", exact: true }),
  ).toHaveCount(0);
  expect((await stored(page)).focusSessions).toHaveLength(1);
});

test("a first online visit prepares the XML worker for a later offline import", async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(TEST_TIME);
  await page.goto("/");
  await waitForReady(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await openSources(page);
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "offline-export.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(
      `<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio offline" unit="count" value="1800" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/></HealthData>`,
    ),
  });
  await expect(
    page
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByText("Arquivo importado", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await healthRecord(page))?.metrics.steps.value)
    .toBe(1800);
  expect((await healthRecord(page))?.metrics.sleepHours.value).toBeNull();
  await context.setOffline(false);
});

test("an import finishing after another tab clears health data cannot resurrect the deleted readings", async ({
  page,
  context,
}) => {
  // Without BroadcastChannel, the transaction revision must still reject the
  // late result; this exercises storage consistency instead of cancellation.
  await context.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", {
      value: undefined,
      configurable: true,
    });
  });
  await page.clock.setFixedTime(TEST_TIME);
  await page.goto("/");
  await waitForReady(page);
  await openSources(page);
  const xml = (steps: number) =>
    `<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio de teste" unit="count" value="${steps}" startDate="${HEALTH_RECORD_START}" endDate="${HEALTH_RECORD_END}"/></HealthData>`;
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "export.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml(1000)),
  });
  await expect
    .poll(async () => (await healthRecord(page))?.metrics.steps.value)
    .toBe(1000);
  await page.evaluate(() => {
    const target = window as typeof window & {
      importHeld: boolean;
      releaseImport: () => void;
    };
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: Transferable[] | StructuredSerializeOptions,
    ) {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "parse"
      ) {
        const worker = this;
        target.importHeld = true;
        target.releaseImport = () => {
          Worker.prototype.postMessage = post;
          Reflect.apply(post, worker, [message, options ?? []]);
        };
        return;
      }
      Reflect.apply(post, this, [message, options ?? []]);
    };
  });
  await page.getByLabel("Arquivo XML do Apple Saúde").setInputFiles({
    name: "replacement.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml(9000)),
  });
  await page.waitForFunction(
    () => (window as typeof window & { importHeld: boolean }).importHeld,
  );
  const other = await context.newPage();
  await other.clock.setFixedTime(TEST_TIME);
  await other.goto("/");
  await waitForReady(other);
  await openSources(other);
  await expect(
    other
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByText("Arquivo importado", { exact: true }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "Remover dados importados", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Confirmar remoção", exact: true })
    .click();
  await expect.poll(() => healthRecord(other)).toBeNull();
  await page.evaluate(() =>
    (window as typeof window & { releaseImport: () => void }).releaseImport(),
  );
  await expect(
    page
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByRole("alert"),
  ).toContainText("alterados ou apagados em outra aba");
  expect(await healthRecord(page)).toBeNull();
  await expect(
    page
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByText("Arquivo importado", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await waitForReady(page);
  await openSources(page);
  await expect(
    page
      .getByRole("region", { name: "Importação Apple Saúde" })
      .getByText("Arquivo importado", { exact: true }),
  ).toHaveCount(0);
});
