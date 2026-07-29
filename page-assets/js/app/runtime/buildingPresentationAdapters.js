import {
  resolveServerDistrictBuilding,
  toCanonicalServerDistrictId
} from "./serverDistrictSelectionCoordinator.js";

const normalizeName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ")
  .trim();

const findLocalPresentationBuilding = (localBuildings, serverBuilding) => {
  const serverNames = [
    serverBuilding?.buildingTypeId,
    serverBuilding?.label,
    serverBuilding?.displayName,
    serverBuilding?.variantName
  ].map(normalizeName).filter(Boolean);
  return localBuildings.find((building) => {
    const localNames = [
      building?.baseName,
      building?.displayName,
      building?.variantName
    ].map(normalizeName).filter(Boolean);
    return localNames.some((name) => serverNames.includes(name));
  }) || null;
};

const normalizeMechanicsType = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, "-")
  .replace(/^-+|-+$/gu, "");

const formatRecord = (value) => Object.entries(value || {})
  .filter(([, amount]) => Number(amount || 0) !== 0)
  .map(([key, amount]) => `${key} ${Number(amount) > 0 ? "+" : ""}${amount}`)
  .join(" · ");

const resolveActionSummary = (entry, primaryKey, fallbackKey) => {
  const primary = entry?.[primaryKey];
  if (Array.isArray(primary)) {
    return primary.filter(Boolean).join(" · ");
  }
  return String(primary || entry?.[fallbackKey] || "").trim();
};

const createServerBuildingActionPresentation = (entry, index, buildingTypeId, tickRateMs) => {
  const cooldownTicks = Math.max(0, Number(entry?.cooldownRemainingTicks || 0));
  const cooldownRemainingMs = Math.max(
    0,
    Number(entry?.cooldownRemainingMs || 0) || cooldownTicks * Math.max(1, Number(tickRateMs || 1))
  );
  const disabledReason = String(
    entry?.disabledReason
    || entry?.blockedReason
    || entry?.phaseBlockedReason
    || ""
  ).trim();
  const costSummary = resolveActionSummary(entry, "inputSummary", "description")
    || formatRecord(entry?.effectiveInputCost || entry?.inputCost || entry?.cost);
  const rewardSummary = resolveActionSummary(entry, "outputSummary", "effectSummary")
    || resolveActionSummary(entry, "expectedEffectSummary", "reportText")
    || formatRecord(entry?.effectiveOutputGain || entry?.outputGain);

  return {
    index,
    actionId: String(entry?.actionId || ""),
    buildingTypeId: String(buildingTypeId || ""),
    title: String(entry?.label || entry?.actionId || "Akce"),
    buttonCostLabel: costSummary,
    rewardSummary,
    cooldownLabel: String(entry?.cooldownLabel || ""),
    cooldownRemainingMs,
    disabled: entry?.enabled === false || Boolean(disabledReason),
    disabledReason,
    phaseLockLabel: String(entry?.phaseBadgeLabel || ""),
    requiresInput: Array.isArray(entry?.requiresInput) ? entry.requiresInput : [],
    serverAction: entry
  };
};

const createServerBuildingDetailView = ({
  building,
  district,
  localBuilding,
  readModel,
  renderState
}) => {
  const panelBuilding = renderState?.districtPanel?.buildings?.find?.(
    (entry) => String(entry?.buildingId || "") === String(building?.buildingId || "")
  ) || building;
  const actionEntries = [
    ...(Array.isArray(panelBuilding?.actions) ? panelBuilding.actions : []),
    ...(Array.isArray(panelBuilding?.specialActions) ? panelBuilding.specialActions : [])
  ];
  const uniqueActions = Array.from(new Map(actionEntries
    .filter((entry) => entry?.actionId)
    .map((entry) => [String(entry.actionId), entry])).values());
  const tickRateMs = Math.max(1, Number(readModel?.mode?.tickRateMs || 1));
  const slot = renderState?.districtPanel?.slots?.find?.(
    (entry) => String(entry?.buildingId || "") === String(building?.buildingId || "")
  ) || null;
  const displayName = String(
    building?.displayName
    || localBuilding?.displayName
    || building?.label
    || localBuilding?.baseName
    || "Budova"
  ).trim();
  const baseName = String(
    localBuilding?.baseName
    || building?.label
    || displayName
  ).trim();
  const status = String(building?.status || panelBuilding?.status || "").trim();
  const level = Math.max(1, Number(building?.level || panelBuilding?.level || 1));
  const phaseEffects = [
    panelBuilding?.passivePhaseEffectLabel,
    panelBuilding?.passivePhaseTooltip,
    ...(Array.isArray(panelBuilding?.phaseEffectSummary) ? panelBuilding.phaseEffectSummary : []),
    ...(Array.isArray(panelBuilding?.specialActions)
      ? panelBuilding.specialActions.flatMap((entry) => (
          Array.isArray(entry?.phaseEffectSummary)
            ? entry.phaseEffectSummary
            : [entry?.effectSummary]
        ))
      : [])
  ].filter(Boolean);
  const mechanics = [
    panelBuilding?.role ? { label: "Role", value: panelBuilding.role } : null,
    status ? { label: "Stav", value: status } : null,
    panelBuilding?.phaseBadgeLabel
      ? { label: "Fáze", value: panelBuilding.phaseBadgeLabel }
      : null
  ].filter(Boolean);
  const isOwnedByPlayer = district?.isOwnedByPlayer === true
    || String(district?.ownerPlayerId || "") === String(readModel?.player?.playerId || "");

  return {
    serverInstanceId: String(readModel?.server?.serverInstanceId || readModel?.player?.instanceId || ""),
    serverDistrictId: String(district?.districtId || ""),
    buildingId: String(building?.buildingId || ""),
    buildingTypeId: String(building?.buildingTypeId || ""),
    baseName,
    displayName,
    viewModel: {
      districtId: String(district?.districtId || ""),
      buildingId: String(building?.buildingId || ""),
      buildingTypeId: String(building?.buildingTypeId || ""),
      mechanicsType: normalizeMechanicsType(baseName || building?.buildingTypeId),
      districtType: String(district?.zone || ""),
      title: displayName,
      name: displayName,
      levelLabel: `L${level}`,
      meta: [
        String(district?.zone || "").trim(),
        status,
        `Server · L${level}`
      ].filter(Boolean).join(" · "),
      intro: String(panelBuilding?.info || ""),
      backgroundImagePath: localBuilding?.imagePath || null,
      stats: Array.isArray(panelBuilding?.stats) ? panelBuilding.stats : [],
      mechanics,
      effects: phaseEffects,
      actions: uniqueActions.map((entry, index) => (
        createServerBuildingActionPresentation(entry, index, building?.buildingTypeId, tickRateMs)
      )),
      collect: slot?.production ? {
        visible: true,
        enabled: slot.production.canCollect === true,
        title: String(
          slot.production.collectDisabledReason
          || slot.production.storageLabel
          || ""
        )
      } : { visible: false, enabled: false, title: "" },
      upgrade: {
        visible: isOwnedByPlayer && status !== "destroyed",
        disabled: false,
        title: "Upgrade ověří a potvrdí server."
      },
      showActionsInSinglePanel: true
    }
  };
};

export class LocalDemoBuildingPresentationAdapter {
  constructor({ resolveDistrictBuildingProfile } = {}) {
    this.resolveDistrictBuildingProfile = resolveDistrictBuildingProfile;
  }

  getDistrictPresentation(district) {
    const profile = this.resolveDistrictBuildingProfile?.(district) || null;
    return {
      canonicalDistrictId: toCanonicalServerDistrictId(district),
      destroyed: null,
      intelKnown: null,
      isOwnedByPlayer: null,
      profile
    };
  }
}

export class ServerBuildingPresentationAdapter {
  constructor({ getReadModel, resolveDistrictBuildingProfile } = {}) {
    this.getReadModel = getReadModel;
    this.resolveDistrictBuildingProfile = resolveDistrictBuildingProfile;
  }

  getDistrictPresentation(district) {
    const canonicalDistrictId = toCanonicalServerDistrictId(district);
    const readModel = this.getReadModel?.() || null;
    const serverDistrict = readModel?.district || null;
    if (!canonicalDistrictId || String(serverDistrict?.districtId || "") !== canonicalDistrictId) {
      return {
        canonicalDistrictId,
        destroyed: false,
        intelKnown: false,
        isOwnedByPlayer: false,
        profile: null,
        readModel: null
      };
    }

    const localProfile = this.resolveDistrictBuildingProfile?.(district) || null;
    const localBuildings = Array.isArray(localProfile?.buildings) ? localProfile.buildings : [];
    const serverBuildings = Array.isArray(serverDistrict.buildings) ? serverDistrict.buildings : [];
    const profile = {
      ...(localProfile || {
        districtId: Number(district?.id || 0),
        districtLabel: `District ${district?.id || ""}`,
        typeKey: serverDistrict.zone || district?.districtType || "",
        typeLabel: serverDistrict.zone || district?.districtType || "",
        typeShortLabel: serverDistrict.zone || district?.districtType || "",
        setKey: "",
        setTitle: "",
        tier: ""
      }),
      buildings: serverBuildings.map((building) => {
        const localBuilding = findLocalPresentationBuilding(localBuildings, building);
        const baseName = String(building?.label || localBuilding?.baseName || building?.displayName || "Budova").trim();
        const displayName = String(building?.displayName || localBuilding?.displayName || baseName).trim();
        return {
          ...(localBuilding || {}),
          baseName,
          buildingId: String(building?.buildingId || ""),
          buildingTypeId: String(building?.buildingTypeId || ""),
          displayName,
          imagePath: localBuilding?.imagePath || null,
          level: Math.max(0, Number(building?.level || 0)),
          serverBuilding: building,
          status: String(building?.status || ""),
          variantName: building?.variantName || (displayName !== baseName ? displayName : null)
        };
      })
    };

    return {
      canonicalDistrictId,
      destroyed: serverDistrict.status === "destroyed",
      intelKnown: serverDistrict.intelKnown === true,
      isOwnedByPlayer: serverDistrict.isOwnedByPlayer === true
        || String(serverDistrict.ownerPlayerId || "") === String(readModel?.player?.playerId || ""),
      profile,
      readModel
    };
  }

  getBuilding(district, request) {
    const presentation = this.getDistrictPresentation(district);
    return presentation.readModel
      ? resolveServerDistrictBuilding(presentation.readModel, request)
      : null;
  }

  getBuildingDetailPresentation(district, request, { renderState } = {}) {
    const presentation = this.getDistrictPresentation(district);
    if (!presentation.readModel) {
      return null;
    }
    const building = resolveServerDistrictBuilding(presentation.readModel, request);
    if (!building) {
      return null;
    }
    const localBuilding = presentation.profile?.buildings?.find?.(
      (entry) => String(entry?.buildingId || "") === String(building.buildingId || "")
    ) || null;
    return createServerBuildingDetailView({
      building,
      district: presentation.readModel.district,
      localBuilding,
      readModel: presentation.readModel,
      renderState
    });
  }
}
