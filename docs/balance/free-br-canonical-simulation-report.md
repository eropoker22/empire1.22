# Free BR canonical simulation report

## Executive summary
- Seed: `123`
- Scenario: `canonical-20p`
- Simulováno: 80 hodin / 57600 ticků
- Vítěz: player:5 (final_lockdown_score)
- Top 8: Rado Viper (hackeri, aggressive-expander), Nika Static (tajna-organizace, aggressive-expander), Mara Byte (kartel, high-risk-criminal), Iris Knox (korporace, economy-builder), Ivan Drift (mafian, high-risk-criminal), Rex Harbor (kult, aggressive-expander), Ada Crown (tajna-organizace, high-risk-criminal), Zara Coil (motorkarsky-gang, aggressive-expander)
- Útoky: 1158 (679 výher, 479 proher)
- Obsazení neutralů: 213
- Spy akce: 831
- Building actions: 3632
- Craft akce: 2177
- Police raidy: 227
- Aliance: 1 vzniklo, 1 skončilo, 0 zrad
- Final Lockdown: start 62h, konec 80h, pauza 6h
- Final Top 3: 1. player:5 (614803), 2. player:4 (598411), 3. player:2 (532803)
- Downtown verdict: mild but healthy

## Verdikt: je Free BR pacing zdravý?
Simulace vypadá použitelně: 14.5 útoků/h, 12 eliminací a vítězství přes final_lockdown_score.

## Co fungovalo
- Makro eliminace držely top stop na 8 aktivních hráčích a po eliminaci se distrikty neutralizovaly: 72 districtů.
- Cooldowny omezily spam: při 80h vzniklo 1158 útoků, 831 spy akcí a 213 neutral captures.
- Danger zone měla měřitelný comeback: 24/240 záznamů (10%).

## Co je rizikové
- Downtown max držení jedním hráčem: 7/8; early owner top 8: ne; early owner win: ne.
- District control instant victory: disabled; starý 75% audit milestone by potřeboval 121 districtů, leader na konci držel 18; dosaženo: ne.
- High heat audit: nejvyšší heat 3397.9 u player:14, dirty cash seized 19469294.

## Co je broken
- V tomto běhu není tvrdě broken metrika. Rizika jsou spíš v endgame/downtown pravděpodobnostech a vyžadují matrix.

## Timeline zápasu
| Hodina | Aktivní | Leader | Districts | Bottom 3 | Útoky | Obsazení | Spy | Building | Aliance | Quiet |
| ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 20 | player:8 | 1 | player:1, player:4, player:6 | 0 | 0 | 0 | 0 | 0 | ne |
| 1 | 20 | player:19 | 4 | player:3, player:16, player:2 | 13 | 46 | 62 | 27 | 0 | ne |
| 2 | 20 | player:19 | 6 | player:3, player:16, player:10 | 11 | 37 | 57 | 37 | 0 | ne |
| 3 | 20 | player:19 | 6 | player:3, player:16, player:13 | 18 | 33 | 49 | 43 | 0 | ne |
| 4 | 20 | player:19 | 6 | player:3, player:16, player:7 | 17 | 18 | 49 | 56 | 0 | ne |
| 5 | 20 | player:19 | 6 | player:3, player:16, player:10 | 13 | 7 | 48 | 60 | 0 | ne |
| 6 | 20 | player:18 | 10 | player:3, player:16, player:19 | 21 | 0 | 35 | 58 | 0 | ne |
| 7 | 20 | player:11 | 13 | player:3, player:16, player:19 | 20 | 0 | 32 | 72 | 0 | ne |
| 8 | 19 | player:11 | 14 | player:16, player:18, player:19 | 17 | 0 | 18 | 75 | 0 | ne |
| 9 | 19 | player:14 | 14 | player:16, player:19, player:18 | 21 | 0 | 17 | 62 | 0 | ne |
| 10 | 19 | player:14 | 14 | player:16, player:19, player:18 | 17 | 0 | 13 | 78 | 0 | ne |
| 11 | 19 | player:14 | 14 | player:16, player:19, player:18 | 20 | 0 | 17 | 65 | 0 | ne |
| 12 | 18 | player:12 | 13 | player:19, player:18, player:1 | 15 | 0 | 20 | 85 | 0 | ne |
| 13 | 18 | player:14 | 14 | player:19, player:18, player:9 | 26 | 0 | 13 | 85 | 0 | ne |
| 14 | 18 | player:2 | 12 | player:19, player:18, player:1 | 21 | 0 | 21 | 77 | 0 | ne |
| 15 | 18 | player:2 | 13 | player:19, player:18, player:10 | 20 | 0 | 10 | 76 | 0 | ne |
| 16 | 18 | player:2 | 13 | player:19, player:18, player:1 | 19 | 0 | 4 | 80 | 0 | ano |
| 17 | 18 | player:2 | 13 | player:19, player:18, player:9 | 11 | 0 | 3 | 27 | 0 | ano |
| 18 | 18 | player:2 | 13 | player:19, player:18, player:13 | 8 | 0 | 3 | 11 | 0 | ano |
| 19 | 18 | player:11 | 15 | player:19, player:18, player:6 | 11 | 0 | 3 | 15 | 0 | ano |
| 20 | 18 | player:11 | 15 | player:19, player:6, player:1 | 11 | 0 | 2 | 13 | 0 | ano |
| 21 | 18 | player:11 | 15 | player:19, player:6, player:8 | 10 | 0 | 0 | 14 | 0 | ano |
| 22 | 17 | player:14 | 14 | player:15, player:18, player:8 | 12 | 0 | 3 | 17 | 1 | ne |
| 23 | 17 | player:14 | 14 | player:15, player:13, player:6 | 21 | 0 | 15 | 75 | 1 | ne |
| 24 | 17 | player:2 | 14 | player:13, player:15, player:8 | 23 | 0 | 12 | 83 | 1 | ne |
| 25 | 17 | player:2 | 14 | player:15, player:13, player:9 | 18 | 0 | 17 | 66 | 1 | ne |
| 26 | 16 | player:2 | 14 | player:18, player:6, player:1 | 21 | 0 | 13 | 79 | 1 | ne |
| 27 | 16 | player:5 | 14 | player:6, player:18, player:15 | 16 | 3 | 12 | 62 | 1 | ne |
| 28 | 16 | player:2 | 15 | player:6, player:15, player:10 | 18 | 0 | 9 | 83 | 1 | ne |
| 29 | 16 | player:2 | 15 | player:6, player:1, player:18 | 20 | 0 | 5 | 75 | 1 | ne |
| 30 | 15 | player:2 | 16 | player:15, player:6, player:18 | 15 | 0 | 8 | 71 | 1 | ne |
| 31 | 15 | player:5 | 15 | player:18, player:6, player:10 | 23 | 7 | 9 | 63 | 0 | ne |
| 32 | 15 | player:5 | 16 | player:18, player:6, player:10 | 17 | 0 | 4 | 56 | 0 | ne |
| 33 | 15 | player:5 | 15 | player:18, player:6, player:10 | 23 | 0 | 7 | 59 | 0 | ne |
| 34 | 14 | player:5 | 16 | player:6, player:10, player:8 | 14 | 0 | 10 | 67 | 0 | ne |
| 35 | 14 | player:5 | 16 | player:10, player:6, player:7 | 14 | 5 | 10 | 58 | 0 | ne |
| 36 | 14 | player:5 | 17 | player:7, player:10, player:6 | 17 | 0 | 3 | 67 | 0 | ne |
| 37 | 14 | player:5 | 17 | player:9, player:7, player:6 | 16 | 0 | 2 | 54 | 0 | ne |
| 38 | 13 | player:5 | 18 | player:9, player:6, player:10 | 17 | 0 | 5 | 54 | 0 | ne |
| 39 | 13 | player:5 | 20 | player:9, player:6, player:10 | 15 | 6 | 5 | 49 | 0 | ne |

_Zkráceno: celkem 81 hodinových snapshotů. Plný timeline je v JSON reportu._

## Eliminace
| Hodina | Hráč | Frakce | Strategie | Score | Districts | Bottom 3 | Quiet defer | Neutralizováno | Důvod |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | --- |
| 8 | Kiro Chrome | kult | casual | 393 | 0 | player:3, player:16, player:18 | ne | 0 | málo kontrolovaných districtů a slabá expanze |
| 12 | Nora Pulse | korporace | casual | 451 | 0 | player:16, player:19, player:18 | ne | 0 | málo kontrolovaných districtů a slabá expanze |
| 22 | Tibor Ghost | kult | economy-builder | 44212 | 0 | player:19, player:15, player:18 | ne | 0 | málo kontrolovaných districtů a slabá expanze |
| 26 | Miro Blade | hackeri | high-risk-criminal | 121573 | 3 | player:13, player:18, player:6 | ne | 3 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 30 | Viktor Neon | mafian | downtown-rusher | 157386 | 7 | player:1, player:15, player:6 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 34 | Mila Forge | kartel | economy-builder | 132479 | 5 | player:18, player:6, player:10 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 38 | Dante Volt | soukroma-armada | downtown-rusher | 197522 | 7 | player:7, player:9, player:6 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 46 | Boris Ash | mafian | diplomat | 244309 | 12 | player:9, player:6, player:14 | ne | 12 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 50 | Erik Signal | soukroma-armada | economy-builder | 267340 | 7 | player:15, player:6, player:10 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 54 | Tessa Flux | motorkarsky-gang | high-risk-criminal | 270247 | 8 | player:6, player:17, player:10 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 58 | Sima Vale | kartel | downtown-rusher | 342266 | 12 | player:10, player:12, player:8 | ne | 12 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 62 | Lena Cipher | tajna-organizace | diplomat | 411516 | 11 | player:12, player:2, player:8 | ne | 11 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |


## Danger zone a comebacky
- Celkem danger zone appearances: 240
- Comebacky: 24
- Comeback rate: 10%

## Aliance
- Vzniklo: 1
- Rozpadlo se: 1
- Největší aliance: alliance:1 (4 členů)
- Koordinované útoky: 41
- Hráči přeživší v alianci: 0

## Frakce
| Frakce | Hráči | Avg placement | Best | Top 8 | Útoky | Win rate útoků | Heat avg | Comeback rate | Verdikt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| hackeri | 2 | 9 | 1 | 1 | 95 | 67% | 612 | 0% | healthy |
| tajna-organizace | 3 | 6 | 2 | 2 | 241 | 64% | 1827.9 | 7% | healthy |
| kartel | 3 | 9.3 | 3 | 1 | 215 | 53% | 661.5 | 12% | healthy |
| korporace | 2 | 11.5 | 4 | 1 | 71 | 62% | 851.4 | 13% | healthy |
| mafian | 3 | 11.3 | 5 | 1 | 146 | 62% | 904.6 | 6% | healthy |
| kult | 3 | 14.7 | 6 | 1 | 126 | 51% | 889.7 | 3% | healthy |
| motorkarsky-gang | 2 | 9.5 | 8 | 1 | 174 | 58% | 1868.4 | 21% | healthy |
| soukroma-armada | 2 | 13 | 12 | 0 | 90 | 52% | 476.6 | 11% | weak |

## Strategie
| Strategie | Hráči | Avg placement | Top 8 | Win rate | Attack rate | Expansion | Alliance | Downtown success | Comeback | Police raids |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive-expander | 4 | 4.3 | 100% | 25% | 90.5 | 74.8 | 0 | 50% | 3% | 25 |
| high-risk-criminal | 5 | 8.6 | 60% | 0% | 70 | 54.6 | 0 | 20% | 11% | 16.6 |
| economy-builder | 4 | 12.3 | 25% | 0% | 52 | 35 | 0.5 | 0% | 14% | 3.3 |
| diplomat | 2 | 11 | 0% | 0% | 51 | 41 | 1 | 0% | 10% | 5 |
| downtown-rusher | 3 | 13.3 | 0% | 0% | 45.3 | 32.7 | 0 | 0% | 8% | 7 |
| casual | 2 | 19.5 | 0% | 0% | 0 | 0 | 0 | 0% | 6% | 0 |

## Útoky a obsazování
- Nejvíc útoků: Zara Coil (101)
- Nejvíc napadaný hráč approximation: player:14 (121)
- Most contested district: 91
- Downtown útoky: 284
- District ownership churn: 984

## Výroba a building actions
- Craft actions: 2177
- Building actions: 3632
- Rare building actions: 384

| Building action | Použití |
| --- | ---: |
| collect_students | 632 |
| evening_course | 355 |
| stabilization_protocol | 176 |
| good_rate | 169 |
| backup_grid_switch | 162 |
| extract_losses | 155 |
| vip_night | 154 |
| bar_whispers | 153 |
| quiet_backroom | 150 |
| open_channel | 142 |

## Downtown / rare snowball
- První downtown capture: 65 v hodině 0.67 hráčem player:19
- Max downtown držených jedním hráčem: 7
- Aliance proti downtown leaderovi: 0
- Verdikt: mild but healthy

## Heat / police
- Police raids: 227
- Dirty cash seized: 19469294
- Resource seized approximation: 2277
- Highest heat player: player:14 (3397.9)

## Victory / endgame
- Victory reached: ano
- Win reason: final_lockdown_score
- Final Lockdown start/end: 62h -> 80h
- Final Lockdown paused hours: 6
- Attacks during Final Lockdown: 194
- Final Top 3: 1. player:5 (614803), 2. player:4 (598411), 3. player:2 (532803)
- Control victory before Final Lockdown: disabled; old 75% audit milestone: 121/161, reached: ne
- Leader districts at end: 18
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
