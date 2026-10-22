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
const nonNegative = z.number().finite().nonnegative();
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
        id: z.string(),
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
        focusMinutes: nonNegative.max(24000),
        studyMinutes: nonNegative.max(24000),
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
  exercises: z.record(z.string(), nonNegative.int().max(3)),
  runKm: nonNegative.max(100),
  nutrition: z.object({
    protein: nonNegative.max(10000),
    carbs: nonNegative.max(10000),
    fat: nonNegative.max(10000),
  }),
  courseProgress: z.object({
    architecture: nonNegative.int().max(12),
    swiftui: nonNegative.int().max(10),
  }),
  acquired: z.array(z.string()).max(100),
  wishlist: z
    .array(
      z.object({
        id: z.string(),
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
        id: z.string(),
        courseId: z.string(),
        text: z.string().max(1000),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(500),
  journal: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        detail: z.string(),
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
  if (state.day === localDay(date)) return state;
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
  if (!value) return null;
  try {
    const result = schema.safeParse(JSON.parse(value));
    if (!result.success) return null;
    const data = result.data;
    const ids = new Set(data.wishlist.map((item) => item.id));
    if (
      ids.size !== data.wishlist.length ||
      new Set(data.acquired).size !== data.acquired.length ||
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

export function kernelReducer(
  state: KernelState,
  action: KernelAction,
): KernelState {
  if (action.type === "restore") return action.state;
  if (action.type === "rollover") return reconcileDay(state);
  if (action.type === "start-personal")
    return createInitialState(new Date(), "personal");
  state = reconcileDay(state);
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
        id: crypto.randomUUID(),
        minutes: action.minutes,
        category: action.category,
        outcome: action.outcome.trim().slice(0, 240),
        createdAt: new Date().toISOString(),
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
    case "exercise": {
      const exercise = EXERCISES.find((item) => item.id === action.id);
      if (!exercise || !Number.isInteger(action.delta)) return state;
      const completed = Math.max(
        0,
        Math.min(
          exercise.sets,
          (state.exercises[action.id] ?? 0) + action.delta,
        ),
      );
      if (completed === state.exercises[action.id]) return state;
      next = {
        ...state,
        exercises: { ...state.exercises, [action.id]: completed },
      };
      title = exercise.name;
      detail = `${completed}/${exercise.sets} séries`;
      break;
    }
    case "run": {
      if (!Number.isFinite(action.delta)) return state;
      const runKm =
        Math.round(
          Math.max(0, Math.min(100, state.runKm + action.delta)) * 10,
        ) / 10;
      if (runKm === state.runKm) return state;
      next = { ...state, runKm };
      title = "Corrida registrada";
      detail = `${runKm} km no dia`;
      break;
    }
    case "meal": {
      if (
        !action.name.trim() ||
        Object.values(action.macros).some(
          (value) => !Number.isFinite(value) || value < 0 || value > 500,
        )
      )
        return state;
      next = {
        ...state,
        nutrition: {
          protein: Math.min(
            10000,
            state.nutrition.protein + action.macros.protein,
          ),
          carbs: Math.min(10000, state.nutrition.carbs + action.macros.carbs),
          fat: Math.min(10000, state.nutrition.fat + action.macros.fat),
        },
      };
      title = action.name.trim().slice(0, 80);
      detail = "Refeição adicionada";
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
        id: crypto.randomUUID(),
        courseId: action.courseId,
        text: action.text.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      };
      next = { ...state, insights: [insight, ...state.insights].slice(0, 500) };
      title = "Insight guardado";
      detail = COURSES.find((course) => course.id === action.courseId)!.title;
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
        state.wishlist.length >= 100
      )
        return state;
      next = {
        ...state,
        wishlist: [
          ...state.wishlist,
          {
            ...item,
            id: crypto.randomUUID(),
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
  }
  return {
    ...next,
    journal: [
      {
        id: crypto.randomUUID(),
        title,
        detail,
        kind,
        createdAt: new Date().toISOString(),
      },
      ...next.journal,
    ].slice(0, 200),
  };
}
