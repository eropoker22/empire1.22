# Runtime Persistence

The server runtime supports two persistence drivers:

- `memory` (default): in-process repositories for tests and local iteration.
- `file`: local durable repositories for command log, event log, diagnostic log, and snapshots.

Enable file persistence with environment variables:

```powershell
$env:EMPIRE_PERSISTENCE_DRIVER = "file"
$env:EMPIRE_PERSISTENCE_DIR = ".empire-persistence"
npm run dev:runtime
```

`GAMEPLAY_PERSISTENCE_DRIVER` and `GAMEPLAY_PERSISTENCE_DIR` are accepted as compatibility aliases.

## File Format

File persistence writes readable, versioned records:

- `instances/<instance-id>/commands.ndjson`
- `instances/<instance-id>/events.ndjson`
- `instances/<instance-id>/diagnostics.ndjson`
- `instances/<instance-id>/snapshots/latest.json`
- `instances/<instance-id>/snapshots/<snapshot-id>.json`

Log files use newline-delimited JSON envelopes:

```json
{ "schemaVersion": 1, "record": { "...": "..." } }
```

Snapshots use the same envelope shape and include the versioned snapshot DTO.

## Dev Guidance

Use `memory` for unit tests and short-lived local runs. Use `file` when validating process restarts, snapshot restore, or local multiplayer flows where requests may land in separate function invocations.

## Production Gaps

The file driver is a local durability bridge, not a production cluster store. It has an optimistic snapshot guard based on `integrity.rootVersion` to prevent stale snapshot overwrites, but it does not provide distributed locks, transactional command/event writes, cross-host replication, or indexed queries. A production Postgres/Supabase adapter should implement the same repository interfaces with transactional append and snapshot compare-and-swap semantics.
