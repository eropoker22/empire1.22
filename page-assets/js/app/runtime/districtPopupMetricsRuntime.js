function getOwnerDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const ownerDocument = getOwnerDocument(scopeElement);
  if (!ownerDocument || typeof ownerDocument.createElement !== "function") {
    return null;
  }

  const element = ownerDocument.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

export function createDistrictPopupMetricsRuntime(deps = {}) {
  const elements = deps.elements || {};
  const getInteractionState = typeof deps.getInteractionState === "function" ? deps.getInteractionState : () => ({});
  const getCurrentPlayerOwnedDistrictIds = typeof deps.getCurrentPlayerOwnedDistrictIds === "function"
    ? deps.getCurrentPlayerOwnedDistrictIds
    : () => new Set();

  const getDistrictDefenseState = (districtId) => {
    const normalizedDistrictId = Number(districtId);
    const worldState = deps.getResolvedWorldState();
    const loadout = worldState.districtDefenseLoadoutById?.[normalizedDistrictId] || {};
    const residents = Math.max(
      0,
      Number.parseInt(String(worldState.districtDefenseResidentsById?.[normalizedDistrictId] ?? 0), 10) || 0
    );
    const storedPower = Number.parseInt(String(worldState.districtDefenseById?.[normalizedDistrictId] ?? 0), 10) || 0;
    const calculatedPower = deps.calculateTotalDefensePower({ loadout, residents });

    return {
      loadout,
      residents,
      totalPower: Math.max(storedPower, calculatedPower)
    };
  };

  const getCurrentPlayerTrapDistrictId = () => {
    const trapEntries = Object.entries(deps.getResolvedWorldState().districtTrapById || {});
    const currentPlayerTrap = trapEntries.find(([, trap]) => trap?.isArmed && Number(trap.ownerId) === deps.currentPlayerId);
    return currentPlayerTrap ? Number(currentPlayerTrap[0]) : null;
  };

  const getCurrentPlayerTrapMoveCooldownSeconds = () => {
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();

    if (!currentTrapDistrictId) {
      return 0;
    }

    const trapState = deps.getResolvedWorldState().districtTrapById?.[currentTrapDistrictId];
    const lastTrapActionAt = trapState?.movedAt || trapState?.armedAt;

    if (!lastTrapActionAt) {
      return 0;
    }

    const remainingMs = new Date(lastTrapActionAt).getTime() + 25_000 - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  };

  const getDistrictTrapControlState = (district) => {
    if (!district) {
      return {
        visible: false,
        label: "Past",
        subtitle: "",
        title: "",
        buttonDisabled: true,
        isActiveHere: false,
        hasTrapElsewhere: false,
        moveLocked: false,
        buildingVisible: false,
        buildingLabel: "Toxická past",
        buildingMeta: "aktivní"
      };
    }

    const interactionState = getInteractionState();
    const ownedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = ownedDistrictIds.has(Number(district.id));
    const isDestroyed = interactionState.destroyedDistrictIds?.has?.(Number(district.id));
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const hasTrapHere = Number(currentTrapDistrictId) === Number(district.id);
    const hasTrapElsewhere = Number(currentTrapDistrictId) > 0 && Number(currentTrapDistrictId) !== Number(district.id);
    const moveLocked = hasTrapElsewhere && Number(trapMoveCooldownSeconds) > 0;
    const sourceDistrictLabel = hasTrapElsewhere ? `District ${currentTrapDistrictId}` : "";

    let label = "Past";
    let subtitle = "";
    let title = "";
    let buttonDisabled = true;

    if (!isOwnedByCurrentPlayer) {
      title = `Past lze nastražit jen na vlastním districtu ${district.id}.`;
    } else if (isDestroyed) {
      title = "Do zničeného districtu nelze nastražit past.";
    } else if (hasTrapHere) {
      label = "Past aktivní";
      subtitle = trapMoveCooldownSeconds > 0 ? `${trapMoveCooldownSeconds}s cooldown` : "v tomto districtu";
      title = trapMoveCooldownSeconds > 0
        ? `Past už v tomto districtu běží. Přesun bude možný za ${trapMoveCooldownSeconds}s.`
        : `V tomto districtu je nastražená tvoje past.`;
    } else if (moveLocked) {
      label = "Přesunout past";
      subtitle = `${trapMoveCooldownSeconds}s`;
      title = `Past je zamčená v ${sourceDistrictLabel}. Přesun bude možný za ${trapMoveCooldownSeconds}s.`;
    } else if (hasTrapElsewhere) {
      label = "Přesunout past";
      subtitle = sourceDistrictLabel;
      title = `Máš jen 1 past. Přesuneš ji z ${sourceDistrictLabel} do tohoto districtu.`;
      buttonDisabled = false;
    } else {
      title = "Nastraž 1 past do svého districtu.";
      buttonDisabled = false;
    }

    return {
      visible: isOwnedByCurrentPlayer,
      label,
      subtitle,
      title,
      buttonDisabled,
      isActiveHere: hasTrapHere,
      hasTrapElsewhere,
      moveLocked,
      buildingVisible: hasTrapHere,
      buildingLabel: "Toxická past",
      buildingMeta: trapMoveCooldownSeconds > 0 ? `aktivní • ${trapMoveCooldownSeconds}s` : "aktivní"
    };
  };

  const hasKnownDistrictDefense = (district) => {
    if (!district) {
      return false;
    }

    const interactionState = getInteractionState();
    const ownedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);

    if (ownedDistrictIds.has(Number(district.id))) {
      return true;
    }

    const spyIntel = deps.getResolvedSpyIntel();
    return spyIntel.revealedDefenseDistrictIds.includes(Number(district.id));
  };

  const renderDistrictDefenseSummary = (district) => {
    if (!district) {
      return;
    }

    const interactionState = getInteractionState();
    if (interactionState.destroyedDistrictIds?.has?.(Number(district.id))) {
      deps.renderDistrictMetricSummary({
        defense: elements.popupDefense,
        defensePower: elements.popupDefensePower,
        residents: elements.popupResidents
      }, {
        defenseLabel: "Rozpadlá",
        defensePowerLabel: "0",
        residentsLabel: "0"
      });
      return;
    }

    if (!hasKnownDistrictDefense(district)) {
      deps.renderDistrictMetricSummary({
        defense: elements.popupDefense,
        defensePower: elements.popupDefensePower,
        residents: elements.popupResidents
      }, {
        defenseLabel: "Neznámá",
        defensePowerLabel: "Neznámá",
        residentsLabel: "Neznámí"
      });
      return;
    }

    const { loadout, residents, totalPower } = getDistrictDefenseState(district.id);
    deps.renderDistrictMetricSummary({
      defense: elements.popupDefense,
      defensePower: elements.popupDefensePower,
      residents: elements.popupResidents
    }, {
      defenseLabel: deps.formatDefenseLoadout(loadout) || "Žádná",
      defensePowerLabel: String(totalPower),
      residentsLabel: String(residents)
    });
  };

  const renderDistrictEconomySummary = (district) => {
    if (!district) {
      deps.renderDistrictMetricSummary({
        income: elements.popupIncome,
        heat: elements.popupHeat,
        influence: elements.popupInfluence
      }, {
        incomeLabel: "Bez dat",
        heatLabel: "Bez dat",
        influenceLabel: "Bez dat"
      });
      return;
    }

    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const isHidden = isLaunchPhase && deps.isDistrictTypeHidden(district, interactionState) && !isOwnedByCurrentPlayer;
    const isDestroyed = interactionState.destroyedDistrictIds?.has?.(Number(district.id));
    const economySnapshot = deps.getDistrictEconomySnapshot(district);

    deps.renderDistrictMetricSummary({
      income: elements.popupIncome,
      heat: elements.popupHeat,
      influence: elements.popupInfluence
    }, {
      incomeLabel: deps.formatDistrictIncomeLabel(economySnapshot.totalHourlyIncome, {
        hidden: isHidden,
        destroyed: isDestroyed
      }),
      heatLabel: deps.formatDistrictHeatLabel(economySnapshot.passiveHeatPerDay, {
        hidden: isHidden,
        destroyed: isDestroyed
      }),
      influenceLabel: deps.formatDistrictInfluenceLabel(economySnapshot.totalInfluencePerHour, {
        hidden: isHidden,
        destroyed: isDestroyed
      })
    });
  };

  const renderDistrictPopupGossip = (district) => {
    if (!elements.popupGossip || !elements.popupGossipList) {
      return;
    }

    if (!district || !deps.isDistrictGossipDevOnlyMode()) {
      elements.popupGossip.hidden = true;
      elements.popupGossipList.replaceChildren();
      return;
    }

    const entries = typeof deps.ensureDistrictPassiveGossip === "function"
      ? deps.ensureDistrictPassiveGossip(district)
      : deps.getDistrictGossipEntries(district);
    const visibleEntries = entries.filter((entry) => String(entry?.text || "").trim());

    elements.popupGossip.hidden = visibleEntries.length <= 0;
    elements.popupGossipList.replaceChildren();

    if (visibleEntries.length <= 0) {
      return;
    }

    for (const entry of visibleEntries) {
      const item = createElement(elements.popupGossipList, "div", "district-popup-gossip__item");
      const text = createElement(elements.popupGossipList, "div", "district-popup-gossip__text");
      const metaRow = createElement(elements.popupGossipList, "div", "district-popup-gossip__meta-row");
      const badge = createElement(elements.popupGossipList, "span", `district-popup-gossip__badge district-popup-gossip__badge--${entry.intelLevel === "verified" ? "verified" : "rumor"}`);
      const meta = createElement(elements.popupGossipList, "span", "district-popup-gossip__meta");

      if (!item || !text || !metaRow || !badge || !meta) {
        continue;
      }

      text.textContent = entry.text;
      badge.textContent = entry.intelLevel === "verified" ? "OVĚŘENO" : "DRB";
      meta.textContent = deps.formatDistrictGossipTimestamp(entry.createdAt);

      metaRow.append(badge, meta);
      item.append(text, metaRow);
      elements.popupGossipList.append(item);
    }
  };

  const renderDistrictPopupFlags = (flags) => {
    deps.renderDistrictFlags(elements.popupFlags, flags);
  };

  return {
    getDistrictDefenseState,
    getCurrentPlayerTrapDistrictId,
    getCurrentPlayerTrapMoveCooldownSeconds,
    getDistrictTrapControlState,
    hasKnownDistrictDefense,
    renderDistrictDefenseSummary,
    renderDistrictEconomySummary,
    renderDistrictPopupGossip,
    renderDistrictPopupFlags
  };
}
