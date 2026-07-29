import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "armory",
  identityPrefix: "LiveArmory",
  label: "Armory",
  spawnDistrictIds: [
    "district:23",
    "district:68",
    "district:73",
    "district:89",
    "district:94",
    "district:134",
    "district:139",
    "district:153",
    "district:155",
    "district:161"
  ],
  surfaceName: "armory"
});
