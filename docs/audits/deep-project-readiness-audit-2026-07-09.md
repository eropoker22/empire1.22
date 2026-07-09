# Deep Project Readiness Audit - 2026-07-09

## Stav projektu

Projekt je v hratelne pre-alpha fazi. Herni jadro, konfigurace budov, read-modely a legacy `game.html` UI uz pokryvaji velkou cast smycky, ale pred ostrym provozem na domene je nutne dotahnout produkcni session, perzistenci, server-authoritative flow a sjednotit posledni legacy UI plochy.

Nejvetsi riziko ted neni jeden konkretni balance parametr. Vetsi riziko je rozchod mezi konfiguraci budov, handlerem akce, serverovym read-modelem a legacy kartou, protoze cast UI porad zobrazuje fallback texty mimo jeden zdroj pravdy. Druhe velke riziko je lint/file-size dluh ve sdilenych handler/projection souborech, ktery ztizuje bezpecne upravy.

## Opraveno v tomto auditu

- Prepsal jsem cast hracskeho UI z anglictiny do cestiny: cooldown/ready/blocking stavy, policejni tlak, bounty/upgrade/akce, day-night hlasky a vybrane map/faction/leaderboard texty.
- Sjednotil jsem multiplikatory na procenta tam, kde se hraci drive ukazovalo `x1.05`, `heat x...` nebo podobne technicke texty.
- Doplnil jsem server aliasy pro prelozene specialni akce budov: `Vnitrni tipy`, `Proriznout kontejner`, `Politicke okno`. To opravuje realny problem, kdy se prelozene tlacitko nemuselo spravne namapovat na serverovou akci.
- Upravil jsem read-model projekce pro finance, support, civil a market budovy tak, aby efektove radky byly citelnejsi a odpovidaly procentovemu UI.
- Prepsal jsem validacni hlasky pro building actions, collect, craft, trap, spy, attack, occupy, rob, heist, bounty a upgrade do cestiny.
- Aktualizoval jsem testy na aktualni balance a nova ocekavana zneni UI/read-modelu.
- Rozdelil jsem cast velkych projection/config souboru: district slot projection, finance building helpers, day/night action/building rules a fixed district building sety.
- Zapsal jsem historicky velke soubory do explicitnich file-size debt budgetu, aby `lint` znovu hlidal dalsi rust.

## P0 pred ostrym verejnym provozem

1. Produkcni identita a session
   - Produkce musi bez realneho identity provideru a produkcniho gameplay session repository failnout zavrene.
   - `playerId` ani `accountId` z requestu nesmi byt autorita. To je v instrukcich projektu spravne pojmenovane, ale pred domenou je potreba to prokazat smoke testem v prod-like konfiguraci.
   - Logout musi revokovat gameplay session, nejen smazat client token.

2. Perzistence a databaze
   - Pred napojenim na realne servery spustit prod-like Postgres smoke podle existujici dokumentace.
   - Overit migrace, zalozeni instance, join/load/submit/logout a obnovu stavu po restartu.
   - Snapshot tokeny pouzivat jen pro obnovu instance, ne jako autorizaci.

3. Server-authoritative domenovy flow
   - Domena nesmi hrace pustit do local-only `game.html` smycky tam, kde se ma hrat proti serveru.
   - Je potreba jeden manualni i automatizovany smoke: login/join/load/submit/refresh/logout.

4. Secrets a cookie politika
   - Pred produkci overit HTTPS, secure cookie flags, SameSite, session TTL, rotaci secrets a zakaz dev provideru v prod defaultu.

## P1 herni spravnost

1. File-size debt uz neblokuje lint, ale porad je technicky dluh
   - `npm run lint` po refaktoru prochazi.
   - Cast souboru je jen zapsana jako explicitni debt budget, ne plne rozdelena. Budou failovat az pri dalsim rustu.
   - Prioritni kandidati na dalsi realne rozdeleni: `useBuildingAction.ts`, admin/runtime projection soubory, `combat-preview-rules.js`, velke alliance/occupy/attack handlery a debug simulace.

2. Jediny zdroj pravdy pro budovy
   - U kazde budovy musi byt dohledatelna jedna pravda: config -> handler -> projection -> UI karta -> test.
   - Sitove efekty, specialni akce a dobehy efektu se maji zobrazovat tam, kde je hrac realne potrebuje videt, ne duplicitne v mechanikach i efektech.
   - Dalsi vhodny krok je automatizovana "building truth matrix" kontrola pro vsechny budovy a akce.

3. Vyroba a sklad
   - Produkcni popupy uz nepouzivaji hracske `x1.xx`, ale legacy UI porad existuje vedle serverovych read-modelu.
   - Skladove kapacity, rychlost vyroby, dealer supply a bonusy levelu je vhodne tahat z jednoho canonical read-modelu.

4. Bounty, market a aliance
   - Bounty targeted flow prosel testem, ale pred ostrym provozem je nutne projit cely zivotni cyklus: zalozeni, cancel/refund, claim, expirace, feed a anti-forgery.
   - Market musi mit ceny, poplatky a slevy serverove autoritativni. Efekty bank, obchodnich center, pristavu, letiste a dalsich budov nesmi zustat jen jako lokalni UI text.
   - Aliance potrebuji bezpecnostni pruchod pres invite/join/kick/leave/ready/vote flows s realnou session autoritou.

5. Day/night specialni akce
   - Night-only test pro cerny charter byl srovnany na realne tick chovani.
   - Dalsi kontrola ma pokryt vsechny day-only/night-only buttony, cerveny stav v buttonu a potvrzovaci dialog.

6. Police a raid smycka
   - Police read-model je citelnejsi, ale chybi kompletni hracsky walkthrough: rust heatu -> varovani -> pending raid -> nasledky -> cleanup.

## P2 UI a cleanup

- Doresit, zda v cestine vsude pouzivat `cekani`, nebo ponechat slovo `cooldown` jen v internich/debug kontextech.
- Projit mobile zobrazeni efektu a mechanik u vsech sitovych budov vizualnim smokem.
- Omezit fallback texty v legacy runtime souborech a co nejvic zobrazeni tahat z core projection vrstvy.
- Vyhodit nebo presunout debug artefakty a stare screenshoty mimo repo workspace, pokud nejsou zamerne soucasti zadani.

## Verifikace

- `npm run typecheck` prosel.
- `npm run lint` prosel.
- Cilene testy prosly: 12 test souboru, 250 testu.
- E2E testy jsem nepoustel. Zmeny sahaly do `game.html`/runtime UI, ale tento audit byl rozsahove siroky a zatim stacily targeted unit/integration kontroly. Pred nasazenim na domenu je vhodny samostatny E2E smoke.

## Navrzeny dalsi postup

1. Spustit prod-like Postgres smoke s realnou test databazi.
2. Vytvorit automatizovanou building truth matrix kontrolu pro vsechny budovy a specialni akce.
3. Prepojit posledni legacy production/storage UI na serverovy read-model.
4. Dale postupne rozdelovat explicitne zapsane debt budget soubory.
5. Provest manualni browser smoke na domene: login, join, refresh bez otevrene karty, budovy, vyroba, sklad, bounty, market, aliance, logout.
