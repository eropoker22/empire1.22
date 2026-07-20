import { describe, expect, it } from "vitest";
import type { PlayerRecoveryPoolEntry } from "@empire/shared-types";
import { applyCommand, collectIncome } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const freeConfig = resolveModeConfig("free");
const context = { config: freeConfig };
const ticksPerMinute = Math.ceil(60_000 / freeConfig.tickRateMs);
const cooldownTicks = (minutes: number): number =>
  Math.ceil(Math.ceil(minutes * 60_000 / freeConfig.tickRateMs) * freeConfig.balance.cooldownMultiplier);

describe("residential building actions", () => {
  it("rejects apartment collection when local storage is empty", () => {
    const { state, building } = createApartmentBlockState(0);
    const result = applyCommand(state, createBuildingActionCommand(building.id, "collect_population"), context);

    expect(result.errors).toMatchObject([{ code: "apartment_block_no_population" }]);
    expect(result.nextState).toBe(state);
    expect(result.nextState.buildingsById[building.id].actionCooldowns?.collect_population).toBeUndefined();
  });

  it("rejects apartment collection below the configured minimum of ten people", () => {
    const { state, building } = createApartmentBlockState(9);
    const result = applyCommand(state, createBuildingActionCommand(building.id, "collect_population"), context);

    expect(freeConfig.balance.apartmentBlock?.collectPopulation.minCollectPopulation).toBe(10);
    expect(result.errors).toMatchObject([{ code: "apartment_block_insufficient_population" }]);
    expect(result.nextState).toBe(state);
  });

  it("collects apartment population into player population and gang members at ten people", () => {
    const { state, building } = createApartmentBlockState(10);
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };

    const result = applyCommand(state, createBuildingActionCommand(building.id, "collect_population"), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.playersById["player:1"].population).toBe(10);
    expect(result.nextState.resourceStatesById["resource:1"].balances["gang-members"]).toBe(10);
    expect(result.nextState.buildingsById[building.id].metadata?.apartmentBlock).toMatchObject({
      storedPopulation: 0,
      wasFull: false
    });
  });

  it("requires thirty people before Večerka population can be collected", () => {
    const { state, building } = createConvenienceStoreState(29);
    const result = applyCommand(state, createBuildingActionCommand(building.id, "collect_convenience_store_population"), context);

    expect(freeConfig.balance.convenienceStore?.collectPopulation.minCollectPopulation).toBe(30);
    expect(result.errors).toMatchObject([{ code: "convenience_store_insufficient_population" }]);
    expect(result.nextState).toBe(state);
  });

  it("collects Večerka population into player population and gang members at thirty people", () => {
    const { state, building } = createConvenienceStoreState(30);
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };

    const result = applyCommand(state, createBuildingActionCommand(building.id, "collect_convenience_store_population"), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.playersById["player:1"].population).toBe(30);
    expect(result.nextState.resourceStatesById["resource:1"].balances["gang-members"]).toBe(30);
    expect(result.nextState.buildingsById[building.id].metadata?.convenienceStore).toMatchObject({
      storedPopulation: 0,
      populationWasFull: false
    });
  });

  it("produces fifty people per hour and adds five per hour for each extra Večerka", () => {
    const oneStore = createConvenienceStoreState(0);
    oneStore.state.root.tick = ticksPerMinute * 30;
    oneStore.state.buildingsById[oneStore.building.id] = {
      ...oneStore.building,
      metadata: { convenienceStore: { storedPopulation: 0, populationLastUpdatedTick: 0 } }
    };
    const twoStores = createConvenienceStoreState(0);
    const secondStore = createFixedBuildingFixture("convenience_store", {
      id: "building:district-1:convenience-store:2",
      metadata: { convenienceStore: { storedPopulation: 0, populationLastUpdatedTick: 0 } }
    });
    twoStores.state.root.tick = ticksPerMinute * 30;
    twoStores.state.buildingsById[twoStores.building.id] = {
      ...twoStores.building,
      metadata: { convenienceStore: { storedPopulation: 0, populationLastUpdatedTick: 0 } }
    };
    twoStores.state.buildingsById[secondStore.id] = secondStore;

    const oneStoreResult = collectIncome(oneStore.state, context);
    const twoStoresResult = collectIncome(twoStores.state, context);

    expect(getConvenienceStorePopulation(oneStoreResult, oneStore.building.id)).toBeCloseTo(25, 5);
    expect(getConvenienceStorePopulation(twoStoresResult, twoStores.building.id)).toBeCloseTo(27.5, 5);
    expect(getConvenienceStorePopulation(twoStoresResult, secondStore.id)).toBeCloseTo(27.5, 5);
  });

  it("runs school evening course, starts cooldown and no longer reports talent or clean income promises", () => {
    const { state, building } = createSchoolState({ cash: 1_000 });
    const result = applyCommand(state, createBuildingActionCommand(building.id, "evening_course"), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(result.nextState.buildingsById[building.id].metadata?.school).toMatchObject({
      eveningCourseExpiresAtTick: 20 * ticksPerMinute
    });
    expect(result.nextState.buildingsById[building.id].actionCooldowns?.evening_course).toBe(cooldownTicks(35));
    expect(result.events.find((event) => event.type === "building-action-resolved")?.payload).toMatchObject({
      actionId: "evening_course",
      reportText: "Večerní kurz běží. Škola dočasně zvedá nábor členů v bytových blocích."
    });
    expect(JSON.stringify(result)).not.toContain("talent roll");
    expect(JSON.stringify(result)).not.toContain("clean income");
  });

  it("rejects active school evening course without starting another cooldown", () => {
    const { state, building } = createSchoolState({
      cash: 1_000,
      metadata: {
        school: {
          storedStudents: 0,
          eveningCourseExpiresAtTick: 5 * ticksPerMinute
        }
      }
    });
    const result = applyCommand(state, createBuildingActionCommand(building.id, "evening_course"), context);

    expect(result.errors).toMatchObject([{ code: "school_evening_course_active" }]);
    expect(result.nextState).toBe(state);
    expect(result.nextState.buildingsById[building.id].actionCooldowns?.evening_course).toBeUndefined();
  });

  it("applies active school evening course to apartment block population production", () => {
    const inactiveCourse = createApartmentBlockWithSchoolState(false);
    const activeCourse = createApartmentBlockWithSchoolState(true);

    const inactiveResult = collectIncome(inactiveCourse.state, context);
    const activeResult = collectIncome(activeCourse.state, context);
    const inactiveStored = getApartmentStoredPopulation(inactiveResult, inactiveCourse.apartment.id);
    const activeStored = getApartmentStoredPopulation(activeResult, activeCourse.apartment.id);

    expect(inactiveStored).toBeGreaterThan(0);
    expect(activeStored).toBeCloseTo(
      inactiveStored * freeConfig.balance.school!.eveningCourse.populationProductionMultiplier,
      5
    );
  });

  it("does not apply active school evening course to school population production", () => {
    const inactiveCourse = createSchoolProductionState(false);
    const activeCourse = createSchoolProductionState(true);

    const inactiveResult = collectIncome(inactiveCourse.state, context);
    const activeResult = collectIncome(activeCourse.state, context);
    const inactiveStored = getSchoolStoredPopulation(inactiveResult, inactiveCourse.school.id);
    const activeStored = getSchoolStoredPopulation(activeResult, activeCourse.school.id);

    expect(inactiveStored).toBeGreaterThan(0);
    expect(activeStored).toBeCloseTo(inactiveStored, 5);
  });

  it("keeps clinic stabilization disabled with an empty recovery pool and no cooldown", () => {
    const { state, building } = createClinicState({ cash: 2_000, recoveryPool: [] });
    const result = applyCommand(state, createBuildingActionCommand(building.id, "stabilization_protocol"), context);

    expect(result.errors).toMatchObject([{ code: "clinic_recovery_pool_empty" }]);
    expect(result.nextState).toBe(state);
    expect(result.nextState.buildingsById[building.id].actionCooldowns?.stabilization_protocol).toBeUndefined();
  });

  it("runs clinic stabilization when recovery pool exists and starts cooldown only after success", () => {
    const { state, building } = createClinicState({
      cash: 2_000,
      recoveryPool: [
        {
          id: "recovery:test:gang-members:1",
          itemType: "gang-members",
          amount: 5,
          source: "combat",
          lostAtTick: 0,
          lostAt: new Date(0).toISOString()
        },
        {
          id: "recovery:test:gang-members:2",
          itemType: "gang-members",
          amount: 5,
          source: "combat",
          lostAtTick: 0,
          lostAt: new Date(0).toISOString()
        },
        {
          id: "recovery:test:population:1",
          itemType: "population",
          amount: 10,
          source: "combat",
          lostAtTick: 0,
          lostAt: new Date(0).toISOString()
        },
        {
          id: "recovery:test:population:2",
          itemType: "population",
          amount: 10,
          source: "combat",
          lostAtTick: 0,
          lostAt: new Date(0).toISOString()
        }
      ]
    });
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };

    const result = applyCommand(state, createBuildingActionCommand(building.id, "stabilization_protocol"), context);

    expect(result.errors).toEqual([]);
    expect(freeConfig.balance.clinic?.recovery.poolTtlMinutes).toBe(90);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(800);
    expect(result.nextState.resourceStatesById["resource:1"].balances["gang-members"]).toBeUndefined();
    expect(result.nextState.playersById["player:1"].population).toBe(4);
    expect(result.nextState.playersById["player:1"].recoveryPool).toEqual([]);
    expect(result.nextState.buildingsById[building.id].actionCooldowns?.stabilization_protocol).toBe(cooldownTicks(18));
  });
});

function createBuildingActionCommand(buildingId: string, actionId: string) {
  return createRunBuildingActionCommandFixture({
    payload: {
      districtId: "district:1",
      buildingId,
      actionId
    }
  });
}

function createApartmentBlockState(storedPopulation: number) {
  return createCoreStateWithFixedBuildingFixture("apartment_block", {
    playerBalances: {
      cash: 1_000,
      "gang-members": 0
    },
    buildingOverrides: {
      metadata: {
        apartmentBlock: {
          storedPopulation
        }
      }
    }
  });
}

function createConvenienceStoreState(storedPopulation: number) {
  return createCoreStateWithFixedBuildingFixture("convenience_store", {
    playerBalances: { cash: 1_000, "gang-members": 0 },
    buildingOverrides: {
      metadata: {
        convenienceStore: { storedPopulation }
      }
    }
  });
}

function getConvenienceStorePopulation(state: ReturnType<typeof collectIncome>, buildingId: string): number {
  return Number((state.buildingsById[buildingId].metadata?.convenienceStore as { storedPopulation?: number })?.storedPopulation || 0);
}

function createApartmentBlockWithSchoolState(courseActive: boolean) {
  const fixture = createCoreStateWithFixedBuildingFixture("apartment_block", {
    playerBalances: {
      cash: 1_000,
      "gang-members": 0
    },
    buildingOverrides: {
      metadata: {
        apartmentBlock: {
          storedPopulation: 0,
          lastUpdatedTick: 0
        }
      }
    }
  });
  const school = createFixedBuildingFixture("school", {
    id: "building:district-1:school:1",
    metadata: {
      school: {
        storedStudents: 0,
        lastUpdatedTick: 0,
        eveningCourseExpiresAtTick: courseActive ? 2 * ticksPerMinute : 0
      }
    }
  });
  fixture.state.root.tick = ticksPerMinute;
  fixture.state.buildingsById[school.id] = school;
  fixture.state.districtsById[school.districtId] = {
    ...fixture.state.districtsById[school.districtId],
    buildingIds: [...fixture.state.districtsById[school.districtId].buildingIds, school.id]
  };

  return {
    state: fixture.state,
    apartment: fixture.building,
    school
  };
}

function createSchoolState(options: { cash: number; metadata?: Record<string, unknown> }) {
  return createCoreStateWithFixedBuildingFixture("school", {
    playerBalances: {
      cash: options.cash
    },
    buildingOverrides: {
      metadata: options.metadata ?? {
        school: {
          storedStudents: 0
        }
      }
    }
  });
}

function createSchoolProductionState(courseActive: boolean) {
  const fixture = createSchoolState({
    cash: 1_000,
    metadata: {
      school: {
        storedStudents: 0,
        lastUpdatedTick: 0,
        eveningCourseExpiresAtTick: courseActive ? 2 * ticksPerMinute : 0
      }
    }
  });
  fixture.state.root.tick = ticksPerMinute;
  return {
    state: fixture.state,
    school: fixture.building
  };
}

function createClinicState(options: { cash: number; recoveryPool: PlayerRecoveryPoolEntry[] }) {
  const fixture = createCoreStateWithFixedBuildingFixture("clinic", {
    playerBalances: {
      cash: options.cash
    }
  });
  fixture.state.playersById["player:1"] = {
    ...fixture.state.playersById["player:1"],
    recoveryPool: options.recoveryPool
  };
  return fixture;
}

function getApartmentStoredPopulation(state: ReturnType<typeof collectIncome>, buildingId: string): number {
  const raw = state.buildingsById[buildingId].metadata?.apartmentBlock;
  return isRecord(raw) ? Math.max(0, Number(raw.storedPopulation || 0)) : 0;
}

function getSchoolStoredPopulation(state: ReturnType<typeof collectIncome>, buildingId: string): number {
  const raw = state.buildingsById[buildingId].metadata?.school;
  return isRecord(raw) ? Math.max(0, Number(raw.storedStudents || 0)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
