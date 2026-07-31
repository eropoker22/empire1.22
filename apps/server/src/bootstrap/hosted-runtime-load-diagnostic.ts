import type { ServerInstanceId } from "@empire/shared-types";

export type HostedRuntimeLoadStage =
  | "server-record"
  | "recovery-snapshot"
  | "runtime-create"
  | "runtime-restore"
  | "runtime-metadata";

export const writeSafeRuntimeLoadDiagnostic = (
  error: unknown,
  serverInstanceId: ServerInstanceId,
  requireRunning: boolean,
  stage: HostedRuntimeLoadStage
): void => {
  const errorCode = readSafeErrorCode(error);
  console.error("[hosted-runtime-loader]", JSON.stringify({
    event: "authority-load-failed",
    serverInstanceId: safeDiagnosticToken(serverInstanceId, 160),
    requireRunning,
    stage,
    errorName: safeDiagnosticToken(error instanceof Error ? error.name : "UnknownError", 64),
    ...(errorCode ? { errorCode } : {})
  }));
};

const readSafeErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  return safeDiagnosticToken(String((error as { code: unknown }).code), 80);
};

const safeDiagnosticToken = (value: string, maxLength: number): string =>
  value.replace(/[^a-zA-Z0-9:_.-]/gu, "").slice(0, maxLength);
