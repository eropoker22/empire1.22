# Market Server Readiness Notes

## Současná struktura marketu

Market/Bazar popup je otevřený z `pages/game.html` přes tlačítko `data-market-popup-open`.
Viditelné taby jsou:

- `market` - Normal Market
- `black-market` - Black Market
- `player-market` - Hráčský bazar

Hlavní frontend soubory:

- `page-assets/js/app/runtime/marketPopupRuntime.js` řídí otevření popupu, výběr tabu, render a submit akce.
- `page-assets/js/app/runtime/marketDataSource.js` drží lehkou hranici pro výběr zdroje dat.
- `page-assets/js/app/runtime/marketViewModel.js` skládá viewmodely pro dashboard, položky, trade stav a player listingy.
- `page-assets/js/app/runtime/marketPopupViewModel.js` skládá payloady pro katalog a hráčský bazar.
- `page-assets/js/app/runtime/marketActionOrchestrator.js` drží současné local/session callbacky pro fallback a player bazaar preview.
- `page-assets/js/app/ui/marketPanel.js` renderuje DOM pro dashboard, market řádky a hráčský bazar.
- `packages/game-config/src/legacy-page/economy-config.js` drží legacy tab config, itemy, ceny, násobiče a fallback katalog.
- `packages/game-core/src/rules/market/serverMarketSystem.ts` drží server-side market pravidla.

## Zachované speciální funkce

Boundary/readiness úprava neměnila gameplay chování. Zachované zůstává:

- výpočtová pravidla,
- dostupnost položek,
- item názvy a typy zboží,
- normal market stock,
- black market heat/risk chování,
- dirty cash pravidla,
- player bazaar local/session preview,
- storage keys a fallback session state,
- existující server-authoritative MVP commandy,
- existující local fallback pro Netlify/mobile preview,
- existující UI workflow a feedback.

Poznámka: navazující balancing sprint upravil jednotkové ceny a server base prices pro alpha test. Důvody a rizika jsou v `MARKET_BALANCE_NOTES.md`.

Post-balance audit navíc upravil pouze local/session `black-market.sellMultiplier` jako anti-arbitrage pojistku pro preview výkup. Server commandy ani server-authoritative black market chování se tím nemění.
UI tuto preview větev označuje jako nouzovou likvidaci horkého zboží, aby nízký payout nepůsobil jako rozbitá cena.

## Co jede ze server payloadu

Server-authoritative část už existuje pro normal/black market přes `GameplaySliceView.market`.

Server payload používá:

- `market.resources`
- `normalMarket.price`
- `normalMarket.sellPrice`
- `normalMarket.stock`
- `normalMarket.canBuy`
- `normalMarket.canSell`
- `blackMarket.price`
- `blackMarket.heatRisk`
- `blackMarket.policeRisk`
- `blackMarket.canBuyWithDirtyCash`
- `trend`
- `warnings`
- `activeMarketEvents`
- `recentTransactions`

Server submit akce:

- `buy-market-resource`
- `sell-market-resource`

Client posílá pouze intent. Cenu, reward ani stock mutaci nesmí posílat.

## Co jede z local fallbacku

Local fallback zůstává nutný pro preview a neautoritativní režimy.
Bere data z legacy market state:

- `items`
- `stock`
- `transactions`
- `playerListings`
- `nextRefreshAt`
- server-scoped local market state

Fallback drží širší katalog než server MVP, včetně legacy materiálů, drog a zbraní podle `MARKET_TAB_CONFIG`.

## Co je hráčský bazar

Hráčský bazar má dnes UI a local/session preview chování:

- formulář pro vystavení nabídky,
- seznam listingů,
- koupit listing,
- stáhnout vlastní listing,
- clean/dirty currency,
- dirty trade heat přes local fallback callback.

Core pravidla pro player-to-player listingy existují v `serverMarketSystem.ts`, ale nejsou vystavená přes gameplay command transport.

Technický dluh: Player bazaar currently uses local/session preview behavior and needs server-authoritative marketplace persistence later.

## Co bylo upraveno

Přidána byla lehká boundary vrstva `marketDataSource.js`.

Její účel:

- rozhodnout, jestli aktuální tab čerpá ze server read modelu,
- zachovat player bazaar jako preview/local fallback,
- zachovat normal/black local fallback, pokud server read model není dostupný,
- připravit jedno místo pro budoucí loading/error/unavailable stav,
- dát runtime diagnostický zdroj dat bez debug textu v běžném UI.

`marketPopupRuntime.js` teď používá tuto boundary vrstvu místo přímého lokálního rozhodování `serverMarket vs priceState`.

Navazující UI stavová matice je v `MARKET_UI_STATE_MATRIX.md`.

Aktuální boundary metadata:

- `source`
- `availability`
- `status`
- `reason`
- `warnings`
- `isPreview`
- `isAuthoritative`
- `isFallback`
- `emptyMessage`
- `unavailableMessage`

Tato metadata jsou pouze popisná. Nesmí měnit ceny, dostupnost položek, výsledky akcí ani storage.

Navazující balance/visual polish sprint doplnil do `marketViewModel.js` prezentační metadata pro položky:

- `tier`
- `rarity`
- `marketCategory`
- `riskLevel`
- `supplyLevel`
- `demandLevel`
- `priceBand`
- `recommendedMinPrice`
- `recommendedMaxPrice`
- `isBlackMarketOnly`
- `isPreviewOnly`
- `serverReadyNotes`

Renderer používá tato metadata pro badge a hráčský feedback. Server transport, storage keys ani runtime gameplay pravidla se tím nemění.

## Co nebylo záměrně měněno

Záměrně se neměnilo:

- cooldowny,
- item katalog,
- názvy tabů,
- renderovaný layout popupu,
- celkový popup workflow,
- storage keys,
- runtime gameplay pravidla,
- server command typy,
- DB persistence,
- War market,
- avatar shop,
- player bazaar produkční server flow.

## Budoucí server-authoritative napojení

Další krok by měl být doplnění autoritativních commandů pro hráčský bazar:

- `create-player-market-listing`
- `buy-player-market-listing`
- `cancel-player-market-listing`

Potom lze `player-market` tab přepnout ze `player-bazaar-preview` zdroje na `server` zdroj bez přepsání rendereru.

Server by měl být jediný zdroj pravdy pro:

- cenu,
- dostupnost,
- inventář,
- cash,
- stock,
- listing ownership,
- expiraci listingů,
- výsledky transakcí.

## Doporučený datový kontrakt pro market

```ts
interface MarketLoadResponse {
  source: "server" | "local-fallback" | "preview" | "unavailable";
  mode: "free" | "war";
  tabs: Array<{
    id: "market" | "black-market" | "player-market";
    label: string;
    status: "ready" | "loading" | "empty" | "error" | "unavailable";
  }>;
  officialMarket: {
    items: MarketItemSnapshot[];
  };
  blackMarket: {
    items: MarketItemSnapshot[];
  };
  playerBazaar: {
    listings: PlayerBazaarListing[];
    ownListingCount: number;
    listingLimit: number;
    status: "ready" | "loading" | "empty" | "error" | "unavailable";
  };
  playerResources: Record<string, number>;
  limits: Record<string, number>;
  warnings: string[];
}

interface MarketItemSnapshot {
  itemId: string;
  resourceId?: string;
  name: string;
  category: string;
  quantityOwned: number;
  buyPrice: number;
  sellPrice?: number;
  stock?: number;
  maxStock?: number;
  canBuy: boolean;
  canSell: boolean;
  trend: "down" | "stable" | "up" | "spike";
  warnings: string[];
}
```

## Doporučený datový kontrakt pro player bazaar

```ts
interface MarketSubmitRequest {
  actionId:
    | "buy-market-resource"
    | "sell-market-resource"
    | "create-player-market-listing"
    | "buy-player-market-listing"
    | "cancel-player-market-listing";
  marketType: "normal" | "black" | "player";
  itemId: string;
  quantity: number;
  price?: number;
  currency?: "cleanCash" | "dirtyCash";
  listingId?: string;
  clientRequestId: string;
}

interface MarketSubmitResponse {
  status: "accepted" | "rejected";
  result?: {
    actionId: string;
    message: string;
    heatAdded?: number;
    auditTriggered?: boolean;
  };
  updatedResources?: Record<string, number>;
  updatedInventory?: Record<string, number>;
  updatedMarketSnapshot?: MarketLoadResponse;
  message: string;
}

interface PlayerBazaarListing {
  listingId: string;
  sellerId: string;
  sellerName?: string;
  itemId: string;
  quantity: number;
  price: number;
  currency: "cleanCash" | "dirtyCash";
  expiresAt: string;
  status: "active" | "sold" | "cancelled" | "expired";
}
```

## Rizika před alpha testem

- Player bazaar UI může působit jako plný multiplayer trade, i když je zatím local/session preview.
- Server MVP podporuje méně položek než legacy fallback katalog.
- Dashboard transakce potřebují sjednotit server `recentTransactions` a legacy `transactions`.
- Server reject bezpečně chrání ceny a stock, ale UI by mělo později lépe validovat quantity podle server read modelu.
- `MarketReadModel` je zatím příliš volný typ a měl by dostat pevný shared kontrakt.

## Co musí být hotové před produkčním multiplayerem

- Autoritativní persistence player bazaar listingů.
- Server commandy pro create/buy/cancel listing.
- Idempotence přes `clientRequestId`.
- Audit log market transakcí.
- Server-side expirace listingů.
- Ochrana proti nákupu vlastních listingů.
- Ochrana proti forged seller/listing payloadům.
- Jasný shared `MarketReadModel` typ.
- Sjednocení UI dashboard transakcí pro server payload.
- Produkční storage/repository za gameplay session identitou.
