"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  automaticPeriod,
  boundaryKey,
  initialSkincareSettings,
  makeDayLog,
  nextSkincareBoundary,
  skincareDay,
  type CheckStatus,
  type Period,
} from "./skincare";
import {
  mutateSkincare,
  prepareSkincarePhoto,
  readSkincarePhoto,
  readSkincareRevision,
  readSkincareSnapshot,
  SKINCARE_CHANNEL,
  type ProductInput,
  type SkincareMutation,
  type SkincareSnapshot,
} from "./skincare-storage";

const VIEW_KEY = "kernelhub:skincare:view:v1";
const VIEW_EVENT = "kernelhub:skincare:view";
interface ManualView {
  period: Period;
  boundary: string;
}

function readManual(): ManualView | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw || raw.length > 200) return null;
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === "object" &&
      data !== null &&
      "period" in data &&
      (data.period === "am" || data.period === "pm") &&
      "boundary" in data &&
      typeof data.boundary === "string"
    )
      return { period: data.period, boundary: data.boundary };
  } catch {
    /* The view still works when session storage is unavailable. */
  }
  return null;
}
function writeManual(value: ManualView | null) {
  try {
    if (value) sessionStorage.setItem(VIEW_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(VIEW_KEY);
  } catch {
    /* A view preference does not gate local skincare records. */
  }
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: value }));
}
function announce() {
  try {
    if (typeof BroadcastChannel !== "function") return;
    const channel = new BroadcastChannel(SKINCARE_CHANNEL);
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* The database transaction remains authoritative. */
  }
}
function initialSnapshot(): SkincareSnapshot {
  const settings = initialSkincareSettings();
  // Deterministic first render; the local date is resolved after hydration.
  return {
    settings,
    today: makeDayLog(settings, new Date(2026, 9, 22, 12)),
    history: [],
    photos: [],
    revision: null,
  };
}

export function useSkincare(options: { history?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => new Date(2026, 9, 22, 12));
  const [override, setOverride] = useState<ManualView | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const snapshotRef = useRef(snapshot);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const includeHistory = useRef(options.history !== false);

  const accept = useCallback((saved: SkincareSnapshot) => {
    snapshotRef.current = saved;
    if (!mounted.current) return;
    setSnapshot(saved);
    setNow(new Date());
    setError(null);
  }, []);
  const refresh = useCallback(() => {
    const task = queue.current.then(async () => {
      try {
        accept(await readSkincareSnapshot(new Date(), includeHistory.current));
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível abrir seu armário.",
          );
      } finally {
        if (mounted.current) setHydrated(true);
      }
    });
    queue.current = task.catch(() => {});
    return task;
  }, [accept]);

  const change = useCallback(
    (command: SkincareMutation, at = new Date()): Promise<boolean> => {
      pending.current++;
      if (mounted.current) setBusy(true);
      const task = queue.current.then(async () => {
        try {
          await mutateSkincare(command, at);
          // Notify immediately after the confirmed commit, even if this sheet was
          // closed while its write was in progress.
          announce();
          try {
            accept(
              await readSkincareSnapshot(new Date(), includeHistory.current),
            );
          } catch {
            if (mounted.current)
              setError(
                "A alteração foi salva, mas não foi possível atualizar a visualização. Tente recarregar o armário.",
              );
          }
          try {
            if (typeof navigator.vibrate === "function") navigator.vibrate(8);
          } catch {
            /* Optional haptics. */
          }
          return true;
        } catch (cause) {
          if (mounted.current)
            setError(
              cause instanceof Error
                ? cause.message
                : "O navegador não confirmou a gravação. A alteração não foi salva.",
            );
          return false;
        } finally {
          pending.current--;
          if (mounted.current) setBusy(pending.current > 0);
        }
      });
      queue.current = task.then(
        () => {},
        () => {},
      );
      return task;
    },
    [accept],
  );

  useEffect(() => {
    mounted.current = true;
    setOverride(readManual());
    setNow(new Date());
    void refresh();
    let channel: BroadcastChannel | undefined;
    try {
      if (typeof BroadcastChannel === "function") {
        channel = new BroadcastChannel(SKINCARE_CHANNEL);
        channel.onmessage = () => {
          void refresh();
        };
      }
    } catch {
      /* Foreground/revision checks keep tabs consistent as fallback. */
    }
    const viewChanged = (event: Event) => {
      const view: unknown = (event as CustomEvent).detail;
      if (
        view === null ||
        (typeof view === "object" &&
          view !== null &&
          "period" in view &&
          (view.period === "am" || view.period === "pm") &&
          "boundary" in view &&
          typeof view.boundary === "string")
      ) {
        setOverride(view as ManualView | null);
        setNow(new Date());
      }
    };
    window.addEventListener(VIEW_EVENT, viewChanged);
    const foreground = () => {
      if (document.visibilityState === "hidden") return;
      setNow(new Date());
      void refresh();
    };
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const date = new Date();
      setNow(date);
      if (skincareDay(date) !== snapshotRef.current.today.day) {
        void refresh();
        return;
      }
      void readSkincareRevision()
        .then((revision) => {
          if (mounted.current && revision !== snapshotRef.current.revision)
            void refresh();
        })
        .catch(() => {
          /* Explicit actions/foreground surface storage failures. */
        });
    }, 30000);
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("focus", foreground);
    window.addEventListener("pageshow", foreground);
    return () => {
      mounted.current = false;
      channel?.close();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      window.removeEventListener(VIEW_EVENT, viewChanged);
    };
  }, [refresh]);

  const historyEnabled = options.history !== false;
  useEffect(() => {
    if (includeHistory.current === historyEnabled) return;
    includeHistory.current = historyEnabled;
    void refresh();
  }, [historyEnabled, refresh]);

  const transition = snapshot.settings.transitionMinute;
  const boundary = boundaryKey(now, transition);
  const manual = hydrated && override?.boundary === boundary;
  const period = manual ? override.period : automaticPeriod(now, transition);
  useEffect(() => {
    if (hydrated && override && override.boundary !== boundary) {
      setOverride(null);
      writeManual(null);
    }
  }, [hydrated, override, boundary]);
  useEffect(() => {
    if (!hydrated || document.visibilityState === "hidden") return;
    const current = new Date();
    const next = nextSkincareBoundary(current, transition);
    const timer = setTimeout(
      () => {
        setNow(new Date());
        void refresh();
      },
      Math.max(1, next.getTime() - current.getTime()),
    );
    return () => clearTimeout(timer);
  }, [hydrated, now, transition, refresh]);

  const setPeriod = useCallback((value: Period | "auto") => {
    const date = new Date();
    const view =
      value === "auto"
        ? null
        : {
            period: value,
            boundary: boundaryKey(
              date,
              snapshotRef.current.settings.transitionMinute,
            ),
          };
    setOverride(view);
    writeManual(view);
    setNow(date);
  }, []);
  const saveProduct = useCallback(
    (product: ProductInput) => change({ type: "product-save", product }),
    [change],
  );
  const archiveProduct = useCallback(
    (id: string) => change({ type: "product-archive", id }),
    [change],
  );
  const reorder = useCallback(
    (value: Period, productIds: string[]) =>
      change({ type: "reorder", period: value, productIds }),
    [change],
  );
  const updateTransition = useCallback(
    async (minute: number) => {
      const saved = await change({ type: "transition", minute });
      if (saved) {
        setOverride(null);
        writeManual(null);
        setNow(new Date());
      }
      return saved;
    },
    [change],
  );
  const setCheck = useCallback(
    (input: {
      day?: string;
      period: Period;
      productId: string;
      status: CheckStatus;
      reason?: string;
    }) => {
      const at = new Date();
      return change(
        { type: "check", ...input, day: input.day ?? skincareDay(at) },
        at,
      );
    },
    [change],
  );
  const markPendingUsed = useCallback(
    (period: Period) => {
      const at = new Date();
      return change(
        { type: "check-pending", day: skincareDay(at), period },
        at,
      );
    },
    [change],
  );
  const addPhoto = useCallback(
    async (blob: Blob, day: string, note = "") => {
      try {
        const prepared = await prepareSkincarePhoto(blob, day, note);
        return await change({ type: "photo-add", ...prepared });
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "A foto não pôde ser salva.",
          );
        return false;
      }
    },
    [change],
  );
  const removePhoto = useCallback(
    (id: string) => change({ type: "photo-remove", id }),
    [change],
  );
  const getPhoto = useCallback((id: string) => readSkincarePhoto(id), []);
  const visibleDay = skincareDay(now);
  // The exact boundary clock can advance before its database refresh resolves.
  // Never paint yesterday's checks under today's AM label in that interval.
  const today =
    snapshot.today.day === visibleDay
      ? snapshot.today
      : makeDayLog(snapshot.settings, now);
  return {
    settings: snapshot.settings,
    today,
    history: snapshot.history,
    photos: snapshot.photos,
    period,
    day: visibleDay,
    manual,
    hydrated,
    busy,
    error,
    setPeriod,
    saveProduct,
    archiveProduct,
    reorder,
    updateTransition,
    setCheck,
    markPendingUsed,
    addPhoto,
    removePhoto,
    getPhoto,
    refresh,
  };
}
export type SkincareController = ReturnType<typeof useSkincare>;
