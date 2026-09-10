import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, createPoliceReadModel, runTick } from "@empire/game-core";
import type { HeatReductionMethod, ReducePoliceHeatCommand } from "@empire/shared-types";
import { createCoreStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";
const context = { config: resolveModeConfig("free") };
const fixture = () => {
  const state = createCoreStateFixture();
  state.policeStatesById["police:1"] = { id: "police:1", ownerPlayerId: "player:1", heat: 80, wantedLevel: 4, activeFlags: [], lastDecayTick: 0, version: 1 };
  state.resourceStatesById["resource:1"].balances = { cash: 6000, "dirty-cash": 3000 };
  state.districtsById["district:1"].influence = 25;
  return state;
};
const command = (method: HeatReductionMethod): ReducePoliceHeatCommand => ({
  id: `command:reduce:${method}`, type: "reduce-police-heat", playerId: "player:1", serverInstanceId: "instance:1", mode: "free",
  issuedAt: new Date(0).toISOString(), clientRequestId: null, payload: { method }
});

describe("server-authoritative paid heat reduction", () => {
  it.each(["dirty", "clean", "influence"] as const)("charges %s, applies the advertised reduction and exposes its audit and cooldown", (method) => {
    const state = fixture();
    const before = createPoliceReadModel(state, "player:1", context).heatReductionActions!.find((option) => option.method === method)!;
    const result = applyCommand(state, command(method), context);
    expect(result.errors).toEqual([]);
    const police = result.nextState.policeStatesById["police:1"];
    const entry = police.heatReductionHistory![0];
    expect(entry.auditRiskPct).toBe(before.auditRiskPct);
    expect(entry.heatReduced).toBe(before.actualHeatReduction);
    expect(police.heat).toBe(80 - before.actualHeatReduction + entry.auditHeatGain);
    if (method === "influence") {
      expect(result.nextState.districtsById["district:1"].influence).toBe(5);
      expect(result.nextState.resourceStatesById["resource:1"].balances).toEqual(state.resourceStatesById["resource:1"].balances);
      expect(entry.audited).toBe(false);
    } else {
      const currency = method === "clean" ? "cash" : "dirty-cash";
      expect(result.nextState.resourceStatesById["resource:1"].balances[currency]).toBe(state.resourceStatesById["resource:1"].balances[currency] - before.cost - entry.fine);
    }
    const after = createPoliceReadModel(result.nextState, "player:1", context);
    expect(after.heatJournal![0].reason).toBe(entry.message);
    expect(after.heatReductionActions!.every((option) => !option.available)).toBe(true);
    const duplicate = applyCommand(result.nextState, { ...command(method), id: "other-id" }, context);
    expect(duplicate.errors[0].code).toBe("heat_reduction_unavailable");
    expect(duplicate.nextState).toBe(result.nextState);
  });

  it("debits influence across owned districts, without spending a rival's influence", () => {
    const state = fixture();
    state.districtsById["district:1"].influence = 3;
    state.districtsById["district:2"] = createDistrictFixture({ id: "district:2", ownerPlayerId: "player:1", influence: 22 });
    state.districtsById["district:3"] = createDistrictFixture({ id: "district:3", ownerPlayerId: "player:2", influence: 100 });
    const result = applyCommand(state, command("influence"), context);
    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].influence).toBe(0);
    expect(result.nextState.districtsById["district:2"].influence).toBe(5);
    expect(result.nextState.districtsById["district:3"].influence).toBe(100);
  });

  it("rejects zero heat, missing funds and invalid methods without changing anything", () => {
    for (const kind of ["zero", "funds", "invalid"]) {
      const state = fixture();
      if (kind === "zero") state.policeStatesById["police:1"].heat = 0;
      if (kind === "funds") state.resourceStatesById["resource:1"].balances.cash = 100;
      const result = applyCommand(state, command(kind === "invalid" ? "forged" as HeatReductionMethod : "clean"), context);
      expect(result.errors).not.toEqual([]);
      expect(result.nextState).toBe(state);
    }
  });

  it("keeps audit rolls independent of client command IDs, caps fines, and exercises both outcomes", () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 100; seed++) {
      const state = fixture();
      state.serverInstance.worldSeed = `audit:${seed}`;
      state.resourceStatesById["resource:1"].balances["dirty-cash"] = 2600;
      const a = applyCommand(state, command("dirty"), context);
      const b = applyCommand(state, { ...command("dirty"), id: `chosen-client-id:${seed}` }, context);
      expect(a.nextState.policeStatesById["police:1"].heatReductionHistory).toEqual(b.nextState.policeStatesById["police:1"].heatReductionHistory);
      const entry = a.nextState.policeStatesById["police:1"].heatReductionHistory![0];
      outcomes.add(entry.audited);
      expect(entry.fine).toBe(entry.audited ? 100 : 0);
    }
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it("retains heat when merely waiting and retains payment cooldowns across snapshot restoration", () => {
    const state = fixture();
    state.policeStatesById["police:1"].heat = 20;
    const waited = runTick(state, context).nextState;
    expect(waited.policeStatesById["police:1"].heat).toBe(20);
    const paid = applyCommand(state, command("clean"), context).nextState;
    const restored = structuredClone(paid);
    expect(applyCommand(restored, command("dirty"), context).errors[0].code).toBe("heat_reduction_unavailable");
  });
});
