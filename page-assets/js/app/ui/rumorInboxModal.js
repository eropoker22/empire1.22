import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

const controllersByDocument = new WeakMap();

const RUMOR_TRASH_ICON = `
  <span class="rumor-inbox-trash-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <path d="M4 7h16"></path>
      <path d="M9 3h6l1 4H8l1-4Z"></path>
      <path d="m6.5 7 1 13h9l1-13"></path>
      <path d="M10 11v5M14 11v5"></path>
    </svg>
  </span>
`;

const MAX_VISIBLE_RUMORS = 7;

function syncRumorListViewport(list) {
  if (!list) return;
  const messages = [...list.querySelectorAll(".rumor-inbox-message")];
  list.dataset.rumorScrollable = String(messages.length > MAX_VISIBLE_RUMORS);
  list.style.removeProperty("--rumor-visible-height");
  list.dataset.rumorVisibleCount = String(Math.min(messages.length, MAX_VISIBLE_RUMORS));
  if (messages.length <= MAX_VISIBLE_RUMORS) return;

  const documentRef = list.ownerDocument;
  const view = documentRef?.defaultView;
  const card = list.closest(".rumor-inbox-card");
  if (!view || !card) return;

  const measure = () => {
    const shellStyle = view.getComputedStyle(card.parentElement);
    const readPixels = (value) => Number.parseFloat(value) || 0;
    const shellPadding = readPixels(shellStyle.paddingTop) + readPixels(shellStyle.paddingBottom);
    const headerHeight = card.querySelector(".rumor-inbox-header")?.getBoundingClientRect?.().height || 0;
    const signalHeight = card.querySelector(".rumor-inbox-signal-bar")?.getBoundingClientRect?.().height || 0;
    const viewportCardMaxHeight = view.innerWidth <= 720
      ? view.innerHeight - shellPadding
      : Math.min(view.innerHeight * 0.88, 860, view.innerHeight - shellPadding);
    const cardMaxHeight = Math.max(0, viewportCardMaxHeight);
    const availableHeight = Math.max(0, cardMaxHeight - headerHeight - signalHeight);
    const cardEdges = messages.map((message) => {
      return {
        top: Number(message.offsetTop) || 0,
        bottom: (Number(message.offsetTop) || 0) + (Number(message.offsetHeight) || 0)
      };
    });
    let visibleCount = 0;

    for (const edge of cardEdges.slice(0, MAX_VISIBLE_RUMORS)) {
      if (edge.bottom <= edge.top) return;
      if (visibleCount > 0 && edge.bottom > availableHeight) break;
      visibleCount += 1;
    }

    if (visibleCount > 0) {
      const nextEdge = cardEdges[visibleCount];
      const lastVisibleEdge = cardEdges[visibleCount - 1];
      const contentHeight = nextEdge?.top || lastVisibleEdge?.bottom || availableHeight;
      const borderAdjustment = Math.max(0, list.offsetHeight - list.clientHeight);
      const visibleHeight = Math.min(availableHeight, contentHeight + borderAdjustment);
      list.style.setProperty("--rumor-visible-height", `${Math.ceil(visibleHeight)}px`);
      list.dataset.rumorVisibleCount = String(visibleCount);
    }
  };

  measure();
  view.requestAnimationFrame?.(measure);
}

function createElement(documentRef, tagName, className = "", text = "") {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function getRumorDistrictLabel(entry = {}) {
  const row = Array.isArray(entry?.resultPayload?.rows)
    ? entry.resultPayload.rows.find((item) => String(item?.label || "").trim().toLowerCase() === "district")
    : null;
  return String(row?.value || "Ulice bez adresy").trim();
}

function getRumorText(entry = {}) {
  const row = Array.isArray(entry?.resultPayload?.rows)
    ? entry.resultPayload.rows.find((item) => String(item?.label || "").trim().toLowerCase() === "drb")
    : null;
  return String(row?.value || entry?.summary || "Město zachytilo nový signál.").trim();
}

function createRumorInboxController(documentRef) {
  const shell = createElement(documentRef, "section", "rumor-inbox-shell");
  shell.hidden = true;
  shell.dataset.rumorInbox = "true";
  shell.dataset.uiOwner = "legacy-shared";

  const backdrop = createElement(documentRef, "button", "rumor-inbox-backdrop");
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Zavřít drby z ulice");

  const card = createElement(documentRef, "div", "rumor-inbox-card");
  card.setAttribute("role", "document");

  const header = createElement(documentRef, "header", "rumor-inbox-header");
  const headerCopy = createElement(documentRef, "div", "rumor-inbox-header__copy");
  const eyebrow = createElement(documentRef, "span", "rumor-inbox-eyebrow", "ULIČNÍ SÍŤ");
  const titleRow = createElement(documentRef, "div", "rumor-inbox-title-row");
  const title = createElement(documentRef, "h3", "rumor-inbox-title", "Drby z ulice");
  const count = createElement(documentRef, "strong", "rumor-inbox-count", "0");
  count.dataset.rumorInboxCount = "true";
  titleRow.append(title, count);
  const subtitle = createElement(documentRef, "p", "rumor-inbox-subtitle", "Zachycené signály, šeptanda a špína z města.");
  headerCopy.append(eyebrow, titleRow, subtitle);

  const closeButton = createElement(documentRef, "button", "rumor-inbox-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Zavřít drby z ulice");
  const deleteAllButton = createElement(documentRef, "button", "rumor-inbox-delete-all");
  deleteAllButton.type = "button";
  deleteAllButton.setAttribute("aria-label", "Smazat všechny drby z ulice");
  deleteAllButton.title = "Smazat všechny drby";
  deleteAllButton.innerHTML = RUMOR_TRASH_ICON;
  header.append(headerCopy, deleteAllButton, closeButton);

  const signalBar = createElement(documentRef, "div", "rumor-inbox-signal-bar");
  signalBar.setAttribute("aria-hidden", "true");
  signalBar.append(
    createElement(documentRef, "span"),
    createElement(documentRef, "span"),
    createElement(documentRef, "span"),
    createElement(documentRef, "span"),
    createElement(documentRef, "span")
  );

  const list = createElement(documentRef, "div", "rumor-inbox-list");
  list.dataset.rumorInboxList = "true";
  const empty = createElement(documentRef, "p", "rumor-inbox-empty", "Ulice jsou zatím podezřele tiché.");
  empty.hidden = true;
  card.append(header, signalBar, list, empty);
  shell.append(backdrop, card);
  documentRef.body.append(shell);

  const close = () => {
    shell.hidden = true;
    closeOverlay(shell);
  };

  backdrop.addEventListener("click", close);
  closeButton.addEventListener("click", close);
  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    open(rumors = [], onOpenRumor = () => {}, onDeleteRumor = () => {}, onDeleteAll = () => {}) {
      let entries = Array.isArray(rumors) ? rumors : [];
      const renderEntries = () => {
      count.textContent = String(entries.length);
      list.replaceChildren(...entries.map((entry, index) => {
        const message = createElement(documentRef, "article", "rumor-inbox-message");
        const button = createElement(documentRef, "button", "rumor-inbox-message__open-button");
        button.type = "button";
        button.dataset.rumorMessageId = String(entry?.id || index);
        button.setAttribute("aria-label", `Otevřít drb ${index + 1}`);

        const messageHead = createElement(documentRef, "span", "rumor-inbox-message__head");
        const ordinal = createElement(documentRef, "strong", "rumor-inbox-message__number", String(entries.length - index).padStart(2, "0"));
        const district = createElement(documentRef, "span", "rumor-inbox-message__district", getRumorDistrictLabel(entry));
        const time = createElement(documentRef, "time", "rumor-inbox-message__time", String(entry?.timeLabel || "TEĎ"));
        messageHead.append(ordinal, district, time);

        const text = createElement(documentRef, "span", "rumor-inbox-message__text", getRumorText(entry));
        const openLabel = createElement(documentRef, "span", "rumor-inbox-message__open", "OTEVŘÍT DRB ↗");
        button.append(messageHead, text, openLabel);
        button.addEventListener("click", () => {
          close();
          onOpenRumor(entry);
        });
        const deleteButton = createElement(documentRef, "button", "rumor-inbox-message__delete");
        deleteButton.type = "button";
        deleteButton.dataset.rumorDeleteId = String(entry?.id || index);
        deleteButton.setAttribute("aria-label", `Smazat drb ${index + 1}`);
        deleteButton.title = "Smazat drb";
        deleteButton.innerHTML = RUMOR_TRASH_ICON;
        deleteButton.addEventListener("click", () => {
          const remainingEntries = entries.filter((candidate) => candidate !== entry);
          const resolvedEntries = onDeleteRumor(entry, remainingEntries);
          entries = Array.isArray(resolvedEntries) ? resolvedEntries : remainingEntries;
          renderEntries();
        });
        message.append(button, deleteButton);
        return message;
      }));
      empty.hidden = entries.length > 0;
      list.hidden = entries.length === 0;
      deleteAllButton.hidden = entries.length === 0;
      syncRumorListViewport(list);
      };
      deleteAllButton.onclick = () => {
        const resolvedEntries = onDeleteAll(entries);
        entries = Array.isArray(resolvedEntries) ? resolvedEntries : [];
        renderEntries();
      };
      renderEntries();
      openOverlay(shell, {
        type: "rumor-inbox",
        alwaysOnTop: true,
        focusTarget: closeButton,
        restoreFocusOnClose: true
      });
      syncRumorListViewport(list);
      return true;
    }
  };
}

export function openRumorInboxModal({ documentRef, rumors, onOpenRumor, onDeleteRumor, onDeleteAll } = {}) {
  const ownerDocument = documentRef || (typeof document !== "undefined" ? document : null);
  if (!ownerDocument?.body) return false;
  let controller = controllersByDocument.get(ownerDocument);
  if (!controller) {
    controller = createRumorInboxController(ownerDocument);
    controllersByDocument.set(ownerDocument, controller);
  }
  return controller.open(rumors, onOpenRumor, onDeleteRumor, onDeleteAll);
}
