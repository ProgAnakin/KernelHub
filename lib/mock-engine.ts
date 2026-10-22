import type {
  Course,
  Exercise,
  GarminTelemetry,
  GitEvent,
  Habit,
  KernelState,
  Nutrition,
  WishlistItem,
  PersonalTargets,
  DaySummary,
} from "../types/kernel.ts";

export const HABITS: Habit[] = [
  {
    id: "skincare-am",
    title: "Skincare da manhã",
    subtitle: "Limpar + hidratar",
    period: "morning",
  },
  {
    id: "sunscreen",
    title: "Proteção solar",
    subtitle: "FPS 50 · reaplicar ao longo do dia",
    period: "morning",
  },
  {
    id: "supplements",
    title: "Suplementação",
    subtitle: "Seguir seu protocolo pessoal",
    period: "anytime",
  },
  {
    id: "grooming",
    title: "Cuidado pessoal",
    subtitle: "Cabelo, barba e higiene",
    period: "anytime",
  },
  {
    id: "skincare-pm",
    title: "Skincare da noite",
    subtitle: "Limpar + rotina noturna",
    period: "evening",
  },
];

export const EXERCISES: Exercise[] = [
  {
    id: "bench",
    name: "Supino com halteres",
    sets: 3,
    reps: "10–12",
    weightKg: 24,
  },
  { id: "row", name: "Remada baixa", sets: 3, reps: "10–12", weightKg: 45 },
  {
    id: "shoulder",
    name: "Desenvolvimento",
    sets: 3,
    reps: "10",
    weightKg: 16,
  },
  {
    id: "lateral",
    name: "Elevação lateral",
    sets: 3,
    reps: "12–15",
    weightKg: 8,
  },
  {
    id: "triceps",
    name: "Tríceps na polia",
    sets: 3,
    reps: "12",
    weightKg: 25,
  },
];

export const COURSES: Course[] = [
  {
    id: "architecture",
    title: "Arquitetura de software",
    provider: "Full Cycle",
    lessons: 12,
    duration: "25 min",
    color: "blue",
  },
  {
    id: "swiftui",
    title: "SwiftUI Essentials",
    provider: "Apple Developer",
    lessons: 10,
    duration: "18 min",
    color: "green",
  },
];

export const WISHLIST: WishlistItem[] = [
  {
    id: "creatine",
    name: "Creatina monohidratada",
    category: "Suplemento",
    purpose: "Reposição da rotina",
    price: 89.9,
    priority: 1,
  },
  {
    id: "shoes",
    name: "Tênis de corrida",
    category: "Equipamento",
    purpose: "Conforto nas corridas",
    price: 649.9,
    priority: 2,
  },
  {
    id: "shirt",
    name: "Camiseta essencial",
    category: "Vestuário",
    purpose: "Um guarda-roupa mais simples",
    price: 129,
    priority: 3,
  },
];

// Demonstration events are fixtures, never inferred from local Git state.
export const GIT_EVENTS: GitEvent[] = [
  {
    id: "d2",
    kind: "deploy",
    title: "KernelHub · produção",
    repository: "kernelhub",
    time: "14:32",
  },
  {
    id: "pr1",
    kind: "pull-request",
    title: "feat: dashboard de evolução",
    repository: "kernelhub",
    time: "14:28",
    hash: "#24",
  },
  {
    id: "c3",
    kind: "commit",
    title: "feat: anel de energia e telemetria",
    repository: "kernelhub",
    time: "14:12",
    hash: "a82f3c1",
  },
  {
    id: "c2",
    kind: "commit",
    title: "fix: safe areas no modo standalone",
    repository: "kernelhub",
    time: "11:46",
    hash: "b91e4d2",
  },
  {
    id: "d1",
    kind: "deploy",
    title: "Portfolio · produção",
    repository: "portfolio",
    time: "10:18",
  },
  {
    id: "c1",
    kind: "commit",
    title: "refactor: componentes de navegação",
    repository: "portfolio",
    time: "09:54",
    hash: "c72d8a3",
  },
];

export const MACRO_TARGETS: Nutrition = { protein: 160, carbs: 260, fat: 70 };
export const WATER_TARGET = 2500;
export const RUN_TARGET = 5;
export const DEFAULT_TARGETS: PersonalTargets = {
  waterMl: WATER_TARGET,
  macros: { ...MACRO_TARGETS },
  focusMinutes: 90,
  sleepHours: 8,
  runKm: RUN_TARGET,
};

export function localDay(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function calories(nutrition: Nutrition): number {
  return Math.round(
    nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9,
  );
}

export function mockTelemetry(date = new Date()): GarminTelemetry {
  const seed = [...localDay(date)].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return {
    source: "demo",
    bodyBattery: 76,
    heartRate:
      60 + Math.round(Math.sin(Math.floor(date.getTime() / 12000) + seed) * 3),
    sleepMinutes: 462,
    sleepScore: 84,
    restingHeartRate: 54,
    samples: Array.from({ length: 24 }, (_, i) =>
      Math.round(
        38 + 38 * Math.sin((i / 23) * Math.PI) + Math.sin(i * 1.8 + seed) * 4,
      ),
    ),
  };
}

export function mockContributions(date = new Date()): number[] {
  const seed = date.getDay() + 3;
  return Array.from(
    { length: 91 },
    (_, i) => ((i * 13 + seed * 7 + Math.floor(i / 7) * 3) % 11) % 5,
  );
}

export function createInitialState(
  date = new Date(),
  mode: KernelState["mode"] = "demo",
): KernelState {
  const demo = mode === "demo";
  const state: KernelState = {
    version: 1,
    day: localDay(date),
    habits: {
      "skincare-am": true,
      sunscreen: true,
      supplements: false,
      grooming: false,
      "skincare-pm": false,
    },
    waterMl: 1500,
    exercises: { bench: 3, row: 1, shoulder: 0, lateral: 0, triceps: 0 },
    runKm: 0,
    nutrition: { protein: 114, carbs: 186, fat: 48 },
    courseProgress: { architecture: 7, swiftui: 3 },
    acquired: [],
    wishlist: WISHLIST.map((item) => ({ ...item })),
    insights: [],
    journal: [],
    mode,
    checkin: null,
    focusSessions: [],
    targets: structuredClone(DEFAULT_TARGETS),
    history: [],
  };
  if (demo) {
    state.history = Array.from({ length: 6 }, (_, i): DaySummary => {
      const day = new Date(date);
      day.setDate(day.getDate() - (6 - i));
      return {
        day: localDay(day),
        waterMl: [2000, 2500, 2250, 2750, 2000, 2500][i],
        habitCount: [3, 4, 5, 3, 4, 5][i],
        workoutSets: i % 2 ? 15 : 0,
        runKm: i % 2 ? 0 : 4,
        nutritionCalories: 2150 + i * 25,
        focusMinutes: [50, 75, 90, 50, 100, 75][i],
        studyMinutes: 25,
        checkin: {
          energy: 4,
          mood: 4,
          stress: 2,
          sleepHours: [7, 7.5, 8, 6.5, 7.5, 8][i],
          weightKg: i % 2 ? null : 76.8 - i * 0.1,
          steps: 6200 + i * 300,
        },
      };
    });
    return state;
  }
  return {
    ...state,
    habits: Object.fromEntries(
      HABITS.map((habit) => [habit.id, false]),
    ) as KernelState["habits"],
    waterMl: 0,
    exercises: Object.fromEntries(
      EXERCISES.map((exercise) => [exercise.id, 0]),
    ),
    nutrition: { protein: 0, carbs: 0, fat: 0 },
    courseProgress: { architecture: 0, swiftui: 0 },
    wishlist: [],
  };
}
