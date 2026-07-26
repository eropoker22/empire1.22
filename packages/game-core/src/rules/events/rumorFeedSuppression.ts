import type { CityFeedEvent } from "@empire/shared-types";

export const isSuppressedByRecentSimilarEvent = (
  event: CityFeedEvent,
  existing: Record<string, CityFeedEvent>,
  currentTick: number,
  categoryCooldownSeconds: number,
  tickRateMs: number
): boolean => {
  if (event.confidence === "confirmed" || event.priority === 100) return false;
  const cooldownTicks = Math.max(
    1,
    Math.ceil((Math.max(1, categoryCooldownSeconds) * 1000) / Math.max(1, tickRateMs))
  );
  return Object.values(existing).some((candidate) =>
    (candidate.expiresAtTick ?? Infinity) > currentTick
    && candidate.audience === event.audience
    && candidate.rumorCategory === event.rumorCategory
    && candidate.confidence === event.confidence
    && (candidate.districtId ?? "") === (event.districtId ?? "")
    && (candidate.sourceBuildingType ?? "") === (event.sourceBuildingType ?? "")
    && Math.abs(candidate.createdAtTick - event.createdAtTick) <= cooldownTicks
  );
};
