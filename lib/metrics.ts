import type { DaySummary, KernelState } from "../types/kernel.ts";
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
