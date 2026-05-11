import type { AirportBalanceConfig } from "../contracts";
import { deterministicUnitInterval } from "../utils/math";
import type { AirportImportCategory } from "./airportTypes";
export const createImportShipment = (
  category: AirportImportCategory,
  config: AirportBalanceConfig,
  seed: string
): Record<string, number> => {
  const range = config.expressImport.shipmentValueRanges[category] ?? { min: 1200, max: 2000 };
  const value = Math.floor(interpolate(range.min, range.max, deterministicUnitInterval(`${seed}:value`)));
  if (category === "materials") {
    return splitValueIntoItems(value, [
      { itemId: "metal-parts", unitValue: 18, weight: 0.45 },
      { itemId: "chemicals", unitValue: 28, weight: 0.3 },
      { itemId: "biomass", unitValue: 16, weight: 0.25 }
    ]);
  }
  if (category === "rareComponents") {
    return splitValueIntoItems(value, [
      { itemId: "tech-core", unitValue: 85, weight: 0.75 },
      { itemId: "combat-module", unitValue: 160, weight: 0.25 }
    ]);
  }
  if (category === "weapons") {
    return splitValueIntoItems(value, [
      { itemId: "baseball-bat", unitValue: 90, weight: 0.24 },
      { itemId: "pistol", unitValue: 180, weight: 0.28 },
      { itemId: "grenade", unitValue: 220, weight: 0.2 },
      { itemId: "smg", unitValue: 420, weight: 0.22 },
      { itemId: "bazooka", unitValue: 900, weight: 0.06 }
    ]);
  }
  return splitValueIntoItems(value, [
    { itemId: "vest", unitValue: 160, weight: 0.28 },
    { itemId: "barricades", unitValue: 140, weight: 0.24 },
    { itemId: "cameras", unitValue: 260, weight: 0.22 },
    { itemId: "alarm", unitValue: 220, weight: 0.2 },
    { itemId: "defense-tower", unitValue: 800, weight: 0.06 }
  ]);
};

const splitValueIntoItems = (
  value: number,
  items: Array<{ itemId: string; unitValue: number; weight: number }>
): Record<string, number> =>
  Object.fromEntries(items.map((item) => [
    item.itemId,
    Math.max(1, Math.floor(value * item.weight / Math.max(1, item.unitValue)))
  ]));

export const scaleShipment = (shipment: Record<string, number>, multiplier: number): Record<string, number> =>
  Object.fromEntries(Object.entries(shipment).map(([itemId, amount]) => [itemId, Math.max(0, Math.floor(Number(amount || 0) * multiplier))]));

const interpolate = (min: number, max: number, unit: number): number =>
  min + (max - min) * Math.max(0, Math.min(1, unit));
