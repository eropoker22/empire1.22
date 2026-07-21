import { describe, expect, it } from "vitest";
import { resolveHostedServerRegistrationState } from "../../apps/server/src/admin/hosted/hosted-server-registration-state";

const scheduled = {
  registrationOpensAt: "2026-07-20T16:00:00.000Z",
  registrationClosesAt: "2026-07-20T17:00:00.000Z",
  registrationClosedAt: null,
  registrationWindowMinutes: 60
};

describe("hosted server registration state", () => {
  it("fails closed when registration is not scheduled", () => {
    expect(resolveHostedServerRegistrationState({ ...scheduled,
      registrationOpensAt: null, registrationClosesAt: null }, "2026-07-20T16:00:00.000Z")).toMatchObject({
      state: "not_scheduled", canCreateMembership: false, reasonCode: "SERVER_REGISTRATION_NOT_SCHEDULED"
    });
  });

  it("is scheduled before opensAt", () => {
    expect(resolveHostedServerRegistrationState(scheduled, "2026-07-20T15:59:59.999Z")).toMatchObject({
      state: "scheduled", remainingMs: 1, canCreateMembership: false, reasonCode: "SERVER_REGISTRATION_NOT_OPEN"
    });
  });

  it("includes opensAt and excludes closesAt", () => {
    expect(resolveHostedServerRegistrationState(scheduled, scheduled.registrationOpensAt)).toMatchObject({
      state: "open", remainingMs: 3_600_000, canCreateMembership: true, reasonCode: null
    });
    expect(resolveHostedServerRegistrationState(scheduled, "2026-07-20T16:59:59.999Z")).toMatchObject({
      state: "open", remainingMs: 1, canCreateMembership: true, reasonCode: null
    });
    expect(resolveHostedServerRegistrationState(scheduled, scheduled.registrationClosesAt)).toMatchObject({
      state: "closed", remainingMs: 0, canCreateMembership: false, reasonCode: "SERVER_REGISTRATION_CLOSED"
    });
  });

  it("distinguishes an emergency close without changing the scheduled close", () => {
    const state = resolveHostedServerRegistrationState({
      ...scheduled,
      registrationClosedAt: "2026-07-20T16:30:00.000Z"
    }, "2026-07-20T16:30:00.000Z");
    expect(state).toMatchObject({
      state: "closed_early",
      closesAt: scheduled.registrationClosesAt,
      closedAt: "2026-07-20T16:30:00.000Z",
      canCreateMembership: false,
      reasonCode: "SERVER_REGISTRATION_CLOSED_EARLY"
    });
  });

  it("fails closed for a window that is not exactly sixty minutes", () => {
    expect(resolveHostedServerRegistrationState({
      ...scheduled,
      registrationClosesAt: "2026-07-20T17:00:00.001Z"
    }, scheduled.registrationOpensAt)).toMatchObject({
      state: "closed", canCreateMembership: false, reasonCode: "SERVER_REGISTRATION_SCHEDULE_INVALID"
    });
  });
});
