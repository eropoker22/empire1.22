const jwt = require("jsonwebtoken");
const { normalizeGameMode } = require("../config/gameModes");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    req.gameMode = normalizeGameMode(payload.gameMode || req.gameMode || "war");
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

module.exports = { auth };
