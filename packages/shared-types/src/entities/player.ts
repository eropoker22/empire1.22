import type {
  AccountId,
  AllianceId,
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "../ids/entity-id";
import type { PlayerFactionId } from "./faction";
import type { PlayerColorHex } from "./player-color";
import type { AttackWeaponId } from "./weapon";

/**
 * Responsibility: Minimal authoritative player write-model shape shared as a contract.
 * Belongs here: identity, ownership references, and stable state fields.
 * Does not belong here: websocket presence, anti-cheat internals, or derived rankings.
 */
export interface Player {
  id: PlayerId;
  accountId: AccountId;
  serverInstanceId: ServerInstanceId;
  name: string;
  factionId: PlayerFactionId;
  color: PlayerColorHex;
  status: PlayerStatus;
  allianceId: AllianceId | null;
  homeDistrictId: DistrictId | null;
  attackLoadout: Partial<Record<AttackWeaponId, number>>;
  resourceStateId: string;
  cooldownStateId: string;
  effectStateId: string;
  policeStateId: string;
  createdAt: string;
  lastActionAt: string | null;
  version: number;
}

export type PlayerStatus = "active" | "defeated" | "left" | "banned";
