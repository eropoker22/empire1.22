import type { BuildingActionBalanceConfig } from "../contracts";
import { sanitizeNumber } from "./buildingActionReportNotification";

export const createEffectiveCasinoResult = (
  rawResult: Record<string, unknown> | undefined,
  action: BuildingActionBalanceConfig
): Record<string, unknown> | undefined => {
  if (!rawResult) return undefined;
  if (rawResult.type === "laundering") {
    const launderedDirtyCash = Math.max(0, Number(action.inputCost["dirty-cash"] || 0));
    const cleanCashGained = Math.max(0, Number(action.outputGain.cash || 0));
    return {
      ...rawResult,
      launderedDirtyCash,
      cleanCashGained,
      feePaid: Math.max(0, launderedDirtyCash - cleanCashGained),
      heatGain: sanitizeNumber(action.heatGain),
      influenceGain: sanitizeNumber(action.influenceChange)
    };
  }
  if (rawResult.type === "heat_control") {
    const heatGain = sanitizeNumber(action.heatGain);
    return {
      ...rawResult,
      costPaid: Math.max(0, Number(action.inputCost.cash || 0)),
      ...(heatGain < 0 ? { heatReduction: Math.abs(heatGain) } : { heatGain })
    };
  }
  return rawResult;
};

export const createEffectiveCasinoReportText = (
  result: Record<string, unknown>,
  fallback: string
): string => {
  if (result.type !== "laundering") return fallback;
  const launderedDirtyCash = Math.max(0, Number(result.launderedDirtyCash || 0));
  const cleanCashGained = Math.max(0, Number(result.cleanCashGained || 0));
  const feePaid = Math.max(0, Number(result.feePaid || 0));
  const heatGain = sanitizeNumber(result.heatGain);
  return `Tichá herna vyprala ${formatReportNumber(launderedDirtyCash)} dirty cash na ${formatReportNumber(cleanCashGained)} clean cash. Poplatek ${formatReportNumber(feePaid)}. Heat ${heatGain >= 0 ? "+" : ""}${formatReportNumber(heatGain)}.`;
};

export const createEffectiveExchangeOfficeResult = (
  rawResult: Record<string, unknown> | undefined,
  action: BuildingActionBalanceConfig
): Record<string, unknown> | undefined => {
  if (!rawResult) return undefined;
  const launderedDirtyCash = Math.max(0, Number(action.inputCost["dirty-cash"] || 0));
  const cleanCashGained = Math.max(0, Number(action.outputGain.cash || 0));
  return {
    ...rawResult,
    launderedDirtyCash,
    cleanCashGained,
    feePaid: Math.max(0, launderedDirtyCash - cleanCashGained),
    heatGain: sanitizeNumber(action.heatGain),
    influenceGain: sanitizeNumber(action.influenceChange)
  };
};

export const createEffectiveExchangeOfficeReportText = (
  result: Record<string, unknown>
): string => {
  const launderedDirtyCash = Math.max(0, Number(result.launderedDirtyCash || 0));
  const cleanCashGained = Math.max(0, Number(result.cleanCashGained || 0));
  const feePaid = Math.max(0, Number(result.feePaid || 0));
  const heatGain = sanitizeNumber(result.heatGain);
  return `Výhodný kurz vypral ${formatReportNumber(launderedDirtyCash)} dirty cash na ${formatReportNumber(cleanCashGained)} clean cash. Poplatek ${formatReportNumber(feePaid)}. Heat ${heatGain >= 0 ? "+" : ""}${formatReportNumber(heatGain)}.`;
};

export const createEffectiveStreetDealerResult = (
  rawResult: Record<string, unknown> | undefined,
  action: BuildingActionBalanceConfig
): Record<string, unknown> | undefined => {
  if (!rawResult) return undefined;
  const rewardDirtyCash = Math.max(0, Number(action.outputGain["dirty-cash"] || 0));
  const heatGain = sanitizeNumber(action.heatGain);
  return {
    ...rawResult,
    rewardDirtyCash,
    rewardPreviewDirtyCash: rewardDirtyCash,
    heatGain,
    heatPreview: heatGain
  };
};

export const createEffectiveStreetDealerPlayerMetadata = (
  playerMetadata: Record<string, unknown>,
  effectiveResult: Record<string, unknown> | undefined
): Record<string, unknown> => {
  if (!effectiveResult || !isRecord(playerMetadata.streetDealers)) return playerMetadata;
  const saleHistory = Array.isArray(playerMetadata.streetDealers.saleHistory)
    ? playerMetadata.streetDealers.saleHistory
    : [];
  if (saleHistory.length === 0) return playerMetadata;
  const lastEntry = saleHistory[saleHistory.length - 1];
  if (!isRecord(lastEntry)) return playerMetadata;
  return {
    ...playerMetadata,
    streetDealers: {
      ...playerMetadata.streetDealers,
      saleHistory: [
        ...saleHistory.slice(0, -1),
        {
          ...lastEntry,
          rewardDirtyCash: effectiveResult.rewardDirtyCash,
          heatGain: effectiveResult.heatGain,
          instant: true
        }
      ]
    }
  };
};

const formatReportNumber = (value: number): string => {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/u, "");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
