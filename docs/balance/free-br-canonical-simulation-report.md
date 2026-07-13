# Free BR canonical simulation report

## Executive summary
- Seed: `123`
- Scenario: `canonical-20p`
- Simulováno: 80 hodin / 57600 ticků
- Vítěz: player:2 (final_lockdown_score)
- Top 8: Mara Byte (kartel, high-risk-criminal), Rex Harbor (kult, aggressive-expander), Rado Viper (hackeri, aggressive-expander), Boris Ash (mafian, diplomat), Nika Static (tajna-organizace, aggressive-expander), Iris Knox (korporace, economy-builder), Lena Cipher (tajna-organizace, diplomat), Zara Coil (motorkarsky-gang, aggressive-expander)
- Útoky: 1154 (728 výher, 426 proher)
- Obsazení neutralů: 228
- Spy akce: 874
- Building actions: 5423
- Craft akce: 0
- Police raidy: 230
- Aliance: 5 vzniklo, 4 skončilo, 1 zrad
- Final Lockdown: start 62h, konec 80h, pauza 6h
- Final Top 3: 1. player:2 (475277), 2. player:11 (467536), 3. player:5 (420932)
- Downtown verdict: mild but healthy

## Verdikt: je Free BR pacing zdravý?
Simulace vypadá použitelně: 14.4 útoků/h, 12 eliminací a vítězství přes final_lockdown_score.

## Co fungovalo
- Makro eliminace držely top stop na 8 aktivních hráčích a po eliminaci se distrikty neutralizovaly: 87 districtů.
- Cooldowny omezily spam: při 80h vzniklo 1154 útoků, 874 spy akcí a 228 neutral captures.
- Danger zone měla měřitelný comeback: 24/240 záznamů (10%).

## Co je rizikové
- Downtown max držení jedním hráčem: 7/8; early owner top 8: ne; early owner win: ne.
- District control instant victory: disabled; starý 75% audit milestone by potřeboval 121 districtů, leader na konci držel 16; dosaženo: ne.
- High heat audit: nejvyšší heat 3064.2 u player:14, dirty cash seized 12916503.

## Co je broken
- V tomto běhu není tvrdě broken metrika. Rizika jsou spíš v endgame/downtown pravděpodobnostech a vyžadují matrix.

## Timeline zápasu
| Hodina | Aktivní | Leader | Districts | Bottom 3 | Útoky | Obsazení | Spy | Building | Aliance | Quiet |
| ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 20 | player:8 | 1 | player:1, player:4, player:6 | 0 | 0 | 0 | 0 | 0 | ne |
| 1 | 20 | player:19 | 3 | player:15, player:3, player:16 | 11 | 53 | 69 | 31 | 0 | ne |
| 2 | 20 | player:18 | 6 | player:16, player:13, player:10 | 17 | 38 | 57 | 40 | 0 | ne |
| 3 | 20 | player:19 | 7 | player:16, player:15, player:3 | 18 | 32 | 56 | 52 | 0 | ne |
| 4 | 20 | player:19 | 8 | player:3, player:15, player:10 | 27 | 18 | 58 | 64 | 0 | ne |
| 5 | 20 | player:19 | 7 | player:20, player:1, player:6 | 23 | 0 | 48 | 86 | 0 | ne |
| 6 | 20 | player:4 | 14 | player:9, player:6, player:7 | 19 | 0 | 31 | 110 | 1 | ne |
| 7 | 20 | player:4 | 14 | player:9, player:18, player:3 | 21 | 0 | 23 | 109 | 1 | ne |
| 8 | 19 | player:4 | 15 | player:9, player:13, player:19 | 21 | 0 | 18 | 105 | 1 | ne |
| 9 | 19 | player:11 | 13 | player:14, player:9, player:8 | 24 | 3 | 17 | 106 | 1 | ne |
| 10 | 19 | player:11 | 14 | player:16, player:18, player:7 | 22 | 0 | 17 | 112 | 1 | ne |
| 11 | 19 | player:11 | 15 | player:18, player:16, player:19 | 22 | 0 | 17 | 116 | 1 | ne |
| 12 | 18 | player:11 | 15 | player:16, player:10, player:7 | 24 | 0 | 15 | 114 | 1 | ne |
| 13 | 18 | player:2 | 13 | player:16, player:10, player:13 | 25 | 4 | 17 | 102 | 1 | ne |
| 14 | 18 | player:2 | 13 | player:16, player:13, player:7 | 24 | 0 | 9 | 107 | 1 | ne |
| 15 | 18 | player:2 | 13 | player:16, player:10, player:9 | 20 | 0 | 17 | 101 | 1 | ne |
| 16 | 18 | player:2 | 13 | player:16, player:19, player:7 | 18 | 0 | 14 | 109 | 1 | ano |
| 17 | 18 | player:2 | 13 | player:7, player:19, player:16 | 9 | 0 | 2 | 27 | 2 | ano |
| 18 | 18 | player:2 | 13 | player:7, player:16, player:15 | 8 | 0 | 1 | 20 | 2 | ano |
| 19 | 18 | player:2 | 13 | player:7, player:15, player:10 | 6 | 0 | 5 | 20 | 2 | ano |
| 20 | 18 | player:2 | 15 | player:7, player:6, player:13 | 8 | 0 | 5 | 24 | 2 | ano |
| 21 | 18 | player:2 | 15 | player:10, player:7, player:14 | 10 | 0 | 5 | 18 | 2 | ano |
| 22 | 17 | player:2 | 14 | player:10, player:6, player:19 | 9 | 0 | 12 | 25 | 2 | ne |
| 23 | 17 | player:11 | 20 | player:19, player:13, player:10 | 21 | 3 | 18 | 100 | 2 | ne |
| 24 | 17 | player:11 | 20 | player:10, player:19, player:13 | 20 | 2 | 15 | 99 | 2 | ne |
| 25 | 17 | player:11 | 20 | player:10, player:20, player:13 | 21 | 0 | 12 | 108 | 2 | ne |
| 26 | 16 | player:11 | 21 | player:20, player:13, player:16 | 20 | 0 | 9 | 95 | 2 | ne |
| 27 | 16 | player:11 | 20 | player:20, player:16, player:9 | 19 | 1 | 12 | 100 | 2 | ne |
| 28 | 16 | player:11 | 18 | player:19, player:16, player:13 | 24 | 0 | 15 | 93 | 2 | ne |
| 29 | 16 | player:2 | 13 | player:5, player:13, player:6 | 16 | 0 | 10 | 100 | 2 | ne |
| 30 | 15 | player:2 | 14 | player:19, player:16, player:13 | 21 | 0 | 3 | 119 | 2 | ne |
| 31 | 15 | player:2 | 14 | player:16, player:6, player:1 | 15 | 8 | 14 | 92 | 2 | ne |
| 32 | 15 | player:2 | 13 | player:16, player:19, player:9 | 19 | 0 | 11 | 96 | 3 | ne |
| 33 | 15 | player:2 | 13 | player:19, player:16, player:13 | 15 | 0 | 8 | 102 | 3 | ne |
| 34 | 14 | player:2 | 13 | player:13, player:14, player:16 | 16 | 0 | 8 | 99 | 3 | ne |
| 35 | 14 | player:2 | 13 | player:14, player:16, player:13 | 13 | 5 | 11 | 80 | 3 | ne |
| 36 | 14 | player:2 | 12 | player:16, player:14, player:1 | 14 | 0 | 10 | 96 | 3 | ne |
| 37 | 14 | player:2 | 11 | player:13, player:1, player:16 | 17 | 0 | 7 | 100 | 3 | ne |
| 38 | 13 | player:2 | 11 | player:13, player:15, player:5 | 19 | 0 | 13 | 88 | 3 | ne |
| 39 | 13 | player:2 | 13 | player:1, player:13, player:16 | 14 | 9 | 8 | 72 | 3 | ne |

_Zkráceno: celkem 81 hodinových snapshotů. Plný timeline je v JSON reportu._

## Eliminace
| Hodina | Hráč | Frakce | Strategie | Score | Districts | Bottom 3 | Quiet defer | Neutralizováno | Důvod |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | --- |
| 8 | Kiro Chrome | kult | casual | 46685 | 3 | player:3, player:9, player:13 | ne | 3 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 12 | Mila Forge | kartel | economy-builder | 65812 | 4 | player:18, player:16, player:10 | ne | 4 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 22 | Dante Volt | soukroma-armada | downtown-rusher | 96138 | 5 | player:7, player:10, player:6 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 26 | Sima Vale | kartel | downtown-rusher | 63691 | 1 | player:10, player:20, player:13 | ne | 1 | málo kontrolovaných districtů a slabá expanze |
| 30 | Ada Crown | tajna-organizace | high-risk-criminal | 142561 | 8 | player:20, player:19, player:16 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 34 | Tibor Ghost | kult | economy-builder | 159216 | 5 | player:19, player:13, player:14 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 38 | Tessa Flux | motorkarsky-gang | high-risk-criminal | 173464 | 9 | player:6, player:13, player:15 | ne | 9 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 46 | Erik Signal | soukroma-armada | economy-builder | 236503 | 8 | player:15, player:13, player:5 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 50 | Viktor Neon | mafian | downtown-rusher | 275056 | 13 | player:1, player:13, player:16 | ne | 13 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 54 | Nora Pulse | korporace | casual | 275757 | 11 | player:16, player:13, player:17 | ne | 11 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 58 | Miro Blade | hackeri | high-risk-criminal | 311872 | 11 | player:13, player:5, player:14 | ne | 11 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 62 | Ivan Drift | mafian | high-risk-criminal | 358524 | 9 | player:17, player:14, player:5 | ne | 9 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |


## Danger zone a comebacky
- Celkem danger zone appearances: 240
- Comebacky: 24
- Comeback rate: 10%

## Aliance
- Vzniklo: 5
- Rozpadlo se: 4
- Největší aliance: alliance:1 (4 členů)
- Koordinované útoky: 327
- Hráči přeživší v alianci: 2

## Frakce
| Frakce | Hráči | Avg placement | Best | Top 8 | Útoky | Win rate útoků | Heat avg | Comeback rate | Verdikt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| kartel | 3 | 12.3 | 1 | 1 | 135 | 59% | 120.2 | 6% | healthy |
| kult | 3 | 12.3 | 2 | 1 | 136 | 68% | 1259.8 | 7% | healthy |
| hackeri | 2 | 6.5 | 3 | 1 | 203 | 63% | 1004.5 | 15% | healthy |
| mafian | 3 | 8.3 | 4 | 1 | 163 | 63% | 1143.6 | 13% | healthy |
| tajna-organizace | 3 | 9.3 | 5 | 2 | 210 | 61% | 1706.3 | 6% | healthy |
| korporace | 2 | 8.5 | 6 | 1 | 79 | 67% | 1012.6 | 9% | healthy |
| motorkarsky-gang | 2 | 11 | 8 | 1 | 181 | 69% | 1532.1 | 11% | healthy |
| soukroma-armada | 2 | 15.5 | 13 | 0 | 47 | 43% | 148.3 | 5% | weak |

## Strategie
| Strategie | Hráči | Avg placement | Top 8 | Win rate | Attack rate | Expansion | Alliance | Downtown success | Comeback | Police raids |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| high-risk-criminal | 5 | 10 | 20% | 20% | 64.2 | 51 | 0.4 | 0% | 15% | 11.6 |
| aggressive-expander | 4 | 4.5 | 100% | 0% | 115 | 94 | 1 | 50% | 8% | 25.5 |
| diplomat | 2 | 5.5 | 100% | 0% | 50 | 48.5 | 2 | 50% | 13% | 9 |
| economy-builder | 4 | 13.3 | 25% | 0% | 36.3 | 29.8 | 1 | 25% | 8% | 5.5 |
| casual | 2 | 15.5 | 0% | 0% | 13.5 | 15 | 0.5 | 0% | 8% | 0 |
| downtown-rusher | 3 | 15.7 | 0% | 0% | 33.7 | 26.3 | 0.7 | 0% | 7% | 10 |

## Útoky a obsazování
- Nejvíc útoků: Zara Coil (138)
- Nejvíc napadaný hráč approximation: player:14 (144)
- Most contested district: 78
- Downtown útoky: 313
- District ownership churn: 1063

## Výroba a building actions
- Craft actions: 0
- Building actions: 5423
- Rare building actions: 584

| Building action | Použití |
| --- | ---: |
| extract_losses | 366 |
| evening_course | 325 |
| strip_club_collect_cash | 323 |
| good_rate | 321 |
| private_party | 251 |
| backup_grid_switch | 232 |
| power_station_feed_production | 229 |
| power_station_reduce_heat | 226 |
| stabilization_protocol | 213 |
| back_cashdesk | 208 |

## Downtown / rare snowball
- První downtown capture: 65 v hodině 0.33 hráčem player:19
- Max downtown držených jedním hráčem: 7
- Aliance proti downtown leaderovi: 0
- Verdikt: mild but healthy

## Heat / police
- Police raids: 230
- Dirty cash seized: 12916503
- Resource seized approximation: 446
- Highest heat player: player:14 (3064.2)

## Victory / endgame
- Victory reached: ano
- Win reason: final_lockdown_score
- Final Lockdown start/end: 62h -> 80h
- Final Lockdown paused hours: 6
- Attacks during Final Lockdown: 172
- Final Top 3: 1. player:2 (475277), 2. player:11 (467536), 3. player:5 (420932)
- Control victory before Final Lockdown: disabled; old 75% audit milestone: 121/161, reached: ne
- Leader districts at end: 16
- Hard timeout reached: ne

## Doporučení pro balance
- Endgame už končí skórem po Top 8; další balance ladit přes Final Empire Score breakdown, ne přes 75% threshold.

## Doporučení pro další testy
- Spouštět matrix 50-200 běhů po každém větším balance patchi cooldownů, economy nebo building actions.
- Porovnat canonical-20p proti casual-heavy a downtown-rush, protože ty nejlépe odhalují onboarding frustraci a rare snowball.
- Přidat budoucí integrační test přes skutečný command handler, až bude server-side orchestration plně sdílená se simulátorem.

## Known approximations
- Mapa je server-side simulační grid 13x13 minus 8 okrajových polí, ne reálná browser canvas geometrie.
- Bot akce používají canonical cooldowny/config hodnoty, ale neprocházejí celý command handler pipeline.
- Police/heat raid model používá Free police thresholds a seizure procenta, ale pending raid UX stavy jsou agregované.
- Craft a building actions používají canonical config cooldown/output, ale výroba se pro audit zapíše okamžitě jako completion approximation.
- Aliance jsou simulační sociální vrstva nad core configem; core alliance command handler zatím není použit jako autoritativní API.
