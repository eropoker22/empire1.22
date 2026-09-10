**EMPIRE STREETS — rozsáhlý audit pravidel, průběhu a herních možností**

Navazující ekonomické ladění a nové ověření jsou v [aktuálním auditu války](war-balance-2026-09-09.md). Jeho hodnoty mají přednost: změnil startovní profil, zásobníky, boosty, policejní kontrolu, bodování investic a časování finále. Tento dokument zachovává první fázi auditu a její tehdejší rozsah testování.

Datum: 9. 9. 2026. Základ: lokální pracovní strom nad commitem `7adc9182beacf0a39d8e5fff7715cd22b3852bb2`, včetně rozpracovaných změn. Audit popisuje především současný režim FREE. Nejde o potvrzení toho, co právě běží na veřejném serveru: nasazení, nastavení konkrétního serveru ani živou rozehranou partii jsem v tomto auditu nekontroloval.

Četl jsem konfiguraci, serverové zpracování příkazů, pravidla, projekce pro klienta a veřejné katalogy. Hodnoty jsem také vyexportoval přímo z vyhodnocené FREE konfigurace. Doložené chyby nalezené při auditu jsem opravil; jejich soupis a ověření uvádím v části 20. Číselný katalog zachycuje stav po opravách. Ověřoval jsem cílené jednotkové a integrační scénáře, výrobní řetězce a TypeScript. Novou simulaci celé partie, mobilní E2E ani nasazení tento audit neprováděl.

Navazující soubory:

- [Úplný číselný katalog: budovy, akce, recepty, zakázky a mapa](gameplay-catalog-2026-09-09.md).
- [Strojově čitelný snímek konfigurace a ověřených výpočtů](gameplay-config-snapshot-2026-09-09.json).

**1. O co ve hře jde**

Empire STREETS je multiplayerová strategie o budování gangsterského impéria na společné mapě města. Ovládáš gang, získáváš čtvrti, využíváš jejich podniky, vyrábíš zásoby a výzbroj, rozšiřuješ počet členů, sháníš informace, napadáš soupeře a snažíš se přežít do závěrečného vyhodnocení.

Hra spojuje územní strategii, ekonomiku, logistiku, práci s neúplnými informacemi a vztahy mezi hráči. Má pravidelné vyřazování nejslabšího hráče — očistu — a závěrečnou fázi Final Lockdown. Ve FREE není základním cílem prostě okamžitě obsadit určité procento mapy. Rozhoduje přežití a nakonec hodnota impéria podle finálního skóre.

Větší území znamená další budovy, příjmy, vliv, výrobní možnosti a lepší skóre. Současně vytváří delší hranici k obraně a další policejní tlak. Výroba připravuje výzbroj a boosty; boj spotřebovává zásoby a lidi; informace snižují nejistotu; politika a legální ekonomika pomáhají zvládat následky nelegálního podnikání.

Server postupuje v čase i bez otevřeného prohlížeče. Zavření hry nepozastaví protivníky, ekonomiku ani naplánované vyhodnocení. Hra proto odměňuje přípravu, správné pořadí kroků a návraty ve vhodný čas, nikoli jen počet kliknutí za minutu. [S1, S2, S3]

**2. Velikost světa a základní pravidla serveru**

Výchozí FREE server má kapacitu 20 hráčů. Aliance má maximálně 4 členy. Nezávisle na tom mohou být na jednom serveru nejvýše 4 aktivní členství se stejnou frakcí. Frakce a aliance jsou dvě různé věci: frakce je specializace hráče, aliance je skupina konkrétních hráčů.

Městská mapa obsahuje 161 districtů:

| Oblast | Počet | Typický význam |
|---|---:|---|
| Commercial | 40 | Legální a smíšené příjmy, směnárny, obchod, restaurace a kasina |
| Residential | 38 | Obyvatelé, nábor, garáže, školy a kliniky |
| Industrial | 38 | Výrobní řetězce, sklady, energetika a recyklace |
| Park | 37 | Pouliční distribuce, tunely, kluby, večerky a laboratoře |
| Downtown | 8 | Vzácné finanční a politické budovy, výrazná hodnota ve finále |

Districty mají skutečné sousednosti. Postup po mapě není libovolný teleport na druhý konec města. Vlastnictví čtvrti dává přístup k jejím pevným budovám. Hlavní herní tok neslouží k libovolnému stavění jakéhokoli podniku na volnou parcelu; `build-structure` je stará kompatibilní vývojová cesta. Aktuální hra využívá pevné sestavy budov a jejich akce a upgrady.

Při výběru startu server zajistí ve startovním districtu všechny čtyři výrobní budovy: lékárnu, Drug Lab, továrnu a zbrojovku. Přidají se pouze chybějící typy. Počty výrobních budov na rozehraném serveru se proto mohou lišit od samotné základní mapy. Úplný katalog uvádí počty před těmito startovními doplněními.

V registru jsou dva veřejné FREE servery a také WAR server s deklarovanou kapacitou 150 a uzavřeným vstupem. To dokládá existenci konfigurace WAR, nikoli otevřenou a provozně ověřenou alternativu ke FREE. [S4, S5]

**3. Registrace, vstup a start hráče**

Hráč vytvoří účet, vybere server, připraví profil gangu a frakci a zvolí dostupný startovní district. Start nelze vybrat v downtownu, v obsazeném nebo zamčeném districtu ani tam, kde právě probíhá neslučitelná operace.

Současné pravidlo hesla je minimálně 8 znaků. Nejde o maximální délku 8 znaků. Serverový validátor má horní technickou mez 1 024 znaků.

Výchozí startovní balíček hostovaného FREE serveru:

| Zdroj | Výchozí množství |
|---|---:|
| Čisté peníze | 1 500 |
| Špinavé peníze | 300 |
| Globální populace | 0 |
| Startovní vliv | 0 |
| Špioni | 2 |
| Chemicals | 10 |
| Biomass | 6 |
| Metal Parts | 8 |
| Tech Core | 2 |
| Pistole | 2 |
| SMG | 1 |

Ostatní uvedené výrobky, těžká výzbroj a obrana začínají v tomto balíčku na nule. Konkrétní server může mít administrátorem upravený startovní stav. Nula globálních lidí znamená, že zbraně v inventáři samy o sobě ještě nevytvářejí okamžitě použitelnou armádu.

Výchozí registrační okno trvá hodinu a politika připouští vstup i do běžící hry, dokud toto okno trvá. Server může odstartovat již s jedním připraveným hráčem, pokud splní provozní podmínky včetně dostupného workeru. Uzavření registrace a dokončení již zahájeného setupu jsou samostatné kroky.

Je nutné rozlišit tři situace:

- **Odhlášení z účtu nebo herní session:** ruší přístupovou session, nikoli automaticky gang a jeho území. Návrat obnovuje přístup k existujícímu členství.
- **Výslovné opuštění serveru během registrace:** uvolňuje členství po dokončení úklidu; během otevřeného okna lze znovu vstoupit. Staré session nesmějí pokračovat v původním členství.
- **Vyřazení nebo dokončená účast:** nemá sloužit jako cesta k resetování prohry a novému startovnímu balíčku v téže partii.

Limit čtyř hráčů jedné frakce se kontroluje na serveru při dokončení vstupu, včetně souběžných požadavků. Pouhé zašednutí karty v prohlížeči by pro toto pravidlo nestačilo. [S6]

**4. Co hráč průběžně dělá**

Typický herní cyklus je: zkontrolovat situaci a odpočty, vybrat lidi a hotovou výrobu, doplnit fronty, rozhodnout o penězích a zásobách, prověřit sousedy, zvolit expanzi nebo zásah, připravit obranu a sledovat nejbližší očistu.

Hráč může:

- prohlížet mapu, vlastnictví, sousednosti, stav čtvrtí a povolené cíle;
- spravovat pevné podniky a jejich dostupné upgrady;
- automaticky vydělávat z aktivních podniků a ručně spouštět zvláštní akce;
- vybírat lokálně nahromaděné obyvatele;
- zadávat výrobu, vybírat výrobky a rušit čekající části front;
- obchodovat na běžném trhu, černém trhu a hráčském bazaru;
- prát špinavé peníze;
- špehovat, obsazovat neutrální districty, loupit neutrální zásoby, vykrádat hráče a útočit o území;
- rozmístit či odebrat obranu a přesouvat vlastní past;
- aktivovat jeden z globálních boostů;
- plnit zakázky městských kontaktů;
- číst reporty, potvrzené události a drby a používat městský i alianční chat;
- zakládat alianci, přidávat se, zvát hráče, podporovat obranu spojenců a řešit členství;
- vypsat odměnu bounty na zásah proti aktivnímu soupeři;
- využívat zotavení po ztrátách a za zvláštních podmínek nouzovou pomoc;
- kontrolovat vlastní pozici v očistě a následně optimalizovat finální skóre.

Výsledek akce není totéž co její přijetí. Špionáž, útok, loupež, heist a obsazování mají serverový termín vyhodnocení. Změny vlastníka, reporty, kořist a ztráty se aplikují při tomto termínu. Mezitím mohou být rezervované prostředky a blokované zdrojové nebo cílové čtvrti. Změna situace může také způsobit zrušení neplatné operace. [S1, S7]

**5. Peníze, lidé, vliv a informace**

**Čisté peníze** platí výrobu, upgrady, mnoho akcí, boosty, nákupy a bounty. **Špinavé peníze** vznikají v nelegální ekonomice, některých zakázkách a loupežích; využívají se na černém trhu a u některých akcí nebo se převádějí praním. Pro očistu má jednotka čistých peněz dvojnásobnou bodovou váhu oproti jednotce špinavých.

**Populace** je zásoba členů gangu. Vyžadují ji výpravy a bojová výzbroj. Některé operace lidi rezervují, jiné je utrácejí nebo způsobují ztráty. Obyvatelé v lokálním zásobníku budovy nejsou totéž co již vybraná globální populace.

**Vliv** se v současné důležité herní cestě sčítá z vlastněných districtů. Platí politické akce, založení aliance i expanzi a odemyká kontakty. Současně přímo přispívá ke skóre. Utracení vlivu proto může zároveň snížit bodovou rezervu a dostupnost kontaktu, jehož práh už hráč nesplňuje.

**Heat** existuje u hráče i u districtů. Policejní tlak oba zdroje kombinuje. Pro finální penalizaci se naopak bere hráčův heat z policejního stavu. Tyto hodnoty nelze zaměňovat.

**Informace** mají několik úrovní důvěry: potvrzený report o vlastní operaci, úspěšná špionáž, částečný průzkum a drb. Drb může být nepravdivý. Nápověda o slabé obraně sama nevytváří platné oprávnění k obsazení nebo útoku. [S8, S9, S10]

**6. Všech 32 typů budov a jejich role**

Přesná základní čísla příjmů, heat, vlivu, počet kusů na mapě a názvy všech akcí jsou v přiloženém katalogu. Následuje herní význam každého typu.

| Budova | Co přináší a co s ní hráč dělá |
|---|---|
| Lékárna | Vyrábí Chemicals, Biomass a Stim Pack; začátek chemického výrobního řetězce. |
| Drug Lab | Vyrábí Neon Dust, Pulse Shot, Velvet Smoke, Ghost Serum a Overdrive X. První tři jsou obchodní látky; strategické komponenty vstupují do boostů. |
| Továrna | Vyrábí Metal Parts, Tech Core a Bojový modul. Zásadní vstup pro zbrojovku a část boostů. Více továren zrychluje síť. |
| Zbrojovka | Pět útočných a pět obranných výrobků. Síť i upgrade zrychlují skutečnou výrobu; level 2 stojí 5 200 clean a přidává 10 % základní rychlosti. |
| Skladiště | Zvyšuje kapacitu zásob podle počtu skladů a nejvyššího levelu. Také vydělává čisté peníze. |
| Bytový blok | Základně 2 lidi za reálnou minutu do místního zásobníku s kapacitou 50. Ruční výběr, minimálně 10; při naplnění výroba stojí. |
| Škola | Základně 0,55 člověka za minutu do kapacity 20, ruční výběr od 1. Večerní kurz za 1 000 clean na 20 minut zvýší náborové tempo na 1,6násobek; cooldown 35 minut. Talentové šance jsou v aktuální konfiguraci nulové. |
| Večerka | Čisté i špinavé peníze, vliv a civilní drby. Také zadržuje obyvatele: základ 0,8333 za minutu, kapacita 50, výběr od 30. Více večerek a restaurací má informační synergie. |
| Rekrutační centrum | Podporuje získávání lidí, kapacitu bytových bloků a sílu výzbroje. Nevyrábí samo novou globální armádu jedním tlačítkem. |
| Fitness Club | Pasivní čistý příjem a bojová kondice. Bonusy se různě silně vztahují na jednotlivé zbraně a obranné předměty; nejsou uniformní pro vše. |
| Garáž | Čistý příjem a kratší vybrané logistické časy. Plný bonus pro přípravu útoku, obsazení a loupež; poloviční pro některé další kategorie. |
| Autosalon | Smíšený příjem, mobilita, kratší vybrané časy a vyšší šance úniku při neúspěšném útoku. Sdílí stropy zkracování s garážemi. |
| Klinika | Čistý příjem a placené obnovení části nedávných ztrát. Hráč musí použít Stabilizační protokol. |
| Recyklační centrum | Čistý příjem a návrat části ztracených materiálů z krátkého záznamu ztrát. Neobnovuje populaci. |
| Energetická stanice | Podpora továren, zbrojovek, některých příjmů, zotavení a obrany. Nevyrábí samostatný spotřebovávaný zdroj elektřiny. Stabilizace sítě je dočasný bonus; akce Prodat přebytek ve skutečnosti vyplácí peníze. |
| Restaurace | Legální příjem, vliv a civilní drby. Výběr tržeb; krytí schůzek s dočasným příjmovým bonusem; posílení místní sítě. |
| Herna | Smíšený příjem a menší praní peněz. Noční automaty dočasně zvýší výnosy a riziko; Zadní pokladna pere peníze. |
| Kasino | Výrazná smíšená ekonomika, větší praní peněz, noční boost, podplacení inspektora a vlastní auditní rizika. Lze rozvíjet do levelu 4. |
| Směnárna | Silný smíšený příjem a síť pro praní peněz. Výhodný kurz je denní akce; více směnáren zvyšuje příjem i prací limit, ale také stopu. |
| Obchodní centrum | Pasivní smíšené příjmy, vliv, slevy a úpravy tržních poplatků. Nemá vlastní aktivní speciální akce. |
| Strip Club | Smíšené příjmy, vliv a častější společenské drby. Výběr cash, hostění VIP klientů a soukromá party; večírek může vyvolat skandál. |
| Pouliční dealeři | Pasivní špinavý příjem a prodej tří běžných laboratorních látek přes samostatné prodejní sloty, s minimální dávkou a pouličními incidenty. |
| Pašovací tunel | Pasivní špinavý příjem a podpora dealerů. Otevření kanálu dočasně posiluje provoz za cenu peněz, heat a pouličního rizika. |
| Centrální banka | Silný čistý příjem, vliv, úrok z rezerv a ochrana financí. Likviditní injekce, Zmrazené účty a Kurzovní intervence; vlastní regulatorní dohled. |
| Magistrát | Čistý příjem a vysoký vliv, levnější politické akce a řízení části policejního tlaku. Úřední krytí, Městská zakázka a tři režimy Nouzové vyhlášky. |
| Lobby Club | Vliv, zlevnění politických akcí, ovlivňování drbů a vyjednávání. Zákulisní tlak, Tiché vyjednávání a Mediální clona; možnost skandálu. |
| Burza | Nejvyšší základní čistý hodinový příjem v katalogu, tržní informace a manipulace kategorií. Spekulativní nákup, Tržní tlak a Vnitřní tipy; finanční kontroly. |
| Soud | Pasivní právní ochrana: jeden snižuje následky policejních razií o 50 %, dva o 75 % podle příslušného výpočtu. Má příjem a vliv; nemá aktivní speciální tlačítko. |
| VIP Salonek | Prémiová síť drbů, lepší základní pravdivost, příjmy a vliv. Je to samostatná budova; není totožná s akcí VIP klientů ve Strip Clubu. |
| Letiště | Příjmy, dovoz, slevy, černý charter a úniková logistika. Expresní dovoz, Černý charter, Evakuační koridor; celní kontroly. |
| Přístav | Menší smíšený příjem a vliv; akce Proříznout kontejner přidává dirty cash, kov a vliv. Započítává se do vzácných budov ve finále. |
| Parlament | Menší smíšený příjem a vliv; denní Politické okno. Patří mezi bodově vzácné budovy. |

Více stejných podniků obvykle tvoří síť s bonusy, ale téměř všude existuje strop. Neplatí, že každá desátá budova přidá stejnou hodnotu jako první. Některé podniky zároveň násobí příjmy jiných typů nebo podporují celý gang.

Příklady: více bytových bloků zrychluje růst a navyšuje kapacitu; továrny a zbrojovky mají síťové tempo až 1,3×; garáže mají základní limit zkrácení 16 % a kombinace s autosalony limit 22 %; energetická infrastruktura má základní strop 28 % před dočasnými doplňky. Přesný výsledný efekt závisí na kategorii akce a dalších limitech. [S4, S8, S11]

**7. Výroba a skutečné skládání bonusů**

Výrobní řetězce jsou:

- lékárna → chemické vstupy → Drug Lab → prodejné látky a komponenty boostů;
- továrna → kovové díly → Tech Core → Bojový modul → zbrojovka a boosty;
- zbrojovka → výzbroj na útok a předměty pro obranu districtů.

Recepty mají samostatné výrobní linky. Různé položky proto mohou běžet současně; několik kusů stejného receptu jde za sebou v jeho frontě. Při zadání se odečítají peníze a rezervované vstupy pro zadané množství. Hotové kusy se hromadí lokálně a hráč je vybírá do skladu. Výstupní limit budovy a kapacita globálního skladu jsou dvě oddělené překážky.

Zrušení fronty vrací odpovídající rezervace čekajících kusů. Již aktivně vyráběný kus tímto příkazem běží dál. Nelze počítat s tím, že pozdní zrušení vrátí všechny prostředky včetně rozpracovaného kusu.

V běžné FREE konfiguraci se základní délka receptu nejprve násobí `cooldownMultiplier = 0,8` a zaokrouhluje na celý tick. Potom se dělí použitelnými násobiči rychlosti: levelem, sítí továren/zbrojovek, boostem, frakcí, podporou infrastruktury a aktivním denním/nočním profilem budovy. Nakonec se může prodloužit kvůli stabilizaci districtu. Jeden tick je 10 sekund.

U lékárny, laboratoře, továrny a zbrojovky level přidává 10 procentních bodů základní rychlosti za další úroveň: level 2 znamená 1,1×, level 3 znamená 1,2× a level 14 znamená 2,3×. To není totéž jako odečíst 10 % času za každý level. Čas se rychlostí dělí.

Konkrétní příklad Neon Dust: recept má 37 ticků; po FREE násobiči vznikne `ceil(37 × 0,8) = 30` ticků. Laboratoř na levelu 3, Kartel s výrobou 1,15× a Industrial Overdrive 1,25× mají v noci navíc profil laboratoře 1,2×: `ceil(30 / 1,2 / 1,15 / 1,25 / 1,2) = 15` ticků, tedy 2 minuty 30 sekund. Přes den s profilem 0,9× trvá stejný kus 20 ticků, tedy 3 minuty 20 sekund. Příklad předpokládá stálou fázi během výroby a žádné další omezení. Výsledek receptu zůstává 1 kus; zvyšuje se počet kusů za čas.

Změny podpory, upgradu, přechodu dne/noci a zapnutí či skončení Industrial Overdrive mají cesty pro přepočet zbývající rozpracované doby. Již hotová práce se nemá začínat znovu.

**Skládání bonusů:** použitelné nezávislé rychlosti se násobí a čas se jimi dělí; nesčítají se jako prosté slevy z minut. Výslovný denní/noční výrobní profil budovy nahrazuje obecný fázový profil výroby, aby se stejný fázový bonus nezapočítal dvakrát. Továrna má den 1,1× / noc 0,98×; Drug Lab den 0,9× / noc 1,2×. Samostatné pole staré pasivní cesty `productionMultiplier` nezvyšuje počet kusů každého receptu; FREE má její `productionBuildings` prázdné. Čas v projekci a termín dokončení používají společný výpočet. [S12]

**8. Skladování**

Sklad rozděluje položky na hromadné, taktické a strategické. Základní kapacity bez skladiště jsou 60, 24 a 8. **V implementaci jde o limit každého jednotlivého typu položky v dané kategorii, nikoli o jednu společnou kapacitu sdílenou všemi položkami kategorie.** Například bez skladiště může mít hráč až 60 Chemicals a současně až 60 Metal Parts.

Počet aktivních skladišť násobí kapacity takto: žádné 1×, jedno 1,5×, dvě 1,6×, tři 1,7×, čtyři 1,8× a pět nebo více 1,9×. Dále působí nejvyšší level vlastněného aktivního skladu: 1×, 1,12×, 1,25× a 1,4×.

Jedno skladiště na levelu 1 tedy dává limity 90 / 36 / 12 na položku. Pět skladišť a nejvyšší level 4 dávají po zaokrouhlení 160 / 64 / 22. Vylepšení druhého skladu na úroveň, kterou už má jiný sklad, kapacitu znovu nezvýší.

Peníze nejsou omezené těmito inventárními kategoriemi. U sběru výroby a různých odměn se řeší, co se vejde. Nevejdoucí se odměna zakázky může čekat na pozdější vyzvednutí; při neutrální loupeži se nepřevzatá část vrací do tamního společného lootu. [S13]

**9. Špionáž a skryté informace**

Špionáž je příprava pro rozhodování a pro oprávnění k některým akcím. Hráč má ve výchozím stavu dva špiony. Základní výprava trvá 6 minut; garáže a Ghost Network ji mohou zkrátit.

Výsledek má čtyři stupně:

| Výsledek | Význam |
|---|---|
| Úspěch | Plnohodnotný report, potřebné oprávnění pro příslušnou akci a možnost odhalení pasti. |
| Částečný úspěch | Omezená informace, nikoli oprávnění obsadit prázdný district. |
| Neúspěch | Průzkum potřebný výsledek nepřinese. |
| Kritické selhání | Špion je zajat a po vyhodnocení má další nedostupnost. |

Pokud není zajat, aktuální serverová cesta uvolňuje přiděleného špiona hned při vyhodnocení. Zajetí přidává základně 10 minut. Do horní lišty má přicházet stejný autoritativní počet dostupných špionů jako do ovládání akcí.

Základní šance úspěchu je 76 %, ale není to univerzální konečná šance. Snižuje ji obrana, kamery a alarmy a upravuje frakce. Finální šance je omezená rozsahem. Past se ani při úspěchu nemusí odhalit: její základní dodatečná šance odhalení je 20 %.

Platný intel má výchozí životnost 10 minut a váže se na cíl, vlastníka a bezpečnostní stav. Přestavění obrany nebo změna situace může dřívější report znehodnotit. Neonové označení obsaditelného cíle má vyjadřovat aktuálně použitelné oprávnění, nikoli jen fakt, že tam někdy proběhl částečný průzkum.

Ghost Network zkracuje misi na 65 % času, snižuje kritické selhání násobičem 0,75 a přidává informační blok úspěšného reportu. Nezaručuje úspěch. Zvláštní kvalita informací Tajné organizace je výslovně plánovaný efekt; její bonus šance na úspěch už funguje. [S9]

**10. Čtyři odlišné způsoby zásahu do okolí**

**Obsazení neutrálního districtu:** potřebuje vhodnou vlastní výchozí čtvrť, dostupný sousední cíl a platné úspěšné oprávnění ze špionáže. První evidovaný pokus stojí 5 vlivu, další 10. Základní cena je 50 lidí; při větším impériu se zvyšuje po malých krocích. Pro čtvrtý a pátý vlastní district jde podle aktuálního vzorce o 51, pro šestý a sedmý o 52.

Obsazení trvá základně 12 minut, zkrácení má ve FREE spodní mez 8 minut. Má 5% možnost selhání. Lidi a vliv hráč platí při spuštění. Při úspěchu dostane zpět 10 % populace zaokrouhlených dolů: u ceny 50 se vrátí 5, čistý úbytek je 45. Při selhání se tento návrat neuplatní. Získaný district následně 15 minut stabilizuje; příjmy a výrobní rychlost jsou v tomto období základně poloviční a nelze ho hned používat jako plnohodnotný zdroj dalšího tažení.

**Loupež neutrálního districtu:** získává zásoby bez změny vlastnictví. Každý cíl má společný omezený loot pool, který vyčerpávají všichni hráči. Obnova je 25 % počátečního množství za herní den s omezením na počáteční kapacitu. Cíl musí mít použitelnou hotovost i dost druhů materiálu.

Základní rozdělení výsledků je 62 % úspěch, 25 % částečný úspěch a 13 % neúspěch. Úspěšný výběr bere jeden peněžní kanál — čistý nebo špinavý — zpravidla 1 000 až 2 500 při plném a 1 000 až 1 500 při částečném úspěchu, omezený zbytkem lootu. K tomu bere několik druhů materiálu. Čas výpravy je základně 10 minut a handler po dokončení nastavuje další příslušný cooldown; nelze jej zaměňovat za okamžitou opakovatelnou odměnu.

**Heist proti hráči:** krade ze soupeřových globálních peněz a vybraných materiálů. Nemění vlastníka čtvrti. Nevyžaduje stejný úspěšný špionážní token jako obsazení a útok. Má výběr stylu a počtu vyslaných lidí:

| Styl | Lidé | Základní úspěch | Základní odhalení | Násobič peněžní kořisti stylu |
|---|---:|---:|---:|---:|
| Stealth | 5–35 | 80 % | 18 % | 0,65× |
| Balanced | 10–70 | 74 % | 30 % | 1× |
| All-in | 25–120 | 68 % | 46 % | 1,45× |

Více vyslaných lidí v rozsahu stylu zvyšuje šanci na úspěch, ale i odhalení. Barikády a věže zvyšují odpor, kamery a alarmy odhalení. Čistý úspěch, běžný úspěch, odhalení, selhání a spuštěná past mají odlišnou kořist a ztráty. U peněz se uplatňuje podíl 12 % upravený stylem, výsledkem a hodem; u vybraných materiálů se používá 2–7 % soupeřových zásob. Výčet zahrnuje Chemicals, Biomass, Stim Pack, Metal Parts, Tech Core a Bojový modul.

Výprava trvá 8 minut. Po výsledku existuje globální cooldown 8 minut, 12 minut na stejný cíl a ochrana oběti na 6 minut. Přeživší rezervovaní lidé se vracejí; ztracení se odečtou. Vyšší sázka tedy není bezplatný upgrade výnosu. Šance se dále mění podle dne a noci v okamžiku vyhodnocení; základní tabulka výše ještě fázový bonus neobsahuje. Přesné fázové změny jsou v části 18.

**Útok o district:** bojová operace, která může čtvrť získat nebo zničit. Potřebuje výzbroj, odpovídající obsluhu, vhodný zdroj a platnou autorizaci průzkumu. Základ přípravy je 22 minut, upravují jej den/noc, logistika, frakce a některé politické efekty; ve FREE má konečná délka spodní mez 15 minut. Následují samostatné cooldowny a ochrany po výsledku. [S7, S14]

**11. Boj, zbraně, obrana a pasti**

| Útočná zbraň | Základní síla | Potřební lidé na kus |
|---|---:|---:|
| Baseballová pálka | 5 | 1 |
| Pistole | 10 | 1 |
| Granát | 14 | 1 |
| SMG | 18 | 2 |
| Bazuka | 30 | 3 |

Útočná síla vychází z konkrétní zvolené sestavy, nikoli pouze z celkového počtu obyvatel. Dále ji mění podpůrné budovy, frakce, efekty districtu, alianční postihy a Tactical Grid. Granáty a obranné věže mají další navazující účinky na výsledné síly. Kompletní sestava pěti typů výzbroje má v bojové matematice zvláštní kombinovaný bonus přes SMG.

Základ obrany na kus: vesta 6, barikády 12, kamery 6, obranná věž 20 a alarm 10. Kapacita districtu je 20 bodů, v downtownu 24. Vesta a barikády spotřebují po 1 kapacitě, kamera a alarm po 2, věž 4. Rozmístěná obrana není současně volná zásoba ve skladu.

Kamery a alarmy mají význam také mimo přímý boj. Zhoršují průzkum a utajení heistu. Vesty tlumí ztráty obráncových lidí: relativně 5 % na kus až do 35 %. Síť energetiky, náboru a některé frakce tyto systémy dále upravují.

Samotné rozdělení výsledku útoku je podle efektivních sil:

- útok **větší než 1,5× obrana** → čisté obsazení;
- útok **větší než obrana**, ale ne nad první hranicí → nákladné obsazení;
- útok **menší nebo roven obraně** → odražení;
- zablokování pastí nebo katastrofa → katastrofický výsledek.

Remíza v síle tedy nestačí k dobytí. Čisté obsazení také není úplně bezztrátové: současný handler přidává populační cenu stabilizace alespoň jednoho člověka, základně 5 % nasazených lidí; nákladné obsazení 8 %. Výzbroj se ztrácí podle výsledku a stanoveného pořadí, s dalšími úpravami frakce a úniku. Obránce může přijít o vybavení i část globálních lidí.

Katastrofa je samostatné riziko. Základ činí 2 % a bazuky přidávají po 1,5 procentního bodu, maximálně dalších 12 bodů. S tímto základem je dosažitelné maximum 14 %; obecný bezpečnostní strop je 18 %. Vysoká převaha sama před tímto hodem nechrání. Zničení districtu není stejný výsledek jako jeho výnosné obsazení.

Hráč může mít jednu aktivní toxickou past v některém vlastním districtu. Umístění v aktuálním handleru nemá peněžní ani materiálový náklad. Při útoku past nejprve ničí kusy útočné výzbroje; pokud odstraní celou sestavu, útok zablokuje. Heist má vlastní podmínku spuštění pasti. Přesun mezi vlastními povolenými districty má 10minutový cooldown. Past je skrytá informace; vlastní vizualizace nesmí automaticky odhalit cizí past soupeřům.

Spojenci mohou přispívat obrannými předměty. Server eviduje, kdo co vložil; při odchodu a odebírání se řeší přeživší vlastní příspěvky. Nejde o možnost bez omezení odnést cizí obrannou výbavu. [S15]

**12. Praní peněz, pouliční prodej a trhy**

Praní peněz není převod 1:1 bez následků. Převádí část aktuálních dirty cash, má minimum, limit, poplatek, cooldown, heat a lokální auditní riziko.

| Podnik a akce | Minimum dirty | Podíl aktuálních dirty | Základní maximum na akci | Poplatek |
|---|---:|---:|---:|---:|
| Herna — Zadní pokladna | 500 | 13 % | 3 800 | 15 % |
| Směnárna — Výhodný kurz | 800 | 16 % | 6 000 | 12 % |
| Kasino — Tichá herna | 1 500 | 24 % | 18 000 | 9 % |

Síť, level kasina a další efekty mohou konkrétní parametry změnit. Auditní následky zahrnují pokuty, odebrání části peněz, zhoršení příjmů a dočasné blokace akcí. Samostatný casino inspektor stojí 15 000 clean, má 14% riziko neúspěchu a dlouhý cooldown 105 minut. Úspěch tlumí heat a audit, neúspěch přidává další potíže.

Dealeři prodávají minimálně 10 kusů vybrané látky. Základní ceny za kus jsou 625 dirty za Neon Dust, 1 000 za Pulse Shot a 1 125 za Velvet Smoke. Základní prodejní časy jsou 4, 5 a 6 minut. Síť dealerů a tunelů mění tempo a rizika; mohou nastat falešný zákazník, pouliční konflikt nebo ztracená zásilka.

Zásadní ekonomický závěr: při výrobě všech vstupů za jejich základní čistou cenu není prodej dealerům automaticky ziskový. Neon Dust stojí 500 clean + 2 Chemicals po 360, tedy 1 220 clean, zatímco základní prodej je 625 dirty. Pulse Shot vychází na 1 940 clean proti 1 000 dirty a Velvet Smoke na 2 100 clean proti 1 125 dirty. Získání látky loupeží, výhodným obchodem nebo odměnou mění náklad, ale nelze začátečníkovi bez výpočtu slíbit výdělečný uzavřený výrobní cyklus.

Běžný trh nabízí rotující základní zásoby; černý trh pokročilé materiály, látky a zbraně. Ceny zohledňují zásobu, poptávku, inflaci, chaos, tržní události a relevantní budovy. Dvě nabídky běžného trhu se obměňují v 11:00 a 19:00 městského času, černý trh má základní 30minutovou rotaci. Platba dirty na černém trhu má vlastní cenový násobič.

Hráčský bazar dovoluje vystavit vlastní nabídku, zvolit množství, cenu a peněžní kanál, koupit nabídku druhého a stáhnout svou. Má limit 5 aktivních nabídek na prodejce, ve FREE životnost nabídky 45 minut. Zboží je rezervované, aby nešlo současně prodat a spotřebovat. Obchod se špinavými penězi má vlastní stopu. Obchodní centrum nepřináší stejnou slevu na všechny typy trhu; u hráčských cen je váha jeho nákupní slevy nulová.

Burza může krátkodobě pumpnout nebo snížit ceny kategorie. Centrální banka umí pohyb tlumit. Existují také události typu policejní zátah, zásobovací dodávka, gangová válka a nedostatek chemie. Část hospodářské strategie tedy spočívá v načasování, nikoli jen v hledání jedné navždy platné ceny. [S16, S17]

**13. Politika, finance a práce s rizikem**

Centrální banka vyplácí úrok podle držených čistých rezerv: jeden kus základně 2,5 % za 10 minut do maxima 2 500, dva kusy 4 % do maxima 4 000. Je to další důvod, proč může mít držení hotovosti hodnotu. Regulatorní kontrola však může dočasně zastavit úroky nebo akce a uložit pokutu.

Likviditní injekce a Městská zakázka převádějí politickou pozici na peníze podle vlastněné ekonomické infrastruktury a mají stropy. Úřední krytí a politické slevy pomáhají zvládat heat a cenu vlivových akcí. Kombinované slevy na cenu vlivu mají limit; stejné procento se nemůže donekonečna násobit.

Nouzová vyhláška magistrátu nabízí Noční hlídky, Zastavené kontroly a Stavební uzávěru. Její jednotlivé parametry mají vazbu na napadené oblasti, logistiku, obranu a heat. Jde o časově omezené použití moci, nikoli trvalé přepsání pravidel serveru.

Lobby Club umí posílit vliv, zkrátit zbývající vybraný politický nebo společenský cooldown a zlepšit další vlivovou akci. Mediální clona manipuluje informačním prostředím. Politická koncentrace však může sama přinášet korupční skandály, ztrátu vlivu a dočasné omezení příjmu.

Soud je především pasivní ochrana proti následkům razií. Nejde o univerzální vypínač všech kontrol, poplatků a neúspěchů. Samostatné finanční audity, celní kontroly a pouliční incidenty mají odlišné mechanismy. [S11, S16]

**14. Boosty**

Hráč může mít současně jen jeden aktivní globální boost. Každý stojí čisté peníze a komponenty a má vlastní cooldown počítaný od aktivace.

| Boost | Cena | Účinek | Aktivní okno | Cooldown |
|---|---|---|---:|---:|
| Ghost Network | 5 000 clean + 2 Ghost Serum + 2 Pulse Shot | Čas špionáže ×0,65; kritické selhání ×0,75; více informací při úspěchu | 12 min | 35 min |
| Industrial Overdrive | 7 500 clean + 2 Overdrive X + 2 Bojové moduly | Rychlost výrobních linek ×1,25 | 12 min | 45 min |
| Tactical Grid | 10 000 clean + 2 Ghost Serum + 1 Overdrive X + 3 Bojové moduly | Síla příštího platného PvP boje ×1,12 na útoku nebo obraně | nejvýše 20 min | 60 min |

Tactical Grid je jednorázově nabitý efekt. První platný PvP střet ho může spotřebovat i při obraně; hráč si tedy nemůže vždy vyhradit jeho použití až pro vlastní plánovaný útok. Při vypršení okna zmizí bez využití. Není to 20 minut neomezeného bonusu ke všem soubojům.

Ghost Serum ani Overdrive X nejsou samy o sobě další libovolně aktivovatelné schopnosti. V současném seznamu jde především o výrobní a boostové komponenty. [S18]

**15. Zakázky, kontakty, zprávy a drby**

Konfigurace obsahuje **300 zakázek**, po 100 pro každého ze tří kontaktů. Jejich úplný seznam s názvy, šancemi, dobou a odměnou je v katalogu.

| Kontakt | Potřebný aktuální vliv | Nabídka a dostupnost |
|---|---:|---|
| Victor Grave Kadeř | 0 | Noční kontakt, okno 18:00–04:00; obměna v 18:00, 22:00 a 02:00 |
| Leon Switch Varga | 100 | Obměna v 10:00 a 22:00 |
| Nyra Vale | 300 | Obměna v 06:00, 14:00 a 22:00; zvláštní práce s třetím vzácným slotem |

Tyto časy jsou městské. Hráč má nejvýše jednu běžící zakázku celkem. Nabídka má platnost, zadaný výsledek a jednorázový pokus; nelze stejnou nabídku bez omezení opakovat po neúspěchu. Večerní rozdělení vzácných nabídek omezuje přístup ke strategickým odměnám.

Rozpočtové skupiny konfigurace: easy obvykle 86–94 % a 10–14 minut; medium 73–85 % a 15–21 minut; hard 62–72 % a 22–30 minut; rare 55–65 % a 25–35 minut. Konkrétní nabídka má vlastní uložené parametry a ty rozhodují.

Po skončení server vyhodnotí úspěch, přidá odměnu a heat nebo uplatní ztrátu dirty cash a vyšší heat. Peníze a běžně přijatelná odměna se připisují při dokončení. Část materiálu přes kapacitu čeká na ruční vyzvednutí.

Příběhový text zakázky není dodatečné univerzální pravidlo. Například zmínka o zastrašení konkurence sama neznamená, že mise snižuje statistiky konkrétního druhého hráče. Skutečný běh pracuje s odměnou, dobou, pravděpodobností, náklady a rizikem definice; nemá obecný výběr oběti pro všechny tyto příběhy.

Uliční zprávy kombinují potvrzené městské události a informační obsah. Bojové reporty, očista a razie mají věcný stav; drby z restaurací, večerek, klubů a VIP salonků mají různé intervaly, šance, přesnost lokace a pravdivost. Například základní VIP síť začíná na 68% pravdivosti, Strip Club na 55 % a restaurace při malé síti na 45 %. Více budov, frakce, den/noc a mediální efekty mohou hodnoty měnit, se stropy.

Městský a alianční chat umožňují vyjednávat, koordinovat útoky, varovat před hrozbou nebo sdílet vlastní interpretaci zpráv. Z toho plyne sociální hra nad samotnými tlačítky: reputace, dohody, společný protivník a možnost dezinformace. [S10, S19]

**16. Frakce: osm různých specializací**

Tabulka odděluje nyní zapojené efekty od plánů. Procentní body mění přímo šanci; procentní násobiče mění příjem, rychlost nebo sílu relativně.

| Frakce | Aktivní přednosti a slabiny | Plánované efekty / upřesnění |
|---|---|---|
| Mafián | Čistý příjem +10 %, získávání heat −4 %, špionáž −3 procentní body | Heat se upravuje u napojených útoků, loupeží a budov, nikoli automaticky u každého zdroje heat. |
| Kartel | Dirty příjem +18 %, nelegální výroba +15 %, pašování +10 %; nelegální heat +15 %, čistý příjem −8 %, obrana −5 % | Výrobní bonus zkracuje dobu receptu. |
| Kult | Vliv +20 %, lidé +10 %, obrana +10 %; čistý příjem −10 %, útok −5 % | Plánované: silnější generování drbů a +10 % tržní poplatek. |
| Tajná organizace | Špionáž +15 bodů, odhalení pasti +15 bodů, pravdivost drbů +10 %; útok −10 %, oba peněžní příjmy −8 % | Plánované: +15 % kvalita informací a −8 % heat tajných akcí. |
| Hackeři | Pravdivost drbů +50 % relativně, kamery a alarmy +15 %, technologická výroba +10 %, špionáž +10 bodů; útok a dirty příjem −8 %, základ obrany −5 % | Technologický bonus se týká příslušných výstupů, například Tech Core, nikoli automaticky každého receptu. |
| Motorkářský gang | Loupež a její cooldown −15 %, příprava útoku a obsazování −10 %, dirty kořist z loupeže +10 %; obrana −10 %, agresivní heat +8 % | Bonus kořisti nevytváří zásoby nad zbývající fond neutrálního districtu. |
| Soukromá armáda | Útok a obrana +12 %, ztráty vybavení −10 %; agresivní heat +8 %, čistý příjem −8 % | Plánované: samostatná síla obsazování +10 % a údržba +12 %. UI už samostatnou sílu obsazování neslibuje jako hotový bonus. |
| Korporát | Čistý příjem +15 %, heat −3 %, obranné systémy +10 %; dirty příjem −15 %, kořist z loupeží −10 %, útok trvá o 10 % déle | Plánované: −10 % tržní poplatek. |

Relativní změna pravdivosti o 50 % není automaticky +50 procentních bodů. Podobně +15 % rychlosti není −15 % délky. Zaokrouhlování může malé bonusy zeslabit, nebo u ztrát celých kusů naopak skokově zesílit.

Všech osm frakcí má definovanou zvláštní schopnost ve stavu **preview**: Tichá dohoda, Noční zásilka, Masová posedlost, Spící buňka, Výpadek systému, Bleskový nájezd, Taktické nasazení a Právní štít. Neuvádím je jako osm hotových aktivních tlačítek se serverovým účinkem. Přesný text těchto návrhů je ve snímku konfigurace. [S20]

**17. Aliance a bounty**

Založení aliance stojí 40 vlivu. Hráč vybírá název, zkratku a barvu znaku. Aliance má vůdce, členy, pozvánky, vlastní komunikaci a veřejné kontakty mezi aliancemi. Maximum je 4 hráči.

Herní přínos je spolupráce, koordinace hranic, obranné příspěvky a za určitých stavů průchod přes alianční koridor. Server umí při obklíčení určit cestu přes jednu vhodnou spojeneckou čtvrť k dalšímu cíli. Nejde o obecný přesun přes libovolný řetězec celé mapy. Obsazení, které by uzavřelo poslední volnou hranici spojence, může vyžadovat potvrzení rizika.

Členové mají pravidelně potvrzovat připravenost. Ve FREE je interval 24 hodin, tlačítko je dostupné 4 hodiny před termínem a po termínu existuje 4hodinová tolerance. Poté lze hlasovat o neaktivním členovi. Hlasování trvá 2 hodiny, většina se počítá z oprávněných hlasujících; další pokus má cooldown. Pro vůdce existuje předání vedení a alianci lze rozpustit.

Odchod má skutečné herní náklady. Dobrovolný odchod deklaruje 12 hodin zákazu nové aliance, 12 hodin útoku a obrany na 80 %, 8 hodin nižšího získávání vlivu, 6 hodin delších dotčených cooldownů a hodinové příměří s bývalými spojenci. Vyhození pro neaktivitu má odlišný profil: 6 hodin blokace nové aliance a 12 hodin 80% útoku, obrany, výroby a příjmu. Rozpuštění má kratší 30minutovou blokaci. Použití každého cooldownového postihu ještě závisí na napojení konkrétní akce; soupis konfigurace není důkaz, že ho čtou všechny nové handlery.

Aliance neslučuje vítěze ve Final Lockdownu. Na konci se hodnotí jednotlivci. Podpora slabšího spojence, dohoda o rozdělení downtownu i případný rozpad před finále proto mají strategický význam.

Bounty je finanční kontrakt na zásah proti soupeři. Minimum je 5 000 čistých peněz, možné délky 1, 6, 12 a 24 hodin. Lze zvolit anonymní zveřejnění. Cílem může být úspěšný útok na hráče, získání konkrétního districtu nebo zničení districtu hráče. Vlastní odměnu nemůže zadavatel sám vybrat za svůj útok. Na sebe nebo aktivního spojence ji nelze vypsat.

Odměna se skládá předem. Splnění server vyplácí při vyhodnoceném odpovídajícím boji; zrušení a expirace vracejí zadavateli složené peníze. Cílový výběr požaduje aktivního hráče s vhodným vlastněným districtem. Vyřazený nebo odešlý účastník tedy není legitimní nový cíl bounty. [S21, S22]

**18. Den, noc a policie**

FREE používá tick 10 sekund. Jeden městský den má 4 reálné hodiny: 2 hodiny denní fáze a 2 hodiny noční. Městský den je 06:00–18:00, noc 18:00–06:00. Naproti tomu klid očisty mezi půlnocí a šestou se řídí skutečným časovým pásmem Europe/Bratislava.

U příjmů má obecný fázový profil denní legální výnos 1,15× a dirty 0,9×; noc legální 0,9× a dirty 1,25×. Výslovné pasivní profily jednotlivých budov mohou tento obecný profil nahradit, proto nejde o univerzální další bonus každé budovy. Den má vyšší policejní tlak, noc vyšší závažnost razie. Příprava útoku má denní násobič 1,05 a noční 0,95 před dalšími úpravami a minimálními délkami.

Některé akce jsou dostupné jen v části městského dne: Noční automaty, VIP noc, Černý charter a VIP klienti ve Strip Clubu jsou noční; Výhodný kurz, Politické okno a Výběr tržeb restaurace denní. Další akce jdou spustit i mimo výhodnou fázi, ale mají jinou cenu, riziko nebo výnos. Heist nyní při vyhodnocení i v náhledu používá denní/noční šance: den −10 procentních bodů úspěchu a +15 bodů odhalení, noc +15 bodů úspěchu a −10 bodů odhalení; nadále platí bezpečnostní limity šancí. Při dlouhé výpravě rozhoduje fáze v okamžiku vyhodnocení. Receptové linky používají výrobní profil fáze včetně přepočtu zbývající práce při přechodu.

Policejní tlak se počítá přibližně jako hráčův heat upravený násobiči + 0,9× součet heat vlastněných districtů, se zaokrouhlením. Základní hranice jsou 30 pro střední, 115 pro vysoký a 180 pro extrémní tlak. Rozšíření území tedy může zvyšovat problém i hráči, který zrovna nekliká na další trestnou akci.

Razie se vyhodnocují v 08:00, 16:00 a 00:00 **městského času**. Plán přetrvává v serverovém stavu a řeší i zpožděné zpracování. V základním nastavení je povolená jedna souběžná razie na serveru a jedna otevřená na hráče. Otevřené raidové okno trvá hodinu; dočasná blokace budov nebo čtvrti může být podstatně kratší.

| Závažnost | Odebrání dirty | Odebrání nechráněných zdrojů | Základní lockdown cíle | Narušení budov |
|---|---:|---:|---:|---:|
| Medium | 5 % | 0 % | 0 | 0 |
| High | 12 % | 5 % | 8 min | 5 min |
| Extreme | 22 % | 10 % | 15 min | 10 min |

Jde o základ před soudem a dalšími zmírněními. Clean cash a populace jsou v běžném seznamu chráněných zdrojů této razie. Jiné audity nebo heisty mohou peníze zasáhnout jinak. Následky razie se v nynější místní změně aplikují při jejím spuštění; potvrzovací karta neslouží jako bezpečný způsob, jak nechat peníze chráněné až do kliknutí.

Zvláštní nález: plánovač má záložní plánovaný cíl i mezi hráči s nízkým tlakem. Vybírá jej ze způsobilých kandidátů s nejnižším tlakem; před ním ale zpracovává rizikové hráče a platí limit souběhu. Pokud k zásahu dojde, minimem tohoto plánovaného případu je medium. Nulový či nízký heat proto není absolutní imunita. Je to reálná součást současného algoritmu a potenciálně důležité rozhodnutí pro férovost hry.

Policejní lockdown jedné čtvrti a závěrečný Final Lockdown serveru jsou odlišné mechanismy. [S2, S23]

**19. Jak se prohrává, jak probíhá očista a jak hra končí**

Hráč může padnout vojensky ztrátou posledního aktivního území. Ztráta původního domovského districtu sama o sobě ještě nemusí být konec: při existenci dalších vhodných districtů se vybere nové velitelství.

Při pádu ze dvou nebo více districtů na jediný se může jednou spustit Last Stand: 12 minut ochrany posledního districtu před útokem. V závěrečné fázi je vypnutý. Neznamená vzkříšení hráče, který už přišel úplně o všechno.

Existuje i jednorázová nouzová pomoc pro úzce vymezenou ekonomickou slepou uličku: jeden aktivní district, nedostatek lidí i peněz, žádná dostupná cesta postupu a žádné blízké odblokování. Konfigurace nabízí 500 clean a 5 lidí. Není to pravidelný denní bonus a ve Final Lockdownu je vypnutá.

Klinika má záznam nedávných ztrát na 90 minut a základní obnovení 15 %, s dalšími klinikami až 40 % před dalšími relevantními efekty. Toxické ztráty mají poloviční míru. Recyklace má kratší okno 18 minut, základní návrat 12 % a strop 34 %; zaměřuje se na vybrané materiály. Nevyužitý záznam expiruje.

První pravidelná očista je v základním FREE plánu po 8 hodinách, další po 4 hodinách. Nejslabší aktivní hráč podle skóre vypadne. Neodstraňují se najednou tři hráči jen proto, že jsou v nebezpečné zóně; zóna tří ukazuje ohrožené pořadí. Po vyřazení se plánuje další termín.

Očista odloží zásah, který by vycházel do skutečné doby 00:00–06:00 v Europe/Bratislava. **Tento noční klid není celoplošné zastavení hry ani univerzální ochrana před útoky.** Především mění očistu a aktivní čas závěru.

Skóre pro očistu je:

`10 000 × districty + 25 × vliv districtů + 500 × aktivní budovy + 0,1 × clean + 0,05 × dirty + 0,2 × bodová hodnota zásob + 2 × populace + bonus aktivity`.

Bonus aktivity je 250 za vhodnou nedávnou akci v poslední hodině. Zásoby mají v základní konfiguraci bez individuálních vah hodnotu podle počtu kusů. Drahá bazuka tedy není pro tuto položku skóre oceněna svou tržní cenou. Lokální nevybraná výroba a lidé v budově také nejsou automaticky totožní s globálními zásobami, které vzorec čte.

Při shodě rozhoduje menší počet districtů, starší poslední akce a nakonec stabilní pořadí identifikátoru hráče. Očista vybírá nejnižší skóre; nejde o náhodné losování oběti. Vyřazenému zůstává záznam výsledku. Jeho districty se v aktuálním FREE nastavení neutralizují a jeho budovy se vypnou do dalšího získání. Konfigurační délka zamčení existuje, ale při zvolené politice `neutralize` se nepoužije automatické čtyřhodinové zamčení celé pozůstalosti.

Když zbývající počet aktivních hráčů dosáhne účinného prahu, začíná Final Lockdown a pravidelná očista se zastaví. Kanonický práh je 8. Hostovaný server ho po uzavření registrace upravuje podle skutečného startovního počtu: `min(8, max(1, počet při uzavření registrace − 1))`. Při pěti účastnících tedy nemusí začít finále hned s pěti, ale až při čtyřech. Během otevřené registrace se finále nespouští.

Final Lockdown trvá 12 **aktivních reálných hodin**. V klidovém okně 00:00–06:00 jeho odpočet stojí, takže skutečný čas na hodinách může být delší. Hráči dál hrají o území, ekonomiku a přežití. Konec se hodnotí podle stavu při vypršení, nikoli podle průměru skóre za celých 12 hodin.

Finální skóre bere skóre očisty a přidává:

- 15 000 za každý downtown district;
- 5 000 za každou aktivní vlastněnou budovu z konkrétního seznamu vzácných typů;
- zápornou penalizaci za vysoký hráčský heat.

Seznam vzácných typů: Burza, Centrální banka, Letiště, Magistrát, Soud, VIP Salonek, Přístav a Parlament. **Lobby Club v tomto bodovém seznamu chybí**, přestože je vzácný v popisu budovy.

Heat penalizace je `50 × max(0, heat − 120) + 100 × max(0, heat − 180)`. Nad 180 se tedy obě části sčítají: další bod stojí 150 bodů skóre. Heat 150 znamená −1 500, heat 200 znamená −6 000. Výsledné skóre neklesá pod nulu.

Vyhrává první aktivní hráč tohoto pořadí. Při shodě rozhoduje více downtown districtů, více districtů celkem, nižší heat a identifikátor. Ukazuje se top 3 a výsledné pořadí zahrnuje také dříve vyřazené hráče. Vítězem není automaticky aliance. Server přechází do ukončeného stavu a tick už nerozvíjí pokračující partii.

Ani obsazení 75 % mapy nepřeskakuje tento závěr v aktuálním FREE nastavení. Pokud by se závěr vůbec nespustil, existuje pojistný hard timeout 7 dní bez automatického přidělení vítěze. Již rozběhnutý Final Lockdown se tímto způsobem předčasně nepřerušuje.

Ilustrační časový průběh při 20 hráčích, bez bojových vyřazení a bez nočních odkladů: první hráč vypadne v 8. hodině, dvanáctý v 52. hodině, zbyde 8 a začne dvanáctihodinový závěr. To dává přibližně 64 hodin. Skutečná partie může být kratší kvůli bojům nebo delší kvůli klidu a jinému serverovému nastavení. [S3, S24, S25]

**20. Chyby opravené při auditu a hranice ověření**

Na základě doplnění zadání jsem doložené chyby rovnou opravil v pracovním stromu. Tyto změny nebyly nasazeny na veřejný server.

| Oprava | Před opravou | Výsledné chování |
|---|---|---|
| Upgrade zbrojovky | Vlastní ceník nebyl vybrán: level 2 stál generických 864 clean a rychlost zůstala 1×. | Level 2 stojí 5 200 clean; rychlost 1,1× se použije pro nové i rozpracované recepty. |
| Upgrade skladu | Resolver účtoval generických 20 304 clean za level 2. | Použije vlastní tabulku: level 2 stojí 4 000 clean + 2 Metal Parts; bez materiálu se upgrade odmítne. |
| Frakční loupeže | Nová neutrální loupež obcházela frakční tempo a kořist. | Motorkářské zkrácení ovlivňuje výpravu i cooldown; dirty bonus a korporátní snížení kořisti respektují konečné zásoby cíle. |
| Denní/noční receptová výroba | Nové časované linky nečetly fázový výrobní profil. | Fáze se skládá s levelem, frakcí, boostem a podporou; server i náhled používají shodný čas. Přechod fáze zachová hotovou práci. |
| Denní/noční heisty | Aktuální resolver nečetl deklarované fázové šance. | Náhled i vyhodnocení používají stejný fázový přepočet a limity šancí. |
| Popis armádního bonusu | UI označovalo nepoužívanou samostatnou sílu obsazování jako aktivní. | Přesunuto mezi plánované efekty v autoritativním i prohlížečovém katalogu; bojové bonusy zůstávají aktivní. |
| Akce elektrárny | Název Napájet výrobu sliboval výrobní účinek, ale akce vyplácela peníze. | Akce se jmenuje Prodat přebytek a popisuje okamžitý peněžní výnos. Identifikátor zůstal kompatibilní. |
| Aktuální pravidla mapy | Dokumentace tvrdila, že chybí autoritativní příkazy loupeže a heistu. | Popis odpovídá serverovým časovaným operacím a skutečným přesunům kořisti. |

Regresní ověření pokrývá platby a odmítnutí upgradu bez materiálu, rychlost zbrojovky, souběh frakce/levelu/boostu/elektrárny, fázový přechod, shodu náhledu heistu a skutečných šancí, konečné zásoby loupeže i motorkářskou dobu výpravy a cooldown. Navazující integrační kontroly procházejí všechny čtyři výrobní budovy, výběr výrobků a řetězec do zbrojovky.

| Závěrečné ověření 9. 9. 2026, Node 24.18.0 | Výsledek |
|---|---|
| Pravidla auditu, upgrady, sklady, heisty/loupeže, frakce, den/noc a dříve hlášené regrese — 7 souborů | 103/103 testů prošlo |
| Čtyři výrobní toky, výběr výroby, řetězec do zbrojovky a související UI modely — 8 souborů | 49/49 testů prošlo |
| Frakční kompatibilní katalog a pasivní UI — 2 soubory | 21/21 testů prošlo |
| TypeScript: `tsc -p tsconfig.test.json --noEmit` | Prošlo |
| Generovaný prohlížečový config: `run-browser-config-generator.mjs --check` | Prošlo |
| Odkazy v auditu a katalogu, `git diff --check` | Bez neplatných odkazů a whitespace chyb |

Celkem 173 různých cílených testů v 17 souborech; opakované běhy nepočítám navíc. První běhy odhalily chybný import nové pomocné funkce, nesprávné identifikátory v nových testech a staré očekávání popisu armádního bonusu. Tyto problémy byly opraveny a dotčené kontroly znovu prošly. Nejde o plnou sadu ani o PASS simulace celého serveru.

Nové důkazy: [gameplay-audit-regressions.test.ts](../../tests/unit/game-core/gameplay-audit-regressions.test.ts). Souběh bonusů a skutečný počet hotových kusů ověřuje také [reported-gameplay-regressions.test.ts](../../tests/unit/game-core/reported-gameplay-regressions.test.ts).

Další zjištění jsou otázky návrhu nebo historické zbytky, nikoli doložené chybné zpracování aktuálního příkazu:

- **Plánované frakční efekty:** kvalita intelu, specifický tajný heat, některé poplatky, tvorba drbů a údržba již mají označení plánované. Audit je nezavádí jako nový ekonomický systém. Totéž platí pro všech osm speciálních schopností ve stavu preview.
- **Staré ceny expanze:** nepoužívaná pole 550/1 050 vlivu nepředstavují platbu v současném toku; skutečná cena pokusů je 5/10. Audit uvádí účinné pravidlo a uchovává kompletní konfiguraci pro dohledání.
- **Skóre zásob:** kusy surovin se běžně oceňují stejně, nikoli podle tržní ceny. Změna těchto vah by byla zásah do vyvážení finále.
- **Dealer a výrobní náklady:** prodej drogy nemusí vrátit plný čistý náklad nákupu a výroby všech vstupů. Levně získané suroviny a hotové zásoby mají jinou návratnost. Případné přecenění vyžaduje ekonomické vyvážení.
- **Nízký heat:** plánovaná policejní razie může mít záložní klidný cíl a minimální medium následek. Jde o explicitní větev pravidel; nízký heat není absolutní imunita.

Audit neprohlašuje celou hru za bezchybnou. Nové mobilní vizuální ověření, E2E hostované partie a kontrola nasazení neproběhly. [S12, S14, S20]

**21. Různé styly hry a proč dávají smysl**

Následující styly vyvozuji z pravidel. Nejde o empirický žebříček nejsilnějších strategií z odehraných stovek partií.

**Ekonom a legální správce.** Staví na restauracích, obchodu, skladech, příjmové síti a později bance. Mafián a Korporát mají přirozenou příjmovou vazbu. Výhoda je financování výroby a silnější čistá hotovost pro skóre. Slabina: samotná ekonomika neubrání district a může přilákat heist. Před finále je třeba rozlišovat, která investice se ještě vrátí a která jen sníží hotovost.

**Průmyslník a dodavatel výzbroje.** Rozvíjí továrny, zbrojovky, sklady a energetiku, vyrábí strategické komponenty a obchoduje s nedostatkovým zbožím. Síťové bonusy a včasný Industrial Overdrive dávají smysl při naplněných frontách. Slabina je závislost na odbytu, kapacitě a korunových nákladech; ve skóre se drahý inventář sám adekvátně neocení.

**Nelegální podnikatel.** Kombinuje Kartel, tunely, kluby, dealery a praní. Rozhoduje původ levných zásob, noční peněžní násobiče, kontrola rizik a bezpečná cesta z dirty do clean. Slabina jsou policejní i podnikové kontroly a nevýhodnost některých základních výrobních prodejů.

**Územní expanzionista.** Prioritizuje získávání lidí a vlivu, kvalitní průzkum a řetěz neutrálních obsazení. Získává další příjem i velké bodové skoky. Musí plánovat 15minutovou stabilizaci, skutečnou ztrátu lidí a obranu nové hranice. Vlivová cena dalších pokusů je nyní nízká, takže limitem může být spíše populace a čas.

**Vojenský dobyvatel.** Investuje do výzbroje, náboru, fitness, logistiky a informací o obraně. Soukromá armáda má přímé bojové bonusy. Útočí tam, kde získaná ekonomika, průchod mapou nebo finální bodová hodnota ospravedlňuje ztráty. Velké množství bazuk však současně přidává katastrofické riziko.

**Lupič a ekonomický škůdce.** Neutrální loupeže používá jako zdroj peněz a materiálu, heisty jako zásah do bohatých sousedů. Vybírá poměr počtu lidí, utajení a kořisti. Má nižší přímý přínos k územnímu skóre a musí převést kořist na něco, co mu pomůže přežít očistu. Motorkáři mají kratší loupež i následný cooldown a o 10 % vyšší dirty kořist, omezenou zbývající zásobou cíle.

**Informační hráč.** Tajná organizace nebo Hackeři, špioni, obranné senzory, restaurace a kluby. Hledá slabé cíle a snižuje pravděpodobnost drahého špatného rozhodnutí. Může zásadně pomáhat alianci. Informace ale samy nevytvářejí dostatek lidí a peněz; část deklarované kvality intelu vyžaduje dopojení.

**Politický hráč.** Kult, magistrát, lobby, soud a společenské budovy. Získává a utrácí vliv, ovlivňuje podmínky a chrání příjmy. Vliv má navíc bodovou hodnotu. Musí hlídat, aby politická spotřeba a skandály nesrazily jeho vlastní pozici právě před očistou.

**Obranný hráč.** Drží menší počet kvalitních území, kamerovou síť, alarmy, rozumně rozmístěné věže, past a obnovu ztrát. Preferuje výhodný boj na vlastní straně. Slabinou je bodová hodnota každého dalšího soupeřova districtu; kompaktnost sama před očistou neochrání.

**Alianční koordinátor.** Organizuje rozdělení hranic, časů, cílů a obranných příspěvků. Pomáhá slabému spojenci před vyřazením a zabraňuje vzájemnému uzavření cest. Jeho problém přichází ve finále, kde je výsledek individuální a ne každý společný úspěch zlepší stejně všechny členy.

**Lovec finálních bodů.** Přesouvá pozornost na downtown, přesně bodované vzácné budovy, dostatek hotovosti a snížení heat před koncem. Nákup výzbroje má smysl tehdy, když stihne zajistit území či obranu. Držení drahého nepoužitého inventáře není rovnocenné držení hotovosti.

**Aktivní oportunista.** Sleduje konec ochrany, vyprázdněný loot, protivníkovy ztráty, odhalenou obranu a čerstvě neutralizované pozůstatky po očistě. Jeho výhoda je načasování. Slabina je závislost na informacích a častější dostupnosti během partie.

Silný hráč tyto role kombinuje. Čistá jednostrannost má omezení: bojář potřebuje průmysl, průmyslník trh nebo území, ekonom ochranu a informační hráč prostředky k využití získané informace.

**22. Co ze skóre plyne prakticky**

Jeden běžný district má jen za vlastnictví 10 000 bodů. To odpovídá 100 000 čistých peněz, 200 000 špinavých peněz nebo 400 bodům vlivu, pokud zanedbáme ostatní položky. Aktivní budovy v něm a jeho vliv přidávají další hodnotu.

Downtown přidá dalších 15 000. Downtown district se dvěma bodovanými vzácnými budovami má tedy jen za district, downtown a vzácnost 35 000; dvě aktivní budovy přidají dalších 1 000. Před započtením hotovosti a vlivu jde o 36 000 bodů.

Za jednu bazuku uloženou v globálních zásobách nyní dostaneš základně 0,2 bodu v položce zásob. Její bojová hodnota může být obrovská, ale účetní bodová hodnota je zanedbatelná. Vybavení musí něco získat nebo zachránit, aby se ve finále vyplatilo.

Založení aliance spotřebuje 40 vlivu, což okamžitě představuje 1 000 bodů vlivové složky. Smyslem je, aby se ztráta vrátila spoluprací. Před očistou není rozumné bezmyšlenkovitě utratit bodovou rezervu jen proto, že tlačítko právě svítí.

Skóre za aktivní budovu nezávisí na jejím levelu. Upgrade se vrací přes produkci či příjmy, ne automatickým přidáním stejného počtu bodů jako zcela nová budova. Vyšší level skladu má hodnotu tehdy, když skutečně zvýší nejvyšší kapacitní úroveň sítě.

Není zde jediný pevný příkaz „vždy utratit vše“ nebo „vždy držet vše“. Před očistou rozhoduje vyhnutí se poslednímu místu, v růstu návratnost investice a ve finále stav v konkrétním závěrečném okamžiku.

**23. Jak by měla vypadat srozumitelná hráčská zkušenost**

Na začátku musí hráč rychle pochopit rozdíl mezi lidmi v budově a lidmi v gangu, mezi hotovou výrobou a skladem a mezi průzkumem a autorizací k obsazení. Jinak může mít pocit, že má všechny potřebné věci a hra mu bez důvodu nedovoluje pokračovat.

U každé akce je potřeba jasně ukázat cenu, dobu do výsledku, případné další čekání po výsledku, co se rezervuje a jaké jsou reálné ztráty. U výroby má být jeden výsledný čas a vedle něj srozumitelný rozpis účinných bonusů. Seznam zelených procent, která server ve skutečnosti nečte, hráči nepomáhá.

Před očistou by měl mít hráč čitelně své pořadí, rozpad skóre a důvod rizika. Ve finále potřebuje vědět, že se hraje o individuální skóre, že downtown a vybrané vzácné budovy mají zvláštní bonus a že noční pauza odpočtu neznamená zastavení veškerého dění.

Na mobilu k tomu patří čitelné reporty, dostupná tlačítka a modální okna vystředěná ve skutečně viditelné části displeje i při změně lišt Chrome nebo Safari. Ztmavené pozadí, nechtěný hover a animace jsou důležité pro srozumitelnost stavu, ale samy nedokazují správnost ekonomiky nebo bojového výsledku. Tento audit nové mobilní vizuální ověření neprováděl.

**24. Celkové hodnocení návrhu hry**

Hra má jasnou identitu: rozvíjíš městské impérium pod časovým a konkurenčním tlakem. Její nejsilnější vazba je mezi mapou, ekonomikou, výrobou, informacemi a vyřazováním. Očista omezuje bezpečné nekonečné pasivní farmaření a finální bodování dává velkou strategickou cenu downtownu.

Audit odhalil rozdíly mezi slibovanými a skutečně zapojenými bonusy. Doložené chyby v cenách upgradů, výrobních časech, loupežích a heistech jsou opravené; plánované frakční efekty jsou popsané odděleně. Staré konfigurační cesty nadále vyžadují opatrnost při dalších úpravách. Druhé velké téma je ekonomická a bodová návratnost: například drogový výrobní prodej, ocenění vzácných zásob a prudká hodnota území vyžadují záměrné vyvážení.

Z tohoto auditu proto neplyne tvrzení „celá hra je bez chyb“. Plyne z něj konkrétní a doložitelný popis toho, co už hra umí, jaké vazby vytváří a kde její pravidla potřebují sjednocení. Opravená pravidla i omezení provedeného ověření jsou uvedena v části 20.

**Zdroje a mapa důkazů**

Všechny odkazy níže vedou do stejného místního repozitáře. Řádky se v pracovním stromu mohou posouvat; názvy souborů a funkcí určují použitý zdroj.

- **S1 — Serverový čas a operace:** [tick.ts](../../packages/game-core/src/engine/tick.ts), [completePendingDistrictActions.ts](../../packages/game-core/src/handlers/completePendingDistrictActions.ts), [pendingDistrictActionShared.ts](../../packages/game-core/src/handlers/pendingDistrictActionShared.ts).
- **S2 — Policie:** [triggerRaid.ts](../../packages/game-core/src/rules/police/triggerRaid.ts), [raidSchedule.ts](../../packages/game-core/src/rules/police/raidSchedule.ts), [raidConsequences.ts](../../packages/game-core/src/rules/police/raidConsequences.ts), [raidOpeningTarget.ts](../../packages/game-core/src/rules/police/raidOpeningTarget.ts).
- **S3 — Konec partie:** [finalLockdownLifecycle.ts](../../packages/game-core/src/rules/victory/finalLockdownLifecycle.ts), [finalLockdownResolution.ts](../../packages/game-core/src/rules/victory/finalLockdownResolution.ts), [checkVictory.ts](../../packages/game-core/src/rules/victory/checkVictory.ts).
- **S4 — Budovy a mapa:** [building-catalog.ts](../../packages/game-config/src/public/building-catalog.ts), [district-building-sets.ts](../../packages/game-config/src/public/district-building-sets.ts), [empire-streets-city-map.json](../../packages/game-config/src/maps/empire-streets-city-map.json), [starterDistrictProductionBuildings.ts](../../packages/game-core/src/state/starterDistrictProductionBuildings.ts).
- **S5 — Servery:** [public-server-registry.ts](../../packages/game-config/src/public/public-server-registry.ts), [free-hosted-server-lifecycle-policy.ts](../../packages/game-config/src/public/free-hosted-server-lifecycle-policy.ts).
- **S6 — Vstup:** [matchmaking-join-flow.md](../matchmaking-join-flow.md), [free-hosted-starting-player-state.ts](../../packages/game-config/src/public/free-hosted-starting-player-state.ts), [selectSpawnDistrict.ts](../../packages/game-core/src/handlers/selectSpawnDistrict.ts), [account-password.ts](../../apps/server/src/player-entry/account-password.ts), [postgres-player-entry-factions.ts](../../apps/server/src/player-entry/postgres-player-entry-factions.ts).
- **S7 — Dostupné příkazy:** [game-command.ts](../../packages/shared-types/src/commands/game-command.ts), [startPendingAttackDistrict.ts](../../packages/game-core/src/handlers/startPendingAttackDistrict.ts), [startPendingHeistDistrict.ts](../../packages/game-core/src/handlers/startPendingHeistDistrict.ts), [startPendingRobDistrict.ts](../../packages/game-core/src/handlers/startPendingRobDistrict.ts).
- **S8 — Ekonomika:** [calculateIncome.ts](../../packages/game-core/src/rules/economy/calculateIncome.ts), [collectIncome.ts](../../packages/game-core/src/rules/economy/collectIncome.ts), [playerInfluence.ts](../../packages/game-core/src/rules/economy/playerInfluence.ts).
- **S9 — Špionáž:** [spyDistrict.ts](../../packages/game-core/src/handlers/spyDistrict.ts), [resolveSpy.ts](../../packages/game-core/src/rules/spying/resolveSpy.ts), [spyIntel.ts](../../packages/game-core/src/validation/spyIntel.ts).
- **S10 — Drby:** [rumorPipeline.ts](../../packages/game-core/src/rules/events/rumorPipeline.ts), [restaurantBuildingActions.ts](../../packages/game-core/src/handlers/restaurantBuildingActions.ts), [vipLoungeBuildingActions.ts](../../packages/game-core/src/handlers/vipLoungeBuildingActions.ts).
- **S11 — Akce budov:** [useBuildingAction.ts](../../packages/game-core/src/handlers/useBuildingAction.ts), [powerStationBuildingActions.ts](../../packages/game-core/src/handlers/powerStationBuildingActions.ts), [courthouseBuildingActions.ts](../../packages/game-core/src/handlers/courthouseBuildingActions.ts).
- **S12 — Výrobní výpočty:** [productionLineShared.ts](../../packages/game-core/src/handlers/productionLineShared.ts), [factoryProductionShared.ts](../../packages/game-core/src/handlers/factoryProductionShared.ts), [armoryProductionShared.ts](../../packages/game-core/src/handlers/armoryProductionShared.ts), [productionSpeedModifiers.ts](../../packages/game-core/src/rules/production/productionSpeedModifiers.ts), [buildingUpgradeRules.ts](../../packages/game-core/src/rules/buildings/buildingUpgradeRules.ts), [completeProduction.ts](../../packages/game-core/src/rules/production/completeProduction.ts).
- **S13 — Kapacity:** [storageCapacityResolver.ts](../../packages/game-core/src/handlers/storageCapacityResolver.ts), [queuedProduction.ts](../../packages/game-core/src/handlers/queuedProduction.ts), [armoryProductionHandlers.ts](../../packages/game-core/src/handlers/armoryProductionHandlers.ts).
- **S14 — Expanze a loupení:** [occupyBalance.ts](../../packages/game-core/src/rules/districts/occupyBalance.ts), [occupyDistrict.ts](../../packages/game-core/src/handlers/occupyDistrict.ts), [completePendingOccupations.ts](../../packages/game-core/src/handlers/completePendingOccupations.ts), [neutralRobbery.ts](../../packages/game-core/src/rules/districts/neutralRobbery.ts), [resolveImmediateHeist.ts](../../packages/game-core/src/rules/heists/resolveImmediateHeist.ts), [heistDistrict.ts](../../packages/game-core/src/handlers/heistDistrict.ts).
- **S15 — Boj:** [attackDistrict.ts](../../packages/game-core/src/handlers/attackDistrict.ts), [resolveCombat.ts](../../packages/game-core/src/rules/combat/resolveCombat.ts), [combatMath.ts](../../packages/game-core/src/rules/combat/combatMath.ts), [resolveTrap.ts](../../packages/game-core/src/rules/traps/resolveTrap.ts), [validatePlaceTrap.ts](../../packages/game-core/src/validation/validatePlaceTrap.ts).
- **S16 — Podniková ekonomika:** [casinoBuildingActions.ts](../../packages/game-core/src/handlers/casinoBuildingActions.ts), [streetDealersBuildingActions.ts](../../packages/game-core/src/handlers/streetDealersBuildingActions.ts), [centralBankBuildingActions.ts](../../packages/game-core/src/handlers/centralBankBuildingActions.ts), [cityHallBuildingActions.ts](../../packages/game-core/src/handlers/cityHallBuildingActions.ts).
- **S17 — Trhy:** [market-config.ts](../../packages/game-core/src/rules/market/market-config.ts), [serverMarketSystem.ts](../../packages/game-core/src/rules/market/serverMarketSystem.ts), [marketCommands.ts](../../packages/game-core/src/handlers/marketCommands.ts).
- **S18 — Boosty:** [activatePlayerBoost.ts](../../packages/game-core/src/handlers/activatePlayerBoost.ts), [playerBoostState.ts](../../packages/game-core/src/rules/player-boosts/playerBoostState.ts).
- **S19 — Zakázky:** [cityEventCommands.ts](../../packages/game-core/src/handlers/cityEventCommands.ts), [cityEventLifecycle.ts](../../packages/game-core/src/rules/city-events/cityEventLifecycle.ts).
- **S20 — Frakce:** [faction-definitions.ts](../../packages/game-config/src/public/faction-definitions.ts), [factionRules.ts](../../packages/game-core/src/rules/factions/factionRules.ts).
- **S21 — Aliance:** [allianceMembership.ts](../../packages/game-core/src/handlers/allianceMembership.ts), [allianceLifecycle.ts](../../packages/game-core/src/rules/alliances/allianceLifecycle.ts), [frontier.ts](../../packages/game-core/src/rules/map/frontier.ts).
- **S22 — Bounty:** [bountyCommands.ts](../../packages/game-core/src/handlers/bountyCommands.ts), [bountyClaims.ts](../../packages/game-core/src/handlers/bountyClaims.ts), [bounty.ts](../../packages/shared-types/src/entities/bounty.ts).
- **S23 — Den a noc:** [day-night-config.ts](../../packages/game-config/src/public/day-night-config.ts), [day-night-action-rules.ts](../../packages/game-config/src/public/day-night-action-rules.ts), [policePressure.ts](../../packages/game-core/src/rules/police/policePressure.ts).
- **S24 — Očista a skóre:** [eliminationLifecycle.ts](../../packages/game-core/src/rules/elimination/eliminationLifecycle.ts), [eliminationScore.ts](../../packages/game-core/src/rules/elimination/eliminationScore.ts), [finalEmpireScore.ts](../../packages/game-core/src/rules/victory/finalEmpireScore.ts), [eliminationDistrictPolicy.ts](../../packages/game-core/src/rules/elimination/eliminationDistrictPolicy.ts).
- **S25 — Pacing a přežití:** [serverPacingPolicy.ts](../../packages/game-core/src/rules/server-pacing/serverPacingPolicy.ts), [playerTerritoryLifecycle.ts](../../packages/game-core/src/rules/liveness/playerTerritoryLifecycle.ts), [playerOperationalLiveness.ts](../../packages/game-core/src/rules/liveness/playerOperationalLiveness.ts), [hosted-lifecycle-action-completion.ts](../../apps/server/src/admin/hosted/hosted-lifecycle-action-completion.ts).

Všechny výchozí číselné hodnoty navíc dokládá přiložený export z `createFreeModeConfig()`. Přesnost tohoto dokumentu je ohraničená jeho datem a lokálním pracovním stromem.
