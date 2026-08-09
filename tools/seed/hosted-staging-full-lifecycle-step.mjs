import { checkGameStateInvariants } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createPostgresHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted";
import {
  createPostgresDatabase,
  createPostgresSnapshotRepository
} from "../../apps/server/src/runtime/persistence/postgres";
import {
  assertRemoteStagingLifecycleFixtureServer,
  assertSafeRemoteStagingFixtureEnvironment,
  readRemoteStagingLifecycleFixtureBinding
} from "../../scripts/remote-staging-fixture-safety.mjs";
import {
  canonicalHash,
  membershipRanking,
  parseJsonValue,
  playerRanking,
  safeHash
} from "./hosted-staging-full-lifecycle-evidence.mjs";
import {
  assertLifecycleSnapshotScope,
  prepareQuietHoursDeferral
} from "./hosted-staging-quiet-hours-fixture.mjs";

const OPERATIONS = new Set([
  "inspect",
  "prepare-quiet-hours-deferral",
  "prepare-next-elimination",
  "prepare-final-lockdown-resolution"
]);
const safety = assertSafeRemoteStagingFixtureEnvironment(process.env);
const lifecycleBinding = readRemoteStagingLifecycleFixtureBinding(process.env);
const serverInstanceId = readArgument("--server");
const operation = readArgument("--operation");
if (!serverInstanceId) throw new Error("REMOTE_STAGING_LIFECYCLE_SERVER_REQUIRED");
if (!OPERATIONS.has(operation)) throw new Error("REMOTE_STAGING_LIFECYCLE_OPERATION_INVALID");

const database = createPostgresDatabase(String(process.env.EMPIRE_DATABASE_URL), {
  max: 1,
  connectionTimeoutMillis: 10_000,
  queryTimeoutMillis: 30_000
});

try {
  const controlPlane = createPostgresHostedControlPlaneRepository(database);
  const server = await controlPlane.getServer(serverInstanceId);
  const mutate = operation !== "inspect";
  assertRemoteStagingLifecycleFixtureServer(server, { mutate, ...lifecycleBinding });
  const snapshots = createPostgresSnapshotRepository(database);
  const current = await snapshots.loadRecoveryHead(serverInstanceId);
  if (!current) throw new Error("REMOTE_STAGING_LIFECYCLE_RECOVERY_HEAD_MISSING");
  assertLifecycleSnapshotScope(current, server, { mutate });

  let prepared = current;
  let preparation = null;
  if (operation === "prepare-quiet-hours-deferral") {
    ({ snapshot: prepared, evidence: preparation } = prepareQuietHoursDeferral(current, advanceSnapshotClock));
  } else if (operation === "prepare-next-elimination") {
    ({ snapshot: prepared, evidence: preparation } = prepareNextElimination(current, server));
  } else if (operation === "prepare-final-lockdown-resolution") {
    ({ snapshot: prepared, evidence: preparation } = prepareFinalLockdownResolution(current));
  }

  if (mutate) {
    const result = await snapshots.saveRecoveryHead(prepared);
    if (!['created', 'updated'].includes(result)) {
      throw new Error("REMOTE_STAGING_LIFECYCLE_RECOVERY_HEAD_CONFLICT");
    }
  }

  const matchRows = await database.query(
    `SELECT match_result_id,result_payload
     FROM empire_hosted_match_results WHERE server_instance_id=$1 ORDER BY match_result_id`,
    [serverInstanceId]
  );
  const membershipRows = await database.query(
    `SELECT player_id,status,final_rank,final_score,final_score_breakdown
     FROM empire_server_memberships WHERE server_instance_id=$1 ORDER BY player_id`,
    [serverInstanceId]
  );
  const invariantReport = checkGameStateInvariants(prepared.state);
  const activePlayers = Object.values(prepared.state.playersById)
    .filter((player) => player.status === "active").length;
  const memberships = membershipRows.rows;
  const snapshotMatchResult = prepared.state.matchResult ?? null;
  const persistedMatchResult = parseJsonValue(matchRows.rows[0]?.result_payload) ?? null;
  const snapshotMatchResultHash = canonicalHash(snapshotMatchResult);
  const persistedMatchResultHash = canonicalHash(persistedMatchResult);
  const snapshotRankingHash = canonicalHash(playerRanking(snapshotMatchResult));
  const persistedRankingHash = canonicalHash(playerRanking(persistedMatchResult));
  const membershipRankingHash = canonicalHash(membershipRanking(memberships));
  const membershipStateHash = canonicalHash(memberships.map((row) => ({
    playerId: row.player_id,
    status: row.status,
    finalRank: row.final_rank,
    finalScore: row.final_score
  })));
  const resourceStateHash = canonicalHash(Object.values(prepared.state.playersById).map((player) => ({
    playerId: player.id,
    status: player.status,
    cash: player.cash,
    resources: player.resources,
    inventory: player.inventory
  })));

  console.log(JSON.stringify({
    environment: safety.environment,
    operation,
    serverInstanceHash: safeHash(serverInstanceId),
    serverStatus: server.status,
    registrationClosed: Boolean(server.registrationClosedAt),
    snapshotRegistrationClosed: Boolean(prepared.state.serverPacingState?.registrationClosedAt),
    snapshotRegistrationBaselinePlayers:
      prepared.state.serverPacingState?.registrationBaselinePlayers ?? null,
    snapshotEffectiveFinalLockdownTrigger:
      prepared.state.serverPacingState?.effectiveFinalLockdownTrigger ?? null,
    snapshotEffectiveFirstEliminationTick:
      prepared.state.serverPacingState?.effectiveFirstEliminationTick ?? null,
    effectiveFinalLockdownTrigger: server.effectiveFinalLockdownTrigger,
    effectiveFirstEliminationTick: server.effectiveFirstEliminationTick,
    tick: prepared.state.root.tick,
    rootVersion: prepared.state.root.version,
    activePlayers,
    eliminatedPlayers: prepared.state.eliminationState?.eliminatedPlayerIds.length ?? 0,
    eliminationCount: prepared.state.eliminationState?.eliminationCount ?? 0,
    nextEliminationTick: prepared.state.eliminationState?.nextEliminationTick ?? null,
    finalLockdownStatus: prepared.state.finalLockdownState?.status ?? "inactive",
    finalLockdownRemainingTicks: prepared.state.finalLockdownState?.remainingActiveTicks ?? null,
    matchResultHash: snapshotMatchResultHash,
    snapshotMatchResultHash,
    persistedMatchResultHash,
    resultPayloadMatchesSnapshot: snapshotMatchResultHash !== null
      && snapshotMatchResultHash === persistedMatchResultHash,
    snapshotRankingHash,
    persistedRankingHash,
    membershipRankingHash,
    membershipStateHash,
    resourceStateHash,
    rankingPayloadMatchesSnapshot: snapshotRankingHash !== null
      && snapshotRankingHash === persistedRankingHash,
    membershipRankingMatchesSnapshot: snapshotRankingHash !== null
      && snapshotRankingHash === membershipRankingHash,
    winnerHash: prepared.state.matchResult?.winnerPlayerId
      ? safeHash(prepared.state.matchResult.winnerPlayerId)
      : prepared.state.matchResult?.winnerAllianceId
        ? safeHash(prepared.state.matchResult.winnerAllianceId)
        : null,
    persistedMatchResultCount: matchRows.rows.length,
    membershipCount: memberships.length,
    defeatedMembershipCount: memberships.filter((row) => row.status === "defeated").length,
    completedMembershipCount: memberships.filter((row) => row.status === "completed").length,
    rankedMembershipCount: memberships.filter((row) => row.final_rank !== null).length,
    invariantChecks: invariantReport.checked,
    invariantViolationCodes: invariantReport.violations.map((violation) => violation.code),
    prepared: preparation,
    targetHashPrefix: safety.targetHash.slice(0, 16)
  }));
} finally {
  await database.close();
}

function prepareNextElimination(source, server) {
  if (source.state.matchResult || source.state.finalLockdownState) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_ELIMINATION_PHASE_INVALID");
  }
  const activePlayers = Object.values(source.state.playersById)
    .filter((player) => player.status === "active").length;
  if (activePlayers <= Number(server.effectiveFinalLockdownTrigger)) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_ELIMINATION_COMPLETE");
  }
  const config = resolveModeConfig("free");
  const nextEliminationTick = source.state.eliminationState?.nextEliminationTick
    ?? server.effectiveFirstEliminationTick
    ?? config.balance.elimination?.firstEliminationTick;
  if (!Number.isInteger(nextEliminationTick) || nextEliminationTick <= 0) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_ELIMINATION_TICK_INVALID");
  }
  const preparedTick = Math.max(source.state.root.tick, nextEliminationTick - 1);
  const snapshot = advanceSnapshotClock(source, preparedTick);
  return {
    snapshot,
    evidence: {
      phase: "next-elimination",
      activePlayersBefore: activePlayers,
      eliminationCountBefore: source.state.eliminationState?.eliminationCount ?? 0,
      scheduledTick: nextEliminationTick,
      preparedTick
    }
  };
}

function prepareFinalLockdownResolution(source) {
  const finalState = source.state.finalLockdownState;
  if (source.state.matchResult || !finalState || !["active", "paused"].includes(finalState.status)) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_LOCKDOWN_PHASE_INVALID");
  }
  const activePlayers = Object.values(source.state.playersById)
    .filter((player) => player.status === "active").length;
  if (activePlayers !== 8) throw new Error("REMOTE_STAGING_LIFECYCLE_LOCKDOWN_PLAYER_COUNT_INVALID");
  const config = resolveModeConfig("free");
  const ticksPerDay = Math.ceil((24 * 60 * 60 * 1000) / config.tickRateMs);
  const preparedTick = Math.max(
    source.state.root.tick,
    finalState.lastUpdatedTick + finalState.remainingActiveTicks + ticksPerDay
  );
  const snapshot = advanceSnapshotClock(source, preparedTick);
  return {
    snapshot,
    evidence: {
      phase: "final-lockdown-resolution",
      activePlayersBefore: activePlayers,
      remainingActiveTicksBefore: finalState.remainingActiveTicks,
      preparedTick
    }
  };
}

function advanceSnapshotClock(source, tick) {
  const snapshot = structuredClone(source);
  snapshot.state.root.tick = tick;
  snapshot.state.serverInstance.currentTick = tick;
  snapshot.state.root.version += 1;
  snapshot.runtime.commandRateLimitWindow = {
    tick,
    commandCountsByPlayerId: {}
  };
  snapshot.tick = tick;
  snapshot.integrity.rootVersion = snapshot.state.root.version;
  snapshot.createdAt = new Date().toISOString();
  snapshot.snapshotId = [
    "snapshot",
    snapshot.instanceId,
    snapshot.tick,
    snapshot.integrity.rootVersion
  ].join(":");
  return snapshot;
}

function readArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}
