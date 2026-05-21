import { describe, expect, it } from "vitest";
import { publicServerRegistry } from "@empire/game-config";
import { createServerApp } from "../../apps/server/src/app";
import { ensureDefaultLobbyServers } from "../../apps/server/src/netlify/gameplay-slice-function-default-servers";

describe("default lobby servers", () => {
  it("creates backend defaults from the canonical public server registry", () => {
    const server = createServerApp();
    const publicServers = publicServerRegistry.filter((serverEntry) => serverEntry.isPublic);

    ensureDefaultLobbyServers(server);

    const summaries = server.instanceManager.listServerSummaries();
    expect(summaries.map((summary) => summary.serverInstanceId).sort()).toEqual(
      publicServers.map((serverEntry) => serverEntry.serverInstanceId).sort()
    );

    for (const serverEntry of publicServers) {
      expect(summaries).toContainEqual(expect.objectContaining({
        serverInstanceId: serverEntry.serverInstanceId,
        displayName: serverEntry.displayName,
        mode: serverEntry.mode,
        region: serverEntry.region,
        maxPlayers: serverEntry.capacity,
        joinPolicy: serverEntry.joinPolicy,
        map: {
          totalDistricts: 161,
          downtownDistricts: serverEntry.mapComposition.downtown,
          commercialDistricts: serverEntry.mapComposition.commercial,
          industrialDistricts: serverEntry.mapComposition.industrial,
          residentialDistricts: serverEntry.mapComposition.residential,
          parkDistricts: serverEntry.mapComposition.park
        }
      }));
    }
  });
});

