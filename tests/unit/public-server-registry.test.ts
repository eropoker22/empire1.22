import { describe, expect, it } from "vitest";
import {
  publicServerInstanceIdMigrationMap,
  publicServerRegistry,
  resolvePublicServerInstanceId
} from "@empire/game-config";

describe("public server registry", () => {
  it("keeps public server definitions complete and unique", () => {
    const ids = new Set<string>();

    for (const server of publicServerRegistry) {
      expect(server.serverInstanceId).toMatch(/^instance:(free|war):[a-z0-9-]+:public-\d+$/u);
      expect(ids.has(server.serverInstanceId), `${server.serverInstanceId} is duplicated`).toBe(false);
      ids.add(server.serverInstanceId);
      expect(server.mode === "free" || server.mode === "war").toBe(true);
      expect(server.region.trim()).not.toBe("");
      expect(server.displayName.trim()).not.toBe("");
      expect(server.capacity).toBeGreaterThan(0);
      expect(server.joinPolicy === "open" || server.joinPolicy === "closed").toBe(true);
      expect(typeof server.isPublic).toBe("boolean");
      expect(Array.isArray(server.legacyAliases)).toBe(true);
      for (const legacyAlias of server.legacyAliases) {
        expect(legacyAlias).not.toMatch(/^instance:/u);
        expect(resolvePublicServerInstanceId(legacyAlias)).toBe(server.serverInstanceId);
      }
      expect(server.mapComposition).toEqual(expect.objectContaining({
        downtown: expect.any(Number),
        commercial: expect.any(Number),
        industrial: expect.any(Number),
        residential: expect.any(Number),
        park: expect.any(Number)
      }));
      expect(Object.values(server.mapComposition).reduce((sum, count) => sum + count, 0)).toBe(161);
    }
  });

  it("keeps legacy lobby server ids as a temporary migration bridge only", () => {
    const canonicalIds = new Set(publicServerRegistry.map((server) => server.serverInstanceId));

    expect(resolvePublicServerInstanceId("war-eu-01")).toBe("instance:war:eu-central:public-1");
    expect(resolvePublicServerInstanceId("free-eu-01")).toBe("instance:free:eu-central:public-1");

    for (const [legacyId, canonicalId] of Object.entries(publicServerInstanceIdMigrationMap)) {
      expect(legacyId).not.toMatch(/^instance:/u);
      expect(canonicalIds.has(canonicalId)).toBe(true);
    }

    expect(publicServerInstanceIdMigrationMap).toEqual(
      Object.fromEntries(publicServerRegistry.flatMap((server) =>
        server.legacyAliases.map((legacyAlias) => [legacyAlias, server.serverInstanceId])
      ))
    );
  });

  it("keeps the first public server as the free battle royale default", () => {
    const firstPublicServer = publicServerRegistry.find((server) => server.isPublic);

    expect(firstPublicServer).toMatchObject({
      serverInstanceId: "instance:free:eu-central:public-1",
      mode: "free",
      capacity: 20,
      mapComposition: expect.objectContaining({
        downtown: 8
      })
    });
    expect(resolvePublicServerInstanceId("war-eu-01")).toBe("instance:war:eu-central:public-1");
  });
});
