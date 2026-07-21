import type {
  AdminInstanceSummaryView,
  HostedServerRegistrationReasonCode,
  LobbyServerSummaryView
} from "@empire/shared-types";
import type { AdminDurableRepositories } from "../admin/read-only";
import {
  HOSTED_WORKER_FRESH_MS,
  resolveHostedServerRegistrationState,
  type HostedServerRecord
} from "../admin/hosted";

export interface HostedPublicServerView extends LobbyServerSummaryView {
  playerCount: number;
  currentTick: number | null;
  map: {
    totalDistricts: number;
    downtownDistricts: number;
    commercialDistricts: number;
    industrialDistricts: number;
    residentialDistricts: number;
    parkDistricts: number;
  };
}

export interface HostedPublicServerProjection {
  hosted: HostedServerRecord;
  summary: AdminInstanceSummaryView | null;
  view: HostedPublicServerView;
}

export interface HostedPublicServerCandidate extends HostedPublicServerProjection {
  summary: AdminInstanceSummaryView;
  view: HostedPublicServerView & { joinable: true };
}

export const listHostedPublicServers = async (
  repositories: AdminDurableRepositories,
  now = new Date()
): Promise<HostedPublicServerProjection[]> => {
  if (repositories.kind !== "postgres") {
    throw new Error("Hosted public server reads require PostgreSQL.");
  }

  const [hostedServers, summaries] = await Promise.all([
    repositories.hosted.listServers(),
    repositories.monitoring.listKnownInstances()
  ]);
  const summaryById = new Map(summaries.map((entry) => [entry.serverInstanceId, entry]));
  return Promise.all(hostedServers.map(async (hosted) => {
    const summary = summaryById.get(hosted.serverInstanceId) ?? null;
    const [capacity, readyMemberships] = await Promise.all([
      repositories.hosted.getJoinCapacity(hosted.serverInstanceId, now.toISOString()),
      repositories.hosted.listReadyMemberships(hosted.serverInstanceId)
    ]);
    return {
      hosted,
      summary,
      view: createHostedPublicServerView(hosted, summary, capacity, readyMemberships.length, now)
    };
  }));
};

export const listHostedPublicServerCandidates = async (
  repositories: AdminDurableRepositories,
  now = new Date()
): Promise<HostedPublicServerCandidate[]> =>
  selectHostedPublicServerCandidates(await listHostedPublicServers(repositories, now));

export const selectHostedPublicServerCandidates = (
  projections: HostedPublicServerProjection[]
): HostedPublicServerCandidate[] => projections.filter(isHostedPublicServerCandidate);

const createHostedPublicServerView = (
  hosted: HostedServerRecord,
  summary: AdminInstanceSummaryView | null,
  capacity: { committedPlayers: number; reservedSlots: number },
  readyPlayers: number,
  now: Date
): HostedPublicServerView => {
  const registration = resolveHostedServerRegistrationState({
    registrationOpensAt: hosted.registrationOpensAt,
    registrationClosesAt: hosted.registrationClosesAt,
    registrationClosedAt: hosted.registrationClosedAt,
    registrationWindowMinutes: hosted.registrationWindowMinutes
  }, now);
  const playerCount = Math.max(summary?.playerCount ?? 0, capacity.committedPlayers);
  const full = playerCount + capacity.reservedSlots >= hosted.capacity;
  const snapshotReady = Boolean(hosted.currentSnapshotId) && summary?.snapshotStale !== true;
  const workerFresh = isHostedWorkerFresh(hosted, summary, now);
  const playable = hosted.status === "lobby" || hosted.status === "running";
  const joinable = hosted.provisioningState === "ready"
    && playable
    && registration.canCreateMembership
    && snapshotReady
    && workerFresh
    && !full;
  const canStart = hosted.provisioningState === "ready"
    && hosted.status === "lobby"
    && snapshotReady
    && workerFresh
    && !["not_scheduled", "scheduled", "closed_early"].includes(registration.state)
    && readyPlayers >= hosted.minimumReadyPlayersToStart;

  return {
    serverInstanceId: hosted.serverInstanceId,
    displayName: hosted.displayName,
    mode: hosted.mode,
    region: hosted.region,
    status: hosted.status,
    joinPolicy: hosted.joinPolicy,
    provisioningState: hosted.provisioningState,
    capacity: hosted.capacity,
    committedPlayers: capacity.committedPlayers,
    reservedSlots: capacity.reservedSlots,
    readyPlayers,
    minimumReadyPlayersToStart: hosted.minimumReadyPlayersToStart,
    registrationState: registration.state,
    registrationOpensAt: registration.opensAt,
    registrationClosesAt: registration.closesAt,
    registrationClosedAt: registration.closedAt,
    registrationRemainingMs: registration.remainingMs,
    registrationReasonCode: registration.reasonCode,
    canStart,
    joinable,
    disabledReason: joinable ? null : resolveDisabledReason(hosted, registration.reasonCode, playable,
      snapshotReady, workerFresh, full),
    startedAt: hosted.lastStartedAt,
    generatedAt: now.toISOString(),
    playerCount,
    currentTick: summary?.currentTick ?? null,
    map: createMapView(hosted)
  };
};

const isHostedWorkerFresh = (
  hosted: HostedServerRecord,
  summary: AdminInstanceSummaryView | null,
  now: Date
): boolean => {
  const heartbeatAt = hosted.lastWorkerHeartbeatAt ? Date.parse(hosted.lastWorkerHeartbeatAt) : Number.NaN;
  const leaseExpiresAt = hosted.runtimeLeaseExpiresAt ? Date.parse(hosted.runtimeLeaseExpiresAt) : Number.NaN;
  return summary?.workerStatus === "live"
    && Boolean(hosted.runtimeLeaseOwnerId)
    && Number.isFinite(heartbeatAt)
    && now.getTime() - heartbeatAt <= HOSTED_WORKER_FRESH_MS
    && Number.isFinite(leaseExpiresAt)
    && leaseExpiresAt > now.getTime();
};

const resolveDisabledReason = (
  hosted: HostedServerRecord,
  registrationReason: HostedServerRegistrationReasonCode | null,
  playable: boolean,
  snapshotReady: boolean,
  workerFresh: boolean,
  full: boolean
): string => hosted.provisioningState !== "ready" ? "SERVER_PREPARING"
  : registrationReason ?? (!playable ? "SERVER_NOT_PLAYABLE"
    : !snapshotReady ? "SERVER_START_SNAPSHOT_MISSING"
      : !workerFresh ? "WORKER_OFFLINE"
        : full ? "SERVER_FULL" : "SERVER_UNAVAILABLE");

const createMapView = (hosted: HostedServerRecord): HostedPublicServerView["map"] => ({
  totalDistricts: hosted.mapComposition.downtown + hosted.mapComposition.commercial
    + hosted.mapComposition.industrial + hosted.mapComposition.residential + hosted.mapComposition.park,
  downtownDistricts: hosted.mapComposition.downtown,
  commercialDistricts: hosted.mapComposition.commercial,
  industrialDistricts: hosted.mapComposition.industrial,
  residentialDistricts: hosted.mapComposition.residential,
  parkDistricts: hosted.mapComposition.park
});

const isHostedPublicServerCandidate = (
  projection: HostedPublicServerProjection
): projection is HostedPublicServerCandidate => projection.view.joinable && projection.summary !== null;
