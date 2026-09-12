import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { createFinanceBuildingStats } from "../../../packages/game-core/src/projections/district-building-finance-stats";

const config = resolveModeConfig("free");
const statsFor = (type: string, metadata: Record<string, unknown> = {}, tickRateMs = 5000) => {
  const { state, building } = createCoreStateWithFixedBuildingFixture(type, { buildingOverrides: { metadata } });
  return createFinanceBuildingStats({ state, building, district: state.districtsById[building.districtId], playerId: "player:1", playerBalances: {}, definition: undefined,
    tick: 0, tickRateMs, shoppingMallConfig: config.balance.shoppingMall, stockExchangeConfig: config.balance.stockExchange,
    centralBankConfig: config.balance.centralBank, airportConfig: config.balance.airport })!;
};

describe("financial building presentation audit", () => {
  it.each([1000, 5000, 10000])("formats airport durations with the actual %s ms tick rate", tickRate => {
    const stats = statsFor("airport", { airport: { blackCharterExpiresAtTick: 60_000 / tickRate } }, tickRate);
    expect(stats.find(row => row.label === "Černý charter")?.value).toContain("1m 00s");
  });

  it("labels the maximum bank interest per interest interval, not per server tick", () => {
    const stats = statsFor("central_bank");
    const interval = config.balance.centralBank!.reserveTiers[0].interestIntervalMinutes;
    expect(stats.find(row => row.label.startsWith("Max úrok"))?.label).toBe(`Max úrok / ${interval} min`);
  });

  it.each(["shopping_mall", "stock_exchange", "central_bank"])("does not promise discounts on nonexistent %s trading commissions", type => {
    const stats = statsFor(type);
    expect(stats.filter(row => /poplatek/i.test(row.label))).toEqual([{ label: "Market poplatek", value: "0 %" }]);
  });

});
