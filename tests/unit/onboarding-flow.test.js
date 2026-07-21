import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import {
  createOnboardingReadModel,
  resolveOnboardingStepState
} from "../../page-assets/js/app/runtime/onboardingReadModel.js";
import {
  createOnboardingBridge,
  resolveOnboardingStorageKey,
  serializeOnboardingProgress,
  skipOnboardingProgress,
  updateOnboardingProgress
} from "../../page-assets/js/app/runtime/onboardingBridge.js";
import {
  ONBOARDING_REQUIRED_STEP_IDS,
  ONBOARDING_STEPS
} from "../../page-assets/js/app/runtime/onboardingStepRegistry.js";
import {
  normalizeOnboardingProgress,
  renderOnboardingPanel,
  shouldAutoStartOnboarding
} from "../../page-assets/js/app/ui/onboardingPanel.js";

function createRoot(foundSelectors = []) {
  const selectors = new Set(foundSelectors);
  return {
    querySelector(selector) {
      return String(selector || "")
        .split(",")
        .map((item) => item.trim())
        .some((item) => selectors.has(item))
        ? { getBoundingClientRect: () => ({ left: 1, top: 2, width: 30, height: 40 }) }
        : null;
    }
  };
}

function createOnboardingDom() {
  const dom = new JSDOM(`<!doctype html><body>
    <header id="game-header" class="game-topbar">
      <section class="game-resource-strip">
        <strong data-topbar-clean-money>5000</strong>
        <strong data-topbar-influence>5</strong>
      </section>
    </header>
    <main id="game-root">
      <section id="game-map-stage">
        <div class="map-stage-actions map-stage-actions--desktop">
          <button type="button" class="map-boost-btn map-boost-btn--desktop" data-boost-open-trigger>Boost</button>
        </div>
        <div class="map-phase-toolbar">
          <button type="button" class="map-bounty-shortcut" data-bounty-open-trigger>Bounty</button>
        </div>
        <div class="map-stage-actions map-stage-actions--mobile">
          <button type="button" class="map-boost-btn" data-boost-open-trigger>Boost</button>
        </div>
        <section id="game-map-mount" data-mount-role="map">
          <div class="map-viewport" data-map-viewport>
            <div class="map-canvas-shell" data-map-canvas>
              <canvas class="map-district-canvas" data-district-canvas data-testid="district-canvas" width="1600" height="980"></canvas>
            </div>
          </div>
        </section>
      </section>
      <aside id="game-rail-left">
        <div id="game-left-nav" class="panel-action-stack">
          <section id="city-events-card" class="city-events-card" aria-label="City Events">
            <button id="city-events-open" type="button">City Events</button>
          </section>
          <section id="buildings-card" class="feature-card feature-card--buildings" aria-label="Správa budov">
            <button type="button" data-buildings-popup-open>Budovy</button>
          </section>
          <section id="market-card" class="feature-card feature-card--market" aria-label="Obchod a trh">
            <button type="button" data-market-popup-open>Bazar</button>
          </section>
          <div id="building-shortcut-grid" class="building-shortcut-grid" aria-label="Rychlé budovy">
            <button type="button" class="building-shortcut-button building-shortcut-button--pharmacy" data-pharmacy-popup-open>Lékárna</button>
            <button type="button" class="building-shortcut-button building-shortcut-button--druglab" data-druglab-popup-open>Lab</button>
            <button type="button" class="building-shortcut-button building-shortcut-button--factory" data-factory-popup-open>Továrna</button>
            <button type="button" class="building-shortcut-button building-shortcut-button--armory" data-armory-popup-open>Zbrojovka</button>
          </div>
        </div>
      </aside>
      <aside id="game-rail-right">
        <section id="game-gang-panel-mount" data-mount-role="gang-panel">
          <div id="profile-gang-card" class="right-panel-card">
            <p class="panel-note gang-profile-stars" aria-label="Gang level" data-gang-stars>
              <span class="is-active" data-gang-star>★</span>
              <span data-gang-star>★</span>
            </p>
            <p class="panel-note profile-row profile-row--members gang-profile-row"><span class="gang-profile-row__label">Členové</span><span data-gang-members>0</span></p>
            <p class="panel-note profile-row profile-row--wanted gang-profile-row"><span class="gang-profile-row__label">Hledanost</span><button data-gang-heat>10</button></p>
            <p class="panel-note profile-row profile-row--faction gang-profile-row"><span class="gang-profile-row__label">Frakce</span><span data-gang-faction>-</span></p>
            <p class="panel-note profile-row profile-row--districts gang-profile-row"><span class="gang-profile-row__label">Distrikty</span><span data-gang-districts>0</span></p>
            <p class="panel-note profile-row profile-row--alliance gang-profile-row"><span class="gang-profile-row__label">Aliance</span><span data-gang-alliance>Žádná</span></p>
          </div>
        </section>
        <section id="alliance-chat-card" class="right-panel-card">
          <button type="button" id="alliance-btn" data-alliance-popup-open>Aliance</button>
        </section>
      </aside>
      <button data-building-action-building-id="b1" data-building-action-id="collect"></button>
      <button data-gang-heat></button>
      <button data-district-action-id="spy"></button>
      <button data-district-action-id="attack"></button>
    </main>
  </body>`);
  const { document } = dom.window;
  for (const element of document.querySelectorAll("*")) {
    element.getBoundingClientRect = () => ({ left: 24, top: 32, width: 120, height: 44, right: 144, bottom: 76 });
    element.scrollIntoView = () => {};
  }
  const mapCanvas = document.querySelector("[data-district-canvas]");
  if (mapCanvas) {
    mapCanvas.getBoundingClientRect = () => ({ left: 80, top: 110, width: 640, height: 392, right: 720, bottom: 502 });
  }
  const mapNavigation = {
    resetZoom: vi.fn(() => true),
    getState: () => ({ scale: 1, x: 0, y: 0 })
  };
  document.querySelector("[data-map-viewport]").empireStreetsMapNavigation = mapNavigation;
  document.querySelector("[data-map-canvas]").empireStreetsMapNavigation = mapNavigation;
  dom.window.empireStreetsMapNavigation = mapNavigation;
  dom.window.empireStreetsDistrictState = {
    getDistrictById: (districtId) => {
      const districts = {
        1: {
          id: 1,
          centerX: 260,
          centerY: 310,
          polygon: [
            { x: 210, y: 270 },
            { x: 310, y: 270 },
            { x: 315, y: 350 },
            { x: 215, y: 354 }
          ]
        },
        2: {
          id: 2,
          centerX: 420,
          centerY: 330,
          polygon: [
            { x: 372, y: 286 },
            { x: 466, y: 290 },
            { x: 470, y: 370 },
            { x: 376, y: 374 }
          ]
        }
      };
      return districts[Number(districtId)] || null;
    }
  };
  return {
    document,
    root: document.getElementById("game-root"),
    mount: document.createElement("section"),
    mapNavigation
  };
}

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key: (index) => Array.from(store.keys())[index] || null,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
}

function collectText(element) {
  return String(element?.textContent || "").replace(/\s+/gu, " ").trim();
}

describe("Empire onboarding flow", () => {
  it("step registry contains every mandatory onboarding chapter", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([...ONBOARDING_REQUIRED_STEP_IDS]);
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "your-district",
      "building-action",
      "heat-police",
      "production-choice",
      "alliance-guide",
      "bounty-boost-guide",
      "spy",
      "attack-order",
      "done"
    ]);
    expect(ONBOARDING_STEPS).toHaveLength(10);
    expect(ONBOARDING_STEPS[0]?.id).toBe("welcome");
    expect(ONBOARDING_STEPS.at(-1)?.id).toBe("done");
    const originalStepCopy = [
      { id: "welcome", title: "Vítej v Empire streets", body: "Tento krátký návod ti ukáže první kroky a základní mechaniky hry a vysvětlí o co ve hře jde. Pokud jsi ve hře nový nebo si chceš zopakovat základy tak klikni prosím na Začít.", cta: "Začít" },
      { id: "your-district", title: "Horní lišta", body: "Nahoře můžeš najít svůj profil kde uvidíš vše důležité, taky čisté peníze, špinavé peníze, svůj Vliv a při kliknutí na něj kolik máš dostupných špehů a taky SKLAD kde najdeš přehled o surovinách a zbraních které máš k dispozici.", cta: "Další" },
      { id: "building-action", title: "Panel tvého gangu", body: "Tady vidíš tvoji populaci, ta je palivem pro obsazování districtů, pro útok, pro obranu. Hledanost neboli Heat, tento ukazatel ti dává informaci jak moc blízko jsi průseru, policie tady funguje jako predátor každou hodinu u někoho vyvolá razii, číslo je klikatelné a roste díky tvojemu špinavému biznisu a chování ve hře.", cta: "Rozumím" },
      { id: "heat-police", title: "Zdroje", body: "Eventy, budovy, bazar a speciální budovy drží tvůj gang při životě. Hra má přes 30 typů budov a 5 různých typů districtů. V každém districtu je okolo 2-3 budov. Produkuj biznis, recykluj, vydělávej, vyráběj, prodávej a plň různé úkoly! Ale pozor nic není zadarmo. Budovy lze upgradovat, třeba je vybírat a některé mají taky speciální akce. Každá akce má reakci.", cta: "Rozumím" },
      { id: "spy", title: "Pošli špehy", body: "Sousední districty můžeš špehovat, vykrádat, po úspěšném špehování obsazovat a na nepřátelské districty můžeš útočit, případně je zcela zničit. Dávej pozor i tady policie není slepá! Klikni na District 2, vyšli špeha a potvrď misi.", cta: "Rozumím" },
      { id: "attack-order", title: "Vlož past", body: "V každém districtu máš různé typy budov, když jich máš víc tak se navzájem posilňují. Taky můžeš dát do svého districtu obranu ve formě svých lidí a obranných zbraní nebo past. Jednu tam vyzkoušej vložit, pokud zautočí hráč na district ve kterém máš past příjde o celý útok a možnost na nějakou dobu útočit!", cta: "Rozumím" },
      { id: "done", title: "Eliminace", body: "Každé 4h reálného času (dva dny a dvě noci ve hře) probíhá eliminace tzv. Očista - Tvůj vliv, počet obyvatel, materiálů, districtů nebo například jak bohatý jsi počítá Empire score a nejslabší vypadává. Dokud hráčů není posledních 8 pak příjde final lockdown který trvá 12h a Empire score rozhodne o vítězi! Už je to na tobě jakou cestu zvolíš či sám nebo v Alianci, či čistě nebo cestou padoucha. Můžeš taky používat bounty nebo boosty které najdeš nad mapou. Základy znáš, hodně štěstí!", cta: "Pokračovat" }
    ];
    expect(ONBOARDING_STEPS
      .filter((step) => originalStepCopy.some((expected) => expected.id === step.id))
      .map(({ id, title, body, cta }) => ({ id, title, body, cta })))
      .toEqual(originalStepCopy);
    expect(ONBOARDING_STEPS.find((step) => step.id === "building-action")?.completionCondition).toBe("manual");
    const districtStep = ONBOARDING_STEPS.find((step) => step.id === "your-district");
    const buildingActionStep = ONBOARDING_STEPS.find((step) => step.id === "building-action");
    const resourcesStep = ONBOARDING_STEPS.find((step) => step.id === "heat-police");
    expect(districtStep?.targetSelector).toContain("#game-header");
    expect(districtStep?.targetSelector).toContain("#profile-gang-card");
    expect(districtStep?.targetSelector).not.toMatch(/canvas|\[data-map-canvas\]/iu);
    expect(districtStep?.focusSelectors).toHaveLength(2);
    expect(districtStep?.focusBackdrop).toBe(true);
    expect(districtStep?.raiseFocusTargets).toBe(true);
    expect(districtStep?.showTargetRing).toBe(false);
    expect(districtStep?.scrollPageTopOnEnter).toBe(true);
    expect(districtStep?.placement).toBe("center");
    expect(districtStep?.completionCondition).toBe("manual");
    expect(buildingActionStep?.targetSelector).toContain("[data-gang-stars]");
    expect(buildingActionStep?.targetSelector).toContain(".gang-profile-row");
    expect(buildingActionStep?.targetSelector).not.toMatch(/game-gang-panel-mount|building-action|building-card|district-popup-buildings/iu);
    expect(buildingActionStep?.focusSelectors).toContain("#profile-gang-card .gang-profile-row");
    expect(buildingActionStep?.focusSelectors).toHaveLength(4);
    expect(buildingActionStep?.focusBackdrop).toBe(true);
    expect(buildingActionStep?.focusBackdropHoleSelector).toBe("#profile-gang-card");
    expect(buildingActionStep?.focusBackdropPadding).toBe(8);
    expect(buildingActionStep?.scrollFocusIntoView).toBe(true);
    expect(buildingActionStep?.placement).toBe("center");
    expect(buildingActionStep?.raiseFocusTargets).toBe(true);
    expect(buildingActionStep?.showTargetRing).toBe(false);
    expect(resourcesStep?.targetSelector).toContain("#city-events-card");
    expect(resourcesStep?.targetSelector).toContain("#buildings-card");
    expect(resourcesStep?.targetSelector).toContain("#market-card");
    expect(resourcesStep?.targetSelector).toContain("#building-shortcut-grid");
    expect(resourcesStep?.targetSelector).not.toMatch(/gang-heat|police|wanted|heat/iu);
    expect(resourcesStep?.focusSelectors).toContain("#game-rail-left");
    expect(resourcesStep?.focusSelectors).toContain("#game-left-nav");
    expect(resourcesStep?.focusSelectors).toHaveLength(6);
    expect(resourcesStep?.focusBackdrop).toBe(true);
    expect(resourcesStep?.focusBackdropHoleSelector).toBe("#game-left-nav");
    expect(resourcesStep?.focusBackdropPadding).toBe(8);
    expect(resourcesStep?.scrollFocusIntoView).toBe(true);
    expect(resourcesStep?.scrollFocusSelector).toBe("#building-shortcut-grid");
    expect(resourcesStep?.scrollFocusBlock).toBe("end");
    expect(resourcesStep?.scrollFocusInline).toBe("nearest");
    expect(resourcesStep?.scrollFocusMaxWidth).toBe(900);
    expect(resourcesStep?.raiseFocusTargets).toBe(true);
    expect(resourcesStep?.showTargetRing).toBe(false);
    expect(resourcesStep?.completionCondition).toBe("manual");
    const productionStep = ONBOARDING_STEPS.find((step) => step.id === "production-choice");
    expect(productionStep).toEqual(expect.objectContaining({
      completionCondition: "manual",
      cta: "Rozumím",
      focusBackdrop: true,
      raiseFocusTargets: true,
      showTargetRing: false
    }));
    expect(productionStep?.targetSelector).toContain("#building-shortcut-grid");
    expect(productionStep?.focusSelectors).toEqual(expect.arrayContaining([
      "#building-shortcut-grid [data-pharmacy-popup-open]",
      "#building-shortcut-grid [data-druglab-popup-open]",
      "#building-shortcut-grid [data-factory-popup-open]",
      "#building-shortcut-grid [data-armory-popup-open]"
    ]));
    expect(productionStep?.body).toMatch(/Výroba neběží sama/u);
    expect(productionStep?.body).toMatch(/vyber konkrétní recept/u);
    expect(productionStep?.body).toMatch(/vstupy, čas a volný výrobní slot/u);
    expect(productionStep?.body).toContain("SKLADU");
    const allianceStep = ONBOARDING_STEPS.find((step) => step.id === "alliance-guide");
    expect(allianceStep).toEqual(expect.objectContaining({
      completionCondition: "manual",
      cta: "Rozumím",
      focusBackdrop: true,
      raiseFocusTargets: true,
      showTargetRing: false
    }));
    expect(allianceStep?.targetSelector).toContain("#alliance-btn");
    expect(allianceStep?.focusSelectors).toEqual(expect.arrayContaining([
      "#game-rail-right",
      "#alliance-chat-card",
      "#alliance-btn"
    ]));
    expect(allianceStep?.body).toMatch(/chatu/u);
    expect(allianceStep?.body).toMatch(/spolupráci/u);
    expect(allianceStep?.body).toMatch(/skutečné zásoby/u);
    const bountyBoostStep = ONBOARDING_STEPS.find((step) => step.id === "bounty-boost-guide");
    expect(bountyBoostStep).toEqual(expect.objectContaining({
      completionCondition: "manual",
      cta: "Rozumím",
      focusBackdrop: true,
      raiseFocusTargets: true,
      showTargetRing: false
    }));
    expect(bountyBoostStep?.targetSelector).toContain("[data-bounty-open-trigger]");
    expect(bountyBoostStep?.targetSelector).toContain("[data-boost-open-trigger]");
    expect(bountyBoostStep?.focusSelectors).toEqual(expect.arrayContaining([
      "[data-bounty-open-trigger]",
      "[data-boost-open-trigger]"
    ]));
    expect(bountyBoostStep?.body).toMatch(/Odměna se při vypsání zamkne/u);
    expect(bountyBoostStep?.body).toContain("Ghost Network");
    expect(bountyBoostStep?.body).toContain("Industrial Overdrive");
    expect(bountyBoostStep?.body).toContain("Tactical Grid");
    const spyStep = ONBOARDING_STEPS.find((step) => step.id === "spy");
    expect(spyStep?.placement).toBe("center");
    expect(spyStep?.targetSelector).toContain("[data-map-viewport]");
    expect(spyStep?.targetSelector).not.toMatch(/district-action-id="spy"|spy-confirm/iu);
    expect(spyStep?.mapViewMode).toBe("zoom-out");
    expect(spyStep?.mapDistrictHighlights).toEqual([
      { districtId: 2, tone: "pulse", label: "District 2" }
    ]);
    expect(spyStep?.scrollFocusSelector).toContain("[data-map-viewport]");
    expect(spyStep?.focusBackdrop).toBe(true);
    expect(spyStep?.focusBackdropHoleSelector).toBe("[data-map-viewport]");
    expect(spyStep?.focusBackdropPadding).toBe(6);
    expect(spyStep?.lockBackgroundScroll).toBe(true);
    expect(spyStep?.showTargetRing).toBe(false);
    const attackOrderStep = ONBOARDING_STEPS.find((step) => step.id === "attack-order");
    expect(attackOrderStep?.placement).toBe("center");
    expect(attackOrderStep?.targetSelector).toContain("[data-map-viewport]");
    expect(attackOrderStep?.targetSelector).not.toMatch(/district-action-id="attack"|attack-confirm/iu);
    expect(attackOrderStep?.mapViewMode).toBe("zoom-out");
    expect(attackOrderStep?.mapDistrictHighlights).toEqual([
      { districtId: 1, tone: "pulse", label: "District 1" }
    ]);
    expect(attackOrderStep?.scrollFocusSelector).toContain("[data-map-viewport]");
    expect(attackOrderStep?.focusBackdrop).toBe(true);
    expect(attackOrderStep?.focusBackdropHoleSelector).toBe("[data-map-viewport]");
    expect(attackOrderStep?.focusBackdropPadding).toBe(6);
    expect(attackOrderStep?.lockBackgroundScroll).toBe(true);
    expect(attackOrderStep?.showTargetRing).toBe(false);
    expect(attackOrderStep?.completionCondition).toBe("trap:moved");
    const doneStep = ONBOARDING_STEPS.find((step) => step.id === "done");
    expect(doneStep?.targetSelector).toBeNull();
    expect(doneStep?.placement).toBe("center");
    expect(doneStep?.focusBackdrop).toBe(true);
    expect(doneStep?.showTargetRing).toBe(false);
    expect(attackOrderStep?.bodyHighlights).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "past", tone: "green" })
    ]));
    expect(doneStep?.bodyHighlights).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "bounty", tone: "red" }),
      expect.objectContaining({ text: "Očista", tone: "red" }),
      expect.objectContaining({ text: "Empire score", tone: "gold" })
    ]));
  });

  it("every onboarding step has the required registry fields and compact player-facing copy", () => {
    const forbiddenCopy = /server-authoritative|runtime|localStorage|slice|selector|started|confirm dialog/i;
    const bodyLengthLimits = {
      welcome: 190,
      "your-district": 260,
      "building-action": 380,
      "heat-police": 390,
      "production-choice": 300,
      "alliance-guide": 330,
      "bounty-boost-guide": 460,
      spy: 300,
      "attack-order": 340,
      done: 560
    };
    const sentenceLimits = {
      welcome: 2,
      "your-district": 2,
      "building-action": 2,
      "heat-police": 7,
      "production-choice": 4,
      "alliance-guide": 4,
      "bounty-boost-guide": 7,
      spy: 5,
      "attack-order": 5,
      done: 7
    };
    for (const step of ONBOARDING_STEPS) {
      expect(step.title).toEqual(expect.any(String));
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.title.length).toBeLessThanOrEqual(24);
      expect(step.body).toEqual(expect.any(String));
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.body.length).toBeLessThanOrEqual(bodyLengthLimits[step.id]);
      expect(step.body.split(/[.!?]+/u).filter((part) => part.trim()).length).toBeLessThanOrEqual(sentenceLimits[step.id]);
      expect(step.bodyParagraphs).toEqual(expect.any(Array));
      expect(step.bodyParagraphs.length).toBeGreaterThanOrEqual(2);
      expect(step.bodyHighlights).toEqual(expect.any(Array));
      expect(step.bodyHighlights.length).toBeGreaterThanOrEqual(2);
      expect(step).toEqual(expect.objectContaining({
        id: expect.any(String),
        phase: expect.any(String),
        badge: expect.any(String),
        kind: expect.any(String),
        placement: expect.any(String),
        completionCondition: expect.any(String),
        canSkip: expect.any(Boolean),
        highlightType: expect.any(String)
      }));
      expect(step.subtitle ?? "").toEqual(expect.any(String));
      expect(step).toHaveProperty("targetSelector");
      expect(step.phase.length).toBeGreaterThan(0);
      expect(step.badge.length).toBeGreaterThan(0);
      expect(["dirty", "objective", "map", "intel", "money", "resource", "danger", "system"]).toContain(step.kind);
      expect([step.title, step.subtitle, step.body, step.fallbackTitle, step.fallbackBody, step.task, ...(step.summaryItems || [])].join(" "))
        .not.toMatch(forbiddenCopy);
      if (step.fallbackBody) {
        expect(step.fallbackBody.length).toBeLessThanOrEqual(80);
      }
    }

    const done = ONBOARDING_STEPS.find((step) => step.id === "done");
    expect(done?.summaryItems || []).toHaveLength(0);
  });

  it("renders progress, CTA, skip and a compact game UI panel for every onboarding step", () => {
    for (const [index, step] of ONBOARDING_STEPS.entries()) {
      const { document, root, mount, mapNavigation } = createOnboardingDom();
      root.append(mount);
      const isMapOnboardingStep = step.id === "spy" || step.id === "attack-order";
      const hasFocusCutout = Boolean(step.focusBackdropHoleSelector);

      expect(renderOnboardingPanel({ currentStepId: step.id }, {}, { mount, root, readModel: {} })).toBe(true);
      expect(mapNavigation.resetZoom).toHaveBeenCalledTimes(isMapOnboardingStep ? 1 : 0);

      const text = collectText(mount);
      expect(text).toContain(`Krok ${index + 1} / ${ONBOARDING_STEPS.length}`);
      expect(text).toContain(step.title);
      const primaryButton = mount.querySelector("[data-onboarding-primary-action]");
      if (isMapOnboardingStep) {
        expect(primaryButton).toBeNull();
      } else {
        expect(primaryButton).toBeTruthy();
        expect(primaryButton?.textContent).toBe(step.cta || "Další");
      }
      expect([...mount.querySelectorAll("button")].some((button) => button.textContent === "Přeskočit")).toBe(true);
      const backButton = mount.querySelector("[data-onboarding-back-action]");
      if (step.id === "welcome") {
        expect(backButton).toBeNull();
      } else {
        expect(backButton).toBeTruthy();
        expect(backButton?.textContent).toBe("Zpět");
        expect(backButton?.disabled).toBe(false);
      }
      const actionButtons = [...mount.querySelectorAll(".empire-onboarding__actions button")].map((button) => button.textContent);
      expect(actionButtons).toEqual(step.id === "welcome"
        ? ["Přeskočit", step.cta || "Další"]
        : (isMapOnboardingStep ? ["Přeskočit", "Zpět"] : ["Přeskočit", "Zpět", step.cta || "Další"]));
      expect(mount.querySelectorAll(".empire-onboarding__body-paragraph").length).toBeGreaterThanOrEqual(2);
      expect(mount.querySelectorAll(".empire-onboarding__body-accent").length).toBeGreaterThanOrEqual(2);
      expect(mount.querySelector(".empire-onboarding__signal")).toBeTruthy();
      expect(mount.querySelector(".empire-onboarding__badge-row")).toBeNull();
      expect(mount.querySelector(".empire-onboarding__status-chip")).toBeNull();
      expect(mount.querySelector(".empire-onboarding__task")).toBeNull();
      const targetRing = document.querySelector("[data-onboarding-highlight]");
      expect(targetRing).toBeTruthy();
      expect(targetRing?.hidden).toBe(step.showTargetRing === false || !step.targetSelector);
      expect(mount.dataset.onboardingStep).toBe(step.id);
      expect(document.documentElement.dataset.onboardingStep).toBe(step.id);
      expect(document.body.dataset.onboardingStep).toBe(step.id);
      const expectedScrollMode = step.id === "welcome" ? "page" : (isMapOnboardingStep ? "locked" : "guided");
      expect(mount.dataset.onboardingScroll).toBe(expectedScrollMode);
      expect(document.documentElement.dataset.onboardingScroll).toBe(expectedScrollMode);
      expect(document.body.dataset.onboardingScroll).toBe(expectedScrollMode);
      expect(document.documentElement.classList.contains("is-onboarding-welcome-scroll")).toBe(step.id === "welcome");
      expect(document.body.classList.contains("is-onboarding-welcome-scroll")).toBe(step.id === "welcome");
      expect(document.documentElement.classList.contains("is-onboarding-guided-scroll")).toBe(step.id !== "welcome" && !isMapOnboardingStep);
      expect(document.body.classList.contains("is-onboarding-guided-scroll")).toBe(step.id !== "welcome" && !isMapOnboardingStep);
      expect(document.documentElement.classList.contains("is-onboarding-scroll-locked")).toBe(isMapOnboardingStep);
      expect(document.body.classList.contains("is-onboarding-scroll-locked")).toBe(isMapOnboardingStep);
      expect(document.documentElement.dataset.onboardingMapMode || "").toBe(isMapOnboardingStep ? "zoom-out" : "");
      const usesBackdrop = step.id === "welcome" || step.focusBackdrop === true;
      const backdrop = document.querySelector("[data-onboarding-backdrop]");
      expect(backdrop).toBeTruthy();
      expect(backdrop?.classList.contains("is-visible")).toBe(usesBackdrop);
      expect(backdrop?.classList.contains("is-focus")).toBe(step.focusBackdrop === true);
      expect(backdrop?.classList.contains("is-cutout")).toBe(hasFocusCutout);
      expect(backdrop?.hidden).toBe(!usesBackdrop);
      expect(backdrop?.dataset.onboardingMode).toBe(step.id === "welcome" ? "welcome" : (step.focusBackdrop === true ? "focus" : "none"));
      expect(backdrop?.dataset.onboardingScroll).toBe(step.id === "welcome" ? "page" : "guided");
      expect(document.querySelectorAll("[data-onboarding-backdrop-mask]")).toHaveLength(hasFocusCutout ? 4 : 0);
      if (step.id === "done") {
        expect(backdrop?.classList.contains("is-visible")).toBe(true);
        expect(backdrop?.classList.contains("is-focus")).toBe(true);
        expect(backdrop?.classList.contains("is-cutout")).toBe(false);
        expect(document.querySelectorAll("[data-onboarding-backdrop-mask]")).toHaveLength(0);
      }
      expect(document.querySelector("#game-header")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "your-district");
      expect(document.querySelector("#game-gang-panel-mount")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "your-district" || step.id === "building-action");
      expect(document.querySelector("#profile-gang-card")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "your-district" || step.id === "building-action");
      expect(document.querySelector("#game-rail-left")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police" || step.id === "production-choice");
      expect(document.querySelector("#game-left-nav")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police" || step.id === "production-choice");
      expect(document.querySelector("#city-events-card")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police");
      expect(document.querySelector("#buildings-card")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police");
      expect(document.querySelector("#market-card")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police");
      expect(document.querySelector("#building-shortcut-grid")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "heat-police" || step.id === "production-choice");
      expect(Array.from(document.querySelectorAll("#building-shortcut-grid .building-shortcut-button")).every((button) =>
        button.classList.contains("is-onboarding-focus-target")
      )).toBe(step.id === "production-choice");
      expect(document.querySelector("#game-rail-right")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "alliance-guide");
      expect(document.querySelector("#alliance-chat-card")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "alliance-guide");
      expect(document.querySelector("#alliance-btn")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "alliance-guide");
      expect(document.querySelector(".map-phase-toolbar")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "bounty-boost-guide");
      expect(document.querySelector(".map-stage-actions--desktop")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "bounty-boost-guide");
      expect(document.querySelector(".map-stage-actions--mobile")?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "bounty-boost-guide");
      expect(Array.from(document.querySelectorAll("[data-bounty-open-trigger], [data-boost-open-trigger]")).every((button) =>
        button.classList.contains("is-onboarding-focus-target")
      )).toBe(step.id === "bounty-boost-guide");
      const gangProfileFocusSelectors = [
        "[data-gang-stars]",
        ".profile-row--members",
        ".profile-row--wanted",
        ".profile-row--faction",
        ".profile-row--districts",
        ".profile-row--alliance"
      ];
      for (const selector of gangProfileFocusSelectors) {
        expect(document.querySelector(selector)?.classList.contains("is-onboarding-focus-target")).toBe(step.id === "building-action");
      }
      expect(Array.from(document.querySelectorAll("#profile-gang-card .gang-profile-row")).every((row) =>
        row.classList.contains("is-onboarding-focus-target")
      )).toBe(step.id === "building-action");
      expect(document.querySelectorAll("[data-onboarding-highlight-extra]")).toHaveLength(0);
      const mapDistrictHighlights = document.querySelectorAll("[data-onboarding-map-district-highlight]");
      expect(mapDistrictHighlights).toHaveLength(isMapOnboardingStep ? 1 : 0);
      if (step.id === "spy") {
        expect(mapDistrictHighlights[0]?.dataset.onboardingMapDistrictId).toBe("2");
        expect(mapDistrictHighlights[0]?.dataset.tone).toBe("pulse");
        expect(mapDistrictHighlights[0]?.hidden).toBe(false);
        expect(mapDistrictHighlights[0]?.querySelector(".empire-onboarding-map-highlight__line")?.getAttribute("points")).toContain("372,286");
        expect(mount.dataset.placementMode).toBe("default");
      }
      if (step.id === "attack-order") {
        expect(mapDistrictHighlights[0]?.dataset.onboardingMapDistrictId).toBe("1");
        expect(mapDistrictHighlights[0]?.dataset.tone).toBe("pulse");
        expect(mapDistrictHighlights[0]?.hidden).toBe(false);
        expect(mapDistrictHighlights[0]?.querySelector(".empire-onboarding-map-highlight__line")?.getAttribute("points")).toContain("210,270");
        expect(mount.dataset.placementMode).toBe("default");
      }
      if (step.id === "your-district" || step.id === "building-action" || isMapOnboardingStep) {
        expect(mount.dataset.placementMode).toBe("default");
        expect(mount.style.left).toBe("");
        expect(mount.style.top).toBe("");
        expect(mount.style.right).toBe("");
        expect(mount.style.bottom).toBe("");
      }
      expect(mount.querySelector(".empire-onboarding__title-accent")?.textContent || "").toBe(step.id === "welcome" ? "streets" : "");
      if (isMapOnboardingStep) {
        expect(primaryButton).toBeNull();
      } else if (step.completionCondition === "manual") {
        expect(mount.querySelector("[data-onboarding-primary-action]")?.dataset.onboardingPrimaryMode).toBe("complete");
      } else {
        expect(mount.querySelector("[data-onboarding-primary-action]")?.dataset.onboardingPrimaryMode).toBe("guide");
      }
    }
  });

  it("does not let the panel CTA complete runtime-gated onboarding steps", () => {
    const { root, mount } = createOnboardingDom();
    const onNext = vi.fn();
    root.append(mount);

    for (const stepId of ["spy", "attack-order"]) {
      expect(renderOnboardingPanel({ currentStepId: stepId }, { onNext }, { mount, root, readModel: {} })).toBe(true);
      mount.querySelector("[data-onboarding-primary-action]")?.click();
      expect(onNext).not.toHaveBeenCalled();
    }
  });

  it("locks background scroll and aligns map-step district highlights to the real canvas on desktop and phone", () => {
    const cases = [
      {
        name: "desktop",
        viewport: { width: 1280, height: 800 },
        canvasRect: { left: 96, top: 144, width: 960, height: 588, right: 1056, bottom: 732 }
      },
      {
        name: "phone",
        viewport: { width: 390, height: 844 },
        canvasRect: { left: 12, top: 96, width: 366, height: 224, right: 378, bottom: 320 }
      }
    ];

    for (const item of cases) {
      const { document, root, mount } = createOnboardingDom();
      Object.defineProperty(document.defaultView, "innerWidth", { value: item.viewport.width, configurable: true });
      Object.defineProperty(document.defaultView, "innerHeight", { value: item.viewport.height, configurable: true });
      const mapViewport = document.querySelector("[data-map-viewport]");
      const mapScroll = vi.fn();
      mapViewport.scrollIntoView = mapScroll;
      const mapCanvas = document.querySelector("[data-district-canvas]");
      mapCanvas.getBoundingClientRect = () => item.canvasRect;
      root.append(mount);

      expect(renderOnboardingPanel({ currentStepId: "spy" }, {}, { mount, root, readModel: {} })).toBe(true);

      const layer = document.querySelector("[data-onboarding-map-district-highlight-layer]");
      expect(layer, item.name).toBeTruthy();
      expect(layer?.style.left).toBe(`${item.canvasRect.left}px`);
      expect(layer?.style.top).toBe(`${item.canvasRect.top}px`);
      expect(layer?.style.width).toBe(`${item.canvasRect.width}px`);
      expect(layer?.style.height).toBe(`${item.canvasRect.height}px`);
      expect(layer?.getAttribute("viewBox")).toBe("0 0 1600 980");
      expect(layer?.dataset.mapCanvasWidth).toBe("1600");
      expect(layer?.dataset.mapCanvasHeight).toBe("980");
      expect(layer?.dataset.mapCanvasLeft).toBe(String(item.canvasRect.left));
      expect(layer?.dataset.mapCanvasTop).toBe(String(item.canvasRect.top));
      expect(layer?.dataset.mapCanvasRectWidth).toBe(String(item.canvasRect.width));
      expect(layer?.dataset.mapCanvasRectHeight).toBe(String(item.canvasRect.height));
      expect(document.documentElement.dataset.onboardingScroll).toBe("locked");
      expect(document.body.dataset.onboardingScroll).toBe("locked");
      expect(document.documentElement.classList.contains("is-onboarding-scroll-locked")).toBe(true);
      expect(document.body.classList.contains("is-onboarding-scroll-locked")).toBe(true);
      expect(mapScroll).not.toHaveBeenCalled();

      const districtTwo = document.querySelector("[data-onboarding-map-district-id=\"2\"] .empire-onboarding-map-highlight__line");
      expect(document.querySelector("[data-onboarding-map-district-id=\"1\"]")).toBeNull();
      expect(districtTwo?.getAttribute("points")).toBe("372,286 466,290 470,370 376,374");

      expect(renderOnboardingPanel({ currentStepId: "attack-order" }, {}, { mount, root, readModel: {} })).toBe(true);
      const attackDistrictOne = document.querySelector("[data-onboarding-map-district-id=\"1\"]");
      const attackDistrictTwo = document.querySelector("[data-onboarding-map-district-id=\"2\"]");
      expect(document.documentElement.dataset.onboardingScroll).toBe("locked");
      expect(document.body.dataset.onboardingScroll).toBe("locked");
      expect(attackDistrictOne?.dataset.tone).toBe("pulse");
      expect(attackDistrictTwo).toBeNull();
    }
  });

  it("scrolls resource buttons to the lower phone viewport without changing desktop scroll", () => {
    const mobile = createOnboardingDom();
    const desktop = createOnboardingDom();
    const mobileScroll = vi.fn();
    const desktopScroll = vi.fn();
    Object.defineProperty(mobile.document.defaultView, "innerWidth", { value: 390, configurable: true });
    Object.defineProperty(desktop.document.defaultView, "innerWidth", { value: 1200, configurable: true });
    mobile.document.querySelector("#building-shortcut-grid").scrollIntoView = mobileScroll;
    desktop.document.querySelector("#building-shortcut-grid").scrollIntoView = desktopScroll;
    mobile.root.append(mobile.mount);
    desktop.root.append(desktop.mount);

    expect(renderOnboardingPanel({ currentStepId: "heat-police" }, {}, { mount: mobile.mount, root: mobile.root, readModel: {} })).toBe(true);
    expect(renderOnboardingPanel({ currentStepId: "heat-police" }, {}, { mount: desktop.mount, root: desktop.root, readModel: {} })).toBe(true);

    expect(mobileScroll).toHaveBeenCalledWith(expect.objectContaining({
      behavior: "auto",
      block: "end",
      inline: "nearest"
    }));
    expect(desktopScroll).not.toHaveBeenCalled();
  });

  it("scrolls to the page top when entering the topbar onboarding step", () => {
    const { document, root, mount } = createOnboardingDom();
    const scrollTo = vi.fn();
    document.defaultView.scrollTo = scrollTo;
    document.documentElement.scrollTop = 420;
    document.documentElement.scrollLeft = 12;
    document.body.scrollTop = 420;
    document.body.scrollLeft = 12;
    root.append(mount);

    expect(renderOnboardingPanel({ currentStepId: "welcome" }, {}, { mount, root, readModel: {} })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();

    expect(renderOnboardingPanel({ currentStepId: "your-district" }, {}, { mount, root, readModel: {} })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto"
    });
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.documentElement.scrollLeft).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(document.body.scrollLeft).toBe(0);
    expect(document.querySelector("#game-header")?.classList.contains("is-onboarding-focus-target")).toBe(true);

    scrollTo.mockClear();
    expect(renderOnboardingPanel({ currentStepId: "your-district" }, {}, { mount, root, readModel: {} })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("lets the gang panel CTA continue to the resources step", () => {
    const { root, mount } = createOnboardingDom();
    const onNext = vi.fn();
    root.append(mount);

    expect(renderOnboardingPanel({ currentStepId: "building-action" }, { onNext }, { mount, root, readModel: {} })).toBe(true);
    mount.querySelector("[data-onboarding-primary-action]")?.click();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith("building-action");
  });

  it("lets the resources CTA continue to the new information steps", () => {
    const { root, mount } = createOnboardingDom();
    const onNext = vi.fn();
    root.append(mount);

    expect(renderOnboardingPanel({ currentStepId: "heat-police" }, { onNext }, { mount, root, readModel: {} })).toBe(true);
    mount.querySelector("[data-onboarding-primary-action]")?.click();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith("heat-police");
  });

  it("lets the back button return to the previous onboarding step", () => {
    const { document, root } = createOnboardingDom();
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        mode: "onboarding",
        world: { ownedDistrictIds: [1] }
      })
    });

    bridge.init();
    document.querySelector("[data-onboarding-primary-action]")?.click();
    document.querySelector("[data-onboarding-primary-action]")?.click();
    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(bridge.getProgress().currentStepId).toBe("heat-police");

    document.querySelector("[data-onboarding-back-action]")?.click();

    expect(bridge.getProgress().currentStepId).toBe("building-action");
    expect(document.querySelector("[data-free-onboarding-panel]")?.dataset.onboardingStep).toBe("building-action");
  });

  it("starts the isolated onboarding state on auto-start and restart", () => {
    const { document, root } = createOnboardingDom();
    const onStart = vi.fn();
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        world: { ownedDistrictIds: [27] }
      }),
      onStart
    });

    bridge.init();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "onboarding" }));

    bridge.restart();
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("keeps the welcome CTA callback scoped to the first step", () => {
    const { document, root } = createOnboardingDom();
    const onWelcomeStart = vi.fn();
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        mode: "onboarding",
        world: { ownedDistrictIds: [1] }
      }),
      onWelcomeStart
    });

    expect(bridge.init().currentStepId).toBe("welcome");
    document.querySelector("[data-onboarding-primary-action]")?.click();

    expect(onWelcomeStart).toHaveBeenCalledTimes(1);
    expect(onWelcomeStart).toHaveBeenCalledWith(expect.objectContaining({
      mode: "onboarding",
      world: { ownedDistrictIds: [1] }
    }));
    expect(bridge.getProgress().currentStepId).toBe("your-district");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(onWelcomeStart).toHaveBeenCalledTimes(1);
    expect(bridge.getProgress().currentStepId).toBe("building-action");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(onWelcomeStart).toHaveBeenCalledTimes(1);
    expect(bridge.getProgress().currentStepId).toBe("heat-police");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(onWelcomeStart).toHaveBeenCalledTimes(1);
    expect(bridge.getProgress().currentStepId).toBe("production-choice");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(bridge.getProgress().currentStepId).toBe("alliance-guide");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(bridge.getProgress().currentStepId).toBe("bounty-boost-guide");

    document.querySelector("[data-onboarding-primary-action]")?.click();
    expect(onWelcomeStart).toHaveBeenCalledTimes(1);
    expect(bridge.getProgress().currentStepId).toBe("spy");
  });

  it("runs step enter setup once when the bridge reaches the spy step", () => {
    const { document, root } = createOnboardingDom();
    const onStepEnter = vi.fn(() => false);
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        mode: "onboarding",
        world: { ownedDistrictIds: [1] }
      }),
      onStepEnter
    });

    bridge.init();
    expect(onStepEnter).toHaveBeenLastCalledWith("welcome", expect.objectContaining({ mode: "onboarding" }));

    for (const stepId of [
      "welcome",
      "your-district",
      "building-action",
      "heat-police",
      "production-choice",
      "alliance-guide",
      "bounty-boost-guide"
    ]) {
      bridge.markDone(stepId);
    }

    expect(bridge.getProgress().currentStepId).toBe("spy");
    expect(onStepEnter).toHaveBeenCalledWith("spy", expect.objectContaining({
      mode: "onboarding",
      progress: expect.objectContaining({ currentStepId: "spy" })
    }));
    const callsAfterSpyEntry = onStepEnter.mock.calls.length;

    document.dispatchEvent(new document.defaultView.CustomEvent("empire:runtime-refresh"));

    expect(onStepEnter).toHaveBeenCalledTimes(callsAfterSpyEntry);
  });

  it("runs completion callback only when the final onboarding CTA is confirmed", () => {
    const { document, root } = createOnboardingDom();
    const onComplete = vi.fn();
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        mode: "onboarding",
        world: { ownedDistrictIds: [1] }
      }),
      onComplete
    });

    bridge.init();
    for (const stepId of [
      "welcome",
      "your-district",
      "building-action",
      "heat-police",
      "production-choice",
      "alliance-guide",
      "bounty-boost-guide",
      "spy",
      "attack-order"
    ]) {
      bridge.markDone(stepId);
      expect(onComplete).not.toHaveBeenCalled();
    }

    bridge.markDone("done");

    expect(bridge.getProgress()).toEqual(expect.objectContaining({
      completed: true,
      currentStepId: "completed"
    }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      mode: "onboarding",
      progress: expect.objectContaining({ completed: true, currentStepId: "completed" })
    }));
  });

  it("runs the completion callback when onboarding is skipped", () => {
    const { document, root } = createOnboardingDom();
    const onComplete = vi.fn();
    const bridge = createOnboardingBridge({
      documentRef: document,
      root,
      storage: createMemoryStorage(),
      getContext: () => ({
        registration: { identity: "Operator" },
        mode: "onboarding",
        world: { ownedDistrictIds: [1] }
      }),
      onComplete
    });

    bridge.init();
    document.querySelector("[data-onboarding-skip-action]")?.click();

    expect(bridge.getProgress()).toEqual(expect.objectContaining({
      completed: true,
      skipped: true,
      currentStepId: "skipped"
    }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      mode: "onboarding",
      progress: expect.objectContaining({ completed: true, skipped: true })
    }));
  });

  it("finds the first owned district in the onboarding read model", () => {
    const readModel = createOnboardingReadModel({
      registration: { identity: "Operator" },
      mode: "onboarding",
      world: { ownedDistrictIds: [27] },
      districts: [
        { id: 12, adjacentDistrictIds: [27] },
        { id: 27, adjacentDistrictIds: [28] },
        { id: 28, adjacentDistrictIds: [27] }
      ]
    });

    expect(readModel.playerId).toBe("Operator");
    expect(readModel.playerStatus).toBe("active");
    expect(readModel.hasOwnedDistrict).toBe(true);
    expect(readModel.firstOwnedDistrictId).toBe("27");
    expect(readModel.suggestedNeighborDistrictId).toBe("28");
  });

  it("returns a safe fallback when the player has no district", () => {
    const readModel = createOnboardingReadModel({
      world: { ownedDistrictIds: [] },
      districts: [{ id: 4, adjacentDistrictIds: [5] }]
    });

    expect(readModel.hasOwnedDistrict).toBe(false);
    expect(readModel.firstOwnedDistrictId).toBeNull();
    expect(readModel.hasNeighborDistricts).toBe(false);
  });

  it("does not auto-start completed onboarding", () => {
    const readModel = createOnboardingReadModel({ world: { ownedDistrictIds: [1] } });
    const progress = normalizeOnboardingProgress({ completed: true, currentStepId: "completed" });

    expect(shouldAutoStartOnboarding(progress, readModel)).toBe(false);
  });

  it("preserves completed progress and existing step IDs after inserting information steps", () => {
    const completed = normalizeOnboardingProgress({
      completed: true,
      skipped: true,
      currentStepId: "completed",
      observedStepIds: ["welcome", "spy"]
    });
    const inProgress = normalizeOnboardingProgress({
      currentStepId: "spy",
      completedStepIds: ["welcome", "your-district"],
      observedStepIds: ["welcome", "your-district", "spy"]
    });

    expect(completed).toEqual(expect.objectContaining({ completed: true, skipped: true, currentStepId: "completed" }));
    expect(inProgress).toEqual(expect.objectContaining({
      completed: false,
      currentStepId: "spy",
      observedStepIds: expect.arrayContaining(["welcome", "your-district", "spy"])
    }));
  });

  it("skip stores the UI state as completed with a skipped current step", () => {
    for (const stepId of ONBOARDING_REQUIRED_STEP_IDS) {
      const progress = skipOnboardingProgress({ currentStepId: stepId });
      expect(progress.completed).toBe(true);
      expect(progress.skipped).toBe(true);
      expect(progress.currentStepId).toBe("skipped");
    }
    expect(resolveOnboardingStorageKey({ registration: { identity: "Boss" }, mode: "onboarding" }))
      .toBe("empire:onboarding:v2:onboarding:Boss");
  });

  it("serializes completed/skipped only as UI preference fields", () => {
    const serialized = serializeOnboardingProgress({
      completed: true,
      skipped: true,
      currentStepId: "skipped",
      dismissedAt: "2026-05-15T00:00:00.000Z",
      gameplayState: { dirtyCash: 999999 }
    });

    expect(Object.keys(serialized).sort()).toEqual(["completed", "currentStepId", "dismissedAt", "observedStepIds", "skipped", "version"]);
    expect(serialized).not.toHaveProperty("gameplayState");
  });

  it("does not mutate gameplay state while resolving onboarding progress", () => {
    const gameplayState = {
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "your-district" }
    };
    const before = JSON.stringify(gameplayState);

    updateOnboardingProgress(gameplayState, { type: "district:own-opened", detail: { district: { id: 1 } } });
    createOnboardingReadModel(gameplayState);

    expect(JSON.stringify(gameplayState)).toBe(before);
  });

  it("records out-of-order demo events without jumping straight to later steps", () => {
    let progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "spy:started",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district"]);
    expect(progress.observedStepIds).toEqual(expect.arrayContaining(["welcome", "your-district", "spy"]));
    expect(progress.completedStepIds).not.toContain("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "district:own-opened",
      detail: { district: { id: 1 } }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district"]);
    expect(progress.completedStepIds).not.toContain("spy");
  });

  it("does not complete Welcome from passive boot police feedback", () => {
    const progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "police:feedback",
      detail: { heat: 35, message: "initial render" }
    });

    expect(progress.currentStepId).toBe("welcome");
    expect(progress.completedStepIds).toEqual([]);
    expect(progress.observedStepIds).toEqual([]);
  });

  it("does not auto-advance the resources step from passive refresh events", () => {
    let progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "heat-police" }
    }, {
      type: "police:feedback",
      detail: { heat: 35, message: "initial render" }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).not.toContain("heat-police");
    expect(progress.observedStepIds).toEqual([]);

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: {
        currentStepId: "heat-police",
        observedStepIds: ["heat-police"]
      }
    }, {
      type: "heat:changed",
      detail: { heat: 36 }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).not.toContain("heat-police");
    expect(progress.observedStepIds).toEqual([]);
  });

  it("remembers confirmed building feedback done before the district step catches up", () => {
    let progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "building-action:feedback",
      detail: {
        payload: {
          actionId: "sell_drugs",
          buildingTypeId: "street_dealers"
        }
      }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district", "building-action"]);

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "attack:started",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).not.toContain("attack-order");
  });

  it("does not complete the building action step until confirmed feedback is visible", () => {
    let progress = normalizeOnboardingProgress({ currentStepId: "building-action" });

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "building:opened",
      detail: { buildingName: "Pouliční dealeři" }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).not.toContain("building-action");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "building-action:feedback",
      detail: {
        payload: {
          actionId: "sell_drugs",
          buildingTypeId: "street_dealers"
        }
      }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).toContain("building-action");
  });

  it("uses async started states for spy and trap onboarding progress", () => {
    let progress = normalizeOnboardingProgress({ currentStepId: "spy" });

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "spy:opened",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "spy:started",
      detail: { targetDistrictId: 3, mission: { returnAt: "2026-05-15T00:45:00.000Z" } }
    });

    expect(progress.currentStepId).toBe("spy");
    expect(progress.completedStepIds).not.toContain("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "spy:started",
      detail: { targetDistrictId: 2, mission: { returnAt: "2026-05-15T01:00:00.000Z" } }
    });

    expect(progress.currentStepId).toBe("attack-order");
    expect(progress.completedStepIds).toContain("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "trap:opened",
      detail: { targetDistrictId: 1 }
    });

    expect(progress.currentStepId).toBe("attack-order");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "trap:moved",
      detail: { targetDistrictId: 2, sourceDistrictId: 1 }
    });

    expect(progress.currentStepId).toBe("attack-order");
    expect(progress.completedStepIds).not.toContain("attack-order");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "trap:moved",
      detail: { targetDistrictId: 1, sourceDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("done");
    expect(progress.completedStepIds).toContain("attack-order");
  });

  it("step resolver survives missing target elements", () => {
    const readModel = createOnboardingReadModel({ world: { ownedDistrictIds: [1] } });
    const state = resolveOnboardingStepState({ id: "heat-police", fallbackBody: "fallback" }, readModel, createRoot());

    expect(state.status).toBe("fallback");
    expect(state.missingTarget).toBe(true);
    expect(state.fallbackTitle).toBe("Cíl teď není dostupný.");
    expect(state.fallback).toBe("fallback");
  });

  it("defeated players see defeated state instead of the normal flow", () => {
    const readModel = createOnboardingReadModel({
      currentPlayerStatus: "defeated",
      world: { ownedDistrictIds: [1] }
    });
    const state = resolveOnboardingStepState({ id: "welcome" }, readModel, createRoot(["[data-gang-heat]"]));

    expect(readModel.playerStatus).toBe("defeated");
    expect(state.status).toBe("defeated");
    expect(state.fallback).toContain("vyřazený");
  });

  it("operator read model still exposes elimination data without making it onboarding v1 scope", () => {
    const readModel = createOnboardingReadModel({
      elimination: {
        enabled: true,
        ticksUntilNextElimination: 42,
        dangerZone: [{ playerId: "p1" }],
        currentPlayerStatus: "danger",
        activePlayersRemaining: 12
      },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.eliminationAvailable).toBe(true);
    expect(readModel.elimination.nextEliminationLabel).toBe("za 42m");
    expect(readModel.elimination.dangerZoneLabel).toBe("1 hráčů v danger zone");
    expect(readModel.elimination.maxPlayersPerServer).toBe(20);
    expect(ONBOARDING_STEPS.some((step) => step.id === "elimination-danger")).toBe(false);
  });

  it("operator read model exposes final lockdown essentials", () => {
    const readModel = createOnboardingReadModel({
      player: {
        finalLockdown: {
          enabled: true,
          active: true,
          remainingActiveTicks: 462,
          currentPlayerRank: 4,
          currentPlayerFinalScore: 12000,
          leaderboardTop3: [{ score: 51000 }, { score: 50000 }, { score: 49000 }],
          topRankCount: 3
        }
      },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.finalLockdown).toMatchObject({
      active: true,
      remainingLabel: "7h 42m zbývá",
      rankLabel: "#4",
      top3Gap: "+37k"
    });
  });

  it("day/night data remains available without being a hard onboarding v1 step", () => {
    const readModel = createOnboardingReadModel({
      dayNight: { phase: "night" },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.dayNightAvailable).toBe(true);
    expect(ONBOARDING_STEPS.some((step) => step.id === "day-night")).toBe(false);
  });
});
