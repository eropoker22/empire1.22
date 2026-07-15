import { describe, expect, it, vi } from "vitest";
import {
  calculateHeistDetectionChance,
  calculateHeistLoot,
  getHeistViewModel as getHeistViewModelCore,
  getPlayerHeistState,
  heistConfig,
  resolveDistrictHeist as resolveDistrictHeistCore,
  startDistrictHeist as startDistrictHeistCore,
  tickHeists as tickHeistsCore
} from "../../../packages/game-core/src/rules/heists";
import { FACTION_DEFINITION_BY_ID } from "../../../packages/game-config/src";

const createHeistStateFixture = () => ({
  mode: "free",
  config: {
    balance: {
      factions: FACTION_DEFINITION_BY_ID
    }
  },
  playersById: {
    "player:1": {
      id: "player:1",
      gangMembers: 100,
      cleanCash: 50,
      dirtyCash: 25,
      resources: {
        metalParts: 0,
        techCore: 0,
        chemicals: 0,
        biomass: 0
      },
      heat: 0,
      policeSuspicion: 0,
      factionId: "mafian"
    },
    "player:2": {
      id: "player:2",
      gangMembers: 80,
      cleanCash: 1000,
      dirtyCash: 500,
      resources: {
        metalParts: 30,
        techCore: 12,
        chemicals: 40,
        biomass: 50
      },
      heat: 0,
      policeSuspicion: 0,
      factionId: "mafian"
    }
  },
  districtsById: {
    "district:1": {
      id: "district:1",
      ownerPlayerId: "player:1",
      districtType: "residential",
      heat: 0,
      defenseLoadout: {}
    },
    "district:2": {
      id: "district:2",
      ownerPlayerId: "player:2",
      districtType: "commercial",
      heat: 0,
      defenseLoadout: {
        cameras: 2,
        alarm: 1
      }
    }
  },
  eventLog: [] as Array<Record<string, unknown>>,
  rumors: [] as Array<Record<string, unknown>>
});

const firstActiveHeist = (state: ReturnType<typeof createHeistStateFixture>) =>
  getPlayerHeistState(state, "player:1").activeHeists[0];

const getStyleView = (viewModel: Record<string, any>, styleId: string) =>
  viewModel.styles.find((style: Record<string, any>) => style.id === styleId);

const startDistrictHeist = (
  state: Record<string, any>,
  attackerPlayerId: string,
  targetDistrictId: string,
  style: "stealth" | "balanced" | "all_in",
  gangMembersSent: number,
  nowMs = 1_000,
  seed = `test:start:${attackerPlayerId}:${targetDistrictId}:${style}:${gangMembersSent}`
) => startDistrictHeistCore(
  state,
  attackerPlayerId,
  targetDistrictId,
  style,
  gangMembersSent,
  { nowMs, seed }
);

const resolveDistrictHeist = (state: Record<string, any>, heistId: string, nowMs: number) =>
  resolveDistrictHeistCore(state, heistId, { nowMs, seed: `test:resolve:${heistId}` });

const tickHeists = (state: Record<string, any>, nowMs: number) =>
  tickHeistsCore(state, { nowMs, seed: "test:tick" });

const getHeistViewModel = (state: Record<string, any>, attackerPlayerId: string, targetDistrictId: string) =>
  getHeistViewModelCore(state, attackerPlayerId, targetDistrictId, { nowMs: 1_000, seed: "test:view" });

describe("district heist system", () => {
  it("exposes district heist config with free and war multipliers", () => {
    expect(heistConfig.id).toBe("district_heist");
    expect(heistConfig.styles.stealth.durationSeconds).toBe(90);
    expect(heistConfig.styles.balanced.minGangMembers).toBe(10);
    expect(heistConfig.styles.all_in.maxGangMembers).toBe(120);
    expect(heistConfig.modeMultipliers.war.durationMultiplier).toBe(6);
    expect(heistConfig.modeMultipliers.war.cooldownMultiplier).toBe(6);
  });

  it("rejects heist on own district and without enough gang members", () => {
    const ownDistrict = startDistrictHeist(createHeistStateFixture(), "player:1", "district:1", "stealth", 5);
    expect(ownDistrict.success).toBe(false);
    expect(ownDistrict.reason).toBe("CANNOT_HEIST_OWN_DISTRICT");

    const notEnoughMembers = startDistrictHeist(createHeistStateFixture(), "player:1", "district:2", "all_in", 120);
    expect(notEnoughMembers.success).toBe(false);
    expect(notEnoughMembers.reason).toBe("NOT_ENOUGH_GANG_MEMBERS");
  });

  it("reserves gang members at start and returns survivors after resolve without changing district owner", () => {
    const state = createHeistStateFixture();
    const started = startDistrictHeist(state, "player:1", "district:2", "balanced", 20);
    expect(started.success).toBe(true);
    expect(started.message).toContain("Vykrást hráče");
    expect(started.nextState?.playersById["player:1"].gangMembers).toBe(80);
    expect(started.nextState?.playersById["player:1"].reservedGangMembers).toBe(20);

    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    active.resolvesAt = 1;
    active.detectionRoll = 0.99;
    active.lossRoll = 0;
    active.lootRoll = 1;
    active.rareLootRoll = 1;

    const resolved = resolveDistrictHeist(started.nextState!, active.id, 2);
    expect(resolved.outcome).toBe("clean_success");
    expect(resolved.message).toContain("vlastník districtu se nemění");
    expect(resolved.nextState?.playersById["player:1"].gangMembers).toBe(100);
    expect(resolved.nextState?.playersById["player:1"].reservedGangMembers).toBe(0);
    expect(resolved.nextState?.districtsById["district:2"].ownerPlayerId).toBe("player:2");
  });

  it("returns style-clamped recommended member ranges and risk preview in heist view model", () => {
    const viewModel = getHeistViewModel(createHeistStateFixture(), "player:1", "district:2");
    const expectations = {
      stealth: { min: 5, max: 35 },
      balanced: { min: 10, max: 70 },
      all_in: { min: 25, max: 120 }
    };

    expect(viewModel.actionLabel).toBe("Vykrást hráče");
    expect(viewModel.description).toBe("Heist cílí na district vlastněný jiným hráčem. Krade část jeho peněz a surovin, ale nepřebírá vlastnictví districtu.");

    for (const [styleId, limits] of Object.entries(expectations)) {
      const style = getStyleView(viewModel, styleId);
      expect(style).toBeTruthy();
      expect(style.recommendedMembers.min).toBeGreaterThanOrEqual(limits.min);
      expect(style.recommendedMembers.min).toBeLessThanOrEqual(limits.max);
      expect(style.recommendedMembers.max).toBeGreaterThanOrEqual(limits.min);
      expect(style.recommendedMembers.max).toBeLessThanOrEqual(limits.max);
      expect(style.recommendedMembers.safe).toBeGreaterThanOrEqual(limits.min);
      expect(style.recommendedMembers.safe).toBeLessThanOrEqual(limits.max);
      expect(style.recommendedMembers.min).toBeLessThanOrEqual(style.recommendedMembers.max);
      expect(style.recommendedMembers.max).toBeLessThanOrEqual(style.recommendedMembers.safe);
      expect(style.riskPreview).toEqual(expect.objectContaining({
        detectionRiskLabel: expect.stringMatching(/^(low|medium|high|extreme)$/),
        lootPreviewLabel: expect.stringMatching(/^(low|medium|high|jackpot)$/),
        lossRiskLabel: expect.stringMatching(/^(low|medium|high|brutal)$/),
        heatPreviewLabel: expect.stringMatching(/^(low|medium|high|extreme)$/),
        scoutReportActive: false,
        scoutReportLabel: "Bez scout reportu",
        detectionRiskDisplayLabel: "Neznámé / Odhad",
        lootPreviewDisplayLabel: "Nejistý",
        trapHintLabel: "Neznámá"
      }));
    }
  });

  it("keeps heist start available without a scout report and uses rough preview labels", () => {
    const state = createHeistStateFixture();
    const viewModel = getHeistViewModel(state, "player:1", "district:2");
    const balanced = getStyleView(viewModel, "balanced");
    const started = startDistrictHeist(state, "player:1", "district:2", "balanced", 20);

    expect(viewModel.scoutReport.active).toBe(false);
    expect(viewModel.reasonsBlocked).not.toContain("Chybí scout report");
    expect(balanced.canUse).toBe(true);
    expect(balanced.riskPreview.detectionRiskDisplayLabel).toBe("Neznámé / Odhad");
    expect(balanced.riskPreview.lootPreviewDisplayLabel).toBe("Nejistý");
    expect(balanced.riskPreview.trapHintLabel).toBe("Neznámá");
    expect(started.success).toBe(true);
  });

  it("marks heist scout report active when a successful spy report exists", () => {
    const state = {
      ...createHeistStateFixture(),
      notificationsById: {
        "notification:spy": {
          id: "notification:spy",
          recipientId: "player:1",
          category: "report.spy",
          payload: {
            reportType: "spy",
            actionType: "spy-district",
            playerId: "player:1",
            targetDistrictId: "district:2",
            result: "success",
            trapDetected: true
          }
        }
      }
    };
    const viewModel = getHeistViewModel(state, "player:1", "district:2");
    const balanced = getStyleView(viewModel, "balanced");

    expect(viewModel.scoutReport.active).toBe(true);
    expect(viewModel.scoutReport.label).toBe("Scout report aktivní");
    expect(balanced.riskPreview.scoutReportActive).toBe(true);
    expect(balanced.riskPreview.scoutReportLabel).toBe("Scout report aktivní");
    expect(balanced.riskPreview.detectionRiskDisplayLabel).toBe(balanced.riskPreview.detectionRiskLabel);
    expect(balanced.riskPreview.lootPreviewDisplayLabel).toBe(balanced.riskPreview.lootPreviewLabel);
    expect(balanced.riskPreview.trapHintLabel).toContain("Past");
  });

  it("recommends more members for downtown than park with otherwise equal target pressure", () => {
    const parkState = createHeistStateFixture();
    const downtownState = createHeistStateFixture();
    parkState.districtsById["district:2"].districtType = "park";
    downtownState.districtsById["district:2"].districtType = "downtown";
    parkState.districtsById["district:2"].heat = 0;
    downtownState.districtsById["district:2"].heat = 0;
    (parkState.districtsById["district:2"] as Record<string, unknown>).defenseLoadout = {};
    (downtownState.districtsById["district:2"] as Record<string, unknown>).defenseLoadout = {};

    const parkBalanced = getStyleView(getHeistViewModel(parkState, "player:1", "district:2"), "balanced");
    const downtownBalanced = getStyleView(getHeistViewModel(downtownState, "player:1", "district:2"), "balanced");

    expect(downtownBalanced.recommendedMembers.safe).toBeGreaterThan(parkBalanced.recommendedMembers.safe);
    expect(downtownBalanced.recommendedMembers.min).toBeGreaterThanOrEqual(parkBalanced.recommendedMembers.min);
  });

  it("keeps loot finite and never pulls target balances below zero", () => {
    const state = createHeistStateFixture();
    state.playersById["player:2"].cleanCash = 3;
    state.playersById["player:2"].dirtyCash = 2;
    state.playersById["player:2"].resources.metalParts = 1;
    state.playersById["player:2"].resources.techCore = 1;
    state.playersById["player:2"].resources.chemicals = 1;
    state.playersById["player:2"].resources.biomass = 1;

    const started = startDistrictHeist(state, "player:1", "district:2", "all_in", 25);
    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    active.resolvesAt = 1;
    active.detectionRoll = 0.99;
    active.lossRoll = 0;
    active.lootRoll = 1;
    active.rareLootRoll = 1;

    const preview = calculateHeistLoot(started.nextState!, active, "clean_success");
    expect(Number.isNaN(preview.cleanCash)).toBe(false);
    expect(Number.isNaN(preview.dirtyCash)).toBe(false);
    expect(Object.values(preview.resources).some((amount) => Number.isNaN(amount))).toBe(false);

    const resolved = resolveDistrictHeist(started.nextState!, active.id, 2);
    const target = resolved.nextState!.playersById["player:2"];
    expect(target.cleanCash).toBeGreaterThanOrEqual(0);
    expect(target.dirtyCash).toBeGreaterThanOrEqual(0);
    expect(Object.values(target.resources).every((amount) => Number(amount) >= 0)).toBe(true);
  });

  it("clamps detection chance between 5 and 90 percent", () => {
    const lowState = createHeistStateFixture();
    (lowState.playersById["player:1"] as Record<string, unknown>).heistStealthBonus = 10;
    const highState = createHeistStateFixture();
    highState.districtsById["district:2"].districtType = "downtown";
    highState.districtsById["district:2"].heat = 500;
    highState.districtsById["district:2"].defenseLoadout = { cameras: 80, alarm: 80 };

    const lowHeist = {
      ...firstActiveHeist(startDistrictHeist(lowState, "player:1", "district:2", "stealth", 5).nextState as ReturnType<typeof createHeistStateFixture>),
      gangMembersSent: 5
    };
    const highHeist = {
      ...firstActiveHeist(startDistrictHeist(highState, "player:1", "district:2", "all_in", 25).nextState as ReturnType<typeof createHeistStateFixture>),
      gangMembersSent: 120
    };

    expect(calculateHeistDetectionChance(lowState, lowHeist)).toBe(0.05);
    expect(calculateHeistDetectionChance(highState, highHeist)).toBe(0.9);
  });

  it("trap causes 100 percent loss, no loot, cooldowns, logs, rumors and police hook fallback", () => {
    const state = createHeistStateFixture();
    (state.districtsById["district:2"] as Record<string, unknown>).trap = { active: true };
    const started = startDistrictHeist(state, "player:1", "district:2", "balanced", 20);
    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    active.resolvesAt = 1;

    const resolved = resolveDistrictHeist(started.nextState!, active.id, 2);
    const heists = getPlayerHeistState(resolved.nextState!, "player:1");

    expect(resolved.success).toBe(false);
    expect(resolved.outcome).toBe("trap_triggered");
    expect(resolved.gangLost).toBe(20);
    expect(resolved.gangReturned).toBe(0);
    expect(resolved.loot?.cleanCash).toBe(0);
    expect(resolved.nextState?.playersById["player:1"].gangMembers).toBe(80);
    expect(resolved.nextState?.playersById["player:1"].reservedGangMembers).toBe(0);
    expect(heists.cooldowns.globalUntil).toBeGreaterThan(2);
    expect(heists.cooldowns.targetUntilByDistrictId["district:2"]).toBeGreaterThanOrEqual(420000);
    expect(resolved.nextState?.eventLog.length).toBeGreaterThanOrEqual(4);
    expect(resolved.nextState?.rumors.length).toBeGreaterThanOrEqual(2);
    expect(resolved.nextState?.playersById["player:1"].heat).toBeGreaterThan(0);
    expect(resolved.nextState?.playersById["player:1"].policeSuspicion).toBeGreaterThan(0);
  });

  it("enforces same target cooldown after resolve", () => {
    const state = createHeistStateFixture();
    const started = startDistrictHeist(state, "player:1", "district:2", "stealth", 5);
    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    const now = 1_000_000;
    active.resolvesAt = now - 1;
    active.detectionRoll = 0.99;
    active.lossRoll = 0;
    active.rareLootRoll = 1;

    const resolved = resolveDistrictHeist(started.nextState!, active.id, now);
    const repeated = startDistrictHeist(resolved.nextState!, "player:1", "district:2", "stealth", 5);

    expect(repeated.success).toBe(false);
    expect(repeated.reason).toBe("COOLDOWN_ACTIVE");
    expect(repeated.cooldownRemainingSeconds).toBeGreaterThan(0);
  });

  it("applies Motorkářský gang robbery cooldown, dirty-cash loot and heat modifiers", () => {
    const state = createHeistStateFixture();
    state.playersById["player:1"].factionId = "motorkarsky-gang";
    const started = startDistrictHeist(state, "player:1", "district:2", "balanced", 20);
    expect(started.success).toBe(true);
    expect(started.nextState?.playersById["player:1"].heat).toBe(3);

    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    active.resolvesAt = 1;
    active.detectionRoll = 0.99;
    active.lossRoll = 0;
    active.lootRoll = 1;
    active.rareLootRoll = 1;

    const preview = calculateHeistLoot(started.nextState!, active, "clean_success");
    expect(preview.dirtyCash).toBe(82);

    const resolved = resolveDistrictHeist(started.nextState!, active.id, 2);
    const heists = getPlayerHeistState(resolved.nextState!, "player:1");

    expect(resolved.outcome).toBe("clean_success");
    expect(resolved.loot?.dirtyCash).toBe(82);
    expect(resolved.nextState?.playersById["player:1"].heat).toBe(7);
    expect(heists.cooldowns.globalUntil).toBe(153002);
    expect(heists.cooldowns.targetUntilByDistrictId["district:2"]).toBe(255002);
  });

  it("applies Korporat robbery loot penalty through central loot calculation", () => {
    const createLootPreview = (factionId: "mafian" | "korporace") => {
      const state = createHeistStateFixture();
      state.playersById["player:1"].factionId = factionId;
      const started = startDistrictHeist(state, "player:1", "district:2", "balanced", 20);
      const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
      active.resolvesAt = 1;
      active.detectionRoll = 0.99;
      active.lossRoll = 0;
      active.lootRoll = 1;
      active.rareLootRoll = 1;
      return calculateHeistLoot(started.nextState!, active, "clean_success");
    };

    const baseline = createLootPreview("mafian");
    const corporate = createLootPreview("korporace");

    expect(corporate.cleanCash).toBe(Math.floor(baseline.cleanCash * 0.9));
    expect(corporate.dirtyCash).toBe(Math.floor(baseline.dirtyCash * 0.9));
    expect(corporate.resources.chemicals).toBe(Math.floor(baseline.resources.chemicals * 0.9));
  });

  it("ticks due heists and leaves missing optional systems safe", () => {
    const minimalState = {
      mode: "free",
      playersById: {
        "player:1": { id: "player:1", gangMembers: 20 },
        "player:2": { id: "player:2", gangMembers: 20, cleanCash: 100 }
      },
      districtsById: {
        "district:2": { id: "district:2", ownerPlayerId: "player:2", districtType: "park" }
      }
    };
    const started = startDistrictHeist(minimalState, "player:1", "district:2", "stealth", 5);
    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    active.resolvesAt = 1;
    active.detectionRoll = 0.99;
    active.lossRoll = 0;
    active.rareLootRoll = 1;

    const ticked = tickHeists(started.nextState!, 2);
    const viewModel = getHeistViewModel(ticked.nextState, "player:1", "district:2");

    expect(ticked.results).toHaveLength(1);
    expect(ticked.results[0].resolved).toBe(true);
    expect(ticked.nextState.eventLog.length).toBeGreaterThan(0);
    expect(viewModel.styles).toHaveLength(3);
    expect(ticked.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
  });

  it("snapshots deterministic rolls without reading wall clock or global RNG", () => {
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now must not be used by canonical heist rules");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by canonical heist rules");
    });

    try {
      const started = startDistrictHeistCore(
        createHeistStateFixture(),
        "player:1",
        "district:2",
        "balanced",
        20,
        { nowMs: 42_000, seed: "command:heist:deterministic" }
      );
      const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);

      expect(active).toEqual(expect.objectContaining({
        startedAt: 42_000,
        rngSeed: "command:heist:deterministic:player:1:district:2:balanced:20",
        detectionRoll: expect.any(Number),
        lossRoll: expect.any(Number),
        lootRoll: expect.any(Number),
        rareLootRoll: expect.any(Number)
      }));
      expect(started.nextState?.eventLog[0]?.createdAt).toBe(42_000);
      expect(started.nextState?.rumors[0]?.createdAt).toBe(42_000);
    } finally {
      dateNow.mockRestore();
      random.mockRestore();
    }
  });

  it("replays the same seeded heist into the same snapshot and outcome", () => {
    const startContext = { nowMs: 10_000, seed: "command:heist:replay" };
    const leftStart = startDistrictHeistCore(
      createHeistStateFixture(),
      "player:1",
      "district:2",
      "all_in",
      25,
      startContext
    );
    const rightStart = startDistrictHeistCore(
      createHeistStateFixture(),
      "player:1",
      "district:2",
      "all_in",
      25,
      startContext
    );

    expect(leftStart).toEqual(rightStart);
    const leftActive = firstActiveHeist(leftStart.nextState as ReturnType<typeof createHeistStateFixture>);
    const resolutionContext = {
      nowMs: leftActive.resolvesAt,
      seed: "tick:heist:replay"
    };
    const leftResolved = resolveDistrictHeistCore(leftStart.nextState!, leftActive.id, resolutionContext);
    const rightResolved = resolveDistrictHeistCore(rightStart.nextState!, leftActive.id, resolutionContext);

    expect(leftResolved).toEqual(rightResolved);
    const repeatedTick = tickHeistsCore(leftResolved.nextState!, resolutionContext);
    expect(repeatedTick.results).toEqual([]);
    expect(repeatedTick.nextState).toEqual(leftResolved.nextState);
  });

  it("derives stable fallback rolls for legacy snapshots that have no stored RNG fields", () => {
    const started = startDistrictHeistCore(
      createHeistStateFixture(),
      "player:1",
      "district:2",
      "stealth",
      5,
      { nowMs: 2_000, seed: "command:heist:legacy" }
    );
    const active = firstActiveHeist(started.nextState as ReturnType<typeof createHeistStateFixture>);
    const legacyState = structuredClone(started.nextState!);
    const legacyActive = firstActiveHeist(legacyState as ReturnType<typeof createHeistStateFixture>);
    delete legacyActive.rngSeed;
    delete legacyActive.detectionRoll;
    delete legacyActive.lossRoll;
    delete legacyActive.lootRoll;
    delete legacyActive.rareLootRoll;

    const first = resolveDistrictHeistCore(
      structuredClone(legacyState),
      active.id,
      { nowMs: active.resolvesAt, seed: "tick:legacy:first-instance" }
    );
    const second = resolveDistrictHeistCore(
      structuredClone(legacyState),
      active.id,
      { nowMs: active.resolvesAt, seed: "tick:legacy:second-instance" }
    );

    expect(first.outcome).toBe(second.outcome);
    expect(first.loot).toEqual(second.loot);
    expect(first.gangLost).toBe(second.gangLost);
  });
});
