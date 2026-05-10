import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { validateAirportAction } from "../handlers/airportBuildingActions";
import { validateArcadeAction } from "../handlers/arcadeBuildingActions";
import { validateApartmentBlockAction } from "../handlers/apartmentBlockBuildingActions";
import { validateCasinoAction } from "../handlers/casinoBuildingActions";
import { validateCentralBankAction } from "../handlers/centralBankBuildingActions";
import { validateCityHallAction } from "../handlers/cityHallBuildingActions";
import { validateClinicAction } from "../handlers/clinicBuildingActions";
import { validateExchangeOfficeAction } from "../handlers/exchangeOfficeBuildingActions";
import { validatePowerStationAction } from "../handlers/powerStationBuildingActions";
import { validateRecyclingCenterAction } from "../handlers/recyclingCenterBuildingActions";
import { validateSchoolAction } from "../handlers/schoolBuildingActions";
import { validateSmugglingTunnelAction } from "../handlers/smugglingTunnelBuildingActions";
import { validateStockExchangeAction } from "../handlers/stockExchangeBuildingActions";
import { validateStreetDealersAction } from "../handlers/streetDealersBuildingActions";
import { validateStripClubAction } from "../handlers/stripClubBuildingActions";

/**
 * Responsibility: Pure precondition checks for fixed-building gameplay actions.
 * Belongs here: existence, ownership, action compatibility, affordability, and cooldown checks.
 * Does not belong here: state mutation, transport mapping, or UI formatting.
 */
export const validateRunBuildingAction = (
  state: CoreGameState,
  command: RunBuildingActionCommand,
  context: GameCoreContext
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];
  const building = state.buildingsById[command.payload.buildingId];
  const action = context.config.balance.buildingActions?.[command.payload.actionId];
  const errors: CoreError[] = [];

  if (!player) {
    errors.push({
      code: "player_not_found",
      message: `Player ${command.playerId} was not found.`
    });
  }

  if (!district) {
    errors.push({
      code: "district_not_found",
      message: `District ${command.payload.districtId} was not found.`
    });
  }

  if (!building) {
    errors.push({
      code: "building_not_found",
      message: `Building ${command.payload.buildingId} was not found.`
    });
  }

  if (!action) {
    errors.push({
      code: "building_action_not_found",
      message: `Building action ${command.payload.actionId} is not configured.`
    });
  }

  if (errors.length > 0 || !player || !district || !building || !action) {
    return errors;
  }

  if (!district.buildingIds.includes(building.id) || building.districtId !== district.id) {
    errors.push({
      code: "building_not_in_district",
      message: "Target building is not fixed in the selected district."
    });
  }

  if (district.status === "destroyed") {
    errors.push({
      code: "district_destroyed",
      message: "Destroyed districts cannot run fixed-building actions."
    });
  }

  if (action.buildingType !== building.buildingTypeId) {
    errors.push({
      code: "building_action_type_mismatch",
      message: `Action ${action.actionId} cannot run on ${building.buildingTypeId}.`
    });
  }

  if (action.requiredOwner && (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId)) {
    errors.push({
      code: "building_action_owner_required",
      message: "Player must own the district and fixed building to run this action."
    });
  }

  if (district.status === "contested" && !action.allowedIfContested) {
    errors.push({
      code: "building_action_contested",
      message: "This building action cannot run while the district is contested."
    });
  }

  if (building.status !== "active") {
    errors.push({
      code: "building_not_active",
      message: "Only active fixed buildings can run actions."
    });
  }

  const cooldownUntilTick = Number((building.actionCooldowns ?? {})[action.actionId] ?? 0);
  if (cooldownUntilTick > state.root.tick) {
    errors.push({
      code: "building_action_cooldown",
      message: `Building action is cooling down for ${cooldownUntilTick - state.root.tick} more ticks.`
    });
  }

  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  const missingCosts = Object.entries(action.inputCost).filter(
    ([resourceKey, requiredAmount]) => Math.max(0, Number(balances[resourceKey] || 0)) < requiredAmount
  );

  if (missingCosts.length > 0) {
    errors.push({
      code: "building_action_insufficient_resources",
      message: `Missing resources: ${missingCosts.map(([key, amount]) => `${amount} ${key}`).join(", ")}.`
    });
  }

  const casinoErrorCode = validateCasinoAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    casinoConfig: context.config.balance.casino
  });
  if (casinoErrorCode) {
    errors.push({
      code: casinoErrorCode,
      message: "Casino action preconditions are not met."
    });
  }

  const exchangeOfficeErrorCode = validateExchangeOfficeAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    exchangeConfig: context.config.balance.exchangeOffice
  });
  if (exchangeOfficeErrorCode) {
    errors.push({
      code: exchangeOfficeErrorCode,
      message: "Exchange office action preconditions are not met."
    });
  }

  const arcadeErrorCode = validateArcadeAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    arcadeConfig: context.config.balance.arcade
  });
  if (arcadeErrorCode) {
    errors.push({
      code: arcadeErrorCode,
      message: "Arcade action preconditions are not met."
    });
  }

  const apartmentBlockErrorCode = validateApartmentBlockAction({
    state,
    building,
    actionId: action.actionId,
    apartmentConfig: context.config.balance.apartmentBlock
  });
  if (apartmentBlockErrorCode) {
    errors.push({
      code: apartmentBlockErrorCode,
      message: "Apartment block action preconditions are not met."
    });
  }

  const clinicErrorCode = validateClinicAction({
    state,
    playerId: player.id,
    actionId: action.actionId,
    balances,
    clinicConfig: context.config.balance.clinic,
    tickRateMs: context.config.tickRateMs
  });
  if (clinicErrorCode) {
    errors.push({
      code: clinicErrorCode,
      message: "Clinic action preconditions are not met."
    });
  }

  const recyclingCenterErrorCode = validateRecyclingCenterAction({
    state,
    playerId: player.id,
    actionId: action.actionId,
    balances,
    recyclingCenterConfig: context.config.balance.recyclingCenter,
    tickRateMs: context.config.tickRateMs
  });
  if (recyclingCenterErrorCode) {
    errors.push({
      code: recyclingCenterErrorCode,
      message: "Recycling center action preconditions are not met."
    });
  }

  const stripClubErrorCode = validateStripClubAction({
    state,
    district,
    building,
    actionId: action.actionId,
    stripClubConfig: context.config.balance.stripClub
  });
  if (stripClubErrorCode) {
    errors.push({
      code: stripClubErrorCode,
      message: "Strip Club action preconditions are not met."
    });
  }

  const powerStationErrorCode = validatePowerStationAction({
    state,
    building,
    actionId: action.actionId,
    powerStationConfig: context.config.balance.powerStation
  });
  if (powerStationErrorCode) {
    errors.push({
      code: powerStationErrorCode,
      message: "Power station action preconditions are not met."
    });
  }

  const smugglingTunnelErrorCode = validateSmugglingTunnelAction({
    state,
    player,
    building,
    actionId: action.actionId,
    balances,
    config: context.config.balance.smugglingTunnel
  });
  if (smugglingTunnelErrorCode) {
    errors.push({
      code: smugglingTunnelErrorCode,
      message: "Smuggling tunnel action preconditions are not met."
    });
  }

  const stockExchangeErrorCode = validateStockExchangeAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    districtInfluence: district.influence,
    config: context.config.balance.stockExchange,
    payload: command.payload
  });
  if (stockExchangeErrorCode) {
    errors.push({
      code: stockExchangeErrorCode,
      message: "Stock exchange action preconditions are not met."
    });
  }

  const airportErrorCode = validateAirportAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    config: context.config.balance.airport,
    payload: command.payload
  });
  if (airportErrorCode) {
    errors.push({
      code: airportErrorCode,
      message: "Airport action preconditions are not met."
    });
  }

  const cityHallErrorCode = validateCityHallAction({
    state,
    building,
    district,
    actionId: action.actionId,
    balances,
    districtInfluence: district.influence,
    config: context.config.balance.cityHall,
    payload: command.payload
  });
  if (cityHallErrorCode) {
    errors.push({
      code: cityHallErrorCode,
      message: "City Hall action preconditions are not met."
    });
  }

  const centralBankErrorCode = validateCentralBankAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    districtInfluence: district.influence,
    config: context.config.balance.centralBank,
    payload: command.payload
  });
  if (centralBankErrorCode) {
    errors.push({
      code: centralBankErrorCode,
      message: "Central Bank action preconditions are not met."
    });
  }

  const schoolErrorCode = validateSchoolAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    config: context.config.balance.school
  });
  if (schoolErrorCode) {
    errors.push({
      code: schoolErrorCode,
      message: "School action preconditions are not met."
    });
  }

  const streetDealersErrorCode = validateStreetDealersAction({
    state,
    player,
    building,
    command,
    actionId: action.actionId,
    balances,
    config: context.config.balance.streetDealers
  });
  if (streetDealersErrorCode) {
    errors.push({
      code: streetDealersErrorCode,
      message: "Street dealers action preconditions are not met."
    });
  }

  return errors;
};
