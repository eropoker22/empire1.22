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
      mode: server.mode
    });
    if (!ensured.accepted) throw hostedMutationError("MEMBERSHIP_PLAYER_RESTORE_FAILED");
    runtime.state = ensured.state;
    if (existingPlayer.homeDistrictId !== membership.reservedSpawnDistrictId
      || existingPlayer.metadata?.membershipId !== membership.membershipId) {
      throw hostedMutationError("MEMBERSHIP_ACTIVATION_CONFLICT");
    }
    return ensured.stateChanged;
  }

  const created = ensureGameplaySliceMembershipInState(runtime.state, {
    serverInstanceId: membership.serverInstanceId,
    playerId: membership.playerId,
    factionId: membership.factionId,
    mode: server.mode
  });
  if (!created.accepted) throw hostedMutationError("MEMBERSHIP_PLAYER_CREATE_FAILED");
  runtime.state = created.state;
  const player = runtime.state.playersById[membership.playerId]!;
  runtime.state.playersById[membership.playerId] = {
    ...player,
    accountId: membership.accountId,
    name: membership.accountDisplayName || player.name,
    color: membership.gangColor as typeof player.color,
    metadata: {
      ...(player.metadata ?? {}),
      membershipId: membership.membershipId,
      avatarId: membership.avatarId,
      displayName: membership.accountDisplayName || player.name,
      gangName: membership.gangName || membership.accountDisplayName || player.name,
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
    mapRules: {
      isEnabledSpawnCandidate: (districtId) =>
        Boolean(findSharedCitySpawnCandidate(districtId)?.enabled)
    }
  });
  if (spawn.errors.length > 0) throw hostedMutationError("MEMBERSHIP_SPAWN_CLAIM_FAILED");
  runtime.state = spawn.nextState;
  return true;
};
