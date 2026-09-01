# Gameplay Slice Actions

The gameplay slice client renders actions from the server read-model:

- `robTargets`
- `heistTargets`
- `placeDefense`
- `removeDefense`
- existing `spyTargets`, `occupyTargets`, `attackTargets`, trap, building, collect and craft views.

Click handlers resolve DOM dataset hooks to typed command factories:

- `createRobDistrictCommand`
- `createHeistDistrictCommand`
- `createPlaceDefenseCommand`
- `createRemoveDefenseCommand`

Factories only use server-fed target entries and expected versions. They do not include outcome, loot, roll, detection, owner, report, or heat result data.

Rejected submit responses keep the UI on the committed read-model and expose the server reason code. Accepted responses re-render from the returned authoritative read-model.

Closed-alpha caveats:

- `rob-district` is server-authoritative, resolves after its timer, and draws deterministic loot from the target district's finite shared pool.
- `heist-district` starts immediately, persists a recoverable pending operation, and resolves only after its authoritative timer expires.
- Allied `place-defense` and `remove-defense` use owner-aware contribution records, so each supporting player can recover only their own surviving items.

Basic action status:

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | finite target pool with alpha balance profile | yes | continue balance tuning |
| heist-district | yes | yes as timed alpha | recoverable pending start/resolve lifecycle | yes | extend balancing and cancellation coverage |
| place-defense | yes | own and allied districts | owner-aware contribution ledger | yes | keep conservation coverage across combat and alliance exit |
| remove-defense | yes | own and allied contributions | returns only the actor's surviving contribution | yes | keep conservation coverage across combat and alliance exit |
