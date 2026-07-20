import * as crypto from "node:crypto";
import { resolveModeConfig } from "@empire/game-config";
import type {
  AdminApiErrorView,
  AdminControlPlaneAvailabilityView,
  AdminCreateServerRequestView,
  AdminCreateServerResultView,
  AdminHostedServerView,
  AdminLifecycleActionRequestView,
  AdminLifecycleActionResultView,
  AdminSessionView
} from "@empire/shared-types";
import { validateServerMapComposition } from "../../bootstrap/gameplay-slice-shared-city-seed";
import type { AdminDurableRepositories } from "../read-only";
import { HOSTED_WORKER_FRESH_MS, type HostedActionRequestRecord, type HostedServerRecord } from "./hosted-control-plane-repository";

const ALLOWED_REGIONS = new Set(["eu-central"]);
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9._:-]{16,200}$/u;

export const createHostedControlPlaneService = (options: {
  repositories: AdminDurableRepositories;
  environment: Record<string, string | undefined>;
  now?: () => Date;
  allowInMemoryForTests?: boolean;
}) => {
  const now = options.now ?? (() => new Date());

  const availability = async (): Promise<AdminControlPlaneAvailabilityView> => {
    const writesEnabled = enabled(options.environment.EMPIRE_ADMIN_WRITES_ENABLED) && enabled(options.environment.EMPIRE_HOSTED_CONTROL_PLANE_ENABLED);
    const provisioningEnabled = enabled(options.environment.EMPIRE_SERVER_PROVISIONING_ENABLED);
    const databaseAvailable = options.repositories.kind === "postgres" || options.allowInMemoryForTests === true;
    const migrationsCurrent = await options.repositories.hosted.isSchemaCurrent().catch(() => false) || options.allowInMemoryForTests === true;
    const [worker, servers] = databaseAvailable ? await Promise.all([
      options.repositories.hosted.getFreshWorkerHeartbeat(new Date(now().getTime() - HOSTED_WORKER_FRESH_MS).toISOString()).catch(() => null),
      options.repositories.hosted.listServers().catch(() => [])
    ]) : [null, []];
    const workerStatus = worker ? "online" as const : "offline" as const;
    const unavailableCode = !writesEnabled ? "ADMIN_WRITES_DISABLED"
      : !provisioningEnabled ? "SERVER_PROVISIONING_DISABLED"
      : !databaseAvailable ? "DATABASE_UNAVAILABLE"
      : !migrationsCurrent ? "DATABASE_MIGRATIONS_PENDING"
      : !worker ? "WORKER_OFFLINE"
      : null;
    const serverViews = await Promise.all(servers.map(async (server) => {
      const capacity = await options.repositories.hosted.getJoinCapacity(server.serverInstanceId, now().toISOString())
        .catch(() => ({ committedPlayers: 0, reservedSlots: 0 }));
      return { ...toView(server), ...capacity };
    }));
    return { writesEnabled, provisioningEnabled, databaseAvailable, migrationsCurrent, workerStatus, unavailableCode,
      servers: serverViews };
  };

  return {
    availability,
    createServer: async (input: {
      session: AdminSessionView;
      payload: unknown;
      idempotencyKey: string;
      correlationId: string;
    }) => {
      if (input.session.role === "viewer") {
        await appendFailureAudit(input.session, "forbidden-access", input.correlationId, null, "forbidden");
        return reject("ADMIN_FORBIDDEN", "Admin role does not permit server creation.");
      }
      const gate = await availability();
      if (gate.unavailableCode) return reject(gate.unavailableCode, "Admin writes are unavailable.");
      if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) return reject("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
      const parsed = parseCreateRequest(input.payload, options.environment);
      if (!parsed.accepted) return parsed;

      const at = now().toISOString();
      const serverInstanceId = `instance:${parsed.data.mode}:${parsed.data.region}:${crypto.randomUUID()}`;
      const jobId = `provisioning-job:${crypto.randomUUID()}`;
      const server: HostedServerRecord = {
        serverInstanceId,
        mode: parsed.data.mode,
        displayName: parsed.data.displayName,
        region: parsed.data.region,
        capacity: parsed.data.capacity,
        status: "requested",
        joinPolicy: "closed",
        provisioningState: "requested",
        worldSeed: crypto.randomBytes(32).toString("base64url"),
        configVersion: 1,
        mapComposition: parsed.data.mapComposition,
        initialSnapshotId: null,
        currentSnapshotId: null,
        runtimeLeaseOwnerId: null,
        runtimeLeaseExpiresAt: null,
        lastWorkerHeartbeatAt: null,
        lastStartedAt: null,
        lastPausedAt: null,
        lastStoppedAt: null,
        lastErrorCode: null,
        createdByAdminUserId: input.session.adminUserId,
        createdAt: at,
        updatedAt: at,
        version: 1
      };
      const result = await options.repositories.hosted.createServerTransaction({
        server,
        job: { jobId, serverInstanceId, attempt: 0, status: "pending", availableAt: at, claimedByWorkerId: null,
          claimedUntil: null, lastErrorCode: null, createdAt: at, updatedAt: at, version: 1 },
        adminUserId: input.session.adminUserId,
        idempotencyKey: input.idempotencyKey,
        requestHash: requestHash(parsed.data),
        audit: audit(input.session, "create-server-request", input.correlationId, serverInstanceId, at)
      });
      if (result.kind === "conflict") {
        await appendFailureAudit(input.session, "create-server-request", input.correlationId, null);
        return reject("ADMIN_IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different request.");
      }
      return accept<AdminCreateServerResultView>({ replayed: result.kind === "replayed", server: toView(result.server), provisioningJobId: result.job.jobId });
    },
    requestAction: async (input: {
      session: AdminSessionView;
      serverInstanceId: string;
      payload: unknown;
      idempotencyKey: string;
      correlationId: string;
    }) => {
      const parsed = parseActionRequest(input.payload);
      if (!parsed.accepted) return parsed;
      if (input.session.role === "viewer" || (parsed.data.action === "stop" && input.session.role !== "owner")) {
        await appendFailureAudit(input.session, "forbidden-access", input.correlationId, input.serverInstanceId, "forbidden");
        return reject("ADMIN_FORBIDDEN", "Admin role does not permit this lifecycle action.");
      }
      const gate = await availability();
      if (gate.unavailableCode) return reject(gate.unavailableCode, "Admin writes are unavailable.");
      if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) return reject("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
      const at = now().toISOString();
      const request: HostedActionRequestRecord = {
        actionRequestId: `hosted-action:${crypto.randomUUID()}`,
        serverInstanceId: input.serverInstanceId,
        adminUserId: input.session.adminUserId,
        action: parsed.data.action,
        reason: parsed.data.reason,
        expectedVersion: parsed.data.expectedVersion,
        status: "requested",
        claimedByWorkerId: null,
        claimedUntil: null,
        lastErrorCode: null,
        createdAt: at,
        updatedAt: at,
        version: 1
      };
      const result = await options.repositories.hosted.enqueueActionTransaction({
        request,
        idempotencyKey: input.idempotencyKey,
        requestHash: requestHash({ serverInstanceId: input.serverInstanceId, ...parsed.data }),
        audit: audit(input.session, "lifecycle-request", input.correlationId, input.serverInstanceId, at)
      });
      if (result.kind === "not-found") return reject("ADMIN_INSTANCE_NOT_FOUND", "Admin instance was not found.");
      if (result.kind === "not-ready") return reject("ADMIN_INSTANCE_NOT_READY", "Server provisioning is not ready.");
      if (result.kind === "stale-version") {
        await appendFailureAudit(input.session, "lifecycle-failure", input.correlationId, input.serverInstanceId);
        return reject("ADMIN_STALE_VERSION", "Server version changed. Refresh before retrying.");
      }
      if (result.kind === "conflict") {
        await appendFailureAudit(input.session, "lifecycle-failure", input.correlationId, input.serverInstanceId);
        return reject("ADMIN_IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different request.");
      }
      return accept<AdminLifecycleActionResultView>({ replayed: result.kind === "replayed", actionRequestId: result.request.actionRequestId,
        serverInstanceId: result.request.serverInstanceId, action: result.request.action, status: result.request.status,
        expectedVersion: result.request.expectedVersion });
    }
  };

  async function appendFailureAudit(session: AdminSessionView, action: "forbidden-access" | "create-server-request" | "lifecycle-failure",
    correlationId: string, target: string | null, result: "failure" | "forbidden" = "failure"): Promise<void> {
    await options.repositories.audit.append({ id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: session.adminSessionId,
      actorId: session.actorId, role: session.role, action, targetInstanceId: target, result,
      createdAt: now().toISOString(), correlationId });
  }
};

const parseCreateRequest = (value: unknown, environment: Record<string, string | undefined>) => {
  if (!record(value)) return reject("ADMIN_CREATE_INVALID", "Server creation request is invalid.");
  const mode = value.mode === "free" || value.mode === "war" ? value.mode : null;
  if (!mode || (mode === "war" && !enabled(environment.EMPIRE_WAR_HOSTING_ENABLED))) return reject("ADMIN_MODE_UNAVAILABLE", "Requested mode is unavailable.");
  const displayName = String(value.displayName ?? "").trim();
  if (displayName.length < 3 || displayName.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(displayName)) return reject("ADMIN_DISPLAY_NAME_INVALID", "Display name is invalid.");
  const region = String(value.region ?? "");
  if (!ALLOWED_REGIONS.has(region)) return reject("ADMIN_REGION_INVALID", "Region is invalid.");
  const capacity = Number(value.capacity);
  const modeConfig = resolveModeConfig(mode);
  const finalLockdown = modeConfig.balance.finalLockdown;
  const minimumCapacity = finalLockdown?.enabled ? finalLockdown.triggerActivePlayers : 0;
  if (!Number.isInteger(capacity) || capacity <= minimumCapacity || capacity > modeConfig.balance.maxPlayersPerServer) return reject("ADMIN_CAPACITY_INVALID", "Capacity is invalid.");
  const joinPolicy = value.joinPolicy;
  if (joinPolicy !== "closed") return reject("ADMIN_JOIN_POLICY_INVALID", "Servers must be created with joins closed.");
  const composition = record(value.mapComposition) ? {
    downtown: Number(value.mapComposition.downtown), commercial: Number(value.mapComposition.commercial),
    residential: Number(value.mapComposition.residential), industrial: Number(value.mapComposition.industrial), park: Number(value.mapComposition.park)
  } : null;
  const errors = validateServerMapComposition(composition as never);
  if (!composition || errors.length) return reject("ADMIN_MAP_INVALID", "Map composition is invalid.");
  return accept<AdminCreateServerRequestView>({ mode, displayName, region, capacity, joinPolicy, mapComposition: composition as AdminCreateServerRequestView["mapComposition"] });
};
const parseActionRequest = (value: unknown) => {
  if (!record(value)) return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  const actions = ["open-joins", "close-joins", "start", "pause", "resume", "restart", "stop"] as const;
  if (!actions.includes(value.action as never)) return reject("ADMIN_ACTION_INVALID", "Lifecycle action is invalid.");
  const expectedVersion = Number(value.expectedVersion);
  const reason = String(value.reason ?? "").trim();
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0 || reason.length < 3 || reason.length > 240 || /[\u0000-\u001f\u007f]/u.test(reason)) return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  return accept<AdminLifecycleActionRequestView>({ action: value.action as AdminLifecycleActionRequestView["action"], expectedVersion, reason });
};
const toView = ({ worldSeed: _worldSeed, configVersion: _configVersion, mapComposition: _mapComposition,
  initialSnapshotId: _initialSnapshotId, createdByAdminUserId: _createdBy, lastStartedAt: _started,
  lastPausedAt: _paused, lastStoppedAt: _stopped, ...view }: HostedServerRecord): AdminHostedServerView => view;
const requestHash = (value: unknown): string => crypto.createHash("sha256").update(stable(value)).digest("hex");
const stable = (value: unknown): string => JSON.stringify(sort(value));
const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort) : record(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)])) : value;
const audit = (session: AdminSessionView, action: "create-server-request" | "lifecycle-request", correlationId: string, target: string, at: string) => ({
  id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: session.adminSessionId, actorId: session.actorId,
  role: session.role, action, targetInstanceId: target, result: "success" as const, createdAt: at, correlationId
});
const enabled = (value: string | undefined): boolean => String(value).trim().toLowerCase() === "true";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const accept = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const reject = (code: string, message: string) => ({ accepted: false as const, data: null, errors: [{ code, message } satisfies AdminApiErrorView] });
