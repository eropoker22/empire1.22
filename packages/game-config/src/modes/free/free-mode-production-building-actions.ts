import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";

/**
 * Armory production is handled exclusively by typed server production lines.
 * This deprecated action registry remains empty for compatibility with the
 * Free-mode config assembly.
 */
export const freeModeProductionBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {};
