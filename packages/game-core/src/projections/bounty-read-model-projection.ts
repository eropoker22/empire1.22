import {
  BOUNTY_DURATION_OPTIONS_HOURS,
  BOUNTY_MIN_REWARD_CLEAN_CASH,
  type Bounty,
  type BountyObjectiveType,
  type BountyReadModel
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";

export interface BountyReadModelProjectionContext {
  nowTick?: number;
  tickRateMs?: number;
}

const OBJECTIVE_LABELS: Record<BountyObjectiveType, string> = {
  "attack-player": "Útok na hráče",
  "attack-district": "Útok na district",
  "destroy-player-district": "Zničení districtu"
};

export const createBountyReadModel = (
  state: CoreGameState,
  playerId: string,
  context: BountyReadModelProjectionContext = {}
): BountyReadModel => {
  const nowTick = Math.max(0, Math.floor(Number(context.nowTick ?? state.root.tick ?? 0)));
  const tickRateMs = Math.max(1, Math.floor(Number(context.tickRateMs ?? 1000)));
  const player = state.playersById[playerId] ?? null;
  const resourceState = player ? state.resourceStatesById[player.resourceStateId] : null;

  return {
    minRewardCleanCash: BOUNTY_MIN_REWARD_CLEAN_CASH,
    durationOptionsHours: [...BOUNTY_DURATION_OPTIONS_HOURS],
    currentPlayerCleanCash: Math.max(0, Math.floor(Number(resourceState?.balances.cash ?? 0))),
    eligibleTargets: state.root.playerIds
      .map((candidatePlayerId) => state.playersById[candidatePlayerId])
      .filter((candidate) => candidate !== undefined)
      .map((candidate) => {
        const isSelf = candidate.id === playerId;
        const isAlly = Boolean(player?.allianceId && candidate.allianceId && player.allianceId === candidate.allianceId);
        const districts = state.root.districtIds
          .map((districtId) => state.districtsById[districtId])
          .filter((district) => district !== undefined)
          .filter((district) => district.ownerPlayerId === candidate.id)
          .filter((district) => district.status !== "destroyed" && district.status !== "locked")
          .map((district) => ({
            districtId: district.id,
            name: district.name,
            zone: district.zone,
            status: district.status
          }));
        const disabledReason = resolveTargetDisabledReason({
          isSelf,
          isAlly,
          playerStatus: candidate.status,
          activeDistrictCount: districts.length
        });

        return {
          playerId: candidate.id,
          name: candidate.name,
          factionLabel: candidate.factionId ?? null,
          allianceId: candidate.allianceId ?? null,
          isAlly,
          isSelf,
          activeDistrictCount: districts.length,
          districts,
          canTarget: disabledReason === null,
          disabledReason
        };
      }),
    activeBounties: Object.values(state.bountiesById ?? {})
      .sort((left, right) => right.createdAtTick - left.createdAtTick)
      .slice(0, 50)
      .map((bounty) => createBountyBoardEntryView(state, bounty, playerId, nowTick, tickRateMs)),
    recentBountyEvents: []
  };
};

const resolveTargetDisabledReason = ({
  isSelf,
  isAlly,
  playerStatus,
  activeDistrictCount
}: {
  isSelf: boolean;
  isAlly: boolean;
  playerStatus: string;
  activeDistrictCount: number;
}): string | null => {
  if (isSelf) {
    return "Nemůžeš vypsat bounty sám na sebe.";
  }
  if (isAlly) {
    return "Bounty na spojence není povolená.";
  }
  if (playerStatus !== "active") {
    return "Cíl už není aktivní.";
  }
  if (activeDistrictCount <= 0) {
    return "Cíl nemá aktivní district.";
  }
  return null;
};

const createBountyBoardEntryView = (
  state: CoreGameState,
  bounty: Bounty,
  playerId: string,
  nowTick: number,
  tickRateMs: number
) => {
  const targetPlayer = state.playersById[bounty.targetPlayerId] ?? null;
  const creator = state.playersById[bounty.createdByPlayerId] ?? null;
  const targetDistrict = bounty.targetDistrictId ? state.districtsById[bounty.targetDistrictId] ?? null : null;
  const remainingTicks = bounty.status === "active"
    ? Math.max(0, bounty.expiresAtTick - nowTick)
    : 0;
  const isOwn = bounty.createdByPlayerId === playerId;
  const canCancel = bounty.status === "active" && isOwn;

  return {
    bountyId: bounty.id,
    targetPlayerId: bounty.targetPlayerId,
    targetPlayerName: targetPlayer?.name ?? bounty.targetPlayerId,
    targetDistrictId: bounty.targetDistrictId,
    targetDistrictName: targetDistrict?.name ?? null,
    objectiveType: bounty.objectiveType,
    objectiveLabel: OBJECTIVE_LABELS[bounty.objectiveType],
    rewardCleanCash: bounty.rewardCleanCash,
    createdByLabel: bounty.isAnonymous && !isOwn ? "Anonym" : creator?.name ?? bounty.createdByPlayerId,
    expiresAtTick: bounty.expiresAtTick,
    remainingTicks,
    remainingMs: remainingTicks * tickRateMs,
    status: bounty.status,
    isOwn,
    canCancel,
    cancelDisabledReason: canCancel
      ? null
      : isOwn
        ? "Bounty už nejde zrušit."
        : "Zrušit může jen zadavatel bounty."
  };
};
