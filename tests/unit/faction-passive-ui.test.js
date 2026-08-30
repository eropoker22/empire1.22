// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  renderFactionPassiveUi,
  resolveFactionPassiveInlineEffects
} from "../../page-assets/js/app/faction-passive-ui.js";

beforeEach(() => {
  document.body.innerHTML = `
    <main data-gameplay-slice-client data-faction-id="soukroma-armada"></main>
    <button data-district-action-id="attack">
      Útok
      <small class="faction-passive-inline hidden" data-faction-passive-inline-context="attack" hidden></small>
    </button>
    <p>Síla útoku <span><strong>224</strong><small class="faction-passive-inline hidden" data-faction-passive-inline-context="attack-strength" hidden></small></span></p>
  `;
});

describe("faction passive inline UI", () => {
  it("renders numeric faction changes directly in an action card and beside the real strength", () => {
    const factionView = {
      factionId: "soukroma-armada",
      name: "Soukromá armáda",
      activePassiveEffects: ["+12 % síla útoku", "+12 % síla obrany", "-10 % ztráty vybavení v boji"]
    };

    renderFactionPassiveUi(document, factionView);

    const cardNote = document.querySelector("[data-faction-passive-inline-context='attack']");
    const strengthNote = document.querySelector("[data-faction-passive-inline-context='attack-strength']");
    expect(cardNote.hidden).toBe(false);
    expect(cardNote.textContent).toContain("+12 % síla útoku");
    expect(cardNote.textContent).toContain("-10 % ztráty vybavení");
    expect(strengthNote.hidden).toBe(false);
    expect(strengthNote.textContent).toBe("Frakce: +12 % síla útoku");
    expect(strengthNote.previousElementSibling.textContent).toBe("224");
  });

  it("matches production effects only to the server-backed building stat they affect", () => {
    document.body.innerHTML = `
      <main data-gameplay-slice-client data-faction-id="hackeri"></main>
      <section data-building-mechanics-type="factory">
        <div class="building-info-card__stat">
          <span>Rychlost produkce</span><strong>110 %</strong>
          <small class="faction-passive-inline hidden" data-faction-passive-stat-label="Rychlost produkce" hidden></small>
        </div>
      </section>
    `;
    const factionView = {
      factionId: "hackeri",
      name: "Hackeři",
      activePassiveEffects: ["+10 % produkce technologií", "+10 % šance na úspěšné špehování"]
    };

    renderFactionPassiveUi(document, factionView);

    const note = document.querySelector("[data-faction-passive-stat-label]");
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe("Frakce: +10 % produkce technologií");
    expect(resolveFactionPassiveInlineEffects("hackeri", "", factionView, {
      statLabel: "Rychlost produkce",
      buildingType: "pharmacy"
    })).toEqual([]);
  });
});
