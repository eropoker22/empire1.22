import type { AdminHostedServerView } from "@empire/shared-types";
import { createHostedAdminServerView } from "./hosted-control-plane-policy";
import type {
  HostedControlPlaneRepository,
  HostedServerRecord
} from "./hosted-control-plane-repository";

export const loadHostedAdminServerViews = async (
  repository: Pick<
    HostedControlPlaneRepository,
    "getAdminServerStats"
  >,
  servers: HostedServerRecord[],
  generatedAt: Date
): Promise<AdminHostedServerView[]> => {
  const stats = await repository.getAdminServerStats(
    servers.map((server) => server.serverInstanceId),
    generatedAt.toISOString()
  );
  const statsByServerId = new Map(
    stats.map((entry) => [entry.serverInstanceId, entry])
  );
  return servers.map((server) => {
    const serverStats = statsByServerId.get(server.serverInstanceId);
    if (!serverStats) {
      throw new Error(
        `Admin stats missing for hosted server ${server.serverInstanceId}.`
      );
    }
    return createHostedAdminServerView({
      server,
      now: generatedAt,
      committedPlayers: serverStats.committedPlayers,
      reservedSlots: serverStats.reservedSlots,
      readyPlayers: serverStats.readyPlayers
    });
  });
};
