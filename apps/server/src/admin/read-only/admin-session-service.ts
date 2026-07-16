import * as crypto from "node:crypto";
import type { AdminApiErrorView, AdminAuditAction, AdminAuditEntryView, AdminSessionView } from "@empire/shared-types";
import type { AdminDurableRepositories, AdminStoredSession } from "./admin-repositories";
import { createEnvironmentAdminIdentityProvider, type AdminIdentityProvider } from "./admin-identity-provider";

const SESSION_TTL_MS = 30 * 60 * 1000;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;

export const createAdminSessionService = (options: {
  repositories: AdminDurableRepositories;
  environment: Record<string, string | undefined>;
  identityProvider?: AdminIdentityProvider;
  now?: () => Date;
}) => {
  const now = options.now ?? (() => new Date());
  const config = (options.identityProvider ?? createEnvironmentAdminIdentityProvider(options.environment)).getBootstrapConfiguration();
  return {
    configurationReady: config !== null,
    login: async (input: { secret: string; fingerprint: string; correlationId: string }) => {
      if (!config) {
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_AUTH_CONFIGURATION_UNAVAILABLE", "Admin authentication is unavailable.");
      }
      const createdAt = now().toISOString();
      const fingerprintHash = fingerprint(input.fingerprint, config.fingerprintSecret);
      const actorHash = fingerprint(config.identity.actorId, config.fingerprintSecret);
      const since = new Date(now().getTime() - FAILURE_WINDOW_MS).toISOString();
      const [fingerprintFailures, actorFailures] = await Promise.all([
        options.repositories.loginRateLimit.countRecentFailures(fingerprintHash, since),
        options.repositories.loginRateLimit.countRecentFailures(actorHash, since)
      ]);
      if (fingerprintFailures >= MAX_FAILURES || actorFailures >= MAX_FAILURES) {
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_LOGIN_RATE_LIMITED", "Admin authentication is unavailable.");
      }
      if (!timingSafeEqual(input.secret, config.secret)) {
        await options.repositories.loginRateLimit.recordFailure({ id: `admin-login-failure:${randomToken()}`, fingerprintHash, actorHash, createdAt });
        await audit(null, "login-failure", "failure", input.correlationId);
        return reject("ADMIN_AUTH_INVALID", "Admin authentication is unavailable.");
      }
      const token = randomToken();
      const session: AdminStoredSession = {
        adminSessionId: `admin-session:${randomToken()}`,
        tokenHash: hashToken(token),
        ...config.identity,
        createdAt,
        expiresAt: new Date(now().getTime() + SESSION_TTL_MS).toISOString(),
        revokedAt: null
      };
      await options.repositories.sessions.createSession(session);
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

const toView = ({ tokenHash: _tokenHash, ...session }: AdminStoredSession): AdminSessionView => session;
const reject = (code: string, message: string) => ({ accepted: false as const, session: null, errors: [{ code, message } satisfies AdminApiErrorView] });
const hashToken = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const fingerprint = (value: string, secret: string): string => crypto.createHmac("sha256", secret).update(value).digest("base64url");
const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.webcrypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};
const timingSafeEqual = (left: string, right: string): boolean => {
  const a = new TextEncoder().encode(hashToken(left));
  const b = new TextEncoder().encode(hashToken(right));
  return crypto.timingSafeEqual(a, b);
};
const toBase64Url = (bytes: Uint8Array): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const triplet = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    output += alphabet[(triplet >> 18) & 63] + alphabet[(triplet >> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(triplet >> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[triplet & 63];
  }
  return output;
};
