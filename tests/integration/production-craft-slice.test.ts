import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";
import {
  advanceStateAcrossDueTick,
  stageStateImmediatelyBeforeTick
} from "../fixtures/timed-operation-fixtures";

describe("production craft gameplay slice", () => {
  it("starts a server-authoritative pharmacy Stim Pack immediately and produces it when due", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-craft-slice";
    const playerId = "player:producer";
    const districtId = "district:producer";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createDistrictBuildingSliceSeed({ instanceId, playerId, districtId, mode: "free" });
    server.instanceManager.startInstance(instanceId);
    const client = createClientApp({ transport: createInMemoryClientTransport(server.gameplaySliceTransport) });
    const session = await createDevGameplaySession(server, { serverInstanceId: instanceId, playerId, districtId });
    const initialRender = await client.load(session.loadRequest);
    const buildingId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "pharmacy")?.buildingId;
    const resourceStateId = runtime.state.playersById[playerId]!.resourceStateId;
    const stimPacksBefore = Number(runtime.state.resourceStatesById[resourceStateId]?.balances["stim-pack"] || 0);

    expect(buildingId).toBeTruthy();
    const crafted = await client.dispatch({
      id: "command:craft:stim-pack",
      type: "craft-item",
      mode: "free",
      playerId,
      serverInstanceId: instanceId,
      issuedAt: new Date().toISOString(),
      clientRequestId: null,
      payload: { districtId, buildingId: buildingId!, recipeId: "stim-pack", quantity: 1 }
    });
    const line = runtime.state.buildingsById[buildingId!]?.productionLines?.["stim-pack"];

    expect(crafted.errors).toEqual([]);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === buildingId)?.pharmacy?.lines.find(
      (line) => line.recipeId === "stim-pack"
    )).toMatchObject({
      executionMode: "legacy-timed",
      queuedAmount: 1,
      activeAmount: 1,
      playerStoredAmount: stimPacksBefore,
      unitCleanCashCost: 800
    });
    expect(line?.activeCompletesAtTick).toBeGreaterThan(runtime.state.root.tick);
    runtime.state = stageStateImmediatelyBeforeTick(runtime.state, line!.activeCompletesAtTick!);
    expect(runtime.state.resourceStatesById[resourceStateId]?.balances["stim-pack"] ?? 0).toBe(stimPacksBefore);
    runtime.state = advanceStateAcrossDueTick(
      runtime.state,
      line!.activeCompletesAtTick!,
      { config: runtime.config }
    ).nextState;
    await client.load(session.loadRequest);
    expect(runtime.state.resourceStatesById[resourceStateId]?.balances["stim-pack"] ?? 0).toBe(stimPacksBefore);
    expect(runtime.state.resourceStatesById[`resource:${buildingId}`]?.balances["stim-pack"]).toBe(1);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === buildingId)?.pharmacy?.lines.find(
      (candidate) => candidate.recipeId === "stim-pack"
    )).toMatchObject({ producedAmount: 1, playerStoredAmount: stimPacksBefore, canCollect: true });
    expect(runtime.state.buildingsById[buildingId!]?.processing).toBeNull();
  }, 30_000);
});
