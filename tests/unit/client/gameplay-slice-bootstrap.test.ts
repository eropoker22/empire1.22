import { describe, expect, it } from "vitest";
import { resolveGameplaySliceBootstrapRequest } from "../../../apps/client/src/browser/gameplay-slice-bootstrap";

const createStorage = (value: unknown) => ({
  getItem: () => JSON.stringify(value)
});

describe("gameplay slice browser bootstrap", () => {
  it("prefers explicit page dataset IDs", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {
          serverInstanceId: "instance:manual",
          playerId: "player:manual",
          districtId: "district:7"
        },
        createStorage({})
      )
    ).toEqual({
      serverInstanceId: "instance:manual",
      playerId: "player:manual",
      districtId: "district:7"
    });
  });

  it("maps the legacy onboarding session into shared gameplay slice IDs", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha",
            serverId: "war-eu-01",
            startDistrictId: 27
          }
        })
      )
    ).toEqual({
      serverInstanceId: "instance:war-eu-01",
      playerId: "player:host-alpha",
      districtId: "district:27"
    });
  });

  it("returns null when the session is not ready for gameplay", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha",
            serverId: "war-eu-01"
          }
        })
      )
    ).toBeNull();
  });
});
