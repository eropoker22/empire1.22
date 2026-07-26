// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerGameplayWantedPoliceController } from "../../page-assets/js/app/ui/serverGameplayWantedPoliceController.js";
import { createServerWantedPoliceView } from "../../page-assets/js/app/ui/serverGameplayWantedPoliceViewModel.js";

describe("server gameplay wanted police controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("maps only authoritative police state and keeps unsupported mitigation disabled", () => {
    const readModel = createReadModel();
    const view = createServerWantedPoliceView(readModel);
    const controller = createController();

    expect(view).toMatchObject({
      heatBadge: { heat: 88, levelId: 4, label: "4 / 5" },
      wanted: {
        levelLabel: "4 / 5",
        auditRiskLabel: "Řídí server",
        dirtyActionDisabled: true
      }
    });
    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(controller.update(readModel)).toBe(1);
    expect(document.querySelector("[data-gang-heat]").textContent).toBe("88");

    controller.open();
    const popup = document.querySelector("[data-wanted-popup]");
    expect(popup.hidden).toBe(false);
    expect(popup.parentElement).toBe(document.body);
    expect(document.querySelector("[data-wanted-popup-level]").textContent).toBe("4 / 5");
    expect(document.querySelector("[data-wanted-popup-audit-risk]").textContent).toBe("Řídí server");
    for (const selector of [
      "[data-wanted-popup-dirty]",
      "[data-wanted-popup-clean]",
      "[data-wanted-popup-influence]",
      "[data-wanted-popup-clear-log]"
    ]) {
      const button = document.querySelector(selector);
      expect(button.disabled).toBe(true);
      expect(button.title).toContain("serverový command");
    }

    const writes = controller.getDiagnostics().panelRenders;
    controller.update(structuredClone(readModel));
    expect(controller.getDiagnostics().panelRenders).toBe(writes);
    controller.destroy();
  });

  it("routes pending raid acknowledgement only through the canonical source command", async () => {
    const readModel = createReadModel({ pending: true });
    const responseReadModel = createReadModel({ pending: true });
    responseReadModel.police.pendingRaid.status = "acknowledged";
    const source = {
      submitCommand: vi.fn().mockResolvedValue({
        accepted: true,
        errors: [],
        readModel: responseReadModel
      })
    };
    const onReadModel = vi.fn();
    const controller = createController({ source, onReadModel });
    controller.mount();
    controller.update(readModel);
    controller.open();

    document.querySelector(".police-feed-panel__acknowledge").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.submitCommand).toHaveBeenCalledTimes(1);
    expect(source.submitCommand).toHaveBeenCalledWith({
      type: "acknowledge-pending-raid",
      payload: { raidId: "raid:pending" },
      focusDistrictId: "district:1"
    });
    expect(onReadModel).toHaveBeenCalledWith(responseReadModel);
    expect(document.querySelector("[data-wanted-popup-feedback]").textContent).toContain("potvrzeno serverem");
    controller.destroy();
  });

  it("does not reopen stale raids and opens a newly resolved authoritative raid once", () => {
    const controller = createController();
    controller.mount();
    const initial = createReadModel({ recentRaidId: "raid:old" });
    controller.update(initial);
    const modal = document.querySelector("#police-action-result-modal");
    expect(modal.classList.contains("hidden")).toBe(true);

    controller.update(structuredClone(initial));
    expect(modal.classList.contains("hidden")).toBe(true);

    const next = createReadModel({ recentRaidId: "raid:new" });
    controller.update(next);
    expect(modal.classList.contains("hidden")).toBe(false);
    expect(document.querySelector("#police-action-result-modal-title").textContent).toBe("Dopady razie");
    expect(document.querySelector("#police-action-result-modal-details").textContent).toContain("Co se teď děje");
    expect(controller.getDiagnostics().raid.modalOpens).toBe(1);

    document.querySelector("#police-action-result-modal-close").click();
    controller.update(structuredClone(next));
    expect(modal.classList.contains("hidden")).toBe(true);
    expect(controller.getDiagnostics().raid.modalOpens).toBe(1);
    controller.destroy();
  });

  it("removes named popup and raid listeners during cleanup", () => {
    const controller = createController();
    controller.mount();
    controller.update(createReadModel());
    controller.destroy();

    document.querySelector("[data-gang-heat]").click();
    expect(document.querySelector("[data-wanted-popup]").hidden).toBe(true);
    const modal = document.querySelector("#police-action-result-modal");
    modal.hidden = false;
    modal.classList.remove("hidden");
    document.querySelector("#police-action-result-modal-close").click();
    expect(modal.classList.contains("hidden")).toBe(false);
  });

  it("contains no local persistence, simulation or legacy runtime dependency", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "page-assets/js/app/ui/serverGameplayWantedPoliceController.js"
    ), "utf8");
    expect(source).not.toMatch(
      /localStorage|sessionStorage|runtime\.js|setGangHeat|trySpend|setInterval|requestAnimationFrame/u
    );
    expect(source).toContain('type: "acknowledge-pending-raid"');
  });
});

function createController(overrides = {}) {
  return createServerGameplayWantedPoliceController({
    root: document.querySelector("#game-root"),
    source: overrides.source || {},
    onReadModel: overrides.onReadModel,
    documentRef: document
  });
}

function createReadModel({ pending = false, recentRaidId = "" } = {}) {
  const recentRaid = recentRaidId
    ? {
        id: recentRaidId,
        type: "police-raid-resolved",
        severity: "high",
        status: "resolved",
        districtId: "district:1",
        tick: 41,
        message: "Policie zasáhla tvůj district."
      }
    : null;
  const pendingRaid = pending
    ? {
        id: "raid:pending",
        raidId: "raid:pending",
        severity: "extreme",
        status: "pending",
        targetDistrictId: "district:1",
        remainingMs: 60_000,
        expiresAtMs: Date.now() + 60_000,
        previewConsequences: {
          seizedDirtyCash: 120,
          seizedResources: { chemicals: 2 },
          heatReducedBy: 25
        }
      }
    : null;
  const policeFeed = recentRaid
    ? [{
        id: `event:${recentRaidId}`,
        type: "police-raid-resolved",
        message: recentRaid.message,
        createdAtTick: 41,
        payload: {
          raidId: recentRaidId,
          seizedDirtyCash: 120,
          seizedResources: { chemicals: 2 }
        }
      }]
    : [];
  return {
    server: { currentTick: 40 },
    mode: { tickRateMs: 10_000 },
    district: { districtId: "district:1" },
    player: { homeDistrictId: "district:1" },
    police: {
      heat: 88,
      playerHeat: 88,
      ownedDistrictHeat: 22,
      wantedLevel: 4,
      wantedLevelLabel: "4 / 5",
      riskTier: pending ? "extreme" : "high",
      aggregatePressure: 110,
      raidPressure: 110,
      playerHeatPressure: 88,
      districtHeatPressure: 22,
      hottestDistrictId: "district:1",
      hottestDistrictHeat: 22,
      pendingRaid,
      activeRaid: pending
        ? {
            id: "raid:pending",
            type: "police-raid-pending",
            severity: "extreme",
            status: "pending",
            districtId: "district:1",
            tick: 40,
            message: "Policejní razie se blíží."
          }
        : null,
      recentRaid,
      activeConsequences: recentRaid
        ? [
            { id: "lock:1", type: "district-lockdown", districtId: "district:1", expiresAtTick: 46 },
            { id: "building:1", type: "building-disruption", districtId: "district:1", expiresAtTick: 46 }
          ]
        : [],
      policeFeed,
      lastPoliceEvent: policeFeed[0] || null,
      protection: { raidConsequenceMultiplier: 0.75, sources: ["courthouse"] },
      recommendedAction: "Sniž heat a omez hlučné akce."
    }
  };
}

function createFixture() {
  return `<main id="game-root">
    <div data-gang-stars>${"<span data-gang-star>★</span>".repeat(6)}</div>
    <button data-gang-heat>—</button>
    <div data-wanted-popup hidden>
      <button data-wanted-popup-close>backdrop</button>
      <section class="wanted-popup-card">
        <button data-wanted-popup-close>close</button>
        <strong data-wanted-popup-heat></strong>
        <strong data-wanted-popup-level></strong>
        <strong data-wanted-popup-tier></strong>
        <span data-wanted-popup-description></span>
        <span data-wanted-popup-protection></span>
        <span data-wanted-popup-audit-risk></span>
        <div data-wanted-popup-levels></div>
        <div data-wanted-popup-rise-list></div>
        <div data-wanted-popup-fall-list></div>
        <div data-wanted-popup-feedback hidden></div>
        <button data-wanted-popup-dirty></button>
        <button data-wanted-popup-clean></button>
        <button data-wanted-popup-influence></button>
        <button data-wanted-popup-clear-log></button>
      </section>
      <aside data-wanted-popup-police-window hidden>
        <button data-wanted-popup-police-close></button>
        <section data-wanted-popup-police-feed></section>
      </aside>
    </div>
    <div id="police-action-result-modal" class="modal hidden" hidden>
      <button id="police-action-result-modal-backdrop"></button>
      <section id="police-action-result-modal-content">
        <h3 id="police-action-result-modal-title"></h3>
        <button id="police-action-result-modal-close"></button>
        <span id="police-action-result-modal-badge"></span>
        <p id="police-action-result-modal-summary"></p>
        <div id="police-action-result-modal-details"></div>
      </section>
    </div>
  </main>`;
}
