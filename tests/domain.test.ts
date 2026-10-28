import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, calories } from "../lib/mock-engine.ts";
import { kernelReducer, parseStoredState, reconcileDay } from "../lib/state.ts";
import { summarizeDay, weekOf } from "../lib/metrics.ts";

test("daily rollover resets daily records and preserves long-term progress", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const state = createInitialState(yesterday);
  state.acquired = ["creatine"];
  state.insights = [
    {
      id: "note",
      courseId: "architecture",
      text: "Dependências apontam para o domínio.",
      createdAt: yesterday.toISOString(),
    },
  ];
  const next = reconcileDay(state);
  assert.equal(next.waterMl, 0);
  assert.equal(next.runKm, 0);
  assert.ok(Object.values(next.habits).every((value) => !value));
  assert.ok(Object.values(next.exercises).every((value) => value === 0));
  assert.equal(calories(next.nutrition), 0);
  assert.deepEqual(next.acquired, ["creatine"]);
  assert.deepEqual(next.courseProgress, state.courseProgress);
  assert.deepEqual(next.insights, state.insights);
  assert.deepEqual(next.wishlist, state.wishlist);
});

test("legacy backups migrate without losing records or inventing a history", () => {
  const initial = createInitialState();
  const { mode, checkin, targets, history, focusSessions, ...legacy } = initial;
  const restored = parseStoredState(JSON.stringify(legacy));
  assert.ok(restored);
  assert.equal(restored.waterMl, initial.waterMl);
  assert.equal(restored.history.length, 0);
  assert.equal(restored.targets.waterMl, 2500);
  assert.deepEqual(restored.wishlist, initial.wishlist);
});

test("daily history archives actual check-in and focus data and keeps gaps", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const state = createInitialState(yesterday, "personal");
  state.checkin = {
    energy: 4,
    mood: 3,
    stress: 2,
    sleepHours: 7.5,
    weightKg: 76.5,
    steps: 8000,
  };
  state.focusSessions = [
    {
      id: "session",
      minutes: 50,
      category: "project",
      outcome: "Fluxo concluído",
      createdAt: yesterday.toISOString(),
    },
  ];
  const rolled = reconcileDay(state);
  assert.equal(rolled.history.length, 1);
  assert.equal(rolled.history[0].focusMinutes, 50);
  assert.equal(rolled.history[0].checkin?.weightKg, 76.5);
  assert.equal(rolled.checkin, null);
  assert.equal(rolled.focusSessions.length, 0);
  assert.equal(weekOf(rolled).filter(Boolean).length, 2);
  assert.equal(weekOf(rolled)[0], null);
  assert.equal(reconcileDay(rolled), rolled);
});

test("focus totals distinguish project time and study and can be corrected", () => {
  let state = createInitialState(new Date(), "personal");
  state = kernelReducer(state, {
    type: "focus-add",
    minutes: 50,
    category: "project",
    outcome: "Feature",
  });
  state = kernelReducer(state, {
    type: "focus-add",
    minutes: 25,
    category: "study",
    outcome: "Revisão",
  });
  assert.equal(summarizeDay(state).focusMinutes, 75);
  assert.equal(summarizeDay(state).studyMinutes, 25);
  state = kernelReducer(state, {
    type: "focus-remove",
    id: state.focusSessions[0].id,
  });
  assert.equal(summarizeDay(state).focusMinutes, 25);
  assert.equal(
    kernelReducer(state, {
      type: "focus-add",
      minutes: NaN,
      category: "project",
      outcome: "",
    }),
    state,
  );
  assert.equal(
    kernelReducer(state, {
      type: "focus-add",
      minutes: 900,
      category: "project",
      outcome: "",
    }),
    state,
  );
});

test("personal mode has no fictional measurements, purchases, sessions or history", () => {
  const state = kernelReducer(createInitialState(), { type: "start-personal" });
  assert.equal(state.mode, "personal");
  assert.equal(state.checkin, null);
  assert.equal(state.waterMl, 0);
  assert.equal(state.history.length, 0);
  assert.equal(state.wishlist.length, 0);
  assert.equal(state.focusSessions.length, 0);
  assert.equal(calories(state.nutrition), 0);
});

test("inconsistent imported acquisition references and invalid measures are rejected", () => {
  const state = createInitialState();
  assert.equal(
    parseStoredState(JSON.stringify({ ...state, acquired: ["missing"] })),
    null,
  );
  assert.equal(
    parseStoredState(
      JSON.stringify({ ...state, acquired: ["creatine", "creatine"] }),
    ),
    null,
  );
  assert.equal(
    kernelReducer(state, {
      type: "checkin",
      value: {
        energy: 4,
        mood: 3,
        stress: 2,
        sleepHours: 30,
        weightKg: 70,
        steps: 5000,
      },
    }),
    state,
  );
});

test("invalid persisted data is rejected and valid data survives roundtrip", () => {
  const state = createInitialState();
  assert.deepEqual(parseStoredState(JSON.stringify(state)), state);
  for (const value of [
    null,
    "{",
    "null",
    '{"version":1}',
    JSON.stringify({ ...state, waterMl: -100 }),
    JSON.stringify({
      ...state,
      courseProgress: { architecture: 100, swiftui: 0 },
    }),
  ])
    assert.equal(parseStoredState(value), null);
});

test("exercise and course progress respect limits and invalid actions do not add history", () => {
  const state = createInitialState();
  const updated = kernelReducer(state, {
    type: "exercise",
    id: "row",
    delta: 100,
  });
  assert.equal(updated.exercises.row, 3);
  assert.equal(
    kernelReducer(updated, { type: "exercise", id: "row", delta: 1 }),
    updated,
  );
  assert.equal(
    kernelReducer(state, { type: "exercise", id: "unknown", delta: 1 }),
    state,
  );
  assert.equal(kernelReducer(state, { type: "water", amount: NaN }), state);
  assert.equal(
    kernelReducer(state, { type: "lesson", id: "architecture", delta: 100 })
      .courseProgress.architecture,
    12,
  );
  assert.equal(
    kernelReducer(state, { type: "lesson", id: "architecture", delta: -100 })
      .courseProgress.architecture,
    0,
  );
});

test("macros calculate calories correctly and invalid meals are rejected", () => {
  const state = createInitialState();
  const updated = kernelReducer(state, {
    type: "meal",
    name: "Almoço",
    macros: { protein: 30, carbs: 40, fat: 10 },
  });
  assert.equal(calories(updated.nutrition) - calories(state.nutrition), 370);
  assert.equal(
    kernelReducer(state, {
      type: "meal",
      name: "Almoço",
      macros: { protein: -1, carbs: 0, fat: 0 },
    }),
    state,
  );
});

test("decimal macros stay clean to a tenth, survive a round trip and remove exactly", () => {
  let state = createInitialState(new Date(), "personal");
  const add = (protein: number, carbs: number, fat: number) => {
    state = kernelReducer(state, {
      type: "meal",
      name: "Lanche",
      macros: { protein, carbs, fat },
    });
  };
  add(7.5, 0.1, 2.25);
  add(0.2, 0.2, 0.3);
  add(12.34, 0, 0);
  // 0.1 + 0.2 style sums must not leak floating-point noise into totals.
  assert.deepEqual(state.nutrition, { protein: 20, carbs: 0.3, fat: 2.6 });
  assert.deepEqual(
    state.meals.map((meal) => meal.macros),
    [
      { protein: 7.5, carbs: 0.1, fat: 2.3 },
      { protein: 0.2, carbs: 0.2, fat: 0.3 },
      { protein: 12.3, carbs: 0, fat: 0 },
    ],
  );
  const restored = parseStoredState(JSON.stringify(state));
  assert.ok(restored, "a decimal day must remain a valid backup");
  assert.deepEqual(restored.nutrition, state.nutrition);
  for (const meal of [...state.meals])
    state = kernelReducer(state, { type: "meal-remove", id: meal.id });
  assert.deepEqual(state.nutrition, { protein: 0, carbs: 0, fat: 0 });
  // A value that rounds to nothing is not a meal.
  const before = state;
  assert.equal(
    kernelReducer(before, {
      type: "meal",
      name: "Nada",
      macros: { protein: 0.04, carbs: 0, fat: 0 },
    }),
    before,
  );
});

test("wishlist purchase is reversible and custom items persist across days", () => {
  let state = createInitialState();
  state = kernelReducer(state, {
    type: "wishlist-add",
    item: {
      name: "Fones",
      purpose: "Correr",
      price: 199.9,
      category: "Equipamento",
      priority: 1,
    },
  });
  assert.equal(state.wishlist.length, 4);
  const id = state.wishlist[3].id;
  state = kernelReducer(state, { type: "acquire", id });
  assert.ok(state.acquired.includes(id));
  state = kernelReducer(state, { type: "acquire", id });
  assert.ok(!state.acquired.includes(id));
  assert.equal(state.journal.length, 3);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(reconcileDay(state, tomorrow).wishlist[3].name, "Fones");
});
