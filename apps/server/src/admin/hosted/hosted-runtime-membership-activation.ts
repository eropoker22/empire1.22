import { handleSelectSpawnDistrict } from "@empire/game-core";
import { ensureGameplaySliceMembershipInState } from "../../bootstrap/gameplay-slice-session-membership";
import { findSharedCitySpawnCandidate } from "../../bootstrap/gameplay-slice-shared-city-seed";
import type { PostgresPlayerEntryRepository } from "../../player-entry/postgres-player-entry-repository";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import type { HostedServerRecord } from "./hosted-control-plane-repository";
import { hostedMutationError } from "./hosted-runtime-player-mutation-context";

export type HostedMembershipRecord = NonNullable<
  Awaited<ReturnType<PostgresPlayerEntryRepository["getMembership"]>>
>;

export const applyHostedMembershipActivation = (
  runtime: ServerInstanceRuntime,
  server: HostedServerRecord,
  membership: HostedMembershipRecord,
  claimedAt: Date
): boolean => {
  const existingPlayer = runtime.state.playersById[membership.playerId];
  if (existingPlayer) {
    const ensured = ensureGameplaySliceMembershipInState(runtime.state, {
      serverInstanceId: membership.serverInstanceId,
      playerId: membership.playerId,
      factionId: membership.factionId,
      mode: server.mode,
      startingPlayerState: server.startingPlayerState
    });
    if (!ensured.accepted) throw hostedMutationError("MEMBERSHIP_PLAYER_RESTORE_FAILED");
    runtime.state = ensured.state;
    if (existingPlayer.homeDistrictId !== membership.reservedSpawnDistrictId
      || existingPlayer.metadata?.membershipId !== membership.membershipId) {
      throw hostedMutationError("MEMBERSHIP_ACTIVATION_CONFLICT");
    }
    return syncHostedMembershipPlayerIdentity(runtime, membership) || ensured.stateChanged;
  }

  const created = ensureGameplaySliceMembershipInState(runtime.state, {
    serverInstanceId: membership.serverInstanceId,
    playerId: membership.playerId,
    factionId: membership.factionId,
    mode: server.mode,
    startingPlayerState: server.startingPlayerState
  });
  if (!created.accepted) throw hostedMutationError("MEMBERSHIP_PLAYER_CREATE_FAILED");
  runtime.state = created.state;
  syncHostedMembershipPlayerIdentity(runtime, membership);
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
    mapRules: {
      isEnabledSpawnCandidate: (districtId) =>
        Boolean(findSharedCitySpawnCandidate(districtId)?.enabled)
    }
  });
  if (spawn.errors.length > 0) throw hostedMutationError("MEMBERSHIP_SPAWN_CLAIM_FAILED");
  runtime.state = spawn.nextState;
  return true;
};

const syncHostedMembershipPlayerIdentity = (
  runtime: ServerInstanceRuntime,
  membership: HostedMembershipRecord
): boolean => {
  const player = runtime.state.playersById[membership.playerId];
  if (!player) throw hostedMutationError("MEMBERSHIP_PLAYER_MISSING");

  const name = membership.accountDisplayName || player.name;
  const gangName = membership.gangName || name;
  const color = membership.gangColor as typeof player.color;
  const changed = player.accountId !== membership.accountId
    || player.name !== name
    || player.color !== color
    || player.metadata?.membershipId !== membership.membershipId
    || player.metadata?.avatarId !== membership.avatarId
    || player.metadata?.displayName !== name
    || player.metadata?.gangName !== gangName
    || player.metadata?.setupComplete !== true
    || player.metadata?.starterPackageApplied !== true;
  if (!changed) return false;

  runtime.state.playersById[membership.playerId] = {
    ...player,
    accountId: membership.accountId,
    name,
    color,
    version: player.version + 1,
    metadata: {
      ...(player.metadata ?? {}),
      membershipId: membership.membershipId,
      avatarId: membership.avatarId,
      displayName: name,
      gangName,
      setupComplete: true,
      starterPackageApplied: true
    }
  };
  runtime.state.root = {
    ...runtime.state.root,
    version: runtime.state.root.version + 1
  };
  return true;
};
