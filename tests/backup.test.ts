import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  base64ToBytes,
  buildBackup,
  bytesToBase64,
  describePlan,
  INVALID_BACKUP,
  MAX_FULL_BACKUP_BYTES,
  parseBackup,
  type BackupSource,
} from "../lib/backup.ts";
import { createInitialState } from "../lib/mock-engine.ts";
import {
  applySkincareCheck,
  applySkincareSettings,
  initialSkincareSettings,
  makeDayLog,
  type Product,
} from "../lib/skincare.ts";
import { kernelReducer } from "../lib/state.ts";

const at = new Date(2026, 9, 23, 10);
const product: Product = {
  id: "serum",
  name: "Sérum",
  brand: "Marca",
  kind: "serum",
  shelf: 2,
  periods: ["am", "pm"],
  archived: false,
  createdAt: at.toISOString(),
};
function jpeg(length: number, seed: number) {
  const bytes = new Uint8Array(length);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  for (let i = 4; i < length; i++) bytes[i] = (i * 31 + seed) & 0xff;
  return bytes;
}
function source(photos = true): BackupSource {
  const settings = applySkincareSettings(initialSkincareSettings(), {
    type: "product-save",
    product,
  });
  let day = makeDayLog(settings, at);
  day = applySkincareCheck(day, "serum", "am", "used", "", at);
  day = applySkincareCheck(day, "serum", "pm", "skipped", "Pele sensível", at);
  const bytes = [jpeg(900, 1), jpeg(1500, 2)];
  let core = createInitialState(at, "personal");
  core = kernelReducer(core, {
    type: "meal",
    name: "Almoço",
    macros: { protein: 30, carbs: 40, fat: 10 },
  });
  return {
    core,
    skincare: {
      settings,
      days: [day],
      photos: photos
        ? bytes.map((data, index) => ({
            meta: {
              id: `photo-${index}`,
              day: "2026-10-22",
              note: `Foto ${index}`,
              createdAt: at.toISOString(),
              type: "image/jpeg" as const,
              size: data.length,
            },
            blob: new Blob([data as BlobPart], { type: "image/jpeg" }),
          }))
        : null,
    },
    githubUsername: "ProgAnakin",
    app: "0.5.0",
    now: at,
  };
}
async function build(input = source()) {
  return (await buildBackup(input)).blob.text();
}
function edit(text: string, change: (value: Record<string, any>) => void) {
  const value = JSON.parse(text);
  change(value);
  return JSON.stringify(value);
}

test("base64 helpers round-trip every byte and reject malformed text", () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  const encoded = bytesToBase64(all);
  assert.deepEqual(base64ToBytes(encoded), all);
  const big = new Uint8Array(100_000).map((_, i) => (i * 7) & 0xff);
  assert.deepEqual(base64ToBytes(bytesToBase64(big)), big);
  for (const bad of ["abc", "ab=c", "a b=", "@@@@", "AAA=A"])
    assert.equal(base64ToBytes(bad), null, bad);
});

test("a full backup carries the workspace, skincare history, photos and GitHub profile", async () => {
  const text = await build();
  const result = parseBackup(text);
  assert.ok(result.ok);
  const { plan } = result;
  assert.equal(plan.kind, "full");
  assert.equal(plan.createdAt, at.toISOString());
  assert.equal(plan.core.meals[0].name, "Almoço");
  assert.equal(plan.skincare?.settings.products[0].name, "Sérum");
  assert.equal(plan.skincare?.days.length, 1);
  const entries = plan.skincare!.days[0].entries;
  assert.equal(entries.am.serum.status, "used");
  assert.equal(entries.pm.serum.reason, "Pele sensível");
  assert.equal(plan.skincare?.photos?.length, 2);
  assert.deepEqual(plan.skincare!.photos![0].bytes, jpeg(900, 1));
  assert.deepEqual(plan.skincare!.photos![1].bytes, jpeg(1500, 2));
  assert.equal(plan.githubUsername, "ProgAnakin");
  const lines = describePlan(plan).join(" ");
  assert.match(lines, /1 produto e 1 dia de histórico, com 2 fotos/);
  assert.match(lines, /@ProgAnakin/);
});

test("a backup without photos keeps the existing photos instead of erasing them", async () => {
  const result = parseBackup(await build(source(false)));
  assert.ok(result.ok);
  assert.equal(result.plan.skincare?.photos, null);
  assert.match(describePlan(result.plan).join(" "), /as atuais serão mantidas/);
});

test("scopes that were never recorded stay out of the file", async () => {
  const input = source();
  input.skincare = null;
  input.githubUsername = null;
  const text = await build(input);
  assert.deepEqual(Object.keys(JSON.parse(text)), [
    "format",
    "version",
    "createdAt",
    "app",
    "core",
  ]);
  const result = parseBackup(text);
  assert.ok(result.ok);
  assert.equal(result.plan.skincare, null);
  assert.equal(result.plan.githubUsername, null);
  assert.match(describePlan(result.plan).join(" "), /não serão alterados/);
});

test("backups written before the envelope still restore the workspace only", () => {
  const legacy = createInitialState(at, "personal");
  const result = parseBackup(JSON.stringify(legacy));
  assert.ok(result.ok);
  assert.equal(result.plan.kind, "legacy");
  assert.equal(result.plan.skincare, null);
  assert.equal(result.plan.core.mode, "personal");
});

test("damaged, tampered or unrelated files are rejected without a partial plan", async () => {
  const text = await build();
  const cases: Record<string, string> = {
    "not json": "{",
    truncated: text.slice(0, text.length - 40),
    "empty object": "{}",
    "unknown top-level key": edit(text, (v) => (v.extra = 1)),
    "invalid workspace": edit(text, (v) => (v.core.waterMl = -5)),
    "workspace missing": edit(text, (v) => delete v.core),
    "invalid skincare settings": edit(
      text,
      (v) => (v.skincare.settings.products[0].shelf = 9),
    ),
    "duplicate skincare day": edit(text, (v) =>
      v.skincare.days.push(v.skincare.days[0]),
    ),
    "photo size lies": edit(text, (v) => (v.skincare.photos[0].meta.size += 1)),
    "photo bytes are not a jpeg": edit(
      text,
      (v) => (v.skincare.photos[0].data = bytesToBase64(new Uint8Array(900))),
    ),
    "photo base64 corrupted": edit(
      text,
      (v) => (v.skincare.photos[0].data = "###" + v.skincare.photos[0].data),
    ),
    "duplicate photo id": edit(
      text,
      (v) => (v.skincare.photos[1].meta.id = v.skincare.photos[0].meta.id),
    ),
    "photo day is impossible": edit(
      text,
      (v) => (v.skincare.photos[0].meta.day = "2026-02-31"),
    ),
    "invalid github user": edit(
      text,
      (v) => (v.integrations.github.username = "no spaces allowed"),
    ),
    "foreign format": edit(text, (v) => (v.format = "other-app")),
  };
  for (const [name, value] of Object.entries(cases)) {
    const result = parseBackup(value);
    assert.equal(result.ok, false, name);
    if (!result.ok) assert.equal(result.error, INVALID_BACKUP, name);
  }
});

test("a newer envelope version is refused with an explicit message and size is bounded", async () => {
  const text = await build();
  const newer = parseBackup(edit(text, (v) => (v.version = 3)));
  assert.equal(newer.ok, false);
  if (!newer.ok) assert.match(newer.error, /outra versão/);
  const huge = parseBackup(" ".repeat(MAX_FULL_BACKUP_BYTES + 1));
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.match(huge.error, /64 MB/);
  assert.equal(JSON.parse(text).format, BACKUP_FORMAT);
});

test("a workspace over the 2 MiB state limit cannot hide inside a full backup", async () => {
  const text = await build();
  const bloated = edit(
    text,
    (v) => (v.core.journal[0].detail = "x".repeat(3_000_000)),
  );
  assert.equal(parseBackup(bloated).ok, false);
});

test("exporting refuses a workspace that would not restore", async () => {
  const input = source();
  (input.core as { waterMl: number }).waterMl = Number.NaN;
  await assert.rejects(buildBackup(input), /validados/);
});
