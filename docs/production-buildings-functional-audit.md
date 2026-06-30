# Production Buildings Functional Audit

Scope: Lékárna, Drug Lab/Lab, Továrna and Zbrojovka. These buildings must use the dedicated server production/craft flow, not building-detail special-action rows.

## Summary

| Budova | Building type id | Flow typ | Má special action rows? | Má je mít? | Vstupy | Výstupy | Storage/capacity | Processing time / cooldown | Upgrade efekt | Server/core handler | UI karta | Riziko exploitu | Stav |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lékárna | `pharmacy` | production + pharmacy craft | Ne v detail kartě | Ne | Passive none for `chemicals`; craft `stim-pack` costs `chemicals x6` | Passive `chemicals`; craft `stim-pack x1` | Building production store `Chemicals` cap 25; player storage capped by warehouse on collect | Passive per tick; `stim-pack` 4 min server processing | Server production level bonus is not defined; UI must use fallback, not fake speed | `collect-production`, `craft-item`, tick production | Detail card routes to production popup; special actions hidden | Legacy local production popup was able to mutate local state; now disabled in `game.html` runtime | OK with TODO for server upgrade benefit |
| Drug Lab / Lab | `drug_lab` | production + drug craft | Ne v detail kartě | Ne | `chemicals`, `biomass`, `stim-pack` by recipe | Passive `neon-dust`; craft `neon-dust`, `pulse-shot`, `velvet-smoke`, `ghost-serum`, `overdrive-x` | Building production store `Neon Dust` cap 18; player storage capped by warehouse on collect | 4/5/6/8/10 min server processing by recipe | Server production level bonus is not defined; UI must use fallback, not fake speed | `collect-production`, `craft-item`, tick production | Detail card routes to production popup; special actions hidden | Legacy local production popup was able to mutate local state; now disabled in `game.html` runtime | OK with TODO for server upgrade benefit |
| Továrna | `factory` | production + factory craft | Ne v detail kartě | Ne | Passive none for `metal-parts`; craft `tech-core` costs `metal-parts x4`; `combat-module` costs `metal-parts x4 + tech-core x2` | Passive `metal-parts`; craft `tech-core x1`, `combat-module x1` | Building production store `Metal Parts` cap 24; player storage capped by warehouse on collect | `tech-core` 6 min; `combat-module` 12 min; factory production can be boosted by Power Station infrastructure and Garage reduction for craft | Server production level bonus is not defined; UI must use fallback, not fake multiplier/speed | `collect-production`, `craft-item`, tick production | Detail card routes to factory/production panel; special actions hidden | Legacy local factory popup was able to mutate local state; now disabled in `game.html` runtime | OK with TODO for server upgrade benefit |
| Zbrojovka | `armory` | armory craft | Ne v detail kartě | Ne | `metal-parts`, `tech-core` by recipe | Attack/defense items: `baseball-bat`, `pistol`, `grenade`, `smg`, `bazooka`, `vest`, `barricades`, `cameras`, `defense-tower`, `alarm` | No passive building production store; outputs go to player resource state after processing | 3-16 min server processing by recipe; Power Station can speed armory production, Garage can reduce craft duration | Server production level bonus is not defined; UI must use fallback, not fake speed | `craft-item` and tick completion | Detail card routes to production popup; special actions hidden | Legacy local production popup was able to mutate local state; now disabled in `game.html` runtime | OK with TODO for server upgrade benefit |

## What Is Server-Authoritative

- `craft-item` only receives `districtId`, `buildingId` and `recipeId`; it does not accept client-provided output, price or duration.
- `validateCraft` rejects missing building, wrong district, non-owner, inactive building, unsupported craft profile, unknown recipe, active processing and missing inputs.
- `handleCraftItem` subtracts inputs on the server and writes `building.processing`.
- `completeCraftProcessing` credits output only when the authoritative tick reaches `completesAtTick`, then clears `building.processing`; repeated ticks do not double-credit.
- `collect-production` validates owner/building/district/ready amount and moves only server-stored building output into player resources, capped by warehouse storage.

## Detail Card Special Actions

The four production/craft buildings have no building-detail special action rows:

- `DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.lekarna = []`
- `DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["drug lab"] = []`
- `DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.lab = []`
- `DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.tovarna = []`
- `DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.zbrojovka = []`

The public legacy catalog still contains old `produce_*` action metadata for compatibility and docs/simulation surfaces. It must not be rendered as building-detail special-action UI for these buildings.

## Fixes Applied

- Removed fake production upgrade copy from production info text. The UI now says that the concrete server production level bonus is not defined.
- Disabled legacy local production/craft mutations in `game.html` runtime by passing `allowLegacyLocalProduction: false` and `allowLegacyProductionUpgrade: false` into the old production/factory popup runtimes.
- Added guard paths in `productionBuildingPopupRuntime.js` and `factoryPopupRuntime.js` so disabled legacy callbacks show a warning and do not mutate local inventory, jobs, factory supplies, cash or levels.
- Added integration coverage for missing craft inputs and double-credit prevention after craft processing completion.

## TODO

- Add a server command/read-model bridge for the legacy production popup shell, or replace the shell with the existing server-fed district slot production/craft controls.
- Define real server/config upgrade effects for production buildings if production levels should matter. Until then, upgrade UI must show the safe fallback instead of fake speed/multiplier claims.
- Remove or quarantine old public `produce_*` legacy action metadata once no simulation/client compatibility surface still needs it.
