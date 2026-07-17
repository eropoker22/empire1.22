export type PlayerOperationalLivenessState =
  | "playable"
  | "open_frontier"
  | "hostile_encircled"
  | "allied_encircled"
  | "mixed_encircled"
  | "temporarily_sealed"
  | "economy_recovery"
  | "last_stand"
  | "no_territory"
  | "defeated"
  | "invalid_softlock";

export interface PlayerProgressionCapabilityView {
  canExecuteNow: boolean;
  canExecuteLater: boolean;
  nextAvailableAtTick: number | null;
  reasonCode: string | null;
  sourceDistrictId: string | null;
  targetDistrictId: string | null;
  routeDistrictId: string | null;
  recommendedPayloadPreview: Record<string, unknown> | null;
  evidence: string[];
}

export interface PlayerOperationalLivenessView {
  state: PlayerOperationalLivenessState;
  canProgressNow: boolean;
  canProgressLater: boolean;
  nextProgressAtTick: number | null;
  nextProgressReason: string | null;
  remainingTicks: number | null;
  ownedDistrictCount: number;
  activeDistrictCount: number;
  ownedDistrictIds: string[];
  activeOwnedDistrictIds: string[];
  usableOriginDistrictIds: string[];
  temporarilyBlockedOriginDistrictIds: string[];
  permanentlyInvalidOriginDistrictIds: string[];
  frontierState: string;
  directTargets: string[];
  corridorTargets: string[];
  blockingReasons: string[];
  recommendedActions: string[];
  capabilities: Record<string, PlayerProgressionCapabilityView>;
  corridorAvailable: boolean;
  lastStand: {
    active: boolean;
    districtId: string | null;
    protectedUntilTick: number | null;
    remainingTicks: number;
  };
  emergencyRecovery: {
    canClaim: boolean;
    used: boolean;
    cleanCash: number;
    population: number;
    disabledReason: string | null;
  };
  invalidInvariant: boolean;
}
