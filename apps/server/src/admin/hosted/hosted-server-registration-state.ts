import type {
  HostedServerRegistrationReasonCode,
  HostedServerRegistrationStateView
} from "@empire/shared-types";

export interface HostedServerRegistrationSchedule {
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosedAt: string | null;
  registrationWindowMinutes: number;
}

export const resolveHostedServerRegistrationState = (
  server: HostedServerRegistrationSchedule,
  now: Date | string | number
): HostedServerRegistrationStateView => {
  const nowMs = timestamp(now);
  const opensAtMs = nullableTimestamp(server.registrationOpensAt);
  const closesAtMs = nullableTimestamp(server.registrationClosesAt);
  const closedAtMs = nullableTimestamp(server.registrationClosedAt);
  const exactWindowMs = server.registrationWindowMinutes * 60 * 1000;

  if (opensAtMs === null && closesAtMs === null && closedAtMs === null) {
    return result("not_scheduled", server, 0, false, "SERVER_REGISTRATION_NOT_SCHEDULED");
  }
  if (opensAtMs === null || closesAtMs === null || closesAtMs - opensAtMs !== exactWindowMs
    || closedAtMs !== null && (closedAtMs < opensAtMs || closedAtMs > closesAtMs)) {
    return result("closed", server, 0, false, "SERVER_REGISTRATION_SCHEDULE_INVALID");
  }
  if (closedAtMs !== null) {
    const closedEarly = closedAtMs < closesAtMs;
    return result(closedEarly ? "closed_early" : "closed", server, 0, false,
      closedEarly ? "SERVER_REGISTRATION_CLOSED_EARLY" : "SERVER_REGISTRATION_CLOSED");
  }
  if (nowMs < opensAtMs) {
    return result("scheduled", server, opensAtMs - nowMs, false, "SERVER_REGISTRATION_NOT_OPEN");
  }
  if (nowMs < closesAtMs) {
    return result("open", server, closesAtMs - nowMs, true, null);
  }
  return result("closed", server, 0, false, "SERVER_REGISTRATION_CLOSED");
};

const result = (
  state: HostedServerRegistrationStateView["state"],
  server: HostedServerRegistrationSchedule,
  remainingMs: number,
  canCreateMembership: boolean,
  reasonCode: HostedServerRegistrationReasonCode | null
): HostedServerRegistrationStateView => ({
  state,
  opensAt: server.registrationOpensAt,
  closesAt: server.registrationClosesAt,
  closedAt: server.registrationClosedAt,
  remainingMs: Math.max(0, remainingMs),
  canCreateMembership,
  reasonCode
});

const nullableTimestamp = (value: string | null): number | null => value === null ? null : timestamp(value);

const timestamp = (value: Date | string | number): number => {
  const parsed = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError("Hosted registration timestamp is invalid.");
  return parsed;
};
