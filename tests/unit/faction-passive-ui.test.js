// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  renderFactionPassiveUi,
  resolveFactionPassiveInlineEffects
} from "../../page-assets/js/app/faction-passive-ui.js";
import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";

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
    expect(strengthNote.textContent).toBe("+12 % síla útoku");
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
    expect(note.textContent).toBe("+10 % produkce technologií");
    expect(resolveFactionPassiveInlineEffects("hackeri", "", factionView, {
      statLabel: "Rychlost produkce",
      buildingType: "pharmacy"
    })).toEqual([]);
  });

  it("keeps spy effects inside the spy card and reveals only their affected row", () => {
    document.body.innerHTML = `
      <main data-gameplay-slice-client data-faction-id="tajna-organizace"></main>
      <section>
        <p data-faction-passive-inline-row hidden>
          Úspěšnost
          <small data-faction-passive-inline-context="spy-success" hidden></small>
        </p>
        <p>Trvání <small data-faction-passive-inline-context="spy-duration" hidden></small></p>
      </section>
    `;
    const factionView = {
      factionId: "tajna-organizace",
      activePassiveEffects: [
        "+15 % šance na úspěšné špehování",
        "-10 % doba čekání na špehování"
      ]
    };

    renderFactionPassiveUi(document, factionView);

    const successNote = document.querySelector("[data-faction-passive-inline-context='spy-success']");
    const durationNote = document.querySelector("[data-faction-passive-inline-context='spy-duration']");
    expect(successNote.textContent).toBe("+15 % šance na úspěšné špehování");
    expect(successNote.closest("[data-faction-passive-inline-row]").hidden).toBe(false);
    expect(durationNote.textContent).toBe("-10 % doba čekání na špehování");
    expect(durationNote.hidden).toBe(false);
  });

  it("routes every active numeric effect of every faction to at least one affected card value", () => {
    const targets = [
      ...[
        "attack", "attack-strength", "attack-duration",
        "robbery", "robbery-loot", "robbery-duration", "robbery-heat",
        "defense", "defense-strength", "camera-effectiveness", "alarm-effectiveness",
        "spy", "spy-success", "spy-duration", "occupy", "rumor-truth"
      ].map((context) => ({ context })),
      { context: "building-action", options: { buildingType: "drug_lab" } },
      { options: { statLabel: "Čisté / hod" } },
      { options: { statLabel: "Špinavé / hod" } },
      { options: { statLabel: "Populace / min" } },
      { options: { statLabel: "Vliv / den" } },
      { options: { statLabel: "Heat / den" } },
      { options: { statLabel: "Produkce", buildingType: "factory" } },
      { options: { statLabel: "Produkce", buildingType: "druglab" } },
      { options: { statLabel: "Špinavé / hod", buildingType: "smuggling-tunnel" } },
      { options: { statLabel: "Distribuce", buildingType: "smuggling-tunnel" } },
      { options: { statLabel: "Špinavé / hod", buildingType: "street-dealers" } }
    ];

    const unmatched = [];
    for (const [factionId, faction] of Object.entries(FACTION_CATALOG)) {
      for (const effect of faction.coreBackedEffects) {
        const factionView = { factionId, activePassiveEffects: [effect] };
        const hasTarget = targets.some(({ context = "", options = {} }) => (
          resolveFactionPassiveInlineEffects(factionId, context, factionView, options).length > 0
        ));
        if (!hasTarget) unmatched.push(`${factionId}: ${effect}`);
      }
    }

    expect(Object.keys(FACTION_CATALOG)).toHaveLength(8);
    expect(unmatched).toEqual([]);
  });
});
