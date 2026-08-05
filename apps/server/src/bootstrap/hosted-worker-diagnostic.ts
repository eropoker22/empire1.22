export const writeHostedWorkerDiagnostic = (input: {
  level: "info" | "warn" | "error";
  event: "worker_started" | "worker_run_failed" | "worker_shutdown_started" | "worker_stopped";
  buildSha: string;
  workerId: string;
  environment: string;
  region: string;
  schemaVersion: string;
  errorCode?: string | null;
  now?: () => Date;
}): void => {
  console.log(JSON.stringify({
    timestamp: (input.now ?? (() => new Date()))().toISOString(),
    level: input.level,
    event: input.event,
    component: "hosted-worker",
    requestId: null,
    route: null,
    status: null,
    durationMs: null,
    serverInstanceHash: null,
    playerHash: null,
    buildSha: input.buildSha,
    workerId: input.workerId,
    environment: input.environment,
    region: input.region,
    schemaVersion: input.schemaVersion,
    errorCode: safeErrorCode(input.errorCode)
  }));
};

const safeErrorCode = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return /^[A-Z0-9_:-]{1,80}$/u.test(normalized) ? normalized : null;
};
