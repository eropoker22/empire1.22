import type { DefenseWeaponId } from "@empire/shared-types";
import { hasSpyDetectionChance } from "../combat/combatMath";
import { clamp, deterministicUnitInterval } from "../../utils/math";

export interface ResolveSpyInput {
  worldSeed: string;
  playerId: string;
  targetDistrictId: string;
  tick: number;
  defenseLoadout: Partial<Record<DefenseWeaponId, number>>;
  hasActiveTrap: boolean;
  spyBaseSuccessChance: number;
  spyTrapRevealChance: number;
}

export interface ResolveSpyResult {
  result: "success" | "failure";
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  trapDetected: boolean;
}

/**
 * Responsibility: Pure deterministic spy outcome helper.
 * Belongs here: success/reveal rolls derived from authoritative inputs.
 * Does not belong here: state persistence, transport, or client rendering.
 */
export const resolveSpy = (input: ResolveSpyInput): ResolveSpyResult => {
  const cameraCount = input.defenseLoadout.cameras ?? 0;
  const alarmCount = input.defenseLoadout.alarm ?? 0;
  const cameraPenalty = hasSpyDetectionChance(cameraCount) ? 0.18 : 0;
  const alarmPenalty = alarmCount >= 5 ? 0.08 : 0;
  const successChance = clamp(input.spyBaseSuccessChance - cameraPenalty - alarmPenalty, 0.08, 0.95);
  const successRoll = deterministicUnitInterval(
    `${input.worldSeed}:spy:success:${input.playerId}:${input.targetDistrictId}:${input.tick}`
  );
  const result = successRoll <= successChance ? "success" : "failure";
  const trapRevealRoll = deterministicUnitInterval(
    `${input.worldSeed}:spy:trap:${input.playerId}:${input.targetDistrictId}:${input.tick}`
  );
  const trapDetected =
    result === "success" && input.hasActiveTrap && trapRevealRoll <= input.spyTrapRevealChance;

  return {
    result,
    detectedDefense: result === "success" ? filterDefenseLoadout(input.defenseLoadout) : {},
    trapDetected
  };
};

const filterDefenseLoadout = (
  loadout: Partial<Record<DefenseWeaponId, number>>
): Partial<Record<DefenseWeaponId, number>> =>
  Object.fromEntries(
    Object.entries(loadout).filter(([, amount]) => Math.max(0, Number(amount ?? 0)) > 0)
  ) as Partial<Record<DefenseWeaponId, number>>;
