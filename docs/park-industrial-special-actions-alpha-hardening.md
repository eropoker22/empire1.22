# Park + Industrial Special Actions Alpha Hardening

Scope: only special action rows in Park and Industrial building detail cards. Passive income, production/craft/drug/pharmacy flows, market, bounty, alliances and War mode are out of scope.

Final alpha rule: every clickable Park/Industrial special action in a building detail card is server-backed through `run-building-action`. Buildings whose design uses a separate production/craft flow do not show special action rows in the card.

| Zone | Building | Action | Previous state | Server action id / legacy id | Alpha decision | Reason | Risk after hardening | Test coverage |
|---|---|---|---|---|---|---|---|---|
| Park | Pašovací tunel | Otevřít kanál | Server-backed | `open_channel` | server-backed | Core owns cost, active state, heat, duration and cooldown. | Low | Registry unit + integration building-action flow |
| Park | Večerka | none | Passive | none | passive | No clickable special action. | Low | Passive flow tests |
| Park | Pouliční dealeři | Spustit prodej | Server-backed with stale UI copy | `start_drug_sale` | server-backed | Runs through server dealer slot flow. UI no longer promises fixed local `+1000 dirty cash`. | Medium: needs proper input UI for dealer slot selection later | Registry unit + integration dealer sale flow |
| Park | Pouliční dealeři | Vybrat hot cash | Legacy/local reward | `street_dealers_collect_hot_cash` | server-backed | Server now grants `+280 dirty-cash`, heat and cooldown from config. | Low | Registry unit + integration building-action flow |
| Park | Pouliční dealeři | Přesunout stash | Legacy/local reward | `street_dealers_move_stash` | server-backed | Server now validates `3 biomass`, grants `+1000 dirty-cash`, heat and cooldown from config. | Low | Registry unit + integration building-action flow |
| Park | Strip club | Vybrat cash | Legacy/local reward | `strip_club_collect_cash` | server-backed | Server now grants `+360 dirty-cash`, heat and cooldown from config. | Low | Registry unit + integration building-action flow |
| Park | Strip club | Hostit VIP klienty | Server-backed | `vip_lounge` | server-backed | Core owns clean cost, income/influence/heat boost, duration and cooldown. | Low | Registry unit + integration building-action flow |
| Park | Strip club | Získat kompro | Server-backed, copy needed alignment | `private_party` | server-backed | Label is kept, confirm data matches server config: clean cost, influence, influence boost, heat and scandal risk. | Low | Registry unit + integration building-action flow |
| Park | Drug lab / Lab | none in detail card | Legacy/local rows existed | removed from detail UI | separate production flow | Drug production belongs to the production/drug flow, not card-local rewards. | Low for card exploit, production UX remains separate | Registry unit + view-model unit |
| Industrial | Sklad | none | Passive | none | passive | No clickable special action. | Low | Warehouse integration tests |
| Industrial | Recyklační centrum | Vytěžit ztráty | Server-backed | `extract_losses` | server-backed | Core validates clean cash and salvage pool before mutation. | Low | Registry unit + integration building-action flow |
| Industrial | Energetická stanice | Stabilizovat síť | Server-backed | `backup_grid_switch` | server-backed | Core owns cost, heat, infrastructure/defense/production boost, duration and cooldown. | Low | Registry unit + integration building-action flow |
| Industrial | Energetická stanice | Napájet výrobu | Legacy/local boost | `power_station_feed_production` | server-backed | Server now creates a timed clean-income effect, heat and cooldown from config. | Low | Registry unit + integration building-action flow |
| Industrial | Energetická stanice | Snížit heat | Legacy/local heat reduction | `power_station_reduce_heat` | server-backed | Server now applies real negative heat and cooldown from config. | Low | Registry unit + integration building-action flow |
| Industrial | Továrna | none in detail card | Legacy/local rows existed | removed from detail UI | separate production flow | Factory output belongs to the production flow, not card-local rewards. | Low for card exploit, production UX remains separate | Registry unit + view-model unit |
| Industrial | Zbrojovka | none in detail card | Legacy/local rows existed | removed from detail UI | separate craft flow | Armory output belongs to craft/combat flow, not card-local rewards. | Low for card exploit, craft UX remains separate | Registry unit + view-model unit |
| Commercial | Lékárna | none in detail card | Legacy/local rows existed | removed from detail UI | separate pharmacy production flow | Pharmacy output belongs to production/pharmacy flow, not card-local rewards. | Low for card exploit, production UX remains separate | Registry unit + view-model unit |
| Industrial | Datové centrum | none | No finished card profile | none | TODO/passive only | Not represented as a finished special action building without a handler. | Low while hidden/undefined | Next-zone readiness |

## Runtime contract

- `server-run-building-action` rows submit through `/api/gameplay-slice/submit` as `run-building-action`.
- Clickable Park/Industrial rows use `handlerId: "server-run-building-action"`.
- Production/craft/drug/pharmacy buildings have no detail-card special action rows; their separate flow remains available through its own UI.
- Server rows start cooldown and write street-news feedback only after an accepted server response.
- Rejected server responses and removed rows must not create success street news.
- Legacy/local reward actions in Park and Industrial are not alpha-clickable.

## Final notes

- `power_station_reduce_heat` required a core fix: negative `heatGain` must not be clamped to zero by faction heat modifiers.
- `start_drug_sale` remains server-backed, but the detail modal still uses safe default slot/product/amount until the later dealer input UI is built.
- Public production/craft action catalog entries may still exist for the separate production/craft flow. They are not rendered as building-detail special action rows.

## TODO after alpha hardening

- Build a proper server-backed input UI for `start_drug_sale` slot, drug and amount selection.
- Audit Drug lab, Továrna, Zbrojovka and Lékárna production/craft flows separately from building detail special actions.
- Add a finished Datové centrum server handler before exposing any clickable action row.
