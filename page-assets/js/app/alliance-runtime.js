import { getAuthoritySession } from "./model/authority-state.js";
import { STORAGE_KEYS } from "../config.js";
import { escapeUrlAttribute } from "./ui/htmlEscape.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const GANG_NAME_STORAGE_KEY = STORAGE_KEYS.guestGangName;
const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const LOCAL_GLOBAL_CHAT_KEY = "empire_local_global_chat_state";
const DEFAULT_ALLIANCE_ICON_KEY = "crown_skull";
const DEFAULT_ALLIANCE_DESCRIPTION = "Aliance která všechny zabije";
const ALLIANCE_MAX_MEMBERS = 4;
const ALLIANCE_READY_WINDOW_MS = 6 * 60 * 60 * 1000;
const LOCAL_ALLIANCE_REQUEST_PLAYER_ID = "guest-player";

const ALLIANCE_ICON_OPTIONS = Object.freeze([
  { key: "crown_skull", label: "Lebka s korunou", symbol: "☠" },
  { key: "crossed_knives", label: "Zkřížené nože", symbol: "⚔" },
  { key: "broken_shield", label: "Štít", symbol: "⛨" },
  { key: "snake_dagger", label: "Had kolem nože", symbol: "🐍" },
  { key: "eye_triangle", label: "Oko", symbol: "◉" },
  { key: "flame", label: "Plamen", symbol: "🔥" },
  { key: "spider", label: "Pavouk", symbol: "🕷" },
  { key: "lightning", label: "Blesk", symbol: "⚡" },
  { key: "wolf_head", label: "Vlčí hlava", symbol: "🐺" },
  { key: "broken_mask", label: "Maska", symbol: "🎭" }
]);

function qs(id) {
  return document.getElementById(id);
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, payload) {
  localStorage.setItem(key, JSON.stringify(payload));
}

function normalizeOwnerName(value) {
  return String(value || "").trim().toLowerCase();
}

function formatTime(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAllianceIconOption(iconKey) {
  const normalized = String(iconKey || "").trim() || DEFAULT_ALLIANCE_ICON_KEY;
  return ALLIANCE_ICON_OPTIONS.find((icon) => icon.key === normalized) || ALLIANCE_ICON_OPTIONS[0];
}

function getRegistration() {
  return getAuthoritySession().registration || null;
}

function getCurrentIdentity() {
  return String(getRegistration()?.identity || "Ty").trim() || "Ty";
}

function getCurrentFactionLabel() {
  const factionLabel = document.querySelector("[data-gang-faction]")?.textContent;
  return String(factionLabel || "Neznámá frakce").trim() || "Neznámá frakce";
}

function getCurrentGangName() {
  return String(localStorage.getItem(GANG_NAME_STORAGE_KEY) || "Guest Crew").trim() || "Guest Crew";
}

function getOwnedDistrictIds() {
  const ids = getAuthoritySession().world?.ownedDistrictIds;
  return Array.isArray(ids) ? ids.map((districtId) => Number(districtId)).filter(Boolean) : [];
}

function getOwnedDistrictCount() {
  return getOwnedDistrictIds().length;
}

function getAllianceMapBadge() {
  const state = withActiveAlliance(getLocalAllianceState());
  const activeAlliance = state.activeAlliance;

  if (!activeAlliance) {
    return null;
  }

  const icon = getAllianceIconOption(activeAlliance.icon_key);
  return {
    name: String(activeAlliance.name || "").trim(),
    iconKey: icon.key,
    symbol: icon.symbol
  };
}

function seedGlobalChatMessages() {
  return [
    { time: "09:12", author: "System", text: "Serverový chat je připravený." },
    { time: "09:16", author: "Raven", text: "Sever města je pod tlakem." },
    { time: "09:19", author: "Hex", text: "Market se hýbe. Sledujte ceny." }
  ];
}

function getGlobalChatMessages() {
  const parsed = readJson(LOCAL_GLOBAL_CHAT_KEY, null);
  if (Array.isArray(parsed) && parsed.length) {
    return parsed;
  }
  const seeded = seedGlobalChatMessages();
  writeJson(LOCAL_GLOBAL_CHAT_KEY, seeded);
  return seeded;
}

function saveGlobalChatMessages(messages) {
  writeJson(LOCAL_GLOBAL_CHAT_KEY, (Array.isArray(messages) ? messages : []).slice(0, 30));
}

function appendGlobalChatMessage({ author, text }) {
  const nextMessages = [
    {
      time: formatTime(),
      author: String(author || getCurrentIdentity()).trim() || getCurrentIdentity(),
      text: String(text || "").trim()
    },
    ...getGlobalChatMessages()
  ].slice(0, 30);

  saveGlobalChatMessages(nextMessages);
  return nextMessages;
}

function computeReadyState(readyAt) {
  const readyTimestamp = readyAt ? new Date(readyAt).getTime() : 0;
  const dueAt = readyTimestamp ? readyTimestamp + ALLIANCE_READY_WINDOW_MS : 0;
  const now = Date.now();

  return {
    readyAt: readyAt || null,
    readyDueAt: dueAt ? new Date(dueAt).toISOString() : null,
    isReadyWindowActive: Boolean(dueAt && dueAt > now),
    isReadyOverdue: !dueAt || dueAt <= now
  };
}

function formatReadyCountdown(isoValue) {
  if (!isoValue) return "00:00:00";
  const dueMs = new Date(isoValue).getTime();
  if (!Number.isFinite(dueMs)) return "00:00:00";
  const deltaSeconds = Math.max(0, Math.floor((dueMs - Date.now()) / 1000));
  const hours = Math.floor(deltaSeconds / 3600);
  const minutes = Math.floor((deltaSeconds % 3600) / 60);
  const seconds = deltaSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRelativeTime(isoValue) {
  const timestamp = new Date(isoValue).getTime();
  if (!Number.isFinite(timestamp)) return "-";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "právě teď";
  if (diffMinutes < 60) return `před ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `před ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `před ${diffDays} d`;
}

function createSeedAllianceState() {
  const nowIso = new Date().toISOString();
  return {
    activeAllianceId: null,
    alliances: [
      {
        id: "alliance-neon-vipers",
        name: "Neon Vipers",
        description: "Rychlé přesuny, tlak na periferii a čisté vpády pod neonem.",
        icon_key: "lightning",
        owner_player_id: "owner-neon-vipers",
        bonus_income_pct: 8,
        bonus_influence_pct: 4,
        heat_control_text: "-6% heat",
        members: [
          { id: "owner-neon-vipers", username: "Raven", gang_name: "North Vultures", gang_structure: "Hackeři", alliance_ready_at: nowIso, sector_count: 6 },
          { id: "member-neon-lira", username: "Lira", gang_name: "Chrome Echo", gang_structure: "Korporace", alliance_ready_at: null, sector_count: 4 }
        ]
      },
      {
        id: "alliance-black-sun",
        name: "Black Sun Pact",
        description: "Tichá infiltrace, vydírání a chirurgické zásahy proti rivalům.",
        icon_key: "eye_triangle",
        owner_player_id: "owner-black-sun",
        bonus_income_pct: 5,
        bonus_influence_pct: 7,
        heat_control_text: "-10% heat",
        members: [
          { id: "owner-black-sun", username: "Hex", gang_name: "Dusk Syndicate", gang_structure: "Tajná organizace", alliance_ready_at: nowIso, sector_count: 7 }
        ]
      }
    ],
    requests: [],
    memberInvites: [
      {
        id: "invite-black-sun-player",
        alliance_id: "alliance-black-sun",
        alliance_name: "Black Sun Pact",
        target_player_id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
        username: getCurrentIdentity(),
        invited_by: "Hex",
        created_at: nowIso
      }
    ],
    kickVotes: [],
    notifications: [],
    auditLogs: [],
    chat: [
      { time: "09:12", author: "Raven", text: "Potřebujeme posily na sever." },
      { time: "09:14", author: "Lira", text: "Posílám tým, 5 minut." }
    ]
  };
}

function getLocalAllianceState() {
  const parsed = readJson(LOCAL_ALLIANCE_KEY, null);
  if (parsed && Array.isArray(parsed.alliances) && Array.isArray(parsed.chat)) {
    return parsed;
  }
  const seeded = createSeedAllianceState();
  writeJson(LOCAL_ALLIANCE_KEY, seeded);
  return seeded;
}

function withActiveAlliance(state) {
  const requests = Array.isArray(state?.requests) ? state.requests : [];
  const memberInvites = Array.isArray(state?.memberInvites) ? state.memberInvites : [];
  const kickVotes = Array.isArray(state?.kickVotes) ? state.kickVotes : [];
  const allAlliances = Array.isArray(state?.alliances) ? state.alliances : [];
  const activeAlliance = allAlliances.find((item) => item.id === state?.activeAllianceId) || null;

  return {
    ...state,
    activeAlliance: activeAlliance
      ? {
          ...activeAlliance,
          owner_player_id: activeAlliance.owner_player_id || LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
          icon_key: String(activeAlliance.icon_key || DEFAULT_ALLIANCE_ICON_KEY).trim() || DEFAULT_ALLIANCE_ICON_KEY,
          description: String(activeAlliance.description || "").trim() || DEFAULT_ALLIANCE_DESCRIPTION,
          current_player_role: String(activeAlliance.owner_player_id || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID ? "leader" : "member",
          current_player_ready: computeReadyState(
            (activeAlliance.members || []).find((member) => String(member.id || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID)?.alliance_ready_at || null
          ),
          member_count: (activeAlliance.members || []).length,
          members: (activeAlliance.members || []).map((member) => ({
            ...member,
            role: String(member.id || "") === String(activeAlliance.owner_player_id || "") ? "leader" : "member",
            ...computeReadyState(member.alliance_ready_at || null)
          })),
          pending_requests: requests.filter((request) => request.alliance_id === activeAlliance.id),
          outgoing_invites: memberInvites.filter((invite) => invite.alliance_id === activeAlliance.id && invite.target_player_id !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID),
          kick_votes: kickVotes.filter((vote) => vote.alliance_id === activeAlliance.id && vote.status === "open"),
          audit_logs: (Array.isArray(state?.auditLogs) ? state.auditLogs : [])
            .filter((entry) => entry.alliance_id === activeAlliance.id)
            .slice(-20)
            .reverse()
        }
      : null,
    alliances: allAlliances.map((alliance) => ({
      ...alliance,
      description: String(alliance.description || "").trim() || DEFAULT_ALLIANCE_DESCRIPTION,
      icon_key: String(alliance.icon_key || DEFAULT_ALLIANCE_ICON_KEY).trim() || DEFAULT_ALLIANCE_ICON_KEY,
      member_count: Array.isArray(alliance.members) ? alliance.members.length : 0,
      has_pending_request: requests.some((request) => request.alliance_id === alliance.id && request.player_id === LOCAL_ALLIANCE_REQUEST_PLAYER_ID)
    })),
    incomingInvites: memberInvites.filter((invite) => invite.target_player_id === LOCAL_ALLIANCE_REQUEST_PLAYER_ID)
  };
}

function saveLocalAllianceState(state) {
  writeJson(LOCAL_ALLIANCE_KEY, {
    activeAllianceId: state.activeAllianceId || null,
    alliances: Array.isArray(state.alliances) ? state.alliances : [],
    requests: Array.isArray(state.requests) ? state.requests : [],
    memberInvites: Array.isArray(state.memberInvites) ? state.memberInvites : [],
    kickVotes: Array.isArray(state.kickVotes) ? state.kickVotes : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    auditLogs: Array.isArray(state.auditLogs) ? state.auditLogs : [],
    chat: Array.isArray(state.chat) ? state.chat : []
  });
  publishAllianceState();
}

function appendAllianceAuditLog(state, allianceId, message) {
  state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  state.auditLogs.push({
    id: `alliance-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    alliance_id: allianceId,
    message,
    created_at: new Date().toISOString()
  });
  state.auditLogs = state.auditLogs.slice(-50);
}

function appendAllianceChat(state, { author, text }) {
  state.chat = [
    {
      time: formatTime(),
      author: String(author || getCurrentIdentity()).trim() || getCurrentIdentity(),
      text: String(text || "").trim()
    },
    ...(Array.isArray(state.chat) ? state.chat : [])
  ].slice(0, 30);
}

function createLocalAlliance(state, options) {
  const name = String(options?.name || "").trim();
  const description = String(options?.description || "").trim() || DEFAULT_ALLIANCE_DESCRIPTION;
  const iconKey = String(options?.iconKey || DEFAULT_ALLIANCE_ICON_KEY).trim() || DEFAULT_ALLIANCE_ICON_KEY;
  const nowIso = new Date().toISOString();
  const alliance = {
    id: `alliance-${Date.now()}`,
    name,
    description,
    icon_key: iconKey,
    owner_player_id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
    bonus_income_pct: 6,
    bonus_influence_pct: 5,
    heat_control_text: "-8% heat",
    members: [
      {
        id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
        username: getCurrentIdentity(),
        gang_name: getCurrentGangName(),
        gang_structure: getCurrentFactionLabel(),
        alliance_ready_at: nowIso,
        sector_count: getOwnedDistrictCount()
      },
      {
        id: `alliance-scout-${Date.now()}`,
        username: "Nyra",
        gang_name: "Glass Alley",
        gang_structure: "Kult",
        alliance_ready_at: null,
        sector_count: 3
      }
    ]
  };

  state.alliances = [alliance, ...(Array.isArray(state.alliances) ? state.alliances : [])];
  state.activeAllianceId = alliance.id;
  state.requests = [];
  state.memberInvites = (Array.isArray(state.memberInvites) ? state.memberInvites : []).filter((invite) => invite.target_player_id !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  appendAllianceAuditLog(state, alliance.id, "Aliance byla založena.");
  appendAllianceAuditLog(state, alliance.id, "Nyra byla automaticky přidána jako spojenecký kontakt.");
  appendAllianceChat(state, { author: "System", text: `Aliance ${name} byla založena.` });
  return alliance;
}

function joinLocalAlliance(state, allianceId) {
  const alliance = (state.alliances || []).find((item) => item.id === allianceId);
  if (!alliance) return { error: "missing_alliance" };
  if (state.activeAllianceId) return { error: "already_in_alliance" };
  if ((alliance.members || []).length >= ALLIANCE_MAX_MEMBERS) return { error: "alliance_full" };
  alliance.members = Array.isArray(alliance.members) ? alliance.members : [];
  alliance.members.push({
    id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
    username: getCurrentIdentity(),
    gang_name: getCurrentGangName(),
    gang_structure: getCurrentFactionLabel(),
    alliance_ready_at: new Date().toISOString(),
    sector_count: getOwnedDistrictCount()
  });
  state.activeAllianceId = alliance.id;
  state.requests = (state.requests || []).filter((request) => request.player_id !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  state.memberInvites = (state.memberInvites || []).filter((invite) => invite.target_player_id !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  appendAllianceAuditLog(state, alliance.id, `${getCurrentIdentity()} vstoupil do aliance.`);
  appendAllianceChat(state, { author: "System", text: `${getCurrentIdentity()} vstoupil do aliance ${alliance.name}.` });
  return { ok: true, allianceName: alliance.name };
}

function leaveLocalAlliance(state) {
  const active = (state.alliances || []).find((item) => item.id === state.activeAllianceId);
  if (!active) return { error: "no_active_alliance" };
  active.members = (active.members || []).filter((member) => String(member.id || "") !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID);

  if (!active.members.length) {
    state.alliances = (state.alliances || []).filter((item) => item.id !== active.id);
  } else if (String(active.owner_player_id || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID) {
    active.owner_player_id = String(active.members[0]?.id || "");
  }

  state.activeAllianceId = null;
  appendAllianceAuditLog(state, active.id, `${getCurrentIdentity()} opustil alianci.`);
  appendAllianceChat(state, { author: "System", text: `${getCurrentIdentity()} opustil alianci ${active.name}.` });
  return { ok: true };
}

function sendLocalAllianceManagementInvite(state, username) {
  const active = (state.alliances || []).find((item) => item.id === state.activeAllianceId);
  if (!active) return { error: "no_active_alliance" };
  if (String(active.owner_player_id || "") !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID) return { error: "not_alliance_owner" };
  if ((active.members || []).length >= ALLIANCE_MAX_MEMBERS) return { error: "alliance_full" };
  const normalized = normalizeOwnerName(username);
  if (!normalized) return { error: "missing_player" };
  state.memberInvites = Array.isArray(state.memberInvites) ? state.memberInvites : [];
  if (state.memberInvites.some((invite) => invite.alliance_id === active.id && normalizeOwnerName(invite.username) === normalized)) {
    return { error: "invite_pending" };
  }
  state.memberInvites.push({
    id: `alliance-member-invite-${Date.now()}`,
    alliance_id: active.id,
    alliance_name: active.name,
    target_player_id: `external-${Date.now()}`,
    username: username.trim(),
    invited_by: getCurrentIdentity(),
    created_at: new Date().toISOString()
  });
  appendAllianceAuditLog(state, active.id, `Byla poslána přímá pozvánka pro ${username.trim()}.`);
  return { ok: true };
}

function respondToIncomingInvite(state, inviteId, accept) {
  const invite = (state.memberInvites || []).find((item) => item.id === inviteId && item.target_player_id === LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  if (!invite) return { error: "missing_invite" };
  if (!accept) {
    state.memberInvites = (state.memberInvites || []).filter((item) => item.id !== inviteId);
    return { ok: true, declined: true };
  }
  return joinLocalAlliance(state, invite.alliance_id);
}

function markCurrentPlayerAllianceReady(state) {
  const active = (state.alliances || []).find((item) => item.id === state.activeAllianceId);
  if (!active) return { error: "no_active_alliance" };
  const member = (active.members || []).find((item) => String(item.id || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  if (!member) return { error: "missing_member" };
  member.alliance_ready_at = new Date().toISOString();
  appendAllianceAuditLog(state, active.id, `${getCurrentIdentity()} obnovil READY stav.`);
  return { ok: true };
}

function removeAllianceMember(state, memberId) {
  const active = (state.alliances || []).find((item) => item.id === state.activeAllianceId);
  if (!active) return { error: "no_active_alliance" };
  if (String(active.owner_player_id || "") !== LOCAL_ALLIANCE_REQUEST_PLAYER_ID) return { error: "not_alliance_owner" };
  if (String(memberId || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID) return { error: "cannot_remove_leader" };
  const removedMember = (active.members || []).find((member) => String(member.id || "") === String(memberId || ""));
  active.members = (active.members || []).filter((member) => String(member.id || "") !== String(memberId || ""));
  appendAllianceAuditLog(state, active.id, `Člen ${removedMember?.username || "?"} byl vyhozen z aliance.`);
  return { ok: true };
}

function startAllianceKickVote(state, memberId) {
  const active = (state.alliances || []).find((item) => item.id === state.activeAllianceId);
  if (!active) return { error: "no_active_alliance" };
  const target = (active.members || []).find((member) => String(member.id || "") === String(memberId || ""));
  if (!target) return { error: "missing_member" };
  if (!computeReadyState(target.alliance_ready_at || null).isReadyOverdue) return { error: "member_ready_active" };
  state.kickVotes = Array.isArray(state.kickVotes) ? state.kickVotes : [];
  if (state.kickVotes.some((vote) => vote.alliance_id === active.id && vote.target_player_id === memberId && vote.status === "open")) {
    return { error: "vote_already_open" };
  }
  state.kickVotes.push({
    id: `alliance-vote-${Date.now()}`,
    alliance_id: active.id,
    target_player_id: memberId,
    required_votes: Math.max(2, Math.ceil((active.members || []).length / 2)),
    yes_votes: 1,
    voters: [LOCAL_ALLIANCE_REQUEST_PLAYER_ID],
    status: "open"
  });
  appendAllianceAuditLog(state, active.id, `Bylo zahájeno hlasování o vyhození ${target.username}.`);
  return { ok: true };
}

function castAllianceKickVote(state, voteId) {
  const vote = (state.kickVotes || []).find((item) => item.id === voteId && item.status === "open");
  if (!vote) return { error: "missing_vote" };
  if ((vote.voters || []).includes(LOCAL_ALLIANCE_REQUEST_PLAYER_ID)) return { error: "vote_already_cast" };
  vote.voters.push(LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
  vote.yes_votes = Number(vote.yes_votes || 0) + 1;
  appendAllianceAuditLog(state, vote.alliance_id, "Byl odevzdán hlas pro vyhození člena.");

  if (vote.yes_votes >= vote.required_votes) {
    vote.status = "closed";
    removeAllianceMember(state, vote.target_player_id);
  }

  return { ok: true };
}

function formatAllianceError(errorKey) {
  switch (String(errorKey || "").trim()) {
    case "alliance_full":
      return "Aliance je plná.";
    case "already_in_alliance":
      return "Už jsi v alianci.";
    case "no_active_alliance":
      return "Nejsi v žádné alianci.";
    case "not_alliance_owner":
      return "Tu akci může provést jen leader.";
    case "invite_pending":
      return "Pozvánka už čeká.";
    case "missing_invite":
      return "Pozvánka nebyla nalezena.";
    case "cannot_remove_leader":
      return "Leadera nelze vyhodit.";
    case "missing_member":
      return "Člen nebyl nalezen.";
    case "member_ready_active":
      return "Člen má stále aktivní READY okno.";
    case "vote_already_open":
      return "Hlasování už běží.";
    case "missing_vote":
      return "Hlasování nebylo nalezeno.";
    case "vote_already_cast":
      return "V tomto hlasování už jsi hlasoval.";
    default:
      return "Akci se nepodařilo dokončit.";
  }
}

function renderAllianceIdentityMarkup(alliance) {
  const icon = getAllianceIconOption(alliance?.icon_key);
  return `
    <span class="alliance-badge-markup" title="${escapeHtml(icon.label)}">
      <span class="alliance-badge-markup__icon" aria-hidden="true">${escapeHtml(icon.symbol)}</span>
      <span class="alliance-badge-markup__name">${escapeHtml(alliance?.name || "Aliance")}</span>
    </span>
  `;
}

function getMemberSectorLabel(member) {
  const identity = normalizeOwnerName(getCurrentIdentity());
  const memberName = normalizeOwnerName(member?.username);
  const sectorCount = memberName && memberName === identity
    ? getOwnedDistrictCount()
    : Math.max(0, Number(member?.sector_count || member?.sectorCount || 0));
  return `${sectorCount} sektorů`;
}

function renderAllianceMemberCard(member, kickVotes = []) {
  const openVote = (kickVotes || []).find((vote) => String(vote.target_player_id || "") === String(member.id || ""));
  const readyMarkup = member.role === "leader"
    ? `<span class="alliance-ready-state alliance-ready-state--leader">Leader</span>`
    : member.isReadyWindowActive
      ? `<span class="alliance-ready-state alliance-ready-state--ok">READY ${formatReadyCountdown(member.readyDueAt)}</span>`
      : `<span class="alliance-ready-state alliance-ready-state--bad">READY chybí</span>`;
  const avatarSrc = escapeUrlAttribute(member.avatar);
  const avatarMarkup = avatarSrc
    ? `<button class="alliance-member__avatar-btn" type="button" data-alliance-member-avatar="${escapeHtml(member.username || "Hráč")}" data-alliance-member-avatar-src="${avatarSrc}" data-alliance-member-avatar-meta="${escapeHtml(`${member.gang_structure || "Gang"} • ${getMemberSectorLabel(member)}`)}"><img class="alliance-member__avatar" src="${avatarSrc}" alt="Avatar ${escapeHtml(member.username || "Hráč")}" loading="lazy"></button>`
    : `<div class="alliance-member__avatar--empty">${escapeHtml(String(member?.username || "?").slice(0, 1).toUpperCase())}</div>`;

  return `
    <div class="alliance-member">
      <div class="alliance-member__top">
        ${avatarMarkup}
        <div class="alliance-member__identity">
          <strong>${escapeHtml(member.username || "Hráč")}</strong>
          <span>${escapeHtml(member.gang_name || "Gang")} • ${escapeHtml(member.gang_structure || "Frakce")} • ${escapeHtml(getMemberSectorLabel(member))}</span>
        </div>
      </div>
      <div class="alliance-active-card__actions">
        ${readyMarkup}
        ${openVote ? `<span class="alliance-ready-state alliance-ready-state--leader">Hlasování ${openVote.yes_votes}/${openVote.required_votes}</span>` : ""}
      </div>
    </div>
  `;
}

function renderAllianceChat(messages) {
  const logs = Array.from(document.querySelectorAll("[data-alliance-chat-log]"));
  if (!logs.length) return;
  const safeMessages = Array.isArray(messages) && messages.length ? messages : [];
  const markup = safeMessages.length
    ? safeMessages.map((message) => `<div class="alliance-chat__item">[${escapeHtml(message.time)}] ${escapeHtml(message.author)}: ${escapeHtml(message.text)}</div>`).join("")
    : `<div class="alliance-chat__item">Aliance chat je připravený. První zpráva odemkne interní komunikační linku.</div>`;
  logs.forEach((log) => {
    log.innerHTML = markup;
  });
}

function renderGlobalServerChat(messages = getGlobalChatMessages()) {
  const logs = Array.from(document.querySelectorAll("[data-global-chat-log]"));
  if (!logs.length) return;
  const markup = messages.map((message) => `<div class="alliance-chat__item">[${escapeHtml(message.time)}] ${escapeHtml(message.author)}: ${escapeHtml(message.text)}</div>`).join("");
  logs.forEach((log) => {
    log.innerHTML = markup;
  });
}

function renderAllianceState(state) {
  const createEntry = qs("alliance-create-entry");
  const activePanel = qs("alliance-active-panel");
  const playerInvitesPanel = qs("alliance-player-invites-panel");
  const listPanel = qs("alliance-list-panel");
  const leaveBtn = qs("alliance-leave-btn");
  const managementBtn = qs("alliance-management-footer-btn");
  const activeAlliance = state.activeAlliance;

  if (createEntry) {
    createEntry.classList.toggle("hidden", Boolean(activeAlliance));
  }

  if (leaveBtn) {
    leaveBtn.classList.toggle("hidden", !activeAlliance);
  }

  if (managementBtn) {
    managementBtn.classList.toggle("hidden", !activeAlliance);
  }

  if (activePanel) {
    if (!activeAlliance) {
      activePanel.innerHTML = "";
    } else {
      activePanel.innerHTML = `
        <div class="alliance-active-card">
          <div class="alliance-active-card__top">
            <div class="alliance-active-card__badge-wrap">
              <div class="alliance-active-card__badge-line">
                <div class="alliance-active-card__badge">
                  ${renderAllianceIdentityMarkup(activeAlliance)}
                </div>
                <div class="alliance-ready-panel">
                  <div class="alliance-ready-panel__meta">
                    <span>${activeAlliance.current_player_role === "leader" ? "Leader" : "Člen"}</span>
                    <div class="alliance-ready-panel__timer ${activeAlliance.current_player_ready?.isReadyWindowActive ? "alliance-ready-panel__timer--ok" : "alliance-ready-panel__timer--bad"}">
                      ${activeAlliance.current_player_ready?.isReadyWindowActive ? formatReadyCountdown(activeAlliance.current_player_ready.readyDueAt) : "READY chybí"}
                    </div>
                  </div>
                </div>
              </div>
              <div class="alliance-active-card__description">
                <span>Popis aliance</span>
                <strong>${escapeHtml(activeAlliance.description || DEFAULT_ALLIANCE_DESCRIPTION)}</strong>
              </div>
              <div class="alliance-active-card__badges">
                <span class="alliance-ready-state alliance-ready-state--leader">${escapeHtml(activeAlliance.heat_control_text || "-8% heat")}</span>
                <button class="btn btn--primary alliance-ready-btn alliance-ready-btn--inline" id="alliance-ready-btn">READY</button>
              </div>
            </div>
          </div>
          <div class="alliance-active-card__overview">
            <div class="alliance-active-card__stats-column">
              <div class="alliance-active-card__stat"><span>Členové</span><strong>${activeAlliance.member_count}/${ALLIANCE_MAX_MEMBERS}</strong></div>
              <div class="alliance-active-card__stat"><span>Income bonus</span><strong>+${Number(activeAlliance.bonus_income_pct || 0)}%</strong></div>
              <div class="alliance-active-card__stat"><span>Influence bonus</span><strong>+${Number(activeAlliance.bonus_influence_pct || 0)}%</strong></div>
            </div>
            <div class="alliance-active-card__chat-pane">
              <div class="alliance-chat alliance-chat--modal">
                <div class="alliance-chat__title">Aliance chat</div>
                <div class="alliance-chat__log" data-alliance-chat-log></div>
                <div class="alliance-chat__input alliance-chat__input--modal alliance-active-card__chat-compose">
                  <input type="text" placeholder="Napiš zprávu do chatu aliance..." data-alliance-chat-input>
                  <button type="button" class="btn btn--primary" data-alliance-chat-send>Odeslat</button>
                </div>
              </div>
            </div>
          </div>
          <div class="alliance-pending-panel">
            <div class="alliance-pending-panel__title">Členové aliance</div>
            <div class="alliance-members">${activeAlliance.members.map((member) => renderAllianceMemberCard(member, activeAlliance.kick_votes || [])).join("")}</div>
          </div>
          <div class="alliance-active-card__actions">
            <button class="btn btn--ghost alliance-management-btn" id="alliance-management-open-btn">Správa aliance</button>
          </div>
        </div>
      `;
    }
  }

  if (playerInvitesPanel) {
    const incomingInvites = Array.isArray(state.incomingInvites) ? state.incomingInvites : [];
    playerInvitesPanel.innerHTML = incomingInvites.length
      ? `
          <div class="alliance-pending-panel">
            <div class="alliance-pending-panel__title">Přímé pozvánky</div>
            ${incomingInvites.map((invite) => `
              <div class="alliance-request-item">
                <div class="alliance-request-item__copy">
                  <strong>${escapeHtml(invite.alliance_name || "Aliance")}</strong>
                  <span>Pozvánka od ${escapeHtml(invite.invited_by || "leader")} • ${escapeHtml(formatRelativeTime(invite.created_at))}</span>
                </div>
                <div class="alliance-request-item__actions">
                  <button class="btn btn--primary" data-alliance-invite-accept="${escapeHtml(invite.id)}">Přijmout</button>
                  <button class="btn btn--ghost" data-alliance-invite-reject="${escapeHtml(invite.id)}">Odmítnout</button>
                </div>
              </div>
            `).join("")}
          </div>
        `
      : "";
  }

  if (listPanel) {
    const alliances = (state.alliances || []).filter((alliance) => alliance.id !== state.activeAllianceId);
    listPanel.innerHTML = `
      <div class="alliance-pending-panel">
        <div class="alliance-pending-panel__title">Veřejné aliance</div>
        <div class="alliance-list">
          ${alliances.map((alliance) => `
            <div class="alliance-list__item">
              <div class="alliance-list__name">${renderAllianceIdentityMarkup(alliance)}</div>
              <div class="alliance-list__meta">${alliance.member_count || 0}/${ALLIANCE_MAX_MEMBERS} členů • +${alliance.bonus_income_pct || 0}% income • +${alliance.bonus_influence_pct || 0}% influence</div>
              <div class="alliance-list__description">${escapeHtml(alliance.description || DEFAULT_ALLIANCE_DESCRIPTION)}</div>
              <div class="alliance-request-item__actions">
                <button class="btn btn--ghost" data-alliance-join="${escapeHtml(alliance.id)}" ${(state.activeAlliance || Number(alliance.member_count || 0) >= ALLIANCE_MAX_MEMBERS || alliance.has_pending_request) ? "disabled" : ""}>
                  ${alliance.has_pending_request ? "Žádost čeká" : "Vstoupit"}
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  renderAllianceChat(activeAlliance?.chat || state.chat || []);
}

function renderAllianceManagementState(state) {
  const panel = qs("alliance-management-panel");
  if (!panel) return;
  const activeAlliance = state.activeAlliance;

  if (!activeAlliance) {
    panel.innerHTML = `<div class="alliance-request-item alliance-request-item--empty">Nejsi ve vlastní alianci.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="alliance-management-ready">
      <div class="alliance-management-ready__copy">
        <span>Status</span>
        <strong>${activeAlliance.current_player_role === "leader" ? "Leader" : "Člen"} • ${activeAlliance.name}</strong>
      </div>
      <div class="alliance-management-ready__actions">
        <button class="btn btn--primary alliance-ready-btn alliance-ready-btn--management" id="alliance-management-ready-btn">READY</button>
      </div>
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Členové aliance</div>
      ${(activeAlliance.members || []).map((member) => {
        const openVote = (activeAlliance.kick_votes || []).find((vote) => String(vote.target_player_id || "") === String(member.id || ""));
        const canKickStart = activeAlliance.current_player_role === "leader" && member.role !== "leader";
        return `
          <div class="alliance-request-item">
            <div class="alliance-request-item__copy">
              <strong>${escapeHtml(member.username || "Hráč")}</strong>
              <span>${escapeHtml(member.gang_name || "Gang")} • ${escapeHtml(member.gang_structure || "Frakce")} • ${escapeHtml(getMemberSectorLabel(member))}</span>
            </div>
            <div class="alliance-request-item__actions">
              ${canKickStart ? `<button class="btn btn--ghost" data-alliance-member-remove="${escapeHtml(member.id)}">Vyhodit</button>` : ""}
              ${canKickStart && !openVote ? `<button class="btn btn--primary" data-alliance-kick-start="${escapeHtml(member.id)}">Spustit hlasování</button>` : ""}
              ${openVote ? `<button class="btn btn--primary" data-alliance-kick-cast="${escapeHtml(openVote.id)}">Hlasovat (${openVote.yes_votes}/${openVote.required_votes})</button>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Odeslané přímé pozvánky</div>
      ${(activeAlliance.outgoing_invites || []).length
        ? activeAlliance.outgoing_invites.map((invite) => `
            <div class="alliance-request-item">
              <div class="alliance-request-item__copy">
                <strong>${escapeHtml(invite.username || "Hráč")}</strong>
                <span>Pozváno ${escapeHtml(formatRelativeTime(invite.created_at))}</span>
              </div>
            </div>
          `).join("")
        : `<div class="alliance-request-item alliance-request-item--empty">Žádné aktivní přímé pozvánky.</div>`}
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Audit log aliance</div>
      ${(activeAlliance.audit_logs || []).length
        ? activeAlliance.audit_logs.map((entry) => `
            <div class="alliance-request-item alliance-request-item--log">
              <div class="alliance-request-item__copy">
                <strong>${escapeHtml(formatRelativeTime(entry.created_at))}</strong>
                <span>${escapeHtml(entry.message || "")}</span>
              </div>
            </div>
          `).join("")
        : `<div class="alliance-request-item alliance-request-item--empty">Audit log je zatím prázdný.</div>`}
    </div>
  `;
}

function syncAllianceLabels(activeAlliance) {
  const label = activeAlliance?.name ? String(activeAlliance.name).trim() : "Žádná";
  const gangAlliance = document.querySelector("[data-gang-alliance]");
  const playerPopupAlliance = document.querySelector("[data-player-popup-alliance]");

  if (gangAlliance) {
    const districts = getOwnedDistrictCount();
    gangAlliance.textContent = label === "Žádná" ? "Žádná" : `${label} (${districts} sektorů)`;
  }

  if (playerPopupAlliance) {
    playerPopupAlliance.textContent = label === "Žádná" ? "Žádná" : label;
  }

  const allianceBtn = qs("alliance-btn");
  if (allianceBtn) {
    const labelEl = allianceBtn.querySelector(".alliance-btn__label");
    if (labelEl) {
      labelEl.textContent = label === "Žádná" ? "Aliance" : label;
    }
  }
}

function publishAllianceState() {
  const state = withActiveAlliance(getLocalAllianceState());
  window.empireStreetsAllianceState = {
    getState: () => withActiveAlliance(getLocalAllianceState()),
    getActiveAlliance: () => withActiveAlliance(getLocalAllianceState()).activeAlliance,
    getMapBadge: () => getAllianceMapBadge()
  };
  syncAllianceLabels(state.activeAlliance);
  window.dispatchEvent(new CustomEvent("empire:alliance-state-changed", { detail: state }));
}

function openMemberLightboxFromButton(button) {
  const shell = qs("alliance-member-lightbox");
  const image = qs("alliance-member-lightbox-image");
  const title = qs("alliance-member-lightbox-title");
  const meta = qs("alliance-member-lightbox-meta");
  if (!shell || !image || !title || !meta) return;

  const src = String(button.getAttribute("data-alliance-member-avatar-src") || "").trim();
  const caption = String(button.getAttribute("data-alliance-member-avatar") || "Člen aliance").trim();
  const detail = String(button.getAttribute("data-alliance-member-avatar-meta") || "").trim();

  if (!src) return;
  image.src = src;
  title.textContent = caption || "Člen aliance";
  meta.textContent = detail;
  shell.classList.remove("hidden");
}

function closeMemberLightbox() {
  const shell = qs("alliance-member-lightbox");
  if (shell) {
    shell.classList.add("hidden");
  }
}

function initAllianceRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  const openBtn = qs("alliance-btn");
  const allianceModal = qs("alliance-modal");
  const createModal = qs("alliance-create-modal");
  const leaveModal = qs("alliance-leave-modal");
  const managementModal = qs("alliance-management-modal");
  const createName = qs("alliance-create-name");
  const createDescription = qs("alliance-create-description");
  const iconPicker = qs("alliance-icon-picker");
  const globalChatInput = qs("alliance-chat-input");
  const globalChatSend = qs("alliance-chat-send");

  if (!root || !openBtn || !allianceModal || !createModal || !leaveModal || !managementModal || !createName || !createDescription || !iconPicker) {
    return;
  }

  let selectedAllianceIconKey = DEFAULT_ALLIANCE_ICON_KEY;
  let refreshTimerId = null;

  const setModalVisible = (modal, visible) => {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
  };

  const resetCreateForm = () => {
    createName.value = "";
    createDescription.value = DEFAULT_ALLIANCE_DESCRIPTION;
    selectedAllianceIconKey = DEFAULT_ALLIANCE_ICON_KEY;
    renderIconPicker();
  };

  const renderIconPicker = () => {
    iconPicker.innerHTML = ALLIANCE_ICON_OPTIONS.map((icon) => `
      <button type="button" class="alliance-icon-option${icon.key === selectedAllianceIconKey ? " is-selected" : ""}" data-alliance-icon-key="${escapeHtml(icon.key)}" title="${escapeHtml(icon.label)}" aria-label="${escapeHtml(icon.label)}">
        <span class="alliance-icon-option__symbol">${escapeHtml(icon.symbol)}</span>
      </button>
    `).join("");
  };

  const rerenderAll = () => {
    const state = withActiveAlliance(getLocalAllianceState());
    renderAllianceState(state);
    renderAllianceManagementState(state);
    renderGlobalServerChat(getGlobalChatMessages());
    syncAllianceLabels(state.activeAlliance);
  };

  const openAllianceModal = () => {
    setModalVisible(allianceModal, true);
    setModalVisible(createModal, false);
    setModalVisible(leaveModal, false);
    setModalVisible(managementModal, false);
    rerenderAll();
    if (refreshTimerId !== null) {
      window.clearInterval(refreshTimerId);
    }
    refreshTimerId = window.setInterval(rerenderAll, 1000);
  };

  const closeAllAllianceModals = () => {
    setModalVisible(allianceModal, false);
    setModalVisible(createModal, false);
    setModalVisible(leaveModal, false);
    setModalVisible(managementModal, false);
    if (refreshTimerId !== null) {
      window.clearInterval(refreshTimerId);
      refreshTimerId = null;
    }
  };

  const notify = (message) => {
    const summary = document.querySelector("[data-building-action-summary]");
    if (summary) {
      summary.textContent = message;
    }
  };

  openBtn.addEventListener("click", openAllianceModal);
  qs("alliance-modal-backdrop")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-modal-close")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-create-toggle-btn")?.addEventListener("click", () => setModalVisible(createModal, true));
  qs("alliance-create-modal-backdrop")?.addEventListener("click", () => setModalVisible(createModal, false));
  qs("alliance-create-modal-close")?.addEventListener("click", () => setModalVisible(createModal, false));
  qs("alliance-leave-modal-backdrop")?.addEventListener("click", () => setModalVisible(leaveModal, false));
  qs("alliance-leave-modal-close")?.addEventListener("click", () => setModalVisible(leaveModal, false));
  qs("alliance-leave-cancel-btn")?.addEventListener("click", () => setModalVisible(leaveModal, false));
  qs("alliance-management-modal-backdrop")?.addEventListener("click", () => setModalVisible(managementModal, false));
  qs("alliance-management-modal-close")?.addEventListener("click", () => setModalVisible(managementModal, false));
  qs("alliance-management-footer-btn")?.addEventListener("click", () => setModalVisible(managementModal, true));
  qs("alliance-leave-btn")?.addEventListener("click", () => setModalVisible(leaveModal, true));

  qs("alliance-create-btn")?.addEventListener("click", () => {
    const name = String(createName.value || "").trim();
    const description = String(createDescription.value || "").trim();
    if (!name) {
      notify("Zadej název aliance.");
      return;
    }
    const state = getLocalAllianceState();
    const alliance = createLocalAlliance(state, { name, description, iconKey: selectedAllianceIconKey });
    saveLocalAllianceState(state);
    notify(`Aliance ${alliance.name} byla vytvořena.`);
    setModalVisible(createModal, false);
    resetCreateForm();
    rerenderAll();
  });

  qs("alliance-leave-confirm-btn")?.addEventListener("click", () => {
    const state = getLocalAllianceState();
    const result = leaveLocalAlliance(state);
    if (result.error) {
      notify(formatAllianceError(result.error));
      return;
    }
    saveLocalAllianceState(state);
    notify("Alianci jsi opustil.");
    setModalVisible(leaveModal, false);
    rerenderAll();
  });

  qs("alliance-management-invite-btn")?.addEventListener("click", () => {
    const input = qs("alliance-management-invite-name");
    const username = String(input?.value || "").trim();
    if (!username) {
      notify("Zadej jméno hráče pro pozvánku.");
      return;
    }
    const state = getLocalAllianceState();
    const result = sendLocalAllianceManagementInvite(state, username);
    if (result.error) {
      notify(formatAllianceError(result.error));
      return;
    }
    saveLocalAllianceState(state);
    if (input) input.value = "";
    notify("Přímá pozvánka byla odeslána.");
    rerenderAll();
  });

  iconPicker.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest("[data-alliance-icon-key]") : null;
    if (!(trigger instanceof HTMLElement)) return;
    selectedAllianceIconKey = String(trigger.getAttribute("data-alliance-icon-key") || DEFAULT_ALLIANCE_ICON_KEY).trim() || DEFAULT_ALLIANCE_ICON_KEY;
    renderIconPicker();
  });

  allianceModal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-alliance-join], [data-alliance-invite-accept], [data-alliance-invite-reject], #alliance-management-open-btn, #alliance-ready-btn, [data-alliance-chat-send], [data-alliance-member-avatar]") : null;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-alliance-member-avatar]")) {
      openMemberLightboxFromButton(target);
      return;
    }

    if (target.id === "alliance-management-open-btn") {
      setModalVisible(managementModal, true);
      return;
    }

    if (target.id === "alliance-ready-btn") {
      const state = getLocalAllianceState();
      const result = markCurrentPlayerAllianceReady(state);
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify("READY stav byl obnoven.");
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-chat-send")) {
      const input = allianceModal.querySelector("[data-alliance-chat-input]");
      const text = String(input?.value || "").trim();
      if (!text) return;
      const state = getLocalAllianceState();
      appendAllianceChat(state, { author: getCurrentIdentity(), text });
      saveLocalAllianceState(state);
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-join")) {
      const allianceId = String(target.getAttribute("data-alliance-join") || "").trim();
      const state = getLocalAllianceState();
      const result = joinLocalAlliance(state, allianceId);
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify(`Vstoupil jsi do aliance ${result.allianceName}.`);
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-invite-accept") || target.hasAttribute("data-alliance-invite-reject")) {
      const inviteId = String(target.getAttribute("data-alliance-invite-accept") || target.getAttribute("data-alliance-invite-reject") || "").trim();
      const state = getLocalAllianceState();
      const result = respondToIncomingInvite(state, inviteId, target.hasAttribute("data-alliance-invite-accept"));
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      if (target.hasAttribute("data-alliance-invite-reject")) {
        state.memberInvites = (state.memberInvites || []).filter((invite) => invite.id !== inviteId);
      }
      saveLocalAllianceState(state);
      notify(target.hasAttribute("data-alliance-invite-accept") ? "Pozvání do aliance bylo přijato." : "Pozvání do aliance bylo odmítnuto.");
      rerenderAll();
    }
  });

  allianceModal.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-alliance-chat-input")) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    allianceModal.querySelector("[data-alliance-chat-send]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  managementModal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("#alliance-management-ready-btn, [data-alliance-member-remove], [data-alliance-kick-start], [data-alliance-kick-cast]") : null;
    if (!(target instanceof HTMLElement)) return;
    const state = getLocalAllianceState();

    if (target.id === "alliance-management-ready-btn") {
      const result = markCurrentPlayerAllianceReady(state);
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify("READY stav byl obnoven.");
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-member-remove")) {
      const result = removeAllianceMember(state, target.getAttribute("data-alliance-member-remove"));
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify("Člen byl vyhozen z aliance.");
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-kick-start")) {
      const result = startAllianceKickVote(state, target.getAttribute("data-alliance-kick-start"));
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify("Hlasování bylo spuštěno.");
      rerenderAll();
      return;
    }

    if (target.hasAttribute("data-alliance-kick-cast")) {
      const result = castAllianceKickVote(state, target.getAttribute("data-alliance-kick-cast"));
      if (result.error) {
        notify(formatAllianceError(result.error));
        return;
      }
      saveLocalAllianceState(state);
      notify("Hlas byl započten.");
      rerenderAll();
    }
  });

  globalChatSend?.addEventListener("click", () => {
    const text = String(globalChatInput?.value || "").trim();
    if (!text) return;
    appendGlobalChatMessage({ author: getCurrentIdentity(), text });
    if (globalChatInput instanceof HTMLInputElement) {
      globalChatInput.value = "";
    }
    renderGlobalServerChat(getGlobalChatMessages());
  });

  globalChatInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    globalChatSend?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  qs("alliance-member-lightbox-close")?.addEventListener("click", closeMemberLightbox);
  qs("alliance-member-lightbox-backdrop")?.addEventListener("click", closeMemberLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!qs("alliance-member-lightbox")?.classList.contains("hidden")) {
      closeMemberLightbox();
      return;
    }
    closeAllAllianceModals();
  });

  window.addEventListener("empire:alliance-state-changed", () => {
    rerenderAll();
  });

  renderIconPicker();
  resetCreateForm();
  publishAllianceState();
  rerenderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllianceRuntime, { once: true });
} else {
  initAllianceRuntime();
}
