const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function createAuthoritativeDistrictEconomyPresentation(
  readModel,
  districtId
) {
  const projectedDistrict = readModel?.district;
  const projectedRates = readModel?.economyRates?.selectedDistrict;
  if (
    projectedDistrict?.districtId !== districtId
    || projectedRates?.districtId !== districtId
  ) {
    return {
      available: false,
      baseCleanHourlyIncome: 0,
      baseDirtyHourlyIncome: 0,
      buildingCleanHourlyIncome: 0,
      buildingDirtyHourlyIncome: 0,
      cleanHourlyIncome: 0,
      dirtyHourlyIncome: 0,
      totalHourlyIncome: 0,
      districtInfluencePerHour: 0,
      buildingInfluencePerHour: 0,
      totalInfluencePerHour: 0,
      districtPopulationPerHour: 0,
      populationLabel: "Bez dat",
      populationSourceSummary: "",
      passiveHeatPerDay: 0
    };
  }

  const presentationTotals = (projectedDistrict.buildings || []).reduce(
    (totals, building) => {
      const passive = building?.status === "active"
        ? building?.presentation?.passive
        : null;
      if (!passive) return totals;
      return {
        heatPerDay: totals.heatPerDay + finiteNumber(passive.heatPerDay)
      };
    },
    { heatPerDay: 0 }
  );
  const passivePopulationSources = Array.isArray(
    projectedRates.passivePopulationSources
  )
    ? projectedRates.passivePopulationSources
    : [];
  const playerPopulationPerHour = passivePopulationSources.reduce(
    (total, source) => total + (
      source.target === "player-balance"
        ? finiteNumber(source.amountPerHour)
        : 0
    ),
    0
  );
  const buildingStorageSourceCount = passivePopulationSources.filter(
    (source) => source.target === "building-storage"
  ).length;
  const cleanCashPerHour = finiteNumber(projectedRates.cleanCashPerHour);
  const dirtyCashPerHour = finiteNumber(projectedRates.dirtyCashPerHour);
  const influencePerHour = finiteNumber(projectedRates.influencePerHour);

  return {
    available: true,
    baseCleanHourlyIncome: cleanCashPerHour,
    baseDirtyHourlyIncome: dirtyCashPerHour,
    buildingCleanHourlyIncome: 0,
    buildingDirtyHourlyIncome: 0,
    cleanHourlyIncome: cleanCashPerHour,
    dirtyHourlyIncome: dirtyCashPerHour,
    totalHourlyIncome: Math.max(0, cleanCashPerHour + dirtyCashPerHour),
    districtInfluencePerHour: influencePerHour,
    buildingInfluencePerHour: 0,
    totalInfluencePerHour: influencePerHour,
    districtPopulationPerHour: 0,
    populationLabel: passivePopulationSources.length > 0
      ? playerPopulationPerHour > 0
        ? String(playerPopulationPerHour)
        : `0 topbar · ${buildingStorageSourceCount}× do zásoby`
      : "0 · žádný zdroj",
    populationSourceSummary:
      projectedRates.passivePopulationSourceSummary || "",
    passiveHeatPerDay: presentationTotals.heatPerDay
  };
}
