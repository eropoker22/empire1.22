import type { createServerApp } from "../app";

export function ensureDefaultLobbyServers(
  server: ReturnType<typeof createServerApp>
): void {
  if (server.instanceManager.listInstances().length > 0) {
    return;
  }

  server.serverInstanceCreationService.createGameServerInstance({
    serverInstanceId: "instance:free:eu-central:public-1",
    mode: "free",
    region: "EU Central",
    displayName: "Neon Docks FREE-01",
    capacity: 20,
    mapComposition: {
      downtown: 8,
      commercial: 40,
      industrial: 35,
      residential: 48,
      park: 30
    }
  });
  server.serverInstanceCreationService.createGameServerInstance({
    serverInstanceId: "instance:free:eu-central:public-2",
    mode: "free",
    region: "EU Central",
    displayName: "Rain Market FREE-02",
    capacity: 20,
    mapComposition: {
      downtown: 8,
      commercial: 45,
      industrial: 30,
      residential: 53,
      park: 25
    }
  });
}
