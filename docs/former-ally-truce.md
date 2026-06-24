# Former Ally Truce

Every normal alliance exit creates bilateral truce records between the departing member and each former ally.

## Effects

During truce, former allies cannot:

- attack each other,
- run heists against each other,
- start new spy actions against each other,
- reuse old alliance consent or capabilities,
- reuse old spy attack authorization.

Players may still manage their own districts.

## Server Enforcement

`validateMapAction` checks `formerAllianceTrucesById` for `attack`, `heist`, and `spy`. It returns `FORMER_ALLY_TRUCE_ACTIVE` when a truce is active.

Spy reports between former allies are also marked as alliance-invalidated during exit cleanup so stale attack authorization does not survive the relationship break.

## Idempotence

Truce IDs include the source exit event and sorted player pair:

`former-ally-truce:{sourceEventId}:{playerAId}:{playerBId}`

Retrying cleanup cannot create duplicate truce rows for the same exit.
