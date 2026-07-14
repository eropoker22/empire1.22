import type {
  PlayerBoostActiveStatus,
  PlayerBoostCategory,
  PlayerBoostId
} from "../entities/player-boost-state";

export interface PlayerBoostCostView {
  resourceKey: string;
  label: string;
  required: number;
  stored: number;
  enough: boolean;
  missingAmount: number;
}

export interface ActivePlayerBoostView {
  boostId: PlayerBoostId;
  label: string;
  category: PlayerBoostCategory;
  status: PlayerBoostActiveStatus;
  activatedAtMs: number;
  expiresAtMs: number;
  remainingMs: number;
  effectSummary: string;
  uiAccent: "cyan" | "amber" | "red";
}

export interface PlayerBoostCardView {
  boostId: PlayerBoostId;
  label: string;
  category: PlayerBoostCategory;
  description: string;
  shortEffect: string;
  costs: PlayerBoostCostView[];
  cleanCashCost: number;
  playerCleanCash: number;
  hasEnoughCleanCash: boolean;
  durationMs: number;
  cooldownMs: number;
  cooldownEndsAtMs: number | null;
  cooldownRemainingMs: number;
  activeEndsAtMs: number | null;
  isActive: boolean;
  isArmed: boolean;
  isBlockedByActiveBoost: boolean;
  canActivate: boolean;
  disabledReason: string | null;
  uiAccent: "cyan" | "amber" | "red";
  iconKey: string;
}

export interface PlayerBoostView {
  active: ActivePlayerBoostView | null;
  cards: PlayerBoostCardView[];
}
