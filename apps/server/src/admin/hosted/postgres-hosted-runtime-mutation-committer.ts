import type {
  InstanceSnapshotDto,
  SnapshotCheckpointRecord
} from "../../runtime/persistence";
import type { JoinTicketRecord } from "../../auth";
import {
  assertCurrentPostgresRuntimeLease,
  createPostgresSnapshotRepositoryForTransaction,
  lockPostgresServerInstanceRow,
  type PostgresDatabase,
  type PostgresQueryable
} from "../../runtime/persistence/postgres";
import { revokePlayerGameplaySessions } from "../../runtime/persistence/postgres/postgres-gameplay-session-revocation";
import {
  getOrCreatePostgresGameplayRegistration,
  savePostgresJoinTicket
} from "../../runtime/persistence/postgres/postgres-gameplay-identity-writes";
import type {
  SnapshotPersistenceMetrics
} from "../../runtime/persistence/repositories";
import type { RuntimeLeaseFence } from "../../runtime/instance-manager/atomic-command-transaction";
import { createServerPlayerId } from "../../player-entry/player-entry-policy";
import {
  completePostgresMembershipJobInTransaction,
  type MembershipJobCompletionInput
} from "../../player-entry/postgres-player-entry-membership-jobs";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";
import {
  completePostgresHostedActionInTransaction,
  type PostgresHostedActionCompletionResult
} from "./postgres-hosted-action-completion";
import { completePostgresHostedJoinInTransaction } from "./postgres-hosted-join-repository";
import { completePostgresHostedProvisioningInTransaction } from "./postgres-hosted-provisioning-repository";

type ProvisioningCompletion = Parameters<HostedControlPlaneRepository["completeProvisioning"]>[0];
type JoinCompletion = Parameters<HostedControlPlaneRepository["completeJoin"]>[0];
type ActionCompletion = Parameters<HostedControlPlaneRepository["completeAction"]>[0];

interface SnapshotWrite {
  snapshot: InstanceSnapshotDto;
  checkpoint?: SnapshotCheckpointRecord | null;
  joinTicket?: JoinTicketRecord;
}

interface GameplayRegistrationWrite {
  accountId: string;
  serverInstanceId: string;
  playerId: string;
  nowIso: string;
}

type HostedActionSnapshotFactory = (
  completion: Extract<PostgresHostedActionCompletionResult, { completed: true }>
) => SnapshotWrite | null | Promise<SnapshotWrite | null>;

export interface HostedRuntimeMutationCommitter {
  commitProvisioning(input: SnapshotWrite & {
    completion: ProvisioningCompletion;
    fence: RuntimeLeaseFence;
  }): Promise<boolean>;
  commitMembership(input: SnapshotWrite & {
    completion: MembershipJobCompletionInput;
    nextStatus: "active" | "left_early";
    revokePlayerId?: string;
    fence: RuntimeLeaseFence;
  }): Promise<boolean>;
  commitJoin(input: SnapshotWrite & {
    completion: JoinCompletion;
    registration: GameplayRegistrationWrite;
    fence: RuntimeLeaseFence;
  }): Promise<boolean>;
  commitAction(input: {
    completion: ActionCompletion;
    createSnapshotWrite: HostedActionSnapshotFactory;
    fence: RuntimeLeaseFence;
  }): Promise<boolean>;
}

export const createPostgresHostedRuntimeMutationCommitter = (
  database: PostgresDatabase,
  snapshotMetrics?: SnapshotPersistenceMetrics
): HostedRuntimeMutationCommitter => ({
  commitProvisioning: (input) => database.transaction(async (client) => {
    assertSameInstance(input.snapshot.instanceId, input.completion.serverInstanceId);
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, true);
    await lockPostgresServerInstanceRow(client, input.snapshot.instanceId);
    const completed = await completePostgresHostedProvisioningInTransaction(client, input.completion);
    if (!completed) return false;
    await saveSnapshotWrite(client, input, snapshotMetrics);
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, false);
    return true;
  }),
  commitMembership: (input) => database.transaction(async (client) => {
    assertSameInstance(input.snapshot.instanceId, input.completion.serverInstanceId);
    if (input.nextStatus === "active") {
      if (!input.joinTicket) throw new Error("An activation join ticket is required for an atomic membership commit.");
      assertTicketBinding(input.joinTicket, input.completion.serverInstanceId,
        input.completion.accountId, input.completion.joinTicketId);
    } else if (input.joinTicket) {
      throw new Error("An early-leave commit cannot persist a join ticket.");
    } else if (input.revokePlayerId !== createServerPlayerId(
      input.completion.serverInstanceId,
      input.completion.accountId
    )) {
      throw new Error("Membership session revocation player mismatch.");
    }
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, true);
    await lockPostgresServerInstanceRow(client, input.snapshot.instanceId);
    const completed = await completePostgresMembershipJobInTransaction(
      client,
      input.completion,
      input.nextStatus
    );
    if (!completed) return false;
    if (input.nextStatus === "active") {
      const savedTicket = await savePostgresJoinTicket(client, input.joinTicket!);
      assertTicketBinding(savedTicket, input.completion.serverInstanceId,
        input.completion.accountId, input.completion.joinTicketId);
      assertUsableTicketConflict(savedTicket, input.joinTicket!, input.completion.at);
    }
    if (input.nextStatus === "left_early") {
      if (!input.revokePlayerId) {
        throw new Error("A player id is required for an atomic early-leave session revocation.");
      }
      await revokePlayerGameplaySessions(client, input.revokePlayerId, input.completion.at);
    }
    await saveSnapshotWrite(client, input, snapshotMetrics);
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, false);
    return true;
  }),
  commitJoin: (input) => database.transaction(async (client) => {
    assertSameInstance(input.snapshot.instanceId, input.completion.serverInstanceId);
    assertSameInstance(input.completion.serverInstanceId, input.registration.serverInstanceId);
    assertSameAccount(input.completion.playerIdentityId, input.registration.accountId);
    if (!input.joinTicket) throw new Error("A join ticket is required for an atomic hosted join commit.");
    assertTicketBinding(input.joinTicket, input.completion.serverInstanceId,
      input.completion.playerIdentityId, input.completion.joinTicketId);
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, true);
    await lockPostgresServerInstanceRow(client, input.snapshot.instanceId);
    const completed = await completePostgresHostedJoinInTransaction(client, input.completion);
    if (!completed) return false;
    const registration = await getOrCreatePostgresGameplayRegistration(client, input.registration);
    if (registration.playerId !== input.registration.playerId
      || registration.serverInstanceId !== input.completion.serverInstanceId
      || registration.accountId !== input.completion.playerIdentityId) {
      throw new Error("Hosted join registration resolved to a different player.");
    }
    const savedTicket = await savePostgresJoinTicket(client, input.joinTicket);
    assertTicketBinding(savedTicket, input.completion.serverInstanceId,
      input.completion.playerIdentityId, input.completion.joinTicketId);
    assertUsableTicketConflict(savedTicket, input.joinTicket, input.completion.at);
    await saveSnapshotWrite(client, input, snapshotMetrics);
    await assertCurrentPostgresRuntimeLease(client, input.snapshot.instanceId, input.fence, false);
    return true;
  }),
  commitAction: (input) => database.transaction(async (client) => {
    const instanceId = input.completion.request.serverInstanceId;
    await assertCurrentPostgresRuntimeLease(client, instanceId, input.fence, true);
    await lockPostgresServerInstanceRow(client, instanceId);
    const completion = await completePostgresHostedActionInTransaction(client, input.completion);
    if (!completion.completed) return false;
    const snapshotWrite = await input.createSnapshotWrite(completion);
    if (snapshotWrite) {
      assertSameInstance(instanceId, snapshotWrite.snapshot.instanceId);
      await saveSnapshotWrite(client, snapshotWrite, snapshotMetrics);
    }
    await assertCurrentPostgresRuntimeLease(client, instanceId, input.fence, false);
    return true;
  })
});

const saveSnapshotWrite = async (
  client: PostgresQueryable,
  input: SnapshotWrite,
  snapshotMetrics?: SnapshotPersistenceMetrics
): Promise<void> => {
  const repository = createPostgresSnapshotRepositoryForTransaction(client, snapshotMetrics);
  await repository.saveRecoveryHead(input.snapshot);
  if (input.checkpoint) await repository.saveCheckpoint(input.checkpoint);
};

const assertSameInstance = (
  expectedInstanceId: string,
  actualInstanceId: string
): void => {
  if (expectedInstanceId !== actualInstanceId) {
    throw new Error(`Hosted mutation instance mismatch: expected ${expectedInstanceId}.`);
  }
};

const assertSameAccount = (expectedAccountId: string, actualAccountId: string): void => {
  if (expectedAccountId !== actualAccountId) {
    throw new Error("Hosted mutation account mismatch.");
  }
};

const assertTicketBinding = (
  ticket: JoinTicketRecord,
  serverInstanceId: string,
  accountId: string,
  ticketId: string | null
): void => {
  assertSameInstance(serverInstanceId, ticket.serverInstanceId);
  assertSameAccount(accountId, ticket.accountId);
  if (!ticketId || ticket.ticketId !== ticketId) {
    throw new Error("Hosted mutation join ticket mismatch.");
  }
};

const assertUsableTicketConflict = (
  saved: JoinTicketRecord,
  requested: JoinTicketRecord,
  at: string
): void => {
  if (saved.mode !== requested.mode
    || (saved.factionId ?? null) !== (requested.factionId ?? null)
    || saved.consumedAt !== null
    || Date.parse(saved.expiresAt) <= Date.parse(at)) {
    throw new Error("Hosted mutation join ticket conflicts with an unusable persisted ticket.");
  }
};
