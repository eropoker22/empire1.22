import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted";
import { createServerApp } from "../../apps/server/src/app";
import { createHostedRuntimeLoader } from "../../apps/server/src/bootstrap/hosted-runtime-loader";
import { createInstanceSnapshot } from "../../apps/server/src/runtime";
import { createPostgresRuntimePersistenceRepositories } from
  "../../apps/server/src/runtime/persistence/postgres";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;

describe("Neon cost hardening PostgreSQL live", () => {
  run("coalesces 20 unchanged clients into metadata-only database reads", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "neon_cost_20_clients");
    const persistence = createPostgresRuntimePersistenceRepositories({
      databaseUrl: isolated.databaseUrl,
      database: isolated.database
    });
    const server = createServerApp({ persistence });
    const instanceId = `instance:neon-cost:${crypto.randomUUID()}`;

    try {
      const runtime = server.instanceManager.createInstance(instanceId, "free");
      runtime.record.status = "running";
      runtime.scheduler.isRunning = true;
      const snapshot = createInstanceSnapshot(runtime);
      await persistence.snapshotRepository.saveRecoveryHead(snapshot);
      const record = {
        serverInstanceId: instanceId,
        mode: "free",
        serverTemplate: "free-public",
        displayName: "Cost Test",
        region: "local",
        capacity: 20,
        status: "running",
        joinPolicy: "closed",
        provisioningState: "ready",
        worldSeed: runtime.state.serverInstance.worldSeed,
        mapComposition: { kind: "canonical-shared-city" }
      } as unknown as HostedServerRecord;
      const loader = createHostedRuntimeLoader({
        server,
        controlPlane: { getServer: async () => record }
      });
      const before = persistence.snapshotRepository.getInstanceIoMetrics(instanceId);

      for (let cycle = 0; cycle < 6; cycle += 1) {
        await Promise.all(Array.from({ length: 20 }, () => loader.load(instanceId)));
      }

      const afterWarm = persistence.snapshotRepository.getInstanceIoMetrics(instanceId);
      expect(afterWarm.fullSnapshotReads - before.fullSnapshotReads).toBe(0);
      expect(afterWarm.metadataOnlyReads - before.metadataOnlyReads).toBe(6);

      server.instanceManager.destroyInstance(instanceId);
      const conditional = await loader.load(instanceId, {
        knownStateVersion: runtime.state.root.version,
        allowUnhydratedUnchanged: true
      });
      const afterCold = persistence.snapshotRepository.getInstanceIoMetrics(instanceId);
      expect(conditional).toMatchObject({ accepted: true, unchanged: true, runtime: null });
      expect(afterCold.fullSnapshotReads - afterWarm.fullSnapshotReads).toBe(0);
      expect(afterCold.metadataOnlyReads - afterWarm.metadataOnlyReads).toBe(1);

      console.info("[neon-cost-hardening-live]", {
        concurrentClients: 20,
        pollingCyclesPerMinute: 6,
        fullSnapshotReadsPerMinute: afterWarm.fullSnapshotReads - before.fullSnapshotReads,
        metadataReadsPerMinute: afterWarm.metadataOnlyReads - before.metadataOnlyReads,
        databaseBytesReturnedEstimatePerMinute:
          afterWarm.metadataOnlyReadBytesEstimate - before.metadataOnlyReadBytesEstimate,
        serializedSnapshotBytes: persistence.snapshotRepository.getMetrics().lastSerializedSnapshotSizeBytes
      });
    } finally {
      await persistence.close();
      await isolated.close();
    }
  }, 60_000);
});
