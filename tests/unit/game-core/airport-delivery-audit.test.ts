import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import type { CoreGameState } from "../../../packages/game-core/src/entities";
import { completeAirportImportsAndCustoms } from "../../../packages/game-core/src/handlers/airportCompletion";
import { getAirportMetadata } from "../../../packages/game-core/src/handlers/airportMetadata";
import type { PendingAirportImport } from "../../../packages/game-core/src/handlers/airportTypes";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const pending = (importId = "legacy-import:1", customsResolved = false): PendingAirportImport => ({
  importId, category: "materials", startedAtTick: 0, completesAtTick: 10, shipment: { chemicals: 40 }, customsResolved
});
const setup = (imports = [pending()], chemicals = 0) => {
  const fixture = createCoreStateWithFixedBuildingFixture("airport", { playerBalances: { cash: 1000, chemicals } });
  fixture.state.root.tick = 10;
  fixture.building.metadata = { airport: { pendingImports: imports, customsEvents: [], lastCustomsInspectionTick: 10 } };
  return fixture;
};
const settle = (state: CoreGameState, customsRiskPct = 0) => completeAirportImportsAndCustoms(state, {
  ...config.balance.airport!, expressImport: { ...config.balance.airport!.expressImport, customsRiskPct }
}, config.balance.warehouse, config.balance.smugglingTunnel, config.tickRateMs, config.balance.lobbyClub);

describe("persisted airport delivery audit", () => {
  it("keeps overdue paid cargo visible and delivers it exactly once after recovery", () => {
    const { state, building } = setup();
    state.root.tick = 12;
    expect(getAirportMetadata(building, state.root.tick).pendingImports).toHaveLength(1);
    const result = settle(state);
    expect(result.resourceStatesById["resource:1"].balances.chemicals).toBe(40);
    expect(getAirportMetadata(result.buildingsById[building.id], 12).pendingImports).toEqual([]);
    expect(settle(result).resourceStatesById["resource:1"].balances.chemicals).toBe(40);
  });

  it("retains cargo while an airport is inactive and settles it after reactivation", () => {
    const { state, building } = setup();
    building.status = "disabled";
    const paused = settle(state);
    expect(paused.resourceStatesById["resource:1"].balances.chemicals).toBe(0);
    paused.root.tick = 12;
    paused.buildingsById[building.id].status = "active";
    expect(settle(paused).resourceStatesById["resource:1"].balances.chemicals).toBe(40);
  });

  it("honors a persisted successful customs check even when the current risk is 100%", () => {
    const { state, building } = setup([pending("already-cleared", true)]);
    const result = settle(state, 100);
    expect(result.resourceStatesById["resource:1"].balances.chemicals).toBe(40);
    expect(getAirportMetadata(result.buildingsById[building.id], 10).customsEvents).toEqual([]);
    expect(result.districtsById["district:1"].heat).toBe(0);
  });

  it.each([50, 60])("preserves one customs result and the complete receipt across full-storage retries (stock: %s)", stock => {
    const { state, building } = setup([pending()], stock);
    const first = settle(state, 100);
    const firstMetadata = getAirportMetadata(first.buildingsById[building.id], 10);
    expect(firstMetadata.pendingImports[0].shipment.chemicals).toBe(stock - 30);
    expect(firstMetadata.lastImportShipment?.lostItems).toEqual({ chemicals: 10 });
    expect(firstMetadata.customsEvents).toHaveLength(1);
    first.root.tick = 11;
    const retried = settle(first, 100);
    const retriedMetadata = getAirportMetadata(retried.buildingsById[building.id], 11);
    expect(retriedMetadata.pendingImports[0].shipment).toEqual(firstMetadata.pendingImports[0].shipment);
    expect(retriedMetadata.customsEvents).toHaveLength(1);
    expect(retried.districtsById["district:1"].heat).toBe(first.districtsById["district:1"].heat);
    // The player frees storage; the remaining cargo is then delivered once.
    retried.root.tick = 12;
    retried.resourceStatesById["resource:1"].balances.chemicals = 20;
    const finished = settle(retried, 100);
    const receipt = getAirportMetadata(finished.buildingsById[building.id], 12);
    expect(receipt.pendingImports).toEqual([]);
    expect(receipt.customsEvents).toHaveLength(1);
    expect(receipt.lastImportShipment).toMatchObject({
      requestedItems: { chemicals: 40 }, acceptedItems: { chemicals: 30 }, lostItems: { chemicals: 10 }, customsTriggered: true
    });
    expect(finished.resourceStatesById["resource:1"].balances.chemicals).toBe(stock - 10);
    expect(settle(finished).resourceStatesById["resource:1"].balances).toEqual(finished.resourceStatesById["resource:1"].balances);
  });

  it("retains the customs history of every import settled in the same tick", () => {
    const { state, building } = setup([pending("first"), pending("second")]);
    const result = settle(state, 100);
    const metadata = getAirportMetadata(result.buildingsById[building.id], 10);
    expect(result.resourceStatesById["resource:1"].balances.chemicals).toBe(60);
    expect(metadata.pendingImports).toEqual([]);
    expect(metadata.customsEvents).toHaveLength(2);
    expect(metadata.lastImportShipment?.lostItems).toEqual({ chemicals: 10 });
  });

  it("records a fully confiscated item without creating an empty perpetual delivery", () => {
    const { state, building } = setup([{ ...pending(), category: "weapons", shipment: { pistol: 1 } }]);
    const result = settle(state, 100);
    const metadata = getAirportMetadata(result.buildingsById[building.id], 10);
    expect(metadata.pendingImports).toEqual([]);
    expect(metadata.lastImportShipment).toMatchObject({
      requestedItems: { pistol: 1 }, acceptedItems: {}, lostItems: { pistol: 1 }, customsTriggered: true
    });
    expect(Number(result.resourceStatesById["resource:1"].balances.pistol || 0)).toBe(0);
  });
});
