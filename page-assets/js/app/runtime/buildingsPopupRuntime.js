import {
  closeOverlay,
  openOverlay
} from "../ui/legacyOverlayCoordinator.js";
import { getAssetPath } from "../../config.js";

const BUILDINGS_POPUP_BACKGROUND_BY_DISTRICT_TYPE = Object.freeze({
  commercial: getAssetPath("budovy/com.png"),
  downtown: getAssetPath("budovy/dow.png"),
  economy: getAssetPath("budovy/com.png"),
  industrial: getAssetPath("budovy/indu.png"),
  park: getAssetPath("budovy/par.png"),
  resident: getAssetPath("budovy/res.png"),
  residential: getAssetPath("budovy/res.png")
});

const escapeCssUrl = (value) => String(value || "").replace(/"/g, '\\"');
const normalizeBuildingsDistrictType = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "parks" || normalizedValue === "park district") {
    return "park";
  }
  return normalizedValue;
};

const BUILDING_CHIP_ACTIVE_ACTION_NAMES = new Set([
  "bytovy blok",
  "centralni banka",
  "energeticka stanice",
  "herna",
  "kasino",
  "klinika",
  "letiste",
  "lobby club",
  "lobby klub",
  "magistrat",
  "parlament",
  "pasovaci tunel",
  "poulicni dealeri",
  "pristav",
  "recyklacni centrum",
  "restaurace",
  "skola",
  "smenarna",
  "strip club",
  "burza"
]);
const BUILDING_CHIP_PRODUCTION_NAMES = new Set(["drug lab", "lab", "lekarna", "tovarna", "zbrojovka"]);

const normalizeBuildingChipName = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const resolveBuildingChipKind = (buildingName) => {
  const normalizedName = normalizeBuildingChipName(buildingName);
  if (BUILDING_CHIP_PRODUCTION_NAMES.has(normalizedName)) {
    return "Výroba";
  }
  if (BUILDING_CHIP_ACTIVE_ACTION_NAMES.has(normalizedName)) {
    return "Spustit akci";
  }
  return "Pasivní bonus";
};

const isApartmentBlockBaseName = (buildingName) => normalizeBuildingChipName(buildingName) === "bytovy blok";

const createBuildingsPopupBackgroundStack = (backgroundImage) => backgroundImage
  ? `linear-gradient(rgba(3, 7, 18, 0.44), rgba(3, 7, 18, 0.58)), url("${escapeCssUrl(backgroundImage)}")`
  : "linear-gradient(rgba(3, 7, 18, 0.66), rgba(3, 7, 18, 0.78)), rgba(3, 7, 18, 0.92)";

export function createBuildingsPopupRuntime(deps = {}) {
  const elements = deps.elements || {};
  let activeBuildingsDistrictType = null;
  const selectedBuildingBaseNameByType = new Map();

  const getGeometry = typeof deps.getGeometry === "function" ? deps.getGeometry : () => null;
  const getInteractionState = typeof deps.getInteractionState === "function" ? deps.getInteractionState : () => ({});
  const getCurrentPlayerOwnedDistrictIds = typeof deps.getCurrentPlayerOwnedDistrictIds === "function"
    ? deps.getCurrentPlayerOwnedDistrictIds
    : () => new Set();
  const getResolvedSpyIntel = typeof deps.getResolvedSpyIntel === "function"
    ? deps.getResolvedSpyIntel
    : () => ({ revealedTypeDistrictIds: [] });
  const isApartmentBlockFull = typeof deps.isApartmentBlockFull === "function"
    ? deps.isApartmentBlockFull
    : () => false;
  const isDemoLiveBuildingCatalogUnlocked = typeof deps.isDemoLiveBuildingCatalogUnlocked === "function"
    ? deps.isDemoLiveBuildingCatalogUnlocked
    : () => false;

  const isLiveDemoCatalogUnlocked = (interactionState = getInteractionState()) => (
    String(interactionState?.gamePhase || "launch").trim().toLowerCase() === "live"
    && Boolean(isDemoLiveBuildingCatalogUnlocked(interactionState))
  );

  const isDestroyedDistrict = (district, interactionState = getInteractionState()) => (
    Boolean(interactionState.destroyedDistrictIds?.has?.(Number(district?.id)))
  );

  const getSelectedDistrictForBuildingsPopup = () => {
    const selectedDistrictId = getInteractionState().selectedDistrictId;
    if (selectedDistrictId === null || selectedDistrictId === undefined || selectedDistrictId === "") {
      return null;
    }
    return getGeometry()?.districts?.find((district) => Number(district.id) === Number(selectedDistrictId)) || null;
  };

  const syncBuildingsPopupBackground = (preferredDistrictType = activeBuildingsDistrictType) => {
    const card = elements.buildingsPopup?.querySelector?.(".buildings-popup-card.buildings-modal__content");
    if (!card) {
      return;
    }

    const selectedDistrict = getSelectedDistrictForBuildingsPopup();
    const selectedDistrictType = normalizeBuildingsDistrictType(selectedDistrict?.districtType || selectedDistrict?.zone || "");
    const activeDistrictType = normalizeBuildingsDistrictType(preferredDistrictType);
    const districtType = activeDistrictType;
    card.dataset.buildingsSelectedDistrictId = selectedDistrict?.id !== undefined ? String(selectedDistrict.id) : "";
    card.dataset.buildingsSelectedDistrictType = selectedDistrictType || "";
    card.dataset.buildingsActiveDistrictType = activeDistrictType || "";
    card.style.removeProperty("--buildings-popup-background-image");

    if (!activeDistrictType) {
      card.dataset.buildingsBackgroundMode = "default";
      card.style.removeProperty("--buildings-popup-background-stack");
      card.style.removeProperty("background");
      card.style.removeProperty("background-size");
      card.style.removeProperty("background-position");
      card.style.removeProperty("background-repeat");
      return;
    }

    const backgroundImage = BUILDINGS_POPUP_BACKGROUND_BY_DISTRICT_TYPE[districtType] || "";
    const backgroundStack = createBuildingsPopupBackgroundStack(backgroundImage);
    card.dataset.buildingsBackgroundMode = backgroundImage ? districtType : "none";
    card.style.setProperty(
      "--buildings-popup-background-stack",
      backgroundStack
    );
    card.style.setProperty("background", backgroundStack, "important");
    card.style.setProperty("background-size", "cover, cover", "important");
    card.style.setProperty("background-position", "center, center", "important");
    card.style.setProperty("background-repeat", "no-repeat, no-repeat", "important");
  };

  const renderDistrictPopupBuildings = (district) => {
    if (!district) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "",
        emptyText: "Budovy pro tento distrikt nejsou dostupné."
      });
      return;
    }

    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const spyIntel = getResolvedSpyIntel() || {};
    const isRevealedBySpy = Array.isArray(spyIntel.revealedTypeDistrictIds)
      && spyIntel.revealedTypeDistrictIds.map(Number).includes(Number(district.id));
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const isHidden = isLaunchPhase && deps.isDistrictTypeHidden(district, interactionState) && !isOwnedByCurrentPlayer;
    const isDestroyed = interactionState.destroyedDistrictIds?.has?.(Number(district.id));
    const canShowBuildings = isOwnedByCurrentPlayer || isRevealedBySpy;

    if (isDestroyed) {
      deps.renderDistrictBuildingList({
        section: elements.popupBuildings,
        meta: elements.popupBuildingsMeta,
        list: elements.popupBuildingsList
      }, {
        metaText: "",
        emptyText: "V tomhle districtu po totálním zničení nezůstalo nic použitelného."
      });
      return;
    }

    if (isHidden || !canShowBuildings) {
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
        metaText: "",
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
      metaText: "",
      interactive: isOwnedByCurrentPlayer,
      buildings: buildingProfile.buildings.map((building) => ({
        name: building.baseName || building.displayName,
        label: building.baseName || building.displayName,
        displayName: building.displayName,
        kindLabel: resolveBuildingChipKind(building.baseName || building.displayName)
      })),
      trap: {
        visible: trapControlState.buildingVisible,
        label: trapControlState.buildingLabel || "Toxická past",
        meta: trapControlState.buildingMeta || "připraveno"
      }
    });
  };

  const getSourceDistrictsForBuildingType = (typeKey = "") => {
    const geometry = getGeometry();
    if (!geometry?.districts?.length) {
      return [];
    }

    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const demoLiveCatalogUnlocked = isLiveDemoCatalogUnlocked(interactionState);

    return geometry.districts
      .filter((district) => !typeKey || district.districtType === typeKey)
      .filter((district) => !isDestroyedDistrict(district, interactionState))
      .filter((district) => demoLiveCatalogUnlocked || currentPlayerOwnedDistrictIds.has(Number(district.id)))
      .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0));
  };

  const getOwnedDistrictCountForBuildingType = (typeKey = "") => {
    const geometry = getGeometry();
    if (!geometry?.districts?.length) {
      return 0;
    }
    const interactionState = getInteractionState();
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
    const demoLiveCatalogUnlocked = isLiveDemoCatalogUnlocked(interactionState);
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
          isOwnedByCurrentPlayer: currentPlayerOwnedDistrictIds.has(Number(district.id)),
          canOpenFromBuildingsPopup: demoLiveCatalogUnlocked || currentPlayerOwnedDistrictIds.has(Number(district.id)),
          apartmentIsFull: isApartmentBlockBaseName(baseName) && isApartmentBlockFull({ district, building, baseName, displayName }),
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
        const demoLiveCatalogUnlocked = isLiveDemoCatalogUnlocked();
        return {
          typeKey,
          label: meta.shortLabel,
          districtCount,
          ownedDistrictCount,
          disabled,
          meta: demoLiveCatalogUnlocked && districtCount > 0
            ? `(${districtCount})`
            : ownedDistrictCount > 0 ? `(${ownedDistrictCount})` : "",
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
    const entries = getBuildingEntriesForDistrictType(selectedType);
    const groupedByBaseName = new Map();

    for (const entry of entries) {
      const existing = groupedByBaseName.get(entry.baseName) || {
        baseName: entry.baseName,
        count: 0,
        apartmentIsFull: false
      };

      existing.count += 1;
      existing.apartmentIsFull = Boolean(existing.apartmentIsFull || entry.apartmentIsFull);
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
        copy: isLiveDemoCatalogUnlocked()
          ? "Zobrazuje všechny budovy na mapě."
          : "Zobrazuje pouze budovy v districtech, které máš pod kontrolou.",
        emptyText: isLiveDemoCatalogUnlocked()
          ? "V tomhle typu districtu nejsou žádné použitelné budovy."
          : "Zaber nebo kup district tohoto typu a tady se objeví jeho budovy."
      });
      return;
    }

    deps.renderBuildingsPopupDetailPanel(elements.buildingsPopupDetailMount, {
      selectedType,
      title: meta.label,
      copy: isLiveDemoCatalogUnlocked()
        ? "Zobrazuje všechny budovy na mapě."
        : "Zobrazuje pouze budovy v districtech, které máš pod kontrolou.",
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
    syncBuildingsPopupBackground(nextType);
    renderBuildingsPopupTypes(nextType);
    renderBuildingsPopupDetail(nextType);
  };

  const closeBuildingsPopup = () => {
    if (elements.buildingsPopup) {
      elements.buildingsPopup.hidden = true;
      closeOverlay(elements.buildingsPopup, { restoreFocus: false });
    }
  };

  const openBuildingsPopup = () => {
    if (!elements.buildingsPopup) {
      return;
    }

    selectedBuildingBaseNameByType.clear();
    deps.clearSelectedDistrict?.();
    renderBuildingsPopup(null);
    openOverlay(elements.buildingsPopup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    elements.buildingsPopup.hidden = false;
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
