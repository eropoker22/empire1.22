import type {
  PlayerBoostCategory,
  PlayerBoostConsumptionMode,
  PlayerBoostEffectSnapshot,
  PlayerBoostId
} from "@empire/shared-types";

export interface PlayerBoostDefinition {
  boostId: PlayerBoostId;
  label: string;
  category: PlayerBoostCategory;
  description: string;
  shortEffect: string;
  cleanCashCost: number;
  inputCosts: Record<string, number>;
  activeDurationTicks: number;
  cooldownTicks: number;
  consumptionMode: PlayerBoostConsumptionMode;
  effect: PlayerBoostEffectSnapshot;
  uiAccent: "cyan" | "amber" | "red";
  iconKey: string;
}

export type PlayerBoostBalanceConfig = Record<PlayerBoostId, PlayerBoostDefinition>;
