import { resolveDistrictBuildingChipKind } from "./districtBuildingChipKind.js";
import { resolveMapDistrictAtmosphereMeta } from "../map/mapDataAdapter.js";
import { resolveLivePlayerAvatarSrc } from "../model/livePlayerAvatarCatalog.js";
import {
  createAuthoritativeDistrictEconomyPresentation
} from "../runtime/authoritativeDistrictEconomyPresentation.js";

const toLabel = (value, fallback = "—") => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized
    .replace(/[_-]+/gu, " ")
    .replace(/^./u, (character) => character.toUpperCase());
};

const formatUiMetricValue = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? 0);
  }
  return String(Number(numericValue.toFixed(2)));
};

const findOwner = (readModel, ownerPlayerId) => {
  if (!ownerPlayerId) return null;
  const entries = [
    readModel?.leaderboard?.currentPlayer,
    ...(Array.isArray(readModel?.leaderboard?.entries) ? readModel.leaderboard.entries : [])
  ].filter(Boolean);
  return entries.find((entry) => String(entry?.playerId) === String(ownerPlayerId)) || null;
};

const formatDisabledActionInfo = (id, disabledCode, disabledReason) => {
  if (
    id === "spy"
    && (
      disabledCode === "SPY_SLOT_LIMIT_REACHED"
      || /aktivní nebo blokované špehy|špionážní sloty/iu.test(disabledReason)
    )
  ) {
    return "Chybí volný špeh";
  }
  return String(disabledReason || "Akce teď není dostupná.").trim();
};

const action = (id, label, disabled, disabledReason, surfaceDataset, options = {}) => {
  const reason = String(disabledReason || "").trim();
  const inlineDisabledReason = disabled && options.inlineDisabledReason === true
    ? formatDisabledActionInfo(id, options.disabledCode, reason)
    : "";

  return {
    id,
    key: options.key || id,
    label,
    enabled: !disabled,
    reason: inlineDisabledReason ? "" : reason,
    surfaceDataset,
    stacked: options.stacked === true || Boolean(inlineDisabledReason),
    subtitle: inlineDisabledReason || options.subtitle || "",
    disabledTone: inlineDisabledReason ? "unavailable" : (options.disabledTone || ""),
    targetDistrictId: options.targetDistrictId || "",
    title: reason || options.title || ""
  };
};

const targetActionOptions = (target, key) => ({
  key,
  stacked: true,
  subtitle: target.label || target.name || "",
  targetDistrictId: target.districtId,
  inlineDisabledReason: true,
  disabledCode: target.disabledCode || ""
});

const createTargetActions = (targetActions = {}) => [
  ...(targetActions.spyTargets || []).map((target) => action(
    "spy",
    "Špehovat",
    !target.enabled,
    target.disabledReason,
    { spyTargetId: target.districtId },
    targetActionOptions(target, `spy:${target.districtId}`)
  )),
  ...(targetActions.occupyTargets || []).map((target) => action(
    "occupy",
    "Obsadit",
    !target.enabled,
    target.disabledReason,
    { occupyTargetId: target.districtId },
    targetActionOptions(target, `occupy:${target.districtId}`)
  )),
  ...(targetActions.robTargets || []).map((target) => action(
    "rob",
    "Vykrást district",
    !target.enabled,
    target.disabledReason,
    { robTargetId: target.districtId },
    targetActionOptions(target, `rob:${target.districtId}`)
  )),
  ...(targetActions.heistTargets || []).map((target) => action(
    "heist",
    "Vykrást hráče",
    !target.enabled,
    target.disabledReason,
    { heistTargetId: target.districtId },
    targetActionOptions(target, `heist:${target.districtId}`)
  )),
  ...(targetActions.attackTargets || []).map((target) => action(
    "attack",
    "Útok",
    !target.enabled,
    target.disabledReason,
    { attackTargetId: target.districtId },
    targetActionOptions(target, `attack:${target.districtId}`)
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
  const atmosphereMeta = resolveMapDistrictAtmosphereMeta(
    district.zone,
    district.districtId,
    { hidden: panel.intelKnown !== true }
  );
  const economy = createAuthoritativeDistrictEconomyPresentation(
    readModel,
    String(district.districtId)
  );
  const showDowntownLockdownMessage = district.intelKnown !== true
    && String(district.zone || "").trim().toLowerCase() === "downtown";
  const economyValue = (value) => district.status === "destroyed"
    ? "0"
    : economy.available ? formatUiMetricValue(value) : "Bez dat";

  return {
    districtId: String(panel.districtId),
    districtType: String(district.zone || ""),
    title: panel.title || district.name || "District",
    typeLabel: panel.zoneLabel || toLabel(district.zone, "District"),
    ownerLabel,
    ownerMeta: district.ownerPlayerId && !currentPlayerOwnsDistrict
      ? ""
      : `${panel.ownershipLabel || "Vlastnictví neznámé"} · ${statusLabel}`,
    ownerAvatarSrc,
    ownerAvatarBackgroundUrl: ownerAvatarSrc,
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
    summaryHidden: !currentPlayerOwnsDistrict,
    populationSourceSummary: economy.populationSourceSummary,
    metrics: [
      {
        label: "Clean / hod",
        value: economyValue(economy.baseCleanHourlyIncome)
      },
      {
        label: "Dirty / hod",
        value: economyValue(economy.baseDirtyHourlyIncome)
      },
      {
        label: "Vliv / hod",
        value: economyValue(economy.districtInfluencePerHour)
      },
      {
        label: "Populace / hod",
        value: economyValue(economy.populationLabel)
      }
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
    buildingMetaText: district.intelKnown === true ? "" : "Nezjištěno",
    buildingEmptyText: district.status === "destroyed"
      ? "V tomhle districtu po totálním zničení nezůstalo nic použitelného."
      : district.intelKnown === true
        ? "Tento distrikt teď nemá přiřazené žádné budovy."
        : showDowntownLockdownMessage ? "Odemkne se až v lockdownu" : "",
    buildingEmptyTone: showDowntownLockdownMessage ? "lockdown" : "",
    buildingsInteractive: currentPlayerOwnsDistrict,
    actions: availableActions,
    actionHidden: district.status === "destroyed" || availableActions.length === 0,
    actionEmptyText: panel.hasPendingCommand
      ? "Akce se zpracovává na serveru."
      : "Pro tento district teď není dostupná žádná akce."
  };
}
