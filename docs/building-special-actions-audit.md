# Building Special Actions Audit

Audit date: 2026-06-28.

Legend:

- Runtime handler: all currently visible card actions are implemented.
- Server/game-config action: action exists in free-mode config/core contract and is dispatched as `run-building-action` unless explicitly documented as removed from the detail card.
- Missing handler: not allowed in visible card UI. Rows without a safe handler are hidden from the card and must be fixed before being exposed.

| Budova | ActionId | Label | Je v kartě? | Je ve special action profiles? | Má runtime handler? | Má server/game-config action? | Má cooldown? | Má valid disabled condition? | Má street-news output? | Stav | Poznámka |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bytový blok | collect_population | Vybrat obyvatele | ano | ano | ano | ano | ne | ano | ano | implemented | Přesune uloženou populaci, bez fallbacku. |
| Škola | evening_course | Večerní kurz | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní kurz a clean cash se validují v runtime. |
| Restaurace | restaurant_collect_revenue | Vybrat tržby | ano | ano | ano | ano | ano | ano | ano | implemented | Server grant: +180 clean cash, +90 dirty cash, heat +1, cooldown 30 minut. |
| Restaurace | restaurant_cover_meetings | Krýt schůzky | ano | ano | ano | ano | ano | ano | ano | implemented | Server timed income boost, vliv +2, heat +1, cooldown 30 minut. |
| Restaurace | restaurant_local_network | Posílit lokální síť | ano | ano | ano | ano | ano | ano | ano | implemented | Server timed influence boost, vliv +4, heat +2, cooldown 30 minut. |
| Klinika | stabilization_protocol | Stabilizační protokol | ano | ano | ano | ano | ano | ano | ano | implemented | Recovery pool není permanentně enabled, prázdný pool blokuje. |
| Herna | night_machines | Noční automaty | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní boost se nestackuje. |
| Herna | back_cashdesk | Zadní pokladna | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cash minimum se validuje. |
| Směnárna | good_rate | Výhodný kurz | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cash minimum se validuje. |
| Kasino | quiet_backroom | Tichá herna | ano | ano | ano | ano | ano | ano | ano | implemented | Praní dirty cash odpovídá legacy handleru. |
| Kasino | vip_night | VIP noc | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní boost se nestackuje. |
| Kasino | bribed_inspector | Podplacený inspektor | ano | ano | ano | ano | ano | ano | ano | implemented | Úspěch/selhání řeší runtime. |
| Pouliční dealeři | start_drug_sale | Spustit prodej | ano | ano | ano | ano | default | ano | ano | implemented | Serverový dealer slot flow; karta už neslibuje fixed local reward. |
| Pouliční dealeři | street_dealers_collect_hot_cash | Vybrat hot cash | ano | ano | ano | ano | default | ano | ano | implemented | Server grant: +280 dirty cash, heat +3, cooldown 10 minut. |
| Pouliční dealeři | street_dealers_move_stash | Přesunout stash | ano | ano | ano | ano | default | ano | ano | implemented | Server validuje 3 biomass, grantuje +1000 dirty cash, heat +1, cooldown 10 minut. |
| Pašovací tunel | open_channel | Otevřít kanál | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cost, aktivní kanál a cooldown se validují. |
| Burza | speculative_buy | Spekulativní nákup | ano | ano | ano | ano | ano | ano | ano | implemented | Server stock exchange handler. |
| Burza | market_pressure | Tržní tlak | ano | ano | ano | ano | ano | ano | ano | implemented | Server stock exchange handler. |
| Burza | insider_window | Insider Window | ano | ano | ano | ano | ano | ano | ano | implemented | Server stock exchange handler. |
| Centrální banka | liquidity_injection | Likviditní injekce | ano | ano | ano | ano | ano | ano | ano | implemented | Server central bank handler. |
| Centrální banka | frozen_accounts | Zmrazené účty | ano | ano | ano | ano | ano | ano | ano | implemented | Server central bank handler. |
| Centrální banka | currency_intervention | Kurzovní intervence | ano | ano | ano | ano | ano | ano | ano | implemented | Server central bank handler. |
| Magistrát | official_cover | Úřední krytí | ano | ano | ano | ano | ano | ano | ano | implemented | Server city hall handler. |
| Magistrát | city_contract | Městská zakázka | ano | ano | ano | ano | ano | ano | ano | implemented | Server city hall handler. |
| Magistrát | emergency_decree | Nouzová vyhláška | ano | ano | ano | ano | ano | ano | ano | implemented | Server city hall handler. |
| Lobby klub | backroom_pressure | Zákulisní tlak | ano | ano | ano | ano | ano | ano | ano | implemented | Server lobby club handler. |
| Lobby klub | quiet_negotiation | Tiché vyjednávání | ano | ano | ano | ano | ano | ano | ano | implemented | Server lobby club handler. |
| Lobby klub | media_screen | Mediální clona | ano | ano | ano | ano | ano | ano | ano | implemented | Server lobby club handler. |
| Letiště | express_import | Expresní dovoz | ano | ano | ano | ano | ano | ano | ano | implemented | Server airport handler. |
| Letiště | black_charter | Černý charter | ano | ano | ano | ano | ano | ano | ano | implemented | Server airport handler. |
| Letiště | evacuation_corridor | Evakuační koridor | ano | ano | ano | ano | ano | ano | ano | implemented | Server airport handler. |
| Přístav | port_container_cut | Container Cut | ano | ano | ano | ano | ano | ano | ano | implemented | Generic dirty/material/influence/heat handler. |
| Parlament | parliament_policy_window | Policy Window | ano | ano | ano | ano | ano | ano | ano | implemented | Generic clean/influence/heat handler. |
| Strip club | strip_club_collect_cash | Vybrat cash | ano | ano | ano | ano | default | ano | ano | implemented | Server grant: +360 dirty cash, heat +3, cooldown 10 minut. |
| Strip club | vip_lounge | Hostit VIP klienty | ano | ano | ano | ano | default | ano | ano | implemented | Server duration boost, clean cost, cooldown a rumor chance. |
| Strip club | private_party | Získat kompro | ano | ano | ano | ano | default | ano | ano | implemented | Server private_party: vliv, influence boost, heat a scandal risk. |
| Energetická stanice | backup_grid_switch | Stabilizovat síť | ano | ano | ano | ano | default | ano | ano | implemented | Server infrastructure/defense/production boost. |
| Energetická stanice | power_station_feed_production | Napájet výrobu | ano | ano | ano | ano | default | ano | ano | implemented | Server timed clean-income boost, heat +2, cooldown 60 minut. |
| Energetická stanice | power_station_reduce_heat | Snížit heat | ano | ano | ano | ano | default | ano | ano | implemented | Serverově sníží heat o 2 a spustí cooldown 60 minut. |
| Recyklační centrum | extract_losses | Vytěžit ztráty | ano | ano | ano | ano | ano | ano | ano | implemented | Disabled jen při prázdném salvage poolu / chybějícím clean cash / cooldownu. |
| Lékárna | n/a | n/a | ne | ne | n/a | n/a | n/a | n/a | n/a | removed from detail card | Lékárna používá samostatný pharmacy/production flow, ne special action rows. |
| Drug lab / Lab | n/a | n/a | ne | ne | n/a | n/a | n/a | n/a | n/a | removed from detail card | Drug lab používá samostatný drug production flow, ne special action rows. |
| Továrna | n/a | n/a | ne | ne | n/a | n/a | n/a | n/a | n/a | removed from detail card | Továrna používá samostatný production flow, ne special action rows. |
| Zbrojovka | n/a | n/a | ne | ne | n/a | n/a | n/a | n/a | n/a | removed from detail card | Zbrojovka používá samostatný craft/combat flow, ne special action rows. |

## Findings

- The old click path could dispatch `(rowView.index, rowView)` instead of `(shell, actionIndex)`. It is now removed for district detail actions.
- The old runtime fallback granted generic influence on unknown actions. It is now blocked.
- Recyklační centrum was permanently disabled because the view-model never checked salvage pool state. It now reads item losses from the existing recovery pool.
- Pouliční dealeři had three profiles and one UI action. UI now exposes all three as server-backed actions.
- Továrna, Drug lab/Lab, Zbrojovka and Lékárna no longer expose detail-card special rows; their separate production/craft/pharmacy flows remain separate.
- Burza, Centrální banka, Magistrát, Lobby klub and Letiště are now server-backed through `run-building-action`.
- Restaurace detail actions are now server-backed through `run-building-action`; no visible card action uses a missing-handler placeholder.
