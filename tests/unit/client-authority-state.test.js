import { describe, expect, it } from "vitest";
import {
  CLIENT_EXECUTION_MODES,
  resolveClientAuthorityState
} from "../../page-assets/js/app/runtime/clientAuthorityState.js";

const storage = (enabled = false) => ({
  getItem: () => enabled ? "1" : null,
  setItem: () => {},
  removeItem: () => {}
});

describe("client authority state", () => {
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
