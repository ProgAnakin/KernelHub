import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, localDay } from "../lib/mock-engine.ts";
import {
  kernelReducer,
  MAX_BACKUP_BYTES,
  parseStoredState,
} from "../lib/state.ts";
import { summarizeDay } from "../lib/metrics.ts";
import type { KernelState } from "../types/kernel.ts";

const personal = () => createInitialState(new Date(), "personal");
const timestamp = () => new Date().toISOString();
const encode = (value: unknown) => JSON.stringify(value);

test("central backup parser rejects oversized ASCII and multibyte payloads", () => {
  const state = personal();
  const ascii = encode({ ...state, padding: "x".repeat(MAX_BACKUP_BYTES) });
  const unicode = encode({
    ...state,
    padding: "é".repeat(MAX_BACKUP_BYTES / 2 + 1),
  });
  assert.ok(ascii.length > MAX_BACKUP_BYTES);
  assert.ok(unicode.length < MAX_BACKUP_BYTES);
  assert.ok(Buffer.byteLength(unicode) > MAX_BACKUP_BYTES);
  assert.equal(parseStoredState(ascii), null);
  assert.equal(parseStoredState(unicode), null);
  assert.deepEqual(parseStoredState(encode(state)), state);
});

test("truncated, deeply malformed and non-object JSON fails without throwing", () => {
  const payloads = [
    "",
    "undefined",
    "null",
    "true",
    "1e999",
    '"kernelhub"',
    "[]",
    "[".repeat(20_000) + "x",
    "[".repeat(10_000) + "0" + "]".repeat(10_000),
    '{"version":1,"habits":',
  ];
  for (const payload of payloads) {
    assert.equal(parseStoredState(payload), null);
  }
});

test("prototype-shaped JSON cannot alter object prototypes or add exercise keys", () => {
  const state = personal();
  const poison = encode(state).replace(
    '{"version":',
    '{"__proto__":{"kernelhubPolluted":true},"constructor":{"prototype":{"kernelhubPolluted":true}},"version":',
  );
  const parsed = parseStoredState(poison);
  assert.ok(parsed);
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal(Object.hasOwn(parsed, "__proto__"), false);
  assert.equal(Object.hasOwn(parsed, "constructor"), false);
  assert.equal(Object.hasOwn(Object.prototype, "kernelhubPolluted"), false);
  for (const key of ["__proto__", "constructor", "prototype", "unknown"]) {
    const payload = encode(state).replace(
      '"exercises":{',
      `"exercises":{${encode(key)}:0,`,
    );
    assert.equal(parseStoredState(payload), null, key);
  }
});

test("duplicate identifiers cannot turn a single removal into multiple deletions", () => {
  const state = personal();
  const session = {
    id: "same",
    minutes: 25,
    category: "study" as const,
    outcome: "Revisão",
    createdAt: timestamp(),
  };
  const meal = {
    id: "same",
    name: "Lanche",
    macros: { protein: 1, carbs: 1, fat: 1 },
    createdAt: timestamp(),
  };
  const insight = {
    id: "same",
    courseId: "architecture",
    text: "Aprendizado",
    createdAt: timestamp(),
  };
  const journal = {
    id: "same",
    title: "Registro",
    detail: "Teste",
    kind: "learn" as const,
    createdAt: timestamp(),
  };
  for (const changes of [
    { focusSessions: [session, { ...session, minutes: 50 }] },
    {
      nutrition: { protein: 2, carbs: 2, fat: 2 },
      meals: [meal, { ...meal }],
    },
    { insights: [insight, { ...insight }] },
    { journal: [journal, { ...journal }] },
  ]) {
    assert.equal(parseStoredState(encode({ ...state, ...changes })), null);
  }
});

test("backup validation enforces daily totals and historical chronology", () => {
  const state = personal();
  const sessions = [480, 480, 480].map((minutes, index) => ({
    id: `session-${index}`,
    minutes,
    category: "project" as const,
    outcome: "",
    createdAt: timestamp(),
  }));
  assert.ok(parseStoredState(encode({ ...state, focusSessions: sessions })));
  assert.equal(
    parseStoredState(
      encode({
        ...state,
        focusSessions: [
          ...sessions,
          { ...sessions[0], id: "extra", minutes: 1 },
        ],
      }),
    ),
    null,
  );
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = {
    ...summarizeDay(state),
    day: localDay(yesterday),
    focusMinutes: 25,
    studyMinutes: 26,
  };
  assert.equal(parseStoredState(encode({ ...state, history: [day] })), null);
  assert.equal(
    parseStoredState(
      encode({
        ...state,
        history: [{ ...day, studyMinutes: 25, day: state.day }],
      }),
    ),
    null,
  );
  assert.equal(
    parseStoredState(
      encode({
        ...state,
        history: [
          { ...day, studyMinutes: 25 },
          { ...day, studyMinutes: 25 },
        ],
      }),
    ),
    null,
  );
});

test("meal totals cannot exceed imported nutrition and removal keeps the remainder", () => {
  let state = personal();
  state = kernelReducer(state, {
    type: "meal",
    name: "Almoço",
    macros: { protein: 30, carbs: 40, fat: 10 },
  });
  const mealId = state.meals[0].id;
  state = kernelReducer(state, {
    type: "meal",
    name: "Lanche",
    macros: { protein: 20, carbs: 10, fat: 5 },
  });
  assert.equal(
    parseStoredState(
      encode({ ...state, nutrition: { ...state.nutrition, protein: 49 } }),
    ),
    null,
  );
  state = kernelReducer(state, { type: "meal-remove", id: mealId });
  assert.deepEqual(state.nutrition, { protein: 20, carbs: 10, fat: 5 });
  assert.deepEqual(parseStoredState(encode(state)), state);
  assert.equal(
    kernelReducer(state, { type: "meal-remove", id: mealId }),
    state,
  );
});

test("invalid restoration preserves the live object and its records", () => {
  let state = personal();
  state = kernelReducer(state, { type: "water", amount: 250 });
  const before = encode(state);
  for (const invalid of [
    { ...state, version: 99 },
    { ...state, waterMl: -1 },
    { ...state, exercises: { ...state.exercises, extra: 1 } },
    { ...state, acquired: ["unowned-item"] },
    { ...state, checkin: { energy: 99 } },
    null,
  ]) {
    const restored = kernelReducer(state, {
      type: "restore",
      state: invalid as KernelState,
    });
    assert.equal(restored, state);
    assert.equal(encode(state), before);
  }
});

test("bounded deterministic malformed backups fail closed without mutating fixtures", () => {
  let seed = 0x4b485542;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const state = personal();
  const before = encode(state);
  const fields = [
    "version",
    "day",
    "mode",
    "waterMl",
    "habits",
    "exercises",
    "nutrition",
    "courseProgress",
    "acquired",
    "wishlist",
    "insights",
    "journal",
    "history",
    "focusSessions",
    "meals",
    "targets",
  ];
  const wrongValues = [
    null,
    false,
    true,
    -1,
    "invalid",
    ["invalid"],
    { bad: true },
  ];
  for (let index = 0; index < 256; index++) {
    const field = fields[random() % fields.length];
    const wrong = wrongValues[random() % wrongValues.length];
    const candidate = { ...state, [field]: wrong };
    assert.equal(
      parseStoredState(encode(candidate)),
      null,
      `${index}: ${field}`,
    );
    assert.equal(encode(state), before);
  }
});

test("repeated registrations respect physical, collection and persistence bounds", () => {
  let state = personal();
  for (let index = 0; index < 1_100; index++) {
    state = kernelReducer(state, { type: "water", amount: 250 });
    state = kernelReducer(state, { type: "run", delta: 1 });
    state = kernelReducer(state, { type: "exercise", id: "row", delta: 1 });
    state = kernelReducer(state, {
      type: "lesson",
      id: "architecture",
      delta: 1,
    });
  }
  assert.equal(state.waterMl, 10_000);
  assert.equal(state.runKm, 100);
  assert.equal(state.exercises.row, 3);
  assert.equal(state.courseProgress.architecture, 12);
  for (let index = 0; index < 600; index++) {
    state = kernelReducer(state, {
      type: "insight",
      courseId: "architecture",
      text: `Insight ${index} ` + "x".repeat(1_100),
    });
  }
  assert.equal(state.insights.length, 500);
  assert.equal(state.journal.length, 200);
  assert.ok(state.insights.every((insight) => insight.text.length <= 1_000));
  assert.equal(new Set(state.insights.map((item) => item.id)).size, 500);
  assert.ok(state.insights[0].text.startsWith("Insight 599 "));
  assert.ok(
    !state.insights.some((insight) => insight.text.startsWith("Insight 0 ")),
  );
  assert.ok(Buffer.byteLength(encode(state)) < MAX_BACKUP_BYTES);
  assert.deepEqual(parseStoredState(encode(state)), state);
});

test("repeated valid submissions cannot overflow focus, meals or purchases", () => {
  let state = personal();
  for (let index = 0; index < 110; index++) {
    state = kernelReducer(state, {
      type: "focus-add",
      minutes: 1,
      category: "study",
      outcome: "Estudo",
    });
    state = kernelReducer(state, {
      type: "meal",
      name: "Lanche",
      macros: { protein: 1, carbs: 1, fat: 1 },
    });
    state = kernelReducer(state, {
      type: "wishlist-add",
      item: {
        name: `Item ${index}`,
        purpose: "Uso pessoal",
        category: "Equipamento",
        price: 10,
        priority: 2,
      },
    });
  }
  assert.equal(state.focusSessions.length, 50);
  assert.equal(summarizeDay(state).focusMinutes, 50);
  assert.equal(state.meals.length, 100);
  assert.deepEqual(state.nutrition, { protein: 100, carbs: 100, fat: 100 });
  assert.equal(state.wishlist.length, 100);
  for (const item of state.wishlist) {
    state = kernelReducer(state, { type: "acquire", id: item.id });
  }
  assert.equal(state.acquired.length, 100);
  assert.equal(new Set(state.acquired).size, 100);
  assert.equal(state.journal.length, 200);
  assert.deepEqual(parseStoredState(encode(state)), state);
  let fullDay = personal();
  for (let index = 0; index < 10; index++) {
    fullDay = kernelReducer(fullDay, {
      type: "focus-add",
      minutes: 480,
      category: "project",
      outcome: "Projeto",
    });
  }
  assert.equal(summarizeDay(fullDay).focusMinutes, 1_440);
  assert.equal(fullDay.focusSessions.length, 3);
  assert.deepEqual(parseStoredState(encode(fullDay)), fullDay);
});
