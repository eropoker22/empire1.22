import type { CityFeedEvent, CityFeedProjectionView } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CITY_FEED_DEFAULT_LIMIT } from "../rules/events";

export interface CityFeedProjectionOptions {
  playerId?: string;
  selectedDistrictId?: string | null;
  factionId?: string | null;
  allianceId?: string | null;
  includeAdmin?: boolean;
  limit?: number;
}

/**
 * Responsibility: Creates UI-safe city feed slices from stored feed events.
 * Belongs here: read-only sorting, visibility filtering, and district/police subsets.
 * Does not belong here: event generation, rumor text choice, or gameplay mutation.
 */
export const createCityFeedProjection = (
  state: CoreGameState,
  options: CityFeedProjectionOptions = {}
): CityFeedProjectionView => {
  const limit = Math.max(1, Math.floor(Number(options.limit || CITY_FEED_DEFAULT_LIMIT)));
  const events = Object.values(state.cityFeedEventsById ?? {})
    .filter((event): event is CityFeedEvent => Boolean(event?.id && event.message))
    .sort((left, right) => right.createdAtTick - left.createdAtTick || right.id.localeCompare(left.id));
  const visibleEvents = events.filter((event) => isCityFeedEventVisible(event, options)).slice(0, limit);

  return {
    currentPlayerFeed: visibleEvents,
    globalCityFeed: visibleEvents.filter((event) => event.visibility === "all"),
    selectedDistrictFeed: options.selectedDistrictId
      ? visibleEvents.filter((event) => event.districtId === options.selectedDistrictId).slice(0, 5)
      : [],
    policeFeed: visibleEvents.filter((event) => event.category === "police"),
    updatedAtTick: state.root.tick
  };
};

export const isCityFeedEventVisible = (
  event: CityFeedEvent,
  options: CityFeedProjectionOptions = {}
): boolean => {
  switch (event.visibility) {
    case "all":
      return true;
    case "player":
      return Boolean(options.playerId && (event.playerId === options.playerId || event.targetPlayerId === options.playerId));
    case "faction":
      return Boolean(options.factionId && safeText(event.payload?.factionId) === options.factionId);
    case "alliance":
      return Boolean(options.allianceId && safeText(event.payload?.allianceId) === options.allianceId);
    case "admin":
      return Boolean(options.includeAdmin);
    default:
      return false;
  }
};

const safeText = (value: unknown): string => String(value ?? "").trim();
