import { describe, expect, it } from "vitest";
import {
  checkGameStateInvariants,
  createPlayerMarketListing,
  deterministicUnitInterval,
  getNormalMarketRotation,
  initializeServerMarket,
  resolveImmediateHeist,
  resolveOccupyBalance,
  resolveOccupyInfluenceCost,
  resolveOccupyPopulationCost,
  resolveResourceCapacity,
  runTick,
  type MarketTransaction
} from "@empire/game-core";
import type {
  BuyMarketResourceCommand,
  BuyPlayerMarketListingCommand,
  CreatePlayerMarketListingCommand
} from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import type { ServerInstanceRuntime } from "../../apps/server/src/runtime/instance/server-instance-runtime";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling";
import {
  createAttackDistrictCommandFixture,
  createHeistDistrictCommandFixture,
  createOccupyDistrictCommandFixture,
  createPlaceTrapCommandFixture
} from "../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture,
  seedSuccessfulSpyIntel
} from "../fixtures/game-state-fixtures";
import {
  createDevGameplaySession,
  loadWithDevGameplaySession
} from "../helpers/gameplay-session-test-helpers";

const FIXED_NOW = "2026-05-17T12:00:00.000Z";
const HEIST_MATERIAL_RESOURCE_IDS = [
  "chemicals",
  "biomass",
  "metal-parts",
  "stim-pack",
  "tech-core",
  "combat-module"
] as const;

describe("gameplay slice optimistic concurrency", () => {
  it("accepts commands with the current state version and returns debug-only latency metadata", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:current";
    const playerId = "player:concurrency:current";
    const districtId = "district:concurrency:current";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    runtime.config = {
      ...runtime.config,
      technical: {
        ...runtime.config.technical,
        debug: {
          ...runtime.config.technical.debug,
          allowDebugTools: true
        }
      }
    };
    const response = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:current:1",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(response.errors).toEqual([]);
    expect(response.accepted).toBe(true);
    expect(response.metadata?.stateVersion).toBeGreaterThan(expectedStateVersion ?? 0);
    expect(response.metadata?.commandTiming).toMatchObject({
      commandId: "command:concurrency:current:1",
      commandType: "place-trap",
      status: "applied"
    });
    expect(response.metadata?.commandTiming?.serverResolutionMs).toBeGreaterThanOrEqual(0);
    expect(response.metadata?.commandTiming?.persistenceMs).toBeGreaterThanOrEqual(0);
    expect(response.metadata?.commandTiming?.totalServerMs).toBeGreaterThanOrEqual(0);
  });

  it("revalidates conflict commands against current state instead of rejecting on global version", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:stale";
    const playerId = "player:concurrency:stale";
    const districtId = "district:concurrency:stale";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const staleStateVersion = load.metadata?.stateVersion ?? 0;
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: staleStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:stale:accepted",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(accepted.errors).toEqual([]);
    expect(accepted.accepted).toBe(true);

    const stale = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: staleStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:stale:rejected",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(stale.accepted).toBe(false);
    expect(stale.errors[0]?.code).toBe("trap_already_active");
    expect(stale.readModel?.player.playerId).toBe(playerId);
    expect(stale.metadata?.stateVersion).toBe(accepted.metadata?.stateVersion);
  });

  it("keeps duplicate command id replay distinct from stale version rejection", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:duplicate";
    const playerId = "player:concurrency:duplicate";
    const districtId = "district:concurrency:duplicate";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const command = createPlaceTrapCommandFixture({
      id: "command:concurrency:duplicate:1",
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: confirmedDistrictId
      }
    });
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });
    const duplicate = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: accepted.metadata?.stateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });

    expect(accepted.errors).toEqual([]);
    expect(accepted.accepted).toBe(true);
    expect(duplicate.accepted).toBe(true);
    expect(duplicate.errors).toEqual([]);
    expect(duplicate.commandResult?.commandId).toBe(command.id);
    expect(duplicate.commandResult?.status).toBe("applied");
    expect(duplicate.metadata?.stateVersion).toBe(accepted.metadata?.stateVersion);
  });

  it("rejects duplicate command ids with a different payload before state mutation", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:payload-conflict";
    const playerId = "player:concurrency:payload-conflict";
    const districtId = "district:concurrency:payload-conflict";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const command = createPlaceTrapCommandFixture({
      id: "command:concurrency:payload-conflict:1",
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: confirmedDistrictId
      }
    });
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });
    const rootAfterAccepted = server.instanceManager.getInstanceById(instanceId)!.state.root.version;
    const conflict = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: accepted.metadata?.stateVersion,
      focusDistrictId: confirmedDistrictId,
      command: {
        ...command,
        payload: {
          districtId: "district:payload-conflict:changed"
        }
      }
    });

    expect(accepted.accepted).toBe(true);
    expect(conflict.accepted).toBe(false);
    expect(conflict.errors[0]?.code).toBe("server.command_payload_conflict");
    expect(server.instanceManager.getInstanceById(instanceId)!.state.root.version).toBe(rootAfterAccepted);
  });

  it("serializes three authenticated same-target attacks through atomic transport ingress", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:attack-race";
    const sessions = await Promise.all(["player:1", "player:3", "player:4"].map((playerId) =>
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId })
    ));
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture(instanceId);
    state.root.version = 100;
    state.playersById["player:2"] = { ...state.playersById["player:2"], lastStandUsedAtTick: 0 };
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: {} };
    configureAttacker(state, "player:1", "district:1");
    addAttacker(state, "player:3", "district:3", "district:2");
    addAttacker(state, "player:4", "district:4", "district:2");
    runtime.state = state;

    const expectedConflictRevision = state.districtsById["district:2"].conflictRevision;
    const commands = [
      ["player:1", "district:1"],
      ["player:3", "district:3"],
      ["player:4", "district:4"]
    ].map(([playerId, sourceDistrictId], index) => createAttackDistrictCommandFixture({
      id: `command:transport:attack-race:${index + 1}`,
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: "district:2",
        sourceDistrictId,
        weapons: { bazooka: 10 },
        expectedConflictRevision
      }
    }));
    const resourcesBefore = Object.fromEntries(["player:1", "player:3", "player:4"].map((playerId) => [
      playerId,
      JSON.stringify(state.resourceStatesById[state.playersById[playerId].resourceStateId])
    ]));
    const responses = await raceTogether(commands.map((command, index) => () =>
      server.gameplaySliceTransport.submit({
        sessionToken: sessions[index]!.sessionToken,
        expectedStateVersion: state.root.version,
        focusDistrictId: command.payload.sourceDistrictId ?? "district:1",
        command
      })
    ));

    expect(responses.filter((response) => response.accepted)).toHaveLength(1);
    expect(responses.filter((response) => !response.accepted).map((response) => response.errors[0]?.code))
      .toEqual(["DISTRICT_CONFLICT_STATE_CHANGED", "DISTRICT_CONFLICT_STATE_CHANGED"]);
    const acceptedPlayerId = commands[responses.findIndex((response) => response.accepted)]!.playerId;
    const pendingAttack = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})[0]!;
    expect(Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})).toHaveLength(1);
    expect(runtime.state.districtsById["district:2"].attackProtectedUntilTick ?? 0).toBe(0);
    expect(runtime.state.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    for (const playerId of ["player:1", "player:3", "player:4"]) {
      if (playerId === acceptedPlayerId) {
        expect(playerBalance(runtime.state, playerId, "bazooka")).toBe(0);
      } else {
        expect(JSON.stringify(runtime.state.resourceStatesById[runtime.state.playersById[playerId].resourceStateId]))
          .toBe(resourcesBefore[playerId]);
      }
    }
    const startEventRecords = await server.instanceManager.listEventRecords(instanceId);
    expect(startEventRecords).toHaveLength(1);
    expect(startEventRecords[0]).toMatchObject({
      causedByCommandId: commands.find((command) => command.playerId === acceptedPlayerId)!.id,
      event: { type: "command-applied", payload: { eventCount: 0 } }
    });
    const resolutionEvents = advanceRuntimeToTick(runtime, pendingAttack.resolveAtTick);
    expect(runtime.state.districtsById["district:2"].attackProtectedUntilTick).toBeGreaterThan(0);
    expect(Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})).toHaveLength(0);
    expect(resolutionEvents.filter((event) => event.type === "district-attacked")).toHaveLength(1);
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(3);
  });

  it("serializes two authenticated occupiers of one neutral district without double charging", async () => {
    const server = createServerApp({ clock: createFixedClock(FIXED_NOW) });
    const instanceId = "instance:free:concurrency:occupy-race";
    const occupiers = [
      { playerId: "player:1", sourceDistrictId: "district:1" },
      { playerId: "player:3", sourceDistrictId: "district:3" }
    ];
    const sessions = await Promise.all(occupiers.map(({ playerId }) =>
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId })
    ));
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture(instanceId);
    state.root.version = 300;
    configureCanonicalPlayerState(state, "player:1", {
      population: 500,
      balances: { cash: 1_000 }
    });
    configureCanonicalPlayerState(state, "player:2", {
      population: 0,
      balances: { cash: 1_000 }
    });
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {}
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 100
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    addAttacker(state, "player:3", "district:3", "district:2");
    configureCanonicalPlayerState(state, "player:3", {
      population: 500,
      balances: { cash: 1_000 }
    });
    state.districtsById["district:3"] = {
      ...state.districtsById["district:3"],
      influence: 100
    };
    runtime.state = state;

    const expectedConflictRevision = state.districtsById["district:2"].conflictRevision;
    const failureChancePct = Number(runtime.config.balance.conflict?.occupyFailureChancePct ?? 5);
    const commands = occupiers.map(({ playerId, sourceDistrictId }, index) =>
      createOccupyDistrictCommandFixture({
        id: findSuccessfulOccupyCommandId(state, playerId, "district:2", failureChancePct, index),
        playerId,
        serverInstanceId: instanceId,
        issuedAt: FIXED_NOW,
        payload: {
          districtId: "district:2",
          sourceDistrictId,
          expectedConflictRevision
        }
      })
    );
    const influenceBefore = Object.fromEntries(occupiers.map(({ playerId }) => [
      playerId,
      totalOwnedInfluence(state, playerId)
    ]));
    const populationBefore = Object.fromEntries(occupiers.map(({ playerId }) => [
      playerId,
      state.playersById[playerId]!.population
    ]));
    const influenceCostByPlayer = Object.fromEntries(occupiers.map(({ playerId }) => [
      playerId,
      resolveOccupyInfluenceCost(state, playerId, runtime.config.balance.conflict)
    ]));
    const populationCostByPlayer = Object.fromEntries(occupiers.map(({ playerId }) => [
      playerId,
      resolveOccupyPopulationCost(state, playerId, runtime.config.balance.conflict)
    ]));
    const responses = await raceTogether(commands.map((command, index) => () =>
      server.gameplaySliceTransport.submit({
        sessionToken: sessions[index]!.sessionToken,
        expectedStateVersion: state.root.version,
        focusDistrictId: occupiers[index]!.sourceDistrictId,
        command
      })
    ));

    expect(responses.filter((response) => response.accepted)).toHaveLength(1);
    expect(responses.filter((response) => !response.accepted).map((response) => response.errors[0]?.code))
      .toEqual(["DISTRICT_CONFLICT_STATE_CHANGED"]);
    const acceptedIndex = responses.findIndex((response) => response.accepted);
    const acceptedPlayerId = commands[acceptedIndex]!.playerId;
    const occupyBalance = resolveOccupyBalance(runtime.config.balance.conflict);
    const acceptedPopulationCost = populationCostByPlayer[acceptedPlayerId]!;
    const acceptedPopulationRefund = Math.floor(acceptedPopulationCost * occupyBalance.populationRefundPct / 100);
    const pendingOccupy = Object.values(runtime.state.pendingOccupyOperationsById ?? {})[0]!;
    expect(Object.values(runtime.state.pendingOccupyOperationsById ?? {})).toHaveLength(1);
    expect(runtime.state.districtsById["district:2"].ownerPlayerId).toBeNull();
    for (const { playerId } of occupiers) {
      expect(totalOwnedInfluence(runtime.state, playerId)).toBe(
        influenceBefore[playerId]! - (playerId === acceptedPlayerId ? influenceCostByPlayer[playerId]! : 0)
      );
      expect(runtime.state.playersById[playerId]!.population).toBe(
        populationBefore[playerId]! - (playerId === acceptedPlayerId ? acceptedPopulationCost : 0)
      );
    }
    const startEventRecords = await server.instanceManager.listEventRecords(instanceId);
    expect(startEventRecords).toHaveLength(1);
    expect(startEventRecords[0]).toMatchObject({
      causedByCommandId: commands[acceptedIndex]!.id,
      event: { type: "command-applied", payload: { eventCount: 0 } }
    });
    const resolutionEvents = advanceRuntimeToTick(runtime, pendingOccupy.resolveAtTick);
    expect(Object.values(runtime.state.pendingOccupyOperationsById ?? {})).toHaveLength(0);
    expect(runtime.state.districtsById["district:2"].ownerPlayerId).toBe(acceptedPlayerId);
    for (const { playerId } of occupiers) {
      expect(totalOwnedInfluence(runtime.state, playerId)).toBeGreaterThanOrEqual(
        influenceBefore[playerId]! - (playerId === acceptedPlayerId ? influenceCostByPlayer[playerId]! : 0)
      );
      expect(runtime.state.playersById[playerId]!.population).toBe(
        populationBefore[playerId]! - (playerId === acceptedPlayerId
          ? acceptedPopulationCost - acceptedPopulationRefund
          : 0)
      );
    }
    const occupyResolutionEvents = resolutionEvents.filter((event) => event.type === "district-captured");
    expect(occupyResolutionEvents).toHaveLength(1);
    expect(occupyResolutionEvents[0]?.payload).toMatchObject({ actionType: "occupy-district" });
    expect(checkGameStateInvariants(runtime.state)).toMatchObject({ passed: true, violations: [] });
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(2);
  });

  it("serializes two authenticated normal-market buyers of the last stock unit", async () => {
    const now = Date.parse(FIXED_NOW);
    const server = createServerApp({ clock: createFixedClock(FIXED_NOW) });
    const instanceId = "instance:free:concurrency:normal-market-race";
    const buyers = [
      { playerId: "player:1", focusDistrictId: "district:1" },
      { playerId: "player:2", focusDistrictId: "district:2" }
    ];
    const sessions = await Promise.all(buyers.map(({ playerId }) =>
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId })
    ));
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture(instanceId);
    state.root.version = 400;
    for (const { playerId } of buyers) {
      configureCanonicalPlayerState(state, playerId, {
        population: 0,
        balances: { cash: 1_000_000 }
      });
    }
    const marketState = initializeServerMarket(state, now);
    const resourceId = getNormalMarketRotation(marketState, { config: runtime.config })[0]!;
    marketState.market.stock[resourceId] = 1;
    runtime.state = marketState;

    const commands: BuyMarketResourceCommand[] = buyers.map(({ playerId }, index) => ({
      id: `command:transport:normal-market-race:${index + 1}`,
      type: "buy-market-resource",
      mode: "free",
      playerId,
      serverInstanceId: instanceId,
      issuedAt: FIXED_NOW,
      payload: {
        resourceId,
        amount: 1,
        marketType: "normal",
        paymentType: "cleanCash"
      },
      clientRequestId: null
    }));
    const cashBefore = Object.fromEntries(buyers.map(({ playerId }) => [
      playerId,
      playerBalance(runtime.state, playerId, "cash")
    ]));
    const responses = await raceTogether(commands.map((command, index) => () =>
      server.gameplaySliceTransport.submit({
        sessionToken: sessions[index]!.sessionToken,
        focusDistrictId: buyers[index]!.focusDistrictId,
        command
      })
    ));

    expect(responses.filter((response) => response.accepted)).toHaveLength(1);
    expect(responses.filter((response) => !response.accepted)).toHaveLength(1);
    expect(responses.find((response) => !response.accepted)?.errors[0]?.code)
      .toBe("market_not_enough_stock");
    const acceptedIndex = responses.findIndex((response) => response.accepted);
    const acceptedPlayerId = commands[acceptedIndex]!.playerId;
    const rejectedPlayerId = commands[acceptedIndex === 0 ? 1 : 0]!.playerId;
    const marketStock = (runtime.state.market as { stock: Record<string, number> }).stock;
    expect(marketStock[resourceId]).toBe(0);
    expect(Number(marketStock[resourceId] ?? 0)).toBeGreaterThanOrEqual(0);
    expect(playerBalance(runtime.state, acceptedPlayerId, resourceId)).toBe(1);
    expect(playerBalance(runtime.state, acceptedPlayerId, "cash")).toBeLessThan(cashBefore[acceptedPlayerId]!);
    expect(playerBalance(runtime.state, rejectedPlayerId, resourceId)).toBe(0);
    expect(playerBalance(runtime.state, rejectedPlayerId, "cash")).toBe(cashBefore[rejectedPlayerId]!);
    expect((runtime.state.market?.transactions as MarketTransaction[]).filter((transaction) =>
      transaction.marketType === "normal"
      && transaction.type === "buy"
      && transaction.resourceId === resourceId
      && transaction.amount === 1
    )).toHaveLength(1);
    expect(checkGameStateInvariants(runtime.state)).toMatchObject({ passed: true, violations: [] });
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(2);
    await expect(server.instanceManager.listEventRecords(instanceId)).resolves.toHaveLength(1);
  });

  it("conserves PvP heist loot while the victim concurrently escrows inventory", async () => {
    const server = createServerApp({ clock: createFixedClock(FIXED_NOW) });
    const instanceId = "instance:free:concurrency:heist-inventory-race";
    const [attackerSession, victimSession] = await Promise.all([
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId: "player:1" }),
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId: "player:2" })
    ]);
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture(instanceId);
    state.root.version = 500;
    configureCanonicalPlayerState(state, "player:1", {
      population: 120,
      balances: {
        cash: 1_000,
        "dirty-cash": 0,
        population: 120,
        chemicals: 0,
        biomass: 0,
        "metal-parts": 0,
        "stim-pack": 0,
        "tech-core": 0,
        "combat-module": 0
      }
    });
    configureCanonicalPlayerState(state, "player:2", {
      population: 120,
      balances: {
        cash: 1_000,
        "dirty-cash": 500,
        population: 120,
        chemicals: 60,
        biomass: 60,
        "metal-parts": 60,
        "stim-pack": 24,
        "tech-core": 24,
        "combat-module": 8
      }
    });
    runtime.state = state;

    const heistCommand = findTransferHeistCommand(
      state,
      instanceId,
      runtime.config.balance.conflict!.heist!
    );
    const listedAmount = 10;
    const listingCommand: CreatePlayerMarketListingCommand = {
      id: "command:transport:heist-inventory-race:listing",
      type: "create-player-market-listing",
      mode: "free",
      playerId: "player:2",
      serverInstanceId: instanceId,
      issuedAt: FIXED_NOW,
      payload: {
        resourceId: "chemicals",
        amount: listedAmount,
        unitPrice: 10,
        paymentType: "cleanCash"
      },
      clientRequestId: null
    };
    const before = Object.fromEntries(["player:1", "player:2"].map((playerId) => [
      playerId,
      { ...runtime.state.resourceStatesById[runtime.state.playersById[playerId].resourceStateId].balances }
    ]));
    const [heistResponse, listingResponse] = await raceTogether([
      () => server.gameplaySliceTransport.submit({
        sessionToken: attackerSession.sessionToken,
        focusDistrictId: "district:1",
        command: heistCommand
      }),
      () => server.gameplaySliceTransport.submit({
        sessionToken: victimSession.sessionToken,
        focusDistrictId: "district:2",
        command: listingCommand
      })
    ]);

    expect(heistResponse.accepted, heistResponse.errors[0]?.code).toBe(true);
    expect(listingResponse.accepted, listingResponse.errors[0]?.code).toBe(true);
    const heistVersion = heistResponse.commandResult?.rootVersionAfter;
    const listingVersion = listingResponse.commandResult?.rootVersionAfter;
    expect(heistVersion).toEqual(expect.any(Number));
    expect(listingVersion).toEqual(expect.any(Number));
    expect(heistVersion).not.toBe(listingVersion);
    const pendingHeist = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
      .find((operation) => operation.command.id === heistCommand.id)!;
    expect(pendingHeist.operationType).toBe("heist");
    expect(runtime.state.playersById["player:1"].population).toBe(110);
    const playerListings = (runtime.state.market as {
      playerListings?: Array<{ sellerPlayerId: string; resourceId: string; amount: number; status: string }>;
    } | undefined)?.playerListings ?? [];
    const listing = playerListings.find((candidate) =>
      candidate.sellerPlayerId === "player:2" && candidate.resourceId === "chemicals"
    );
    expect(listing).toMatchObject({ amount: listedAmount, status: "active" });
    const startEventRecords = await server.instanceManager.listEventRecords(instanceId);
    expect(startEventRecords.find((record) => record.causedByCommandId === heistCommand.id)).toMatchObject({
      event: { type: "command-applied", payload: { eventCount: 0 } }
    });

    for (const resourceId of HEIST_MATERIAL_RESOURCE_IDS) {
      expect(playerBalance(runtime.state, "player:1", resourceId)).toBe(Number(before["player:1"]![resourceId] ?? 0));
      expect(playerBalance(runtime.state, "player:2", resourceId)).toBe(
        Number(before["player:2"]![resourceId] ?? 0) - (resourceId === "chemicals" ? listedAmount : 0)
      );
    }
    const resolutionEvents = advanceRuntimeToTick(runtime, pendingHeist.resolveAtTick);
    expect(Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})).toHaveLength(0);
    expect(resolutionEvents.filter((event) => event.type === "district-heisted")).toHaveLength(1);

    for (const resourceId of HEIST_MATERIAL_RESOURCE_IDS) {
      const attackerBefore = Number(before["player:1"]![resourceId] ?? 0);
      const victimBefore = Number(before["player:2"]![resourceId] ?? 0);
      const escrowed = resourceId === "chemicals" ? listedAmount : 0;
      const victimAtHeist = victimBefore - escrowed;
      const attackerAfter = playerBalance(runtime.state, "player:1", resourceId);
      const victimAfter = playerBalance(runtime.state, "player:2", resourceId);
      const transferred = attackerAfter - attackerBefore;

      expect(transferred).toBeGreaterThanOrEqual(Math.floor(victimAtHeist * 0.02));
      expect(transferred).toBeLessThanOrEqual(Math.floor(victimAtHeist * 0.07));
      expect(victimAfter).toBe(victimBefore - escrowed - transferred);
      expect(attackerAfter + victimAfter + escrowed).toBe(attackerBefore + victimBefore);
      expect(attackerAfter).toBeLessThanOrEqual(resolveResourceCapacity(
        runtime.state,
        "player:1",
        resourceId,
        runtime.config.balance.warehouse!
      ));
      expect(victimAfter).toBeLessThanOrEqual(resolveResourceCapacity(
        runtime.state,
        "player:2",
        resourceId,
        runtime.config.balance.warehouse!
      ));
    }
    expect(playerBalance(runtime.state, "player:1", "chemicals")).toBeGreaterThan(0);
    for (const resourceState of Object.values(runtime.state.resourceStatesById)) {
      for (const amount of Object.values(resourceState.balances)) {
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    }
    expect(checkGameStateInvariants(runtime.state)).toMatchObject({ passed: true, violations: [] });
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(2);
    await expect(server.instanceManager.listEventRecords(instanceId)).resolves.toHaveLength(2);
  });

  it("serializes two authenticated buyers of one listing without duplicate transfer", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:market-listing-race";
    const buyers = [
      { playerId: "player:2", focusDistrictId: "district:2" },
      { playerId: "player:3", focusDistrictId: "district:3" }
    ];
    const sessions = await Promise.all(buyers.map(({ playerId }) =>
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId })
    ));
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture(instanceId);
    state.root.version = 200;
    state.resourceStatesById[state.playersById["player:1"].resourceStateId].balances = {
      cash: 1_000,
      chemicals: 10
    };
    state.playersById["player:2"] = {
      ...state.playersById["player:2"],
      resourceStateId: "resource:2"
    };
    state.resourceStatesById["resource:2"] = createResourceStateFixture({
      id: "resource:2",
      ownerType: "player",
      ownerId: "player:2",
      balances: { cash: 1_000, chemicals: 0 }
    });
    addMarketBuyer(state, "player:3", "district:3");
    const listed = createPlayerMarketListing(
      state,
      state.playersById["player:1"],
      "chemicals",
      10,
      10,
      "cleanCash",
      Date.now()
    );
    expect(listed.success, `${listed.reason}: ${listed.message}`).toBe(true);
    expect(listed.listingId).toBeTruthy();
    runtime.state = listed.nextState as typeof runtime.state;

    const commands: BuyPlayerMarketListingCommand[] = buyers.map(
      ({ playerId }, index) => ({
        id: `command:transport:market-listing-race:${index + 1}`,
        type: "buy-player-market-listing",
        mode: "free",
        playerId,
        serverInstanceId: instanceId,
        issuedAt: new Date(0).toISOString(),
        payload: { listingId: listed.listingId! },
        clientRequestId: null
      })
    );
    const expectedStateVersion = runtime.state.root.version;
    const responses = await raceTogether(commands.map((command, index) => () =>
      server.gameplaySliceTransport.submit({
        sessionToken: sessions[index]!.sessionToken,
        expectedStateVersion,
        focusDistrictId: buyers[index]!.focusDistrictId,
        command
      })
    ));

    expect(responses.filter((response) => response.accepted)).toHaveLength(1);
    expect(responses.filter((response) => !response.accepted)).toHaveLength(1);
    expect(responses.find((response) => !response.accepted)?.errors[0]?.code)
      .toBe("market_listing_not_found");
    const acceptedIndex = responses.findIndex((response) => response.accepted);
    const acceptedPlayerId = commands[acceptedIndex]!.playerId;
    const rejectedPlayerId = commands[acceptedIndex === 0 ? 1 : 0]!.playerId;
    const balanceOf = (playerId: string, resourceId: string) =>
      Number(runtime.state.resourceStatesById[
        runtime.state.playersById[playerId].resourceStateId
      ].balances[resourceId] ?? 0);
    expect(balanceOf("player:1", "cash")).toBe(1_100);
    expect(balanceOf("player:1", "chemicals")).toBe(0);
    expect(balanceOf(acceptedPlayerId, "cash")).toBe(900);
    expect(balanceOf(acceptedPlayerId, "chemicals")).toBe(10);
    expect(balanceOf(rejectedPlayerId, "cash")).toBe(1_000);
    expect(balanceOf(rejectedPlayerId, "chemicals")).toBe(0);
    expect(runtime.state.market?.playerListings).toHaveLength(0);
    const transactions = runtime.state.market?.transactions;
    expect(Array.isArray(transactions)).toBe(true);
    expect((transactions as MarketTransaction[]).filter((transaction) =>
      transaction.marketType === "player"
      && transaction.type === "buy"
      && transaction.resourceId === "chemicals"
      && transaction.amount === 10
      && transaction.totalPrice === 100
    )).toHaveLength(1);
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(2);
    await expect(server.instanceManager.listEventRecords(instanceId)).resolves.toHaveLength(1);
  });
});

const configureAttacker = (state: ReturnType<typeof createCombatStateFixture>, playerId: string, sourceDistrictId: string) => {
  const player = state.playersById[playerId];
  state.playersById[playerId] = { ...player, population: 500, attackLoadout: { bazooka: 10 } };
  state.resourceStatesById[player.resourceStateId] = {
    ...state.resourceStatesById[player.resourceStateId],
    balances: { ...state.resourceStatesById[player.resourceStateId].balances, population: 500, bazooka: 10 }
  };
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, "district:2", "player:2");
};

/**
 * Holds every request at the same explicit promise barrier before any submit
 * reaches the atomic ingress. This makes the race deterministic instead of
 * depending on incidental scheduling inside Promise.all.
 */
const raceTogether = async <T>(tasks: readonly (() => Promise<T>)[]): Promise<T[]> => {
  if (tasks.length === 0) return [];
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  return Promise.all(tasks.map(async (task) => {
    arrived += 1;
    if (arrived === tasks.length) release();
    await barrier;
    return task();
  }));
};

const addAttacker = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string
) => {
  const suffix = playerId.split(":").at(-1)!;
  const resourceStateId = `resource:${playerId}`;
  const cooldownStateId = `cooldown:${playerId}`;
  const policeStateId = `police:${playerId}`;
  state.playersById[playerId] = createPlayerFixture({
    id: playerId,
    accountId: `account:${suffix}`,
    serverInstanceId: state.serverInstance.id,
    homeDistrictId: sourceDistrictId,
    resourceStateId,
    cooldownStateId,
    policeStateId,
    population: 500,
    attackLoadout: { bazooka: 10 }
  });
  state.resourceStatesById[resourceStateId] = createResourceStateFixture({
    id: resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: { cash: 1_000, population: 500, bazooka: 10 }
  });
  state.cooldownStatesById[cooldownStateId] = {
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[policeStateId] = {
    id: policeStateId,
    ownerPlayerId: playerId,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  state.districtsById[sourceDistrictId] = createDistrictFixture({
    id: sourceDistrictId,
    serverInstanceId: state.serverInstance.id,
    ownerPlayerId: playerId,
    adjacentDistrictIds: [targetDistrictId]
  });
  state.districtsById[targetDistrictId].adjacentDistrictIds = [
    ...new Set([...state.districtsById[targetDistrictId].adjacentDistrictIds, sourceDistrictId])
  ];
  state.root.playerIds.push(playerId);
  state.root.districtIds.push(sourceDistrictId);
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, targetDistrictId, state.districtsById[targetDistrictId].ownerPlayerId);
};

const addMarketBuyer = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  districtId: string
) => {
  const suffix = playerId.split(":").at(-1)!;
  const resourceStateId = `resource:${playerId}`;
  const cooldownStateId = `cooldown:${playerId}`;
  const policeStateId = `police:${playerId}`;
  state.playersById[playerId] = createPlayerFixture({
    id: playerId,
    accountId: `account:${suffix}`,
    serverInstanceId: state.serverInstance.id,
    name: `Buyer ${suffix}`,
    homeDistrictId: districtId,
    resourceStateId,
    cooldownStateId,
    policeStateId
  });
  state.resourceStatesById[resourceStateId] = createResourceStateFixture({
    id: resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: { cash: 1_000, chemicals: 0 }
  });
  state.cooldownStatesById[cooldownStateId] = {
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[policeStateId] = {
    id: policeStateId,
    ownerPlayerId: playerId,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  state.districtsById[districtId] = createDistrictFixture({
    id: districtId,
    serverInstanceId: state.serverInstance.id,
    ownerPlayerId: playerId,
    adjacentDistrictIds: ["district:2"]
  });
  state.root.playerIds.push(playerId);
  state.root.districtIds.push(districtId);
};

const configureCanonicalPlayerState = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  options: {
    population: number;
    balances: Record<string, number>;
  }
) => {
  const player = state.playersById[playerId];
  const resourceStateId = `resource:${playerId}`;
  const cooldownStateId = `cooldown:${playerId}`;
  const policeStateId = `police:${playerId}`;
  state.playersById[playerId] = {
    ...player,
    serverInstanceId: state.serverInstance.id,
    population: options.population,
    resourceStateId,
    cooldownStateId,
    policeStateId
  };
  state.resourceStatesById[resourceStateId] = createResourceStateFixture({
    id: resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: options.balances
  });
  state.cooldownStatesById[cooldownStateId] = {
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[policeStateId] = {
    id: policeStateId,
    ownerPlayerId: playerId,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: state.root.tick,
    activeFlags: [],
    version: 1
  };
};

const totalOwnedInfluence = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string
): number => Object.values(state.districtsById)
  .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
  .reduce((total, district) => total + Math.max(0, Number(district.influence ?? 0)), 0);

const playerBalance = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  resourceId: string
): number => Number(state.resourceStatesById[state.playersById[playerId].resourceStateId].balances[resourceId] ?? 0);

const advanceRuntimeToTick = (
  runtime: ServerInstanceRuntime,
  targetTick: number
): ReturnType<typeof runTick>["events"] => {
  if (runtime.state.root.tick < targetTick - 1) {
    runtime.state = {
      ...runtime.state,
      root: {
        ...runtime.state.root,
        tick: targetTick - 1,
        version: runtime.state.root.version + 1
      },
      serverInstance: {
        ...runtime.state.serverInstance,
        currentTick: targetTick - 1
      }
    };
  }
  const events: ReturnType<typeof runTick>["events"] = [];
  while (runtime.state.root.tick < targetTick) {
    const tick = runTick(runtime.state, { config: runtime.config });
    if (tick.nextState.root.tick <= runtime.state.root.tick) {
      throw new Error(`Runtime stopped at tick ${runtime.state.root.tick} before ${targetTick}.`);
    }
    runtime.state = tick.nextState;
    events.push(...tick.events);
  }
  return events;
};

const findSuccessfulOccupyCommandId = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  targetDistrictId: string,
  failureChancePct: number,
  candidateOffset: number
): string => {
  for (let index = candidateOffset * 1_000; index < (candidateOffset + 1) * 1_000; index += 1) {
    const commandId = `command:transport:occupy-race:${playerId}:${index}`;
    const roll = deterministicUnitInterval(
      `${state.serverInstance.worldSeed}:occupy:${commandId}:${playerId}:${targetDistrictId}:${state.root.tick}`
    );
    if (roll >= failureChancePct / 100) return commandId;
  }
  throw new Error(`No deterministic successful occupy seed found for ${playerId}.`);
};

const findTransferHeistCommand = (
  state: ReturnType<typeof createCombatStateFixture>,
  serverInstanceId: string,
  config: Parameters<typeof resolveImmediateHeist>[3]
) => {
  const resolveAtTick = state.root.tick + Math.max(1, config.globalCooldownTicks);
  const resolutionState = {
    ...state,
    root: { ...state.root, tick: resolveAtTick },
    serverInstance: { ...state.serverInstance, currentTick: resolveAtTick }
  };
  for (let index = 0; index < 5_000; index += 1) {
    const command = createHeistDistrictCommandFixture({
      id: `command:transport:heist-inventory-race:${index}`,
      playerId: "player:1",
      serverInstanceId,
      issuedAt: FIXED_NOW,
      payload: {
        targetDistrictId: "district:2",
        sourceDistrictId: "district:1",
        style: "balanced",
        populationSent: 10,
        expectedConflictRevision: state.districtsById["district:2"].conflictRevision
      }
    });
    if (resolveImmediateHeist(resolutionState, command, "district:1", config).lootMultiplier > 0) {
      return command;
    }
  }
  throw new Error("No deterministic transferring heist seed found.");
};
