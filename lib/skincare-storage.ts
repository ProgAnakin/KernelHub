import { z } from "zod";
import {
  applySkincareCheck,
  markPendingUsed,
  applySkincareSettings,
  initialSkincareSettings,
  makeDayLog,
  parseSkincareDay,
  parseSkincareSettings,
  reconcileTodayPlan,
  skincareDay,
  type CheckStatus,
  type DayLog,
  type Period,
  type Product,
  type Settings,
} from "./skincare.ts";

// Reuse the application's existing transaction store without changing its schema
// or placing photos/full skincare history inside the bounded KernelState backup.
export const SKINCARE_SETTINGS_KEY = "kernelhub:skincare:settings:v1";
export const SKINCARE_DAY_PREFIX = "kernelhub:skincare:day:";
export const SKINCARE_CHANNEL = "kernelhub:skincare";
export const SKINCARE_PHOTO_PREFIX = "kernelhub:skincare:photo-meta:";
export const SKINCARE_BLOB_PREFIX = "kernelhub:skincare:photo-blob:";
export const SKINCARE_REVISION_KEY = "kernelhub:skincare:revision";
const PHOTO_PREFIX = SKINCARE_PHOTO_PREFIX;
const BLOB_PREFIX = SKINCARE_BLOB_PREFIX;
const REVISION_KEY = SKINCARE_REVISION_KEY;
export const MAX_SKINCARE_PHOTO_BYTES = 5 * 1024 * 1024;
/** A camera original is resized and re-encoded below the stored limit above. */
export const MAX_SKINCARE_SOURCE_BYTES = 25 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProductInput = Omit<Product, "id" | "createdAt" | "archived"> & {
  id?: string;
};
export const photoSchema = z
  .object({
    id: z.string().min(1).max(80),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(500),
    createdAt: z.iso.datetime(),
    type: z.enum(imageTypes),
    size: z.number().int().min(1).max(MAX_SKINCARE_PHOTO_BYTES),
  })
  .strict();
export type SkincarePhoto = z.infer<typeof photoSchema>;
export interface SkincareSnapshot {
  settings: Settings;
  today: DayLog;
  history: DayLog[];
  photos: SkincarePhoto[];
  revision: string | null;
}
export type SkincareMutation =
  | { type: "product-save"; product: ProductInput }
  | { type: "product-archive"; id: string }
  | { type: "reorder"; period: Period; productIds: string[] }
  | { type: "transition"; minute: number }
  | {
      type: "check";
      day: string;
      period: Period;
      productId: string;
      status: CheckStatus;
      reason?: string;
    }
  | { type: "check-pending"; day: string; period: Period }
  | { type: "photo-add"; photo: SkincarePhoto; blob: Blob }
  | { type: "photo-remove"; id: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error("O navegador não disponibilizou o armazenamento local."),
      );
      return;
    }
    let settled = false;
    const request = indexedDB.open("kernelhub", 1);
    const timer = setTimeout(() => {
      settled = true;
      reject(
        new Error("O armazenamento do armário não respondeu. Tente novamente."),
      );
    }, 5000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("records"))
        request.result.createObjectStore("records");
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(
          new Error("Não foi possível abrir o armário neste dispositivo."),
        );
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
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function begin(
  database: IDBDatabase,
  mode: IDBTransactionMode,
): IDBTransaction {
  try {
    return database.transaction("records", mode);
  } catch {
    database.close();
    throw new Error(
      "Não foi possível acessar os registros do armário. Tente novamente.",
    );
  }
}

function dateIsValid(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime()) && skincareDay(date) === day;
}
function requireDate(day: string, now: Date) {
  if (!dateIsValid(day) || day > skincareDay(now))
    throw new Error("Escolha uma data válida, até o dia de hoje.");
}
function settingsFrom(raw: unknown): Settings {
  if (raw === undefined) return initialSkincareSettings();
  const settings = typeof raw === "string" ? parseSkincareSettings(raw) : null;
  if (!settings)
    throw new Error(
      "O cadastro do armário está incompatível. Os dados originais foram preservados.",
    );
  return settings;
}
function dayFrom(raw: unknown, day: string): DayLog | null {
  if (raw === undefined) return null;
  const log = typeof raw === "string" ? parseSkincareDay(raw) : null;
  if (!log || log.day !== day)
    throw new Error(
      "Há um registro de skincare incompatível. O histórico original foi preservado.",
    );
  return log;
}
function photoFrom(raw: unknown): SkincarePhoto {
  try {
    if (typeof raw !== "string" || raw.length > 4096) throw new Error();
    const result = photoSchema.safeParse(JSON.parse(raw));
    if (result.success && dateIsValid(result.data.day)) return result.data;
  } catch {
    /* Preserve corrupt records instead of overwriting them. */
  }
  throw new Error(
    "Uma foto salva tem informações incompatíveis. O arquivo original foi preservado.",
  );
}
export function prefixRange(prefix: string) {
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`);
}

/** Read and reconcile only today's plan. Old day records are never reset or pruned. */
export async function readSkincareSnapshot(
  now = new Date(),
  includeHistory = true,
): Promise<SkincareSnapshot> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = begin(database, "readwrite");
    const store = transaction.objectStore("records");
    const settingsRequest = store.get(SKINCARE_SETTINGS_KEY);
    const dayRange = includeHistory
      ? prefixRange(SKINCARE_DAY_PREFIX)
      : IDBKeyRange.only(SKINCARE_DAY_PREFIX + skincareDay(now));
    const daysRequest = store.getAll(dayRange);
    const dayKeysRequest = store.getAllKeys(dayRange);
    const photosRequest = includeHistory
      ? store.getAll(prefixRange(PHOTO_PREFIX))
      : null;
    const photoKeysRequest = includeHistory
      ? store.getAllKeys(prefixRange(PHOTO_PREFIX))
      : null;
    const revisionRequest = store.get(REVISION_KEY);
    let remaining = includeHistory ? 6 : 4;
    let result: SkincareSnapshot;
    let failure: unknown;
    const ready = () => {
      if (--remaining) return;
      try {
        const settings = settingsFrom(settingsRequest.result);
        const history = daysRequest.result.map((raw, index) => {
          const key = dayKeysRequest.result[index];
          if (typeof key !== "string")
            throw new Error("Chave de histórico incompatível.");
          return dayFrom(raw, key.slice(SKINCARE_DAY_PREFIX.length))!;
        });
        const photos = (photosRequest?.result ?? [])
          .map((raw: unknown, index: number) => {
            const photo = photoFrom(raw);
            if (photoKeysRequest!.result[index] !== PHOTO_PREFIX + photo.id)
              throw new Error("Chave de foto incompatível.");
            return photo;
          })
          .sort(
            (left, right) =>
              right.day.localeCompare(left.day) ||
              right.createdAt.localeCompare(left.createdAt),
          );
        const day = skincareDay(now);
        const previous = history.find((log) => log.day === day);
        const today = previous
          ? reconcileTodayPlan(previous, settings, now)
          : makeDayLog(settings, now);
        let revision =
          typeof revisionRequest.result === "string"
            ? revisionRequest.result
            : null;
        const changed =
          settingsRequest.result === undefined ||
          JSON.stringify(today) !== JSON.stringify(previous);
        if (settingsRequest.result === undefined)
          store.put(JSON.stringify(settings), SKINCARE_SETTINGS_KEY);
        if (JSON.stringify(today) !== JSON.stringify(previous))
          store.put(JSON.stringify(today), SKINCARE_DAY_PREFIX + day);
        if (changed) {
          revision = crypto.randomUUID();
          store.put(revision, REVISION_KEY);
        }
        const index = history.findIndex((log) => log.day === day);
        if (index < 0) history.push(today);
        else history[index] = today;
        result = {
          settings,
          today,
          history: history.sort((a, b) => b.day.localeCompare(a.day)),
          photos,
          revision,
        };
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    for (const request of [
      settingsRequest,
      daysRequest,
      dayKeysRequest,
      photosRequest,
      photoKeysRequest,
      revisionRequest,
    ])
      if (request) request.onsuccess = ready;
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onabort = () => {
      database.close();
      reject(
        failure ??
          transaction.error ??
          new Error("Não foi possível ler o armário."),
      );
    };
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
  });
}

/** Every action reads canonical data and writes in the same transaction, across tabs. */
export async function mutateSkincare(
  command: SkincareMutation,
  now = new Date(),
): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = begin(database, "readwrite");
    const store = transaction.objectStore("records");
    const day =
      command.type === "check" || command.type === "check-pending"
        ? command.day
        : skincareDay(now);
    const settingsRequest = store.get(SKINCARE_SETTINGS_KEY);
    const dayRequest = store.get(SKINCARE_DAY_PREFIX + day);
    const photoRequest =
      command.type === "photo-remove"
        ? store.get(PHOTO_PREFIX + command.id)
        : null;
    let remaining = photoRequest ? 3 : 2;
    let failure: unknown;
    const ready = () => {
      if (--remaining) return;
      try {
        requireDate(day, now);
        let settings = settingsFrom(settingsRequest.result);
        let log = dayFrom(dayRequest.result, day);
        if (!log && day !== skincareDay(now))
          throw new Error(
            "Não há planejamento salvo para essa data. O histórico não foi alterado.",
          );
        log = log ?? makeDayLog(settings, now);
        if (day === skincareDay(now))
          log = reconcileTodayPlan(log, settings, now);
        switch (command.type) {
          case "product-save": {
            const old = settings.products.find(
              (product) => product.id === command.product.id,
            );
            const product: Product = {
              ...command.product,
              id: command.product.id ?? crypto.randomUUID(),
              createdAt: old?.createdAt ?? now.toISOString(),
              archived: false,
            };
            settings = applySkincareSettings(settings, {
              type: "product-save",
              product,
            });
            log = reconcileTodayPlan(log, settings, now);
            break;
          }
          case "product-archive":
          case "reorder":
          case "transition":
            settings = applySkincareSettings(settings, command);
            log = reconcileTodayPlan(log, settings, now);
            break;
          case "check":
            log = applySkincareCheck(
              log,
              command.productId,
              command.period,
              command.status,
              command.reason ?? "",
              now,
            );
            break;
          case "check-pending":
            log = markPendingUsed(log, command.period, now);
            break;
          case "photo-add": {
            requireDate(command.photo.day, now);
            const valid = photoSchema.safeParse(command.photo);
            if (
              !valid.success ||
              !(command.blob instanceof Blob) ||
              command.blob.size !== command.photo.size ||
              command.blob.type !== command.photo.type
            )
              throw new Error("A foto não pôde ser validada.");
            store.put(JSON.stringify(valid.data), PHOTO_PREFIX + valid.data.id);
            store.put(command.blob, BLOB_PREFIX + valid.data.id);
            break;
          }
          case "photo-remove":
            if (photoRequest!.result !== undefined)
              photoFrom(photoRequest!.result);
            store.delete(PHOTO_PREFIX + command.id);
            store.delete(BLOB_PREFIX + command.id);
            break;
        }
        if (!parseSkincareSettings(settings) || !parseSkincareDay(log))
          throw new Error(
            "Não foi possível validar a alteração. Os dados anteriores foram mantidos.",
          );
        store.put(JSON.stringify(settings), SKINCARE_SETTINGS_KEY);
        store.put(JSON.stringify(log), SKINCARE_DAY_PREFIX + day);
        store.put(crypto.randomUUID(), REVISION_KEY);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    settingsRequest.onsuccess = ready;
    dayRequest.onsuccess = ready;
    if (photoRequest) photoRequest.onsuccess = ready;
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(
        failure ??
          transaction.error ??
          new Error(
            "O navegador não confirmou a gravação. A alteração não foi salva.",
          ),
      );
    };
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
  });
}

export async function prepareSkincarePhoto(
  blob: Blob,
  day: string,
  note = "",
  now = new Date(),
): Promise<{ photo: SkincarePhoto; blob: Blob }> {
  requireDate(day, now);
  if (
    !(blob instanceof Blob) ||
    !imageTypes.includes(blob.type as (typeof imageTypes)[number]) ||
    blob.size < 1 ||
    blob.size > MAX_SKINCARE_PHOTO_BYTES
  )
    throw new Error("Escolha uma foto JPEG, PNG ou WebP de até 5 MB.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (value, index) => bytes[index] === value,
  );
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (blob.type === "image/jpeg" && jpeg) ||
    (blob.type === "image/png" && png) ||
    (blob.type === "image/webp" && webp)
  ))
    throw new Error("O conteúdo não corresponde ao formato da foto.");
  const photo = {
    id: crypto.randomUUID(),
    day,
    note: note.trim(),
    createdAt: now.toISOString(),
    type: blob.type as SkincarePhoto["type"],
    size: blob.size,
  };
  if (!photoSchema.safeParse(photo).success)
    throw new Error(
      "Confira a data e a anotação da foto (até 500 caracteres).",
    );
  return { photo, blob };
}

export async function readSkincarePhoto(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = begin(database, "readonly");
    const store = transaction.objectStore("records");
    const metadata = store.get(PHOTO_PREFIX + id);
    const file = store.get(BLOB_PREFIX + id);
    transaction.oncomplete = () => {
      database.close();
      try {
        if (metadata.result === undefined) {
          resolve(null);
          return;
        }
        const photo = photoFrom(metadata.result);
        const blob = file.result;
        if (
          !(blob instanceof Blob) ||
          blob.type !== photo.type ||
          blob.size !== photo.size
        )
          throw new Error(
            "A foto salva não pôde ser recuperada. O arquivo original foi preservado.",
          );
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível abrir a foto."));
    };
  });
}

export async function readSkincareRevision(): Promise<string | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = begin(database, "readonly");
    const request = transaction.objectStore("records").get(REVISION_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve(typeof request.result === "string" ? request.result : null);
    };
    transaction.onabort = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Não foi possível verificar o armário."),
      );
    };
  });
}
