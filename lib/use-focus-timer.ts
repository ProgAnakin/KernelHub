"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEY } from "./state";
import {
  FOCUS_TIMER_CHANNEL,
  focusElapsedSeconds,
  initialFocusTimer,
  mutateFocusTimer,
  readFocusTimer,
  timerStatus,
  type FocusCategory,
  type FocusCompletion,
  type FocusTimerCommand,
  type FocusTimerRecord,
} from "./focus-timer";

function notify(channelName: string) {
  try {
    if (typeof BroadcastChannel !== "function") return;
    const updates = new BroadcastChannel(channelName);
    updates.postMessage("changed");
    updates.close();
  } catch {
    /* Notifications never undo a committed transaction. */
  }
}

export function useFocusTimer(options: { targetMinutes?: number } = {}) {
  const initialTarget = options.targetMinutes ?? 25;
  const [record, setRecord] = useState<FocusTimerRecord>(() =>
    initialFocusTimer(initialTarget),
  );
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const initialTargetRef = useRef(initialTarget);

  const refresh = useCallback(() => {
    const task = queue.current.then(async () => {
      try {
        const saved = await readFocusTimer(initialTargetRef.current);
        if (mounted.current) {
          setRecord(saved);
          setNow(Date.now());
          setError("");
        }
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível recuperar o cronômetro.",
          );
      } finally {
        if (mounted.current) setHydrated(true);
      }
    });
    queue.current = task.catch(() => {});
    return task;
  }, []);

  const change = useCallback(
    (
      command:
        FocusTimerCommand | { type: "complete"; minutesOverride?: number },
    ) => {
      pending.current++;
      if (mounted.current) setBusy(true);
      const task = queue.current.then(
        async (): Promise<{
          ok: boolean;
          completion: FocusCompletion | null;
        }> => {
          try {
            const result = await mutateFocusTimer(
              command,
              initialTargetRef.current,
            );
            if (mounted.current) {
              setRecord(result.record);
              setNow(Date.now());
              setError("");
            }
            if (typeof navigator.vibrate === "function") navigator.vibrate(8);
            notify(FOCUS_TIMER_CHANNEL);
            if (result.completion) notify(STORAGE_KEY);
            return { ok: true, completion: result.completion };
          } catch (cause) {
            if (mounted.current)
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível guardar o cronômetro. Seu bloco foi mantido.",
              );
            // A command may race with another tab's completion. Reload its canonical
            // state instead of leaving a consumed block visible in this tab.
            try {
              const saved = await readFocusTimer(initialTargetRef.current);
              if (mounted.current) {
                setRecord(saved);
                setNow(Date.now());
              }
            } catch {
              /* Preserve the last displayed timer when storage is blocked. */
            }
            return { ok: false, completion: null };
          } finally {
            pending.current--;
            if (mounted.current) setBusy(pending.current > 0);
          }
        },
      );
      queue.current = task.then(
        () => {},
        () => {},
      );
      return task;
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    void refresh();
    let channel: BroadcastChannel | undefined;
    try {
      if (typeof BroadcastChannel === "function") {
        channel = new BroadcastChannel(FOCUS_TIMER_CHANNEL);
        channel.onmessage = () => {
          void refresh();
        };
      }
    } catch {
      /* Foreground refresh remains available without notifications. */
    }
    const visibility = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      void refresh();
    };
    visibility();
    // Even without BroadcastChannel, two open tabs converge on a lightweight
    // read while visible. The database, not these notifications, owns the timer.
    const sync = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      clearInterval(sync);
      channel?.close();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);

  const running = timerStatus(record) === "running";
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (running) timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  const start = useCallback(
    async (category: FocusCategory, outcome = "") => {
      const result = await change({
        type: "start",
        id: crypto.randomUUID(),
        category,
        outcome,
      });
      return result.ok;
    },
    [change],
  );
  const pause = useCallback(
    async () => (await change({ type: "pause" })).ok,
    [change],
  );
  const resume = useCallback(
    async () => (await change({ type: "resume" })).ok,
    [change],
  );
  const reset = useCallback(
    async () => (await change({ type: "reset" })).ok,
    [change],
  );
  const setTargetMinutes = useCallback(
    async (minutes: number) => (await change({ type: "target", minutes })).ok,
    [change],
  );
  const complete = useCallback(
    async (minutesOverride?: number) =>
      (await change({ type: "complete", minutesOverride })).completion,
    [change],
  );

  return {
    status: timerStatus(record),
    elapsedSeconds: focusElapsedSeconds(record, now),
    targetMinutes: record.targetMinutes,
    category: record.session?.category ?? null,
    outcome: record.session?.outcome ?? "",
    startedAt: record.session?.startedAt ?? null,
    hydrated,
    busy,
    error,
    start,
    pause,
    resume,
    complete,
    reset,
    setTargetMinutes,
  };
}
