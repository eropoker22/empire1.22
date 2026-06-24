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
