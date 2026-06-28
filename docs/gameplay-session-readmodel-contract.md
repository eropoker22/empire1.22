# Gameplay Session / Read Model Contract

This document captures the current server-authoritative contract for the public Free alpha flow.

## Principles

- Request `playerId` and `accountId` are hints only. They are never proof of identity.
- Gameplay `load` and `submit` authority comes from a validated gameplay session.
- Snapshot tokens restore instance state only. They do not authorize `load`, `join`, `submit`, or `logout`.
- Production fails closed without a production-ready identity provider, session repository, and configured secrets.
- Dev/test may use explicit dev identity helpers, but production must not fall back to implicit dev identity.

## `/api/gameplay-slice/load`

Expected input:

- `serverInstanceId`
- optional `districtId`
- a valid gameplay session token from the cookie, or from the request body only in non-production test/dev flows

Expected output on success:

- `accepted: true`
- `readModel` object
- `errors: []`
- response metadata with server tick/state version when available

Null read model policy:

- A successful load must return a read model object.
- A missing or invalid session must return an error response, not a successful null read model.
- `readModel: null` is only valid on rejected/error responses where the client cannot be authorized or the runtime cannot produce a safe authoritative state.

## `/api/gameplay-slice/join`

Expected input:

- `serverInstanceId`
- a valid matchmaking join ticket
- dev/test identity headers only in non-production flows

Expected output on success:

- gameplay session is created and sealed
- session token is returned in a cookie
- non-production test/dev responses may also include the token in body for local harnesses
- `readModel` object for the joined player

Join behavior:

- Join ticket proves a reserved slot, not long-term identity.
- After join, follow-up load/submit must use the gameplay session.

## `/api/gameplay-slice/submit`

Expected input:

- `serverInstanceId`
- `command`
- valid gameplay session token
- expected state/version metadata when available

Expected output on accepted command:

- `accepted: true`
- `readModel` object
- optional command/result metadata

Rejected command policy:

- Transport/session rejection returns `accepted: false` and no authoritative read model.
- Core command rejection can still persist a rejected command reservation and return the current authoritative read model when the session is valid.
- Duplicate same-payload replay of an already applied command returns the stored applied result as accepted/idempotent.
- Duplicate conflicting payload returns a conflict rejection.

## Session Token Behavior

- Browser transport stores the token returned by join/load when present.
- Fetch transport does not echo the session token in submit JSON when cookie transport is available.
- Test/dev in-memory transport may carry the token explicitly for local harnesses.
- Invalid sealed tokens map to `SESSION_INVALID`.
- Missing tokens map to `SESSION_REQUIRED`.
- Player identity mismatch maps to `PLAYER_IDENTITY_MISMATCH`.

## Dev / Local Behavior

- Tests should use shared helpers for dev identity/session setup instead of hand-built bodies.
- Dev helpers may create sessions with explicit account ids and non-production sealed tokens.
- Dev helpers must not imply production auth readiness.

## Production Behavior

- Production requires configured gameplay session secret and production-ready session repository.
- Production must reject implicit dev auth/session paths.
- Production load/submit without a valid gameplay session fails closed.

## Awaiting Spawn Selection

- A joined player may receive `readModel.spawnSelection.status === "awaiting_spawn_selection"`.
- The client should render spawn guidance and submit `select-spawn-district` through the normal server-authoritative command path.
- After accepted spawn selection, the read model must include `player.homeDistrictId`, and spawn selection should no longer block the normal district/action flow.

## Snapshot Token Behavior

- Snapshot tokens may help restore or validate instance state.
- Snapshot tokens must not authorize player load, command submit, join, or logout.
- Session authorization always comes from the gameplay session service.
