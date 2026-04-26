import type { GameModeId } from "../ids/game-mode-id";

/**
 * Responsibility: Safe mode metadata carried inside server-fed gameplay projections.
 * Belongs here: UX-visible mode labels and timings shared across client/server.
 * Does not belong here: hidden balance numbers used for authoritative rules.
 */
export interface GameplayModeView {
  mode: GameModeId;
  label: string;
  matchStyle: "short" | "long";
  tickRateMs: number;
  sessionKeyPrefix: string;
}
