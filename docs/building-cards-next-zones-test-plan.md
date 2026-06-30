# Building Cards Next Zones Test Plan

Scope: preparation for the next building-card passes after Residential. This document is not a balancing change. It lists the current card contract, expected real effects, special-action readiness, and tests needed before Industrial, Downtown, and Park cards are treated as alpha-ready.

## Shared Test Rules

- Every rendered special action needs a stable `actionId`.
- A card must not promise an action without either a runtime/server handler or a clear disabled `Připravujeme serverový handler` state.
- Buttons stay compact: label, optional cost, cooldown badge, disabled state. Detail belongs in confirmation modal.
- Cooldowns must come from action state/deadline, not a visual-only timer.
- Upgrade confirmation must use type label and concrete before/after benefit rows or safe fallback.
- Forbidden generic copy remains blocked: `silnější cashflow`, `lokální efekty`, `posílí svoje efekty podle typu budovy`.

## Industrial

| Budova | Co má karta ukazovat | Reálné efekty | Special actions | Readiness | Testy | Rizika |
| --- | --- | --- | --- | --- | --- | --- |
| Sklad | Kapacity zásob, usage, warnings, clean/heat income. | Storage capacity by resource, warehouse network income/storage/heat multipliers. | Žádné. | Passive, no special action rows. | Viewmodel no runtime error; capacity rows; upgrade benefit storage delta; no action rows. | Fake upgrade text, stale capacity labels, storage overflow copy. |
| Energetická stanice | Infrastruktura, clean/dirty/heat, tři akce s cooldownem. | Production/support multipliers and heat support from config/core. | `backup_grid_switch`, `power_station_feed_production`, `power_station_reduce_heat`. | Server-backed. | ActionId mapping, cooldown badge, confirm summaries, no missing handler. | Verify future copy stays aligned with core effects. |
| Recyklační centrum | Salvage pool stav, clean/heat, `Vytěžit ztráty`. | Extracts non-population item losses from salvage/recovery pool. | `extract_losses`. | Server-backed with pool disabled condition. | Empty pool disabled, fresh item pool enabled, success starts cooldown and street news. | Must never recover population/gang members; no permanent disabled bug. |
| Datové centrum | TODO karta zatím není v legacy detail profilech. | TODO source of truth needed before card work. | TODO. | Not card-ready. | Add profile existence test after data is added. | Do not fake a generic data-center card without config/source behavior. |
| Továrna | Production/craft role and stored outputs. | Metal parts, tech core, combat modules according to production/craft config. | None in building detail card. | Separate production flow, no special action rows. | Card must not render special-action buttons; production flow remains tested separately. | Do not reintroduce instant card rewards. |
| Zbrojovka | Weapon/defense crafting role. | Attack loadout, defense kit, fortify district outputs via craft/combat flow. | None in building detail card. | Separate craft/combat flow, no special action rows. | Card must not render special-action buttons; craft flow remains tested separately. | Do not reintroduce instant card rewards. |

## Downtown

| Budova | Co má karta ukazovat | Reálné efekty | Special actions | Readiness | Testy | Rizika |
| --- | --- | --- | --- | --- | --- | --- |
| Burza | Market control role, server-only actions disabled until handler ready. | Market category investment/pressure/insider effects only when server-authoritative handler is active. | `speculative_buy`, `market_pressure`, `insider_window`. | Coming soon disabled. | Registry says coming-soon; button disabled; no legacy fallback reward. | Highest exploit risk if fallback gives cash/influence. |
| Letiště | Logistics/import/mobility role. | Express import, black charter, evacuation effects when server-ready. | `express_import`, `black_charter`, `evacuation_corridor`. | Coming soon disabled for server-only profiles. | Disabled action rows; confirm modal can preview but not execute. | Import/black market offers need server authority. |
| Magistrát | Politics/heat control. | Official cover, city contract, emergency decree. | `official_cover`, `city_contract`, `emergency_decree`. | Coming soon disabled. | No fallback, costs shown, server handler required. | Heat/police-control effects must not be client-side truth. |
| Přístav | Container logistics. | Dirty cash, metal parts, influence, heat from current profile. | `port_container_cut`. | Legacy-ready. | Stable actionId and implemented status; cooldown/street news. | Material id normalization (`metal-parts` vs `metalParts`). |
| VIP salonek | Passive rumor/intel/influence role. | Passive intel/rumor truth if configured. | Žádné v current detail profile. | Passive-ready. | No action rows, no fake special action. | Do not invent VIP active action before config exists. |
| Centrální banka | Financial reserve/stability role. | Liquidity, account protection, currency intervention only server-side. | `liquidity_injection`, `frozen_accounts`, `currency_intervention`. | Coming soon disabled. | Registry disabled and no fallback. | Cash/fine/market-fee effects must be server-authoritative. |
| Lobby klub | Influence/lobbying support. | Political cooldown/risk/rumor effects only server-side. | `backroom_pressure`, `quiet_negotiation`, `media_screen`. | Coming soon disabled. | Disabled rows, no fallback reward. | Cross-action cooldown reduction can be exploited if client-owned. |
| Soud | Passive legal protection. | Raid/fine mitigation and influence if config supports it. | Žádné. | Passive-ready. | No action rows; upgrade fallback/concrete benefit test. | Avoid showing police immunity copy. |
| Parlament | Political power. | Clean/influence current profile output. | `parliament_policy_window`. | Legacy-ready for current generic output, needs server review. | Stable actionId, implemented status, cooldown/street news. | Political effects likely need server-owned long-term state later. |

## Park

| Budova | Co má karta ukazovat | Reálné efekty | Special actions | Readiness | Testy | Rizika |
| --- | --- | --- | --- | --- | --- | --- |
| Pašovací tunel | Dirty flow, dealer supply, channel status/cost/cooldown. | Dirty cash flow, dealer sale price/speed/reward support, heat/street risk. | `open_channel`. | Server-backed. | Dirty cash cost disabled, active channel disabled, cooldown countdown. | Dirty cost must not be bypassed; channel state must persist across render. |
| Pouliční dealeři | Distribution from lab products, all three action rows visible/aligned. | Start sale slot, hot cash collection, stash transfer. | `start_drug_sale`, `street_dealers_collect_hot_cash`, `street_dealers_move_stash`. | Server-backed. | Count UI actions equals profiles; no dead hidden action; stable actionId. | Later input UI should replace default slot/product/amount. |
| Strip club | Night cash, VIP clients, kompromat/influence, heat risk. | Dirty cash, income/influence boost, influence for heat. | `strip_club_collect_cash`, `vip_lounge`, `private_party`. | Server-backed; `private_party` maps to Kompro copy. | Stable actionId, confirm summaries with heat/influence/cooldown. | Duplicate action id labels (`vip_lounge` building vs action) need careful UI labeling. |

## Harness Added

- `tests/unit/helpers/building-card-test-helpers.js` centralizes forbidden generic copy checks and a base mechanics fixture.
- `tests/unit/building-cards-next-zones-readiness.test.js` now guards current Industrial/Downtown/Park mapping:
  - existing Industrial cards build without runtime errors,
  - Downtown server-only profiles remain disabled/coming soon,
  - Park actions/profiles stay aligned,
  - Datové centrum is explicitly tracked as a data gap instead of faked.

## Next Sprint Entry Criteria

1. Add or confirm a real source of truth for any building before changing its card copy.
2. Start with action/profile/handler mapping tests before visual edits.
3. Update upgrade benefit resolver only from real before/after mechanics.
4. Run targeted unit tests first; run E2E only when game flow or modal interaction changes.
