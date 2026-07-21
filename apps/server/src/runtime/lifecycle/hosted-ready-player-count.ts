export interface DurableReadyMembership {
  membershipId: string;
  playerId: string;
  reservedSpawnDistrictId: string;
}

export interface ReadyPlayerRuntimeState {
  playersById: Record<string, {
    status?: string;
    homeDistrictId?: string | null;
    accountId?: string | null;
    metadata?: Record<string, unknown> | null;
  } | undefined>;
  districtsById: Record<string, {
    ownerPlayerId?: string | null;
  } | undefined>;
}

export interface ReadyPlayerResolution {
  readyPlayerIds: string[];
  rejectedPlayerIds: string[];
  count: number;
}

export const resolveReadyPlayerCount = (
  memberships: readonly DurableReadyMembership[],
  runtimeState: ReadyPlayerRuntimeState
): ReadyPlayerResolution => {
  const readyPlayerIds: string[] = [];
  const rejectedPlayerIds: string[] = [];

  for (const membership of memberships) {
    const player = runtimeState.playersById[membership.playerId];
    const homeDistrict = runtimeState.districtsById[membership.reservedSpawnDistrictId];
    const metadata = player?.metadata ?? {};
    const ready = player?.status === "active"
      && Boolean(player.accountId)
      && player.homeDistrictId === membership.reservedSpawnDistrictId
      && homeDistrict?.ownerPlayerId === membership.playerId
      && metadata.membershipId === membership.membershipId
      && metadata.setupComplete === true
      && metadata.starterPackageApplied === true;
    (ready ? readyPlayerIds : rejectedPlayerIds).push(membership.playerId);
  }

  return {
    readyPlayerIds,
    rejectedPlayerIds,
    count: readyPlayerIds.length
  };
};
