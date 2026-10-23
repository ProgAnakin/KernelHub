import { test } from "node:test";
import assert from "node:assert/strict";
import {
  focusElapsedSeconds,
  initialFocusTimer,
  parseFocusTimer,
  prepareFocusCompletion,
  timerStatus,
  updateFocusTimer,
  FocusTimerError,
} from "../lib/focus-timer.ts";

const start = new Date("2026-10-22T12:00:00Z").getTime();
const running = () =>
  updateFocusTimer(
    initialFocusTimer(25),
    {
      type: "start",
      id: "stable-session",
      category: "project",
      outcome: "  Entregar o fluxo  ",
    },
    start,
  );

function rejectsCode(fn: () => unknown, code: string) {
  assert.throws(
    fn,
    (error) => error instanceof FocusTimerError && error.code === code,
  );
}

test("elapsed time comes from timestamps after a reload, without background ticks", () => {
  const record = running();
  const restored = parseFocusTimer(JSON.stringify(record));
  assert.ok(restored);
  assert.equal(timerStatus(restored), "running");
  assert.equal(
    focusElapsedSeconds(restored, start + 25 * 60 * 1000 + 12_500),
    1512,
  );
  const summary = prepareFocusCompletion(
    restored,
    start + 25 * 60 * 1000 + 12_500,
  );
  assert.equal(summary.minutes, 25);
  assert.equal(summary.id, "stable-session");
  assert.equal(summary.outcome, "Entregar o fluxo");
  assert.equal(summary.measuredSeconds, 1512);
});

test("pause and resume exclude paused time and remain stable after repeated commands", () => {
  let record = running();
  record = updateFocusTimer(record, { type: "pause" }, start + 100_500);
  assert.equal(timerStatus(record), "paused");
  assert.equal(focusElapsedSeconds(record, start + 20 * 60_000), 100);
  assert.equal(
    updateFocusTimer(record, { type: "pause" }, start + 200_000),
    record,
  );
  record = updateFocusTimer(record, { type: "resume" }, start + 20 * 60_000);
  assert.equal(
    updateFocusTimer(record, { type: "resume" }, start + 21 * 60_000),
    record,
  );
  assert.equal(focusElapsedSeconds(record, start + 21 * 60_000 + 500), 161);
  assert.equal(
    prepareFocusCompletion(record, start + 21 * 60_000 + 500).minutes,
    2,
  );
});

test("a short session cannot invent a minute and fractional minutes round down", () => {
  const record = running();
  rejectsCode(
    () => prepareFocusCompletion(record, start + 59_999),
    "too-short",
  );
  assert.equal(prepareFocusCompletion(record, start + 60_000).minutes, 1);
  assert.equal(prepareFocusCompletion(record, start + 119_999).minutes, 1);
  rejectsCode(
    () => prepareFocusCompletion(record, start + 90_000, 2),
    "duration",
  );
});

test("forgotten long sessions require explicit adjustment rather than silent truncation", () => {
  const record = running();
  const afterNineHours = start + 9 * 60 * 60 * 1000;
  assert.equal(focusElapsedSeconds(record, afterNineHours), 9 * 60 * 60);
  rejectsCode(() => prepareFocusCompletion(record, afterNineHours), "too-long");
  const reviewed = prepareFocusCompletion(record, afterNineHours, 90);
  assert.equal(reviewed.minutes, 90);
  assert.equal(reviewed.measuredSeconds, 32400);
  rejectsCode(
    () => prepareFocusCompletion(record, afterNineHours, 481),
    "duration",
  );
});

test("a session crossing midnight retains its actual duration and explicit completion date", () => {
  const yesterday = new Date("2026-10-22T23:50:00+02:00").getTime();
  const today = new Date("2026-10-23T00:10:00+02:00").getTime();
  const record = updateFocusTimer(
    initialFocusTimer(25),
    {
      type: "start",
      id: "night-session",
      category: "study",
      outcome: "Leitura",
    },
    yesterday,
  );
  const restored = parseFocusTimer(JSON.stringify(record));
  assert.ok(restored);
  const summary = prepareFocusCompletion(restored, today);
  assert.equal(summary.minutes, 20);
  assert.equal(summary.category, "study");
  assert.equal(summary.startedAt, new Date(yesterday).toISOString());
  assert.equal(summary.completedAt, new Date(today).toISOString());
});

test("another start cannot replace a running session and targets change only while idle", () => {
  const record = running();
  rejectsCode(
    () =>
      updateFocusTimer(
        record,
        { type: "start", id: "other", category: "study", outcome: "" },
        start + 60_000,
      ),
    "active",
  );
  rejectsCode(
    () => updateFocusTimer(record, { type: "target", minutes: 50 }, start),
    "active",
  );
  const cleared = updateFocusTimer(record, { type: "reset" }, start + 60_000);
  assert.equal(timerStatus(cleared), "idle");
  assert.equal(cleared.targetMinutes, 25);
  assert.equal(
    updateFocusTimer(cleared, { type: "target", minutes: 50 }, start)
      .targetMinutes,
    50,
  );
  rejectsCode(
    () =>
      updateFocusTimer(cleared, { type: "target", minutes: Infinity }, start),
    "target",
  );
});

test("clock rollback cannot create negative time or silently conclude an invalid duration", () => {
  const record = running();
  assert.equal(focusElapsedSeconds(record, start - 30_000), 0);
  rejectsCode(
    () => updateFocusTimer(record, { type: "pause" }, start - 61_000),
    "clock",
  );
  rejectsCode(() => prepareFocusCompletion(record, start - 61_000), "clock");
});

test("corrupted, oversized and contradictory timer records fail validation", () => {
  const record = running();
  const invalid = [
    null,
    "{",
    "null",
    "[]",
    JSON.stringify({ ...record, targetMinutes: 0 }),
    JSON.stringify({
      ...record,
      session: { ...record.session!, accumulatedMs: -1 },
    }),
    JSON.stringify({
      ...record,
      session: { ...record.session!, runningSince: start - 1 },
    }),
    JSON.stringify({
      ...record,
      session: { ...record.session!, updatedAt: start - 1 },
    }),
    JSON.stringify({
      ...record,
      session: { ...record.session!, outcome: "x".repeat(5000) },
    }),
    JSON.stringify({ ...record, extra: "é".repeat(2200) }),
  ];
  for (const raw of invalid) assert.equal(parseFocusTimer(raw), null);
  assert.deepEqual(parseFocusTimer(JSON.stringify(record)), record);
});
