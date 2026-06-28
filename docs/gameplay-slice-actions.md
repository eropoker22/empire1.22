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

- `rob-district` is server-authoritative but uses fixed alpha loot from the handler.
- `heist-district` is server-authoritative but resolves instantly; UI copy must call it an immediate alpha heist and must not present timed async countdowns until pending operation recovery is implemented.
- Allied `place-defense` and `remove-defense` are disabled with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED`; only own-district aggregate defense is enabled.

Basic action status:

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | fixed alpha loot | yes | balanced server loot rules |
| heist-district | yes | yes as instant alpha | no async lifecycle | yes | recoverable pending lifecycle |
| place-defense | yes | own district only | allied disabled | yes | owner-aware allied contributions |
| remove-defense | yes | own district only | allied disabled | yes | allied cleanup on membership changes |
