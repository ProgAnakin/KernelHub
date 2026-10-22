"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState } from "./mock-engine";
import { kernelReducer, parseStoredState, STORAGE_KEY } from "./state";
import type { KernelAction } from "@/types/kernel";

export function useKernel() {
  const [state, dispatch] = useReducer(kernelReducer, undefined, () =>
    createInitialState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const canPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = parseStoredState(raw);
      if (saved) dispatch({ type: "restore", state: saved });
      else if (raw) {
        canPersist.current = false;
        localStorage.setItem(`${STORAGE_KEY}:recovery`, raw);
        canPersist.current = true;
        setRecoveryAvailable(true);
      }
    } catch {
      setStorageError(true);
    }
    setHydrated(true);
    const rollover = window.setInterval(
      () => dispatch({ type: "rollover" }),
      30000,
    );
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const saved = parseStoredState(event.newValue);
      if (saved) dispatch({ type: "restore", state: saved });
    };
    window.addEventListener("storage", sync);
    const foreground = () => {
      if (document.visibilityState === "visible")
        dispatch({ type: "rollover" });
    };
    document.addEventListener("visibilitychange", foreground);
    return () => {
      clearInterval(rollover);
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !canPersist.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state, hydrated]);

  const act = useCallback((action: KernelAction) => {
    dispatch(action);
    // Safari on iOS does not implement vibration. Visual feedback always accompanies it.
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate(8);
    } catch {
      /* Feedback is always visual; haptics is optional. */
    }
  }, []);

  return { state, act, hydrated, storageError, recoveryAvailable };
}
