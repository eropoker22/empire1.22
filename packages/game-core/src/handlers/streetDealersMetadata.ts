import type { CoreGameState } from "../entities";
import type { StreetDealersPlayerMetadata, StreetDealerSaleSlot } from "./streetDealersTypes";
export const getStreetDealersPlayerMetadata = (
  player: CoreGameState["playersById"][string]
): StreetDealersPlayerMetadata => {
  const raw = isRecord(player.metadata?.streetDealers) ? player.metadata.streetDealers : {};
  return {
    slots: Array.isArray(raw.slots) ? raw.slots.map(readSlot).filter((slot): slot is StreetDealerSaleSlot => Boolean(slot)) : [],
    saleHistory: Array.isArray(raw.saleHistory) ? raw.saleHistory.filter(isRecord).slice(-20) : []
  };
};

export const withStreetDealersPlayerMetadata = (
  player: CoreGameState["playersById"][string],
  streetDealers: StreetDealersPlayerMetadata
): Record<string, unknown> => ({
  ...(player.metadata ?? {}),
  streetDealers
});

const readSlot = (value: unknown): StreetDealerSaleSlot | null => {
  if (!isRecord(value)) return null;
  const slotId = String(value.slotId || "").trim();
  if (!slotId) return null;
  return {
    slotId,
    saleId: optionalString(value.saleId),
    itemId: optionalString(value.itemId),
    itemLabel: optionalString(value.itemLabel),
    amount: optionalNumber(value.amount),
    startedAtTick: optionalTick(value.startedAtTick),
    completesAtTick: optionalTick(value.completesAtTick),
    rewardDirtyCash: optionalNumber(value.rewardDirtyCash),
    heatGain: optionalNumber(value.heatGain),
    streetRiskPct: optionalNumber(value.streetRiskPct),
    originDistrictId: optionalString(value.originDistrictId),
    originBuildingId: optionalString(value.originBuildingId),
    cooldownUntilTick: optionalTick(value.cooldownUntilTick)
  };
};

const optionalString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : undefined;
};

const optionalTick = (value: unknown): number | undefined => {
  const amount = optionalNumber(value);
  return amount === undefined ? undefined : Math.floor(amount);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
