# Empire Streets Architecture Overview

## System shape

Empire Streets is structured as a layered monorepo:

1. `apps/server` is the authoritative runtime for all game instances.
2. `packages/game-core` contains pure domain rules and simulation.
3. `packages/game-config` composes mode-specific balance and content.
4. `packages/shared-types` defines transport contracts and shared primitives.
5. `apps/client` renders player state and dispatches commands.
6. `apps/admin` provides admin-only workflows over explicit server APIs.
7. `tools/debug` and `tools/seed` contain isolated dev/demo/scenario tooling.

## Runtime flow

1. Client sends a command.
2. Server authenticates and authorizes it.
3. Server passes the command and current instance state into `game-core`.
4. `game-core` resolves the outcome using the active mode config.
5. Server persists the new state and emits view projections.
6. Client re-renders from server-provided state.

## Hard rules

- UI never computes authoritative outcomes.
- Server-side state is the only game source of truth.
- `free` and `war` are built from the same core, composed through config.
- Debug/demo scenarios use separate tooling and entrypoints.
- Modules stay small; feature growth must follow explicit package boundaries.
