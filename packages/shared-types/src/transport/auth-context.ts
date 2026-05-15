import type { PlayerId } from "../ids/entity-id";

export type AuthContextMode = "dev" | "anonymous" | "authenticated";

/**
 * Responsibility: Transport-safe request identity boundary.
 * Belongs here: the future session/auth-to-player binding contract.
 * Does not belong here: OAuth/JWT providers, persistence, or gameplay rules.
 */
export interface AuthContext {
  authenticatedPlayerId: PlayerId | null;
  mode: AuthContextMode;
}
