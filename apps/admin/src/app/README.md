# Admin App

Admin-only operations shell.

- Uses explicit admin transport contracts
- Does not bypass server authorization paths
- Reads admin projections instead of raw DB state
- Avoids direct imports from game core internals
- Queues lifecycle actions through the hosted control plane
- Keeps monitoring, alerts, audit, logs, snapshots, diagnostics, and commands as separate modules
- Preserves the last confirmed read model during transient refresh failures
- Cleans polling, countdowns, requests, and listeners on page lifecycle teardown
