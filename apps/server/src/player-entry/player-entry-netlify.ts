import type { ConfirmSpawnDistrictRequest, FinalizeServerSetupRequest } from "@empire/shared-types";
import { validateStateChangingOrigin } from "../netlify/csrf-origin-guard";
import { createJsonResponse, type NetlifyFunctionResponse } from "../netlify/netlify-json-response";
import { createPostgresDatabase } from "../runtime/persistence/postgres";
import type { GameplaySessionService } from "../auth/gameplay-session-service";
import { clearPlayerAccountCookie, createPlayerAccountCookie, readPlayerAccountCookie } from "./player-account-cookie";
import { resolveAccountRegistrationPolicy } from "./account-registration-policy";
import { validateAccountRegistrationRequest } from "./account-registration-request";
import {
  createPostgresAuthThrottle,
  resolveAuthNetworkIdentifier,
  type AuthThrottleAction,
  type AuthThrottleService
} from "./postgres-auth-throttle";
import {
  createPostgresPlayerEntryRepository,
  entryError,
  entryErrorCode,
  publicAccount,
  type PostgresPlayerEntryRepository
} from "./postgres-player-entry-repository";
export interface PlayerEntryRequest {
  httpMethod: string;
  path: string;
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
export const createPlayerEntryNetlifyBoundary = (options: {
  environment: Record<string, string | undefined>;
  repository?: PostgresPlayerEntryRepository;
  gameplaySessionService: GameplaySessionService;
  authThrottle?: AuthThrottleService;
}) => {
  const repository = options.repository ?? resolveRepository(options.environment);
  const authThrottle = options.authThrottle ?? resolveAuthThrottle(repository, options.environment);
  return async (request: PlayerEntryRequest): Promise<NetlifyFunctionResponse | null> => {
    const route = resolveRoute(request.path);
    if (!route) return null;
    const method = request.httpMethod.toUpperCase();
    if (method === "OPTIONS") return createJsonResponse(204, null);
    const persistenceReady = Boolean(repository && await repository.isSchemaCurrent().catch(() => false));
    const authSecurityReady = options.environment.NODE_ENV !== "production" || Boolean(authThrottle);
    if (route.kind === "registration-policy" && method === "GET") {
      return success(200, resolveAccountRegistrationPolicy(options.environment, persistenceReady && authSecurityReady));
    }
    if (!repository || !persistenceReady) return error(503, "PLAYER_ENTRY_UNAVAILABLE", "Player entry databáze není dostupná.");
    try {
      if (route.kind === "register" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        if (!resolveAccountRegistrationPolicy(options.environment, persistenceReady && authSecurityReady).registrationEnabled) {
          return error(403, "ACCOUNT_REGISTRATION_CLOSED", "Registrace je momentálně uzavřená.");
        }
        const body = validateAccountRegistrationRequest(request.body);
        const throttleError = await consumeAuthThrottle(authThrottle, "register", body.username, request.headers);
        if (throttleError) return throttleError;
        const created = await repository.registerAccount(body);
        return success(201, publicAccount(created.session), { "set-cookie": createPlayerAccountCookie(created.token, created.session.expiresAt, options.environment) });
      }
      if (route.kind === "session" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        const body = record(request.body) ? request.body : {};
        const throttleError = await consumeAuthThrottle(authThrottle, "login", body.username, request.headers);
        if (throttleError) return throttleError;
        const login = await repository.login({ username: String(body.username ?? ""), password: String(body.password ?? "") });
        return success(200, publicAccount(login.session), { "set-cookie": createPlayerAccountCookie(login.token, login.session.expiresAt, options.environment) });
      }
      const token = readPlayerAccountCookie(request.headers) ?? "";
      const account = await repository.authenticate(token);
      if (!account) return error(401, "ACCOUNT_SESSION_REQUIRED", "Přihlášení je vyžadováno.", {
        "set-cookie": clearPlayerAccountCookie(options.environment)
      });
      if (route.kind === "session" && method === "GET") return success(200, publicAccount(account));
      if (route.kind === "session" && method === "DELETE") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        if (options.environment.NODE_ENV === "production" && !options.gameplaySessionService.productionReady) {
          return error(503, "PLAYER_ENTRY_UNAVAILABLE", "Player entry operace se nezdařila.");
        }
        const revokedAt = new Date().toISOString();
        await options.gameplaySessionService.revokeAccountSessions(account.accountId, revokedAt);
        await repository.revokeSession(token);
        return success(200, null, { "set-cookie": clearPlayerAccountCookie(options.environment) });
      }
      if (route.kind === "overview" && method === "GET") return success(200, await repository.getOverview(account));
      if (route.kind === "results" && method === "GET") {
        const results = await repository.getMatchResults(account.accountId, route.serverInstanceId);
        return results
          ? success(200, results)
          : error(404, "MATCH_RESULTS_NOT_FOUND", "Výsledky tohoto serveru nejsou dostupné.");
      }
      if (route.kind === "spawn" && method === "GET") return success(200, await repository.getSpawnSelection(account.accountId, route.serverInstanceId));
      if (route.kind === "confirm-spawn" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        const body = validateConfirmSpawn(request.body);
        return success(201, await repository.confirmSpawnDistrict(account.accountId, body, header(request.headers, "idempotency-key")));
      }
      if (route.kind === "setup" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        const body = validateFinalizeSetup(request.body);
        return success(202, await repository.finalizeSetup(account.accountId, body,
          header(request.headers, "idempotency-key")));
      }
      if (route.kind === "membership" && method === "GET") {
        const membership = await repository.getMembership(route.membershipId);
        if (!membership || membership.accountId !== account.accountId) return error(404, "MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
        return success(200, await repository.getMembershipView(route.membershipId));
      }
      if (route.kind === "join-ticket" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        const membership = await repository.getMembership(route.membershipId);
        if (!membership || membership.accountId !== account.accountId) return error(404, "MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
        if (membership.status !== "active" || !membership.factionId || !options.gameplaySessionService.productionReady) {
          return error(409, "MEMBERSHIP_NOT_ACTIVE", "Aktivní serverová identita zatím není připravená.");
        }
        const at = new Date().toISOString();
        await options.gameplaySessionService.getOrCreateRegistration({ accountId: account.accountId,
          serverInstanceId: membership.serverInstanceId, nowIso: at });
        const ticket = await options.gameplaySessionService.createJoinTicket({ accountId: account.accountId,
          serverInstanceId: membership.serverInstanceId, mode: membership.serverMode, factionId: membership.factionId, nowIso: at });
        const view = await repository.getMembershipView(route.membershipId);
        if (!view) return error(404, "MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
        return success(201, { ...view, joinTicket: ticket.ticketId });
      }
      if (route.kind === "leave" && method === "POST") {
        const originError = stateChangeError(request, options.environment);
        if (originError) return originError;
        return success(202, await repository.requestEarlyLeave(account.accountId, route.membershipId));
      }
      return error(405, "PLAYER_ENTRY_METHOD_NOT_ALLOWED", "Metoda není pro tuto route povolena.");
    } catch (caught) {
      const code = entryErrorCode(caught);
      const status = code === "PLAYER_ENTRY_UNAVAILABLE" ? 503 : code.includes("NOT_FOUND") ? 404
        : code.includes("CONFLICT") || code.includes("EXISTS") || code.includes("STALE") || code.includes("RESERVED") ? 409
          : code.includes("FULL") ? 409 : code.includes("LOGIN") || code.includes("SESSION") ? 401 : 400;
      const message = code === "PLAYER_ENTRY_UNAVAILABLE"
        ? "Player entry operace se nezdařila."
        : caught instanceof Error ? caught.message : "Player entry operace se nezdařila.";
      return error(status, code, message);
    }
  };
};

const resolveRepository = (environment: Record<string, string | undefined>) => {
  const driver = String(environment.EMPIRE_PERSISTENCE_DRIVER ?? environment.GAMEPLAY_PERSISTENCE_DRIVER ?? "").trim().toLowerCase();
  const databaseUrl = String(environment.EMPIRE_DATABASE_URL ?? environment.GAMEPLAY_DATABASE_URL ?? "").trim();
  return driver === "postgres" && databaseUrl ? createPostgresPlayerEntryRepository(createPostgresDatabase(databaseUrl)) : null;
};

const resolveAuthThrottle = (
  repository: PostgresPlayerEntryRepository | null,
  environment: Record<string, string | undefined>
): AuthThrottleService | null => {
  if (!repository?.database) return null;
  try {
    return createPostgresAuthThrottle(repository.database, environment);
  } catch (_error) {
    return null;
  }
};

const consumeAuthThrottle = async (
  service: AuthThrottleService | null,
  action: AuthThrottleAction,
  username: unknown,
  headers: PlayerEntryRequest["headers"]
): Promise<NetlifyFunctionResponse | null> => {
  if (!service) return error(503, "ACCOUNT_AUTH_THROTTLE_UNAVAILABLE", "Přihlášení je dočasně nedostupné.");
  const decision = await service.consume({
    action,
    username: String(username ?? ""),
    networkIdentifier: resolveAuthNetworkIdentifier(headers)
  });
  return decision.allowed ? null : error(
    429,
    "ACCOUNT_RATE_LIMITED",
    "Příliš mnoho pokusů. Zkus to znovu později.",
    { "retry-after": String(decision.retryAfterSeconds) }
  );
};

const resolveRoute = (path: string): Route | null => {
  const parts = String(path).split("?")[0]!.split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "account" && parts[2] === "register" && parts.length === 3) return { kind: "register" };
  if (parts[0] === "api" && parts[1] === "account" && parts[2] === "session" && parts.length === 3) return { kind: "session" };
  if (parts[0] === "api" && parts[1] === "account" && parts[2] === "registration-policy" && parts.length === 3) return { kind: "registration-policy" };
  if (parts[0] !== "api" || parts[1] !== "lobby") return null;
  if (parts[2] === "overview" && parts.length === 3) return { kind: "overview" };
  if (parts[2] === "spawn-confirm" && parts.length === 3) return { kind: "confirm-spawn" };
  if (parts[2] === "setup" && parts[3] === "finalize" && parts.length === 4) return { kind: "setup" };
  if (parts[2] === "servers" && parts[4] === "results" && parts.length === 5) return { kind: "results", serverInstanceId: decodeURIComponent(parts[3]!) };
  if (parts[2] === "servers" && parts[4] === "spawn-districts" && parts.length === 5) return { kind: "spawn", serverInstanceId: decodeURIComponent(parts[3]!) };
  if (parts[2] === "memberships" && parts.length === 4) return { kind: "membership", membershipId: decodeURIComponent(parts[3]!) };
  if (parts[2] === "memberships" && parts[4] === "join-ticket" && parts.length === 5) return { kind: "join-ticket", membershipId: decodeURIComponent(parts[3]!) };
  if (parts[2] === "memberships" && parts[4] === "leave" && parts.length === 5) return { kind: "leave", membershipId: decodeURIComponent(parts[3]!) };
  return null;
};

const stateChangeError = (request: PlayerEntryRequest, environment: Record<string, string | undefined>) => {
  if (!header(request.headers, "content-type").toLowerCase().startsWith("application/json")) {
    return error(415, "PLAYER_ENTRY_JSON_REQUIRED", "Požadavek musí používat JSON.");
  }
  const invalidOrigin = validateStateChangingOrigin(request.headers, environment);
  return invalidOrigin ? error(403, invalidOrigin.code, invalidOrigin.message) : null;
};

const success = <T>(status: number, data: T, headers: Record<string, string> = {}) =>
  createJsonResponse(status, { accepted: true, data, errors: [] }, { "cache-control": "no-store", ...headers });
const error = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  createJsonResponse(status, { accepted: false, data: null, errors: [{ code, message }] }, { "cache-control": "no-store", ...headers });
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validateConfirmSpawn = (value: unknown): ConfirmSpawnDistrictRequest => {
  if (!record(value) || !onlyKeys(value, ["serverInstanceId", "districtId", "expectedAvailabilityRevision"])) {
    throw entryError("PLAYER_ENTRY_PAYLOAD_INVALID", "Potvrzení districtu obsahuje nepovolená pole.");
  }
  const serverInstanceId = safeIdentifier(value.serverInstanceId, "SERVER_ID_INVALID");
  const districtId = safeIdentifier(value.districtId, "DISTRICT_ID_INVALID");
  const expectedAvailabilityRevision = String(value.expectedAvailabilityRevision ?? "");
  if (!/^[a-f0-9]{64}$/u.test(expectedAvailabilityRevision)) throw entryError("SPAWN_REVISION_INVALID", "Revision nabídky districtů není platná.");
  return { serverInstanceId, districtId, expectedAvailabilityRevision };
};
const validateFinalizeSetup = (value: unknown): FinalizeServerSetupRequest => {
  if (!record(value) || !onlyKeys(value, ["membershipId", "factionId", "avatarId", "gangColor"])) {
    throw entryError("PLAYER_ENTRY_PAYLOAD_INVALID", "Server setup obsahuje nepovolená pole.");
  }
  return {
    membershipId: safeIdentifier(value.membershipId, "MEMBERSHIP_ID_INVALID"),
    factionId: safeIdentifier(value.factionId, "FACTION_ID_INVALID"),
    avatarId: safeIdentifier(value.avatarId, "AVATAR_ID_INVALID"),
    gangColor: String(value.gangColor ?? "")
  };
};
const safeIdentifier = (value: unknown, code: string) => {
  const identifier = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,200}$/u.test(identifier)) throw entryError(code, "Identifikátor není platný.");
  return identifier;
};
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const header = (headers: PlayerEntryRequest["headers"], name: string) => {
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
  return (Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")).trim();
};
type Route = { kind: "register" | "session" | "registration-policy" | "overview" | "confirm-spawn" | "setup" }
  | { kind: "spawn" | "results"; serverInstanceId: string }
  | { kind: "membership" | "join-ticket" | "leave"; membershipId: string };
