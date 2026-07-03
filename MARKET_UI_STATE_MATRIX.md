# Market UI State Matrix

Scope: current Empire Streets Market/Bazar UI. This document describes behavior and UI states. The later balance sprint changes prices, but does not change tab flow, storage, commands, item names, special market functions, or action rules.

## Source Model

`page-assets/js/app/runtime/marketDataSource.js` exposes these sources:

| Source | Meaning | Player-facing use |
| --- | --- | --- |
| `server` | `GameplaySliceView.market` is available for official/black market. | Normal/black market uses authoritative read model and submits server intents. |
| `local-fallback` | Legacy/session market state is available. | Preview/fallback market remains playable with current local behavior. |
| `player-bazaar-preview` | Player bazaar uses current local/session preview behavior. | Player can use existing preview listing flow; not production-authoritative. |
| `unavailable` | No renderable market payload is available. | UI should show a short player text, not debug details. |

Internal metadata:

- `availability`: `ready`, `empty`, `unavailable`, future `loading`/`error`
- `isAuthoritative`
- `isFallback`
- `isPreview`
- `reason`
- `warnings`

These metadata are for UI routing and future server integration. They must not change price math or action results.

## Balance/Atmosphere Overlay

Market rows now also receive display metadata from `marketViewModel.js`:

| Metadata | UI use | Server-ready use |
| --- | --- | --- |
| `tier` | Badge like `T1` to `T5`. | Future price band and rarity grouping. |
| `rarity` | Rare/contraband visual tone. | Future scarcity and drop-rate rules. |
| `marketCategory` | Internal row dataset and future grouping. | Shared item taxonomy. |
| `riskLevel` | Risk badge and black-market mood. | Future heat/police premium. |
| `supplyLevel` | Supply/shortage badge. | Future stock pressure. |
| `demandLevel` | Demand/hot goods badge. | Future rolling demand factor. |
| `priceBand` | Price vibe only. | Future floor/ceiling rules. |
| `recommendedMinPrice` / `recommendedMaxPrice` | Not shown as debug text. | Documentation for player bazaar price guardrails. |

These fields are descriptive. They do not submit prices, mutate inventory, change stock, or authorize actions.

## Normal Market

| State | Source | What player sees | Action state | Notes |
| --- | --- | --- | --- | --- |
| Server data available | `server` | `Neon Market`, server-priced resource rows, stock, trend, buy/sell buttons. | Buy/sell allowed only when server read model marks item available; submit uses `buy-market-resource` or `sell-market-resource`. | Authoritative MVP for supported resources. |
| Local fallback data available | `local-fallback` | Same tab and legacy catalog from local/session state. | Existing local buy/sell callbacks mutate local economy/inventory/stock exactly as before. | Needed for Netlify/mobile preview. |
| Loading | future metadata | `Sháním poslední ceny z ulice.` | No new gameplay action should be enabled by loading alone. | Documented for future server bridge; not a current gameplay state. |
| Empty | `server` or `local-fallback` with no rows | `Sklad je prázdný. Nejdřív získej zásoby.` | No item rows, no action buttons. | Empty means no renderable rows, not a balance change. |
| Unavailable | `unavailable` | `Kontakt mlčí. Zkus to později.` | No item rows, no action buttons. | Avoids debug text like missing payload. |
| Error | future metadata | `Obchod neprošel. Zkus to znovu.` | Keep existing state; do not mutate inventory. | Future endpoint error state. |
| Disabled action | server/local row state | Button disabled and title explains the reason. | No submit when disabled. | Server still revalidates on submit. |
| Insufficient money | local trade state or server rejection | Existing local text like `Chybí ...`; server fallback text from response if available. | Action blocked locally or rejected by server. | Do not change cash rules. |
| Insufficient goods | local trade state or server rejection | `Nemáš dost kusů ve skladu.` or server validation message. | Sell disabled/rejected. | Do not change inventory rules. |
| Successful action | `server` or `local-fallback` | Current success feedback: bought/sold item. | State refreshes from server or local commit. | Existing behavior preserved. |
| Rejected action | `server` | Response error text, fallback `Obchod neprošel. Zkus menší množství nebo později.` | No local reward/stock mutation from rejected server action. | Server is source of truth. |
| Unknown/missing payload | `unavailable` | `Kontakt mlčí. Zkus to později.` | No action rows. | Debug reason remains internal as `market_payload_missing`. |

## Black Market

| State | Source | What player sees | Action state | Notes |
| --- | --- | --- | --- | --- |
| Server data available | `server` | `Blackline Market`, black-market prices, heat risk, dirty/clean buy options where available. | Buy submits `buy-market-resource` with `marketType: black`; sell is disabled. | Current MVP does not support black-market sell. |
| Local fallback data available | `local-fallback` | Legacy black market catalog with current local/session pricing and heat feedback. | Existing local callbacks stay active. | Preserves preview behavior for drugs/weapons fallback catalog. |
| Loading | future metadata | `Sháním poslední ceny z ulice.` | No new action from loading state. | For future server bridge. |
| Empty | any source with no rows | `Černý trh dnes drží nízký profil.` | No action rows. | Player-facing empty state, not a debug error. |
| Unavailable | `unavailable` | `Kontakt mlčí. Zkus to později.` | No action rows. | No backend/debug wording in UI. |
| Disabled buy | server/local row state | `Tenhle obchod teď nejde uzavřít.` or existing local insufficient money/stock text. | Buy blocked/rejected. | Price and availability unchanged. |
| Disabled sell | server row state | `Černý trh dnes výkup nedělá.` | Sell disabled. | Describes current MVP limitation without exposing `MVP` text. |
| Sell warning | `local-fallback` | Row shows `nouzový výkup`, badge `nouzový výkup`, and sell action label `Likvidovat`. | Sell remains available if player has inventory. | This is emergency disposal, not fair trade. |
| Low payout sell | `local-fallback` | Trade total shows `likvidace ... · tvrdá ztráta`; tooltip says contact takes it for a bad price. | Sell pays local black-market `sellMultiplier` only. | Anti-arbitrage guard for craft/player-bazaar preview loops. |
| Successful low payout sell | `local-fallback` | `Kontakt převzal ... Podsvětí kupuje levně.` | Local inventory/economy mutate as before. | Player-facing feedback must not look like a bug. |
| Insufficient dirty cash | local/server validation | Existing money warning or server validation message. | Buy disabled/rejected. | Dirty cash multiplier unchanged. |
| Successful action | `server` or `local-fallback` | Current black market success feedback, including heat risk where applicable. | State refreshes or local commit applies. | Existing heat behavior preserved. |
| Rejected action | `server` | Server error text or fallback rejected text. | No reward mutation. | Transport rejects forged price/reward fields. |
| Unknown/missing payload | `unavailable` | `Kontakt mlčí. Zkus to později.` | No action rows. | Internal reason only. |

## Player Bazaar

| State | Source | What player sees | Action state | Notes |
| --- | --- | --- | --- | --- |
| Preview available | `player-bazaar-preview` | `Podzemní burza`, sell form, current local/session listings. | Existing create/cancel/buy preview callbacks remain active. | This is not production-authoritative. |
| Local listings empty | `player-bazaar-preview` | `Hráčský bazar čeká na první obchodníky.` | Sell form remains available if player has sellable inventory. | Empty is normal, not an error. |
| No sellable inventory | `player-bazaar-preview` | Select shows `Nemáš nic k prodeji`; sell button disabled. | No listing created. | Tooltip: `Sklad je prázdný. Nejdřív získej zásoby.` |
| Own listing limit reached | `player-bazaar-preview` | Existing count and disabled sell action. | Create listing blocked. | Existing limit unchanged. |
| Insufficient money for listing buy | `player-bazaar-preview` | Existing listing title `Chybí ...`. | Buy button disabled. | No economy mutation. |
| Successful create listing | `player-bazaar-preview` | Existing feedback `Vystaveno ...`. | Local inventory decremented and local listing created. | Current preview behavior preserved. |
| Successful cancel listing | `player-bazaar-preview` | Existing feedback that listing returned to storage. | Local inventory restored. | Current preview behavior preserved. |
| Successful buy listing | `player-bazaar-preview` | Existing clean/dirty purchase feedback. | Local economy/inventory/listings mutate. | Dirty preview trade can add heat. |
| Server-authoritative future | future `server` | Same renderer should accept server listings later. | Future commands should create/buy/cancel through server. | Requires persistence and command transport. |
| Unavailable future | `unavailable` | `Tahle část ekonomiky se otevře v alpha provozu.` | No listing actions. | Do not show backend/debug wording. |
| Error future | future metadata | `Obchod neprošel. Zkus to znovu.` | Keep previous local/server snapshot. | Future endpoint error state. |

## Disabled Action Texts

Current player-facing disabled/rejected text should stay short:

- Not enough money: `Chybí ...` or `Na tenhle obchod nemáš dost peněz.`
- Not enough goods: `Nemáš dost kusů ve skladu.`
- Official/black market unavailable: `Kontakt mlčí. Zkus to později.`
- Black market sell disabled: `Černý trh dnes výkup nedělá.`
- Black market low payout sell: `Kontakt to vezme z ruky, ale za směšnou cenu.`
- Player bazaar empty: `Hráčský bazar čeká na první obchodníky.`
- No sellable inventory: `Sklad je prázdný. Nejdřív získej zásoby.`

## Technical Debt

- Player bazaar currently uses local/session preview behavior and needs server-authoritative marketplace persistence later.
- Server MVP supports fewer resource ids than the legacy fallback catalog.
- `MarketReadModel` is still loosely typed.
- Dashboard transaction normalization should be unified for server `recentTransactions` and legacy `transactions`.
- Future loading/error states are documented and metadata-ready, but not backed by a dedicated endpoint state machine yet.

## Preservation Rules

Do not change these in state cleanup work:

- item names,
- item availability,
- tab ids or labels,
- storage keys,
- local/session preview mutations,
- server command types,
- market special functions,
- black market heat/risk math.

Price/balancing changes must stay in market/economy config or documented balance metadata, not in renderer/runtime action rules.
