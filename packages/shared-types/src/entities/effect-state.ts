/**
 * Responsibility: Shared contract for active modifiers on one owner.
 * Belongs here: effect references, source metadata, and expiry fields.
 * Does not belong here: effect resolution graphs, hidden modifiers, or stack logic implementation.
 */
export interface EffectState {
  id: string;
  ownerType: EffectOwnerType;
  ownerId: string;
  effects: ActiveEffect[];
  version: number;
}

export interface ActiveEffect {
  effectId: string;
  effectType: string;
  sourceType: string;
  sourceId: string;
  startedAtTick: number;
  expiresAtTick: number | null;
  stackPolicyKey: string;
  payload: Record<string, unknown>;
}

export type EffectOwnerType = "player" | "district" | "alliance" | "instance";

