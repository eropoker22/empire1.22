import { describe, expect, it } from "vitest";
import { createGameplaySessionTokenCodec } from "../../apps/server/src/transport/gameplay-session-token-codec";
import {
  CANONICAL_FREE_TICK_RATE_MS,
  createGameplaySessionProbeToken,
  evaluateGameplayLoadSubmitVerification,
  evaluateInstanceAdvancement,
  evaluateRecoveryHead,
  evaluateSnapshotFreshness,
  isLocalHostedVerificationReady,
  listRunningHostedInstanceIds,
  parseInstanceArgument,
  resolveInstancePollPolicy,
  resolveInstanceTickRateMs,
  resolveVerificationInstanceIds,
  verifyAuthenticatedGameplayLoadSubmit
} from "../../scripts/verify-local-hosted-runtime.mjs";

describe("local hosted instance verifier arguments", () => {
  it("accepts an optional exact server instance id", () => {
    expect(parseInstanceArgument([])).toBeNull();
    expect(parseInstanceArgument(["--instance=instance:free:eu-central:test-1"]))
      .toBe("instance:free:eu-central:test-1");
  });

  it.each([
    ["--instance="],
    ["--instance=invalid id"],
    ["--unknown=value"],
    ["--instance=instance:one", "--instance=instance:two"]
  ])("rejects invalid arguments", (...argv) => {
    expect(() => parseInstanceArgument(argv)).toThrow();
  });
});

describe("local hosted instance polling policy", () => {
  it("uses the canonical Free tick rate as its fallback", () => {
    expect(resolveInstanceTickRateMs(null)).toBe(CANONICAL_FREE_TICK_RATE_MS);
    expect(resolveInstancePollPolicy(null)).toEqual({
      tickRateMs: CANONICAL_FREE_TICK_RATE_MS,
      pollIntervalMs: Math.ceil(CANONICAL_FREE_TICK_RATE_MS / 4),
      timeoutMs: CANONICAL_FREE_TICK_RATE_MS * 3,
      snapshotFreshnessMaxAgeMs: CANONICAL_FREE_TICK_RATE_MS * 3
    });
  });

  it("derives polling from an instance-specific canonical tick rate", () => {
    expect(resolveInstancePollPolicy(4_000)).toMatchObject({
      tickRateMs: 4_000,
      pollIntervalMs: 1_000,
      timeoutMs: 12_000
    });
  });
});

describe("local hosted instance discovery", () => {
  it("enumerates every running hosted instance when no exact id is requested", async () => {
    const queries = [];
    const pool = {
      query: async (query) => {
        queries.push(query);
        return {
          rows: [
            { server_instance_id: "instance:free:one" },
            { server_instance_id: "instance:free:two" }
          ]
        };
      }
    };

    await expect(listRunningHostedInstanceIds(pool)).resolves.toEqual([
      "instance:free:one",
      "instance:free:two"
    ]);
    await expect(resolveVerificationInstanceIds(pool, null)).resolves.toEqual([
      "instance:free:one",
      "instance:free:two"
    ]);
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.includes("WHERE status='running'"))).toBe(true);
  });

  it("uses an explicitly requested instance without enumerating the fleet", async () => {
    const pool = { query: async () => { throw new Error("unexpected query"); } };
    await expect(resolveVerificationInstanceIds(pool, "instance:free:exact"))
      .resolves.toEqual(["instance:free:exact"]);
  });
});

describe("local hosted instance advancement", () => {
  const before = {
    instanceTick: 40,
    snapshotTick: 40,
    rootTick: 40,
    stateVersion: 80
  };

  it("requires heartbeat, snapshot and root ticks plus state version to advance", () => {
    expect(evaluateInstanceAdvancement(before, {
      instanceTick: 41,
      snapshotTick: 41,
      rootTick: 41,
      stateVersion: 81
    })).toMatchObject({
      tickAdvanced: true,
      stateVersionAdvanced: true,
      missingTickFields: [],
      stalledTickFields: []
    });
  });

  it("reports a stalled root tick independently from state version", () => {
    expect(evaluateInstanceAdvancement(before, {
      instanceTick: 41,
      snapshotTick: 41,
      rootTick: 40,
      stateVersion: 81
    })).toMatchObject({
      tickAdvanced: false,
      stateVersionAdvanced: true,
      stalledTickFields: ["rootTick"]
    });
  });
});

describe("local hosted recovery and freshness policy", () => {
  const recoveryHead = {
    serverInstanceId: "instance:free:test",
    status: "running",
    currentSnapshotId: "snapshot:1",
    snapshotId: "snapshot:1",
    snapshotTick: 12,
    payloadTick: 12,
    rootTick: 12,
    rootVersion: 24,
    integrityRootVersion: 24,
    stateVersion: 24,
    snapshotServerInstanceId: "instance:free:test"
  };

  it("requires recovery-head column and payload counters to agree", () => {
    expect(evaluateRecoveryHead(recoveryHead).outcome).toBe("PASS");
    expect(evaluateRecoveryHead({ ...recoveryHead, rootTick: 11 })).toMatchObject({
      outcome: "FAIL"
    });
    expect(evaluateRecoveryHead({
      ...recoveryHead,
      currentSnapshotId: "snapshot:other"
    })).toMatchObject({
      outcome: "FAIL",
      message: expect.stringContaining("current snapshot/recovery head id")
    });
  });

  it("requires fresh snapshots only while the server is running", () => {
    const nowMs = Date.parse("2026-07-30T12:00:00.000Z");
    expect(evaluateSnapshotFreshness({
      status: "running",
      snapshotCreatedAt: "2026-07-30T11:59:40.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("PASS");
    expect(evaluateSnapshotFreshness({
      status: "running",
      snapshotCreatedAt: "2026-07-30T11:59:20.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("FAIL");
    expect(evaluateSnapshotFreshness({
      status: "paused",
      snapshotCreatedAt: "2026-07-29T12:00:00.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("PASS");
  });

  it("reports pre-provisioning snapshots as unavailable rather than stale", () => {
    expect(evaluateRecoveryHead({ status: "provisioning", snapshotId: null }).outcome)
      .toBe("NOT AVAILABLE");
    expect(evaluateSnapshotFreshness({
      status: "provisioning",
      snapshotCreatedAt: null,
      tickRateMs: 10_000
    }).outcome).toBe("NOT AVAILABLE");
  });
});

describe("local hosted gameplay verification reporting", () => {
  const platformResults = [{ label: "PostgreSQL", passed: true }];

  it("does not treat a durable session count as executed gameplay proof", () => {
    const gameplay = evaluateGameplayLoadSubmitVerification({
      activeGameplaySessions: 2
    });

    expect(gameplay).toMatchObject({
      label: "Gameplay load/submit",
      outcome: "NOT AVAILABLE",
      failed: false
    });
    expect(gameplay.message).toContain("no validated raw session token");
    expect(isLocalHostedVerificationReady(platformResults, [gameplay])).toBe(false);
  });

  it("reports failed validation rather than PASS after an attempted request", () => {
    expect(evaluateGameplayLoadSubmitVerification({
      loadAttempted: true,
      loadValidated: false,
      submitAttempted: true,
      submitValidated: true
    })).toMatchObject({
      outcome: "FAIL",
      failed: true
    });
  });

  it("allows READY only after both authenticated checks were executed and validated", () => {
    const gameplay = evaluateGameplayLoadSubmitVerification({
      loadAttempted: true,
      loadValidated: true,
      submitAttempted: true,
      submitValidated: true
    });

    expect(gameplay).toMatchObject({
      outcome: "PASS",
      failed: false
    });
    const instanceResults = [
      "Server status",
      "Worker heartbeat",
      "Runtime lease",
      "Tick advancing",
      "State version",
      "Recovery head",
      "Snapshot freshness"
    ].map((label) => ({
      label,
      outcome: label === "Server status" ? "RUNNING" : "PASS",
      failed: false
    }));
    expect(isLocalHostedVerificationReady(platformResults, [
      ...instanceResults,
      gameplay
    ])).toBe(true);
    expect(isLocalHostedVerificationReady(platformResults, [
      ...instanceResults.map((result) => result.label === "Tick advancing"
        ? { ...result, outcome: "NOT AVAILABLE" }
        : result),
      gameplay
    ])).toBe(false);
  });

  it.each(["LOBBY", "PAUSED", "STOPPED", "ARCHIVED", "FAILED", "PASS", "UNKNOWN"])(
    "does not accept a non-running or invalid server status outcome %s",
    (outcome) => {
      const instanceResults = [
        "Server status",
        "Worker heartbeat",
        "Runtime lease",
        "Tick advancing",
        "State version",
        "Recovery head",
        "Snapshot freshness",
        "Gameplay load/submit"
      ].map((label) => ({
        label,
        outcome: label === "Server status" ? outcome : "PASS",
        failed: false
      }));
      expect(isLocalHostedVerificationReady(platformResults, instanceResults)).toBe(false);
    }
  );

  it("requires every auto-discovered running instance to pass", () => {
    const labels = [
      "Server status",
      "Worker heartbeat",
      "Runtime lease",
      "Tick advancing",
      "State version",
      "Recovery head",
      "Snapshot freshness",
      "Gameplay load/submit"
    ];
    const instanceResults = ["instance:free:healthy", "instance:free:stalled"].flatMap(
      (serverInstanceId) => labels.map((label) => ({
        serverInstanceId,
        label,
        outcome: label === "Server status"
          ? "RUNNING"
          : serverInstanceId.endsWith(":stalled") && label === "Tick advancing"
            ? "NOT AVAILABLE"
            : "PASS",
        failed: false
      }))
    );

    expect(isLocalHostedVerificationReady(platformResults, instanceResults)).toBe(false);
    expect(isLocalHostedVerificationReady(
      platformResults,
      instanceResults.filter((result) => result.serverInstanceId === "instance:free:healthy")
    )).toBe(true);
    expect(isLocalHostedVerificationReady(platformResults, [])).toBe(true);
  });
});

describe("local hosted authenticated gameplay probe", () => {
  const secret = "local-hosted-gameplay-session-secret-123456789";
  const serverInstanceId = "instance:free:eu-central:probe";
  const playerId = "player:probe";
  const sessionRow = {
    session_id: "session:probe",
    account_id: "account:probe",
    player_id: playerId,
    server_instance_id: serverInstanceId,
    created_at: "2026-07-31T10:00:00.000Z",
    expires_at: "2099-07-31T11:00:00.000Z",
    version: 4,
    faction_id: "mafian",
    reserved_spawn_district_id: "district:spawn:1",
    replay_command_id: "command:probe:applied",
    replay_command: {
      id: "command:probe:applied",
      type: "run-building-action",
      mode: "free",
      serverInstanceId,
      playerId,
      issuedAt: "2026-07-31T10:30:00.000Z",
      payload: {
        districtId: "district:spawn:1",
        buildingId: "building:district:spawn:1:restaurant:1",
        actionId: "restaurant_promo"
      }
    }
  };

  it("creates a canonical signed token only from durable session identity", () => {
    const token = createGameplaySessionProbeToken({
      secret,
      session: {
        sessionId: sessionRow.session_id,
        accountId: sessionRow.account_id,
        playerId,
        serverInstanceId,
        factionId: sessionRow.faction_id,
        issuedAt: sessionRow.created_at,
        expiresAt: sessionRow.expires_at,
        version: sessionRow.version
      }
    });

    expect(createGameplaySessionTokenCodec({ secret }).open(token)).toMatchObject({
      sessionId: sessionRow.session_id,
      accountId: sessionRow.account_id,
      playerId,
      serverInstanceId
    });
  });

  it("validates cookie-authenticated load and a mutation-free applied command replay", async () => {
    const requests = [];
    const queries = [];
    const fetchImpl = async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, options, body });
      const isSubmit = String(url).endsWith("/submit");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accepted: true,
          readModel: {
            server: { serverInstanceId },
            player: { playerId, homeDistrictId: sessionRow.reserved_spawn_district_id }
          },
          errors: [],
          ...(isSubmit ? {
            commandResult: {
              commandId: sessionRow.replay_command_id,
              status: "applied"
            }
          } : {})
        })
      };
    };
    const evidence = await verifyAuthenticatedGameplayLoadSubmit({
      pool: {
        query: async (query, parameters) => {
          queries.push({ query, parameters });
          return { rows: [sessionRow] };
        }
      },
      serverInstanceId,
      sessionSecret: secret,
      apiOrigin: "http://127.0.0.1:8787",
      browserOrigin: "http://127.0.0.1:5173",
      fetchImpl
    });

    expect(evidence).toMatchObject({
      loadAttempted: true,
      loadValidated: true,
      submitAttempted: true,
      submitValidated: true,
      failureMessage: ""
    });
    expect(queries).toHaveLength(1);
    expect(queries[0].query).toContain("reservation.payload AS command_payload");
    expect(queries[0].parameters).toEqual([serverInstanceId]);
    expect(requests).toHaveLength(2);
    expect(requests[0].body).toEqual({
      serverInstanceId,
      districtId: sessionRow.reserved_spawn_district_id
    });
    expect(requests[0].body).not.toHaveProperty("playerId");
    expect(requests[0].body).not.toHaveProperty("sessionToken");
    expect(requests[1].body).toEqual({
      command: sessionRow.replay_command,
      focusDistrictId: sessionRow.reserved_spawn_district_id
    });
    expect(requests.every((request) => (
      request.options.headers.cookie.startsWith("empire_gameplay_session=v1.")
      && request.options.headers.origin === "http://127.0.0.1:5173"
    ))).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain(sessionRow.session_id);
    expect(evaluateGameplayLoadSubmitVerification(evidence)).toMatchObject({
      outcome: "PASS",
      failed: false
    });
  });

  it("keeps submit unavailable when no safe applied replay exists", async () => {
    const evidence = await verifyAuthenticatedGameplayLoadSubmit({
      pool: {
        query: async () => ({
          rows: [{
            ...sessionRow,
            replay_command_id: null,
            replay_command: null
          }]
        })
      },
      serverInstanceId,
      sessionSecret: secret,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          accepted: true,
          readModel: {
            server: { serverInstanceId },
            player: { playerId }
          },
          errors: []
        })
      })
    });

    expect(evidence).toMatchObject({
      loadAttempted: true,
      loadValidated: true,
      submitAttempted: false,
      submitValidated: false
    });
    expect(evaluateGameplayLoadSubmitVerification(evidence)).toMatchObject({
      outcome: "NOT AVAILABLE",
      failed: false
    });
  });
});
