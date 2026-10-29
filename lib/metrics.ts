import type { DaySummary, KernelState } from "../types/kernel.ts";
import type { HealthMetric, HealthSnapshot } from "./health.ts";
import { calories, EXERCISES, HABITS, localDay } from "./mock-engine.ts";

export function summarizeDay(state: KernelState): DaySummary {
  return {
    day: state.day,
    waterMl: state.waterMl,
    habitCount: HABITS.filter((habit) => state.habits[habit.id]).length,
    workoutSets: EXERCISES.reduce(
      (sum, exercise) => sum + (state.exercises[exercise.id] ?? 0),
      0,
    ),
    runKm: state.runKm,
    nutritionCalories: calories(state.nutrition),
    focusMinutes: state.focusSessions.reduce(
      (sum, session) => sum + session.minutes,
      0,
    ),
    studyMinutes: state.focusSessions
      .filter((session) => session.category === "study")
      .reduce((sum, session) => sum + session.minutes, 0),
    checkin: state.checkin,
  };
}

export function weekOf(state: KernelState): (DaySummary | null)[] {
  const days = new Map(state.history.map((day) => [day.day, day]));
  days.set(state.day, summarizeDay(state));
  const [year, month, day] = state.day.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(year, month - 1, day - (6 - i), 12);
    return days.get(localDay(date)) ?? null;
  });
}

export function nextStep(state: KernelState) {
  if (!state.checkin)
    return {
      sheet: "checkin" as const,
      title: "Como você está hoje?",
      detail: "Um check-in rápido de energia, humor e descanso.",
      label: "Fazer meu check-in",
    };
  if (state.waterMl < state.targets.waterMl)
    return {
      sheet: "nutrition" as const,
      title: "Um pouco de água, uma pausa.",
      detail: `${((state.targets.waterMl - state.waterMl) / 1000).toLocaleString("pt-BR")} L até a meta que você escolheu.`,
      label: "Registrar hidratação",
    };
  if (summarizeDay(state).focusMinutes < state.targets.focusMinutes)
    return {
      sheet: "focus" as const,
      title: "Proteja um espaço para construir.",
      detail: "Registre um bloco de projeto ou estudo que você concluiu.",
      label: "Registrar bloco de foco",
    };
  return {
    sheet: "routine" as const,
    title: "Cuide também dos detalhes.",
    detail: "Revisite os cuidados do dia, sem pressa de completar tudo.",
    label: "Revisar meus cuidados",
  };
}

export interface CheckinSuggestion {
  /** Value ready to put in the check-in field. */
  value: number;
  /** What the person sees on the chip, in the field's own unit. */
  display: string;
  source: string;
  day: string;
}
export interface CheckinSuggestions {
  sleepHours: CheckinSuggestion | null;
  weightKg: CheckinSuggestion | null;
  steps: CheckinSuggestion | null;
}

function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + delta, 12));
}

/**
 * Imported readings that can pre-fill today's check-in. They are offered, never
 * saved: only recent, sourced values qualify, and a stale or partial reading
 * is not passed off as today's.
 */
export function checkinSuggestions(
  snapshot: HealthSnapshot | null,
  today: string,
): CheckinSuggestions {
  const pick = (id: HealthMetric, oldest: string, newest: string) => {
    const reading = snapshot?.metrics[id];
    return reading &&
      reading.value !== null &&
      reading.source &&
      reading.day &&
      reading.day >= oldest &&
      reading.day <= newest
      ? { value: reading.value, source: reading.source, day: reading.day }
      : null;
  };
  // Sleep is filed under the day it ended: last night ends today.
  const sleep = pick("sleepHours", shiftDay(today, -1), today);
  const weight = pick("weightKg", shiftDay(today, -7), today);
  const steps = pick("steps", today, today);
  return {
    sleepHours: sleep && {
      ...sleep,
      value: Math.round(sleep.value * 10) / 10,
      display: `${Math.floor(Math.round(sleep.value * 60) / 60)}h${String(Math.round(sleep.value * 60) % 60).padStart(2, "0")}`,
    },
    weightKg: weight && {
      ...weight,
      value: Math.round(weight.value * 10) / 10,
      display: `${(Math.round(weight.value * 10) / 10).toLocaleString("pt-BR")} kg`,
    },
    steps: steps && {
      ...steps,
      value: Math.round(steps.value),
      display: Math.round(steps.value).toLocaleString("pt-BR"),
    },
  };
}

export type RhythmTrack = "focus" | "water" | "checkin" | "movement";
export interface RhythmCell {
  day: string;
  /** null: no record for that day; 0–4: share of the personal target reached. */
  level: number | null;
  value: number;
}
export const RHYTHM_TRACKS: { id: RhythmTrack; label: string }[] = [
  { id: "focus", label: "Foco" },
  { id: "water", label: "Água" },
  { id: "movement", label: "Movimento" },
  { id: "checkin", label: "Check-in" },
];

function trackValue(day: DaySummary, track: RhythmTrack, state: KernelState) {
  switch (track) {
    case "focus":
      return {
        value: day.focusMinutes,
        share: day.focusMinutes / state.targets.focusMinutes,
      };
    case "water":
      return { value: day.waterMl, share: day.waterMl / state.targets.waterMl };
    case "movement": {
      const value = day.workoutSets + day.runKm;
      return {
        value,
        share: day.workoutSets / 15 + day.runKm / state.targets.runKm,
      };
    }
    case "checkin":
      return { value: day.checkin ? 1 : 0, share: day.checkin ? 1 : 0 };
  }
}

/**
 * A contribution-style grid, oldest first, ending today. Days the app has no
 * summary for stay null: an absence is not a zero.
 */
export function rhythmGrid(
  state: KernelState,
  track: RhythmTrack,
  days = 91,
): RhythmCell[] {
  const known = new Map(state.history.map((day) => [day.day, day]));
  known.set(state.day, summarizeDay(state));
  const [year, month, date] = state.day.split("-").map(Number);
  return Array.from({ length: days }, (_, index) => {
    const key = localDay(
      new Date(year, month - 1, date - (days - 1 - index), 12),
    );
    const summary = known.get(key);
    if (!summary) return { day: key, level: null, value: 0 };
    const { value, share } = trackValue(summary, track, state);
    const level =
      share <= 0 ? 0 : share < 0.34 ? 1 : share < 0.67 ? 2 : share < 1 ? 3 : 4;
    return { day: key, level, value };
  });
}

/** Consecutive days, ending today or yesterday, that reached the target. */
export function rhythmStreak(cells: RhythmCell[]): number {
  let streak = 0;
  for (let index = cells.length - 1; index >= 0; index--) {
    if (cells[index].level === 4) streak++;
    // Today may still be in progress; it does not break a streak.
    else if (index === cells.length - 1) continue;
    else break;
  }
  return streak;
}
