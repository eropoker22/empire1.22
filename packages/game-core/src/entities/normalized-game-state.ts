import type {
  Alliance,
  AllianceId,
  Building,
  BuildingId,
  CooldownState,
  District,
  DistrictId,
  DistrictTrap,
  EffectState,
  EventId,
  EventState,
  GameStateRoot,
  MatchResult,
  Notification,
  NotificationId,
  Player,
  PlayerId,
  PoliceState,
  ResourceState,
  ServerInstance,
  TrapId,
  VictoryState
} from "@empire/shared-types";

/**
 * Responsibility: Canonical normalized authoritative write model for one instance.
 * Belongs here: entity maps, root aggregate state, and instance-scoped truth.
 * Does not belong here: UI-specific views, websocket sessions, or caches.
 */
export interface NormalizedGameState {
  serverInstance: ServerInstance;
  root: GameStateRoot;
  playersById: Record<PlayerId, Player>;
  alliancesById: Record<AllianceId, Alliance>;
  districtsById: Record<DistrictId, District>;
  buildingsById: Record<BuildingId, Building>;
  resourceStatesById: Record<string, ResourceState>;
  cooldownStatesById: Record<string, CooldownState>;
  effectStatesById: Record<string, EffectState>;
  policeStatesById: Record<string, PoliceState>;
  eventsById: Record<EventId, EventState>;
  trapsById: Record<TrapId, DistrictTrap>;
  notificationsById: Record<NotificationId, Notification>;
  victoryState: VictoryState | null;
  matchResult: MatchResult | null;
}
