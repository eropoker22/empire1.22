import type {
  HostedServerRegistrationReasonCode,
  LobbyServerSummaryView,
  SpawnDistrictSelectionView
} from "@empire/shared-types";
import { findSharedCitySpawnCandidate } from "../bootstrap/gameplay-slice-shared-city-seed";
import { resolveHostedServerRegistrationState } from "../admin/hosted/hosted-server-registration-state";
import type { PostgresQueryable } from "../runtime/persistence/postgres";
import { listHostedReadyMemberships } from "../runtime/persistence/postgres/hosted-ready-membership-query";
import { entryError } from "./player-entry-error";
import { hashEntryRequest } from "./player-entry-policy";
import {
  getHostedOccupancy,
  HOSTED_PLAYER_ENTRY_SERVER_COLUMNS,
  PLAYER_ENTRY_BLOCKING_STATUSES,
  type HostedPlayerEntryServerRow
} from "./postgres-player-entry-server-query";

interface SnapshotDistrict {
  id: unknown;
  name?: unknown;
  zone?: unknown;
  status?: unknown;
  ownerPlayerId?: unknown;
  lockdownUntilTick?: unknown;
  buildingIds?: unknown[];
  adjacentDistrictIds?: unknown[];
  version?: unknown;
}

interface SnapshotPayload {
  state?: { districtsById?: Record<string, SnapshotDistrict> };
}

export const createLobbyServerSummary = async (
  database: PostgresQueryable,
  server: HostedPlayerEntryServerRow,
  now: Date,
  workerFreshMs: number
): Promise<LobbyServerSummaryView> => {
  const serverInstanceId = String(server.server_instance_id);
  const occupancy = await getHostedOccupancy(database, serverInstanceId, now.toISOString());
  const readyPlayers = (await listHostedReadyMemberships(database, serverInstanceId)).length;
  const registration = registrationFor(server, now);
  const workerFresh = isWorkerFresh(server, now, workerFreshMs);
  const playable = ["lobby", "running"].includes(String(server.status));
  const full = occupancy.committedPlayers + occupancy.reservedSlots >= Number(server.capacity);
  const snapshotReady = Boolean(server.current_snapshot_id);
  const joinable = server.provisioning_state === "ready" && playable && snapshotReady && workerFresh
    && registration.canCreateMembership && !full;
  return {
    serverInstanceId,
    displayName: String(server.display_name),
    mode: server.mode as "free" | "war",
    region: String(server.region),
    status: String(server.status),
    joinPolicy: String(server.join_policy),
    provisioningState: String(server.provisioning_state),
    capacity: Number(server.capacity),
    ...occupancy,
    readyPlayers,
    minimumReadyPlayersToStart: Number(server.minimum_ready_players_to_start),
    registrationState: registration.state,
    registrationOpensAt: registration.opensAt,
    registrationClosesAt: registration.closesAt,
    registrationClosedAt: registration.closedAt,
    registrationRemainingMs: registration.remainingMs,
    registrationReasonCode: registration.reasonCode,
    canStart: canStart(server, registration.state, readyPlayers, workerFresh, snapshotReady),
    joinable,
    disabledReason: joinable ? null : disabledReason(server, registration.reasonCode, workerFresh, snapshotReady, full),
    startedAt: isoOrNull(server.last_started_at),
    generatedAt: now.toISOString()
  };
};

export const loadHostedSpawnSelection = async (
  database: PostgresQueryable,
  accountId: string,
  serverInstanceId: string,
  now: Date,
  workerFreshMs: number,
  lockedServer?: HostedPlayerEntryServerRow
): Promise<SpawnDistrictSelectionView> => {
  const serverResult = lockedServer ? null : await database.query<HostedPlayerEntryServerRow>(
    `SELECT ${HOSTED_PLAYER_ENTRY_SERVER_COLUMNS} FROM empire_hosted_server_instances WHERE server_instance_id=$1`,
    [serverInstanceId]
  );
  const server = lockedServer ?? serverResult?.rows[0];
  if (!server) throw entryError("SERVER_NOT_FOUND", "Server nebyl nalezen.");
  const registration = registrationFor(server, now);
  if (!registration.canCreateMembership) throw registrationError(registration.reasonCode);
  const workerFresh = isWorkerFresh(server, now, workerFreshMs);
  if (server.provisioning_state !== "ready" || !["lobby", "running"].includes(String(server.status))
    || !workerFresh || !server.current_snapshot_id) {
    throw entryError("SERVER_OFFLINE", "Server teď není dostupný. Tvoje předchozí membershipy zůstávají zachované.");
  }
  const snapshot = await database.query<{ snapshot_id: string; payload: SnapshotPayload }>(
    "SELECT snapshot_id,payload FROM empire_snapshot_latest WHERE server_instance_id=$1",
    [serverInstanceId]
  );
  const latest = snapshot.rows[0];
  if (!latest?.payload?.state) throw entryError("SERVER_OFFLINE", "Server zatím nemá dostupný snapshot.");
  const blocking = await database.query<{ count: string | number }>(
    "SELECT count(*)::int AS count FROM empire_server_memberships WHERE account_id=$1 AND status=ANY($2::text[])",
    [accountId, PLAYER_ENTRY_BLOCKING_STATUSES]
  );
  const occupancy = await getHostedOccupancy(database, serverInstanceId, now.toISOString());
  const readyPlayers = (await listHostedReadyMemberships(database, serverInstanceId)).length;
  const reserved = await database.query<{ district_id: string }>(
    `SELECT reserved_spawn_district_id AS district_id FROM empire_server_memberships
     WHERE server_instance_id=$1 AND status=ANY($2::text[])`,
    [serverInstanceId, PLAYER_ENTRY_BLOCKING_STATUSES]
  );
  const reservedIds = new Set(reserved.rows.map((row) => String(row.district_id)));
  const districts = Object.values(latest.payload.state.districtsById ?? {})
    .filter((district): district is SnapshotDistrict => Boolean(district && findSharedCitySpawnCandidate(String(district.id))?.enabled))
    .map((district) => {
      const reason = district.zone === "downtown" ? "DOWNTOWN"
        : district.ownerPlayerId ? "OWNED"
        : reservedIds.has(String(district.id)) ? "RESERVED"
        : district.status !== "neutral" ? String(district.status).toUpperCase()
        : district.lockdownUntilTick ? "LOCKDOWN"
        : null;
      return {
        districtId: String(district.id),
        zone: String(district.zone),
        label: String(district.name || district.id),
        available: reason === null,
        disabledReason: reason,
        buildingPreview: (district.buildingIds ?? []).slice(0, 3).map(String),
        neighboringDistrictCount: (district.adjacentDistrictIds ?? []).length,
        spawnCategory: String(findSharedCitySpawnCandidate(String(district.id))?.zones[0] ?? "edge"),
        version: Number(district.version ?? 1)
      };
    });
  const availabilityRevision = hashEntryRequest({
    serverVersion: Number(server.version),
    registrationState: registration.state,
    registrationClosesAt: registration.closesAt,
    reserved: [...reservedIds].sort(),
    committedPlayers: occupancy.committedPlayers,
    reservedSlots: occupancy.reservedSlots,
    districts: districts.map(({ districtId, available, disabledReason: reason, version }) => ({ districtId, available, disabledReason: reason, version }))
  });
  const minimumReadyPlayersToStart = Number(server.minimum_ready_players_to_start);
  return {
    serverInstanceId,
    membershipEligibility: Number(blocking.rows[0]?.count ?? 0) === 0 ? "eligible" : "blocked",
    capacity: { ...occupancy, maximum: Number(server.capacity) },
    serverStatus: String(server.status),
    joinPolicy: String(server.join_policy),
    readyPlayers,
    minimumReadyPlayersToStart,
    registrationState: registration.state,
    registrationOpensAt: registration.opensAt,
    registrationClosesAt: registration.closesAt,
    registrationClosedAt: registration.closedAt,
    registrationRemainingMs: registration.remainingMs,
    registrationReasonCode: registration.reasonCode,
    canStart: String(server.status) === "lobby" && readyPlayers >= minimumReadyPlayersToStart,
    joinable: true,
    disabledReason: null,
    generatedAt: now.toISOString(),
    availabilityRevision,
    districts
  };
};

const registrationFor = (server: HostedPlayerEntryServerRow, now: Date) => resolveHostedServerRegistrationState({
  registrationOpensAt: isoOrNull(server.registration_opens_at),
  registrationClosesAt: isoOrNull(server.registration_closes_at),
  registrationClosedAt: isoOrNull(server.registration_closed_at),
  registrationWindowMinutes: Number(server.registration_window_minutes)
}, now);

const isWorkerFresh = (server: HostedPlayerEntryServerRow, now: Date, workerFreshMs: number): boolean =>
  Boolean(server.last_worker_heartbeat_at)
  && Date.parse(iso(server.last_worker_heartbeat_at)) > now.getTime() - workerFreshMs
  && Boolean(server.runtime_lease_expires_at)
  && Date.parse(iso(server.runtime_lease_expires_at)) > now.getTime();

const canStart = (
  server: HostedPlayerEntryServerRow,
  registrationState: string,
  readyPlayers: number,
  workerFresh: boolean,
  snapshotReady: boolean
): boolean => server.provisioning_state === "ready" && server.status === "lobby" && workerFresh && snapshotReady
  && registrationState !== "not_scheduled" && registrationState !== "scheduled" && registrationState !== "closed_early"
  && readyPlayers >= Number(server.minimum_ready_players_to_start);

const disabledReason = (
  server: HostedPlayerEntryServerRow,
  registrationReasonCode: HostedServerRegistrationReasonCode | null,
  workerFresh: boolean,
  snapshotReady: boolean,
  full: boolean
): string => server.provisioning_state !== "ready" ? "SERVER_PREPARING"
  : registrationReasonCode ?? (!workerFresh ? "WORKER_OFFLINE"
    : !snapshotReady ? "SERVER_START_SNAPSHOT_MISSING"
      : !["lobby", "running"].includes(String(server.status)) ? "SERVER_NOT_PLAYABLE"
        : full ? "SERVER_FULL" : "SERVER_UNAVAILABLE");

const registrationError = (code: HostedServerRegistrationReasonCode | null): Error => {
  if (code === "SERVER_REGISTRATION_NOT_OPEN" || code === "SERVER_REGISTRATION_NOT_SCHEDULED") {
    return entryError(code, "Registrace na tento server ještě nezačala.");
  }
  if (code === "SERVER_REGISTRATION_CLOSED_EARLY") {
    return entryError(code, "Registrace na tento server byla bezpečnostně uzavřena.");
  }
  return entryError("SERVER_REGISTRATION_CLOSED", "Registrační okno tohoto serveru už skončilo.");
};

const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => value == null ? null : iso(value);
