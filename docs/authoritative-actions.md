# Authoritative Actions

Empire Streets treats gameplay commands as server-authoritative. The UI may render previews and pending state, but command outcome, state mutation, reports, events, cooldowns and resources are decided by game-core handlers reached through `/api/gameplay-slice/submit`.

Closed-alpha ready actions in this pass:

| Action | Status |
| --- | --- |
| select-spawn-district | server-authoritative |
| spy-district | server-authoritative |
| occupy-district | server-authoritative |
| attack-district | server-authoritative |
| place-trap | server-authoritative |
| run-building-action | server-authoritative |
| collect-production | server-authoritative |
| craft-item | server-authoritative |
| rob-district | server-authoritative timed path; loot comes from the target's finite shared pool |
| heist-district | server-authoritative timed path with recoverable pending lifecycle |
| place-defense | server-authoritative for own and allied districts with owner-aware contributions |
| remove-defense | server-authoritative; returns only the actor's surviving contribution |

`rob-district`, `heist-district`, `place-defense`, and `remove-defense` are typed shared commands. Transport payload validation rejects unknown result/outcome fields so clients cannot force loot, heat, rolls, detection, owners, defense loadouts, or report data.

All map commands use `validateMapAction` for relation, adjacency, locks and version checks. Allied defense stores owner-aware contribution records so support consumes real inventory and removal cannot take another member's items.

Rob reserves the team at launch, resolves after its timer, draws only from the neutral target's finite server-owned loot pool, and never changes district ownership. Heist also starts immediately and resolves through a persisted pending operation; the client never rolls its outcome or invents a countdown.

## Basic Action Closed-Alpha Matrix

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | finite target pool with alpha balance profile | yes | Continue balance tuning from observed sessions. |
| heist-district | yes | yes as timed alpha | no; recoverable pending lifecycle is active | yes | Extend balancing and cancellation coverage. |
| place-defense | yes | yes for own and allied districts | owner-aware contribution ledger | yes | Preserve conservation across combat and alliance lifecycle changes. |
| remove-defense | yes | yes for own and allied contributions | actor-owned surviving items only | yes | Preserve conservation across combat and alliance lifecycle changes. |

Rob validation allows only an empty adjacent target from an owned source district. It does not require spy authorization, does not cross allied districts, does not target self/ally/enemy districts, and never changes ownership.

Heist validation allows only an adjacent enemy-owned target from an owned source district. It rejects empty, self and allied targets, validates `gangMembersSent` server-side against available population, and never changes ownership.

Allied defense is enabled for valid allies. The contribution ledger preserves item ownership through placement, combat losses, removal, leave, kick and disband instead of collapsing support into an ownerless aggregate.
