import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, localDay } from "../lib/mock-engine.ts";
import { kernelReducer, reconcileDay } from "../lib/state.ts";
import type { KernelAction } from "../types/kernel.ts";

function days() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return { today, yesterday };
}

function stamped(action: KernelAction, id: string, date: Date): KernelAction {
  return { ...action, event: { id, createdAt: date.toISOString() } };
}

test("an unsaved daily action retains its original day before the final rollover", () => {
  const { yesterday, today } = days();
  const saved = createInitialState(yesterday, "personal");
  saved.waterMl = 1000;
  const pending = stamped(
    { type: "water", amount: 250 },
    "pending-water",
    yesterday,
  );
  const replayed = kernelReducer(saved, pending);
  assert.equal(replayed.day, localDay(yesterday));
  assert.equal(replayed.waterMl, 1250);
  assert.deepEqual(replayed.history, []);

  const current = reconcileDay(replayed, today);
  assert.equal(current.day, localDay(today));
  assert.equal(current.waterMl, 0);
  assert.equal(current.history.length, 1);
  assert.equal(current.history[0].waterMl, 1250);
  assert.equal(current.journal[0].createdAt, yesterday.toISOString());
});

test("a pending batch spanning two days archives each measure on the correct day", () => {
  const { yesterday, today } = days();
  const beforeMidnight = new Date(yesterday);
  beforeMidnight.setHours(23, 59, 0, 0);
  const afterMidnight = new Date(today);
  afterMidnight.setHours(0, 1, 0, 0);
  const saved = createInitialState(yesterday, "personal");
  saved.waterMl = 1000;
  const pending: KernelAction[] = [
    stamped({ type: "water", amount: 250 }, "yesterday-water", beforeMidnight),
    stamped(
      {
        type: "focus-add",
        category: "project",
        minutes: 50,
        outcome: "Trabalho de ontem",
      },
      "yesterday-focus",
      beforeMidnight,
    ),
    stamped(
      {
        type: "meal",
        name: "Ceia",
        macros: { protein: 30, carbs: 40, fat: 10 },
      },
      "yesterday-meal",
      beforeMidnight,
    ),
    stamped(
      {
        type: "checkin",
        value: {
          energy: 4,
          mood: 3,
          stress: 2,
          sleepHours: 7.5,
          weightKg: null,
          steps: 7000,
        },
      },
      "yesterday-checkin",
      beforeMidnight,
    ),
    stamped({ type: "water", amount: 500 }, "today-water", afterMidnight),
    stamped(
      {
        type: "focus-add",
        category: "study",
        minutes: 25,
        outcome: "Estudo de hoje",
      },
      "today-focus",
      afterMidnight,
    ),
  ];
  const replayed = pending.reduce(kernelReducer, saved);
  assert.equal(replayed.day, localDay(today));
  assert.equal(replayed.waterMl, 500);
  assert.equal(replayed.focusSessions.length, 1);
  assert.equal(replayed.focusSessions[0].id, "today-focus");
  assert.equal(replayed.focusSessions[0].minutes, 25);
  assert.equal(replayed.focusSessions[0].category, "study");
  assert.equal(
    replayed.focusSessions[0].createdAt,
    afterMidnight.toISOString(),
  );
  assert.deepEqual(replayed.meals, []);
  assert.deepEqual(replayed.nutrition, { protein: 0, carbs: 0, fat: 0 });
  assert.equal(replayed.checkin, null);
  assert.equal(replayed.history.length, 1);
  assert.equal(replayed.history[0].day, localDay(yesterday));
  assert.equal(replayed.history[0].waterMl, 1250);
  assert.equal(replayed.history[0].focusMinutes, 50);
  assert.equal(replayed.history[0].studyMinutes, 0);
  assert.equal(replayed.history[0].nutritionCalories, 370);
  assert.equal(replayed.history[0].checkin?.sleepHours, 7.5);
  assert.equal(replayed.history[0].checkin?.steps, 7000);
});

test("replaying creation and removal before midnight cannot resurrect a session today", () => {
  const { yesterday, today } = days();
  const saved = createInitialState(yesterday, "personal");
  const pending: KernelAction[] = [
    stamped(
      {
        type: "focus-add",
        category: "project",
        minutes: 50,
        outcome: "Registro incorreto",
      },
      "removed-focus",
      yesterday,
    ),
    stamped(
      { type: "focus-remove", id: "removed-focus" },
      "remove-focus",
      yesterday,
    ),
    stamped(
      {
        type: "focus-add",
        category: "study",
        minutes: 25,
        outcome: "Registro atual",
      },
      "current-focus",
      today,
    ),
  ];
  const replayed = pending.reduce(kernelReducer, saved);
  const retried = pending.reduce(kernelReducer, saved);
  assert.deepEqual(
    retried,
    replayed,
    "the same pending batch keeps record identities and timestamps",
  );
  assert.equal(replayed.history[0].focusMinutes, 0);
  assert.equal(replayed.history[0].studyMinutes, 0);
  assert.equal(replayed.focusSessions.length, 1);
  assert.equal(replayed.focusSessions[0].id, "current-focus");
  assert.equal(new Set(replayed.journal.map((entry) => entry.id)).size, 3);
});

test("long-term pending records survive rollover while daily measurements are archived", () => {
  const { yesterday, today } = days();
  const saved = createInitialState(yesterday, "personal");
  const pending: KernelAction[] = [
    stamped(
      {
        type: "insight",
        courseId: "architecture",
        text: "Uma ideia de ontem.",
      },
      "old-insight",
      yesterday,
    ),
    stamped(
      {
        type: "wishlist-add",
        item: {
          name: "Tênis",
          category: "Vestuário",
          purpose: "Correr",
          price: 100,
          priority: 2,
        },
      },
      "old-purchase",
      yesterday,
    ),
    stamped({ type: "habit", id: "grooming" }, "old-habit", yesterday),
  ];
  const current = reconcileDay(pending.reduce(kernelReducer, saved), today);
  assert.equal(current.insights[0].id, "old-insight");
  assert.equal(current.insights[0].createdAt, yesterday.toISOString());
  assert.equal(current.wishlist[0].id, "old-purchase");
  assert.equal(current.habits.grooming, false);
  assert.equal(current.history[0].habitCount, 1);
});

test("an unstamped live action still rolls old saved data into the current day", () => {
  const { yesterday, today } = days();
  const saved = createInitialState(yesterday, "personal");
  saved.waterMl = 1000;
  const current = kernelReducer(saved, { type: "water", amount: 250 });
  assert.equal(current.day, localDay(today));
  assert.equal(current.waterMl, 250);
  assert.equal(current.history[0].waterMl, 1000);
});
