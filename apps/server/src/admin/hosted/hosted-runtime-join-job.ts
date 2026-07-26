import { ensureGameplaySliceMembershipInState } from "../../bootstrap/gameplay-slice-session-membership";
import { createServerPlayerId } from "../../player-entry/player-entry-policy";
import { withInstanceCommandLock } from "../../runtime/instance-manager/instance-command-lock";
import { syncRuntimeCapacityStatus } from "../../runtime/instance-manager/server-instance-joinability";
import { createInstanceSnapshot } from "../../runtime/persistence";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";
import {
  createHostedRuntimeMutationStage,
  HOSTED_JOB_CLAIM_TTL_MS,
  HOSTED_RUNTIME_LEASE_MS,
  hostedMutationError,
  hostedMutationErrorCode,
  requireHostedRuntimeMutationCommitter,
  type HostedRuntimeMutationStage,
  type HostedRuntimePlayerMutationOptions
} from "./hosted-runtime-player-mutation-context";
import { syncHostedRuntimeStatus } from "./hosted-runtime-worker-state";
import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";

export const processHostedRuntimeJoinJob = async (
  options: HostedRuntimePlayerMutationOptions
): Promise<void> => {
  const claimedAt = options.now();
  const job = await options.controlPlane.claimJoinJob(
    options.workerId,
    options.lease.workerIncarnationId,
    claimedAt.toISOString(),
    new Date(claimedAt.getTime() + HOSTED_JOB_CLAIM_TTL_MS).toISOString()
  );
  if (!job) return;
  try {
    const reservation = await options.controlPlane.getJoinReservation(job.reservationId);
    if (!reservation || reservation.status !== "reserved") {
      throw hostedMutationError("JOIN_RESERVATION_UNAVAILABLE");
    }
    if (reservation.serverInstanceId !== job.serverInstanceId) {
      throw hostedMutationError("JOIN_RESERVATION_INSTANCE_MISMATCH");
    }
    if (Date.parse(reservation.expiresAt) <= claimedAt.getTime()) {
      throw hostedMutationError("JOIN_RESERVATION_EXPIRED");
    }
    const server = await options.controlPlane.getServer(job.serverInstanceId);
    if (!server || server.provisioningState !== "ready"
      || !(server.status === "lobby" || server.status === "running")) {
      throw hostedMutationError("JOIN_SERVER_NOT_READY");
    }
    const registrationState = resolveHostedServerRegistrationState(server, claimedAt);
    if (!registrationState.canCreateMembership) {
      throw hostedMutationError(registrationState.reasonCode ?? "SERVER_REGISTRATION_CLOSED");
    }
    const leaseExpiresAt = new Date(claimedAt.getTime() + HOSTED_RUNTIME_LEASE_MS).toISOString();
    if (!await options.lease.acquire(server.serverInstanceId, claimedAt.toISOString(), leaseExpiresAt)) {
      throw hostedMutationError("JOIN_LEASE_UNAVAILABLE");
    }
    const mutationCommitter = requireHostedRuntimeMutationCommitter(options);
    await withInstanceCommandLock(server.serverInstanceId, async () => {
      const liveRuntime = await options.ensureRuntime(server, false);
      const stage = createHostedRuntimeMutationStage(liveRuntime);
      await stage.restore();
      syncHostedRuntimeStatus(stage.runtime, server, claimedAt);
      const registration = mutationCommitter
        ? {
            playerId: createServerPlayerId(reservation.serverInstanceId, reservation.playerIdentityId)
          }
        : await options.server.gameplaySessionService.getOrCreateRegistration({
            accountId: reservation.playerIdentityId,
            serverInstanceId: reservation.serverInstanceId,
            nowIso: claimedAt.toISOString()
          });
      const membership = ensureGameplaySliceMembershipInState(stage.runtime.state, {
        serverInstanceId: reservation.serverInstanceId,
        playerId: registration.playerId,
        factionId: reservation.factionId,
        mode: server.mode
      });
      if (!membership.accepted) throw hostedMutationError("JOIN_MEMBERSHIP_REJECTED");
      stage.runtime.state = membership.state;
      syncRuntimeCapacityStatus(stage.runtime);
      const ticketInput = {
        ticketId: `join:${reservation.reservationId}`,
        accountId: reservation.playerIdentityId,
        serverInstanceId: reservation.serverInstanceId,
        mode: server.mode,
        factionId: reservation.factionId,
        nowIso: claimedAt.toISOString()
      };
      const ticket = mutationCommitter
        ? options.server.gameplaySessionService.prepareJoinTicket(ticketInput)
        : await options.server.gameplaySessionService.createJoinTicket(ticketInput);
      const completion = {
        reservationId: reservation.reservationId,
        jobId: job.jobId,
        serverInstanceId: reservation.serverInstanceId,
        playerIdentityId: reservation.playerIdentityId,
        workerId: options.workerId,
        workerIncarnationId: options.lease.workerIncarnationId,
        expectedJobVersion: job.version,
        joinTicketId: ticket.ticketId,
        at: options.now().toISOString()
      };
      const completed = mutationCommitter
        ? await mutationCommitter.commitJoin({
            snapshot: createInstanceSnapshot(stage.runtime),
            joinTicket: ticket,
            registration: {
              accountId: reservation.playerIdentityId,
              serverInstanceId: reservation.serverInstanceId,
              playerId: registration.playerId,
              nowIso: claimedAt.toISOString()
            },
            completion,
            fence: options.lease.tickFence(server.serverInstanceId)
          })
        : await completeInMemoryJoin(options, stage, membership.stateChanged, completion);
      if (!completed) throw hostedMutationError("JOIN_COMMIT_CONFLICT");
      await stage.publish();
      const snapshot = await options.server.instanceManager.getPersistenceRepositories()
        .snapshotRepository.loadRecoveryHead(server.serverInstanceId);
      await options.lease.writeInstanceHeartbeat({
        serverInstanceId: server.serverInstanceId,
        leaseExpiresAt,
        lastTick: stage.runtime.state.root.tick,
        lastSnapshotAt: snapshot?.createdAt ?? null,
        lastErrorCode: null,
        at: options.now().toISOString()
      });
    });
  } catch (error) {
    const at = options.now().toISOString();
    const code = hostedMutationErrorCode(error);
    if (isTerminalJoinFailure(code)) {
      await options.controlPlane.failJoin({
        reservationId: job.reservationId,
        jobId: job.jobId,
        serverInstanceId: job.serverInstanceId,
        workerId: options.workerId,
        workerIncarnationId: options.lease.workerIncarnationId,
        expectedJobVersion: job.version,
        status: code === "JOIN_RESERVATION_EXPIRED" ? "expired" : "canceled",
        errorCode: code,
        at
      });
    }
  }
};

const completeInMemoryJoin = async (
  options: HostedRuntimePlayerMutationOptions,
  stage: HostedRuntimeMutationStage,
  stateChanged: boolean,
  completion: Parameters<HostedControlPlaneRepository["completeJoin"]>[0]
): Promise<boolean> => {
  if (stateChanged) await stage.persist();
  return options.controlPlane.completeJoin(completion);
};

const isTerminalJoinFailure = (code: string): boolean => new Set([
  "JOIN_RESERVATION_UNAVAILABLE",
  "JOIN_RESERVATION_EXPIRED",
  "JOIN_SERVER_NOT_READY",
  "JOIN_MEMBERSHIP_REJECTED",
  "SERVER_REGISTRATION_NOT_SCHEDULED",
  "SERVER_REGISTRATION_NOT_OPEN",
  "SERVER_REGISTRATION_CLOSED",
  "SERVER_REGISTRATION_CLOSED_EARLY",
  "SERVER_REGISTRATION_SCHEDULE_INVALID"
]).has(code);
