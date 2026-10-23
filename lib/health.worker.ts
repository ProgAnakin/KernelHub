import { parseHealthExport, type HealthSnapshot } from "./health";

export interface HealthWorkerRequest {
  version: 1;
  type: "parse";
  requestId: number;
  xml: string;
}

export type HealthWorkerResponse =
  | {
      version: 1;
      type: "result";
      requestId: number;
      snapshot: HealthSnapshot;
    }
  | {
      version: 1;
      type: "error";
      requestId: number;
      message: string;
    };

// A module worker keeps XML scanning, sorting and aggregation off the UI thread.
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: HealthWorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  const request = event.data;
  if (
    typeof request !== "object" ||
    request === null ||
    !("requestId" in request) ||
    typeof request.requestId !== "number" ||
    !Number.isSafeInteger(request.requestId) ||
    request.requestId < 1
  )
    return;
  const requestId = request.requestId;
  try {
    if (
      Object.keys(request).length !== 4 ||
      !("version" in request) ||
      request.version !== 1 ||
      !("type" in request) ||
      request.type !== "parse" ||
      !("xml" in request) ||
      typeof request.xml !== "string"
    )
      throw new Error("A solicitação de importação está inválida.");
    workerScope.postMessage({
      version: 1,
      type: "result",
      requestId,
      snapshot: parseHealthExport(request.xml),
    });
  } catch (cause) {
    workerScope.postMessage({
      version: 1,
      type: "error",
      requestId,
      message:
        cause instanceof Error
          ? cause.message.slice(0, 240)
          : "Não foi possível importar este XML.",
    });
  }
};
