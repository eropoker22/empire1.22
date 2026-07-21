import * as crypto from "node:crypto";
import type { PostgresDatabase, PostgresQueryable } from "../runtime/persistence/postgres";

export type AuthThrottleAction = "register" | "login";

export interface AuthThrottleDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: "network" | "username" | null;
}

export interface AuthThrottleService {
  consume(input: {
    action: AuthThrottleAction;
    username: string;
    networkIdentifier: string;
  }): Promise<AuthThrottleDecision>;
}

export const AUTH_THROTTLE_POLICY = Object.freeze({
  register: Object.freeze({
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
    limits: Object.freeze({ network: 5, username: 3 })
  }),
  login: Object.freeze({
    windowMs: 15 * 60 * 1000,
    blockMs: 5 * 60 * 1000,
    limits: Object.freeze({ network: 20, username: 10 })
  })
});

export const createPostgresAuthThrottle = (
  database: PostgresDatabase,
  environment: Record<string, string | undefined>
): AuthThrottleService => {
  const pepper = String(environment.EMPIRE_AUTH_THROTTLE_PEPPER ?? "").trim();
  if (environment.NODE_ENV === "production" && pepper.length < 32) {
    throw new Error("EMPIRE_AUTH_THROTTLE_PEPPER must contain at least 32 characters in production.");
  }
  const effectivePepper = pepper || "empire-local-auth-throttle-development-only";

  return {
    consume: async (input) => database.transaction(async (client) => {
      const nowResult = await client.query<{ now: unknown }>("SELECT clock_timestamp() AS now");
      const now = new Date(String(nowResult.rows[0]?.now));
      if (!Number.isFinite(now.getTime())) throw new Error("Authoritative auth throttle clock is unavailable.");
      await client.query("DELETE FROM empire_auth_throttle_buckets WHERE expires_at <= $1::timestamptz", [now.toISOString()]);
      const policy = AUTH_THROTTLE_POLICY[input.action];
      const buckets = [
        { dimension: "network" as const, value: normalizeNetwork(input.networkIdentifier) },
        { dimension: "username" as const, value: normalizeUsername(input.username) }
      ];
      for (const bucket of buckets) {
        const decision = await consumeBucket(client, {
          action: input.action,
          dimension: bucket.dimension,
          keyHash: hashBucket(effectivePepper, bucket.dimension, bucket.value),
          now,
          windowMs: policy.windowMs,
          blockMs: policy.blockMs,
          limit: policy.limits[bucket.dimension]
        });
        if (!decision.allowed) return decision;
      }
      return { allowed: true, retryAfterSeconds: 0, reason: null };
    })
  };
};

export const resolveAuthNetworkIdentifier = (headers: Record<string, string | string[] | undefined> = {}): string => {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")
  ]));
  const forwarded = String(normalized["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || normalized["cf-connecting-ip"]?.trim() || normalized["client-ip"]?.trim() || "unknown";
};

const consumeBucket = async (
  client: PostgresQueryable,
  input: {
    action: AuthThrottleAction;
    dimension: "network" | "username";
    keyHash: string;
    now: Date;
    windowMs: number;
    blockMs: number;
    limit: number;
  }
): Promise<AuthThrottleDecision> => {
  const current = await client.query<ThrottleRow>(
    `SELECT window_started_at,attempt_count,blocked_until
     FROM empire_auth_throttle_buckets
     WHERE action_type=$1 AND dimension=$2 AND bucket_key_hash=$3
     FOR UPDATE`,
    [input.action, input.dimension, input.keyHash]
  );
  const row = current.rows[0];
  const blockedUntil = dateOrNull(row?.blocked_until);
  if (blockedUntil && blockedUntil.getTime() > input.now.getTime()) {
    return blockedDecision(input.dimension, blockedUntil.getTime() - input.now.getTime());
  }

  const previousWindow = dateOrNull(row?.window_started_at);
  const insideWindow = Boolean(previousWindow && input.now.getTime() - previousWindow.getTime() < input.windowMs);
  const windowStartedAt = insideWindow && previousWindow ? previousWindow : input.now;
  const attemptCount = insideWindow ? Number(row?.attempt_count || 0) + 1 : 1;
  const shouldBlock = attemptCount > input.limit;
  const nextBlockedUntil = shouldBlock ? new Date(input.now.getTime() + input.blockMs) : null;
  const expiresAt = new Date(Math.max(
    windowStartedAt.getTime() + input.windowMs,
    nextBlockedUntil?.getTime() || 0
  ) + input.windowMs);

  await client.query(
    `INSERT INTO empire_auth_throttle_buckets
       (action_type,dimension,bucket_key_hash,window_started_at,attempt_count,blocked_until,expires_at,updated_at)
     VALUES ($1,$2,$3,$4::timestamptz,$5,$6::timestamptz,$7::timestamptz,$8::timestamptz)
     ON CONFLICT (action_type,dimension,bucket_key_hash) DO UPDATE SET
       window_started_at=EXCLUDED.window_started_at,
       attempt_count=EXCLUDED.attempt_count,
       blocked_until=EXCLUDED.blocked_until,
       expires_at=EXCLUDED.expires_at,
       updated_at=EXCLUDED.updated_at`,
    [input.action, input.dimension, input.keyHash, windowStartedAt.toISOString(), attemptCount,
      nextBlockedUntil?.toISOString() ?? null, expiresAt.toISOString(), input.now.toISOString()]
  );
  return shouldBlock
    ? blockedDecision(input.dimension, input.blockMs)
    : { allowed: true, retryAfterSeconds: 0, reason: null };
};

const blockedDecision = (reason: "network" | "username", retryAfterMs: number): AuthThrottleDecision => ({
  allowed: false,
  retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  reason
});

const hashBucket = (pepper: string, dimension: string, value: string): string =>
  crypto.createHash("sha256")
    .update(crypto.createHmac("sha256", pepper).update(`${dimension}:${value}`).digest("base64url"))
    .digest("hex");
const normalizeNetwork = (value: string): string => String(value || "unknown").trim().toLowerCase();
const normalizeUsername = (value: string): string => String(value || "unknown").normalize("NFKC").trim().toLowerCase();
const dateOrNull = (value: unknown): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
};

interface ThrottleRow extends Record<string, unknown> {
  window_started_at: unknown;
  attempt_count: unknown;
  blocked_until: unknown;
}
