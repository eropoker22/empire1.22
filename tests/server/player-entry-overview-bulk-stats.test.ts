import { describe, expect, it } from "vitest";
import {
  createPostgresPlayerEntryRepository,
  type AuthenticatedAccount
} from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";

const NOW = new Date("2026-07-31T10:00:00.000Z");
const SERVER_COUNT = 120;
const ACCOUNT: AuthenticatedAccount = {
  accountId: "account:overview-bulk",
  username: "BulkBoss",
  displayName: "Bulk Boss",
  gangName: "Bulk Gang",
  expiresAt: "2026-08-07T10:00:00.000Z",
  sessionId: "session:overview-bulk"
};

describe("Postgres player-entry overview fleet stats", () => {
  it("loads 120 server summaries through one bulk query and preserves server order", async () => {
    const servers = serverRows();
    const database = overviewDatabase({ servers });
    const repository = createPostgresPlayerEntryRepository(database);

    const overview = await repository.getOverview(ACCOUNT, NOW);

    expect(overview.availableServers).toHaveLength(SERVER_COUNT);
    expect(overview.availableServers.map((server) => server.serverInstanceId)).toEqual(
      servers.map((server) => String(server.server_instance_id))
    );
    expect(overview.availableServers[0]).toMatchObject(expectedStats(servers[0]!.server_instance_id));
    expect(overview.availableServers.at(-1)).toMatchObject(expectedStats(servers.at(-1)!.server_instance_id));

    expect(database.queries).toHaveLength(3);
    expect(database.bulkQueries).toHaveLength(1);
    expect(database.bulkQueries[0]?.params[0]).toEqual(
      servers.map((server) => String(server.server_instance_id))
    );
    expect(database.queries.filter(({ params }) =>
      typeof params[0] === "string"
      && servers.some((server) => server.server_instance_id === params[0])
    )).toHaveLength(0);
  });

  it("fails closed when the single bulk query fails", async () => {
    const database = overviewDatabase({
      servers: serverRows(),
      bulkError: new Error("connection acquisition timeout")
    });
    const repository = createPostgresPlayerEntryRepository(database);

    await expect(repository.getOverview(ACCOUNT, NOW)).rejects.toThrow("connection acquisition timeout");
    expect(database.bulkQueries).toHaveLength(1);
  });

  it("fails closed when the bulk result omits a requested server", async () => {
    const servers = serverRows();
    const missingServerId = String(servers[57]!.server_instance_id);
    const database = overviewDatabase({ servers, missingServerId });
    const repository = createPostgresPlayerEntryRepository(database);

    await expect(repository.getOverview(ACCOUNT, NOW)).rejects.toThrow(missingServerId);
    expect(database.bulkQueries).toHaveLength(1);
  });
});

interface HostedServerRow extends Record<string, unknown> {
  server_instance_id: string;
  display_name: string;
}

interface RecordedQuery {
  sql: string;
  params: readonly unknown[];
}

interface OverviewDatabase extends PostgresDatabase {
  queries: RecordedQuery[];
  bulkQueries: RecordedQuery[];
}

const overviewDatabase = (options: {
  servers: HostedServerRow[];
  bulkError?: Error;
  missingServerId?: string;
}): OverviewDatabase => {
  const queries: RecordedQuery[] = [];
  const bulkQueries: RecordedQuery[] = [];
  const query = async (sql: string, params: readonly unknown[] = []) => {
    const recorded = { sql, params };
    queries.push(recorded);
    if (sql.includes("WHERE membership.account_id=$1 ORDER BY membership.joined_at DESC")) {
      return rows([]);
    }
    if (sql.includes("FROM empire_hosted_server_instances WHERE status <> 'archived'")) {
      return rows(options.servers);
    }
    if (isBulkPopulationQuery(sql, params)) {
      bulkQueries.push(recorded);
      if (options.bulkError) throw options.bulkError;
      const requestedServerIds = params[0] as string[];
      return rows(requestedServerIds
        .filter((serverInstanceId) => serverInstanceId !== options.missingServerId)
        .map((serverInstanceId) => postgresStats(serverInstanceId))
        .reverse());
    }
    throw new Error(`Unexpected non-bulk player-entry overview query: ${normalizeSql(sql).slice(0, 160)}`);
  };
  const queryable: PostgresQueryable = { query: query as PostgresQueryable["query"] };
  return {
    queries,
    bulkQueries,
    query: query as PostgresDatabase["query"],
    transaction: async <TResult>(callback: (client: PostgresQueryable) => Promise<TResult>) => callback(queryable),
    close: async () => undefined
  };
};

const isBulkPopulationQuery = (sql: string, params: readonly unknown[]): boolean =>
  Array.isArray(params[0])
  && sql.includes("committed_players")
  && sql.includes("reserved_slots")
  && sql.includes("ready_players");

const serverRows = (): HostedServerRow[] => Array.from({ length: SERVER_COUNT }, (_, offset) => {
  const index = SERVER_COUNT - offset - 1;
  return {
    server_instance_id: serverId(index),
    display_name: `Server ${index}`,
    mode: "free",
    region: "eu-central",
    status: "lobby",
    join_policy: "open",
    provisioning_state: "ready",
    capacity: 200,
    last_started_at: null,
    last_worker_heartbeat_at: NOW.toISOString(),
    runtime_lease_expires_at: "2026-07-31T10:01:00.000Z",
    current_snapshot_id: `snapshot:${index}`,
    minimum_ready_players_to_start: 1,
    registration_window_minutes: 60,
    registration_opens_at: "2026-07-31T09:00:00.000Z",
    registration_closes_at: "2026-07-31T11:00:00.000Z",
    registration_closed_at: null,
    version: 1
  };
});

const postgresStats = (serverInstanceId: string) => {
  const index = serverIndex(serverInstanceId);
  return {
    server_instance_id: serverInstanceId,
    committed_players: index % 7,
    reserved_slots: index % 3,
    ready_players: index % 5
  };
};

const expectedStats = (serverInstanceId: unknown) => {
  const id = String(serverInstanceId);
  const stats = postgresStats(id);
  return {
    serverInstanceId: id,
    committedPlayers: stats.committed_players,
    reservedSlots: stats.reserved_slots,
    readyPlayers: stats.ready_players
  };
};

const serverId = (index: number): string => `instance:test:${String(index).padStart(3, "0")}`;
const serverIndex = (serverInstanceId: string): number => Number(serverInstanceId.slice(-3));
const normalizeSql = (sql: string): string => sql.replace(/\s+/gu, " ").trim();
const rows = (value: unknown[]) => ({
  rows: value,
  rowCount: value.length,
  command: "SELECT",
  oid: 0,
  fields: []
}) as never;
