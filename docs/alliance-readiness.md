# Alliance Readiness

READY is a server command, not login activity and not localStorage state.

## Cycle

Default config:

- `readyIntervalSeconds`: 6 hours
- `readyButtonAvailableBeforeDueSeconds`: 2 hours
- `gracePeriodSeconds`: 2 hours
- `voteDurationSeconds`: 2 hours
- `voteRetryCooldownSeconds`: 2 hours

Per member:

- `lastReadyAt = serverNow`
- `readyDueAt = serverNow + 6h`
- `graceEndsAt = serverNow + 8h`

Derived statuses:

- `active`: READY is not available yet.
- `due_soon`: READY is available two hours before due time.
- `overdue`: six hours elapsed, but grace is still active.
- `vote_eligible`: eight hours elapsed; inactive kick vote may start.
- `vote_pending`: a pending inactive kick vote targets this member.
- `exit_pending`: leave cleanup is waiting for combat cleanup.
- `removed`: membership is closed.

## READY Command

`confirm-alliance-ready` validates:

- the alliance exists,
- the player is a current member,
- membership is not `removed` or `exit_pending`,
- expected membership version still matches when supplied,
- status is `due_soon`, `overdue`, `vote_eligible`, or `vote_pending`.

If the member is still `active`, the server returns `READY_TOO_EARLY`.

On success:

- timestamps roll from server time,
- membership version increments,
- pending vote against the member is cancelled,
- alliance read-model changes on reconnect/refresh,
- audit and deduped notifications are written.

Refresh, reconnect, or opening the game never confirms READY.

## Notifications

Scheduler/tick creates stable notification IDs:

- `alliance-ready-warning:{allianceId}:{playerId}:{cycleId}`
- `alliance-ready-overdue:{allianceId}:{playerId}:{cycleId}`
- `alliance-ready-vote-eligible:{allianceId}:{playerId}:{cycleId}`

Because IDs include the cycle, repeated ticks do not create duplicates.
