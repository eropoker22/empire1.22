import type { PlayerFactionId, PlayerId, ServerInstanceId } from "@empire/shared-types";
import type { Clock } from "../runtime/scheduling/clock";

export interface GameplaySessionTokenPayload {
  sessionId?: string;
  accountId?: string;
  serverInstanceId: ServerInstanceId;
  playerId: PlayerId;
  factionId?: PlayerFactionId | string | null;
  issuedAt: string;
  expiresAt: string;
  version?: number;
}

export const isGameplaySessionTokenPayload = (
  value: unknown
): value is GameplaySessionTokenPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GameplaySessionTokenPayload>;
  return (
    typeof candidate.serverInstanceId === "string" &&
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.trim().length > 0 &&
    typeof candidate.accountId === "string" &&
    candidate.accountId.trim().length > 0 &&
    candidate.serverInstanceId.trim().length > 0 &&
    typeof candidate.playerId === "string" &&
    candidate.playerId.trim().length > 0 &&
    typeof candidate.issuedAt === "string" &&
    candidate.issuedAt.trim().length > 0 &&
    typeof candidate.expiresAt === "string" &&
    candidate.expiresAt.trim().length > 0 &&
    typeof candidate.version === "number" &&
    Number.isInteger(candidate.version) &&
    (
      candidate.factionId === undefined ||
      candidate.factionId === null ||
      typeof candidate.factionId === "string"
    )
  );
};

export const isGameplaySessionTokenActive = (
  payload: GameplaySessionTokenPayload,
  clock: Clock
): boolean => {
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  const now = clock.now().getTime();

  return (
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now &&
    expiresAt > now &&
    expiresAt > issuedAt
  );
};
