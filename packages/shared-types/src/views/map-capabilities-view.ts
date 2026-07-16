export type MapActionView =
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

export type MapActionBlockReasonView = string;

export interface DistrictCapabilitiesView {
  canManage: boolean;
  canSpy: boolean;
  canRob: boolean;
  canHeist: boolean;
  canPlaceDefense: boolean;
  canRemoveDefense: boolean;
  canAttack: boolean;
  canOccupy: boolean;
  canPlaceTrap: boolean;
  canRelocateTrapHere: boolean;
  reasons: Partial<Record<MapActionView, MapActionBlockReasonView>>;
}

export type PlayerFrontierStateView =
  | "open"
  | "allied_encircled"
  | "hostile_encircled"
  | "mixed_encircled"
  | "no_frontier";

export interface PlayerFrontierSummaryView {
  state: PlayerFrontierStateView;
  emptyNeighborDistrictIds: string[];
  allyNeighborDistrictIds: string[];
  enemyNeighborDistrictIds: string[];
  lockedNeighborDistrictIds: string[];
  canExpand: boolean;
  canSpyEmptyFrontier: boolean;
  canRobEmptyFrontier: boolean;
  canOccupyWithValidSpy: boolean;
  canAttackNeighborEnemy: boolean;
  explanationKey: string;
  ownedDistrictIds: string[];
  activeOwnedDistrictIds: string[];
  usableOriginDistrictIds: string[];
  temporarilyBlockedOriginDistrictIds: string[];
  permanentlyInvalidOriginDistrictIds: string[];
  destroyedNeighborDistrictIds: string[];
  corridorTargets: AllianceCorridorTargetView[];
  corridorAvailable: boolean;
  canProgressNow: boolean;
  canProgressLater: boolean;
  nextProgressAtTick: number | null;
  recommendedAction: string | null;
  blockingReasons: string[];
  lastStandActive: boolean;
}

export interface AllianceCorridorTargetView {
  sourceDistrictId: string;
  routeDistrictId: string;
  routeDistrictName: string;
  routeOwnerPlayerId: string;
  routeOwnerName: string;
  routeVersion: number;
  targetDistrictId: string;
  targetDistrictName: string;
  targetRelation: "empty" | "enemy";
}

export type SpawnDistrictStatusView =
  | "available"
  | "selected_by_me"
  | "occupied"
  | "reserved_by_other"
  | "locked"
  | "disabled";

export interface LobbySpawnDistrictView {
  districtId: string;
  districtName: string;
  districtType: string;
  buildingType: string | null;
  spawnZones: string[];
  neighborCount: number;
  status: SpawnDistrictStatusView;
  ownerPublicName: string | null;
  ownerPlayerId: string | null;
  version: number;
}
