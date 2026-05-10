const namedDowntownExchanges = [
  "Vortex Exchange"
];

const namedDowntownCentralBanks = [
  "Iron Reserve Bank",
  "Federal Reserve Node"
];

const namedDowntownAirports = [
  "Neon Skyport"
];

const namedDowntownLobbyClubs = [
  "Velvet Influence Club",
  "Shadow Lobby Lounge"
];

const namedDowntownCityHalls = [
  "City Dominion Hall"
];

const namedDowntownParliaments = [
  "The Vortex Council"
];

const namedDowntownPorts = [
  "Black Tide Port",
  "Ironsea Dockyard",
  "Shadow Harbor"
];

const namedDowntownCourts = [
  "High Justice Court",
  "Iron Verdict Hall"
];

const namedDowntownVipLounges = [
  "Platinum Lounge",
  "Eclipse VIP Gold Room"
];

const namedCommercialMalls = [
  "Neon Mall",
  "Iron Market Plaza",
  "Karina shopping center"
];

const namedCommercialRestaurants = [
  "Neon Bite",
  "Black Plate",
  "Street Fuel",
  "Blood & Grill",
  "Midnight Diner",
  "Iron Taste",
  "Shadow Kitchen",
  "Dirty Spoon",
  "Vice Kitchen",
  "Urban Hunger",
  "Smoke & Meat",
  "The Last Bite",
  "Gangster Grill",
  "Concrete Kitchen",
  "Dark Appetite",
  "Night Feast",
  "The Hungry Syndicate",
  "Rusty Fork",
  "Back Alley Bistro",
  "Sinful Kitchen",
  "Underground Taste",
  "Savage Kitchen",
  "Chrome Diner",
  "Heat Kitchen",
  "No Mercy Meals",
  "Broken Plate",
  "Elite Hunger"
];

const namedCommercialPharmacies = [
  "Neon Medics",
  "Pulse Pharmacy",
  "Black Cross Pharma",
  "Street Remedy",
  "NightCare Clinic",
  "Iron Vein Pharmacy",
  "QuickFix Med",
  "Shadow Medics",
  "Urban Cure",
  "Last Chance Pharmacy"
];

const namedCommercialAutoSalons = [
  "Neon Motors",
  "Iron Wheels Garage",
  "Blackline Autos",
  "Street Kings Motors",
  "Midnight Drive Showroom",
  "Chrome Syndicate Cars",
  "Ghost Ride Autos",
  "Velocity X Garage"
];

const namedCommercialFitnessClubs = [
  "Iron District Gym",
  "Beast Factory",
  "Street Power Club",
  "No Mercy Fitness"
];

const namedCommercialExchanges = [
  "ZeroSum Vault",
  "Neon Arbitrage",
  "Phantom Rates",
  "Cashflow Mirage",
  "Obsidian Exchange",
  "Flux Currency Lab",
  "DeadDrop Finance",
  "Parallax Exchange",
  "Ghost Ledger",
  "Black Circuit Exchange",
  "Silver Pulse Desk",
  "Midnight Convertor"
];

const namedCommercialArcades = [
  "Neon Jackpots",
  "Lucky Circuit",
  "Black Reel Club",
  "Midnight Slots",
  "Spin Syndicate",
  "Velvet Jackpot Lounge",
  "Ghost Spin Arcade"
];

const namedCommercialCasinos = [
  "Dominion Prime Casino",
  "High Rollers Sanctum",
  "Velvet Eclipse Casino",
  "Neon Crown Palace"
];

const namedIndustrialPowerStations = [
  "Neon Power Grid",
  "IronVolt Station",
  "BlackCore Energy",
  "Pulse Reactor",
  "Voltage Nexus",
  "Dark Energy Hub",
  "GridLock Station",
  "Quantum Power Plant",
  "Overcharge Facility",
  "ThunderCore Station",
  "Nova Energy Complex",
  "Static Surge Plant",
  "Flux Power Systems",
  "Obsidian Reactor",
  "HyperGrid Control"
];

const namedIndustrialStorages = [
  "IronVault Storage",
  "BlackCrate Depot",
  "Shadow Storage Hub",
  "CargoCore Warehouse",
  "Ghost Stockpile",
  "SteelBox Depot",
  "NightStorage Facility",
  "Hidden Goods Warehouse",
  "VaultLine Storage",
  "Obsidian Depot",
  "DeadDrop Warehouse",
  "Lockdown Storage",
  "Backroom Stockpile",
  "SecureHold Facility",
  "SteelNest Depot",
  "GridSafe Storage",
  "NightCrate Complex",
  "CargoLock Hub",
  "SilentVault Depot",
  "IronGate Warehouse",
  "DarkReserve Storage"
];

const namedIndustrialFactories = [
  "IronWorks Factory",
  "BlackSmoke Industries",
  "RustCore Plant",
  "SteelPulse Factory",
  "GrimeWorks Facility",
  "DarkForge Industrial",
  "Vortex Manufacturing",
  "HeavyGear Plant",
  "SmokeLine Industries",
  "Obsidian Production",
  "Dust & Steel Works",
  "NightShift Factory",
  "CoreMechanix Plant",
  "Ashline Industries",
  "BruteForce Manufacturing",
  "IronClad Works",
  "GritFactory Complex",
  "SteelHive Plant",
  "ToxicFlow Industries",
  "ShadowMachina Works",
  "HyperSteel Production",
  "GrindCore Factory",
  "MassDrive Industries",
  "DirtyWorks Plant",
  "Overload Manufacturing"
];

const namedIndustrialArmories = [
  "Iron Arsenal",
  "BlackForge Armory",
  "WarCore Factory",
  "Steel Reaper Works",
  "Crimson Armory",
  "Bullet Syndicate",
  "Deadshot Industries",
  "Obsidian Weapons Lab",
  "Vortex Arms Facility",
  "Nightfall Armory",
  "RapidFire Complex",
  "HellTrigger Works",
  "Ghost Weapon Systems",
  "Bloodline Arsenal",
  "Savage Arms Co.",
  "Zero Mercy Armory",
  "Titan Forge Weapons",
  "DarkSteel Industries",
  "Recoil Factory",
  "Phantom Arms Lab",
  "Iron Rain Arsenal"
];

const namedIndustrialRecyclingCenters = [
  "SteelLoop Recycling",
  "BlackCycle Depot",
  "NeoWaste Recovery",
  "Iron Reclaim Facility",
  "ScrapCore Center",
  "Urban Reforge Plant",
  "DustLine Recycling",
  "GhostMetal Recovery"
];

const namedResidentialApartmentBlocks = Array.from(
  { length: 36 },
  (_, index) => `Blok ${index + 1}`
);

const namedResidentialGarages = [
  "Iron Garage",
  "Street Wheels Hub",
  "BlackTorque Garage",
  "Ghost Garage",
  "NightRide Workshop",
  "SteelDrive Garage",
  "BackAlley Garage",
  "Velocity Garage",
  "Shadow Wheels"
];

const namedResidentialClinics = [
  "NightCare Clinic",
  "BlackCross Medical",
  "PulseFix Clinic",
  "StreetMed Center",
  "Iron Health Unit",
  "GhostCare Facility",
  "RapidAid Clinic",
  "ShadowMed Center",
  "LastHope Clinic",
  "Urban Recovery"
];

const namedResidentialRecruitCenters = [
  "Iron Recruit Hub",
  "Street Army Center",
  "BlackFlag Recruitment",
  "Shadow Enlistment",
  "Warborn Center",
  "Ghost Recruit Station",
  "Bloodline Recruitment",
  "Urban Soldiers Hub",
  "Vortex Recruit Base",
  "Frontline Enlistment",
  "No Mercy Recruitment"
];

const namedResidentialSchools = [
  "Street Academy",
  "Neon Learning Center",
  "Urban Knowledge Hub",
  "IronMind School",
  "Shadow Education",
  "Vortex Academy",
  "CoreSkill Institute",
  "Future Minds School",
  "BlackBoard Academy",
  "City Knowledge Center",
  "BrainCore School",
  "NextGen Academy",
  "StreetWise Institute",
  "LogicLab School"
];

const namedParkDrugLabs = [
  "Neon Chem Lab",
  "BlackDust Factory",
  "GhostCook Lab",
  "Shadow Chemistry",
  "CrystalForge",
  "NightBatch Lab",
  "Toxic Synthesis",
  "DarkMix Facility",
  "StreetLab X",
  "PureRush Lab",
  "SilentCook Lab"
];

const namedParkSmugglingTunnels = [
  "Ghost Tunnel",
  "BlackRoute Passage",
  "Shadow Transit",
  "Silent Tunnel Network",
  "Underground Flow",
  "DarkPath Tunnel",
  "Hidden Route X",
  "Night Tunnel Line",
  "Smugglers Vein",
  "Phantom Passage",
  "DeepRoute Tunnel",
  "Backline Tunnel",
  "ZeroTrace Route",
  "Iron Tunnel"
];

const namedParkStreetDealers = [
  "Corner Dealers",
  "Night Sellers",
  "Ghost Pushers",
  "Street Hustlers",
  "Shadow Dealers",
  "QuickDrop Crew",
  "BackAlley Sellers",
  "Neon Push",
  "Silent Dealers",
  "FastCash Crew",
  "Dirty Hands",
  "Block Hustlers",
  "Dark Trade Crew",
  "Urban Pushers",
  "NoFace Dealers"
];

const namedParkStripClubs = [
  "Velvet Nights",
  "Neon Desire",
  "Midnight Dolls",
  "Crimson Lounge",
  "Silk & Sin",
  "Shadow Seduction",
  "Dark Angels Club",
  "Electric Temptation",
  "Night Velvet",
  "Obsidian Desire",
  "RedLight Palace",
  "Forbidden Lounge",
  "Lust District",
  "Golden Sinners",
  "Vice Lounge"
];

const namedParkConvenienceStores = [
  "QuickStop Market",
  "NightMart",
  "Urban MiniShop",
  "Street Corner Store",
  "24/7 Neon Shop",
  "FastBuy Market",
  "Backstreet Market",
  "GhostMart",
  "QuickPick Store",
  "City MiniMarket",
  "FlashMart",
  "Night Supply",
  "Urban Grab Shop",
  "RapidBuy Store",
  "Street Essentials",
  "MiniCore Market",
  "InstantShop",
  "Shadow Mart",
  "EasyBuy Corner",
  "Daily Needs Shop"
];

export const DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME = Object.freeze({
  Burza: namedDowntownExchanges,
  "Centrální banka": namedDowntownCentralBanks,
  Letiště: namedDowntownAirports,
  "Lobby klub": namedDowntownLobbyClubs,
  Magistrát: namedDowntownCityHalls,
  Parlament: namedDowntownParliaments,
  "Přístav": namedDowntownPorts,
  Soud: namedDowntownCourts,
  "VIP salonek": namedDowntownVipLounges,
  "Obchodní centrum": namedCommercialMalls,
  Restaurace: namedCommercialRestaurants,
  "Lékárna": namedCommercialPharmacies,
  Autosalon: namedCommercialAutoSalons,
  "Fitness Club": namedCommercialFitnessClubs,
  "Směnárna": namedCommercialExchanges,
  Herna: namedCommercialArcades,
  Kasino: namedCommercialCasinos,
  "Energetická stanice": namedIndustrialPowerStations,
  Sklad: namedIndustrialStorages,
  "Továrna": namedIndustrialFactories,
  "Zbrojovka": namedIndustrialArmories,
  "Recyklační centrum": namedIndustrialRecyclingCenters,
  "Bytový blok": namedResidentialApartmentBlocks,
  Garage: namedResidentialGarages,
  Klinika: namedResidentialClinics,
  "Rekrutační centrum": namedResidentialRecruitCenters,
  "Škola": namedResidentialSchools,
  "Drug lab": namedParkDrugLabs,
  "Pašovací tunel": namedParkSmugglingTunnels,
  "Pouliční dealeři": namedParkStreetDealers,
  "Strip club": namedParkStripClubs,
  "Večerka": namedParkConvenienceStores
});
