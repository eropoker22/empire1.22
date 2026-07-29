import { defineHostedProductionParityTest } from "./helpers/hostedProductionParity.js";

defineHostedProductionParityTest({
  buildingTypeId: "drug_lab",
  identityPrefix: "LiveDrugLab",
  label: "Drug Lab",
  spawnDistrictIds: [
    "district:66",
    "district:137",
    "district:156",
    "district:158"
  ],
  surfaceName: "drugLab"
});
