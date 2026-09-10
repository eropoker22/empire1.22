import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolveBuildingMaxLevel, resolveBuildingUpgradeCost } from "../buildings/buildingUpgradeRules";

export const positiveAssetAmount = (value: unknown): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export const calculateCommittedEliminationAssets = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext,
  resourceValue: (key: string, amount: unknown) => number
): { resourceValue: number; reservedCleanCash: number; buildingCapitalValue: number } => {
  const result = { resourceValue: 0, reservedCleanCash: 0, buildingCapitalValue: 0 };
  const valueStock = (stock: Record<string, unknown> | undefined): number => Object.entries(stock ?? {})
    .reduce((sum, [key, amount]) => sum + resourceValue(key, amount), 0);
  const ownedBuildings = Object.values(state.buildingsById).filter((building) =>
    building.status !== "destroyed"
    && (building.ownerPlayerId === playerId || (building.ownerPlayerId === "player:neutral"
      && state.districtsById[building.districtId]?.ownerPlayerId === playerId))
    && state.districtsById[building.districtId]?.status !== "destroyed"
  );
  const ownedBuildingIds = new Set(ownedBuildings.map((building) => building.id));
  const seenStocks = new Set<string>();
  for (const stock of Object.values(state.resourceStatesById)) {
    if (stock.ownerType !== "building" || !ownedBuildingIds.has(stock.ownerId) || seenStocks.has(stock.id)) continue;
    seenStocks.add(stock.id);
    result.resourceValue += valueStock(stock.balances);
  }
  for (const building of ownedBuildings) {
    for (const line of Object.values(building.productionLines ?? {})) {
      result.reservedCleanCash += positiveAssetAmount(line.reservedCleanCash);
      result.resourceValue += valueStock(line.reservedResourceCosts);
    }
    const maxLevel = Math.min(Math.floor(positiveAssetAmount(building.level)), resolveBuildingMaxLevel(building.buildingTypeId, context));
    for (let level = 1; level < maxLevel; level += 1) {
      const upgrade = resolveBuildingUpgradeCost({ ...building, level }, context);
      if (!upgrade) continue;
      result.buildingCapitalValue += positiveAssetAmount(upgrade.costs.cash) + valueStock(upgrade.costs);
    }
  }
  for (const district of Object.values(state.districtsById)) {
    if (district.ownerPlayerId === playerId && district.status !== "destroyed") result.resourceValue += valueStock(district.defenseLoadout);
  }
  for (const operation of Object.values(state.pendingDistrictActionOperationsById ?? {})) {
    if (operation.playerId === playerId) result.resourceValue += valueStock(operation.reservedAttackLoadout);
  }
  const listings = state.market?.playerListings;
  if (Array.isArray(listings)) {
    const seenListings = new Set<string>();
    for (const listing of listings) {
      if (!listing || listing.sellerPlayerId !== playerId || listing.status !== "active" || seenListings.has(listing.id)) continue;
      seenListings.add(listing.id);
      result.resourceValue += resourceValue(String(listing.resourceId), listing.amount);
    }
  }
  return result;
};
