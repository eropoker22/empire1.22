import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import { saveLobbyStep, saveLoginStep } from "../../page-assets/js/app/auth-flow.js";
import {
  createDefaultPreviewSession,
  updateStoredPreviewSession
} from "../../page-assets/js/app/model/authority-state.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";
const root = process.cwd();

const page = (name) => readFileSync(resolve(root, "pages", name), "utf8");

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

const readSession = () => JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY));

const lockFactionStep = ({ factionId, avatar, gangColor }) => {
  const currentRegistration = readSession().registration;
  const baseSession = createDefaultPreviewSession(factionId);

  return updateStoredPreviewSession(() => ({
    ...baseSession,
    registration: {
      ...currentRegistration,
      factionId,
      selectedFaction: factionId,
      factionLabel: FACTION_CATALOG[factionId].name,
      structure: FACTION_CATALOG[factionId].name,
      selectedStructure: FACTION_CATALOG[factionId].name,
      serverRegistrationStatus: "faction_locked",
      factionLocked: true,
      hasCompletedServerEntry: true,
      avatar,
      gangColor,
      lockedAt: new Date().toISOString()
    },
    world: {
      ...baseSession.world
    }
  }));
};

describe("page onboarding smoke", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T11:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("keeps the login to game page contract wired", () => {
    expect(page("login.html")).toContain('id="login-form"');
    expect(page("login.html")).toContain('id="register-form"');
    expect(page("login.html")).toContain('id="guest-btn"');
    expect(page("login.html")).not.toContain('data-open-server-select');
    expect(page("login.html")).toContain('data-tab-link="register"');
    expect(page("login.html")).toContain('data-forgot-password');
    expect(page("login.html")).toContain('src="../page-assets/js/login.js"');

    expect(page("lobby.html")).toContain('data-server-list');
    expect(page("lobby.html")).toContain('data-server-detail-map');
    expect(page("lobby.html")).toContain('data-server-detail-continue');
    expect(page("lobby.html")).toContain('src="../page-assets/js/lobby.js"');
    const lobbyJsSource = readFileSync(resolve(root, "page-assets/js/lobby.js"), "utf8");
    expect(lobbyJsSource).not.toContain("war-demo");
    expect(lobbyJsSource).not.toContain("free-demo");
    expect(lobbyJsSource).toContain('MATCHMAKING_RESERVE_ENDPOINT = "/api/matchmaking/reserve"');
    expect(lobbyJsSource).toContain("reserveSelectedServer");
    expect(lobbyJsSource).toContain("preferredServerInstanceId");

    expect(page("faction.html")).toContain('id="structure-grid"');
    expect(page("faction.html")).toContain('id="auth-faction" name="faction" type="hidden" value=""');
    expect(page("faction.html")).not.toContain('class="structure-card is-active"');
    expect(page("faction.html")).not.toContain("jedním klepnutím");
    expect(page("faction.html")).toContain("Vyber frakci pro tuto válku");
    expect(page("faction.html")).toContain('id="gang-color-grid"');
    expect(page("faction.html")).toContain('id="avatar-grid"');
    expect(page("faction.html")).toContain('id="go-game"');
    expect(page("faction.html")).toContain('src="../page-assets/js/faction.js"');
    const factionJsSource = readFileSync(resolve(root, "page-assets/js/faction.js"), "utf8");
    for (const avatarFolder of ["Mafia", "Kartel", "kult", "Tajnaorganizace", "Hacker", "Motogang", "SoukromaArmada", "Korporat"]) {
      expect((factionJsSource.match(new RegExp(`\\.\\./img/avatars/${avatarFolder}/`, "g")) || []).length).toBe(9);
    }

    expect(page("game.html")).toContain('id="game-root"');
    expect(page("game.html")).toContain('data-mount-role="map"');
    expect(page("game.html")).toContain('data-district-popup-atmosphere');
    expect(page("game.html")).toContain('role="button" tabindex="0"');
    expect(page("game.html")).toContain('data-district-atmosphere-window');
    expect(page("game.html")).toContain("Vypsat odměnu");
    expect(page("game.html")).toContain('id="bounty-target-picker"');
    expect(page("game.html")).toContain('data-br-info-open');
    expect(page("game.html")).toContain('id="battle-royale-info-modal"');
    expect(page("game.html")).toContain('data-onboarding-launch');
    expect(page("game.html")).toContain('id="onboarding-launch-button"');
    expect(page("game.html")).toContain('id="settings-onboarding-btn"');
    expect(page("game.html")).toContain('src="../page-assets/js/app/battle-royale-info-runtime.js"');
    expect(page("game.html")).toContain("<tr><th>Cíl</th><th>Typ</th><th>Odměna</th><th>Do</th></tr>");
    expect(page("game.html")).toMatch(/src="\.\.\/page-assets\/js\/app\.js(?:\?[^"]*)?"/u);
    expect(page("game.html")).toContain('src="../page-assets/js/app/game-admin-slice-launcher.js"');
    expect(page("game.html")).not.toContain('src="../page-assets/js/admin-assets/admin-slice-demo.js"');

    expect(readFileSync(resolve(root, "page-assets/css/styles.css"), "utf8")).toContain('@import "./styles-onboarding.css";');
    expect(readFileSync(resolve(root, "page-assets/css/styles.css"), "utf8")).toContain('@import "./styles-static-hover.css";');
    expect(page("admin.html")).toContain('href="../page-assets/css/styles-static-hover.css"');
    expect(page("login.html")).toMatch(/href="\.\.\/page-assets\/css\/login\.css">\r?\n\s*<link rel="stylesheet" href="\.\.\/page-assets\/css\/styles-static-hover\.css">/u);
    expect(page("lobby.html")).toMatch(/href="\.\.\/page-assets\/css\/lobby\.css">\r?\n\s*<link rel="stylesheet" href="\.\.\/page-assets\/css\/styles-static-hover\.css">/u);
    expect(readFileSync(resolve(root, "server-select.html"), "utf8")).toMatch(/href="\.\/server-select\.css">\r?\n\s*<link rel="stylesheet" href="\.\/page-assets\/css\/styles-static-hover\.css">/u);
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("transform: none !important;");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("transition-property: color, background, background-color");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".building-info-action-row");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".modal__row:hover");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("animation: none !important;");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".game-shell :where");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("#city-events-open");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("#leaderboard-card");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".building-action-status__item");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".game-topbar :where");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain(".gang-profile-panel");
    expect(readFileSync(resolve(root, "page-assets/css/styles-static-hover.css"), "utf8")).toContain("animation-play-state: paused !important;");
    const bountyCssSource = readFileSync(resolve(root, "page-assets/css/styles-bounty.css"), "utf8");
    const bountyRuntimeSource = readFileSync(resolve(root, "page-assets/js/app/bounty-runtime.js"), "utf8");
    expect(bountyCssSource).toContain("Final simplified bounty flow: target, reward, bounty type, active board, confirm button.");
    expect(bountyCssSource).toContain("#bounty-modal .bounty-board__target-card");
    expect(bountyCssSource).toContain(".bounty-board__target-picker");
    expect(bountyRuntimeSource).toContain("data-bounty-target-option");
    expect(bountyCssSource).toMatch(/#bounty-confirm-modal \{\r?\n\s*display: none !important;/u);
    const loginCssSource = readFileSync(resolve(root, "page-assets/css/login.css"), "utf8");
    expect(loginCssSource).toContain(".mode-card--free");
    expect(loginCssSource).toContain("linear-gradient(145deg, rgba(3, 16, 31, 0.94), rgba(1, 6, 16, 0.98))");
    expect(loginCssSource).toContain("linear-gradient(145deg, rgba(24, 7, 36, 0.95), rgba(6, 4, 16, 0.98))");
    expect(loginCssSource).toContain("width: 100%;");
    expect(loginCssSource).toContain("#register-form .field-shell");
    expect(loginCssSource).toContain("#register-form .field-shell input");
    expect(loginCssSource).toContain("#register-form .enter-city-button");
    const gameRedesignSource = readFileSync(resolve(root, "page-assets/css/styles-game-redesign.css"), "utf8");
    expect(gameRedesignSource).toMatch(/body\.game-body > \.game-topbar \{\r?\n\s*position: sticky;/u);
    expect(gameRedesignSource).toContain("z-index: 70;");
    expect(gameRedesignSource).toContain("Final visual pass: gang profile matches the neon Empire shell.");
    expect(gameRedesignSource).toContain("#profile-gang-card.right-panel-card .gang-profile-row.profile-row");
    expect(gameRedesignSource).toContain("#profile-gang-card.right-panel-card .profile-row--wanted");
    expect(gameRedesignSource).toContain(".map-phase-info-button");
    expect(gameRedesignSource).toContain(".battle-royale-info-modal__content");
    expect(readFileSync(resolve(root, "page-assets/js/app/battle-royale-info-runtime.js"), "utf8")).toContain("initBattleRoyaleInfoRuntime");
    expect(readFileSync(resolve(root, "page-assets/css/styles-building-modals.css"), "utf8")).toMatch(
      /\.district-building-detail-stats \{\r?\n\s*display: none !important;/u,
    );
    const districtCssSource = readFileSync(resolve(root, "page-assets/css/styles-district.css"), "utf8");
    expect(districtCssSource).toMatch(
      /\.district-popup-shell \{\r?\n\s*inset: 56px 0 0 0;\r?\n\s*z-index: 29;/u,
    );
    const popupsCssSource = readFileSync(resolve(root, "page-assets/css/styles-popups.css"), "utf8");
    expect(popupsCssSource).toMatch(
      /\.market-popup-shell,\r?\n\s*\.leaderboard-popup-shell \{\r?\n\s*inset: 56px 0 0 0;\r?\n\s*z-index: 29;/u,
    );
    const mobileFixesSource = readFileSync(resolve(root, "page-assets/css/styles-mobile-fixes.css"), "utf8");
    expect(mobileFixesSource).toContain("#buildings-modal:not([hidden])");
    expect(mobileFixesSource).toContain("touch-action: pan-y !important;");
    expect(mobileFixesSource).toContain(".district-building-detail-shell:not([hidden]) .district-building-detail-card .district-building-detail-body");
    expect(mobileFixesSource).toContain("Mobile building cards must scroll as one sheet");
    expect(mobileFixesSource).toContain("--mobile-building-scroll-rgb");
    expect(mobileFixesSource).toContain(":has(.buildings-popup__detail-card[data-building-district-type=\"industrial\"])");
    expect(mobileFixesSource).toContain("::-webkit-scrollbar-thumb");
    expect(mobileFixesSource).toContain("#buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup-card.buildings-modal__content > .modal__body");
    expect(mobileFixesSource).toContain("#buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup__layout.buildings-modal__layout");
    expect(mobileFixesSource).toContain("overflow-y: auto !important;");
    const runtimeSource = readFileSync(resolve(root, "page-assets/js/app/runtime.js"), "utf8");
    expect(runtimeSource).toContain("shell.dataset.buildingDistrictType");
    expect(runtimeSource).toContain("function dispatchDistrictBuildingProductionCollected");
    expect(readFileSync(resolve(root, "page-assets/js/app/runtime/productionBuildingPopupRuntime.js"), "utf8")).toContain("source: \"production-building-popup\"");
    expect(readFileSync(resolve(root, "page-assets/js/app/runtime/factoryPopupRuntime.js"), "utf8")).toContain("source: \"factory-popup\"");
  });

  it("walks a clean registration draft through lobby and faction lock", () => {
    saveLoginStep({
      identity: "Smoke Boss",
      password: "secret",
      isGuest: false,
      gangName: "Smoke Crew",
      mode: "free"
    });

    expect(readSession().registration).toMatchObject({
      identity: "Smoke Boss",
      gangName: "Smoke Crew",
      serverMode: "free"
    });
    expect(readSession().registration.password).toBeUndefined();
    expect(readSession().registration.serverId).toBeUndefined();
    expect(readSession().registration.factionId).toBeUndefined();

    saveLobbyStep({ serverId: "free-eu-01", districtId: 27 });

    expect(readSession().registration).toMatchObject({
      identity: "Smoke Boss",
      gangName: "Smoke Crew",
      activeServerId: CANONICAL_FREE_SERVER_ID,
      activeServerInstanceId: CANONICAL_FREE_SERVER_ID,
      serverId: CANONICAL_FREE_SERVER_ID,
      serverInstanceId: CANONICAL_FREE_SERVER_ID,
      serverMode: "free",
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      serverRegistrationStatus: "server_selected",
      factionLocked: false,
      hasCompletedServerEntry: false
    });
    expect(readSession().registration.factionId).toBeUndefined();

    const session = lockFactionStep({
      factionId: "hackeri",
      avatar: "../img/avatars/Hacker/grok_image_1773620608055.jpg",
      gangColor: "#3b82f6"
    });

    expect(session.registration).toMatchObject({
      identity: "Smoke Boss",
      serverId: CANONICAL_FREE_SERVER_ID,
      serverInstanceId: CANONICAL_FREE_SERVER_ID,
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      factionId: "hackeri",
      selectedFaction: "hackeri",
      factionLocked: true,
      hasCompletedServerEntry: true,
      gangColor: "#3b82f6",
      lockedAt: "2026-04-26T11:00:00.000Z"
    });
    expect(session.world.ownedDistrictIds).toEqual([]);
  });

  it("keeps owned building passive output automatic in the legacy runtime", () => {
    const runtimeSource = readFileSync(resolve(root, "page-assets/js/app/runtime.js"), "utf8");
    const buildingDetailPanelSource = readFileSync(resolve(root, "page-assets/js/app/ui/buildingDetailPanel.js"), "utf8");
    const buildingDetailViewModelSource = readFileSync(resolve(root, "page-assets/js/app/runtime/buildingDetailViewModel.js"), "utf8");
    const buildingDetailInfoViewModelSource = readFileSync(resolve(root, "page-assets/js/app/runtime/buildingDetailInfoViewModel.js"), "utf8");
    const mapCanvasAnimationsSource = readFileSync(resolve(root, "page-assets/js/app/map/mapCanvasAnimations.js"), "utf8");
    const districtCanvasRendererSource = readFileSync(resolve(root, "page-assets/js/app/map/districtCanvasRenderer.js"), "utf8");
    const mapConstantsSource = readFileSync(resolve(root, "page-assets/js/app/map/mapConstants.js"), "utf8");
    const buildingDetailUiSource = `${runtimeSource}\n${buildingDetailPanelSource}\n${buildingDetailViewModelSource}\n${buildingDetailInfoViewModelSource}`;

    expect(runtimeSource).toContain("snapshot.buildingCleanHourlyIncome");
    expect(runtimeSource).toContain("snapshot.buildingDirtyHourlyIncome");
    expect(runtimeSource).toContain("snapshot.buildingInfluencePerHour");
    expect(runtimeSource).toContain("snapshot.passiveHeatPerDay");
    expect(runtimeSource).toContain("Clean, dirty, vliv a heat se připisují automaticky.");
    expect(buildingDetailUiSource).toContain("collectButton.hidden = !showManualCollect");
    expect(buildingDetailUiSource).toContain('collectButton.style.display = showManualCollect ? "" : "none";');
    expect(readFileSync(resolve(root, "page-assets/css/styles-building-modals.css"), "utf8")).toContain(".building-detail-title__action-btn[hidden]");
    expect(readFileSync(resolve(root, "page-assets/css/styles-building-modals.css"), "utf8")).toMatch(/\.district-building-detail-shell \{\r?\n  position: fixed;\r?\n  inset: 0;/u);
    expect(runtimeSource).toContain("function syncBuildingDetailTopbarVisibility(root)");
    expect(runtimeSource).toContain("hasManualCollect");
    expect(mapCanvasAnimationsSource).toContain("function drawReducedMapActivityIcon(context, type, x, y, size, color)");
    expect(districtCanvasRendererSource).toContain('drawReducedMapActivityMarker(context, district, "attack", reducedActivityColors.attack)');
    expect(mapConstantsSource).toContain('attack: "#fb923c"');
    expect(runtimeSource).not.toContain('drawReducedMapActivityMarker(context, district, "UTOK", "#fb923c")');
    expect(runtimeSource).toContain("SHOPPING_MALL_NETWORK_CONFIG");
    expect(buildingDetailUiSource).toContain("Pasivní market bonus");
    expect(buildingDetailUiSource).toContain("mechanics.shoppingMallMarketDiscount.discountPct");
    expect(runtimeSource).toContain("AUTO_SALON_SUPPORT_CONFIG");
    expect(buildingDetailUiSource).toContain("Pasivní mobilita");
    expect(buildingDetailUiSource).toContain("combinedGarageDealerMaxReductionPct");
    expect(runtimeSource).not.toContain("auto_salon_gray_import");
    expect(runtimeSource).not.toContain("Zakryt špinavý cash");
    expect(runtimeSource).toContain('mechanicsType === "apartment-block"');
    expect(runtimeSource).not.toContain("cleanMoney += mechanics.storedClean");
    expect(runtimeSource).not.toContain("dirtyMoney += mechanics.storedDirty");
    expect(runtimeSource).toContain('mechanicsType === "school"');
    expect(runtimeSource).toContain('if (mechanics.mechanicsType === "school")');
    expect(runtimeSource).toContain("SCHOOL_CONFIG");
    expect(runtimeSource).toContain("rollSchoolTalent");
    expect(buildingDetailUiSource).toContain("Výsledek talentu");
    expect(buildingDetailUiSource).toContain("zapíše se do uličních zpráv");
  });
});
