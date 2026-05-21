import { publicServerRegistry } from "@empire/game-config";
import type { createServerApp } from "../app";

export function ensureDefaultLobbyServers(
  server: ReturnType<typeof createServerApp>
): void {
  if (server.instanceManager.listInstances().length > 0) {
    return;
  }

  for (const publicServer of publicServerRegistry) {
    if (!publicServer.isPublic) {
      continue;
    }

    server.serverInstanceCreationService.createGameServerInstance({
      serverInstanceId: publicServer.serverInstanceId,
      mode: publicServer.mode,
      region: publicServer.region,
      displayName: publicServer.displayName,
      capacity: publicServer.capacity,
      mapComposition: publicServer.mapComposition,
      joinPolicy: publicServer.joinPolicy
    });
  }
}
