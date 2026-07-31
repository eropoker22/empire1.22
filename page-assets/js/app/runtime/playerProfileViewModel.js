import { formatDistrictMetricNumber, formatDistrictMoneyAmount } from "./formatters.js";
import { hexToRgbParts } from "./utils.js";

export function createPlayerProfileViewModel({
  registration = null,
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
  const identityLabel = registration?.identity || "Host";
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
    factionId: registration?.factionId || "mafian",
    identityLabel,
    factionLabel: faction?.name || "-",
    serverLabel: registration?.serverLabel || registration?.serverId || "-",
    empireScoreLabel: hasEmpireScore ? formatDistrictMetricNumber(Math.max(0, Number(empireScore)), 0) : "—",
    cleanMoneyLabel: resourcesAvailable ? formatDistrictMoneyAmount(displaySnapshot.cleanMoney) : "—",
    dirtyMoneyLabel: resourcesAvailable ? formatDistrictMoneyAmount(displaySnapshot.dirtyMoney) : "—",
    influenceLabel: resourcesAvailable ? String(Math.max(0, Math.floor(Number(displaySnapshot.influence) || 0))) : "—",
    gangLabel: registration?.gangName
      || (registration?.identity ? `${registration.identity} Crew` : "Guest Crew"),
    allianceLabel: safeAllianceLabel,
    districtCountLabel: String(safeDistrictCount),
    heatLabel: gangResourcesAvailable ? String(gangState.heat ?? 0) : "—",
    protectionLabel: gangResourcesAvailable ? protectionLabel : "—"
  };
}
