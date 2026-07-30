import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "pharmacy",
  identityPrefix: "LivePharmacy",
  label: "Pharmacy",
  spawnDistrictIds: [
    "district:26",
    "district:36",
    "district:42",
    "district:46",
    "district:67",
    "district:78",
    "district:83",
    "district:87",
    "district:92",
    "district:98",
    "district:127"
  ],
  surfaceName: "pharmacy"
});
