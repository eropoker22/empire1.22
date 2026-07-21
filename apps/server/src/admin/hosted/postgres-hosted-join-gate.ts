import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";
import { HOSTED_WORKER_FRESH_MS } from "./hosted-control-plane-repository";

export interface PostgresHostedJoinGateRow extends Record<string, unknown> {
  version: string | number;
  capacity: number;
  status: string;
  provisioning_state: string;
  current_snapshot_id: unknown;
  runtime_lease_owner_id: unknown;
  runtime_lease_expires_at: unknown;
  last_worker_heartbeat_at: unknown;
  registration_opens_at: unknown;
  registration_closes_at: unknown;
  registration_closed_at: unknown;
  registration_window_minutes: string | number;
}

export const isPostgresHostedServerJoinableAt = (
  hosted: PostgresHostedJoinGateRow,
  now: Date
): boolean => {
  const registration = resolveHostedServerRegistrationState({
    registrationOpensAt: isoOrNull(hosted.registration_opens_at),
    registrationClosesAt: isoOrNull(hosted.registration_closes_at),
    registrationClosedAt: isoOrNull(hosted.registration_closed_at),
    registrationWindowMinutes: Number(hosted.registration_window_minutes)
  }, now);
  const heartbeatAt = timestampOrNull(hosted.last_worker_heartbeat_at);
  const leaseExpiresAt = timestampOrNull(hosted.runtime_lease_expires_at);
  return hosted.provisioning_state === "ready"
    && (hosted.status === "lobby" || hosted.status === "running")
    && Boolean(hosted.current_snapshot_id)
    && Boolean(hosted.runtime_lease_owner_id)
    && registration.canCreateMembership
    && heartbeatAt !== null
    && now.getTime() - heartbeatAt <= HOSTED_WORKER_FRESH_MS
    && leaseExpiresAt !== null
    && leaseExpiresAt > now.getTime();
};

const timestampOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const isoOrNull = (value: unknown): string | null => {
  const timestamp = timestampOrNull(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
};
