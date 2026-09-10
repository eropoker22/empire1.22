import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { resolveStockExchangeAction } from "../../../packages/game-core/src/handlers/stockExchangeActionResolution";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("stock exchange monetary outcome", () => {
  it("cannot be rerolled by choosing a different client command id", () => {
    const config = resolveModeConfig("free");
    const { state, building } = createCoreStateWithFixedBuildingFixture("stock_exchange");
    const resolve = (commandId: string) => resolveStockExchangeAction({
      state, building, commandId, balances: { cash: 100_000 }, tickRateMs: config.tickRateMs,
      config: config.balance.stockExchange!, action: config.balance.buildingActions!.speculative_buy,
      payload: { districtId: building.districtId, buildingId: building.id, actionId: "speculative_buy", investmentCleanCash: 10_000, targetCategory: "materials" }
    })!;
    const original = resolve("chosen-by-client:1");
    for (let i = 2; i < 100; i++) {
      const alternative = resolve(`chosen-by-client:${i}`);
      expect(alternative.balances).toEqual(original.balances);
      expect(alternative.stockExchangeResult).toEqual(original.stockExchangeResult);
    }
    expect(original.balances.cash).toBeGreaterThanOrEqual(96_250);
    expect(original.balances.cash).toBeLessThanOrEqual(103_750);
  });
});
