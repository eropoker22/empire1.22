/**
 * Responsibility: Core-local helpers for stable ID composition.
 * Belongs here: deterministic ID formatting helpers used by the write model.
 * Does not belong here: database adapters or transport parsing.
 */
export const composeEntityId = (prefix: string, value: string): string => `${prefix}:${value}`;

