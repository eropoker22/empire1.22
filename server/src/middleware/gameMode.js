const { getGameModeConfig, normalizeGameMode } = require("../config/gameModes");

function gameMode(req, res, next) {
  const headerMode = req.headers["x-game-mode"];
  const queryMode = req.query?.mode;
  const bodyMode = req.body?.mode;
  const resolvedMode = normalizeGameMode(req.user?.gameMode || headerMode || queryMode || bodyMode || "war");
  req.gameMode = resolvedMode;
  req.gameModeConfig = getGameModeConfig(resolvedMode);
  return next();
}

module.exports = { gameMode };
