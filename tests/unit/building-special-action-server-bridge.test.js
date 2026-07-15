import { describe, expect, it, vi } from "vitest";
import {
  createServerBuildingActionSubmitRequest,
  submitServerBuildingActionCommandBridge
} from "../../page-assets/js/app/runtime/buildingSpecialActionServerBridge.js";
import { resolveBuildingSpecialActionDefinition } from "../../page-assets/js/app/runtime/buildingSpecialActionRegistry.js";
import { DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES } from "../../page-assets/js/app/runtime/buildingDetailData.js";

const downtownActions = [
  ["Burza", "Spekulativní nákup", 0, "stock_exchange", "building:district-79:stock_exchange:1"],
  ["Burza", "Tržní tlak", 1, "stock_exchange", "building:district-79:stock_exchange:1"],
  ["Burza", "Insider Window", 2, "stock_exchange", "building:district-79:stock_exchange:1"],
  ["Centrální banka", "Likviditní injekce", 0, "central_bank", "building:district-79:central_bank:1"],
  ["Centrální banka", "Zmražené účty", 1, "central_bank", "building:district-79:central_bank:1"],
  ["Centrální banka", "Kurzovní intervence", 2, "central_bank", "building:district-79:central_bank:1"],
  ["Magistrát", "Úřední krytí", 0, "city_hall", "building:district-79:city_hall:1"],
  ["Magistrát", "Městská zakázka", 1, "city_hall", "building:district-79:city_hall:1"],
  ["Magistrát", "Nouzová vyhláška", 2, "city_hall", "building:district-79:city_hall:1"],
  ["Lobby klub", "Zákulisní tlak", 0, "lobby_club", "building:district-79:lobby_club:1"],
  ["Lobby klub", "Tiché vyjednávání", 1, "lobby_club", "building:district-79:lobby_club:1"],
  ["Lobby klub", "Mediální clona", 2, "lobby_club", "building:district-79:lobby_club:1"],
  ["Letiště", "Expresní dovoz", 0, "airport", "building:district-79:airport:1"],
  ["Letiště", "Černý charter", 1, "airport", "building:district-79:airport:1"],
  ["Letiště", "Evakuační koridor", 2, "airport", "building:district-79:airport:1"]
];

describe("Downtown building special action server bridge", () => {
  it.each(downtownActions)("dispatches %s / %s through gameplay-slice submit with server building id", async (
    buildingName,
    actionLabel,
    actionIndex,
    buildingTypeId,
    buildingId
  ) => {
    const definition = createDefinition(buildingName, actionLabel, actionIndex);
    const fetchJson = vi.fn(async (_url, request) => ({
      accepted: true,
      readModel: createSlice({
        buildingTypeId,
        buildingId,
        actionId: definition.actionId,
        enabled: false,
        cooldownRemainingTicks: 12
      }),
      errors: []
    }));
    const syncResponse = vi.fn();

    const response = await submitServerBuildingActionCommandBridge({
      context: { district: { id: 79 }, buildingName },
      actionProfile: getActionProfile(buildingName, actionIndex),
      definition
    }, {
      isReady: () => true,
      getSlice: () => createSlice({ buildingTypeId, buildingId, actionId: definition.actionId }),
      loadSliceForDistrict: async () => ({ accepted: true, readModel: createSlice({ buildingTypeId, buildingId, actionId: definition.actionId }) }),
      formatCooldown: (ms) => `${ms}ms`,
      createCommandId: () => `command:${definition.actionId}`,
      nowIso: () => "2026-06-29T18:00:00.000Z",
      getSnapshotToken: () => "snapshot:1",
      getEndpointBase: () => "/api/gameplay-slice",
      fetchJson,
      syncResponse
    });

    expect(response.accepted).toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    const [url, request] = fetchJson.mock.calls[0];
    expect(url).toBe("/api/gameplay-slice/submit");
    expect(request).toMatchObject({
      focusDistrictId: "district:79",
      snapshotToken: "snapshot:1",
      command: {
        id: `command:${definition.actionId}`,
        type: "run-building-action",
        playerId: "player:1",
        serverInstanceId: "instance:1",
        payload: {
          districtId: "district:79",
          buildingId,
          actionId: definition.actionId
        }
      }
    });
    expect(syncResponse).toHaveBeenCalledTimes(1);
  });

  it("adds visible default input summaries and matching command payload defaults", () => {
    const defaults = [
      ["Burza", "Spekulativní nákup", 0, { targetCategory: "materials", investmentCleanCash: 1000 }, ["Kategorie: materials", "Investice: $1000 clean cash"]],
      ["Burza", "Tržní tlak", 1, { targetCategory: "materials", mode: "pump" }, ["Kategorie: materials", "Režim: pump"]],
      ["Centrální banka", "Kurzovní intervence", 2, { targetCategory: "materials" }, ["Kategorie: materials"]],
      ["Magistrát", "Nouzová vyhláška", 2, { mode: "suspended_checks" }, ["Režim: suspended_checks"]],
      ["Letiště", "Expresní dovoz", 0, { targetCategory: "materials" }, ["Kategorie: materials"]]
    ];

    for (const [buildingName, actionLabel, actionIndex, expectedPayload, expectedSummaryParts] of defaults) {
      const definition = createDefinition(buildingName, actionLabel, actionIndex);
      const request = createServerBuildingActionSubmitRequest({
        slice: createSlice({ buildingTypeId: definition.buildingTypeId, buildingId: "building:target", actionId: definition.actionId }),
        target: {
          districtId: "district:79",
          buildingId: "building:target"
        },
        definition,
        actionProfile: getActionProfile(buildingName, actionIndex),
        commandId: `command:${definition.actionId}`,
        issuedAt: "2026-06-29T18:00:00.000Z"
      });

      expect(request.command.payload).toMatchObject(expectedPayload);
      for (const part of expectedSummaryParts) {
        expect(definition.inputSummary).toContain(part);
      }
    }
  });

  it("dispatches hardened Park and Industrial actions through run-building-action", () => {
    const actions = [
      ["Pouliční dealeři", "Spustit prodej", 0, "street_dealers", { dealerSlotId: "slot-1", itemId: "neon-dust", amount: 10 }],
      ["Strip club", "Vybrat cash", 0, "strip_club", {}],
      ["Energetická stanice", "Napájet výrobu", 1, "power_station", {}],
      ["Energetická stanice", "Snížit heat", 2, "power_station", {}]
    ];

    for (const [buildingName, actionLabel, actionIndex, buildingTypeId, expectedDefaults] of actions) {
      const definition = createDefinition(buildingName, actionLabel, actionIndex);
      const request = createServerBuildingActionSubmitRequest({
        slice: createSlice({
          buildingTypeId,
          buildingId: `building:district-42:${buildingTypeId}:1`,
          actionId: definition.actionId
        }),
        target: {
          districtId: "district:42",
          buildingId: `building:district-42:${buildingTypeId}:1`
        },
        definition,
        actionProfile: getActionProfile(buildingName, actionIndex),
        commandId: `command:${definition.actionId}`,
        issuedAt: "2026-06-29T18:00:00.000Z"
      });

      expect(request.command.type, `${buildingName} / ${actionLabel}`).toBe("run-building-action");
      expect(request.command.payload, `${buildingName} / ${actionLabel}`).toMatchObject({
        districtId: "district:42",
        buildingId: `building:district-42:${buildingTypeId}:1`,
        actionId: definition.actionId,
        ...expectedDefaults
      });
    }
  });

  it("does not submit disabled Downtown actions and surfaces the server disabled reason", async () => {
    const definition = createDefinition("Burza", "Tržní tlak", 1);
    const fetchJson = vi.fn();
    const response = await submitServerBuildingActionCommandBridge({
      context: { district: { id: 79 }, buildingName: "Burza" },
      actionProfile: getActionProfile("Burza", 1),
      definition
    }, {
      isReady: () => true,
      getSlice: () => createSlice({
        buildingTypeId: "stock_exchange",
        buildingId: "building:district-79:stock_exchange:1",
        actionId: "market_pressure",
        enabled: false,
        disabledReason: "Chybí vliv."
      }),
      loadSliceForDistrict: async () => ({ accepted: true, readModel: null }),
      formatCooldown: (ms) => `${ms}ms`,
      fetchJson
    });

    expect(response.accepted).toBe(false);
    expect(response.errors[0].message).toBe("Chybí vliv.");
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

function createDefinition(buildingName, actionLabel, actionIndex) {
  const actionProfile = getActionProfile(buildingName, actionIndex);
  const definition = resolveBuildingSpecialActionDefinition({
    buildingName,
    actionLabel,
    actionIndex,
    actionProfile
  });
  expect(definition.handlerId).toBe("server-run-building-action");
  expect(definition.status).toBe("implemented");
  return definition;
}

function getActionProfile(buildingName, actionIndex) {
  const key = String(buildingName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[key]?.[actionIndex] || {};
}

function createSlice({
  buildingTypeId,
  buildingId,
  actionId,
  enabled = true,
  disabledReason = null,
  cooldownRemainingTicks = 0
}) {
  return {
    server: { stateVersion: 7 },
    mode: { mode: "free" },
    player: {
      playerId: "player:1",
      instanceId: "instance:1",
      mode: "free"
    },
    district: {
      districtId: "district:79",
      buildings: [
        {
          buildingId,
          buildingTypeId,
          actions: [
            {
              actionId,
              enabled,
              disabledReason,
              cooldownRemainingTicks
            }
          ]
        }
      ]
    },
    reports: []
  };
}
