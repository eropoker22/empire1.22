import type { GameCommand } from "../commands";
import type { DomainError } from "../errors";
import type {
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";
import type { PlayerFactionId } from "../entities/faction";
import type { GameplaySliceView } from "../views";

export const SERVER_ASSIGNED_FOCUS_DISTRICT_ID = "district:server-assigned" as const;

export type ServerAssignedFocusDistrictId = typeof SERVER_ASSIGNED_FOCUS_DISTRICT_ID;

/**
 * Responsibility: Shared request/response contracts for the first gameplay migration slice.
 * Belongs here: transport-safe DTOs between client and server boundaries.
 * Does not belong here: framework adapters or command execution logic.
 */
export interface LoadGameplaySliceRequest {
  serverInstanceId: ServerInstanceId;
  playerId: PlayerId;
  districtId?: DistrictId | ServerAssignedFocusDistrictId | null;
  preferredStartDistrictId?: DistrictId | string | null;
  factionId?: PlayerFactionId | string | null;
  snapshotToken?: string | null;
}

export interface SubmitGameplayCommandRequest {
  command: GameCommand;
  focusDistrictId: DistrictId;
  expectedStateVersion?: number | null;
  snapshotToken?: string | null;
  sessionToken?: string | null;
}

export interface GameplaySliceResponse {
  accepted: boolean;
  readModel: GameplaySliceView | null;
  errors: DomainError[];
  metadata?: GameplaySliceResponseMetadata;
  snapshotToken?: string | null;
  sessionToken?: string | null;
}

export interface GameplaySliceResponseMetadata {
  serverTick: number;
  stateVersion: number;
}
