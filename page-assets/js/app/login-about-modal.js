import { ABOUT_GAME_GROUPS, ABOUT_GAME_SECTIONS } from "../data/about-game-sections.js";

const FOCUSABLE_SELECTOR = "button:not([disabled]), select:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const DEFAULT_SECTION_BLOCK_TITLES = Object.freeze(["Jak válka funguje", "Co ti dá výhodu", "O co můžeš přijít"]);
const SECTION_BLOCK_TITLES = Object.freeze({
  start: ["První vstup", "Co musí být připravené", "Co už nejde vzít zpět"],
  servers: ["Jak se dostat dovnitř", "Podmínky vstupu", "Kdy zůstaneš venku"],
  membership: ["Co platí po vstupu", "Co hlídá čas", "Kdy už neodejdeš"],
  factions: ["Styly frakcí", "Jak vybírat", "Špatná volba bolí"],
  districts: ["Co jednotlivé zóny přinášejí", "Co určuje hodnotu districtu", "Co mění hranice"],
  victory: ["Cesta k vítězství", "Co se v závěru počítá", "Co impérium zlomí"],
  "free-mode": ["Jak probíhá Free Mode", "Co musíš zvládnout", "Čemu se vyhnout"],
  "war-mode": ["Co je v plánu", "Na čem má režim stát", "Co zatím neplatí"],
  economy: ["Jak zdroje obíhají", "Co musíš hlídat", "Kde vzniká tlak"],
  buildings: ["Výrobní postup", "Co výrobu omezuje", "Co ji zastaví"],
  storage: ["Jak přebírat zásoby", "Co určuje kapacitu", "Kdy se sklad zasekne"],
  market: ["Jak obchodovat", "Co určuje cenu", "Co o sobě prozradíš"],
  "day-night": ["Jak pracovat s fází", "Co mění dostupnost", "Co zkazí načasování"],
  spy: ["Průběh špehování", "Co ovlivní výsledek", "Co může operace stát"],
  rob: ["Jak vykrást district", "Co určuje kořist", "Kdy odejdeš s prázdnou"],
  heist: ["Průběh heistu", "Co rozhodne výsledek", "Možné následky"],
  attack: ["Průběh útoku", "Co rozhoduje boj", "Co nasazuješ do hry"],
  defense: ["Jak připravit district", "Z čeho obrana roste", "Co se skutečně spotřebuje"],
  trap: ["Jak past nastražit", "Co určuje spuštění", "Jak může selhat"],
  boosts: ["Jak boost aktivovat", "Co musíš mít", "Kdy ho promarníš"],
  heat: ["Jak Heat vzniká", "Co zvyšuje tlak", "Co přichází potom"],
  police: ["Jak reagovat", "Co určuje zásah", "Následky policejního zásahu"],
  purge: ["Jak se připravit", "Co hra sleduje", "Co znamená porážka"],
  bounty: ["Jak vypsat odměnu", "Co musí sedět", "Co Bounty rozpoutá"],
  rumors: ["Jak číst městské zprávy", "Co má cenu ověřit", "Kdy informace škodí"],
  alliances: ["Co Aliance umí", "Na čem stojí pomoc", "Kde vzniká zrada"],
  "last-stand": ["Jak využít poslední šanci", "Co omezuje ochranu", "Kdy už nepomůže"],
  "final-lockdown": ["Jak přežít závěr", "Co určuje pořadí", "Co už nejde zachránit"]
});
let lastAboutSectionId = "overview";
let openModalCount = 0;

const createNode = (documentRef, tagName, className = "", text = "") => {
  const node = documentRef.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const appendList = (documentRef, parent, title, items, className = "") => {
  const block = createNode(documentRef, "section", `login-about-section-block ${className}`.trim());
  block.append(createNode(documentRef, "h4", "", title));
  const list = createNode(documentRef, "ul");
  for (const item of items) list.append(createNode(documentRef, "li", "", item));
  block.append(list);
  parent.append(block);
};

const renderSectionPanel = (documentRef, section, legacyStoryTemplate) => {
  const panel = createNode(documentRef, "article", "login-about-panel");
  panel.id = `login-about-panel-${section.id}`;
  panel.dataset.loginAboutPanel = section.id;
  panel.dataset.aboutTone = section.tone;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `login-about-tab-${section.id}`);
  panel.hidden = section.id !== lastAboutSectionId;

  const hero = createNode(documentRef, "header", "login-about-panel__hero");
  const identity = createNode(documentRef, "div", "login-about-panel__identity");
  identity.append(createNode(documentRef, "span", "login-about-panel__kicker", ABOUT_GAME_GROUPS.find((group) => group.id === section.group)?.label || "Databáze"));
  identity.append(createNode(documentRef, "h3", "", section.label));
  const status = createNode(documentRef, "span", "login-about-status", section.status);
  status.dataset.aboutStatus = section.status.toLowerCase().replace(/\s+/g, "-");
  hero.append(identity, status);
  panel.append(hero, createNode(documentRef, "p", "login-about-panel__hook", `„${section.hook}“`), createNode(documentRef, "p", "login-about-panel__intro", section.intro));

  if (section.chips?.length) {
    const chips = createNode(documentRef, "div", "login-about-panel__chips");
    for (const chip of section.chips) chips.append(createNode(documentRef, "span", "", chip));
    panel.append(chips);
  }

  const grid = createNode(documentRef, "div", "login-about-panel__grid");
  const [howTitle, factorsTitle, consequencesTitle] = SECTION_BLOCK_TITLES[section.id] || DEFAULT_SECTION_BLOCK_TITLES;
  appendList(documentRef, grid, howTitle, section.howItWorks, "login-about-section-block--wide");
  appendList(documentRef, grid, factorsTitle, section.decidingFactors);
  appendList(documentRef, grid, consequencesTitle, section.risks, "login-about-section-block--risk");
  panel.append(grid);

  const callout = createNode(documentRef, "blockquote", "login-about-panel__callout", section.callout);
  panel.append(callout);
  if (section.id === "overview" && legacyStoryTemplate?.content) {
    panel.append(legacyStoryTemplate.content.cloneNode(true));
  }
  return panel;
};

const renderAboutEncyclopedia = (overlay) => {
  if (overlay.dataset.loginAboutRendered === "true") return;
  const documentRef = overlay.ownerDocument;
  const tabList = overlay.querySelector("[data-login-about-tabs]");
  const select = overlay.querySelector("[data-login-about-select]");
  const panels = overlay.querySelector("[data-login-about-panels]");
  const legacyStoryTemplate = overlay.querySelector("[data-login-about-legacy-story]");
  if (!tabList || !(select instanceof HTMLSelectElement) || !panels) return;

  for (const group of ABOUT_GAME_GROUPS) {
    const groupShell = createNode(documentRef, "section", "login-about-nav-group");
    groupShell.append(createNode(documentRef, "h3", "", group.label));
    const groupTabs = createNode(documentRef, "div", "login-about-nav-group__tabs");
    for (const section of ABOUT_GAME_SECTIONS.filter((entry) => entry.group === group.id)) {
      const tab = createNode(documentRef, "button", "login-about-tab");
      tab.type = "button";
      tab.id = `login-about-tab-${section.id}`;
      tab.dataset.loginAboutTab = section.id;
      tab.dataset.aboutTone = section.tone;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `login-about-panel-${section.id}`);
      tab.setAttribute("aria-selected", String(section.id === lastAboutSectionId));
      tab.tabIndex = section.id === lastAboutSectionId ? 0 : -1;
      const icon = createNode(documentRef, "span", "login-about-tab__icon", section.icon);
      icon.setAttribute("aria-hidden", "true");
      tab.append(icon, createNode(documentRef, "span", "", section.label));
      groupTabs.append(tab);

      const option = createNode(documentRef, "option", "", `${group.label} / ${section.label}`);
      option.value = section.id;
      option.selected = section.id === lastAboutSectionId;
      select.append(option);
      panels.append(renderSectionPanel(documentRef, section, legacyStoryTemplate));
    }
    groupShell.append(groupTabs);
    tabList.append(groupShell);
  }
  overlay.dataset.loginAboutRendered = "true";
};

const setActiveAboutSection = (overlay, sectionId, { focus = false } = {}) => {
  const section = ABOUT_GAME_SECTIONS.find((entry) => entry.id === sectionId) || ABOUT_GAME_SECTIONS[0];
  lastAboutSectionId = section.id;
  overlay.dataset.aboutTone = section.tone;
  overlay.querySelectorAll("[data-login-about-tab]").forEach((tab) => {
    const active = tab.dataset.loginAboutTab === section.id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  overlay.querySelectorAll("[data-login-about-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.loginAboutPanel !== section.id;
  });
  const select = overlay.querySelector("[data-login-about-select]");
  if (select instanceof HTMLSelectElement) select.value = section.id;
  overlay.querySelector("[data-login-about-content]")?.scrollTo?.({ top: 0, behavior: "instant" });
};

const getFocusable = (dialog) => [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

const trapFocus = (event, dialog) => {
  if (event.key !== "Tab") return;
  const focusable = getFocusable(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && dialog.ownerDocument.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && dialog.ownerDocument.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const setBodyModalState = (documentRef, open) => {
  openModalCount = Math.max(0, openModalCount + (open ? 1 : -1));
  documentRef.body.classList.toggle("login-modal-open", openModalCount > 0);
};

const bindDialog = ({ overlay, openButtons, closeSelector, onOpen, onKeyDown }) => {
  if (!(overlay instanceof HTMLElement) || overlay.dataset.loginModalBound === "true") return;
  const dialog = overlay.querySelector("[role='dialog']");
  if (!(dialog instanceof HTMLElement)) return;
  let restoreFocus = null;
  let isOpen = false;
  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    setBodyModalState(overlay.ownerDocument, false);
    restoreFocus?.focus?.();
  };
  const open = (button) => {
    if (isOpen) return;
    isOpen = true;
    restoreFocus = button || overlay.ownerDocument.activeElement;
    onOpen?.();
    overlay.hidden = false;
    overlay.removeAttribute("aria-hidden");
    setBodyModalState(overlay.ownerDocument, true);
    const target = overlay.querySelector("[role='tab'][aria-selected='true']") || dialog;
    target.focus();
  };
  for (const button of openButtons) button.addEventListener("click", () => open(button));
  overlay.querySelectorAll(closeSelector).forEach((button) => button.addEventListener("click", close));
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (onKeyDown?.(event)) return;
    trapFocus(event, dialog);
  });
  overlay.dataset.loginModalBound = "true";
};

export const bindLoginAboutModal = (root = document) => {
  const overlay = root.querySelector("[data-login-about-overlay]");
  const openButtons = [...root.querySelectorAll("[data-login-about-open]")];
  if (!(overlay instanceof HTMLElement) || !openButtons.length || overlay.dataset.loginAboutControllerBound === "true") return;
  overlay.dataset.loginAboutControllerBound = "true";
  renderAboutEncyclopedia(overlay);
  overlay.addEventListener("click", (event) => {
    const tab = event.target.closest?.("[data-login-about-tab]");
    if (tab) setActiveAboutSection(overlay, tab.dataset.loginAboutTab);
  });
  overlay.querySelector("[data-login-about-select]")?.addEventListener("change", (event) => setActiveAboutSection(overlay, event.currentTarget.value));
  bindDialog({
    overlay,
    openButtons,
    closeSelector: "[data-login-about-close]",
    onOpen: () => setActiveAboutSection(overlay, lastAboutSectionId),
    onKeyDown: (event) => {
      const tab = event.target.closest?.("[data-login-about-tab]");
      if (!tab || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return false;
      event.preventDefault();
      const tabs = [...overlay.querySelectorAll("[data-login-about-tab]")];
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (currentIndex + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
      setActiveAboutSection(overlay, tabs[nextIndex].dataset.loginAboutTab, { focus: true });
      return true;
    }
  });
};

export const bindLoginInfoModals = (root = document) => {
  root.querySelectorAll("[data-login-info-overlay]").forEach((overlay) => {
    const modalId = overlay.getAttribute("data-login-info-overlay");
    bindDialog({ overlay, openButtons: [...root.querySelectorAll(`[data-login-info-open="${modalId}"]`)], closeSelector: "[data-login-info-close]" });
  });
};
