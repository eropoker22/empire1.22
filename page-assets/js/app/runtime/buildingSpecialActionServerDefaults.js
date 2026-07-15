import { formatDistrictBuildingMoney } from "./formatters.js";
import { STREET_DEALERS_CONFIG } from "../../../../packages/game-config/src/legacy-page/economy-config.js";

const DEFAULT_CATEGORY = "materials";
const DEFAULT_PRESSURE_MODE = "pump";
const DEFAULT_DECREE_MODE = "suspended_checks";
const DEFAULT_SPECULATIVE_INVESTMENT_CLEAN_CASH = 1000;
const DEFAULT_DEALER_SLOT = STREET_DEALERS_CONFIG.dealerSlots[0] || null;
const DEFAULT_DEALER_DRUG = STREET_DEALERS_CONFIG.sellableDrugs.find((drug) => drug.itemId === DEFAULT_DEALER_SLOT?.itemId) || null;

export function createServerBuildingActionDefaultPayload(actionId = "", actionProfile = {}) {
  const payload = {};

  switch (String(actionId || "")) {
    case "speculative_buy":
      payload.category = DEFAULT_CATEGORY;
      payload.targetCategory = DEFAULT_CATEGORY;
      payload.investmentCleanCash = Math.max(1, Math.min(
        Math.floor(Number(actionProfile.maxInvestmentCleanCash || DEFAULT_SPECULATIVE_INVESTMENT_CLEAN_CASH)),
        DEFAULT_SPECULATIVE_INVESTMENT_CLEAN_CASH
      ));
      break;
    case "market_pressure":
      payload.category = DEFAULT_CATEGORY;
      payload.targetCategory = DEFAULT_CATEGORY;
      payload.mode = DEFAULT_PRESSURE_MODE;
      break;
    case "currency_intervention":
    case "express_import":
      payload.category = DEFAULT_CATEGORY;
      payload.targetCategory = DEFAULT_CATEGORY;
      break;
    case "emergency_decree":
      payload.mode = DEFAULT_DECREE_MODE;
      break;
    case "start_drug_sale":
      payload.dealerSlotId = DEFAULT_DEALER_SLOT?.slotId || "";
      payload.slotId = DEFAULT_DEALER_SLOT?.slotId || "";
      payload.itemId = DEFAULT_DEALER_DRUG?.itemId || "";
      payload.amount = Number(DEFAULT_DEALER_DRUG?.minimumAmountPerSale || 1);
      break;
    default:
      break;
  }

  return payload;
}

export function formatServerBuildingActionDefaultInputSummary(actionId = "", actionProfile = {}) {
  const payload = createServerBuildingActionDefaultPayload(actionId, actionProfile);
  const parts = [];

  if (payload.targetCategory || payload.category) {
    parts.push(`Kategorie: ${payload.targetCategory || payload.category}`);
  }
  if (payload.mode) {
    parts.push(`Režim: ${payload.mode}`);
  }
  if (Number(payload.investmentCleanCash || 0) > 0) {
    parts.push(`Investice: ${formatDistrictBuildingMoney(payload.investmentCleanCash)} clean cash`);
  }
  if (payload.itemId) {
    parts.push(`Produkt: ${payload.itemId}`);
  }
  if (Number(payload.amount || 0) > 0) {
    parts.push(`Množství: ${payload.amount}`);
  }

  return parts.join(" · ");
}
