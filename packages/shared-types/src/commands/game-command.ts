import type { AttackDistrictCommand } from "./attack-district-command";
import type { AcknowledgePendingRaidCommand } from "./acknowledge-pending-raid-command";
import type { AllianceLifecycleCommand } from "./alliance-lifecycle-command";
import type { BountyCommand } from "./bounty-command";
import type { BuildStructureCommand } from "./build-structure-command";
import type { CollectProductionCommand } from "./collect-production-command";
import type { CraftItemCommand } from "./craft-item-command";
import type { HeistDistrictCommand } from "./heist-district-command";
import type { MarketCommand } from "./market-command";
import type { OccupyDistrictCommand } from "./occupy-district-command";
import type { PlaceDefenseCommand } from "./place-defense-command";
import type { PlaceTrapCommand } from "./place-trap-command";
import type { RemoveDefenseCommand } from "./remove-defense-command";
import type { RobDistrictCommand } from "./rob-district-command";
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
  | AllianceLifecycleCommand
  | BountyCommand
  | AttackDistrictCommand
  | BuildStructureCommand
  | CollectProductionCommand
  | CraftItemCommand
  | HeistDistrictCommand
  | MarketCommand
  | OccupyDistrictCommand
  | PlaceDefenseCommand
  | PlaceTrapCommand
  | RemoveDefenseCommand
  | RobDistrictCommand
  | RunBuildingActionCommand
  | SelectSpawnDistrictCommand
  | SpyDistrictCommand;
