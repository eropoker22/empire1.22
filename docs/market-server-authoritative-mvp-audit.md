# Market Server-Authoritative MVP Audit

## Scope

MVP resi pouze server-authoritative obchod se zakladnimi resources:

- normal market buy
- black market buy
- normal market sell
- serverovy vypocet ceny
- serverova validace cash/resources/stock
- serverova mutace authoritative state
- readModel.market pro UI

Mimo MVP zustava player-to-player market, order book, aukce, grafy cen, burzovni building action handlery a War tuning.

| Oblast | Aktualni stav | Alpha riziko | MVP reseni | Soubor |
| --- | --- | --- | --- | --- |
| Legacy market UI | Popup pocital cenu z browser session state a menil local inventory/cash. | Client mohl byt zdroj pravdy pro cenu i vysledek. | V server-authoritative rezimu popup pouziva `readModel.market` a posila jen command intent. | `page-assets/js/app/runtime/marketPopupRuntime.js`, `page-assets/js/app/runtime.js` |
| Market state | Legacy cena/stock byly ulozene v preview session/local storage. | Refresh/local edit mohl menit stock a transakce bez serveru. | Server market state zije v authoritative core state pod `state.market`; local fallback zustava jen mimo server runtime. | `packages/game-core/src/rules/market/serverMarketSystem.ts` |
| Core market funkce | Existovaly `initializeServerMarket`, `calculateMarketPrice`, `buyResource`, `sellResource`, `getMarketViewModel`. | Funkce nebyly napojene na gameplay command flow. | Novy handler vola existujici core market API. | `packages/game-core/src/handlers/marketCommands.ts` |
| Command typy | Shared command union nemel market buy/sell commandy. | Transport neumel odlisit validni intent od client-forged vysledku. | Pridany `buy-market-resource` a `sell-market-resource`. | `packages/shared-types/src/commands/market-command.ts` |
| Transport validace | Payload validator market commandy neznal. | Client mohl poslat libovolna pole, pokud by command prosla do runtime. | Whitelist payloadu, pozitivni integer amount, zname resourceId, zakaz client price/reward pres unknown field reject. | `apps/server/src/transport/gameplay-command-payload-validation.ts` |
| Dispatcher | Core router podporoval jen existujici district/building/action commandy. | Market command skoncil jako unsupported. | Router dispatchuje buy/sell do `handleMarketCommand`. | `packages/game-core/src/engine/commandRouter.ts` |
| ReadModel | Gameplay slice nemel `market` sekci. | UI nemelo serverovou cenu/stock. | `readModel.market = getMarketViewModel(...)`. | `apps/server/src/runtime/projections/gameplay-slice-projection-service.ts` |
| UI bridge | Market popup nepouzival `/api/gameplay-slice/submit`. | Buy/sell byly legacy-local mutace. | Server runtime path sklada command bez ceny a refreshuje z response readModelu. | `page-assets/js/app/runtime.js` |
| Street news/city feed | Feed mel sourceType `market`, ale market commandy negenerovaly core event. | Uspesna transakce nebyla dohledatelna ve feedu. | Uspesny command emituje `market-transaction-resolved` a city feed ho mapuje na market event. | `packages/game-core/src/rules/events/cityFeedEventGenerator.ts` |
| Exploit testy | Existovaly testy market rules, ne command/transport hranice. | Price injection, invalid amount nebo unknown resource nemusely byt pokryte. | Pridane server validation a core handler testy. | `tests/server/gameplay-market-command-payload-validation.test.ts`, `tests/unit/game-core/market-command-handler.test.ts` |

