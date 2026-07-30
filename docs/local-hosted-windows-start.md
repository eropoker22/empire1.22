# Lokální hosted Empire Streets na Windows

## Doporučený setup

Projekt používá jednu canonical lokální variantu:

- Docker Desktop spouští pouze PostgreSQL;
- Hosted API běží jako lokální Node proces;
- Runtime Worker běží jako lokální Node proces;
- herní frontend a admin běží společně přes Vite;
- všechny procesy používají databázi `empire_hosted_dev` na `127.0.0.1`;
- API i worker používají stejné Git SHA.

Nespouštěj současně starý Docker worker ani ručně `npm run dev:hosted-worker`.

## Co je Docker

Docker Desktop spouští izolované služby. V tomto lokálním setupu drží PostgreSQL v containeru `streets-postgres-1`. Herní worker už v Dockeru neběží, aby se nemíchal starý image s aktuálním zdrojovým kódem.

## Co je PostgreSQL

PostgreSQL je databáze. Obsahuje účty, servery, memberships, gameplay sessions, joby, heartbeat workeru a uložené snapshoty hry.

Data jsou v Docker volume:

```text
streets_empire_hosted_postgres
```

Příkazy pro běžný start ani stop tento volume nemažou.

## Co je Hosted API

Hosted API přijímá požadavky z browseru, ověřuje účet a gameplay session a předává server-authoritative commandy.

Lokální health:

```text
http://127.0.0.1:8787/health
```

## Co je Runtime Worker

Runtime Worker je proces na pozadí. Zpracovává provisioning serverů, membership joby, lifecycle akce a gameplay tick. Dokončuje výrobu, připisuje income, ukládá snapshoty a obnovuje runtime po restartu.

Health endpoint:

```text
http://127.0.0.1:8080/health
```

## Co musí běžet

```text
[ ] Docker Desktop
[ ] PostgreSQL container
[ ] Hosted API
[ ] Runtime Worker
[ ] Game frontend
[ ] Admin frontend
```

Game a admin frontend obsluhuje jeden Vite proces.

## První spuštění

Otevři PowerShell v kořeni projektu a spusť:

```powershell
npm run dev:local-hosted
```

Příkaz:

1. spustí PostgreSQL;
2. počká na jeho healthcheck;
3. provede migrace;
4. připraví lokálního admin uživatele z `.env.local`;
5. sestaví aktuální admin a gameplay klientský bundle;
6. spustí API, worker a frontend;
7. provede readiness kontrolu.

Proces nech běžet. Ukončíš ho pomocí `Ctrl+C` nebo stop příkazem z jiného PowerShellu.

Projekt vyžaduje Node 24. Supervisor použije `EMPIRE_NODE24_BIN`, aktuální Node 24 nebo lokální Node 24 v `.tmp/node24`. Pokud žádný nenajde, skončí s přesným návodem místo spuštění na nepodporovaném Node.

## Odkazy

Hra:

```text
http://127.0.0.1:5173/pages/login.html
```

Admin:

```text
http://127.0.0.1:5173/admin.html
```

## Stav, logy a zastavení

Stav všech částí:

```powershell
npm run dev:local-hosted:status
```

Poslední API, worker a frontend logy:

```powershell
npm run dev:local-hosted:logs
```

Zastavení API, workeru, frontendu a PostgreSQL:

```powershell
npm run dev:local-hosted:stop
```

Stop nemaže container data, databázi, images ani Docker volume.

## Readiness kontrola

Kdykoliv za běhu spusť:

```powershell
npm run verify:local-hosted-runtime
```

Kontrola ověřuje PostgreSQL, migrace, API, worker health, čerstvý DB heartbeat, build parity, admin control plane, frontend, joby, snapshot repository a runtime lease.

Úspěšný konec:

```text
PostgreSQL ........ PASS
Migrations ........ PASS
Hosted API ........ PASS
Runtime Worker .... PASS
Worker Heartbeat .. PASS
Build Parity ...... PASS
Admin ............. PASS
Local Hosted ...... READY
```

## Co znamená 404

Adresa `http://127.0.0.1:8080/` vrací `404 Not Found` záměrně. Worker nemá webovou stránku.

Důležité je:

- worker proces běží;
- `/health` vrací HTTP 200;
- `database` je `available`;
- heartbeat je registrovaný a čerstvý;
- `lastErrorCode` je `null`;
- admin ukazuje worker online;
- nový server dokončí provisioning.

## Jak poznat, že worker opravdu funguje

- worker se nezastavuje;
- log neopakuje stejnou chybu;
- heartbeat je mladší než 30 sekund;
- API a worker mají stejné Git SHA;
- nový server dostane initial snapshot;
- membership job přejde do `completed`;
- server tick roste;
- income a výroba se po ticku změní;
- po restartu workeru se načte poslední snapshot.

## Bezpečný reset lokálních dat

Reset nejdřív odmítne běžící stack, ověří exact loopback databázi, vytvoří dump a teprve potom znovu vytvoří pouze `empire_hosted_dev`.

Nejdřív zastav stack:

```powershell
npm run dev:local-hosted:stop
```

Potom spusť explicitně potvrzený reset:

```powershell
npm run dev:local-hosted:reset-test-data -- --confirm=RESET_LOCAL_HOSTED_TEST_DATA
```

Dump se uloží do:

```text
.tmp/local-hosted-backups/
```

Reset nemaže Docker volume, jiné databáze, images ani celý Docker systém.

## Když něco nefunguje

1. spusť `npm run dev:local-hosted:status`;
2. spusť `npm run verify:local-hosted-runtime`;
3. zobraz `npm run dev:local-hosted:logs`;
4. ověř, že neběží ručně spuštěný druhý worker;
5. nepoužívej `docker system prune`, `docker volume prune` ani ruční mazání databáze.

Pokud readiness hlásí cizí lease nebo build mismatch, zastav všechny ručně spuštěné hosted procesy a spusť pouze `npm run dev:local-hosted`.
