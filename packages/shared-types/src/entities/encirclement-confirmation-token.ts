import type { AllianceId, DistrictId, PlayerId } from "../ids/entity-id";

export interface EncirclementConfirmationToken {
  id: string;
  actorPlayerId: PlayerId;
  targetDistrictId: DistrictId;
  sourceDistrictId: DistrictId;
  affectedPlayerIds: PlayerId[];
  targetVersion: number;
  allianceId: AllianceId;
  allianceVersion: number;
  issuedAtTick: number;
  expiresAtTick: number;
  consumedAtTick: number | null;
  version: number;
}
