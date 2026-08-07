import { describe, expect, it } from "vitest";
import {
  CLIENT_EXECUTION_MODES,
  isE2eLocalDemoEntryEnabled,
  resolveClientAuthorityState
} from "../../page-assets/js/app/runtime/clientAuthorityState.js";

const storage = (enabled = false) => ({
  getItem: () => enabled ? "1" : null,
  setItem: () => {},
  removeItem: () => {}
});

describe("client authority state", () => {
  it("opens the demo entry only for the explicit loopback E2E flag pair", () => {
    const locationRef = { hostname: "127.0.0.1", search: "?runtimeMode=local-demo" };
    expect(isE2eLocalDemoEntryEnabled({
      windowRef: { __EMPIRE_E2E__: true },
      locationRef,
      configOverrides: { localDemoEnabled: true }
    })).toBe(true);
    expect(isE2eLocalDemoEntryEnabled({
      windowRef: { __EMPIRE_E2E__: false },
      locationRef,
      configOverrides: { localDemoEnabled: true }
    })).toBe(false);
    expect(isE2eLocalDemoEntryEnabled({
      windowRef: { __EMPIRE_E2E__: true },
      locationRef,
      configOverrides: { localDemoEnabled: false }
    })).toBe(false);
    expect(isE2eLocalDemoEntryEnabled({
      windowRef: { __EMPIRE_E2E__: true },
      locationRef: { hostname: "empirestreets.cz", search: "?runtimeMode=local-demo" },
      configOverrides: { localDemoEnabled: true }
    })).toBe(false);
    expect(isE2eLocalDemoEntryEnabled({
      windowRef: { __EMPIRE_E2E__: true },
      locationRef: { hostname: "localhost", search: "" },
      configOverrides: { localDemoEnabled: true }
    })).toBe(false);
  });

  it("fails closed to server authority on a public host", () => {
    const state = resolveClientAuthorityState({
      locationRef: { hostname: "empirestreets.cz", search: "?runtimeMode=local-demo" },
      sessionStorageRef: storage(true),
      configOverrides: { localDemoEnabled: true }
    });

    expect(state.executionMode).toBe(CLIENT_EXECUTION_MODES.serverAuthoritative);
    expect(state.environment).toBe("production");
    expect(state.fixturesAllowed).toBe(false);
  });

  it("allows fixtures only in an explicit loopback demo", () => {
    const state = resolveClientAuthorityState({
      locationRef: { hostname: "127.0.0.1", search: "?runtimeMode=local-demo" },
      sessionStorageRef: storage()
    });

    expect(state.executionMode).toBe(CLIENT_EXECUTION_MODES.localDemo);
    expect(state.environment).toBe("local");
    expect(state.fixturesAllowed).toBe(true);
  });

  it("keeps a server-authoritative game entrypoint pinned against loopback demo overrides", () => {
    for (const override of [
      { search: "?runtimeMode=local-demo", sessionStorageRef: storage() },
      { search: "", sessionStorageRef: storage(true) },
      { search: "", sessionStorageRef: storage(), configOverrides: { localDemoEnabled: true } }
    ]) {
      const state = resolveClientAuthorityState({
        windowRef: {
          __EMPIRE_GAMEPLAY_EXECUTION_MODE__: CLIENT_EXECUTION_MODES.serverAuthoritative
        },
        locationRef: { hostname: "127.0.0.1", search: override.search },
        sessionStorageRef: override.sessionStorageRef,
        configOverrides: override.configOverrides
      });

      expect(state.executionMode).toBe(CLIENT_EXECUTION_MODES.serverAuthoritative);
      expect(state.environment).toBe("local");
      expect(state.fixturesAllowed).toBe(false);
    }
  });

  it("keeps server-authoritative mode while live data reconnects", () => {
    const state = resolveClientAuthorityState({
      locationRef: { hostname: "empirestreets.cz", search: "" },
      accountReady: true,
      membershipReady: true,
      serverReady: false,
      gameplayReady: false
    });

    expect(state.executionMode).toBe(CLIENT_EXECUTION_MODES.serverAuthoritative);
    expect(state.fixturesAllowed).toBe(false);
    expect(state.reasonCode).toBe("SERVER_CONNECTION_PENDING");
  });
});
