import type { PostgresDatabase } from "../../runtime/persistence/postgres";
import type {
  HostedControlPlaneRepository,
  HostedJoinJobRecord,
  HostedJoinReservationRecord,
  HostedJoinReservationResult
} from "./hosted-control-plane-repository";

type JoinMethods = Pick<HostedControlPlaneRepository,
  "getJoinReservation" | "getJoinReservationByIdempotency" | "reserveJoinTransaction" |
  "claimJoinJob" | "completeJoin" | "failJoin" | "expireJoinReservations" | "getJoinCapacity">;

interface ReservationRow extends Record<string, unknown> { [key: string]: unknown }
interface JoinJobRow extends Record<string, unknown> { [key: string]: unknown }

export const createPostgresHostedJoinRepository = (database: PostgresDatabase): JoinMethods => ({
  getJoinReservation: async (reservationId) => {
    const result = await database.query<ReservationRow>(`${RESERVATION_SELECT} WHERE reservation_id=$1`, [reservationId]);
    return result.rows[0] ? mapReservation(result.rows[0]) : null;
  },
  getJoinReservationByIdempotency: async (playerIdentityId, idempotencyKey) => {
    const result = await database.query<ReservationRow>(
      `${RESERVATION_SELECT} WHERE player_identity_id=$1 AND idempotency_key=$2`,
      [playerIdentityId, idempotencyKey]
    );
    return result.rows[0] ? mapReservation(result.rows[0]) : null;
  },
  reserveJoinTransaction: (input) => database.transaction(async (client) => {
    const replay = await client.query<ReservationRow>(
      `${RESERVATION_SELECT} WHERE player_identity_id=$1 AND idempotency_key=$2`,
      [input.reservation.playerIdentityId, input.reservation.idempotencyKey]
    );
    if (replay.rows[0]) {
      const reservation = mapReservation(replay.rows[0]);
      if (reservation.serverInstanceId !== input.reservation.serverInstanceId || reservation.requestHash !== input.reservation.requestHash) {
        return { kind: "conflict" } satisfies HostedJoinReservationResult;
      }
      return { kind: "replayed", reservation, job: await loadJob(client, reservation.reservationId) } satisfies HostedJoinReservationResult;
    }

    const server = await client.query<{ version: string | number; capacity: number; status: string; join_policy: string; provisioning_state: string }>(
      `SELECT version,capacity,status,join_policy,provisioning_state
       FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`,
      [input.reservation.serverInstanceId]
    );
    const hosted = server.rows[0];
    if (!hosted) return { kind: "not-found" } satisfies HostedJoinReservationResult;

    await client.query(
      `UPDATE empire_hosted_join_reservations SET status='expired',updated_at=$2::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND status='reserved' AND expires_at <= $2::timestamptz`,
      [input.reservation.serverInstanceId, input.reservation.createdAt]
    );
    const active = await client.query<ReservationRow>(
      `${RESERVATION_SELECT} WHERE server_instance_id=$1 AND player_identity_id=$2 AND status IN ('reserved','committed')`,
      [input.reservation.serverInstanceId, input.reservation.playerIdentityId]
    );
    if (active.rows[0]) {
      const reservation = mapReservation(active.rows[0]);
      return { kind: "replayed", reservation, job: await loadJob(client, reservation.reservationId) } satisfies HostedJoinReservationResult;
    }
    if (Number(hosted.version) !== input.reservation.expectedServerVersion) {
      return { kind: "stale-version" } satisfies HostedJoinReservationResult;
    }
    if (hosted.provisioning_state !== "ready" || hosted.join_policy !== "open" || !["lobby", "running"].includes(hosted.status)) {
      return { kind: "not-joinable" } satisfies HostedJoinReservationResult;
    }
    const capacity = await client.query<{ committed_players: string | number; reserved_slots: string | number }>(
      `SELECT
        (SELECT count(*) FROM (
          SELECT account_id AS identity FROM empire_server_memberships
            WHERE server_instance_id=$1 AND status IN ('setup_required','finalizing_setup','active','leave_pending','defeated')
          UNION
          SELECT account_id AS identity FROM empire_player_registrations
            WHERE server_instance_id=$1 AND status='active' AND account_id IS NOT NULL
        ) occupied) AS committed_players,
        (SELECT count(*) FROM empire_hosted_join_reservations
          WHERE server_instance_id=$1 AND status='reserved' AND expires_at > $2::timestamptz) AS reserved_slots`,
      [input.reservation.serverInstanceId, input.reservation.createdAt]
    );
    const committedPlayers = Number(capacity.rows[0]?.committed_players ?? 0);
    const reservedSlots = Number(capacity.rows[0]?.reserved_slots ?? 0);
    if (committedPlayers + reservedSlots >= Number(hosted.capacity)) {
      return { kind: "server-full" } satisfies HostedJoinReservationResult;
    }
    const reservation = { ...input.reservation, reservedSlot: committedPlayers + reservedSlots + 1 };
    await client.query(
      `INSERT INTO empire_hosted_join_reservations
       (id,reservation_id,server_instance_id,player_identity_id,status,idempotency_key,request_hash,
        expected_server_version,reserved_slot,faction_id,join_ticket_id,expires_at,created_at,committed_at,
        canceled_at,updated_at,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::timestamptz,$14::timestamptz,
        $15::timestamptz,$16::timestamptz,$17)`,
      [`hosted-join:${reservation.reservationId}`, reservation.reservationId, reservation.serverInstanceId,
        reservation.playerIdentityId, reservation.status, reservation.idempotencyKey, reservation.requestHash,
        reservation.expectedServerVersion, reservation.reservedSlot, reservation.factionId, reservation.joinTicketId,
        reservation.expiresAt, reservation.createdAt, reservation.committedAt, reservation.canceledAt,
        reservation.updatedAt, reservation.version]
    );
    await client.query(
      `INSERT INTO empire_hosted_join_jobs
       (id,job_id,reservation_id,server_instance_id,status,attempt,available_at,claimed_by_worker_id,
        claimed_until,last_error_code,created_at,updated_at,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::timestamptz,$10,$11::timestamptz,$12::timestamptz,$13)`,
      [`hosted-join-job:${input.job.jobId}`, input.job.jobId, reservation.reservationId, reservation.serverInstanceId,
        input.job.status, input.job.attempt, input.job.availableAt, input.job.claimedByWorkerId,
        input.job.claimedUntil, input.job.lastErrorCode, input.job.createdAt, input.job.updatedAt, input.job.version]
    );
    return { kind: "created", reservation, job: input.job } satisfies HostedJoinReservationResult;
  }),
  claimJoinJob: async (workerId, now, claimedUntil) => {
    const result = await database.query<JoinJobRow>(
      `WITH candidate AS (
         SELECT job.job_id FROM empire_hosted_join_jobs job
         JOIN empire_hosted_join_reservations reservation ON reservation.reservation_id=job.reservation_id
         WHERE (job.status='pending' OR (job.status='claimed' AND job.claimed_until <= $2::timestamptz))
           AND job.available_at <= $2::timestamptz AND reservation.status='reserved'
           AND reservation.expires_at > $2::timestamptz
         ORDER BY job.available_at,job.created_at FOR UPDATE OF job SKIP LOCKED LIMIT 1
       ) UPDATE empire_hosted_join_jobs job SET status='claimed',claimed_by_worker_id=$1,
         claimed_until=$3::timestamptz,attempt=attempt+1,updated_at=$2::timestamptz,version=version+1
       FROM candidate WHERE job.job_id=candidate.job_id RETURNING ${qualify("job", JOB_COLUMNS)}`,
      [workerId, now, claimedUntil]
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  },
  completeJoin: (input) => database.transaction(async (client) => {
    const result = await client.query<ReservationRow>(
      `${RESERVATION_SELECT} WHERE reservation_id=$1 FOR UPDATE`, [input.reservationId]);
    if (!result.rows[0]) return false;
    const reservation = mapReservation(result.rows[0]);
    if (reservation.status === "committed" && reservation.joinTicketId === input.joinTicketId) {
      await completeJob(client, input.jobId, input.workerId, input.at);
      return true;
    }
    if (reservation.status !== "reserved" || Date.parse(reservation.expiresAt) <= Date.parse(input.at)) return false;
    const changed = await client.query(
      `UPDATE empire_hosted_join_reservations SET status='committed',join_ticket_id=$2,
       committed_at=$3::timestamptz,updated_at=$3::timestamptz,version=version+1
       WHERE reservation_id=$1 AND status='reserved' RETURNING reservation_id`,
      [input.reservationId, input.joinTicketId, input.at]
    );
    if ((changed.rowCount ?? 0) === 0) return false;
    await completeJob(client, input.jobId, input.workerId, input.at);
    return true;
  }),
  failJoin: (input) => database.transaction(async (client) => {
    await client.query(
      `UPDATE empire_hosted_join_reservations SET status=$2,
       canceled_at=CASE WHEN $2='expired' THEN canceled_at ELSE $4::timestamptz END,
       updated_at=$4::timestamptz,version=version+1
       WHERE reservation_id=$1 AND status <> 'committed'`,
      [input.reservationId, input.status, input.errorCode, input.at]
    );
    await client.query(
      `UPDATE empire_hosted_join_jobs SET status='failed',claimed_until=NULL,last_error_code=$3,
       updated_at=$4::timestamptz,version=version+1
       WHERE job_id=$1 AND (claimed_by_worker_id=$2 OR claimed_by_worker_id IS NULL) AND status <> 'completed'`,
      [input.jobId, input.workerId, input.errorCode, input.at]
    );
  }),
  expireJoinReservations: async (at) => {
    const result = await database.query(
      `WITH expired AS (
         UPDATE empire_hosted_join_reservations SET status='expired',updated_at=$1::timestamptz,version=version+1
         WHERE status='reserved' AND expires_at <= $1::timestamptz RETURNING reservation_id
       ) UPDATE empire_hosted_join_jobs job SET status='failed',claimed_until=NULL,last_error_code='JOIN_RESERVATION_EXPIRED',
         updated_at=$1::timestamptz,version=version+1 FROM expired
       WHERE job.reservation_id=expired.reservation_id AND job.status <> 'completed' RETURNING job.job_id`,
      [at]
    );
    return result.rowCount ?? 0;
  },
  getJoinCapacity: async (serverInstanceId, at) => {
    const result = await database.query<{ committed_players: string | number; reserved_slots: string | number }>(
      `SELECT
        (SELECT count(*) FROM (
          SELECT account_id AS identity FROM empire_server_memberships
            WHERE server_instance_id=$1 AND status IN ('setup_required','finalizing_setup','active','leave_pending','defeated')
          UNION
          SELECT account_id AS identity FROM empire_player_registrations
            WHERE server_instance_id=$1 AND status='active' AND account_id IS NOT NULL
        ) occupied) AS committed_players,
        (SELECT count(*) FROM empire_hosted_join_reservations
          WHERE server_instance_id=$1 AND status='reserved' AND expires_at > $2::timestamptz) AS reserved_slots`,
      [serverInstanceId, at]
    );
    return {
      committedPlayers: Number(result.rows[0]?.committed_players ?? 0),
      reservedSlots: Number(result.rows[0]?.reserved_slots ?? 0)
    };
  }
});

const loadJob = async (client: { query<T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> }, reservationId: string) => {
  const result = await client.query<JoinJobRow>(`${JOB_SELECT} WHERE reservation_id=$1`, [reservationId]);
  return result.rows[0] ? mapJob(result.rows[0]) : null;
};

const completeJob = async (
  client: { query(sql: string, params?: readonly unknown[]): Promise<unknown> },
  jobId: string,
  workerId: string,
  at: string
) => {
  await client.query(
    `UPDATE empire_hosted_join_jobs SET status='completed',claimed_until=NULL,last_error_code=NULL,
     updated_at=$3::timestamptz,version=version+1
     WHERE job_id=$1 AND claimed_by_worker_id=$2`,
    [jobId, workerId, at]
  );
};

const mapReservation = (row: ReservationRow): HostedJoinReservationRecord => ({
  reservationId: String(row.reservation_id),
  serverInstanceId: String(row.server_instance_id),
  playerIdentityId: String(row.player_identity_id),
  status: row.status as HostedJoinReservationRecord["status"],
  idempotencyKey: String(row.idempotency_key),
  requestHash: String(row.request_hash),
  expectedServerVersion: Number(row.expected_server_version),
  reservedSlot: Number(row.reserved_slot),
  factionId: nullable(row.faction_id),
  joinTicketId: nullable(row.join_ticket_id),
  expiresAt: iso(row.expires_at),
  createdAt: iso(row.created_at),
  committedAt: isoOrNull(row.committed_at),
  canceledAt: isoOrNull(row.canceled_at),
  updatedAt: iso(row.updated_at),
  version: Number(row.version)
});

const mapJob = (row: JoinJobRow): HostedJoinJobRecord => ({
  jobId: String(row.job_id),
  reservationId: String(row.reservation_id),
  serverInstanceId: String(row.server_instance_id),
  status: row.status as HostedJoinJobRecord["status"],
  attempt: Number(row.attempt),
  availableAt: iso(row.available_at),
  claimedByWorkerId: nullable(row.claimed_by_worker_id),
  claimedUntil: isoOrNull(row.claimed_until),
  lastErrorCode: nullable(row.last_error_code),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  version: Number(row.version)
});

const RESERVATION_COLUMNS = `reservation_id,server_instance_id,player_identity_id,status,idempotency_key,request_hash,
  expected_server_version,reserved_slot,faction_id,join_ticket_id,expires_at,created_at,committed_at,canceled_at,updated_at,version`;
const RESERVATION_SELECT = `SELECT ${RESERVATION_COLUMNS} FROM empire_hosted_join_reservations`;
const JOB_COLUMNS = `job_id,reservation_id,server_instance_id,status,attempt,available_at,claimed_by_worker_id,
  claimed_until,last_error_code,created_at,updated_at,version`;
const JOB_SELECT = `SELECT ${JOB_COLUMNS} FROM empire_hosted_join_jobs`;
const qualify = (alias: string, columns: string) => columns.split(",").map((column) => `${alias}.${column.trim()}`).join(",");
const nullable = (value: unknown): string | null => value == null ? null : String(value);
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => value == null ? null : iso(value);
