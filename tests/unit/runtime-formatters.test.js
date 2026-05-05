import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney,
  formatDistrictHeatLabel,
  formatDistrictIncomeLabel,
  formatDistrictInfluenceLabel,
  formatDistrictMetricNumber,
  formatDistrictMoneyAmount
} from "../../page-assets/js/app/runtime/formatters.js";

describe("runtime formatters", () => {
  it("keeps legacy currency output stable", () => {
    expect(formatCurrency(1200)).toBe("$1200");
    expect(formatDistrictMoneyAmount(1234.4)).toBe("$1 234");
    expect(formatDistrictBuildingMoney(1234.9)).toBe("$1234");
  });

  it("formats district income, heat, and influence labels", () => {
    expect(formatDistrictIncomeLabel(3600)).toBe("$3 600/hod");
    expect(formatDistrictIncomeLabel(3600, { hidden: true })).toBe("Skryto");
    expect(formatDistrictHeatLabel(115.24)).toBe("+115,2/den");
    expect(formatDistrictHeatLabel(0)).toBe("0/den");
    expect(formatDistrictInfluenceLabel(3.25)).toBe("+3,25/hod");
  });

  it("formats small metric values and building cooldowns", () => {
    expect(formatDistrictMetricNumber(1.234, 2)).toBe("1,23");
    expect(formatDistrictMetricNumber(10, 2)).toBe("10");
    expect(formatDistrictBuildingCooldown(0)).toBe("0s");
    expect(formatDistrictBuildingCooldown(61000)).toBe("1m 01s");
  });
});
