/**
 * Responsibility: Shared presentation-only admin UI primitive boundary.
 * Belongs here: stateless admin UI shells and future layout primitives.
 * Does not belong here: gameplay logic or server mutations.
 */
export const adminSharedUiPrimitive = "admin-shared-ui-primitive";

export * from "./error-state";
export * from "./loading-state";
export * from "./stale-state";
