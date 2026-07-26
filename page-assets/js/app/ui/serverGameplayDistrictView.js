const toLabel = (value, fallback = "—") => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized
    .replace(/[_-]+/gu, " ")
    .replace(/^./u, (character) => character.toUpperCase());
};

const findOwner = (readModel, ownerPlayerId) => {
  if (!ownerPlayerId) return null;
  const entries = [
    readModel?.leaderboard?.currentPlayer,
    ...(Array.isArray(readModel?.leaderboard?.entries) ? readModel.leaderboard.entries : [])
  ].filter(Boolean);
  return entries.find((entry) => String(entry?.playerId) === String(ownerPlayerId)) || null;
};

const action = (id, label, disabled, disabledReason, surfaceDataset, options = {}) => ({
  id,
  label,
  enabled: !disabled,
  reason: disabledReason || "",
  surfaceDataset,
  stacked: options.stacked === true,
  subtitle: options.subtitle || "",
  title: disabledReason || options.title || ""
});

const createTargetActions = (panel) => [
  ...(panel.spyTargets || []).map((target) => action(
    `spy:${target.districtId}`,
    `Špehovat · ${target.label}`,
    target.disabled,
    target.disabledReason,
    { spyTargetId: target.districtId }
  )),
  ...(panel.occupyTargets || []).map((target) => action(
    `occupy:${target.districtId}`,
    `Obsadit · ${target.label}`,
    target.disabled,
    target.disabledReason,
    { occupyTargetId: target.districtId }
  )),
  ...(panel.robTargets || []).map((target) => action(
    `rob:${target.districtId}`,
    `Vyloupit · ${target.label}`,
    target.disabled,
    target.disabledReason,
    { robTargetId: target.districtId }
  )),
  ...(panel.heistTargets || []).map((target) => action(
    `heist:${target.districtId}`,
    `Loupež · ${target.label}`,
    target.disabled,
    target.disabledReason,
    { heistTargetId: target.districtId }
  )),
  ...(panel.attackTargets || []).map((target) => action(
    `attack:${target.districtId}`,
    `Útok · ${target.label}`,
    target.disabled,
    target.disabledReason,
    { attackTargetId: target.districtId }
  ))
];

const createDistrictActions = (panel) => {
  const actions = createTargetActions(panel);
  if (panel.trap) {
    actions.unshift(action(
      "place-trap",
      panel.trap.actionLabel,
      panel.trap.disabled,
      panel.trap.disabledReason,
      { placeTrap: "true" },
      { subtitle: panel.trap.activeLabel || "" }
    ));
  }
  if (panel.placeDefense) {
    actions.unshift(action(
      "place-defense",
      panel.placeDefense.actionLabel,
      panel.placeDefense.disabled,
      panel.placeDefense.disabledReason,
      { placeDefense: "true" }
    ));
  }
  if (panel.removeDefense) {
    actions.unshift(action(
      "remove-defense",
      panel.removeDefense.actionLabel,
      panel.removeDefense.disabled,
      panel.removeDefense.disabledReason,
      { removeDefense: "true" }
    ));
  }
  return actions;
};

export function createServerGameplayDistrictView(readModel, renderState) {
  const panel = renderState?.districtPanel;
  const district = readModel?.district;
  if (
    !panel
    || !district
    || String(panel.districtId) !== String(district.districtId)
  ) {
    return null;
  }

  const owner = findOwner(readModel, district.ownerPlayerId);
  const isOwnedByPlayer = district.isOwnedByPlayer === true;
  const ownerLabel = district.ownerPlayerId
    ? String(owner?.name || owner?.displayName || district.ownerPlayerId)
    : "Neobsazeno";
  const currentPlayerOwnsDistrict = isOwnedByPlayer
    || String(district.ownerPlayerId || "") === String(readModel?.player?.playerId || "");
  const ownerAvatarSrc = currentPlayerOwnsDistrict
    ? String(readModel?.player?.avatarSrc || readModel?.player?.avatarUrl || "")
    : String(owner?.avatarSrc || owner?.avatarUrl || "");
  const statusLabel = toLabel(panel.statusLabel, "Neznámý");
  const allianceLabel = String(owner?.allianceTag || "").trim();

  return {
    districtId: String(panel.districtId),
    districtType: String(district.zone || ""),
    title: panel.title || district.name || "District",
    typeLabel: panel.zoneLabel || toLabel(district.zone, "District"),
    ownerLabel,
    ownerMeta: `${panel.ownershipLabel || "Vlastnictví neznámé"} · ${statusLabel}`,
    ownerAvatarSrc,
    ownerAvatarEmpty: !ownerAvatarSrc,
    ownerAvatarHidden: !district.ownerPlayerId,
    ownerFallback: "",
    allianceLabel: allianceLabel ? `Aliance: ${allianceLabel}` : "",
    atmosphereLabel: panel.zoneLabel || toLabel(district.zone, "District"),
    atmosphereMood: `${statusLabel} · Hledanost ${panel.heatLabel}`,
    flags: [
      {
        label: statusLabel,
        tone: district.status === "destroyed"
          ? "danger"
          : currentPlayerOwnsDistrict ? "positive" : "neutral"
      },
      { label: `Hledanost ${panel.heatLabel}`, tone: Number(district.heat || 0) > 0 ? "warning" : "neutral" },
      { label: `Vliv ${panel.influenceLabel}`, tone: "info" }
    ],
    metrics: [
      { label: "Hledanost", value: panel.heatLabel },
      { label: "Vliv", value: panel.influenceLabel },
      { label: "Stav", value: statusLabel },
      { label: "Budovy", value: panel.buildingSummary }
    ],
    buildings: (panel.buildings || []).map((building) => ({
      buildingId: building.buildingId,
      buildingTypeId: building.buildingTypeId,
      name: building.buildingId,
      displayName: building.label,
      label: building.label,
      kindLabel: building.typeLabel || building.statusLabel || "Budova",
      detail: building
    })),
    buildingMetaText: panel.buildingSummary,
    actions: createDistrictActions(panel),
    actionHidden: district.status === "destroyed",
    actionEmptyText: panel.hasPendingCommand
      ? "Akce se zpracovává na serveru."
      : "Pro tento district teď není dostupná žádná akce."
  };
}
