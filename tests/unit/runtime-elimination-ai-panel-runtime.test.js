import { describe, expect, it, vi } from "vitest";
import {
  bindEliminationAiPanel,
  bindEliminationCountdownWarning,
  createMockEliminationAiPanelViewModel,
  renderEliminationAiPanel,
  renderFinalLockdownAiPanel
} from "../../page-assets/js/app/runtime/eliminationAiPanelRuntime.js";

function createTarget(matchSelector) {
  const target = {
    focused: false,
    closest: vi.fn((selector) => selector === matchSelector ? target : null),
    focus: vi.fn(function focus() {
      this.focused = true;
    })
  };
  return target;
}

function createPanelFixture() {
  const listeners = new Map();
  const panelListeners = new Map();
  const documentListeners = new Map();
  const body = { innerHTML: "" };
  const card = { classList: { add: vi.fn(), remove: vi.fn() }, focus: vi.fn() };
  const title = { textContent: "" };
  const kicker = { textContent: "" };
  const status = { dataset: {}, textContent: "" };
  const panelClassList = { add: vi.fn(), remove: vi.fn() };
  const panel = {
    dataset: {},
    hidden: true,
    classList: panelClassList,
    addEventListener: vi.fn((type, listener) => {
      panelListeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
    querySelector: vi.fn((selector) => ({
      "[data-elimination-ai-panel-body]": body,
      ".elimination-ai-panel__card": card,
      "[data-elimination-ai-panel-title]": title,
      "[data-elimination-ai-panel-kicker]": kicker,
      "[data-elimination-ai-panel-status]": status
    })[selector] || null)
  };
  const root = {
    ownerDocument: {
      body: { classList: { add: vi.fn(), remove: vi.fn() } },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn((type, listener) => {
        documentListeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
      querySelector: vi.fn((selector) => selector === "[data-elimination-ai-panel]" ? panel : null)
    },
    contains: vi.fn((node) => node === panel),
    querySelector: vi.fn((selector) => selector === "[data-elimination-ai-panel]" ? panel : null),
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn()
  };

  return {
    body,
    card,
    documentListeners,
    listeners,
    panel,
    panelListeners,
    root,
    status,
    title,
    kicker
  };
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function createCountdownWarningFixture() {
  const timeNode = { textContent: "" };
  const warning = {
    hidden: true,
    classList: { toggle: vi.fn() },
    querySelector: vi.fn((selector) => selector === "[data-elimination-countdown-warning-time]" ? timeNode : null)
  };
  const root = {
    ownerDocument: {
      querySelector: vi.fn((selector) => selector === "[data-elimination-countdown-warning]" ? warning : null)
    },
    querySelector: vi.fn((selector) => selector === "[data-elimination-countdown-warning]" ? warning : null)
  };
  return { root, timeNode, warning };
}

describe("elimination AI panel runtime", () => {
  it("renders the production mock elimination briefing", () => {
    const html = renderEliminationAiPanel();

    expect(html).toContain("Očista za");
    expect(html).toContain("6min 01s");
    expect(html).toContain("Nejnižší gang vypadne");
    expect(html).toContain("Poslední 3 hráči");
    expect(html).toContain("StreetPhantom");
    expect(html).toContain("NeonViper (TY)");
    expect(html).toContain("LowKeyLad");
    expect(countMatches(html, /<div class="elimination-ai-panel__leaderboard-row/g)).toBe(3);
    expect(html).not.toContain("elimination-ai-panel__status");
    expect(html).not.toContain("DANGER");
    expect(html).not.toContain("Akce");
    expect(html).not.toContain("elimination-ai-panel__actions");
    expect(html).not.toContain("+ District");
    expect(html).not.toContain("sniž tlak");
    expect(html).toContain("Rozpis score");
    expect(html).not.toContain("Heat penalty");
    expect(html).not.toContain('data-ai-metric="heat"');
    expect(html).not.toContain("elimination-ai-panel__leaderboard-heat");
    expect(html).toContain("Celkem");
    expect(html).not.toContain("DEV-ONLY");
    expect(html).not.toContain("75%");
  });

  it("filters heat values out of externally supplied panel data", () => {
    const html = renderEliminationAiPanel({
      ...createMockEliminationAiPanelViewModel(),
      metrics: [
        { key: "score", label: "Score", value: "1M" },
        { key: "heat", label: "Heat", value: "99" }
      ],
      scoreBreakdown: [
        { label: "Districts", value: "1M", progress: 70 },
        { label: "Heat penalty", value: "-99K", progress: 40 }
      ]
    });

    expect(html).toContain("Districts");
    expect(html).not.toContain('data-ai-metric="heat"');
    expect(html).not.toContain("Heat penalty");
  });

  it("prepares the mock final lockdown variant", () => {
    const html = renderFinalLockdownAiPanel();

    expect(html).toContain("Do rozsudku");
    expect(html).toContain("7h 42m");
    expect(html).toContain("+38K");
    expect(html).toContain("Top 3");
    expect(html).toContain("Rado Viper");
    expect(html).toContain("Nika Static");
    expect(html).toContain("Mara Byte");
    expect(countMatches(html, /<div class="elimination-ai-panel__leaderboard-row/g)).toBe(3);
  });

  it("keeps mock data in a replaceable view model shape", () => {
    const viewModel = createMockEliminationAiPanelViewModel();
    const finalViewModel = createMockEliminationAiPanelViewModel({ mode: "final_lockdown" });

    expect(viewModel).toMatchObject({
      mode: "elimination",
      status: "danger",
      countdownLabel: "Očista za",
      countdownValue: "6min 01s"
    });
    expect(viewModel.metrics).toHaveLength(4);
    expect(viewModel.metrics.some((metric) => metric.key === "heat")).toBe(false);
    expect(viewModel.leaderboard).toHaveLength(3);
    expect(viewModel.leaderboard.some((entry) => "heat" in entry)).toBe(false);
    expect(viewModel.actions).toHaveLength(2);
    expect(viewModel.actions.some((action) => action.label.toLowerCase().includes("heat"))).toBe(false);
    expect(viewModel.scoreBreakdown).toHaveLength(4);
    expect(finalViewModel.mode).toBe("final_lockdown");
    expect(finalViewModel.status).toBe("final");
  });

  it("formats countdown with hours, minutes and seconds when needed", () => {
    const viewModel = createMockEliminationAiPanelViewModel({
      countdownRemainingMs: 3723000
    });

    expect(viewModel.countdownValue).toBe("1h 02min 03s");
  });

  it("opens, closes by button/Escape and restores focus", () => {
    const fixture = createPanelFixture();
    let currentTime = 1000;
    let intervalCallback = null;
    const timerApi = {
      now: vi.fn(() => currentTime),
      setInterval: vi.fn((callback) => {
        intervalCallback = callback;
        return 7;
      }),
      clearInterval: vi.fn()
    };
    const runtime = bindEliminationAiPanel(fixture.root, { timerApi });
    const trigger = createTarget("[data-elimination-ai-panel-open]");

    fixture.listeners.get("click")({ target: trigger, preventDefault: vi.fn() });
    expect(runtime).toBeTruthy();
    expect(fixture.panel.hidden).toBe(false);
    expect(fixture.root.ownerDocument.body.classList.add).toHaveBeenCalledWith("elimination-ai-panel-open");
    expect(fixture.card.focus).toHaveBeenCalled();
    expect(fixture.kicker.textContent).toBe("");
    expect(fixture.title.textContent).toBe("");
    expect(fixture.status.textContent).toBe("DANGER");
    expect(fixture.card.classList.add).toHaveBeenCalledWith("is-danger");
    expect(fixture.body.innerHTML).toContain("6min 01s");
    expect(fixture.body.innerHTML).toContain("NeonViper (TY)");
    expect(timerApi.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

    currentTime += 1000;
    intervalCallback();
    expect(fixture.body.innerHTML).toContain("6min 00s");

    const closeTarget = createTarget("[data-elimination-ai-panel-close]");
    fixture.listeners.get("click")({ target: closeTarget, preventDefault: vi.fn() });
    expect(fixture.panel.hidden).toBe(true);
    expect(fixture.root.ownerDocument.body.classList.remove).toHaveBeenCalledWith("elimination-ai-panel-open");
    expect(timerApi.clearInterval).toHaveBeenCalledWith(7);

    fixture.listeners.get("click")({ target: trigger, preventDefault: vi.fn() });
    fixture.documentListeners.get("keydown")({ key: "Escape", preventDefault: vi.fn() });
    expect(fixture.panel.hidden).toBe(true);
    expect(trigger.focus).toHaveBeenCalled();
  });

  it("shows the eliminated gang notice with avatar and restarts the panel countdown", () => {
    const fixture = createPanelFixture();
    let currentTime = 0;
    let intervalCallback = null;
    const timerApi = {
      now: vi.fn(() => currentTime),
      setInterval: vi.fn((callback) => {
        intervalCallback = callback;
        return 11;
      }),
      clearInterval: vi.fn()
    };
    const onCountdownElapsed = vi.fn(() => ({
      avatarSrc: "../img/avatars/lowkey.jpg",
      districtsNeutralized: 4
    }));
    bindEliminationAiPanel(fixture.root, {
      initialCountdownMs: 1000,
      resetCountdown: true,
      timerApi,
      onCountdownElapsed
    });
    const trigger = createTarget("[data-elimination-ai-panel-open]");

    fixture.listeners.get("click")({ target: trigger, preventDefault: vi.fn() });
    expect(fixture.body.innerHTML).toContain("1s");

    currentTime = 1000;
    intervalCallback();

    expect(onCountdownElapsed).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 3,
      gangName: "LowKeyLad",
      title: "Policie vystřílela gang LowKeyLad"
    }), expect.any(Object));
    expect(fixture.body.innerHTML).toContain("Policie vystřílela gang LowKeyLad");
    expect(fixture.body.innerHTML).toContain("Policie vystřílela gang na sračky a nic tu po něm nezbylo.");
    expect(fixture.body.innerHTML).toContain("../img/avatars/lowkey.jpg");
    expect(fixture.body.innerHTML).toContain("4 districtů je teď neobsazených");
    expect(fixture.body.innerHTML).toContain("4h 00min 00s");
  });

  it("shows the global red warning only for the last five minutes and restarts after zero", () => {
    const fixture = createCountdownWarningFixture();
    let currentTime = 0;
    let intervalCallback = null;
    const timerApi = {
      now: vi.fn(() => currentTime),
      setInterval: vi.fn((callback) => {
        intervalCallback = callback;
        return 9;
      }),
      clearInterval: vi.fn()
    };

    bindEliminationCountdownWarning(fixture.root, {
      initialCountdownMs: 361000,
      resetCountdown: true,
      timerApi
    });

    expect(fixture.warning.hidden).toBe(true);
    expect(fixture.timeNode.textContent).toBe("6min 01s");

    currentTime = 61000;
    intervalCallback();
    expect(fixture.warning.hidden).toBe(false);
    expect(fixture.timeNode.textContent).toBe("5min 00s");

    currentTime = 361000;
    intervalCallback();
    expect(fixture.warning.hidden).toBe(true);
    expect(fixture.timeNode.textContent).toBe("4h 00min 00s");
    expect(timerApi.clearInterval).not.toHaveBeenCalled();
  });

  it("binds a body-level panel outside the game root", () => {
    const fixture = createPanelFixture();
    fixture.root.querySelector = vi.fn(() => null);
    fixture.root.contains = vi.fn(() => false);
    bindEliminationAiPanel(fixture.root);
    const trigger = createTarget("[data-elimination-ai-panel-open]");
    const closeTarget = createTarget("[data-elimination-ai-panel-close]");

    fixture.listeners.get("click")({ target: trigger, preventDefault: vi.fn() });
    expect(fixture.panel.hidden).toBe(false);
    expect(fixture.panel.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));

    fixture.panelListeners.get("click")({ target: closeTarget, preventDefault: vi.fn() });
    expect(fixture.panel.hidden).toBe(true);
  });

  it.each([
    ["safe", "SAFE", "is-safe"],
    ["danger", "DANGER", "is-danger"],
    ["critical", "CRITICAL", "is-critical"],
    ["final", "FINAL", "is-final"]
  ])("applies the %s visual state", (state, label, className) => {
    const fixture = createPanelFixture();
    const viewModel = {
      ...createMockEliminationAiPanelViewModel(),
      status: state,
      title: state === "final" ? "FINAL LOCKDOWN" : "AI OPERÁTOR OČISTY",
      aiUnit: state === "final" ? "AI-LOCK" : "AI-07"
    };
    bindEliminationAiPanel(fixture.root, {
      getViewModel: () => viewModel
    });
    const trigger = createTarget("[data-elimination-ai-panel-open]");

    fixture.listeners.get("click")({ target: trigger, preventDefault: vi.fn() });

    expect(fixture.status.textContent).toBe(label);
    expect(fixture.card.classList.add).toHaveBeenCalledWith(className);
  });
});
