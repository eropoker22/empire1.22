import { describe, expect, it } from "vitest";
import {
  resolveGameplaySliceBootstrapRequest
} from "../../../apps/client/src/browser/gameplay-slice-bootstrap";

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
      districtId: "district:7",
      factionId: null
    });
  });

  it("does not derive gameplay authority from a legacy browser session", () => {
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
    ).toBeNull();
  });

  it("ignores server-looking focus data stored in the browser", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha",
            serverId: "war-eu-01",
            preferredStartDistrictId: 27,
            assignedHomeDistrictId: "district:spawn:1"
          }
        })
      )
    ).toBeNull();
  });

  it("ignores a cached district on rejoin", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha",
            serverId: "war-eu-01",
            assignedHomeDistrictId: "district:spawn:1",
            lastServerConfirmedDistrictId: "district:connector:1"
          }
        })
      )
    ).toBeNull();
  });

  it("requires the live entrypoint to publish account-backed IDs", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha",
            activeServerInstanceId: "instance:free:eu-central:public-1",
            serverId: "instance:free:eu-central:public-1",
            preferredStartDistrictId: 27,
            lastServerConfirmedDistrictId: "district:spawn:2",
            factionId: "red-syndicate"
          }
        })
      )
    ).toBeNull();
  });

  it("returns null when the session is missing server identity", () => {
    expect(
      resolveGameplaySliceBootstrapRequest(
        {},
        createStorage({
          registration: {
            identity: "Host Alpha"
          }
        })
      )
    ).toBeNull();
  });

  it("rejects an unscoped server ID even when page data is explicit", () => {
    expect(resolveGameplaySliceBootstrapRequest({
      serverInstanceId: "free-eu-01",
      playerId: "player:manual"
    })).toBeNull();
  });
});
