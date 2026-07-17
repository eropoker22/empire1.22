import type { PlayerProgressionCapabilityView } from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { handleCityEventCommand } from "../../handlers/cityEventCommands";
import { validateCollect } from "../../validation/validateCollect";

const unavailable = (reasonCode: string, evidence: string[] = []): PlayerProgressionCapabilityView => ({
  canExecuteNow: false,
  canExecuteLater: false,
  nextAvailableAtTick: null,
  reasonCode,
  sourceDistrictId: null,
  targetDistrictId: null,
  routeDistrictId: null,
  recommendedPayloadPreview: null,
  evidence
});

const command = <TType extends string>(state: CoreGameState, playerId: string, type: TType) => ({
  id: `capability:${playerId}:${type}`,
  type,
  mode: state.serverInstance.mode,
  playerId,
  serverInstanceId: state.serverInstance.id,
  issuedAt: new Date(0).toISOString(),
  clientRequestId: null
});

export const resolveCollectCapability = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): PlayerProgressionCapabilityView => {
  if (!context) return unavailable("CONTEXT_UNAVAILABLE");
  for (const district of Object.values(state.districtsById).filter((entry) => entry.ownerPlayerId === playerId)) {
    for (const buildingId of district.buildingIds) {
      const candidate = { ...command(state, playerId, "collect-production" as const), payload: { districtId: district.id, buildingId } };
      if (validateCollect(state, candidate, context).length === 0) {
        return {
          canExecuteNow: true,
          canExecuteLater: false,
          nextAvailableAtTick: null,
          reasonCode: null,
          sourceDistrictId: district.id,
          targetDistrictId: null,
          routeDistrictId: null,
          recommendedPayloadPreview: candidate.payload,
          evidence: ["CANONICAL_COLLECT_VALIDATOR_PASSED"]
        };
      }
    }
  }
  return unavailable("NO_COLLECTABLE_PRODUCTION", ["CANONICAL_COLLECT_VALIDATOR_REJECTED"]);
};

export const resolveCityEventCapability = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext | undefined,
  kind: "start" | "claim"
): PlayerProgressionCapabilityView => {
  if (!context) return unavailable("CONTEXT_UNAVAILABLE");
  const cityState = state.playerCityEventStatesByPlayerId?.[playerId];
  const payloads = kind === "start"
    ? Object.values(cityState?.offersByAgent ?? {}).flat().map((offer) => ({ offerId: offer.offerId }))
    : (cityState?.pendingRewards ?? []).map((reward) => ({ pendingRewardId: reward.pendingRewardId }));
  let reasonCode = kind === "start" ? "NO_CITY_EVENT_OFFER" : "NO_PENDING_REWARD";
  for (const payload of payloads) {
    const candidate = kind === "start"
      ? { ...command(state, playerId, "start-city-event" as const), payload: { offerId: (payload as { offerId: string }).offerId } }
      : { ...command(state, playerId, "claim-city-event-reward" as const), payload: { pendingRewardId: (payload as { pendingRewardId: string }).pendingRewardId } };
    const result = handleCityEventCommand(state, candidate, context);
    if (result.errors.length === 0) {
      return {
        canExecuteNow: true,
        canExecuteLater: false,
        nextAvailableAtTick: null,
        reasonCode: null,
        sourceDistrictId: null,
        targetDistrictId: null,
        routeDistrictId: null,
        recommendedPayloadPreview: payload as Record<string, unknown>,
        evidence: [kind === "start" ? "CANONICAL_CITY_EVENT_START_VALIDATOR_PASSED" : "CANONICAL_PENDING_REWARD_VALIDATOR_PASSED"]
      };
    }
    reasonCode = String(result.errors[0]?.code || reasonCode);
  }
  return unavailable(reasonCode, [kind === "start" ? "CANONICAL_CITY_EVENT_START_VALIDATOR_REJECTED" : "CANONICAL_PENDING_REWARD_VALIDATOR_REJECTED"]);
};
