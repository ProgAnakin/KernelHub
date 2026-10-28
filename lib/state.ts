import { z } from "zod";
import type { KernelAction, KernelState } from "../types/kernel.ts";
import {
  COURSES,
  EXERCISES,
  HABITS,
  createInitialState,
  localDay,
  DEFAULT_TARGETS,
} from "./mock-engine.ts";
import { summarizeDay } from "./metrics.ts";

export const STORAGE_KEY = "kernelhub:state:v1";
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const nonNegative = z.number().finite().nonnegative();
const identifier = z.string().min(1).max(80);
const nutritionSchema = z.object({
  protein: nonNegative.max(10000),
  carbs: nonNegative.max(10000),
  fat: nonNegative.max(10000),
});
const mealMacrosSchema = z
  .object({
    protein: nonNegative.max(500),
    carbs: nonNegative.max(500),
    fat: nonNegative.max(500),
  })
  .refine((value) => value.protein + value.carbs + value.fat > 0);
// Macro totals are kept to a tenth of a gram so decimal labels (e.g. 7.5 g)
// never accumulate floating-point noise or break the meals <= totals invariant.
// A total rounded to a tenth may sit just below the exact sum of older meals.
const MEAL_TOLERANCE = 0.051;
const tenth = (value: number) => Math.round(value * 10) / 10;
const uniqueIds = (items: { id: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length;
const rating = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export const checkinSchema = z.object({
  energy: rating,
  mood: rating,
  stress: rating,
  sleepHours: nonNegative.max(24),
  weightKg: z.number().finite().min(20).max(350).nullable(),
  steps: nonNegative.int().max(100000).nullable(),
});
export const targetsSchema = z
  .object({
    waterMl: z.number().int().min(250).max(10000),
    macros: z.object({
      protein: nonNegative.max(500),
      carbs: nonNegative.max(1000),
      fat: nonNegative.max(300),
    }),
    focusMinutes: z.number().int().min(15).max(720),
    sleepHours: z.number().min(1).max(16),
    runKm: z.number().min(0.5).max(100),
  })
  .refine(
    (value) => value.macros.protein + value.macros.carbs + value.macros.fat > 0,
  );
const schema: z.ZodType<KernelState> = z.object({
  version: z.literal(1),
  day: z.iso.date(),
  mode: z.enum(["demo", "personal"]).default("demo"),
  checkin: checkinSchema.nullable().default(null),
  targets: targetsSchema.default(DEFAULT_TARGETS),
  focusSessions: z
    .array(
      z.object({
        id: identifier,
        minutes: z.number().int().min(1).max(480),
        category: z.enum(["project", "study"]),
        outcome: z.string().max(240),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(50)
    .default([]),
  history: z
    .array(
      z.object({
        day: z.iso.date(),
        waterMl: nonNegative.max(10000),
        habitCount: nonNegative.int().max(5),
        workoutSets: nonNegative.int().max(15),
        runKm: nonNegative.max(100),
        nutritionCalories: nonNegative.max(200000),
        focusMinutes: nonNegative.int().max(1440),
        studyMinutes: nonNegative.int().max(1440),
        checkin: checkinSchema.nullable(),
      }),
    )
    .max(90)
    .default([]),
  habits: z.object({
    "skincare-am": z.boolean(),
    sunscreen: z.boolean(),
    supplements: z.boolean(),
    grooming: z.boolean(),
    "skincare-pm": z.boolean(),
  }),
  waterMl: nonNegative.max(10000),
  exercises: z
    .object({
      bench: nonNegative.int().max(3),
      row: nonNegative.int().max(3),
      shoulder: nonNegative.int().max(3),
      lateral: nonNegative.int().max(3),
      triceps: nonNegative.int().max(3),
    })
    .strict(),
  runKm: nonNegative.max(100),
  nutrition: nutritionSchema,
  meals: z
    .array(
      z.object({
        id: identifier,
        name: z.string().trim().min(1).max(80),
        macros: mealMacrosSchema,
        createdAt: z.iso.datetime(),
      }),
    )
    .max(100)
    .default([]),
  courseProgress: z.object({
    architecture: nonNegative.int().max(12),
    swiftui: nonNegative.int().max(10),
  }),
  acquired: z.array(identifier).max(100),
  wishlist: z
    .array(
      z.object({
        id: identifier,
        name: z.string().min(1).max(80),
        category: z.enum(["Suplemento", "Equipamento", "Vestuário"]),
        purpose: z.string().max(160),
        price: nonNegative.max(1000000),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      }),
    )
    .max(100),
  insights: z
    .array(
      z.object({
        id: identifier,
        courseId: identifier,
        text: z.string().trim().min(1).max(1000),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(500),
  journal: z
    .array(
      z.object({
        id: identifier,
        title: z.string().min(1).max(100),
        detail: z.string().max(400),
        createdAt: z.iso.datetime(),
        kind: z.enum(["body", "build", "learn", "wishlist", "mind"]),
      }),
    )
    .max(200),
});

export function reconcileDay(
  state: KernelState,
  date = new Date(),
): KernelState {
  // A backwards device clock must not archive a future day into its past.
  if (state.day >= localDay(date)) return state;
  const initial = createInitialState(date, state.mode);
  return {
    ...initial,
    habits: {
      "skincare-am": false,
      sunscreen: false,
      supplements: false,
      grooming: false,
      "skincare-pm": false,
    },
    waterMl: 0,
    exercises: Object.fromEntries(
      EXERCISES.map((exercise) => [exercise.id, 0]),
    ),
    nutrition: { protein: 0, carbs: 0, fat: 0 },
    courseProgress: state.courseProgress,
    acquired: state.acquired,
    wishlist: state.wishlist,
    insights: state.insights,
    journal: state.journal,
    targets: state.targets,
    history: [
      ...state.history.filter((day) => day.day !== state.day),
      summarizeDay(state),
    ].slice(-90),
  };
}

export function parseStoredState(
  value: string | null,
  date = new Date(),
): KernelState | null {
  if (!value || value.length > MAX_BACKUP_BYTES) return null;
  try {
    if (new TextEncoder().encode(value).byteLength > MAX_BACKUP_BYTES)
      return null;
    const result = schema.safeParse(JSON.parse(value));
    if (!result.success) return null;
    const data = result.data;
    const ids = new Set(data.wishlist.map((item) => item.id));
    if (
      ids.size !== data.wishlist.length ||
      new Set(data.acquired).size !== data.acquired.length ||
      !uniqueIds(data.focusSessions) ||
      !uniqueIds(data.meals) ||
      !uniqueIds(data.insights) ||
      !uniqueIds(data.journal) ||
      data.focusSessions.reduce((sum, session) => sum + session.minutes, 0) >
        1440 ||
      data.history.some(
        (day) => day.studyMinutes > day.focusMinutes || day.day >= data.day,
      ) ||
      (["protein", "carbs", "fat"] as const).some(
        (macro) =>
          data.meals.reduce((sum, meal) => sum + meal.macros[macro], 0) >
          data.nutrition[macro] + MEAL_TOLERANCE,
      ) ||
      data.acquired.some((id) => !ids.has(id)) ||
      data.insights.some(
        (insight) => !COURSES.some((course) => course.id === insight.courseId),
      ) ||
      new Set(data.history.map((day) => day.day)).size !== data.history.length
    )
      return null;
    return reconcileDay(data, date);
  } catch {
    return null;
  }
}

export function actionDate(action: KernelAction, now = new Date()): Date {
  if (!action.event) return now;
  if (!action.event.day) return new Date(action.event.createdAt);
  if (!z.iso.date().safeParse(action.event.day).success) return new Date(NaN);
  const [year, month, day] = action.event.day.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function isDailyAction(action: KernelAction): boolean {
  return [
    "habit",
    "water",
    "exercise",
    "exercise-total",
    "run",
    "run-total",
    "meal",
    "meal-remove",
    "nutrition-correct",
    "checkin",
    "focus-add",
    "focus-remove",
  ].includes(action.type);
}

export function kernelReducer(
  state: KernelState,
  action: KernelAction,
): KernelState {
  const date = actionDate(action);
  if (!Number.isFinite(date.getTime())) return state;
  if (action.type === "restore")
    return parseStoredState(JSON.stringify(action.state), date) ?? state;
  if (action.type === "rollover") return reconcileDay(state, date);
  if (action.type === "start-personal")
    return createInitialState(date, "personal");
  if (isDailyAction(action) && localDay(date) < state.day) return state;
  state = reconcileDay(state, date);
  const eventId = () => action.event?.id ?? crypto.randomUUID();
  const eventTime = () => action.event?.createdAt ?? new Date().toISOString();
  let next = state;
  let title = "";
  let detail = "";
  let kind: "body" | "learn" | "wishlist" | "mind" | "build" = "body";
  switch (action.type) {
    case "checkin": {
      const result = checkinSchema.safeParse(action.value);
      if (!result.success) return state;
      next = { ...state, checkin: result.data };
      title = "Check-in do dia";
      detail = `Energia ${result.data.energy}/5 · humor ${result.data.mood}/5`;
      kind = "mind";
      break;
    }
    case "focus-add": {
      if (
        !Number.isInteger(action.minutes) ||
        action.minutes < 1 ||
        action.minutes > 480 ||
        state.focusSessions.reduce((sum, session) => sum + session.minutes, 0) +
          action.minutes >
          1440 ||
        state.focusSessions.length >= 50 ||
        !["project", "study"].includes(action.category)
      )
        return state;
      const session = {
        id: eventId(),
        minutes: action.minutes,
        category: action.category,
        outcome: action.outcome.trim().slice(0, 240),
        createdAt: eventTime(),
      };
      next = { ...state, focusSessions: [...state.focusSessions, session] };
      title =
        action.category === "study" ? "Bloco de estudo" : "Bloco de projeto";
      detail = `${action.minutes} minutos · ${session.outcome || "Tempo dedicado"}`;
      kind = action.category === "study" ? "learn" : "build";
      break;
    }
    case "focus-remove": {
      if (!state.focusSessions.some((session) => session.id === action.id))
        return state;
      next = {
        ...state,
        focusSessions: state.focusSessions.filter(
          (session) => session.id !== action.id,
        ),
      };
      title = "Bloco de foco removido";
      detail = "Total do dia ajustado";
      kind = "build";
      break;
    }
    case "targets": {
      const result = targetsSchema.safeParse(action.value);
      if (!result.success) return state;
      next = { ...state, targets: result.data };
      title = "Metas pessoais atualizadas";
      detail = "Seu ritmo, suas escolhas";
      kind = "mind";
      break;
    }
    case "wishlist-delete": {
      const item = state.wishlist.find((item) => item.id === action.id);
      if (!item) return state;
      next = {
        ...state,
        wishlist: state.wishlist.filter((item) => item.id !== action.id),
        acquired: state.acquired.filter((id) => id !== action.id),
      };
      title = item.name;
      detail = "Removido dos planos";
      kind = "wishlist";
      break;
    }
    case "habit": {
      const habit = HABITS.find((item) => item.id === action.id);
      if (!habit) return state;
      next = {
        ...state,
        habits: { ...state.habits, [action.id]: !state.habits[action.id] },
      };
      title = habit.title;
      detail = next.habits[action.id]
        ? "Cuidado concluído"
        : "Conclusão desfeita";
      break;
    }
    case "water": {
      if (!Number.isFinite(action.amount)) return state;
      const waterMl = Math.max(
        0,
        Math.min(10000, state.waterMl + action.amount),
      );
      if (waterMl === state.waterMl) return state;
      next = { ...state, waterMl };
      title = "Hidratação registrada";
      detail = `${waterMl} ml no dia`;
      break;
    }
    case "exercise":
    case "exercise-total": {
      const exercise = EXERCISES.find((item) => item.id === action.id);
      const value =
        action.type === "exercise-total"
          ? action.sets
          : (state.exercises[action.id] ?? 0) + action.delta;
      if (!exercise || !Number.isInteger(value)) return state;
      const completed = Math.max(0, Math.min(exercise.sets, value));
      if (completed === state.exercises[action.id]) return state;
      next = {
        ...state,
        exercises: { ...state.exercises, [action.id]: completed },
      };
      title = exercise.name;
      detail = `${completed}/${exercise.sets} séries`;
      break;
    }
    case "run":
    case "run-total": {
      const value =
        action.type === "run-total" ? action.km : state.runKm + action.delta;
      if (
        !Number.isFinite(value) ||
        (action.type === "run-total" && (value < 0 || value > 100))
      )
        return state;
      const runKm = Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
      if (runKm === state.runKm) return state;
      next = { ...state, runKm };
      title = "Corrida registrada";
      detail = `${runKm} km no dia`;
      break;
    }
    case "meal": {
      const parsed = mealMacrosSchema.safeParse(action.macros);
      if (!action.name.trim() || !parsed.success) return state;
      const macros = {
        protein: tenth(parsed.data.protein),
        carbs: tenth(parsed.data.carbs),
        fat: tenth(parsed.data.fat),
      };
      if (
        macros.protein + macros.carbs + macros.fat <= 0 ||
        state.meals.length >= 100 ||
        (["protein", "carbs", "fat"] as const).some(
          (macro) => state.nutrition[macro] + macros[macro] > 10000,
        )
      )
        return state;
      next = {
        ...state,
        meals: [
          ...state.meals,
          {
            id: eventId(),
            name: action.name.trim().slice(0, 80),
            macros,
            createdAt: eventTime(),
          },
        ],
        nutrition: {
          protein: tenth(state.nutrition.protein + macros.protein),
          carbs: tenth(state.nutrition.carbs + macros.carbs),
          fat: tenth(state.nutrition.fat + macros.fat),
        },
      };
      title = action.name.trim().slice(0, 80);
      detail = "Refeição adicionada";
      break;
    }
    case "meal-remove": {
      const meal = state.meals.find((item) => item.id === action.id);
      if (!meal) return state;
      next = {
        ...state,
        meals: state.meals.filter((item) => item.id !== action.id),
        nutrition: {
          protein: Math.max(
            0,
            tenth(state.nutrition.protein - meal.macros.protein),
          ),
          carbs: Math.max(0, tenth(state.nutrition.carbs - meal.macros.carbs)),
          fat: Math.max(0, tenth(state.nutrition.fat - meal.macros.fat)),
        },
      };
      title = meal.name;
      detail = "Refeição removida · totais ajustados";
      break;
    }
    case "nutrition-correct": {
      const result = nutritionSchema.safeParse(action.macros);
      if (!result.success) return state;
      next = { ...state, nutrition: result.data, meals: [] };
      title = "Alimentação corrigida";
      detail = "Totais do dia atualizados · lista de refeições reiniciada";
      break;
    }
    case "lesson": {
      const course = COURSES.find((item) => item.id === action.id);
      if (!course || !Number.isInteger(action.delta)) return state;
      const completed = Math.max(
        0,
        Math.min(
          course.lessons,
          (state.courseProgress[action.id] ?? 0) + action.delta,
        ),
      );
      if (completed === state.courseProgress[action.id]) return state;
      next = {
        ...state,
        courseProgress: { ...state.courseProgress, [action.id]: completed },
      };
      title = course.title;
      detail = `${completed}/${course.lessons} aulas`;
      kind = "learn";
      break;
    }
    case "insight": {
      if (
        !action.text.trim() ||
        !COURSES.some((course) => course.id === action.courseId)
      )
        return state;
      const insight = {
        id: eventId(),
        courseId: action.courseId,
        text: action.text.trim().slice(0, 1000),
        createdAt: eventTime(),
      };
      next = { ...state, insights: [insight, ...state.insights].slice(0, 500) };
      title = "Insight guardado";
      detail = COURSES.find((course) => course.id === action.courseId)!.title;
      kind = "learn";
      break;
    }
    case "insight-delete": {
      if (!state.insights.some((insight) => insight.id === action.id))
        return state;
      next = {
        ...state,
        insights: state.insights.filter((insight) => insight.id !== action.id),
      };
      title = "Insight removido";
      detail = "Suas anotações foram atualizadas";
      kind = "learn";
      break;
    }
    case "acquire": {
      const item = state.wishlist.find((item) => item.id === action.id);
      if (!item) return state;
      const already = state.acquired.includes(action.id);
      next = {
        ...state,
        acquired: already
          ? state.acquired.filter((id) => id !== action.id)
          : [...state.acquired, action.id],
      };
      title = item.name;
      detail = already ? "Voltou para planejados" : "Aquisição concluída";
      kind = "wishlist";
      break;
    }
    case "wishlist-add": {
      const item = action.item;
      if (
        !item.name.trim() ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        item.price > 1000000 ||
        ![1, 2, 3].includes(item.priority) ||
        !["Suplemento", "Equipamento", "Vestuário"].includes(item.category) ||
        state.wishlist.length >= 100
      )
        return state;
      next = {
        ...state,
        wishlist: [
          ...state.wishlist,
          {
            ...item,
            id: eventId(),
            name: item.name.trim().slice(0, 80),
            purpose: item.purpose.trim().slice(0, 160),
          },
        ],
      };
      title = item.name.trim().slice(0, 80);
      detail = "Adicionado aos seus planos";
      kind = "wishlist";
      break;
    }
    default:
      return state;
  }
  return {
    ...next,
    journal: [
      {
        id: eventId(),
        title,
        detail,
        kind,
        createdAt: eventTime(),
      },
      ...next.journal,
    ].slice(0, 200),
  };
}
