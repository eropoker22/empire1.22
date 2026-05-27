# Free BR canonical simulation report

## Executive summary
- Seed: `123`
- Scenario: `canonical-20p`
- Simulováno: 168 hodin / 120960 ticků
- Vítěz: nikdo (timeout_no_winner)
- Top 8: Nika Static (tajna-organizace, aggressive-expander), Viktor Neon (mafian, downtown-rusher), Ivan Drift (mafian, high-risk-criminal), Rado Viper (hackeri, aggressive-expander), Lena Cipher (tajna-organizace, diplomat), Iris Knox (korporace, economy-builder), Rex Harbor (kult, aggressive-expander), Dante Volt (soukroma-armada, downtown-rusher)
- Útoky: 2138 (1285 výher, 853 proher)
- Obsazení neutralů: 241
- Spy akce: 1108
- Building actions: 5973
- Craft akce: 4197
- Police raidy: 1846
- Aliance: 3 vzniklo, 1 skončilo, 1 zrad
- Downtown verdict: mild but healthy

## Verdikt: je Free BR pacing zdravý?
Pacing je hratelný, ale endgame je rizikový: vítěz nevznikl, leader držel 20/121 potřebných districtů.

## Co fungovalo
- Makro eliminace držely top stop na 8 aktivních hráčích a po eliminaci se distrikty neutralizovaly: 100 districtů.
- Cooldowny omezily spam: při 168h vzniklo 2138 útoků, 1108 spy akcí a 241 neutral captures.
- Danger zone měla měřitelný comeback: 24/504 záznamů (5%).

## Co je rizikové
- Downtown max držení jedním hráčem: 8/8; early owner top 8: ne; early owner win: ne.
- 75% victory potřebuje 121 districtů; leader na konci držel 20.
- High heat audit: nejvyšší heat 181.9 u player:5, dirty cash seized 65927069.

## Co je broken
- V tomto běhu není tvrdě broken metrika. Rizika jsou spíš v endgame/downtown pravděpodobnostech a vyžadují matrix.

## Timeline zápasu
| Hodina | Aktivní | Leader | Districts | Bottom 3 | Útoky | Obsazení | Spy | Building | Aliance | Quiet |
| ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 20 | player:8 | 1 | player:1, player:4, player:6 | 0 | 0 | 0 | 0 | 0 | ne |
| 1 | 20 | player:12 | 5 | player:16, player:3, player:2 | 10 | 47 | 66 | 25 | 0 | ne |
| 2 | 20 | player:14 | 8 | player:16, player:3, player:10 | 12 | 37 | 51 | 38 | 0 | ne |
| 3 | 20 | player:14 | 11 | player:16, player:3, player:1 | 18 | 32 | 65 | 34 | 0 | ne |
| 4 | 20 | player:4 | 12 | player:16, player:3, player:13 | 25 | 15 | 49 | 36 | 0 | ne |
| 5 | 20 | player:17 | 14 | player:16, player:13, player:19 | 22 | 8 | 44 | 43 | 0 | ne |
| 6 | 20 | player:17 | 13 | player:16, player:19, player:13 | 21 | 1 | 40 | 65 | 0 | ne |
| 7 | 20 | player:17 | 13 | player:16, player:19, player:13 | 23 | 1 | 33 | 65 | 0 | ne |
| 8 | 19 | player:11 | 13 | player:19, player:15, player:13 | 17 | 0 | 14 | 66 | 0 | ne |
| 9 | 19 | player:11 | 14 | player:19, player:3, player:18 | 25 | 0 | 11 | 74 | 0 | ne |
| 10 | 19 | player:11 | 14 | player:18, player:3, player:12 | 21 | 0 | 16 | 77 | 0 | ne |
| 11 | 19 | player:11 | 13 | player:3, player:18, player:15 | 22 | 0 | 15 | 72 | 0 | ne |
| 12 | 18 | player:17 | 14 | player:3, player:6, player:15 | 19 | 0 | 15 | 67 | 0 | ne |
| 13 | 18 | player:11 | 14 | player:3, player:6, player:15 | 22 | 4 | 20 | 72 | 0 | ne |
| 14 | 18 | player:11 | 13 | player:3, player:6, player:9 | 25 | 0 | 18 | 73 | 0 | ne |
| 15 | 18 | player:2 | 14 | player:3, player:6, player:20 | 22 | 0 | 14 | 83 | 0 | ne |
| 16 | 18 | player:11 | 14 | player:3, player:19, player:6 | 20 | 0 | 15 | 76 | 0 | ano |
| 17 | 18 | player:14 | 14 | player:3, player:19, player:13 | 7 | 0 | 2 | 18 | 0 | ano |
| 18 | 18 | player:14 | 14 | player:3, player:19, player:9 | 8 | 0 | 3 | 18 | 0 | ano |
| 19 | 18 | player:14 | 13 | player:3, player:13, player:9 | 10 | 0 | 1 | 17 | 0 | ano |
| 20 | 18 | player:14 | 13 | player:3, player:19, player:20 | 7 | 0 | 3 | 17 | 0 | ano |
| 21 | 18 | player:14 | 13 | player:20, player:9, player:15 | 12 | 0 | 4 | 11 | 0 | ano |
| 22 | 17 | player:14 | 13 | player:6, player:13, player:9 | 14 | 0 | 5 | 14 | 1 | ne |
| 23 | 17 | player:14 | 13 | player:6, player:9, player:13 | 17 | 4 | 15 | 52 | 1 | ne |
| 24 | 17 | player:2 | 15 | player:13, player:19, player:6 | 18 | 0 | 17 | 68 | 1 | ne |
| 25 | 17 | player:14 | 13 | player:9, player:3, player:15 | 19 | 0 | 10 | 68 | 1 | ne |
| 26 | 16 | player:4 | 13 | player:15, player:19, player:9 | 18 | 0 | 11 | 64 | 2 | ne |
| 27 | 16 | player:14 | 11 | player:1, player:19, player:9 | 25 | 7 | 13 | 59 | 2 | ne |
| 28 | 16 | player:2 | 14 | player:9, player:1, player:15 | 18 | 1 | 15 | 60 | 2 | ne |
| 29 | 16 | player:4 | 13 | player:9, player:15, player:6 | 21 | 0 | 7 | 64 | 2 | ne |
| 30 | 15 | player:4 | 13 | player:6, player:15, player:19 | 17 | 0 | 5 | 68 | 2 | ne |
| 31 | 15 | player:4 | 14 | player:6, player:11, player:10 | 20 | 8 | 10 | 60 | 2 | ne |
| 32 | 15 | player:14 | 12 | player:11, player:10, player:6 | 14 | 0 | 12 | 52 | 2 | ne |
| 33 | 15 | player:14 | 14 | player:10, player:15, player:19 | 22 | 0 | 13 | 51 | 2 | ne |
| 34 | 14 | player:14 | 13 | player:15, player:19, player:10 | 14 | 0 | 10 | 69 | 2 | ne |
| 35 | 14 | player:14 | 16 | player:15, player:10, player:19 | 15 | 7 | 11 | 57 | 2 | ne |
| 36 | 14 | player:14 | 14 | player:15, player:19, player:17 | 19 | 0 | 15 | 53 | 2 | ne |
| 37 | 14 | player:14 | 14 | player:15, player:10, player:19 | 26 | 0 | 8 | 63 | 2 | ne |
| 38 | 13 | player:14 | 13 | player:17, player:8, player:10 | 18 | 0 | 10 | 69 | 2 | ne |
| 39 | 13 | player:4 | 14 | player:13, player:8, player:10 | 23 | 8 | 15 | 59 | 2 | ne |

_Zkráceno: celkem 169 hodinových snapshotů. Plný timeline je v JSON reportu._

## Eliminace
| Hodina | Hráč | Frakce | Strategie | Score | Districts | Bottom 3 | Quiet defer | Neutralizováno | Důvod |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | --- |
| 8 | Nora Pulse | korporace | casual | 451 | 0 | player:16, player:19, player:15 | ne | 0 | málo kontrolovaných districtů a slabá expanze |
| 12 | Mila Forge | kartel | economy-builder | 73423 | 4 | player:18, player:3, player:6 | ne | 4 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 22 | Ada Crown | tajna-organizace | high-risk-criminal | 102972 | 4 | player:20, player:6, player:13 | ne | 4 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 26 | Kiro Chrome | kult | casual | 138550 | 8 | player:3, player:15, player:19 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 30 | Boris Ash | mafian | diplomat | 156426 | 8 | player:9, player:6, player:15 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 34 | Tessa Flux | motorkarsky-gang | high-risk-criminal | 165408 | 7 | player:6, player:15, player:19 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 38 | Erik Signal | soukroma-armada | economy-builder | 189400 | 8 | player:15, player:17, player:8 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 46 | Tibor Ghost | kult | economy-builder | 292149 | 13 | player:19, player:8, player:17 | ne | 13 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 50 | Zara Coil | motorkarsky-gang | aggressive-expander | 277451 | 4 | player:14, player:10, player:17 | ne | 4 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 54 | Sima Vale | kartel | downtown-rusher | 341613 | 15 | player:10, player:12, player:2 | ne | 15 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 58 | Miro Blade | hackeri | high-risk-criminal | 363950 | 15 | player:13, player:17, player:2 | ne | 15 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 62 | Mara Byte | kartel | high-risk-criminal | 414305 | 14 | player:2, player:8, player:17 | ne | 14 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |


## Danger zone a comebacky
- Celkem danger zone appearances: 504
- Comebacky: 24
- Comeback rate: 5%

## Aliance
- Vzniklo: 3
- Rozpadlo se: 1
- Největší aliance: alliance:1 (4 členů)
- Koordinované útoky: 777
- Hráči přeživší v alianci: 5

## Frakce
| Frakce | Hráči | Avg placement | Best | Top 8 | Útoky | Win rate útoků | Heat avg | Comeback rate | Verdikt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| tajna-organizace | 3 | 8 | 1 | 2 | 414 | 56% | 105.8 | 3% | healthy |
| mafian | 3 | 7 | 2 | 2 | 440 | 59% | 95.8 | 4% | healthy |
| hackeri | 2 | 7 | 4 | 1 | 316 | 61% | 91 | 1% | healthy |
| korporace | 2 | 13 | 6 | 1 | 142 | 71% | 79 | 10% | healthy |
| kult | 3 | 12.3 | 7 | 1 | 330 | 58% | 46.4 | 4% | healthy |
| soukroma-armada | 2 | 11 | 8 | 1 | 252 | 60% | 78 | 5% | healthy |
| kartel | 3 | 13 | 9 | 0 | 136 | 62% | 0 | 11% | weak |
| motorkarsky-gang | 2 | 13.5 | 12 | 0 | 108 | 63% | 0 | 19% | weak |

## Strategie
| Strategie | Hráči | Avg placement | Top 8 | Win rate | Attack rate | Expansion | Alliance | Downtown success | Comeback | Police raids |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive-expander | 4 | 6 | 75% | 0% | 197.8 | 141.3 | 0.5 | 25% | 0% | 165 |
| downtown-rusher | 3 | 7 | 67% | 0% | 148.3 | 101.3 | 1 | 33% | 1% | 133.7 |
| high-risk-criminal | 5 | 11 | 20% | 0% | 88 | 63 | 0.2 | 20% | 10% | 67.2 |
| diplomat | 2 | 10.5 | 50% | 0% | 94.5 | 60 | 1 | 0% | 3% | 99 |
| economy-builder | 4 | 13 | 25% | 0% | 65.8 | 52 | 0.8 | 25% | 16% | 62.8 |
| casual | 2 | 18.5 | 0% | 0% | 5 | 7 | 0 | 0% | 4% | 0 |

## Útoky a obsazování
- Nejvíc útoků: Rex Harbor (255)
- Nejvíc napadaný hráč approximation: player:5 (261)
- Most contested district: 91
- Downtown útoky: 483
- District ownership churn: 1646

## Výroba a building actions
- Craft actions: 4197
- Building actions: 5973
- Rare building actions: 775

| Building action | Použití |
| --- | ---: |
| collect_students | 1141 |
| evening_course | 638 |
| stabilization_protocol | 384 |
| good_rate | 272 |
| backup_grid_switch | 254 |
| vip_lounge | 230 |
| extract_losses | 228 |
| private_party | 210 |
| bribed_inspector | 205 |
| quiet_backroom | 196 |

## Downtown / rare snowball
- První downtown capture: 65 v hodině 0.67 hráčem player:19
- Max downtown držených jedním hráčem: 8
- Aliance proti downtown leaderovi: 1
- Verdikt: mild but healthy

## Heat / police
- Police raids: 1846
- Dirty cash seized: 65927069
- Resource seized approximation: 27181
- Highest heat player: player:5 (181.9)

## Victory / endgame
- Victory reached: ne
- Win reason: timeout_no_winner
- 75% threshold: 121/161
- Leader districts at end: 20
- Hard timeout reached: ano

## Doporučení pro balance
- Neměnit hned 75% threshold jen podle jednoho runu; nejdřív ověřit matrix, jestli hard timeout dominuje opakovaně.

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
