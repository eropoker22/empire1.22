import type { BattleReport } from "@empire/shared-types";
export function projectBattleReportDetails(payload: Record<string, unknown>): Partial<BattleReport> {
  return {
      ...(typeof payload.attackPower === "number" ? { attackPower: payload.attackPower } : {}),
      ...(typeof payload.defensePower === "number" ? { defensePower: payload.defensePower } : {}),
      stabilizingUntilTick: typeof payload.stabilizingUntilTick === "number" ? payload.stabilizingUntilTick : null,
      ...(payload.tacticalGrid && typeof payload.tacticalGrid === "object" ? { tacticalGrid: {
        attackerApplied: (payload.tacticalGrid as Record<string, unknown>).attackerApplied === true,
        defenderApplied: (payload.tacticalGrid as Record<string, unknown>).defenderApplied === true,
        multiplier: Number((payload.tacticalGrid as Record<string, unknown>).multiplier ?? 1)
      } } : {}),
  };
}
