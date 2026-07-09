# Alliance, Bounty, Market Audit - 2026-07-09

## Stav

Aliance, bounty a market nejsou jen lokalni UI vrstvy. Vsechny tri oblasti uz maji serverovy vstup pres gameplay submit, serverovy read-model ve slice a core pravidla. Nejvetsi rozdil je market: normalni a cerny trh jsou napojene jako serverove buy/sell akce, ale hracsky bazar je zatim jen preview v runtime UI. Core pravidla pro vytvoreni, nakup a zruseni hracske nabidky existuji a maji testy, transport commandy pro ne ale jeste nejsou vystavene.

## Opraveno ted

- Prepsal jsem zbyvajici core a transport chyby pro aliance, bounty a market do cestiny.
- Sjednotil jsem fallback hlasky handleru tak, aby se hraci v domene neukazovalo anglicke `Player was not found`, `Vote was not found`, `Command payload field...` a podobne.
- Doplneny `MarketReadModel` typ o `inflation`, `playerMarket` a `priceHistory`, aby sdileny kontrakt odpovidal tomu, co server realne posila v gameplay slice.
- Overeno kodem, ze `gameplay-slice-projection-service` posila `allianceBoard`, `bounty` i `market` ze serveroveho runtime stavu.
- Overeno kodem, ze player bazar zustava oznaceny jako preview/fallback, dokud nema server command flow. To je spravne a bezpecne pro domenu.

## Aliance

Serverova cast pokryva zalozeni, join, invite, odpoved na invite, chat, public kontakt, ready potvrzeni, inactive kick vote, hlasovani, leave a disband. UI runtime uz nepouziva produkcni dev demo mimo localhost/onboarding a odesila prikazy pres `submitServerAllianceCommand`.

Zustava:

- Pred domenou udelat manualni smoke se skutecnou session: zalozit alianci, pozvat hrace, prijmout pozvanku, poslat zpravu, potvrdit READY, spustit vote, opustit/rozpustit alianci.
- Zmensit a rozdelit velke alliance soubory pozdeji. Ted je dulezitejsi stabilita toku.

## Bounty

Bounty ma serverovy create/cancel, escrow clean cash, expiraci s refundem, claim resolution a read-model. Validace brani self-targetu, prilis nizke odmene, spatne delce a cizimu target districtu.

Zustava:

- `recentBountyEvents` v read-modelu je zatim prazdne pole. Core udalosti existuji, ale feed neni do bounty read-modelu propisovany.
- Pred domenou udelat manualni smoke: zalozeni bounty, cancel/refund, expirace a claim po splneni cile.

## Market

Serverovy market umi normalni trh, cerny trh, inflaci, stock, cenovou historii, transakce a building bonusy. Runtime pouziva serverovy read-model pro normalni/cerny market. Transport povoluje jen `buy-market-resource` a `sell-market-resource`, takze klient nemuze posilat cenu, stock ani fee.

Zustava:

- Hracsky bazar ma core pravidla, ale chybi server commandy a transport payload validace pro create/buy/cancel listing.
- Runtime hracsky bazar je zatim preview/fallback. Na domene to nema byt vydavano jako plne autoritativni obchodovani.
- `getMarketViewModel` pouziva `Date.now()` pro expiraci player listings. Pri plnem server napojeni hracskeho bazaru bude lepsi predat cas z runtime clock/contextu kvuli determinismu.

## Dalsi krok

1. Napojit slaby boost mechaniku az po jasnem rozhodnuti, kde ma byt zdroj pravdy: core config, server handler a read-model.
2. Pro market pridat server commandy pro hracsky bazar: create listing, buy listing, cancel listing.
3. Dopsat bounty event feed do read-modelu, aby hrac videl posledni udalosti bez hledani v global feedu.
4. Spustit prod-like smoke pro domenu: login/join/load/submit/refresh/logout a potom manualne projit aliance, bounty, market.
