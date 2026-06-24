import type { Notification } from "../entities/notification";
import type {
  AllianceExitPenalty,
  AllianceKickVote,
  AllianceMembership,
  FormerAllianceTruce
} from "../entities/alliance";
import type { VictoryState } from "../entities/victory-state";
import type { PlayerFactionId } from "../entities/faction";
import type { PlayerColorHex } from "../entities/player-color";
import type { DistrictId, PlayerId, ServerInstanceId } from "../ids/entity-id";
import type { GameModeId } from "../ids/game-mode-id";
import type { DayNightReadModel } from "./day-night-read-model-view";
import type { EliminationReadModel } from "./elimination-read-model-view";
import type { FactionReadModel } from "./faction-read-model-view";
import type { FinalLockdownReadModel } from "./final-lockdown-read-model-view";
import type { PlayerEconomyView } from "./player-economy-view";
import type { PoliceReadModel } from "./police-read-model-view";

/**
 * Responsibility: Minimal player-facing projection rendered by the client.
 * Belongs here: view contracts returned by the server for UI rendering.
 * Does not belong here: UI component state or domain rule calculations.
 */
export interface PlayerView {
  playerId: PlayerId;
  instanceId: ServerInstanceId;
  mode: GameModeId;
  factionId: PlayerFactionId;
  homeDistrictId: DistrictId | null;
  color: PlayerColorHex;
  serverTime: string;
  resourceBalances: Record<string, number>;
  economy: PlayerEconomyView;
  faction?: FactionReadModel | null;
  dayNight?: DayNightReadModel | null;
  elimination?: EliminationReadModel | null;
  finalLockdown?: FinalLockdownReadModel | null;
  police?: PoliceReadModel | null;
  alliance?: PlayerAllianceLifecycleView | null;
  notifications: Notification[];
  victoryState: VictoryState | null;
}

export interface PlayerAllianceLifecycleView {
  allianceId: string | null;
  allianceName: string | null;
  membership: AllianceMembership | null;
  activeVote: AllianceKickVote | null;
  eligibleVotes: AllianceKickVote[];
  exitPenalty: AllianceExitPenalty | null;
  formerAllyTruces: FormerAllianceTruce[];
  canConfirmReady: boolean;
  readyReasonCode: string | null;
}
