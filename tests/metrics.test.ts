import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHealthExport } from "../lib/health.ts";
import { checkinSuggestions, nextStep } from "../lib/metrics.ts";
import { createInitialState } from "../lib/mock-engine.ts";
import { kernelReducer } from "../lib/state.ts";

const now = new Date("2026-10-23T18:00:00Z");
const record = (
  type: string,
  value: string | number,
  unit: string,
  start: string,
  end: string,
  source = "Relógio",
) =>
  `<Record type="${type}" sourceName="${source}" unit="${unit}" value="${value}" startDate="${start}" endDate="${end}"/>`;
const xml = (...records: string[]) =>
  `<?xml version="1.0"?><HealthData>${records.join("")}</HealthData>`;
const SLEEP = "HKCategoryTypeIdentifierSleepAnalysis";
const ASLEEP = "HKCategoryValueSleepAnalysisAsleepCore";

test("recent imported readings are offered for today's check-in with their source", () => {
  const snapshot = parseHealthExport(
    xml(
      record(SLEEP, ASLEEP, "", "2026-10-22T16:20:00Z", "2026-10-23T00:00:00Z"),
      record(
        "HKQuantityTypeIdentifierStepCount",
        8421,
        "count",
        "2026-10-23T08:00:00Z",
        "2026-10-23T09:00:00Z",
        "Balança e relógio",
      ),
      record(
        "HKQuantityTypeIdentifierBodyMass",
        76.44,
        "kg",
        "2026-10-20T08:00:00Z",
        "2026-10-20T08:01:00Z",
        "Balança",
      ),
    ),
    now,
  );
  const suggestions = checkinSuggestions(snapshot, "2026-10-23");
  assert.deepEqual(suggestions.sleepHours, {
    value: 7.7,
    display: "7h40",
    source: "Relógio",
    day: "2026-10-23",
  });
  assert.equal(suggestions.steps?.value, 8421);
  assert.equal(suggestions.steps?.source, "Balança e relógio");
  assert.equal(suggestions.weightKg?.value, 76.4);
  assert.equal(suggestions.weightKg?.day, "2026-10-20");
});

test("stale or missing readings are never passed off as today's", () => {
  assert.deepEqual(checkinSuggestions(null, "2026-10-23"), {
    sleepHours: null,
    weightKg: null,
    steps: null,
  });
  const snapshot = parseHealthExport(
    xml(
      record(SLEEP, ASLEEP, "", "2026-10-19T16:00:00Z", "2026-10-20T00:00:00Z"),
      record(
        "HKQuantityTypeIdentifierStepCount",
        9000,
        "count",
        "2026-10-21T08:00:00Z",
        "2026-10-21T09:00:00Z",
      ),
      record(
        "HKQuantityTypeIdentifierBodyMass",
        80,
        "kg",
        "2026-10-10T08:00:00Z",
        "2026-10-10T08:01:00Z",
      ),
    ),
    now,
  );
  // Sleep ended 3 days ago, steps are from 2 days ago, weight is 13 days old.
  assert.deepEqual(checkinSuggestions(snapshot, "2026-10-23"), {
    sleepHours: null,
    weightKg: null,
    steps: null,
  });
  // The same reading is current for the day it belongs to.
  assert.equal(checkinSuggestions(snapshot, "2026-10-21").steps?.value, 9000);
  // A future reading cannot describe a day that has not happened.
  assert.equal(checkinSuggestions(snapshot, "2026-10-19").steps, null);
});

test("the next step follows what is still missing today", () => {
  let state = createInitialState(new Date(), "personal");
  assert.equal(nextStep(state).sheet, "checkin");
  state = kernelReducer(state, {
    type: "checkin",
    value: {
      energy: 3,
      mood: 3,
      stress: 2,
      sleepHours: 7,
      weightKg: null,
      steps: null,
    },
  });
  assert.equal(nextStep(state).sheet, "nutrition");
  state = kernelReducer(state, { type: "water", amount: 3000 });
  assert.equal(nextStep(state).sheet, "focus");
  state = kernelReducer(state, {
    type: "focus-add",
    minutes: 120,
    category: "project",
    outcome: "",
  });
  assert.equal(nextStep(state).sheet, "routine");
});

test("the constancy grid keeps unrecorded days empty and counts a streak only on met targets", async () => {
  const { rhythmGrid, rhythmStreak } = await import("../lib/metrics.ts");
  const base = createInitialState(new Date(2026, 9, 23, 12), "personal");
  const summary = (day: string, focusMinutes: number) => ({
    day,
    waterMl: 0,
    habitCount: 0,
    workoutSets: 0,
    runKm: 0,
    nutritionCalories: 0,
    focusMinutes,
    studyMinutes: 0,
    checkin: null,
  });
  base.history = [
    summary("2026-10-19", 90),
    summary("2026-10-20", 45),
    summary("2026-10-21", 90),
    summary("2026-10-22", 120),
  ];
  const cells = rhythmGrid(base, "focus");
  assert.equal(cells.length, 91);
  assert.equal(cells.at(-1)?.day, "2026-10-23");
  // Today has nothing yet: level 0, not missing, and it does not break the streak.
  assert.equal(cells.at(-1)?.level, 0);
  assert.deepEqual(
    cells.slice(-5, -1).map((cell) => cell.level),
    [4, 2, 4, 4],
  );
  assert.equal(cells.at(-6)?.level, null);
  assert.equal(rhythmStreak(cells), 2);
  assert.equal(cells.filter((cell) => cell.level !== null).length, 5);
});
