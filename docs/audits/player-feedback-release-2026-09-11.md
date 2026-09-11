# Opravy hráčské zpětné vazby — 11. 9. 2026

Větev: `fix/player-feedback-18`. Výchozí i znovu ověřený `origin/main`: `39cd9aaff213f3e3e7220779e8e06878dd857b7f`.

Tato dávka řeší 17 bodů uživatelského seznamu. Bod 6 byl výslovně odvolán: HEAT při špionáži zůstává až při vyhodnocení. Nejde o nové potvrzení kompletního hosted acceptance ani o nasazení na staging.

## Stav požadavků

| Bod | Oprava a ověření |
|---|---|
| 1 | Přijatý útok uloží oznámení obránci v témže stavu jako operaci. Klient otevře výsledkovou kartu a přidá kliknutelnou Uliční zprávu. Ověřeno přes dvě přihlášené serverové session. |
| 2 | Veřejný efekt útoku nese skutečné ID a nick útočníka a zdrojový district. Okno neodvozuje útočníka z vlastníka cíle. |
| 3 | Efekt používá termín uložené operace a logický kalendář serveru; žádné posouvání o čas jednotlivých požadavků. Klient interpoluje z autoritativního snapshotu monotónními hodinami, respektuje pauzu a na nule čeká na server. |
| 4 | Stejný obsah drbu ve stejném districtu se zobrazuje jednou. Shodný text v jiných distriktech a samostatné potvrzené události zůstávají rozlišeny. |
| 5 | Tlačítko Čísla nahrazuje nadpis MAPA, přepíná čísla districtů a ukládá volbu. Čísla se kreslí do existující cachované vrstvy mapy. |
| 6 | **Beze změny na výslovné přání.** Regrese ověřuje, že start špionáže HEAT nepřidá a dokončení jej přidá. |
| 7 | Celý řádek HEAT je sémantické tlačítko včetně textového popisku. |
| 8 | Policejní vysvětlení zůstává v sekci Policejní zásah, duplicitní horní odstavec se nezobrazuje. |
| 9 | Policejní Uliční zpráva vzniká z aktuálně probíhajícího zásahu s aplikovanými následky; má expiraci. Historické ukončené zásahy nezůstávají v tomto aktivním přehledu. |
| 10 | Nové výsledky mají prioritu nad ostatními kartami. Nový výsledek přeruší otevřený výsledek a po zavření jej fronta obnoví. Koordinátor zvládne i okno bez explicitního CSS z-indexu. |
| 11 | Cíl bounty obdrží oznámení se zadavatelem/anonymitou, částkou, časem a platností. Detail cílového districtu má červený bounty popisek. Anonymní identita není v novém oznámení odesílána. |
| 12 | Bojová karta dostává skutečnou sílu obou stran, vybavení a populační ztráty, obsazení/zničení/poškození, past, vliv vest, HEAT, riziko katastrofy, Tactical Grid a stabilizaci. Výsledek je česky a z pohledu útočníka či obránce. Starší reporty bez uložené síly ji nevymýšlejí. |
| 13 | Opraveno dvojí zdražování černého trhu a nastaven přibližně 25% základní příplatek nad celý výrobní řetězec. Tržní pohyby, policie a samostatná přirážka černého trhu zůstávají. Navíc opraven nesoulad zobrazené/skutečné výkupní ceny při slevě. |
| 14 | Množství v hráčském bazaru zachovává rozepsanou hodnotu a prázdný vstup; snižuje se jen při překročení zásob. |
| 15 | Cenu za kus lze celou smazat a napsat znovu. Neplatný/prázdný vstup blokuje vystavení, návrat do formuláře uchová koncept. |
| 16 | Prodej hráčské nabídky uloží oznámení prodávajícímu s prodaným množstvím, měnou a skutečně připsanou částkou. Opakovaný nákup nevytváří druhou platbu ani druhé oznámení. |
| 17 | Zbývající stabilizace vstupuje do odpočtu šedého tlačítka útoku; vlastní stabilizující district má také dočasnou Uliční zprávu. Při souběhu blokací platí nejpozdější konec. |
| 18 | FREE server odmítá nové útoky první dvě reálné hodiny od `startedAt`. Shodné pravidlo používá projekce tlačítka. Hranice byla testována před, na i po konci, včetně běžícího nočního klidu a podvrženého času příkazu. |

## Hlavní zdroje změn

- Core: `handlers/playerFeedbackNotification.ts`, `startPendingAttackDistrict.ts`, `bountyCommands.ts`, `marketCommands.ts`, `rules/conflict/initialAttackProtection.ts`, `validation/validateAttack.ts`.
- Projekce: `apps/server/src/runtime/projections/gameplay-slice-projection-service.ts`, `packages/game-core/src/projections/district-attack-target-projection.ts`, `battle-report-details-projection.ts`.
- Klient: `page-assets/js/app/runtime/playerFeedback.js`, `serverBattleReportPresentation.js`, `serverDistrictActionPresentation.js`, `map/serverMapPresentationModel.js`, `ui/resultModalQueue.js`, `ui/marketPanel.js`, `pages/game.html`.
- Ceny: `packages/game-core/src/rules/market/market-config.ts`, `serverMarketSystem.ts`, regenerovaný `packages/game-config/src/legacy-page/gameplay-config.generated.js`.

## Ceny a jejich význam

Snímek používá FREE ekonomiku dvaceti startovních účtů (6 000 čistých + 3 000 špinavých na hráče), počáteční zásobu trhu, bez nákupních bonusů. Výrobní náklad zahrnuje celý receptový řetězec. Částky jsou v čistých penězích. Tržní ceny jsou ilustrační snímek, ne pevná cena platná po celou partii. Běžný trh střídá nabídky; černý trh také neposkytuje vše současně.

| Výrobek | Výroba celkem | Nový základ | Nabídka před | Nabídka po | Trh |
|---|---:|---:|---:|---:|---|
| chemicals | 360 | 450 | 572 | 572 | městský |
| biomass | 420 | 530 | 616 | 616 | městský |
| metal-parts | 300 | 380 | 456 | 456 | městský |
| neon-dust | 1220 | 1530 | 6839 | 2372 | černý |
| baseball-bat | 600 | 750 | — | — | hráčský |
| barricades | 1200 | 1500 | — | — | hráčský |
| stim-pack | 800 | 1000 | 1288 | 1288 | městský |
| pulse-shot | 1940 | 2430 | 10834 | 3767 | černý |
| velvet-smoke | 2100 | 2630 | 11734 | 4077 | černý |
| tech-core | 2100 | 2630 | 13575 | 4077 | černý |
| pistol | 3000 | 3750 | 16736 | 5813 | černý |
| grenade | 2700 | 3380 | 15081 | 5239 | černý |
| vest | 3000 | 3750 | — | — | hráčský |
| cameras | 4800 | 6000 | — | — | hráčský |
| alarm | 2700 | 3380 | — | — | hráčský |
| combat-module | 7900 | 9880 | 53317 | 15314 | černý |
| ghost-serum | 6880 | 8600 | 46441 | 13330 | černý |
| overdrive-x | 10640 | 13300 | 71772 | 20615 | černý |
| smg | 8500 | 10630 | 56124 | 16477 | černý |
| bazooka | 16700 | 20880 | 117560 | 32364 | černý |
| defense-tower | 22100 | 27630 | — | — | hráčský |

Položky označené hráčský nemají v těchto NPC trzích nabídku; uvedený základ slouží pro referenční nacenění, není to příslib možnosti koupě. U běžných vstupů byly původní základy smysluplné a zůstaly. Černý trh přestal odvozovat nedostatek z nulového NPC skladu produktu, který běžný trh nenabízí. Technologické jádro tak při tomto snímku stojí 4 077 místo 13 575 při výrobním nákladu 2 100. Vyváženost lidských obchodů je dále otázkou reálného testu.

Test cen kontroluje všechny kanonické výrobní náklady, běžné nákupní přirážky, černý trh, skutečnou a falešnou nedostupnost, nákup s maximální základní slevou obchodních center a soulad zobrazené výkupní ceny se skutečně provedeným prodejem.

## Ověření a omezení

- Node **24.19.0**, projektový lockfile a existující závislosti.
- Cílený finální běh: **182 testů / 26 souborů, 0 selhání, 0 skipů**. Rozpad: unit 141/16 souborů, integration 17/4, server 23/5, read-models 1/1. Tyto testy se překrývají s širšími běhy níže, nesčítat je.
- Širší lokální unit běh: 2 816 testů / 379 souborů; 2 812 prošlo napoprvé. Čtyři selhání očekávala staré ceny, původní frontu, původní seznam CI kroků nebo okamžitý útok. Po úpravě příslušných očekávání a testovacího času prošel navazující běh všech čtyř souborů (41 testů).
- Širší integration běh: 237 testů / 34 souborů; 233 prošlo napoprvé. Čtyři scénáře útoku v nově založeném serveru byly upraveny na stav po úvodní ochraně; jeden navíc výslovně ověřuje odmítnutí během ochrany přes transport. Opakovaný běh obou souborů: 13/13.
- Server: **453/453 testů / 74 souborů**. Kritická obnova: **29/29 testů / 4 soubory**, včetně atomických zápisů a fencing/lease modelů. Žádný live PostgreSQL.
- Persistence: 67 testů / 9 souborů; jeden útok ve fixture potřeboval běžet po úvodní ochraně. Read-models: 60 testů / 6 souborů; stejná úprava jednoho scénáře. Opakovaný běh obou dotčených souborů: 10/10.
- Prošly kontrola TypeScriptu, generování konfigurace, lint/architektura/velikost souborů a produkční sestavení admina, klienta, API i workeru.
- `tests/server/player-feedback-delivery.test.ts` používá dvě odlišné přihlášené session a skutečný command ingress nad izolovanou in-memory instancí. Kontroluje oznámení obránce, shodný termín při posunu času druhého požadavku o 4,5 s a obnovení dat bez původních objektových referencí. Není to ověření hosted infrastruktury ani živé databáze.
- DOM regrese ověřují skutečné renderery, smazání a opětovné zadání bazarových vstupů, prioritní okno a zavření, drby, bounty, společný čas a čekání na server. Nejsou náhradou screenshotů skutečného prohlížeče.
- Připraveny dva Playwright scénáře `tests/e2e/player-feedback-ui.spec.js` (390×740 a 1440×900): přepínač čísel, kliknutí na popisek HEAT, nový výsledek nad otevřeným oknem, zavření a obnova předchozího výsledku. Jde o lokální demo pro ověření skutečné UI integrace, nikoli o potvrzení serverové herní autority. V Quality jsou samostatným krokem po původním live smoke; žádná stávající brána nebyla vynechána.
- Lokální instalace prohlížečů se kvůli nedostupnému stažení nedokončila. Výsledek prohlížečů a CI se musí doložit konkrétním během PR; v okamžiku tohoto záznamu zde není jejich PASS. WebKit ani fyzický iPhone v této dávce ověřeny nejsou.

## Kompatibilita a vydání

Použita kompatibilní rozšíření JSON stavu a projekcí: nové notifikace, volitelná pole bojového reportu, konce blokací a zdroj útoku. SQL migrace ani reset hry nejsou potřeba. Nové zprávy nevytvářejí zpětně staré neuložené útoky/prodeje. Staré rozpracované operace se nadále dokončují přes svůj stávající termín; počáteční ochrana blokuje nové přijetí. Opravy nemažou historii ani měnu.

Staging v této dávce **nebyl změněn**, kód zatím nebyl sloučen do main. Existující staging na `39cd9aa` neobsahuje tyto nové opravy. PR a CI určují konkrétní opravný commit. Případný návrat vydání probíhá existujícím release/rollback postupem; starší čtečka ignoruje nová pole. Živá data a rozehrané servery se nemažou.

Tento audit dokládá opravy hráčské zpětné vazby a pravidla první bitvy. **Nedokládá kompletní hosted acceptance, zátěž 20 sessions ani definitivní herní balanc.**

## Navazující kontrola stejné větve

Pokračování navazuje na lokální commit `f97b9b2`. Při propojení nových oznámení se skutečným rendererem Uličních zpráv se reprodukovaly a opravily tři další regrese:

- Dvě různé serverové zprávy o stejném prodeji během pěti sekund se slučovaly podle textu. U zdroje `player-feedback` se nyní odstraňuje pouze opakování stejného ID; samostatné transakce zůstanou v přehledu. Deduplikace drbů se nemění.
- Přezdívka útočníka „Policejní zásah“ způsobovala, že filtr starých policejních zpráv odstranil i nové oznámení útoku. Serverová oznámení hráči se nyní určují podle jejich typu, nikoli podle textu přezdívky.
- Sdílená výsledková karta po oznámení prodeje ponechávala jeho barevnou třídu i u bounty nebo útoku. Renderer nyní při změně oznámení odstraňuje také všechny tři nové barevné stavy.

Nové tři regresní testy před opravou selhaly. Po opravě prošlo **51/51 cílených testů v 8 souborech**, včetně původních testů serverového doručení útoku, úvodní ochrany, HEAT špionáže, cen trhu, fronty oken a Uličních zpráv. Prošly také `npm run lint` a `git diff --check`.

Prohlížečové ověření zůstává nedoložené: v prostředí není instalovaný Chromium a předchozí stažení selhalo. Během pokračování se E2E nespouštěly. Automatická kontrola oprávnění zamítla odeslání větve na GitHub, protože neuznala výslovné oprávnění k odeslání kódu do cílového repozitáře. PR ani nový CI běh proto nevznikly; místní opravy jsou připravené k odsouhlasení odeslání. Staging ani main se neměnily.

## Dokončení následných nálezů

Uživatel následně výslovně povolil odeslat větev `fix/player-feedback-18` do `eropoker22/empire1.22`, otevřít PR pro kontrolu a opravit všechny zjištěné chyby. Nadále zakázal sloučení a nasazení. Předchozí záznam o blokovaném odeslání popisuje stav před tímto souhlasem. Přímý Git push později narazil na chybějící přihlášení; zveřejnění probíhá přes připojený GitHub.

Opraveny všechny čtyři následně potvrzené nálezy a jejich přímé návaznosti:

- Okno probíhající bitvy dostává živý getter serverového stavu. Odpočet se po minutě nevrací na původní dobu, při pauze stojí a při zastaralém spojení hlásí čekání na server. Identita efektu brání propojení starého okna s novým útokem na stejný district.
- Detail stabilizace i její řádek v Uličních zprávách používají aktuální stav a společná pravidla hodin. Řádek má skutečně živý odpočet, přežije pauzu i čekání na dokončovací tick a zmizí až podle serveru. Otevření detailu nevytváří další historickou zprávu. Ukončený server nevytváří opakované expirované řádky.
- Jméno obránce se čte z veřejného jména současného vlastníka v serverové projekci. Staré scénářové vlastnictví se do serverové hry nepromítá; starší projekce bez jména zobrazí „Neznámý hráč“, nikoli vymyšleného vlastníka.
- Oznámení bounty čte aktuální stav kontraktu a rozlišuje zrušení, vyplacení a vypršení. U záznamu mimo dostupnou historii nepředstírá trvající platnost.
- Server zachová všechny aktivní bounty a nejvýše 50 ukončených záznamů. Tabulka zachová všechny aktivní bounty a nejvýše 20 ukončených; souhrnný počet a odměny se počítají ze všech aktivních kontraktů. Klient při řazení nemění sdílenou projekci. Anonymní zadavatel zůstává skrytý.

Ověření: **171/171 testů ve 22 souborech**, bez skipů, včetně nových regresí a všech šesti read-model sad. Prošly také TypeScript, lint, kontrola diffu a sestavení klienta/admina/API i workeru. Sestavení doplnilo dvouhodinovou ochranu také do sledovaného generovaného admin bundle. Nové regrese zahrnují obnovu dat po více než minutě, pauzu, zastaralé spojení, čekání na serverový tick, ukončený server, skutečný DOM řádku stabilizace, veřejné jméno vlastníka a 60 aktivních bounty mezi 70 ukončenými záznamy.

Lokální prohlížečové a živé PostgreSQL ověření zůstávají nedoložené; stav automatických kontrol bude uveden přímo v PR. Nejde o kompletní hosted acceptance ani o nasazení.

## Zveřejnění a oprava prohlížečové brány

Otevřen draft [PR #5](https://github.com/eropoker22/empire1.22/pull/5). Commit `d6c9684` obsahuje přesně strom čtyř místních opravných commitů; jejich původní historie zůstala v místní záložní větvi. V [Quality 34577200066](https://github.com/eropoker22/empire1.22/actions/runs/34577200066) prošly všechny unit, integration, server, persistence, read-model a critical recovery úlohy i lint/typecheck/buildy a původní live E2E smoke. Nový krok hráčského UI odhalil dvě chyby testovací infrastruktury:

- Scénář volal nevystavenou `window.EmpireRuntime.queueOrOpenResultModal`. Nyní doručuje skutečnou událost `empire:gameplay-slice-rendered`; běžný listener aplikace otevře oznámení útoku a prodeje nad kartou HEAT. Kontroluje obsah, reset barevných stavů, prioritu a obnovení starší zprávy přes skutečné tlačítko zavření na obou velikostech obrazovky. Produkční API nebylo rozšířeno kvůli testu.
- Ukončení spouštěče nechávalo na Unixu běžet Vite jako potomka Node wrapperu; další krok narazil na obsazený port 4174. Spouštěč nyní vytváří vlastní procesové skupiny, ukončuje celou skupinu a čeká na zavření serveru. Ověřeny dva bezprostředně navazující skutečné starty Vite s Playwright `--list`: oba prošly, bez konfliktu portu, po druhém šlo port znovu obsadit. Tento lokální test ověřuje životní cyklus spouštěče, nikoli prohlížečové scénáře.

Výsledek opraveného prohlížečového kroku bude doložen následným CI během v PR. Sloučení ani nasazení neproběhlo.

[Quality 34578000702](https://github.com/eropoker22/empire1.22/actions/runs/34578000702) na `7f93826` následně prošla ve všech osmi úlohách včetně původního live smoke a obou hráčských UI scénářů. Zkontrolovány také snímky z artefaktu `10190462485`: výsledek nad otevřeným HEAT na mobilu a obnovená karta HEAT na desktopu.

Navazující kontrola odhalila stejný problém hodin ještě v samotné bounty tabulce: původní tabulka odečítala `Date.now()` i při pauze a nezohledňovala stáří serverového stavu. Oba způsoby vykreslení řádku nyní používají společný serverový odpočet. DOM test nad skutečným `pages/game.html` pokrývá pauzu, pokračování, posun systémových hodin o šest hodin, nový snapshot po více než minutě, zastaralé spojení, dokončovací tick a zrušení bounty. Před opravou selhal, po opravě prošlo **25/25 testů v 5 souborech**, včetně zachování jediného časovače a listenerů při opakovaném otevření stránky. Lint prošel. Tato poslední změna je rovněž součástí PR, jeho aktuální CI je rozhodující pro finální předání.
