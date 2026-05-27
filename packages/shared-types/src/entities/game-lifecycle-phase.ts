/**
 * Responsibility: Shared lifecycle vocabulary that separates production gameplay flow from dev-only setup sandboxes.
 * Belongs here: authoritative phase names reused by core, server runtime, and tooling boundaries.
 * Does not belong here: legacy page START labels or UI-specific phase toggles.
 */
export const PRODUCTION_GAME_LIFECYCLE_PHASES = {
  bootstrapping: "bootstrapping",
  live: "live",
  finalLockdown: "final_lockdown",
  resolved: "resolved"
} as const;

export type ProductionGameLifecyclePhase =
  (typeof PRODUCTION_GAME_LIFECYCLE_PHASES)[keyof typeof PRODUCTION_GAME_LIFECYCLE_PHASES];

export const DEV_SETUP_GAME_LIFECYCLE_PHASES = {
  devSetup: "dev-setup"
} as const;

export type DevSetupGameLifecyclePhase =
  (typeof DEV_SETUP_GAME_LIFECYCLE_PHASES)[keyof typeof DEV_SETUP_GAME_LIFECYCLE_PHASES];

export type GameLifecyclePhase = ProductionGameLifecyclePhase | DevSetupGameLifecyclePhase;

export const isProductionGameLifecyclePhase = (
  phase: string
): phase is ProductionGameLifecyclePhase =>
  phase === PRODUCTION_GAME_LIFECYCLE_PHASES.bootstrapping ||
  phase === PRODUCTION_GAME_LIFECYCLE_PHASES.live ||
  phase === PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown ||
  phase === PRODUCTION_GAME_LIFECYCLE_PHASES.resolved;

export const isDevSetupGameLifecyclePhase = (
  phase: string
): phase is DevSetupGameLifecyclePhase => phase === DEV_SETUP_GAME_LIFECYCLE_PHASES.devSetup;
