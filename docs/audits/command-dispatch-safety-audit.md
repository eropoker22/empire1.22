# Command Dispatch Safety Audit

Status as of 2026-05-29: no production sync command dispatch bypass was found in `apps/server/src` after the Phase C/D hardening.

## Checked Production Paths

- `apps/server/src/netlify/gameplay-slice-function.ts`
- `apps/server/src/transport/gameplay-slice-json-handler.ts`
- `apps/server/src/transport/gameplay-slice-transport.ts`
- `apps/server/src/transport/command-ingress.ts`
- `apps/server/src/runtime/orchestration/instance-command-router.ts`
- `apps/server/src/runtime/server-instance-manager.ts`
- `apps/server/src/runtime/instance-manager/instance-lifecycle-service.ts`
- `apps/server/src/runtime/instance-manager/instance-command-dispatch.ts`

Canonical submit path:

`Netlify handler -> JSON handler -> transport -> command ingress -> command router -> instance manager -> lifecycle service -> dispatchInstanceCommand`.

All production command submit hops are async and return/await `Promise` results.

## Guards

- `dispatchInstanceCommand()` is the only server source boundary allowed to import `applyCommand()`.
- `commandReservationRepository.reserve()` is awaited before `applyCommand()`.
- `markApplied()` and `markRejected()` are awaited.
- Transport and Netlify source files are blocked from importing lifecycle/dispatch internals.
- Missing `commandReservationRepository` returns `server.command_reservation_unavailable` and does not mutate state.
- `processedCommandIds` is only a warm-runtime secondary guard after repository reservation; it is not the source of truth for duplicate handling.

The root `npm run lint` command now runs `scripts/check-command-dispatch-safety.mjs` after the architecture check.

## Rejection Behavior

- Pre-dispatch rejections do not reserve commands and do not call core dispatch.
- Duplicate `pending` returns `server.command_in_flight`.
- Duplicate `applied` returns `server.command_already_applied`.
- Duplicate `rejected` returns stored rejection errors.
- Payload hash mismatch returns `server.command_payload_conflict`.
- Core validation rejection after reservation marks the reservation as `rejected`.

## Non-Production Notes

`page-assets/js/admin-assets/admin-slice-demo.js` is a generated admin/debug demo bundle and still contains old bundled server runtime text. It is not loaded by `pages/game.html`; the existing architecture check keeps the admin slice launcher opt-in only. It should be regenerated or removed separately if the admin demo is promoted beyond debug tooling.

## Remaining Follow-Ups

- Apply `002_command_reservations.sql` in production before public alpha traffic.
- Add stale `pending` reservation recovery.
- Add full latest-snapshot/state update transaction or instance-scoped serialization for cross-command ordering.
- Keep Node 20 as the release verification runtime.
