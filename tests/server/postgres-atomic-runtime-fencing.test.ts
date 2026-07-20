import { describe, expect, it } from "vitest";
import {
  HostedRuntimeStatusFenceRejectedError,
  RuntimeLeaseFenceRejectedError
} from "../../apps/server/src/runtime/instance-manager/atomic-command-transaction";
import {
  createPostgresAtomicCommandTransaction,
  type PostgresDatabase,
  type PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";

describe("postgres atomic runtime fencing", () => {
  it("rejects a hosted command before its callback when the server is paused", async () => {
    const fixture = database({ hostedStatus: "paused" });
    const boundary = createPostgresAtomicCommandTransaction(fixture.database);
    let callbackCalled = false;

    await expect(boundary.run("instance:fenced-command", async () => {
      callbackCalled = true;
    }, { hostedStatusFence: "running-if-present" })).rejects.toBeInstanceOf(
      HostedRuntimeStatusFenceRejectedError
    );

    expect(callbackCalled).toBe(false);
    expect(fixture.order).toEqual(["hosted-status-lock"]);
  });

  it("rejects a hosted command while provisioning is not ready", async () => {
    const fixture = database({ hostedStatus: "running", hostedProvisioningState: "provisioning" });
    const boundary = createPostgresAtomicCommandTransaction(fixture.database);

    await expect(boundary.run("instance:fenced-command", async () => undefined,
      { hostedStatusFence: "running-if-present" })).rejects.toBeInstanceOf(
      HostedRuntimeStatusFenceRejectedError
    );
    expect(fixture.order).toEqual(["hosted-status-lock"]);
  });

  it("locks a running hosted row before the core row and command callback", async () => {
    const fixture = database({ hostedStatus: "running" });
    const boundary = createPostgresAtomicCommandTransaction(fixture.database);

    await boundary.run("instance:fenced-command", async () => {
      fixture.order.push("callback");
    }, { hostedStatusFence: "running-if-present" });

    expect(fixture.order).toEqual([
      "hosted-status-lock",
      "core-row-upsert",
      "core-row-lock",
      "callback"
    ]);
  });

  it("keeps non-hosted PostgreSQL development runtimes compatible", async () => {
    const fixture = database({ hostedStatus: null });
    const boundary = createPostgresAtomicCommandTransaction(fixture.database);

    await boundary.run("instance:non-hosted-dev", async () => {
      fixture.order.push("callback");
    }, { hostedStatusFence: "running-if-present" });

    expect(fixture.order).toEqual([
      "hosted-status-lock",
      "core-row-upsert",
      "core-row-lock",
      "callback"
    ]);
  });

  it("rolls back a tick when its lease expires before the final fence check", async () => {
    const fixture = database({ leaseChecks: [true, false] });
    const boundary = createPostgresAtomicCommandTransaction(fixture.database);

    await expect(boundary.run("instance:fenced-tick", async () => {
      fixture.order.push("callback");
    }, { runtimeLeaseFence: {
      workerId: "worker:stable",
      workerIncarnationId: "worker-incarnation:old"
    } })).rejects.toBeInstanceOf(RuntimeLeaseFenceRejectedError);

    expect(fixture.order).toEqual([
      "lease-lock",
      "core-row-upsert",
      "core-row-lock",
      "callback",
      "lease-final-check"
    ]);
  });
});

const database = (options: {
  hostedStatus?: "running" | "paused" | null;
  hostedProvisioningState?: "ready" | "provisioning";
  leaseChecks?: boolean[];
}) => {
  const order: string[] = [];
  const leaseChecks = [...(options.leaseChecks ?? [])];
  const client: PostgresQueryable = {
    query: async (sql) => {
      const normalized = sql.replace(/\s+/gu, " ").trim();
      if (normalized.includes("FROM empire_hosted_server_instances") &&
        normalized.includes("runtime_lease_incarnation_id")) {
        const current = leaseChecks.shift() ?? false;
        order.push(normalized.includes("FOR UPDATE") ? "lease-lock" : "lease-final-check");
        return result(current ? [{ server_instance_id: "instance:fenced-tick" }] : []);
      }
      if (normalized.includes("FROM empire_hosted_server_instances")) {
        order.push("hosted-status-lock");
        return result(options.hostedStatus ? [{ provisioning_state: options.hostedProvisioningState ?? "ready",
          status: options.hostedStatus }] : []);
      }
      if (normalized.includes("INSERT INTO empire_server_instances")) {
        order.push("core-row-upsert");
        return result([]);
      }
      if (normalized.includes("FROM empire_server_instances")) {
        order.push("core-row-lock");
        return result([{ id: "server-instance:fixture" }]);
      }
      throw new Error(`Unexpected SQL: ${normalized}`);
    }
  };
  const postgres: PostgresDatabase = {
    query: async () => { throw new Error("Fenced operations must use the transaction client."); },
    transaction: async (callback) => callback(client),
    close: async () => undefined
  };
  return { database: postgres, order };
};

const result = (rows: Array<Record<string, unknown>>) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: []
}) as never;
