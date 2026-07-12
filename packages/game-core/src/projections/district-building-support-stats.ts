import {
  getOwnedFitnessClubCount,
  resolveFitnessClubNetworkMultipliers,
  resolveFitnessClubSupportBonuses
} from "../handlers/fitnessClubBuildingActions";
import {
  getOwnedGarageCount,
  resolveGarageCooldownStats,
  resolveGarageNetworkMultipliers
} from "../handlers/garageBuildingActions";
import {
  getOwnedRecyclingCenterCount,
  resolveRecyclingCenterNetworkMultipliers,
  resolveRecyclingCenterSalvageStats
} from "../handlers/recyclingCenterBuildingActions";
import {
  getOwnedSchoolCount,
  getSchoolMetadata,
  isEveningCourseActive,
  resolveSchoolCapacity,
  resolveSchoolNetworkMultipliers
} from "../handlers/schoolBuildingActions";
import { formatCategoryList, formatNumber, formatTickLabel } from "./district-building-action-formatters";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

const formatMultiplierBonus = (value: number): string =>
  `${Number(value || 1) >= 1 ? "+" : ""}${formatNumber((Number(value || 1) - 1) * 100)} %`;

export const createSupportBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] | null => {
  if (input.building.buildingTypeId === "school" && input.schoolConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedSchoolCount(input.state, input.building.ownerPlayerId, input.schoolConfig);
    const network = resolveSchoolNetworkMultipliers(ownedCount, input.schoolConfig);
    const metadata = getSchoolMetadata(input.building, input.tick);
    const eveningActive = isEveningCourseActive(metadata, input.tick);
    const capacity = resolveSchoolCapacity({
      state: input.state,
      building: input.building,
      config: input.schoolConfig
    });
    const stored = Math.min(capacity, metadata.storedStudents);
    const productionPerMinute = input.schoolConfig.populationPerMinute
      * network.populationProductionMultiplier;
    const timeToFullTicks = productionPerMinute > 0 && stored < capacity
      ? Math.ceil((capacity - stored) / productionPerMinute * 60000 / Math.max(1, input.tickRateMs ?? 5000))
      : 0;
    return [
      { label: "Clean / min", value: `$${formatNumber(input.schoolConfig.cleanCashPerMinute * network.incomeMultiplier * (eveningActive ? input.schoolConfig.eveningCourse.cleanIncomeMultiplier : 1))}` },
      { label: "Influence / min", value: formatNumber(input.schoolConfig.influencePerMinute) },
      { label: "Populace / min", value: formatNumber(productionPerMinute) },
      { label: "Populace", value: `${formatNumber(Math.floor(stored))} / ${formatNumber(capacity)}` },
      { label: "Do naplnění", value: stored >= capacity ? "Plná kapacita" : formatTickLabel(timeToFullTicks) },
      { label: "Vlastněné školy", value: `${ownedCount}/${input.schoolConfig.countOnMap}` },
      { label: "Produkce populace", value: formatMultiplierBonus(network.populationProductionMultiplier) },
      { label: "Kapacita", value: formatMultiplierBonus(network.studentCapacityMultiplier) },
      { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
      { label: "Večerní kurz", value: eveningActive ? `aktivní ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}` : "připraveno po čekání" }
    ];
  }
  if (input.building.buildingTypeId === "fitness_club" && input.fitnessClubConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedFitnessClubCount(input.state, input.building.ownerPlayerId, input.fitnessClubConfig);
    const network = resolveFitnessClubNetworkMultipliers(ownedCount, input.fitnessClubConfig);
    const support = resolveFitnessClubSupportBonuses({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.fitnessClubConfig
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.fitnessClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.fitnessClubConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastněné fitness cluby", value: `${ownedCount}/${input.fitnessClubConfig.countOnMap}` },
      { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
      { label: "Síla útoku", value: `+${formatNumber(support.attackStrengthBonusPct)} %` },
      { label: "Síla obrany", value: `+${formatNumber(support.defenseStrengthBonusPct)} %` },
      { label: "Cap útoku", value: `+${formatNumber(support.combinedRecruitmentFitnessAttackCapPct)} %` },
      { label: "Cap obrany", value: `+${formatNumber(support.combinedRecruitmentFitnessDefenseCapPct)} %` },
      { label: "Platí na útok", value: "gang, pálky, pistole, granáty, samopaly a bazuky podle váhy" },
      { label: "Platí na obranu", value: "gang, vesty a barikády; ne kamery ani alarm" }
    ];
  }
  if (input.building.buildingTypeId === "garage" && input.garageConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedGarageCount(input.state, input.building.ownerPlayerId, input.garageConfig);
    const network = resolveGarageNetworkMultipliers(ownedCount, input.garageConfig);
    const cooldownStats = resolveGarageCooldownStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.garageConfig
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.garageConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.garageConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastněné garáže", value: `${ownedCount}/${input.garageConfig.countOnMap}` },
      { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
      { label: "Zkrácení čekání", value: `-${formatNumber(cooldownStats.cooldownReductionPct)} %` },
      { label: "Plný bonus", value: formatCategoryList(cooldownStats.fullBonusCategories) },
      { label: "Poloviční bonus", value: formatCategoryList(cooldownStats.halfBonusCategories) },
      { label: "Bez bonusu", value: formatCategoryList(cooldownStats.excludedCategories) }
    ];
  }
  if (input.building.buildingTypeId === "recycling_center" && input.recyclingCenterConfig && input.building.ownerPlayerId) {
    const recyclingCenterConfig = input.recyclingCenterConfig;
    const ownedCount = getOwnedRecyclingCenterCount(input.state, input.building.ownerPlayerId, recyclingCenterConfig);
    const network = resolveRecyclingCenterNetworkMultipliers(ownedCount, recyclingCenterConfig);
    const salvageStats = resolveRecyclingCenterSalvageStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: recyclingCenterConfig,
      tickRateMs: input.tickRateMs ?? 5000
    });
    const poolTotal = salvageStats.freshPool.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0);
    const ttlMs = recyclingCenterConfig.salvage.poolTtlMinutes * 60000;
    const ttlTicks = Math.ceil(ttlMs / Math.max(1, input.tickRateMs ?? 5000));
    const nextExpiry = salvageStats.freshPool.reduce<number | null>((next, entry) => {
      const lostAtTick = Number(entry.lostAtTick);
      const expiresAtTick = Number.isFinite(lostAtTick)
        ? lostAtTick + ttlTicks
        : Number.isFinite(Date.parse(entry.lostAt || ""))
          ? input.tick + Math.ceil(Math.max(0, Date.parse(entry.lostAt || "") + ttlMs - Date.now()) / Math.max(1, input.tickRateMs ?? 5000))
          : null;
      if (expiresAtTick === null) return next;
      const remaining = Math.max(0, expiresAtTick - input.tick);
      return next === null ? remaining : Math.min(next, remaining);
    }, null);
    return [
      { label: "Clean / min", value: `$${formatNumber(recyclingCenterConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(recyclingCenterConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastněná centra", value: `${ownedCount}/${recyclingCenterConfig.countOnMap}` },
      { label: "Síťový income", value: `+${formatNumber((network.incomeMultiplier - 1) * 100)} %` },
      { label: "Návrat itemů", value: `${formatNumber(salvageStats.salvageRatePct)} %` },
      { label: "Ztráty k vytěžení", value: `${formatNumber(poolTotal)} itemů` },
      { label: "Nejbližší expirace", value: nextExpiry === null ? "žádná" : formatTickLabel(nextExpiry) },
      { label: "Cena akce", value: `$${formatNumber(recyclingCenterConfig.extractLosses.cleanCashCost)} clean` },
      { label: "Rozsah", value: "jen ztracené itemy" }
    ];
  }
  return null;
};
