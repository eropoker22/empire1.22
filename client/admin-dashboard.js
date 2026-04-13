(function () {
  const mockData = {
    servers: [
      { id: "free-neon-rift-1", name: "Neon Rift #1", type: "free", status: "live", players: 18, maxPlayers: 20, districtCount: 161, sessionLength: "01h 34m", dominance: 48, leader: "Chrome Saints", uptime: "6d 04h 19m", tickRate: "60s", matchRules: "Free rush / 1-2h session / Raid on / Spying on", allianceCap: 8, dominanceThreshold: "55%", policeAggression: "Elastic", cleanCashPerHour: 182000, dirtyCashPerHour: 96000, globalHeat: 64, activeRaids: 9 },
      { id: "free-black-grid-2", name: "Black Grid #2", type: "free", status: "live", players: 16, maxPlayers: 20, districtCount: 161, sessionLength: "01h 12m", dominance: 44, leader: "Ghost Ledger", uptime: "4d 11h 52m", tickRate: "60s", matchRules: "Free rush / 1-2h session / Fast takeover / Trap on", allianceCap: 8, dominanceThreshold: "55%", policeAggression: "Elastic", cleanCashPerHour: 168000, dirtyCashPerHour: 88000, globalHeat: 58, activeRaids: 8 },
      { id: "free-spark-yard-3", name: "Spark Yard #3", type: "free", status: "maintenance", players: 0, maxPlayers: 20, districtCount: 161, sessionLength: "00h 00m", dominance: 0, leader: "-", uptime: "0d 00h 00m", tickRate: "60s", matchRules: "Free rush / Warmup off", allianceCap: 8, dominanceThreshold: "55%", policeAggression: "Standby", cleanCashPerHour: 0, dirtyCashPerHour: 0, globalHeat: 0, activeRaids: 0 },
      { id: "hra-alliance-ten-blackout", name: "HRA", type: "war", status: "live", players: 8, maxPlayers: 20, districtCount: 161, sessionLength: "NOC-BLACKOUT / Den 3", dominance: 6, leader: "Zabijáci", uptime: "0d 03h 12m", tickRate: "60s", matchRules: "HRA scenario / alliance-ten-blackout / NOC-BLACKOUT 20:30 / Police incident 143 + 38", allianceCap: 4, dominanceThreshold: "10%", policeAggression: "Blackout crackdown", cleanCashPerHour: 62000, dirtyCashPerHour: 41000, globalHeat: 97, activeRaids: 3 },
      { id: "war-district-war-alpha", name: "District War Alpha", type: "war", status: "live", players: 27, maxPlayers: 28, districtCount: 186, sessionLength: "7d 14h", dominance: 71, leader: "Black Circuit", uptime: "18d 01h 10m", tickRate: "60s", matchRules: "War mode / 10d season / Dominance on / Bounty on / Spying on", allianceCap: 10, dominanceThreshold: "70%", policeAggression: "Tiered crackdown", cleanCashPerHour: 296000, dirtyCashPerHour: 184000, globalHeat: 214, activeRaids: 17 },
      { id: "war-sector-prime", name: "War Sector Prime", type: "war", status: "locked", players: 25, maxPlayers: 28, districtCount: 194, sessionLength: "5d 09h", dominance: 78, leader: "Neon Wolves", uptime: "14d 17h 43m", tickRate: "60s", matchRules: "War mode / 10d season / Lockdown escalation / Police pressure high", allianceCap: 10, dominanceThreshold: "70%", policeAggression: "High escalation", cleanCashPerHour: 274000, dirtyCashPerHour: 171000, globalHeat: 237, activeRaids: 14 },
      { id: "war-iron-clash-3", name: "Iron Clash #3", type: "war", status: "live", players: 23, maxPlayers: 28, districtCount: 188, sessionLength: "6d 02h", dominance: 62, leader: "Velvet Crown", uptime: "9d 08h 21m", tickRate: "60s", matchRules: "War mode / 10d season / Balanced crackdown / Crafting high", allianceCap: 10, dominanceThreshold: "70%", policeAggression: "Adaptive", cleanCashPerHour: 248000, dirtyCashPerHour: 149000, globalHeat: 176, activeRaids: 11 }
    ],
    players: [
      { id: "P-100942", nickname: "Vortex_77", server: "war-district-war-alpha", faction: "Mafia", alliance: "Black Circuit", districts: 15, cleanCash: 882000, dirtyCash: 514000, heat: 322, online: true, lastActivityMinutes: 1, reports: 5, suspicion: "critical", profile: "Rank 82. Control specialist.", economy: "Clean +$18k/h. Dirty +$11k/h.", districtInfo: "Downtown A1-A4. Industrial C2-C4.", production: "Ghost Serum x42/h. SMG x18/h.", attacks: "18 raid attempts / 24h. Win rate 71%.", spying: "14 spying runs / 24h. Success 79%.", heatHistory: "190 to 322 dnes.", lastLogs: "15:22 Raid won on C7. 15:14 Heat spike." },
      { id: "P-101004", nickname: "NeroGhost", server: "war-district-war-alpha", faction: "Cartel", alliance: "Black Circuit", districts: 12, cleanCash: 744000, dirtyCash: 602000, heat: 205, online: true, lastActivityMinutes: 2, reports: 2, suspicion: "warning", profile: "Rank 78. Logistics route manager.", economy: "Clean +$16k/h. Dirty +$13k/h.", districtInfo: "Industrial ring control.", production: "Combat Module x30/h.", attacks: "15 raid attempts / 24h.", spying: "11 spying runs / 24h.", heatHistory: "121 to 205 dnes.", lastLogs: "14:41 Market lock bypass report." },
      { id: "P-100561", nickname: "MaraPulse", server: "war-sector-prime", faction: "Hackeři", alliance: "Neon Wolves", districts: 11, cleanCash: 698000, dirtyCash: 481000, heat: 144, online: false, lastActivityMinutes: 12, reports: 1, suspicion: "none", profile: "Rank 75. Recon and disruption.", economy: "Clean +$14k/h. Dirty +$9k/h.", districtInfo: "North sector recon.", production: "Data center boost active.", attacks: "12 raid attempts / 24h.", spying: "19 spying runs / 24h.", heatHistory: "88 to 144 dnes.", lastLogs: "13:57 Captured spying event on D4." },
      { id: "P-112090", nickname: "NightFalcon", server: "free-neon-rift-1", faction: "Motorkářský gang", alliance: "Chrome Saints", districts: 8, cleanCash: 142000, dirtyCash: 76000, heat: 92, online: true, lastActivityMinutes: 1, reports: 0, suspicion: "none", profile: "Rank 52. Fast mode grinder.", economy: "Clean +$9k/h. Dirty +$4k/h.", districtInfo: "Rotating control in free sessions.", production: "Drug lab burst x18/h.", attacks: "9 raid attempts / 24h.", spying: "7 spying runs / 24h.", heatHistory: "34 to 92 dnes.", lastLogs: "15:19 Free takeover complete." },
      { id: "P-112118", nickname: "DeltaRush", server: "free-black-grid-2", faction: "Pouliční gang", alliance: "Ghost Ledger", districts: 7, cleanCash: 128000, dirtyCash: 69000, heat: 66, online: true, lastActivityMinutes: 3, reports: 1, suspicion: "none", profile: "Rank 49. Session closer.", economy: "Clean +$8k/h. Dirty +$3k/h.", districtInfo: "Free map sweep routes.", production: "Armory cycle x11/h.", attacks: "7 raid attempts / 24h.", spying: "5 spying runs / 24h.", heatHistory: "41 to 66 dnes.", lastLogs: "14:08 Report cleared." },
      { id: "P-130441", nickname: "QbitHunter", server: "war-sector-prime", faction: "Soukromá armáda", alliance: "Neon Wolves", districts: 13, cleanCash: 624000, dirtyCash: 392000, heat: 287, online: true, lastActivityMinutes: 4, reports: 4, suspicion: "warning", profile: "Rank 71. Siege specialist.", economy: "Clean +$13k/h. Dirty +$8k/h.", districtInfo: "East war line hold.", production: "Grenade x27/h.", attacks: "17 raid attempts / 24h.", spying: "9 spying runs / 24h.", heatHistory: "180 to 287 dnes.", lastLogs: "15:00 District attack chain x4." },
      { id: "P-150220", nickname: "SilkVector", server: "war-iron-clash-3", faction: "Korporace", alliance: "Velvet Crown", districts: 10, cleanCash: 581000, dirtyCash: 248000, heat: 111, online: true, lastActivityMinutes: 5, reports: 1, suspicion: "none", profile: "Rank 68. Corporate asset broker.", economy: "Clean +$12k/h. Dirty +$5k/h.", districtInfo: "Commercial sector consolidation.", production: "Casino routing x21/h.", attacks: "8 raid attempts / 24h.", spying: "6 spying runs / 24h.", heatHistory: "76 to 111 dnes.", lastLogs: "14:32 Downtown influence shift." },
      { id: "P-170334", nickname: "SaintMorrow", server: "war-iron-clash-3", faction: "Tajná organizace", alliance: "Velvet Crown", districts: 9, cleanCash: 462000, dirtyCash: 371000, heat: 242, online: false, lastActivityMinutes: 19, reports: 3, suspicion: "warning", profile: "Rank 64. Covert disruption lead.", economy: "Clean +$10k/h. Dirty +$7k/h.", districtInfo: "Residential network infiltration.", production: "Trap kits x17/h.", attacks: "11 raid attempts / 24h.", spying: "21 spying runs / 24h.", heatHistory: "170 to 242 dnes.", lastLogs: "13:11 Crackdown escaped." },
      { id: "HRA-0001", nickname: "Host", server: "hra-alliance-ten-blackout", faction: "Mafia", alliance: "Zabijáci", districts: 5, cleanCash: 92000, dirtyCash: 62000, heat: 84, online: true, lastActivityMinutes: 1, reports: 0, suspicion: "none", profile: "HRA state player. Night blackout control.", economy: "Clean +$6.2k/h. Dirty +$4.1k/h.", districtInfo: "Districts 84, 95, 92, 120, 126.", production: "Mixed district income with blackout pressure.", attacks: "3 raid attempts / 24h.", spying: "4 spying runs / 24h.", heatHistory: "61 to 84 dnes.", lastLogs: "20:30 NOC-BLACKOUT aktivní." },
      { id: "HRA-0002", nickname: "Knedlík", server: "hra-alliance-ten-blackout", faction: "Pouliční gang", alliance: "Zabijáci", districts: 2, cleanCash: 41000, dirtyCash: 26000, heat: 58, online: true, lastActivityMinutes: 2, reports: 0, suspicion: "none", profile: "HRA ally support.", economy: "Clean +$2.8k/h. Dirty +$1.9k/h.", districtInfo: "Districts 102, 109.", production: "Support routes active.", attacks: "1 raid attempt / 24h.", spying: "2 spying runs / 24h.", heatHistory: "34 to 58 dnes.", lastLogs: "20:18 Držím district 102." },
      { id: "HRA-0003", nickname: "Poltergeist", server: "hra-alliance-ten-blackout", faction: "Hackeři", alliance: "Ledová aliance", districts: 2, cleanCash: 37000, dirtyCash: 42000, heat: 97, online: true, lastActivityMinutes: 3, reports: 2, suspicion: "warning", profile: "Blackout infiltrator.", economy: "Clean +$2.1k/h. Dirty +$3.2k/h.", districtInfo: "Districts 143, 121.", production: "Recon + pressure mix.", attacks: "2 raid attempts / 24h.", spying: "5 spying runs / 24h.", heatHistory: "70 to 97 dnes.", lastLogs: "20:12 Žádost o vstup do aliance." }
    ],
    alliances: [
      { id: "A-001", name: "Black Circuit", server: "war-district-war-alpha", members: 10, districts: 56, dominance: 71, power: 98420, cashFlow: "$92k/h", conflicts: 12, founded: "2026-01-18", status: "Aggressive expansion" },
      { id: "A-002", name: "Neon Wolves", server: "war-sector-prime", members: 10, districts: 61, dominance: 78, power: 94210, cashFlow: "$88k/h", conflicts: 16, founded: "2026-01-22", status: "High dominance alert" },
      { id: "A-003", name: "Velvet Crown", server: "war-iron-clash-3", members: 9, districts: 47, dominance: 62, power: 88134, cashFlow: "$74k/h", conflicts: 9, founded: "2026-02-04", status: "Stabilized" },
      { id: "A-004", name: "Chrome Saints", server: "free-neon-rift-1", members: 8, districts: 18, dominance: 48, power: 22904, cashFlow: "$24k/h", conflicts: 5, founded: "2026-02-14", status: "Fast mode active" },
      { id: "A-005", name: "Ghost Ledger", server: "free-black-grid-2", members: 8, districts: 16, dominance: 44, power: 21227, cashFlow: "$21k/h", conflicts: 4, founded: "2026-02-19", status: "Fast mode active" },
      { id: "A-006", name: "Riot Dividend", server: "free-black-grid-2", members: 7, districts: 13, dominance: 37, power: 18441, cashFlow: "$17k/h", conflicts: 3, founded: "2026-03-01", status: "Stable" },
      { id: "A-007", name: "Zabijáci", server: "hra-alliance-ten-blackout", members: 2, districts: 7, dominance: 6, power: 11840, cashFlow: "$10k/h", conflicts: 3, founded: "2026-04-12", status: "NOC-BLACKOUT control" },
      { id: "A-008", name: "Ledová aliance", server: "hra-alliance-ten-blackout", members: 4, districts: 6, dominance: 5, power: 13220, cashFlow: "$11k/h", conflicts: 4, founded: "2026-04-12", status: "Enemy pressure line" }
    ],
    dashboardByServer: {
      "hra-alliance-ten-blackout": { meta: { status: "LIVE", uptime: "0d 03h 12m" }, playersTrend: [4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8, 8], attacks24h: [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3], clean: 62000, dirty: 41000, heat: [11, 6, 2, 1, 0], police: [2, 6, 3, 1], alerts: [{ severity: "critical", title: "NOC-BLACKOUT aktivní", detail: "Round preset: Day 3 • 20:30 • NOC-BLACKOUT." }, { severity: "warning", title: "Police incident districts", detail: "Policejní tlak aktivní v districtech 143 a 38." }, { severity: "warning", title: "Alliance request", detail: "Poltergeist poslal žádost o vstup do Zabijáci." }] },
      "war-district-war-alpha": { meta: { status: "LIVE", uptime: "18d 01h 10m" }, playersTrend: [18, 19, 19, 20, 21, 22, 23, 24, 25, 26, 26, 27], attacks24h: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17], clean: 296000, dirty: 184000, heat: [5, 9, 7, 4, 2], police: [8, 17, 9, 4], alerts: [{ severity: "critical", title: "Downtown raid spike", detail: "Raid volume crossed threshold in District War Alpha." }, { severity: "critical", title: "Dirty cash burst", detail: "Black Circuit shifted $84k dirty cash in two minutes." }, { severity: "warning", title: "Heat tier 300+", detail: "Two players passed hard crackdown range." }] },
      "war-sector-prime": { meta: { status: "LOCKED", uptime: "14d 17h 43m" }, playersTrend: [17, 18, 18, 19, 20, 21, 22, 22, 23, 24, 25, 25], attacks24h: [3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14], clean: 274000, dirty: 171000, heat: [4, 8, 6, 4, 2], police: [7, 15, 8, 3], alerts: [{ severity: "critical", title: "Dominance threshold reached", detail: "Neon Wolves drží 78% contested districts." }] },
      "war-iron-clash-3": { meta: { status: "LIVE", uptime: "9d 08h 21m" }, playersTrend: [14, 15, 15, 16, 17, 18, 19, 20, 20, 21, 22, 23], attacks24h: [2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 11], clean: 248000, dirty: 149000, heat: [5, 8, 5, 3, 1], police: [5, 11, 6, 2], alerts: [{ severity: "warning", title: "Residential spying net", detail: "Suspicious spying density rose by 18%." }] },
      "free-neon-rift-1": { meta: { status: "LIVE", uptime: "6d 04h 19m" }, playersTrend: [7, 8, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18], attacks24h: [1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9], clean: 182000, dirty: 96000, heat: [9, 6, 2, 1, 0], police: [4, 11, 4, 2], alerts: [{ severity: "warning", title: "Economy freeze pocket", detail: "Two Downtown blocks missed one income tick." }] },
      "free-black-grid-2": { meta: { status: "LIVE", uptime: "4d 11h 52m" }, playersTrend: [6, 7, 7, 8, 8, 9, 10, 12, 13, 14, 15, 16], attacks24h: [1, 1, 1, 2, 2, 3, 4, 4, 5, 6, 7, 8], clean: 168000, dirty: 88000, heat: [8, 5, 2, 1, 0], police: [3, 9, 3, 2], alerts: [{ severity: "warning", title: "Player report spike", detail: "Reports rose 34% in the last free-mode session." }] },
      "free-spark-yard-3": { meta: { status: "MAINTENANCE", uptime: "0d 00h 00m" }, playersTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], attacks24h: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], clean: 0, dirty: 0, heat: [0, 0, 0, 0, 0], police: [0, 0, 0, 0], alerts: [{ severity: "critical", title: "Server warning", detail: "Free server remains in maintenance beyond expected window." }] }
    },
    districts: [],
    buildings: [
      { type: "Restaurace", category: "legal", count: 214, avgIncome: 6200, avgHeat: 18, usageRate: "71%", topUpgrades: "Kitchen Sync, VIP Lounge", balanceStatus: "Stable", lastConfigChange: "2026-04-10 11:20", configPath: "balance/buildings/legal/restaurace.json", balanceKey: "buildings.restaurace" },
      { type: "Lékárna", category: "legal", count: 149, avgIncome: 5400, avgHeat: 22, usageRate: "64%", topUpgrades: "Supply Chain, Storage+", balanceStatus: "Stable", lastConfigChange: "2026-04-09 17:50", configPath: "balance/buildings/legal/lekarna.json", balanceKey: "buildings.lekarna" },
      { type: "Kasino", category: "legal", count: 132, avgIncome: 13800, avgHeat: 49, usageRate: "68%", topUpgrades: "VIP Tables, Fraud Shield", balanceStatus: "Watch", lastConfigChange: "2026-04-08 21:12", configPath: "balance/buildings/legal/kasino.json", balanceKey: "buildings.kasino" },
      { type: "Autosalon", category: "legal", count: 104, avgIncome: 11200, avgHeat: 36, usageRate: "53%", topUpgrades: "Luxury Tier, Export Route", balanceStatus: "Stable", lastConfigChange: "2026-04-06 15:03", configPath: "balance/buildings/legal/autosalon.json", balanceKey: "buildings.autosalon" },
      { type: "Fitness Club", category: "legal", count: 97, avgIncome: 4300, avgHeat: 14, usageRate: "41%", topUpgrades: "Premium Membership", balanceStatus: "Underused", lastConfigChange: "2026-04-01 09:30", configPath: "balance/buildings/legal/fitness-club.json", balanceKey: "buildings.fitnessClub" },
      { type: "Směnárna", category: "legal", count: 156, avgIncome: 8600, avgHeat: 41, usageRate: "75%", topUpgrades: "Spread Tuner, Risk Buffer", balanceStatus: "Watch", lastConfigChange: "2026-04-11 14:35", configPath: "balance/buildings/legal/smenarna.json", balanceKey: "buildings.smenarna" },
      { type: "Večerka", category: "legal", count: 245, avgIncome: 3100, avgHeat: 12, usageRate: "82%", topUpgrades: "Night Shift", balanceStatus: "Stable", lastConfigChange: "2026-04-03 19:16", configPath: "balance/buildings/legal/vecerka.json", balanceKey: "buildings.vecerka" },
      { type: "Strip club", category: "illegal", count: 118, avgIncome: 10200, avgHeat: 57, usageRate: "67%", topUpgrades: "VIP Room, Security Loop", balanceStatus: "Watch", lastConfigChange: "2026-04-07 12:22", configPath: "balance/buildings/illegal/strip-club.json", balanceKey: "buildings.stripClub" },
      { type: "Pouliční dealeři", category: "illegal", count: 271, avgIncome: 7400, avgHeat: 83, usageRate: "88%", topUpgrades: "Street Net, Silent Route", balanceStatus: "Hot", lastConfigChange: "2026-04-11 22:11", configPath: "balance/buildings/illegal/poulicni-dealeri.json", balanceKey: "buildings.streetDealers" },
      { type: "Drug lab", category: "illegal", count: 142, avgIncome: 16100, avgHeat: 112, usageRate: "79%", topUpgrades: "Purity Line, Heat Sink", balanceStatus: "Hot", lastConfigChange: "2026-04-10 07:18", configPath: "balance/buildings/illegal/drug-lab.json", balanceKey: "buildings.drugLab" },
      { type: "Pašovací tunel", category: "illegal", count: 84, avgIncome: 11900, avgHeat: 104, usageRate: "56%", topUpgrades: "Tunnel Mask, Relay Node", balanceStatus: "Watch", lastConfigChange: "2026-04-04 16:02", configPath: "balance/buildings/illegal/pasovaci-tunel.json", balanceKey: "buildings.smugglingTunnel" },
      { type: "Továrna", category: "infra", count: 126, avgIncome: 14500, avgHeat: 62, usageRate: "73%", topUpgrades: "Assembly Boost, Cooling Grid", balanceStatus: "Stable", lastConfigChange: "2026-04-09 08:44", configPath: "balance/buildings/infra/tovarna.json", balanceKey: "buildings.factory" },
      { type: "Zbrojovka", category: "infra", count: 74, avgIncome: 17200, avgHeat: 119, usageRate: "59%", topUpgrades: "Ballistics Forge", balanceStatus: "Hot", lastConfigChange: "2026-04-11 10:08", configPath: "balance/buildings/infra/zbrojovka.json", balanceKey: "buildings.armory" },
      { type: "Sklad", category: "infra", count: 201, avgIncome: 5100, avgHeat: 19, usageRate: "76%", topUpgrades: "Storage Matrix", balanceStatus: "Stable", lastConfigChange: "2026-04-05 20:14", configPath: "balance/buildings/infra/sklad.json", balanceKey: "buildings.storage" },
      { type: "Energetická stanice", category: "infra", count: 66, avgIncome: 9200, avgHeat: 35, usageRate: "61%", topUpgrades: "Power Relay", balanceStatus: "Stable", lastConfigChange: "2026-04-02 13:01", configPath: "balance/buildings/infra/energeticka-stanice.json", balanceKey: "buildings.powerStation" },
      { type: "Datové centrum", category: "infra", count: 58, avgIncome: 12700, avgHeat: 73, usageRate: "47%", topUpgrades: "Core Cluster, Trace Jammer", balanceStatus: "Watch", lastConfigChange: "2026-04-10 18:27", configPath: "balance/buildings/infra/datove-centrum.json", balanceKey: "buildings.dataCenter" }
    ]
  };

  const handcraftedDistricts = [
    { id: "D-A1", name: "Mercury Exchange", zone: "Commercial", server: "war-district-war-alpha", owner: "Vortex_77", alliance: "Black Circuit", buildings: "Kasino, Směnárna, Datové centrum", income: 248000, heat: 312, defenseStatus: "Fortified", activeEvents: "Crackdown watch", trapStatus: "Trap net armed", policePressure: "High", attackHistory: ["15:22 Black Circuit defended raid from Neon Wolves", "14:58 Raid attempt failed", "14:33 District lock contested"], spyingHistory: ["15:10 Spy packet intercepted", "14:42 Recon scan from rival alliance"], activeEffects: ["Defense +12%", "Dirty cash tax +4%"], production: ["Data shards x122/h", "Trap kits x8/h"], rumorFeed: ["Downtown courier route is compromised.", "Bounty broker seen near the exchange."], bountyMarker: "2 active bounty markers" },
    { id: "D-B4", name: "Cinder Works", zone: "Industrial", server: "war-district-war-alpha", owner: "NeroGhost", alliance: "Black Circuit", buildings: "Továrna, Zbrojovka, Sklad", income: 179000, heat: 224, defenseStatus: "Reinforced", activeEvents: "Factory overdrive", trapStatus: "Trap placeholder", policePressure: "Medium", attackHistory: ["15:08 Harbor raid success", "14:11 Ownership retained"], spyingHistory: ["15:01 Suspicious logistics probe"], activeEffects: ["Production +8%"], production: ["Ammo crates x57/h", "Ballistic alloy x24/h"], rumorFeed: ["Convoy route may be compromised."], bountyMarker: "No direct bounty marker" },
    { id: "D-C7", name: "Nova Commons", zone: "Downtown", server: "war-sector-prime", owner: "QbitHunter", alliance: "Neon Wolves", buildings: "Kasino, Strip club, Večerka", income: 202000, heat: 281, defenseStatus: "Critical perimeter", activeEvents: "Siege pressure", trapStatus: "Tripwire grid hot", policePressure: "High", attackHistory: ["15:00 Four-chain raid held", "14:20 Perimeter breach recovered"], spyingHistory: ["14:47 Drone intel leak"], activeEffects: ["Income +15%", "Heat output +10%"], production: ["Dirty cash laundering x188/h"], rumorFeed: ["Secret organization scouts are marking rooftops."], bountyMarker: "District sabotage bounty active" },
    { id: "D-E2", name: "Glass Park", zone: "Park", server: "free-neon-rift-1", owner: "NightFalcon", alliance: "Chrome Saints", buildings: "Fitness Club, Večerka, Restaurace", income: 118000, heat: 92, defenseStatus: "Stable", activeEvents: "Park rush", trapStatus: "Trap placeholder", policePressure: "Low", attackHistory: ["14:02 Fast takeover complete"], spyingHistory: ["13:38 Scout pass detected"], activeEffects: ["Market spread +7%"], production: ["Consumables x72/h"], rumorFeed: ["Ghost Ledger is tracking clean cash flow."], bountyMarker: "No active bounty marker" },
    { id: "D-F6", name: "Railyard Echo", zone: "Residential", server: "free-black-grid-2", owner: "DeltaRush", alliance: "Ghost Ledger", buildings: "Pouliční dealeři, Pašovací tunel, Sklad", income: 99000, heat: 74, defenseStatus: "Watch mode", activeEvents: "Convoy window", trapStatus: "Trap placeholder", policePressure: "Low", attackHistory: ["13:46 Minor raid skirmish"], spyingHistory: ["13:10 Smuggler route mapping"], activeEffects: ["Logistics speed +6%"], production: ["Transit packs x61/h"], rumorFeed: ["Possible convoy ambush tonight."], bountyMarker: "Watcher bounty marker active" },
    { id: "D-H9", name: "Redline Heights", zone: "Residential", server: "war-iron-clash-3", owner: "SilkVector", alliance: "Velvet Crown", buildings: "Autosalon, Restaurace, Energetická stanice", income: 141000, heat: 111, defenseStatus: "Watch towers ready", activeEvents: "Influence drift", trapStatus: "Trap lattice idle", policePressure: "Medium", attackHistory: ["14:50 Influence push repelled"], spyingHistory: ["14:22 Silent crawl detected"], activeEffects: ["Clean cash +9%"], production: ["Vehicle exports x39/h"], rumorFeed: ["A corporation fixer is buying up local scouts."], bountyMarker: "Single bounty tag on owner" },
    { id: "84", name: "District 84", zone: "Residential", server: "hra-alliance-ten-blackout", owner: "Host", alliance: "Zabijáci", buildings: "Pouliční dealeři, Sklad, Večerka", income: 11800, heat: 84, defenseStatus: "Blackout watch", activeEvents: "NOC-BLACKOUT pressure", trapStatus: "Trap net armed", policePressure: "Medium", attackHistory: ["20:30 Blackout shift started", "20:12 Border raid denied"], spyingHistory: ["20:17 Recon ping near sector edge"], activeEffects: ["Night income +6%", "Heat control -8%"], production: ["Dirty cash x19/h", "Supply packs x11/h"], rumorFeed: ["Ledová aliance marks nearby blocks."], bountyMarker: "No active bounty marker" },
    { id: "95", name: "District 95", zone: "Residential", server: "hra-alliance-ten-blackout", owner: "Host", alliance: "Zabijáci", buildings: "Lékárna, Večerka, Sklad", income: 10600, heat: 72, defenseStatus: "Reinforced", activeEvents: "Blackout patrol", trapStatus: "Tripwire grid", policePressure: "Medium", attackHistory: ["20:11 Perimeter stabilized"], spyingHistory: ["20:19 Silent trace captured"], activeEffects: ["Defense +4%"], production: ["Chemicals x9/h"], rumorFeed: ["Poltergeist scouts were seen near block line."], bountyMarker: "Watcher bounty marker active" },
    { id: "102", name: "District 102", zone: "Downtown", server: "hra-alliance-ten-blackout", owner: "Knedlík", alliance: "Zabijáci", buildings: "Směnárna, Kasino, Datové centrum", income: 14200, heat: 58, defenseStatus: "Fortified", activeEvents: "Alliance hold", trapStatus: "Trap lattice idle", policePressure: "Low", attackHistory: ["20:18 Ally hold confirmed"], spyingHistory: ["20:22 Suspicious packet route"], activeEffects: ["Clean cash +8%"], production: ["Data shards x7/h"], rumorFeed: ["District 102 is primary blackout anchor."], bountyMarker: "No active bounty marker" },
    { id: "143", name: "District 143", zone: "Industrial", server: "hra-alliance-ten-blackout", owner: "Poltergeist", alliance: "Ledová aliance", buildings: "Továrna, Zbrojovka, Sklad", income: 12900, heat: 131, defenseStatus: "Critical perimeter", activeEvents: "Police incident", trapStatus: "Killbox primed", policePressure: "High", attackHistory: ["20:21 Police sweep started"], spyingHistory: ["20:23 Signal jammer active"], activeEffects: ["Heat output +12%"], production: ["Ammo crates x14/h"], rumorFeed: ["Police units locked district entrances."], bountyMarker: "District under pressure marker" }
  ];

  const districtZonePlans = {
    "free-neon-rift-1": { Commercial: 34, Industrial: 29, Park: 21, Residential: 46, Downtown: 31 },
    "free-black-grid-2": { Commercial: 34, Industrial: 29, Park: 21, Residential: 46, Downtown: 31 },
    "free-spark-yard-3": { Commercial: 34, Industrial: 29, Park: 21, Residential: 46, Downtown: 31 },
    "hra-alliance-ten-blackout": { Commercial: 34, Industrial: 29, Park: 21, Residential: 46, Downtown: 31 },
    "war-district-war-alpha": { Commercial: 39, Industrial: 34, Park: 23, Residential: 52, Downtown: 38 },
    "war-sector-prime": { Commercial: 40, Industrial: 36, Park: 25, Residential: 55, Downtown: 38 },
    "war-iron-clash-3": { Commercial: 38, Industrial: 34, Park: 24, Residential: 54, Downtown: 38 }
  };

  const districtNamePools = {
    Commercial: ["Exchange", "Arcade", "Plaza", "Market", "Forum", "Crossing", "Bazaar", "Atrium", "Corner", "Quarter"],
    Industrial: ["Works", "Forge", "Depot", "Yard", "Foundry", "Plant", "Dock", "Refinery", "Mill", "Terminal"],
    Park: ["Gardens", "Park", "Commons", "Run", "Walk", "Fields", "Heights", "Grove", "Terrace", "Meadow"],
    Residential: ["Heights", "Blocks", "Residency", "Row", "Towers", "Gardens", "Courts", "Estate", "Homes", "Lane"],
    Downtown: ["Center", "Plaza", "Boulevard", "Spine", "Square", "Axis", "Hub", "Exchange", "Gate", "Core"]
  };

  const districtPrefixes = ["Neon", "Black", "Glass", "Redline", "Iron", "Velvet", "Ghost", "Mercury", "Cinder", "Nova", "Chrome", "Cipher", "Silent", "Copper", "Midnight", "Static", "Electric", "Rogue", "Obsidian", "Crimson"];
  const districtBuildingPools = {
    Commercial: ["Kasino", "Směnárna", "Restaurace", "Autosalon", "Datové centrum", "Večerka"],
    Industrial: ["Továrna", "Zbrojovka", "Sklad", "Energetická stanice", "Pašovací tunel", "Drug lab"],
    Park: ["Fitness Club", "Restaurace", "Večerka", "Datové centrum", "Lékárna", "Směnárna"],
    Residential: ["Večerka", "Pouliční dealeři", "Sklad", "Lékárna", "Restaurace", "Pašovací tunel"],
    Downtown: ["Kasino", "Strip club", "Směnárna", "Datové centrum", "Autosalon", "Večerka"]
  };

  function buildDistrictDataset(data) {
    const districts = [...handcraftedDistricts];
    const defenseByMode = { free: ["Stable", "Watch mode", "Rapid barricade"], war: ["Fortified", "Reinforced", "Critical perimeter", "Watch towers ready"] };
    const eventByMode = { free: ["Quick rush", "Park rush", "Fast takeover", "Supply burst", "Convoy window"], war: ["Crackdown watch", "Siege pressure", "Influence drift", "Factory overdrive", "Border lockdown"] };
    const trapByMode = { free: ["Trap placeholder", "Light snare", "Scout tripwire"], war: ["Trap net armed", "Tripwire grid hot", "Trap lattice idle", "Killbox primed"] };
    const policeByMode = { free: ["Low", "Low", "Medium"], war: ["Medium", "High", "High", "Critical"] };
    const baseIncomeByZone = {
      free: { Commercial: 116000, Industrial: 104000, Park: 88000, Residential: 82000, Downtown: 124000 },
      war: { Commercial: 146000, Industrial: 138000, Park: 112000, Residential: 108000, Downtown: 168000 }
    };

    const zonePlansByServer = Object.fromEntries(data.servers.map((server) => {
      const explicitPlan = server && typeof server.zonePlan === "object" ? server.zonePlan : null;
      const fallbackPlan = districtZonePlans[server.id] || buildZonePlanFromDistrictCount(server.districtCount, server.type);
      return [server.id, explicitPlan || fallbackPlan];
    }));

    Object.entries(zonePlansByServer).forEach(([serverId, zones]) => {
      const server = data.servers.find((item) => item.id === serverId);
      if (!server) return;
      const serverPlayers = data.players.filter((item) => item.server === serverId);
      const serverAlliances = data.alliances.filter((item) => item.server === serverId);
      const craftedCounts = handcraftedDistricts.filter((item) => item.server === serverId).reduce((acc, item) => ({ ...acc, [item.zone]: (acc[item.zone] || 0) + 1 }), {});
      const ownerPool = serverPlayers.length ? serverPlayers : [{ nickname: "Unclaimed", alliance: "Neutral", heat: 0 }];

      Object.entries(zones).forEach(([zone, total]) => {
        const remaining = total - (craftedCounts[zone] || 0);
        for (let index = 0; index < remaining; index += 1) {
          const ownerSeed = ownerPool[index % ownerPool.length];
          const allianceSeed = serverAlliances[index % Math.max(serverAlliances.length, 1)];
          const prefix = districtPrefixes[(index + zone.length + serverId.length) % districtPrefixes.length];
          const suffix = districtNamePools[zone][index % districtNamePools[zone].length];
          const districtNumber = String(index + 1).padStart(3, "0");
          const buildingPool = districtBuildingPools[zone];
          const buildingSet = [buildingPool[index % buildingPool.length], buildingPool[(index + 2) % buildingPool.length], buildingPool[(index + 4) % buildingPool.length]].join(", ");
          const isWar = server.type === "war";
          const income = baseIncomeByZone[server.type][zone] + (index % 7) * (isWar ? 4200 : 2600);
          const heat = (isWar ? 88 : 28) + (index % 11) * (isWar ? 14 : 6) + (zone === "Downtown" ? (isWar ? 58 : 22) : zone === "Industrial" ? 18 : 0);

          districts.push({
            id: `${serverId}-D-${zone.slice(0, 2).toUpperCase()}-${districtNumber}`,
            name: `${prefix} ${suffix} ${districtNumber}`,
            zone,
            server: serverId,
            owner: server.status === "maintenance" ? "Unclaimed" : ownerSeed.nickname,
            alliance: server.status === "maintenance" ? "Neutral Control" : (allianceSeed?.name || ownerSeed.alliance || "Independent"),
            buildings: buildingSet,
            income,
            heat,
            defenseStatus: defenseByMode[server.type][index % defenseByMode[server.type].length],
            activeEvents: eventByMode[server.type][index % eventByMode[server.type].length],
            trapStatus: trapByMode[server.type][index % trapByMode[server.type].length],
            policePressure: policeByMode[server.type][index % policeByMode[server.type].length],
            attackHistory: [`${15 - (index % 5)}:${String(50 - (index % 30)).padStart(2, "0")} Raid pressure on ${zone.toLowerCase()} line`, `${14 - (index % 3)}:${String(40 - (index % 25)).padStart(2, "0")} Defense rotation completed`],
            spyingHistory: [`${15 - (index % 4)}:${String(12 + (index % 40)).padStart(2, "0")} Spying sweep near ${prefix.toLowerCase()} corridor`, `${14 - (index % 2)}:${String(8 + (index % 45)).padStart(2, "0")} Recon trace flagged`],
            activeEffects: [zone === "Downtown" ? "Dirty cash +12%" : "Income +6%", isWar ? "Defense +8%" : "Heat decay boost +4%"],
            production: [zone === "Industrial" ? `Ammo crates x${18 + (index % 40)}/h` : `Supply packs x${12 + (index % 26)}/h`, zone === "Commercial" ? `Clean cash tickets x${24 + (index % 18)}/h` : `Trap kits x${4 + (index % 8)}/h`],
            rumorFeed: [`${prefix} route is under watch.`, isWar ? "Rival scouts are mapping district edges." : "Fast session crews are preparing a late push."],
            bountyMarker: heat > (isWar ? 220 : 100) ? "Bounty marker active" : "No active bounty marker"
          });
        }
      });
    });

    return districts;
  }

  mockData.districts = buildDistrictDataset(mockData);
  function rebuildDistrictDatasetWithPinnedLayouts() {
    const currentByServer = new Map();
    (Array.isArray(mockData.districts) ? mockData.districts : []).forEach((district) => {
      const serverId = String(district?.server || "");
      if (!serverId) return;
      if (!currentByServer.has(serverId)) currentByServer.set(serverId, []);
      currentByServer.get(serverId).push(district);
    });
    const pinnedServers = new Set();
    currentByServer.forEach((districts, serverId) => {
      const hasPolygon = districts.some((district) => Array.isArray(district?.polygon) && district.polygon.length >= 3);
      if (hasPolygon) pinnedServers.add(serverId);
    });
    const rebuilt = buildDistrictDataset(mockData);
    const merged = rebuilt.filter((district) => !pinnedServers.has(String(district?.server || "")));
    pinnedServers.forEach((serverId) => {
      const pinnedDistricts = currentByServer.get(serverId) || [];
      merged.push(...pinnedDistricts);
    });
    mockData.districts = merged;
  }

  const state = {
    activeSection: "Dashboard",
    selectedServer: "hra-alliance-ten-blackout",
    selectedPlayer: null,
    selectedAlliance: null,
    selectedDistrict: null,
    searchQuery: "",
    detailTitle: "Live Ops Detail",
    detailBody: "Vyber server, hráče, alianci nebo district pro detail.",
    filters: {
      dataSource: "mock",
      buildingType: "all",
      reportServer: "all",
      reportPlayer: "",
      reportAlliance: "",
      reportType: "all",
      reportTime: "",
      reportSeverity: "all",
      rankingMode: "players",
      serverDetailMapView: "live"
    }
  };

  Object.assign(mockData, {
    balanceConfigs: {
      global: {
        tickRate: "60s",
        matchRules: "Raid enabled / Bounty active / Spying live",
        maxPlayers: 20,
        allianceCap: 8,
        dominanceThreshold: "55%",
        cooldownMultipliers: "Attack 1.0 / Raid 1.15 / Spy 0.9",
        incomeMultipliers: "Clean 1.0 / Dirty 1.05",
        heatMultipliers: "Combat 1.2 / Crafting 0.8 / Transfer 1.1",
        policeAggression: "Tiered dynamic escalation",
        configPath: "client/mock-configs/global-balance.json"
      },
      free: {
        sessionLength: "1h 45m",
        attackCooldown: "8s",
        raidCooldown: "8s",
        incomeTick: "15m",
        heatDecay: "1.25x",
        maxPlayers: 20,
        districtCount: 161,
        zoneDistribution: "Commercial 34 / Industrial 29 / Park 21 / Residential 46 / Downtown 31",
        cleanCashRange: "$7k-$11k/h per active player",
        dirtyCashRange: "$3k-$6k/h per active player",
        configPath: "client/mock-configs/free-mode-balance.json"
      },
      war: {
        sessionLength: "10d",
        attackCooldown: "30s",
        raidCooldown: "30s",
        incomeTick: "60m",
        heatDecay: "0.9x",
        maxPlayers: 28,
        districtCount: 190,
        zoneDistribution: "Commercial 39 / Industrial 35 / Park 24 / Residential 54 / Downtown 38",
        cleanCashRange: "$10k-$18k/h per active player",
        dirtyCashRange: "$6k-$12k/h per active player",
        configPath: "client/mock-configs/war-mode-balance.json"
      }
    },
    economy: {
      resourceSinks: [{ title: "Attack upkeep", detail: "$612k clean / 24h" }, { title: "Raid repair costs", detail: "$184k dirty / 24h" }, { title: "Alliance conflict tax", detail: "$277k mixed / 24h" }],
      crafting: [{ title: "Crafting queue utilization", detail: "78%" }, { title: "Material burn", detail: "14.2k units / h" }, { title: "Blueprint conversion", detail: "318 crafts / h" }],
      circulation: [{ title: "Weapons in circulation", detail: "2,462 ks" }, { title: "Drugs in circulation", detail: "3,188 ks" }, { title: "High-risk batches", detail: "68 active" }]
    },
    police: {
      activeRaids: [{ title: "Downtown tactical sweep", detail: "19 active units" }, { title: "Checkpoint net", detail: "63 control actions / h" }, { title: "Asset seizure", detail: "27 confiscations / h" }],
      investigations: [{ title: "Alliance laundering chain", detail: "Pending analyst assignment" }, { title: "District sabotage reports", detail: "Evidence verification queued" }, { title: "Cross-server transfer anomaly", detail: "Financial trace running" }]
    },
    production: {
      activeDrugs: [{ title: "Drug lab Alpha", detail: "Ghost Serum x42/h on District War Alpha" }, { title: "Drug lab Cinder", detail: "Velvet Smoke x31/h on War Sector Prime" }, { title: "Street dealers Park", detail: "Pulse Shot x19/h on Neon Rift #1" }],
      activeWeapons: [{ title: "Armory C7", detail: "SMG batch x28/h on War Sector Prime" }, { title: "Factory B4", detail: "Ammo crate x74/h on District War Alpha" }, { title: "Armory E2", detail: "Handgun x16/h on Neon Rift #1" }],
      completed24h: [{ title: "Drug batches", detail: "1,284 completed" }, { title: "Weapon batches", detail: "932 completed" }, { title: "Component runs", detail: "1,740 completed" }],
      topItems: [{ title: "Ghost Serum", detail: "23% share" }, { title: "SMG pack", detail: "19% share" }, { title: "Ammo crate", detail: "17% share" }, { title: "Velvet Smoke", detail: "14% share" }],
      bottlenecks: [{ title: "Refined chemicals", detail: "High pressure. Deficit 12.4%" }, { title: "Ballistic alloy", detail: "High pressure. Deficit 9.1%" }, { title: "Circuit boards", detail: "Medium pressure. Deficit 4.3%" }],
      queues: [{ title: "Vortex_77", detail: "8 jobs queued. ETA 54m" }, { title: "QbitHunter", detail: "6 jobs queued. ETA 39m" }, { title: "NeroGhost", detail: "5 jobs queued. ETA 33m" }, { title: "NightFalcon", detail: "3 jobs queued. ETA 21m" }]
    },
    events: { system: [], city: [], police: [], crisis: [], admin: [] },
    logs: [],
    moderation: {
      openReports: [{ title: "Abuse reports pending", detail: "17 unresolved in the last 24h." }, { title: "Voice harassment claims", detail: "5 tickets waiting for assignment." }],
      flaggedPlayers: [{ title: "Vortex_77", detail: "Multiple high-risk reports in 12h." }, { title: "QbitHunter", detail: "Suspicious raid cadence detected." }],
      suspiciousBehavior: [{ title: "Rapid district pinging", detail: "Pattern matches scripted probing." }, { title: "Transfer loop cluster", detail: "Potential laundering chain." }],
      multiAccount: [{ title: "Multi-account placeholder", detail: "Cross-device fingerprint correlation pending." }],
      abuseLog: [{ title: "Chat abuse action", detail: "2 mutes, 1 temp ban in 24h." }, { title: "Threat language cluster", detail: "Auto-flagged in District War Alpha." }],
      punishments: [{ title: "Temp ban: NeroGhost", detail: "30m exploit probing cooldown bypass." }, { title: "Mute: DeltaRush", detail: "Global chat violation." }]
    },
    notifications: []
  });

  function buildOpsFeedData(data, focusServerId) {
    const focusServer = data.servers.find((item) => item.id === focusServerId) || data.servers[0];
    const serverNameById = Object.fromEntries(data.servers.map((item) => [item.id, item.name]));
    const sortedByHeat = data.districts.slice().sort((a, b) => b.heat - a.heat);
    const focusDistricts = data.districts.filter((item) => item.server === focusServer.id);
    const sortedFocusDistricts = focusDistricts.slice().sort((a, b) => b.heat - a.heat);
    const highHeatDistricts = sortedByHeat.filter((item) => item.heat >= 150).slice(0, 24);
    const maintenanceServers = data.servers.filter((item) => item.status !== "live");
    const dominantAlliances = data.alliances.filter((item) => item.dominance >= 70);
    const now = Date.now();
    const formatLogTime = (index) => {
      const minutesAgo = (index * 7) % (24 * 60);
      return new Date(now - minutesAgo * 60_000).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    };
    const typeCycle = ["combat", "spying", "crafting", "transfers", "bounty", "police", "moderation", "errors", "suspicious"];
    const playerFallback = data.players[0]?.nickname || "Unknown";
    const allianceFallback = data.alliances[0]?.name || "Independent";

    const events = {
      system: [
        { title: "Season checkpoint rotation", detail: `${data.districts.length} districts synced across ${data.servers.length} servers.` },
        { title: "Focus server context", detail: `${focusServer.name} • ${focusDistricts.length} districts • ${focusServer.players}/${focusServer.maxPlayers} players.` },
        { title: "Economy heartbeat", detail: `Clean ${data.servers.reduce((sum, server) => sum + server.cleanCashPerHour, 0).toLocaleString("cs-CZ")} /h, Dirty ${data.servers.reduce((sum, server) => sum + server.dirtyCashPerHour, 0).toLocaleString("cs-CZ")} /h.` }
      ],
      city: sortedFocusDistricts.slice(0, 8).map((district) => ({ title: `${district.name} (${district.zone})`, detail: `Income ${formatCurrency(district.income)}/h • Heat ${district.heat} • ${serverNameById[district.server]}` })),
      police: sortedFocusDistricts.filter((district) => district.heat >= 110).slice(0, 8).map((district) => ({ title: `Crackdown watch: ${district.name}`, detail: `${district.policePressure} pressure • ${district.trapStatus} • ${serverNameById[district.server]}` })),
      crisis: [
        ...maintenanceServers.map((server) => ({ title: `Server warning: ${server.name}`, detail: `${server.status.toUpperCase()} • ${server.players}/${server.maxPlayers} players online.` })),
        { title: "Exploit suspicion window", detail: `${highHeatDistricts.filter((district) => district.heat > 230).length} districts crossed hard-heat threshold.` }
      ],
      admin: [
        { title: "Manual cooldown review", detail: `${focusServer.type.toUpperCase()} mode window • 24h rolling feed.` },
        ...dominantAlliances.map((alliance) => ({ title: `Dominance audit: ${alliance.name}`, detail: `${alliance.dominance}% dominance on ${serverNameById[alliance.server]}.` }))
      ]
    };

    const logDistrictPool = [
      ...sortedFocusDistricts,
      ...data.districts.filter((district) => district.server !== focusServer.id).sort((a, b) => b.heat - a.heat)
    ].slice(0, 220);

    const logs = logDistrictPool.map((district, index) => {
      const type = typeCycle[index % typeCycle.length];
      const severity = district.heat >= 260 ? "critical" : district.heat >= 170 ? "high" : district.heat >= 100 ? "medium" : "low";
      const messageByType = {
        combat: `Raid pressure detected on ${district.name}.`,
        spying: `Spying trace reported near ${district.zone} corridor.`,
        crafting: `Production cycle completed in ${district.name}.`,
        transfers: `Cash transfer burst recorded in ${district.name}.`,
        bounty: `Bounty marker update: ${district.bountyMarker.toLowerCase()}.`,
        police: `Police action queued: ${district.policePressure.toLowerCase()} pressure.`,
        moderation: `Moderation check triggered by conflict pattern.`,
        errors: `Ops watchdog corrected a transient queue mismatch.`,
        suspicious: `Suspicious behavior pattern observed in ${district.name}.`
      };
      return {
        type,
        severity,
        server: serverNameById[district.server] || district.server,
        player: district.owner || playerFallback,
        alliance: district.alliance || allianceFallback,
        time: formatLogTime(index),
        message: `${messageByType[type]} [rolling 24h]`
      };
    });

    const notifications = [
      { category: "critical alerts", severity: "critical", text: `${sortedFocusDistricts.filter((district) => district.heat >= 170).length} focused districts are in high-heat pressure bands.` },
      { category: "server warnings", severity: maintenanceServers.length ? "high" : "medium", text: maintenanceServers.length ? `${maintenanceServers.map((server) => server.name).join(", ")} need admin attention.` : "No active server warning." },
      { category: "exploit suspicion", severity: "critical", text: `${logs.filter((log) => log.type === "suspicious" && log.server === focusServer.name).length} suspicious traces queued for ${focusServer.name}.` },
      { category: "dominance threshold reached", severity: dominantAlliances.length ? "high" : "medium", text: dominantAlliances.length ? `${dominantAlliances[0].name} holds ${dominantAlliances[0].dominance}% dominance.` : "No alliance crossed dominance threshold." },
      { category: "alliance overpower alert", severity: dominantAlliances.length > 1 ? "high" : "medium", text: `${dominantAlliances.length} alliances are over the dominance threshold.` },
      { category: "economy spike", severity: "medium", text: `${focusServer.name} cashflow ${formatCurrency(focusServer.cleanCashPerHour + focusServer.dirtyCashPerHour)}/h.` },
      { category: "too many raids", severity: focusServer.activeRaids >= 14 ? "high" : "medium", text: `${focusServer.activeRaids} active raids on ${focusServer.name}.` },
      { category: "player report spike", severity: "medium", text: `${data.players.reduce((sum, player) => sum + player.reports, 0)} player reports recorded in current cycle.` }
    ];

    return { events, logs, notifications };
  }

  function regenerateOpsFeedData() {
    const opsFeedData = buildOpsFeedData(mockData, state?.selectedServer || mockData.servers[0].id);
    mockData.events = opsFeedData.events;
    mockData.logs = opsFeedData.logs;
    mockData.notifications = opsFeedData.notifications;
  }

  const ui = {
    sidebarNav: document.getElementById("sidebar-nav"),
    serverSwitcher: document.getElementById("server-switcher"),
    dataSourceSwitcher: document.getElementById("data-source-switcher"),
    globalSearch: document.getElementById("global-search"),
    serverStatusChip: document.getElementById("server-status-chip"),
    uptimeChip: document.getElementById("uptime-chip"),
    currentTimeChip: document.getElementById("current-time-chip"),
    refreshBtn: document.getElementById("refresh-btn"),
    notificationsBtn: document.getElementById("notifications-btn"),
    notificationsCount: document.getElementById("notifications-count"),
    notificationsPop: document.getElementById("notifications-pop"),
    notificationsList: document.getElementById("notifications-list"),
    notificationsMuteBtn: document.getElementById("notifications-mute-btn"),
    overviewGrid: document.getElementById("overview-grid"),
    playersTrendBars: document.getElementById("players-trend-bars"),
    attacksBars: document.getElementById("attacks-bars"),
    cashSplit: document.getElementById("cash-split"),
    heatBars: document.getElementById("heat-bars"),
    policeActivityList: document.getElementById("police-activity-list"),
    topRankingList: document.getElementById("top-ranking-list"),
    topListCaption: document.getElementById("top-list-caption"),
    criticalAlertFeed: document.getElementById("critical-alert-feed"),
    detailPanel: document.getElementById("detail-panel"),
    opsLog: document.getElementById("ops-log"),
    topModeButtons: Array.from(document.querySelectorAll("[data-top-mode]")),
    quickActionButtons: Array.from(document.querySelectorAll("[data-action]")),
    sections: {
      "Dashboard": document.getElementById("section-dashboard"),
      "Servery": document.getElementById("section-servers"),
      "Server detail": document.getElementById("section-server-detail"),
      "Hráči": document.getElementById("section-players"),
      "Aliance": document.getElementById("section-alliances"),
      "Districts / mapa": document.getElementById("section-districts"),
      "Budovy": document.getElementById("section-buildings"),
      "Ekonomika": document.getElementById("section-economy"),
      "Policie / Heat": document.getElementById("section-police"),
      "Výroba": document.getElementById("section-production"),
      "Eventy": document.getElementById("section-events"),
      "Reports / logy": document.getElementById("section-reports"),
      "Moderace": document.getElementById("section-moderation"),
      "Notifikace": document.getElementById("section-notifications-center"),
      "Nastavení hry": document.getElementById("section-settings")
    }
  };

  Object.assign(ui, {
    serversTableBody: document.getElementById("servers-table-body"),
    playersTableBody: document.getElementById("players-table-body"),
    alliancesTableBody: document.getElementById("alliances-table-body"),
    districtGrid: document.getElementById("district-grid"),
    buildingsTableBody: document.getElementById("buildings-table-body"),
    buildingFilterButtons: Array.from(document.querySelectorAll("[data-building-filter]")),
    economySnapshotBtn: document.getElementById("economy-snapshot-btn"),
    economyOverviewGrid: document.getElementById("economy-overview-grid"),
    economyTopBuildings: document.getElementById("economy-top-buildings"),
    economyTopPlayers: document.getElementById("economy-top-players"),
    economyTopAlliances: document.getElementById("economy-top-alliances"),
    economyResourceSinks: document.getElementById("economy-resource-sinks"),
    economyCrafting: document.getElementById("economy-crafting"),
    economyCirculation: document.getElementById("economy-circulation"),
    policeActionButtons: Array.from(document.querySelectorAll("[data-police-action]")),
    policeActiveRaids: document.getElementById("police-active-raids"),
    policeHeatDistribution: document.getElementById("police-heat-distribution"),
    policeDistrictPressure: document.getElementById("police-district-pressure"),
    policeInvestigations: document.getElementById("police-investigations"),
    policeAverageHeat: document.getElementById("police-average-heat"),
    policeWanted: document.getElementById("police-wanted"),
    policeLogs: document.getElementById("police-logs"),
    productionOverviewGrid: document.getElementById("production-overview-grid"),
    productionDrugs: document.getElementById("production-drugs"),
    productionWeapons: document.getElementById("production-weapons"),
    productionCompleted: document.getElementById("production-completed"),
    productionTopItems: document.getElementById("production-top-items"),
    productionBottlenecks: document.getElementById("production-bottlenecks"),
    productionQueues: document.getElementById("production-queues"),
    eventsSystem: document.getElementById("events-system"),
    eventsCity: document.getElementById("events-city"),
    eventsPolice: document.getElementById("events-police"),
    eventsCrisis: document.getElementById("events-crisis"),
    eventsAdmin: document.getElementById("events-admin"),
    eventActionButtons: Array.from(document.querySelectorAll("[data-event-action]")),
    eventFormName: document.getElementById("event-form-name"),
    eventFormType: document.getElementById("event-form-type"),
    eventFormDescription: document.getElementById("event-form-description"),
    eventFormServer: document.getElementById("event-form-server"),
    eventFormDuration: document.getElementById("event-form-duration"),
    eventFormReward: document.getElementById("event-form-reward"),
    eventFormDistricts: document.getElementById("event-form-districts"),
    eventFormPriority: document.getElementById("event-form-priority"),
    reportFilterServer: document.getElementById("report-filter-server"),
    reportFilterPlayer: document.getElementById("report-filter-player"),
    reportFilterAlliance: document.getElementById("report-filter-alliance"),
    reportFilterType: document.getElementById("report-filter-type"),
    reportFilterTime: document.getElementById("report-filter-time"),
    reportFilterSeverity: document.getElementById("report-filter-severity"),
    reportsLogPanel: document.getElementById("reports-log-panel"),
    modActionButtons: Array.from(document.querySelectorAll("[data-mod-action]")),
    modOpenReports: document.getElementById("mod-open-reports"),
    modFlaggedPlayers: document.getElementById("mod-flagged-players"),
    modSuspiciousBehavior: document.getElementById("mod-suspicious-behavior"),
    modMultiAccount: document.getElementById("mod-multi-account"),
    modAbuseLog: document.getElementById("mod-abuse-log"),
    modPunishments: document.getElementById("mod-punishments"),
    notificationsCenterList: document.getElementById("notifications-center-list"),
    detailModal: document.getElementById("detail-modal"),
    detailModalBackdrop: document.getElementById("detail-modal-backdrop"),
    detailModalClose: document.getElementById("detail-modal-close"),
    detailModalTitle: document.getElementById("detail-modal-title"),
    detailModalBody: document.getElementById("detail-modal-body"),
    detailModalFooter: document.getElementById("detail-modal-footer"),
    settingsTickRate: document.getElementById("settings-tick-rate"),
    settingsMatchRules: document.getElementById("settings-match-rules"),
    settingsMaxPlayers: document.getElementById("settings-max-players"),
    settingsAllianceCap: document.getElementById("settings-alliance-cap"),
    settingsDominanceThreshold: document.getElementById("settings-dominance-threshold"),
    settingsCooldownMultipliers: document.getElementById("settings-cooldown-multipliers"),
    settingsIncomeMultipliers: document.getElementById("settings-income-multipliers"),
    settingsHeatMultipliers: document.getElementById("settings-heat-multipliers"),
    settingsPoliceAggression: document.getElementById("settings-police-aggression"),
    settingsFreeSessionLength: document.getElementById("settings-free-session-length"),
    settingsFreeAttackCooldown: document.getElementById("settings-free-attack-cooldown"),
    settingsFreeRaidCooldown: document.getElementById("settings-free-raid-cooldown"),
    settingsFreeIncomeTick: document.getElementById("settings-free-income-tick"),
    settingsFreeHeatDecay: document.getElementById("settings-free-heat-decay"),
    settingsFreeMaxPlayers: document.getElementById("settings-free-max-players"),
    settingsWarSessionLength: document.getElementById("settings-war-session-length"),
    settingsWarAttackCooldown: document.getElementById("settings-war-attack-cooldown"),
    settingsWarRaidCooldown: document.getElementById("settings-war-raid-cooldown"),
    settingsWarIncomeTick: document.getElementById("settings-war-income-tick"),
    settingsWarHeatDecay: document.getElementById("settings-war-heat-decay"),
    settingsWarMaxPlayers: document.getElementById("settings-war-max-players"),
    serverCreateName: document.getElementById("server-create-name"),
    serverCreateTemplate: document.getElementById("server-create-template"),
    serverCreateType: document.getElementById("server-create-type"),
    serverCreateStatus: document.getElementById("server-create-status"),
    serverCreateStartTime: document.getElementById("server-create-start-time"),
    serverCreateMaxPlayers: document.getElementById("server-create-max-players"),
    serverCreateDistrictCount: document.getElementById("server-create-district-count"),
    serverCreateZoneCommercial: document.getElementById("server-create-zone-commercial"),
    serverCreateZoneIndustrial: document.getElementById("server-create-zone-industrial"),
    serverCreateZonePark: document.getElementById("server-create-zone-park"),
    serverCreateZoneResidential: document.getElementById("server-create-zone-residential"),
    serverCreateZoneDowntown: document.getElementById("server-create-zone-downtown"),
    serverCreateSessionLength: document.getElementById("server-create-session-length"),
    serverCreateAllianceCap: document.getElementById("server-create-alliance-cap"),
    serverCreateStartClean: document.getElementById("server-create-start-clean"),
    serverCreateStartDirty: document.getElementById("server-create-start-dirty"),
    serverCreateStartMaterials: document.getElementById("server-create-start-materials"),
    serverCreateStartChemicals: document.getElementById("server-create-start-chemicals"),
    serverCreateSummary: document.getElementById("server-create-summary"),
    serverPreviewMapCaption: document.getElementById("server-preview-map-caption"),
    serverPreviewMapLegend: document.getElementById("server-preview-map-legend"),
    serverPreviewMapGrid: document.getElementById("server-preview-map-grid"),
    serverPreviewMapHover: document.getElementById("server-preview-map-hover"),
    serverPreviewZoomIn: document.getElementById("server-preview-zoom-in"),
    serverPreviewZoomOut: document.getElementById("server-preview-zoom-out"),
    serverPreviewReset: document.getElementById("server-preview-reset"),
    serverCreateApplyTemplateBtn: document.getElementById("server-create-apply-template"),
    serverCreatePreviewBtn: document.getElementById("server-create-preview"),
    serverCreateSubmitBtn: document.getElementById("server-create-submit"),
    serverDetailMetrics: document.getElementById("server-detail-metrics"),
    serverDetailActions: document.getElementById("server-detail-actions"),
    serverDetailMap: document.getElementById("server-detail-map"),
    serverDetailPlayers: document.getElementById("server-detail-players"),
    serverDetailViewLiveBtn: document.getElementById("server-detail-view-live"),
    serverDetailViewLayoutBtn: document.getElementById("server-detail-view-layout")
  });

  function formatCurrency(value) { return `$${Number(value || 0).toLocaleString("cs-CZ")}`; }
  function formatTimeAgo(minutes) { const value = Number(minutes || 0); if (value <= 1) return "před 1m"; if (value < 60) return `před ${value}m`; return `před ${Math.floor(value / 60)}h`; }
  function getStatusClass(status) { const value = String(status || "").toLowerCase(); if (["live", "online", "stable"].includes(value)) return "status-badge--live"; if (["locked", "critical", "hot"].includes(value)) return "status-badge--locked"; return "status-badge--maintenance"; }
  function getHeatLabel(heat) { const value = Number(heat || 0); if (value >= 300) return "Heat 300+"; if (value >= 150) return "Heat 150-299"; if (value >= 75) return "Heat 75-149"; if (value >= 25) return "Heat 25-74"; return "Heat 0-24"; }
  function createBadge(text, variant) { return `<span class="${variant}">${text}</span>`; }
  function filterCollection(collection, resolver) { const query = state.searchQuery.trim().toLowerCase(); return collection.filter((item) => !query || resolver(item).toLowerCase().includes(query)); }
  const zoneOrder = ["Commercial", "Industrial", "Park", "Residential", "Downtown"];
  const zoneColorMap = {
    Commercial: "#0369a1",
    Industrial: "#7c3aed",
    Park: "#16a34a",
    Residential: "#d97706",
    Downtown: "#dc2626"
  };
  const previewIndexBuildingPools = {
    Commercial: {
      early: [
        { key: "early-stable-1", tier: "early", title: "Stabilní provoz", buildings: ["Restaurace", "Fitness Club"] },
        { key: "early-stable-2", tier: "early", title: "Civilní utility", buildings: ["Restaurace", "Lékárna"] },
        { key: "early-cash", tier: "early", title: "Lehký cashflow", buildings: ["Restaurace", "Směnárna"] },
        { key: "early-launder", tier: "early", title: "Startovní laundering", buildings: ["Autosalon", "Restaurace"] }
      ],
      mid: [
        { key: "mid-balance-1", tier: "mid", title: "Utility growth", buildings: ["Autosalon", "Lékárna"] },
        { key: "mid-corp-1", tier: "mid", title: "Korporátní stabilita", buildings: ["Kancelářský blok", "Restaurace"] },
        { key: "mid-mall-1", tier: "mid", title: "Hlavní retail", buildings: ["Obchodní centrum", "Restaurace"] },
        { key: "mid-mix-2", tier: "mid", title: "Prací front", buildings: ["Autosalon", "Směnárna", "Restaurace"] }
      ],
      top: [
        { key: "top-casino-1", tier: "top", title: "Kasino hotspot", buildings: ["Kasino", "Restaurace"] },
        { key: "top-casino-3", tier: "top", title: "Black cash engine", buildings: ["Kasino", "Směnárna", "Autosalon"] },
        { key: "top-mall-2", tier: "top", title: "Financial boulevard", buildings: ["Obchodní centrum", "Směnárna", "Restaurace"] }
      ]
    },
    Residential: {
      early: [
        { key: "res-early-1", tier: "early", title: "Startovní růst", buildings: ["Bytový blok", "Garage"] },
        { key: "res-early-2", tier: "early", title: "Stabilní základna", buildings: ["Bytový blok", "Brainwash centrum"] },
        { key: "res-early-3", tier: "early", title: "První nábor", buildings: ["Bytový blok", "Rekrutační centrum"] }
      ],
      mid: [
        { key: "res-mid-1", tier: "mid", title: "Mobilní posily", buildings: ["Bytový blok", "Rekrutační centrum", "Garage"] },
        { key: "res-mid-2", tier: "mid", title: "Udržitelný růst", buildings: ["Bytový blok", "Klinika"] },
        { key: "res-mid-3", tier: "mid", title: "Disciplína a kvalita", buildings: ["Bytový blok", "Škola"] }
      ],
      late: [
        { key: "res-late-1", tier: "late", title: "Válečné zázemí", buildings: ["Bytový blok", "Rekrutační centrum", "Klinika"] },
        { key: "res-late-2", tier: "late", title: "Mobilní tlak", buildings: ["Rekrutační centrum", "Garage", "Klinika"] },
        { key: "res-late-4", tier: "late", title: "Elitní rezidenční zóna", buildings: ["Bytový blok", "Škola", "Klinika"] }
      ]
    },
    Park: {
      early: [
        { key: "park-early-1", tier: "early", title: "Street cash", buildings: ["Pouliční dealeři", "Večerka"] },
        { key: "park-early-2", tier: "early", title: "Quick runners", buildings: ["Pouliční dealeři", "Pašovací tunel"] },
        { key: "park-early-3", tier: "early", title: "Night cover", buildings: ["Strip club", "Večerka"] }
      ],
      mid: [
        { key: "park-mid-1", tier: "mid", title: "Distribution lane", buildings: ["Drug lab", "Pašovací tunel"] },
        { key: "park-mid-2", tier: "mid", title: "Vice market", buildings: ["Strip club", "Pouliční dealeři"] },
        { key: "park-mid-4", tier: "mid", title: "Hidden production", buildings: ["Drug lab", "Večerka"] }
      ],
      top: [
        { key: "park-top-1", tier: "top", title: "Chaos corridor", buildings: ["Drug lab", "Pašovací tunel", "Pouliční dealeři"] },
        { key: "park-top-2", tier: "top", title: "Vice empire", buildings: ["Drug lab", "Strip club"] },
        { key: "park-top-4", tier: "top", title: "Hot route", buildings: ["Drug lab", "Pašovací tunel", "Večerka"] }
      ]
    },
    Industrial: {
      early: [
        { key: "ind-early-1", tier: "early", title: "Základní výroba", buildings: ["Továrna", "Sklad"] },
        { key: "ind-early-2", tier: "early", title: "Napájená produkce", buildings: ["Továrna", "Energetická stanice"] },
        { key: "ind-early-3", tier: "early", title: "První militarizace", buildings: ["Továrna", "Zbrojovka"] }
      ],
      mid: [
        { key: "ind-mid-1", tier: "mid", title: "Vojenská výroba", buildings: ["Zbrojovka", "Sklad"] },
        { key: "ind-mid-2", tier: "mid", title: "Technický provoz", buildings: ["Továrna", "Datové centrum"] },
        { key: "ind-mid-6", tier: "mid", title: "Výzkum a obrana", buildings: ["Výzkumné centrum", "Zbrojovka"] }
      ],
      top: [
        { key: "ind-top-1", tier: "top", title: "Arms grid", buildings: ["Továrna", "Zbrojovka", "Sklad"] },
        { key: "ind-top-2", tier: "top", title: "Power forge", buildings: ["Továrna", "Zbrojovka", "Energetická stanice"] },
        { key: "ind-top-5", tier: "top", title: "War research nexus", buildings: ["Zbrojovka", "Výzkumné centrum", "Datové centrum"] }
      ]
    },
    Downtown: {
      mid: [
        { key: "down-mid-1", tier: "mid", title: "Městské finance", buildings: ["Centrální banka", "Magistrát"] },
        { key: "down-mid-3", tier: "mid", title: "Právní tlak", buildings: ["Soud", "Lobby klub"] },
        { key: "down-mid-4", tier: "mid", title: "Volatilní kapitál", buildings: ["Burza", "VIP salonek"] }
      ],
      high: [
        { key: "down-high-1", tier: "high", title: "Korporátní kontrola", buildings: ["Centrální banka", "Lobby klub"] },
        { key: "down-high-2", tier: "high", title: "Státní pevnost", buildings: ["Magistrát", "Soud"] },
        { key: "down-high-4", tier: "high", title: "Burzovní manipulace", buildings: ["Burza", "Lobby klub"] }
      ],
      core: [
        { key: "down-core-1", tier: "core", title: "Capital nexus", buildings: ["Centrální banka", "Magistrát", "VIP salonek"] },
        { key: "down-core-2", tier: "core", title: "Shadow exchange", buildings: ["Burza", "Lobby klub", "VIP salonek"] },
        { key: "down-core-4", tier: "core", title: "System override", buildings: ["Centrální banka", "Soud", "Lobby klub"] }
      ]
    }
  };
  const previewDistrictDefenseByType = {
    free: ["Stable", "Watch mode", "Rapid barricade"],
    war: ["Fortified", "Reinforced", "Critical perimeter", "Watch towers ready"]
  };
  const previewDistrictEventByType = {
    free: ["Quick rush", "Park rush", "Fast takeover", "Supply burst", "Convoy window"],
    war: ["Crackdown watch", "Siege pressure", "Influence drift", "Factory overdrive", "Border lockdown"]
  };
  const previewDistrictTrapByType = {
    free: ["Trap placeholder", "Light snare", "Scout tripwire"],
    war: ["Trap net armed", "Tripwire grid hot", "Trap lattice idle", "Killbox primed"]
  };
  const previewDistrictPoliceByType = {
    free: ["Low", "Low", "Medium"],
    war: ["Medium", "High", "High", "Critical"]
  };
  const zoneWeightsByType = {
    free: { Commercial: 0.211, Industrial: 0.18, Park: 0.13, Residential: 0.286, Downtown: 0.193 },
    war: { Commercial: 0.21, Industrial: 0.185, Park: 0.127, Residential: 0.283, Downtown: 0.195 }
  };
  let serverPreviewDistrictLookup = new Map();
  let serverDetailDistrictLookup = new Map();
  let serverPreviewLayout = { total: 0 };
  let serverPreviewNeighbors = new Map();
  let serverPreviewHoveredIndex = -1;
  let serverPreviewFocusedZone = "";
  const serverPreviewView = {
    width: 760,
    height: 420,
    scale: 1,
    tx: 0,
    ty: 0,
    minScale: 1,
    maxScale: 2.8
  };
  const serverPreviewDrag = {
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0
  };
  function buildZonePlanFromDistrictCount(districtCount, serverType = "war") {
    const total = Math.max(25, Math.floor(Number(districtCount) || 161));
    const weights = zoneWeightsByType[String(serverType || "war").toLowerCase()] || zoneWeightsByType.war;
    const base = {};
    let allocated = 0;
    zoneOrder.forEach((zone) => {
      const count = Math.floor(total * Number(weights[zone] || 0));
      base[zone] = Math.max(0, count);
      allocated += base[zone];
    });
    let remainder = total - allocated;
    let index = 0;
    while (remainder > 0) {
      const zone = zoneOrder[index % zoneOrder.length];
      base[zone] += 1;
      remainder -= 1;
      index += 1;
    }
    return base;
  }
  function calculateZonePlanTotal(zonePlan) {
    return zoneOrder.reduce((sum, zone) => sum + Math.max(0, Math.floor(Number(zonePlan?.[zone] || 0))), 0);
  }
  function writeServerCreatorZoneInputs(zonePlan) {
    const safePlan = zonePlan && typeof zonePlan === "object" ? zonePlan : buildZonePlanFromDistrictCount(161, "war");
    if (ui.serverCreateZoneCommercial) ui.serverCreateZoneCommercial.value = String(Math.max(0, Math.floor(Number(safePlan.Commercial || 0))));
    if (ui.serverCreateZoneIndustrial) ui.serverCreateZoneIndustrial.value = String(Math.max(0, Math.floor(Number(safePlan.Industrial || 0))));
    if (ui.serverCreateZonePark) ui.serverCreateZonePark.value = String(Math.max(0, Math.floor(Number(safePlan.Park || 0))));
    if (ui.serverCreateZoneResidential) ui.serverCreateZoneResidential.value = String(Math.max(0, Math.floor(Number(safePlan.Residential || 0))));
    if (ui.serverCreateZoneDowntown) ui.serverCreateZoneDowntown.value = String(Math.max(0, Math.floor(Number(safePlan.Downtown || 0))));
  }
  function resolveScheduleCountdownLabel(startAt) {
    if (!startAt) return "ihned";
    const target = new Date(startAt).getTime();
    if (!Number.isFinite(target)) return "neplatný čas";
    const deltaMs = target - Date.now();
    if (deltaMs <= 0) return "spuštění teď";
    const totalMinutes = Math.max(1, Math.floor(deltaMs / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `za ${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `za ${hours}h ${minutes}m`;
    return `za ${minutes}m`;
  }
  function createUniqueEntityId(prefix, collection, fallbackIndex = 1) {
    const safePrefix = String(prefix || "ID").toUpperCase();
    let index = Math.max(1, Math.floor(Number(fallbackIndex) || 1));
    let candidate = `${safePrefix}-${String(index).padStart(4, "0")}`;
    const existing = new Set((Array.isArray(collection) ? collection : []).map((item) => String(item?.id || "")));
    while (existing.has(candidate)) {
      index += 1;
      candidate = `${safePrefix}-${String(index).padStart(4, "0")}`;
    }
    return candidate;
  }
  function createDemoAlliancesForServer(config, serverId) {
    const allianceCount = Math.max(2, Math.min(4, Math.floor(config.maxPlayers / 5) || 2));
    const namesPool = ["Neon Vultures", "Iron Syndicate", "Ghost Ledger", "Velvet Riot", "Crimson Node", "Chrome Saints"];
    const created = [];
    for (let index = 0; index < allianceCount; index += 1) {
      const allianceName = index === 0
        ? `${config.name} Core`
        : `${namesPool[index % namesPool.length]} ${index}`;
      const districts = Math.max(1, Math.floor(config.districtCount / (allianceCount + 2)) + (index % 2));
      created.push({
        id: createUniqueEntityId("A", mockData.alliances.concat(created), mockData.alliances.length + index + 1),
        name: allianceName,
        server: serverId,
        members: 0,
        districts,
        dominance: Math.max(1, Math.min(100, Math.round((districts / Math.max(1, config.districtCount)) * 100))),
        power: 12000 + (index * 3400),
        cashFlow: `$${Math.max(8, Math.round((config.startResources.cleanCash + config.startResources.dirtyCash) / 1000) + index * 2)}k/h`,
        conflicts: 1 + (index % 4),
        founded: new Date().toISOString().slice(0, 10),
        status: index === 0 ? "Demo control" : "Demo active"
      });
    }
    return created;
  }
  function createDemoPlayersForServer(config, serverId, alliances) {
    const factionPool = ["Mafia", "Cartel", "Motorkářský gang", "Korporace", "Tajná organizace", "Hackeři", "Soukromá armáda", "Pouliční gang"];
    const nickPool = ["Host", "Cipher", "Raven", "Switch", "Nyra", "Victor", "Leon", "Qbit", "Delta", "Silk", "Morrow", "Vortex"];
    const playerCount = Math.max(4, Math.min(config.maxPlayers, 8));
    const created = [];
    for (let index = 0; index < playerCount; index += 1) {
      const alliance = alliances[index % alliances.length];
      const nickname = `${nickPool[index % nickPool.length]}_${String(index + 1).padStart(2, "0")}`;
      const districts = Math.max(1, Math.floor((config.districtCount / Math.max(1, playerCount)) * (0.65 + ((index % 4) * 0.08))));
      const cleanBase = config.startResources.cleanCash + (index * 1800);
      const dirtyBase = config.startResources.dirtyCash + (index * 1200);
      const heat = Math.max(12, Math.floor(24 + (index * 11) + (config.type === "war" ? 22 : 0)));
      created.push({
        id: createUniqueEntityId("P", mockData.players.concat(created), mockData.players.length + index + 1),
        nickname,
        server: serverId,
        faction: factionPool[index % factionPool.length],
        alliance: alliance?.name || "Independent",
        districts,
        cleanCash: cleanBase,
        dirtyCash: dirtyBase,
        heat,
        online: true,
        lastActivityMinutes: 1 + (index % 5),
        reports: index % 3 === 0 ? 1 : 0,
        suspicion: heat >= 140 ? "warning" : "none",
        profile: "Demo server profile. Generated for admin testing.",
        economy: `Clean +$${Math.max(2, Math.round(cleanBase / 15000))}k/h. Dirty +$${Math.max(1, Math.round(dirtyBase / 17000))}k/h.`,
        districtInfo: `${districts} controlled districts.`,
        production: `Materials x${Math.max(6, config.startResources.materials + (index % 8))}/h.`,
        attacks: `${2 + (index % 5)} raid attempts / 24h.`,
        spying: `${1 + (index % 4)} spying runs / 24h.`,
        heatHistory: `${Math.max(0, heat - 18)} to ${heat} dnes.`,
        lastLogs: `Demo bootstrap tick for ${nickname}.`
      });
    }
    return created;
  }
  function buildDashboardPresetFromDemo(config, demoPlayers, demoDistricts) {
    const onlinePlayers = Math.max(0, demoPlayers.length);
    const clean = Math.max(0, Math.round(demoPlayers.reduce((sum, player) => sum + Number(player.cleanCash || 0), 0) * 0.09));
    const dirty = Math.max(0, Math.round(demoPlayers.reduce((sum, player) => sum + Number(player.dirtyCash || 0), 0) * 0.08));
    const heatValues = demoDistricts.map((district) => Math.max(0, Number(district.heat || 0)));
    const bucket = [0, 0, 0, 0, 0];
    heatValues.forEach((value) => {
      if (value >= 300) bucket[4] += 1;
      else if (value >= 150) bucket[3] += 1;
      else if (value >= 75) bucket[2] += 1;
      else if (value >= 25) bucket[1] += 1;
      else bucket[0] += 1;
    });
    const attacks24h = Array.from({ length: 12 }, (_, index) => Math.max(0, Math.round((onlinePlayers * 0.2) + ((index % 4) * 0.7) + (config.type === "war" ? 1 : 0))));
    const playersTrend = Array.from({ length: 12 }, (_, index) => Math.max(0, Math.min(config.maxPlayers, Math.round((onlinePlayers * 0.4) + (index * (onlinePlayers / 14))))));
    const police = [
      Math.max(1, Math.round(onlinePlayers * 0.25)),
      Math.max(1, Math.round(onlinePlayers * 0.6)),
      Math.max(1, Math.round(onlinePlayers * 0.35)),
      Math.max(0, Math.round(onlinePlayers * 0.15))
    ];
    return {
      meta: { status: String(config.status || "scheduled").toUpperCase(), uptime: "0d 00h 00m" },
      playersTrend,
      attacks24h,
      clean,
      dirty,
      heat: bucket,
      police,
      alerts: [
        { severity: "warning", title: "Server scheduled", detail: `${config.name} start ${formatDateTimeLocalLabel(config.startAt)} (${resolveScheduleCountdownLabel(config.startAt)}).` },
        { severity: "warning", title: "Demo roster generated", detail: `${onlinePlayers} demo players created with start resources.` }
      ]
    };
  }
  function readServerCreatorZoneInputs(serverType, districtCount) {
    const fallback = buildZonePlanFromDistrictCount(districtCount, serverType);
    const zonePlan = {
      Commercial: Math.max(0, Math.floor(Number(ui.serverCreateZoneCommercial?.value || fallback.Commercial || 0))),
      Industrial: Math.max(0, Math.floor(Number(ui.serverCreateZoneIndustrial?.value || fallback.Industrial || 0))),
      Park: Math.max(0, Math.floor(Number(ui.serverCreateZonePark?.value || fallback.Park || 0))),
      Residential: Math.max(0, Math.floor(Number(ui.serverCreateZoneResidential?.value || fallback.Residential || 0))),
      Downtown: Math.max(0, Math.floor(Number(ui.serverCreateZoneDowntown?.value || fallback.Downtown || 0)))
    };
    const total = calculateZonePlanTotal(zonePlan);
    if (total <= 0) {
      writeServerCreatorZoneInputs(fallback);
      return fallback;
    }
    return zonePlan;
  }
  function buildServerPreviewDistricts(config) {
    const zonePlan = config.zonePlan || buildZonePlanFromDistrictCount(config.districtCount, config.type);
    const totalDistricts = Math.max(1, calculateZonePlanTotal(zonePlan));
    const ownerPool = config.type === "free"
      ? ["Unclaimed", "NightFalcon", "DeltaRush", "Ghost Ledger"]
      : ["Host", "Knedlík", "Poltergeist", "Mariah", "Willy", "Ledovec"];
    const districts = [];
    zoneOrder.forEach((zone) => {
      const count = Math.max(0, Math.floor(Number(zonePlan[zone] || 0)));
      const names = districtNamePools[zone] || ["Sector"];
      const buildingsPool = districtBuildingPools[zone] || ["Sklad"];
      const baseIncome = config.type === "free" ? 7600 : 12400;
      for (let index = 0; index < count; index += 1) {
        const seed = districts.length + 1;
        const prefix = districtPrefixes[(seed + zone.length + config.name.length) % districtPrefixes.length];
        const suffix = names[index % names.length];
        const districtId = `${config.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "SRV"}-${String(seed).padStart(3, "0")}`;
        const owner = ownerPool[index % ownerPool.length];
        const buildings = [
          buildingsPool[index % buildingsPool.length],
          buildingsPool[(index + 2) % buildingsPool.length],
          buildingsPool[(index + 4) % buildingsPool.length]
        ].join(", ");
        const heat = (config.type === "free" ? 22 : 64) + ((index * 7) % (config.type === "free" ? 62 : 164)) + (zone === "Downtown" ? 18 : 0);
        districts.push({
          id: districtId,
          zone,
          name: `${prefix} ${suffix} ${String(index + 1).padStart(2, "0")}`,
          owner,
          alliance: owner === "Unclaimed" ? "Neutral" : (owner === "Host" || owner === "Knedlík" ? "Zabijáci" : "Ledová aliance"),
          buildings,
          income: baseIncome + ((index % 7) * (config.type === "free" ? 460 : 880)),
          heat,
          defenseStatus: previewDistrictDefenseByType[config.type][index % previewDistrictDefenseByType[config.type].length],
          activeEvents: previewDistrictEventByType[config.type][index % previewDistrictEventByType[config.type].length],
          trapStatus: previewDistrictTrapByType[config.type][index % previewDistrictTrapByType[config.type].length],
          policePressure: previewDistrictPoliceByType[config.type][index % previewDistrictPoliceByType[config.type].length],
          production: zone === "Industrial" ? `Ammo crates x${8 + (index % 21)}/h` : `Supply packs x${5 + (index % 16)}/h`,
          attackHistory: `${String(20 - (index % 6)).padStart(2, "0")}:${String((12 + index) % 60).padStart(2, "0")} Raid pressure detected`,
          spyingHistory: `${String(19 - (index % 5)).padStart(2, "0")}:${String((22 + index) % 60).padStart(2, "0")} Recon trace flagged`,
          bountyMarker: heat >= (config.type === "free" ? 88 : 160) ? "Bounty marker active" : "No active bounty marker"
        });
      }
    });
    if (districts.length !== totalDistricts) {
      return districts.slice(0, totalDistricts);
    }
    return districts;
  }
  function formatDateTimeLocalLabel(value) {
    if (!value) return "ihned";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "neplatný čas";
    return date.toLocaleString("cs-CZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function toDateTimeLocalValue(date) {
    const d = date instanceof Date ? date : new Date();
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const year = safe.getFullYear();
    const month = String(safe.getMonth() + 1).padStart(2, "0");
    const day = String(safe.getDate()).padStart(2, "0");
    const hours = String(safe.getHours()).padStart(2, "0");
    const minutes = String(safe.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  const serverCreatorPresets = {
    "free-rush": {
      name: "Free Rush Node",
      type: "free",
      status: "scheduled",
      startOffsetMin: 20,
      maxPlayers: 20,
      districtCount: 161,
      sessionLength: "1h 45m",
      allianceCap: 8,
      startResources: { cleanCash: 9000, dirtyCash: 4500, materials: 22, chemicals: 10 }
    },
    "war-season": {
      name: "War Season Node",
      type: "war",
      status: "scheduled",
      startOffsetMin: 60,
      maxPlayers: 28,
      districtCount: 190,
      sessionLength: "10d",
      allianceCap: 10,
      startResources: { cleanCash: 22000, dirtyCash: 12000, materials: 58, chemicals: 34 }
    },
    "hra-blackout": {
      name: "HRA Blackout Node",
      type: "war",
      status: "scheduled",
      startOffsetMin: 30,
      maxPlayers: 20,
      districtCount: 161,
      sessionLength: "NOC-BLACKOUT / Den 3",
      allianceCap: 4,
      startResources: { cleanCash: 12000, dirtyCash: 7000, materials: 30, chemicals: 16 }
    }
  };
  function applyServerCreatorTemplate(templateKey) {
    const key = String(templateKey || "").trim().toLowerCase();
    const preset = serverCreatorPresets[key] || serverCreatorPresets["hra-blackout"];
    if (!preset) return;
    if (ui.serverCreateTemplate) ui.serverCreateTemplate.value = key;
    if (ui.serverCreateName) ui.serverCreateName.value = preset.name;
    if (ui.serverCreateType) ui.serverCreateType.value = preset.type;
    if (ui.serverCreateStatus) ui.serverCreateStatus.value = preset.status;
    if (ui.serverCreateStartTime) ui.serverCreateStartTime.value = toDateTimeLocalValue(new Date(Date.now() + Math.max(1, Number(preset.startOffsetMin || 30)) * 60 * 1000));
    if (ui.serverCreateMaxPlayers) ui.serverCreateMaxPlayers.value = String(preset.maxPlayers);
    if (ui.serverCreateDistrictCount) ui.serverCreateDistrictCount.value = String(preset.districtCount);
    if (ui.serverCreateSessionLength) ui.serverCreateSessionLength.value = preset.sessionLength;
    if (ui.serverCreateAllianceCap) ui.serverCreateAllianceCap.value = String(preset.allianceCap);
    if (ui.serverCreateStartClean) ui.serverCreateStartClean.value = String(preset.startResources.cleanCash);
    if (ui.serverCreateStartDirty) ui.serverCreateStartDirty.value = String(preset.startResources.dirtyCash);
    if (ui.serverCreateStartMaterials) ui.serverCreateStartMaterials.value = String(preset.startResources.materials);
    if (ui.serverCreateStartChemicals) ui.serverCreateStartChemicals.value = String(preset.startResources.chemicals);
    writeServerCreatorZoneInputs(buildZonePlanFromDistrictCount(preset.districtCount, preset.type));
    renderServerCreatorPreview();
  }
  function getSelectedServer() { return mockData.servers.find((server) => server.id === state.selectedServer) || mockData.servers[0]; }
  function getSelectedDashboard() { return mockData.dashboardByServer[state.selectedServer] || mockData.dashboardByServer[mockData.servers[0].id]; }
  function pushOpsLog(message) { const entry = document.createElement("div"); entry.className = "ops-item"; entry.innerHTML = `<strong>${message}</strong><span>${new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>`; ui.opsLog.prepend(entry); while (ui.opsLog.children.length > 14) ui.opsLog.removeChild(ui.opsLog.lastElementChild); }
  function renderList(node, rows) { node.innerHTML = rows.map((item) => `<div class="activity-item"><strong>${item.title}</strong><span>${item.detail}</span></div>`).join(""); }
  async function loadJsonConfig(path) { const response = await fetch(path, { cache: "no-store" }); if (!response.ok) throw new Error(`Config load failed: ${path}`); return response.json(); }
  async function loadBalanceConfigs() {
    const paths = {
      global: mockData.balanceConfigs.global.configPath,
      free: mockData.balanceConfigs.free.configPath,
      war: mockData.balanceConfigs.war.configPath
    };
    try {
      const [globalConfig, freeConfig, warConfig] = await Promise.all([loadJsonConfig(paths.global), loadJsonConfig(paths.free), loadJsonConfig(paths.war)]);
      mockData.balanceConfigs.global = {
        ...mockData.balanceConfigs.global,
        tickRate: globalConfig.tickRate,
        matchRules: globalConfig.matchRules,
        maxPlayers: globalConfig.maxPlayersDefault,
        allianceCap: globalConfig.allianceCapDefault,
        dominanceThreshold: `${Math.round(globalConfig.dominanceThresholdDefault * 100)}%`,
        cooldownMultipliers: `Attack ${globalConfig.cooldownMultipliers.attack} / Raid ${globalConfig.cooldownMultipliers.raid} / Spy ${globalConfig.cooldownMultipliers.spy}`,
        incomeMultipliers: `Clean ${globalConfig.incomeMultipliers.clean} / Dirty ${globalConfig.incomeMultipliers.dirty}`,
        heatMultipliers: `Combat ${globalConfig.heatMultipliers.combat} / Crafting ${globalConfig.heatMultipliers.crafting} / Transfer ${globalConfig.heatMultipliers.transfer}`,
        policeAggression: globalConfig.policeAggression
      };
      mockData.balanceConfigs.free = {
        ...mockData.balanceConfigs.free,
        sessionLength: `${Math.floor(freeConfig.sessionLengthMinutes / 60)}h ${freeConfig.sessionLengthMinutes % 60}m`,
        attackCooldown: `${freeConfig.attackCooldownSeconds}s`,
        raidCooldown: `${freeConfig.raidCooldownSeconds}s`,
        incomeTick: `${freeConfig.incomeTickMinutes}m`,
        heatDecay: `${freeConfig.heatDecayMultiplier}x`,
        maxPlayers: freeConfig.maxPlayers,
        districtCount: freeConfig.districtCount,
        zoneDistribution: `Commercial ${freeConfig.zones.Commercial} / Industrial ${freeConfig.zones.Industrial} / Park ${freeConfig.zones.Park} / Residential ${freeConfig.zones.Residential} / Downtown ${freeConfig.zones.Downtown}`,
        cleanCashRange: `$${freeConfig.economy.cleanCashPerHourPerActivePlayer.min / 1000}k-$${freeConfig.economy.cleanCashPerHourPerActivePlayer.max / 1000}k/h per active player`,
        dirtyCashRange: `$${freeConfig.economy.dirtyCashPerHourPerActivePlayer.min / 1000}k-$${freeConfig.economy.dirtyCashPerHourPerActivePlayer.max / 1000}k/h per active player`
      };
      mockData.balanceConfigs.war = {
        ...mockData.balanceConfigs.war,
        sessionLength: `${warConfig.sessionLengthDays}d`,
        attackCooldown: `${warConfig.attackCooldownSeconds}s`,
        raidCooldown: `${warConfig.raidCooldownSeconds}s`,
        incomeTick: `${warConfig.incomeTickMinutes}m`,
        heatDecay: `${warConfig.heatDecayMultiplier}x`,
        maxPlayers: warConfig.maxPlayers,
        districtCount: warConfig.districtCount,
        zoneDistribution: `Commercial ${warConfig.zones.Commercial} / Industrial ${warConfig.zones.Industrial} / Park ${warConfig.zones.Park} / Residential ${warConfig.zones.Residential} / Downtown ${warConfig.zones.Downtown}`,
        cleanCashRange: `$${warConfig.economy.cleanCashPerHourPerActivePlayer.min / 1000}k-$${warConfig.economy.cleanCashPerHourPerActivePlayer.max / 1000}k/h per active player`,
        dirtyCashRange: `$${warConfig.economy.dirtyCashPerHourPerActivePlayer.min / 1000}k-$${warConfig.economy.dirtyCashPerHourPerActivePlayer.max / 1000}k/h per active player`
      };
      pushOpsLog("Balance config loaded from JSON");
    } catch (error) {
      pushOpsLog("Balance config fallback: embedded mock data");
    }
  }

  function renderSidebar() {
    ui.sidebarNav.innerHTML = "";
    filterCollection(Object.keys(ui.sections), (item) => item).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `nav-btn${state.activeSection === item ? " is-active" : ""}`;
      button.dataset.navItem = item;
      button.textContent = item;
      ui.sidebarNav.appendChild(button);
    });
  }

  function renderTopbar() {
    const server = getSelectedServer();
    const dashboard = getSelectedDashboard();
    ui.serverStatusChip.textContent = dashboard.meta.status;
    ui.serverStatusChip.className = `chip ${dashboard.meta.status === "LIVE" ? "chip--status" : ""}`.trim();
    ui.uptimeChip.textContent = `Uptime ${dashboard.meta.uptime}`;
    ui.notificationsCount.textContent = String(mockData.notifications.length);
    ui.serverSwitcher.innerHTML = mockData.servers.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    ui.serverSwitcher.value = server.id;
    ui.dataSourceSwitcher.value = state.filters.dataSource;
    ui.globalSearch.value = state.searchQuery;
  }

  function renderDashboardOverview() {
    const server = getSelectedServer();
    const dashboard = getSelectedDashboard();
    const totalCash = Math.max(1, dashboard.clean + dashboard.dirty);
    const freeServerCount = mockData.servers.filter((item) => item.type === "free").length;
    const hraServerCount = mockData.servers.filter((item) => item.id === "hra-alliance-ten-blackout" || item.name === "HRA").length;
    const warServerCount = mockData.servers.filter((item) => item.type === "war" && item.id !== "hra-alliance-ten-blackout").length;
    const cards = [
      { label: "Aktivní servery", value: mockData.servers.length, delta: `${freeServerCount} free / ${warServerCount} war / ${hraServerCount} HRA`, trend: "is-up" },
      { label: "Online hráči", value: server.players, delta: server.type === "war" ? "Long session" : "Fast session", trend: "is-up" },
      { label: "Mapa districtů", value: server.districtCount || 161, delta: server.type === "free" ? "Quick map pool" : "Extended war map", trend: "is-up" },
      { label: "Probíhající raidy", value: dashboard.attacks24h[dashboard.attacks24h.length - 1] || 0, delta: "24h peak", trend: "is-up" },
      { label: "Police pressure", value: dashboard.police[0] || 0, delta: "Dynamic tier", trend: "is-down" },
      { label: "Clean cash flow / h", value: formatCurrency(dashboard.clean), delta: "Empire economy", trend: "is-up" },
      { label: "Dirty cash flow / h", value: formatCurrency(dashboard.dirty), delta: "Risk economy", trend: "is-up" },
      { label: "Kritické alerty", value: dashboard.alerts.length, delta: "Ops stream", trend: dashboard.alerts.length > 1 ? "is-down" : "is-up" },
      { label: "Aktivita za 24h", value: `${dashboard.attacks24h.reduce((sum, value) => sum + value, 0)} akcí`, delta: getHeatLabel(Math.max(...dashboard.heat)), trend: "is-up" }
    ];
    ui.overviewGrid.innerHTML = cards.map((card) => `<article class="metric-card"><div class="metric-card__label">${card.label}</div><div class="metric-card__value">${card.value}</div><div class="metric-card__delta ${card.trend}">${card.delta}</div></article>`).join("");
    const maxPlayers = Math.max(...dashboard.playersTrend, 1);
    ui.playersTrendBars.innerHTML = dashboard.playersTrend.map((value) => `<div class="bar-item" style="height:${Math.max(8, Math.round((value / maxPlayers) * 100))}%;" title="${value}"></div>`).join("");
    const maxAttacks = Math.max(...dashboard.attacks24h, 1);
    ui.attacksBars.innerHTML = dashboard.attacks24h.map((value) => `<div class="bar-item" style="height:${Math.max(8, Math.round((value / maxAttacks) * 100))}%;" title="${value}"></div>`).join("");
    ui.cashSplit.innerHTML = `<div class="split-row"><span>Clean cash</span><div class="split-bar split-bar--clean"><span style="width:${Math.round((dashboard.clean / totalCash) * 100)}%;"></span></div><strong>${formatCurrency(dashboard.clean)}</strong></div><div class="split-row"><span>Dirty cash</span><div class="split-bar split-bar--dirty"><span style="width:${Math.round((dashboard.dirty / totalCash) * 100)}%;"></span></div><strong>${formatCurrency(dashboard.dirty)}</strong></div>`;
    const heatLabels = ["Heat 0-24", "Heat 25-74", "Heat 75-149", "Heat 150-299", "Heat 300+"];
    const maxHeat = Math.max(...dashboard.heat, 1);
    ui.heatBars.innerHTML = dashboard.heat.map((value, index) => `<div class="heat-row"><span>${heatLabels[index]}</span><div class="heat-track"><span style="width:${Math.round((value / maxHeat) * 100)}%;"></span></div><strong>${value}</strong></div>`).join("");
    const policeNotes = ["District raids", "Checkpoints", "Seizures", "Building locks"];
    ui.policeActivityList.innerHTML = dashboard.police.map((value, index) => `<div class="activity-item"><strong>${policeNotes[index]}: ${value}</strong><span>${server.name}</span></div>`).join("");
    const ranking = state.filters.rankingMode === "players"
      ? mockData.players.filter((item) => item.server === server.id).sort((a, b) => b.districts - a.districts).slice(0, 5).map((item, index) => `<div class="ranking-item"><div class="rank-pill">${index + 1}</div><div><strong>${item.nickname}</strong><span>${item.districts} districts. ${getHeatLabel(item.heat)}</span></div><em>${item.alliance}</em></div>`)
      : mockData.alliances.filter((item) => item.server === server.id).sort((a, b) => b.dominance - a.dominance).slice(0, 5).map((item, index) => `<div class="ranking-item"><div class="rank-pill">${index + 1}</div><div><strong>${item.name}</strong><span>${item.members} členů. ${item.districts} districts</span></div><em>${item.dominance}%</em></div>`);
    ui.topListCaption.textContent = state.filters.rankingMode === "players" ? "Nejaktivnější hráči" : "Nejsilnější aliance";
    ui.topRankingList.innerHTML = ranking.join("");
    ui.criticalAlertFeed.innerHTML = dashboard.alerts.map((item) => `<div class="alert-item ${item.severity === "critical" ? "is-critical" : "is-warning"}"><strong>${item.title}</strong><span>${item.detail}</span></div>`).join("");
    ui.notificationsList.innerHTML = mockData.notifications.map((item) => `<div class="notif-item ${item.severity === "critical" ? "is-critical" : "is-warning"}"><strong>${item.category}</strong><span>${item.text}</span></div>`).join("");
  }

  function renderServersSection() { ui.serversTableBody.innerHTML = filterCollection(mockData.servers, (item) => `${item.name} ${item.type} ${item.status} ${item.leader}`).map((server) => `<tr data-server-id="${server.id}"><td><strong>${server.name}</strong></td><td>${createBadge(server.type.toUpperCase(), `type-badge type-badge--${server.type}`)}</td><td>${createBadge(server.status.toUpperCase(), `status-badge ${getStatusClass(server.status)}`)}</td><td>${server.players}</td><td>${server.maxPlayers}</td><td>${server.sessionLength}</td><td><span class="dominance-badge ${server.dominance >= 70 ? "dominance-badge--high" : ""}">${server.leader} • ${server.dominance}%</span></td><td><div class="table-action-row"><button class="table-action-btn" type="button" data-open-server="${server.id}">Open</button><button class="table-action-btn" type="button">Detail</button><button class="table-action-btn table-action-btn--danger" type="button">Lock</button></div></td></tr>`).join(""); }
  function derivePlayerServerAssets(player, serverId = "") {
    if (String(serverId) === "hra-alliance-ten-blackout") {
      const hraPreset = {
        Host: { materials: 34, chemicals: 18, weapons: 7, drugs: 11 },
        "Knedlík": { materials: 17, chemicals: 9, weapons: 3, drugs: 5 },
        Poltergeist: { materials: 19, chemicals: 14, weapons: 5, drugs: 8 },
        Mariah: { materials: 16, chemicals: 10, weapons: 4, drugs: 6 },
        Willy: { materials: 15, chemicals: 8, weapons: 3, drugs: 4 },
        Ledovec: { materials: 18, chemicals: 11, weapons: 4, drugs: 7 }
      };
      const byName = hraPreset[String(player?.nickname || "")];
      if (byName) return byName;
    }
    const seed = hashPreviewSeed(`${player.id}:${player.nickname}:${player.server}`);
    const materials = 12 + (seed % 57) + Math.max(0, Math.floor(Number(player.districts || 0) * 1.2));
    const chemicals = 6 + (Math.floor(seed / 7) % 34) + Math.max(0, Math.floor(Number(player.heat || 0) / 30));
    const weapons = 1 + (Math.floor(seed / 11) % 12) + Math.max(0, Math.floor(Number(player.districts || 0) / 4));
    const drugs = 3 + (Math.floor(seed / 13) % 18) + Math.max(0, Math.floor(Number(player.dirtyCash || 0) / 90000));
    return { materials, chemicals, weapons, drugs };
  }
  const scenarioAllianceIconByNamePreview = new Map([
    ["zabijáci", "lightning"],
    ["ledová aliance", "broken_shield"],
    ["stínoví vlci", "wolf_head"]
  ]);
  function resolveAllianceIconKeyPreview(allianceName = "") {
    const key = normalizeOwnerNamePreview(allianceName);
    return scenarioAllianceIconByNamePreview.get(key) || "";
  }
  function resolveAllianceSymbolByIconKey(iconKey = "", allianceName = "") {
    const key = String(iconKey || "").trim().toLowerCase();
    if (key === "lightning") return "⚡";
    if (key === "broken_shield") return "🛡";
    if (key === "wolf_head") return "🐺";
    return resolveAllianceSymbol(allianceName);
  }
  function resolveAllianceSymbol(allianceName = "") {
    const value = String(allianceName || "").toLowerCase();
    if (value.includes("zabij")) return "☠";
    if (value.includes("ledov")) return "❄";
    if (value.includes("black circuit")) return "◆";
    if (value.includes("neon")) return "✦";
    if (value.includes("velvet")) return "♛";
    if (value.includes("chrome")) return "⚙";
    if (value.includes("ghost")) return "◈";
    return "•";
  }
  function resolveOwnerTag(owner = "") {
    const name = String(owner || "").trim();
    if (!name || name.toLowerCase() === "unclaimed") return "";
    return name.length <= 8 ? name : `${name.slice(0, 8)}…`;
  }
  function renderServerDetailSection() {
    if (!ui.serverDetailMetrics || !ui.serverDetailActions || !ui.serverDetailMap || !ui.serverDetailPlayers) return;
    const server = getSelectedServer();
    const dashboard = getSelectedDashboard();
    const serverPlayers = mockData.players.filter((item) => item.server === server.id);
    const serverDistricts = sortDistrictsForStableLayout(
      mockData.districts
        .filter((item) => item.server === server.id)
        .map((district, index) => normalizeDistrictRecordForServer(server, district, index))
    );
    const serverLogs = mockData.logs.filter((item) => item.server === server.name || item.server === server.id).slice(0, 12);
    const hraExtraActions = server.id === "hra-alliance-ten-blackout"
      ? [
        { title: "NOC-BLACKOUT", detail: "Aktivní režim noci • incident districts 143 a 38." },
        { title: "Aliance request", detail: "Poltergeist čeká na potvrzení vstupu do Zabijáci." },
        { title: "Live objective", detail: "Udržet distrikty 84/95/102 pod kontrolou do konce blackout okna." }
      ]
      : [];
    const liveActions = [
      ...dashboard.alerts.map((item) => ({ title: item.title, detail: item.detail })),
      ...hraExtraActions,
      ...mockData.events.city.slice(0, 3),
      ...serverLogs.map((log) => ({ title: `${log.type.toUpperCase()} • ${log.severity}`, detail: log.message }))
    ].slice(0, 10);
    ui.serverDetailMetrics.innerHTML = [
      { label: "Server", value: server.name, delta: `${server.type.toUpperCase()} • ${server.status.toUpperCase()}` },
      { label: "Hráči", value: `${server.players}/${server.maxPlayers}`, delta: `Session ${server.sessionLength}` },
      { label: "Districty", value: String(server.districtCount), delta: `Leader ${server.leader}` },
      { label: "Ekonomika", value: `${formatCurrency(dashboard.clean + dashboard.dirty)}/h`, delta: `Clean ${formatCurrency(dashboard.clean)} • Dirty ${formatCurrency(dashboard.dirty)}` }
    ].map((item) => `<article class="metric-card"><div class="metric-card__label">${item.label}</div><div class="metric-card__value">${item.value}</div><div class="metric-card__delta is-up">${item.delta}</div></article>`).join("");
    renderList(ui.serverDetailActions, liveActions);
    const zoneFromType = {
      downtown: "Downtown",
      residential: "Residential",
      industrial: "Industrial",
      commercial: "Commercial",
      park: "Park"
    };
    const isHraServer = server.id === "hra-alliance-ten-blackout";
    let mapSourceDistricts = [];
    let city = null;
    if (isHraServer && window.Empire?.CityGen?.generate) {
      city = window.Empire.CityGen.generate({
        seed: "empire-city-v1",
        width: serverPreviewView.width,
        height: serverPreviewView.height,
        districtCount: 161
      });
      const explicitById = new Map(
        serverDistricts
          .filter((district) => Number.isFinite(Number(district?.id)))
          .map((district) => [Number(district.id), district])
      );
      const cityDistricts = Array.isArray(city?.districts) ? city.districts : [];
      mapSourceDistricts = cityDistricts.map((district) => {
        const districtId = Number(district.id);
        const explicit = explicitById.get(districtId) || null;
        const zone = explicit?.zone || zoneFromType[String(district?.type || "").toLowerCase()] || "Residential";
        const baseIncomeByZone = { Commercial: 12400, Industrial: 12100, Park: 9800, Residential: 9400, Downtown: 13600 };
        const fallbackHeat = 26;
        return {
          id: String(districtId),
          name: explicit?.name || `District ${districtId}`,
          zone,
          server: server.id,
          owner: "Unclaimed",
          alliance: "Neutral",
          ownerNick: null,
          ownerAllianceName: null,
          ownerAllianceIconKey: null,
          buildings: explicit?.buildings || [],
          income: Number(explicit?.income || baseIncomeByZone[zone] || 10000),
          heat: Number(explicit?.heat || fallbackHeat),
          defenseStatus: explicit?.defenseStatus || "Stable",
          activeEvents: explicit?.activeEvents || "None",
          trapStatus: explicit?.trapStatus || "Trap placeholder",
          policePressure: explicit?.policePressure || "Low",
          attackHistory: explicit?.attackHistory || ["No major incidents logged."],
          spyingHistory: explicit?.spyingHistory || ["No active spying trace."],
          activeEffects: explicit?.activeEffects || ["No active effects"],
          production: explicit?.production || ["Supply packs x8/h"],
          rumorFeed: explicit?.rumorFeed || ["District remains under routine observation."],
          bountyMarker: explicit?.bountyMarker || "No active bounty marker",
          polygon: district.polygon
        };
      });
      assignPreviewDistrictBuildingSets(mapSourceDistricts);
      const ownershipByDistrictId = buildHraOwnershipFromPlayerState(serverPlayers, cityDistricts.length);
      mapSourceDistricts = mapSourceDistricts.map((district) => {
        const ownership = ownershipByDistrictId.get(Number(district.id));
        if (!ownership) return district;
        return {
          ...district,
          owner: ownership.owner,
          alliance: ownership.alliance,
          ownerNick: ownership.ownerNick,
          ownerAllianceName: ownership.ownerAllianceName,
          ownerAllianceIconKey: ownership.ownerAllianceIconKey
        };
      });
      mapSourceDistricts.forEach((district) => {
        const explicit = explicitById.get(Number(district.id));
        if (!explicit) return;
        if (explicit.buildings) {
          district.buildings = String(explicit.buildings).split(",").map((item) => item.trim()).filter(Boolean);
        }
        if (explicit.owner) district.owner = explicit.owner;
        if (explicit.alliance) district.alliance = explicit.alliance;
        if (explicit.ownerNick) district.ownerNick = explicit.ownerNick;
        if (explicit.ownerAllianceName) district.ownerAllianceName = explicit.ownerAllianceName;
        if (explicit.ownerAllianceIconKey) district.ownerAllianceIconKey = explicit.ownerAllianceIconKey;
        if (explicit.policePressure) district.policePressure = explicit.policePressure;
        if (explicit.activeEvents) district.activeEvents = explicit.activeEvents;
        if (explicit.defenseStatus) district.defenseStatus = explicit.defenseStatus;
      });
    } else {
      const districtCount = Math.max(1, serverDistricts.length || server.districtCount || 1);
      const zonePlan = server.zonePlan || districtZonePlans[server.id] || buildZonePlanFromDistrictCount(districtCount, server.type);
      mapSourceDistricts = serverDistricts.length
        ? serverDistricts
        : buildServerPreviewDistricts({
          name: server.name,
          type: server.type,
          districtCount,
          zonePlan
        }).map((district, index) => normalizeDistrictRecordForServer(server, district, index));
      city = window.Empire?.CityGen?.generate
        ? window.Empire.CityGen.generate({
          seed: Number(server.mapSeed) || resolveCityPreviewSeed({
            name: server.name,
            type: server.type,
            districtCount: mapSourceDistricts.length,
            zonePlan
          }),
          width: serverPreviewView.width,
          height: serverPreviewView.height,
          districtCount: mapSourceDistricts.length
        })
        : null;
    }
    const cityPolygonsById = new Map(
      (Array.isArray(city?.districts) ? city.districts : [])
        .filter((item) => Number.isFinite(Number(item?.id)))
        .map((item) => [String(item.id), item.polygon])
    );
    const cityPolygonsByIndex = Array.isArray(city?.districts) ? city.districts : [];
    const mapPolygons = mapSourceDistricts.map((district, index) => {
      const polyFromId = cityPolygonsById.get(String(district.id));
      const poly = Array.isArray(district?.polygon)
        ? district.polygon
        : (Array.isArray(polyFromId) ? polyFromId : cityPolygonsByIndex[index]?.polygon);
      if (Array.isArray(poly) && poly.length >= 3) return { district, polygon: poly };
      const row = Math.floor(index / 14);
      const col = index % 14;
      const x = 20 + (col * 50);
      const y = 40 + (row * 30);
      return { district, polygon: [[x, y], [x + 44, y], [x + 44, y + 24], [x, y + 24]] };
    });
    const viewMode = state.filters.serverDetailMapView === "layout" ? "layout" : "live";
    if (ui.serverDetailViewLiveBtn) ui.serverDetailViewLiveBtn.classList.toggle("is-active", viewMode === "live");
    if (ui.serverDetailViewLayoutBtn) ui.serverDetailViewLayoutBtn.classList.toggle("is-active", viewMode === "layout");
    const mapDistrictsSvg = mapPolygons.map((entry, index) => {
      const district = entry.district;
      const zone = district.zone || "Residential";
      const color = zoneColorMap[zone] || "#64748b";
      const points = entry.polygon.map((point) => `${Number(point?.[0] || 0).toFixed(1)},${Number(point?.[1] || 0).toFixed(1)}`).join(" ");
      const isUnclaimed = String(district.owner || "").toLowerCase() === "unclaimed";
      const ownerStroke = isUnclaimed ? "rgba(148,163,184,0.45)" : "rgba(250,250,250,0.65)";
      const districtClass = `server-inspector-map__district${isUnclaimed && viewMode === "live" ? " is-unclaimed" : ""}`;
      const fillOpacity = viewMode === "layout" ? "0.58" : "0.46";
      return `<polygon class="${districtClass}" data-server-detail-district-id="${district.id}" data-server-detail-index="${index}" points="${points}" fill="${color}" stroke="${ownerStroke}" opacity="${fillOpacity}"><title>${district.name} • ${zone} • ${district.owner}</title></polygon>`;
    }).join("");
    const ownerOverlaySvg = viewMode === "live"
      ? mapPolygons.map((entry) => {
        const district = entry.district;
        const owner = String(district.ownerNick || district.owner || "");
        if (!owner || normalizeOwnerNamePreview(owner) === "unclaimed") return "";
        const centroid = polygonCentroidPreview(entry.polygon || []);
        const x = Number(centroid?.[0] || 0);
        const y = Number(centroid?.[1] || 0);
        const ownerTag = resolveOwnerTag(owner);
        const allianceName = String(district.ownerAllianceName || district.alliance || "Neutral");
        const allianceTag = resolveAllianceSymbolByIconKey(district.ownerAllianceIconKey || "", allianceName);
        return `<text class="server-inspector-map__owner-tag" x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}">${ownerTag}</text><text class="server-inspector-map__alliance-tag" x="${x.toFixed(1)}" y="${(y + 9).toFixed(1)}">${allianceTag} ${allianceName}</text>`;
      }).join("")
      : "";
    const roadsSvg = Array.isArray(city?.roads) ? city.roads.slice(0, 64).map((road, index) => `<path class="${index < 8 ? "server-preview-map__artery" : "server-preview-map__road"}" d="M ${Number(road?.from?.[0] || 0).toFixed(1)} ${Number(road?.from?.[1] || 0).toFixed(1)} L ${Number(road?.to?.[0] || 0).toFixed(1)} ${Number(road?.to?.[1] || 0).toFixed(1)}" />`).join("") : "";
    ui.serverDetailMap.innerHTML = `<svg class="server-inspector-map__svg" viewBox="0 0 ${serverPreviewView.width} ${serverPreviewView.height}" role="img" aria-label="Mapa serveru ${server.name}"><image href="../img/mapaden.png" x="0" y="0" width="${serverPreviewView.width}" height="${serverPreviewView.height}" preserveAspectRatio="xMidYMid slice"></image><rect x="0" y="0" width="${serverPreviewView.width}" height="${serverPreviewView.height}" fill="${viewMode === "layout" ? "rgba(8, 17, 34, 0.14)" : "rgba(8, 17, 34, 0.22)"}"></rect>${roadsSvg}${mapDistrictsSvg}${ownerOverlaySvg}</svg>`;
    serverDetailDistrictLookup = new Map(mapPolygons.map((entry) => [String(entry.district.id), entry.district]));
    ui.serverDetailPlayers.innerHTML = serverPlayers.map((player) => {
      const assets = derivePlayerServerAssets(player, server.id);
      return `<tr><td><strong>${player.nickname}</strong></td><td>${player.alliance}</td><td>${player.districts}</td><td>${formatCurrency(player.cleanCash)}</td><td>${formatCurrency(player.dirtyCash)}</td><td>${player.heat}</td><td>${assets.materials}</td><td>${assets.chemicals}</td><td>${assets.weapons}</td><td>${assets.drugs}</td></tr>`;
    }).join("");
  }
  function renderPlayersSection() { ui.playersTableBody.innerHTML = filterCollection(mockData.players, (item) => `${item.nickname} ${item.id} ${item.faction} ${item.alliance}`).map((player) => `<tr data-player-id="${player.id}"><td>${player.id}</td><td><strong>${player.nickname}</strong></td><td>${mockData.servers.find((server) => server.id === player.server)?.name || player.server}</td><td>${player.faction}</td><td>${player.alliance}</td><td>${player.districts}</td><td>${formatCurrency(player.cleanCash)}</td><td>${formatCurrency(player.dirtyCash)}</td><td>${player.heat}</td><td>${createBadge(player.online ? "Online" : "Offline", `online-badge ${player.online ? "online-badge--online" : "online-badge--offline"}`)}</td><td>${formatTimeAgo(player.lastActivityMinutes)}</td><td>${player.reports}</td><td>${createBadge(player.suspicion.toUpperCase(), `flag-badge flag-badge--${player.suspicion === "critical" ? "critical" : player.suspicion === "warning" ? "warning" : "none"}`)}</td></tr>`).join(""); }
  function renderAlliancesSection() { ui.alliancesTableBody.innerHTML = filterCollection(mockData.alliances, (item) => `${item.name} ${item.status}`).map((alliance) => `<tr data-alliance-id="${alliance.id}"><td><strong>${alliance.name}</strong></td><td>${mockData.servers.find((server) => server.id === alliance.server)?.name || alliance.server}</td><td>${alliance.members}</td><td>${alliance.districts}</td><td><span class="dominance-badge ${alliance.dominance >= 70 ? "dominance-badge--high" : ""}">${alliance.dominance}%</span></td><td>${alliance.power.toLocaleString("cs-CZ")}</td><td>${alliance.cashFlow}</td><td>${alliance.conflicts}</td><td>${alliance.founded}</td><td>${alliance.status}</td></tr>`).join(""); }
  function renderDistrictsSection() { ui.districtGrid.innerHTML = filterCollection(mockData.districts.filter((item) => item.server === state.selectedServer || state.activeSection === "Districts / mapa"), (item) => `${item.name} ${item.zone} ${item.owner} ${item.alliance}`).map((district) => `<article class="district-card" data-district-id="${district.id}"><h4>${district.name}</h4><div class="district-meta"><span><strong>Zóna:</strong> ${district.zone}</span><span><strong>Vlastník:</strong> ${district.owner}</span><span><strong>Aliance:</strong> ${district.alliance}</span><span><strong>Budovy:</strong> ${district.buildings}</span><span><strong>Income:</strong> ${formatCurrency(district.income)}/h</span><span><strong>Heat:</strong> ${district.heat}</span><span><strong>Defense:</strong> ${district.defenseStatus}</span><span><strong>Active events:</strong> ${district.activeEvents}</span><span><strong>Trap status:</strong> ${district.trapStatus}</span><span><strong>Police pressure:</strong> ${district.policePressure}</span></div></article>`).join(""); }
  function renderBuildingsSection() { const rows = mockData.buildings.filter((item) => state.filters.buildingType === "all" || item.category === state.filters.buildingType); ui.buildingsTableBody.innerHTML = filterCollection(rows, (item) => `${item.type} ${item.category} ${item.balanceStatus}`).map((building) => `<tr data-building-type="${building.type}"><td><strong>${building.type}</strong></td><td>${building.count}</td><td>${formatCurrency(building.avgIncome)}/h</td><td>${building.avgHeat}</td><td>${building.usageRate}</td><td>${building.topUpgrades}</td><td>${createBadge(building.balanceStatus, `flag-badge ${building.balanceStatus === "Hot" ? "flag-badge--critical" : building.balanceStatus === "Watch" ? "flag-badge--warning" : "flag-badge--none"}`)}</td><td>${building.lastConfigChange}</td></tr>`).join(""); }

  function renderEconomySection() {
    const dashboard = getSelectedDashboard();
    const totalCash = dashboard.clean + dashboard.dirty;
    const topBuildings = mockData.buildings.slice().sort((a, b) => b.avgIncome - a.avgIncome).slice(0, 5);
    const topPlayers = mockData.players.filter((item) => item.server === state.selectedServer).sort((a, b) => (b.cleanCash + b.dirtyCash) - (a.cleanCash + a.dirtyCash)).slice(0, 5);
    const topAlliances = mockData.alliances.filter((item) => item.server === state.selectedServer).sort((a, b) => b.power - a.power).slice(0, 5);
    ui.economyOverviewGrid.innerHTML = [
      { label: "Clean cash generation", value: `${formatCurrency(dashboard.clean)}/h`, delta: `${Math.round((dashboard.clean / totalCash) * 100)}% share` },
      { label: "Dirty cash generation", value: `${formatCurrency(dashboard.dirty)}/h`, delta: `${Math.round((dashboard.dirty / totalCash) * 100)}% share` },
      { label: "Total market flow", value: `${formatCurrency(totalCash)}/h`, delta: `${dashboard.attacks24h.reduce((sum, value) => sum + value, 0)} actions` }
    ].map((item) => `<article class="metric-card"><div class="metric-card__label">${item.label}</div><div class="metric-card__value">${item.value}</div><div class="metric-card__delta is-up">${item.delta}</div></article>`).join("");
    renderList(ui.economyTopBuildings, topBuildings.map((item) => ({ title: item.type, detail: `${formatCurrency(item.avgIncome)}/h • usage ${item.usageRate}` })));
    renderList(ui.economyTopPlayers, topPlayers.map((item) => ({ title: item.nickname, detail: `${formatCurrency(item.cleanCash + item.dirtyCash)} • ${getHeatLabel(item.heat)}` })));
    renderList(ui.economyTopAlliances, topAlliances.map((item) => ({ title: item.name, detail: `${item.members} členů • power ${item.power.toLocaleString("cs-CZ")}` })));
    renderList(ui.economyResourceSinks, mockData.economy.resourceSinks);
    renderList(ui.economyCrafting, mockData.economy.crafting);
    renderList(ui.economyCirculation, mockData.economy.circulation);
  }

  function renderPoliceSection() {
    const dashboard = getSelectedDashboard();
    const pressuredDistricts = mockData.districts.filter((item) => item.server === state.selectedServer).sort((a, b) => b.heat - a.heat).slice(0, 5);
    const averageHeat = mockData.servers.map((server) => {
      const serverPlayers = mockData.players.filter((item) => item.server === server.id);
      const total = serverPlayers.reduce((sum, value) => sum + value.heat, 0);
      return { title: server.name, detail: `Average heat ${serverPlayers.length ? Math.round(total / serverPlayers.length) : 0}` };
    });
    const wanted = mockData.players.filter((item) => item.server === state.selectedServer).sort((a, b) => b.heat - a.heat).slice(0, 5);
    renderList(ui.policeActiveRaids, mockData.police.activeRaids);
    const heatLabels = ["Heat 0-24", "Heat 25-74", "Heat 75-149", "Heat 150-299", "Heat 300+"];
    const maxHeat = Math.max(...dashboard.heat, 1);
    ui.policeHeatDistribution.innerHTML = dashboard.heat.map((value, index) => `<div class="heat-row"><span>${heatLabels[index]}</span><div class="heat-track"><span style="width:${Math.round((value / maxHeat) * 100)}%;"></span></div><strong>${value}</strong></div>`).join("");
    renderList(ui.policeDistrictPressure, pressuredDistricts.map((item) => ({ title: item.name, detail: `${item.policePressure} • ${getHeatLabel(item.heat)}` })));
    renderList(ui.policeInvestigations, mockData.police.investigations);
    renderList(ui.policeAverageHeat, averageHeat);
    renderList(ui.policeWanted, wanted.map((item) => ({ title: item.nickname, detail: `${item.heat} heat • ${item.alliance}` })));
    ui.policeLogs.innerHTML = ["Raid unit redeployed", "Crackdown recalibration finished", "Wanted list refreshed"].map((item) => `<div class="ops-item"><strong>${item}</strong><span>${new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span></div>`).join("");
  }

  function renderProductionSection() {
    ui.productionOverviewGrid.innerHTML = [
      { label: "Aktivní výroby drog", value: mockData.production.activeDrugs.length, delta: "Live queue" },
      { label: "Aktivní výroby zbraní", value: mockData.production.activeWeapons.length, delta: "Live queue" },
      { label: "Dokončeno za 24h", value: "3,956", delta: "Empire output" }
    ].map((item) => `<article class="metric-card"><div class="metric-card__label">${item.label}</div><div class="metric-card__value">${item.value}</div><div class="metric-card__delta is-up">${item.delta}</div></article>`).join("");
    renderList(ui.productionDrugs, mockData.production.activeDrugs);
    renderList(ui.productionWeapons, mockData.production.activeWeapons);
    renderList(ui.productionCompleted, mockData.production.completed24h);
    renderList(ui.productionTopItems, mockData.production.topItems);
    renderList(ui.productionBottlenecks, mockData.production.bottlenecks);
    renderList(ui.productionQueues, mockData.production.queues);
  }

  function renderEventsSection() {
    renderList(ui.eventsSystem, mockData.events.system);
    renderList(ui.eventsCity, mockData.events.city);
    renderList(ui.eventsPolice, mockData.events.police);
    renderList(ui.eventsCrisis, mockData.events.crisis);
    renderList(ui.eventsAdmin, mockData.events.admin);
    ui.eventFormServer.innerHTML = mockData.servers.map((server) => `<option value="${server.id}">${server.name}</option>`).join("");
  }

  function renderLogsSection() {
    ui.reportFilterServer.innerHTML = `<option value="all">all</option>${mockData.servers.map((server) => `<option value="${server.name}">${server.name}</option>`).join("")}`;
    ui.reportFilterServer.value = state.filters.reportServer;
    ui.reportFilterType.value = state.filters.reportType;
    ui.reportFilterSeverity.value = state.filters.reportSeverity;
    const logs = mockData.logs.filter((item) => {
      const serverOk = state.filters.reportServer === "all" || item.server === state.filters.reportServer;
      const typeOk = state.filters.reportType === "all" || item.type === state.filters.reportType;
      const severityOk = state.filters.reportSeverity === "all" || item.severity === state.filters.reportSeverity;
      const playerOk = !state.filters.reportPlayer || String(item.player).toLowerCase().includes(state.filters.reportPlayer.toLowerCase());
      const allianceOk = !state.filters.reportAlliance || String(item.alliance).toLowerCase().includes(state.filters.reportAlliance.toLowerCase());
      const timeOk = !state.filters.reportTime || String(item.time).toLowerCase().includes(state.filters.reportTime.toLowerCase()) || String(item.message).toLowerCase().includes(state.filters.reportTime.toLowerCase());
      const searchOk = !state.searchQuery || `${item.type} ${item.message} ${item.server} ${item.player} ${item.alliance}`.toLowerCase().includes(state.searchQuery.toLowerCase());
      return serverOk && typeOk && severityOk && playerOk && allianceOk && timeOk && searchOk;
    });
    ui.reportsLogPanel.innerHTML = logs.map((item) => `<div class="log-line"><span class="log-line__type">${item.type}</span><span class="log-line__severity log-line__severity--${item.severity}">${item.severity}</span><strong>${item.message}</strong><span class="log-line__meta">${item.server} • ${item.time}</span></div>`).join("");
  }

  function renderModerationSection() {
    renderList(ui.modOpenReports, mockData.moderation.openReports);
    renderList(ui.modFlaggedPlayers, mockData.moderation.flaggedPlayers);
    renderList(ui.modSuspiciousBehavior, mockData.moderation.suspiciousBehavior);
    renderList(ui.modMultiAccount, mockData.moderation.multiAccount);
    renderList(ui.modAbuseLog, mockData.moderation.abuseLog);
    renderList(ui.modPunishments, mockData.moderation.punishments);
  }

  function renderNotificationsSection() { ui.notificationsCenterList.innerHTML = filterCollection(mockData.notifications, (item) => `${item.category} ${item.text} ${item.severity}`).map((item) => `<div class="alert-item ${item.severity === "critical" ? "is-critical" : "is-warning"}"><strong>${item.category.toUpperCase()}</strong><span>${item.text}</span></div>`).join(""); }
  function collectServerCreatorInput() {
    const name = String(ui.serverCreateName?.value || "").trim() || "New Server";
    const type = String(ui.serverCreateType?.value || "war").toLowerCase();
    const status = String(ui.serverCreateStatus?.value || "scheduled").toLowerCase();
    const startAt = String(ui.serverCreateStartTime?.value || "").trim();
    const maxPlayers = Math.max(2, Math.floor(Number(ui.serverCreateMaxPlayers?.value || 20)));
    let districtCount = Math.max(25, Math.floor(Number(ui.serverCreateDistrictCount?.value || 161)));
    const sessionLength = String(ui.serverCreateSessionLength?.value || "").trim() || (type === "free" ? "2h" : "10d");
    const allianceCap = Math.max(2, Math.floor(Number(ui.serverCreateAllianceCap?.value || 4)));
    const startResources = {
      cleanCash: Math.max(0, Math.floor(Number(ui.serverCreateStartClean?.value || 0))),
      dirtyCash: Math.max(0, Math.floor(Number(ui.serverCreateStartDirty?.value || 0))),
      materials: Math.max(0, Math.floor(Number(ui.serverCreateStartMaterials?.value || 0))),
      chemicals: Math.max(0, Math.floor(Number(ui.serverCreateStartChemicals?.value || 0)))
    };
    let zonePlan = readServerCreatorZoneInputs(type, districtCount);
    const zoneTotal = calculateZonePlanTotal(zonePlan);
    if (zoneTotal > 0) {
      districtCount = zoneTotal;
      if (ui.serverCreateDistrictCount) ui.serverCreateDistrictCount.value = String(districtCount);
    } else {
      zonePlan = buildZonePlanFromDistrictCount(districtCount, type);
      writeServerCreatorZoneInputs(zonePlan);
    }
    return { name, type, status, startAt, maxPlayers, districtCount, sessionLength, allianceCap, startResources, zonePlan };
  }
  function hashPreviewSeed(value) {
    const input = String(value || "preview-seed");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) + 1;
  }
  function resolveCityPreviewSeed(config) {
    if (!config || typeof config !== "object") return hashPreviewSeed("preview-seed");
    return hashPreviewSeed(`${config.name}-${config.type}-${Math.max(1, Number(config.districtCount || 1))}-${JSON.stringify(config.zonePlan || {})}`);
  }
  function sortDistrictsForStableLayout(districts) {
    const list = Array.isArray(districts) ? [...districts] : [];
    return list.sort((left, right) => {
      const leftIdRaw = String(left?.id || "");
      const rightIdRaw = String(right?.id || "");
      const leftNum = Number(leftIdRaw);
      const rightNum = Number(rightIdRaw);
      const leftNumOk = Number.isFinite(leftNum);
      const rightNumOk = Number.isFinite(rightNum);
      if (leftNumOk && rightNumOk && leftNum !== rightNum) return leftNum - rightNum;
      if (leftNumOk !== rightNumOk) return leftNumOk ? -1 : 1;
      return leftIdRaw.localeCompare(rightIdRaw, "cs");
    });
  }
  function parseDistrictIdsFromPlayerInfo(text, maxDistrictId = 0) {
    const raw = String(text || "");
    if (!raw) return [];
    const seen = new Set();
    const result = [];
    const matches = raw.match(/\b\d{1,3}\b/g) || [];
    matches.forEach((token) => {
      const districtId = Number(token);
      if (!Number.isFinite(districtId) || districtId <= 0) return;
      if (maxDistrictId > 0 && districtId > maxDistrictId) return;
      if (seen.has(districtId)) return;
      seen.add(districtId);
      result.push(districtId);
    });
    return result;
  }
  function buildHraOwnershipFromPlayerState(serverPlayers, maxDistrictId = 0) {
    const ownership = new Map();
    const safePlayers = Array.isArray(serverPlayers) ? serverPlayers : [];
    safePlayers.forEach((player) => {
      const playerName = String(player?.nickname || "").trim();
      if (!playerName) return;
      const allianceName = String(player?.alliance || "Neutral").trim() || "Neutral";
      const ids = parseDistrictIdsFromPlayerInfo(player?.districtInfo, maxDistrictId);
      ids.forEach((districtId) => {
        ownership.set(Number(districtId), {
          owner: playerName,
          alliance: allianceName,
          ownerNick: playerName,
          ownerAllianceName: allianceName,
          ownerAllianceIconKey: resolveAllianceIconKeyPreview(allianceName) || null
        });
      });
    });
    return ownership;
  }
  function normalizeDistrictRecordForServer(server, district, index = 0) {
    const zone = String(district?.zone || "Residential");
    const buildingList = Array.isArray(district?.buildings)
      ? district.buildings
      : String(district?.buildings || "").split(",").map((item) => item.trim()).filter(Boolean);
    const attackHistory = Array.isArray(district?.attackHistory) ? district.attackHistory : [String(district?.attackHistory || "No major incidents logged.")];
    const spyingHistory = Array.isArray(district?.spyingHistory) ? district.spyingHistory : [String(district?.spyingHistory || "No active spying trace.")];
    const activeEffects = Array.isArray(district?.activeEffects) ? district.activeEffects : [String(district?.activeEffects || "No active effects")];
    const production = Array.isArray(district?.production) ? district.production : [String(district?.production || "Supply packs x8/h")];
    const rumorFeed = Array.isArray(district?.rumorFeed) ? district.rumorFeed : [String(district?.rumorFeed || "District remains under routine observation.")];
    return {
      id: String(district?.id || `${server.id}-D-${String(index + 1).padStart(3, "0")}`),
      name: String(district?.name || `District ${index + 1}`),
      zone,
      server: server.id,
      owner: String(district?.owner || "Unclaimed"),
      alliance: String(district?.alliance || "Neutral"),
      ownerNick: district?.ownerNick || null,
      ownerAllianceName: district?.ownerAllianceName || null,
      ownerAllianceIconKey: district?.ownerAllianceIconKey || null,
      buildings: buildingList,
      income: Math.max(0, Math.round(Number(district?.income || 0))),
      heat: Math.max(0, Math.round(Number(district?.heat || 0))),
      defenseStatus: String(district?.defenseStatus || "Stable"),
      activeEvents: String(district?.activeEvents || "None"),
      trapStatus: String(district?.trapStatus || "Trap placeholder"),
      policePressure: String(district?.policePressure || "Low"),
      attackHistory,
      spyingHistory,
      activeEffects,
      production,
      rumorFeed,
      bountyMarker: String(district?.bountyMarker || "No active bounty marker"),
      polygon: Array.isArray(district?.polygon) ? district.polygon : null,
      centroid: Array.isArray(district?.centroid) ? district.centroid : (Array.isArray(district?.polygon) ? polygonCentroidPreview(district.polygon) : null),
      buildingSetKey: district?.buildingSetKey || null,
      buildingSetTitle: district?.buildingSetTitle || null,
      buildingTier: district?.buildingTier || null
    };
  }
  function polygonCentroidPreview(polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return [0, 0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const x0 = Number(current?.[0] || 0);
      const y0 = Number(current?.[1] || 0);
      const x1 = Number(next?.[0] || 0);
      const y1 = Number(next?.[1] || 0);
      const cross = (x0 * y1) - (x1 * y0);
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area *= 0.5;
    if (!Number.isFinite(area) || Math.abs(area) < 1e-6) return [Number(polygon[0]?.[0] || 0), Number(polygon[0]?.[1] || 0)];
    return [cx / (6 * area), cy / (6 * area)];
  }
  function normalizeAnglePreview(value) {
    const twoPi = Math.PI * 2;
    let angle = Number(value || 0);
    while (angle < 0) angle += twoPi;
    while (angle >= twoPi) angle -= twoPi;
    return angle;
  }
  function normalizeOwnerNamePreview(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
  function normalizePointKeyPreview(point) {
    const x = Number(point?.[0] || 0).toFixed(3);
    const y = Number(point?.[1] || 0).toFixed(3);
    return `${x},${y}`;
  }
  function normalizeEdgeKeyPreview(from, to) {
    const a = normalizePointKeyPreview(from);
    const b = normalizePointKeyPreview(to);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  function buildDistrictAdjacencyPreview(districts) {
    const adjacency = new Map((districts || []).map((district) => [district.id, new Set()]));
    const edgeOwners = new Map();
    (districts || []).forEach((district) => {
      const polygon = Array.isArray(district.polygon) ? district.polygon : [];
      if (polygon.length < 2) return;
      for (let index = 0; index < polygon.length; index += 1) {
        const from = polygon[index];
        const to = polygon[(index + 1) % polygon.length];
        const edgeKey = normalizeEdgeKeyPreview(from, to);
        if (!edgeOwners.has(edgeKey)) edgeOwners.set(edgeKey, []);
        edgeOwners.get(edgeKey).push(district.id);
      }
    });
    edgeOwners.forEach((ownerIds) => {
      const unique = Array.from(new Set(ownerIds));
      for (let left = 0; left < unique.length; left += 1) {
        for (let right = left + 1; right < unique.length; right += 1) {
          const a = unique[left];
          const b = unique[right];
          adjacency.get(a)?.add(b);
          adjacency.get(b)?.add(a);
        }
      }
    });
    return adjacency;
  }
  function distanceToClusterPreview(candidateId, cluster, districtCenters) {
    const from = districtCenters.get(candidateId) || { x: 0, y: 0 };
    let best = Infinity;
    for (let index = 0; index < cluster.length; index += 1) {
      const to = districtCenters.get(cluster[index]) || { x: 0, y: 0 };
      const distance = Math.hypot(from.x - to.x, from.y - to.y);
      if (distance < best) best = distance;
    }
    return best;
  }
  function pickNearestToClusterPreview(candidates, cluster, districtCenters, clusterSet = new Set()) {
    let bestId = null;
    let bestDistance = Infinity;
    candidates.forEach((candidateId) => {
      if (clusterSet.has(candidateId)) return;
      const distance = distanceToClusterPreview(candidateId, cluster, districtCenters);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = candidateId;
      }
    });
    return bestId;
  }
  function pickClusterSeedPreview(available, districtCenters, ownerIndex, ownerCount) {
    const ranked = Array.from(available).sort((leftId, rightId) => {
      const left = districtCenters.get(leftId) || { x: 0, y: 0 };
      const right = districtCenters.get(rightId) || { x: 0, y: 0 };
      if (left.x === right.x) return left.y - right.y;
      return left.x - right.x;
    });
    if (!ranked.length) return null;
    if (ranked.length === 1) return ranked[0];
    const ratio = (ownerIndex + 0.5) / Math.max(ownerCount, 1);
    const index = Math.min(ranked.length - 1, Math.max(0, Math.round(ratio * (ranked.length - 1))));
    return ranked[index];
  }
  function growDistrictClusterPreview({ seedId, targetSize, available, neighborsByDistrict, districtCenters }) {
    if (!seedId || !available.has(seedId) || targetSize < 1) return [];
    const cluster = [seedId];
    const clusterSet = new Set(cluster);
    const frontier = new Set();
    const pushNeighbors = (districtId) => {
      const neighbors = neighborsByDistrict.get(districtId) || new Set();
      neighbors.forEach((neighborId) => {
        if (!available.has(neighborId)) return;
        if (clusterSet.has(neighborId)) return;
        frontier.add(neighborId);
      });
    };
    pushNeighbors(seedId);
    while (cluster.length < targetSize) {
      const nextFromFrontier = pickNearestToClusterPreview(frontier, cluster, districtCenters, clusterSet);
      let nextId = nextFromFrontier;
      if (!nextId) nextId = pickNearestToClusterPreview(available, cluster, districtCenters, clusterSet);
      if (!nextId) break;
      cluster.push(nextId);
      clusterSet.add(nextId);
      frontier.delete(nextId);
      pushNeighbors(nextId);
    }
    return cluster;
  }
  function assignAllianceTenScenarioOwnershipPreview(districts, ownerName, allyName, options = {}) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    if (!safeDistricts.length) return [];
    const ownAllianceName = String(options?.ownAllianceName || `${ownerName} + spojenec`).trim();
    const enemyOwners = Array.isArray(options?.enemyOwners) ? options.enemyOwners.map((value) => String(value || "").trim()).filter(Boolean) : [];
    const enemyAllianceName = String(options?.enemyAllianceName || "").trim();
    const ownersByDistrict = new Map();
    const districtCenters = new Map(
      safeDistricts.map((district) => {
        const centroid = polygonCentroidPreview(district.polygon || []);
        return [district.id, { x: Number(centroid?.[0] || 0), y: Number(centroid?.[1] || 0) }];
      })
    );
    const neighborsByDistrict = buildDistrictAdjacencyPreview(safeDistricts);
    const available = new Set(
      safeDistricts
        .filter((district) => normalizeOwnerNamePreview(district?.zone) !== "downtown")
        .map((district) => district.id)
    );
    const ownerTarget = Math.min(5, available.size);
    const preferredZones = ["commercial", "industrial", "residential", "park", "downtown"];
    const requiredOwnerBuildings = ["Lékárna", "Továrna", "Drug lab", "Zbrojovka"];
    const center = { x: serverPreviewView.width / 2, y: serverPreviewView.height / 2 };
    const hasBuilding = (district, buildingName) => {
      const wanted = normalizeOwnerNamePreview(buildingName);
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      return buildings.some((building) => normalizeOwnerNamePreview(building) === wanted);
    };
    const sortByCenterDistance = (left, right) => {
      const leftCentroid = polygonCentroidPreview(left.polygon || []);
      const rightCentroid = polygonCentroidPreview(right.polygon || []);
      const leftDistance = Math.hypot(Number(leftCentroid?.[0] || 0) - center.x, Number(leftCentroid?.[1] || 0) - center.y);
      const rightDistance = Math.hypot(Number(rightCentroid?.[0] || 0) - center.x, Number(rightCentroid?.[1] || 0) - center.y);
      if (leftDistance === rightDistance) return Number(left.id || 0) - Number(right.id || 0);
      return leftDistance - rightDistance;
    };
    requiredOwnerBuildings.forEach((buildingName) => {
      if (ownersByDistrict.size >= ownerTarget) return;
      const candidate = safeDistricts
        .filter((district) => available.has(district.id) && hasBuilding(district, buildingName))
        .sort(sortByCenterDistance)[0];
      if (!candidate) return;
      ownersByDistrict.set(candidate.id, ownerName);
      available.delete(candidate.id);
    });
    preferredZones.forEach((zoneName) => {
      if (ownersByDistrict.size >= ownerTarget) return;
      const candidate = safeDistricts
        .filter((district) => normalizeOwnerNamePreview(district?.zone) === zoneName && available.has(district.id))
        .sort(sortByCenterDistance)[0];
      if (!candidate) return;
      ownersByDistrict.set(candidate.id, ownerName);
      available.delete(candidate.id);
    });
    if (ownersByDistrict.size < ownerTarget && available.size) {
      const fallback = safeDistricts.filter((district) => available.has(district.id)).sort(sortByCenterDistance);
      const missing = Math.min(ownerTarget - ownersByDistrict.size, fallback.length);
      for (let index = 0; index < missing; index += 1) {
        const district = fallback[index];
        ownersByDistrict.set(district.id, ownerName);
        available.delete(district.id);
      }
    }
    const allyTarget = Math.min(5, available.size);
    if (allyTarget > 0) {
      const ownerClusterIds = Array.from(ownersByDistrict.keys());
      const ownerClusterSet = new Set(ownerClusterIds);
      let allySeedId = ownerClusterIds.length
        ? pickNearestToClusterPreview(available, ownerClusterIds, districtCenters, ownerClusterSet)
        : null;
      if (!allySeedId) allySeedId = pickClusterSeedPreview(available, districtCenters, 1, 2);
      const allyCluster = growDistrictClusterPreview({ seedId: allySeedId, targetSize: allyTarget, available, neighborsByDistrict, districtCenters });
      allyCluster.forEach((districtId) => {
        ownersByDistrict.set(districtId, allyName);
        available.delete(districtId);
      });
    }
    if (enemyOwners.length && available.size) {
      const friendlyClusterIds = Array.from(ownersByDistrict.keys());
      const friendlyClusterSet = new Set(friendlyClusterIds);
      const ownerDistrictIds = Array.from(ownersByDistrict.entries())
        .filter(([, owner]) => normalizeOwnerNamePreview(owner) === normalizeOwnerNamePreview(ownerName))
        .map(([districtId]) => districtId);
      const ownerDistrictSet = new Set(ownerDistrictIds);
      const enemyTarget = Math.min(5, available.size);
      let enemySeedId = null;
      if (ownerDistrictIds.length) {
        const adjacentToOwner = Array.from(available).filter((districtId) => {
          const neighbors = neighborsByDistrict.get(districtId);
          if (!neighbors || !neighbors.size) return false;
          for (const neighborId of neighbors) if (ownerDistrictSet.has(neighborId)) return true;
          return false;
        });
        if (adjacentToOwner.length) enemySeedId = pickNearestToClusterPreview(new Set(adjacentToOwner), ownerDistrictIds, districtCenters, ownerDistrictSet);
      }
      if (!enemySeedId && friendlyClusterIds.length) enemySeedId = pickNearestToClusterPreview(available, friendlyClusterIds, districtCenters, friendlyClusterSet);
      if (!enemySeedId) enemySeedId = pickClusterSeedPreview(available, districtCenters, 2, 3);
      const enemyCluster = growDistrictClusterPreview({ seedId: enemySeedId, targetSize: enemyTarget, available, neighborsByDistrict, districtCenters });
      enemyCluster.forEach((districtId) => available.delete(districtId));
      const splitBase = Math.floor(enemyTarget / enemyOwners.length);
      const splitRemainder = enemyTarget % enemyOwners.length;
      const targetByEnemy = enemyOwners.map((_, index) => splitBase + (index < splitRemainder ? 1 : 0));
      const enemyAvailable = new Set(enemyCluster);
      enemyOwners.forEach((enemyOwner, enemyIndex) => {
        const enemyOwnerTarget = Math.min(targetByEnemy[enemyIndex], enemyAvailable.size);
        if (enemyOwnerTarget < 1) return;
        let enemyOwnerSeed = null;
        if (friendlyClusterIds.length) enemyOwnerSeed = pickNearestToClusterPreview(enemyAvailable, friendlyClusterIds, districtCenters, new Set());
        if (!enemyOwnerSeed && enemyAvailable.size) enemyOwnerSeed = Array.from(enemyAvailable)[0];
        if (!enemyOwnerSeed) return;
        const enemyOwnerCluster = growDistrictClusterPreview({ seedId: enemyOwnerSeed, targetSize: enemyOwnerTarget, available: enemyAvailable, neighborsByDistrict, districtCenters });
        enemyOwnerCluster.forEach((districtId) => {
          ownersByDistrict.set(districtId, enemyOwner);
          enemyAvailable.delete(districtId);
        });
      });
      if (enemyAvailable.size) {
        let ownerIndex = 0;
        enemyAvailable.forEach((districtId) => {
          ownersByDistrict.set(districtId, enemyOwners[ownerIndex % enemyOwners.length]);
          ownerIndex += 1;
        });
      }
    }
    const ownerAllianceByKey = new Map([
      [normalizeOwnerNamePreview(ownerName), ownAllianceName],
      [normalizeOwnerNamePreview(allyName), ownAllianceName]
    ]);
    if (enemyAllianceName) {
      enemyOwners.forEach((enemyOwner) => ownerAllianceByKey.set(normalizeOwnerNamePreview(enemyOwner), enemyAllianceName));
    }
    return safeDistricts.map((district) => {
      const isDowntown = normalizeOwnerNamePreview(district?.zone) === "downtown";
      const owner = isDowntown ? null : (ownersByDistrict.get(district.id) || null);
      return {
        ...district,
        owner: owner || "Unclaimed",
        alliance: owner ? (ownerAllianceByKey.get(normalizeOwnerNamePreview(owner)) || "Neutral") : "Neutral"
      };
    });
  }
  function applyHraBlackoutOwnershipPreview(districts) {
    const ownerName = "Host";
    const allyName = "Chavi_Cz";
    const enemyOwners = ["Mariah", "Willy"];
    const ownAllianceName = "Zabijáci";
    const enemyAllianceName = "Stínoví vlci";
    const blackoutAllyName = "Knedlík";
    const blackoutAllianceName = "Zabijáci";
    const blackoutEnemyAllianceName = "Ledová aliance";
    const blackoutSecondEnemyName = "Ledovec";
    const blackoutThirdEnemyName = "Poltergeist";
    const blackoutFourthEnemyName = "Sněhulák";
    const blackoutFifthEnemyName = "Pepek";
    let nextDistricts = assignAllianceTenScenarioOwnershipPreview(districts, ownerName, allyName, {
      ownAllianceName,
      enemyOwners,
      enemyAllianceName
    }).map((district) => {
      if (normalizeOwnerNamePreview(district.owner) !== normalizeOwnerNamePreview(allyName)) return district;
      return { ...district, alliance: blackoutEnemyAllianceName };
    });
    const blackoutPlayerDistrictIds = new Set([84, 95, 92, 120, 126]);
    nextDistricts = nextDistricts.map((district) => {
      const districtId = Number(district?.id);
      if (blackoutPlayerDistrictIds.has(districtId)) return { ...district, owner: ownerName, alliance: blackoutAllianceName };
      if (districtId === 143 || districtId === 121) return { ...district, owner: blackoutThirdEnemyName, alliance: "Neutral" };
      if (districtId === 38 || districtId === 25) return { ...district, owner: blackoutFourthEnemyName, alliance: blackoutEnemyAllianceName };
      if (districtId === 82) return { ...district, owner: blackoutSecondEnemyName, alliance: blackoutEnemyAllianceName };
      if (districtId === 108 || districtId === 103 || districtId === 89) return { ...district, owner: blackoutFifthEnemyName, alliance: "Neutral" };
      if (districtId === 102 || districtId === 109) return { ...district, owner: blackoutAllyName, alliance: blackoutAllianceName };
      if (normalizeOwnerNamePreview(district?.owner) === normalizeOwnerNamePreview(ownerName)) return { ...district, alliance: blackoutAllianceName };
      if (normalizeOwnerNamePreview(district?.owner) === normalizeOwnerNamePreview(allyName)) return { ...district, alliance: blackoutEnemyAllianceName };
      return district;
    });
    return nextDistricts.map((district) => {
      const owner = String(district?.owner || "").trim();
      const alliance = String(district?.alliance || "").trim();
      const isOwned = owner && normalizeOwnerNamePreview(owner) !== "unclaimed";
      const ownerAllianceName = isOwned && alliance && normalizeOwnerNamePreview(alliance) !== "neutral" ? alliance : null;
      const ownerAllianceIconKey = ownerAllianceName ? resolveAllianceIconKeyPreview(ownerAllianceName) : null;
      return {
        ...district,
        owner,
        ownerNick: isOwned ? owner : null,
        ownerAllianceName,
        ownerAllianceIconKey
      };
    });
  }
  function distributeBySectorsPreview(entries, center, sectorCount = 12) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (!safeEntries.length) return [];
    const safeSectorCount = Math.max(4, Math.floor(Number(sectorCount || 12)));
    const sectors = Array.from({ length: safeSectorCount }, () => []);
    safeEntries.forEach((entry) => {
      const dx = Number(entry?.centroid?.[0] || 0) - Number(center?.x || 0);
      const dy = Number(entry?.centroid?.[1] || 0) - Number(center?.y || 0);
      const angle = normalizeAnglePreview(Math.atan2(dy, dx));
      const sectorIndex = Math.min(safeSectorCount - 1, Math.floor((angle / (Math.PI * 2)) * safeSectorCount));
      sectors[sectorIndex].push({ ...entry, radial: Math.hypot(dx, dy) });
    });
    sectors.forEach((sector) => {
      sector.sort((left, right) => left.radial - right.radial);
    });
    const ordered = [];
    let layer = 0;
    while (ordered.length < safeEntries.length) {
      let progressed = false;
      for (let index = 0; index < sectors.length; index += 1) {
        const candidate = sectors[index][layer];
        if (!candidate) continue;
        ordered.push(candidate);
        progressed = true;
      }
      if (!progressed) break;
      layer += 1;
    }
    return ordered.length === safeEntries.length ? ordered : safeEntries;
  }
  function hashDistrictSeedPreview(seed, extra = 0) {
    const text = `${seed || ""}:${extra}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }
  function resolveTierForRankedDistrict(index, total, ratios, tiers) {
    const lowRatio = Math.max(0, Number(ratios?.low || 0.4));
    const highRatio = Math.max(0, Number(ratios?.high || 0.2));
    const lowCount = Math.max(1, Math.round(total * lowRatio));
    const highCount = total >= 5 ? Math.max(1, Math.round(total * highRatio)) : Math.min(1, total);
    const midCount = Math.max(0, total - lowCount - highCount);
    if (index < lowCount) return tiers[0];
    if (index >= lowCount + midCount) return tiers[2];
    return tiers[1];
  }
  function pickPreviewBuildingSet(zone, tier, district, index) {
    const pools = previewIndexBuildingPools[zone];
    if (!pools) return null;
    const fallbackTier = Object.keys(pools)[1] || Object.keys(pools)[0];
    const pool = pools[tier] || pools[fallbackTier] || [];
    if (!pool.length) return null;
    const offset = hashDistrictSeedPreview(district?.id, index) % pool.length;
    return pool[offset];
  }
  function assignPreviewDistrictBuildingSets(districts) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    if (!safeDistricts.length) return;
    const center = { x: serverPreviewView.width / 2, y: serverPreviewView.height / 2 };
    const rules = {
      Commercial: { tiers: ["early", "mid", "top"], ratios: { low: 0.4, high: 0.2 } },
      Residential: { tiers: ["early", "mid", "late"], ratios: { low: 0.45, high: 0.2 } },
      Park: { tiers: ["early", "mid", "top"], ratios: { low: 0.45, high: 0.25 } },
      Industrial: { tiers: ["early", "mid", "top"], ratios: { low: 0.4, high: 0.25 } },
      Downtown: { tiers: ["mid", "high", "core"], ratios: { low: 0.4, high: 0.25 } }
    };
    Object.entries(rules).forEach(([zone, config]) => {
      const ranked = safeDistricts
        .map((district, index) => ({ district, index }))
        .filter((entry) => String(entry.district?.zone || "") === zone)
        .map((entry) => {
          const centroid = Array.isArray(entry.district.centroid) ? entry.district.centroid : polygonCentroidPreview(entry.district.polygon);
          const distance = Math.hypot(Number(centroid?.[0] || 0) - center.x, Number(centroid?.[1] || 0) - center.y);
          return { ...entry, distance };
        })
        .sort((left, right) => right.distance - left.distance);
      const total = ranked.length;
      ranked.forEach((entry, rankIndex) => {
        const tier = resolveTierForRankedDistrict(ranked.length ? rankIndex : 0, total, config.ratios, config.tiers);
        const set = pickPreviewBuildingSet(zone, tier, entry.district, entry.index);
        if (!set) return;
        entry.district.buildings = Array.isArray(set.buildings) ? [...set.buildings] : [];
        entry.district.buildingSetKey = set.key;
        entry.district.buildingSetTitle = set.title;
        entry.district.buildingTier = set.tier;
      });
    });
  }
  function buildPreviewZoneTokens(zonePlan) {
    const pools = [
      { zone: "Residential", count: Math.max(0, Math.floor(Number(zonePlan?.Residential || 0))) },
      { zone: "Industrial", count: Math.max(0, Math.floor(Number(zonePlan?.Industrial || 0))) },
      { zone: "Commercial", count: Math.max(0, Math.floor(Number(zonePlan?.Commercial || 0))) },
      { zone: "Park", count: Math.max(0, Math.floor(Number(zonePlan?.Park || 0))) }
    ];
    const tokens = [];
    let cursor = 0;
    while (pools.some((item) => item.count > 0)) {
      const available = pools.filter((item) => item.count > 0).sort((left, right) => right.count - left.count);
      const next = available[cursor % available.length];
      const cluster = Math.min(next.count, cursor % 2 === 0 ? 3 : 2);
      for (let index = 0; index < cluster; index += 1) tokens.push(next.zone);
      next.count -= cluster;
      cursor += 1;
    }
    return tokens;
  }
  function buildCityPreviewDistricts(config, previewDistricts, zonePlan) {
    const totalDistricts = previewDistricts.length;
    const canUseCityGen = Boolean(window.Empire?.CityGen?.generate);
    if (!canUseCityGen) return null;
    const seed = resolveCityPreviewSeed({
      ...config,
      districtCount: totalDistricts,
      zonePlan
    });
    const city = window.Empire.CityGen.generate({
      seed,
      width: serverPreviewView.width,
      height: serverPreviewView.height,
      districtCount: totalDistricts
    });
    const cityDistricts = Array.isArray(city?.districts) ? city.districts.slice(0, totalDistricts) : [];
    if (!cityDistricts.length) return null;
    const center = { x: serverPreviewView.width / 2, y: serverPreviewView.height / 2 };
    const placements = cityDistricts.map((district) => {
      const centroid = polygonCentroidPreview(district.polygon);
      const dx = centroid[0] - center.x;
      const dy = centroid[1] - center.y;
      return {
        district,
        centroid,
        dist: Math.hypot(dx, dy)
      };
    });
    const sortedByCenter = [...placements].sort((left, right) => left.dist - right.dist);
    const downtownCount = Math.min(sortedByCenter.length, Math.max(0, Math.floor(Number(zonePlan?.Downtown || 0))));
    const zoneByDistrictId = new Map();
    sortedByCenter.slice(0, downtownCount).forEach((entry) => zoneByDistrictId.set(entry.district.id, "Downtown"));
    const remainingEntries = distributeBySectorsPreview(sortedByCenter.slice(downtownCount), center, 16);
    const zoneTokens = buildPreviewZoneTokens(zonePlan);
    remainingEntries.forEach((entry, index) => {
      zoneByDistrictId.set(entry.district.id, zoneTokens[index] || "Residential");
    });
    const zonePools = zoneOrder.reduce((result, zone) => {
      result[zone] = previewDistricts.filter((entry) => entry.zone === zone);
      return result;
    }, {});
    const sparePool = [...previewDistricts];
    const takeDetailForZone = (zone) => {
      const zonePool = zonePools[zone] || [];
      if (zonePool.length) {
        const detail = zonePool.shift();
        const spareIndex = sparePool.indexOf(detail);
        if (spareIndex >= 0) sparePool.splice(spareIndex, 1);
        return detail;
      }
      return sparePool.shift() || null;
    };
    const mappedDistricts = cityDistricts.map((district, index) => {
      const zone = zoneByDistrictId.get(district.id) || "Residential";
      const detail = takeDetailForZone(zone) || previewDistricts[index] || {};
      const centroid = polygonCentroidPreview(district.polygon);
      return {
        ...detail,
        zone,
        id: detail.id || `PREVIEW-${index + 1}`,
        polygon: district.polygon,
        centroid
      };
    });
    assignPreviewDistrictBuildingSets(mappedDistricts);
    return {
      districts: mappedDistricts,
      roads: Array.isArray(city.roads) ? city.roads : []
    };
  }
  function clampServerPreviewPan() {
    const scale = Math.max(serverPreviewView.minScale, Math.min(serverPreviewView.maxScale, serverPreviewView.scale));
    serverPreviewView.scale = scale;
    const maxTx = ((scale - 1) * serverPreviewView.width) / 2;
    const maxTy = ((scale - 1) * serverPreviewView.height) / 2;
    serverPreviewView.tx = Math.max(-maxTx, Math.min(maxTx, serverPreviewView.tx));
    serverPreviewView.ty = Math.max(-maxTy, Math.min(maxTy, serverPreviewView.ty));
  }
  function applyServerPreviewViewport() {
    if (!ui.serverPreviewMapGrid) return;
    clampServerPreviewPan();
    const world = ui.serverPreviewMapGrid.querySelector("#server-preview-map-world");
    if (!world) return;
    world.setAttribute("transform", `translate(${serverPreviewView.tx.toFixed(2)} ${serverPreviewView.ty.toFixed(2)}) scale(${serverPreviewView.scale.toFixed(3)})`);
  }
  function resetServerPreviewViewport() {
    serverPreviewView.scale = 1;
    serverPreviewView.tx = 0;
    serverPreviewView.ty = 0;
    applyServerPreviewViewport();
  }
  function applyServerPreviewZoneFocus() {
    if (!ui.serverPreviewMapGrid || !ui.serverPreviewMapLegend) return;
    const activeZone = String(serverPreviewFocusedZone || "");
    ui.serverPreviewMapGrid.querySelectorAll(".server-preview-map__district").forEach((node) => {
      const zone = node.getAttribute("data-preview-zone") || "";
      node.classList.toggle("is-zone-focus", Boolean(activeZone) && zone === activeZone);
      node.classList.toggle("is-dim", Boolean(activeZone) && zone !== activeZone);
    });
    ui.serverPreviewMapLegend.querySelectorAll("[data-preview-zone]").forEach((node) => {
      const zone = node.getAttribute("data-preview-zone") || "";
      node.classList.toggle("is-active", Boolean(activeZone) && zone === activeZone);
      node.classList.toggle("is-dim", Boolean(activeZone) && zone !== activeZone);
    });
  }
  function renderServerMapPreview(config) {
    if (!ui.serverPreviewMapLegend || !ui.serverPreviewMapGrid || !ui.serverPreviewMapCaption) return;
    const zonePlan = config.zonePlan || buildZonePlanFromDistrictCount(config.districtCount, config.type);
    const previewDistricts = buildServerPreviewDistricts(config);
    const totalDistricts = previewDistricts.length;
    const cityPreview = buildCityPreviewDistricts(config, previewDistricts, zonePlan);
    const renderDistricts = Array.isArray(cityPreview?.districts) ? cityPreview.districts : previewDistricts;
    serverPreviewDistrictLookup = new Map(renderDistricts.map((district) => [String(district.id), district]));
    ui.serverPreviewMapCaption.textContent = `${config.name} • ${config.type.toUpperCase()} • ${totalDistricts} districtů • start ${formatDateTimeLocalLabel(config.startAt)} • index-style city preview`;
    ui.serverPreviewMapLegend.innerHTML = zoneOrder.map((zone) => `<button type="button" class="server-preview-map__legend-item" data-preview-zone="${zone}"><span class="server-preview-map__swatch" style="background:${zoneColorMap[zone]};"></span><strong>${zone}</strong><span>${zonePlan[zone] || 0}</span></button>`).join("");
    const districtSvg = renderDistricts.map((district, index) => {
      const zone = district.zone || "Residential";
      const color = zoneColorMap[zone] || "#64748b";
      const heatFactor = zone === "Downtown" ? 0.72 : zone === "Industrial" ? 0.58 : zone === "Commercial" ? 0.46 : 0.34;
      const strokeColor = `rgba(255,255,255,${0.16 + heatFactor * 0.24})`;
      const zoneClass = `server-preview-map__cell--${String(zone).toLowerCase()}`;
      const polygon = Array.isArray(district.polygon) ? district.polygon : [];
      const points = polygon.map((point) => `${Number(point?.[0] || 0).toFixed(2)},${Number(point?.[1] || 0).toFixed(2)}`).join(" ");
      return `<polygon class="server-preview-map__district ${zoneClass}" data-preview-district-id="${district.id}" data-preview-index="${index}" data-preview-zone="${zone}" points="${points}" fill="${color}" stroke="${strokeColor}" opacity="0.5"><title>${district.name} • ${zone} • owner ${district.owner}</title></polygon>`;
    }).join("");
    const downtownCount = Number(zonePlan.Downtown || 0);
    const hudSvg = `
      <rect class="server-preview-map__hud" x="12" y="10" rx="8" ry="8" width="248" height="54"></rect>
      <text class="server-preview-map__hud-text" x="24" y="31">Districts: ${totalDistricts} • Max players: ${config.maxPlayers} • Scale ${serverPreviewView.scale.toFixed(2)}x</text>
      <text class="server-preview-map__hud-text" x="24" y="49">Downtown pressure nodes: ${downtownCount} • Drag + Wheel zoom</text>
    `;
    const dayBaseMapSvg = `
      <image href="../img/mapaden.png" x="0" y="0" width="${serverPreviewView.width}" height="${serverPreviewView.height}" preserveAspectRatio="xMidYMid slice"></image>
      <rect x="0" y="0" width="${serverPreviewView.width}" height="${serverPreviewView.height}" fill="rgba(8, 17, 34, 0.18)"></rect>
    `;
    ui.serverPreviewMapGrid.innerHTML = `<svg class="server-preview-map__svg" viewBox="0 0 ${serverPreviewView.width} ${serverPreviewView.height}" role="img" aria-label="Náhled mapy serveru (day)"><g id="server-preview-map-world">${dayBaseMapSvg}${districtSvg}</g>${hudSvg}</svg>`;
    const centroids = renderDistricts.map((district, index) => ({
      index,
      point: Array.isArray(district.centroid) ? district.centroid : polygonCentroidPreview(district.polygon)
    }));
    serverPreviewNeighbors = new Map();
    centroids.forEach((entry) => {
      const nearest = centroids
        .filter((candidate) => candidate.index !== entry.index)
        .map((candidate) => ({
          index: candidate.index,
          distance: Math.hypot(
            Number(candidate.point?.[0] || 0) - Number(entry.point?.[0] || 0),
            Number(candidate.point?.[1] || 0) - Number(entry.point?.[1] || 0)
          )
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 5)
        .map((candidate) => candidate.index);
      serverPreviewNeighbors.set(entry.index, nearest);
    });
    serverPreviewLayout = { total: totalDistricts };
    serverPreviewHoveredIndex = -1;
    if (ui.serverPreviewMapHover) ui.serverPreviewMapHover.textContent = "Hover district: —";
    applyServerPreviewViewport();
    applyServerPreviewZoneFocus();
  }
  function clearServerPreviewHover() {
    if (!ui.serverPreviewMapGrid) return;
    ui.serverPreviewMapGrid.querySelectorAll(".server-preview-map__district.is-hover, .server-preview-map__district.is-neighbor").forEach((node) => {
      node.classList.remove("is-hover");
      node.classList.remove("is-neighbor");
    });
  }
  function applyServerPreviewHover(index) {
    if (!ui.serverPreviewMapGrid) return;
    const total = Math.max(0, Math.floor(Number(serverPreviewLayout.total || 0)));
    if (index < 0 || index >= total) {
      clearServerPreviewHover();
      serverPreviewHoveredIndex = -1;
      if (ui.serverPreviewMapHover) ui.serverPreviewMapHover.textContent = "Hover district: —";
      return;
    }
    if (serverPreviewHoveredIndex === index) return;
    clearServerPreviewHover();
    const selected = ui.serverPreviewMapGrid.querySelector(`[data-preview-index="${index}"]`);
    if (selected) selected.classList.add("is-hover");
    const neighborIndices = serverPreviewNeighbors.get(index) || [];
    neighborIndices.forEach((neighborIndex) => {
      if (neighborIndex < 0 || neighborIndex >= total) return;
      const node = ui.serverPreviewMapGrid.querySelector(`[data-preview-index="${neighborIndex}"]`);
      if (node) node.classList.add("is-neighbor");
    });
    const selectedDistrictId = selected?.getAttribute("data-preview-district-id");
    const district = selectedDistrictId ? serverPreviewDistrictLookup.get(String(selectedDistrictId)) : null;
    if (ui.serverPreviewMapHover) {
      ui.serverPreviewMapHover.textContent = district
        ? `Hover district: ${district.name} • ${district.zone} • income ${formatCurrency(district.income)}/h`
        : "Hover district: —";
    }
    serverPreviewHoveredIndex = index;
  }
  function renderServerCreatorSummary(config) {
    if (!ui.serverCreateSummary) return;
    const resourceText = `Start resources / hráč: clean $${config.startResources.cleanCash.toLocaleString("cs-CZ")}, dirty $${config.startResources.dirtyCash.toLocaleString("cs-CZ")}, materials ${config.startResources.materials}, chemicals ${config.startResources.chemicals}`;
    const zoneSplit = `Commercial ${config.zonePlan.Commercial || 0} • Industrial ${config.zonePlan.Industrial || 0} • Park ${config.zonePlan.Park || 0} • Residential ${config.zonePlan.Residential || 0} • Downtown ${config.zonePlan.Downtown || 0}`;
    const zoneTotal = calculateZonePlanTotal(config.zonePlan);
    const schedule = resolveScheduleCountdownLabel(config.startAt);
    const zoneStatus = zoneTotal === config.districtCount
      ? "Zone plan OK"
      : `Zone plan adjusted: ${zoneTotal} districts`;
    ui.serverCreateSummary.innerHTML = `<strong>${config.name}</strong> • ${config.type.toUpperCase()} • status ${config.status.toUpperCase()} • start ${formatDateTimeLocalLabel(config.startAt)} (${schedule})<br />${config.districtCount} districtů • max hráčů ${config.maxPlayers} • alliance cap ${config.allianceCap}<br />${zoneSplit}<br />${zoneStatus}<br />${resourceText}`;
  }
  function renderServerCreatorPreview() {
    const config = collectServerCreatorInput();
    renderServerCreatorSummary(config);
    renderServerMapPreview(config);
  }
  function buildPersistedDistrictsForServer(server, config) {
    const previewDistricts = buildServerPreviewDistricts(config);
    const cityPreview = buildCityPreviewDistricts(config, previewDistricts, config.zonePlan);
    const renderDistricts = sortDistrictsForStableLayout(
      Array.isArray(cityPreview?.districts) ? cityPreview.districts : previewDistricts
    );
    const normalized = renderDistricts.map((district, index) => normalizeDistrictRecordForServer(server, district, index));
    assignPreviewDistrictBuildingSets(normalized);
    return normalized;
  }
  function createServerFromCreator() {
    const config = collectServerCreatorInput();
    const baseSlug = config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "server";
    let serverId = `${config.type}-${baseSlug}`;
    let suffix = 1;
    while (mockData.servers.some((item) => item.id === serverId)) {
      suffix += 1;
      serverId = `${config.type}-${baseSlug}-${suffix}`;
    }
    const startIso = config.startAt ? new Date(config.startAt).toISOString() : null;
    const serverStatus = config.status === "scheduled" ? "maintenance" : config.status;
    const baseClean = Math.max(0, Math.round(config.maxPlayers * (config.startResources.cleanCash * 0.24)));
    const baseDirty = Math.max(0, Math.round(config.maxPlayers * (config.startResources.dirtyCash * 0.24)));
    const demoAlliances = createDemoAlliancesForServer(config, serverId);
    const demoPlayers = createDemoPlayersForServer(config, serverId, demoAlliances);
    const newServer = {
      id: serverId,
      name: config.name,
      type: config.type,
      status: serverStatus,
      players: 0,
      maxPlayers: config.maxPlayers,
      districtCount: config.districtCount,
      sessionLength: config.sessionLength,
      dominance: 0,
      leader: "-",
      uptime: "0d 00h 00m",
      tickRate: mockData.balanceConfigs.global.tickRate,
      matchRules: `${config.type.toUpperCase()} custom / scheduled ${formatDateTimeLocalLabel(config.startAt)}`,
      allianceCap: config.allianceCap,
      dominanceThreshold: config.type === "free" ? mockData.balanceConfigs.free.dominanceThreshold || "55%" : mockData.balanceConfigs.war.dominanceThreshold || "70%",
      policeAggression: mockData.balanceConfigs.global.policeAggression,
      cleanCashPerHour: baseClean,
      dirtyCashPerHour: baseDirty,
      globalHeat: config.type === "free" ? 24 : 62,
      activeRaids: 0,
      scheduledStartAt: startIso,
      startResources: { ...config.startResources },
      zonePlan: { ...config.zonePlan },
      mapSeed: resolveCityPreviewSeed(config)
    };
    mockData.servers.push(newServer);
    mockData.alliances.push(...demoAlliances);
    mockData.players.push(...demoPlayers);
    const rebuiltDistricts = buildDistrictDataset(mockData);
    const persistedDistricts = buildPersistedDistrictsForServer(newServer, config);
    mockData.districts = rebuiltDistricts
      .filter((district) => district.server !== newServer.id)
      .concat(persistedDistricts);
    const demoDistricts = mockData.districts.filter((district) => district.server === newServer.id);
    mockData.dashboardByServer[newServer.id] = buildDashboardPresetFromDemo(config, demoPlayers, demoDistricts);
    if (newServer.status === "live") {
      newServer.players = demoPlayers.length;
    }
    regenerateOpsFeedData();
    state.selectedServer = newServer.id;
    renderSummary();
    renderActiveSection();
    renderServerCreatorPreview();
    pushOpsLog(`Server created: ${newServer.name} (${newServer.id})`);
    renderDetail(`Server ${newServer.name}`, `Scheduled start ${formatDateTimeLocalLabel(config.startAt)}. ${newServer.districtCount} districts. Start resources configured.`);
  }
  function renderSettingsSection() {
    const { global, free, war } = mockData.balanceConfigs;
    ui.settingsTickRate.value = global.tickRate;
    ui.settingsMatchRules.value = global.matchRules;
    ui.settingsMaxPlayers.value = global.maxPlayers;
    ui.settingsAllianceCap.value = global.allianceCap;
    ui.settingsDominanceThreshold.value = global.dominanceThreshold;
    ui.settingsCooldownMultipliers.value = global.cooldownMultipliers;
    ui.settingsIncomeMultipliers.value = global.incomeMultipliers;
    ui.settingsHeatMultipliers.value = global.heatMultipliers;
    ui.settingsPoliceAggression.value = global.policeAggression;
    ui.settingsFreeSessionLength.value = free.sessionLength;
    ui.settingsFreeAttackCooldown.value = free.attackCooldown;
    ui.settingsFreeRaidCooldown.value = free.raidCooldown;
    ui.settingsFreeIncomeTick.value = free.incomeTick;
    ui.settingsFreeHeatDecay.value = free.heatDecay;
    ui.settingsFreeMaxPlayers.value = free.maxPlayers;
    ui.settingsWarSessionLength.value = war.sessionLength;
    ui.settingsWarAttackCooldown.value = war.attackCooldown;
    ui.settingsWarRaidCooldown.value = war.raidCooldown;
    ui.settingsWarIncomeTick.value = war.incomeTick;
    ui.settingsWarHeatDecay.value = war.heatDecay;
    ui.settingsWarMaxPlayers.value = war.maxPlayers;
    document.querySelectorAll("#settings-free-grid input, #settings-war-grid input, #settings-core-grid input").forEach((input) => { input.dataset.balanceConfig = "json-ready"; });
    ui.settingsTickRate.dataset.configPath = global.configPath;
    ui.settingsFreeSessionLength.dataset.configPath = free.configPath;
    ui.settingsWarSessionLength.dataset.configPath = war.configPath;
    if (ui.serverCreateTemplate && !ui.serverCreateStartTime?.value) {
      applyServerCreatorTemplate(ui.serverCreateTemplate.value || "hra-blackout");
      return;
    }
    if (ui.serverCreateStartTime && !ui.serverCreateStartTime.value) {
      ui.serverCreateStartTime.value = toDateTimeLocalValue(new Date(Date.now() + 30 * 60 * 1000));
    }
    renderServerCreatorPreview();
  }
  function renderDetailPanel() { ui.detailPanel.innerHTML = `<div class="activity-item"><strong>${state.detailTitle}</strong><span>${state.detailBody}</span></div>`; }
  function renderModal(title, cards, actions) { ui.detailModalTitle.textContent = title; ui.detailModalBody.innerHTML = cards.map((card) => `<article class="detail-card"><h4>${card.title}</h4><p>${card.body.replace(/\n/g, "<br />")}</p></article>`).join(""); ui.detailModalFooter.innerHTML = actions.map((action) => `<button class="quick-action-btn${action.danger ? " table-action-btn--danger" : ""}" type="button" data-modal-action="${action.key}">${action.label}</button>`).join(""); ui.detailModal.classList.remove("is-hidden"); }
  function renderActiveSection() { Object.entries(ui.sections).forEach(([name, element]) => { element.classList.toggle("is-hidden", name !== state.activeSection); }); }
  function renderDetail(name, body) { state.detailTitle = name; state.detailBody = body; renderDetailPanel(); }

  function renderModalForPlayer(playerId) { const player = mockData.players.find((item) => item.id === playerId); if (!player) return; state.selectedPlayer = playerId; renderDetail(`Player ${player.nickname}`, `${player.alliance}. ${player.faction}. ${getHeatLabel(player.heat)}.`); renderModal(`Detail hráče: ${player.nickname}`, [{ title: "Kompletní info", body: `${player.profile}\n${player.districtInfo}\nReports ${player.reports}.` }, { title: "Ekonomika", body: `${player.economy}\nClean ${formatCurrency(player.cleanCash)}. Dirty ${formatCurrency(player.dirtyCash)}.` }, { title: "Výroba", body: player.production }, { title: "Raid / spying", body: `${player.attacks}\n${player.spying}` }, { title: "Heat historie", body: player.heatHistory }, { title: "Poslední logy", body: player.lastLogs }], [{ key: "warn", label: "Warn" }, { key: "mute", label: "Mute" }, { key: "temp-ban", label: "Temp ban" }, { key: "perm-ban", label: "Perm ban", danger: true }, { key: "reset-heat", label: "Reset heat" }]); }
  function renderModalForPreviewDistrict(previewDistrictId) {
    const district = serverPreviewDistrictLookup.get(String(previewDistrictId || ""));
    if (!district) return;
    const buildingList = Array.isArray(district.buildings)
      ? district.buildings
      : String(district.buildings || "").split(",").map((item) => item.trim()).filter(Boolean);
    const buildingLines = buildingList.length ? buildingList.join("\n") : "Žádné budovy";
    const buildingMeta = [
      district.buildingSetTitle ? `Set: ${district.buildingSetTitle}` : "",
      district.buildingTier ? `Tier: ${String(district.buildingTier).toUpperCase()}` : ""
    ].filter(Boolean).join(" • ");
    renderDetail(`Preview district ${district.name}`, `${district.zone}. ${district.policePressure} pressure. ${district.defenseStatus}.`);
    renderModal(`Preview district: ${district.name}`, [
      { title: "Budovy v distriktu", body: `${buildingMeta}\n${buildingLines}`.trim() },
      { title: "Kompletní info", body: `Zóna ${district.zone}. Vlastník ${district.owner}. Aliance ${district.alliance}.` },
      { title: "Ekonomika a riziko", body: `Income ${formatCurrency(district.income)}/h. Heat ${district.heat}. Police pressure ${district.policePressure}.` },
      { title: "Obrana a trap", body: `Defense ${district.defenseStatus}. Trap ${district.trapStatus}. Active event ${district.activeEvents}.` },
      { title: "Produkce a marker", body: `${district.production}. Bounty: ${district.bountyMarker}.` },
      { title: "Historie", body: `Attack: ${district.attackHistory}\nSpying: ${district.spyingHistory}` }
    ], [{ key: "preview-lock", label: "Lock district", danger: true }, { key: "preview-raid", label: "Trigger raid" }, { key: "preview-log", label: "Inspect logs" }]);
  }
  function renderModalForAlliance(allianceId) { const alliance = mockData.alliances.find((item) => item.id === allianceId); if (!alliance) return; state.selectedAlliance = allianceId; renderDetail(`Alliance ${alliance.name}`, `${alliance.members} members. ${alliance.dominance}% dominance. ${alliance.status}.`); renderModal(`Detail aliance: ${alliance.name}`, [{ title: "Kompletní info", body: `${alliance.members} členů. ${alliance.districts} districts. ${alliance.status}.` }, { title: "Ekonomika", body: `${alliance.cashFlow}. Power ${alliance.power.toLocaleString("cs-CZ")}.` }, { title: "Konflikty", body: `${alliance.conflicts} aktivních konfliktů.` }, { title: "Založení", body: alliance.founded }], [{ key: "audit", label: "Inspect logs" }, { key: "freeze", label: "Lock alliance", danger: true }]); }
  function renderModalForDistrict(districtId, serverId = state.selectedServer) { const district = mockData.districts.find((item) => String(item.id) === String(districtId) && (!serverId || String(item.server) === String(serverId))) || mockData.districts.find((item) => String(item.id) === String(districtId)); if (!district) return; state.selectedDistrict = districtId; renderDetail(`District ${district.name}`, `${district.zone}. ${district.policePressure} police pressure. ${district.defenseStatus}.`); renderModal(`Detail districtu: ${district.name}`, [{ title: "Kompletní info", body: `Zóna ${district.zone}. Vlastník ${district.owner}. Aliance ${district.alliance}. Budovy ${district.buildings}. Income ${formatCurrency(district.income)}/h. Heat ${district.heat}. Defense ${district.defenseStatus}. Active events ${district.activeEvents}. Trap ${district.trapStatus}. Police pressure ${district.policePressure}.` }, { title: "Historie útoků", body: district.attackHistory.join("\n") }, { title: "Historie špehování", body: district.spyingHistory.join("\n") }, { title: "Aktivní efekty", body: district.activeEffects.join("\n") }, { title: "Produkce", body: district.production.join("\n") }, { title: "Rumor / gossip feed", body: district.rumorFeed.join("\n") }, { title: "Bounty marker", body: district.bountyMarker }], [{ key: "lock-district", label: "Lock district", danger: true }, { key: "remove-ownership", label: "Remove ownership", danger: true }, { key: "trigger-raid", label: "Trigger raid" }, { key: "add-event", label: "Add event" }, { key: "inspect-logs", label: "Inspect logs" }]); }
  function renderModalForServer(serverId) {
    const server = mockData.servers.find((item) => item.id === serverId);
    if (!server) return;
    const modeConfig = mockData.balanceConfigs[server.type] || mockData.balanceConfigs.war;
    state.selectedServer = serverId;
    renderDetail(`Server ${server.name}`, `${server.type.toUpperCase()} mode. ${server.players}/${server.maxPlayers} players. ${server.districtCount} districts. Dominance ${server.dominance}%.`);
    renderTopbar();
    renderDashboardOverview();
    renderServersSection();
    renderPlayersSection();
    renderAlliancesSection();
    renderDistrictsSection();
    renderEconomySection();
    renderPoliceSection();
    renderEventsSection();
    const startResources = server.startResources && typeof server.startResources === "object"
      ? `Clean $${Math.max(0, Number(server.startResources.cleanCash || 0)).toLocaleString("cs-CZ")} / Dirty $${Math.max(0, Number(server.startResources.dirtyCash || 0)).toLocaleString("cs-CZ")} / Materials ${Math.max(0, Number(server.startResources.materials || 0)).toLocaleString("cs-CZ")} / Chemicals ${Math.max(0, Number(server.startResources.chemicals || 0)).toLocaleString("cs-CZ")}`
      : "Default profile";
    const scheduleLabel = server.scheduledStartAt ? formatDateTimeLocalLabel(server.scheduledStartAt) : "ihned";
    const zonePlan = server.zonePlan && typeof server.zonePlan === "object" ? server.zonePlan : null;
    const zoneSplit = zonePlan
      ? `Commercial ${zonePlan.Commercial || 0} / Industrial ${zonePlan.Industrial || 0} / Park ${zonePlan.Park || 0} / Residential ${zonePlan.Residential || 0} / Downtown ${zonePlan.Downtown || 0}`
      : modeConfig.zoneDistribution;
    renderModal(`Detail serveru: ${server.name}`, [
      { title: "Server profile", body: `Typ ${server.type}. Status ${server.status}. Session ${server.sessionLength}. Districts ${server.districtCount}. Tick ${server.tickRate}. Match rules ${server.matchRules}.` },
      { title: "Kontrola provozu", body: `Hráči ${server.players}/${server.maxPlayers}. Alliance cap ${server.allianceCap}. Dominance threshold ${server.dominanceThreshold}. Police aggression ${server.policeAggression}.` },
      { title: "Mapa a pace", body: `Zone split ${zoneSplit}. Pace ${modeConfig.sessionLength}. Income tick ${modeConfig.incomeTick}. Heat decay ${modeConfig.heatDecay}.` },
      { title: "Ekonomika a tlak", body: `Clean cash ${formatCurrency(server.cleanCashPerHour)}/h. Dirty cash ${formatCurrency(server.dirtyCashPerHour)}/h. Global heat ${server.globalHeat}. Active raids ${server.activeRaids}. Config ${modeConfig.configPath}.` },
      { title: "Schedule + start resources", body: `Start serveru: ${scheduleLabel}.\nStart resources / hráč: ${startResources}.` }
    ], [{ key: "server-inspect", label: "Inspect logs" }, { key: "server-freeze", label: "Lock server", danger: true }, { key: "server-raid", label: "Trigger raid" }]);
  }
  function renderModalForBuilding(buildingType) { const building = mockData.buildings.find((item) => item.type === buildingType); if (!building) return; renderDetail(`Budova ${building.type}`, `${building.category} segment. Usage ${building.usageRate}. Balance ${building.balanceStatus}.`); renderModal(`Detail budovy: ${building.type}`, [{ title: "Souhrn", body: `Počet ve hře ${building.count}. Průměrný income ${formatCurrency(building.avgIncome)}/h. Průměrný heat ${building.avgHeat}. Usage rate ${building.usageRate}.` }, { title: "Balanc a config", body: `Nejčastější upgrady: ${building.topUpgrades}. Balance status: ${building.balanceStatus}. Poslední změna configu: ${building.lastConfigChange}.` }, { title: "Napojení na JSON config", body: `Config path ${building.configPath}. Category ${building.category}. Balance key ${building.balanceKey}.` }], [{ key: "building-inspect", label: "Inspect logs" }, { key: "building-balance", label: "Open balance config" }]); }

  function renderSummary() { renderSidebar(); renderTopbar(); renderDashboardOverview(); renderServersSection(); renderServerDetailSection(); renderPlayersSection(); renderAlliancesSection(); renderDistrictsSection(); renderBuildingsSection(); renderEconomySection(); renderPoliceSection(); renderProductionSection(); renderEventsSection(); renderLogsSection(); renderModerationSection(); renderNotificationsSection(); renderSettingsSection(); renderDetailPanel(); }
  function closeModal() { ui.detailModal.classList.add("is-hidden"); }
  function applyScheduledServerTransitions() {
    let changed = false;
    const now = Date.now();
    mockData.servers.forEach((server) => {
      const scheduledAt = Number(server?.scheduledStartAt ? new Date(server.scheduledStartAt).getTime() : NaN);
      if (!Number.isFinite(scheduledAt)) return;
      if (server.status === "maintenance" && now >= scheduledAt) {
        server.status = "live";
        const demoPlayers = mockData.players.filter((player) => player.server === server.id);
        server.players = Math.max(1, demoPlayers.length);
        const dashboard = mockData.dashboardByServer[server.id];
        if (dashboard && dashboard.meta) {
          dashboard.meta.status = "LIVE";
          dashboard.alerts = [
            { severity: "critical", title: "Server launched", detail: `${server.name} switched to LIVE.` },
            ...(Array.isArray(dashboard.alerts) ? dashboard.alerts.slice(0, 2) : [])
          ];
        }
        pushOpsLog(`Scheduled launch: ${server.name} is LIVE`);
        changed = true;
      }
    });
    if (changed) {
      rebuildDistrictDatasetWithPinnedLayouts();
      regenerateOpsFeedData();
      renderSummary();
      renderActiveSection();
    }
  }
  function updateClock() {
    ui.currentTimeChip.textContent = new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    applyScheduledServerTransitions();
    if (state.activeSection === "Nastavení hry" && ui.serverCreateSummary) {
      renderServerCreatorSummary(collectServerCreatorInput());
    }
  }

  function bindSidebarNavClick() { ui.sidebarNav.addEventListener("click", (event) => { const button = event.target.closest("[data-nav-item]"); if (!button) return; state.activeSection = button.dataset.navItem; renderSidebar(); renderActiveSection(); pushOpsLog(`Section switched to ${state.activeSection}`); }); }
  function bindRowClickHandlers() {
    ui.serversTableBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const openBtn = target.closest("[data-open-server]");
      if (openBtn) {
        const serverId = String(openBtn.getAttribute("data-open-server") || "").trim();
        if (!serverId) return;
        state.selectedServer = serverId;
        state.activeSection = "Server detail";
        regenerateOpsFeedData();
        renderSummary();
        renderActiveSection();
        pushOpsLog(`Server detail opened: ${getSelectedServer().name}`);
        return;
      }
      const row = target.closest("[data-server-id]");
      if (row) renderModalForServer(row.dataset.serverId);
    });
    ui.playersTableBody.addEventListener("click", (event) => {
      const row = event.target.closest("[data-player-id]");
      if (row) renderModalForPlayer(row.dataset.playerId);
    });
    ui.alliancesTableBody.addEventListener("click", (event) => {
      const row = event.target.closest("[data-alliance-id]");
      if (row) renderModalForAlliance(row.dataset.allianceId);
    });
    ui.districtGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-district-id]");
      if (card) renderModalForDistrict(card.dataset.districtId);
    });
    ui.buildingsTableBody.addEventListener("click", (event) => {
      const row = event.target.closest("[data-building-type]");
      if (row) renderModalForBuilding(row.dataset.buildingType);
    });
    if (ui.serverDetailMap) {
      ui.serverDetailMap.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const districtNode = target.closest("[data-server-detail-district-id]");
        if (!districtNode) return;
        const districtId = String(districtNode.getAttribute("data-server-detail-district-id") || "");
        const selectedServerId = String(state.selectedServer || "");
        const district = mockData.districts.find((item) => String(item.server || "") === selectedServerId && String(item.id) === districtId) || serverDetailDistrictLookup.get(districtId);
        if (!district) return;
        const existing = mockData.districts.find((item) => String(item.server || "") === selectedServerId && String(item.id) === String(district.id));
        if (existing) {
          renderModalForDistrict(String(existing.id), selectedServerId);
          return;
        }
        const buildingList = Array.isArray(district.buildings)
          ? district.buildings
          : String(district.buildings || "").split(",").map((item) => item.trim()).filter(Boolean);
        renderDetail(`District ${district.name}`, `${district.zone}. ${district.policePressure || "Medium"} police pressure.`);
        renderModal(`Detail districtu: ${district.name}`, [
          { title: "Kompletní info", body: `Zóna ${district.zone}. Vlastník ${district.owner}. Aliance ${district.alliance}.` },
          { title: "Budovy", body: buildingList.join("\n") || "Žádné budovy" },
          { title: "Ekonomika", body: `Income ${formatCurrency(district.income)}/h. Heat ${district.heat}.` }
        ], [{ key: "inspect-logs", label: "Inspect logs" }]);
      });
    }
  }
  function bindFilterChange() { ui.buildingFilterButtons.forEach((button) => button.addEventListener("click", () => { state.filters.buildingType = button.dataset.buildingFilter || "all"; ui.buildingFilterButtons.forEach((item) => item.classList.toggle("is-active", item === button)); renderBuildingsSection(); pushOpsLog(`Building filter changed to ${state.filters.buildingType}`); })); [ui.reportFilterServer, ui.reportFilterPlayer, ui.reportFilterAlliance, ui.reportFilterType, ui.reportFilterTime, ui.reportFilterSeverity].forEach((input) => { input.addEventListener("input", () => { state.filters.reportServer = ui.reportFilterServer.value; state.filters.reportPlayer = ui.reportFilterPlayer.value; state.filters.reportAlliance = ui.reportFilterAlliance.value; state.filters.reportType = ui.reportFilterType.value; state.filters.reportTime = ui.reportFilterTime.value; state.filters.reportSeverity = ui.reportFilterSeverity.value; renderLogsSection(); }); input.addEventListener("change", () => { state.filters.reportServer = ui.reportFilterServer.value; state.filters.reportPlayer = ui.reportFilterPlayer.value; state.filters.reportAlliance = ui.reportFilterAlliance.value; state.filters.reportType = ui.reportFilterType.value; state.filters.reportTime = ui.reportFilterTime.value; state.filters.reportSeverity = ui.reportFilterSeverity.value; renderLogsSection(); }); }); ui.topModeButtons.forEach((button) => button.addEventListener("click", () => { state.filters.rankingMode = button.dataset.topMode; ui.topModeButtons.forEach((item) => item.classList.toggle("is-active", item === button)); renderDashboardOverview(); })); }
  function bindSearchInput() { ui.globalSearch.addEventListener("input", () => { state.searchQuery = ui.globalSearch.value.trim(); renderSidebar(); renderServersSection(); renderPlayersSection(); renderAlliancesSection(); renderDistrictsSection(); renderBuildingsSection(); renderLogsSection(); renderNotificationsSection(); }); }
  function bindModalOpenClose() { ui.detailModalBackdrop.addEventListener("click", closeModal); ui.detailModalClose.addEventListener("click", closeModal); document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); }); }
  function bindQuickActionButtons() { ui.quickActionButtons.forEach((button) => button.addEventListener("click", () => pushOpsLog(`Quick action: ${button.dataset.action}`))); ui.policeActionButtons.forEach((button) => button.addEventListener("click", () => pushOpsLog(`Police action: ${button.dataset.policeAction}`))); ui.eventActionButtons.forEach((button) => button.addEventListener("click", () => pushOpsLog(`Event action ${button.dataset.eventAction}: ${ui.eventFormName.value || "untitled event"}`))); ui.modActionButtons.forEach((button) => button.addEventListener("click", () => pushOpsLog(`Moderation action: ${button.dataset.modAction}`))); ui.economySnapshotBtn.addEventListener("click", () => pushOpsLog(`Economy snapshot created for ${getSelectedServer().name}`)); ui.detailModalFooter.addEventListener("click", (event) => { const button = event.target.closest("[data-modal-action]"); if (button) pushOpsLog(`Modal action: ${button.dataset.modalAction}`); }); }
  function bindServerCreator() {
    const watchedInputs = [
      ui.serverCreateName,
      ui.serverCreateType,
      ui.serverCreateStatus,
      ui.serverCreateStartTime,
      ui.serverCreateMaxPlayers,
      ui.serverCreateDistrictCount,
      ui.serverCreateZoneCommercial,
      ui.serverCreateZoneIndustrial,
      ui.serverCreateZonePark,
      ui.serverCreateZoneResidential,
      ui.serverCreateZoneDowntown,
      ui.serverCreateSessionLength,
      ui.serverCreateAllianceCap,
      ui.serverCreateStartClean,
      ui.serverCreateStartDirty,
      ui.serverCreateStartMaterials,
      ui.serverCreateStartChemicals
    ].filter(Boolean);
    watchedInputs.forEach((input) => {
      input.addEventListener("input", renderServerCreatorPreview);
      input.addEventListener("change", renderServerCreatorPreview);
    });
    if (ui.serverCreateDistrictCount) {
      ui.serverCreateDistrictCount.addEventListener("change", () => {
        const type = String(ui.serverCreateType?.value || "war").toLowerCase();
        const total = Math.max(25, Math.floor(Number(ui.serverCreateDistrictCount.value || 161)));
        writeServerCreatorZoneInputs(buildZonePlanFromDistrictCount(total, type));
        renderServerCreatorPreview();
      });
    }
    if (ui.serverCreateType) {
      ui.serverCreateType.addEventListener("change", () => {
        const total = Math.max(25, Math.floor(Number(ui.serverCreateDistrictCount?.value || 161)));
        writeServerCreatorZoneInputs(buildZonePlanFromDistrictCount(total, ui.serverCreateType.value));
        renderServerCreatorPreview();
      });
    }
    if (ui.serverCreatePreviewBtn) {
      ui.serverCreatePreviewBtn.addEventListener("click", () => {
        renderServerCreatorPreview();
        pushOpsLog("Server map preview refreshed");
      });
    }
    if (ui.serverCreateApplyTemplateBtn) {
      ui.serverCreateApplyTemplateBtn.addEventListener("click", () => {
        applyServerCreatorTemplate(ui.serverCreateTemplate?.value || "hra-blackout");
        pushOpsLog(`Server template applied: ${ui.serverCreateTemplate?.value || "hra-blackout"}`);
      });
    }
    if (ui.serverCreateTemplate) {
      ui.serverCreateTemplate.addEventListener("change", () => {
        applyServerCreatorTemplate(ui.serverCreateTemplate.value);
      });
    }
    if (ui.serverCreateSubmitBtn) {
      ui.serverCreateSubmitBtn.addEventListener("click", () => {
        createServerFromCreator();
      });
    }
    if (ui.serverPreviewMapGrid) {
      ui.serverPreviewMapGrid.addEventListener("wheel", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest(".server-preview-map__svg")) return;
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.12 : -0.12;
        serverPreviewView.scale = Math.max(serverPreviewView.minScale, Math.min(serverPreviewView.maxScale, serverPreviewView.scale + delta));
        applyServerPreviewViewport();
      }, { passive: false });
      ui.serverPreviewMapGrid.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest(".server-preview-map__svg")) return;
        serverPreviewDrag.active = true;
        serverPreviewDrag.moved = false;
        serverPreviewDrag.startX = event.clientX;
        serverPreviewDrag.startY = event.clientY;
        serverPreviewDrag.startTx = serverPreviewView.tx;
        serverPreviewDrag.startTy = serverPreviewView.ty;
        ui.serverPreviewMapGrid.classList.add("is-dragging");
        if (typeof ui.serverPreviewMapGrid.setPointerCapture === "function") {
          try { ui.serverPreviewMapGrid.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
        }
      });
      ui.serverPreviewMapGrid.addEventListener("pointermove", (event) => {
        if (!serverPreviewDrag.active) return;
        const dx = event.clientX - serverPreviewDrag.startX;
        const dy = event.clientY - serverPreviewDrag.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) serverPreviewDrag.moved = true;
        serverPreviewView.tx = serverPreviewDrag.startTx + dx;
        serverPreviewView.ty = serverPreviewDrag.startTy + dy;
        applyServerPreviewViewport();
      });
      ui.serverPreviewMapGrid.addEventListener("pointerup", (event) => {
        serverPreviewDrag.active = false;
        window.setTimeout(() => { serverPreviewDrag.moved = false; }, 0);
        ui.serverPreviewMapGrid.classList.remove("is-dragging");
        if (typeof ui.serverPreviewMapGrid.releasePointerCapture === "function") {
          try { ui.serverPreviewMapGrid.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
        }
      });
      ui.serverPreviewMapGrid.addEventListener("pointercancel", () => {
        serverPreviewDrag.active = false;
        serverPreviewDrag.moved = false;
        ui.serverPreviewMapGrid.classList.remove("is-dragging");
      });
      ui.serverPreviewMapGrid.addEventListener("mouseover", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const districtNode = target.closest("[data-preview-index]");
        if (!districtNode) return;
        applyServerPreviewHover(Math.floor(Number(districtNode.getAttribute("data-preview-index"))));
      });
      ui.serverPreviewMapGrid.addEventListener("mouseleave", () => {
        clearServerPreviewHover();
        serverPreviewHoveredIndex = -1;
        if (ui.serverPreviewMapHover) ui.serverPreviewMapHover.textContent = "Hover district: —";
      });
      ui.serverPreviewMapGrid.addEventListener("click", (event) => {
        if (serverPreviewDrag.moved) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const districtNode = target.closest("[data-preview-district-id]");
        if (!districtNode) return;
        renderModalForPreviewDistrict(districtNode.getAttribute("data-preview-district-id"));
      });
    }
    if (ui.serverPreviewMapLegend) {
      ui.serverPreviewMapLegend.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("[data-preview-zone]");
        if (!button) return;
        const zone = String(button.getAttribute("data-preview-zone") || "");
        serverPreviewFocusedZone = serverPreviewFocusedZone === zone ? "" : zone;
        applyServerPreviewZoneFocus();
      });
    }
    if (ui.serverPreviewZoomIn) {
      ui.serverPreviewZoomIn.addEventListener("click", () => {
        serverPreviewView.scale = Math.min(serverPreviewView.maxScale, serverPreviewView.scale + 0.16);
        applyServerPreviewViewport();
      });
    }
    if (ui.serverPreviewZoomOut) {
      ui.serverPreviewZoomOut.addEventListener("click", () => {
        serverPreviewView.scale = Math.max(serverPreviewView.minScale, serverPreviewView.scale - 0.16);
        applyServerPreviewViewport();
      });
    }
    if (ui.serverPreviewReset) {
      ui.serverPreviewReset.addEventListener("click", () => {
        serverPreviewFocusedZone = "";
        resetServerPreviewViewport();
        applyServerPreviewZoneFocus();
      });
    }
  }
  function bindServerSwitch() { ui.serverSwitcher.addEventListener("change", () => { state.selectedServer = ui.serverSwitcher.value; regenerateOpsFeedData(); renderDetail(`Server ${getSelectedServer().name}`, `${getSelectedServer().type.toUpperCase()} mode. ${getSelectedServer().players}/${getSelectedServer().maxPlayers} players. ${getSelectedServer().districtCount} districts.`); renderTopbar(); renderDashboardOverview(); renderServersSection(); renderServerDetailSection(); renderPlayersSection(); renderAlliancesSection(); renderDistrictsSection(); renderEconomySection(); renderPoliceSection(); renderEventsSection(); renderLogsSection(); renderNotificationsSection(); pushOpsLog(`Server switched to ${getSelectedServer().name}`); }); ui.dataSourceSwitcher.addEventListener("change", () => { state.filters.dataSource = ui.dataSourceSwitcher.value; pushOpsLog(`Data source set to ${state.filters.dataSource}`); }); ui.refreshBtn.addEventListener("click", () => { regenerateOpsFeedData(); renderSummary(); renderActiveSection(); pushOpsLog("Dashboard sync complete"); }); ui.notificationsBtn.addEventListener("click", () => { ui.notificationsPop.classList.toggle("is-hidden"); }); ui.notificationsMuteBtn.addEventListener("click", () => { pushOpsLog("Notifications muted"); }); }
  function bindServerDetailViewControls() {
    if (ui.serverDetailViewLiveBtn) {
      ui.serverDetailViewLiveBtn.addEventListener("click", () => {
        state.filters.serverDetailMapView = "live";
        renderServerDetailSection();
      });
    }
    if (ui.serverDetailViewLayoutBtn) {
      ui.serverDetailViewLayoutBtn.addEventListener("click", () => {
        state.filters.serverDetailMapView = "layout";
        renderServerDetailSection();
      });
    }
  }

  async function init() { regenerateOpsFeedData(); renderSummary(); renderActiveSection(); updateClock(); window.setInterval(updateClock, 1000); bindSidebarNavClick(); bindRowClickHandlers(); bindFilterChange(); bindSearchInput(); bindModalOpenClose(); bindQuickActionButtons(); bindServerCreator(); bindServerSwitch(); bindServerDetailViewControls(); pushOpsLog("Admin dashboard spuštěn"); await loadBalanceConfigs(); regenerateOpsFeedData(); renderSummary(); renderActiveSection(); }
  init();
})();
