/**
 * Responsibility: Tiny invariant helpers used across core modules.
 * Belongs here: shared guards for nullability and state assumptions.
 * Does not belong here: transport or framework assertions.
 */
export const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

