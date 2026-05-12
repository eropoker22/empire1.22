# Empire Streets Architecture Boundaries

Tento dokument definuje hranice mezi legacy statickým frontendem a novější server-authoritative architekturou. Cílem je udržet aktuální hratelný frontend funkční, ale nepřidávat nová gameplay pravidla do `runtime.js` ani do legacy `page-assets` vrstvy, pokud nejde pouze o compatibility bridge nebo render.

## 1. Aktuální stav projektu

Projekt dnes obsahuje dvě hlavní vrstvy.

### A) Legacy statický frontend

Legacy vrstva drží současný hratelný frontend a statické stránky:

- `pages/`
- `page-assets/`
- `page-assets/js/app/runtime.js`
- `page-assets/js/app/persistence/legacyStorage.js`
- starší bridge, runtime a UI soubory v `page-assets/js/app/`
- statické HTML stránky `login`, `lobby`, `faction` a `game`

Tato vrstva je důležitá kvůli kompatibilitě a aktuální hratelnosti. Nemá ale být primárním místem pro nová gameplay pravidla, balancing ani autoritativní změny stavu.

### B) Novější server-authoritative architektura

Novější vrstva postupně přebírá rozhodování, pravidla a sdílené definice:

- `apps/client`
- `apps/server`
- `apps/admin`
- `packages/game-core`
- `packages/game-config`
- `packages/shared-types`

Tato vrstva má být dlouhodobý zdroj pravdy pro gameplay pravidla, konfiguraci, serverový stav a sdílené typy.

## 2. Pravidlo zdroje pravdy

- Gameplay pravidla patří do `packages/game-core`.
- Balancing, budovy, ekonomika, police config, mode config a veřejné herní definice patří do `packages/game-config`.
- Sdílené typy a entity patří do `packages/shared-types`.
- Server-authoritative stav patří do `apps/server` a game-core modelů.
- Legacy frontend smí pouze renderovat, číst read modely, volat API, držet kompatibilní local UI state a bridgeovat staré flow.

Legacy frontend může dočasně obsahovat compatibility logiku pro existující flow, ale taková logika nemá růst do nového gameplay systému.

## 3. Co smí legacy runtime

Legacy runtime a `page-assets` vrstva smí:

- renderovat UI
- zobrazovat mapu
- otevírat modaly a panely
- číst připravená data z config/data registry
- volat API a server endpoints
- poslouchat WebSocket nebo read-model update
- držet pouze UI state, například otevřený modal, selected tab nebo selected district
- obsahovat compatibility bridge pro starší flow, pokud je zdokumentovaný

Přijatelný legacy bridge má být malý, izolovaný a popsaný tak, aby bylo jasné, proč ještě existuje.

## 4. Co legacy runtime nesmí

Do `page-assets/js/app/runtime.js` ani do legacy UI souborů se nemá přidávat:

- nová ekonomická pravidla
- nové police/heat výpočty
- nová produkční pravidla budov
- nové combat výpočty
- nová market matching logika
- nová pravidla frakcí
- nová pravidla aliancí
- nové server mode rules
- mutace autoritativního gameplay stavu
- nové `localStorage` gameplay persistence bez jasného důvodu

Pokud změna rozhoduje o výsledku gameplay, nepatří do legacy runtime. Patří do core, configu nebo serveru.

## 5. Kam patří nové věci

| Změna | Zdroj pravdy | UI / render |
| --- | --- | --- |
| Nová budova | Definice a balancing: `packages/game-config`; pravidla efektů: `packages/game-core` | `page-assets` nebo `apps/client` podle aktuálního entrypointu |
| Nová police akce | Pravidla: `packages/game-core/src/rules/police`; config: `packages/game-config` | Legacy UI nebo `apps/client` pouze jako render |
| Nová frakce | Typy: `packages/shared-types`; balancing/config: `packages/game-config`; efekty: `packages/game-core` | Faction page nebo client UI |
| Nový market systém | Matching a pravidla: `game-core` nebo server; config: `game-config` | Pouze render/orders view |
| Nový event | Definice/config: `game-config` nebo data registry podle typu eventu; gameplay dopad: `game-core` | Vizuální feed v UI render layer |
| Nový leaderboard | Výpočet a skóre: `game-core` nebo server | UI layer |
| Nové drby | Generování a pravdivost: `game-core` nebo server; textové šablony/config: `game-config` | Feed/panel v UI layer |

Obecně platí: pokud změna počítá výsledek, patří mimo legacy UI. Pokud změna pouze zobrazuje výsledek, patří do UI vrstvy.

## 6. Codex guardrails

- Před změnou gameplay logiky nejdřív určit, jestli jde o core, config, server, nebo UI.
- Pokud je změna gameplay pravidlo, neimplementovat ji do `runtime.js`.
- Pokud je změna pouze vizuální, nesahat do `game-core`.
- Pokud je změna pouze balancing, nesahat do `runtime.js`.
- Pokud je nutné upravit legacy runtime, změna má být co nejmenší a popsaná jako compatibility bridge.
- Nepřidávat nové přímé `localStorage` gameplay klíče bez dokumentace.
- Nepřidávat nové globální CSS bez zvážení blast radiusu.
- Po každé změně spustit dostupné lint/smoke testy.

## 7. Co nedělat

- Nepřidávat další velké bloky gameplay logiky do `runtime.js`.
- Nedělat velký rewrite `pages/game.html` bez smoke testů.
- Nemazat legacy compatibility bez testů.
- Nemazat assety bez asset manifestu.
- Nemigrovat vše najednou do `apps/client`.
- Neměnit hodnoty storage keys bez migračního plánu.
- Neměnit balancing zároveň s refaktorem.

## 8. Doporučený postup migrace

1. Dokumentovat hranice.
2. Udržet legacy frontend funkční.
3. Přidat smoke testy pro `login -> lobby -> faction -> game -> map click`.
4. Nové gameplay pravidlo vždy dávat do core/config.
5. Legacy runtime postupně zmenšovat jen render-only extrakcemi.
6. Teprve později přesouvat hlavní hráčský klient do `apps/client`.
7. Až bude nový klient stabilní, legacy přesunout do `legacy/static-pages`.

Migrace má probíhat po malých krocích. Každý krok musí zachovat aktuální hratelnost a mít jasné ověření.

## 9. Krátké shrnutí pro budoucí vývoj

Golden rule:

Runtime renders. Core decides. Config balances. Server owns authority.
