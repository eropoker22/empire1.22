/**
 * Responsibility: Shared numeric helpers for deterministic server-side calculations.
 * Belongs here: small pure math utilities used across rules.
 * Does not belong here: domain orchestration or UI formatting.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const deterministicUnitInterval = (seed: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};
