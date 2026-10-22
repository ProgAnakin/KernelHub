"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialState } from "./mock-engine";
import { kernelReducer, STORAGE_KEY } from "./state";
import { transactStoredState } from "./storage";
import type { KernelAction, KernelState } from "@/types/kernel";

export function useKernel() {
  // Exported HTML and the first browser render must agree across dates/zones.
  const [state, setState] = useState<KernelState>(() =>
    createInitialState(new Date(2026, 9, 22, 12)),
  );
  const stateRef = useRef(state);
  const committed = useRef(state);
  const pending = useRef<KernelAction[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const ready = useRef(false);
  const [storageError, setStorageError] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const queue = useRef(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);

  const transact = useCallback((action?: KernelAction) => {
    const run = async () => {
      if (action) pending.current.push(action);
      let next: KernelState;
      try {
        // The read and every pending action share one IndexedDB transaction.
        // Retried actions retain their identity, including removals by ID.
        const result = await transactStoredState(
          committed.current,
          pending.current,
        );
        next = result.state;
        committed.current = next;
        pending.current = [];
        setRecoveryAvailable(result.recoveryAvailable);
        setStorageError(false);
        if (result.changed) {
          try {
            channel.current?.postMessage("changed");
          } catch {
            // A closed notification channel must not roll back a committed action.
          }
        }
      } catch {
        next = action
          ? kernelReducer(stateRef.current, action)
          : ready.current
            ? stateRef.current
            : committed.current;
        setStorageError(true);
      }
      if (JSON.stringify(stateRef.current) !== JSON.stringify(next)) {
        stateRef.current = next;
        setState(next);
      }
    };
    queue.current = queue.current.then(run).catch(() => setStorageError(true));
    return queue.current;
  }, []);

  useEffect(() => {
    let mounted = true;
    committed.current = createInitialState();
    if (typeof BroadcastChannel === "function") {
      const updates = new BroadcastChannel(STORAGE_KEY);
      channel.current = updates;
      updates.onmessage = () => {
        void transact();
      };
    }
    void transact().then(() => {
      if (!mounted) return;
      ready.current = true;
      setHydrated(true);
    });
    const rollover = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void transact({ type: "rollover" });
    }, 30000);
    const foreground = () => {
      if (document.visibilityState === "visible")
        void transact({ type: "rollover" });
    };
    document.addEventListener("visibilitychange", foreground);
    return () => {
      mounted = false;
      ready.current = false;
      channel.current?.close();
      channel.current = null;
      clearInterval(rollover);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [transact]);

  const act = useCallback(
    (action: KernelAction) => {
      if (!ready.current) return;
      void transact({
        ...action,
        event: { id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      });
      try {
        if (typeof navigator.vibrate === "function") navigator.vibrate(8);
      } catch {
        /* Haptics is optional; every action also has visual feedback. */
      }
    },
    [transact],
  );

  return { state, act, hydrated, storageError, recoveryAvailable };
}
