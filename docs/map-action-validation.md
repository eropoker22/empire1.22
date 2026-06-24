# Map Action Validation

Map actions use `validateMapAction` from game-core as the central relation and adjacency validator. The read-model and command handlers both depend on this rule layer.

Covered map actions:

- `spy`
- `rob`
- `heist`
- `occupy`
- `attack`
- `place_trap`
- `place_defense`
- `remove_defense`

Rules are based on actual district ownership, origin ownership, bidirectional adjacency, locks, expected versions and alliance/truce state. Clients receive capabilities and reason codes, but handlers repeat the validation before mutating state.

Rob and heist support an omitted source district only when exactly one owned adjacent origin exists. Multiple possible origins are rejected with `NO_VALID_ORIGIN`.
