# Empire Streets

Project skeleton for a multiplayer browser strategy game with strict separation between UI, server runtime, shared contracts, game core, mode config, admin, and tooling.

## Structure

- `apps/client` - player-facing browser client
- `apps/admin` - admin dashboard shell
- `apps/server` - authoritative runtime and transport layer
- `packages/shared-types` - client/server contracts and shared primitive types
- `packages/game-core` - pure game rules and simulation logic
- `packages/game-config` - mode presets and content registries
- `tools/debug` - isolated debug tooling
- `tools/seed` - isolated seed/bootstrap tooling
- `docs/architecture` - architectural decisions and boundaries

## Rules

- No game logic in UI
- Server is the source of truth
- Free and war modes share one core and diverge through config
- Legacy `START` is an internal dev/setup sandbox only, not a production game phase
- Debug/demo tooling stays outside production runtime
- Keep modules small and feature boundaries explicit

## Compatibility

- `packages/shared` and `packages/debug-tools` remain only as deprecated compatibility placeholders.
- Canonical shared contracts live in `packages/shared-types`.
- Canonical tooling packages live in `tools/debug` and `tools/seed`.
