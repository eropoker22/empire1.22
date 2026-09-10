**EMPIRE STREETS — úplný datový katalog k auditu 9. 9. 2026**

Toto je katalog první fáze auditu. Aktuální číselné změny jsou v [nové příloze](war-balance-tables-2026-09-09.md), jejich vysvětlení v [auditu války](war-balance-2026-09-09.md). Nové hodnoty mají přednost zejména u startu, kapacit, boostů, inspektora, spekulace, HEAT, skóre a finále.

Zdroj: vyhodnocená lokální FREE konfigurace po opravách auditu. [Výklad pravidel](gameplay-audit-2026-09-09.md) a [úplný JSON](gameplay-config-snapshot-2026-09-09.json). Hodnoty katalogu jsou základy; výsledná nabídka, příjem a čas se přepočítávají podle stavu hráče, frakce, úrovně, sítě, fáze dne, dočasných akcí a omezení. Přesný okamžitý údaj poskytuje serverová projekce ve hře.

**1. Všech 32 typů budov**

Příjem je za reálnou hodinu, heat a vliv za reálných 24 hodin. Počty jsou v základní mapě před doplněním výrobních budov při startu hráčů. Čísla příjmů ještě nejsou konečný výnos po všech násobičích.

| Budova | Typ | Počet | Clean/h | Dirty/h | Heat/24 h | Vliv/24 h | Max. level |
|---|---|---|---|---|---|---|---|
| Centrální banka | central_bank | 2 | 9600 | 0 | 144 | 504 | 1 |
| Magistrát | city_hall | 1 | 7800 | 0 | 172.8 | 1224 | 1 |
| Lobby Club | lobby_club | 2 | 5700 | 0 | 144 | 936 | 1 |
| Burza | stock_exchange | 1 | 13200 | 0 | 259.2 | 648 | 1 |
| Soud | court | 2 | 6300 | 0 | 115.2 | 1036.8 | 1 |
| VIP Salonek | vip_lounge | 2 | 6300 | 1800 | 187.2 | 691.2 | 1 |
| Letiště | airport | 1 | 10800 | 2700 | 288 | 288 | 1 |
| Přístav | port | 1 | 1560 | 510 | 5 | 26 | 5 |
| Parlament | parliament | 1 | 1320 | 180 | 3 | 40 | 5 |
| Obchodní centrum | shopping_mall | 10 | 3700 | 1320 | 65 | 95 | 1 |
| Restaurace | restaurant | 36 | 2280 | 0 | 57.6 | 172.8 | 1 |
| Herna | arcade | 16 | 1800 | 1200 | 172.8 | 80 | 1 |
| Kasino | casino | 3 | 4500 | 2500 | 150 | 110 | 4 |
| Autosalon | car_dealer | 10 | 2145 | 650 | 60 | 24 | 1 |
| Fitness Club | fitness_club | 5 | 4320 | 0 | 57.6 | 0 | 1 |
| Směnárna | exchange | 11 | 4200 | 5700 | 70 | 60 | 1 |
| Bytový blok | apartment_block | 29 | 0 | 0 | 0 | 0 | 1 |
| Rekrutační centrum | recruitment_center | 16 | 2100 | 0 | 100.8 | 0 | 1 |
| Garáž | garage | 16 | 2520 | 0 | 86.4 | 0 | 1 |
| Klinika | clinic | 8 | 3100 | 0 | 85 | 0 | 1 |
| Škola | school | 6 | 1080 | 0 | 0 | 72 | 1 |
| Továrna | factory | 28 | 0 | 0 | 3 | 10 | 14 |
| Zbrojovka | armory | 15 | 0 | 0 | 4 | 18 | 14 |
| Skladiště | warehouse | 18 | 2700 | 0 | 86.4 | 0 | 4 |
| Energetická stanice | power_station | 9 | 2780 | 780 | 115.2 | 0 | 1 |
| Recyklační centrum | recycling_center | 14 | 2400 | 0 | 115.2 | 0 | 1 |
| Lékárna | pharmacy | 16 | 0 | 0 | 3 | 8 | 14 |
| Drug Lab | drug_lab | 7 | 0 | 0 | 6 | 20 | 14 |
| Pašovací tunel | smuggling_tunnel | 18 | 0 | 3240 | 100.8 | 0 | 1 |
| Večerka | convenience_store | 17 | 1920 | 1080 | 72 | 144 | 1 |
| Strip Club | strip_club | 17 | 4500 | 3900 | 85 | 90 | 1 |
| Pouliční dealeři | street_dealers | 19 | 0 | 2160 | 86.4 | 0 | 1 |

**2. Akce všech budov**

Délka efektu a cooldown jsou základní reálné minuty. Prázdný pevný vstup/výstup neznamená akci zdarma: u dynamických akcí cenu a efekt určuje jejich serverové pravidlo a slovní popis. Časové podmínky den/noc, kapacity a síťové limity jsou popsány v hlavním auditu nebo JSON.

**Centrální banka** — Ultra vzácná / finance / rezervy / stabilita marketu

Centrální banka netiskne chaos. Drží ho pod zámkem. Kdo ovládá rezervy, nemusí vyhrávat každou přestřelku. Stačí, když přežije každou krizi.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Likviditní injekce / liquidity_injection | Okamžitě přidá clean cash podle velikosti čisté ekonomiky hráče. Cena 20 influence, +clean cash, +heat, +Financial Oversight risk | — | — | 0 | 20 | 4 | -20 |
| Zmrazené účty / frozen_accounts | Dočasně zvýší ochranu clean cash a sníží finanční ztráty. Cena 2000 clean cash, ochrana rezerv, horší market fee | 2000 cash | — | 8 | 24 | 5 | 0 |
| Kurzovní intervence / currency_intervention | Stabilizuje materiálový market a tlumí výkyvy způsobené Tržním tlakem Burzy. Cena 3000 clean cash + 25 influence, nižší volatilita materiálů, +heat | 3000 cash | — | 8 | 28 | 7 | -25 |

**Magistrát** — Ultra vzácná / politika / kontrola města / řízení heatu

Magistrát není gangová základna. Je to místo, kde se zločin mění na razítko. Kdo drží magistrát, nemusí mít vždy větší zbraň. Stačí, když má správný podpis.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Úřední krytí / official_cover | Na 8 minut sníží heat gain, police control chance a rumor chance ve všech vlastněných districtech. Cena 1500 clean + 25 influence, heat +2, scandal risk +8 % | 1500 cash | — | 8 | 20 | 2 | -25 |
| Městská zakázka / city_contract | Převede politický vliv na clean cash podle počtu legálních budov hráče. Cena 20 influence, reward 1500 + legální budovy × 120, heat +3 | — | — | 0 | 18 | 3 | -20 |
| Nouzová vyhláška / emergency_decree | Na 6 minut aktivuje Zastavené kontroly pro vlastněné distrikty. Cena 2500 clean + 40 influence, heat +8, méně policejních incidentů | 2500 cash | — | 6 | 28 | 8 | -40 |

**Lobby Club** — Ultra vzácná / lobby / vliv / politická podpora

Lobby Club není úřad. Je to místnost vedle úřadu, kde se rozhodne dřív, než někdo zvedne ruku. Kdo drží Lobby Club, nevládne městu přímo. Jen šeptá lidem, kteří městem hýbou.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Zákulisní tlak / backroom_pressure | Na 8 minut posílí influence produkci všech budov, zlevní influence akce a sníží negativní drby. Cena 1200 clean + 25 influence, influence +18 %, influence akce -10 %, heat +3 | 1200 cash | — | 8 | 20 | 3 | -25 |
| Tiché vyjednávání / quiet_negotiation | Zkrátí jeden aktivní politický nebo společenský cooldown, sníží rizika a zlevní další influence akci. Cena 1500 clean + 15 influence, cooldown -20 % zbývajícího času, heat +2 | 1500 cash | — | 0 | 24 | 2 | -15 |
| Mediální clona / media_screen | Na 8 minut tlumí negativní drby, snižuje jejich pravdivost a zlepšuje civilní rumor truth. Cena 2000 clean, negativní drby -35 %, police warning +6 %, heat +4 | 2000 cash | — | 8 | 26 | 4 | 0 |

**Burza** — Ultra vzácná / ekonomika / kontrola marketu / finanční síla

Burza je jediná na mapě. Neprodává zboží. Ovládá ceny, poplatky a rytmus celé ekonomiky. Skleněná věž v Downtownu, kde se války nevedou noži, ale grafy.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Spekulativní nákup / speculative_buy | Investuje výchozí částku do materiálového marketu. Výsledek může být zisk, neutrální pohyb nebo ztráta. Cena 2500 clean + investice, heat +5, financial inspection risk +6 % | 2500 cash | — | 0 | 16 | 5 | 0 |
| Tržní tlak / market_pressure | Na 10 minut zvýší ceny materiálového marketu. Cena 3000 clean + 15 influence, heat +8, market efekt | 3000 cash | — | 10 | 22 | 8 | -15 |
| Vnitřní tipy / insider_window | Na 6 minut zlepší trend hinty, sníží market poplatek a zvedne šanci Spekulativního nákupu. Cena 1500 clean, heat +4, 3 trend hinty, market poplatek -8 % | 1500 cash | — | 6 | 18 | 4 | 0 |

**Soud** — Ultra vzácná / právní ochrana / zmírnění razií / vliv

Soud nevypne policii. Jen zařídí, aby její zásah bolel míň. Když máš rozsudky, odklady a správné právníky, i razie ztratí zuby.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**VIP Salonek** — Vzácná / elitní drby / přesnější intel / vliv

VIP Salonek je luxusní informační uzel. Za tlumeným světlem a drahým stolem se mluví rychleji než ve městě dole. Nedává jistotu, ale jeho zákulisní drby bývají nebezpečně blízko pravdě.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Letiště** — Ultra vzácná / logistika / import / černý trh / mobilita

Letiště je brána města. Co ostatní musí vyrábět, ty můžeš dovézt. Co ostatní musí vozit ulicemi, ty pošleš přes runway. Ale každý kontejner má papíry. A každý falešný papír jednou někdo zkontroluje.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Expresní dovoz / express_import | Okamžitě doručí materiálovou importní zásilku do SKLADU hráče. Cena 2000 clean, heat +6, customs risk 10 % | 2000 cash | — | 0 | 18 | 6 | 0 |
| Černý charter / black_charter | Na 8 minut otevře speciální Black Market nabídku. Cena 2500 dirty, heat +9, nabídka -6 %, celní zátah při nákupu 15 % | 2500 dirty-cash | — | 8 | 24 | 9 | 0 |
| Evakuační koridor / evacuation_corridor | Na 7 minut zlepší únik, ztráty při neúspěchu a návratovou logistiku. Cena 1800 clean, heat +5, escape +18 %, ztráty -10 % | 1800 cash | — | 7 | 26 | 5 | 0 |

**Přístav** — Logistika

Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Proříznout kontejner / port_container_cut | Vybere z kontejnerů užitečné zásoby. +dirty cash, +metal parts, +heat | — | 160 dirty-cash, 3 metal-parts | 0 | 1.5 | 6 | 1 |

**Parlament** — Moc

Nejvyšší politická páka s extrémním clean income a vlivem.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Politické okno / parliament_policy_window | Otevře krátké politické okno pro zisk vlivu. +vliv, +clean cash, +heat | — | 160 cash | 0 | 1.5 | 5 | 5 |

**Obchodní centrum** — Ekonomika / market / vliv / síťový bonus

Obchodní centrum generuje peníze, menší dirty cash, vliv a snižuje ceny na marketu. Výlohy svítí, kasy pípají a v podzemních garážích se domlouvají dohody, které nikdy neuvidíš na účtence. Obchodní centrum není jen nákupní zóna. Je to tepna zásobování.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Restaurace** — Ekonomika / drby / vliv / městský provoz

Restaurace generuje čisté peníze, trochu vlivu a městské drby. Lokální tržby, kryté schůzky a síť kontaktů z ní dělají civilní oporu komerčních districtů. Stoly u okna, zadní vchod pro kurýry a kuchyně, kde se slyší víc než na ulici.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Vybrat tržby / restaurant_collect_revenue | Vybere lokální tržby restaurace jako clean a dirty cash. +869 clean cash, +550 dirty cash, heat +5 | — | 869 cash, 550 dirty-cash | 0 | 30 | 5 | 0 |
| Krýt schůzky / restaurant_cover_meetings | Na 30 minut zvedne lokální income restaurace a přidá vliv. +18 % clean/dirty income, +8 vliv, heat +4 na 30 minut | — | — | 30 | 45 | 4 | 8 |
| Posílit lokální síť / restaurant_local_network | Na 30 minut posílí lokální vliv restaurace. +12 % vliv, +4 vliv, heat +8 na 30 minut | — | — | 30 | 30 | 8 | 4 |

**Herna** — Ekonomika / dirty cash / praní / síť

Herna je pouliční cashflow. Blikající automaty, špinavé mince, zadní pokladna a dým z cigaret. Sama o sobě tě nespasí, ale síť heren dokáže krmit gang celou free session.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Noční automaty / night_machines | Dočasně zvýší clean, dirty, vliv, heat a audit risk Herny. Nestackuje se sama se sebou. +clean income, +dirty income, +vliv, +heat, +audit risk na 7 minut | — | — | 7 | 16 | 0 | 0 |
| Zadní pokladna / back_cashdesk | Instantně vypere 13 % aktuálního dirty cash hráče přes zadní pokladnu. -dirty cash, +clean cash po 15 % poplatku, +heat, +vliv, +audit risk | — | — | 0 | 16 | 3 | 1 |

**Kasino** — Laundering / high-risk

Vzácná high-value neonová pračka peněz. Dává extrémní cashflow, dirty cash a vliv, ale rychle zvedá heat a audit risk.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Tichá herna / quiet_backroom | Instantně vypere 24 % aktuálního dirty cash hráče až do limitu kasina. -dirty cash, +clean cash po 9 % poplatku, +heat, +vliv, +audit risk | — | — | 0 | 14 | 7 | 3 |
| VIP noc / vip_night | Dočasně zvýší casino income, vliv, heat a audit risk. Nestackuje se sama se sebou. +clean income, +dirty income, +vliv, +heat, +audit risk na 10 minut | — | — | 10 | 26 | 0 | 0 |
| Podplacený inspektor / bribed_inspector | Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší tlak. Cena 15000 clean cash, šance selhání 14 %, heat -15 při úspěchu, audit control | 15000 cash | — | 12 | 105 | 0 | 0 |

**Autosalon** — Ekonomika / mobilita / logistika / kratší cooldowny

Autosalon generuje peníze a zlepšuje mobilitu gangu. Lesklé kapoty vpředu, falešné smlouvy vzadu a klíče od aut, která nikdy neuvidí papíry. Autosalon není jen showroom. Je to úniková trasa na kolech.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Fitness Club** — Ekonomika / bojová podpora / fyzický trénink

Fitness Club generuje čistý příjem a posiluje fyzickou sílu útoku i obrany. Nezískáš víc lidí. Získáš tvrdší lidi. Rezavé činky, rozbité zrcadlo a trenér, který nepočítá opakování, ale přežití.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Směnárna** — Ekonomika / praní / síť

Směnárna pere menší částky bezpečněji než kasino. Jedna směnárna je služba. Síť směnáren je finanční pavouk přes celé město.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Výhodný kurz / good_rate | Ve dne vypere 16 % aktuálního dirty cash hráče přes síť směnáren. -dirty cash, +clean cash po 12 % poplatku, heat +12, vliv +3, +audit risk | — | — | 0 | 18 | 12 | 3 |

**Bytový blok** — Populace

Bytový blok negeneruje peníze ani heat. Jen lidi. A lidi jsou munice města.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Vybrat obyvatele / collect_population | Přesune lokálně uložené obyvatele do globální populace hráče. +populace, bez heatu a bez peněz | — | — | 0 | 0.016667 | 0 | 0 |

**Rekrutační centrum** — Podpora / populace / bojový bonus

Rekrutační centrum nevyrábí lidi. Dělá z obyvatel použitelný gang a z výbavy skutečnou sílu. Lidi přijdou z bloků. Tady se z nich stává armáda ulice.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Garáž** — Ekonomika / logistika / kratší cooldowny

Garáž generuje čistý příjem a snižuje cooldowny logistických, pohybových a přípravných akcí. Motory běží pod plechovou střechou, kufry mizí ve tmě a někdo vždycky ví, kudy projet bez kamer. Garáž není jen místo pro auta. Je to tempo celého gangu.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Klinika** — Ekonomika / recovery / podpora

Klinika nevyrábí zbraně ani gang. Zachraňuje to, co by jinak město sežralo.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Stabilizační protokol / stabilization_protocol | Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu. recovery pool, cena 1200 clean, +1 heat | 1200 cash | — | 0 | 18 | 1 | 0 |

**Škola** — Populace / vzdělání / městský život

Škola generuje malé peníze a trochu obyvatel. Není to kasárna. Je to místo, kde město vyrábí chytřejší lidi. Rozbité lavice, studené chodby a tabule popsané věcmi, které se v učebnicích neučí.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Večerní kurz / evening_course | Na 20 minut zrychlí nábor členů v bytových blocích. Nestackuje se. Cena 1000 clean cash, +60 % nábor členů na 20 minut | 1000 cash | — | 20 | 35 | 0 | 0 |
| Vybrat obyvatele / collect_school_population | Přesune celé obyvatele uložené ve Škole do globální populace hráče. +populace, bez heatu a bez peněz | — | — | 0 | 0.016667 | 0 | 0 |

**Továrna** — Výroba

Tři nezávislé linky se po rozkazu ihned rozběhnou a po serverovém odpočtu vyrobí Metal Parts, Tech Core nebo Combat Module. V tomhle provozu se čas měří jiskrami a chybějícími prsty.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Zbrojovka** — Výzbroj

Nezávislé linky se spouštějí ihned, ale útočné i obranné vybavení vydají až po dokončení serverového cyklu. Kov dovnitř, náskok v ulicích ven.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Skladiště** — Economy / storage / logistics

Skladiště zvyšuje maximum každé položky v globálním SKLADU. První aktivní Skladiště přidá 50 %, další menší síťový bonus a z levelů platí jen nejvyšší aktivní level.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Energetická stanice** — Infrastruktura / podpora / obrana

Energetická stanice nezavádí nový zdroj. Zvedá výkon města, drží infrastrukturu při životě a posiluje bezpečnostní systémy. Když svítí stanice, město dýchá rychleji. Kamery vidí ostřeji. Alarmy řvou dřív.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Stabilizovat síť / backup_grid_switch | Na 25 minut zvýší bonus infrastruktury, posílí kamery a alarmy a přidá výkon Továrnám a Zbrojovkám. Nestackuje se sama se sebou. Cena 3500 clean cash, +12 % infrastruktura, +20 % kamery, +20 % alarm, heat +3 na 25 minut | 3500 cash | — | 25 | 60 | 3 | 0 |
| Prodat přebytek / power_station_feed_production | Okamžitě zpeněží přebytek energie. Rychlost výrobních linek nemění. +2000 clean cash, +500 dirty cash, heat +10 | — | 2000 cash, 500 dirty-cash | 0 | 60 | 10 | 0 |
| Snížit heat / power_station_reduce_heat | Za 10000 clean cash serverově sníží heat districtu. Cena 10000 clean cash, heat -20, cooldown 60 minut | 10000 cash | — | 0 | 60 | -20 | 0 |

**Recyklační centrum** — Podpora / vytěžení ztrát / návrat itemů

Recyklační centrum nevrací lidi. Vrací železo, zbraně, moduly a všechno, co se dá po boji ještě vytáhnout ze šrotu. Když bitva skončí, někdo počítá mrtvé. Recyklační centrum počítá, co se dá znovu použít.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Vytěžit ztráty / extract_losses | Vrátí část neexpirovaných itemových ztrát ze zásobníku ztrát. Nikdy nevrací populaci ani členy gangu. Cena 900 clean cash, návrat itemů podle sítě Recyklačních center, heat +2 | 900 cash | — | 0 | 16 | 2 | 0 |

**Lékárna** — Výroba

Chemicals, Biomass a Stim Pack se po potvrzení ihned zařadí do výroby. Server zamkne cenu při startu a hotový materiál zpřístupní teprve po doběhnutí odpočtu.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Drug Lab** — Výroba drog

Pět nezávislých linek se spustí hned a po skutečném čase dokončí Neon Dust, Pulse Shot, Velvet Smoke, Ghost Serum nebo Overdrive X. Neon tu svítí i tehdy, když už směna dávno neměla pokračovat.

Bez samostatné akce ve veřejném katalogu; u výrobních budov viz recepty a u pasivních budov jejich pravidla.

**Pašovací tunel** — Dirty cash / smuggling / dealer support / risk reward

Pašovací tunel pasivně vytváří dirty cash a podporuje rychlost i bezpečnost pouliční distribuce. Cenu prodeje neurčuje: ta zůstává pevně odvozená z výroby v Drug Labu.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Otevřít kanál / open_channel | Na 15 minut posílí dirty cash tunelů a zrychlí prodej Pouličních dealerů. Nestackuje se. Cena 1800 clean cash, heat +5, +45 % dirty tok tunelů, rychlejší prodej a vyšší riziko incidentu | 1800 cash | — | 15 | 30 | 5 | 0 |

**Večerka** — Economy / populace / rumors / influence / street life

Večerka generuje malé čisté peníze, drobné dirty cash, vliv, lokální pouliční drby a postupně nabírá nové lidi pro gang.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Vybrat obyvatele / collect_convenience_store_population | Přesune obyvatele uložené ve Večerce do globální populace hráče. +populace, bez heatu a bez peněz | — | — | 0 | 0.016667 | 0 | 0 |

**Strip Club** — Economy / influence / rumors / social network

Strip Club pasivně vytváří peníze, vliv a drby. Vybrání cash, VIP klienti a soukromá party jsou samostatné akce s náklady, heatem a cooldownem.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Vybrat cash / strip_club_collect_cash | Okamžitě vybere noční dirty cash ze Strip Clubu. +360 dirty cash, heat +3 | — | 360 dirty-cash | 0 | 10 | 3 | 0 |
| Hostit VIP klienty / vip_lounge | Dočasně zvýší clean cash, dirty cash, vliv, heat a šanci na drb. Nestackuje se sám se sebou. Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 30 minut | 800 cash | — | 30 | 60 | 0 | 0 |
| Soukromá party / private_party | Přidá okamžitý vliv, dočasně zvýší jeho tvorbu a může přinést extra drb nebo skandál. Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 % | 1500 cash | — | 10 | 30 | 6 | 8 |

**Pouliční dealeři** — Dirty cash / drug distribution / street economy

Pouliční dealeři pasivně vytváří slabší dirty cash a prodávají Neon Dust, Pulse Shot nebo Velvet Smoke ze SKLADU. Jeden prodej vždy spotřebuje zvolenou látku a současně může běžet jen jeden.

| Akce / ID | Co dělá | Pevný vstup | Pevný výstup | Délka min | Cooldown min | Heat | Vliv |
|---|---|---|---|---|---|---|---|
| Prodat zásobu / start_drug_sale | Vyber jednu z dostupných látek a nastav alespoň 10 ks. Prodej se vyhodnotí okamžitě; případný cooldown omezuje až další použití. dirty cash, heat, pouliční riziko | — | — | 0 | 1.5 | 0 | 0 |

**3. Všech 21 receptů**

Sloupec FREE základ aplikuje pouze globální 0,8 a zaokrouhlení nahoru na tick; tick trvá 10 sekund. Dále se čas dělí aktivní rychlostí. Například továrna přes den používá fázovou rychlost 1,1; laboratoř v noci 1,2. Výstup z jednoho dokončení se tím nenásobí. Fronta a lokální kapacita platí pro uvedený recept.

**Lékárna**

| Recept / ID | Výstup | Clean / kus | Vstupy / kus | Základ ticků | FREE základ s | Lokální cap | Fronta cap |
|---|---|---|---|---|---|---|---|
| Chemicals / chemicals | 1 chemicals | 360 | — | 15 | 120 | 12 | 15 |
| Biomass / biomass | 1 biomass | 420 | — | 30 | 240 | 8 | 11 |
| Stim Pack / stim-pack | 1 stim-pack | 800 | — | 75 | 600 | 4 | 7 |

**Drug Lab**

| Recept / ID | Výstup | Clean / kus | Vstupy / kus | Základ ticků | FREE základ s | Lokální cap | Fronta cap |
|---|---|---|---|---|---|---|---|
| Neon Dust / neon-dust | 1 neon-dust | 500 | 2 chemicals | 37 | 300 | 10 | 13 |
| Pulse Shot / pulse-shot | 1 pulse-shot | 800 | 2 chemicals, 1 biomass | 60 | 480 | 6 | 9 |
| Velvet Smoke / velvet-smoke | 1 velvet-smoke | 900 | 1 chemicals, 2 biomass | 112 | 900 | 5 | 8 |
| Ghost Serum / ghost-serum | 1 ghost-serum | 2500 | 2 neon-dust, 1 pulse-shot | 150 | 1200 | 2 | 5 |
| Overdrive X / overdrive-x | 1 overdrive-x | 4500 | 1 pulse-shot, 2 velvet-smoke | 225 | 1800 | 1 | 4 |

**Továrna**

| Recept / ID | Výstup | Clean / kus | Vstupy / kus | Základ ticků | FREE základ s | Lokální cap | Fronta cap |
|---|---|---|---|---|---|---|---|
| Metal Parts / metal-parts | 1 metal-parts | 300 | — | 30 | 240 | 10 | 13 |
| Tech Core / tech-core | 1 tech-core | 900 | 4 metal-parts | 60 | 480 | 5 | 8 |
| Bojový modul / combat-module | 1 combat-module | 2500 | 4 metal-parts, 2 tech-core | 112 | 900 | 2 | 5 |

**Zbrojovka**

| Recept / ID | Výstup | Clean / kus | Vstupy / kus | Základ ticků | FREE základ s | Lokální cap | Fronta cap |
|---|---|---|---|---|---|---|---|
| Baseballová pálka / baseball-bat | 1 baseball-bat | 0 | 2 metal-parts | 22 | 180 | 8 | 11 |
| Pistole / pistol | 1 pistol | 0 | 3 metal-parts, 1 tech-core | 37 | 300 | 5 | 8 |
| Granát / grenade | 1 grenade | 0 | 2 metal-parts, 1 tech-core | 45 | 360 | 4 | 7 |
| SMG / smg | 1 smg | 0 | 2 metal-parts, 1 combat-module | 60 | 480 | 3 | 6 |
| Bazuka / bazooka | 1 bazooka | 0 | 3 metal-parts, 2 combat-module | 105 | 840 | 2 | 5 |
| Vesta / vest | 1 vest | 0 | 3 metal-parts, 1 tech-core | 37 | 300 | 5 | 8 |
| Barikády / barricades | 1 barricades | 0 | 4 metal-parts | 37 | 300 | 6 | 9 |
| Kamery / cameras | 1 cameras | 0 | 2 metal-parts, 2 tech-core | 45 | 360 | 4 | 7 |
| Obranná věž / defense-tower | 1 defense-tower | 0 | 3 tech-core, 2 combat-module | 112 | 900 | 2 | 5 |
| Alarm / alarm | 1 alarm | 0 | 2 metal-parts, 1 tech-core | 37 | 300 | 4 | 7 |

**4. Upgrady výroby a skladu — skutečně vybraný ceník**

| Typ | Max. level | Cena levelu 2 | Výrobní rychlost levelu 2 | Ceník |
|---|---|---|---|---|
| pharmacy | 14 | 3200 cash | 1.1 | production |
| drug_lab | 14 | 4200 cash | 1.1 | production |
| factory | 14 | 5000 cash | 1.1 | production |
| armory | 14 | 5200 cash | 1.1 | production |
| warehouse | 4 | 4000 cash, 2 metal-parts | viz kapacitní bonus | warehouse |

Cena dalších výrobních levelů roste geometricky; kompletní parametry jsou v JSON. Sklad má samostatné materiálové ceny:

| Level | Parametry |
|---|---|
| 1 | — |
| 2 | 4000 cleanCashCost, 2 metalPartsCost, 10 incomeBonusPct |
| 3 | 9000 cleanCashCost, 5 metalPartsCost, 1 techCoreCost, 20 incomeBonusPct |
| 4 | 18000 cleanCashCost, 12 metalPartsCost, 3 techCoreCost, 30 incomeBonusPct, 10 heatReductionPct |

**5. Všech 300 šablon městských zakázek**

Jde o definice šablon, ne o seznam současně dostupných úkolů. Aktivní nabídka používá navíc generování a rozpočty obtížnosti; výsledná šance, délka a odměna mohou být jiné. Text příběhu sám neprovádí zásah do území jiného hráče. Přesné nastavení generování a následků je v `config.balance.cityEvents` přiloženého JSON.

**VICTOR — 100 šablon**

| ID / název | Příběh | Obtížnost | Šablona šance % | Šablona min | Odměna šablony | Následky šablony |
|---|---|---|---|---|---|---|
| victor_01 / Rozbitá dodávka | Jedna dodávka zůstala viset v cizím bloku. Dojeď tam, seber bedny a zmiz dřív, než si toho někdo všimne. | medium | 82 | 18 | 5 metal-parts, 700 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_02 / Tvrdé vyjednávání | Jeden obchodník zapomněl, komu má platit. Připomeň mu to po mém. | medium | 78 | 21 | 1400 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_03 / Sklad bez majitele | Ve skladu leží materiál a nikdo ho zrovna nehlídá dost dobře. Udělej to rychle. | medium | 80 | 20 | 4 metal-parts, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_04 / Noční výběr | Po zavíračce bývá město měkký. Vytáhni z toho maximum, než se vzpamatuje. | medium | 74 | 21 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_05 / Převoz pod tlakem | Materiál musí projít přes horkou zónu. Když to zvládneš, lidi si tě začnou pamatovat. | medium | 73 | 21 | 900 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_06 / Rozkopané dveře | Za těma dveřma je schovaná zásoba. Otevři je po svém, já se ptát nebudu. | medium | 76 | 19 | 3 metal-parts, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_07 / Tichá lekce | Jeden malej hráč moc mluví. Nemusí zmizet, stačí aby začal šeptat. | medium | 84 | 17 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_08 / Neonový kufr | Na rohu čeká kufr, kterej nemá dlouho zůstat bez majitele. Buď rychlej. | medium | 77 | 16 | 600 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_09 / Smrad z lékárny | Z jedný lékárny odtéká víc chemie, než je zdravý. Jdi po tom. | medium | 83 | 15 | 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_10 / Ochlazení konkurence | Někdo vedle nás roste moc rychle. Ukaž mu, že asfalt má vždycky poslední slovo. | hard | 70 | 28 | 7 influence, 900 dirty-cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_11 / Pouliční test loajality | Ne každej pod tlakem drží hubu. Ověř, kdo je pevnej a kdo je hadr. | easy | 86 | 14 | 3 influence, 750 cash | 1 successHeat, 3 failureHeat |
| victor_12 / Dvě minuty po půlnoci | V noci mizí kamery, svědci i zábrany. Přesně proto jdeme teď. | hard | 68 | 26 | 2 metal-parts, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_13 / Balík pro špatnou adresu | Někdo čeká zásilku. Jen škoda, že ji čeká marně. | medium | 79 | 18 | 850 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_14 / Krev na parkovišti | Na parkovišti se má uzavřít obchod. Udělej z toho náš obchod. | hard | 66 | 27 | 2000 dirty-cash, 2 metal-parts | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_15 / Kdo stojí, ten bere | Některý rajóny patří těm, co v nich vydrží stát nejdýl. Dneska tam budeš stát ty. | hard | 72 | 30 | 8 influence, 1000 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_16 / Rozebraná zbrojnice | Mám tip na rozebranou dílnu. Posbírej všechno, co ještě střílí nebo se dá prodat. | medium | 75 | 21 | 5 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_17 / Uražená hrdost | Jeden blbec se chtěl zviditelnit na cizím jménu. Teď mu vysvětli, že to byl drahej nápad. | medium | 74 | 21 | 6 influence, 1100 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_18 / Pád z nákladní rampy | Na rampě stojí zboží, co má změnit majitele. Vezmi ho a nic neřeš. | medium | 81 | 19 | 6 metal-parts, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_19 / Hlasitý vzkaz | Někdy nestačí někoho okrást. Někdy musí celej blok vědět, kdo to udělal. | hard | 64 | 24 | 8 influence, 900 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_20 / Mokrý prachy | U vody čeká malej přesun peněz. Když se zdržíš, někdo jiný si namočí ruce místo tebe. | hard | 71 | 22 | 2200 dirty-cash, 2 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_21 / Starý dluh, nová bolest | Starej dluh se dnes zavře. Otázka je jen, jestli penězma nebo zubama. | medium | 79 | 20 | 1600 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_22 / Kontejner číslo 9 | V kontejneru číslo 9 leží věci, co nemají vidět ráno. Otevři ho dřív než ostatní. | medium | 76 | 18 | 3 metal-parts, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_23 / Měkký cíl | Slabej článek řetězu bývá nejlevnější cesta dovnitř. Využij to. | medium | 85 | 16 | 6 influence, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_24 / Velvet Smoke v kufru | V kufru čeká pár balení Velvet Smoke. Převezmi to, než se z toho stane cizí zisk. | medium | 84 | 15 | 500 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_25 / Křik v zadní uličce | Zadní uličky jsou moje kancelář. Dneska tam někomu zrušíš pracovní poměr. | medium | 73 | 19 | 1200 dirty-cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_26 / Rychlý výkup | Jeden zoufalec prodává materiál hluboko pod cenou. Seber to všechno, než dostane rozum. | easy | 88 | 12 | 4 metal-parts | 1 successHeat, 3 failureHeat |
| victor_27 / Tlak na rohu | Na jednom rohu se rozdává respekt zadarmo. To je chyba, kterou dnes opravíš. | medium | 80 | 17 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_28 / Spadlá bedna | Někde spadla bedna z transportu. Kdo ji najde první, ten určuje pravidla. | medium | 77 | 15 | 2 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_29 / Přepálená dávka | Někdo vaří moc nahlas a moc blízko. Vlez tam, seber vzorek a zbytek nech rozpadnout. | hard | 69 | 23 | 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_30 / Drobní, ale naši | Malí dealeři se začínají dívat jinam. Připomeň jim, kde končí každá ulice. | medium | 78 | 20 | 1300 cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_31 / Tichá zbroj | Mám kontakt na vybavení, co nechodí přes papíry. Vyber to a neotáčej se. | medium | 82 | 16 | 500 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_32 / Vyděšený účetní | Jeden účetní ví, kam tečou peníze. A dneska bude chtít mluvit rychle. | hard | 72 | 22 | 1700 dirty-cash, 6 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_33 / První rána zdarma | Dneska nejde o kořist. Dneska jde o to, kdo dá první ránu a kdo si ji zapamatuje. | hard | 67 | 22 | 8 influence, 600 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_34 / Rozbitý automat | Někdo schovává peníze tam, kde si myslí, že vypadají nevinně. Rozbij to a vezmi obsah. | medium | 85 | 15 | 1200 cash, 400 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_35 / Krátká návštěva v docku | V doku kotví něco, co tam nemá vydržet do rána. Přesuneme to dřív. | medium | 74 | 21 | 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_36 / Neonový nátlak | Jeden klub má dneska přinést víc než hudbu. Vlez tam, zatlač a vytáhni z toho hodnotu. | hard | 68 | 25 | 1900 dirty-cash, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_37 / Kov a krev | Tam, kde je kov, bývá i zisk. Tam, kde je zisk, bývá i problém. Dneska si vezmeš oboje. | medium | 80 | 18 | 6 metal-parts, 400 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_38 / Tlačenice u zadního vstupu | Zadní vstup je vždycky levnější než fronta. A mnohem výnosnější. | hard | 71 | 22 | 500 cash, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_39 / Stůl pro dva, problém pro jednoho | V restauraci proběhne schůzka. Ty se postaráš, aby domů neodnesli všechno, co přinesli. | medium | 77 | 21 | 1600 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_40 / Zkušební tlak | Chci vidět, jak makáš, když tě někdo tlačí do zdi. Tahle práce je přesně na to. | medium | 83 | 15 | 6 influence, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_41 / Bazuka ve stínu | Někdo schoval těžší kus železa tam, kde se bojí pro něj vrátit. To není náš problém. | rare | 58 | 30 | 1 combat-module, 500 dirty-cash | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |
| victor_42 / Hluk před bouří | Celý blok je nervózní. To je nejlepší chvíle sebrat to, co není přibitý. | medium | 79 | 18 | 1000 cash, 4 metal-parts, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_43 / Ztracený kamerový záznam | Někdo si myslí, že ho chrání záznam. Zmizí záznam, zmizí i jeho jistota. | medium | 84 | 15 | 2 influence, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_44 / Převzetí směny | Končí směna, začíná chaos. Přesně v tom chaosu vyděláš nejvíc. | medium | 81 | 17 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_45 / Když se nikdo neptá | Tohle je ten druh práce, kde nikdo nic neviděl a nikdo nic neví. Mám tyhle práce rád. | easy | 87 | 13 | 600 cash, 2 influence | 1 successHeat, 3 failureHeat |
| victor_46 / Rozpal ulici | Dneska nechci čistou práci. Dneska chci, aby se o tom mluvilo ještě zítra ráno. | rare | 60 | 26 | 1 smg, 800 dirty-cash | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |
| victor_47 / Pod pultem | Jeden obchod má vzadu něco lepšího než ve výloze. Jdi si pro to. | medium | 85 | 15 | 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_48 / Zlomený alarm | Alarm se dá vypnout dvěma způsoby. Já mám radši ten hlučnější. | medium | 73 | 19 | 3 metal-parts, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_49 / Síla bez omluvy | Někdy je plán přeceňovanej. Vleť tam, udělej tlak a odejdi silnější než jsi přišel. | hard | 69 | 22 | 8 influence, 900 cash, 1 pistol | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_50 / Ulice si pamatuje | Tohle není jen práce. Tohle je podpis. Udělej to tak, aby si město zapamatovalo, kdo tady určuje rytmus. | hard | 63 | 29 | 8 influence, 1400 dirty-cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_51 / Rozkopnutý sklad | Někdo si myslí, že plechové dveře znamenají bezpečí. Dneska zjistí, že jsou to jen dražší třísky. | medium | 79 | 19 | 6 metal-parts, 400 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_52 / Cizí roh | Na našem území si někdo staví vlastní jméno. Sejmi tu pohádku dřív, než jí někdo uvěří. | medium | 75 | 21 | 6 influence, 1000 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_53 / Závora dolů | Jeden vjezd se dnes na chvíli zavře. A všechno, co zůstane uvnitř, bude naše. | medium | 81 | 18 | 4 metal-parts, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_54 / Ruce na kapotu | Na parkovišti stojí auto, co veze víc než plech. Otevři ho a vyber, co se hodí. | medium | 77 | 17 | 800 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_55 / Krátká porada | Jeden chytrák potřebuje vysvětlit realitu. Ty budeš ten výukový materiál. | medium | 84 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_56 / Prachy v mrazáku | Někteří lidi schovávají peníze vedle masa. Dneska rozmrazíš jejich jistoty. | medium | 80 | 16 | 1600 dirty-cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_57 / Přeložená zásilka | Jedna bedna má změnit adresu dřív, než změří teplotu skladu. Nezdržuj se. | medium | 85 | 15 | 600 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_58 / Těžká pěst | Někde nestačí mluvit. Někde musíš nechat odpověď otisknutou ve zdi. | hard | 72 | 22 | 8 influence, 700 dirty-cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_59 / Chybná směna | Ve směnárně mají dneska špatný kurz. Pro ně. Pro nás je to výdělek. | medium | 78 | 18 | 1163 cash, 436 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_60 / Noční inventura | V noci se nejlíp počítá cizí majetek. Zvlášť když si ho ráno už nikdo nespočítá. | medium | 79 | 19 | 5 metal-parts, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_61 / Rozlitá krev, čistý zisk | Někdo si chtěl hrát na tvrdýho. Nech mu tvrdou lekci a měkký kolena. | hard | 68 | 23 | 8 influence, 1000 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_62 / Balík pod mostem | Pod mostem čeká balík bez majitele. A když ho nevezmeš ty, vezme ho někdo rychlejší. | easy | 86 | 13 | 500 cash, 2 influence | 1 successHeat, 3 failureHeat |
| victor_63 / Vymáhání po staru | Ten dluh je malej jen na papíře. Udělej z něj velkej problém, dokud nebude splacenej. | medium | 80 | 17 | 1500 cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_64 / Přístup jen pro tvrdé | Za zadním vstupem leží věci pro lidi bez skrupulí. Tak tam běž jako domů. | medium | 76 | 16 | 3 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_65 / Vybitý kamerový dohled | Někdo se spoléhá na kamery. Dneska mu ukážeš, že kabely křičí míň než lidi. | medium | 83 | 15 | 3 influence, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_66 / Tři minuty strachu | Stačí tři minuty a celej blok začne šeptat. Udělej z nich dlouhý tři minuty. | hard | 69 | 22 | 8 influence, 900 dirty-cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_67 / Lékárna po zavíračce | Po zavíračce zůstává uvnitř víc než jen světla. Posbírej to, co má cenu. | medium | 81 | 18 | 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_68 / Narušený deal | Dva lidi se chtějí domluvit bez nás. To je chyba, kterou je potřeba zpeněžit. | medium | 74 | 20 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_69 / Otevřený kufr | Kufr je otevřenej, nervy taky. Vezmi všechno, co uneseš, a zmiz dřív než cvakne zámek. | medium | 78 | 15 | 700 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_70 / Směna skončila | Když lidi končí směnu, dělají chyby. Ty na těch chybách dneska vyděláš. | medium | 85 | 15 | 1000 cash, 4 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_71 / Přetlačená ulice | Na tý ulici je moc cizích ramen a málo našeho jména. Vyrovnej to. | medium | 76 | 19 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_72 / Náklad bez pojištění | Jeden převoz nemá ochranu ani štěstí. Přesně takový věci mám rád. | medium | 80 | 18 | 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_73 / Páka na účetního | Účetní nejsou tvrdí. Jen vypadají draze. Stlač ho a pustí víc, než čekáš. | medium | 79 | 17 | 1500 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_74 / Betonová lekce | Dneska někdo pochopí, že beton je tvrdší než jeho ego. Ty budeš ten překlad. | hard | 67 | 22 | 8 influence, 800 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_75 / Špinavý schody | Ve vchodu se schází lidi, co zapomněli platit za klid. Připomeň jim sazebník. | medium | 82 | 16 | 1244 cash, 355 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_76 / Nedodaná bedna | Jeden zákazník dneska nic nedostane. Protože všechno skončí v tvých rukách. | medium | 73 | 19 | 2 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_77 / Přesun pod tlakem | Musíš dostat zásobu přes místo, kde všichni čumí. To je přesně chvíle, kdy se pozná, kdo má nervy. | hard | 71 | 22 | 600 cash, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_78 / Vyrvaná jistota | Jeden člověk je moc v pohodě. A pohodlí na ulici bývá dočasná věc. | medium | 81 | 15 | 6 influence, 1000 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_79 / Nabouraný převoz | Nehoda se dá zařídit různě. Hlavní je, aby po ní zůstalo něco použitelného. | hard | 72 | 22 | 6 metal-parts, 700 cash, 2 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_80 / Půlnoční výběrčí | Po půlnoci bývají lidi štědřejší. Hlavně když mají důvod se bát odmítnout. | medium | 75 | 18 | 1600 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_81 / Cizí železo | V dílně zůstalo pár kusů železa bez dozoru. Tak tam nechoď pro dovolení. | medium | 84 | 15 | 6 metal-parts, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_82 / Vysoký tlak, nízký hlas | Někdo mluví moc nahlas o věcech, co by měly zůstat pod stolem. Ztiš ho. | medium | 74 | 17 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_83 / Slepý roh | Na slepým rohu se dneska ztratí jedna zásilka a několik iluzí. | medium | 80 | 16 | 600 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_84 / Rozjetej motor | Motor běží, řidič je nervózní a náklad je cennej. Stačí být rychlejší než panika. | medium | 79 | 18 | 1200 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_85 / Pevná ruka | Někdy je rozdíl mezi chaosem a respektem jen v tom, kdo drží situaci za krk. | hard | 66 | 22 | 8 influence, 700 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_86 / Podlomený obchod | Jeden podnik dneska vydělá míň, než čekal. Protože část zisku půjde domů s tebou. | medium | 81 | 17 | 1219 dirty-cash, 380 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_87 / Špatně zamčený box | Box je zamčenej jen pro slušný lidi. Ty tam nejdeš slušně. | medium | 77 | 15 | 500 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_88 / Řeči z okna | Někdo se dívá z okna a myslí si, že je mimo hru. Připomeň mu, že ulice sahá výš. | medium | 73 | 18 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_89 / Kyselý náklad | Jedna várka chemie se má ztratit cestou. Tak jí pomoz zmizet správným směrem. | medium | 82 | 16 | 500 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_90 / Příliš klidný klub | Ten klub je dneska až moc v klidu. Udělej tam takovej tlak, aby se začalo platit za ticho. | hard | 70 | 23 | 1900 dirty-cash, 4 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_91 / Rozbitý stůl | Když se rozbije stůl, často se otevřou i kapsy. Využij obojí. | medium | 80 | 16 | 1400 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_92 / Přeseknutá dohoda | Někdo si myslí, že může obchodovat bez povolení. Dneska zjistí, že povolení vypadá jako ty. | medium | 75 | 19 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_93 / Kufr plný problémů | V kufru je víc problémů než oblečení. Otevři ho a změň problémy na zásoby. | hard | 65 | 24 | 2 metal-parts, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_94 / Kroky ve skladu | Sklad dneska nebude tichej. A po tvým odchodu nebude ani plnej. | medium | 81 | 18 | 5 metal-parts, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_95 / Poslední varování | Někdo už jedno varování dostal. Teď dostane takový, co se nedá přeslechnout. | hard | 68 | 22 | 8 influence, 900 cash | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_96 / Vlhký bankovky | U přístavu se dneska lepí bankovky na špatný ruce. Ty máš zařídit, aby se lepily na správný. | hard | 72 | 22 | 2100 dirty-cash, 3 influence | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |
| victor_97 / Odtržená směna | Jedna parta dneska nedokončí směnu v pohodě. A ty z toho vytáhneš, co půjde. | medium | 82 | 17 | 1000 cash, 4 metal-parts, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_98 / Tvrdý přepočet | Když se špatně přepočítáš na ulici, někdo jiný si to spočítá za tebe. Jdi jim pomoct s matematikou. | medium | 76 | 18 | 1500 cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_99 / Díra v plotě | Každý plot má slabý místo. A za každým slabým místem bývá něco, co se dá odnést. | medium | 84 | 15 | 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| victor_100 / Victorův podpis | Tohle není jen další práce. Tohle je připomínka všem v okolí, kdo má v ulicích poslední slovo. | hard | 62 | 27 | 8 influence, 1500 dirty-cash, 3 metal-parts | 4 successHeat, 10 failureHeat, 400 failureDirtyCashLoss |

**LEON — 100 šablon**

| ID / název | Příběh | Obtížnost | Šablona šance % | Šablona min | Odměna šablony | Následky šablony |
|---|---|---|---|---|---|---|
| leon_01 / Kšeft z kufru | Na parkovišti stojí kufr plnej věcí, co oficiálně neexistujou. Přijeď, zaplať správně a zmiz dřív, než se někdo začne ptát. | medium | 85 | 15 | 4 metal-parts, 2 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_02 / Levný zboží, drahý následky | Mám deal, kterej smrdí už z dálky. Ale marže je krásná. Vem to, než to někdo vyžere před tebou. | medium | 80 | 16 | 1120 cash, 480 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_03 / Kontakt ze zadní uličky | Jeden můj kontakt chce mluvit jen venku, mezi odpadkama a špínou. Což většinou znamená, že nabídka stojí za to. | medium | 84 | 15 | 4 influence, 4 chemicals, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_04 / Přeprodej bez otázek | Dostaneš zboží. Neptáš se odkud je. Jen ho otočíš rychle a draze. Přesně tak se vydělává ve městě. | easy | 87 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_05 / Špinavý kontakt | Jeden kontakt je nervózní a chce se něčeho zbavit. Ty budeš ten, kdo mu uleví od nákladu i od peněz. | medium | 79 | 17 | 700 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_06 / Zboží pod pultem | Ve výloze nic není. Ale pod pultem leží věci, kvůli kterým se vyplatí přijít zadním vchodem. | medium | 78 | 16 | 500 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_07 / Rychlá otočka | Koupíš levně, prodáš rychle, zmizíš dřív, než někdo zjistí, že byl právě obranej. Klasika. | easy | 89 | 12 | 789 cash, 210 dirty-cash | 1 successHeat, 3 failureHeat |
| leon_08 / Zásilka bez jména | Přijde bedna bez jména, bez papírů a bez výmluv. To bývají ty nejlepší obchody. | easy | 86 | 14 | 3 metal-parts | 1 successHeat, 3 failureHeat |
| leon_09 / Přehazovačka | Dvě party si mají předat zboží. Ty zařídíš, aby po cestě změnilo majitele i cenu. | medium | 77 | 18 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_10 / Sleva za ticho | Jeden prodejce udělá hezkou cenu. Protože ví, že když ji neudělá, může přestat prodávat úplně. | medium | 85 | 15 | 1 velvet-smoke, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_11 / Noční burza | Po půlnoci se otevírá trh pro lidi, co nechtějí účtenky. Tam chodí skutečný peníze. | medium | 81 | 17 | 1252 cash, 347 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_12 / Falešný prostředník | Jedna schůzka potřebuje prostředníka. Ty budeš ten prostředník. A taky ten, kdo si ukousne největší část. | easy | 86 | 14 | 3 influence, 1000 cash | 1 successHeat, 3 failureHeat |
| leon_13 / Drahá adresa | Někdy neprodáváš zboží. Někdy prodáváš jen to, že víš, kam jít a na koho zatlačit. | medium | 84 | 15 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_14 / Kradený kov | Mám partu, co tahá kov z míst, kde už ho nikdo nebude postrádat. Otoč to na trhu, než vystydne stopa. | medium | 82 | 16 | 6 metal-parts, 400 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_15 / Kapsy plný marže | Dneska nejde o sílu. Dneska jde o to, kdo vytěží víc z cizí blbosti. A to jsi ty. | easy | 90 | 12 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_16 / Podivný léky | Někdo prodává farmaceutický zásoby bokem. Kvalita pochybná, zisk krásnej. Takže to bereme. | medium | 80 | 18 | 6 chemicals, 40 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_17 / Překupník v běhu | Jeden malej překupník panikaří a chce všechno střelit hned. Vezmi mu to za směšnou cenu. | easy | 91 | 11 | 300 cash, 3 metal-parts, 2 influence | 1 successHeat, 3 failureHeat |
| leon_18 / Druhá ruka, první zisk | Tohle zboží už někdo vlastnil. A teď ho budeš vlastnit ty. Krátce. Než ho prodáš ještě dráž. | medium | 78 | 16 | 900 dirty-cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_19 / Směna ve tmě | Žádný světla, žádný jména, žádný potvrzení. Jen deal a rychlý ruce. | medium | 85 | 15 | 1 velvet-smoke | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_20 / Kontakt z druhý strany města | Mám tip z části města, kam normálně nechodíš. Což je přesně důvod, proč tam leží prachy. | medium | 83 | 15 | 5 influence, 1100 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_21 / Nadupaná přirážka | Někdo něco zoufale potřebuje. A zoufalství je jen jiný slovo pro vyšší cenu. | easy | 88 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_22 / Kšeft mezi popelnicema | Když se velký peníze řeší mezi popelnicema, většinou z toho něco kápne i bokem. Dneska hodně. | medium | 79 | 17 | 1480 dirty-cash, 2 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_23 / Dveře bez cedule | Za jedněma neoznačenýma dveřma čeká nabídka, co se nebude opakovat. Buď první uvnitř. | medium | 77 | 18 | 1 tech-core, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_24 / Tichý přepočet | Někdo se přepočítal v náš prospěch. A ty mu teď pomůžeš tu chybu už nenapravit. | easy | 89 | 12 | 750 cash, 250 dirty-cash | 1 successHeat, 3 failureHeat |
| leon_25 / Otoč to, než to shnije | Jedna várka je horká, jedna špinavá a jedna se kazí. Neřeš která je která. Prostě to otoč. | medium | 81 | 16 | 4 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_26 / Fix za fixem | Dneska neprodáváš věc. Dneska prodáváš řešení. A řešení ve městě bývají dražší než kulky. | medium | 85 | 15 | 6 influence, 1200 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_27 / Sektorovej překup | Co je levný v jednom sektoru, je drahý v druhým. A ty budeš ten most mezi chamtivostí a nouzí. | easy | 86 | 14 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_28 / Balíček pro nervózního klienta | Klient chce diskrétnost. To znamená vyšší cenu a rychlejší nohy. Obojí máš. | medium | 80 | 17 | 800 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_29 / Cizí problém, náš zisk | Někdo má moc zboží, málo času a nulovou páteř. Přesně z takových se žije nejlíp. | medium | 84 | 15 | 5 metal-parts, 700 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_30 / Pouliční licence | Na tomhle bloku nikdo neprodává bez toho, aby něco neodvedl. Dneska vybíráš ty. | medium | 82 | 16 | 1120 cash, 480 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_31 / Zlomený řetězec | Jeden dodavatelský řetězec právě praskl. A ty posbíráš, co z něj vypadne na zem. | medium | 85 | 15 | 5 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_32 / Přestřelená cena | Někdo chce moc. Ty mu zaplatíš málo. A ještě na tom vyděláš. Tomu říkám obchod. | easy | 90 | 11 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_33 / Tichý runner | Potřebuju, aby něco přešlo přes tři bloky a nikdo to nezastavil. Žádná sláva, jen čistý profit. | easy | 86 | 13 | 1000 cash, 2 influence | 1 successHeat, 3 failureHeat |
| leon_34 / Výprodej strachu | Když začne někdo panikařit, prodává hluboko pod cenou. A my jsme přesně ti, co to umí využít. | easy | 91 | 12 | 4 metal-parts | 1 successHeat, 3 failureHeat |
| leon_35 / Spodní police | To nejlepší zboží nebývá na očích. Bývá dole, za plentou, mezi věcma bez původu. | medium | 79 | 16 | 1 velvet-smoke | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_36 / Dohoda na rohu | Na rohu čeká deal. Malej stůl, špinavý ruce, velký peníze. Nezvor to. | medium | 80 | 17 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_37 / Sběrač marže | Dva blbci se hádají o cenu. Ty přijdeš mezi ně a odejdeš s největším kusem. | easy | 87 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_38 / Krabice bez původu | Mám tři krabice. Jedna je legální, druhá ne a třetí je nejlepší neotvírat. Vezmi všechny. | medium | 78 | 18 | 3 chemicals, 3 metal-parts, 220 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_39 / Pouliční arbitráž | Jedna strana má zboží, druhá peníze a obě mají málo mozku. Ty z toho vytěžíš nejvíc. | easy | 88 | 12 | 818 cash, 181 dirty-cash | 1 successHeat, 3 failureHeat |
| leon_40 / Tlačenice o bedny | Došlo pár beden a pár lidí po nich skočí. Ty skočíš rychlejc a prodáš je s přirážkou. | medium | 79 | 16 | 1 tech-core, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_41 / Klient bez nervů | Můj klient se sype a chce všechno hned. Tak mu to dej. Ale draho. | easy | 86 | 13 | 750 cash, 250 dirty-cash | 1 successHeat, 3 failureHeat |
| leon_42 / Zadní schodiště | Na zadním schodišti se dneska budou měnit ruce, kapsy a loajalita. Buď u toho první. | medium | 84 | 15 | 5 influence, 1000 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_43 / Přeskládání trhu | Jedna várka zmizí z trhu a jiná se objeví za dvojnásobek. Krása volný ulice. | medium | 81 | 17 | 1600 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_44 / Vypůjčený sklad | Na pár minut si půjčíš cizí sklad. Na pár hodin z něj budeš žít. | medium | 80 | 18 | 6 metal-parts, 1 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_45 / Nelegální přirážka | Některý věci jsou drahý proto, že jsou vzácný. Jiný proto, že za ně můžeš skončit v problému. Tohle je ten druhý případ. | medium | 74 | 19 | 800 cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_46 / Šeptaná nabídka | Když někdo šeptá cenu, většinou ví, že je buď moc dobrá, nebo moc špinavá. Mně jsou sympatický obě možnosti. | medium | 80 | 15 | 1500 dirty-cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_47 / Pouliční broker | Dneska seš prostředník mezi hladovejma rukama a plným bednama. A prostředník bere vždycky první kus. | easy | 87 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_48 / Přepálený zájem | Když někdo něco chce až moc, přestává řešit cenu. A přesně v tu chvíli přicházíš ty. | easy | 89 | 12 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_49 / Černý seznam kontaktů | Mám seznam jmen, adres a slabin. Nechci ho celý. Stačí mi, když z něj vytěžíš maximum. | medium | 82 | 16 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_50 / Leonův řez | Pamatuj si to. V tomhle městě nevyhrává ten, kdo něco má. Vyhrává ten, kdo si z každýho kšeftu ukousne největší kus. Dneska to budeš ty. | rare | 65 | 25 | 1 overdrive-x, 500 dirty-cash | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |
| leon_51 / Krabice od špíny | Na kraji sektoru čeká pár beden, co už prošly moc rukama. Smrdí, jsou kradený a přesně proto na nich vyděláš nejvíc. | medium | 82 | 16 | 5 metal-parts, 1 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_52 / Obchod se strachem | Jeden malej dealer se bojí, že ho někdo obere. Nabídni mu ochranu. Drahou, špinavou a povinnou. | medium | 81 | 15 | 1500 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_53 / Přesunutá zásilka | Jedna zásilka má dojet jinam. Ty zařídíš, že skončí u nás. Bez hluku, bez výčitek, se ziskem. | medium | 80 | 17 | 5 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_54 / Vysátý sklad | Ve skladu zůstalo víc, než měl majitel přiznat. Tak mu pomůžeme s inventurou po svým. | medium | 76 | 19 | 6 metal-parts, 400 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_55 / Cena za mlčení | Někdo viděl víc, než měl. Nech ho pochopit, že ticho je levnější než nemocnice. | medium | 78 | 16 | 1400 dirty-cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_56 / Přeprodej krve | Po jednom špinavým střetu zůstalo na zemi vybavení. Posbírej to a otoč to, než zaschne krev. | medium | 74 | 18 | 3 metal-parts, 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_57 / Mokrej deal u kanálu | U kanálu se mají měnit ruce, peníze a loajalita. Dohlídni, aby všechno skončilo v našich kapsách. | medium | 80 | 17 | 1600 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_58 / Špatná adresa, dobrý zisk | Jedna zásilka půjde na špatnou adresu. A ta adresa bude naše. Někdy je logistika krásná věc. | easy | 86 | 14 | 2 chemicals | 1 successHeat, 3 failureHeat |
| leon_59 / Rozprodej paniky | Když se někdo začne bát razie, prodá i vlastní boty. Kup levně všechno, co pustí z ruky. | easy | 88 | 13 | 4 metal-parts | 1 successHeat, 3 failureHeat |
| leon_60 / Špinavé procento | Dva idioti chtějí udělat obchod. Ty jim ho umožníš. A ukousneš si takovej podíl, že je to bude bolet až doma. | easy | 87 | 14 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_61 / Bedny z rozbité dodávky | Na krajnici stojí dodávka, co nedojela. Někdo brečí nad plechem, ty vyděláš na obsahu. | medium | 83 | 16 | 1 chemicals, 5 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_62 / Šelma mezi překupníky | Na trhu je moc hladových krys. Buď největší z nich a stáhni jim nejlepší kusy přímo před nosem. | medium | 82 | 15 | 1219 cash, 380 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_63 / Kontakty v bordelu | Nejlepší informace neleží v kanceláři. Leží v zakouřeným bordelu mezi lidma, co mluví, když si myslí, že jsou v bezpečí. | medium | 81 | 17 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_64 / Levný kulky, drahá noc | Někdo se chce zbavit železa, než přijde kontrola. Seber to levně a pošli dál ještě před svítáním. | medium | 73 | 19 | 700 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_65 / Kapsářský velkoobchod | Malej zloděj ukradl víc, než zvládne prodat. Tak ho odlehči. Klidně i od iluzí. | easy | 89 | 12 | 300 cash, 3 metal-parts, 2 influence | 1 successHeat, 3 failureHeat |
| leon_66 / Přehoz přes sektor | V jednom sektoru je bída, v druhým hlad. Ty propojíš jedno s druhým a zbytek shrábneš. | easy | 86 | 14 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_67 / Ostrá přirážka | Klient chce zboží hned. To znamená jediný: zvedni cenu, usměj se a nech ho krvácet do peněženky. | easy | 90 | 11 | 863 cash, 136 dirty-cash | 1 successHeat, 3 failureHeat |
| leon_68 / Zadní pokoj | V zadním pokoji se dneska budou přehazovat věci, co neměly opustit sklad. Dohlídni, aby opustily i majitele. | medium | 80 | 16 | 3 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_69 / Srážka zájmů | Dvě party chtějí to samý zboží. Ty jim prodáš naději, chaos a nakonec to zinkasuješ celý. | medium | 79 | 17 | 1600 cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_70 / Oškrabaná marže | Na dealu už si ukousli jiní. Ty z toho seškrábneš poslední vrstvu. A ta bývá nejtučnější. | easy | 86 | 13 | 750 dirty-cash, 250 cash | 1 successHeat, 3 failureHeat |
| leon_71 / Výprodej slabosti | Někdo potřebuje rychle cash a prodá všechno pod cenou. Ty potřebuješ jen přijít včas a bejt bez slitování. | easy | 92 | 12 | 4 metal-parts | 1 successHeat, 3 failureHeat |
| leon_72 / Rozsypaný lékárenský zboží | Po jedný hádce zůstalo pár beden z lékárny bez dozoru. Posbírej to a prodej to dřív, než se majitel probere. | medium | 82 | 16 | 6 chemicals, 40 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_73 / Prašivej broker | Dneska nebudeš obchodník. Dneska budeš hyena s kontakty. A hyeny se v tomhle městě nají nejlíp. | easy | 88 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_74 / Dohoda v dešti | Když prší, lidi méně koukají. To je ideální chvíle poslat špinavý zboží přes půl bloku. | medium | 85 | 15 | 1 velvet-smoke | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_75 / Výběr od zoufalců | Dneska neokradeš bohatý. Dneska vytěžíš zoufalý. A zoufalí platí nejrychlejc. | medium | 84 | 15 | 1600 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_76 / Překup za rozbitým barem | Za jedním rozbitým barem čeká týpek s věcma, co by oficiálně měly být zamčený jinde. Tak je oficiálně přesuň k nám. | medium | 79 | 17 | 2 chemicals, 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_77 / Křivá směnka | Někdo se upsál špatným lidem. Ty od něj koupíš dluh za drobný a vybereš ho jako plnou cenu. | medium | 81 | 16 | 1309 cash, 290 dirty-cash, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_78 / Špinavý přepočet beden | Na papíře jich je deset. Ve skutečnosti jich může zmizet dvanáct. Takovej účetnictví já respektuju. | medium | 80 | 16 | 5 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_79 / Přepálený zájemce | Jeden kupec chce zboží tak moc, že už necítí pach podrazu. Přesně takový mám nejradši. | easy | 89 | 11 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_80 / Rozřezaná trasa | Běžná přepravní trasa je dneska mrtvá. Vezmeš náklad bokem a z marže uděláš malý svinstvo. | easy | 87 | 14 | 4 metal-parts | 1 successHeat, 3 failureHeat |
| leon_81 / Sektorový pijavice | Na každým sektoru visí někdo, kdo už saje moc dlouho. Dneska ho odsajeme my. | medium | 77 | 18 | 1600 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_82 / Levná bolest, drahý zisk | Někdo prodá cennej materiál jen proto, aby přežil noc. Ty si z jeho bolesti uděláš obchodní model. | easy | 86 | 14 | 2 influence | 1 successHeat, 3 failureHeat |
| leon_83 / Kufr po mrtvým dealu | Po jednom zpackaným setkání zůstal kufr bez dozoru. Otevři ho a udělej z cizího průseru náš profit. | medium | 75 | 18 | 900 dirty-cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_84 / Prodej přes bolest | Někdy nestačí nabídnout cenu. Někdy musíš nabídnout i důvod, proč ji mají přijmout bez keců. | medium | 82 | 15 | 1600 cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_85 / Rozebranej kontejner | V přístavu někdo otevřel, co otevřít neměl. Posbírej zbytky a pošli je dál, než přijdou uniformy. | medium | 76 | 19 | 6 metal-parts, 1 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_86 / Pobodaná nabídka | Jeden obchod skončil nožem ve stole. To znamená dvě věci: méně zájemců a víc prostoru pro nás. | medium | 74 | 18 | 700 cash, 400 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_87 / Otočka přes špínu | Tohle zboží je tak špinavý, že by si zasloužilo vlastní kanalizaci. Přesně proto má krásnou marži. | medium | 83 | 15 | 3 chemicals | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_88 / Rozšlapaný kontakt | Jeden kontakt dostal přes hubu a chce zmizet. Nech ho zmizet. Ale nejdřív z něj vytáhni všechno cenný. | medium | 84 | 15 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_89 / Přesun černé várky | Várka je horká, sektor nervózní a čas krátkej. Přesuň to, než se někdo začne zajímat moc. | medium | 82 | 16 | 4 chemicals, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_90 / Drahý mlčení u stolu | U jednoho stolu sedí lidi, co by spolu normálně nemluvili. Ty jim pomůžeš najít společnou řeč. Za velmi nepříjemnou cenu. | medium | 80 | 17 | 1600 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_91 / Prohnilý deal | Ten kšeft je prohnilej od základu. Ale i z prohnilýho dřeva se dá postavit pěkně hnusnej zisk. | easy | 86 | 13 | 800 dirty-cash, 200 cash | 1 successHeat, 3 failureHeat |
| leon_92 / Tahání za nitky | Dneska nebudeš tahat bedny. Dneska budeš tahat lidi. A lidi se prodávají ještě líp než zboží. | medium | 83 | 16 | 6 influence, 1000 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_93 / Sklad pro krysy | Jeden sklad je tak děravej, že si z něj bere každej. Dneska si z něj vezmeme nejvíc my. | medium | 84 | 15 | 6 metal-parts, 400 cash, 2 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_94 / Zuby trhu | Trh není místo pro obchodníky. Je to místo pro predátory. Tak koukej kousat. | easy | 88 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| leon_95 / Rozkradený papíry | Některý zásilky cestují díky razítku. Dneska se postaráš, aby papíry zmizely a zboží zůstalo nám. | medium | 81 | 16 | 1 tech-core, 3 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_96 / Překupnický masakr | Na jednom rohu se dneska roztrhá několik překupníků o stejnou věc. Ty to vezmeš první a prodáš jim to zpátky dráž. | medium | 79 | 17 | 1600 cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_97 / Vydřená marže | Tohle nebude hezkej obchod. Tohle bude špinavý, tvrdý a přesně tak výdělečný, jak to mám rád. | medium | 78 | 18 | 1600 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_98 / Dodávka z pekla | Jedna dodávka veze tolik bordelu, že by ji nikdo neměl vidět. Postarej se, aby ji nikdo ani nedopočítal. | medium | 77 | 19 | 1 chemicals, 5 metal-parts | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_99 / Řez z každý kapsy | Dneska nebudeš brát jen z jednoho zdroje. Dneska si ukousneš z každý kapsy, co se v sektoru pohne. | medium | 82 | 16 | 1280 cash, 320 dirty-cash, 4 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| leon_100 / Leonova špinavá škola | Zapamatuj si to. Ulice nepatří tomu, kdo má čistý ruce. Patří tomu, kdo umí z každýho svinstva udělat zisk. Dneska budeš učit ostatní. | rare | 65 | 25 | 1 ghost-serum, 500 dirty-cash | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |

**NYRA — 100 šablon**

| ID / název | Příběh | Obtížnost | Šablona šance % | Šablona min | Odměna šablony | Následky šablony |
|---|---|---|---|---|---|---|
| nyra_01 / Špatně zamčený telefon | Jeden idiot nechal telefon bez dozoru a bez zámku. Vezmi z něj všechno, co se dá prodat, zneužít nebo poslat správným lidem. | easy | 86 | 14 | 3 influence, 700 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_02 / Šeptaná slabina | V každém sektoru je někdo, kdo ví příliš moc a pije příliš levně. Sedni si k němu a nech ho mluvit. | easy | 88 | 13 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_03 / První lež zdarma | Rozšiř mezi správné uši malou lež. Když se chytne, ostatní udělají zbytek práce za tebe. | medium | 84 | 15 | 6 influence, 500 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_04 / Fotka, která bolí | Jedna fotka má větší váhu než zásobník. Získej ji a pak sleduj, jak rychle se mění loajalita za ticho. | medium | 82 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_05 / Odcizený seznam | Někdo si vede seznam jmen, adres a dluhů. Ten seznam dnes změní majitele. A s ním i půlku města. | medium | 80 | 17 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_06 / Cizí paranoia | Není třeba někoho zničit. Stačí, aby začal pochybovat o lidech kolem sebe. To už zvládne rozebrat zbytek sám. | medium | 85 | 15 | 6 influence, 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_07 / Ztracený přístup | Jeden přístupový kód se má ztratit. Ty se postaráš, aby se ztratil správnému člověku do kapsy. | medium | 83 | 15 | 4 influence, 500 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_08 / Vydírání bez hlasu | Někdy není potřeba říct ani slovo. Jen poslat správný důkaz na správné místo a počkat, kdo přijde platit první. | medium | 79 | 16 | 1200 dirty-cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_09 / Nastražená zpráva | Pošli jednu zprávu tak, aby vypadala, že přišla od někoho jiného. Lidi jsou překvapivě ochotní si ničit životy sami. | medium | 78 | 17 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_10 / Tichá výměna | Na střeše proběhne výměna informací. Ty se neukážeš. Jen zajistíš, že jedna strana odejde chudší a druhá vyděšená. | medium | 84 | 15 | 5 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_11 / Rozbitá důvěra | Dva lidi si ještě pořád věří. To je chyba, kterou dnes opravíš. | medium | 83 | 15 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_12 / Záznam z chodby | Na jedné chodbě visí kamera, která viděla víc, než by měla. Stáhni záznam dřív, než ho smaže někdo jiný. | medium | 85 | 15 | 6 influence, 700 cash, 300 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_13 / Toxický drb | Jedna dobře vypuštěná informace dokáže otrávit celý sektor. Vypusť ji jemně a sleduj, kdo se začne dusit první. | medium | 77 | 18 | 6 influence, 500 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_14 / Dívka u baru | Některé dveře neotevře páčidlo, ale úsměv a dvě správné otázky. Dnes otevřeš právě takové. | easy | 89 | 12 | 3 influence, 900 cash | 1 successHeat, 3 failureHeat |
| nyra_15 / Složka bez jména | V jedné zásuvce leží složka, která nemá existovat. Vezmi ji a připomeň městu, že papír někdy řeže hlouběji než nůž. | medium | 80 | 16 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_16 / Podvržený podpis | Stačí jeden podpis na špatném místě a někdo se probudí s hodně drahým problémem. | medium | 79 | 17 | 1000 cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_17 / Noční odposlech | Na jednu noc zapojíš uši tam, kam nepatří. To, co zachytíš, prodáš třikrát různým lidem. | medium | 81 | 18 | 1100 dirty-cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_18 / Jméno na seznamu | Jedno jméno se objeví na špatném seznamu. A pak už jen sleduj, jak rychle začne jeho majitel panikařit. | medium | 84 | 15 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_19 / Špína v archivu | Nejlepší tajemství nejsou na ulici. Jsou uložená, seřazená a čekají, až je někdo použije správným způsobem. | medium | 82 | 15 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_20 / Falešná stopa | Naveď lovce na špatnou adresu a kořist zůstane bez dozoru. Krása manipulace je v tom, že nikdo neví, kdo začal. | easy | 86 | 14 | 900 cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_21 / Cizí heslo | Někdo používá stejné heslo všude. Smutné. Ale výdělečné. | easy | 90 | 11 | 3 influence, 727 cash, 272 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_22 / Přítelkyně problému | Dnes se nebudeš prát. Dnes někomu nabídneš řešení, které ho udělá závislým na další schůzce s námi. | medium | 85 | 15 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_23 / Šepot na schodišti | Na schodišti se dnes řekne něco, co nemělo nikdy zaznít nahlas. Ty budeš stát dost blízko, aby to mělo cenu. | easy | 88 | 12 | 3 influence, 700 cash | 1 successHeat, 3 failureHeat |
| nyra_24 / Zkažený deal | Není třeba obchod zastavit. Stačí ho jen trochu pokazit, aby se obě strany začaly navzájem podezírat. | medium | 79 | 16 | 6 influence, 600 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_25 / Sklenička navíc | Lidi po třetí skleničce říkají věci, za které by ráno platili. Ty jim tu šanci dáš. | easy | 91 | 11 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_26 / Zamčená minulost | Každý má minulost, kterou by nejradši utopil. Ty ji jen vytáhneš na hladinu a nabídneš ručník za správnou cenu. | medium | 78 | 17 | 1300 dirty-cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_27 / Slabé místo aliance | Každá aliance má člena, co drží hubu jen do chvíle, než dostane správnou nabídku. Najdi ho. | medium | 80 | 18 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_28 / Cizí deník | Papír snese všechno. A některé papíry snesou dost na to, aby někdo začal platit pravidelně. | medium | 84 | 15 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_29 / Otrávené podezření | Stačí zasít malou pochybnost a sledovat, jak si ji lidi zalijí vlastní panikou. | medium | 77 | 17 | 6 influence, 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_30 / Tichá výstraha | Ne všichni potřebují dostat přes hubu. Některým stačí obálka bez odesílatele a špatný spánek na týden dopředu. | medium | 85 | 15 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_31 / Přesměrovaná nenávist | Dneska někoho nenasměruješ k cíli. Nasměruješ ho k omylu. A omyly v našem městě bývají smrtelně drahé. | medium | 79 | 16 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_32 / Stará hlasová schránka | Někdo zapomněl smazat hlasovky. Ty zapomeneš mít slitování. | easy | 86 | 12 | 1000 dirty-cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_33 / Zblízka a bez otisků | Potřebuju, abys byl dost blízko na to slyšet pravdu a dost chytrej na to, abys po sobě nic nenechal. | medium | 84 | 15 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_34 / Lehký dotek chaosu | Nebudeme rozbíjet dveře. Jen jemně zatlačíme na správné lidi a zbytek město rozebere samo. | medium | 78 | 16 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_35 / Smazaná kamera | Někde chybí pár minut záznamu. Postarej se, aby chyběly přesně ty, které potřebujeme. | easy | 87 | 12 | 900 cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_36 / Noční návštěva | Dnes někomu necháš za dveřmi důkaz, který tam neměl nikdy být. A pak počkáš, kdo začne křičet první. | medium | 80 | 15 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_37 / Dva kroky od zrady | Zrada nezačíná nožem do zad. Začíná jednou pochybností a správně položenou otázkou. | medium | 76 | 18 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_38 / Kapesní tajemství | Malé USB, velké problémy. Najdi ho a pak rozhodneme, kdo si za jeho návrat zaplatí nejvíc. | medium | 85 | 15 | 1200 dirty-cash, 5 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_39 / Rozhovor za plentou | Za jednou tenkou stěnou se dnes probere něco, co může rozpárat celý sektor. Naslouchej. | easy | 89 | 12 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_40 / Podvržená účast | Někdo bude vypadat, jako že byl na místě, kde nikdy nestál. A někdo jiný za to zaplatí, aby to zmizelo. | medium | 79 | 17 | 1100 dirty-cash, 6 influence | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_41 / Zaměněná obálka | Stačí jedna obálka v nesprávných rukách a celý večer dostane nový směr. | easy | 86 | 13 | 900 cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_42 / Přepnutá loajalita | Někteří lidé nejsou věrní. Jen ještě nedostali lepší nabídku. Dnes ji dostanou. | medium | 81 | 16 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_43 / Křehká pověst | Pověst je sklo. Jedna prasklina a zbytek už udělá tlak okolí. Ty uděláš tu prasklinu. | medium | 83 | 15 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_44 / Vzkaz bez podpisu | Pošli vzkaz, který nebude znít jako hrozba. Jen jako něco, co by si chytrý člověk neměl dovolit ignorovat. | easy | 87 | 12 | 1000 dirty-cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_45 / Druhé dno šuplíku | Vždycky mě zajímá, co lidi schovávají pod tím, co schovávají. Tam bývá skutečná cena. | medium | 85 | 15 | 6 influence, 900 cash, 300 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_46 / Zlá kombinace | Spoj dvě pravdy s jednou lží a dostaneš příběh, který rozbije víc vztahů než pistole kolen. | medium | 78 | 17 | 6 influence, 600 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_47 / Stín za zády | Někdo musí mít pocit, že ho někdo sleduje. A ten pocit ho má stát peníze. | easy | 86 | 13 | 1000 cash, 3 influence | 1 successHeat, 3 failureHeat |
| nyra_48 / Šepot v síti | Dnes nevypustíš zprávu do ulic. Dnes ji pustíš do správných kanálů a necháš ji udělat ošklivější práci tiše. | medium | 80 | 16 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_49 / Pád masky | Každý někde hraje roli. Najdi místo, kde se zapomněl převléct zpátky do své lži. | medium | 79 | 16 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_50 / Nyřin tah | Pamatuj si to. Kulka udělá díru. Tajemství udělá prázdno. Dneska v tom prázdnu vyděláme víc než ostatní za celou noc. | rare | 65 | 25 | 1 overdrive-x, 8 influence | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |
| nyra_51 / Druhá obálka | První obálka člověka znervózní. Druhá ho připraví o spánek. Doruč tu druhou a nech ho přemýšlet, co všechno ještě víme. | easy | 86 | 14 | 3 influence, 900 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_52 / Prasklina v hlavě | Někdy není potřeba někoho zlomit. Stačí mu do hlavy zasadit jednu otázku, která tam začne hnít. | medium | 84 | 15 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_53 / Cizí hlas ve tmě | Jedna zpráva přehraná správným hlasem dokáže rozebrat víc než zbraň. Pošli ji a nech jejich jistoty umřít potichu. | medium | 81 | 16 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_54 / Ztráta jistoty | Dnes nikomu nevezmeš peníze. Dnes mu vezmeš pocit bezpečí. A ten bývá dražší. | medium | 79 | 17 | 6 influence, 600 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_55 / Nespolehlivá vzpomínka | Přesvědč někoho, že si pamatuje věc, která se nikdy nestala. Lidi si zbytek lži dopíšou sami. | medium | 78 | 18 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_56 / Ztracený klid | Jedna maličkost zmizí z bytu, druhá se objeví na špatném místě. A najednou začne mít někdo pocit, že už není sám. | medium | 85 | 15 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_57 / Zrcadlo bez odrazu | Každý má obraz sám o sobě. Ty ho dnes rozbiješ a necháš střepy, aby řezaly ještě dlouho potom. | medium | 76 | 19 | 6 influence, 600 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_58 / Špatná hodina | Vzbuď někoho uprostřed noci zprávou, která nedává smysl. Ráno už ho bude rozkládat vlastní představivost. | easy | 90 | 11 | 3 influence, 700 cash | 1 successHeat, 3 failureHeat |
| nyra_59 / Tenká nitka loajality | Důvěra není zeď. Je to nit. A dnes ji stačí jen lehce naříznout. | medium | 80 | 16 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_60 / Zapomenutý klíč | Někdo najde klíč, který nikdy nevlastnil. Přesně od chvíle, kdy ho vezme do ruky, začne přemýšlet, co všechno už někdo otevřel před ním. | easy | 86 | 13 | 3 influence, 727 cash, 272 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_61 / Úsměv a jed | Nejhorší rány nepřicházejí v hněvu. Přicházejí s klidem, úsměvem a přesně zvolenou větou. | easy | 87 | 12 | 3 influence, 800 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_62 / Hlas na druhém konci | Jedno anonymní zavolání. Jeden správný tón. Jeden večer, který už nikdy nebude normální. | medium | 85 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_63 / Návštěva bez svědků | Někdy stačí, aby někdo zahlédl stín za dveřmi a už si nikdy nebude jistý, jestli byl sám. | medium | 81 | 15 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_64 / Zpožděná pravda | Pravda je nejjedovatější, když přijde pozdě. Doruč ji přesně ve chvíli, kdy už nikdo nebude věřit vysvětlení. | medium | 79 | 17 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_65 / Křehký dech | Připomeň někomu, jak moc snadno se může zlomit jeho svět. Ne silou. Jen přesností. | medium | 80 | 16 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_66 / Prázdná židle | Na schůzce nech jednu židli prázdnou a jednu informaci navíc. Paranoia pak zaplní zbytek místnosti sama. | easy | 86 | 13 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_67 / Kroky za zády | Nech někoho slyšet kroky tam, kde nikdo není. To, co si domyslí, bude horší než skutečnost. | medium | 77 | 18 | 6 influence, 600 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_68 / Rozladěné nervy | Rozbij někomu rytmus dne. Jeden telefon ráno, jeden vzkaz večer, jedna cizí věc doma. Pak už se rozbije sám. | easy | 88 | 12 | 3 influence, 700 cash | 1 successHeat, 3 failureHeat |
| nyra_69 / Otevřená rána | Každý má místo, kam se nevrací. Ty ho tam dnes pošleš zpátky, aniž bys se ho dotkla. | medium | 78 | 17 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_70 / Cizí oči | Někdo musí uvěřit, že je sledovaný. Ne proto, že to je pravda. Ale protože strach platí rychleji než důkazy. | medium | 85 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_71 / Jemné rozvrácení | Nezničíš skupinu útokem. Zničíš ji tím, že si každý začne myslet, že ostatní něco skrývají. | medium | 79 | 18 | 6 influence, 700 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_72 / Jed v tichu | Některé věci není třeba říkat nahlas. Stačí je nechat v hlavě správného člověka dost dlouho. | easy | 87 | 12 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_73 / Noc bez odpovědí | Pošli sérii náznaků a pak zmiz. Nejhorší nejsou odpovědi. Nejhorší je, když žádné nepřijdou. | easy | 86 | 13 | 3 influence, 900 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_74 / Přesná slabost | Síla je hlučná. Slabost je tichá. Najdi ji, stiskni ji a sleduj, jak se celý člověk ohne kolem ní. | medium | 80 | 16 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_75 / Porušený rytmus | Lidé přežívají díky rutině. Znič ji a zbytek jejich jistot se začne sypat sám. | easy | 88 | 12 | 3 influence, 1000 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_76 / Místnost bez vzduchu | Zaveď někoho do rozhovoru, kde nebude moct lhát ani utéct. To bývá nejčistší forma násilí. | medium | 81 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_77 / Vzkaz pod kůži | Nech zprávu tam, kde ji najde jen ten správný člověk. A kde se jí nebude umět zbavit ani po přečtení. | easy | 86 | 13 | 3 influence, 900 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_78 / Vina bez svědků | Dnes nevyvoláš strach. Dnes vyvoláš vinu. A vina člověka rozloží zevnitř mnohem pomaleji a důkladněji. | medium | 78 | 18 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_79 / Pocit cizí přítomnosti | Uprav pár detailů a nech někoho dojít domů do prostoru, který už nebude působit jako jeho vlastní. | medium | 82 | 15 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_80 / Tichý nátlak | Nátlak nemusí křičet. Stačí, když se usadí vedle člověka a dýchá mu na krk celé odpoledne. | easy | 87 | 12 | 3 influence, 900 cash | 1 successHeat, 3 failureHeat |
| nyra_81 / Narušený spánek | Vyčerpaný člověk se láme snáz. Připrav ho o klidnou noc a ráno už udělá chybu sám. | easy | 89 | 11 | 3 influence, 700 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_82 / Jméno ve špatných ústech | Dnes rozšíříš jedno jméno přesně tam, kde ho nikdo nechce slyšet. Škody pak udělá sama jeho ozvěna. | medium | 81 | 16 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_83 / Dům plný ticha | Některá ticha nejsou klidná. Jsou nemocná. Ujisti se, že jedno takové dnes někoho doma počká. | medium | 85 | 15 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_84 / Úhel pohledu | Nepotřebuješ měnit fakta. Stačí změnit pořadí, ve kterém je někdo uslyší. A najednou z pravdy začne téct jed. | medium | 80 | 17 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_85 / Cizí otisk | Nech na místě něco, co tam nepatří. Člověk si pak zbytek scénáře dopíše sám a většinou mnohem hůř, než bychom vymysleli my. | easy | 87 | 12 | 3 influence, 1000 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_86 / Dvě verze noci | Stejný večer, dvě různé verze, tři různí svědci. Až se to začne srážet, nezůstane nikomu pevná půda pod nohama. | medium | 78 | 18 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_87 / Rozklad jistoty | Něčí sebevědomí stojí na jedné představě. Dnes mu ji vezmeš a necháš ho sledovat, jak se rozsype všechno okolo. | medium | 80 | 16 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_88 / Přesně načasované ticho | Někdy je nejkrutější neodpovědět. Dnes necháš ticho pracovat déle, než je pro někoho zdravé. | easy | 91 | 11 | 3 influence, 900 cash | 1 successHeat, 3 failureHeat |
| nyra_89 / Neviditelná trhlina | Na povrchu nebude vidět nic. Ale uvnitř už začne všechno praskat. To jsou moje oblíbené práce. | medium | 79 | 17 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_90 / Přítomnost bez tváře | Postarej se, aby někdo cítil něčí blízkost, aniž by kdy zahlédl tvář. Lidská představivost je levná a smrtelně účinná zbraň. | easy | 86 | 13 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_91 / Sběr slabých míst | Dnes neřešíš velké tajemství. Dnes posbíráš deset malých. A z těch malých se staví nejhorší klece. | easy | 88 | 12 | 3 influence, 1000 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_92 / Pod kůží města | V každém sektoru pulzuje strach, jen ho nikdo nechce pojmenovat. Dnes mu dáš tvar a cenu. | medium | 78 | 18 | 6 influence, 700 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_93 / Slovo, které zůstane | Vyber jednu větu, která se člověku usadí v hlavě jako střep. A pak ji řekni přesně jednou. | easy | 87 | 12 | 3 influence, 900 dirty-cash | 1 successHeat, 3 failureHeat |
| nyra_94 / Cizí dotek v prostoru | Přesuň pár věcí, nech pár stop a jednu nejasnost. Nic víc. To úplně stačí na dlouhou noc bez dechu. | easy | 86 | 13 | 3 influence, 800 cash | 1 successHeat, 3 failureHeat |
| nyra_95 / Hlad po odpovědi | Dnes někomu nedáš důkaz. Dáš mu jen dost na to, aby po zbytku začal šílet toužit. | medium | 80 | 16 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_96 / Jedovatá blízkost | Nejhorší hrozby nejsou daleko. Jsou těsně vedle člověka, ve stejné místnosti, v obyčejném tónu hlasu. | medium | 85 | 15 | 6 influence, 900 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_97 / Vnitřní pád | Některé lidi není třeba srazit. Stačí jim odebrat poslední oporu a oni se zřítí sami. | medium | 77 | 18 | 6 influence, 900 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_98 / Tři náznaky | První náznak znejistí. Druhý rozhodí. Třetí zlomí. Doruč všechny tři ve správném pořadí. | medium | 81 | 16 | 6 influence, 800 cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_99 / Tma mezi lidmi | Největší temnota není v ulicích. Je mezi lidmi, kteří si přestali věřit. Rozšiř ji. | medium | 75 | 19 | 6 influence, 800 dirty-cash | 2 successHeat, 6 failureHeat, 200 failureDirtyCashLoss |
| nyra_100 / Nyřin jed | Zapamatuj si to. Strach je hlasitý jen na začátku. Pak ztichne, usadí se v člověku a začne ho požírat zevnitř. Dnes ten hlad nakrmíme. | rare | 65 | 25 | 1 overdrive-x, 8 influence | 6 successHeat, 12 failureHeat, 600 failureDirtyCashLoss |

**6. Úplná mapa: 161 districtů a jejich pevné budovy**

| District | Zóna | Typy budov před startovním doplněním |
|---|---|---|
| district:1 | commercial | car_dealer, restaurant |
| district:2 | park | strip_club, convenience_store |
| district:3 | industrial | factory, recycling_center |
| district:4 | residential | apartment_block, arcade, garage |
| district:5 | commercial | car_dealer, restaurant |
| district:6 | industrial | factory, armory |
| district:7 | residential | apartment_block, arcade |
| district:8 | commercial | restaurant, pharmacy, fitness_club |
| district:9 | industrial | factory, recycling_center |
| district:10 | residential | apartment_block, arcade |
| district:11 | commercial | restaurant, exchange |
| district:12 | park | strip_club, smuggling_tunnel |
| district:13 | industrial | factory, recycling_center |
| district:14 | commercial | restaurant, fitness_club |
| district:15 | residential | apartment_block, garage |
| district:16 | industrial | factory, warehouse |
| district:17 | park | strip_club, convenience_store |
| district:18 | commercial | restaurant, exchange |
| district:19 | residential | apartment_block, arcade |
| district:20 | park | strip_club, convenience_store |
| district:21 | commercial | restaurant, exchange |
| district:22 | residential | apartment_block, recruitment_center |
| district:23 | industrial | factory, power_station |
| district:24 | residential | apartment_block, arcade |
| district:25 | industrial | warehouse, power_station |
| district:26 | commercial | restaurant, pharmacy |
| district:27 | park | street_dealers, smuggling_tunnel |
| district:28 | residential | apartment_block, arcade |
| district:29 | park | street_dealers, smuggling_tunnel |
| district:30 | industrial | factory, warehouse, power_station |
| district:31 | park | strip_club, smuggling_tunnel |
| district:32 | residential | apartment_block, recruitment_center, garage |
| district:33 | park | strip_club, smuggling_tunnel |
| district:34 | industrial | factory, warehouse, power_station |
| district:35 | residential | apartment_block, recruitment_center, garage |
| district:36 | commercial | restaurant, pharmacy, exchange |
| district:37 | park | smuggling_tunnel, convenience_store |
| district:38 | industrial | armory, warehouse |
| district:39 | commercial | shopping_mall, restaurant |
| district:40 | residential | recruitment_center, school |
| district:41 | industrial | factory, armory |
| district:42 | commercial | restaurant, pharmacy |
| district:43 | industrial | warehouse, power_station |
| district:44 | residential | apartment_block, recruitment_center |
| district:45 | park | street_dealers, smuggling_tunnel |
| district:46 | commercial | restaurant, pharmacy |
| district:47 | park | street_dealers, smuggling_tunnel |
| district:48 | commercial | restaurant, exchange |
| district:49 | residential | apartment_block, arcade, clinic |
| district:50 | industrial | armory, warehouse |
| district:51 | commercial | shopping_mall, restaurant |
| district:52 | park | strip_club, smuggling_tunnel |
| district:53 | commercial | shopping_mall, restaurant |
| district:54 | residential | apartment_block, recruitment_center, garage |
| district:55 | commercial | shopping_mall, restaurant |
| district:56 | park | drug_lab, strip_club |
| district:57 | commercial | shopping_mall, exchange, restaurant |
| district:58 | park | drug_lab, smuggling_tunnel, convenience_store |
| district:59 | industrial | armory, recycling_center, factory |
| district:60 | residential | recruitment_center, school, clinic |
| district:61 | park | strip_club, street_dealers |
| district:62 | commercial | shopping_mall, restaurant |
| district:63 | park | drug_lab, smuggling_tunnel |
| district:64 | industrial | armory, warehouse |
| district:65 | residential | recruitment_center, clinic |
| district:66 | park | strip_club, street_dealers |
| district:67 | commercial | shopping_mall, pharmacy, restaurant |
| district:68 | industrial | factory, armory |
| district:69 | residential | apartment_block, arcade |
| district:70 | industrial | armory, warehouse |
| district:71 | residential | recruitment_center, clinic |
| district:72 | park | strip_club, street_dealers |
| district:73 | industrial | factory, recycling_center |
| district:74 | residential | apartment_block, recruitment_center, clinic |
| district:75 | industrial | armory, recycling_center, factory |
| district:76 | park | strip_club, street_dealers, convenience_store |
| district:77 | industrial | factory, armory, warehouse |
| district:78 | commercial | casino, restaurant, pharmacy |
| district:79 | downtown | court, vip_lounge |
| district:80 | downtown | central_bank |
| district:81 | downtown | lobby_club, central_bank |
| district:82 | downtown | stock_exchange |
| district:83 | commercial | casino, restaurant, pharmacy |
| district:84 | industrial | factory, armory, warehouse |
| district:85 | residential | recruitment_center, garage, clinic |
| district:86 | park | strip_club, street_dealers, convenience_store |
| district:87 | commercial | casino, restaurant, pharmacy |
| district:88 | residential | apartment_block, garage, clinic |
| district:89 | industrial | factory, warehouse, power_station |
| district:90 | residential | arcade, school |
| district:91 | park | drug_lab, convenience_store |
| district:92 | commercial | shopping_mall, pharmacy, restaurant |
| district:93 | commercial | restaurant, exchange |
| district:94 | industrial | factory, power_station |
| district:95 | commercial | car_dealer, exchange |
| district:96 | residential | arcade, school |
| district:97 | park | strip_club, smuggling_tunnel |
| district:98 | commercial | car_dealer, pharmacy |
| district:99 | residential | arcade, school |
| district:100 | park | drug_lab, smuggling_tunnel |
| district:101 | residential | arcade, school |
| district:102 | downtown | court |
| district:103 | downtown | city_hall, parliament |
| district:104 | downtown | lobby_club, airport |
| district:105 | downtown | vip_lounge, port |
| district:106 | park | drug_lab, smuggling_tunnel, street_dealers |
| district:107 | commercial | shopping_mall, restaurant |
| district:108 | residential | apartment_block, clinic |
| district:109 | industrial | armory, warehouse |
| district:110 | park | smuggling_tunnel, convenience_store |
| district:111 | commercial | car_dealer, exchange, restaurant |
| district:112 | park | strip_club, street_dealers |
| district:113 | commercial | shopping_mall, restaurant |
| district:114 | industrial | factory, recycling_center |
| district:115 | residential | apartment_block, arcade |
| district:116 | park | strip_club, convenience_store |
| district:117 | residential | apartment_block, recruitment_center |
| district:118 | park | street_dealers, smuggling_tunnel |
| district:119 | industrial | warehouse, recycling_center |
| district:120 | commercial | restaurant, fitness_club |
| district:121 | industrial | factory, warehouse |
| district:122 | residential | apartment_block, recruitment_center, garage |
| district:123 | commercial | car_dealer, exchange, restaurant |
| district:124 | industrial | recycling_center, armory |
| district:125 | park | drug_lab, convenience_store |
| district:126 | residential | apartment_block, recruitment_center, garage |
| district:127 | commercial | car_dealer, pharmacy |
| district:128 | industrial | factory, recycling_center, warehouse |
| district:129 | residential | apartment_block, recruitment_center, garage |
| district:130 | industrial | recycling_center, armory |
| district:131 | park | strip_club, street_dealers |
| district:132 | commercial | car_dealer, pharmacy |
| district:133 | residential | apartment_block, arcade, garage |
| district:134 | industrial | factory, warehouse |
| district:135 | residential | apartment_block, garage |
| district:136 | commercial | restaurant, exchange |
| district:137 | park | street_dealers, convenience_store |
| district:138 | commercial | restaurant, pharmacy |
| district:139 | industrial | factory, recycling_center |
| district:140 | commercial | restaurant, fitness_club |
| district:141 | park | street_dealers, convenience_store |
| district:142 | residential | apartment_block, arcade, garage |
| district:143 | park | street_dealers, convenience_store |
| district:144 | industrial | factory, power_station |
| district:145 | park | street_dealers, convenience_store |
| district:146 | commercial | car_dealer, restaurant |
| district:147 | residential | apartment_block, garage |
| district:148 | commercial | car_dealer, restaurant |
| district:149 | industrial | factory, recycling_center |
| district:150 | park | smuggling_tunnel, convenience_store |
| district:151 | residential | apartment_block, recruitment_center |
| district:152 | commercial | restaurant, pharmacy |
| district:153 | industrial | factory, armory |
| district:154 | residential | apartment_block, arcade, garage |
| district:155 | industrial | factory, recycling_center |
| district:156 | park | street_dealers, smuggling_tunnel |
| district:157 | commercial | restaurant, pharmacy, fitness_club |
| district:158 | park | street_dealers, convenience_store |
| district:159 | industrial | factory, warehouse |
| district:160 | residential | apartment_block, garage |
| district:161 | industrial | factory, power_station |

**7. Frakce: fungující a plánované efekty**

| Frakce | Aktivní efekty | Plánované pasivní efekty | Speciální schopnost — preview |
|---|---|---|---|
| Mafián | Čistý příjem +10 %; -4 % heat z útoků, loupeží, akcí budov a pasivního tlaku; Špehování -3 p. b. | — | Tichá dohoda |
| Kartel | +18 % špinavý příjem; +15 % produkce v podporovaných ilegálních budovách; +10 % pašování; +15 % heat z ilegálních akcí; -8 % čistý příjem; -5 % síla obrany | — | Noční zásilka |
| Kult | +20 % zisk vlivu; +10 % tvorba populace; +10 % síla obrany; -10 % čistý příjem; -5 % síla útoku | Silnější práce s drby a podezřením; +10 % poplatek na trhu | Masová posedlost |
| Tajná organizace | +15 % šance na úspěšné špehování; +15 % šance odhalit pasti; +10 % pravdivost potvrzených drbů; -10 % síla útoku; -8 % čistý příjem; -8 % špinavý příjem | +15 % kvalita informací ze špehování; -8 % heat z tajných akcí | Spící buňka |
| Hackeři | +50 % pravdivost potvrzených drbů; +15 % účinnost kamer; +15 % účinnost alarmů; +10 % produkce technologií; +10 % šance na úspěšné špehování; -8 % síla útoku; -8 % špinavý příjem; -5 % základní obrana bez kamer a alarmů | — | Výpadek systému |
| Motorkářský gang | -15 % doba čekání na vykrádání; -10 % doba čekání na útoky; -10 % doba čekání na obsazování; +10 % špinavé peníze z vykrádání; -10 % obrana districtů; +8 % heat z útoků, obsazování a vykrádání | — | Bleskový nájezd |
| Soukromá armáda | +12 % síla útoku; +12 % síla obrany; -10 % ztráty vybavení v boji; +8 % heat z útoků a obsazování; -8 % čistý příjem | +10 % síla při obsazování; +12 % náklady na údržbu a boj | Taktické nasazení |
| Korporát | +15 % čistý příjem; -3 % heat z útoků, loupeží, akcí budov a pasivního tlaku; +10 % efekt obranných systémů; -15 % špinavý příjem; -10 % kořist z vykrádání; +10 % délka útoků | -10 % poplatek na trhu | Právní štít |
