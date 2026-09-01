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
| rob-district | yes | yes | yes | map validator + finite loot pool | robTargets | district button | targeted transport + handler tests | server-authoritative timed loot; legacy local robbery blocked when server slice is ready |
| heist-district | yes | yes | yes | map validator | heistTargets | district button | targeted transport + handler tests | server-authoritative timed alpha; legacy preview only |
| place-defense | yes | yes | yes | map validator + contribution ownership | placeDefense | district button | transport + conservation + handler tests | own and allied districts; real inventory contribution |
| remove-defense | yes | yes | yes | map validator + contribution ownership | removeDefense | district button | transport + conservation + handler tests | returns only actor-owned surviving contribution |
| relocate-trap | no | no | no | map validator only | capability only | no closed-alpha button | not ready | not ready |
| market action | yes | yes | yes | market rules + storage/escrow validation | market read model | market modal | core + transport + UI tests | server-authoritative |
| create-bounty | yes | yes | yes | bounty payload + core target/escrow validation | bounty read model | Bounty Board create tab ready | bounty core + transport tests + page smoke | server-authoritative MVP |
| cancel-bounty | yes | yes | yes | bounty payload + core ownership/status validation | bounty read model | Bounty Board active tab ready | bounty core + transport tests + page smoke | server-authoritative MVP |
| bounty claim | core side-effect | no browser command | yes | post-action claim matching | bounty read model/events | Bounty Board active status ready | bounty core tests | server-authoritative side-effect after attack/destroy |
| create/join alliance | yes | yes | yes | alliance payload + lifecycle eligibility | allianceBoard | Alliance card ready | alliance lifecycle + transport tests + page smoke | server-authoritative MVP |
| alliance invite/respond | yes | yes | yes | alliance payload + membership authority | allianceBoard | Alliance management ready | alliance lifecycle + transport tests + page smoke | server-authoritative MVP |
| alliance ready/kick vote | yes | yes | yes | lifecycle payload + vote authority | allianceBoard + lifecycle projection | Alliance card and management ready | alliance lifecycle + transport tests + page smoke | server-authoritative MVP |
| leave/disband alliance | yes | yes | yes | lifecycle payload + membership authority | allianceBoard | Alliance leave modal ready | alliance lifecycle + transport tests + page smoke | server-authoritative MVP |

## Basic Actions Detail

| Action | Server-authoritative | Closed-alpha ready | Placeholder | Legacy mutation blocked | Known follow-up |
| --- | --- | --- | --- | --- | --- |
| rob-district | yes | yes | finite target pool with alpha balance profile | yes | Continue balance tuning from observed sessions. |
| heist-district | yes | yes, timed alpha | recoverable pending start/resolve | yes | Extend balancing and cancellation rules for invalidated targets. |
| place-defense | yes | own and allied districts | owner-aware contribution ledger | yes | Preserve item conservation across combat and alliance lifecycle. |
| remove-defense | yes | own and allied contributions | actor-owned surviving items only | yes | Preserve item conservation across combat and alliance lifecycle. |
