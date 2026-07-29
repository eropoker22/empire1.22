import {
  PLAYER_PROFILE_OPEN_SELECTOR,
  PLAYER_POPUP_ALLIANCE_SELECTOR,
  PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR,
  PLAYER_POPUP_AVATAR_SELECTOR,
  PLAYER_POPUP_CARD_SELECTOR,
  PLAYER_POPUP_CLEAN_MONEY_SELECTOR,
  PLAYER_POPUP_CLOSE_SELECTOR,
  PLAYER_POPUP_DIRTY_MONEY_SELECTOR,
  PLAYER_POPUP_DISTRICTS_SELECTOR,
  PLAYER_POPUP_EMPIRE_SCORE_SELECTOR,
  PLAYER_POPUP_FACTION_SELECTOR,
  PLAYER_POPUP_GANG_SELECTOR,
  PLAYER_POPUP_HEAT_SELECTOR,
  PLAYER_POPUP_IDENTITY_SELECTOR,
  PLAYER_POPUP_INFLUENCE_SELECTOR,
  PLAYER_POPUP_PROTECTION_SELECTOR,
  PLAYER_POPUP_SELECTOR,
  PLAYER_POPUP_SERVER_SELECTOR
} from "../runtime/constants.js";
import { createPlayerProfileViewModel } from "../runtime/playerProfileViewModel.js";
import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import { renderPlayerProfilePanel } from "./playerProfilePanel.js";
import { resolveLivePlayerAvatarSrc } from "../model/livePlayerAvatarCatalog.js";

export function createServerGameplayProfileController({
  root,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let eventScope = null;
  let elements = {};
  let closeElements = [];
  let latestView = null;
  let latestFingerprint = "";
  let renderedFingerprint = "";
  const diagnostics = { updates: 0, renders: 0 };

  const render = () => {
    if (!latestView || latestFingerprint === renderedFingerprint) return false;
    renderPlayerProfilePanel(elements, latestView);
    renderedFingerprint = latestFingerprint;
    diagnostics.renders += 1;
    return true;
  };
  const isOpen = () => Boolean(elements.popup && !elements.popup.hidden);
  const moveToTopLayer = () => {
    const body = elements.popup?.ownerDocument?.body;
    if (body && elements.popup.parentElement !== body) body.append(elements.popup);
  };
  const open = () => {
    if (!elements.popup) return false;
    moveToTopLayer();
    render();
    return openOverlay(elements.popup, {
      type: "modal",
      ariaModal: true,
      focusTarget: elements.card,
      restoreFocusOnClose: false,
      alwaysOnTop: true
    });
  };
  const close = () => {
    if (!elements.popup) return false;
    elements.popup.hidden = true;
    elements.popup.classList?.add("hidden");
    return closeOverlay(elements.popup, { restoreFocus: false });
  };
  const onOpenClick = () => open();
  const onCloseClick = () => close();
  const onKeydown = (event) => {
    if (event.key === "Escape" && isOpen()) close();
  };

  const mount = () => {
    if (mounted) return false;
    const scope = documentRef || root;
    eventScope = scope;
    elements = collectElements(scope);
    closeElements = Array.from(scope?.querySelectorAll?.(PLAYER_POPUP_CLOSE_SELECTOR) || []);
    elements.openButton?.addEventListener?.("click", onOpenClick);
    for (const element of closeElements) element.addEventListener("click", onCloseClick);
    scope?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  const update = (readModel) => {
    if (!mounted) return 0;
    const nextView = createServerPlayerProfileView(readModel);
    if (!nextView) return 0;
    const nextFingerprint = JSON.stringify(nextView);
    diagnostics.updates += 1;
    if (nextFingerprint === latestFingerprint) return 0;
    latestView = nextView;
    latestFingerprint = nextFingerprint;
    return renderedFingerprint === "" || isOpen() ? Number(render()) : 0;
  };

  const destroy = () => {
    if (!mounted) return false;
    elements.openButton?.removeEventListener?.("click", onOpenClick);
    for (const element of closeElements) element.removeEventListener("click", onCloseClick);
    eventScope?.removeEventListener?.("keydown", onKeydown);
    if (isOpen()) close();
    elements = {};
    eventScope = null;
    closeElements = [];
    latestView = null;
    latestFingerprint = "";
    renderedFingerprint = "";
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open,
    close,
    getDiagnostics: () => ({ ...diagnostics, mounted })
  };
}

export function createServerPlayerProfileView(readModel) {
  const player = readModel?.player;
  if (!player?.economy) return null;
  const leaderboardEntry = readModel?.leaderboard?.currentPlayer
    || readModel?.leaderboard?.entries?.find?.((entry) => (
      entry?.isCurrentPlayer || String(entry?.playerId) === String(player.playerId)
    ))
    || null;
  const identity = String(player.profile?.displayName || leaderboardEntry?.name || player.playerId || "—");
  const gangName = String(player.profile?.gangName || leaderboardEntry?.gangName || identity);
  const police = readModel.police || player.police || null;
  const districtCount = (readModel.districts || []).filter((district) => (
    district?.isOwnedByPlayer || String(district?.ownerPlayerId) === String(player.playerId)
  )).length;

  return createPlayerProfileViewModel({
    registration: {
      identity,
      gangName,
      factionId: player.factionId,
      serverLabel: readModel.server?.serverInstanceId || player.instanceId || "—"
    },
    faction: player.faction || {
      name: String(player.factionId || "—")
    },
    displaySnapshot: {
      cleanMoney: player.economy.cleanCash,
      dirtyMoney: player.economy.dirtyCash,
      influence: player.economy.influence
    },
    gangState: {
      heat: police?.heat ?? police?.playerHeat ?? 0
    },
    districtCount,
    empireScore: leaderboardEntry?.score ?? null,
    allianceLabel: player.alliance?.allianceName || leaderboardEntry?.allianceTag || "Žádná",
    avatarSrc: player.avatarSrc
      || player.avatarUrl
      || resolveLivePlayerAvatarSrc(player.profile?.avatarId || leaderboardEntry?.avatarId, player.factionId),
    accentColor: player.color || player.faction?.uiTheme?.accent || "#22d3ee",
    protectionLabel: formatProtectionLabel(police?.protection)
  });
}

function collectElements(scope) {
  return {
    openButton: scope?.querySelector?.(PLAYER_PROFILE_OPEN_SELECTOR) || null,
    popup: scope?.querySelector?.(PLAYER_POPUP_SELECTOR) || null,
    card: scope?.querySelector?.(PLAYER_POPUP_CARD_SELECTOR) || null,
    avatar: scope?.querySelector?.(PLAYER_POPUP_AVATAR_SELECTOR) || null,
    avatarFallback: scope?.querySelector?.(PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR) || null,
    name: scope?.querySelector?.("[data-player-popup-name]") || null,
    identity: scope?.querySelector?.(PLAYER_POPUP_IDENTITY_SELECTOR) || null,
    faction: scope?.querySelector?.(PLAYER_POPUP_FACTION_SELECTOR) || null,
    server: scope?.querySelector?.(PLAYER_POPUP_SERVER_SELECTOR) || null,
    empireScore: scope?.querySelector?.(PLAYER_POPUP_EMPIRE_SCORE_SELECTOR) || null,
    cleanMoney: scope?.querySelector?.(PLAYER_POPUP_CLEAN_MONEY_SELECTOR) || null,
    dirtyMoney: scope?.querySelector?.(PLAYER_POPUP_DIRTY_MONEY_SELECTOR) || null,
    influence: scope?.querySelector?.(PLAYER_POPUP_INFLUENCE_SELECTOR) || null,
    heat: scope?.querySelector?.(PLAYER_POPUP_HEAT_SELECTOR) || null,
    protection: scope?.querySelector?.(PLAYER_POPUP_PROTECTION_SELECTOR) || null,
    gang: scope?.querySelector?.(PLAYER_POPUP_GANG_SELECTOR) || null,
    alliance: scope?.querySelector?.(PLAYER_POPUP_ALLIANCE_SELECTOR) || null,
    districts: scope?.querySelector?.(PLAYER_POPUP_DISTRICTS_SELECTOR) || null
  };
}

function formatProtectionLabel(protection) {
  const multiplier = Number(protection?.raidConsequenceMultiplier);
  if (!Number.isFinite(multiplier) || multiplier >= 1) return "Bez ochrany";
  return `Ochrana ${Math.max(0, Math.round((1 - multiplier) * 100))} %`;
}
