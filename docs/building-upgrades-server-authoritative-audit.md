# Building Upgrades Server-Authoritative Audit

## Contract

Upgrades are now handled by the server command `upgrade-building`.

Client payload:

```json
{
  "districtId": "district:12",
  "buildingId": "building:casino:12"
}
```

The client must not send `newLevel`, `price`, `upgradeCost`, `reward`, `effect`, `nextState`, `multiplier`, `income`, or production results. Transport validation rejects injected result fields before dispatch. The server resolves ownership, active district/building state, current level, max level, upgrade cost, resource availability, and then increments the building level.

Canonical server sources:

- Fixed building max level and income: `packages/game-config/src/modes/free/free-mode-fixed-buildings.ts`
- Casino upgrade cost/effects: `freeModeCasinoConfig.upgrades`
- Warehouse upgrade effects: `freeModeWarehouseConfig.upgrades`
- Production/craft upgrade cost/effects: `packages/game-config/src/modes/free/free-mode-craft-config.ts`
- Shared upgrade resolver: `packages/game-core/src/rules/buildings/buildingUpgradeRules.ts`
- Command handler: `packages/game-core/src/handlers/upgradeBuilding.ts`

## Effect Rules

| Scope | Source | Server effect |
| --- | --- | --- |
| Casino | `freeModeCasinoConfig.upgrades` | Existing casino level rules continue to affect laundering capacity, fee, action heat reduction, and income multiplier. |
| Warehouse | `freeModeWarehouseConfig.upgrades` | Existing warehouse level rules continue to affect storage, clean income multiplier, heat multiplier, and district support. |
| Port / Parliament | `fixedBuildings.maxLevel > 1` | Generic fixed-building level multiplier: +14% per level after L1 for clean income, dirty income, heat, and influence. |
| Pharmacy / Drug Lab / Factory / Armory | `craftBuildings/productionBuildings.upgrade` | Production amount and craft speed use `1 + ((level - 1) * 10%)`; costs use configured base/growth/rounding. |
| Other `maxLevel: 1` buildings | `fixedBuildings.maxLevel` | Not upgradeable in the server contract; UI must not show upgrade affordance. |

## Building Matrix

| Budova | buildingTypeId | Upgradable? | Max level | Upgrade cost source | Existing benefit source | UI slibuje | Server/core efekt dnes | Chybí server efekt? | Rozhodnutí | Test coverage |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| Bytový blok | `apartment_block` | Ne | 1 | N/A | passive population config | Bez upgrade | Population flow only | Ne | Not upgradeable | covered by no-upgrade server rejection |
| Rekrutační centrum | `recruitment_center` | Ne | 1 | N/A | recruitment config | Bez upgrade | Passive/support config only | Ne | Not upgradeable | config/max-level audit |
| Škola | `school` | Ne | 1 | N/A | school config/actions | Bez upgrade | Students/evening course server actions | Ne | Not upgradeable | config/max-level audit |
| Klinika | `clinic` | Ne | 1 | N/A | clinic/recovery config | Bez upgrade | Recovery/stabilization server action | Ne | Not upgradeable | config/max-level audit |
| Restaurace | `restaurant` | Ne | 1 | N/A | restaurant config/actions | Bez upgrade | Cash/influence + server actions | Ne | Not upgradeable | `restaurant maxLevel 1 cannot upgrade` |
| Večerka | `convenience_store` | Ne | 1 | N/A | convenience config | Bez upgrade | Passive income/rumor config | Ne | Not upgradeable | config/max-level audit |
| Herna | `arcade` | Ne | 1 | N/A | arcade config/action | Bez upgrade | Server-backed action and passive config | Ne | Not upgradeable | config/max-level audit |
| Kasino | `casino` | Ano | 4 | `freeModeCasinoConfig.upgrades` | casino upgrade table | Concrete upgrade benefits | Level feeds casino income/laundering/heat action rules | Ne | Server-backed upgrade | `building-upgrade-flow.test.ts` |
| Směnárna | `exchange` | Ne | 1 | N/A | exchange config/action | Bez upgrade | Server-backed action and passive config | Ne | Not upgradeable | config/max-level audit |
| Obchodní centrum | `shopping_mall` | Ne | 1 | N/A | shopping mall config | Bez upgrade | Market discount/support config | Ne | Not upgradeable | config/max-level audit |
| Autosalon | `car_dealer` | Ne | 1 | N/A | car dealer config | Bez upgrade | Mobility/support config | Ne | Not upgradeable | config/max-level audit |
| Fitness Club | `fitness_club` | Ne | 1 | N/A | fitness config | Bez upgrade | Combat support config | Ne | Not upgradeable | config/max-level audit |
| Sklad | `warehouse` | Ano | 4 | Generic fixed upgrade cost | `freeModeWarehouseConfig.upgrades` | Storage/capacity/income/heat | Warehouse level resolver uses config upgrades | Ne | Server-backed upgrade | command + warehouse config path |
| Energetická stanice | `power_station` | Ne | 1 | N/A | power station actions/config | Bez upgrade | Server-backed special actions | Ne | Not upgradeable | config/max-level audit |
| Recyklační centrum | `recycling_center` | Ne | 1 | N/A | recovery config/action | Bez upgrade | Extract losses server action | Ne | Not upgradeable | config/max-level audit |
| Datové centrum | `data_center` | Ne | N/A | N/A | Not in free fixed-building config | Bez upgrade | No authoritative building definition | Ne | Not upgradeable/TODO definition | documented TODO |
| Lékárna | `pharmacy` | Ano | 14 | production/craft upgrade config | legacy production cost + server config | +10% production/craft speed | Production amount/craft duration use level multiplier | Ne | Server-backed upgrade on concrete building | production/craft multiplier tests |
| Drug Lab / Lab | `drug_lab` | Ano | 14 | production/craft upgrade config | legacy production cost + server config | +10% production/craft speed | Production amount/craft duration use level multiplier | Ne | Server-backed upgrade on concrete building | production/craft multiplier tests |
| Továrna | `factory` | Ano | 14 | production/craft upgrade config, rounded to 100 | `FACTORY_CONFIG` legacy values | +10% production/craft speed | Production amount/craft duration use level multiplier | Ne | Server-backed upgrade on concrete building | production multiplier test |
| Zbrojovka | `armory` | Ano | 14 | craft upgrade config | legacy production cost + server config | +10% craft speed | Craft duration uses level multiplier | Ne | Server-backed upgrade on concrete building | craft duration test |
| Pašovací tunel | `smuggling_tunnel` | Ne | 1 | N/A | smuggling config/action | Bez upgrade | Server-backed action/passive config | Ne | Not upgradeable | config/max-level audit |
| Pouliční dealeři | `street_dealers` | Ne | 1 | N/A | street dealers config/actions | Bez upgrade | Server-backed actions/passive dirty flow | Ne | Not upgradeable | config/max-level audit |
| Strip Club | `strip_club` | Ne | 1 | N/A | strip club config/actions | Bez upgrade | Server-backed actions/passive income/influence/rumors | Ne | Not upgradeable | config/max-level audit |
| Burza | `stock_exchange` | Ne | 1 | N/A | stock exchange actions/config | Bez upgrade | Server-backed financial actions | Ne | Not upgradeable | config/max-level audit |
| Letiště | `airport` | Ne | 1 | N/A | airport actions/config | Bez upgrade | Server-backed logistics actions | Ne | Not upgradeable | config/max-level audit |
| Magistrát | `city_hall` | Ne | 1 | N/A | city hall actions/config | Bez upgrade | Server-backed city actions | Ne | Not upgradeable | config/max-level audit |
| Přístav | `port` | Ano | 5 | Generic fixed upgrade cost | fixed income config | +14% fixed stats per level | Fixed income projection/collection multiplier | Ne | Server-backed upgrade | generic multiplier test |
| VIP salonek | `vip_lounge` | Ne | 1 | N/A | VIP lounge config | Bez upgrade | Passive/metadata config | Ne | Not upgradeable | config/max-level audit |
| Centrální banka | `central_bank` | Ne | 1 | N/A | central bank actions/config | Bez upgrade | Server-backed finance actions | Ne | Not upgradeable | config/max-level audit |
| Lobby klub | `lobby_club` | Ne | 1 | N/A | lobby actions/config | Bez upgrade | Server-backed lobby actions | Ne | Not upgradeable | config/max-level audit |
| Soud | `court` | Ne | 1 | N/A | courthouse config | Bez upgrade | Legal/police support config | Ne | Not upgradeable | config/max-level audit |
| Parlament | `parliament` | Ano | 5 | Generic fixed upgrade cost | fixed income config | +14% fixed stats per level | Fixed income projection/collection multiplier | Ne | Server-backed upgrade | generic multiplier path |

## UI Notes

- Detail card upgrade dispatch now calls `/api/gameplay-slice/submit` with `upgrade-building` when the server runtime is ready.
- The detail card clamps upgrade visibility to server-authoritative max levels. A building with `maxLevel: 1` does not show an upgrade arrow just because legacy runtime used to allow local levels.
- Global production/factory popups do not perform local authoritative upgrades. They point the player to the concrete district building card, because the server command requires a real `buildingId`.
- The production upgrade copy now states the real per-level production/craft speed bonus instead of fallback text.

## Remaining TODO

- Add a server readModel upgrade preview object per building so the modal can use server-provided cost/effects directly instead of client-side preview plus server-side validation.
- If `data_center` becomes a real building, add it to fixed/build/craft config before showing upgrade UI.
