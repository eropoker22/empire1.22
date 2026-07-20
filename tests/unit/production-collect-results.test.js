import { describe, expect, it } from "vitest";
import { createStorageCollectResultPayload } from "../../page-assets/js/app/production-collect-results.js";

describe("production collect results", () => {
  it.each([
    ["Večerka", "Večerka: Nový nábor"],
    ["Bytový blok", "Bytový blok - Nový nábor"]
  ])("labels %s collection as a new recruitment", (buildingLabel, expectedTitle) => {
    const payload = createStorageCollectResultPayload({
      buildingLabel,
      items: [{ label: "Členové", amount: 30 }]
    });

    expect(payload.title).toBe(expectedTitle);
    expect(payload.hideBadge).toBe(true);
  });

  it("uses the recruitment narrative without a type row for convenience stores", () => {
    const payload = createStorageCollectResultPayload({
      buildingLabel: "Večerka",
      meta: "Vybrat obyvatele",
      items: [{ label: "Členové", amount: 50 }]
    });

    expect(payload.summary).toBe("Podařilo se ti překecat místní na svou stranu.");
    expect(payload.rows.some((row) => row.label === "Typ")).toBe(false);
  });

  it("does not show a storage transfer summary for apartment block recruitment", () => {
    const payload = createStorageCollectResultPayload({
      buildingLabel: "Bytový blok",
      meta: "Vybrat obyvatele",
      items: [{ label: "Položka 1", value: "50 členů gangu" }]
    });

    expect(payload.summary).toBe("");
    expect(payload.summary).not.toContain("Do skladu přesunuto");
    expect(payload.hideSummary).toBe(true);
    expect(payload.rows.some((row) => row.label === "Celkem")).toBe(false);
  });

  it("keeps the storage label for non-recruitment collections", () => {
    const payload = createStorageCollectResultPayload({
      buildingLabel: "Továrna",
      items: [{ label: "Metal Parts", amount: 2 }]
    });

    expect(payload.title).toBe("Továrna: výběr do skladu");
    expect(payload.hideBadge).toBe(false);
  });
});
