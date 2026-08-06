import type {
  FinalLockdownStatus,
  HostedMatchRankingEntryView,
  HostedMatchResultsView,
  MatchResult,
  MatchRankingEntry
} from "@empire/shared-types";
import type { PostgresQueryable } from "../runtime/persistence/postgres";
import { entryError } from "./player-entry-error";

export const persistHostedMatchResult = async (
  database: PostgresQueryable,
  serverInstanceId: string,
  matchResult: MatchResult,
  at: string
): Promise<void> => {
  if (matchResult.serverInstanceId !== serverInstanceId) {
    throw entryError("MATCH_RESULT_SERVER_MISMATCH", "Výsledek nepatří k tomuto serveru.");
  }
  const stored = await database.query<StoredMatchResultWriteRow>(
    `INSERT INTO empire_hosted_match_results
       (id,match_result_id,server_instance_id,completed_at,winner_player_id,winner_alliance_id,completion_reason,
        result_payload,created_at,updated_at,version)
     VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8::jsonb,$9::timestamptz,$9::timestamptz,1)
     ON CONFLICT (server_instance_id) DO NOTHING
     RETURNING match_result_id`,
    [
      `hosted-match-result:${serverInstanceId}`,
      matchResult.id,
      serverInstanceId,
      matchResult.endedAt,
      matchResult.winnerPlayerId,
      matchResult.winnerAllianceId,
      matchResult.reason,
      JSON.stringify(matchResult),
      at
    ]
  );
  if ((stored.rowCount ?? 0) === 0) {
    const existing = await database.query<StoredMatchResultComparisonRow>(
      `SELECT match_result_id,
         result_payload=$2::jsonb AS payload_matches,
         completed_at=$3::timestamptz
           AND winner_player_id IS NOT DISTINCT FROM $4
           AND winner_alliance_id IS NOT DISTINCT FROM $5
           AND completion_reason=$6 AS metadata_matches
       FROM empire_hosted_match_results WHERE server_instance_id=$1`,
      [serverInstanceId, JSON.stringify(matchResult), matchResult.endedAt, matchResult.winnerPlayerId,
        matchResult.winnerAllianceId, matchResult.reason]
    );
    const row = existing.rows[0];
    if ((existing.rowCount ?? 0) !== 1 || row?.match_result_id !== matchResult.id
      || row.payload_matches !== true || row.metadata_matches !== true) {
      throw entryError("MATCH_RESULT_CONFLICT", "Server už má jiný uložený výsledek.");
    }
    return;
  }
  if ((stored.rowCount ?? 0) !== 1 || stored.rows[0]?.match_result_id !== matchResult.id) {
    throw entryError("MATCH_RESULT_CONFLICT", "Výsledek zápasu se nepodařilo jednoznačně uložit.");
  }
  for (const entry of playerRanking(matchResult.ranking)) {
    const membership = await database.query(
      `UPDATE empire_server_memberships SET final_rank=$3,final_score=$4,final_score_breakdown=$5::jsonb,
         updated_at=$6::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND player_id=$2`,
      [serverInstanceId, entry.subjectId, entry.rank, entry.score, JSON.stringify(entry.scoreBreakdown ?? {}), at]
    );
    if ((membership.rowCount ?? 0) !== 1) {
      throw entryError("MATCH_RESULT_MEMBERSHIP_CONFLICT", "Výsledek nelze přiřadit všem hráčům serveru.");
    }
  }
};

export const loadHostedMatchResultsForAccount = async (
  database: PostgresQueryable,
  accountId: string,
  serverInstanceId: string
): Promise<HostedMatchResultsView | null> => {
  const result = await database.query<HostedMatchResultRow>(
    `SELECT result.result_payload,result.completed_at,result.completion_reason,server.display_name,
       runtime_server.status AS server_status,snapshot.root_version,snapshot.tick,
       snapshot.payload #>> '{state,finalLockdownState,status}' AS final_lockdown_status,
       snapshot.payload -> 'state' -> 'playersById' -> membership.player_id ->> 'status' AS current_player_status,
       membership.player_id,membership.final_rank,membership.final_score,membership.final_score_breakdown
     FROM empire_hosted_match_results result
     JOIN empire_hosted_server_instances server ON server.server_instance_id=result.server_instance_id
     JOIN empire_server_instances runtime_server ON runtime_server.server_instance_id=result.server_instance_id
     JOIN empire_snapshot_latest snapshot ON snapshot.server_instance_id=result.server_instance_id
       AND snapshot.payload #>> '{state,matchResult,id}'=result.match_result_id
     JOIN empire_server_memberships membership ON membership.server_instance_id=result.server_instance_id
     WHERE result.server_instance_id=$1 AND membership.account_id=$2`,
    [serverInstanceId, accountId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const payload = parseMatchResult(row.result_payload);
  if (!payload) return null;
  const stateVersion = nullableNumber(row.root_version);
  const currentTick = nullableNumber(row.tick);
  const finalLockdownStatus = parseFinalLockdownStatus(row.final_lockdown_status)
    ?? (payload.reason === "final_lockdown_score" ? null : "inactive");
  const currentPlayerStatus = parseCurrentPlayerStatus(row.current_player_status);
  if (stateVersion === null || currentTick === null || !finalLockdownStatus || !currentPlayerStatus) return null;
  const ranking = playerRanking(payload.ranking);
  const identities = await loadPlayerIdentities(database, serverInstanceId);
  const top3 = ranking.filter((entry) => entry.rank <= 3).slice(0, 3)
    .map((entry) => toPublicRanking(entry, identities));
  const winner = payload?.winnerPlayerId
    ? top3.find((entry) => entry.playerId === payload.winnerPlayerId)
      ?? ranking.filter((entry) => entry.subjectId === payload.winnerPlayerId)
        .map((entry) => toPublicRanking(entry, identities))[0]
      ?? null
    : null;
  return {
    serverInstanceId,
    serverDisplayName: String(row.display_name),
    server: {
      serverInstanceId,
      status: String(row.server_status),
      currentTick,
      stateVersion
    },
    finalLockdown: {
      status: finalLockdownStatus,
      currentPlayerRank: nullableNumber(row.final_rank),
      leaderboardTop3: top3
    },
    currentPlayerStatus,
    completedAt: iso(row.completed_at),
    completionReason: String(row.completion_reason),
    winner,
    top3,
    currentPlayerId: String(row.player_id),
    currentAccountPlacement: nullableNumber(row.final_rank),
    currentAccountFinalScore: nullableNumber(row.final_score),
    currentAccountScoreBreakdown: numericRecord(row.final_score_breakdown)
  };
};

const loadPlayerIdentities = async (database: PostgresQueryable, serverInstanceId: string) => {
  const result = await database.query<PlayerIdentityRow>(
    `SELECT membership.player_id,account.display_name,account.gang_name
     FROM empire_server_memberships membership
     JOIN empire_accounts account ON account.account_id=membership.account_id
     WHERE membership.server_instance_id=$1`,
    [serverInstanceId]
  );
  return new Map(result.rows.map((row) => [String(row.player_id), {
    playerName: String(row.display_name),
    gangName: String(row.gang_name)
  }]));
};

const toPublicRanking = (
  entry: MatchRankingEntry,
  identities: Map<string, { playerName: string; gangName: string }>
): HostedMatchRankingEntryView => {
  const identity = identities.get(entry.subjectId);
  return {
    playerId: entry.subjectId,
    playerName: identity?.playerName ?? "Neznámý hráč",
    gangName: identity?.gangName ?? "Neznámý gang",
    rank: entry.rank,
    score: entry.score
  };
};

const playerRanking = (ranking: MatchRankingEntry[]): MatchRankingEntry[] => ranking
  .filter((entry) => entry.subjectType === "player" && Number.isFinite(entry.rank) && Number.isFinite(entry.score))
  .sort((left, right) => left.rank - right.rank || left.subjectId.localeCompare(right.subjectId));

const parseMatchResult = (value: unknown): MatchResult | null => {
  if (typeof value === "string") {
    try { return JSON.parse(value) as MatchResult; } catch (_error) { return null; }
  }
  return value && typeof value === "object" ? value as MatchResult : null;
};

const numericRecord = (value: unknown): Record<string, number> | null => {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return Object.fromEntries(Object.entries(parsed)
    .filter(([, item]) => Number.isFinite(Number(item)))
    .map(([key, item]) => [key, Number(item)]));
};

const parseJson = (value: string): unknown => {
  try { return JSON.parse(value); } catch (_error) { return null; }
};
const parseFinalLockdownStatus = (value: unknown): FinalLockdownStatus | null =>
  ["inactive", "active", "paused", "resolved"].includes(String(value))
    ? String(value) as FinalLockdownStatus
    : null;
const parseCurrentPlayerStatus = (value: unknown): HostedMatchResultsView["currentPlayerStatus"] | null =>
  ["active", "defeated", "left", "banned"].includes(String(value))
    ? String(value) as HostedMatchResultsView["currentPlayerStatus"]
    : null;
const nullableNumber = (value: unknown): number | null => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

interface HostedMatchResultRow extends Record<string, unknown> {
  result_payload: unknown;
  completed_at: unknown;
  completion_reason: unknown;
  display_name: unknown;
  server_status: unknown;
  root_version: unknown;
  tick: unknown;
  final_lockdown_status: unknown;
  current_player_status: unknown;
  player_id: unknown;
  final_rank: unknown;
  final_score: unknown;
  final_score_breakdown: unknown;
}
interface PlayerIdentityRow extends Record<string, unknown> {
  player_id: unknown;
  display_name: unknown;
  gang_name: unknown;
}
interface StoredMatchResultWriteRow extends Record<string, unknown> {
  match_result_id: string;
}
interface StoredMatchResultComparisonRow extends StoredMatchResultWriteRow {
  payload_matches: boolean;
  metadata_matches: boolean;
}
