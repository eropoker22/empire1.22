import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "factory",
  identityPrefix: "LiveFactory",
  label: "Factory",
  recipeId: "metal-parts",
  resourceKey: "metal-parts",
  spawnDistrictIds: [
    // Every claimed starter district receives the canonical production set.
    // Prefer an enabled non-industrial spawn; industrial districts cannot be
    // selected as player spawns even when their native set has a Factory.
    "district:26",
    "district:3",
    "district:25",
    "district:50",
    "district:68",
    "district:73",
    "district:94",
    "district:114",
    "district:134",
    "district:139",
    "district:144",
    "district:149",
    "district:161"
  ],
  surfaceName: "factory"
});
