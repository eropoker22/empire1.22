import type {
  AdminAuditEntryView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView
} from "@empire/shared-types";
import type { AdminDurableRepositories, AdminStoredSession, AdminUserRecord } from "./admin-repositories";
import { assertAdminInstanceDetailScope } from "./admin-scope-guard";
import { createInMemoryHostedControlPlaneRepository } from "../hosted/in-memory-hosted-control-plane-repository";

export interface InMemoryAdminRepositorySeed {
  instances?: AdminInstanceSummaryView[];
  details?: AdminInstanceDetailView[];
  users?: AdminUserRecord[];
}

export const createInMemoryAdminDurableRepositories = (
  seed: InMemoryAdminRepositorySeed = {}
): AdminDurableRepositories => {
  const instances = new Map((seed.instances ?? []).map((entry) => [entry.serverInstanceId, entry]));
  const details = new Map((seed.details ?? []).map((entry) => [entry.serverInstanceId, entry]));
  const sessions = new Map<string, AdminStoredSession>();
  const users = new Map((seed.users ?? []).map((entry) => [entry.adminUserId, { ...entry }]));
  const audits: AdminAuditEntryView[] = [];
  const failures: Array<{ fingerprintHash: string; actorHash: string; usernameHash: string; combinationHash: string; createdAt: string }> = [];

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
    users: {
      durable: false,
      getByNormalizedUsername: async (normalized) => [...users.values()].find((entry) => entry.normalizedUsername === normalized) ?? null,
      getById: async (id) => users.get(id) ?? null,
      create: async (user) => {
        if ([...users.values()].some((entry) => entry.normalizedUsername === user.normalizedUsername)) {
          throw new Error("Admin username already exists.");
        }
        users.set(user.adminUserId, { ...user });
        return { ...user };
      },
      updateProfileAndRole: async (input) => {
        const user = users.get(input.adminUserId);
        if (!user) throw new Error("Admin user was not found.");
        Object.assign(user, input, { version: user.version + 1 });
        return { ...user };
      },
      rotatePassword: async (input) => {
        const user = users.get(input.adminUserId);
        if (!user) throw new Error("Admin user was not found.");
        Object.assign(user, input, { passwordVersion: user.passwordVersion + 1, version: user.version + 1 });
        return { ...user };
      },
      recordLogin: async (id, at) => {
        const user = users.get(id);
        if (user) Object.assign(user, { lastLoginAt: at, updatedAt: at, version: user.version + 1 });
      }
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
      },
      revokeSessionsForUser: async (userId, revokedAt, exceptId) => {
        let count = 0;
        for (const session of sessions.values()) {
          if (session.adminUserId === userId && session.adminSessionId !== exceptId && !session.revokedAt) {
            session.revokedAt = revokedAt; count += 1;
          }
        }
        return count;
      },
      touchSession: async (sessionId, lastSeenAt) => {
        const session = [...sessions.values()].find((entry) => entry.adminSessionId === sessionId);
        if (session && !session.revokedAt) session.lastSeenAt = lastSeenAt;
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
        (entry.fingerprintHash === scopeHash || entry.actorHash === scopeHash || entry.usernameHash === scopeHash || entry.combinationHash === scopeHash) && entry.createdAt >= since
      ).length,
      recordFailure: async (entry) => { failures.push(entry); },
      clearFailures: async (usernameHash, combinationHash) => {
        for (let index = failures.length - 1; index >= 0; index -= 1) {
          if (failures[index]!.usernameHash === usernameHash || failures[index]!.combinationHash === combinationHash) failures.splice(index, 1);
        }
      }
    },
    hosted: createInMemoryHostedControlPlaneRepository()
  };
};

const cap = (limit: number): number => Math.max(0, Math.min(200, Math.floor(limit)));
