/**
 * Responsibility: Derives visible wanted level from authoritative heat.
 * Belongs here: shared pure police math used by handlers and projections.
 * Does not belong here: heat mutation, raid scheduling, or UI labels.
 */
export const resolveWantedLevel = (heat: number): number =>
  Math.max(0, Math.min(5, Math.floor(Math.max(0, heat) / 20)));
