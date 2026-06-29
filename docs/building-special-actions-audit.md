# Building Special Actions Audit

Audit date: 2026-06-28.

Legend:

- Runtime handler: `legacy-runtime` means the current `game.html` runtime can execute the action safely.
- Server/game-config action: action exists in free-mode config/core contract, but legacy `game.html` may still not have the server-authoritative command wired.
- Coming soon: visible only as disabled in legacy UI until a safe handler exists.

| Budova | ActionId | Label | Je v kartě? | Je ve special action profiles? | Má runtime handler? | Má server/game-config action? | Má cooldown? | Má valid disabled condition? | Má street-news output? | Stav | Poznámka |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bytový blok | collect_population | Vybrat obyvatele | ano | ano | ano | ano | ne | ano | ano | implemented | Přesune uloženou populaci, bez fallbacku. |
| Škola | evening_course | Večerní kurz | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní kurz a clean cash se validují v runtime. |
| Restaurace | restaurant_collect_revenue | Vybrat tržby | ano | ano | ano | ne | default | ano | ano | implemented | Legacy cash/heat handler. |
| Restaurace | restaurant_cover_meetings | Krýt schůzky | ano | ano | ano | ne | default | ano | ano | implemented | Legacy duration/effect handler. |
| Restaurace | restaurant_local_network | Posílit lokální síť | ano | ano | ano | ne | default | ano | ano | implemented | Legacy influence/effect handler. |
| Klinika | stabilization_protocol | Stabilizační protokol | ano | ano | ano | ano | ano | ano | ano | implemented | Recovery pool není permanentně enabled, prázdný pool blokuje. |
| Herna | night_machines | Noční automaty | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní boost se nestackuje. |
| Herna | back_cashdesk | Zadní pokladna | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cash minimum se validuje. |
| Směnárna | good_rate | Výhodný kurz | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cash minimum se validuje. |
| Kasino | quiet_backroom | Tichá herna | ano | ano | ano | ano | ano | ano | ano | implemented | Praní dirty cash odpovídá legacy handleru. |
| Kasino | vip_night | VIP noc | ano | ano | ano | ano | ano | ano | ano | implemented | Aktivní boost se nestackuje. |
| Kasino | bribed_inspector | Podplacený inspektor | ano | ano | ano | ano | ano | ano | ano | implemented | Úspěch/selhání řeší runtime. |
| Pouliční dealeři | start_drug_sale | Spustit prodej | ano | ano | ano | ano | default | ano | ano | implemented | V legacy kartě spouští dostupný profil; serverový slot flow zůstává mimo sprint. |
| Pouliční dealeři | street_dealers_collect_hot_cash | Vybrat hot cash | ano | ano | ano | ne | default | ano | ano | implemented | Dříve nedostupný profil je nyní v UI. |
| Pouliční dealeři | street_dealers_move_stash | Přesunout stash | ano | ano | ano | ne | default | ano | ano | implemented | Dříve nedostupný profil je nyní v UI. |
| Pašovací tunel | open_channel | Otevřít kanál | ano | ano | ano | ano | ano | ano | ano | implemented | Dirty cost, aktivní kanál a cooldown se validují. |
| Burza | speculative_buy | Spekulativní nákup | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Legacy runtime nemá bezpečný stock handler, fallback zakázán. |
| Burza | market_pressure | Tržní tlak | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server-authoritative market action. |
| Burza | insider_window | Insider Window | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server-authoritative market action. |
| Centrální banka | liquidity_injection | Likviditní injekce | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Detail profile doplněn, runtime bez fallback odměny. |
| Centrální banka | frozen_accounts | Zmrazené účty | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server-authoritative finance action. |
| Centrální banka | currency_intervention | Kurzovní intervence | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server-authoritative finance action. |
| Magistrát | official_cover | Úřední krytí | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Legacy runtime neumí promised heat/police/rumor efekt. |
| Magistrát | city_contract | Městská zakázka | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server command. |
| Magistrát | emergency_decree | Nouzová vyhláška | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server command. |
| Lobby klub | backroom_pressure | Zákulisní tlak | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Legacy runtime neumí promised political modifiers. |
| Lobby klub | quiet_negotiation | Tiché vyjednávání | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server command. |
| Lobby klub | media_screen | Mediální clona | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server command. |
| Letiště | express_import | Expresní dovoz | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Legacy runtime neumí delayed import shipment. |
| Letiště | black_charter | Černý charter | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na Black Market server command. |
| Letiště | evacuation_corridor | Evakuační koridor | ano | ano | ne | ano | ano | ano | ne | disabled as coming soon | Čeká na server command. |
| Přístav | port_container_cut | Container Cut | ano | ano | ano | ano | ano | ano | ano | implemented | Generic dirty/material/influence/heat handler. |
| Parlament | parliament_policy_window | Policy Window | ano | ano | ano | ano | ano | ano | ano | implemented | Generic clean/influence/heat handler. |
| Strip club | strip_club_collect_cash | Vybrat cash | ano | ano | ano | ne | default | ano | ano | implemented | Legacy dirty/heat handler. |
| Strip club | vip_lounge | Hostit VIP klienty | ano | ano | ano | ano | default | ano | ano | implemented | Legacy duration/influence/heat handler. |
| Strip club | private_party | Získat kompromat | ano | ano | ano | ano | default | ano | ano | implemented | Legacy influence/heat handler. |
| Energetická stanice | backup_grid_switch | Stabilizovat síť | ano | ano | ano | ano | default | ano | ano | implemented | Legacy duration/heat handler. |
| Energetická stanice | power_station_feed_production | Napájet výrobu | ano | ano | ano | ne | default | ano | ano | implemented | Legacy clean boost handler. |
| Energetická stanice | power_station_reduce_outages | Snížit výpadky | ano | ano | ano | ne | default | ano | ano | implemented | Legacy heat reduction handler. |
| Recyklační centrum | extract_losses | Vytěžit ztráty | ano | ano | ano | ano | ano | ano | ano | implemented | Disabled jen při prázdném salvage poolu / chybějícím clean cash / cooldownu. |
| Lékárna | pharmacy_stim_pack | Vyrobit stim pack | ano | ano | ano | ne | default | ano | ano | implemented | Production/craft flow mimo sprint nezměněn. |
| Lékárna | pharmacy_black_market_medkit | Black market med kit | ano | ano | ano | ne | default | ano | ano | implemented | Legacy inventory/cash/heat handler. |
| Lékárna | pharmacy_medical_cover | Medical cover | ano | ano | ano | ne | default | ano | ano | implemented | Legacy heat/influence/effect handler. |
| Drug lab | drug_lab_overclock_batch | Overclock batch | ano | ano | ano | ne | default | ano | ano | implemented | Production/craft flow mimo sprint nezměněn. |
| Drug lab | drug_lab_clean_batch | Clean batch | ano | ano | ano | ne | default | ano | ano | implemented | Legacy drugs/cash/heat handler. |
| Drug lab | drug_lab_hidden_operation | Hidden operation | ano | ano | ano | ne | default | ano | ano | implemented | Legacy drugs/heat/influence/effect handler. |
| Továrna | factory_combat_module_run | Combat module run | ano | ano | ano | ne | default | ano | ano | implemented | Production flow mimo sprint nezměněn. |
| Továrna | factory_rapid_assembly | Rapid assembly | ano | ano | ano | ne | default | ano | ano | implemented | Legacy factory supplies/effect handler. |
| Továrna | factory_industrial_overdrive | Industrial overdrive | ano | ano | ano | ne | default | ano | ano | implemented | Legacy factory supplies/effect handler. |
| Zbrojovka | armory_attack_loadout | Attack loadout | ano | ano | ano | ne | default | ano | ano | implemented | Craft/attack flow mimo sprint nezměněn. |
| Zbrojovka | armory_defense_kit | Defense kit | ano | ano | ano | ne | default | ano | ano | implemented | Legacy weapons/influence/heat handler. |
| Zbrojovka | armory_fortify_district | Fortify district | ano | ano | ano | ne | default | ano | ano | implemented | Legacy weapons/heat/influence/effect handler. |

## Findings

- The old click path could dispatch `(rowView.index, rowView)` instead of `(shell, actionIndex)`. It is now removed for district detail actions.
- The old runtime fallback granted generic influence on unknown actions. It is now blocked.
- Recyklační centrum was permanently disabled because the view-model never checked salvage pool state. It now reads item losses from the existing recovery pool.
- Pouliční dealeři had three profiles and one UI action. UI now exposes all three legacy profiles.
- Burza, Centrální banka, Magistrát, Lobby klub and Letiště have game-config actions, but no safe legacy runtime handler. They are disabled as coming soon instead of executing fake fallback effects.
