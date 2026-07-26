import { buildCityStatusViewModel } from "../runtime/cityStatusBarRuntime.js";

const normalizeCount = (value) => Math.max(0, Math.round(Number(value) || 0));

const resolveOwnedDistrictCount = (readModel, playerId) => (
  (Array.isArray(readModel?.districts) ? readModel.districts : []).reduce(
    (count, district) => count + Number(
      district?.isOwnedByPlayer
      || String(district?.ownerPlayerId || "") === String(playerId || "")
    ),
    0
  )
);

const resolvePlayerCountLabel = (readModel) => {
  const maxPlayers = Math.max(1, normalizeCount(readModel?.server?.maxPlayersPerServer) || 20);
  const activePlayers = Number(
    readModel?.elimination?.activePlayersRemaining
    ?? readModel?.player?.elimination?.activePlayersRemaining
  );
  if (Number.isFinite(activePlayers) && activePlayers >= 0) {
    return `${Math.floor(activePlayers)}/${maxPlayers}`;
  }
  const entries = readModel?.leaderboard?.entries;
  return Array.isArray(entries) ? `${entries.length}/${maxPlayers}` : `—/${maxPlayers}`;
};

export function createServerGameplayStatusView(readModel) {
  const player = readModel?.player;
  if (!player?.economy) return null;
  const dayNight = player.dayNight || readModel.dayNight || null;
  const cityMinutes = Number.isFinite(Number(dayNight?.gameHour))
    && Number.isFinite(Number(dayNight?.gameMinute))
    ? (Math.floor(Number(dayNight.gameHour)) * 60) + Math.floor(Number(dayNight.gameMinute))
    : undefined;
  const city = buildCityStatusViewModel({
    ...(cityMinutes === undefined ? {} : { cityMinutes }),
    mapPhase: dayNight?.uiThemeHint
  }, {
    gameplaySlice: readModel,
    playerView: player,
    maxPlayersPerServer: readModel?.server?.maxPlayersPerServer,
    tickMs: readModel?.mode?.tickRateMs
  });
  city.statusLabel = resolvePlayerCountLabel(readModel);

  return {
    gangMembers: String(normalizeCount(player.economy.gangMembers)),
    factionLabel: String(player.faction?.name || player.factionId || "—"),
    districtCount: String(resolveOwnedDistrictCount(readModel, player.playerId)),
    allianceLabel: String(
      player.alliance?.allianceName
      || readModel?.allianceBoard?.activeAlliance?.name
      || "Žádná"
    ),
    city
  };
}
