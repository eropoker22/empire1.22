import { describe, expect, it } from "vitest";
import {
  ONBOARDING_HOME_DISTRICT_ID,
  ONBOARDING_SANDBOX_MODE,
  ONBOARDING_SPY_CAPACITY,
  createOnboardingSandboxSession
} from "../../page-assets/js/app/runtime/onboardingSandboxState.js";

describe("onboarding sandbox state", () => {
  it("contains only District 1, one spy and empty player resources", () => {
    const serverSession = {
      registration: { playerId: "player-9", startDistrictId: 27 },
      economy: { cleanMoney: 9000, dirtyMoney: 4000 },
      gang: { members: 150, influence: 42, heat: 12, allianceId: "alliance-1" },
      inventory: {
        weapons: { pistol: 5 },
        materials: { chemicals: 8 },
        drugs: { "neon-dust": 3 }
      },
      missions: {
        spy: { available: 2, missions: [{ id: "spy-1" }] },
        attackOrders: [{ id: "attack-1" }]
      },
      production: { jobs: { "job-1": { status: "running" } } },
      world: {
        ownedDistrictIds: [27, 28],
        destroyedDistrictIds: [8],
        districtOwnerById: { 27: "player-9", 31: "enemy" },
        districtDefenseById: { 27: 500 },
        phaseState: { gamePhase: "final_lockdown", mapPhase: "night" }
      }
    };

    const sandbox = createOnboardingSandboxSession(serverSession, {
      weaponInventory: { pistol: 0, rifle: 0 },
      materialInventory: { chemicals: 0, biomass: 0 },
      drugInventory: { "neon-dust": 0 }
    });

    expect(ONBOARDING_SANDBOX_MODE).toBe("onboarding");
    expect(ONBOARDING_HOME_DISTRICT_ID).toBe(1);
    expect(ONBOARDING_SPY_CAPACITY).toBe(1);
    expect(sandbox.registration.startDistrictId).toBe(1);
    expect(sandbox.world).toMatchObject({
      ownedDistrictIds: [1],
      destroyedDistrictIds: [],
      districtOwnerById: {},
      districtDefenseById: {},
      phaseState: { gamePhase: "live" }
    });
    expect(sandbox.missions).toEqual({
      attackOrders: [],
      occupyOrders: [],
      robberyOrders: [],
      spy: { available: 1, missions: [] },
      spyIntel: {
        occupiableDistrictIds: [],
        revealedTypeDistrictIds: [],
        revealedDefenseDistrictIds: []
      }
    });
    expect(sandbox.economy).toEqual({ cleanMoney: 0, dirtyMoney: 0 });
    expect(sandbox.gang).toMatchObject({ members: 0, influence: 0, heat: 0, allianceId: null });
    expect(Object.values(sandbox.inventory.weapons)).toEqual([0, 0]);
    expect(Object.values(sandbox.inventory.materials)).toEqual([0, 0]);
    expect(Object.values(sandbox.inventory.drugs)).toEqual([0]);
    expect(sandbox.production.jobs).toEqual({});
    expect(serverSession.world.ownedDistrictIds).toEqual([27, 28]);
    expect(serverSession.economy.cleanMoney).toBe(9000);
  });
});
