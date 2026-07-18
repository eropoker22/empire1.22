import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(resolve(process.cwd(), "page-assets/js/app/runtime.js"), "utf8");

describe("local district action conflicts", () => {
  it("blocks a robbery command while a spy mission is active on the same district", () => {
    const robberyActionStart = runtimeSource.indexOf("const applyRobberyAction = (selectedDistrict) => {");
    const spyActionStart = runtimeSource.indexOf("const applySpyAction = (selectedDistrict) => {");
    const robberyActionSource = runtimeSource.slice(robberyActionStart, spyActionStart);

    expect(runtimeSource).toContain("const isDistrictSpyInProgress = (districtId) => {");
    expect(robberyActionStart).toBeGreaterThan(-1);
    expect(spyActionStart).toBeGreaterThan(robberyActionStart);
    expect(robberyActionSource).toContain("if (isDistrictSpyInProgress(selectedDistrict.id)) {");
    expect(robberyActionSource).toContain("Vykrást ho lze až po návratu špeha.");
  });

  it("blocks a spy command while a robbery is active on the same district", () => {
    const spyActionStart = runtimeSource.indexOf("const applySpyAction = (selectedDistrict) => {");
    const popupOpenStart = runtimeSource.indexOf("const openPopup = (district) => {");
    const spyActionSource = runtimeSource.slice(spyActionStart, popupOpenStart);

    expect(runtimeSource).toContain("const isDistrictRobberyInProgress = (districtId) => {");
    expect(spyActionStart).toBeGreaterThan(-1);
    expect(popupOpenStart).toBeGreaterThan(spyActionStart);
    expect(spyActionSource).toContain("if (isDistrictRobberyInProgress(selectedDistrict.id)) {");
    expect(spyActionSource).toContain("Špehování lze spustit až po dokončení vykradení.");
  });
});
