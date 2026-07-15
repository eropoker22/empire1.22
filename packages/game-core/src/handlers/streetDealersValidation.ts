import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  isStreetDealerSlotLocked,
  isValidSlotId,
  resolveDrugConfigOrNull,
  resolveRequestedSlotId,
  resolveStreetDealerSlotDrug
} from "./streetDealersActionHelpers";
import { getStreetDealersPlayerMetadata } from "./streetDealersMetadata";
import { getOwnedStreetDealerCount, resolveStreetDealerSlotCount } from "./streetDealersNetwork";
export const validateStreetDealersAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  command: RunBuildingActionCommand;
  actionId: string;
  balances: Record<string, number>;
  config?: StreetDealersBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.actionId !== config.startDrugSale.actionId || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const ownedCount = getOwnedStreetDealerCount(input.state, input.player.id, config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, config);
  if (ownedCount <= 0 || slotCount <= 0) return "street_dealers_no_owned_dealers";

  const slotId = resolveRequestedSlotId(input.command.payload, slotCount);
  if (!slotId) return "street_dealers_missing_slot";
  if (!isValidSlotId(slotId, slotCount)) return "street_dealers_invalid_slot";

  const metadata = getStreetDealersPlayerMetadata(input.player);
  if (metadata.slots.some((candidate) => isStreetDealerSlotLocked(candidate, input.state.root.tick))) {
    return "street_dealers_sale_active";
  }
  const slot = metadata.slots.find((candidate) => candidate.slotId === slotId);
  if (isStreetDealerSlotLocked(slot, input.state.root.tick)) return "street_dealers_slot_locked";

  const drug = resolveStreetDealerSlotDrug(slotId, config);
  if (!drug) return "street_dealers_invalid_drug_item";
  const requestedDrug = input.command.payload.itemId === undefined
    ? drug
    : resolveDrugConfigOrNull(input.command.payload.itemId, config);
  if (!requestedDrug || requestedDrug.itemId !== drug.itemId) return "street_dealers_slot_product_mismatch";

  const amount = Number(input.command.payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) return "street_dealers_invalid_amount";
  if (amount < drug.minimumAmountPerSale) return "street_dealers_minimum_amount";
  if (Math.max(0, Number(input.balances[drug.itemId] || 0)) < amount) return "street_dealers_insufficient_drug_stock";
  return null;
};
