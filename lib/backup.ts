import { z } from "zod";
import type { KernelState } from "../types/kernel.ts";
import { normalizeGithubUsername } from "./github.ts";
import {
  isSkincareDay,
  parseSkincareDay,
  parseSkincareSettings,
  type DayLog,
  type Settings,
} from "./skincare.ts";
import { photoSchema, type SkincarePhoto } from "./skincare-storage.ts";
import { MAX_BACKUP_BYTES, parseStoredState } from "./state.ts";

/**
 * Full backup envelope (version 2). The main workspace stays a plain
 * KernelState under `core`; skincare and the GitHub profile are optional scopes.
 * Files written before this format (a bare KernelState) are still accepted.
 */
export const BACKUP_FORMAT = "kernelhub-backup";
export const BACKUP_VERSION = 2;
export const MAX_FULL_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_DAYS = 5000;
const MAX_PHOTOS = 500;
export const INVALID_BACKUP =
  "Este arquivo não é um backup válido do KernelHub. Seus dados atuais foram mantidos.";

export interface BackupPhoto {
  meta: SkincarePhoto;
  bytes: Uint8Array;
}
export interface SkincareBackup {
  settings: Settings;
  days: DayLog[];
  /** null: the file carries no photos, so existing photos are left alone. */
  photos: BackupPhoto[] | null;
}
export interface RestorePlan {
  kind: "legacy" | "full";
  createdAt: string | null;
  app: string | null;
  core: KernelState;
  skincare: SkincareBackup | null;
  githubUsername: string | null;
}
export type BackupParse =
  { ok: true; plan: RestorePlan } | { ok: false; error: string };

const envelopeSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    createdAt: z.iso.datetime(),
    app: z.string().max(32),
    core: z.unknown(),
    skincare: z
      .object({
        settings: z.unknown(),
        days: z.array(z.unknown()).max(MAX_DAYS),
        photos: z
          .array(z.object({ meta: z.unknown(), data: z.string() }).strict())
          .max(MAX_PHOTOS)
          .nullable(),
      })
      .strict()
      .optional(),
    integrations: z
      .object({
        github: z
          .object({ username: z.string().max(64) })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
export function base64ToBytes(value: string): Uint8Array | null {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
function matchesImage(bytes: Uint8Array, type: SkincarePhoto["type"]) {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

function parseSkincare(
  scope: NonNullable<z.infer<typeof envelopeSchema>["skincare"]>,
): SkincareBackup | null {
  const settings = parseSkincareSettings(scope.settings);
  if (!settings) return null;
  const days: DayLog[] = [];
  for (const raw of scope.days) {
    const day = parseSkincareDay(raw);
    if (!day) return null;
    days.push(day);
  }
  if (new Set(days.map((day) => day.day)).size !== days.length) return null;
  if (scope.photos === null) return { settings, days, photos: null };
  const photos: BackupPhoto[] = [];
  const ids = new Set<string>();
  for (const item of scope.photos) {
    const meta = photoSchema.safeParse(item.meta);
    const bytes = base64ToBytes(item.data);
    if (
      !meta.success ||
      !bytes ||
      !isSkincareDay(meta.data.day) ||
      ids.has(meta.data.id) ||
      bytes.length !== meta.data.size ||
      !matchesImage(bytes, meta.data.type)
    )
      return null;
    ids.add(meta.data.id);
    photos.push({ meta: meta.data, bytes });
  }
  return { settings, days, photos };
}

export function parseBackup(text: string): BackupParse {
  if (typeof text !== "string" || text.length > MAX_FULL_BACKUP_BYTES)
    return { ok: false, error: "Use um backup de até 64 MB." };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: INVALID_BACKUP };
  }
  const isEnvelope =
    typeof json === "object" &&
    json !== null &&
    (json as { format?: unknown }).format === BACKUP_FORMAT;
  if (!isEnvelope) {
    // Backups from before the envelope are a bare KernelState.
    const core = parseStoredState(text);
    return core
      ? {
          ok: true,
          plan: {
            kind: "legacy",
            createdAt: null,
            app: null,
            core,
            skincare: null,
            githubUsername: null,
          },
        }
      : { ok: false, error: INVALID_BACKUP };
  }
  if ((json as { version?: unknown }).version !== BACKUP_VERSION)
    return {
      ok: false,
      error:
        "Este backup foi criado por outra versão do KernelHub e não pode ser restaurado aqui. Seus dados atuais foram mantidos.",
    };
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return { ok: false, error: INVALID_BACKUP };
  const serializedCore = JSON.stringify(envelope.data.core);
  const core =
    serializedCore !== undefined && serializedCore.length <= MAX_BACKUP_BYTES
      ? parseStoredState(serializedCore)
      : null;
  if (!core) return { ok: false, error: INVALID_BACKUP };
  let skincare: SkincareBackup | null = null;
  if (envelope.data.skincare) {
    skincare = parseSkincare(envelope.data.skincare);
    if (!skincare) return { ok: false, error: INVALID_BACKUP };
  }
  let githubUsername: string | null = null;
  if (envelope.data.integrations?.github) {
    githubUsername = normalizeGithubUsername(
      envelope.data.integrations.github.username,
    );
    if (!githubUsername) return { ok: false, error: INVALID_BACKUP };
  }
  return {
    ok: true,
    plan: {
      kind: "full",
      createdAt: envelope.data.createdAt,
      app: envelope.data.app,
      core,
      skincare,
      githubUsername,
    },
  };
}

export interface BackupSource {
  core: KernelState;
  skincare: {
    settings: Settings;
    days: DayLog[];
    photos: { meta: SkincarePhoto; blob: Blob }[] | null;
  } | null;
  githubUsername: string | null;
  app: string;
  now?: Date;
}
export interface BuiltBackup {
  blob: Blob;
  photos: number;
}

/** Streams the file as Blob parts so photos are never joined into one giant string. */
export async function buildBackup(source: BackupSource): Promise<BuiltBackup> {
  if (!parseStoredState(JSON.stringify(source.core)))
    throw new Error("Os registros atuais não puderam ser validados.");
  const parts: BlobPart[] = [
    `{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"createdAt":${JSON.stringify((source.now ?? new Date()).toISOString())},"app":${JSON.stringify(source.app)},"core":${JSON.stringify(source.core)}`,
  ];
  let photos = 0;
  if (source.skincare) {
    parts.push(
      `,"skincare":{"settings":${JSON.stringify(source.skincare.settings)},"days":${JSON.stringify(source.skincare.days)},"photos":`,
    );
    if (source.skincare.photos === null) parts.push("null");
    else {
      parts.push("[");
      for (const photo of source.skincare.photos) {
        const bytes = new Uint8Array(await photo.blob.arrayBuffer());
        parts.push(
          `${photos ? "," : ""}{"meta":${JSON.stringify(photo.meta)},"data":"${bytesToBase64(bytes)}"}`,
        );
        photos++;
      }
      parts.push("]");
    }
    parts.push("}");
  }
  if (source.githubUsername)
    parts.push(
      `,"integrations":{"github":{"username":${JSON.stringify(source.githubUsername)}}}`,
    );
  parts.push("}");
  return { blob: new Blob(parts, { type: "application/json" }), photos };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** Human-readable lines that say exactly what a restore will replace. */
export function describePlan(plan: RestorePlan): string[] {
  const { core } = plan;
  const lines = [
    `Registros do espaço em ${core.day}: ${plural(core.meals.length, "refeição", "refeições")}, ${plural(core.history.length, "resumo diário", "resumos diários")}, ${plural(core.insights.length, "insight", "insights")} e ${plural(core.wishlist.length, "item de wishlist", "itens de wishlist")}.`,
  ];
  if (plan.skincare) {
    const { settings, days, photos } = plan.skincare;
    lines.push(
      `Skincare: ${plural(settings.products.length, "produto", "produtos")} e ${plural(days.length, "dia de histórico", "dias de histórico")}${
        photos === null
          ? "; fotos não incluídas, as atuais serão mantidas."
          : `, com ${plural(photos.length, "foto", "fotos")}.`
      }`,
    );
  } else
    lines.push(
      "Skincare, fotos e fontes não estão neste arquivo e não serão alterados.",
    );
  if (plan.githubUsername)
    lines.push(`GitHub: o perfil @${plan.githubUsername} será reconectado.`);
  return lines;
}
