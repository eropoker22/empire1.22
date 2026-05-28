import { describe, expect, it } from "vitest";
import { createInMemoryCommandReservationRepository } from "../../apps/server/src/runtime";

describe("in-memory command reservation repository", () => {
  it("creates a pending record for a new reserve", async () => {
    const repository = createInMemoryCommandReservationRepository();

    const result = await repository.reserve(createReservationDraft());

    expect(result.created).toBe(true);
    expect(result.record).toMatchObject({
      serverInstanceId: "instance:reservation:1",
      commandId: "command:reservation:1",
      status: "pending",
      commandType: "attack-district",
      playerId: "player:reservation:1",
      payloadHash: "hash:reservation:1",
      reservedAt: "2026-05-29T10:00:00.000Z",
      updatedAt: "2026-05-29T10:00:00.000Z",
      appliedAt: null,
      rejectedAt: null,
      rejectionErrors: null
    });
  });

  it("returns the existing record for duplicate reserve in the same instance", async () => {
    const repository = createInMemoryCommandReservationRepository();
    const first = await repository.reserve(createReservationDraft());
    const duplicate = await repository.reserve(createReservationDraft({
      commandType: "spy-district",
      playerId: "player:changed",
      payloadHash: "hash:changed",
      reservedAt: "2026-05-29T10:01:00.000Z"
    }));

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.record).toEqual(first.record);
  });

  it("marks a pending reservation as applied", async () => {
    const repository = createInMemoryCommandReservationRepository();
    await repository.reserve(createReservationDraft());

    const applied = await repository.markApplied(
      "instance:reservation:1",
      "command:reservation:1",
      {
        updatedAt: "2026-05-29T10:02:00.000Z",
        rootVersion: 2,
        eventCount: 1
      }
    );

    expect(applied).toMatchObject({
      status: "applied",
      updatedAt: "2026-05-29T10:02:00.000Z",
      appliedAt: "2026-05-29T10:02:00.000Z",
      rejectedAt: null,
      appliedMetadata: {
        rootVersion: 2,
        eventCount: 1
      }
    });
    await expect(repository.getByCommandId("instance:reservation:1", "command:reservation:1"))
      .resolves.toMatchObject({ status: "applied" });
  });

  it("marks a pending reservation as rejected", async () => {
    const repository = createInMemoryCommandReservationRepository();
    await repository.reserve(createReservationDraft());

    const rejected = await repository.markRejected(
      "instance:reservation:1",
      "command:reservation:1",
      [
        {
          code: "unsupported_command",
          message: "Unsupported command type.",
          details: {
            updatedAt: "2026-05-29T10:03:00.000Z"
          }
        }
      ]
    );

    expect(rejected).toMatchObject({
      status: "rejected",
      updatedAt: "2026-05-29T10:03:00.000Z",
      appliedAt: null,
      rejectedAt: "2026-05-29T10:03:00.000Z",
      rejectionErrors: [
        {
          code: "unsupported_command",
          message: "Unsupported command type."
        }
      ]
    });
  });

  it("does not overwrite applied reservations as rejected", async () => {
    const repository = createInMemoryCommandReservationRepository();
    await repository.reserve(createReservationDraft());
    await repository.markApplied("instance:reservation:1", "command:reservation:1", {
      updatedAt: "2026-05-29T10:04:00.000Z"
    });

    await expect(repository.markRejected("instance:reservation:1", "command:reservation:1", [
      {
        code: "later_rejection",
        message: "Should not overwrite applied state."
      }
    ])).rejects.toThrow("Cannot mark an applied command reservation as rejected.");

    await expect(repository.getByCommandId("instance:reservation:1", "command:reservation:1"))
      .resolves.toMatchObject({ status: "applied" });
  });

  it("does not overwrite rejected reservations as applied", async () => {
    const repository = createInMemoryCommandReservationRepository();
    await repository.reserve(createReservationDraft());
    await repository.markRejected("instance:reservation:1", "command:reservation:1", [
      {
        code: "initial_rejection",
        message: "Rejected first."
      }
    ]);

    await expect(repository.markApplied("instance:reservation:1", "command:reservation:1", {
      updatedAt: "2026-05-29T10:05:00.000Z"
    })).rejects.toThrow("Cannot mark a rejected command reservation as applied.");

    await expect(repository.getByCommandId("instance:reservation:1", "command:reservation:1"))
      .resolves.toMatchObject({ status: "rejected" });
  });

  it("scopes command ids by server instance", async () => {
    const repository = createInMemoryCommandReservationRepository();
    const first = await repository.reserve(createReservationDraft({
      serverInstanceId: "instance:reservation:a",
      commandId: "command:shared"
    }));
    const second = await repository.reserve(createReservationDraft({
      serverInstanceId: "instance:reservation:b",
      commandId: "command:shared"
    }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    await expect(repository.getByCommandId("instance:reservation:a", "command:shared"))
      .resolves.toMatchObject({ serverInstanceId: "instance:reservation:a" });
    await expect(repository.getByCommandId("instance:reservation:b", "command:shared"))
      .resolves.toMatchObject({ serverInstanceId: "instance:reservation:b" });
  });
});

const createReservationDraft = (
  overrides: Partial<Parameters<ReturnType<typeof createInMemoryCommandReservationRepository>["reserve"]>[0]> = {}
) => ({
  serverInstanceId: "instance:reservation:1",
  commandId: "command:reservation:1",
  commandType: "attack-district",
  playerId: "player:reservation:1",
  payloadHash: "hash:reservation:1",
  reservedAt: "2026-05-29T10:00:00.000Z",
  ...overrides
});
