# Public Alpha Command Safety

Status as of 2026-05-29: exactly-once command id execution is implemented for the Postgres-backed async submit path.

## Implemented

- `empire_command_reservations` migration in `002_command_reservations.sql`.
- Postgres `CommandReservationRepository` with unique `(server_instance_id, command_id)`.
- Async submit chain from Netlify/JSON transport through `InstanceLifecycleService.dispatch()`.
- Awaited `reserve()` before `applyCommand()`.
- Deterministic stable JSON command-envelope hash.
- Duplicate pending/applied/rejected handling without core dispatch replay.
- Payload conflict handling through `server.command_payload_conflict`.
- Core validation failures are marked as rejected reservations.

## Current Guarantees

- The winning submit for a new command id reserves first and is the only path allowed to call `applyCommand()`.
- Duplicate pending command ids return `server.command_in_flight`.
- Duplicate applied command ids return `server.command_already_applied`.
- Duplicate rejected command ids return stored rejection errors.
- Same command id with a different payload hash returns `server.command_payload_conflict`.
- Pre-dispatch gate failures do not reserve and do not mutate state.

## Remaining Follow-Ups

- Production must apply `002_command_reservations.sql` before public alpha traffic.
- Memory and file reservations are local/dev parity only, not distributed serverless locks.
- Dispatch does not yet persist latest snapshot/state and reservation updates inside one Postgres transaction.
- Crash recovery for stale `pending` reservations is not automated yet.
- Dedicated player registration/session reservation remains separate follow-up.

## Release Gate

Run before public alpha:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:persistence
npm run test:server
npm run test:integration
npm run test:read-models
npm run test:e2e:smoke
npm run build:admin:page
```
