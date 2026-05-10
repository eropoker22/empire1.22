import { createDistrictPanelView } from "@empire/game-core";
import { getPublicBuildingCatalog } from "@empire/game-config";
import type { DistrictPanelView } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Server-side composition of district panel projection data.
 * Belongs here: combining authoritative state with mode-aware public build catalog data.
 * Does not belong here: client rendering or command mutation.
 */
export const createDistrictPanelProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  districtId: string
): DistrictPanelView | null =>
  createDistrictPanelView(runtime.state, {
    playerId,
    districtId,
    buildCatalog: getPublicBuildingCatalog(runtime.record.mode),
    productionCatalog: runtime.config.balance.productionBuildings ?? {},
    craftCatalog: runtime.config.balance.craftBuildings ?? {},
    buildingActionCatalog: runtime.config.balance.buildingActions ?? {},
    stripClubConfig: runtime.config.balance.stripClub,
    restaurantConfig: runtime.config.balance.restaurant,
    convenienceStoreConfig: runtime.config.balance.convenienceStore,
    shoppingMallConfig: runtime.config.balance.shoppingMall,
    stockExchangeConfig: runtime.config.balance.stockExchange,
    centralBankConfig: runtime.config.balance.centralBank,
    airportConfig: runtime.config.balance.airport,
    cityHallConfig: runtime.config.balance.cityHall,
    vipLoungeConfig: runtime.config.balance.vipLounge,
    fitnessClubConfig: runtime.config.balance.fitnessClub,
    powerStationConfig: runtime.config.balance.powerStation,
    recruitmentCenterConfig: runtime.config.balance.recruitmentCenter,
    garageConfig: runtime.config.balance.garage,
    carDealerConfig: runtime.config.balance.carDealer,
    smugglingTunnelConfig: runtime.config.balance.smugglingTunnel,
    streetDealersConfig: runtime.config.balance.streetDealers,
    schoolConfig: runtime.config.balance.school,
    recyclingCenterConfig: runtime.config.balance.recyclingCenter,
    productionMultiplier: runtime.config.balance.productionMultiplier,
    tickRateMs: runtime.config.tickRateMs
  });
