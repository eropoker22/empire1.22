import type { ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  calculateIncomeByPlayerId,
  getActiveFixedBuildingConfigsForDistrict,
  resolveActiveDistrictEffectModifiers
} from "./calculateIncome";
import {
  applyFactionHeatGain,
  applyFactionInfluenceGain,
  applyFactionPopulationGeneration,
  getFactionPassiveModifiers
} from "../factions/factionRules";
import { resolveFixedBuildingIncomeConfig } from "./fixedBuildingIncomeConfig";
import { resolveDistrictStabilizationMultiplier } from "./calculateIncome";
import { applyArcadeAuditChecks } from "../../handlers/arcadeBuildingActions";
import { applyApartmentBlockPopulationProduction } from "../../handlers/apartmentBlockBuildingActions";
import { applyCasinoAuditChecks } from "../../handlers/casinoBuildingActions";
import { applyConvenienceStorePassiveRumors, applyConvenienceStorePopulationProduction } from "../../handlers/convenienceStoreBuildingActions";
import { applyExchangeOfficeAuditChecks } from "../../handlers/exchangeOfficeBuildingActions";
import { applyRestaurantPassiveRumors } from "../../handlers/restaurantBuildingActions";
import { applySchoolStudentProduction } from "../../handlers/schoolBuildingActions";
import { LEGACY_POPULATION_RESOURCE_KEYS, resolvePlayerPopulation } from "../../state/playerPopulation";
import { applyLobbyClubScandalChecks } from "../../handlers/lobbyClubBuildingActions";
import { applyStripClubPassiveRumors } from "../../handlers/stripClubBuildingActions";
import { applyVipLoungePassiveRumors } from "../../handlers/vipLoungeBuildingActions";
import { resolveActiveAlliancePenaltyStatModifiers } from "../alliances/alliancePenaltyModifiers";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface FixedBuildingPassivePressureRate {
  heatPerTick: number;
  influencePerTick: number;
  nextHeat: number;
  nextInfluence: number;
}

interface DistrictResourceModifierStatRate {
  heatPerTick: number;
  influencePerTick: number;
  populationPerTick: number;
}

const DISTRICT_STAT_RESOURCE_KEYS = new Set(["population", "influence", "heat"]);

/**
 * District stat modifiers are not inventory items.  They have to mutate their
 * canonical homes: population belongs to the player, influence and heat to
 * the owned district.  Treating these values as ResourceState balances made
 * them invisible to every player-facing projection.
 */
export const calculateDistrictResourceModifierStatRatesByDistrictId = (
  state: CoreGameState,
  context?: GameCoreContext
): Record<string, DistrictResourceModifierStatRate> => {
  const ratesByDistrictId: Record<string, DistrictResourceModifierStatRate> = {};

  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || district.status === "destroyed") continue;

    const stabilizationMultiplier = resolveDistrictStabilizationMultiplier(
      district,
      state.root.tick,
      context?.config.balance.conflict
    );
    const factionModifiers = context
      ? getFactionPassiveModifiers(state, district.ownerPlayerId, context)
      : null;
    const penaltyModifiers = context
      ? resolveActiveAlliancePenaltyStatModifiers(state, district.ownerPlayerId, nowIsoFromContext(context))
      : null;
    const populationBase = positiveModifier(district.resourceModifiers.population) * stabilizationMultiplier;
    const influenceBase = positiveModifier(district.resourceModifiers.influence) * stabilizationMultiplier;
    const districtTypeHeatPerTick = context
      ? resolveDistrictTypeHeatPerTick(district.zone, context)
      : 0;
    const heatBase = (
      positiveModifier(district.resourceModifiers.heat)
      + districtTypeHeatPerTick
    ) * stabilizationMultiplier;

    ratesByDistrictId[district.id] = {
      populationPerTick: factionModifiers
        ? applyFactionPopulationGeneration(populationBase, factionModifiers)
        : populationBase,
      influencePerTick: factionModifiers
        ? applyFactionInfluenceGain(
          influenceBase * Number(penaltyModifiers?.influenceGenerationMultiplier ?? 1),
          factionModifiers
        )
        : influenceBase,
      heatPerTick: factionModifiers
        ? applyFactionHeatGain(heatBase, factionModifiers)
        : heatBase
    };
  }

  return ratesByDistrictId;
};

export const calculateFixedBuildingPassivePressureByDistrictId = (
  state: CoreGameState,
  context: GameCoreContext
): Record<string, FixedBuildingPassivePressureRate> => {
  if (!context.config.balance.fixedBuildings) {
    return {};
  }

  const ticksPerDay = DAY_MS / Math.max(1, context.config.tickRateMs);
  const ratesByDistrictId: Record<string, FixedBuildingPassivePressureRate> = {};

  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || district.status === "destroyed") {
      continue;
    }

    const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
    const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
    const factionModifiers = getFactionPassiveModifiers(state, district.ownerPlayerId, context);
    const penaltyModifiers = resolveActiveAlliancePenaltyStatModifiers(
      state,
      district.ownerPlayerId,
      nowIsoFromContext(context)
    );
    const basePressure = activeBuildings.reduce(
      (totals, { building, config }) => {
        const resolvedConfig = resolveFixedBuildingIncomeConfig({
          state,
          context,
          districtId: district.id,
          building,
          config
        });
        return {
          heatPerDay: totals.heatPerDay + sanitizePerDay(resolvedConfig.heatPerDay),
          influencePerDay: totals.influencePerDay + sanitizePerDay(resolvedConfig.influencePerDay)
        };
      },
      { heatPerDay: 0, influencePerDay: 0 }
    );
    const heatPerDay = applyFactionHeatGain(
      basePressure.heatPerDay * modifiers.heatMultiplier + modifiers.heatPerDay,
      factionModifiers
    );
    const influencePerDay = applyFactionInfluenceGain(
      (
        basePressure.influencePerDay * modifiers.influenceMultiplier
        + modifiers.influencePerDay
      ) * penaltyModifiers.influenceGenerationMultiplier,
      factionModifiers
    );
    const currentHeat = Number(district.heat || 0);
    const currentInfluence = Number(district.influence || 0);
    const nextHeat = Math.max(
      0,
      currentHeat + resolvePerTick(heatPerDay, ticksPerDay)
    );
    const nextInfluence = Math.max(
      0,
      currentInfluence + resolvePerTick(influencePerDay, ticksPerDay)
    );

    ratesByDistrictId[district.id] = {
      heatPerTick: nextHeat - currentHeat,
      influencePerTick: nextInfluence - currentInfluence,
      nextHeat,
      nextInfluence
    };
  }

  return ratesByDistrictId;
};

/**
 * Responsibility: Applies periodic income collection to the authoritative state.
 * Belongs here: server-side economy transitions driven by ticks or commands.
 * Does not belong here: UI timing or client cache updates.
 */
export const collectIncome = (state: CoreGameState, context?: GameCoreContext): CoreGameState => {
  const incomeByPlayerId = calculateIncomeByPlayerId(state, context);
  const districtModifierStatRates = calculateDistrictResourceModifierStatRatesByDistrictId(state, context);
  const populationGainByPlayerId = Object.values(state.districtsById).reduce<Record<string, number>>(
    (gains, district) => {
      const rate = districtModifierStatRates[district.id];
      if (!district.ownerPlayerId || !rate || rate.populationPerTick <= 0) return gains;
      gains[district.ownerPlayerId] = (gains[district.ownerPlayerId] ?? 0) + rate.populationPerTick;
      return gains;
    },
    {}
  );

  if (!context && Object.keys(incomeByPlayerId).length === 0 && Object.keys(populationGainByPlayerId).length === 0
    && Object.keys(districtModifierStatRates).length === 0) {
    return state;
  }

  let changed = false;
  let nextResourceStatesById = state.resourceStatesById;
  let nextPlayersById = state.playersById;

  const playerIds = new Set([
    ...Object.keys(incomeByPlayerId),
    ...Object.keys(populationGainByPlayerId)
  ]);
  for (const playerId of playerIds) {
    const incomeBalances = incomeByPlayerId[playerId] ?? {};
    const populationGain = Math.max(0, Number(populationGainByPlayerId[playerId] || 0));
    const player = state.playersById[playerId];

    if (!player) {
      continue;
    }

    const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextBalances = {
      ...currentResourceState.balances
    };
    for (const resourceKey of LEGACY_POPULATION_RESOURCE_KEYS) delete nextBalances[resourceKey];

    for (const [resourceKey, amount] of Object.entries(incomeBalances)) {
      if ((LEGACY_POPULATION_RESOURCE_KEYS as readonly string[]).includes(resourceKey)) continue;
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
    }
    if (populationGain > 0) {
      nextPlayersById = {
        ...nextPlayersById,
        [player.id]: {
          ...player,
          population: resolvePlayerPopulation(state, player) + populationGain,
          version: player.version + 1
        }
      };
    }

    nextResourceStatesById = {
      ...nextResourceStatesById,
      [currentResourceState.id]: {
        ...currentResourceState,
        balances: nextBalances,
        lastUpdatedTick: state.root.tick,
        version: currentResourceState.version + (state.resourceStatesById[currentResourceState.id] ? 1 : 0)
      }
    };
    changed = true;
  }

  const districtPressureResult = context
    ? applyFixedBuildingPassivePressure(state, context, districtModifierStatRates)
    : applyFixedBuildingPassivePressure(state, undefined, districtModifierStatRates);
  changed = changed || districtPressureResult.changed;

  const incomeState = changed
    ? {
        ...state,
        playersById: nextPlayersById,
        resourceStatesById: nextResourceStatesById,
        districtsById: districtPressureResult.districtsById
      }
    : state;

  const casinoAuditState = context?.config.balance.casino
    ? applyCasinoAuditChecks(incomeState, context.config.balance.casino, context.config.tickRateMs)
    : incomeState;
  const exchangeAuditState = context?.config.balance.exchangeOffice
    ? applyExchangeOfficeAuditChecks(casinoAuditState, context.config.balance.exchangeOffice, context.config.tickRateMs)
    : casinoAuditState;
  const arcadeAuditState = context?.config.balance.arcade
    ? applyArcadeAuditChecks(exchangeAuditState, context.config.balance.arcade, context.config.tickRateMs)
    : exchangeAuditState;
  const apartmentState = context?.config.balance.apartmentBlock
    ? applyApartmentBlockPopulationProduction(arcadeAuditState, context.config.balance.apartmentBlock, context.config.tickRateMs, context.config.balance.powerStation, context.config.balance.recruitmentCenter, context.config.balance.school, context)
    : arcadeAuditState;
  const schoolState = context?.config.balance.school
    ? applySchoolStudentProduction(apartmentState, context.config.balance.school, context.config.tickRateMs, context)
    : apartmentState;
  const stripClubRumorState = context?.config.balance.stripClub
    ? applyStripClubPassiveRumors(schoolState, context.config.balance.stripClub, context.config.tickRateMs, context.config.balance.lobbyClub, context.config)
    : schoolState;
  const restaurantRumorState = context?.config.balance.restaurant
    ? applyRestaurantPassiveRumors(stripClubRumorState, context.config.balance.restaurant, context.config.tickRateMs, context.config.balance.lobbyClub, context.config)
    : stripClubRumorState;
  const conveniencePopulationState = context?.config.balance.convenienceStore
    ? applyConvenienceStorePopulationProduction(restaurantRumorState, context.config.balance.convenienceStore, context.config.tickRateMs)
    : restaurantRumorState;
  const convenienceRumorState = context?.config.balance.convenienceStore
    ? applyConvenienceStorePassiveRumors(conveniencePopulationState, context.config.balance.convenienceStore, context.config.tickRateMs, context.config.balance.restaurant, context.config.balance.lobbyClub, context.config)
    : conveniencePopulationState;
  const vipLoungeRumorState = context?.config.balance.vipLounge
    ? applyVipLoungePassiveRumors(convenienceRumorState, context.config.balance.vipLounge, context.config.tickRateMs, context.config.balance.lobbyClub, context.config)
    : convenienceRumorState;
  return context?.config.balance.lobbyClub
    ? applyLobbyClubScandalChecks(vipLoungeRumorState, context.config.balance.lobbyClub, context.config.tickRateMs)
    : vipLoungeRumorState;
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const applyFixedBuildingPassivePressure = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  districtModifierStatRates: Record<string, DistrictResourceModifierStatRate>
): { changed: boolean; districtsById: CoreGameState["districtsById"] } => {
  const fixedBuildingRatesByDistrictId = context
    ? calculateFixedBuildingPassivePressureByDistrictId(state, context)
    : {};
  const districtIds = new Set([
    ...Object.keys(fixedBuildingRatesByDistrictId),
    ...Object.keys(districtModifierStatRates)
  ]);
  let changed = false;
  let nextDistrictsById = state.districtsById;

  for (const districtId of districtIds) {
    const district = state.districtsById[districtId];
    if (!district) {
      continue;
    }
    const fixedBuildingRate = fixedBuildingRatesByDistrictId[districtId];
    const modifierRate = districtModifierStatRates[districtId];
    const heatPerTick = Number(fixedBuildingRate?.heatPerTick || 0) + Number(modifierRate?.heatPerTick || 0);
    const influencePerTick = Number(fixedBuildingRate?.influencePerTick || 0) + Number(modifierRate?.influencePerTick || 0);

    if (
      Math.abs(heatPerTick) <= Number.EPSILON
      && Math.abs(influencePerTick) <= Number.EPSILON
    ) {
      continue;
    }

    nextDistrictsById = {
      ...nextDistrictsById,
      [district.id]: {
        ...district,
        heat: Math.max(0, Number(district.heat || 0) + heatPerTick),
        influence: Math.max(0, Number(district.influence || 0) + influencePerTick),
        version: district.version + 1
      }
    };
    changed = true;
  }

  return {
    changed,
    districtsById: nextDistrictsById
  };
};

const sanitizePerDay = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const positiveModifier = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const resolvePerTick = (perDay: number, ticksPerDay: number): number =>
  Number.isFinite(perDay) && ticksPerDay > 0 ? perDay / ticksPerDay : 0;

export const resolveDistrictTypeHeatPerTick = (
  zone: unknown,
  context: GameCoreContext
): number => {
  const zoneKey = String(zone || "").trim().toLowerCase();
  const heatPerHour = Number(
    context.config.balance.police?.districtHeatPerHourByZone?.[zoneKey] ?? 0
  );
  return Number.isFinite(heatPerHour) && heatPerHour > 0
    ? heatPerHour * Math.max(1, context.config.tickRateMs) / HOUR_MS
    : 0;
};

const nowIsoFromContext = (context: GameCoreContext): string =>
  context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();
