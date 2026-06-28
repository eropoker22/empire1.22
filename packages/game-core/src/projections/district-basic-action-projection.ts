import type { CoreGameState } from "../entities/game-state";
import { validateMapAction } from "../rules";

export const createDistrictRobTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string
) => {
  const source = state.districtsById[sourceDistrictId];
  if (!source) return [];

  return source.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((target) => target !== undefined)
    .map((target) => {
      const validation = validateMapAction(state, {
        actorPlayerId: playerId,
        targetDistrictId: target.id,
        originDistrictId: source.id,
        action: "rob"
      });
      return {
        districtId: target.id,
        name: target.name,
        ownerPlayerId: target.ownerPlayerId,
        status: target.status,
        enabled: validation.allowed,
        disabledCode: validation.reasonCode ?? null,
        disabledReason: validation.allowed ? null : formatActionReason(validation.reasonCode),
        expectedTargetVersion: target.version,
        expectedSourceVersion: source.version
      };
    });
};

export const createDistrictHeistTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string
) => {
  const source = state.districtsById[sourceDistrictId];
  if (!source) return [];

  return source.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((target) => target !== undefined)
    .map((target) => {
      const validation = validateMapAction(state, {
        actorPlayerId: playerId,
        targetDistrictId: target.id,
        originDistrictId: source.id,
        action: "heist"
      });
      return {
        districtId: target.id,
        name: target.name,
        ownerPlayerId: target.ownerPlayerId,
        status: target.status,
        enabled: validation.allowed,
        disabledCode: validation.reasonCode ?? null,
        disabledReason: validation.allowed ? null : formatActionReason(validation.reasonCode),
        expectedTargetVersion: target.version,
        expectedSourceVersion: source.version,
        styles: [
          { style: "stealth" as const, label: "Tichý", defaultGangMembersSent: 5 },
          { style: "balanced" as const, label: "Vyvážený", defaultGangMembersSent: 10 },
          { style: "all_in" as const, label: "Tvrdý", defaultGangMembersSent: 25 }
        ]
      };
    });
};

export const createDistrictDefenseActionView = (
  state: CoreGameState,
  playerId: string,
  districtId: string,
  action: "place_defense" | "remove_defense"
) => {
  const district = state.districtsById[districtId];
  if (!district) return null;

  const validation = validateMapAction(state, {
    actorPlayerId: playerId,
    targetDistrictId: district.id,
    action
  });
  const disabledCode = validation.reasonCode ?? null;

  return {
    enabled: validation.allowed,
    disabledCode,
    disabledReason: disabledCode ? formatActionReason(disabledCode) : null,
    expectedTargetVersion: district.version
  };
};

const formatActionReason = (reasonCode: string | undefined): string | null =>
  reasonCode ? reasonCode : null;
