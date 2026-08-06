import { describe, expect, it } from "vitest";
import {
  createPopulationCollectResultPayload,
  createStorageCollectResultPayload
} from "../../page-assets/js/app/production-collect-results.js";

describe("production collect results", () => {
  it.each([
    ["Bytový blok", "Bytový blok: nový nábor", "Z bytového bloku se k tvému gangu přidalo 12 nových členů."],
    ["Večerka", "Večerka: nový nábor", "Z Večerky se k tvému gangu přidalo 12 nových členů."],
    ["Škola", "Škola: nový nábor", "Z Školy se k tvému gangu přidalo 12 nových členů."]
  ])("creates a Czech recruitment payload for %s", (buildingLabel, title, summary) => {
    const payload = createPopulationCollectResultPayload({
      buildingLabel,
      amount: 12,
      districtLabel: "District 7"
    });

    expect(payload).toMatchObject({
      title,
      summary,
      badge: "Nábor",
      collectItems: [{ label: "Členové gangu", value: "12", amount: 12 }]
    });
    expect(payload.rows).toEqual(expect.arrayContaining([
      { label: "District", value: "District 7" },
      { label: "Noví členové", value: "12", nowrap: true }
    ]));
  });

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
