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
  getFactionPassiveModifiers
} from "../factions/factionRules";
import { resolveFixedBuildingIncomeConfig } from "./fixedBuildingIncomeConfig";
import { applyArcadeAuditChecks } from "../../handlers/arcadeBuildingActions";
import { applyApartmentBlockPopulationProduction } from "../../handlers/apartmentBlockBuildingActions";
import { applyCasinoAuditChecks } from "../../handlers/casinoBuildingActions";
import { applyConvenienceStorePassiveRumors } from "../../handlers/convenienceStoreBuildingActions";
import { applyExchangeOfficeAuditChecks } from "../../handlers/exchangeOfficeBuildingActions";
import { applyRestaurantPassiveRumors } from "../../handlers/restaurantBuildingActions";
import { applySchoolStudentProduction } from "../../handlers/schoolBuildingActions";
import { applyLobbyClubScandalChecks } from "../../handlers/lobbyClubBuildingActions";
import {
  applySmugglingTunnelBatchProduction
} from "../../handlers/smugglingTunnelBuildingActions";
import { applyStripClubPassiveRumors } from "../../handlers/stripClubBuildingActions";
import { applyVipLoungePassiveRumors } from "../../handlers/vipLoungeBuildingActions";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Responsibility: Applies periodic income collection to the authoritative state.
 * Belongs here: server-side economy transitions driven by ticks or commands.
 * Does not belong here: UI timing or client cache updates.
 */
export const collectIncome = (state: CoreGameState, context?: GameCoreContext): CoreGameState => {
  const incomeByPlayerId = calculateIncomeByPlayerId(state, context);

  if (!context && Object.keys(incomeByPlayerId).length === 0) {
    return state;
  }

  let changed = false;
  let nextResourceStatesById = state.resourceStatesById;

  for (const [playerId, incomeBalances] of Object.entries(incomeByPlayerId)) {
    const player = state.playersById[playerId];

    if (!player) {
      continue;
    }

    const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextBalances = {
      ...currentResourceState.balances
    };

    for (const [resourceKey, amount] of Object.entries(incomeBalances)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
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
    ? applyFixedBuildingPassivePressure(state, context)
    : {
        changed: false,
        districtsById: state.districtsById
      };
  changed = changed || districtPressureResult.changed;

  const incomeState = changed
    ? {
        ...state,
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
  const smugglingTunnelState = context?.config.balance.smugglingTunnel
    ? applySmugglingTunnelBatchProduction({
        state: schoolState,
        config: context.config.balance.smugglingTunnel,
        tickRateMs: context.config.tickRateMs,
        incomeMultiplier: context.config.balance.incomeMultiplier
      })
    : schoolState;
  const stripClubRumorState = context?.config.balance.stripClub
    ? applyStripClubPassiveRumors(smugglingTunnelState, context.config.balance.stripClub, context.config.tickRateMs, context.config.balance.lobbyClub, context.config)
    : smugglingTunnelState;
  const restaurantRumorState = context?.config.balance.restaurant
    ? applyRestaurantPassiveRumors(stripClubRumorState, context.config.balance.restaurant, context.config.tickRateMs, context.config.balance.lobbyClub, context.config)
    : stripClubRumorState;
  const convenienceRumorState = context?.config.balance.convenienceStore
    ? applyConvenienceStorePassiveRumors(restaurantRumorState, context.config.balance.convenienceStore, context.config.tickRateMs, context.config.balance.restaurant, context.config.balance.lobbyClub, context.config)
    : restaurantRumorState;
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
  context: GameCoreContext
): { changed: boolean; districtsById: CoreGameState["districtsById"] } => {
  if (!context.config.balance.fixedBuildings) {
    return {
      changed: false,
      districtsById: state.districtsById
    };
  }

  const ticksPerDay = DAY_MS / Math.max(1, context.config.tickRateMs);
  let changed = false;
  let nextDistrictsById = state.districtsById;

  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || district.status === "destroyed") {
      continue;
    }

    const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
    const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
    const factionModifiers = getFactionPassiveModifiers(state, district.ownerPlayerId, context);
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
      basePressure.influencePerDay * modifiers.influenceMultiplier + modifiers.influencePerDay,
      factionModifiers
    );
    const heatDelta = resolvePerTick(heatPerDay, ticksPerDay);
    const influenceDelta = resolvePerTick(influencePerDay, ticksPerDay);

    if (Math.abs(heatDelta) <= Number.EPSILON && Math.abs(influenceDelta) <= Number.EPSILON) {
      continue;
    }

    const nextHeat = Math.max(0, Number(district.heat || 0) + heatDelta);
    const nextInfluence = Math.max(0, Number(district.influence || 0) + influenceDelta);

    nextDistrictsById = {
      ...nextDistrictsById,
      [district.id]: {
        ...district,
        heat: nextHeat,
        influence: nextInfluence,
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

const resolvePerTick = (perDay: number, ticksPerDay: number): number =>
  Number.isFinite(perDay) && ticksPerDay > 0 ? perDay / ticksPerDay : 0;
