import { resolvePlayerIdentityPresentation } from "./playerProfileViewModel.js";

const DEFAULT_GANG_PROFILE_PLAYER_COLOR = "#67e8f9";

function resolveGangProfilePlayerColor(deps, identityPresentation) {
  return deps.normalizeRuntimeHexColor?.(identityPresentation?.accentColor)
    || deps.getRegistrationAccentColor?.(identityPresentation?.factionId || "mafian")
    || DEFAULT_GANG_PROFILE_PLAYER_COLOR;
}

function applyGangProfilePlayerColor(root, deps, identityPresentation) {
  const color = resolveGangProfilePlayerColor(deps, identityPresentation);
  root?.style?.setProperty?.("--gang-profile-player-color", color);
  root?.querySelector?.("#profile-gang-card")?.style?.setProperty?.("--gang-profile-player-color", color);
}

function resolveOwnedDistrictCount(deps, serverPlayer) {
  const authoritativeCount = serverPlayer?.operationalLiveness?.ownedDistrictCount;
  if (authoritativeCount !== null
    && authoritativeCount !== undefined
    && Number.isFinite(Number(authoritativeCount))) {
    return Math.max(0, Math.floor(Number(authoritativeCount)));
  }
  return Math.max(0, Math.floor(Number(deps.getCurrentPlayerDistrictSourceSnapshot?.()?.districtCount) || 0));
}

export function createRegisteredPlayerStateRuntime(deps = {}) {
  const bindRegisteredPlayerState = (root) => {
    if (!root) {
      return;
    }

    const scope = root.ownerDocument
      || deps.documentRef
      || (typeof document === "undefined" ? null : document);
    const windowRef = scope?.defaultView
      || deps.windowRef
      || (typeof window === "undefined" ? null : window);
    const topbarInfluence = scope?.querySelector?.(deps.topbarInfluenceSelector);
    const gangFaction = root.querySelector?.("[data-gang-faction]");
    const gangHeat = root.querySelector?.(deps.gangHeatSelector);
    const playerAvatar = scope?.querySelector?.(deps.playerPopupAvatarSelector);
    const playerName = scope?.querySelector?.("[data-player-popup-name]");
    const playerIdentity = scope?.querySelector?.(deps.playerPopupIdentitySelector);
    const playerGang = scope?.querySelector?.(deps.playerPopupGangSelector);
    const playerFaction = scope?.querySelector?.(deps.playerPopupFactionSelector);
    const playerServer = scope?.querySelector?.(deps.playerPopupServerSelector);

    deps.renderGangMembersState?.(root);

    const syncRegisteredPlayerState = ({ instant = false } = {}) => {
      const registration = deps.getStoredRegistration?.() || null;
      const serverPlayer = deps.getServerPlayerView?.() || null;
      const identityPresentation = (deps.resolvePlayerIdentityPresentation || resolvePlayerIdentityPresentation)({
        factionCatalog: deps.factionCatalog,
        registration,
        resolveServerAvatarSrc: deps.resolveServerPlayerAvatarSrc,
        serverPlayer
      });
      const faction = identityPresentation.faction;

      applyGangProfilePlayerColor(root, deps, identityPresentation);
      deps.applyTopbarEconomy?.(root, instant ? { instant: true } : undefined);

      const displayedResourceSnapshot = deps.getDisplayedResourceSnapshot?.();
      if (topbarInfluence && displayedResourceSnapshot) {
        topbarInfluence.dataset.influenceValue = String(displayedResourceSnapshot.influence);
      }

      deps.renderSpyResourceState?.(root, instant ? { instant: true } : undefined);

      if (gangFaction && faction) {
        gangFaction.textContent = faction.name;
      }

      if (playerAvatar && identityPresentation.avatarSrc) {
        playerAvatar.src = identityPresentation.avatarSrc;
        playerAvatar.classList?.remove?.("is-empty");
      }

      deps.syncCurrentPlayerDistrictCountDisplays?.(root, resolveOwnedDistrictCount(deps, serverPlayer));

      if (gangHeat) {
        gangHeat.textContent = String(deps.getResolvedGangState?.()?.heat ?? 0);
      }

      if (playerName) {
        playerName.textContent = identityPresentation.displayName;
      }

      if (playerIdentity) {
        playerIdentity.textContent = identityPresentation.displayName;
      }

      if (playerGang) {
        playerGang.textContent = identityPresentation.gangName;
      }

      if (playerFaction && faction) {
        playerFaction.textContent = faction.name;
      }

      if (playerServer) {
        playerServer.textContent = registration?.serverLabel
          || registration?.serverId
          || serverPlayer?.instanceId
          || "-";
      }
    };

    scope?.addEventListener?.("empire:economy-state-changed", syncRegisteredPlayerState);
    scope?.addEventListener?.("empire:gang-state-changed", syncRegisteredPlayerState);
    scope?.addEventListener?.("empire:police-state-changed", syncRegisteredPlayerState);
    scope?.addEventListener?.("empire:world-state-changed", syncRegisteredPlayerState);
    scope?.addEventListener?.("empire:runtime-refresh", syncRegisteredPlayerState);
    windowRef?.addEventListener?.("empire:alliance-state-changed", syncRegisteredPlayerState);
    syncRegisteredPlayerState({ instant: true });
  };

  return {
    bindRegisteredPlayerState
  };
}
