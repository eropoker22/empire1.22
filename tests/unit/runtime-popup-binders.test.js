import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { createRuntimePopupBinders } from "../../page-assets/js/app/ui/runtimePopupBinders.js";

describe("runtime popup binders", () => {
  it("does not crash when root is missing", () => {
    const binders = createRuntimePopupBinders();

    expect(() => binders.bindSettingsModal(null)).not.toThrow();
    expect(() => binders.bindPlayerProfilePopup(null)).not.toThrow();
    expect(() => binders.bindAlliancePopup(null)).not.toThrow();
    expect(() => binders.bindStoragePopup(null)).not.toThrow();
    expect(() => binders.bindLogoutActions(null)).not.toThrow();
    expect(() => binders.bindSpyResourceToggle(null)).not.toThrow();
  });

  it("falls back to lobby navigation when the modal shell is missing", () => {
    const button = {
      listeners: {},
      addEventListener(type, callback) {
        this.listeners[type] = callback;
      }
    };
    const root = {
      ownerDocument: {
        querySelector() {
          return null;
        },
        querySelectorAll(selector) {
          return selector === "[data-nav-logout]" ? [button] : [];
        }
      }
    };
    const windowRef = { location: { href: "" } };
    const binders = createRuntimePopupBinders({
      NAV_LOGOUT_SELECTOR: "[data-nav-logout]",
      getStoredRegistration: () => ({ serverMode: "free" }),
      windowRef
    });

    binders.bindLogoutActions(root);
    button.listeners.click();

    expect(windowRef.location.href).toBe("./lobby.html");
  });

  it("opens the Lobby modal and revokes both sessions on account logout without leaving membership", async () => {
    const dom = new JSDOM(`<!doctype html><body>
      <button data-nav-logout>Lobby</button>
      <div data-game-lobby-modal hidden aria-hidden="true">
        <button data-game-lobby-close></button>
        <button data-game-lobby-action="lobby"></button>
        <button data-game-lobby-action="logout"></button>
        <button data-game-lobby-action="leave-server"><span data-game-leave-cooldown></span></button>
        <p data-game-lobby-error></p>
      </div>
    </body>`, { url: "http://localhost/pages/game.html" });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ accepted: true }) });
    const logoutAccountRequest = vi.fn().mockResolvedValue(null);
    const leaveMembershipRequest = vi.fn();
    const loadLobbyOverviewRequest = vi.fn().mockResolvedValue({
      activeBlockingMembership: {
        membershipId: "membership:1",
        canLeaveEarly: true,
        earlyLeaveDeadline: "2026-07-17T11:00:00.000Z",
        earlyLeaveRemainingMs: 30 * 60 * 1000
      }
    });
    const windowRef = {
      location: { href: "" },
      fetch,
      setInterval: vi.fn(() => 7),
      clearInterval: vi.fn()
    };
    const binders = createRuntimePopupBinders({
      NAV_LOGOUT_SELECTOR: "[data-nav-logout]",
      getStoredRegistration: () => ({ serverMode: "free", serverStartedAt: "2026-07-17T10:00:00.000Z" }),
      loadLobbyOverviewRequest,
      logoutAccountRequest,
      leaveMembershipRequest,
      now: () => Date.parse("2026-07-17T10:30:00.000Z"),
      windowRef
    });

    binders.bindLogoutActions(dom.window.document.body);
    dom.window.document.querySelector("[data-nav-logout]").click();
    await vi.waitFor(() => expect(loadLobbyOverviewRequest).toHaveBeenCalledTimes(1));
    expect(dom.window.document.querySelector("[data-game-lobby-modal]").hidden).toBe(false);
    expect(dom.window.document.querySelector('[data-game-lobby-action="leave-server"]').disabled).toBe(false);
    expect(dom.window.document.querySelector("[data-game-leave-cooldown]").textContent).toContain("30:00");
    dom.window.document.querySelector('[data-game-lobby-action="logout"]').click();
    await vi.waitFor(() => expect(windowRef.location.href).toBe("./login.html?mode=free"));

    expect(fetch).toHaveBeenCalledWith("/api/gameplay-slice/logout", expect.objectContaining({ method: "POST" }));
    expect(logoutAccountRequest).toHaveBeenCalledTimes(1);
    expect(leaveMembershipRequest).not.toHaveBeenCalled();
  });

  it("disables server leave when the authoritative membership says the window expired", async () => {
    const dom = new JSDOM(`<!doctype html><body><button data-nav-logout>Lobby</button>
      <div data-game-lobby-modal hidden><button data-game-lobby-action="leave-server"><span data-game-leave-cooldown></span></button></div>
    </body>`);
    const fetch = vi.fn();
    const binders = createRuntimePopupBinders({
      NAV_LOGOUT_SELECTOR: "[data-nav-logout]",
      loadLobbyOverviewRequest: vi.fn().mockResolvedValue({ activeBlockingMembership: {
        membershipId: "membership:1", canLeaveEarly: false, earlyLeaveDeadline: "2026-07-17T11:00:00.000Z", earlyLeaveRemainingMs: 0
      } }),
      now: () => Date.parse("2026-07-17T11:00:00.001Z"),
      windowRef: { location: { href: "" }, fetch, setInterval: vi.fn(() => 1), clearInterval: vi.fn() }
    });

    binders.bindLogoutActions(dom.window.document.body);
    dom.window.document.querySelector("[data-nav-logout]").click();
    await vi.waitFor(() => expect(dom.window.document.querySelector('[data-game-lobby-action="leave-server"]').disabled).toBe(true));
    const leave = dom.window.document.querySelector('[data-game-lobby-action="leave-server"]');
    expect(leave.disabled).toBe(true);
    expect(dom.window.document.querySelector("[data-game-leave-cooldown]").textContent).toContain("vypršela");
    leave.click();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requests authoritative early leave and revokes the gameplay session once", async () => {
    const dom = new JSDOM(`<!doctype html><body><button data-nav-logout>Lobby</button>
      <div data-game-lobby-modal hidden><button data-game-lobby-action="leave-server"><span data-game-leave-cooldown></span></button></div>
    </body>`);
    const leaveMembershipRequest = vi.fn().mockResolvedValue(null);
    const loadLobbyOverviewRequest = vi.fn().mockResolvedValue({ activeBlockingMembership: {
      membershipId: "membership:1", canLeaveEarly: true, earlyLeaveDeadline: "2026-07-17T11:00:00.000Z", earlyLeaveRemainingMs: 1_000
    } });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ accepted: true }) });
    const windowRef = { location: { href: "" }, fetch, setInterval: vi.fn(() => 1), clearInterval: vi.fn() };
    const binders = createRuntimePopupBinders({
      NAV_LOGOUT_SELECTOR: "[data-nav-logout]",
      getStoredRegistration: () => ({ serverMode: "free", serverStartedAt: "2026-07-17T10:00:00.000Z" }),
      loadLobbyOverviewRequest,
      leaveMembershipRequest,
      now: () => Date.parse("2026-07-17T10:59:59.000Z"),
      windowRef
    });

    binders.bindLogoutActions(dom.window.document.body);
    dom.window.document.querySelector("[data-nav-logout]").click();
    await vi.waitFor(() => expect(loadLobbyOverviewRequest).toHaveBeenCalledTimes(1));
    dom.window.document.querySelector('[data-game-lobby-action="leave-server"]').click();
    await vi.waitFor(() => expect(windowRef.location.href).toBe("./lobby.html?mode=free"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(leaveMembershipRequest).toHaveBeenCalledWith("membership:1");
  });
});
