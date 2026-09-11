// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";

let bountyModule;
afterEach(() => {
  bountyModule?.destroyBountyRuntime();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__;
  delete window.empireStreetsGameplaySliceReadModel;
  document.body.replaceChildren();
});

it("keeps the open bounty board on server time through pause, refresh and clock changes", async () => {
  vi.resetModules();
  vi.useFakeTimers();
  let mono = 0;
  vi.spyOn(performance, "now").mockImplementation(() => mono);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "server-authoritative";
  const { observeAuthoritativeSnapshot } = await import("../../packages/shared-types/src/views/authoritative-snapshot-clock.js");
  const epoch = Date.parse("2026-09-11T12:00:00Z");
  const publish = (tick, seconds, status = "running", bountyStatus = "active") => {
    const slice = {
      server: { serverInstanceId: "free:bounty-clock", currentTick: tick, status,
        generatedAt: new Date(epoch + seconds * 1000).toISOString(),
        logicalTime: new Date(epoch + seconds * 1000).toISOString() },
      mode: { tickRateMs: 10000 },
      bounty: { minRewardCleanCash: 5000, currentPlayerCleanCash: 25000,
        eligibleTargets: [], durationOptionsHours: [1], activeBounties: [{
          bountyId: "b1", targetPlayerId: "target", targetPlayerName: "Cíl",
          status: bountyStatus, rewardCleanCash: 5000, expiresAtTick: 120,
          remainingMs: bountyStatus === "active" ? (120 - tick) * 10000 : 0
        }] }
    };
    observeAuthoritativeSnapshot(slice, null, mono);
    window.empireStreetsGameplaySliceReadModel = slice;
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", { detail: { gameplaySlice: slice } }));
  };
  publish(0, 0, "paused");
  document.body.innerHTML = readFileSync("pages/game.html", "utf8");
  bountyModule = await import("../../page-assets/js/app/bounty-runtime.js");
  bountyModule.initBountyRuntime();
  document.dispatchEvent(new CustomEvent("empire:open-bounty-modal"));
  const remaining = () => document.querySelector("[data-bounty-remaining]")?.textContent;
  expect(remaining()).toBe("Pozastaveno · 20m");
  mono = 30000;
  vi.advanceTimersByTime(30000);
  expect(remaining()).toBe("Pozastaveno · 20m");
  publish(0, 30);
  vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000);
  mono = 40000;
  vi.advanceTimersByTime(1000);
  expect(remaining()).toBe("19m 50s");
  mono = 100000;
  publish(7, 100);
  expect(remaining()).toBe("18m 50s");
  mono = 161000;
  vi.advanceTimersByTime(1000);
  expect(remaining()).toBe("Čeká na server");
  publish(120, 1200);
  expect(remaining()).toBe("Čeká na potvrzení serveru");
  publish(120, 1200, "running", "cancelled");
  expect(remaining()).toBeUndefined();
  expect(document.querySelector('[data-bounty-row="b1"]').textContent).toContain("Zrušeno");
});
