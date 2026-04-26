import type { PlayerId } from "../ids/entity-id";

/**
 * Responsibility: Shared contract for police and heat status tied to one player.
 * Belongs here: persistent heat values and visible enforcement flags.
 * Does not belong here: hidden raid scheduling or predictive enforcement caches.
 */
export interface PoliceState {
  id: string;
  ownerPlayerId: PlayerId;
  heat: number;
  wantedLevel: number;
  lastDecayTick: number;
  activeFlags: string[];
  version: number;
}

