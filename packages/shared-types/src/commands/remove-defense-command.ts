import type { DistrictId } from "../ids/entity-id";
import type { DefenseWeaponId } from "../entities/weapon";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for removing owned defense from an owned district.
 * Belongs here: target, defense item id, amount, and version hint.
 * Does not belong here: combat math or allied defense ownership rules.
 */
export interface RemoveDefensePayload {
  targetDistrictId: DistrictId;
  defenseItemId: DefenseWeaponId;
  amount: number;
  expectedTargetVersion?: number;
}

export type RemoveDefenseCommand = ActionCommand<"remove-defense", RemoveDefensePayload>;
