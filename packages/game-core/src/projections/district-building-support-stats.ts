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
  resolveSchoolNetworkMultipliers,
  resolveSchoolTalentChancePct
} from "../handlers/schoolBuildingActions";
import { formatCategoryList, formatNumber, formatTickLabel } from "./district-building-action-formatters";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

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
      * network.populationProductionMultiplier
      * (eveningActive ? input.schoolConfig.eveningCourse.populationProductionMultiplier : 1);
    const timeToFullTicks = productionPerMinute > 0 && stored < capacity
      ? Math.ceil((capacity - stored) / productionPerMinute * 60000 / Math.max(1, input.tickRateMs ?? 5000))
      : 0;
    const talentChancePct = resolveSchoolTalentChancePct({
      ownedCount,
      config: input.schoolConfig,
      eveningCourseActive: eveningActive
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.schoolConfig.cleanCashPerMinute * network.incomeMultiplier * (eveningActive ? input.schoolConfig.eveningCourse.cleanIncomeMultiplier : 1))}` },
      { label: "Influence / min", value: formatNumber(input.schoolConfig.influencePerMinute) },
      { label: "Population / min", value: formatNumber(productionPerMinute) },
      { label: "Students", value: `${formatNumber(Math.floor(stored))} / ${formatNumber(capacity)}` },
      { label: "Time to full", value: stored >= capacity ? "Plná kapacita" : formatTickLabel(timeToFullTicks) },
      { label: "Owned schools", value: `${ownedCount}/${input.schoolConfig.countOnMap}` },
      { label: "Population multiplier", value: `x${formatNumber(network.populationProductionMultiplier)}` },
      { label: "Capacity multiplier", value: `x${formatNumber(network.studentCapacityMultiplier)}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Talent chance", value: `${formatNumber(talentChancePct)} %` },
      { label: "Výsledek talentu", value: "jen uliční zprávy" },
      { label: "Evening course", value: eveningActive ? `active ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}` : "ready when off cooldown" }
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
      { label: "Owned fitness clubs", value: `${ownedCount}/${input.fitnessClubConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Attack strength bonus", value: `+${formatNumber(support.attackStrengthBonusPct)} %` },
      { label: "Defense strength bonus", value: `+${formatNumber(support.defenseStrengthBonusPct)} %` },
      { label: "Recruitment + fitness attack cap", value: `+${formatNumber(support.combinedRecruitmentFitnessAttackCapPct)} %` },
      { label: "Recruitment + fitness defense cap", value: `+${formatNumber(support.combinedRecruitmentFitnessDefenseCapPct)} %` },
      { label: "Attack applies to", value: "gang body, bats, pistols, grenades, SMGs, bazookas by weight" },
      { label: "Defense applies to", value: "gang body, vests, barricades; not cameras or alarm" }
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
      { label: "Owned garages", value: `${ownedCount}/${input.garageConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Cooldown reduction", value: `-${formatNumber(cooldownStats.cooldownReductionPct)} %` },
      { label: "Full bonus categories", value: formatCategoryList(cooldownStats.fullBonusCategories) },
      { label: "Half bonus categories", value: formatCategoryList(cooldownStats.halfBonusCategories) },
      { label: "No bonus categories", value: formatCategoryList(cooldownStats.excludedCategories) }
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
    const nextExpiry = salvageStats.freshPool.reduce<number | null>((next, entry) => {
      const lostAtTick = Number(entry.lostAtTick);
      if (!Number.isFinite(lostAtTick)) return next;
      const expiresAtTick = lostAtTick + Math.ceil(recyclingCenterConfig.salvage.poolTtlMinutes * 60000 / Math.max(1, input.tickRateMs ?? 5000));
      const remaining = Math.max(0, expiresAtTick - input.tick);
      return next === null ? remaining : Math.min(next, remaining);
    }, null);
    return [
      { label: "Clean / min", value: `$${formatNumber(recyclingCenterConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(recyclingCenterConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned centers", value: `${ownedCount}/${recyclingCenterConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Salvage rate", value: `${formatNumber(salvageStats.salvageRatePct)} %` },
      { label: "Material salvage pool", value: `${formatNumber(poolTotal)} materials` },
      { label: "Next expiry", value: nextExpiry === null ? "none" : formatTickLabel(nextExpiry) },
      { label: "Action cost", value: `$${formatNumber(recyclingCenterConfig.extractLosses.cleanCashCost)}` },
      { label: "Recovery scope", value: "lost materials only" }
    ];
  }
  return null;
};
