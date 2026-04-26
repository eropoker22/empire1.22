/**
 * Responsibility: Base transport contract for admin-only operations.
 * Belongs here: explicit admin command boundary separate from player commands.
 * Does not belong here: gameplay player actions or admin UI state.
 */
export interface AdminCommand<TType extends string = string, TPayload = Record<string, unknown>> {
  id: string;
  type: TType;
  instanceId: string;
  issuedAt: string;
  actorAdminId: string;
  payload: TPayload;
}

