import { describe, expect, it, vi } from "vitest";
import {
  isPostgresConnectionEstablishmentTimeout,
  retryPostgresConnectionEstablishment
} from "../../apps/server/src/runtime/persistence/postgres/postgres-client";

describe("PostgreSQL connection establishment retry", () => {
  it("retries once when a physical connection times out before SQL is sent", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("Connection terminated due to connection timeout"))
      .mockResolvedValueOnce("connected");

    await expect(retryPostgresConnectionEstablishment(operation)).resolves.toBe("connected");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry query, statement, or pool checkout failures", async () => {
    const error = new Error("timeout exceeded when trying to connect");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryPostgresConnectionEstablishment(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
    expect(isPostgresConnectionEstablishmentTimeout(error)).toBe(false);
  });

  it("propagates a repeated physical connection timeout after one retry", async () => {
    const error = new Error("Connection terminated due to connection timeout");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryPostgresConnectionEstablishment(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(isPostgresConnectionEstablishmentTimeout(error)).toBe(true);
  });
});
