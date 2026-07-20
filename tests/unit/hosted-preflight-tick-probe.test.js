import { describe, expect, it, vi } from "vitest";
import { probeRollbackOnlyTickLease } from "../../scripts/hosted-preflight-tick-probe.mjs";

describe("hosted preflight tick probe", () => {
  it("uses a disposable server row and always rolls the transaction back", async () => {
    const query = vi.fn(async (sql) => ({ rowCount: /RETURNING server_instance_id/u.test(sql) ? 1 : null }));
    const release = vi.fn();
    const accepted = await probeRollbackOnlyTickLease({ connect: async () => ({ query, release }) });
    const statements = query.mock.calls.map(([sql]) => sql.trim());

    expect(accepted).toBe(true);
    expect(statements[0]).toBe("BEGIN");
    expect(statements.some((sql) => sql.includes("INSERT INTO empire_server_instances"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO empire_tick_locks"))).toBe(true);
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements.some((sql) => sql.includes("SELECT server_instance_id FROM empire_hosted_server_instances"))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("fails closed and rolls back when the lease cannot be acquired", async () => {
    const query = vi.fn(async (sql) => ({ rowCount: sql.includes("INSERT INTO empire_tick_locks") ? 0 : null }));
    const release = vi.fn();
    expect(await probeRollbackOnlyTickLease({ connect: async () => ({ query, release }) })).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
