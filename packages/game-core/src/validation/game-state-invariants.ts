import type { CoreGameState } from "../entities";

export interface GameStateInvariantOptions {
  maxPlayers?: number;
  maxAllianceSize?: number;
  allowedNegativeResourceIds?: readonly string[];
}

export interface GameStateInvariantViolation {
  code: string;
  entityId: string | null;
  message: string;
}

export interface GameStateInvariantReport {
  passed: boolean;
  checked: number;
  violations: GameStateInvariantViolation[];
}

/**
 * Validates cross-aggregate facts that must remain true after commands, ticks,
 * recovery, and concurrent transport ingress. The checker is intentionally
 * read-only and transport-agnostic so release tooling can reuse it without
 * gaining gameplay authority.
 */
export const checkGameStateInvariants = (
  state: CoreGameState,
  options: GameStateInvariantOptions = {}
): GameStateInvariantReport => {
  const violations: GameStateInvariantViolation[] = [];
  let checked = 0;
  const allowedNegativeResourceIds = new Set(options.allowedNegativeResourceIds ?? []);
  const check = (
    condition: boolean,
    code: string,
    message: string,
    entityId: string | null = null
  ): void => {
    checked += 1;
    if (!condition) violations.push({ code, entityId, message });
  };

  check(
    state.root.serverInstanceId === state.serverInstance.id,
    "ROOT_SERVER_INSTANCE_MISMATCH",
    "The root and server instance identifiers must match.",
    state.root.id
  );
  check(isNonNegativeInteger(state.root.tick), "ROOT_TICK_INVALID", "Root tick must be a non-negative integer.", state.root.id);
  check(isNonNegativeInteger(state.root.version), "ROOT_VERSION_INVALID", "Root version must be a non-negative integer.", state.root.id);
  check(
    state.serverInstance.currentTick === state.root.tick,
    "SERVER_TICK_MISMATCH",
    "Server instance and root ticks must match.",
    state.serverInstance.id
  );

  checkRootReferences(state.root.playerIds, state.playersById, "PLAYER", check);
  checkRootReferences(state.root.allianceIds, state.alliancesById, "ALLIANCE", check);
  checkRootReferences(state.root.districtIds, state.districtsById, "DISTRICT", check);
  checkRootReferences(state.root.trapIds, state.trapsById, "TRAP", check);
  checkRootReferences(state.root.notificationIds, state.notificationsById, "NOTIFICATION", check);

  if (options.maxPlayers !== undefined) {
    check(
      state.root.playerIds.length <= options.maxPlayers,
      "PLAYER_CAPACITY_EXCEEDED",
      "The authoritative player count exceeds the configured server capacity.",
      state.serverInstance.id
    );
  }

  const accountOwners = new Map<string, string>();
  const allianceMembershipOwners = new Map<string, string>();
  for (const playerId of state.root.playerIds) {
    const player = state.playersById[playerId];
    if (!player) continue;
    const population = Number(player.population);
    check(player.serverInstanceId === state.serverInstance.id, "PLAYER_SERVER_MISMATCH", "Player belongs to another server instance.", playerId);
    check(Number.isFinite(population) && population >= 0, "PLAYER_POPULATION_INVALID", "Player population must be finite and non-negative.", playerId);
    check(Boolean(state.resourceStatesById[player.resourceStateId]), "PLAYER_RESOURCE_STATE_MISSING", "Player resource state is missing.", playerId);
    check(Boolean(state.cooldownStatesById[player.cooldownStateId]), "PLAYER_COOLDOWN_STATE_MISSING", "Player cooldown state is missing.", playerId);
    check(Boolean(state.policeStatesById[player.policeStateId]), "PLAYER_POLICE_STATE_MISSING", "Player police state is missing.", playerId);

    const accountId = String(player.accountId ?? "").trim();
    if (accountId) {
      const existingPlayerId = accountOwners.get(accountId);
      check(
        !existingPlayerId || existingPlayerId === playerId,
        "ACCOUNT_PLAYER_DUPLICATE",
        "One account may own at most one player in a server instance.",
        playerId
      );
      accountOwners.set(accountId, existingPlayerId ?? playerId);
    }

    const allianceId = String(player.allianceId ?? "").trim();
    if (allianceId) {
      const existingAllianceId = allianceMembershipOwners.get(playerId);
      check(
        !existingAllianceId || existingAllianceId === allianceId,
        "PLAYER_MULTIPLE_ALLIANCES",
        "A player may not belong to multiple active alliances.",
        playerId
      );
      allianceMembershipOwners.set(playerId, allianceId);
    }
  }

  for (const resourceState of Object.values(state.resourceStatesById)) {
    for (const [resourceId, amount] of Object.entries(resourceState.balances)) {
      check(Number.isFinite(amount), "RESOURCE_BALANCE_NOT_FINITE", "Resource balance must be finite.", resourceState.id);
      if (!allowedNegativeResourceIds.has(resourceId)) {
        check(amount >= 0, "RESOURCE_BALANCE_NEGATIVE", "Resource balance must not be negative.", resourceState.id);
      }
    }
  }

  for (const districtId of state.root.districtIds) {
    const district = state.districtsById[districtId];
    if (!district) continue;
    check(district.serverInstanceId === state.serverInstance.id, "DISTRICT_SERVER_MISMATCH", "District belongs to another server instance.", districtId);
    check(!district.ownerPlayerId || Boolean(state.playersById[district.ownerPlayerId]), "DISTRICT_OWNER_MISSING", "District owner does not exist.", districtId);
    check(Number.isFinite(district.influence) && district.influence >= 0, "DISTRICT_INFLUENCE_INVALID", "District influence must be finite and non-negative.", districtId);
    checkUnique(district.buildingIds, "DISTRICT_BUILDING_DUPLICATE", "District building references must be unique.", districtId, check);
    for (const buildingId of district.buildingIds) {
      const building = state.buildingsById[buildingId];
      check(Boolean(building), "DISTRICT_BUILDING_MISSING", "District references a missing building.", districtId);
      if (building) {
        check(building.districtId === districtId, "BUILDING_DISTRICT_MISMATCH", "Building points at another district.", buildingId);
      }
    }
  }

  for (const allianceId of state.root.allianceIds) {
    const alliance = state.alliancesById[allianceId];
    if (!alliance) continue;
    check(alliance.serverInstanceId === state.serverInstance.id, "ALLIANCE_SERVER_MISMATCH", "Alliance belongs to another server instance.", allianceId);
    checkUnique(alliance.memberIds, "ALLIANCE_MEMBER_DUPLICATE", "Alliance membership must not contain duplicates.", allianceId, check);
    check(
      alliance.status === "disbanded" || alliance.memberIds.includes(alliance.ownerPlayerId),
      "ALLIANCE_OWNER_NOT_MEMBER",
      "An active alliance owner must be an active member.",
      allianceId
    );
    if (options.maxAllianceSize !== undefined) {
      check(alliance.memberIds.length <= options.maxAllianceSize, "ALLIANCE_CAPACITY_EXCEEDED", "Alliance exceeds its configured member limit.", allianceId);
    }
    for (const playerId of alliance.memberIds) {
      check(Boolean(state.playersById[playerId]), "ALLIANCE_MEMBER_MISSING", "Alliance references a missing player.", allianceId);
      const previousAllianceId = allianceMembershipOwners.get(playerId);
      check(
        !previousAllianceId || previousAllianceId === allianceId,
        "PLAYER_MULTIPLE_ALLIANCES",
        "A player may not belong to multiple active alliances.",
        playerId
      );
      allianceMembershipOwners.set(playerId, previousAllianceId ?? allianceId);
    }
  }

  for (const bounty of Object.values(state.bountiesById ?? {})) {
    check(Number.isFinite(bounty.rewardCleanCash) && bounty.rewardCleanCash >= 0, "BOUNTY_REWARD_INVALID", "Bounty reward must be finite and non-negative.", bounty.id);
    check(Boolean(state.playersById[bounty.createdByPlayerId]), "BOUNTY_CREATOR_MISSING", "Bounty creator does not exist.", bounty.id);
    check(Boolean(state.playersById[bounty.targetPlayerId]), "BOUNTY_TARGET_MISSING", "Bounty target does not exist.", bounty.id);
    if (bounty.status === "claimed") {
      check(Boolean(bounty.claimedByPlayerId), "BOUNTY_CLAIMANT_MISSING", "Claimed bounty requires a claimant.", bounty.id);
      check(isNonNegativeInteger(bounty.claimedAtTick), "BOUNTY_CLAIM_TICK_INVALID", "Claimed bounty requires a valid claim tick.", bounty.id);
    }
  }

  const market = state.market as { stock?: Record<string, unknown> } | undefined;
  for (const [resourceId, rawAmount] of Object.entries(market?.stock ?? {})) {
    const amount = Number(rawAmount);
    check(Number.isFinite(amount) && amount >= 0, "MARKET_STOCK_INVALID", "Market stock must be finite and non-negative.", resourceId);
  }

  const eliminatedPlayerIds = state.eliminationState?.eliminatedPlayerIds ?? [];
  checkUnique(eliminatedPlayerIds, "ELIMINATION_DUPLICATE", "A player may be eliminated at most once.", state.eliminationState?.id ?? null, check);
  for (const playerId of eliminatedPlayerIds) {
    check(state.playersById[playerId]?.status === "defeated", "ELIMINATION_STATUS_MISMATCH", "Eliminated player must remain defeated.", playerId);
  }

  if (state.finalLockdownState?.status === "resolved") {
    check(Boolean(state.matchResult), "FINAL_LOCKDOWN_RESULT_MISSING", "Resolved Final Lockdown requires one match result.", state.finalLockdownState.id);
  }
  if (state.matchResult) {
    check(state.root.matchResultId === state.matchResult.id, "MATCH_RESULT_ROOT_MISMATCH", "Root match-result reference must match the persisted result.", state.matchResult.id);
    check(state.matchResult.serverInstanceId === state.serverInstance.id, "MATCH_RESULT_SERVER_MISMATCH", "Match result belongs to another server instance.", state.matchResult.id);
    check(state.serverInstance.status === "ended", "MATCH_RESULT_SERVER_NOT_ENDED", "A finalized match must have an ended server instance.", state.matchResult.id);
    check(state.root.phase === "resolved", "MATCH_RESULT_PHASE_NOT_RESOLVED", "A finalized match must be in the resolved lifecycle phase.", state.matchResult.id);
    const ranks = state.matchResult.ranking.map((entry) => entry.rank);
    checkUnique(ranks, "MATCH_RESULT_RANK_DUPLICATE", "Final ranking positions must be unique.", state.matchResult.id, check);
    check(
      state.matchResult.winnerPlayerId === null
        || state.matchResult.ranking.some((entry) => entry.subjectType === "player" && entry.subjectId === state.matchResult?.winnerPlayerId && entry.rank === 1),
      "MATCH_RESULT_WINNER_RANK_INVALID",
      "Player winner must occupy rank one.",
      state.matchResult.id
    );
  } else {
    check(state.root.matchResultId === null, "MATCH_RESULT_REFERENCE_ORPHANED", "Root must not reference a missing match result.", state.root.id);
  }

  return {
    passed: violations.length === 0,
    checked,
    violations
  };
};

type InvariantCheck = (
  condition: boolean,
  code: string,
  message: string,
  entityId?: string | null
) => void;

const checkRootReferences = <T>(
  ids: readonly string[],
  entities: Record<string, T>,
  label: string,
  check: InvariantCheck
): void => {
  checkUnique(ids, `ROOT_${label}_DUPLICATE`, `Root ${label.toLowerCase()} references must be unique.`, null, check);
  for (const id of ids) {
    check(Boolean(entities[id]), `ROOT_${label}_MISSING`, `Root references a missing ${label.toLowerCase()}.`, id);
  }
};

const checkUnique = (
  values: readonly (string | number)[],
  code: string,
  message: string,
  entityId: string | null,
  check: InvariantCheck
): void => {
  check(new Set(values).size === values.length, code, message, entityId);
};

const isNonNegativeInteger = (value: unknown): boolean =>
  Number.isInteger(value) && Number(value) >= 0;
