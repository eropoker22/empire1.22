import { describe, expect, it, vi } from "vitest";
import type { AccountIdentityProvider, GameplaySessionService } from "../../apps/server/src/auth";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth";
import {
  createInMemoryHostedControlPlaneRepository,
  type HostedControlPlaneRepository,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import {
  createInMemoryAdminDurableRepositories,
  type AdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import { createServerApp, type ServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { createHostedRuntimeLoader } from "../../apps/server/src/bootstrap/hosted-runtime-loader";
import {
  sharedCitySpawnDistrictIds,
  type ServerMapComposition
} from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { createInMemoryRuntimePersistenceRepositories } from "../../apps/server/src/runtime";

const SNAPSHOT_SECRET = "cold-hosted-snapshot-secret-at-least-32-characters";
const SESSION_SECRET = "cold-hosted-session-secret-at-least-32-characters";
const INSTANCE_ID = "instance:free:eu-central:cold-hosted";
const ACCOUNT_ID = "account:cold-hosted";
const DISTRICT_ID = sharedCitySpawnDistrictIds[0]!;
const ORIGIN = "https://empire.test";
const ENVIRONMENT = {
  NODE_ENV: "production",
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: SNAPSHOT_SECRET,
  GAMEPLAY_SLICE_SESSION_SECRET: SESSION_SECRET,
  EMPIRE_ALLOWED_ORIGINS: ORIGIN
};

describe("hosted runtime cold Netlify function", () => {
  it("joins, loads, submits, and looks up a command through fresh process registries", async () => {
    const fixture = await createFixture();
    await fixture.seedSnapshot(41);
    const ticket = await fixture.createTicket();

    const joinBoundary = fixture.createBoundary();
    const join = await readBody(joinBoundary.handler(postEvent("/api/gameplay-slice/join", {
      joinTicket: ticket,
      serverInstanceId: INSTANCE_ID,
      preferredStartDistrictId: DISTRICT_ID,
      factionId: "mafian"
    })));

    expect(join.json.accepted).toBe(true);
    expect(join.json.snapshotToken ?? null).toBeNull();
    const cookie = cookieHeader(join.headers["set-cookie"]);

    const loadBoundary = fixture.createBoundary();
    const load = await readBody(loadBoundary.handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId: INSTANCE_ID,
      districtId: DISTRICT_ID,
      snapshotToken: "v1.browser-state-is-not-authority.invalid"
    }, { cookie })));

    expect(load.json.accepted).toBe(true);
    expect(load.json.metadata.stateVersion).toBe(41);
    expect(load.json.readModel.player.playerId).toBe(fixture.playerId);
    expect(load.json.snapshotToken ?? null).toBeNull();

    const commandId = "command:cold-hosted:select-spawn";
    const submitBoundary = fixture.createBoundary();
    const submit = await readBody(submitBoundary.handler(postEvent("/api/gameplay-slice/submit", {
      focusDistrictId: DISTRICT_ID,
      command: {
        id: commandId,
        type: "select-spawn-district",
        mode: "free",
        playerId: fixture.playerId,
        serverInstanceId: INSTANCE_ID,
        issuedAt: new Date(0).toISOString(),
        payload: { districtId: DISTRICT_ID },
        clientRequestId: null
      }
    }, { cookie })));

    expect(submit.json.accepted).toBe(true);
    expect(submit.json.errors).toEqual([]);
    expect(submit.json.commandResult).toMatchObject({ commandId, status: "applied" });

    const resultBoundary = fixture.createBoundary();
    const result = await readBody(resultBoundary.handler(postEvent("/api/gameplay-slice/command-result", {
      serverInstanceId: INSTANCE_ID,
      commandId,
      districtId: DISTRICT_ID
    }, { cookie })));

    expect(result.json).toMatchObject({
      accepted: true,
      status: "applied",
      commandResult: { commandId, status: "applied" }
    });
  });

  it("does not consume a one-use join ticket before durable hydration succeeds", async () => {
    const fixture = await createFixture();
    const ticket = await fixture.createTicket();
    const boundary = fixture.createBoundary();
    const request = postEvent("/api/gameplay-slice/join", {
      joinTicket: ticket,
      serverInstanceId: INSTANCE_ID,
      preferredStartDistrictId: DISTRICT_ID,
      factionId: "mafian"
    });

    const unavailable = await readBody(boundary.handler(request));
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json.errors[0]?.code).toBe("server.snapshot_not_found");

    await fixture.seedSnapshot(7);
    const retry = await readBody(boundary.handler(request));
    expect(retry.json.accepted).toBe(true);
  });

  it.each(["lobby", "paused"] as const)("allows load but rejects submit while hosted status is %s", async (status) => {
    const fixture = await createFixture(status);
    await fixture.seedSnapshot(11);
    const boundary = await fixture.createAuthenticatedBoundary();
    const load = await readBody(boundary.handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId: INSTANCE_ID,
      districtId: DISTRICT_ID
    }, { cookie: boundary.cookie })));
    expect(load.json.accepted).toBe(true);

    const submit = await submitSpawn(boundary.handler, boundary.cookie, fixture.playerId,
      `command:cold-hosted:${status}`);
    expect(submit.json.accepted).toBe(false);
    expect(submit.json.errors[0]).toMatchObject({
      code: "server.instance_not_running",
      details: { serverInstanceId: INSTANCE_ID, status }
    });
  });

  it("allows submit while the durable hosted status is running", async () => {
    const fixture = await createFixture("running");
    await fixture.seedSnapshot(12);
    const boundary = await fixture.createAuthenticatedBoundary();
    const submit = await submitSpawn(boundary.handler, boundary.cookie, fixture.playerId,
      "command:cold-hosted:running");
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.errors).toEqual([]);
  });

  it("never lets a delayed stale load overwrite a newer warm runtime", async () => {
    const fixture = await createFixture("running");
    await fixture.seedSnapshot(17);
    const boundary = fixture.createBoundary();
    const loader = createHostedRuntimeLoader({ server: boundary.server, controlPlane: fixture.hosted });
    expect((await loader.load(INSTANCE_ID)).accepted).toBe(true);
    const runtime = boundary.server.instanceManager.getInstanceById(INSTANCE_ID)!;
    const staleSnapshot = await fixture.persistence.snapshotRepository.loadLatest(INSTANCE_ID);
    if (!staleSnapshot) throw new Error("Expected a stale snapshot fixture.");
    const entered = deferredSignal();
    const release = deferredSignal();
    const loadSpy = vi.spyOn(fixture.persistence.snapshotRepository, "loadLatest")
      .mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        return staleSnapshot;
      });

    const delayedLoad = loader.load(INSTANCE_ID);
    await entered.promise;
    runtime.state.root.version = 18;
    runtime.state.root.tick = 99;
    release.resolve();
    expect((await delayedLoad).accepted).toBe(true);

    expect(runtime.state.root.version).toBe(18);
    expect(runtime.state.root.tick).toBe(99);
    loadSpy.mockRestore();
  });
});

const createFixture = async (status: HostedServerRecord["status"] = "running") => {
  const persistence = {
    ...createInMemoryRuntimePersistenceRepositories(),
    atomicCommandPersistenceMode: "transactional" as const
  };
  const sessions = createInMemoryGameplaySessionService({ productionReady: true });
  const registration = await sessions.getOrCreateRegistration({
    accountId: ACCOUNT_ID,
    serverInstanceId: INSTANCE_ID,
    nowIso: new Date().toISOString()
  });
  const hosted = createInMemoryHostedControlPlaneRepository({ servers: [hostedRecord(status)] });
  const repositories = durableRepositories(hosted);

  const seedSnapshot = async (rootVersion: number) => {
    const seed = createServerApp({ persistence });
    const created = seed.serverInstanceCreationService.createGameServerInstanceResult({
      serverInstanceId: INSTANCE_ID,
      mode: "free",
      displayName: "Cold Hosted",
      region: "eu-central",
      capacity: 20,
      mapComposition: hostedRecord(status).mapComposition as ServerMapComposition,
      joinPolicy: "open",
      worldSeed: hostedRecord(status).worldSeed
    });
    if (!created.accepted) throw new Error("Cold hosted fixture runtime could not be created.");
    const membership = ensureGameplaySliceMembershipInState(created.runtime.state, {
      serverInstanceId: INSTANCE_ID,
      playerId: registration.playerId,
      factionId: "mafian",
      mode: "free"
    });
    if (!membership.accepted) throw new Error("Cold hosted fixture membership could not be created.");
    created.runtime.state = membership.state;
    created.runtime.state.root.version = rootVersion;
    await seed.instanceManager.saveInstanceSnapshot(INSTANCE_ID);
  };

  return {
    playerId: registration.playerId,
    hosted,
    persistence,
    seedSnapshot,
    createTicket: async () => (await sessions.createJoinTicket({
      accountId: ACCOUNT_ID,
      serverInstanceId: INSTANCE_ID,
      mode: "free",
      factionId: "mafian",
      nowIso: new Date().toISOString()
    })).ticketId,
    createAuthenticatedBoundary: async () => {
      const boundary = createBoundary(persistence, sessions, repositories);
      const session = await sessions.createSession({ registration, nowIso: new Date().toISOString(), ttlMs: 60_000 });
      const token = boundary.server.gameplaySessionTokenCodec!.seal({
        sessionId: session.sessionId, accountId: session.accountId, serverInstanceId: session.serverInstanceId,
        playerId: session.playerId, factionId: "mafian", issuedAt: session.createdAt,
        expiresAt: session.expiresAt, version: session.version
      });
      return { ...boundary, cookie: `empire_gameplay_session=${token}` };
    },
    createBoundary: () => createBoundary(persistence, sessions, repositories)
  };
};

const createBoundary = (
  persistence: ReturnType<typeof createInMemoryRuntimePersistenceRepositories>,
  sessions: GameplaySessionService,
  repositories: AdminDurableRepositories
) => {
  const server = createServerApp({
    persistence,
    environment: ENVIRONMENT,
    gameplaySessionService: sessions,
    accountIdentityProvider: fixedAccountProvider()
  });
  return {
    server,
    handler: createGameplaySliceFunctionHandler({ environment: ENVIRONMENT, server, adminRepositories: repositories })
  };
};

const durableRepositories = (hosted: HostedControlPlaneRepository): AdminDurableRepositories => {
  const memory = createInMemoryAdminDurableRepositories();
  return {
    ...memory,
    kind: "postgres",
    monitoring: { ...memory.monitoring, durable: true },
    users: { ...memory.users, durable: true },
    sessions: { ...memory.sessions, durable: true },
    audit: { ...memory.audit, durable: true },
    loginRateLimit: { ...memory.loginRateLimit, durable: true },
    hosted: { ...hosted, durable: true }
  };
};

const hostedRecord = (status: HostedServerRecord["status"] = "running"): HostedServerRecord => {
  const now = new Date().toISOString();
  return {
    serverInstanceId: INSTANCE_ID,
    mode: "free",
    serverTemplate: "full",
    displayName: "Cold Hosted",
    region: "eu-central",
    capacity: 20,
    status,
    joinPolicy: "open",
    provisioningState: "ready",
    minimumReadyPlayersToStart: 2,
    registrationWindowMinutes: 60,
    registrationScheduleVersion: 1,
    registrationOpensAt: new Date(Date.parse(now) - 30 * 60_000).toISOString(),
    registrationClosesAt: new Date(Date.parse(now) + 30 * 60_000).toISOString(),
    registrationClosedAt: null,
    registrationBaselinePlayers: null,
    canonicalFinalLockdownTrigger: 8,
    canonicalFirstEliminationTick: 5_760,
    canonicalTickRateMs: 5_000,
    effectiveFinalLockdownTrigger: null,
    effectiveFirstEliminationTick: null,
    worldSeed: "cold-hosted-world-seed",
    configVersion: 1,
    mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
    initialSnapshotId: "snapshot:initial",
    currentSnapshotId: "snapshot:latest",
    runtimeLeaseOwnerId: status === "running" ? "worker:cold-hosted" : null,
    runtimeLeaseExpiresAt: status === "running" ? new Date(Date.now() + 60_000).toISOString() : null,
    lastWorkerHeartbeatAt: now,
    lastStartedAt: now,
    lastPausedAt: status === "paused" ? now : null,
    lastStoppedAt: null,
    lastErrorCode: null,
    createdByAdminUserId: "admin-user:cold-hosted",
    createdAt: now,
    updatedAt: now,
    version: 3
  };
};

const fixedAccountProvider = (): AccountIdentityProvider => ({
  productionReady: true,
  resolve: () => ({ accountId: ACCOUNT_ID, provider: "production" })
});

const postEvent = (path: string, body: unknown, headers?: Record<string, string>) => ({
  httpMethod: "POST",
  path,
  body: JSON.stringify(body),
  headers: { origin: ORIGIN, "content-type": "application/json", ...headers }
});

const readBody = async (responsePromise: ReturnType<ReturnType<typeof createGameplaySliceFunctionHandler>>) => {
  const response = await responsePromise;
  return { ...response, json: response.body ? JSON.parse(response.body) : null };
};

const cookieHeader = (setCookie: string | undefined): string => String(setCookie ?? "").split(";")[0] ?? "";

const submitSpawn = async (
  handler: ReturnType<typeof createGameplaySliceFunctionHandler>,
  cookie: string,
  playerId: string,
  commandId: string
) => readBody(handler(postEvent("/api/gameplay-slice/submit", {
  focusDistrictId: DISTRICT_ID,
  command: {
    id: commandId, type: "select-spawn-district", mode: "free", playerId,
    serverInstanceId: INSTANCE_ID, issuedAt: new Date(0).toISOString(), payload: { districtId: DISTRICT_ID },
    clientRequestId: null
  }
}, { cookie })));

const deferredSignal = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
};
