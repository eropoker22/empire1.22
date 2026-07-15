import type { ActionCommand } from "./action-command";

export interface StartCityEventPayload {
  offerId: string;
}

export interface ClaimCityEventRewardPayload {
  pendingRewardId: string;
}

export type StartCityEventCommand = ActionCommand<"start-city-event", StartCityEventPayload>;
export type ClaimCityEventRewardCommand = ActionCommand<"claim-city-event-reward", ClaimCityEventRewardPayload>;
export type CityEventCommand = StartCityEventCommand | ClaimCityEventRewardCommand;
