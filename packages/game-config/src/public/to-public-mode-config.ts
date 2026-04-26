import type { PublicModeConfig } from "../contracts/public-mode-config";
import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

/**
 * Responsibility: Produces the sanitized client-facing subset of a resolved mode config.
 * Belongs here: safe projection of mode metadata for UI and admin shells.
 * Does not belong here: authoritative gameplay values used by the server core.
 */
export const toPublicModeConfig = (config: ResolvedGameModeConfig): PublicModeConfig => config.publicMeta;

