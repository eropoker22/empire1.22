import { createHash } from "node:crypto";

export function safeHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

export function canonicalHash(value) {
  return value === null || value === undefined
    ? null
    : createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex");
}

export function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

export function parseJsonValue(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : null;
  try { return JSON.parse(value); } catch { return null; }
}

export function playerRanking(matchResult) {
  if (!matchResult || !Array.isArray(matchResult.ranking)) return null;
  return matchResult.ranking
    .filter((entry) => entry?.subjectType === "player")
    .map((entry) => ({
      subjectType: "player",
      subjectId: String(entry.subjectId),
      rank: Number(entry.rank),
      score: Number(entry.score),
      scoreBreakdown: canonicalValue(entry.scoreBreakdown ?? {})
    }))
    .sort((left, right) => left.rank - right.rank || left.subjectId.localeCompare(right.subjectId));
}

export function membershipRanking(rows) {
  return rows.filter((row) => row.final_rank !== null && row.final_score !== null).map((row) => ({
    subjectType: "player",
    subjectId: String(row.player_id),
    rank: Number(row.final_rank),
    score: Number(row.final_score),
    scoreBreakdown: canonicalValue(parseJsonValue(row.final_score_breakdown) ?? {})
  })).sort((left, right) => left.rank - right.rank || left.subjectId.localeCompare(right.subjectId));
}
