import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "armory",
  identityPrefix: "LiveArmory",
  label: "Armory",
  recipeId: "baseball-bat",
  resourceKey: "baseball-bat",
  spawnDistrictIds: [
    "district:6",
    "district:38",
    "district:41",
    "district:50",
    "district:59",
    "district:64",
    "district:68",
    "district:70",
    "district:75",
    "district:77",
    "district:84",
    "district:109"
  ],
  surfaceName: "armory"
});
