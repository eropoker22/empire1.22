import {
  closeOverlay,
  openOverlay
} from "../ui/legacyOverlayCoordinator.js";

export function createBuildingsPopupRuntime(deps = {}) {
  const elements = deps.elements || {};
  let activeBuildingsDistrictType = null;
  const selectedBuildingBaseNameByType = new Map();

  const getGeometry = typeof deps.getGeometry === "function" ? deps.getGeometry : () => null;
  const getInteractionState = typeof deps.getInteractionState === "function" ? deps.getInteractionState : () => ({});
  const getCurrentPlayerOwnedDistrictIds = typeof deps.getCurrentPlayerOwnedDistrictIds === "function"
    ? deps.getCurrentPlayerOwnedDistrictIds
    : () => new Set();
  const isLivePhase = (interactionState = {}) => String(interactionState.gamePhase || "launch").trim().toLowerCase() === "live";

  const renderDistrictPopupBuildings = (district) => {
    if (!district) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "Bez dat",
        emptyText: "Budovy pro tento distrikt nejsou dostupné."
      });
      return;
    }

    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const isHidden = isLaunchPhase && deps.isDistrictTypeHidden(district, interactionState) && !isOwnedByCurrentPlayer;
    const isDestroyed = interactionState.destroyedDistrictIds?.has?.(Number(district.id));

    if (isDestroyed) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "Spálený blok",
        emptyText: "V tomhle districtu po totálním zničení nezůstalo nic použitelného."
      });
      return;
    }

    if (isHidden) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "Nezjištěno",
        emptyText: "Bez spy nebo vlastnictví zatím nevíš, jaké budovy jsou v tomto distriktu."
      });
      return;
    }

    const buildingProfile = deps.resolveDistrictBuildingProfile(district);
    if (!buildingProfile || buildingProfile.buildings.length <= 0) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "Prázdný set",
        emptyText: "Tento distrikt teď nemá přiřazené žádné budovy."
      });
      return;
    }

    const trapControlState = deps.getDistrictTrapControlState(district);
    deps.renderDistrictBuildingList({
      section: elements.popupBuildings,
      meta: elements.popupBuildingsMeta,
      list: elements.popupBuildingsList
    }, {
      metaText: `${buildingProfile.setTitle} · ${deps.formatDistrictBuildingTierLabel(buildingProfile.tier)}`,
      buildings: buildingProfile.buildings.map((building) => ({
        name: building.baseName || building.displayName,
        displayName: building.displayName
      })),
      trap: {
        visible: trapControlState.buildingVisible,
        label: trapControlState.buildingLabel || "Toxická past",
        meta: trapControlState.buildingMeta || "aktivní"
      }
    });
  };

  const getSourceDistrictsForBuildingType = (typeKey = "") => {
    const geometry = getGeometry();
    if (!geometry?.districts?.length) {
      return [];
    }

    const interactionState = getInteractionState();
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);

    return geometry.districts
      .filter((district) => !typeKey || district.districtType === typeKey)
      .filter((district) => !isLaunchPhase || currentPlayerOwnedDistrictIds.has(Number(district.id)))
      .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0));
  };

  const getOwnedDistrictCountForBuildingType = (typeKey = "") => {
    const geometry = getGeometry();
    if (!geometry?.districts?.length) {
      return 0;
    }
    const interactionState = getInteractionState();
    if (isLivePhase(interactionState)) {
      return geometry.districts
        .filter((district) => !typeKey || district.districtType === typeKey)
        .length;
    }
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    return geometry.districts
      .filter((district) => !typeKey || district.districtType === typeKey)
      .filter((district) => currentPlayerOwnedDistrictIds.has(Number(district.id)))
      .length;
  };

  const getFirstAvailableBuildingDistrictType = () =>
    deps.districtBuildingTypeOrder.find((typeKey) => getOwnedDistrictCountForBuildingType(typeKey) > 0)
    || deps.districtBuildingTypeOrder[0];

  const getBuildingEntriesForDistrictType = (typeKey = "") => {
    const districts = getSourceDistrictsForBuildingType(typeKey);
    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const treatAllBuildingsAsOwned = isLivePhase(interactionState);
    const entries = [];

    for (const district of districts) {
      const buildingProfile = deps.resolveDistrictBuildingProfile(district);
      if (!buildingProfile?.buildings?.length) {
        continue;
      }

      for (const building of buildingProfile.buildings) {
        const baseName = String(building.baseName || building.displayName || "Neznámá budova").trim() || "Neznámá budova";
        const displayName = String(building.displayName || baseName).trim() || baseName;
        const districtLabel = buildingProfile.districtLabel || `District ${district.id}`;

        entries.push({
          baseName,
          displayName,
          variantName: building.variantName || (displayName !== baseName ? displayName : null),
          districtId: Number(district.id) || 0,
          districtLabel,
          districtType: buildingProfile.typeKey,
          isOwnedByCurrentPlayer: treatAllBuildingsAsOwned || currentPlayerOwnedDistrictIds.has(Number(district.id)),
          setTitle: buildingProfile.setTitle,
          tier: buildingProfile.tier
        });
      }
    }

    return entries.sort((left, right) =>
      left.baseName.localeCompare(right.baseName, "cs", { sensitivity: "base" })
      || Number(left.districtId || 0) - Number(right.districtId || 0)
    );
  };

  const renderBuildingsPopupTypes = (selectedType) => {
    deps.renderBuildingsPopupTypesPanel(elements.buildingsPopupTypeMount, {
      activeLabel: deps.districtBuildingTypeMeta[selectedType]?.label || "",
      types: deps.districtBuildingTypeOrder.map((typeKey) => {
        const meta = deps.districtBuildingTypeMeta[typeKey] || deps.districtBuildingTypeMeta.resident;
        const districtCount = getSourceDistrictsForBuildingType(typeKey).length;
        const ownedDistrictCount = getOwnedDistrictCountForBuildingType(typeKey);
        const disabled = districtCount <= 0;
        return {
          typeKey,
          label: meta.shortLabel,
          districtCount,
          ownedDistrictCount,
          disabled,
          meta: ownedDistrictCount > 0 ? `(${ownedDistrictCount})` : "",
          active: typeKey === selectedType
        };
      })
    });
  };

  const renderBuildingsPopupDetail = (selectedType) => {
    if (!selectedType || !deps.districtBuildingTypeMeta[selectedType]) {
      deps.renderBuildingsPopupDetailPanel(elements.buildingsPopupDetailMount, {
        title: "Vyber typ districtu",
        emptyText: "Po výběru typu uvidíš odemčené typy budov a konkrétní pojmenované budovy v tvých districtech."
      });
      return;
    }

    const meta = deps.districtBuildingTypeMeta[selectedType] || deps.districtBuildingTypeMeta.resident;
    const isLaunchPhase = (getInteractionState().gamePhase || "launch") === "launch";
    const entries = getBuildingEntriesForDistrictType(selectedType);
    const groupedByBaseName = new Map();

    for (const entry of entries) {
      const existing = groupedByBaseName.get(entry.baseName) || {
        baseName: entry.baseName,
        count: 0
      };

      existing.count += 1;
      groupedByBaseName.set(entry.baseName, existing);
    }

    const baseTypes = Array.from(groupedByBaseName.values()).sort((left, right) =>
      left.baseName.localeCompare(right.baseName, "cs", { sensitivity: "base" })
    );
    const selectedBaseName = String(selectedBuildingBaseNameByType.get(selectedType) || "").trim();
    const activeBaseName = baseTypes.some((entry) => entry.baseName === selectedBaseName)
      ? selectedBaseName
      : (baseTypes[0]?.baseName || "");
    const scopedEntries = activeBaseName
      ? entries
        .filter((entry) => entry.baseName === activeBaseName)
        .sort((left, right) => Number(left.districtId || 0) - Number(right.districtId || 0))
      : [];

    if (activeBaseName) {
      selectedBuildingBaseNameByType.set(selectedType, activeBaseName);
    } else {
      selectedBuildingBaseNameByType.delete(selectedType);
    }

    if (entries.length <= 0) {
      deps.renderBuildingsPopupDetailPanel(elements.buildingsPopupDetailMount, {
        selectedType,
        title: meta.label,
        copy: isLaunchPhase
          ? "Zobrazuje pouze budovy v districtech, které máš pod kontrolou."
          : "LIVE fáze zobrazuje všechny budovy vybraného typu districtu, jako by byly tvoje.",
        emptyText: isLaunchPhase
          ? "Zaber nebo kup district tohoto typu a tady se objeví jeho budovy."
          : "Na mapě teď nejsou dostupné žádné budovy pro tento typ districtu."
      });
      return;
    }

    deps.renderBuildingsPopupDetailPanel(elements.buildingsPopupDetailMount, {
      selectedType,
      title: meta.label,
      copy: isLaunchPhase
        ? "Zobrazuje pouze budovy v districtech, které máš pod kontrolou."
        : "LIVE fáze zobrazuje všechny budovy vybraného typu districtu, jako by byly tvoje.",
      baseTypes,
      activeBaseName,
      entries: scopedEntries,
      emptyVariantText: "Vyber typ budovy a zobrazí se její districty."
    });
  };

  const renderBuildingsPopup = (selectedType = activeBuildingsDistrictType) => {
    const nextType = selectedType && deps.districtBuildingTypeMeta[selectedType]
      ? selectedType
      : null;
    activeBuildingsDistrictType = nextType;
    renderBuildingsPopupTypes(nextType);
    renderBuildingsPopupDetail(nextType);
  };

  const closeBuildingsPopup = () => {
    if (elements.buildingsPopup) {
      closeOverlay(elements.buildingsPopup, { restoreFocus: false });
      elements.buildingsPopup.hidden = true;
    }
  };

  const openBuildingsPopup = () => {
    if (!elements.buildingsPopup) {
      return;
    }

    selectedBuildingBaseNameByType.clear();
    renderBuildingsPopup(null);
    elements.buildingsPopup.hidden = false;
    openOverlay(elements.buildingsPopup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    const ownerDocument = elements.buildingsPopup.ownerDocument || (typeof document !== "undefined" ? document : null);
    ownerDocument?.dispatchEvent?.(new CustomEvent("empire:buildings-popup-opened", { detail: { open: true } }));
  };

  return {
    closeBuildingsPopup,
    getActiveBuildingsDistrictType: () => activeBuildingsDistrictType,
    getBuildingEntriesForDistrictType,
    getFirstAvailableBuildingDistrictType,
    getOwnedDistrictCountForBuildingType,
    getSourceDistrictsForBuildingType,
    openBuildingsPopup,
    renderBuildingsPopup,
    renderBuildingsPopupDetail,
    renderBuildingsPopupTypes,
    renderDistrictPopupBuildings,
    selectBuildingsPopupBaseName(selectedType, selectedBaseName) {
      const typeKey = String(selectedType || activeBuildingsDistrictType || "").trim();
      const baseName = String(selectedBaseName || "").trim();
      if (!typeKey || !baseName) {
        return false;
      }
      selectedBuildingBaseNameByType.set(typeKey, baseName);
      return true;
    }
  };
}
