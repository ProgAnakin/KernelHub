import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_HEALTH_XML_BYTES,
  MAX_HEALTH_RECORDS,
  parseCachedHealthSnapshot,
  parseHealthDate,
  parseHealthExport,
} from "../lib/health.ts";

const now = new Date("2026-10-23T18:00:00Z");
const types = {
  steps: "HKQuantityTypeIdentifierStepCount",
  heartRate: "HKQuantityTypeIdentifierHeartRate",
  restingHeartRate: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
  energy: "HKQuantityTypeIdentifierActiveEnergyBurned",
  weight: "HKQuantityTypeIdentifierBodyMass",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
};
const record = (
  type: string,
  value: string | number,
  unit = "count",
  source = "Garmin",
  start = "2026-10-23T09:00:00Z",
  end = "2026-10-23T10:00:00Z",
) =>
  `<Record type="${type}" sourceName="${source}" unit="${unit}" value="${value}" startDate="${start}" endDate="${end}"/>`;
const document = (contents: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><HealthData locale="pt_BR">${contents}</HealthData>`;

test("Apple XML import populates only available metrics with provenance and units", () => {
  const snapshot = parseHealthExport(
    document(
      [
        record(types.steps, 4200),
        record(types.restingHeartRate, 54, "count/min"),
        record(types.heartRate, 67, "count/min"),
        record("HKQuantityTypeIdentifierOxygenSaturation", ".98", "%"),
      ].join(""),
    ),
    now,
  );
  assert.equal(snapshot.metrics.steps.value, 4200);
  assert.equal(snapshot.metrics.steps.source, "Garmin");
  assert.equal(snapshot.metrics.steps.recordedAt, "2026-10-23T10:00:00.000Z");
  assert.equal(snapshot.metrics.steps.unit, "passos");
  assert.equal(snapshot.metrics.restingHeartRate.value, 54);
  assert.equal(snapshot.metrics.sleepHours.value, null);
  assert.equal(snapshot.metrics.weightKg.source, null);
  assert.equal(snapshot.coverage.records, 4);
  assert.equal(snapshot.coverage.acceptedRecords, 3);
  assert.equal(snapshot.coverage.ignoredRecords, 1);
  assert.equal(
    snapshot.coverage.sourceStrategy,
    "one-source-per-metric-per-day",
  );
  assert.deepEqual(
    parseCachedHealthSnapshot(JSON.stringify(snapshot)),
    snapshot,
  );
});

test("the inert internal Apple DTD is accepted while external entities are not", () => {
  const dtd =
    "<!DOCTYPE HealthData [<!ELEMENT HealthData (Record*)><!ELEMENT Record EMPTY><!ATTLIST Record type CDATA #REQUIRED>]>";
  const supported = record(types.steps, 1000, "count", "Relógio &amp; Saúde");
  const snapshot = parseHealthExport(
    `<?xml version="1.0"?>${dtd}<HealthData>${supported}</HealthData>`,
    now,
  );
  assert.equal(snapshot.metrics.steps.source, "Relógio & Saúde");
  for (const attack of [
    '<!DOCTYPE HealthData SYSTEM "https://evil.invalid/remote.dtd">',
    '<!DOCTYPE HealthData PUBLIC "evil" "https://evil.invalid/x">',
    '<!DOCTYPE HealthData [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
    '<!DOCTYPE HealthData [<!ENTITY a "aaaaaaaa">]>',
  ])
    assert.throws(
      () =>
        parseHealthExport(
          `${attack}<HealthData>${supported}</HealthData>`,
          now,
        ),
      /externas/,
    );
  assert.throws(() =>
    parseHealthExport(
      document(record(types.steps, 100, "count", "&unknown;")),
      now,
    ),
  );
});

test("sleep stages and overlapping asleep summaries count once across midnight", () => {
  const xml = document(
    [
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisInBed",
        "",
        "Watch",
        "2026-10-22T21:30:00Z",
        "2026-10-23T07:00:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAsleepCore",
        "",
        "Watch",
        "2026-10-22T22:00:00Z",
        "2026-10-22T23:30:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAsleepDeep",
        "",
        "Watch",
        "2026-10-22T23:30:00Z",
        "2026-10-23T03:00:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAsleepREM",
        "",
        "Watch",
        "2026-10-23T03:00:00Z",
        "2026-10-23T06:00:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAsleep",
        "",
        "Watch",
        "2026-10-22T22:00:00Z",
        "2026-10-23T06:00:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAwake",
        "",
        "Watch",
        "2026-10-23T06:00:00Z",
        "2026-10-23T07:00:00Z",
      ),
      record(
        types.sleep,
        "HKCategoryValueSleepAnalysisAsleep",
        "",
        "Other tracker",
        "2026-10-22T22:00:00Z",
        "2026-10-23T05:00:00Z",
      ),
    ].join(""),
  );
  const snapshot = parseHealthExport(xml, now);
  assert.equal(snapshot.metrics.sleepHours.value, 8);
  assert.equal(snapshot.metrics.sleepHours.source, "Watch");
  assert.equal(snapshot.metrics.sleepHours.day, "2026-10-23");
  assert.equal(
    snapshot.metrics.sleepHours.recordedAt,
    "2026-10-23T06:00:00.000Z",
  );
  assert.equal(
    snapshot.history.filter((day) => day.metrics.sleepHours.value !== null)
      .length,
    1,
  );
});

test("steps choose one source and exact duplicates do not inflate a daily sum", () => {
  const watch = record(
    types.steps,
    5000,
    "count",
    "Watch",
    "2026-10-23T08:00:00Z",
    "2026-10-23T10:00:00Z",
  );
  const snapshot = parseHealthExport(
    document(watch + watch + record(types.steps, 3000, "count", "Phone")),
    now,
  );
  assert.equal(snapshot.metrics.steps.value, 5000);
  assert.equal(snapshot.metrics.steps.source, "Watch");
  assert.equal(snapshot.metrics.steps.samples, 1);
  assert.equal(snapshot.coverage.acceptedRecords, 1);
  assert.equal(snapshot.coverage.ignoredRecords, 2);
});

test("supported units normalize without inventing provider metrics", () => {
  const snapshot = parseHealthExport(
    document(
      [
        record(types.hrv, "4.2e-2", "s"),
        record(types.weight, 176.3698097, "lb"),
        record(types.energy, 418.4, "kJ"),
        record(types.distance, 1609.344, "m"),
      ].join(""),
    ),
    now,
  );
  assert.equal(snapshot.metrics.hrvMs.value, 42);
  assert.equal(snapshot.metrics.weightKg.value, 80);
  assert.equal(snapshot.metrics.activeCalories.value, 100);
  assert.equal(snapshot.metrics.walkingRunningKm.value, 1.61);
  assert.equal(snapshot.metrics.heartRate.value, null);
  assert.equal(Object.hasOwn(snapshot.metrics, "bodyBattery"), false);
});

test("older available metrics keep their own date while history retains gaps and fourteen days", () => {
  const records = Array.from({ length: 20 }, (_, index) => {
    const date = new Date(
      `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
    );
    return record(
      types.steps,
      1000 + index,
      "count",
      "Watch",
      date.toISOString(),
      date.toISOString(),
    );
  });
  // Out-of-order old records cannot push the window backwards.
  records.push(
    record(
      types.weight,
      76.4,
      "kg",
      "Scale",
      "2026-10-18T09:00:00Z",
      "2026-10-18T09:00:00Z",
    ),
  );
  const snapshot = parseHealthExport(document(records.reverse().join("")), now);
  assert.equal(snapshot.history.length, 14);
  assert.equal(snapshot.coverage.oldestDay, "2026-10-07");
  assert.equal(snapshot.latestDay, "2026-10-20");
  assert.equal(snapshot.metrics.weightKg.day, "2026-10-18");
  assert.equal(snapshot.metrics.steps.day, "2026-10-20");
  const gap = parseHealthExport(
    document(
      record(types.steps, 1000) +
        record(
          types.weight,
          76,
          "kg",
          "Scale",
          "2026-10-20T09:00:00Z",
          "2026-10-20T09:00:00Z",
        ),
    ),
    now,
  );
  assert.deepEqual(
    gap.history.map((day) => day.day),
    ["2026-10-20", "2026-10-23"],
  );
});

test("Apple offset dates are strict and future or implausible measurements stay absent", () => {
  assert.equal(
    parseHealthDate("2026-10-23 09:15:00 +0200")?.toISOString(),
    "2026-10-23T07:15:00.000Z",
  );
  assert.equal(
    parseHealthDate("2026-10-23T09:15:00.500-03:00")?.toISOString(),
    "2026-10-23T12:15:00.500Z",
  );
  for (const invalid of [
    "2026-02-30 12:00:00 +0000",
    "2026-10-23 25:00:00 +0000",
    "2026-10-23 10:00:00 +1460",
    "2026-10-23",
    "not-a-date",
  ])
    assert.equal(parseHealthDate(invalid), null);
  const snapshot = parseHealthExport(
    document(
      [
        record(types.steps, 1000),
        record(types.weight, 5, "kg"),
        record(types.heartRate, 1000, "count/min"),
        record(types.restingHeartRate, 70, "unknown"),
        record(
          types.hrv,
          20,
          "ms",
          "Future",
          "2027-10-23T09:00:00Z",
          "2027-10-23T09:01:00Z",
        ),
      ].join(""),
    ),
    now,
  );
  assert.equal(snapshot.metrics.weightKg.value, null);
  assert.equal(snapshot.metrics.heartRate.value, null);
  assert.equal(snapshot.metrics.restingHeartRate.value, null);
  assert.equal(snapshot.metrics.hrvMs.value, null);
});

test("malformed XML, unsafe entities, deep nesting and oversized imports fail closed", () => {
  for (const xml of [
    "",
    "not XML",
    "<HealthData/>",
    "<Other/>",
    '<HealthData><Record value="100></Record></HealthData>',
    '<HealthData><Record type="x" type="x"/></HealthData>',
    "<HealthData><Record value=100/></HealthData>",
    '<HealthData><Record device="<unsafe"/></HealthData>',
    "<HealthData>\u0000<Record/></HealthData>",
    "<HealthData><Record/></Wrong>",
    document('<Record sourceName="&bad;"/>'),
    "<HealthData>" +
      "<Unknown>".repeat(65) +
      "</Unknown>".repeat(65) +
      "</HealthData>",
  ])
    assert.throws(() => parseHealthExport(xml, now));
  assert.throws(
    () => parseHealthExport("x".repeat(MAX_HEALTH_XML_BYTES + 1), now),
    /12 MB/,
  );
  assert.throws(
    () => parseHealthExport("é".repeat(MAX_HEALTH_XML_BYTES / 2 + 1), now),
    /12 MB/,
  );
  assert.throws(
    () =>
      parseHealthExport(
        document("<Record/>".repeat(MAX_HEALTH_RECORDS + 1)),
        now,
      ),
    /150 mil/,
  );
});

test("prototype-shaped types and escaped HTML remain inert text", () => {
  const snapshot = parseHealthExport(
    document(
      [
        record("constructor", 100),
        record("__proto__", 100),
        record(types.steps, 100, "count", "&lt;img src=x onerror=alert(1)&gt;"),
      ].join(""),
    ),
    now,
  );
  assert.equal(snapshot.metrics.steps.source, "<img src=x onerror=alert(1)>");
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  assert.equal(snapshot.coverage.ignoredRecords, 2);
});

test("cached imports reject inconsistent totals, units, sources and fabricated top readings", () => {
  const snapshot = parseHealthExport(document(record(types.steps, 1000)), now);
  const raw = JSON.stringify(snapshot);
  assert.ok(parseCachedHealthSnapshot(raw));
  for (const mutate of [
    (s: typeof snapshot) => {
      s.metrics.steps.unit = "kg";
    },
    (s: typeof snapshot) => {
      s.metrics.steps.value = 9999;
    },
    (s: typeof snapshot) => {
      s.metrics.steps.source = "missing";
    },
    (s: typeof snapshot) => {
      s.metrics.sleepHours.source = "Invented";
    },
    (s: typeof snapshot) => {
      s.coverage.acceptedRecords++;
    },
    (s: typeof snapshot) => {
      s.coverage.days = 14;
    },
    (s: typeof snapshot) => {
      s.history.push(structuredClone(s.history[0]));
    },
    (s: typeof snapshot) => {
      s.sources.push("Fabricated source");
    },
    (s: typeof snapshot) => {
      s.history[0].metrics.steps.value = 1000.5;
      s.metrics.steps.value = 1000.5;
    },
  ]) {
    const candidate = structuredClone(snapshot);
    mutate(candidate);
    assert.equal(parseCachedHealthSnapshot(JSON.stringify(candidate)), null);
  }
  for (const raw of [null, "{", "null", "x".repeat(256 * 1024 + 1)])
    assert.equal(parseCachedHealthSnapshot(raw), null);
});
