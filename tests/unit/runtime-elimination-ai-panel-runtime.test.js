import { describe, expect, it, vi } from "vitest";
import {
  bindEliminationAiPanel,
  bindEliminationCountdownWarning,
  bindEliminationResultPopup,
  createMockEliminationAiPanelViewModel,
  renderEliminationAiPanel,
  renderEliminationResultPopupBody,
  renderFinalLockdownPurgePanel
} from "../../page-assets/js/app/runtime/eliminationPurgePanelRuntime.js";

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
  const leaderboard = { scrollTop: 0 };
  const score = { scrollTop: 0 };
  const body = {
    innerHTML: "",
    scrollTop: 0,
    querySelector: vi.fn((selector) => ({
      ".elimination-ai-panel__leaderboard": leaderboard,
      ".elimination-ai-panel__score": score
    })[selector] || null)
  };
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
    leaderboard,
    panel,
    panelListeners,
    root,
    score,
    status,
    title,
    kicker
  };
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function createCountdownWarningFixture() {
  const closeListeners = new Map();
  const timeNode = { textContent: "" };
  const closeButton = {
    addEventListener: vi.fn((type, listener) => {
      closeListeners.set(type, listener);
    }),
    removeEventListener: vi.fn()
  };
  const warning = {
    hidden: true,
    classList: { toggle: vi.fn() },
    querySelector: vi.fn((selector) => ({
      "[data-elimination-countdown-warning-time]": timeNode,
      "[data-elimination-countdown-warning-close]": closeButton
    })[selector] || null)
  };
  const root = {
    ownerDocument: {
      defaultView: {
        CustomEvent: class FakeCustomEvent {
          constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
          }
        }
      },
      dispatchEvent: vi.fn(),
      querySelector: vi.fn((selector) => selector === "[data-elimination-countdown-warning]" ? warning : null)
    },
    querySelector: vi.fn((selector) => selector === "[data-elimination-countdown-warning]" ? warning : null)
  };
  return { closeButton, closeListeners, root, timeNode, warning };
}

function createResultPopupFixture() {
  const listeners = new Map();
  const popupListeners = new Map();
  const documentListeners = new Map();
  const body = { innerHTML: "" };
  const cardClasses = new Set();
  const card = {
    focus: vi.fn(),
    classList: {
      add: vi.fn((value) => cardClasses.add(value)),
      remove: vi.fn((value) => cardClasses.delete(value)),
      contains: vi.fn((value) => cardClasses.has(value)),
      toggle: vi.fn((value) => {
        if (cardClasses.has(value)) {
          cardClasses.delete(value);
          return false;
        }
        cardClasses.add(value);
        return true;
      })
    }
  };
  const popupClassList = { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) };
  const popup = {
    hidden: true,
    classList: popupClassList,
    addEventListener: vi.fn((type, listener) => {
      popupListeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
    querySelector: vi.fn((selector) => ({
      "[data-elimination-result-popup-body]": body,
      ".elimination-result-popup__card": card
    })[selector] || null)
  };
  const root = {
    ownerDocument: {
      body: { classList: { add: vi.fn(), remove: vi.fn() } },
      addEventListener: vi.fn((type, listener) => {
        documentListeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
      querySelector: vi.fn((selector) => selector === "[data-elimination-result-popup]" ? popup : null)
    },
    contains: vi.fn((node) => node === popup),
    querySelector: vi.fn((selector) => selector === "[data-elimination-result-popup]" ? popup : null),
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn()
  };

  return {
    body,
    card,
    cardClasses,
    documentListeners,
    listeners,
    popup,
    popupListeners,
    root
  };
}

describe("elimination purge panel runtime", () => {
  it("renders the production mock elimination briefing", () => {
    const html = renderEliminationAiPanel();

    expect(html).not.toContain("OČISTA / PURGE OKNO");
    expect(html).not.toContain("PURGE-07");
    expect(html).toContain("Očista za");
    expect(html).toContain("15min 00s");
    expect(html).toContain("Nejslabší gang vypadne");
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

  it("renders a safe fallback without complete read-model data", () => {
    const html = renderEliminationAiPanel({
      mode: "elimination",
      title: "Očista fallback"
    });

    expect(html).not.toContain("Očista fallback");
    expect(html).toContain("Data se načítají");
    expect(html).not.toContain("DEV-ONLY");
  });

  it("prepares the mock final lockdown variant", () => {
    const html = renderFinalLockdownPurgePanel();

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
      title: "OČISTA / PURGE OKNO",
      unitLabel: "PURGE-07",
      countdownLabel: "Očista za",
      countdownValue: "15min 00s"
    });
    expect(viewModel.metrics).toHaveLength(4);
    expect(viewModel.metrics.some((metric) => metric.key === "heat")).toBe(false);
    expect(viewModel.leaderboard).toHaveLength(3);
    expect(viewModel.leaderboard.some((entry) => "heat" in entry)).toBe(false);
    expect(viewModel.actions).toHaveLength(3);
    expect(viewModel.actions.some((action) => action.label.toLowerCase().includes("heat"))).toBe(false);
    expect(viewModel.scoreBreakdown).toHaveLength(4);
    expect(viewModel.eliminationResult).toMatchObject({
      gangName: "LowKeyLad",
      title: "Očista proběhla: LowKeyLad"
    });
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
    expect(fixture.body.innerHTML).toContain("15min 00s");
    expect(fixture.body.innerHTML).toContain("NeonViper (TY)");
    expect(timerApi.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

    fixture.body.scrollTop = 144;
    fixture.leaderboard.scrollTop = 31;
    fixture.score.scrollTop = 17;
    currentTime += 1000;
    intervalCallback();
    expect(fixture.body.innerHTML).toContain("14min 59s");
    expect(fixture.body.scrollTop).toBe(144);
    expect(fixture.leaderboard.scrollTop).toBe(31);
    expect(fixture.score.scrollTop).toBe(17);

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

  it("resolves the eliminated gang and restarts the purge countdown without embedding the result", () => {
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
      title: "Očista proběhla: LowKeyLad"
    }), expect.any(Object));
    expect(fixture.body.innerHTML).not.toContain("Očista proběhla: LowKeyLad");
    expect(fixture.body.innerHTML).not.toContain("../img/avatars/lowkey.jpg");
    expect(fixture.body.innerHTML).toContain("4h 00min 00s");
  });

  it("shows the eliminated gang result in a separate popup with avatar", () => {
    const fixture = createResultPopupFixture();
    const trigger = createTarget("[data-elimination-ai-panel-open]");

    const runtime = bindEliminationResultPopup(fixture.root);
    runtime.open({
      gangName: "LowKeyLad",
      title: "Očista proběhla: LowKeyLad",
      body: "Policie rozdrtila gang LowKeyLad. Jeho území se vrací pod kontrolu města.",
      avatarSrc: "../img/avatars/lowkey.jpg",
      districtsNeutralized: 4,
      remainingPlayers: 17,
      serverCapacity: 20
    }, trigger);

    expect(fixture.popup.hidden).toBe(false);
    expect(fixture.root.ownerDocument.body.classList.add).toHaveBeenCalledWith("elimination-result-popup-open");
    expect(fixture.card.focus).toHaveBeenCalled();
    expect(fixture.body.innerHTML).toContain("Očista proběhla:");
    expect(fixture.body.innerHTML).toContain("<span>LowKeyLad</span>");
    expect(fixture.body.innerHTML).toContain("Policie rozdrtila gang LowKeyLad.");
    expect(fixture.body.innerHTML).not.toContain("Jeho území se vrací pod kontrolu města.");
    expect(fixture.body.innerHTML).toContain("../img/avatars/lowkey.jpg");
    expect(fixture.body.innerHTML).toContain("Status:");
    expect(fixture.body.innerHTML).toContain("Gang eliminován");
    expect(fixture.body.innerHTML).toContain("Důsledek:");
    expect(fixture.body.innerHTML).toContain("Území patří znovu městu");
    expect(fixture.body.innerHTML).toContain("Zbývá hráčů:");
    expect(fixture.body.innerHTML).toContain("17/20");
    expect(fixture.body.innerHTML).not.toContain("lockdownu");
    expect(fixture.body.innerHTML).not.toContain("Území v lockdownu");
    expect(fixture.body.innerHTML).not.toContain("Policejní kontrola");

    fixture.documentListeners.get("keydown")({ key: "Escape", preventDefault: vi.fn() });
    expect(fixture.popup.hidden).toBe(true);
    expect(trigger.focus).toHaveBeenCalled();
  });

  it("lets players enlarge the eliminated avatar before closing the popup", () => {
    const fixture = createResultPopupFixture();
    const avatarTarget = createTarget("[data-elimination-result-popup-avatar]");
    const runtime = bindEliminationResultPopup(fixture.root);

    runtime.open({
      gangName: "LowKeyLad",
      avatarSrc: "../img/avatars/Mafia/grok_image_1773619750005.jpg"
    });

    fixture.listeners.get("click")({ target: avatarTarget, preventDefault: vi.fn() });
    expect(fixture.card.classList.toggle).toHaveBeenCalledWith("is-avatar-expanded");
    expect(fixture.cardClasses.has("is-avatar-expanded")).toBe(true);

    fixture.documentListeners.get("keydown")({ key: "Escape", preventDefault: vi.fn() });
    expect(fixture.popup.hidden).toBe(false);
    expect(fixture.cardClasses.has("is-avatar-expanded")).toBe(false);

    fixture.documentListeners.get("keydown")({ key: "Escape", preventDefault: vi.fn() });
    expect(fixture.popup.hidden).toBe(true);
  });

  it("formats eliminated player count fallbacks without fake values", () => {
    const withCapacity = renderEliminationResultPopupBody({
      gangName: "LowKeyLad",
      remainingPlayers: 17,
      serverCapacity: 20
    });
    const withoutCapacity = renderEliminationResultPopupBody({
      gangName: "LowKeyLad",
      remainingPlayers: 17
    });
    const withoutRemaining = renderEliminationResultPopupBody({
      gangName: "LowKeyLad"
    });

    expect(withCapacity).toContain("17/20");
    expect(withoutCapacity).toContain("17 hráčů");
    expect(withoutRemaining).toContain("—");
    expect(withCapacity).not.toContain("OČISTA DOKONČENA");
    expect(withCapacity).not.toContain("Jeho území se vrací pod kontrolu města.");
    expect(withCapacity).not.toContain("Režim:");
    expect(withCapacity).not.toContain("Území v lockdownu");
  });

  it("blocks script avatar URLs in the eliminated gang result popup", () => {
    const html = renderEliminationResultPopupBody({
      gangName: "<script>alert(1)</script>",
      avatarSrc: "java\nscript:alert(1)",
      avatarFallback: "A&B",
      title: "<img src=x onerror=alert(1)>",
      body: "Gang & crew",
      districtsNeutralized: 1
    });

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:alert");
    expect(html).not.toContain("<img src=");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Gang &amp; crew");
  });

  it("shows the global red warning only for the last five minutes and restarts after zero", () => {
    const fixture = createCountdownWarningFixture();
    let currentTime = 0;
    let intervalCallback = null;
    const onCountdownElapsed = vi.fn(() => ({
      avatarSrc: "../img/avatars/lowkey.jpg",
      districtsNeutralized: 4
    }));
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
      timerApi,
      onCountdownElapsed
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
    expect(onCountdownElapsed).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 3,
      gangName: "LowKeyLad",
      title: "Očista proběhla: LowKeyLad"
    }), expect.any(Object));
    expect(fixture.root.ownerDocument.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "empire:elimination-resolved"
    }));
    expect(timerApi.clearInterval).not.toHaveBeenCalled();
  });

  it("lets players close the warning and reopens it for the final minute", () => {
    const fixture = createCountdownWarningFixture();
    let currentTime = 0;
    let intervalCallback = null;
    const timerApi = {
      now: vi.fn(() => currentTime),
      setInterval: vi.fn((callback) => {
        intervalCallback = callback;
        return 10;
      }),
      clearInterval: vi.fn()
    };

    bindEliminationCountdownWarning(fixture.root, {
      initialCountdownMs: 300000,
      resetCountdown: true,
      timerApi
    });

    expect(fixture.warning.hidden).toBe(false);
    expect(fixture.timeNode.textContent).toBe("5min 00s");

    fixture.closeListeners.get("click")({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(fixture.warning.hidden).toBe(true);

    currentTime = 239000;
    intervalCallback();
    expect(fixture.warning.hidden).toBe(true);
    expect(fixture.timeNode.textContent).toBe("1min 01s");

    currentTime = 240000;
    intervalCallback();
    expect(fixture.warning.hidden).toBe(false);
    expect(fixture.timeNode.textContent).toBe("1min 00s");

    fixture.closeListeners.get("click")({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    currentTime = 250000;
    intervalCallback();
    expect(fixture.warning.hidden).toBe(true);
    expect(fixture.timeNode.textContent).toBe("50s");
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
      title: state === "final" ? "FINAL LOCKDOWN" : "OČISTA / PURGE OKNO",
      unitLabel: state === "final" ? "PURGE-LOCK" : "PURGE-07"
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
