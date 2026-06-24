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
| rob-district | yes | yes | yes | map validator | robTargets | district button | added | legacy local robbery blocked when server slice is ready |
| heist-district | yes | yes | yes | map validator | heistTargets | district button | added | legacy preview only |
| place-defense | yes | yes | yes | map validator | placeDefense | district button | added | legacy defense mutation blocked when server slice is ready |
| remove-defense | yes | yes | yes | map validator | removeDefense | district button | added | legacy defense mutation blocked when server slice is ready |
| relocate-trap | no | no | no | map validator only | capability only | no closed-alpha button | not ready | not ready |
| market action | legacy/system-specific | partial | legacy market rules | market rules | market views | legacy modal | existing market tests | not part of this pass |
| bounty action | legacy-only | no | no core command | no | legacy bounty UI | legacy modal | page smoke only | not closed-alpha authoritative |
