/**
 * Responsibility: Shared contract for resource balances owned by one entity.
 * Belongs here: balances, owner references, and persistent economic modifiers.
 * Does not belong here: affordability logic, recompute caches, or pricing rules.
 */
export interface ResourceState {
  id: string;
  ownerType: ResourceOwnerType;
  ownerId: string;
  balances: Record<string, number>;
  incomeModifiers: Record<string, number>;
  lastUpdatedTick: number;
  version: number;
}

export type ResourceOwnerType = "player" | "district" | "alliance" | "building" | "global";
