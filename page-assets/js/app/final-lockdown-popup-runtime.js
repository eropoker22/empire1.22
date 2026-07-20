import { getActiveServerRegistration } from "./auth-flow.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

export const SERVER_MILESTONE_IDS = Object.freeze(["welcome", "first-purge", "lockdown", "winners"]);

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ACKNOWLEDGEMENT_KEY_PREFIX = "empire:server-milestone:seen";
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const SERVER_MILESTONE_CONTENT = Object.freeze({
  welcome: Object.freeze({
    eyebrow: "VÍTEJ NA SERVERU",
    title: "Válka o město začíná",
    lead: "Dostal jsi jeden district, pár lidí a jméno, které zatím nikdo nemusí respektovat.",
    copy: "Získej informace. Rozjeď výrobu. Hlídej Heat a nevěř dohodě, která tě nic nestála. Každý server je samostatná válka a všechno, co vybuduješ, musíš také ubránit.",
    stats: Object.freeze([
      Object.freeze({ label: "Start", value: "1 district" }),
      Object.freeze({ label: "Cíl", value: "Ovládnout město" }),
      Object.freeze({ label: "Pravidlo", value: "Přežít" })
    ]),
    callout: "Město ti nic nedluží. Od této chvíle si všechno bereš sám.",
    confirm: "Vstoupit do ulic",
    feedTitle: "Vítej na serveru",
    feedSummary: "Tvoje válka o Empire Streets právě začala."
  }),
  "first-purge": Object.freeze({
    eyebrow: "PRVNÍ OČISTA",
    title: "Za čtyři hodiny město začne vybírat",
    lead: "První Očista se spustí za 4 hodiny. Do té doby musíš městu dokázat, že nejsi nejslabší článek.",
    copy: "Buduj Empire score, zabírej území a nenech svoje impérium stát na místě. Odpočet není varování pro později. Je to čas, který už právě ztrácíš.",
    stats: Object.freeze([
      Object.freeze({ label: "První Očista", value: "Za 4 hodiny" }),
      Object.freeze({ label: "Rozhoduje", value: "Stav impéria" }),
      Object.freeze({ label: "V sázce", value: "Tvoje místo" })
    ]),
    callout: "Až odpočet doběhne, pravidla už číst nebudeš. Budeš jen čekat, čí jméno město smaže.",
    confirm: "Začít se připravovat",
    feedTitle: "První Očista za 4 hodiny",
    feedSummary: "Město spustilo odpočet k prvnímu vyřazení."
  }),
  lockdown: Object.freeze({
    eyebrow: "FINAL LOCKDOWN ZAČAL",
    title: "Zůstalo posledních osm hráčů",
    lead: "Město se uzavřelo. Do konce války zbývá posledních 12 hodin.",
    copy: "Bezpečné tempo skončilo. Každý district, budova a rozhodnutí teď mění konečné pořadí. Diplomacie má cenu jen tehdy, když ti koupí čas na poslední úder.",
    stats: Object.freeze([
      Object.freeze({ label: "Zbývá hráčů", value: "8" }),
      Object.freeze({ label: "Čas do konce", value: "12 hodin" }),
      Object.freeze({ label: "Fáze", value: "Final Lockdown" })
    ]),
    callout: "Na začátku buduješ. Uprostřed intrikuješ. Na konci bereš.",
    confirm: "Jdu do finále",
    feedTitle: "Final Lockdown začal",
    feedSummary: "Zůstalo 8 hráčů a posledních 12 hodin války."
  }),
  winners: Object.freeze({
    eyebrow: "VÁLKA SKONČILA",
    title: "Město zná své vítěze",
    lead: "Final Lockdown skončil. Empire score rozhodl, která jména město nezapomene.",
    copy: "Tahle válka je uzavřená. Zdroje, districty ani síla se nepřenášejí. Další server začne znovu od nuly — ale pověst vítězů zůstává.",
    stats: Object.freeze([]),
    callout: "Město nemá pravidla. Jen následky. A tentokrát mají jména.",
    confirm: "Zavřít výsledky",
    feedTitle: "Válka skončila: město má vítěze",
    feedSummary: "Otevři konečné pořadí prvních tří hráčů."
  })
});

const formatScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? Math.round(score).toLocaleString("cs-CZ") : "--";
};

const createAcknowledgementKey = (serverInstanceId, id) =>
  `${ACKNOWLEDGEMENT_KEY_PREFIX}:${encodeURIComponent(String(serverInstanceId || "server"))}:${id}`;

const hasAcknowledged = (storage, serverInstanceId, id) => {
  try {
    return storage?.getItem?.(createAcknowledgementKey(serverInstanceId, id)) === "1";
  } catch {
    return false;
  }
};

const acknowledge = (storage, serverInstanceId, id) => {
  try {
    storage?.setItem?.(createAcknowledgementKey(serverInstanceId, id), "1");
  } catch {
    return;
  }
};

export function shouldOpenFirstPurgeCard(gameplaySlice = {}) {
  const elimination = gameplaySlice.elimination || gameplaySlice.player?.elimination;
  if (!elimination?.enabled || elimination.eliminationsStopped) return false;
  const nextTick = Number(elimination.nextEliminationTick);
  const firstTick = Number(elimination.firstEliminationTick);
  const remainingTicks = Number(elimination.ticksUntilNextElimination);
  const tickRateMs = Math.max(1, Number(gameplaySlice.mode?.tickRateMs || 0));
  if (![nextTick, firstTick, remainingTicks, tickRateMs].every(Number.isFinite)) return false;
  return nextTick === firstTick
    && remainingTicks >= 0
    && remainingTicks <= Math.ceil(FOUR_HOURS_MS / tickRateMs);
}

const createStatElement = (documentRef, stat) => {
  const element = documentRef.createElement("div");
  element.className = "server-milestone-card__stat";
  const label = documentRef.createElement("span");
  const value = documentRef.createElement("strong");
  label.textContent = String(stat?.label || "");
  value.textContent = String(stat?.value || "--");
  element.append(label, value);
  return element;
};

const createRankingElement = (documentRef, entry, index) => {
  const item = documentRef.createElement("li");
  if (entry?.isCurrentPlayer) item.classList.add("is-current-player");
  const rank = documentRef.createElement("span");
  const name = documentRef.createElement("strong");
  const score = documentRef.createElement("em");
  rank.textContent = String(Number(entry?.rank) || index + 1);
  name.textContent = String(entry?.playerName || `Hráč #${index + 1}`);
  score.textContent = formatScore(entry?.score);
  item.append(rank, name, score);
  return item;
};

export function createServerMilestoneFeedSnapshot(id, timestampMs = Date.now(), payload = {}) {
  const content = SERVER_MILESTONE_CONTENT[id];
  if (!content) return null;
  return {
    id: `server-milestone:${id}`,
    timestampMs,
    tone: id === "winners" ? "success" : id === "welcome" ? "event" : "warning",
    title: content.feedTitle,
    summary: content.feedSummary,
    meta: "Serverové hlášení · klikni pro detail",
    resultKind: "server-milestone",
    resultPayload: {
      ...payload,
      openable: true,
      milestoneId: id,
      tone: id === "winners" ? "victory" : id === "welcome" ? "event" : "warning"
    },
    category: "server",
    visibility: "global"
  };
}

export function bindServerMilestoneCards(documentRef = document, options = {}) {
  const modal = documentRef?.querySelector?.("[data-server-milestone-modal]");
  if (!modal || modal.dataset.serverMilestoneBound === "true") return null;
  modal.dataset.serverMilestoneBound = "true";

  const windowRef = documentRef.defaultView || window;
  const storage = options.storage || windowRef.localStorage;
  const card = modal.querySelector(".server-milestone-card");
  const elements = {
    eyebrow: modal.querySelector("[data-server-milestone-eyebrow]"),
    title: modal.querySelector("[data-server-milestone-title]"),
    lead: modal.querySelector("[data-server-milestone-lead]"),
    copy: modal.querySelector("[data-server-milestone-copy]"),
    stats: modal.querySelector("[data-server-milestone-stats]"),
    ranking: modal.querySelector("[data-server-milestone-ranking]"),
    rankingList: modal.querySelector("[data-server-milestone-ranking-list]"),
    callout: modal.querySelector("[data-server-milestone-callout]"),
    confirm: modal.querySelector("[data-server-milestone-confirm]")
  };
  if (!card || Object.values(elements).some((element) => !element)) return null;

  const payloads = new Map();
  let activeId = "";
  let initialFocus = null;

  const publishFeedEntry = (id, payload = {}) => {
    const snapshot = createServerMilestoneFeedSnapshot(id, Date.now(), payload);
    if (!snapshot) return;
    documentRef.dispatchEvent(new windowRef.CustomEvent("empire:street-news-publish", { detail: { snapshot } }));
  };

  const render = (id, payload = {}) => {
    const content = SERVER_MILESTONE_CONTENT[id];
    if (!content) return false;
    const ranking = Array.isArray(payload.ranking) ? payload.ranking.slice(0, 3) : [];
    const stats = Array.isArray(payload.stats) && payload.stats.length ? payload.stats : content.stats;
    activeId = id;
    modal.dataset.serverMilestone = id;
    elements.eyebrow.textContent = content.eyebrow;
    elements.title.textContent = content.title;
    elements.lead.textContent = payload.lead || content.lead;
    elements.copy.textContent = content.copy;
    elements.callout.textContent = content.callout;
    elements.confirm.textContent = content.confirm;
    elements.stats.replaceChildren(...stats.map((stat) => createStatElement(documentRef, stat)));
    elements.stats.hidden = stats.length === 0;
    elements.rankingList.replaceChildren(...ranking.map((entry, index) => createRankingElement(documentRef, entry, index)));
    elements.ranking.hidden = ranking.length === 0;
    return true;
  };

  const open = (id, payload = {}) => {
    if (!modal.hidden || !render(id, payload)) return false;
    initialFocus = documentRef.activeElement;
    modal.hidden = false;
    openOverlay(modal, {
      type: "server-milestone",
      focusTarget: modal.querySelector("[data-server-milestone-close]"),
      restoreFocusTo: initialFocus,
      restoreFocusOnClose: false
    });
    return true;
  };

  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    closeOverlay(modal, { restoreFocus: false });
    activeId = "";
    if (initialFocus?.isConnected && typeof initialFocus.focus === "function") {
      initialFocus.focus({ preventScroll: true });
    }
    initialFocus = null;
  };

  const announce = (id, serverInstanceId, payload = {}) => {
    if (!SERVER_MILESTONE_IDS.includes(id) || !serverInstanceId || !modal.hidden) return false;
    if (hasAcknowledged(storage, serverInstanceId, id)) return false;
    payloads.set(id, payload);
    if (!open(id, payload)) return false;
    acknowledge(storage, serverInstanceId, id);
    publishFeedEntry(id, payload);
    return true;
  };

  const handleGameplaySlice = (gameplaySlice = {}) => {
    const serverInstanceId = String(gameplaySlice.server?.serverInstanceId || gameplaySlice.player?.instanceId || "");
    if (!serverInstanceId || !modal.hidden) return false;
    if (announce("welcome", serverInstanceId)) return true;
    if (shouldOpenFirstPurgeCard(gameplaySlice) && announce("first-purge", serverInstanceId)) return true;

    const elimination = gameplaySlice.elimination || gameplaySlice.player?.elimination;
    const finalLockdown = gameplaySlice.player?.finalLockdown;
    const activePlayersRemaining = Number(elimination?.activePlayersRemaining);
    const status = String(finalLockdown?.status || "");
    const ranking = Array.isArray(finalLockdown?.leaderboardTop3) ? finalLockdown.leaderboardTop3.slice(0, 3) : [];
    const lockdownActive = Boolean(finalLockdown?.enabled && (finalLockdown.active || status === "active" || status === "paused"));
    const finalEightReached = !Number.isFinite(activePlayersRemaining) || activePlayersRemaining <= 8;

    if (lockdownActive && finalEightReached && announce("lockdown", serverInstanceId, { ranking })) return true;
    if (finalLockdown?.enabled && status === "resolved" && ranking.length >= 3) {
      const rank = Number(finalLockdown.currentPlayerRank);
      const lead = Number.isFinite(rank)
        ? `Skončil jsi na ${rank}. místě s Empire score ${formatScore(finalLockdown.currentPlayerFinalScore)}.`
        : SERVER_MILESTONE_CONTENT.winners.lead;
      return announce("winners", serverInstanceId, { ranking, lead });
    }
    return false;
  };

  modal.querySelectorAll("[data-server-milestone-close]").forEach((element) => element.addEventListener("click", close));
  elements.confirm.addEventListener("click", close);
  documentRef.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(card.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => !element.hidden);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  documentRef.addEventListener("empire:server-milestone-open", (event) => {
    const id = String(event?.detail?.milestoneId || "");
    if (!SERVER_MILESTONE_IDS.includes(id)) return;
    open(id, payloads.get(id) || event.detail?.payload || {});
  });
  documentRef.addEventListener("empire:gameplay-slice-rendered", (event) => {
    handleGameplaySlice(event?.detail?.gameplaySlice || {});
  });

  if (options.autoWelcome !== false) {
    let attempts = 0;
    const waitForRuntime = () => {
      const root = documentRef.querySelector("#game-root");
      if (root?.dataset?.runtimeInit === "ready" || attempts >= 80) {
        const registration = getActiveServerRegistration();
        const serverInstanceId = String(registration?.serverInstanceId || registration?.serverId || "");
        if (serverInstanceId) announce("welcome", serverInstanceId);
        return;
      }
      attempts += 1;
      windowRef.setTimeout(waitForRuntime, 50);
    };
    windowRef.setTimeout(waitForRuntime, 0);
  }

  return Object.freeze({ announce, close, handleGameplaySlice, open, getActiveId: () => activeId });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bindServerMilestoneCards(document), { once: true });
  } else {
    bindServerMilestoneCards(document);
  }
}
