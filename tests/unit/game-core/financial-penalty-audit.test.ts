import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "@empire/game-core";
import type { RunBuildingActionCommand } from "@empire/shared-types";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { resolveCasinoAuditRisk } from "../../../packages/game-core/src/handlers/casinoBuildingActions";

const config = resolveModeConfig("free");
describe("meaningful financial penalties", () => {
  it.each([
    ["stock_exchange", "stockExchange", "speculative_buy", "stock_exchange_trading_suspended"],
    ["central_bank", "centralBank", "liquidity_injection", "central_bank_liquidity_blocked"]
  ])("enforces and expires the %s restriction without taking payment on rejection", (type, metadataKey, actionId, code) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(type, { playerBalances: { cash: 100_000 }, buildingOverrides: { metadata: { [metadataKey]: { feeReductionDisabledUntilTick: 10 } } } });
    state.districtsById[building.districtId].influence = 1000;
    const command: RunBuildingActionCommand = { id: `restriction:${type}`, type: "run-building-action", playerId: "player:1", serverInstanceId: state.serverInstance.id, mode: "free", issuedAt: new Date(0).toISOString(), clientRequestId: null,
      payload: { buildingId: building.id, districtId: building.districtId, actionId, investmentCleanCash: 1000, targetCategory: "materials" } };
    const rejected = applyCommand(state, command, { config });
    expect(rejected.errors.map(error => error.code)).toContain(code);
    expect(rejected.nextState).toBe(state);
    expect(state.resourceStatesById["resource:1"].balances.cash).toBe(100_000);
    state.root.tick = 10;
    expect(applyCommand(state, command, { config }).errors).toEqual([]);
  });

  it("never displays casino audit probability above 100 percent", () => {
    const { building } = createCoreStateWithFixedBuildingFixture("casino", { buildingOverrides: { metadata: { casino: { auditRiskBonuses: [{ expiresAtTick: 100, riskPct: 250, source: "audit" }] } } } });
    expect(resolveCasinoAuditRisk({ config: config.balance.casino!, building, playerHeat: 200, tick: 1, tickRateMs: config.tickRateMs }).riskPct).toBe(100);
  });
});
