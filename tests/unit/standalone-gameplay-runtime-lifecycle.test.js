// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CITY_EVENTS_MODULE = "../../page-assets/js/app/city-events-runtime.js";
const BOUNTY_MODULE = "../../page-assets/js/app/bounty-runtime.js";

let cityEventsModule;
let bountyModule;

describe("standalone gameplay runtime lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    cityEventsModule = null;
    bountyModule = null;
    window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "server-authoritative";
    document.documentElement.dataset.gameplayExecutionMode = "server-authoritative";
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    cityEventsModule?.destroyCityEventsRuntime();
    bountyModule?.destroyBountyRuntime();
    vi.useRealTimers();
    delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__;
    delete window.__EMPIRE_GAMEPLAY_AUTHORITY_MATRIX__;
    delete window.__EMPIRE_CONFLICT_AUTHORITY_MATRIX__;
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.empireStreetsBountyState;
    document.documentElement.removeAttribute("data-gameplay-execution-mode");
    document.body.replaceChildren();
  });

  it("destroys and remounts city events once across page lifecycle cycles", async () => {
    document.body.innerHTML = `
      <main data-page="game">
        <button id="city-events-open" type="button">Události</button>
        <section id="events-modal" class="hidden" hidden>
          <div id="events-tasklist"></div>
        </section>
        <section id="event-detail-modal" class="hidden" hidden></section>
      </main>
    `;
    cityEventsModule = await import(CITY_EVENTS_MODULE);
    const openButton = document.getElementById("city-events-open");
    const modal = document.getElementById("events-modal");
    let openEvents = 0;
    document.addEventListener("empire:city-events-opened", () => {
      openEvents += 1;
    });

    expect(cityEventsModule.initCityEventsRuntime()).toBe(false);
    openButton.click();
    expect(modal.hidden).toBe(false);
    expect(openEvents).toBe(1);

    window.dispatchEvent(new Event("pagehide"));
    expect(modal.hidden).toBe(true);
    openButton.click();
    expect(modal.hidden).toBe(true);
    expect(openEvents).toBe(1);

    window.dispatchEvent(new Event("pageshow"));
    expect(cityEventsModule.initCityEventsRuntime()).toBe(false);
    openButton.click();
    expect(modal.hidden).toBe(false);
    expect(openEvents).toBe(2);

    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    openButton.click();
    expect(openEvents).toBe(3);
  });

  it("keeps one bounty timer and listener set across page lifecycle cycles", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    window.empireStreetsGameplaySliceReadModel = {
      bounty: {
        minRewardCleanCash: 5_000,
        durationOptionsHours: [1, 6, 12, 24],
        currentPlayerCleanCash: 25_000,
        eligibleTargets: [{
          playerId: "target-1",
          name: "Target",
          activeDistrictCount: 1,
          canTarget: true,
          districts: [{ districtId: "district-1", name: "District 1", zone: "Downtown" }]
        }],
        activeBounties: [],
        recentBountyEvents: []
      }
    };
    document.body.innerHTML = `
      <main data-page="game">
        <button data-bounty-open-trigger type="button">Bounty</button>
        <section id="bounty-modal" class="hidden" hidden>
          <button id="bounty-modal-close" type="button"></button>
          <button id="bounty-modal-cancel" type="button"></button>
          <select id="bounty-modal-target"></select>
          <select id="bounty-modal-district"></select>
          <div id="bounty-district-field"></div>
          <input id="bounty-cash-range" type="range">
          <input id="bounty-cash-input" type="number">
          <span id="bounty-cash-available"></span>
          <input id="bounty-anonymous-input" type="checkbox">
          <span id="bounty-preview-target"></span>
          <span id="bounty-preview-value"></span>
          <span id="bounty-preview-type"></span>
          <span id="bounty-preview-duration"></span>
          <span id="bounty-preview-anonymous"></span>
          <span id="bounty-target-name"></span>
          <span id="bounty-target-alliance"></span>
          <span id="bounty-target-districts"></span>
          <span id="bounty-target-activity"></span>
          <span id="bounty-target-threat"></span>
          <img id="bounty-target-avatar" alt="">
          <span id="bounty-target-avatar-fallback"></span>
          <span id="bounty-target-status"></span>
          <button id="bounty-modal-submit" type="button"></button>
          <table><tbody id="bounty-board-body"></tbody></table>
          <div id="bounty-board-empty"></div>
        </section>
        <section id="bounty-confirm-modal" class="hidden" hidden>
          <span id="bounty-confirm-target"></span>
          <span id="bounty-confirm-type"></span>
          <span id="bounty-confirm-value"></span>
          <span id="bounty-confirm-duration"></span>
          <span id="bounty-confirm-anonymous"></span>
          <button id="bounty-confirm-modal-submit" type="button"></button>
        </section>
      </main>
    `;

    bountyModule = await import(BOUNTY_MODULE);
    const openButton = document.querySelector("[data-bounty-open-trigger]");
    const modal = document.getElementById("bounty-modal");
    const mountedCleanup = bountyModule.initBountyRuntime();
    const initialIntervalCalls = setIntervalSpy.mock.calls.length;
    const initialClearIntervalCalls = clearIntervalSpy.mock.calls.length;

    expect(typeof mountedCleanup).toBe("function");
    openButton.click();
    expect(modal.hidden).toBe(false);
    expect(setIntervalSpy).toHaveBeenCalledTimes(initialIntervalCalls + 1);

    window.dispatchEvent(new Event("pagehide"));
    expect(modal.hidden).toBe(true);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(initialClearIntervalCalls + 1);
    openButton.click();
    expect(modal.hidden).toBe(true);

    window.dispatchEvent(new Event("pageshow"));
    const remountedCleanup = bountyModule.initBountyRuntime();
    expect(remountedCleanup).toBeTypeOf("function");
    expect(remountedCleanup).not.toBe(mountedCleanup);
    openButton.click();
    expect(modal.hidden).toBe(false);
    expect(setIntervalSpy).toHaveBeenCalledTimes(initialIntervalCalls + 2);

    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    openButton.click();
    expect(modal.hidden).toBe(false);
    expect(setIntervalSpy).toHaveBeenCalledTimes(initialIntervalCalls + 3);
  });
});
