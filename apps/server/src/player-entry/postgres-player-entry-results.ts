import type {
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
  const stored = await database.query(
    `INSERT INTO empire_hosted_match_results
       (id,match_result_id,server_instance_id,completed_at,winner_player_id,winner_alliance_id,completion_reason,
        result_payload,created_at,updated_at,version)
     VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8::jsonb,$9::timestamptz,$9::timestamptz,1)
     ON CONFLICT (server_instance_id) DO UPDATE SET
       completed_at=EXCLUDED.completed_at,winner_player_id=EXCLUDED.winner_player_id,
       winner_alliance_id=EXCLUDED.winner_alliance_id,completion_reason=EXCLUDED.completion_reason,
       result_payload=EXCLUDED.result_payload,updated_at=EXCLUDED.updated_at,version=empire_hosted_match_results.version+1
     WHERE empire_hosted_match_results.match_result_id=EXCLUDED.match_result_id
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
  if ((stored.rowCount ?? 0) !== 1) {
    throw entryError("MATCH_RESULT_CONFLICT", "Server už má jiný uložený výsledek.");
  }
  for (const entry of playerRanking(matchResult.ranking)) {
    await database.query(
      `UPDATE empire_server_memberships SET final_rank=$3,final_score=$4,final_score_breakdown=$5::jsonb,
         updated_at=$6::timestamptz,version=version+1
       WHERE server_instance_id=$1 AND player_id=$2`,
      [serverInstanceId, entry.subjectId, entry.rank, entry.score, JSON.stringify(entry.scoreBreakdown ?? {}), at]
    );
  }
};

export const loadHostedMatchResultsForAccount = async (
  database: PostgresQueryable,
  accountId: string,
  serverInstanceId: string
): Promise<HostedMatchResultsView | null> => {
  const result = await database.query<HostedMatchResultRow>(
    `SELECT result.result_payload,result.completed_at,result.completion_reason,server.display_name,
       membership.player_id,membership.final_rank,membership.final_score,membership.final_score_breakdown
     FROM empire_hosted_match_results result
     JOIN empire_hosted_server_instances server ON server.server_instance_id=result.server_instance_id
     JOIN empire_server_memberships membership ON membership.server_instance_id=result.server_instance_id
     WHERE result.server_instance_id=$1 AND membership.account_id=$2`,
    [serverInstanceId, accountId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const payload = parseMatchResult(row.result_payload);
  const ranking = playerRanking(payload?.ranking ?? []);
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
const nullableNumber = (value: unknown): number | null => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

interface HostedMatchResultRow extends Record<string, unknown> {
  result_payload: unknown;
  completed_at: unknown;
  completion_reason: unknown;
  display_name: unknown;
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
