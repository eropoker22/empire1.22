import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createBuildingSpecialActionConfirmationController } from "../../page-assets/js/app/runtime/buildingSpecialActionConfirmation.js";

describe("building special action confirmation", () => {
  it("renders server default input summary when provided", () => {
    const dom = new JSDOM("<!doctype html><body><main id=\"host\"></main></body>");
    const host = dom.window.document.querySelector("#host");
    const controller = createBuildingSpecialActionConfirmationController({
      documentRef: dom.window.document,
      host
    });

    controller.update({
      titleLabel: "Tržní tlak",
      buildingLabel: "Burza",
      districtLabel: "District 79",
      description: "Po potvrzení se akce odešle na server.",
      inputSummary: "Kategorie: materials · Režim: pump",
      canConfirm: true
    });

    expect(host.textContent).toContain("Volba");
    expect(host.textContent).toContain("Kategorie: materials");
    expect(host.textContent).toContain("Režim: pump");
    expect(host.querySelector(".building-special-action-confirm__button--confirm").disabled).toBe(false);
  });
});
