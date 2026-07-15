import type {
  Alliance,
  AllianceAuditEvent,
  AllianceChatMessage,
  AllianceDefenseContribution,
  AllianceExitPenalty,
  AllianceInvite,
  AllianceId,
  Building,
  BuildingId,
  Bounty,
  CityFeedEvent,
  CooldownState,
  District,
  DistrictId,
  DistrictTrap,
  EffectState,
  EliminationState,
  EventId,
  EventState,
  FinalLockdownState,
  GameStateRoot,
  MatchResult,
  Notification,
  NotificationId,
  Player,
  PlayerBoostState,
  PlayerCityEventState,
  PlayerId,
  PoliceState,
  ResourceState,
  ServerInstance,
  TrapId,
  VictoryState,
  FormerAllianceTruce
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
  playerBoostStatesByPlayerId?: Record<PlayerId, PlayerBoostState>;
  playerCityEventStatesByPlayerId?: Record<PlayerId, PlayerCityEventState>;
  alliancesById: Record<AllianceId, Alliance>;
  allianceInvitesById?: Record<string, AllianceInvite>;
  allianceChatMessagesById?: Record<string, AllianceChatMessage>;
  allianceExitPenaltiesById?: Record<string, AllianceExitPenalty>;
  formerAllianceTrucesById?: Record<string, FormerAllianceTruce>;
  allianceDefenseContributionsById?: Record<string, AllianceDefenseContribution>;
  allianceAuditEventsById?: Record<string, AllianceAuditEvent>;
  districtsById: Record<DistrictId, District>;
  buildingsById: Record<BuildingId, Building>;
  bountiesById?: Record<string, Bounty>;
  resourceStatesById: Record<string, ResourceState>;
  cooldownStatesById: Record<string, CooldownState>;
  effectStatesById: Record<string, EffectState>;
  policeStatesById: Record<string, PoliceState>;
  cityFeedEventsById: Record<string, CityFeedEvent>;
  eventsById: Record<EventId, EventState>;
  trapsById: Record<TrapId, DistrictTrap>;
  notificationsById: Record<NotificationId, Notification>;
  eliminationState: EliminationState | null;
  finalLockdownState: FinalLockdownState | null;
  victoryState: VictoryState | null;
  matchResult: MatchResult | null;
  market?: Record<string, unknown>;
}
