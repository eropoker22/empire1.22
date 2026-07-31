import type { AdminHostedServerView } from "@empire/shared-types";
import { createHostedAdminServerView } from "./hosted-control-plane-policy";
import type {
  HostedControlPlaneRepository,
  HostedServerRecord
} from "./hosted-control-plane-repository";

const SERVER_VIEW_CONCURRENCY = 2;

export const loadHostedAdminServerViews = async (
  repository: Pick<
    HostedControlPlaneRepository,
    "getJoinCapacity" | "listReadyMemberships"
  >,
  servers: HostedServerRecord[],
  generatedAt: Date
): Promise<AdminHostedServerView[]> => {
  const views = new Array<AdminHostedServerView>(servers.length);
  let nextIndex = 0;
  const loadNext = async (): Promise<void> => {
    while (nextIndex < servers.length) {
      const index = nextIndex;
      nextIndex += 1;
      const server = servers[index]!;
      const [capacity, readyMemberships] = await Promise.all([
        repository.getJoinCapacity(server.serverInstanceId, generatedAt.toISOString()),
        repository.listReadyMemberships(server.serverInstanceId)
      ]);
      views[index] = createHostedAdminServerView({
        server,
        now: generatedAt,
        ...capacity,
        readyPlayers: readyMemberships.length
      });
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(SERVER_VIEW_CONCURRENCY, servers.length) },
      () => loadNext()
    )
  );
  return views;
};
