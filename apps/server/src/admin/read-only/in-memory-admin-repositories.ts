import type {
  AdminAuditEntryView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView
} from "@empire/shared-types";
import type { AdminDurableRepositories, AdminStoredSession } from "./admin-repositories";
import { assertAdminInstanceDetailScope } from "./admin-scope-guard";

export interface InMemoryAdminRepositorySeed {
  instances?: AdminInstanceSummaryView[];
  details?: AdminInstanceDetailView[];
}

export const createInMemoryAdminDurableRepositories = (
  seed: InMemoryAdminRepositorySeed = {}
): AdminDurableRepositories => {
  const instances = new Map((seed.instances ?? []).map((entry) => [entry.serverInstanceId, entry]));
  const details = new Map((seed.details ?? []).map((entry) => [entry.serverInstanceId, entry]));
  const sessions = new Map<string, AdminStoredSession>();
  const audits: AdminAuditEntryView[] = [];
  const failures: Array<{ fingerprintHash: string; actorHash: string; createdAt: string }> = [];

  for (const detail of details.values()) {
    assertAdminInstanceDetailScope(detail.serverInstanceId, detail);
    instances.set(detail.serverInstanceId, detail.summary);
  }

  return {
    kind: "memory",
    monitoring: {
      durable: false,
      listKnownInstances: async () => [...instances.values()],
      getInstanceSummary: async (id) => instances.get(id) ?? null,
      getInstanceRuntimeProjection: async (id) => details.get(id) ?? null,
      getInstanceHealth: async (id) => instances.get(id)?.freshness ?? null,
      listInstanceCommandSummaries: async (id, limit) => (details.get(id)?.commands ?? []).slice(-cap(limit)),
      listInstanceEventSummaries: async (id, limit) => (details.get(id)?.events ?? []).slice(-cap(limit)),
      listInstanceDiagnosticSummaries: async (id, limit) => (details.get(id)?.diagnostics ?? []).slice(-cap(limit)),
      getWorkerHeartbeat: async (id) => {
        const summary = instances.get(id);
        return summary ? {
          serverInstanceId: id,
          ownerId: summary.leaseOwner,
          lastHeartbeatAt: summary.lastHeartbeatAt,
          leaseExpiresAt: summary.leaseExpiresAt
        } : null;
      },
      getSnapshotMetadata: async (id) => details.get(id)?.snapshot ?? null
    },
    sessions: {
      durable: false,
      createSession: async (session) => {
        sessions.set(session.tokenHash, session);
        return session;
      },
      getSessionByTokenHash: async (tokenHash) => sessions.get(tokenHash) ?? null,
      revokeSession: async (sessionId, revokedAt) => {
        const session = [...sessions.values()].find((entry) => entry.adminSessionId === sessionId);
        if (!session || session.revokedAt) return false;
        session.revokedAt = revokedAt;
        return true;
      }
    },
    audit: {
      durable: false,
      append: async (entry) => { audits.push(entry); },
      list: async (limit) => audits.slice(-cap(limit)).reverse()
    },
    loginRateLimit: {
      durable: false,
      countRecentFailures: async (scopeHash, since) => failures.filter((entry) =>
        (entry.fingerprintHash === scopeHash || entry.actorHash === scopeHash) && entry.createdAt >= since
      ).length,
      recordFailure: async (entry) => { failures.push(entry); }
    }
  };
};

const cap = (limit: number): number => Math.max(0, Math.min(200, Math.floor(limit)));
