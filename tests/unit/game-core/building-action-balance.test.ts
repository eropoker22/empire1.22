import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { createReplacementValueResolver } from "../../../packages/game-core/src/rules/economy/replacementValue";
import { createImportShipment, scaleShipment } from "../../../packages/game-core/src/handlers/airportShipments";
import { resolveSaleCompletion } from "../../../packages/game-core/src/handlers/streetDealersSaleOutcomes";
import { deterministicUnitInterval } from "../../../packages/game-core/src/utils/math";
import { buyResource, getBlackMarketRotation } from "../../../packages/game-core/src/rules/market/serverMarketSystem";
import { resolveAirportCharter } from "../../../packages/game-core/src/rules/market/airportCharter";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { validateStreetDealersConfig } from "../../../packages/game-config/src/validation/validate-street-dealers-config";

const config = resolveModeConfig("free");
const values = createReplacementValueResolver(config);

describe("building action reward and risk invariants", () => {
  it.each(["materials", "rareComponents", "weapons", "defenseItems"] as const)("keeps %s imports within a full production-value budget across seeds", category => {
    const airport = config.balance.airport!;
    for (let seed = 0; seed < 200; seed++) {
      const shipment = createImportShipment(category, airport, `budget:${seed}`, config);
      const value = Object.entries(shipment).reduce((sum, [id, amount]) => sum + values.resolve(id)! * amount, 0);
      expect(value).toBeGreaterThanOrEqual(airport.expressImport.costCleanCash);
      expect(value).toBeLessThanOrEqual(airport.expressImport.shipmentValueRanges[category].max);
      expect(Object.values(shipment).every(amount => Number.isInteger(amount) && amount > 0)).toBe(true);
      const confiscated = scaleShipment(shipment, 0.75);
      for (const [id, count] of Object.entries(confiscated)) expect(count).toBeLessThanOrEqual(shipment[id]);
    }
  });

  it("does not manufacture an expensive item when the import budget cannot pay for one", () => {
    const modified = structuredClone(config.balance.airport!);
    modified.expressImport.shipmentValueRanges.rareComponents = { min: 100, max: 100 };
    expect(() => createImportShipment("rareComponents", modified, "small", config)).toThrow("cannot buy");
  });

  it("rejects dealer prices when a material cost changes without repricing the complete chain", () => {
    const modified = structuredClone(config);
    modified.balance.pharmacy!.recipes.chemicals.cleanCashCostPerUnit += 100;
    expect(() => validateStreetDealersConfig(modified)).toThrow("complete production chain");
  });

  it("uses the quoted dealer risk exactly once with an open channel", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("street_dealers");
    state.playersById["player:1"].metadata = { smugglingTunnel: { openChannelExpiresAtTick: 1000 } };
    let incidents = 0;
    for (let index = 0; index < 200; index++) {
      state.serverInstance.worldSeed = `risk:${index}`;
      const slot = { slotId: "slot-1", saleId: "sale", startedAtTick: 0, rewardDirtyCash: 1000, heatGain: 10, streetRiskPct: 10 };
      const expected = deterministicUnitInterval(`${state.serverInstance.worldSeed}:street_dealers:player:1:sale:0:trigger`) < 0.1;
      const result = resolveSaleCompletion({ state, playerId: "player:1", slot, config: config.balance.streetDealers!, smugglingTunnelConfig: config.balance.smugglingTunnel!, tickRateMs: config.tickRateMs });
      expect(Boolean(result.incident)).toBe(expected);
      if (result.incident) incidents++;
    }
    expect(incidents).toBeGreaterThan(0);
    expect(incidents).toBeLessThan(200);
  });

  it("applies charter discounts at purchase, charges customs heat and expires the discount", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("airport", { playerBalances: { cash: 100_000, "dirty-cash": 100_000, "tech-core": 0 } });
    const customConfig = structuredClone(config);
    customConfig.balance.airport!.blackCharter.purchaseCustomsRiskPct = 100;
    const state = { ...fixture.state, config: customConfig };
    state.buildingsById[fixture.building.id].metadata = { airport: { blackCharterExpiresAtTick: 100 } };
    const baseline = structuredClone(state);
    baseline.buildingsById[fixture.building.id].metadata = {};
    let marketTime = 1000;
    while (!getBlackMarketRotation(state, marketTime).includes("tech-core")) marketTime += 60_000;
    const buy = (s: typeof state) => buyResource(s, s.playersById["player:1"], "tech-core", 1, "black", "cleanCash", marketTime);
    const regular = buy(baseline);
    const charter = buy(state);
    expect(regular.success).toBe(true);
    expect(charter.success).toBe(true);
    expect(charter.totalPrice).toBeLessThan(regular.totalPrice!);
    expect(charter.shoppingMallDiscountPct! - regular.shoppingMallDiscountPct!).toBe(6);
    expect(charter.heatAdded! - regular.heatAdded!).toBe(10);
    expect(charter.nextState!.resourceStatesById["resource:1"].balances.cash).toBe(100_000 - charter.totalPrice!);
    expect(charter.nextState!.resourceStatesById["resource:1"].balances["tech-core"]).toBe(1);
    expect(charter.message).toContain("Celní kontrola");
    state.root.tick = 100;
    expect(resolveAirportCharter(state, "player:1", "tech-core").active).toBe(false);
    expect(buy(state).totalPrice).toBe(regular.totalPrice);
    state.root.tick = 0;
    expect(resolveAirportCharter(state, "player:2", "tech-core").active).toBe(false);
    expect(resolveAirportCharter(state, "player:1", "neon-dust").active).toBe(false);
    state.buildingsById[fixture.building.id].metadata = { airport: { blackCharterExpiresAtTick: 100, discountDisabledUntilTick: 50 } };
    expect(resolveAirportCharter(state, "player:1", "tech-core").active).toBe(false);
  });
});
