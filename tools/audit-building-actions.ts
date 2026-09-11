import { promises as fs } from "node:fs";
import { resolveModeConfig, getAllPublicBuildingDefinitions } from "@empire/game-config";
import { createReplacementValueResolver } from "../packages/game-core/src/rules/economy/replacementValue";
import { createImportShipment, scaleShipment } from "../packages/game-core/src/handlers/airportShipments";
import { resolveEffectiveBuildingActionPreview } from "../packages/game-core/src/rules/buildings/buildingActionCosts";
import { createCoreStateWithFixedBuildingFixture } from "../tests/fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const values = createReplacementValueResolver(config);
const actions = Object.values(config.balance.buildingActions!);
const definitions = getAllPublicBuildingDefinitions();
const path = "docs/audits/building-action-balance-numbers-2026-09-11.json";
const cashCollections = ["restaurant_collect_revenue", "strip_club_collect_cash", "port_container_cut", "parliament_policy_window", "power_station_feed_production"].map(actionId => {
  const action = config.balance.buildingActions![actionId];
  const cashEquivalent = Object.entries(action.outputGain).reduce((sum, [key, amount]) => sum + amount * (key === "cash" ? 1 : key === "dirty-cash" ? 0.7 : values.resolve(key) ?? 0), 0);
  const cooldownMinutes = action.cooldownMs / 60_000 * config.balance.cooldownMultiplier;
  return { actionId, baseReward: action.outputGain, cooldownMinutesBeforeOtherBonuses: cooldownMinutes, cleanEquivalentPerUse: cashEquivalent, cleanEquivalentPerEligibleHour: cashEquivalent * 60 / cooldownMinutes, heatPerEligibleHour: action.heatGain * 60 / cooldownMinutes };
});
const airport = config.balance.airport!;
const shipmentValue = (shipment: Record<string, number>) => Object.entries(shipment).reduce((sum, [key, count]) => sum + values.resolve(key)! * count, 0);
const airportSamples = (["materials", "rareComponents", "weapons", "defenseItems"] as const).map(category => {
  const full: number[] = [], customs: number[] = [];
  for (let seed = 0; seed < 1000; seed++) {
    const shipment = createImportShipment(category, airport, `audit:${seed}`, config);
    full.push(shipmentValue(shipment));
    customs.push(shipmentValue(scaleShipment(shipment, 1 - airport.expressImport.customsShipmentPenaltyPct / 100)));
  }
  const average = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const risk = airport.expressImport.customsRiskPct / 100;
  return { category, samples: full.length, minFullValue: Math.min(...full), maxFullValue: Math.max(...full), meanFullValue: average(full), meanCustomsValue: average(customs), expectedValueIncludingCustoms: average(full) * (1 - risk) + average(customs) * risk, price: airport.expressImport.costCleanCash };
});
const drugSales = config.balance.streetDealers!.sellableDrugs.map(drug => {
  const cost = values.resolve(drug.itemId)!;
  return { itemId: drug.itemId, completeCostClean: cost, priceDirty: drug.unitSalePriceDirtyCash, grossMarginAfter15PctLaundering: drug.unitSalePriceDirtyCash * 0.85 - cost, heatPerUnit: drug.baseHeatPerUnit, riskPctAtMinimumBeforeBonuses: Math.min(config.balance.streetDealers!.streetIncidents.maxStreetRiskPct, drug.baseStreetRiskPct + drug.minimumAmountPerSale), minimumBatch: drug.minimumAmountPerSale };
});
const spec = config.balance.stockExchange!.speculativeBuy;
const speculateEv = (insider: boolean) => {
  const success = Math.min(95, spec.successChancePct + (insider ? spec.insiderSuccessChanceBonusPct : 0));
  const neutral = Math.min(spec.neutralChancePct, 100 - success);
  const meanReturn = (success * (spec.successProfitMinPct + spec.successProfitMaxPct) / 2 + neutral * (spec.neutralReturnMinPct + spec.neutralReturnMaxPct) / 2 + (100 - success - neutral) * (spec.lossReturnMinPct + spec.lossReturnMaxPct) / 2) / 10000;
  return spec.maxInvestmentCleanCash * meanReturn - spec.costCleanCash;
};
const inventory = actions.map(action => {
  const { state } = createCoreStateWithFixedBuildingFixture(action.buildingType);
  const phases = (["day", "night"] as const).map(phase => {
    state.root.tick = phase === "day" ? 0 : config.balance.dayNight!.phases.day.durationTicks;
    const preview = resolveEffectiveBuildingActionPreview({ action, state, context: { config }, buildingTypeId: action.buildingType });
    return { phase, availability: preview.phaseAvailability, blockedReason: preview.blockedReason, effectiveInputCost: preview.effectiveInputCost, effectiveOutputGain: preview.effectiveOutputGain, effectiveHeatGain: preview.effectiveHeatGain, durationMinutes: preview.effectiveDurationMs / 60_000, cooldownMinutesBeforeNetworkBonuses: preview.effectiveCooldownMs / 60_000 * config.balance.cooldownMultiplier };
  });
  return { ...action, phases };
});
const supportingKeys = ["arcade", "casino", "exchangeOffice", "restaurant", "stripClub", "smugglingTunnel", "streetDealers", "powerStation", "school", "clinic", "recyclingCenter", "lobbyClub", "cityHall", "centralBank", "stockExchange", "airport", "port", "parliament"] as const;
const result = {
  baselineCommit: "ca7f6069bbe3cecfc3e3418b5e9428928de7ed39",
  methodology: "Deterministic configuration and shipment samples, not human match outcomes. Dirty cash = 0.7 clean is a comparison assumption, not an exchange rate. Eligible-hour rates exclude phase availability, faction/network bonuses, capacity, acquisition costs and police losses. Dynamic action inputs/rewards override empty catalog fields. InfluenceChange belongs to the district.",
  tickRateMs: config.tickRateMs,
  cooldownMultiplier: config.balance.cooldownMultiplier,
  buildingTypes: definitions.map(b => ({ id: b.buildingTypeId, name: b.label, actions: actions.filter(a => a.buildingType === b.buildingTypeId).map(a => a.actionId) })),
  actions: inventory,
  supportingConfig: Object.fromEntries(supportingKeys.map(key => [key, config.balance[key]])),
  cashCollections, drugSales, airportSamples,
  speculation: { maxInvestment: spec.maxInvestmentCleanCash, baseExpectedNetBeforeRisk: speculateEv(false), insiderExpectedNetBeforeWindowCostAndRisk: speculateEv(true), windowCost: config.balance.stockExchange!.insiderWindow.costCleanCash }
};
await fs.writeFile(path, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ path, buildings: definitions.length, actions: actions.length, cashCollections, drugSales, airportSamples, speculation: result.speculation }, null, 2));
