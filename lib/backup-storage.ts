import type { SkincarePhoto } from "./skincare-storage.ts";
import {
  initialSkincareSettings,
  parseSkincareDay,
  parseSkincareSettings,
  type DayLog,
  type Settings,
} from "./skincare.ts";
import {
  photoSchema,
  prefixRange,
  SKINCARE_BLOB_PREFIX,
  SKINCARE_CHANNEL,
  SKINCARE_DAY_PREFIX,
  SKINCARE_PHOTO_PREFIX,
  SKINCARE_REVISION_KEY,
  SKINCARE_SETTINGS_KEY,
} from "./skincare-storage.ts";
import type { BackupSource, RestorePlan } from "./backup.ts";
import { parseStoredState, STORAGE_KEY } from "./state.ts";
import { DB_STORE, openDatabase } from "./storage.ts";

const INCOMPATIBLE =
  "Há registros de skincare incompatíveis. O backup foi interrompido para não omitir dados; nada foi alterado.";

/**
 * Reads every skincare record in ONE read-only transaction, so the file
 * describes a single moment. Anything unreadable aborts the export instead of
 * being left out of a file that is meant to be a safety net.
 */
export async function readSkincareForBackup(
  includePhotos: boolean,
): Promise<BackupSource["skincare"]> {
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
    const store = transaction.objectStore(DB_STORE);
    const settings = store.get(SKINCARE_SETTINGS_KEY);
    const days = store.getAll(prefixRange(SKINCARE_DAY_PREFIX));
    const metas = store.getAll(prefixRange(SKINCARE_PHOTO_PREFIX));
    const metaKeys = store.getAllKeys(prefixRange(SKINCARE_PHOTO_PREFIX));
    const blobs = includePhotos
      ? store.getAll(prefixRange(SKINCARE_BLOB_PREFIX))
      : null;
    const blobKeys = includePhotos
      ? store.getAllKeys(prefixRange(SKINCARE_BLOB_PREFIX))
      : null;
    transaction.oncomplete = () => {
      database.close();
      try {
        if (
          settings.result === undefined &&
          days.result.length === 0 &&
          metas.result.length === 0
        ) {
          resolve(null);
          return;
        }
        const parsedSettings: Settings | null =
          settings.result === undefined
            ? null
            : parseSkincareSettings(settings.result);
        if (settings.result !== undefined && !parsedSettings)
          throw new Error(INCOMPATIBLE);
        const parsedDays: DayLog[] = days.result.map((raw: unknown) => {
          const day = parseSkincareDay(raw);
          if (!day) throw new Error(INCOMPATIBLE);
          return day;
        });
        let photos: { meta: SkincarePhoto; blob: Blob }[] | null = null;
        if (blobs && blobKeys) {
          const byId = new Map<string, Blob>();
          blobKeys.result.forEach((key: unknown, index: number) => {
            if (typeof key === "string" && blobs.result[index] instanceof Blob)
              byId.set(
                key.slice(SKINCARE_BLOB_PREFIX.length),
                blobs.result[index],
              );
          });
          photos = metas.result.map((raw: unknown, index: number) => {
            const meta =
              typeof raw === "string"
                ? photoSchema.safeParse(JSON.parse(raw))
                : null;
            const key = metaKeys.result[index];
            const blob = meta?.success ? byId.get(meta.data.id) : undefined;
            if (
              !meta?.success ||
              key !== SKINCARE_PHOTO_PREFIX + meta.data.id ||
              !blob ||
              blob.size !== meta.data.size ||
              blob.type !== meta.data.type
            )
              throw new Error(
                "Uma foto salva não pôde ser lida. O backup foi interrompido para não omitir dados; nada foi alterado.",
              );
            return { meta: meta.data, blob };
          });
        }
        resolve({
          settings: parsedSettings ?? initialSkincareSettings(),
          days: parsedDays,
          photos,
        });
      } catch (error) {
        reject(error);
      }
    };
    transaction.onabort = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Não foi possível ler o skincare."),
      );
    };
  });
}

/**
 * Replaces the workspace and, when the file carries it, the whole skincare
 * scope in a single transaction: either everything is restored or nothing is.
 */
export async function restoreFromPlan(plan: RestorePlan): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(DB_STORE, "readwrite");
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    const store = transaction.objectStore(DB_STORE);
    let failure: unknown;
    try {
      const core = parseStoredState(JSON.stringify(plan.core), new Date());
      if (!core) throw new Error("O backup não pôde ser validado.");
      store.put(JSON.stringify(core), STORAGE_KEY);
      if (plan.skincare) {
        const { settings, days, photos } = plan.skincare;
        store.delete(SKINCARE_SETTINGS_KEY);
        store.delete(prefixRange(SKINCARE_DAY_PREFIX));
        store.put(JSON.stringify(settings), SKINCARE_SETTINGS_KEY);
        for (const day of days)
          store.put(JSON.stringify(day), SKINCARE_DAY_PREFIX + day.day);
        if (photos) {
          store.delete(prefixRange(SKINCARE_PHOTO_PREFIX));
          store.delete(prefixRange(SKINCARE_BLOB_PREFIX));
          for (const { meta, bytes } of photos) {
            store.put(JSON.stringify(meta), SKINCARE_PHOTO_PREFIX + meta.id);
            store.put(
              new Blob([bytes as BlobPart], { type: meta.type }),
              SKINCARE_BLOB_PREFIX + meta.id,
            );
          }
        }
        store.put(crypto.randomUUID(), SKINCARE_REVISION_KEY);
      }
    } catch (error) {
      failure = error;
      transaction.abort();
    }
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(
        failure ??
          transaction.error ??
          new Error("O navegador não confirmou a restauração."),
      );
    };
  });
}

/** Tell other tabs and hooks in this page that stored records changed. */
export function announceRestore(plan: RestorePlan) {
  if (typeof BroadcastChannel !== "function") return;
  for (const name of plan.skincare
    ? [STORAGE_KEY, SKINCARE_CHANNEL]
    : [STORAGE_KEY]) {
    try {
      const channel = new BroadcastChannel(name);
      channel.postMessage("changed");
      channel.close();
    } catch {
      /* The committed transaction stays authoritative. */
    }
  }
}
