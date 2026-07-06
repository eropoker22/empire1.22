export type MapAction =
  | "place_defense"
  | "remove_defense"
  | "place_trap"
  | "relocate_trap"
  | "spy"
  | "rob"
  | "heist"
  | "attack"
  | "occupy"
  | "select_spawn";

export type MapActionBlockReason =
  | "TARGET_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "TARGET_CHANGED_OWNER"
  | "TARGET_NOT_EMPTY"
  | "TARGET_IS_EMPTY"
  | "TARGET_IS_SELF"
  | "TARGET_IS_ALLY"
  | "TARGET_NOT_ENEMY"
  | "TARGET_NOT_ADJACENT"
  | "NO_VALID_ORIGIN"
  | "AWAITING_SPAWN_SELECTION"
  | "PLAYER_HAS_NO_SPAWN"
  | "SPAWN_SELECTION_REQUIRED"
  | "SPAWN_NOT_ALLOWED"
  | "SPAWN_ALREADY_OCCUPIED"
  | "SPAWN_RESERVED_BY_OTHER"
  | "SPAWN_STATE_CHANGED"
  | "SPAWN_LOCKED"
  | "SPAWN_NOT_NEUTRAL"
  | "PLAYER_ALREADY_HAS_SPAWN"
  | "GAME_ALREADY_STARTED"
  | "ALLIANCE_REQUIRED"
  | "ALLIANCE_CHANGED"
  | "ALLIED_ACCESS_NOT_ALLOWED"
  | "SPY_REQUIRED"
  | "SPY_AUTH_EXPIRED"
  | "SPY_AUTH_INVALIDATED"
  | "SPY_TARGET_INVALID"
  | "SPY_TARGET_NOT_ADJACENT"
  | "SPY_TARGET_IS_SELF"
  | "SPY_TARGET_IS_ALLY"
  | "SPY_TARGET_EMPTY_ALLOWED"
  | "OCCUPY_SPY_REQUIRED"
  | "OCCUPY_SPY_AUTH_EXPIRED"
  | "OCCUPY_SPY_AUTH_INVALIDATED"
  | "OCCUPY_TARGET_CHANGED"
  | "DOWNTOWN_LOCKED_UNTIL_FINAL_LOCKDOWN"
  | "DISTRICT_LOCKED"
  | "DISTRICT_BUSY"
  | "DEFENSE_CAPACITY_FULL"
  | "ALLY_DEFENSE_LIMIT_REACHED"
  | "ALLIANCE_DEFENSE_NOT_IMPLEMENTED"
  | "DEFENSE_NOT_OWNED"
  | "TRAP_ALREADY_ACTIVE"
  | "TRAP_RELOCATING"
  | "TRAP_TARGET_NOT_OWNED"
  | "TRAP_NOT_AVAILABLE"
  | "INSUFFICIENT_RESOURCES"
  | "COMMAND_ALREADY_ACTIVE"
  | "CONSENT_REQUIRED"
  | "CONSENT_PENDING"
  | "CONSENT_DECLINED"
  | "CONSENT_EXPIRED"
  | "CONSENT_INVALIDATED"
  | "FORMER_ALLY_TRUCE_ACTIVE"
  | "FRONTIER_BLOCKED_BY_ALLIES"
  | "FRONTIER_BLOCKED_BY_ENEMIES"
  | "NO_EMPTY_FRONTIER"
  | "GAME_PHASE_BLOCKED"
  | "VERSION_CONFLICT"
  | "ACTION_NOT_AVAILABLE";

export type DistrictRelation = "self" | "ally" | "enemy" | "empty" | "blocked";

export interface MapActionContext {
  actorPlayerId: string;
  targetDistrictId: string;
  originDistrictId?: string;
  action: MapAction;
  expectedTargetVersion?: number;
  expectedOriginVersion?: number;
  serverTime?: string;
}

export interface ActionValidationResult {
  allowed: boolean;
  reasonCode?: MapActionBlockReason;
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
  originDistrictId?: string;
  requiresConsent?: boolean;
  affectedPlayerIds?: string[];
}

export interface MapActionValidationOptions {
  hasAttackAuthorization?: () => boolean;
  hasOccupyAuthorization?: () => boolean | MapActionBlockReason;
  detectConsentRequired?: () => { requiresConsent: boolean; affectedPlayerIds: string[] };
}
