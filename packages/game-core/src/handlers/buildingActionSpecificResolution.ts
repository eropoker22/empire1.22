import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { resolveAirportAction } from "./airportBuildingActions";
import { resolveArcadeAction } from "./arcadeBuildingActions";
import { resolveApartmentBlockAction } from "./apartmentBlockBuildingActions";
import { resolveCasinoAction } from "./casinoBuildingActions";
import { resolveCentralBankAction } from "./centralBankBuildingActions";
import { resolveCityHallAction } from "./cityHallBuildingActions";
import { resolveClinicAction } from "./clinicBuildingActions";
import { resolveConvenienceStoreAction } from "./convenienceStoreBuildingActions";
import { resolveExchangeOfficeAction } from "./exchangeOfficeBuildingActions";
import { resolveLobbyClubAction } from "./lobbyClubBuildingActions";
import { resolvePowerStationAction } from "./powerStationBuildingActions";
import { resolveRecyclingCenterAction } from "./recyclingCenterBuildingActions";
import { resolveSchoolAction } from "./schoolBuildingActions";
import { resolveSmugglingTunnelAction } from "./smugglingTunnelBuildingActions";
import { resolveStockExchangeAction } from "./stockExchangeBuildingActions";
import { resolveStreetDealersAction } from "./streetDealersBuildingActions";
import { resolveStripClubAction } from "./stripClubBuildingActions";

interface BuildingActionSpecificResolutionInput {
  state: CoreGameState;
  command: RunBuildingActionCommand;
  context: GameCoreContext;
  player: CoreGameState["playersById"][string];
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
}

export const resolveBuildingActionSpecificResolution = (
  input: BuildingActionSpecificResolutionInput
) => {
  const { state, command, context, player, district, building, action, balances: nextBalances } = input;
  const casinoResolution = context.config.balance.casino
    ? resolveCasinoAction({
        state,
        building,
        action,
        balances: nextBalances,
        casinoConfig: context.config.balance.casino,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id
      })
    : null;
  const exchangeOfficeResolution = !casinoResolution && context.config.balance.exchangeOffice
    ? resolveExchangeOfficeAction({
        state,
        building,
        action,
        balances: nextBalances,
        exchangeConfig: context.config.balance.exchangeOffice,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const arcadeResolution = !casinoResolution && !exchangeOfficeResolution && context.config.balance.arcade
    ? resolveArcadeAction({
        state,
        building,
        action,
        balances: nextBalances,
        arcadeConfig: context.config.balance.arcade,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const apartmentBlockResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && context.config.balance.apartmentBlock
    ? resolveApartmentBlockAction({
        state,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        apartmentConfig: context.config.balance.apartmentBlock
      })
    : null;
  const convenienceStoreResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && context.config.balance.convenienceStore
    ? resolveConvenienceStoreAction({
        state,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        config: context.config.balance.convenienceStore
      })
    : null;
  const clinicResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && context.config.balance.clinic
    ? resolveClinicAction({
        state,
        playerId: player.id,
        actionId: action.actionId,
        balances: nextBalances,
        clinicConfig: context.config.balance.clinic,
        warehouseConfig: context.config.balance.warehouse,
        powerStationConfig: context.config.balance.powerStation,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const recyclingCenterResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && context.config.balance.recyclingCenter
    ? resolveRecyclingCenterAction({
        state,
        playerId: player.id,
        actionId: action.actionId,
        balances: nextBalances,
        recyclingCenterConfig: context.config.balance.recyclingCenter,
        warehouseConfig: context.config.balance.warehouse,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const stripClubResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && context.config.balance.stripClub
    ? resolveStripClubAction({
        state,
        building,
        action,
        balances: nextBalances,
        stripClubConfig: context.config.balance.stripClub,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id
      })
    : null;
  const powerStationResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && context.config.balance.powerStation
    ? resolvePowerStationAction({
        state,
        building,
        action,
        balances: nextBalances,
        powerStationConfig: context.config.balance.powerStation,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const smugglingTunnelResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && context.config.balance.smugglingTunnel
    ? resolveSmugglingTunnelAction({
        state,
        player,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        config: context.config.balance.smugglingTunnel,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const stockExchangeResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && context.config.balance.stockExchange
    ? resolveStockExchangeAction({
        state,
        building,
        action,
        balances: nextBalances,
        config: context.config.balance.stockExchange,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id,
        payload: command.payload
      })
    : null;
  const airportResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && context.config.balance.airport
    ? resolveAirportAction({
        state,
        building,
        action,
        balances: nextBalances,
        config: context.config.balance.airport,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id,
        payload: command.payload
      })
    : null;
  const cityHallResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && !airportResolution && context.config.balance.cityHall
    ? resolveCityHallAction({
        state,
        building,
        action,
        balances: nextBalances,
        district,
        config: context.config.balance.cityHall,
        lobbyClubConfig: context.config.balance.lobbyClub,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id,
        payload: command.payload
      })
    : null;
  const centralBankResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && !airportResolution && !cityHallResolution && context.config.balance.centralBank
    ? resolveCentralBankAction({
        state,
        building,
        action,
        balances: nextBalances,
        config: context.config.balance.centralBank,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id,
        payload: command.payload
      })
    : null;
  const schoolResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && !airportResolution && !cityHallResolution && !centralBankResolution && context.config.balance.school
    ? resolveSchoolAction({
        state,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        config: context.config.balance.school,
        tickRateMs: context.config.tickRateMs
    })
    : null;
  const lobbyClubResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && !airportResolution && !cityHallResolution && !centralBankResolution && !schoolResolution && context.config.balance.lobbyClub
    ? resolveLobbyClubAction({
        state,
        building,
        action,
        balances: nextBalances,
        district,
        config: context.config.balance.lobbyClub,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id,
        payload: command.payload
      })
    : null;
  const streetDealersResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && !smugglingTunnelResolution && !stockExchangeResolution && !airportResolution && !cityHallResolution && !centralBankResolution && !schoolResolution && !lobbyClubResolution && context.config.balance.streetDealers
    ? resolveStreetDealersAction({
        state,
        player,
        building,
        action,
        command,
        balances: nextBalances,
        config: context.config.balance.streetDealers,
        smugglingTunnelConfig: context.config.balance.smugglingTunnel,
        tickRateMs: context.config.tickRateMs,
        context
      })
    : null;
  const specialResolution = casinoResolution ?? exchangeOfficeResolution ?? arcadeResolution ?? apartmentBlockResolution ?? convenienceStoreResolution ?? clinicResolution ?? recyclingCenterResolution ?? stripClubResolution ?? powerStationResolution ?? smugglingTunnelResolution ?? stockExchangeResolution ?? airportResolution ?? cityHallResolution ?? centralBankResolution ?? schoolResolution ?? lobbyClubResolution ?? streetDealersResolution;
  return {
    casinoResolution,
    exchangeOfficeResolution,
    arcadeResolution,
    apartmentBlockResolution,
    convenienceStoreResolution,
    clinicResolution,
    recyclingCenterResolution,
    stripClubResolution,
    powerStationResolution,
    smugglingTunnelResolution,
    stockExchangeResolution,
    airportResolution,
    cityHallResolution,
    centralBankResolution,
    schoolResolution,
    lobbyClubResolution,
    streetDealersResolution,
    specialResolution
  };
};
