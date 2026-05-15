import { describe, expect, it } from "vitest";
import { ServerInstanceManager } from "../../apps/server/src/runtime";
import { createGameplaySliceTransport } from "../../apps/server/src/transport";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

describe("gameplay slice transport identity boundary", () => {
  it("rejects submit before command ingress when auth context does not match command.playerId", () => {
    let ingressCalls = 0;
    const transport = createGameplaySliceTransport(
      new ServerInstanceManager(),
      {
        submit: () => {
          ingressCalls += 1;
          return undefined;
        }
      }
    );

    const response = transport.submit(
      {
        focusDistrictId: "district:2",
        command: createPlaceTrapCommandFixture({
          playerId: "player:victim"
        })
      },
      {
        mode: "authenticated",
        authenticatedPlayerId: "player:attacker"
      }
    );

    expect(response).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.player_identity_mismatch"
        }
      ]
    });
    expect(ingressCalls).toBe(0);
  });
});
