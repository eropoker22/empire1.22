import { describe, expect, it } from "vitest";
import {
  CURRENT_PLAYER_ID,
  DEMO_SCENARIOS,
  DEV_ONLY_DESTROYED_DISTRICT_ID,
  MARKET_PLAYER_DEMO_SELLERS,
  START_PHASE_OWNER_COORDINATES,
  START_PHASE_PLAYER_COLORS,
  START_PHASE_PLAYER_NAMES,
  START_PHASE_RESOURCE_SIMULATION,
  isDemoScenarioMode
} from "../../page-assets/js/app/onboarding/demoScenarios.js";
import * as demoScenarioData from "../../page-assets/js/app/onboarding/demoScenarios.js";
import { installLegacyScenarioData } from "../../page-assets/js/app/runtime/legacyScenarioState.js";
import {
  MAP_GRID_COLUMNS,
  MAP_GRID_ROWS
} from "../../page-assets/js/app/map/mapConstants.js";
import { createDistrictGeometry, createLaunchOwnerMap } from "../../page-assets/js/app/map/mapGeometry.js";

describe("runtime demo scenarios", () => {
  it("keeps launch demo scenario data available outside runtime", () => {
    expect(DEMO_SCENARIOS.launch).toMatchObject({
      id: "launch",
      gamePhase: "launch",
      currentPlayerId: 1,
      destroyedDistrictId: 8
    });
    expect(CURRENT_PLAYER_ID).toBe(1);
    expect(DEV_ONLY_DESTROYED_DISTRICT_ID).toBe(8);
    expect(START_PHASE_OWNER_COORDINATES).toHaveLength(20);
    expect(new Set(START_PHASE_OWNER_COORDINATES.map(([rowIndex, columnIndex]) => `${rowIndex}:${columnIndex}`)).size).toBe(20);
    expect(START_PHASE_OWNER_COORDINATES.every(([rowIndex, columnIndex]) =>
      rowIndex >= 0
      && rowIndex < MAP_GRID_ROWS
      && columnIndex >= 0
      && columnIndex < MAP_GRID_COLUMNS
    )).toBe(true);
    const geometry = createDistrictGeometry(1600, 980);
    const startCells = START_PHASE_OWNER_COORDINATES.map(([rowIndex, columnIndex]) =>
      geometry.districts.find((district) => district.rowIndex === rowIndex && district.columnIndex === columnIndex)
    );
    expect(startCells.every((district) => district?.isSpawnCandidate)).toBe(true);
    expect(startCells.some((district) => district?.spawnZones?.includes("west"))).toBe(true);
    expect(startCells.some((district) => district?.spawnZones?.includes("east"))).toBe(true);
    expect(startCells.some((district) => district?.spawnZones?.includes("south"))).toBe(true);
    const launchOwnerByDistrictId = createLaunchOwnerMap(START_PHASE_OWNER_COORDINATES);
    const currentPlayerDistrictIds = Array.from(launchOwnerByDistrictId.entries())
      .filter(([, ownerId]) => ownerId === CURRENT_PLAYER_ID)
      .map(([districtId]) => districtId);
    expect(currentPlayerDistrictIds).toEqual([1]);
    expect(START_PHASE_PLAYER_COLORS).toHaveLength(30);
    expect(START_PHASE_PLAYER_NAMES).toHaveLength(20);
    expect(MARKET_PLAYER_DEMO_SELLERS.map((seller) => seller.id)).toEqual([
      "seller:neon-fox",
      "seller:chrome-crew",
      "seller:zero-lab",
      "seller:byte-runners",
      "seller:scarlet-yard"
    ]);
    expect(START_PHASE_RESOURCE_SIMULATION.cleanPerMinuteByDistrictType).toMatchObject({
      resident: 500 / 60,
      industrial: 800 / 60,
      park: 150 / 60,
      economy: 1200 / 60,
      downtown: 50
    });
    expect(START_PHASE_RESOURCE_SIMULATION.dirtyPerMinuteByDistrictType).toEqual({
      resident: 50 / 60,
      industrial: 100 / 60,
      park: 550 / 60,
      economy: 250 / 60,
      downtown: 10
    });
    expect(START_PHASE_RESOURCE_SIMULATION.influencePerMinuteByDistrictType).toEqual({
      resident: 2 / 60,
      industrial: 3 / 60,
      park: 3 / 60,
      economy: 4 / 60,
      downtown: 15 / 60
    });
    expect(START_PHASE_RESOURCE_SIMULATION.populationPerMinuteByDistrictType).toEqual({
      resident: 0,
      industrial: 15 / 60,
      park: 10 / 60,
      economy: 20 / 60,
      downtown: 0
    });
  });

  it("keeps normal free/live flow outside demo scenario mode", () => {
    expect(isDemoScenarioMode({ gamePhase: "launch", serverMode: "free" })).toBe(true);
    expect(isDemoScenarioMode({ gamePhase: "live", serverMode: "free" })).toBe(false);
    expect(isDemoScenarioMode({ gamePhase: "live", serverMode: "war" })).toBe(false);
    expect(isDemoScenarioMode({ serverMode: "free" })).toBe(false);
    expect(isDemoScenarioMode(null)).toBe(false);
  });

  it("keeps runtime compatibility exports for legacy debug modules", async () => {
    installLegacyScenarioData(demoScenarioData);
    const runtime = await import("../../page-assets/js/app/runtime.js");
    expect(runtime.DEMO_SCENARIOS).toEqual(DEMO_SCENARIOS);
    expect(runtime.isDemoScenarioMode({ gamePhase: "launch" })).toBe(true);
    expect(runtime.CURRENT_PLAYER_ID).toBe(CURRENT_PLAYER_ID);
    expect(runtime.START_PHASE_OWNER_COORDINATES).toEqual(START_PHASE_OWNER_COORDINATES);
    expect(runtime.START_PHASE_PLAYER_COLORS).toEqual(START_PHASE_PLAYER_COLORS);
    expect(runtime.START_PHASE_PLAYER_NAMES).toEqual(START_PHASE_PLAYER_NAMES);
  }, 10000);
});
