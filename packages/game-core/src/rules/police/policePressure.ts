import type { DistrictId, PoliceRiskTier } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolvePoliceConfig } from "./policeConfig";

export interface PlayerPolicePressure {
  playerId: string;
  playerHeatPressure: number;
  districtHeatPressure: number;
  aggregatePressure: number;
  hottestDistrictId: DistrictId | null;
  hottestDistrictHeat: number;
  riskTier: PoliceRiskTier;
  highPressureRaidThreshold: number;
  extremePressureRaidThreshold: number;
}

export const calculatePlayerPolicePressure = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): PlayerPolicePressure => {
  const config = resolvePoliceConfig(context);
  const player = state.playersById[playerId] ?? null;
  const policeState = player?.policeStateId
    ? state.policeStatesById[player.policeStateId] ?? null
    : Object.values(state.policeStatesById).find((entry) => entry.ownerPlayerId === playerId) ?? null;
  const playerHeat = sanitizeHeat(policeState?.heat);
  const playerHeatPressure = Math.floor(playerHeat * getPolicePressureMultiplier(context));
  const ownedDistricts = Object.values(state.districtsById).filter((district) => district.ownerPlayerId === playerId);
  const districtHeatPressure = ownedDistricts.reduce((total, district) => total + sanitizeHeat(district.heat), 0);
  const hottestDistrict = ownedDistricts.reduce<CoreGameState["districtsById"][string] | null>(
    (current, district) => sanitizeHeat(district.heat) > sanitizeHeat(current?.heat) ? district : current,
    null
  );
  const aggregatePressure = Math.floor(
    playerHeatPressure + districtHeatPressure * Math.max(0, Number(config.districtHeatWeight || 0))
  );

  return {
    playerId,
    playerHeatPressure,
    districtHeatPressure,
    aggregatePressure,
    hottestDistrictId: hottestDistrict?.id ?? null,
    hottestDistrictHeat: sanitizeHeat(hottestDistrict?.heat),
    riskTier: resolveRiskTier(aggregatePressure, config),
    highPressureRaidThreshold: Math.max(1, Number(config.highPressureRaidThreshold || 1)),
    extremePressureRaidThreshold: Math.max(1, Number(config.extremePressureRaidThreshold || 1))
  };
};

export const resolveRiskTier = (
  aggregatePressure: number,
  config = resolvePoliceConfig()
): PoliceRiskTier => {
  const pressure = Math.max(0, Number(aggregatePressure || 0));
  const mediumThreshold = Math.max(1, Number(config.raidSeverityThresholds.medium || 1));
  const highThreshold = Math.max(mediumThreshold, Number(config.highPressureRaidThreshold || 1));
  const extremeThreshold = Math.max(highThreshold, Number(config.extremePressureRaidThreshold || highThreshold));
  if (pressure >= extremeThreshold) return "extreme";
  if (pressure >= highThreshold) return "high";
  if (pressure >= mediumThreshold) return "medium";
  return "low";
};

const getPolicePressureMultiplier = (context?: GameCoreContext): number =>
  Math.max(0, Number(context?.config.balance.policePressureMultiplier ?? 1));

const sanitizeHeat = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};
