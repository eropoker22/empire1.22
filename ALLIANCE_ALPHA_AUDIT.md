# Alliance Alpha Audit

## Co aktuálně aliance umí

- Založení aliance, vstup do veřejné aliance, pozvání hráče, přijetí/odmítnutí pozvánky.
- Serverový read model `allianceBoard` pro aktivní alianci, veřejné aliance, pozvánky, členy, ready stav, kick vote a chat.
- Max velikost free/war aliance je 4 hráči.
- Leader/člen role se renderují z read modelu.
- Alianční chat je serverový command `send-alliance-chat-message` a ukládá se do serverového stavu.
- Odchod a rozpuštění aliance jdou přes serverové commandy `leave-alliance` a `disband-alliance`.
- Kick vote existuje pro neaktivní členy a používá serverové lifecycle pravidlo, ne UI pravidlo.

## Co je jen UI

- Alliance modal, create modal, leave modal, management modal, kick confirm modal a member lightbox jsou prezentační vrstva v `pages/game.html`, `page-assets/js/app/alliance-runtime.js` a `page-assets/css/styles-alliance.css`.
- Krátký alpha pitch v modalu pouze vysvětluje systém hráči.
- Management je pro alpha zúžený na členy, pozvánky, kick voting a odchod.
- Spojenecká obrana je v alianční správě schovaná, protože alpha UI pro ni nemá hotovou bezpečnou akční cestu.

## Co je local/session fallback

- `page-assets/js/app/alliance-runtime.js` stále používá lokální preview alianci jen na localhostu, pokud server nepošle aktivní alianci.
- Preview aliance je teď označená jako lokální preview a má vypnuté pozvánky, chat submit a kick vote submit.
- Globální chat karta je lokální alpha preview v `empire_local_global_chat_state`.
- Starý `empire_local_alliance_state` se při startu runtime maže a nepoužívá se jako autorita.

## Co je server-ready

- `apps/server/src/runtime/projections/gameplay-slice-projection-service.ts` přidává `allianceBoard` do gameplay slice.
- `packages/game-core/src/projections/alliance-board-projection.ts` skládá read model z autoritativního stavu.
- `packages/game-core/src/handlers/allianceMembership.ts` řeší create/join/invite/respond/chat.
- `packages/game-core/src/rules/alliances/allianceLifecycle.ts` řeší READY, kick vote, leave/disband, penalty, truce a audit.
- `apps/server/src/transport/gameplay-alliance-payload-validation.ts` odmítá klientem dodaná autoritativní pole.

## Co bylo upraveno

- Přidán krátký hráčský alpha text: aliance jako malá 4členná crew pro domluvu, ochranu districtů a PvP.
- Doplněné empty/disabled/error stavy pro create, invite, join, chat, kick vote a pending server akci.
- Runtime už nepouští raw debug/server texty do status line, ale mapuje je na hráčské hlášky.
- Create flow validuje prázdný název a max 32 znaků podle core sanitizace.
- Alianční chat je jasně oddělený od globálního preview chatu.
- Management modal je zjednodušený pro alpha.
- CSS drží alianční modaly scrollovatelné na mobilu a neschovává horní resource/topbar lištu při aliančním modalu.

## Co se má nechat

- Serverové commandy a lifecycle pravidla.
- `allianceBoard` jako zdroj UI pravdy.
- Max 4 členové pro alpha.
- Lokální preview aliance jen jako vizuální localhost demo, pokud je jasně označená a neodesílá falešné akce.

## Co se má schovat nebo smazat později

- Lokální preview alianci odstranit, jakmile alpha prostředí vždy pošle reálný `allianceBoard`.
- Lokální globální chat nahradit serverovým globálním chatem, nebo kartu odstranit.
- Spojeneckou obranu zapnout v UI až po hotových serverových commandech a vlastnických limitech.

## Co doplnit před alpha testem

- Ruční průchod create/invite/accept/leave/chat na reálném dev serveru se dvěma účty.
- Ověřit mobile layout na iOS Safari a Android Chrome, hlavně klávesnici v chatu.
- Přidat krátkou alpha testovací instrukci, že aliance je malá 4členná crew bez banky a skladu.

## Co musí být server-authoritative před produkcí

- Členství, role, pozvánky, chat, READY, leave/disband, kick vote, penalty, truce a audit.
- Globální chat, pokud zůstane ve hře.
- Jakékoliv budoucí alianční bonusy, banka, sklad nebo sdílená obrana.
- Oprávnění leadera a validace cíle u invite/kick.

## Rizika exploitů

- UI nesmí nikdy dokazovat členství nebo leader práva. Autorita musí zůstat na serveru.
- Globální chat preview není serverový a nesmí být použit pro moderaci ani důvěryhodnou komunikaci.
- Localhost preview aliance nesmí být dostupná jako produkční stav.
- Kick vote thresholdy se nesmí duplikovat v UI; klient používá hodnoty z read modelu.
- Leave/disband penalty musí zůstat serverová, protože ovlivňuje cooldowny a aliance.

## Mobile checklist

- Alliance modal se vejde do viewportu a scrolluje uvnitř.
- Create, leave, management a kick confirm modaly mají dostupné zavření.
- Chat input zůstává v modalu a neujíždí mimo viewport.
- Horní resource/topbar lišta se při aliančním modalu neschovává.
- Otevření a zavření modalu používá existující overlay scroll lock, takže stránka pod tím nemá měnit scroll pozici.

## Doporučení

Almost ready.

Aliance je pro první alpha preview použitelná jako jednoduchý social/PvP systém: max 4 hráči, jasný leader/member roster, pozvánky, serverový alianční chat, leave flow a serverový kick vote pro neaktivní členy. Zbývá hlavně ruční mobilní ověření na reálných telefonech a odstranění localhost preview před produkcí.
