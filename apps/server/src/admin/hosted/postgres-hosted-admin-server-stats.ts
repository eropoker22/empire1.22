import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import { loadHostedServerPopulationStats } from "../../player-entry/postgres-player-entry-server-query";
import type { HostedAdminServerStats } from "./hosted-control-plane-repository";

export const loadPostgresHostedAdminServerStats = async (
  database: PostgresQueryable,
  serverInstanceIds: string[],
  at: string
): Promise<HostedAdminServerStats[]> => {
  return loadHostedServerPopulationStats(database, serverInstanceIds, at);
};
