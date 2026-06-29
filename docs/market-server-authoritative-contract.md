# Market Server-Authoritative Contract

## MVP Scope

Market MVP podporuje:

- `buy-market-resource`
- `sell-market-resource`
- normal market buy za clean cash
- black market buy za clean nebo dirty cash
- normal market sell za clean cash

Player listings, order book, aukce, War tuning a grafy cen nejsou soucasti MVP.

## Commands

`buy-market-resource` payload:

```json
{
  "resourceId": "metalParts",
  "amount": 1,
  "marketType": "normal",
  "paymentType": "cleanCash"
}
```

`sell-market-resource` payload:

```json
{
  "resourceId": "metalParts",
  "amount": 1
}
```

Povolene `resourceId`: `metalParts`, `techCore`, `chemicals`, `biomass`.

Povolene `marketType`: `normal`, `black`.

Povolene `paymentType`: `cleanCash`, `dirtyCash`. Dirty cash je povoleny jen pro black market buy.

## Forbidden Client Fields

Client nesmi posilat cenu ani vysledek:

- `price`
- `unitPrice`
- `totalPrice`
- `reward`
- `nextState`
- `stock`
- `stockMutation`
- `balances`

Transport pro market commandy pouziva whitelist payloadu, takze tato pole request odmita.

## Server Flow

1. Client posle pouze intent.
2. Transport zvaliduje payload.
3. Core router preda command do `handleMarketCommand`.
4. Handler pouzije `buyResource` nebo `sellResource`.
5. Server market system spocita aktualni cenu, zkontroluje cash/resource/stock a provede mutaci.
6. Pri uspechu vznikne `market-transaction-resolved`.
7. Projection vrati novy `readModel.market`.
8. Client prekresli popup z response readModelu.

## ReadModel

`GameplaySliceView.market` vychazi z `getMarketViewModel` a obsahuje UI-safe data:

- resources
- normalMarket price/sellPrice/stock/canBuy/canSell
- blackMarket price/heatRisk/policeRisk/canBuyWithDirtyCash
- trend
- warnings
- recentTransactions
- activeMarketEvents

ReadModel je jen preview. Server pri submitu cenu a dostupnost znovu overi.

## Failure Contract

Kdyz command selze:

- authoritative state se nemeni
- reward se nepripise
- stock se nemeni
- success city feed event nevznikne
- response obsahuje `accepted: false` a chybu

