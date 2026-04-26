# Server Runtime

## Intent

The server layer is the authoritative runtime for all Empire Streets instances.

- each instance is isolated
- config is resolved once at instance creation
- transport delegates commands into runtime boundaries
- gameplay rules stay in `packages/game-core`

## Layers

- `app/` composition root
- `runtime/instance/` isolated runtime containers
- `runtime/orchestration/` cross-instance coordination
- `runtime/snapshots/` persistence boundaries
- `runtime/monitoring/` admin-facing health and telemetry
- `transport/` ingress and live-update edges

## Rules

- no gameplay logic in transport
- no shared mutable state across instances
- no direct admin mutation of game state outside instance operations
- tick orchestration stays outside UI and outside websocket code
