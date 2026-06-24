# Gameplay Session Security

Gameplay sessions authorize `load`, `resume`, `submit` and `logout`.

The preferred production storage is an HttpOnly, Secure, SameSite cookie scoped to gameplay APIs. The current browser compatibility bridge stores the signed gameplay session token in `sessionStorage`, never `localStorage`, URLs, DOM datasets or read-models.

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

## Load And Submit

`load` ignores client identity claims. `LoadGameplaySliceRequest.playerId` is a deprecated compatibility hint and may be omitted. The server derives `playerId` from the gameplay session and returns only that player's read-model.

`submit` requires a valid gameplay session. If a command still contains `playerId` for compatibility, it must exactly match the session. Forged command identity is rejected with `PLAYER_IDENTITY_MISMATCH`.

Snapshot tokens are recovery tokens for instance state only. A snapshot token cannot create a gameplay session, authorize a command or load a private read-model.

## Logout And Revocation

Logout revokes the session and clears the client-visible session token. Revoked sessions fail future load and submit requests with `SESSION_REVOKED`.

Admin revocation should use the same repository path and revoke all sessions by player or account without deleting player registration or game state.

## Fail Closed

Production must reject gameplay session traffic when any of these are missing:

- gameplay session secret
- account identity provider
- persistent gameplay session repository
- player registration repository

There is no production fallback that trusts `playerId`, `accountId`, localStorage, names, email or snapshot token.

The Postgres schema for `empire_player_registrations`, `empire_join_tickets` and `empire_gameplay_sessions` exists in `003_gameplay_identity_sessions.sql`. The current production guard still requires a production-ready session service before public traffic is accepted; the default in-memory service is for dev/test only.
