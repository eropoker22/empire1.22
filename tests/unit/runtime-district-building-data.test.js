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

  it("keeps casino economy values aligned in runtime and client copies", () => {
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
      expect(Math.round(Number(rules.income.Kasino.clean || 0) * 60)).toBe(4500);
      expect(Math.round(Number(rules.income.Kasino.dirty || 0) * 60)).toBe(2500);
      expect(Math.round(Number(rules.heat.Kasino.heat || 0) * 60 * 24)).toBe(150);
      expect(Math.round(Number(rules.influence.Kasino.influence || 0) * 60 * 24)).toBe(110);
    }
  });

  it("keeps commercial district fallback values aligned in runtime and client copies", () => {
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
      expect(Math.round(Number(rules.income.Autosalon.clean || 0) * 60)).toBe(2145);
      expect(Math.round(Number(rules.income.Autosalon.dirty || 0) * 60)).toBe(650);
      expect(Math.round(Number(rules.heat.Autosalon.heat || 0) * 60 * 24)).toBe(60);
      expect(Math.round(Number(rules.influence.Autosalon.influence || 0) * 60)).toBe(1);

      expect(Number(rules.income["Lékárna"].clean || 0)).toBe(0);
      expect(Number(rules.income["Lékárna"].dirty || 0)).toBe(0);

      expect(Number(rules.income.Restaurace.clean || 0)).toBe(38);
      expect(Number(rules.income.Restaurace.dirty || 0)).toBe(0);
      expect(Number(rules.heat.Restaurace.heat || 0)).toBe(0.04);
      expect(Number(rules.influence.Restaurace.influence || 0)).toBe(0.12);

      expect(Number(rules.income["Směnárna"].clean || 0)).toBe(70);
      expect(Number(rules.income["Směnárna"].dirty || 0)).toBe(95);
      expect(Math.round(Number(rules.heat["Směnárna"].heat || 0) * 1440)).toBe(70);
      expect(Math.round(Number(rules.influence["Směnárna"].influence || 0) * 1440)).toBe(60);
    }
  });

  it("keeps park fallback values aligned in runtime and client copies except drug lab", () => {
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
      expect(Number(rules.income["Pouliční dealeři"].clean || 0)).toBe(0);
      expect(Number(rules.income["Pouliční dealeři"].dirty || 0)).toBe(36);
      expect(Number(rules.heat["Pouliční dealeři"].heat || 0)).toBe(0.06);
      expect(Number(rules.influence["Pouliční dealeři"].influence || 0)).toBe(0);

      expect(Number(rules.income["Večerka"].clean || 0)).toBe(32);
      expect(Number(rules.income["Večerka"].dirty || 0)).toBe(18);
      expect(Number(rules.heat["Večerka"].heat || 0)).toBe(0.05);
      expect(Number(rules.influence["Večerka"].influence || 0)).toBe(0.1);

      expect(Number(rules.income["Pašovací tunel"].clean || 0)).toBe(0);
      expect(Number(rules.income["Pašovací tunel"].dirty || 0)).toBe(54);
      expect(Number(rules.heat["Pašovací tunel"].heat || 0)).toBe(0.07);
      expect(Number(rules.influence["Pašovací tunel"].influence || 0)).toBe(0);

      expect(Number(rules.income["Strip club"].clean || 0)).toBe(75);
      expect(Number(rules.income["Strip club"].dirty || 0)).toBe(65);
      expect(Number(rules.heat["Strip club"].heat || 0)).toBe(0.18);
      expect(Number(rules.influence["Strip club"].influence || 0)).toBe(0.38);
    }
  });
});
