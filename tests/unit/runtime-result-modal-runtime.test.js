import { describe, expect, it, vi } from "vitest";
import { createResultModalRuntime } from "../../page-assets/js/app/runtime/resultModalRuntime.js";
import { createResultModalQueue } from "../../page-assets/js/app/ui/resultModalQueue.js";

function createModal(hidden = true) {
  return {
    classList: {
      contains: vi.fn(() => hidden)
    }
  };
}

function createRoot(elements = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null)
  };
}

function createRuntime(overrides = {}) {
  return createResultModalRuntime({
    createResultModalQueue,
    formatDistrictGossipTimestamp: () => "teď",
    formatDistrictReference: () => "Downtown",
    renderBattleReportPanel: vi.fn(),
    renderSimpleResultModal: vi.fn(() => true),
    renderSpyWarningPanel: vi.fn(() => true),
    selectors: {
      attackResult: "#attack",
      policeActionResult: "#police",
      raidResult: "#raid",
      raidResultContent: "#raid-content",
      raidResultDetails: "#raid-details",
      raidResultSummary: "#raid-summary",
      raidResultTitle: "#raid-title",
      spyResult: "#spy",
      spyResultContent: "#spy-content",
      spyResultDetails: "#spy-details",
      spyResultSummary: "#spy-summary",
      spyResultTitle: "#spy-title",
      spyWarning: "#spy-warning"
    },
    ...overrides
  });
}

describe("result modal runtime", () => {
  it("routes result modal kinds through UI callbacks", () => {
    const renderSimpleResultModal = vi.fn(() => true);
    const renderSpyWarningPanel = vi.fn(() => true);
    const renderBattleReportPanel = vi.fn(() => true);
    const openPoliceActionResultModal = vi.fn();
    const runtime = createRuntime({
      openPoliceActionResultModal,
      renderBattleReportPanel,
      renderSimpleResultModal,
      renderSpyWarningPanel
    });
    const root = createRoot();

    runtime.openResultModalByKind(root, "spy", { title: "Spy" });
    runtime.openResultModalByKind(root, "spy_alert", { attackerNick: "Enemy" });
    runtime.openResultModalByKind(root, "attack", { title: "Attack" });
    runtime.openResultModalByKind(root, "police", { title: "Police" });

    expect(renderSimpleResultModal).toHaveBeenCalledWith(root, { title: "Spy" }, expect.objectContaining({
      modalSelector: "#spy"
    }));
    expect(renderSpyWarningPanel).toHaveBeenCalledWith(root, expect.objectContaining({
      attackerNick: "Enemy",
      districtName: "Downtown"
    }));
    expect(renderBattleReportPanel).toHaveBeenCalledWith(root, expect.objectContaining({
      title: "Attack",
      lootLabel: "Žádný",
      heatGainedLabel: "+0",
      policeWarningLabel: "Bez hlášení",
      nextActionLabel: "Zpět na mapu"
    }));
    expect(openPoliceActionResultModal).toHaveBeenCalledWith(root, { title: "Police" });
  });

  it("keeps queue behavior guarded by visible modal state", () => {
    const renderSimpleResultModal = vi.fn(() => true);
    const runtime = createRuntime({ renderSimpleResultModal });
    const root = createRoot({
      "#spy": createModal(false)
    });

    runtime.queueOrOpenResultModal(root, "spy", { title: "Queued" });

    expect(runtime.getResultModalQueue().getQueueSize()).toBe(1);
    expect(renderSimpleResultModal).not.toHaveBeenCalled();
  });
});
