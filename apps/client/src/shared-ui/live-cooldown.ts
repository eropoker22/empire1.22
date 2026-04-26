export interface LiveCooldownLabelInput {
  endsAtMs: number;
  nowMs: number;
  prefix?: string;
  readyLabel?: string;
}

export const formatLiveCooldownDuration = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const formatLiveCooldownLabel = ({
  endsAtMs,
  nowMs,
  prefix = "Cooldown ",
  readyLabel = "Ready"
}: LiveCooldownLabelInput): string => {
  const remainingMs = Math.max(0, endsAtMs - nowMs);

  return remainingMs > 0
    ? `${prefix}${formatLiveCooldownDuration(remainingMs)}`
    : readyLabel;
};

export const refreshLiveCooldownLabels = (
  root: ParentNode,
  nowMs = Date.now()
): number => {
  const nodes = root.querySelectorAll<HTMLElement>("[data-live-cooldown]");

  nodes.forEach((node) => {
    const endsAtMs = Number(node.dataset.cooldownEndsAtMs || 0);

    node.textContent = formatLiveCooldownLabel({
      endsAtMs,
      nowMs,
      prefix: node.dataset.cooldownPrefix ?? "Cooldown ",
      readyLabel: node.dataset.cooldownReadyLabel ?? "Ready"
    });
    node.dataset.cooldownState = endsAtMs > nowMs ? "cooling" : "ready";
  });

  return nodes.length;
};
