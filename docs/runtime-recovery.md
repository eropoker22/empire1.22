# Runtime Recovery

Command recovery is handled by `recoverPendingCommandReservations()`.

The recovery pass scans pending command reservations for an instance when the repository supports `listPendingByInstance()`. For each old pending command:

- If a command result exists, the reservation is completed to `applied` or `rejected` using the stored result.
- If no result exists, the command is marked rejected with `server.command_abandoned_after_crash`.
- Recovery creates a deterministic command result so future retries replay the same response.

Recovery never applies an unknown pending command from scratch unless a future durable command payload replay path is explicitly designed. This avoids double-applying commands after an unknown crash point.

Outbox recovery is separate: unpublished outbox records remain durable and can be republished by calling `publishOutbox(runtime)`.

