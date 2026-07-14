export const PLAYER_BOOST_IDS = [
  "ghost-network",
  "industrial-overdrive",
  "tactical-grid"
] as const;

export type PlayerBoostId = typeof PLAYER_BOOST_IDS[number];

export type PlayerBoostCategory = "intel" | "production" | "combat";
export type PlayerBoostConsumptionMode = "timed" | "next-valid-pvp-combat";
export type PlayerBoostActiveStatus = "timed" | "armed";

export interface PlayerBoostEffectSnapshot {
  spyDurationMultiplier?: number;
  criticalFailureChanceMultiplier?: number;
  extraIntelBlocksOnSuccess?: number;
  productionSpeedMultiplier?: number;
  combatPowerMultiplier?: number;
}

export interface ActivePlayerBoostState {
  boostId: PlayerBoostId;
  activatedAtTick: number;
  expiresAtTick: number;
  status: PlayerBoostActiveStatus;
  effectSnapshot: PlayerBoostEffectSnapshot;
}

export interface PlayerBoostState {
  version: number;
  active: ActivePlayerBoostState | null;
  cooldownUntilTickByBoostId: Partial<Record<PlayerBoostId, number>>;
}
