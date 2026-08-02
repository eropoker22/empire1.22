export type HostedApiErrorKind =
  | "connection-open-timeout"
  | "connection-terminated"
  | "lock-unavailable"
  | "network-error"
  | "pool-acquire-timeout"
  | "pool-closed"
  | "postgres-capacity"
  | "statement-timeout"
  | "unknown";

export const createSafeHostedApiErrorDiagnostic = (
  error: unknown,
  nowIso: string = new Date().toISOString()
): string => {
  const name = sanitizeDiagnosticToken(error instanceof Error ? error.name : "UnknownError");
  const code = readErrorCode(error);
  const kind = classifyHostedApiError(error, code);
  const applicationFrame = readApplicationFrame(error);

  return [
    `time=${sanitizeDiagnosticToken(nowIso)}`,
    `name=${name || "UnknownError"}`,
    `kind=${kind}`,
    ...(code ? [`code=${code}`] : []),
    ...(applicationFrame ? [`at=${applicationFrame}`] : [])
  ].join(" ");
};

export const classifyHostedApiError = (
  error: unknown,
  errorCode: string = readErrorCode(error)
): HostedApiErrorKind => {
  if (errorCode === "57014") return "statement-timeout";
  if (errorCode === "53300") return "postgres-capacity";
  if (errorCode === "55P03") return "lock-unavailable";
  if (["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT"].includes(errorCode)) {
    return "network-error";
  }

  const message = error instanceof Error ? error.message : "";
  if (message === "timeout exceeded when trying to connect") return "pool-acquire-timeout";
  if (message === "Connection terminated due to connection timeout") return "connection-open-timeout";
  if (message === "Connection terminated unexpectedly") return "connection-terminated";
  if (message === "Cannot use a pool after calling end on the pool") return "pool-closed";
  return "unknown";
};

const readErrorCode = (error: unknown): string => (
  typeof error === "object" && error !== null && "code" in error
    ? sanitizeDiagnosticToken(String(error.code)).slice(0, 64)
    : ""
);

const readApplicationFrame = (error: unknown): string => {
  if (!(error instanceof Error)) return "";
  const frame = error.stack?.split(/\r?\n/u).find((line) => (
    line.includes("STREETS") && !line.includes("node_modules")
  ));
  return frame
    ? frame.trim().replace(/^at\s+/u, "").replace(/[\r\n]/gu, " ").slice(0, 512)
    : "";
};

const sanitizeDiagnosticToken = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_.:+-]/gu, "").slice(0, 128);
