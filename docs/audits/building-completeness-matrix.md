# Building Completeness Matrix

Audit date: 2026-05-04

Scope: this matrix checks canonical source/config paths before adding more mechanics. `client/` is treated as generated publish output, not canonical source.

Canonical sources checked:

- `packages/game-config/src/public/building-definitions.ts`
- `packages/game-config/src/base/base-fixed-buildings-config.ts`
- `packages/game-config/src/base/base-building-actions-config.ts`
- `packages/game-config/src/modes/free/free-mode.override.ts`
- `packages/game-core/src/handlers/*`
- `packages/game-core/src/rules/*`
- `packages/game-core/src/projections/*`
- `page-assets/js/app/runtime.js`
- `tests/**`

Status legend:

- `ready`: server-authoritative path exists, UI/read model exists, and targeted or slice coverage exists.
- `partial`: usable path exists, but coverage, projection, or handler wiring is incomplete.
- `config-only`: catalog/config exists and generic action execution should work, but there is no focused core behavior or test.
- `ui-only`: only legacy UI/runtime path exists.
- `missing`: absent from canonical catalog/free-mode gameplay path.

Important note: free-mode `fixedBuildings` is merged from base config. A building can be free-mode available through `baseFixedBuildingsConfig` even when it is not explicitly listed in `free-mode.override.ts`.

| Building | Public catalog | Free fixedBuildings | buildingActions config | Core special handler | UI panel or shortcut | Test | Gameplay slice usable | Status | Notes |
|---|---:|---:|---:|---|---|---|---|---|---|
| central_bank | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | config-only | No targeted behavior test. |
| city_hall | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | config-only | No targeted behavior test. |
| lobby_club | yes | yes, base | yes | generic + intel effect | generic detail/action | catalog wiring only | generic action | partial | `lobby_club_backroom_deal` has intel-style effect, but no focused test. |
| stock_exchange | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | config-only | No targeted behavior test. |
| court | yes | yes, base | yes | generic + defense effect | generic detail/action | targeted integration | yes | ready | `court_case_pressure` reinforces district defense. |
| vip_lounge | yes | yes, base | yes | generic + intel effect | generic detail/action | catalog wiring only | generic action | partial | Intel effect exists, but no focused test. |
| airport | yes | yes, base | yes | generic + intel effect | generic detail/action | catalog wiring only | generic action | partial | Intel effect exists, but no focused test. |
| port | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | config-only | No targeted behavior test. |
| parliament | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | config-only | No targeted behavior test. |
| shopping_mall | yes | yes, base | no, passive | shopping mall passive/market helpers | passive detail | market/unit coverage only | passive/market | partial | No direct building-action surface; market bonus path is separate. |
| restaurant | yes | yes, base + override | no, passive | `restaurantBuildingActions` | passive detail | targeted integration | yes | ready | Passive/read-model path is covered. |
| arcade | yes | yes, base + override | yes | `arcadeBuildingActions` | dedicated detail/actions | targeted integration | yes | ready | Laundering/audit consequences covered. |
| casino | yes | yes, base + override | yes | `casinoBuildingActions` | dedicated detail/actions | targeted integration | yes | ready | Laundering/audit consequences covered. |
| auto_salon | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | partial | Requested check: present in canonical catalog/config, but only generic server behavior is covered. |
| fitness_club | yes | yes, free override | no, passive | `fitnessClubBuildingActions` | passive detail | targeted integration | yes | ready | Clean income, heat, combat support and no-action behavior are covered. |
| exchange | yes | yes, base + override | yes | `exchangeOfficeBuildingActions` | dedicated detail/actions | targeted integration | yes | ready | Laundering/audit consequences covered. |
| apartment_block | yes | yes, base + override | yes | `apartmentBlockBuildingActions` | dedicated detail/action | targeted integration | yes | ready | Population collection path is server-side. |
| recruitment_center | yes | yes, base + override | no, passive | `recruitmentCenterBuildingActions` | passive detail | targeted integration | yes | ready | Passive combat support path is covered. |
| garage | yes | yes, base + override | no, passive | `garageBuildingActions` | passive detail | targeted integration | yes | ready | Cooldown-category support is server-side. |
| clinic | yes | yes, base + override | yes | `clinicBuildingActions` | dedicated detail/action | targeted integration | yes | ready | Stabilization protocol is server-side and tested. |
| school | yes | yes, base | yes | generic + defense effect | generic detail/action | catalog wiring only | generic action | partial | Requested check: defense effect exists, but no focused test. |
| factory | yes | yes, base | yes + production profile | production/craft handlers | dedicated production panel | targeted integration + slice | yes | ready | Requested check: collect/craft flow uses warehouse capacity. |
| armory | yes | yes, base | yes + craft profile | craft handler + defense effect | dedicated craft panel | targeted integration + slice | yes | ready | Requested check: crafting and fortify behavior covered. |
| warehouse | yes | yes, base + override | no, passive | `warehouseBuilding` | dedicated storage detail | targeted integration | yes | ready | No manual collect action; storage capacity is support behavior. |
| power_station | yes | yes, base + override | yes | `powerStationBuildingActions` | dedicated detail/action | targeted integration | yes | ready | Backup grid switch and production bonuses are server-side. |
| recycling_center | yes | yes, base + override | yes | `recyclingCenterBuildingActions` | dedicated detail/action | targeted integration | yes | ready | Salvage extraction is server-side and tested. |
| pharmacy | yes | yes, base | yes + production profile | production handlers | dedicated production panel | targeted integration + slice | yes | ready | Requested check: production/collect path is server-side. |
| drug_lab | yes | yes, base | yes + production profile | production handlers | dedicated production panel | targeted integration | yes | ready | Requested check: production path exists and is covered by production tests. |
| smuggling_tunnel | yes | yes, base | yes | generic + intel effect | generic detail/action | targeted integration | yes | ready | Requested check: action path and trace-reduction intel effect covered. |
| convenience_store | yes | yes, base + override | no, passive | `convenienceStoreBuildingActions` | passive detail | targeted integration | yes | ready | Passive rumor/street-info support is server-side. |
| strip_club | yes | yes, base + override | yes | `stripClubBuildingActions` | dedicated detail/action | targeted integration | yes | ready | Social/rumor actions are server-side. |
| street_dealers | yes | yes, base | yes | generic `useBuildingAction` | generic detail/action | catalog wiring only | generic action | partial | Requested check: present in config and legacy UI, but no focused server test. |

## Inconsistencies And Follow-Up Notes

- `taxi_service` has been removed from canonical game config, legacy runtime wiring, and admin demo page-assets.
- `school`, `auto_salon`, and `street_dealers` are present in canonical config and should work through the generic action handler, but they lack focused server tests.
- `drug_lab`, `pharmacy`, `factory`, and `armory` are the strongest production/crafting slice candidates. Their tests should stay coupled to warehouse capacity so collection does not silently bypass storage constraints.
- Passive buildings without `buildingActions` are not automatically incomplete. For `warehouse`, `restaurant`, `convenience_store`, `recruitment_center`, `garage`, and `shopping_mall`, the relevant completeness question is passive/support behavior, not action-button count.

## Safe Next PRs For Building Readiness

1. Add focused generic-action tests for `auto_salon`, `school`, and `street_dealers`.
2. Add a small projection test that every public building can render a district panel entry without relying on legacy runtime globals.
3. Keep production/crafting tests warehouse-aware when adding more free-session buildings.
