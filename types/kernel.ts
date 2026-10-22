export type Section = "today" | "body" | "build" | "learn" | "wishlist";
export type Sheet =
  | "telemetry"
  | "workout"
  | "nutrition"
  | "routine"
  | "engineering"
  | "learning"
  | "wishlist"
  | "quick"
  | "settings"
  | "checkin"
  | "focus"
  | null;
export type HabitId =
  "skincare-am" | "sunscreen" | "supplements" | "grooming" | "skincare-pm";
export type Macro = "protein" | "carbs" | "fat";
export type DataSource = "demo" | "garmin" | "github" | "manual";

export interface GarminTelemetry {
  source: DataSource;
  bodyBattery: number;
  heartRate: number;
  sleepMinutes: number;
  sleepScore: number;
  restingHeartRate: number;
  samples: number[];
}

export interface Habit {
  id: HabitId;
  title: string;
  subtitle: string;
  period: "morning" | "anytime" | "evening";
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weightKg: number;
}

export interface Nutrition {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealEntry {
  id: string;
  name: string;
  macros: Nutrition;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  lessons: number;
  duration: string;
  color: "blue" | "green";
}

export interface GitEvent {
  id: string;
  kind: "commit" | "pull-request" | "deploy";
  title: string;
  repository: string;
  time: string;
  hash?: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  category: "Suplemento" | "Equipamento" | "Vestuário";
  purpose: string;
  price: number;
  priority: 1 | 2 | 3;
}

export interface Insight {
  id: string;
  courseId: string;
  text: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  kind: "body" | "build" | "learn" | "wishlist" | "mind";
}

export type Rating = 1 | 2 | 3 | 4 | 5;
export interface DailyCheckin {
  energy: Rating;
  mood: Rating;
  stress: Rating;
  sleepHours: number;
  weightKg: number | null;
  steps: number | null;
}
export interface FocusSession {
  id: string;
  minutes: number;
  category: "project" | "study";
  outcome: string;
  createdAt: string;
}
export interface PersonalTargets {
  waterMl: number;
  macros: Nutrition;
  focusMinutes: number;
  sleepHours: number;
  runKm: number;
}
export interface DaySummary {
  day: string;
  waterMl: number;
  habitCount: number;
  workoutSets: number;
  runKm: number;
  nutritionCalories: number;
  focusMinutes: number;
  studyMinutes: number;
  checkin: DailyCheckin | null;
}

export interface KernelState {
  version: 1;
  day: string;
  habits: Record<HabitId, boolean>;
  waterMl: number;
  exercises: Record<string, number>;
  runKm: number;
  nutrition: Nutrition;
  meals: MealEntry[];
  courseProgress: Record<string, number>;
  acquired: string[];
  wishlist: WishlistItem[];
  insights: Insight[];
  journal: JournalEntry[];
  mode: "demo" | "personal";
  checkin: DailyCheckin | null;
  focusSessions: FocusSession[];
  targets: PersonalTargets;
  history: DaySummary[];
}

type KernelCommand =
  | { type: "habit"; id: HabitId }
  | { type: "water"; amount: number }
  | { type: "exercise"; id: string; delta: number }
  | { type: "exercise-total"; id: string; sets: number }
  | { type: "run"; delta: number }
  | { type: "run-total"; km: number }
  | { type: "meal"; name: string; macros: Nutrition }
  | { type: "meal-remove"; id: string }
  | { type: "nutrition-correct"; macros: Nutrition }
  | { type: "lesson"; id: string; delta: number }
  | { type: "insight"; courseId: string; text: string }
  | { type: "insight-delete"; id: string }
  | { type: "acquire"; id: string }
  | { type: "wishlist-add"; item: Omit<WishlistItem, "id"> }
  | { type: "wishlist-delete"; id: string }
  | { type: "checkin"; value: DailyCheckin }
  | {
      type: "focus-add";
      minutes: number;
      category: FocusSession["category"];
      outcome: string;
    }
  | { type: "focus-remove"; id: string }
  | { type: "targets"; value: PersonalTargets }
  | { type: "start-personal" }
  | { type: "rollover" }
  | { type: "restore"; state: KernelState };

// Stable identity lets a failed storage transaction retry the same action.
export type KernelAction = KernelCommand & {
  event?: { id: string; createdAt: string };
};
