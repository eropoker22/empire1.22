import { submitServerAllianceCommand } from "./runtime.js";
import { STORAGE_KEYS } from "../config.js";

const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const GLOBAL_CHAT_KEY = "empire_local_global_chat_state";

let latestAllianceBoard = null;
let selectedIconKey = "crown_skull";
let selectedAllianceTab = "overview";
let pendingKickVoteTarget = null;

const qs = (id) => document.getElementById(id);
const ALLIANCE_MODAL_IDS = [
  "alliance-modal",
  "alliance-create-modal",
  "alliance-leave-modal",
  "alliance-management-modal",
  "alliance-kick-confirm-modal"
];
const ALLIANCE_ICON_OPTIONS = [
  { key: "crown_skull", tag: "CRWN", label: "Koruna", symbol: "CR" },
  { key: "red_blade", tag: "BLAD", label: "Cepel", symbol: "BD" },
  { key: "gold_fist", tag: "FIST", label: "Pest", symbol: "FS" },
  { key: "black_star", tag: "STAR", label: "Hvezda", symbol: "ST" },
  { key: "street_pack", tag: "PACK", label: "Crew", symbol: "PK" }
];

const ALLIANCE_TABS = [
  { key: "overview", label: "Přehled" },
  { key: "members", label: "Členové" },
  { key: "chat", label: "Chat" },
  { key: "management", label: "Správa" },
  { key: "invites", label: "Pozvánky" }
];

const READY_STATUS_COPY = {
  due_soon: { label: "Brzy potvrď aktivitu", hint: "READY bude brzy potřeba potvrdit.", tone: "warning" },
  overdue: { label: "Aktivita po termínu", hint: "Potvrď READY, ať aliance neztratí stabilitu.", tone: "danger" },
  vote_eligible: { label: "Můžeš potvrdit / hlasovat", hint: "Tvůj stav vyžaduje pozornost.", tone: "danger" },
  vote_pending: { label: "Probíhá hlasování", hint: "Aliance řeší hlasování. READY může stav ovlivnit podle pravidel serveru.", tone: "warning" },
  active: { label: "Aktivní", hint: "READY je aktuálně v pořádku.", tone: "success" },
  ready: { label: "Ready", hint: "READY je potvrzené.", tone: "success" }
};

const MEMBER_STATUS_COPY = {
  active: { label: "Aktivní", tone: "success" },
  ready: { label: "Ready", tone: "success" },
  due_soon: { label: "Brzy ready", tone: "warning" },
  overdue: { label: "Po termínu", tone: "danger" },
  vote_eligible: { label: "Lze hlasovat", tone: "danger" },
  vote_pending: { label: "Hlasování", tone: "warning" },
  kicked: { label: "Odebrán", tone: "danger" },
  removed: { label: "Odebrán", tone: "danger" }
};

const CREATE_DISABLED_COPY = {
  already_in_alliance: "Už jsi v alianci.",
  server_locked: "Server teď nepovoluje vytvoření aliance.",
  not_available: "Alianci teď nelze vytvořit."
};

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const normalizeChatColor = (value, fallback = "#facc15") => {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
};

const getPlayerGangColor = () => {
  try {
    return normalizeChatColor(localStorage.getItem(STORAGE_KEYS.gangColor), "#facc15");
  } catch {
    return "#facc15";
  }
};

const getGlobalChatDemoMessages = () => [
  { author: "Razor", text: "Na severu se dneska hýbou hranice. Kdo tam jde bez lidí, ať si rovnou píše závěť.", color: "#ef4444" },
  { author: "Nyx", text: "Bazar má dobré ceny na tech scrap, ale jen dokud někdo nezačne dělat bordel.", color: "#8b5cf6" },
  { author: "Karlos", text: "Potřebuju spojence na rychlou výměnu materiálů. Platím clean, žádné drama.", color: "#22d3ee" },
  { author: "Mira", text: "Viděla jsem cizí scouty u warehouse distriktů. Kontrolujte obranu.", color: "#22c55e" }
];

const isDevOnlyAllianceDemoEnabled = () => {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const createDevOnlyAllianceBoard = (baseBoard = null) => {
  if (!isDevOnlyAllianceDemoEnabled() || baseBoard?.activeAlliance) {
    return baseBoard;
  }
  const nowIso = new Date().toISOString();
  const currentPlayerId = baseBoard?.currentPlayerId || "dev-player";
  const allianceId = "dev-demo-alliance-zabijaci";
  return {
    maxAllianceSize: baseBoard?.maxAllianceSize || 4,
    currentPlayerId,
    activeAlliance: {
      allianceId,
      name: "Zabijaci",
      tag: "BLAD",
      ownerPlayerId: "dev-demo-zabijaci-leader",
      ownerName: "Krvavy Baron",
      memberCount: 3,
      maxMembers: baseBoard?.maxAllianceSize || 4,
      currentPlayerRole: "member",
      canJoin: false,
      joinDisabledReason: "Uz jsi clenem.",
      canInvite: false,
      canLeave: false,
      canDisband: false,
      canConfirmReady: false,
      readyReasonCode: "active",
      activeVote: null,
      eligibleVotes: [],
      members: [
        {
          playerId: currentPlayerId,
          name: "Ty",
          role: "member",
          status: "active",
          readyDueAt: null,
          graceEndsAt: null,
          activeDistrictCount: 3,
          canStartKickVote: false
        },
        {
          playerId: "dev-demo-zabijaci-leader",
          name: "Krvavy Baron",
          role: "leader",
          status: "active",
          readyDueAt: null,
          graceEndsAt: null,
          activeDistrictCount: 5,
          canStartKickVote: false
        },
        {
          playerId: "dev-demo-zabijaci-shadow",
          name: "Nocturno",
          role: "member",
          status: "active",
          readyDueAt: null,
          graceEndsAt: null,
          activeDistrictCount: 2,
          canStartKickVote: false
        }
      ],
      pendingInvites: [],
      chatMessages: [
        {
          messageId: "dev-demo-alliance-chat-1",
          allianceId,
          authorPlayerId: "dev-demo-zabijaci-leader",
          authorName: "Krvavy Baron",
          body: "Zabijaci jsou pripraveni.",
          createdAt: nowIso
        }
      ],
      defenseContributions: [],
      isDevOnlyDemo: true
    },
    publicAlliances: baseBoard?.publicAlliances || [],
    incomingInvites: baseBoard?.incomingInvites || [],
    eligibleInviteTargets: baseBoard?.eligibleInviteTargets || [],
    canCreateAlliance: false,
    createDisabledReason: "Dev demo alliance je aktivni jen lokalne."
  };
};

const formatRelativeTime = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "-";
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return "prave ted";
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  return `pred ${Math.floor(hours / 24)} d`;
};

const formatReadyCountdown = (isoValue) => {
  const delta = Math.max(0, Math.floor((Date.parse(isoValue || "") - Date.now()) / 1000));
  const hours = Math.floor(delta / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  const seconds = delta % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatTimeUntil = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "-";
  const minutes = Math.ceil(Math.max(0, timestamp - Date.now()) / 60000);
  if (minutes <= 1) return "do 1 min";
  if (minutes < 60) return `za ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `za ${hours} h`;
  return `za ${Math.ceil(hours / 24)} d`;
};

const formatShortDateTime = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "-";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
};

const getReadyCopy = (code) =>
  READY_STATUS_COPY[String(code || "active")] || {
    label: "Aliance čeká na stav serveru",
    hint: "Server zatím neposlal detailní READY stav.",
    tone: "neutral"
  };

const getMemberStatusCopy = (status) =>
  MEMBER_STATUS_COPY[String(status || "")] || { label: "Neznámý stav", tone: "neutral" };

const getCreateDisabledReason = (reason) => {
  const normalized = String(reason || "").trim();
  if (!normalized) return "Vytvoření aliance není dostupné.";
  return CREATE_DISABLED_COPY[normalized] || normalized || "Vytvoření aliance není dostupné.";
};

const getInviteDisabledReason = (activeAlliance, targets = []) => {
  if (!activeAlliance) return "Nejsi v žádné alianci.";
  if (activeAlliance.currentPlayerRole !== "leader") return "Pozvat může jen leader.";
  if (Number(activeAlliance.memberCount || 0) >= Number(activeAlliance.maxMembers || 0)) return "Aliance je plná.";
  if (!targets.some((target) => target.canInvite)) return "Žádní dostupní hráči.";
  return "Pozvánky nejsou dostupné.";
};

const getMemberInitials = (name) => String(name || "?").trim().slice(0, 2).toUpperCase();

const getVoteCounts = (vote) => {
  const votes = Object.values(vote?.votes || {});
  return {
    yes: votes.filter((choice) => choice === "yes").length,
    no: votes.filter((choice) => choice === "no").length
  };
};

const notify = (message) => {
  const allianceStatus = qs("alliance-status-line");
  if (allianceStatus) {
    allianceStatus.textContent = message;
  }
  const summary = document.querySelector("[data-building-action-summary]");
  if (summary) summary.textContent = message;
};

const commandMessage = (response, fallback) =>
  response?.errors?.[0]?.message || response?.errors?.[0]?.code || fallback;

const runAllianceCommand = async (type, payload, successMessage) => {
  const response = await submitServerAllianceCommand({ type, payload });
  if (!response?.accepted && response?.errors?.length) {
    notify(commandMessage(response, "Alliance akci se nepodarilo dokoncit."));
    return false;
  }
  notify(successMessage);
  return true;
};

const syncAllianceModalBodyState = () => {
  const hasOpenAllianceModal = ALLIANCE_MODAL_IDS.some((id) => {
    const modal = qs(id);
    return modal && !modal.classList.contains("hidden");
  });
  document.body?.classList.toggle("alliance-modal-open", hasOpenAllianceModal);
};

const setModalVisible = (modal, visible) => {
  if (!modal) return;
  modal.classList.toggle("hidden", !visible);
  modal.setAttribute("aria-hidden", visible ? "false" : "true");
  if (ALLIANCE_MODAL_IDS.includes(modal.id)) {
    syncAllianceModalBodyState();
  }
};

const getSelectedIconOption = () =>
  ALLIANCE_ICON_OPTIONS.find((option) => option.key === selectedIconKey) || ALLIANCE_ICON_OPTIONS[0];

const getAllianceIconOptionByTag = (tag) =>
  ALLIANCE_ICON_OPTIONS.find((option) => option.tag === String(tag || "").toUpperCase())
  || ALLIANCE_ICON_OPTIONS[0];

const renderAllianceIconSvg = (iconKey) => {
  switch (iconKey) {
    case "red_blade":
      return `
        <svg class="alliance-crest-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path class="alliance-crest-svg__blade" d="M47 7 25 35l-8 12 12-8L57 17 47 7Z"></path>
          <path class="alliance-crest-svg__edge" d="M21 41 8 54"></path>
          <path class="alliance-crest-svg__edge" d="m15 47 2 2"></path>
        </svg>
      `;
    case "gold_fist":
      return `
        <svg class="alliance-crest-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path class="alliance-crest-svg__gold" d="M17 27h8v15h-8zM27 21h8v21h-8zM37 24h8v18h-8zM47 29h7v13h-7z"></path>
          <path class="alliance-crest-svg__edge" d="M15 42h38l-6 12H23l-8-12Z"></path>
        </svg>
      `;
    case "black_star":
      return `
        <svg class="alliance-crest-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path class="alliance-crest-svg__gold" d="m32 7 7 17 18 2-14 12 4 18-15-10-15 10 4-18L7 26l18-2 7-17Z"></path>
          <path class="alliance-crest-svg__edge" d="m32 18 4 10 11 2-9 7 3 11-9-6-9 6 3-11-9-7 11-2 4-10Z"></path>
        </svg>
      `;
    case "street_pack":
      return `
        <svg class="alliance-crest-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle class="alliance-crest-svg__gold" cx="32" cy="23" r="10"></circle>
          <circle class="alliance-crest-svg__red" cx="18" cy="37" r="8"></circle>
          <circle class="alliance-crest-svg__red" cx="46" cy="37" r="8"></circle>
          <path class="alliance-crest-svg__edge" d="M10 54c3-9 11-14 22-14s19 5 22 14"></path>
        </svg>
      `;
    case "crown_skull":
    default:
      return `
        <svg class="alliance-crest-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path class="alliance-crest-svg__gold" d="M12 21 24 34l8-20 8 20 12-13-4 28H16l-4-28Z"></path>
          <path class="alliance-crest-svg__edge" d="M21 49h22"></path>
          <circle class="alliance-crest-svg__red" cx="26" cy="38" r="3"></circle>
          <circle class="alliance-crest-svg__red" cx="38" cy="38" r="3"></circle>
        </svg>
      `;
  }
};

const renderIconPicker = () => {
  const picker = qs("alliance-icon-picker");
  if (!picker) return;
  picker.innerHTML = ALLIANCE_ICON_OPTIONS.map((option) => `
    <button
      type="button"
      class="alliance-icon-option ${option.key === selectedIconKey ? "is-selected" : ""}"
      data-alliance-icon-option="${escapeHtml(option.key)}"
      aria-pressed="${option.key === selectedIconKey ? "true" : "false"}"
      title="${escapeHtml(option.label)}"
    >
      ${renderAllianceIconSvg(option.key)}
      <span>${escapeHtml(option.label)}</span>
    </button>
  `).join("");
};

const renderAllianceIdentityMarkup = (alliance) => `
  <span class="alliance-badge-markup">
    <span class="alliance-badge-markup__icon">
      ${renderAllianceIconSvg(getAllianceIconOptionByTag(alliance?.tag).key)}
      <span class="alliance-badge-markup__tag">${escapeHtml(alliance?.tag || "AL")}</span>
    </span>
    <span class="alliance-badge-markup__name">${escapeHtml(alliance?.name || "Aliance")}</span>
  </span>
`;

const renderMember = (member, { management = false } = {}) => {
  const statusCopy = getMemberStatusCopy(member.status);
  const roleLabel = member.role === "leader" ? "Leader" : "Member";
  const deadlineRows = [
    member.readyDueAt ? `<span>Ready do: ${escapeHtml(formatShortDateTime(member.readyDueAt))}</span>` : "",
    member.graceEndsAt ? `<span>Grace končí: ${escapeHtml(formatShortDateTime(member.graceEndsAt))}</span>` : ""
  ].filter(Boolean).join("");
  return `
    <article class="alliance-member-card" data-member-status="${escapeHtml(statusCopy.tone)}">
      <div class="alliance-member-card__avatar" aria-hidden="true">${escapeHtml(getMemberInitials(member.name))}</div>
      <div class="alliance-member-card__body">
        <div class="alliance-member-card__head">
          <strong title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</strong>
          <span class="alliance-chip ${member.role === "leader" ? "alliance-chip--gold" : ""}">${escapeHtml(roleLabel)}</span>
        </div>
        <div class="alliance-member-card__meta">
          <span class="alliance-state-pill" data-tone="${escapeHtml(statusCopy.tone)}">${escapeHtml(statusCopy.label)}</span>
          <span>${Number(member.activeDistrictCount || 0)} districtů</span>
        </div>
        ${deadlineRows ? `<div class="alliance-member-card__deadlines">${deadlineRows}</div>` : ""}
      </div>
      ${management && member.canStartKickVote ? `
        <button class="btn btn--danger alliance-member-card__action" data-alliance-kick-start="${escapeHtml(member.playerId)}" data-alliance-kick-target-name="${escapeHtml(member.name)}">
          Hlasovat o vyloučení
        </button>
      ` : ""}
    </article>
  `;
};

const renderKickVotePanel = (activeAlliance, { compact = false } = {}) => {
  const currentPlayerId = latestAllianceBoard?.currentPlayerId || "";
  const votes = activeAlliance?.eligibleVotes || [];
  const activeVote = activeAlliance?.activeVote || null;
  const allVotes = [...votes];
  if (activeVote && !allVotes.some((vote) => vote.id === activeVote.id)) {
    allVotes.push(activeVote);
  }

  if (!allVotes.length) return "";

  if (compact) {
    const requiresVote = votes.some((vote) => !vote.votes?.[currentPlayerId]);
    const title = requiresVote ? "Akce vyžaduje tvůj hlas" : "Probíhá hlasování";
    const vote = votes.find((candidate) => !candidate.votes?.[currentPlayerId]) || allVotes[0];
    const targetMember = activeAlliance.members.find((member) => member.playerId === vote?.targetPlayerId);
    return `
      <div class="alliance-attention" data-tone="${requiresVote ? "danger" : "warning"}">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(targetMember?.name || "Člen aliance")} · končí ${escapeHtml(formatTimeUntil(vote?.expiresAt))}</span>
        </div>
        <button class="btn btn--primary" type="button" data-alliance-management-open>Otevřít detail</button>
      </div>
    `;
  }

  const voteRows = allVotes.map((vote) => {
    const targetMember = activeAlliance.members.find((member) => member.playerId === vote.targetPlayerId);
    const currentChoice = vote.votes?.[currentPlayerId] || null;
    const canVote = vote.eligibleVoterIds?.includes(currentPlayerId) && !currentChoice && vote.status === "pending";
    const counts = getVoteCounts(vote);
    const stateLabel = currentChoice
      ? `Hlas odeslán: ${currentChoice === "yes" ? "Ano" : "Ne"}`
      : (canVote ? "Vyžaduje tvůj hlas" : "Probíhá hlasování");
    return `
      <article class="alliance-vote-card" data-vote-state="${canVote ? "needs-vote" : currentChoice ? "voted" : "pending"}">
        <div class="alliance-vote-card__head">
          <div>
            <span>${escapeHtml(stateLabel)}</span>
            <strong title="${escapeHtml(targetMember?.name || vote.targetPlayerId)}">${escapeHtml(targetMember?.name || vote.targetPlayerId)}</strong>
          </div>
          <span class="alliance-state-pill" data-tone="${canVote ? "danger" : "warning"}">${escapeHtml(formatTimeUntil(vote.expiresAt))}</span>
        </div>
        <div class="alliance-vote-card__stats">
          <span><strong>${counts.yes}</strong> Ano</span>
          <span><strong>${counts.no}</strong> Ne</span>
          <span><strong>${Number(vote.requiredYesVotes || 0)}</strong> potřeba</span>
        </div>
        ${canVote ? `
          <div class="alliance-vote-card__actions">
            <button class="btn btn--primary" data-alliance-kick-vote="${escapeHtml(vote.id)}" data-alliance-kick-choice="yes">Ano</button>
            <button class="btn btn--ghost" data-alliance-kick-vote="${escapeHtml(vote.id)}" data-alliance-kick-choice="no">Ne</button>
          </div>
        ` : `<div class="alliance-vote-card__result">${escapeHtml(stateLabel)}</div>`}
      </article>
    `;
  }).join("");

  return `
    <section class="alliance-section alliance-kick-vote-panel">
      <div class="alliance-section__head">
        <div>
          <span>Hlasování</span>
          <strong>Hlasování aliance</strong>
        </div>
      </div>
      ${activeVote ? `
        <div class="alliance-inline-note">
          Probíhá hlasování, které se tě týká. READY může stav změnit podle pravidel serveru.
        </div>
      ` : ""}
      <div class="alliance-vote-list">${voteRows}</div>
    </section>
  `;
};

const renderChat = (messages = []) => {
  const log = document.querySelector("[data-alliance-chat-log]");
  if (!log) return;
  const currentPlayerId = latestAllianceBoard?.currentPlayerId || "";
  log.innerHTML = messages.length
    ? messages.map((message) => {
        const isOwn = message.authorPlayerId === currentPlayerId;
        return `
          <div class="alliance-chat__item ${isOwn ? "alliance-chat__item--own" : ""}">
            <strong>${escapeHtml(isOwn ? "Ty" : message.authorName)}</strong>
            <span>${escapeHtml(message.body)}</span>
          </div>
        `;
      }).join("")
    : `<div class="alliance-empty-state alliance-empty-state--compact">Chat je zatím prázdný.</div>`;
  log.scrollTop = log.scrollHeight;
};

const renderGlobalServerChat = () => {
  const log = document.querySelector("[data-global-chat-log]");
  if (!log) return;
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  log.innerHTML = (Array.isArray(messages) && messages.length ? messages : getGlobalChatDemoMessages()).slice(0, 30).map((message) => {
    const color = normalizeChatColor(message.color, message.author === "Ty" ? getPlayerGangColor() : "#facc15");
    return `
    <div class="alliance-chat__item server-chat-panel__message">
      <strong class="server-chat-panel__author" style="--chat-author-color: ${escapeHtml(color)}">${escapeHtml(message.author || "System")}:</strong>
      <span class="server-chat-panel__text">${escapeHtml(message.text || "")}</span>
    </div>
  `;
  }).join("");
};

const saveGlobalMessage = (text) => {
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  const previousMessages = Array.isArray(messages) && messages.length ? messages : getGlobalChatDemoMessages();
  messages = [{ author: "Ty", text, color: getPlayerGangColor() }, ...previousMessages].slice(0, 30);
  localStorage.setItem(GLOBAL_CHAT_KEY, JSON.stringify(messages));
};

const renderAllianceTabs = () => `
  <nav class="alliance-tabs" aria-label="Alliance sections">
    ${ALLIANCE_TABS.map((tab) => `
      <button
        type="button"
        class="alliance-tab ${selectedAllianceTab === tab.key ? "is-active" : ""}"
        data-alliance-tab="${escapeHtml(tab.key)}"
        aria-selected="${selectedAllianceTab === tab.key ? "true" : "false"}"
      >${escapeHtml(tab.label)}</button>
    `).join("")}
  </nav>
`;

const renderReadyBlock = (activeAlliance, { management = false } = {}) => {
  const ready = getReadyCopy(activeAlliance?.readyReasonCode);
  const canConfirm = Boolean(activeAlliance?.canConfirmReady);
  return `
    <div class="alliance-ready-card" data-tone="${escapeHtml(ready.tone)}" title="${escapeHtml(activeAlliance?.readyReasonCode || "active")}">
      <div class="alliance-ready-card__copy">
        <span>READY stav</span>
        <strong>${escapeHtml(ready.label)}</strong>
        <small>${escapeHtml(canConfirm ? "Potvrzení je dostupné." : ready.hint)}</small>
      </div>
      <button class="btn btn--primary alliance-ready-btn ${management ? "alliance-ready-btn--management" : ""}" id="${management ? "alliance-management-ready-btn" : "alliance-ready-btn"}" ${canConfirm ? "" : "disabled"}>
        Potvrdit ready
      </button>
    </div>
  `;
};

const renderDefenseContributions = (contributions = []) => contributions.length
  ? `<div class="alliance-defense-list">${contributions.map((contribution) => `
      <article class="alliance-defense-row">
        <div>
          <strong>${escapeHtml(contribution.ownerName)}</strong>
          <span>${escapeHtml(contribution.districtName)} · ${escapeHtml(contribution.hostName)}</span>
        </div>
        <div>
          <strong>${escapeHtml(contribution.itemId)} x${Number(contribution.amount || 0)}</strong>
          <span>${escapeHtml(contribution.status)}</span>
        </div>
      </article>
    `).join("")}</div>`
  : `<div class="alliance-empty-state alliance-empty-state--compact">Žádná spojenecká obrana.</div>`;

const renderCreateAllianceCard = (board) => {
  const canCreate = board?.canCreateAlliance === true;
  const disabledReason = canCreate ? "" : getCreateDisabledReason(board?.createDisabledReason);
  return `
    <section class="alliance-create-card">
      <div class="alliance-section__head">
        <div>
          <span>Nová aliance</span>
          <strong>Vytvoř vlastní crew</strong>
        </div>
      </div>
      <p class="alliance-create-card__copy">Vyber název, znak a založ serverovou alianci.</p>
      ${disabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(disabledReason)}</div>` : ""}
      <button class="btn btn--primary alliance-create-card__cta" id="alliance-create-toggle-btn" ${canCreate ? "" : "disabled"}>Vytvořit alianci</button>
    </section>
  `;
};

const renderOverviewPanel = (activeAlliance) => {
  const ready = getReadyCopy(activeAlliance.readyReasonCode);
  const lastMessage = activeAlliance.chatMessages?.at?.(-1);
  return `
    ${renderKickVotePanel(activeAlliance, { compact: true })}
    <section class="alliance-hero-card">
      <div class="alliance-hero-card__identity">
        ${renderAllianceIdentityMarkup(activeAlliance)}
        <div class="alliance-hero-card__meta">
          <span class="alliance-chip ${activeAlliance.currentPlayerRole === "leader" ? "alliance-chip--gold" : ""}">
            ${escapeHtml(activeAlliance.currentPlayerRole === "leader" ? "Leader" : "Member")}
          </span>
          <span class="alliance-state-pill" data-tone="${escapeHtml(ready.tone)}">${escapeHtml(ready.label)}</span>
        </div>
      </div>
      <div class="alliance-hero-card__actions">
        <button class="btn btn--primary" data-alliance-management-open>Správa aliance</button>
        <button class="btn btn--danger" type="button" data-alliance-leave-open>Opustit alianci</button>
      </div>
    </section>
    <section class="alliance-stat-grid">
      <article class="alliance-stat-card"><span>Členové</span><strong>${Number(activeAlliance.memberCount || 0)}/${Number(activeAlliance.maxMembers || 0)}</strong></article>
      <article class="alliance-stat-card"><span>Obrana</span><strong>${Number(activeAlliance.defenseContributions?.length || 0)} položek</strong></article>
      <article class="alliance-stat-card"><span>Chat</span><strong>${lastMessage ? formatRelativeTime(lastMessage.createdAt) : "Bez zpráv"}</strong></article>
      <article class="alliance-stat-card"><span>Ready</span><strong>${escapeHtml(ready.label)}</strong></article>
    </section>
    ${renderReadyBlock(activeAlliance)}
  `;
};

const renderMembersPanel = (activeAlliance, { management = false } = {}) => `
  <section class="alliance-section">
    <div class="alliance-section__head">
      <div>
        <span>Roster</span>
        <strong>Členové aliance</strong>
      </div>
    </div>
    <div class="alliance-members">${activeAlliance.members.map((member) => renderMember(member, { management })).join("")}</div>
  </section>
`;

const renderChatPanel = () => `
  <section class="alliance-section alliance-section--chat">
    <div class="alliance-chat alliance-chat--modal">
      <div class="alliance-chat__title">Alliance chat</div>
      <div class="alliance-chat__log" data-alliance-chat-log></div>
      <div class="alliance-chat__input alliance-chat__input--modal alliance-active-card__chat-compose">
        <input type="text" placeholder="Napiš zprávu do chatu..." data-alliance-chat-input>
        <button type="button" class="btn btn--primary" data-alliance-chat-send>Odeslat</button>
      </div>
    </div>
  </section>
`;

const renderInvitesAndPublicPanel = (board) => `
  <section class="alliance-section">
    <div class="alliance-section__head">
      <div>
        <span>Pozvánky</span>
        <strong>Příchozí pozvánky</strong>
      </div>
    </div>
    <div class="alliance-list">
      ${board?.incomingInvites?.length ? board.incomingInvites.map((invite) => `
        <article class="alliance-invite-card">
          <div>
            <strong>${escapeHtml(invite.allianceName)}</strong>
            <span>Od ${escapeHtml(invite.invitedByName)} · ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
          </div>
          <div class="alliance-request-item__actions">
            <button class="btn btn--primary" data-alliance-invite-accept="${escapeHtml(invite.inviteId)}">Přijmout</button>
            <button class="btn btn--ghost" data-alliance-invite-reject="${escapeHtml(invite.inviteId)}">Odmítnout</button>
          </div>
        </article>
      `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné příchozí pozvánky.</div>`}
    </div>
  </section>
  <section class="alliance-section">
    <div class="alliance-section__head">
      <div>
        <span>Veřejné</span>
        <strong>Veřejné aliance</strong>
      </div>
    </div>
    <div class="alliance-public-list">
      ${board?.publicAlliances?.length ? board.publicAlliances.map((alliance) => `
        <article class="alliance-public-row">
          <div class="alliance-public-row__identity">${renderAllianceIdentityMarkup(alliance)}</div>
          <div class="alliance-public-row__meta">
            <span>${Number(alliance.memberCount || 0)}/${Number(alliance.maxMembers || 0)} členů</span>
            <span>Leader ${escapeHtml(alliance.ownerName)}</span>
          </div>
          <button class="btn btn--ghost" data-alliance-join="${escapeHtml(alliance.allianceId)}" ${alliance.canJoin ? "" : "disabled"} title="${escapeHtml(alliance.joinDisabledReason || "")}">
            ${escapeHtml(alliance.canJoin ? "Připojit" : alliance.joinDisabledReason || "Nedostupné")}
          </button>
        </article>
      `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné veřejné aliance.</div>`}
    </div>
  </section>
`;

const renderManagementTeaser = (activeAlliance) => `
  <section class="alliance-section">
    <div class="alliance-section__head">
      <div>
        <span>Správa</span>
        <strong>Management aliance</strong>
      </div>
      <button class="btn btn--primary" data-alliance-management-open>Otevřít správu</button>
    </div>
    ${renderReadyBlock(activeAlliance)}
    ${renderKickVotePanel(activeAlliance, { compact: true })}
    ${renderDefenseContributions(activeAlliance.defenseContributions)}
  </section>
`;

const renderAllianceState = () => {
  const board = latestAllianceBoard;
  const createEntry = qs("alliance-create-entry");
  const activePanel = qs("alliance-active-panel");
  const invitesPanel = qs("alliance-player-invites-panel");
  const listPanel = qs("alliance-list-panel");
  const leaveBtn = qs("alliance-leave-btn");
  const managementBtn = qs("alliance-management-footer-btn");
  const activeAlliance = board?.activeAlliance || null;

  document.querySelector("[data-gang-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Zadna"));
  document.querySelector("[data-player-popup-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Zadna"));
  createEntry?.classList.toggle("hidden", Boolean(activeAlliance));
  leaveBtn?.classList.toggle("hidden", !activeAlliance);
  managementBtn?.classList.toggle("hidden", !activeAlliance);

  if (createEntry) {
    createEntry.innerHTML = activeAlliance ? "" : renderCreateAllianceCard(board);
  }

  if (activePanel) {
    if (!activeAlliance) {
      activePanel.innerHTML = "";
    } else {
      const panels = {
        overview: renderOverviewPanel(activeAlliance),
        members: renderMembersPanel(activeAlliance),
        chat: renderChatPanel(activeAlliance),
        management: renderManagementTeaser(activeAlliance),
        invites: renderInvitesAndPublicPanel(board)
      };
      activePanel.innerHTML = `
        <div class="alliance-active-card">
          ${renderAllianceTabs()}
          <div class="alliance-tab-panel">
            ${panels[selectedAllianceTab] || panels.overview}
          </div>
        </div>
      `;
    }
  }

  if (invitesPanel) {
    invitesPanel.innerHTML = activeAlliance ? "" : renderInvitesAndPublicPanel(board);
    invitesPanel.hidden = Boolean(activeAlliance);
  }

  if (listPanel) {
    listPanel.innerHTML = "";
    listPanel.hidden = true;
  }

  renderChat(activeAlliance?.chatMessages || []);
};

const renderAllianceManagementState = () => {
  const panel = qs("alliance-management-panel");
  const activeAlliance = latestAllianceBoard?.activeAlliance || null;
  if (!panel) return;
  if (!activeAlliance) {
    panel.innerHTML = `<div class="alliance-empty-state">Nejsi v žádné alianci.</div>`;
    return;
  }

  const ready = getReadyCopy(activeAlliance.readyReasonCode);
  const inviteTargets = latestAllianceBoard?.eligibleInviteTargets || [];
  const freeSlots = Math.max(0, Number(activeAlliance.maxMembers || 0) - Number(activeAlliance.memberCount || 0));
  const inviteDisabledReason = activeAlliance.canInvite ? "" : getInviteDisabledReason(activeAlliance, inviteTargets);

  panel.innerHTML = `
    <section class="alliance-management-shell">
      <div class="alliance-management-status">
        ${renderAllianceIdentityMarkup(activeAlliance)}
        <div class="alliance-management-status__badges">
          <span class="alliance-chip ${activeAlliance.currentPlayerRole === "leader" ? "alliance-chip--gold" : ""}">
            ${escapeHtml(activeAlliance.currentPlayerRole === "leader" ? "Leader" : "Member")}
          </span>
          <span class="alliance-state-pill" data-tone="${escapeHtml(ready.tone)}">${escapeHtml(ready.label)}</span>
        </div>
      </div>
      ${renderReadyBlock(activeAlliance, { management: true })}
      <section class="alliance-section">
        <div class="alliance-section__head">
          <div>
            <span>Pozvánky</span>
            <strong>Pozvat hráče</strong>
          </div>
          <span class="alliance-chip">${freeSlots} míst volných</span>
        </div>
        ${inviteDisabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(inviteDisabledReason)}</div>` : ""}
        <div class="alliance-invite-form">
        <select id="alliance-management-invite-name" ${activeAlliance.canInvite ? "" : "disabled"}>
          <option value="">Vyber hráče</option>
          ${inviteTargets.map((target) => `
            <option value="${escapeHtml(target.playerId)}" ${target.canInvite ? "" : "disabled"}>
              ${escapeHtml(target.name)}${target.disabledReason ? ` · ${escapeHtml(target.disabledReason)}` : ""}
            </option>
          `).join("")}
        </select>
        <button class="btn btn--primary" id="alliance-management-invite-btn" ${activeAlliance.canInvite ? "" : "disabled"}>Pozvat</button>
        </div>
      </section>
      ${renderMembersPanel(activeAlliance, { management: true })}
      ${renderKickVotePanel(activeAlliance)}
      <section class="alliance-section">
        <div class="alliance-section__head">
          <div>
            <span>Odeslané</span>
            <strong>Odeslané pozvánky</strong>
          </div>
        </div>
        <div class="alliance-list">
          ${activeAlliance.pendingInvites.length ? activeAlliance.pendingInvites.map((invite) => `
            <article class="alliance-invite-card">
              <div>
                <strong>${escapeHtml(invite.targetName)}</strong>
                <span>Pozváno ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
              </div>
            </article>
          `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné aktivní pozvánky.</div>`}
        </div>
      </section>
      <section class="alliance-section">
        <div class="alliance-section__head">
          <div>
            <span>Obrana</span>
            <strong>Spojenecká obrana</strong>
          </div>
        </div>
        ${renderDefenseContributions(activeAlliance.defenseContributions)}
      </section>
    </section>
  `;
};

const rerenderAll = () => {
  renderAllianceState();
  renderAllianceManagementState();
  renderGlobalServerChat();
  syncCreateModalState();
};

const openAllianceModal = () => {
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const closeAllAllianceModals = () => {
  ["alliance-modal", "alliance-create-modal", "alliance-leave-modal", "alliance-management-modal", "alliance-kick-confirm-modal"].forEach((id) =>
    setModalVisible(qs(id), false)
  );
  pendingKickVoteTarget = null;
};

const resetCreateForm = () => {
  if (qs("alliance-create-name")) qs("alliance-create-name").value = "";
  selectedIconKey = "crown_skull";
  renderIconPicker();
};

const syncCreateModalState = () => {
  const canCreate = latestAllianceBoard?.canCreateAlliance === true;
  const reason = canCreate ? "" : getCreateDisabledReason(latestAllianceBoard?.createDisabledReason);
  const button = qs("alliance-create-btn");
  const reasonEl = qs("alliance-create-disabled-reason");
  if (button) {
    button.disabled = !canCreate;
    button.title = reason;
    button.textContent = "Vytvořit alianci";
  }
  if (reasonEl) {
    reasonEl.textContent = reason;
    reasonEl.classList.toggle("hidden", canCreate);
  }
};

const openCreateModal = () => {
  renderIconPicker();
  syncCreateModalState();
  setModalVisible(qs("alliance-create-modal"), true);
};

const openKickConfirmModal = (playerId, playerName) => {
  const activeAlliance = latestAllianceBoard?.activeAlliance;
  if (!activeAlliance || !playerId) return;
  pendingKickVoteTarget = { playerId, playerName: playerName || playerId, allianceId: activeAlliance.allianceId };
  const text = qs("alliance-kick-confirm-text");
  if (text) {
    text.textContent = `Aliance bude hlasovat o vyloučení člena ${pendingKickVoteTarget.playerName}.`;
  }
  setModalVisible(qs("alliance-kick-confirm-modal"), true);
};

const closeKickConfirmModal = () => {
  pendingKickVoteTarget = null;
  setModalVisible(qs("alliance-kick-confirm-modal"), false);
};

const bindAllianceRuntime = () => {
  try {
    localStorage.removeItem(LOCAL_ALLIANCE_KEY);
  } catch (_error) {
    // Local alliance state is deprecated and intentionally ignored.
  }

  qs("alliance-btn")?.addEventListener("click", openAllianceModal);
  qs("alliance-modal-backdrop")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-modal-close")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-create-toggle-btn")?.addEventListener("click", openCreateModal);
  qs("alliance-create-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-create-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-leave-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-cancel-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), true));
  qs("alliance-management-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), false));
  qs("alliance-management-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), false));
  qs("alliance-management-footer-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), true));
  qs("alliance-kick-confirm-modal-backdrop")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-modal-close")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-cancel-btn")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-submit-btn")?.addEventListener("click", async () => {
    if (!pendingKickVoteTarget) return;
    const { allianceId, playerId } = pendingKickVoteTarget;
    const ok = await runAllianceCommand("start-alliance-kick-vote", {
      allianceId,
      targetPlayerId: playerId
    }, "Hlasování bylo spuštěno.");
    if (ok) closeKickConfirmModal();
  });

  qs("alliance-create-btn")?.addEventListener("click", async () => {
    const name = String(qs("alliance-create-name")?.value || "").trim();
    const tag = getSelectedIconOption().tag;
    if (latestAllianceBoard?.canCreateAlliance !== true) {
      notify(getCreateDisabledReason(latestAllianceBoard?.createDisabledReason));
      syncCreateModalState();
      return;
    }
    if (!name) {
      notify("Zadej nazev aliance.");
      return;
    }
    const ok = await runAllianceCommand("create-alliance", { name, tag }, `Aliance ${name} byla zalozena.`);
    if (ok) {
      setModalVisible(qs("alliance-create-modal"), false);
      resetCreateForm();
    }
  });

  qs("alliance-leave-confirm-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (!activeAlliance) return;
    const type = activeAlliance.currentPlayerRole === "leader" ? "disband-alliance" : "leave-alliance";
    const ok = await runAllianceCommand(type, { allianceId: activeAlliance.allianceId }, "Aliance byla opustena.");
    if (ok) setModalVisible(qs("alliance-leave-modal"), false);
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest(
      "[data-alliance-tab], [data-alliance-leave-open], [data-alliance-management-open], [data-alliance-icon-option], [data-alliance-join], [data-alliance-invite-accept], [data-alliance-invite-reject], #alliance-create-toggle-btn, #alliance-ready-btn, #alliance-management-ready-btn, #alliance-management-open-btn, #alliance-management-invite-btn, [data-alliance-chat-send], [data-alliance-kick-start], [data-alliance-kick-vote]"
    ) : null;
    if (!(target instanceof HTMLElement)) return;
    const activeAlliance = latestAllianceBoard?.activeAlliance;

    if (target.hasAttribute("data-alliance-tab")) {
      selectedAllianceTab = target.getAttribute("data-alliance-tab") || "overview";
      renderAllianceState();
      return;
    }
    if (target.hasAttribute("data-alliance-leave-open")) {
      setModalVisible(qs("alliance-leave-modal"), true);
      return;
    }
    if (target.id === "alliance-create-toggle-btn") {
      openCreateModal();
      return;
    }
    if (target.hasAttribute("data-alliance-icon-option")) {
      selectedIconKey = target.getAttribute("data-alliance-icon-option") || selectedIconKey;
      renderIconPicker();
      syncCreateModalState();
      return;
    }
    if (target.id === "alliance-management-open-btn" || target.hasAttribute("data-alliance-management-open")) {
      setModalVisible(qs("alliance-management-modal"), true);
      renderAllianceManagementState();
      return;
    }
    if (target.id === "alliance-management-invite-btn") {
      const targetPlayerId = String(qs("alliance-management-invite-name")?.value || "").trim();
      if (!activeAlliance || !targetPlayerId) {
        notify("Vyber hrace pro pozvanku.");
        return;
      }
      await runAllianceCommand("invite-alliance-member", {
        allianceId: activeAlliance.allianceId,
        targetPlayerId
      }, "Pozvanka byla odeslana.");
      return;
    }
    if (target.id === "alliance-ready-btn" || target.id === "alliance-management-ready-btn") {
      if (activeAlliance) {
        await runAllianceCommand("confirm-alliance-ready", { allianceId: activeAlliance.allianceId }, "READY stav byl potvrzen.");
      }
      return;
    }
    if (target.hasAttribute("data-alliance-chat-send")) {
      const input = document.querySelector("[data-alliance-chat-input]");
      const body = String(input?.value || "").trim();
      if (activeAlliance && body) {
        const ok = await runAllianceCommand("send-alliance-chat-message", { allianceId: activeAlliance.allianceId, body }, "Zprava odeslana.");
        if (ok && input instanceof HTMLInputElement) input.value = "";
      }
      return;
    }
    if (target.hasAttribute("data-alliance-join")) {
      await runAllianceCommand("join-alliance", { allianceId: target.getAttribute("data-alliance-join") }, "Vstoupil jsi do aliance.");
      return;
    }
    if (target.hasAttribute("data-alliance-invite-accept") || target.hasAttribute("data-alliance-invite-reject")) {
      await runAllianceCommand("respond-alliance-invite", {
        inviteId: target.getAttribute("data-alliance-invite-accept") || target.getAttribute("data-alliance-invite-reject"),
        response: target.hasAttribute("data-alliance-invite-accept") ? "accept" : "reject"
      }, target.hasAttribute("data-alliance-invite-accept") ? "Pozvanka prijata." : "Pozvanka odmitnuta.");
      return;
    }
    if (target.hasAttribute("data-alliance-kick-start") && activeAlliance) {
      openKickConfirmModal(
        target.getAttribute("data-alliance-kick-start"),
        target.getAttribute("data-alliance-kick-target-name")
      );
      return;
    }
    if (target.hasAttribute("data-alliance-kick-vote")) {
      await runAllianceCommand("cast-alliance-kick-vote", {
        voteId: target.getAttribute("data-alliance-kick-vote"),
        choice: target.getAttribute("data-alliance-kick-choice")
      }, "Hlas byl odeslan.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllAllianceModals();
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.hasAttribute("data-alliance-chat-input")) {
      event.preventDefault();
      document.querySelector("[data-alliance-chat-send]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  qs("alliance-chat-send")?.addEventListener("click", () => {
    const input = qs("alliance-chat-input");
    const text = String(input?.value || "").trim();
    if (!text) return;
    saveGlobalMessage(text);
    if (input instanceof HTMLInputElement) input.value = "";
    renderGlobalServerChat();
  });

  document.addEventListener("empire:gameplay-slice-rendered", (event) => {
    latestAllianceBoard = createDevOnlyAllianceBoard(event?.detail?.gameplaySlice?.allianceBoard || null);
    rerenderAll();
    window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  });

  window.empireStreetsAllianceState = {
    getActiveAlliance: () => latestAllianceBoard?.activeAlliance || null,
    getMapBadge: () => {
      const alliance = latestAllianceBoard?.activeAlliance;
      const icon = getAllianceIconOptionByTag(alliance?.tag);
      return alliance ? { name: alliance.name, iconKey: icon.key, symbol: icon.symbol, tag: alliance.tag || "AL" } : null;
    }
  };

  renderGlobalServerChat();
  renderIconPicker();
  syncCreateModalState();
  latestAllianceBoard = createDevOnlyAllianceBoard(latestAllianceBoard);
  rerenderAll();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindAllianceRuntime, { once: true });
} else {
  bindAllianceRuntime();
}
