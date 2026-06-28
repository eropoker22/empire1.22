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
| rob-district | server-authoritative basic path; closed-alpha fixed-loot placeholder |
| heist-district | server-authoritative immediate resolve path; closed-alpha instant placeholder |
| place-defense | own-district server-authoritative; allied disabled |
| remove-defense | own-district server-authoritative; allied disabled |

`rob-district`, `heist-district`, `place-defense`, and `remove-defense` are typed shared commands. Transport payload validation rejects unknown result/outcome fields so clients cannot force loot, heat, rolls, detection, owners, defense loadouts, or report data.

All map commands use `validateMapAction` for relation, adjacency, locks and version checks. Defense intentionally blocks allied placement with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED` until defense records can track item ownership.

Rob currently uses a fixed closed-alpha loot result decided in `game-core`; it is not a client-side roll and does not change district ownership. Heist currently resolves immediately in the handler instead of running the full async heist lifecycle. UI and docs must keep that action labeled as an alpha instant heist until pending operation recovery exists.

## Basic Action Closed-Alpha Matrix

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | yes, fixed alpha loot | yes | Replace fixed loot with balanced server loot rules after closed alpha. |
| heist-district | yes | yes as instant alpha | yes, no pending lifecycle | yes | Add recoverable start/resolve lifecycle before showing long timers. |
| place-defense | yes | yes for own district | no for own defense | yes | Add owner-aware allied defense contribution records before enabling alliance support. |
| remove-defense | yes | yes for own district | no for own defense | yes | Add cleanup for allied contribution records on leave/kick/disband before enabling alliance support. |

Rob validation allows only an empty adjacent target from an owned source district. It does not require spy authorization, does not cross allied districts, does not target self/ally/enemy districts, and never changes ownership.

Heist validation allows only an adjacent enemy-owned target from an owned source district. It rejects empty, self and allied targets, validates `gangMembersSent` server-side against available population, and never changes ownership.

Allied defense remains disabled with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED` in the central map validator and read-model capabilities. The aggregate `district.defenseLoadout` path is only used for the district owner so item ownership is not lost.
