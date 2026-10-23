"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_HEALTH_XML_BYTES,
  parseCachedHealthSnapshot,
  type HealthSnapshot,
} from "./health";
import type { HealthWorkerRequest } from "./health.worker";

export type HealthStatus = "idle" | "importing" | "ready" | "error";
const DB_NAME = "kernelhub-health";
const STORE = "snapshots";
const KEY = "latest";
const REVISION_KEY = "revision";
const WORKER_ERROR =
  "O navegador bloqueou o importador local. Recarregue o app e tente novamente com os recursos do site permitidos.";

interface PendingImport {
  requestId: number;
  resolve: (snapshot: HealthSnapshot) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type HealthRevision = string | null;
interface StoredHealth {
  raw: unknown;
  revision: HealthRevision;
}
type HealthWrite =
  | { status: "saved"; revision: string }
  | { status: "stale" }
  | { status: "conflict" };

function storedRevision(value: unknown): HealthRevision {
  // Existing installations have no revision until their first write/delete.
  if (value === undefined) return null;
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("A revisão dos dados de saúde está incompatível.");
  return value;
}

function snapshotFromStorage(raw: unknown): HealthSnapshot | null {
  if (raw === undefined) return null;
  const snapshot =
    typeof raw === "string" ? parseCachedHealthSnapshot(raw) : null;
  if (!snapshot)
    throw new Error(
      "Os dados de saúde salvos estão incompatíveis. Importe novamente o XML original.",
    );
  return snapshot;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Este navegador não oferece armazenamento local para a importação.",
        ),
      );
      return;
    }
    let settled = false;
    const request = indexedDB.open(DB_NAME, 1);
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error("O armazenamento local não respondeu."));
    }, 5000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(
          new Error(
            "Não foi possível abrir os dados de saúde neste navegador.",
          ),
        );
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function readStoredHealth(): Promise<StoredHealth> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let request: IDBRequest;
    let revision: IDBRequest;
    try {
      transaction = database.transaction(STORE, "readonly");
      request = transaction.objectStore(STORE).get(KEY);
      revision = transaction.objectStore(STORE).get(REVISION_KEY);
    } catch {
      database.close();
      reject(new Error("Não foi possível ler os dados de saúde."));
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      try {
        resolve({
          raw: request.result,
          revision: storedRevision(revision.result),
        });
      } catch (cause) {
        reject(cause);
      }
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error("Não foi possível ler os dados de saúde."));
    };
  });
}

async function saveSnapshot(
  snapshot: HealthSnapshot | null,
  current: () => boolean,
  expectedRevision?: HealthRevision,
): Promise<HealthWrite> {
  const database = await openDatabase();
  if (!current()) {
    database.close();
    return { status: "stale" };
  }
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let result: HealthWrite | null = null;
    let failed: Error | null = null;
    try {
      transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const revision = store.get(REVISION_KEY);
      revision.onsuccess = () => {
        try {
          if (!current()) {
            result = { status: "stale" };
            transaction.abort();
            return;
          }
          if (
            expectedRevision !== undefined &&
            storedRevision(revision.result) !== expectedRevision
          ) {
            result = { status: "conflict" };
            transaction.abort();
            return;
          }
          const nextRevision = crypto.randomUUID();
          if (snapshot) store.put(JSON.stringify(snapshot), KEY);
          else store.delete(KEY);
          // Retain this tombstone after deletion, so an older import cannot revive it.
          store.put(nextRevision, REVISION_KEY);
          result = { status: "saved", revision: nextRevision };
        } catch (cause) {
          failed =
            cause instanceof Error
              ? cause
              : new Error("Não foi possível atualizar os dados de saúde.");
          transaction.abort();
        }
      };
    } catch {
      database.close();
      reject(new Error("Não foi possível atualizar o armazenamento de saúde."));
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      if (result) resolve(result);
      else reject(new Error("O navegador não confirmou a gravação de saúde."));
    };
    transaction.onabort = () => {
      database.close();
      if (!failed && result && result.status !== "saved") {
        resolve(result);
        return;
      }
      reject(
        failed ??
          new Error(
            "O navegador não confirmou a gravação. Os dados anteriores foram mantidos.",
          ),
      );
    };
  });
}

/** Local file import, never a claimed HealthKit/background connection. */
export function useHealth() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [status, setStatus] = useState<HealthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const mounted = useRef(false);
  const importing = useRef(false);
  const revision = useRef<HealthRevision | undefined>(undefined);
  const worker = useRef<Worker | null>(null);
  const pending = useRef<PendingImport | null>(null);

  const stopWorker = useCallback((message: string) => {
    worker.current?.terminate();
    worker.current = null;
    if (pending.current) {
      const active = pending.current;
      pending.current = null;
      clearTimeout(active.timer);
      active.reject(new Error(message));
    }
  }, []);

  const ensureWorker = useCallback(() => {
    if (worker.current) return worker.current;
    let instance: Worker;
    try {
      instance = new Worker(new URL("./health.worker.ts", import.meta.url), {
        name: "kernelhub-health-import",
      });
    } catch {
      throw new Error(WORKER_ERROR);
    }
    worker.current = instance;
    instance.onerror = (event) => {
      event.preventDefault();
      if (worker.current === instance) stopWorker(WORKER_ERROR);
    };
    instance.onmessageerror = () => {
      if (worker.current === instance)
        stopWorker("A resposta do importador local não pôde ser lida.");
    };
    instance.onmessage = (event: MessageEvent<unknown>) => {
      const active = pending.current;
      if (!active || worker.current !== instance) return;
      const data = event.data;
      if (
        typeof data !== "object" ||
        data === null ||
        !("requestId" in data) ||
        data.requestId !== active.requestId
      )
        return;
      if (
        Object.keys(data).length !== 4 ||
        !("version" in data) ||
        data.version !== 1 ||
        !("type" in data)
      ) {
        stopWorker("A resposta do importador local está inválida.");
        return;
      }
      if (
        data.type === "error" &&
        "message" in data &&
        typeof data.message === "string" &&
        data.message.trim().length > 0 &&
        data.message.length <= 240
      ) {
        stopWorker(data.message);
        return;
      }
      let snapshot: HealthSnapshot | null = null;
      if (data.type === "result" && "snapshot" in data) {
        try {
          snapshot = parseCachedHealthSnapshot(JSON.stringify(data.snapshot));
        } catch {
          // A malformed or cyclic response is rejected below.
        }
      }
      if (!snapshot) {
        stopWorker(
          "O importador devolveu dados incompatíveis. Tente novamente.",
        );
        return;
      }
      pending.current = null;
      clearTimeout(active.timer);
      active.resolve(snapshot);
    };
    return instance;
  }, [stopWorker]);

  const parseInWorker = useCallback(
    (xml: string, request: number) =>
      new Promise<HealthSnapshot>((resolve, reject) => {
        const instance = ensureWorker();
        const timer = setTimeout(() => {
          if (pending.current?.requestId === request)
            stopWorker("A importação demorou demais. Tente um XML menor.");
        }, 30000);
        pending.current = { requestId: request, resolve, reject, timer };
        const message: HealthWorkerRequest = {
          version: 1,
          type: "parse",
          requestId: request,
          xml,
        };
        try {
          instance.postMessage(message);
        } catch {
          stopWorker(WORKER_ERROR);
        }
      }),
    [ensureWorker, stopWorker],
  );

  useEffect(() => {
    mounted.current = true;
    const warmWorker = () => {
      if (!mounted.current || pending.current) return;
      try {
        ensureWorker();
      } catch {
        // Show a useful error only when the user actually imports a file.
      }
    };
    warmWorker();
    // Re-request the worker module after SW activation so it can be cached offline.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then(() => {
          if (!mounted.current || pending.current) return;
          stopWorker("A importação foi cancelada.");
          warmWorker();
        })
        .catch(() => {
          // Importing still works online when service worker activation fails.
        });
    }
    const load = async () => {
      if (importing.current) return;
      const request = requestId.current;
      try {
        const saved = await readStoredHealth();
        if (
          !mounted.current ||
          importing.current ||
          request !== requestId.current
        )
          return;
        revision.current = saved.revision;
        const canonical = snapshotFromStorage(saved.raw);
        setSnapshot(canonical);
        setStatus(canonical ? "ready" : "idle");
        setError(null);
      } catch (cause) {
        if (!mounted.current || request !== requestId.current) return;
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível ler os dados de saúde.",
        );
      }
    };
    void load();
    if (typeof BroadcastChannel === "function") {
      try {
        const updates = new BroadcastChannel(DB_NAME);
        channel.current = updates;
        updates.onmessage = (event: MessageEvent<unknown>) => {
          if (event.data !== "changed") return;
          requestId.current++;
          importing.current = false;
          stopWorker("Os dados de saúde foram alterados em outra aba.");
          void load();
        };
      } catch {
        // Local persistence remains usable when cross-tab messaging is blocked.
      }
    }
    return () => {
      mounted.current = false;
      requestId.current++;
      channel.current?.close();
      channel.current = null;
      stopWorker("A importação foi cancelada.");
    };
  }, [ensureWorker, stopWorker]);

  const notify = useCallback(() => {
    try {
      channel.current?.postMessage("changed");
    } catch {
      /* A notification failure never rolls back a committed file. */
    }
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      const request = ++requestId.current;
      const knownRevision = revision.current;
      if (pending.current) stopWorker("A importação foi substituída.");
      importing.current = true;
      setStatus("importing");
      setError(null);
      try {
        if (!/\.xml$/i.test(file.name))
          throw new Error(
            "Selecione export.xml. Se recebeu um ZIP, descompacte-o primeiro no app Arquivos.",
          );
        if (file.size > MAX_HEALTH_XML_BYTES)
          throw new Error(
            "Selecione um export.xml de até 12 MB. Arquivos maiores precisam de um importador dedicado.",
          );
        // Capture the baseline before reading/parsing; comparison and write below
        // share one transaction, including when BroadcastChannel is unavailable.
        const expectedRevision =
          knownRevision === undefined
            ? (await readStoredHealth()).revision
            : knownRevision;
        if (!mounted.current || request !== requestId.current) return;
        const contents = await file.text();
        if (!mounted.current || request !== requestId.current) return;
        const parsed = await parseInWorker(contents, request);
        if (!mounted.current || request !== requestId.current) return;
        parsed.fileName = file.name
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .slice(0, 160);
        if (!parseCachedHealthSnapshot(JSON.stringify(parsed)))
          throw new Error(
            "O arquivo não pôde ser normalizado. Os dados anteriores foram mantidos.",
          );
        const saved = await saveSnapshot(
          parsed,
          () => mounted.current && request === requestId.current,
          expectedRevision,
        );
        if (
          saved.status === "stale" ||
          !mounted.current ||
          request !== requestId.current
        )
          return;
        if (saved.status === "conflict") {
          const canonical = await readStoredHealth();
          if (!mounted.current || request !== requestId.current) return;
          revision.current = canonical.revision;
          setSnapshot(snapshotFromStorage(canonical.raw));
          throw new Error(
            "Os dados foram alterados ou apagados em outra aba. Se desejar substituí-los, importe o XML novamente.",
          );
        }
        revision.current = saved.revision;
        setSnapshot(parsed);
        setStatus("ready");
        notify();
      } catch (cause) {
        if (!mounted.current || request !== requestId.current) return;
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível importar o XML. Os dados anteriores foram mantidos.",
        );
      } finally {
        if (request === requestId.current) importing.current = false;
      }
    },
    [notify, parseInWorker, stopWorker],
  );

  const clear = useCallback(async () => {
    const request = ++requestId.current;
    if (pending.current) stopWorker("A importação foi cancelada.");
    importing.current = false;
    setError(null);
    try {
      const saved = await saveSnapshot(
        null,
        () => mounted.current && request === requestId.current,
      );
      if (
        saved.status !== "saved" ||
        !mounted.current ||
        request !== requestId.current
      )
        return;
      revision.current = saved.revision;
      setSnapshot(null);
      setStatus("idle");
      notify();
    } catch (cause) {
      if (!mounted.current || request !== requestId.current) return;
      setStatus("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível remover os dados importados.",
      );
    }
  }, [notify, stopWorker]);

  return { snapshot, status, error, importFile, clear };
}
