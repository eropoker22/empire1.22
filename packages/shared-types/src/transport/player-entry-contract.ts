import type { GameModeId } from "../ids/game-mode-id";
import type {
  HostedServerRegistrationReasonCode,
  HostedServerRegistrationStatus
} from "../admin/read-models/admin-hosted-control-plane-views";

export type ServerMembershipStatus =
  | "setup_required"
  | "finalizing_setup"
  | "active"
  | "leave_pending"
  | "left_early"
  | "defeated"
  | "completed";

export interface AccountSessionView {
  accountId: string;
  username: string;
  displayName: string;
  gangName: string;
  expiresAt: string;
}

export interface ServerMembershipView {
  membershipId: string;
  serverInstanceId: string;
  serverDisplayName: string;
  playerId: string;
  status: ServerMembershipStatus;
  reservedSpawnDistrictId: string;
  factionId: string | null;
  avatarId: string | null;
  gangColor: string | null;
  joinedAt: string;
  setupCompletedAt: string | null;
  earlyLeaveAt: string | null;
  completedAt: string | null;
  canLeaveEarly: boolean;
  earlyLeaveDeadline: string | null;
  earlyLeaveRemainingMs: number;
  earlyLeaveBlockedReason: string | null;
  joinTicket: string | null;
}

export interface LobbyServerSummaryView {
  serverInstanceId: string;
  displayName: string;
  mode: GameModeId;
  region: string;
  status: string;
  joinPolicy: string;
  provisioningState: string;
  capacity: number;
  committedPlayers: number;
  reservedSlots: number;
  readyPlayers: number;
  minimumReadyPlayersToStart: number;
  registrationState: HostedServerRegistrationStatus;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosedAt: string | null;
  registrationRemainingMs: number;
  registrationReasonCode: HostedServerRegistrationReasonCode | null;
  canStart: boolean;
  joinable: boolean;
  disabledReason: string | null;
  startedAt: string | null;
  generatedAt: string;
}

export interface LobbyOverviewView {
  account: AccountSessionView;
  gangProfile: {
    gangName: string;
    displayName: string;
    username: string;
  };
  activeBlockingMembership: ServerMembershipView | null;
  memberships: ServerMembershipView[];
  availableServers: LobbyServerSummaryView[];
  featureAvailability: {
    market: "preparing";
    localDemo: boolean;
  };
  generatedAt: string;
}

export interface SpawnDistrictOptionView {
  districtId: string;
  zone: string;
  label: string;
  available: boolean;
  disabledReason: string | null;
  buildingPreview: string[];
  neighboringDistrictCount: number;
  spawnCategory: string;
  version: number;
}

export interface SpawnDistrictSelectionView {
  serverInstanceId: string;
  membershipEligibility: "eligible" | "blocked";
  capacity: { committedPlayers: number; reservedSlots: number; maximum: number };
  serverStatus: string;
  joinPolicy: string;
  readyPlayers: number;
  minimumReadyPlayersToStart: number;
  registrationState: HostedServerRegistrationStatus;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosedAt: string | null;
  registrationRemainingMs: number;
  registrationReasonCode: HostedServerRegistrationReasonCode | null;
  canStart: boolean;
  joinable: boolean;
  disabledReason: string | null;
  generatedAt: string;
  availabilityRevision: string;
  districts: SpawnDistrictOptionView[];
}

export interface ConfirmSpawnDistrictRequest {
  serverInstanceId: string;
  districtId: string;
  expectedAvailabilityRevision: string;
}

export interface FinalizeServerSetupRequest {
  membershipId: string;
  factionId: string;
  avatarId: string;
  gangColor?: string;
}

export interface PlayerEntryApiResponse<T> {
  accepted: boolean;
  data: T | null;
  errors: Array<{ code: string; message: string }>;
}
