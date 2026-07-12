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
    expect(page("faction.html")).toContain("Vyber frakci pro tento server");
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
    expect(page("game.html")).toContain("VYPSAT BOUNTY");
    expect(page("game.html")).toContain('id="bounty-target-picker"');
    expect(page("game.html")).toContain('data-br-info-open');
    expect(page("game.html")).toContain('id="battle-royale-info-modal"');
    expect(page("game.html")).toContain('class="city-status-bar"');
    expect(page("game.html")).toContain("Čas města");
    expect(page("game.html")).toContain("Očista");
    expect(page("game.html")).toContain('data-elimination-ai-panel-open');
    expect(page("game.html")).toContain(">Očista</button>");
    expect(page("game.html")).toContain('data-elimination-ai-panel');
    expect(page("game.html").indexOf('data-elimination-ai-panel hidden')).toBeGreaterThan(page("game.html").indexOf("</main>"));
    expect(page("game.html")).toContain('data-elimination-result-popup');
    expect(page("game.html")).toContain('data-elimination-result-popup-body');
    expect(page("game.html")).toContain('role="dialog"');
    expect(page("game.html")).toContain('aria-label="Otevřít AI operátora očisty"');
    expect(page("game.html")).toContain('title="AI operátor očisty"');
    expect(page("game.html")).toContain('data-elimination-ai-panel-close');
    expect(page("game.html")).not.toContain('data-elimination-ai-panel-status');
    expect(page("game.html")).toContain('data-elimination-countdown-warning');
    expect(page("game.html")).toContain('data-elimination-countdown-warning-close');
    expect(page("game.html")).toContain('data-elimination-countdown-warning-time');
    expect(page("game.html")).toContain('data-mobile-short=""></span>');
    expect(page("game.html")).not.toContain(">DEV-ONLY<");
    const gameHtml = page("game.html");
    expect(gameHtml.indexOf('id="city-events-card-anchor"')).toBeLessThan(gameHtml.indexOf('id="city-events-card"'));
    expect(gameHtml.indexOf('id="city-events-card"')).toBeLessThan(gameHtml.indexOf('id="buildings-card"'));
    expect(gameHtml).toContain('data-onboarding-launch');
    expect(gameHtml).toContain('id="onboarding-launch-button"');
    expect(gameHtml).toContain('id="settings-onboarding-btn"');
    expect(gameHtml).toContain('<span class="game-brand-name">EmpireStreets</span>');
    expect(gameHtml).not.toMatch(/<spa\s*\r?\n\s*\+0z0n/u);
    expect(gameHtml).not.toContain("+0z0n");
    expect(gameHtml).toContain('id="game-overlay-region" class="game-overlay-roots"');
    expect(gameHtml).not.toContain("Overlay roots");
    expect(gameHtml).not.toContain("mount-point--overlay");
    expect(gameHtml).toContain('src="../page-assets/js/app/battle-royale-info-runtime.js"');
    expect(gameHtml).toContain("<tr><th>CÍL</th><th>TYP</th><th>DISTRICT</th><th>ODMĚNA</th><th>STATUS / VYPSAL</th></tr>");
    const allianceRuntimeSource = readFileSync(resolve(root, "page-assets/js/app/alliance-runtime.js"), "utf8");
    expect(allianceRuntimeSource).toContain("submitServerAllianceCommand");
    expect(allianceRuntimeSource).toContain("localStorage.removeItem(LOCAL_ALLIANCE_KEY)");
    expect(allianceRuntimeSource).toContain("allianceBoard");
    expect(allianceRuntimeSource).not.toContain("createLocalAlliance");
    expect(allianceRuntimeSource).not.toContain("joinLocalAlliance");
    expect(gameHtml).toMatch(/src="\.\.\/page-assets\/js\/app\.js(?:\?[^"]*)?"/u);
    expect(gameHtml).toContain('src="../page-assets/js/app/game-admin-slice-launcher.js"');
    expect(gameHtml).not.toContain('src="../page-assets/js/admin-assets/admin-slice-demo.js"');

    expect(readFileSync(resolve(root, "page-assets/css/styles.css"), "utf8")).toContain('@import "./styles-onboarding.css";');
    const onboardingCssSource = readFileSync(resolve(root, "page-assets/css/styles-onboarding.css"), "utf8");
    expect(onboardingCssSource).toMatch(/\.elimination-ai-panel__backdrop \{\r?\n\s*display: none;/u);
    expect(onboardingCssSource).toMatch(/position: fixed;\r?\n\s*inset: 0;/u);
    expect(onboardingCssSource).toContain("height: 100dvh;");
    expect(onboardingCssSource).toContain("width: 100vw;");
    expect(onboardingCssSource).toContain("body.elimination-ai-panel-open");
    expect(onboardingCssSource).toContain(".elimination-ai-panel.is-open .elimination-ai-panel__card");
    expect(onboardingCssSource).toContain("Production mock HUD for the Free BR purge window");
    expect(onboardingCssSource).toContain('url("../../img/eliminace.png")');
    expect(onboardingCssSource).toContain("User polish: compact header controls and scrollable last-three list");
    expect(onboardingCssSource).toContain(".elimination-result-popup");
    expect(onboardingCssSource).toContain("@media (max-width: 768px)");
    expect(onboardingCssSource).toContain("place-items: center;");
    expect(onboardingCssSource).not.toMatch(/\.elimination-result-popup \{\r?\n\s*align-items: end;/u);
    expect(onboardingCssSource).toContain(".elimination-ai-panel__score-total");
    expect(onboardingCssSource).toContain("scroll-snap-type: y proximity");
    expect(onboardingCssSource).toContain(".elimination-countdown-warning");
    expect(onboardingCssSource).toContain(".elimination-countdown-warning__close");
    expect(onboardingCssSource).toContain("pointer-events: none");
    expect(onboardingCssSource).toContain("max-width: none !important;");
    expect(onboardingCssSource).toContain("-webkit-overflow-scrolling: touch;");
    expect(onboardingCssSource).toContain("linear-gradient(90deg, transparent, rgba(var(--ai-accent), 0.88)");
    const actionResultsCssSource = readFileSync(resolve(root, "page-assets/css/styles-action-results.css"), "utf8");
    expect(actionResultsCssSource).toContain("Action windows reuse the last-five-minutes elimination glass frame");
    expect(actionResultsCssSource).toContain("html body .attack-setup-popup-card,");
    expect(actionResultsCssSource).toContain("html body .district-action-confirm-popup-card");
    expect(actionResultsCssSource).toContain("html body .spy-confirm-popup-card");
    expect(actionResultsCssSource).toContain("--action-glass-accent-rgb: 251, 191, 36;");
    expect(actionResultsCssSource).toContain(".spy-toast,");
    expect(actionResultsCssSource).toContain("radial-gradient(circle at 50% 0%, rgba(var(--toast-accent-rgb");
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
    expect(bountyCssSource).toContain("#bounty-confirm-modal.bounty-board-modal:not(.hidden)");
    expect(bountyRuntimeSource).toContain("submitServerBountyCommand");
    expect(bountyRuntimeSource).toContain("revealedTypeDistrictIds");
    expect(bountyRuntimeSource).toContain("formatBountyDistrictOptionLabel");
    expect(bountyRuntimeSource).toContain("formatBountyDistrictTypeLabel");
    const loginCssSource = readFileSync(resolve(root, "page-assets/css/login.css"), "utf8");
    expect(loginCssSource).toContain(".mode-card--free");
    expect(loginCssSource).toContain("linear-gradient(145deg, rgba(3, 16, 31, 0.94), rgba(1, 6, 16, 0.98))");
    expect(loginCssSource).toContain("linear-gradient(145deg, rgba(36, 24, 7, 0.95), rgba(16, 10, 4, 0.98))");
    expect(loginCssSource).toContain("width: 100%;");
    expect(loginCssSource).toMatch(/@media \(min-width: 841px\) \{\r?\n  \.mode-card--war \.mode-content \{\r?\n    transform: translateY\(-5px\);/u);
    expect(loginCssSource).toContain("#register-form .field-shell");
    expect(loginCssSource).toContain("#register-form .field-shell input");
    expect(loginCssSource).toContain("#register-form .enter-city-button");
    const gameRedesignSource = readFileSync(resolve(root, "page-assets/css/styles-game-redesign.css"), "utf8");
    expect(gameRedesignSource).toMatch(/body\.game-body > \.game-topbar \{\r?\n\s*position: sticky;/u);
    expect(gameRedesignSource).toContain("z-index: 70;");
    expect(gameRedesignSource).toMatch(/\.game-shell \{\r?\n\s*padding: 6px 0 0;/u);
    expect(gameRedesignSource).toContain("padding: var(--mobile-topbar-offset, 188px) 0 0;");
    expect(gameRedesignSource).not.toContain("padding: var(--mobile-topbar-offset, 188px) 0 34px;");
    expect(gameRedesignSource).toMatch(/#game-overlay-region \{\r?\n\s*position: fixed !important;/u);
    expect(gameRedesignSource).toContain("#game-overlay-region > [data-mount-role]");
    expect(gameRedesignSource).not.toContain("Hide server runtime status readouts from the playable game shell.");
    expect(gameRedesignSource).not.toContain("#game-command-bar-mount .city-status-pill:not(.city-status-pill--action)");
    expect(gameRedesignSource).toContain("Keep the mobile logout/settings controls in the normal bottom flow.");
    expect(gameRedesignSource).toMatch(
      /Keep the mobile logout\/settings controls in the normal bottom flow\.[\s\S]*\.game-mobile-utility-actions \{\r?\n\s*position: static;[\s\S]*display: grid !important;/u
    );
    expect(gameRedesignSource).toMatch(/\.sidebar-shell\.game-rail::before,\r?\n\.region-shell\.game-stage::before \{\r?\n\s*content: none !important;/u);
    expect(gameRedesignSource).toContain("Final visual pass: gang profile matches the neon Empire shell.");
    expect(gameRedesignSource).toContain("#profile-gang-card.right-panel-card .gang-profile-row.profile-row");
    expect(gameRedesignSource).toContain("#profile-gang-card.right-panel-card .profile-row--wanted");
    expect(gameRedesignSource).toContain(".map-phase-info-button");
    expect(gameRedesignSource).toContain(".battle-royale-info-modal__content");
    const cityStatusMobileCssSource = readFileSync(resolve(root, "page-assets/css/styles-mobile-fixes.css"), "utf8");
    expect(cityStatusMobileCssSource).toContain("#game-command-bar-mount .city-status-pill:nth-child(3)");
    expect(cityStatusMobileCssSource).toContain("grid-template-columns: repeat(4, minmax(0, 1fr)) !important;");
    expect(cityStatusMobileCssSource).toMatch(/#game-command-bar-mount \.city-status-pill:nth-child\(3\) \{\r?\n\s*display: none !important;/u);
    expect(cityStatusMobileCssSource).toContain("Tiny white sparkle on the Očista button.");
    expect(cityStatusMobileCssSource).toContain(".city-status-ai-button::after");
    expect(cityStatusMobileCssSource).toContain("Final mobile Očista panel pass");
    expect(cityStatusMobileCssSource).toContain("overflow-y: auto !important;");
    expect(cityStatusMobileCssSource).toContain("scroll-snap-type: y proximity !important;");
    expect(cityStatusMobileCssSource).toContain("top: 18px !important;");
    expect(cityStatusMobileCssSource).toContain("width: 28px !important;");
    expect(cityStatusMobileCssSource).toContain("background: none !important;");
    expect(cityStatusMobileCssSource).toContain("box-shadow: none !important;");
    expect(onboardingCssSource).toContain("top: 28px !important;");
    expect(onboardingCssSource).toContain("padding-right: 68px !important;");
    expect(onboardingCssSource).toContain('font-family: "Orbitron", "Rajdhani", "Inter", system-ui, sans-serif !important;');
    expect(onboardingCssSource).toContain("grid-template-columns: repeat(4, minmax(0, 1fr)) !important;");
    expect(onboardingCssSource).toContain("--ai-panel-lab-blue: 34, 211, 238;");
    expect(onboardingCssSource).toContain("--ai-panel-armory-red: 248, 113, 113;");
    expect(onboardingCssSource).toContain("--ai-panel-factory-yellow: 251, 191, 36;");
    expect(onboardingCssSource).toContain("--ai-panel-pharmacy-green: 45, 212, 191;");
    expect(onboardingCssSource).toContain("rgba(var(--ai-panel-factory-yellow), 0.13)");
    expect(onboardingCssSource).toContain("rgba(var(--ai-panel-pharmacy-green), 0.1)");
    expect(cityStatusMobileCssSource).toContain("--ai-panel-lab-blue: 34, 211, 238;");
    expect(cityStatusMobileCssSource).toContain("rgba(var(--ai-panel-pharmacy-green), 0.1)");
    expect(cityStatusMobileCssSource).toContain('font-family: "Orbitron", "Rajdhani"');
    expect(cityStatusMobileCssSource).toContain("text-shadow:");
    expect(onboardingCssSource).toContain('.elimination-ai-panel__metric[data-ai-metric="heat"]');
    const gameplaySlicePageSource = readFileSync(resolve(root, "apps/client/src/browser/gameplay-slice-page.ts"), "utf8");
    const gameplaySliceClientSource = readFileSync(resolve(root, "page-assets/js/client-assets/gameplay-slice-client.js"), "utf8");
    const gameplaySliceCssSource = readFileSync(resolve(root, "page-assets/css/styles-gameplay-slice-client.css"), "utf8");
    expect(gameplaySlicePageSource).toContain('options.root.dataset.gameplaySliceUnavailable = "true";');
    expect(gameplaySlicePageSource).toContain("Object.values(mounts).forEach");
    expect(gameplaySlicePageSource).not.toContain("<strong>Server sync unavailable</strong>");
    expect(gameplaySliceClientSource).toContain('options.root.dataset.gameplaySliceUnavailable = "true";');
    expect(gameplaySliceClientSource).not.toContain("<strong>Server sync unavailable</strong>");
    expect(gameplaySliceCssSource).toContain('.gameplay-slice-client[data-gameplay-slice-unavailable="true"]');
    expect(gameplaySliceCssSource).toContain("must not be visible inside game.html");
    expect(gameplaySliceCssSource).toContain(".game-body .gameplay-slice-client");
    expect(gameplaySliceCssSource).toContain("height: 0 !important;");
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
    expect(runtimeSource).toContain("function syncRuntimePassiveProductionState");
    expect(runtimeSource).toContain("function syncOwnedDistrictBuildingDetailProduction");
    expect(runtimeSource).toContain("function syncFactoryProductionBuffer");
    expect(runtimeSource).toContain("function scheduleStoredProductionJobs");
    expect(runtimeSource).toContain("function initializeDistrictBuildingDetailProductionBaseline");
    expect(runtimeSource).toContain("storedDirtyCash: Math.max(0, Number(entry.storedDirtyCash || 0))");
    expect(runtimeSource).toContain("populationLastUpdatedAt: Number.isFinite(Number(entry.populationLastUpdatedAt))");
    expect(runtimeSource).toContain("schoolLastUpdatedAt: Number.isFinite(Number(entry.schoolLastUpdatedAt))");
    expect(runtimeSource).toContain("smugglingLastUpdatedAt: Number.isFinite(Number(entry.smugglingLastUpdatedAt))");
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
    expect(buildingDetailUiSource).toContain("Populace");
    expect(buildingDetailUiSource).toContain("Škola pasivně zvyšuje lokální populační zásobu");
  });
});
