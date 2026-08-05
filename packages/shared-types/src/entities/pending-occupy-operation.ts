import type { DistrictId, PlayerId } from "../ids/entity-id";

export interface PendingOccupyOperation {
  id: string;
  commandId: string;
  playerId: PlayerId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  issuedAt: string;
  issuedAtTick: number;
  resolveAt: string;
  resolveAtTick: number;
  cooldownTicks: number;
  influenceCost: number;
  populationCost: number;
  heatGain: number;
  failureChancePct: number;
  populationRefundPct: number;
  version: number;
}
