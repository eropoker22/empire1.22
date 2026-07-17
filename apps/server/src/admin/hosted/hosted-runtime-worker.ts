import * as crypto from "node:crypto";
import { handleSelectSpawnDistrict } from "@empire/game-core";
import type { AdminAuditEntryView } from "@empire/shared-types";
import type { ServerApp } from "../../app/server-app";
import { ensureGameplaySliceMembershipInState } from "../../bootstrap/gameplay-slice-session-membership";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import { syncRuntimeCapacityStatus } from "../../runtime/instance-manager/server-instance-joinability";
import { findSharedCitySpawnCandidate } from "../../bootstrap/gameplay-slice-shared-city-seed";
import type { PostgresPlayerEntryRepository } from "../../player-entry/postgres-player-entry-repository";
import type { HostedActionRequestRecord, HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";

const CLAIM_TTL_MS = 30_000;
const RUNTIME_LEASE_MS = 20_000;

export const createHostedRuntimeWorker = (options: {
  workerId: string;
  region: string;
  buildSha: string;
  controlPlane: HostedControlPlaneRepository;
  server: ServerApp;
  playerEntry?: PostgresPlayerEntryRepository;
  now?: () => Date;
}) => {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let stopped = false;

  const heartbeat = (status: "online" | "draining" | "stopped" | "failed" = "online") =>
    options.controlPlane.writeWorkerHeartbeat({ workerId: options.workerId, region: options.region,
      buildSha: options.buildSha, startedAt, lastHeartbeatAt: now().toISOString(), status });

  const restoreKnownInstances = async (): Promise<void> => {
    const servers = await options.controlPlane.listServers();
    for (const record of servers.filter((entry) => entry.provisioningState === "ready"
      && ["lobby", "running", "paused", "restarting"].includes(entry.status))) {
      const at = now();
      const leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: at.toISOString(), expiresAt: leaseExpiresAt })) {
        await ensureRuntime(record, true);
      }
    }
  };

  const runOnce = async (): Promise<void> => {
    if (stopped) return;
    await heartbeat();
    await options.controlPlane.expireJoinReservations(now().toISOString());
    await processProvisioningJob();
    await processJoinJob();
    await processMembershipJob();
    await processAction();
    await tickOwnedInstances();
  };

  const processMembershipJob = async (): Promise<void> => {
    if (!options.playerEntry) return;
    const claimedAt = now();
    const job = await options.playerEntry.claimMembershipJob(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!job) return;
    let rollback: { runtime: ServerInstanceRuntime; state: ServerInstanceRuntime["state"] } | null = null;
    try {
      const membership = await options.playerEntry.getMembership(job.membershipId);
      if (!membership) throw safe("MEMBERSHIP_NOT_FOUND");
      const server = await options.controlPlane.getServer(job.serverInstanceId);
      if (!server || server.provisioningState !== "ready") throw safe("MEMBERSHIP_SERVER_NOT_READY");
      const leaseExpiresAt = new Date(claimedAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: server.serverInstanceId,
        workerId: options.workerId, now: claimedAt.toISOString(), expiresAt: leaseExpiresAt })) {
        throw safe("MEMBERSHIP_LEASE_UNAVAILABLE");
      }
      const runtime = await ensureRuntime(server, true);
      rollback = { runtime, state: structuredClone(runtime.state) };
      if (job.jobType === "activate") {
        if (!membership.factionId || !membership.avatarId || !membership.gangColor) throw safe("MEMBERSHIP_SETUP_INVALID");
        const existingPlayer = runtime.state.playersById[membership.playerId];
        if (!existingPlayer) {
          const created = ensureGameplaySliceMembershipInState(runtime.state, {
            serverInstanceId: membership.serverInstanceId,
            playerId: membership.playerId,
            factionId: membership.factionId,
            mode: server.mode
          });
          if (!created.accepted) throw safe("MEMBERSHIP_PLAYER_CREATE_FAILED");
          runtime.state = created.state;
          const player = runtime.state.playersById[membership.playerId]!;
          runtime.state.playersById[membership.playerId] = {
            ...player,
            accountId: membership.accountId,
            color: membership.gangColor as typeof player.color,
            metadata: {
              ...(player.metadata ?? {}),
              membershipId: membership.membershipId,
              avatarId: membership.avatarId,
              setupComplete: true,
              starterPackageApplied: true
            }
          };
          const spawn = handleSelectSpawnDistrict(runtime.state, {
            id: `command:membership-activation:${membership.membershipId}`,
            type: "select-spawn-district",
            mode: server.mode,
            serverInstanceId: membership.serverInstanceId,
            playerId: membership.playerId,
            clientRequestId: `membership:${membership.membershipId}`,
            issuedAt: claimedAt.toISOString(),
            payload: { districtId: membership.reservedSpawnDistrictId }
          }, {
            config: runtime.config,
            clock: runtime.clock,
            mapRules: { isEnabledSpawnCandidate: (districtId) => Boolean(findSharedCitySpawnCandidate(districtId)?.enabled) }
          });
          if (spawn.errors.length > 0) throw safe("MEMBERSHIP_SPAWN_CLAIM_FAILED");
          runtime.state = spawn.nextState;
        } else if (existingPlayer.homeDistrictId !== membership.reservedSpawnDistrictId
          || existingPlayer.metadata?.membershipId !== membership.membershipId) {
          throw safe("MEMBERSHIP_ACTIVATION_CONFLICT");
        }
        syncRuntimeCapacityStatus(runtime);
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        const ticket = await options.server.gameplaySessionService.createJoinTicket({
          ticketId: `join:membership:${membership.membershipId}`,
          accountId: membership.accountId,
          serverInstanceId: membership.serverInstanceId,
          mode: server.mode,
          factionId: membership.factionId,
          nowIso: claimedAt.toISOString()
        });
        if (!await options.playerEntry.completeActivation({ membershipId: membership.membershipId, jobId: job.jobId,
          workerId: options.workerId, joinTicketId: ticket.ticketId, at: now().toISOString() })) {
          throw safe("MEMBERSHIP_ACTIVATION_COMMIT_CONFLICT");
        }
      } else {
        applyEarlyLeaveCleanup(runtime, membership.playerId);
        syncRuntimeCapacityStatus(runtime);
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        await options.server.gameplaySessionService.revokePlayerSessions(membership.playerId, claimedAt.toISOString());
        if (!await options.playerEntry.completeLeave({ membershipId: membership.membershipId, jobId: job.jobId,
          workerId: options.workerId, at: now().toISOString() })) throw safe("MEMBERSHIP_LEAVE_COMMIT_CONFLICT");
      }
    } catch (error) {
      if (rollback) rollback.runtime.state = rollback.state;
      await options.playerEntry.failMembershipJob({ membershipId: job.membershipId, jobId: job.jobId,
        workerId: options.workerId, errorCode: safeCode(error), at: now().toISOString() });
    }
  };

  const processJoinJob = async (): Promise<void> => {
    const claimedAt = now();
    const job = await options.controlPlane.claimJoinJob(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!job) return;
    try {
      const reservation = await options.controlPlane.getJoinReservation(job.reservationId);
      if (!reservation || reservation.status !== "reserved") throw safe("JOIN_RESERVATION_UNAVAILABLE");
      if (Date.parse(reservation.expiresAt) <= claimedAt.getTime()) throw safe("JOIN_RESERVATION_EXPIRED");
      const server = await options.controlPlane.getServer(job.serverInstanceId);
      if (!server || server.provisioningState !== "ready" || !(server.status === "lobby" || server.status === "running")) {
        throw safe("JOIN_SERVER_NOT_READY");
      }
      const leaseExpiresAt = new Date(claimedAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: server.serverInstanceId,
        workerId: options.workerId, now: claimedAt.toISOString(), expiresAt: leaseExpiresAt })) {
        throw safe("JOIN_LEASE_UNAVAILABLE");
      }
      const runtime = await ensureRuntime(server, true);
      const registration = await options.server.gameplaySessionService.getOrCreateRegistration({
        accountId: reservation.playerIdentityId,
        serverInstanceId: reservation.serverInstanceId,
        nowIso: claimedAt.toISOString()
      });
      const membership = ensureGameplaySliceMembershipInState(runtime.state, {
        serverInstanceId: reservation.serverInstanceId,
        playerId: registration.playerId,
        factionId: reservation.factionId,
        mode: server.mode
      });
      if (!membership.accepted) throw safe("JOIN_MEMBERSHIP_REJECTED");
      runtime.state = membership.state;
      syncRuntimeCapacityStatus(runtime);
      await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
      const ticket = await options.server.gameplaySessionService.createJoinTicket({
        ticketId: `join:${reservation.reservationId}`,
        accountId: reservation.playerIdentityId,
        serverInstanceId: reservation.serverInstanceId,
        mode: server.mode,
        factionId: reservation.factionId,
        nowIso: claimedAt.toISOString()
      });
      if (!await options.controlPlane.completeJoin({ reservationId: reservation.reservationId, jobId: job.jobId,
        workerId: options.workerId, joinTicketId: ticket.ticketId, at: now().toISOString() })) {
        throw safe("JOIN_COMMIT_CONFLICT");
      }
      const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(server.serverInstanceId);
      await options.controlPlane.writeInstanceHeartbeat({ serverInstanceId: server.serverInstanceId, workerId: options.workerId,
        leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot?.createdAt ?? null,
        lastErrorCode: null, at: now().toISOString() });
    } catch (error) {
      const at = now().toISOString();
      const code = safeCode(error);
      if (isTerminalJoinFailure(code)) {
        await options.controlPlane.failJoin({ reservationId: job.reservationId, jobId: job.jobId,
          workerId: options.workerId, status: code === "JOIN_RESERVATION_EXPIRED" ? "expired" : "canceled",
          errorCode: code, at });
      }
    }
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    await heartbeat("draining");
    for (const runtime of options.server.instanceManager.listInstances()) {
      await options.server.instanceManager.saveInstanceSnapshot(runtime.record.id);
      await options.controlPlane.releaseRuntimeLease(runtime.record.id, options.workerId, now().toISOString());
    }
    await heartbeat("stopped");
  };

  const processProvisioningJob = async (): Promise<void> => {
    const claimedAt = now();
    const job = await options.controlPlane.claimProvisioningJob(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!job) return;
    try {
      if (!await options.controlPlane.beginProvisioning(job.jobId, job.serverInstanceId, claimedAt.toISOString())) {
        throw safe("PROVISIONING_STATE_CONFLICT");
      }
      const record = await options.controlPlane.getServer(job.serverInstanceId);
      if (!record) throw safe("PROVISIONING_SERVER_NOT_FOUND");
      const leaseExpiresAt = new Date(claimedAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: claimedAt.toISOString(), expiresAt: leaseExpiresAt })) {
        throw safe("PROVISIONING_LEASE_UNAVAILABLE");
      }
      const runtime = await ensureRuntime(record, true);
      runtime.lobby.joinPolicy = "closed";
      runtime.record.status = "lobby";
      await options.server.instanceManager.saveInstanceSnapshot(record.serverInstanceId);
      const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
      if (!snapshot) throw safe("INITIAL_SNAPSHOT_MISSING");
      const at = now().toISOString();
      await options.controlPlane.completeProvisioning({ jobId: job.jobId, serverInstanceId: record.serverInstanceId,
        snapshotId: snapshot.snapshotId, at, audit: workerAudit("provisioning-success", record.serverInstanceId, at) });
      await options.controlPlane.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId, workerId: options.workerId,
        leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot.createdAt, lastErrorCode: null, at });
    } catch (error) {
      const at = now().toISOString();
      const code = safeCode(error);
      await options.controlPlane.failProvisioning({ jobId: job.jobId, serverInstanceId: job.serverInstanceId,
        errorCode: code, at, audit: workerAudit("provisioning-failure", job.serverInstanceId, at, "failure") });
      await options.controlPlane.releaseRuntimeLease(job.serverInstanceId, options.workerId, at);
    }
  };

  const processAction = async (): Promise<void> => {
    const claimedAt = now();
    const request = await options.controlPlane.claimAction(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!request) return;
    try {
      const server = await options.controlPlane.getServer(request.serverInstanceId);
      if (!server) throw safe("LIFECYCLE_SERVER_NOT_FOUND");
      if (server.version !== request.expectedVersion) throw safe("LIFECYCLE_STALE_VERSION");
      const transition = await applyAction(server, request);
      const at = now().toISOString();
      await options.controlPlane.completeAction({ request, ...transition, at,
        audit: workerAudit("lifecycle-success", request.serverInstanceId, at) });
      if (transition.releaseLease) {
        await options.controlPlane.releaseRuntimeLease(request.serverInstanceId, options.workerId, at);
      }
    } catch (error) {
      const at = now().toISOString();
      await options.controlPlane.failAction({ request, errorCode: safeCode(error), at,
        audit: workerAudit("lifecycle-failure", request.serverInstanceId, at, "failure") });
    }
  };

  const applyAction = async (server: HostedServerRecord, request: HostedActionRequestRecord) => {
    const runtime = await ensureRuntime(server);
    const leaseAt = now();
    const leaseExpiresAt = new Date(leaseAt.getTime() + RUNTIME_LEASE_MS).toISOString();
    const requireLease = async () => {
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: server.serverInstanceId,
        workerId: options.workerId, now: leaseAt.toISOString(), expiresAt: leaseExpiresAt })) throw safe("RUNTIME_LEASE_UNAVAILABLE");
    };
    await requireLease();
    switch (request.action) {
      case "open-joins":
        if (server.provisioningState !== "ready" || !(["lobby", "running"] as string[]).includes(server.status)) throw safe("JOINS_NOT_READY");
        options.server.instanceManager.openInstanceForJoin(server.serverInstanceId);
        return { nextStatus: server.status, nextJoinPolicy: "open" as const, releaseLease: false };
      case "close-joins":
        options.server.instanceManager.closeInstanceForJoin(server.serverInstanceId);
        return { nextStatus: server.status, nextJoinPolicy: "closed" as const, releaseLease: false };
      case "start":
        if (server.status !== "lobby") throw safe("START_INVALID_STATE");
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "pause":
        if (server.status !== "running") throw safe("PAUSE_INVALID_STATE");
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        options.server.instanceManager.pauseInstance(server.serverInstanceId);
        return { nextStatus: "paused" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "resume":
        if (server.status !== "paused") throw safe("RESUME_INVALID_STATE");
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "restart": {
        if (!(server.status === "running" || server.status === "restarting")) throw safe("RESTART_INVALID_STATE");
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        if (!await options.controlPlane.prepareRuntimeRestart({ serverInstanceId: server.serverInstanceId,
          workerId: options.workerId, expectedVersion: request.expectedVersion, at: now().toISOString() })) {
          throw safe("RESTART_STATE_CONFLICT");
        }
        await options.controlPlane.releaseRuntimeLease(server.serverInstanceId, options.workerId, now().toISOString());
        await options.server.instanceManager.restoreInstance(server.serverInstanceId);
        await requireLease();
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: "closed" as const, releaseLease: false };
      }
      case "stop":
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        options.server.instanceManager.stopInstance(server.serverInstanceId);
        return { nextStatus: "stopped" as const, nextJoinPolicy: "closed" as const, releaseLease: true };
    }
  };

  const tickOwnedInstances = async (): Promise<void> => {
    const records = await options.controlPlane.listServers();
    for (const record of records.filter((entry) => entry.provisioningState === "ready" && ["lobby", "running", "paused"].includes(entry.status))) {
      const at = now();
      const leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      const owned = await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: at.toISOString(), expiresAt: leaseExpiresAt });
      if (!owned) continue;
      const runtime = await ensureRuntime(record, true);
      if (record.status === "running") options.server.instanceManager.tickInstance(record.serverInstanceId);
      await options.server.instanceManager.saveInstanceSnapshot(record.serverInstanceId);
      const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
      await options.controlPlane.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId, workerId: options.workerId,
        leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot?.createdAt ?? null,
        lastErrorCode: null, at: at.toISOString() });
      const defeatedPlayerIds = Object.values(runtime.state.playersById)
        .filter((player) => player.status === "defeated").map((player) => player.id);
      const resolved = runtime.state.root.phase === "resolved";
      await options.playerEntry?.syncResolvedMemberships(record.serverInstanceId, defeatedPlayerIds, resolved, at.toISOString());
      const revokedPlayerIds = resolved ? Object.keys(runtime.state.playersById) : defeatedPlayerIds;
      await Promise.all(revokedPlayerIds.map((playerId) =>
        options.server.gameplaySessionService.revokePlayerSessions(playerId, at.toISOString())));
    }
  };

  const ensureRuntime = async (record: HostedServerRecord, restoreLatest = false) => {
    const existing = options.server.instanceManager.getInstanceById(record.serverInstanceId);
    if (existing) {
      if (restoreLatest) await options.server.instanceManager.restoreInstance(record.serverInstanceId);
      syncRuntimeStatus(existing, record);
      return existing;
    }
    const creation = options.server.serverInstanceCreationService.createGameServerInstanceResult({
      serverInstanceId: record.serverInstanceId,
      mode: record.mode,
      displayName: record.displayName,
      region: record.region,
      capacity: record.capacity,
      mapComposition: record.mapComposition as never,
      joinPolicy: record.joinPolicy === "open" ? "open" : "closed",
      worldSeed: record.worldSeed
    });
    if (!creation.accepted) throw safe("RUNTIME_CREATE_FAILED");
    const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
    if (snapshot) await options.server.instanceManager.restoreInstance(record.serverInstanceId);
    syncRuntimeStatus(creation.runtime, record);
    return creation.runtime;
  };

  const syncRuntimeStatus = (runtime: ServerInstanceRuntime, record: HostedServerRecord): void => {
    runtime.lobby.joinPolicy = record.joinPolicy === "open" ? "open" : "closed";
    if (record.status === "running") options.server.instanceManager.startInstance(record.serverInstanceId);
    else if (record.status === "paused") options.server.instanceManager.pauseInstance(record.serverInstanceId);
    else runtime.record.status = record.status === "stopped" || record.status === "lobby" ? record.status : "lobby";
  };

  const workerAudit = (action: "provisioning-success" | "provisioning-failure" | "lifecycle-success" | "lifecycle-failure",
    target: string, at: string, result: AdminAuditEntryView["result"] = "success"): AdminAuditEntryView => ({
    id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: null, actorId: options.workerId, role: null,
    action, targetInstanceId: target, result, createdAt: at, correlationId: `hosted-worker:${crypto.randomUUID()}`
  });

  return { heartbeat, restoreKnownInstances, runOnce, stop };
};

const safe = (code: string): Error => Object.assign(new Error(code), { safeCode: code });
const safeCode = (error: unknown): string => typeof error === "object" && error !== null && "safeCode" in error
  ? String((error as { safeCode: unknown }).safeCode).slice(0, 80) : "HOSTED_WORKER_OPERATION_FAILED";

const isTerminalJoinFailure = (code: string): boolean => new Set([
  "JOIN_RESERVATION_UNAVAILABLE",
  "JOIN_RESERVATION_EXPIRED",
  "JOIN_SERVER_NOT_READY",
  "JOIN_MEMBERSHIP_REJECTED"
]).has(code);

const applyEarlyLeaveCleanup = (runtime: ServerInstanceRuntime, playerId: string): void => {
  const player = runtime.state.playersById[playerId];
  if (!player || player.status === "left") return;
  runtime.state.playersById[playerId] = { ...player, status: "left", allianceId: null, version: player.version + 1 };
  for (const districtId of runtime.state.root.districtIds) {
    const district = runtime.state.districtsById[districtId];
    if (!district || district.ownerPlayerId !== playerId) continue;
    runtime.state.districtsById[districtId] = { ...district, ownerPlayerId: null, status: "neutral", version: district.version + 1 };
    for (const buildingId of district.buildingIds) {
      const building = runtime.state.buildingsById[buildingId];
      if (building?.ownerPlayerId === playerId) runtime.state.buildingsById[buildingId] = {
        ...building,
        ownerPlayerId: "player:neutral",
        status: building.status === "destroyed" ? "destroyed" : "disabled",
        metadata: { ...(building.metadata ?? {}), releasedByEarlyLeavePlayerId: playerId },
        version: building.version + 1
      };
    }
  }
  for (const allianceId of runtime.state.root.allianceIds) {
    const alliance = runtime.state.alliancesById[allianceId];
    if (!alliance || !alliance.memberIds.includes(playerId)) continue;
    const membershipByPlayerId = { ...(alliance.membershipByPlayerId ?? {}) };
    delete membershipByPlayerId[playerId];
    runtime.state.alliancesById[allianceId] = {
      ...alliance,
      memberIds: alliance.memberIds.filter((id) => id !== playerId),
      membershipByPlayerId,
      version: alliance.version + 1
    };
  }
  runtime.state.root.version += 1;
};
