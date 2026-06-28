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

  it("maps the legacy onboarding district into a spawn preference, not authoritative focus", () => {
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
      serverInstanceId: "instance:war:eu-central:public-1",
      playerId: "player:host-alpha",
      accountId: "Host Alpha",
      preferredStartDistrictId: "district:27",
      factionId: null
    });
  });

  it("uses server-confirmed home district as the next focus district", () => {
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
    ).toEqual({
      serverInstanceId: "instance:war:eu-central:public-1",
      playerId: "player:host-alpha",
      accountId: "Host Alpha",
      districtId: "district:spawn:1",
      preferredStartDistrictId: "district:27",
      factionId: null
    });
  });

  it("prefers the last server-confirmed district over the assigned home cache on rejoin", () => {
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
    ).toEqual({
      serverInstanceId: "instance:war:eu-central:public-1",
      playerId: "player:host-alpha",
      accountId: "Host Alpha",
      districtId: "district:connector:1",
      factionId: null
    });
  });

  it("preserves a server-authoritative instance ID from the lobby summary", () => {
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
    ).toEqual({
      serverInstanceId: "instance:free:eu-central:public-1",
      playerId: "player:host-alpha",
      accountId: "Host Alpha",
      districtId: "district:spawn:2",
      preferredStartDistrictId: "district:27",
      factionId: "red-syndicate"
    });
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
});
