import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CommandReservationDraft } from "../../apps/server/src/runtime";
import { createFileCommandReservationRepository } from "../../apps/server/src/runtime";

describe("file command reservation repository", () => {
  it("persists pending reservations across fresh repository instances", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-command-reservation-file-"));
    try {
      const firstRepository = createFileCommandReservationRepository({ rootDir });
      const first = await firstRepository.reserve(createReservationDraft());

      const secondRepository = createFileCommandReservationRepository({ rootDir });
      const loaded = await secondRepository.getByCommandId("instance:file-reservation:1", "command:file-reservation:1");

      expect(first.created).toBe(true);
      expect(loaded).toMatchObject({
        serverInstanceId: "instance:file-reservation:1",
        commandId: "command:file-reservation:1",
        status: "pending",
        commandType: "attack-district",
        playerId: "player:file-reservation:1"
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns existing records for duplicate reserve without overwriting fields", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-command-reservation-file-duplicate-"));
    try {
      const repository = createFileCommandReservationRepository({ rootDir });
      const first = await repository.reserve(createReservationDraft());
      const duplicate = await repository.reserve(createReservationDraft({
        commandType: "spy-district",
        playerId: "player:changed",
        payloadHash: "hash:changed",
        reservedAt: "2026-05-29T11:01:00.000Z"
      }));

      expect(first.created).toBe(true);
      expect(duplicate.created).toBe(false);
      expect(duplicate.record).toEqual(first.record);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("round-trips applied and rejected terminal states", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-command-reservation-file-states-"));
    try {
      const repository = createFileCommandReservationRepository({ rootDir });
      await repository.reserve(createReservationDraft({
        commandId: "command:file-reservation:applied"
      }));
      await repository.reserve(createReservationDraft({
        commandId: "command:file-reservation:rejected"
      }));

      await repository.markApplied("instance:file-reservation:1", "command:file-reservation:applied", {
        updatedAt: "2026-05-29T11:02:00.000Z",
        rootVersion: 4
      });
      await repository.markRejected("instance:file-reservation:1", "command:file-reservation:rejected", [
        {
          code: "unsupported_command",
          message: "Unsupported command type.",
          details: {
            updatedAt: "2026-05-29T11:03:00.000Z"
          }
        }
      ]);

      const freshRepository = createFileCommandReservationRepository({ rootDir });
      await expect(freshRepository.getByCommandId("instance:file-reservation:1", "command:file-reservation:applied"))
        .resolves.toMatchObject({
          status: "applied",
          appliedAt: "2026-05-29T11:02:00.000Z",
          appliedMetadata: {
            rootVersion: 4
          }
        });
      await expect(freshRepository.getByCommandId("instance:file-reservation:1", "command:file-reservation:rejected"))
        .resolves.toMatchObject({
          status: "rejected",
          rejectedAt: "2026-05-29T11:03:00.000Z",
          rejectionErrors: [
            {
              code: "unsupported_command"
            }
          ]
        });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("does not rewrite terminal states across applied and rejected", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-command-reservation-file-terminal-"));
    try {
      const repository = createFileCommandReservationRepository({ rootDir });
      await repository.reserve(createReservationDraft({
        commandId: "command:file-reservation:terminal-applied"
      }));
      await repository.reserve(createReservationDraft({
        commandId: "command:file-reservation:terminal-rejected"
      }));
      await repository.markApplied("instance:file-reservation:1", "command:file-reservation:terminal-applied", {
        updatedAt: "2026-05-29T11:04:00.000Z"
      });
      await repository.markRejected("instance:file-reservation:1", "command:file-reservation:terminal-rejected", [
        {
          code: "initial_rejection",
          message: "Rejected first."
        }
      ]);

      await expect(repository.markRejected("instance:file-reservation:1", "command:file-reservation:terminal-applied", [
        {
          code: "later_rejection",
          message: "Should not overwrite applied state."
        }
      ])).rejects.toThrow("Cannot mark an applied command reservation as rejected.");
      await expect(repository.markApplied("instance:file-reservation:1", "command:file-reservation:terminal-rejected", {
        updatedAt: "2026-05-29T11:05:00.000Z"
      })).rejects.toThrow("Cannot mark a rejected command reservation as applied.");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("scopes command ids by server instance", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-command-reservation-file-scope-"));
    try {
      const repository = createFileCommandReservationRepository({ rootDir });
      const first = await repository.reserve(createReservationDraft({
        serverInstanceId: "instance:file-reservation:a",
        commandId: "command:file-shared"
      }));
      const second = await repository.reserve(createReservationDraft({
        serverInstanceId: "instance:file-reservation:b",
        commandId: "command:file-shared"
      }));

      expect(first.created).toBe(true);
      expect(second.created).toBe(true);
      await expect(repository.getByCommandId("instance:file-reservation:a", "command:file-shared"))
        .resolves.toMatchObject({ serverInstanceId: "instance:file-reservation:a" });
      await expect(repository.getByCommandId("instance:file-reservation:b", "command:file-shared"))
        .resolves.toMatchObject({ serverInstanceId: "instance:file-reservation:b" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

const createReservationDraft = (
  overrides: Partial<CommandReservationDraft> = {}
): CommandReservationDraft => ({
  serverInstanceId: "instance:file-reservation:1",
  commandId: "command:file-reservation:1",
  commandType: "attack-district",
  playerId: "player:file-reservation:1",
  payloadHash: "hash:file-reservation:1",
  reservedAt: "2026-05-29T11:00:00.000Z",
  ...overrides
});
