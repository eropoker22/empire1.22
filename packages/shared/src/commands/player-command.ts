import type { GameModeId } from "../ids/game-mode-id";

export interface PlayerCommandEnvelope<TType extends string = string, TPayload = unknown> {
  type: TType;
  mode: GameModeId;
  instanceId: string;
  playerId: string;
  payload: TPayload;
}

