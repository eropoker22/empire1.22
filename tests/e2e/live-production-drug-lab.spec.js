import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "drug_lab",
  identityPrefix: "LiveDrugLab",
  label: "Drug Lab",
  recipeId: "neon-dust",
  resourceKey: "neon-dust",
  spawnDistrictIds: [
    "district:56",
    "district:58",
    "district:63",
    "district:91",
    "district:100",
    "district:106",
    "district:125"
  ],
  surfaceName: "drugLab"
});
