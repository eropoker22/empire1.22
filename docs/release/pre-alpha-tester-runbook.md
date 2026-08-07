# Runbook prvního uzavřeného pre-alpha testu

Tento runbook platí pouze pro `https://staging.empirestreets.cz`. Neopravňuje
production deploy, změnu production databáze, DNS, production Fly aplikace ani
otevření War mode.

## Před otevřením testovacího okna

1. Zapiš přesný 40znakový SHA kandidáta a ověř čistý checkout pod Node 24.
2. Vyžaduj zelený canonical code-level gate a úspěšný staging deploy artefakt.
3. Ověř stejné SHA klienta, API a jediného Fly workeru.
4. Ověř aktuální migration status/checksum a správný staging target bez
   vypsání databázové URL.
5. V admin control plane ověř `ready`, čerstvý worker heartbeat, snapshot a
   nulový neočekávaný outbox backlog.
6. Potvrď, že globální registrace účtů je zavřená. Otevírej ji pouze guarded
   acceptance workflow na přesně omezenou dobu.

## Vytvoření 20hráčového serveru

1. Přihlas se do staging adminu a vytvoř `free` server s template `full`,
   regionem `eu-central`, kapacitou přesně 20 a joins zavřenými.
2. Počkej na `provisioningState=ready`, runtime snapshot a čerstvý worker.
3. Otevři časově omezené registrační okno přes control plane.
4. Pozvi nebo zaregistruj 20 účtů pouze existujícím modelem registrace.
5. U každého dokonči frakci, spawn a ready. Ověř `committedPlayers=20` a
   `readyPlayers=20`; 21. účet musí skončit `SERVER_FULL`.
6. Spusť server validní control-plane akcí ještě v otevřeném registračním
   okně; start kontrakt odmítá okno zavřené předčasně.
7. Jakmile worker převezme běžící server, registrační okno bezprostředně zavři
   serverovým control-plane příkazem. Browserový čas není autorita.

## Co sledovat během hry

- status serveru, current tick a monotónní rootVersion;
- worker heartbeat/lease a stáří recovery headu;
- PostgreSQL pool used/idle/waiting a outbox unpublished count;
- očekávané domain rejection odděleně od auth, rate limit, 5xx a timeoutů;
- duplicity payoutu, reportů, toastů, income, bounty a ownership transferu;
- police pending raid, Očistu, počet aktivních hráčů a Final Lockdown;
- reconnect po refreshi/backgroundu a pravdivý stav eliminovaného hráče;
- bezpečný correlation/diagnostic ID bez tokenů nebo osobních údajů.

## Pause, resume a nouzové zastavení

- `pause` použij při degradovaném workeru, DB potížích nebo před guarded
  fixture operací; ověř, že tick stojí.
- `resume` použij až po ready health, čerstvé lease a správném recovery headu;
  ověř monotónní pokračování ticku.
- Při stale workeru neaktivuj druhou placenou repliku. Zavři joins, server
  pause, zachovej artefakty a postupuj podle incident runbooku.
- Při P0 zastav test: zavři globální registraci, zavři server joins, pause/stop
  postižený server a neměň databázi ručně.

## Ukončení a cleanup

1. Po Final Lockdownu ověř právě jeden persisted match result a zákaz dalších
   gameplay mutací.
2. Archivuj disposable server přes potvrzenou admin akci.
3. Ověř, že server už netickuje, nemá aktivní test lease a nezůstaly aktivní
   rezervace.
4. Znovu zavři globální registraci účtů a proveď veřejný negativní test.
5. Zapiš cleanup, registration a health status do release artefaktu. Selhání
   cleanupu zneplatňuje celý gate.

## Bezpečné diagnostické údaje

Tester hlásí:

- přesný build SHA z nenápadného diagnostického místa;
- čas chyby a stránku/akci;
- correlation ID nebo anonymizovaný server/player hash;
- screenshot nebo pouze sanitizovaný Playwright trace bez credential/session
  vstupů; credential-bearing hosted gate ukládá strukturovanou safe evidence
  místo raw trace.

Tester nikdy neposílá heslo, cookie, session token, DB URL, datum narození,
celý e-mail ani privátní read model jiného hráče.

## Rollback stagingu

Použij pouze existující staging rollback workflow a poslední kompatibilní
immutable SHA. Databáze se standardně nevrací na starší snapshot. Po rollbacku
ověř stejné SHA klienta/API/workeru, migrace, registraci closed, jednu worker
repliku, tick, snapshot a session revokaci. Podrobný postup je v
`docs/deployment/rollback-runbook.md`.

## Zakázané zásahy

- production deploy nebo production smoke s mutací;
- změna production DB, workeru, DNS nebo feature flags;
- ruční přepis migration history nebo již aplikované migrace;
- lokální PostgreSQL/Docker databáze jako náhrada staging persistence;
- demo/localStorage gameplay stav ve veřejném klientu;
- další Fly machine, placený monitoring nebo nová databáze;
- vydání chybějícího/skipped/not-run testu za PASS.
