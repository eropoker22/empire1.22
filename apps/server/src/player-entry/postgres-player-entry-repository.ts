import * as crypto from "node:crypto";
import type {
  AccountSessionView,
  ConfirmSpawnDistrictRequest,
  FinalizeServerSetupRequest,
  LobbyOverviewView,
  ServerMembershipStatus,
  ServerMembershipView,
  SpawnDistrictSelectionView
} from "@empire/shared-types";
import type { PostgresDatabase, PostgresQueryable } from "../runtime/persistence/postgres";
import { hashAccountPassword, verifyAccountPassword, type AccountPasswordRecord } from "./account-password";
import { entryError, entryErrorCode } from "./player-entry-error";
import {
  createServerPlayerId,
  hashEntryRequest,
  isPlayerAvatar,
  isPlayerFaction,
  isPlayerGangColor,
  normalizePlayerUsername,
  PLAYER_ENTRY_POLICY,
  validGangName,
  validPlayerUsername
} from "./player-entry-policy";
import { createLobbyServerSummary, loadHostedSpawnSelection } from "./postgres-player-entry-registration";
import {
  HOSTED_PLAYER_ENTRY_SERVER_COLUMNS,
  PLAYER_ENTRY_BLOCKING_STATUSES,
  readAuthoritativePostgresNow,
  type HostedPlayerEntryServerRow
} from "./postgres-player-entry-server-query";

const BLOCKING_STATUSES: ServerMembershipStatus[] = [...PLAYER_ENTRY_BLOCKING_STATUSES];
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WORKER_FRESH_MS = 30_000;

export interface AuthenticatedAccount extends AccountSessionView {
  sessionId: string;
}

export interface MembershipRecord {
  membershipId: string;
  accountId: string;
  serverInstanceId: string;
  serverDisplayName: string;
  serverMode: "free" | "war";
  playerId: string;
  reservedSpawnDistrictId: string;
  status: ServerMembershipStatus;
  factionId: string | null;
  avatarId: string | null;
  gangColor: string | null;
  joinedAt: string;
  earlyLeaveDeadline: string | null;
  serverStartedAt: string | null;
  setupCompletedAt: string | null;
  earlyLeaveAt: string | null;
  completedAt: string | null;
  starterPackageAppliedAt: string | null;
  joinTicketId: string | null;
  version: number;
}

export interface MembershipJobRecord {
  jobId: string;
  membershipId: string;
  serverInstanceId: string;
  jobType: "activate" | "leave";
  status: "pending" | "claimed" | "completed" | "failed";
}

export const createPostgresPlayerEntryRepository = (database: PostgresDatabase) => ({
  database,
  isSchemaCurrent: async () => {
    const result = await database.query<{ present: boolean }>(
      `SELECT to_regclass('public.empire_server_memberships') IS NOT NULL
          AND to_regclass('public.empire_auth_throttle_buckets') IS NOT NULL AS present`
    );
    return Boolean(result.rows[0]?.present);
  },

  registerAccount: async (input: { username: string; password: string; gangName: string; displayName?: string }) => {
    const username = input.username.normalize("NFKC").trim();
    const normalizedUsername = normalizePlayerUsername(username);
    const gangName = input.gangName.normalize("NFKC").trim();
    const displayName = String(input.displayName || username).normalize("NFKC").trim();
    if (!validPlayerUsername(username)) throw entryError("ACCOUNT_USERNAME_INVALID", "Uživatelské jméno není platné.");
    if (!validGangName(gangName) || !validGangName(displayName)) throw entryError("ACCOUNT_PROFILE_INVALID", "Profil účtu není platný.");
    const password = await hashAccountPassword(input.password);
    const accountId = `account:${crypto.randomUUID()}`;
    const at = new Date().toISOString();
    try {
      await database.query(
        `INSERT INTO empire_accounts
         (id,account_id,username,normalized_username,password_hash,password_salt,password_algorithm,password_parameters,
          status,display_name,gang_name,created_at,updated_at,last_login_at,version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',$9,$10,$11::timestamptz,$11::timestamptz,NULL,1)`,
        [`player-account:${accountId}`, accountId, username, normalizedUsername, password.passwordHash, password.passwordSalt,
          password.passwordAlgorithm, JSON.stringify(password.passwordParameters), displayName, gangName, at]
      );
    } catch (error) {
      if (postgresCode(error) === "23505") throw entryError("ACCOUNT_USERNAME_TAKEN", "Uživatelské jméno už existuje.");
      throw error;
    }
    return createSession(database, { accountId, username, displayName, gangName }, at);
  },

  login: async (input: { username: string; password: string }) => {
    const result = await database.query<AccountRow>(
      `SELECT account_id,username,display_name,gang_name,status,password_hash,password_salt,password_algorithm,password_parameters
       FROM empire_accounts WHERE normalized_username=$1`,
      [normalizePlayerUsername(input.username)]
    );
    const row = result.rows[0];
    const valid = row && row.status === "active" && await verifyAccountPassword(input.password, mapPassword(row));
    if (!valid || !row) throw entryError("ACCOUNT_LOGIN_INVALID", "Přihlášení se nezdařilo.");
    const at = new Date().toISOString();
    await database.query("UPDATE empire_accounts SET last_login_at=$2::timestamptz,updated_at=$2::timestamptz,version=version+1 WHERE account_id=$1", [row.account_id, at]);
    return createSession(database, mapAccount(row), at);
  },

  authenticate: async (token: string, touch = true): Promise<AuthenticatedAccount | null> => {
    if (!token) return null;
    const at = new Date().toISOString();
    const result = await database.query<AccountSessionRow>(
      `${ACCOUNT_SESSION_SELECT}
       WHERE session.token_hash=$1 AND account.status='active' AND session.revoked_at IS NULL AND session.expires_at > $2::timestamptz`,
      [hashToken(token), at]
    );
    const row = result.rows[0];
    if (!row) return null;
    if (touch) await database.query(
      "UPDATE empire_account_sessions SET last_seen_at=$2::timestamptz,version=version+1 WHERE session_id=$1",
      [row.session_id, at]
    );
    return { ...mapAccount(row), sessionId: String(row.session_id), expiresAt: iso(row.expires_at) };
  },

  revokeSession: async (token: string) => {
    if (!token) return false;
    const result = await database.query(
      "UPDATE empire_account_sessions SET revoked_at=now(),version=version+1 WHERE token_hash=$1 AND revoked_at IS NULL",
      [hashToken(token)]
    );
    return (result.rowCount ?? 0) > 0;
  },

  getOverview: async (account: AuthenticatedAccount, injectedNow?: Date): Promise<LobbyOverviewView> => {
    const now = await readAuthoritativePostgresNow(database, injectedNow);
    const accountView = publicAccount(account);
    const membershipRows = await database.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.account_id=$1 ORDER BY membership.joined_at DESC`, [account.accountId]);
    const memberships = membershipRows.rows.map(mapMembership);
    const servers = await database.query<HostedPlayerEntryServerRow>(
      `SELECT ${HOSTED_PLAYER_ENTRY_SERVER_COLUMNS}
       FROM empire_hosted_server_instances ORDER BY created_at DESC`
    );
    const availableServers = await Promise.all(servers.rows.map((server) =>
      createLobbyServerSummary(database, server, now, WORKER_FRESH_MS)));
    const views = memberships.map((membership) => toMembershipView(membership, now));
    return {
      account: accountView,
      gangProfile: { gangName: accountView.gangName, displayName: accountView.displayName, username: accountView.username },
      activeBlockingMembership: views.find((entry) => BLOCKING_STATUSES.includes(entry.status)) ?? null,
      memberships: views,
      availableServers,
      featureAvailability: { market: "preparing", localDemo: false },
      generatedAt: now.toISOString()
    };
  },

  getSpawnSelection: async (accountId: string, serverInstanceId: string, injectedNow?: Date): Promise<SpawnDistrictSelectionView> =>
    loadHostedSpawnSelection(database, accountId, serverInstanceId,
      await readAuthoritativePostgresNow(database, injectedNow), WORKER_FRESH_MS),

  confirmSpawnDistrict: async (accountId: string, request: ConfirmSpawnDistrictRequest, idempotencyKey: string, injectedNow?: Date) => {
    if (!validIdempotencyKey(idempotencyKey)) throw entryError("IDEMPOTENCY_KEY_REQUIRED", "Požadavek vyžaduje stabilní Idempotency-Key.");
    const requestHash = hashEntryRequest(request);
    return database.transaction(async (client) => {
      const replay = await client.query<MembershipRow>(
        `${MEMBERSHIP_SELECT} WHERE membership.account_id=$1 AND membership.confirm_idempotency_key=$2`, [accountId, idempotencyKey]
      );
      if (replay.rows[0]) {
        if (String(replay.rows[0].confirm_request_hash) !== requestHash) throw entryError("IDEMPOTENCY_CONFLICT", "Idempotency-Key už byl použit pro jiný district.");
        return mapMembership(replay.rows[0]);
      }
      const server = await client.query<HostedPlayerEntryServerRow>(
        `SELECT ${HOSTED_PLAYER_ENTRY_SERVER_COLUMNS}
         FROM empire_hosted_server_instances WHERE server_instance_id=$1 FOR UPDATE`, [request.serverInstanceId]
      );
      const hosted = server.rows[0];
      if (!hosted) throw entryError("SERVER_NOT_FOUND", "Server nebyl nalezen.");
      const now = await readAuthoritativePostgresNow(client, injectedNow);
      const existing = await client.query<MembershipRow>(
        `${MEMBERSHIP_SELECT} WHERE membership.account_id=$1 AND membership.status=ANY($2::text[]) LIMIT 1`, [accountId, BLOCKING_STATUSES]
      );
      if (existing.rows[0]) throw entryError("ACTIVE_MEMBERSHIP_EXISTS", "Nejdřív musíš dokončit nebo opustit svůj současný server.");
      const previous = await client.query("SELECT membership_id FROM empire_server_memberships WHERE account_id=$1 AND server_instance_id=$2", [accountId, request.serverInstanceId]);
      if (!PLAYER_ENTRY_POLICY.allowRejoinAfterEarlyLeave && (previous.rowCount ?? 0) > 0) {
        throw entryError("SERVER_REJOIN_NOT_ALLOWED", "Na stejný server se po opuštění nelze znovu přihlásit.");
      }
      const selection = await loadHostedSpawnSelection(client, accountId, request.serverInstanceId, now, WORKER_FRESH_MS, hosted);
      if (selection.membershipEligibility !== "eligible") throw entryError("ACTIVE_MEMBERSHIP_EXISTS", "Současné členství blokuje nový server.");
      if (selection.capacity.committedPlayers + selection.capacity.reservedSlots >= selection.capacity.maximum) throw entryError("SERVER_FULL", "Server se mezitím zaplnil.");
      const district = selection.districts.find((entry) => entry.districtId === request.districtId);
      if (!district?.available) throw entryError("SPAWN_ALREADY_RESERVED", "Tento district mezitím získal jiný hráč. Vyber si jiný.");
      if (selection.availabilityRevision !== request.expectedAvailabilityRevision) throw entryError("SPAWN_SELECTION_STALE", "Nabídka districtů se změnila. Načti ji znovu.");
      const membershipId = `membership:${crypto.randomUUID()}`;
      const playerId = createServerPlayerId(request.serverInstanceId, accountId);
      const joinedAt = now.toISOString();
      const startedAt = isoOrNull(hosted.last_started_at);
      const earlyLeaveDeadline = startedAt ? new Date(Date.parse(startedAt) + PLAYER_ENTRY_POLICY.earlyLeaveWindowMs).toISOString() : null;
      const reservationId = `reservation:${crypto.randomUUID()}`;
      const slot = selection.capacity.committedPlayers + selection.capacity.reservedSlots + 1;
      await client.query(
        `INSERT INTO empire_server_memberships
         (id,membership_id,account_id,server_instance_id,player_id,reserved_spawn_district_id,status,
          confirm_idempotency_key,confirm_request_hash,joined_at,early_leave_deadline,created_at,updated_at,version)
         VALUES ($1,$2,$3,$4,$5,$6,'setup_required',$7,$8,$9::timestamptz,$10::timestamptz,$9::timestamptz,$9::timestamptz,1)`,
        [`server-membership:${membershipId}`, membershipId, accountId, request.serverInstanceId, playerId, request.districtId,
          idempotencyKey, requestHash, joinedAt, earlyLeaveDeadline]
      );
      await client.query(
        `INSERT INTO empire_hosted_join_reservations
         (id,reservation_id,server_instance_id,player_identity_id,status,idempotency_key,request_hash,expected_server_version,
          reserved_slot,faction_id,join_ticket_id,expires_at,created_at,committed_at,canceled_at,updated_at,version,membership_id,reserved_spawn_district_id)
         VALUES ($1,$2,$3,$4,'committed',$5,$6,$7,$8,NULL,NULL,$9::timestamptz,$10::timestamptz,$10::timestamptz,NULL,$10::timestamptz,1,$11,$12)`,
        [`hosted-join:${reservationId}`, reservationId, request.serverInstanceId, accountId, idempotencyKey, requestHash,
          Number(hosted.version), slot, new Date(now.getTime() + 5 * 60 * 1000).toISOString(), joinedAt, membershipId, request.districtId]
      );
      await insertMembershipEvent(client, { membershipId, serverInstanceId: request.serverInstanceId, accountId,
        eventType: "spawn-confirmed", result: "accepted", at: joinedAt,
        metadata: { districtId: request.districtId, reservedSlot: slot } });
      const inserted = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1`, [membershipId]);
      return mapMembership(inserted.rows[0]!);
    }).catch(async (error) => {
      if (postgresCode(error) === "23505") {
        const replay = await database.query<MembershipRow>(
          `${MEMBERSHIP_SELECT} WHERE membership.account_id=$1 AND membership.confirm_idempotency_key=$2`,
          [accountId, idempotencyKey]
        );
        if (replay.rows[0]) {
          if (String(replay.rows[0].confirm_request_hash) !== requestHash) {
            throw entryError("IDEMPOTENCY_CONFLICT", "Idempotency-Key už byl použit pro jiný district.");
          }
          return mapMembership(replay.rows[0]);
        }
        throw entryError("SPAWN_ALREADY_RESERVED", "Tento district mezitím získal jiný hráč. Vyber si jiný.");
      }
      throw error;
    });
  },

  finalizeSetup: async (accountId: string, request: FinalizeServerSetupRequest, idempotencyKey: string, now = new Date()) => {
    if (!validIdempotencyKey(idempotencyKey)) throw entryError("IDEMPOTENCY_KEY_REQUIRED", "Setup vyžaduje stabilní Idempotency-Key.");
    if (!isPlayerFaction(request.factionId) || !isPlayerAvatar(request.factionId, request.avatarId)
      || !isPlayerGangColor(String(request.gangColor ?? ""))) {
      throw entryError("SERVER_SETUP_INVALID", "Frakce, avatar nebo barva nejsou platné.");
    }
    const requestHash = hashEntryRequest(request);
    return database.transaction(async (client) => {
      const result = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1 FOR UPDATE`, [request.membershipId]);
      const row = result.rows[0];
      if (!row || String(row.account_id) !== accountId) throw entryError("MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
      if (row.setup_idempotency_key) {
        if (String(row.setup_idempotency_key) !== idempotencyKey || String(row.setup_request_hash) !== requestHash) {
          throw entryError("IDEMPOTENCY_CONFLICT", "Idempotency-Key už byl použit pro jiný setup.");
        }
        return mapMembership(row);
      }
      if (row.status !== "setup_required") throw entryError("MEMBERSHIP_SETUP_NOT_ALLOWED", "Setup už nelze změnit.");
      const at = now.toISOString();
      const jobId = `membership-job:${crypto.randomUUID()}`;
      await client.query(
        `UPDATE empire_server_memberships SET status='finalizing_setup',faction_id=$2,avatar_id=$3,gang_color=$4,
          setup_idempotency_key=$5,setup_request_hash=$6,updated_at=$7::timestamptz,version=version+1 WHERE membership_id=$1`,
        [request.membershipId, request.factionId, request.avatarId, String(request.gangColor).toLowerCase(), idempotencyKey, requestHash, at]
      );
      await client.query(
        `INSERT INTO empire_server_membership_jobs
         (id,job_id,membership_id,server_instance_id,job_type,status,attempt,available_at,created_at,updated_at,version)
         VALUES ($1,$2,$3,$4,'activate','pending',0,$5::timestamptz,$5::timestamptz,$5::timestamptz,1)`,
        [`server-membership-job:${jobId}`, jobId, request.membershipId, String(row.server_instance_id), at]
      );
      await insertMembershipEvent(client, { membershipId: request.membershipId, serverInstanceId: String(row.server_instance_id), accountId,
        eventType: "setup-finalization-requested", result: "accepted", at,
        metadata: { factionId: request.factionId, avatarId: request.avatarId } });
      const updated = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1`, [request.membershipId]);
      return mapMembership(updated.rows[0]!);
    });
  },

  requestEarlyLeave: async (accountId: string, membershipId: string, now = new Date()) => database.transaction(async (client) => {
    const result = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1 FOR UPDATE`, [membershipId]);
    const row = result.rows[0];
    if (!row || String(row.account_id) !== accountId) throw entryError("MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
    const membership = mapMembership(row);
    if (membership.status === "left_early") return membership;
    if (!["setup_required", "finalizing_setup", "active"].includes(membership.status)) throw entryError("EARLY_LEAVE_NOT_ALLOWED", "Tento membership už nelze opustit.");
    if (membership.earlyLeaveDeadline && now.getTime() >= Date.parse(membership.earlyLeaveDeadline)) {
      throw entryError("EARLY_LEAVE_WINDOW_EXPIRED", "První hodina pro opuštění serveru už vypršela.");
    }
    const at = now.toISOString();
    if (membership.status === "setup_required") {
      await client.query(
        `UPDATE empire_server_memberships SET status='left_early',early_leave_at=$2::timestamptz,updated_at=$2::timestamptz,
          version=version+1 WHERE membership_id=$1`, [membershipId, at]
      );
      await client.query(
        `UPDATE empire_hosted_join_reservations SET status='canceled',canceled_at=$2::timestamptz,updated_at=$2::timestamptz,
          version=version+1 WHERE membership_id=$1 AND status='committed'`, [membershipId, at]
      );
      await insertMembershipEvent(client, { membershipId, serverInstanceId: membership.serverInstanceId, accountId,
        eventType: "early-leave", result: "completed", at, metadata: { setupCompleted: false } });
    } else {
      const jobId = `membership-job:${crypto.randomUUID()}`;
      if (membership.status === "finalizing_setup") await client.query(
        `UPDATE empire_server_membership_jobs SET status='failed',claimed_by_worker_id=NULL,claimed_until=NULL,
          last_error_code='EARLY_LEAVE_REQUESTED',updated_at=$2::timestamptz,version=version+1
         WHERE membership_id=$1 AND job_type='activate' AND status IN ('pending','claimed')`,
        [membershipId, at]
      );
      await client.query(
        `UPDATE empire_server_memberships SET status='leave_pending',updated_at=$2::timestamptz,version=version+1 WHERE membership_id=$1`,
        [membershipId, at]
      );
      await insertMembershipEvent(client, { membershipId, serverInstanceId: membership.serverInstanceId, accountId,
        eventType: "early-leave-requested", result: "accepted", at,
        metadata: { setupCompleted: membership.status === "active" } });
      await client.query(
        `INSERT INTO empire_server_membership_jobs
         (id,job_id,membership_id,server_instance_id,job_type,status,attempt,available_at,created_at,updated_at,version)
         VALUES ($1,$2,$3,$4,'leave','pending',0,$5::timestamptz,$5::timestamptz,$5::timestamptz,1)
         ON CONFLICT (membership_id,job_type) DO NOTHING`,
        [`server-membership-job:${jobId}`, jobId, membershipId, membership.serverInstanceId, at]
      );
    }
    const updated = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1`, [membershipId]);
    return mapMembership(updated.rows[0]!);
  }),

  getMembership: async (membershipId: string) => {
    const result = await database.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1`, [membershipId]);
    return result.rows[0] ? mapMembership(result.rows[0]) : null;
  },

  getMembershipView: async (membershipId: string, now = new Date()) => {
    const result = await database.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1`, [membershipId]);
    return result.rows[0] ? toMembershipView(mapMembership(result.rows[0]), now) : null;
  },

  claimMembershipJob: async (workerId: string, now: string, claimedUntil: string): Promise<MembershipJobRecord | null> => {
    const result = await database.query<JobRow>(
      `WITH candidate AS (
         SELECT job_id FROM empire_server_membership_jobs
         WHERE (status='pending' OR (status='claimed' AND claimed_until <= $2::timestamptz)) AND available_at <= $2::timestamptz
         ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE empire_server_membership_jobs job SET status='claimed',claimed_by_worker_id=$1,claimed_until=$3::timestamptz,
         attempt=attempt+1,updated_at=$2::timestamptz,version=version+1
       FROM candidate WHERE job.job_id=candidate.job_id
       RETURNING job.job_id,job.membership_id,job.server_instance_id,job.job_type,job.status`,
      [workerId, now, claimedUntil]
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  },

  completeActivation: async (input: { membershipId: string; jobId: string; workerId: string; joinTicketId: string; at: string }) =>
    completeMembershipJob(database, input, "active"),

  completeLeave: async (input: { membershipId: string; jobId: string; workerId: string; at: string }) =>
    completeMembershipJob(database, { ...input, joinTicketId: null }, "left_early"),

  failMembershipJob: async (input: { membershipId: string; jobId: string; workerId: string; errorCode: string; at: string }) => {
    await database.transaction(async (client) => {
      await client.query(
        `UPDATE empire_server_membership_jobs SET status=CASE WHEN attempt < 5 THEN 'pending' ELSE 'failed' END,
          claimed_by_worker_id=NULL,claimed_until=NULL,last_error_code=$4,
          available_at=CASE WHEN attempt < 5 THEN $5::timestamptz + interval '5 seconds' ELSE available_at END,
          updated_at=$5::timestamptz,version=version+1
         WHERE job_id=$1 AND claimed_by_worker_id=$2 AND membership_id=$3`,
        [input.jobId, input.workerId, input.membershipId, input.errorCode, input.at]
      );
      await client.query(
        `UPDATE empire_server_memberships SET last_error_code=$2,updated_at=$3::timestamptz,version=version+1 WHERE membership_id=$1`,
        [input.membershipId, input.errorCode, input.at]
      );
    });
  },

  syncResolvedMemberships: async (serverInstanceId: string, defeatedPlayerIds: string[], resolved: boolean, at: string) => {
    if (defeatedPlayerIds.length > 0) await database.query(
      `WITH changed AS (
         UPDATE empire_server_memberships SET status='defeated',updated_at=$3::timestamptz,version=version+1
         WHERE server_instance_id=$1 AND player_id=ANY($2::text[]) AND status='active'
         RETURNING membership_id,server_instance_id,account_id
       ) INSERT INTO empire_server_membership_events
         (id,event_id,membership_id,server_instance_id,account_id,event_type,result,error_code,metadata,created_at)
       SELECT 'membership-event:'||membership_id||':defeated','membership-event:'||membership_id||':defeated',membership_id,
         server_instance_id,account_id,'defeated','completed',NULL,'{}'::jsonb,$3::timestamptz FROM changed
       ON CONFLICT (event_id) DO NOTHING`, [serverInstanceId, defeatedPlayerIds, at]
    );
    if (resolved) await database.transaction(async (client) => {
      await client.query(
        `UPDATE empire_server_membership_jobs SET status='failed',claimed_by_worker_id=NULL,claimed_until=NULL,
          last_error_code='SERVER_COMPLETED',updated_at=$2::timestamptz,version=version+1
         WHERE server_instance_id=$1 AND status IN ('pending','claimed')`, [serverInstanceId, at]
      );
      await client.query(
        `WITH changed AS (
           UPDATE empire_server_memberships SET status='completed',completed_at=$2::timestamptz,updated_at=$2::timestamptz,version=version+1
           WHERE server_instance_id=$1 AND status IN ('setup_required','finalizing_setup','active','leave_pending','defeated')
           RETURNING membership_id,server_instance_id,account_id
         ) INSERT INTO empire_server_membership_events
           (id,event_id,membership_id,server_instance_id,account_id,event_type,result,error_code,metadata,created_at)
         SELECT 'membership-event:'||membership_id||':completed','membership-event:'||membership_id||':completed',membership_id,
           server_instance_id,account_id,'server-completed','completed',NULL,'{}'::jsonb,$2::timestamptz FROM changed
         ON CONFLICT (event_id) DO NOTHING`, [serverInstanceId, at]
      );
    });
  }
});

export type PostgresPlayerEntryRepository = ReturnType<typeof createPostgresPlayerEntryRepository>;

const createSession = async (database: PostgresDatabase, account: Omit<AccountSessionView, "expiresAt">, at: string) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const sessionId = `account-session:${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.parse(at) + SESSION_TTL_MS).toISOString();
  await database.query(
    `INSERT INTO empire_account_sessions
     (id,session_id,token_hash,account_id,created_at,expires_at,last_seen_at,revoked_at,version)
     VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$5::timestamptz,NULL,1)`,
    [`player-account-session:${sessionId}`, sessionId, hashToken(token), account.accountId, at, expiresAt]
  );
  return { token, session: { ...account, sessionId, expiresAt } };
};

const completeMembershipJob = async (
  database: PostgresDatabase,
  input: { membershipId: string; jobId: string; workerId: string; joinTicketId: string | null; at: string },
  nextStatus: "active" | "left_early"
) => database.transaction(async (client) => {
  const result = await client.query<MembershipRow>(`${MEMBERSHIP_SELECT} WHERE membership.membership_id=$1 FOR UPDATE`, [input.membershipId]);
  const row = result.rows[0];
  if (!row) return false;
  if (row.status === nextStatus) {
    await finishJob(client, input);
    return true;
  }
  const expected = nextStatus === "active" ? "finalizing_setup" : "leave_pending";
  if (row.status !== expected) return false;
  await client.query(
    `UPDATE empire_server_memberships SET status=$2,
      setup_completed_at=CASE WHEN $2='active' THEN $3::timestamptz ELSE setup_completed_at END,
      starter_package_applied_at=CASE WHEN $2='active' THEN COALESCE(starter_package_applied_at,$3::timestamptz) ELSE starter_package_applied_at END,
      early_leave_at=CASE WHEN $2='left_early' THEN $3::timestamptz ELSE early_leave_at END,
      join_ticket_id=COALESCE($4,join_ticket_id),last_error_code=NULL,updated_at=$3::timestamptz,version=version+1
     WHERE membership_id=$1`, [input.membershipId, nextStatus, input.at, input.joinTicketId]
  );
  if (nextStatus === "left_early") await client.query(
    `UPDATE empire_hosted_join_reservations SET status='canceled',canceled_at=$2::timestamptz,updated_at=$2::timestamptz,
      version=version+1 WHERE membership_id=$1 AND status='committed'`, [input.membershipId, input.at]
  );
  await insertMembershipEvent(client, { membershipId: input.membershipId, serverInstanceId: String(row.server_instance_id),
    accountId: String(row.account_id), eventType: nextStatus === "active" ? "player-activated" : "early-leave",
    result: "completed", at: input.at, metadata: nextStatus === "active"
      ? { starterPackageApplied: true, districtId: String(row.reserved_spawn_district_id) }
      : { setupCompleted: Boolean(row.setup_completed_at) } });
  await finishJob(client, input);
  return true;
});

const finishJob = (client: PostgresQueryable, input: { jobId: string; workerId: string; at: string }) => client.query(
  `UPDATE empire_server_membership_jobs SET status='completed',claimed_until=NULL,last_error_code=NULL,updated_at=$3::timestamptz,
   version=version+1 WHERE job_id=$1 AND claimed_by_worker_id=$2`, [input.jobId, input.workerId, input.at]
);

const insertMembershipEvent = (database: PostgresQueryable, input: {
  membershipId: string; serverInstanceId: string; accountId: string; eventType: string;
  result: "accepted" | "completed" | "rejected"; at: string; metadata?: Record<string, unknown>; errorCode?: string | null;
}) => {
  const eventId = `membership-event:${input.membershipId}:${input.eventType}`;
  return database.query(
    `INSERT INTO empire_server_membership_events
     (id,event_id,membership_id,server_instance_id,account_id,event_type,result,error_code,metadata,created_at)
     VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::timestamptz) ON CONFLICT (event_id) DO NOTHING`,
    [eventId, input.membershipId, input.serverInstanceId, input.accountId, input.eventType, input.result,
      input.errorCode ?? null, JSON.stringify(input.metadata ?? {}), input.at]
  );
};

const toMembershipView = (membership: MembershipRecord, now: Date): ServerMembershipView => {
  const leaves = ["setup_required", "finalizing_setup", "active"].includes(membership.status);
  const remaining = membership.earlyLeaveDeadline ? Date.parse(membership.earlyLeaveDeadline) - now.getTime() : Number.POSITIVE_INFINITY;
  const canLeaveEarly = leaves && remaining > 0;
  return {
    membershipId: membership.membershipId,
    serverInstanceId: membership.serverInstanceId,
    serverDisplayName: membership.serverDisplayName,
    playerId: membership.playerId,
    status: membership.status,
    reservedSpawnDistrictId: membership.reservedSpawnDistrictId,
    factionId: membership.factionId,
    avatarId: membership.avatarId,
    gangColor: membership.gangColor,
    joinedAt: membership.joinedAt,
    setupCompletedAt: membership.setupCompletedAt,
    earlyLeaveAt: membership.earlyLeaveAt,
    completedAt: membership.completedAt,
    canLeaveEarly,
    earlyLeaveDeadline: membership.earlyLeaveDeadline,
    earlyLeaveRemainingMs: Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
    earlyLeaveBlockedReason: canLeaveEarly ? null : leaves ? "EARLY_LEAVE_WINDOW_EXPIRED" : "MEMBERSHIP_STATUS_LOCKED",
    joinTicket: membership.joinTicketId
  };
};

const mapMembership = (row: MembershipRow): MembershipRecord => ({
  membershipId: String(row.membership_id),
  accountId: String(row.account_id),
  serverInstanceId: String(row.server_instance_id),
  serverDisplayName: String(row.display_name),
  serverMode: row.mode as "free" | "war",
  playerId: String(row.player_id),
  reservedSpawnDistrictId: String(row.reserved_spawn_district_id),
  status: row.status as ServerMembershipStatus,
  factionId: nullable(row.faction_id),
  avatarId: nullable(row.avatar_id),
  gangColor: nullable(row.gang_color),
  joinedAt: iso(row.joined_at),
  earlyLeaveDeadline: resolveEarlyLeaveDeadline(row.early_leave_deadline, row.server_started_at),
  serverStartedAt: isoOrNull(row.server_started_at),
  setupCompletedAt: isoOrNull(row.setup_completed_at),
  earlyLeaveAt: isoOrNull(row.early_leave_at),
  completedAt: isoOrNull(row.completed_at),
  starterPackageAppliedAt: isoOrNull(row.starter_package_applied_at),
  joinTicketId: nullable(row.join_ticket_id),
  version: Number(row.version)
});

const mapJob = (row: JobRow): MembershipJobRecord => ({
  jobId: String(row.job_id), membershipId: String(row.membership_id), serverInstanceId: String(row.server_instance_id),
  jobType: row.job_type as "activate" | "leave", status: row.status as MembershipJobRecord["status"]
});

const mapAccount = (row: AccountRow | AccountSessionRow) => ({
  accountId: String(row.account_id), username: String(row.username), displayName: String(row.display_name), gangName: String(row.gang_name)
});
export const publicAccount = (account: AccountSessionView): AccountSessionView => ({
  accountId: account.accountId,
  username: account.username,
  displayName: account.displayName,
  gangName: account.gangName,
  expiresAt: account.expiresAt
});
const mapPassword = (row: AccountRow): AccountPasswordRecord => ({
  passwordHash: String(row.password_hash), passwordSalt: String(row.password_salt), passwordAlgorithm: "scrypt",
  passwordParameters: row.password_parameters as AccountPasswordRecord["passwordParameters"]
});

export { entryError, entryErrorCode };

const validIdempotencyKey = (value: string) => /^[a-zA-Z0-9._:-]{16,200}$/u.test(value);
const hashToken = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const postgresCode = (error: unknown) => typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
const nullable = (value: unknown): string | null => value == null ? null : String(value);
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => value == null ? null : iso(value);

interface AccountRow extends Record<string, unknown> { account_id: unknown; username: unknown; display_name: unknown; gang_name: unknown; status: unknown; password_hash: unknown; password_salt: unknown; password_algorithm: unknown; password_parameters: unknown }
interface AccountSessionRow extends AccountRow { session_id: unknown; expires_at: unknown }
interface MembershipRow extends Record<string, unknown> { membership_id: unknown; account_id: unknown; server_instance_id: unknown; display_name: unknown; mode: unknown; server_started_at: unknown; player_id: unknown; reserved_spawn_district_id: unknown; status: unknown; confirm_request_hash: unknown; setup_idempotency_key: unknown; setup_request_hash: unknown; faction_id: unknown; avatar_id: unknown; gang_color: unknown; joined_at: unknown; early_leave_deadline: unknown; setup_completed_at: unknown; early_leave_at: unknown; completed_at: unknown; starter_package_applied_at: unknown; join_ticket_id: unknown; version: unknown }
interface JobRow extends Record<string, unknown> { job_id: unknown; membership_id: unknown; server_instance_id: unknown; job_type: unknown; status: unknown }

const ACCOUNT_SESSION_SELECT = `SELECT session.session_id,session.expires_at,account.account_id,account.username,account.display_name,
  account.gang_name,account.status,account.password_hash,account.password_salt,account.password_algorithm,account.password_parameters
  FROM empire_account_sessions session JOIN empire_accounts account ON account.account_id=session.account_id`;
const MEMBERSHIP_SELECT = `SELECT membership.membership_id,membership.account_id,membership.server_instance_id,server.display_name,server.mode,
  server.last_started_at AS server_started_at,
  membership.player_id,membership.reserved_spawn_district_id,membership.status,membership.confirm_request_hash,
  membership.setup_idempotency_key,membership.setup_request_hash,membership.faction_id,membership.avatar_id,membership.gang_color,
  membership.joined_at,membership.early_leave_deadline,membership.setup_completed_at,membership.early_leave_at,membership.completed_at,
  membership.starter_package_applied_at,membership.join_ticket_id,membership.version
  FROM empire_server_memberships membership JOIN empire_hosted_server_instances server ON server.server_instance_id=membership.server_instance_id`;

const resolveEarlyLeaveDeadline = (stored: unknown, serverStartedAt: unknown): string | null => {
  if (stored != null) return iso(stored);
  if (serverStartedAt == null) return null;
  return new Date(Date.parse(iso(serverStartedAt)) + PLAYER_ENTRY_POLICY.earlyLeaveWindowMs).toISOString();
};
