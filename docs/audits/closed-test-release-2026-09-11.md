# Opravné vydání pro uzavřený test — 11. 9. 2026

**Závěr: lokální opravy jsou připravené; zatím nelze potvrdit připravenost nasazeného stagingu pro 20 lidí.** Živé PostgreSQL, hosted prohlížečová akceptace a stagingový load/soak nejsou v tomto prostředí ověřené. Níže jsou jednotlivé vrstvy oddělené.

Výchozí `origin/main`: `ca7f6069bbe3cecfc3e3418b5e9428928de7ed39`. Opravná větev: `fix/closed-test-release`. Obsahuje předchozí lokální audit a balanc akcí `99a4cffac2eb911ff3889a187ec142724bb9c2a8` a mobilní změny převzaté z PR #3 (`681ac32dea07a2c0547287f593a19e5ea4f29dd0`). Před integrací se ověřila shoda všech 14 souborů této UI opravy s GitHub bloby; sloučení zachovalo novější lokální změny. Původní pracovní adresáře nebyly přepsány.

## A01–A08: příčiny, opravy a důkazy

Všech osm původních chyb bylo znovu reprodukováno na výchozím lokálním `99a4cff`. [Výchozí anonymizované výsledky](closed-test-release-baseline-2026-09-11.json) jsou chybné stavy před opravou, nikoliv PASS. Regrese se nejprve spouštěly proti neopravenému chování.

| ID | Příčina a provedená oprava | Core / obnova | Server / vydání |
|---|---|---|---|
| A01 | Příkazová brána zaměňovala historii ID za obsazená místa. Sdílené `countRuntimeOccupiedSeats` počítá unikátní existující účastníky kromě `left`; vyřazení dál zabírá místo. Používá jej vstup, brána i shrnutí lobby. Rezervace a nedokončené registrace nadále hlídá durable vrstva. | Zachovaná historie 21 ID, 20 současných účastníků; opakovaný starý cleanup neodstraní nové členství téhož účtu. | `release-replacement-capacity.test.ts`: skutečná hosted aktivační funkce a dispatcher původního i náhradního hráče, odmítnutý 21. účastník; čerstvý runtime po JSON obnově. In-memory, živý PG neověřen. |
| A02 | Historická role leader sloužila jako oprávnění. Sdílená kontrola vyžaduje současného aktivního člena, správný seznam, příslušnost hráče a aktuálního vlastníka. Zapojeno do rozpouštění, pozvánek, přijetí, hlasování a projekce oprávnění. | Odchod, návrat, nucené odstranění, starý odstraněný leader a legitimní nástupce; odmítnutí bez vedlejších změn, historie zachována. | `release-alliance-session.test.ts`: vlastní platná session bývalého vůdce, skutečný `/submit` handler po načtení uloženého stavu, rozpuštění odmítnuto. In-process HTTP boundary, ne vzdálený staging. |
| A03 | Dokončení záviselo na měnícím se katalogu nabídek. Přijetí nyní ukládá soukromou kopii nabídky, odměny, rizika, nákladů a názvu. Obměna běžící zakázku neodstraní. | Tři kontakty, hranice obměny, úspěch/neúspěch, JSON restart, jediné dokončení, plný sklad a čekající/částečný claim, další start. Projekce zveřejňuje jen whitelisted údaje. | `city-event-rotation-release.test.ts` a původní `city-event-flow.test.ts`; skutečný core, hosted PG/UI čeká. Historicky již osiřelé běhy mají zvláštní postup níže. |
| A04 | Odečtená vratná posádka heistu zmizela ze skóre. Platná živá rezervace se nyní započítává právě jednou do populace očisty i finále; dostupní lidé zůstávají odečteni. Nové operace mají identitu členství a uvolněné rezervace jsou označené. | Rezervace/cancel/JSON obnova, ochrana nového pokusu, těsné pořadí dvou hráčů pro očistu i finále. Původní bojové regrese kontrolují ztráty a vratky. | `release-penalty-and-reserved-crew.test.ts`, `reservedOperationPopulation.ts`, oba výpočty skóre. Ne každý možný bojový výsledek má samostatnou novou bodovací regresi. |
| A05 | Maximum délek prodlužovalo všechny účinky. Každý ekonomický, akční a bojový účinek má vlastní uložený konec. Příměří a zákaz vstupu/založení zůstávají samostatné. | Hranice 6/8/12 h ±1 ms, skutečný přírůstek vlivu v ticku po 7 a 9 h, obnova starého profilu. Resolver skládá dosud aktivní postihy, UI ukazuje jednotlivé účinky i více záznamů. | `alliancePenaltyDeadlines.ts`, `alliancePenaltyModifiers.ts`, `alliancePenaltyPresentation.js`; nové termíny v serverové projekci. Hosted ověření čeká. |
| A06 | Existující akční postih se nedostal do cooldownů operací. Při přijetí se uloží aktivní multiplikátor a po vyhodnocení prodlouží následnou blokaci, nikoliv cestu. | Špionáž, heist, útok a neutrální loupež; aktivní/ukončené okno, seznam dotčených akcí, kombinace s frakcí, obnovená operace a špionážní slot. | `pendingAllianceCooldown.ts` + `release-action-cooldowns.test.ts`. Zrušená mise nevytváří nový trest; report, slot a blokace vycházejí z téhož výsledku. Hosted čeká. |
| A07 | Vznik výrobního postihu byl mimo přepočet rozběhnuté výroby. Přepočet je nyní součástí úspěšného aliančního příkazu i pozdějších lifecycle změn v ticku. | Tech Core 44 → 54 při vyloučení v ticku 5; skutečný výstup až v novém termínu, hlasování příkazem i schedulerem, restart, všechny čtyři výrobní budovy a souběžné recepty/fronty. | `production-transitions-release.test.ts`; žádné opětovné účtování či restart odvedené práce. Hosted čeká. |
| A08 | Přepočet neobsahoval stabilizaci, síť a změnu vlastníka/frakce. Doplněn společný faktor s dosavadními cestami plánování. Stabilizace se na novém kusu neaplikuje dvakrát. | Tech Core 88 → 47 při konci stabilizace v ticku 5; skutečné obsazení nového districtu, zrychlení sítě a doběhnutí stabilizace získané továrny, restart a přesná hranice dokončení. | `productionTransitionFactors.ts`, `productionSpeedModifiers.ts`; samostatné existující přepočty boostů a upgradu zachovány. Hosted čeká. |

Testy serveru jsou v `tests/server/`, výrobní a city regrese v `tests/integration/game-core/`, bodování a cooldowny v `tests/unit/game-core/`. Výrobní matice má 11 scénářů, nikoliv 11 celých partií. Obnova zde znamená serializaci a čerstvé načtení testovaného stavu; nejde o ověřený restart Fly workeru.

## Další doložené nálezy

- **Dvojí místo po přijetí v lokálním matchmakingu:** přijatý účet zůstával 60 sekund zároveň jako rezervace i hráč. Pokus o 11. vstup do 20místné instance byl odmítnut. Úspěšné vytvoření runtime členství nyní odstraní odpovídající dočasné rezervace; zamítnutý vstup je neodstraňuje. `release-twenty-sessions.test.ts` registruje a vybírá start 20 odlišných účtů, pak souběžně provede 20 load a 20 submit a odmítne další vstup. Používá autentizované sessions a skutečný Netlify handler v jednom procesu, nikoli živý PostgreSQL nebo 20 prohlížečů.
- **Cizí hlas při expiraci:** hlasovací handler vyhodnocoval expirované hlasování před kontrolou členství volajícího. Kontrola oprávnění nyní předchází tomuto vedlejšímu účinku; outsider nemůže hlasování dokončit vlastním příkazem.
- **Náhled restaurace:** při balancu na ×1,5 vlivu zůstalo v klientském profilu +12 %. Příslušná procenta nyní pocházejí z generované serverové konfigurace. Regrese záměrně očekává 80 → 120 vlivu za den.
- **Vývojový plný snapshot token:** při testu 20 účtů přes lokální endpoint vyrostl nad limit HTTP těla. Současný hosted režim tento vývojový token neposílá. Test souběhu proto používá uložený runtime, platnou session a `snapshotToken: null`, stejně jako hosted veřejná odpověď. Limit těla nebyl zvětšen. Vývojová obnova celé dvacetihlavé hry přes klientský token není tímto vydáním opravena ani doporučena.

## Balanc a mobilní rozhraní

Součástí větve je [audit všech 40 akcí a 32 typů budov](building-action-balance-2026-09-11.md) s [číselnou přílohou](building-action-balance-numbers-2026-09-11.json). Výkup dealerů nyní oceňuje celý výrobní řetězec, dovoz respektuje hodnotový rozpočet, charter má skutečnou slevu/riziko, příjmové bonusy se nepočítají dvakrát. Řada drobných odměn se zvýšila a spolu s nimi se upravil odstup opakování. Nejde o důkaz rovné výhernosti frakcí nebo konečného lidského balancu.

UI integrace zahrnuje nákupní potvrzení uvnitř hry, zásobník školy x/y a jeho náhled při výběru, odpočet FIN/nočního klidu, viditelnou horní lištu při policejním výsledku, název speciální akce ve zprávě, modernější potvrzení, kompaktní centrovanou City Event kartu, zarovnání jediného materiálu a bonusu času ve výrobní kartě, konec mobilní stránky a výšku/scroll boost okna. Nové prohlížečové scénáře jsou v `mobile-visible-viewport.spec.js`; v tomto prostředí nebyly provedeny proti změněné verzi. Screenshoty přiložené uživatelem ukazují staré chyby, nejsou důkaz opravy. Fyzický iPhone ověřen nebyl.

Zachován současný onboarding a O hře; nepřidán War, skiny ani dříve odmítnutá přestavba. Unit scénáře onboardingu a pojmenování jsou součástí regrese. Noční klid není změněn na zákaz běžných operací.

## Kompatibilita a obnovitelnost

SQL schéma ani již aplikované migrace se nemění. Jde o volitelné doplnění JSON snapshotu.

- **Starý City Event s dochovanou nabídkou:** před první rotací se zkopíruje původní nabídka. **Již osiřelý běh bez podkladu:** nesestavuje se jiná náhodná zakázka. Původní běh zůstává v soukromém `unresolvedRuns`, hráč dostane oznámení o ověření nákladů a může pokračovat. Automatická refundace neznámé zaplacené ceny není provedena. Správce musí cenu doložit původním snapshotem/auditem; jinak zůstává evidovaný nevyřešený nárok. Tento záznam se nesmí při úklidu vymazat. Pro ruční vyrovnání se má použít stávající auditovaná administrativní cesta po ověření účtu, serveru a jednorázovosti.
- **Staré alianční postihy:** přesně rozpoznaný FREE profil dobrovolného odchodu z 10. 9. 2026 má historicky zmrazený převod na 6/8/12 hodin. Nerozpoznaný starý profil ponechá uložený společný konec. Aktuální balanc nepřepisuje historické podmínky. Nové explicitní termíny mají přednost.
- **Staré rozběhnuté operace:** nový cooldown se ukládá při přijetí. Starší operace bez této kopie doběhnou s původním multiplikátorem 1; trest se nedopočítává zpětně z dnešního stavu. Nové operace mají identitu členství. U starších se zachovává původní kompatibilita podle identity hráče/serveru; bez historického membership ID nelze zpětně dokázat každý pokus.
- **Výroba:** zachovávají se zaplacené vstupy, místní výstup, fronty a odvedená práce. Při změně vlastníka se porovnává původní a nový vlastník; boostové přepočty se nesmí aplikovat dvakrát. Test dokončení přesně v hranici ověřuje, že hotový kus nedostane zpětný postih.

Před nasazením použít projektovou zálohu a společné vydání API/workeru/klienta. Návrat ke staré binárce by znovu umožnil A02 a mohl ztratit vazbu přijatých City Events při další rotaci; preferován dopředný opravný commit. Obnovit starý snapshot živé hry znamená ztrátu novějších hráčských akcí a není automatický rollback této opravy. Žádný sdílený server nebyl resetován.

## Ověření a provozní omezení

Node `v24.19.0`, projektový lockfile, klientské statické závislosti připravené `node scripts/build-netlify-client.mjs`. Lint zahrnuje generovanou browser konfiguraci, environment/release matice, produkční fixture hranici, architekturu, bezpečnost dispatcheru a rozpočty souborů. Limity nebyly zvyšovány kvůli výsledku.

Závěrečné ověření na výsledném aplikačním kódu:

| Vrstva | Testy | Soubory | Výsledek |
|---|---:|---:|---|
| Unit | 2 781 | 374 | PASS, celá projektová unit sada |
| Integration | 237 | 34 | PASS, celá běžná integrační sada |
| Server | 452 | 73 | PASS, celá serverová sada po opravě přípravy sessions |
| Persistence bez živého PG | 67 | 9 | PASS |
| Read models | 60 | 6 | PASS |
| Recovery critical | 29 | 4 | PASS, testovací adaptéry a fencing, nikoliv živý PG |
| **Celkem unikátních případů uvedených vrstev** | **3 626** | **500** | **0 konečných selhání, 0 skipů v těchto bězích** |
| Živý PostgreSQL | 0 | — | Nespouštěn: prostředí nedostupné |
| GitHub Chromium smoke | 6 | 3 | PASS na PR kódu, podrobnosti níže |
| Cílené nové mobilní/hosted scénáře | 0 | — | Dosud neověřeny |
| Stagingový load/soak | 0 běhů | — | Nespouštěn |

Pět simulačních unit souborů a jeden integrační simulační soubor jsou standardně vyloučené projektovými běžnými skripty; živé PG soubory také nejsou součástí běžné persistence sady. Tyto exclusions nejsou vydávány za PASS. Starý audit 941 testů ani opakované cílené běhy se do aktuálního počtu znovu nepřičítají.

První široký běh našel 19 unit selhání (staré ceny/cooldowny, starý policejní padding a skutečně starý bonus restaurace), jednu integrační referenci starého HEAT směnárny a jednu serverovou fixture tvořenou prázdnými ID místo existujících účastníků. Očekávání byla změněna podle zdokumentovaného balancu, nikoliv odstraněna; UI bonus byl opraven v aplikaci. Opakovaná unit/integration sada prošla. V neomezeně souběžné serverové sadě příprava 20 účtů s 60 sériovými reserve/join/select HTTP požadavky a šifrováním vývojových snapshotů překročila společný 20s limit (21,5 s). Příprava má nyní samostatný `beforeAll` rozpočet 60 s; samotné souběžné příkazy stále 20 s a všechna původní očekávání. Následně prošla celá serverová sada. Jde o rozdělení doložené testovací přípravy, nikoliv zvýšení provozního SLA nebo timeoutu herního příkazu.

Prošly také TypeScript, celý projektový lint, build admin/client/Netlify functions a build hosted workeru. Docker image nelze místně sestavit bez Dockeru; tuto část ověřuje příslušná CI brána.

### Samostatná simulace

`simulate:20p -- --seed=release-2026-09-11 --steps=500 --players=20` doběhla za 570 418 ms do ticku 500. Souhrn je v [closed-test-release-simulation-2026-09-11.json](closed-test-release-simulation-2026-09-11.json).

- 1 627 příkazů: 796 přijatých, 831 odmítnutých; 0 runtime errors, 0 porušení kontrolovaných invariantů.
- 12 zahájených útoků; runner vykazuje 0 úspěšných a 0 neúspěšných dokončení. To není potvrzení dokončené války.
- 365 špionáží (258 úspěch, 44 částečné, 23 selhání; součet se nerovná zahájením), 11 heistů, 36 loupeží, 5 obsazení.
- 3 aktivní aliance, 23 vytvořených bounty, 1 claim, 172 speciálních akcí, 1 policejní zásah, 0 porušení měřených cooldownů.
- 27/40 speciálních akcí nepoužito. 181 záměrů odloženo; 8 odmítnutí planner mohl předem odhalit.
- Největší odmítnutí: 299 nedostupná normální nabídka, 257 chybějící zásoba trhu, 144 nedostupná černá nabídka. Další jsou skutečné herní podmínky nebo negativní sondy; neznamenají 831 serverových havárií.

Verdikt samotného runneru je PASS jeho invariantů, ne kompletní akceptace. Má pět varování: rozdíl evidence command/event obálek, nerozpoznaný samostatný boost, vysokou míru odmítnutí, nepoužité akce a rozdíl bohatství frakcí. Boost ve hře existuje; varování ukazuje mezeru tohoto staršího runneru. Scénář navíc normalizuje start na 5 000/1 000 a limit frakce 3, zatímco aktuální hosted hra používá jiný start. Není to canonical-20p-registration, celá několikadenní partie ani důkaz nového balancu.

| Oblast | Skutečně dosažená vrstva a omezení |
|---|---|
| Registrace/lobby | Hosted aktivační funkce + dispatcher; samostatně 20 lokálních identit přes reserve/join/select-spawn/load/submit; živé DB rezervace neověřeny. |
| Ekonomika/budovy | Core akce a ekonomické ticky; autoritativní projekce a UI unit náhledy. Lidská návratnost/četnost používání čeká. |
| Výroba | Všechny čtyři core výrobní toky, skutečné výstupy/odběr a přechodové regrese; hosted klikání čeká. |
| Špionáž/rob/heist/attack | Existující konfliktní regrese a nová matice cooldownů. Není to ručně odehraná válka dvou vzdálených účtů. |
| Pasti/obrana | Existující core a serverové regrese; nové mobilní ovládání přes skutečný prohlížeč neověřeno. |
| Trh/bazar | Existující escrow/souběh a balanc regrese, nákupní view model; vzdálené dvě současné koupě čekají. |
| Aliance/bounty | Core lifecycle/autorita a in-process vlastní session bývalého vůdce; skutečná hosted aliance/bounty čeká. |
| Policie | Core následky a projekce, opravený náhled sníženého HEAT směnárny; mobilní layout zatím jen zdrojové kontroly. |
| City Events | Core přijetí/obměna/dokončení/recovery/claim a projekce; živá DB a prohlížeč čekají. |
| Očista/finále | Bodování, lifecycle a časové view-model regrese; finální odpočet nebyl nově ověřen v živém WebKitu. |
| Obnova/souběh | Čerstvé JSON runtime, atomické testy a fencing s testovací persistence vrstvou. Živý PG, Fly restart a síťový reconnect čekají. |

Živý PostgreSQL není dostupný: binárky ani Docker nejsou nainstalované; instalaci balíčku odmítlo systémové omezení změny skupiny/uživatele (`setgroups/setegid/seteuid: Operation not permitted`). Bezpečnostní kontroly instalace nebyly vypnuty. Test s názvem postgres používající testovací databázový adaptér není vykázán jako živý PG.

Přístup prohlížeče k lokální upravené aplikaci byl blokován `ERR_BLOCKED_BY_CLIENT`. Nebyl obcházen jiným portem/hostem ani jiným prohlížečovým transportem. Stará přihlášená staging session nemá přijaté členství v právě uzavřené sdílené hře; registrace cizí instance nebyla měněna kvůli testu. Z toho důvodu nejsou v reportu nové PASS screenshoty.

Stagingový load/soak nebyl spuštěn. Jeho povolený interval 60–360 minut nebyl zkrácen. Nejsou zde čísla vzdálených latencí, heartbeatů, DB spojení, CPU ani paměti workeru. In-memory souběh není zátěžový certifikát.

## Vydání

Před publikací zkontrolovat aktuální hlavní větev a shodu stromu oprav. PR musí projít projektovým Quality CI; Hosted Acceptance má 17 samostatných suite jobs včetně canonical-20p-registration. Deploy Staging vyžaduje platný přesný SHA, zálohu, migrace a společný frontend/API/Fly worker. Režim owner-current-main nepovažovat za splnění vynechané hosted akceptace. Doložený stav PR, CI a pozastaveného nasazení je uveden níže.

### Identifikace zveřejněného kódu

- Lokální kódové commity: `99a4cff` (balanc), `3c1cd02` (A01–A08), `bebd556` (mobil/UI), `e4c4fa3acd5684b129f7343ab2ddbe1798d72ba9` (oddělená příprava testu).
- GitHub kódový commit: [`d86ecdf53b2b9784eb1a708546c791e2d79bbd58`](https://github.com/eropoker22/empire1.22/commit/d86ecdf53b2b9784eb1a708546c791e2d79bbd58). Publikován přes Git data API; hash commitu se liší kvůli autorství/času a sestavení historie, ale **celý Git strom je přesně shodný** s lokálním kódem: `30b8d60c34f94b1b2790a7fc5b5cf5e802a0e365`.
- Opravná větev: `fix/closed-test-release`; [PR #4](https://github.com/eropoker22/empire1.22/pull/4).
- CI: [Quality runs](https://github.com/eropoker22/empire1.22/actions/workflows/quality.yml), [Hosted Acceptance](https://github.com/eropoker22/empire1.22/actions/workflows/hosted-acceptance.yml). Stav těchto odkazů se může měnit; při sepsání reportu nebyl pro tento release doložen úspěch hosted akceptace.
- Sloučení / deployment: zatím neprovedeno. [Deploy Staging](https://github.com/eropoker22/empire1.22/actions/workflows/deploy-staging.yml) ani aktuální frontend/API/worker SHA pro tuto opravu nejsou označeny za PASS.

**Doporučení:** zatím neposílat pozvánku 20 lidem jako na ověřené vydání. Kódové opravy a lokální testy jsou dokončené, ale zbývá úspěšná release akceptace, skutečné společné nasazení a ověření mobilních karet i provozu. Staré osiřelé City Events bez podkladů mohou vyžadovat doložené jednorázové administrativní vyrovnání; jejich nároky zůstávají zachované.


### Doplnění: CI a odložení nasazení na pokyn uživatele

[Quality běh 34556949924](https://github.com/eropoker22/empire1.22/actions/runs/34556949924) pro head `d86ecdf53b2b9784eb1a708546c791e2d79bbd58` dokončil všech osm jobs úspěšně. Prohlížečový job [103131525783](https://github.com/eropoker22/empire1.22/actions/runs/34556949924/job/103131525783) spustil **6 testů ve 3 souborech v Chromiu, 6 PASS, 0 skipů, 0 selhání**. Rozsah: read-only admin a izolace, fail-closed bez živého členství, přihlašovací stránka, ignorování lokálního dema a encyklopedie na mobilu/desktopu. Netestoval upravené výrobní/boost/policejní karty, WebKit ani skutečný hosted multiplayer. CI používalo Node 24.20.0; místní ověření 24.19.0. CI checkout je PR merge ref `feb5a5f36ebc7966cb5e9ddc2b34435f019ec2c6`. [Playwright artefakt](https://github.com/eropoker22/empire1.22/actions/runs/34556949924/artifacts/10182920077) je dostupný podle retenční doby CI. Docker image krok byl v PR jobu záměrně skipped podle původního workflow.

Automatický [Netlify preview](https://app.netlify.com/projects/empstr/deploys/6aa36f63bf5d2e00083be6ee) na projektu `empstr` skončil chybou při build skriptu (exit 2). Nasazení preview nebylo publikováno (`published_at: null`). Netlify metadata neposkytla podrobný build log, takže přesná příčina není potvrzená. Jde o preview připojeného hlavního projektu, **nikoli o stagingový release**. Release guard ani nastavení přístupů nebyly kvůli červenému statusu obcházeny.

Uživatel následně výslovně požádal **zatím nenasazovat a později vydat všechny změny společně**. Sloučení PR a další nasazovací operace jsou proto pozastavené. Nebyl posunut `main`, spuštěn Deploy Staging ani měněny produkční/stagingové proměnné. Zdrojový kód zůstává v PR #4. Tento report a jeho dvě přílohy jsou commitnuté lokálně; jejich posunutí do vzdálené větve čeká společně s dalším vydáním, aby nová synchronizace PR nespustila další automatický preview build. GitHub obsahový strom dokumentace byl připraven, ale není vydáván za commit připojený k PR.
