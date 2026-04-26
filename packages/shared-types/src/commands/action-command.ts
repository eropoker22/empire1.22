import type { PlayerId, ServerInstanceId } from "../ids/entity-id";
import type { GameModeId } from "../ids/game-mode-id";

/**
 * Responsibility: Shared authoritative command envelope for all player actions.
 * Belongs here: type discriminator, identifiers, payload, and correlation fields.
 * Does not belong here: validation, authorization, or execution side effects.
 */
export interface ActionCommand<TType extends string = string, TPayload = Record<string, unknown>> {
  id: string;
  type: TType;
  mode: GameModeId;
  playerId: PlayerId;
  serverInstanceId: ServerInstanceId;
  issuedAt: string;
  payload: TPayload;
  clientRequestId: string | null;
}

