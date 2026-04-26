import type { AttackDistrictCommand } from "./attack-district-command";
import type { BuildStructureCommand } from "./build-structure-command";
import type { CollectProductionCommand } from "./collect-production-command";
import type { CraftItemCommand } from "./craft-item-command";
import type { PlaceTrapCommand } from "./place-trap-command";
import type { RunBuildingActionCommand } from "./run-building-action-command";
import type { SpyDistrictCommand } from "./spy-district-command";

/**
 * Responsibility: Shared discriminated union for player-issued game commands.
 * Belongs here: the authoritative command set accepted by the server core.
 * Does not belong here: transport adapters or execution logic.
 */
export type GameCommand =
  | AttackDistrictCommand
  | BuildStructureCommand
  | CollectProductionCommand
  | CraftItemCommand
  | PlaceTrapCommand
  | RunBuildingActionCommand
  | SpyDistrictCommand;
