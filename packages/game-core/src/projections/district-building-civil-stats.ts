import {
  getOwnedConvenienceStoreCount,
  resolveConvenienceStoreNetworkMultipliers,
  resolveConvenienceStoreRumorStats
} from "../handlers/convenienceStoreBuildingActions";
import {
  getOwnedPowerStationCount,
  getPowerStationMetadata,
  resolvePowerStationInfrastructureBonusPct,
  resolvePowerStationNetworkMultipliers
} from "../handlers/powerStationBuildingActions";
import {
  getOwnedRecruitmentCenterCount,
  resolveRecruitmentCenterNetworkMultipliers,
  resolveRecruitmentCenterSupportBonuses
} from "../handlers/recruitmentCenterBuildingActions";
import {
  getOwnedRestaurantCount,
  resolveRestaurantNetworkMultipliers,
  resolveRestaurantRumorStats
} from "../handlers/restaurantBuildingActions";
import {
  getOwnedStripClubCount,
  getStripClubMetadata,
  resolveStripClubNetworkMultipliers,
  resolveStripClubRumorStats
} from "../handlers/stripClubBuildingActions";
import { formatNumber, formatTickLabel } from "./district-building-action-formatters";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

export const createCivilBuildingStats = (
  input: BuildingStatsProjectionInput,
  baseStats: BuildingStatView[]
): BuildingStatView[] => {
  if (input.building.buildingTypeId !== "strip_club" || !input.stripClubConfig || !input.building.ownerPlayerId) {
    if (input.building.buildingTypeId !== "power_station" || !input.powerStationConfig || !input.building.ownerPlayerId) {
      if (input.building.buildingTypeId !== "restaurant" || !input.restaurantConfig || !input.building.ownerPlayerId) {
        if (input.building.buildingTypeId !== "convenience_store" || !input.convenienceStoreConfig || !input.building.ownerPlayerId) {
          if (input.building.buildingTypeId !== "recruitment_center" || !input.recruitmentCenterConfig || !input.building.ownerPlayerId) {
            return baseStats;
          }
          const ownedCount = getOwnedRecruitmentCenterCount(input.state, input.building.ownerPlayerId, input.recruitmentCenterConfig);
          const network = resolveRecruitmentCenterNetworkMultipliers(ownedCount, input.recruitmentCenterConfig);
          const support = resolveRecruitmentCenterSupportBonuses({
            state: input.state,
            playerId: input.building.ownerPlayerId,
            config: input.recruitmentCenterConfig
          });
          return [
            { label: "Clean / min", value: `$${formatNumber(input.recruitmentCenterConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
            { label: "Heat / min", value: formatNumber(input.recruitmentCenterConfig.heatPerMinute * network.heatMultiplier) },
            { label: "Owned centers", value: `${ownedCount}/${input.recruitmentCenterConfig.countOnMap}` },
            { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
            { label: "Apartment production bonus", value: `+${formatNumber(support.populationProductionBonusPct)} %` },
            { label: "Apartment capacity bonus", value: `+${formatNumber(support.apartmentCapacityBonusPct)} %` },
            { label: "Attack weapon strength", value: `+${formatNumber(support.attackWeaponStrengthBonusPct)} %` },
            { label: "Defense item strength", value: `+${formatNumber(support.defenseItemStrengthBonusPct)} %` },
            { label: "Camera/alarm combined cap", value: `max +${formatNumber(support.combinedCameraAlarmCapPct)} %` }
          ];
          }
          const ownedCount = getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.convenienceStoreConfig);
        const network = resolveConvenienceStoreNetworkMultipliers(ownedCount, input.convenienceStoreConfig);
        const rumorStats = resolveConvenienceStoreRumorStats({
          state: input.state,
          playerId: input.building.ownerPlayerId,
          config: input.convenienceStoreConfig,
          restaurantConfig: input.restaurantConfig
        });
        const civilNetworkBonus = rumorStats.civilRumorChanceBonusPct > 0
          ? `+${formatNumber(rumorStats.civilRumorChanceBonusPct)} %`
          : "inactive";
        return [
          { label: "Clean / min", value: `$${formatNumber(input.convenienceStoreConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
          { label: "Dirty / min", value: `$${formatNumber(input.convenienceStoreConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
          { label: "Influence / min", value: formatNumber(input.convenienceStoreConfig.influencePerMinute * network.influenceMultiplier) },
          { label: "Heat / min", value: formatNumber(input.convenienceStoreConfig.heatPerMinute * network.heatMultiplier) },
          { label: "Owned stores", value: `${ownedCount}/${input.convenienceStoreConfig.countOnMap}` },
          { label: "Clean income multiplier", value: `x${formatNumber(network.cleanIncomeMultiplier)}` },
          { label: "Dirty income multiplier", value: `x${formatNumber(network.dirtyIncomeMultiplier)}` },
          { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
          { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
          { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
          { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` },
          { label: "Civil network bonus", value: civilNetworkBonus }
        ];
      }
      const ownedCount = getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.restaurantConfig);
      const network = resolveRestaurantNetworkMultipliers(ownedCount, input.restaurantConfig);
      const rumorStats = resolveRestaurantRumorStats({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.restaurantConfig,
        dayNightConfig: input.dayNightConfig
      });
      return [
        { label: "Clean / min", value: `$${formatNumber(input.restaurantConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
        { label: "Influence / min", value: formatNumber(input.restaurantConfig.influencePerMinute * network.influenceMultiplier) },
        { label: "Heat / min", value: formatNumber(input.restaurantConfig.heatPerMinute * network.heatMultiplier) },
        { label: "Owned restaurants", value: `${ownedCount}/${input.restaurantConfig.countOnMap}` },
        { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
        { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
        { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
        { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
        { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` }
      ];
    }
    const ownedCount = getOwnedPowerStationCount(input.state, input.building.ownerPlayerId, input.powerStationConfig);
    const network = resolvePowerStationNetworkMultipliers(ownedCount, input.powerStationConfig);
    const metadata = getPowerStationMetadata(input.building);
    const infrastructureBonusPct = resolvePowerStationInfrastructureBonusPct({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.powerStationConfig,
      tick: input.tick
    });
    const remaining = Math.max(0, (metadata.backupGridSwitchExpiresAtTick ?? 0) - input.tick);
    return [
      { label: "Clean / min", value: `$${formatNumber(input.powerStationConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.powerStationConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned stations", value: `${ownedCount}/${input.powerStationConfig.countOnMap}` },
      { label: "Infrastructure bonus", value: `${formatNumber(infrastructureBonusPct)} %` },
      { label: "Station income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Camera bonus", value: `${formatNumber(network.cameraStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.cameraStrengthBonusPct : 0))} %` },
      { label: "Alarm bonus", value: `${formatNumber(network.alarmStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.alarmStrengthBonusPct : 0))} %` },
      { label: "Backup grid boost", value: remaining > 0 ? formatTickLabel(remaining) : "inactive" }
    ];
  }
  const ownedCount = getOwnedStripClubCount(input.state, input.building.ownerPlayerId, input.stripClubConfig);
  const network = resolveStripClubNetworkMultipliers(ownedCount, input.stripClubConfig);
  const metadata = getStripClubMetadata(input.building);
  const rumorStats = resolveStripClubRumorStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.stripClubConfig,
    vipActive: (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick
  });
  const activeContacts = metadata.contacts
    .filter((contact) => contact.expiresAtTick === null || contact.expiresAtTick > input.tick)
    .map((contact) => contact.label)
    .join(", ");
  return [
    { label: "Clean / min", value: `$${formatNumber(input.stripClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
    { label: "Dirty / min", value: `$${formatNumber(input.stripClubConfig.dirtyCashPerMinute * network.incomeMultiplier)}` },
    { label: "Influence / min", value: formatNumber(input.stripClubConfig.influencePerMinute * network.influenceMultiplier) },
    { label: "Heat / min", value: formatNumber(input.stripClubConfig.heatPerMinute * network.heatMultiplier) },
    { label: "Owned clubs", value: `${ownedCount}/${input.stripClubConfig.countOnMap}` },
    { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
    { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
    { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
    { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
    { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` },
    { label: "Active contacts", value: activeContacts || "none" },
    { label: "Scandal risk", value: `${input.stripClubConfig.privateParty.scandalChancePct} %` }
  ];};
