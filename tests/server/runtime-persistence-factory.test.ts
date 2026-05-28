import { describe, expect, it } from "vitest";
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
    await repositories.close?.();
  });

  it("rejects unknown persistence drivers with a clear error", () => {
    expect(() =>
      createRuntimePersistenceRepositoriesFromEnvironment({
        EMPIRE_PERSISTENCE_DRIVER: "sqlite"
      })
    ).toThrow('Unsupported runtime persistence driver "sqlite". Expected "memory", "file", or "postgres".');
  });
});
