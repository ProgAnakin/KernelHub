import { z } from "zod";
import type { KernelAction } from "../types/kernel.ts";
import { kernelReducer, parseStoredState, STORAGE_KEY } from "./state.ts";
import { localDay } from "./mock-engine.ts";

export const FOCUS_TIMER_KEY = "kernelhub:focus-timer:v1";
export const FOCUS_TIMER_CHANNEL = "kernelhub:focus-timer";
export const MAX_FOCUS_MINUTES = 480;
const MAX_RECORD_BYTES = 4096;
const timerSchema = z
  .object({
    version: z.literal(1),
    targetMinutes: z.number().int().min(1).max(MAX_FOCUS_MINUTES),
    session: z
      .object({
        id: z.string().min(1).max(80),
        category: z.enum(["project", "study"]),
        outcome: z.string().max(240),
        startedAt: z.number().int().nonnegative().max(8640000000000000),
        runningSince: z
          .number()
          .int()
          .nonnegative()
          .max(8640000000000000)
          .nullable(),
        accumulatedMs: z
          .number()
          .finite()
          .nonnegative()
          .max(31 * 24 * 60 * 60 * 1000),
        updatedAt: z.number().int().nonnegative().max(8640000000000000),
      })
      .nullable(),
  })
  .superRefine((value, context) => {
    const session = value.session;
    if (
      session &&
      (session.updatedAt < session.startedAt ||
        (session.runningSince !== null &&
          session.runningSince < session.startedAt))
    )
      context.addIssue({ code: "custom", message: "Invalid timer chronology" });
  });

export type FocusTimerRecord = z.infer<typeof timerSchema>;
export type FocusCategory = "project" | "study";
export type TimerStatus = "idle" | "running" | "paused";
export interface FocusCompletion {
  id: string;
  minutes: number;
  category: FocusCategory;
  outcome: string;
  measuredSeconds: number;
  startedAt: string;
  completedAt: string;
  alreadyRecorded?: boolean;
}
export type FocusTimerCommand =
  | { type: "target"; minutes: number }
  | { type: "start"; id: string; category: FocusCategory; outcome: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "reset" };

export class FocusTimerError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FocusTimerError";
  }
}

export function initialFocusTimer(targetMinutes = 25): FocusTimerRecord {
  return {
    version: 1,
    targetMinutes:
      Number.isInteger(targetMinutes) &&
      targetMinutes >= 1 &&
      targetMinutes <= MAX_FOCUS_MINUTES
        ? targetMinutes
        : 25,
    session: null,
  };
}

export function parseFocusTimer(raw: unknown): FocusTimerRecord | null {
  if (typeof raw !== "string" || raw.length > MAX_RECORD_BYTES) return null;
  try {
    if (new TextEncoder().encode(raw).byteLength > MAX_RECORD_BYTES)
      return null;
    const result = timerSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function timerStatus(record: FocusTimerRecord): TimerStatus {
  return !record.session
    ? "idle"
    : record.session.runningSince === null
      ? "paused"
      : "running";
}

export function focusElapsedSeconds(
  record: FocusTimerRecord,
  now = Date.now(),
): number {
  const session = record.session;
  if (!session || !Number.isFinite(now)) return 0;
  const runningMs =
    session.runningSince === null ? 0 : Math.max(0, now - session.runningSince);
  return Math.floor((session.accumulatedMs + runningMs) / 1000);
}

export function updateFocusTimer(
  record: FocusTimerRecord,
  command: FocusTimerCommand,
  now = Date.now(),
): FocusTimerRecord {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new FocusTimerError(
      "clock",
      "Confira a data e a hora do dispositivo.",
    );
  if (command.type === "reset") return initialFocusTimer(record.targetMinutes);
  if (record.session && now < record.session.updatedAt - 60000)
    throw new FocusTimerError(
      "clock",
      "O relógio do dispositivo voltou no tempo. Confira a hora antes de continuar.",
    );
  switch (command.type) {
    case "target": {
      if (record.session)
        throw new FocusTimerError(
          "active",
          "Conclua ou descarte o bloco antes de mudar sua duração.",
        );
      if (
        !Number.isInteger(command.minutes) ||
        command.minutes < 1 ||
        command.minutes > MAX_FOCUS_MINUTES
      )
        throw new FocusTimerError(
          "target",
          "Escolha uma duração de 1 a 480 minutos.",
        );
      return { ...record, targetMinutes: command.minutes };
    }
    case "start": {
      if (record.session)
        throw new FocusTimerError(
          "active",
          "Já existe um bloco em andamento. Ele foi carregado nesta tela.",
        );
      if (
        !command.id ||
        command.id.length > 80 ||
        !["project", "study"].includes(command.category)
      )
        throw new FocusTimerError(
          "invalid",
          "Não foi possível iniciar este bloco.",
        );
      return {
        ...record,
        session: {
          id: command.id,
          category: command.category,
          outcome: command.outcome.trim().slice(0, 240),
          startedAt: now,
          runningSince: now,
          accumulatedMs: 0,
          updatedAt: now,
        },
      };
    }
    case "pause": {
      if (!record.session || record.session.runningSince === null)
        return record;
      return {
        ...record,
        session: {
          ...record.session,
          accumulatedMs:
            record.session.accumulatedMs +
            Math.max(0, now - record.session.runningSince),
          runningSince: null,
          updatedAt: now,
        },
      };
    }
    case "resume": {
      if (!record.session || record.session.runningSince !== null)
        return record;
      return {
        ...record,
        session: { ...record.session, runningSince: now, updatedAt: now },
      };
    }
  }
}

export function prepareFocusCompletion(
  record: FocusTimerRecord,
  now = Date.now(),
  minutesOverride?: number,
): FocusCompletion {
  const session = record.session;
  if (!session)
    throw new FocusTimerError(
      "idle",
      "Este bloco já foi concluído ou descartado em outra aba.",
    );
  if (now < session.updatedAt - 60000)
    throw new FocusTimerError(
      "clock",
      "Confira a data e a hora do dispositivo antes de concluir.",
    );
  const measuredSeconds = focusElapsedSeconds(record, now);
  const measuredMinutes = Math.floor(measuredSeconds / 60);
  if (measuredMinutes < 1)
    throw new FocusTimerError(
      "too-short",
      "Espere um minuto completo para registrar este bloco.",
    );
  if (minutesOverride === undefined && measuredMinutes > MAX_FOCUS_MINUTES)
    throw new FocusTimerError(
      "too-long",
      "Este bloco ultrapassou 8 horas. Revise quanto tempo deseja registrar ou descarte-o.",
    );
  const minutes = minutesOverride ?? measuredMinutes;
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > MAX_FOCUS_MINUTES ||
    minutes > measuredMinutes
  )
    throw new FocusTimerError(
      "duration",
      "Informe de 1 a 480 minutos, sem ultrapassar o tempo medido.",
    );
  return {
    id: session.id,
    minutes,
    category: session.category,
    outcome: session.outcome,
    measuredSeconds,
    startedAt: new Date(session.startedAt).toISOString(),
    completedAt: new Date(now).toISOString(),
  };
}

function openTimerDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new FocusTimerError(
          "storage",
          "O navegador não permite guardar o cronômetro.",
        ),
      );
      return;
    }
    let settled = false;
    const request = indexedDB.open("kernelhub", 1);
    const timeout = setTimeout(() => {
      settled = true;
      reject(
        new FocusTimerError(
          "storage",
          "O armazenamento demorou a responder. Tente novamente.",
        ),
      );
    }, 5000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("records"))
        request.result.createObjectStore("records");
    };
    request.onerror = () => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(request.error);
      }
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function readFocusTimer(
  targetMinutes = 25,
): Promise<FocusTimerRecord> {
  const db = await openTimerDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction("records", "readonly");
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    const request = transaction.objectStore("records").get(FOCUS_TIMER_KEY);
    let record: FocusTimerRecord | null = null;
    request.onsuccess = () => {
      record =
        request.result === undefined
          ? initialFocusTimer(targetMinutes)
          : parseFocusTimer(request.result);
    };
    transaction.oncomplete = () => {
      db.close();
      if (record) resolve(record);
      else
        reject(
          new FocusTimerError(
            "invalid",
            "O cronômetro salvo não pôde ser lido. Descarte-o para começar novamente.",
          ),
        );
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

interface TimerMutationResult {
  record: FocusTimerRecord;
  completion: FocusCompletion | null;
}

export async function mutateFocusTimer(
  command: FocusTimerCommand | { type: "complete"; minutesOverride?: number },
  targetMinutes = 25,
): Promise<TimerMutationResult> {
  const db = await openTimerDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction("records", "readwrite");
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    const store = transaction.objectStore("records");
    const timerRequest = store.get(FOCUS_TIMER_KEY);
    const stateRequest =
      command.type === "complete" ? store.get(STORAGE_KEY) : null;
    let remaining = stateRequest ? 2 : 1;
    let result: TimerMutationResult;
    let failure: unknown;
    const apply = () => {
      if (--remaining !== 0) return;
      try {
        const current =
          timerRequest.result === undefined
            ? initialFocusTimer(targetMinutes)
            : parseFocusTimer(timerRequest.result);
        if (!current && command.type !== "reset")
          throw new FocusTimerError(
            "invalid",
            "O cronômetro salvo não pôde ser lido. Descarte-o para começar novamente.",
          );
        let record: FocusTimerRecord;
        let completion: FocusCompletion | null = null;
        if (command.type === "complete") {
          const now = Date.now();
          completion = prepareFocusCompletion(
            current!,
            now,
            command.minutesOverride,
          );
          const state = parseStoredState(
            typeof stateRequest!.result === "string"
              ? stateRequest!.result
              : null,
            new Date(now),
          );
          if (!state)
            throw new FocusTimerError(
              "workspace",
              "Abra seu espaço antes de registrar este bloco. O cronômetro foi mantido.",
            );
          const alreadyRecorded =
            state.focusSessions.some(
              (session) => session.id === completion!.id,
            ) || state.journal.some((entry) => entry.id === completion!.id);
          if (!alreadyRecorded) {
            const action: KernelAction = {
              type: "focus-add",
              minutes: completion.minutes,
              category: completion.category,
              outcome: completion.outcome,
              event: {
                id: completion.id,
                createdAt: completion.completedAt,
                day: localDay(new Date(now)),
              },
            };
            const next = kernelReducer(state, action);
            if (next === state)
              throw new FocusTimerError(
                "day-limit",
                "O limite de foco de hoje foi atingido. O cronômetro continua salvo para você revisar.",
              );
            const serialized = JSON.stringify(next);
            if (!parseStoredState(serialized, new Date(now)))
              throw new FocusTimerError(
                "state",
                "Não foi possível validar o registro. O cronômetro foi mantido.",
              );
            store.put(serialized, STORAGE_KEY);
          } else completion.alreadyRecorded = true;
          record = initialFocusTimer(current!.targetMinutes);
        } else
          record = updateFocusTimer(
            current ?? initialFocusTimer(targetMinutes),
            command,
          );
        const serializedTimer = JSON.stringify(record);
        if (!parseFocusTimer(serializedTimer))
          throw new FocusTimerError(
            "state",
            "Não foi possível guardar este cronômetro.",
          );
        store.put(serializedTimer, FOCUS_TIMER_KEY);
        result = { record, completion };
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    timerRequest.onsuccess = apply;
    if (stateRequest) stateRequest.onsuccess = apply;
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
    transaction.onabort = () => {
      db.close();
      reject(
        failure ??
          transaction.error ??
          new FocusTimerError(
            "storage",
            "Não foi possível guardar o cronômetro.",
          ),
      );
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
  });
}
