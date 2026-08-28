import type { AirportBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { withAirportMetadata } from "./airportMetadata";
import { createImportShipment, scaleShipment } from "./airportShipments";
import type { AirportActionResolution, AirportImportCategory, AirportMetadata } from "./airportTypes";

export const resolveInstantAirportImport = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  balances: Record<string, number>;
  config: AirportBalanceConfig;
  commandId: string;
  category: AirportImportCategory;
  metadata: AirportMetadata;
}): AirportActionResolution => {
  const penaltyPct = Math.max(0, Number(input.metadata.nextImportCostPenaltyPct || 0));
  const cost = Math.ceil(input.config.expressImport.costCleanCash * (1 + penaltyPct / 100));
  const importId = `airport-import:${input.commandId}`;
  const requestedShipment = createImportShipment(input.category, input.config, `${input.commandId}:${input.state.root.tick}`);
  const customsTriggered = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:${importId}:customs`)
    < input.config.expressImport.customsRiskPct / 100;
  const shipment = customsTriggered
    ? scaleShipment(requestedShipment, 1 - input.config.expressImport.customsShipmentPenaltyPct / 100)
    : requestedShipment;
  const lostItems = Object.fromEntries(Object.entries(requestedShipment)
    .map(([resourceKey, requested]) => [resourceKey, Math.max(0, requested - Number(shipment[resourceKey] || 0))] as const)
    .filter(([, amount]) => amount > 0));
  const nextBalances: Record<string, number> = {
    ...input.balances,
    cash: Math.max(0, Number(input.balances.cash || 0) - cost)
  };
  for (const [resourceKey, amount] of Object.entries(shipment)) {
    nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
  }
  const nextMetadata: AirportMetadata = {
    ...input.metadata,
    nextImportCostPenaltyPct: 0,
    lastImportShipment: {
      tick: input.state.root.tick,
      category: input.category,
      requestedItems: requestedShipment,
      acceptedItems: shipment,
      lostItems,
      customsTriggered
    },
    customsEvents: customsTriggered
      ? [...input.metadata.customsEvents, {
          type: "express_import_customs_check",
          tick: input.state.root.tick,
          label: "Celní kontrola",
          riskPct: input.config.expressImport.customsRiskPct
        }].slice(-10)
      : input.metadata.customsEvents
  };
  return {
    balances: nextBalances,
    buildingMetadata: withAirportMetadata(input.building, nextMetadata),
    heatGain: input.config.expressImport.heatGain
      + (customsTriggered ? input.config.expressImport.customsHeatGain : 0),
    influenceChange: 0,
    inputCost: { cash: cost },
    outputGain: shipment,
    reportText: `Expresní dovoz (${input.category}) byl okamžitě uložen do SKLADU${customsTriggered ? " po celní kontrole" : ""}.`,
    airportResult: {
      type: "express_import_completed",
      category: input.category,
      importId,
      costCleanCash: cost,
      nextImportCostPenaltyAppliedPct: penaltyPct,
      customsRiskPct: input.config.expressImport.customsRiskPct,
      customsTriggered,
      shipment,
      lostItems,
      instant: true
    }
  };
};
