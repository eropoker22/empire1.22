/**
 * Responsibility: Shared contract for authoritative action cooldowns.
 * Belongs here: cooldown namespaces and expiry ticks.
 * Does not belong here: throttling internals, UI timers, or scheduler queues.
 */
export interface CooldownState {
  id: string;
  ownerType: CooldownOwnerType;
  ownerId: string;
  cooldowns: Record<string, number>;
  version: number;
}

export type CooldownOwnerType = "player" | "district" | "alliance";

