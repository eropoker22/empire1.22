import type { Notification } from "@empire/shared-types";

/**
 * Responsibility: Small factory for notification entities emitted by the core.
 * Belongs here: normalized notification creation helpers.
 * Does not belong here: transport delivery or UI localization.
 */
export const createNotification = (input: Notification): Notification => input;

