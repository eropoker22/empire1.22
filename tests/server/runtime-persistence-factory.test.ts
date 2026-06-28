import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createInMemoryRuntimePersistenceRepositories } from "../../apps/server/src/runtime";
import { createRuntimePersistenceRepositoriesFromEnvironment } from "../../apps/server/src/runtime/instance-manager/instance-factory";

describe("runtime persistence factory", () => {
  it("requires a database url when postgres persistence is selected", () => {
    expect(() =>
      createRuntimePersistenceRepositoriesFromEnvironment({
        EMPIRE_PERSISTENCE_DRIVER: "postgres"
      })
    ).toThrow("Postgres persistence requires EMPIRE_DATABASE_URL or GAMEPLAY_DATABASE_URL.");
  });

  it("accepts the gameplay compatibility database url for postgres persistence", async () => {
    const repositories = createRuntimePersistenceRepositoriesFromEnvironment({
      GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
      GAMEPLAY_DATABASE_URL: "postgres://empire:empire@localhost:5432/empire"
    });

    expect(repositories.commandLogRepository).toBeDefined();
    expect(repositories.eventLogRepository).toBeDefined();
    expect(repositories.diagnosticLogRepository).toBeDefined();
    expect(repositories.snapshotRepository).toBeDefined();
    expect(repositories.tickLock).toBeDefined();
    expect(repositories.atomicCommandPersistenceMode).toBe("transactional");
    expect(repositories.atomicCommandTransaction).toBeDefined();
    await repositories.close?.();
  });

  it("strips non-transactional command persistence from production app composition", () => {
    const server = createServerApp({
      environment: { NODE_ENV: "production" },
      persistence: createInMemoryRuntimePersistenceRepositories()
    });

    const repositories = server.instanceManager.getPersistenceRepositories();
    expect(repositories.commandReservationRepository).toBeUndefined();
    expect(repositories.commandResultRepository).toBeUndefined();
    expect(repositories.outboxRepository).toBeUndefined();
    expect(repositories.atomicCommandTransaction).toBeUndefined();
  });

  it("treats default memory persistence as non-production command persistence", () => {
    const server = createServerApp({
      environment: { NODE_ENV: "production" }
    });

    const repositories = server.instanceManager.getPersistenceRepositories();
    expect(repositories.atomicCommandPersistenceMode).toBe("best-effort");
    expect(repositories.commandReservationRepository).toBeUndefined();
    expect(repositories.commandResultRepository).toBeUndefined();
    expect(repositories.outboxRepository).toBeUndefined();
  });

  it("rejects unknown persistence drivers with a clear error", () => {
    expect(() =>
      createRuntimePersistenceRepositoriesFromEnvironment({
        EMPIRE_PERSISTENCE_DRIVER: "sqlite"
      })
    ).toThrow('Unsupported runtime persistence driver "sqlite". Expected "memory", "file", or "postgres".');
  });
});
