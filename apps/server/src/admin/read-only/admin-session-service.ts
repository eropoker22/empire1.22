import * as crypto from "node:crypto";
import type { AdminApiErrorView, AdminAuditAction, AdminAuditEntryView, AdminSessionView } from "@empire/shared-types";
import type { AdminDurableRepositories, AdminStoredSession, AdminUserRecord } from "./admin-repositories";
import { hashAdminPassword, normalizeAdminUsername, verifyAdminPassword } from "./admin-password";

const SESSION_TTL_MS = 30 * 60 * 1000;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;

export const createAdminSessionService = (options: {
  repositories: AdminDurableRepositories;
  environment: Record<string, string | undefined>;
  now?: () => Date;
}) => {
  const now = options.now ?? (() => new Date());
  const fingerprintSecret = resolveFingerprintSecret(options.environment);
  const unavailableUser = createUnavailableUser();

  return {
    configurationReady: fingerprintSecret !== null,
    login: async (input: { username: string; password: string; fingerprint: string; correlationId: string }) => {
      const createdAt = now().toISOString();
      if (!fingerprintSecret) {
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_AUTH_CONFIGURATION_UNAVAILABLE", "Přihlášení se nezdařilo.");
      }

      const normalizedUsername = normalizeAdminUsername(input.username);
      const fingerprintHash = scopeHash(input.fingerprint, fingerprintSecret);
      const usernameHash = scopeHash(normalizedUsername || "invalid", fingerprintSecret);
      const combinationHash = scopeHash(`${normalizedUsername}\u0000${input.fingerprint}`, fingerprintSecret);
      const actorHash = usernameHash;
      const since = new Date(now().getTime() - FAILURE_WINDOW_MS).toISOString();
      const counts = await Promise.all([fingerprintHash, usernameHash, combinationHash]
        .map((scope) => options.repositories.loginRateLimit.countRecentFailures(scope, since)));
      if (counts.some((count) => count >= MAX_FAILURES)) {
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_LOGIN_RATE_LIMITED", "Přihlášení se nezdařilo.");
      }

      const storedUser = normalizedUsername
        ? await options.repositories.users.getByNormalizedUsername(normalizedUsername)
        : null;
      const candidate = storedUser ?? await unavailableUser;
      const passwordAccepted = await verifyAdminPassword(input.password, candidate);
      if (!storedUser || storedUser.status !== "active" || !passwordAccepted) {
        await options.repositories.loginRateLimit.recordFailure({
          id: `admin-login-failure:${randomToken()}`,
          fingerprintHash,
          actorHash,
          usernameHash,
          combinationHash,
          createdAt
        });
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_AUTH_INVALID", "Přihlášení se nezdařilo.");
      }

      const token = randomToken();
      const session: AdminStoredSession = {
        adminSessionId: `admin-session:${randomToken()}`,
        tokenHash: hashToken(token),
        adminUserId: storedUser.adminUserId,
        actorId: storedUser.adminUserId,
        username: storedUser.username,
        displayName: storedUser.displayName,
        role: storedUser.role,
        authenticationMethod: "password",
        passwordVersion: storedUser.passwordVersion,
        createdAt,
        expiresAt: new Date(now().getTime() + SESSION_TTL_MS).toISOString(),
        revokedAt: null,
        lastSeenAt: createdAt
      };
      await options.repositories.sessions.createSession(session);
      await options.repositories.users.recordLogin(storedUser.adminUserId, createdAt);
      await options.repositories.loginRateLimit.clearFailures(usernameHash, combinationHash);
      await audit(session, "login-success", "success", input.correlationId);
      return { accepted: true as const, token, session: toView(session), errors: [] as [] };
    },
    authenticate: async (token: string | null, correlationId: string) => {
      if (!token) return reject("ADMIN_SESSION_REQUIRED", "Admin session is required.");
      const session = await options.repositories.sessions.getSessionByTokenHash(hashToken(token));
      if (!session) return reject("ADMIN_SESSION_INVALID", "Admin session is invalid.");
      if (session.revokedAt) {
        await audit(session, "session-revoked", "failure", correlationId);
        return reject("ADMIN_SESSION_REVOKED", "Admin session is invalid.");
      }
      if (Date.parse(session.expiresAt) <= now().getTime()) {
        await audit(session, "session-expired", "failure", correlationId);
        return reject("ADMIN_SESSION_EXPIRED", "Admin session expired.");
      }
      const user = await options.repositories.users.getById(session.adminUserId);
      if (!user || user.status !== "active" || user.passwordVersion !== session.passwordVersion) {
        await options.repositories.sessions.revokeSession(session.adminSessionId, now().toISOString());
        await audit(session, "session-revoked", "failure", correlationId);
        return reject("ADMIN_SESSION_REVOKED", "Admin session is invalid.");
      }
      const lastSeenAt = now().toISOString();
      session.lastSeenAt = lastSeenAt;
      await options.repositories.sessions.touchSession(session.adminSessionId, lastSeenAt);
      return { accepted: true as const, session: toView(session), storedSession: session, errors: [] as [] };
    },
    logout: async (session: AdminStoredSession, correlationId: string) => {
      await options.repositories.sessions.revokeSession(session.adminSessionId, now().toISOString());
      await audit(session, "logout", "success", correlationId);
    },
    auditAccess: (session: AdminSessionView, action: AdminAuditAction, correlationId: string, target: string | null = null) =>
      audit(session, action, "success", correlationId, target)
  };

  async function audit(session: Pick<AdminSessionView, "adminSessionId" | "actorId" | "role"> | null,
    action: AdminAuditAction, result: AdminAuditEntryView["result"], correlationId: string, target: string | null = null): Promise<void> {
    await options.repositories.audit.append({
      id: `admin-audit:${randomToken()}`,
      adminSessionId: session?.adminSessionId ?? null,
      actorId: session?.actorId ?? null,
      role: session?.role ?? null,
      action,
      targetInstanceId: target,
      result,
      createdAt: now().toISOString(),
      correlationId
    });
  }
};

const createUnavailableUser = async (): Promise<AdminUserRecord> => {
  const now = new Date(0).toISOString();
  const password = await hashAdminPassword(randomToken() + randomToken());
  return {
    adminUserId: "unavailable", username: "unavailable", normalizedUsername: "unavailable", ...password,
    passwordVersion: 1, role: "viewer", status: "disabled", displayName: "Unavailable",
    createdAt: now, updatedAt: now, lastLoginAt: null, passwordChangedAt: now, version: 1
  };
};
const resolveFingerprintSecret = (environment: Record<string, string | undefined>): string | null => {
  const configured = String(environment.EMPIRE_ADMIN_FINGERPRINT_SECRET ?? "").trim();
  if (configured.length >= 32) return configured;
  return environment.NODE_ENV === "production" ? null : "local-admin-fingerprint-key-not-for-production";
};
const toView = ({ tokenHash: _tokenHash, passwordVersion: _passwordVersion, ...session }: AdminStoredSession): AdminSessionView => session;
const reject = (code: string, message: string) => ({ accepted: false as const, session: null, errors: [{ code, message } satisfies AdminApiErrorView] });
const hashToken = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const scopeHash = (value: string, secret: string): string => crypto.createHmac("sha256", secret).update(value).digest("base64url");
const randomToken = (): string => crypto.randomBytes(32).toString("base64url");
