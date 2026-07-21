import { describe, expect, it, vi } from "vitest";
import {
  createHostedRegistrationTicker,
  hostedRegistrationCtaLabel,
  hostedRegistrationDisabledCopy,
  resolveHostedRegistrationPresentation
} from "../../page-assets/js/app/hosted-registration-ui.js";

const opensAt = "2026-07-18T16:00:00.000Z";
const closesAt = "2026-07-18T17:00:00.000Z";

describe("hosted registration browser presentation", () => {
  it("keeps scheduled registration closed until a fresh server response arrives", () => {
    const server = hosted({ registrationState: "scheduled", joinable: false });
    expect(resolveHostedRegistrationPresentation(server, Date.parse(opensAt) - 1)).toMatchObject({
      state: "scheduled",
      statusLabel: "REGISTRACE NAPLÁNOVÁNA",
      locallyJoinable: false,
      needsRefresh: false,
      remainingMs: 1
    });
    expect(resolveHostedRegistrationPresentation(server, Date.parse(opensAt))).toMatchObject({
      statusLabel: "REGISTRACI OVĚŘUJI",
      locallyJoinable: false,
      needsRefresh: true
    });
  });

  it("renders an open interval as [opensAt, closesAt)", () => {
    const server = hosted({ registrationState: "open", joinable: true, status: "running" });
    expect(resolveHostedRegistrationPresentation(server, Date.parse(opensAt))).toMatchObject({
      statusLabel: "SERVER BĚŽÍ · REGISTRACE OTEVŘENA",
      locallyJoinable: true
    });
    expect(resolveHostedRegistrationPresentation(server, Date.parse(closesAt) - 1)).toMatchObject({
      state: "open",
      locallyJoinable: true,
      remainingMs: 1
    });
    expect(resolveHostedRegistrationPresentation(server, Date.parse(closesAt))).toMatchObject({
      state: "closed",
      locallyJoinable: false,
      needsRefresh: true
    });
  });

  it("uses canonical Czech CTA and failure copy", () => {
    expect(hostedRegistrationCtaLabel(hosted({ registrationState: "closed", joinable: false }), Date.parse(closesAt)))
      .toBe("REGISTRACE UKONČENA");
    expect(hostedRegistrationDisabledCopy("SERVER_REGISTRATION_NOT_OPEN"))
      .toBe("Registrace na tento server ještě nezačala.");
    expect(hostedRegistrationDisabledCopy("WORKER_OFFLINE"))
      .toBe("Server se právě nepodařilo bezpečně připojit k hernímu workeru.");
  });

  it("creates one shared interval and advances from authoritative generatedAt", () => {
    let callback = null;
    let performanceNow = 10;
    const onTick = vi.fn();
    const windowRef = {
      setInterval: vi.fn((handler) => { callback = handler; return 7; }),
      clearInterval: vi.fn()
    };
    const ticker = createHostedRegistrationTicker({
      onTick,
      windowRef,
      performanceRef: { now: () => performanceNow }
    });
    ticker.syncServerTime("2026-07-18T16:00:00.000Z");
    ticker.start();
    ticker.start();
    expect(windowRef.setInterval).toHaveBeenCalledTimes(1);
    expect(ticker.nowMs()).toBe(Date.parse("2026-07-18T16:00:00.000Z"));
    performanceNow += 1_250;
    callback();
    expect(onTick).toHaveBeenLastCalledWith(Date.parse("2026-07-18T16:00:01.250Z"));
    ticker.stop();
    expect(windowRef.clearInterval).toHaveBeenCalledWith(7);
  });
});

const hosted = (overrides = {}) => ({
  serverInstanceId: "instance:free:test",
  status: "lobby",
  registrationState: "scheduled",
  registrationOpensAt: opensAt,
  registrationClosesAt: closesAt,
  registrationRemainingMs: 60 * 60 * 1_000,
  joinable: false,
  disabledReason: "SERVER_REGISTRATION_NOT_OPEN",
  ...overrides
});
