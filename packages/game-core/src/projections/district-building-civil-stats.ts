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

const formatMultiplierBonus = (value: number): string =>
  `${Number(value || 1) >= 1 ? "+" : ""}${formatNumber((Number(value || 1) - 1) * 100)} %`;

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
            { label: "Vlastněná centra", value: `${ownedCount}/${input.recruitmentCenterConfig.countOnMap}` },
            { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
            { label: "Produkce bytů", value: `+${formatNumber(support.populationProductionBonusPct)} %` },
            { label: "Kapacita bytů", value: `+${formatNumber(support.apartmentCapacityBonusPct)} %` },
            { label: "Síla útočných zbraní", value: `+${formatNumber(support.attackWeaponStrengthBonusPct)} %` },
            { label: "Síla obranných itemů", value: `+${formatNumber(support.defenseItemStrengthBonusPct)} %` },
            { label: "Cap kamer/alarmu", value: `max +${formatNumber(support.combinedCameraAlarmCapPct)} %` }
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
          : "neaktivní";
        return [
          { label: "Clean / min", value: `$${formatNumber(input.convenienceStoreConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
          { label: "Dirty / min", value: `$${formatNumber(input.convenienceStoreConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
          { label: "Influence / min", value: formatNumber(input.convenienceStoreConfig.influencePerMinute * network.influenceMultiplier) },
          { label: "Heat / min", value: formatNumber(input.convenienceStoreConfig.heatPerMinute * network.heatMultiplier) },
          { label: "Vlastněné večerky", value: `${ownedCount}/${input.convenienceStoreConfig.countOnMap}` },
          { label: "Clean výnos", value: formatMultiplierBonus(network.cleanIncomeMultiplier) },
          { label: "Dirty výnos", value: formatMultiplierBonus(network.dirtyIncomeMultiplier) },
          { label: "Vliv", value: formatMultiplierBonus(network.influenceMultiplier) },
          { label: "Drby", value: formatMultiplierBonus(network.rumorMultiplier) },
          { label: "Šance pasivního drbu", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
          { label: "Šance pravdivého drbu", value: `${formatNumber(rumorStats.truthChancePct)} %` },
          { label: "Civilní síť", value: civilNetworkBonus }
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
        { label: "Vlastněné restaurace", value: `${ownedCount}/${input.restaurantConfig.countOnMap}` },
        { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
        { label: "Vliv", value: formatMultiplierBonus(network.influenceMultiplier) },
        { label: "Drby", value: formatMultiplierBonus(network.rumorMultiplier) },
        { label: "Šance pasivního drbu", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
        { label: "Šance pravdivého drbu", value: `${formatNumber(rumorStats.truthChancePct)} %` }
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
      { label: "Dirty / min", value: `$${formatNumber(input.powerStationConfig.dirtyCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.powerStationConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastněné stanice", value: `${ownedCount}/${input.powerStationConfig.countOnMap}` },
      { label: "Infrastruktura", value: `+${formatNumber(infrastructureBonusPct)} %` },
      { label: "Síťový income", value: `+${formatNumber((network.incomeMultiplier - 1) * 100)} %` },
      { label: "Kamery", value: `+${formatNumber(network.cameraStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.cameraStrengthBonusPct : 0))} %` },
      { label: "Alarm", value: `+${formatNumber(network.alarmStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.alarmStrengthBonusPct : 0))} %` },
      { label: "Záložní síť", value: remaining > 0 ? `aktivní ${formatTickLabel(remaining)}` : "neaktivní" }
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
  return [
    { label: "Clean / min", value: `$${formatNumber(input.stripClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
    { label: "Dirty / min", value: `$${formatNumber(input.stripClubConfig.dirtyCashPerMinute * network.incomeMultiplier)}` },
    { label: "Influence / min", value: formatNumber(input.stripClubConfig.influencePerMinute * network.influenceMultiplier) },
    { label: "Heat / min", value: formatNumber(input.stripClubConfig.heatPerMinute * network.heatMultiplier) },
    { label: "Vlastněné kluby", value: `${ownedCount}/${input.stripClubConfig.countOnMap}` },
    { label: "Income", value: formatMultiplierBonus(network.incomeMultiplier) },
    { label: "Vliv", value: formatMultiplierBonus(network.influenceMultiplier) },
    { label: "Drby", value: formatMultiplierBonus(network.rumorMultiplier) },
    { label: "Šance pasivního drbu", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
    { label: "Šance pravdivého drbu", value: `${formatNumber(rumorStats.truthChancePct)} %` },
    { label: "Riziko skandálu", value: `${input.stripClubConfig.privateParty.scandalChancePct} %` }
  ];};
