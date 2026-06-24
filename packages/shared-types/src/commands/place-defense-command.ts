import type { DistrictId } from "../ids/entity-id";
import type { DefenseWeaponId } from "../entities/weapon";
import type { ActionCommand } from "./action-command";

/**
 * Responsibility: Typed payload for placing owned defense onto an owned district.
 * Belongs here: target, defense item id, amount, and optional source/version hints.
 * Does not belong here: inventory mutation or allied defense ownership rules.
 */
export interface PlaceDefensePayload {
  targetDistrictId: DistrictId;
  sourceDistrictId?: DistrictId;
  defenseItemId: DefenseWeaponId;
  amount: number;
  expectedTargetVersion?: number;
}

export type PlaceDefenseCommand = ActionCommand<"place-defense", PlaceDefensePayload>;
