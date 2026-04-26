# Client App

Player-facing application shell.

- Renders server-provided view models
- Dispatches commands
- Holds only local UI state
- Must not import `game-core`
- Uses `shared-types` contracts only
- Keeps transport, map, notifications, reports, and debug as separate boundaries
