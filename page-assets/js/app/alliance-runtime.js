import { submitServerAllianceCommand } from "./runtime.js";
import { STORAGE_KEYS } from "../config.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";
import { ALLIANCE_ICON_OPTIONS, getAllianceIconById, getAllianceIconByTag } from "./alliance-icons.js";
import { LAUNCH_PLAYER_AVATAR_BY_FACTION_ID, START_PHASE_PLAYER_NAMES } from "./dev/demoScenarios.js";

const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const GLOBAL_CHAT_KEY = "empire_local_global_chat_state";
const ALLIANCE_CHAT_PREVIEW_KEY = "empire_local_alliance_chat_state";
const ALLIANCE_MODAL_SESSION_KEY = "empire_alliance_modal_open";
const MAX_ALLIANCE_SIZE_FALLBACK = 4;
const MAX_ALLIANCE_NAME_LENGTH = 32;

let latestAllianceBoard = null;
let selectedIconKey = "reaper";
let selectedAllianceTab = "overview";
let pendingKickVoteTarget = null;
let pendingAllianceCommand = false;
let lastAllianceMemberAvatarTrigger = null;
let allianceCountdownTimer = null;

const qs = (id) => document.getElementById(id);
const ALLIANCE_MODAL_IDS = [
  "alliance-modal",
  "alliance-create-modal",
  "alliance-leave-modal",
  "alliance-kick-confirm-modal",
  "alliance-member-lightbox"
];
const ALLIANCE_TABS = [
  { key: "overview", label: "Přehled" },
  { key: "chat", label: "Chat" },
  { key: "management", label: "Správa" },
  { key: "invites", label: "Pozvánky" }
];

const DEV_ONLY_ALLIANCE_DEMO_MEMBERS = Object.freeze([
  Object.freeze({
    key: "current",
    name: "Ty",
    role: "member",
    status: "active",
    presence: "online",
    activeDistrictCount: 3,
    avatarSrc: LAUNCH_PLAYER_AVATAR_BY_FACTION_ID.mafian
  }),
  Object.freeze({
    key: "leader",
    playerId: "dev-demo-zabijaci-leader",
    name: START_PHASE_PLAYER_NAMES[0] || "NeonRaven",
    role: "leader",
    status: "active",
    presence: "offline",
    activeDistrictCount: 5,
    avatarSrc: LAUNCH_PLAYER_AVATAR_BY_FACTION_ID.kartel
  }),
  Object.freeze({
    key: "shadow",
    playerId: "dev-demo-zabijaci-shadow",
    name: START_PHASE_PLAYER_NAMES[1] || "GhostByte",
    role: "member",
    status: "active",
    presence: "offline",
    activeDistrictCount: 2,
    avatarSrc: LAUNCH_PLAYER_AVATAR_BY_FACTION_ID.hackeri
  })
]);

const DEV_ONLY_ALLIANCE_INVITE_TARGET_NAMES = Object.freeze(
  START_PHASE_PLAYER_NAMES.slice(2, 8)
);

const READY_STATUS_COPY = {
  due_soon: { label: "Aktivní", hint: "Brzy zvol Zůstávám nebo Končím.", tone: "warning" },
  overdue: { label: "Po termínu", hint: "Okno aktivity vypršelo.", tone: "danger" },
  vote_eligible: { label: "Po termínu", hint: "Server zpracuje automatické vyloučení.", tone: "danger" },
  vote_pending: { label: "Řeší se stav", hint: "Aliance čeká na serverový výsledek.", tone: "warning" },
  active: { label: "Aktivní", hint: "Do konce okna zvol Zůstávám nebo Končím.", tone: "success" },
  ready: { label: "Aktivní", hint: "Aktivita je potvrzená.", tone: "success" }
};

const MEMBER_STATUS_COPY = {
  active: { label: "Aktivní", tone: "success" },
  ready: { label: "Aktivní", tone: "success" },
  due_soon: { label: "Brzy konec", tone: "warning" },
  overdue: { label: "Po termínu", tone: "danger" },
  vote_eligible: { label: "Lze hlasovat", tone: "danger" },
  vote_pending: { label: "Hlasování", tone: "warning" },
  kicked: { label: "Odebrán", tone: "danger" },
  removed: { label: "Odebrán", tone: "danger" }
};

const CREATE_DISABLED_COPY = {
  already_in_alliance: "Už jsi v alianci.",
  PLAYER_ALREADY_IN_ALLIANCE: "Už jsi v alianci.",
  ALLIANCE_CREATE_LOCKED: "Po odchodu z aliance musíš počkat, než založíš novou.",
  ALLIANCE_JOIN_LOCKED: "Po odchodu z aliance musíš počkat, než se přidáš.",
  ALLIANCE_EXIT_PENDING: "Odchod z aliance se ještě dokončuje.",
  server_locked: "Server teď nepovoluje vytvoření aliance.",
  not_available: "Alianci teď nelze vytvořit.",
  local_preview_active: "V lokálním preview už aliance běží jen pro tuhle relaci."
};

const PLAYER_FACING_ERROR_COPY = {
  PLAYER_NOT_FOUND: "Hráče se nepodařilo najít.",
  TARGET_PLAYER_NOT_FOUND: "Tohoto hráče se nepodařilo najít.",
  ALLIANCE_NAME_REQUIRED: "Zadej název aliance.",
  ALLIANCE_NOT_FOUND: "Tahle aliance už není dostupná.",
  MEMBERSHIP_NOT_FOUND: "Nejsi aktivní člen téhle aliance.",
  ALLIANCE_INVITE_NOT_ALLOWED: "Pozvat hráče může jen leader aliance.",
  TARGET_ALREADY_IN_ALLIANCE: "Hráč už je v jiné alianci.",
  ALLIANCE_FULL: "Aliance je plná. Max 4 hráči.",
  ALLIANCE_INVITE_ALREADY_PENDING: "Pozvánka pro tohohle hráče už čeká.",
  ALLIANCE_INVITE_NOT_FOUND: "Pozvánka už není dostupná.",
  ALLIANCE_INVITE_NOT_OWNED: "Tahle pozvánka nepatří tobě.",
  ALLIANCE_CHAT_NOT_ALLOWED: "Alianční chat je jen pro členy aliance.",
  ALLIANCE_CHAT_EMPTY: "Napiš zprávu do aliančního chatu.",
  PLAYER_ALREADY_IN_ALLIANCE: "Už jsi v alianci.",
  ALLIANCE_JOIN_LOCKED: "Po odchodu z aliance musíš počkat, než se přidáš.",
  ALLIANCE_CREATE_LOCKED: "Po odchodu z aliance musíš počkat, než založíš novou.",
  ALLIANCE_EXIT_PENDING: "Odchod z aliance se ještě dokončuje.",
  READY_TOO_EARLY: "Aktivitu zatím není potřeba obnovit.",
  READY_NOT_ALLOWED: "Tahle akce aktivity teď nejde provést.",
  MEMBERSHIP_VERSION_CONFLICT: "Stav člena se mezitím změnil. Otevři alianci znovu.",
  TARGET_CANNOT_VOTE: "Sám sebe z crew nevykopneš.",
  VOTE_RETRY_COOLDOWN: "O tomhle členovi se hlasovalo nedávno. Zkus to později.",
  VOTE_ALREADY_ACTIVE: "O tomhle členovi už probíhá hlasování.",
  TARGET_NOT_VOTE_ELIGIBLE: "Hlasování jde spustit jen na člena, kterého server označil jako neaktivního.",
  VOTE_NOT_FOUND: "Hlasování už není dostupné.",
  VOTE_NOT_PENDING: "Hlasování už není otevřené.",
  VOTE_INVALIDATED: "Hlasování se mezitím změnilo. Otevři detail znovu.",
  VOTER_NOT_ELIGIBLE: "V tomhle hlasování nemůžeš hlasovat.",
  PLAYER_ALREADY_EXITING: "Odchod z aliance už probíhá.",
  LEADER_SUCCESSOR_REQUIRED: "Leader musí před odchodem předat vedení.",
  unsupported_command: "Tahle alianční akce zatím není dostupná.",
  UNSUPPORTED_COMMAND: "Tahle alianční akce zatím není dostupná.",
  "Server-authoritative gameplay runtime není připravený.": "Aliance teď čeká na herní server. Zkus to za chvíli.",
  "Alliance command nejde odeslat bez server slice kontextu.": "Aliance ještě nemá načtený herní stav. Zkus to za chvíli."
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

const chatTimestampFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const formatChatTimestamp = (value, fallbackTime = Date.now()) => {
  const date = new Date(value || fallbackTime);
  const safeDate = Number.isNaN(date.getTime()) ? new Date(fallbackTime) : date;
  return {
    iso: safeDate.toISOString(),
    label: chatTimestampFormatter.format(safeDate).replace(",", "")
  };
};

const getPlayerGangColor = () => {
  try {
    return normalizeChatColor(localStorage.getItem(STORAGE_KEYS.gangColor), "#facc15");
  } catch {
    return "#facc15";
  }
};

const getStoredPlayerAvatarSrc = () => {
  try {
    return String(localStorage.getItem(STORAGE_KEYS.avatar) || "").trim();
  } catch {
    return "";
  }
};

const getGlobalChatDemoMessages = () => {
  const now = Date.now();
  return [
    { author: "Razor", text: "Na severu se dneska hýbou hranice. Kdo tam jde bez lidí, ať si rovnou píše závěť.", color: "#ef4444", sentAt: new Date(now - 11 * 60 * 1000).toISOString() },
    { author: "Nyx", text: "Bazar má dobré ceny na tech scrap, ale jen dokud někdo nezačne dělat bordel.", color: "#8b5cf6", sentAt: new Date(now - 23 * 60 * 1000).toISOString() },
    { author: "Karlos", text: "Potřebuju spojence na rychlou výměnu materiálů. Platím clean, žádné drama.", color: "#22d3ee", sentAt: new Date(now - 37 * 60 * 1000).toISOString() },
    { author: "Mira", text: "Viděla jsem cizí scouty u warehouse distriktů. Kontrolujte obranu.", color: "#22c55e", sentAt: new Date(now - 52 * 60 * 1000).toISOString() }
  ];
};

const getAlliancePreviewChatStorageKey = (allianceId) =>
  `${ALLIANCE_CHAT_PREVIEW_KEY}:${String(allianceId || "default").trim() || "default"}`;

const readAlliancePreviewMessages = (allianceId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(getAlliancePreviewChatStorageKey(allianceId)) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((message) => message && typeof message === "object" && String(message.body || "").trim())
      : [];
  } catch {
    return [];
  }
};

const writeAlliancePreviewMessages = (allianceId, messages) => {
  try {
    localStorage.setItem(getAlliancePreviewChatStorageKey(allianceId), JSON.stringify((messages || []).slice(-50)));
  } catch (_error) {
    // Preview chat is best-effort only.
  }
};

const createLocalAllianceChatMessage = (activeAlliance, body) => {
  const currentPlayerId = latestAllianceBoard?.currentPlayerId || "dev-player";
  const createdAt = new Date().toISOString();
  return {
    messageId: `local-alliance-chat:${activeAlliance?.allianceId || "alliance"}:${Date.now()}`,
    allianceId: activeAlliance?.allianceId || "local-alliance",
    authorPlayerId: currentPlayerId,
    authorName: "Ty",
    body,
    createdAt
  };
};

const appendLocalAllianceChatMessage = (activeAlliance, body) => {
  if (!activeAlliance) return [];
  const message = createLocalAllianceChatMessage(activeAlliance, body);
  const nextMessages = [...(activeAlliance.chatMessages || []), message].slice(-50);
  activeAlliance.chatMessages = nextMessages;
  if (activeAlliance.isDevOnlyDemo) {
    writeAlliancePreviewMessages(activeAlliance.allianceId, nextMessages);
  }
  return nextMessages;
};

const isDevOnlyAllianceDemoEnabled = () => {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const createDevOnlyAllianceMembers = (currentPlayerId, readyDueAt) =>
  DEV_ONLY_ALLIANCE_DEMO_MEMBERS.map((member) => ({
    playerId: member.key === "current" ? currentPlayerId : member.playerId,
    name: member.name,
    role: member.role,
    status: member.status,
    readyDueAt,
    graceEndsAt: readyDueAt,
    activeDistrictCount: member.activeDistrictCount,
    canStartKickVote: member.key !== "current",
    presence: member.presence,
    avatarSrc: member.key === "current"
      ? (getStoredPlayerAvatarSrc() || member.avatarSrc)
      : member.avatarSrc
  }));

const createDevOnlyAllianceInviteTargets = (members = []) => {
  const memberNames = new Set(members.map((member) => String(member.name || "").trim().toLowerCase()).filter(Boolean));
  return DEV_ONLY_ALLIANCE_INVITE_TARGET_NAMES
    .filter((name) => !memberNames.has(String(name).trim().toLowerCase()))
    .map((name, index) => ({
      playerId: `dev-demo-invite-${index + 1}`,
      name,
      canInvite: true
    }));
};

const createDevOnlyAllianceBoard = (baseBoard = null) => {
  if (!isDevOnlyAllianceDemoEnabled() || baseBoard?.activeAlliance) {
    return baseBoard;
  }
  const nowIso = new Date().toISOString();
  const currentPlayerId = baseBoard?.currentPlayerId || "dev-player";
  const allianceId = "dev-demo-alliance-zabijaci";
  const maxAllianceSize = baseBoard?.maxAllianceSize || MAX_ALLIANCE_SIZE_FALLBACK;
  const readyDueAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const members = createDevOnlyAllianceMembers(currentPlayerId, readyDueAt);
  const leader = members.find((member) => member.role === "leader") || members[0];
  const storedChatMessages = readAlliancePreviewMessages(allianceId);
  const defaultChatMessages = [
    {
      messageId: "dev-demo-alliance-chat-1",
      allianceId,
      authorPlayerId: "dev-demo-zabijaci-leader",
      authorName: leader?.name || "NeonRaven",
      body: "Zabijáci jsou připraveni.",
      createdAt: nowIso
    }
  ];
  return {
    maxAllianceSize,
    currentPlayerId,
    activeAlliance: {
      allianceId,
      name: "Zabijáci",
      tag: "REAPER",
      ownerPlayerId: "dev-demo-zabijaci-leader",
      ownerName: leader?.name || "NeonRaven",
      memberCount: members.length,
      maxMembers: maxAllianceSize,
      currentPlayerRole: "member",
      canJoin: false,
      joinDisabledReason: "Už jsi členem.",
      canInvite: true,
      canLeave: false,
      canDisband: false,
      canConfirmReady: true,
      readyReasonCode: "active",
      readyDueAt,
      nextReadyDueAt: readyDueAt,
      activeVote: null,
      eligibleVotes: [],
      members,
      pendingInvites: [],
      chatMessages: storedChatMessages.length
        ? storedChatMessages
        : defaultChatMessages,
      defenseContributions: [],
      isDevOnlyDemo: true
    },
    publicAlliances: baseBoard?.publicAlliances || [],
    incomingInvites: baseBoard?.incomingInvites || [],
    eligibleInviteTargets: createDevOnlyAllianceInviteTargets(members),
    canCreateAlliance: false,
    createDisabledReason: "local_preview_active"
  };
};

const formatRelativeTime = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "-";
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return "právě teď";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  return `před ${Math.floor(hours / 24)} d`;
};

const formatReadyCountdown = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "08:00:00";
  const delta = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
  const hours = Math.floor(delta / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  const seconds = delta % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getReadyDeadline = (activeAlliance) => {
  const currentPlayerId = latestAllianceBoard?.currentPlayerId || "";
  const currentMember = (activeAlliance?.members || []).find((member) => member.playerId === currentPlayerId);
  return activeAlliance?.readyDueAt || activeAlliance?.nextReadyDueAt || currentMember?.readyDueAt || "";
};

const getReadyCountdownLabel = (activeAlliance) =>
  formatReadyCountdown(getReadyDeadline(activeAlliance));

const renderReadyCountdown = (activeAlliance, className = "alliance-ready-countdown") => {
  const deadline = getReadyDeadline(activeAlliance);
  return `<span class="${escapeHtml(className)}" data-alliance-ready-countdown data-ready-deadline="${escapeHtml(deadline)}">${escapeHtml(formatReadyCountdown(deadline))}</span>`;
};

const updateAllianceReadyCountdowns = () => {
  document.querySelectorAll("[data-alliance-ready-countdown]").forEach((element) => {
    const deadline = element.getAttribute("data-ready-deadline") || "";
    element.textContent = formatReadyCountdown(deadline);
  });
};

const ensureAllianceCountdownTimer = () => {
  if (allianceCountdownTimer !== null) return;
  allianceCountdownTimer = window.setInterval(updateAllianceReadyCountdowns, 1000);
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
    hint: "Detail aktivity se načte s dalším stavem hry.",
    tone: "neutral"
  };

const getMemberStatusCopy = (status) =>
  MEMBER_STATUS_COPY[String(status || "")] || { label: "Stav se načítá", tone: "neutral" };

const getAllianceMaxMembers = (activeAlliance = latestAllianceBoard?.activeAlliance || null) =>
  Number(activeAlliance?.maxMembers || latestAllianceBoard?.maxAllianceSize || MAX_ALLIANCE_SIZE_FALLBACK);

const getMappedCopy = (source, value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return source[raw] || source[raw.toUpperCase()] || source[raw.toLowerCase()] || "";
};

const isDebugLikeMessage = (value) =>
  /undefined|missing|payload|unsupported|unavailable|fallback|dev state|command\.payload|not found|runtime|slice/i.test(String(value || ""));

const toPlayerFacingMessage = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const mapped = getMappedCopy(PLAYER_FACING_ERROR_COPY, raw) || getMappedCopy(CREATE_DISABLED_COPY, raw);
  if (mapped) return mapped;
  if (/^[A-Z0-9_.:-]+$/.test(raw) || /^[a-z0-9_.:-]*_[a-z0-9_.:-]*$/u.test(raw)) return fallback;
  if (isDebugLikeMessage(raw) || raw.length > 140) return fallback;
  return raw;
};

const getCreateDisabledReason = (reason) => {
  const normalized = String(reason || "").trim();
  if (!normalized) return "Vytvoření aliance není dostupné.";
  return toPlayerFacingMessage(normalized, "Vytvoření aliance není dostupné.");
};

const getInviteDisabledReason = (activeAlliance, targets = []) => {
  if (!activeAlliance) return "Nejsi v žádné alianci.";
  if (activeAlliance.isDevOnlyDemo) return "Pozvánky jsou v preview vypnuté.";
  if (activeAlliance.currentPlayerRole !== "leader") return "Pozvat může jen leader aliance.";
  if (Number(activeAlliance.memberCount || 0) >= getAllianceMaxMembers(activeAlliance)) return "Aliance je plná. Max 4 hráči.";
  if (!targets.length) return "Nejsou žádní dostupní hráči k pozvání.";
  if (!targets.some((target) => target.canInvite)) return "Dostupní hráči už jsou v alianci nebo je nejde pozvat.";
  return "Pozvánky nejsou dostupné.";
};

const getJoinDisabledReason = (alliance) =>
  alliance?.canJoin ? "" : toPlayerFacingMessage(alliance?.joinDisabledReason, "Připojení teď není dostupné.");

const getAllianceChatDisabledReason = (activeAlliance) => {
  if (!activeAlliance) return "Alianční chat je jen pro členy aliance.";
  return "";
};

const getKickVoteUnavailableReason = (activeAlliance) => {
  if (!activeAlliance) return "Nejsi v žádné alianci.";
  if (activeAlliance.isDevOnlyDemo && !(activeAlliance.members || []).some((member) => member.canStartKickVote)) {
    return "Hlasování o vyloučení je v preview vypnuté.";
  }
  if (!activeAlliance.isDevOnlyDemo && activeAlliance.currentPlayerRole !== "leader") {
    return "Hlasování spouští leader, když je člen dlouho neaktivní.";
  }
  if ((activeAlliance.members || []).length < 2) return "Hlasování potřebuje aspoň dva členy aliance.";
  if (!(activeAlliance.members || []).some((member) => member.canStartKickVote)) {
    return "Hlasování se zpřístupní, až server označí člena jako neaktivního.";
  }
  return "";
};

const renderKickCandidateList = (activeAlliance) => {
  const members = activeAlliance?.members || [];
  if (!members.length) return `<div class="alliance-empty-state alliance-empty-state--compact">Členové se načtou s dalším stavem hry.</div>`;
  return `
    <div class="alliance-kick-list">
      ${members.map((member) => {
        const statusCopy = getMemberStatusCopy(member.status);
        const roleLabel = member.role === "leader" ? "Leader" : "Člen";
        return `
          <article class="alliance-kick-row">
            <div class="alliance-kick-row__identity">
              ${renderMemberAvatar(member, "alliance-kick-row__avatar")}
              <span class="alliance-kick-row__body">
                <strong title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(roleLabel)} · ${escapeHtml(statusCopy.label)}</span>
              </span>
            </div>
            ${member.canStartKickVote ? `
              <button class="btn btn--danger alliance-kick-row__action" data-alliance-kick-start="${escapeHtml(member.playerId)}" data-alliance-kick-target-name="${escapeHtml(member.name)}">
                Vyloučit
              </button>
            ` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
};

const renderKickVoteAvailabilityNote = (activeAlliance) => {
  const reason = getKickVoteUnavailableReason(activeAlliance);
  const candidateList = renderKickCandidateList(activeAlliance);
  if (!reason && !candidateList) return "";
  return `
    <section class="alliance-section alliance-section--preview alliance-kick-panel--compact">
      <div class="alliance-section__head">
        <div>
          <strong>Vyloučení člena</strong>
        </div>
      </div>
      ${reason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(reason)}</div>` : ""}
      ${candidateList}
    </section>
  `;
};

const renderKickVoteInlineNote = (activeAlliance) => {
  const reason = getKickVoteUnavailableReason(activeAlliance);
  return reason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(reason)}</div>` : "";
};

const getCreateNameValidationMessage = (name) => {
  const value = String(name || "").trim();
  if (!value) return "Zadej název aliance.";
  if (value.length > MAX_ALLIANCE_NAME_LENGTH) return `Název aliance může mít max ${MAX_ALLIANCE_NAME_LENGTH} znaků.`;
  return "";
};

const getMemberInitials = (name) => String(name || "?").trim().slice(0, 2).toUpperCase();

const getMemberAvatarSrc = (member) => String(
  member?.avatarSrc ||
  member?.avatarUrl ||
  member?.playerAvatarSrc ||
  member?.playerAvatarUrl ||
  member?.avatar ||
  ""
).trim();

const getMemberPresence = (member) =>
  String(member?.presence || member?.onlineStatus || member?.connectionStatus || "offline").trim().toLowerCase() === "online"
    ? "online"
    : "offline";

const renderMemberPresence = (member) => {
  const presence = getMemberPresence(member);
  const presenceLabel = presence === "online" ? "Online" : "Offline";
  return `<span class="alliance-member-presence" data-presence="${escapeHtml(presence)}" title="${escapeHtml(presenceLabel)}" aria-label="${escapeHtml(presenceLabel)}"></span>`;
};

const renderMemberAvatar = (member, className) => {
  const avatarSrc = getMemberAvatarSrc(member);
  const stateClass = avatarSrc ? "has-image" : "";
  const presence = getMemberPresence(member);
  const roleLabel = member?.role === "leader" ? "Leader" : "Člen";
  const statusCopy = getMemberStatusCopy(member?.status);
  const name = String(member?.name || "Člen aliance").trim();
  const presenceLabel = presence === "online" ? "Online" : "Offline";
  const meta = `${roleLabel} · ${statusCopy.label} · ${presenceLabel} · ${Number(member?.activeDistrictCount || 0)} districtů`;
  if (avatarSrc) {
    return `
      <button
        type="button"
        class="${escapeHtml(className)} alliance-member-avatar ${stateClass} is-${escapeHtml(presence)}"
        data-alliance-member-avatar-open
        data-alliance-member-avatar-src="${escapeHtml(avatarSrc)}"
        data-alliance-member-avatar-name="${escapeHtml(name)}"
        data-alliance-member-avatar-meta="${escapeHtml(meta)}"
        aria-label="Zvětšit avatar člena ${escapeHtml(name)}"
        >
          <span class="alliance-member-avatar__fallback" aria-hidden="true">${escapeHtml(getMemberInitials(name))}</span>
          <img class="alliance-member-avatar__image" src="${escapeHtml(avatarSrc)}" alt="" loading="lazy" decoding="async">
        </button>
      `;
  }
  return `
    <span class="${escapeHtml(className)} alliance-member-avatar ${stateClass} is-${escapeHtml(presence)}" aria-hidden="true">
      <span class="alliance-member-avatar__fallback">${escapeHtml(getMemberInitials(name))}</span>
    </span>
  `;
};

const isAllianceLeader = (activeAlliance) => activeAlliance?.currentPlayerRole === "leader";
const isAllianceManager = (activeAlliance) =>
  Boolean(isAllianceLeader(activeAlliance) || activeAlliance?.canInvite || activeAlliance?.canDisband);

const getAllianceExitCopy = (activeAlliance) =>
  isAllianceLeader(activeAlliance)
    ? {
        actionLabel: "Rozpustit alianci",
        title: "Rozpustit alianci?",
        text: "Tahle akce zruší alianci pro všechny členy.",
        confirmLabel: "Rozpustit alianci",
        successMessage: "Aliance byla rozpuštěna."
      }
    : {
        actionLabel: "Opustit alianci",
        title: "Opustit alianci?",
        text: "Opravdu chceš opustit alianci? Na 4 h dostaneš 50% debuff na útok, obranu, výrobu a income.",
        confirmLabel: "Opustit alianci",
        successMessage: "Aliance byla opuštěna."
      };

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

const commandMessage = (response, fallback) => {
  const error = response?.errors?.[0] || {};
  return toPlayerFacingMessage(error.code, toPlayerFacingMessage(error.message, fallback));
};

const runAllianceCommand = async (type, payload, successMessage) => {
  if (pendingAllianceCommand) {
    notify("Počkej, alianční akce se ještě vyřizuje.");
    return false;
  }
  pendingAllianceCommand = true;
  document.body?.classList.add("alliance-command-pending");
  try {
    const response = await submitServerAllianceCommand({ type, payload });
    if (!response?.accepted) {
      notify(commandMessage(response, "Alianční akci se nepodařilo dokončit."));
      return false;
    }
    notify(successMessage);
    return true;
  } catch (_error) {
    notify("Aliance se teď nedovolala serveru. Zkus to znovu.");
    return false;
  } finally {
    pendingAllianceCommand = false;
    document.body?.classList.remove("alliance-command-pending");
  }
};

const syncAllianceModalBodyState = () => {
  const hasOpenAllianceModal = ALLIANCE_MODAL_IDS.some((id) => {
    const modal = qs(id);
    return modal && !modal.classList.contains("hidden");
  });
  document.body?.classList.toggle("alliance-modal-open", hasOpenAllianceModal);
};

const persistAllianceModalOpen = (isOpen) => {
  try {
    sessionStorage.setItem(ALLIANCE_MODAL_SESSION_KEY, isOpen ? "1" : "0");
  } catch (_error) {
    // Session restore is best-effort only.
  }
};

const shouldRestoreAllianceModalOpen = () => {
  try {
    return sessionStorage.getItem(ALLIANCE_MODAL_SESSION_KEY) === "1";
  } catch (_error) {
    return false;
  }
};

const setModalVisible = (modal, visible) => {
  if (!modal) return;
  if (visible) {
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    modal.hidden = false;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  } else {
    modal.classList.add("hidden");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    closeOverlay(modal, { restoreFocus: false });
  }
  if (ALLIANCE_MODAL_IDS.includes(modal.id)) {
    syncAllianceModalBodyState();
  }
};

const isModalVisible = (id) => {
  const modal = qs(id);
  return Boolean(modal && !modal.classList.contains("hidden") && modal.hidden !== true);
};

const closeAllianceMemberLightbox = () => {
  const lightbox = qs("alliance-member-lightbox");
  const image = qs("alliance-member-lightbox-image");
  if (image instanceof HTMLImageElement) {
    image.removeAttribute("src");
  }
  setModalVisible(lightbox, false);
  if (lastAllianceMemberAvatarTrigger instanceof HTMLElement) {
    lastAllianceMemberAvatarTrigger.focus({ preventScroll: true });
  }
  lastAllianceMemberAvatarTrigger = null;
};

const openAllianceMemberLightbox = (trigger) => {
  const avatarSrc = String(trigger?.getAttribute("data-alliance-member-avatar-src") || "").trim();
  if (!avatarSrc) return;
  const name = String(trigger.getAttribute("data-alliance-member-avatar-name") || "Člen aliance").trim();
  const meta = String(trigger.getAttribute("data-alliance-member-avatar-meta") || "").trim();
  const lightbox = qs("alliance-member-lightbox");
  const image = qs("alliance-member-lightbox-image");
  const title = qs("alliance-member-lightbox-title");
  const metaEl = qs("alliance-member-lightbox-meta");
  if (!lightbox || !(image instanceof HTMLImageElement)) return;
  lastAllianceMemberAvatarTrigger = trigger;
  image.src = avatarSrc;
  image.alt = `Avatar člena ${name}`;
  if (title) title.textContent = name;
  if (metaEl) metaEl.textContent = meta;
  setModalVisible(lightbox, true);
  qs("alliance-member-lightbox-close")?.focus({ preventScroll: true });
};

const getSelectedIconOption = () =>
  getAllianceIconById(selectedIconKey);

const getAllianceIconOptionByTag = (tag) =>
  getAllianceIconByTag(tag);

const renderAllianceIconSvg = (iconKey) => {
  const icon = getAllianceIconById(iconKey);
  if (icon.id === "reaper") {
    return `
      <svg class="alliance-crest-svg alliance-crest-icon-inline" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M50 10c-18 3-31 18-31 39 0 17 9 31 22 36v-9h-8V62h7l-7-8 8-10 9 8 9-8 8 10-7 8h7v14h-8v9c13-5 22-19 22-36 0-21-13-36-31-39Zm-9 50c-5 0-9-3-9-8 8-3 14-1 18 5-2 2-5 3-9 3Zm18 0c-4 0-7-1-9-3 4-6 10-8 18-5 0 5-4 8-9 8Z"></path>
        <path d="M72 15c12 10 18 24 18 42 0 12-4 23-11 32 2-12 3-23 1-33-2-18-9-31-8-41Z"></path>
      </svg>
    `;
  }
  return `
    <span
      class="alliance-crest-svg alliance-crest-icon"
      style="--alliance-icon-url: url('${escapeHtml(icon.asset)}')"
      aria-hidden="true"
    >
      <img class="alliance-crest-icon__fallback" src="${escapeHtml(icon.asset)}" alt="" loading="lazy">
    </span>
  `;
};

const renderIconPicker = () => {
  const picker = qs("alliance-icon-picker");
  if (!picker) return;
  picker.innerHTML = ALLIANCE_ICON_OPTIONS.map((option) => `
    <button
      type="button"
      class="alliance-icon-option ${option.id === selectedIconKey ? "is-selected" : ""}"
      data-alliance-icon-option="${escapeHtml(option.id)}"
      aria-pressed="${option.id === selectedIconKey ? "true" : "false"}"
      aria-label="${escapeHtml(option.label)}"
      title="${escapeHtml(option.label)}"
    >
      ${renderAllianceIconSvg(option.id)}
      <span>${escapeHtml(option.label)}</span>
    </button>
  `).join("");
};

const renderAllianceIdentityMarkup = (alliance) => `
  <span class="alliance-badge-markup">
    <span class="alliance-badge-markup__icon">
      ${renderAllianceIconSvg(getAllianceIconOptionByTag(alliance?.tag).id)}
    </span>
    <span class="alliance-badge-markup__name">${escapeHtml(alliance?.name || "Aliance")}</span>
  </span>
`;

const renderMember = (member, { management = false } = {}) => {
  const statusCopy = getMemberStatusCopy(member.status);
  const roleLabel = member.role === "leader" ? "Leader" : "Člen";
  const deadlineRows = [
    member.readyDueAt ? `<span>Aktivní do: ${escapeHtml(formatShortDateTime(member.readyDueAt))}</span>` : ""
  ].filter(Boolean).join("");
  return `
    <article class="alliance-member-card" data-member-status="${escapeHtml(statusCopy.tone)}">
      ${renderMemberAvatar(member, "alliance-member-card__avatar")}
      <div class="alliance-member-card__body">
        <div class="alliance-member-card__head">
          <span class="alliance-member-name-line">
            <strong title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</strong>
          </span>
          <span class="alliance-chip ${member.role === "leader" ? "alliance-chip--gold" : ""}">${escapeHtml(roleLabel)}</span>
          ${renderMemberPresence(member)}
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
        <button class="btn btn--primary" type="button" data-alliance-management-open>Otevřít správu</button>
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
          <strong>Hlasování aliance</strong>
        </div>
      </div>
      ${activeVote ? `
        <div class="alliance-inline-note">
          Probíhá hlasování, které se tě týká. Obnovení aktivity může stav změnit podle pravidel serveru.
        </div>
      ` : ""}
      <div class="alliance-vote-list">${voteRows}</div>
    </section>
  `;
};

const renderChat = (messages = [], activeAlliance = latestAllianceBoard?.activeAlliance || null) => {
  const log = document.querySelector("[data-alliance-chat-log]");
  if (!log) return;
  const currentPlayerId = latestAllianceBoard?.currentPlayerId || "";
  const disabledReason = getAllianceChatDisabledReason(activeAlliance);
  log.innerHTML = messages.length
    ? messages.map((message) => {
        const isOwn = message.authorPlayerId === currentPlayerId;
        const sentAt = formatChatTimestamp(message.createdAt || message.sentAt || message.timestamp);
        return `
          <div class="alliance-chat__item server-chat-panel__message ${isOwn ? "alliance-chat__item--own" : ""}">
            <strong class="server-chat-panel__author">${escapeHtml(isOwn ? "Ty" : message.authorName)}</strong>
            <time class="server-chat-panel__timestamp" datetime="${escapeHtml(sentAt.iso)}">${escapeHtml(sentAt.label)}</time>
            <span class="server-chat-panel__text">${escapeHtml(message.body)}</span>
          </div>
        `;
      }).join("")
    : `<div class="alliance-empty-state alliance-empty-state--compact">${escapeHtml(disabledReason || "Alianční chat je prázdný. První zpráva určí směr akce.")}</div>`;
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
  log.innerHTML = (Array.isArray(messages) && messages.length ? messages : getGlobalChatDemoMessages()).slice(0, 30).map((message, index) => {
    const color = normalizeChatColor(message.color, message.author === "Ty" ? getPlayerGangColor() : "#facc15");
    const sentAt = formatChatTimestamp(message.sentAt || message.createdAt || message.timestamp, Date.now() - index * 90 * 1000);
    return `
    <div class="alliance-chat__item server-chat-panel__message">
      <strong class="server-chat-panel__author" style="--chat-author-color: ${escapeHtml(color)}">${escapeHtml(message.author || "System")}</strong>
      <time class="server-chat-panel__timestamp" datetime="${escapeHtml(sentAt.iso)}">${escapeHtml(sentAt.label)}</time>
      <span class="server-chat-panel__text">${escapeHtml(message.text || "")}</span>
    </div>
  `;
  }).join("");
  const status = qs("global-chat-status");
  if (status) status.textContent = "Lokální kanál: zprávy zůstávají jen v tomhle prohlížeči.";
};

const saveGlobalMessage = (text) => {
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  const previousMessages = Array.isArray(messages) && messages.length ? messages : getGlobalChatDemoMessages();
  messages = [{ author: "Ty", text, color: getPlayerGangColor(), sentAt: new Date().toISOString() }, ...previousMessages].slice(0, 30);
  localStorage.setItem(GLOBAL_CHAT_KEY, JSON.stringify(messages));
  const status = qs("global-chat-status");
  if (status) status.textContent = "Zpráva uložená jen v tomhle prohlížeči.";
};

const renderAllianceTabs = () => `
  <nav class="alliance-tabs" aria-label="Alliance sections">
    <div class="alliance-tabs__list" role="tablist">
      ${ALLIANCE_TABS.map((tab) => `
        <button
          type="button"
          class="alliance-tab ${selectedAllianceTab === tab.key ? "is-active" : ""}"
          data-alliance-tab="${escapeHtml(tab.key)}"
          aria-selected="${selectedAllianceTab === tab.key ? "true" : "false"}"
        >${escapeHtml(tab.label)}</button>
      `).join("")}
    </div>
    <button class="alliance-tabs__close" type="button" data-alliance-modal-close aria-label="Zavřít">✕</button>
  </nav>
`;

const renderReadyBlock = (activeAlliance, { management = false, hideLabel = false } = {}) => {
  const ready = getReadyCopy(activeAlliance?.readyReasonCode);
  const canConfirm = Boolean(activeAlliance?.canConfirmReady);
  const readyHint = canConfirm ? "Do konce okna zvol Zůstávám nebo Končím." : ready.hint;
  return `
    <div class="alliance-ready-card" data-tone="${escapeHtml(ready.tone)}" title="${escapeHtml(activeAlliance?.readyReasonCode || "active")}">
      <div class="alliance-ready-card__copy">
        ${hideLabel ? "" : `<strong>${escapeHtml(ready.label)}</strong>`}
        ${readyHint ? `<small>${escapeHtml(readyHint)}</small>` : ""}
        <span class="alliance-ready-card__timer">Zbývá ${renderReadyCountdown(activeAlliance, "alliance-ready-countdown alliance-ready-countdown--inline")}</span>
      </div>
      <div class="alliance-ready-card__actions">
        <button class="btn btn--primary alliance-ready-btn ${management ? "alliance-ready-btn--management" : ""}" id="${management ? "alliance-management-ready-btn" : "alliance-ready-btn"}" ${canConfirm ? "" : "disabled"}>
          Zůstávám
        </button>
        <button class="btn btn--ghost alliance-ready-exit-btn" type="button" data-alliance-leave-open>
          Končím
        </button>
      </div>
    </div>
  `;
};

const renderCreateAllianceCard = (board) => {
  const canCreate = board?.canCreateAlliance === true;
  const disabledReason = canCreate ? "" : getCreateDisabledReason(board?.createDisabledReason);
  const maxMembers = Number(board?.maxAllianceSize || MAX_ALLIANCE_SIZE_FALLBACK);
  return `
    <section class="alliance-create-card">
      <div class="alliance-section__head">
        <div>
          <span>Nová aliance</span>
          <strong>Vytvoř vlastní crew</strong>
        </div>
      </div>
      <p class="alliance-create-card__copy">Zadej název, vyber znak a založ malou crew. Max ${escapeHtml(maxMembers)} hráči.</p>
      ${disabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(disabledReason)}</div>` : ""}
      <button class="btn btn--primary alliance-create-card__cta" id="alliance-create-toggle-btn" ${canCreate ? "" : "disabled"}>Vytvořit alianci</button>
    </section>
  `;
};

const renderOverviewMemberRow = (member) => {
  const statusCopy = getMemberStatusCopy(member.status);
  const roleLabel = member.role === "leader" ? "Leader" : "Člen";
  return `
    <li class="alliance-overview-member" data-member-status="${escapeHtml(statusCopy.tone)}">
      ${renderMemberAvatar(member, "alliance-overview-member__avatar")}
      <span class="alliance-overview-member__body">
        <span class="alliance-member-name-line">
          <strong title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</strong>
          ${renderMemberPresence(member)}
        </span>
        <span>${escapeHtml(roleLabel)} · ${escapeHtml(statusCopy.label)}</span>
      </span>
    </li>
  `;
};

const renderOverviewPanel = (activeAlliance) => {
  const ready = getReadyCopy(activeAlliance.readyReasonCode);
  const maxMembers = getAllianceMaxMembers(activeAlliance);
  const members = activeAlliance.members || [];
  return `
    <section class="alliance-overview-card">
      <div class="alliance-overview-card__identity">
        <div class="alliance-overview-card__topline">
          <span class="alliance-overview-card__eyebrow">Název aliance</span>
          <div class="alliance-overview-card__meta">
            <span class="alliance-overview-card__count">${Number(activeAlliance.memberCount || members.length || 0)}/${maxMembers} členů</span>
            <span class="alliance-state-pill alliance-state-pill--ready" data-tone="${escapeHtml(ready.tone)}">
              ${escapeHtml(ready.label)}
              ${renderReadyCountdown(activeAlliance)}
            </span>
          </div>
        </div>
        ${renderAllianceIdentityMarkup(activeAlliance)}
        ${renderReadyBlock(activeAlliance)}
      </div>
      <div class="alliance-overview-card__members">
        <span class="alliance-overview-card__members-title">Členové</span>
        <ul class="alliance-overview-member-list">
          ${members.length
            ? members.map((member) => renderOverviewMemberRow(member)).join("")
            : `<li class="alliance-empty-state alliance-empty-state--compact">Členové se načtou s dalším stavem hry.</li>`}
        </ul>
      </div>
    </section>
    ${renderKickVotePanel(activeAlliance, { compact: true })}
  `;
};

const renderMembersPanel = (activeAlliance, { management = false } = {}) => {
  const members = activeAlliance?.members || [];
  return `
    <section class="alliance-section">
      <div class="alliance-section__head">
        <div>
          <span>Roster</span>
          <strong>Členové aliance</strong>
        </div>
      </div>
      <div class="alliance-members">
        ${members.length
          ? members.map((member) => renderMember(member, { management })).join("")
          : `<div class="alliance-empty-state alliance-empty-state--compact">Crew je prázdná. Jakmile přijde roster, objeví se tady.</div>`}
      </div>
    </section>
  `;
};

const renderChatPanel = (activeAlliance) => {
  const disabledReason = getAllianceChatDisabledReason(activeAlliance);
  return `
    <section class="alliance-section alliance-section--chat alliance-chat-card">
      <div class="alliance-chat server-chat-panel alliance-chat--modal">
        <div class="server-chat-panel__composer-head alliance-chat__head">
          <div>
            <div class="alliance-chat__title">Alianční chat</div>
            <p class="alliance-chat__visibility">Viditelný jen pro členy aliance.</p>
          </div>
        </div>
        ${disabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(disabledReason)}</div>` : ""}
        <div class="alliance-chat__log" data-alliance-chat-log></div>
        <div class="server-chat-panel__composer alliance-chat__input alliance-chat__input--modal alliance-active-card__chat-compose">
          <input class="server-chat-panel__input" type="text" maxlength="240" placeholder="Napiš zprávu do aliančního chatu..." data-alliance-chat-input ${disabledReason ? "disabled" : ""}>
          <button type="button" class="btn btn--primary server-chat-panel__send server-chat-panel__send--arrow" data-alliance-chat-send aria-label="Odeslat zprávu" title="Odeslat" ${disabledReason ? "disabled" : ""}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  `;
};

const renderSentInvitesPanel = (activeAlliance) => {
  if (!activeAlliance || !isAllianceManager(activeAlliance)) return "";
  const pendingInvites = activeAlliance.pendingInvites || [];
  return `
    <section class="alliance-section">
      <div class="alliance-section__head">
        <div>
          <span>Správa</span>
          <strong>Odeslané pozvánky</strong>
        </div>
      </div>
      <div class="alliance-list">
        ${pendingInvites.length ? pendingInvites.map((invite) => `
          <article class="alliance-invite-card">
            <div>
              <strong>${escapeHtml(invite.targetName)}</strong>
              <span>Pozváno ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
            </div>
          </article>
        `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné aktivní pozvánky.</div>`}
      </div>
    </section>
  `;
};

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
      `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné pozvánky. Až tě někdo pozve, uvidíš to tady.</div>`}
    </div>
  </section>
  ${renderSentInvitesPanel(board?.activeAlliance || null)}
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
          <button class="btn btn--ghost" data-alliance-join="${escapeHtml(alliance.allianceId)}" ${alliance.canJoin ? "" : "disabled"} title="${escapeHtml(getJoinDisabledReason(alliance))}">
            ${escapeHtml(alliance.canJoin ? "Připojit" : getJoinDisabledReason(alliance))}
          </button>
        </article>
      `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné veřejné aliance. Založ crew nebo počkej na pozvánku.</div>`}
    </div>
  </section>
`;

const renderAllianceLauncher = (activeAlliance) => {
  const button = qs("alliance-btn");
  if (!button) return;
  const iconKey = activeAlliance ? getAllianceIconOptionByTag(activeAlliance.tag).id : "reaper";
  button.innerHTML = `
    <span class="alliance-launcher__crest" aria-hidden="true">
      ${activeAlliance ? renderAllianceIconSvg(iconKey) : `<span class="alliance-launcher__crest-fallback">AL</span>`}
    </span>
    <span class="alliance-launcher__body">
      <span class="alliance-launcher__eyebrow">Aliance</span>
      <strong class="alliance-launcher__name" title="${escapeHtml(activeAlliance?.name || "Žádná aliance")}">${escapeHtml(activeAlliance?.name || "Žádná aliance")}</strong>
    </span>
  `;
};

const renderManagementPanel = (activeAlliance) => {
  const inviteTargets = latestAllianceBoard?.eligibleInviteTargets || [];
  const freeSlots = Math.max(0, getAllianceMaxMembers(activeAlliance) - Number(activeAlliance.memberCount || 0));
  const canInviteFromManagement = Boolean(activeAlliance.canInvite || activeAlliance.isDevOnlyDemo);
  const inviteDisabledReason = canInviteFromManagement ? "" : getInviteDisabledReason(activeAlliance, inviteTargets);
  const kickVotePanel = renderKickVotePanel(activeAlliance);
  const exitCopy = getAllianceExitCopy(activeAlliance);

  return `
    <section class="alliance-management-panel">
      <div class="alliance-management-panel__summary">
        ${renderAllianceIdentityMarkup(activeAlliance)}
        <div class="alliance-management-status__badges">
          <span class="alliance-chip ${isAllianceLeader(activeAlliance) ? "alliance-chip--gold" : ""}">
            ${escapeHtml(isAllianceLeader(activeAlliance) ? "Leader" : "Člen")}
          </span>
        </div>
      </div>
      ${renderReadyBlock(activeAlliance, { management: true, hideLabel: true })}
      <section class="alliance-card">
        <div class="alliance-section__head">
          <div>
            <strong>Pozvat hráče</strong>
          </div>
          <span class="alliance-chip">${freeSlots} míst volných</span>
        </div>
        ${inviteDisabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(inviteDisabledReason)}</div>` : ""}
        <div class="alliance-invite-form">
          <select id="alliance-management-invite-name" ${canInviteFromManagement ? "" : "disabled"}>
            <option value="">Vyber hráče</option>
            ${inviteTargets.map((target) => `
              <option value="${escapeHtml(target.playerId)}" ${target.canInvite ? "" : "disabled"}>
                ${escapeHtml(target.name)}${target.disabledReason ? ` · ${escapeHtml(target.disabledReason)}` : ""}
              </option>
            `).join("")}
          </select>
          <button class="btn btn--primary" id="alliance-management-invite-btn" ${canInviteFromManagement ? "" : "disabled"}>Pozvat</button>
        </div>
      </section>
      ${kickVotePanel || renderKickVoteAvailabilityNote(activeAlliance)}
      <section class="alliance-card alliance-card--danger-zone">
        <div class="alliance-section__head">
          <div>
            <strong>${escapeHtml(exitCopy.actionLabel)}</strong>
          </div>
        </div>
        <div class="alliance-exit-row">
          <div class="alliance-inline-note" data-tone="warning">${escapeHtml(exitCopy.text)}</div>
          <button class="btn btn--danger" type="button" data-alliance-leave-open>${escapeHtml(exitCopy.actionLabel)}</button>
        </div>
      </section>
    </section>
  `;
};

const renderAllianceState = () => {
  const board = latestAllianceBoard;
  const createEntry = qs("alliance-create-entry");
  const activePanel = qs("alliance-active-panel");
  const invitesPanel = qs("alliance-player-invites-panel");
  const listPanel = qs("alliance-list-panel");
  const activeAlliance = board?.activeAlliance || null;
  const allianceModal = qs("alliance-modal");

  document.querySelector("[data-gang-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Žádná"));
  document.querySelector("[data-player-popup-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Žádná"));
  renderAllianceLauncher(activeAlliance);
  createEntry?.classList.toggle("hidden", Boolean(activeAlliance));

  if (createEntry) {
    createEntry.innerHTML = activeAlliance ? "" : renderCreateAllianceCard(board);
  }

  if (activePanel) {
    if (selectedAllianceTab === "members") selectedAllianceTab = "overview";
    allianceModal?.setAttribute("data-alliance-tab", activeAlliance ? selectedAllianceTab : "empty");
    if (!activeAlliance) {
      activePanel.innerHTML = "";
    } else {
      const panels = {
        overview: renderOverviewPanel(activeAlliance),
        chat: renderChatPanel(activeAlliance),
        management: renderManagementPanel(activeAlliance),
        invites: renderInvitesAndPublicPanel(board)
      };
      activePanel.innerHTML = `
        <div class="alliance-active-card alliance-active-card--${escapeHtml(selectedAllianceTab)}">
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

  updateAllianceReadyCountdowns();
  renderChat(activeAlliance?.chatMessages || [], activeAlliance);
};

const rerenderAll = () => {
  renderAllianceState();
  renderGlobalServerChat();
  syncCreateModalState();
};

const openAllianceModal = () => {
  persistAllianceModalOpen(true);
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const openAllianceManagementTab = () => {
  selectedAllianceTab = "management";
  persistAllianceModalOpen(true);
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const closeAllAllianceModals = () => {
  persistAllianceModalOpen(false);
  ALLIANCE_MODAL_IDS.forEach((id) =>
    setModalVisible(qs(id), false)
  );
  lastAllianceMemberAvatarTrigger = null;
  pendingKickVoteTarget = null;
};

const resetCreateForm = () => {
  if (qs("alliance-create-name")) qs("alliance-create-name").value = "";
  selectedIconKey = "reaper";
  renderIconPicker();
};

const syncCreateModalState = () => {
  const canCreate = latestAllianceBoard?.canCreateAlliance === true;
  const name = String(qs("alliance-create-name")?.value || "").trim();
  const nameReason = name && name.length > MAX_ALLIANCE_NAME_LENGTH ? getCreateNameValidationMessage(name) : "";
  const reason = canCreate ? nameReason : getCreateDisabledReason(latestAllianceBoard?.createDisabledReason);
  const button = qs("alliance-create-btn");
  const reasonEl = qs("alliance-create-disabled-reason");
  const input = qs("alliance-create-name");
  if (input instanceof HTMLInputElement) {
    input.maxLength = MAX_ALLIANCE_NAME_LENGTH;
  }
  if (button) {
    button.disabled = !canCreate || Boolean(nameReason);
    button.title = reason;
    button.textContent = "Vytvořit alianci";
  }
  if (reasonEl) {
    reasonEl.textContent = reason;
    reasonEl.classList.toggle("hidden", !reason);
  }
};

const openCreateModal = () => {
  renderIconPicker();
  syncCreateModalState();
  setModalVisible(qs("alliance-create-modal"), true);
};

const openAllianceExitModal = () => {
  const activeAlliance = latestAllianceBoard?.activeAlliance;
  if (!activeAlliance) return;
  const copy = getAllianceExitCopy(activeAlliance);
  const title = qs("alliance-leave-modal-title");
  const text = qs("alliance-leave-modal-text");
  const confirm = qs("alliance-leave-confirm-btn");
  if (title) title.textContent = copy.title;
  if (text) text.textContent = copy.text;
  if (confirm) confirm.textContent = copy.confirmLabel;
  setModalVisible(qs("alliance-leave-modal"), true);
};

const openKickConfirmModal = (playerId, playerName) => {
  const activeAlliance = latestAllianceBoard?.activeAlliance;
  if (!activeAlliance || !playerId) return;
  const targetMember = (activeAlliance.members || []).find((member) => member.playerId === playerId);
  if (latestAllianceBoard?.currentPlayerId === playerId) {
    notify("Sám sebe z crew nevykopneš.");
    return;
  }
  if (!targetMember?.canStartKickVote) {
    notify(getKickVoteUnavailableReason(activeAlliance));
    return;
  }
  pendingKickVoteTarget = { playerId, playerName: playerName || playerId, allianceId: activeAlliance.allianceId };
  const text = qs("alliance-kick-confirm-text");
  if (text) {
    text.textContent = `Aliance bude hlasovat o vyloučení člena ${pendingKickVoteTarget.playerName}. Hlasování se spustí až po potvrzení.`;
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
  qs("alliance-create-toggle-btn")?.addEventListener("click", openCreateModal);
  qs("alliance-create-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-create-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-leave-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-cancel-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-kick-confirm-modal-backdrop")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-modal-close")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-cancel-btn")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-member-lightbox-backdrop")?.addEventListener("click", closeAllianceMemberLightbox);
  qs("alliance-member-lightbox-close")?.addEventListener("click", closeAllianceMemberLightbox);
  qs("alliance-kick-confirm-submit-btn")?.addEventListener("click", async () => {
    if (!pendingKickVoteTarget) return;
    if (latestAllianceBoard?.activeAlliance?.isDevOnlyDemo) {
      notify(`Preview: hlasování o vyloučení člena ${pendingKickVoteTarget.playerName} je připravené.`);
      closeKickConfirmModal();
      return;
    }
    const { allianceId, playerId } = pendingKickVoteTarget;
    const ok = await runAllianceCommand("start-alliance-kick-vote", {
      allianceId,
      targetPlayerId: playerId
    }, "Hlasování bylo spuštěno.");
    if (ok) closeKickConfirmModal();
  });
  qs("alliance-create-name")?.addEventListener("input", syncCreateModalState);

  qs("alliance-create-btn")?.addEventListener("click", async () => {
    const name = String(qs("alliance-create-name")?.value || "").trim();
    const tag = getSelectedIconOption().tag;
    if (latestAllianceBoard?.canCreateAlliance !== true) {
      notify(getCreateDisabledReason(latestAllianceBoard?.createDisabledReason));
      syncCreateModalState();
      return;
    }
    const nameError = getCreateNameValidationMessage(name);
    if (nameError) {
      notify(nameError);
      syncCreateModalState();
      return;
    }
    const ok = await runAllianceCommand("create-alliance", { name, tag }, `Aliance ${name} byla založena.`);
    if (ok) {
      setModalVisible(qs("alliance-create-modal"), false);
      resetCreateForm();
    }
  });

  qs("alliance-leave-confirm-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (!activeAlliance) return;
    const type = activeAlliance.currentPlayerRole === "leader" ? "disband-alliance" : "leave-alliance";
    const successMessage = type === "disband-alliance" ? "Aliance byla rozpuštěna." : "Aliance byla opuštěna.";
    const ok = await runAllianceCommand(type, { allianceId: activeAlliance.allianceId }, successMessage);
    if (ok) setModalVisible(qs("alliance-leave-modal"), false);
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest(
      "[data-alliance-member-avatar-open], [data-alliance-tab], [data-alliance-modal-close], [data-alliance-leave-open], [data-alliance-management-open], [data-alliance-icon-option], [data-alliance-join], [data-alliance-invite-accept], [data-alliance-invite-reject], #alliance-create-toggle-btn, #alliance-ready-btn, #alliance-management-ready-btn, #alliance-management-open-btn, #alliance-management-invite-btn, [data-alliance-chat-send], [data-alliance-kick-start], [data-alliance-kick-vote]"
    ) : null;
    if (!(target instanceof HTMLElement)) return;
    const activeAlliance = latestAllianceBoard?.activeAlliance;

    if (target.hasAttribute("data-alliance-member-avatar-open")) {
      openAllianceMemberLightbox(target);
      return;
    }
    if (target.hasAttribute("data-alliance-modal-close")) {
      closeAllAllianceModals();
      return;
    }
    if (target.hasAttribute("data-alliance-tab")) {
      selectedAllianceTab = target.getAttribute("data-alliance-tab") || "overview";
      renderAllianceState();
      return;
    }
    if (target.hasAttribute("data-alliance-leave-open")) {
      openAllianceExitModal();
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
      openAllianceManagementTab();
      return;
    }
    if (target.id === "alliance-management-invite-btn") {
      const targetPlayerId = String(qs("alliance-management-invite-name")?.value || "").trim();
      if (!activeAlliance || !targetPlayerId) {
        notify("Vyber hráče pro pozvánku.");
        return;
      }
      if (activeAlliance.isDevOnlyDemo) {
        const targetPlayer = (latestAllianceBoard?.eligibleInviteTargets || []).find((target) => target.playerId === targetPlayerId);
        if (!targetPlayer || targetPlayer.canInvite === false) {
          notify("Tenhle hráč teď nejde pozvat.");
          return;
        }
        activeAlliance.pendingInvites = [
          {
            inviteId: `dev-demo-invite:${targetPlayerId}:${Date.now()}`,
            targetPlayerId,
            targetName: targetPlayer.name,
            createdAt: new Date().toISOString()
          },
          ...(activeAlliance.pendingInvites || [])
        ].slice(0, 8);
        latestAllianceBoard.eligibleInviteTargets = (latestAllianceBoard.eligibleInviteTargets || []).map((target) =>
          target.playerId === targetPlayerId
            ? { ...target, canInvite: false, disabledReason: "Pozvánka odeslaná" }
            : target
        );
        notify(`Preview: pozvánka pro ${targetPlayer.name} je odeslaná.`);
        renderAllianceState();
        return;
      }
      await runAllianceCommand("invite-alliance-member", {
        allianceId: activeAlliance.allianceId,
        targetPlayerId
      }, "Pozvánka byla odeslána.");
      return;
    }
    if (target.id === "alliance-ready-btn" || target.id === "alliance-management-ready-btn") {
      if (activeAlliance) {
        await runAllianceCommand("confirm-alliance-ready", { allianceId: activeAlliance.allianceId }, "Aktivita aliance byla potvrzena.");
      }
      return;
    }
    if (target.hasAttribute("data-alliance-chat-send")) {
      const input = document.querySelector("[data-alliance-chat-input]");
      const body = String(input?.value || "").trim();
      const disabledReason = getAllianceChatDisabledReason(activeAlliance);
      if (disabledReason) {
        notify(disabledReason);
        return;
      }
      if (!body) {
        notify("Napiš zprávu do aliančního chatu.");
        return;
      }
      if (activeAlliance?.isDevOnlyDemo) {
        const nextMessages = appendLocalAllianceChatMessage(activeAlliance, body);
        if (input instanceof HTMLInputElement) input.value = "";
        renderChat(nextMessages, activeAlliance);
        notify("Zpráva přidána do aliančního chatu.");
        return;
      }
      const ok = await runAllianceCommand("send-alliance-chat-message", { allianceId: activeAlliance.allianceId, body }, "Zpráva odeslána.");
      if (ok) {
        if (input instanceof HTMLInputElement) input.value = "";
        const currentPlayerId = latestAllianceBoard?.currentPlayerId || "";
        const refreshedAlliance = latestAllianceBoard?.activeAlliance || activeAlliance;
        const serverEchoExists = (refreshedAlliance?.chatMessages || []).some((message) =>
          message.authorPlayerId === currentPlayerId
          && String(message.body || "").trim() === body
          && Math.abs(Date.now() - Date.parse(message.createdAt || "")) < 15000
        );
        if (!serverEchoExists) {
          const nextMessages = appendLocalAllianceChatMessage(refreshedAlliance, body);
          renderChat(nextMessages, refreshedAlliance);
        }
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
      }, target.hasAttribute("data-alliance-invite-accept") ? "Pozvánka přijata." : "Pozvánka odmítnuta.");
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
      }, "Hlas byl odeslán.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (isModalVisible("alliance-member-lightbox")) {
        event.preventDefault();
        closeAllianceMemberLightbox();
        return;
      }
      closeAllAllianceModals();
    }
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.hasAttribute("data-alliance-chat-input")) {
      event.preventDefault();
      document.querySelector("[data-alliance-chat-send]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  qs("alliance-chat-send")?.addEventListener("click", () => {
    const input = qs("alliance-chat-input");
    const text = String(input?.value || "").trim();
    if (!text) {
      notify("Napiš zprávu do globálního chatu.");
      return;
    }
    saveGlobalMessage(text);
    if (input instanceof HTMLInputElement) input.value = "";
    renderGlobalServerChat();
  });

  document.addEventListener("empire:gameplay-slice-rendered", (event) => {
    latestAllianceBoard = createDevOnlyAllianceBoard(event?.detail?.gameplaySlice?.allianceBoard || null);
    rerenderAll();
    if (shouldRestoreAllianceModalOpen()) {
      setModalVisible(qs("alliance-modal"), true);
    }
    window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  });

  window.empireStreetsAllianceState = {
    getActiveAlliance: () => latestAllianceBoard?.activeAlliance || null,
    getMapBadge: () => {
      const alliance = latestAllianceBoard?.activeAlliance;
      const icon = getAllianceIconOptionByTag(alliance?.tag);
      return alliance ? { name: alliance.name, iconKey: icon.id, symbol: icon.symbol, tag: alliance.tag || icon.tag, asset: icon.asset } : null;
    }
  };

  renderGlobalServerChat();
  renderIconPicker();
  syncCreateModalState();
  latestAllianceBoard = createDevOnlyAllianceBoard(latestAllianceBoard);
  rerenderAll();
  ensureAllianceCountdownTimer();
  if (shouldRestoreAllianceModalOpen()) {
    setModalVisible(qs("alliance-modal"), true);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindAllianceRuntime, { once: true });
} else {
  bindAllianceRuntime();
}
