import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySkincareCheck,
  applySkincareSettings,
  automaticPeriod,
  boundaryKey,
  initialSkincareSettings,
  isSkincareDay,
  makeDayLog,
  nextSkincareBoundary,
  parseSkincareDay,
  parseSkincareSettings,
  productsForPeriod,
  reconcileTodayPlan,
  routineMetrics,
  skincareConsistency,
  skincareDay,
  skincareHistory,
  type Product,
  type Settings,
  type SettingsCommand,
} from "../lib/skincare.ts";

const at = new Date(2026, 9, 23, 10);
function product(
  id: string,
  periods: Product["periods"] = ["am", "pm"],
): Product {
  return {
    id,
    name: `Produto ${id}`,
    brand: "Marca de teste",
    kind: "cleanser",
    shelf: 1,
    periods,
    archived: false,
    createdAt: at.toISOString(),
  };
}
function settings(...products: Product[]): Settings {
  return products.reduce(
    (state, item) =>
      applySkincareSettings(state, { type: "product-save", product: item }),
    initialSkincareSettings(),
  );
}

test("a new cabinet starts empty and never invents products, checks or completion", () => {
  const state = initialSkincareSettings();
  assert.equal(state.transitionMinute, 960);
  assert.deepEqual(state.products, []);
  const log = makeDayLog(state, at);
  assert.deepEqual(log.entries, { am: {}, pm: {} });
  assert.deepEqual(routineMetrics(log, "am"), {
    planned: 0,
    used: 0,
    skipped: 0,
    pending: 0,
    percent: 0,
    complete: false,
  });
  assert.equal(skincareHistory([log]).length, 0);
  assert.deepEqual(skincareConsistency([log]).both, {
    plannedDays: 0,
    completedDays: 0,
    percent: 0,
  });
});

test("the local clock changes at exactly 16h and returns to AM at midnight", () => {
  assert.equal(automaticPeriod(new Date(2026, 9, 23, 15, 59, 59)), "am");
  assert.equal(automaticPeriod(new Date(2026, 9, 23, 16, 0, 0)), "pm");
  assert.equal(automaticPeriod(new Date(2026, 9, 23, 23, 59, 59)), "pm");
  assert.equal(automaticPeriod(new Date(2026, 9, 24, 0, 0, 0)), "am");
  assert.equal(nextSkincareBoundary(at).getHours(), 16);
  assert.equal(nextSkincareBoundary(new Date(2026, 9, 23, 16)).getDate(), 24);
  assert.equal(nextSkincareBoundary(new Date(2026, 9, 23, 16)).getHours(), 0);
});

test("a custom transition uses minutes and rejects invalid or contradictory midnight values", () => {
  const state = applySkincareSettings(settings(), {
    type: "transition",
    minute: 18 * 60 + 30,
  });
  assert.equal(
    automaticPeriod(new Date(2026, 9, 23, 18, 29), state.transitionMinute),
    "am",
  );
  assert.equal(
    automaticPeriod(new Date(2026, 9, 23, 18, 30), state.transitionMinute),
    "pm",
  );
  const boundary = nextSkincareBoundary(at, state.transitionMinute);
  assert.equal(boundary.getHours(), 18);
  assert.equal(boundary.getMinutes(), 30);
  for (const minute of [0, -1, 1440, 960.5, NaN, Infinity])
    assert.throws(() => automaticPeriod(at, minute));
  assert.throws(() => automaticPeriod(new Date("invalid")));
});

test("manual boundary keys remain stable within a period and expire at transition, midnight or configuration change", () => {
  const morning = boundaryKey(new Date(2026, 9, 23, 9));
  assert.equal(morning, boundaryKey(new Date(2026, 9, 23, 15, 59)));
  assert.notEqual(morning, boundaryKey(new Date(2026, 9, 23, 16)));
  assert.notEqual(
    boundaryKey(new Date(2026, 9, 23, 23, 59)),
    boundaryKey(new Date(2026, 9, 24, 0)),
  );
  assert.notEqual(morning, boundaryKey(new Date(2026, 9, 23, 9), 1080));
});

test("clock helpers respect the user's local timezone and DST calendar boundaries", () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = "Europe/Rome";
    const local = new Date("2026-10-23T14:00:00Z");
    assert.equal(automaticPeriod(local), "pm");
    const spring = new Date(2026, 2, 29, 1);
    const springBoundary = nextSkincareBoundary(spring);
    assert.equal(springBoundary.getHours(), 16);
    assert.equal((springBoundary.getTime() - spring.getTime()) / 3600000, 14);
    const missingSpringTime = nextSkincareBoundary(spring, 2 * 60 + 30);
    assert.equal(missingSpringTime.getHours(), 3);
    assert.equal(missingSpringTime.getMinutes(), 0);
    const fall = new Date(2026, 9, 25, 1);
    assert.equal(
      (nextSkincareBoundary(fall).getTime() - fall.getTime()) / 3600000,
      16,
    );
    process.env.TZ = "Pacific/Honolulu";
    assert.equal(automaticPeriod(local), "am");
    assert.equal(skincareDay(new Date("2026-10-23T02:00:00Z")), "2026-10-22");
    process.env.TZ = "Australia/Lord_Howe";
    const halfHourGap = nextSkincareBoundary(
      new Date(2026, 9, 4, 1),
      2 * 60 + 15,
    );
    assert.equal(halfHourGap.getHours(), 2);
    assert.equal(halfHourGap.getMinutes(), 30);
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("one shared product can appear in both independently ordered routines without duplication", () => {
  let state = settings(
    product("wash"),
    product("cream"),
    product("night", ["pm"]),
  );
  state = applySkincareSettings(state, {
    type: "reorder",
    period: "pm",
    productIds: ["night", "cream", "wash"],
  });
  assert.equal(state.products.length, 3);
  assert.deepEqual(
    productsForPeriod(state, "am").map((item) => item.id),
    ["wash", "cream"],
  );
  assert.deepEqual(
    productsForPeriod(state, "pm").map((item) => item.id),
    ["night", "cream", "wash"],
  );
  state = applySkincareSettings(state, {
    type: "product-save",
    product: { ...product("wash"), name: "Mesmo cadastro alterado" },
  });
  assert.equal(state.products.length, 3);
  assert.equal(
    productsForPeriod(state, "am")[0].name,
    "Mesmo cadastro alterado",
  );
  assert.equal(
    productsForPeriod(state, "pm")[2].name,
    "Mesmo cadastro alterado",
  );
});

test("AM and PM check entries are independent and each correction replaces one logical record", () => {
  let log = makeDayLog(settings(product("wash")), at);
  log = applySkincareCheck(log, "wash", "am", "used", "ignored for used", at);
  assert.equal(routineMetrics(log, "am").complete, true);
  assert.equal(routineMetrics(log, "pm").pending, 1);
  assert.deepEqual(log.entries.pm, {});
  log = applySkincareCheck(
    log,
    "wash",
    "pm",
    "skipped",
    "  Acabou o produto  ",
    at,
  );
  assert.equal(log.entries.pm.wash.reason, "Acabou o produto");
  assert.equal(log.entries.am.wash.status, "used");
  log = applySkincareCheck(log, "wash", "pm", "used", "", at);
  assert.equal(Object.keys(log.entries.pm).length, 1);
  assert.equal(log.entries.pm.wash.reason, "");
  log = applySkincareCheck(log, "wash", "am", "pending", "", at);
  assert.equal(Object.keys(log.entries.am).length, 1);
  assert.equal(log.entries.am.wash.status, "pending");
  assert.equal(log.entries.pm.wash.status, "used");
});

test("pending is distinct from explicit non-use and completion derives only from used products", () => {
  let log = makeDayLog(
    settings(product("one"), product("two"), product("three")),
    at,
  );
  log = applySkincareCheck(log, "one", "am", "used", "", at);
  log = applySkincareCheck(log, "two", "am", "skipped", "", at);
  assert.deepEqual(routineMetrics(log, "am"), {
    planned: 3,
    used: 1,
    skipped: 1,
    pending: 1,
    percent: 33,
    complete: false,
  });
  assert.deepEqual(
    skincareHistory([log], { period: "am", status: "pending" }).map(
      (row) => row.product.id,
    ),
    ["three"],
  );
  assert.equal(
    skincareHistory([log], { period: "am", status: "skipped" })[0].product.id,
    "two",
  );
  assert.deepEqual(log.entries.pm, {});
});

test("a new day has no visual checks and yesterday keeps its records and routine order", () => {
  const state = settings(product("wash"), product("cream"));
  const yesterday = applySkincareCheck(
    makeDayLog(state, at),
    "wash",
    "am",
    "used",
    "",
    at,
  );
  const reordered = applySkincareSettings(state, {
    type: "reorder",
    period: "am",
    productIds: ["cream", "wash"],
  });
  const tomorrow = new Date(2026, 9, 24, 0);
  const today = makeDayLog(reordered, tomorrow);
  assert.deepEqual(today.entries, { am: {}, pm: {} });
  assert.deepEqual(
    today.plans.am.map((item) => item.id),
    ["cream", "wash"],
  );
  assert.deepEqual(
    reconcileTodayPlan(yesterday, reordered, tomorrow),
    yesterday,
  );
  assert.equal(yesterday.entries.am.wash.status, "used");
  assert.deepEqual(
    yesterday.plans.am.map((item) => item.id),
    ["wash", "cream"],
  );
});

test("catalog changes preserve recorded names and archived evidence, without duplicating today's plan", () => {
  let state = settings(product("recorded"), product("untouched"));
  let log = applySkincareCheck(
    makeDayLog(state, at),
    "recorded",
    "am",
    "used",
    "",
    at,
  );
  state = applySkincareSettings(state, {
    type: "product-save",
    product: { ...product("recorded"), name: "Novo nome", periods: ["pm"] },
  });
  state = applySkincareSettings(state, {
    type: "product-archive",
    id: "untouched",
  });
  log = reconcileTodayPlan(log, state, at);
  assert.deepEqual(
    log.plans.am.map((item) => item.id),
    ["recorded"],
  );
  assert.equal(log.plans.am[0].name, "Produto recorded");
  assert.equal(log.entries.am.recorded.status, "used");
  assert.equal(productsForPeriod(state, "am").length, 0);
  assert.equal(log.plans.pm[0].name, "Novo nome");
  state = applySkincareSettings(state, {
    type: "product-archive",
    id: "recorded",
  });
  log = reconcileTodayPlan(log, state, at);
  assert.equal(log.plans.am.length, 1);
  assert.equal(log.plans.pm.length, 0);
  assert.deepEqual(reconcileTodayPlan(log, state, at), log);
});

test("status corrections can target a historical day without changing another date", () => {
  const state = settings(product("wash"));
  const yesterday = makeDayLog(state, new Date(2026, 9, 22));
  const today = makeDayLog(state, at);
  const corrected = applySkincareCheck(
    yesterday,
    "wash",
    "pm",
    "skipped",
    "Viagem",
    at,
  );
  assert.equal(corrected.day, "2026-10-22");
  assert.equal(corrected.entries.pm.wash.updatedAt, at.toISOString());
  assert.deepEqual(today.entries, { am: {}, pm: {} });
  assert.equal(
    skincareHistory([corrected, today], {
      day: "2026-10-22",
      productId: "wash",
      period: "pm",
      status: "skipped",
    })[0].reason,
    "Viagem",
  );
});

test("history filters include pending plans, preserve sequence and do not fabricate missing days", () => {
  const state = settings(product("wash"), product("cream", ["pm"]));
  const first = makeDayLog(state, new Date(2026, 9, 20));
  const second = applySkincareCheck(
    makeDayLog(state, at),
    "wash",
    "am",
    "used",
    "",
    at,
  );
  assert.equal(skincareHistory([first, second]).length, 6);
  assert.equal(
    skincareHistory([first, second], { from: "2026-10-21", to: "2026-10-23" })
      .length,
    3,
  );
  assert.equal(skincareHistory([first, second], { status: "used" }).length, 1);
  assert.deepEqual(
    skincareHistory([first, second], { productId: "cream" }).map(
      (row) => row.period,
    ),
    ["pm", "pm"],
  );
  assert.equal(
    skincareHistory([first, second], { day: "2026-10-22" }).length,
    0,
  );
  assert.throws(() =>
    skincareHistory([first], { from: "2026-10-23", to: "2026-10-20" }),
  );
});

test("history preserves every stored day beyond the general dashboard's summary window", () => {
  const state = settings(product("wash"));
  const logs = Array.from({ length: 400 }, (_, index) =>
    makeDayLog(state, new Date(2025, 0, 1 + index)),
  );
  const rows = skincareHistory(logs);
  assert.equal(rows.length, 800);
  assert.equal(rows.at(-1)?.day, "2025-01-01");
  assert.equal(skincareConsistency(logs).am.plannedDays, 400);
  assert.equal(rows.filter((row) => row.status !== "pending").length, 0);
});

test("consistency counts complete AM, PM and whole planned days independently", () => {
  const state = settings(product("wash"));
  let first = makeDayLog(state, new Date(2026, 9, 20));
  first = applySkincareCheck(first, "wash", "am", "used", "", at);
  first = applySkincareCheck(first, "wash", "pm", "used", "", at);
  const second = applySkincareCheck(
    makeDayLog(state, at),
    "wash",
    "am",
    "used",
    "",
    at,
  );
  const empty = makeDayLog(settings(), new Date(2026, 9, 21));
  const result = skincareConsistency([first, second, empty, first]);
  assert.deepEqual(result.am, {
    plannedDays: 2,
    completedDays: 2,
    percent: 100,
  });
  assert.deepEqual(result.pm, {
    plannedDays: 2,
    completedDays: 1,
    percent: 50,
  });
  assert.deepEqual(result.both, {
    plannedDays: 2,
    completedDays: 1,
    percent: 50,
  });
  const onlyAm = applySkincareCheck(
    makeDayLog(settings(product("wash", ["am"])), at),
    "wash",
    "am",
    "used",
    "",
    at,
  );
  assert.equal(skincareConsistency([onlyAm]).both.completedDays, 1);
  assert.equal(skincareConsistency([onlyAm]).pm.plannedDays, 0);
});

test("persisted domain objects roundtrip without silently accepting corruption or wrong references", () => {
  const state = settings(product("wash"));
  const log = makeDayLog(state, at);
  assert.deepEqual(parseSkincareSettings(JSON.stringify(state)), state);
  assert.deepEqual(parseSkincareDay(JSON.stringify(log)), log);
  assert.equal(parseSkincareSettings({ ...state, version: 2 }), null);
  assert.equal(
    parseSkincareSettings({
      ...state,
      products: [...state.products, ...state.products],
    }),
    null,
  );
  assert.equal(
    parseSkincareSettings({
      ...state,
      routines: { am: ["missing"], pm: ["wash"] },
    }),
    null,
  );
  assert.equal(
    parseSkincareSettings({
      ...state,
      routines: { am: ["wash", "wash"], pm: ["wash"] },
    }),
    null,
  );
  assert.equal(parseSkincareDay({ ...log, day: "2026-02-30" }), null);
  assert.equal(
    parseSkincareDay({
      ...log,
      plans: { ...log.plans, am: [...log.plans.am, ...log.plans.am] },
    }),
    null,
  );
  assert.equal(
    parseSkincareDay({
      ...log,
      entries: {
        ...log.entries,
        am: {
          missing: { status: "used", reason: "", updatedAt: at.toISOString() },
        },
      },
    }),
    null,
  );
  assert.equal(parseSkincareDay('{"day":'), null);
  assert.equal(parseSkincareSettings(" ".repeat(512 * 1024 + 1)), null);
  assert.equal(parseSkincareDay(" ".repeat(2 * 1024 * 1024 + 1)), null);
});

test("invalid IDs, products, status changes and unknown commands fail without mutating valid records", () => {
  const state = settings(product("wash"));
  const log = makeDayLog(state, at);
  assert.throws(() =>
    applySkincareSettings(state, {
      type: "product-save",
      product: { ...product("bad"), periods: ["am", "am"] },
    }),
  );
  assert.throws(() =>
    applySkincareSettings(state, {
      type: "product-save",
      product: product("constructor"),
    }),
  );
  assert.throws(() =>
    applySkincareSettings(state, { type: "product-archive", id: "missing" }),
  );
  assert.throws(() =>
    applySkincareSettings(state, {
      type: "nope",
      id: "wash",
    } as unknown as SettingsCommand),
  );
  assert.throws(() => applySkincareCheck(log, "missing", "am", "used", "", at));
  assert.throws(() =>
    applySkincareCheck(log, "wash", "am", "skipped", "x".repeat(501), at),
  );
  assert.throws(() =>
    applySkincareCheck(log, "wash", "pm", "used", "", new Date("bad")),
  );
  assert.deepEqual(log.entries, { am: {}, pm: {} });
  assert.equal(state.products[0].archived, false);
  assert.equal(isSkincareDay("2024-02-29"), true);
  assert.equal(isSkincareDay("2026-02-29"), false);
});
