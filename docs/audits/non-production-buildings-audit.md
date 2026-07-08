# Non-production building audit

Date: 2026-07-07

Scope: all current public building cards except `pharmacy` / Lekarna, `drug_lab` / Lab, `factory` / Tovarna and `armory` / Zbrojovka. No balance or gameplay numbers were changed in this audit.

Sources:
- `packages/game-config/src/public/building-definitions.ts`
- `packages/game-config/src/public/day-night-config.ts`
- `page-assets/js/app/runtime/buildingDetailViewModel.js`
- existing upgrade notes in `docs/building-upgrades-server-authoritative-audit.md`

## Cross-cutting findings

- Most non-production buildings are passive/support buildings with `maxLevel: 1`; the player needs the card to say clearly whether this is passive value or a runnable action.
- Current DEN/NOC behavior has two layers: global legal/illegal multipliers plus per-building passive rules. This is good, but future card tuning must keep the displayed "Efekt" tied to effective numbers, not static flavor text.
- Downtown actions are powerful and long-cooldown. They are good strategic midgame tools, but too many of them would be noisy in the first session if shown without clear cost/effect previews.
- Special action cooldowns are mostly 10-35 minutes, while power-station support is 60 minutes. That is acceptable for strategy, but each action needs visible countdown and exact reward/risk preview.
- `lobby_club`, `airport` and `apartment_block` have no per-building passive DEN/NOC rule today. They still receive global phase behavior if classified by the core rules, but their card should not claim a specific building phase bonus unless a real modifier is added.
- UI update in this pass: generic building detail cards now get stable hooks like `building-detail--restaurant` and `building-detail-card--restaurant`, so spacing and typography can be adjusted per building later without changing gameplay.

## Building Matrix

| Building | Zone | Upgrade/current level shape | Base passive | DEN/NOC | Special actions and cooldowns | Audit notes |
|---|---|---:|---|---|---|---|
| `central_bank` Centrální banka | downtown | max 1 | 9,600 clean/h, heat 144/day, influence 504/day | Day preferred. Day clean +15%, heat -5%; night heat +8%. | Likviditní injekce 20m, Zmrazené účty 24m/8m, Kurzovní intervence 28m/8m | Strong finance lever. Needs exact effective cost/heat/reward display before tester balance changes. |
| `city_hall` Magistrát | downtown | max 1 | 7,800 clean/h, heat 172.8/day, influence 1,224/day | Day preferred. Day influence +20%, heat -8%; night influence -10%. | Úřední krytí 20m/8m, Městská zakázka 18m, Nouzová vyhláška 28m/6m | Important heat-control/policy building. Emergency mode text must stay concrete. |
| `lobby_club` Lobby Club | downtown | max 1 | 5,700 clean/h, heat 144/day, influence 936/day | No specific per-building passive rule currently. | Zákulisní tlak 20m/8m, Tiché vyjednávání 24m, Mediální clona 26m/8m | Strong influence support, but phase UI should be neutral until a real rule exists. |
| `stock_exchange` Burza | downtown | max 1 | 13,200 clean/h, heat 259.2/day, influence 648/day | Day preferred. Day clean +8%, heat -5%; night clean +4%, heat +8%. | Spekulativní nákup 16m, Tržní tlak 22m/10m, Insider Window 18m/6m | High economy leverage and volatility. Needs exact preview to avoid "magic market" feeling. |
| `court` Soud | downtown | max 1 | 6,300 clean/h, heat 115.2/day, influence 1,036.8/day | Day preferred. Day influence +12%, heat -10%; night influence -8%. | none | Pure passive legal protection. Card should not look like a required clickable action. |
| `vip_lounge` VIP Salonek | downtown | max 1 | 6,300 clean/h, 1,800 dirty/h, heat 187.2/day, influence 691.2/day | Night preferred. Night influence +10%, rumor +25%, truth -5%; day fewer but truer rumors. | none | Good intel/influence passive. Needs clear rumor value wording. |
| `airport` Letiště | downtown | max 1 | 10,800 clean/h, 2,700 dirty/h, heat 288/day, influence 288/day | No passive rule. `black_charter` is night-only. | Expresní dovoz 18m/90s, Černý charter 24m/8m, Evakuační koridor 26m/7m | Action set is useful, but import payload and night-only charter need exact UI preview. |
| `port` Přístav | downtown | config max 5 | 1,560 clean/h, 510 dirty/h, heat 5/day, influence 26/day | Night preferred. Night dirty +15%, clean +5%; day heat -5%. | Container Cut default 90s unless overridden, +160 dirty, +3 metal parts, +6 heat | Current base heat is much lower than most downtown buildings. Good candidate for later review. |
| `parliament` Parlament | downtown | config max 5 | 1,320 clean/h, 180 dirty/h, heat 3/day, influence 40/day | Day preferred. Day influence +25%, clean +10%; night influence -10%. | Policy Window day-only, default 90s, +160 clean, +5 influence, +5 heat | Base values look low for "nejvyšší politická páka"; likely needs design pass. |
| `shopping_mall` Obchodní centrum | commercial | max 1 | 5,700 clean/h, 1,320 dirty/h, heat 129.6/day, influence 345.6/day | Day preferred. Day clean +20%, influence +8%; night clean -10%. | none | Strong passive economy/support; should read as passive, not an action. |
| `restaurant` Restaurace | commercial | max 1 | 2,280 clean/h, heat 57.6/day, influence 172.8/day | Day preferred. Day clean +15%, rumors less frequent/truer; night clean -5%, more street rumors. | public config none; runtime has restaurant support profile text/mechanics | Good first passive building. Needs careful card text because runtime mechanics may imply more than public config. |
| `arcade` Herna | commercial | max 1 | 2,520 clean/h, 4,320 dirty/h, heat 172.8/day, influence 259.2/day | Night preferred. Night dirty +20%, clean +5%; day dirty -10%. | Noční automaty night-only 16m/7m, Zadní pokladna 12m | Good night tutorial candidate, but night-only action must be visibly blocked in day. |
| `casino` Kasino | commercial | max 4 | 8,400 clean/h, 15,600 dirty/h, heat 648/day, influence 1,008/day | Night preferred. Night dirty +25%, influence +10%; day dirty -12%, heat +12%. | Tichá herna 14m, VIP noc night-only 26m/10m, Podplacený inspektor 32m/12m | Very high numbers and high risk. This should be audited first when tuning economy. |
| `car_dealer` Autosalon | commercial | max 1 | 4,080 clean/h, 1,080 dirty/h, heat 115.2/day | Day clean +10%, night dirty +5%. | none | Passive mobility/logistics value may be too invisible unless card shows the exact support effect. |
| `fitness_club` Fitness Club | commercial | max 1 | 4,320 clean/h, heat 57.6/day | Day preferred. Day clean +10%. | none | Combat support needs explicit numbers or it feels cosmetic. |
| `exchange` Směnárna | commercial | max 1 | 4,200 clean/h, 5,700 dirty/h, heat 230.4/day, influence 403.2/day | Night preferred. Night dirty +20%, clean +8%; day heat +12%. | Výhodný kurz 11m | Clean laundering bridge. Make audit/heat visible so it does not feel like free money. |
| `apartment_block` Bytový blok | residential | max 1 | no cash/heat; local population/gang member source | No specific per-building phase rule currently. | Vybrat obyvatele config min 1s, UI collect threshold applies elsewhere | Core population loop is important; card should show current stored people and collect threshold. |
| `recruitment_center` Rekrutační centrum | residential | max 1 | 2,100 clean/h, heat 100.8/day | Day preferred. Day clean +10%. | none | Support/combat multiplier needs real displayed values before tuning. |
| `garage` Garáž | residential | max 1 | 2,520 clean/h, heat 86.4/day | No specific per-building rule currently. | none | Cooldown/mobility support is valuable but easy to miss. Candidate for clear "Pasivní bonus" copy. |
| `clinic` Klinika | residential | max 1 | 3,300 clean/h, heat 43.2/day | Day preferred. Day clean +5%, heat -5%; night clean -5%. | Stabilizační protokol 18m | Recovery value depends on visible pool. Needs exact returned-loss preview. |
| `school` Škola | residential | max 1 | 1,080 clean/h, heat 0, influence 72/day, student/population support | Day preferred. Day clean +5%, population +20%; night clean -10%, population -10%. | Vybrat studenty config min 1s, Večerní kurz 35m/20m | Population production should show day/night effective rate directly. |
| `warehouse` Skladiště | industrial | max 4 | 2,700 clean/h, heat 86.4/day | Day preferred. Day clean +5%. | none | Storage/logistics support should be exact; otherwise it looks like dead weight. |
| `power_station` Energetická stanice | industrial | max 1 | 3,000 clean/h, heat 115.2/day | Day preferred. Day clean +15%, heat -5%; night heat +8%. | Záložní síť 60m/25m, Napájet výrobu 60m/25m, Snížit heat 60m | Long cooldown support building. Needs active effect countdown and clear target scope. |
| `recycling_center` Recyklační centrum | industrial | max 1 | 2,400 clean/h, heat 115.2/day | Day heat -5%, night clean +10%. | Vytěžit ztráty 16m | Salvage is useful after combat; empty-pool disabled reason must stay visible. |
| `smuggling_tunnel` Pašovací tunel | park | max 1 | 3,240 dirty/h, heat 100.8/day | Night preferred. Night dirty +25%; day heat +12%. | Otevřít kanál 30m/15m | Dirty economy support. Needs clear connection to dealer sale support. |
| `convenience_store` Večerka | park | max 1 | 1,920 clean/h, 1,080 dirty/h, heat 72/day, influence 144/day | Day clean +12% and truer rumors; night dirty +15% and more rumors. | none | Good mixed passive. Exact phase effect row matters here. |
| `strip_club` Strip Club | park | max 1 | 4,500 clean/h, 3,900 dirty/h, heat 259.2/day, influence 547.2/day | Night preferred. Night dirty +25%, influence +20%, rumors +25%; day fewer but truer rumors. | Vybrat cash 10m, Hostit VIP klienty 60m/30m, Šeptanda 14m, Získat kompro 30m/10m | High-value social/dirty node. Needs exact rumor/influence/heat previews. |
| `street_dealers` Pouliční dealeři | park | max 1 | 2,160 dirty/h, heat 86.4/day | Night preferred. Night dirty +25%; day dirty -10%, heat +15%. | Spustit prodej default 90s, Vybrat hot cash 10m, Přesunout stash 10m | Critical dirty sale loop. Needs exact selected-drug output and heat preview. |

## Follow-up order suggestion

1. Kasino, Směnárna, Herna: dirty cash and laundering can distort economy fastest.
2. Pouliční dealeři, Pašovací tunel, Strip Club, Večerka: night economy and rumor loop.
3. Magistrát, Soud, Parlament, Lobby Club, Centrální banka, Burza: political/finance/heat control clarity.
4. Bytový blok, Škola, Klinika, Rekrutační centrum: population and recovery readability.
5. Warehouse, Power Station, Recycling Center, Port, Airport, Autosalon, Fitness: support/logistics clarity.

## What was intentionally not changed

- No gameplay balance.
- No new actions.
- No new buildings.
- No production/craft building changes for Lekarna, Lab, Tovarna or Zbrojovka.
- No server/session/authority changes.
