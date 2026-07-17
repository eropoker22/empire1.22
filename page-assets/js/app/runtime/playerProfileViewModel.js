import { formatDistrictMetricNumber, formatDistrictMoneyAmount } from "./formatters.js";
import { hexToRgbParts } from "./utils.js";

export function createPlayerProfileViewModel({
  registration = null,
  faction = null,
  displaySnapshot = {},
  gangState = {},
  districtCount = 0,
  empireScore = 0,
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
  const safeEmpireScore = Math.max(0, Number(empireScore) || 0);
  const safeAllianceLabel = String(allianceLabel || "").trim() || "Žádná";

  return {
    avatarSrc: resolvedAvatarSrc ? assetResolver(resolvedAvatarSrc) : "",
    avatarFallback: identityLabel,
    accentColor: safeAccentColor,
    accentRgb: hexToRgbParts(safeAccentColor).join(", "),
    factionId: registration?.factionId || "mafian",
    identityLabel,
    factionLabel: faction?.name || "-",
    serverLabel: registration?.serverLabel || registration?.serverId || "-",
    empireScoreLabel: formatDistrictMetricNumber(safeEmpireScore, 0),
    cleanMoneyLabel: formatDistrictMoneyAmount(displaySnapshot.cleanMoney),
    dirtyMoneyLabel: formatDistrictMoneyAmount(displaySnapshot.dirtyMoney),
    influenceLabel: String(displaySnapshot.influence ?? 0),
    gangLabel: registration?.identity ? `${registration.identity} Crew` : "Guest Crew",
    allianceLabel: safeAllianceLabel,
    districtCountLabel: String(safeDistrictCount),
    heatLabel: String(gangState.heat ?? 0),
    protectionLabel
  };
}
