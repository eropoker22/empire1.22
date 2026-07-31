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

const refreshedReadModel = Object.freeze({
  ...initialReadModel,
  server: { stateVersion: 3, status: "running" }
});

const appliedReadModel = Object.freeze({
  ...initialReadModel,
  server: { stateVersion: 4, status: "running" }
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

  it("reloads the mounted authoritative slice and retries one state-version conflict with a new command id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    let currentReadModel = initialReadModel;
    modules.source.setServerGameplaySliceReadModel(currentReadModel);
    const payload = {
      districtId: "district:home",
      buildingId: "building:restaurant:1",
      actionId: "restaurant_collect_revenue"
    };
    const mountedSubmit = vi.fn(async (command) => {
      if (mountedSubmit.mock.calls.length === 1) {
        currentReadModel = nextReadModel;
        return {
          accepted: false,
          errors: [{
            code: "server.state_version_conflict",
            message: "stale",
            details: { expectedStateVersion: 1, currentStateVersion: 2 }
          }],
          readModel: currentReadModel,
          transportFailure: false
        };
      }
      currentReadModel = appliedReadModel;
      return {
        accepted: true,
        errors: [],
        readModel: currentReadModel,
        transportFailure: false
      };
    });
    const selectDistrict = vi.fn(async () => {
      currentReadModel = refreshedReadModel;
      return { districtPanel: { districtId: "district:home" } };
    });
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => currentReadModel,
      getCurrentRenderState: () => ({
        districtPanel: { districtId: "district:home" }
      }),
      selectDistrict,
      submitCommand: mountedSubmit
    };

    const response = await modules.transport.submitServerGameplayCommand({
      type: "run-building-action",
      payload,
      focusDistrictId: "district:home",
      commandId: "command:building-action:stale"
    });

    expect(response).toMatchObject({ accepted: true, readModel: appliedReadModel });
    expect(selectDistrict).toHaveBeenCalledTimes(1);
    expect(selectDistrict).toHaveBeenCalledWith("district:home");
    expect(mountedSubmit).toHaveBeenCalledTimes(2);
    expect(mountedSubmit.mock.calls[0][0]).toMatchObject({
      id: "command:building-action:stale",
      type: "run-building-action",
      payload
    });
    expect(mountedSubmit.mock.calls[1][0]).toMatchObject({
      type: "run-building-action",
      payload
    });
    expect(mountedSubmit.mock.calls[1][0].id).not.toBe("command:building-action:stale");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs one direct authoritative load before rebasing the exact typed intent", async () => {
    const payload = {
      allianceId: "alliance:1",
      targetPlayerId: "player:target",
      expectedTargetMembershipVersion: 17
    };
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push({ url, request });
      if (url.endsWith("/load")) {
        return { json: async () => ({ accepted: true, errors: [], readModel: refreshedReadModel }) };
      }
      if (requests.filter((entry) => entry.url.endsWith("/submit")).length === 1) {
        return {
          json: async () => ({
            accepted: false,
            errors: [{ code: "server.state_version_conflict", message: "stale" }],
            readModel: nextReadModel
          })
        };
      }
      return { json: async () => ({ accepted: true, errors: [], readModel: appliedReadModel }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => null,
      getCurrentRenderState: () => ({ districtPanel: null }),
      submitCommand: vi.fn()
    };

    const response = await modules.transport.submitServerGameplayCommand({
      type: "start-alliance-kick-vote",
      payload,
      focusDistrictId: "district:home",
      commandId: "command:alliance:stale"
    });

    expect(response.accepted).toBe(true);
    expect(requests.map((entry) => entry.url)).toEqual([
      "/api/gameplay-slice/submit",
      "/api/gameplay-slice/load",
      "/api/gameplay-slice/submit"
    ]);
    expect(requests[1].request).toEqual({
      serverInstanceId: "instance:transport",
      playerId: "player:transport",
      districtId: "district:home"
    });
    expect(requests[0].request.expectedStateVersion).toBe(1);
    expect(requests[2].request.expectedStateVersion).toBe(3);
    expect(requests[2].request.command.id).not.toBe(requests[0].request.command.id);
    expect(requests[2].request.command.type).toBe(requests[0].request.command.type);
    expect(requests[2].request.command.payload).toEqual(payload);
  });

  it("never retries a semantic or mixed conflict", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        accepted: false,
        errors: [
          { code: "server.state_version_conflict", message: "stale" },
          { code: "TARGET_OWNER_CHANGED", message: "owner changed" }
        ],
        readModel: nextReadModel
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);

    const response = await modules.transport.submitServerGameplayCommand({
      type: "run-building-action",
      payload: { districtId: "district:home", buildingId: "building:restaurant:1", actionId: "collect" },
      focusDistrictId: "district:home"
    });

    expect(response.accepted).toBe(false);
    expect(response.errors.map((error) => error.code)).toEqual([
      "server.state_version_conflict",
      "TARGET_OWNER_CHANGED"
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows at most one rebased retry when the state version advances again", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({ url, request: JSON.parse(options.body) });
      if (url.endsWith("/load")) {
        return { json: async () => ({ accepted: true, errors: [], readModel: refreshedReadModel }) };
      }
      const stateVersion = requests.filter((entry) => entry.url.endsWith("/submit")).length === 1 ? 2 : 4;
      return {
        json: async () => ({
          accepted: false,
          errors: [{ code: "server.state_version_conflict", message: "stale again" }],
          readModel: { ...initialReadModel, server: { stateVersion, status: "running" } }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);

    const response = await modules.transport.submitServerGameplayCommand({
      type: "run-building-action",
      payload: { districtId: "district:home", buildingId: "building:restaurant:1", actionId: "collect" },
      focusDistrictId: "district:home"
    });

    expect(response.accepted).toBe(false);
    expect(response.errors[0].code).toBe("server.state_version_conflict");
    expect(requests.filter((entry) => entry.url.endsWith("/submit"))).toHaveLength(2);
    expect(requests.filter((entry) => entry.url.endsWith("/load"))).toHaveLength(1);
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
