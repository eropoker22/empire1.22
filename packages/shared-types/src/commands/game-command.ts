import type { AttackDistrictCommand } from "./attack-district-command";
import type { AcknowledgePendingRaidCommand } from "./acknowledge-pending-raid-command";
import type { BuildStructureCommand } from "./build-structure-command";
import type { CollectProductionCommand } from "./collect-production-command";
import type { CraftItemCommand } from "./craft-item-command";
import type { OccupyDistrictCommand } from "./occupy-district-command";
import type { PlaceTrapCommand } from "./place-trap-command";
import type { RunBuildingActionCommand } from "./run-building-action-command";
import type { SelectSpawnDistrictCommand } from "./select-spawn-district-command";
import type { SpyDistrictCommand } from "./spy-district-command";

/**
 * Responsibility: Shared discriminated union for player-issued game commands.
 * Belongs here: the authoritative command set accepted by the server core.
 * Does not belong here: transport adapters or execution logic.
 */
export type GameCommand =
  | AcknowledgePendingRaidCommand
  | AttackDistrictCommand
  | BuildStructureCommand
  | CollectProductionCommand
  | CraftItemCommand
  | OccupyDistrictCommand
  | PlaceTrapCommand
  | RunBuildingActionCommand
  | SelectSpawnDistrictCommand
  | SpyDistrictCommand;
