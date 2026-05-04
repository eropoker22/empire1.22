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
    expect(load.json.readModel.district.districtId).toBe("district:31");
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
        districtId: "district:31",
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
          focusDistrictId: "district:31",
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
          focusDistrictId: "district:31",
          command
        })
      )
    );

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json.accepted).toBe(false);
    expect(duplicate.json.errors[0].code).toBe("server.duplicate_command");
  });
});

const createTestHandler = () => createGameplaySliceFunctionHandler({
  cryptoProvider: () => webcrypto
});
