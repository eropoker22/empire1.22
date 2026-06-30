# Command Surface Matrix

| Action | Shared Command | Transport | Handler | Validator | Read-model | UI | Tests | Legacy Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| select-spawn-district | yes | yes | yes | spawn rules | lobby spawn model | lobby button | existing | server |
| spy-district | yes | yes | yes | map validator + spy | spyTargets | district button | existing | server |
| occupy-district | yes | yes | yes | map validator + spy auth | occupyTargets | district button | existing | server |
| attack-district | yes | yes | yes | map validator + spy auth | attackTargets | district button | existing | server |
| place-trap | yes | yes | yes | map validator | trap | district button | existing | server |
| run-building-action | yes | yes | yes | building validation | building actions | building button | existing | server |
| collect-production | yes | yes | yes | collect validation | slot production | collect button | existing | server |
| craft-item | yes | yes | yes | craft validation | craft options | craft button | existing | server |
| rob-district | yes | yes | yes | map validator | robTargets | district button | targeted transport + handler tests | server-authoritative fixed-loot alpha; legacy local robbery blocked when server slice is ready |
| heist-district | yes | yes | yes | map validator | heistTargets | district button | targeted transport + handler tests | server-authoritative instant alpha; legacy preview only |
| place-defense | yes | yes | yes | map validator | placeDefense | district button | targeted transport + handler tests | own-district only; allied disabled with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED` |
| remove-defense | yes | yes | yes | map validator | removeDefense | district button | targeted transport + handler tests | own-district only; allied disabled with `ALLIANCE_DEFENSE_NOT_IMPLEMENTED` |
| relocate-trap | no | no | no | map validator only | capability only | no closed-alpha button | not ready | not ready |
| market action | legacy/system-specific | partial | legacy market rules | market rules | market views | legacy modal | existing market tests | not part of this pass |
| create-bounty | yes | yes | yes | bounty payload + core target/escrow validation | bounty read model | bounty board | bounty core + transport tests | server-authoritative MVP |
| cancel-bounty | yes | yes | yes | bounty payload + core ownership/status validation | bounty read model | bounty board row action | bounty core + transport tests | server-authoritative MVP |
| bounty claim | core side-effect | no browser command | yes | post-action claim matching | bounty read model/events | board status | bounty core tests | server-authoritative side-effect after attack/destroy |

## Basic Actions Detail

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | fixed alpha loot | yes | Move from fixed loot to balanced server loot rules. |
| heist-district | yes | yes, instant alpha only | async lifecycle not implemented | yes | Implement recoverable pending heist start/resolve before timers. |
| place-defense | yes | own district only | allied defense disabled | yes | Owner-aware alliance defense contributions and cleanup. |
| remove-defense | yes | own district only | allied defense disabled | yes | Owner-aware alliance defense removal and cleanup. |
