import type { BuildingId, DistrictId, PlayerId } from "../ids/entity-id";
import type { PlayerStatus } from "../entities/player";
import type { EliminationRiskStatus } from "./elimination-read-model-view";

export interface OnboardingReadModel {
  playerId: PlayerId;
  playerStatus: PlayerStatus;
  hasOwnedDistrict: boolean;
  firstOwnedDistrictId: DistrictId | null;
  hasNeighborDistricts: boolean;
  suggestedNeighborDistrictId: DistrictId | null;
  hasProductionBuilding: boolean;
  suggestedProductionBuildingId: BuildingId | null;
  canSpy: boolean;
  canRob: boolean;
  canAttack: boolean;
  heatAvailable: boolean;
  dayNightAvailable: boolean;
  eliminationAvailable: boolean;
  marketAvailable: boolean;
  allianceAvailable: boolean;
  cityFeedAvailable: boolean;
  currentPlayerStatus: EliminationRiskStatus;
  elimination: {
    nextEliminationTick: number | null;
    ticksUntilNextElimination: number | null;
    dangerZoneCount: number;
    activePlayersRemaining: number;
    currentPlayerStatus: EliminationRiskStatus;
    eliminationsStopped?: boolean;
    isQuietHoursNow?: boolean;
    quietHoursResumeTick?: number | null;
    deferredFromTick?: number | null;
  } | null;
  winConditionText: string;
}
