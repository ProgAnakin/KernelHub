import { z } from "zod";

export const DEFAULT_SKINCARE_TRANSITION = 16 * 60;
export const SKINCARE_PERIODS = ["am", "pm"] as const;
export const PRODUCT_KINDS = [
  "cleanser",
  "serum",
  "moisturizer",
  "sunscreen",
  "other",
] as const;
export type Period = (typeof SKINCARE_PERIODS)[number];
export type CheckStatus = "pending" | "used" | "skipped";

const idSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/)
  .refine((id) => !["constructor", "prototype"].includes(id));
const periodSchema = z.enum(SKINCARE_PERIODS);
const statusSchema = z.enum(["pending", "used", "skipped"]);
const minuteSchema = z.number().int().min(1).max(1439);
const kindSchema = z.enum(PRODUCT_KINDS);
const shelfSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const daySchema = z.string().refine(isSkincareDay, "Data inválida.");

export const productSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    brand: z.string().trim().max(80),
    kind: kindSchema,
    shelf: shelfSchema,
    periods: z.array(periodSchema).min(1).max(2),
    archived: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    (product) => new Set(product.periods).size === product.periods.length,
    {
      message: "Selecione cada período apenas uma vez.",
    },
  );

export const productSnapshotSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    brand: z.string().trim().max(80),
    kind: kindSchema,
    shelf: shelfSchema,
  })
  .strict();

export const settingsSchema = z
  .object({
    version: z.literal(1),
    transitionMinute: minuteSchema,
    products: z.array(productSchema).max(200),
    routines: z
      .object({
        am: z.array(idSchema).max(200),
        pm: z.array(idSchema).max(200),
      })
      .strict(),
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      new Set(settings.products.map((product) => product.id)).size !==
      settings.products.length
    )
      context.addIssue({ code: "custom", message: "Há produtos duplicados." });
    for (const period of SKINCARE_PERIODS) {
      const expected = settings.products
        .filter(
          (product) => !product.archived && product.periods.includes(period),
        )
        .map((product) => product.id);
      const order = settings.routines[period];
      if (
        new Set(order).size !== order.length ||
        order.length !== expected.length ||
        expected.some((id) => !order.includes(id))
      )
        context.addIssue({
          code: "custom",
          message: `A sequência ${period.toUpperCase()} não corresponde aos produtos cadastrados.`,
        });
    }
  });

export const checkEntrySchema = z
  .object({
    status: statusSchema,
    reason: z.string().trim().max(500),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((entry) => entry.status === "skipped" || entry.reason === "", {
    message: "O motivo pertence somente a um registro de não uso.",
  });

export const dayLogSchema = z
  .object({
    day: daySchema,
    plans: z
      .object({
        am: z.array(productSnapshotSchema).max(400),
        pm: z.array(productSnapshotSchema).max(400),
      })
      .strict(),
    entries: z
      .object({
        am: z.record(idSchema, checkEntrySchema),
        pm: z.record(idSchema, checkEntrySchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((log, context) => {
    for (const period of SKINCARE_PERIODS) {
      const ids = log.plans[period].map((product) => product.id);
      if (
        new Set(ids).size !== ids.length ||
        Object.keys(log.entries[period]).some((id) => !ids.includes(id))
      )
        context.addIssue({
          code: "custom",
          message:
            "O histórico contém produtos repetidos ou fora do planejamento.",
        });
    }
  });

export type Product = z.infer<typeof productSchema>;
export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type CheckEntry = z.infer<typeof checkEntrySchema>;
export type DayLog = z.infer<typeof dayLogSchema>;
export type SettingsCommand =
  | { type: "product-save"; product: Product }
  | { type: "product-archive"; id: string }
  | { type: "reorder"; period: Period; productIds: string[] }
  | { type: "transition"; minute: number }
  | { type: "settings"; settings: Settings };

function invalid(message: string): never {
  throw new Error(message);
}
function validDate(date: Date) {
  if (!Number.isFinite(date.getTime())) invalid("Data inválida.");
}
export function isSkincareDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function skincareDay(date = new Date()): string {
  validDate(date);
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validMinute(value: number) {
  if (!minuteSchema.safeParse(value).success)
    invalid("Escolha uma transição entre 00:01 e 23:59.");
}

export function initialSkincareSettings(): Settings {
  return {
    version: 1,
    transitionMinute: DEFAULT_SKINCARE_TRANSITION,
    products: [],
    routines: { am: [], pm: [] },
  };
}
export function automaticPeriod(
  date = new Date(),
  transitionMinute = DEFAULT_SKINCARE_TRANSITION,
): Period {
  validDate(date);
  validMinute(transitionMinute);
  return date.getHours() * 60 + date.getMinutes() < transitionMinute
    ? "am"
    : "pm";
}

/** A manual choice expires at the next local transition or midnight. */
export function boundaryKey(
  date = new Date(),
  transitionMinute = DEFAULT_SKINCARE_TRANSITION,
): string {
  return `${skincareDay(date)}:${transitionMinute}:${automaticPeriod(date, transitionMinute)}:${date.getTimezoneOffset()}`;
}
export function nextSkincareBoundary(
  date = new Date(),
  transitionMinute = DEFAULT_SKINCARE_TRANSITION,
): Date {
  const period = automaticPeriod(date, transitionMinute);
  const next = new Date(date);
  // Construct local calendar time rather than adding 24h: DST days vary in length.
  if (period === "am")
    next.setHours(
      Math.floor(transitionMinute / 60),
      transitionMinute % 60,
      0,
      0,
    );
  else next.setHours(24, 0, 0, 0);
  if (
    period === "am" &&
    next.getHours() * 60 + next.getMinutes() !== transitionMinute
  ) {
    // A wall time inside a spring-forward gap does not exist. setHours moves
    // it by the gap; select the first real instant already in PM instead.
    let start = date.getTime();
    let finish = next.getTime();
    while (start < finish) {
      const middle = Math.floor((start + finish) / 2);
      if (automaticPeriod(new Date(middle), transitionMinute) === "am")
        start = middle + 1;
      else finish = middle;
    }
    return new Date(finish);
  }
  return next;
}

function parseRecord<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  maxBytes: number,
): T | null {
  try {
    if (typeof raw === "string") {
      if (
        raw.length > maxBytes ||
        new TextEncoder().encode(raw).byteLength > maxBytes
      )
        return null;
      raw = JSON.parse(raw);
    }
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function parseSkincareSettings(raw: unknown): Settings | null {
  return parseRecord(raw, settingsSchema, 512 * 1024);
}
export function parseSkincareDay(raw: unknown): DayLog | null {
  return parseRecord(raw, dayLogSchema, 2 * 1024 * 1024);
}
function requiredSettings(settings: Settings) {
  return (
    parseSkincareSettings(settings) ??
    invalid("O cadastro de skincare está incompatível.")
  );
}
function requiredLog(log: DayLog) {
  return (
    parseSkincareDay(log) ??
    invalid("O histórico de skincare está incompatível.")
  );
}

export function productsForPeriod(
  settings: Settings,
  period: Period,
): Product[] {
  const map = new Map(
    settings.products.map((product) => [product.id, product]),
  );
  return settings.routines[period]
    .map((id) => map.get(id))
    .filter((product): product is Product =>
      Boolean(product && !product.archived && product.periods.includes(period)),
    );
}
function snapshot(product: Product): ProductSnapshot {
  const { id, name, brand, kind, shelf } = product;
  return { id, name, brand, kind, shelf };
}
export function makeDayLog(settings: Settings, date = new Date()): DayLog {
  const valid = requiredSettings(settings);
  return {
    day: skincareDay(date),
    plans: {
      am: productsForPeriod(valid, "am").map(snapshot),
      pm: productsForPeriod(valid, "pm").map(snapshot),
    },
    entries: { am: {}, pm: {} },
  };
}

/** Never rewrite yesterday. Today's recorded products retain their provenance. */
export function reconcileTodayPlan(
  existing: DayLog | null | undefined,
  settings: Settings,
  date = new Date(),
): DayLog {
  if (!existing) return makeDayLog(settings, date);
  const current = requiredLog(existing);
  if (current.day !== skincareDay(date)) return current;
  const planned = makeDayLog(settings, date);
  for (const period of SKINCARE_PERIODS) {
    const recorded = new Map(
      current.plans[period]
        .filter((product) => Object.hasOwn(current.entries[period], product.id))
        .map((product) => [product.id, product]),
    );
    planned.plans[period] = planned.plans[period].map(
      (product) => recorded.get(product.id) ?? product,
    );
    const ids = new Set(planned.plans[period].map((product) => product.id));
    for (const product of recorded.values())
      if (!ids.has(product.id)) planned.plans[period].push(product);
    planned.entries[period] = current.entries[period];
  }
  return requiredLog(planned);
}

export function applySkincareSettings(
  settings: Settings,
  command: SettingsCommand,
): Settings {
  const current = requiredSettings(settings);
  if (command.type === "settings") return requiredSettings(command.settings);
  if (command.type === "transition") {
    validMinute(command.minute);
    return { ...current, transitionMinute: command.minute };
  }
  if (command.type === "reorder") {
    if (!periodSchema.safeParse(command.period).success)
      invalid("Período inválido.");
    return requiredSettings({
      ...current,
      routines: { ...current.routines, [command.period]: command.productIds },
    });
  }
  let products: Product[];
  if (command.type === "product-save") {
    const result = productSchema.safeParse(command.product);
    if (!result.success)
      invalid("Preencha nome, prateleira e período válidos para o produto.");
    const product = result.data;
    const previous = current.products.find((item) => item.id === product.id);
    const next = {
      ...product,
      createdAt: previous?.createdAt ?? product.createdAt,
    };
    products = previous
      ? current.products.map((item) => (item.id === next.id ? next : item))
      : [...current.products, next];
  } else if (command.type === "product-archive") {
    if (!current.products.some((product) => product.id === command.id))
      invalid("Produto não encontrado.");
    products = current.products.map((product) =>
      product.id === command.id ? { ...product, archived: true } : product,
    );
  } else invalid("Alteração de skincare inválida.");
  const next: Settings = { ...current, products, routines: { am: [], pm: [] } };
  for (const period of SKINCARE_PERIODS) {
    const active = products
      .filter(
        (product) => !product.archived && product.periods.includes(period),
      )
      .map((product) => product.id);
    const retained = current.routines[period].filter((id) =>
      active.includes(id),
    );
    next.routines[period] = [
      ...retained,
      ...active.filter((id) => !retained.includes(id)),
    ];
  }
  return requiredSettings(next);
}

export function applySkincareCheck(
  log: DayLog,
  productId: string,
  period: Period,
  status: CheckStatus,
  reason = "",
  now = new Date(),
): DayLog {
  const current = requiredLog(log);
  validDate(now);
  if (
    !periodSchema.safeParse(period).success ||
    !statusSchema.safeParse(status).success
  )
    invalid("Período ou status inválido.");
  if (!current.plans[period].some((product) => product.id === productId))
    invalid("Este produto não está planejado para o período selecionado.");
  const result = checkEntrySchema.safeParse({
    status,
    reason: status === "skipped" ? reason : "",
    updatedAt: now.toISOString(),
  });
  if (!result.success) invalid("O motivo deve ter no máximo 500 caracteres.");
  return {
    ...current,
    entries: {
      ...current.entries,
      [period]: { ...current.entries[period], [productId]: result.data },
    },
  };
}

/** Marks every still-pending product of one period as used; decisions already made stay. */
export function markPendingUsed(
  log: DayLog,
  period: Period,
  now = new Date(),
): DayLog {
  const current = requiredLog(log);
  validDate(now);
  if (!periodSchema.safeParse(period).success) invalid("Período inválido.");
  const entries = { ...current.entries[period] };
  for (const product of current.plans[period])
    if (!entries[product.id] || entries[product.id].status === "pending")
      entries[product.id] = {
        status: "used",
        reason: "",
        updatedAt: now.toISOString(),
      };
  return requiredLog({
    ...current,
    entries: { ...current.entries, [period]: entries },
  });
}

export interface RoutineMetrics {
  planned: number;
  used: number;
  skipped: number;
  pending: number;
  percent: number;
  complete: boolean;
}
export function routineMetrics(log: DayLog, period: Period): RoutineMetrics {
  const planned = log.plans[period].length;
  const statuses = log.plans[period].map(
    (product) => log.entries[period][product.id]?.status ?? "pending",
  );
  const used = statuses.filter((status) => status === "used").length;
  const skipped = statuses.filter((status) => status === "skipped").length;
  return {
    planned,
    used,
    skipped,
    pending: planned - used - skipped,
    percent: planned ? Math.round((used / planned) * 100) : 0,
    complete: planned > 0 && used === planned,
  };
}

export interface HistoryFilters {
  day?: string;
  from?: string;
  to?: string;
  period?: Period;
  productId?: string;
  status?: CheckStatus;
}
export interface HistoryRow {
  day: string;
  period: Period;
  product: ProductSnapshot;
  status: CheckStatus;
  reason: string;
  updatedAt: string | null;
}
export function skincareHistory(
  logs: DayLog[],
  filters: HistoryFilters = {},
): HistoryRow[] {
  for (const value of [filters.day, filters.from, filters.to])
    if (value !== undefined && !isSkincareDay(value))
      invalid("Data do filtro inválida.");
  if (filters.from && filters.to && filters.from > filters.to)
    invalid("A data inicial deve vir antes da data final.");
  if (
    filters.period !== undefined &&
    !periodSchema.safeParse(filters.period).success
  )
    invalid("Período inválido.");
  if (
    filters.status !== undefined &&
    !statusSchema.safeParse(filters.status).success
  )
    invalid("Status inválido.");
  return [...logs]
    .sort((a, b) => b.day.localeCompare(a.day))
    .filter(
      (log) =>
        (!filters.day || log.day === filters.day) &&
        (!filters.from || log.day >= filters.from) &&
        (!filters.to || log.day <= filters.to),
    )
    .flatMap((log) =>
      SKINCARE_PERIODS.filter(
        (period) => !filters.period || period === filters.period,
      ).flatMap((period) =>
        log.plans[period]
          .filter(
            (product) => !filters.productId || product.id === filters.productId,
          )
          .map((product): HistoryRow => {
            const entry = log.entries[period][product.id];
            return {
              day: log.day,
              period,
              product,
              status: entry?.status ?? "pending",
              reason: entry?.reason ?? "",
              updatedAt: entry?.updatedAt ?? null,
            };
          }),
      ),
    )
    .filter((row) => !filters.status || row.status === filters.status);
}

interface ConsistencyMetric {
  plannedDays: number;
  completedDays: number;
  percent: number;
}
export function skincareConsistency(
  logs: DayLog[],
): Record<Period | "both", ConsistencyMetric> {
  const unique = new Map(logs.map((log) => [log.day, log]));
  const result = {
    am: { plannedDays: 0, completedDays: 0, percent: 0 },
    pm: { plannedDays: 0, completedDays: 0, percent: 0 },
    both: { plannedDays: 0, completedDays: 0, percent: 0 },
  };
  for (const log of unique.values()) {
    const am = routineMetrics(log, "am");
    const pm = routineMetrics(log, "pm");
    for (const [period, metrics] of [
      ["am", am],
      ["pm", pm],
    ] as const) {
      if (metrics.planned) result[period].plannedDays++;
      if (metrics.complete) result[period].completedDays++;
    }
    if (am.planned + pm.planned > 0) {
      result.both.plannedDays++;
      if (am.used + pm.used === am.planned + pm.planned)
        result.both.completedDays++;
    }
  }
  for (const metric of Object.values(result))
    metric.percent = metric.plannedDays
      ? Math.round((metric.completedDays / metric.plannedDays) * 100)
      : 0;
  return result;
}
