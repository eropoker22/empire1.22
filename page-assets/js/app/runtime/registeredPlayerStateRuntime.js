const DEFAULT_GANG_PROFILE_PLAYER_COLOR = "#67e8f9";

function resolveGangProfilePlayerColor(deps, registration) {
  return deps.normalizeRuntimeHexColor?.(registration?.gangColor)
    || deps.getRegistrationAccentColor?.(registration?.factionId || "mafian")
    || DEFAULT_GANG_PROFILE_PLAYER_COLOR;
}

function applyGangProfilePlayerColor(root, deps, registration) {
  const color = resolveGangProfilePlayerColor(deps, registration);
  root?.style?.setProperty?.("--gang-profile-player-color", color);
  root?.querySelector?.("#profile-gang-card")?.style?.setProperty?.("--gang-profile-player-color", color);
}

export function createRegisteredPlayerStateRuntime(deps = {}) {
  const bindRegisteredPlayerState = (root) => {
    const registration = deps.getStoredRegistration();
    deps.renderGangMembersState(root);
    applyGangProfilePlayerColor(root, deps, registration);

    if (!registration?.factionId || !deps.factionCatalog?.[registration.factionId]) {
      return;
    }

    const faction = deps.factionCatalog[registration.factionId];
    const scope = root.ownerDocument || document;
    const topbarInfluence = scope.querySelector(deps.topbarInfluenceSelector);
    const gangFaction = root.querySelector("[data-gang-faction]");
    const gangHeat = root.querySelector(deps.gangHeatSelector);
    const playerName = scope.querySelector("[data-player-popup-name]");
    const playerIdentity = scope.querySelector(deps.playerPopupIdentitySelector);
    const playerGang = scope.querySelector(deps.playerPopupGangSelector);
    const playerFaction = scope.querySelector(deps.playerPopupFactionSelector);
    const playerServer = scope.querySelector(deps.playerPopupServerSelector);

    deps.applyTopbarEconomy(root, { instant: true });

    if (topbarInfluence) {
      topbarInfluence.dataset.influenceValue = String(deps.getDisplayedResourceSnapshot().influence);
    }

    deps.renderSpyResourceState(root, { instant: true });

    if (gangFaction) {
      gangFaction.textContent = faction.name;
    }

    deps.syncCurrentPlayerDistrictCountDisplays(root, deps.getCurrentPlayerDistrictSourceSnapshot().districtCount);

    if (gangHeat) {
      gangHeat.textContent = String(deps.getResolvedGangState().heat);
    }

    if (playerName) {
      playerName.textContent = registration.identity || "Host";
    }

    if (playerIdentity) {
      playerIdentity.textContent = registration.identity || "Host";
    }

    if (playerGang) {
      playerGang.textContent = registration.identity ? `${registration.identity} Crew` : "Guest Crew";
    }

    if (playerFaction) {
      playerFaction.textContent = faction.name;
    }

    if (playerServer) {
      playerServer.textContent = registration.serverLabel || registration.serverId || "-";
    }

    const syncGangOverview = () => {
      deps.applyTopbarEconomy(root);
      deps.renderSpyResourceState(root);
      deps.syncCurrentPlayerDistrictCountDisplays(root, deps.getCurrentPlayerDistrictSourceSnapshot().districtCount);
      if (gangHeat) {
        gangHeat.textContent = String(deps.getResolvedGangState().heat);
      }
    };

    document.addEventListener("empire:economy-state-changed", syncGangOverview);
    document.addEventListener("empire:gang-state-changed", syncGangOverview);
    document.addEventListener("empire:police-state-changed", syncGangOverview);
    document.addEventListener("empire:world-state-changed", syncGangOverview);
    document.addEventListener("empire:runtime-refresh", syncGangOverview);
    window.addEventListener("empire:alliance-state-changed", syncGangOverview);
  };

  return {
    bindRegisteredPlayerState
  };
}
