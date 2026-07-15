# Free BR canonical simulation report

## Executive summary
- Seed: `123`
- Scenario: `canonical-20p`
- Simulováno: 80 hodin / 57600 ticků
- Vítěz: player:8 (final_lockdown_score)
- Top 8: Iris Knox (korporace, economy-builder), Dante Volt (soukroma-armada, downtown-rusher), Boris Ash (mafian, diplomat), Sima Vale (kartel, downtown-rusher), Lena Cipher (tajna-organizace, diplomat), Zara Coil (motorkarsky-gang, aggressive-expander), Ivan Drift (mafian, high-risk-criminal), Rex Harbor (kult, aggressive-expander)
- Útoky: 1166 (720 výher, 446 proher)
- Obsazení neutralů: 213
- Spy akce: 820
- Building actions: 3143
- Craft akce: 2309
- Police raidy: 227
- Aliance: 3 vzniklo, 1 skončilo, 0 zrad
- Final Lockdown: start 62h, konec 80h, pauza 6h
- Final Top 3: 1. player:8 (582485), 2. player:7 (520216), 3. player:9 (396279)
- Downtown verdict: mild but healthy

## Verdikt: je Free BR pacing zdravý?
Simulace vypadá použitelně: 14.6 útoků/h, 12 eliminací a vítězství přes final_lockdown_score.

## Co fungovalo
- Makro eliminace držely top stop na 8 aktivních hráčích a po eliminaci se distrikty neutralizovaly: 72 districtů.
- Cooldowny omezily spam: při 80h vzniklo 1166 útoků, 820 spy akcí a 213 neutral captures.
- Danger zone měla měřitelný comeback: 24/240 záznamů (10%).

## Co je rizikové
- Downtown max držení jedním hráčem: 6/8; early owner top 8: ne; early owner win: ne.
- District control instant victory: disabled; starý 75% audit milestone by potřeboval 121 districtů, leader na konci držel 24; dosaženo: ne.
- High heat audit: nejvyšší heat 2085.5 u player:17, dirty cash seized 10412568.

## Co je broken
- V tomto běhu není tvrdě broken metrika. Rizika jsou spíš v endgame/downtown pravděpodobnostech a vyžadují matrix.

## Timeline zápasu
| Hodina | Aktivní | Leader | Districts | Bottom 3 | Útoky | Obsazení | Spy | Building | Aliance | Quiet |
| ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 20 | player:8 | 1 | player:1, player:4, player:6 | 0 | 0 | 0 | 0 | 0 | ne |
| 1 | 20 | player:19 | 5 | player:16, player:8, player:9 | 13 | 43 | 58 | 23 | 0 | ne |
| 2 | 20 | player:20 | 7 | player:16, player:6, player:11 | 17 | 42 | 54 | 29 | 0 | ne |
| 3 | 20 | player:20 | 10 | player:16, player:3, player:18 | 19 | 34 | 59 | 28 | 0 | ne |
| 4 | 20 | player:4 | 14 | player:16, player:3, player:19 | 22 | 13 | 54 | 44 | 0 | ne |
| 5 | 20 | player:12 | 15 | player:16, player:3, player:15 | 18 | 8 | 47 | 45 | 0 | ne |
| 6 | 20 | player:20 | 9 | player:16, player:3, player:15 | 16 | 1 | 37 | 75 | 0 | ne |
| 7 | 20 | player:4 | 16 | player:16, player:3, player:19 | 25 | 0 | 30 | 76 | 0 | ne |
| 8 | 19 | player:4 | 15 | player:3, player:15, player:19 | 19 | 0 | 21 | 64 | 0 | ne |
| 9 | 19 | player:4 | 13 | player:15, player:13, player:3 | 21 | 0 | 15 | 82 | 0 | ne |
| 10 | 19 | player:4 | 15 | player:15, player:18, player:13 | 19 | 0 | 19 | 71 | 1 | ne |
| 11 | 19 | player:4 | 14 | player:18, player:2, player:3 | 25 | 0 | 13 | 61 | 1 | ne |
| 12 | 18 | player:4 | 13 | player:5, player:3, player:15 | 18 | 0 | 13 | 66 | 1 | ne |
| 13 | 18 | player:17 | 16 | player:2, player:3, player:15 | 23 | 5 | 16 | 48 | 1 | ne |
| 14 | 18 | player:17 | 18 | player:3, player:15, player:13 | 17 | 0 | 20 | 47 | 1 | ne |
| 15 | 18 | player:17 | 19 | player:15, player:2, player:3 | 21 | 0 | 9 | 69 | 1 | ne |
| 16 | 18 | player:17 | 19 | player:3, player:15, player:5 | 21 | 0 | 13 | 58 | 1 | ano |
| 17 | 18 | player:17 | 17 | player:15, player:2, player:3 | 7 | 0 | 1 | 11 | 1 | ano |
| 18 | 18 | player:11 | 13 | player:2, player:15, player:13 | 7 | 0 | 6 | 13 | 1 | ano |
| 19 | 18 | player:8 | 14 | player:2, player:13, player:15 | 9 | 0 | 1 | 14 | 2 | ano |
| 20 | 18 | player:4 | 14 | player:15, player:2, player:5 | 7 | 0 | 3 | 9 | 2 | ano |
| 21 | 18 | player:17 | 17 | player:15, player:5, player:13 | 9 | 0 | 6 | 5 | 2 | ano |
| 22 | 17 | player:4 | 14 | player:15, player:13, player:5 | 11 | 0 | 2 | 18 | 2 | ne |
| 23 | 17 | player:4 | 15 | player:5, player:3, player:15 | 18 | 6 | 8 | 64 | 2 | ne |
| 24 | 17 | player:4 | 16 | player:5, player:3, player:15 | 19 | 0 | 9 | 61 | 2 | ne |
| 25 | 17 | player:8 | 17 | player:5, player:3, player:15 | 14 | 0 | 7 | 70 | 2 | ne |
| 26 | 16 | player:4 | 16 | player:3, player:15, player:6 | 18 | 0 | 2 | 59 | 2 | ne |
| 27 | 16 | player:8 | 18 | player:3, player:18, player:6 | 17 | 2 | 5 | 45 | 2 | ne |
| 28 | 16 | player:8 | 19 | player:3, player:18, player:13 | 20 | 0 | 16 | 59 | 2 | ne |
| 29 | 16 | player:8 | 19 | player:3, player:18, player:15 | 17 | 0 | 10 | 64 | 3 | ne |
| 30 | 15 | player:8 | 19 | player:3, player:13, player:18 | 15 | 0 | 5 | 66 | 3 | ne |
| 31 | 15 | player:8 | 21 | player:3, player:19, player:18 | 19 | 3 | 17 | 56 | 3 | ne |
| 32 | 15 | player:1 | 17 | player:19, player:18, player:3 | 19 | 0 | 9 | 57 | 3 | ne |
| 33 | 15 | player:1 | 17 | player:19, player:3, player:13 | 16 | 0 | 7 | 56 | 3 | ne |
| 34 | 14 | player:8 | 21 | player:19, player:18, player:13 | 16 | 0 | 5 | 59 | 3 | ne |
| 35 | 14 | player:8 | 23 | player:19, player:13, player:18 | 20 | 5 | 11 | 66 | 3 | ne |
| 36 | 14 | player:8 | 23 | player:19, player:6, player:13 | 20 | 0 | 7 | 62 | 3 | ne |
| 37 | 14 | player:8 | 22 | player:19, player:6, player:13 | 20 | 0 | 8 | 59 | 3 | ne |
| 38 | 13 | player:8 | 23 | player:6, player:18, player:7 | 18 | 0 | 11 | 63 | 3 | ne |
| 39 | 13 | player:8 | 23 | player:6, player:18, player:7 | 19 | 5 | 8 | 54 | 3 | ne |

_Zkráceno: celkem 81 hodinových snapshotů. Plný timeline je v JSON reportu._

## Eliminace
| Hodina | Hráč | Frakce | Strategie | Score | Districts | Bottom 3 | Quiet defer | Neutralizováno | Důvod |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | --- |
| 8 | Nora Pulse | korporace | casual | 451 | 0 | player:16, player:3, player:15 | ne | 0 | málo kontrolovaných districtů a slabá expanze |
| 12 | Ada Crown | tajna-organizace | high-risk-criminal | 77960 | 5 | player:20, player:5, player:3 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 22 | Mara Byte | kartel | high-risk-criminal | 98201 | 6 | player:2, player:15, player:13 | ne | 6 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 26 | Rado Viper | hackeri | aggressive-expander | 61790 | 2 | player:5, player:3, player:15 | ne | 2 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 30 | Erik Signal | soukroma-armada | economy-builder | 106102 | 3 | player:15, player:3, player:13 | ne | 3 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 34 | Kiro Chrome | kult | casual | 108590 | 5 | player:3, player:19, player:18 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 38 | Tibor Ghost | kult | economy-builder | 118165 | 5 | player:19, player:6, player:18 | ne | 5 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 46 | Tessa Flux | motorkarsky-gang | high-risk-criminal | 158194 | 7 | player:6, player:4, player:10 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 50 | Miro Blade | hackeri | high-risk-criminal | 216648 | 7 | player:13, player:12, player:7 | ne | 7 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 54 | Mila Forge | kartel | economy-builder | 248224 | 9 | player:18, player:1, player:7 | ne | 9 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 58 | Viktor Neon | mafian | downtown-rusher | 251360 | 8 | player:1, player:17, player:14 | ne | 8 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |
| 62 | Nika Static | tajna-organizace | aggressive-expander | 350495 | 15 | player:4, player:11, player:17 | ne | 15 | nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity |


## Danger zone a comebacky
- Celkem danger zone appearances: 240
- Comebacky: 24
- Comeback rate: 10%

## Aliance
- Vzniklo: 3
- Rozpadlo se: 1
- Největší aliance: alliance:1 (4 členů)
- Koordinované útoky: 442
- Hráči přeživší v alianci: 5

## Frakce
| Frakce | Hráči | Avg placement | Best | Top 8 | Útoky | Win rate útoků | Heat avg | Comeback rate | Verdikt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| korporace | 2 | 10.5 | 1 | 1 | 57 | 72% | 125.5 | 0% | healthy |
| soukroma-armada | 2 | 9 | 2 | 1 | 106 | 58% | 119.8 | 16% | healthy |
| mafian | 3 | 6.7 | 3 | 2 | 221 | 66% | 1005.2 | 7% | healthy |
| kartel | 3 | 11 | 4 | 1 | 166 | 58% | 576.4 | 7% | healthy |
| tajna-organizace | 3 | 11 | 5 | 1 | 187 | 60% | 505.4 | 9% | healthy |
| motorkarsky-gang | 2 | 9.5 | 6 | 1 | 150 | 65% | 826 | 13% | healthy |
| kult | 3 | 12.3 | 8 | 1 | 178 | 61% | 822 | 12% | healthy |
| hackeri | 2 | 14.5 | 12 | 0 | 101 | 57% | 323.1 | 12% | weak |

## Strategie
| Strategie | Hráči | Avg placement | Top 8 | Win rate | Attack rate | Expansion | Alliance | Downtown success | Comeback | Police raids |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| economy-builder | 4 | 10.5 | 25% | 25% | 53.8 | 39.8 | 1 | 0% | 11% | 9.5 |
| downtown-rusher | 3 | 5.3 | 67% | 0% | 66.7 | 56.7 | 1 | 33% | 13% | 27 |
| diplomat | 2 | 4 | 100% | 0% | 68 | 57 | 1 | 50% | 4% | 14 |
| aggressive-expander | 4 | 10 | 50% | 0% | 85.8 | 67.5 | 0.3 | 25% | 14% | 15.5 |
| high-risk-criminal | 5 | 13.8 | 20% | 0% | 51.4 | 41.2 | 0.2 | 20% | 8% | 3.6 |
| casual | 2 | 17.5 | 0% | 0% | 7.5 | 7 | 0 | 0% | 13% | 0 |

## Útoky a obsazování
- Nejvíc útoků: Rex Harbor (109)
- Nejvíc napadaný hráč approximation: player:11 (119)
- Most contested district: 67
- Downtown útoky: 344
- District ownership churn: 1025

## Výroba a building actions
- Craft actions: 2309
- Building actions: 3143
- Rare building actions: 422

| Building action | Použití |
| --- | ---: |
| evening_course | 389 |
| stabilization_protocol | 229 |
| strip_club_collect_cash | 157 |
| private_party | 147 |
| night_machines | 141 |
| extract_losses | 129 |
| back_cashdesk | 125 |
| restaurant_collect_revenue | 114 |
| vip_night | 114 |
| quiet_backroom | 107 |

## Downtown / rare snowball
- První downtown capture: 65 v hodině 0.58 hráčem player:19
- Max downtown držených jedním hráčem: 6
- Aliance proti downtown leaderovi: 0
- Verdikt: mild but healthy

## Heat / police
- Police raids: 227
- Dirty cash seized: 10412568
- Resource seized approximation: 886
- Highest heat player: player:17 (2085.5)

## Victory / endgame
- Victory reached: ano
- Win reason: final_lockdown_score
- Final Lockdown start/end: 62h -> 80h
- Final Lockdown paused hours: 6
- Attacks during Final Lockdown: 180
- Final Top 3: 1. player:8 (582485), 2. player:7 (520216), 3. player:9 (396279)
- Control victory before Final Lockdown: disabled; old 75% audit milestone: 121/161, reached: ne
- Leader districts at end: 24
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
- Výrobní akce čtou typed Pharmacy/Lab/Factory/Armory recepty, ale Free BR pacing audit zapisuje jednotkový výstup okamžitě; samostatná production-chain simulace prochází skutečný command/tick/collect pipeline.
- Aliance jsou simulační sociální vrstva nad core configem; core alliance command handler zatím není použit jako autoritativní API.
