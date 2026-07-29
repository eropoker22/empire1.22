import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "pharmacy",
  identityPrefix: "LivePharmacy",
  label: "Pharmacy",
  spawnDistrictIds: [
    "district:21",
    "district:26",
    "district:42",
    "district:51",
    "district:93",
    "district:95",
    "district:113",
    "district:120",
    "district:136",
    "district:138",
    "district:140"
  ],
  surfaceName: "pharmacy"
});
