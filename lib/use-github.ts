"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGithubSnapshot,
  GITHUB_FRESH_MS,
  GitHubError,
  normalizeGithubUsername,
  parseGithubCache,
  summarizeGithubEvents,
  type GitHubSnapshot,
  type GitHubStatus,
} from "./github";

const DATABASE = "kernelhub-integrations";
const STORE = "github";
const KEY = "connection";
const REVISION_KEY = "revision";
const CHANNEL = "kernelhub:github";
const REFRESH_MS = 10 * 60 * 1000;
type Connection = { username: string; snapshot: GitHubSnapshot | null };
type StoredConnection = {
  connection: Connection | null;
  revision: string | null;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DATABASE, 1);
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error("Integration storage unavailable"));
    }, 5000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(request.error);
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
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
function parseRecord(value: unknown): Connection | null {
  if (typeof value !== "string" || value.length > 1024 * 1024) return null;
  try {
    return parseGithubCache(JSON.parse(value));
  } catch {
    return null;
  }
}
async function readConnection(): Promise<StoredConnection> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const request = store.get(KEY);
    const revision = store.get(REVISION_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve({
        connection: parseRecord(request.result),
        revision: typeof revision.result === "string" ? revision.result : null,
      });
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
async function writeConnection(
  connection: Connection | null,
  isCurrent: () => boolean,
  expectedRevision?: string | null,
): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const current = store.get(REVISION_KEY);
    let saved = false;
    current.onsuccess = () => {
      const revision =
        typeof current.result === "string" ? current.result : null;
      // The revision also changes on disconnect, so even disconnecting and
      // reconnecting the same profile invalidates an older request.
      if (
        !isCurrent() ||
        (expectedRevision !== undefined && revision !== expectedRevision)
      )
        return;
      if (connection) store.put(JSON.stringify(connection), KEY);
      else store.delete(KEY);
      store.put(crypto.randomUUID(), REVISION_KEY);
      saved = true;
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(saved);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export function useGithub() {
  const [username, setUsername] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GitHubSnapshot | null>(null);
  const [status, setStatus] = useState<GitHubStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const usernameRef = useRef<string | null>(null);
  const snapshotRef = useRef<GitHubSnapshot | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const configurationRevision = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const nextAllowed = useRef(0);
  const lastAttempt = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const loadLatest = useRef<() => Promise<void>>(async () => {});

  const notify = useCallback(() => {
    try {
      channel.current?.postMessage("changed");
    } catch {
      /* Notification failure cannot undo a saved connection. */
    }
  }, []);
  const adopt = useCallback((connection: Connection | null) => {
    usernameRef.current = connection?.username ?? null;
    snapshotRef.current = connection?.snapshot ?? null;
    setUsername(usernameRef.current);
    setSnapshot(snapshotRef.current);
    setError(null);
    const age = connection?.snapshot
      ? Date.now() - new Date(connection.snapshot.syncedAt).getTime()
      : Infinity;
    setStatus(
      connection?.snapshot
        ? age <= GITHUB_FRESH_MS
          ? "live"
          : "stale"
        : "idle",
    );
  }, []);

  const performSync = useCallback(
    async (target: string, changingProfile = false): Promise<boolean> => {
      if (!mounted.current) return false;
      if (
        Date.now() < nextAllowed.current ||
        Date.now() - lastAttempt.current < 60000
      ) {
        setError(
          "Aguarde antes de sincronizar novamente para respeitar o limite de consultas do GitHub.",
        );
        return false;
      }
      lastAttempt.current = Date.now();
      const id = ++requestId.current;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setStatus("loading");
      setError(null);
      const isCurrent = () => mounted.current && id === requestId.current;
      try {
        let previous: StoredConnection | null = null;
        try {
          previous = await readConnection();
          if (isCurrent()) setStorageError(false);
        } catch {
          if (isCurrent()) setStorageError(true);
        }
        if (!isCurrent()) return false;
        if (
          !changingProfile &&
          previous &&
          previous.connection?.username.toLowerCase() !== target.toLowerCase()
        ) {
          adopt(previous.connection);
          return false;
        }
        const fresh = await fetchGithubSnapshot(target, {
          signal: controller.signal,
        });
        if (
          !isCurrent() ||
          (!changingProfile &&
            usernameRef.current?.toLowerCase() !== target.toLowerCase())
        )
          return false;
        let saved = true;
        let persisted = false;
        if (previous) {
          try {
            saved = await writeConnection(
              { username: fresh.username, snapshot: fresh },
              isCurrent,
              previous.revision,
            );
            persisted = saved;
            if (isCurrent()) setStorageError(false);
          } catch {
            // The live connection remains useful in this session if storage is blocked.
            if (isCurrent()) setStorageError(true);
          }
        }
        if (!isCurrent()) return false;
        if (!saved) {
          await loadLatest.current();
          return false;
        }
        usernameRef.current = fresh.username;
        snapshotRef.current = fresh;
        setUsername(fresh.username);
        setSnapshot(fresh);
        setStatus("live");
        setError(null);
        nextAllowed.current = 0;
        if (persisted) notify();
        return true;
      } catch (failure) {
        if (!mounted.current || id !== requestId.current) return false;
        const issue = failure instanceof GitHubError ? failure : null;
        setError(
          issue?.message ?? "Não foi possível sincronizar o GitHub agora.",
        );
        setStatus(snapshotRef.current ? "stale" : "error");
        if (issue?.code === "rate-limit")
          nextAllowed.current = issue.retryAt
            ? new Date(issue.retryAt).getTime()
            : Date.now() + 60000;
        return false;
      } finally {
        if (id === requestId.current) inFlight.current = null;
      }
    },
    [adopt, notify],
  );

  const connect = useCallback(
    async (value: string): Promise<boolean> => {
      const target = normalizeGithubUsername(value);
      if (!target) {
        setError("Informe um usuário GitHub válido, com até 39 caracteres.");
        return false;
      }
      if (usernameRef.current?.toLowerCase() === target.toLowerCase())
        return performSync(target);
      ++configurationRevision.current;
      // Keep the previous profile and its last valid data until the new one
      // has been fetched, validated and accepted by the storage transaction.
      return performSync(target, true);
    },
    [performSync],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    ++configurationRevision.current;
    const id = ++requestId.current;
    inFlight.current?.abort();
    inFlight.current = null;
    adopt(null);
    try {
      const saved = await writeConnection(
        null,
        () => mounted.current && id === requestId.current,
      );
      if (mounted.current && id === requestId.current) setStorageError(false);
      if (saved) notify();
    } catch {
      if (mounted.current && id === requestId.current) setStorageError(true);
    }
  }, [adopt, notify]);

  const sync = useCallback(async (): Promise<boolean> => {
    return usernameRef.current ? performSync(usernameRef.current) : false;
  }, [performSync]);

  useEffect(() => {
    mounted.current = true;
    let generation = 0;
    const load = async () => {
      const current = ++generation;
      const configuration = configurationRevision.current;
      try {
        const { connection } = await readConnection();
        if (
          !mounted.current ||
          current !== generation ||
          configuration !== configurationRevision.current
        )
          return;
        ++requestId.current;
        inFlight.current?.abort();
        inFlight.current = null;
        adopt(connection);
        setStorageError(false);
        const age = connection?.snapshot
          ? Date.now() - new Date(connection.snapshot.syncedAt).getTime()
          : Infinity;
        if (
          connection &&
          age >=
            Math.max(
              REFRESH_MS,
              (connection.snapshot?.pollIntervalSeconds ?? 600) * 1000,
            ) &&
          document.visibilityState === "visible"
        )
          void performSync(connection.username);
      } catch {
        if (mounted.current) setStorageError(true);
      } finally {
        if (mounted.current) setHydrated(true);
      }
    };
    loadLatest.current = load;
    if (typeof BroadcastChannel === "function") {
      const updates = new BroadcastChannel(CHANNEL);
      channel.current = updates;
      updates.onmessage = () => {
        void load();
      };
    }
    void load();
    const rebaseDate = () => {
      const current = snapshotRef.current;
      if (!current || document.visibilityState !== "visible") return;
      const date = new Date();
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (current.statisticsToday.day !== day) {
        const rebased = {
          ...current,
          ...summarizeGithubEvents(current.events, date),
        };
        snapshotRef.current = rebased;
        setSnapshot(rebased);
      }
    };
    const refresh = () => {
      rebaseDate();
      const name = usernameRef.current;
      if (!name || document.visibilityState !== "visible" || inFlight.current)
        return;
      const age = snapshotRef.current
        ? Date.now() - new Date(snapshotRef.current.syncedAt).getTime()
        : Infinity;
      const cadence = Math.max(
        REFRESH_MS,
        (snapshotRef.current?.pollIntervalSeconds ?? 600) * 1000,
      );
      if (age >= cadence && Date.now() - lastAttempt.current >= 60000)
        void performSync(name);
    };
    const timer = setInterval(refresh, REFRESH_MS);
    const dateTimer = setInterval(rebaseDate, 60000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    const offline = () => {
      if (snapshotRef.current) setStatus("stale");
    };
    window.addEventListener("offline", offline);
    return () => {
      mounted.current = false;
      ++generation;
      ++requestId.current;
      inFlight.current?.abort();
      inFlight.current = null;
      clearInterval(timer);
      clearInterval(dateTimer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      channel.current?.close();
      channel.current = null;
    };
  }, [adopt, performSync]);

  return {
    username,
    snapshot,
    status,
    error,
    storageError,
    hydrated,
    sync,
    connect,
    disconnect,
  };
}
