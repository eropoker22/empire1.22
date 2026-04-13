const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { loadEnv } = require("./config/env");
const { limiter } = require("./middleware/rateLimit");
const { gameMode } = require("./middleware/gameMode");
const { GAME_MODES } = require("./config/gameModes");
const { initWebSocket } = require("./ws/wsServer");
const { runIncomeTick } = require("./jobs/incomeTick");
const { runParkIncomeTick } = require("./jobs/parkIncomeTick");
const { runRoundTick } = require("./jobs/roundTick");

const authRoutes = require("./routes/auth");
const playerRoutes = require("./routes/players");
const districtRoutes = require("./routes/districts");
const combatRoutes = require("./routes/combat");
const economyRoutes = require("./routes/economy");
const marketRoutes = require("./routes/market");
const allianceRoutes = require("./routes/alliances");
const roundRoutes = require("./routes/rounds");
const bountyRoutes = require("./routes/bounties");
const adminRoutes = require("./routes/admin");

loadEnv();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.resolve(__dirname, "../../client")));
app.use(limiter);
app.use(gameMode);

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "running" });
});

app.use("/auth", authRoutes);
app.use("/players", playerRoutes);
app.use("/districts", districtRoutes);
app.use("/combat", combatRoutes);
app.use("/economy", economyRoutes);
app.use("/market", marketRoutes);
app.use("/alliances", allianceRoutes);
app.use("/rounds", roundRoutes);
app.use("/bounties", bountyRoutes);
app.use("/admin", adminRoutes);

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);

initWebSocket(server);

setInterval(() => {
  Object.keys(GAME_MODES).forEach((mode) => {
    runIncomeTick(mode).catch((err) => console.error(`Income tick failed for ${mode}`, err));
  });
}, 60 * 60 * 1000);

setInterval(() => {
  Object.keys(GAME_MODES).forEach((mode) => {
    runParkIncomeTick(mode).catch((err) => console.error(`Park income tick failed for ${mode}`, err));
  });
}, 60 * 1000);

setInterval(() => {
  Object.keys(GAME_MODES).forEach((mode) => {
    runRoundTick(mode).catch((err) => console.error(`Round tick failed for ${mode}`, err));
  });
}, 60 * 1000);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
