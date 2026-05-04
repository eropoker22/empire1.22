export const ADMIN_SECTIONS = Object.freeze([
  { id: "overview", label: "Overview", hint: "Live stav hry" },
  { id: "servers", label: "Servers", hint: "Free / War instance" },
  { id: "players", label: "Players", hint: "Hráči a účty" },
  { id: "districts", label: "Districts / Map", hint: "Zóny a pasti" },
  { id: "alliances", label: "Alliances", hint: "Gang diplomacy" },
  { id: "economy", label: "Economy", hint: "Cash a resource flow" },
  { id: "police", label: "Police / Heat", hint: "Razie a tlak" },
  { id: "events", label: "Events", hint: "City/system eventy" },
  { id: "buildings", label: "Buildings", hint: "Balance budov" },
  { id: "combat", label: "Combat", hint: "Útoky a špionáž" },
  { id: "logs", label: "Logs", hint: "Audit a telemetry" },
  { id: "monetization", label: "Monetization", hint: "War konverze" },
  { id: "settings", label: "Settings", hint: "Mock config" },
  { id: "security", label: "Security", hint: "Role a guard" }
]);

export const ADMIN_API_ENDPOINTS = Object.freeze({
  snapshot: "/api/admin/snapshot",
  command: "/api/admin/commands",
  stream: "/api/admin/stream",
  audit: "/api/admin/audit-log"
});

export const ZONE_META = Object.freeze({
  residential: { label: "Residential", color: "#f5c84b" },
  park: { label: "Park", color: "#46e88f" },
  downtown: { label: "Downtown", color: "#ff4fd8" },
  industrial: { label: "Industrial", color: "#a8b0bd" },
  commercial: { label: "Commercial", color: "#4cb7ff" }
});

export const RESOURCE_KEYS = Object.freeze([
  "Chemicals",
  "Biomass",
  "Stim Pack",
  "Neon Dust",
  "Pulse Shot",
  "Velvet Smoke",
  "Ghost Serum",
  "Overdrive X",
  "Metal Parts",
  "Tech Core",
  "Combat Module"
]);

const SERVER_DEFS = Object.freeze([
  ["free-01", "Server 1", "free", "open", 61, 80, "Volný vstup", "No dominance above 85%"],
  ["free-02", "Server 2", "free", "running", 74, 80, "Live server", "Session economy cap"],
  ["free-03", "Server 3", "free", "maintenance", 18, 80, "Demo reset window", "Sandbox reset"],
  ["war-01", "Server 1", "war", "running", 112, 120, "Live war", "85% map control"],
  ["war-02", "Server 2", "war", "full", 120, 120, "Queue active", "Last alliance standing"],
  ["war-03", "Server 3", "war", "ended", 96, 120, "Ended", "Victory snapshot locked"]
]);

const playerNames = Object.freeze([
  "Raven", "Hex", "Nyx", "Varga", "Mara", "Sable", "Zero", "Kade", "Lira", "Cipher",
  "Mako", "Ash", "Nova", "Grimm", "Vale", "Rook", "Chrome", "Saint", "Vex", "Orion"
]);
const factions = Object.freeze(["mafie", "kult", "tajná organizace", "soukromá armáda", "motogang", "korporát", "hackeři", "kartel"]);
const allianceNames = Object.freeze(["Neon Vipers", "Black Sun Pact", "Chrome Saints", "Ghost Cartel", "Iron Choir", "Velvet Circuit", "Ash Wolves", "Nova Syndicate"]);
const districtNames = Object.freeze(["Alder Row", "Black Harbor", "Chrome Mile", "Dock Nine", "East Loop", "Ferro Yard", "Glass Market", "Hollow Park", "Iris Block", "Jade Underpass", "Kilo Square", "Lowtown", "Metro Spine", "North Vein", "Old Clinic", "Pulse Pier", "Quartz Yard", "Red Canal", "Signal Court", "Tower Cut", "Umbra Gate", "Violet Docks", "West Furnace", "Yellow Line"]);

export function createAdminDataProvider() {
  return {
    fetchSnapshot: async () => createAdminMockData(),
    applyCommand: async (command) => ({
      ok: true,
      command,
      acceptedAt: new Date().toISOString(),
      endpoint: ADMIN_API_ENDPOINTS.command
    })
  };
}

export function createAdminMockData() {
  const servers = createServers();
  const alliances = createAlliances();
  const players = createPlayers(servers, alliances);
  const districts = createDistricts(players, alliances);
  const economy = createEconomy(players);
  const police = createPolice(players, districts);
  const events = createEvents();
  const buildings = createBuildings();
  const combat = createCombat(players, districts);
  const logs = createLogs(players, servers);
  const monetization = createMonetization(players);
  const settings = createSettings();

  return {
    generatedAt: new Date().toISOString(),
    admin: {
      id: "admin:local-superadmin",
      name: "Empire Ops",
      role: "superadmin",
      status: "Live",
      permissionMode: "mock guard"
    },
    servers,
    players,
    districts,
    alliances,
    economy,
    police,
    events,
    buildings,
    combat,
    logs,
    monetization,
    settings,
    security: createSecurity(logs)
  };
}

function createServers() {
  return SERVER_DEFS.map(([id, name, mode, status, players, capacity, startLabel, endCondition], index) => ({
    id,
    name,
    mode,
    status,
    playerCount: players,
    capacity,
    startTime: offsetIso(-160 + (index * 18)),
    endCondition,
    progress: mode === "war" ? [62, 77, 100][index - 3] : [31, 44, 12][index],
    winningEntity: mode === "war" ? ["Black Sun Pact", "Neon Vipers", "Chrome Saints"][Math.max(0, index - 3)] : "n/a",
    health: status === "maintenance" ? "Demo" : status === "ended" ? "Maintenance" : "Live",
    region: index % 2 ? "EU West" : "EU Central",
    startLabel
  }));
}

function createPlayers(servers, alliances) {
  const players = [];
  servers.forEach((server, serverIndex) => {
    const count = server.mode === "free" ? 20 : 10;
    for (let index = 0; index < count; index += 1) {
      const base = (serverIndex * 20) + index;
      const heat = (base * 11) % 100;
      const alliance = alliances[base % alliances.length];
      players.push({
        id: `P-${server.id}-${String(index + 1).padStart(2, "0")}`,
        nickname: `${playerNames[index % playerNames.length]}-${server.id.slice(-2)}${index + 1}`,
        faction: factions[(base + 2) % factions.length],
        alliance: index % 4 === 0 ? "" : alliance.name,
        server: server.id,
        mode: server.mode,
        online: index % 3 !== 0,
        districtCount: 1 + ((base * 3) % 11),
        gangMembers: 24 + ((base * 17) % 460),
        cleanCash: 1200 + (base * 875),
        dirtyCash: 2400 + (base * 1320),
        heat,
        heatLevel: Math.min(7, Math.max(1, Math.ceil(heat / 15))),
        influence: 12 + ((base * 9) % 88),
        premium: server.mode === "war" || index % 5 === 0,
        banned: false,
        suspiciousScore: (base * 7) % 100,
        lastActivity: offsetIso(-((base * 3) % 240)),
        attacks: (base * 2) % 18,
        economyDelta: 600 + (base * 420),
        heatTimeline: Array.from({ length: 8 }, (_item, step) => Math.max(0, Math.min(100, heat - 18 + (step * 5) + ((base + step) % 9))))
      });
    }
  });
  return players;
}

function createAlliances() {
  return allianceNames.map((name, index) => ({
    id: `A-${index + 1}`,
    name,
    factionType: factions[index % factions.length],
    members: 3 + ((index * 2) % 9),
    controlledDistricts: 4 + ((index * 5) % 24),
    influence: 18 + ((index * 13) % 82),
    heat: 8 + ((index * 16) % 90),
    economyPower: 180000 + (index * 74000),
    lastAttacks: 2 + ((index * 3) % 15),
    mapProgress: 19 + ((index * 9) % 68),
    snowballWarning: index === 1 || index === 3,
    lastActivity: offsetIso(-(index * 19))
  }));
}

function createDistricts(players, alliances) {
  const zones = Object.keys(ZONE_META);
  return Array.from({ length: 48 }, (_item, index) => {
    const owner = players[(index * 5) % players.length];
    const alliance = alliances[(index * 3) % alliances.length];
    const zone = zones[index % zones.length];
    const hasTrap = index % 7 === 0;
    return {
      id: `D-${String(index + 1).padStart(3, "0")}`,
      name: districtNames[index % districtNames.length],
      zone,
      owner: index % 6 === 0 ? "Neutral" : owner.nickname,
      ownerId: owner.id,
      alliance: index % 6 === 0 ? "" : alliance.name,
      buildings: pickBuildings(index),
      heat: (index * 9) % 100,
      influence: 20 + ((index * 7) % 80),
      activeTrap: hasTrap ? "toxic trap" : index % 5 === 0 ? "ambush wire" : "",
      toxicTrap: hasTrap ? { embedded: true, severity: ["low", "medium", "high"][index % 3], expiresIn: `${12 + index}m` } : null,
      policeStatus: ["clear", "watchlist", "raid active", "lockdown"][index % 4],
      conflictStatus: ["stable", "contested", "under attack", "cooldown"][index % 4],
      locked: index % 13 === 0,
      row: Math.floor(index / 8),
      col: index % 8
    };
  });
}

function createEconomy(players) {
  return {
    cleanCash: players.reduce((sum, player) => sum + player.cleanCash, 0),
    dirtyCash: players.reduce((sum, player) => sum + player.dirtyCash, 0),
    incomePerHour: 842000,
    productionPerMinute: 12950,
    launderingVolume: 312000,
    inflation: 13.8,
    balanceScore: 74,
    cashOverTime: [820, 900, 970, 1130, 1210, 1380, 1510, 1660, 1810, 1960, 2140, 2360],
    dirtyVsClean: [
      { label: "Clean", value: 42, color: "#46e88f" },
      { label: "Dirty", value: 58, color: "#ff4f6d" }
    ],
    launderingActivity: [22, 28, 25, 31, 38, 36, 42, 47, 44, 51, 49, 57],
    topEarners: players.slice().sort((a, b) => b.economyDelta - a.economyDelta).slice(0, 8),
    suspiciousSpikes: players.filter((player) => player.suspiciousScore > 72).slice(0, 6),
    resources: RESOURCE_KEYS.map((resource, index) => ({
      name: resource,
      amount: 1200 + (index * 845),
      perMinute: 18 + (index * 7),
      pressure: 42 + ((index * 11) % 48)
    }))
  };
}

function createPolice(players, districts) {
  const heatBuckets = Array.from({ length: 7 }, (_item, index) => ({
    level: index + 1,
    players: players.filter((player) => player.heatLevel === index + 1).length,
    label: ["Baseline", "Attention", "Pressure", "Hunt", "Sweep", "Crackdown", "Predator"][index]
  }));
  return {
    heatBuckets,
    activeRaids: districts.filter((district) => district.policeStatus === "raid active").slice(0, 5).map((district, index) => ({
      id: `raid-${district.id}`,
      type: ["financial raid", "drug raid", "arms raid", "district sweep"][index % 4],
      district: district.name,
      owner: district.owner,
      tier: 2 + (index % 5),
      remaining: `${18 + (index * 9)}m`,
      seized: 12000 + (index * 5400)
    })),
    scheduledRaids: players.filter((player) => player.heat > 74).slice(0, 6).map((player, index) => ({
      id: `schedule-${player.id}`,
      target: player.nickname,
      type: ["financial", "drug", "arms"][index % 3],
      eta: `${8 + (index * 6)}m`,
      reason: `Heat ${player.heat}`
    })),
    seizedResources: 184200,
    lockdownDistricts: districts.filter((district) => district.policeStatus === "lockdown").length,
    pressureByServer: [
      { label: "FREE-01", value: 38 },
      { label: "FREE-02", value: 44 },
      { label: "FREE-03", value: 16 },
      { label: "WAR-01", value: 71 },
      { label: "WAR-02", value: 83 },
      { label: "WAR-03", value: 29 }
    ],
    targetList: players.slice().sort((a, b) => b.heat - a.heat).slice(0, 8),
    reports: [
      "AI police marked Black Harbor as raid-prone after dirty cash spike.",
      "Financial sweep recovered 18% dirty reserves from three high heat accounts.",
      "District lockdown reduced attack volume by 21% on WAR-02."
    ]
  };
}

function createEvents() {
  const quick = ["City Blackout", "Police Sweep", "Market Crash", "Gang War", "Toxic Leak", "Server Boost", "Dirty Money Crackdown"];
  return quick.map((name, index) => ({
    id: `event-${index + 1}`,
    name,
    category: ["system", "city", "police", "crisis", "admin"][index % 5],
    description: `${name} mění tempo serveru a zapisuje viditelný admin event do projekce.`,
    duration: `${30 + (index * 10)}m`,
    effects: ["income modifier", "heat pressure", "resource drift"].slice(0, 1 + (index % 3)),
    scope: ["global", "server", "district", "faction", "alliance", "player"][index % 6],
    stacking: index % 2 ? "limited" : "none",
    priority: 10 - index,
    visibleTo: index % 2 ? "admins + affected players" : "all players",
    active: index < 3
  }));
}

function createBuildings() {
  const names = ["Lékárna", "Drug Lab", "Továrna", "Zbrojovka", "Pašovací tunel", "Pouliční dealeři", "Strip club", "Večerka", "Energetická stanice", "Sklad", "Fitness Club", "Kasino", "Herna", "Autosalon", "Směnárna", "Restaurace", "Bytový blok", "Klinika"];
  const zones = Object.keys(ZONE_META);
  return names.map((name, index) => ({
    id: `building-${index + 1}`,
    name,
    type: ["production", "income", "utility", "combat", "support"][index % 5],
    zone: zones[index % zones.length],
    income: 240 + (index * 115),
    heat: (index * 4) % 31,
    influence: 3 + (index % 12),
    production: RESOURCE_KEYS[index % RESOURCE_KEYS.length],
    cooldown: `${8 + (index * 2)}m`,
    upgradeLevel: 1 + (index % 14),
    occurrences: 4 + ((index * 3) % 29),
    disabled: false
  }));
}

function createCombat(players, districts) {
  return {
    weapons: ["Baseballová pálka", "Pouliční pistole", "Granát", "Samopal", "Bazuka"],
    defense: ["Neprůstřelná vesta", "Ocelové barikády", "Bezpečnostní kamery", "Automatické kulometné stanoviště", "Alarm"],
    activeAttacks: Array.from({ length: 7 }, (_item, index) => ({
      id: `attack-${index + 1}`,
      attacker: players[(index * 3) % players.length].nickname,
      defender: players[(index * 5 + 2) % players.length].nickname,
      district: districts[(index * 4) % districts.length].name,
      type: ["attack", "spy", "raid", "occupy"][index % 4],
      remaining: `${4 + (index * 3)}m`,
      risk: 28 + (index * 9)
    })),
    recentAttacks: Array.from({ length: 9 }, (_item, index) => ({
      id: `recent-${index + 1}`,
      actor: players[(index * 2) % players.length].nickname,
      target: districts[(index * 7) % districts.length].name,
      result: ["won", "lost", "scouted", "trap triggered"][index % 4],
      losses: 2 + (index * 4),
      at: offsetIso(-(index * 11))
    })),
    suspiciousRepeats: players.filter((player) => player.attacks > 10).slice(0, 6)
  };
}

function createLogs(players, servers) {
  const categories = ["admin", "player", "economy", "combat", "police", "event", "security", "error"];
  const severities = ["info", "notice", "warning", "critical"];
  return Array.from({ length: 54 }, (_item, index) => ({
    id: `log-${index + 1}`,
    timestamp: offsetIso(-(index * 7)),
    server: servers[index % servers.length].id,
    mode: servers[index % servers.length].mode,
    severity: severities[index % severities.length],
    category: categories[index % categories.length],
    actor: index % 6 === 0 ? "admin:system" : players[(index * 4) % players.length].nickname,
    message: [
      "server projection refreshed",
      "player cash delta exceeded baseline",
      "district trap state changed",
      "police raid result committed",
      "admin command accepted",
      "security guard evaluated permission"
    ][index % 6],
    metadata: `trace=${String(index + 1000)} shard=${servers[index % servers.length].id}`
  }));
}

function createMonetization(players) {
  const premiumUsers = players.filter((player) => player.premium).length;
  return {
    freePlayers: players.filter((player) => player.mode === "free").length,
    warPlayers: players.filter((player) => player.mode === "war").length,
    premiumUsers,
    conversionRate: 9.4,
    ctaClicks: 318,
    revenueEstimate: 4820,
    paidServerActivity: 71,
    endedFreeSessions: 184,
    clickedWarMode: 52,
    registrations: 39,
    paid: 17,
    bestServer: "WAR-02",
    topPayingUsers: players.filter((player) => player.premium).slice(0, 8).map((player, index) => ({
      ...player,
      spend: 19 + (index * 14)
    }))
  };
}

function createSettings() {
  return {
    serverConfig: "mock-local",
    freeMode: { maxPlayers: 80, sessionLengthHours: 0, winCondition: "open economy", allianceSize: 8 },
    warMode: { maxPlayers: 120, sessionLengthHours: 72, winCondition: "85% map control", allianceSize: 10 },
    balance: {
      heatMultiplier: 1.15,
      incomeMultiplier: 1.0,
      productionMultiplier: 1.08,
      attackDurationMin: 12,
      spyDurationMin: 8,
      trapRules: "one active trap per player, toxic trap embedded in district",
      policeAggressiveness: 72,
      eventFrequencyMin: 30
    }
  };
}

function createSecurity(logs) {
  return {
    roles: [
      { role: "superadmin", scope: "all commands", dangerous: true },
      { role: "admin", scope: "ops + support", dangerous: true },
      { role: "moderator", scope: "players + logs", dangerous: false },
      { role: "analyst", scope: "read-only telemetry", dangerous: false }
    ],
    guard: "Mock access guard active. Backend permission check attaches here.",
    dangerousActions: ["ban-player", "reset-player", "end-server", "reset-demo", "dissolve-alliance"],
    auditTrail: logs.filter((log) => log.category === "admin" || log.category === "security").slice(0, 12)
  };
}

function pickBuildings(index) {
  const pool = ["Lékárna", "Drug Lab", "Továrna", "Zbrojovka", "Sklad", "Kasino", "Energetická stanice", "Klinika", "Pašovací tunel"];
  return [pool[index % pool.length], pool[(index + 3) % pool.length], pool[(index + 6) % pool.length]];
}

function offsetIso(minutes) {
  return new Date(Date.now() + (minutes * 60 * 1000)).toISOString();
}
