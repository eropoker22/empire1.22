# Empire STREETS — opravné vydání pro hráčský test, 10. 9. 2026

Opravné vydání odděluje implementaci, automatické kontroly, browserové důkazy a stav nasazení. Níže jsou skutečné výsledky lokálního hosted ověření a CI, oddělené od dosud neprovedeného nasazení.

## Rozsah a výchozí stav

- Repo `eropoker22/empire1.22`, výchozí větev `main`, HEAD i načtený upstream `bf11acb4550ccb6e768203cbc467ce4469197289`.
- Opravná větev `fix/player-test-release-20260910`. Core commit `6612519`, klient/kontrakty a browserové testy `322d3c2c5445b546b5bcca0d948f336ee309777b`; oba pushnuté. Výsledné SHA aplikačního kódu je `72563dc02c9863e58bd6ec69da9aeef8e7af1278`. Závěrečný dokumentační commit přidává tento report, screenshoty a sjednocené čekání hosted testu; aplikační kód proti tomuto SHA nemění.
- Výchozí pracovní strom neměl upravené sledované soubory. Nesouvisející adresář `e2e-immediate-action-worktree-20260901/` zůstal zachován a nepatří do vydání.
- Kontext: `gameplay-audit-2026-09-09.md`, `war-balance-2026-09-09.md` a úplné reprodukce v zadání. Doplňkový externí audit nebyl přiložen.
- Baseline Quality `34447487995` selhalo; Deploy Staging `34447852117` bylo skipped. Nejde o důkaz nasazení této opravy.

## Mapa autority

Ověřená account session vybírá účet. PostgreSQL členství rezervuje místo a startovní district, finalizace založí activation job. Worker atomicky uloží členství, stav a událost aktivace. Gameplay session určuje hráče při load/submit. Předčasný odchod odvolá staré sessions a vypořádá pokus; aktivace dalšího členství teprve potom přidělí starter. Idempotence členství i příkazů je serverová.

Tick a server pacing určují vyřazení a finále. Kalendář používá IANA pásmo konfigurace a uloženou vazbu skutečného času na logical tick. Projekce vystavují veřejné termíny a osobní povolené údaje. Karta, horní lišta a průvodce používají společný selector odpočtů. Klient interpoluje pouze z autoritativního snímku a monotónního času; rozhodnutí o vyřazení/vítězi dál dělá server.

## Nálezy

| Bod | Stav implementace | Příčina a oprava | Provedené ověření |
| --- | --- | --- | --- |
| F01 | Opraveno v tomto běhu | Staré escrow přežilo starter. Cleanup uzavře vlastní bounty, odstraní vlastní nabídky, fronty/výstupy a závazky starého pokusu před aktivací; membership guard odmítá opožděný cleanup. | Skutečné hosted activation/leave funkce, create/cancel/expiry/buy, oba pořadí nákupu a odchodu; PostgreSQL upgrade, odchod, restart s prázdnou cache a návrat; jeden starter, historie a revokace staré session. |
| F02 | Opraveno pro nové stavové přechody | Pouhé přepnutí na cancelled ztratilo escrow. Společný terminální přechod sjednocuje stav, právě jednu výplatu a událost/oznámení; kontroluje pokus zadavatele. | Refund 5 000 aktivnímu zadavateli, opakovaný cleanup/expiry, claim před a po cleanupu, žádná druhá výplata; pravdivá projekce důvodu. Historické refundy viz omezení níže. |
| F03 | Opraveno v tomto běhu | Hosted odchod obcházel lifecycle aliance. Sdílené odebrání člena předává vedení, ruší neplatná oprávnění a vypořádá podporu bez trestu dobrovolného odchodu. Tick opraví starý neplatný owner. | Vůdce/běžný/poslední člen, disband nástupcem, opakování, návrat, historický owner, hlasování. |
| F04 | Opraveno v tomto běhu | Přímý join obcházel souhlas. Join nyní spotřebuje platnou pozvánku přes tutéž autorizaci jako accept; helper ověřuje aktuálního vůdce a příjemce. | Přímý vstup bez pozvánky a cizí chat odmítnuty; legitimní pozvání, oba pořadí posledního místa, nesprávný příjemce, opakovaný accept, kapacita. |
| F05 | Opraveno a hosted ověřeno v tomto běhu | Běžná okna skrývala/vypínala collect. Všechna čtyři mají dostupné převzetí podle serveru, pending ochranu a serverový command bridge. | Doménové partial/full storage, session/command integrace; všechny čtyři skutečné hosted cykly PASS, včetně kliknutí na převzetí a použití výstupu v navazujícím receptu tam, kde existuje. |
| F06 + karta | Opraveno v tomto běhu; konkrétní rozsah ověření níže | Konec klidu byl zaměňován za očistu. Samostatné serverové termíny, strukturované podmínky finále, aktivní čas, konečné výsledky a čerstvost dat. | 120 původních cílených testů; později 12/12 clock testů, 22/22 panel lifecycle testů. Závěrečné browserové scénáře 4/4 PASS včetně WebKitu, konce zápasu, dvou záložek, změněných hodin, šířek, výšky, ARIA a refresh. |
| F07 | Opraveno v tomto běhu | Předchozí rychlost se vyhodnocovala po expiraci. Přepočet používá předchozí časový bod, zachovává hotovou práci a mění jen zbývající dobu. | Reprodukce postihu 0,8: konec 42 → 35 při expiraci v 5; kombinované upgrade, boost, infrastruktura a den/noc v cílených regresích. |
| F08 | Opraveno v tomto běhu | Duplicitní klientské profily měly staré ceny/účinky. Oficiálně generovaný katalog a serverové action views řídí popisky a potvrzení; variabilní cena odděluje poplatek, investici a součet. | Kontrakty katalogu/registru/adaptérů, kontrola generovaného souboru a úspěšné Quality CI na `322d3c2`. |
| F09 | Opraveno v tomto běhu | Dispatch odvozoval identitu z překladu. Stabilní actionId, nový i kompatibilní starý alias směřují na existující akci; text „Prodat přebytek“ odpovídá výnosu a HEAT. | Registry/presentation kontrakty celého katalogu včetně školní header akce. Serverová akce existovala už před opravou. |
| F10 | Opraveno v tomto běhu | Parser historického profilu používal nový default. Historicky chybějící influence znamená 0, nový server zachovává 15. | Explicitní 0/15, historická absence, nový default a neplatné vstupy; stávající vliv hráčů se nepřepisuje. |
| F11 | Opraveno v tomto běhu | Chyběla klasifikace 027. Migrace je forward-only kvůli více historickým členstvím a neslučitelným starým unikátním indexům/čtečkám. | Release klasifikace, skutečná čistá PostgreSQL schémata i upgrade před-027 s existujícím členstvím, opakované migrace a restart. SQL/checksum 027 se nezměnily. |

## Pravidla odchodu a aliance

Vlastní neprodané nabídky a vlastní aktivní bounty odcházejícího pokusu se uzavřou bez převodu do příštího starteru. Stejně končí jeho výrobní fronty a místní výstupy. Nákup dokončený před odchodem ponechá kupujícímu zboží; platba patří starému pokusu. Nákup po cleanupu už nemá aktivní nabídku. Rušení/expirace nemá co vracet novému pokusu.

Když odejde cíl bounty, aktivnímu zadavateli téhož pokusu se odměna vrátí právě jednou. Pokud odešel zadavatel, jeho starý vklad se nevyplatí novému pokusu. Hláška o vrácení se zobrazuje pouze s doloženou nenulovou refundací. Potvrzení předčasného odchodu tyto důsledky vysvětluje. Návrat zůstává omezen otevřenou registrací a serverovým oknem odchodu.

Aliance má maximálně čtyři členy a vyžaduje platný souhlas přes pozvánku. Nástupce při nuceném odchodu se vybírá stabilně podle nejstaršího členství, pak nejnovějšího potvrzení aktivity a ID. Dobrovolné opuštění aliance si zachovává své původní postihy; předčasný odchod ze serveru je jiný důvod. Návrat zakladatele neobnovuje starou příslušnost ani vedení. Neplatné pozvánky a hlasování nepřenášejí oprávnění po odchodu.

## Karta Očisty a čas

- Před startem: registrace/čekání a pravidlo první očisty, bez falešného běžícího času.
- Běžná hra: skutečný účinný termín očisty a samostatný nejbližší kalendářní klid.
- Klid: vlastní konec, oddělená očista a důvod jejího případného odložení.
- Před finále: registrační základna, účinný počet přeživších a podmíněná nejdřívější/nejpozdější hranice včetně jediného přeživšího.
- Finále: zbývající aktivní čas, průběžné skóre/pořadí, kvalifikovaný odhad konce a zastavená běžná očista.
- Noční pauza finále: aktivní čas stojí; druhý čas běží do obnovení. Nula čeká na serverové potvrzení.
- Konec: konečné serverové pořadí a žádné pokračující hlavní odpočty.
- Vyřazení/divák, vypnuté režimy, administrativní pauza a nečerstvá/offline data mají odlišný stav.

Serverový `quietHoursWindow` používá stejné IANA pravidlo jako scheduler; `nextEliminationTick` zůstává účinnou očistou. `remainingActiveTicks` se nepřevádí na prostý rozdíl kalendářních časů. Odhad finále zahrnuje více nočních oken. Volitelný `calendarAnchor` zachová skutečný kalendář i po administrativní pauze; starší snapshot používá původní základ. Klient používá serverový snímek, monotónní čas a změřený round trip, nikdy hodiny telefonu jako autoritu. Stará verze nesmí přepsat novou. Běžná obnova využívá existující polling, hranice/otevření jen řízené obnovení; žádný request pro každé číslo každou sekundu.

Pravidla rozlišují herní den/noc, odklad očisty a pozastavení aktivního finále. Netvrdí, že klid zastaví všechnu ekonomiku nebo zakáže každý útok. Danger zone není počet současných obětí. Osobní zlepšení skóre není zárukou přežití. Soupeřovy soukromé zásoby/bodové rozklady se nezveřejňují.

Mobilní obsah se skládá pod sebe, má jeden hlavní vnitřní scroll a dostupné zavření/čas. Ověřené rozměry: 360×780, 390×844, 430×932, 768×1024, 1366×768, 1920×1080, 844×390 a 390×640; WebKit také změny výšky a landscape. Je to emulace, nikoli fyzický iPhone.

Screenshoty skutečně vyrenderované karty nad read modely vytvořenými game-core (izolovaný komponentový test, nikoli důkaz hosted přihlášení):

- [Noční klid a oddělená očista, WebKit 390×844](assets/repair-2026-09-10/ocista-quiet-mobile-webkit.png)
- [WebKit landscape 844×390](assets/repair-2026-09-10/ocista-quiet-landscape-webkit.png)
- [Pozastavené finále, desktop 1366×768](assets/repair-2026-09-10/ocista-final-paused-desktop.png)
- [Pozastavené finále, mobil 390×844](assets/repair-2026-09-10/ocista-final-paused-mobile.png)

## Ověření a prostředí

Použit Node 24.18.0, PostgreSQL 16 v lokálním Dockeru, samostatná databáze s označením e2e a izolovaná schémata. Testy nezasáhly data skutečných hráčů. Testovací identity/hesla, lokální logy, databáze a `.tmp` nejsou součástí commitu.

Potvrzené příkazy (spouštěné lokálním Node 24 přes scripts/run-local-bin.mjs):

```text
vitest run tests/persistence/postgres-atomic-rollback-live.test.ts (lokální test PostgreSQL)
  3/3 PASS: dva nezávislí kupující, pět pre-commit crash pointů, rollback ticku
vitest run tests/server/hosted-departure-settlement.test.ts
  7/7 PASS
vitest run tests/persistence/player-entry-postgres-live.test.ts (explicitní lokální test DB)
  6/6 PASS, 107,47 s včetně přípravy
vitest run [onboarding-flow, final-lockdown, elimination-system, quiet-hours-calendar,
  runtime-elimination-ai-panel-runtime, authoritative-elimination-countdown, match-overview-countdowns]
  120/120 PASS
playwright test tests/e2e/match-overview.spec.js
  4/4 PASS (1,3 min), včetně explicitního WebKitu a dvou záložek
npm run typecheck
  PASS lokálně i v Quality CI
npm run lint
  PASS včetně browser config, environment matrix, release matrices, fixture boundary,
  architecture, hosted control plane, command dispatch safety a file budgets
```

[Quality 34460320210](https://github.com/eropoker22/empire1.22/actions/runs/34460320210) na PR head `322d3c2` skončilo **SUCCESS ve všech osmi jobs**: lint/typecheck/builds, unit, integration, server, persistence, read-model, critical recovery a E2E smoke (6/6). Jde o test tohoto opravného kódu, nikoli baseline nebo cizího staging SHA. Serverová sada zahrnuje opravený test 21. hráče s platným rozdělením frakcí; samostatný PostgreSQL test dál odmítá pátého člena stejné frakce.

Lokální široký běh před posledními korekcemi skončil 485 soubory PASS, 4 FAIL a jedním Vitest `onTaskUpdate` RPC timeoutem. Čtyři konkrétní příčiny byly sjednocení časového základu srovnávacího worker testu, transportní pozorování snímku, nový stavový ARIA uzel a očekávání odpočtu nově přijatého snímku. Cílené opakování a následné čisté CI tyto problémy uzavřely. Timeout lokálního test runneru se nevydává za PASS ani za chybu ekonomiky hry.

Další cílené výsledky: aliance 23/23, regresní výroba/špionáž a trvalý serverový krok průvodce 6/6, skutečný náhled startovního území 1/1, srovnání workeru a reference po 1 000 ticích PASS. Náhled nemění zdrojový stav a rozlišuje district bez pasivních lidí/clean příjmu.

Hosted výrobní test nyní ověřuje `craft-item → runTick → collect-production → hlavní sklad → navazující recept`. Řízený čas je pouze Node testovací nástroj mimo importy aplikace a mimo HTTP API: vyžaduje testové prostředí, loopback DB s názvem test/e2e, explicitní přepínač, přesné ID a čerstvý disposable server. Každý tick volá skutečný game-core pod stejným PostgreSQL zámkem jako příkazy; nezasévá hotový výrobek ani nemění recept na instantní. Zbrojní výstup je konečný výrobek, pro něj se nevymýšlí neexistující navazující recept.

První browserové pokusy odhalily a opravily skutečný mobilní overflow/překrývání karty. Hosted pokusy dále odkryly slabinu starého důkazu (pouze craft), dlouhé čekání, kolizi s policejním oznámením a HMR reload při práci. Tyto neúspěšné pokusy se nepočítají za finální PASS.

Závěrečný WebKit nejprve narazil na zakázaný port 4190 a poté na timeout načítání assetů samostatného studeného Vite serveru. Na stejném běžícím serveru 4174 jako hosted test proběhl celý viewport scénář bez chyby; tato omezení testovacího prostředí nebyla maskována změnou assertion.

## Migrace, kompatibilita a omezení

027 je forward-only. Nasazení musí vyřadit staré API/workery dříve, než nový kód využije více pokusů. Staré unikátní indexy nelze obnovit nad legitimní historií; řešením je kompatibilní forward fix, nikoli mazání členství. Nová volitelná JSON pole escrow, kalendáře a výukových akcí nevyžadují další SQL migraci; čtečky mají kompatibilní fallbacky.

Historická již zrušená bounty se automaticky zpětně nevyplácejí. Bez doložení původního vypořádání a pokusu zadavatele by hrozila druhá platba nebo připsání novému starteru. Tento běh neopravuje živá historická data; případné nároky vyžadují konkrétní záznamy a cílené ověření.

Nevyhlašuje se ověření dvaceti souběžných browserových sessions jen podle kapacitních testů nebo simulace. Neproběhl test na fyzickém telefonu. Dlouhodobý balanc solo/aliance, válka, platnost bazaru a rozdíly startů se plošně neměnily. Nový předstartovní náhled ukazuje skutečné příjmy, budovy, populační zdroj a vysvětlení náročnosti, včetně závislosti na frakci a herní fázi.

## Stav vydání

Commit/push: opravy jsou na větvi `fix/player-test-release-20260910`, [PR #1](https://github.com/eropoker22/empire1.22/pull/1). Přesné výsledné SHA a závěrečné CI jsou uvedeny v uzavření níže. Staging tohoto vydání nebyl nasazen ani otestován; produkce beze zásahu.

**Doporučení:** kód připravuje řízený test s 20 lidmi, ale veřejné pozvánky až po schváleném staging nasazení tohoto vydání, ověření SHA klienta/API/workeru, schématu a krátkém hosted smoke průchodu. Lokální důkaz stojí na skutečném PostgreSQL, všech čtyřech výrobních cyklech a časových scénářích; neprokazuje dostupnost dosud nenasazeného stagingu ani 20 současných sessions.


## Uzavření hosted ověření a rozsahu UI

Výrobní E2E běžely přes `node scripts/run-local-hosted-full.mjs --suite=production-pharmacy,production-drug-lab,production-factory,production-armory` (výběr sad v jednotlivých bězích):

| Sada | Konečný výsledek | Délka | Zdroj lokálního důkazu |
| --- | --- | --- | --- |
| Lékárna | 1/1 PASS, bez retry | 69,188 s | 2026-09-10T09-28-11Z / production-pharmacy-all-release-summary.json |
| Laboratoř | 1/1 PASS, bez retry | 79,395 s | 2026-09-10T09-28-11Z / production-drug-lab-all-release-summary.json |
| Továrna | 1/1 PASS, bez retry | 85,607 s | 2026-09-10T09-12-15Z / production-factory-all-release-summary.json |
| Zbrojovka | 1/1 PASS, bez retry | 61,818 s | 2026-09-10T09-12-15Z / production-armory-all-release-summary.json |

Cesty jsou pod .tmp/local-hosted-full, soubory mají prefix playwright-. První společný běh jako celek neprošel kvůli kolizi testového zavírání policejního oznámení u lékárny/laboratoře; jeho úspěšné tovární a zbrojní scénáře byly zachovány. Opravený pomocník zavírá skutečně viditelné tlačítko až po registraci. Druhý běh lékárny/laboratoře prošel celý. Souhrn neoznačuje první neúspěšný batch za PASS.

Testy ověřily také zachování fronty po reloadu. Navazující výroba byla chemicals → neon-dust, neon-dust → ghost-serum a metal-parts → baseball-bat. U koncového zbrojního výrobku se žádný recept nevymýšlel.

Screenshoty reálných hosted oken po cyklu (před závěrečnou korekcí šířky textového tlačítka; dokazují stav výroby, nikoli finální podobu hlavičky):

- [Lékárna, mobil](assets/repair-2026-09-10/production-pharmacy-mobile.png)
- [Laboratoř, mobil](assets/repair-2026-09-10/production-drugLab-mobile.png)
- [Továrna, mobil](assets/repair-2026-09-10/production-factory-mobile.png)
- [Zbrojovka, mobil](assets/repair-2026-09-10/production-armory-mobile.png)
- [Lékárna, desktop před zadáním](assets/repair-2026-09-10/production-pharmacy-desktop.png)

Dodatek k ilustrovanému průvodci byl uživatelem zrušen. Následné povolení se týká pouze vnitřního UI O hře: společné čitelnější texty, nadpisy a ovládání výběru tématu. Rozměry, vnější design, původní obsah i počet témat zůstávají zachované. Nevznikly ilustrované kapitoly ani nový povinný úvod. Zachovány jsou opravy původního onboardingu, které potvrzují existující akce serverovým výsledkem a zohledňují skutečný startovní district.

## Přesné hranice důkazu

- Již funkční před během a zachováno: existující serverová akce prodeje přebytku, serverová dostupnost zvláštních akcí; oprava se týká prezentace/dispatch aliasu. Regresní sady ověřují původní ceny upgradu, výrobu, inflaci včetně dirty cash, rezervace a policejní pravidla.
- Jiný prokázaný záměr: danger zone zvýrazňuje více ohrožených, pravidelná očista vyřazuje jednoho; zbrojní výrobek nemusí mít další recept. V testech kapacity se odděluje limit 20 lidí a limit 4 stejné frakce.
- Neprovedeno: fyzický iPhone, dvacet současných browserových sessions, staging smoke na výsledném SHA, dlouhodobé vyvážení války/solo versus aliance. Komponentový test O hře nepředstírá nové přihlášení ani ekonomický příkaz.
- Historické uzavřené bounty nejsou automaticky opravené. Bez konkrétního finančního dokladu nelze bezpečně zpětně přiznat refundaci.
- Nová SQL migrace nebyla potřeba; 027 nebyla přepsána. Žádná živá data nebyla mazána ani obnovována ze snapshotu.

## Přijímací scénáře časů — rozsah důkazu

| Scénář | Důkaz |
| --- | --- |
| Očista 8 h, konec klidu 80 min | `match-overview-countdowns.test.js` a browserový `match-overview.spec.js` |
| Očista mimo klid, odklad do 06:00, jedna odložená očista | Skutečný scheduler v `elimination-system.test.ts`, včetně přesných hranic okna |
| Přechod dne a jarní/podzimní DST | Řízené IANA scénáře `quiet-hours-calendar.test.ts`, délka okna 5/7 hodin |
| Finále 2:15 při začátku klidu a obnova | Doménový lifecycle `final-lockdown.test.ts`, selector i browserový zmrazený čas |
| Odhad přes více nočních oken | 40 aktivních hodin přes dvě noci v `quiet-hours-calendar.test.ts` |
| Čekání na registraci/počet přeživších po nejdřívější hranici | `final-lockdown.test.ts` a `match-overview-countdowns.test.js`, bez jistého falešného startu |
| Malý server a jediný přeživší | Skutečné frozen hosted thresholds v `final-lockdown.test.ts` |
| Administrativní pauza a obnova | Kalendářní anchor a neměnný aktivní tick v doméně; samostatný stav v browseru |
| Starý snímek, zpožděný worker, reconnect/reload | Monotónní selector, stale limit, merge odmítající starší verzi; dvě browserové záložky |
| Chybějící/null údaje | Selektory a read-model adapter: žádné NaN, undefined ani smyšlené pořadí |
| Vypnuté režimy, vyřazení, konec zápasu | Browserový průchod nad skutečnými game-core projekcemi, konec bez odpočtů |
| Změněné hodiny klienta | Monotónní doménový test i druhá browserová záložka s přepsaným Date.now |
| Opakované otevření/zavření | 22 panelových testů, řízený počet timerů/listenerů/refresh a browserový průchod |

Pro aktuální hosted manuální start není vystaven pevný budoucí čas spuštění. Karta proto zobrazuje čekání a pravidlo první očisty; neprezentuje odpočet do neexistujícího naplánovaného startu. Browserové scénáře používají běžné projekce, ale uměle zvolenou fázi izolovaného komponentového testu. Nenahrazují živý několikadenní zápas ani fyzický telefon.

Vnitřek O hře: `playwright test tests/e2e/repair-interior-layout.spec.js` — 2/2 PASS (1,1 min), login i hra, Chromium a WebKit, 1366×768 / 390×844 / 360×640 / 844×390, výběr tématu, Escape, scroll lock a minimální text 16 px. Původní rozměry karty nebyly změněny. První WebKit kontrola odhalila přetečení mobilního výběru; po umístění popisku nad select prošla stejná assertion. Jde o UI kontrolu, nikoli důkaz nové aktivní account session.

- [O hře, login desktop](assets/repair-2026-09-10/about-login-desktop.png)
- [O hře, herní markup ve WebKitu](assets/repair-2026-09-10/about-game-mobile-webkit.png)

## Závěrečné CI

[Quality 34462508381](https://github.com/eropoker22/empire1.22/actions/runs/34462508381) na výsledném aplikačním SHA 72563dc02c9863e58bd6ec69da9aeef8e7af1278: **SUCCESS, všech osm jobs**. Lokální závěrečný TypeScript a lint také PASS. Commitování reportu není nasazení; staging zůstává NOT RUN. Veškeré nové a upravené zdrojové soubory této opravy jsou zahrnuté v tematických commitech, nesouvisející pracovní adresář je zachovaný.

Závěrečné hosted ověření po korekci výrobní hlavičky: běh 2026-09-10T09-47-45Z, lékárna **1/1 PASS, 64,547 s, bez retry**, celý runner succeeded=true. Ověřuje navíc šířku textu, nepřekrývání upgradu a skutečný hit target tlačítka pod herními vrstvami. [Finální mobilní výrobní okno](assets/repair-2026-09-10/production-pharmacy-mobile-final.png). Předchozí pokus 09-45-34Z selhal na pětisekundovém čekání serverového výběru čtvrti; karta už byla viditelná v chybovém screenshotu. Hosted čekání nyní odpovídá existující třicetisekundové kontrole autoritativního výběru, bez změny požadovaného výsledku nebo opakování kliknutí.

Registrační UI bylo již před tímto závěrečným krokem správně nastavené na minimálně 8 znaků; znovu ověřeno v pages/login.html.
