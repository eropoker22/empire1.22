# Admin App

Admin-only application shell.

- Uses explicit admin transport contracts
- Does not bypass server authorization paths
- Reads admin projections instead of raw DB state
- Avoids direct imports from game core internals
- Keeps monitoring, logs, snapshots, diagnostics, and commands as separate modules
