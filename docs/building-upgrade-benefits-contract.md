# Building Upgrade Benefits Contract

## Scope

This contract covers the district building upgrade confirmation modal in `game.html`.
It does not change upgrade balance or command authority. Runtime renders the modal, while existing runtime/core/config values remain the source for costs and effects.

## Building Type Label

The modal headline uses the building type label from `mechanicsType`, not the instance/display name.

Example:

| Instance name | Building type | Modal headline |
| --- | --- | --- |
| Urban Soldiers Hub | Rekrutační centrum | `Rekrutační centrum · L1 → L2` |
| Savage Kitchen | Restaurace | `Restaurace · L1 → L2` |

If a `mechanicsType` label is missing, the modal falls back to a safe generic `Budova` label instead of presenting the instance name as the primary type.

## Benefit Calculation

`page-assets/js/app/runtime/buildingUpgradeBenefits.js` compares:

- current building mechanics,
- preview mechanics for `nextLevel`,
- existing config-derived values already exposed by the building detail runtime.

The resolver only displays values that actually change. It does not invent balance values.

Main compared fields:

- clean cash per hour,
- dirty cash per hour,
- influence per day,
- heat per day,
- population/student rate and capacity,
- laundering capacity and fee,
- casino action heat reduction,
- warehouse capacity,
- smuggling dirty flow, batch capacity and dealer supply,
- level multiplier when that is the only available level-driven value.

## Fallback

If no concrete before/after change can be resolved, the modal shows:

`Levelový bonus: Zatím není definovaný`

This is intentional and prevents fake numbers in alpha UI.

## Coverage Table

| Building type | Upgrade available? | Benefit source | Example L1 → L2 benefits | Fallback/TODO |
| --- | --- | --- | --- | --- |
| Restaurace | Yes | runtime mechanics income/level multiplier | Clean cash, Dirty cash, Level bonus | No |
| Večerka | Yes | runtime mechanics income/level multiplier | Clean cash, Dirty cash, Level bonus | No |
| Herna | Yes | runtime mechanics income/laundering when changed | Clean cash, Dirty cash, Level bonus | Maybe if network-only values do not change |
| Kasino | Yes | casino upgrade config via mechanics | Clean cash, Dirty cash, Kapacita praní, Poplatek praní | No |
| Směnárna | Yes | runtime mechanics income/laundering when changed | Clean cash, Kapacita praní, Level bonus | Maybe if network-only values do not change |
| Obchodní centrum | Yes | runtime mechanics income/level multiplier | Clean cash, Dirty cash, Level bonus | Market discount is network-based, not level-based |
| Autosalon | Yes | runtime mechanics income/level multiplier | Clean cash, Dirty cash, Level bonus | Cooldown/support is owned-count based |
| Fitness Club | Yes | runtime mechanics income/level multiplier | Clean cash, Level bonus | Attack/defense support is owned-count based |
| Bytový blok | No in current UI | mechanics fields if supplied | Populace/min, Kapacita obyvatel | Not upgradeable in current detail UI |
| Rekrutační centrum | Yes | runtime mechanics income/level multiplier | Clean cash, Level bonus | Recruitment support is server/config owned-count based |
| Škola | No in current UI | mechanics fields if supplied | Studenti/min, Kapacita studentů, Talent chance | Not upgradeable in current detail UI |
| Klinika | Yes | runtime mechanics income/level multiplier | Clean cash, Level bonus | Recovery rate is owned-count based |
| Garáž | No in current UI | none | none | Not upgradeable in current detail UI |
| Sklad | Yes | runtime mechanics if values change | Clean cash, Heat, Sklad capacity | May fallback when level does not affect storage |
| Energetická stanice | Yes | runtime mechanics income/level multiplier | Clean cash, Dirty cash, Level bonus | No |
| Recyklační centrum | Yes | runtime mechanics income/level multiplier | Clean cash, Level bonus | Salvage is action/pool based |
| Pašovací tunel | Yes | smuggling mechanics when changed | Dirty flow, Kapacita dávky, Level bonus | May fallback if config has zero level batch capacity |
| Pouliční dealeři | Yes | runtime mechanics income/level multiplier | Dirty cash, Level bonus | Dealer sale tuning is action/config based |
| Strip club | Yes | runtime mechanics income/level multiplier | Dirty cash, Vliv, Level bonus | No |
| Downtown/special buildings | Yes if runtime exposes nextLevel | runtime mechanics | Income/heat/influence/level bonus | Fallback if no concrete value changes |
| Lékárna, Lab, Továrna, Zbrojovka | Separate production modal flow | production/factory viewmodels | Production speed/multiplier | Existing shared modal remains compatible |

## Adding A New Benefit

Add a before/after comparison in `buildingUpgradeBenefits.js` using data already present in the mechanics viewmodel or config-derived runtime values. Do not add UI-only fake constants.
