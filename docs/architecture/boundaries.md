# Boundaries

## Allowed dependencies

- `apps/client` -> `packages/shared-types`
- `apps/admin` -> `packages/shared-types`
- `apps/server` -> `packages/shared-types`, `packages/game-core`, `packages/game-config`
- `packages/game-config` -> `packages/game-core`, `packages/shared-types`
- `tools/debug` -> `packages/game-core`, `packages/game-config`, `packages/shared-types`
- `tools/seed` -> `packages/game-core`, `packages/game-config`, `packages/shared-types`

## Forbidden dependencies

- `apps/client` -> `apps/server`
- `apps/client` -> `packages/game-core`
- `apps/admin` -> database or game core internals without server APIs
- `packages/shared-types` -> framework, transport, persistence, or UI code
- `packages/game-core` -> HTTP, WebSocket, DB, DOM, React, or admin tooling
- `packages/game-config` -> runtime server state or UI

## UI exclusions

The UI must not contain:

- combat resolution
- economy or upkeep calculation
- legality checks for commands as authoritative logic
- tick advancement
- police or heat resolution
- mode-specific rule branches beyond presentation-only text

The UI may contain:

- local form state
- presentation-only derived values
- pending/loading states
- optimistic hints that are overwritten by server truth

## Source of truth

- Game truth: `apps/server`
- Game rules: `packages/game-core`
- Mode rules and balancing: `packages/game-config`
- Contracts: `packages/shared-types`
- UI state: `apps/client` local presentation state only
