import type { DomainError } from "../errors";
import type { ServerInstanceId } from "../ids/entity-id";

export interface PublicServerMatchmakingRequest {
  playerId?: string | null;
  mode?: "free" | "war" | null;
  preferredRegion?: string | null;
  preferredServerInstanceId?: ServerInstanceId | string | null;
  regionLatencyMs?: Record<string, number> | null;
}

export interface PublicServerReservation {
  reservationId: string;
  serverInstanceId: ServerInstanceId;
  mode: "free" | "war";
  region: string;
  displayName: string;
  expiresAt: string;
}

export interface PublicServerMatchmakingResponse {
  accepted: boolean;
  reservation: PublicServerReservation | null;
  errors: DomainError[];
}
