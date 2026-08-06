import { describe, expect, it } from "vitest";
import { createSpawnMapDistrictViews } from "../../apps/server/src/player-entry/postgres-player-entry-spawn-map";

describe("player entry spawn map projection", () => {
  it("projects the complete authoritative city with zone, reservation, and public owner identity", () => {
    const projection = createSpawnMapDistrictViews({
      "district:12": {
        id: "district:12",
        name: "South Park",
        zone: "park",
        status: "claimed",
        ownerPlayerId: "player:one",
        version: 8
      },
      "district:2": {
        id: "district:2",
        name: "Blue Market",
        zone: "commercial",
        status: "neutral",
        ownerPlayerId: null,
        version: 3
      },
      "district:9": {
        id: "district:9",
        name: "Old Works",
        zone: "industrial",
        status: "claimed",
        ownerPlayerId: "player:unknown",
        version: 5
      }
    }, {
      "player:one": { id: "player:one", name: "Runtime One", color: "#334455" },
      "player:unknown": { id: "player:unknown", name: "Runtime Two", color: "invalid" }
    }, new Map([
      ["player:one", {
        displayName: "Erik",
        gangName: "Neon Wolves",
        gangColor: "#12ab34"
      }]
    ]), new Set(["district:2"]), new Set(["district:2"]));

    expect(projection.map((district) => district.districtId)).toEqual([
      "district:2",
      "district:9",
      "district:12"
    ]);
    expect(projection[0]).toMatchObject({
      zone: "commercial",
      status: "occupying",
      reserved: true,
      spawnEligible: true,
      owner: null,
      version: 3
    });
    expect(projection[2]).toMatchObject({
      zone: "park",
      status: "claimed",
      owner: {
        playerId: "player:one",
        displayName: "Erik",
        gangName: "Neon Wolves",
        color: "#12ab34"
      }
    });
    expect(projection[1]?.owner).toMatchObject({
      displayName: "Runtime Two",
      color: "#ef4444"
    });
    expect(projection[1]?.spawnEligible).toBe(false);
  });
});
