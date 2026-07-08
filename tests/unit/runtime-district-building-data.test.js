import { describe, expect, it } from "vitest";
import {
  DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2
} from "../../page-assets/js/app/runtime/districtBuildingData.js";
import {
  DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2 as CLIENT_DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2 as CLIENT_DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2 as CLIENT_DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2
} from "../../client/page-assets/js/app/runtime/districtBuildingData.js";

describe("district building data", () => {
  it("keeps clinic economy values aligned in runtime and client copies", () => {
    for (const rules of [
      {
        income: DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
        heat: DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
        influence: DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2
      },
      {
        income: CLIENT_DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
        heat: CLIENT_DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
        influence: CLIENT_DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2
      }
    ]) {
      expect(Math.round(Number(rules.income.Klinika.clean || 0) * 60)).toBe(3100);
      expect(Number(rules.income.Klinika.dirty || 0)).toBe(0);
      expect(Math.round(Number(rules.heat.Klinika.heat || 0) * 60 * 24)).toBe(85);
      expect(Number(rules.influence.Klinika.influence || 0)).toBe(0);
    }
  });
});
