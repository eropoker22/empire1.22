export function createAuthoritativeIncomeTickDelta(
  previous,
  current,
  materialIds = []
) {
  const tickGap = current.currentTick - previous.currentTick;
  const rates = previous.player.economyRates;
  const districtRates = rates.selectedDistrict;
  const expectedPerTick = {
    cleanCash: numberOrZero(rates.playerBalancePerTick.cash),
    dirtyCash: numberOrZero(rates.playerBalancePerTick["dirty-cash"]),
    population: numberOrZero(rates.playerBalancePerTick.population),
    materials: createResourceRecord(
      materialIds,
      rates.playerBalancePerTick
    ),
    districtHeat: numberOrZero(districtRates?.heatPerTick),
    districtInfluence: numberOrZero(districtRates?.influencePerTick)
  };
  const expectedPerHour = {
    cleanCash: numberOrZero(rates.playerBalancePerHour.cash),
    dirtyCash: numberOrZero(rates.playerBalancePerHour["dirty-cash"]),
    population: numberOrZero(rates.playerBalancePerHour.population),
    materials: createResourceRecord(
      materialIds,
      rates.playerBalancePerHour
    ),
    districtHeat: numberOrZero(districtRates?.heatPerHour),
    districtInfluence: numberOrZero(districtRates?.influencePerHour)
  };
  const actualNet = {
    cleanCash: current.player.cleanCash - previous.player.cleanCash,
    dirtyCash: current.player.dirtyCash - previous.player.dirtyCash,
    population: current.player.population - previous.player.population,
    materials: createResourceDeltaRecord(
      materialIds,
      previous.player.resourceBalances,
      current.player.resourceBalances
    ),
    districtHeat: current.player.district.heat
      - previous.player.district.heat,
    districtInfluence: current.player.district.influence
      - previous.player.district.influence
  };

  const expectedNet = multiplyExpectedRates(expectedPerTick, tickGap);

  return {
    fromTick: previous.currentTick,
    toTick: current.currentTick,
    tick: tickGap,
    rootTick: Number.isFinite(previous.rootTick) && Number.isFinite(current.rootTick)
      ? current.rootTick - previous.rootTick
      : null,
    stateVersion: current.stateVersion - previous.stateVersion,
    rateBasis: {
      projectionBasis: rates.basis,
      fromTick: rates.fromTick,
      toTick: rates.toTick,
      tickRateMs: rates.tickRateMs,
      stableAcrossGap: haveStableEconomyRates(
        previous.player.economyRates,
        current.player.economyRates,
        materialIds
      )
    },
    expectedPerTick,
    expectedPerHour,
    uiDisplayedPerHour: createUiDisplayedPerHour(
      previous.player.buildingPresentationRates
    ),
    uiRenderedPerHour: previous.player.visibleDistrictRates,
    exactUiRateMatch: {
      cleanCash: floatingDeltaMatches(
        previous.player.visibleDistrictRates?.cleanCash,
        districtRates?.cleanCashPerHour
      ),
      dirtyCash: floatingDeltaMatches(
        previous.player.visibleDistrictRates?.dirtyCash,
        districtRates?.dirtyCashPerHour
      ),
      districtInfluence: floatingDeltaMatches(
        previous.player.visibleDistrictRates?.influence,
        districtRates?.influencePerHour
      )
    },
    populationSourceEvidence: {
      sources: districtRates?.passivePopulationSources ?? [],
      summary: districtRates?.passivePopulationSourceSummary ?? null
    },
    expectedNet,
    actualNet,
    exactNetMatch: {
      cleanCash: floatingDeltaMatches(
        actualNet.cleanCash,
        expectedNet.cleanCash
      ),
      dirtyCash: floatingDeltaMatches(
        actualNet.dirtyCash,
        expectedNet.dirtyCash
      ),
      population: actualNet.population === expectedNet.population,
      materials: Object.fromEntries(
        materialIds.map((resourceKey) => [
          resourceKey,
          actualNet.materials[resourceKey] === expectedNet.materials[resourceKey]
        ])
      ),
      districtHeat: floatingDeltaMatches(
        actualNet.districtHeat,
        expectedNet.districtHeat
      ),
      districtInfluence: floatingDeltaMatches(
        actualNet.districtInfluence,
        expectedNet.districtInfluence
      )
    },
    lastSnapshotAtMs: createTimestampDelta(
      previous.admin.lastSnapshot.lastSnapshotAt,
      current.admin.lastSnapshot.lastSnapshotAt
    )
  };
}

export function createAuthoritativeStoredPopulationTickDelta(
  previousSource,
  currentSource,
  tickGap
) {
  const normalizedTickGap = Math.max(0, Number(tickGap) || 0);
  const previousStoredAmount = numberOrZero(previousSource?.storedAmount);
  const amountPerTick = numberOrZero(previousSource?.amountPerTick);
  const capacity = Math.max(
    previousStoredAmount,
    numberOrZero(previousSource?.capacity),
    numberOrZero(currentSource?.capacity)
  );
  const expectedStoredAmount = Math.min(
    capacity,
    previousStoredAmount + amountPerTick * normalizedTickGap
  );
  const actualStoredAmount = numberOrZero(currentSource?.storedAmount);

  return {
    sourceId: previousSource?.sourceId ?? null,
    buildingId: previousSource?.buildingId ?? null,
    buildingTypeId: previousSource?.buildingTypeId ?? null,
    target: previousSource?.target ?? null,
    tickGap: normalizedTickGap,
    amountPerTick,
    capacity,
    previousStoredAmount,
    expectedStoredAmount,
    actualStoredAmount,
    expectedStoredDelta: expectedStoredAmount - previousStoredAmount,
    actualStoredDelta: actualStoredAmount - previousStoredAmount,
    exactStoredMatch: floatingDeltaMatches(
      actualStoredAmount,
      expectedStoredAmount
    )
  };
}

export function createUiDisplayedPerHour(buildingPresentationRates = []) {
  const activeRates = buildingPresentationRates.filter((entry) => (
    entry?.status === "active" && entry?.passive
  ));
  const totals = activeRates.reduce(
    (sum, entry) => ({
      cleanCash: sum.cleanCash + numberOrZero(entry.passive.cleanPerHour),
      dirtyCash: sum.dirtyCash + numberOrZero(entry.passive.dirtyPerHour),
      districtHeat: sum.districtHeat
        + numberOrZero(entry.passive.heatPerDay) / 24,
      districtInfluence: sum.districtInfluence
        + numberOrZero(entry.passive.influencePerDay) / 24
    }),
    {
      cleanCash: 0,
      dirtyCash: 0,
      districtHeat: 0,
      districtInfluence: 0
    }
  );

  return {
    source: "district.buildings[].presentation.passive",
    buildingCount: activeRates.length,
    ...totals,
    buildings: activeRates
  };
}

export function floatingDeltaMatches(actual, expected) {
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false;
  }
  const tolerance = 1e-9 * Math.max(
    1,
    Math.abs(actualNumber),
    Math.abs(expectedNumber)
  );
  return Math.abs(actualNumber - expectedNumber) <= tolerance;
}

function haveStableEconomyRates(previous, current, materialIds) {
  if (!previous || !current) {
    return false;
  }
  const trackedKeys = ["cash", "dirty-cash", "population", ...materialIds];
  return previous.tickRateMs === current.tickRateMs
    && previous.basis === current.basis
    && trackedKeys.every((resourceKey) => (
      numberOrZero(previous.playerBalancePerTick?.[resourceKey])
      === numberOrZero(current.playerBalancePerTick?.[resourceKey])
    ))
    && floatingDeltaMatches(
      previous.selectedDistrict?.heatPerTick,
      current.selectedDistrict?.heatPerTick
    )
    && floatingDeltaMatches(
      previous.selectedDistrict?.influencePerTick,
      current.selectedDistrict?.influencePerTick
    )
    && JSON.stringify(previous.selectedDistrict?.passivePopulationSources ?? [])
      === JSON.stringify(current.selectedDistrict?.passivePopulationSources ?? []);
}

function multiplyExpectedRates(expectedPerTick, tickGap) {
  return {
    cleanCash: expectedPerTick.cleanCash * tickGap,
    dirtyCash: expectedPerTick.dirtyCash * tickGap,
    population: expectedPerTick.population * tickGap,
    materials: Object.fromEntries(
      Object.entries(expectedPerTick.materials).map(([resourceKey, amount]) => [
        resourceKey,
        amount * tickGap
      ])
    ),
    districtHeat: expectedPerTick.districtHeat * tickGap,
    districtInfluence: expectedPerTick.districtInfluence * tickGap
  };
}

function createResourceRecord(resourceKeys, balances) {
  return Object.fromEntries(
    resourceKeys.map((resourceKey) => [
      resourceKey,
      numberOrZero(balances?.[resourceKey])
    ])
  );
}

function createResourceDeltaRecord(resourceKeys, previous, current) {
  return Object.fromEntries(
    resourceKeys.map((resourceKey) => [
      resourceKey,
      numberOrZero(current?.[resourceKey]) - numberOrZero(previous?.[resourceKey])
    ])
  );
}

function createTimestampDelta(previous, current) {
  const previousMs = Date.parse(previous || "");
  const currentMs = Date.parse(current || "");
  return Number.isFinite(previousMs) && Number.isFinite(currentMs)
    ? currentMs - previousMs
    : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
