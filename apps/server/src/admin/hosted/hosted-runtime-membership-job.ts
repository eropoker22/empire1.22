import { withInstanceCommandLock } from "../../runtime/instance-manager/instance-command-lock";
import { syncRuntimeCapacityStatus } from "../../runtime/instance-manager/server-instance-joinability";
import { createInstanceSnapshot } from "../../runtime/persistence";
import type {
  MembershipJobCompletionInput,
  MembershipJobRecord
} from "../../player-entry/postgres-player-entry-repository";
import type { HostedServerRecord } from "./hosted-control-plane-repository";
import {
  applyHostedMembershipActivation,
  type HostedMembershipRecord
} from "./hosted-runtime-membership-activation";
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
import { applyHostedEarlyLeaveCleanup } from "./hosted-runtime-worker-state";
import { syncHostedRuntimeStatus } from "./hosted-runtime-worker-state";
import type { HostedRuntimeMutationCommitter } from "./postgres-hosted-runtime-mutation-committer";

export const processHostedRuntimeMembershipJob = async (
  options: HostedRuntimePlayerMutationOptions
): Promise<void> => {
  const repository = options.playerEntry;
  if (!repository) return;
  const claimedAt = options.now();
  const job = await repository.claimMembershipJob(
    options.workerId,
    options.lease.workerIncarnationId,
    claimedAt.toISOString(),
    new Date(claimedAt.getTime() + HOSTED_JOB_CLAIM_TTL_MS).toISOString()
  );
  if (!job) return;
  try {
    const membership = await repository.getMembership(job.membershipId);
    if (!membership) throw hostedMutationError("MEMBERSHIP_NOT_FOUND");
    if (membership.serverInstanceId !== job.serverInstanceId) {
      throw hostedMutationError("MEMBERSHIP_INSTANCE_MISMATCH");
    }
    const server = await options.controlPlane.getServer(job.serverInstanceId);
    if (!server || server.provisioningState !== "ready") {
      throw hostedMutationError("MEMBERSHIP_SERVER_NOT_READY");
    }
    const leaseExpiresAt = new Date(claimedAt.getTime() + HOSTED_RUNTIME_LEASE_MS).toISOString();
    if (!await options.lease.acquire(server.serverInstanceId, claimedAt.toISOString(), leaseExpiresAt)) {
      throw hostedMutationError("MEMBERSHIP_LEASE_UNAVAILABLE");
    }
    const mutationCommitter = requireHostedRuntimeMutationCommitter(options);
    await withInstanceCommandLock(server.serverInstanceId, async () => {
      const liveRuntime = await options.ensureRuntime(server, false);
      const stage = createHostedRuntimeMutationStage(liveRuntime);
      await stage.restore();
      syncHostedRuntimeStatus(stage.runtime, server, claimedAt);
      if (job.jobType === "activate") {
        await activateMembership(options, stage, server, membership, job, claimedAt, mutationCommitter);
      } else {
        await leaveMembership(options, stage, server, membership, job, mutationCommitter);
      }
      await stage.publish();
    });
  } catch (error) {
    await repository.failMembershipJob({
      membershipId: job.membershipId,
      jobId: job.jobId,
      serverInstanceId: job.serverInstanceId,
      workerId: options.workerId,
      workerIncarnationId: options.lease.workerIncarnationId,
      expectedJobVersion: job.version,
      errorCode: hostedMutationErrorCode(error),
      at: options.now().toISOString()
    });
  }
};

const activateMembership = async (
  options: HostedRuntimePlayerMutationOptions,
  stage: HostedRuntimeMutationStage,
  server: HostedServerRecord,
  membership: HostedMembershipRecord,
  job: MembershipJobRecord,
  claimedAt: Date,
  mutationCommitter: HostedRuntimeMutationCommitter | null
): Promise<void> => {
  const runtime = stage.runtime;
  if (!membership.factionId || !membership.avatarId || !membership.gangColor) {
    throw hostedMutationError("MEMBERSHIP_SETUP_INVALID");
  }
  const stateChanged = applyHostedMembershipActivation(runtime, server, membership, claimedAt);
  syncRuntimeCapacityStatus(runtime);
  const ticketInput = {
    ticketId: `join:membership:${membership.membershipId}`,
    accountId: membership.accountId,
    serverInstanceId: membership.serverInstanceId,
    mode: server.mode,
    factionId: membership.factionId,
    nowIso: claimedAt.toISOString()
  };
  const ticket = mutationCommitter
    ? options.server.gameplaySessionService.prepareJoinTicket(ticketInput)
    : await options.server.gameplaySessionService.createJoinTicket(ticketInput);
  const completion = {
    membershipId: membership.membershipId,
    jobId: job.jobId,
    serverInstanceId: membership.serverInstanceId,
    accountId: membership.accountId,
    workerId: options.workerId,
    workerIncarnationId: options.lease.workerIncarnationId,
    expectedJobVersion: job.version,
    joinTicketId: ticket.ticketId,
    at: options.now().toISOString()
  };
  const completed = mutationCommitter
    ? await mutationCommitter.commitMembership({
        snapshot: createInstanceSnapshot(runtime),
        joinTicket: ticket,
        completion,
        nextStatus: "active",
        fence: options.lease.tickFence(server.serverInstanceId)
      })
    : await completeInMemoryMembership(options, stage, stateChanged, completion, "active");
  if (!completed) throw hostedMutationError("MEMBERSHIP_ACTIVATION_COMMIT_CONFLICT");
};

const leaveMembership = async (
  options: HostedRuntimePlayerMutationOptions,
  stage: HostedRuntimeMutationStage,
  server: HostedServerRecord,
  membership: HostedMembershipRecord,
  job: MembershipJobRecord,
  mutationCommitter: HostedRuntimeMutationCommitter | null
): Promise<void> => {
  const runtime = stage.runtime;
  const stateChanged = applyHostedEarlyLeaveCleanup(runtime, membership.playerId);
  syncRuntimeCapacityStatus(runtime);
  const completion = {
    membershipId: membership.membershipId,
    jobId: job.jobId,
    serverInstanceId: membership.serverInstanceId,
    accountId: membership.accountId,
    workerId: options.workerId,
    workerIncarnationId: options.lease.workerIncarnationId,
    expectedJobVersion: job.version,
    joinTicketId: null,
    at: options.now().toISOString()
  };
  const completed = mutationCommitter
    ? await mutationCommitter.commitMembership({
        snapshot: createInstanceSnapshot(runtime),
        completion,
        nextStatus: "left_early",
        revokePlayerId: membership.playerId,
        fence: options.lease.tickFence(server.serverInstanceId)
      })
    : await completeInMemoryMembership(options, stage, stateChanged, completion, "left_early");
  if (!completed) throw hostedMutationError("MEMBERSHIP_LEAVE_COMMIT_CONFLICT");
  if (!mutationCommitter) {
    await options.server.gameplaySessionService.revokePlayerSessions(membership.playerId, completion.at);
  }
};

const completeInMemoryMembership = async (
  options: HostedRuntimePlayerMutationOptions,
  stage: HostedRuntimeMutationStage,
  stateChanged: boolean,
  completion: MembershipJobCompletionInput,
  nextStatus: "active" | "left_early"
): Promise<boolean> => {
  if (!options.playerEntry) throw hostedMutationError("MEMBERSHIP_REPOSITORY_UNAVAILABLE");
  if (stateChanged) await stage.persist();
  if (nextStatus === "active") {
    if (!completion.joinTicketId) throw hostedMutationError("MEMBERSHIP_JOIN_TICKET_MISSING");
    return options.playerEntry.completeActivation({
      ...completion,
      joinTicketId: completion.joinTicketId
    });
  }
  return options.playerEntry.completeLeave(completion);
};
