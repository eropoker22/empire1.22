export const toTitleCase = (value: string): string =>
  value
    .split(/[-_]+/g)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export const getStoragePercent = (storedAmount: number, storageCap: number): number =>
  Math.max(0, Math.min(100, Math.round((Math.max(0, storedAmount) / Math.max(1, storageCap)) * 100)));

export const formatTickLabel = (tickCount: number): string =>
  `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;

export const createCooldownCountdown = (
  remainingTicks: number,
  tickRateMs: number,
  nowMs: number
): { remainingMs: number; endsAtMs: number | null } => {
  const remainingMs = Math.max(0, Math.ceil(remainingTicks) * tickRateMs);
  return { remainingMs, endsAtMs: remainingMs > 0 ? nowMs + remainingMs : null };
};

export const formatDurationMs = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.round((totalMinutes / 60) * 10) / 10;
  return `${hours}h`;
};

export const formatHeatLabel = (value: number): string =>
  String(Math.round(Number.isFinite(value) ? value : 0));

export const formatResourceSummary = (
  values: Record<string, number>,
  emptyLabel: string
): string => {
  const parts = Object.entries(values).filter(([, amount]) => amount > 0);

  return parts.length > 0
    ? parts.map(([resourceKey, amount]) => `${amount} ${toTitleCase(resourceKey)}`).join(" + ")
    : emptyLabel;
};

export const formatSigned = (value: number): string =>
  value >= 0 ? `+${value}` : String(value);
