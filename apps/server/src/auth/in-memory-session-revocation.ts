import type { GameplaySessionRecord } from "./gameplay-session-service";

export const revokeMatchingGameplaySessions = (
  sessions: Map<string, GameplaySessionRecord>,
  revokedAt: string,
  matches: (session: GameplaySessionRecord) => boolean
): number => {
  let count = 0;
  for (const session of sessions.values()) {
    if (!matches(session) || session.revokedAt) continue;
    session.revokedAt = revokedAt;
    session.version += 1;
    count += 1;
  }
  return count;
};
