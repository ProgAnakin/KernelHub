import type { KernelAction, KernelState } from "../types/kernel.ts";
import { kernelReducer, parseStoredState, STORAGE_KEY } from "./state.ts";

export const DB_NAME = "kernelhub";
export const DB_STORE = "records";
export const DB_VERSION = 1;
const RECOVERY_KEY = `${STORAGE_KEY}:recovery`;
const OPEN_TIMEOUT_MS = 5000;

export interface StoredStateResult {
  state: KernelState;
  recoveryAvailable: boolean;
  changed: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error("Timed out opening the local database"));
    }, OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE))
        request.result.createObjectStore(DB_STORE);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("Unable to open the local database"));
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      // Never keep another tab's future database upgrade blocked.
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function legacyValue(key: string): string | null {
  // Only migration needs localStorage. Existing IndexedDB records remain usable
  // even when a browser policy separately blocks this legacy storage API.
  return localStorage.getItem(key);
}

function removeMigratedLegacy(key: string, original: string | null) {
  if (original === null) return;
  try {
    if (localStorage.getItem(key) === original) localStorage.removeItem(key);
  } catch {
    // The committed database is authoritative; a leftover legacy copy does not replace committed records.
  }
}

/**
 * Read, apply and save in ONE IndexedDB readwrite transaction. Browser-managed
 * transactions serialize writers across tabs without depending on propagation
 * of localStorage events or on optional Web Locks/BroadcastChannel support.
 */
export async function transactStoredState(
  fallback: KernelState,
  actions?: KernelAction | KernelAction[],
): Promise<StoredStateResult> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let result: StoredStateResult;
    let failure: unknown;
    let migratedState: string | null = null;
    let migratedRecovery: string | null = null;
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(DB_STORE, "readwrite");
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    const store = transaction.objectStore(DB_STORE);
    const stateRequest = store.get(STORAGE_KEY);
    const recoveryRequest = store.get(RECOVERY_KEY);
    let completedReads = 0;
    const apply = () => {
      if (++completedReads !== 2) return;
      try {
        let raw: unknown = stateRequest.result;
        let recovery: unknown = recoveryRequest.result;
        if (raw === undefined) {
          // A failed read must not supersede inaccessible pre-migration records.
          migratedState = legacyValue(STORAGE_KEY);
          raw = migratedState;
        }
        if (recovery === undefined) {
          // Recovery migration is best effort when a valid database exists.
          try {
            migratedRecovery = legacyValue(RECOVERY_KEY);
            recovery = migratedRecovery;
          } catch {
            if (stateRequest.result === undefined)
              throw new Error("Legacy storage is inaccessible");
          }
        }
        if (raw !== null && raw !== undefined && typeof raw !== "string")
          throw new Error(
            "Unsupported local database record; preserving original",
          );
        if (
          recovery !== null &&
          recovery !== undefined &&
          typeof recovery !== "string"
        )
          throw new Error("Unsupported recovery record; preserving original");
        const saved = parseStoredState(raw as string | null);
        if (!saved && raw && !recovery) recovery = raw;
        if (recovery && recovery !== recoveryRequest.result)
          store.put(recovery, RECOVERY_KEY);
        const current = saved ?? parseStoredState(JSON.stringify(fallback));
        if (!current) throw new Error("Invalid fallback state");
        const pending = Array.isArray(actions)
          ? actions
          : actions
            ? [actions]
            : [];
        const next = pending.reduce(kernelReducer, current);
        const serialized = JSON.stringify(next);
        if (!parseStoredState(serialized))
          throw new Error("Invalid state; database transaction cancelled");
        const changed = serialized !== stateRequest.result;
        if (changed) store.put(serialized, STORAGE_KEY);
        result = {
          state: next,
          recoveryAvailable: Boolean(recovery),
          changed,
        };
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    stateRequest.onsuccess = apply;
    recoveryRequest.onsuccess = apply;
    transaction.oncomplete = () => {
      database.close();
      // Delete only the exact legacy text that this successful migration read.
      // A failed/aborted transaction never removes the previous copy.
      removeMigratedLegacy(STORAGE_KEY, migratedState);
      removeMigratedLegacy(RECOVERY_KEY, migratedRecovery);
      resolve(result);
    };
    transaction.onabort = () => {
      database.close();
      reject(
        failure ??
          transaction.error ??
          new Error("Local database transaction aborted"),
      );
    };
    transaction.onerror = () => {
      // Request errors abort the transaction by default. Resolve/reject only
      // after its final outcome, so a partial write can never be reported saved.
      failure ??= transaction.error;
    };
  });
}

async function readRaw(key: string): Promise<unknown> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(DB_STORE, "readonly");
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    const request = transaction.objectStore(DB_STORE).get(key);
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Unable to read local records"));
    };
  });
}

export async function readStoredState(): Promise<KernelState | null> {
  const raw = await readRaw(STORAGE_KEY);
  return typeof raw === "string" ? parseStoredState(raw) : null;
}

export async function readRecovery(): Promise<string | null> {
  const raw = await readRaw(RECOVERY_KEY);
  if (typeof raw === "string") return raw;
  // Keep recovery downloads available during migration from the first release.
  try {
    return legacyValue(RECOVERY_KEY);
  } catch {
    return null;
  }
}
