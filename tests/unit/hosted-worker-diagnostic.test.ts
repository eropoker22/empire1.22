import { describe, expect, it, vi } from "vitest";
import { writeHostedWorkerDiagnostic } from "../../apps/server/src/bootstrap/hosted-worker-diagnostic";

describe("hosted worker diagnostics", () => {
  it("writes a safe structured lifecycle event", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      writeHostedWorkerDiagnostic({
        level: "error",
        event: "worker_run_failed",
        buildSha: "b".repeat(40),
        workerId: "worker:staging:fra:01",
        environment: "staging",
        region: "fra",
        schemaVersion: "024_hosted_starting_player_state.sql",
        errorCode: "WORKER_TEST_FAILURE",
        now: () => new Date("2026-08-05T12:00:00.000Z")
      });

      expect(log).toHaveBeenCalledOnce();
      expect(JSON.parse(String(log.mock.calls[0]?.[0] ?? "{}"))).toEqual({
        timestamp: "2026-08-05T12:00:00.000Z",
        level: "error",
        event: "worker_run_failed",
        component: "hosted-worker",
        requestId: null,
        route: null,
        status: null,
        durationMs: null,
        serverInstanceHash: null,
        playerHash: null,
        buildSha: "b".repeat(40),
        workerId: "worker:staging:fra:01",
        environment: "staging",
        region: "fra",
        schemaVersion: "024_hosted_starting_player_state.sql",
        errorCode: "WORKER_TEST_FAILURE"
      });
    } finally {
      log.mockRestore();
    }
  });

  it("records a heartbeat failure as a first-class worker event", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      writeHostedWorkerDiagnostic({
        level: "error",
        event: "worker_heartbeat_failed",
        buildSha: "c".repeat(40),
        workerId: "worker:staging:fra:02",
        environment: "staging",
        region: "fra",
        schemaVersion: "026_control_server_elimination_timing.sql",
        errorCode: "HEARTBEAT_WRITE_FAILED"
      });

      expect(JSON.parse(String(log.mock.calls[0]?.[0] ?? "{}"))).toMatchObject({
        event: "worker_heartbeat_failed",
        errorCode: "HEARTBEAT_WRITE_FAILED"
      });
    } finally {
      log.mockRestore();
    }
  });
});
