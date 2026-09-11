// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { refreshLiveCooldownLabels } from "../../apps/client/src/shared-ui/live-cooldown";
import { renderFactionPassiveUi } from "../../page-assets/js/app/faction-passive-ui.js";

describe("unchanged game labels", () => {
  it("does not replace a countdown's text node or attributes until its displayed value changes", () => {
    document.body.innerHTML = '<span data-live-cooldown data-cooldown-ends-at-ms="7200000"></span>';
    const node = document.querySelector("span");
    refreshLiveCooldownLabels(document, 1_000);
    const text = node.firstChild;
    const observer = new MutationObserver(() => {});
    observer.observe(node, { attributes: true, childList: true, subtree: true });
    for (let second = 2; second <= 59; second += 1) refreshLiveCooldownLabels(document, second * 1_000);
    expect(node.textContent).toBe("Čekání 1h 59m");
    expect(node.firstChild).toBe(text);
    expect(observer.takeRecords()).toHaveLength(0);
    refreshLiveCooldownLabels(document, 61_000);
    expect(node.textContent).toBe("Čekání 1h 58m");
    refreshLiveCooldownLabels(document, 7_200_000);
    expect(node.textContent).toBe("Připraveno");
    expect(node.dataset.cooldownState).toBe("ready");
    observer.takeRecords();
    refreshLiveCooldownLabels(document, 7_201_000);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it("keeps second-precision countdown updates", () => {
    document.body.innerHTML = '<span data-live-cooldown data-cooldown-ends-at-ms="30000"></span>';
    refreshLiveCooldownLabels(document, 1_000);
    expect(document.querySelector("span").textContent).toBe("Čekání 29s");
    refreshLiveCooldownLabels(document, 2_000);
    expect(document.querySelector("span").textContent).toBe("Čekání 28s");
  });

  it("writes no faction DOM mutations for equal projections, but updates changed and new targets", () => {
    document.body.innerHTML = '<main data-gameplay-slice-client></main><p data-faction-passive-inline-row hidden><small data-faction-passive-inline-context="attack-strength" hidden></small></p>';
    const view = { factionId: "soukroma-armada", activePassiveEffects: ["+12 % síla útoku"] };
    renderFactionPassiveUi(document, view);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    for (let repeat = 0; repeat < 60; repeat += 1) renderFactionPassiveUi(document, view);
    expect(observer.takeRecords()).toHaveLength(0);
    renderFactionPassiveUi(document, { ...view, activePassiveEffects: [] });
    expect(document.querySelector("small").hidden).toBe(true);
    expect(document.querySelector("p").hidden).toBe(true);
    expect(document.querySelector("small").hasAttribute("title")).toBe(false);
    const fresh = document.createElement("small");
    fresh.dataset.factionPassiveInlineContext = "attack-strength";
    document.body.append(fresh);
    renderFactionPassiveUi(document, view);
    expect(fresh.textContent).toBe("+12 % síla útoku");
    expect(fresh.hidden).toBe(false);
    observer.disconnect();
  });
});
