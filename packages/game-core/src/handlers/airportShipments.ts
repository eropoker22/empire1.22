import type { AirportBalanceConfig, ResolvedGameModeConfig } from "../contracts";
import { createReplacementValueResolver } from "../rules/economy/replacementValue";
import { deterministicUnitInterval } from "../utils/math";
import type { AirportImportCategory } from "./airportTypes";

const categoryItems: Record<AirportImportCategory, ReadonlyArray<readonly [string, number]>> = {
  materials: [["metal-parts", 0.45], ["chemicals", 0.3], ["biomass", 0.25]],
  rareComponents: [["tech-core", 0.75], ["combat-module", 0.25]],
  weapons: [["baseball-bat", 0.24], ["pistol", 0.28], ["grenade", 0.2], ["smg", 0.22], ["bazooka", 0.06]],
  defenseItems: [["vest", 0.28], ["barricades", 0.24], ["cameras", 0.22], ["alarm", 0.2], ["defense-tower", 0.06]]
};

/** Spend one bounded budget using complete recipe costs, never a free minimum per item. */
export const createImportShipment = (
  category: AirportImportCategory,
  config: AirportBalanceConfig,
  seed: string,
  gameConfig: ResolvedGameModeConfig
): Record<string, number> => {
  const range = config.expressImport.shipmentValueRanges[category];
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min < 0 || range.max < range.min) {
    throw new Error(`Invalid airport shipment budget for '${category}'.`);
  }
  let remaining = Math.floor(range.min + (range.max - range.min) * deterministicUnitInterval(`${seed}:value`));
  const values = createReplacementValueResolver(gameConfig);
  const items = categoryItems[category].map(([itemId, weight]) => {
    const cost = values.resolve(itemId);
    if (cost === null || cost <= 0) throw new Error(`Airport item '${itemId}' requires a positive replacement value.`);
    return { itemId, weight, cost };
  });
  const shipment: Record<string, number> = {};
  for (let draw = 0; ; draw += 1) {
    const available = items.filter((item) => item.cost <= remaining);
    if (!available.length) break;
    let roll = deterministicUnitInterval(`${seed}:item:${draw}`) * available.reduce((sum, item) => sum + item.weight, 0);
    const selected = available.find((item) => (roll -= item.weight) < 0) ?? available[available.length - 1];
    shipment[selected.itemId] = (shipment[selected.itemId] ?? 0) + 1;
    remaining -= selected.cost;
  }
  if (!Object.keys(shipment).length) throw new Error(`Airport budget cannot buy any '${category}' item.`);
  return shipment;
};

export const scaleShipment = (shipment: Record<string, number>, multiplier: number): Record<string, number> =>
  Object.fromEntries(Object.entries(shipment).map(([itemId, amount]) => [itemId, Math.max(0, Math.floor(Number(amount || 0) * multiplier))]));
