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
  /**
   * @deprecated Compatibility-only hint for old clients. Server load authority
   * derives the player from the gameplay session, never from this field.
   */
  playerId?: PlayerId | null;
  /**
   * @deprecated Dev/test compatibility only. Server load authority on join
   * depends on authenticated account id, not this field.
   */
  accountId?: string | null;
  districtId?: DistrictId | ServerAssignedFocusDistrictId | null;
  preferredStartDistrictId?: DistrictId | string | null;
  factionId?: PlayerFactionId | string | null;
  snapshotToken?: string | null;
  /**
   * @deprecated Dev/test compatibility only. Production gameplay session
   * authority is the HttpOnly gameplay session cookie.
   */
  sessionToken?: string | null;
  joinTicket?: string | null;
}

export interface JoinGameplaySliceRequest {
  joinTicket: string;
  serverInstanceId: ServerInstanceId;
  accountId?: string | null;
  factionId?: PlayerFactionId | string | null;
  preferredStartDistrictId?: DistrictId | string | null;
}

export interface LogoutGameplaySliceRequest {
  serverInstanceId?: ServerInstanceId | string | null;
  /**
   * @deprecated Dev/test compatibility only. Production logout reads the
   * HttpOnly gameplay session cookie and clears it server-side.
   */
  sessionToken?: string | null;
}

export interface SubmitGameplayCommandRequest {
  command: GameCommand;
  focusDistrictId: DistrictId;
  expectedStateVersion?: number | null;
  snapshotToken?: string | null;
  /**
   * @deprecated Dev/test compatibility only. Production command identity is
   * authorized by the HttpOnly gameplay session cookie.
   */
  sessionToken?: string | null;
}

export interface GameplaySliceResponse {
  accepted: boolean;
  readModel: GameplaySliceView | null;
  errors: DomainError[];
  metadata?: GameplaySliceResponseMetadata;
  commandResult?: GameplayCommandResultMetadata | null;
  snapshotToken?: string | null;
  /**
   * @deprecated Dev/test compatibility only. Production responses must not
   * expose the gameplay session token in JSON.
   */
  sessionToken?: string | null;
}

export interface GameplaySliceResponseMetadata {
  serverTick: number;
  stateVersion: number;
}

export interface GameplayCommandResultMetadata {
  commandId: string;
  status: "applied" | "rejected";
  rootVersionBefore: number;
  rootVersionAfter: number | null;
  eventCount: number;
  eventIds: string[];
  snapshotId: string | null;
}
