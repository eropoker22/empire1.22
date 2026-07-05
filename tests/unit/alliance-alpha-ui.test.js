import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");

describe("alliance alpha UI", () => {
  const html = readText("pages/game.html");
  const runtime = readText("page-assets/js/app/alliance-runtime.js");
  const iconRegistry = readText("page-assets/js/app/alliance-icons.js");
  const mapCanvasAnimations = readText("page-assets/js/app/map/mapCanvasAnimations.js");
  const css = readText("page-assets/css/styles-alliance.css");
  const mobileCss = readText("page-assets/css/styles-mobile-fixes.css");
  const audit = readText("ALLIANCE_ALPHA_AUDIT.md");
  const expectedIconFiles = [
    "alliance-reaper.svg",
    "alliance-snake.svg",
    "alliance-wolf.svg",
    "alliance-raven.svg",
    "alliance-skull.svg",
    "alliance-cobra.svg",
    "alliance-spider.svg",
    "alliance-scorpion.svg",
    "alliance-vulture.svg",
    "alliance-dagger.svg",
    "alliance-fist.svg",
    "alliance-crown.svg",
    "alliance-mask.svg",
    "alliance-claw.svg",
    "alliance-fangs.svg",
    "alliance-eye.svg",
    "alliance-jackal.svg",
    "alliance-hydra.svg",
    "alliance-ghost.svg",
    "alliance-bull.svg"
  ];

  it("keeps the alliance modal focused on the active card layout", () => {
    expect(html).not.toContain("Aliance drží tvoje záda.");
    expect(html).not.toContain("Sám přežiješ. S crew ovládneš město.");
    expect(html).not.toContain("<h3>Aliance</h3>");
    expect(html).not.toContain('id="alliance-modal-close"');
    expect(html).toContain('id="alliance-member-lightbox"');
    expect(html).toContain('aria-labelledby="alliance-member-lightbox-title"');
    expect(html).toContain('maxlength="32"');
    expect(runtime).toContain("const renderAllianceTabs = () =>");
    expect(runtime).toContain("alliance-overview-card");
    expect(runtime).toContain("alliance-overview-card__topline");
    expect(runtime).not.toContain("alliance-overview-card__role");
    expect(runtime).toContain("getReadyCountdownLabel");
    expect(runtime).toContain("alliance-ready-countdown");
    expect(runtime).not.toContain("READY stav");
    expect(runtime).not.toContain("READY je aktuálně v pořádku.");
    expect(runtime).not.toContain("Potvrdit ready");
    expect(runtime).toContain("Zůstávám");
    expect(runtime).toContain("Končím");
    expect(css).toContain(".alliance-ready-card__actions");
    expect(runtime).toContain("alliance-overview-member-list");
    expect(runtime).toContain("Název aliance");
    expect(runtime).toContain("DEV_ONLY_ALLIANCE_DEMO_MEMBERS");
    expect(runtime).toContain("LAUNCH_PLAYER_AVATAR_BY_FACTION_ID");
    expect(runtime).toContain("START_PHASE_PLAYER_NAMES");
    expect(runtime).toContain("avatarSrc");
    expect(runtime).toContain('presence: "online"');
    expect(runtime).toContain('presence: "offline"');
    expect(runtime).toContain("getMemberPresence");
    expect(runtime).toContain("renderMemberPresence");
    expect(runtime).toContain("alliance-member-name-line");
    expect(runtime).toContain("alliance-member-presence");
    expect(runtime).not.toContain("alliance-member-avatar__presence");
    expect(runtime).toContain("renderMemberAvatar(member");
    expect(runtime).toContain("alliance-member-avatar__image");
    expect(runtime).toContain("data-alliance-member-avatar-open");
    expect(runtime).toContain("openAllianceMemberLightbox");
    expect(runtime).toContain("closeAllianceMemberLightbox");
    expect(css).toContain(".alliance-member-avatar__image");
    expect(css).toContain(".alliance-overview-card__topline");
    expect(css).toContain(".alliance-state-pill--ready");
    expect(css).toContain(".alliance-ready-countdown");
    expect(css).toContain(".alliance-member-name-line");
    expect(css).toContain(".alliance-member-presence");
    expect(css).toContain(".alliance-member-presence::before");
    expect(css).toContain(".alliance-member-presence::after");
    expect(css).toContain('@keyframes alliancePresencePulse');
    expect(css).toContain(".alliance-member-avatar[data-alliance-member-avatar-open]");
    expect(css).toContain(".alliance-member-lightbox__content");
    expect(css).toContain(".alliance-overview-member-list");
    expect(css).toContain("max-height: 172px;");
    expect(css).toContain("overscroll-behavior: contain;");
    expect(runtime).not.toContain("Lokální preview ukazuje vzhled aliance bez serverového uložení.");
    expect(runtime).toContain("const MAX_ALLIANCE_SIZE_FALLBACK = 4;");
    expect(runtime).toContain("const MAX_ALLIANCE_NAME_LENGTH = 32;");
  });

  it("keeps alliance actions server-authoritative and sanitizes UI errors", () => {
    expect(runtime).toContain("submitServerAllianceCommand");
    expect(runtime).toContain("const PLAYER_FACING_ERROR_COPY");
    expect(runtime).toContain("const commandMessage = (response, fallback) =>");
    expect(runtime).toContain("Alianční akci se nepodařilo dokončit.");
    expect(runtime).toContain("Počkej, alianční akce se ještě vyřizuje.");
    expect(runtime).not.toContain("Alliance akci se nepodarilo dokoncit.");
    expect(runtime).not.toContain("Zadej nazev aliance.");
  });

  it("marks local preview surfaces instead of pretending they are server state", () => {
    expect(html).toContain("Globální chat");
    expect(html).not.toContain("Globální chat (preview)");
    expect(html).toContain("Globální chat je v alphě jen lokální kanál.");
    expect(runtime).toContain("createDisabledReason: \"local_preview_active\"");
    expect(runtime).toContain("ALLIANCE_CHAT_PREVIEW_KEY");
    expect(runtime).toContain("appendLocalAllianceChatMessage");
    expect(runtime).toContain("readAlliancePreviewMessages");
    expect(runtime).not.toContain("Preview aliance ukazuje chat bez serverového uložení.");
    expect(runtime).toContain("Hlasování o vyloučení je v preview vypnuté.");
    expect(runtime).toContain("Zpráva uložená jen v tomhle prohlížeči.");
  });

  it("keeps alpha management focused on stable controls", () => {
    expect(runtime).toContain('const renderManagementPanel = (activeAlliance) =>');
    expect(runtime).toContain('management: renderManagementPanel(activeAlliance)');
    expect(runtime).toContain('openAllianceManagementTab');
    expect(runtime).toContain('id="alliance-management-invite-name"');
    expect(runtime).toContain("alliance-management-ready-btn");
    expect(runtime).toContain("renderKickVoteAvailabilityNote(activeAlliance)");
    expect(runtime).toContain("data-alliance-leave-open");
    expect(runtime).not.toContain("renderManagementTeaser");
    expect(runtime).not.toContain("renderAllianceManagementState");
    expect(runtime).not.toContain("renderDefenseContributions");
    expect(html).not.toContain('id="alliance-management-modal"');
  });

  it("registers twenty original alliance SVG assets without external icon dependencies", () => {
    const actualFiles = readdirSync(resolve(root, "public/alliance-icons")).sort();
    expect(actualFiles).toEqual([...expectedIconFiles].sort());
    for (const fileName of expectedIconFiles) {
      const svg = readText(`public/alliance-icons/${fileName}`);
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('fill="currentColor"');
      expect(svg).not.toContain("http://www.w3.org/1999/xlink");
      expect(iconRegistry).toContain(`/alliance-icons/${fileName}`);
    }
    expect(iconRegistry.split('asset: "/alliance-icons/alliance-').length - 1).toBe(20);
    for (const tag of [
      "REAPER",
      "SNAKE",
      "WOLF",
      "RAVEN",
      "SKULL",
      "COBRA",
      "SPIDER",
      "SCORPION",
      "VULTURE",
      "DAGGER",
      "FIST",
      "CROWN",
      "MASK",
      "CLAW",
      "FANGS",
      "EYE",
      "JACKAL",
      "HYDRA",
      "GHOST",
      "BULL"
    ]) {
      expect(iconRegistry).toContain(`tag: "${tag}"`);
    }
    expect(iconRegistry).toContain("LEGACY_TAG_TO_ICON_ID");
    expect(iconRegistry).toContain("CRWN: \"crown\"");
    expect(iconRegistry).toContain("BLAD: \"dagger\"");
    expect(iconRegistry).toContain("PACK: \"wolf\"");
  });

  it("uses registered alliance icons in UI and canvas map badges", () => {
    expect(runtime).toContain('from "./alliance-icons.js"');
    expect(runtime).toContain("ALLIANCE_ICON_OPTIONS.map");
    expect(runtime).toContain("getAllianceIconByTag");
    expect(runtime).toContain("asset: icon.asset");
    expect(css).toContain("mask: var(--alliance-icon-url) center / contain no-repeat;");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(mapCanvasAnimations).toContain("allianceIconImageCache");
    expect(mapCanvasAnimations).toContain("createTintedAllianceIconCanvas");
    expect(mapCanvasAnimations).toContain("drawFallbackAllianceBadgeText");
  });

  it("keeps the alliance modal on four clear tabs", () => {
    for (const label of ["Přehled", "Chat", "Správa", "Pozvánky"]) {
      expect(runtime).toContain(`label: "${label}"`);
    }
    expect(runtime).not.toContain('label: "Členové"');
    expect(runtime).not.toContain("members: renderMembersPanel(activeAlliance)");
    expect(runtime).toContain('class="alliance-tabs"');
    expect(runtime).toContain('class="alliance-tabs__list"');
    expect(runtime).toContain("data-alliance-modal-close");
    expect(runtime).toContain('class="alliance-tab-panel"');
    expect(runtime).toContain('data-alliance-tab');
    expect(runtime).toContain("Viditelný jen pro členy aliance.");
    expect(runtime).toContain("server-chat-panel alliance-chat--modal");
    expect(runtime).toContain("server-chat-panel__send server-chat-panel__send--arrow");
    expect(runtime).toContain('data-alliance-chat-send aria-label="Odeslat zprávu"');
    expect(css).toContain(".alliance-chat__visibility");
    expect(css).toContain(".alliance-chat--modal .alliance-chat__item");
    expect(css).toContain(".alliance-chat--modal .server-chat-panel__send--arrow");
  });

  it("uses explicit disband copy for leaders", () => {
    expect(runtime).toContain("const getAllianceExitCopy = (activeAlliance) =>");
    expect(runtime).toContain("Rozpustit alianci?");
    expect(runtime).toContain("Tahle akce zruší alianci pro všechny členy.");
    expect(runtime).toContain("Rozpustit alianci");
    expect(runtime).toContain("disband-alliance");
    expect(html).toContain('id="alliance-leave-modal-title"');
    expect(html).toContain('id="alliance-leave-modal-text"');
  });

  it("keeps alliance modals scrollable and mobile-stable", () => {
    expect(css).toContain("Alliance UI consolidated");
    expect(css).toContain("width: min(900px, calc(100vw - 36px));");
    expect(css).toContain(".alliance-tab-panel");
    expect(css).toContain(".alliance-tabs__close");
    expect(css).toContain("justify-content: flex-start;");
    expect(css).toContain(".alliance-management-panel");
    expect(css).not.toContain("#alliance-management-modal");
    expect(css).toContain("max-height: calc(var(--mobile-locked-vh, 100svh) - 20px);");
    expect(css).toContain("-webkit-overflow-scrolling: touch;");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("margin-top: -8px;");
    expect(mobileCss).toContain("Mobile global chat: show about three messages");
    expect(mobileCss).toContain("#global-chat-card .server-chat-panel__feed");
    expect(mobileCss).toContain("max-height: 132px !important;");
    expect(mobileCss).toContain("scrollbar-width: none !important;");
    expect(mobileCss).toContain("#alliance-member-lightbox.avatar-lightbox:not(.hidden)");
    expect(mobileCss).toContain("z-index: 16000 !important;");
    expect(mobileCss).toContain("isolation: isolate !important;");
    expect(css).toContain("max-height: min(76svh, 680px);");
    expect(css).toContain("object-fit: contain;");
    expect(mobileCss).toContain("max-height: calc(var(--mobile-locked-vh, 100svh) - 118px");
  });

  it("documents alpha readiness and residual risks", () => {
    for (const heading of [
      "## Co aktuálně aliance umí",
      "## Co je jen UI",
      "## Co je local/session fallback",
      "## Co je server-ready",
      "## Co bylo upraveno",
      "## Rizika exploitů",
      "## Mobile checklist",
      "## Doporučení"
    ]) {
      expect(audit).toContain(heading);
    }
    expect(audit).toContain("Almost ready.");
  });
});
