# Server Layer Rules

- Keep server as the only source of truth.
- Do not place gameplay rules in transport, monitoring, or admin-facing modules.
- Route all player actions through command ingress and instance lifecycle boundaries.
- Keep instance runtime isolated: no shared mutable state between instances.
- Prefer small modules with one responsibility over broad utility files.
- Persistence modules define boundaries only; do not mix database code into game-core or transport.
- Admin-facing modules may read monitoring/projection data but must not mutate game state directly.

