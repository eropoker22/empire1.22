import type { Building } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolvePowerStationInfrastructureMultiplier } from "../../handlers/powerStationBuildingActions";
import { resolveGarageCooldownMultiplier } from "../../handlers/garageBuildingActions";
import { resolveActiveAlliancePenaltyStatModifiers } from "../alliances/alliancePenaltyModifiers";
import { resolveProductionBuildingLevelMultiplier } from "../buildings/buildingUpgradeRules";
import { resolveDayNightProductionSpeedMultiplier } from "../day-night/dayNightModifiers";

/** Shared by scheduling and projections: infrastructure actions must affect real throughput. */
export const resolveProductionSupportMultiplier = (state: CoreGameState, building: Building, playerId: string | null | undefined, context: GameCoreContext): number => {
  const type = building.buildingTypeId;
  const target = type === "factory" ? "factoryProductionSpeed" : type === "armory" ? "armoryProductionSpeed" : null;
  const infrastructure = target ? resolvePowerStationInfrastructureMultiplier({ state, playerId, config: context.config.balance.powerStation, tick: state.root.tick, target }) : 1;
  const category = type === "factory" ? "factoryProductionActions" : type === "armory" ? "armoryProductionActions" : null;
  const cooldown = category ? resolveGarageCooldownMultiplier({ state, playerId, config: context.config.balance.garage, category }) : 1;
  const nowIso = context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();
  const penalty = resolveActiveAlliancePenaltyStatModifiers(state, playerId, nowIso).productionMultiplier;
  return infrastructure * penalty * resolveDayNightProductionSpeedMultiplier(state, context, type) / cooldown;
};

/** Preserve completed work when an upgrade or infrastructure action changes speed. */
export const retimeProductionSupport = (previous: CoreGameState, next: CoreGameState, context: GameCoreContext): CoreGameState => {
  let buildingsById = next.buildingsById;
  for (const building of Object.values(next.buildingsById)) {
    const oldBuilding = previous.buildingsById[building.id];
    if (!oldBuilding || building.status !== "active" || !building.productionLines) continue;
    const playerId = building.ownerPlayerId === "player:neutral" ? next.districtsById[building.districtId]?.ownerPlayerId : building.ownerPlayerId;
    const before = resolveProductionSupportMultiplier(previous, oldBuilding, playerId, context) * resolveProductionBuildingLevelMultiplier(oldBuilding, context);
    const after = resolveProductionSupportMultiplier(next, building, playerId, context) * resolveProductionBuildingLevelMultiplier(building, context);
    if (before === after) continue;
    let productionLines = building.productionLines;
    for (const [key, line] of Object.entries(building.productionLines)) {
      if (line.activeCompletesAtTick === null || line.activeCompletesAtTick <= next.root.tick) continue;
      productionLines = { ...productionLines, [key]: { ...line,
        activeCompletesAtTick: next.root.tick + Math.max(1, Math.ceil((line.activeCompletesAtTick - next.root.tick) * before / after)),
        version: line.version + 1
      } };
    }
    if (productionLines !== building.productionLines) buildingsById = { ...buildingsById, [building.id]: { ...building, productionLines, version: building.version + 1 } };
  }
  return buildingsById === next.buildingsById ? next : { ...next, buildingsById };
};
