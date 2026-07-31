// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initialReadModel = Object.freeze({
  server: { stateVersion: 1, status: "running" },
  player: {
    playerId: "player:transport",
    instanceId: "instance:transport",
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

describe("server gameplay command transport", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    window.empireStreetsGameplayConnectionState = "connected";
    document.documentElement.dataset.gameplayExecutionMode = "server-authoritative";
    delete document.documentElement.dataset.onboardingSandbox;
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
    document.body.innerHTML = '<main data-gameplay-slice-client data-gameplay-slice-endpoint-base="/api/gameplay-slice"></main>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    delete document.documentElement.dataset.gameplayExecutionMode;
    delete document.documentElement.dataset.onboardingSandbox;
    delete window.empireStreetsGameplayConnectionState;
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
  });

  it("uses the canonical endpoint when no district panel is active", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        accepted: true,
        errors: [],
        readModel: nextReadModel
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);
    const mountedSubmit = vi.fn();
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => initialReadModel,
      getCurrentRenderState: () => ({ districtPanel: null }),
      submitCommand: mountedSubmit
    };

    const response = await modules.transport.submitServerGameplayCommand({
      type: "start-city-event",
      payload: { offerId: "city-event:offer:1" },
      focusDistrictId: "district:home",
      commandId: "command:city-event:direct"
    });

    expect(response.accepted).toBe(true);
    expect(mountedSubmit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gameplay-slice/submit",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reuses the mounted client for its active district panel", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);
    const mountedSubmit = vi.fn().mockResolvedValue({
      accepted: true,
      errors: [],
      readModel: nextReadModel,
      transportFailure: false
    });
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => initialReadModel,
      getCurrentRenderState: () => ({
        districtPanel: { districtId: "district:home" }
      }),
      submitCommand: mountedSubmit
    };

    const response = await modules.transport.submitServerGameplayCommand({
      type: "start-city-event",
      payload: { offerId: "city-event:offer:2" },
      focusDistrictId: "district:home",
      commandId: "command:city-event:mounted"
    });

    expect(response.accepted).toBe(true);
    expect(mountedSubmit).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry a command while its mounted-client submission is still in flight", async () => {
    let resolveSubmission;
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        status: "not_found",
        accepted: false,
        errors: [],
        readModel: initialReadModel
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);
    const mountedSubmit = vi.fn(() => new Promise((resolve) => {
      resolveSubmission = resolve;
    }));
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => initialReadModel,
      getCurrentRenderState: () => ({
        districtPanel: { districtId: "district:home" }
      }),
      submitCommand: mountedSubmit
    };

    const submission = modules.transport.submitServerGameplayCommand({
      type: "craft-item",
      payload: {
        districtId: "district:home",
        buildingId: "building:drug-lab:1",
        recipeId: "neon-dust",
        quantity: 1
      },
      focusDistrictId: "district:home",
      commandId: "command:craft-item:in-flight"
    });
    await vi.waitFor(() => expect(mountedSubmit).toHaveBeenCalledTimes(1));

    await expect(modules.transport.retryPendingServerGameplayCommands()).resolves.toEqual([null]);
    expect(mountedSubmit).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    resolveSubmission({
      accepted: true,
      errors: [],
      readModel: nextReadModel,
      transportFailure: false
    });
    await expect(submission).resolves.toMatchObject({
      accepted: true,
      readModel: nextReadModel
    });
  });
});
