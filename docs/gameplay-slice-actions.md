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
- `heist-district` is server-authoritative but resolves instantly; do not present it as a timed async heist until pending operation recovery is implemented.
- Allied `place-defense` and `remove-defense` are disabled with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED`; only own-district aggregate defense is enabled.
