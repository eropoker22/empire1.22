import { describe, expect, it } from "vitest";
import {
  handleSelectSpawnDistrict,
  type CoreGameState,
  type GameCoreContext
} from "@empire/game-core";
import { enabledSharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-spawn-pool";

describe("shared city spawn", () => {
  it("starts player-owned local buffers fresh after neutral runtime accrual", () => {
    const districtId = enabledSharedCitySpawnDistrictIds[0];
    const schoolId = `building:${districtId}:school:1`;
    const apartmentId = `building:${districtId}:apartment_block:1`;
    const convenienceStoreId = `building:${districtId}:convenience_store:1`;
    const state = {
      root: { tick: 37, version: 1 },
      playersById: {
        "player:1": {
          id: "player:1",
          homeDistrictId: null,
          metadata: { startingInfluence: 37 },
          version: 1
        }
      },
      districtsById: {
        [districtId]: {
          id: districtId,
          ownerPlayerId: null,
          status: "neutral",
          zone: "residential",
          buildingIds: [schoolId, apartmentId, convenienceStoreId],
          version: 1
        }
      },
      buildingsById: {
        [schoolId]: {
          id: schoolId,
          ownerPlayerId: "player:neutral",
          buildingTypeId: "school",
          version: 1,
          metadata: {
            preserved: true,
            school: {
              storedStudents: 20,
              lastUpdatedTick: 30,
              lastCapacity: 20,
              wasFull: true,
              eveningCourseExpiresAtTick: 50
            }
          }
        },
        [apartmentId]: {
          id: apartmentId,
          ownerPlayerId: "player:neutral",
          buildingTypeId: "apartment_block",
          version: 1,
          metadata: {
            apartmentBlock: {
              storedPopulation: 40,
              lastUpdatedTick: 31,
              lastCapacity: 40,
              wasFull: true
            }
          }
        },
        [convenienceStoreId]: {
          id: convenienceStoreId,
          ownerPlayerId: "player:neutral",
          buildingTypeId: "convenience_store",
          version: 1,
          metadata: {
            convenienceStore: {
              storedPopulation: 30,
              populationLastUpdatedTick: 32,
              populationCapacity: 30,
              populationWasFull: true,
              lastPassiveRumorCheckTick: 33,
              rumorEvents: [{ text: "neutral rumor" }]
            }
          }
        }
      }
    } as unknown as CoreGameState;

    const result = handleSelectSpawnDistrict(state, {
      id: "command:spawn",
      clientRequestId: "request:spawn",
      issuedAt: "2026-07-31T00:00:00.000Z",
      mode: "free",
      payload: { districtId },
      playerId: "player:1",
      serverInstanceId: "instance:free:eu-central:test",
      type: "select-spawn-district"
    }, {} as GameCoreContext, {
      isEnabledSpawnCandidate: () => true
    });
    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById[districtId].ownerPlayerId).toBe("player:1");
    expect(result.nextState.districtsById[districtId].influence).toBe(37);
    expect(result.nextState.buildingsById[schoolId]).toMatchObject({
      ownerPlayerId: "player:1",
      metadata: {
        preserved: true,
        school: { storedStudents: 0, lastUpdatedTick: 37, wasFull: false }
      }
    });
    expect(result.nextState.buildingsById[schoolId].metadata?.school).toEqual({
      storedStudents: 0,
      lastUpdatedTick: 37,
      lastCapacity: 20,
      wasFull: false,
      eveningCourseExpiresAtTick: 50
    });
    expect(result.nextState.buildingsById[apartmentId].metadata?.apartmentBlock).toEqual({
      storedPopulation: 0,
      lastUpdatedTick: 37,
      lastCapacity: 40,
      wasFull: false
    });
    expect(result.nextState.buildingsById[convenienceStoreId].metadata?.convenienceStore).toEqual({
      storedPopulation: 0,
      populationLastUpdatedTick: 37,
      populationCapacity: 30,
      populationWasFull: false,
      lastPassiveRumorCheckTick: 33,
      rumorEvents: [{ text: "neutral rumor" }]
    });
  });

  it("rejects a spawn district while an occupation is still pending", () => {
    const districtId = enabledSharedCitySpawnDistrictIds[0];
    const state = {
      root: { tick: 10, version: 1 },
      playersById: {
        "player:new": { id: "player:new", homeDistrictId: null, metadata: {}, version: 1 }
      },
      districtsById: {
        [districtId]: {
          id: districtId,
          ownerPlayerId: null,
          status: "neutral",
          zone: "residential",
          buildingIds: [],
          operationLocks: { occupy: 20 },
          version: 1
        }
      },
      buildingsById: {},
      pendingOccupyOperationsById: {
        "occupy:pending": { targetDistrictId: districtId, resolveAtTick: 20 }
      }
    } as unknown as CoreGameState;

    const result = handleSelectSpawnDistrict(state, {
      id: "command:spawn:blocked",
      clientRequestId: "request:spawn:blocked",
      issuedAt: "2026-08-06T00:00:00.000Z",
      mode: "free",
      payload: { districtId },
      playerId: "player:new",
      serverInstanceId: "instance:free:eu-central:test",
      type: "select-spawn-district"
    }, {} as GameCoreContext, { isEnabledSpawnCandidate: () => true });

    expect(result.errors).toEqual([
      expect.objectContaining({ code: "SPAWN_OCCUPATION_IN_PROGRESS" })
    ]);
    expect(result.nextState).toBe(state);
  });
});
