import type { GameModeId } from "@empire/shared-types";

/**
 * Responsibility: View-safe mode metadata that can be exposed to client and admin shells.
 * Belongs here: labels, namespaces, and UX-safe timing metadata.
 * Does not belong here: hidden balancing values used for authoritative server decisions.
 */
export interface PublicModeConfig {
  mode: GameModeId;
  label: string;
  matchStyle: "short" | "long";
  tickRateMs: number;
  sessionKeyPrefix: string;
}

