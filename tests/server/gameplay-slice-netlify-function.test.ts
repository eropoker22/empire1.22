import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";

const postEvent = (path: string, body: unknown) => ({
  httpMethod: "POST",
  path,
  body: JSON.stringify(body)
});

type GameplaySliceFunctionHandler = ReturnType<typeof createGameplaySliceFunctionHandler>;

const readBody = async (responsePromise: ReturnType<GameplaySliceFunctionHandler>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("gameplay slice Netlify function", () => {
  it("loads and submits the first gameplay slice through cold HTTP adapters", async () => {
    const loadHandler = createTestHandler();
    const load = await readBody(
      loadHandler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-slice",
          playerId: "player:function-slice",
          districtId: "district:31"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    const focusDistrictId = load.json.readModel.district.districtId;
    expect(focusDistrictId).toBe("district:spawn:1");
    expect(load.json.snapshotToken).toEqual(expect.any(String));

    const building = load.json.readModel.district.buildings.find(
      (candidate: { actions: unknown[] }) => candidate.actions.length > 0
    );
    const action = building.actions[0];
    const command = {
      id: "command:function:building-action:1",
      type: "run-building-action",
      mode: load.json.readModel.mode.mode,
      playerId: "player:function-slice",
      serverInstanceId: "instance:function-slice",
      issuedAt: new Date(0).toISOString(),
      payload: {
        districtId: focusDistrictId,
        buildingId: building.buildingId,
        actionId: action.actionId
      },
      clientRequestId: null
    };
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          focusDistrictId,
          command
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.readModel.reports[0].reportType).toBe("building-action");
    expect(submit.json.snapshotToken).toEqual(expect.any(String));

    const duplicateHandler = createTestHandler();
    const duplicate = await readBody(
      duplicateHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: submit.json.snapshotToken,
          focusDistrictId,
          command
        })
      )
    );

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json.accepted).toBe(false);
    expect(duplicate.json.errors[0].code).toBe("server.duplicate_command");
  });

  it("preserves factionId through cold snapshot submit flow", async () => {
    const loadHandler = createTestHandler();
    const load = await readBody(
      loadHandler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-faction-snapshot",
          playerId: "player:function-faction-snapshot",
          districtId: "district:44",
          factionId: "kartel"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    expect(load.json.readModel.player.factionId).toBe("kartel");
    const focusDistrictId = load.json.readModel.district.districtId;

    const building = load.json.readModel.district.buildings.find(
      (candidate: { actions: unknown[] }) => candidate.actions.length > 0
    );
    const action = building.actions[0];
    const command = {
      id: "command:function:faction-snapshot-submit:1",
      type: "run-building-action",
      mode: load.json.readModel.mode.mode,
      playerId: "player:function-faction-snapshot",
      serverInstanceId: "instance:function-faction-snapshot",
      issuedAt: new Date(0).toISOString(),
      payload: {
        districtId: focusDistrictId,
        buildingId: building.buildingId,
        actionId: action.actionId
      },
      clientRequestId: null
    };
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          focusDistrictId,
          command
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.readModel.player.factionId).toBe("kartel");
  });

  it("rejects cold submit without snapshot instead of silently creating mafian fallback", async () => {
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          focusDistrictId: "district:55",
          command: {
            id: "command:function:cold-submit-without-snapshot:1",
            type: "collect-production",
            mode: "free",
            playerId: "player:cold-submit-without-snapshot",
            serverInstanceId: "instance:function-cold-submit-without-snapshot",
            issuedAt: new Date(0).toISOString(),
            payload: {
              districtId: "district:55",
              buildingId: "building:district:55:factory:1"
            },
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(false);
    expect(submit.json.readModel).toBeNull();
    expect(submit.json.errors[0].code).toBe("transport.not_found");
  });

  it("rejects the 21st free mode player with a domain error", async () => {
    const handler = createTestHandler();

    for (let index = 1; index <= 20; index += 1) {
      const load = await readBody(
        handler(
          postEvent("/api/gameplay-slice/load", {
            serverInstanceId: "instance:function-free-capacity",
            playerId: `player:function-capacity:${index}`,
            districtId: `district:${2000 + index * 10}`
          })
        )
      );

      expect(load.statusCode).toBe(200);
      expect(load.json.accepted).toBe(true);
    }

    const rejected = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-free-capacity",
          playerId: "player:function-capacity:21",
          districtId: "district:2210"
        })
      )
    );

    expect(rejected.statusCode).toBe(200);
    expect(rejected.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "server.player_cap_reached",
          details: {
            currentPlayerCount: 20,
            maxPlayersPerServer: 20
          }
        }
      ]
    });
  });
});

const createTestHandler = () => createGameplaySliceFunctionHandler({
  cryptoProvider: () => webcrypto
});
