import type { GameCommand } from "../commands";
import type { DomainError } from "../errors";
import type {
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";
import type { PlayerFactionId } from "../entities/faction";
import type { GameplaySliceView } from "../views";

/**
 * Responsibility: Shared request/response contracts for the first gameplay migration slice.
 * Belongs here: transport-safe DTOs between client and server boundaries.
 * Does not belong here: framework adapters or command execution logic.
 */
export interface LoadGameplaySliceRequest {
  serverInstanceId: ServerInstanceId;
  playerId: PlayerId;
  districtId: DistrictId;
  preferredStartDistrictId?: DistrictId | string | null;
  factionId?: PlayerFactionId | string | null;
  snapshotToken?: string | null;
}

export interface SubmitGameplayCommandRequest {
  command: GameCommand;
  focusDistrictId: DistrictId;
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
