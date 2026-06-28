# Gameplay Session Security

Gameplay sessions authorize `load`, `resume`, `submit` and `logout`.

Production gameplay sessions are stored as an HttpOnly cookie. Browser JavaScript does not read the gameplay session token, does not copy it into request bodies, and does not persist it in `localStorage`, `sessionStorage`, URLs, DOM datasets or read-models.

The current cookie name is `empire_gameplay_session`. It intentionally does not use the `__Host-` prefix because the cookie is scoped to `Path=/api/gameplay-slice`; `__Host-` would require `Path=/`. Production cookies use `HttpOnly; Secure; SameSite=Lax; Path=/api/gameplay-slice` plus `Max-Age` and `Expires`. Dev/test omit `Secure` so localhost flows work.

## Session Model

A session contains:

- `sessionId`
- `registrationId`
- `accountId`
- `playerId`
- `serverInstanceId`
- `createdAt`
- `expiresAt`
- `lastSeenAt`
- `revokedAt`
- `version`

The signed transport token includes `sessionId`, but it is not sufficient by itself. The server validates the `sessionId` against the session repository and checks expiration, revocation and server instance.

`GameplaySessionService` is async. Production uses `createPersistentGameplaySessionService(...)` with the Postgres `GameplayIdentitySessionRepository`; dev/test use the in-memory implementation only outside production. `createServerApp` wires the Postgres-backed service when `NODE_ENV=production` and `EMPIRE_DATABASE_URL` or `GAMEPLAY_DATABASE_URL` is present. Without that repository, production uses an unavailable service and the Netlify production guard rejects gameplay session traffic.

The response field `sessionToken` remains in the shared type as a deprecated dev/test compatibility field. Production join/load/submit responses must not expose the gameplay session token in the JSON body.

## Join Tickets And Registrations

Join tickets are persistent in production and contain `ticketId`, `accountId`, `serverInstanceId`, `mode`, optional `factionId`, `issuedAt`, `expiresAt`, `consumedAt` and `nonce`.

Consuming a join ticket validates account, server instance, expiration and one-time use, then atomically marks the ticket consumed and gets or creates the player registration. The registration invariant remains one `playerId` per `accountId` and `serverInstanceId`.

## Load And Submit

`load` ignores client identity claims. `LoadGameplaySliceRequest.playerId` is a deprecated compatibility hint and may be omitted. Production reads the session token from the HttpOnly cookie only; body `sessionToken` is ignored. The server derives `playerId` from the gameplay session and returns only that player's read-model.

`submit` requires a valid gameplay session. Production reads the session from the cookie, not the body. If a command still contains `playerId` for compatibility, it must exactly match the session. Forged command identity is rejected with `PLAYER_IDENTITY_MISMATCH`.

Snapshot tokens are recovery tokens for instance state only. A snapshot token cannot create a gameplay session, authorize a command or load a private read-model.

## Logout And Revocation

Logout reads the HttpOnly cookie, revokes the session, and returns a matching clear cookie. Revoked sessions fail future load and submit requests with `SESSION_REVOKED`.

Admin revocation should use the same repository path and revoke all sessions by player or account without deleting player registration or game state.

## Fail Closed

Production must reject gameplay session traffic when any of these are missing:

- gameplay session secret
- account identity provider
- persistent gameplay session repository
- player registration repository

There is no production fallback that trusts `playerId`, `accountId`, localStorage, names, email or snapshot token.

## CSRF Baseline

Cookie-backed state-changing routes use an Origin allowlist in production. `join`, `logout`, `submit` and matchmaking reservation reject missing or unapproved `Origin` headers with `CSRF_ORIGIN_REQUIRED` or `CSRF_ORIGIN_INVALID`. Allowed production origins come from `EMPIRE_ALLOWED_ORIGINS`.

This is the current minimum CSRF baseline. A full CSRF token or double-submit strategy can be added later if deployment topology requires cross-site API calls.

The Postgres schema for `empire_player_registrations`, `empire_join_tickets` and `empire_gameplay_sessions` exists in `003_gameplay_identity_sessions.sql`, with stricter production identity invariants in `005_gameplay_identity_session_invariants.sql`.

`GameplayIdentitySessionRepository` is the persistent repository contract for player registrations, join tickets and gameplay sessions. The Postgres repository lives in `postgres-gameplay-identity-session-repository.ts`, and the async production service is wired on top of it. The default in-memory service is for dev/test only.
