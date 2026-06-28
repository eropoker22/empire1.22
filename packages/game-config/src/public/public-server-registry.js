// Browser-compatible canonical public server registry.
// TypeScript consumers import the typed wrapper in public-server-registry.ts;
// legacy static pages import this file directly without a build step.
const DEFAULT_PUBLIC_MAP_COMPOSITION = Object.freeze({
  downtown: 8,
  commercial: 40,
  industrial: 38,
  residential: 38,
  park: 37
});

export const publicServerRegistry = Object.freeze([
  Object.freeze({
    serverInstanceId: "instance:free:eu-central:public-1",
    mode: "free",
    region: "EU Central",
    displayName: "Neon Docks FREE-01",
    capacity: 20,
    mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
    joinPolicy: "open",
    isPublic: true,
    legacyAliases: Object.freeze(["free-eu-01"])
  }),
  Object.freeze({
    serverInstanceId: "instance:free:eu-central:public-2",
    mode: "free",
    region: "EU Central",
    displayName: "Rain Market FREE-02",
    capacity: 20,
    mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
    joinPolicy: "open",
    isPublic: true,
    legacyAliases: Object.freeze([
      "free-eu-02",
      "free-eu-03"
    ])
  }),
  Object.freeze({
    serverInstanceId: "instance:war:eu-central:public-1",
    mode: "war",
    region: "EU Central",
    displayName: "Vortex City WAR-01",
    capacity: 150,
    // TODO(public-war-map): War stays closed until a larger validated map exists.
    // A paid 150-player War server must not launch on the current 161-district Free map.
    mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
    joinPolicy: "closed",
    isPublic: true,
    legacyAliases: Object.freeze([
      "war-eu-01",
      "war-eu-02",
      "war-eu-03",
      "war-eu-04",
      "war-eu-05"
    ])
  })
]);

export const publicServerInstanceIdMigrationMap = Object.freeze(
  Object.fromEntries(publicServerRegistry.flatMap((server) =>
    (server.legacyAliases || []).map((legacyAlias) => [legacyAlias, server.serverInstanceId])
  ))
);

export const resolvePublicServerInstanceId = (serverInstanceId) => {
  const normalized = String(serverInstanceId || "").trim();
  return publicServerInstanceIdMigrationMap[normalized] || normalized;
};
