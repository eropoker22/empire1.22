import {
  getApartmentBlockMetadata,
  getOwnedApartmentBlockCount,
  resolveApartmentBlockNetworkMultipliers
} from "../handlers/apartmentBlockBuildingActions";
import {
  getConvenienceStoreMetadata,
  getOwnedConvenienceStoreCount,
  resolveConvenienceStoreNetworkMultipliers,
  resolveConvenienceStoreRumorStats
} from "../handlers/convenienceStoreBuildingActions";
import {
  getOwnedPowerStationCount,
  getPowerStationMetadata,
  resolvePowerStationInfrastructureMultiplier,
  resolvePowerStationInfrastructureBonusPct,
  resolvePowerStationNetworkMultipliers
} from "../handlers/powerStationBuildingActions";
import {
  getOwnedRecruitmentCenterCount,
  resolveRecruitmentCenterNetworkMultipliers,
  resolveRecruitmentCenterSupportBonuses
} from "../handlers/recruitmentCenterBuildingActions";
import {
  getOwnedSchoolCount,
  getSchoolMetadata,
  resolveSchoolCapacity,
  resolveSchoolEveningCourseApartmentProductionMultiplier,
  resolveSchoolNetworkMultipliers
} from "../handlers/schoolBuildingActions";
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
import { resolveDayNightPassiveBuildingRule } from "../rules/day-night/dayNight";
import {
  applyFactionPopulationGeneration,
  getFactionPassiveModifiers
} from "../rules/factions/factionRules";
import { formatNumber, formatTickLabel } from "./district-building-action-formatters";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

const formatMultiplierBonus = (value: number): string =>
  `${Number(value || 1) >= 1 ? "+" : ""}${formatNumber((Number(value || 1) - 1) * 100)} %`;

const formatPopulationRate = (value: number): string =>
  String(Number(Math.max(0, Number(value || 0)).toFixed(2)));

const resolvePopulationTimeToFullMs = (input: {
  storedAmount: number;
  capacity: number;
  productionPerMinute: number;
  tickRateMs: number;
}): number => {
  const tickRateMs = Math.max(1, Number(input.tickRateMs || 1));
  const productionPerTick = Math.max(0, Number(input.productionPerMinute || 0)) * tickRateMs / 60_000;
  const remainingAmount = Math.max(0, Number(input.capacity || 0) - Number(input.storedAmount || 0));
  return productionPerTick > 0 && remainingAmount > 0
    ? Math.ceil(remainingAmount / productionPerTick) * tickRateMs
    : 0;
};

interface CivilPopulationBufferPresentation {
  storedAmount: number;
  capacity: number;
  productionPerMinute: number;
  timeToFullMs: number;
}

export const createCivilPopulationBufferPresentation = (
  input: Pick<
    BuildingStatsProjectionInput,
    | "state"
    | "building"
    | "dayNightConfig"
    | "convenienceStoreConfig"
    | "powerStationConfig"
    | "recruitmentCenterConfig"
    | "schoolConfig"
    | "tick"
    | "tickRateMs"
  >
): CivilPopulationBufferPresentation | null => {
  const tick = Math.max(0, Number(input.tick ?? input.state.root.tick));
  const tickRateMs = Math.max(1, Number(input.tickRateMs ?? input.dayNightConfig?.tickRateMs ?? 5_000));
  const apartmentConfig = input.dayNightConfig?.balance.apartmentBlock;
  if (
    input.building.buildingTypeId === apartmentConfig?.buildingTypeId
    && input.building.ownerPlayerId
  ) {
    const ownedCount = getOwnedApartmentBlockCount(input.state, input.building.ownerPlayerId, apartmentConfig);
    const network = resolveApartmentBlockNetworkMultipliers(ownedCount, apartmentConfig);
    const support = resolveRecruitmentCenterSupportBonuses({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.recruitmentCenterConfig
    });
    const metadata = getApartmentBlockMetadata(input.building);
    const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.powerStationConfig ?? input.dayNightConfig?.balance.powerStation,
      tick,
      target: "apartmentPopulationProduction"
    });
    const schoolEveningCourseMultiplier = resolveSchoolEveningCourseApartmentProductionMultiplier({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.schoolConfig ?? input.dayNightConfig?.balance.school,
      tick
    });
    const baseProductionPerMinute = apartmentConfig.populationPerMinute
      * network.populationProductionMultiplier
      * (1 + support.populationProductionBonusPct / 100)
      * infrastructureMultiplier
      * schoolEveningCourseMultiplier;
    const productionPerMinute = input.dayNightConfig
      ? applyFactionPopulationGeneration(
          baseProductionPerMinute,
          getFactionPassiveModifiers(input.state, input.building.ownerPlayerId, { config: input.dayNightConfig })
        )
      : baseProductionPerMinute;
    const capacity = Math.max(
      1,
      Math.floor(
        apartmentConfig.baseCapacity
        * network.capacityMultiplier
        * (1 + support.apartmentCapacityBonusPct / 100)
        + 1e-9
      )
    );
    const storedAmount = Math.min(capacity, Math.max(0, Number(metadata.storedPopulation || 0)));
    return {
      storedAmount,
      capacity,
      productionPerMinute,
      timeToFullMs: resolvePopulationTimeToFullMs({
        storedAmount,
        capacity,
        productionPerMinute,
        tickRateMs
      })
    };
  }

  const convenienceStoreConfig = input.convenienceStoreConfig;
  if (
    input.building.buildingTypeId === convenienceStoreConfig?.buildingTypeId
    && input.building.ownerPlayerId
  ) {
    const ownedCount = getOwnedConvenienceStoreCount(
      input.state,
      input.building.ownerPlayerId,
      convenienceStoreConfig
    );
    const metadata = getConvenienceStoreMetadata(input.building);
    const capacity = Math.max(1, Math.floor(Number(convenienceStoreConfig.basePopulationCapacity || 1)));
    const storedAmount = Math.min(capacity, Math.max(0, Number(metadata.storedPopulation || 0)));
    const productionPerMinute = Math.max(0, Number(convenienceStoreConfig.populationPerMinute || 0))
      + Math.max(0, ownedCount - 1)
        * Math.max(0, Number(convenienceStoreConfig.network.populationPerMinuteBonusPerExtraStore || 0));
    return {
      storedAmount,
      capacity,
      productionPerMinute,
      timeToFullMs: resolvePopulationTimeToFullMs({
        storedAmount,
        capacity,
        productionPerMinute,
        tickRateMs
      })
    };
  }

  const schoolConfig = input.schoolConfig ?? input.dayNightConfig?.balance.school;
  if (
    input.building.buildingTypeId === schoolConfig?.buildingTypeId
    && input.building.ownerPlayerId
  ) {
    const ownedCount = getOwnedSchoolCount(input.state, input.building.ownerPlayerId, schoolConfig);
    const network = resolveSchoolNetworkMultipliers(ownedCount, schoolConfig);
    const metadata = getSchoolMetadata(input.building, tick);
    const capacity = resolveSchoolCapacity({
      state: input.state,
      building: input.building,
      config: schoolConfig
    });
    const storedAmount = Math.min(capacity, Math.max(0, Number(metadata.storedStudents || 0)));
    const passivePopulationMultiplier = input.dayNightConfig
      ? Number(resolveDayNightPassiveBuildingRule(
          input.state,
          { config: input.dayNightConfig },
          input.building.buildingTypeId
        ).modifiers.passivePopulationMultiplier)
      : 1;
    const baseProductionPerMinute = schoolConfig.populationPerMinute
      * network.populationProductionMultiplier;
    const productionPerMinute = input.dayNightConfig
      ? applyFactionPopulationGeneration(
          baseProductionPerMinute,
          getFactionPassiveModifiers(input.state, input.building.ownerPlayerId, { config: input.dayNightConfig })
        )
      : baseProductionPerMinute;
    const effectiveProductionPerMinute = productionPerMinute
      * (Number.isFinite(passivePopulationMultiplier) && passivePopulationMultiplier >= 0
        ? passivePopulationMultiplier
        : 1);
    return {
      storedAmount,
      capacity,
      productionPerMinute,
      timeToFullMs: resolvePopulationTimeToFullMs({
        storedAmount,
        capacity,
        productionPerMinute: effectiveProductionPerMinute,
        tickRateMs
      })
    };
  }

  return null;
};

export const createCivilBuildingStats = (
  input: BuildingStatsProjectionInput,
  baseStats: BuildingStatView[]
): BuildingStatView[] => {
  const apartmentConfig = input.dayNightConfig?.balance.apartmentBlock;
  if (
    input.building.buildingTypeId === apartmentConfig?.buildingTypeId
    && input.building.ownerPlayerId
  ) {
    const ownedCount = getOwnedApartmentBlockCount(input.state, input.building.ownerPlayerId, apartmentConfig);
    const network = resolveApartmentBlockNetworkMultipliers(ownedCount, apartmentConfig);
    const populationBuffer = createCivilPopulationBufferPresentation(input);
    return [
      { label: "Populace / min", value: formatPopulationRate(populationBuffer?.productionPerMinute ?? 0) },
      { label: "Lokální zásobník", value: `${formatNumber(Math.floor(populationBuffer?.storedAmount || 0))}/${formatNumber(populationBuffer?.capacity ?? 0)}` },
      { label: "Vlastněné bloky", value: `${ownedCount}/${apartmentConfig.countOnMap}` },
      { label: "Produkce bytů", value: formatMultiplierBonus(network.populationProductionMultiplier) },
      { label: "Kapacita bytů", value: formatMultiplierBonus(network.capacityMultiplier) }
    ];
  }
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
            { label: "Kamery/alarmy", value: `+${formatNumber(support.cameraStrengthBonusPct)} %` },
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
        const populationBuffer = createCivilPopulationBufferPresentation(input);
        return [
          { label: "Clean / min", value: `$${formatNumber(input.convenienceStoreConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
          { label: "Dirty / min", value: `$${formatNumber(input.convenienceStoreConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
          { label: "Influence / min", value: formatNumber(input.convenienceStoreConfig.influencePerMinute * network.influenceMultiplier) },
          { label: "Heat / min", value: formatNumber(input.convenienceStoreConfig.heatPerMinute * network.heatMultiplier) },
          { label: "Populace / min", value: formatPopulationRate(populationBuffer?.productionPerMinute ?? 0) },
          { label: "Lokální zásobník", value: `${formatNumber(Math.floor(populationBuffer?.storedAmount || 0))}/${formatNumber(populationBuffer?.capacity ?? 0)}` },
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
