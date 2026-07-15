import { deterministicUnitInterval } from "../../utils/math";

export interface HeistExecutionContext {
  nowMs: number;
  seed: string;
}

interface HeistRollSnapshot {
  id: string;
  rngSeed?: string;
  detectionRoll?: number;
  lossRoll?: number;
  lootRoll?: number;
  rareLootRoll?: number;
}

export const requireHeistNow = (context: HeistExecutionContext): number => {
  const nowMs = Number(context?.nowMs);
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new TypeError("Heist execution requires a finite non-negative context.nowMs.");
  }
  if (typeof context.seed !== "string" || context.seed.trim().length === 0) {
    throw new TypeError("Heist execution requires a non-empty deterministic context.seed.");
  }
  return nowMs;
};

export const createHeistSeed = (
  contextSeed: string,
  attackerPlayerId: string,
  targetDistrictId: string,
  style: string,
  gangMembersSent: number
): string => `${contextSeed}:${attackerPlayerId}:${targetDistrictId}:${style}:${gangMembersSent}`;

export const deterministicHeistRoll = (seed: string, purpose: string): number =>
  deterministicUnitInterval(`${seed}:${purpose}`);

export const resolveHeistRoll = (
  heist: HeistRollSnapshot,
  field: "detectionRoll" | "lossRoll" | "lootRoll" | "rareLootRoll",
  purpose: string
): number => Math.min(1, Math.max(0,
  Number.isFinite(heist[field])
    ? Number(heist[field])
    : deterministicHeistRoll(heist.rngSeed ?? heist.id, purpose)
));

export const deterministicToken = (seed: string): string =>
  Math.floor(deterministicUnitInterval(seed) * 0xffffffff).toString(36).padStart(7, "0");

export const createHeistId = (
  now: number,
  attackerPlayerId: string,
  targetDistrictId: string,
  rngSeed: string
): string =>
  `district_heist:${now}:${attackerPlayerId}:${targetDistrictId}:${deterministicToken(`${rngSeed}:id`)}`;
