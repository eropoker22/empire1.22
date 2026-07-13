# Production Buildings: Current Pre-Alpha Contract

Last reviewed: 2026-07-13.

This document describes the current one-unit production-line model. It replaces the historical passive production, generic craft, and building special-action descriptions.

## Authority and Compatibility

Canonical balance lives in typed config:

- `free-mode-pharmacy-config.ts`
- `free-mode-drug-lab-config.ts`
- `free-mode-factory-config.ts`
- `free-mode-armory-config.ts`

The static browser imports `gameplay-config.generated.js`, generated from those files by `scripts/generate-browser-gameplay-config.ts`. `legacy-page/economy-config.js` only re-exports generated production values and adds non-production demo catalog data. It is not a second balance source.

The current Netlify/static experience runs these lines as local-demo gameplay. Game-core already contains server-authoritative production handlers and projections, but the four static production modals are not being newly connected to a production multiplayer deployment in this cleanup.

## Shared Rules

- Every completion creates exactly one item.
- Each physical building keeps a separate line per recipe.
- `queuedAmount` includes the active item and all waiting items.
- Costs are reserved when items enter the queue.
- Cancel removes waiting items only and refunds their actual reservation.
- A full local output pauses the line without deleting queued items.
- Collect moves only the amount that fits in global storage and leaves the remainder in the building.
- Production building networks and levels affect speed only. They never increase output amount, local cap, queue cap, or global storage.
- Pharmacy, Drug Lab, Factory, and Armory have no production special actions in the building catalog.

## Pharmacy

| Recipe | Clean cash | Materials | Unit time | Local cap | Queue cap |
| --- | ---: | --- | ---: | ---: | ---: |
| Chemicals | 360 | none | 2 min | 12 | 8 |
| Biomass | 420 | none | 4 min | 8 | 6 |
| Stim Pack | 800 | none | 10 min | 4 | 3 |

There is no passive Chemicals/Biomass production and Stim Pack does not consume Chemicals.

## Drug Lab

| Recipe | Clean cash | Materials per item | Unit time | Local cap | Queue cap |
| --- | ---: | --- | ---: | ---: | ---: |
| Neon Dust | 500 | 2 Chemicals | 5 min | 10 | 8 |
| Pulse Shot | 800 | 2 Chemicals, 1 Biomass | 8 min | 6 | 5 |
| Velvet Smoke | 900 | 1 Chemicals, 2 Biomass | 15 min | 5 | 4 |
| Ghost Serum | 2500 | 2 Neon Dust, 1 Pulse Shot | 20 min | 2 | 2 |
| Overdrive X | 4500 | 1 Pulse Shot, 2 Velvet Smoke | 30 min | 1 | 1 |

Ghost Serum and Overdrive X are strategic manufacturing components for future recipes. They have no direct use command, cooldown, combat effect, or spy effect.

## Factory

| Recipe | Clean cash | Materials per item | Unit time | Local cap | Queue cap |
| --- | ---: | --- | ---: | ---: | ---: |
| Metal Parts | 300 | none | 4 min | 10 | 8 |
| Tech Core | 900 | 4 Metal Parts | 8 min | 5 | 4 |
| Combat Module | 2500 | 4 Metal Parts, 2 Tech Core | 15 min | 2 | 2 |

Combat Module is a strategic industrial component used by high-tier Armory recipes. Factory network and level modifiers affect only the duration of newly started units. There is no passive Metal Parts production or `produce_tech_core` building action.

## Armory

Armory recipes have zero clean-cash cost and reserve global stored materials.

| Category | Recipe | Materials per item | Unit time | Local cap | Queue cap |
| --- | --- | --- | ---: | ---: | ---: |
| Attack | Baseball Bat | 2 Metal Parts | 3 min | 8 | 6 |
| Attack | Pistol | 3 Metal Parts, 1 Tech Core | 5 min | 5 | 4 |
| Attack | Grenade | 2 Metal Parts, 1 Tech Core | 6 min | 4 | 4 |
| Attack | SMG | 2 Metal Parts, 1 Combat Module | 8 min | 3 | 3 |
| Attack | Bazooka | 3 Metal Parts, 2 Combat Modules | 14 min | 2 | 2 |
| Defense | Vest | 3 Metal Parts, 1 Tech Core | 5 min | 5 | 4 |
| Defense | Barricades | 4 Metal Parts | 5 min | 6 | 5 |
| Defense | Cameras | 2 Metal Parts, 2 Tech Cores | 6 min | 4 | 4 |
| Defense | Defense Tower | 3 Tech Cores, 2 Combat Modules | 15 min | 2 | 2 |
| Defense | Alarm | 2 Metal Parts, 1 Tech Core | 5 min | 4 | 4 |

Armory recipes do not define attack power, defense power, or population requirements. Combat balance comes from its own typed weapon/defense config.

## Removed Paths

- passive Pharmacy, Drug Lab, and Factory resource ticks
- production `produce_*` building actions
- `armory_fortify`
- generic production-building craft profiles
- multi-output Armory recipes
- Warehouse and Power Station output-cap expansion
- direct Ghost Serum and Overdrive X activation
- manually copied browser recipe balance

Legacy snapshot migration remains in game-core for already persisted processing jobs. It is one-way compatibility and does not define new recipe balance.
