import * as crypto from "node:crypto";
import type { DomainError, GameModeId, PlayerFactionId, ServerInstanceId } from "@empire/shared-types";

export interface AccountIdentity {
  accountId: string;
  provider: "dev" | "production";
}

export interface AccountIdentityProvider {
  readonly productionReady: boolean;
  resolve(input: { headers?: Record<string, string | string[] | undefined>; body?: unknown }): AccountIdentity | null | Promise<AccountIdentity | null>;
}

export interface PlayerRegistrationRecord {
  id: string;
  accountId: string;
  serverInstanceId: ServerInstanceId;
  playerId: string;
  status: "active" | "revoked";
  createdAt: string;
  version: number;
}

export interface JoinTicketRecord {
  ticketId: string;
  accountId: string;
  serverInstanceId: ServerInstanceId;
  mode: GameModeId;
  factionId?: PlayerFactionId | string | null;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  nonce: string;
}

export interface GameplaySessionRecord {
  sessionId: string;
  registrationId: string;
  accountId: string;
  playerId: string;
  serverInstanceId: ServerInstanceId;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  version: number;
}

export interface GameplaySessionService {
  readonly productionReady: boolean;
  createJoinTicket(input: {
    ticketId?: string;
    accountId: string;
    serverInstanceId: ServerInstanceId;
    mode: GameModeId;
    factionId?: PlayerFactionId | string | null;
    nowIso: string;
  }): Promise<JoinTicketRecord>;
  getOrCreateRegistration(input: {
    accountId: string;
    serverInstanceId: ServerInstanceId;
    nowIso: string;
  }): Promise<PlayerRegistrationRecord>;
  consumeJoinTicket(input: {
    ticketId: string;
    accountId: string;
    serverInstanceId: ServerInstanceId;
    nowIso: string;
  }): Promise<{ accepted: true; ticket: JoinTicketRecord; registration: PlayerRegistrationRecord } | { accepted: false; errors: DomainError[] }>;
  createSession(input: { registration: PlayerRegistrationRecord; nowIso: string; ttlMs: number }): Promise<GameplaySessionRecord>;
  validateSession(input: {
    sessionId: string | null | undefined;
    accountId?: string | null;
    serverInstanceId?: string | null;
    nowIso: string;
  }): Promise<{ accepted: true; session: GameplaySessionRecord } | { accepted: false; errors: DomainError[] }>;
  revokeSession(sessionId: string, nowIso: string): Promise<boolean>;
  revokePlayerSessions(playerId: string, nowIso: string): Promise<number>;
  listRegistrations(): Promise<PlayerRegistrationRecord[]>;
}

export interface GameplayIdentitySessionRepository {
  createJoinTicket(input: JoinTicketRecord): Promise<JoinTicketRecord>;
  consumeJoinTicket(input: {
    ticketId: string;
    accountId: string;
    serverInstanceId: ServerInstanceId;
    consumedAt: string;
  }): Promise<{ ticket: JoinTicketRecord; registration: PlayerRegistrationRecord } | null>;
  getOrCreateRegistration(input: {
    accountId: string;
    serverInstanceId: ServerInstanceId;
    nowIso: string;
  }): Promise<PlayerRegistrationRecord>;
  createSession(input: GameplaySessionRecord): Promise<GameplaySessionRecord>;
  getSessionById(sessionId: string): Promise<GameplaySessionRecord | null>;
  touchSession(sessionId: string, lastSeenAt: string): Promise<GameplaySessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: string): Promise<boolean>;
  revokePlayerSessions(playerId: string, revokedAt: string): Promise<number>;
  listRegistrations(): Promise<PlayerRegistrationRecord[]>;
}

export const createDevAccountIdentityProvider = (
  options: { allow: boolean }
): AccountIdentityProvider => ({
  productionReady: false,
  resolve: ({ headers, body }) => {
    if (!options.allow) return null;
    const headerAccount = normalizeHeader(headers?.["x-empire-account-id"]);
    const bodyAccount = isRecord(body) ? normalizeText(body.accountId) : "";
    const legacyDevPlayer = isRecord(body) ? normalizeText(body.playerId) : "";
    const accountId = headerAccount || bodyAccount || legacyDevPlayer;
    return accountId ? { accountId: `dev:${accountId}`, provider: "dev" } : null;
  }
});

export const createUnavailableAccountIdentityProvider = (): AccountIdentityProvider => ({
  productionReady: false,
  resolve: () => null
});

export const createUnavailableGameplaySessionService = (): GameplaySessionService => ({
  productionReady: false,
  createJoinTicket: async () => {
    throw new Error("Gameplay session repository is not configured.");
  },
  getOrCreateRegistration: async () => {
    throw new Error("Gameplay session repository is not configured.");
  },
  consumeJoinTicket: async () => reject("SESSION_INVALID", "Gameplay session repository is not configured."),
  createSession: async () => {
    throw new Error("Gameplay session repository is not configured.");
  },
  validateSession: async () => reject("SESSION_INVALID", "Gameplay session repository is not configured."),
  revokeSession: async () => false,
  revokePlayerSessions: async () => 0,
  listRegistrations: async () => []
});

export const createPersistentGameplaySessionService = (
  repository: GameplayIdentitySessionRepository,
  options: { ticketTtlMs?: number; productionReady?: boolean } = {}
): GameplaySessionService => {
  const ticketTtlMs = options.ticketTtlMs ?? 5 * 60 * 1000;

  return {
    productionReady: options.productionReady ?? true,
    createJoinTicket: async (input) => {
      const ticket: JoinTicketRecord = {
        ticketId: input.ticketId ?? `join:${randomToken()}`,
        accountId: input.accountId,
        serverInstanceId: input.serverInstanceId,
        mode: input.mode,
        factionId: input.factionId ?? null,
        issuedAt: input.nowIso,
        expiresAt: new Date(Date.parse(input.nowIso) + ticketTtlMs).toISOString(),
        consumedAt: null,
        nonce: randomToken()
      };
      return repository.createJoinTicket(ticket);
    },
    getOrCreateRegistration: (input) => repository.getOrCreateRegistration(input),
    consumeJoinTicket: async (input) => {
      const consumed = await repository.consumeJoinTicket({
        ticketId: input.ticketId,
        accountId: input.accountId,
        serverInstanceId: input.serverInstanceId,
        consumedAt: input.nowIso
      });
      if (!consumed) {
        return reject("JOIN_TICKET_INVALID", "Join ticket is invalid, expired, or already used.");
      }
      return {
        accepted: true,
        ticket: consumed.ticket,
        registration: consumed.registration
      };
    },
    createSession: async (input) => {
      const session: GameplaySessionRecord = {
        sessionId: `session:${randomToken()}`,
        registrationId: input.registration.id,
        accountId: input.registration.accountId,
        playerId: input.registration.playerId,
        serverInstanceId: input.registration.serverInstanceId,
        createdAt: input.nowIso,
        expiresAt: new Date(Date.parse(input.nowIso) + input.ttlMs).toISOString(),
        lastSeenAt: input.nowIso,
        revokedAt: null,
        version: 1
      };
      return repository.createSession(session);
    },
    validateSession: async (input) => {
      const sessionId = normalizeText(input.sessionId);
      if (!sessionId) return reject("SESSION_REQUIRED", "Gameplay session is required.");
      const session = await repository.getSessionById(sessionId);
      if (!session) return reject("SESSION_INVALID", "Gameplay session is invalid.");
      if (input.accountId && session.accountId !== input.accountId) {
        return reject("ACCOUNT_IDENTITY_MISMATCH", "Gameplay session account does not match authenticated account.");
      }
      if (input.serverInstanceId && session.serverInstanceId !== input.serverInstanceId) {
        return reject("SESSION_INSTANCE_MISMATCH", "Gameplay session server does not match request server.");
      }
      if (session.revokedAt) return reject("SESSION_REVOKED", "Gameplay session was revoked.");
      if (Date.parse(session.expiresAt) <= Date.parse(input.nowIso)) {
        return reject("SESSION_EXPIRED", "Gameplay session expired.");
      }
      const touched = await repository.touchSession(sessionId, input.nowIso);
      return touched
        ? { accepted: true, session: touched }
        : reject("SESSION_INVALID", "Gameplay session is invalid.");
    },
    revokeSession: (sessionId, nowIso) => repository.revokeSession(sessionId, nowIso),
    revokePlayerSessions: (playerId, nowIso) => repository.revokePlayerSessions(playerId, nowIso),
    listRegistrations: () => repository.listRegistrations()
  };
};

export const createInMemoryGameplaySessionService = (
  options: { productionReady?: boolean; ticketTtlMs?: number } = {}
): GameplaySessionService => {
  const ticketTtlMs = options.ticketTtlMs ?? 5 * 60 * 1000;
  const tickets = new Map<string, JoinTicketRecord>();
  const registrationsById = new Map<string, PlayerRegistrationRecord>();
  const registrationIdByAccountServer = new Map<string, string>();
  const sessionsById = new Map<string, GameplaySessionRecord>();

  return {
    productionReady: Boolean(options.productionReady),
    createJoinTicket: async (input) => {
      const ticket: JoinTicketRecord = {
        ticketId: input.ticketId ?? `join:${randomToken()}`,
        accountId: input.accountId,
        serverInstanceId: input.serverInstanceId,
        mode: input.mode,
        factionId: input.factionId ?? null,
        issuedAt: input.nowIso,
        expiresAt: new Date(Date.parse(input.nowIso) + ticketTtlMs).toISOString(),
        consumedAt: null,
        nonce: randomToken()
      };
      tickets.set(ticket.ticketId, ticket);
      return ticket;
    },
    getOrCreateRegistration: async (input) => getOrCreateRegistration(input),
    consumeJoinTicket: async (input) => {
      const ticket = tickets.get(input.ticketId);
      if (!ticket || ticket.accountId !== input.accountId || ticket.serverInstanceId !== input.serverInstanceId) {
        return reject("JOIN_TICKET_INVALID", "Join ticket is invalid.");
      }
      if (ticket.consumedAt) return reject("JOIN_TICKET_ALREADY_USED", "Join ticket was already used.");
      if (Date.parse(ticket.expiresAt) <= Date.parse(input.nowIso)) {
        return reject("JOIN_TICKET_EXPIRED", "Join ticket expired.");
      }
      ticket.consumedAt = input.nowIso;
      const registration = getOrCreateRegistration({
        accountId: input.accountId,
        serverInstanceId: input.serverInstanceId,
        nowIso: input.nowIso
      });
      return { accepted: true, ticket, registration };
    },
    createSession: async (input) => {
      const session: GameplaySessionRecord = {
        sessionId: `session:${randomToken()}`,
        registrationId: input.registration.id,
        accountId: input.registration.accountId,
        playerId: input.registration.playerId,
        serverInstanceId: input.registration.serverInstanceId,
        createdAt: input.nowIso,
        expiresAt: new Date(Date.parse(input.nowIso) + input.ttlMs).toISOString(),
        lastSeenAt: input.nowIso,
        revokedAt: null,
        version: 1
      };
      sessionsById.set(session.sessionId, session);
      return session;
    },
    validateSession: async (input) => {
      const sessionId = normalizeText(input.sessionId);
      if (!sessionId) return reject("SESSION_REQUIRED", "Gameplay session is required.");
      const session = sessionsById.get(sessionId);
      if (!session) return reject("SESSION_INVALID", "Gameplay session is invalid.");
      if (input.accountId && session.accountId !== input.accountId) {
        return reject("ACCOUNT_IDENTITY_MISMATCH", "Gameplay session account does not match authenticated account.");
      }
      if (input.serverInstanceId && session.serverInstanceId !== input.serverInstanceId) {
        return reject("SESSION_INSTANCE_MISMATCH", "Gameplay session server does not match request server.");
      }
      if (session.revokedAt) return reject("SESSION_REVOKED", "Gameplay session was revoked.");
      if (Date.parse(session.expiresAt) <= Date.parse(input.nowIso)) {
        return reject("SESSION_EXPIRED", "Gameplay session expired.");
      }
      session.lastSeenAt = input.nowIso;
      session.version += 1;
      return { accepted: true, session };
    },
    revokeSession: async (sessionId, nowIso) => {
      const session = sessionsById.get(sessionId);
      if (!session || session.revokedAt) return false;
      session.revokedAt = nowIso;
      session.version += 1;
      return true;
    },
    revokePlayerSessions: async (playerId, nowIso) => {
      let count = 0;
      for (const session of sessionsById.values()) {
        if (session.playerId === playerId && !session.revokedAt) {
          session.revokedAt = nowIso;
          session.version += 1;
          count += 1;
        }
      }
      return count;
    },
    listRegistrations: async () => [...registrationsById.values()]
  };

  function getOrCreateRegistration(input: { accountId: string; serverInstanceId: string; nowIso: string }): PlayerRegistrationRecord {
    const key = `${input.serverInstanceId}:${input.accountId}`;
    const existingId = registrationIdByAccountServer.get(key);
    if (existingId) return registrationsById.get(existingId)!;
    const registration: PlayerRegistrationRecord = {
      id: `registration:${randomToken()}`,
      accountId: input.accountId,
      serverInstanceId: input.serverInstanceId,
      playerId: createServerPlayerId(input.serverInstanceId, input.accountId),
      status: "active",
      createdAt: input.nowIso,
      version: 1
    };
    registrationsById.set(registration.id, registration);
    registrationIdByAccountServer.set(key, registration.id);
    return registration;
  }
};

const createServerPlayerId = (serverInstanceId: string, accountId: string): string =>
  `player:${crypto.createHash("sha256").update(`${serverInstanceId}:${accountId}`).digest("hex").slice(0, 24)}`;

const randomToken = (): string => {
  const buffer = new Uint8Array(32);
  (crypto as unknown as { randomFillSync(target: Uint8Array): Uint8Array }).randomFillSync(buffer);
  return toBase64Url(buffer);
};

const toBase64Url = (bytes: Uint8Array): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(triplet >> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[triplet & 63];
  }
  return output;
};

const reject = <T extends { accepted: false; errors: DomainError[] }>(
  code: string,
  message: string
): T => ({
  accepted: false,
  errors: [{ code, message }]
} as T);

const normalizeHeader = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? normalizeText(value[0]) : normalizeText(value);

const normalizeText = (value: unknown): string =>
  String(value ?? "").trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
