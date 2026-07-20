import type { CoreError } from "../errors";
import { validateAirportAction } from "../handlers/airportBuildingActions";
import { validateArcadeAction } from "../handlers/arcadeBuildingActions";
import { validateApartmentBlockAction } from "../handlers/apartmentBlockBuildingActions";
import { validateCasinoAction } from "../handlers/casinoBuildingActions";
import { validateCentralBankAction } from "../handlers/centralBankBuildingActions";
import { validateCityHallAction } from "../handlers/cityHallBuildingActions";
import { validateClinicAction } from "../handlers/clinicBuildingActions";
import { validateConvenienceStoreAction } from "../handlers/convenienceStoreBuildingActions";
import { validateExchangeOfficeAction } from "../handlers/exchangeOfficeBuildingActions";
import { validateLobbyClubAction } from "../handlers/lobbyClubBuildingActions";
import { validatePowerStationAction } from "../handlers/powerStationBuildingActions";
import { validateRecyclingCenterAction } from "../handlers/recyclingCenterBuildingActions";
import { validateSchoolAction } from "../handlers/schoolBuildingActions";
import { validateSmugglingTunnelAction } from "../handlers/smugglingTunnelBuildingActions";
import { validateStockExchangeAction } from "../handlers/stockExchangeBuildingActions";
import { validateStreetDealersAction } from "../handlers/streetDealersBuildingActions";
import { validateStripClubAction } from "../handlers/stripClubBuildingActions";
import type { SpecificBuildingActionValidationInput } from "./buildingActionSpecificValidationTypes";

export const validateRunBuildingActionSpecifics = (
  input: SpecificBuildingActionValidationInput
): CoreError[] => {
  const { state, command, context, player, district, building, action, balances } = input;
  const errors: CoreError[] = [];
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

  const convenienceStoreErrorCode = validateConvenienceStoreAction({
    building,
    actionId: action.actionId,
    config: context.config.balance.convenienceStore
  });
  if (convenienceStoreErrorCode) {
    errors.push({
      code: convenienceStoreErrorCode,
      message: "Convenience store action preconditions are not met."
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

  const lobbyClubErrorCode = validateLobbyClubAction({
    state,
    building,
    actionId: action.actionId,
    balances,
    districtInfluence: district.influence,
    config: context.config.balance.lobbyClub
  });
  if (lobbyClubErrorCode) {
    errors.push({
      code: lobbyClubErrorCode,
      message: "Lobby Club action preconditions are not met."
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
