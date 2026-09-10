# Číselná příloha auditu Empire STREETS — 2026-09-09

Zdroj: lokální snapshot a měření skutečných pravidel. Číst společně s [hlavním auditem](war-balance-2026-09-09.md); příloha sama neposuzuje vyváženost celé hry.

**A. Všech 32 typů budov: základní příjmy a tlak**

Konfigurační základ před frakcí, zónou, dnem/nocí, upgradem a dočasnými akcemi. Nulový pasivní příjem neznamená zbytečnou budovu: může vyrábět materiál, populaci nebo poskytovat obranu. Příjmy jsou za hodinu, heat a vliv za den. Výsledné portfolio je v tabulce F.

| Budova | ID | Clean/h | Dirty/h | Heat/den | Vliv/den | Max. level |
| --- | --- | --- | --- | --- | --- | --- |
| Centrální banka | central_bank | 9 600 | 0 | 144 | 504 | 1 |
| Magistrát | city_hall | 7 800 | 0 | 172,8 | 1 224 | 1 |
| Lobby Club | lobby_club | 5 700 | 0 | 144 | 936 | 1 |
| Burza | stock_exchange | 13 200 | 0 | 259,2 | 648 | 1 |
| Soud | court | 6 300 | 0 | 115,2 | 1 036,8 | 1 |
| VIP Salonek | vip_lounge | 6 300 | 1 800 | 187,2 | 691,2 | 1 |
| Letiště | airport | 10 800 | 2 700 | 288 | 288 | 1 |
| Přístav | port | 1 560 | 510 | 5 | 26 | 5 |
| Parlament | parliament | 1 320 | 180 | 3 | 40 | 5 |
| Obchodní centrum | shopping_mall | 3 700 | 1 320 | 65 | 95 | 1 |
| Restaurace | restaurant | 2 280 | 0 | 57,6 | 172,8 | 1 |
| Herna | arcade | 1 800 | 1 200 | 172,8 | 80 | 1 |
| Kasino | casino | 4 500 | 2 500 | 150 | 110 | 4 |
| Autosalon | car_dealer | 2 145 | 650 | 60 | 24 | 1 |
| Fitness Club | fitness_club | 4 320 | 0 | 57,6 | 0 | 1 |
| Směnárna | exchange | 4 200 | 5 700 | 70 | 60 | 1 |
| Bytový blok | apartment_block | 0 | 0 | 0 | 0 | 1 |
| Rekrutační centrum | recruitment_center | 2 100 | 0 | 100,8 | 0 | 1 |
| Garáž | garage | 2 520 | 0 | 86,4 | 0 | 1 |
| Klinika | clinic | 3 100 | 0 | 85 | 0 | 1 |
| Škola | school | 1 080 | 0 | 0 | 72 | 1 |
| Továrna | factory | 0 | 0 | 3 | 10 | 14 |
| Zbrojovka | armory | 0 | 0 | 4 | 18 | 14 |
| Skladiště | warehouse | 2 700 | 0 | 86,4 | 0 | 4 |
| Energetická stanice | power_station | 2 780 | 780 | 115,2 | 0 | 1 |
| Recyklační centrum | recycling_center | 2 400 | 0 | 115,2 | 0 | 1 |
| Lékárna | pharmacy | 0 | 0 | 3 | 8 | 14 |
| Drug Lab | drug_lab | 0 | 0 | 6 | 20 | 14 |
| Pašovací tunel | smuggling_tunnel | 0 | 3 240 | 100,8 | 0 | 1 |
| Večerka | convenience_store | 1 920 | 1 080 | 72 | 144 | 1 |
| Strip Club | strip_club | 4 500 | 3 900 | 85 | 90 | 1 |
| Pouliční dealeři | street_dealers | 0 | 2 160 | 86,4 | 0 | 1 |

**B. Všech 40 akcí budov: cena, délka, cooldown a statický dopad**

Cooldown je přepočtený základ FREE (×0,8 a zaokrouhlení na tick), před případnou další synergií. Délka označuje konfigurační dobu efektu; některé akce vyplatí okamžitě. Dynamické odměny, audit či náhodné výsledky se řídí specializovaným resolverem a slovním popisem, nikoli jen prázdným outputGain. Vliv se zapisuje samostatně, takže například prázdná peněžní cena nemusí znamenat akci zdarma.

| Budova / akce | Cena | Efekt min | Konfig. CD min | FREE CD min | Statická odměna | Δ heat / vliv | Další pravidlo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Centrální banka: Likviditní injekce (liquidity_injection) | — | 0 | 20 | 16 | — | 4 / -20 | Cena 20 influence, +clean cash, +heat, +Financial Oversight risk |
| Centrální banka: Zmrazené účty (frozen_accounts) | 2 000 cash | 8 | 24 | 19,33 | — | 5 / 0 | Cena 2000 clean cash, ochrana rezerv, horší market fee |
| Centrální banka: Kurzovní intervence (currency_intervention) | 3 000 cash | 8 | 28 | 22,5 | — | 7 / -25 | Cena 3000 clean cash + 25 influence, nižší volatilita materiálů, +heat |
| Magistrát: Úřední krytí (official_cover) | 1 500 cash | 8 | 20 | 16 | — | 2 / -25 | Cena 1500 clean + 25 influence, heat +2, scandal risk +8 % |
| Magistrát: Městská zakázka (city_contract) | — | 0 | 18 | 14,5 | — | 3 / -20 | Cena 20 influence, reward 1500 + legální budovy × 120, heat +3 |
| Magistrát: Nouzová vyhláška (emergency_decree) | 2 500 cash | 6 | 28 | 22,5 | — | 8 / -40 | Cena 2500 clean + 40 influence, heat +8, méně policejních incidentů |
| Lobby Club: Zákulisní tlak (backroom_pressure) | 1 200 cash | 8 | 20 | 16 | — | 3 / -25 | Cena 1200 clean + 25 influence, influence +18 %, influence akce -10 %, heat +3 |
| Lobby Club: Tiché vyjednávání (quiet_negotiation) | 1 500 cash | 0 | 24 | 19,33 | — | 2 / -15 | Cena 1500 clean + 15 influence, cooldown -20 % zbývajícího času, heat +2 |
| Lobby Club: Mediální clona (media_screen) | 2 000 cash | 8 | 26 | 20,83 | — | 4 / 0 | Cena 2000 clean, negativní drby -35 %, police warning +6 %, heat +4 |
| Burza: Spekulativní nákup (speculative_buy) | 750 cash | 0 | 16 | 12,83 | — | 5 / 0 | Cena 750 clean + investice, heat +5, financial inspection risk +6 % |
| Burza: Tržní tlak (market_pressure) | 3 000 cash | 10 | 22 | 17,67 | — | 8 / -15 | Cena 3000 clean + 15 influence, heat +8, market efekt |
| Burza: Vnitřní tipy (insider_window) | 1 500 cash | 6 | 18 | 14,5 | — | 4 / 0 | Cena 1500 clean, heat +4, 3 trend hinty, market poplatek -8 % |
| Letiště: Expresní dovoz (express_import) | 2 000 cash | 0 | 18 | 14,5 | — | 6 / 0 | Cena 2000 clean, heat +6, customs risk 10 % |
| Letiště: Černý charter (black_charter) | 2 500 dirty-cash | 8 | 24 | 19,33 | — | 9 / 0 | Cena 2500 dirty, heat +9, nabídka -6 %, celní zátah při nákupu 15 % |
| Letiště: Evakuační koridor (evacuation_corridor) | 1 800 cash | 7 | 26 | 20,83 | — | 5 / 0 | Cena 1800 clean, heat +5, escape +18 %, ztráty -10 % |
| Přístav: Proříznout kontejner (port_container_cut) | — | 0 | 14 | 11,33 | 160 dirty-cash + 3 metal-parts | 6 / 1 | +dirty cash, +metal parts, +heat |
| Parlament: Politické okno (parliament_policy_window) | — | 0 | 18 | 14,5 | 160 cash | 5 / 5 | +vliv, +clean cash, +heat |
| Restaurace: Vybrat tržby (restaurant_collect_revenue) | — | 0 | 30 | 24 | 869 cash + 550 dirty-cash | 5 / 0 | +869 clean cash, +550 dirty cash, heat +5 |
| Restaurace: Krýt schůzky (restaurant_cover_meetings) | — | 30 | 45 | 36 | — | 4 / 8 | +18 % clean/dirty income, +8 vliv, heat +4 na 30 minut |
| Restaurace: Posílit lokální síť (restaurant_local_network) | — | 30 | 30 | 24 | — | 8 / 4 | +12 % vliv, +4 vliv, heat +8 na 30 minut |
| Herna: Noční automaty (night_machines) | — | 7 | 16 | 12,83 | — | 0 / 0 | +clean income, +dirty income, +vliv, +heat, +audit risk na 7 minut |
| Herna: Zadní pokladna (back_cashdesk) | — | 0 | 16 | 12,83 | — | 3 / 1 | -dirty cash, +clean cash po 15 % poplatku, +heat, +vliv, +audit risk |
| Kasino: Tichá herna (quiet_backroom) | — | 0 | 14 | 11,33 | — | 7 / 3 | -dirty cash, +clean cash po 9 % poplatku, +heat, +vliv, +audit risk |
| Kasino: VIP noc (vip_night) | — | 10 | 26 | 20,83 | — | 0 / 0 | +clean income, +dirty income, +vliv, +heat, +audit risk na 10 minut |
| Kasino: Podplacený inspektor (bribed_inspector) | 6 500 cash | 30 | 75 | 60 | — | 0 / 0 | Cena 6500 clean cash, šance selhání 14 %, heat -15 při úspěchu, audit control |
| Směnárna: Výhodný kurz (good_rate) | — | 0 | 18 | 14,5 | — | 12 / 3 | -dirty cash, +clean cash po 12 % poplatku, heat +12, vliv +3, +audit risk |
| Bytový blok: Vybrat obyvatele (collect_population) | — | 0 | 0 | 0 | — | 0 / 0 | +populace, bez heatu a bez peněz |
| Klinika: Stabilizační protokol (stabilization_protocol) | 1 200 cash | 0 | 18 | 14,5 | — | 1 / 0 | recovery pool, cena 1200 clean, +1 heat |
| Škola: Večerní kurz (evening_course) | 1 000 cash | 20 | 35 | 28 | — | 0 / 0 | Cena 1000 clean cash, +60 % nábor členů na 20 minut |
| Škola: Vybrat obyvatele (collect_school_population) | — | 0 | 0 | 0 | — | 0 / 0 | +populace, bez heatu a bez peněz |
| Energetická stanice: Přepnutí na záložní síť (backup_grid_switch) | 3 500 cash | 25 | 60 | 48 | — | 3 / 0 | Cena 3500 clean cash, +12 % infrastruktura, +20 % kamery, +20 % alarm, heat +3 na 25 minut |
| Energetická stanice: Prodat přebytek (power_station_feed_production) | — | 0 | 60 | 48 | 2 000 cash + 500 dirty-cash | 10 / 0 | +2000 clean cash, +500 dirty cash, heat +10 |
| Energetická stanice: Snížit heat (power_station_reduce_heat) | 10 000 cash | 0 | 60 | 48 | — | -20 / 0 | Cena 10000 clean cash, heat -20, cooldown 60 minut |
| Recyklační centrum: Vytěžit ztráty (extract_losses) | 900 cash | 0 | 16 | 12,83 | — | 2 / 0 | Cena 900 clean cash, návrat itemů podle sítě Recyklačních center, heat +2 |
| Pašovací tunel: Otevřít kanál (open_channel) | 1 800 cash | 15 | 30 | 24 | — | 5 / 0 | Cena 1800 clean cash, heat +5, +45 % dirty tok tunelů, rychlejší prodej a vyšší riziko incidentu |
| Večerka: Vybrat obyvatele (collect_convenience_store_population) | — | 0 | 0 | 0 | — | 0 / 0 | +populace, bez heatu a bez peněz |
| Strip Club: Vybrat cash (strip_club_collect_cash) | — | 0 | 10 | 8 | 360 dirty-cash | 3 / 0 | +360 dirty cash, heat +3 |
| Strip Club: Hostit VIP klienty (vip_lounge) | 800 cash | 30 | 60 | 48 | — | 0 / 0 | Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 30 minut |
| Strip Club: Soukromá party (private_party) | 1 500 cash | 10 | 30 | 24 | — | 6 / 8 | Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 % |
| Pouliční dealeři: Prodat zásobu (start_drug_sale) | — | 0 | 0 | 0 | — | 0 / 0 | dirty cash, heat, pouliční riziko |

**C. Všech 21 výrobních receptů a plné pořizovací náklady**

Plná cena zahrnuje rekurzivně spotřebované suroviny za výrobní ceny, bez tržní marže a bez ceny čekání. Denní/noční časy jsou skutečným výpočtem pro měřené portfolio, nikoli univerzální čas pro každou frakci a akci. Naplnění předpokládá dostatek zaplacených vstupů a kontinuální běh bez ručního výběru.

| Produkt | Budova | Plná cena | Vstupy | Výstup / fronta | Den / noc s | Naplnění L1 min | Naplnění L14 min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chemicals | Lékárna | 360 | — | 60 / 63 | 110 / 130 | 110 | 50 |
| biomass | Lékárna | 420 | — | 60 / 63 | 220 / 250 | 220 | 100 |
| stim-pack | Lékárna | 800 | — | 24 / 27 | 550 / 610 | 220 | 96 |
| neon-dust | Drug Lab | 1 220 | 2 chemicals | 60 / 63 | 340 / 250 | 340 | 150 |
| pulse-shot | Drug Lab | 1 940 | 2 chemicals + 1 biomass | 24 / 27 | 540 / 400 | 216 | 96 |
| velvet-smoke | Drug Lab | 2 100 | 1 chemicals + 2 biomass | 24 / 27 | 1000 / 750 | 400 | 176 |
| ghost-serum | Drug Lab | 6 880 | 2 neon-dust + 1 pulse-shot | 8 / 11 | 1340 / 1000 | 178,67 | 77,33 |
| overdrive-x | Drug Lab | 10 640 | 1 pulse-shot + 2 velvet-smoke | 8 / 11 | 2000 / 1500 | 266,67 | 116 |
| metal-parts | Továrna | 300 | — | 60 / 63 | 220 / 250 | 220 | 100 |
| tech-core | Továrna | 2 100 | 4 metal-parts | 24 / 27 | 440 / 490 | 176 | 76 |
| combat-module | Továrna | 7 900 | 4 metal-parts + 2 tech-core | 8 / 11 | 820 / 920 | 109,33 | 48 |
| baseball-bat | Zbrojovka | 600 | 2 metal-parts | 60 / 63 | 200 / 150 | 200 | 90 |
| pistol | Zbrojovka | 3 000 | 3 metal-parts + 1 tech-core | 24 / 27 | 340 / 240 | 136 | 60 |
| grenade | Zbrojovka | 2 700 | 2 metal-parts + 1 tech-core | 24 / 27 | 400 / 290 | 160 | 72 |
| smg | Zbrojovka | 8 500 | 2 metal-parts + 1 combat-module | 8 / 11 | 540 / 390 | 72 | 32 |
| bazooka | Zbrojovka | 16 700 | 3 metal-parts + 2 combat-module | 8 / 11 | 940 / 670 | 125,33 | 54,67 |
| vest | Zbrojovka | 3 000 | 3 metal-parts + 1 tech-core | 24 / 27 | 340 / 240 | 136 | 60 |
| barricades | Zbrojovka | 1 200 | 4 metal-parts | 60 / 63 | 340 / 240 | 340 | 150 |
| cameras | Zbrojovka | 4 800 | 2 metal-parts + 2 tech-core | 24 / 27 | 400 / 290 | 160 | 72 |
| defense-tower | Zbrojovka | 22 100 | 3 tech-core + 2 combat-module | 8 / 11 | 1000 / 720 | 133,33 | 58,67 |
| alarm | Zbrojovka | 2 700 | 2 metal-parts + 1 tech-core | 24 / 27 | 340 / 240 | 136 | 60 |

**D. Upgrade výrobních budov**

Cena je jednotlivý upgrade na uvedenou úroveň; součet zahrnuje i mezilehlé úrovně, které tabulka kvůli délce nezobrazuje. Rychlost je vlastní levelový násobitel, další efekty se skládají nad ním.

| Budova | Cílový level | Násobitel rychlosti | Cena kroku | Součet od L1 |
| --- | --- | --- | --- | --- |
| Lékárna | 2 | 1,1 | 3 200 | 3 200 |
| Lékárna | 3 | 1,2 | 4 544 | 7 744 |
| Lékárna | 4 | 1,3 | 6 452 | 14 196 |
| Lékárna | 5 | 1,4 | 9 163 | 23 359 |
| Lékárna | 6 | 1,5 | 13 011 | 36 370 |
| Lékárna | 8 | 1,7 | 26 235 | 81 080 |
| Lékárna | 10 | 1,9 | 52 900 | 171 234 |
| Lékárna | 12 | 2,1 | 106 668 | 353 020 |
| Lékárna | 14 | 2,3 | 215 085 | 719 573 |
| Drug Lab | 2 | 1,1 | 4 200 | 4 200 |
| Drug Lab | 3 | 1,2 | 5 964 | 10 164 |
| Drug Lab | 4 | 1,3 | 8 469 | 18 633 |
| Drug Lab | 5 | 1,4 | 12 026 | 30 659 |
| Drug Lab | 6 | 1,5 | 17 077 | 47 736 |
| Drug Lab | 8 | 1,7 | 34 433 | 106 418 |
| Drug Lab | 10 | 1,9 | 69 431 | 224 744 |
| Drug Lab | 12 | 2,1 | 140 002 | 463 339 |
| Drug Lab | 14 | 2,3 | 282 299 | 944 440 |
| Továrna | 2 | 1,1 | 5 000 | 5 000 |
| Továrna | 3 | 1,2 | 7 400 | 12 400 |
| Továrna | 4 | 1,3 | 10 800 | 23 200 |
| Továrna | 5 | 1,4 | 15 900 | 39 100 |
| Továrna | 6 | 1,5 | 23 300 | 62 400 |
| Továrna | 8 | 1,7 | 50 500 | 147 200 |
| Továrna | 10 | 1,9 | 109 000 | 330 400 |
| Továrna | 12 | 2,1 | 235 600 | 726 300 |
| Továrna | 14 | 2,3 | 509 100 | 1 581 700 |
| Zbrojovka | 2 | 1,1 | 5 200 | 5 200 |
| Zbrojovka | 3 | 1,2 | 7 384 | 12 584 |
| Zbrojovka | 4 | 1,3 | 10 485 | 23 069 |
| Zbrojovka | 5 | 1,4 | 14 889 | 37 958 |
| Zbrojovka | 6 | 1,5 | 21 143 | 59 101 |
| Zbrojovka | 8 | 1,7 | 42 632 | 131 755 |
| Zbrojovka | 10 | 1,9 | 85 963 | 278 255 |
| Zbrojovka | 12 | 2,1 | 173 335 | 573 657 |
| Zbrojovka | 14 | 2,3 | 349 513 | 1 169 306 |

**E. Globální sklad**

Skupina určuje limit každého jednotlivého produktu, nikoli společnou zásobu všech položek ve skupině. Lokální výstup u výrobní budovy a zaplacená fronta jsou odlišné kontejnery. Řádky s nulou skladových budov ukazují základ bez budovy; level v nich nemá vliv.

| Počet skladových budov | Level | Základní | Taktické | Strategické |
| --- | --- | --- | --- | --- |
| 0 | 1 | 60 | 24 | 8 |
| 0 | 2 | 60 | 24 | 8 |
| 0 | 3 | 60 | 24 | 8 |
| 0 | 4 | 60 | 24 | 8 |
| 1 | 1 | 90 | 36 | 12 |
| 1 | 2 | 101 | 41 | 14 |
| 1 | 3 | 113 | 45 | 15 |
| 1 | 4 | 126 | 51 | 17 |
| 2 | 1 | 96 | 39 | 13 |
| 2 | 2 | 108 | 44 | 15 |
| 2 | 3 | 120 | 48 | 16 |
| 2 | 4 | 135 | 54 | 18 |
| 3 | 1 | 102 | 41 | 14 |
| 3 | 2 | 115 | 46 | 16 |
| 3 | 3 | 128 | 51 | 17 |
| 3 | 4 | 143 | 58 | 20 |
| 5 | 1 | 114 | 46 | 16 |
| 5 | 2 | 128 | 52 | 18 |
| 5 | 3 | 143 | 57 | 19 |
| 5 | 4 | 160 | 64 | 22 |

**F. Ekonomická portfolia po započtení modifikátorů**

Reálné izolované výpočty pro konkrétní sady districtů bez lidského obchodování. Průměr je aritmetický průměr naměřené denní a noční sazby; není to celkový příjem pro libovolný kalendář a aktivitu. Heat zde vyjadřuje přírůstek districtového tlaku za hodinu, ne neomezený přímý přírůstek osobního HEAT.

| Start / počet districtů | District ID | Clean/h průměr | Dirty/h průměr | District heat/h | Vliv/h | Populace/h a zásobník |
| --- | --- | --- | --- | --- | --- | --- |
| residential / 1 | district:160 | 3 409,56 | 0 | 6,06 | 2,33 | Bytový blok: 120/h, max 180 |
| residential / 3 | district:160, district:137, district:114 | 9 422,16 | 4 179,6 | 21,08 | 8,75 | Bytový blok: 120/h, max 180; Večerka: 50/h, max 100 |
| residential / 5 | district:160, district:137, district:114, district:113, district:112 | 22 165,44 | 12 867 | 37,1 | 24,15 | Bytový blok: 120/h, max 180; Večerka: 50/h, max 100 |
| residential / 10 | district:160, district:137, district:114, district:113, district:112, district:111, district:110, district:109, district:108, district:107 | 53 778,12 | 27 881,4 | 71,62 | 54,92 | Bytový blok: 127,2/h, max 194; Večerka: 55/h, max 100; Večerka: 55/h, max 100; Bytový blok: 127,2/h, max 194 |
| park / 1 | district:145 | 2 686,2 | 4 179,6 | 10,06 | 8,33 | Večerka: 50/h, max 100 |
| park / 3 | district:145, district:121, district:120 | 15 023,58 | 4 179,6 | 19,96 | 15,92 | Večerka: 50/h, max 100 |
| park / 5 | district:145, district:121, district:120, district:119, district:118 | 22 102,08 | 10 647,6 | 39,94 | 15,92 | Večerka: 50/h, max 100 |
| park / 10 | district:145, district:121, district:120, district:119, district:118, district:117, district:116, district:122, district:123, district:100 | 50 604,84 | 28 355,4 | 81 | 38,37 | Večerka: 55/h, max 100; Bytový blok: 134,83/h, max 209; Večerka: 55/h, max 100; Bytový blok: 134,83/h, max 209 |

**G. Všech 41 způsobilých startů v měřeném osazení**

Tato tabulka zachovává rozdíly mapy. Povolený typ districtu ještě neznamená, že právě není obsazen, rezervován nebo vyloučen pravidly vzdálenosti. Pět parkových startů nemá pasivní clean příjem; to je otevřený problém férovosti a informovaného výběru, ne opravená vlastnost.

| District | Zóna | Civilní budovy | Clean/h průměr | Dirty/h průměr | Vliv/h | Populace/h |
| --- | --- | --- | --- | --- | --- | --- |
| district:2 | park | Strip Club, Večerka | 7 141,2 | 5 488,2 | 12,46 | 50 |
| district:4 | residential | Bytový blok, Herna, Garáž | 5 844,96 | 1 512 | 5,67 | 120 |
| district:19 | residential | Bytový blok, Herna | 2 435,4 | 1 512 | 5,67 | 120 |
| district:20 | park | Strip Club, Večerka | 7 141,2 | 5 488,2 | 12,46 | 50 |
| district:22 | residential | Bytový blok, Rekrutační centrum | 2 772 | 0 | 2,33 | 123,6 |
| district:24 | residential | Bytový blok, Herna | 2 435,4 | 1 512 | 5,67 | 120 |
| district:27 | park | Pouliční dealeři, Pašovací tunel | 0 | 6 216 | 2,33 | 0 |
| district:28 | residential | Bytový blok, Herna | 2 435,4 | 1 512 | 5,67 | 120 |
| district:44 | residential | Bytový blok, Rekrutační centrum | 2 772 | 0 | 2,33 | 123,6 |
| district:45 | park | Pouliční dealeři, Pašovací tunel | 0 | 6 216 | 2,33 | 0 |
| district:47 | park | Pouliční dealeři, Pašovací tunel | 0 | 6 216 | 2,33 | 0 |
| district:49 | residential | Bytový blok, Herna, Klinika | 6 527,4 | 1 512 | 5,67 | 120 |
| district:65 | residential | Rekrutační centrum, Klinika | 6 864 | 0 | 2,33 | 0 |
| district:66 | park | Strip Club, Pouliční dealeři | 4 455 | 6 881,4 | 6,46 | 0 |
| district:69 | residential | Bytový blok, Herna | 2 435,4 | 1 512 | 5,67 | 120 |
| district:71 | residential | Rekrutační centrum, Klinika | 6 864 | 0 | 2,33 | 0 |
| district:72 | park | Strip Club, Pouliční dealeři | 4 455 | 6 881,4 | 6,46 | 0 |
| district:74 | residential | Bytový blok, Rekrutační centrum, Klinika | 6 864 | 0 | 2,33 | 123,6 |
| district:88 | residential | Bytový blok, Garáž, Klinika | 7 501,56 | 0 | 2,33 | 120 |
| district:90 | residential | Herna, Škola | 3 825,36 | 1 512 | 8,67 | 39,6 |
| district:91 | park | Večerka | 2 686,2 | 1 393,2 | 8,33 | 50 |
| district:96 | residential | Herna, Škola | 3 825,36 | 1 512 | 8,67 | 39,6 |
| district:97 | park | Strip Club, Pašovací tunel | 4 455 | 7 497 | 6,46 | 0 |
| district:112 | park | Strip Club, Pouliční dealeři | 4 455 | 6 881,4 | 6,46 | 0 |
| district:115 | residential | Bytový blok, Herna | 2 435,4 | 1 512 | 5,67 | 120 |
| district:116 | park | Strip Club, Večerka | 7 141,2 | 5 488,2 | 12,46 | 50 |
| district:117 | residential | Bytový blok, Rekrutační centrum | 2 772 | 0 | 2,33 | 123,6 |
| district:118 | park | Pouliční dealeři, Pašovací tunel | 0 | 6 216 | 2,33 | 0 |
| district:135 | residential | Bytový blok, Garáž | 3 409,56 | 0 | 2,33 | 120 |
| district:137 | park | Pouliční dealeři, Večerka | 2 686,2 | 4 179,6 | 8,33 | 50 |
| district:141 | park | Pouliční dealeři, Večerka | 2 686,2 | 4 179,6 | 8,33 | 50 |
| district:142 | residential | Bytový blok, Herna, Garáž | 5 844,96 | 1 512 | 5,67 | 120 |
| district:143 | park | Pouliční dealeři, Večerka | 2 686,2 | 4 179,6 | 8,33 | 50 |
| district:145 | park | Pouliční dealeři, Večerka | 2 686,2 | 4 179,6 | 8,33 | 50 |
| district:147 | residential | Bytový blok, Garáž | 3 409,56 | 0 | 2,33 | 120 |
| district:150 | park | Pašovací tunel, Večerka | 2 686,2 | 4 795,2 | 8,33 | 50 |
| district:151 | residential | Bytový blok, Rekrutační centrum | 2 772 | 0 | 2,33 | 123,6 |
| district:154 | residential | Bytový blok, Herna, Garáž | 5 844,96 | 1 512 | 5,67 | 120 |
| district:156 | park | Pouliční dealeři, Pašovací tunel | 0 | 6 216 | 2,33 | 0 |
| district:158 | park | Pouliční dealeři, Večerka | 2 686,2 | 4 179,6 | 8,33 | 50 |
| district:160 | residential | Bytový blok, Garáž | 3 409,56 | 0 | 2,33 | 120 |

**H. Frakce: pasiva a stav zvláštních schopností**

Limit čtyř se týká každé frakce. Speciální frakční schopnosti označené preview jsou návrh v katalogu, nikoli funkční klikací schopnost. Tabulka nepřidává frakcím nové bonusy.

| Frakce | Pasiva | Specializace | Zvláštní schopnost / stav |
| --- | --- | --- | --- |
| Mafián | Čistý příjem +10 %; -4 % heat z útoků, loupeží, akcí budov a pasivního tlaku; Špehování -3 p. b. | Economy / clean cash / influence / heat control mimo obsazování | Tichá dohoda: preview |
| Kartel | +18 % špinavý příjem; +15 % produkce v podporovaných ilegálních budovách; +10 % pašování; +15 % heat z ilegálních akcí; -8 % čistý příjem; -5 % síla obrany | Dirty cash / illegal production / drugs / smuggling / high risk economy | Noční zásilka: preview |
| Kult | +20 % zisk vlivu; +10 % tvorba populace; +10 % síla obrany; -10 % čistý příjem; -5 % síla útoku | Influence / population / defense / manipulation / city feed chaos | Masová posedlost: preview |
| Tajná organizace | +15 % šance na úspěšné špehování; +15 % šance odhalit pasti; +10 % pravdivost potvrzených drbů; -10 % síla útoku; -8 % čistý příjem; -8 % špinavý příjem | Spying / infiltration / traps / secret actions / false information / low heat | Spící buňka: preview |
| Hackeři | +50 % pravdivost potvrzených drbů; +15 % účinnost kamer; +15 % účinnost alarmů; +10 % produkce technologií; +10 % šance na úspěšné špehování; -8 % síla útoku; -8 % špinavý příjem; -5 % základní obrana bez kamer a alarmů | Tech / confirmed rumors / cameras / alarms / spying / digital sabotage | Výpadek systému: preview |
| Motorkářský gang | -15 % doba čekání na vykrádání; -10 % doba čekání na útoky; -10 % doba čekání na obsazování; +10 % špinavé peníze z vykrádání; -10 % obrana districtů; +8 % heat z útoků, obsazování a vykrádání | Speed / robbery / attacks / pressure / dirty cash | Bleskový nájezd: preview |
| Soukromá armáda | +12 % síla útoku; +12 % síla obrany; -10 % ztráty vybavení v boji; +8 % heat z útoků a obsazování; -8 % čistý příjem | Combat / defense / occupation / territory control / expensive operations | Taktické nasazení: preview |
| Korporát | +15 % čistý příjem; -3 % heat z útoků, loupeží, akcí budov a pasivního tlaku; +10 % efekt obranných systémů; -15 % špinavý příjem; -10 % kořist z vykrádání; +10 % délka útoků | Clean economy / legal cover / defense systems / market efficiency / safer growth | Právní štít: preview |

**I. Citlivost výroby na frekvenci kontroly**

Horní odhad kusů za hodinu při pravidelném kompletním výběru, L1. Nezahrnuje čas na dovoz vstupů, nedostatek peněz, policejní blokace ani přepínání receptů. Ukazuje zejména ztrátu kapacity při dlouhé nepřítomnosti.

| Produkt | Kontrola 15 min | 60 min | 120 min | 360 min | 480 min |
| --- | --- | --- | --- | --- | --- |
| chemicals | 32 | 32 | 30 | 10 | 7,5 |
| biomass | 16 | 16 | 16 | 10 | 7,5 |
| stim-pack | 4 | 6 | 6,5 | 4 | 3 |
| neon-dust | 8 | 10 | 10,5 | 10 | 7,5 |
| pulse-shot | 4 | 6 | 6,5 | 4 | 3 |
| velvet-smoke | 0 | 3 | 3,5 | 3,5 | 3 |
| ghost-serum | 0 | 2 | 2,5 | 1,33 | 1 |
| overdrive-x | 0 | 1 | 1,5 | 1,33 | 1 |
| metal-parts | 16 | 16 | 16 | 10 | 7,5 |
| tech-core | 8 | 8 | 8 | 4 | 3 |
| combat-module | 4 | 4 | 4 | 1,33 | 1 |
| baseball-bat | 16 | 18 | 18 | 10 | 7,5 |
| pistol | 8 | 10 | 10,5 | 4 | 3 |
| grenade | 8 | 9 | 9 | 4 | 3 |
| smg | 4 | 6 | 4 | 1,33 | 1 |
| bazooka | 0 | 3 | 3,5 | 1,33 | 1 |
| vest | 8 | 10 | 10,5 | 4 | 3 |
| barricades | 8 | 10 | 10,5 | 10 | 7,5 |
| cameras | 8 | 9 | 9 | 4 | 3 |
| defense-tower | 0 | 3 | 3,5 | 1,33 | 1 |
| alarm | 8 | 10 | 10,5 | 4 | 3 |

**J. Celý katalog 300 questů: finanční očekávání a riziko**

Matematický odhad z definic, nikoli 300 odehraných questů. Finanční EV počítá clean a výrobní hodnotu surovin; dirty cash má váhu 0,7. Vliv a informace nejsou převáděny na peníze. EV/h slouží k porovnání jedné akce, nikoli k tvrzení o nepřetržitém příjmu: nabídky, strategické limity, dostupnost a souběh jej omezují. Záporné EV u informačního questu samo nedokazuje chybu.

| Quest | Agent | Obtížnost | Min | Úspěch % | Hodnota odměny | EV peněz | EV/h | EV vlivu | EV heat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| victor_01 | victor | medium | 18 | 82 | 2 200 | 1 778,8 | 5 929,33 | 1,64 | 2,72 |
| victor_02 | victor | medium | 21 | 78 | 1 400 | 1 061,2 | 3 032 | 3,12 | 2,88 |
| victor_03 | victor | medium | 20 | 80 | 1 700 | 1 332 | 3 996 | 0 | 2,8 |
| victor_04 | victor | medium | 21 | 74 | 1 120 | 792,4 | 2 264 | 2,22 | 3,04 |
| victor_05 | victor | medium | 21 | 73 | 900 | 619,2 | 1 769,14 | 2,19 | 3,08 |
| victor_06 | victor | medium | 19 | 76 | 900 | 650,4 | 2 053,89 | 1,52 | 2,96 |
| victor_07 | victor | medium | 17 | 84 | 700 | 565,6 | 1 996,24 | 5,04 | 2,64 |
| victor_08 | victor | medium | 16 | 77 | 600 | 429,8 | 1 611,75 | 1,54 | 2,92 |
| victor_09 | victor | medium | 15 | 83 | 500 | 391,2 | 1 564,8 | 0 | 2,68 |
| victor_10 | victor | hard | 28 | 70 | 630 | 357 | 765 | 4,9 | 5,8 |
| victor_11 | victor | easy | 14 | 86 | 750 | 645 | 2 764,29 | 2,58 | 1,28 |
| victor_12 | victor | hard | 26 | 68 | 600 | 318,4 | 734,77 | 2,04 | 5,92 |
| victor_13 | victor | medium | 18 | 79 | 850 | 642,1 | 2 140,33 | 1,58 | 2,84 |
| victor_14 | victor | hard | 27 | 66 | 2 000 | 1 224,8 | 2 721,78 | 0 | 6,04 |
| victor_15 | victor | hard | 30 | 72 | 1 000 | 641,6 | 1 283,2 | 5,76 | 5,68 |
| victor_16 | victor | medium | 21 | 75 | 1 500 | 1 090 | 3 114,29 | 0 | 3 |
| victor_17 | victor | medium | 21 | 74 | 770 | 533,4 | 1 524 | 4,44 | 3,04 |
| victor_18 | victor | medium | 19 | 81 | 2 200 | 1 755,4 | 5 543,37 | 0 | 2,76 |
| victor_19 | victor | hard | 24 | 64 | 900 | 475,2 | 1 188 | 5,12 | 6,16 |
| victor_20 | victor | hard | 22 | 71 | 1 540 | 1 012,2 | 2 760,55 | 1,42 | 5,74 |
| victor_21 | victor | medium | 20 | 79 | 1 600 | 1 234,6 | 3 703,8 | 3,16 | 2,84 |
| victor_22 | victor | medium | 18 | 76 | 1 600 | 1 182,4 | 3 941,33 | 0 | 2,96 |
| victor_23 | victor | medium | 16 | 85 | 500 | 404 | 1 515 | 5,1 | 2,6 |
| victor_24 | victor | medium | 15 | 84 | 500 | 397,6 | 1 590,4 | 1,68 | 2,64 |
| victor_25 | victor | medium | 19 | 73 | 840 | 575,4 | 1 817,05 | 3,65 | 3,08 |
| victor_26 | victor | easy | 12 | 88 | 1 200 | 1 056 | 5 280 | 0 | 1,24 |
| victor_27 | victor | medium | 17 | 80 | 800 | 612 | 2 160 | 4,8 | 2,8 |
| victor_28 | victor | medium | 15 | 77 | 600 | 429,8 | 1 719,2 | 0 | 2,92 |
| victor_29 | victor | hard | 23 | 69 | 0 | -86,8 | -226,43 | 2,07 | 5,86 |
| victor_30 | victor | medium | 20 | 78 | 1 300 | 983,2 | 2 949,6 | 4,68 | 2,88 |
| victor_31 | victor | medium | 16 | 82 | 350 | 261,8 | 981,75 | 0 | 2,72 |
| victor_32 | victor | hard | 22 | 72 | 1 190 | 778,4 | 2 122,91 | 4,32 | 5,68 |
| victor_33 | victor | hard | 22 | 67 | 600 | 309,6 | 844,36 | 5,36 | 5,98 |
| victor_34 | victor | medium | 15 | 85 | 1 480 | 1 237 | 4 948 | 0 | 2,6 |
| victor_35 | victor | medium | 21 | 74 | 700 | 481,6 | 1 376 | 0 | 3,04 |
| victor_36 | victor | hard | 25 | 68 | 1 330 | 814,8 | 1 955,52 | 2,04 | 5,92 |
| victor_37 | victor | medium | 18 | 80 | 2 200 | 1 732 | 5 773,33 | 1,6 | 2,8 |
| victor_38 | victor | hard | 22 | 71 | 500 | 273,8 | 746,73 | 2,13 | 5,74 |
| victor_39 | victor | medium | 21 | 77 | 1 600 | 1 199,8 | 3 428 | 3,08 | 2,92 |
| victor_40 | victor | medium | 15 | 83 | 400 | 308,2 | 1 232,8 | 4,98 | 2,68 |
| victor_41 | victor | rare | 30 | 58 | 8 250 | 4 608,6 | 9 217,2 | 0 | 8,52 |
| victor_42 | victor | medium | 18 | 79 | 2 200 | 1 708,6 | 5 695,33 | 1,58 | 2,84 |
| victor_43 | victor | medium | 15 | 84 | 500 | 397,6 | 1 590,4 | 1,68 | 2,64 |
| victor_44 | victor | medium | 17 | 81 | 1 120 | 880,6 | 3 108 | 2,43 | 2,76 |
| victor_45 | victor | easy | 13 | 87 | 600 | 522 | 2 409,23 | 1,74 | 1,26 |
| victor_46 | victor | rare | 26 | 60 | 9 060 | 5 268 | 12 156,92 | 0 | 8,4 |
| victor_47 | victor | medium | 15 | 85 | 400 | 319 | 1 276 | 0 | 2,6 |
| victor_48 | victor | medium | 19 | 73 | 1 400 | 984,2 | 3 108 | 0 | 3,08 |
| victor_49 | victor | hard | 22 | 69 | 3 900 | 2 604,2 | 7 102,36 | 5,52 | 5,86 |
| victor_50 | victor | hard | 29 | 63 | 980 | 513,8 | 1 063,03 | 5,04 | 6,22 |
| victor_51 | victor | medium | 19 | 79 | 2 200 | 1 708,6 | 5 395,58 | 2,37 | 2,84 |
| victor_52 | victor | medium | 21 | 75 | 700 | 490 | 1 400 | 4,5 | 3 |
| victor_53 | victor | medium | 18 | 81 | 1 900 | 1 512,4 | 5 041,33 | 0 | 2,76 |
| victor_54 | victor | medium | 17 | 77 | 800 | 583,8 | 2 060,47 | 1,54 | 2,92 |
| victor_55 | victor | medium | 15 | 84 | 900 | 733,6 | 2 934,4 | 5,04 | 2,64 |
| victor_56 | victor | medium | 16 | 80 | 1 120 | 868 | 3 255 | 1,6 | 2,8 |
| victor_57 | victor | medium | 15 | 85 | 600 | 489 | 1 956 | 1,7 | 2,6 |
| victor_58 | victor | hard | 22 | 72 | 490 | 274,4 | 748,36 | 5,76 | 5,68 |
| victor_59 | victor | medium | 18 | 78 | 1 468,2 | 1 114,4 | 3 714,65 | 0 | 2,88 |
| victor_60 | victor | medium | 19 | 79 | 2 200 | 1 708,6 | 5 395,58 | 0 | 2,84 |
| victor_61 | victor | hard | 23 | 68 | 1 000 | 590,4 | 1 540,17 | 5,44 | 5,92 |
| victor_62 | victor | easy | 13 | 86 | 500 | 430 | 1 984,62 | 1,72 | 1,28 |
| victor_63 | victor | medium | 17 | 80 | 1 500 | 1 172 | 4 136,47 | 4 | 2,8 |
| victor_64 | victor | medium | 16 | 76 | 900 | 650,4 | 2 439 | 0 | 2,96 |
| victor_65 | victor | medium | 15 | 83 | 400 | 308,2 | 1 232,8 | 2,49 | 2,68 |
| victor_66 | victor | hard | 22 | 69 | 630 | 347,9 | 948,82 | 5,52 | 5,86 |
| victor_67 | victor | medium | 18 | 81 | 500 | 378,4 | 1 261,33 | 0 | 2,76 |
| victor_68 | victor | medium | 20 | 74 | 1 120 | 792,4 | 2 377,2 | 2,22 | 3,04 |
| victor_69 | victor | medium | 15 | 78 | 700 | 515,2 | 2 060,8 | 1,56 | 2,88 |
| victor_70 | victor | medium | 15 | 85 | 2 200 | 1 849 | 7 396 | 0 | 2,6 |
| victor_71 | victor | medium | 19 | 76 | 900 | 650,4 | 2 053,89 | 4,56 | 2,96 |
| victor_72 | victor | medium | 18 | 80 | 600 | 452 | 1 506,67 | 0 | 2,8 |
| victor_73 | victor | medium | 17 | 79 | 1 050 | 800,1 | 2 823,88 | 3,16 | 2,84 |
| victor_74 | victor | hard | 22 | 67 | 800 | 443,6 | 1 209,82 | 5,36 | 5,98 |
| victor_75 | victor | medium | 16 | 82 | 1 492,5 | 1 198,65 | 4 494,94 | 2,46 | 2,72 |
| victor_76 | victor | medium | 19 | 73 | 600 | 400,2 | 1 263,79 | 0 | 3,08 |
| victor_77 | victor | hard | 22 | 71 | 600 | 344,8 | 940,36 | 2,13 | 5,74 |
| victor_78 | victor | medium | 15 | 81 | 700 | 540,4 | 2 161,6 | 4,86 | 2,76 |
| victor_79 | victor | hard | 22 | 72 | 2 500 | 1 721,6 | 4 695,27 | 1,44 | 5,68 |
| victor_80 | victor | medium | 18 | 75 | 1 600 | 1 165 | 3 883,33 | 3 | 3 |
| victor_81 | victor | medium | 15 | 84 | 2 200 | 1 825,6 | 7 302,4 | 0 | 2,64 |
| victor_82 | victor | medium | 17 | 74 | 560 | 378 | 1 334,12 | 4,44 | 3,04 |
| victor_83 | victor | medium | 16 | 80 | 600 | 452 | 1 695 | 1,6 | 2,8 |
| victor_84 | victor | medium | 18 | 79 | 1 200 | 918,6 | 3 062 | 1,58 | 2,84 |
| victor_85 | victor | hard | 22 | 66 | 700 | 366,8 | 1 000,36 | 5,28 | 6,04 |
| victor_86 | victor | medium | 17 | 81 | 1 233,3 | 972,37 | 3 431,9 | 1,62 | 2,76 |
| victor_87 | victor | medium | 15 | 77 | 350 | 237,3 | 949,2 | 0 | 2,92 |
| victor_88 | victor | medium | 18 | 73 | 800 | 546,2 | 1 820,67 | 4,38 | 3,08 |
| victor_89 | victor | medium | 16 | 82 | 500 | 384,8 | 1 443 | 1,64 | 2,72 |
| victor_90 | victor | hard | 23 | 70 | 1 330 | 847 | 2 209,57 | 2,8 | 5,8 |
| victor_91 | victor | medium | 16 | 80 | 1 400 | 1 092 | 4 095 | 2,4 | 2,8 |
| victor_92 | victor | medium | 19 | 75 | 630 | 437,5 | 1 381,58 | 4,5 | 3 |
| victor_93 | victor | hard | 24 | 65 | 600 | 292 | 730 | 1,95 | 6,1 |
| victor_94 | victor | medium | 18 | 81 | 2 200 | 1 755,4 | 5 851,33 | 0 | 2,76 |
| victor_95 | victor | hard | 22 | 68 | 900 | 522,4 | 1 424,73 | 5,44 | 5,92 |
| victor_96 | victor | hard | 22 | 72 | 1 470 | 980 | 2 672,73 | 2,16 | 5,68 |
| victor_97 | victor | medium | 17 | 82 | 2 200 | 1 778,8 | 6 278,12 | 1,64 | 2,72 |
| victor_98 | victor | medium | 18 | 76 | 1 500 | 1 106,4 | 3 688 | 3,8 | 2,96 |
| victor_99 | victor | medium | 15 | 84 | 600 | 481,6 | 1 926,4 | 0 | 2,64 |
| victor_100 | victor | hard | 27 | 62 | 1 950 | 1 102,6 | 2 450,22 | 4,96 | 6,28 |
| leon_01 | leon | medium | 15 | 85 | 1 920 | 1 611 | 6 444 | 0 | 2,6 |
| leon_02 | leon | medium | 16 | 80 | 1 456 | 1 136,8 | 4 263 | 0 | 2,8 |
| leon_03 | leon | medium | 15 | 84 | 1 840 | 1 523,2 | 6 092,8 | 3,36 | 2,64 |
| leon_04 | leon | easy | 13 | 87 | 1 000 | 870 | 4 015,38 | 2,61 | 1,26 |
| leon_05 | leon | medium | 17 | 79 | 700 | 523,6 | 1 848 | 1,58 | 2,84 |
| leon_06 | leon | medium | 16 | 78 | 500 | 359,2 | 1 347 | 1,56 | 2,88 |
| leon_07 | leon | easy | 12 | 89 | 936 | 833,04 | 4 165,2 | 0 | 1,22 |
| leon_08 | leon | easy | 14 | 86 | 900 | 774 | 3 317,14 | 0 | 1,28 |
| leon_09 | leon | medium | 18 | 77 | 1 120 | 830,2 | 2 767,33 | 2,31 | 2,92 |
| leon_10 | leon | medium | 15 | 85 | 2 100 | 1 764 | 7 056 | 2,55 | 2,6 |
| leon_11 | leon | medium | 17 | 81 | 1 494,9 | 1 184,27 | 4 179,77 | 0 | 2,76 |
| leon_12 | leon | easy | 14 | 86 | 1 000 | 860 | 3 685,71 | 2,58 | 1,28 |
| leon_13 | leon | medium | 15 | 84 | 490 | 389,2 | 1 556,8 | 5,04 | 2,64 |
| leon_14 | leon | medium | 16 | 82 | 2 200 | 1 778,8 | 6 670,5 | 0 | 2,72 |
| leon_15 | leon | easy | 12 | 90 | 1 000 | 900 | 4 500 | 2,7 | 1,2 |
| leon_16 | leon | medium | 18 | 80 | 2 200 | 1 732 | 5 773,33 | 0 | 2,8 |
| leon_17 | leon | easy | 11 | 91 | 1 200 | 1 092 | 5 956,36 | 1,82 | 1,18 |
| leon_18 | leon | medium | 16 | 78 | 630 | 460,6 | 1 727,25 | 1,56 | 2,88 |
| leon_19 | leon | medium | 15 | 85 | 2 100 | 1 764 | 7 056 | 0 | 2,6 |
| leon_20 | leon | medium | 15 | 83 | 1 100 | 889,2 | 3 556,8 | 4,15 | 2,68 |
| leon_21 | leon | easy | 13 | 88 | 1 000 | 880 | 4 061,54 | 2,64 | 1,24 |
| leon_22 | leon | medium | 17 | 79 | 1 756 | 1 357,84 | 4 792,38 | 0 | 2,84 |
| leon_23 | leon | medium | 18 | 77 | 2 100 | 1 584,8 | 5 282,67 | 1,54 | 2,92 |
| leon_24 | leon | easy | 12 | 89 | 925 | 823,25 | 4 116,25 | 0 | 1,22 |
| leon_25 | leon | medium | 16 | 81 | 1 440 | 1 139,8 | 4 274,25 | 0 | 2,76 |
| leon_26 | leon | medium | 15 | 85 | 1 200 | 999 | 3 996 | 5,1 | 2,6 |
| leon_27 | leon | easy | 14 | 86 | 1 000 | 860 | 3 685,71 | 2,58 | 1,28 |
| leon_28 | leon | medium | 17 | 80 | 800 | 612 | 2 160 | 1,6 | 2,8 |
| leon_29 | leon | medium | 15 | 84 | 2 200 | 1 825,6 | 7 302,4 | 2,52 | 2,64 |
| leon_30 | leon | medium | 16 | 82 | 1 456 | 1 168,72 | 4 382,7 | 3,28 | 2,72 |
| leon_31 | leon | medium | 15 | 85 | 1 800 | 1 509 | 6 036 | 0 | 2,6 |
| leon_32 | leon | easy | 11 | 90 | 1 000 | 900 | 4 909,09 | 2,7 | 1,2 |
| leon_33 | leon | easy | 13 | 86 | 1 000 | 860 | 3 969,23 | 1,72 | 1,28 |
| leon_34 | leon | easy | 12 | 91 | 1 200 | 1 092 | 5 460 | 0 | 1,18 |
| leon_35 | leon | medium | 16 | 79 | 2 100 | 1 629,6 | 6 111 | 0 | 2,84 |
| leon_36 | leon | medium | 17 | 80 | 1 120 | 868 | 3 063,53 | 2,4 | 2,8 |
| leon_37 | leon | easy | 13 | 87 | 1 000 | 870 | 4 015,38 | 2,61 | 1,26 |
| leon_38 | leon | medium | 18 | 78 | 2 200 | 1 685,2 | 5 617,33 | 0 | 2,88 |
| leon_39 | leon | easy | 12 | 88 | 944,7 | 831,34 | 4 156,68 | 0 | 1,24 |
| leon_40 | leon | medium | 16 | 79 | 2 100 | 1 629,6 | 6 111 | 1,58 | 2,84 |
| leon_41 | leon | easy | 13 | 86 | 925 | 795,5 | 3 671,54 | 0 | 1,28 |
| leon_42 | leon | medium | 15 | 84 | 1 000 | 817,6 | 3 270,4 | 4,2 | 2,64 |
| leon_43 | leon | medium | 17 | 81 | 1 600 | 1 269,4 | 4 480,24 | 2,43 | 2,76 |
| leon_44 | leon | medium | 18 | 80 | 2 160 | 1 700 | 5 666,67 | 0 | 2,8 |
| leon_45 | leon | medium | 19 | 74 | 800 | 555,6 | 1 754,53 | 2,22 | 3,04 |
| leon_46 | leon | medium | 15 | 80 | 1 050 | 812 | 3 248 | 1,6 | 2,8 |
| leon_47 | leon | easy | 13 | 87 | 1 000 | 870 | 4 015,38 | 2,61 | 1,26 |
| leon_48 | leon | easy | 12 | 89 | 1 000 | 890 | 4 450 | 2,67 | 1,22 |
| leon_49 | leon | medium | 16 | 82 | 630 | 491,4 | 1 842,75 | 4,92 | 2,72 |
| leon_50 | leon | rare | 25 | 65 | 10 990 | 6 996,5 | 16 791,6 | 0 | 8,1 |
| leon_51 | leon | medium | 16 | 82 | 1 860 | 1 500 | 5 625 | 0 | 2,72 |
| leon_52 | leon | medium | 15 | 81 | 1 500 | 1 188,4 | 4 753,6 | 3,24 | 2,76 |
| leon_53 | leon | medium | 17 | 80 | 1 800 | 1 412 | 4 983,53 | 0 | 2,8 |
| leon_54 | leon | medium | 19 | 76 | 2 200 | 1 638,4 | 5 173,89 | 1,52 | 2,96 |
| leon_55 | leon | medium | 16 | 78 | 980 | 733,6 | 2 751 | 3,9 | 2,88 |
| leon_56 | leon | medium | 18 | 74 | 1 500 | 1 073,6 | 3 578,67 | 0 | 3,04 |
| leon_57 | leon | medium | 17 | 80 | 1 120 | 868 | 3 063,53 | 2,4 | 2,8 |
| leon_58 | leon | easy | 14 | 86 | 720 | 619,2 | 2 653,71 | 0 | 1,28 |
| leon_59 | leon | easy | 13 | 88 | 1 200 | 1 056 | 4 873,85 | 0 | 1,24 |
| leon_60 | leon | easy | 14 | 87 | 1 000 | 870 | 3 728,57 | 2,61 | 1,26 |
| leon_61 | leon | medium | 16 | 83 | 1 860 | 1 520 | 5 700 | 0 | 2,68 |
| leon_62 | leon | medium | 15 | 82 | 1 485 | 1 192,5 | 4 770 | 2,46 | 2,72 |
| leon_63 | leon | medium | 17 | 81 | 560 | 427 | 1 507,06 | 4,86 | 2,76 |
| leon_64 | leon | medium | 19 | 73 | 700 | 473,2 | 1 494,32 | 1,46 | 3,08 |
| leon_65 | leon | easy | 12 | 89 | 1 200 | 1 068 | 5 340 | 1,78 | 1,22 |
| leon_66 | leon | easy | 14 | 86 | 1 000 | 860 | 3 685,71 | 2,58 | 1,28 |
| leon_67 | leon | easy | 11 | 90 | 958,2 | 862,38 | 4 703,89 | 0 | 1,2 |
| leon_68 | leon | medium | 16 | 80 | 1 080 | 836 | 3 135 | 0 | 2,8 |
| leon_69 | leon | medium | 17 | 79 | 1 600 | 1 234,6 | 4 357,41 | 3,95 | 2,84 |
| leon_70 | leon | easy | 13 | 86 | 775 | 666,5 | 3 076,15 | 0 | 1,28 |
| leon_71 | leon | easy | 12 | 92 | 1 200 | 1 104 | 5 520 | 0 | 1,16 |
| leon_72 | leon | medium | 16 | 82 | 2 200 | 1 778,8 | 6 670,5 | 0 | 2,72 |
| leon_73 | leon | easy | 13 | 88 | 1 000 | 880 | 4 061,54 | 2,64 | 1,24 |
| leon_74 | leon | medium | 15 | 85 | 2 100 | 1 764 | 7 056 | 0 | 2,6 |
| leon_75 | leon | medium | 15 | 84 | 1 120 | 918,4 | 3 673,6 | 3,36 | 2,64 |
| leon_76 | leon | medium | 17 | 79 | 1 320 | 1 013,4 | 3 576,71 | 0 | 2,84 |
| leon_77 | leon | medium | 16 | 81 | 1 512 | 1 198,12 | 4 492,95 | 2,43 | 2,76 |
| leon_78 | leon | medium | 16 | 80 | 1 500 | 1 172 | 4 395 | 0 | 2,8 |
| leon_79 | leon | easy | 11 | 89 | 1 000 | 890 | 4 854,55 | 2,67 | 1,22 |
| leon_80 | leon | easy | 14 | 87 | 1 200 | 1 044 | 4 474,29 | 0 | 1,26 |
| leon_81 | leon | medium | 18 | 77 | 1 120 | 830,2 | 2 767,33 | 3,08 | 2,92 |
| leon_82 | leon | easy | 14 | 86 | 0 | 0 | 0 | 1,72 | 1,28 |
| leon_83 | leon | medium | 18 | 75 | 630 | 437,5 | 1 458,33 | 1,5 | 3 |
| leon_84 | leon | medium | 15 | 82 | 1 600 | 1 286,8 | 5 147,2 | 4,1 | 2,72 |
| leon_85 | leon | medium | 19 | 76 | 2 160 | 1 608 | 5 077,89 | 0 | 2,96 |
| leon_86 | leon | medium | 18 | 74 | 980 | 688,8 | 2 296 | 0 | 3,04 |
| leon_87 | leon | medium | 15 | 83 | 1 080 | 872,6 | 3 490,4 | 0 | 2,68 |
| leon_88 | leon | medium | 15 | 84 | 560 | 448 | 1 792 | 5,04 | 2,64 |
| leon_89 | leon | medium | 16 | 82 | 1 940 | 1 565,6 | 5 871 | 0 | 2,72 |
| leon_90 | leon | medium | 17 | 80 | 1 600 | 1 252 | 4 418,82 | 3,2 | 2,8 |
| leon_91 | leon | easy | 13 | 86 | 760 | 653,6 | 3 016,62 | 0 | 1,28 |
| leon_92 | leon | medium | 16 | 83 | 1 000 | 806,2 | 3 023,25 | 4,98 | 2,68 |
| leon_93 | leon | medium | 15 | 84 | 2 200 | 1 825,6 | 7 302,4 | 1,68 | 2,64 |
| leon_94 | leon | easy | 13 | 88 | 1 000 | 880 | 4 061,54 | 2,64 | 1,24 |
| leon_95 | leon | medium | 16 | 81 | 2 100 | 1 674,4 | 6 279 | 2,43 | 2,76 |
| leon_96 | leon | medium | 17 | 79 | 1 600 | 1 234,6 | 4 357,41 | 3,16 | 2,84 |
| leon_97 | leon | medium | 18 | 78 | 1 120 | 842,8 | 2 809,33 | 3,12 | 2,88 |
| leon_98 | leon | medium | 19 | 77 | 1 860 | 1 400 | 4 421,05 | 0 | 2,92 |
| leon_99 | leon | medium | 16 | 82 | 1 504 | 1 208,08 | 4 530,3 | 3,28 | 2,72 |
| leon_100 | leon | rare | 25 | 65 | 7 230 | 4 552,5 | 10 926 | 0 | 8,1 |
| nyra_01 | nyra | easy | 14 | 86 | 490 | 421,4 | 1 806 | 2,58 | 1,28 |
| nyra_02 | nyra | easy | 13 | 88 | 800 | 704 | 3 249,23 | 2,64 | 1,24 |
| nyra_03 | nyra | medium | 15 | 84 | 350 | 271,6 | 1 086,4 | 5,04 | 2,64 |
| nyra_04 | nyra | medium | 15 | 82 | 900 | 712,8 | 2 851,2 | 4,92 | 2,72 |
| nyra_05 | nyra | medium | 17 | 80 | 490 | 364 | 1 284,71 | 4,8 | 2,8 |
| nyra_06 | nyra | medium | 15 | 85 | 600 | 489 | 1 956 | 5,1 | 2,6 |
| nyra_07 | nyra | medium | 15 | 83 | 500 | 391,2 | 1 564,8 | 3,32 | 2,68 |
| nyra_08 | nyra | medium | 16 | 79 | 840 | 634,2 | 2 378,25 | 4,74 | 2,84 |
| nyra_09 | nyra | medium | 17 | 78 | 700 | 515,2 | 1 818,35 | 4,68 | 2,88 |
| nyra_10 | nyra | medium | 15 | 84 | 630 | 506,8 | 2 027,2 | 4,2 | 2,64 |
| nyra_11 | nyra | medium | 15 | 83 | 800 | 640,2 | 2 560,8 | 4,98 | 2,68 |
| nyra_12 | nyra | medium | 15 | 85 | 910 | 752,5 | 3 010 | 5,1 | 2,6 |
| nyra_13 | nyra | medium | 18 | 77 | 350 | 237,3 | 791 | 4,62 | 2,92 |
| nyra_14 | nyra | easy | 12 | 89 | 900 | 801 | 4 005 | 2,67 | 1,22 |
| nyra_15 | nyra | medium | 16 | 80 | 560 | 420 | 1 575 | 4,8 | 2,8 |
| nyra_16 | nyra | medium | 17 | 79 | 1 000 | 760,6 | 2 684,47 | 4,74 | 2,84 |
| nyra_17 | nyra | medium | 18 | 81 | 770 | 597,1 | 1 990,33 | 4,86 | 2,76 |
| nyra_18 | nyra | medium | 15 | 84 | 700 | 565,6 | 2 262,4 | 5,04 | 2,64 |
| nyra_19 | nyra | medium | 15 | 82 | 630 | 491,4 | 1 965,6 | 4,92 | 2,72 |
| nyra_20 | nyra | easy | 14 | 86 | 900 | 774 | 3 317,14 | 2,58 | 1,28 |
| nyra_21 | nyra | easy | 11 | 90 | 917,4 | 825,66 | 4 503,6 | 2,7 | 1,2 |
| nyra_22 | nyra | medium | 15 | 85 | 490 | 395,5 | 1 582 | 5,1 | 2,6 |
| nyra_23 | nyra | easy | 12 | 88 | 700 | 616 | 3 080 | 2,64 | 1,24 |
| nyra_24 | nyra | medium | 16 | 79 | 420 | 302,4 | 1 134 | 4,74 | 2,84 |
| nyra_25 | nyra | easy | 11 | 91 | 1 000 | 910 | 4 963,64 | 2,73 | 1,18 |
| nyra_26 | nyra | medium | 17 | 78 | 910 | 679 | 2 396,47 | 4,68 | 2,88 |
| nyra_27 | nyra | medium | 18 | 80 | 900 | 692 | 2 306,67 | 4,8 | 2,8 |
| nyra_28 | nyra | medium | 15 | 84 | 560 | 448 | 1 792 | 5,04 | 2,64 |
| nyra_29 | nyra | medium | 17 | 77 | 600 | 429,8 | 1 516,94 | 4,62 | 2,92 |
| nyra_30 | nyra | medium | 15 | 85 | 630 | 514,5 | 2 058 | 5,1 | 2,6 |
| nyra_31 | nyra | medium | 16 | 79 | 800 | 602,6 | 2 259,75 | 4,74 | 2,84 |
| nyra_32 | nyra | easy | 12 | 86 | 700 | 602 | 3 010 | 2,58 | 1,28 |
| nyra_33 | nyra | medium | 15 | 84 | 700 | 565,6 | 2 262,4 | 5,04 | 2,64 |
| nyra_34 | nyra | medium | 16 | 78 | 490 | 351,4 | 1 317,75 | 4,68 | 2,88 |
| nyra_35 | nyra | easy | 12 | 87 | 900 | 783 | 3 915 | 2,61 | 1,26 |
| nyra_36 | nyra | medium | 15 | 80 | 560 | 420 | 1 680 | 4,8 | 2,8 |
| nyra_37 | nyra | medium | 18 | 76 | 700 | 498,4 | 1 661,33 | 4,56 | 2,96 |
| nyra_38 | nyra | medium | 15 | 85 | 840 | 693 | 2 772 | 4,25 | 2,6 |
| nyra_39 | nyra | easy | 12 | 89 | 800 | 712 | 3 560 | 2,67 | 1,22 |
| nyra_40 | nyra | medium | 17 | 79 | 770 | 578,9 | 2 043,18 | 4,74 | 2,84 |
| nyra_41 | nyra | easy | 13 | 86 | 900 | 774 | 3 572,31 | 2,58 | 1,28 |
| nyra_42 | nyra | medium | 16 | 81 | 490 | 370,3 | 1 388,63 | 4,86 | 2,76 |
| nyra_43 | nyra | medium | 15 | 83 | 700 | 557,2 | 2 228,8 | 4,98 | 2,68 |
| nyra_44 | nyra | easy | 12 | 87 | 700 | 609 | 3 045 | 2,61 | 1,26 |
| nyra_45 | nyra | medium | 15 | 85 | 1 110 | 922,5 | 3 690 | 5,1 | 2,6 |
| nyra_46 | nyra | medium | 17 | 78 | 420 | 296,8 | 1 047,53 | 4,68 | 2,88 |
| nyra_47 | nyra | easy | 13 | 86 | 1 000 | 860 | 3 969,23 | 2,58 | 1,28 |
| nyra_48 | nyra | medium | 16 | 80 | 560 | 420 | 1 575 | 4,8 | 2,8 |
| nyra_49 | nyra | medium | 16 | 79 | 800 | 602,6 | 2 259,75 | 4,74 | 2,84 |
| nyra_50 | nyra | rare | 25 | 65 | 10 640 | 6 769 | 16 245,6 | 5,2 | 8,1 |
| nyra_51 | nyra | easy | 14 | 86 | 630 | 541,8 | 2 322 | 2,58 | 1,28 |
| nyra_52 | nyra | medium | 15 | 84 | 700 | 565,6 | 2 262,4 | 5,04 | 2,64 |
| nyra_53 | nyra | medium | 16 | 81 | 560 | 427 | 1 601,25 | 4,86 | 2,76 |
| nyra_54 | nyra | medium | 17 | 79 | 600 | 444,6 | 1 569,18 | 4,74 | 2,84 |
| nyra_55 | nyra | medium | 18 | 78 | 490 | 351,4 | 1 171,33 | 4,68 | 2,88 |
| nyra_56 | nyra | medium | 15 | 85 | 800 | 659 | 2 636 | 5,1 | 2,6 |
| nyra_57 | nyra | medium | 19 | 76 | 420 | 285,6 | 901,89 | 4,56 | 2,96 |
| nyra_58 | nyra | easy | 11 | 90 | 700 | 630 | 3 436,36 | 2,7 | 1,2 |
| nyra_59 | nyra | medium | 16 | 80 | 490 | 364 | 1 365 | 4,8 | 2,8 |
| nyra_60 | nyra | easy | 13 | 86 | 917,4 | 788,96 | 3 641,37 | 2,58 | 1,28 |
| nyra_61 | nyra | easy | 12 | 87 | 560 | 487,2 | 2 436 | 2,61 | 1,26 |
| nyra_62 | nyra | medium | 15 | 85 | 900 | 744 | 2 976 | 5,1 | 2,6 |
| nyra_63 | nyra | medium | 15 | 81 | 630 | 483,7 | 1 934,8 | 4,86 | 2,76 |
| nyra_64 | nyra | medium | 17 | 79 | 700 | 523,6 | 1 848 | 4,74 | 2,84 |
| nyra_65 | nyra | medium | 16 | 80 | 490 | 364 | 1 365 | 4,8 | 2,8 |
| nyra_66 | nyra | easy | 13 | 86 | 800 | 688 | 3 175,38 | 2,58 | 1,28 |
| nyra_67 | nyra | medium | 18 | 77 | 420 | 291,2 | 970,67 | 4,62 | 2,92 |
| nyra_68 | nyra | easy | 12 | 88 | 700 | 616 | 3 080 | 2,64 | 1,24 |
| nyra_69 | nyra | medium | 17 | 78 | 560 | 406 | 1 432,94 | 4,68 | 2,88 |
| nyra_70 | nyra | medium | 15 | 85 | 900 | 744 | 2 976 | 5,1 | 2,6 |
| nyra_71 | nyra | medium | 18 | 79 | 490 | 357,7 | 1 192,33 | 4,74 | 2,84 |
| nyra_72 | nyra | easy | 12 | 87 | 800 | 696 | 3 480 | 2,61 | 1,26 |
| nyra_73 | nyra | easy | 13 | 86 | 630 | 541,8 | 2 500,62 | 2,58 | 1,28 |
| nyra_74 | nyra | medium | 16 | 80 | 800 | 612 | 2 295 | 4,8 | 2,8 |
| nyra_75 | nyra | easy | 12 | 88 | 700 | 616 | 3 080 | 2,64 | 1,24 |
| nyra_76 | nyra | medium | 15 | 81 | 900 | 702,4 | 2 809,6 | 4,86 | 2,76 |
| nyra_77 | nyra | easy | 13 | 86 | 630 | 541,8 | 2 500,62 | 2,58 | 1,28 |
| nyra_78 | nyra | medium | 18 | 78 | 700 | 515,2 | 1 717,33 | 4,68 | 2,88 |
| nyra_79 | nyra | medium | 15 | 82 | 560 | 434 | 1 736 | 4,92 | 2,72 |
| nyra_80 | nyra | easy | 12 | 87 | 900 | 783 | 3 915 | 2,61 | 1,26 |
| nyra_81 | nyra | easy | 11 | 89 | 490 | 436,1 | 2 378,73 | 2,67 | 1,22 |
| nyra_82 | nyra | medium | 16 | 81 | 800 | 621,4 | 2 330,25 | 4,86 | 2,76 |
| nyra_83 | nyra | medium | 15 | 85 | 630 | 514,5 | 2 058 | 5,1 | 2,6 |
| nyra_84 | nyra | medium | 17 | 80 | 700 | 532 | 1 877,65 | 4,8 | 2,8 |
| nyra_85 | nyra | easy | 12 | 87 | 700 | 609 | 3 045 | 2,61 | 1,26 |
| nyra_86 | nyra | medium | 18 | 78 | 800 | 593,2 | 1 977,33 | 4,68 | 2,88 |
| nyra_87 | nyra | medium | 16 | 80 | 630 | 476 | 1 785 | 4,8 | 2,8 |
| nyra_88 | nyra | easy | 11 | 91 | 900 | 819 | 4 467,27 | 2,73 | 1,18 |
| nyra_89 | nyra | medium | 17 | 79 | 560 | 413 | 1 457,65 | 4,74 | 2,84 |
| nyra_90 | nyra | easy | 13 | 86 | 800 | 688 | 3 175,38 | 2,58 | 1,28 |
| nyra_91 | nyra | easy | 12 | 88 | 700 | 616 | 3 080 | 2,64 | 1,24 |
| nyra_92 | nyra | medium | 18 | 78 | 700 | 515,2 | 1 717,33 | 4,68 | 2,88 |
| nyra_93 | nyra | easy | 12 | 87 | 630 | 548,1 | 2 740,5 | 2,61 | 1,26 |
| nyra_94 | nyra | easy | 13 | 86 | 800 | 688 | 3 175,38 | 2,58 | 1,28 |
| nyra_95 | nyra | medium | 16 | 80 | 560 | 420 | 1 575 | 4,8 | 2,8 |
| nyra_96 | nyra | medium | 15 | 85 | 900 | 744 | 2 976 | 5,1 | 2,6 |
| nyra_97 | nyra | medium | 18 | 77 | 630 | 452,9 | 1 509,67 | 4,62 | 2,92 |
| nyra_98 | nyra | medium | 16 | 81 | 800 | 621,4 | 2 330,25 | 4,86 | 2,76 |
| nyra_99 | nyra | medium | 19 | 75 | 560 | 385 | 1 215,79 | 4,5 | 3 |
| nyra_100 | nyra | rare | 25 | 65 | 10 640 | 6 769 | 16 245,6 | 5,2 | 8,1 |
