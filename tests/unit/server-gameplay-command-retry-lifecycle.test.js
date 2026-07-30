// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initialReadModel = Object.freeze({
  server: { stateVersion: 1, status: "running" },
  player: {
    playerId: "player:retry",
    instanceId: "instance:retry",
    mode: "free",
    homeDistrictId: "district:home"
  },
  district: { districtId: "district:home" }
});

const nextReadModel = Object.freeze({
  ...initialReadModel,
  server: { stateVersion: 2, status: "running" }
});

const loadGameplayModules = async () => {
  const source = await import("../../page-assets/js/app/runtime/serverGameplaySource.js");
  const transport = await import("../../page-assets/js/app/runtime/serverGameplayCommandTransport.js");
  return { source, transport };
};

const prepareRetry = ({ source, transport }) => {
  source.setServerGameplaySliceReadModel(initialReadModel);
  return transport.prepareServerGameplayCommand({
    type: "attack-district",
    payload: { districtId: "district:target" },
    focusDistrictId: "district:target",
    commandId: "command:retry:lifecycle"
  });
};

describe("server gameplay command retry lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.empireStreetsGameplayConnectionState = "connected";
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
    document.body.innerHTML = '<main data-gameplay-slice-client data-gameplay-slice-endpoint-base="/api/gameplay-slice"></main>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    delete window.empireStreetsGameplayConnectionState;
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
  });

  it("does not start another retry request after source destroy", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ status: "pending" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    prepareRetry(modules);

    const retryPromise = modules.transport.retryPendingServerGameplayCommands();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    modules.source.destroy();

    await vi.runAllTimersAsync();
    await expect(retryPromise).resolves.toEqual([null]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a terminal retry response that arrives after source destroy", async () => {
    let resolveResponse;
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    prepareRetry(modules);
    const rendered = vi.fn();
    document.addEventListener("empire:gameplay-slice-rendered", rendered);

    const retryPromise = modules.transport.retryPendingServerGameplayCommands();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    modules.source.destroy();
    resolveResponse({
      json: async () => ({
        status: "applied",
        accepted: true,
        readModel: nextReadModel
      })
    });

    await expect(retryPromise).resolves.toEqual([null]);
    expect(modules.source.getCurrentReadModel()).toEqual(initialReadModel);
    expect(rendered).not.toHaveBeenCalled();
    document.removeEventListener("empire:gameplay-slice-rendered", rendered);
  });
});
