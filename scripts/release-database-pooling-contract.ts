export interface ReleaseDatabasePoolingState {
  currentSchema: string | null;
  statementTimeout: string;
}

export const assertReleaseDatabasePoolingState = (state: ReleaseDatabasePoolingState): number => {
  if (state.currentSchema !== "public") throw new Error("RELEASE_POOLED_DATABASE_SCHEMA_NOT_PUBLIC");
  const timeoutMs = parsePostgresDurationMs(state.statementTimeout);
  if (timeoutMs === null || timeoutMs <= 0 || timeoutMs > 30_000) {
    throw new Error("RELEASE_POOLED_ROLE_STATEMENT_TIMEOUT_UNSAFE");
  }
  return timeoutMs;
};

export const parsePostgresDurationMs = (value: string): number | null => {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|min|h)?$/u.exec(String(value).trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2] === "h" ? 3_600_000
    : match[2] === "min" ? 60_000
      : match[2] === "s" ? 1_000
        : 1;
  const milliseconds = amount * multiplier;
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
};
