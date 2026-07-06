import { submitServerAllianceCommand } from "./runtime.js";
import { STORAGE_KEYS } from "../config.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";
import { ALLIANCE_ICON_OPTIONS, getAllianceIconById, getAllianceIconByTag } from "./alliance-icons.js";
import { LAUNCH_PLAYER_AVATAR_BY_FACTION_ID, START_PHASE_PLAYER_NAMES } from "./dev/demoScenarios.js";

const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const GLOBAL_CHAT_KEY = "empire_local_global_chat_state";
const ALLIANCE_CHAT_PREVIEW_KEY = "empire_local_alliance_chat_state";
const ALLIANCE_COLOR_PREVIEW_KEY = "empire_local_alliance_color_state";
const MAX_ALLIANCE_SIZE_FALLBACK = 4;
const MAX_ALLIANCE_NAME_LENGTH = 32;
const ALLIANCE_CREATE_REQUIRED_INFLUENCE = 150;
const DEFAULT_ALLIANCE_EMBLEM_COLOR = "#f7c948";

let latestAllianceBoard = null;
let selectedIconKey = "reaper";
let selectedAllianceColor = DEFAULT_ALLIANCE_EMBLEM_COLOR;
let selectedAllianceTab = "overview";
let pendingKickVoteTarget = null;
let pendingPublicAllianceAction = null;
let pendingAllianceExitMode = "leave";
let pendingAllianceCommand = false;
let lastAllianceMemberAvatarTrigger = null;
let allianceCountdownTimer = null;
let allianceCreateInfluenceObserver = null;

const qs = (id) => document.getElementById(id);
const ALLIANCE_MODAL_IDS = [
  "alliance-modal",
  "alliance-create-modal",
  "alliance-leave-modal",
  "alliance-ready-confirm-modal",
  "alliance-public-action-modal",
  "alliance-kick-confirm-modal",
  "alliance-member-lightbox"
];
const ALLIANCE_TABS = [
  { key: "overview", label: "Přehled" },
  { key: "chat", label: "Chat" },
  { key: "management", label: "Správa" },
  { key: "invites", label: "Pozvánky" },
  { key: "alliances", label: "Aliance" }
];

const ALLIANCE_COLOR_OPTIONS = Object.freeze([
  { id: "gold", label: "Zlato", value: "#f7c948" },
  { id: "red", label: "Krev", value: "#ff2f5f" },
  { id: "pink", label: "Neon", value: "#ff3f8f" },
  { id: "cyan", label: "Led", value: "#22d3ee" },
  { id: "green", label: "Toxin", value: "#34d399" },
  { id: "violet", label: "Void", value: "#a855f7" },
  { id: "orange", label: "Oheň", value: "#fb923c" },
  { id: "white", label: "Chrome", value: "#f8fafc" }
]);

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
  active: { label: "Aktivní", hint: "Do konce běžící časomíry zvol Zůstávám nebo Končím.", tone: "success" },
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
  ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE: "Vytvořit alianci půjde až od 150 vlivu.",
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
  PUBLIC_ALLIANCE_CONTACT_NOT_ALLOWED: "Veřejnou alianci může kontaktovat jen aktivní člen aliance.",
  PUBLIC_ALLIANCE_CONTACT_SELF: "Vyber jinou alianci.",
  PLAYER_ALREADY_IN_ALLIANCE: "Už jsi v alianci.",
  ALLIANCE_JOIN_LOCKED: "Po odchodu z aliance musíš počkat, než se přidáš.",
  ALLIANCE_CREATE_LOCKED: "Po odchodu z aliance musíš počkat, než založíš novou.",
  ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE: "Vytvořit alianci půjde až od 150 vlivu.",
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

const normalizeAllianceColor = (value, fallback = DEFAULT_ALLIANCE_EMBLEM_COLOR) =>
  normalizeChatColor(value, fallback);

const hexToRgbParts = (value) => {
  const color = normalizeAllianceColor(value).replace("#", "");
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16)
  ];
};

const getAllianceColorStyle = (color) => {
  const safeColor = normalizeAllianceColor(color);
  const [red, green, blue] = hexToRgbParts(safeColor);
  return `--alliance-emblem-color: ${safeColor}; --alliance-emblem-rgb: ${red}, ${green}, ${blue}; color: ${safeColor};`;
};

const readAllianceColorPreviewState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALLIANCE_COLOR_PREVIEW_KEY) || "{}");
    return parsed && typeof parsed === "object"
      ? {
          byAllianceId: parsed.byAllianceId && typeof parsed.byAllianceId === "object" ? parsed.byAllianceId : {},
          byName: parsed.byName && typeof parsed.byName === "object" ? parsed.byName : {},
          byTag: parsed.byTag && typeof parsed.byTag === "object" ? parsed.byTag : {}
        }
      : { byAllianceId: {}, byName: {}, byTag: {} };
  } catch {
    return { byAllianceId: {}, byName: {}, byTag: {} };
  }
};

const writeAllianceColorPreviewState = (state) => {
  try {
    localStorage.setItem(ALLIANCE_COLOR_PREVIEW_KEY, JSON.stringify(state));
  } catch (_error) {
    // Local emblem colors are UI-only fallback.
  }
};

const rememberAllianceColor = (alliance, color) => {
  const safeColor = normalizeAllianceColor(color);
  const state = readAllianceColorPreviewState();
  const allianceId = String(alliance?.allianceId || "").trim();
  const name = String(alliance?.name || "").trim().toLowerCase();
  const tag = String(alliance?.tag || "").trim().toUpperCase();
  if (allianceId) state.byAllianceId[allianceId] = safeColor;
  if (name) state.byName[name] = safeColor;
  if (tag) state.byTag[tag] = safeColor;
  writeAllianceColorPreviewState(state);
  return safeColor;
};

const getRememberedAllianceColor = (alliance) => {
  const state = readAllianceColorPreviewState();
  const allianceId = String(alliance?.allianceId || "").trim();
  const name = String(alliance?.name || "").trim().toLowerCase();
  const tag = String(alliance?.tag || "").trim().toUpperCase();
  return normalizeAllianceColor(
    (allianceId && state.byAllianceId[allianceId])
      || (name && state.byName[name])
      || (tag && state.byTag[tag])
      || "",
    ""
  );
};

const resolveAllianceEmblemColor = (alliance) => {
  const sourceColor = alliance?.emblemColor || alliance?.color || alliance?.allianceColor || getRememberedAllianceColor(alliance);
  const safeColor = normalizeAllianceColor(sourceColor, DEFAULT_ALLIANCE_EMBLEM_COLOR);
  if (alliance && sourceColor && !alliance.emblemColor) {
    alliance.emblemColor = safeColor;
  }
  return safeColor;
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

const createAlliancePreviewChatMessage = (activeAlliance, body) => {
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
  const message = createAlliancePreviewChatMessage(activeAlliance, body);
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

const getCurrentGamePhaseForAllianceDemo = () => {
  if (typeof document === "undefined") return "live";
  const phaseHost = document.querySelector("[data-map-canvas]");
  return String(phaseHost?.dataset?.gamePhase || "live").toLowerCase() === "launch" ? "launch" : "live";
};

const isOnboardingActiveForAllianceDemo = () => {
  if (typeof document === "undefined") return false;
  return Boolean(String(document.documentElement?.dataset?.onboardingStep || document.body?.dataset?.onboardingStep || "").trim());
};

const getCurrentPlayerInfluenceForAllianceCreate = () => {
  if (typeof document === "undefined") return 0;
  const raw = document.querySelector("[data-topbar-influence]")?.textContent || "";
  const value = Number.parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const hasRequiredInfluenceForAllianceCreate = () =>
  getCurrentPlayerInfluenceForAllianceCreate() >= ALLIANCE_CREATE_REQUIRED_INFLUENCE;

const getAllianceCreateInfluenceRequirementMessage = () =>
  `Vytvořit alianci půjde až od ${ALLIANCE_CREATE_REQUIRED_INFLUENCE} vlivu. Teď máš ${getCurrentPlayerInfluenceForAllianceCreate()}.`;

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
      canInvite: true,
      devOnlyPreview: true
    }));
};

const getInviteTargetsForSelect = (activeAlliance) => {
  const targets = latestAllianceBoard?.eligibleInviteTargets || [];
  if (targets.length) return targets;
  if (!activeAlliance || !isDevOnlyAllianceDemoEnabled()) return [];
  return createDevOnlyAllianceInviteTargets(activeAlliance.members || []);
};

const createDevOnlyAlliancePendingInvites = () => [
  {
    inviteId: "dev-demo-sent-invite-razor",
    targetPlayerId: "dev-demo-invite-razor",
    targetName: "Razor",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    inviteId: "dev-demo-sent-invite-nyx",
    targetPlayerId: "dev-demo-invite-nyx",
    targetName: "Nyx",
    createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString()
  }
];

const createDevOnlyIncomingInvites = () => [
  {
    inviteId: "dev-demo-incoming-iron-crown",
    allianceId: "dev-demo-alliance-iron-crown",
    allianceName: "Iron Crown",
    allianceTag: "CROWN",
    invitedByPlayerId: "dev-demo-leader-viktor",
    invitedByName: "Viktor",
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString()
  },
  {
    inviteId: "dev-demo-incoming-ghost-market",
    allianceId: "dev-demo-alliance-ghost-market",
    allianceName: "Ghost Market",
    allianceTag: "GHOST",
    invitedByPlayerId: "dev-demo-leader-mira",
    invitedByName: "Mira",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
];

const createDevOnlyPublicAlliances = (maxAllianceSize) => [
  {
    allianceId: "dev-demo-public-night-vipers",
    name: "Night Vipers",
    tag: "SNAKE",
    emblemColor: "#34d399",
    ownerPlayerId: "dev-demo-owner-karlos",
    ownerName: "Karlos",
    memberCount: 2,
    maxMembers: maxAllianceSize,
    canJoin: true,
    chatMessages: [],
    receivedInvites: []
  },
  {
    allianceId: "dev-demo-public-raven-syndicate",
    name: "Raven Syndicate",
    tag: "RAVEN",
    emblemColor: "#ff3f8f",
    ownerPlayerId: "dev-demo-owner-sable",
    ownerName: "Sable",
    memberCount: 3,
    maxMembers: maxAllianceSize,
    canJoin: true,
    chatMessages: [],
    receivedInvites: []
  },
  {
    allianceId: "dev-demo-public-skull-yard",
    name: "Skull Yard",
    tag: "SKULL",
    emblemColor: "#ff2f5f",
    ownerPlayerId: "dev-demo-owner-drake",
    ownerName: "Drake",
    memberCount: maxAllianceSize,
    maxMembers: maxAllianceSize,
    canJoin: false,
    joinDisabledReason: "Aliance je plná.",
    chatMessages: [],
    receivedInvites: []
  }
];

const normalizeDemoPublicAllianceIcons = (alliances, maxAllianceSize) => {
  const fallbackAlliances = createDevOnlyPublicAlliances(maxAllianceSize);
  const source = Array.isArray(alliances) && alliances.length ? alliances : fallbackAlliances;
  return source.map((alliance, index) => {
    const fallback = fallbackAlliances[index % fallbackAlliances.length];
    const icon = getAllianceIconByTag(alliance?.tag || fallback.tag);
    return {
      ...fallback,
      ...alliance,
      tag: icon.tag,
      emblemColor: resolveAllianceEmblemColor({ ...fallback, ...alliance, tag: icon.tag })
    };
  });
};

const createDevOnlyAllianceBoard = (baseBoard = null) => {
  if (!isDevOnlyAllianceDemoEnabled() || baseBoard?.activeAlliance) {
    return baseBoard;
  }
  const nowIso = new Date().toISOString();
  const currentPlayerId = baseBoard?.currentPlayerId || "dev-player";
  const allianceId = "dev-demo-alliance-zabijaci";
  const maxAllianceSize = baseBoard?.maxAllianceSize || MAX_ALLIANCE_SIZE_FALLBACK;
  const disableDevOnlyActiveAlliance = baseBoard?.disableDevOnlyActiveAlliance === true || isOnboardingActiveForAllianceDemo();
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
  const shouldUseActiveDemoAlliance = !disableDevOnlyActiveAlliance && getCurrentGamePhaseForAllianceDemo() === "launch";
  const activeAlliance = shouldUseActiveDemoAlliance ? {
    allianceId,
    name: "Zabijáci",
    tag: "REAPER",
    emblemColor: "#ff2f5f",
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
    pendingInvites: createDevOnlyAlliancePendingInvites(),
    chatMessages: storedChatMessages.length
      ? storedChatMessages
      : defaultChatMessages,
    defenseContributions: [],
    isDevOnlyDemo: true
  } : null;
  const canCreateAlliance = baseBoard?.canCreateAlliance === true
    || (!disableDevOnlyActiveAlliance && !activeAlliance && hasRequiredInfluenceForAllianceCreate());
  return {
    maxAllianceSize,
    currentPlayerId,
    activeAlliance,
    publicAlliances: disableDevOnlyActiveAlliance
      ? (baseBoard?.publicAlliances || [])
      : normalizeDemoPublicAllianceIcons(baseBoard?.publicAlliances, maxAllianceSize),
    incomingInvites: disableDevOnlyActiveAlliance
      ? (baseBoard?.incomingInvites || [])
      : (baseBoard?.incomingInvites?.length ? baseBoard.incomingInvites : createDevOnlyIncomingInvites()),
    eligibleInviteTargets: disableDevOnlyActiveAlliance
      ? (baseBoard?.eligibleInviteTargets || [])
      : createDevOnlyAllianceInviteTargets(members),
    allianceBadgesByPlayerId: activeAlliance ? Object.fromEntries(members.map((member) => [
      member.playerId,
      {
        allianceId,
        name: "Zabijáci",
        tag: "REAPER",
        emblemColor: "#ff2f5f"
      }
    ])) : (baseBoard?.allianceBadgesByPlayerId || {}),
    canCreateAlliance,
    createDisabledReason: canCreateAlliance ? null : (baseBoard?.createDisabledReason || "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE"),
    isDevOnlyCreatePreview: true,
    disableDevOnlyActiveAlliance
  };
};

const refreshDevOnlyCreateEligibility = () => {
  if (!latestAllianceBoard?.isDevOnlyCreatePreview || latestAllianceBoard.activeAlliance || latestAllianceBoard.disableDevOnlyActiveAlliance) {
    return false;
  }
  const canCreateAlliance = hasRequiredInfluenceForAllianceCreate();
  const createDisabledReason = canCreateAlliance ? null : "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE";
  const changed = latestAllianceBoard.canCreateAlliance !== canCreateAlliance
    || latestAllianceBoard.createDisabledReason !== createDisabledReason;
  if (changed) {
    latestAllianceBoard = {
      ...latestAllianceBoard,
      canCreateAlliance,
      createDisabledReason
    };
  }
  return changed;
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
  if (normalized === "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE") {
    return getAllianceCreateInfluenceRequirementMessage();
  }
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
        const activeVote = getActiveKickVoteForMember(activeAlliance, member.playerId);
        return `
          <article class="alliance-kick-row">
            <div class="alliance-kick-row__identity">
              ${renderMemberAvatar(member, "alliance-kick-row__avatar")}
              <span class="alliance-kick-row__body">
                <strong title="${escapeHtml(member.name)}">${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(roleLabel)} · ${escapeHtml(statusCopy.label)}</span>
              </span>
            </div>
            ${activeVote ? renderKickVoteProgress(activeVote) : member.canStartKickVote ? `
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

const getAllianceSuccessorCandidates = (activeAlliance) => {
  const currentPlayerId = String(latestAllianceBoard?.currentPlayerId || "");
  return (activeAlliance?.members || []).filter((member) =>
    member?.playerId
    && String(member.playerId) !== currentPlayerId
    && member.role !== "leader"
    && member.status !== "removed"
  );
};

const resolveAllianceExitMode = (activeAlliance, requestedMode = "") => {
  if (!isAllianceLeader(activeAlliance)) return "leave";
  if (requestedMode === "disband") return "disband";
  if (getAllianceSuccessorCandidates(activeAlliance).length > 0) return "transfer";
  return "disband";
};

const getAllianceExitCopy = (activeAlliance, mode = resolveAllianceExitMode(activeAlliance)) => {
  if (isAllianceLeader(activeAlliance) && mode === "transfer") {
    return {
      actionLabel: "Předat a odejít",
      title: "Předat vedení a odejít?",
      text: "Vyber nástupce. Po potvrzení odejdeš z aliance a na 4 h dostaneš 50% debuff na útok, obranu, výrobu a income.",
      confirmLabel: "Předat a odejít",
      successMessage: "Aliance byla opuštěna a vedení předáno."
    };
  }
  return isAllianceLeader(activeAlliance)
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
};

const getVoteCounts = (vote) => {
  const votes = Object.values(vote?.votes || {});
  return {
    yes: votes.filter((choice) => choice === "yes").length,
    no: votes.filter((choice) => choice === "no").length
  };
};

const getActiveKickVoteForMember = (activeAlliance, playerId) => {
  const normalizedPlayerId = String(playerId || "");
  if (!activeAlliance || !normalizedPlayerId) return null;
  const votes = [
    activeAlliance.activeVote,
    ...(activeAlliance.eligibleVotes || [])
  ].filter(Boolean);
  return votes.find((vote) =>
    vote.targetPlayerId === normalizedPlayerId && String(vote.status || "pending") === "pending"
  ) || null;
};

const renderKickVoteProgress = (vote) => {
  const counts = getVoteCounts(vote);
  const total = Number(vote?.requiredYesVotes || vote?.eligibleVoterIds?.length || 0);
  return `
    <span class="alliance-kick-row__progress" title="Hlasy pro vyloučení">
      ${Number(counts.yes || 0)}/${Math.max(1, total)}
    </span>
  `;
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

const getSelectedAllianceColor = () =>
  normalizeAllianceColor(selectedAllianceColor);

const getAllianceIconOptionByTag = (tag) =>
  getAllianceIconByTag(tag);

const ALLIANCE_INLINE_ICON_PATHS = Object.freeze({
  bull: [
    '<path d="M11 18c14 0 25 7 32 20h14c7-13 18-20 32-20-4 16-12 27-25 32l7 20-21 22-21-22 7-20C23 45 15 34 11 18Zm28 35-5 15 16 17 16-17-5-15H39Zm-2-4c4-4 8-6 13-6s9 2 13 6H37Z"/>',
    '<circle cx="40" cy="62" r="4"/>',
    '<circle cx="60" cy="62" r="4"/>'
  ],
  claw: [
    '<path d="M26 11h15L28 88H12l14-77Zm26 0h15L50 88H34l18-77Zm27 0h15L72 88H56l23-77Z"/>'
  ],
  cobra: [
    '<path d="M50 8c22 4 36 22 36 48 0 18-14 32-36 36-22-4-36-18-36-36C14 30 28 12 50 8Zm0 13c-12 8-18 19-18 34 0 12 6 20 18 24 12-4 18-12 18-24 0-15-6-26-18-34Z"/>',
    '<path d="M38 45c8-4 16-4 24 0l-6 10H44l-6-10Zm2 22h20l-10 13-10-13Z"/>',
    '<circle cx="42" cy="39" r="4"/>',
    '<circle cx="58" cy="39" r="4"/>'
  ],
  crown: [
    '<path d="M12 32 32 52 50 16l18 36 20-20-8 50H20L12 32Zm18 39h40l2-14-10 9-12-25-12 25-10-9 2 14Z"/>',
    '<path d="M24 87h52v8H24v-8Z"/>'
  ],
  dagger: [
    '<path d="M54 8 67 21 45 66 34 55 54 8Z"/>',
    '<path d="M28 55 45 72l-9 9-17-17 9-9Zm-9 26 8 8-8 8-8-8 8-8Zm13-31 23 23-7 7-23-23 7-7Z"/>'
  ],
  eye: [
    '<path d="M6 50c12-21 27-32 44-32s32 11 44 32C82 71 67 82 50 82S18 71 6 50Zm44-19c-11 0-20 8-20 19s9 19 20 19 20-8 20-19-9-19-20-19Z"/>',
    '<circle cx="50" cy="50" r="10"/>'
  ],
  fangs: [
    '<path d="M20 12c18 7 30 17 36 31L37 92C24 70 18 44 20 12Zm60 0c2 32-4 58-17 80L44 43c6-14 18-24 36-31Z"/>',
    '<path d="M38 24h24v12H38V24Z"/>'
  ],
  fist: [
    '<path d="M18 39c0-7 5-12 12-12 3 0 5 1 7 3 1-7 6-11 13-11 6 0 10 3 12 8 2-2 5-3 8-3 7 0 12 5 12 12v28c0 16-12 27-32 27S18 80 18 64V39Zm13 2v21h9V41h-9Zm18-10v31h9V31h-9Zm18 6v25h8V37h-8ZM28 70c3 7 10 10 22 10s19-3 22-10H28Z"/>'
  ],
  ghost: [
    '<path d="M50 10c20 0 34 15 34 36v44l-12-9-10 9-12-9-12 9-10-9-12 9V46c0-21 14-36 34-36Zm-14 39c6 0 10-4 10-10-9-3-17 0-20 7 2 2 5 3 10 3Zm28 0c5 0 8-1 10-3-3-7-11-10-20-7 0 6 4 10 10 10Z"/>'
  ],
  hydra: [
    '<path d="M18 25 35 8l14 17-10 12 11 18 11-18-10-12L65 8l17 17-10 13 12 13-14 12-12-14v34H42V49L30 63 16 51l12-13-10-13Z"/>',
    '<circle cx="35" cy="28" r="4"/>',
    '<circle cx="65" cy="28" r="4"/>',
    '<circle cx="50" cy="40" r="4"/>'
  ],
  jackal: [
    '<path d="M20 10 43 33l7-17 7 17 23-23-9 49-21 32-21-32-9-49Zm18 42-9-8 4 17 12 6-7-15Zm24 0-7 15 12-6 4-17-9 8ZM42 73h16l-8 13-8-13Z"/>'
  ],
  mask: [
    '<path d="M14 31c24-13 48-13 72 0l-9 38c-11 14-24 21-27 21s-16-7-27-21L14 31Zm19 23c8-4 16-4 24 1-8 10-18 12-30 4l6-5Zm34 0 6 5c-12 8-22 6-30-4 8-5 16-5 24-1ZM40 72h20L50 82 40 72Z"/>'
  ],
  raven: [
    '<path d="M15 55c20-28 44-39 74-32-15 5-26 13-33 25l32 6-36 9-18 25-2-23-17-10Z"/>',
    '<path d="M57 35c6-6 15-9 27-9-10 5-16 10-19 16l-8-7Z"/>',
    '<circle cx="61" cy="40" r="3"/>'
  ],
  reaper: [
    '<path d="M50 10c-18 3-31 18-31 39 0 17 9 31 22 36v-9h-8V62h7l-7-8 8-10 9 8 9-8 8 10-7 8h7v14h-8v9c13-5 22-19 22-36 0-21-13-36-31-39Zm-9 50c-5 0-9-3-9-8 8-3 14-1 18 5-2 2-5 3-9 3Zm18 0c-4 0-7-1-9-3 4-6 10-8 18-5 0 5-4 8-9 8Z"/>',
    '<path d="M72 15c12 10 18 24 18 42 0 12-4 23-11 32 2-12 3-23 1-33-2-18-9-31-8-41Z"/>'
  ],
  scorpion: [
    '<path d="M37 36h26l10 18-10 18H37L27 54l10-18Zm8 12v12h10V48H45Z"/>',
    '<path d="M28 43 12 33l7-8 15 13-6 5Zm44 0 16-10-7-8-15 13 6 5ZM28 65 12 77l7 8 15-15-6-5Zm44 0 16 12-7 8-15-15 6-5ZM50 36c0-14 8-24 22-27l7 12-12-2c-6 4-8 10-8 17h-9Z"/>',
    '<path d="M78 9 94 20 82 31l-5-10 1-12Z"/>'
  ],
  skull: [
    '<path d="M50 10c22 0 37 15 37 36 0 15-7 26-20 31v13H33V77C20 72 13 61 13 46c0-21 15-36 37-36ZM34 53c8 0 13-5 13-13-12-3-22 1-25 9 2 3 6 4 12 4Zm32 0c6 0 10-1 12-4-3-8-13-12-25-9 0 8 5 13 13 13ZM44 70h12l-6-13-6 13Zm-1 9v9h5v-9h-5Zm9 0v9h5v-9h-5Z"/>'
  ],
  snake: [
    '<path d="M54 12c20 0 34 15 34 33 0 16-11 29-28 29H35c-7 0-12 3-12 8 0 4 4 7 11 7h28v-9H35c-15 0-25-7-25-18 0-12 10-20 25-20h25c7 0 12-4 12-10 0-7-6-12-16-12H35v12L12 22 35 8v12h19Z"/>',
    '<circle cx="61" cy="32" r="4"/>'
  ],
  spider: [
    '<circle cx="50" cy="34" r="12"/>',
    '<ellipse cx="50" cy="59" rx="18" ry="22"/>',
    '<path d="M33 42 12 30l4-8 23 15-6 5Zm34 0 21-12-4-8-23 15 6 5ZM30 55 8 54v-9l24 3-2 7Zm40 0 22-1v-9l-24 3 2 7ZM32 68 14 82l6 7 19-17-7-4Zm36 0 18 14-6 7-19-17 7-4ZM40 28 29 11l8-4 9 18-6 3Zm20 0L71 11l-8-4-9 18 6 3Z"/>'
  ],
  vulture: [
    '<path d="M11 31c25-12 47-10 69 5l10-8-4 22-23 4 9-9c-14-6-27-8-39-4l16 13-7 35-10-31-21-27Z"/>',
    '<path d="M58 28c8-10 19-13 32-9-11 3-18 8-21 15l-11-6Z"/>',
    '<circle cx="65" cy="35" r="3"/>'
  ],
  wolf: [
    '<path d="M16 14 36 28l14-15 14 15 20-14-8 33-26 40-26-40-8-33Zm24 34-12-6 7 16 12 4-7-14Zm20 0-7 14 12-4 7-16-12 6ZM39 67l11 17 11-17H39Z"/>'
  ]
});

const renderAllianceIconSvg = (iconKey) => {
  const icon = getAllianceIconById(iconKey);
  const paths = ALLIANCE_INLINE_ICON_PATHS[icon.id] || ALLIANCE_INLINE_ICON_PATHS.reaper;
  return `
    <svg class="alliance-crest-svg alliance-crest-icon-inline" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false">
      ${paths.join("")}
    </svg>
  `;
};

const renderIconPicker = () => {
  const picker = qs("alliance-icon-picker");
  if (!picker) return;
  const selectedColor = getSelectedAllianceColor();
  const colorStyle = getAllianceColorStyle(selectedColor);
  picker.innerHTML = ALLIANCE_ICON_OPTIONS.map((option) => `
    <button
      type="button"
      class="alliance-icon-option ${option.id === selectedIconKey ? "is-selected" : ""}"
      data-alliance-icon-option="${escapeHtml(option.id)}"
      aria-pressed="${option.id === selectedIconKey ? "true" : "false"}"
      aria-label="${escapeHtml(option.label)}"
      title="${escapeHtml(option.label)}"
      style="${escapeHtml(colorStyle)}"
    >
      ${renderAllianceIconSvg(option.id)}
      <span>${escapeHtml(option.label)}</span>
    </button>
  `).join("");
};

const renderColorPicker = () => {
  const picker = qs("alliance-color-picker");
  const customInput = qs("alliance-create-color");
  if (!picker) return;
  const selectedColor = getSelectedAllianceColor();
  picker.innerHTML = ALLIANCE_COLOR_OPTIONS.map((option) => {
    const optionColor = normalizeAllianceColor(option.value);
    return `
      <button
        type="button"
        class="alliance-color-option ${optionColor === selectedColor ? "is-selected" : ""}"
        data-alliance-color-option="${escapeHtml(optionColor)}"
        aria-pressed="${optionColor === selectedColor ? "true" : "false"}"
        aria-label="${escapeHtml(option.label)}"
        title="${escapeHtml(option.label)}"
        style="${escapeHtml(getAllianceColorStyle(optionColor))}"
      >
        <span class="alliance-color-option__swatch" aria-hidden="true"></span>
        <span>${escapeHtml(option.label)}</span>
      </button>
    `;
  }).join("");
  if (customInput instanceof HTMLInputElement) {
    customInput.value = selectedColor;
  }
};

const syncAllianceColorSelection = (color) => {
  selectedAllianceColor = normalizeAllianceColor(color);
  renderColorPicker();
  renderIconPicker();
};

const renderAllianceIdentityMarkup = (alliance) => `
  <span class="alliance-badge-markup" style="${escapeHtml(getAllianceColorStyle(resolveAllianceEmblemColor(alliance)))}">
    <span class="alliance-badge-markup__icon">
      ${renderAllianceIconSvg(getAllianceIconOptionByTag(alliance?.tag).id)}
    </span>
    <span class="alliance-badge-markup__name">${escapeHtml(alliance?.name || "Aliance")}</span>
  </span>
`;

const renderPublicAllianceIconSvg = (icon) =>
  renderAllianceIconSvg(icon?.id || "reaper");

const renderPublicAllianceIdentityMarkup = (alliance) => {
  const icon = getAllianceIconOptionByTag(alliance?.tag);
  const colorStyle = getAllianceColorStyle(resolveAllianceEmblemColor(alliance));
  return `
      <span class="alliance-public-emblem" style="${escapeHtml(colorStyle)}">
      <span class="alliance-public-emblem__icon">
        ${renderPublicAllianceIconSvg(icon)}
      </span>
      <span class="alliance-public-emblem__body">
        <strong title="${escapeHtml(alliance?.name || "Aliance")}">${escapeHtml(alliance?.name || "Aliance")}</strong>
        <small>${escapeHtml(icon.label || icon.tag || "Znak")}</small>
      </span>
    </span>
  `;
};

const getPublicAllianceById = (allianceId) =>
  (latestAllianceBoard?.publicAlliances || []).find((alliance) =>
    String(alliance?.allianceId || "") === String(allianceId || "")
  ) || null;

const renderPublicAllianceChatPreview = (alliance) => {
  const messages = (alliance?.chatMessages || []).slice(-3);
  if (!messages.length) return "";
  return `
    <div class="alliance-public-chat-preview" aria-label="Chat aliance ${escapeHtml(alliance?.name || "Aliance")}">
      <div class="alliance-public-preview__head">
        <strong>Chat aliance</strong>
        <span>${escapeHtml(alliance?.name || "Aliance")}</span>
      </div>
      <div class="alliance-public-preview__feed">
        ${messages.map((message) => {
          const sentAt = formatChatTimestamp(message.createdAt || message.sentAt || message.timestamp);
          return `
            <div class="alliance-chat__item server-chat-panel__message alliance-chat__item--own">
              <strong class="server-chat-panel__author">${escapeHtml(message.authorName || "Ty")}</strong>
              <time class="server-chat-panel__timestamp" datetime="${escapeHtml(sentAt.iso)}">${escapeHtml(sentAt.label)}</time>
              <span class="server-chat-panel__text">${escapeHtml(message.body || "")}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
};

const renderPublicAllianceInvitePreview = (alliance) => {
  const invites = (alliance?.receivedInvites || []).slice(-2);
  if (!invites.length) return "";
  return `
    <div class="alliance-public-invite-preview" aria-label="Doručené pozvánky hráče ${escapeHtml(alliance?.ownerName || "Leader")}">
      <div class="alliance-public-preview__head">
        <strong>Příchozí pozvánky hráče ${escapeHtml(alliance?.ownerName || "Leader")}</strong>
        <span>${escapeHtml(invites.length)}</span>
      </div>
      ${invites.map((invite) => `
        <div class="alliance-public-invite-preview__item">
          <span>${escapeHtml(invite.fromAllianceName || invite.allianceName || "Aliance")}</span>
          <small>Posláno ${escapeHtml(formatRelativeTime(invite.createdAt))}</small>
        </div>
      `).join("")}
    </div>
  `;
};

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

const renderReadyBlock = (activeAlliance, { management = false, hideLabel = false, hideTimer = false } = {}) => {
  const ready = getReadyCopy(activeAlliance?.readyReasonCode);
  const canConfirm = Boolean(activeAlliance?.canConfirmReady);
  const readyHint = canConfirm ? "Do konce běžící časomíry zvol Zůstávám nebo Končím." : ready.hint;
  return `
    <div class="alliance-ready-card" data-tone="${escapeHtml(ready.tone)}" title="${escapeHtml(activeAlliance?.readyReasonCode || "active")}">
      <div class="alliance-ready-card__copy">
        ${hideLabel ? "" : `<strong>${escapeHtml(ready.label)}</strong>`}
        ${readyHint ? `<small>${escapeHtml(readyHint)}</small>` : ""}
        ${hideTimer ? "" : `<span class="alliance-ready-card__timer">Zbývá ${renderReadyCountdown(activeAlliance, "alliance-ready-countdown alliance-ready-countdown--inline")}</span>`}
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
  const hasInfluence = hasRequiredInfluenceForAllianceCreate();
  const canCreate = board?.canCreateAlliance === true && hasInfluence;
  const disabledReason = canCreate
    ? ""
    : getCreateDisabledReason(hasInfluence ? board?.createDisabledReason : "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE");
  const maxMembers = Number(board?.maxAllianceSize || MAX_ALLIANCE_SIZE_FALLBACK);
  return `
    <section class="alliance-create-card">
      <div class="alliance-section__head">
        <div>
          <strong>Vytvoř vlastní crew</strong>
        </div>
      </div>
      <p class="alliance-create-card__copy">Zadej název, vyber znak i barvu a založ malou crew. Max ${escapeHtml(maxMembers)} hráči.</p>
      <p class="alliance-create-card__copy alliance-create-card__copy--requirement">Vytvořit alianci půjde až pokud má hráč ${ALLIANCE_CREATE_REQUIRED_INFLUENCE} vliv.</p>
      ${disabledReason ? `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(disabledReason)}</div>` : ""}
      <button class="btn btn--primary alliance-create-card__cta" id="alliance-create-toggle-btn" ${canCreate ? "" : "disabled"}>Vytvořit alianci</button>
    </section>
  `;
};

const renderAllianceLockedTabPanel = (title, text) => `
  <section class="alliance-section">
    <div class="alliance-empty-state alliance-empty-state--compact">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  </section>
`;

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
          <div class="alliance-overview-card__headline">
            ${renderAllianceIdentityMarkup(activeAlliance)}
          </div>
          <div class="alliance-overview-card__meta">
            <span class="alliance-overview-card__count">${Number(activeAlliance.memberCount || members.length || 0)}/${maxMembers} členů</span>
            <span class="alliance-state-pill alliance-state-pill--ready" data-tone="${escapeHtml(ready.tone)}">
              ${escapeHtml(ready.label)}
              ${renderReadyCountdown(activeAlliance)}
            </span>
          </div>
        </div>
        ${renderReadyBlock(activeAlliance, { hideTimer: true })}
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

const renderInvitePlayerPanel = (activeAlliance) => {
  if (!activeAlliance) return "";
  const inviteTargets = getInviteTargetsForSelect(activeAlliance);
  const freeSlots = Math.max(0, getAllianceMaxMembers(activeAlliance) - Number(activeAlliance.memberCount || 0));
  const canInviteFromManagement = Boolean(activeAlliance.canInvite || activeAlliance.isDevOnlyDemo);
  const inviteDisabledReason = canInviteFromManagement ? "" : getInviteDisabledReason(activeAlliance, inviteTargets);
  return `
    <section class="alliance-section">
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
  `;
};

const renderSentInvitesPanel = (activeAlliance) => {
  if (!activeAlliance || !isAllianceManager(activeAlliance)) return "";
  const pendingInvites = activeAlliance.pendingInvites || [];
  return `
    <section class="alliance-section">
      <div class="alliance-section__head">
        <div>
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

const renderInvitesPanel = (board) => {
  const activeAlliance = board?.activeAlliance || null;
  const canConfirmIncomingInvites = isAllianceManager(activeAlliance);
  const adminOnlyTitle = "Příchozí pozvánku může potvrdit pouze admin aliance.";
  return `
    ${renderInvitePlayerPanel(activeAlliance)}
    <section class="alliance-section">
      <div class="alliance-section__head">
        <div>
          <strong>Příchozí pozvánky</strong>
        </div>
      </div>
      ${canConfirmIncomingInvites ? "" : `<div class="alliance-inline-note" data-tone="warning">${escapeHtml(adminOnlyTitle)}</div>`}
      <div class="alliance-list">
        ${board?.incomingInvites?.length ? board.incomingInvites.map((invite) => `
          <article class="alliance-invite-card alliance-invite-card--incoming">
            <div class="alliance-invite-card__main">
              <strong>${escapeHtml(invite.allianceName)}</strong>
              <span>Od ${escapeHtml(invite.invitedByName)} · ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
            </div>
            <div class="alliance-request-item__actions alliance-invite-card__actions">
              <button class="btn btn--primary" data-alliance-invite-accept="${escapeHtml(invite.inviteId)}" ${canConfirmIncomingInvites ? "" : "disabled"} title="${escapeHtml(canConfirmIncomingInvites ? "Přijmout pozvánku" : adminOnlyTitle)}">Přijmout</button>
              <button class="btn btn--ghost" data-alliance-invite-reject="${escapeHtml(invite.inviteId)}" ${canConfirmIncomingInvites ? "" : "disabled"} title="${escapeHtml(canConfirmIncomingInvites ? "Odmítnout pozvánku" : adminOnlyTitle)}">Odmítnout</button>
            </div>
          </article>
        `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné pozvánky. Až tě někdo pozve, uvidíš to tady.</div>`}
      </div>
    </section>
    ${renderSentInvitesPanel(activeAlliance)}
  `;
};

const renderPublicAlliancesPanel = (board) => {
  return `
    <section class="alliance-section">
      <div class="alliance-section__head">
        <div>
          <strong>Aliance</strong>
        </div>
      </div>
      <div class="alliance-public-list">
        ${board?.publicAlliances?.length ? board.publicAlliances.map((alliance) => `
          <article class="alliance-public-row">
            <div class="alliance-public-row__identity">${renderPublicAllianceIdentityMarkup(alliance)}</div>
            <div class="alliance-public-row__meta">
              <span>${Number(alliance.memberCount || 0)}/${Number(alliance.maxMembers || 0)} členů</span>
              <span>Leader ${escapeHtml(alliance.ownerName)}</span>
            </div>
            <div class="alliance-public-row__actions">
              <button class="btn btn--ghost" data-alliance-public-message="${escapeHtml(alliance.allianceId)}" data-alliance-public-name="${escapeHtml(alliance.name)}">
                Poslat zprávu
              </button>
              <button class="btn btn--primary" data-alliance-public-invite="${escapeHtml(alliance.allianceId)}" data-alliance-public-name="${escapeHtml(alliance.name)}" title="Poslat pozvánku">
                Poslat pozvánku
              </button>
            </div>
            ${renderPublicAllianceChatPreview(alliance)}
            ${renderPublicAllianceInvitePreview(alliance)}
          </article>
        `).join("") : `<div class="alliance-empty-state alliance-empty-state--compact">Žádné aliance. Založ crew nebo počkej na pozvánku.</div>`}
      </div>
    </section>
  `;
};

const renderAllianceLauncher = (activeAlliance) => {
  const button = qs("alliance-btn");
  if (!button) return;
  if (!activeAlliance) {
    button.innerHTML = `
      <span class="alliance-launcher__body alliance-launcher__body--empty">
        <span class="alliance-launcher__eyebrow">Aliance</span>
      </span>
    `;
    return;
  }
  const iconKey = activeAlliance ? getAllianceIconOptionByTag(activeAlliance.tag).id : "reaper";
  const colorStyle = getAllianceColorStyle(activeAlliance ? resolveAllianceEmblemColor(activeAlliance) : DEFAULT_ALLIANCE_EMBLEM_COLOR);
  button.innerHTML = `
    <span class="alliance-launcher__crest" aria-hidden="true" style="${escapeHtml(colorStyle)}">
      ${renderAllianceIconSvg(iconKey)}
    </span>
    <span class="alliance-launcher__body">
      <span class="alliance-launcher__eyebrow">Aliance</span>
      <strong class="alliance-launcher__name" title="${escapeHtml(activeAlliance.name)}">${escapeHtml(activeAlliance.name)}</strong>
    </span>
  `;
};

const renderManagementPanel = (activeAlliance) => {
  const kickVotePanel = renderKickVotePanel(activeAlliance);
  const exitCopy = getAllianceExitCopy(activeAlliance);
  const successorCandidates = getAllianceSuccessorCandidates(activeAlliance);
  const exitNote = isAllianceLeader(activeAlliance) && successorCandidates.length
    ? "Můžeš předat vedení nástupci a odejít, nebo alianci rozpustit pro všechny členy."
    : exitCopy.text;

  return `
    <section class="alliance-management-panel">
      ${renderKickVoteAvailabilityNote(activeAlliance)}
      ${kickVotePanel}
      <section class="alliance-card alliance-card--danger-zone">
        <div class="alliance-section__head">
          <div>
            <strong>${escapeHtml(exitCopy.actionLabel)}</strong>
          </div>
        </div>
        <div class="alliance-exit-row">
          <div class="alliance-inline-note" data-tone="warning">${escapeHtml(exitNote)}</div>
          <div class="alliance-exit-row__actions">
            ${isAllianceLeader(activeAlliance) && successorCandidates.length ? `
              <button class="btn btn--ghost" type="button" data-alliance-leave-open data-alliance-exit-mode="transfer">Předat a odejít</button>
            ` : ""}
            <button class="btn btn--danger" type="button" data-alliance-leave-open data-alliance-exit-mode="${isAllianceLeader(activeAlliance) ? "disband" : "leave"}">${escapeHtml(isAllianceLeader(activeAlliance) ? "Rozpustit alianci" : exitCopy.actionLabel)}</button>
          </div>
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
  createEntry?.classList.add("hidden");

  if (createEntry) {
    createEntry.innerHTML = "";
  }

  if (activePanel) {
    if (selectedAllianceTab === "members") selectedAllianceTab = "overview";
    allianceModal?.setAttribute("data-alliance-tab", activeAlliance ? selectedAllianceTab : "empty");
    const panels = activeAlliance ? {
      overview: renderOverviewPanel(activeAlliance),
      chat: renderChatPanel(activeAlliance),
      management: renderManagementPanel(activeAlliance),
      invites: renderInvitesPanel(board),
      alliances: renderPublicAlliancesPanel(board)
    } : {
      overview: renderCreateAllianceCard(board),
      chat: renderAllianceLockedTabPanel("Chat není dostupný", "Alianční chat se otevře po založení nebo vstupu do aliance."),
      management: renderAllianceLockedTabPanel("Správa není dostupná", "Správa se otevře po založení vlastní aliance."),
      invites: renderInvitesPanel(board),
      alliances: renderPublicAlliancesPanel(board)
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

  if (invitesPanel) {
    invitesPanel.innerHTML = "";
    invitesPanel.hidden = true;
  }

  if (listPanel) {
    listPanel.innerHTML = "";
    listPanel.hidden = true;
  }

  updateAllianceReadyCountdowns();
  renderChat(activeAlliance?.chatMessages || [], activeAlliance);
};

const rerenderAll = () => {
  refreshDevOnlyCreateEligibility();
  renderAllianceState();
  renderGlobalServerChat();
  syncCreateModalState();
};

const openAllianceModal = () => {
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const openAllianceManagementTab = () => {
  selectedAllianceTab = "management";
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const closeAllAllianceModals = () => {
  ALLIANCE_MODAL_IDS.forEach((id) =>
    setModalVisible(qs(id), false)
  );
  lastAllianceMemberAvatarTrigger = null;
  pendingKickVoteTarget = null;
  pendingPublicAllianceAction = null;
};

const resetCreateForm = () => {
  if (qs("alliance-create-name")) qs("alliance-create-name").value = "";
  selectedIconKey = "reaper";
  selectedAllianceColor = DEFAULT_ALLIANCE_EMBLEM_COLOR;
  renderIconPicker();
  renderColorPicker();
};

const syncCreateModalState = () => {
  refreshDevOnlyCreateEligibility();
  const hasInfluence = hasRequiredInfluenceForAllianceCreate();
  const canCreate = latestAllianceBoard?.canCreateAlliance === true && hasInfluence;
  const name = String(qs("alliance-create-name")?.value || "").trim();
  const nameReason = name && name.length > MAX_ALLIANCE_NAME_LENGTH ? getCreateNameValidationMessage(name) : "";
  const reason = canCreate
    ? nameReason
    : getCreateDisabledReason(hasInfluence ? latestAllianceBoard?.createDisabledReason : "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE");
  const button = qs("alliance-create-btn");
  const reasonEl = qs("alliance-create-disabled-reason");
  const input = qs("alliance-create-name");
  if (input instanceof HTMLInputElement) {
    input.maxLength = MAX_ALLIANCE_NAME_LENGTH;
  }
  if (button) {
    button.disabled = !canCreate || Boolean(nameReason);
    button.title = reason || "Vytvořit alianci";
    button.textContent = "Vytvořit";
    button.setAttribute("aria-label", "Vytvořit alianci");
  }
  if (reasonEl) {
    reasonEl.textContent = reason;
    reasonEl.classList.toggle("hidden", !reason);
  }
};

const openCreateModal = () => {
  renderIconPicker();
  renderColorPicker();
  syncCreateModalState();
  setModalVisible(qs("alliance-create-modal"), true);
};

const refreshCreateUiFromInfluence = () => {
  if (refreshDevOnlyCreateEligibility()) {
    renderAllianceState();
  }
  syncCreateModalState();
};

const bindAllianceCreateInfluenceWatcher = () => {
  if (allianceCreateInfluenceObserver || typeof MutationObserver !== "function") {
    return;
  }
  const influenceElement = document.querySelector("[data-topbar-influence]");
  if (!influenceElement) {
    return;
  }
  allianceCreateInfluenceObserver = new MutationObserver(refreshCreateUiFromInfluence);
  allianceCreateInfluenceObserver.observe(influenceElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
};

const openAllianceExitModal = (requestedMode = "") => {
  const activeAlliance = latestAllianceBoard?.activeAlliance;
  if (!activeAlliance) return;
  pendingAllianceExitMode = resolveAllianceExitMode(activeAlliance, requestedMode);
  const copy = getAllianceExitCopy(activeAlliance, pendingAllianceExitMode);
  const title = qs("alliance-leave-modal-title");
  const text = qs("alliance-leave-modal-text");
  const confirm = qs("alliance-leave-confirm-btn");
  const successorField = qs("alliance-leave-successor-field");
  const successorSelect = qs("alliance-leave-successor-select");
  if (title) title.textContent = copy.title;
  if (text) text.textContent = copy.text;
  if (confirm) confirm.textContent = copy.confirmLabel;
  if (successorField) successorField.classList.toggle("hidden", pendingAllianceExitMode !== "transfer");
  if (successorSelect instanceof HTMLSelectElement) {
    const candidates = getAllianceSuccessorCandidates(activeAlliance);
    successorSelect.innerHTML = candidates.map((member) => `
      <option value="${escapeHtml(member.playerId)}">${escapeHtml(member.name || member.playerId)}</option>
    `).join("");
    successorSelect.disabled = pendingAllianceExitMode !== "transfer";
  }
  setModalVisible(qs("alliance-leave-modal"), true);
};

const closeReadyConfirmModal = () => {
  setModalVisible(qs("alliance-ready-confirm-modal"), false);
};

const openReadyConfirmModal = () => {
  if (!latestAllianceBoard?.activeAlliance) return;
  setModalVisible(qs("alliance-ready-confirm-modal"), true);
};

const closePublicAllianceActionModal = () => {
  pendingPublicAllianceAction = null;
  setModalVisible(qs("alliance-public-action-modal"), false);
};

const openPublicAllianceActionModal = (type, allianceId) => {
  const publicAlliance = getPublicAllianceById(allianceId);
  if (!publicAlliance) {
    notify("Tahle veřejná aliance už není dostupná.");
    return;
  }

  pendingPublicAllianceAction = { type, allianceId: publicAlliance.allianceId };
  const isMessage = type === "message";
  const activeAlliance = latestAllianceBoard?.activeAlliance;
  const modal = qs("alliance-public-action-modal");
  const title = qs("alliance-public-action-modal-title");
  const target = qs("alliance-public-action-modal-target");
  const text = qs("alliance-public-action-modal-text");
  const field = qs("alliance-public-action-message-field");
  const input = qs("alliance-public-action-message-input");
  const submit = qs("alliance-public-action-submit-btn");

  if (title) title.textContent = isMessage ? "Poslat zprávu alianci?" : "Poslat pozvánku?";
  if (target) {
    target.textContent = `${publicAlliance.name || "Aliance"} · Leader ${publicAlliance.ownerName || "neznámý"}`;
  }
  if (text) {
    text.textContent = isMessage
      ? `Zpráva se zobrazí v chatovacím okně aliance ${publicAlliance.name || "Aliance"}.`
      : `Pozvánka z aliance ${activeAlliance?.name || "tvoje aliance"} se doručí do příchozích pozvánek hráče ${publicAlliance.ownerName || "leader"}.`;
  }
  if (field) field.hidden = !isMessage;
  if (input instanceof HTMLTextAreaElement) {
    input.value = isMessage ? `Zdravíme ${publicAlliance.name || "alianci"}, pojďme probrat spolupráci.` : "";
  }
  if (submit) submit.textContent = isMessage ? "Odeslat zprávu" : "Poslat pozvánku";

  setModalVisible(modal, true);
  if (isMessage && input instanceof HTMLTextAreaElement) {
    input.focus({ preventScroll: true });
    input.select();
  } else {
    submit?.focus({ preventScroll: true });
  }
};

const submitPublicAllianceAction = async () => {
  if (!pendingPublicAllianceAction) return;
  const publicAlliance = getPublicAllianceById(pendingPublicAllianceAction.allianceId);
  if (!publicAlliance) {
    notify("Tahle veřejná aliance už není dostupná.");
    closePublicAllianceActionModal();
    return;
  }

  if (pendingPublicAllianceAction.type === "message") {
    const input = qs("alliance-public-action-message-input");
    const body = String(input?.value || "").trim();
    if (!body) {
      notify("Napiš zprávu pro alianci.");
      return;
    }
    if (!String(publicAlliance.allianceId || "").startsWith("dev-demo-")) {
      const ok = await runAllianceCommand("send-public-alliance-message", {
        allianceId: publicAlliance.allianceId,
        body
      }, `Zpráva je v chatu aliance ${publicAlliance.name}.`);
      if (ok) closePublicAllianceActionModal();
      return;
    }
    publicAlliance.chatMessages = [
      ...(publicAlliance.chatMessages || []),
      {
        messageId: `dev-public-alliance-message:${publicAlliance.allianceId}:${Date.now()}`,
        allianceId: publicAlliance.allianceId,
        authorPlayerId: latestAllianceBoard?.currentPlayerId || "dev-player",
        authorName: "Ty",
        body,
        createdAt: new Date().toISOString(),
        devOnlyPreview: true
      }
    ].slice(-20);
    closePublicAllianceActionModal();
    renderAllianceState();
    notify(`Zpráva je v chatu aliance ${publicAlliance.name}.`);
    return;
  }

  if (!String(publicAlliance.allianceId || "").startsWith("dev-demo-")) {
    const ok = await runAllianceCommand("send-public-alliance-invite", {
      allianceId: publicAlliance.allianceId
    }, `Pozvánka byla doručena hráči ${publicAlliance.ownerName}.`);
    if (ok) closePublicAllianceActionModal();
    return;
  }

  const createdAt = new Date().toISOString();
  const inviteId = `dev-public-alliance-invite:${publicAlliance.allianceId}:${Date.now()}`;
  const activeAlliance = latestAllianceBoard?.activeAlliance || null;
  const senderName = activeAlliance?.name || "Ty";
  publicAlliance.receivedInvites = [
    {
      inviteId,
      fromAllianceId: activeAlliance?.allianceId || null,
      fromAllianceName: senderName,
      allianceName: senderName,
      invitedByName: senderName,
      targetPlayerId: publicAlliance.ownerPlayerId,
      targetPlayerName: publicAlliance.ownerName,
      createdAt,
      devOnlyPreview: true
    },
    ...(publicAlliance.receivedInvites || [])
  ].slice(0, 4);
  if (activeAlliance) {
    activeAlliance.pendingInvites = [
      {
        inviteId,
        targetPlayerId: publicAlliance.ownerPlayerId,
        targetName: publicAlliance.ownerName,
        targetAllianceId: publicAlliance.allianceId,
        targetAllianceName: publicAlliance.name,
        createdAt,
        devOnlyPreview: true
      },
      ...(activeAlliance.pendingInvites || [])
    ].slice(0, 8);
  }

  closePublicAllianceActionModal();
  renderAllianceState();
  notify(`Pozvánka byla doručena hráči ${publicAlliance.ownerName}.`);
};

const applyDevOnlyReadyReset = (activeAlliance) => {
  if (!activeAlliance?.isDevOnlyDemo) return;
  const nextDueAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  activeAlliance.readyDueAt = nextDueAt;
  activeAlliance.nextReadyDueAt = nextDueAt;
  activeAlliance.readyReasonCode = "active";
  activeAlliance.members = (activeAlliance.members || []).map((member) => ({
    ...member,
    readyDueAt: member.playerId === latestAllianceBoard?.currentPlayerId ? nextDueAt : member.readyDueAt,
    graceEndsAt: member.playerId === latestAllianceBoard?.currentPlayerId ? nextDueAt : member.graceEndsAt,
    status: member.playerId === latestAllianceBoard?.currentPlayerId ? "active" : member.status
  }));
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
  const title = qs("alliance-kick-confirm-modal")?.querySelector?.(".modal__header h3");
  const text = qs("alliance-kick-confirm-text");
  const submit = qs("alliance-kick-confirm-submit-btn");
  if (title) title.textContent = "Hlasovat pro vyloučení?";
  if (text) {
    text.textContent = `Chceš opravdu hlasovat pro vyloučení hráče ${pendingKickVoteTarget.playerName}?`;
  }
  if (submit) submit.textContent = "Ano";
  setModalVisible(qs("alliance-kick-confirm-modal"), true);
};

const closeKickConfirmModal = () => {
  pendingKickVoteTarget = null;
  setModalVisible(qs("alliance-kick-confirm-modal"), false);
};

const createAllianceMapBadge = (alliance) => {
  if (!alliance) return null;
  const icon = getAllianceIconOptionByTag(alliance.tag);
  return {
    allianceId: alliance.allianceId,
    name: alliance.name,
    iconKey: icon.id,
    symbol: icon.symbol,
    tag: alliance.tag || icon.tag,
    asset: icon.asset,
    color: resolveAllianceEmblemColor(alliance)
  };
};

const getOwnerIdCandidates = (ownerId) => {
  const raw = String(ownerId ?? "").trim();
  if (!raw) return [];
  const candidates = new Set([raw]);
  if (/^\d+$/u.test(raw)) {
    candidates.add(`player:${raw}`);
  }
  if (raw.startsWith("player:")) {
    candidates.add(raw.slice("player:".length));
  }
  return Array.from(candidates);
};

const isCurrentMapOwner = (ownerId) => {
  const currentPlayerId = String(latestAllianceBoard?.currentPlayerId || "").trim();
  if (!currentPlayerId) return false;
  return getOwnerIdCandidates(ownerId).some((candidate) =>
    candidate === currentPlayerId
    || `player:${candidate}` === currentPlayerId
    || (candidate === "1" && currentPlayerId === "dev-player")
  );
};

const getAllianceMapBadgeForOwner = (ownerId) => {
  const activeAlliance = latestAllianceBoard?.activeAlliance || null;
  if (activeAlliance && isCurrentMapOwner(ownerId)) {
    return createAllianceMapBadge(activeAlliance);
  }
  const badgesByPlayerId = latestAllianceBoard?.allianceBadgesByPlayerId || {};
  for (const candidate of getOwnerIdCandidates(ownerId)) {
    const badge = badgesByPlayerId[candidate] || badgesByPlayerId[`player:${candidate}`];
    if (badge) {
      return createAllianceMapBadge({
        allianceId: badge.allianceId,
        name: badge.name,
        tag: badge.tag,
        emblemColor: badge.emblemColor
      });
    }
  }
  return null;
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
  qs("alliance-ready-confirm-modal-backdrop")?.addEventListener("click", closeReadyConfirmModal);
  qs("alliance-ready-confirm-modal-close")?.addEventListener("click", closeReadyConfirmModal);
  qs("alliance-ready-confirm-cancel-btn")?.addEventListener("click", closeReadyConfirmModal);
  qs("alliance-public-action-modal-backdrop")?.addEventListener("click", closePublicAllianceActionModal);
  qs("alliance-public-action-modal-close")?.addEventListener("click", closePublicAllianceActionModal);
  qs("alliance-public-action-cancel-btn")?.addEventListener("click", closePublicAllianceActionModal);
  qs("alliance-public-action-submit-btn")?.addEventListener("click", submitPublicAllianceAction);
  qs("alliance-ready-confirm-submit-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (!activeAlliance) return;
    if (activeAlliance.isDevOnlyDemo) {
      applyDevOnlyReadyReset(activeAlliance);
      closeReadyConfirmModal();
      renderAllianceState();
      notify("Časomíra byla nastavena znovu na 8 hodin.");
      return;
    }
    const ok = await runAllianceCommand("confirm-alliance-ready", { allianceId: activeAlliance.allianceId }, "Aktivita aliance byla potvrzena.");
    if (ok) closeReadyConfirmModal();
  });
  qs("alliance-kick-confirm-modal-backdrop")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-modal-close")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-kick-confirm-cancel-btn")?.addEventListener("click", closeKickConfirmModal);
  qs("alliance-member-lightbox-backdrop")?.addEventListener("click", closeAllianceMemberLightbox);
  qs("alliance-member-lightbox-close")?.addEventListener("click", closeAllianceMemberLightbox);
  qs("alliance-kick-confirm-submit-btn")?.addEventListener("click", async () => {
    if (!pendingKickVoteTarget) return;
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (activeAlliance?.isDevOnlyDemo) {
      const currentPlayerId = latestAllianceBoard?.currentPlayerId || "dev-player";
      const eligibleVoterIds = (activeAlliance.members || [])
        .map((member) => member.playerId)
        .filter((playerId) => playerId && playerId !== pendingKickVoteTarget.playerId);
      activeAlliance.activeVote = {
        id: `dev-demo-kick-vote:${pendingKickVoteTarget.playerId}`,
        targetPlayerId: pendingKickVoteTarget.playerId,
        status: "pending",
        votes: { [currentPlayerId]: "yes" },
        eligibleVoterIds,
        requiredYesVotes: Math.max(1, Math.ceil(eligibleVoterIds.length / 2)),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      activeAlliance.members = (activeAlliance.members || []).map((member) =>
        member.playerId === pendingKickVoteTarget.playerId
          ? { ...member, canStartKickVote: false, status: "vote_pending" }
          : member
      );
      notify(`Hlas pro vyloučení hráče ${pendingKickVoteTarget.playerName} byl započítán.`);
      closeKickConfirmModal();
      renderAllianceState();
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
  qs("alliance-create-color")?.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) {
      syncAllianceColorSelection(event.target.value);
    }
  });

  qs("alliance-create-btn")?.addEventListener("click", async () => {
    const name = String(qs("alliance-create-name")?.value || "").trim();
    const tag = getSelectedIconOption().tag;
    const emblemColor = getSelectedAllianceColor();
    if (!hasRequiredInfluenceForAllianceCreate()) {
      notify(getCreateDisabledReason("ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE"));
      syncCreateModalState();
      return;
    }
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
    const ok = await runAllianceCommand("create-alliance", { name, tag, emblemColor }, `Aliance ${name} byla založena.`);
    if (ok) {
      rememberAllianceColor({ name, tag }, emblemColor);
      setModalVisible(qs("alliance-create-modal"), false);
      resetCreateForm();
    }
  });

  qs("alliance-leave-confirm-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (!activeAlliance) return;
    const mode = resolveAllianceExitMode(activeAlliance, pendingAllianceExitMode);
    const copy = getAllianceExitCopy(activeAlliance, mode);
    let type = "leave-alliance";
    const payload = { allianceId: activeAlliance.allianceId };
    if (isAllianceLeader(activeAlliance) && mode === "disband") {
      type = "disband-alliance";
    } else if (isAllianceLeader(activeAlliance) && mode === "transfer") {
      const successorPlayerId = String(qs("alliance-leave-successor-select")?.value || "").trim();
      if (!successorPlayerId) {
        notify("Vyber hráče, kterému předáš vedení.");
        return;
      }
      payload.chosenSuccessorPlayerId = successorPlayerId;
    }
    const ok = await runAllianceCommand(type, payload, copy.successMessage);
    if (ok) setModalVisible(qs("alliance-leave-modal"), false);
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest(
      "[data-alliance-member-avatar-open], [data-alliance-tab], [data-alliance-modal-close], [data-alliance-leave-open], [data-alliance-management-open], [data-alliance-icon-option], [data-alliance-color-option], [data-alliance-join], [data-alliance-public-message], [data-alliance-public-invite], [data-alliance-invite-accept], [data-alliance-invite-reject], #alliance-create-toggle-btn, #alliance-ready-btn, #alliance-management-ready-btn, #alliance-management-open-btn, #alliance-management-invite-btn, [data-alliance-chat-send], [data-alliance-kick-start], [data-alliance-kick-vote]"
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
      openAllianceExitModal(target.getAttribute("data-alliance-exit-mode") || "");
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
    if (target.hasAttribute("data-alliance-color-option")) {
      syncAllianceColorSelection(target.getAttribute("data-alliance-color-option") || DEFAULT_ALLIANCE_EMBLEM_COLOR);
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
      const inviteTargets = getInviteTargetsForSelect(activeAlliance);
      const targetPlayer = inviteTargets.find((target) => target.playerId === targetPlayerId);
      if (activeAlliance.isDevOnlyDemo || targetPlayer?.devOnlyPreview) {
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
        if (!latestAllianceBoard.eligibleInviteTargets?.length) {
          latestAllianceBoard.eligibleInviteTargets = inviteTargets;
        }
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
        openReadyConfirmModal();
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
    if (target.hasAttribute("data-alliance-public-message")) {
      openPublicAllianceActionModal("message", target.getAttribute("data-alliance-public-message"));
      return;
    }
    if (target.hasAttribute("data-alliance-public-invite")) {
      openPublicAllianceActionModal("invite", target.getAttribute("data-alliance-public-invite"));
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
    window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  });
  document.addEventListener("empire:onboarding-alliance-reset", (event) => {
    latestAllianceBoard = createDevOnlyAllianceBoard(event?.detail?.allianceBoard || {
      activeAlliance: null,
      disableDevOnlyActiveAlliance: true
    });
    rerenderAll();
    window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  });
  document.addEventListener("empire:gang-state-changed", () => {
    if (refreshDevOnlyCreateEligibility()) {
      renderAllianceState();
    }
    syncCreateModalState();
  });

  window.empireStreetsAllianceState = {
    getActiveAlliance: () => latestAllianceBoard?.activeAlliance || null,
    getMapBadge: () => createAllianceMapBadge(latestAllianceBoard?.activeAlliance || null),
    getMapBadgeForOwner: (ownerId) => getAllianceMapBadgeForOwner(ownerId),
    getMapBadgesByOwner: () => latestAllianceBoard?.allianceBadgesByPlayerId || {}
  };

  renderGlobalServerChat();
  renderIconPicker();
  renderColorPicker();
  bindAllianceCreateInfluenceWatcher();
  syncCreateModalState();
  latestAllianceBoard = createDevOnlyAllianceBoard(latestAllianceBoard);
  rerenderAll();
  ensureAllianceCountdownTimer();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindAllianceRuntime, { once: true });
} else {
  bindAllianceRuntime();
}
