import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { StreetDealerDrugSaleConfig, StreetDealersBalanceConfig } from "../contracts";
import type { StreetDealerSaleSlot } from "./streetDealersTypes";
export const resolveRequestedSlotId = (
  payload: RunBuildingActionCommand["payload"],
  slotCount: number
): string => {
  const requested = String(payload.dealerSlotId || payload.slotId || "").trim();
  if (!requested && slotCount > 0) return "slot-1";
  return requested;
};

export const resolveDrugConfig = (
  itemId: unknown,
  config: StreetDealersBalanceConfig
): StreetDealerDrugSaleConfig => {
  const drug = resolveDrugConfigOrNull(itemId, config);
  if (!drug) {
    throw new Error(`Unsupported street dealer drug item: ${String(itemId ?? "").trim()}`);
  }
  return drug;
};

export const resolveDrugConfigOrNull = (
  itemId: unknown,
  config: StreetDealersBalanceConfig
): StreetDealerDrugSaleConfig | null => {
  const requested = String(itemId ?? "").trim();
  const drug = config.sellableDrugs.find((candidate) =>
    candidate.itemId === requested || (candidate.aliases ?? []).includes(requested)
  );
  return drug ?? null;
};

export const isValidSlotId = (slotId: string, slotCount: number): boolean => {
  const match = /^slot-(\d+)$/.exec(slotId);
  if (!match) return false;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 1 && index <= slotCount;
};

export const resolveStreetRiskPct = (
  amount: number,
  drug: StreetDealerDrugSaleConfig,
  config: StreetDealersBalanceConfig,
  streetRiskReductionPct = 0
): number =>
  Math.min(
    config.streetIncidents.maxStreetRiskPct,
    (drug.baseStreetRiskPct + Math.max(0, amount)) * (1 - Math.max(0, streetRiskReductionPct) / 100)
  );

export const isStreetDealerSlotLocked = (
  slot: StreetDealerSaleSlot | undefined,
  tick: number
): boolean =>
  Boolean(slot?.saleId) || Number(slot?.cooldownUntilTick || 0) > tick;

export const upsertSlot = (
  slots: StreetDealerSaleSlot[],
  nextSlot: StreetDealerSaleSlot
): StreetDealerSaleSlot[] => [
  ...slots.filter((slot) => slot.slotId !== nextSlot.slotId),
  nextSlot
].sort((left, right) => left.slotId.localeCompare(right.slotId));

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

