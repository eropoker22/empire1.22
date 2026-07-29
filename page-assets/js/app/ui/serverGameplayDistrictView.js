import { resolveDistrictBuildingChipKind } from "./districtBuildingChipKind.js";
import { resolveMapAtmosphereMeta } from "../map/mapDataAdapter.js";
import { resolveLivePlayerAvatarSrc } from "../model/livePlayerAvatarCatalog.js";

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

const resolveAtmosphereMeta = (district, intelKnown) => {
  const zoneAliases = { commercial: "economy", residential: "resident" };
  const zone = zoneAliases[district?.zone] || district?.zone;
  const meta = resolveMapAtmosphereMeta(zone, { hidden: !intelKnown });
  const imagePaths = Array.isArray(meta.imagePaths) ? meta.imagePaths : [];
  if (imagePaths.length === 0) return meta;

  const seed = `${meta.typeKey || "unknown"}:${district?.districtId || ""}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }
  return { ...meta, imagePath: imagePaths[hash % imagePaths.length] };
};

const action = (id, label, disabled, disabledReason, surfaceDataset, options = {}) => ({
  id,
  key: options.key || id,
  label,
  enabled: !disabled,
  reason: disabledReason || "",
  surfaceDataset,
  stacked: options.stacked === true,
  subtitle: options.subtitle || "",
  targetDistrictId: options.targetDistrictId || "",
  title: disabledReason || options.title || ""
});

const createTargetActions = (targetActions = {}) => [
  ...(targetActions.spyTargets || []).map((target) => action(
    "spy",
    "Špehovat",
    !target.enabled,
    target.disabledReason,
    { spyTargetId: target.districtId },
    {
      key: `spy:${target.districtId}`,
      stacked: true,
      subtitle: target.label,
      targetDistrictId: target.districtId
    }
  )),
  ...(targetActions.occupyTargets || []).map((target) => action(
    "occupy",
    "Obsadit",
    !target.enabled,
    target.disabledReason,
    { occupyTargetId: target.districtId },
    {
      key: `occupy:${target.districtId}`,
      stacked: true,
      subtitle: target.label,
      targetDistrictId: target.districtId
    }
  )),
  ...(targetActions.robTargets || []).map((target) => action(
    "rob",
    "Vykrást district",
    !target.enabled,
    target.disabledReason,
    { robTargetId: target.districtId },
    {
      key: `rob:${target.districtId}`,
      stacked: true,
      subtitle: target.label,
      targetDistrictId: target.districtId
    }
  )),
  ...(targetActions.heistTargets || []).map((target) => action(
    "heist",
    "Vykrást hráče",
    !target.enabled,
    target.disabledReason,
    { heistTargetId: target.districtId },
    {
      key: `heist:${target.districtId}`,
      stacked: true,
      subtitle: target.label,
      targetDistrictId: target.districtId
    }
  )),
  ...(targetActions.attackTargets || []).map((target) => action(
    "attack",
    "Útok",
    !target.enabled,
    target.disabledReason,
    { attackTargetId: target.districtId },
    {
      key: `attack:${target.districtId}`,
      stacked: true,
      subtitle: target.label,
      targetDistrictId: target.districtId
    }
  ))
];

const createDistrictActions = (panel, targetActions, isOwnedByPlayer) => {
  const actions = createTargetActions(targetActions);
  if (panel.trap && isOwnedByPlayer) {
    actions.unshift(action(
      "trap",
      panel.trap.actionLabel,
      panel.trap.disabled,
      panel.trap.disabledReason,
      { placeTrap: "true" },
      {
        key: "place-trap",
        stacked: Boolean(panel.trap.activeLabel),
        subtitle: panel.trap.activeLabel || ""
      }
    ));
  }
  if (panel.placeDefense) {
    actions.unshift(action(
      "defense",
      panel.placeDefense.actionLabel,
      panel.placeDefense.disabled,
      panel.placeDefense.disabledReason,
      { placeDefense: "true" },
      { key: "place-defense" }
    ));
  }
  if (panel.removeDefense) {
    actions.unshift(action(
      "defense",
      panel.removeDefense.actionLabel,
      panel.removeDefense.disabled,
      panel.removeDefense.disabledReason,
      { removeDefense: "true" },
      { key: "remove-defense" }
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
    ? String(
        readModel?.player?.avatarSrc
        || readModel?.player?.avatarUrl
        || resolveLivePlayerAvatarSrc(readModel?.player?.profile?.avatarId, readModel?.player?.factionId)
      )
    : String(
        owner?.avatarSrc
        || owner?.avatarUrl
        || resolveLivePlayerAvatarSrc(owner?.avatarId, owner?.factionId)
      );
  const statusLabel = toLabel(panel.statusLabel, "Neznámý");
  const allianceLabel = String(owner?.allianceTag || "").trim();
  const availableActions = createDistrictActions(
    panel,
    district.targetActions,
    currentPlayerOwnsDistrict
  );
  const atmosphereMeta = resolveAtmosphereMeta(district, panel.intelKnown === true);

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
    atmosphereMeta,
    atmosphereLabel: atmosphereMeta.label,
    atmosphereMood: atmosphereMeta.mood,
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
      kindLabel: resolveDistrictBuildingChipKind(building.typeLabel || building.label),
      detail: building
    })),
    buildingMetaText: panel.buildingSummary,
    buildingEmptyText: panel.intelKnown === true
      ? "District nemá dostupné budovy."
      : "Budovy odhalíš úspěšnou špionáží.",
    buildingsInteractive: currentPlayerOwnsDistrict,
    actions: availableActions,
    actionHidden: district.status === "destroyed" || availableActions.length === 0,
    actionEmptyText: panel.hasPendingCommand
      ? "Akce se zpracovává na serveru."
      : "Pro tento district teď není dostupná žádná akce."
  };
}
