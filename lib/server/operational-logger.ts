import "server-only";
import { randomUUID } from "node:crypto";

type LogContext = Record<string, string | number | boolean | null | undefined>;

function errorFields(error: unknown) {
  if (!(error instanceof Error)) return { errorName: "UnknownError" };
  const candidate = error as Error & { code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return {
    errorName: error.name,
    ...(typeof candidate.code === "string" ? { errorCode: candidate.code } : {}),
    ...(typeof candidate.$metadata?.httpStatusCode === "number" ? { upstreamStatus: candidate.$metadata.httpStatusCode } : {}),
  };
}

export function logOperationalError(event: string, error: unknown, context: LogContext = {}) {
  console.error(JSON.stringify({
    level: "error",
    timestamp: new Date().toISOString(),
    event,
    ...errorFields(error),
    ...context,
  }));
}

export function logUnhandledRequestError(error: unknown, request: Request, event = "http.request.failed") {
  const requestId = randomUUID();
  logOperationalError(event, error, {
    requestId,
    method: request.method,
    path: new URL(request.url).pathname,
  });
  return requestId;
}
