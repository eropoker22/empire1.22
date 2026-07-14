import type { PlayerBoostId } from "../entities/player-boost-state";
import type { ActionCommand } from "./action-command";

export interface ActivatePlayerBoostPayload {
  boostId: PlayerBoostId;
}

export type ActivatePlayerBoostCommand = ActionCommand<
  "activate-player-boost",
  ActivatePlayerBoostPayload
>;
