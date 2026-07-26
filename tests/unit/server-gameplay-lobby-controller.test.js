// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayLobbyController
} from "../../page-assets/js/app/ui/serverGameplayLobbyController.js";

describe("server gameplay lobby controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("mounts listeners once, owns one cooldown timer, and cleans both up", async () => {
    const timerWindow = createTimerWindow();
    const loadLobbyOverview = vi.fn().mockResolvedValue({
      activeBlockingMembership: createMembership()
    });
    const controller = createController({
      timerWindow,
      loadLobbyOverview
    });
    const openButton = document.querySelector("[data-nav-logout]");
    const addListener = vi.spyOn(openButton, "addEventListener");
    const removeListener = vi.spyOn(openButton, "removeEventListener");

    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(addListener.mock.calls.filter(([type]) => type === "click")).toHaveLength(1);
    expect(controller.open()).toBe(true);
    expect(controller.open()).toBe(false);

    await vi.waitFor(() => expect(loadLobbyOverview).toHaveBeenCalledTimes(1));
    expect(timerWindow.setInterval).toHaveBeenCalledTimes(1);
    expect(controller.getDiagnostics()).toMatchObject({
      mounted: true,
      open: true,
      timerActive: true
    });

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
    expect(timerWindow.clearInterval).toHaveBeenCalledTimes(1);
    expect(timerWindow.clearInterval).toHaveBeenCalledWith(41);
    expect(removeListener.mock.calls.filter(([type]) => type === "click")).toHaveLength(1);

    expect(controller.open()).toBe(false);
    expect(loadLobbyOverview).toHaveBeenCalledTimes(1);
    expect(timerWindow.setInterval).toHaveBeenCalledTimes(1);
  });

  it("leaves membership before revoking gameplay session and navigating", async () => {
    const order = [];
    const leaveMembership = vi.fn(async (membershipId) => {
      order.push(`leave:${membershipId}`);
    });
    const revokeGameplaySession = vi.fn(async () => {
      order.push("revoke");
      return { accepted: true };
    });
    const navigate = vi.fn((href) => {
      order.push(`navigate:${href}`);
    });
    const controller = createController({
      loadLobbyOverview: vi.fn().mockResolvedValue({
        activeBlockingMembership: createMembership()
      }),
      leaveMembership,
      revokeGameplaySession,
      navigate
    });
    controller.mount();
    controller.update({ mode: { mode: "free" } });
    controller.open();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-game-lobby-action="leave-server"]').disabled).toBe(false);
    });

    await expect(controller.runAction("leave-server")).resolves.toBe(true);

    expect(order).toEqual([
      "leave:membership:active",
      "revoke",
      "navigate:./lobby.html?mode=free"
    ]);
    expect(leaveMembership).toHaveBeenCalledTimes(1);
    expect(revokeGameplaySession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it("revokes gameplay before account logout and login navigation", async () => {
    const order = [];
    const revokeGameplaySession = vi.fn(async () => {
      order.push("revoke");
      return { accepted: true };
    });
    const logoutAccount = vi.fn(async () => {
      order.push("account-logout");
    });
    const navigate = vi.fn((href) => {
      order.push(`navigate:${href}`);
    });
    const controller = createController({
      revokeGameplaySession,
      logoutAccount,
      navigate
    });
    controller.mount();
    controller.update({ player: { mode: "war" } });

    await expect(controller.runAction("logout")).resolves.toBe(true);

    expect(order).toEqual([
      "revoke",
      "account-logout",
      "navigate:./login.html?mode=war"
    ]);
    expect(logoutAccount).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it("uses the gameplay revoke endpoint before the real account logout adapter", async () => {
    const timerWindow = createTimerWindow();
    timerWindow.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ accepted: true })
    });
    const logoutAccount = vi.fn();
    const navigate = vi.fn();
    const controller = createController({
      timerWindow,
      revokeGameplaySession: null,
      logoutAccount,
      navigate
    });
    controller.mount();

    await expect(controller.runAction("logout")).resolves.toBe(true);

    expect(timerWindow.fetch).toHaveBeenCalledWith(
      "/api/gameplay-slice/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      })
    );
    expect(logoutAccount).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("./login.html");
    controller.destroy();
  });

  it("fails closed when gameplay revocation fails", async () => {
    const logoutAccount = vi.fn();
    const navigate = vi.fn();
    const controller = createController({
      revokeGameplaySession: vi.fn().mockRejectedValue(
        new Error("Session se nepodařilo bezpečně ukončit.")
      ),
      logoutAccount,
      navigate
    });
    controller.mount();

    await expect(controller.runAction("logout")).resolves.toBe(false);

    expect(logoutAccount).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.querySelector("[data-game-lobby-error]").textContent).toBe(
      "Session se nepodařilo bezpečně ukončit."
    );
    expect(controller.getDiagnostics().busy).toBe(false);
    controller.destroy();
  });
});

function createController(overrides = {}) {
  const timerWindow = overrides.timerWindow || createTimerWindow();
  return createServerGameplayLobbyController({
    root: document.querySelector("#game-root"),
    documentRef: document,
    windowRef: timerWindow,
    now: () => 10_000,
    loadLobbyOverview: overrides.loadLobbyOverview || vi.fn().mockResolvedValue({
      activeBlockingMembership: createMembership()
    }),
    leaveMembership: overrides.leaveMembership || vi.fn(),
    revokeGameplaySession: Object.hasOwn(overrides, "revokeGameplaySession")
      ? overrides.revokeGameplaySession
      : vi.fn().mockResolvedValue({ accepted: true }),
    logoutAccount: overrides.logoutAccount || vi.fn(),
    navigate: overrides.navigate || vi.fn(),
    managePageLifecycle: false,
    manageSourceSubscription: false
  });
}

function createTimerWindow() {
  return {
    setInterval: vi.fn(() => 41),
    clearInterval: vi.fn()
  };
}

function createMembership() {
  return {
    membershipId: "membership:active",
    canLeaveEarly: true,
    earlyLeaveDeadline: "2026-07-26T12:00:00.000Z",
    earlyLeaveRemainingMs: 60_000
  };
}

function createFixture() {
  return `<main id="game-root">
    <button type="button" data-nav-logout>Lobby</button>
    <section data-game-lobby-modal hidden>
      <button type="button" data-game-lobby-close>Zavřít</button>
      <button type="button" data-game-lobby-action="lobby">Do lobby</button>
      <button type="button" data-game-lobby-action="leave-server">Opustit server</button>
      <button type="button" data-game-lobby-action="logout">Odhlásit účet</button>
      <p data-game-leave-cooldown></p>
      <p data-game-lobby-error></p>
    </section>
  </main>`;
}
