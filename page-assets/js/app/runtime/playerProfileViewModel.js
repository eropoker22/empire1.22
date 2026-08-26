import { formatDistrictMetricNumber, formatDistrictMoneyAmount } from "./formatters.js";
import { hexToRgbParts } from "./utils.js";

const normalizedText = (value) => String(value || "").trim();

export function resolvePlayerIdentityPresentation({
  registration = null,
  serverPlayer = null,
  factionCatalog = {},
  resolveServerAvatarSrc = () => ""
} = {}) {
  const serverProfile = serverPlayer?.profile || null;
  const serverFactionId = normalizedText(serverPlayer?.factionId);
  const registrationFactionId = normalizedText(registration?.factionId);
  const factionId = serverFactionId
    ? serverFactionId
    : registrationFactionId && factionCatalog[registrationFactionId]
      ? registrationFactionId
      : "";
  const serverAvatarId = normalizedText(serverProfile?.avatarId);
  const serverAvatarSrc = serverAvatarId
    ? normalizedText(resolveServerAvatarSrc(serverAvatarId, serverFactionId || factionId))
    : "";

  return {
    accentColor: normalizedText(serverPlayer?.color) || normalizedText(registration?.gangColor),
    avatarSrc: serverAvatarId ? serverAvatarSrc : normalizedText(registration?.avatar),
    displayName: normalizedText(serverProfile?.displayName) || normalizedText(registration?.identity) || "Host",
    faction: factionId ? factionCatalog[factionId] || null : null,
    factionId,
    gangName: normalizedText(serverProfile?.gangName)
      || normalizedText(registration?.gangName)
      || (registration?.identity ? `${registration.identity} Crew` : "Guest Crew")
  };
}

export function createPlayerProfileViewModel({
  registration = null,
  serverPlayer = null,
  faction = null,
  displaySnapshot = {},
  gangState = {},
  districtCount = 0,
  empireScore = null,
  allianceLabel = "Žádná",
  avatarSrc = "",
  accentColor = "#22d3ee",
  assetResolver = (value) => value,
  protectionLabel = "Bez ochrany"
} = {}) {
  const identityLabel = normalizedText(serverPlayer?.profile?.displayName)
    || registration?.identity
    || "Host";
  const resolvedAvatarSrc = String(avatarSrc || "").trim();
  const safeAccentColor = String(accentColor || "#22d3ee");
  const safeDistrictCount = Math.max(0, Number(districtCount) || 0);
  const hasEmpireScore = empireScore !== null && empireScore !== undefined && Number.isFinite(Number(empireScore));
  const safeAllianceLabel = String(allianceLabel || "").trim() || "Žádná";
  const resourcesAvailable = displaySnapshot.available !== false;
  const gangResourcesAvailable = gangState.available !== false;

  return {
    avatarSrc: resolvedAvatarSrc ? assetResolver(resolvedAvatarSrc) : "",
    avatarFallback: identityLabel,
    accentColor: safeAccentColor,
    accentRgb: hexToRgbParts(safeAccentColor).join(", "),
    factionId: normalizedText(serverPlayer?.factionId) || registration?.factionId || "mafian",
    identityLabel,
    factionLabel: faction?.name || "-",
    serverLabel: registration?.serverLabel || registration?.serverId || "-",
    empireScoreLabel: hasEmpireScore ? formatDistrictMetricNumber(Math.max(0, Number(empireScore)), 0) : "—",
    cleanMoneyLabel: resourcesAvailable ? formatDistrictMoneyAmount(displaySnapshot.cleanMoney) : "—",
    dirtyMoneyLabel: resourcesAvailable ? formatDistrictMoneyAmount(displaySnapshot.dirtyMoney) : "—",
    influenceLabel: resourcesAvailable ? String(Math.max(0, Math.floor(Number(displaySnapshot.influence) || 0))) : "—",
    gangLabel: normalizedText(serverPlayer?.profile?.gangName)
      || registration?.gangName
      || (registration?.identity ? `${registration.identity} Crew` : "Guest Crew"),
    allianceLabel: safeAllianceLabel,
    districtCountLabel: String(safeDistrictCount),
    heatLabel: gangResourcesAvailable ? formatDistrictMetricNumber(gangState.heat ?? 0, 1) : "—",
    protectionLabel: gangResourcesAvailable ? protectionLabel : "—"
  };
}
