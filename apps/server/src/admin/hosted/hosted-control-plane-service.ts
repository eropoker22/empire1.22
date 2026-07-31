import * as crypto from "node:crypto";
import type {
  AdminControlPlaneAvailabilityView,
  AdminCreateServerResultView,
  AdminLifecycleActionResultView,
  AdminSessionView
} from "@empire/shared-types";
import type { AdminDurableRepositories } from "../read-only";
import { PRODUCTION_MIGRATION_CONTRACT } from "../../runtime/persistence/postgres";
import { HOSTED_WORKER_FRESH_MS, type HostedActionRequestRecord, type HostedServerRecord } from "./hosted-control-plane-repository";
import {
  createHostedAdminServerView,
  createHostedLifecycleSnapshot,
  parseHostedActionRequest,
  parseHostedCreateRequest
} from "./hosted-control-plane-policy";
import { archiveHostedServer } from "./hosted-server-archive-service";
import {
  hasSecureHostedOriginPolicy,
  hasSecureHostedSessions,
  hostedEnvironmentEnabled,
  safeHostedBuildSha
} from "./hosted-control-plane-environment";
import { loadHostedAdminServerViews } from "./hosted-admin-server-view-loader";

const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9._:-]{16,200}$/u;

export const createHostedControlPlaneService = (options: {
  repositories: AdminDurableRepositories;
  environment: Record<string, string | undefined>;
  now?: () => Date;
  allowInMemoryForTests?: boolean;
}) => {
  const now = options.now ?? (() => new Date());

  const platformAvailability = async (): Promise<
    Omit<AdminControlPlaneAvailabilityView, "servers">
  > => {
    const writesEnabled = hostedEnvironmentEnabled(options.environment.EMPIRE_ADMIN_WRITES_ENABLED)
      && hostedEnvironmentEnabled(options.environment.EMPIRE_HOSTED_CONTROL_PLANE_ENABLED);
    const provisioningEnabled = hostedEnvironmentEnabled(options.environment.EMPIRE_SERVER_PROVISIONING_ENABLED);
    const databaseAvailable = options.repositories.kind === "postgres" || options.allowInMemoryForTests === true;
    const migrationsCurrent = await options.repositories.hosted.isSchemaCurrent().catch(() => false) || options.allowInMemoryForTests === true;
    const generatedAt = now();
    const worker = databaseAvailable
      ? await options.repositories.hosted.getFreshWorkerHeartbeat(
          new Date(generatedAt.getTime() - HOSTED_WORKER_FRESH_MS).toISOString()
        ).catch(() => null)
      : null;
    const workerStatus = worker ? "online" as const : "offline" as const;
    const apiBuildSha = safeHostedBuildSha(options.environment.EMPIRE_BUILD_SHA);
    const workerBuildSha = safeHostedBuildSha(worker?.buildSha);
    const buildCompatibility = !apiBuildSha || !workerBuildSha ? "missing" as const
      : apiBuildSha === workerBuildSha ? "current" as const
      : "mismatch" as const;
    const production = options.environment.NODE_ENV === "production";
    const sessionSecurity = !production ? "not-applicable" as const
      : hasSecureHostedSessions(options.environment) ? "current" as const
      : "blocked" as const;
    const originPolicy = !production ? "not-applicable" as const
      : hasSecureHostedOriginPolicy(options.environment.EMPIRE_ALLOWED_ORIGINS) ? "current" as const
      : "blocked" as const;
    const registrationEnabled = hostedEnvironmentEnabled(options.environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED);
    const unavailableCode = !writesEnabled ? "ADMIN_WRITES_DISABLED"
      : !provisioningEnabled ? "SERVER_PROVISIONING_DISABLED"
      : !databaseAvailable ? "DATABASE_UNAVAILABLE"
      : !migrationsCurrent ? "DATABASE_MIGRATIONS_PENDING"
      : !worker ? "WORKER_OFFLINE"
      : sessionSecurity === "blocked" ? "SESSION_SECURITY_INVALID"
      : originPolicy === "blocked" ? "ORIGIN_POLICY_INVALID"
      : buildCompatibility === "missing" ? "BUILD_SHA_UNAVAILABLE"
      : buildCompatibility === "mismatch" ? "BUILD_SHA_MISMATCH"
      : null;
    return { writesEnabled, provisioningEnabled, databaseAvailable, migrationsCurrent, workerStatus, buildCompatibility,
      sessionSecurity, originPolicy, registrationEnabled, unavailableCode,
      apiBuildSha, workerBuildSha,
      schemaVersion: PRODUCTION_MIGRATION_CONTRACT.at(-1)?.[0] ?? null,
      generatedAt: generatedAt.toISOString() };
  };

  const availability = async (): Promise<AdminControlPlaneAvailabilityView> => {
    const platform = await platformAvailability();
    const generatedAt = new Date(platform.generatedAt);
    const servers = platform.databaseAvailable && platform.migrationsCurrent
      ? await options.repositories.hosted.listServers()
      : [];
    const serverViews = await loadHostedAdminServerViews(
      options.repositories.hosted,
      servers,
      generatedAt
    );
    return { ...platform, servers: serverViews };
  };

  const availabilityForInstance = async (
    serverInstanceId: string
  ): Promise<AdminControlPlaneAvailabilityView> => {
    const platform = await platformAvailability();
    const generatedAt = new Date(platform.generatedAt);
    const server = platform.databaseAvailable && platform.migrationsCurrent
      ? await options.repositories.hosted.getServer(serverInstanceId)
      : null;
    const serverViews = await loadHostedAdminServerViews(
      options.repositories.hosted,
      server ? [server] : [],
      generatedAt
    );
    return { ...platform, servers: serverViews };
  };

  return {
    availability,
    availabilityForInstance,
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
      const gate = await platformAvailability();
      if (gate.unavailableCode) return reject(gate.unavailableCode, "Admin writes are unavailable.");
      if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) return reject("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
      const parsed = parseHostedCreateRequest(input.payload, options.environment);
      if (!parsed.accepted) return parsed;

      const at = now().toISOString();
      const serverInstanceId = `instance:${parsed.data.mode}:${parsed.data.region}:${crypto.randomUUID()}`;
      const jobId = `provisioning-job:${crypto.randomUUID()}`;
      const server: HostedServerRecord = {
        serverInstanceId,
        mode: parsed.data.mode,
        serverTemplate: parsed.data.serverTemplate,
        displayName: parsed.data.displayName,
        region: parsed.data.region,
        capacity: parsed.data.capacity,
        status: "requested",
        joinPolicy: "closed",
        provisioningState: "requested",
        worldSeed: crypto.randomBytes(32).toString("base64url"),
        configVersion: 1,
        mapComposition: parsed.data.mapComposition,
        startingPlayerState: parsed.data.startingPlayerState!,
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
        version: 1,
        ...createHostedLifecycleSnapshot(parsed.data.mode, parsed.data.serverTemplate)
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
      return accept<AdminCreateServerResultView>({ replayed: result.kind === "replayed",
        server: createHostedAdminServerView({ server: result.server, now: new Date(at), committedPlayers: 0,
          reservedSlots: 0, readyPlayers: 0 }), provisioningJobId: result.job.jobId });
    },
    requestAction: async (input: {
      session: AdminSessionView;
      serverInstanceId: string;
      payload: unknown;
      idempotencyKey: string;
      correlationId: string;
    }) => {
      const parsed = parseHostedActionRequest(input.payload);
      if (!parsed.accepted) return parsed;
      if (input.session.role === "viewer" || (["stop", "delete", "close-registration-now"].includes(parsed.data.action)
        && input.session.role !== "owner")) {
        await appendFailureAudit(input.session, "forbidden-access", input.correlationId, input.serverInstanceId, "forbidden");
        return reject("ADMIN_FORBIDDEN", "Admin role does not permit this lifecycle action.");
      }
      const gate = await platformAvailability();
      if (gate.unavailableCode) return reject(gate.unavailableCode, "Admin writes are unavailable.");
      if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) return reject("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
      const at = now().toISOString();
      if (parsed.data.action === "delete") {
        return archiveHostedServer({
          repository: options.repositories.hosted,
          session: input.session,
          serverInstanceId: input.serverInstanceId,
          action: parsed.data,
          idempotencyKey: input.idempotencyKey,
          requestHash: requestHash({ serverInstanceId: input.serverInstanceId, ...parsed.data }),
          at,
          audit: audit(input.session, "server-archived", input.correlationId, input.serverInstanceId, at)
        });
      }
      const request: HostedActionRequestRecord = {
        actionRequestId: `hosted-action:${crypto.randomUUID()}`,
        serverInstanceId: input.serverInstanceId,
        adminUserId: input.session.adminUserId,
        action: parsed.data.action,
        actionPayload: parsed.data.registrationOpensAt ? { registrationOpensAt: parsed.data.registrationOpensAt } : {},
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
        audit: audit(input.session, parsed.data.action === "start" ? "server-start-requested" : "lifecycle-request",
          input.correlationId, input.serverInstanceId, at)
      });
      if (result.kind === "not-found") return reject("ADMIN_INSTANCE_NOT_FOUND", "Admin instance was not found.");
      if (result.kind === "not-ready") return reject("ADMIN_INSTANCE_NOT_READY", "Server provisioning is not ready.");
      if (result.kind === "operation-active") {
        return reject("SERVER_LIFECYCLE_OPERATION_ACTIVE", "Server právě dokončuje jinou lifecycle operaci.");
      }
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

const requestHash = (value: unknown): string => crypto.createHash("sha256").update(stable(value)).digest("hex");
const stable = (value: unknown): string => JSON.stringify(sort(value));
const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort) : record(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)])) : value;
const audit = (session: AdminSessionView, action: "create-server-request" | "lifecycle-request" | "server-start-requested" | "server-archived", correlationId: string, target: string, at: string) => ({
  id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: session.adminSessionId, actorId: session.actorId,
  role: session.role, action, targetInstanceId: target, result: "success" as const, createdAt: at, correlationId
});
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const accept = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const reject = (code: string, message: string) => ({ accepted: false as const, data: null, errors: [{ code, message }] });
