import { z } from "zod";

export const MAX_HEALTH_XML_BYTES = 12 * 1024 * 1024;
export const MAX_HEALTH_RECORDS = 150000;
const HISTORY_DAYS = 14;
const MAX_SOURCES = 64;
const MAX_TAGS = 600000;
const MAX_DEPTH = 64;

export const HEALTH_METRICS = [
  { id: "sleepHours", label: "Sono", unit: "h" },
  { id: "restingHeartRate", label: "FC em repouso", unit: "bpm" },
  { id: "heartRate", label: "Frequência cardíaca", unit: "bpm" },
  { id: "hrvMs", label: "VFC · SDNN", unit: "ms" },
  { id: "steps", label: "Passos", unit: "passos" },
  { id: "activeCalories", label: "Energia ativa", unit: "kcal" },
  { id: "weightKg", label: "Peso", unit: "kg" },
  { id: "walkingRunningKm", label: "Distância", unit: "km" },
] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number]["id"];
export interface HealthReading {
  value: number | null;
  unit: string;
  source: string | null;
  recordedAt: string | null;
  day: string | null;
  samples: number;
  aggregation: "latest" | "sum" | "mean" | "duration";
}
export type HealthMetrics = Record<HealthMetric, HealthReading>;
export interface HealthDay {
  day: string;
  metrics: HealthMetrics;
}
export interface HealthSnapshot {
  version: 1;
  importedAt: string;
  fileName: string | null;
  latestDay: string;
  metrics: HealthMetrics;
  history: HealthDay[];
  sources: string[];
  coverage: {
    records: number;
    acceptedRecords: number;
    ignoredRecords: number;
    days: number;
    oldestDay: string;
    latestDay: string;
    sourceStrategy: "one-source-per-metric-per-day";
  };
}

const AGGREGATION: Record<HealthMetric, HealthReading["aggregation"]> = {
  heartRate: "latest",
  restingHeartRate: "latest",
  hrvMs: "mean",
  sleepHours: "duration",
  steps: "sum",
  activeCalories: "sum",
  weightKg: "latest",
  walkingRunningKm: "sum",
};
const BOUNDS: Record<HealthMetric, [number, number]> = {
  heartRate: [20, 250],
  restingHeartRate: [20, 180],
  hrvMs: [0.1, 500],
  sleepHours: [0, 24],
  steps: [0, 200000],
  activeCalories: [0, 30000],
  weightKg: [20, 500],
  walkingRunningKm: [0, 500],
};
const TYPES: Record<string, HealthMetric> = {
  HKQuantityTypeIdentifierHeartRate: "heartRate",
  HKQuantityTypeIdentifierRestingHeartRate: "restingHeartRate",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrvMs",
  HKCategoryTypeIdentifierSleepAnalysis: "sleepHours",
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierActiveEnergyBurned: "activeCalories",
  HKQuantityTypeIdentifierBodyMass: "weightKg",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "walkingRunningKm",
};
const ASLEEP_VALUES = new Set([
  "1",
  "3",
  "4",
  "5",
  "HKCategoryValueSleepAnalysisAsleep",
  "HKCategoryValueSleepAnalysisAsleepUnspecified",
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
]);
const ATTRIBUTES = new Set([
  "type",
  "sourceName",
  "unit",
  "value",
  "startDate",
  "endDate",
]);
const sourceSchema = z.string().trim().min(1).max(160);
const readingSchema = z.object({
  value: z.number().finite().nullable(),
  unit: z.string().max(12),
  source: sourceSchema.nullable(),
  recordedAt: z.iso.datetime().nullable(),
  day: z.iso.date().nullable(),
  samples: z.number().int().min(0).max(MAX_HEALTH_RECORDS),
  aggregation: z.enum(["latest", "sum", "mean", "duration"]),
});
const metricsSchema = z.object(
  Object.fromEntries(
    HEALTH_METRICS.map((metric) => [metric.id, readingSchema]),
  ) as Record<HealthMetric, typeof readingSchema>,
);
const snapshotSchema = z.object({
  version: z.literal(1),
  importedAt: z.iso.datetime(),
  fileName: z.string().max(160).nullable(),
  latestDay: z.iso.date(),
  metrics: metricsSchema,
  history: z
    .array(z.object({ day: z.iso.date(), metrics: metricsSchema }))
    .min(1)
    .max(HISTORY_DAYS),
  sources: z.array(sourceSchema).max(MAX_SOURCES),
  coverage: z.object({
    records: z.number().int().min(1).max(MAX_HEALTH_RECORDS),
    acceptedRecords: z.number().int().min(1).max(MAX_HEALTH_RECORDS),
    ignoredRecords: z.number().int().min(0).max(MAX_HEALTH_RECORDS),
    days: z.number().int().min(1).max(HISTORY_DAYS),
    oldestDay: z.iso.date(),
    latestDay: z.iso.date(),
    sourceStrategy: z.literal("one-source-per-metric-per-day"),
  }),
});

export function emptyHealthMetrics(): HealthMetrics {
  return Object.fromEntries(
    HEALTH_METRICS.map(({ id, unit }) => [
      id,
      {
        value: null,
        unit,
        source: null,
        recordedAt: null,
        day: null,
        samples: 0,
        aggregation: AGGREGATION[id],
      },
    ]),
  ) as HealthMetrics;
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayBefore(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date - days, 12));
}
function invalid(
  message = "O arquivo XML do Apple Saúde está incompleto ou inválido.",
): never {
  throw new Error(message);
}

/** Only explicitly supported entities are decoded; no DTD or external resolution. */
function decodeAttribute(value: string): string {
  if (value.includes("<")) invalid();
  return value.replace(/&([^;\s]{1,32});/g, (_, entity: string) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    if (Object.hasOwn(named, entity)) return named[entity];
    const numeric = /^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity)
      ? entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10)
      : NaN;
    if (
      !Number.isInteger(numeric) ||
      (numeric < 32 && ![9, 10, 13].includes(numeric)) ||
      numeric > 0x10ffff ||
      (numeric >= 0xd800 && numeric <= 0xdfff)
    )
      invalid("O XML contém uma entidade não suportada.");
    return String.fromCodePoint(numeric);
  });
}

function attributes(input: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  const seen = new Set<string>();
  const matcher =
    /\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;
  let cursor = 0;
  while (cursor < input.length) {
    if (!input.slice(cursor).trim()) break;
    matcher.lastIndex = cursor;
    const match = matcher.exec(input);
    if (!match || seen.has(match[1]) || seen.size >= 64) invalid();
    const value = match[2] ?? match[3];
    if (
      value.length > 32768 ||
      value.includes("<") ||
      /&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9a-f]+;)/i.test(value)
    )
      invalid();
    seen.add(match[1]);
    if (ATTRIBUTES.has(match[1])) {
      if (value.length > 1024)
        invalid("Um campo do XML excede o limite permitido.");
      result[match[1]] = decodeAttribute(value);
    }
    cursor = matcher.lastIndex;
  }
  return result;
}

/** Apple exports have a space-separated date and explicit numeric UTC offset. */
export function parseHealthDate(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s*(Z|[+-]\d{2}:?\d{2})$/.exec(
      value,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  if (
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return null;
  const zone =
    match[8] === "Z" ? "Z" : match[8].replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (
    zone !== "Z" &&
    (Number(zone.slice(1, 3)) > 14 ||
      Number(zone.slice(4)) > 59 ||
      (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4)) !== 0))
  )
    return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7] ? `.${match[7]}` : ""}${zone}`;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

interface Sample {
  start: number;
  end: number;
  value: number;
  source: string;
  count?: number;
}
type DaySamples = Map<HealthMetric, Map<string, Sample[]>>;

function convertedValue(
  metric: HealthMetric,
  value: string,
  unit: string,
): number | null {
  if (!/^\+?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(value))
    return null;
  let number = Number(value);
  if (metric === "heartRate" || metric === "restingHeartRate") {
    if (!["count/min", "bpm"].includes(unit)) return null;
  } else if (metric === "hrvMs") {
    if (unit === "s") number *= 1000;
    else if (unit !== "ms") return null;
  } else if (metric === "weightKg") {
    if (unit === "g") number /= 1000;
    else if (["lb", "lbs"].includes(unit)) number *= 0.45359237;
    else if (unit !== "kg") return null;
  } else if (metric === "walkingRunningKm") {
    if (unit === "m") number /= 1000;
    else if (unit === "mi") number *= 1.609344;
    else if (unit !== "km") return null;
  } else if (metric === "activeCalories") {
    if (unit === "kJ") number /= 4.184;
    else if (unit !== "kcal") return null;
  } else if (metric === "steps") {
    if (unit !== "count" || !Number.isInteger(number)) return null;
  }
  const [min, max] = BOUNDS[metric];
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function intervals(samples: Sample[]): [number, number][] {
  const sorted = samples
    .filter((sample) => sample.end > sample.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const union: [number, number][] = [];
  for (const sample of sorted) {
    const previous = union.at(-1);
    if (previous && sample.start <= previous[1])
      previous[1] = Math.max(previous[1], sample.end);
    else union.push([sample.start, sample.end]);
  }
  return union;
}
function covered(samples: Sample[]): number {
  return intervals(samples).reduce(
    (sum, interval) => sum + interval[1] - interval[0],
    0,
  );
}
function selectedSource(
  metric: HealthMetric,
  sources: Map<string, Sample[]>,
): [string, Sample[]] | null {
  const ranked = [...sources].map(([source, samples]) => ({
    source,
    samples,
    coverage:
      metric === "sleepHours"
        ? samples.reduce((sum, sample) => sum + sample.value * 3600000, 0)
        : covered(samples),
    latest: samples.reduce((latest, sample) => Math.max(latest, sample.end), 0),
  }));
  ranked.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.latest - a.latest ||
      b.samples.length - a.samples.length ||
      a.source.localeCompare(b.source),
  );
  return ranked[0] ? [ranked[0].source, ranked[0].samples] : null;
}

function reading(
  metric: HealthMetric,
  source: string,
  samples: Sample[],
  day: string,
): HealthReading | null {
  if (!samples.length) return null;
  // Identical imported records from the same device count once.
  const unique = [
    ...new Map(
      samples.map((sample) => [
        `${sample.start}:${sample.end}:${sample.value}`,
        sample,
      ]),
    ).values(),
  ];
  let value: number;
  const aggregation = AGGREGATION[metric];
  if (aggregation === "latest")
    value = unique.reduce((latest, sample) =>
      sample.end >= latest.end ? sample : latest,
    ).value;
  else if (aggregation === "mean")
    value =
      unique.reduce((sum, sample) => sum + sample.value, 0) / unique.length;
  else value = unique.reduce((sum, sample) => sum + sample.value, 0);
  const [min, max] = BOUNDS[metric];
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return {
    value:
      Math.round(value * (metric === "steps" ? 1 : 100)) /
      (metric === "steps" ? 1 : 100),
    unit: HEALTH_METRICS.find((item) => item.id === metric)!.unit,
    source,
    day,
    recordedAt: new Date(
      unique.reduce((latest, sample) => Math.max(latest, sample.end), 0),
    ).toISOString(),
    samples: unique.reduce((sum, sample) => sum + (sample.count ?? 1), 0),
    aggregation,
  };
}

/**
 * Imports a bounded Apple Health XML export locally. Nothing is fetched or sent.
 * Unsupported metrics remain null. Per-day sums choose ONE source by interval
 * coverage, then recency; this is not Apple's proprietary source arbitration.
 */
export function parseHealthExport(
  xml: string,
  now = new Date(),
): HealthSnapshot {
  if (
    typeof xml !== "string" ||
    xml.length > MAX_HEALTH_XML_BYTES ||
    new TextEncoder().encode(xml).byteLength > MAX_HEALTH_XML_BYTES
  )
    invalid("Use um export.xml de até 12 MB.");
  if (!Number.isFinite(now.getTime()))
    invalid("A data de importação é inválida.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) invalid();
  if (/<!ENTITY\b|\b(?:SYSTEM|PUBLIC)\s+["']/i.test(xml))
    invalid("Declarações e entidades externas não são aceitas.");
  const buckets = new Map<string, DaySamples>();
  const knownSources = new Set<string>();
  const stack: string[] = [];
  let latestDay = "";
  let earliestDay = "";
  let records = 0;
  let tags = 0;
  let rootSeen = false;
  let rootClosed = false;
  let doctypeSeen = false;
  let cursor = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
  const add = (day: string, metric: HealthMetric, sample: Sample) => {
    if (day > latestDay) {
      latestDay = day;
      // Keep one boundary day so sleep stages across midnight form one episode.
      earliestDay = dayBefore(latestDay, HISTORY_DAYS);
      for (const key of buckets.keys())
        if (key < earliestDay) buckets.delete(key);
    }
    if (day < earliestDay) return;
    if (!knownSources.has(sample.source) && knownSources.size >= MAX_SOURCES)
      invalid("O arquivo contém fontes demais para esta importação.");
    knownSources.add(sample.source);
    if (!buckets.has(day)) buckets.set(day, new Map());
    const daySamples = buckets.get(day)!;
    if (!daySamples.has(metric)) daySamples.set(metric, new Map());
    const metricSamples = daySamples.get(metric)!;
    if (!metricSamples.has(sample.source)) metricSamples.set(sample.source, []);
    metricSamples.get(sample.source)!.push(sample);
  };
  while (cursor < xml.length) {
    const open = xml.indexOf("<", cursor);
    const text = xml.slice(cursor, open < 0 ? xml.length : open);
    if (
      (!stack.length && text.trim()) ||
      /&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9a-f]+;)/i.test(text)
    )
      invalid();
    if (open < 0) {
      cursor = xml.length;
      break;
    }
    if (++tags > MAX_TAGS) invalid("O XML contém elementos demais.");
    if (xml.startsWith("<!--", open)) {
      const close = xml.indexOf("-->", open + 4);
      if (close < 0) invalid();
      cursor = close + 3;
      continue;
    }
    if (xml.startsWith("<?", open)) {
      const close = xml.indexOf("?>", open + 2);
      if (close < 0 || rootSeen || !/^<\?xml\s/.test(xml.slice(open, close)))
        invalid();
      cursor = close + 2;
      continue;
    }
    if (/^<!DOCTYPE\b/i.test(xml.slice(open, open + 10))) {
      if (rootSeen || doctypeSeen) invalid();
      let end = open + 9,
        brackets = 0,
        quote = "";
      for (; end < xml.length; end++) {
        const char = xml[end];
        if (quote) {
          if (char === quote) quote = "";
          continue;
        }
        if (char === '"' || char === "'") quote = char;
        else if (char === "[") brackets++;
        else if (char === "]") brackets--;
        else if (char === ">" && brackets === 0) break;
        if (brackets < 0) invalid();
      }
      const declaration = xml.slice(open + 9, end).trim();
      if (
        end === xml.length ||
        !/^HealthData(?:\s*\[[\s\S]*\])?$/.test(declaration)
      )
        invalid();
      doctypeSeen = true;
      cursor = end + 1;
      continue;
    }
    if (xml.startsWith("<![CDATA[", open)) {
      const close = xml.indexOf("]]>", open + 9);
      if (!stack.length || close < 0) invalid();
      cursor = close + 3;
      continue;
    }
    if (xml.startsWith("<!", open)) invalid();
    let end = open + 1,
      quote = "";
    for (; end < xml.length; end++) {
      const char = xml[end];
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
      else if (char === "<") invalid();
    }
    if (end === xml.length || quote) invalid();
    const body = xml.slice(open + 1, end);
    cursor = end + 1;
    if (body.startsWith("/")) {
      const match = /^\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*$/.exec(body);
      if (!match || stack.pop() !== match[1]) invalid();
      if (!stack.length) rootClosed = true;
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*?)(\/\s*)?$/.exec(body);
    if (!match || rootClosed) invalid();
    const name = match[1];
    const attrs = attributes(match[2]);
    if (!rootSeen) {
      if (name !== "HealthData" || match[3])
        invalid("Selecione o arquivo export.xml do Apple Saúde.");
      rootSeen = true;
    } else if (!stack.length || name === "HealthData") invalid();
    if (name === "Record") {
      if (++records > MAX_HEALTH_RECORDS)
        invalid("O XML excede o limite de 150 mil registros.");
      const metric = Object.hasOwn(TYPES, attrs.type)
        ? TYPES[attrs.type]
        : undefined;
      const source = attrs.sourceName?.trim().slice(0, 160);
      const start = parseHealthDate(attrs.startDate ?? "");
      const finish = parseHealthDate(attrs.endDate ?? "");
      if (
        metric &&
        source &&
        start &&
        finish &&
        finish >= start &&
        finish.getTime() <= now.getTime() + 300000 &&
        start.getTime() <= now.getTime()
      ) {
        const startMs = start.getTime(),
          endMs = finish.getTime();
        if (metric === "sleepHours") {
          if (
            ASLEEP_VALUES.has(attrs.value) &&
            endMs > startMs &&
            endMs - startMs <= 36 * 3600000
          )
            add(localDay(finish), metric, {
              start: startMs,
              end: endMs,
              value: (endMs - startMs) / 3600000,
              source,
            });
        } else {
          const value = convertedValue(
            metric,
            attrs.value ?? "",
            attrs.unit ?? "",
          );
          if (value !== null)
            add(localDay(finish), metric, {
              start: startMs,
              end: endMs,
              value,
              source,
            });
        }
      }
    }
    if (!match[3]) {
      if (stack.length >= MAX_DEPTH)
        invalid("O XML excede a profundidade permitida.");
      stack.push(name);
    }
  }
  if (!rootSeen || !rootClosed || stack.length || records === 0) invalid();
  if (!latestDay) invalid("Não encontramos medidas compatíveis neste arquivo.");

  // Cluster sleep stages into episodes; union duration prevents double counting.
  const sleepSources = new Map<string, Sample[]>();
  for (const daySamples of buckets.values()) {
    for (const [source, samples] of daySamples.get("sleepHours") ?? []) {
      if (!sleepSources.has(source)) sleepSources.set(source, []);
      for (const sample of samples) sleepSources.get(source)!.push(sample);
    }
    daySamples.delete("sleepHours");
  }
  for (const [source, samples] of sleepSources) {
    const ordered = samples.sort((a, b) => a.start - b.start || a.end - b.end);
    let episode: Sample[] = [],
      episodeEnd = 0;
    const finishEpisode = () => {
      if (!episode.length) return;
      const span = intervals(episode);
      const end = span.at(-1)![1];
      add(localDay(new Date(end)), "sleepHours", {
        start: span[0][0],
        end,
        value: covered(episode) / 3600000,
        source,
        count: episode.length,
      });
    };
    for (const sample of ordered) {
      if (episode.length && sample.start > episodeEnd + 90 * 60000) {
        finishEpisode();
        episode = [];
      }
      episode.push(sample);
      episodeEnd = Math.max(episode.length === 1 ? 0 : episodeEnd, sample.end);
    }
    finishEpisode();
  }
  const history: HealthDay[] = [];
  let acceptedRecords = 0;
  const usedSources = new Set<string>();
  for (const [day, daySamples] of [...buckets].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (day < dayBefore(latestDay, HISTORY_DAYS - 1)) continue;
    const metrics = emptyHealthMetrics();
    for (const [metric, sources] of daySamples) {
      const selected = selectedSource(metric, sources);
      if (!selected) continue;
      const result = reading(metric, selected[0], selected[1], day);
      if (!result) continue;
      metrics[metric] = result;
      acceptedRecords += result.samples;
      usedSources.add(selected[0]);
    }
    if (Object.values(metrics).some((metric) => metric.value !== null))
      history.push({ day, metrics });
  }
  if (!history.length || !acceptedRecords)
    invalid("Não encontramos medidas compatíveis neste arquivo.");
  const metrics = emptyHealthMetrics();
  for (const day of history) {
    for (const { id } of HEALTH_METRICS)
      if (day.metrics[id].value !== null) metrics[id] = { ...day.metrics[id] };
  }
  const newest = history.at(-1)!.day;
  return {
    version: 1,
    importedAt: now.toISOString(),
    fileName: null,
    latestDay: newest,
    metrics,
    history,
    sources: [...usedSources].sort(),
    coverage: {
      records,
      acceptedRecords,
      ignoredRecords: records - acceptedRecords,
      days: history.length,
      oldestDay: history[0].day,
      latestDay: newest,
      sourceStrategy: "one-source-per-metric-per-day",
    },
  };
}

/** Cache validation is separate from parsing an XML file; malformed data is never displayed. */
export function parseCachedHealthSnapshot(
  raw: string | null,
): HealthSnapshot | null {
  if (!raw || raw.length > 256 * 1024) return null;
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const snapshot = result.data as HealthSnapshot;
    if (
      new Set(snapshot.sources).size !== snapshot.sources.length ||
      snapshot.coverage.acceptedRecords + snapshot.coverage.ignoredRecords !==
        snapshot.coverage.records ||
      snapshot.coverage.days !== snapshot.history.length ||
      snapshot.latestDay !== snapshot.coverage.latestDay ||
      snapshot.coverage.oldestDay !== snapshot.history[0].day ||
      snapshot.history[0].day <
        dayBefore(snapshot.latestDay, HISTORY_DAYS - 1) ||
      snapshot.latestDay !== snapshot.history.at(-1)!.day ||
      new Set(snapshot.history.map((day) => day.day)).size !==
        snapshot.history.length
    )
      return null;
    const all = [
      snapshot.metrics,
      ...snapshot.history.map((day) => day.metrics),
    ];
    for (const metrics of all) {
      for (const descriptor of HEALTH_METRICS) {
        const metric = metrics[descriptor.id];
        if (
          metric.unit !== descriptor.unit ||
          metric.aggregation !== AGGREGATION[descriptor.id]
        )
          return null;
        if (metric.value === null) {
          if (
            metric.source !== null ||
            metric.recordedAt !== null ||
            metric.day !== null ||
            metric.samples !== 0
          )
            return null;
        } else {
          const [min, max] = BOUNDS[descriptor.id];
          if (
            metric.value < min ||
            metric.value > max ||
            (descriptor.id === "steps" && !Number.isInteger(metric.value)) ||
            !metric.source ||
            !metric.recordedAt ||
            !metric.day ||
            metric.samples < 1 ||
            !snapshot.sources.includes(metric.source)
          )
            return null;
        }
      }
    }
    if (
      !snapshot.history.every(
        (day, index) =>
          (index === 0 || day.day > snapshot.history[index - 1].day) &&
          Object.values(day.metrics).some((metric) => metric.value !== null) &&
          Object.values(day.metrics).every(
            (metric) => metric.value === null || metric.day === day.day,
          ),
      )
    )
      return null;
    const recomputed = emptyHealthMetrics();
    const usedSources = new Set<string>();
    let selectedRecords = 0;
    for (const day of snapshot.history) {
      for (const { id } of HEALTH_METRICS) {
        selectedRecords += day.metrics[id].samples;
        if (day.metrics[id].value !== null) {
          recomputed[id] = day.metrics[id];
          usedSources.add(day.metrics[id].source!);
        }
      }
    }
    if (
      selectedRecords !== snapshot.coverage.acceptedRecords ||
      usedSources.size !== snapshot.sources.length ||
      JSON.stringify(recomputed) !== JSON.stringify(snapshot.metrics)
    )
      return null;
    return snapshot;
  } catch {
    return null;
  }
}
