# Aktuální připravenost pre-alpha release

Poslední ověření: 2026-08-06

Veřejné prostředí: `https://staging.empirestreets.cz`

Ověřený veřejný commit: `8cb88682524dc59c228d1aca6fa64fab663e4a5d` (`8cb8868`)

Tento dokument je jediný stručný přehled aktuální release pravdy. Podrobné
runbooky a starší audity zůstávají historickým kontextem; pokud si odporují,
rozhoduje aktuální kód, testy, veřejný runtime a důkazní artefakty v tomto
pořadí.

## Verdikt

Veřejný staging na `8cb8868` má ověřený 20hráčový bootstrap a základní
multiplayerové akce. Není zatím doložený jedním novým veřejným artefaktem,
který by prošel celou partii od lobby přes Očistu a Final Lockdown až po
perzistentní výsledek, restart, invarianty a cleanup. Proto jej nelze pouze
na základě starších dílčích gate označit za finálně připravený pro první
uzavřený test.

Pracovní kandidát na větvi `fix/pre-alpha-real-player-hardening` není v době
tohoto zápisu veřejně nasazený. Jeho code-level výsledky se nesmí vydávat za
ověření stagingu.

## Co je veřejně ověřené na stagingu

- klient, API a Fly worker hlásily shodný build `8cb8868`;
- API a worker byly ready, worker heartbeat byl čerstvý a PostgreSQL dostupná;
- databázové schéma hlásilo migraci `024_hosted_starting_player_state.sql`;
- globální registrace účtů byla zavřená;
- guarded gate vytvořil 20 unikátních členství, 20 ready hráčů a ověřil jejich
  opětovné přihlášení;
- dílčí veřejné acceptance pokryly vykrádání, špehování, obsazování, útok,
  market, bounty, policii a City Events;
- disposable testovací servery se používají přes autentizovaný control plane
  a staging-only database target guard.

## Co je implementované v autoritativní cestě

- identita pro gameplay `load`, `submit` a `logout` pochází z validované
  gameplay session; request `playerId`, `accountId` ani snapshot token nejsou
  autorizační důkaz;
- production/staging používá persistentní account a gameplay session
  repository a při chybějící autoritě failuje zavřeně;
- příkazy používají transakční persistenci, `commandId` idempotenci a ochranu
  state-version;
- worker vlastní tick, lifecycle, snapshot recovery head a finalizaci výsledku;
- Free full template má kapacitu 20, Očistu, policii a Final Lockdown;
- skončená hra odmítá další gameplay mutace a tick už její stav nemění;
- serverová projekce staví úplný district panel pouze pro vybraný district;
  `ownedDistricts` používá kompaktní index budov bez opakovaného skládání
  actions, slotů a target projekcí.

## Pouze testovací nebo vývojové cesty

- `local-demo` je výhradně loopback vývojová cesta a není veřejnou autoritou;
- fixture snapshot mutace jsou povolené jen guarded staging acceptance flow,
  pouze pro disposable server s připnutým staging DB target hashem;
- zrychlené lifecycle konfigurace patří pouze do test fixtures a nejsou
  veřejným hráčským nastavením;
- in-memory persistence ověřuje kontrakty a crash/recovery scénáře, ale
  nenahrazuje veřejné PostgreSQL ověření.

## Skryté a neveřejné

- War mode není připravený ani veřejně slíbený;
- premium shop, platby a monetizace nejsou součástí tohoto release;
- demo fallback nesmí být dostupný z veřejného server-authoritative klienta.

## Známá omezení a otevřené gate

- pro kandidáta chybí nový veřejný full-lifecycle-20p důkaz až do jediného
  persisted match resultu;
- pro kandidáta chybí nový veřejný recovery/restart důkaz uprostřed lifecycle;
- pro kandidáta chybí kompletní release mobile matrix a dlouhý 20hráčový
  weighted-action soak;
- credential-bearing hosted browser flow má Playwright trace vypnutý; zachovává
  pouze strukturované bezpečné evidence a screenshoty bez raw credentials a
  CI před uploadem fail-closed skenuje artefakty proti ephemeral secretům;
- starší auditní dokumenty mohou popisovat session nebo persistence jako
  nedokončené; aktuální kontrakt je v `docs/gameplay-session-security.md` a
  `docs/persistence.md`;
- právní texty jsou pre-alpha informační text, nikoli právní certifikace.

## Povinný release gate

Kandidát smí být označen za staging-ready pouze tehdy, když jeden přesný SHA
projde:

1. Node 24, architecture/config guards, lint, typecheck a build;
2. unit, server, integration, read-model, non-live persistence, security a
   simulation testy bez release skipů a retry;
3. kontrolu migrací a shody checkout/build SHA;
4. deploy pouze na staging Netlify/API/Fly worker;
5. canonical 20p registraci, full lifecycle, concurrency, recovery, mobile a
   load/soak acceptance;
6. invariant checker, archivaci disposable serverů a ověření zavřené globální
   registrace.

Produkční deploy, produkční databáze, produkční worker a DNS nejsou součástí
tohoto gate.

## Aktuální důkazní artefakty

- `artifacts/release/staging/canonical-20p-registration-8cb8868-retry6/summary.json`
- `artifacts/release/staging/remote-release-health-final-8cb8868.json`

Nový kandidát musí vytvořit vlastní adresář
`artifacts/release/staging/pre-alpha-hardening-<short-sha>/`. Chybějící,
neúplný nebo neúspěšný artefakt se nesmí nahradit ručně vytvořeným PASS.

## Související zdroje pravdy

- `docs/release/pre-alpha-tester-runbook.md`
- `docs/hosting/closed-alpha-staging-runbook.md`
- `docs/persistence.md`
- `docs/gameplay-session-security.md`
- `docs/architecture-boundaries.md`
- `docs/legacy-runtime-guard.md`
- `docs/deployment/rollback-runbook.md`
