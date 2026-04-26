import type { DomainError } from "@empire/shared-types";

/**
 * Responsibility: Core-facing error alias for command and tick boundaries.
 * Belongs here: domain-safe errors emitted by the core.
 * Does not belong here: transport mapping or logging implementation.
 */
export type CoreError = DomainError;

