// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initialReadModel = Object.freeze({
  server: { serverInstanceId: "instance:transport", stateVersion: 1, status: "running" },
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
  server: { serverInstanceId: "instance:transport", stateVersion: 2, status: "running" }
});

const refreshedReadModel = Object.freeze({
  ...initialReadModel,
  server: { serverInstanceId: "instance:transport", stateVersion: 3, status: "running" }
});

const appliedReadModel = Object.freeze({
  ...initialReadModel,
  server: { serverInstanceId: "instance:transport", stateVersion: 4, status: "running" }
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

  it("reuses the mounted conflict slice and retries with a new command id", async () => {
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
    expect(selectDistrict).not.toHaveBeenCalled();
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

  it("rebases the exact typed intent from the authoritative conflict slice", async () => {
    const payload = {
      allianceId: "alliance:1",
      targetPlayerId: "player:target",
      expectedTargetMembershipVersion: 17
    };
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push({ url, request });
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
      "/api/gameplay-slice/submit"
    ]);
    expect(requests[0].request.expectedStateVersion).toBe(1);
    expect(requests[1].request.expectedStateVersion).toBe(2);
    expect(requests[1].request.command.id).not.toBe(requests[0].request.command.id);
    expect(requests[1].request.command.type).toBe(requests[0].request.command.type);
    expect(requests[1].request.command.payload).toEqual(payload);
  });

  it.each([
    ["no slice", null],
    ["another player", { ...nextReadModel, player: { ...nextReadModel.player, playerId: "player:other" } }],
    ["another player instance", { ...nextReadModel, player: { ...nextReadModel.player, instanceId: "instance:other" } }],
    ["another server instance", { ...nextReadModel, server: { ...nextReadModel.server, serverInstanceId: "instance:other" } }],
    ["another district", { ...nextReadModel, district: { districtId: "district:other" } }],
    ["missing state version", { ...nextReadModel, server: { serverInstanceId: "instance:transport", status: "running" } }],
    ["invalid state version", { ...nextReadModel, server: { ...nextReadModel.server, stateVersion: Number.NaN } }]
  ])("falls back to one authoritative load for %s in the conflict response", async (_caseName, conflictReadModel) => {
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
            readModel: conflictReadModel
          })
        };
      }
      return { json: async () => ({ accepted: true, errors: [], readModel: appliedReadModel }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);

    const response = await modules.transport.submitServerGameplayCommand({
      type: "start-alliance-kick-vote",
      payload: { allianceId: "alliance:1", targetPlayerId: "player:target" },
      focusDistrictId: "district:home",
      commandId: "command:alliance:load-fallback"
    });

    expect(response.accepted).toBe(true);
    expect(requests.map((entry) => entry.url)).toEqual([
      "/api/gameplay-slice/submit",
      "/api/gameplay-slice/load",
      "/api/gameplay-slice/submit"
    ]);
    expect(requests[2].request.expectedStateVersion).toBe(3);
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

  it("rebases twice when two consecutive durable conflicts each advance authority", async () => {
    const payload = {
      districtId: "district:home",
      buildingId: "building:restaurant:1",
      actionId: "collect"
    };
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push({ url, request });
      const submitCount = requests.filter((entry) => entry.url.endsWith("/submit")).length;
      if (submitCount <= 2) {
        const stateVersion = submitCount === 1 ? 2 : 4;
        return {
          json: async () => ({
            accepted: false,
            errors: [{ code: "server.state_version_conflict", message: "stale" }],
            readModel: {
              ...initialReadModel,
              server: { serverInstanceId: "instance:transport", stateVersion, status: "running" }
            }
          })
        };
      }
      return {
        json: async () => ({
          accepted: true,
          errors: [],
          readModel: {
            ...initialReadModel,
            server: { serverInstanceId: "instance:transport", stateVersion: 5, status: "running" }
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);

    const response = await modules.transport.submitServerGameplayCommand({
      type: "run-building-action",
      payload,
      focusDistrictId: "district:home",
      commandId: "command:double-rebase"
    });

    expect(response.accepted).toBe(true);
    const submitRequests = requests.filter((entry) => entry.url.endsWith("/submit"));
    expect(submitRequests.map(({ request }) => request.expectedStateVersion)).toEqual([1, 2, 4]);
    expect(new Set(submitRequests.map(({ request }) => request.command.id)).size).toBe(3);
    expect(submitRequests.map(({ request }) => request.command.type))
      .toEqual(Array(3).fill("run-building-action"));
    expect(submitRequests.map(({ request }) => request.command.payload))
      .toEqual(Array(3).fill(payload));
    expect(requests.filter((entry) => entry.url.endsWith("/load"))).toHaveLength(0);
  });

  it("allows at most two rebased retries when authority keeps advancing", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({ url, request: JSON.parse(options.body) });
      if (url.endsWith("/load")) {
        return { json: async () => ({ accepted: true, errors: [], readModel: refreshedReadModel }) };
      }
      const submitCount = requests.filter((entry) => entry.url.endsWith("/submit")).length;
      const stateVersion = submitCount === 1 ? 2 : submitCount === 2 ? 4 : 6;
      return {
        json: async () => ({
          accepted: false,
          errors: [{ code: "server.state_version_conflict", message: "stale again" }],
          readModel: {
            ...initialReadModel,
            server: { serverInstanceId: "instance:transport", stateVersion, status: "running" }
          }
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
    expect(requests.filter((entry) => entry.url.endsWith("/submit"))).toHaveLength(3);
    expect(requests.filter((entry) => entry.url.endsWith("/load"))).toHaveLength(0);
  });

  it("does not rebase against a conflict slice that did not advance stateVersion", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        accepted: false,
        errors: [{ code: "server.state_version_conflict", message: "stale" }],
        readModel: initialReadModel
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const modules = await loadGameplayModules();
    modules.source.setServerGameplaySliceReadModel(initialReadModel);

    const response = await modules.transport.submitServerGameplayCommand({
      type: "run-building-action",
      payload: {
        districtId: "district:home",
        buildingId: "building:restaurant:1",
        actionId: "collect"
      },
      focusDistrictId: "district:home"
    });

    expect(response.accepted).toBe(false);
    expect(response.errors[0].code).toBe("server.state_version_conflict");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
