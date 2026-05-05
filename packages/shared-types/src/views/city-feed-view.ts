import type { CityFeedEvent } from "../entities/city-feed-event";

/**
 * Responsibility: Frontend read model for visible city feed and rumor slices.
 * Belongs here: pre-filtered lists for global, player, district, and police UI.
 * Does not belong here: event generation or gameplay mutation.
 */
export interface CityFeedProjectionView {
  currentPlayerFeed: CityFeedEvent[];
  globalCityFeed: CityFeedEvent[];
  selectedDistrictFeed: CityFeedEvent[];
  policeFeed: CityFeedEvent[];
  updatedAtTick: number;
}
