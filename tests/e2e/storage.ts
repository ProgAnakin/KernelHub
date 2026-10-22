import type { Page } from "@playwright/test";
import type { KernelState } from "../../types/kernel";

export const STORAGE_KEY = "kernelhub:state:v1";

export async function waitForReady(page: Page): Promise<void> {
  await page.locator('.app-background[aria-busy="false"]').waitFor();
}

export async function readRecord(
  page: Page,
  key = STORAGE_KEY,
): Promise<string | null> {
  return page.evaluate(
    (recordKey) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open("kernelhub", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("records", "readonly");
          const request = transaction.objectStore("records").get(recordKey);
          let value: string | null = null;
          request.onsuccess = () => {
            value = typeof request.result === "string" ? request.result : null;
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
    key,
  );
}

export async function writeRecord(
  page: Page,
  value: string,
  key = STORAGE_KEY,
): Promise<void> {
  await page.evaluate(
    ({ recordKey, contents }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("kernelhub", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("records", "readwrite");
          transaction.objectStore("records").put(contents, recordKey);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    { recordKey: key, contents: value },
  );
}

export async function stored(page: Page): Promise<KernelState> {
  const raw = await readRecord(page);
  if (raw === null)
    throw new Error("KernelHub record is missing after hydration");
  return JSON.parse(raw) as KernelState;
}
