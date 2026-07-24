(function() {
  "use strict";
  class AdminApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const createAdminApiClient = (basePath = "/api/admin") => ({
    getSession: (signal) => request(`${basePath}/session`, { signal }),
    login: (username, password, signal) => request(`${basePath}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal
    }),
    logout: async (signal) => {
      await request(`${basePath}/session`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal
      });
    },
    getOverview: (signal) => request(`${basePath}/overview`, { signal }),
    getInstance: (instanceId, signal) => request(
      `${basePath}/instances/${encodeURIComponent(instanceId)}`,
      { signal }
    ),
    getControlPlane: (signal) => request(`${basePath}/control-plane`, { signal }),
    createServer: (input, idempotencyKey, signal) => request(`${basePath}/servers`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
      signal
    }),
    requestLifecycleAction: (instanceId, input, idempotencyKey, signal) => request(
      `${basePath}/servers/${encodeURIComponent(instanceId)}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify(input),
        signal
      }
    )
  });
  const request = async (url, init) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json", ...init.headers },
      cache: "no-store",
      ...init
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !(payload == null ? void 0 : payload.accepted)) {
      const apiError = payload && !payload.accepted ? payload.errors[0] : null;
      throw new AdminApiError(
        response.status,
        (apiError == null ? void 0 : apiError.code) ?? "ADMIN_INVALID_RESPONSE",
        (apiError == null ? void 0 : apiError.message) ?? "Admin server returned an invalid response."
      );
    }
    return payload.data;
  };
  const publicBuildingNameVariants = {
    stock_exchange: ["Vortex Exchange"],
    central_bank: ["Iron Reserve Bank", "Federal Reserve Node", "Obsidian Reserve Bank"],
    airport: ["Neon Skyport"],
    lobby_club: ["Velvet Influence Club", "Shadow Lobby Lounge"],
    city_hall: ["City Dominion Hall"],
    parliament: ["The Vortex Council"],
    port: ["Black Tide Port", "Ironsea Dockyard", "Shadow Harbor"],
    court: ["High Justice Court", "Iron Verdict Hall"],
    vip_lounge: ["Platinum Lounge", "Eclipse VIP Gold Room", "Black Card Salon"],
    shopping_mall: ["Neon Mall", "Iron Market Plaza", "Karina shopping center", "Chrome Galleria", "Midnight Plaza", "Shadow Retail Hub", "Vortex Shopping Hall", "Blackline Mall", "Neon Bazaar", "Iron Arcade Plaza"],
    restaurant: ["Neon Bite", "Black Plate", "Street Fuel", "Blood & Grill", "Midnight Diner", "Iron Taste", "Shadow Kitchen", "Dirty Spoon", "Vice Kitchen", "Urban Hunger", "Smoke & Meat", "The Last Bite", "Gangster Grill", "Concrete Kitchen", "Dark Appetite", "Night Feast", "The Hungry Syndicate", "Rusty Fork", "Back Alley Bistro", "Sinful Kitchen", "Underground Taste", "Savage Kitchen", "Chrome Diner", "Heat Kitchen", "No Mercy Meals", "Broken Plate", "Elite Hunger", "Redline Noodles", "Vortex Burger Lab", "Steel Pan House", "Lucky Wok", "Afterhours Grill", "Chrome Taco Bar", "Black Lotus Diner", "Neon Fish Market", "Cinder Steakhouse"],
    pharmacy: ["Neon Medics", "Pulse Pharmacy", "Black Cross Pharma", "Street Remedy", "NightCare Pharmacy", "Iron Vein Pharmacy", "QuickFix Med", "Shadow Medics", "Urban Cure", "Last Chance Pharmacy", "Chrome Cure", "Vortex Med Supply", "Midnight Apothecary", "Street First Aid", "Neon Remedy Lab", "IronDose Pharmacy"],
    car_dealer: ["Neon Motors", "Iron Wheels Garage", "Blackline Autos", "Street Kings Motors", "Midnight Drive Showroom", "Chrome Syndicate Cars", "Ghost Ride Autos", "Velocity X Garage", "Redline Auto House", "Viper Motors"],
    fitness_club: ["Iron District Gym", "Beast Factory", "Street Power Club", "No Mercy Fitness", "Chrome Body Lab"],
    exchange: ["ZeroSum Vault", "Neon Arbitrage", "Phantom Rates", "Cashflow Mirage", "Obsidian Exchange", "Flux Currency Lab", "DeadDrop Finance", "Parallax Exchange", "Ghost Ledger", "Black Circuit Exchange", "Silver Pulse Desk", "Midnight Convertor"],
    arcade: ["Neon Jackpots", "Lucky Circuit", "Black Reel Club", "Midnight Slots", "Spin Syndicate", "Velvet Jackpot Lounge", "Ghost Spin Arcade", "Chrome Coin Den", "Shadow Arcade Hall", "Jackpot Cellar", "Pulse Playhouse", "Lucky Voltage", "Backroom Reels", "Night Token Club", "Vortex Game Floor", "Static Jackpot Lab"],
    casino: ["Dominion Prime Casino", "High Rollers Sanctum", "Velvet Eclipse Casino", "Neon Crown Palace"],
    power_station: ["Neon Power Grid", "IronVolt Station", "BlackCore Energy", "Pulse Reactor", "Voltage Nexus", "Dark Energy Hub", "GridLock Station", "Quantum Power Plant", "Overcharge Facility", "ThunderCore Station", "Nova Energy Complex", "Static Surge Plant", "Flux Power Systems", "Obsidian Reactor", "HyperGrid Control"],
    warehouse: ["IronVault Storage", "BlackCrate Depot", "Shadow Storage Hub", "CargoCore Warehouse", "Ghost Stockpile", "SteelBox Depot", "NightStorage Facility", "Hidden Goods Warehouse", "VaultLine Storage", "Obsidian Depot", "DeadDrop Warehouse", "Lockdown Storage", "Backroom Stockpile", "SecureHold Facility", "SteelNest Depot", "GridSafe Storage", "NightCrate Complex", "CargoLock Hub", "SilentVault Depot", "IronGate Warehouse", "DarkReserve Storage"],
    factory: ["IronWorks Factory", "BlackSmoke Industries", "RustCore Plant", "SteelPulse Factory", "GrimeWorks Facility", "DarkForge Industrial", "Vortex Manufacturing", "HeavyGear Plant", "SmokeLine Industries", "Obsidian Production", "Dust & Steel Works", "NightShift Factory", "CoreMechanix Plant", "Ashline Industries", "BruteForce Manufacturing", "IronClad Works", "GritFactory Complex", "SteelHive Plant", "ToxicFlow Industries", "ShadowMachina Works", "HyperSteel Production", "GrindCore Factory", "MassDrive Industries", "DirtyWorks Plant", "Overload Manufacturing", "Foundry Zero", "NightHammer Plant", "ChromeLine Works"],
    armory: ["Iron Arsenal", "BlackForge Armory", "WarCore Factory", "Steel Reaper Works", "Crimson Armory", "Bullet Syndicate", "Deadshot Industries", "Obsidian Weapons Lab", "Vortex Arms Facility", "Nightfall Armory", "RapidFire Complex", "HellTrigger Works", "Ghost Weapon Systems", "Bloodline Arsenal", "Savage Arms Co.", "Zero Mercy Armory", "Titan Forge Weapons", "DarkSteel Industries", "Recoil Factory", "Phantom Arms Lab", "Iron Rain Arsenal"],
    recycling_center: ["SteelLoop Recycling", "BlackCycle Depot", "NeoWaste Recovery", "Iron Reclaim Facility", "ScrapCore Center", "Urban Reforge Plant", "DustLine Recycling", "GhostMetal Recovery", "ChromeScrap Yard", "Vortex Salvage Hub", "Reclaim Nine", "Blackline Scrapworks", "StreetCycle Plant", "Redline Recovery"],
    apartment_block: Array.from({ length: 36 }, (_, index) => `Blok ${index + 1}`),
    garage: ["Iron Garage", "Street Wheels Hub", "BlackTorque Garage", "Ghost Garage", "NightRide Workshop", "SteelDrive Garage", "BackAlley Garage", "Velocity Garage", "Shadow Wheels", "Chrome Alley Garage", "Midnight Motor Yard", "Grindhouse Garage", "Viper Wheelworks", "Rustline Motors", "Neon Clutch Depot", "Redline Hideout"],
    clinic: ["NightCare Clinic", "BlackCross Medical", "PulseFix Clinic", "StreetMed Center", "Iron Health Unit", "GhostCare Facility", "RapidAid Clinic", "ShadowMed Center", "LastHope Clinic", "Urban Recovery"],
    recruitment_center: ["Iron Recruit Hub", "Street Army Center", "BlackFlag Recruitment", "Shadow Enlistment", "Warborn Center", "Ghost Recruit Station", "Bloodline Recruitment", "Urban Soldiers Hub", "Vortex Recruit Base", "Frontline Enlistment", "No Mercy Recruitment", "Chrome Cadet Office", "IronLine Muster", "Street Oath Center", "Black Banner Depot", "Viper Recruit Hall"],
    school: ["Street Academy", "Neon Learning Center", "Urban Knowledge Hub", "IronMind School", "Shadow Education", "Vortex Academy", "CoreSkill Institute", "Future Minds School", "BlackBoard Academy", "City Knowledge Center", "BrainCore School", "NextGen Academy", "StreetWise Institute", "LogicLab School"],
    drug_lab: ["Neon Chem Lab", "BlackDust Factory", "GhostCook Lab", "Shadow Chemistry", "CrystalForge", "NightBatch Lab", "Toxic Synthesis", "DarkMix Facility", "StreetLab X", "PureRush Lab", "SilentCook Lab"],
    smuggling_tunnel: ["Ghost Tunnel", "BlackRoute Passage", "Shadow Transit", "Silent Tunnel Network", "Underground Flow", "DarkPath Tunnel", "Hidden Route X", "Night Tunnel Line", "Smugglers Vein", "Phantom Passage", "DeepRoute Tunnel", "Backline Tunnel", "ZeroTrace Route", "Iron Tunnel", "CrossTown Drain", "Redline Passage", "Shadow Pipe Route", "Underpass Relay"],
    street_dealers: ["Corner Dealers", "Night Sellers", "Ghost Pushers", "Street Hustlers", "Shadow Dealers", "QuickDrop Crew", "BackAlley Sellers", "Neon Push", "Silent Dealers", "FastCash Crew", "Dirty Hands", "Block Hustlers", "Dark Trade Crew", "Urban Pushers", "NoFace Dealers", "Corner Runners", "Redline Pushers", "Backblock Sellers", "Neon Corner Crew"],
    strip_club: ["Velvet Nights", "Neon Desire", "Midnight Dolls", "Crimson Lounge", "Silk & Sin", "Shadow Seduction", "Dark Angels Club", "Electric Temptation", "Night Velvet", "Obsidian Desire", "RedLight Palace", "Forbidden Lounge", "Lust District", "Golden Sinners", "Vice Lounge", "Scarlet Pulse", "Afterdark Velvet"],
    convenience_store: ["QuickStop Market", "NightMart", "Urban MiniShop", "Street Corner Store", "24/7 Neon Shop", "FastBuy Market", "Backstreet Market", "GhostMart", "QuickPick Store", "City MiniMarket", "FlashMart", "Night Supply", "Urban Grab Shop", "RapidBuy Store", "Street Essentials", "MiniCore Market", "InstantShop", "Shadow Mart", "EasyBuy Corner", "Daily Needs Shop"]
  };
  const second = 1e3;
  const minute = 60 * second;
  const freeActionCooldownMs = 90 * second;
  const out = (key, amount) => ({ [key]: amount });
  const resources = (entries) => ({ ...entries });
  const action = (input) => ({
    actionId: input.actionId,
    label: input.label,
    description: input.description,
    effectSummary: input.effectSummary,
    durationMs: Math.max(0, Math.floor(Number(input.durationMs ?? 0))),
    cooldownMs: Math.max(1e3, Math.floor(Number(input.cooldownMs ?? freeActionCooldownMs))),
    inputCost: { ...input.inputCost ?? {} },
    outputGain: { ...input.outputGain ?? {} },
    heatGain: Math.floor(Number(input.heatGain ?? 0)),
    influenceChange: Number(input.influenceChange ?? 0),
    effectModifiers: input.effectModifiers ? { ...input.effectModifiers } : void 0,
    reportText: input.effectSummary
  });
  const stat = (cleanPerHour, dirtyPerHour, heatPerDay, influencePerDay, maxLevel = 5) => ({
    cleanPerHour,
    dirtyPerHour,
    heatPerDay,
    influencePerDay,
    maxLevel
  });
  const perMinuteStat = (cleanPerMinute, dirtyPerMinute, heatPerDay = 0, influencePerDay = 0, maxLevel = 5) => stat(cleanPerMinute * 60, dirtyPerMinute * 60, heatPerDay, influencePerDay, maxLevel);
  const building = (buildingTypeId, label, zone, role, info, stats, specialActions) => ({
    buildingTypeId,
    label,
    nameVariants: publicBuildingNameVariants[buildingTypeId] ?? [],
    zone,
    role,
    info,
    stats,
    specialActions
  });
  const publicBuildingDefinitions = [
    building("central_bank", "Centrální banka", "downtown", "Ultra vzácná / finance / rezervy / stabilita marketu", "Centrální banka netiskne chaos. Drží ho pod zámkem. Kdo ovládá rezervy, nemusí vyhrávat každou přestřelku. Stačí, když přežije každou krizi.", perMinuteStat(160, 0, 0.1 * 60 * 24, 0.35 * 60 * 24, 1), [
      action({ actionId: "liquidity_injection", label: "Likviditní injekce", description: "Okamžitě přidá clean cash podle velikosti čisté ekonomiky hráče.", effectSummary: "Cena 20 influence, +clean cash, +heat, +Financial Oversight risk", cooldownMs: 20 * minute, heatGain: 4, influenceChange: -20 }),
      action({ actionId: "frozen_accounts", label: "Zmrazené účty", description: "Dočasně zvýší ochranu clean cash a sníží finanční ztráty.", effectSummary: "Cena 2000 clean cash, ochrana rezerv, horší market fee", durationMs: 8 * minute, cooldownMs: 24 * minute, heatGain: 5, inputCost: out("cash", 2e3) }),
      action({ actionId: "currency_intervention", label: "Kurzovní intervence", description: "Stabilizuje materiálový market a tlumí výkyvy způsobené Tržním tlakem Burzy.", effectSummary: "Cena 3000 clean cash + 25 influence, nižší volatilita materiálů, +heat", durationMs: 8 * minute, cooldownMs: 28 * minute, heatGain: 7, inputCost: out("cash", 3e3), influenceChange: -25 })
    ]),
    building("city_hall", "Magistrát", "downtown", "Ultra vzácná / politika / kontrola města / řízení heatu", "Magistrát není gangová základna. Je to místo, kde se zločin mění na razítko. Kdo drží magistrát, nemusí mít vždy větší zbraň. Stačí, když má správný podpis.", perMinuteStat(130, 0, 0.12 * 60 * 24, 0.85 * 60 * 24, 1), [
      action({ actionId: "official_cover", label: "Úřední krytí", description: "Na 8 minut sníží heat gain, police control chance a rumor chance ve všech vlastněných districtech.", effectSummary: "Cena 1500 clean + 25 influence, heat +2, scandal risk +8 %", cooldownMs: 20 * minute, durationMs: 8 * minute, heatGain: 2, inputCost: out("cash", 1500), influenceChange: -25 }),
      action({ actionId: "city_contract", label: "Městská zakázka", description: "Převede politický vliv na clean cash podle počtu legálních budov hráče.", effectSummary: "Cena 20 influence, reward 1500 + legální budovy × 120, heat +3", cooldownMs: 18 * minute, heatGain: 3, influenceChange: -20 }),
      action({ actionId: "emergency_decree", label: "Nouzová vyhláška", description: "Na 6 minut aktivuje Zastavené kontroly pro vlastněné distrikty.", effectSummary: "Cena 2500 clean + 40 influence, heat +8, méně policejních incidentů", cooldownMs: 28 * minute, durationMs: 6 * minute, heatGain: 8, inputCost: out("cash", 2500), influenceChange: -40 })
    ]),
    building("lobby_club", "Lobby Club", "downtown", "Ultra vzácná / lobby / vliv / politická podpora", "Lobby Club není úřad. Je to místnost vedle úřadu, kde se rozhodne dřív, než někdo zvedne ruku. Kdo drží Lobby Club, nevládne městu přímo. Jen šeptá lidem, kteří městem hýbou.", perMinuteStat(95, 0, 0.1 * 60 * 24, 0.65 * 60 * 24, 1), [
      action({ actionId: "backroom_pressure", label: "Zákulisní tlak", description: "Na 8 minut posílí influence produkci všech budov, zlevní influence akce a sníží negativní drby.", effectSummary: "Cena 1200 clean + 25 influence, influence +18 %, influence akce -10 %, heat +3", cooldownMs: 20 * minute, durationMs: 8 * minute, heatGain: 3, inputCost: out("cash", 1200), influenceChange: -25 }),
      action({ actionId: "quiet_negotiation", label: "Tiché vyjednávání", description: "Zkrátí jeden aktivní politický nebo společenský cooldown, sníží rizika a zlevní další influence akci.", effectSummary: "Cena 1500 clean + 15 influence, cooldown -20 % zbývajícího času, heat +2", cooldownMs: 24 * minute, heatGain: 2, inputCost: out("cash", 1500), influenceChange: -15 }),
      action({ actionId: "media_screen", label: "Mediální clona", description: "Na 8 minut tlumí negativní drby, snižuje jejich pravdivost a zlepšuje civilní rumor truth.", effectSummary: "Cena 2000 clean, negativní drby -35 %, police warning +6 %, heat +4", cooldownMs: 26 * minute, durationMs: 8 * minute, heatGain: 4, inputCost: out("cash", 2e3) })
    ]),
    building("stock_exchange", "Burza", "downtown", "Ultra vzácná / ekonomika / kontrola marketu / finanční síla", "Burza je jediná na mapě. Neprodává zboží. Ovládá ceny, poplatky a rytmus celé ekonomiky. Skleněná věž v Downtownu, kde se války nevedou noži, ale grafy.", perMinuteStat(220, 0, 0.18 * 60 * 24, 0.45 * 60 * 24, 1), [
      action({ actionId: "speculative_buy", label: "Spekulativní nákup", description: "Investuje výchozí částku do materiálového marketu. Výsledek může být zisk, neutrální pohyb nebo ztráta.", effectSummary: "Cena 2500 clean + investice, heat +5, financial inspection risk +6 %", cooldownMs: 16 * minute, heatGain: 5, inputCost: out("cash", 2500) }),
      action({ actionId: "market_pressure", label: "Tržní tlak", description: "Na 10 minut zvýší ceny materiálového marketu.", effectSummary: "Cena 3000 clean + 15 influence, heat +8, market efekt", cooldownMs: 22 * minute, durationMs: 10 * minute, heatGain: 8, inputCost: out("cash", 3e3), influenceChange: -15 }),
      action({ actionId: "insider_window", label: "Vnitřní tipy", description: "Na 6 minut zlepší trend hinty, sníží market poplatek a zvedne šanci Spekulativního nákupu.", effectSummary: "Cena 1500 clean, heat +4, 3 trend hinty, market poplatek -8 %", cooldownMs: 18 * minute, durationMs: 6 * minute, heatGain: 4, inputCost: out("cash", 1500) })
    ]),
    building("court", "Soud", "downtown", "Ultra vzácná / právní ochrana / zmírnění razií / vliv", "Soud nevypne policii. Jen zařídí, aby její zásah bolel míň. Když máš rozsudky, odklady a správné právníky, i razie ztratí zuby.", perMinuteStat(105, 0, 0.08 * 60 * 24, 0.72 * 60 * 24, 1), []),
    building("vip_lounge", "VIP Salonek", "downtown", "Vzácná / elitní drby / přesnější intel / vliv", "VIP Salonek je luxusní informační uzel. Za tlumeným světlem a drahým stolem se mluví rychleji než ve městě dole. Nedává jistotu, ale jeho zákulisní drby bývají nebezpečně blízko pravdě.", perMinuteStat(105, 30, 0.13 * 60 * 24, 0.48 * 60 * 24, 1), []),
    building("airport", "Letiště", "downtown", "Ultra vzácná / logistika / import / černý trh / mobilita", "Letiště je brána města. Co ostatní musí vyrábět, ty můžeš dovézt. Co ostatní musí vozit ulicemi, ty pošleš přes runway. Ale každý kontejner má papíry. A každý falešný papír jednou někdo zkontroluje.", perMinuteStat(180, 45, 0.2 * 60 * 24, 0.2 * 60 * 24, 1), [
      action({ actionId: "express_import", label: "Expresní dovoz", description: "Po 90 sekundách doručí materiálovou importní zásilku do SKLADU hráče.", effectSummary: "Cena 2000 clean, heat +6, customs risk 10 %", cooldownMs: 18 * minute, durationMs: 90 * 1e3, heatGain: 6, inputCost: out("cash", 2e3) }),
      action({ actionId: "black_charter", label: "Černý charter", description: "Na 8 minut otevře speciální Black Market nabídku.", effectSummary: "Cena 2500 dirty, heat +9, nabídka -6 %, celní zátah při nákupu 15 %", cooldownMs: 24 * minute, durationMs: 8 * minute, heatGain: 9, inputCost: out("dirty-cash", 2500) }),
      action({ actionId: "evacuation_corridor", label: "Evakuační koridor", description: "Na 7 minut zlepší únik, ztráty při neúspěchu a návratovou logistiku.", effectSummary: "Cena 1800 clean, heat +5, escape +18 %, ztráty -10 %", cooldownMs: 26 * minute, durationMs: 7 * minute, heatGain: 5, inputCost: out("cash", 1800) })
    ]),
    building("port", "Přístav", "downtown", "Logistika", "Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.", perMinuteStat(26, 8.5, 5, 26), [
      action({ actionId: "port_container_cut", label: "Proříznout kontejner", description: "Vybere z kontejnerů užitečné zásoby.", effectSummary: "+dirty cash, +metal parts, +heat", heatGain: 6, outputGain: resources({ "dirty-cash": 160, "metal-parts": 3 }), influenceChange: 1 })
    ]),
    building("parliament", "Parlament", "downtown", "Moc", "Nejvyšší politická páka s extrémním clean income a vlivem.", perMinuteStat(22, 3, 3, 40), [
      action({ actionId: "parliament_policy_window", label: "Politické okno", description: "Otevře krátké politické okno pro zisk vlivu.", effectSummary: "+vliv, +clean cash, +heat", heatGain: 5, outputGain: out("cash", 160), influenceChange: 5 })
    ]),
    building("shopping_mall", "Obchodní centrum", "commercial", "Ekonomika / market / vliv / síťový bonus", "Obchodní centrum generuje peníze, menší dirty cash, vliv a snižuje ceny na marketu. Výlohy svítí, kasy pípají a v podzemních garážích se domlouvají dohody, které nikdy neuvidíš na účtence. Obchodní centrum není jen nákupní zóna. Je to tepna zásobování.", perMinuteStat(3700 / 60, 22, 65, 95, 1), []),
    building("restaurant", "Restaurace", "commercial", "Ekonomika / drby / vliv / městský provoz", "Restaurace generuje čisté peníze, trochu vlivu a městské drby. Lokální tržby, kryté schůzky a síť kontaktů z ní dělají civilní oporu komerčních districtů. Stoly u okna, zadní vchod pro kurýry a kuchyně, kde se slyší víc než na ulici.", perMinuteStat(38, 0, 57.6, 172.8, 1), [
      action({ actionId: "restaurant_collect_revenue", label: "Vybrat tržby", description: "Vybere lokální tržby restaurace jako clean a dirty cash.", effectSummary: "+869 clean cash, +550 dirty cash, heat +5", cooldownMs: 30 * minute, outputGain: resources({ cash: 869, "dirty-cash": 550 }), heatGain: 5 }),
      action({ actionId: "restaurant_cover_meetings", label: "Krýt schůzky", description: "Na 30 minut zvedne lokální income restaurace a přidá vliv.", effectSummary: "+18 % clean/dirty income, +8 vliv, heat +4 na 30 minut", cooldownMs: 45 * minute, durationMs: 30 * minute, heatGain: 4, influenceChange: 8, effectModifiers: { cleanIncomeMultiplier: 1.18, dirtyIncomeMultiplier: 1.18 } }),
      action({ actionId: "restaurant_local_network", label: "Posílit lokální síť", description: "Na 30 minut posílí lokální vliv restaurace.", effectSummary: "+12 % vliv, +4 vliv, heat +8 na 30 minut", cooldownMs: 30 * minute, durationMs: 30 * minute, heatGain: 8, influenceChange: 4, effectModifiers: { influenceMultiplier: 1.12 } })
    ]),
    building("arcade", "Herna", "residential", "Ekonomika / dirty cash / praní / síť", "Herna je pouliční cashflow. Blikající automaty, špinavé mince, zadní pokladna a dým z cigaret. Sama o sobě tě nespasí, ale síť heren dokáže krmit gang celou free session.", perMinuteStat(30, 20, 172.8, 80, 1), [
      action({ actionId: "night_machines", label: "Noční automaty", description: "Dočasně zvýší clean, dirty, vliv, heat a audit risk Herny. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 7 minut", cooldownMs: 16 * minute, durationMs: 7 * minute, effectModifiers: { cleanIncomeMultiplier: 1.35, dirtyIncomeMultiplier: 1.65, influenceMultiplier: 1.15, heatMultiplier: 1.45 } }),
      action({ actionId: "back_cashdesk", label: "Zadní pokladna", description: "Instantně vypere 13 % aktuálního dirty cash hráče přes zadní pokladnu.", effectSummary: "-dirty cash, +clean cash po 15 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 16 * minute, heatGain: 3, influenceChange: 1 })
    ]),
    building("casino", "Kasino", "commercial", "Laundering / high-risk", "Vzácná high-value neonová pračka peněz. Dává extrémní cashflow, dirty cash a vliv, ale rychle zvedá heat a audit risk.", perMinuteStat(4500 / 60, 2500 / 60, 150, 110, 4), [
      action({ actionId: "quiet_backroom", label: "Tichá herna", description: "Instantně vypere 24 % aktuálního dirty cash hráče až do limitu kasina.", effectSummary: "-dirty cash, +clean cash po 9 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 14 * minute, heatGain: 7, influenceChange: 3 }),
      action({ actionId: "vip_night", label: "VIP noc", description: "Dočasně zvýší casino income, vliv, heat a audit risk. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 10 minut", cooldownMs: 26 * minute, durationMs: 10 * minute, effectModifiers: { cleanIncomeMultiplier: 1.7, dirtyIncomeMultiplier: 1.55, influenceMultiplier: 1.25, heatMultiplier: 1.6 } }),
      action({ actionId: "bribed_inspector", label: "Podplacený inspektor", description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší tlak.", effectSummary: "Cena 15000 clean cash, šance selhání 14 %, heat -15 při úspěchu, audit control", cooldownMs: 105 * minute, durationMs: 12 * minute, inputCost: out("cash", 15e3) })
    ]),
    building("car_dealer", "Autosalon", "commercial", "Ekonomika / mobilita / logistika / kratší cooldowny", "Autosalon generuje peníze a zlepšuje mobilitu gangu. Lesklé kapoty vpředu, falešné smlouvy vzadu a klíče od aut, která nikdy neuvidí papíry. Autosalon není jen showroom. Je to úniková trasa na kolech.", stat(2145, 650, 60, 24, 1), []),
    building("fitness_club", "Fitness Club", "commercial", "Ekonomika / bojová podpora / fyzický trénink", "Fitness Club generuje čistý příjem a posiluje fyzickou sílu útoku i obrany. Nezískáš víc lidí. Získáš tvrdší lidi. Rezavé činky, rozbité zrcadlo a trenér, který nepočítá opakování, ale přežití.", perMinuteStat(72, 0, 0.04 * 60 * 24, 0, 1), []),
    building("exchange", "Směnárna", "commercial", "Ekonomika / praní / síť", "Směnárna pere menší částky bezpečněji než kasino. Jedna směnárna je služba. Síť směnáren je finanční pavouk přes celé město.", perMinuteStat(70, 95, 70, 60, 1), [
      action({ actionId: "good_rate", label: "Výhodný kurz", description: "Ve dne vypere 16 % aktuálního dirty cash hráče přes síť směnáren.", effectSummary: "-dirty cash, +clean cash po 12 % poplatku, heat +12, vliv +3, +audit risk", cooldownMs: 18 * minute, heatGain: 12, influenceChange: 3 })
    ]),
    building("apartment_block", "Bytový blok", "residential", "Populace / členové gangu", "Bytový blok negeneruje peníze ani heat. Jen lidi. A lidi jsou munice města.", stat(0, 0, 0, 0, 1), [
      action({ actionId: "collect_population", label: "Vybrat obyvatele", description: "Přesune lokálně uložené obyvatele do globální populace hráče a členů gangu.", effectSummary: "+obyvatelé, +gang members, bez heatu a bez peněz", cooldownMs: 0 })
    ]),
    building("recruitment_center", "Rekrutační centrum", "residential", "Podpora / populace / bojový bonus", "Rekrutační centrum nevyrábí lidi. Dělá z obyvatel použitelný gang a z výbavy skutečnou sílu. Lidi přijdou z bloků. Tady se z nich stává armáda ulice.", perMinuteStat(35, 0, 0.07 * 60 * 24, 0, 1), []),
    building("garage", "Garáž", "residential", "Ekonomika / logistika / kratší cooldowny", "Garáž generuje čistý příjem a snižuje cooldowny logistických, pohybových a přípravných akcí. Motory běží pod plechovou střechou, kufry mizí ve tmě a někdo vždycky ví, kudy projet bez kamer. Garáž není jen místo pro auta. Je to tempo celého gangu.", perMinuteStat(42, 0, 0.06 * 60 * 24, 0, 1), []),
    building("clinic", "Klinika", "residential", "Ekonomika / recovery / podpora", "Klinika nevyrábí zbraně ani gang. Zachraňuje to, co by jinak město sežralo.", stat(3100, 0, 85, 0, 1), [
      action({
        actionId: "stabilization_protocol",
        label: "Stabilizační protokol",
        description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
        effectSummary: "recovery pool, cena 1200 clean, +1 heat",
        cooldownMs: 18 * minute,
        heatGain: 1,
        inputCost: out("cash", 1200)
      })
    ]),
    building("school", "Škola", "residential", "Populace / vzdělání / městský život", "Škola generuje malé peníze a trochu obyvatel. Není to kasárna. Je to místo, kde město vyrábí chytřejší lidi. Rozbité lavice, studené chodby a tabule popsané věcmi, které se v učebnicích neučí.", perMinuteStat(18, 0, 0, 0.05 * 60 * 24, 1), [
      action({ actionId: "evening_course", label: "Večerní kurz", description: "Na 20 minut zrychlí nábor členů v bytových blocích. Nestackuje se.", effectSummary: "Cena 1000 clean cash, +60 % nábor členů na 20 minut", cooldownMs: 35 * minute, durationMs: 20 * minute, inputCost: out("cash", 1e3), effectModifiers: {} })
    ]),
    building("factory", "Továrna", "industrial", "Výroba", "Tři nezávislé linky vyrábějí Metal Parts, Tech Core a Combat Module po jednom kusu. Combat Module je strategická průmyslová komponenta pro high-tier výzbroj a pokročilé boost protokoly.", stat(0, 0, 3, 10, 14), []),
    building("armory", "Zbrojovka", "industrial", "Výzbroj", "Nezávislé linky vyrábějí útočné i obranné vybavení z Metal Parts, Tech Core a Combat Module. Každý cyklus vytvoří jeden kus.", stat(0, 0, 4, 18, 14), []),
    building("warehouse", "Skladiště", "industrial", "Economy / storage / logistics", "Skladiště zvyšuje maximum každé položky v globálním SKLADU. První aktivní Skladiště přidá 50 %, další menší síťový bonus a z levelů platí jen nejvyšší aktivní level.", stat(2700, 0, 86.4, 0, 4), []),
    building("power_station", "Energetická stanice", "industrial", "Infrastruktura / podpora / obrana", "Energetická stanice nezavádí nový zdroj. Zvedá výkon města, drží infrastrukturu při životě a posiluje bezpečnostní systémy. Když svítí stanice, město dýchá rychleji. Kamery vidí ostřeji. Alarmy řvou dřív.", perMinuteStat(2780 / 60, 780 / 60, 115.2, 0, 1), [
      action({ actionId: "backup_grid_switch", label: "Stabilizovat síť", description: "Na 25 minut zvýší bonus infrastruktury, posílí kamery a alarmy a přidá výkon Továrnám a Zbrojovkám. Nestackuje se sama se sebou.", effectSummary: "Cena 3500 clean cash, +12 % infrastruktura, +20 % kamery, +20 % alarm, heat +3 na 25 minut", cooldownMs: 60 * minute, durationMs: 25 * minute, inputCost: out("cash", 3500), heatGain: 3 }),
      action({ actionId: "power_station_feed_production", label: "Napájet výrobu", description: "Okamžitě přidá menší clean a dirty výnos z přesměrované výroby.", effectSummary: "+2000 clean cash, +500 dirty cash, heat +10", cooldownMs: 60 * minute, outputGain: resources({ cash: 2e3, "dirty-cash": 500 }), heatGain: 10 }),
      action({ actionId: "power_station_reduce_heat", label: "Snížit heat", description: "Serverově sníží heat districtu.", effectSummary: "Heat -20, cooldown 60 minut", cooldownMs: 60 * minute, heatGain: -20 })
    ]),
    building("recycling_center", "Recyklační centrum", "industrial", "Podpora / vytěžení ztrát / návrat itemů", "Recyklační centrum nevrací lidi. Vrací železo, zbraně, moduly a všechno, co se dá po boji ještě vytáhnout ze šrotu. Když bitva skončí, někdo počítá mrtvé. Recyklační centrum počítá, co se dá znovu použít.", perMinuteStat(40, 0, 0.08 * 60 * 24, 0, 1), [
      action({ actionId: "extract_losses", label: "Vytěžit ztráty", description: "Vrátí část neexpirovaných itemových ztrát ze zásobníku ztrát. Nikdy nevrací populaci ani členy gangu.", effectSummary: "Cena 900 clean cash, návrat itemů podle sítě Recyklačních center, heat +2", cooldownMs: 16 * minute, inputCost: out("cash", 900), heatGain: 2 })
    ]),
    building("pharmacy", "Lékárna", "commercial", "Výroba", "Tři nezávislé linky vyrábějí Chemicals, Biomass a Stim Pack po jednom kusu za clean cash. Hotové položky čekají v Lékárně na vyzvednutí do SKLADU.", stat(0, 0, 3, 8, 14), []),
    building("drug_lab", "Drug Lab", "park", "Výroba drog", "Pět nezávislých linek vyrábí Neon Dust, Pulse Shot, Velvet Smoke, Ghost Serum a Overdrive X. Vzácné komponenty napájejí strategické boost protokoly a nelze je aktivovat samostatně.", stat(0, 0, 6, 20, 14), []),
    building("smuggling_tunnel", "Pašovací tunel", "park", "Dirty cash / smuggling / dealer support / risk reward", "Pašovací tunel pasivně vytváří dirty cash a podporuje rychlost i bezpečnost pouliční distribuce. Cenu prodeje neurčuje: ta zůstává pevně odvozená z výroby v Drug Labu.", perMinuteStat(0, 54, 0.07 * 60 * 24, 0, 1), [
      action({ actionId: "open_channel", label: "Otevřít kanál", description: "Na 15 minut posílí dirty cash tunelů a zrychlí prodej Pouličních dealerů. Nestackuje se.", effectSummary: "Cena 1800 clean cash, heat +5, +45 % dirty tok tunelů, rychlejší prodej a vyšší riziko incidentu", cooldownMs: 30 * minute, durationMs: 15 * minute, inputCost: out("cash", 1800), heatGain: 5 })
    ]),
    building("convenience_store", "Večerka", "park", "Economy / populace / rumors / influence / street life", "Večerka generuje malé čisté peníze, drobné dirty cash, vliv, lokální pouliční drby a postupně nabírá nové lidi pro gang.", perMinuteStat(32, 18, 72, 144, 1), [
      action({ actionId: "collect_convenience_store_population", label: "Vybrat obyvatele", description: "Přesune obyvatele uložené ve Večerce do globální populace hráče a členů gangu.", effectSummary: "+obyvatelé, +gang members, bez heatu a bez peněz", cooldownMs: 0 })
    ]),
    building("strip_club", "Strip Club", "park", "Economy / influence / rumors / social network", "Strip Club pasivně vytváří peníze, vliv a drby. Vybrání cash, VIP klienti a soukromá party jsou samostatné akce s náklady, heatem a cooldownem.", perMinuteStat(75, 65, 85, 90, 1), [
      action({ actionId: "strip_club_collect_cash", label: "Vybrat cash", description: "Okamžitě vybere noční dirty cash ze Strip Clubu.", effectSummary: "+360 dirty cash, heat +3", cooldownMs: 10 * minute, outputGain: out("dirty-cash", 360), heatGain: 3 }),
      action({ actionId: "vip_lounge", label: "Hostit VIP klienty", description: "Dočasně zvýší clean cash, dirty cash, vliv, heat a šanci na drb. Nestackuje se sám se sebou.", effectSummary: "Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 30 minut", cooldownMs: 60 * minute, durationMs: 30 * minute, inputCost: out("cash", 800), effectModifiers: { cleanIncomeMultiplier: 1.45, dirtyIncomeMultiplier: 1.35, influenceMultiplier: 1.55, heatMultiplier: 1.5 } }),
      action({ actionId: "private_party", label: "Soukromá party", description: "Přidá okamžitý vliv, dočasně zvýší jeho tvorbu a může přinést extra drb nebo skandál.", effectSummary: "Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 %", cooldownMs: 30 * minute, durationMs: 10 * minute, inputCost: out("cash", 1500), heatGain: 6, influenceChange: 8, effectModifiers: { influenceMultiplier: 1.7 } })
    ]),
    building("street_dealers", "Pouliční dealeři", "park", "Dirty cash / drug distribution / street economy", "Pouliční dealeři pasivně vytváří slabší dirty cash a prodávají Neon Dust, Pulse Shot nebo Velvet Smoke ze SKLADU. Jeden prodej vždy spotřebuje zvolenou látku a současně může běžet jen jeden.", perMinuteStat(0, 36, 0.06 * 60 * 24, 0, 1), [
      action({ actionId: "start_drug_sale", label: "Spustit prodej", description: "Vyber jednu z dostupných látek a nastav alespoň 10 ks. Cena je pevně odvozená z výroby v Drug Labu; současně může běžet jen jeden prodej.", effectSummary: "dirty cash, heat, pouliční riziko" })
    ])
  ];
  const getAllPublicBuildingDefinitions = () => publicBuildingDefinitions.map((definition) => ({
    ...definition,
    nameVariants: [...definition.nameVariants],
    stats: { ...definition.stats },
    specialActions: definition.specialActions.map((buildingAction) => ({
      ...buildingAction,
      inputCost: { ...buildingAction.inputCost },
      outputGain: { ...buildingAction.outputGain },
      effectModifiers: buildingAction.effectModifiers ? { ...buildingAction.effectModifiers } : void 0
    }))
  }));
  const baseBuildingActionsConfig = Object.fromEntries(
    getAllPublicBuildingDefinitions().flatMap(
      (definition) => definition.specialActions.map((action2) => [
        action2.actionId,
        {
          actionId: action2.actionId,
          buildingType: definition.buildingTypeId,
          label: action2.label,
          description: action2.description,
          durationMs: action2.durationMs,
          cooldownMs: action2.cooldownMs,
          inputCost: { ...action2.inputCost },
          outputGain: { ...action2.outputGain },
          heatGain: action2.heatGain,
          influenceChange: action2.influenceChange,
          effectModifiers: action2.effectModifiers ? { ...action2.effectModifiers } : void 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: action2.reportText
        }
      ])
    )
  );
  const baseFixedBuildingsConfig = Object.fromEntries(
    getAllPublicBuildingDefinitions().map((definition) => [
      definition.buildingTypeId,
      {
        ...definition.stats
      }
    ])
  );
  const basePoliceConfig = {
    districtHeatWeight: 1,
    highPressureRaidThreshold: 100,
    extremePressureRaidThreshold: 140,
    districtTargetHeatThreshold: 60,
    raidCooldownTicks: 4,
    raidDurationTicks: 360,
    pendingRaidTtlTicks: 360,
    maxPendingRaidsPerPlayer: 1,
    maxConcurrentRaidsByPhase: {
      day: 2,
      night: 1
    },
    raidSeverityThresholds: { low: 0, medium: 60, high: 100, extreme: 140 },
    dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.08, high: 0.18, extreme: 0.32 },
    resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.08, extreme: 0.16 },
    lockdownTicksBySeverity: { low: 0, medium: 0, high: 2, extreme: 4 },
    buildingDisruptionTicksBySeverity: { low: 0, medium: 0, high: 1, extreme: 3 },
    heatReductionBySeverity: { low: 0, medium: 10, high: 25, extreme: 45 },
    heatDecay: {
      playerIntervalTicks: 30,
      playerDecayByWantedLevel: { 0: 4, 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 },
      districtIntervalTicks: 60,
      districtBaseDecay: 3,
      districtHighPassiveHeatPerDayThreshold: 100,
      districtHighPassiveHeatMultiplier: 0.5,
      districtLockdownDecayMultiplier: 1.25
    },
    maxPoliticalRaidTriggerReductionPct: 45,
    extremePoliticalRaidReductionMultiplier: 0.5,
    protectedResources: ["cash", "gang-members", "population"],
    autoResolveExpiredPendingRaids: true
  };
  const baseProductionBuildingsConfig = {};
  const baseCraftBuildingsConfig = {};
  const dayNightActionRules = Object.freeze({
    night_machines: {
      allowedPhases: ["night"],
      preferredPhase: "night",
      blockedReason: "Noční automaty se rozjíždí až po setmění.",
      phaseEffectSummary: "NOC ONLY: automaty běží jen v noci."
    },
    vip_night: {
      allowedPhases: ["night"],
      preferredPhase: "night",
      blockedReason: "VIP noc můžeš spustit jen v noci.",
      phaseEffectSummary: "NOC ONLY: VIP noc funguje jen po setmění."
    },
    black_charter: {
      allowedPhases: ["night"],
      preferredPhase: "night",
      blockedReason: "Černý charter odlétá jen v noci.",
      phaseEffectSummary: "NOC ONLY: černý charter používá noční provoz."
    },
    parliament_policy_window: {
      allowedPhases: ["day"],
      preferredPhase: "day",
      blockedReason: "Politické okno se otevírá jen přes den.",
      phaseEffectSummary: "DEN ONLY: politické okno běží jen přes den."
    },
    restaurant_collect_revenue: {
      allowedPhases: ["day"],
      preferredPhase: "day",
      blockedReason: "Tržby restaurace můžeš vybrat jen přes den.",
      phaseEffectSummary: "DEN ONLY: tržby restaurace lze vybrat jen přes den."
    },
    official_cover: {
      preferredPhase: "day",
      heatMultiplier: 1.35,
      costMultiplier: 1.15,
      phaseEffectSummary: "DEN BONUS: úřední krytí je levnější a tišší přes den. V noci má vyšší cost/heat."
    },
    city_contract: {
      preferredPhase: "day",
      rewardMultiplier: 0.9,
      heatMultiplier: 1.25,
      phaseEffectSummary: "DEN BONUS: městská zakázka je výhodnější přes den."
    },
    liquidity_injection: {
      preferredPhase: "day",
      auditRiskModifierPct: 10,
      costMultiplier: 1.1,
      phaseEffectSummary: "DEN BONUS: likvidita je čistší přes den. V noci roste financial oversight."
    },
    currency_intervention: {
      preferredPhase: "day",
      costMultiplier: 1.12,
      heatMultiplier: 1.2,
      phaseEffectSummary: "DEN BONUS: kurzovní zásah je stabilnější přes den."
    },
    quiet_backroom: {
      preferredPhase: "night",
      rewardMultiplier: 0.9,
      heatMultiplier: 1.25,
      auditRiskModifierPct: 10,
      phaseEffectSummary: "NOC BONUS: tichá herna pere efektivněji v noci. Přes den je vyšší audit/heat."
    },
    good_rate: {
      allowedPhases: ["day"],
      preferredPhase: "day",
      blockedReason: "Výhodný kurz můžeš spustit jen přes den.",
      phaseEffectSummary: "DEN ONLY: výhodný kurz směnárny běží jen přes den."
    },
    open_channel: {
      preferredPhase: "night",
      heatMultiplier: 1.3,
      detectionChanceModifierPct: 10,
      phaseEffectSummary: "NOC BONUS: kanál je bezpečnější po setmění. Přes den roste policejní tlak a pouliční riziko."
    },
    start_drug_sale: {
      preferredPhase: "night",
      heatMultiplier: 1.3,
      detectionChanceModifierPct: 10,
      phaseEffectSummary: "Prodej je dostupný ve dne i v noci. Přes den roste heat a pouliční riziko; cena za kus zůstává pevná."
    },
    strip_club_collect_cash: {
      preferredPhase: "night",
      rewardMultiplier: 0.85,
      heatMultiplier: 1.25,
      phaseEffectSummary: "NOC BONUS: strip club cash je silnější v noci."
    },
    vip_lounge: {
      allowedPhases: ["night"],
      preferredPhase: "night",
      blockedReason: "Hostit VIP klienty můžeš jen v noci.",
      heatMultiplier: 1.2,
      rumorChanceModifierPct: -10,
      phaseEffectSummary: "NOC BONUS: VIP klienti chodí v noci. Přes den je menší rumor value."
    },
    private_party: {
      preferredPhase: "night",
      heatMultiplier: 1.25,
      auditRiskModifierPct: 8,
      phaseEffectSummary: "NOC BONUS: soukromá party má lepší noční krytí. Přes den je vyšší risk."
    },
    port_container_cut: {
      preferredPhase: "night",
      rewardMultiplier: 0.9,
      heatMultiplier: 1.25,
      phaseEffectSummary: "NOC BONUS: container cut je výhodnější v noci."
    }
  });
  const dayNightBuildingRules = Object.freeze({
    central_bank: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: bankovní a regulatorní akce jsou čitelnější přes den.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.15, passiveHeatMultiplier: 0.95 },
        night: { passiveHeatMultiplier: 1.08 }
      }
    },
    city_hall: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: politické krytí a městské zakázky mají lepší podmínky přes den.",
      phasePassiveModifiers: {
        day: { passiveInfluenceMultiplier: 1.2, passiveHeatMultiplier: 0.92 },
        night: { passiveInfluenceMultiplier: 0.9 }
      }
    },
    court: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: soudní ochrana je silnější přes den.",
      phasePassiveModifiers: {
        day: { passiveInfluenceMultiplier: 1.12, passiveHeatMultiplier: 0.9 },
        night: { passiveInfluenceMultiplier: 0.92 }
      }
    },
    courthouse: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: soudní ochrana je silnější přes den.",
      phasePassiveModifiers: {
        day: { passiveInfluenceMultiplier: 1.12, passiveHeatMultiplier: 0.9 },
        night: { passiveInfluenceMultiplier: 0.92 }
      }
    },
    parliament: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: parlamentní okna fungují přes den.",
      phasePassiveModifiers: {
        day: { passiveInfluenceMultiplier: 1.25, passiveCleanIncomeMultiplier: 1.1 },
        night: { passiveInfluenceMultiplier: 0.9 }
      }
    },
    restaurant: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: restaurace vydělává čistěji a dává přesnější drby přes den.",
      phasePassiveModifiers: {
        day: {
          passiveCleanIncomeMultiplier: 1.15,
          passiveRumorGenerationMultiplier: 0.9,
          passiveRumorTruthModifierPct: 10
        },
        night: {
          passiveCleanIncomeMultiplier: 0.95,
          passiveRumorGenerationMultiplier: 1.1
        }
      }
    },
    shopping_mall: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: obchodní centrum jede naplno přes den.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.2, passiveInfluenceMultiplier: 1.08 },
        night: { passiveCleanIncomeMultiplier: 0.9 }
      }
    },
    stock_exchange: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: burza je stabilnější přes den, v noci je volatilnější.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.08, passiveHeatMultiplier: 0.95 },
        night: { passiveCleanIncomeMultiplier: 1.04, passiveHeatMultiplier: 1.08 }
      }
    },
    clinic: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: kliniky mají přes den stabilnější provoz.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.05, passiveHeatMultiplier: 0.95 },
        night: { passiveCleanIncomeMultiplier: 0.95 }
      }
    },
    school: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: škola zvyšuje populaci rychleji přes den.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.05, passivePopulationMultiplier: 1.2 },
        night: { passiveCleanIncomeMultiplier: 0.9, passivePopulationMultiplier: 0.9 }
      }
    },
    recruitment_center: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: rekrutace má přes den stabilnější podporu.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.1 },
        night: {}
      }
    },
    fitness_club: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: fitness má přes den lepší legální provoz.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.1 },
        night: {}
      }
    },
    power_station: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: infrastruktura je přes den stabilnější.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.15, passiveHeatMultiplier: 0.95 },
        night: { passiveHeatMultiplier: 1.08 }
      }
    },
    factory: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: legální průmyslová výroba je rychlejší přes den.",
      phasePassiveModifiers: {
        day: { passiveProductionMultiplier: 1.1 },
        night: { passiveProductionMultiplier: 0.98 }
      }
    },
    pharmacy: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: lékárenská výroba je rychlejší přes den.",
      phasePassiveModifiers: {
        day: { passiveProductionMultiplier: 1.1 },
        night: {}
      }
    },
    arcade: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: herny a automaty jsou silnější po setmění.",
      phasePassiveModifiers: {
        day: { passiveDirtyIncomeMultiplier: 0.9 },
        night: { passiveDirtyIncomeMultiplier: 1.2, passiveCleanIncomeMultiplier: 1.05 }
      }
    },
    casino: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: VIP cashflow a praní jsou silnější v noci.",
      phasePassiveModifiers: {
        day: { passiveDirtyIncomeMultiplier: 0.88, passiveHeatMultiplier: 1.12 },
        night: { passiveDirtyIncomeMultiplier: 1.25, passiveInfluenceMultiplier: 1.1 }
      }
    },
    exchange: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: směnárenské praní je efektivnější v noci.",
      phasePassiveModifiers: {
        day: { passiveHeatMultiplier: 1.12 },
        night: { passiveDirtyIncomeMultiplier: 1.2, passiveCleanIncomeMultiplier: 1.08 }
      }
    },
    smuggling_tunnel: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: pašovací kanály jsou bezpečnější po setmění. Přes den dirty tok výrazně padá.",
      phasePassiveModifiers: {
        day: { passiveDirtyIncomeMultiplier: 0.5, passiveHeatMultiplier: 1.12 },
        night: { passiveDirtyIncomeMultiplier: 1.25 }
      }
    },
    street_dealers: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: ulice prodává rychleji, ale s vyšším rizikem.",
      phasePassiveModifiers: {
        day: { passiveDirtyIncomeMultiplier: 0.9, passiveHeatMultiplier: 1.15 },
        night: { passiveDirtyIncomeMultiplier: 1.25 }
      }
    },
    strip_club: {
      preferredPhase: "night",
      phaseEffectSummary: "DEN: clean cash -50 % a dirty cash -50 %. NOC BONUS: klub, VIP klienti a šeptanda sílí v noci.",
      phasePassiveModifiers: {
        day: {
          passiveCleanIncomeMultiplier: 0.5,
          passiveDirtyIncomeMultiplier: 0.5,
          passiveRumorGenerationMultiplier: 0.9,
          passiveRumorTruthModifierPct: 8
        },
        night: {
          passiveDirtyIncomeMultiplier: 1.25,
          passiveInfluenceMultiplier: 1.2,
          passiveRumorGenerationMultiplier: 1.25
        }
      }
    },
    vip_lounge: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: elitní drby a vliv sílí v noci.",
      phasePassiveModifiers: {
        day: { passiveRumorGenerationMultiplier: 0.9, passiveRumorTruthModifierPct: 10 },
        night: {
          passiveInfluenceMultiplier: 1.1,
          passiveRumorGenerationMultiplier: 1.25,
          passiveRumorTruthModifierPct: -5
        }
      }
    },
    port: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: kontejnery se řežou snáz mimo denní provoz.",
      phasePassiveModifiers: {
        day: { passiveHeatMultiplier: 0.95 },
        night: { passiveDirtyIncomeMultiplier: 1.15, passiveCleanIncomeMultiplier: 1.05 }
      }
    },
    drug_lab: {
      preferredPhase: "night",
      phaseEffectSummary: "NOC BONUS: ilegální produkce v labu běží rychleji v noci.",
      phasePassiveModifiers: {
        day: { passiveProductionMultiplier: 0.9, passiveHeatMultiplier: 1.12 },
        night: { passiveProductionMultiplier: 1.2 }
      }
    },
    convenience_store: {
      phaseEffectSummary: "DEN/NOC: přes den čistší provoz, v noci víc dirty cash a pouličních drbů.",
      phasePassiveModifiers: {
        day: {
          passiveCleanIncomeMultiplier: 1.12,
          passiveRumorTruthModifierPct: 8
        },
        night: {
          passiveDirtyIncomeMultiplier: 1.15,
          passiveRumorGenerationMultiplier: 1.15
        }
      }
    },
    warehouse: {
      preferredPhase: "day",
      phaseEffectSummary: "DEN BONUS: logistika je přes den o něco stabilnější.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.05 }
      }
    },
    car_dealer: {
      phaseEffectSummary: "DEN/NOC: autosalon má přes den lepší legální příjem, v noci drží mobilitu.",
      phasePassiveModifiers: {
        day: { passiveCleanIncomeMultiplier: 1.1 },
        night: { passiveDirtyIncomeMultiplier: 1.05 }
      }
    },
    recycling_center: {
      phaseEffectSummary: "DEN/NOC: recyklace běží kdykoliv, v noci je výnos lehce vyšší.",
      phasePassiveModifiers: {
        day: { passiveHeatMultiplier: 0.95 },
        night: { passiveCleanIncomeMultiplier: 1.1 }
      }
    }
  });
  const DAY_NIGHT_REAL_PHASE_DURATION_MS = 2 * 60 * 60 * 1e3;
  const resolveDayNightPhaseDurationTicks = (tickRateMs) => {
    const safeTickRateMs = Math.max(1, Math.round(Number(tickRateMs) || 1));
    return Math.max(1, Math.round(DAY_NIGHT_REAL_PHASE_DURATION_MS / safeTickRateMs));
  };
  const dayModifiers = Object.freeze({
    legalIncomeMultiplier: 1.15,
    dirtyIncomeMultiplier: 0.9,
    productionSpeedMultiplier: 1,
    legalProductionSpeedMultiplier: 1.1,
    illegalProductionSpeedMultiplier: 0.9,
    heatGainMultiplier: 1.1,
    policePressureMultiplier: 1.15,
    heistSuccessChanceModifierPct: -10,
    heistDetectionChanceModifierPct: 15,
    rumorGenerationMultiplier: 0.8,
    rumorTruthChanceModifierPct: 10,
    marketVolatilityMultiplier: 0.85,
    attackTravelOrPreparationMultiplier: 1.05
  });
  const nightModifiers = Object.freeze({
    legalIncomeMultiplier: 0.9,
    dirtyIncomeMultiplier: 1.25,
    productionSpeedMultiplier: 1.05,
    legalProductionSpeedMultiplier: 0.95,
    illegalProductionSpeedMultiplier: 1.2,
    heatGainMultiplier: 0.95,
    policePressureMultiplier: 0.9,
    raidSeverityMultiplier: 1.1,
    heistSuccessChanceModifierPct: 15,
    heistDetectionChanceModifierPct: -10,
    rumorGenerationMultiplier: 1.35,
    rumorTruthChanceModifierPct: -10,
    marketVolatilityMultiplier: 1.25,
    attackTravelOrPreparationMultiplier: 0.95
  });
  const createDayNightConfig = (input) => ({
    enabled: true,
    defaultPhase: input.defaultPhase ?? "day",
    phases: {
      day: {
        id: "day",
        label: "DEN",
        durationTicks: Math.max(1, Math.floor(input.dayDurationTicks)),
        modifiers: dayModifiers,
        cityFeedMessages: [
          "Město přechází do denního režimu. Kamery, úřady a legální byznys sílí."
        ],
        uiThemeHint: "day",
        effectSummary: [
          "Legální byznys +15 %",
          "Policie víc vidí",
          "Drbů je méně, ale jsou přesnější"
        ]
      },
      night: {
        id: "night",
        label: "NOC",
        durationTicks: Math.max(1, Math.floor(input.nightDurationTicks)),
        modifiers: nightModifiers,
        cityFeedMessages: [
          "Noc padla na ulice. Černý trh ožívá a gangy se dávají do pohybu."
        ],
        uiThemeHint: "night",
        effectSummary: [
          "Dirty cash +25 %",
          "Heisty jsou snazší",
          "Drby jsou častější, ale méně jisté"
        ]
      }
    },
    buildingRules: dayNightBuildingRules,
    actionRules: dayNightActionRules
  });
  const freeModeWarehouseConfig = {
    id: "warehouse",
    buildingTypeId: "warehouse",
    countOnMap: 18,
    category: ["economy", "storage", "logistics"],
    cleanCashPerMinute: 45,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.06,
    auditRisk: 0,
    noLaundering: true,
    specialActions: "none",
    storageCapacityGroups: {
      bulk: {
        label: "Hromadné zásoby",
        baseCapacity: 60,
        resourceKeys: ["chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades"]
      },
      tactical: {
        label: "Taktické zásoby",
        baseCapacity: 24,
        resourceKeys: ["stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest", "cameras", "alarm"]
      },
      strategic: {
        label: "Strategické zásoby",
        baseCapacity: 8,
        resourceKeys: ["combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"]
      }
    },
    warehouseCountMultipliers: {
      0: 1,
      1: 1.5,
      2: 1.6,
      3: 1.7,
      4: 1.8,
      5: 1.9
    },
    warehouseLevelMultipliers: {
      1: 1,
      2: 1.12,
      3: 1.25,
      4: 1.4
    },
    network: {
      incomeBonusPctPerExtraWarehouse: 4,
      heatBonusPctPerExtraWarehouse: 3,
      maxIncomeMultiplier: 1.36,
      maxHeatMultiplier: 1.27
    },
    upgrades: {
      1: { cleanCashCost: 0, metalPartsCost: 0, techCoreCost: 0, incomeBonusPct: 0, heatReductionPct: 0 },
      2: { cleanCashCost: 4e3, metalPartsCost: 2, techCoreCost: 0, incomeBonusPct: 10, heatReductionPct: 0 },
      3: { cleanCashCost: 9e3, metalPartsCost: 5, techCoreCost: 1, incomeBonusPct: 20, heatReductionPct: 0 },
      4: { cleanCashCost: 18e3, metalPartsCost: 12, techCoreCost: 3, incomeBonusPct: 30, heatReductionPct: 10 }
    }
  };
  const baseBalanceConfig = {
    incomeMultiplier: 1,
    productionMultiplier: 1,
    cooldownMultiplier: 1,
    maxPlayersPerServer: 100,
    maxAllianceSize: 10,
    buildSlotLimit: 6,
    eventFrequencyMultiplier: 1,
    allianceLifecycle: {
      readiness: {
        readyIntervalSeconds: 8 * 60 * 60,
        readyButtonAvailableBeforeDueSeconds: 0,
        gracePeriodSeconds: 0,
        voteDurationSeconds: 2 * 60 * 60,
        voteRetryCooldownSeconds: 2 * 60 * 60
      },
      voluntaryLeavePenalty: {
        allianceJoinLockoutSeconds: 12 * 60 * 60,
        allianceCreateLockoutSeconds: 12 * 60 * 60,
        influenceDebuffSeconds: 8 * 60 * 60,
        actionCooldownDebuffSeconds: 6 * 60 * 60,
        formerAllyTruceSeconds: 60 * 60,
        influenceGenerationMultiplier: 0.8,
        actionCooldownMultiplier: 1.15,
        statDebuffSeconds: 12 * 60 * 60,
        attackMultiplier: 0.8,
        defenseMultiplier: 0.8,
        blocksAllianceDefenseSupport: true
      },
      inactiveKickPenalty: {
        allianceJoinLockoutSeconds: 6 * 60 * 60,
        allianceCreateLockoutSeconds: 6 * 60 * 60,
        influenceDebuffSeconds: 0,
        actionCooldownDebuffSeconds: 0,
        statDebuffSeconds: 12 * 60 * 60,
        formerAllyTruceSeconds: 60 * 60,
        influenceGenerationMultiplier: 1,
        actionCooldownMultiplier: 1,
        attackMultiplier: 0.5,
        defenseMultiplier: 0.5,
        productionMultiplier: 0.5,
        incomeMultiplier: 0.5,
        blocksAllianceDefenseSupport: true
      },
      disbandPenalty: {
        allianceJoinLockoutSeconds: 30 * 60,
        allianceCreateLockoutSeconds: 30 * 60,
        influenceDebuffSeconds: 0,
        actionCooldownDebuffSeconds: 0,
        formerAllyTruceSeconds: 60 * 60,
        influenceGenerationMultiplier: 1,
        actionCooldownMultiplier: 1,
        blocksAllianceDefenseSupport: false
      },
      administrativeRemovalPenalty: {
        allianceJoinLockoutSeconds: 0,
        allianceCreateLockoutSeconds: 0,
        influenceDebuffSeconds: 0,
        actionCooldownDebuffSeconds: 0,
        formerAllyTruceSeconds: 0,
        influenceGenerationMultiplier: 1,
        actionCooldownMultiplier: 1,
        blocksAllianceDefenseSupport: false
      },
      affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
      exitPendingTimeoutSeconds: 15 * 60
    },
    policePressureMultiplier: 1,
    raidIntensityMultiplier: 1,
    police: basePoliceConfig,
    expansionSpeedMultiplier: 1,
    dayLengthTicks: 12,
    nightLengthTicks: 12,
    dayNight: createDayNightConfig({
      dayDurationTicks: 12,
      nightDurationTicks: 12
    }),
    victoryConditionKey: "default-control",
    districtControlVictoryThreshold: 1,
    startingResources: {
      cash: 1e3,
      "dirty-cash": 250,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    },
    conflict: {
      spyCooldownTicks: 2,
      attackCooldownTicks: 2,
      robCooldownTicks: 2,
      heistCooldownTicks: 2,
      occupyCooldownTicks: 2,
      occupyFailureChancePct: 5,
      minAttackDurationTicks: 2,
      attackHeatGain: 6,
      occupyHeatGain: 2,
      occupyInfluenceCost: 5,
      occupyPopulationRefundPct: 10,
      spyBaseSuccessChance: 0.72,
      spyTrapRevealChance: 0.22,
      trapAttackLosses: 1,
      reportsLimit: 6,
      catastropheChance: 0.08
    },
    productionBuildings: baseProductionBuildingsConfig,
    craftBuildings: baseCraftBuildingsConfig,
    warehouse: freeModeWarehouseConfig,
    fixedBuildings: baseFixedBuildingsConfig,
    buildingActions: baseBuildingActionsConfig
  };
  const basePublicModeConfig = {
    mode: "free",
    label: "Empire Streets",
    matchStyle: "short",
    tickRateMs: 5e3,
    sessionKeyPrefix: "empire:base"
  };
  const baseTechnicalConfig = {
    sessionTtlMs: 1e3 * 60 * 60 * 12,
    gameDurationMs: 1e3 * 60 * 60 * 24,
    storageKeyPrefix: "empire:base",
    snapshotIntervalTicks: 10,
    notificationBatchWindowMs: 250,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  };
  const baseResolvedGameModeConfig = {
    mode: "free",
    tickRateMs: 5e3,
    balance: baseBalanceConfig,
    technical: baseTechnicalConfig,
    publicMeta: basePublicModeConfig
  };
  const freeModeAirportConfig = {
    id: "airport",
    buildingTypeId: "airport",
    countOnMap: 1,
    zone: "downtown",
    category: ["ultra_rare", "logistics", "import", "black_market_support", "mobility"],
    cleanCashPerMinute: 180,
    dirtyCashPerMinute: 45,
    influencePerMinute: 0.2,
    populationPerMinute: 0,
    heatPerMinute: 0.2,
    noIntelPower: true,
    noPopulationProduction: true,
    noLaundering: true,
    importDiscount: {
      materialsPct: 8,
      rareComponentsPct: 6,
      weaponsPct: 5,
      defenseItemsPct: 5,
      drugsAndBoostsPct: 0,
      blackMarketItemsPct: 4,
      shoppingMallMaterialsSynergyPct: 2
    },
    cooldownReduction: {
      marketDeliveryPct: 15,
      blackMarketDeliveryPct: 10,
      resourceTransferPct: 8,
      equipmentTransferPct: 8,
      shoppingMallMarketDeliverySynergyPct: 5,
      combinedLogisticsMaxReductionPct: 30
    },
    blackMarketSignal: {
      rareItemOfferChanceBonusPct: 12,
      extraStockRefreshOffers: 1,
      weaponsAndComponentsChanceBonusPct: 10
    },
    expressImport: {
      actionId: "express_import",
      cooldownMinutes: 18,
      durationSeconds: 90,
      costCleanCash: 2e3,
      nextImportCostPenaltyPct: 20,
      heatGain: 6,
      targetCategories: ["materials", "rareComponents", "weapons", "defenseItems"],
      customsRiskPct: 10,
      customsHeatGain: 10,
      customsShipmentPenaltyPct: 25,
      shipmentValueRanges: {
        materials: { min: 1800, max: 2800 },
        rareComponents: { min: 1200, max: 2e3 },
        weapons: { min: 1500, max: 2400 },
        defenseItems: { min: 1500, max: 2400 }
      }
    },
    blackCharter: {
      actionId: "black_charter",
      cooldownMinutes: 24,
      durationMinutes: 8,
      costDirtyCash: 2500,
      heatGain: 9,
      specialOfferDiscountPct: 6,
      purchaseCustomsRiskPct: 15,
      offerItems: ["tech-core", "combat-module", "smg", "bazooka", "defense-tower", "cameras", "ghost-serum", "overdrive-x"]
    },
    evacuationCorridor: {
      actionId: "evacuation_corridor",
      cooldownMinutes: 26,
      durationMinutes: 7,
      costCleanCash: 1800,
      heatGain: 5,
      escapeChanceBonusPct: 18,
      peopleLossReductionPct: 10,
      equipmentLossReductionPct: 10,
      retreatReturnTimeReductionPct: 12,
      gangMovementTimeReductionPct: 10,
      customsRiskPct: 6
    },
    customsInspection: {
      intervalMinutes: 8,
      passiveRiskPct: 3,
      heatThreshold: 150,
      heatRiskPct: 8,
      smugglingTunnelThreshold: 6,
      smugglingTunnelRiskPct: 5,
      stockExchangeSynergyRiskPct: 5,
      discountDisabledMinutes: 8,
      hangarHeatGain: 14,
      nextImportCostPenaltyPct: 20
    }
  };
  const freeModeCentralBankConfig = {
    id: "central_bank",
    buildingTypeId: "central_bank",
    countOnMap: 2,
    zone: "downtown",
    category: ["ultra_rare", "finance", "reserve", "market_stability"],
    cleanCashPerMinute: 160,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.35,
    populationPerMinute: 0,
    heatPerMinute: 0.1,
    noIntelPower: true,
    noDirtyCash: true,
    noPopulationProduction: true,
    noLaundering: true,
    reserveTiers: [
      {
        minOwned: 1,
        maxOwned: 1,
        cleanCashProtectionPct: 12,
        interestIntervalMinutes: 10,
        interestPct: 2.5,
        maxInterestCleanCash: 2500,
        incomeMultiplier: 1,
        influenceMultiplier: 1,
        heatMultiplier: 1,
        fineReductionPct: 10,
        marketFeeReductionPct: 5,
        financialInspectionPenaltyReductionPct: 8,
        economicCrisisImpactReductionPct: 12
      },
      {
        minOwned: 2,
        maxOwned: 2,
        cleanCashProtectionPct: 22,
        interestIntervalMinutes: 10,
        interestPct: 4,
        maxInterestCleanCash: 4e3,
        incomeMultiplier: 1.18,
        influenceMultiplier: 1.15,
        heatMultiplier: 1.12,
        fineReductionPct: 18,
        marketFeeReductionPct: 8,
        financialInspectionPenaltyReductionPct: 14,
        economicCrisisImpactReductionPct: 20
      }
    ],
    liquidityInjection: {
      actionId: "liquidity_injection",
      cooldownMinutes: 20,
      costInfluence: 20,
      heatGain: 4,
      baseRewardCleanCash: 2500,
      rewardPerCleanEconomyBuilding: 90,
      maxRewardCleanCash: 8e3,
      shoppingMallRewardBonusPct: 8,
      riskPct: 6,
      riskDurationMinutes: 8,
      cleanEconomyBuildingTypeIds: [
        "restaurant",
        "convenience_store",
        "shopping_mall",
        "garage",
        "car_dealer",
        "warehouse",
        "fitness_club",
        "school",
        "clinic",
        "recycling_center",
        "power_station",
        "city_hall",
        "stock_exchange",
        "airport",
        "port",
        "vip_lounge"
      ]
    },
    frozenAccounts: {
      actionId: "frozen_accounts",
      cooldownMinutes: 24,
      durationMinutes: 8,
      costCleanCash: 2e3,
      heatGain: 5,
      cleanCashProtectionBonusPct: 25,
      dirtyCashProtectionPct: 8,
      fineReductionPct: 20,
      financialEventLossReductionPct: 25,
      marketFeePenaltyPct: 5,
      riskPct: 8
    },
    currencyIntervention: {
      actionId: "currency_intervention",
      cooldownMinutes: 28,
      durationMinutes: 8,
      costCleanCash: 3e3,
      costInfluence: 25,
      heatGain: 7,
      targetCategories: ["materials", "weapons", "defenseItems", "rareComponents", "drugsAndBoosts"],
      volatilityReductionPct: 30,
      priceMoveCapPct: 6,
      holderMarketFeeReductionPct: 6,
      stockExchangeEffectReductionPct: 25,
      stockExchangeSynergyEffectBonusPct: 10,
      riskPct: 12
    },
    financialOversight: {
      intervalMinutes: 8,
      passiveRiskPct: 2,
      heatThreshold: 150,
      heatRiskPct: 8,
      stockExchangeRiskPct: 5,
      cityHallRiskReductionPct: 4,
      interestDisabledMinutes: 8,
      liquidityBlockedMinutes: 8,
      regulatoryFineCleanCash: 3500,
      feeReductionDisabledMinutes: 8
    },
    synergies: {
      stockExchangeSpeculativeRiskReductionPct: 5,
      cityHallCorruptionPenaltyReductionPct: 8,
      cityHallInfluenceActionCostReductionPct: 3,
      shoppingMallMarketFeeReductionPct: 3,
      shoppingMallCleanIncomeBonusPct: 4
    }
  };
  const freeModeCityHallConfig = {
    id: "city_hall",
    buildingTypeId: "city_hall",
    countOnMap: 1,
    zone: "downtown",
    category: ["ultra_rare", "politics", "city_control", "heat_management"],
    cleanCashPerMinute: 130,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.85,
    populationPerMinute: 0,
    heatPerMinute: 0.12,
    noIntelPower: true,
    noDirtyCash: true,
    noPopulationProduction: true,
    noLaundering: true,
    cityAuthority: {
      influenceGenerationBonusPct: 10,
      legalBuildingHeatReductionPct: 8,
      policeRaidWarningChancePct: 12,
      warningCooldownMinutes: 10,
      influenceActionCostReductionPct: 10,
      maxInfluenceActionCostReductionPct: 25,
      districtControlPressurePct: 8,
      legalBuildingTypeIds: [
        "restaurant",
        "convenience_store",
        "shopping_mall",
        "school",
        "fitness_club",
        "garage",
        "car_dealer",
        "warehouse",
        "clinic",
        "recruitment_center",
        "recycling_center",
        "power_station"
      ]
    },
    officialCover: {
      actionId: "official_cover",
      cooldownMinutes: 20,
      durationMinutes: 8,
      costInfluence: 25,
      costCleanCash: 1500,
      heatGain: 2,
      heatGainReductionPct: 35,
      policeControlChanceReductionPct: 20,
      rumorChanceReductionPct: 15,
      riskPct: 8
    },
    cityContract: {
      actionId: "city_contract",
      cooldownMinutes: 18,
      costInfluence: 20,
      heatGain: 3,
      baseRewardCleanCash: 1500,
      rewardPerLegalBuilding: 120,
      maxRewardCleanCash: 6500,
      restaurantConvenienceSynergyPct: 10,
      restaurantSynergyThreshold: 6,
      convenienceSynergyThreshold: 4,
      riskPct: 6,
      riskDurationMinutes: 8,
      legalBuildingTypeIds: [
        "restaurant",
        "convenience_store",
        "school",
        "warehouse",
        "clinic",
        "fitness_club",
        "garage",
        "car_dealer",
        "shopping_mall",
        "power_station",
        "recruitment_center",
        "recycling_center"
      ]
    },
    emergencyDecree: {
      actionId: "emergency_decree",
      cooldownMinutes: 28,
      durationMinutes: 6,
      costInfluence: 40,
      costCleanCash: 2500,
      heatGain: 8,
      riskPct: 12,
      modes: {
        nightPatrols: {
          modeId: "night_patrols",
          incomingAttackPreparationIncreasePct: 8,
          districtRobberyCooldownIncreasePct: 12,
          defenseBonusPct: 5
        },
        suspendedChecks: {
          modeId: "suspended_checks",
          heatGainReductionPct: 18,
          policeIncidentChanceReductionPct: 10
        },
        constructionClosure: {
          modeId: "construction_closure",
          enemyZoneMovementTimeIncreasePct: 10,
          enemyZoneRobberyTimeIncreasePct: 10
        }
      }
    },
    corruptionScandal: {
      intervalMinutes: 8,
      passiveRiskPct: 2,
      heatThreshold: 150,
      heatRiskPct: 8,
      casinoOrStockExchangeRiskPct: 4,
      stockExchangeSynergyRiskPct: 5,
      airportSynergyRiskPct: 4,
      influencePenaltyPct: 50,
      influencePenaltyMinutes: 8,
      cityContractBlockedMinutes: 8,
      publicResistanceInfluenceLoss: 12,
      policeOversightHeatGain: 14
    },
    synergies: {
      stripClubContactChancePct: 5,
      stripClubPrivatePartyScandalReductionPct: 3,
      civilRumorTruthRestaurantThreshold: 10,
      civilRumorTruthConvenienceThreshold: 8,
      civilRumorTruthBonusPct: 5,
      stockExchangeFinancialInspectionRiskReductionPct: 5,
      airportCustomsRiskReductionPct: 5
    }
  };
  const freeModeParliamentConfig = {
    id: "parliament",
    buildingTypeId: "parliament",
    countOnMap: 1,
    zone: "downtown",
    category: ["ultra_rare", "power", "politics", "influence"],
    cleanCashPerMinute: 22,
    dirtyCashPerMinute: 3,
    influencePerMinute: 40 / (60 * 24),
    populationPerMinute: 0,
    heatPerMinute: 3 / (60 * 24),
    noPopulationProduction: true,
    policyWindow: {
      actionId: "parliament_policy_window",
      cooldownMinutes: 18,
      heatGain: 5,
      cleanCashGain: 160,
      influenceGain: 5
    }
  };
  const freeModePortConfig = {
    id: "port",
    buildingTypeId: "port",
    countOnMap: 1,
    zone: "downtown",
    category: ["logistics", "containers", "materials", "dirty_cash_routes"],
    cleanCashPerMinute: 26,
    dirtyCashPerMinute: 8.5,
    influencePerMinute: 26 / (60 * 24),
    populationPerMinute: 0,
    heatPerMinute: 5 / (60 * 24),
    noPopulationProduction: true,
    containerCut: {
      actionId: "port_container_cut",
      cooldownMinutes: 14,
      heatGain: 6,
      dirtyCashGain: 160,
      metalPartsGain: 3,
      influenceGain: 1
    }
  };
  const freeModeStockExchangeConfig = {
    id: "stock_exchange",
    buildingTypeId: "stock_exchange",
    countOnMap: 1,
    zone: "downtown",
    category: ["ultra_rare", "economy", "market_control", "financial_power"],
    cleanCashPerMinute: 220,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.45,
    populationPerMinute: 0,
    heatPerMinute: 0.18,
    noDirtyCash: true,
    noPopulationProduction: true,
    noIntelPower: true,
    noLaundering: true,
    marketInsight: {
      intervalMinutes: 8,
      baseHintCount: 1,
      insiderHintCount: 3
    },
    marketFeeReduction: {
      regularMarketPct: 10,
      playerMarketPct: 5,
      blackMarketPct: 3,
      insiderExtraPct: 8
    },
    speculativeBuy: {
      actionId: "speculative_buy",
      cooldownMinutes: 16,
      costCleanCash: 2500,
      maxInvestmentCleanCash: 1e4,
      heatGain: 5,
      targetCategories: ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"],
      successChancePct: 65,
      insiderSuccessChanceBonusPct: 12,
      successProfitMinPct: 25,
      successProfitMaxPct: 45,
      neutralChancePct: 25,
      neutralReturnMinPct: -8,
      neutralReturnMaxPct: 8,
      lossReturnMinPct: -30,
      lossReturnMaxPct: -15,
      riskPct: 6,
      riskDurationMinutes: 8
    },
    marketPressure: {
      actionId: "market_pressure",
      cooldownMinutes: 22,
      durationMinutes: 10,
      costCleanCash: 3e3,
      costInfluence: 15,
      heatGain: 8,
      targetCategories: ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"],
      pumpRegularPct: 12,
      dumpRegularPct: -10,
      blackMarketEffectSharePct: 40,
      riskPct: 12,
      riskDurationMinutes: 10
    },
    insiderWindow: {
      actionId: "insider_window",
      cooldownMinutes: 18,
      durationMinutes: 6,
      costCleanCash: 1500,
      heatGain: 4,
      financialInspectionRiskPct: 10
    },
    financialInspection: {
      intervalMinutes: 6,
      multiActionWindowMinutes: 20,
      multiActionThreshold: 2,
      multiActionRiskPct: 8,
      heatThreshold: 150,
      heatRiskPct: 10,
      frozenIncomeMinutes: 6,
      feeReductionDisabledMinutes: 8,
      fineCleanCash: 3e3,
      panicVolatilityPct: 15,
      panicDurationMinutes: 8,
      scandalHeatGain: 12
    }
  };
  const freeModeLobbyClubConfig = {
    id: "lobby_club",
    buildingTypeId: "lobby_club",
    countOnMap: 2,
    zone: "downtown",
    category: ["ultra_rare", "lobbying", "influence", "political_support"],
    cleanCashPerMinute: 95,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.65,
    populationPerMinute: 0,
    heatPerMinute: 0.1,
    noIntelPower: true,
    noDirtyCash: true,
    noPopulationProduction: true,
    noLaundering: true,
    noAuditRisk: true,
    lobbyPressureTiers: [
      { minOwned: 1, maxOwned: 1, pressurePct: 10, incomeMultiplier: 1, influenceMultiplier: 1, heatMultiplier: 1 },
      { minOwned: 2, maxOwned: 99, pressurePct: 22, incomeMultiplier: 1.12, influenceMultiplier: 1.18, heatMultiplier: 1.1 }
    ],
    influenceCostReduction: {
      oneClubPct: 8,
      twoClubPct: 15,
      maxCombinedPct: 25
    },
    negativeRumorReduction: {
      oneClubPct: 10,
      twoClubPct: 18,
      minNegativeRumorChancePct: 5
    },
    civilNetworkSupport: {
      restaurantCivilRumorTruthPct: 4,
      convenienceDistrictHintChancePct: 4,
      shoppingMallMarketFeeReductionPct: 3,
      vipLoungeTruthChancePct: 3
    },
    backroomPressure: {
      actionId: "backroom_pressure",
      cooldownMinutes: 20,
      durationMinutes: 8,
      costInfluence: 25,
      costCleanCash: 1200,
      heatGain: 3,
      influenceProductionBonusPct: 18,
      influenceActionCostReductionPct: 10,
      negativeRumorReductionPct: 15,
      districtControlPressurePct: 8,
      politicalActionHeatIncreasePct: 10,
      scandalRiskPct: 8
    },
    quietNegotiation: {
      actionId: "quiet_negotiation",
      cooldownMinutes: 24,
      costCleanCash: 1500,
      costInfluence: 15,
      heatGain: 2,
      cooldownRemainingReductionPct: 20,
      riskReductionPct: 10,
      riskReductionMinutes: 8,
      nextInfluenceActionDiscountPct: 8,
      nextInfluenceActionDiscountMinutes: 8,
      scandalRiskPct: 6,
      targetBuildingTypeIds: ["city_hall", "vip_lounge", "strip_club", "stock_exchange", "central_bank", "port", "airport"]
    },
    mediaScreen: {
      actionId: "media_screen",
      cooldownMinutes: 26,
      durationMinutes: 8,
      costCleanCash: 2e3,
      heatGain: 4,
      negativeRumorReductionPct: 35,
      negativeRumorTruthReductionPct: 15,
      policeRaidWarningChancePct: 6,
      civilRumorTruthPct: 6,
      weakRewriteChancePct: 35,
      scandalRiskPct: 7
    },
    lobbyScandal: {
      intervalMinutes: 8,
      passiveRiskPct: 2,
      cityHallRiskPct: 3,
      stockExchangeRiskPct: 3,
      heatThreshold: 150,
      heatRiskPct: 8,
      influenceLoss: 10,
      incomePenaltyPct: 40,
      incomePenaltyMinutes: 8,
      influenceReductionDisabledMinutes: 8,
      policeHeatGain: 12
    },
    synergies: {
      cityHallOfficialCoverCostReductionPct: 5,
      cityHallContractRewardPct: 5,
      cityHallEmergencyDecreeCooldownMinutes: 2,
      cityHallCorruptionScandalRiskPct: 3,
      vipLoungeTruthChancePct: 3,
      vipLoungeNegativeRumorReductionPct: 5,
      vipLoungeBackroomWhisperCostReductionPct: 5,
      stripClubRumorTruthPct: 4,
      stripClubPrivatePartyScandalReductionPct: 4,
      stockExchangeSpeculativeBuyCostReductionPct: 5,
      stockExchangeFinancialInspectionRiskPct: 3
    }
  };
  const freeModeLobbyClubBuildingActions = {
    backroom_pressure: {
      actionId: "backroom_pressure",
      buildingType: "lobby_club",
      label: "Zákulisní tlak",
      description: "Na 8 minut posílí influence produkci, sníží cenu influence akcí a přidá politický tlak.",
      durationMs: freeModeLobbyClubConfig.backroomPressure.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeLobbyClubConfig.backroomPressure.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeLobbyClubConfig.backroomPressure.costCleanCash },
      outputGain: {},
      heatGain: freeModeLobbyClubConfig.backroomPressure.heatGain,
      influenceChange: -freeModeLobbyClubConfig.backroomPressure.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Zákulisní tlak je aktivní. Influence síť tlačí na rozhodnutí v celém městě."
    },
    quiet_negotiation: {
      actionId: "quiet_negotiation",
      buildingType: "lobby_club",
      label: "Tiché vyjednávání",
      description: "Okamžitě zkrátí jeden politický/společenský cooldown, sníží rizika a zlevní další influence akci.",
      durationMs: 0,
      cooldownMs: freeModeLobbyClubConfig.quietNegotiation.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeLobbyClubConfig.quietNegotiation.costCleanCash },
      outputGain: {},
      heatGain: freeModeLobbyClubConfig.quietNegotiation.heatGain,
      influenceChange: -freeModeLobbyClubConfig.quietNegotiation.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Tiché vyjednávání proběhlo mimo záznam. Rizika klesla a další influence akce bude levnější."
    },
    media_screen: {
      actionId: "media_screen",
      buildingType: "lobby_club",
      label: "Mediální clona",
      description: "Na 8 minut brání negativním drbům, snižuje jejich pravdivost a zlepšuje veřejný obraz.",
      durationMs: freeModeLobbyClubConfig.mediaScreen.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeLobbyClubConfig.mediaScreen.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeLobbyClubConfig.mediaScreen.costCleanCash },
      outputGain: {},
      heatGain: freeModeLobbyClubConfig.mediaScreen.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Mediální clona překresluje veřejný obraz a tlumí negativní drby."
    }
  };
  const freeModeInstitutionalBuildingActions = {
    official_cover: {
      actionId: "official_cover",
      buildingType: "city_hall",
      label: "Úřední krytí",
      description: "Na 8 minut sníží heat gain, police control chance a rumor chance ve všech vlastněných districtech.",
      durationMs: freeModeCityHallConfig.officialCover.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeCityHallConfig.officialCover.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeCityHallConfig.officialCover.costCleanCash },
      outputGain: {},
      heatGain: freeModeCityHallConfig.officialCover.heatGain,
      influenceChange: -freeModeCityHallConfig.officialCover.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Úřední krytí je aktivní. Všechny vlastněné districty mají dočasně slabší heat a policejní tlak."
    },
    city_contract: {
      actionId: "city_contract",
      buildingType: "city_hall",
      label: "Městská zakázka",
      description: "Převede politický vliv na clean cash podle počtu legálních budov hráče.",
      durationMs: 0,
      cooldownMs: freeModeCityHallConfig.cityContract.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: freeModeCityHallConfig.cityContract.heatGain,
      influenceChange: -freeModeCityHallConfig.cityContract.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Městská zakázka připsala clean cash podle legální infrastruktury."
    },
    emergency_decree: {
      actionId: "emergency_decree",
      buildingType: "city_hall",
      label: "Nouzová vyhláška",
      description: "Na 6 minut spustí městský režim: Noční hlídky, Zastavené kontroly nebo Stavební uzávěru.",
      durationMs: freeModeCityHallConfig.emergencyDecree.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeCityHallConfig.emergencyDecree.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeCityHallConfig.emergencyDecree.costCleanCash },
      outputGain: {},
      heatGain: freeModeCityHallConfig.emergencyDecree.heatGain,
      influenceChange: -freeModeCityHallConfig.emergencyDecree.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Magistrát vydal nouzovou vyhlášku. Město se na chvíli mění."
    },
    express_import: {
      actionId: "express_import",
      buildingType: "airport",
      label: "Expresní dovoz",
      description: "Po 90 sekundách doručí importní zásilku vybrané kategorie do SKLADU. Nevyzvednutý přesah zůstane čekat na volnou kapacitu.",
      durationMs: freeModeAirportConfig.expressImport.durationSeconds * 1e3,
      cooldownMs: freeModeAirportConfig.expressImport.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeAirportConfig.expressImport.costCleanCash },
      outputGain: {},
      heatGain: freeModeAirportConfig.expressImport.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Expresní dovoz byl objednán. Zásilka dorazí po krátkém runway okně."
    },
    black_charter: {
      actionId: "black_charter",
      buildingType: "airport",
      label: "Černý charter",
      description: "Na 8 minut otevře speciální Black Market nabídku se slevou a celním rizikem při nákupu.",
      durationMs: freeModeAirportConfig.blackCharter.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeAirportConfig.blackCharter.cooldownMinutes * 60 * 1e3,
      inputCost: { "dirty-cash": freeModeAirportConfig.blackCharter.costDirtyCash },
      outputGain: {},
      heatGain: freeModeAirportConfig.blackCharter.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Černý charter otevřel dočasnou Black Market nabídku."
    },
    evacuation_corridor: {
      actionId: "evacuation_corridor",
      buildingType: "airport",
      label: "Evakuační koridor",
      description: "Na 7 minut zlepší únik, sníží ztráty při neúspěchu a zrychlí návratové logistické časy.",
      durationMs: freeModeAirportConfig.evacuationCorridor.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeAirportConfig.evacuationCorridor.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeAirportConfig.evacuationCorridor.costCleanCash },
      outputGain: {},
      heatGain: freeModeAirportConfig.evacuationCorridor.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Evakuační koridor je aktivní. Únik a logistika mají dočasný boost."
    },
    port_container_cut: {
      actionId: "port_container_cut",
      buildingType: "port",
      label: "Proříznout kontejner",
      description: "Vybere z kontejnerů užitečné zásoby a dirty cash přes přístavní trasu.",
      durationMs: 0,
      cooldownMs: freeModePortConfig.containerCut.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {
        "dirty-cash": freeModePortConfig.containerCut.dirtyCashGain,
        "metal-parts": freeModePortConfig.containerCut.metalPartsGain
      },
      heatGain: freeModePortConfig.containerCut.heatGain,
      influenceChange: freeModePortConfig.containerCut.influenceGain,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Přístav rozebral kontejnerovou trasu a vytáhl dirty cash i metal parts."
    },
    parliament_policy_window: {
      actionId: "parliament_policy_window",
      buildingType: "parliament",
      label: "Politické okno",
      description: "Otevře krátké politické okno pro zisk vlivu a clean cash.",
      durationMs: 0,
      cooldownMs: freeModeParliamentConfig.policyWindow.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: { cash: freeModeParliamentConfig.policyWindow.cleanCashGain },
      heatGain: freeModeParliamentConfig.policyWindow.heatGain,
      influenceChange: freeModeParliamentConfig.policyWindow.influenceGain,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Parlament otevřel politické okno a přidal vliv i clean cash."
    },
    speculative_buy: {
      actionId: "speculative_buy",
      buildingType: "stock_exchange",
      label: "Spekulativní nákup",
      description: "Investuje clean cash do vybrané market kategorie. Výsledek může být zisk, neutrální pohyb nebo ztráta.",
      durationMs: 0,
      cooldownMs: freeModeStockExchangeConfig.speculativeBuy.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeStockExchangeConfig.speculativeBuy.costCleanCash },
      outputGain: {},
      heatGain: freeModeStockExchangeConfig.speculativeBuy.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Burza provedla spekulativní nákup a zvýšila financial inspection risk."
    },
    market_pressure: {
      actionId: "market_pressure",
      buildingType: "stock_exchange",
      label: "Tržní tlak",
      description: "Na 10 minut server-wide pumpne nebo dumpne ceny vybrané market kategorie.",
      durationMs: freeModeStockExchangeConfig.marketPressure.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeStockExchangeConfig.marketPressure.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeStockExchangeConfig.marketPressure.costCleanCash },
      outputGain: {},
      heatGain: freeModeStockExchangeConfig.marketPressure.heatGain,
      influenceChange: -freeModeStockExchangeConfig.marketPressure.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Downtown burza rozkolísala ceny ve vybrané kategorii."
    },
    insider_window: {
      actionId: "insider_window",
      buildingType: "stock_exchange",
      label: "Vnitřní tipy",
      description: "Na 6 minut zlepší trend hinty, sníží market poplatek a zvedne šanci Spekulativního nákupu.",
      durationMs: freeModeStockExchangeConfig.insiderWindow.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeStockExchangeConfig.insiderWindow.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeStockExchangeConfig.insiderWindow.costCleanCash },
      outputGain: {},
      heatGain: freeModeStockExchangeConfig.insiderWindow.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vnitřní tipy jsou aktivní. Burza ukazuje hlubší trend hinty, ale zvedá financial inspection risk."
    },
    liquidity_injection: {
      actionId: "liquidity_injection",
      buildingType: "central_bank",
      label: "Likviditní injekce",
      description: "Okamžitě přidá clean cash podle velikosti čisté ekonomiky hráče a zvýší Financial Oversight risk.",
      durationMs: 0,
      cooldownMs: freeModeCentralBankConfig.liquidityInjection.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: freeModeCentralBankConfig.liquidityInjection.heatGain,
      influenceChange: -freeModeCentralBankConfig.liquidityInjection.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Centrální banka provedla likviditní injekci podle čisté ekonomiky hráče."
    },
    frozen_accounts: {
      actionId: "frozen_accounts",
      buildingType: "central_bank",
      label: "Zmrazené účty",
      description: "Na 8 minut zvýší ochranu clean cash, sníží pokuty a finanční ztráty, ale zhorší market fee.",
      durationMs: freeModeCentralBankConfig.frozenAccounts.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeCentralBankConfig.frozenAccounts.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeCentralBankConfig.frozenAccounts.costCleanCash },
      outputGain: {},
      heatGain: freeModeCentralBankConfig.frozenAccounts.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Zmrazené účty chrání rezervy, ale zhoršují poplatkovou stopu na marketu."
    },
    currency_intervention: {
      actionId: "currency_intervention",
      buildingType: "central_bank",
      label: "Kurzovní intervence",
      description: "Na 8 minut stabilizuje vybranou market kategorii a tlumí účinek Tržního tlaku z Burzy.",
      durationMs: freeModeCentralBankConfig.currencyIntervention.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeCentralBankConfig.currencyIntervention.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeCentralBankConfig.currencyIntervention.costCleanCash },
      outputGain: {},
      heatGain: freeModeCentralBankConfig.currencyIntervention.heatGain,
      influenceChange: -freeModeCentralBankConfig.currencyIntervention.costInfluence,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Centrální banka spustila kurzovní intervenci ve vybrané kategorii."
    },
    ...freeModeLobbyClubBuildingActions
  };
  const freeModeArcadeConfig = {
    id: "arcade",
    buildingTypeId: "arcade",
    countOnMap: 16,
    category: ["economy", "dirty_cash", "laundering", "network"],
    cleanCashPerMinute: 30,
    dirtyCashPerMinute: 20,
    influencePerMinute: 80 / (60 * 24),
    heatPerMinute: 0.12,
    launderingCapacity: 3800,
    baseAuditRiskPct: 3,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 7,
    network: {
      incomeBonusPctPerExtraArcade: 5,
      launderingLimitBonusPctPerExtraArcade: 6,
      heatBonusPctPerExtraArcade: 3,
      maxIncomeMultiplier: 1.45,
      maxLaunderingLimitMultiplier: 1.55,
      maxHeatMultiplier: 1.27
    },
    nightMachines: {
      actionId: "night_machines",
      cooldownMinutes: 16,
      durationMinutes: 7,
      cleanIncomeBonusPct: 35,
      dirtyIncomeBonusPct: 65,
      influenceBonusPct: 15,
      heatBonusPct: 45,
      auditRiskBonusPct: 4
    },
    backCashdesk: {
      actionId: "back_cashdesk",
      cooldownMinutes: 16,
      minimumDirtyCash: 500,
      dirtyCashSharePct: 13,
      maxDirtyCashPerAction: 3800,
      feePct: 15,
      heatGain: 3,
      influenceGain: 1,
      auditRiskBonusPct: 3,
      auditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 2e3, riskPct: 3 },
      { maxLaunderedAmount: 6e3, riskPct: 7 },
      { maxLaunderedAmount: 12e3, riskPct: 14 },
      { maxLaunderedAmount: 24e3, riskPct: 24 },
      { maxLaunderedAmount: null, riskPct: 36 }
    ],
    auditConsequences: {
      machineInspection: { incomePenaltyPct: 6, durationMinutes: 8 },
      seizedMachine: { dirtyIncomePenaltyPct: 8, durationMinutes: 10 },
      closedBackRoom: { actionBlockedMinutes: 7 },
      operatingFine: { cleanCashLoss: 1200 },
      localRaid: { heatGain: 8 }
    }
  };
  const freeModeClinicConfig = {
    id: "clinic",
    buildingTypeId: "clinic",
    countOnMap: 8,
    category: ["economy", "recovery", "support"],
    cleanCashPerMinute: 3100 / 60,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 85 / (60 * 24),
    noLaundering: true,
    noAuditRisk: true,
    recovery: {
      baseRecoveryRatePct: 15,
      recoveryRatePctPerExtraClinic: 3,
      maxRecoveryRatePct: 40,
      poolTtlMinutes: 90,
      toxicTrapRateMultiplier: 0.5
    },
    network: {
      incomeBonusPctPerExtraClinic: 5,
      heatBonusPctPerExtraClinic: 3,
      maxIncomeMultiplier: 1.4,
      maxHeatMultiplier: 1.24
    },
    stabilizationProtocol: {
      actionId: "stabilization_protocol",
      cooldownMinutes: 18,
      cleanCashCost: 1200,
      heatGain: 1
    }
  };
  const freeModePowerStationConfig = {
    id: "power_station",
    buildingTypeId: "power_station",
    countOnMap: 9,
    category: ["infrastructure", "support", "defense_multiplier"],
    cleanCashPerMinute: 2780 / 60,
    dirtyCashPerMinute: 780 / 60,
    influencePerMinute: 0,
    heatPerMinute: 0.08,
    noPowerCapacity: true,
    noEnergyResource: true,
    noLaundering: true,
    noAuditRisk: true,
    infrastructure: {
      bonusPctPerStation: 4,
      maxBonusPct: 28,
      weights: {
        factoryProductionSpeed: 1,
        armoryProductionSpeed: 1,
        clinicRecoveryRate: 0.5,
        casinoIncome: 0.4,
        arcadeIncome: 0.4,
        exchangeIncome: 0.4,
        stripClubIncome: 0.3,
        apartmentPopulationProduction: 0.25
      }
    },
    network: {
      incomeBonusPctPerExtraStation: 4,
      heatBonusPctPerExtraStation: 3,
      maxIncomeMultiplier: 1.24,
      maxHeatMultiplier: 1.18
    },
    defense: {
      cameraStrengthBonusPctPerStation: 5,
      alarmStrengthBonusPctPerStation: 5,
      maxCameraStrengthBonusPct: 35,
      maxAlarmStrengthBonusPct: 35
    },
    backupGridSwitch: {
      actionId: "backup_grid_switch",
      cooldownMinutes: 60,
      durationMinutes: 25,
      cleanCashCost: 3500,
      heatGain: 3,
      temporaryInfrastructureBonusPct: 12,
      cameraStrengthBonusPct: 20,
      alarmStrengthBonusPct: 20,
      factoryProductionSpeedBonusPct: 10,
      armoryProductionSpeedBonusPct: 10
    }
  };
  const freeModeRecyclingCenterConfig = {
    id: "recycling_center",
    buildingTypeId: "recycling_center",
    countOnMap: 14,
    category: ["support", "salvage", "item_recovery"],
    cleanCashPerMinute: 40,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.08,
    noLaundering: true,
    noAuditRisk: true,
    noPopulationProduction: true,
    noPopulationRecovery: true,
    salvage: {
      baseRatePct: 12,
      ratePctPerExtraCenter: 3,
      maxRatePct: 34,
      poolTtlMinutes: 18,
      rareItems: ["tech-core", "combat-module"],
      recoverableItems: {
        chemicals: { itemName: "Chemicals", category: "materials" },
        biomass: { itemName: "Biomass", category: "materials" },
        "metal-parts": { itemName: "Metal Parts", category: "materials" },
        "tech-core": { itemName: "Tech Core", category: "materials" },
        "combat-module": { itemName: "Bojový modul", category: "materials" }
      }
    },
    extractLosses: {
      actionId: "extract_losses",
      cooldownMinutes: 16,
      cleanCashCost: 900,
      heatGain: 2
    },
    network: {
      incomeBonusPctPerExtraCenter: 4,
      heatBonusPctPerExtraCenter: 3,
      maxIncomeMultiplier: 1.28,
      maxHeatMultiplier: 1.21
    }
  };
  const freeModeSchoolConfig = {
    id: "school",
    buildingTypeId: "school",
    countOnMap: 6,
    category: ["population", "education", "city_life"],
    cleanCashPerMinute: 18,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.05,
    heatPerMinute: 0,
    populationPerMinute: 0.55,
    baseStudentCapacity: 20,
    noDirtyCash: true,
    noLaundering: true,
    noAuditRisk: true,
    noHeat: true,
    productionStopsAtCapacity: true,
    requiresManualCollect: true,
    allowPartialCollect: true,
    network: {
      populationProductionBonusPctPerExtraSchool: 8,
      studentCapacityBonusPctPerExtraSchool: 10,
      incomeBonusPctPerExtraSchool: 4,
      maxPopulationProductionMultiplier: 1.4,
      maxStudentCapacityMultiplier: 1.5,
      maxIncomeMultiplier: 1.2
    },
    talentPool: {
      baseChancePct: 0,
      chancePctPerExtraSchool: 0,
      maxChancePct: 0,
      eveningCourseTalentChanceBonusPct: 0,
      betterTalentChanceBonusPct: 0
    },
    eveningCourse: {
      actionId: "evening_course",
      cooldownMinutes: 35,
      durationMinutes: 20,
      costCleanCash: 1e3,
      heatGain: 0,
      populationProductionMultiplier: 1.6,
      talentChanceFlatBonusPct: 0,
      betterTalentChanceBonusPct: 0,
      cleanIncomeMultiplier: 1,
      stackable: false
    }
  };
  const freeModeSmugglingTunnelConfig = {
    id: "smuggling_tunnel",
    buildingTypeId: "smuggling_tunnel",
    countOnMap: 18,
    category: ["dirty_cash", "smuggling", "dealer_support", "risk_reward"],
    cleanCashPerMinute: 0,
    dirtyCashPerMinute: 54,
    influencePerMinute: 0,
    populationPerMinute: 0,
    heatPerMinute: 0.07,
    noCleanCash: true,
    noInfluence: true,
    noPopulationProduction: true,
    noIntelPower: true,
    noLaundering: true,
    noAuditRisk: true,
    openChannel: {
      actionId: "open_channel",
      cooldownMinutes: 30,
      durationMinutes: 15,
      costCleanCash: 1800,
      heatGain: 5,
      tunnelDirtyProductionBonusPct: 45,
      dealerSaleSpeedBonusPct: 10,
      dealerSaleHeatBonusPct: 15,
      streetIncidentFlatRiskPct: 5,
      stackable: false
    },
    dealerSupply: {
      bonusPctPerTunnel: 4,
      maxBonusPct: 32,
      saleSpeedSharePct: 35,
      streetRiskReductionSharePct: 40,
      passiveDirtyIncomeSharePct: 25,
      saleHeatRiskSharePct: 20
    },
    network: {
      dirtyProductionBonusPctPerExtraTunnel: 5,
      maxDirtyProductionMultiplier: 1.35,
      heatBonusPctPerExtraTunnel: 4,
      maxHeatMultiplier: 1.28
    }
  };
  const freeModeRecoveryBuildingActions = {
    open_channel: {
      actionId: "open_channel",
      buildingType: "smuggling_tunnel",
      label: "Otevřít kanál",
      description: "Na 15 minut globálně posílí dirty cash produkci Pašovacích tunelů a prodej Pouličních dealerů. Nestackuje se.",
      durationMs: freeModeSmugglingTunnelConfig.openChannel.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeSmugglingTunnelConfig.openChannel.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeSmugglingTunnelConfig.openChannel.costCleanCash },
      outputGain: {},
      heatGain: freeModeSmugglingTunnelConfig.openChannel.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Otevřený kanál krátkodobě zvedne tok špinavých peněz v tunelech. Pouliční dealeři prodávají výhodněji, ale roste riziko pouličního incidentu."
    },
    extract_losses: {
      actionId: "extract_losses",
      buildingType: "recycling_center",
      label: "Vytěžit ztráty",
      description: "Vrátí část neexpirovaných itemových ztrát ze salvage poolu. Nevrací populaci ani členy gangu.",
      durationMs: 0,
      cooldownMs: freeModeRecyclingCenterConfig.extractLosses.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeRecyclingCenterConfig.extractLosses.cleanCashCost },
      outputGain: {},
      heatGain: freeModeRecyclingCenterConfig.extractLosses.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Recyklační centrum vytěžilo část ztracených itemů ze šrotu."
    },
    stabilization_protocol: {
      actionId: "stabilization_protocol",
      buildingType: "clinic",
      label: "Stabilizační protokol",
      description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
      durationMs: 0,
      cooldownMs: freeModeClinicConfig.stabilizationProtocol.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeClinicConfig.stabilizationProtocol.cleanCashCost },
      outputGain: {},
      heatGain: freeModeClinicConfig.stabilizationProtocol.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Stabilizační protokol obnoví část nedávných ztrát. Recovery neprobíhá automaticky."
    },
    collect_population: {
      actionId: "collect_population",
      buildingType: "apartment_block",
      label: "Vybrat obyvatele",
      description: "Přesune lokálně uložené obyvatele z bytového bloku do globální populace hráče.",
      durationMs: 0,
      cooldownMs: 0,
      inputCost: {},
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vybere obyvatele z lokálního zásobníku bytového bloku."
    },
    collect_convenience_store_population: {
      actionId: "collect_convenience_store_population",
      buildingType: "convenience_store",
      label: "Vybrat obyvatele",
      description: "Přesune lokálně uložené obyvatele z Večerky do globální populace hráče.",
      durationMs: 0,
      cooldownMs: 0,
      inputCost: {},
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vybere obyvatele z lokálního zásobníku Večerky."
    },
    evening_course: {
      actionId: "evening_course",
      buildingType: "school",
      label: "Večerní kurz",
      description: "Na 20 minut zrychlí nábor členů v bytových blocích. Nestackuje se.",
      durationMs: freeModeSchoolConfig.eveningCourse.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeSchoolConfig.eveningCourse.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeSchoolConfig.eveningCourse.costCleanCash },
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Večerní kurz dočasně zvedne nábor členů v bytových blocích."
    },
    night_machines: {
      actionId: "night_machines",
      buildingType: "arcade",
      label: "Noční automaty",
      description: "Na 7 minut zvýší produkci Herny, vliv, heat a audit risk.",
      durationMs: freeModeArcadeConfig.nightMachines.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeArcadeConfig.nightMachines.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      effectModifiers: {
        cleanIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.cleanIncomeBonusPct / 100,
        dirtyIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.dirtyIncomeBonusPct / 100,
        influenceMultiplier: 1 + freeModeArcadeConfig.nightMachines.influenceBonusPct / 100,
        heatMultiplier: 1 + freeModeArcadeConfig.nightMachines.heatBonusPct / 100
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Aktivuje Noční automaty. Boost se sám se sebou nestackuje."
    },
    backup_grid_switch: {
      actionId: "backup_grid_switch",
      buildingType: "power_station",
      label: "Přepnutí na záložní síť",
      description: "Dočasně zvýší infrastructure bonus a posílí kamery, alarm, Továrny a Zbrojovky.",
      durationMs: freeModePowerStationConfig.backupGridSwitch.durationMinutes * 60 * 1e3,
      cooldownMs: freeModePowerStationConfig.backupGridSwitch.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModePowerStationConfig.backupGridSwitch.cleanCashCost },
      outputGain: {},
      heatGain: freeModePowerStationConfig.backupGridSwitch.heatGain,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Záložní síť aktivní. Infrastruktura a obranné systémy jsou dočasně posílené."
    },
    power_station_feed_production: {
      actionId: "power_station_feed_production",
      buildingType: "power_station",
      label: "Napájet výrobu",
      description: "Okamžitě přidá menší clean a dirty výnos z přesměrované výroby.",
      durationMs: 0,
      cooldownMs: 60 * 60 * 1e3,
      inputCost: {},
      outputGain: { cash: 2e3, "dirty-cash": 500 },
      heatGain: 10,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Napájení výroby přidalo 2000 clean cash a 500 dirty cash. Heat +10."
    },
    power_station_reduce_heat: {
      actionId: "power_station_reduce_heat",
      buildingType: "power_station",
      label: "Snížit heat",
      description: "Serverově sníží heat districtu o 20 bodů.",
      durationMs: 0,
      cooldownMs: 60 * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: -20,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Energetická stanice stabilizovala provoz a snížila heat districtu o 20."
    },
    start_drug_sale: {
      actionId: "start_drug_sale",
      buildingType: "street_dealers",
      label: "Spustit prodej",
      description: "Prodá látku z Drug Labu přes jeden ze tří pevných slotů Pouličních dealerů. Minimum je 10 ks a současně může běžet jen jeden prodej.",
      durationMs: 0,
      cooldownMs: 0,
      inputCost: {},
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Pouliční dealeři spustili prodej přes vybraný slot."
    }
  };
  const freeModeRestaurantBuildingActions = {
    restaurant_collect_revenue: {
      actionId: "restaurant_collect_revenue",
      buildingType: "restaurant",
      label: "Vybrat tržby",
      description: "Vybere lokální tržby restaurace jako clean a dirty cash.",
      durationMs: 0,
      cooldownMs: 30 * 60 * 1e3,
      inputCost: {},
      outputGain: {
        cash: 869,
        "dirty-cash": 550
      },
      heatGain: 5,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Restaurace vybrala lokální tržby: 869 clean cash a 550 dirty cash."
    },
    restaurant_cover_meetings: {
      actionId: "restaurant_cover_meetings",
      buildingType: "restaurant",
      label: "Krýt schůzky",
      description: "Na 30 minut zvedne lokální income restaurace a přidá vliv.",
      durationMs: 30 * 60 * 1e3,
      cooldownMs: 45 * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: 4,
      influenceChange: 8,
      effectModifiers: {
        cleanIncomeMultiplier: 1.18,
        dirtyIncomeMultiplier: 1.18
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Restaurace kryje schůzky. Income restaurace je dočasně posílený."
    },
    restaurant_local_network: {
      actionId: "restaurant_local_network",
      buildingType: "restaurant",
      label: "Posílit lokální síť",
      description: "Na 30 minut posílí lokální vliv restaurace.",
      durationMs: 30 * 60 * 1e3,
      cooldownMs: 30 * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: 8,
      influenceChange: 4,
      effectModifiers: {
        influenceMultiplier: 1.12
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Restaurace posílila lokální síť a vliv v districtu."
    }
  };
  const freeModeCasinoConfig = {
    buildingTypeId: "casino",
    countOnMap: 3,
    category: ["economy", "laundering", "high-risk"],
    cleanCashPerMinute: 4500 / 60,
    dirtyCashPerMinute: 2500 / 60,
    influencePerMinute: 110 / (60 * 24),
    heatPerMinute: 150 / (60 * 24),
    launderingCapacity: 18e3,
    baseAuditRiskPct: 8,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 5,
    quietBackroom: {
      actionId: "quiet_backroom",
      cooldownMinutes: 14,
      minimumDirtyCash: 1500,
      dirtyCashSharePct: 24,
      maxDirtyCashPerAction: 18e3,
      feePct: 9,
      heatGain: 7,
      influenceGain: 3,
      auditRiskBonusPct: 6,
      auditRiskDurationMinutes: 10
    },
    vipNight: {
      actionId: "vip_night",
      cooldownMinutes: 26,
      durationMinutes: 10,
      cleanIncomeBonusPct: 70,
      dirtyIncomeBonusPct: 55,
      influenceBonusPct: 25,
      heatBonusPct: 60,
      auditRiskBonusPct: 8
    },
    bribedInspector: {
      actionId: "bribed_inspector",
      cooldownMinutes: 105,
      cleanCashCost: 15e3,
      protectionMinutes: 12,
      failureChancePct: 14,
      successHeatReduction: 15,
      successAuditRiskReductionPct: 35,
      successInfluenceGain: 4,
      failureHeatGain: 12,
      failureAuditRiskBonusPct: 10,
      failureAuditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 5e3, riskPct: 6 },
      { maxLaunderedAmount: 12e3, riskPct: 13 },
      { maxLaunderedAmount: 25e3, riskPct: 24 },
      { maxLaunderedAmount: 45e3, riskPct: 38 },
      { maxLaunderedAmount: null, riskPct: 55 }
    ],
    auditConsequences: {
      lightInspection: { incomePenaltyPct: 10, durationMinutes: 8 },
      seizedBooks: { dirtyCashLossPct: 12 },
      frozenAccounts: { launderingBlockedMinutes: 8 },
      policeRaid: { heatGain: 20, incomePenaltyPct: 20, durationMinutes: 10 },
      closedVipLounge: { vipBlockedMinutes: 12 }
    },
    upgrades: [
      { level: 1, cleanCashCost: 0, incomeBonusPct: 0, launderingLimitBonusPct: 0 },
      { level: 2, cleanCashCost: 7500, techCoreCost: 3, incomeBonusPct: 12, launderingLimitBonusPct: 8 },
      { level: 3, cleanCashCost: 18e3, techCoreCost: 7, incomeBonusPct: 25, launderingLimitBonusPct: 16, feeReductionPct: 2 },
      { level: 4, cleanCashCost: 38e3, techCoreCost: 14, combatModuleCost: 3, incomeBonusPct: 40, launderingLimitBonusPct: 25, actionHeatReductionPct: 8 }
    ]
  };
  const freeModeExchangeOfficeConfig = {
    id: "exchange_office",
    buildingTypeId: "exchange",
    countOnMap: 11,
    category: ["economy", "laundering", "network"],
    cleanCashPerMinute: 70,
    dirtyCashPerMinute: 95,
    influencePerMinute: 60 / (60 * 24),
    heatPerMinute: 70 / (60 * 24),
    launderingCapacity: 6e3,
    baseAuditRiskPct: 4,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 6,
    network: {
      incomeBonusPctPerExtraExchange: 8,
      launderingLimitBonusPctPerExtraExchange: 10,
      heatBonusPctPerExtraExchange: 4,
      maxIncomeMultiplier: 1.48,
      maxLaunderingLimitMultiplier: 1.6,
      maxHeatMultiplier: 1.24
    },
    goodRate: {
      actionId: "good_rate",
      cooldownMinutes: 18,
      minimumDirtyCash: 800,
      dirtyCashSharePct: 16,
      maxDirtyCashPerAction: 6e3,
      feePct: 12,
      heatGain: 12,
      influenceGain: 3,
      auditRiskBonusPct: 4,
      auditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 3e3, riskPct: 4 },
      { maxLaunderedAmount: 8e3, riskPct: 9 },
      { maxLaunderedAmount: 16e3, riskPct: 17 },
      { maxLaunderedAmount: 3e4, riskPct: 28 },
      { maxLaunderedAmount: null, riskPct: 42 }
    ],
    auditConsequences: {
      suspiciousTransaction: { incomePenaltyPct: 8, durationMinutes: 8 },
      blockedTransfer: { actionBlockedMinutes: 7 },
      lostClient: { dirtyIncomePenaltyPct: 10, durationMinutes: 10 },
      documentCheck: { heatGain: 10 },
      seizedCash: { dirtyCashLossPct: 8 }
    }
  };
  const freeModeStripClubConfig = {
    id: "strip_club",
    buildingTypeId: "strip_club",
    countOnMap: 17,
    category: ["economy", "influence", "rumors", "social_network"],
    cleanCashPerMinute: 75,
    dirtyCashPerMinute: 65,
    influencePerMinute: 90 / 1440,
    heatPerMinute: 85 / 1440,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumorIntervalMinutes: 30,
    baseRumorChancePct: 100,
    baseTruthChancePct: 55,
    truthChancePctPerExtraClub: 3,
    maxTruthChancePct: 75,
    districtHintChancePct: 35,
    buildingHintChancePct: 20,
    rumorTypes: ["money", "relationships", "police", "attacks", "storage", "laundering", "fake"],
    network: {
      incomeBonusPctPerExtraStripClub: 5,
      influenceBonusPctPerExtraStripClub: 7,
      rumorChanceBonusPctPerExtraStripClub: 8,
      heatBonusPctPerExtraStripClub: 4,
      maxIncomeMultiplier: 1.35,
      maxInfluenceMultiplier: 1.5,
      maxRumorMultiplier: 1.6,
      maxHeatMultiplier: 1.28
    },
    vipLounge: {
      actionId: "vip_lounge",
      cooldownMinutes: 60,
      durationMinutes: 30,
      cleanCashCost: 800,
      cleanIncomeBonusPct: 45,
      dirtyIncomeBonusPct: 35,
      influenceBonusPct: 55,
      heatBonusPct: 50,
      rumorChanceFlatBonusPct: 10
    },
    privateParty: {
      actionId: "private_party",
      cooldownMinutes: 30,
      durationMinutes: 10,
      cleanCashCost: 1500,
      instantInfluenceGain: 8,
      influenceProductionBonusPct: 70,
      extraRumorChancePct: 45,
      heatGain: 6,
      scandalChancePct: 12,
      scandalHeatGain: 10,
      scandalInfluenceLoss: 4
    }
  };
  const freeModeVenueBuildingActions = {
    back_cashdesk: {
      actionId: "back_cashdesk",
      buildingType: "arcade",
      label: "Zadní pokladna",
      description: "Instantně vypere část aktuálního dirty cash přes zadní pokladnu Herny.",
      durationMs: 0,
      cooldownMs: freeModeArcadeConfig.backCashdesk.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: freeModeArcadeConfig.backCashdesk.heatGain,
      influenceChange: freeModeArcadeConfig.backCashdesk.influenceGain,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
    },
    good_rate: {
      actionId: "good_rate",
      buildingType: "exchange",
      label: "Výhodný kurz",
      description: "Instantně vypere menší část aktuálního dirty cash přes síť směnáren.",
      durationMs: 0,
      cooldownMs: freeModeExchangeOfficeConfig.goodRate.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: freeModeExchangeOfficeConfig.goodRate.heatGain,
      influenceChange: freeModeExchangeOfficeConfig.goodRate.influenceGain,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
    },
    quiet_backroom: {
      actionId: "quiet_backroom",
      buildingType: "casino",
      label: "Tichá herna",
      description: "Instantně vypere část aktuálního dirty cash přes tiché zázemí kasina.",
      durationMs: 0,
      cooldownMs: freeModeCasinoConfig.quietBackroom.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: freeModeCasinoConfig.quietBackroom.heatGain,
      influenceChange: freeModeCasinoConfig.quietBackroom.influenceGain,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
    },
    vip_night: {
      actionId: "vip_night",
      buildingType: "casino",
      label: "VIP noc",
      description: "Na 10 minut výrazně zvýší casino income, vliv, heat a audit risk.",
      durationMs: freeModeCasinoConfig.vipNight.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeCasinoConfig.vipNight.cooldownMinutes * 60 * 1e3,
      inputCost: {},
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      effectModifiers: {
        cleanIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.cleanIncomeBonusPct / 100,
        dirtyIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.dirtyIncomeBonusPct / 100,
        influenceMultiplier: 1 + freeModeCasinoConfig.vipNight.influenceBonusPct / 100,
        heatMultiplier: 1 + freeModeCasinoConfig.vipNight.heatBonusPct / 100
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Aktivuje VIP noc. Boost se sám se sebou nestackuje."
    },
    bribed_inspector: {
      actionId: "bribed_inspector",
      buildingType: "casino",
      label: "Podplacený inspektor",
      description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší policejní tlak.",
      durationMs: freeModeCasinoConfig.bribedInspector.protectionMinutes * 60 * 1e3,
      cooldownMs: freeModeCasinoConfig.bribedInspector.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeCasinoConfig.bribedInspector.cleanCashCost },
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Heat control akce s rizikem selhání."
    },
    strip_club_collect_cash: {
      actionId: "strip_club_collect_cash",
      buildingType: "strip_club",
      label: "Vybrat cash",
      description: "Okamžitě vybere noční dirty cash ze Strip Clubu.",
      durationMs: 0,
      cooldownMs: 10 * 60 * 1e3,
      inputCost: {},
      outputGain: { "dirty-cash": 360 },
      heatGain: 3,
      influenceChange: 0,
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Strip Club vybral 360 dirty cash. Heat +3."
    },
    vip_lounge: {
      actionId: "vip_lounge",
      buildingType: "strip_club",
      label: "Hostit VIP klienty",
      description: "Na 30 minut zvýší produkci Strip Clubu, vliv, heat a šanci na drb.",
      durationMs: freeModeStripClubConfig.vipLounge.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeStripClubConfig.vipLounge.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeStripClubConfig.vipLounge.cleanCashCost },
      outputGain: {},
      heatGain: 0,
      influenceChange: 0,
      effectModifiers: {
        cleanIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.cleanIncomeBonusPct / 100,
        dirtyIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.dirtyIncomeBonusPct / 100,
        influenceMultiplier: 1 + freeModeStripClubConfig.vipLounge.influenceBonusPct / 100,
        heatMultiplier: 1 + freeModeStripClubConfig.vipLounge.heatBonusPct / 100
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "VIP klienti jsou aktivní. Boost se sám se sebou nestackuje."
    },
    private_party: {
      actionId: "private_party",
      buildingType: "strip_club",
      label: "Soukromá party",
      description: "Přidá vliv, dočasně zvýší jeho tvorbu a může přinést extra drb nebo skandál.",
      durationMs: freeModeStripClubConfig.privateParty.durationMinutes * 60 * 1e3,
      cooldownMs: freeModeStripClubConfig.privateParty.cooldownMinutes * 60 * 1e3,
      inputCost: { cash: freeModeStripClubConfig.privateParty.cleanCashCost },
      outputGain: {},
      heatGain: freeModeStripClubConfig.privateParty.heatGain,
      influenceChange: freeModeStripClubConfig.privateParty.instantInfluenceGain,
      effectModifiers: {
        influenceMultiplier: 1 + freeModeStripClubConfig.privateParty.influenceProductionBonusPct / 100
      },
      requiredOwner: true,
      allowedIfContested: false,
      reportText: "Soukromá party proběhla. Výsledek může obsahovat kontakt, extra drb nebo skandál."
    }
  };
  const freeModeBuildingActions = {
    ...freeModeInstitutionalBuildingActions,
    ...freeModeRecoveryBuildingActions,
    ...freeModeRestaurantBuildingActions,
    ...freeModeVenueBuildingActions
  };
  const freeModeCarDealerConfig = {
    id: "car_dealer",
    buildingTypeId: "car_dealer",
    legacyBuildingTypeIds: ["auto_salon"],
    countOnMap: 10,
    category: ["economy", "mobility", "logistics", "cooldown_multiplier"],
    cleanCashPerMinute: 2145 / 60,
    dirtyCashPerMinute: 650 / 60,
    influencePerMinute: 1 / 60,
    heatPerMinute: 60 / (60 * 24),
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    noPopulationProduction: true,
    noIntelPower: true,
    mobility: {
      bonusPctPerDealer: 3,
      maxBonusPct: 21,
      fullBonusActionCategories: [
        "districtRobbery",
        "districtOccupy",
        "attackPreparation"
      ],
      halfBonusActionCategories: [],
      smallBonusActionCategories: [
        "clinicEvacuationRecovery",
        "recyclingSalvageTransport"
      ],
      excludedActionCategories: [
        "moneyLaundering",
        "casinoActions",
        "exchangeOfficeActions",
        "arcadeLaunderingActions",
        "rumorGeneration",
        "passiveProduction",
        "intelScan",
        "trapDetection"
      ]
    },
    cooldownReduction: {
      reductionPctPerDealer: 1.5,
      maxReductionPct: 10.5,
      combinedGarageDealerMaxReductionPct: 22,
      fullBonusActionCategories: [
        "districtRobbery",
        "districtOccupy",
        "attackPreparation"
      ],
      halfBonusActionCategories: [],
      smallBonusActionCategories: [
        "clinicEvacuationRecovery",
        "recyclingSalvageTransport"
      ],
      excludedActionCategories: [
        "moneyLaundering",
        "casinoActions",
        "exchangeOfficeActions",
        "arcadeLaunderingActions",
        "rumorGeneration",
        "passiveProduction",
        "intelScan",
        "trapDetection"
      ]
    },
    escapeChance: {
      bonusPctPerDealer: 2,
      maxBonusPct: 12,
      appliesTo: [
        "attackFailure"
      ]
    },
    network: {
      cleanIncomeBonusPctPerExtraDealer: 4,
      dirtyIncomeBonusPctPerExtraDealer: 4,
      heatBonusPctPerExtraDealer: 3,
      maxCleanIncomeMultiplier: 1.24,
      maxDirtyIncomeMultiplier: 1.24,
      maxHeatMultiplier: 1.18
    }
  };
  const freeModeConvenienceStoreConfig = {
    id: "convenience_store",
    buildingTypeId: "convenience_store",
    countOnMap: 17,
    category: ["economy", "dirty_cash", "rumors", "influence", "street_life"],
    cleanCashPerMinute: 32,
    dirtyCashPerMinute: 18,
    influencePerMinute: 0.1,
    heatPerMinute: 0.05,
    noSpecialActions: false,
    noLaundering: true,
    noAuditRisk: true,
    populationPerMinute: 50 / 60,
    basePopulationCapacity: 50,
    collectPopulation: {
      actionId: "collect_convenience_store_population",
      cooldownMinutes: 0,
      minCollectPopulation: 30
    },
    passiveRumorIntervalMinutes: 10,
    maxRumorChecksPerPlayerPerInterval: 1,
    baseRumorChancePct: 11,
    truthChanceByOwnedCount: [
      { minOwned: 1, maxOwned: 2, truthChancePct: 42 },
      { minOwned: 3, maxOwned: 5, truthChancePct: 48 },
      { minOwned: 6, maxOwned: 8, truthChancePct: 54 },
      { minOwned: 9, maxOwned: null, truthChancePct: 58 }
    ],
    districtHintChancePct: 22,
    areaHintChancePct: 12,
    buildingHintChancePct: 6,
    rumorTypes: [
      "night_movement",
      "suspicious_purchase",
      "courier_trace",
      "small_conflict",
      "police_patrol",
      "robbery_preparation",
      "weak_defense",
      "dirty_cash_movement",
      "fake"
    ],
    network: {
      cleanIncomeBonusPctPerExtraStore: 3.5,
      dirtyIncomeBonusPctPerExtraStore: 3.5,
      influenceBonusPctPerExtraStore: 4,
      rumorChanceBonusPctPerExtraStore: 6,
      heatBonusPctPerExtraStore: 2,
      maxCleanIncomeMultiplier: 1.25,
      maxDirtyIncomeMultiplier: 1.25,
      maxInfluenceMultiplier: 1.3,
      maxRumorMultiplier: 1.45,
      maxHeatMultiplier: 1.16,
      populationPerMinuteBonusPerExtraStore: 5 / 60
    },
    restaurantSynergy: {
      firstStoreThreshold: 3,
      firstRestaurantThreshold: 3,
      firstCivilRumorChanceBonusPct: 5,
      secondStoreThreshold: 6,
      secondRestaurantThreshold: 6,
      secondCivilRumorChanceBonusPct: 8,
      truthStoreThreshold: 8,
      truthRestaurantThreshold: 10,
      civilRumorTruthBonusPct: 5
    }
  };
  const freeModeCourthouseConfig = {
    id: "courthouse",
    buildingTypeId: "court",
    countOnMap: 2,
    zone: "downtown",
    category: ["ultra_rare", "passive_legal_protection", "police_raid_mitigation", "influence"],
    cleanCashPerMinute: 105,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.72,
    populationPerMinute: 0,
    heatPerMinute: 0.08,
    actions: [],
    noSpecialActions: true,
    noIntelPower: true,
    noDirtyCash: true,
    noPopulationProduction: true,
    noLaundering: true,
    noAuditRisk: true,
    legalProtectionTiers: [
      {
        minOwned: 1,
        maxOwned: 1,
        cleanIncomeMultiplier: 1,
        influenceMultiplier: 1,
        heatMultiplier: 1,
        policeRaidConsequencesReductionPct: 50
      },
      {
        minOwned: 2,
        maxOwned: 99,
        cleanIncomeMultiplier: 1.14,
        influenceMultiplier: 1.18,
        heatMultiplier: 1.08,
        policeRaidConsequencesReductionPct: 75
      }
    ]
  };
  const freeModeFitnessClubConfig = {
    id: "fitness_club",
    buildingTypeId: "fitness_club",
    countOnMap: 5,
    category: ["economy", "combat_support", "physical_training"],
    cleanCashPerMinute: 72,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    populationPerMinute: 0,
    heatPerMinute: 0.04,
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    noPopulationProduction: true,
    noIntelPower: true,
    combatConditioning: {
      attackStrengthBonusPctPerClub: 3,
      defenseStrengthBonusPctPerClub: 2,
      maxAttackStrengthBonusPct: 15,
      maxDefenseStrengthBonusPct: 10,
      combinedRecruitmentFitnessAttackCapPct: 24,
      combinedRecruitmentFitnessDefenseCapPct: 18,
      attackApplication: {
        baseGangMemberAttack: 0.75,
        "baseball-bat": 0.75,
        pistol: 0.35,
        grenade: 0.15,
        smg: 0.25,
        bazooka: 0.1
      },
      defenseApplication: {
        baseGangMemberDefense: 0.75,
        vest: 0.4,
        barricades: 0.2,
        cameras: 0,
        "defense-tower": 0,
        alarm: 0
      }
    },
    network: {
      incomeBonusPctPerExtraClub: 5,
      heatBonusPctPerExtraClub: 3,
      maxIncomeMultiplier: 1.2,
      maxHeatMultiplier: 1.12
    }
  };
  const freeModeGarageConfig = {
    id: "garage",
    buildingTypeId: "garage",
    countOnMap: 16,
    category: ["economy", "logistics", "cooldown_multiplier"],
    cleanCashPerMinute: 42,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.06,
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    cooldownReduction: {
      reductionPctPerGarage: 2,
      maxReductionPct: 16,
      fullBonusActionCategories: [
        "attackPreparation",
        "districtOccupy",
        "districtRobbery"
      ],
      halfBonusActionCategories: [
        "districtSpy",
        "trapDetection",
        "clinicRecovery",
        "factoryProductionActions",
        "armoryProductionActions"
      ],
      excludedActionCategories: [
        "moneyLaundering",
        "casinoActions",
        "exchangeOfficeActions",
        "arcadeLaunderingActions",
        "vipBoosts",
        "rumorGeneration",
        "passiveProduction"
      ]
    },
    network: {
      incomeBonusPctPerExtraGarage: 3,
      heatBonusPctPerExtraGarage: 2,
      maxIncomeMultiplier: 1.21,
      maxHeatMultiplier: 1.14
    }
  };
  const freeModeRecruitmentCenterConfig = {
    id: "recruitment_center",
    buildingTypeId: "recruitment_center",
    countOnMap: 16,
    category: ["support", "population_support", "combat_multiplier"],
    cleanCashPerMinute: 35,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.07,
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    populationSupport: {
      populationProductionBonusPctPerCenter: 3,
      apartmentCapacityBonusPctPerCenter: 4,
      maxPopulationProductionBonusPct: 24,
      maxApartmentCapacityBonusPct: 32
    },
    combatSupport: {
      attackWeaponStrengthBonusPctPerCenter: 2,
      defenseItemStrengthBonusPctPerCenter: 1.5,
      maxAttackWeaponStrengthBonusPct: 16,
      maxDefenseItemStrengthBonusPct: 12,
      maxCombinedCameraAlarmBonusPct: 50
    },
    network: {
      incomeBonusPctPerExtraCenter: 3,
      heatBonusPctPerExtraCenter: 3,
      maxIncomeMultiplier: 1.21,
      maxHeatMultiplier: 1.21
    }
  };
  const freeModeRestaurantConfig = {
    id: "restaurant",
    buildingTypeId: "restaurant",
    countOnMap: 36,
    category: ["economy", "rumors", "influence", "city_life"],
    cleanCashPerMinute: 38,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.12,
    heatPerMinute: 0.04,
    noSpecialActions: false,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumorIntervalMinutes: 10,
    baseRumorChancePct: 9,
    truthChanceByOwnedCount: [
      { minOwned: 1, maxOwned: 2, truthChancePct: 45 },
      { minOwned: 3, maxOwned: 5, truthChancePct: 50 },
      { minOwned: 6, maxOwned: 9, truthChancePct: 55 },
      { minOwned: 10, maxOwned: null, truthChancePct: 60 }
    ],
    districtHintChancePct: 18,
    buildingHintChancePct: 8,
    rumorTypes: [
      "civilian_movement",
      "suspicious_delivery",
      "police_interest",
      "economic_activity",
      "storage_movement",
      "attack_preparation",
      "weak_defense",
      "fake"
    ],
    network: {
      incomeBonusPctPerExtraRestaurant: 2.5,
      influenceBonusPctPerExtraRestaurant: 3,
      rumorChanceBonusPctPerExtraRestaurant: 4,
      heatBonusPctPerExtraRestaurant: 2,
      maxIncomeMultiplier: 1.25,
      maxInfluenceMultiplier: 1.3,
      maxRumorMultiplier: 1.4,
      maxHeatMultiplier: 1.2
    }
  };
  const freeModeShoppingMallConfig = {
    id: "shopping_mall",
    buildingTypeId: "shopping_mall",
    countOnMap: 10,
    category: ["economy", "market", "influence", "multiplier"],
    cleanCashPerMinute: 3700 / 60,
    dirtyCashPerMinute: 22,
    influencePerMinute: 95 / (60 * 24),
    heatPerMinute: 65 / (60 * 24),
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    marketDiscount: {
      discountPctPerMall: 2,
      maxDiscountPct: 14,
      regularMarketWeight: 1,
      blackMarketWeight: 0.4,
      playerMarketWeight: 0,
      emergencyMarketWeight: 0,
      minFinalPriceMultiplier: 0.7
    },
    marketFeeReduction: {
      feeReductionPctPerMall: 5,
      maxFeeReductionPct: 30
    },
    network: {
      cleanIncomeBonusPctPerExtraMall: 5,
      dirtyIncomeBonusPctPerExtraMall: 5,
      influenceBonusPctPerExtraMall: 4,
      heatBonusPctPerExtraMall: 3,
      maxCleanIncomeMultiplier: 1.3,
      maxDirtyIncomeMultiplier: 1.3,
      maxInfluenceMultiplier: 1.24,
      maxHeatMultiplier: 1.18
    }
  };
  const FREE_MODE_TICK_RATE_MS = 5e3;
  const FREE_MODE_COOLDOWN_MULTIPLIER = 0.8;
  const ticksFromMinutes = (minutes, tickRateMs = FREE_MODE_TICK_RATE_MS) => Math.ceil(minutes * 60 * 1e3 / tickRateMs);
  const ticksFromHours = (hours, tickRateMs = FREE_MODE_TICK_RATE_MS) => ticksFromMinutes(hours * 60, tickRateMs);
  const ticksFromDays = (days, tickRateMs = FREE_MODE_TICK_RATE_MS) => ticksFromHours(days * 24, tickRateMs);
  const baseCooldownTicksForFinalMinutes = (minutes) => Math.ceil(ticksFromMinutes(minutes) / FREE_MODE_COOLDOWN_MULTIPLIER);
  const freeModeDrugLabConfig = {
    independentProductionLines: true,
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 4200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      "neon-dust": {
        label: "Neon Dust",
        description: "Pouliční stimulant a laboratorní vstup používaný také pro Ghost Network.",
        outputResourceKey: "neon-dust",
        outputAmount: 1,
        itemRole: "trade-material",
        directlyUsable: false,
        cleanCashCostPerUnit: 500,
        inputCosts: { chemicals: 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
        localOutputCap: 10,
        queueCap: 13
      },
      "pulse-shot": {
        label: "Pulse Shot",
        description: "Prodejná laboratorní látka a výrobní materiál.",
        outputResourceKey: "pulse-shot",
        outputAmount: 1,
        itemRole: "trade-material",
        directlyUsable: false,
        cleanCashCostPerUnit: 800,
        inputCosts: { chemicals: 2, biomass: 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
        localOutputCap: 6,
        queueCap: 9
      },
      "velvet-smoke": {
        label: "Velvet Smoke",
        description: "Prodejná laboratorní látka a výrobní materiál.",
        outputResourceKey: "velvet-smoke",
        outputAmount: 1,
        itemRole: "trade-material",
        directlyUsable: false,
        cleanCashCostPerUnit: 900,
        inputCosts: { chemicals: 1, biomass: 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
        localOutputCap: 5,
        queueCap: 8
      },
      "ghost-serum": {
        label: "Ghost Serum",
        description: "Vzácná laboratorní komponenta používaná pro Ghost Network a Tactical Grid.",
        outputResourceKey: "ghost-serum",
        outputAmount: 1,
        itemRole: "boost-component",
        directlyUsable: false,
        cleanCashCostPerUnit: 2500,
        inputCosts: { "neon-dust": 2, "pulse-shot": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(20),
        localOutputCap: 2,
        queueCap: 5
      },
      "overdrive-x": {
        label: "Overdrive X",
        description: "Nestabilní strategická komponenta používaná pro Industrial Overdrive a Tactical Grid.",
        outputResourceKey: "overdrive-x",
        outputAmount: 1,
        itemRole: "boost-component",
        directlyUsable: false,
        cleanCashCostPerUnit: 4500,
        inputCosts: { "pulse-shot": 1, "velvet-smoke": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(30),
        localOutputCap: 1,
        queueCap: 4
      }
    }
  };
  const STREET_SALE_PRICE_MULTIPLIER = 1.25;
  const getStreetSalePrice = (recipeId) => {
    const cleanCashCost = freeModeDrugLabConfig.recipes[recipeId].cleanCashCostPerUnit;
    return Math.round(cleanCashCost * STREET_SALE_PRICE_MULTIPLIER);
  };
  const freeModeStreetDealersConfig = {
    id: "street_dealers",
    buildingTypeId: "street_dealers",
    name: "Pouliční dealeři",
    countOnMap: 19,
    category: ["dirty_cash", "drug_distribution", "street_economy"],
    cleanCashPerMinute: 0,
    dirtyCashPerMinute: 36,
    influencePerMinute: 0,
    populationPerMinute: 0,
    heatPerMinute: 0.06,
    noCleanCash: true,
    noInfluence: true,
    noPopulationProduction: true,
    noIntelPower: true,
    noLaundering: true,
    noAuditRisk: true,
    startDrugSale: {
      actionId: "start_drug_sale"
    },
    dealerSlots: [
      { slotId: "slot-1", itemId: "neon-dust" },
      { slotId: "slot-2", itemId: "pulse-shot" },
      { slotId: "slot-3", itemId: "velvet-smoke" }
    ],
    sellableDrugs: [
      {
        itemId: "neon-dust",
        label: "Neon Dust",
        aliases: ["neonDust"],
        unitSalePriceDirtyCash: getStreetSalePrice("neon-dust"),
        cooldownMinutes: 4,
        baseHeatPerUnit: 2,
        minimumAmountPerSale: 10,
        baseStreetRiskPct: 4
      },
      {
        itemId: "pulse-shot",
        label: "Pulse Shot",
        aliases: ["pulseShot"],
        unitSalePriceDirtyCash: getStreetSalePrice("pulse-shot"),
        cooldownMinutes: 5,
        baseHeatPerUnit: 3,
        minimumAmountPerSale: 10,
        baseStreetRiskPct: 6
      },
      {
        itemId: "velvet-smoke",
        label: "Velvet Smoke",
        aliases: ["velvetSmoke"],
        unitSalePriceDirtyCash: getStreetSalePrice("velvet-smoke"),
        cooldownMinutes: 6,
        baseHeatPerUnit: 4,
        minimumAmountPerSale: 10,
        baseStreetRiskPct: 8
      }
    ],
    streetIncidents: {
      extraCooldownMinutes: 3,
      fakeCustomerRewardPenaltyPct: 25,
      streetConflictHeatGain: 8,
      lostPackageAmountPct: 15,
      maxStreetRiskPct: 35
    },
    network: {
      passiveDirtyIncomeBonusPctPerExtraDealer: 4,
      saleSpeedBonusPctPerExtraDealer: 3,
      heatBonusPctPerExtraDealer: 3,
      maxPassiveDirtyIncomeMultiplier: 1.28,
      maxSaleSpeedMultiplier: 1.22,
      maxHeatMultiplier: 1.22
    }
  };
  const freeModeVipLoungeConfig = {
    id: "vip_lounge",
    buildingTypeId: "vip_lounge",
    countOnMap: 2,
    category: ["rare", "elite_rumors", "high_truth_intel", "influence"],
    cleanCashPerMinute: 105,
    dirtyCashPerMinute: 30,
    influencePerMinute: 0.48,
    populationPerMinute: 0,
    heatPerMinute: 0.13,
    noIntelPower: true,
    noEliteContacts: true,
    noPopulationProduction: true,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumor: {
      baseChancePct: 32,
      reliabilityLabels: ["nízká spolehlivost", "střední spolehlivost", "vysoká spolehlivost"],
      rumorTypes: [
        "political_pressure",
        "financial_deal",
        "police_warning",
        "planned_attack",
        "revenge_plan",
        "casino_money",
        "smuggling_route",
        "drug_distribution",
        "hidden_weakness",
        "weak_defense",
        "storage_hint",
        "fake"
      ]
    },
    network: {
      tiers: [
        {
          minOwned: 1,
          maxOwned: 1,
          incomeMultiplier: 1,
          influenceMultiplier: 1,
          heatMultiplier: 1,
          rumorIntervalMinutes: 6,
          truthChancePct: 68,
          districtHintChancePct: 35,
          buildingHintChancePct: 18,
          reliabilityLabelChancePct: 25
        },
        {
          minOwned: 2,
          maxOwned: 2,
          incomeMultiplier: 1.08,
          influenceMultiplier: 1.1,
          heatMultiplier: 1.06,
          rumorIntervalMinutes: 5,
          truthChancePct: 78,
          districtHintChancePct: 45,
          buildingHintChancePct: 26,
          reliabilityLabelChancePct: 40
        },
        {
          minOwned: 3,
          maxOwned: null,
          incomeMultiplier: 1.16,
          influenceMultiplier: 1.2,
          heatMultiplier: 1.12,
          rumorIntervalMinutes: 4,
          truthChancePct: 86,
          districtHintChancePct: 55,
          buildingHintChancePct: 34,
          reliabilityLabelChancePct: 55
        }
      ]
    }
  };
  const roundPassiveStat = (value) => Number(Number(value).toFixed(10));
  const freeModeFixedBuildings = {
    casino: {
      cleanPerHour: roundPassiveStat(freeModeCasinoConfig.cleanCashPerMinute * 60),
      dirtyPerHour: roundPassiveStat(freeModeCasinoConfig.dirtyCashPerMinute * 60),
      heatPerDay: roundPassiveStat(freeModeCasinoConfig.heatPerMinute * 60 * 24),
      influencePerDay: roundPassiveStat(freeModeCasinoConfig.influencePerMinute * 60 * 24),
      maxLevel: 4
    },
    exchange: {
      cleanPerHour: freeModeExchangeOfficeConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeExchangeOfficeConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeExchangeOfficeConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeExchangeOfficeConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    arcade: {
      cleanPerHour: freeModeArcadeConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeArcadeConfig.dirtyCashPerMinute * 60,
      heatPerDay: Math.round(freeModeArcadeConfig.heatPerMinute * 60 * 24 * 10) / 10,
      influencePerDay: freeModeArcadeConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    apartment_block: {
      cleanPerHour: 0,
      dirtyPerHour: 0,
      heatPerDay: 0,
      influencePerDay: 0,
      maxLevel: 1
    },
    school: {
      cleanPerHour: freeModeSchoolConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: 0,
      influencePerDay: freeModeSchoolConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    warehouse: {
      cleanPerHour: freeModeWarehouseConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: 86.4,
      influencePerDay: 0,
      maxLevel: 4
    },
    clinic: {
      cleanPerHour: freeModeClinicConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeClinicConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    strip_club: {
      cleanPerHour: freeModeStripClubConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeStripClubConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeStripClubConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeStripClubConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    power_station: {
      cleanPerHour: freeModePowerStationConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModePowerStationConfig.dirtyCashPerMinute * 60,
      heatPerDay: 115.2,
      influencePerDay: 0,
      maxLevel: 1
    },
    restaurant: {
      cleanPerHour: freeModeRestaurantConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: 57.6,
      influencePerDay: 172.8,
      maxLevel: 1
    },
    convenience_store: {
      cleanPerHour: freeModeConvenienceStoreConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeConvenienceStoreConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeConvenienceStoreConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeConvenienceStoreConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    shopping_mall: {
      cleanPerHour: roundPassiveStat(freeModeShoppingMallConfig.cleanCashPerMinute * 60),
      dirtyPerHour: roundPassiveStat(freeModeShoppingMallConfig.dirtyCashPerMinute * 60),
      heatPerDay: roundPassiveStat(freeModeShoppingMallConfig.heatPerMinute * 60 * 24),
      influencePerDay: roundPassiveStat(freeModeShoppingMallConfig.influencePerMinute * 60 * 24),
      maxLevel: 1
    },
    central_bank: {
      cleanPerHour: freeModeCentralBankConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeCentralBankConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeCentralBankConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    stock_exchange: {
      cleanPerHour: freeModeStockExchangeConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeStockExchangeConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeStockExchangeConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    airport: {
      cleanPerHour: freeModeAirportConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeAirportConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeAirportConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeAirportConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    port: {
      cleanPerHour: freeModePortConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModePortConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModePortConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModePortConfig.influencePerMinute * 60 * 24,
      maxLevel: 5
    },
    parliament: {
      cleanPerHour: freeModeParliamentConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeParliamentConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeParliamentConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeParliamentConfig.influencePerMinute * 60 * 24,
      maxLevel: 5
    },
    city_hall: {
      cleanPerHour: freeModeCityHallConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeCityHallConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeCityHallConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    lobby_club: {
      cleanPerHour: freeModeLobbyClubConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeLobbyClubConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeLobbyClubConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    court: {
      cleanPerHour: freeModeCourthouseConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeCourthouseConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeCourthouseConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    vip_lounge: {
      cleanPerHour: freeModeVipLoungeConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeVipLoungeConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeVipLoungeConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeVipLoungeConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    fitness_club: {
      cleanPerHour: freeModeFitnessClubConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeFitnessClubConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    recruitment_center: {
      cleanPerHour: freeModeRecruitmentCenterConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeRecruitmentCenterConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    garage: {
      cleanPerHour: freeModeGarageConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeGarageConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    car_dealer: {
      cleanPerHour: freeModeCarDealerConfig.cleanCashPerMinute * 60,
      dirtyPerHour: freeModeCarDealerConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeCarDealerConfig.heatPerMinute * 60 * 24,
      influencePerDay: freeModeCarDealerConfig.influencePerMinute * 60 * 24,
      maxLevel: 1
    },
    recycling_center: {
      cleanPerHour: freeModeRecyclingCenterConfig.cleanCashPerMinute * 60,
      dirtyPerHour: 0,
      heatPerDay: freeModeRecyclingCenterConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    smuggling_tunnel: {
      cleanPerHour: 0,
      dirtyPerHour: freeModeSmugglingTunnelConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeSmugglingTunnelConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    },
    street_dealers: {
      cleanPerHour: 0,
      dirtyPerHour: freeModeStreetDealersConfig.dirtyCashPerMinute * 60,
      heatPerDay: freeModeStreetDealersConfig.heatPerMinute * 60 * 24,
      influencePerDay: 0,
      maxLevel: 1
    }
  };
  const freeModeApartmentBlockConfig = {
    id: "apartment_block",
    buildingTypeId: "apartment_block",
    countOnMap: 29,
    category: ["population", "gang_members"],
    populationPerMinute: 2,
    baseCapacity: 50,
    cleanCashPerMinute: 0,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0,
    noAuditRisk: true,
    noLaundering: true,
    productionStopsAtCapacity: true,
    requiresManualCollect: true,
    allowPartialCollect: true,
    network: {
      populationProductionBonusPctPerExtraBlock: 6,
      capacityBonusPctPerExtraBlock: 8,
      maxPopulationProductionMultiplier: 1.55,
      maxCapacityMultiplier: 1.75
    },
    collectPopulation: {
      actionId: "collect_population",
      cooldownMinutes: 0,
      minCollectPopulation: 10
    }
  };
  const freeModePharmacyConfig = {
    independentProductionLines: true,
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 3200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      chemicals: {
        label: "Chemicals",
        outputResourceKey: "chemicals",
        outputAmount: 1,
        cleanCashCostPerUnit: 360,
        inputCosts: {},
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(2),
        localOutputCap: 12,
        queueCap: 15
      },
      biomass: {
        label: "Biomass",
        outputResourceKey: "biomass",
        outputAmount: 1,
        cleanCashCostPerUnit: 420,
        inputCosts: {},
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(4),
        localOutputCap: 8,
        queueCap: 11
      },
      "stim-pack": {
        label: "Stim Pack",
        outputResourceKey: "stim-pack",
        outputAmount: 1,
        cleanCashCostPerUnit: 800,
        inputCosts: {},
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(10),
        localOutputCap: 4,
        queueCap: 7
      }
    }
  };
  const freeModeFactoryConfig = {
    independentProductionLines: true,
    network: {
      speedMultipliers: {
        1: 1,
        2: 1.1,
        3: 1.2,
        4: 1.3
      },
      maxSpeedMultiplier: 1.3
    },
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 5e3,
      costGrowth: 1.47,
      productionMultiplierPerLevel: 10,
      roundCostTo: 100
    },
    recipes: {
      "metal-parts": {
        label: "Metal Parts",
        outputResourceKey: "metal-parts",
        outputAmount: 1,
        cleanCashCostPerUnit: 300,
        inputCosts: {},
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(4),
        localOutputCap: 10,
        queueCap: 13
      },
      "tech-core": {
        label: "Tech Core",
        outputResourceKey: "tech-core",
        outputAmount: 1,
        cleanCashCostPerUnit: 900,
        inputCosts: { "metal-parts": 4 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
        localOutputCap: 5,
        queueCap: 8
      },
      "combat-module": {
        label: "Bojový modul",
        outputResourceKey: "combat-module",
        outputAmount: 1,
        cleanCashCostPerUnit: 2500,
        inputCosts: { "metal-parts": 4, "tech-core": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
        localOutputCap: 2,
        queueCap: 5
      }
    }
  };
  const freeModeArmoryConfig = {
    independentProductionLines: true,
    network: {
      speedMultipliers: { 1: 1, 2: 1.1, 3: 1.2, 4: 1.3 },
      maxSpeedMultiplier: 1.3
    },
    upgrade: {
      maxLevel: 14,
      upgradeBaseCost: 5200,
      costGrowth: 1.42,
      productionMultiplierPerLevel: 10
    },
    recipes: {
      "baseball-bat": {
        category: "attack",
        label: "Baseballová pálka",
        outputResourceKey: "baseball-bat",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(3),
        localOutputCap: 8,
        queueCap: 11
      },
      pistol: {
        category: "attack",
        label: "Pistole",
        outputResourceKey: "pistol",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 3, "tech-core": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
        localOutputCap: 5,
        queueCap: 8
      },
      grenade: {
        category: "attack",
        label: "Granát",
        outputResourceKey: "grenade",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 2, "tech-core": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(6),
        localOutputCap: 4,
        queueCap: 7
      },
      smg: {
        category: "attack",
        label: "SMG",
        outputResourceKey: "smg",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 2, "combat-module": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(8),
        localOutputCap: 3,
        queueCap: 6
      },
      bazooka: {
        category: "attack",
        label: "Bazuka",
        outputResourceKey: "bazooka",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 3, "combat-module": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(14),
        localOutputCap: 2,
        queueCap: 5
      },
      vest: {
        category: "defense",
        label: "Vesta",
        outputResourceKey: "vest",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 3, "tech-core": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
        localOutputCap: 5,
        queueCap: 8
      },
      barricades: {
        category: "defense",
        label: "Barikády",
        outputResourceKey: "barricades",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 4 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
        localOutputCap: 6,
        queueCap: 9
      },
      cameras: {
        category: "defense",
        label: "Kamery",
        outputResourceKey: "cameras",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 2, "tech-core": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(6),
        localOutputCap: 4,
        queueCap: 7
      },
      "defense-tower": {
        category: "defense",
        label: "Obranná věž",
        outputResourceKey: "defense-tower",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "tech-core": 3, "combat-module": 2 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(15),
        localOutputCap: 2,
        queueCap: 5
      },
      alarm: {
        category: "defense",
        label: "Alarm",
        outputResourceKey: "alarm",
        outputAmount: 1,
        cleanCashCostPerUnit: 0,
        inputCosts: { "metal-parts": 2, "tech-core": 1 },
        durationTicksPerUnit: baseCooldownTicksForFinalMinutes(5),
        localOutputCap: 4,
        queueCap: 7
      }
    }
  };
  const freeModeAttackWeaponsConfig = {
    "baseball-bat": {
      label: "Baseballová pálka",
      description: "Levná základní zbraň vhodná jako doplnění slabších útoků.",
      baseAttackPower: 5,
      populationRequired: 1
    },
    pistol: {
      label: "Pistole",
      description: "Silná early-game zbraň s dobrým poměrem síly a potřebných obyvatel.",
      baseAttackPower: 10,
      populationRequired: 1
    },
    grenade: {
      label: "Granát",
      description: "Silný burst za jednoho obyvatele proti dobře bráněným districtům.",
      baseAttackPower: 14,
      populationRequired: 1
    },
    smg: {
      label: "SMG",
      description: "Silná zbraň pro důležité útoky, která vyžaduje dva obyvatele.",
      baseAttackPower: 18,
      populationRequired: 2
    },
    bazooka: {
      label: "Bazuka",
      description: "Nejsilnější těžká zbraň. Vysoká síla je vykoupena třemi obyvateli.",
      baseAttackPower: 30,
      populationRequired: 3
    }
  };
  const freeModePlayerBoostConfig = {
    "ghost-network": {
      boostId: "ghost-network",
      label: "Ghost Network",
      category: "intel",
      description: "Prožeň špiony neviditelnou sítí a vytáhni z districtu víc informací.",
      shortEffect: "Špionáž −35 % času · rozšířený intel",
      cleanCashCost: 5e3,
      inputCosts: {
        "ghost-serum": 2,
        "pulse-shot": 2
      },
      activeDurationTicks: ticksFromMinutes(12),
      cooldownTicks: ticksFromMinutes(35),
      consumptionMode: "timed",
      effect: {
        spyDurationMultiplier: 0.65,
        criticalFailureChanceMultiplier: 0.75,
        extraIntelBlocksOnSuccess: 1
      },
      uiAccent: "cyan",
      iconKey: "signal-eye"
    },
    "industrial-overdrive": {
      boostId: "industrial-overdrive",
      label: "Industrial Overdrive",
      category: "production",
      description: "Přetěž výrobní síť a vytlač z každé linky vyšší tempo.",
      shortEffect: "Všechny výrobní linky +25 % rychlosti",
      cleanCashCost: 7500,
      inputCosts: {
        "overdrive-x": 2,
        "combat-module": 2
      },
      activeDurationTicks: ticksFromMinutes(12),
      cooldownTicks: ticksFromMinutes(45),
      consumptionMode: "timed",
      effect: {
        productionSpeedMultiplier: 1.25
      },
      uiAccent: "amber",
      iconKey: "industrial-gear"
    },
    "tactical-grid": {
      boostId: "tactical-grid",
      label: "Tactical Grid",
      category: "combat",
      description: "Propoj výzbroj, obranu a intel do jediné taktické sítě.",
      shortEffect: "+12 % k příštímu útoku nebo obraně",
      cleanCashCost: 1e4,
      inputCosts: {
        "ghost-serum": 2,
        "overdrive-x": 1,
        "combat-module": 3
      },
      activeDurationTicks: ticksFromMinutes(20),
      cooldownTicks: ticksFromMinutes(60),
      consumptionMode: "next-valid-pvp-combat",
      effect: {
        combatPowerMultiplier: 1.12
      },
      uiAccent: "red",
      iconKey: "tactical-grid"
    }
  };
  const catalog = [
    {
      id: "victor_01",
      agentId: "victor",
      title: "Rozbitá dodávka",
      description: "Jedna dodávka zůstala viset v cizím bloku. Dojeď tam, seber bedny a zmiz dřív, než si toho někdo všimne.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 18,
      reward: {
        "metal-parts": 5,
        cash: 700,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_02",
      agentId: "victor",
      title: "Tvrdé vyjednávání",
      description: "Jeden obchodník zapomněl, komu má platit. Připomeň mu to po mém.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 21,
      reward: {
        cash: 1400,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_03",
      agentId: "victor",
      title: "Sklad bez majitele",
      description: "Ve skladu leží materiál a nikdo ho zrovna nehlídá dost dobře. Udělej to rychle.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 20,
      reward: {
        "metal-parts": 4,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_04",
      agentId: "victor",
      title: "Noční výběr",
      description: "Po zavíračce bývá město měkký. Vytáhni z toho maximum, než se vzpamatuje.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 21,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_05",
      agentId: "victor",
      title: "Převoz pod tlakem",
      description: "Materiál musí projít přes horkou zónu. Když to zvládneš, lidi si tě začnou pamatovat.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 21,
      reward: {
        cash: 900,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_06",
      agentId: "victor",
      title: "Rozkopané dveře",
      description: "Za těma dveřma je schovaná zásoba. Otevři je po svém, já se ptát nebudu.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 19,
      reward: {
        "metal-parts": 3,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_07",
      agentId: "victor",
      title: "Tichá lekce",
      description: "Jeden malej hráč moc mluví. Nemusí zmizet, stačí aby začal šeptat.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_08",
      agentId: "victor",
      title: "Neonový kufr",
      description: "Na rohu čeká kufr, kterej nemá dlouho zůstat bez majitele. Buď rychlej.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 16,
      reward: {
        cash: 600,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_09",
      agentId: "victor",
      title: "Smrad z lékárny",
      description: "Z jedný lékárny odtéká víc chemie, než je zdravý. Jdi po tom.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_10",
      agentId: "victor",
      title: "Ochlazení konkurence",
      description: "Někdo vedle nás roste moc rychle. Ukaž mu, že asfalt má vždycky poslední slovo.",
      difficulty: "hard",
      successRate: 70,
      durationMinutes: 28,
      reward: {
        influence: 7,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_11",
      agentId: "victor",
      title: "Pouliční test loajality",
      description: "Ne každej pod tlakem drží hubu. Ověř, kdo je pevnej a kdo je hadr.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        influence: 3,
        cash: 750
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "victor_12",
      agentId: "victor",
      title: "Dvě minuty po půlnoci",
      description: "V noci mizí kamery, svědci i zábrany. Přesně proto jdeme teď.",
      difficulty: "hard",
      successRate: 68,
      durationMinutes: 26,
      reward: {
        "metal-parts": 2,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_13",
      agentId: "victor",
      title: "Balík pro špatnou adresu",
      description: "Někdo čeká zásilku. Jen škoda, že ji čeká marně.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 18,
      reward: {
        cash: 850,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_14",
      agentId: "victor",
      title: "Krev na parkovišti",
      description: "Na parkovišti se má uzavřít obchod. Udělej z toho náš obchod.",
      difficulty: "hard",
      successRate: 66,
      durationMinutes: 27,
      reward: {
        "dirty-cash": 2e3,
        "metal-parts": 2
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_15",
      agentId: "victor",
      title: "Kdo stojí, ten bere",
      description: "Některý rajóny patří těm, co v nich vydrží stát nejdýl. Dneska tam budeš stát ty.",
      difficulty: "hard",
      successRate: 72,
      durationMinutes: 30,
      reward: {
        influence: 8,
        cash: 1e3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_16",
      agentId: "victor",
      title: "Rozebraná zbrojnice",
      description: "Mám tip na rozebranou dílnu. Posbírej všechno, co ještě střílí nebo se dá prodat.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 21,
      reward: {
        "metal-parts": 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_17",
      agentId: "victor",
      title: "Uražená hrdost",
      description: "Jeden blbec se chtěl zviditelnit na cizím jménu. Teď mu vysvětli, že to byl drahej nápad.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 21,
      reward: {
        influence: 6,
        "dirty-cash": 1100
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_18",
      agentId: "victor",
      title: "Pád z nákladní rampy",
      description: "Na rampě stojí zboží, co má změnit majitele. Vezmi ho a nic neřeš.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 19,
      reward: {
        "metal-parts": 6,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_19",
      agentId: "victor",
      title: "Hlasitý vzkaz",
      description: "Někdy nestačí někoho okrást. Někdy musí celej blok vědět, kdo to udělal.",
      difficulty: "hard",
      successRate: 64,
      durationMinutes: 24,
      reward: {
        influence: 8,
        cash: 900
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_20",
      agentId: "victor",
      title: "Mokrý prachy",
      description: "U vody čeká malej přesun peněz. Když se zdržíš, někdo jiný si namočí ruce místo tebe.",
      difficulty: "hard",
      successRate: 71,
      durationMinutes: 22,
      reward: {
        "dirty-cash": 2200,
        influence: 2
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_21",
      agentId: "victor",
      title: "Starý dluh, nová bolest",
      description: "Starej dluh se dnes zavře. Otázka je jen, jestli penězma nebo zubama.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 20,
      reward: {
        cash: 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_22",
      agentId: "victor",
      title: "Kontejner číslo 9",
      description: "V kontejneru číslo 9 leží věci, co nemají vidět ráno. Otevři ho dřív než ostatní.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 18,
      reward: {
        "metal-parts": 3,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_23",
      agentId: "victor",
      title: "Měkký cíl",
      description: "Slabej článek řetězu bývá nejlevnější cesta dovnitř. Využij to.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_24",
      agentId: "victor",
      title: "Velvet Smoke v kufru",
      description: "V kufru čeká pár balení Velvet Smoke. Převezmi to, než se z toho stane cizí zisk.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        cash: 500,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_25",
      agentId: "victor",
      title: "Křik v zadní uličce",
      description: "Zadní uličky jsou moje kancelář. Dneska tam někomu zrušíš pracovní poměr.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 19,
      reward: {
        "dirty-cash": 1200,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_26",
      agentId: "victor",
      title: "Rychlý výkup",
      description: "Jeden zoufalec prodává materiál hluboko pod cenou. Seber to všechno, než dostane rozum.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        "metal-parts": 4
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "victor_27",
      agentId: "victor",
      title: "Tlak na rohu",
      description: "Na jednom rohu se rozdává respekt zadarmo. To je chyba, kterou dnes opravíš.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_28",
      agentId: "victor",
      title: "Spadlá bedna",
      description: "Někde spadla bedna z transportu. Kdo ji najde první, ten určuje pravidla.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 15,
      reward: {
        "metal-parts": 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_29",
      agentId: "victor",
      title: "Přepálená dávka",
      description: "Někdo vaří moc nahlas a moc blízko. Vlez tam, seber vzorek a zbytek nech rozpadnout.",
      difficulty: "hard",
      successRate: 69,
      durationMinutes: 23,
      reward: {
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_30",
      agentId: "victor",
      title: "Drobní, ale naši",
      description: "Malí dealeři se začínají dívat jinam. Připomeň jim, kde končí každá ulice.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 20,
      reward: {
        cash: 1300,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_31",
      agentId: "victor",
      title: "Tichá zbroj",
      description: "Mám kontakt na vybavení, co nechodí přes papíry. Vyber to a neotáčej se.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        "dirty-cash": 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_32",
      agentId: "victor",
      title: "Vyděšený účetní",
      description: "Jeden účetní ví, kam tečou peníze. A dneska bude chtít mluvit rychle.",
      difficulty: "hard",
      successRate: 72,
      durationMinutes: 22,
      reward: {
        "dirty-cash": 1700,
        influence: 6
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_33",
      agentId: "victor",
      title: "První rána zdarma",
      description: "Dneska nejde o kořist. Dneska jde o to, kdo dá první ránu a kdo si ji zapamatuje.",
      difficulty: "hard",
      successRate: 67,
      durationMinutes: 22,
      reward: {
        influence: 8,
        cash: 600
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_34",
      agentId: "victor",
      title: "Rozbitý automat",
      description: "Někdo schovává peníze tam, kde si myslí, že vypadají nevinně. Rozbij to a vezmi obsah.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        cash: 1200,
        "dirty-cash": 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_35",
      agentId: "victor",
      title: "Krátká návštěva v docku",
      description: "V doku kotví něco, co tam nemá vydržet do rána. Přesuneme to dřív.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 21,
      reward: {
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_36",
      agentId: "victor",
      title: "Neonový nátlak",
      description: "Jeden klub má dneska přinést víc než hudbu. Vlez tam, zatlač a vytáhni z toho hodnotu.",
      difficulty: "hard",
      successRate: 68,
      durationMinutes: 25,
      reward: {
        "dirty-cash": 1900,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_37",
      agentId: "victor",
      title: "Kov a krev",
      description: "Tam, kde je kov, bývá i zisk. Tam, kde je zisk, bývá i problém. Dneska si vezmeš oboje.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 18,
      reward: {
        "metal-parts": 6,
        cash: 400,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_38",
      agentId: "victor",
      title: "Tlačenice u zadního vstupu",
      description: "Zadní vstup je vždycky levnější než fronta. A mnohem výnosnější.",
      difficulty: "hard",
      successRate: 71,
      durationMinutes: 22,
      reward: {
        cash: 500,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_39",
      agentId: "victor",
      title: "Stůl pro dva, problém pro jednoho",
      description: "V restauraci proběhne schůzka. Ty se postaráš, aby domů neodnesli všechno, co přinesli.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 21,
      reward: {
        cash: 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_40",
      agentId: "victor",
      title: "Zkušební tlak",
      description: "Chci vidět, jak makáš, když tě někdo tlačí do zdi. Tahle práce je přesně na to.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_41",
      agentId: "victor",
      title: "Bazuka ve stínu",
      description: "Někdo schoval těžší kus železa tam, kde se bojí pro něj vrátit. To není náš problém.",
      difficulty: "rare",
      successRate: 58,
      durationMinutes: 30,
      reward: {
        "combat-module": 1,
        "dirty-cash": 500
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    },
    {
      id: "victor_42",
      agentId: "victor",
      title: "Hluk před bouří",
      description: "Celý blok je nervózní. To je nejlepší chvíle sebrat to, co není přibitý.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 18,
      reward: {
        cash: 1e3,
        "metal-parts": 4,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_43",
      agentId: "victor",
      title: "Ztracený kamerový záznam",
      description: "Někdo si myslí, že ho chrání záznam. Zmizí záznam, zmizí i jeho jistota.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 2,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_44",
      agentId: "victor",
      title: "Převzetí směny",
      description: "Končí směna, začíná chaos. Přesně v tom chaosu vyděláš nejvíc.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_45",
      agentId: "victor",
      title: "Když se nikdo neptá",
      description: "Tohle je ten druh práce, kde nikdo nic neviděl a nikdo nic neví. Mám tyhle práce rád.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 13,
      reward: {
        cash: 600,
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "victor_46",
      agentId: "victor",
      title: "Rozpal ulici",
      description: "Dneska nechci čistou práci. Dneska chci, aby se o tom mluvilo ještě zítra ráno.",
      difficulty: "rare",
      successRate: 60,
      durationMinutes: 26,
      reward: {
        smg: 1,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    },
    {
      id: "victor_47",
      agentId: "victor",
      title: "Pod pultem",
      description: "Jeden obchod má vzadu něco lepšího než ve výloze. Jdi si pro to.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_48",
      agentId: "victor",
      title: "Zlomený alarm",
      description: "Alarm se dá vypnout dvěma způsoby. Já mám radši ten hlučnější.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 19,
      reward: {
        "metal-parts": 3,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_49",
      agentId: "victor",
      title: "Síla bez omluvy",
      description: "Někdy je plán přeceňovanej. Vleť tam, udělej tlak a odejdi silnější než jsi přišel.",
      difficulty: "hard",
      successRate: 69,
      durationMinutes: 22,
      reward: {
        influence: 8,
        cash: 900,
        pistol: 1
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_50",
      agentId: "victor",
      title: "Ulice si pamatuje",
      description: "Tohle není jen práce. Tohle je podpis. Udělej to tak, aby si město zapamatovalo, kdo tady určuje rytmus.",
      difficulty: "hard",
      successRate: 63,
      durationMinutes: 29,
      reward: {
        influence: 8,
        "dirty-cash": 1400
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_51",
      agentId: "victor",
      title: "Rozkopnutý sklad",
      description: "Někdo si myslí, že plechové dveře znamenají bezpečí. Dneska zjistí, že jsou to jen dražší třísky.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 19,
      reward: {
        "metal-parts": 6,
        cash: 400,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_52",
      agentId: "victor",
      title: "Cizí roh",
      description: "Na našem území si někdo staví vlastní jméno. Sejmi tu pohádku dřív, než jí někdo uvěří.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 21,
      reward: {
        influence: 6,
        "dirty-cash": 1e3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_53",
      agentId: "victor",
      title: "Závora dolů",
      description: "Jeden vjezd se dnes na chvíli zavře. A všechno, co zůstane uvnitř, bude naše.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 18,
      reward: {
        "metal-parts": 4,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_54",
      agentId: "victor",
      title: "Ruce na kapotu",
      description: "Na parkovišti stojí auto, co veze víc než plech. Otevři ho a vyber, co se hodí.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 17,
      reward: {
        cash: 800,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_55",
      agentId: "victor",
      title: "Krátká porada",
      description: "Jeden chytrák potřebuje vysvětlit realitu. Ty budeš ten výukový materiál.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_56",
      agentId: "victor",
      title: "Prachy v mrazáku",
      description: "Někteří lidi schovávají peníze vedle masa. Dneska rozmrazíš jejich jistoty.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        "dirty-cash": 1600,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_57",
      agentId: "victor",
      title: "Přeložená zásilka",
      description: "Jedna bedna má změnit adresu dřív, než změří teplotu skladu. Nezdržuj se.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        cash: 600,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_58",
      agentId: "victor",
      title: "Těžká pěst",
      description: "Někde nestačí mluvit. Někde musíš nechat odpověď otisknutou ve zdi.",
      difficulty: "hard",
      successRate: 72,
      durationMinutes: 22,
      reward: {
        influence: 8,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_59",
      agentId: "victor",
      title: "Chybná směna",
      description: "Ve směnárně mají dneska špatný kurz. Pro ně. Pro nás je to výdělek.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        cash: 1163,
        "dirty-cash": 436
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_60",
      agentId: "victor",
      title: "Noční inventura",
      description: "V noci se nejlíp počítá cizí majetek. Zvlášť když si ho ráno už nikdo nespočítá.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 19,
      reward: {
        "metal-parts": 5,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_61",
      agentId: "victor",
      title: "Rozlitá krev, čistý zisk",
      description: "Někdo si chtěl hrát na tvrdýho. Nech mu tvrdou lekci a měkký kolena.",
      difficulty: "hard",
      successRate: 68,
      durationMinutes: 23,
      reward: {
        influence: 8,
        cash: 1e3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_62",
      agentId: "victor",
      title: "Balík pod mostem",
      description: "Pod mostem čeká balík bez majitele. A když ho nevezmeš ty, vezme ho někdo rychlejší.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        cash: 500,
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "victor_63",
      agentId: "victor",
      title: "Vymáhání po staru",
      description: "Ten dluh je malej jen na papíře. Udělej z něj velkej problém, dokud nebude splacenej.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        cash: 1500,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_64",
      agentId: "victor",
      title: "Přístup jen pro tvrdé",
      description: "Za zadním vstupem leží věci pro lidi bez skrupulí. Tak tam běž jako domů.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 16,
      reward: {
        "metal-parts": 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_65",
      agentId: "victor",
      title: "Vybitý kamerový dohled",
      description: "Někdo se spoléhá na kamery. Dneska mu ukážeš, že kabely křičí míň než lidi.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 3,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_66",
      agentId: "victor",
      title: "Tři minuty strachu",
      description: "Stačí tři minuty a celej blok začne šeptat. Udělej z nich dlouhý tři minuty.",
      difficulty: "hard",
      successRate: 69,
      durationMinutes: 22,
      reward: {
        influence: 8,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_67",
      agentId: "victor",
      title: "Lékárna po zavíračce",
      description: "Po zavíračce zůstává uvnitř víc než jen světla. Posbírej to, co má cenu.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 18,
      reward: {
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_68",
      agentId: "victor",
      title: "Narušený deal",
      description: "Dva lidi se chtějí domluvit bez nás. To je chyba, kterou je potřeba zpeněžit.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 20,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_69",
      agentId: "victor",
      title: "Otevřený kufr",
      description: "Kufr je otevřenej, nervy taky. Vezmi všechno, co uneseš, a zmiz dřív než cvakne zámek.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 15,
      reward: {
        cash: 700,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_70",
      agentId: "victor",
      title: "Směna skončila",
      description: "Když lidi končí směnu, dělají chyby. Ty na těch chybách dneska vyděláš.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        cash: 1e3,
        "metal-parts": 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_71",
      agentId: "victor",
      title: "Přetlačená ulice",
      description: "Na tý ulici je moc cizích ramen a málo našeho jména. Vyrovnej to.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 19,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_72",
      agentId: "victor",
      title: "Náklad bez pojištění",
      description: "Jeden převoz nemá ochranu ani štěstí. Přesně takový věci mám rád.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 18,
      reward: {
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_73",
      agentId: "victor",
      title: "Páka na účetního",
      description: "Účetní nejsou tvrdí. Jen vypadají draze. Stlač ho a pustí víc, než čekáš.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1500,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_74",
      agentId: "victor",
      title: "Betonová lekce",
      description: "Dneska někdo pochopí, že beton je tvrdší než jeho ego. Ty budeš ten překlad.",
      difficulty: "hard",
      successRate: 67,
      durationMinutes: 22,
      reward: {
        influence: 8,
        cash: 800
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_75",
      agentId: "victor",
      title: "Špinavý schody",
      description: "Ve vchodu se schází lidi, co zapomněli platit za klid. Připomeň jim sazebník.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        cash: 1244,
        "dirty-cash": 355,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_76",
      agentId: "victor",
      title: "Nedodaná bedna",
      description: "Jeden zákazník dneska nic nedostane. Protože všechno skončí v tvých rukách.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 19,
      reward: {
        "metal-parts": 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_77",
      agentId: "victor",
      title: "Přesun pod tlakem",
      description: "Musíš dostat zásobu přes místo, kde všichni čumí. To je přesně chvíle, kdy se pozná, kdo má nervy.",
      difficulty: "hard",
      successRate: 71,
      durationMinutes: 22,
      reward: {
        cash: 600,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_78",
      agentId: "victor",
      title: "Vyrvaná jistota",
      description: "Jeden člověk je moc v pohodě. A pohodlí na ulici bývá dočasná věc.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 1e3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_79",
      agentId: "victor",
      title: "Nabouraný převoz",
      description: "Nehoda se dá zařídit různě. Hlavní je, aby po ní zůstalo něco použitelného.",
      difficulty: "hard",
      successRate: 72,
      durationMinutes: 22,
      reward: {
        "metal-parts": 6,
        cash: 700,
        influence: 2
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_80",
      agentId: "victor",
      title: "Půlnoční výběrčí",
      description: "Po půlnoci bývají lidi štědřejší. Hlavně když mají důvod se bát odmítnout.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 18,
      reward: {
        cash: 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_81",
      agentId: "victor",
      title: "Cizí železo",
      description: "V dílně zůstalo pár kusů železa bez dozoru. Tak tam nechoď pro dovolení.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        "metal-parts": 6,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_82",
      agentId: "victor",
      title: "Vysoký tlak, nízký hlas",
      description: "Někdo mluví moc nahlas o věcech, co by měly zůstat pod stolem. Ztiš ho.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_83",
      agentId: "victor",
      title: "Slepý roh",
      description: "Na slepým rohu se dneska ztratí jedna zásilka a několik iluzí.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        cash: 600,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_84",
      agentId: "victor",
      title: "Rozjetej motor",
      description: "Motor běží, řidič je nervózní a náklad je cennej. Stačí být rychlejší než panika.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 18,
      reward: {
        cash: 1200,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_85",
      agentId: "victor",
      title: "Pevná ruka",
      description: "Někdy je rozdíl mezi chaosem a respektem jen v tom, kdo drží situaci za krk.",
      difficulty: "hard",
      successRate: 66,
      durationMinutes: 22,
      reward: {
        influence: 8,
        cash: 700
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_86",
      agentId: "victor",
      title: "Podlomený obchod",
      description: "Jeden podnik dneska vydělá míň, než čekal. Protože část zisku půjde domů s tebou.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1219,
        cash: 380,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_87",
      agentId: "victor",
      title: "Špatně zamčený box",
      description: "Box je zamčenej jen pro slušný lidi. Ty tam nejdeš slušně.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 15,
      reward: {
        "dirty-cash": 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_88",
      agentId: "victor",
      title: "Řeči z okna",
      description: "Někdo se dívá z okna a myslí si, že je mimo hru. Připomeň mu, že ulice sahá výš.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_89",
      agentId: "victor",
      title: "Kyselý náklad",
      description: "Jedna várka chemie se má ztratit cestou. Tak jí pomoz zmizet správným směrem.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        cash: 500,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_90",
      agentId: "victor",
      title: "Příliš klidný klub",
      description: "Ten klub je dneska až moc v klidu. Udělej tam takovej tlak, aby se začalo platit za ticho.",
      difficulty: "hard",
      successRate: 70,
      durationMinutes: 23,
      reward: {
        "dirty-cash": 1900,
        influence: 4
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_91",
      agentId: "victor",
      title: "Rozbitý stůl",
      description: "Když se rozbije stůl, často se otevřou i kapsy. Využij obojí.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        cash: 1400,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_92",
      agentId: "victor",
      title: "Přeseknutá dohoda",
      description: "Někdo si myslí, že může obchodovat bez povolení. Dneska zjistí, že povolení vypadá jako ty.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 19,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_93",
      agentId: "victor",
      title: "Kufr plný problémů",
      description: "V kufru je víc problémů než oblečení. Otevři ho a změň problémy na zásoby.",
      difficulty: "hard",
      successRate: 65,
      durationMinutes: 24,
      reward: {
        "metal-parts": 2,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_94",
      agentId: "victor",
      title: "Kroky ve skladu",
      description: "Sklad dneska nebude tichej. A po tvým odchodu nebude ani plnej.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 18,
      reward: {
        "metal-parts": 5,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_95",
      agentId: "victor",
      title: "Poslední varování",
      description: "Někdo už jedno varování dostal. Teď dostane takový, co se nedá přeslechnout.",
      difficulty: "hard",
      successRate: 68,
      durationMinutes: 22,
      reward: {
        influence: 8,
        cash: 900
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_96",
      agentId: "victor",
      title: "Vlhký bankovky",
      description: "U přístavu se dneska lepí bankovky na špatný ruce. Ty máš zařídit, aby se lepily na správný.",
      difficulty: "hard",
      successRate: 72,
      durationMinutes: 22,
      reward: {
        "dirty-cash": 2100,
        influence: 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "victor_97",
      agentId: "victor",
      title: "Odtržená směna",
      description: "Jedna parta dneska nedokončí směnu v pohodě. A ty z toho vytáhneš, co půjde.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 17,
      reward: {
        cash: 1e3,
        "metal-parts": 4,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_98",
      agentId: "victor",
      title: "Tvrdý přepočet",
      description: "Když se špatně přepočítáš na ulici, někdo jiný si to spočítá za tebe. Jdi jim pomoct s matematikou.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 18,
      reward: {
        cash: 1500,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_99",
      agentId: "victor",
      title: "Díra v plotě",
      description: "Každý plot má slabý místo. A za každým slabým místem bývá něco, co se dá odnést.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "victor_100",
      agentId: "victor",
      title: "Victorův podpis",
      description: "Tohle není jen další práce. Tohle je připomínka všem v okolí, kdo má v ulicích poslední slovo.",
      difficulty: "hard",
      successRate: 62,
      durationMinutes: 27,
      reward: {
        influence: 8,
        "dirty-cash": 1500,
        "metal-parts": 3
      },
      risk: {
        successHeat: 4,
        failureHeat: 10,
        failureDirtyCashLoss: 400
      }
    },
    {
      id: "leon_01",
      agentId: "leon",
      title: "Kšeft z kufru",
      description: "Na parkovišti stojí kufr plnej věcí, co oficiálně neexistujou. Přijeď, zaplať správně a zmiz dřív, než se někdo začne ptát.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        "metal-parts": 4,
        chemicals: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_02",
      agentId: "leon",
      title: "Levný zboží, drahý následky",
      description: "Mám deal, kterej smrdí už z dálky. Ale marže je krásná. Vem to, než to někdo vyžere před tebou.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        cash: 1120,
        "dirty-cash": 480
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_03",
      agentId: "leon",
      title: "Kontakt ze zadní uličky",
      description: "Jeden můj kontakt chce mluvit jen venku, mezi odpadkama a špínou. Což většinou znamená, že nabídka stojí za to.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 4,
        chemicals: 4,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_04",
      agentId: "leon",
      title: "Přeprodej bez otázek",
      description: "Dostaneš zboží. Neptáš se odkud je. Jen ho otočíš rychle a draze. Přesně tak se vydělává ve městě.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_05",
      agentId: "leon",
      title: "Špinavý kontakt",
      description: "Jeden kontakt je nervózní a chce se něčeho zbavit. Ty budeš ten, kdo mu uleví od nákladu i od peněz.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        cash: 700,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_06",
      agentId: "leon",
      title: "Zboží pod pultem",
      description: "Ve výloze nic není. Ale pod pultem leží věci, kvůli kterým se vyplatí přijít zadním vchodem.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 16,
      reward: {
        cash: 500,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_07",
      agentId: "leon",
      title: "Rychlá otočka",
      description: "Koupíš levně, prodáš rychle, zmizíš dřív, než někdo zjistí, že byl právě obranej. Klasika.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        cash: 789,
        "dirty-cash": 210
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_08",
      agentId: "leon",
      title: "Zásilka bez jména",
      description: "Přijde bedna bez jména, bez papírů a bez výmluv. To bývají ty nejlepší obchody.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        "metal-parts": 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_09",
      agentId: "leon",
      title: "Přehazovačka",
      description: "Dvě party si mají předat zboží. Ty zařídíš, aby po cestě změnilo majitele i cenu.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_10",
      agentId: "leon",
      title: "Sleva za ticho",
      description: "Jeden prodejce udělá hezkou cenu. Protože ví, že když ji neudělá, může přestat prodávat úplně.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        "velvet-smoke": 1,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_11",
      agentId: "leon",
      title: "Noční burza",
      description: "Po půlnoci se otevírá trh pro lidi, co nechtějí účtenky. Tam chodí skutečný peníze.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 17,
      reward: {
        cash: 1252,
        "dirty-cash": 347
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_12",
      agentId: "leon",
      title: "Falešný prostředník",
      description: "Jedna schůzka potřebuje prostředníka. Ty budeš ten prostředník. A taky ten, kdo si ukousne největší část.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        influence: 3,
        cash: 1e3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_13",
      agentId: "leon",
      title: "Drahá adresa",
      description: "Někdy neprodáváš zboží. Někdy prodáváš jen to, že víš, kam jít a na koho zatlačit.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_14",
      agentId: "leon",
      title: "Kradený kov",
      description: "Mám partu, co tahá kov z míst, kde už ho nikdo nebude postrádat. Otoč to na trhu, než vystydne stopa.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        "metal-parts": 6,
        cash: 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_15",
      agentId: "leon",
      title: "Kapsy plný marže",
      description: "Dneska nejde o sílu. Dneska jde o to, kdo vytěží víc z cizí blbosti. A to jsi ty.",
      difficulty: "easy",
      successRate: 90,
      durationMinutes: 12,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_16",
      agentId: "leon",
      title: "Podivný léky",
      description: "Někdo prodává farmaceutický zásoby bokem. Kvalita pochybná, zisk krásnej. Takže to bereme.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 18,
      reward: {
        chemicals: 6,
        cash: 40
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_17",
      agentId: "leon",
      title: "Překupník v běhu",
      description: "Jeden malej překupník panikaří a chce všechno střelit hned. Vezmi mu to za směšnou cenu.",
      difficulty: "easy",
      successRate: 91,
      durationMinutes: 11,
      reward: {
        cash: 300,
        "metal-parts": 3,
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_18",
      agentId: "leon",
      title: "Druhá ruka, první zisk",
      description: "Tohle zboží už někdo vlastnil. A teď ho budeš vlastnit ty. Krátce. Než ho prodáš ještě dráž.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 16,
      reward: {
        "dirty-cash": 900,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_19",
      agentId: "leon",
      title: "Směna ve tmě",
      description: "Žádný světla, žádný jména, žádný potvrzení. Jen deal a rychlý ruce.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        "velvet-smoke": 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_20",
      agentId: "leon",
      title: "Kontakt z druhý strany města",
      description: "Mám tip z části města, kam normálně nechodíš. Což je přesně důvod, proč tam leží prachy.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 5,
        cash: 1100
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_21",
      agentId: "leon",
      title: "Nadupaná přirážka",
      description: "Někdo něco zoufale potřebuje. A zoufalství je jen jiný slovo pro vyšší cenu.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_22",
      agentId: "leon",
      title: "Kšeft mezi popelnicema",
      description: "Když se velký peníze řeší mezi popelnicema, většinou z toho něco kápne i bokem. Dneska hodně.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1480,
        chemicals: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_23",
      agentId: "leon",
      title: "Dveře bez cedule",
      description: "Za jedněma neoznačenýma dveřma čeká nabídka, co se nebude opakovat. Buď první uvnitř.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        "tech-core": 1,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_24",
      agentId: "leon",
      title: "Tichý přepočet",
      description: "Někdo se přepočítal v náš prospěch. A ty mu teď pomůžeš tu chybu už nenapravit.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        cash: 750,
        "dirty-cash": 250
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_25",
      agentId: "leon",
      title: "Otoč to, než to shnije",
      description: "Jedna várka je horká, jedna špinavá a jedna se kazí. Neřeš která je která. Prostě to otoč.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        chemicals: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_26",
      agentId: "leon",
      title: "Fix za fixem",
      description: "Dneska neprodáváš věc. Dneska prodáváš řešení. A řešení ve městě bývají dražší než kulky.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 1200
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_27",
      agentId: "leon",
      title: "Sektorovej překup",
      description: "Co je levný v jednom sektoru, je drahý v druhým. A ty budeš ten most mezi chamtivostí a nouzí.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_28",
      agentId: "leon",
      title: "Balíček pro nervózního klienta",
      description: "Klient chce diskrétnost. To znamená vyšší cenu a rychlejší nohy. Obojí máš.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        cash: 800,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_29",
      agentId: "leon",
      title: "Cizí problém, náš zisk",
      description: "Někdo má moc zboží, málo času a nulovou páteř. Přesně z takových se žije nejlíp.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        "metal-parts": 5,
        cash: 700,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_30",
      agentId: "leon",
      title: "Pouliční licence",
      description: "Na tomhle bloku nikdo neprodává bez toho, aby něco neodvedl. Dneska vybíráš ty.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        cash: 1120,
        "dirty-cash": 480,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_31",
      agentId: "leon",
      title: "Zlomený řetězec",
      description: "Jeden dodavatelský řetězec právě praskl. A ty posbíráš, co z něj vypadne na zem.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        chemicals: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_32",
      agentId: "leon",
      title: "Přestřelená cena",
      description: "Někdo chce moc. Ty mu zaplatíš málo. A ještě na tom vyděláš. Tomu říkám obchod.",
      difficulty: "easy",
      successRate: 90,
      durationMinutes: 11,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_33",
      agentId: "leon",
      title: "Tichý runner",
      description: "Potřebuju, aby něco přešlo přes tři bloky a nikdo to nezastavil. Žádná sláva, jen čistý profit.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_34",
      agentId: "leon",
      title: "Výprodej strachu",
      description: "Když začne někdo panikařit, prodává hluboko pod cenou. A my jsme přesně ti, co to umí využít.",
      difficulty: "easy",
      successRate: 91,
      durationMinutes: 12,
      reward: {
        "metal-parts": 4
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_35",
      agentId: "leon",
      title: "Spodní police",
      description: "To nejlepší zboží nebývá na očích. Bývá dole, za plentou, mezi věcma bez původu.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        "velvet-smoke": 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_36",
      agentId: "leon",
      title: "Dohoda na rohu",
      description: "Na rohu čeká deal. Malej stůl, špinavý ruce, velký peníze. Nezvor to.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_37",
      agentId: "leon",
      title: "Sběrač marže",
      description: "Dva blbci se hádají o cenu. Ty přijdeš mezi ně a odejdeš s největším kusem.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_38",
      agentId: "leon",
      title: "Krabice bez původu",
      description: "Mám tři krabice. Jedna je legální, druhá ne a třetí je nejlepší neotvírat. Vezmi všechny.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        chemicals: 3,
        "metal-parts": 3,
        cash: 220
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_39",
      agentId: "leon",
      title: "Pouliční arbitráž",
      description: "Jedna strana má zboží, druhá peníze a obě mají málo mozku. Ty z toho vytěžíš nejvíc.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        cash: 818,
        "dirty-cash": 181
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_40",
      agentId: "leon",
      title: "Tlačenice o bedny",
      description: "Došlo pár beden a pár lidí po nich skočí. Ty skočíš rychlejc a prodáš je s přirážkou.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        "tech-core": 1,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_41",
      agentId: "leon",
      title: "Klient bez nervů",
      description: "Můj klient se sype a chce všechno hned. Tak mu to dej. Ale draho.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        cash: 750,
        "dirty-cash": 250
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_42",
      agentId: "leon",
      title: "Zadní schodiště",
      description: "Na zadním schodišti se dneska budou měnit ruce, kapsy a loajalita. Buď u toho první.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 5,
        cash: 1e3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_43",
      agentId: "leon",
      title: "Přeskládání trhu",
      description: "Jedna várka zmizí z trhu a jiná se objeví za dvojnásobek. Krása volný ulice.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 17,
      reward: {
        cash: 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_44",
      agentId: "leon",
      title: "Vypůjčený sklad",
      description: "Na pár minut si půjčíš cizí sklad. Na pár hodin z něj budeš žít.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 18,
      reward: {
        "metal-parts": 6,
        chemicals: 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_45",
      agentId: "leon",
      title: "Nelegální přirážka",
      description: "Některý věci jsou drahý proto, že jsou vzácný. Jiný proto, že za ně můžeš skončit v problému. Tohle je ten druhý případ.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 19,
      reward: {
        cash: 800,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_46",
      agentId: "leon",
      title: "Šeptaná nabídka",
      description: "Když někdo šeptá cenu, většinou ví, že je buď moc dobrá, nebo moc špinavá. Mně jsou sympatický obě možnosti.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 15,
      reward: {
        "dirty-cash": 1500,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_47",
      agentId: "leon",
      title: "Pouliční broker",
      description: "Dneska seš prostředník mezi hladovejma rukama a plným bednama. A prostředník bere vždycky první kus.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_48",
      agentId: "leon",
      title: "Přepálený zájem",
      description: "Když někdo něco chce až moc, přestává řešit cenu. A přesně v tu chvíli přicházíš ty.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_49",
      agentId: "leon",
      title: "Černý seznam kontaktů",
      description: "Mám seznam jmen, adres a slabin. Nechci ho celý. Stačí mi, když z něj vytěžíš maximum.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_50",
      agentId: "leon",
      title: "Leonův řez",
      description: "Pamatuj si to. V tomhle městě nevyhrává ten, kdo něco má. Vyhrává ten, kdo si z každýho kšeftu ukousne největší kus. Dneska to budeš ty.",
      difficulty: "rare",
      successRate: 65,
      durationMinutes: 25,
      reward: {
        "overdrive-x": 1,
        "dirty-cash": 500
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    },
    {
      id: "leon_51",
      agentId: "leon",
      title: "Krabice od špíny",
      description: "Na kraji sektoru čeká pár beden, co už prošly moc rukama. Smrdí, jsou kradený a přesně proto na nich vyděláš nejvíc.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        "metal-parts": 5,
        chemicals: 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_52",
      agentId: "leon",
      title: "Obchod se strachem",
      description: "Jeden malej dealer se bojí, že ho někdo obere. Nabídni mu ochranu. Drahou, špinavou a povinnou.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 15,
      reward: {
        cash: 1500,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_53",
      agentId: "leon",
      title: "Přesunutá zásilka",
      description: "Jedna zásilka má dojet jinam. Ty zařídíš, že skončí u nás. Bez hluku, bez výčitek, se ziskem.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        chemicals: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_54",
      agentId: "leon",
      title: "Vysátý sklad",
      description: "Ve skladu zůstalo víc, než měl majitel přiznat. Tak mu pomůžeme s inventurou po svým.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 19,
      reward: {
        "metal-parts": 6,
        cash: 400,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_55",
      agentId: "leon",
      title: "Cena za mlčení",
      description: "Někdo viděl víc, než měl. Nech ho pochopit, že ticho je levnější než nemocnice.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 16,
      reward: {
        "dirty-cash": 1400,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_56",
      agentId: "leon",
      title: "Přeprodej krve",
      description: "Po jednom špinavým střetu zůstalo na zemi vybavení. Posbírej to a otoč to, než zaschne krev.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 18,
      reward: {
        "metal-parts": 3,
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_57",
      agentId: "leon",
      title: "Mokrej deal u kanálu",
      description: "U kanálu se mají měnit ruce, peníze a loajalita. Dohlídni, aby všechno skončilo v našich kapsách.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1600,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_58",
      agentId: "leon",
      title: "Špatná adresa, dobrý zisk",
      description: "Jedna zásilka půjde na špatnou adresu. A ta adresa bude naše. Někdy je logistika krásná věc.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        chemicals: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_59",
      agentId: "leon",
      title: "Rozprodej paniky",
      description: "Když se někdo začne bát razie, prodá i vlastní boty. Kup levně všechno, co pustí z ruky.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 13,
      reward: {
        "metal-parts": 4
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_60",
      agentId: "leon",
      title: "Špinavé procento",
      description: "Dva idioti chtějí udělat obchod. Ty jim ho umožníš. A ukousneš si takovej podíl, že je to bude bolet až doma.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 14,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_61",
      agentId: "leon",
      title: "Bedny z rozbité dodávky",
      description: "Na krajnici stojí dodávka, co nedojela. Někdo brečí nad plechem, ty vyděláš na obsahu.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 16,
      reward: {
        chemicals: 1,
        "metal-parts": 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_62",
      agentId: "leon",
      title: "Šelma mezi překupníky",
      description: "Na trhu je moc hladových krys. Buď největší z nich a stáhni jim nejlepší kusy přímo před nosem.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 15,
      reward: {
        cash: 1219,
        "dirty-cash": 380,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_63",
      agentId: "leon",
      title: "Kontakty v bordelu",
      description: "Nejlepší informace neleží v kanceláři. Leží v zakouřeným bordelu mezi lidma, co mluví, když si myslí, že jsou v bezpečí.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_64",
      agentId: "leon",
      title: "Levný kulky, drahá noc",
      description: "Někdo se chce zbavit železa, než přijde kontrola. Seber to levně a pošli dál ještě před svítáním.",
      difficulty: "medium",
      successRate: 73,
      durationMinutes: 19,
      reward: {
        cash: 700,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_65",
      agentId: "leon",
      title: "Kapsářský velkoobchod",
      description: "Malej zloděj ukradl víc, než zvládne prodat. Tak ho odlehči. Klidně i od iluzí.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        cash: 300,
        "metal-parts": 3,
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_66",
      agentId: "leon",
      title: "Přehoz přes sektor",
      description: "V jednom sektoru je bída, v druhým hlad. Ty propojíš jedno s druhým a zbytek shrábneš.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_67",
      agentId: "leon",
      title: "Ostrá přirážka",
      description: "Klient chce zboží hned. To znamená jediný: zvedni cenu, usměj se a nech ho krvácet do peněženky.",
      difficulty: "easy",
      successRate: 90,
      durationMinutes: 11,
      reward: {
        cash: 863,
        "dirty-cash": 136
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_68",
      agentId: "leon",
      title: "Zadní pokoj",
      description: "V zadním pokoji se dneska budou přehazovat věci, co neměly opustit sklad. Dohlídni, aby opustily i majitele.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        chemicals: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_69",
      agentId: "leon",
      title: "Srážka zájmů",
      description: "Dvě party chtějí to samý zboží. Ty jim prodáš naději, chaos a nakonec to zinkasuješ celý.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        cash: 1600,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_70",
      agentId: "leon",
      title: "Oškrabaná marže",
      description: "Na dealu už si ukousli jiní. Ty z toho seškrábneš poslední vrstvu. A ta bývá nejtučnější.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        "dirty-cash": 750,
        cash: 250
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_71",
      agentId: "leon",
      title: "Výprodej slabosti",
      description: "Někdo potřebuje rychle cash a prodá všechno pod cenou. Ty potřebuješ jen přijít včas a bejt bez slitování.",
      difficulty: "easy",
      successRate: 92,
      durationMinutes: 12,
      reward: {
        "metal-parts": 4
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_72",
      agentId: "leon",
      title: "Rozsypaný lékárenský zboží",
      description: "Po jedný hádce zůstalo pár beden z lékárny bez dozoru. Posbírej to a prodej to dřív, než se majitel probere.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        chemicals: 6,
        cash: 40
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_73",
      agentId: "leon",
      title: "Prašivej broker",
      description: "Dneska nebudeš obchodník. Dneska budeš hyena s kontakty. A hyeny se v tomhle městě nají nejlíp.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_74",
      agentId: "leon",
      title: "Dohoda v dešti",
      description: "Když prší, lidi méně koukají. To je ideální chvíle poslat špinavý zboží přes půl bloku.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        "velvet-smoke": 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_75",
      agentId: "leon",
      title: "Výběr od zoufalců",
      description: "Dneska neokradeš bohatý. Dneska vytěžíš zoufalý. A zoufalí platí nejrychlejc.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        "dirty-cash": 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_76",
      agentId: "leon",
      title: "Překup za rozbitým barem",
      description: "Za jedním rozbitým barem čeká týpek s věcma, co by oficiálně měly být zamčený jinde. Tak je oficiálně přesuň k nám.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        chemicals: 2,
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_77",
      agentId: "leon",
      title: "Křivá směnka",
      description: "Někdo se upsál špatným lidem. Ty od něj koupíš dluh za drobný a vybereš ho jako plnou cenu.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        cash: 1309,
        "dirty-cash": 290,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_78",
      agentId: "leon",
      title: "Špinavý přepočet beden",
      description: "Na papíře jich je deset. Ve skutečnosti jich může zmizet dvanáct. Takovej účetnictví já respektuju.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        "metal-parts": 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_79",
      agentId: "leon",
      title: "Přepálený zájemce",
      description: "Jeden kupec chce zboží tak moc, že už necítí pach podrazu. Přesně takový mám nejradši.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 11,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_80",
      agentId: "leon",
      title: "Rozřezaná trasa",
      description: "Běžná přepravní trasa je dneska mrtvá. Vezmeš náklad bokem a z marže uděláš malý svinstvo.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 14,
      reward: {
        "metal-parts": 4
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_81",
      agentId: "leon",
      title: "Sektorový pijavice",
      description: "Na každým sektoru visí někdo, kdo už saje moc dlouho. Dneska ho odsajeme my.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        "dirty-cash": 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_82",
      agentId: "leon",
      title: "Levná bolest, drahý zisk",
      description: "Někdo prodá cennej materiál jen proto, aby přežil noc. Ty si z jeho bolesti uděláš obchodní model.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        influence: 2
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_83",
      agentId: "leon",
      title: "Kufr po mrtvým dealu",
      description: "Po jednom zpackaným setkání zůstal kufr bez dozoru. Otevři ho a udělej z cizího průseru náš profit.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 18,
      reward: {
        "dirty-cash": 900,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_84",
      agentId: "leon",
      title: "Prodej přes bolest",
      description: "Někdy nestačí nabídnout cenu. Někdy musíš nabídnout i důvod, proč ji mají přijmout bez keců.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 15,
      reward: {
        cash: 1600,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_85",
      agentId: "leon",
      title: "Rozebranej kontejner",
      description: "V přístavu někdo otevřel, co otevřít neměl. Posbírej zbytky a pošli je dál, než přijdou uniformy.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 19,
      reward: {
        "metal-parts": 6,
        chemicals: 1
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_86",
      agentId: "leon",
      title: "Pobodaná nabídka",
      description: "Jeden obchod skončil nožem ve stole. To znamená dvě věci: méně zájemců a víc prostoru pro nás.",
      difficulty: "medium",
      successRate: 74,
      durationMinutes: 18,
      reward: {
        cash: 700,
        "dirty-cash": 400
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_87",
      agentId: "leon",
      title: "Otočka přes špínu",
      description: "Tohle zboží je tak špinavý, že by si zasloužilo vlastní kanalizaci. Přesně proto má krásnou marži.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        chemicals: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_88",
      agentId: "leon",
      title: "Rozšlapaný kontakt",
      description: "Jeden kontakt dostal přes hubu a chce zmizet. Nech ho zmizet. Ale nejdřív z něj vytáhni všechno cenný.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_89",
      agentId: "leon",
      title: "Přesun černé várky",
      description: "Várka je horká, sektor nervózní a čas krátkej. Přesuň to, než se někdo začne zajímat moc.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        chemicals: 4,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_90",
      agentId: "leon",
      title: "Drahý mlčení u stolu",
      description: "U jednoho stolu sedí lidi, co by spolu normálně nemluvili. Ty jim pomůžeš najít společnou řeč. Za velmi nepříjemnou cenu.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        cash: 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_91",
      agentId: "leon",
      title: "Prohnilý deal",
      description: "Ten kšeft je prohnilej od základu. Ale i z prohnilýho dřeva se dá postavit pěkně hnusnej zisk.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        "dirty-cash": 800,
        cash: 200
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_92",
      agentId: "leon",
      title: "Tahání za nitky",
      description: "Dneska nebudeš tahat bedny. Dneska budeš tahat lidi. A lidi se prodávají ještě líp než zboží.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 1e3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_93",
      agentId: "leon",
      title: "Sklad pro krysy",
      description: "Jeden sklad je tak děravej, že si z něj bere každej. Dneska si z něj vezmeme nejvíc my.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        "metal-parts": 6,
        cash: 400,
        influence: 2
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_94",
      agentId: "leon",
      title: "Zuby trhu",
      description: "Trh není místo pro obchodníky. Je to místo pro predátory. Tak koukej kousat.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "leon_95",
      agentId: "leon",
      title: "Rozkradený papíry",
      description: "Některý zásilky cestují díky razítku. Dneska se postaráš, aby papíry zmizely a zboží zůstalo nám.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        "tech-core": 1,
        influence: 3
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_96",
      agentId: "leon",
      title: "Překupnický masakr",
      description: "Na jednom rohu se dneska roztrhá několik překupníků o stejnou věc. Ty to vezmeš první a prodáš jim to zpátky dráž.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        cash: 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_97",
      agentId: "leon",
      title: "Vydřená marže",
      description: "Tohle nebude hezkej obchod. Tohle bude špinavý, tvrdý a přesně tak výdělečný, jak to mám rád.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        "dirty-cash": 1600,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_98",
      agentId: "leon",
      title: "Dodávka z pekla",
      description: "Jedna dodávka veze tolik bordelu, že by ji nikdo neměl vidět. Postarej se, aby ji nikdo ani nedopočítal.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 19,
      reward: {
        chemicals: 1,
        "metal-parts": 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_99",
      agentId: "leon",
      title: "Řez z každý kapsy",
      description: "Dneska nebudeš brát jen z jednoho zdroje. Dneska si ukousneš z každý kapsy, co se v sektoru pohne.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 16,
      reward: {
        cash: 1280,
        "dirty-cash": 320,
        influence: 4
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "leon_100",
      agentId: "leon",
      title: "Leonova špinavá škola",
      description: "Zapamatuj si to. Ulice nepatří tomu, kdo má čistý ruce. Patří tomu, kdo umí z každýho svinstva udělat zisk. Dneska budeš učit ostatní.",
      difficulty: "rare",
      successRate: 65,
      durationMinutes: 25,
      reward: {
        "ghost-serum": 1,
        "dirty-cash": 500
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    },
    {
      id: "nyra_01",
      agentId: "nyra",
      title: "Špatně zamčený telefon",
      description: "Jeden idiot nechal telefon bez dozoru a bez zámku. Vezmi z něj všechno, co se dá prodat, zneužít nebo poslat správným lidem.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        influence: 3,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_02",
      agentId: "nyra",
      title: "Šeptaná slabina",
      description: "V každém sektoru je někdo, kdo ví příliš moc a pije příliš levně. Sedni si k němu a nech ho mluvit.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 13,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_03",
      agentId: "nyra",
      title: "První lež zdarma",
      description: "Rozšiř mezi správné uši malou lež. Když se chytne, ostatní udělají zbytek práce za tebe.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_04",
      agentId: "nyra",
      title: "Fotka, která bolí",
      description: "Jedna fotka má větší váhu než zásobník. Získej ji a pak sleduj, jak rychle se mění loajalita za ticho.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_05",
      agentId: "nyra",
      title: "Odcizený seznam",
      description: "Někdo si vede seznam jmen, adres a dluhů. Ten seznam dnes změní majitele. A s ním i půlku města.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_06",
      agentId: "nyra",
      title: "Cizí paranoia",
      description: "Není třeba někoho zničit. Stačí, aby začal pochybovat o lidech kolem sebe. To už zvládne rozebrat zbytek sám.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_07",
      agentId: "nyra",
      title: "Ztracený přístup",
      description: "Jeden přístupový kód se má ztratit. Ty se postaráš, aby se ztratil správnému člověku do kapsy.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 4,
        cash: 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_08",
      agentId: "nyra",
      title: "Vydírání bez hlasu",
      description: "Někdy není potřeba říct ani slovo. Jen poslat správný důkaz na správné místo a počkat, kdo přijde platit první.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        "dirty-cash": 1200,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_09",
      agentId: "nyra",
      title: "Nastražená zpráva",
      description: "Pošli jednu zprávu tak, aby vypadala, že přišla od někoho jiného. Lidi jsou překvapivě ochotní si ničit životy sami.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_10",
      agentId: "nyra",
      title: "Tichá výměna",
      description: "Na střeše proběhne výměna informací. Ty se neukážeš. Jen zajistíš, že jedna strana odejde chudší a druhá vyděšená.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 5,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_11",
      agentId: "nyra",
      title: "Rozbitá důvěra",
      description: "Dva lidi si ještě pořád věří. To je chyba, kterou dnes opravíš.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_12",
      agentId: "nyra",
      title: "Záznam z chodby",
      description: "Na jedné chodbě visí kamera, která viděla víc, než by měla. Stáhni záznam dřív, než ho smaže někdo jiný.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 700,
        "dirty-cash": 300
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_13",
      agentId: "nyra",
      title: "Toxický drb",
      description: "Jedna dobře vypuštěná informace dokáže otrávit celý sektor. Vypusť ji jemně a sleduj, kdo se začne dusit první.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        influence: 6,
        "dirty-cash": 500
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_14",
      agentId: "nyra",
      title: "Dívka u baru",
      description: "Některé dveře neotevře páčidlo, ale úsměv a dvě správné otázky. Dnes otevřeš právě takové.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_15",
      agentId: "nyra",
      title: "Složka bez jména",
      description: "V jedné zásuvce leží složka, která nemá existovat. Vezmi ji a připomeň městu, že papír někdy řeže hlouběji než nůž.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_16",
      agentId: "nyra",
      title: "Podvržený podpis",
      description: "Stačí jeden podpis na špatném místě a někdo se probudí s hodně drahým problémem.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        cash: 1e3,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_17",
      agentId: "nyra",
      title: "Noční odposlech",
      description: "Na jednu noc zapojíš uši tam, kam nepatří. To, co zachytíš, prodáš třikrát různým lidem.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 18,
      reward: {
        "dirty-cash": 1100,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_18",
      agentId: "nyra",
      title: "Jméno na seznamu",
      description: "Jedno jméno se objeví na špatném seznamu. A pak už jen sleduj, jak rychle začne jeho majitel panikařit.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_19",
      agentId: "nyra",
      title: "Špína v archivu",
      description: "Nejlepší tajemství nejsou na ulici. Jsou uložená, seřazená a čekají, až je někdo použije správným způsobem.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_20",
      agentId: "nyra",
      title: "Falešná stopa",
      description: "Naveď lovce na špatnou adresu a kořist zůstane bez dozoru. Krása manipulace je v tom, že nikdo neví, kdo začal.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        cash: 900,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_21",
      agentId: "nyra",
      title: "Cizí heslo",
      description: "Někdo používá stejné heslo všude. Smutné. Ale výdělečné.",
      difficulty: "easy",
      successRate: 90,
      durationMinutes: 11,
      reward: {
        influence: 3,
        cash: 727,
        "dirty-cash": 272
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_22",
      agentId: "nyra",
      title: "Přítelkyně problému",
      description: "Dnes se nebudeš prát. Dnes někomu nabídneš řešení, které ho udělá závislým na další schůzce s námi.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_23",
      agentId: "nyra",
      title: "Šepot na schodišti",
      description: "Na schodišti se dnes řekne něco, co nemělo nikdy zaznít nahlas. Ty budeš stát dost blízko, aby to mělo cenu.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 700
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_24",
      agentId: "nyra",
      title: "Zkažený deal",
      description: "Není třeba obchod zastavit. Stačí ho jen trochu pokazit, aby se obě strany začaly navzájem podezírat.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_25",
      agentId: "nyra",
      title: "Sklenička navíc",
      description: "Lidi po třetí skleničce říkají věci, za které by ráno platili. Ty jim tu šanci dáš.",
      difficulty: "easy",
      successRate: 91,
      durationMinutes: 11,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_26",
      agentId: "nyra",
      title: "Zamčená minulost",
      description: "Každý má minulost, kterou by nejradši utopil. Ty ji jen vytáhneš na hladinu a nabídneš ručník za správnou cenu.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1300,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_27",
      agentId: "nyra",
      title: "Slabé místo aliance",
      description: "Každá aliance má člena, co drží hubu jen do chvíle, než dostane správnou nabídku. Najdi ho.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_28",
      agentId: "nyra",
      title: "Cizí deník",
      description: "Papír snese všechno. A některé papíry snesou dost na to, aby někdo začal platit pravidelně.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_29",
      agentId: "nyra",
      title: "Otrávené podezření",
      description: "Stačí zasít malou pochybnost a sledovat, jak si ji lidi zalijí vlastní panikou.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_30",
      agentId: "nyra",
      title: "Tichá výstraha",
      description: "Ne všichni potřebují dostat přes hubu. Některým stačí obálka bez odesílatele a špatný spánek na týden dopředu.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_31",
      agentId: "nyra",
      title: "Přesměrovaná nenávist",
      description: "Dneska někoho nenasměruješ k cíli. Nasměruješ ho k omylu. A omyly v našem městě bývají smrtelně drahé.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_32",
      agentId: "nyra",
      title: "Stará hlasová schránka",
      description: "Někdo zapomněl smazat hlasovky. Ty zapomeneš mít slitování.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 12,
      reward: {
        "dirty-cash": 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_33",
      agentId: "nyra",
      title: "Zblízka a bez otisků",
      description: "Potřebuju, abys byl dost blízko na to slyšet pravdu a dost chytrej na to, abys po sobě nic nenechal.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_34",
      agentId: "nyra",
      title: "Lehký dotek chaosu",
      description: "Nebudeme rozbíjet dveře. Jen jemně zatlačíme na správné lidi a zbytek město rozebere samo.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_35",
      agentId: "nyra",
      title: "Smazaná kamera",
      description: "Někde chybí pár minut záznamu. Postarej se, aby chyběly přesně ty, které potřebujeme.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        cash: 900,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_36",
      agentId: "nyra",
      title: "Noční návštěva",
      description: "Dnes někomu necháš za dveřmi důkaz, který tam neměl nikdy být. A pak počkáš, kdo začne křičet první.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_37",
      agentId: "nyra",
      title: "Dva kroky od zrady",
      description: "Zrada nezačíná nožem do zad. Začíná jednou pochybností a správně položenou otázkou.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_38",
      agentId: "nyra",
      title: "Kapesní tajemství",
      description: "Malé USB, velké problémy. Najdi ho a pak rozhodneme, kdo si za jeho návrat zaplatí nejvíc.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        "dirty-cash": 1200,
        influence: 5
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_39",
      agentId: "nyra",
      title: "Rozhovor za plentou",
      description: "Za jednou tenkou stěnou se dnes probere něco, co může rozpárat celý sektor. Naslouchej.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_40",
      agentId: "nyra",
      title: "Podvržená účast",
      description: "Někdo bude vypadat, jako že byl na místě, kde nikdy nestál. A někdo jiný za to zaplatí, aby to zmizelo.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        "dirty-cash": 1100,
        influence: 6
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_41",
      agentId: "nyra",
      title: "Zaměněná obálka",
      description: "Stačí jedna obálka v nesprávných rukách a celý večer dostane nový směr.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        cash: 900,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_42",
      agentId: "nyra",
      title: "Přepnutá loajalita",
      description: "Někteří lidé nejsou věrní. Jen ještě nedostali lepší nabídku. Dnes ji dostanou.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_43",
      agentId: "nyra",
      title: "Křehká pověst",
      description: "Pověst je sklo. Jedna prasklina a zbytek už udělá tlak okolí. Ty uděláš tu prasklinu.",
      difficulty: "medium",
      successRate: 83,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_44",
      agentId: "nyra",
      title: "Vzkaz bez podpisu",
      description: "Pošli vzkaz, který nebude znít jako hrozba. Jen jako něco, co by si chytrý člověk neměl dovolit ignorovat.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        "dirty-cash": 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_45",
      agentId: "nyra",
      title: "Druhé dno šuplíku",
      description: "Vždycky mě zajímá, co lidi schovávají pod tím, co schovávají. Tam bývá skutečná cena.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900,
        "dirty-cash": 300
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_46",
      agentId: "nyra",
      title: "Zlá kombinace",
      description: "Spoj dvě pravdy s jednou lží a dostaneš příběh, který rozbije víc vztahů než pistole kolen.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_47",
      agentId: "nyra",
      title: "Stín za zády",
      description: "Někdo musí mít pocit, že ho někdo sleduje. A ten pocit ho má stát peníze.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        cash: 1e3,
        influence: 3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_48",
      agentId: "nyra",
      title: "Šepot v síti",
      description: "Dnes nevypustíš zprávu do ulic. Dnes ji pustíš do správných kanálů a necháš ji udělat ošklivější práci tiše.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_49",
      agentId: "nyra",
      title: "Pád masky",
      description: "Každý někde hraje roli. Najdi místo, kde se zapomněl převléct zpátky do své lži.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_50",
      agentId: "nyra",
      title: "Nyřin tah",
      description: "Pamatuj si to. Kulka udělá díru. Tajemství udělá prázdno. Dneska v tom prázdnu vyděláme víc než ostatní za celou noc.",
      difficulty: "rare",
      successRate: 65,
      durationMinutes: 25,
      reward: {
        "overdrive-x": 1,
        influence: 8
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    },
    {
      id: "nyra_51",
      agentId: "nyra",
      title: "Druhá obálka",
      description: "První obálka člověka znervózní. Druhá ho připraví o spánek. Doruč tu druhou a nech ho přemýšlet, co všechno ještě víme.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 14,
      reward: {
        influence: 3,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_52",
      agentId: "nyra",
      title: "Prasklina v hlavě",
      description: "Někdy není potřeba někoho zlomit. Stačí mu do hlavy zasadit jednu otázku, která tam začne hnít.",
      difficulty: "medium",
      successRate: 84,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_53",
      agentId: "nyra",
      title: "Cizí hlas ve tmě",
      description: "Jedna zpráva přehraná správným hlasem dokáže rozebrat víc než zbraň. Pošli ji a nech jejich jistoty umřít potichu.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_54",
      agentId: "nyra",
      title: "Ztráta jistoty",
      description: "Dnes nikomu nevezmeš peníze. Dnes mu vezmeš pocit bezpečí. A ten bývá dražší.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_55",
      agentId: "nyra",
      title: "Nespolehlivá vzpomínka",
      description: "Přesvědč někoho, že si pamatuje věc, která se nikdy nestala. Lidi si zbytek lži dopíšou sami.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_56",
      agentId: "nyra",
      title: "Ztracený klid",
      description: "Jedna maličkost zmizí z bytu, druhá se objeví na špatném místě. A najednou začne mít někdo pocit, že už není sám.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_57",
      agentId: "nyra",
      title: "Zrcadlo bez odrazu",
      description: "Každý má obraz sám o sobě. Ty ho dnes rozbiješ a necháš střepy, aby řezaly ještě dlouho potom.",
      difficulty: "medium",
      successRate: 76,
      durationMinutes: 19,
      reward: {
        influence: 6,
        "dirty-cash": 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_58",
      agentId: "nyra",
      title: "Špatná hodina",
      description: "Vzbuď někoho uprostřed noci zprávou, která nedává smysl. Ráno už ho bude rozkládat vlastní představivost.",
      difficulty: "easy",
      successRate: 90,
      durationMinutes: 11,
      reward: {
        influence: 3,
        cash: 700
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_59",
      agentId: "nyra",
      title: "Tenká nitka loajality",
      description: "Důvěra není zeď. Je to nit. A dnes ji stačí jen lehce naříznout.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_60",
      agentId: "nyra",
      title: "Zapomenutý klíč",
      description: "Někdo najde klíč, který nikdy nevlastnil. Přesně od chvíle, kdy ho vezme do ruky, začne přemýšlet, co všechno už někdo otevřel před ním.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        cash: 727,
        "dirty-cash": 272
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_61",
      agentId: "nyra",
      title: "Úsměv a jed",
      description: "Nejhorší rány nepřicházejí v hněvu. Přicházejí s klidem, úsměvem a přesně zvolenou větou.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        influence: 3,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_62",
      agentId: "nyra",
      title: "Hlas na druhém konci",
      description: "Jedno anonymní zavolání. Jeden správný tón. Jeden večer, který už nikdy nebude normální.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_63",
      agentId: "nyra",
      title: "Návštěva bez svědků",
      description: "Někdy stačí, aby někdo zahlédl stín za dveřmi a už si nikdy nebude jistý, jestli byl sám.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_64",
      agentId: "nyra",
      title: "Zpožděná pravda",
      description: "Pravda je nejjedovatější, když přijde pozdě. Doruč ji přesně ve chvíli, kdy už nikdo nebude věřit vysvětlení.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_65",
      agentId: "nyra",
      title: "Křehký dech",
      description: "Připomeň někomu, jak moc snadno se může zlomit jeho svět. Ne silou. Jen přesností.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_66",
      agentId: "nyra",
      title: "Prázdná židle",
      description: "Na schůzce nech jednu židli prázdnou a jednu informaci navíc. Paranoia pak zaplní zbytek místnosti sama.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_67",
      agentId: "nyra",
      title: "Kroky za zády",
      description: "Nech někoho slyšet kroky tam, kde nikdo není. To, co si domyslí, bude horší než skutečnost.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        influence: 6,
        "dirty-cash": 600
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_68",
      agentId: "nyra",
      title: "Rozladěné nervy",
      description: "Rozbij někomu rytmus dne. Jeden telefon ráno, jeden vzkaz večer, jedna cizí věc doma. Pak už se rozbije sám.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 700
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_69",
      agentId: "nyra",
      title: "Otevřená rána",
      description: "Každý má místo, kam se nevrací. Ty ho tam dnes pošleš zpátky, aniž bys se ho dotkla.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_70",
      agentId: "nyra",
      title: "Cizí oči",
      description: "Někdo musí uvěřit, že je sledovaný. Ne proto, že to je pravda. Ale protože strach platí rychleji než důkazy.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_71",
      agentId: "nyra",
      title: "Jemné rozvrácení",
      description: "Nezničíš skupinu útokem. Zničíš ji tím, že si každý začne myslet, že ostatní něco skrývají.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 18,
      reward: {
        influence: 6,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_72",
      agentId: "nyra",
      title: "Jed v tichu",
      description: "Některé věci není třeba říkat nahlas. Stačí je nechat v hlavě správného člověka dost dlouho.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_73",
      agentId: "nyra",
      title: "Noc bez odpovědí",
      description: "Pošli sérii náznaků a pak zmiz. Nejhorší nejsou odpovědi. Nejhorší je, když žádné nepřijdou.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_74",
      agentId: "nyra",
      title: "Přesná slabost",
      description: "Síla je hlučná. Slabost je tichá. Najdi ji, stiskni ji a sleduj, jak se celý člověk ohne kolem ní.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_75",
      agentId: "nyra",
      title: "Porušený rytmus",
      description: "Lidé přežívají díky rutině. Znič ji a zbytek jejich jistot se začne sypat sám.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        influence: 3,
        "dirty-cash": 1e3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_76",
      agentId: "nyra",
      title: "Místnost bez vzduchu",
      description: "Zaveď někoho do rozhovoru, kde nebude moct lhát ani utéct. To bývá nejčistší forma násilí.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_77",
      agentId: "nyra",
      title: "Vzkaz pod kůži",
      description: "Nech zprávu tam, kde ji najde jen ten správný člověk. A kde se jí nebude umět zbavit ani po přečtení.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_78",
      agentId: "nyra",
      title: "Vina bez svědků",
      description: "Dnes nevyvoláš strach. Dnes vyvoláš vinu. A vina člověka rozloží zevnitř mnohem pomaleji a důkladněji.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_79",
      agentId: "nyra",
      title: "Pocit cizí přítomnosti",
      description: "Uprav pár detailů a nech někoho dojít domů do prostoru, který už nebude působit jako jeho vlastní.",
      difficulty: "medium",
      successRate: 82,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_80",
      agentId: "nyra",
      title: "Tichý nátlak",
      description: "Nátlak nemusí křičet. Stačí, když se usadí vedle člověka a dýchá mu na krk celé odpoledne.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        influence: 3,
        cash: 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_81",
      agentId: "nyra",
      title: "Narušený spánek",
      description: "Vyčerpaný člověk se láme snáz. Připrav ho o klidnou noc a ráno už udělá chybu sám.",
      difficulty: "easy",
      successRate: 89,
      durationMinutes: 11,
      reward: {
        influence: 3,
        "dirty-cash": 700
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_82",
      agentId: "nyra",
      title: "Jméno ve špatných ústech",
      description: "Dnes rozšíříš jedno jméno přesně tam, kde ho nikdo nechce slyšet. Škody pak udělá sama jeho ozvěna.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_83",
      agentId: "nyra",
      title: "Dům plný ticha",
      description: "Některá ticha nejsou klidná. Jsou nemocná. Ujisti se, že jedno takové dnes někoho doma počká.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_84",
      agentId: "nyra",
      title: "Úhel pohledu",
      description: "Nepotřebuješ měnit fakta. Stačí změnit pořadí, ve kterém je někdo uslyší. A najednou z pravdy začne téct jed.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 17,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_85",
      agentId: "nyra",
      title: "Cizí otisk",
      description: "Nech na místě něco, co tam nepatří. Člověk si pak zbytek scénáře dopíše sám a většinou mnohem hůř, než bychom vymysleli my.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        influence: 3,
        "dirty-cash": 1e3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_86",
      agentId: "nyra",
      title: "Dvě verze noci",
      description: "Stejný večer, dvě různé verze, tři různí svědci. Až se to začne srážet, nezůstane nikomu pevná půda pod nohama.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_87",
      agentId: "nyra",
      title: "Rozklad jistoty",
      description: "Něčí sebevědomí stojí na jedné představě. Dnes mu ji vezmeš a necháš ho sledovat, jak se rozsype všechno okolo.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_88",
      agentId: "nyra",
      title: "Přesně načasované ticho",
      description: "Někdy je nejkrutější neodpovědět. Dnes necháš ticho pracovat déle, než je pro někoho zdravé.",
      difficulty: "easy",
      successRate: 91,
      durationMinutes: 11,
      reward: {
        influence: 3,
        cash: 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_89",
      agentId: "nyra",
      title: "Neviditelná trhlina",
      description: "Na povrchu nebude vidět nic. Ale uvnitř už začne všechno praskat. To jsou moje oblíbené práce.",
      difficulty: "medium",
      successRate: 79,
      durationMinutes: 17,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_90",
      agentId: "nyra",
      title: "Přítomnost bez tváře",
      description: "Postarej se, aby někdo cítil něčí blízkost, aniž by kdy zahlédl tvář. Lidská představivost je levná a smrtelně účinná zbraň.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_91",
      agentId: "nyra",
      title: "Sběr slabých míst",
      description: "Dnes neřešíš velké tajemství. Dnes posbíráš deset malých. A z těch malých se staví nejhorší klece.",
      difficulty: "easy",
      successRate: 88,
      durationMinutes: 12,
      reward: {
        influence: 3,
        "dirty-cash": 1e3
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_92",
      agentId: "nyra",
      title: "Pod kůží města",
      description: "V každém sektoru pulzuje strach, jen ho nikdo nechce pojmenovat. Dnes mu dáš tvar a cenu.",
      difficulty: "medium",
      successRate: 78,
      durationMinutes: 18,
      reward: {
        influence: 6,
        cash: 700
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_93",
      agentId: "nyra",
      title: "Slovo, které zůstane",
      description: "Vyber jednu větu, která se člověku usadí v hlavě jako střep. A pak ji řekni přesně jednou.",
      difficulty: "easy",
      successRate: 87,
      durationMinutes: 12,
      reward: {
        influence: 3,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_94",
      agentId: "nyra",
      title: "Cizí dotek v prostoru",
      description: "Přesuň pár věcí, nech pár stop a jednu nejasnost. Nic víc. To úplně stačí na dlouhou noc bez dechu.",
      difficulty: "easy",
      successRate: 86,
      durationMinutes: 13,
      reward: {
        influence: 3,
        cash: 800
      },
      risk: {
        successHeat: 1,
        failureHeat: 3,
        failureDirtyCashLoss: 0
      }
    },
    {
      id: "nyra_95",
      agentId: "nyra",
      title: "Hlad po odpovědi",
      description: "Dnes někomu nedáš důkaz. Dáš mu jen dost na to, aby po zbytku začal šílet toužit.",
      difficulty: "medium",
      successRate: 80,
      durationMinutes: 16,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_96",
      agentId: "nyra",
      title: "Jedovatá blízkost",
      description: "Nejhorší hrozby nejsou daleko. Jsou těsně vedle člověka, ve stejné místnosti, v obyčejném tónu hlasu.",
      difficulty: "medium",
      successRate: 85,
      durationMinutes: 15,
      reward: {
        influence: 6,
        cash: 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_97",
      agentId: "nyra",
      title: "Vnitřní pád",
      description: "Některé lidi není třeba srazit. Stačí jim odebrat poslední oporu a oni se zřítí sami.",
      difficulty: "medium",
      successRate: 77,
      durationMinutes: 18,
      reward: {
        influence: 6,
        "dirty-cash": 900
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_98",
      agentId: "nyra",
      title: "Tři náznaky",
      description: "První náznak znejistí. Druhý rozhodí. Třetí zlomí. Doruč všechny tři ve správném pořadí.",
      difficulty: "medium",
      successRate: 81,
      durationMinutes: 16,
      reward: {
        influence: 6,
        cash: 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_99",
      agentId: "nyra",
      title: "Tma mezi lidmi",
      description: "Největší temnota není v ulicích. Je mezi lidmi, kteří si přestali věřit. Rozšiř ji.",
      difficulty: "medium",
      successRate: 75,
      durationMinutes: 19,
      reward: {
        influence: 6,
        "dirty-cash": 800
      },
      risk: {
        successHeat: 2,
        failureHeat: 6,
        failureDirtyCashLoss: 200
      }
    },
    {
      id: "nyra_100",
      agentId: "nyra",
      title: "Nyřin jed",
      description: "Zapamatuj si to. Strach je hlasitý jen na začátku. Pak ztichne, usadí se v člověku a začne ho požírat zevnitř. Dnes ten hlad nakrmíme.",
      difficulty: "rare",
      successRate: 65,
      durationMinutes: 25,
      reward: {
        "overdrive-x": 1,
        influence: 8
      },
      risk: {
        successHeat: 6,
        failureHeat: 12,
        failureDirtyCashLoss: 600
      }
    }
  ];
  const definitions = catalog;
  const freeModeCityEventConfig = {
    enabled: true,
    agents: {
      victor: {
        agentId: "victor",
        name: "Victor Grave Kadeř",
        typeLabel: "Noční kontakt",
        requiredInfluence: 0,
        offerCount: 3,
        refreshTimes: [
          { hour: 18, minute: 0 },
          { hour: 22, minute: 0 },
          { hour: 2, minute: 0 }
        ],
        availability: {
          opensAt: { hour: 18, minute: 0 },
          closesAt: { hour: 4, minute: 0 }
        }
      },
      leon: {
        agentId: "leon",
        name: "Leon Switch Varga",
        typeLabel: "Fixer a obchodník",
        requiredInfluence: 100,
        offerCount: 3,
        refreshTimes: [
          { hour: 10, minute: 0 },
          { hour: 22, minute: 0 }
        ]
      },
      nyra: {
        agentId: "nyra",
        name: "Nyra Vale",
        typeLabel: "Informační síť",
        requiredInfluence: 300,
        offerCount: 3,
        refreshTimes: [
          { hour: 6, minute: 0 },
          { hour: 14, minute: 0 },
          { hour: 22, minute: 0 }
        ],
        dossierSlot: {
          standardOfferCount: 2,
          rareEligibleHour: 22
        }
      }
    },
    definitions,
    difficultyBudgets: {
      easy: {
        maxReplacementValue: 1200,
        successRateMin: 86,
        successRateMax: 94,
        durationMinutesMin: 10,
        durationMinutesMax: 14
      },
      medium: {
        maxReplacementValue: 2200,
        successRateMin: 73,
        successRateMax: 85,
        durationMinutesMin: 15,
        durationMinutesMax: 21
      },
      hard: {
        maxReplacementValue: 4e3,
        successRateMin: 62,
        successRateMax: 72,
        durationMinutesMin: 22,
        durationMinutesMax: 30
      },
      rare: {
        maxReplacementValue: 12e3,
        successRateMin: 55,
        successRateMax: 65,
        durationMinutesMin: 25,
        durationMinutesMax: 35
      }
    },
    maxActiveRunsPerPlayer: 1,
    maxStrategicOffersPerCityDay: 1
  };
  const freeModeAllianceLifecycleConfig = {
    readiness: {
      readyIntervalSeconds: 24 * 60 * 60,
      readyButtonAvailableBeforeDueSeconds: 4 * 60 * 60,
      gracePeriodSeconds: 4 * 60 * 60,
      voteDurationSeconds: 2 * 60 * 60,
      voteRetryCooldownSeconds: 2 * 60 * 60
    },
    voluntaryLeavePenalty: {
      allianceJoinLockoutSeconds: 12 * 60 * 60,
      allianceCreateLockoutSeconds: 12 * 60 * 60,
      influenceDebuffSeconds: 8 * 60 * 60,
      actionCooldownDebuffSeconds: 6 * 60 * 60,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 0.8,
      actionCooldownMultiplier: 1.15,
      statDebuffSeconds: 12 * 60 * 60,
      attackMultiplier: 0.8,
      defenseMultiplier: 0.8,
      blocksAllianceDefenseSupport: true
    },
    inactiveKickPenalty: {
      allianceJoinLockoutSeconds: 6 * 60 * 60,
      allianceCreateLockoutSeconds: 6 * 60 * 60,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      statDebuffSeconds: 12 * 60 * 60,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      attackMultiplier: 0.8,
      defenseMultiplier: 0.8,
      productionMultiplier: 0.8,
      incomeMultiplier: 0.8,
      blocksAllianceDefenseSupport: true
    },
    disbandPenalty: {
      allianceJoinLockoutSeconds: 30 * 60,
      allianceCreateLockoutSeconds: 30 * 60,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      formerAllyTruceSeconds: 60 * 60,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      blocksAllianceDefenseSupport: false
    },
    administrativeRemovalPenalty: {
      allianceJoinLockoutSeconds: 0,
      allianceCreateLockoutSeconds: 0,
      influenceDebuffSeconds: 0,
      actionCooldownDebuffSeconds: 0,
      formerAllyTruceSeconds: 0,
      influenceGenerationMultiplier: 1,
      actionCooldownMultiplier: 1,
      blocksAllianceDefenseSupport: false
    },
    affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
    exitPendingTimeoutSeconds: 15 * 60
  };
  const FREE_MODE_RAID_DURATION_TICKS = ticksFromMinutes(60);
  const freeModePoliceConfig = {
    districtHeatWeight: 0.9,
    highPressureRaidThreshold: 115,
    extremePressureRaidThreshold: 180,
    districtTargetHeatThreshold: 70,
    raidCooldownTicks: ticksFromMinutes(240),
    raidDurationTicks: FREE_MODE_RAID_DURATION_TICKS,
    pendingRaidTtlTicks: FREE_MODE_RAID_DURATION_TICKS,
    maxPendingRaidsPerPlayer: 1,
    maxConcurrentRaidsByPhase: {
      day: 1,
      night: 1
    },
    raidSeverityThresholds: { low: 0, medium: 30, high: 115, extreme: 180 },
    dirtyCashSeizurePercentBySeverity: { low: 0, medium: 0.05, high: 0.12, extreme: 0.22 },
    resourceSeizurePercentBySeverity: { low: 0, medium: 0, high: 0.05, extreme: 0.1 },
    lockdownTicksBySeverity: {
      low: 0,
      medium: 0,
      high: ticksFromMinutes(8),
      extreme: ticksFromMinutes(15)
    },
    buildingDisruptionTicksBySeverity: {
      low: 0,
      medium: 0,
      high: ticksFromMinutes(5),
      extreme: ticksFromMinutes(10)
    },
    heatReductionBySeverity: { low: 0, medium: 8, high: 30, extreme: 55 },
    heatDecay: {
      playerIntervalTicks: 30,
      playerDecayByWantedLevel: { 0: 4, 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 },
      districtIntervalTicks: 60,
      districtBaseDecay: 3,
      districtHighPassiveHeatPerDayThreshold: 100,
      districtHighPassiveHeatMultiplier: 0.5,
      districtLockdownDecayMultiplier: 1.25
    },
    maxPoliticalRaidTriggerReductionPct: 45,
    extremePoliticalRaidReductionMultiplier: 0.5,
    protectedResources: ["cash", "gang-members", "population"],
    autoResolveExpiredPendingRaids: true
  };
  const PLAYER_BOOST_IDS = [
    "ghost-network",
    "industrial-overdrive",
    "tactical-grid"
  ];
  const ATTACK_WEAPON_IDS = [
    "baseball-bat",
    "pistol",
    "grenade",
    "smg",
    "bazooka"
  ];
  const FACTION_DEFINITIONS = [
    {
      id: "mafian",
      name: "Mafián",
      tagline: "Staré peníze, staré krytí.",
      description: "Stabilní ekonomika, výpalné a vliv na správných dveřích.",
      playstyleSummary: "Economy / clean cash / influence / heat control mimo obsazování",
      strengths: ["clean cash", "legální income", "heat management mimo obsazování"],
      weaknesses: ["slabší tech", "slabší špehování"],
      passiveModifiers: { cleanIncomeMultiplier: 1.1, heatGainMultiplier: 0.96, spySuccessChanceBonus: -0.03 },
      passiveEffectSummary: ["Clean income +10 %", "-4 % heat z útoků, heistů, akcí budov a pasivního tlaku", "Spy -3 p. b."],
      specialAction: {
        name: "Tichá dohoda",
        description: "Mafián zatlačí na správné kontakty a na krátký čas sníží nový policejní heat ze svých akcí.",
        status: "preview",
        intendedFutureEffect: [
          "Sníží nový heat gain o 35 % na omezenou dobu.",
          "Neodstraňuje existující heat.",
          "Neruší pending raids.",
          "Neruší aktivní raids.",
          "Nestackuje se."
        ]
      },
      uiTheme: { accent: "#d7b46a", glow: "rgba(215,180,106,.45)", surface: "rgba(38,30,22,.92)", glyph: "M" },
      recommendedFor: "hráče, kteří chtějí stabilní ekonomiku a kontrolu tempa",
      difficulty: "snadná"
    },
    {
      id: "kartel",
      name: "Kartel",
      tagline: "Prachy tečou rychle. Krev taky.",
      description: "Kartel staví impérium na dirty cash, drogách a pašování. Vydělává rychleji z ilegálních zdrojů a jeho produkce jede tvrději než u ostatních frakcí. Každá zásilka má ale stopu: Kartel generuje víc policejního tlaku, hůř vydělává čisté peníze a při obraně území není tak pevný.",
      playstyleSummary: "Dirty cash / illegal production / drugs / smuggling / high risk economy",
      strengths: ["dirty cash", "ilegální produkce", "drogy", "pašování", "high risk economy"],
      weaknesses: ["víc heat z ilegálních akcí", "slabší clean income", "slabší defense"],
      passiveModifiers: {
        dirtyIncomeMultiplier: 1.18,
        illegalProductionMultiplier: 1.15,
        smugglingIncomeMultiplier: 1.1,
        illegalActionHeatGainMultiplier: 1.15,
        cleanIncomeMultiplier: 0.92,
        defensePowerMultiplier: 0.95
      },
      passiveEffectSummary: [
        "+18 % dirty income",
        "+15 % produkce v podporovaných ilegálních budovách",
        "+10 % pašování",
        "+15 % heat z ilegálních akcí",
        "-8 % clean income",
        "-5 % defense power"
      ],
      specialAction: {
        name: "Noční zásilka",
        description: "Kartel spustí riskantní zásilku přes město. Přinese dirty cash podle vlastněné ilegální sítě, ale výrazně zvýší policejní heat.",
        status: "preview",
        intendedFutureEffect: [
          "Instant dirty cash reward podle vlastněných illegal/smuggling/drug buildings.",
          "Base dirty cash 500.",
          "Dirty cash per illegal building 100.",
          "Dirty cash per smuggling building 150.",
          "Dirty cash per drug building 120.",
          "Heat hráče +12.",
          "District heat gain 3 na relevantní vlastněný illegal district, pokud to pipeline podporuje.",
          "Vytvoří suspicion-style city feed event, pokud to pipeline podporuje.",
          "Cooldown: 2700 sekund.",
          "Nedává clean cash.",
          "Nedává okamžité resources.",
          "Nesnižuje heat.",
          "Neruší raids.",
          "Nestackuje se.",
          "Suggested cost: influence 15."
        ]
      },
      uiTheme: { accent: "#ff3f5f", glow: "rgba(255,63,95,.5)", surface: "rgba(42,14,22,.94)", glyph: "K" },
      recommendedFor: "hráče, kteří chtějí rychlé prachy a zvládnou tlak",
      difficulty: "střední"
    },
    {
      id: "kult",
      name: "Kult",
      tagline: "Město se zlomí vírou.",
      description: "Kult roste skrz vliv, loajalitu a strach. Přitahuje víc lidí, lépe drží obsazené districty a dokáže město zaplavit neklidem. Není ale silný v čisté ekonomice ani v přímém útoku.",
      playstyleSummary: "Influence / population / defense / manipulation / city feed chaos",
      strengths: ["influence", "population", "defense", "manipulace", "drby / podezření"],
      weaknesses: ["slabší clean economy", "slabší přímý útok", "vyšší market fee připravujeme"],
      passiveModifiers: {
        influenceGainMultiplier: 1.2,
        populationGenerationMultiplier: 1.1,
        defensePowerMultiplier: 1.1,
        rumorGenerationMultiplier: 1.1,
        cleanIncomeMultiplier: 0.9,
        marketFeeMultiplier: 1.1,
        attackPowerMultiplier: 0.95
      },
      passiveEffectSummary: [
        "+20 % influence gain",
        "+10 % population generation",
        "+10 % defense power",
        "-10 % clean income",
        "-5 % attack power"
      ],
      plannedPassiveEffectSummary: [
        "Silnější práce s drby / podezřením",
        "+10 % market fee"
      ],
      specialAction: {
        name: "Masová posedlost",
        description: "Kult rozpoutá v ulicích fanatickou vlnu oddanosti. Na krátký čas posílí vliv, růst populace a obranu, ale přitáhne policejní pozornost.",
        status: "preview",
        intendedFutureEffect: [
          "Duration: 600 sekund.",
          "Cooldown: 2400 sekund.",
          "Aktivní zisk vlivu +35 %.",
          "Aktivní generování populace +20 %.",
          "Aktivní síla obrany +10 %.",
          "Přidá player heat nebo district heat.",
          "Vytvoří suspicion-style city feed event.",
          "Nestackuje se.",
          "Nedává instant cash.",
          "Nedává instant resources.",
          "Neruší raids.",
          "Neblokuje útoky.",
          "Suggested cost: influence 30."
        ]
      },
      uiTheme: { accent: "#a855f7", glow: "rgba(168,85,247,.48)", surface: "rgba(31,19,45,.94)", glyph: "K" },
      recommendedFor: "hráče, kteří chtějí držet území a dusit okolí",
      difficulty: "střední"
    },
    {
      id: "tajna-organizace",
      name: "Tajná organizace",
      tagline: "Nevidíš nás. Jen následky.",
      description: "Tajná organizace ovládá město přes infiltrace, špehování, falešné stopy a spící buňky. Má přesnější informace, lépe odhaluje pasti a dokáže provádět tajné operace s menším policejním tlakem. V otevřené válce ale ztrácí sílu.",
      playstyleSummary: "Spying / infiltration / traps / secret actions / false information / low heat",
      strengths: ["špehování", "infiltrace", "traps", "tajné akce", "false information", "low heat"],
      weaknesses: ["slabší přímý boj", "slabší clean income", "slabší dirty income"],
      passiveModifiers: {
        spySuccessChanceBonus: 0.15,
        spyInfoQualityMultiplier: 1.15,
        trapDetectionChanceBonus: 0.15,
        secretActionHeatGainMultiplier: 0.92,
        rumorTruthMultiplier: 1.1,
        attackPowerMultiplier: 0.9,
        cleanIncomeMultiplier: 0.92,
        dirtyIncomeMultiplier: 0.92
      },
      passiveEffectSummary: [
        "+15 % šance na úspěšné špehování",
        "+15 % šance odhalit pasti",
        "+10 % kvalita intel/drbů",
        "-10 % attack power",
        "-8 % clean income",
        "-8 % dirty income"
      ],
      plannedPassiveEffectSummary: [
        "+15 % kvalita informací ze špehování",
        "-8 % heat z tajných akcí"
      ],
      specialAction: {
        name: "Spící buňka",
        description: "Tajná organizace skrytě aktivuje buňku ve vlastním districtu. První nepřátelský útok nebo pokus o obsazení bude oslabený a pro útočníka dražší.",
        status: "preview",
        intendedFutureEffect: [
          "Target: jeden vlastněný district.",
          "Duration: 1800 sekund.",
          "Cooldown: 3600 sekund.",
          "Cost: influence 25 + clean cash 1000.",
          "Trigger: nepřítel zaútočí na chráněný district.",
          "Trigger: nepřítel se pokusí obsadit chráněný district.",
          "Síla útoku nepřítele -15 %.",
          "Síla obsazení nepřítele -15 %.",
          "Ztráty nepřítele +10 %.",
          "Čekání nepřítele +180 sekund.",
          "Efekt se po triggeru spotřebuje.",
          "Lze položit jen na vlastněný district.",
          "Nestackuje se na stejném districtu.",
          "Nenahrazuje toxic trap mechaniku.",
          "Neobchází existující trap mechaniky.",
          "Neodstraňuje heat.",
          "Neruší raids.",
          "Není globálně viditelná.",
          "Nemá být běžně odhalená rumory.",
          "Může být naznačená jen high-quality spyingem, pokud to spy systém podporuje.",
          "Vyprší, pokud se nepoužije."
        ]
      },
      uiTheme: { accent: "#67e8f9", glow: "rgba(103,232,249,.44)", surface: "rgba(8,30,42,.94)", glyph: "T" },
      recommendedFor: "hráče, kteří chtějí vědět víc než ostatní",
      difficulty: "těžká"
    },
    {
      id: "hackeri",
      name: "Hackeři",
      tagline: "Kdo ovládá data, ovládá válku.",
      description: "Hackeři nevyhrávají přes hrubou sílu. Čtou město přes kamery, alarmy, datová centra a potvrzené drby. Jejich informace jsou výrazně spolehlivější a jejich technická obrana je silnější než u ostatních frakcí. V otevřeném boji ale ztrácí.",
      playstyleSummary: "Tech / confirmed rumors / cameras / alarms / spying / digital sabotage",
      strengths: ["tech", "confirmed rumors", "cameras", "alarms", "spying", "digital sabotage"],
      weaknesses: ["slabší attack power", "slabší dirty income", "slabší základní obrana bez kamer/alarmů"],
      passiveModifiers: {
        rumorTruthMultiplier: 1.5,
        cameraEffectivenessMultiplier: 1.15,
        alarmEffectivenessMultiplier: 1.15,
        techProductionMultiplier: 1.1,
        spySuccessChanceBonus: 0.1,
        attackPowerMultiplier: 0.92,
        dirtyIncomeMultiplier: 0.92,
        baseDefensePowerMultiplier: 0.95
      },
      passiveEffectSummary: [
        "+50 % pravdivost rumorů s truthChancePct",
        "+15 % účinnost kamer",
        "+15 % účinnost alarmů",
        "+10 % tech production",
        "+10 % šance na úspěšné špehování",
        "-8 % attack power",
        "-8 % dirty income",
        "-5 % základní obrana bez kamer/alarmů"
      ],
      specialAction: {
        name: "Výpadek systému",
        description: "Hackeři naruší cílový district. Na krátký čas oslabí kamery, alarmy a technickou obranu cíle, čímž zvýší šanci na úspěšné špehování nebo vykradení.",
        status: "preview",
        intendedFutureEffect: [
          "Target: enemy district.",
          "Duration: 600 sekund.",
          "Cooldown: 2400 sekund.",
          "Účinnost kamer cíle -20 %.",
          "Účinnost alarmu cíle -20 %.",
          "Spy against target chance bonus 0.15.",
          "Robbery against target chance bonus 0.10.",
          "Heat hráče +4.",
          "Neodhaluje pasti automaticky.",
          "Nevypíná toxic traps.",
          "Negarantuje úspěšné špehování.",
          "Negarantuje úspěšné vykradení.",
          "Neruší raids.",
          "Neodstraňuje heat.",
          "Nestackuje se na stejném cíli.",
          "Suggested cost: tech core 1 + influence 15."
        ]
      },
      uiTheme: { accent: "#22d3ee", glow: "rgba(34,211,238,.48)", surface: "rgba(8,27,34,.94)", glyph: "H" },
      recommendedFor: "hráče, kteří rádi hrají přes data a trh",
      difficulty: "těžká"
    },
    {
      id: "motorkarsky-gang",
      name: "Motorkářský gang",
      tagline: "Rychlost zabíjí.",
      description: "Motorkáři nehrají na trpělivost. Vyráží rychle, berou co najdou a mizí dřív, než se město vzpamatuje. Mají kratší cooldowny na agresivní akce a víc vydělají z vykrádání. Jenže držet území není jejich silná stránka a rychlý chaos zanechává větší policejní stopu.",
      playstyleSummary: "Speed / robbery / attacks / pressure / dirty cash",
      strengths: ["rychlé cooldowny", "vykrádání", "útoky", "map pressure", "dirty cash"],
      weaknesses: ["slabší obrana districtů", "vyšší heat z útoků, obsazování a vykrádání"],
      passiveModifiers: {
        robberyCooldownMultiplier: 0.85,
        attackCooldownMultiplier: 0.9,
        occupyCooldownMultiplier: 0.9,
        robberyDirtyCashLootMultiplier: 1.1,
        defensePowerMultiplier: 0.9,
        aggressiveActionHeatGainMultiplier: 1.08
      },
      passiveEffectSummary: [
        "-15 % cooldown na vykrádání",
        "-10 % cooldown na útoky",
        "-10 % cooldown na obsazování",
        "+10 % dirty cash z vykrádání",
        "-10 % obrana districtů",
        "+8 % heat z útoků, obsazování a vykrádání"
      ],
      specialAction: {
        name: "Bleskový nájezd",
        description: "Gang vyrazí do ulic bez varování. Další vykradení nebo útok proběhne výrazně rychleji a silněji, ale vygeneruje víc heat.",
        status: "preview",
        intendedFutureEffect: [
          "Platí na další vykradení nebo útok.",
          "Další agresivní akce trvá o 40 % méně.",
          "Další vykradení dá loot +15 %.",
          "Další útok má sílu +10 %.",
          "Další agresivní akce přidá heat +15 %.",
          "Nestackuje se.",
          "Vyprší po omezené době, pokud se nepoužije.",
          "Cooldown: medium.",
          "Suggested cost: dirty cash + influence."
        ]
      },
      uiTheme: { accent: "#f97316", glow: "rgba(249,115,22,.46)", surface: "rgba(45,24,12,.94)", glyph: "B" },
      recommendedFor: "hráče, kteří chtějí early tlak a tempo",
      difficulty: "střední"
    },
    {
      id: "soukroma-armada",
      name: "Soukromá armáda",
      tagline: "Když diplomacie selže, přijde faktura.",
      description: "Soukromá armáda nehraje na pouliční chaos. Nasazuje vycvičené jednotky, taktiku a přesilu. Je silnější v útoku, lépe brání districty a při obsazování ztrácí méně vybavení. Profesionální násilí je ale drahé a viditelné.",
      playstyleSummary: "Combat / defense / occupation / territory control / expensive operations",
      strengths: ["attack power", "defense power", "combat losses", "occupation", "territory control"],
      weaknesses: ["vyšší upkeep / combat cost", "vyšší heat z agresivních akcí", "slabší clean income"],
      passiveModifiers: {
        attackPowerMultiplier: 1.12,
        defensePowerMultiplier: 1.12,
        equipmentLossMultiplier: 0.9,
        occupyPowerMultiplier: 1.1,
        upkeepCostMultiplier: 1.12,
        aggressiveActionHeatGainMultiplier: 1.08,
        cleanIncomeMultiplier: 0.92
      },
      passiveEffectSummary: [
        "+12 % attack power",
        "+12 % defense power",
        "-10 % ztráty vybavení v boji",
        "+8 % heat z útoků a obsazování",
        "-8 % clean income"
      ],
      plannedPassiveEffectSummary: [
        "+10 % síla při obsazování",
        "+12 % upkeep / combat cost"
      ],
      specialAction: {
        name: "Taktické nasazení",
        description: "Soukromá armáda spustí profesionální zásah. Další útok nebo obsazení districtu získá výrazný bojový bonus a nižší ztráty, ale vygeneruje více heat.",
        status: "preview",
        intendedFutureEffect: [
          "Platí pouze na další útok nebo obsazení districtu.",
          "Neplatí na vykrádání.",
          "Další bojová akce má sílu +25 %.",
          "Další obsazení má sílu +25 %.",
          "Další bojové ztráty -20 %.",
          "Další bojový heat +15 %.",
          "Duration: 900 sekund.",
          "Cooldown: 2700 sekund.",
          "Nestackuje se.",
          "Vyprší, pokud se nepoužije.",
          "Negarantuje vítězství.",
          "Neobchází pasti.",
          "Neruší efekty nepřátelských pastí.",
          "Neodstraňuje heat.",
          "Neruší raids.",
          "Suggested cost: clean cash 2000 + dirty cash 500 + influence 15."
        ]
      },
      uiTheme: { accent: "#ef4444", glow: "rgba(239,68,68,.5)", surface: "rgba(40,18,18,.94)", glyph: "S" },
      recommendedFor: "hráče, kteří chtějí řešit mapu silou",
      difficulty: "snadná"
    },
    {
      id: "korporace",
      name: "Korporát",
      tagline: "Zločin je špinavý. Moc je legální.",
      description: "Korporát nevlastní ulice přes strach, ale přes smlouvy, právníky, bezpečnostní systémy a účty, které nikdo nechce kontrolovat. Vydělává silněji z čisté ekonomiky, lépe obchoduje a dokáže zmírnit následky policejního tlaku. V pouliční špíně ale ztrácí tempo.",
      playstyleSummary: "Clean economy / legal cover / defense systems / market efficiency / safer growth",
      strengths: ["clean economy", "legal cover", "defense systems", "market efficiency", "safer growth"],
      weaknesses: ["dirty income", "robbery loot", "delší útoky"],
      passiveModifiers: {
        cleanIncomeMultiplier: 1.15,
        heatGainMultiplier: 0.97,
        defenseSystemEffectivenessMultiplier: 1.1,
        marketFeeMultiplier: 0.9,
        dirtyIncomeMultiplier: 0.85,
        robberyLootMultiplier: 0.9,
        attackDurationMultiplier: 1.1
      },
      passiveEffectSummary: [
        "+15 % clean income",
        "-3 % heat z útoků, heistů, akcí budov a pasivního tlaku",
        "+10 % efekt obranných systémů",
        "-15 % dirty income",
        "-10 % loot z vykrádání",
        "+10 % délka útoků"
      ],
      plannedPassiveEffectSummary: ["-10 % market fee"],
      specialAction: {
        name: "Právní štít",
        description: "Korporát aktivuje právníky, compliance tým a krizové krytí. Další policejní razie má mírnější následky, ale není zrušena.",
        status: "preview",
        intendedFutureEffect: [
          "Platí pouze na další policejní razii.",
          "Další následky raidu -35 %.",
          "Duration: 1200 sekund.",
          "Cooldown: 3600 sekund.",
          "Neruší razii.",
          "Nesnižuje aktuální heat.",
          "Neodstraňuje pending raid.",
          "Neodstraňuje aktivní raid.",
          "Nestackuje se.",
          "Musí zůstat slabší než mitigace Soudu.",
          "Pokud během duration nepřijde razie, efekt vyprší.",
          "Suggested cost: clean cash 3000 + influence 20."
        ]
      },
      uiTheme: { accent: "#60a5fa", glow: "rgba(96,165,250,.46)", surface: "rgba(13,25,44,.94)", glyph: "C" },
      recommendedFor: "hráče, kteří chtějí ekonomickou převahu",
      difficulty: "snadná"
    }
  ];
  const FACTION_DEFINITION_BY_ID = Object.fromEntries(FACTION_DEFINITIONS.map((definition) => [definition.id, definition]));
  const FREE_MODE_DAY_NIGHT_PHASE_TICKS = resolveDayNightPhaseDurationTicks(FREE_MODE_TICK_RATE_MS);
  const FREE_MODE_ELIMINATION_INTERVAL_TICKS = ticksFromHours(4);
  const FREE_MODE_FIRST_ELIMINATION_TICKS = ticksFromHours(8);
  const FREE_MODE_HARD_TIMEOUT_TICKS = ticksFromDays(7);
  const FREE_MODE_HARD_TIMEOUT_MS = FREE_MODE_HARD_TIMEOUT_TICKS * FREE_MODE_TICK_RATE_MS;
  const freeModeOverride = {
    mode: "free",
    tickRateMs: FREE_MODE_TICK_RATE_MS,
    balance: {
      incomeMultiplier: 1.2,
      productionMultiplier: 1.2,
      cooldownMultiplier: FREE_MODE_COOLDOWN_MULTIPLIER,
      maxPlayersPerServer: 20,
      maxAllianceSize: 4,
      allianceLifecycle: freeModeAllianceLifecycleConfig,
      playerLiveness: {
        lastStand: {
          enabled: true,
          protectionTicks: ticksFromMinutes(12),
          maxUsesPerPlayer: 1,
          disabledDuringFinalLockdown: true
        },
        emergencyRecovery: {
          enabled: true,
          maxUsesPerPlayer: 1,
          cleanCash: 500,
          population: 5,
          futureUnlockGraceTicks: ticksFromMinutes(10),
          disabledDuringFinalLockdown: true
        },
        encirclementConfirmationTicks: ticksFromMinutes(2)
      },
      buildSlotLimit: 8,
      eventFrequencyMultiplier: 1.2,
      elimination: {
        enabled: true,
        intervalTicks: FREE_MODE_ELIMINATION_INTERVAL_TICKS,
        firstEliminationTick: FREE_MODE_FIRST_ELIMINATION_TICKS,
        minActivePlayers: 8,
        dangerZoneSize: 3,
        quietHours: {
          enabled: true,
          timeZone: "Europe/Bratislava",
          startHour: 0,
          endHour: 6,
          behavior: "defer_to_window_end"
        },
        eliminatedPlayerStatus: "defeated",
        defeatedDistrictPolicy: "neutralize",
        defeatedDistrictLockTicks: FREE_MODE_ELIMINATION_INTERVAL_TICKS,
        scoreWeights: {
          controlledDistricts: 1e4,
          districtInfluence: 25,
          activeBuildingCount: 500,
          cleanCash: 0.1,
          dirtyCash: 0.05,
          resources: 0.2,
          population: 2,
          recentActivityBonus: 250,
          recentActivityWindowTicks: ticksFromHours(1),
          resourceScoreValues: {}
        }
      },
      finalLockdown: {
        enabled: true,
        triggerActivePlayers: 8,
        activeDurationTicks: ticksFromHours(12),
        pauseDuringQuietHours: true,
        scoreMode: "final_empire_score",
        topRankCount: 3,
        downtownDistrictBonus: 15e3,
        rareBuildingBonus: 5e3,
        heatPenaltyStart: 120,
        heatPenaltyPerPoint: 50,
        extremeHeatPenaltyStart: 180,
        extremeHeatPenaltyPerPoint: 100
      },
      policePressureMultiplier: 0.9,
      raidIntensityMultiplier: 0.9,
      expansionSpeedMultiplier: 1.3,
      dayLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
      nightLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
      dayNight: createDayNightConfig({
        dayDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
        nightDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS
      }),
      victoryConditionKey: "final-lockdown",
      allowDurationVictoryFallback: false,
      hardTimeoutTicks: FREE_MODE_HARD_TIMEOUT_TICKS,
      police: freeModePoliceConfig,
      conflict: {
        spyCooldownTicks: ticksFromMinutes(6),
        spyAuthorizationTtlTicks: ticksFromMinutes(10),
        spySlotCooldownTicks: ticksFromMinutes(6),
        defenseCapacity: {
          baseCapacityPoints: 20,
          zoneBonusPoints: { downtown: 4 },
          itemWeights: {
            vest: 1,
            barricades: 1,
            cameras: 2,
            alarm: 2,
            "defense-tower": 4
          }
        },
        heist: {
          globalCooldownTicks: ticksFromMinutes(8),
          sameTargetCooldownTicks: ticksFromMinutes(12),
          victimProtectionTicks: ticksFromMinutes(6),
          styles: {
            stealth: {
              minMembers: 5,
              maxMembers: 35,
              baseSuccessChance: 0.8,
              baseDetectionChance: 0.18,
              lootMultiplier: 0.65,
              detectedLossMultiplier: 0.35,
              heatOnSuccess: 1,
              heatOnDetected: 4
            },
            balanced: {
              minMembers: 10,
              maxMembers: 70,
              baseSuccessChance: 0.74,
              baseDetectionChance: 0.3,
              lootMultiplier: 1,
              detectedLossMultiplier: 0.5,
              heatOnSuccess: 3,
              heatOnDetected: 7
            },
            all_in: {
              minMembers: 25,
              maxMembers: 120,
              baseSuccessChance: 0.68,
              baseDetectionChance: 0.46,
              lootMultiplier: 1.45,
              detectedLossMultiplier: 0.7,
              heatOnSuccess: 5,
              heatOnDetected: 12
            }
          },
          security: {
            camerasDetectionChancePerUnit: 0.04,
            camerasMaxDetectionBonus: 0.2,
            alarmDetectionChancePerUnit: 0.06,
            alarmMaxDetectionBonus: 0.24,
            defenseTowerResistancePerUnit: 8,
            barricadesResistancePerUnit: 2
          }
        },
        robbery: {
          cityDayRegenerationFraction: 0.25,
          poolsByZone: {
            park: {
              cash: { min: 20, max: 50 },
              dirtyCash: { min: 5, max: 20 },
              chemicals: { min: 10, max: 24 },
              biomass: { min: 8, max: 20 },
              metalParts: { min: 0, max: 4 }
            },
            residential: {
              cash: { min: 25, max: 60 },
              dirtyCash: { min: 8, max: 24 },
              chemicals: { min: 2, max: 8 },
              biomass: { min: 2, max: 8 },
              metalParts: { min: 1, max: 6 }
            },
            commercial: {
              cash: { min: 70, max: 150 },
              dirtyCash: { min: 20, max: 55 },
              chemicals: { min: 1, max: 6 },
              biomass: { min: 1, max: 5 },
              metalParts: { min: 2, max: 8 }
            },
            industrial: {
              cash: { min: 35, max: 80 },
              dirtyCash: { min: 10, max: 30 },
              chemicals: { min: 4, max: 12 },
              biomass: { min: 0, max: 4 },
              metalParts: { min: 14, max: 32 }
            },
            downtown: {
              cash: { min: 100, max: 200 },
              dirtyCash: { min: 35, max: 75 },
              chemicals: { min: 2, max: 8 },
              biomass: { min: 2, max: 8 },
              metalParts: { min: 4, max: 12 }
            }
          }
        },
        attackCooldownTicks: ticksFromMinutes(22),
        attackTargetProtectionTicks: ticksFromMinutes(10),
        concurrency: {
          offenseGlobalCooldownTicks: ticksFromMinutes(1.5),
          sourceConflictLockTicks: ticksFromMinutes(1.5),
          attackFailedCombatProtectionTicks: ticksFromMinutes(3),
          attackCaptureProtectionTicks: ticksFromMinutes(10),
          attackDestructionProtectionTicks: ticksFromMinutes(10)
        },
        captureStabilization: {
          durationTicks: ticksFromMinutes(15),
          incomeMultiplier: 0.5,
          productionSpeedMultiplier: 0.5,
          cleanCaptureAttritionPct: 5,
          successfulCaptureMinimumAttritionPct: 8
        },
        defenseCasualty: {
          vestRelativeReductionPerUnit: 0.05,
          vestRelativeReductionCap: 0.35
        },
        catastrophe: {
          bazookaBonusPerUnit: 0.015,
          bazookaBonusCap: 0.12,
          finalChanceCap: 0.18
        },
        occupyOverextension: {
          basePopulationCost: 50,
          thirdDistrictInfluenceCost: 550,
          fourthDistrictInfluenceCost: 1050,
          additionalDistrictInfluenceCost: 250,
          additionalPopulationPerTwoDistricts: 1
        },
        trapRelocationCooldownTicks: ticksFromMinutes(10),
        robCooldownTicks: ticksFromMinutes(10),
        heistCooldownTicks: ticksFromMinutes(8),
        occupyCooldownTicks: ticksFromMinutes(12),
        occupyFailureChancePct: 5,
        minAttackDurationTicks: ticksFromMinutes(22),
        attackHeatGain: 8,
        occupyHeatGain: 2,
        occupyInfluenceCost: 5,
        occupyPopulationRefundPct: 10,
        spyBaseSuccessChance: 0.76,
        spyTrapRevealChance: 0.2,
        trapAttackLosses: 2,
        reportsLimit: 6,
        catastropheChance: 0.02
      },
      startingResources: {
        cash: 1500,
        "dirty-cash": 300,
        chemicals: 10,
        biomass: 6,
        "metal-parts": 8,
        "tech-core": 2
      },
      attackWeapons: freeModeAttackWeaponsConfig,
      playerBoosts: freeModePlayerBoostConfig,
      cityEvents: freeModeCityEventConfig,
      factions: FACTION_DEFINITION_BY_ID,
      pharmacy: freeModePharmacyConfig,
      drugLab: freeModeDrugLabConfig,
      factory: freeModeFactoryConfig,
      armory: freeModeArmoryConfig,
      fixedBuildings: freeModeFixedBuildings,
      buildingActions: freeModeBuildingActions,
      casino: freeModeCasinoConfig,
      exchangeOffice: freeModeExchangeOfficeConfig,
      arcade: freeModeArcadeConfig,
      apartmentBlock: freeModeApartmentBlockConfig,
      school: freeModeSchoolConfig,
      warehouse: freeModeWarehouseConfig,
      clinic: freeModeClinicConfig,
      stripClub: freeModeStripClubConfig,
      restaurant: freeModeRestaurantConfig,
      convenienceStore: freeModeConvenienceStoreConfig,
      shoppingMall: freeModeShoppingMallConfig,
      stockExchange: freeModeStockExchangeConfig,
      centralBank: freeModeCentralBankConfig,
      airport: freeModeAirportConfig,
      port: freeModePortConfig,
      parliament: freeModeParliamentConfig,
      cityHall: freeModeCityHallConfig,
      courthouse: freeModeCourthouseConfig,
      lobbyClub: freeModeLobbyClubConfig,
      vipLounge: freeModeVipLoungeConfig,
      fitnessClub: freeModeFitnessClubConfig,
      recruitmentCenter: freeModeRecruitmentCenterConfig,
      garage: freeModeGarageConfig,
      carDealer: freeModeCarDealerConfig,
      smugglingTunnel: freeModeSmugglingTunnelConfig,
      streetDealers: freeModeStreetDealersConfig,
      recyclingCenter: freeModeRecyclingCenterConfig,
      powerStation: freeModePowerStationConfig
    },
    technical: {
      sessionTtlMs: FREE_MODE_HARD_TIMEOUT_MS,
      gameDurationMs: FREE_MODE_HARD_TIMEOUT_MS,
      storageKeyPrefix: "empire:free",
      snapshotIntervalTicks: 8,
      notificationBatchWindowMs: 200,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: false
      }
    },
    publicMeta: {
      mode: "free",
      label: "Empire Streets Free",
      matchStyle: "long",
      tickRateMs: FREE_MODE_TICK_RATE_MS,
      sessionKeyPrefix: "empire:free"
    }
  };
  const mergeModeConfig = (base, override) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    return {
      ...base,
      ...override,
      balance: {
        ...base.balance,
        ...override.balance,
        conflict: {
          ...base.balance.conflict,
          ...((_a = override.balance) == null ? void 0 : _a.conflict) ?? {}
        },
        police: {
          ...base.balance.police,
          ...((_b = override.balance) == null ? void 0 : _b.police) ?? {}
        },
        dayNight: base.balance.dayNight || ((_c = override.balance) == null ? void 0 : _c.dayNight) ? {
          ...base.balance.dayNight,
          ...((_d = override.balance) == null ? void 0 : _d.dayNight) ?? {},
          phases: {
            ...(_e = base.balance.dayNight) == null ? void 0 : _e.phases,
            ...(_g = (_f = override.balance) == null ? void 0 : _f.dayNight) == null ? void 0 : _g.phases
          },
          buildingRules: {
            ...((_h = base.balance.dayNight) == null ? void 0 : _h.buildingRules) ?? {},
            ...((_j = (_i = override.balance) == null ? void 0 : _i.dayNight) == null ? void 0 : _j.buildingRules) ?? {}
          },
          actionRules: {
            ...((_k = base.balance.dayNight) == null ? void 0 : _k.actionRules) ?? {},
            ...((_m = (_l = override.balance) == null ? void 0 : _l.dayNight) == null ? void 0 : _m.actionRules) ?? {}
          }
        } : void 0,
        fixedBuildings: {
          ...base.balance.fixedBuildings ?? {},
          ...((_n = override.balance) == null ? void 0 : _n.fixedBuildings) ?? {}
        },
        buildingActions: {
          ...base.balance.buildingActions ?? {},
          ...((_o = override.balance) == null ? void 0 : _o.buildingActions) ?? {}
        }
      },
      technical: {
        ...base.technical,
        ...override.technical,
        debug: {
          ...base.technical.debug,
          ...(_p = override.technical) == null ? void 0 : _p.debug
        }
      },
      publicMeta: {
        ...base.publicMeta,
        ...override.publicMeta
      }
    };
  };
  const createFreeModeConfig = () => mergeModeConfig(baseResolvedGameModeConfig, freeModeOverride);
  const WAR_MODE_TICK_RATE_MS = 15e3;
  const WAR_MODE_DAY_NIGHT_PHASE_TICKS = resolveDayNightPhaseDurationTicks(WAR_MODE_TICK_RATE_MS);
  const WAR_MODE_RAID_DURATION_TICKS = Math.ceil(60 * 60 * 1e3 / WAR_MODE_TICK_RATE_MS);
  const warModeOverride = {
    mode: "war",
    tickRateMs: WAR_MODE_TICK_RATE_MS,
    balance: {
      incomeMultiplier: 0.85,
      productionMultiplier: 0.85,
      cooldownMultiplier: 1.15,
      maxPlayersPerServer: 150,
      maxAllianceSize: 4,
      allianceLifecycle: {
        readiness: {
          readyIntervalSeconds: 8 * 60 * 60,
          readyButtonAvailableBeforeDueSeconds: 0,
          gracePeriodSeconds: 0,
          voteDurationSeconds: 2 * 60 * 60,
          voteRetryCooldownSeconds: 2 * 60 * 60
        },
        voluntaryLeavePenalty: {
          allianceJoinLockoutSeconds: 24 * 60 * 60,
          allianceCreateLockoutSeconds: 24 * 60 * 60,
          influenceDebuffSeconds: 18 * 60 * 60,
          actionCooldownDebuffSeconds: 12 * 60 * 60,
          formerAllyTruceSeconds: 120 * 60,
          influenceGenerationMultiplier: 0.8,
          actionCooldownMultiplier: 1.15,
          statDebuffSeconds: 12 * 60 * 60,
          attackMultiplier: 0.8,
          defenseMultiplier: 0.8,
          blocksAllianceDefenseSupport: true
        },
        inactiveKickPenalty: {
          allianceJoinLockoutSeconds: 12 * 60 * 60,
          allianceCreateLockoutSeconds: 12 * 60 * 60,
          influenceDebuffSeconds: 0,
          actionCooldownDebuffSeconds: 0,
          statDebuffSeconds: 12 * 60 * 60,
          formerAllyTruceSeconds: 120 * 60,
          influenceGenerationMultiplier: 1,
          actionCooldownMultiplier: 1,
          attackMultiplier: 0.5,
          defenseMultiplier: 0.5,
          productionMultiplier: 0.5,
          incomeMultiplier: 0.5,
          blocksAllianceDefenseSupport: true
        },
        disbandPenalty: {
          allianceJoinLockoutSeconds: 60 * 60,
          allianceCreateLockoutSeconds: 60 * 60,
          influenceDebuffSeconds: 0,
          actionCooldownDebuffSeconds: 0,
          formerAllyTruceSeconds: 120 * 60,
          influenceGenerationMultiplier: 1,
          actionCooldownMultiplier: 1,
          blocksAllianceDefenseSupport: false
        },
        administrativeRemovalPenalty: {
          allianceJoinLockoutSeconds: 0,
          allianceCreateLockoutSeconds: 0,
          influenceDebuffSeconds: 0,
          actionCooldownDebuffSeconds: 0,
          formerAllyTruceSeconds: 0,
          influenceGenerationMultiplier: 1,
          actionCooldownMultiplier: 1,
          blocksAllianceDefenseSupport: false
        },
        affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
        exitPendingTimeoutSeconds: 15 * 60
      },
      buildSlotLimit: 8,
      eventFrequencyMultiplier: 0.9,
      policePressureMultiplier: 1.1,
      raidIntensityMultiplier: 1.15,
      expansionSpeedMultiplier: 0.85,
      dayLengthTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
      nightLengthTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
      dayNight: createDayNightConfig({
        dayDurationTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS,
        nightDurationTicks: WAR_MODE_DAY_NIGHT_PHASE_TICKS
      }),
      police: {
        ...basePoliceConfig,
        raidCooldownTicks: Math.ceil(4 * 60 * 60 * 1e3 / WAR_MODE_TICK_RATE_MS),
        raidDurationTicks: WAR_MODE_RAID_DURATION_TICKS,
        pendingRaidTtlTicks: WAR_MODE_RAID_DURATION_TICKS,
        maxConcurrentRaidsByPhase: {
          day: 1,
          night: 1
        }
      },
      victoryConditionKey: "long-war-control",
      conflict: {
        spyCooldownTicks: 4,
        attackCooldownTicks: 48,
        robCooldownTicks: 40,
        heistCooldownTicks: 32,
        occupyCooldownTicks: 2,
        occupyFailureChancePct: 5,
        minAttackDurationTicks: 48,
        attackHeatGain: 14,
        occupyHeatGain: 2,
        occupyInfluenceCost: 5,
        occupyPopulationRefundPct: 10,
        spyBaseSuccessChance: 0.66,
        spyTrapRevealChance: 0.28,
        trapAttackLosses: 2,
        reportsLimit: 10,
        catastropheChance: 0.1
      },
      startingResources: {
        cash: 1e3,
        "dirty-cash": 250,
        chemicals: 8,
        biomass: 5,
        "metal-parts": 8,
        "tech-core": 1
      }
    },
    technical: {
      sessionTtlMs: 1e3 * 60 * 60 * 24 * 10,
      gameDurationMs: 1e3 * 60 * 60 * 24 * 10,
      storageKeyPrefix: "empire:war",
      snapshotIntervalTicks: 12,
      notificationBatchWindowMs: 400,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: false
      }
    },
    publicMeta: {
      mode: "war",
      label: "Empire Streets War",
      matchStyle: "long",
      tickRateMs: WAR_MODE_TICK_RATE_MS,
      sessionKeyPrefix: "empire:war"
    }
  };
  const createWarModeConfig = () => mergeModeConfig(baseResolvedGameModeConfig, warModeOverride);
  const rawRumorTemplates = [
    {
      id: "rumor.attack_activity.confirmed.occupy_success.001",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "{districtName} změnil vlajku tiše. Ráno už se tam ptali jiných lidí, komu patří chodník.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_success.002",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "V {districtName} se přes noc přepsala pravidla. Nikdo nekřičel, ale všichni pochopili.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_success.003",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "{districtName} spolkl novou posádku a vyplivl nový pořádek. Staré kontakty mlčí.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_success.004",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "Ulice v {districtName} dostaly nové hlídky. Místní dělají, že je to normální.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_success.005",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "{districtName} padl bez velkého divadla. O to víc z toho město znervóznělo.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_failure.001",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "Pokus o převzetí {districtName} se rozpadl v bočních ulicích. Lidi zmizeli, district zůstal volný.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_failure.002",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "{districtName} dnes nikoho nepustil dovnitř. Posádka se rozsypala dřív, než stihla pověsit barvy.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_failure.003",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "V {districtName} někdo čekal moc dlouho na správný signál. Signál nepřišel, lidi ano.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_failure.004",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "Obsazení {districtName} skončilo špatným tichem. Zůstaly jen prázdné kouty a chybějící tváře.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.attack_activity.confirmed.occupy_failure.005",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [],
      text: "{districtName} se tentokrát nepohnul. Ulice sežraly plán i lidi, co ho nesli.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 90
    },
    {
      id: "rumor.population_movement.confirmed.001",
      category: "population_movement",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ulice kolem {districtName} se vyprázdnily rychleji než bar po policejní razii. Někdo odvedl lidi pryč.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.confirmed.002",
      category: "population_movement",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Do {districtName} dorazila početná skupina. Nikdo se neusmívá a všichni mají stejný směr.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.confirmed.003",
      category: "population_movement",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Kamery zachytily zvýšený pohyb členů gangu {playerName}. Místní už zamykají dvěma zámky.",
      expiresAfterSeconds: 900,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.confirmed.004",
      category: "population_movement",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V {districtName} proběhl větší přesun lidí. Město to slyšelo dřív, než to někdo přiznal.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.confirmed.005",
      category: "population_movement",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Část ulic je náhle plná cizích tváří. Tohle není návštěva příbuzných.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.credible.001",
      category: "population_movement",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Říká se, že {districtName} právě polyká nové lidi po desítkách. Nikdo neví, koho bude zítra vyplivovat.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.credible.002",
      category: "population_movement",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V okolí {districtName} se schází víc členů gangu než obvykle. A ne kvůli narozeninám.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.credible.003",
      category: "population_movement",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Místní řidiči vozí lidi jedním směrem a vracejí se sami. To obvykle nevěstí rodinnou oslavu.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.credible.004",
      category: "population_movement",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V zadních ulicích {districtName} přibylo hlídek. Někdo čeká problém, nebo ho právě vyrábí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.credible.005",
      category: "population_movement",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Několik bloků je náhle plných nervózních lidí. Nervozita je levná. Munice už méně.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.suspicion.001",
      category: "population_movement",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V {districtName} je moc pohybu na obyčejnou noc a málo hudby na večírek.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.suspicion.002",
      category: "population_movement",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Taxikáři si stěžují, že pořád vozí stejné typy lidí do stejné části města.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.suspicion.003",
      category: "population_movement",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo v {districtName} svolává svoje lidi. Otázka je, jestli k útoku, obraně, nebo pohřbu.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.suspicion.004",
      category: "population_movement",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ulice zhoustly. Ne deštěm. Lidmi.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.suspicion.005",
      category: "population_movement",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Pár hospodských tvrdí, že se v okolí {districtName} něco chystá. Hospodští tvrdí ledacos, ale tentokrát zavřeli dřív.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.rumor.001",
      category: "population_movement",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Na východě prý někdo sbírá lidi jako drobné ze stolu.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.rumor.002",
      category: "population_movement",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Město šeptá, že {playerName} volá svoje krysy zpátky do jedné díry.",
      expiresAfterSeconds: 900,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.rumor.003",
      category: "population_movement",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo prý vyklízí celé patro bytových bloků. Buď přijde práce, nebo smrt.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.rumor.004",
      category: "population_movement",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Na zastávkách se mluví o přesunu, který má změnit náladu celé čtvrti.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.rumor.005",
      category: "population_movement",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V {districtName} je prý víc bot než dlažebních kostek. To se městu nelíbí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.population_movement.false_possible.001",
      category: "population_movement",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Jeden opilec tvrdí, že {districtName} je plný vojáků. Druhý opilec tvrdí, že první je policajt.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.population_movement.false_possible.002",
      category: "population_movement",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Prý se stahují stovky lidí. Zdroj to počítal přes zamlžené okno a jeden z nich byl popelář.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.population_movement.false_possible.003",
      category: "population_movement",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo tvrdí, že celé bloky mizí do podzemí. Možná mobilizace. Možná porucha tramvají.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.population_movement.false_possible.004",
      category: "population_movement",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V {districtName} se údajně připravuje válka. Stejný člověk včera předpověděl konec světa před obědem.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.population_movement.false_possible.005",
      category: "population_movement",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Říká se, že nikdo nezůstal doma. Jenže ve městě se doma nezůstává ani při požáru.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.weapons_materials.confirmed.001",
      category: "weapons_materials",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "V okolí {districtName} výrazně vzrostla poptávka po bojovém vybavení. Prodavači počítají peníze, doktoři obvazy.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.confirmed.002",
      category: "weapons_materials",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Několik dílen jede přes noc. Když stroje nespí, lidé brzy nebudou spát taky.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.confirmed.003",
      category: "weapons_materials",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Do oblasti dorazily těžké bedny bez označení. V tomhle městě jsou neoznačené bedny vždycky špatná zpráva.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.confirmed.004",
      category: "weapons_materials",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Zbrojní provozy v {districtName} hlásí zvýšenou aktivitu. Kov zpívá a ulice poslouchají.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.confirmed.005",
      category: "weapons_materials",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Na černém trhu zmizela větší várka vybavení. Někdo se připravuje utratit víc než peníze.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.credible.001",
      category: "weapons_materials",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Říká se, že {playerName} nakupuje víc železa, než kolik potřebuje na opravu plotu.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.credible.002",
      category: "weapons_materials",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Dílny v {districtName} jedou naplno. Zápach oleje se míchá s něčím, co připomíná strach.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.credible.003",
      category: "weapons_materials",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Dodavatelé hlásí neobvykle velké objednávky. Nikdo se neptá proč. Ti chytří se neptají nikdy.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.credible.004",
      category: "weapons_materials",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "V zadních skladech se prý hromadí výbava. A bedny jsou příliš těžké na oblečení.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.credible.005",
      category: "weapons_materials",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Místní kováři mají práci. Místní hrobníci se začínají usmívat.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.suspicion.001",
      category: "weapons_materials",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "V {districtName} se v noci svítí v každé dílně. Buď vyrábějí zázrak, nebo problém.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.suspicion.002",
      category: "weapons_materials",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Nákladní auta přijíždějí plná a odjíždějí prázdná. Papíry tvrdí, že vezou nábytek.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.suspicion.003",
      category: "weapons_materials",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Někdo skupuje materiál rychleji, než ho trh stíhá nacenit.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.suspicion.004",
      category: "weapons_materials",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "V okolí skladů přibyly ozbrojené hlídky. Nikdo nehlídá prázdné regály.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.suspicion.005",
      category: "weapons_materials",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Zbrojovky mlčí, ale komíny mluví za ně.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.rumor.001",
      category: "weapons_materials",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Po městě se povídá, že někdo staví dost železa na malou válku.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.rumor.002",
      category: "weapons_materials",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Prý zmizela celá zásilka bojového vybavení. Policie hledá dodávku. Gangy hledají kupce.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.rumor.003",
      category: "weapons_materials",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Někdo v {districtName} údajně skládá zbraně jako jiní skládají básně. Jen s horší pointou.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.rumor.004",
      category: "weapons_materials",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Na trhu koluje řeč o tajné objednávce. Cena byla vysoká. Mlčení ještě vyšší.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.rumor.005",
      category: "weapons_materials",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Říká se, že příští výstřel bude dražší než poslední.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.false_possible.001",
      category: "weapons_materials",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Jeden překupník tvrdí, že viděl raketu v krabici od pizzy. Byl to překupník. A byla to velká pizza.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.false_possible.002",
      category: "weapons_materials",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Prý se vyrábí nová superzbraň. Zdroj nepoznal granát od termosky.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.false_possible.003",
      category: "weapons_materials",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Někdo údajně vyzbrojil půl města. Druhá půlka to zatím nepotvrdila.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.false_possible.004",
      category: "weapons_materials",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Po barech se mluví o bednách plných zlata a zbraní. Obvykle jsou plné šroubů.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.weapons_materials.false_possible.005",
      category: "weapons_materials",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club"
      ],
      text: "Říká se, že zbrojovka v {districtName} nikdy nezhasíná. Majitel tvrdí, že jen zapomněl vypínač.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.district_defense.confirmed.001",
      category: "district_defense",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Obrana {districtName} byla nedávno oslabena. Zdi stojí, sebevědomí méně.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.confirmed.002",
      category: "district_defense",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Po posledním střetu zůstaly v {districtName} viditelné škody. Některé se opravují hůř než beton.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.confirmed.003",
      category: "district_defense",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Vstupy do districtu byly dodatečně zabezpečeny. Někdo se bojí návštěvy.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.confirmed.004",
      category: "district_defense",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Na střechách přibyly hlídky. Město má teď víc očí a méně klidu.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.confirmed.005",
      category: "district_defense",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Obranné pozice v {districtName} se změnily. Kdo znal starou cestu dovnitř, zná už jen cestu do márnice.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.credible.001",
      category: "district_defense",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Místní tvrdí, že {districtName} je po poslední ráně měkčí než obvykle.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.credible.002",
      category: "district_defense",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Říká se, že obránci nestíhají opravovat všechno, co jim nepřátelé rozbili.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.credible.003",
      category: "district_defense",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "V okolí {districtName} se shání víc betonu, kamer a nervů.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.credible.004",
      category: "district_defense",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Několik hlídek zmizelo ze svých obvyklých míst. Někdo je přesunul, nebo někdo odstranil.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.credible.005",
      category: "district_defense",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "District působí pevněji než včera. Město nerado vidí, když se kořist naučí kousat.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.suspicion.001",
      category: "district_defense",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Brána se zavírá dřív a otevírá později. To bývá známka strachu, ne pořádku.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.suspicion.002",
      category: "district_defense",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Na zdech je čerstvá barva. Pod čerstvou barvou bývají čerstvé díry.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.suspicion.003",
      category: "district_defense",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Hlídky v {districtName} vypadají unaveně. Unavený obránce je pořád obránce.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.suspicion.004",
      category: "district_defense",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Některé kamery se otáčejí jinam než dřív. Buď nový plán, nebo stará chyba.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.suspicion.005",
      category: "district_defense",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "U vstupů přibyly překážky. Nikdo nestaví barikádu proti dobrým zprávám.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.rumor.001",
      category: "district_defense",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Prý je {districtName} skoro bez obrany. Tohle tvrzení už poslalo do hrobu víc lidí než kulky.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.rumor.002",
      category: "district_defense",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Mluví se o slabém místě na severní straně. V tomhle městě má každá slabina cenu.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.rumor.003",
      category: "district_defense",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Říká se, že obránci čekají pomoc, která nepřijde.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.rumor.004",
      category: "district_defense",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Někdo slyšel, že district drží pohromadě jen dráty, nadávky a poslední směna.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.rumor.005",
      category: "district_defense",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Po městě běhá řeč, že {districtName} je připraven padnout. Řeči běhají rychleji než armády.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.district_defense.false_possible.001",
      category: "district_defense",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Jeden bezdomovec tvrdí, že brána je otevřená. Možná myslel supermarket.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.district_defense.false_possible.002",
      category: "district_defense",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Prý nejsou na střechách žádné hlídky. Zdroj se díval ze sklepa.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.district_defense.false_possible.003",
      category: "district_defense",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Někdo tvrdí, že obrana zmizela. Někdo jiný tvrdí, že první někdo zmizel.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.district_defense.false_possible.004",
      category: "district_defense",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Říká se, že district chrání jen jeden pes. Pes se k tomu odmítl vyjádřit.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.district_defense.false_possible.005",
      category: "district_defense",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "vip_lounge"
      ],
      text: "Fáma tvrdí, že všechny kamery jsou slepé. Fámy samy většinou nevidí nic.",
      expiresAfterSeconds: 1800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.attack_activity.confirmed.001",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "V {districtName} proběhl ozbrojený střet. Město se ráno probudilo o něco tišší.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.confirmed.002",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "District změnil vlastníka. Staré vlajky hořely krátce, nové budou možná hořet déle.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.confirmed.003",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Útok byl odražen. Útočníci nechali na ulici víc než jen sebevědomí.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.confirmed.004",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Obrana padla, ale district zůstal neobsazený. Někdo rozbil dveře a zapomněl projít.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.confirmed.005",
      category: "attack_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Střet skončil katastrofou. Oheň měl poslední slovo a nebylo krátké.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.credible.001",
      category: "attack_activity",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Říká se, že {playerName} připravuje něco hlučného v okolí {districtName}.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.credible.002",
      category: "attack_activity",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "V ulicích se objevili lidé, kteří nevypadají, že přišli vyjednávat.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.credible.003",
      category: "attack_activity",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Z blízkých districtů mizí hlídky a zásoby. Někdo je soustředí jinam.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.credible.004",
      category: "attack_activity",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Místní slyšeli krátké rozkazy a dlouhé ticho. To bývá předehra.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.credible.005",
      category: "attack_activity",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Někdo si v okolí {districtName} kreslí mapy. Ne turistické.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.suspicion.001",
      category: "attack_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Na střechách je příliš mnoho pozorovatelů a příliš málo holubů.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.suspicion.002",
      category: "attack_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Doprava v okolí {districtName} houstne. Řidiči se neptají, kdo sedí vzadu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.suspicion.003",
      category: "attack_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Rádio zachytilo krátké šifrované zprávy. Buď útok, nebo velmi špatná poezie.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.suspicion.004",
      category: "attack_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Některé gangy náhle ztichly. Ticho je ve městě často nabitá zbraň.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.suspicion.005",
      category: "attack_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "V okolí cílových ulic se objevují cizí hlídky. Možná průzkum. Možná ztracené duše.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.rumor.001",
      category: "attack_activity",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Mluví se o útoku, který má přijít bez varování. Což je zvláštní, když o něm mluví celé město.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.rumor.002",
      category: "attack_activity",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Prý se chystá krev na severu. Déšť ji pak odnese na jih.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.rumor.003",
      category: "attack_activity",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Někdo tvrdí, že {playerName} už vybral cíl. Cíl zatím neví, že je cílem.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.rumor.004",
      category: "attack_activity",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Po barech koluje mapa s jedním místem zakroužkovaným červeně.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.rumor.005",
      category: "attack_activity",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Říká se, že zítřejší ráno bude patřit vítězům. A dnešní noc pohřebním službám.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.attack_activity.false_possible.001",
      category: "attack_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Prý zaútočí všichni na všechny. Zdroj si spletl plán útoku s účtem v restauraci.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.attack_activity.false_possible.002",
      category: "attack_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Někdo tvrdí, že útok začne o půlnoci. Ve městě je vždycky někde půlnoc.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.attack_activity.false_possible.003",
      category: "attack_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Fáma mluví o tajné armádě v kanálech. Kanalizace hlásí jen krysy.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.attack_activity.false_possible.004",
      category: "attack_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Údajný cíl útoku se mění podle toho, kdo zrovna platí rundu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.attack_activity.false_possible.005",
      category: "attack_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge"
      ],
      text: "Prý je válka nevyhnutelná. V Empire Streets je nevyhnutelná hlavně další fáma.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.espionage.confirmed.001",
      category: "espionage",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V {districtName} byl odhalen cizí pozorovatel. Neviděl všechno. Možná viděl dost.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.confirmed.002",
      category: "espionage",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Bezpečnost zachytila pokus o průnik. Někdo teď ví méně, než doufal, a víc, než by měl.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.confirmed.003",
      category: "espionage",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Podezřelá osoba byla zadržena poblíž strategického bodu. Její kapsy byly prázdné, oči ne.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.confirmed.004",
      category: "espionage",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V districtu proběhla bezpečnostní kontrola. Některé dveře se zavřely. Některé lidi taky.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.confirmed.005",
      category: "espionage",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Špehovací aktivita v oblasti vzrostla. Tajemství začínají být dražší než munice.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.credible.001",
      category: "espionage",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Místní si všimli tváří, které se dívají déle, než je slušné.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.credible.002",
      category: "espionage",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V {districtName} se někdo vyptává na směny, sklady a zadní vchody.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.credible.003",
      category: "espionage",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Několik kamer zachytilo stejného člověka na různých místech. Buď špeh, nebo velmi špatný turista.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.credible.004",
      category: "espionage",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo mapuje okolí. Dělá to pomalu, opatrně a bez zájmu o architekturu.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.credible.005",
      category: "espionage",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V baru padaly otázky, za které se jinde platí penězi. Tady se platí zuby.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.suspicion.001",
      category: "espionage",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Jeden muž seděl tři hodiny nad prázdnou sklenicí a sledoval dveře.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.suspicion.002",
      category: "espionage",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Místní prodavač tvrdí, že se ho někdo ptal na věci, které zákazníky obvykle nezajímají.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.suspicion.003",
      category: "espionage",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Některé kamery na chvíli osleply. Náhoda má ve městě drahé právníky.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.suspicion.004",
      category: "espionage",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V districtu se pohybuje cizinec, který zná příliš mnoho ulic a příliš málo lidí.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.suspicion.005",
      category: "espionage",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo nechal otevřený servisní vstup. Možná chyba. Možná pozvánka.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.rumor.001",
      category: "espionage",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že {playerName} má oči tam, kde jiní mají jen zdi.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.rumor.002",
      category: "espionage",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Prý se v {districtName} ztratil špeh. Ve skutečnosti se špehové neztrácejí. Jen přestávají hlásit.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.rumor.003",
      category: "espionage",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo prodává informace o místních hlídkách. Cena se mění podle toho, kdo se ptá.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.rumor.004",
      category: "espionage",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Po městě koluje seznam zadních vchodů. Každý seznam má jedno jméno navíc a jednu díru v hlavě.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.rumor.005",
      category: "espionage",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že někdo ví, co je uvnitř. Nikdo ale neví, kdo to ví.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 30
    },
    {
      id: "rumor.espionage.false_possible.001",
      category: "espionage",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Jeden číšník tvrdí, že každý druhý host je špeh. První host je číšník.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.espionage.false_possible.002",
      category: "espionage",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Prý kamery zachytily neviditelného muže. Kamery byly vypnuté.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.espionage.false_possible.003",
      category: "espionage",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo označil pošťáka za agenta. Pošťák požaduje omluvu a lepší dýško.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.espionage.false_possible.004",
      category: "espionage",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Fáma tvrdí, že špeh bydlí přímo v {districtName}. Stejná fáma uvádí tři různé adresy.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.espionage.false_possible.005",
      category: "espionage",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že informace unikají skrz kanalizaci. Kanalizace zatím mlčí.",
      expiresAfterSeconds: 1200,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 30
    },
    {
      id: "rumor.heist_robbery.confirmed.001",
      category: "heist_robbery",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V {districtName} proběhla loupežná operace. Peníze změnily majitele rychleji než svědomí.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.confirmed.002",
      category: "heist_robbery",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Bezpečnost zaznamenala násilný průnik. Trezor přežil méně než pověst majitele.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.confirmed.003",
      category: "heist_robbery",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Z oblasti zmizela část zásob. Zloději nezanechali podpis, jen účet.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.confirmed.004",
      category: "heist_robbery",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Noční operace skončila střelbou a prázdnými regály.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.confirmed.005",
      category: "heist_robbery",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V districtu byl narušen provoz. Některé podniky počítají ztráty. Jiné nové zákazníky.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.credible.001",
      category: "heist_robbery",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že někdo sleduje tok peněz přes {districtName}. Peníze se nikdy necítí bezpečně.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.credible.002",
      category: "heist_robbery",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V okolí zadních vchodů přibyly hlídky. Trezor nejspíš nespí klidně.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.credible.003",
      category: "heist_robbery",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Několik zaměstnanců bylo posláno domů dřív. Když zaměstnanci odcházejí, profesionálové často přicházejí.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.credible.004",
      category: "heist_robbery",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Místní bezpečnost mění směny bez vysvětlení. Vysvětlení obvykle přijde s maskou.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.credible.005",
      category: "heist_robbery",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo shání plán budovy, rozpis hlídek a tiché auto.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.suspicion.001",
      category: "heist_robbery",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Nad {districtName} krouží víc dronů než obvykle. Nikdo nefotí panorama.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.suspicion.002",
      category: "heist_robbery",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Jedna dodávka projela stejnou ulicí čtyřikrát. Řidič tvrdil, že hledá adresu.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.suspicion.003",
      category: "heist_robbery",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "V zadní uličce byly nalezeny odstřižené kabely. Krysy používají zuby, profesionálové kleště.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.suspicion.004",
      category: "heist_robbery",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Bezpečnostní personál je nervózní. Nervózní hlídač bývá první kapitola loupeže.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.suspicion.005",
      category: "heist_robbery",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo testuje alarmy. Město to slyší jako krátké výkřiky kovu.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.rumor.001",
      category: "heist_robbery",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Prý se chystá heist, po kterém budou bankéři spát s rozsvíceným světlem.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.rumor.002",
      category: "heist_robbery",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo údajně koupil tři masky a jeden velmi čistý oblek.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.rumor.003",
      category: "heist_robbery",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Po barech se šeptá o trezoru, který má do rána změnit názor na vlastnictví.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.rumor.004",
      category: "heist_robbery",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že příští velká loupež nebude hlučná. Jen drahá.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.rumor.005",
      category: "heist_robbery",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo nabízí podíl za mapu ventilace. Nikdo neví, které budovy.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.false_possible.001",
      category: "heist_robbery",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Prý se bude krást v každé bance zároveň. Zdroj nezvládá ani dvě kapsy.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.false_possible.002",
      category: "heist_robbery",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Někdo tvrdí, že trezor už je prázdný. Majitel ho přesto hlídá jako poslední dítě.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.false_possible.003",
      category: "heist_robbery",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Fáma mluví o tunelu pod celým městem. Bagry o něm nevědí.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.false_possible.004",
      category: "heist_robbery",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Údajný lup má cenu celého districtu. Údajný zdroj dluží za večeři.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.heist_robbery.false_possible.005",
      category: "heist_robbery",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "convenience_store"
      ],
      text: "Říká se, že heist povede duch. Duch si zatím nesehnal řidiče.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.economy.confirmed.001",
      category: "economy",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Ekonomická aktivita v {districtName} výrazně vzrostla. Peníze tečou a někdo drží kohoutek.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.confirmed.002",
      category: "economy",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Místní podniky hlásí silnější provoz. Ulice jsou bohatší a nervóznější.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.confirmed.003",
      category: "economy",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "V oblasti proběhlo několik velkých transakcí. Čísla jsou čistá. Původ méně.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.confirmed.004",
      category: "economy",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Směnárny v {districtName} jedou přesčas. Peníze mění barvu rychleji než neon.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.confirmed.005",
      category: "economy",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Obchodní provoz se zpomalil. Některé pokladny ztichly dřív než majitelé.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.credible.001",
      category: "economy",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Říká se, že {playerName} pere peníze tak rychle, že už ani nestíhají schnout.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.credible.002",
      category: "economy",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "V {districtName} se poslední dobou utrácí víc, než se přiznává.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.credible.003",
      category: "economy",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Účetní v okolí mají kruhy pod očima. To je ekonomický ukazatel, který nelže.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.credible.004",
      category: "economy",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Některé podniky kupují zásoby ve velkém. Buď čekají růst, nebo pohřeb konkurence.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.credible.005",
      category: "economy",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Místní bankéři zavírají dveře, ale otevírají trezory.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.suspicion.001",
      category: "economy",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Peníze v districtu obíhají podivně. Moc rychle na běžný obchod, moc tiše na legalitu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.suspicion.002",
      category: "economy",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Několik firem vykázalo náhlý růst. Ve městě roste rychle jen plevel a dluh.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.suspicion.003",
      category: "economy",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Kurýři vozí obálky mezi podniky, které spolu oficiálně nemluví.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.suspicion.004",
      category: "economy",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Pokladny zvoní i po zavírací době.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.suspicion.005",
      category: "economy",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Některé ceny přestaly dávat smysl. To obvykle znamená, že smysl dává někomu jinému.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.rumor.001",
      category: "economy",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Mluví se o penězích tak špinavých, že by za ně policie potřebovala rukavice.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.rumor.002",
      category: "economy",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Prý má {districtName} nového tichého investora. Tichý investor bývá hlasitý až při výběru dluhu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.rumor.003",
      category: "economy",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Někdo údajně kupuje podniky přes prostředníky, kteří nemají prostředky.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.rumor.004",
      category: "economy",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Říká se, že v jedné kanceláři se počítají peníze celou noc. Ráno se počítají lidé.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.rumor.005",
      category: "economy",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Po městě koluje řeč, že někdo sedí na hromadě cash. Hromady přitahují lopaty.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.economy.false_possible.001",
      category: "economy",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Jeden taxikář tvrdí, že {playerName} vlastní půl města. Druhou půlku prý vlastní jeho bratranec.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.economy.false_possible.002",
      category: "economy",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Prý jsou všechny trezory plné. Bankéři se tomu smějí až příliš hlasitě.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.economy.false_possible.003",
      category: "economy",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Někdo tvrdí, že peníze prší ze střech. Včera pršely jen účtenky.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.economy.false_possible.004",
      category: "economy",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Fáma mluví o tajném zlatém skladu. Zatím se našel jen sklad žluté barvy.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.economy.false_possible.005",
      category: "economy",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "central_bank",
        "stock_exchange"
      ],
      text: "Říká se, že ekonomika districtu stojí na jednom člověku. Ten člověk o tom neví.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.police_heat.confirmed.001",
      category: "police_heat",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Policejní přítomnost v {districtName} zesílila. Sirény zní jako špatně naladěná hymna.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.confirmed.002",
      category: "police_heat",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "V oblasti proběhla razie. Policie odvezla důkazy, lidi a pár dveří.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.confirmed.003",
      category: "police_heat",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "District je pod zvýšeným dohledem. Kamery sledují kamery.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.confirmed.004",
      category: "police_heat",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Policejní tlak po nedávné akci vzrostl. Město má dlouhou paměť a krátkou pojistku.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.confirmed.005",
      category: "police_heat",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Část provozu byla dočasně uzavřena. Policie tvrdí, že kvůli bezpečnosti. Ulice tvrdí něco jiného.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.credible.001",
      category: "police_heat",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Říká se, že policie má {districtName} vysoko na seznamu. Seznam je dlouhý. Trpělivost krátká.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.credible.002",
      category: "police_heat",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Hlídky se střídají častěji a zůstávají déle.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.credible.003",
      category: "police_heat",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Někdo z magistrátu prý začal klást otázky. Otázky od magistrátu obvykle nosí pouta.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.credible.004",
      category: "police_heat",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Policejní drony se vracejí do stejné oblasti. Drony nemají intuici. Jen instrukce.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.credible.005",
      category: "police_heat",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "V okolí se objevily neoznačené vozy. Označení chybí, zájem ne.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.suspicion.001",
      category: "police_heat",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Policisté v {districtName} přestali pít kávu a začali sledovat vchody.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.suspicion.002",
      category: "police_heat",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Několik hlídek dostalo nové trasy. Všechny vedou nepříjemně blízko.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.suspicion.003",
      category: "police_heat",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Rádio policie je hlučnější než obvykle. Nikdo neříká proč.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.suspicion.004",
      category: "police_heat",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Místní překupníci mizí z ulic. Krysy bývají první, kdo cítí kouř.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.suspicion.005",
      category: "police_heat",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "V garážích policie se tankuje přesčas.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.rumor.001",
      category: "police_heat",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Prý se chystá razie, po které budou chybět nejen dveře.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.rumor.002",
      category: "police_heat",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Někdo tvrdí, že policie má informátora uvnitř {districtName}. Někdo jiný tvrdí, že informátor už nemá jazyk.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: true,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.rumor.003",
      category: "police_heat",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Říká se, že další zásah přijde před svítáním. Svítání to odmítlo komentovat.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.rumor.004",
      category: "police_heat",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Po městě koluje seznam sledovaných districtů. Každý má jinou verzi.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.rumor.005",
      category: "police_heat",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Prý někdo nahoře rozhodl, že {playerName} už měl příliš klidnou noc.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: true,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.police_heat.false_possible.001",
      category: "police_heat",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Jeden opilec tvrdí, že policie uzavře celé město. Druhý tvrdí, že první je starosta.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.police_heat.false_possible.002",
      category: "police_heat",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Prý je každý neoznačený vůz policejní. To by z policie dělalo největší taxislužbu ve městě.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.police_heat.false_possible.003",
      category: "police_heat",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Někdo tvrdí, že razie proběhne přesně za hodinu. Zdroj nevlastní hodinky.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.police_heat.false_possible.004",
      category: "police_heat",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Fáma mluví o tajné policejní armádě. Zatím se našli čtyři unavení strážníci.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.police_heat.false_possible.005",
      category: "police_heat",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "selected_district",
        "global_city",
        "police"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store",
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall"
      ],
      text: "Říká se, že Heat už dosáhl maxima. Teploměr se rozbil.",
      expiresAfterSeconds: 2400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.confirmed.001",
      category: "alliance_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Členové aliance {allianceName} byli aktivní ve stejné části města. Náhoda už požádala o právníka.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.confirmed.002",
      category: "alliance_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Několik districtů aliance změnilo obranné rozložení ve stejnou dobu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.confirmed.003",
      category: "alliance_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Aliance {allianceName} koordinovala přesun lidí a zásob. Město vidí vzorec.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.confirmed.004",
      category: "alliance_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Společná operace aliance skončila otevřeným konfliktem.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.confirmed.005",
      category: "alliance_activity",
      confidence: "confirmed",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Aliance posílila přítomnost v okolí {zoneName}. Mapa začíná vypadat těsněji.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.credible.001",
      category: "alliance_activity",
      confidence: "credible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Říká se, že {allianceName} dýchá jedním tempem. To je špatná zpráva pro každého poblíž.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.credible.002",
      category: "alliance_activity",
      confidence: "credible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Několik členů aliance nakupuje stejné věci a dívá se stejným směrem.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.credible.003",
      category: "alliance_activity",
      confidence: "credible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Kurýři mezi členy aliance mají plné ruce a prázdné výrazy.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.credible.004",
      category: "alliance_activity",
      confidence: "credible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "V {zoneName} se schází příliš mnoho lidí z jedné aliance.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.credible.005",
      category: "alliance_activity",
      confidence: "credible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Někdo rozděluje úkoly. Někdo jiný už nejspíš rozdělil cíle.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.suspicion.001",
      category: "alliance_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Členové {allianceName} přestali útočit jednotlivě. Ticho mezi ranami je podezřele přesné.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.suspicion.002",
      category: "alliance_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Stejné symboly se objevily na několika místech během jedné noci.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.suspicion.003",
      category: "alliance_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Vysílačky aliance jsou aktivní. Obsah není známý. Tón stačí.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.suspicion.004",
      category: "alliance_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Několik districtů reagovalo na stejný signál.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.suspicion.005",
      category: "alliance_activity",
      confidence: "suspicion",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Aliance se pohybuje, jako by někdo držel mapu a ostatní nože.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.rumor.001",
      category: "alliance_activity",
      confidence: "rumor",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Prý {allianceName} plánuje velký tah. Velké tahy dělají velké stíny.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.rumor.002",
      category: "alliance_activity",
      confidence: "rumor",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Mluví se o tajné dohodě, která má změnit rovnováhu města.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.rumor.003",
      category: "alliance_activity",
      confidence: "rumor",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Někdo tvrdí, že aliance už rozdělila cizí území mezi své členy.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.rumor.004",
      category: "alliance_activity",
      confidence: "rumor",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Po městě koluje řeč, že příští útok přijde ze čtyř stran.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.rumor.005",
      category: "alliance_activity",
      confidence: "rumor",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Říká se, že {allianceName} už ví, kdo bude první na řadě.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: true,
      revealsDistrictName: false,
      weight: 1,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.false_possible.001",
      category: "alliance_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Prý se dvě aliance spojily. Obě to popírají a obě mají stejnou tiskovou zprávu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.false_possible.002",
      category: "alliance_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Jeden barman tvrdí, že zná celý plán aliance. Nezná ani vlastní směnu.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.false_possible.003",
      category: "alliance_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Fáma říká, že členové aliance sdílejí jednu mysl. Zatím nesdílejí ani účet.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.false_possible.004",
      category: "alliance_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Někdo tvrdí, že útok přijde ze všech stran. Geografie to zatím nepotvrdila.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.alliance_activity.false_possible.005",
      category: "alliance_activity",
      confidence: "false_possible",
      allowedAudiences: [
        "alliance",
        "global_city",
        "current_player"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club"
      ],
      text: "Říká se, že aliance má tajného pátého člena. Možná je to účetní.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 70
    },
    {
      id: "rumor.market.confirmed.001",
      category: "market",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Poptávka po {marketCategory} vzrostla. Trh ucítil krev a přidal přirážku.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.confirmed.002",
      category: "market",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Cena {marketCategory} výrazně klesla. Někdo vykládá zásoby rychleji než svědomí.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.confirmed.003",
      category: "market",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Na trhu se objevil neobvykle velký objem zboží.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.confirmed.004",
      category: "market",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Několik obchodníků stáhlo nabídky. Buď čekají růst, nebo návštěvu policie.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.confirmed.005",
      category: "market",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Černý trh reagoval na nedávné události. Ceny jsou nervózní.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.credible.001",
      category: "market",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Říká se, že někdo skupuje {marketCategory} dřív, než si ostatní všimli.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.credible.002",
      category: "market",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Obchodníci si šeptají o nedostatku. Nahlas říkají, že je vše v pořádku.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.credible.003",
      category: "market",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Několik velkých zákazníků se ptalo na stejné zboží.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.credible.004",
      category: "market",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Dodavatelé začali požadovat platbu předem. To je jejich způsob, jak říct: bude zle.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.credible.005",
      category: "market",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Trh se naklání jedním směrem. Někdo pod stolem tlačí.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.suspicion.001",
      category: "market",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Ceny skáčou bez zjevného důvodu. Ve městě je vždycky důvod. Jen nebývá zjevný.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.suspicion.002",
      category: "market",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Některé položky mizí ze seznamů dřív, než se objeví kupci.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.suspicion.003",
      category: "market",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Překupníci odmítají prodávat obvyklé množství.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.suspicion.004",
      category: "market",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Na trhu koluje víc hotovosti a méně zboží.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.suspicion.005",
      category: "market",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Několik cen se změnilo během jedné hodiny. To není ekonomika. To je panika v obleku.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.rumor.001",
      category: "market",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Prý někdo chystá umělý nedostatek.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.rumor.002",
      category: "market",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Říká se, že další dodávka nepřijde.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.rumor.003",
      category: "market",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Někdo údajně koupil všechno, co mělo kov, kabel nebo spoušť.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.rumor.004",
      category: "market",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Po městě se šeptá, že zítřejší ceny budou bolet víc než dnešní.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.rumor.005",
      category: "market",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Prý se na trhu chystá finanční nástrah. Ne ta v districtu. Ta finanční.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.market.false_possible.001",
      category: "market",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Jeden obchodník tvrdí, že ceny zítra klesnou na polovinu. Dnes zdvojnásobil svoje.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.market.false_possible.002",
      category: "market",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Prý už není žádné zboží. Sklady se tomu smějí.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.market.false_possible.003",
      category: "market",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Někdo tvrdí, že trh ovládá jediný člověk. Ten člověk momentálně hledá drobné.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.market.false_possible.004",
      category: "market",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Fáma mluví o kolapsu. Trh mezitím prodává normálně, jen dráž.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.market.false_possible.005",
      category: "market",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city"
      ],
      allowedSourceBuildings: [
        "stock_exchange"
      ],
      text: "Říká se, že všechny ceny jsou podvod. V tomhle městě je to spíš filozofie než zpráva.",
      expiresAfterSeconds: 3600,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.downtown_power.confirmed.001",
      category: "downtown_power",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V Downtownu proběhla neveřejná schůzka několika vlivných lidí. Veřejnost nebyla pozvána. Důsledky ano.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.confirmed.002",
      category: "downtown_power",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Magistrát změnil přístup k jedné z městských oblastí.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.confirmed.003",
      category: "downtown_power",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V soudních kancelářích přibylo případů spojených s gangy.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.confirmed.004",
      category: "downtown_power",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Centrální banka zaznamenala neobvyklé finanční pohyby.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.confirmed.005",
      category: "downtown_power",
      confidence: "confirmed",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "VIP podniky v Downtownu hlásí zvýšenou návštěvnost významných osob.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.credible.001",
      category: "downtown_power",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Říká se, že někdo kupuje vliv rychleji, než ho město stíhá prodávat.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.credible.002",
      category: "downtown_power",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V lobby klubu se mluvilo šeptem a platilo v hotovosti.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.credible.003",
      category: "downtown_power",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Několik úředníků změnilo názor během jedné večeře.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.credible.004",
      category: "downtown_power",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Soudci dnes chodí s ochrankou. To je buď opatrnost, nebo přiznání.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.credible.005",
      category: "downtown_power",
      confidence: "credible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V bance se otevřely dveře, které běžně nemají kliku.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.suspicion.001",
      category: "downtown_power",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V Downtownu se pohybují lidé, kteří nikdy nečekají ve frontě.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.suspicion.002",
      category: "downtown_power",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Několik politiků odvolalo program. Náhradní program nebyl zveřejněn.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.suspicion.003",
      category: "downtown_power",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "VIP salonek zavřel celé patro pro soukromou společnost.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.suspicion.004",
      category: "downtown_power",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Úřední auta parkují na místech, kde obvykle parkují jen problémy.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.suspicion.005",
      category: "downtown_power",
      confidence: "suspicion",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "V soudní budově se svítí dlouho do noci.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.rumor.001",
      category: "downtown_power",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Prý někdo koupil rozhodnutí dřív, než bylo napsáno.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.rumor.002",
      category: "downtown_power",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Říká se, že magistrát už ví, kdo bude příští obětní beránek.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.rumor.003",
      category: "downtown_power",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Někdo tvrdí, že jeden podpis může zastavit razii. Podpis stojí víc než district.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.rumor.004",
      category: "downtown_power",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Po Downtownu koluje řeč o nové dohodě mezi penězi a mocí.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.rumor.005",
      category: "downtown_power",
      confidence: "rumor",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Prý někdo vlastní polovinu soudců. Druhou polovinu si jen pronajímá.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 50
    },
    {
      id: "rumor.downtown_power.false_possible.001",
      category: "downtown_power",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Jeden číšník tvrdí, že slyšel státní tajemství. Stál u špatného stolu.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.downtown_power.false_possible.002",
      category: "downtown_power",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Prý banka tiskne peníze pro gangy. Tiskárna momentálně tiskne formuláře.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.downtown_power.false_possible.003",
      category: "downtown_power",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Někdo tvrdí, že magistrát řídí umělá inteligence. Úřední tempo tomu neodpovídá.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.downtown_power.false_possible.004",
      category: "downtown_power",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Fáma říká, že soudce zmizel. Soudce byl na obědě.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.downtown_power.false_possible.005",
      category: "downtown_power",
      confidence: "false_possible",
      allowedAudiences: [
        "current_player",
        "global_city",
        "alliance"
      ],
      allowedSourceBuildings: [
        "strip_club",
        "vip_lounge",
        "lobby_club",
        "city_hall",
        "central_bank"
      ],
      text: "Říká se, že Downtown ovládá jediný muž. Ve skutečnosti se o to hádá příliš mnoho mužů.",
      expiresAfterSeconds: 5400,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 50
    },
    {
      id: "rumor.final_lockdown.confirmed.001",
      category: "final_lockdown",
      confidence: "confirmed",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Final Lockdown byl zahájen. Město zavřelo dveře a nechalo uvnitř všechny chyby.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.confirmed.002",
      category: "final_lockdown",
      confidence: "confirmed",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Bezpečnostní režim města se zpřísnil. Každý pohyb teď vrhá delší stín.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.confirmed.003",
      category: "final_lockdown",
      confidence: "confirmed",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Zbývající mocnosti byly oficiálně označeny jako hlavní soupeři.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.confirmed.004",
      category: "final_lockdown",
      confidence: "confirmed",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Některé oblasti byly uzavřeny. Město se zmenšuje. Nenávist ne.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.confirmed.005",
      category: "final_lockdown",
      confidence: "confirmed",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Finální střet se přiblížil. Na mapě ubývá barev a přibývá jmen mrtvých.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.credible.001",
      category: "final_lockdown",
      confidence: "credible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Říká se, že město už vybralo svoje poslední predátory.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.credible.002",
      category: "final_lockdown",
      confidence: "credible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Hlídky se stahují k rozhodujícím bodům.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.credible.003",
      category: "final_lockdown",
      confidence: "credible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Aliance přestávají skrývat své skutečné hranice.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.credible.004",
      category: "final_lockdown",
      confidence: "credible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Některé distrikty se připravují na poslední noc.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.credible.005",
      category: "final_lockdown",
      confidence: "credible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "V ulicích je cítit konec. Má kovovou chuť.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.suspicion.001",
      category: "final_lockdown",
      confidence: "suspicion",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "V centru se instalují nové zátarasy.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.suspicion.002",
      category: "final_lockdown",
      confidence: "suspicion",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Komunikační kanály jsou přetížené.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.suspicion.003",
      category: "final_lockdown",
      confidence: "suspicion",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Silní hráči stahují zdroje blíž k jádru svého území.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.suspicion.004",
      category: "final_lockdown",
      confidence: "suspicion",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Menší gangy mizí z mapy nebo pod cizími barvami.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.suspicion.005",
      category: "final_lockdown",
      confidence: "suspicion",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Město zní tišeji. To není klid. To je nádech.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.rumor.001",
      category: "final_lockdown",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Prý zbývá poslední velký tah.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.rumor.002",
      category: "final_lockdown",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Říká se, že vítěz už byl vybrán. Vítěz o tom zatím neví.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.rumor.003",
      category: "final_lockdown",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Někdo tvrdí, že poslední noc bude kratší než všechny předchozí.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.rumor.004",
      category: "final_lockdown",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Po městě koluje řeč, že některé aliance se rozpadnou ještě před bojem.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.rumor.005",
      category: "final_lockdown",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Prý se brzy ukáže, kdo stavěl impérium a kdo jen světelnou reklamu.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.false_possible.001",
      category: "final_lockdown",
      confidence: "false_possible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Jeden prorok tvrdí, že město padne o půlnoci. Prorok si nepamatuje datum.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.false_possible.002",
      category: "final_lockdown",
      confidence: "false_possible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Prý se všechny distrikty zamknou najednou. Zámečníci protestují.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.false_possible.003",
      category: "final_lockdown",
      confidence: "false_possible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Někdo tvrdí, že vítěz dostane celé město bez odporu. Město se hlasitě zasmálo.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.false_possible.004",
      category: "final_lockdown",
      confidence: "false_possible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Fáma říká, že policie odejde. Policie objednala další munici.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 100
    },
    {
      id: "rumor.final_lockdown.false_possible.005",
      category: "final_lockdown",
      confidence: "false_possible",
      allowedAudiences: [
        "global_city",
        "current_player",
        "alliance",
        "police"
      ],
      allowedSourceBuildings: [
        "city_hall"
      ],
      text: "Říká se, že konec bude spravedlivý. To je ze všech drbů ten nejméně uvěřitelný.",
      expiresAfterSeconds: 10800,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 0.5,
      priority: 100
    },
    {
      id: "rumor.atmosphere.rumor.001",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ve městě dnes prší. Déšť smývá krev, ne dluhy.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.002",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Neon svítí nejjasněji nad místy, kde lidé mizí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.003",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo dnes vydělal jmění. Někdo jiný se stal jeho účetní položkou.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.004",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Sirény křičí. Ulice dělají, že neslyší.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.005",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Každý má plán, dokud se neotevřou dveře.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.006",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Město nikdy nespí. Jen občas předstírá mrtvého.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.007",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Dnešní pravda bude zítra levná fáma.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.008",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Když zhasnou kamery, začínají příběhy.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.009",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Některé dluhy se neplatí penězi.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.010",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V Empire Streets má i ticho sériové číslo.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.011",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Peníze mluví. Zbraně přerušují.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.012",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Každý district má srdce. Některá jsou neprůstřelná.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.013",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Město má dlouhou paměť a krátký seznam přátel.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.014",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo dnes otevřel nový podnik. Někdo jiný nový hrob.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.015",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Kdo tvrdí, že se nebojí, obvykle jen mluví příliš nahlas.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.016",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Noc je mladá. Někteří lidé už ne.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.017",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Všichni chtějí korunu. Málokdo kontroluje, jestli není z ostnatého drátu.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.018",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Zítra bude mapa vypadat jinak. Mapa s tím nesouhlasí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.019",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ve městě není nouze o hrdiny. Jen o živé hrdiny.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.020",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Každá aliance začíná podáním ruky a končí kontrolou zásobníku.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.021",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Důvěra je měna, kterou nikdo nepřijímá.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.022",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někde právě někdo lže. Statisticky pravděpodobně všude.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.023",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Černý trh zavírá pozdě. Hřbitovy nikdy.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.024",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Když gang mlčí, poslouchej jeho auta.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.025",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Město je plné dveří. Většina vede k problémům.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.026",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Každá barva na mapě jednou ztmavne.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.027",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ulice nevolí vítěze. Jen uklízejí poražené.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.028",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Nikdo nevlastní district navždy. Někteří ho jen drží déle.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.029",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ve sklepích se počítají zásoby. Na střechách cíle.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.030",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Dnes je dobrý den na obchod. Špatný den na důvěru.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.031",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo zvedl Heat. Policie zvedla obočí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.032",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Město miluje ambice. Jejich pohřby jsou velkolepé.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.033",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Vliv otevírá dveře. Strach je nechává otevřené.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.034",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Každý má cenu. Někteří jen nemají cenovku.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.035",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Kdo ovládá informace, vybírá místo střelby.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.036",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Nejdražší chyba ve městě je pocit bezpečí.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.037",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "V noci jsou všechny dohody černobílé. Krev dodá barvu.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.038",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Někdo právě vyhrál spor. Druhá strana zmizela.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.039",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Ulice dnes působí klidně. To je vždycky podezřelé.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    },
    {
      id: "rumor.atmosphere.rumor.040",
      category: "atmosphere",
      confidence: "rumor",
      allowedAudiences: [
        "global_city",
        "selected_district",
        "current_player"
      ],
      allowedSourceBuildings: [
        "restaurant",
        "convenience_store"
      ],
      text: "Empire Streets odpouští všechno kromě slabosti.",
      expiresAfterSeconds: 900,
      revealsPlayerName: false,
      revealsAllianceName: false,
      revealsDistrictName: false,
      weight: 1,
      priority: 1
    }
  ];
  const RUMOR_TEMPLATES = Object.freeze(rawRumorTemplates);
  Object.freeze(
    Object.fromEntries(RUMOR_TEMPLATES.map((template) => [template.id, template]))
  );
  const deepFreezeConfig = (value) => {
    if (value && typeof value === "object") {
      Object.freeze(value);
      for (const child of Object.values(value)) {
        if (child && typeof child === "object" && !Object.isFrozen(child)) {
          deepFreezeConfig(child);
        }
      }
    }
    return value;
  };
  const MINIMUM_PRODUCTION_QUEUE_RESERVE = 3;
  const REQUIRED_RECIPES$2 = ["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"];
  const KNOWN_RESOURCES$1 = /* @__PURE__ */ new Set([
    "chemicals",
    "biomass",
    "stim-pack",
    "neon-dust",
    "pulse-shot",
    "velvet-smoke",
    "ghost-serum",
    "overdrive-x"
  ]);
  const validateDrugLabProductionConfig = (config) => {
    if (config.independentProductionLines !== true) {
      throw new Error("Drug Lab requires independent production lines.");
    }
    for (const recipeId of REQUIRED_RECIPES$2) {
      const recipe = config.recipes[recipeId];
      if (!recipe || recipe.outputResourceKey !== recipeId) {
        throw new Error('Drug Lab recipe "' + recipeId + '" must produce its matching resource.');
      }
      if (recipe.outputAmount !== 1 || recipe.directlyUsable !== false) {
        throw new Error("Drug Lab recipes produce exactly one non-directly-usable item.");
      }
      if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
        throw new Error('Drug Lab recipe "' + recipeId + '" requires a positive clean cash price.');
      }
      const inputs = Object.entries(recipe.inputCosts);
      if (inputs.length > 2 || inputs.some(([key, amount]) => !KNOWN_RESOURCES$1.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipeId)) {
        throw new Error('Drug Lab recipe "' + recipeId + '" has invalid material inputs.');
      }
      for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error('Drug Lab recipe "' + recipeId + '" requires positive integer timing and capacities.');
        }
      }
      if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
        throw new Error('Drug Lab recipe "' + recipeId + '" requires room for three queued items above local output capacity.');
      }
    }
    const ghost = config.recipes["ghost-serum"];
    const overdrive = config.recipes["overdrive-x"];
    if (ghost.itemRole !== "boost-component" || ghost.inputCosts["stim-pack"] || ghost.inputCosts.chemicals || ghost.inputCosts.biomass) {
      throw new Error("Ghost Serum must remain a strategic component using Neon Dust and Pulse Shot.");
    }
    if (overdrive.itemRole !== "boost-component" || overdrive.inputCosts["stim-pack"] || overdrive.inputCosts["ghost-serum"] || overdrive.inputCosts.chemicals || overdrive.inputCosts.biomass) {
      throw new Error("Overdrive X must remain a strategic component using Pulse Shot and Velvet Smoke.");
    }
  };
  const REQUIRED_RECIPES$1 = ["metal-parts", "tech-core", "combat-module"];
  const KNOWN_RESOURCES = /* @__PURE__ */ new Set(["metal-parts", "tech-core", "combat-module"]);
  const validateFactoryProductionConfig = (config) => {
    if (config.independentProductionLines !== true) throw new Error("Factory requires independent production lines.");
    for (const recipeId of REQUIRED_RECIPES$1) {
      const recipe = config.recipes[recipeId];
      if (!recipe || recipe.outputResourceKey !== recipeId || recipe.outputAmount !== 1) {
        throw new Error('Factory recipe "' + recipeId + '" must produce exactly one matching resource.');
      }
      if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
        throw new Error('Factory recipe "' + recipeId + '" requires a positive clean cash price.');
      }
      const inputs = Object.entries(recipe.inputCosts);
      if (inputs.length > 2 || inputs.some(([key, amount]) => !KNOWN_RESOURCES.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipeId)) {
        throw new Error('Factory recipe "' + recipeId + '" has invalid material inputs.');
      }
      for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
        if (!Number.isInteger(value) || value <= 0) throw new Error('Factory recipe "' + recipeId + '" requires positive integer timing and capacities.');
      }
      if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
        throw new Error('Factory recipe "' + recipeId + '" requires room for three queued items above local output capacity.');
      }
    }
    const metal = config.recipes["metal-parts"];
    const tech = config.recipes["tech-core"];
    const combat = config.recipes["combat-module"];
    if (Object.keys(metal.inputCosts).length || tech.inputCosts["metal-parts"] !== 4 || Object.keys(tech.inputCosts).length !== 1) {
      throw new Error("Factory Tech Core requires exactly four Metal Parts and Metal Parts require no materials.");
    }
    if (combat.inputCosts["metal-parts"] !== 4 || combat.inputCosts["tech-core"] !== 2 || Object.keys(combat.inputCosts).length !== 2) {
      throw new Error("Factory Combat Module requires exactly four Metal Parts and two Tech Cores.");
    }
    for (const count of [1, 2, 3, 4]) {
      const value = config.network.speedMultipliers[count];
      if (!Number.isFinite(value) || value <= 0 || value > config.network.maxSpeedMultiplier) {
        throw new Error("Factory network multiplier is invalid.");
      }
    }
    if (config.network.maxSpeedMultiplier !== 1.3 || config.network.speedMultipliers[1] !== 1 || config.network.speedMultipliers[2] !== 1.1 || config.network.speedMultipliers[3] !== 1.2 || config.network.speedMultipliers[4] !== 1.3) {
      throw new Error("Factory network speed multipliers must resolve to 1.00, 1.10, 1.20 and 1.30.");
    }
  };
  const RECIPE_IDS = [
    "baseball-bat",
    "pistol",
    "grenade",
    "smg",
    "bazooka",
    "vest",
    "barricades",
    "cameras",
    "defense-tower",
    "alarm"
  ];
  const ATTACK_RECIPES = /* @__PURE__ */ new Set(["baseball-bat", "pistol", "grenade", "smg", "bazooka"]);
  const MATERIALS = /* @__PURE__ */ new Set(["metal-parts", "tech-core", "combat-module"]);
  const HIGH_TIER_INPUTS = {
    smg: { "metal-parts": 2, "combat-module": 1 },
    bazooka: { "metal-parts": 3, "combat-module": 2 },
    "defense-tower": { "tech-core": 3, "combat-module": 2 }
  };
  const hasExactInputCosts = (actual, expected) => {
    const actualEntries = Object.entries(actual);
    const expectedEntries = Object.entries(expected);
    return actualEntries.length === expectedEntries.length && expectedEntries.every(([resourceKey, amount]) => actual[resourceKey] === amount);
  };
  const validateArmoryProductionConfig = (config) => {
    if (config.independentProductionLines !== true || Object.keys(config.recipes).length !== RECIPE_IDS.length) {
      throw new Error("Armory requires exactly ten independent production lines.");
    }
    for (const recipeId of RECIPE_IDS) {
      const recipe = config.recipes[recipeId];
      const expectedCategory = ATTACK_RECIPES.has(recipeId) ? "attack" : "defense";
      if (!recipe || recipe.category !== expectedCategory || recipe.outputResourceKey !== recipeId || recipe.outputAmount !== 1) {
        throw new Error('Armory recipe "' + recipeId + '" must produce exactly one matching item in its category.');
      }
      if (recipe.cleanCashCostPerUnit !== 0) {
        throw new Error("Armory recipes do not charge clean cash.");
      }
      const inputs = Object.entries(recipe.inputCosts);
      if (inputs.length < 1 || inputs.length > 2 || inputs.some(
        ([key, amount]) => !MATERIALS.has(key) || !Number.isInteger(amount) || amount <= 0 || key === recipe.outputResourceKey
      )) {
        throw new Error('Armory recipe "' + recipeId + '" has invalid material inputs.');
      }
      for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error('Armory recipe "' + recipeId + '" requires positive integer timing and capacities.');
        }
      }
      if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
        throw new Error('Armory recipe "' + recipeId + '" requires room for three queued items above local output capacity.');
      }
      if (recipeId in HIGH_TIER_INPUTS && !hasExactInputCosts(recipe.inputCosts, HIGH_TIER_INPUTS[recipeId])) {
        throw new Error('Armory high-tier recipe "' + recipeId + '" has invalid Combat Module inputs.');
      }
      if (!(recipeId in HIGH_TIER_INPUTS) && "combat-module" in recipe.inputCosts) {
        throw new Error("Combat Module is reserved for Armory high-tier recipes only.");
      }
    }
    for (const count of [1, 2, 3, 4]) {
      const multiplier = config.network.speedMultipliers[count];
      if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > config.network.maxSpeedMultiplier) {
        throw new Error("Armory network multiplier is invalid.");
      }
    }
    if (config.network.maxSpeedMultiplier !== 1.3 || config.network.speedMultipliers[1] !== 1 || config.network.speedMultipliers[2] !== 1.1 || config.network.speedMultipliers[3] !== 1.2 || config.network.speedMultipliers[4] !== 1.3) {
      throw new Error("Armory network speed multipliers must resolve to 1.00, 1.10, 1.20 and 1.30.");
    }
  };
  const REQUIRED_RECIPES = ["chemicals", "biomass", "stim-pack"];
  const validatePharmacyProductionConfig = (config) => {
    if (config.independentProductionLines !== true) {
      throw new Error("Pharmacy requires independent production lines.");
    }
    for (const recipeId of REQUIRED_RECIPES) {
      const recipe = config.recipes[recipeId];
      if (!recipe || recipe.outputResourceKey !== recipeId) {
        throw new Error('Pharmacy recipe "' + recipeId + '" must produce its matching resource.');
      }
      if (recipe.outputAmount !== 1) {
        throw new Error('Pharmacy recipe "' + recipeId + '" must produce exactly one item.');
      }
      if (!Number.isInteger(recipe.cleanCashCostPerUnit) || recipe.cleanCashCostPerUnit <= 0) {
        throw new Error('Pharmacy recipe "' + recipeId + '" requires a positive clean cash price.');
      }
      if (Object.keys(recipe.inputCosts).length > 0) {
        throw new Error('Pharmacy recipe "' + recipeId + '" must not consume material inputs.');
      }
      for (const value of [recipe.durationTicksPerUnit, recipe.localOutputCap, recipe.queueCap]) {
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error('Pharmacy recipe "' + recipeId + '" requires positive integer timing and capacities.');
        }
      }
      if (recipe.queueCap < recipe.localOutputCap + MINIMUM_PRODUCTION_QUEUE_RESERVE) {
        throw new Error('Pharmacy recipe "' + recipeId + '" requires room for three queued items above local output capacity.');
      }
    }
  };
  const STORAGE_CAPACITY_GROUP_IDS = ["bulk", "tactical", "strategic"];
  const CANONICAL_STORAGE_RESOURCE_KEYS = [
    "chemicals",
    "biomass",
    "metal-parts",
    "neon-dust",
    "baseball-bat",
    "barricades",
    "stim-pack",
    "pulse-shot",
    "velvet-smoke",
    "tech-core",
    "pistol",
    "grenade",
    "vest",
    "cameras",
    "alarm",
    "combat-module",
    "ghost-serum",
    "overdrive-x",
    "smg",
    "bazooka",
    "defense-tower"
  ];
  const STORAGE_RESOURCE_ALIASES = Object.freeze({
    metalParts: "metal-parts",
    metal_parts: "metal-parts",
    techCore: "tech-core",
    tech_core: "tech-core",
    combatModule: "combat-module",
    combat_module: "combat-module"
  });
  const NON_STOCKABLE_RESOURCE_KEYS = /* @__PURE__ */ new Set([
    "cash",
    "clean-cash",
    "dirty-cash",
    "dirtyCash",
    "influence",
    "heat",
    "population",
    "spies",
    "gang-members",
    "gangMembers",
    "cooldowns"
  ]);
  const normalizeStorageResourceKey = (resourceKey) => STORAGE_RESOURCE_ALIASES[String(resourceKey || "")] ?? String(resourceKey || "");
  const isNonStockableResource = (resourceKey) => NON_STOCKABLE_RESOURCE_KEYS.has(normalizeStorageResourceKey(resourceKey));
  const validateWarehouseStorageConfig = (config) => {
    const seen = /* @__PURE__ */ new Set();
    for (const groupId of STORAGE_CAPACITY_GROUP_IDS) {
      const group = config.storageCapacityGroups[groupId];
      if (!group || !Number.isInteger(group.baseCapacity) || group.baseCapacity <= 0) {
        throw new Error(`Warehouse storage group "${groupId}" requires a positive integer baseCapacity.`);
      }
      for (const key of group.resourceKeys) {
        const canonicalKey = normalizeStorageResourceKey(key);
        if (!CANONICAL_STORAGE_RESOURCE_KEYS.includes(canonicalKey)) {
          throw new Error(`Warehouse storage resource "${key}" is not known.`);
        }
        if (isNonStockableResource(canonicalKey)) {
          throw new Error(`Warehouse storage resource "${key}" must not be non-stockable.`);
        }
        if (seen.has(canonicalKey)) {
          throw new Error(`Warehouse storage resource "${canonicalKey}" belongs to more than one group.`);
        }
        seen.add(canonicalKey);
      }
    }
    for (const key of CANONICAL_STORAGE_RESOURCE_KEYS) {
      if (!seen.has(key)) throw new Error(`Warehouse storage resource "${key}" is not configured.`);
    }
    for (const tier of [0, 1, 2, 3, 4, 5]) {
      const multiplier = Number(config.warehouseCountMultipliers[tier]);
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1.9) {
        throw new Error(`Warehouse count multiplier ${tier} must be between 1 and 1.9.`);
      }
    }
    if (Number(config.warehouseCountMultipliers[5]) !== 1.9) {
      throw new Error("Warehouse count multiplier for 5+ warehouses must be 1.9.");
    }
    for (const level of [1, 2, 3, 4]) {
      const multiplier = Number(config.warehouseLevelMultipliers[level]);
      if (!Number.isFinite(multiplier) || multiplier < 1) {
        throw new Error(`Warehouse level multiplier ${level} must be at least 1.`);
      }
    }
  };
  const validateAttackWeaponsConfig = (config) => {
    for (const weaponId of Object.keys(config)) {
      if (!ATTACK_WEAPON_IDS.includes(weaponId)) {
        throw new Error("Attack weapon config contains an unknown weapon " + weaponId + ".");
      }
    }
    for (const weaponId of ATTACK_WEAPON_IDS) {
      const weapon = config[weaponId];
      if (!(weapon == null ? void 0 : weapon.label) || !(weapon == null ? void 0 : weapon.description)) {
        throw new Error("Attack weapon config requires a label and description for " + weaponId + ".");
      }
      for (const value of [weapon.baseAttackPower, weapon.populationRequired]) {
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error("Attack weapon config requires positive integer power and population.");
        }
      }
    }
  };
  const assertFiniteNonNegative = (value, field) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Convenience Store config requires a non-negative ${field}.`);
    }
  };
  const assertPct = (value, field) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Convenience Store config requires ${field} between 0 and 100.`);
    }
  };
  const validateConvenienceStoreConfig = (config) => {
    var _a;
    if (config.id !== "convenience_store" || config.buildingTypeId !== "convenience_store") {
      throw new Error("Convenience Store config requires canonical identifiers.");
    }
    if (!Number.isInteger(config.countOnMap) || config.countOnMap <= 0) {
      throw new Error("Convenience Store config requires a positive integer countOnMap.");
    }
    if (!Number.isInteger(config.passiveRumorIntervalMinutes) || config.passiveRumorIntervalMinutes <= 0) {
      throw new Error("Convenience Store config requires a positive integer rumor interval.");
    }
    if (!Number.isInteger(config.maxRumorChecksPerPlayerPerInterval) || config.maxRumorChecksPerPlayerPerInterval <= 0) {
      throw new Error("Convenience Store config requires a positive rumor check limit.");
    }
    assertPct(config.baseRumorChancePct, "baseRumorChancePct");
    assertPct(config.districtHintChancePct, "districtHintChancePct");
    assertPct(config.areaHintChancePct, "areaHintChancePct");
    assertPct(config.buildingHintChancePct, "buildingHintChancePct");
    if (config.rumorTypes.length === 0 || new Set(config.rumorTypes).size !== config.rumorTypes.length) {
      throw new Error("Convenience Store config requires unique rumor types.");
    }
    const tiers = [...config.truthChanceByOwnedCount].sort((left, right) => left.minOwned - right.minOwned);
    let expectedMin = 1;
    for (const tier of tiers) {
      if (!Number.isInteger(tier.minOwned) || tier.minOwned !== expectedMin) {
        throw new Error("Convenience Store truth tiers must be contiguous from one owned store.");
      }
      assertPct(tier.truthChancePct, "truthChancePct");
      if (tier.maxOwned === null) {
        expectedMin = Number.POSITIVE_INFINITY;
        continue;
      }
      if (!Number.isInteger(tier.maxOwned) || tier.maxOwned < tier.minOwned) {
        throw new Error("Convenience Store truth tiers require valid ownership ranges.");
      }
      expectedMin = tier.maxOwned + 1;
    }
    if (tiers.length === 0 || ((_a = tiers.at(-1)) == null ? void 0 : _a.maxOwned) !== null) {
      throw new Error("Convenience Store truth tiers require an open-ended final tier.");
    }
    for (const [field, value] of Object.entries(config.network)) {
      assertFiniteNonNegative(value, `network.${field}`);
      if (field.startsWith("max") && value < 1) {
        throw new Error(`Convenience Store config requires ${field} to be at least one.`);
      }
    }
    for (const [field, value] of Object.entries(config.restaurantSynergy)) {
      assertFiniteNonNegative(value, `restaurantSynergy.${field}`);
    }
  };
  const KNOWN_INPUT_RESOURCES = /* @__PURE__ */ new Set([
    "ghost-serum",
    "pulse-shot",
    "overdrive-x",
    "combat-module"
  ]);
  const validatePlayerBoostConfig = (config) => {
    const ids = Object.keys(config).sort();
    const expectedIds = [...PLAYER_BOOST_IDS].sort();
    if (ids.length !== expectedIds.length || ids.some((id2, index) => id2 !== expectedIds[index])) {
      throw new Error("Player boost config requires exactly Ghost Network, Industrial Overdrive and Tactical Grid.");
    }
    for (const boostId of PLAYER_BOOST_IDS) {
      const boost = config[boostId];
      if (!boost || boost.boostId !== boostId) {
        throw new Error(`Player boost '${boostId}' must use its canonical boostId.`);
      }
      if (!Number.isInteger(boost.cleanCashCost) || boost.cleanCashCost <= 0) {
        throw new Error(`Player boost '${boostId}' requires a positive integer clean cash cost.`);
      }
      if (!Number.isInteger(boost.activeDurationTicks) || boost.activeDurationTicks <= 0) {
        throw new Error(`Player boost '${boostId}' requires a positive duration.`);
      }
      if (!Number.isInteger(boost.cooldownTicks) || boost.cooldownTicks <= boost.activeDurationTicks) {
        throw new Error(`Player boost '${boostId}' cooldown must exceed its active duration.`);
      }
      for (const [resourceKey, amount] of Object.entries(boost.inputCosts)) {
        if (!KNOWN_INPUT_RESOURCES.has(resourceKey) || !Number.isInteger(amount) || amount <= 0) {
          throw new Error(`Player boost '${boostId}' has an invalid material input.`);
        }
      }
    }
    return config;
  };
  const CITY_EVENT_REWARD_KEYS = [
    "cash",
    "dirty-cash",
    "influence",
    "chemicals",
    "biomass",
    "metal-parts",
    "neon-dust",
    "baseball-bat",
    "barricades",
    "stim-pack",
    "pulse-shot",
    "velvet-smoke",
    "tech-core",
    "pistol",
    "grenade",
    "vest",
    "cameras",
    "alarm",
    "combat-module",
    "ghost-serum",
    "overdrive-x",
    "smg",
    "bazooka",
    "defense-tower"
  ];
  const collectRecipes = (config) => {
    const recipes = /* @__PURE__ */ new Map();
    const sources = [
      config.balance.pharmacy,
      config.balance.drugLab,
      config.balance.factory,
      config.balance.armory
    ];
    for (const source of sources) {
      if (!source || !("recipes" in source)) continue;
      for (const value of Object.values(source.recipes)) {
        const recipe = value;
        recipes.set(recipe.outputResourceKey, recipe);
      }
    }
    return recipes;
  };
  const createReplacementValueResolver = (config) => {
    const recipes = collectRecipes(config);
    const cache = /* @__PURE__ */ new Map();
    const resolve = (resourceKey, stack) => {
      if (cache.has(resourceKey)) return cache.get(resourceKey);
      const recipe = recipes.get(resourceKey);
      if (!recipe) return null;
      if (stack.has(resourceKey)) {
        throw new Error(`Production replacement value contains a cycle at '${resourceKey}'.`);
      }
      const nextStack = new Set(stack);
      nextStack.add(resourceKey);
      let total = Math.max(0, Math.floor(Number(recipe.cleanCashCostPerUnit || 0)));
      for (const [inputKey, rawAmount] of Object.entries(recipe.inputCosts)) {
        const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
        const inputValue = resolve(inputKey, nextStack);
        if (inputValue === null) {
          throw new Error(`No canonical replacement value exists for production input '${inputKey}'.`);
        }
        total += amount * inputValue;
      }
      cache.set(resourceKey, total);
      return total;
    };
    return { resolve: (resourceKey) => resolve(resourceKey, /* @__PURE__ */ new Set()) };
  };
  const agents = /* @__PURE__ */ new Set(["victor", "leon", "nyra"]);
  const rewardKeys = new Set(CITY_EVENT_REWARD_KEYS);
  const strategicKeys = /* @__PURE__ */ new Set(["combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"]);
  const forbiddenCommonRewards = /* @__PURE__ */ new Set(["bazooka", "defense-tower"]);
  const assertClockTime = (hour, minute2, field) => {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute2) || minute2 < 0 || minute2 > 59) {
      throw new Error(`City Event config requires a valid ${field} city time.`);
    }
  };
  const validateCityEventConfig = (cityEvents, config) => {
    if (!cityEvents.enabled) return;
    if (cityEvents.definitions.length !== 300) {
      throw new Error("Free mode requires exactly 300 canonical City Event definitions.");
    }
    for (const agent of Object.values(cityEvents.agents)) {
      if (!agents.has(agent.agentId) || agent.offerCount !== 3 || agent.requiredInfluence < 0) {
        throw new Error(`Invalid City Event agent '${agent.agentId}'.`);
      }
      for (const time2 of agent.refreshTimes) assertClockTime(time2.hour, time2.minute, `${agent.agentId} refresh`);
      if (agent.availability) {
        assertClockTime(agent.availability.opensAt.hour, agent.availability.opensAt.minute, `${agent.agentId} opening`);
        assertClockTime(agent.availability.closesAt.hour, agent.availability.closesAt.minute, `${agent.agentId} closing`);
      }
    }
    const ids = /* @__PURE__ */ new Set();
    const counts = /* @__PURE__ */ new Map();
    const replacementValues = createReplacementValueResolver(config);
    for (const definition of cityEvents.definitions) {
      if (!definition.id.trim() || ids.has(definition.id)) throw new Error(`Duplicate City Event ID '${definition.id}'.`);
      ids.add(definition.id);
      if (!agents.has(definition.agentId)) throw new Error(`Unknown City Event agent '${definition.agentId}'.`);
      counts.set(definition.agentId, (counts.get(definition.agentId) ?? 0) + 1);
      if (!definition.title.trim() || !definition.description.trim()) {
        throw new Error(`City Event '${definition.id}' requires player-facing title and description.`);
      }
      const budget = cityEvents.difficultyBudgets[definition.difficulty];
      if (!budget) throw new Error(`City Event '${definition.id}' has invalid difficulty.`);
      if (definition.successRate < budget.successRateMin || definition.successRate > budget.successRateMax) {
        throw new Error(`City Event '${definition.id}' success rate is outside its difficulty profile.`);
      }
      if (definition.durationMinutes < budget.durationMinutesMin || definition.durationMinutes > budget.durationMinutesMax) {
        throw new Error(`City Event '${definition.id}' durationMinutes is outside its difficulty profile.`);
      }
      if (definition.risk.successHeat < 0 || definition.risk.failureHeat < definition.risk.successHeat || definition.risk.failureDirtyCashLoss < 0) {
        throw new Error(`City Event '${definition.id}' has invalid risk values.`);
      }
      let rewardValue = 0;
      let strategicCount = 0;
      for (const [resourceKey, rawAmount] of Object.entries(definition.reward)) {
        const amount = Number(rawAmount || 0);
        if (!rewardKeys.has(resourceKey)) throw new Error(`City Event '${definition.id}' uses unknown reward '${resourceKey}'.`);
        if (!Number.isInteger(amount) || amount <= 0) throw new Error(`City Event '${definition.id}' has invalid reward amount.`);
        if (resourceKey === "cash" || resourceKey === "dirty-cash") rewardValue += amount;
        else if (resourceKey !== "influence") {
          const replacementValue = replacementValues.resolve(resourceKey);
          if (replacementValue === null) throw new Error(`City Event '${definition.id}' reward '${resourceKey}' has no canonical value.`);
          rewardValue += replacementValue * amount;
        }
        if (strategicKeys.has(resourceKey)) {
          strategicCount += 1;
          if (amount > 1) throw new Error(`City Event '${definition.id}' grants more than one Strategic item.`);
        }
        if (forbiddenCommonRewards.has(resourceKey)) {
          throw new Error(`City Event '${definition.id}' cannot grant '${resourceKey}'.`);
        }
      }
      if (strategicCount > 1 || strategicCount > 0 && definition.difficulty !== "rare") {
        throw new Error(`City Event '${definition.id}' violates Strategic reward rules.`);
      }
      if (rewardValue > budget.maxReplacementValue) {
        throw new Error(`City Event '${definition.id}' exceeds the ${definition.difficulty} replacement-value budget.`);
      }
    }
    for (const agentId of agents) {
      if (counts.get(agentId) !== 100) throw new Error(`City Event agent '${agentId}' requires exactly 100 definitions.`);
    }
  };
  const EXPECTED_SLOT_RESOURCES = ["neon-dust", "pulse-shot", "velvet-smoke"];
  const validateStreetDealersConfig = (config) => {
    var _a;
    const dealers = config.balance.streetDealers;
    if (!dealers) return;
    if (dealers.dealerSlots.length !== EXPECTED_SLOT_RESOURCES.length || dealers.sellableDrugs.length !== EXPECTED_SLOT_RESOURCES.length) {
      throw new Error("Street Dealers require exactly three configured sale slots.");
    }
    for (const [index, resourceKey] of EXPECTED_SLOT_RESOURCES.entries()) {
      const slot = dealers.dealerSlots[index];
      const drug = dealers.sellableDrugs.find((candidate) => candidate.itemId === resourceKey);
      const recipe = (_a = config.balance.drugLab) == null ? void 0 : _a.recipes[resourceKey];
      if (!slot || slot.slotId !== `slot-${index + 1}` || slot.itemId !== resourceKey || !drug || !recipe) {
        throw new Error(`Street Dealers require ${resourceKey} in slot ${index + 1}.`);
      }
      if (drug.minimumAmountPerSale !== 10) {
        throw new Error(`Street Dealers require a minimum sale of 10 ${resourceKey}.`);
      }
      if (drug.unitSalePriceDirtyCash !== Math.round(recipe.cleanCashCostPerUnit * 1.25)) {
        throw new Error(`Street Dealers price for ${resourceKey} must be 125% of its Drug Lab clean-cash cost.`);
      }
    }
  };
  const validateModeConfig = (config) => {
    if (config.tickRateMs <= 0) {
      throw new Error("Mode config requires a positive tickRateMs.");
    }
    if (config.balance.maxPlayersPerServer <= 0) {
      throw new Error("Mode config requires a positive maxPlayersPerServer.");
    }
    if (config.balance.maxAllianceSize <= 0) {
      throw new Error("Mode config requires a positive maxAllianceSize.");
    }
    if (config.balance.maxAllianceSize > 4) {
      throw new Error("Mode config allows alliances with at most 4 players.");
    }
    const allianceLifecycle = config.balance.allianceLifecycle;
    if (allianceLifecycle) {
      const readiness = allianceLifecycle.readiness;
      for (const [key, value] of [
        ["readyIntervalSeconds", readiness.readyIntervalSeconds],
        ["readyButtonAvailableBeforeDueSeconds", readiness.readyButtonAvailableBeforeDueSeconds],
        ["gracePeriodSeconds", readiness.gracePeriodSeconds],
        ["voteDurationSeconds", readiness.voteDurationSeconds],
        ["voteRetryCooldownSeconds", readiness.voteRetryCooldownSeconds],
        ["exitPendingTimeoutSeconds", allianceLifecycle.exitPendingTimeoutSeconds]
      ]) {
        if (value < 0) {
          throw new Error(`Alliance lifecycle config requires a non-negative ${key}.`);
        }
      }
      if (readiness.readyIntervalSeconds <= 0 || readiness.voteDurationSeconds <= 0) {
        throw new Error("Alliance lifecycle config requires positive READY and vote durations.");
      }
      if (readiness.readyButtonAvailableBeforeDueSeconds > readiness.readyIntervalSeconds) {
        throw new Error("Alliance READY button window cannot exceed the READY interval.");
      }
      for (const [key, value] of [
        ["voluntaryLeavePenalty", allianceLifecycle.voluntaryLeavePenalty],
        ["inactiveKickPenalty", allianceLifecycle.inactiveKickPenalty],
        ["disbandPenalty", allianceLifecycle.disbandPenalty],
        ["administrativeRemovalPenalty", allianceLifecycle.administrativeRemovalPenalty]
      ]) {
        if ((value.statDebuffSeconds ?? 0) < 0) {
          throw new Error(`Alliance lifecycle config requires a non-negative statDebuffSeconds for ${key}.`);
        }
        if (value.influenceGenerationMultiplier <= 0 || value.actionCooldownMultiplier <= 0) {
          throw new Error(`Alliance lifecycle config requires positive multipliers for ${key}.`);
        }
        for (const [multiplierKey, multiplier] of [
          ["attackMultiplier", value.attackMultiplier],
          ["defenseMultiplier", value.defenseMultiplier],
          ["productionMultiplier", value.productionMultiplier],
          ["incomeMultiplier", value.incomeMultiplier]
        ]) {
          if (multiplier !== void 0 && multiplier <= 0) {
            throw new Error(`Alliance lifecycle config requires a positive ${multiplierKey} for ${key}.`);
          }
        }
      }
    }
    if (config.balance.warehouse) validateWarehouseStorageConfig(config.balance.warehouse);
    if (config.balance.pharmacy) validatePharmacyProductionConfig(config.balance.pharmacy);
    if (config.balance.drugLab) validateDrugLabProductionConfig(config.balance.drugLab);
    if (config.balance.factory) validateFactoryProductionConfig(config.balance.factory);
    if (config.balance.armory) validateArmoryProductionConfig(config.balance.armory);
    if (config.balance.attackWeapons) validateAttackWeaponsConfig(config.balance.attackWeapons);
    if (config.balance.playerBoosts) validatePlayerBoostConfig(config.balance.playerBoosts);
    if (config.balance.cityEvents) validateCityEventConfig(config.balance.cityEvents, config);
    if (config.balance.convenienceStore) validateConvenienceStoreConfig(config.balance.convenienceStore);
    validateStreetDealersConfig(config);
    const elimination = config.balance.elimination;
    if (elimination == null ? void 0 : elimination.enabled) {
      for (const [key, value] of [
        ["intervalTicks", elimination.intervalTicks],
        ["firstEliminationTick", elimination.firstEliminationTick],
        ["minActivePlayers", elimination.minActivePlayers],
        ["dangerZoneSize", elimination.dangerZoneSize],
        ["defeatedDistrictLockTicks", elimination.defeatedDistrictLockTicks]
      ]) {
        if (value < 0) {
          throw new Error(`Elimination config requires a non-negative ${key}.`);
        }
      }
      if (elimination.intervalTicks <= 0) {
        throw new Error("Elimination config requires a positive intervalTicks.");
      }
    }
    const finalLockdown = config.balance.finalLockdown;
    if (finalLockdown == null ? void 0 : finalLockdown.enabled) {
      for (const [key, value] of [
        ["triggerActivePlayers", finalLockdown.triggerActivePlayers],
        ["activeDurationTicks", finalLockdown.activeDurationTicks],
        ["topRankCount", finalLockdown.topRankCount],
        ["downtownDistrictBonus", finalLockdown.downtownDistrictBonus],
        ["rareBuildingBonus", finalLockdown.rareBuildingBonus],
        ["heatPenaltyStart", finalLockdown.heatPenaltyStart],
        ["heatPenaltyPerPoint", finalLockdown.heatPenaltyPerPoint],
        ["extremeHeatPenaltyStart", finalLockdown.extremeHeatPenaltyStart],
        ["extremeHeatPenaltyPerPoint", finalLockdown.extremeHeatPenaltyPerPoint]
      ]) {
        if (value < 0) {
          throw new Error(`Final Lockdown config requires a non-negative ${key}.`);
        }
      }
      if (finalLockdown.triggerActivePlayers <= 0) {
        throw new Error("Final Lockdown config requires a positive triggerActivePlayers.");
      }
      if (finalLockdown.activeDurationTicks <= 0) {
        throw new Error("Final Lockdown config requires a positive activeDurationTicks.");
      }
      if (finalLockdown.topRankCount <= 0) {
        throw new Error("Final Lockdown config requires a positive topRankCount.");
      }
    }
    const victoryThreshold = config.balance.districtControlVictoryThreshold ?? 1;
    if (victoryThreshold <= 0 || victoryThreshold > 1) {
      throw new Error("Mode config requires districtControlVictoryThreshold between 0 and 1.");
    }
    for (const [key, value] of [
      ["minimumVictoryTicks", config.balance.minimumVictoryTicks],
      ["districtControlHoldTicks", config.balance.districtControlHoldTicks],
      ["hardTimeoutTicks", config.balance.hardTimeoutTicks]
    ]) {
      if (value !== void 0 && value < 0) {
        throw new Error(`Mode config requires a non-negative ${key}.`);
      }
    }
    if (!config.technical.storageKeyPrefix) {
      throw new Error("Mode config requires a storageKeyPrefix.");
    }
    if (config.balance.conflict) {
      if (config.balance.conflict.spyCooldownTicks < 0) {
        throw new Error("Conflict config requires a non-negative spyCooldownTicks.");
      }
      if ((config.balance.conflict.spyAuthorizationTtlTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative spyAuthorizationTtlTicks.");
      }
      if ((config.balance.conflict.spySlotCooldownTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative spySlotCooldownTicks.");
      }
      const defenseCapacity = config.balance.conflict.defenseCapacity;
      if (defenseCapacity) {
        if (defenseCapacity.baseCapacityPoints <= 0) {
          throw new Error("Conflict defense capacity requires positive baseCapacityPoints.");
        }
        for (const itemId of ["vest", "barricades", "cameras", "defense-tower", "alarm"]) {
          if (!Number.isFinite(defenseCapacity.itemWeights[itemId]) || defenseCapacity.itemWeights[itemId] <= 0) {
            throw new Error(`Conflict defense capacity requires a positive weight for ${itemId}.`);
          }
        }
      }
      if (config.balance.conflict.attackCooldownTicks < 0) {
        throw new Error("Conflict config requires a non-negative attackCooldownTicks.");
      }
      if ((config.balance.conflict.robCooldownTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative robCooldownTicks.");
      }
      if ((config.balance.conflict.heistCooldownTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative heistCooldownTicks.");
      }
      if ((config.balance.conflict.occupyCooldownTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative occupyCooldownTicks.");
      }
      if ((config.balance.conflict.occupyFailureChancePct ?? 0) < 0 || (config.balance.conflict.occupyFailureChancePct ?? 0) > 100) {
        throw new Error("Conflict config requires occupyFailureChancePct between 0 and 100.");
      }
      if ((config.balance.conflict.minAttackDurationTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative minAttackDurationTicks.");
      }
      if ((config.balance.conflict.attackHeatGain ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative attackHeatGain.");
      }
      if ((config.balance.conflict.occupyHeatGain ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative occupyHeatGain.");
      }
      if ((config.balance.conflict.occupyInfluenceCost ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative occupyInfluenceCost.");
      }
      if ((config.balance.conflict.occupyPopulationRefundPct ?? 0) < 0 || (config.balance.conflict.occupyPopulationRefundPct ?? 0) > 100) {
        throw new Error("Conflict config requires occupyPopulationRefundPct between 0 and 100.");
      }
      if (config.balance.conflict.trapAttackLosses < 0) {
        throw new Error("Conflict config requires a non-negative trapAttackLosses.");
      }
      if (config.balance.conflict.reportsLimit <= 0) {
        throw new Error("Conflict config requires a positive reportsLimit.");
      }
      for (const [key, value] of [
        ["spyBaseSuccessChance", config.balance.conflict.spyBaseSuccessChance],
        ["spyTrapRevealChance", config.balance.conflict.spyTrapRevealChance]
      ]) {
        if (value < 0 || value > 1) {
          throw new Error(`Conflict config requires ${key} between 0 and 1.`);
        }
      }
    }
    for (const craftBuilding of Object.values(config.balance.craftBuildings ?? {})) {
      for (const recipe of Object.values(craftBuilding.recipes)) {
        if (recipe.durationTicks <= 0) {
          throw new Error(`Craft recipe "${recipe.label}" requires a positive durationTicks.`);
        }
      }
    }
    for (const action2 of Object.values(config.balance.buildingActions ?? {})) {
      if (!action2.actionId || !action2.buildingType) {
        throw new Error("Building action config requires actionId and buildingType.");
      }
      if (action2.durationMs < 0 || action2.cooldownMs < 0) {
        throw new Error(`Building action "${action2.actionId}" requires non-negative durationMs and cooldownMs.`);
      }
    }
    return config;
  };
  const resolveModeConfig = (mode) => {
    const registry = {
      free: createFreeModeConfig,
      war: createWarModeConfig
    };
    return deepFreezeConfig(validateModeConfig(registry[mode]()));
  };
  Object.fromEntries(
    publicBuildingDefinitions.flatMap((definition) => [
      [normalizeBuildingName(definition.label), definition.buildingTypeId],
      [normalizeBuildingName(definition.buildingTypeId), definition.buildingTypeId]
    ])
  );
  function normalizeBuildingName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  }
  const FREE_HOSTED_SERVER_LIFECYCLE_POLICY = Object.freeze({
    version: 1,
    minimumReadyPlayersToStart: 2,
    registrationWindowMs: 60 * 60 * 1e3,
    allowJoinsWhileRunningDuringWindow: true,
    requireFreshWorkerForRegistration: true,
    allowSetupCompletionAfterWindow: true
  });
  const DEFAULT_PUBLIC_MAP_COMPOSITION = Object.freeze({
    downtown: 8,
    commercial: 40,
    industrial: 38,
    residential: 38,
    park: 37
  });
  const publicServerRegistry = Object.freeze([
    Object.freeze({
      serverInstanceId: "instance:free:eu-central:public-1",
      mode: "free",
      region: "EU Central",
      displayName: "Neon Docks FREE-01",
      capacity: 20,
      mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
      joinPolicy: "open",
      isPublic: true,
      legacyAliases: Object.freeze(["free-eu-01"])
    }),
    Object.freeze({
      serverInstanceId: "instance:free:eu-central:public-2",
      mode: "free",
      region: "EU Central",
      displayName: "Rain Market FREE-02",
      capacity: 20,
      mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
      joinPolicy: "open",
      isPublic: true,
      legacyAliases: Object.freeze([
        "free-eu-02",
        "free-eu-03"
      ])
    }),
    Object.freeze({
      serverInstanceId: "instance:war:eu-central:public-1",
      mode: "war",
      region: "EU Central",
      displayName: "Vortex City War",
      capacity: 150,
      // TODO(public-war-map): War stays closed until a larger validated map exists.
      // A paid 150-player War server must not launch on the current 161-district Free map.
      mapComposition: DEFAULT_PUBLIC_MAP_COMPOSITION,
      joinPolicy: "closed",
      isPublic: true,
      legacyAliases: Object.freeze([
        "war-eu-01",
        "war-eu-02",
        "war-eu-03",
        "war-eu-04",
        "war-eu-05"
      ])
    })
  ]);
  Object.freeze(
    Object.fromEntries(publicServerRegistry.flatMap(
      (server) => (server.legacyAliases || []).map((legacyAlias) => [legacyAlias, server.serverInstanceId])
    ))
  );
  const id = "empire-streets-city";
  const version = 1;
  const width = 1600;
  const height = 980;
  const districts = [
    {
      id: "district:1",
      legacyId: 1,
      rowIndex: 0,
      columnIndex: 0,
      name: "District 1",
      zone: "commercial",
      polygon: [
        {
          x: 0,
          y: 48
        },
        {
          x: 15.732,
          y: 48
        },
        {
          x: 31.463,
          y: 54.656
        },
        {
          x: 47.195,
          y: 48
        },
        {
          x: 62.926,
          y: 48
        },
        {
          x: 78.658,
          y: 48
        },
        {
          x: 80.933,
          y: 69.92
        },
        {
          x: 79.08,
          y: 92.168
        },
        {
          x: 76.895,
          y: 114.441
        },
        {
          x: 90.595,
          y: 135.457
        },
        {
          x: 87.357,
          y: 157.814
        },
        {
          x: 78.815,
          y: 165.734
        },
        {
          x: 66.837,
          y: 164.294
        },
        {
          x: 58.06,
          y: 171.573
        },
        {
          x: 48.411,
          y: 176.477
        },
        {
          x: 36.91,
          y: 176.338
        },
        {
          x: 29.684,
          y: 174.17
        },
        {
          x: 21.68,
          y: 178.144
        },
        {
          x: 14.63,
          y: 174.593
        },
        {
          x: 7.504,
          y: 171.636
        },
        {
          x: 0,
          y: 171.661
        },
        {
          x: 1.907,
          y: 146.929
        },
        {
          x: 0,
          y: 122.197
        },
        {
          x: 0,
          y: 97.465
        },
        {
          x: 1.498,
          y: 72.732
        }
      ],
      neighborIds: [
        "district:2",
        "district:24",
        "district:25"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:2",
      legacyId: 2,
      rowIndex: 0,
      columnIndex: 1,
      name: "District 2",
      zone: "park",
      polygon: [
        {
          x: 78.658,
          y: 48
        },
        {
          x: 95.936,
          y: 50.187
        },
        {
          x: 113.214,
          y: 48
        },
        {
          x: 130.493,
          y: 56.138
        },
        {
          x: 147.771,
          y: 50.597
        },
        {
          x: 165.049,
          y: 48
        },
        {
          x: 157.664,
          y: 71.356
        },
        {
          x: 147.601,
          y: 94.237
        },
        {
          x: 158.207,
          y: 120.788
        },
        {
          x: 149.313,
          y: 143.877
        },
        {
          x: 143.817,
          y: 167.569
        },
        {
          x: 142.284,
          y: 167.4
        },
        {
          x: 140.849,
          y: 167.54
        },
        {
          x: 139.66,
          y: 168.445
        },
        {
          x: 138.541,
          y: 169.57
        },
        {
          x: 137.108,
          y: 169.716
        },
        {
          x: 127.83,
          y: 164.526
        },
        {
          x: 116.75,
          y: 166.867
        },
        {
          x: 105.956,
          y: 168.012
        },
        {
          x: 98.067,
          y: 157.018
        },
        {
          x: 87.357,
          y: 157.814
        },
        {
          x: 90.595,
          y: 135.457
        },
        {
          x: 76.895,
          y: 114.441
        },
        {
          x: 79.08,
          y: 92.168
        },
        {
          x: 80.933,
          y: 69.92
        }
      ],
      neighborIds: [
        "district:1",
        "district:3",
        "district:25",
        "district:26"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:3",
      legacyId: 3,
      rowIndex: 0,
      columnIndex: 2,
      name: "District 3",
      zone: "industrial",
      polygon: [
        {
          x: 165.049,
          y: 48
        },
        {
          x: 176.416,
          y: 48
        },
        {
          x: 187.782,
          y: 53.859
        },
        {
          x: 199.149,
          y: 49.922
        },
        {
          x: 210.516,
          y: 48
        },
        {
          x: 221.883,
          y: 48
        },
        {
          x: 227.3,
          y: 72.928
        },
        {
          x: 218.838,
          y: 97.856
        },
        {
          x: 222.775,
          y: 122.784
        },
        {
          x: 226.891,
          y: 147.713
        },
        {
          x: 221.883,
          y: 172.641
        },
        {
          x: 218.125,
          y: 174.053
        },
        {
          x: 214.727,
          y: 176.711
        },
        {
          x: 211.274,
          y: 179.182
        },
        {
          x: 206.145,
          y: 175.836
        },
        {
          x: 202.657,
          y: 178.184
        },
        {
          x: 191.708,
          y: 171.521
        },
        {
          x: 178.349,
          y: 178.215
        },
        {
          x: 167.28,
          y: 172.218
        },
        {
          x: 156.331,
          y: 165.555
        },
        {
          x: 143.817,
          y: 167.569
        },
        {
          x: 149.313,
          y: 143.877
        },
        {
          x: 158.207,
          y: 120.788
        },
        {
          x: 147.601,
          y: 94.237
        },
        {
          x: 157.664,
          y: 71.356
        }
      ],
      neighborIds: [
        "district:2",
        "district:4",
        "district:26",
        "district:27"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:4",
      legacyId: 4,
      rowIndex: 0,
      columnIndex: 3,
      name: "District 4",
      zone: "residential",
      polygon: [
        {
          x: 221.883,
          y: 48
        },
        {
          x: 233.718,
          y: 48
        },
        {
          x: 245.554,
          y: 48
        },
        {
          x: 257.39,
          y: 53.898
        },
        {
          x: 269.226,
          y: 48
        },
        {
          x: 281.062,
          y: 48
        },
        {
          x: 289.888,
          y: 70.043
        },
        {
          x: 285.17,
          y: 94.367
        },
        {
          x: 292.907,
          y: 116.594
        },
        {
          x: 297.058,
          y: 139.424
        },
        {
          x: 300.336,
          y: 162.401
        },
        {
          x: 289.548,
          y: 161.303
        },
        {
          x: 280.547,
          y: 165.149
        },
        {
          x: 272.532,
          y: 171.726
        },
        {
          x: 264.156,
          y: 177.303
        },
        {
          x: 254.38,
          y: 179.005
        },
        {
          x: 247.565,
          y: 179.346
        },
        {
          x: 240.794,
          y: 179.459
        },
        {
          x: 233.843,
          y: 180.489
        },
        {
          x: 228.576,
          y: 172.921
        },
        {
          x: 221.883,
          y: 172.641
        },
        {
          x: 226.891,
          y: 147.713
        },
        {
          x: 222.775,
          y: 122.784
        },
        {
          x: 218.838,
          y: 97.856
        },
        {
          x: 227.3,
          y: 72.928
        }
      ],
      neighborIds: [
        "district:3",
        "district:5",
        "district:27",
        "district:28"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:5",
      legacyId: 5,
      rowIndex: 0,
      columnIndex: 4,
      name: "District 5",
      zone: "commercial",
      polygon: [
        {
          x: 281.062,
          y: 48
        },
        {
          x: 301.293,
          y: 49.194
        },
        {
          x: 321.525,
          y: 48
        },
        {
          x: 341.756,
          y: 48
        },
        {
          x: 361.987,
          y: 49.603
        },
        {
          x: 382.219,
          y: 48
        },
        {
          x: 370.13,
          y: 71.231
        },
        {
          x: 359.944,
          y: 95.143
        },
        {
          x: 354.911,
          y: 120.898
        },
        {
          x: 350.783,
          y: 146.977
        },
        {
          x: 338.521,
          y: 170.146
        },
        {
          x: 330.5,
          y: 170.487
        },
        {
          x: 323.817,
          y: 164.239
        },
        {
          x: 315.631,
          y: 165.396
        },
        {
          x: 307.647,
          y: 165.559
        },
        {
          x: 300.336,
          y: 162.401
        },
        {
          x: 297.058,
          y: 139.424
        },
        {
          x: 292.907,
          y: 116.594
        },
        {
          x: 285.17,
          y: 94.367
        },
        {
          x: 289.888,
          y: 70.043
        }
      ],
      neighborIds: [
        "district:4",
        "district:6",
        "district:28"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:6",
      legacyId: 6,
      rowIndex: 0,
      columnIndex: 5,
      name: "District 6",
      zone: "industrial",
      polygon: [
        {
          x: 382.219,
          y: 48
        },
        {
          x: 390.973,
          y: 48
        },
        {
          x: 399.727,
          y: 48
        },
        {
          x: 408.481,
          y: 53.536
        },
        {
          x: 417.235,
          y: 48
        },
        {
          x: 425.99,
          y: 48
        },
        {
          x: 421.339,
          y: 75.298
        },
        {
          x: 419.128,
          y: 102.595
        },
        {
          x: 423.064,
          y: 129.893
        },
        {
          x: 428.638,
          y: 157.19
        },
        {
          x: 425.99,
          y: 184.488
        },
        {
          x: 424.106,
          y: 184.648
        },
        {
          x: 422.236,
          y: 184.851
        },
        {
          x: 420.278,
          y: 184.771
        },
        {
          x: 419.032,
          y: 186.993
        },
        {
          x: 417.167,
          y: 187.216
        },
        {
          x: 400.366,
          y: 189.671
        },
        {
          x: 384.165,
          y: 189.284
        },
        {
          x: 369.392,
          y: 182.14
        },
        {
          x: 355.113,
          y: 172.654
        },
        {
          x: 339.231,
          y: 170.755
        },
        {
          x: 339.036,
          y: 170.695
        },
        {
          x: 338.991,
          y: 170.46
        },
        {
          x: 338.806,
          y: 170.388
        },
        {
          x: 338.615,
          y: 170.324
        },
        {
          x: 338.521,
          y: 170.146
        },
        {
          x: 350.783,
          y: 146.977
        },
        {
          x: 354.911,
          y: 120.898
        },
        {
          x: 359.944,
          y: 95.143
        },
        {
          x: 370.13,
          y: 71.231
        }
      ],
      neighborIds: [
        "district:5",
        "district:7",
        "district:29",
        "district:30"
      ]
    },
    {
      id: "district:7",
      legacyId: 7,
      rowIndex: 0,
      columnIndex: 6,
      name: "District 7",
      zone: "residential",
      polygon: [
        {
          x: 425.99,
          y: 48
        },
        {
          x: 436.002,
          y: 49.282
        },
        {
          x: 446.014,
          y: 48
        },
        {
          x: 456.026,
          y: 48
        },
        {
          x: 466.038,
          y: 48.913
        },
        {
          x: 476.05,
          y: 48
        },
        {
          x: 479.651,
          y: 75.39
        },
        {
          x: 488.321,
          y: 101.462
        },
        {
          x: 499.03,
          y: 127.003
        },
        {
          x: 507.41,
          y: 153.15
        },
        {
          x: 510.543,
          y: 180.662
        },
        {
          x: 505.128,
          y: 185.774
        },
        {
          x: 496.932,
          y: 183.834
        },
        {
          x: 489.603,
          y: 184.092
        },
        {
          x: 485.929,
          y: 193.619
        },
        {
          x: 478.388,
          y: 193.341
        },
        {
          x: 467.542,
          y: 193.738
        },
        {
          x: 458.718,
          y: 182.168
        },
        {
          x: 447.611,
          y: 184.11
        },
        {
          x: 436.168,
          y: 188.04
        },
        {
          x: 425.99,
          y: 184.488
        },
        {
          x: 428.638,
          y: 157.19
        },
        {
          x: 423.064,
          y: 129.893
        },
        {
          x: 419.128,
          y: 102.595
        },
        {
          x: 421.339,
          y: 75.298
        }
      ],
      neighborIds: [
        "district:6",
        "district:8",
        "district:30",
        "district:31"
      ]
    },
    {
      id: "district:8",
      legacyId: 8,
      rowIndex: 0,
      columnIndex: 7,
      name: "District 8",
      zone: "commercial",
      polygon: [
        {
          x: 476.05,
          y: 48
        },
        {
          x: 492.911,
          y: 48
        },
        {
          x: 509.772,
          y: 48
        },
        {
          x: 526.633,
          y: 56.767
        },
        {
          x: 543.494,
          y: 48
        },
        {
          x: 560.356,
          y: 48
        },
        {
          x: 567.729,
          y: 69.725
        },
        {
          x: 557.949,
          y: 92.861
        },
        {
          x: 563.697,
          y: 114.719
        },
        {
          x: 568.76,
          y: 136.634
        },
        {
          x: 569.476,
          y: 158.907
        },
        {
          x: 559.252,
          y: 163.22
        },
        {
          x: 546.133,
          y: 161.032
        },
        {
          x: 542.124,
          y: 179.305
        },
        {
          x: 529.012,
          y: 177.133
        },
        {
          x: 518.799,
          y: 181.472
        },
        {
          x: 517.096,
          y: 181.836
        },
        {
          x: 515.566,
          y: 180.441
        },
        {
          x: 513.972,
          y: 179.694
        },
        {
          x: 512.136,
          y: 181.411
        },
        {
          x: 510.543,
          y: 180.662
        },
        {
          x: 507.41,
          y: 153.15
        },
        {
          x: 499.03,
          y: 127.003
        },
        {
          x: 488.321,
          y: 101.462
        },
        {
          x: 479.651,
          y: 75.39
        }
      ],
      neighborIds: [
        "district:7",
        "district:9",
        "district:31",
        "district:32"
      ]
    },
    {
      id: "district:9",
      legacyId: 9,
      rowIndex: 0,
      columnIndex: 8,
      name: "District 9",
      zone: "industrial",
      polygon: [
        {
          x: 560.356,
          y: 48
        },
        {
          x: 576.687,
          y: 48
        },
        {
          x: 593.018,
          y: 55.21
        },
        {
          x: 609.349,
          y: 48
        },
        {
          x: 625.681,
          y: 48
        },
        {
          x: 642.012,
          y: 48
        },
        {
          x: 645.464,
          y: 71.501
        },
        {
          x: 647.519,
          y: 94.884
        },
        {
          x: 630.551,
          y: 116.67
        },
        {
          x: 635.214,
          y: 140.272
        },
        {
          x: 632.33,
          y: 163.241
        },
        {
          x: 630.249,
          y: 163.054
        },
        {
          x: 628.539,
          y: 163.815
        },
        {
          x: 627.041,
          y: 165.115
        },
        {
          x: 625.477,
          y: 166.247
        },
        {
          x: 623.631,
          y: 166.658
        },
        {
          x: 612.992,
          y: 163.766
        },
        {
          x: 601.089,
          y: 169.707
        },
        {
          x: 590.807,
          y: 164.319
        },
        {
          x: 580.442,
          y: 159.514
        },
        {
          x: 569.476,
          y: 158.907
        },
        {
          x: 568.76,
          y: 136.634
        },
        {
          x: 563.697,
          y: 114.719
        },
        {
          x: 557.949,
          y: 92.861
        },
        {
          x: 567.729,
          y: 69.725
        }
      ],
      neighborIds: [
        "district:8",
        "district:10",
        "district:32",
        "district:33"
      ]
    },
    {
      id: "district:10",
      legacyId: 10,
      rowIndex: 0,
      columnIndex: 9,
      name: "District 10",
      zone: "residential",
      polygon: [
        {
          x: 642.012,
          y: 48
        },
        {
          x: 661.461,
          y: 48
        },
        {
          x: 680.91,
          y: 54.22
        },
        {
          x: 700.359,
          y: 50.283
        },
        {
          x: 719.807,
          y: 48
        },
        {
          x: 739.256,
          y: 48
        },
        {
          x: 725.418,
          y: 71.243
        },
        {
          x: 719.434,
          y: 97.871
        },
        {
          x: 712.434,
          y: 124.061
        },
        {
          x: 693.197,
          y: 144.978
        },
        {
          x: 686.18,
          y: 171.16
        },
        {
          x: 675.137,
          y: 171.431
        },
        {
          x: 663.638,
          y: 174.808
        },
        {
          x: 655.018,
          y: 158.603
        },
        {
          x: 643.463,
          y: 162.359
        },
        {
          x: 632.33,
          y: 163.241
        },
        {
          x: 635.214,
          y: 140.272
        },
        {
          x: 630.551,
          y: 116.67
        },
        {
          x: 647.519,
          y: 94.884
        },
        {
          x: 645.464,
          y: 71.501
        }
      ],
      neighborIds: [
        "district:9",
        "district:11",
        "district:33"
      ]
    },
    {
      id: "district:11",
      legacyId: 11,
      rowIndex: 0,
      columnIndex: 10,
      name: "District 11",
      zone: "commercial",
      polygon: [
        {
          x: 739.256,
          y: 48
        },
        {
          x: 741.423,
          y: 48
        },
        {
          x: 743.591,
          y: 48.56
        },
        {
          x: 745.758,
          y: 48
        },
        {
          x: 747.925,
          y: 48
        },
        {
          x: 750.092,
          y: 48
        },
        {
          x: 757.998,
          y: 75.343
        },
        {
          x: 777.71,
          y: 98.346
        },
        {
          x: 783.81,
          y: 126.352
        },
        {
          x: 787.768,
          y: 155.146
        },
        {
          x: 799.068,
          y: 181.241
        },
        {
          x: 798.94,
          y: 181.467
        },
        {
          x: 798.809,
          y: 181.691
        },
        {
          x: 798.714,
          y: 181.946
        },
        {
          x: 798.368,
          y: 181.989
        },
        {
          x: 798.247,
          y: 182.22
        },
        {
          x: 792.336,
          y: 188.608
        },
        {
          x: 783,
          y: 185.858
        },
        {
          x: 776.685,
          y: 191.168
        },
        {
          x: 770.389,
          y: 196.528
        },
        {
          x: 761.837,
          y: 195.869
        },
        {
          x: 747.342,
          y: 191.595
        },
        {
          x: 732.666,
          y: 187.928
        },
        {
          x: 717.061,
          y: 187.351
        },
        {
          x: 705.207,
          y: 174.286
        },
        {
          x: 689.474,
          y: 174.135
        },
        {
          x: 688.688,
          y: 173.681
        },
        {
          x: 688.336,
          y: 172.746
        },
        {
          x: 687.888,
          y: 171.918
        },
        {
          x: 686.689,
          y: 171.921
        },
        {
          x: 686.18,
          y: 171.16
        },
        {
          x: 693.197,
          y: 144.978
        },
        {
          x: 712.434,
          y: 124.061
        },
        {
          x: 719.434,
          y: 97.871
        },
        {
          x: 725.418,
          y: 71.243
        }
      ],
      neighborIds: [
        "district:10",
        "district:12",
        "district:33",
        "district:34",
        "district:35",
        "district:36"
      ]
    },
    {
      id: "district:12",
      legacyId: 12,
      rowIndex: 0,
      columnIndex: 11,
      name: "District 12",
      zone: "park",
      polygon: [
        {
          x: 750.092,
          y: 48
        },
        {
          x: 770.872,
          y: 51.129
        },
        {
          x: 791.653,
          y: 48
        },
        {
          x: 812.433,
          y: 48
        },
        {
          x: 833.214,
          y: 48
        },
        {
          x: 853.994,
          y: 48
        },
        {
          x: 854.586,
          y: 73.351
        },
        {
          x: 849.247,
          y: 97.523
        },
        {
          x: 840.559,
          y: 121.028
        },
        {
          x: 832.945,
          y: 144.748
        },
        {
          x: 829.858,
          y: 169.367
        },
        {
          x: 823.247,
          y: 170.567
        },
        {
          x: 818.633,
          y: 176.946
        },
        {
          x: 811.634,
          y: 177.139
        },
        {
          x: 804.861,
          y: 177.918
        },
        {
          x: 799.068,
          y: 181.241
        },
        {
          x: 787.768,
          y: 155.146
        },
        {
          x: 783.81,
          y: 126.352
        },
        {
          x: 777.71,
          y: 98.346
        },
        {
          x: 757.998,
          y: 75.343
        }
      ],
      neighborIds: [
        "district:11",
        "district:13",
        "district:36"
      ]
    },
    {
      id: "district:13",
      legacyId: 13,
      rowIndex: 0,
      columnIndex: 12,
      name: "District 13",
      zone: "industrial",
      polygon: [
        {
          x: 853.994,
          y: 48
        },
        {
          x: 861.704,
          y: 50.221
        },
        {
          x: 869.413,
          y: 48
        },
        {
          x: 877.123,
          y: 48
        },
        {
          x: 884.832,
          y: 48
        },
        {
          x: 892.541,
          y: 48
        },
        {
          x: 895.202,
          y: 72.909
        },
        {
          x: 906.473,
          y: 95.21
        },
        {
          x: 917.377,
          y: 117.621
        },
        {
          x: 916.22,
          y: 143.687
        },
        {
          x: 928.225,
          y: 165.765
        },
        {
          x: 921.764,
          y: 166.892
        },
        {
          x: 917.758,
          y: 172.987
        },
        {
          x: 911.13,
          y: 173.776
        },
        {
          x: 904.946,
          y: 175.462
        },
        {
          x: 900.023,
          y: 179.701
        },
        {
          x: 885.563,
          y: 180.532
        },
        {
          x: 872.51,
          y: 171.811
        },
        {
          x: 857.903,
          y: 173.639
        },
        {
          x: 843.524,
          y: 173.927
        },
        {
          x: 829.858,
          y: 169.367
        },
        {
          x: 832.945,
          y: 144.748
        },
        {
          x: 840.559,
          y: 121.028
        },
        {
          x: 849.247,
          y: 97.523
        },
        {
          x: 854.586,
          y: 73.351
        }
      ],
      neighborIds: [
        "district:12",
        "district:14",
        "district:36",
        "district:37"
      ]
    },
    {
      id: "district:14",
      legacyId: 14,
      rowIndex: 0,
      columnIndex: 13,
      name: "District 14",
      zone: "commercial",
      polygon: [
        {
          x: 892.541,
          y: 48
        },
        {
          x: 912.891,
          y: 48
        },
        {
          x: 933.24,
          y: 48
        },
        {
          x: 953.589,
          y: 50.736
        },
        {
          x: 973.939,
          y: 48
        },
        {
          x: 994.288,
          y: 48
        },
        {
          x: 984.263,
          y: 71.22
        },
        {
          x: 987.978,
          y: 96.968
        },
        {
          x: 979.646,
          y: 120.499
        },
        {
          x: 971.283,
          y: 144.025
        },
        {
          x: 971.984,
          y: 169.218
        },
        {
          x: 970.729,
          y: 169.997
        },
        {
          x: 969.06,
          y: 169.62
        },
        {
          x: 967.874,
          y: 170.589
        },
        {
          x: 966.634,
          y: 171.409
        },
        {
          x: 965.188,
          y: 171.655
        },
        {
          x: 957.467,
          y: 172.54
        },
        {
          x: 951.123,
          y: 164.779
        },
        {
          x: 943.313,
          y: 166.221
        },
        {
          x: 935.332,
          y: 168.734
        },
        {
          x: 928.225,
          y: 165.765
        },
        {
          x: 916.22,
          y: 143.687
        },
        {
          x: 917.377,
          y: 117.621
        },
        {
          x: 906.473,
          y: 95.21
        },
        {
          x: 895.202,
          y: 72.909
        }
      ],
      neighborIds: [
        "district:13",
        "district:15",
        "district:37",
        "district:38"
      ]
    },
    {
      id: "district:15",
      legacyId: 15,
      rowIndex: 0,
      columnIndex: 14,
      name: "District 15",
      zone: "residential",
      polygon: [
        {
          x: 994.288,
          y: 48
        },
        {
          x: 1004.647,
          y: 48
        },
        {
          x: 1015.007,
          y: 50.28
        },
        {
          x: 1025.366,
          y: 48
        },
        {
          x: 1035.725,
          y: 48
        },
        {
          x: 1046.085,
          y: 48
        },
        {
          x: 1044.174,
          y: 72.864
        },
        {
          x: 1051.006,
          y: 96.952
        },
        {
          x: 1057.102,
          y: 121.105
        },
        {
          x: 1050.289,
          y: 146.404
        },
        {
          x: 1056.956,
          y: 170.507
        },
        {
          x: 1052.153,
          y: 169.953
        },
        {
          x: 1047.482,
          y: 169.841
        },
        {
          x: 1044.942,
          y: 176.893
        },
        {
          x: 1039.879,
          y: 175.464
        },
        {
          x: 1035.652,
          y: 176.843
        },
        {
          x: 1023.426,
          y: 171.079
        },
        {
          x: 1010.538,
          y: 170.844
        },
        {
          x: 997.336,
          y: 173.228
        },
        {
          x: 984.357,
          y: 173.752
        },
        {
          x: 971.984,
          y: 169.218
        },
        {
          x: 971.283,
          y: 144.025
        },
        {
          x: 979.646,
          y: 120.499
        },
        {
          x: 987.978,
          y: 96.968
        },
        {
          x: 984.263,
          y: 71.22
        }
      ],
      neighborIds: [
        "district:14",
        "district:16",
        "district:38",
        "district:39"
      ]
    },
    {
      id: "district:16",
      legacyId: 16,
      rowIndex: 0,
      columnIndex: 15,
      name: "District 16",
      zone: "industrial",
      polygon: [
        {
          x: 1046.085,
          y: 48
        },
        {
          x: 1062.213,
          y: 48
        },
        {
          x: 1078.342,
          y: 53.072
        },
        {
          x: 1094.47,
          y: 57.009
        },
        {
          x: 1110.599,
          y: 48
        },
        {
          x: 1126.727,
          y: 48
        },
        {
          x: 1126.322,
          y: 74.422
        },
        {
          x: 1118.049,
          y: 100.189
        },
        {
          x: 1111.94,
          y: 126.136
        },
        {
          x: 1120.171,
          y: 153.276
        },
        {
          x: 1115.796,
          y: 179.368
        },
        {
          x: 1114.442,
          y: 179.358
        },
        {
          x: 1113.001,
          y: 179.048
        },
        {
          x: 1112.244,
          y: 181.101
        },
        {
          x: 1110.846,
          y: 180.939
        },
        {
          x: 1109.562,
          y: 181.17
        },
        {
          x: 1099.431,
          y: 177.108
        },
        {
          x: 1089.907,
          y: 170.056
        },
        {
          x: 1076.491,
          y: 182.207
        },
        {
          x: 1067.012,
          y: 174.93
        },
        {
          x: 1056.956,
          y: 170.507
        },
        {
          x: 1050.289,
          y: 146.404
        },
        {
          x: 1057.102,
          y: 121.105
        },
        {
          x: 1051.006,
          y: 96.952
        },
        {
          x: 1044.174,
          y: 72.864
        }
      ],
      neighborIds: [
        "district:15",
        "district:17",
        "district:39",
        "district:40"
      ]
    },
    {
      id: "district:17",
      legacyId: 17,
      rowIndex: 0,
      columnIndex: 16,
      name: "District 17",
      zone: "park",
      polygon: [
        {
          x: 1126.727,
          y: 48
        },
        {
          x: 1140.142,
          y: 48
        },
        {
          x: 1153.556,
          y: 54.838
        },
        {
          x: 1166.97,
          y: 50.902
        },
        {
          x: 1180.385,
          y: 48
        },
        {
          x: 1193.799,
          y: 48
        },
        {
          x: 1199.22,
          y: 70.731
        },
        {
          x: 1196.047,
          y: 94.116
        },
        {
          x: 1193.87,
          y: 117.425
        },
        {
          x: 1204.873,
          y: 139.732
        },
        {
          x: 1202.542,
          y: 163.052
        },
        {
          x: 1188.996,
          y: 161.937
        },
        {
          x: 1181.563,
          y: 177.017
        },
        {
          x: 1168.685,
          y: 177.671
        },
        {
          x: 1156.105,
          y: 179.117
        },
        {
          x: 1145.101,
          y: 184.737
        },
        {
          x: 1138.935,
          y: 185.33
        },
        {
          x: 1133.265,
          y: 183.21
        },
        {
          x: 1127.785,
          y: 180.059
        },
        {
          x: 1122.057,
          y: 178.258
        },
        {
          x: 1115.796,
          y: 179.368
        },
        {
          x: 1120.171,
          y: 153.276
        },
        {
          x: 1111.94,
          y: 126.136
        },
        {
          x: 1118.049,
          y: 100.189
        },
        {
          x: 1126.322,
          y: 74.422
        }
      ],
      neighborIds: [
        "district:16",
        "district:18",
        "district:40",
        "district:41"
      ]
    },
    {
      id: "district:18",
      legacyId: 18,
      rowIndex: 0,
      columnIndex: 17,
      name: "District 18",
      zone: "commercial",
      polygon: [
        {
          x: 1193.799,
          y: 48
        },
        {
          x: 1209.314,
          y: 48
        },
        {
          x: 1224.83,
          y: 48
        },
        {
          x: 1240.345,
          y: 54.11
        },
        {
          x: 1255.86,
          y: 49.343
        },
        {
          x: 1271.376,
          y: 48
        },
        {
          x: 1271.517,
          y: 71.142
        },
        {
          x: 1272.266,
          y: 94.283
        },
        {
          x: 1276.203,
          y: 117.425
        },
        {
          x: 1267.06,
          y: 140.567
        },
        {
          x: 1271.376,
          y: 163.708
        },
        {
          x: 1265.338,
          y: 166.398
        },
        {
          x: 1259.309,
          y: 169.119
        },
        {
          x: 1253.651,
          y: 173.141
        },
        {
          x: 1245.739,
          y: 169.249
        },
        {
          x: 1239.909,
          y: 172.667
        },
        {
          x: 1233.161,
          y: 167.927
        },
        {
          x: 1226.25,
          y: 163.818
        },
        {
          x: 1216.166,
          y: 172.041
        },
        {
          x: 1209.969,
          y: 165.156
        },
        {
          x: 1202.542,
          y: 163.052
        },
        {
          x: 1204.873,
          y: 139.732
        },
        {
          x: 1193.87,
          y: 117.425
        },
        {
          x: 1196.047,
          y: 94.116
        },
        {
          x: 1199.22,
          y: 70.731
        }
      ],
      neighborIds: [
        "district:17",
        "district:19",
        "district:41",
        "district:42"
      ]
    },
    {
      id: "district:19",
      legacyId: 19,
      rowIndex: 0,
      columnIndex: 18,
      name: "District 19",
      zone: "residential",
      polygon: [
        {
          x: 1271.376,
          y: 48
        },
        {
          x: 1291.156,
          y: 52.494
        },
        {
          x: 1310.935,
          y: 48.061
        },
        {
          x: 1330.715,
          y: 48
        },
        {
          x: 1350.495,
          y: 48
        },
        {
          x: 1370.275,
          y: 48
        },
        {
          x: 1357.542,
          y: 72.737
        },
        {
          x: 1351.258,
          y: 100.769
        },
        {
          x: 1325.166,
          y: 118.679
        },
        {
          x: 1319.198,
          y: 146.873
        },
        {
          x: 1306.975,
          y: 171.87
        },
        {
          x: 1299.536,
          y: 171.631
        },
        {
          x: 1292.121,
          y: 171.284
        },
        {
          x: 1284.423,
          y: 172.174
        },
        {
          x: 1278.831,
          y: 163.878
        },
        {
          x: 1271.376,
          y: 163.708
        },
        {
          x: 1267.06,
          y: 140.567
        },
        {
          x: 1276.203,
          y: 117.425
        },
        {
          x: 1272.266,
          y: 94.283
        },
        {
          x: 1271.517,
          y: 71.142
        }
      ],
      neighborIds: [
        "district:18",
        "district:20",
        "district:42"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:20",
      legacyId: 20,
      rowIndex: 0,
      columnIndex: 19,
      name: "District 20",
      zone: "park",
      polygon: [
        {
          x: 1370.275,
          y: 48
        },
        {
          x: 1374.568,
          y: 49.118
        },
        {
          x: 1378.861,
          y: 51.33
        },
        {
          x: 1383.155,
          y: 48
        },
        {
          x: 1387.448,
          y: 48.96
        },
        {
          x: 1391.741,
          y: 48
        },
        {
          x: 1397.97,
          y: 74.027
        },
        {
          x: 1390.928,
          y: 101.206
        },
        {
          x: 1397.138,
          y: 127.235
        },
        {
          x: 1404.427,
          y: 153.171
        },
        {
          x: 1403.183,
          y: 179.847
        },
        {
          x: 1396.539,
          y: 184.815
        },
        {
          x: 1391.051,
          y: 191.931
        },
        {
          x: 1378.548,
          y: 186.01
        },
        {
          x: 1373.305,
          y: 193.581
        },
        {
          x: 1367.058,
          y: 199.287
        },
        {
          x: 1359.434,
          y: 199.439
        },
        {
          x: 1353.139,
          y: 192.084
        },
        {
          x: 1344.004,
          y: 200.781
        },
        {
          x: 1337.288,
          y: 195.801
        },
        {
          x: 1330.228,
          y: 192.771
        },
        {
          x: 1324.024,
          y: 190.319
        },
        {
          x: 1324.089,
          y: 180.892
        },
        {
          x: 1317.958,
          y: 178.36
        },
        {
          x: 1311.749,
          y: 175.912
        },
        {
          x: 1306.975,
          y: 171.87
        },
        {
          x: 1319.198,
          y: 146.873
        },
        {
          x: 1325.166,
          y: 118.679
        },
        {
          x: 1351.258,
          y: 100.769
        },
        {
          x: 1357.542,
          y: 72.737
        }
      ],
      neighborIds: [
        "district:19",
        "district:21",
        "district:42",
        "district:43",
        "district:44"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:21",
      legacyId: 21,
      rowIndex: 0,
      columnIndex: 20,
      name: "District 21",
      zone: "commercial",
      polygon: [
        {
          x: 1391.741,
          y: 48
        },
        {
          x: 1406.599,
          y: 48.848
        },
        {
          x: 1421.457,
          y: 53.31
        },
        {
          x: 1436.314,
          y: 57.246
        },
        {
          x: 1451.172,
          y: 48.439
        },
        {
          x: 1466.029,
          y: 48
        },
        {
          x: 1471.628,
          y: 74.212
        },
        {
          x: 1474.427,
          y: 100.424
        },
        {
          x: 1470.49,
          y: 126.635
        },
        {
          x: 1464.329,
          y: 152.847
        },
        {
          x: 1466.029,
          y: 179.059
        },
        {
          x: 1463.174,
          y: 181.049
        },
        {
          x: 1458.962,
          y: 179.825
        },
        {
          x: 1457.623,
          y: 185.407
        },
        {
          x: 1453.813,
          y: 185.137
        },
        {
          x: 1450.346,
          y: 185.679
        },
        {
          x: 1440.609,
          y: 186.978
        },
        {
          x: 1431.057,
          y: 186.774
        },
        {
          x: 1422.038,
          y: 182.265
        },
        {
          x: 1413.077,
          y: 177.283
        },
        {
          x: 1403.183,
          y: 179.847
        },
        {
          x: 1404.427,
          y: 153.171
        },
        {
          x: 1397.138,
          y: 127.235
        },
        {
          x: 1390.928,
          y: 101.206
        },
        {
          x: 1397.97,
          y: 74.027
        }
      ],
      neighborIds: [
        "district:20",
        "district:22",
        "district:44",
        "district:45"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:22",
      legacyId: 22,
      rowIndex: 0,
      columnIndex: 21,
      name: "District 22",
      zone: "residential",
      polygon: [
        {
          x: 1466.029,
          y: 48
        },
        {
          x: 1479.806,
          y: 51.194
        },
        {
          x: 1493.582,
          y: 48
        },
        {
          x: 1507.358,
          y: 48
        },
        {
          x: 1521.134,
          y: 50.785
        },
        {
          x: 1534.911,
          y: 48
        },
        {
          x: 1538.917,
          y: 71.805
        },
        {
          x: 1538.124,
          y: 95.954
        },
        {
          x: 1535.92,
          y: 120.205
        },
        {
          x: 1536.804,
          y: 144.234
        },
        {
          x: 1543.523,
          y: 167.844
        },
        {
          x: 1537.905,
          y: 172.808
        },
        {
          x: 1532.228,
          y: 177.671
        },
        {
          x: 1527.19,
          y: 183.628
        },
        {
          x: 1517.363,
          y: 181.382
        },
        {
          x: 1511.765,
          y: 186.381
        },
        {
          x: 1502.05,
          y: 188.464
        },
        {
          x: 1493.071,
          y: 185.952
        },
        {
          x: 1484.442,
          y: 181.246
        },
        {
          x: 1475.571,
          y: 178.062
        },
        {
          x: 1466.029,
          y: 179.059
        },
        {
          x: 1464.329,
          y: 152.847
        },
        {
          x: 1470.49,
          y: 126.635
        },
        {
          x: 1474.427,
          y: 100.424
        },
        {
          x: 1471.628,
          y: 74.212
        }
      ],
      neighborIds: [
        "district:21",
        "district:23",
        "district:45",
        "district:46"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:23",
      legacyId: 23,
      rowIndex: 0,
      columnIndex: 22,
      name: "District 23",
      zone: "industrial",
      polygon: [
        {
          x: 1534.911,
          y: 48
        },
        {
          x: 1547.928,
          y: 48
        },
        {
          x: 1560.946,
          y: 51.98
        },
        {
          x: 1573.964,
          y: 48.043
        },
        {
          x: 1586.982,
          y: 48
        },
        {
          x: 1600,
          y: 48
        },
        {
          x: 1600,
          y: 74.776
        },
        {
          x: 1593.298,
          y: 101.551
        },
        {
          x: 1597.235,
          y: 128.327
        },
        {
          x: 1600,
          y: 155.103
        },
        {
          x: 1600,
          y: 181.878
        },
        {
          x: 1587.898,
          y: 182.319
        },
        {
          x: 1577.053,
          y: 177.699
        },
        {
          x: 1566.707,
          y: 171.072
        },
        {
          x: 1555.771,
          y: 166.815
        },
        {
          x: 1543.523,
          y: 167.844
        },
        {
          x: 1536.804,
          y: 144.234
        },
        {
          x: 1535.92,
          y: 120.205
        },
        {
          x: 1538.124,
          y: 95.954
        },
        {
          x: 1538.917,
          y: 71.805
        }
      ],
      neighborIds: [
        "district:22",
        "district:46"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:24",
      legacyId: 24,
      rowIndex: 1,
      columnIndex: 0,
      name: "District 24",
      zone: "residential",
      polygon: [
        {
          x: 0,
          y: 306.052
        },
        {
          x: 0,
          y: 279.174
        },
        {
          x: 0.958,
          y: 252.296
        },
        {
          x: 4.895,
          y: 225.418
        },
        {
          x: 5.458,
          y: 198.54
        },
        {
          x: 0,
          y: 171.661
        },
        {
          x: 7.504,
          y: 171.636
        },
        {
          x: 14.63,
          y: 174.593
        },
        {
          x: 21.68,
          y: 178.144
        },
        {
          x: 29.684,
          y: 174.17
        },
        {
          x: 36.91,
          y: 176.338
        },
        {
          x: 47.245,
          y: 199.089
        },
        {
          x: 49.883,
          y: 224.472
        },
        {
          x: 54.206,
          y: 249.279
        },
        {
          x: 64.483,
          y: 272.049
        },
        {
          x: 77.151,
          y: 294.002
        },
        {
          x: 60.919,
          y: 291.276
        },
        {
          x: 46.31,
          y: 298.946
        },
        {
          x: 30.272,
          y: 297.466
        },
        {
          x: 14.691,
          y: 298.911
        }
      ],
      neighborIds: [
        "district:1",
        "district:25",
        "district:47"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:25",
      legacyId: 25,
      rowIndex: 1,
      columnIndex: 1,
      name: "District 25",
      zone: "industrial",
      polygon: [
        {
          x: 137.108,
          y: 169.716
        },
        {
          x: 137.946,
          y: 194.418
        },
        {
          x: 130.006,
          y: 217.861
        },
        {
          x: 122.651,
          y: 241.387
        },
        {
          x: 127.978,
          y: 266.734
        },
        {
          x: 119.819,
          y: 290.145
        },
        {
          x: 112.112,
          y: 294.043
        },
        {
          x: 103.934,
          y: 293.963
        },
        {
          x: 95.541,
          y: 292.063
        },
        {
          x: 87.981,
          y: 297.202
        },
        {
          x: 79.542,
          y: 294.914
        },
        {
          x: 79.075,
          y: 294.702
        },
        {
          x: 78.615,
          y: 294.472
        },
        {
          x: 78.201,
          y: 294.121
        },
        {
          x: 77.568,
          y: 294.347
        },
        {
          x: 77.151,
          y: 294.002
        },
        {
          x: 64.483,
          y: 272.049
        },
        {
          x: 54.206,
          y: 249.279
        },
        {
          x: 49.883,
          y: 224.472
        },
        {
          x: 47.245,
          y: 199.089
        },
        {
          x: 36.91,
          y: 176.338
        },
        {
          x: 48.411,
          y: 176.477
        },
        {
          x: 58.06,
          y: 171.573
        },
        {
          x: 66.837,
          y: 164.294
        },
        {
          x: 78.815,
          y: 165.734
        },
        {
          x: 87.357,
          y: 157.814
        },
        {
          x: 98.067,
          y: 157.018
        },
        {
          x: 105.956,
          y: 168.012
        },
        {
          x: 116.75,
          y: 166.867
        },
        {
          x: 127.83,
          y: 164.526
        }
      ],
      neighborIds: [
        "district:1",
        "district:2",
        "district:24",
        "district:26",
        "district:47",
        "district:48"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:26",
      legacyId: 26,
      rowIndex: 1,
      columnIndex: 2,
      name: "District 26",
      zone: "commercial",
      polygon: [
        {
          x: 202.657,
          y: 178.184
        },
        {
          x: 204.352,
          y: 203.331
        },
        {
          x: 197.38,
          y: 227.713
        },
        {
          x: 191.269,
          y: 252.17
        },
        {
          x: 198.19,
          y: 277.778
        },
        {
          x: 191.707,
          y: 302.203
        },
        {
          x: 184.146,
          y: 306.556
        },
        {
          x: 176.146,
          y: 306.755
        },
        {
          x: 167.918,
          y: 304.781
        },
        {
          x: 159.8,
          y: 303.854
        },
        {
          x: 152.047,
          y: 306.384
        },
        {
          x: 144.097,
          y: 306.121
        },
        {
          x: 141.131,
          y: 295.968
        },
        {
          x: 133.535,
          y: 295.004
        },
        {
          x: 126.063,
          y: 293.792
        },
        {
          x: 119.819,
          y: 290.145
        },
        {
          x: 127.978,
          y: 266.734
        },
        {
          x: 122.651,
          y: 241.387
        },
        {
          x: 130.006,
          y: 217.861
        },
        {
          x: 137.946,
          y: 194.418
        },
        {
          x: 137.108,
          y: 169.716
        },
        {
          x: 138.541,
          y: 169.57
        },
        {
          x: 139.66,
          y: 168.445
        },
        {
          x: 140.849,
          y: 167.54
        },
        {
          x: 142.284,
          y: 167.4
        },
        {
          x: 143.817,
          y: 167.569
        },
        {
          x: 156.331,
          y: 165.555
        },
        {
          x: 167.28,
          y: 172.218
        },
        {
          x: 178.349,
          y: 178.215
        },
        {
          x: 191.708,
          y: 171.521
        }
      ],
      neighborIds: [
        "district:2",
        "district:3",
        "district:25",
        "district:27",
        "district:48",
        "district:49"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:27",
      legacyId: 27,
      rowIndex: 1,
      columnIndex: 3,
      name: "District 27",
      zone: "park",
      polygon: [
        {
          x: 254.38,
          y: 179.005
        },
        {
          x: 261.587,
          y: 202.594
        },
        {
          x: 252.556,
          y: 228.691
        },
        {
          x: 260.172,
          y: 252.218
        },
        {
          x: 272.359,
          y: 275.039
        },
        {
          x: 273.008,
          y: 299.641
        },
        {
          x: 261.863,
          y: 300.211
        },
        {
          x: 252.947,
          y: 309.739
        },
        {
          x: 241.382,
          y: 308.618
        },
        {
          x: 230.075,
          y: 308.538
        },
        {
          x: 219.865,
          y: 312.866
        },
        {
          x: 214.383,
          y: 310.339
        },
        {
          x: 208.089,
          y: 309.957
        },
        {
          x: 201.701,
          y: 309.82
        },
        {
          x: 198.344,
          y: 301.682
        },
        {
          x: 191.707,
          y: 302.203
        },
        {
          x: 198.19,
          y: 277.778
        },
        {
          x: 191.269,
          y: 252.17
        },
        {
          x: 197.38,
          y: 227.713
        },
        {
          x: 204.352,
          y: 203.331
        },
        {
          x: 202.657,
          y: 178.184
        },
        {
          x: 206.145,
          y: 175.836
        },
        {
          x: 211.274,
          y: 179.182
        },
        {
          x: 214.727,
          y: 176.711
        },
        {
          x: 218.125,
          y: 174.053
        },
        {
          x: 221.883,
          y: 172.641
        },
        {
          x: 228.576,
          y: 172.921
        },
        {
          x: 233.843,
          y: 180.489
        },
        {
          x: 240.794,
          y: 179.459
        },
        {
          x: 247.565,
          y: 179.346
        }
      ],
      neighborIds: [
        "district:3",
        "district:4",
        "district:26",
        "district:28",
        "district:49",
        "district:50"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:28",
      legacyId: 28,
      rowIndex: 1,
      columnIndex: 4,
      name: "District 28",
      zone: "residential",
      polygon: [
        {
          x: 339.231,
          y: 170.755
        },
        {
          x: 341.227,
          y: 197.743
        },
        {
          x: 342.333,
          y: 224.662
        },
        {
          x: 325.229,
          y: 250.172
        },
        {
          x: 330.591,
          y: 277.42
        },
        {
          x: 328.91,
          y: 304.123
        },
        {
          x: 328.807,
          y: 304.229
        },
        {
          x: 328.645,
          y: 304.248
        },
        {
          x: 328.497,
          y: 304.286
        },
        {
          x: 328.451,
          y: 304.477
        },
        {
          x: 328.312,
          y: 304.529
        },
        {
          x: 323.828,
          y: 307.141
        },
        {
          x: 318.125,
          y: 302.563
        },
        {
          x: 313.623,
          y: 305.071
        },
        {
          x: 309.135,
          y: 307.655
        },
        {
          x: 304.366,
          y: 308.589
        },
        {
          x: 298.658,
          y: 304.822
        },
        {
          x: 290.833,
          y: 308.477
        },
        {
          x: 285.196,
          y: 304.465
        },
        {
          x: 279.778,
          y: 299.684
        },
        {
          x: 273.008,
          y: 299.641
        },
        {
          x: 272.359,
          y: 275.039
        },
        {
          x: 260.172,
          y: 252.218
        },
        {
          x: 252.556,
          y: 228.691
        },
        {
          x: 261.587,
          y: 202.594
        },
        {
          x: 254.38,
          y: 179.005
        },
        {
          x: 264.156,
          y: 177.303
        },
        {
          x: 272.532,
          y: 171.726
        },
        {
          x: 280.547,
          y: 165.149
        },
        {
          x: 289.548,
          y: 161.303
        },
        {
          x: 300.336,
          y: 162.401
        },
        {
          x: 307.647,
          y: 165.559
        },
        {
          x: 315.631,
          y: 165.396
        },
        {
          x: 323.817,
          y: 164.239
        },
        {
          x: 330.5,
          y: 170.487
        },
        {
          x: 338.521,
          y: 170.146
        },
        {
          x: 338.615,
          y: 170.324
        },
        {
          x: 338.806,
          y: 170.388
        },
        {
          x: 338.991,
          y: 170.46
        },
        {
          x: 339.036,
          y: 170.695
        }
      ],
      neighborIds: [
        "district:4",
        "district:5",
        "district:27",
        "district:29",
        "district:50",
        "district:51"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:29",
      legacyId: 29,
      rowIndex: 1,
      columnIndex: 5,
      name: "District 29",
      zone: "park",
      polygon: [
        {
          x: 417.167,
          y: 187.216
        },
        {
          x: 407.203,
          y: 207.976
        },
        {
          x: 409.134,
          y: 231.703
        },
        {
          x: 407.495,
          y: 254.54
        },
        {
          x: 390.43,
          y: 273.529
        },
        {
          x: 389.875,
          y: 296.636
        },
        {
          x: 377.797,
          y: 299.071
        },
        {
          x: 365.195,
          y: 297.24
        },
        {
          x: 352.522,
          y: 294.83
        },
        {
          x: 341.761,
          y: 307.987
        },
        {
          x: 328.91,
          y: 304.123
        },
        {
          x: 330.591,
          y: 277.42
        },
        {
          x: 325.229,
          y: 250.172
        },
        {
          x: 342.333,
          y: 224.662
        },
        {
          x: 341.227,
          y: 197.743
        },
        {
          x: 339.231,
          y: 170.755
        },
        {
          x: 355.113,
          y: 172.654
        },
        {
          x: 369.392,
          y: 182.14
        },
        {
          x: 384.165,
          y: 189.284
        },
        {
          x: 400.366,
          y: 189.671
        }
      ],
      neighborIds: [
        "district:6",
        "district:28",
        "district:30",
        "district:52"
      ]
    },
    {
      id: "district:30",
      legacyId: 30,
      rowIndex: 1,
      columnIndex: 6,
      name: "District 30",
      zone: "industrial",
      polygon: [
        {
          x: 478.388,
          y: 193.341
        },
        {
          x: 475.473,
          y: 214.814
        },
        {
          x: 481.601,
          y: 236.928
        },
        {
          x: 476.144,
          y: 258.22
        },
        {
          x: 471.291,
          y: 279.555
        },
        {
          x: 470.738,
          y: 301.195
        },
        {
          x: 461.269,
          y: 305.496
        },
        {
          x: 450.227,
          y: 302.528
        },
        {
          x: 439.531,
          y: 301.156
        },
        {
          x: 431.544,
          y: 312.308
        },
        {
          x: 421.064,
          y: 311.938
        },
        {
          x: 415.591,
          y: 307.319
        },
        {
          x: 410.008,
          y: 302.924
        },
        {
          x: 404.854,
          y: 297.653
        },
        {
          x: 395.649,
          y: 300.64
        },
        {
          x: 389.875,
          y: 296.636
        },
        {
          x: 390.43,
          y: 273.529
        },
        {
          x: 407.495,
          y: 254.54
        },
        {
          x: 409.134,
          y: 231.703
        },
        {
          x: 407.203,
          y: 207.976
        },
        {
          x: 417.167,
          y: 187.216
        },
        {
          x: 419.032,
          y: 186.993
        },
        {
          x: 420.278,
          y: 184.771
        },
        {
          x: 422.236,
          y: 184.851
        },
        {
          x: 424.106,
          y: 184.648
        },
        {
          x: 425.99,
          y: 184.488
        },
        {
          x: 436.168,
          y: 188.04
        },
        {
          x: 447.611,
          y: 184.11
        },
        {
          x: 458.718,
          y: 182.168
        },
        {
          x: 467.542,
          y: 193.738
        }
      ],
      neighborIds: [
        "district:6",
        "district:7",
        "district:29",
        "district:31",
        "district:52",
        "district:53"
      ]
    },
    {
      id: "district:31",
      legacyId: 31,
      rowIndex: 1,
      columnIndex: 7,
      name: "District 31",
      zone: "park",
      polygon: [
        {
          x: 470.738,
          y: 301.195
        },
        {
          x: 471.291,
          y: 279.555
        },
        {
          x: 476.144,
          y: 258.22
        },
        {
          x: 481.601,
          y: 236.928
        },
        {
          x: 475.473,
          y: 214.814
        },
        {
          x: 478.388,
          y: 193.341
        },
        {
          x: 485.929,
          y: 193.619
        },
        {
          x: 489.603,
          y: 184.092
        },
        {
          x: 496.932,
          y: 183.834
        },
        {
          x: 505.128,
          y: 185.774
        },
        {
          x: 510.543,
          y: 180.662
        },
        {
          x: 512.136,
          y: 181.411
        },
        {
          x: 513.972,
          y: 179.694
        },
        {
          x: 515.566,
          y: 180.441
        },
        {
          x: 517.096,
          y: 181.836
        },
        {
          x: 518.799,
          y: 181.472
        },
        {
          x: 531.369,
          y: 204.36
        },
        {
          x: 539.765,
          y: 229.19
        },
        {
          x: 547.183,
          y: 254.475
        },
        {
          x: 564.704,
          y: 275.06
        },
        {
          x: 573.739,
          y: 299.593
        },
        {
          x: 569.054,
          y: 302.076
        },
        {
          x: 566.532,
          y: 307.548
        },
        {
          x: 563.369,
          y: 312.133
        },
        {
          x: 556.179,
          y: 311.154
        },
        {
          x: 552.469,
          y: 314.984
        },
        {
          x: 542.68,
          y: 316.136
        },
        {
          x: 532.83,
          y: 316.594
        },
        {
          x: 522.709,
          y: 313.982
        },
        {
          x: 513.585,
          y: 322.669
        },
        {
          x: 503.398,
          y: 319.311
        },
        {
          x: 495.232,
          y: 318.633
        },
        {
          x: 490.041,
          y: 312.592
        },
        {
          x: 484.793,
          y: 306.654
        },
        {
          x: 475.502,
          y: 308.005
        }
      ],
      neighborIds: [
        "district:7",
        "district:8",
        "district:30",
        "district:32",
        "district:53",
        "district:54",
        "district:55"
      ]
    },
    {
      id: "district:32",
      legacyId: 32,
      rowIndex: 1,
      columnIndex: 8,
      name: "District 32",
      zone: "residential",
      polygon: [
        {
          x: 623.631,
          y: 166.658
        },
        {
          x: 621.139,
          y: 192.687
        },
        {
          x: 610.33,
          y: 218.082
        },
        {
          x: 612.269,
          y: 244.449
        },
        {
          x: 614.773,
          y: 270.859
        },
        {
          x: 613.701,
          y: 296.997
        },
        {
          x: 605.902,
          y: 300.498
        },
        {
          x: 597.54,
          y: 295.317
        },
        {
          x: 589.363,
          y: 293.005
        },
        {
          x: 581.944,
          y: 302.35
        },
        {
          x: 573.739,
          y: 299.593
        },
        {
          x: 564.704,
          y: 275.06
        },
        {
          x: 547.183,
          y: 254.475
        },
        {
          x: 539.765,
          y: 229.19
        },
        {
          x: 531.369,
          y: 204.36
        },
        {
          x: 518.799,
          y: 181.472
        },
        {
          x: 529.012,
          y: 177.133
        },
        {
          x: 542.124,
          y: 179.305
        },
        {
          x: 546.133,
          y: 161.032
        },
        {
          x: 559.252,
          y: 163.22
        },
        {
          x: 569.476,
          y: 158.907
        },
        {
          x: 580.442,
          y: 159.514
        },
        {
          x: 590.807,
          y: 164.319
        },
        {
          x: 601.089,
          y: 169.707
        },
        {
          x: 612.992,
          y: 163.766
        }
      ],
      neighborIds: [
        "district:8",
        "district:9",
        "district:31",
        "district:33",
        "district:55"
      ]
    },
    {
      id: "district:33",
      legacyId: 33,
      rowIndex: 1,
      columnIndex: 9,
      name: "District 33",
      zone: "park",
      polygon: [
        {
          x: 689.474,
          y: 174.135
        },
        {
          x: 684.304,
          y: 197.134
        },
        {
          x: 690.709,
          y: 221.225
        },
        {
          x: 673.497,
          y: 243.09
        },
        {
          x: 677.314,
          y: 266.937
        },
        {
          x: 678.503,
          y: 290.537
        },
        {
          x: 666.138,
          y: 293.35
        },
        {
          x: 653.634,
          y: 295
        },
        {
          x: 640.646,
          y: 292.582
        },
        {
          x: 629.097,
          y: 302.247
        },
        {
          x: 615.89,
          y: 297.99
        },
        {
          x: 615.507,
          y: 297.67
        },
        {
          x: 615.092,
          y: 297.422
        },
        {
          x: 614.584,
          y: 297.379
        },
        {
          x: 614.064,
          y: 297.362
        },
        {
          x: 613.701,
          y: 296.997
        },
        {
          x: 614.773,
          y: 270.859
        },
        {
          x: 612.269,
          y: 244.449
        },
        {
          x: 610.33,
          y: 218.082
        },
        {
          x: 621.139,
          y: 192.687
        },
        {
          x: 623.631,
          y: 166.658
        },
        {
          x: 625.477,
          y: 166.247
        },
        {
          x: 627.041,
          y: 165.115
        },
        {
          x: 628.539,
          y: 163.815
        },
        {
          x: 630.249,
          y: 163.054
        },
        {
          x: 632.33,
          y: 163.241
        },
        {
          x: 643.463,
          y: 162.359
        },
        {
          x: 655.018,
          y: 158.603
        },
        {
          x: 663.638,
          y: 174.808
        },
        {
          x: 675.137,
          y: 171.431
        },
        {
          x: 686.18,
          y: 171.16
        },
        {
          x: 686.689,
          y: 171.921
        },
        {
          x: 687.888,
          y: 171.918
        },
        {
          x: 688.336,
          y: 172.746
        },
        {
          x: 688.688,
          y: 173.681
        }
      ],
      neighborIds: [
        "district:9",
        "district:10",
        "district:11",
        "district:32",
        "district:34",
        "district:55",
        "district:56"
      ]
    },
    {
      id: "district:34",
      legacyId: 34,
      rowIndex: 1,
      columnIndex: 10,
      name: "District 34",
      zone: "industrial",
      polygon: [
        {
          x: 761.837,
          y: 195.869
        },
        {
          x: 761.858,
          y: 218.642
        },
        {
          x: 756.243,
          y: 240.209
        },
        {
          x: 747.736,
          y: 261.159
        },
        {
          x: 740.75,
          y: 282.433
        },
        {
          x: 738.554,
          y: 304.732
        },
        {
          x: 735.243,
          y: 304.464
        },
        {
          x: 731.793,
          y: 303.381
        },
        {
          x: 729.353,
          y: 308.229
        },
        {
          x: 725.939,
          y: 307.359
        },
        {
          x: 722.687,
          y: 307.435
        },
        {
          x: 712.84,
          y: 306.696
        },
        {
          x: 705.976,
          y: 298.16
        },
        {
          x: 695.942,
          y: 297.911
        },
        {
          x: 686.455,
          y: 296.231
        },
        {
          x: 678.503,
          y: 290.537
        },
        {
          x: 677.314,
          y: 266.937
        },
        {
          x: 673.497,
          y: 243.09
        },
        {
          x: 690.709,
          y: 221.225
        },
        {
          x: 684.304,
          y: 197.134
        },
        {
          x: 689.474,
          y: 174.135
        },
        {
          x: 705.207,
          y: 174.286
        },
        {
          x: 717.061,
          y: 187.351
        },
        {
          x: 732.666,
          y: 187.928
        },
        {
          x: 747.342,
          y: 191.595
        }
      ],
      neighborIds: [
        "district:11",
        "district:33",
        "district:35",
        "district:56",
        "district:104"
      ]
    },
    {
      id: "district:35",
      legacyId: 35,
      rowIndex: 1,
      columnIndex: 11,
      name: "District 35",
      zone: "residential",
      polygon: [
        {
          x: 798.247,
          y: 182.22
        },
        {
          x: 808.949,
          y: 205.816
        },
        {
          x: 815.704,
          y: 231.044
        },
        {
          x: 821.96,
          y: 256.479
        },
        {
          x: 839.008,
          y: 277.451
        },
        {
          x: 847.715,
          y: 301.872
        },
        {
          x: 843.475,
          y: 304.84
        },
        {
          x: 841.72,
          y: 311.026
        },
        {
          x: 836.508,
          y: 312.738
        },
        {
          x: 831.317,
          y: 314.475
        },
        {
          x: 827.258,
          y: 317.679
        },
        {
          x: 817.954,
          y: 318.413
        },
        {
          x: 809.063,
          y: 322.574
        },
        {
          x: 800.2,
          y: 326.969
        },
        {
          x: 789.733,
          y: 318.045
        },
        {
          x: 780.968,
          y: 323.254
        },
        {
          x: 772.11,
          y: 320.408
        },
        {
          x: 765.8,
          y: 311.729
        },
        {
          x: 758.63,
          y: 305.019
        },
        {
          x: 746.525,
          y: 309.607
        },
        {
          x: 738.554,
          y: 304.732
        },
        {
          x: 740.75,
          y: 282.433
        },
        {
          x: 747.736,
          y: 261.159
        },
        {
          x: 756.243,
          y: 240.209
        },
        {
          x: 761.858,
          y: 218.642
        },
        {
          x: 761.837,
          y: 195.869
        },
        {
          x: 770.389,
          y: 196.528
        },
        {
          x: 776.685,
          y: 191.168
        },
        {
          x: 783,
          y: 185.858
        },
        {
          x: 792.336,
          y: 188.608
        }
      ],
      neighborIds: [
        "district:11",
        "district:34",
        "district:36",
        "district:103",
        "district:104",
        "district:105"
      ]
    },
    {
      id: "district:36",
      legacyId: 36,
      rowIndex: 1,
      columnIndex: 12,
      name: "District 36",
      zone: "commercial",
      polygon: [
        {
          x: 900.023,
          y: 179.701
        },
        {
          x: 899.809,
          y: 203.485
        },
        {
          x: 887.977,
          y: 225.532
        },
        {
          x: 880.603,
          y: 248.246
        },
        {
          x: 889.771,
          y: 273.432
        },
        {
          x: 882.619,
          y: 296.179
        },
        {
          x: 875.569,
          y: 296.894
        },
        {
          x: 868.478,
          y: 297.355
        },
        {
          x: 861.094,
          y: 296.02
        },
        {
          x: 855.084,
          y: 303.11
        },
        {
          x: 847.715,
          y: 301.872
        },
        {
          x: 839.008,
          y: 277.451
        },
        {
          x: 821.96,
          y: 256.479
        },
        {
          x: 815.704,
          y: 231.044
        },
        {
          x: 808.949,
          y: 205.816
        },
        {
          x: 798.247,
          y: 182.22
        },
        {
          x: 798.368,
          y: 181.989
        },
        {
          x: 798.714,
          y: 181.946
        },
        {
          x: 798.809,
          y: 181.691
        },
        {
          x: 798.94,
          y: 181.467
        },
        {
          x: 799.068,
          y: 181.241
        },
        {
          x: 804.861,
          y: 177.918
        },
        {
          x: 811.634,
          y: 177.139
        },
        {
          x: 818.633,
          y: 176.946
        },
        {
          x: 823.247,
          y: 170.567
        },
        {
          x: 829.858,
          y: 169.367
        },
        {
          x: 843.524,
          y: 173.927
        },
        {
          x: 857.903,
          y: 173.639
        },
        {
          x: 872.51,
          y: 171.811
        },
        {
          x: 885.563,
          y: 180.532
        }
      ],
      neighborIds: [
        "district:11",
        "district:12",
        "district:13",
        "district:35",
        "district:37",
        "district:105"
      ]
    },
    {
      id: "district:37",
      legacyId: 37,
      rowIndex: 1,
      columnIndex: 13,
      name: "District 37",
      zone: "park",
      polygon: [
        {
          x: 965.188,
          y: 171.655
        },
        {
          x: 964.009,
          y: 199.079
        },
        {
          x: 970.49,
          y: 226.503
        },
        {
          x: 974.427,
          y: 253.927
        },
        {
          x: 963.599,
          y: 281.351
        },
        {
          x: 965.188,
          y: 308.775
        },
        {
          x: 958.294,
          y: 307.728
        },
        {
          x: 952.788,
          y: 313.637
        },
        {
          x: 946.813,
          y: 317.198
        },
        {
          x: 938.959,
          y: 311.339
        },
        {
          x: 933.041,
          y: 315.189
        },
        {
          x: 922.065,
          y: 313.754
        },
        {
          x: 914.35,
          y: 303.667
        },
        {
          x: 902.918,
          y: 303.438
        },
        {
          x: 891.951,
          y: 301.976
        },
        {
          x: 882.619,
          y: 296.179
        },
        {
          x: 889.771,
          y: 273.432
        },
        {
          x: 880.603,
          y: 248.246
        },
        {
          x: 887.977,
          y: 225.532
        },
        {
          x: 899.809,
          y: 203.485
        },
        {
          x: 900.023,
          y: 179.701
        },
        {
          x: 904.946,
          y: 175.462
        },
        {
          x: 911.13,
          y: 173.776
        },
        {
          x: 917.758,
          y: 172.987
        },
        {
          x: 921.764,
          y: 166.892
        },
        {
          x: 928.225,
          y: 165.765
        },
        {
          x: 935.332,
          y: 168.734
        },
        {
          x: 943.313,
          y: 166.221
        },
        {
          x: 951.123,
          y: 164.779
        },
        {
          x: 957.467,
          y: 172.54
        }
      ],
      neighborIds: [
        "district:13",
        "district:14",
        "district:36",
        "district:38",
        "district:60",
        "district:105"
      ]
    },
    {
      id: "district:38",
      legacyId: 38,
      rowIndex: 1,
      columnIndex: 14,
      name: "District 38",
      zone: "industrial",
      polygon: [
        {
          x: 1035.652,
          y: 176.843
        },
        {
          x: 1027.661,
          y: 202.726
        },
        {
          x: 1021.067,
          y: 228.748
        },
        {
          x: 1033.468,
          y: 256.647
        },
        {
          x: 1024.266,
          y: 282.411
        },
        {
          x: 1022.601,
          y: 308.919
        },
        {
          x: 1013.478,
          y: 307.821
        },
        {
          x: 1005.136,
          y: 316.956
        },
        {
          x: 995.906,
          y: 314.459
        },
        {
          x: 986.541,
          y: 310.213
        },
        {
          x: 977.665,
          y: 312.354
        },
        {
          x: 975.008,
          y: 312.203
        },
        {
          x: 972.963,
          y: 309.919
        },
        {
          x: 970.213,
          y: 310.087
        },
        {
          x: 967.548,
          y: 309.964
        },
        {
          x: 965.188,
          y: 308.775
        },
        {
          x: 963.599,
          y: 281.351
        },
        {
          x: 974.427,
          y: 253.927
        },
        {
          x: 970.49,
          y: 226.503
        },
        {
          x: 964.009,
          y: 199.079
        },
        {
          x: 965.188,
          y: 171.655
        },
        {
          x: 966.634,
          y: 171.409
        },
        {
          x: 967.874,
          y: 170.589
        },
        {
          x: 969.06,
          y: 169.62
        },
        {
          x: 970.729,
          y: 169.997
        },
        {
          x: 971.984,
          y: 169.218
        },
        {
          x: 984.357,
          y: 173.752
        },
        {
          x: 997.336,
          y: 173.228
        },
        {
          x: 1010.538,
          y: 170.844
        },
        {
          x: 1023.426,
          y: 171.079
        }
      ],
      neighborIds: [
        "district:14",
        "district:15",
        "district:37",
        "district:39",
        "district:60",
        "district:61"
      ]
    },
    {
      id: "district:39",
      legacyId: 39,
      rowIndex: 1,
      columnIndex: 15,
      name: "District 39",
      zone: "commercial",
      polygon: [
        {
          x: 1109.562,
          y: 181.17
        },
        {
          x: 1105.902,
          y: 206.921
        },
        {
          x: 1091.255,
          y: 230.227
        },
        {
          x: 1100.348,
          y: 258.815
        },
        {
          x: 1089.408,
          y: 282.946
        },
        {
          x: 1081.406,
          y: 307.731
        },
        {
          x: 1073.144,
          y: 311.631
        },
        {
          x: 1065.174,
          y: 317.575
        },
        {
          x: 1054.855,
          y: 307.077
        },
        {
          x: 1046.721,
          y: 311.869
        },
        {
          x: 1038.193,
          y: 313.905
        },
        {
          x: 1035.123,
          y: 312.757
        },
        {
          x: 1031.975,
          y: 311.852
        },
        {
          x: 1028.503,
          y: 311.96
        },
        {
          x: 1026.168,
          y: 308.515
        },
        {
          x: 1022.601,
          y: 308.919
        },
        {
          x: 1024.266,
          y: 282.411
        },
        {
          x: 1033.468,
          y: 256.647
        },
        {
          x: 1021.067,
          y: 228.748
        },
        {
          x: 1027.661,
          y: 202.726
        },
        {
          x: 1035.652,
          y: 176.843
        },
        {
          x: 1039.879,
          y: 175.464
        },
        {
          x: 1044.942,
          y: 176.893
        },
        {
          x: 1047.482,
          y: 169.841
        },
        {
          x: 1052.153,
          y: 169.953
        },
        {
          x: 1056.956,
          y: 170.507
        },
        {
          x: 1067.012,
          y: 174.93
        },
        {
          x: 1076.491,
          y: 182.207
        },
        {
          x: 1089.907,
          y: 170.056
        },
        {
          x: 1099.431,
          y: 177.108
        }
      ],
      neighborIds: [
        "district:15",
        "district:16",
        "district:38",
        "district:40",
        "district:61",
        "district:62"
      ]
    },
    {
      id: "district:40",
      legacyId: 40,
      rowIndex: 1,
      columnIndex: 16,
      name: "District 40",
      zone: "residential",
      polygon: [
        {
          x: 1081.406,
          y: 307.731
        },
        {
          x: 1089.408,
          y: 282.946
        },
        {
          x: 1100.348,
          y: 258.815
        },
        {
          x: 1091.255,
          y: 230.227
        },
        {
          x: 1105.902,
          y: 206.921
        },
        {
          x: 1109.562,
          y: 181.17
        },
        {
          x: 1110.846,
          y: 180.939
        },
        {
          x: 1112.244,
          y: 181.101
        },
        {
          x: 1113.001,
          y: 179.048
        },
        {
          x: 1114.442,
          y: 179.358
        },
        {
          x: 1115.796,
          y: 179.368
        },
        {
          x: 1122.057,
          y: 178.258
        },
        {
          x: 1127.785,
          y: 180.059
        },
        {
          x: 1133.265,
          y: 183.21
        },
        {
          x: 1138.935,
          y: 185.33
        },
        {
          x: 1145.101,
          y: 184.737
        },
        {
          x: 1149.36,
          y: 211.094
        },
        {
          x: 1159.148,
          y: 235.412
        },
        {
          x: 1171.908,
          y: 258.634
        },
        {
          x: 1183.407,
          y: 282.322
        },
        {
          x: 1190.432,
          y: 307.659
        },
        {
          x: 1189.533,
          y: 308.283
        },
        {
          x: 1188.693,
          y: 308.981
        },
        {
          x: 1188.084,
          y: 309.967
        },
        {
          x: 1186.705,
          y: 309.995
        },
        {
          x: 1186.178,
          y: 311.082
        },
        {
          x: 1174.117,
          y: 317.345
        },
        {
          x: 1162.705,
          y: 326.245
        },
        {
          x: 1146.272,
          y: 314.758
        },
        {
          x: 1134.574,
          y: 322.496
        },
        {
          x: 1122.049,
          y: 326.879
        },
        {
          x: 1111.957,
          y: 327.218
        },
        {
          x: 1105.1,
          y: 320.689
        },
        {
          x: 1098.328,
          y: 313.979
        },
        {
          x: 1091.481,
          y: 307.428
        }
      ],
      neighborIds: [
        "district:16",
        "district:17",
        "district:39",
        "district:41",
        "district:62",
        "district:63",
        "district:64"
      ]
    },
    {
      id: "district:41",
      legacyId: 41,
      rowIndex: 1,
      columnIndex: 17,
      name: "District 41",
      zone: "industrial",
      polygon: [
        {
          x: 1239.909,
          y: 172.667
        },
        {
          x: 1242.666,
          y: 198.328
        },
        {
          x: 1232.56,
          y: 223.988
        },
        {
          x: 1236.497,
          y: 249.649
        },
        {
          x: 1238.21,
          y: 275.309
        },
        {
          x: 1239.909,
          y: 300.97
        },
        {
          x: 1229.83,
          y: 300.947
        },
        {
          x: 1220.295,
          y: 304.95
        },
        {
          x: 1210.873,
          y: 309.793
        },
        {
          x: 1201.023,
          y: 311.461
        },
        {
          x: 1190.432,
          y: 307.659
        },
        {
          x: 1183.407,
          y: 282.322
        },
        {
          x: 1171.908,
          y: 258.634
        },
        {
          x: 1159.148,
          y: 235.412
        },
        {
          x: 1149.36,
          y: 211.094
        },
        {
          x: 1145.101,
          y: 184.737
        },
        {
          x: 1156.105,
          y: 179.117
        },
        {
          x: 1168.685,
          y: 177.671
        },
        {
          x: 1181.563,
          y: 177.017
        },
        {
          x: 1188.996,
          y: 161.937
        },
        {
          x: 1202.542,
          y: 163.052
        },
        {
          x: 1209.969,
          y: 165.156
        },
        {
          x: 1216.166,
          y: 172.041
        },
        {
          x: 1226.25,
          y: 163.818
        },
        {
          x: 1233.161,
          y: 167.927
        }
      ],
      neighborIds: [
        "district:17",
        "district:18",
        "district:40",
        "district:42",
        "district:64"
      ]
    },
    {
      id: "district:42",
      legacyId: 42,
      rowIndex: 1,
      columnIndex: 18,
      name: "District 42",
      zone: "commercial",
      polygon: [
        {
          x: 1330.228,
          y: 192.771
        },
        {
          x: 1323.999,
          y: 215.553
        },
        {
          x: 1313.11,
          y: 236.422
        },
        {
          x: 1300.572,
          y: 256.615
        },
        {
          x: 1290.559,
          y: 277.844
        },
        {
          x: 1285.749,
          y: 301.207
        },
        {
          x: 1279.562,
          y: 304.948
        },
        {
          x: 1272.048,
          y: 298.677
        },
        {
          x: 1265.789,
          y: 301.874
        },
        {
          x: 1259.511,
          y: 304.925
        },
        {
          x: 1252.912,
          y: 305.56
        },
        {
          x: 1249.86,
          y: 305.921
        },
        {
          x: 1247.847,
          y: 303.339
        },
        {
          x: 1245.572,
          y: 301.499
        },
        {
          x: 1242.025,
          y: 303.262
        },
        {
          x: 1239.909,
          y: 300.97
        },
        {
          x: 1238.21,
          y: 275.309
        },
        {
          x: 1236.497,
          y: 249.649
        },
        {
          x: 1232.56,
          y: 223.988
        },
        {
          x: 1242.666,
          y: 198.328
        },
        {
          x: 1239.909,
          y: 172.667
        },
        {
          x: 1245.739,
          y: 169.249
        },
        {
          x: 1253.651,
          y: 173.141
        },
        {
          x: 1259.309,
          y: 169.119
        },
        {
          x: 1265.338,
          y: 166.398
        },
        {
          x: 1271.376,
          y: 163.708
        },
        {
          x: 1278.831,
          y: 163.878
        },
        {
          x: 1284.423,
          y: 172.174
        },
        {
          x: 1292.121,
          y: 171.284
        },
        {
          x: 1299.536,
          y: 171.631
        },
        {
          x: 1306.975,
          y: 171.87
        },
        {
          x: 1311.749,
          y: 175.912
        },
        {
          x: 1317.958,
          y: 178.36
        },
        {
          x: 1324.089,
          y: 180.892
        },
        {
          x: 1324.024,
          y: 190.319
        }
      ],
      neighborIds: [
        "district:18",
        "district:19",
        "district:20",
        "district:41",
        "district:43",
        "district:64",
        "district:65"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:43",
      legacyId: 43,
      rowIndex: 1,
      columnIndex: 19,
      name: "District 43",
      zone: "industrial",
      polygon: [
        {
          x: 1285.749,
          y: 301.207
        },
        {
          x: 1290.559,
          y: 277.844
        },
        {
          x: 1300.572,
          y: 256.615
        },
        {
          x: 1313.11,
          y: 236.422
        },
        {
          x: 1323.999,
          y: 215.553
        },
        {
          x: 1330.228,
          y: 192.771
        },
        {
          x: 1337.288,
          y: 195.801
        },
        {
          x: 1344.004,
          y: 200.781
        },
        {
          x: 1353.139,
          y: 192.084
        },
        {
          x: 1359.434,
          y: 199.439
        },
        {
          x: 1367.058,
          y: 199.287
        },
        {
          x: 1367.9,
          y: 219.786
        },
        {
          x: 1374.259,
          y: 238.75
        },
        {
          x: 1383.408,
          y: 256.937
        },
        {
          x: 1391,
          y: 275.558
        },
        {
          x: 1393.838,
          y: 295.502
        },
        {
          x: 1380.127,
          y: 304.43
        },
        {
          x: 1362.004,
          y: 296.921
        },
        {
          x: 1348,
          y: 304.756
        },
        {
          x: 1333.898,
          y: 312.227
        },
        {
          x: 1318.715,
          y: 315.669
        },
        {
          x: 1313.341,
          y: 309.998
        },
        {
          x: 1307.329,
          y: 305.781
        },
        {
          x: 1299.711,
          y: 305.224
        },
        {
          x: 1291.661,
          y: 305.652
        }
      ],
      neighborIds: [
        "district:20",
        "district:42",
        "district:44",
        "district:65",
        "district:66"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:44",
      legacyId: 44,
      rowIndex: 1,
      columnIndex: 20,
      name: "District 44",
      zone: "residential",
      polygon: [
        {
          x: 1450.346,
          y: 185.679
        },
        {
          x: 1452.617,
          y: 210.12
        },
        {
          x: 1446.81,
          y: 234.561
        },
        {
          x: 1442.873,
          y: 259.003
        },
        {
          x: 1445.318,
          y: 283.444
        },
        {
          x: 1450.346,
          y: 307.885
        },
        {
          x: 1445.458,
          y: 309.725
        },
        {
          x: 1440.69,
          y: 312.821
        },
        {
          x: 1435.027,
          y: 306.486
        },
        {
          x: 1430.216,
          y: 309.14
        },
        {
          x: 1425.261,
          y: 310.265
        },
        {
          x: 1420.47,
          y: 304.133
        },
        {
          x: 1414.933,
          y: 299.59
        },
        {
          x: 1407.602,
          y: 298.864
        },
        {
          x: 1399.677,
          y: 299.403
        },
        {
          x: 1393.838,
          y: 295.502
        },
        {
          x: 1391,
          y: 275.558
        },
        {
          x: 1383.408,
          y: 256.937
        },
        {
          x: 1374.259,
          y: 238.75
        },
        {
          x: 1367.9,
          y: 219.786
        },
        {
          x: 1367.058,
          y: 199.287
        },
        {
          x: 1373.305,
          y: 193.581
        },
        {
          x: 1378.548,
          y: 186.01
        },
        {
          x: 1391.051,
          y: 191.931
        },
        {
          x: 1396.539,
          y: 184.815
        },
        {
          x: 1403.183,
          y: 179.847
        },
        {
          x: 1413.077,
          y: 177.283
        },
        {
          x: 1422.038,
          y: 182.265
        },
        {
          x: 1431.057,
          y: 186.774
        },
        {
          x: 1440.609,
          y: 186.978
        }
      ],
      neighborIds: [
        "district:20",
        "district:21",
        "district:43",
        "district:45",
        "district:66",
        "district:67"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:45",
      legacyId: 45,
      rowIndex: 1,
      columnIndex: 21,
      name: "District 45",
      zone: "park",
      polygon: [
        {
          x: 1511.765,
          y: 186.381
        },
        {
          x: 1512.039,
          y: 208.298
        },
        {
          x: 1520.53,
          y: 229.031
        },
        {
          x: 1527.528,
          y: 249.979
        },
        {
          x: 1520.938,
          y: 272.886
        },
        {
          x: 1527.273,
          y: 293.929
        },
        {
          x: 1526.173,
          y: 294.729
        },
        {
          x: 1525.136,
          y: 295.608
        },
        {
          x: 1524.367,
          y: 296.828
        },
        {
          x: 1522.634,
          y: 296.825
        },
        {
          x: 1521.937,
          y: 298.135
        },
        {
          x: 1509.685,
          y: 299.35
        },
        {
          x: 1499.179,
          y: 308.173
        },
        {
          x: 1488.155,
          y: 314.742
        },
        {
          x: 1473.881,
          y: 307.147
        },
        {
          x: 1462.417,
          y: 311.795
        },
        {
          x: 1459.939,
          y: 311.209
        },
        {
          x: 1457.993,
          y: 308.982
        },
        {
          x: 1454.518,
          y: 311.477
        },
        {
          x: 1452.668,
          y: 308.952
        },
        {
          x: 1450.346,
          y: 307.885
        },
        {
          x: 1445.318,
          y: 283.444
        },
        {
          x: 1442.873,
          y: 259.003
        },
        {
          x: 1446.81,
          y: 234.561
        },
        {
          x: 1452.617,
          y: 210.12
        },
        {
          x: 1450.346,
          y: 185.679
        },
        {
          x: 1453.813,
          y: 185.137
        },
        {
          x: 1457.623,
          y: 185.407
        },
        {
          x: 1458.962,
          y: 179.825
        },
        {
          x: 1463.174,
          y: 181.049
        },
        {
          x: 1466.029,
          y: 179.059
        },
        {
          x: 1475.571,
          y: 178.062
        },
        {
          x: 1484.442,
          y: 181.246
        },
        {
          x: 1493.071,
          y: 185.952
        },
        {
          x: 1502.05,
          y: 188.464
        }
      ],
      neighborIds: [
        "district:21",
        "district:22",
        "district:44",
        "district:46",
        "district:67",
        "district:68",
        "district:69"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:46",
      legacyId: 46,
      rowIndex: 1,
      columnIndex: 22,
      name: "District 46",
      zone: "commercial",
      polygon: [
        {
          x: 1600,
          y: 181.878
        },
        {
          x: 1594.859,
          y: 202.626
        },
        {
          x: 1600,
          y: 223.374
        },
        {
          x: 1600,
          y: 244.121
        },
        {
          x: 1595.268,
          y: 264.869
        },
        {
          x: 1600,
          y: 285.616
        },
        {
          x: 1586.066,
          y: 292.63
        },
        {
          x: 1570.929,
          y: 289.119
        },
        {
          x: 1556.831,
          y: 294.693
        },
        {
          x: 1542.383,
          y: 297.211
        },
        {
          x: 1527.273,
          y: 293.929
        },
        {
          x: 1520.938,
          y: 272.886
        },
        {
          x: 1527.528,
          y: 249.979
        },
        {
          x: 1520.53,
          y: 229.031
        },
        {
          x: 1512.039,
          y: 208.298
        },
        {
          x: 1511.765,
          y: 186.381
        },
        {
          x: 1517.363,
          y: 181.382
        },
        {
          x: 1527.19,
          y: 183.628
        },
        {
          x: 1532.228,
          y: 177.671
        },
        {
          x: 1537.905,
          y: 172.808
        },
        {
          x: 1543.523,
          y: 167.844
        },
        {
          x: 1555.771,
          y: 166.815
        },
        {
          x: 1566.707,
          y: 171.072
        },
        {
          x: 1577.053,
          y: 177.699
        },
        {
          x: 1587.898,
          y: 182.319
        }
      ],
      neighborIds: [
        "district:22",
        "district:23",
        "district:45",
        "district:69"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:47",
      legacyId: 47,
      rowIndex: 2,
      columnIndex: 0,
      name: "District 47",
      zone: "park",
      polygon: [
        {
          x: 79.542,
          y: 294.914
        },
        {
          x: 78.157,
          y: 321.862
        },
        {
          x: 72.421,
          y: 348.402
        },
        {
          x: 65.985,
          y: 374.877
        },
        {
          x: 75.045,
          y: 402.804
        },
        {
          x: 66.96,
          y: 429.124
        },
        {
          x: 62.775,
          y: 429.399
        },
        {
          x: 59.702,
          y: 432.543
        },
        {
          x: 56.483,
          y: 435.312
        },
        {
          x: 51.528,
          y: 433.601
        },
        {
          x: 48.304,
          y: 436.356
        },
        {
          x: 38.945,
          y: 432.919
        },
        {
          x: 28.487,
          y: 436.486
        },
        {
          x: 18.29,
          y: 438.394
        },
        {
          x: 10.018,
          y: 428.019
        },
        {
          x: 0,
          y: 428.783
        },
        {
          x: 2.117,
          y: 404.236
        },
        {
          x: 0,
          y: 379.69
        },
        {
          x: 0,
          y: 355.144
        },
        {
          x: 1.708,
          y: 330.598
        },
        {
          x: 0,
          y: 306.052
        },
        {
          x: 14.691,
          y: 298.911
        },
        {
          x: 30.272,
          y: 297.466
        },
        {
          x: 46.31,
          y: 298.946
        },
        {
          x: 60.919,
          y: 291.276
        },
        {
          x: 77.151,
          y: 294.002
        },
        {
          x: 77.568,
          y: 294.347
        },
        {
          x: 78.201,
          y: 294.121
        },
        {
          x: 78.615,
          y: 294.472
        },
        {
          x: 79.075,
          y: 294.702
        }
      ],
      neighborIds: [
        "district:24",
        "district:25",
        "district:48",
        "district:70",
        "district:71"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:48",
      legacyId: 48,
      rowIndex: 2,
      columnIndex: 1,
      name: "District 48",
      zone: "commercial",
      polygon: [
        {
          x: 152.047,
          y: 306.384
        },
        {
          x: 143.074,
          y: 328.996
        },
        {
          x: 150.999,
          y: 354.299
        },
        {
          x: 143.378,
          y: 377.126
        },
        {
          x: 136.273,
          y: 400.035
        },
        {
          x: 133.376,
          y: 423.615
        },
        {
          x: 129.425,
          y: 424.468
        },
        {
          x: 125.049,
          y: 424.229
        },
        {
          x: 123.29,
          y: 430.727
        },
        {
          x: 118.841,
          y: 430.298
        },
        {
          x: 114.769,
          y: 430.843
        },
        {
          x: 105.073,
          y: 434.242
        },
        {
          x: 95.793,
          y: 426.047
        },
        {
          x: 86.11,
          y: 429.091
        },
        {
          x: 76.525,
          y: 429.375
        },
        {
          x: 66.96,
          y: 429.124
        },
        {
          x: 75.045,
          y: 402.804
        },
        {
          x: 65.985,
          y: 374.877
        },
        {
          x: 72.421,
          y: 348.402
        },
        {
          x: 78.157,
          y: 321.862
        },
        {
          x: 79.542,
          y: 294.914
        },
        {
          x: 87.981,
          y: 297.202
        },
        {
          x: 95.541,
          y: 292.063
        },
        {
          x: 103.934,
          y: 293.963
        },
        {
          x: 112.112,
          y: 294.043
        },
        {
          x: 119.819,
          y: 290.145
        },
        {
          x: 126.063,
          y: 293.792
        },
        {
          x: 133.535,
          y: 295.004
        },
        {
          x: 141.131,
          y: 295.968
        },
        {
          x: 144.097,
          y: 306.121
        }
      ],
      neighborIds: [
        "district:25",
        "district:26",
        "district:47",
        "district:49",
        "district:71",
        "district:72"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:49",
      legacyId: 49,
      rowIndex: 2,
      columnIndex: 2,
      name: "District 49",
      zone: "residential",
      polygon: [
        {
          x: 219.865,
          y: 312.866
        },
        {
          x: 217.923,
          y: 338.356
        },
        {
          x: 220.659,
          y: 363.847
        },
        {
          x: 224.596,
          y: 389.337
        },
        {
          x: 225.222,
          y: 414.827
        },
        {
          x: 219.865,
          y: 440.317
        },
        {
          x: 201.924,
          y: 440.308
        },
        {
          x: 186.468,
          y: 427.431
        },
        {
          x: 168.424,
          y: 427.956
        },
        {
          x: 150.108,
          y: 429.885
        },
        {
          x: 133.376,
          y: 423.615
        },
        {
          x: 136.273,
          y: 400.035
        },
        {
          x: 143.378,
          y: 377.126
        },
        {
          x: 150.999,
          y: 354.299
        },
        {
          x: 143.074,
          y: 328.996
        },
        {
          x: 152.047,
          y: 306.384
        },
        {
          x: 159.8,
          y: 303.854
        },
        {
          x: 167.918,
          y: 304.781
        },
        {
          x: 176.146,
          y: 306.755
        },
        {
          x: 184.146,
          y: 306.556
        },
        {
          x: 191.707,
          y: 302.203
        },
        {
          x: 198.344,
          y: 301.682
        },
        {
          x: 201.701,
          y: 309.82
        },
        {
          x: 208.089,
          y: 309.957
        },
        {
          x: 214.383,
          y: 310.339
        }
      ],
      neighborIds: [
        "district:26",
        "district:27",
        "district:48",
        "district:50",
        "district:72"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:50",
      legacyId: 50,
      rowIndex: 2,
      columnIndex: 3,
      name: "District 50",
      zone: "industrial",
      polygon: [
        {
          x: 304.366,
          y: 308.589
        },
        {
          x: 297.27,
          y: 333.359
        },
        {
          x: 287.242,
          y: 357.59
        },
        {
          x: 297.443,
          y: 385.538
        },
        {
          x: 287.75,
          y: 409.831
        },
        {
          x: 281.194,
          y: 434.7
        },
        {
          x: 274.534,
          y: 434.347
        },
        {
          x: 269.974,
          y: 439.314
        },
        {
          x: 263.543,
          y: 439.542
        },
        {
          x: 257.691,
          y: 441.237
        },
        {
          x: 252.986,
          y: 445.838
        },
        {
          x: 246.314,
          y: 447.051
        },
        {
          x: 240.597,
          y: 441.442
        },
        {
          x: 234.536,
          y: 438.289
        },
        {
          x: 227.148,
          y: 444.606
        },
        {
          x: 221.099,
          y: 441.37
        },
        {
          x: 220.795,
          y: 441.226
        },
        {
          x: 220.588,
          y: 440.969
        },
        {
          x: 220.416,
          y: 440.671
        },
        {
          x: 220.194,
          y: 440.432
        },
        {
          x: 219.865,
          y: 440.317
        },
        {
          x: 225.222,
          y: 414.827
        },
        {
          x: 224.596,
          y: 389.337
        },
        {
          x: 220.659,
          y: 363.847
        },
        {
          x: 217.923,
          y: 338.356
        },
        {
          x: 219.865,
          y: 312.866
        },
        {
          x: 230.075,
          y: 308.538
        },
        {
          x: 241.382,
          y: 308.618
        },
        {
          x: 252.947,
          y: 309.739
        },
        {
          x: 261.863,
          y: 300.211
        },
        {
          x: 273.008,
          y: 299.641
        },
        {
          x: 279.778,
          y: 299.684
        },
        {
          x: 285.196,
          y: 304.465
        },
        {
          x: 290.833,
          y: 308.477
        },
        {
          x: 298.658,
          y: 304.822
        }
      ],
      neighborIds: [
        "district:27",
        "district:28",
        "district:49",
        "district:51",
        "district:72",
        "district:73",
        "district:74"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:51",
      legacyId: 51,
      rowIndex: 2,
      columnIndex: 4,
      name: "District 51",
      zone: "commercial",
      polygon: [
        {
          x: 328.312,
          y: 304.529
        },
        {
          x: 341.029,
          y: 329.402
        },
        {
          x: 356.454,
          y: 353.205
        },
        {
          x: 352.649,
          y: 384.61
        },
        {
          x: 367.554,
          y: 408.618
        },
        {
          x: 379.428,
          y: 433.824
        },
        {
          x: 372.718,
          y: 433.096
        },
        {
          x: 368.212,
          y: 438.867
        },
        {
          x: 363.112,
          y: 442.886
        },
        {
          x: 355.256,
          y: 438.781
        },
        {
          x: 350.447,
          y: 443.655
        },
        {
          x: 337.235,
          y: 436.927
        },
        {
          x: 322.264,
          y: 443.797
        },
        {
          x: 308.918,
          y: 438.102
        },
        {
          x: 295.631,
          y: 431.96
        },
        {
          x: 281.194,
          y: 434.7
        },
        {
          x: 287.75,
          y: 409.831
        },
        {
          x: 297.443,
          y: 385.538
        },
        {
          x: 287.242,
          y: 357.59
        },
        {
          x: 297.27,
          y: 333.359
        },
        {
          x: 304.366,
          y: 308.589
        },
        {
          x: 309.135,
          y: 307.655
        },
        {
          x: 313.623,
          y: 305.071
        },
        {
          x: 318.125,
          y: 302.563
        },
        {
          x: 323.828,
          y: 307.141
        }
      ],
      neighborIds: [
        "district:28",
        "district:50",
        "district:52",
        "district:74",
        "district:75"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:52",
      legacyId: 52,
      rowIndex: 2,
      columnIndex: 5,
      name: "District 52",
      zone: "park",
      polygon: [
        {
          x: 421.064,
          y: 311.938
        },
        {
          x: 421.228,
          y: 336.338
        },
        {
          x: 414.118,
          y: 360.738
        },
        {
          x: 429.203,
          y: 385.138
        },
        {
          x: 421.637,
          y: 409.538
        },
        {
          x: 421.064,
          y: 433.938
        },
        {
          x: 419.289,
          y: 434.844
        },
        {
          x: 417.23,
          y: 435.025
        },
        {
          x: 415.127,
          y: 435.092
        },
        {
          x: 414.037,
          y: 437.75
        },
        {
          x: 411.829,
          y: 437.547
        },
        {
          x: 405.167,
          y: 438.384
        },
        {
          x: 399.277,
          y: 432.501
        },
        {
          x: 391.786,
          y: 440.554
        },
        {
          x: 385.699,
          y: 436.389
        },
        {
          x: 379.428,
          y: 433.824
        },
        {
          x: 367.554,
          y: 408.618
        },
        {
          x: 352.649,
          y: 384.61
        },
        {
          x: 356.454,
          y: 353.205
        },
        {
          x: 341.029,
          y: 329.402
        },
        {
          x: 328.312,
          y: 304.529
        },
        {
          x: 328.451,
          y: 304.477
        },
        {
          x: 328.497,
          y: 304.286
        },
        {
          x: 328.645,
          y: 304.248
        },
        {
          x: 328.807,
          y: 304.229
        },
        {
          x: 328.91,
          y: 304.123
        },
        {
          x: 341.761,
          y: 307.987
        },
        {
          x: 352.522,
          y: 294.83
        },
        {
          x: 365.195,
          y: 297.24
        },
        {
          x: 377.797,
          y: 299.071
        },
        {
          x: 389.875,
          y: 296.636
        },
        {
          x: 395.649,
          y: 300.64
        },
        {
          x: 404.854,
          y: 297.653
        },
        {
          x: 410.008,
          y: 302.924
        },
        {
          x: 415.591,
          y: 307.319
        }
      ],
      neighborIds: [
        "district:29",
        "district:30",
        "district:51",
        "district:53",
        "district:75",
        "district:76"
      ]
    },
    {
      id: "district:53",
      legacyId: 53,
      rowIndex: 2,
      columnIndex: 6,
      name: "District 53",
      zone: "commercial",
      polygon: [
        {
          x: 503.398,
          y: 319.311
        },
        {
          x: 495.244,
          y: 339.726
        },
        {
          x: 484.199,
          y: 359.347
        },
        {
          x: 492.959,
          y: 384.408
        },
        {
          x: 482.185,
          y: 404.103
        },
        {
          x: 474.47,
          y: 424.639
        },
        {
          x: 468.385,
          y: 426.04
        },
        {
          x: 463.227,
          y: 429.803
        },
        {
          x: 458.277,
          y: 434.095
        },
        {
          x: 452.618,
          y: 436.58
        },
        {
          x: 445.722,
          y: 435.911
        },
        {
          x: 440.665,
          y: 437.092
        },
        {
          x: 435.631,
          y: 437.965
        },
        {
          x: 431.236,
          y: 430.875
        },
        {
          x: 426.028,
          y: 433.93
        },
        {
          x: 421.064,
          y: 433.938
        },
        {
          x: 421.637,
          y: 409.538
        },
        {
          x: 429.203,
          y: 385.138
        },
        {
          x: 414.118,
          y: 360.738
        },
        {
          x: 421.228,
          y: 336.338
        },
        {
          x: 421.064,
          y: 311.938
        },
        {
          x: 431.544,
          y: 312.308
        },
        {
          x: 439.531,
          y: 301.156
        },
        {
          x: 450.227,
          y: 302.528
        },
        {
          x: 461.269,
          y: 305.496
        },
        {
          x: 470.738,
          y: 301.195
        },
        {
          x: 475.502,
          y: 308.005
        },
        {
          x: 484.793,
          y: 306.654
        },
        {
          x: 490.041,
          y: 312.592
        },
        {
          x: 495.232,
          y: 318.633
        }
      ],
      neighborIds: [
        "district:30",
        "district:31",
        "district:52",
        "district:54",
        "district:76",
        "district:77"
      ]
    },
    {
      id: "district:54",
      legacyId: 54,
      rowIndex: 2,
      columnIndex: 7,
      name: "District 54",
      zone: "residential",
      polygon: [
        {
          x: 474.47,
          y: 424.639
        },
        {
          x: 482.185,
          y: 404.103
        },
        {
          x: 492.959,
          y: 384.408
        },
        {
          x: 484.199,
          y: 359.347
        },
        {
          x: 495.244,
          y: 339.726
        },
        {
          x: 503.398,
          y: 319.311
        },
        {
          x: 513.585,
          y: 322.669
        },
        {
          x: 522.709,
          y: 313.982
        },
        {
          x: 532.83,
          y: 316.594
        },
        {
          x: 542.68,
          y: 316.136
        },
        {
          x: 552.469,
          y: 314.984
        },
        {
          x: 556.746,
          y: 338.266
        },
        {
          x: 556.232,
          y: 361.957
        },
        {
          x: 554.313,
          y: 385.768
        },
        {
          x: 555.484,
          y: 409.316
        },
        {
          x: 562.486,
          y: 432.365
        },
        {
          x: 561.238,
          y: 433.397
        },
        {
          x: 559.667,
          y: 433.827
        },
        {
          x: 558.003,
          y: 434.086
        },
        {
          x: 556.552,
          y: 434.741
        },
        {
          x: 555.501,
          y: 436.135
        },
        {
          x: 539.933,
          y: 429.34
        },
        {
          x: 523.568,
          y: 428.16
        },
        {
          x: 506.808,
          y: 429.758
        },
        {
          x: 490.289,
          y: 429.669
        }
      ],
      neighborIds: [
        "district:31",
        "district:53",
        "district:55",
        "district:77",
        "district:78"
      ]
    },
    {
      id: "district:55",
      legacyId: 55,
      rowIndex: 2,
      columnIndex: 8,
      name: "District 55",
      zone: "commercial",
      polygon: [
        {
          x: 615.89,
          y: 297.99
        },
        {
          x: 619.658,
          y: 322.098
        },
        {
          x: 631.113,
          y: 344.423
        },
        {
          x: 640.45,
          y: 367.238
        },
        {
          x: 635.767,
          y: 393.308
        },
        {
          x: 643.403,
          y: 416.519
        },
        {
          x: 637.106,
          y: 420.336
        },
        {
          x: 629.499,
          y: 421.755
        },
        {
          x: 621.794,
          y: 422.995
        },
        {
          x: 619.156,
          y: 433.508
        },
        {
          x: 611.128,
          y: 434.157
        },
        {
          x: 601.327,
          y: 435.769
        },
        {
          x: 591.681,
          y: 433.181
        },
        {
          x: 582.079,
          y: 429.376
        },
        {
          x: 572.377,
          y: 428.303
        },
        {
          x: 562.486,
          y: 432.365
        },
        {
          x: 555.484,
          y: 409.316
        },
        {
          x: 554.313,
          y: 385.768
        },
        {
          x: 556.232,
          y: 361.957
        },
        {
          x: 556.746,
          y: 338.266
        },
        {
          x: 552.469,
          y: 314.984
        },
        {
          x: 556.179,
          y: 311.154
        },
        {
          x: 563.369,
          y: 312.133
        },
        {
          x: 566.532,
          y: 307.548
        },
        {
          x: 569.054,
          y: 302.076
        },
        {
          x: 573.739,
          y: 299.593
        },
        {
          x: 581.944,
          y: 302.35
        },
        {
          x: 589.363,
          y: 293.005
        },
        {
          x: 597.54,
          y: 295.317
        },
        {
          x: 605.902,
          y: 300.498
        },
        {
          x: 613.701,
          y: 296.997
        },
        {
          x: 614.064,
          y: 297.362
        },
        {
          x: 614.584,
          y: 297.379
        },
        {
          x: 615.092,
          y: 297.422
        },
        {
          x: 615.507,
          y: 297.67
        }
      ],
      neighborIds: [
        "district:31",
        "district:32",
        "district:33",
        "district:54",
        "district:56",
        "district:78",
        "district:79"
      ]
    },
    {
      id: "district:56",
      legacyId: 56,
      rowIndex: 2,
      columnIndex: 9,
      name: "District 56",
      zone: "park",
      polygon: [
        {
          x: 722.687,
          y: 307.435
        },
        {
          x: 709.79,
          y: 328.372
        },
        {
          x: 709.899,
          y: 353.9
        },
        {
          x: 698.186,
          y: 375.254
        },
        {
          x: 686.173,
          y: 396.503
        },
        {
          x: 682.683,
          y: 420.76
        },
        {
          x: 675.272,
          y: 415.785
        },
        {
          x: 666.891,
          y: 419.801
        },
        {
          x: 658.735,
          y: 421.736
        },
        {
          x: 650.839,
          y: 421.263
        },
        {
          x: 643.403,
          y: 416.519
        },
        {
          x: 635.767,
          y: 393.308
        },
        {
          x: 640.45,
          y: 367.238
        },
        {
          x: 631.113,
          y: 344.423
        },
        {
          x: 619.658,
          y: 322.098
        },
        {
          x: 615.89,
          y: 297.99
        },
        {
          x: 629.097,
          y: 302.247
        },
        {
          x: 640.646,
          y: 292.582
        },
        {
          x: 653.634,
          y: 295
        },
        {
          x: 666.138,
          y: 293.35
        },
        {
          x: 678.503,
          y: 290.537
        },
        {
          x: 686.455,
          y: 296.231
        },
        {
          x: 695.942,
          y: 297.911
        },
        {
          x: 705.976,
          y: 298.16
        },
        {
          x: 712.84,
          y: 306.696
        }
      ],
      neighborIds: [
        "district:33",
        "district:34",
        "district:55",
        "district:79",
        "district:104"
      ]
    },
    {
      id: "district:57",
      legacyId: 57,
      rowIndex: 4,
      columnIndex: 11,
      name: "District 57",
      zone: "commercial",
      polygon: [
        {
          x: 837.087,
          y: 570.212
        },
        {
          x: 844.867,
          y: 594.876
        },
        {
          x: 838.755,
          y: 620.76
        },
        {
          x: 844.887,
          y: 645.569
        },
        {
          x: 847.06,
          y: 670.726
        },
        {
          x: 848.141,
          y: 695.979
        },
        {
          x: 834.865,
          y: 696.299
        },
        {
          x: 821.74,
          y: 695.276
        },
        {
          x: 809.109,
          y: 689.889
        },
        {
          x: 796.463,
          y: 684.621
        },
        {
          x: 782.774,
          y: 688.602
        },
        {
          x: 781.323,
          y: 663.694
        },
        {
          x: 769.057,
          y: 639.851
        },
        {
          x: 781.625,
          y: 613.562
        },
        {
          x: 774.397,
          y: 589.223
        },
        {
          x: 770.552,
          y: 564.551
        },
        {
          x: 771.509,
          y: 563.829
        },
        {
          x: 772.722,
          y: 563.394
        },
        {
          x: 773.895,
          y: 562.913
        },
        {
          x: 774.15,
          y: 561.407
        },
        {
          x: 775.003,
          y: 560.569
        },
        {
          x: 780.71,
          y: 559.501
        },
        {
          x: 786.775,
          y: 560.486
        },
        {
          x: 792.848,
          y: 561.515
        },
        {
          x: 797.467,
          y: 554.214
        },
        {
          x: 803.599,
          y: 555.58
        },
        {
          x: 811.712,
          y: 555.266
        },
        {
          x: 818.248,
          y: 558.563
        },
        {
          x: 823.909,
          y: 563.863
        },
        {
          x: 831.913,
          y: 563.799
        }
      ],
      neighborIds: [
        "district:58",
        "district:59",
        "district:80",
        "district:81",
        "district:82",
        "district:127"
      ]
    },
    {
      id: "district:58",
      legacyId: 58,
      rowIndex: 4,
      columnIndex: 10,
      name: "District 58",
      zone: "park",
      polygon: [
        {
          x: 770.552,
          y: 564.551
        },
        {
          x: 774.397,
          y: 589.223
        },
        {
          x: 781.625,
          y: 613.562
        },
        {
          x: 769.057,
          y: 639.851
        },
        {
          x: 781.323,
          y: 663.694
        },
        {
          x: 782.774,
          y: 688.602
        },
        {
          x: 770.909,
          y: 691.012
        },
        {
          x: 763.32,
          y: 703.926
        },
        {
          x: 746.613,
          y: 694.439
        },
        {
          x: 737.695,
          y: 704.088
        },
        {
          x: 727.674,
          y: 711.027
        },
        {
          x: 727.049,
          y: 711.204
        },
        {
          x: 726.451,
          y: 711.238
        },
        {
          x: 725.917,
          y: 710.928
        },
        {
          x: 725.405,
          y: 710.506
        },
        {
          x: 724.817,
          y: 710.489
        },
        {
          x: 718.405,
          y: 686.201
        },
        {
          x: 712.852,
          y: 661.708
        },
        {
          x: 710.829,
          y: 636.368
        },
        {
          x: 696.517,
          y: 613.973
        },
        {
          x: 695.56,
          y: 588.379
        },
        {
          x: 710.534,
          y: 583.536
        },
        {
          x: 723.333,
          y: 571.85
        },
        {
          x: 742.899,
          y: 581.46
        },
        {
          x: 755.653,
          y: 569.629
        }
      ],
      neighborIds: [
        "district:57",
        "district:80",
        "district:83",
        "district:126",
        "district:127"
      ]
    },
    {
      id: "district:59",
      legacyId: 59,
      rowIndex: 4,
      columnIndex: 12,
      name: "District 59",
      zone: "industrial",
      polygon: [
        {
          x: 916.212,
          y: 559.513
        },
        {
          x: 921.163,
          y: 587.367
        },
        {
          x: 920.286,
          y: 615.22
        },
        {
          x: 916.35,
          y: 643.074
        },
        {
          x: 913.864,
          y: 670.928
        },
        {
          x: 916.212,
          y: 698.782
        },
        {
          x: 913.661,
          y: 698.68
        },
        {
          x: 911.854,
          y: 700.632
        },
        {
          x: 909.346,
          y: 700.649
        },
        {
          x: 907.023,
          y: 701.175
        },
        {
          x: 905.099,
          y: 702.804
        },
        {
          x: 894.762,
          y: 697.866
        },
        {
          x: 884.241,
          y: 695.104
        },
        {
          x: 873.24,
          y: 697.98
        },
        {
          x: 862.129,
          y: 702.158
        },
        {
          x: 851.704,
          y: 698.265
        },
        {
          x: 850.977,
          y: 697.83
        },
        {
          x: 850.093,
          y: 697.639
        },
        {
          x: 849.219,
          y: 697.435
        },
        {
          x: 849.022,
          y: 696.173
        },
        {
          x: 848.141,
          y: 695.979
        },
        {
          x: 847.06,
          y: 670.726
        },
        {
          x: 844.887,
          y: 645.569
        },
        {
          x: 838.755,
          y: 620.76
        },
        {
          x: 844.867,
          y: 594.876
        },
        {
          x: 837.087,
          y: 570.212
        },
        {
          x: 852.613,
          y: 565.858
        },
        {
          x: 867.725,
          y: 558.449
        },
        {
          x: 885.571,
          y: 571.258
        },
        {
          x: 900.685,
          y: 563.855
        }
      ],
      neighborIds: [
        "district:57",
        "district:82",
        "district:106",
        "district:127",
        "district:128",
        "district:129"
      ]
    },
    {
      id: "district:60",
      legacyId: 60,
      rowIndex: 2,
      columnIndex: 13,
      name: "District 60",
      zone: "residential",
      polygon: [
        {
          x: 977.665,
          y: 312.354
        },
        {
          x: 983.187,
          y: 337.184
        },
        {
          x: 980.487,
          y: 362.917
        },
        {
          x: 979.335,
          y: 388.48
        },
        {
          x: 984.216,
          y: 413.38
        },
        {
          x: 991.473,
          y: 438.019
        },
        {
          x: 988.369,
          y: 441.624
        },
        {
          x: 982.728,
          y: 439.149
        },
        {
          x: 979.383,
          y: 442.177
        },
        {
          x: 975.937,
          y: 444.962
        },
        {
          x: 971.847,
          y: 446.206
        },
        {
          x: 958.945,
          y: 442.665
        },
        {
          x: 948.853,
          y: 430.76
        },
        {
          x: 934.937,
          y: 430.237
        },
        {
          x: 921.088,
          y: 429.514
        },
        {
          x: 908.535,
          y: 424.934
        },
        {
          x: 915.647,
          y: 403.479
        },
        {
          x: 910.389,
          y: 379.261
        },
        {
          x: 919.133,
          y: 358.17
        },
        {
          x: 926.002,
          y: 336.661
        },
        {
          x: 933.041,
          y: 315.189
        },
        {
          x: 938.959,
          y: 311.339
        },
        {
          x: 946.813,
          y: 317.198
        },
        {
          x: 952.788,
          y: 313.637
        },
        {
          x: 958.294,
          y: 307.728
        },
        {
          x: 965.188,
          y: 308.775
        },
        {
          x: 967.548,
          y: 309.964
        },
        {
          x: 970.213,
          y: 310.087
        },
        {
          x: 972.963,
          y: 309.919
        },
        {
          x: 975.008,
          y: 312.203
        }
      ],
      neighborIds: [
        "district:37",
        "district:38",
        "district:61",
        "district:84",
        "district:102",
        "district:105"
      ]
    },
    {
      id: "district:61",
      legacyId: 61,
      rowIndex: 2,
      columnIndex: 14,
      name: "District 61",
      zone: "park",
      polygon: [
        {
          x: 1038.193,
          y: 313.905
        },
        {
          x: 1042.33,
          y: 338.947
        },
        {
          x: 1049.709,
          y: 363.684
        },
        {
          x: 1037.056,
          y: 390.301
        },
        {
          x: 1049.018,
          y: 414.609
        },
        {
          x: 1050.02,
          y: 439.945
        },
        {
          x: 1048.972,
          y: 440.825
        },
        {
          x: 1047.414,
          y: 440.247
        },
        {
          x: 1046.356,
          y: 441.099
        },
        {
          x: 1045.335,
          y: 442.052
        },
        {
          x: 1043.983,
          y: 442.064
        },
        {
          x: 1033.592,
          y: 439.809
        },
        {
          x: 1022.634,
          y: 444.923
        },
        {
          x: 1011.845,
          y: 447.834
        },
        {
          x: 1002.116,
          y: 436.995
        },
        {
          x: 991.473,
          y: 438.019
        },
        {
          x: 984.216,
          y: 413.38
        },
        {
          x: 979.335,
          y: 388.48
        },
        {
          x: 980.487,
          y: 362.917
        },
        {
          x: 983.187,
          y: 337.184
        },
        {
          x: 977.665,
          y: 312.354
        },
        {
          x: 986.541,
          y: 310.213
        },
        {
          x: 995.906,
          y: 314.459
        },
        {
          x: 1005.136,
          y: 316.956
        },
        {
          x: 1013.478,
          y: 307.821
        },
        {
          x: 1022.601,
          y: 308.919
        },
        {
          x: 1026.168,
          y: 308.515
        },
        {
          x: 1028.503,
          y: 311.96
        },
        {
          x: 1031.975,
          y: 311.852
        },
        {
          x: 1035.123,
          y: 312.757
        }
      ],
      neighborIds: [
        "district:38",
        "district:39",
        "district:60",
        "district:62",
        "district:84",
        "district:85"
      ]
    },
    {
      id: "district:62",
      legacyId: 62,
      rowIndex: 2,
      columnIndex: 15,
      name: "District 62",
      zone: "commercial",
      polygon: [
        {
          x: 1122.049,
          y: 326.879
        },
        {
          x: 1115.522,
          y: 347.539
        },
        {
          x: 1114.854,
          y: 368.608
        },
        {
          x: 1117.311,
          y: 389.896
        },
        {
          x: 1118.393,
          y: 411.088
        },
        {
          x: 1114.699,
          y: 431.946
        },
        {
          x: 1108.733,
          y: 433.476
        },
        {
          x: 1105.835,
          y: 441.18
        },
        {
          x: 1099.491,
          y: 441.95
        },
        {
          x: 1092.649,
          y: 441.718
        },
        {
          x: 1087.727,
          y: 445.351
        },
        {
          x: 1080.083,
          y: 444.989
        },
        {
          x: 1071.776,
          y: 449.247
        },
        {
          x: 1065.702,
          y: 437.927
        },
        {
          x: 1057.498,
          y: 441.467
        },
        {
          x: 1050.02,
          y: 439.945
        },
        {
          x: 1049.018,
          y: 414.609
        },
        {
          x: 1037.056,
          y: 390.301
        },
        {
          x: 1049.709,
          y: 363.684
        },
        {
          x: 1042.33,
          y: 338.947
        },
        {
          x: 1038.193,
          y: 313.905
        },
        {
          x: 1046.721,
          y: 311.869
        },
        {
          x: 1054.855,
          y: 307.077
        },
        {
          x: 1065.174,
          y: 317.575
        },
        {
          x: 1073.144,
          y: 311.631
        },
        {
          x: 1081.406,
          y: 307.731
        },
        {
          x: 1091.481,
          y: 307.428
        },
        {
          x: 1098.328,
          y: 313.979
        },
        {
          x: 1105.1,
          y: 320.689
        },
        {
          x: 1111.957,
          y: 327.218
        }
      ],
      neighborIds: [
        "district:39",
        "district:40",
        "district:61",
        "district:63",
        "district:85",
        "district:86"
      ]
    },
    {
      id: "district:63",
      legacyId: 63,
      rowIndex: 2,
      columnIndex: 16,
      name: "District 63",
      zone: "park",
      polygon: [
        {
          x: 1186.178,
          y: 311.082
        },
        {
          x: 1190.505,
          y: 336.645
        },
        {
          x: 1186.92,
          y: 362.949
        },
        {
          x: 1185.41,
          y: 389.058
        },
        {
          x: 1198.141,
          y: 413.835
        },
        {
          x: 1198.224,
          y: 439.795
        },
        {
          x: 1194.012,
          y: 439.893
        },
        {
          x: 1190.756,
          y: 442.921
        },
        {
          x: 1187.365,
          y: 445.533
        },
        {
          x: 1182.459,
          y: 443.511
        },
        {
          x: 1179.047,
          y: 446.06
        },
        {
          x: 1165.246,
          y: 447.483
        },
        {
          x: 1152.645,
          y: 443.439
        },
        {
          x: 1140.619,
          y: 436.771
        },
        {
          x: 1128.201,
          y: 431.885
        },
        {
          x: 1114.699,
          y: 431.946
        },
        {
          x: 1118.393,
          y: 411.088
        },
        {
          x: 1117.311,
          y: 389.896
        },
        {
          x: 1114.854,
          y: 368.608
        },
        {
          x: 1115.522,
          y: 347.539
        },
        {
          x: 1122.049,
          y: 326.879
        },
        {
          x: 1134.574,
          y: 322.496
        },
        {
          x: 1146.272,
          y: 314.758
        },
        {
          x: 1162.705,
          y: 326.245
        },
        {
          x: 1174.117,
          y: 317.345
        }
      ],
      neighborIds: [
        "district:40",
        "district:62",
        "district:64",
        "district:86",
        "district:87"
      ]
    },
    {
      id: "district:64",
      legacyId: 64,
      rowIndex: 2,
      columnIndex: 17,
      name: "District 64",
      zone: "industrial",
      polygon: [
        {
          x: 1252.912,
          y: 305.56
        },
        {
          x: 1255.276,
          y: 332.056
        },
        {
          x: 1264.794,
          y: 357.935
        },
        {
          x: 1252.048,
          y: 385.733
        },
        {
          x: 1257.684,
          y: 411.947
        },
        {
          x: 1264.325,
          y: 438.074
        },
        {
          x: 1259.477,
          y: 438.199
        },
        {
          x: 1256.171,
          y: 441.607
        },
        {
          x: 1252.82,
          y: 444.919
        },
        {
          x: 1247.348,
          y: 443.715
        },
        {
          x: 1244.225,
          y: 447.514
        },
        {
          x: 1235.379,
          y: 443.861
        },
        {
          x: 1224.941,
          y: 449.696
        },
        {
          x: 1217.836,
          y: 435.662
        },
        {
          x: 1207.835,
          y: 438.891
        },
        {
          x: 1198.224,
          y: 439.795
        },
        {
          x: 1198.141,
          y: 413.835
        },
        {
          x: 1185.41,
          y: 389.058
        },
        {
          x: 1186.92,
          y: 362.949
        },
        {
          x: 1190.505,
          y: 336.645
        },
        {
          x: 1186.178,
          y: 311.082
        },
        {
          x: 1186.705,
          y: 309.995
        },
        {
          x: 1188.084,
          y: 309.967
        },
        {
          x: 1188.693,
          y: 308.981
        },
        {
          x: 1189.533,
          y: 308.283
        },
        {
          x: 1190.432,
          y: 307.659
        },
        {
          x: 1201.023,
          y: 311.461
        },
        {
          x: 1210.873,
          y: 309.793
        },
        {
          x: 1220.295,
          y: 304.95
        },
        {
          x: 1229.83,
          y: 300.947
        },
        {
          x: 1239.909,
          y: 300.97
        },
        {
          x: 1242.025,
          y: 303.262
        },
        {
          x: 1245.572,
          y: 301.499
        },
        {
          x: 1247.847,
          y: 303.339
        },
        {
          x: 1249.86,
          y: 305.921
        }
      ],
      neighborIds: [
        "district:40",
        "district:41",
        "district:42",
        "district:63",
        "district:65",
        "district:87",
        "district:88"
      ]
    },
    {
      id: "district:65",
      legacyId: 65,
      rowIndex: 2,
      columnIndex: 18,
      name: "District 65",
      zone: "residential",
      polygon: [
        {
          x: 1318.715,
          y: 315.669
        },
        {
          x: 1324.994,
          y: 336.177
        },
        {
          x: 1334.633,
          y: 355.867
        },
        {
          x: 1325.036,
          y: 380.236
        },
        {
          x: 1335.844,
          y: 399.641
        },
        {
          x: 1344.016,
          y: 419.689
        },
        {
          x: 1332.186,
          y: 418.828
        },
        {
          x: 1325.326,
          y: 430.32
        },
        {
          x: 1314.034,
          y: 430.795
        },
        {
          x: 1302.682,
          y: 431.123
        },
        {
          x: 1294.599,
          y: 439.574
        },
        {
          x: 1288.393,
          y: 442.333
        },
        {
          x: 1282.527,
          y: 438.21
        },
        {
          x: 1276.579,
          y: 435.765
        },
        {
          x: 1270.535,
          y: 435.25
        },
        {
          x: 1264.325,
          y: 438.074
        },
        {
          x: 1257.684,
          y: 411.947
        },
        {
          x: 1252.048,
          y: 385.733
        },
        {
          x: 1264.794,
          y: 357.935
        },
        {
          x: 1255.276,
          y: 332.056
        },
        {
          x: 1252.912,
          y: 305.56
        },
        {
          x: 1259.511,
          y: 304.925
        },
        {
          x: 1265.789,
          y: 301.874
        },
        {
          x: 1272.048,
          y: 298.677
        },
        {
          x: 1279.562,
          y: 304.948
        },
        {
          x: 1285.749,
          y: 301.207
        },
        {
          x: 1291.661,
          y: 305.652
        },
        {
          x: 1299.711,
          y: 305.224
        },
        {
          x: 1307.329,
          y: 305.781
        },
        {
          x: 1313.341,
          y: 309.998
        }
      ],
      neighborIds: [
        "district:42",
        "district:43",
        "district:64",
        "district:66",
        "district:88",
        "district:89"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:66",
      legacyId: 66,
      rowIndex: 2,
      columnIndex: 19,
      name: "District 66",
      zone: "park",
      polygon: [
        {
          x: 1425.261,
          y: 310.265
        },
        {
          x: 1413.14,
          y: 332.372
        },
        {
          x: 1412.591,
          y: 359.575
        },
        {
          x: 1398.865,
          y: 380.975
        },
        {
          x: 1383.145,
          y: 401.496
        },
        {
          x: 1374.643,
          y: 425.197
        },
        {
          x: 1368.329,
          y: 425.144
        },
        {
          x: 1362.802,
          y: 420.715
        },
        {
          x: 1357.067,
          y: 417.443
        },
        {
          x: 1349.912,
          y: 422.065
        },
        {
          x: 1344.016,
          y: 419.689
        },
        {
          x: 1335.844,
          y: 399.641
        },
        {
          x: 1325.036,
          y: 380.236
        },
        {
          x: 1334.633,
          y: 355.867
        },
        {
          x: 1324.994,
          y: 336.177
        },
        {
          x: 1318.715,
          y: 315.669
        },
        {
          x: 1333.898,
          y: 312.227
        },
        {
          x: 1348,
          y: 304.756
        },
        {
          x: 1362.004,
          y: 296.921
        },
        {
          x: 1380.127,
          y: 304.43
        },
        {
          x: 1393.838,
          y: 295.502
        },
        {
          x: 1399.677,
          y: 299.403
        },
        {
          x: 1407.602,
          y: 298.864
        },
        {
          x: 1414.933,
          y: 299.59
        },
        {
          x: 1420.47,
          y: 304.133
        }
      ],
      neighborIds: [
        "district:43",
        "district:44",
        "district:65",
        "district:67",
        "district:89"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:67",
      legacyId: 67,
      rowIndex: 2,
      columnIndex: 20,
      name: "District 67",
      zone: "commercial",
      polygon: [
        {
          x: 1374.643,
          y: 425.197
        },
        {
          x: 1383.145,
          y: 401.496
        },
        {
          x: 1398.865,
          y: 380.975
        },
        {
          x: 1412.591,
          y: 359.575
        },
        {
          x: 1413.14,
          y: 332.372
        },
        {
          x: 1425.261,
          y: 310.265
        },
        {
          x: 1430.216,
          y: 309.14
        },
        {
          x: 1435.027,
          y: 306.486
        },
        {
          x: 1440.69,
          y: 312.821
        },
        {
          x: 1445.458,
          y: 309.725
        },
        {
          x: 1450.346,
          y: 307.885
        },
        {
          x: 1452.668,
          y: 308.952
        },
        {
          x: 1454.518,
          y: 311.477
        },
        {
          x: 1457.993,
          y: 308.982
        },
        {
          x: 1459.939,
          y: 311.209
        },
        {
          x: 1462.417,
          y: 311.795
        },
        {
          x: 1464.069,
          y: 335.74
        },
        {
          x: 1473.609,
          y: 358.468
        },
        {
          x: 1481.146,
          y: 381.505
        },
        {
          x: 1482.22,
          y: 405.539
        },
        {
          x: 1480.645,
          y: 429.982
        },
        {
          x: 1476.489,
          y: 432.5
        },
        {
          x: 1470.907,
          y: 432.013
        },
        {
          x: 1465.805,
          y: 432.537
        },
        {
          x: 1463.461,
          y: 438.877
        },
        {
          x: 1458.805,
          y: 440.341
        },
        {
          x: 1443.006,
          y: 440.097
        },
        {
          x: 1428.358,
          y: 430.727
        },
        {
          x: 1412.283,
          y: 432.667
        },
        {
          x: 1396.311,
          y: 433.796
        },
        {
          x: 1380.895,
          y: 430.517
        },
        {
          x: 1379.384,
          y: 429.758
        },
        {
          x: 1378.037,
          y: 428.809
        },
        {
          x: 1377.163,
          y: 427.302
        },
        {
          x: 1376.332,
          y: 425.745
        }
      ],
      neighborIds: [
        "district:44",
        "district:45",
        "district:66",
        "district:68",
        "district:89",
        "district:90",
        "district:91"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:68",
      legacyId: 68,
      rowIndex: 2,
      columnIndex: 21,
      name: "District 68",
      zone: "industrial",
      polygon: [
        {
          x: 1521.937,
          y: 298.135
        },
        {
          x: 1529.439,
          y: 321.971
        },
        {
          x: 1529.888,
          y: 347.906
        },
        {
          x: 1551.475,
          y: 367.548
        },
        {
          x: 1555.101,
          y: 392.538
        },
        {
          x: 1557.587,
          y: 417.867
        },
        {
          x: 1547.901,
          y: 419.686
        },
        {
          x: 1542.284,
          y: 431.729
        },
        {
          x: 1532.03,
          y: 432.122
        },
        {
          x: 1521.073,
          y: 430.748
        },
        {
          x: 1512.654,
          y: 435.751
        },
        {
          x: 1506.634,
          y: 432.48
        },
        {
          x: 1499.719,
          y: 434.172
        },
        {
          x: 1492.909,
          y: 435.286
        },
        {
          x: 1487.471,
          y: 428.783
        },
        {
          x: 1480.645,
          y: 429.982
        },
        {
          x: 1482.22,
          y: 405.539
        },
        {
          x: 1481.146,
          y: 381.505
        },
        {
          x: 1473.609,
          y: 358.468
        },
        {
          x: 1464.069,
          y: 335.74
        },
        {
          x: 1462.417,
          y: 311.795
        },
        {
          x: 1473.881,
          y: 307.147
        },
        {
          x: 1488.155,
          y: 314.742
        },
        {
          x: 1499.179,
          y: 308.173
        },
        {
          x: 1509.685,
          y: 299.35
        }
      ],
      neighborIds: [
        "district:45",
        "district:67",
        "district:69",
        "district:91",
        "district:92"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:69",
      legacyId: 69,
      rowIndex: 2,
      columnIndex: 22,
      name: "District 69",
      zone: "residential",
      polygon: [
        {
          x: 1600,
          y: 285.616
        },
        {
          x: 1596.726,
          y: 312.986
        },
        {
          x: 1590.766,
          y: 340.356
        },
        {
          x: 1600,
          y: 367.725
        },
        {
          x: 1600,
          y: 395.095
        },
        {
          x: 1600,
          y: 422.464
        },
        {
          x: 1591.055,
          y: 425.81
        },
        {
          x: 1582.993,
          y: 421.01
        },
        {
          x: 1574.185,
          y: 423.096
        },
        {
          x: 1565.641,
          y: 422.739
        },
        {
          x: 1557.587,
          y: 417.867
        },
        {
          x: 1555.101,
          y: 392.538
        },
        {
          x: 1551.475,
          y: 367.548
        },
        {
          x: 1529.888,
          y: 347.906
        },
        {
          x: 1529.439,
          y: 321.971
        },
        {
          x: 1521.937,
          y: 298.135
        },
        {
          x: 1522.634,
          y: 296.825
        },
        {
          x: 1524.367,
          y: 296.828
        },
        {
          x: 1525.136,
          y: 295.608
        },
        {
          x: 1526.173,
          y: 294.729
        },
        {
          x: 1527.273,
          y: 293.929
        },
        {
          x: 1542.383,
          y: 297.211
        },
        {
          x: 1556.831,
          y: 294.693
        },
        {
          x: 1570.929,
          y: 289.119
        },
        {
          x: 1586.066,
          y: 292.63
        }
      ],
      neighborIds: [
        "district:45",
        "district:46",
        "district:68",
        "district:92"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:70",
      legacyId: 70,
      rowIndex: 3,
      columnIndex: 0,
      name: "District 70",
      zone: "industrial",
      polygon: [
        {
          x: 0,
          y: 591.643
        },
        {
          x: 0,
          y: 559.071
        },
        {
          x: 1.774,
          y: 526.499
        },
        {
          x: 0,
          y: 493.927
        },
        {
          x: 0,
          y: 461.355
        },
        {
          x: 0,
          y: 428.783
        },
        {
          x: 10.018,
          y: 428.019
        },
        {
          x: 18.29,
          y: 438.394
        },
        {
          x: 28.487,
          y: 436.486
        },
        {
          x: 38.945,
          y: 432.919
        },
        {
          x: 48.304,
          y: 436.356
        },
        {
          x: 49.2,
          y: 464.688
        },
        {
          x: 58.413,
          y: 491.833
        },
        {
          x: 66.29,
          y: 519.169
        },
        {
          x: 60.735,
          y: 548.421
        },
        {
          x: 68.203,
          y: 575.815
        },
        {
          x: 55.21,
          y: 581.77
        },
        {
          x: 39.3,
          y: 575.156
        },
        {
          x: 26.549,
          y: 582.156
        },
        {
          x: 14.195,
          y: 590.868
        }
      ],
      neighborIds: [
        "district:47",
        "district:71",
        "district:93"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:71",
      legacyId: 71,
      rowIndex: 3,
      columnIndex: 1,
      name: "District 71",
      zone: "residential",
      polygon: [
        {
          x: 114.769,
          y: 430.843
        },
        {
          x: 114.985,
          y: 459.372
        },
        {
          x: 121.173,
          y: 486.641
        },
        {
          x: 130.795,
          y: 513.186
        },
        {
          x: 143.396,
          y: 539.102
        },
        {
          x: 143.619,
          y: 567.629
        },
        {
          x: 141.738,
          y: 570.258
        },
        {
          x: 138.592,
          y: 570.834
        },
        {
          x: 135.5,
          y: 571.499
        },
        {
          x: 134.185,
          y: 575.045
        },
        {
          x: 130.934,
          y: 575.451
        },
        {
          x: 121.909,
          y: 579.92
        },
        {
          x: 112.331,
          y: 579.775
        },
        {
          x: 102.505,
          y: 577.566
        },
        {
          x: 92.891,
          y: 577.121
        },
        {
          x: 83.808,
          y: 581.104
        },
        {
          x: 80.865,
          y: 579.52
        },
        {
          x: 77.792,
          y: 578.323
        },
        {
          x: 74.296,
          y: 578.371
        },
        {
          x: 70.808,
          y: 578.397
        },
        {
          x: 68.203,
          y: 575.815
        },
        {
          x: 60.735,
          y: 548.421
        },
        {
          x: 66.29,
          y: 519.169
        },
        {
          x: 58.413,
          y: 491.833
        },
        {
          x: 49.2,
          y: 464.688
        },
        {
          x: 48.304,
          y: 436.356
        },
        {
          x: 51.528,
          y: 433.601
        },
        {
          x: 56.483,
          y: 435.312
        },
        {
          x: 59.702,
          y: 432.543
        },
        {
          x: 62.775,
          y: 429.399
        },
        {
          x: 66.96,
          y: 429.124
        },
        {
          x: 76.525,
          y: 429.375
        },
        {
          x: 86.11,
          y: 429.091
        },
        {
          x: 95.793,
          y: 426.047
        },
        {
          x: 105.073,
          y: 434.242
        }
      ],
      neighborIds: [
        "district:47",
        "district:48",
        "district:70",
        "district:72",
        "district:93",
        "district:94",
        "district:95"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:72",
      legacyId: 72,
      rowIndex: 3,
      columnIndex: 2,
      name: "District 72",
      zone: "park",
      polygon: [
        {
          x: 221.099,
          y: 441.37
        },
        {
          x: 212.639,
          y: 465.553
        },
        {
          x: 204.681,
          y: 489.919
        },
        {
          x: 199.603,
          y: 515.336
        },
        {
          x: 182.124,
          y: 536.23
        },
        {
          x: 177.22,
          y: 561.71
        },
        {
          x: 170.346,
          y: 562.025
        },
        {
          x: 164.649,
          y: 569.013
        },
        {
          x: 156.322,
          y: 561.074
        },
        {
          x: 150.143,
          y: 565.329
        },
        {
          x: 143.619,
          y: 567.629
        },
        {
          x: 143.396,
          y: 539.102
        },
        {
          x: 130.795,
          y: 513.186
        },
        {
          x: 121.173,
          y: 486.641
        },
        {
          x: 114.985,
          y: 459.372
        },
        {
          x: 114.769,
          y: 430.843
        },
        {
          x: 118.841,
          y: 430.298
        },
        {
          x: 123.29,
          y: 430.727
        },
        {
          x: 125.049,
          y: 424.229
        },
        {
          x: 129.425,
          y: 424.468
        },
        {
          x: 133.376,
          y: 423.615
        },
        {
          x: 150.108,
          y: 429.885
        },
        {
          x: 168.424,
          y: 427.956
        },
        {
          x: 186.468,
          y: 427.431
        },
        {
          x: 201.924,
          y: 440.308
        },
        {
          x: 219.865,
          y: 440.317
        },
        {
          x: 220.194,
          y: 440.432
        },
        {
          x: 220.416,
          y: 440.671
        },
        {
          x: 220.588,
          y: 440.969
        },
        {
          x: 220.795,
          y: 441.226
        }
      ],
      neighborIds: [
        "district:48",
        "district:49",
        "district:50",
        "district:71",
        "district:73",
        "district:95"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:73",
      legacyId: 73,
      rowIndex: 3,
      columnIndex: 3,
      name: "District 73",
      zone: "industrial",
      polygon: [
        {
          x: 252.986,
          y: 445.838
        },
        {
          x: 261.365,
          y: 472.201
        },
        {
          x: 273.644,
          y: 497.252
        },
        {
          x: 286.194,
          y: 522.212
        },
        {
          x: 287.435,
          y: 550.977
        },
        {
          x: 297.081,
          y: 576.914
        },
        {
          x: 295.805,
          y: 577.187
        },
        {
          x: 294.664,
          y: 577.67
        },
        {
          x: 293.87,
          y: 578.694
        },
        {
          x: 293.157,
          y: 579.843
        },
        {
          x: 291.944,
          y: 580.215
        },
        {
          x: 281.081,
          y: 586.723
        },
        {
          x: 268.813,
          y: 584.321
        },
        {
          x: 256.599,
          y: 582.262
        },
        {
          x: 246.343,
          y: 592.617
        },
        {
          x: 233.94,
          y: 589.366
        },
        {
          x: 225.121,
          y: 578.655
        },
        {
          x: 212.178,
          y: 576.405
        },
        {
          x: 199.108,
          y: 574.412
        },
        {
          x: 186.116,
          y: 572.26
        },
        {
          x: 177.22,
          y: 561.71
        },
        {
          x: 182.124,
          y: 536.23
        },
        {
          x: 199.603,
          y: 515.336
        },
        {
          x: 204.681,
          y: 489.919
        },
        {
          x: 212.639,
          y: 465.553
        },
        {
          x: 221.099,
          y: 441.37
        },
        {
          x: 227.148,
          y: 444.606
        },
        {
          x: 234.536,
          y: 438.289
        },
        {
          x: 240.597,
          y: 441.442
        },
        {
          x: 246.314,
          y: 447.051
        }
      ],
      neighborIds: [
        "district:50",
        "district:72",
        "district:74",
        "district:95",
        "district:96",
        "district:97"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:74",
      legacyId: 74,
      rowIndex: 3,
      columnIndex: 4,
      name: "District 74",
      zone: "residential",
      polygon: [
        {
          x: 350.447,
          y: 443.655
        },
        {
          x: 350.316,
          y: 470.904
        },
        {
          x: 348.817,
          y: 497.869
        },
        {
          x: 328.634,
          y: 520.97
        },
        {
          x: 329.719,
          y: 548.47
        },
        {
          x: 323.393,
          y: 574.437
        },
        {
          x: 318.147,
          y: 575.111
        },
        {
          x: 313.217,
          y: 579.132
        },
        {
          x: 307.282,
          y: 572.483
        },
        {
          x: 302.342,
          y: 576.403
        },
        {
          x: 297.081,
          y: 576.914
        },
        {
          x: 287.435,
          y: 550.977
        },
        {
          x: 286.194,
          y: 522.212
        },
        {
          x: 273.644,
          y: 497.252
        },
        {
          x: 261.365,
          y: 472.201
        },
        {
          x: 252.986,
          y: 445.838
        },
        {
          x: 257.691,
          y: 441.237
        },
        {
          x: 263.543,
          y: 439.542
        },
        {
          x: 269.974,
          y: 439.314
        },
        {
          x: 274.534,
          y: 434.347
        },
        {
          x: 281.194,
          y: 434.7
        },
        {
          x: 295.631,
          y: 431.96
        },
        {
          x: 308.918,
          y: 438.102
        },
        {
          x: 322.264,
          y: 443.797
        },
        {
          x: 337.235,
          y: 436.927
        }
      ],
      neighborIds: [
        "district:50",
        "district:51",
        "district:73",
        "district:75",
        "district:97"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:75",
      legacyId: 75,
      rowIndex: 3,
      columnIndex: 5,
      name: "District 75",
      zone: "industrial",
      polygon: [
        {
          x: 411.829,
          y: 437.547
        },
        {
          x: 413.723,
          y: 464.096
        },
        {
          x: 403.674,
          y: 489.734
        },
        {
          x: 397.748,
          y: 515.687
        },
        {
          x: 408.129,
          y: 542.882
        },
        {
          x: 401.826,
          y: 568.806
        },
        {
          x: 387.305,
          y: 565.879
        },
        {
          x: 373.971,
          y: 573.17
        },
        {
          x: 359.525,
          y: 570.885
        },
        {
          x: 345.376,
          y: 571.164
        },
        {
          x: 331.866,
          y: 576.937
        },
        {
          x: 330.396,
          y: 575.675
        },
        {
          x: 328.87,
          y: 574.604
        },
        {
          x: 326.496,
          y: 576.404
        },
        {
          x: 325.111,
          y: 574.855
        },
        {
          x: 323.393,
          y: 574.437
        },
        {
          x: 329.719,
          y: 548.47
        },
        {
          x: 328.634,
          y: 520.97
        },
        {
          x: 348.817,
          y: 497.869
        },
        {
          x: 350.316,
          y: 470.904
        },
        {
          x: 350.447,
          y: 443.655
        },
        {
          x: 355.256,
          y: 438.781
        },
        {
          x: 363.112,
          y: 442.886
        },
        {
          x: 368.212,
          y: 438.867
        },
        {
          x: 372.718,
          y: 433.096
        },
        {
          x: 379.428,
          y: 433.824
        },
        {
          x: 385.699,
          y: 436.389
        },
        {
          x: 391.786,
          y: 440.554
        },
        {
          x: 399.277,
          y: 432.501
        },
        {
          x: 405.167,
          y: 438.384
        }
      ],
      neighborIds: [
        "district:51",
        "district:52",
        "district:74",
        "district:76",
        "district:97",
        "district:98"
      ]
    },
    {
      id: "district:76",
      legacyId: 76,
      rowIndex: 3,
      columnIndex: 6,
      name: "District 76",
      zone: "park",
      polygon: [
        {
          x: 445.722,
          y: 435.911
        },
        {
          x: 454.807,
          y: 461.249
        },
        {
          x: 461.306,
          y: 487.831
        },
        {
          x: 486.503,
          y: 505.42
        },
        {
          x: 493.632,
          y: 531.698
        },
        {
          x: 503.737,
          y: 556.546
        },
        {
          x: 498.554,
          y: 557.522
        },
        {
          x: 496.152,
          y: 562.066
        },
        {
          x: 491.433,
          y: 563.637
        },
        {
          x: 487.566,
          y: 566.301
        },
        {
          x: 485.246,
          y: 570.952
        },
        {
          x: 472.329,
          y: 571.854
        },
        {
          x: 459.926,
          y: 576.924
        },
        {
          x: 447.576,
          y: 582.418
        },
        {
          x: 433.283,
          y: 572.191
        },
        {
          x: 421.081,
          y: 578.885
        },
        {
          x: 416.554,
          y: 578.161
        },
        {
          x: 415.022,
          y: 571.715
        },
        {
          x: 410.457,
          y: 571.063
        },
        {
          x: 405.81,
          y: 570.568
        },
        {
          x: 401.826,
          y: 568.806
        },
        {
          x: 408.129,
          y: 542.882
        },
        {
          x: 397.748,
          y: 515.687
        },
        {
          x: 403.674,
          y: 489.734
        },
        {
          x: 413.723,
          y: 464.096
        },
        {
          x: 411.829,
          y: 437.547
        },
        {
          x: 414.037,
          y: 437.75
        },
        {
          x: 415.127,
          y: 435.092
        },
        {
          x: 417.23,
          y: 435.025
        },
        {
          x: 419.289,
          y: 434.844
        },
        {
          x: 421.064,
          y: 433.938
        },
        {
          x: 426.028,
          y: 433.93
        },
        {
          x: 431.236,
          y: 430.875
        },
        {
          x: 435.631,
          y: 437.965
        },
        {
          x: 440.665,
          y: 437.092
        }
      ],
      neighborIds: [
        "district:52",
        "district:53",
        "district:75",
        "district:77",
        "district:98",
        "district:99",
        "district:100"
      ]
    },
    {
      id: "district:77",
      legacyId: 77,
      rowIndex: 3,
      columnIndex: 7,
      name: "District 77",
      zone: "industrial",
      polygon: [
        {
          x: 555.501,
          y: 436.135
        },
        {
          x: 551.346,
          y: 458.952
        },
        {
          x: 546.822,
          y: 481.714
        },
        {
          x: 539.525,
          y: 504.065
        },
        {
          x: 545.544,
          y: 528.392
        },
        {
          x: 538.484,
          y: 550.778
        },
        {
          x: 531.556,
          y: 552.058
        },
        {
          x: 523.733,
          y: 547.951
        },
        {
          x: 517.192,
          y: 551.567
        },
        {
          x: 510.665,
          y: 555.263
        },
        {
          x: 503.737,
          y: 556.546
        },
        {
          x: 493.632,
          y: 531.698
        },
        {
          x: 486.503,
          y: 505.42
        },
        {
          x: 461.306,
          y: 487.831
        },
        {
          x: 454.807,
          y: 461.249
        },
        {
          x: 445.722,
          y: 435.911
        },
        {
          x: 452.618,
          y: 436.58
        },
        {
          x: 458.277,
          y: 434.095
        },
        {
          x: 463.227,
          y: 429.803
        },
        {
          x: 468.385,
          y: 426.04
        },
        {
          x: 474.47,
          y: 424.639
        },
        {
          x: 490.289,
          y: 429.669
        },
        {
          x: 506.808,
          y: 429.758
        },
        {
          x: 523.568,
          y: 428.16
        },
        {
          x: 539.933,
          y: 429.34
        }
      ],
      neighborIds: [
        "district:53",
        "district:54",
        "district:76",
        "district:78",
        "district:100"
      ]
    },
    {
      id: "district:78",
      legacyId: 78,
      rowIndex: 3,
      columnIndex: 8,
      name: "District 78",
      zone: "commercial",
      polygon: [
        {
          x: 611.128,
          y: 434.157
        },
        {
          x: 616.945,
          y: 460.608
        },
        {
          x: 626.224,
          y: 486.444
        },
        {
          x: 616.104,
          y: 515.726
        },
        {
          x: 626.752,
          y: 541.319
        },
        {
          x: 634.787,
          y: 567.376
        },
        {
          x: 624.898,
          y: 564.088
        },
        {
          x: 615.149,
          y: 561.938
        },
        {
          x: 607.368,
          y: 575.771
        },
        {
          x: 597.332,
          y: 571.285
        },
        {
          x: 588.074,
          y: 573.126
        },
        {
          x: 577.434,
          y: 570.258
        },
        {
          x: 565.486,
          y: 570.293
        },
        {
          x: 561.636,
          y: 552.359
        },
        {
          x: 549.473,
          y: 552.871
        },
        {
          x: 538.484,
          y: 550.778
        },
        {
          x: 545.544,
          y: 528.392
        },
        {
          x: 539.525,
          y: 504.065
        },
        {
          x: 546.822,
          y: 481.714
        },
        {
          x: 551.346,
          y: 458.952
        },
        {
          x: 555.501,
          y: 436.135
        },
        {
          x: 556.552,
          y: 434.741
        },
        {
          x: 558.003,
          y: 434.086
        },
        {
          x: 559.667,
          y: 433.827
        },
        {
          x: 561.238,
          y: 433.397
        },
        {
          x: 562.486,
          y: 432.365
        },
        {
          x: 572.377,
          y: 428.303
        },
        {
          x: 582.079,
          y: 429.376
        },
        {
          x: 591.681,
          y: 433.181
        },
        {
          x: 601.327,
          y: 435.769
        }
      ],
      neighborIds: [
        "district:54",
        "district:55",
        "district:77",
        "district:79",
        "district:100",
        "district:101"
      ]
    },
    {
      id: "district:79",
      legacyId: 79,
      rowIndex: 3,
      columnIndex: 9,
      name: "District 79",
      zone: "downtown",
      polygon: [
        {
          x: 717.988,
          y: 447.324
        },
        {
          x: 706.735,
          y: 474.48
        },
        {
          x: 694.347,
          y: 500.902
        },
        {
          x: 665.99,
          y: 517.016
        },
        {
          x: 655.94,
          y: 544.948
        },
        {
          x: 639.569,
          y: 568.8
        },
        {
          x: 638.558,
          y: 568.7
        },
        {
          x: 637.584,
          y: 568.472
        },
        {
          x: 636.729,
          y: 567.849
        },
        {
          x: 635.875,
          y: 567.217
        },
        {
          x: 634.787,
          y: 567.376
        },
        {
          x: 626.752,
          y: 541.319
        },
        {
          x: 616.104,
          y: 515.726
        },
        {
          x: 626.224,
          y: 486.444
        },
        {
          x: 616.945,
          y: 460.608
        },
        {
          x: 611.128,
          y: 434.157
        },
        {
          x: 619.156,
          y: 433.508
        },
        {
          x: 621.794,
          y: 422.995
        },
        {
          x: 629.499,
          y: 421.755
        },
        {
          x: 637.106,
          y: 420.336
        },
        {
          x: 643.403,
          y: 416.519
        },
        {
          x: 650.839,
          y: 421.263
        },
        {
          x: 658.735,
          y: 421.736
        },
        {
          x: 666.891,
          y: 419.801
        },
        {
          x: 675.272,
          y: 415.785
        },
        {
          x: 682.683,
          y: 420.76
        },
        {
          x: 689.883,
          y: 425.887
        },
        {
          x: 698.912,
          y: 428.584
        },
        {
          x: 707.856,
          y: 431.395
        },
        {
          x: 710.87,
          y: 442.086
        }
      ],
      neighborIds: [
        "district:55",
        "district:56",
        "district:78",
        "district:80",
        "district:101",
        "district:104"
      ],
      isDowntown: true
    },
    {
      id: "district:80",
      legacyId: 80,
      rowIndex: 3,
      columnIndex: 10,
      name: "District 80",
      zone: "downtown",
      polygon: [
        {
          x: 639.569,
          y: 568.8
        },
        {
          x: 655.94,
          y: 544.948
        },
        {
          x: 665.99,
          y: 517.016
        },
        {
          x: 694.347,
          y: 500.902
        },
        {
          x: 706.735,
          y: 474.48
        },
        {
          x: 717.988,
          y: 447.324
        },
        {
          x: 718.213,
          y: 447.445
        },
        {
          x: 718.489,
          y: 447.282
        },
        {
          x: 718.713,
          y: 447.41
        },
        {
          x: 718.947,
          y: 447.479
        },
        {
          x: 719.183,
          y: 447.541
        },
        {
          x: 727.687,
          y: 471.46
        },
        {
          x: 740.736,
          y: 493.134
        },
        {
          x: 755.43,
          y: 513.997
        },
        {
          x: 760.812,
          y: 539.458
        },
        {
          x: 775.003,
          y: 560.569
        },
        {
          x: 774.15,
          y: 561.407
        },
        {
          x: 773.895,
          y: 562.913
        },
        {
          x: 772.722,
          y: 563.394
        },
        {
          x: 771.509,
          y: 563.829
        },
        {
          x: 770.552,
          y: 564.551
        },
        {
          x: 755.653,
          y: 569.629
        },
        {
          x: 742.899,
          y: 581.46
        },
        {
          x: 723.333,
          y: 571.85
        },
        {
          x: 710.534,
          y: 583.536
        },
        {
          x: 695.56,
          y: 588.379
        },
        {
          x: 686.335,
          y: 583.016
        },
        {
          x: 674.959,
          y: 585.05
        },
        {
          x: 663.991,
          y: 585.682
        },
        {
          x: 656.611,
          y: 573.975
        },
        {
          x: 645.842,
          y: 573.922
        },
        {
          x: 644.762,
          y: 572.683
        },
        {
          x: 642.951,
          y: 572.341
        },
        {
          x: 641.334,
          y: 571.761
        },
        {
          x: 641.036,
          y: 569.564
        }
      ],
      neighborIds: [
        "district:57",
        "district:58",
        "district:79",
        "district:81",
        "district:83",
        "district:101",
        "district:104"
      ],
      isDowntown: true
    },
    {
      id: "district:81",
      legacyId: 81,
      rowIndex: 3,
      columnIndex: 11,
      name: "District 81",
      zone: "downtown",
      polygon: [
        {
          x: 836.843,
          y: 446.527
        },
        {
          x: 831.892,
          y: 468.855
        },
        {
          x: 826.927,
          y: 491.179
        },
        {
          x: 824.043,
          y: 514.137
        },
        {
          x: 807.683,
          y: 532.988
        },
        {
          x: 803.599,
          y: 555.58
        },
        {
          x: 797.467,
          y: 554.214
        },
        {
          x: 792.848,
          y: 561.515
        },
        {
          x: 786.775,
          y: 560.486
        },
        {
          x: 780.71,
          y: 559.501
        },
        {
          x: 775.003,
          y: 560.569
        },
        {
          x: 760.812,
          y: 539.458
        },
        {
          x: 755.43,
          y: 513.997
        },
        {
          x: 740.736,
          y: 493.134
        },
        {
          x: 727.687,
          y: 471.46
        },
        {
          x: 719.183,
          y: 447.541
        },
        {
          x: 727.391,
          y: 442.582
        },
        {
          x: 737.121,
          y: 441.188
        },
        {
          x: 747.176,
          y: 440.555
        },
        {
          x: 753.455,
          y: 431.077
        },
        {
          x: 762.851,
          y: 428.901
        },
        {
          x: 776.624,
          y: 436.731
        },
        {
          x: 791.701,
          y: 439.087
        },
        {
          x: 807.412,
          y: 438.783
        },
        {
          x: 822.711,
          y: 440.206
        }
      ],
      neighborIds: [
        "district:57",
        "district:80",
        "district:82",
        "district:103",
        "district:104"
      ],
      isDowntown: true
    },
    {
      id: "district:82",
      legacyId: 82,
      rowIndex: 3,
      columnIndex: 12,
      name: "District 82",
      zone: "downtown",
      polygon: [
        {
          x: 872.806,
          y: 439.731
        },
        {
          x: 885.148,
          y: 462.341
        },
        {
          x: 885.006,
          y: 489.496
        },
        {
          x: 897.415,
          y: 512.081
        },
        {
          x: 910.895,
          y: 534.277
        },
        {
          x: 916.358,
          y: 559.391
        },
        {
          x: 916.328,
          y: 559.414
        },
        {
          x: 916.306,
          y: 559.448
        },
        {
          x: 916.286,
          y: 559.483
        },
        {
          x: 916.23,
          y: 559.475
        },
        {
          x: 916.212,
          y: 559.513
        },
        {
          x: 900.685,
          y: 563.855
        },
        {
          x: 885.571,
          y: 571.258
        },
        {
          x: 867.725,
          y: 558.449
        },
        {
          x: 852.613,
          y: 565.858
        },
        {
          x: 837.087,
          y: 570.212
        },
        {
          x: 831.913,
          y: 563.799
        },
        {
          x: 823.909,
          y: 563.863
        },
        {
          x: 818.248,
          y: 558.563
        },
        {
          x: 811.712,
          y: 555.266
        },
        {
          x: 803.599,
          y: 555.58
        },
        {
          x: 807.683,
          y: 532.988
        },
        {
          x: 824.043,
          y: 514.137
        },
        {
          x: 826.927,
          y: 491.179
        },
        {
          x: 831.892,
          y: 468.855
        },
        {
          x: 836.843,
          y: 446.527
        },
        {
          x: 841.299,
          y: 445.939
        },
        {
          x: 846.179,
          y: 446.274
        },
        {
          x: 847.651,
          y: 439.183
        },
        {
          x: 852.293,
          y: 438.999
        },
        {
          x: 856.363,
          y: 437.57
        },
        {
          x: 859.582,
          y: 438.536
        },
        {
          x: 863.107,
          y: 437.164
        },
        {
          x: 866.549,
          y: 436.431
        },
        {
          x: 869.431,
          y: 439.954
        }
      ],
      neighborIds: [
        "district:57",
        "district:59",
        "district:81",
        "district:102",
        "district:103",
        "district:105"
      ],
      isDowntown: true
    },
    {
      id: "district:83",
      legacyId: 83,
      rowIndex: 4,
      columnIndex: 9,
      name: "District 83",
      zone: "commercial",
      polygon: [
        {
          x: 633.038,
          y: 712.555
        },
        {
          x: 632.695,
          y: 684.56
        },
        {
          x: 629.541,
          y: 656.306
        },
        {
          x: 647.122,
          y: 629.967
        },
        {
          x: 644.815,
          y: 601.791
        },
        {
          x: 645.842,
          y: 573.922
        },
        {
          x: 656.611,
          y: 573.975
        },
        {
          x: 663.991,
          y: 585.682
        },
        {
          x: 674.959,
          y: 585.05
        },
        {
          x: 686.335,
          y: 583.016
        },
        {
          x: 695.56,
          y: 588.379
        },
        {
          x: 696.517,
          y: 613.973
        },
        {
          x: 710.829,
          y: 636.368
        },
        {
          x: 712.852,
          y: 661.708
        },
        {
          x: 718.405,
          y: 686.201
        },
        {
          x: 724.817,
          y: 710.489
        },
        {
          x: 717.775,
          y: 715.702
        },
        {
          x: 706.695,
          y: 709.244
        },
        {
          x: 699.764,
          y: 714.776
        },
        {
          x: 692.981,
          y: 720.735
        },
        {
          x: 685.32,
          y: 724.158
        },
        {
          x: 674.294,
          y: 724.404
        },
        {
          x: 664.991,
          y: 716.884
        },
        {
          x: 655.357,
          y: 710.859
        },
        {
          x: 642.839,
          y: 717.828
        }
      ],
      neighborIds: [
        "district:58",
        "district:80",
        "district:101",
        "district:125",
        "district:126"
      ]
    },
    {
      id: "district:84",
      legacyId: 84,
      rowIndex: 3,
      columnIndex: 14,
      name: "District 84",
      zone: "industrial",
      polygon: [
        {
          x: 1043.983,
          y: 442.064
        },
        {
          x: 1033.636,
          y: 463.728
        },
        {
          x: 1036.808,
          y: 488.425
        },
        {
          x: 1027.843,
          y: 510.399
        },
        {
          x: 1018.665,
          y: 532.326
        },
        {
          x: 1018.365,
          y: 556.244
        },
        {
          x: 1011.336,
          y: 555.563
        },
        {
          x: 1004.81,
          y: 557.951
        },
        {
          x: 998.465,
          y: 561.441
        },
        {
          x: 991.086,
          y: 558.625
        },
        {
          x: 984.683,
          y: 561.761
        },
        {
          x: 978.76,
          y: 559.965
        },
        {
          x: 973.661,
          y: 555.976
        },
        {
          x: 968.649,
          y: 551.756
        },
        {
          x: 960.545,
          y: 555.767
        },
        {
          x: 955.776,
          y: 550.901
        },
        {
          x: 957.077,
          y: 529.668
        },
        {
          x: 955.219,
          y: 507.95
        },
        {
          x: 973.343,
          y: 489.3
        },
        {
          x: 971.126,
          y: 467.527
        },
        {
          x: 971.847,
          y: 446.206
        },
        {
          x: 975.937,
          y: 444.962
        },
        {
          x: 979.383,
          y: 442.177
        },
        {
          x: 982.728,
          y: 439.149
        },
        {
          x: 988.369,
          y: 441.624
        },
        {
          x: 991.473,
          y: 438.019
        },
        {
          x: 1002.116,
          y: 436.995
        },
        {
          x: 1011.845,
          y: 447.834
        },
        {
          x: 1022.634,
          y: 444.923
        },
        {
          x: 1033.592,
          y: 439.809
        }
      ],
      neighborIds: [
        "district:60",
        "district:61",
        "district:85",
        "district:102",
        "district:106",
        "district:107"
      ]
    },
    {
      id: "district:85",
      legacyId: 85,
      rowIndex: 3,
      columnIndex: 15,
      name: "District 85",
      zone: "residential",
      polygon: [
        {
          x: 1018.365,
          y: 556.244
        },
        {
          x: 1018.665,
          y: 532.326
        },
        {
          x: 1027.843,
          y: 510.399
        },
        {
          x: 1036.808,
          y: 488.425
        },
        {
          x: 1033.636,
          y: 463.728
        },
        {
          x: 1043.983,
          y: 442.064
        },
        {
          x: 1045.335,
          y: 442.052
        },
        {
          x: 1046.356,
          y: 441.099
        },
        {
          x: 1047.414,
          y: 440.247
        },
        {
          x: 1048.972,
          y: 440.825
        },
        {
          x: 1050.02,
          y: 439.945
        },
        {
          x: 1057.498,
          y: 441.467
        },
        {
          x: 1065.702,
          y: 437.927
        },
        {
          x: 1071.776,
          y: 449.247
        },
        {
          x: 1080.083,
          y: 444.989
        },
        {
          x: 1087.727,
          y: 445.351
        },
        {
          x: 1095.386,
          y: 466.351
        },
        {
          x: 1086.458,
          y: 489.863
        },
        {
          x: 1093.63,
          y: 510.937
        },
        {
          x: 1104.82,
          y: 531.403
        },
        {
          x: 1104.124,
          y: 553.668
        },
        {
          x: 1094.543,
          y: 556.071
        },
        {
          x: 1086.034,
          y: 561.997
        },
        {
          x: 1077.612,
          y: 568.211
        },
        {
          x: 1065.076,
          y: 560.896
        },
        {
          x: 1056.93,
          y: 568.02
        },
        {
          x: 1048.323,
          y: 568.595
        },
        {
          x: 1041.585,
          y: 563.045
        },
        {
          x: 1034.707,
          y: 557.957
        },
        {
          x: 1025.097,
          y: 561.814
        }
      ],
      neighborIds: [
        "district:61",
        "district:62",
        "district:84",
        "district:86",
        "district:107",
        "district:108"
      ]
    },
    {
      id: "district:86",
      legacyId: 86,
      rowIndex: 3,
      columnIndex: 16,
      name: "District 86",
      zone: "park",
      polygon: [
        {
          x: 1179.047,
          y: 446.06
        },
        {
          x: 1177.01,
          y: 471.959
        },
        {
          x: 1166.906,
          y: 496.408
        },
        {
          x: 1158.46,
          y: 521.155
        },
        {
          x: 1163.697,
          y: 548.361
        },
        {
          x: 1156.188,
          y: 573.277
        },
        {
          x: 1146.732,
          y: 566.814
        },
        {
          x: 1133.903,
          y: 569.31
        },
        {
          x: 1124.877,
          y: 561.704
        },
        {
          x: 1115.35,
          y: 555.432
        },
        {
          x: 1104.124,
          y: 553.668
        },
        {
          x: 1104.82,
          y: 531.403
        },
        {
          x: 1093.63,
          y: 510.937
        },
        {
          x: 1086.458,
          y: 489.863
        },
        {
          x: 1095.386,
          y: 466.351
        },
        {
          x: 1087.727,
          y: 445.351
        },
        {
          x: 1092.649,
          y: 441.718
        },
        {
          x: 1099.491,
          y: 441.95
        },
        {
          x: 1105.835,
          y: 441.18
        },
        {
          x: 1108.733,
          y: 433.476
        },
        {
          x: 1114.699,
          y: 431.946
        },
        {
          x: 1128.201,
          y: 431.885
        },
        {
          x: 1140.619,
          y: 436.771
        },
        {
          x: 1152.645,
          y: 443.439
        },
        {
          x: 1165.246,
          y: 447.483
        }
      ],
      neighborIds: [
        "district:62",
        "district:63",
        "district:85",
        "district:87",
        "district:108"
      ]
    },
    {
      id: "district:87",
      legacyId: 87,
      rowIndex: 3,
      columnIndex: 17,
      name: "District 87",
      zone: "commercial",
      polygon: [
        {
          x: 1156.188,
          y: 573.277
        },
        {
          x: 1163.697,
          y: 548.361
        },
        {
          x: 1158.46,
          y: 521.155
        },
        {
          x: 1166.906,
          y: 496.408
        },
        {
          x: 1177.01,
          y: 471.959
        },
        {
          x: 1179.047,
          y: 446.06
        },
        {
          x: 1182.459,
          y: 443.511
        },
        {
          x: 1187.365,
          y: 445.533
        },
        {
          x: 1190.756,
          y: 442.921
        },
        {
          x: 1194.012,
          y: 439.893
        },
        {
          x: 1198.224,
          y: 439.795
        },
        {
          x: 1207.835,
          y: 438.891
        },
        {
          x: 1217.836,
          y: 435.662
        },
        {
          x: 1224.941,
          y: 449.696
        },
        {
          x: 1235.379,
          y: 443.861
        },
        {
          x: 1244.225,
          y: 447.514
        },
        {
          x: 1249.755,
          y: 470.584
        },
        {
          x: 1241.363,
          y: 493.653
        },
        {
          x: 1245.3,
          y: 516.723
        },
        {
          x: 1245.299,
          y: 539.792
        },
        {
          x: 1244.225,
          y: 562.862
        },
        {
          x: 1228.997,
          y: 563.619
        },
        {
          x: 1216.331,
          y: 576.816
        },
        {
          x: 1200.779,
          y: 576.002
        },
        {
          x: 1184.805,
          y: 573.144
        },
        {
          x: 1170.435,
          y: 578.068
        },
        {
          x: 1167.317,
          y: 578.596
        },
        {
          x: 1165.223,
          y: 575.728
        },
        {
          x: 1162.221,
          y: 575.871
        },
        {
          x: 1159.21,
          y: 576.044
        },
        {
          x: 1156.874,
          y: 573.98
        },
        {
          x: 1156.713,
          y: 573.863
        },
        {
          x: 1156.71,
          y: 573.591
        },
        {
          x: 1156.523,
          y: 573.499
        },
        {
          x: 1156.307,
          y: 573.436
        }
      ],
      neighborIds: [
        "district:63",
        "district:64",
        "district:86",
        "district:88",
        "district:108",
        "district:109",
        "district:110"
      ]
    },
    {
      id: "district:88",
      legacyId: 88,
      rowIndex: 3,
      columnIndex: 18,
      name: "District 88",
      zone: "residential",
      polygon: [
        {
          x: 1294.599,
          y: 439.574
        },
        {
          x: 1302.172,
          y: 463.599
        },
        {
          x: 1306.069,
          y: 488.815
        },
        {
          x: 1310.081,
          y: 513.993
        },
        {
          x: 1325.833,
          y: 535.372
        },
        {
          x: 1333.385,
          y: 559.404
        },
        {
          x: 1316.618,
          y: 556.831
        },
        {
          x: 1300.962,
          y: 567.535
        },
        {
          x: 1284.197,
          y: 564.987
        },
        {
          x: 1267.342,
          y: 561.364
        },
        {
          x: 1251.201,
          y: 566.278
        },
        {
          x: 1249.668,
          y: 565.877
        },
        {
          x: 1248.631,
          y: 564.462
        },
        {
          x: 1247.478,
          y: 563.285
        },
        {
          x: 1245.457,
          y: 563.878
        },
        {
          x: 1244.225,
          y: 562.862
        },
        {
          x: 1245.299,
          y: 539.792
        },
        {
          x: 1245.3,
          y: 516.723
        },
        {
          x: 1241.363,
          y: 493.653
        },
        {
          x: 1249.755,
          y: 470.584
        },
        {
          x: 1244.225,
          y: 447.514
        },
        {
          x: 1247.348,
          y: 443.715
        },
        {
          x: 1252.82,
          y: 444.919
        },
        {
          x: 1256.171,
          y: 441.607
        },
        {
          x: 1259.477,
          y: 438.199
        },
        {
          x: 1264.325,
          y: 438.074
        },
        {
          x: 1270.535,
          y: 435.25
        },
        {
          x: 1276.579,
          y: 435.765
        },
        {
          x: 1282.527,
          y: 438.21
        },
        {
          x: 1288.393,
          y: 442.333
        }
      ],
      neighborIds: [
        "district:64",
        "district:65",
        "district:87",
        "district:89",
        "district:110",
        "district:111"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:89",
      legacyId: 89,
      rowIndex: 3,
      columnIndex: 19,
      name: "District 89",
      zone: "industrial",
      polygon: [
        {
          x: 1380.895,
          y: 430.517
        },
        {
          x: 1385.418,
          y: 455.972
        },
        {
          x: 1381.002,
          y: 481.427
        },
        {
          x: 1377.065,
          y: 506.882
        },
        {
          x: 1378.119,
          y: 532.337
        },
        {
          x: 1380.895,
          y: 557.792
        },
        {
          x: 1375.334,
          y: 562.201
        },
        {
          x: 1367.469,
          y: 557.002
        },
        {
          x: 1361.742,
          y: 560.72
        },
        {
          x: 1355.956,
          y: 564.192
        },
        {
          x: 1349.602,
          y: 565.295
        },
        {
          x: 1346.533,
          y: 563.637
        },
        {
          x: 1342.492,
          y: 564.654
        },
        {
          x: 1339.666,
          y: 562.327
        },
        {
          x: 1336.759,
          y: 560.222
        },
        {
          x: 1333.385,
          y: 559.404
        },
        {
          x: 1325.833,
          y: 535.372
        },
        {
          x: 1310.081,
          y: 513.993
        },
        {
          x: 1306.069,
          y: 488.815
        },
        {
          x: 1302.172,
          y: 463.599
        },
        {
          x: 1294.599,
          y: 439.574
        },
        {
          x: 1302.682,
          y: 431.123
        },
        {
          x: 1314.034,
          y: 430.795
        },
        {
          x: 1325.326,
          y: 430.32
        },
        {
          x: 1332.186,
          y: 418.828
        },
        {
          x: 1344.016,
          y: 419.689
        },
        {
          x: 1349.912,
          y: 422.065
        },
        {
          x: 1357.067,
          y: 417.443
        },
        {
          x: 1362.802,
          y: 420.715
        },
        {
          x: 1368.329,
          y: 425.144
        },
        {
          x: 1374.643,
          y: 425.197
        },
        {
          x: 1376.332,
          y: 425.745
        },
        {
          x: 1377.163,
          y: 427.302
        },
        {
          x: 1378.037,
          y: 428.809
        },
        {
          x: 1379.384,
          y: 429.758
        }
      ],
      neighborIds: [
        "district:65",
        "district:66",
        "district:67",
        "district:88",
        "district:90",
        "district:111",
        "district:112"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:90",
      legacyId: 90,
      rowIndex: 3,
      columnIndex: 20,
      name: "District 90",
      zone: "residential",
      polygon: [
        {
          x: 1458.805,
          y: 440.341
        },
        {
          x: 1457.458,
          y: 466.469
        },
        {
          x: 1459.674,
          y: 492.91
        },
        {
          x: 1461.31,
          y: 519.3
        },
        {
          x: 1446.161,
          y: 544.217
        },
        {
          x: 1447.376,
          y: 570.57
        },
        {
          x: 1443.563,
          y: 572.489
        },
        {
          x: 1439.334,
          y: 568.448
        },
        {
          x: 1435.503,
          y: 570.114
        },
        {
          x: 1431.67,
          y: 571.737
        },
        {
          x: 1427.737,
          y: 571.942
        },
        {
          x: 1417.859,
          y: 570.799
        },
        {
          x: 1409.178,
          y: 565.692
        },
        {
          x: 1400.812,
          y: 559.543
        },
        {
          x: 1391.613,
          y: 556.155
        },
        {
          x: 1380.895,
          y: 557.792
        },
        {
          x: 1378.119,
          y: 532.337
        },
        {
          x: 1377.065,
          y: 506.882
        },
        {
          x: 1381.002,
          y: 481.427
        },
        {
          x: 1385.418,
          y: 455.972
        },
        {
          x: 1380.895,
          y: 430.517
        },
        {
          x: 1396.311,
          y: 433.796
        },
        {
          x: 1412.283,
          y: 432.667
        },
        {
          x: 1428.358,
          y: 430.727
        },
        {
          x: 1443.006,
          y: 440.097
        }
      ],
      neighborIds: [
        "district:67",
        "district:89",
        "district:91",
        "district:112",
        "district:113"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:91",
      legacyId: 91,
      rowIndex: 3,
      columnIndex: 21,
      name: "District 91",
      zone: "park",
      polygon: [
        {
          x: 1447.376,
          y: 570.57
        },
        {
          x: 1446.161,
          y: 544.217
        },
        {
          x: 1461.31,
          y: 519.3
        },
        {
          x: 1459.674,
          y: 492.91
        },
        {
          x: 1457.458,
          y: 466.469
        },
        {
          x: 1458.805,
          y: 440.341
        },
        {
          x: 1463.461,
          y: 438.877
        },
        {
          x: 1465.805,
          y: 432.537
        },
        {
          x: 1470.907,
          y: 432.013
        },
        {
          x: 1476.489,
          y: 432.5
        },
        {
          x: 1480.645,
          y: 429.982
        },
        {
          x: 1487.471,
          y: 428.783
        },
        {
          x: 1492.909,
          y: 435.286
        },
        {
          x: 1499.719,
          y: 434.172
        },
        {
          x: 1506.634,
          y: 432.48
        },
        {
          x: 1512.654,
          y: 435.751
        },
        {
          x: 1514.496,
          y: 461.566
        },
        {
          x: 1521.204,
          y: 486.532
        },
        {
          x: 1529.512,
          y: 511.218
        },
        {
          x: 1534.975,
          y: 536.401
        },
        {
          x: 1534.802,
          y: 562.568
        },
        {
          x: 1534.291,
          y: 563.214
        },
        {
          x: 1533.57,
          y: 563.555
        },
        {
          x: 1532.763,
          y: 563.774
        },
        {
          x: 1532.054,
          y: 564.134
        },
        {
          x: 1531.564,
          y: 564.81
        },
        {
          x: 1515.889,
          y: 560.819
        },
        {
          x: 1501.358,
          y: 566.207
        },
        {
          x: 1486.869,
          y: 571.941
        },
        {
          x: 1472.366,
          y: 577.558
        },
        {
          x: 1456.736,
          y: 573.937
        },
        {
          x: 1454.814,
          y: 573.403
        },
        {
          x: 1452.871,
          y: 572.927
        },
        {
          x: 1450.76,
          y: 572.917
        },
        {
          x: 1449.468,
          y: 570.632
        }
      ],
      neighborIds: [
        "district:67",
        "district:68",
        "district:90",
        "district:92",
        "district:113",
        "district:114",
        "district:115"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:92",
      legacyId: 92,
      rowIndex: 3,
      columnIndex: 22,
      name: "District 92",
      zone: "commercial",
      polygon: [
        {
          x: 1600,
          y: 422.464
        },
        {
          x: 1600,
          y: 448.338
        },
        {
          x: 1597.614,
          y: 474.211
        },
        {
          x: 1600,
          y: 500.084
        },
        {
          x: 1600,
          y: 525.958
        },
        {
          x: 1600,
          y: 551.831
        },
        {
          x: 1587.467,
          y: 557.052
        },
        {
          x: 1573.568,
          y: 553.984
        },
        {
          x: 1559.889,
          y: 552.247
        },
        {
          x: 1548.414,
          y: 563.898
        },
        {
          x: 1534.802,
          y: 562.568
        },
        {
          x: 1534.975,
          y: 536.401
        },
        {
          x: 1529.512,
          y: 511.218
        },
        {
          x: 1521.204,
          y: 486.532
        },
        {
          x: 1514.496,
          y: 461.566
        },
        {
          x: 1512.654,
          y: 435.751
        },
        {
          x: 1521.073,
          y: 430.748
        },
        {
          x: 1532.03,
          y: 432.122
        },
        {
          x: 1542.284,
          y: 431.729
        },
        {
          x: 1547.901,
          y: 419.686
        },
        {
          x: 1557.587,
          y: 417.867
        },
        {
          x: 1565.641,
          y: 422.739
        },
        {
          x: 1574.185,
          y: 423.096
        },
        {
          x: 1582.993,
          y: 421.01
        },
        {
          x: 1591.055,
          y: 425.81
        }
      ],
      neighborIds: [
        "district:68",
        "district:69",
        "district:91",
        "district:115"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:93",
      legacyId: 93,
      rowIndex: 4,
      columnIndex: 0,
      name: "District 93",
      zone: "commercial",
      polygon: [
        {
          x: 83.808,
          y: 581.104
        },
        {
          x: 89.405,
          y: 607.536
        },
        {
          x: 77.78,
          y: 633.968
        },
        {
          x: 81.717,
          y: 660.399
        },
        {
          x: 88.996,
          y: 686.831
        },
        {
          x: 83.808,
          y: 713.263
        },
        {
          x: 82,
          y: 714.146
        },
        {
          x: 80.191,
          y: 715.021
        },
        {
          x: 78.49,
          y: 716.261
        },
        {
          x: 76.068,
          y: 715.081
        },
        {
          x: 74.299,
          y: 716.094
        },
        {
          x: 59.537,
          y: 711.776
        },
        {
          x: 43.727,
          y: 711.404
        },
        {
          x: 27.857,
          y: 711.261
        },
        {
          x: 16.102,
          y: 695.624
        },
        {
          x: 0,
          y: 696.352
        },
        {
          x: 0,
          y: 675.411
        },
        {
          x: 6.086,
          y: 654.469
        },
        {
          x: 2.149,
          y: 633.527
        },
        {
          x: 0,
          y: 612.585
        },
        {
          x: 0,
          y: 591.643
        },
        {
          x: 14.195,
          y: 590.868
        },
        {
          x: 26.549,
          y: 582.156
        },
        {
          x: 39.3,
          y: 575.156
        },
        {
          x: 55.21,
          y: 581.77
        },
        {
          x: 68.203,
          y: 575.815
        },
        {
          x: 70.808,
          y: 578.397
        },
        {
          x: 74.296,
          y: 578.371
        },
        {
          x: 77.792,
          y: 578.323
        },
        {
          x: 80.865,
          y: 579.52
        }
      ],
      neighborIds: [
        "district:70",
        "district:71",
        "district:94",
        "district:116",
        "district:117"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:94",
      legacyId: 94,
      rowIndex: 4,
      columnIndex: 1,
      name: "District 94",
      zone: "industrial",
      polygon: [
        {
          x: 83.808,
          y: 713.263
        },
        {
          x: 88.996,
          y: 686.831
        },
        {
          x: 81.717,
          y: 660.399
        },
        {
          x: 77.78,
          y: 633.968
        },
        {
          x: 89.405,
          y: 607.536
        },
        {
          x: 83.808,
          y: 581.104
        },
        {
          x: 92.891,
          y: 577.121
        },
        {
          x: 102.505,
          y: 577.566
        },
        {
          x: 112.331,
          y: 579.775
        },
        {
          x: 121.909,
          y: 579.92
        },
        {
          x: 130.934,
          y: 575.451
        },
        {
          x: 137.557,
          y: 598.788
        },
        {
          x: 137.229,
          y: 624.089
        },
        {
          x: 158.339,
          y: 643.335
        },
        {
          x: 157.731,
          y: 668.715
        },
        {
          x: 163.9,
          y: 692.18
        },
        {
          x: 153.279,
          y: 699.378
        },
        {
          x: 137.926,
          y: 696.337
        },
        {
          x: 132.761,
          y: 715.341
        },
        {
          x: 118.971,
          y: 715.682
        },
        {
          x: 106.435,
          y: 718.734
        },
        {
          x: 101.963,
          y: 717.419
        },
        {
          x: 98.18,
          y: 713.252
        },
        {
          x: 92.17,
          y: 718.302
        },
        {
          x: 87.948,
          y: 715.952
        }
      ],
      neighborIds: [
        "district:71",
        "district:93",
        "district:95",
        "district:117",
        "district:118"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:95",
      legacyId: 95,
      rowIndex: 4,
      columnIndex: 2,
      name: "District 95",
      zone: "commercial",
      polygon: [
        {
          x: 233.94,
          y: 589.366
        },
        {
          x: 224.89,
          y: 610.432
        },
        {
          x: 224.354,
          y: 633.49
        },
        {
          x: 223.046,
          y: 656.367
        },
        {
          x: 209.069,
          y: 676.281
        },
        {
          x: 208.236,
          y: 699.27
        },
        {
          x: 198.865,
          y: 701.005
        },
        {
          x: 190.775,
          y: 694.724
        },
        {
          x: 181.405,
          y: 696.448
        },
        {
          x: 172.315,
          y: 696.425
        },
        {
          x: 163.9,
          y: 692.18
        },
        {
          x: 157.731,
          y: 668.715
        },
        {
          x: 158.339,
          y: 643.335
        },
        {
          x: 137.229,
          y: 624.089
        },
        {
          x: 137.557,
          y: 598.788
        },
        {
          x: 130.934,
          y: 575.451
        },
        {
          x: 134.185,
          y: 575.045
        },
        {
          x: 135.5,
          y: 571.499
        },
        {
          x: 138.592,
          y: 570.834
        },
        {
          x: 141.738,
          y: 570.258
        },
        {
          x: 143.619,
          y: 567.629
        },
        {
          x: 150.143,
          y: 565.329
        },
        {
          x: 156.322,
          y: 561.074
        },
        {
          x: 164.649,
          y: 569.013
        },
        {
          x: 170.346,
          y: 562.025
        },
        {
          x: 177.22,
          y: 561.71
        },
        {
          x: 186.116,
          y: 572.26
        },
        {
          x: 199.108,
          y: 574.412
        },
        {
          x: 212.178,
          y: 576.405
        },
        {
          x: 225.121,
          y: 578.655
        }
      ],
      neighborIds: [
        "district:71",
        "district:72",
        "district:73",
        "district:94",
        "district:96",
        "district:118"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:96",
      legacyId: 96,
      rowIndex: 4,
      columnIndex: 3,
      name: "District 96",
      zone: "residential",
      polygon: [
        {
          x: 291.944,
          y: 580.215
        },
        {
          x: 295.259,
          y: 604.338
        },
        {
          x: 293.371,
          y: 628.461
        },
        {
          x: 289.434,
          y: 652.584
        },
        {
          x: 295.668,
          y: 676.707
        },
        {
          x: 291.944,
          y: 700.83
        },
        {
          x: 285.396,
          y: 707.244
        },
        {
          x: 275.385,
          y: 703.944
        },
        {
          x: 268.537,
          y: 709.516
        },
        {
          x: 261.779,
          y: 715.34
        },
        {
          x: 252.753,
          y: 714.804
        },
        {
          x: 244.295,
          y: 713.351
        },
        {
          x: 236.086,
          y: 711.047
        },
        {
          x: 228.757,
          y: 705.748
        },
        {
          x: 218.792,
          y: 709.428
        },
        {
          x: 211.853,
          y: 702.799
        },
        {
          x: 211.038,
          y: 702.187
        },
        {
          x: 210.508,
          y: 701.283
        },
        {
          x: 210.035,
          y: 700.321
        },
        {
          x: 209.331,
          y: 699.595
        },
        {
          x: 208.236,
          y: 699.27
        },
        {
          x: 209.069,
          y: 676.281
        },
        {
          x: 223.046,
          y: 656.367
        },
        {
          x: 224.354,
          y: 633.49
        },
        {
          x: 224.89,
          y: 610.432
        },
        {
          x: 233.94,
          y: 589.366
        },
        {
          x: 246.343,
          y: 592.617
        },
        {
          x: 256.599,
          y: 582.262
        },
        {
          x: 268.813,
          y: 584.321
        },
        {
          x: 281.081,
          y: 586.723
        }
      ],
      neighborIds: [
        "district:73",
        "district:95",
        "district:97",
        "district:118",
        "district:119",
        "district:120"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:97",
      legacyId: 97,
      rowIndex: 4,
      columnIndex: 4,
      name: "District 97",
      zone: "park",
      polygon: [
        {
          x: 331.866,
          y: 576.937
        },
        {
          x: 342.16,
          y: 600.57
        },
        {
          x: 347.693,
          y: 625.694
        },
        {
          x: 351.601,
          y: 651.329
        },
        {
          x: 365.545,
          y: 673.817
        },
        {
          x: 370.19,
          y: 699.221
        },
        {
          x: 364.404,
          y: 703.363
        },
        {
          x: 356.597,
          y: 702.836
        },
        {
          x: 349.236,
          y: 703.338
        },
        {
          x: 345.358,
          y: 711.888
        },
        {
          x: 338.277,
          y: 713.038
        },
        {
          x: 329.617,
          y: 708.295
        },
        {
          x: 320.579,
          y: 704.984
        },
        {
          x: 310.447,
          y: 705.826
        },
        {
          x: 300.213,
          y: 707.058
        },
        {
          x: 291.944,
          y: 700.83
        },
        {
          x: 295.668,
          y: 676.707
        },
        {
          x: 289.434,
          y: 652.584
        },
        {
          x: 293.371,
          y: 628.461
        },
        {
          x: 295.259,
          y: 604.338
        },
        {
          x: 291.944,
          y: 580.215
        },
        {
          x: 293.157,
          y: 579.843
        },
        {
          x: 293.87,
          y: 578.694
        },
        {
          x: 294.664,
          y: 577.67
        },
        {
          x: 295.805,
          y: 577.187
        },
        {
          x: 297.081,
          y: 576.914
        },
        {
          x: 302.342,
          y: 576.403
        },
        {
          x: 307.282,
          y: 572.483
        },
        {
          x: 313.217,
          y: 579.132
        },
        {
          x: 318.147,
          y: 575.111
        },
        {
          x: 323.393,
          y: 574.437
        },
        {
          x: 325.111,
          y: 574.855
        },
        {
          x: 326.496,
          y: 576.404
        },
        {
          x: 328.87,
          y: 574.604
        },
        {
          x: 330.396,
          y: 575.675
        }
      ],
      neighborIds: [
        "district:73",
        "district:74",
        "district:75",
        "district:96",
        "district:98",
        "district:120",
        "district:121"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:98",
      legacyId: 98,
      rowIndex: 4,
      columnIndex: 5,
      name: "District 98",
      zone: "commercial",
      polygon: [
        {
          x: 421.081,
          y: 578.885
        },
        {
          x: 420.337,
          y: 602.584
        },
        {
          x: 423.813,
          y: 626.283
        },
        {
          x: 427.75,
          y: 649.983
        },
        {
          x: 415.88,
          y: 673.682
        },
        {
          x: 421.081,
          y: 697.381
        },
        {
          x: 417.969,
          y: 696.985
        },
        {
          x: 415.097,
          y: 697.26
        },
        {
          x: 412.804,
          y: 699.138
        },
        {
          x: 410.705,
          y: 701.554
        },
        {
          x: 407.937,
          y: 702.117
        },
        {
          x: 400.654,
          y: 698.066
        },
        {
          x: 393.235,
          y: 695.791
        },
        {
          x: 385.48,
          y: 697.887
        },
        {
          x: 377.625,
          y: 701.287
        },
        {
          x: 370.19,
          y: 699.221
        },
        {
          x: 365.545,
          y: 673.817
        },
        {
          x: 351.601,
          y: 651.329
        },
        {
          x: 347.693,
          y: 625.694
        },
        {
          x: 342.16,
          y: 600.57
        },
        {
          x: 331.866,
          y: 576.937
        },
        {
          x: 345.376,
          y: 571.164
        },
        {
          x: 359.525,
          y: 570.885
        },
        {
          x: 373.971,
          y: 573.17
        },
        {
          x: 387.305,
          y: 565.879
        },
        {
          x: 401.826,
          y: 568.806
        },
        {
          x: 405.81,
          y: 570.568
        },
        {
          x: 410.457,
          y: 571.063
        },
        {
          x: 415.022,
          y: 571.715
        },
        {
          x: 416.554,
          y: 578.161
        }
      ],
      neighborIds: [
        "district:75",
        "district:76",
        "district:97",
        "district:99",
        "district:121",
        "district:122"
      ]
    },
    {
      id: "district:99",
      legacyId: 99,
      rowIndex: 4,
      columnIndex: 6,
      name: "District 99",
      zone: "residential",
      polygon: [
        {
          x: 485.246,
          y: 570.952
        },
        {
          x: 495.206,
          y: 596.083
        },
        {
          x: 491.434,
          y: 623.574
        },
        {
          x: 499.795,
          y: 648.981
        },
        {
          x: 508.245,
          y: 674.371
        },
        {
          x: 507.649,
          y: 701.317
        },
        {
          x: 501.151,
          y: 701.443
        },
        {
          x: 494.724,
          y: 701.82
        },
        {
          x: 488.071,
          y: 701.404
        },
        {
          x: 483.717,
          y: 709.042
        },
        {
          x: 477.439,
          y: 709.942
        },
        {
          x: 465.802,
          y: 709.068
        },
        {
          x: 454.449,
          y: 706.923
        },
        {
          x: 444.034,
          y: 700.568
        },
        {
          x: 433.575,
          y: 694.408
        },
        {
          x: 421.081,
          y: 697.381
        },
        {
          x: 415.88,
          y: 673.682
        },
        {
          x: 427.75,
          y: 649.983
        },
        {
          x: 423.813,
          y: 626.283
        },
        {
          x: 420.337,
          y: 602.584
        },
        {
          x: 421.081,
          y: 578.885
        },
        {
          x: 433.283,
          y: 572.191
        },
        {
          x: 447.576,
          y: 582.418
        },
        {
          x: 459.926,
          y: 576.924
        },
        {
          x: 472.329,
          y: 571.854
        }
      ],
      neighborIds: [
        "district:76",
        "district:98",
        "district:100",
        "district:122",
        "district:123"
      ]
    },
    {
      id: "district:100",
      legacyId: 100,
      rowIndex: 4,
      columnIndex: 7,
      name: "District 100",
      zone: "park",
      polygon: [
        {
          x: 588.074,
          y: 573.126
        },
        {
          x: 585.522,
          y: 600.231
        },
        {
          x: 570.876,
          y: 623.497
        },
        {
          x: 559.074,
          y: 647.666
        },
        {
          x: 550.556,
          y: 672.878
        },
        {
          x: 547.821,
          y: 699.925
        },
        {
          x: 544.42,
          y: 700.444
        },
        {
          x: 542.18,
          y: 704.199
        },
        {
          x: 537.452,
          y: 701.026
        },
        {
          x: 534.842,
          y: 703.75
        },
        {
          x: 531.929,
          y: 705.631
        },
        {
          x: 527.244,
          y: 703.809
        },
        {
          x: 522.187,
          y: 704.074
        },
        {
          x: 517.026,
          y: 704.932
        },
        {
          x: 512.109,
          y: 704.411
        },
        {
          x: 507.649,
          y: 701.317
        },
        {
          x: 508.245,
          y: 674.371
        },
        {
          x: 499.795,
          y: 648.981
        },
        {
          x: 491.434,
          y: 623.574
        },
        {
          x: 495.206,
          y: 596.083
        },
        {
          x: 485.246,
          y: 570.952
        },
        {
          x: 487.566,
          y: 566.301
        },
        {
          x: 491.433,
          y: 563.637
        },
        {
          x: 496.152,
          y: 562.066
        },
        {
          x: 498.554,
          y: 557.522
        },
        {
          x: 503.737,
          y: 556.546
        },
        {
          x: 510.665,
          y: 555.263
        },
        {
          x: 517.192,
          y: 551.567
        },
        {
          x: 523.733,
          y: 547.951
        },
        {
          x: 531.556,
          y: 552.058
        },
        {
          x: 538.484,
          y: 550.778
        },
        {
          x: 549.473,
          y: 552.871
        },
        {
          x: 561.636,
          y: 552.359
        },
        {
          x: 565.486,
          y: 570.293
        },
        {
          x: 577.434,
          y: 570.258
        }
      ],
      neighborIds: [
        "district:76",
        "district:77",
        "district:78",
        "district:99",
        "district:101",
        "district:123",
        "district:124"
      ]
    },
    {
      id: "district:101",
      legacyId: 101,
      rowIndex: 4,
      columnIndex: 8,
      name: "District 101",
      zone: "residential",
      polygon: [
        {
          x: 645.842,
          y: 573.922
        },
        {
          x: 644.815,
          y: 601.791
        },
        {
          x: 647.122,
          y: 629.967
        },
        {
          x: 629.541,
          y: 656.306
        },
        {
          x: 632.695,
          y: 684.56
        },
        {
          x: 633.038,
          y: 712.555
        },
        {
          x: 631.562,
          y: 713.199
        },
        {
          x: 629.668,
          y: 712.305
        },
        {
          x: 628.699,
          y: 714.811
        },
        {
          x: 626.966,
          y: 714.51
        },
        {
          x: 625.352,
          y: 714.647
        },
        {
          x: 610.913,
          y: 706.088
        },
        {
          x: 595.331,
          y: 703.54
        },
        {
          x: 579.09,
          y: 704.464
        },
        {
          x: 563.032,
          y: 704.425
        },
        {
          x: 547.821,
          y: 699.925
        },
        {
          x: 550.556,
          y: 672.878
        },
        {
          x: 559.074,
          y: 647.666
        },
        {
          x: 570.876,
          y: 623.497
        },
        {
          x: 585.522,
          y: 600.231
        },
        {
          x: 588.074,
          y: 573.126
        },
        {
          x: 597.332,
          y: 571.285
        },
        {
          x: 607.368,
          y: 575.771
        },
        {
          x: 615.149,
          y: 561.938
        },
        {
          x: 624.898,
          y: 564.088
        },
        {
          x: 634.787,
          y: 567.376
        },
        {
          x: 635.875,
          y: 567.217
        },
        {
          x: 636.729,
          y: 567.849
        },
        {
          x: 637.584,
          y: 568.472
        },
        {
          x: 638.558,
          y: 568.7
        },
        {
          x: 639.569,
          y: 568.8
        },
        {
          x: 641.036,
          y: 569.564
        },
        {
          x: 641.334,
          y: 571.761
        },
        {
          x: 642.951,
          y: 572.341
        },
        {
          x: 644.762,
          y: 572.683
        }
      ],
      neighborIds: [
        "district:78",
        "district:79",
        "district:80",
        "district:83",
        "district:100",
        "district:124",
        "district:125"
      ]
    },
    {
      id: "district:102",
      legacyId: 102,
      rowIndex: 3,
      columnIndex: 13,
      name: "District 102",
      zone: "downtown",
      polygon: [
        {
          x: 971.847,
          y: 446.206
        },
        {
          x: 971.126,
          y: 467.527
        },
        {
          x: 973.343,
          y: 489.3
        },
        {
          x: 955.219,
          y: 507.95
        },
        {
          x: 957.077,
          y: 529.668
        },
        {
          x: 955.776,
          y: 550.901
        },
        {
          x: 948.316,
          y: 554.565
        },
        {
          x: 940.593,
          y: 557.008
        },
        {
          x: 932.107,
          y: 555.913
        },
        {
          x: 923.55,
          y: 554.48
        },
        {
          x: 916.358,
          y: 559.391
        },
        {
          x: 910.895,
          y: 534.277
        },
        {
          x: 897.415,
          y: 512.081
        },
        {
          x: 885.006,
          y: 489.496
        },
        {
          x: 885.148,
          y: 462.341
        },
        {
          x: 872.806,
          y: 439.731
        },
        {
          x: 879.175,
          y: 434.897
        },
        {
          x: 887.761,
          y: 435.416
        },
        {
          x: 895.956,
          y: 434.988
        },
        {
          x: 902.556,
          y: 430.712
        },
        {
          x: 908.535,
          y: 424.934
        },
        {
          x: 921.088,
          y: 429.514
        },
        {
          x: 934.937,
          y: 430.237
        },
        {
          x: 948.853,
          y: 430.76
        },
        {
          x: 958.945,
          y: 442.665
        }
      ],
      neighborIds: [
        "district:60",
        "district:82",
        "district:84",
        "district:105",
        "district:106"
      ],
      isDowntown: true
    },
    {
      id: "district:103",
      legacyId: 103,
      rowIndex: 2,
      columnIndex: 11,
      name: "District 103",
      zone: "downtown",
      polygon: [
        {
          x: 762.851,
          y: 428.901
        },
        {
          x: 765.803,
          y: 407.656
        },
        {
          x: 772.891,
          y: 387.121
        },
        {
          x: 780.395,
          y: 366.657
        },
        {
          x: 776.27,
          y: 344.199
        },
        {
          x: 780.968,
          y: 323.254
        },
        {
          x: 789.733,
          y: 318.045
        },
        {
          x: 800.2,
          y: 326.969
        },
        {
          x: 809.063,
          y: 322.574
        },
        {
          x: 817.954,
          y: 318.413
        },
        {
          x: 827.258,
          y: 317.679
        },
        {
          x: 838.237,
          y: 340.405
        },
        {
          x: 835.769,
          y: 366.395
        },
        {
          x: 845.416,
          y: 389.445
        },
        {
          x: 851.369,
          y: 413.391
        },
        {
          x: 856.363,
          y: 437.57
        },
        {
          x: 852.293,
          y: 438.999
        },
        {
          x: 847.651,
          y: 439.183
        },
        {
          x: 846.179,
          y: 446.274
        },
        {
          x: 841.299,
          y: 445.939
        },
        {
          x: 836.843,
          y: 446.527
        },
        {
          x: 822.711,
          y: 440.206
        },
        {
          x: 807.412,
          y: 438.783
        },
        {
          x: 791.701,
          y: 439.087
        },
        {
          x: 776.624,
          y: 436.731
        }
      ],
      neighborIds: [
        "district:35",
        "district:81",
        "district:82",
        "district:104",
        "district:105"
      ],
      isDowntown: true
    },
    {
      id: "district:104",
      legacyId: 104,
      rowIndex: 2,
      columnIndex: 10,
      name: "District 104",
      zone: "downtown",
      polygon: [
        {
          x: 780.968,
          y: 323.254
        },
        {
          x: 776.27,
          y: 344.199
        },
        {
          x: 780.395,
          y: 366.657
        },
        {
          x: 772.891,
          y: 387.121
        },
        {
          x: 765.803,
          y: 407.656
        },
        {
          x: 762.851,
          y: 428.901
        },
        {
          x: 753.455,
          y: 431.077
        },
        {
          x: 747.176,
          y: 440.555
        },
        {
          x: 737.121,
          y: 441.188
        },
        {
          x: 727.391,
          y: 442.582
        },
        {
          x: 719.183,
          y: 447.541
        },
        {
          x: 718.947,
          y: 447.479
        },
        {
          x: 718.713,
          y: 447.41
        },
        {
          x: 718.489,
          y: 447.282
        },
        {
          x: 718.213,
          y: 447.445
        },
        {
          x: 717.988,
          y: 447.324
        },
        {
          x: 710.87,
          y: 442.086
        },
        {
          x: 707.856,
          y: 431.395
        },
        {
          x: 698.912,
          y: 428.584
        },
        {
          x: 689.883,
          y: 425.887
        },
        {
          x: 682.683,
          y: 420.76
        },
        {
          x: 686.173,
          y: 396.503
        },
        {
          x: 698.186,
          y: 375.254
        },
        {
          x: 709.899,
          y: 353.9
        },
        {
          x: 709.79,
          y: 328.372
        },
        {
          x: 722.687,
          y: 307.435
        },
        {
          x: 725.939,
          y: 307.359
        },
        {
          x: 729.353,
          y: 308.229
        },
        {
          x: 731.793,
          y: 303.381
        },
        {
          x: 735.243,
          y: 304.464
        },
        {
          x: 738.554,
          y: 304.732
        },
        {
          x: 746.525,
          y: 309.607
        },
        {
          x: 758.63,
          y: 305.019
        },
        {
          x: 765.8,
          y: 311.729
        },
        {
          x: 772.11,
          y: 320.408
        }
      ],
      neighborIds: [
        "district:34",
        "district:35",
        "district:56",
        "district:79",
        "district:80",
        "district:81",
        "district:103"
      ],
      isDowntown: true
    },
    {
      id: "district:105",
      legacyId: 105,
      rowIndex: 2,
      columnIndex: 12,
      name: "District 105",
      zone: "downtown",
      polygon: [
        {
          x: 933.041,
          y: 315.189
        },
        {
          x: 926.002,
          y: 336.661
        },
        {
          x: 919.133,
          y: 358.17
        },
        {
          x: 910.389,
          y: 379.261
        },
        {
          x: 915.647,
          y: 403.479
        },
        {
          x: 908.535,
          y: 424.934
        },
        {
          x: 902.556,
          y: 430.712
        },
        {
          x: 895.956,
          y: 434.988
        },
        {
          x: 887.761,
          y: 435.416
        },
        {
          x: 879.175,
          y: 434.897
        },
        {
          x: 872.806,
          y: 439.731
        },
        {
          x: 869.431,
          y: 439.954
        },
        {
          x: 866.549,
          y: 436.431
        },
        {
          x: 863.107,
          y: 437.164
        },
        {
          x: 859.582,
          y: 438.536
        },
        {
          x: 856.363,
          y: 437.57
        },
        {
          x: 851.369,
          y: 413.391
        },
        {
          x: 845.416,
          y: 389.445
        },
        {
          x: 835.769,
          y: 366.395
        },
        {
          x: 838.237,
          y: 340.405
        },
        {
          x: 827.258,
          y: 317.679
        },
        {
          x: 831.317,
          y: 314.475
        },
        {
          x: 836.508,
          y: 312.738
        },
        {
          x: 841.72,
          y: 311.026
        },
        {
          x: 843.475,
          y: 304.84
        },
        {
          x: 847.715,
          y: 301.872
        },
        {
          x: 855.084,
          y: 303.11
        },
        {
          x: 861.094,
          y: 296.02
        },
        {
          x: 868.478,
          y: 297.355
        },
        {
          x: 875.569,
          y: 296.894
        },
        {
          x: 882.619,
          y: 296.179
        },
        {
          x: 891.951,
          y: 301.976
        },
        {
          x: 902.918,
          y: 303.438
        },
        {
          x: 914.35,
          y: 303.667
        },
        {
          x: 922.065,
          y: 313.754
        }
      ],
      neighborIds: [
        "district:35",
        "district:36",
        "district:37",
        "district:60",
        "district:82",
        "district:102",
        "district:103"
      ],
      isDowntown: true
    },
    {
      id: "district:106",
      legacyId: 106,
      rowIndex: 4,
      columnIndex: 13,
      name: "District 106",
      zone: "park",
      polygon: [
        {
          x: 984.683,
          y: 561.761
        },
        {
          x: 986.928,
          y: 586.428
        },
        {
          x: 985.233,
          y: 611.445
        },
        {
          x: 983.511,
          y: 636.464
        },
        {
          x: 997.962,
          y: 660.043
        },
        {
          x: 995.675,
          y: 685.113
        },
        {
          x: 984.699,
          y: 686.013
        },
        {
          x: 975.347,
          y: 691.484
        },
        {
          x: 966.58,
          y: 698.601
        },
        {
          x: 956.951,
          y: 703.291
        },
        {
          x: 945.527,
          y: 702.929
        },
        {
          x: 939.858,
          y: 700.725
        },
        {
          x: 933.821,
          y: 701.123
        },
        {
          x: 927.665,
          y: 702.371
        },
        {
          x: 921.724,
          y: 702.088
        },
        {
          x: 916.212,
          y: 698.782
        },
        {
          x: 913.864,
          y: 670.928
        },
        {
          x: 916.35,
          y: 643.074
        },
        {
          x: 920.286,
          y: 615.22
        },
        {
          x: 921.163,
          y: 587.367
        },
        {
          x: 916.212,
          y: 559.513
        },
        {
          x: 916.23,
          y: 559.475
        },
        {
          x: 916.286,
          y: 559.483
        },
        {
          x: 916.306,
          y: 559.448
        },
        {
          x: 916.328,
          y: 559.414
        },
        {
          x: 916.358,
          y: 559.391
        },
        {
          x: 923.55,
          y: 554.48
        },
        {
          x: 932.107,
          y: 555.913
        },
        {
          x: 940.593,
          y: 557.008
        },
        {
          x: 948.316,
          y: 554.565
        },
        {
          x: 955.776,
          y: 550.901
        },
        {
          x: 960.545,
          y: 555.767
        },
        {
          x: 968.649,
          y: 551.756
        },
        {
          x: 973.661,
          y: 555.976
        },
        {
          x: 978.76,
          y: 559.965
        }
      ],
      neighborIds: [
        "district:59",
        "district:84",
        "district:102",
        "district:107",
        "district:129",
        "district:130"
      ]
    },
    {
      id: "district:107",
      legacyId: 107,
      rowIndex: 4,
      columnIndex: 14,
      name: "District 107",
      zone: "commercial",
      polygon: [
        {
          x: 1056.93,
          y: 568.02
        },
        {
          x: 1062.16,
          y: 592.535
        },
        {
          x: 1053.581,
          y: 617.05
        },
        {
          x: 1057.518,
          y: 641.565
        },
        {
          x: 1057.703,
          y: 666.08
        },
        {
          x: 1056.93,
          y: 690.595
        },
        {
          x: 1055.254,
          y: 690.258
        },
        {
          x: 1054.121,
          y: 691.753
        },
        {
          x: 1052.519,
          y: 691.669
        },
        {
          x: 1050.922,
          y: 691.598
        },
        {
          x: 1049.683,
          y: 692.741
        },
        {
          x: 1039.055,
          y: 689.986
        },
        {
          x: 1028.901,
          y: 683.874
        },
        {
          x: 1016.028,
          y: 697.013
        },
        {
          x: 1006.038,
          y: 689.742
        },
        {
          x: 995.675,
          y: 685.113
        },
        {
          x: 997.962,
          y: 660.043
        },
        {
          x: 983.511,
          y: 636.464
        },
        {
          x: 985.233,
          y: 611.445
        },
        {
          x: 986.928,
          y: 586.428
        },
        {
          x: 984.683,
          y: 561.761
        },
        {
          x: 991.086,
          y: 558.625
        },
        {
          x: 998.465,
          y: 561.441
        },
        {
          x: 1004.81,
          y: 557.951
        },
        {
          x: 1011.336,
          y: 555.563
        },
        {
          x: 1018.365,
          y: 556.244
        },
        {
          x: 1025.097,
          y: 561.814
        },
        {
          x: 1034.707,
          y: 557.957
        },
        {
          x: 1041.585,
          y: 563.045
        },
        {
          x: 1048.323,
          y: 568.595
        }
      ],
      neighborIds: [
        "district:84",
        "district:85",
        "district:106",
        "district:108",
        "district:130",
        "district:131"
      ]
    },
    {
      id: "district:108",
      legacyId: 108,
      rowIndex: 4,
      columnIndex: 15,
      name: "District 108",
      zone: "residential",
      polygon: [
        {
          x: 1156.874,
          y: 573.98
        },
        {
          x: 1144.495,
          y: 596.529
        },
        {
          x: 1128.766,
          y: 617.303
        },
        {
          x: 1113.244,
          y: 638.187
        },
        {
          x: 1112.303,
          y: 666.797
        },
        {
          x: 1096.658,
          y: 687.615
        },
        {
          x: 1092.74,
          y: 689.872
        },
        {
          x: 1087.653,
          y: 687.711
        },
        {
          x: 1084.95,
          y: 694.557
        },
        {
          x: 1080.122,
          y: 693.378
        },
        {
          x: 1075.56,
          y: 693.2
        },
        {
          x: 1071.77,
          y: 693.134
        },
        {
          x: 1068.19,
          y: 691.574
        },
        {
          x: 1064.648,
          y: 689.733
        },
        {
          x: 1060.384,
          y: 693.066
        },
        {
          x: 1056.93,
          y: 690.595
        },
        {
          x: 1057.703,
          y: 666.08
        },
        {
          x: 1057.518,
          y: 641.565
        },
        {
          x: 1053.581,
          y: 617.05
        },
        {
          x: 1062.16,
          y: 592.535
        },
        {
          x: 1056.93,
          y: 568.02
        },
        {
          x: 1065.076,
          y: 560.896
        },
        {
          x: 1077.612,
          y: 568.211
        },
        {
          x: 1086.034,
          y: 561.997
        },
        {
          x: 1094.543,
          y: 556.071
        },
        {
          x: 1104.124,
          y: 553.668
        },
        {
          x: 1115.35,
          y: 555.432
        },
        {
          x: 1124.877,
          y: 561.704
        },
        {
          x: 1133.903,
          y: 569.31
        },
        {
          x: 1146.732,
          y: 566.814
        },
        {
          x: 1156.188,
          y: 573.277
        },
        {
          x: 1156.307,
          y: 573.436
        },
        {
          x: 1156.523,
          y: 573.499
        },
        {
          x: 1156.71,
          y: 573.591
        },
        {
          x: 1156.713,
          y: 573.863
        }
      ],
      neighborIds: [
        "district:85",
        "district:86",
        "district:87",
        "district:107",
        "district:109",
        "district:131",
        "district:132"
      ]
    },
    {
      id: "district:109",
      legacyId: 109,
      rowIndex: 4,
      columnIndex: 16,
      name: "District 109",
      zone: "industrial",
      polygon: [
        {
          x: 1170.435,
          y: 578.068
        },
        {
          x: 1178.085,
          y: 603.27
        },
        {
          x: 1182.421,
          y: 629.633
        },
        {
          x: 1205.357,
          y: 649.48
        },
        {
          x: 1204.572,
          y: 677.638
        },
        {
          x: 1213.935,
          y: 702.24
        },
        {
          x: 1207.106,
          y: 703.467
        },
        {
          x: 1200.399,
          y: 704.954
        },
        {
          x: 1193.324,
          y: 705.659
        },
        {
          x: 1190.058,
          y: 714.459
        },
        {
          x: 1183.615,
          y: 716.506
        },
        {
          x: 1167.603,
          y: 706.574
        },
        {
          x: 1151.274,
          y: 697.601
        },
        {
          x: 1129.126,
          y: 706.138
        },
        {
          x: 1114.024,
          y: 693.469
        },
        {
          x: 1096.658,
          y: 687.615
        },
        {
          x: 1112.303,
          y: 666.797
        },
        {
          x: 1113.244,
          y: 638.187
        },
        {
          x: 1128.766,
          y: 617.303
        },
        {
          x: 1144.495,
          y: 596.529
        },
        {
          x: 1156.874,
          y: 573.98
        },
        {
          x: 1159.21,
          y: 576.044
        },
        {
          x: 1162.221,
          y: 575.871
        },
        {
          x: 1165.223,
          y: 575.728
        },
        {
          x: 1167.317,
          y: 578.596
        }
      ],
      neighborIds: [
        "district:87",
        "district:108",
        "district:110",
        "district:132",
        "district:133"
      ]
    },
    {
      id: "district:110",
      legacyId: 110,
      rowIndex: 4,
      columnIndex: 17,
      name: "District 110",
      zone: "park",
      polygon: [
        {
          x: 1251.201,
          y: 566.278
        },
        {
          x: 1250.64,
          y: 593.086
        },
        {
          x: 1259.136,
          y: 618.301
        },
        {
          x: 1267.57,
          y: 643.527
        },
        {
          x: 1263.906,
          y: 670.881
        },
        {
          x: 1273.983,
          y: 695.818
        },
        {
          x: 1269.785,
          y: 698.572
        },
        {
          x: 1265.557,
          y: 701.252
        },
        {
          x: 1261.646,
          y: 704.717
        },
        {
          x: 1255.349,
          y: 702.284
        },
        {
          x: 1251.158,
          y: 705.057
        },
        {
          x: 1243.56,
          y: 706.532
        },
        {
          x: 1236.219,
          y: 704.591
        },
        {
          x: 1228.974,
          y: 701.39
        },
        {
          x: 1221.596,
          y: 699.951
        },
        {
          x: 1213.935,
          y: 702.24
        },
        {
          x: 1204.572,
          y: 677.638
        },
        {
          x: 1205.357,
          y: 649.48
        },
        {
          x: 1182.421,
          y: 629.633
        },
        {
          x: 1178.085,
          y: 603.27
        },
        {
          x: 1170.435,
          y: 578.068
        },
        {
          x: 1184.805,
          y: 573.144
        },
        {
          x: 1200.779,
          y: 576.002
        },
        {
          x: 1216.331,
          y: 576.816
        },
        {
          x: 1228.997,
          y: 563.619
        },
        {
          x: 1244.225,
          y: 562.862
        },
        {
          x: 1245.457,
          y: 563.878
        },
        {
          x: 1247.478,
          y: 563.285
        },
        {
          x: 1248.631,
          y: 564.462
        },
        {
          x: 1249.668,
          y: 565.877
        }
      ],
      neighborIds: [
        "district:87",
        "district:88",
        "district:109",
        "district:111",
        "district:133",
        "district:134"
      ]
    },
    {
      id: "district:111",
      legacyId: 111,
      rowIndex: 4,
      columnIndex: 18,
      name: "District 111",
      zone: "commercial",
      polygon: [
        {
          x: 1349.602,
          y: 565.295
        },
        {
          x: 1340.555,
          y: 589.563
        },
        {
          x: 1343.061,
          y: 616.41
        },
        {
          x: 1341.314,
          y: 642.308
        },
        {
          x: 1323.386,
          y: 664.593
        },
        {
          x: 1321.653,
          y: 690.494
        },
        {
          x: 1317.696,
          y: 691.914
        },
        {
          x: 1314.632,
          y: 695.897
        },
        {
          x: 1308.783,
          y: 691.893
        },
        {
          x: 1305.736,
          y: 695.923
        },
        {
          x: 1301.805,
          y: 697.419
        },
        {
          x: 1296.34,
          y: 695.377
        },
        {
          x: 1290.723,
          y: 695.965
        },
        {
          x: 1285.045,
          y: 697.616
        },
        {
          x: 1279.436,
          y: 698.072
        },
        {
          x: 1273.983,
          y: 695.818
        },
        {
          x: 1263.906,
          y: 670.881
        },
        {
          x: 1267.57,
          y: 643.527
        },
        {
          x: 1259.136,
          y: 618.301
        },
        {
          x: 1250.64,
          y: 593.086
        },
        {
          x: 1251.201,
          y: 566.278
        },
        {
          x: 1267.342,
          y: 561.364
        },
        {
          x: 1284.197,
          y: 564.987
        },
        {
          x: 1300.962,
          y: 567.535
        },
        {
          x: 1316.618,
          y: 556.831
        },
        {
          x: 1333.385,
          y: 559.404
        },
        {
          x: 1336.759,
          y: 560.222
        },
        {
          x: 1339.666,
          y: 562.327
        },
        {
          x: 1342.492,
          y: 564.654
        },
        {
          x: 1346.533,
          y: 563.637
        }
      ],
      neighborIds: [
        "district:88",
        "district:89",
        "district:110",
        "district:112",
        "district:134",
        "district:135"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:112",
      legacyId: 112,
      rowIndex: 4,
      columnIndex: 19,
      name: "District 112",
      zone: "park",
      polygon: [
        {
          x: 1427.737,
          y: 571.942
        },
        {
          x: 1423.499,
          y: 599.041
        },
        {
          x: 1418.295,
          y: 625.823
        },
        {
          x: 1395.54,
          y: 646.865
        },
        {
          x: 1394.011,
          y: 674.85
        },
        {
          x: 1385.65,
          y: 700.6
        },
        {
          x: 1383.702,
          y: 700.324
        },
        {
          x: 1382.23,
          y: 701.448
        },
        {
          x: 1380.768,
          y: 702.601
        },
        {
          x: 1379.293,
          y: 703.715
        },
        {
          x: 1377.339,
          y: 703.422
        },
        {
          x: 1365.602,
          y: 703.421
        },
        {
          x: 1356.465,
          y: 692.219
        },
        {
          x: 1341.917,
          y: 704.327
        },
        {
          x: 1332.098,
          y: 696.063
        },
        {
          x: 1321.653,
          y: 690.494
        },
        {
          x: 1323.386,
          y: 664.593
        },
        {
          x: 1341.314,
          y: 642.308
        },
        {
          x: 1343.061,
          y: 616.41
        },
        {
          x: 1340.555,
          y: 589.563
        },
        {
          x: 1349.602,
          y: 565.295
        },
        {
          x: 1355.956,
          y: 564.192
        },
        {
          x: 1361.742,
          y: 560.72
        },
        {
          x: 1367.469,
          y: 557.002
        },
        {
          x: 1375.334,
          y: 562.201
        },
        {
          x: 1380.895,
          y: 557.792
        },
        {
          x: 1391.613,
          y: 556.155
        },
        {
          x: 1400.812,
          y: 559.543
        },
        {
          x: 1409.178,
          y: 565.692
        },
        {
          x: 1417.859,
          y: 570.799
        }
      ],
      neighborIds: [
        "district:89",
        "district:90",
        "district:111",
        "district:113",
        "district:135",
        "district:136"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:113",
      legacyId: 113,
      rowIndex: 4,
      columnIndex: 20,
      name: "District 113",
      zone: "commercial",
      polygon: [
        {
          x: 1385.65,
          y: 700.6
        },
        {
          x: 1394.011,
          y: 674.85
        },
        {
          x: 1395.54,
          y: 646.865
        },
        {
          x: 1418.295,
          y: 625.823
        },
        {
          x: 1423.499,
          y: 599.041
        },
        {
          x: 1427.737,
          y: 571.942
        },
        {
          x: 1431.67,
          y: 571.737
        },
        {
          x: 1435.503,
          y: 570.114
        },
        {
          x: 1439.334,
          y: 568.448
        },
        {
          x: 1443.563,
          y: 572.489
        },
        {
          x: 1447.376,
          y: 570.57
        },
        {
          x: 1449.468,
          y: 570.632
        },
        {
          x: 1450.76,
          y: 572.917
        },
        {
          x: 1452.871,
          y: 572.927
        },
        {
          x: 1454.814,
          y: 573.403
        },
        {
          x: 1456.736,
          y: 573.937
        },
        {
          x: 1461.728,
          y: 601.626
        },
        {
          x: 1462.648,
          y: 629.976
        },
        {
          x: 1463.266,
          y: 658.375
        },
        {
          x: 1479.639,
          y: 684.218
        },
        {
          x: 1479.255,
          y: 712.779
        },
        {
          x: 1479.213,
          y: 712.777
        },
        {
          x: 1479.174,
          y: 712.783
        },
        {
          x: 1479.144,
          y: 712.81
        },
        {
          x: 1479.117,
          y: 712.844
        },
        {
          x: 1479.079,
          y: 712.853
        },
        {
          x: 1459.637,
          y: 716.172
        },
        {
          x: 1441.847,
          y: 706.891
        },
        {
          x: 1423.673,
          y: 700.537
        },
        {
          x: 1405.054,
          y: 697.57
        }
      ],
      neighborIds: [
        "district:90",
        "district:91",
        "district:112",
        "district:114",
        "district:136"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:114",
      legacyId: 114,
      rowIndex: 4,
      columnIndex: 21,
      name: "District 114",
      zone: "industrial",
      polygon: [
        {
          x: 1531.564,
          y: 564.81
        },
        {
          x: 1532.753,
          y: 591.133
        },
        {
          x: 1538.969,
          y: 616.644
        },
        {
          x: 1547.035,
          y: 641.855
        },
        {
          x: 1552.495,
          y: 667.488
        },
        {
          x: 1552.46,
          y: 694.009
        },
        {
          x: 1544.74,
          y: 703.54
        },
        {
          x: 1532.085,
          y: 701.665
        },
        {
          x: 1520.579,
          y: 702.447
        },
        {
          x: 1510.404,
          y: 706.303
        },
        {
          x: 1502.58,
          y: 715.593
        },
        {
          x: 1497.86,
          y: 715.49
        },
        {
          x: 1492.795,
          y: 718.239
        },
        {
          x: 1488.894,
          y: 711.343
        },
        {
          x: 1483.886,
          y: 713.63
        },
        {
          x: 1479.255,
          y: 712.779
        },
        {
          x: 1479.639,
          y: 684.218
        },
        {
          x: 1463.266,
          y: 658.375
        },
        {
          x: 1462.648,
          y: 629.976
        },
        {
          x: 1461.728,
          y: 601.626
        },
        {
          x: 1456.736,
          y: 573.937
        },
        {
          x: 1472.366,
          y: 577.558
        },
        {
          x: 1486.869,
          y: 571.941
        },
        {
          x: 1501.358,
          y: 566.207
        },
        {
          x: 1515.889,
          y: 560.819
        }
      ],
      neighborIds: [
        "district:91",
        "district:113",
        "district:115",
        "district:137",
        "district:138"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:115",
      legacyId: 115,
      rowIndex: 4,
      columnIndex: 22,
      name: "District 115",
      zone: "residential",
      polygon: [
        {
          x: 1600,
          y: 551.831
        },
        {
          x: 1597.187,
          y: 581.787
        },
        {
          x: 1600,
          y: 611.742
        },
        {
          x: 1600,
          y: 641.698
        },
        {
          x: 1600,
          y: 671.654
        },
        {
          x: 1600,
          y: 701.609
        },
        {
          x: 1590.102,
          y: 702.527
        },
        {
          x: 1581.34,
          y: 696.343
        },
        {
          x: 1572.37,
          y: 691.454
        },
        {
          x: 1561.522,
          y: 698.317
        },
        {
          x: 1552.46,
          y: 694.009
        },
        {
          x: 1552.495,
          y: 667.488
        },
        {
          x: 1547.035,
          y: 641.855
        },
        {
          x: 1538.969,
          y: 616.644
        },
        {
          x: 1532.753,
          y: 591.133
        },
        {
          x: 1531.564,
          y: 564.81
        },
        {
          x: 1532.054,
          y: 564.134
        },
        {
          x: 1532.763,
          y: 563.774
        },
        {
          x: 1533.57,
          y: 563.555
        },
        {
          x: 1534.291,
          y: 563.214
        },
        {
          x: 1534.802,
          y: 562.568
        },
        {
          x: 1548.414,
          y: 563.898
        },
        {
          x: 1559.889,
          y: 552.247
        },
        {
          x: 1573.568,
          y: 553.984
        },
        {
          x: 1587.467,
          y: 557.052
        }
      ],
      neighborIds: [
        "district:91",
        "district:92",
        "district:114",
        "district:138"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:116",
      legacyId: 116,
      rowIndex: 5,
      columnIndex: 0,
      name: "District 116",
      zone: "park",
      polygon: [
        {
          x: 74.299,
          y: 716.094
        },
        {
          x: 60.833,
          y: 736.217
        },
        {
          x: 66.624,
          y: 763.441
        },
        {
          x: 54.787,
          y: 784.164
        },
        {
          x: 40.582,
          y: 804.014
        },
        {
          x: 33.578,
          y: 826.52
        },
        {
          x: 26.836,
          y: 827.216
        },
        {
          x: 20.05,
          y: 827.588
        },
        {
          x: 13.016,
          y: 826.107
        },
        {
          x: 7.049,
          y: 832.602
        },
        {
          x: 0,
          y: 831.008
        },
        {
          x: 2.26,
          y: 804.077
        },
        {
          x: 0,
          y: 777.146
        },
        {
          x: 0,
          y: 750.215
        },
        {
          x: 0,
          y: 723.284
        },
        {
          x: 0,
          y: 696.352
        },
        {
          x: 16.102,
          y: 695.624
        },
        {
          x: 27.857,
          y: 711.261
        },
        {
          x: 43.727,
          y: 711.404
        },
        {
          x: 59.537,
          y: 711.776
        }
      ],
      neighborIds: [
        "district:93",
        "district:117",
        "district:139"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:117",
      legacyId: 117,
      rowIndex: 5,
      columnIndex: 1,
      name: "District 117",
      zone: "residential",
      polygon: [
        {
          x: 33.578,
          y: 826.52
        },
        {
          x: 40.582,
          y: 804.014
        },
        {
          x: 54.787,
          y: 784.164
        },
        {
          x: 66.624,
          y: 763.441
        },
        {
          x: 60.833,
          y: 736.217
        },
        {
          x: 74.299,
          y: 716.094
        },
        {
          x: 76.068,
          y: 715.081
        },
        {
          x: 78.49,
          y: 716.261
        },
        {
          x: 80.191,
          y: 715.021
        },
        {
          x: 82,
          y: 714.146
        },
        {
          x: 83.808,
          y: 713.263
        },
        {
          x: 87.948,
          y: 715.952
        },
        {
          x: 92.17,
          y: 718.302
        },
        {
          x: 98.18,
          y: 713.252
        },
        {
          x: 101.963,
          y: 717.419
        },
        {
          x: 106.435,
          y: 718.734
        },
        {
          x: 116.685,
          y: 741.086
        },
        {
          x: 130.145,
          y: 762.162
        },
        {
          x: 125.208,
          y: 790.557
        },
        {
          x: 143.54,
          y: 809.694
        },
        {
          x: 151.827,
          y: 832.828
        },
        {
          x: 140.268,
          y: 840.095
        },
        {
          x: 125.275,
          y: 834.454
        },
        {
          x: 113.686,
          y: 841.609
        },
        {
          x: 101.32,
          y: 845.842
        },
        {
          x: 88.823,
          y: 849.583
        },
        {
          x: 79.002,
          y: 842.031
        },
        {
          x: 68.456,
          y: 836.212
        },
        {
          x: 55.89,
          y: 835.233
        },
        {
          x: 43.043,
          y: 834.929
        }
      ],
      neighborIds: [
        "district:93",
        "district:94",
        "district:116",
        "district:118",
        "district:139",
        "district:140"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:118",
      legacyId: 118,
      rowIndex: 5,
      columnIndex: 2,
      name: "District 118",
      zone: "park",
      polygon: [
        {
          x: 211.853,
          y: 702.799
        },
        {
          x: 201.04,
          y: 728.874
        },
        {
          x: 187.538,
          y: 754.152
        },
        {
          x: 194.032,
          y: 785.351
        },
        {
          x: 181.402,
          y: 810.888
        },
        {
          x: 172.002,
          y: 837.38
        },
        {
          x: 171.548,
          y: 837.391
        },
        {
          x: 171.101,
          y: 837.449
        },
        {
          x: 170.679,
          y: 837.674
        },
        {
          x: 170.185,
          y: 837.413
        },
        {
          x: 169.775,
          y: 837.715
        },
        {
          x: 166.637,
          y: 835.079
        },
        {
          x: 161.999,
          y: 837.949
        },
        {
          x: 158.756,
          y: 835.7
        },
        {
          x: 155.476,
          y: 833.586
        },
        {
          x: 151.827,
          y: 832.828
        },
        {
          x: 143.54,
          y: 809.694
        },
        {
          x: 125.208,
          y: 790.557
        },
        {
          x: 130.145,
          y: 762.162
        },
        {
          x: 116.685,
          y: 741.086
        },
        {
          x: 106.435,
          y: 718.734
        },
        {
          x: 118.971,
          y: 715.682
        },
        {
          x: 132.761,
          y: 715.341
        },
        {
          x: 137.926,
          y: 696.337
        },
        {
          x: 153.279,
          y: 699.378
        },
        {
          x: 163.9,
          y: 692.18
        },
        {
          x: 172.315,
          y: 696.425
        },
        {
          x: 181.405,
          y: 696.448
        },
        {
          x: 190.775,
          y: 694.724
        },
        {
          x: 198.865,
          y: 701.005
        },
        {
          x: 208.236,
          y: 699.27
        },
        {
          x: 209.331,
          y: 699.595
        },
        {
          x: 210.035,
          y: 700.321
        },
        {
          x: 210.508,
          y: 701.283
        },
        {
          x: 211.038,
          y: 702.187
        }
      ],
      neighborIds: [
        "district:94",
        "district:95",
        "district:96",
        "district:117",
        "district:119",
        "district:140",
        "district:141"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:119",
      legacyId: 119,
      rowIndex: 5,
      columnIndex: 3,
      name: "District 119",
      zone: "industrial",
      polygon: [
        {
          x: 172.002,
          y: 837.38
        },
        {
          x: 181.402,
          y: 810.888
        },
        {
          x: 194.032,
          y: 785.351
        },
        {
          x: 187.538,
          y: 754.152
        },
        {
          x: 201.04,
          y: 728.874
        },
        {
          x: 211.853,
          y: 702.799
        },
        {
          x: 218.792,
          y: 709.428
        },
        {
          x: 228.757,
          y: 705.748
        },
        {
          x: 236.086,
          y: 711.047
        },
        {
          x: 244.295,
          y: 713.351
        },
        {
          x: 252.753,
          y: 714.804
        },
        {
          x: 255.383,
          y: 737.927
        },
        {
          x: 254.62,
          y: 761.629
        },
        {
          x: 273.395,
          y: 781.998
        },
        {
          x: 267.505,
          y: 806.574
        },
        {
          x: 272.283,
          y: 829.331
        },
        {
          x: 271.116,
          y: 830.434
        },
        {
          x: 269.853,
          y: 831.415
        },
        {
          x: 268.242,
          y: 831.944
        },
        {
          x: 267.715,
          y: 833.875
        },
        {
          x: 265.961,
          y: 834.22
        },
        {
          x: 254.181,
          y: 837.344
        },
        {
          x: 240.997,
          y: 833.053
        },
        {
          x: 231.861,
          y: 850.136
        },
        {
          x: 218.429,
          y: 844.531
        },
        {
          x: 206.246,
          y: 845.528
        },
        {
          x: 200.22,
          y: 840.44
        },
        {
          x: 191.187,
          y: 847.989
        },
        {
          x: 184.916,
          y: 843.932
        },
        {
          x: 179.02,
          y: 838.298
        }
      ],
      neighborIds: [
        "district:96",
        "district:118",
        "district:120",
        "district:141",
        "district:142",
        "district:143"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:120",
      legacyId: 120,
      rowIndex: 5,
      columnIndex: 4,
      name: "District 120",
      zone: "commercial",
      polygon: [
        {
          x: 338.277,
          y: 713.038
        },
        {
          x: 337.85,
          y: 734.563
        },
        {
          x: 328.416,
          y: 755.36
        },
        {
          x: 330.608,
          y: 777.096
        },
        {
          x: 332.246,
          y: 798.789
        },
        {
          x: 329.618,
          y: 820.136
        },
        {
          x: 318.257,
          y: 822.638
        },
        {
          x: 305.714,
          y: 817.767
        },
        {
          x: 296.636,
          y: 834.5
        },
        {
          x: 283.921,
          y: 828.559
        },
        {
          x: 272.283,
          y: 829.331
        },
        {
          x: 267.505,
          y: 806.574
        },
        {
          x: 273.395,
          y: 781.998
        },
        {
          x: 254.62,
          y: 761.629
        },
        {
          x: 255.383,
          y: 737.927
        },
        {
          x: 252.753,
          y: 714.804
        },
        {
          x: 261.779,
          y: 715.34
        },
        {
          x: 268.537,
          y: 709.516
        },
        {
          x: 275.385,
          y: 703.944
        },
        {
          x: 285.396,
          y: 707.244
        },
        {
          x: 291.944,
          y: 700.83
        },
        {
          x: 300.213,
          y: 707.058
        },
        {
          x: 310.447,
          y: 705.826
        },
        {
          x: 320.579,
          y: 704.984
        },
        {
          x: 329.617,
          y: 708.295
        }
      ],
      neighborIds: [
        "district:96",
        "district:97",
        "district:119",
        "district:121",
        "district:143"
      ],
      spawnZones: [
        "west"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:121",
      legacyId: 121,
      rowIndex: 5,
      columnIndex: 5,
      name: "District 121",
      zone: "industrial",
      polygon: [
        {
          x: 407.937,
          y: 702.117
        },
        {
          x: 403.956,
          y: 730.407
        },
        {
          x: 407.536,
          y: 759.486
        },
        {
          x: 408.489,
          y: 788.291
        },
        {
          x: 394.662,
          y: 815.553
        },
        {
          x: 393.126,
          y: 844.098
        },
        {
          x: 392.857,
          y: 844.127
        },
        {
          x: 392.83,
          y: 844.528
        },
        {
          x: 392.581,
          y: 844.588
        },
        {
          x: 392.303,
          y: 844.602
        },
        {
          x: 392.115,
          y: 844.755
        },
        {
          x: 391.351,
          y: 845.204
        },
        {
          x: 390.498,
          y: 844.998
        },
        {
          x: 389.65,
          y: 844.82
        },
        {
          x: 388.925,
          y: 845.562
        },
        {
          x: 388.065,
          y: 845.302
        },
        {
          x: 377.298,
          y: 838.126
        },
        {
          x: 367.736,
          y: 828.153
        },
        {
          x: 350.081,
          y: 836.974
        },
        {
          x: 340.467,
          y: 827.12
        },
        {
          x: 329.618,
          y: 820.136
        },
        {
          x: 332.246,
          y: 798.789
        },
        {
          x: 330.608,
          y: 777.096
        },
        {
          x: 328.416,
          y: 755.36
        },
        {
          x: 337.85,
          y: 734.563
        },
        {
          x: 338.277,
          y: 713.038
        },
        {
          x: 345.358,
          y: 711.888
        },
        {
          x: 349.236,
          y: 703.338
        },
        {
          x: 356.597,
          y: 702.836
        },
        {
          x: 364.404,
          y: 703.363
        },
        {
          x: 370.19,
          y: 699.221
        },
        {
          x: 377.625,
          y: 701.287
        },
        {
          x: 385.48,
          y: 697.887
        },
        {
          x: 393.235,
          y: 695.791
        },
        {
          x: 400.654,
          y: 698.066
        }
      ],
      neighborIds: [
        "district:97",
        "district:98",
        "district:120",
        "district:122",
        "district:143",
        "district:144",
        "district:145"
      ]
    },
    {
      id: "district:122",
      legacyId: 122,
      rowIndex: 5,
      columnIndex: 6,
      name: "District 122",
      zone: "residential",
      polygon: [
        {
          x: 477.439,
          y: 709.942
        },
        {
          x: 473.317,
          y: 733.975
        },
        {
          x: 469.868,
          y: 758.123
        },
        {
          x: 469.677,
          y: 782.822
        },
        {
          x: 456.708,
          y: 805.358
        },
        {
          x: 457.08,
          y: 830.152
        },
        {
          x: 443.043,
          y: 827.226
        },
        {
          x: 433.393,
          y: 844.421
        },
        {
          x: 419.764,
          y: 843.364
        },
        {
          x: 405.62,
          y: 839.948
        },
        {
          x: 393.126,
          y: 844.098
        },
        {
          x: 394.662,
          y: 815.553
        },
        {
          x: 408.489,
          y: 788.291
        },
        {
          x: 407.536,
          y: 759.486
        },
        {
          x: 403.956,
          y: 730.407
        },
        {
          x: 407.937,
          y: 702.117
        },
        {
          x: 410.705,
          y: 701.554
        },
        {
          x: 412.804,
          y: 699.138
        },
        {
          x: 415.097,
          y: 697.26
        },
        {
          x: 417.969,
          y: 696.985
        },
        {
          x: 421.081,
          y: 697.381
        },
        {
          x: 433.575,
          y: 694.408
        },
        {
          x: 444.034,
          y: 700.568
        },
        {
          x: 454.449,
          y: 706.923
        },
        {
          x: 465.802,
          y: 709.068
        }
      ],
      neighborIds: [
        "district:98",
        "district:99",
        "district:121",
        "district:123",
        "district:145"
      ]
    },
    {
      id: "district:123",
      legacyId: 123,
      rowIndex: 5,
      columnIndex: 7,
      name: "District 123",
      zone: "commercial",
      polygon: [
        {
          x: 457.08,
          y: 830.152
        },
        {
          x: 456.708,
          y: 805.358
        },
        {
          x: 469.677,
          y: 782.822
        },
        {
          x: 469.868,
          y: 758.123
        },
        {
          x: 473.317,
          y: 733.975
        },
        {
          x: 477.439,
          y: 709.942
        },
        {
          x: 483.717,
          y: 709.042
        },
        {
          x: 488.071,
          y: 701.404
        },
        {
          x: 494.724,
          y: 701.82
        },
        {
          x: 501.151,
          y: 701.443
        },
        {
          x: 507.649,
          y: 701.317
        },
        {
          x: 512.109,
          y: 704.411
        },
        {
          x: 517.026,
          y: 704.932
        },
        {
          x: 522.187,
          y: 704.074
        },
        {
          x: 527.244,
          y: 703.809
        },
        {
          x: 531.929,
          y: 705.631
        },
        {
          x: 532.144,
          y: 732.675
        },
        {
          x: 545.478,
          y: 757.745
        },
        {
          x: 545.572,
          y: 784.808
        },
        {
          x: 548.512,
          y: 811.442
        },
        {
          x: 551.864,
          y: 838.014
        },
        {
          x: 541.794,
          y: 838.776
        },
        {
          x: 530.528,
          y: 833.632
        },
        {
          x: 523.405,
          y: 848.955
        },
        {
          x: 512.4,
          y: 845.102
        },
        {
          x: 502.753,
          y: 847.954
        },
        {
          x: 494.013,
          y: 843.381
        },
        {
          x: 482.387,
          y: 846.213
        },
        {
          x: 474.514,
          y: 839.416
        },
        {
          x: 466.478,
          y: 833.037
        }
      ],
      neighborIds: [
        "district:99",
        "district:100",
        "district:122",
        "district:124",
        "district:145",
        "district:146"
      ]
    },
    {
      id: "district:124",
      legacyId: 124,
      rowIndex: 5,
      columnIndex: 8,
      name: "District 124",
      zone: "industrial",
      polygon: [
        {
          x: 625.352,
          y: 714.647
        },
        {
          x: 618.91,
          y: 739.791
        },
        {
          x: 612.307,
          y: 764.902
        },
        {
          x: 603.289,
          y: 789.522
        },
        {
          x: 607.796,
          y: 816.89
        },
        {
          x: 599.55,
          y: 841.667
        },
        {
          x: 593.925,
          y: 843.955
        },
        {
          x: 587.432,
          y: 839.464
        },
        {
          x: 581.874,
          y: 842.273
        },
        {
          x: 576.43,
          y: 845.977
        },
        {
          x: 570.438,
          y: 845.396
        },
        {
          x: 566.917,
          y: 843.432
        },
        {
          x: 563.234,
          y: 841.875
        },
        {
          x: 558.996,
          y: 841.715
        },
        {
          x: 554.803,
          y: 841.443
        },
        {
          x: 551.864,
          y: 838.014
        },
        {
          x: 548.512,
          y: 811.442
        },
        {
          x: 545.572,
          y: 784.808
        },
        {
          x: 545.478,
          y: 757.745
        },
        {
          x: 532.144,
          y: 732.675
        },
        {
          x: 531.929,
          y: 705.631
        },
        {
          x: 534.842,
          y: 703.75
        },
        {
          x: 537.452,
          y: 701.026
        },
        {
          x: 542.18,
          y: 704.199
        },
        {
          x: 544.42,
          y: 700.444
        },
        {
          x: 547.821,
          y: 699.925
        },
        {
          x: 563.032,
          y: 704.425
        },
        {
          x: 579.09,
          y: 704.464
        },
        {
          x: 595.331,
          y: 703.54
        },
        {
          x: 610.913,
          y: 706.088
        }
      ],
      neighborIds: [
        "district:100",
        "district:101",
        "district:123",
        "district:125",
        "district:146",
        "district:147"
      ]
    },
    {
      id: "district:125",
      legacyId: 125,
      rowIndex: 5,
      columnIndex: 9,
      name: "District 125",
      zone: "park",
      polygon: [
        {
          x: 599.55,
          y: 841.667
        },
        {
          x: 607.796,
          y: 816.89
        },
        {
          x: 603.289,
          y: 789.522
        },
        {
          x: 612.307,
          y: 764.902
        },
        {
          x: 618.91,
          y: 739.791
        },
        {
          x: 625.352,
          y: 714.647
        },
        {
          x: 626.966,
          y: 714.51
        },
        {
          x: 628.699,
          y: 714.811
        },
        {
          x: 629.668,
          y: 712.305
        },
        {
          x: 631.562,
          y: 713.199
        },
        {
          x: 633.038,
          y: 712.555
        },
        {
          x: 642.839,
          y: 717.828
        },
        {
          x: 655.357,
          y: 710.859
        },
        {
          x: 664.991,
          y: 716.884
        },
        {
          x: 674.294,
          y: 724.404
        },
        {
          x: 685.32,
          y: 724.158
        },
        {
          x: 679.47,
          y: 745.843
        },
        {
          x: 682.362,
          y: 768.235
        },
        {
          x: 684.504,
          y: 790.567
        },
        {
          x: 673.716,
          y: 811.851
        },
        {
          x: 676.409,
          y: 834.228
        },
        {
          x: 664.095,
          y: 832.401
        },
        {
          x: 654.774,
          y: 842.51
        },
        {
          x: 644.576,
          y: 849.125
        },
        {
          x: 630.531,
          y: 840.393
        },
        {
          x: 620.635,
          y: 848.211
        },
        {
          x: 616.183,
          y: 847.659
        },
        {
          x: 612.67,
          y: 844.081
        },
        {
          x: 608.917,
          y: 841.278
        },
        {
          x: 603.484,
          y: 843.888
        }
      ],
      neighborIds: [
        "district:83",
        "district:101",
        "district:124",
        "district:126",
        "district:147",
        "district:148"
      ]
    },
    {
      id: "district:126",
      legacyId: 126,
      rowIndex: 5,
      columnIndex: 10,
      name: "District 126",
      zone: "residential",
      polygon: [
        {
          x: 676.409,
          y: 834.228
        },
        {
          x: 673.716,
          y: 811.851
        },
        {
          x: 684.504,
          y: 790.567
        },
        {
          x: 682.362,
          y: 768.235
        },
        {
          x: 679.47,
          y: 745.843
        },
        {
          x: 685.32,
          y: 724.158
        },
        {
          x: 692.981,
          y: 720.735
        },
        {
          x: 699.764,
          y: 714.776
        },
        {
          x: 706.695,
          y: 709.244
        },
        {
          x: 717.775,
          y: 715.702
        },
        {
          x: 724.817,
          y: 710.489
        },
        {
          x: 725.405,
          y: 710.506
        },
        {
          x: 725.917,
          y: 710.928
        },
        {
          x: 726.451,
          y: 711.238
        },
        {
          x: 727.049,
          y: 711.204
        },
        {
          x: 727.674,
          y: 711.027
        },
        {
          x: 739.677,
          y: 735.686
        },
        {
          x: 745.124,
          y: 763.49
        },
        {
          x: 770.588,
          y: 781.69
        },
        {
          x: 779.284,
          y: 807.935
        },
        {
          x: 786.989,
          y: 834.655
        },
        {
          x: 784.35,
          y: 835.612
        },
        {
          x: 783.538,
          y: 839.148
        },
        {
          x: 780.774,
          y: 839.929
        },
        {
          x: 777.78,
          y: 840.384
        },
        {
          x: 775.943,
          y: 842.474
        },
        {
          x: 765.938,
          y: 849.075
        },
        {
          x: 755.456,
          y: 853.364
        },
        {
          x: 743.76,
          y: 851.754
        },
        {
          x: 731.758,
          y: 848.664
        },
        {
          x: 721.431,
          y: 853.703
        },
        {
          x: 712.763,
          y: 849.029
        },
        {
          x: 700.291,
          y: 853.15
        },
        {
          x: 696.575,
          y: 837.03
        },
        {
          x: 685.894,
          y: 837.012
        }
      ],
      neighborIds: [
        "district:58",
        "district:83",
        "district:125",
        "district:127",
        "district:148",
        "district:149",
        "district:150"
      ]
    },
    {
      id: "district:127",
      legacyId: 127,
      rowIndex: 5,
      columnIndex: 11,
      name: "District 127",
      zone: "commercial",
      polygon: [
        {
          x: 851.704,
          y: 698.265
        },
        {
          x: 838.15,
          y: 723.817
        },
        {
          x: 837.298,
          y: 753.829
        },
        {
          x: 824.111,
          y: 779.51
        },
        {
          x: 810.118,
          y: 804.909
        },
        {
          x: 804.341,
          y: 833.191
        },
        {
          x: 800.925,
          y: 834.134
        },
        {
          x: 797.472,
          y: 834.622
        },
        {
          x: 793.897,
          y: 833.686
        },
        {
          x: 790.322,
          y: 832.733
        },
        {
          x: 786.989,
          y: 834.655
        },
        {
          x: 779.284,
          y: 807.935
        },
        {
          x: 770.588,
          y: 781.69
        },
        {
          x: 745.124,
          y: 763.49
        },
        {
          x: 739.677,
          y: 735.686
        },
        {
          x: 727.674,
          y: 711.027
        },
        {
          x: 737.695,
          y: 704.088
        },
        {
          x: 746.613,
          y: 694.439
        },
        {
          x: 763.32,
          y: 703.926
        },
        {
          x: 770.909,
          y: 691.012
        },
        {
          x: 782.774,
          y: 688.602
        },
        {
          x: 796.463,
          y: 684.621
        },
        {
          x: 809.109,
          y: 689.889
        },
        {
          x: 821.74,
          y: 695.276
        },
        {
          x: 834.865,
          y: 696.299
        },
        {
          x: 848.141,
          y: 695.979
        },
        {
          x: 849.022,
          y: 696.173
        },
        {
          x: 849.219,
          y: 697.435
        },
        {
          x: 850.093,
          y: 697.639
        },
        {
          x: 850.977,
          y: 697.83
        }
      ],
      neighborIds: [
        "district:57",
        "district:58",
        "district:59",
        "district:126",
        "district:128",
        "district:150"
      ]
    },
    {
      id: "district:128",
      legacyId: 128,
      rowIndex: 5,
      columnIndex: 12,
      name: "District 128",
      zone: "industrial",
      polygon: [
        {
          x: 905.099,
          y: 702.804
        },
        {
          x: 904.342,
          y: 730.645
        },
        {
          x: 906.882,
          y: 758.772
        },
        {
          x: 889.46,
          y: 785.173
        },
        {
          x: 892.721,
          y: 813.362
        },
        {
          x: 893.131,
          y: 841.304
        },
        {
          x: 892.44,
          y: 841.785
        },
        {
          x: 892.075,
          y: 842.713
        },
        {
          x: 890.72,
          y: 842.286
        },
        {
          x: 890.381,
          y: 843.249
        },
        {
          x: 889.731,
          y: 843.787
        },
        {
          x: 880.425,
          y: 847.168
        },
        {
          x: 870.976,
          y: 849.028
        },
        {
          x: 861.122,
          y: 846.538
        },
        {
          x: 851.224,
          y: 843.569
        },
        {
          x: 842.036,
          y: 848.234
        },
        {
          x: 833.456,
          y: 847.836
        },
        {
          x: 829.357,
          y: 836.205
        },
        {
          x: 820.752,
          y: 835.868
        },
        {
          x: 812.045,
          y: 835.786
        },
        {
          x: 804.341,
          y: 833.191
        },
        {
          x: 810.118,
          y: 804.909
        },
        {
          x: 824.111,
          y: 779.51
        },
        {
          x: 837.298,
          y: 753.829
        },
        {
          x: 838.15,
          y: 723.817
        },
        {
          x: 851.704,
          y: 698.265
        },
        {
          x: 862.129,
          y: 702.158
        },
        {
          x: 873.24,
          y: 697.98
        },
        {
          x: 884.241,
          y: 695.104
        },
        {
          x: 894.762,
          y: 697.866
        }
      ],
      neighborIds: [
        "district:59",
        "district:127",
        "district:129",
        "district:150",
        "district:151",
        "district:152"
      ]
    },
    {
      id: "district:129",
      legacyId: 129,
      rowIndex: 5,
      columnIndex: 13,
      name: "District 129",
      zone: "residential",
      polygon: [
        {
          x: 893.131,
          y: 841.304
        },
        {
          x: 892.721,
          y: 813.362
        },
        {
          x: 889.46,
          y: 785.173
        },
        {
          x: 906.882,
          y: 758.772
        },
        {
          x: 904.342,
          y: 730.645
        },
        {
          x: 905.099,
          y: 702.804
        },
        {
          x: 907.023,
          y: 701.175
        },
        {
          x: 909.346,
          y: 700.649
        },
        {
          x: 911.854,
          y: 700.632
        },
        {
          x: 913.661,
          y: 698.68
        },
        {
          x: 916.212,
          y: 698.782
        },
        {
          x: 921.724,
          y: 702.088
        },
        {
          x: 927.665,
          y: 702.371
        },
        {
          x: 933.821,
          y: 701.123
        },
        {
          x: 939.858,
          y: 700.725
        },
        {
          x: 945.527,
          y: 702.929
        },
        {
          x: 954.207,
          y: 728.411
        },
        {
          x: 956.126,
          y: 756.238
        },
        {
          x: 979.197,
          y: 776.73
        },
        {
          x: 984.873,
          y: 803.254
        },
        {
          x: 989.619,
          y: 830.101
        },
        {
          x: 970.328,
          y: 832.404
        },
        {
          x: 951.49,
          y: 838.594
        },
        {
          x: 932.646,
          y: 844.745
        },
        {
          x: 911.922,
          y: 834.699
        }
      ],
      neighborIds: [
        "district:59",
        "district:106",
        "district:128",
        "district:130",
        "district:152"
      ]
    },
    {
      id: "district:130",
      legacyId: 130,
      rowIndex: 5,
      columnIndex: 14,
      name: "District 130",
      zone: "industrial",
      polygon: [
        {
          x: 1049.683,
          y: 692.741
        },
        {
          x: 1043.284,
          y: 722.439
        },
        {
          x: 1044.283,
          y: 753.523
        },
        {
          x: 1023.868,
          y: 780.598
        },
        {
          x: 1026.117,
          y: 811.915
        },
        {
          x: 1021.742,
          y: 841.993
        },
        {
          x: 1020.895,
          y: 841.666
        },
        {
          x: 1020.202,
          y: 842.826
        },
        {
          x: 1019.368,
          y: 842.624
        },
        {
          x: 1018.515,
          y: 842.239
        },
        {
          x: 1017.719,
          y: 842.409
        },
        {
          x: 1013.133,
          y: 837.588
        },
        {
          x: 1004.809,
          y: 841.297
        },
        {
          x: 1000.061,
          y: 836.844
        },
        {
          x: 996.182,
          y: 830.41
        },
        {
          x: 989.619,
          y: 830.101
        },
        {
          x: 984.873,
          y: 803.254
        },
        {
          x: 979.197,
          y: 776.73
        },
        {
          x: 956.126,
          y: 756.238
        },
        {
          x: 954.207,
          y: 728.411
        },
        {
          x: 945.527,
          y: 702.929
        },
        {
          x: 956.951,
          y: 703.291
        },
        {
          x: 966.58,
          y: 698.601
        },
        {
          x: 975.347,
          y: 691.484
        },
        {
          x: 984.699,
          y: 686.013
        },
        {
          x: 995.675,
          y: 685.113
        },
        {
          x: 1006.038,
          y: 689.742
        },
        {
          x: 1016.028,
          y: 697.013
        },
        {
          x: 1028.901,
          y: 683.874
        },
        {
          x: 1039.055,
          y: 689.986
        }
      ],
      neighborIds: [
        "district:106",
        "district:107",
        "district:129",
        "district:131",
        "district:152",
        "district:153"
      ]
    },
    {
      id: "district:131",
      legacyId: 131,
      rowIndex: 5,
      columnIndex: 15,
      name: "District 131",
      zone: "park",
      polygon: [
        {
          x: 1075.56,
          y: 693.2
        },
        {
          x: 1082.195,
          y: 721.787
        },
        {
          x: 1100.954,
          y: 746.483
        },
        {
          x: 1106.141,
          y: 775.535
        },
        {
          x: 1109.392,
          y: 805.207
        },
        {
          x: 1120.24,
          y: 832.443
        },
        {
          x: 1118.365,
          y: 836.052
        },
        {
          x: 1112.685,
          y: 834.183
        },
        {
          x: 1110.457,
          y: 837.284
        },
        {
          x: 1108.675,
          y: 841.027
        },
        {
          x: 1105.463,
          y: 842.71
        },
        {
          x: 1093.844,
          y: 846.725
        },
        {
          x: 1081.683,
          y: 845.79
        },
        {
          x: 1069.339,
          y: 843.18
        },
        {
          x: 1057.303,
          y: 843.38
        },
        {
          x: 1045.885,
          y: 849.229
        },
        {
          x: 1040.586,
          y: 849.35
        },
        {
          x: 1035.381,
          y: 849.16
        },
        {
          x: 1032.517,
          y: 841.158
        },
        {
          x: 1026.681,
          y: 843.072
        },
        {
          x: 1021.742,
          y: 841.993
        },
        {
          x: 1026.117,
          y: 811.915
        },
        {
          x: 1023.868,
          y: 780.598
        },
        {
          x: 1044.283,
          y: 753.523
        },
        {
          x: 1043.284,
          y: 722.439
        },
        {
          x: 1049.683,
          y: 692.741
        },
        {
          x: 1050.922,
          y: 691.598
        },
        {
          x: 1052.519,
          y: 691.669
        },
        {
          x: 1054.121,
          y: 691.753
        },
        {
          x: 1055.254,
          y: 690.258
        },
        {
          x: 1056.93,
          y: 690.595
        },
        {
          x: 1060.384,
          y: 693.066
        },
        {
          x: 1064.648,
          y: 689.733
        },
        {
          x: 1068.19,
          y: 691.574
        },
        {
          x: 1071.77,
          y: 693.134
        }
      ],
      neighborIds: [
        "district:107",
        "district:108",
        "district:130",
        "district:132",
        "district:153",
        "district:154",
        "district:155"
      ]
    },
    {
      id: "district:132",
      legacyId: 132,
      rowIndex: 5,
      columnIndex: 16,
      name: "District 132",
      zone: "commercial",
      polygon: [
        {
          x: 1183.615,
          y: 716.506
        },
        {
          x: 1178.744,
          y: 738.351
        },
        {
          x: 1177.312,
          y: 761.123
        },
        {
          x: 1175.292,
          y: 783.737
        },
        {
          x: 1156.98,
          y: 801.958
        },
        {
          x: 1154.513,
          y: 824.452
        },
        {
          x: 1147.367,
          y: 824.8
        },
        {
          x: 1142.031,
          y: 832.911
        },
        {
          x: 1134.61,
          y: 832.081
        },
        {
          x: 1126.862,
          y: 829.847
        },
        {
          x: 1120.24,
          y: 832.443
        },
        {
          x: 1109.392,
          y: 805.207
        },
        {
          x: 1106.141,
          y: 775.535
        },
        {
          x: 1100.954,
          y: 746.483
        },
        {
          x: 1082.195,
          y: 721.787
        },
        {
          x: 1075.56,
          y: 693.2
        },
        {
          x: 1080.122,
          y: 693.378
        },
        {
          x: 1084.95,
          y: 694.557
        },
        {
          x: 1087.653,
          y: 687.711
        },
        {
          x: 1092.74,
          y: 689.872
        },
        {
          x: 1096.658,
          y: 687.615
        },
        {
          x: 1114.024,
          y: 693.469
        },
        {
          x: 1129.126,
          y: 706.138
        },
        {
          x: 1151.274,
          y: 697.601
        },
        {
          x: 1167.603,
          y: 706.574
        }
      ],
      neighborIds: [
        "district:108",
        "district:109",
        "district:131",
        "district:133",
        "district:155"
      ]
    },
    {
      id: "district:133",
      legacyId: 133,
      rowIndex: 5,
      columnIndex: 17,
      name: "District 133",
      zone: "residential",
      polygon: [
        {
          x: 1251.158,
          y: 705.057
        },
        {
          x: 1249.878,
          y: 731.046
        },
        {
          x: 1256.298,
          y: 757.035
        },
        {
          x: 1260.235,
          y: 783.023
        },
        {
          x: 1249.469,
          y: 809.012
        },
        {
          x: 1251.158,
          y: 835.001
        },
        {
          x: 1241.783,
          y: 842.28
        },
        {
          x: 1230.646,
          y: 839.532
        },
        {
          x: 1220.955,
          y: 845.01
        },
        {
          x: 1210.711,
          y: 847.346
        },
        {
          x: 1199.483,
          y: 844.079
        },
        {
          x: 1191.752,
          y: 837.26
        },
        {
          x: 1180.991,
          y: 837.384
        },
        {
          x: 1170.606,
          y: 836.645
        },
        {
          x: 1164.914,
          y: 825.152
        },
        {
          x: 1154.513,
          y: 824.452
        },
        {
          x: 1156.98,
          y: 801.958
        },
        {
          x: 1175.292,
          y: 783.737
        },
        {
          x: 1177.312,
          y: 761.123
        },
        {
          x: 1178.744,
          y: 738.351
        },
        {
          x: 1183.615,
          y: 716.506
        },
        {
          x: 1190.058,
          y: 714.459
        },
        {
          x: 1193.324,
          y: 705.659
        },
        {
          x: 1200.399,
          y: 704.954
        },
        {
          x: 1207.106,
          y: 703.467
        },
        {
          x: 1213.935,
          y: 702.24
        },
        {
          x: 1221.596,
          y: 699.951
        },
        {
          x: 1228.974,
          y: 701.39
        },
        {
          x: 1236.219,
          y: 704.591
        },
        {
          x: 1243.56,
          y: 706.532
        }
      ],
      neighborIds: [
        "district:109",
        "district:110",
        "district:132",
        "district:134",
        "district:155",
        "district:156"
      ]
    },
    {
      id: "district:134",
      legacyId: 134,
      rowIndex: 5,
      columnIndex: 18,
      name: "District 134",
      zone: "industrial",
      polygon: [
        {
          x: 1301.805,
          y: 697.419
        },
        {
          x: 1310.079,
          y: 723.054
        },
        {
          x: 1321.075,
          y: 748.138
        },
        {
          x: 1311.59,
          y: 777.361
        },
        {
          x: 1325.579,
          y: 801.841
        },
        {
          x: 1328.308,
          y: 828.596
        },
        {
          x: 1314.205,
          y: 831.756
        },
        {
          x: 1300.508,
          y: 838.276
        },
        {
          x: 1284.426,
          y: 825.021
        },
        {
          x: 1270.844,
          y: 832.497
        },
        {
          x: 1256.928,
          y: 837.204
        },
        {
          x: 1255.896,
          y: 836.445
        },
        {
          x: 1254.661,
          y: 836.216
        },
        {
          x: 1253.351,
          y: 836.185
        },
        {
          x: 1252.145,
          y: 835.881
        },
        {
          x: 1251.158,
          y: 835.001
        },
        {
          x: 1249.469,
          y: 809.012
        },
        {
          x: 1260.235,
          y: 783.023
        },
        {
          x: 1256.298,
          y: 757.035
        },
        {
          x: 1249.878,
          y: 731.046
        },
        {
          x: 1251.158,
          y: 705.057
        },
        {
          x: 1255.349,
          y: 702.284
        },
        {
          x: 1261.646,
          y: 704.717
        },
        {
          x: 1265.557,
          y: 701.252
        },
        {
          x: 1269.785,
          y: 698.572
        },
        {
          x: 1273.983,
          y: 695.818
        },
        {
          x: 1279.436,
          y: 698.072
        },
        {
          x: 1285.045,
          y: 697.616
        },
        {
          x: 1290.723,
          y: 695.965
        },
        {
          x: 1296.34,
          y: 695.377
        }
      ],
      neighborIds: [
        "district:110",
        "district:111",
        "district:133",
        "district:135",
        "district:156",
        "district:157"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:135",
      legacyId: 135,
      rowIndex: 5,
      columnIndex: 19,
      name: "District 135",
      zone: "residential",
      polygon: [
        {
          x: 1377.339,
          y: 703.422
        },
        {
          x: 1382.951,
          y: 730.693
        },
        {
          x: 1391.239,
          y: 757.736
        },
        {
          x: 1378.558,
          y: 786.567
        },
        {
          x: 1385.558,
          y: 813.72
        },
        {
          x: 1389.085,
          y: 841.169
        },
        {
          x: 1385.341,
          y: 841.521
        },
        {
          x: 1381.831,
          y: 843.285
        },
        {
          x: 1378.349,
          y: 845.212
        },
        {
          x: 1373.993,
          y: 841.885
        },
        {
          x: 1370.583,
          y: 844.249
        },
        {
          x: 1363.709,
          y: 836.849
        },
        {
          x: 1352.903,
          y: 840.067
        },
        {
          x: 1345.557,
          y: 833.94
        },
        {
          x: 1338.228,
          y: 827.768
        },
        {
          x: 1328.308,
          y: 828.596
        },
        {
          x: 1325.579,
          y: 801.841
        },
        {
          x: 1311.59,
          y: 777.361
        },
        {
          x: 1321.075,
          y: 748.138
        },
        {
          x: 1310.079,
          y: 723.054
        },
        {
          x: 1301.805,
          y: 697.419
        },
        {
          x: 1305.736,
          y: 695.923
        },
        {
          x: 1308.783,
          y: 691.893
        },
        {
          x: 1314.632,
          y: 695.897
        },
        {
          x: 1317.696,
          y: 691.914
        },
        {
          x: 1321.653,
          y: 690.494
        },
        {
          x: 1332.098,
          y: 696.063
        },
        {
          x: 1341.917,
          y: 704.327
        },
        {
          x: 1356.465,
          y: 692.219
        },
        {
          x: 1365.602,
          y: 703.421
        }
      ],
      neighborIds: [
        "district:111",
        "district:112",
        "district:134",
        "district:136",
        "district:157",
        "district:158"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:136",
      legacyId: 136,
      rowIndex: 5,
      columnIndex: 20,
      name: "District 136",
      zone: "commercial",
      polygon: [
        {
          x: 1479.079,
          y: 712.853
        },
        {
          x: 1470.072,
          y: 740.138
        },
        {
          x: 1452.328,
          y: 763.637
        },
        {
          x: 1444.563,
          y: 791.46
        },
        {
          x: 1435.567,
          y: 818.75
        },
        {
          x: 1422.197,
          y: 844.144
        },
        {
          x: 1419.294,
          y: 843.541
        },
        {
          x: 1416.473,
          y: 843.487
        },
        {
          x: 1413.863,
          y: 844.868
        },
        {
          x: 1411.3,
          y: 846.566
        },
        {
          x: 1408.429,
          y: 846.172
        },
        {
          x: 1404.448,
          y: 845.603
        },
        {
          x: 1401.455,
          y: 841.218
        },
        {
          x: 1396.228,
          y: 845.469
        },
        {
          x: 1392.805,
          y: 842.744
        },
        {
          x: 1389.085,
          y: 841.169
        },
        {
          x: 1385.558,
          y: 813.72
        },
        {
          x: 1378.558,
          y: 786.567
        },
        {
          x: 1391.239,
          y: 757.736
        },
        {
          x: 1382.951,
          y: 730.693
        },
        {
          x: 1377.339,
          y: 703.422
        },
        {
          x: 1379.293,
          y: 703.715
        },
        {
          x: 1380.768,
          y: 702.601
        },
        {
          x: 1382.23,
          y: 701.448
        },
        {
          x: 1383.702,
          y: 700.324
        },
        {
          x: 1385.65,
          y: 700.6
        },
        {
          x: 1405.054,
          y: 697.57
        },
        {
          x: 1423.673,
          y: 700.537
        },
        {
          x: 1441.847,
          y: 706.891
        },
        {
          x: 1459.637,
          y: 716.172
        }
      ],
      neighborIds: [
        "district:112",
        "district:113",
        "district:135",
        "district:137",
        "district:158",
        "district:159"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:137",
      legacyId: 137,
      rowIndex: 5,
      columnIndex: 21,
      name: "District 137",
      zone: "park",
      polygon: [
        {
          x: 1502.58,
          y: 715.593
        },
        {
          x: 1511.83,
          y: 738.223
        },
        {
          x: 1516.861,
          y: 762.306
        },
        {
          x: 1521.087,
          y: 786.666
        },
        {
          x: 1536.062,
          y: 807.325
        },
        {
          x: 1542.321,
          y: 830.985
        },
        {
          x: 1520.502,
          y: 829.262
        },
        {
          x: 1500.846,
          y: 839.92
        },
        {
          x: 1480.643,
          y: 847.445
        },
        {
          x: 1457.79,
          y: 839.801
        },
        {
          x: 1437.918,
          y: 849.221
        },
        {
          x: 1434.651,
          y: 848.586
        },
        {
          x: 1432.089,
          y: 845.766
        },
        {
          x: 1429.305,
          y: 843.636
        },
        {
          x: 1425.18,
          y: 845.656
        },
        {
          x: 1422.197,
          y: 844.144
        },
        {
          x: 1435.567,
          y: 818.75
        },
        {
          x: 1444.563,
          y: 791.46
        },
        {
          x: 1452.328,
          y: 763.637
        },
        {
          x: 1470.072,
          y: 740.138
        },
        {
          x: 1479.079,
          y: 712.853
        },
        {
          x: 1479.117,
          y: 712.844
        },
        {
          x: 1479.144,
          y: 712.81
        },
        {
          x: 1479.174,
          y: 712.783
        },
        {
          x: 1479.213,
          y: 712.777
        },
        {
          x: 1479.255,
          y: 712.779
        },
        {
          x: 1483.886,
          y: 713.63
        },
        {
          x: 1488.894,
          y: 711.343
        },
        {
          x: 1492.795,
          y: 718.239
        },
        {
          x: 1497.86,
          y: 715.49
        }
      ],
      neighborIds: [
        "district:114",
        "district:136",
        "district:138",
        "district:159",
        "district:160"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:138",
      legacyId: 138,
      rowIndex: 5,
      columnIndex: 22,
      name: "District 138",
      zone: "commercial",
      polygon: [
        {
          x: 1600,
          y: 701.609
        },
        {
          x: 1600,
          y: 727.043
        },
        {
          x: 1600,
          y: 752.478
        },
        {
          x: 1591.229,
          y: 777.912
        },
        {
          x: 1600,
          y: 803.346
        },
        {
          x: 1600,
          y: 828.781
        },
        {
          x: 1591.028,
          y: 833.762
        },
        {
          x: 1580.472,
          y: 827.265
        },
        {
          x: 1571.456,
          y: 831.931
        },
        {
          x: 1562.542,
          y: 837.335
        },
        {
          x: 1552.604,
          y: 835.318
        },
        {
          x: 1550.374,
          y: 834.864
        },
        {
          x: 1548.516,
          y: 833.524
        },
        {
          x: 1546.767,
          y: 831.928
        },
        {
          x: 1544.773,
          y: 830.913
        },
        {
          x: 1542.321,
          y: 830.985
        },
        {
          x: 1536.062,
          y: 807.325
        },
        {
          x: 1521.087,
          y: 786.666
        },
        {
          x: 1516.861,
          y: 762.306
        },
        {
          x: 1511.83,
          y: 738.223
        },
        {
          x: 1502.58,
          y: 715.593
        },
        {
          x: 1510.404,
          y: 706.303
        },
        {
          x: 1520.579,
          y: 702.447
        },
        {
          x: 1532.085,
          y: 701.665
        },
        {
          x: 1544.74,
          y: 703.54
        },
        {
          x: 1552.46,
          y: 694.009
        },
        {
          x: 1561.522,
          y: 698.317
        },
        {
          x: 1572.37,
          y: 691.454
        },
        {
          x: 1581.34,
          y: 696.343
        },
        {
          x: 1590.102,
          y: 702.527
        }
      ],
      neighborIds: [
        "district:114",
        "district:115",
        "district:137",
        "district:160",
        "district:161"
      ],
      spawnZones: [
        "east"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:139",
      legacyId: 139,
      rowIndex: 6,
      columnIndex: 0,
      name: "District 139",
      zone: "industrial",
      polygon: [
        {
          x: 88.823,
          y: 849.583
        },
        {
          x: 88.604,
          y: 876.282
        },
        {
          x: 71.995,
          y: 900.393
        },
        {
          x: 71.766,
          y: 927.091
        },
        {
          x: 71.848,
          y: 953.837
        },
        {
          x: 68.234,
          y: 980
        },
        {
          x: 54.587,
          y: 977.511
        },
        {
          x: 40.94,
          y: 980
        },
        {
          x: 27.293,
          y: 980
        },
        {
          x: 13.647,
          y: 977.921
        },
        {
          x: 0,
          y: 980
        },
        {
          x: 2.959,
          y: 950.202
        },
        {
          x: 0,
          y: 920.403
        },
        {
          x: 0,
          y: 890.605
        },
        {
          x: 3.368,
          y: 860.807
        },
        {
          x: 0,
          y: 831.008
        },
        {
          x: 7.049,
          y: 832.602
        },
        {
          x: 13.016,
          y: 826.107
        },
        {
          x: 20.05,
          y: 827.588
        },
        {
          x: 26.836,
          y: 827.216
        },
        {
          x: 33.578,
          y: 826.52
        },
        {
          x: 43.043,
          y: 834.929
        },
        {
          x: 55.89,
          y: 835.233
        },
        {
          x: 68.456,
          y: 836.212
        },
        {
          x: 79.002,
          y: 842.031
        }
      ],
      neighborIds: [
        "district:116",
        "district:117",
        "district:140"
      ],
      spawnZones: [
        "west",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:140",
      legacyId: 140,
      rowIndex: 6,
      columnIndex: 1,
      name: "District 140",
      zone: "commercial",
      polygon: [
        {
          x: 169.775,
          y: 837.715
        },
        {
          x: 167.359,
          y: 866.721
        },
        {
          x: 155.438,
          y: 893.943
        },
        {
          x: 153.968,
          y: 923.126
        },
        {
          x: 150.939,
          y: 952.016
        },
        {
          x: 143.079,
          y: 980
        },
        {
          x: 128.11,
          y: 974.578
        },
        {
          x: 113.141,
          y: 980
        },
        {
          x: 98.172,
          y: 979.1
        },
        {
          x: 83.203,
          y: 979.035
        },
        {
          x: 68.234,
          y: 980
        },
        {
          x: 71.848,
          y: 953.837
        },
        {
          x: 71.766,
          y: 927.091
        },
        {
          x: 71.995,
          y: 900.393
        },
        {
          x: 88.604,
          y: 876.282
        },
        {
          x: 88.823,
          y: 849.583
        },
        {
          x: 101.32,
          y: 845.842
        },
        {
          x: 113.686,
          y: 841.609
        },
        {
          x: 125.275,
          y: 834.454
        },
        {
          x: 140.268,
          y: 840.095
        },
        {
          x: 151.827,
          y: 832.828
        },
        {
          x: 155.476,
          y: 833.586
        },
        {
          x: 158.756,
          y: 835.7
        },
        {
          x: 161.999,
          y: 837.949
        },
        {
          x: 166.637,
          y: 835.079
        }
      ],
      neighborIds: [
        "district:117",
        "district:118",
        "district:139",
        "district:141"
      ],
      spawnZones: [
        "west",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:141",
      legacyId: 141,
      rowIndex: 6,
      columnIndex: 2,
      name: "District 141",
      zone: "park",
      polygon: [
        {
          x: 206.246,
          y: 845.528
        },
        {
          x: 210.384,
          y: 872.708
        },
        {
          x: 218.909,
          y: 898.987
        },
        {
          x: 228.293,
          y: 925.088
        },
        {
          x: 226.568,
          y: 953.474
        },
        {
          x: 233.889,
          y: 980
        },
        {
          x: 215.727,
          y: 980
        },
        {
          x: 197.565,
          y: 978.252
        },
        {
          x: 179.403,
          y: 974.316
        },
        {
          x: 161.241,
          y: 980
        },
        {
          x: 143.079,
          y: 980
        },
        {
          x: 150.939,
          y: 952.016
        },
        {
          x: 153.968,
          y: 923.126
        },
        {
          x: 155.438,
          y: 893.943
        },
        {
          x: 167.359,
          y: 866.721
        },
        {
          x: 169.775,
          y: 837.715
        },
        {
          x: 170.185,
          y: 837.413
        },
        {
          x: 170.679,
          y: 837.674
        },
        {
          x: 171.101,
          y: 837.449
        },
        {
          x: 171.548,
          y: 837.391
        },
        {
          x: 172.002,
          y: 837.38
        },
        {
          x: 179.02,
          y: 838.298
        },
        {
          x: 184.916,
          y: 843.932
        },
        {
          x: 191.187,
          y: 847.989
        },
        {
          x: 200.22,
          y: 840.44
        }
      ],
      neighborIds: [
        "district:118",
        "district:119",
        "district:140",
        "district:142"
      ],
      spawnZones: [
        "west",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:142",
      legacyId: 142,
      rowIndex: 6,
      columnIndex: 3,
      name: "District 142",
      zone: "residential",
      polygon: [
        {
          x: 308.313,
          y: 980
        },
        {
          x: 293.428,
          y: 980
        },
        {
          x: 278.543,
          y: 971.51
        },
        {
          x: 263.658,
          y: 975.447
        },
        {
          x: 248.773,
          y: 979.619
        },
        {
          x: 233.889,
          y: 980
        },
        {
          x: 226.568,
          y: 953.474
        },
        {
          x: 228.293,
          y: 925.088
        },
        {
          x: 218.909,
          y: 898.987
        },
        {
          x: 210.384,
          y: 872.708
        },
        {
          x: 206.246,
          y: 845.528
        },
        {
          x: 218.429,
          y: 844.531
        },
        {
          x: 231.861,
          y: 850.136
        },
        {
          x: 240.997,
          y: 833.053
        },
        {
          x: 254.181,
          y: 837.344
        },
        {
          x: 265.961,
          y: 834.22
        },
        {
          x: 277.813,
          y: 862.393
        },
        {
          x: 281.449,
          y: 892.954
        },
        {
          x: 286.139,
          y: 923.208
        },
        {
          x: 296.215,
          y: 951.898
        }
      ],
      neighborIds: [
        "district:119",
        "district:141",
        "district:143"
      ],
      spawnZones: [
        "west",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:143",
      legacyId: 143,
      rowIndex: 6,
      columnIndex: 4,
      name: "District 143",
      zone: "park",
      polygon: [
        {
          x: 388.065,
          y: 845.302
        },
        {
          x: 376.224,
          y: 873.119
        },
        {
          x: 356.096,
          y: 896.759
        },
        {
          x: 346.028,
          y: 925.471
        },
        {
          x: 335.111,
          y: 953.754
        },
        {
          x: 320.153,
          y: 980
        },
        {
          x: 317.785,
          y: 980
        },
        {
          x: 315.417,
          y: 978.339
        },
        {
          x: 313.049,
          y: 979.178
        },
        {
          x: 310.681,
          y: 980
        },
        {
          x: 308.313,
          y: 980
        },
        {
          x: 296.215,
          y: 951.898
        },
        {
          x: 286.139,
          y: 923.208
        },
        {
          x: 281.449,
          y: 892.954
        },
        {
          x: 277.813,
          y: 862.393
        },
        {
          x: 265.961,
          y: 834.22
        },
        {
          x: 267.715,
          y: 833.875
        },
        {
          x: 268.242,
          y: 831.944
        },
        {
          x: 269.853,
          y: 831.415
        },
        {
          x: 271.116,
          y: 830.434
        },
        {
          x: 272.283,
          y: 829.331
        },
        {
          x: 283.921,
          y: 828.559
        },
        {
          x: 296.636,
          y: 834.5
        },
        {
          x: 305.714,
          y: 817.767
        },
        {
          x: 318.257,
          y: 822.638
        },
        {
          x: 329.618,
          y: 820.136
        },
        {
          x: 340.467,
          y: 827.12
        },
        {
          x: 350.081,
          y: 836.974
        },
        {
          x: 367.736,
          y: 828.153
        },
        {
          x: 377.298,
          y: 838.126
        }
      ],
      neighborIds: [
        "district:119",
        "district:120",
        "district:121",
        "district:142",
        "district:144"
      ],
      spawnZones: [
        "west",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:144",
      legacyId: 144,
      rowIndex: 6,
      columnIndex: 5,
      name: "District 144",
      zone: "industrial",
      polygon: [
        {
          x: 460.247,
          y: 980
        },
        {
          x: 432.228,
          y: 976.644
        },
        {
          x: 404.209,
          y: 978.506
        },
        {
          x: 376.191,
          y: 980
        },
        {
          x: 348.172,
          y: 980
        },
        {
          x: 320.153,
          y: 980
        },
        {
          x: 335.111,
          y: 953.754
        },
        {
          x: 346.028,
          y: 925.471
        },
        {
          x: 356.096,
          y: 896.759
        },
        {
          x: 376.224,
          y: 873.119
        },
        {
          x: 388.065,
          y: 845.302
        },
        {
          x: 388.925,
          y: 845.562
        },
        {
          x: 389.65,
          y: 844.82
        },
        {
          x: 390.498,
          y: 844.998
        },
        {
          x: 391.351,
          y: 845.204
        },
        {
          x: 392.115,
          y: 844.755
        },
        {
          x: 403.449,
          y: 872.959
        },
        {
          x: 426.206,
          y: 895.408
        },
        {
          x: 436.316,
          y: 924.228
        },
        {
          x: 448.308,
          y: 952.101
        }
      ],
      neighborIds: [
        "district:121",
        "district:143",
        "district:145"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:145",
      legacyId: 145,
      rowIndex: 6,
      columnIndex: 6,
      name: "District 145",
      zone: "park",
      polygon: [
        {
          x: 502.753,
          y: 847.954
        },
        {
          x: 495.063,
          y: 873.84
        },
        {
          x: 498.776,
          y: 901.815
        },
        {
          x: 479.101,
          y: 925.507
        },
        {
          x: 480.149,
          y: 952.994
        },
        {
          x: 478.569,
          y: 980
        },
        {
          x: 474.904,
          y: 980
        },
        {
          x: 471.24,
          y: 980
        },
        {
          x: 467.576,
          y: 980
        },
        {
          x: 463.911,
          y: 978.592
        },
        {
          x: 460.247,
          y: 980
        },
        {
          x: 448.308,
          y: 952.101
        },
        {
          x: 436.316,
          y: 924.228
        },
        {
          x: 426.206,
          y: 895.408
        },
        {
          x: 403.449,
          y: 872.959
        },
        {
          x: 392.115,
          y: 844.755
        },
        {
          x: 392.303,
          y: 844.602
        },
        {
          x: 392.581,
          y: 844.588
        },
        {
          x: 392.83,
          y: 844.528
        },
        {
          x: 392.857,
          y: 844.127
        },
        {
          x: 393.126,
          y: 844.098
        },
        {
          x: 405.62,
          y: 839.948
        },
        {
          x: 419.764,
          y: 843.364
        },
        {
          x: 433.393,
          y: 844.421
        },
        {
          x: 443.043,
          y: 827.226
        },
        {
          x: 457.08,
          y: 830.152
        },
        {
          x: 466.478,
          y: 833.037
        },
        {
          x: 474.514,
          y: 839.416
        },
        {
          x: 482.387,
          y: 846.213
        },
        {
          x: 494.013,
          y: 843.381
        }
      ],
      neighborIds: [
        "district:121",
        "district:122",
        "district:123",
        "district:144",
        "district:146"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:146",
      legacyId: 146,
      rowIndex: 6,
      columnIndex: 7,
      name: "District 146",
      zone: "commercial",
      polygon: [
        {
          x: 558.742,
          y: 980
        },
        {
          x: 542.707,
          y: 980
        },
        {
          x: 526.672,
          y: 979.93
        },
        {
          x: 510.638,
          y: 980
        },
        {
          x: 494.603,
          y: 980
        },
        {
          x: 478.569,
          y: 980
        },
        {
          x: 480.149,
          y: 952.994
        },
        {
          x: 479.101,
          y: 925.507
        },
        {
          x: 498.776,
          y: 901.815
        },
        {
          x: 495.063,
          y: 873.84
        },
        {
          x: 502.753,
          y: 847.954
        },
        {
          x: 512.4,
          y: 845.102
        },
        {
          x: 523.405,
          y: 848.955
        },
        {
          x: 530.528,
          y: 833.632
        },
        {
          x: 541.794,
          y: 838.776
        },
        {
          x: 551.864,
          y: 838.014
        },
        {
          x: 554.803,
          y: 841.443
        },
        {
          x: 558.996,
          y: 841.715
        },
        {
          x: 563.234,
          y: 841.875
        },
        {
          x: 566.917,
          y: 843.432
        },
        {
          x: 570.438,
          y: 845.396
        },
        {
          x: 568.394,
          y: 872.342
        },
        {
          x: 559.053,
          y: 898.655
        },
        {
          x: 571.742,
          y: 926.881
        },
        {
          x: 561.784,
          y: 953.14
        }
      ],
      neighborIds: [
        "district:123",
        "district:124",
        "district:145",
        "district:147"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:147",
      legacyId: 147,
      rowIndex: 6,
      columnIndex: 8,
      name: "District 147",
      zone: "residential",
      polygon: [
        {
          x: 620.635,
          y: 848.211
        },
        {
          x: 630.32,
          y: 873.9
        },
        {
          x: 627.691,
          y: 902.981
        },
        {
          x: 638.745,
          y: 928.293
        },
        {
          x: 651.7,
          y: 953.083
        },
        {
          x: 656.926,
          y: 980
        },
        {
          x: 637.289,
          y: 978.603
        },
        {
          x: 617.652,
          y: 978.401
        },
        {
          x: 598.015,
          y: 980
        },
        {
          x: 578.379,
          y: 974.146
        },
        {
          x: 558.742,
          y: 980
        },
        {
          x: 561.784,
          y: 953.14
        },
        {
          x: 571.742,
          y: 926.881
        },
        {
          x: 559.053,
          y: 898.655
        },
        {
          x: 568.394,
          y: 872.342
        },
        {
          x: 570.438,
          y: 845.396
        },
        {
          x: 576.43,
          y: 845.977
        },
        {
          x: 581.874,
          y: 842.273
        },
        {
          x: 587.432,
          y: 839.464
        },
        {
          x: 593.925,
          y: 843.955
        },
        {
          x: 599.55,
          y: 841.667
        },
        {
          x: 603.484,
          y: 843.888
        },
        {
          x: 608.917,
          y: 841.278
        },
        {
          x: 612.67,
          y: 844.081
        },
        {
          x: 616.183,
          y: 847.659
        }
      ],
      neighborIds: [
        "district:124",
        "district:125",
        "district:146",
        "district:148"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:148",
      legacyId: 148,
      rowIndex: 6,
      columnIndex: 9,
      name: "District 148",
      zone: "commercial",
      polygon: [
        {
          x: 721.431,
          y: 853.703
        },
        {
          x: 716.862,
          y: 879.519
        },
        {
          x: 700.07,
          y: 902.105
        },
        {
          x: 697.2,
          y: 928.37
        },
        {
          x: 696.439,
          y: 955.193
        },
        {
          x: 688.053,
          y: 980
        },
        {
          x: 681.827,
          y: 980
        },
        {
          x: 675.602,
          y: 980
        },
        {
          x: 669.377,
          y: 980
        },
        {
          x: 663.151,
          y: 979.007
        },
        {
          x: 656.926,
          y: 980
        },
        {
          x: 651.7,
          y: 953.083
        },
        {
          x: 638.745,
          y: 928.293
        },
        {
          x: 627.691,
          y: 902.981
        },
        {
          x: 630.32,
          y: 873.9
        },
        {
          x: 620.635,
          y: 848.211
        },
        {
          x: 630.531,
          y: 840.393
        },
        {
          x: 644.576,
          y: 849.125
        },
        {
          x: 654.774,
          y: 842.51
        },
        {
          x: 664.095,
          y: 832.401
        },
        {
          x: 676.409,
          y: 834.228
        },
        {
          x: 685.894,
          y: 837.012
        },
        {
          x: 696.575,
          y: 837.03
        },
        {
          x: 700.291,
          y: 853.15
        },
        {
          x: 712.763,
          y: 849.029
        }
      ],
      neighborIds: [
        "district:125",
        "district:126",
        "district:147",
        "district:149"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:149",
      legacyId: 149,
      rowIndex: 6,
      columnIndex: 10,
      name: "District 149",
      zone: "industrial",
      polygon: [
        {
          x: 775.943,
          y: 842.474
        },
        {
          x: 777.327,
          y: 869.979
        },
        {
          x: 785.393,
          y: 897.484
        },
        {
          x: 770.308,
          y: 924.989
        },
        {
          x: 776.917,
          y: 952.495
        },
        {
          x: 775.943,
          y: 980
        },
        {
          x: 758.365,
          y: 974.58
        },
        {
          x: 740.787,
          y: 970.568
        },
        {
          x: 723.209,
          y: 980
        },
        {
          x: 705.631,
          y: 979.037
        },
        {
          x: 688.053,
          y: 980
        },
        {
          x: 696.439,
          y: 955.193
        },
        {
          x: 697.2,
          y: 928.37
        },
        {
          x: 700.07,
          y: 902.105
        },
        {
          x: 716.862,
          y: 879.519
        },
        {
          x: 721.431,
          y: 853.703
        },
        {
          x: 731.758,
          y: 848.664
        },
        {
          x: 743.76,
          y: 851.754
        },
        {
          x: 755.456,
          y: 853.364
        },
        {
          x: 765.938,
          y: 849.075
        }
      ],
      neighborIds: [
        "district:126",
        "district:148",
        "district:150"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:150",
      legacyId: 150,
      rowIndex: 6,
      columnIndex: 11,
      name: "District 150",
      zone: "park",
      polygon: [
        {
          x: 842.036,
          y: 848.234
        },
        {
          x: 838.913,
          y: 874.587
        },
        {
          x: 844.194,
          y: 900.94
        },
        {
          x: 848.13,
          y: 927.293
        },
        {
          x: 838.504,
          y: 953.647
        },
        {
          x: 842.036,
          y: 980
        },
        {
          x: 828.818,
          y: 977.925
        },
        {
          x: 815.599,
          y: 980
        },
        {
          x: 802.381,
          y: 980
        },
        {
          x: 789.162,
          y: 980
        },
        {
          x: 775.943,
          y: 980
        },
        {
          x: 776.917,
          y: 952.495
        },
        {
          x: 770.308,
          y: 924.989
        },
        {
          x: 785.393,
          y: 897.484
        },
        {
          x: 777.327,
          y: 869.979
        },
        {
          x: 775.943,
          y: 842.474
        },
        {
          x: 777.78,
          y: 840.384
        },
        {
          x: 780.774,
          y: 839.929
        },
        {
          x: 783.538,
          y: 839.148
        },
        {
          x: 784.35,
          y: 835.612
        },
        {
          x: 786.989,
          y: 834.655
        },
        {
          x: 790.322,
          y: 832.733
        },
        {
          x: 793.897,
          y: 833.686
        },
        {
          x: 797.472,
          y: 834.622
        },
        {
          x: 800.925,
          y: 834.134
        },
        {
          x: 804.341,
          y: 833.191
        },
        {
          x: 812.045,
          y: 835.786
        },
        {
          x: 820.752,
          y: 835.868
        },
        {
          x: 829.357,
          y: 836.205
        },
        {
          x: 833.456,
          y: 847.836
        }
      ],
      neighborIds: [
        "district:126",
        "district:127",
        "district:128",
        "district:149",
        "district:151"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:151",
      legacyId: 151,
      rowIndex: 6,
      columnIndex: 12,
      name: "District 151",
      zone: "residential",
      polygon: [
        {
          x: 939.691,
          y: 980
        },
        {
          x: 920.16,
          y: 977.366
        },
        {
          x: 900.629,
          y: 976.4
        },
        {
          x: 881.098,
          y: 980
        },
        {
          x: 861.567,
          y: 980
        },
        {
          x: 842.036,
          y: 980
        },
        {
          x: 838.504,
          y: 953.647
        },
        {
          x: 848.13,
          y: 927.293
        },
        {
          x: 844.194,
          y: 900.94
        },
        {
          x: 838.913,
          y: 874.587
        },
        {
          x: 842.036,
          y: 848.234
        },
        {
          x: 851.224,
          y: 843.569
        },
        {
          x: 861.122,
          y: 846.538
        },
        {
          x: 870.976,
          y: 849.028
        },
        {
          x: 880.425,
          y: 847.168
        },
        {
          x: 889.731,
          y: 843.787
        },
        {
          x: 904.542,
          y: 869.262
        },
        {
          x: 910.742,
          y: 897.896
        },
        {
          x: 917.038,
          y: 926.494
        },
        {
          x: 927.665,
          y: 953.503
        }
      ],
      neighborIds: [
        "district:128",
        "district:150",
        "district:152"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:152",
      legacyId: 152,
      rowIndex: 6,
      columnIndex: 13,
      name: "District 152",
      zone: "commercial",
      polygon: [
        {
          x: 1017.719,
          y: 842.409
        },
        {
          x: 1000.352,
          y: 868.234
        },
        {
          x: 990.676,
          y: 897.984
        },
        {
          x: 980.133,
          y: 927.292
        },
        {
          x: 957.842,
          y: 950.602
        },
        {
          x: 947.476,
          y: 980
        },
        {
          x: 945.919,
          y: 979.879
        },
        {
          x: 944.362,
          y: 979.897
        },
        {
          x: 942.805,
          y: 980
        },
        {
          x: 941.248,
          y: 979.255
        },
        {
          x: 939.691,
          y: 980
        },
        {
          x: 927.665,
          y: 953.503
        },
        {
          x: 917.038,
          y: 926.494
        },
        {
          x: 910.742,
          y: 897.896
        },
        {
          x: 904.542,
          y: 869.262
        },
        {
          x: 889.731,
          y: 843.787
        },
        {
          x: 890.381,
          y: 843.249
        },
        {
          x: 890.72,
          y: 842.286
        },
        {
          x: 892.075,
          y: 842.713
        },
        {
          x: 892.44,
          y: 841.785
        },
        {
          x: 893.131,
          y: 841.304
        },
        {
          x: 911.922,
          y: 834.699
        },
        {
          x: 932.646,
          y: 844.745
        },
        {
          x: 951.49,
          y: 838.594
        },
        {
          x: 970.328,
          y: 832.404
        },
        {
          x: 989.619,
          y: 830.101
        },
        {
          x: 996.182,
          y: 830.41
        },
        {
          x: 1000.061,
          y: 836.844
        },
        {
          x: 1004.809,
          y: 841.297
        },
        {
          x: 1013.133,
          y: 837.588
        }
      ],
      neighborIds: [
        "district:128",
        "district:129",
        "district:130",
        "district:151",
        "district:153"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:153",
      legacyId: 153,
      rowIndex: 6,
      columnIndex: 14,
      name: "District 153",
      zone: "industrial",
      polygon: [
        {
          x: 1045.885,
          y: 849.229
        },
        {
          x: 1047.289,
          y: 875.505
        },
        {
          x: 1045.241,
          y: 902.127
        },
        {
          x: 1062.871,
          y: 926.777
        },
        {
          x: 1059.587,
          y: 953.523
        },
        {
          x: 1058.99,
          y: 980
        },
        {
          x: 1036.687,
          y: 980
        },
        {
          x: 1014.385,
          y: 972.716
        },
        {
          x: 992.082,
          y: 976.653
        },
        {
          x: 969.779,
          y: 980
        },
        {
          x: 947.476,
          y: 980
        },
        {
          x: 957.842,
          y: 950.602
        },
        {
          x: 980.133,
          y: 927.292
        },
        {
          x: 990.676,
          y: 897.984
        },
        {
          x: 1000.352,
          y: 868.234
        },
        {
          x: 1017.719,
          y: 842.409
        },
        {
          x: 1018.515,
          y: 842.239
        },
        {
          x: 1019.368,
          y: 842.624
        },
        {
          x: 1020.202,
          y: 842.826
        },
        {
          x: 1020.895,
          y: 841.666
        },
        {
          x: 1021.742,
          y: 841.993
        },
        {
          x: 1026.681,
          y: 843.072
        },
        {
          x: 1032.517,
          y: 841.158
        },
        {
          x: 1035.381,
          y: 849.16
        },
        {
          x: 1040.586,
          y: 849.35
        }
      ],
      neighborIds: [
        "district:130",
        "district:131",
        "district:152",
        "district:154"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:154",
      legacyId: 154,
      rowIndex: 6,
      columnIndex: 15,
      name: "District 154",
      zone: "residential",
      polygon: [
        {
          x: 1140.471,
          y: 980
        },
        {
          x: 1124.175,
          y: 977.58
        },
        {
          x: 1107.879,
          y: 980
        },
        {
          x: 1091.583,
          y: 980
        },
        {
          x: 1075.287,
          y: 977.989
        },
        {
          x: 1058.99,
          y: 980
        },
        {
          x: 1059.587,
          y: 953.523
        },
        {
          x: 1062.871,
          y: 926.777
        },
        {
          x: 1045.241,
          y: 902.127
        },
        {
          x: 1047.289,
          y: 875.505
        },
        {
          x: 1045.885,
          y: 849.229
        },
        {
          x: 1057.303,
          y: 843.38
        },
        {
          x: 1069.339,
          y: 843.18
        },
        {
          x: 1081.683,
          y: 845.79
        },
        {
          x: 1093.844,
          y: 846.725
        },
        {
          x: 1105.463,
          y: 842.71
        },
        {
          x: 1117.177,
          y: 868.967
        },
        {
          x: 1123.276,
          y: 896.655
        },
        {
          x: 1126.463,
          y: 925.085
        },
        {
          x: 1138.578,
          y: 951.239
        }
      ],
      neighborIds: [
        "district:131",
        "district:153",
        "district:155"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:155",
      legacyId: 155,
      rowIndex: 6,
      columnIndex: 16,
      name: "District 155",
      zone: "industrial",
      polygon: [
        {
          x: 1199.483,
          y: 844.079
        },
        {
          x: 1201.945,
          y: 871.263
        },
        {
          x: 1199.53,
          y: 898.447
        },
        {
          x: 1195.593,
          y: 925.632
        },
        {
          x: 1202.354,
          y: 952.816
        },
        {
          x: 1199.483,
          y: 980
        },
        {
          x: 1187.681,
          y: 980
        },
        {
          x: 1175.878,
          y: 978.453
        },
        {
          x: 1164.076,
          y: 974.517
        },
        {
          x: 1152.273,
          y: 974.178
        },
        {
          x: 1140.471,
          y: 980
        },
        {
          x: 1138.578,
          y: 951.239
        },
        {
          x: 1126.463,
          y: 925.085
        },
        {
          x: 1123.276,
          y: 896.655
        },
        {
          x: 1117.177,
          y: 868.967
        },
        {
          x: 1105.463,
          y: 842.71
        },
        {
          x: 1108.675,
          y: 841.027
        },
        {
          x: 1110.457,
          y: 837.284
        },
        {
          x: 1112.685,
          y: 834.183
        },
        {
          x: 1118.365,
          y: 836.052
        },
        {
          x: 1120.24,
          y: 832.443
        },
        {
          x: 1126.862,
          y: 829.847
        },
        {
          x: 1134.61,
          y: 832.081
        },
        {
          x: 1142.031,
          y: 832.911
        },
        {
          x: 1147.367,
          y: 824.8
        },
        {
          x: 1154.513,
          y: 824.452
        },
        {
          x: 1164.914,
          y: 825.152
        },
        {
          x: 1170.606,
          y: 836.645
        },
        {
          x: 1180.991,
          y: 837.384
        },
        {
          x: 1191.752,
          y: 837.26
        }
      ],
      neighborIds: [
        "district:131",
        "district:132",
        "district:133",
        "district:154",
        "district:156"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:156",
      legacyId: 156,
      rowIndex: 6,
      columnIndex: 17,
      name: "District 156",
      zone: "park",
      polygon: [
        {
          x: 1256.928,
          y: 837.204
        },
        {
          x: 1267.201,
          y: 864.861
        },
        {
          x: 1268.746,
          y: 894.324
        },
        {
          x: 1270.803,
          y: 923.681
        },
        {
          x: 1285.338,
          y: 950.455
        },
        {
          x: 1286.488,
          y: 980
        },
        {
          x: 1269.087,
          y: 980
        },
        {
          x: 1251.686,
          y: 980
        },
        {
          x: 1234.285,
          y: 980
        },
        {
          x: 1216.884,
          y: 977.345
        },
        {
          x: 1199.483,
          y: 980
        },
        {
          x: 1202.354,
          y: 952.816
        },
        {
          x: 1195.593,
          y: 925.632
        },
        {
          x: 1199.53,
          y: 898.447
        },
        {
          x: 1201.945,
          y: 871.263
        },
        {
          x: 1199.483,
          y: 844.079
        },
        {
          x: 1210.711,
          y: 847.346
        },
        {
          x: 1220.955,
          y: 845.01
        },
        {
          x: 1230.646,
          y: 839.532
        },
        {
          x: 1241.783,
          y: 842.28
        },
        {
          x: 1251.158,
          y: 835.001
        },
        {
          x: 1252.145,
          y: 835.881
        },
        {
          x: 1253.351,
          y: 836.185
        },
        {
          x: 1254.661,
          y: 836.216
        },
        {
          x: 1255.896,
          y: 836.445
        }
      ],
      neighborIds: [
        "district:133",
        "district:134",
        "district:155",
        "district:157"
      ],
      spawnZones: [
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:157",
      legacyId: 157,
      rowIndex: 6,
      columnIndex: 18,
      name: "District 157",
      zone: "commercial",
      polygon: [
        {
          x: 1370.583,
          y: 844.249
        },
        {
          x: 1356.243,
          y: 871.294
        },
        {
          x: 1348.376,
          y: 901.71
        },
        {
          x: 1320.859,
          y: 921.893
        },
        {
          x: 1313.466,
          y: 952.556
        },
        {
          x: 1299.893,
          y: 980
        },
        {
          x: 1297.212,
          y: 979.539
        },
        {
          x: 1294.531,
          y: 980
        },
        {
          x: 1291.85,
          y: 980
        },
        {
          x: 1289.169,
          y: 980
        },
        {
          x: 1286.488,
          y: 980
        },
        {
          x: 1285.338,
          y: 950.455
        },
        {
          x: 1270.803,
          y: 923.681
        },
        {
          x: 1268.746,
          y: 894.324
        },
        {
          x: 1267.201,
          y: 864.861
        },
        {
          x: 1256.928,
          y: 837.204
        },
        {
          x: 1270.844,
          y: 832.497
        },
        {
          x: 1284.426,
          y: 825.021
        },
        {
          x: 1300.508,
          y: 838.276
        },
        {
          x: 1314.205,
          y: 831.756
        },
        {
          x: 1328.308,
          y: 828.596
        },
        {
          x: 1338.228,
          y: 827.768
        },
        {
          x: 1345.557,
          y: 833.94
        },
        {
          x: 1352.903,
          y: 840.067
        },
        {
          x: 1363.709,
          y: 836.849
        }
      ],
      neighborIds: [
        "district:134",
        "district:135",
        "district:156",
        "district:158"
      ],
      spawnZones: [
        "east",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:158",
      legacyId: 158,
      rowIndex: 6,
      columnIndex: 19,
      name: "District 158",
      zone: "park",
      polygon: [
        {
          x: 1408.429,
          y: 846.172
        },
        {
          x: 1407.76,
          y: 872.938
        },
        {
          x: 1400.135,
          y: 899.703
        },
        {
          x: 1415.22,
          y: 926.469
        },
        {
          x: 1412.216,
          y: 953.234
        },
        {
          x: 1408.429,
          y: 980
        },
        {
          x: 1386.722,
          y: 977.063
        },
        {
          x: 1365.014,
          y: 975.911
        },
        {
          x: 1343.307,
          y: 979.847
        },
        {
          x: 1321.6,
          y: 980
        },
        {
          x: 1299.893,
          y: 980
        },
        {
          x: 1313.466,
          y: 952.556
        },
        {
          x: 1320.859,
          y: 921.893
        },
        {
          x: 1348.376,
          y: 901.71
        },
        {
          x: 1356.243,
          y: 871.294
        },
        {
          x: 1370.583,
          y: 844.249
        },
        {
          x: 1373.993,
          y: 841.885
        },
        {
          x: 1378.349,
          y: 845.212
        },
        {
          x: 1381.831,
          y: 843.285
        },
        {
          x: 1385.341,
          y: 841.521
        },
        {
          x: 1389.085,
          y: 841.169
        },
        {
          x: 1392.805,
          y: 842.744
        },
        {
          x: 1396.228,
          y: 845.469
        },
        {
          x: 1401.455,
          y: 841.218
        },
        {
          x: 1404.448,
          y: 845.603
        }
      ],
      neighborIds: [
        "district:135",
        "district:136",
        "district:157",
        "district:159"
      ],
      spawnZones: [
        "east",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:159",
      legacyId: 159,
      rowIndex: 6,
      columnIndex: 20,
      name: "District 159",
      zone: "industrial",
      polygon: [
        {
          x: 1517.958,
          y: 980
        },
        {
          x: 1496.052,
          y: 980
        },
        {
          x: 1474.147,
          y: 974.469
        },
        {
          x: 1452.241,
          y: 970.533
        },
        {
          x: 1430.335,
          y: 980
        },
        {
          x: 1408.429,
          y: 980
        },
        {
          x: 1412.216,
          y: 953.234
        },
        {
          x: 1415.22,
          y: 926.469
        },
        {
          x: 1400.135,
          y: 899.703
        },
        {
          x: 1407.76,
          y: 872.938
        },
        {
          x: 1408.429,
          y: 846.172
        },
        {
          x: 1411.3,
          y: 846.566
        },
        {
          x: 1413.863,
          y: 844.868
        },
        {
          x: 1416.473,
          y: 843.487
        },
        {
          x: 1419.294,
          y: 843.541
        },
        {
          x: 1422.197,
          y: 844.144
        },
        {
          x: 1425.18,
          y: 845.656
        },
        {
          x: 1429.305,
          y: 843.636
        },
        {
          x: 1432.089,
          y: 845.766
        },
        {
          x: 1434.651,
          y: 848.586
        },
        {
          x: 1437.918,
          y: 849.221
        },
        {
          x: 1455.576,
          y: 874.367
        },
        {
          x: 1469.246,
          y: 901.954
        },
        {
          x: 1481.896,
          y: 930.164
        },
        {
          x: 1497.375,
          y: 956.645
        }
      ],
      neighborIds: [
        "district:136",
        "district:137",
        "district:158",
        "district:160"
      ],
      spawnZones: [
        "east",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:160",
      legacyId: 160,
      rowIndex: 6,
      columnIndex: 21,
      name: "District 160",
      zone: "residential",
      polygon: [
        {
          x: 1552.604,
          y: 835.318
        },
        {
          x: 1546.931,
          y: 864.161
        },
        {
          x: 1537.582,
          y: 892.35
        },
        {
          x: 1528.558,
          y: 920.597
        },
        {
          x: 1535.874,
          y: 951.751
        },
        {
          x: 1526.863,
          y: 980
        },
        {
          x: 1525.082,
          y: 980
        },
        {
          x: 1523.301,
          y: 980
        },
        {
          x: 1521.52,
          y: 979.857
        },
        {
          x: 1519.739,
          y: 979.197
        },
        {
          x: 1517.958,
          y: 980
        },
        {
          x: 1497.375,
          y: 956.645
        },
        {
          x: 1481.896,
          y: 930.164
        },
        {
          x: 1469.246,
          y: 901.954
        },
        {
          x: 1455.576,
          y: 874.367
        },
        {
          x: 1437.918,
          y: 849.221
        },
        {
          x: 1457.79,
          y: 839.801
        },
        {
          x: 1480.643,
          y: 847.445
        },
        {
          x: 1500.846,
          y: 839.92
        },
        {
          x: 1520.502,
          y: 829.262
        },
        {
          x: 1542.321,
          y: 830.985
        },
        {
          x: 1544.773,
          y: 830.913
        },
        {
          x: 1546.767,
          y: 831.928
        },
        {
          x: 1548.516,
          y: 833.524
        },
        {
          x: 1550.374,
          y: 834.864
        }
      ],
      neighborIds: [
        "district:137",
        "district:138",
        "district:159",
        "district:161"
      ],
      spawnZones: [
        "east",
        "south"
      ],
      isSpawnCandidate: true
    },
    {
      id: "district:161",
      legacyId: 161,
      rowIndex: 6,
      columnIndex: 22,
      name: "District 161",
      zone: "industrial",
      polygon: [
        {
          x: 1600,
          y: 828.781
        },
        {
          x: 1597.583,
          y: 859.024
        },
        {
          x: 1600,
          y: 889.268
        },
        {
          x: 1600,
          y: 919.512
        },
        {
          x: 1600,
          y: 949.756
        },
        {
          x: 1600,
          y: 980
        },
        {
          x: 1585.373,
          y: 979.291
        },
        {
          x: 1570.745,
          y: 971.642
        },
        {
          x: 1556.118,
          y: 980
        },
        {
          x: 1541.491,
          y: 979.7
        },
        {
          x: 1526.863,
          y: 980
        },
        {
          x: 1535.874,
          y: 951.751
        },
        {
          x: 1528.558,
          y: 920.597
        },
        {
          x: 1537.582,
          y: 892.35
        },
        {
          x: 1546.931,
          y: 864.161
        },
        {
          x: 1552.604,
          y: 835.318
        },
        {
          x: 1562.542,
          y: 837.335
        },
        {
          x: 1571.456,
          y: 831.931
        },
        {
          x: 1580.472,
          y: 827.265
        },
        {
          x: 1591.028,
          y: 833.762
        }
      ],
      neighborIds: [
        "district:138",
        "district:160"
      ],
      spawnZones: [
        "east",
        "south"
      ],
      isSpawnCandidate: true
    }
  ];
  const rawManifest = {
    id,
    version,
    width,
    height,
    districts
  };
  const sortDistrictIds = (left, right) => left.localeCompare(right, "en", { numeric: true });
  const normalizePoint = (value) => Number(Number(value).toFixed(3));
  const normalizeEmpireCityMapForHash = (manifest) => ({
    id: manifest.id,
    version: manifest.version,
    width: manifest.width,
    height: manifest.height,
    districts: [...manifest.districts].sort((left, right) => sortDistrictIds(left.id, right.id)).map((district) => ({
      id: district.id,
      legacyId: district.legacyId ?? null,
      name: district.name,
      zone: district.zone,
      polygon: district.polygon.map((point) => ({
        x: normalizePoint(point.x),
        y: normalizePoint(point.y)
      })),
      neighborIds: [...district.neighborIds].sort(sortDistrictIds),
      buildingSetKey: district.buildingSetKey ?? null,
      spawnZones: [...district.spawnZones ?? []].sort(),
      isSpawnCandidate: Boolean(district.isSpawnCandidate),
      isDowntown: Boolean(district.isDowntown)
    }))
  });
  const stableStringifyMapValue = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map(stableStringifyMapValue).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const record = value;
      return `{${Object.keys(record).sort().map(
        (key) => `${JSON.stringify(key)}:${stableStringifyMapValue(record[key])}`
      ).join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const createEmpireCityMapHash = (manifest) => {
    const text = stableStringifyMapValue(normalizeEmpireCityMapForHash(manifest));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  };
  const empireStreetsCityMapManifest = rawManifest;
  createEmpireCityMapHash(empireStreetsCityMapManifest);
  new Map(
    empireStreetsCityMapManifest.districts.map((district) => [district.id, district])
  );
  const mapTotal = (form) => {
    const data = new FormData(form);
    return 8 + ["commercial", "residential", "industrial", "park"].reduce((sum, key) => sum + Number(data.get(key) ?? 0), 0);
  };
  const validateWizardPanel = (form, step) => {
    const panel = form.querySelector(`[data-admin-wizard-panel="${step}"]`);
    const serverTemplate = form.elements.namedItem("serverTemplate");
    if (!panel) return false;
    for (const field of panel.querySelectorAll("input,select")) {
      if (!field.reportValidity()) return false;
    }
    if (step === 2 && mapTotal(form) !== 161) {
      const message = form.querySelector("[data-admin-create-error]");
      if (message) message.textContent = "Mapa musí obsahovat přesně 161 districtů.";
      return false;
    }
    if (step === 1 && serverTemplate instanceof HTMLSelectElement && serverTemplate.value === "full" && Number(new FormData(form).get("capacity")) !== 20) {
      const message = form.querySelector("[data-admin-create-error]");
      if (message) message.textContent = "Plnohodnotná šablona používá canonical kapacitu 20 hráčů.";
      return false;
    }
    return true;
  };
  const updateWizardReview = (form) => {
    const review = form.querySelector("[data-admin-create-review]");
    if (!review) return;
    const data = new FormData(form);
    const serverTemplate = data.get("serverTemplate") === "full" ? "Plnohodnotný server" : "Kontrolní test";
    const values = [
      ["Název", data.get("displayName")],
      ["Mode", data.get("mode")],
      ["Region", data.get("region")],
      ["Šablona", serverTemplate],
      ["Kapacita", data.get("capacity")],
      ["Minimum ke spuštění", FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart],
      ["Registrační okno", `${FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 6e4} minut`],
      ["Vstup po vytvoření", "Uzavřený do naplánování registrace"],
      ["Mapa", `8 / ${data.get("commercial")} / ${data.get("residential")} / ${data.get("industrial")} / ${data.get("park")}`]
    ];
    review.innerHTML = values.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? "-")}</strong></span>`).join("");
  };
  const escapeHtml = (value) => String(value).replace(
    /[&<>"']/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
  const canonicalCapacity = resolveModeConfig("free").balance.maxPlayersPerServer;
  const createAdminCreateController = (options) => {
    const bind = () => {
      var _a, _b, _c;
      const target = options.target();
      (_a = target == null ? void 0 : target.querySelector("[data-admin-create-open]")) == null ? void 0 : _a.addEventListener("click", () => {
        options.updateState({
          wizardOpen: true,
          wizardStep: 1,
          idempotencyKey: options.state().idempotencyKey ?? options.createKey()
        });
        options.render();
      });
      (_b = target == null ? void 0 : target.querySelector("[data-admin-create-cancel]")) == null ? void 0 : _b.addEventListener("click", () => {
        options.updateState({ wizardOpen: false, wizardStep: 1, idempotencyKey: null });
        options.render();
      });
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-next]").forEach((button2) => button2.addEventListener("click", () => {
        const form = target.querySelector("[data-admin-create-form]");
        const state = options.state();
        if (!form || !validateWizardPanel(form, state.wizardStep)) return;
        options.updateState({ wizardStep: Math.min(4, state.wizardStep + 1) });
        applyStep();
      }));
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-back]").forEach((button2) => button2.addEventListener("click", () => {
        options.updateState({ wizardStep: Math.max(1, options.state().wizardStep - 1) });
        applyStep();
      }));
      bindTemplatePolicy();
      bindMapTotal();
      (_c = target == null ? void 0 : target.querySelector("[data-admin-create-form]")) == null ? void 0 : _c.addEventListener("submit", (event) => void submit(event));
    };
    const submit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const idempotencyKey = options.state().idempotencyKey;
      if (!form.reportValidity() || !idempotencyKey) return;
      if (mapTotal(form) !== 161) return showError(form, "Mapa musí obsahovat přesně 161 districtů.");
      const data = new FormData(form);
      const serverTemplate = data.get("serverTemplate") === "full" ? "full" : "control";
      const payload = {
        displayName: String(data.get("displayName") ?? ""),
        mode: String(data.get("mode")),
        region: String(data.get("region")),
        capacity: Number(data.get("capacity")),
        serverTemplate,
        joinPolicy: "closed",
        mapComposition: {
          downtown: 8,
          commercial: Number(data.get("commercial")),
          residential: Number(data.get("residential")),
          industrial: Number(data.get("industrial")),
          park: Number(data.get("park"))
        }
      };
      const submitButton = form.querySelector("[type=submit]");
      if (submitButton) submitButton.disabled = true;
      try {
        const result = await options.client.createServer(payload, idempotencyKey);
        options.selectInstance(result.server.serverInstanceId);
        options.updateState({ wizardOpen: false, wizardStep: 1, idempotencyKey: null });
        await options.refresh();
      } catch (error) {
        showError(form, error instanceof Error ? error.message : "Server nebylo možné vytvořit.");
        if (submitButton) submitButton.disabled = false;
      }
    };
    const bindMapTotal = () => {
      var _a;
      const form = (_a = options.target()) == null ? void 0 : _a.querySelector("[data-admin-create-form]");
      const output = form == null ? void 0 : form.querySelector("[data-admin-map-total]");
      if (!form || !output) return;
      const update = () => {
        const total = mapTotal(form);
        output.value = String(total);
        output.dataset.valid = String(total === 161);
        updateWizardReview(form);
      };
      form.querySelectorAll("[data-admin-map-count]").forEach((input) => input.addEventListener("input", update));
      update();
    };
    const bindTemplatePolicy = () => {
      var _a;
      const form = (_a = options.target()) == null ? void 0 : _a.querySelector("[data-admin-create-form]");
      const template = form == null ? void 0 : form.querySelector("[data-admin-server-template]");
      const capacity = form == null ? void 0 : form.querySelector("[data-admin-server-capacity]");
      if (!form || !template || !capacity) return;
      const update = () => {
        const full = template.value === "full";
        if (full) capacity.value = String(canonicalCapacity);
        else if (capacity.dataset.serverTemplate === "full") capacity.value = String(capacity.min);
        capacity.readOnly = full;
        capacity.setAttribute("aria-readonly", String(full));
        capacity.dataset.serverTemplate = full ? "full" : "control";
        updateWizardReview(form);
      };
      template.addEventListener("change", update);
      update();
    };
    const applyStep = () => {
      const target = options.target();
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-panel]").forEach((panel) => {
        panel.hidden = Number(panel.dataset.adminWizardPanel) !== options.state().wizardStep;
      });
      const form = target == null ? void 0 : target.querySelector("[data-admin-create-form]");
      if (form) updateWizardReview(form);
    };
    return { bind };
  };
  const showError = (form, text) => {
    const message = form.querySelector("[data-admin-create-error]");
    if (message) message.textContent = text;
  };
  const createAdminRegistrationController = (options) => {
    const drafts = /* @__PURE__ */ new Map();
    let timer = null;
    let serverClockMs = Number.NaN;
    let performanceClockMs = 0;
    let refreshedBoundary = "";
    const bind = () => {
      var _a;
      const target = options.target();
      target == null ? void 0 : target.querySelectorAll("[data-admin-registration-action]").forEach((button2) => button2.addEventListener("click", () => void submit(button2)));
      (_a = target == null ? void 0 : target.querySelector("[data-admin-registration-opens-at]")) == null ? void 0 : _a.addEventListener("input", (event) => {
        const instanceId = options.selectedInstanceId();
        if (instanceId && event.currentTarget instanceof HTMLInputElement) drafts.set(instanceId, event.currentTarget.value);
      });
    };
    const schedulePayload = (instanceId) => {
      var _a;
      const input = (_a = options.target()) == null ? void 0 : _a.querySelector("[data-admin-registration-opens-at]");
      const value = drafts.get(instanceId) ?? (input == null ? void 0 : input.value) ?? "";
      const timestamp = value ? new Date(value) : null;
      return { registrationOpensAt: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : void 0 };
    };
    const submit = async (button2) => {
      var _a, _b;
      const instanceId = button2.dataset.adminServerId;
      const action2 = button2.dataset.adminRegistrationAction;
      const hosted = (_a = options.controlPlane()) == null ? void 0 : _a.servers.find((entry) => entry.serverInstanceId === instanceId);
      const target = options.target();
      const reason = ((_b = target == null ? void 0 : target.querySelector("[data-admin-action-reason]")) == null ? void 0 : _b.value.trim()) ?? "";
      const message = target == null ? void 0 : target.querySelector("[data-admin-action-error]");
      if (!instanceId || !action2 || !hosted) return;
      if (reason.length < 3) {
        if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
        return;
      }
      if (action2 === "close-registration-now" && !window.confirm("Nouzově ukončit registraci? Existující hráči zůstanou na serveru.")) return;
      const payload = {
        action: action2,
        expectedVersion: hosted.version,
        reason,
        ...action2 === "close-registration-now" ? { confirmationToken: "CLOSE_REGISTRATION" } : {},
        ...action2 === "schedule-registration" ? schedulePayload(instanceId) : {}
      };
      if (action2 === "schedule-registration" && !payload.registrationOpensAt) {
        if (message) message.textContent = "Vyber platný čas otevření registrace.";
        return;
      }
      button2.disabled = true;
      try {
        await options.client.requestLifecycleAction(instanceId, payload, options.createKey());
        if (action2 === "schedule-registration") drafts.delete(instanceId);
        await options.refresh();
      } catch (error) {
        if (message) message.textContent = error instanceof Error ? error.message : "Registraci nebylo možné změnit.";
        button2.disabled = false;
      }
    };
    const restoreDraft = () => {
      var _a;
      const instanceId = options.selectedInstanceId();
      const input = (_a = options.target()) == null ? void 0 : _a.querySelector("[data-admin-registration-opens-at]");
      if (instanceId && input && drafts.has(instanceId)) input.value = drafts.get(instanceId);
    };
    const syncClock = (generatedAt) => {
      const parsed = Date.parse(String(generatedAt || ""));
      if (!Number.isFinite(parsed)) return;
      serverClockMs = parsed;
      performanceClockMs = performance.now();
    };
    const updateCountdowns = () => {
      var _a;
      const nowMs = Number.isFinite(serverClockMs) ? serverClockMs + Math.max(0, performance.now() - performanceClockMs) : Date.now();
      (_a = options.target()) == null ? void 0 : _a.querySelectorAll("[data-admin-registration-countdown]").forEach((node) => {
        const state = node.dataset.registrationState;
        const targetIso = state === "scheduled" ? node.dataset.registrationOpensAt : node.dataset.registrationClosesAt;
        const remainingMs = Date.parse(String(targetIso || "")) - nowMs;
        if (state !== "scheduled" && state !== "open" || !Number.isFinite(remainingMs)) return;
        node.textContent = `${state === "scheduled" ? "začne za" : "zbývá"} ${formatDuration(remainingMs)}`;
        if (remainingMs > 0) return;
        const key = `${options.selectedInstanceId()}:${state}:${targetIso}`;
        if (refreshedBoundary === key) return;
        refreshedBoundary = key;
        void options.refresh();
      });
    };
    const start = () => {
      if (!timer) timer = setInterval(updateCountdowns, 1e3);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    return { bind, restoreDraft, start, stop, syncClock, updateCountdowns };
  };
  const formatDuration = (milliseconds) => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1e3));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
  };
  const freeConfig = resolveModeConfig("free");
  const minimumCapacity = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart;
  const maximumCapacity = freeConfig.balance.maxPlayersPerServer;
  const registrationMinutes$1 = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 6e4;
  const renderAdminCreateWizard = (step) => `
  <form class="admin-wizard" data-admin-create-form>
    <div class="admin-wizard__steps" aria-label="Kroky vytvoření serveru">
      ${["Základ", "Mapa", "Přístup", "Kontrola"].map((label, index) => `<span class="${step === index + 1 ? "is-active" : ""}">${index + 1}. ${label}</span>`).join("")}
    </div>
    <fieldset data-admin-wizard-panel="1" ${step === 1 ? "" : "hidden"}>
      <legend>Základ</legend>
      <label><span>Název</span><input name="displayName" minlength="3" maxlength="80" required></label>
      <label><span>Mode</span><select name="mode"><option value="free">Free</option><option value="war" disabled>War (připravuje se)</option></select></label>
      <label><span>Region</span><select name="region"><option value="eu-central">EU Central</option></select></label>
      <label class="admin-template-selector"><span>Bezpečná Free šablona</span><select name="serverTemplate" data-admin-server-template>
        <option value="control">Kontrolní test · 2–20 hráčů · bez Očisty</option>
        <option value="full">Plnohodnotný server · 20 hráčů · canonical Očista</option>
      </select><small>Šablona určuje serverová lifecycle pravidla. Browser neposílá raw balance ani nastavení Očisty.</small></label>
      <label><span>Kapacita</span><input name="capacity" data-admin-server-capacity type="number" min="${minimumCapacity}" max="${maximumCapacity}" value="${minimumCapacity}" required></label>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="2" ${step === 2 ? "" : "hidden"}>
      <legend>Mapa</legend><div class="admin-map-counts">
        <label><span>Downtown</span><input value="8" disabled></label>
        <label><span>Commercial</span><input name="commercial" data-admin-map-count type="number" min="0" value="40" required></label>
        <label><span>Residential</span><input name="residential" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Industrial</span><input name="industrial" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Park</span><input name="park" data-admin-map-count type="number" min="0" value="37" required></label>
      </div><p>Celkem: <output data-admin-map-total>161</output> / 161</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="3" ${step === 3 ? "" : "hidden"}>
      <legend>Přístup</legend><input type="hidden" name="joinPolicy" value="closed">
      <div class="admin-kv-grid admin-wizard__policy">
        ${kv$2("Kapacita", "Kontrolní 2–20 / plná 20")}
        ${kv$2("Minimum ke spuštění", minimumCapacity)}
        ${kv$2("Registrační okno", `${registrationMinutes$1} minut`)}
      </div>
      <p class="admin-notice">Kontrolní šablona je pro malý setup bez Očisty. Plnohodnotná šablona drží canonical kapacitu 20 a standardní Očistu. Server vznikne se zavřeným vstupem.</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="4" ${step === 4 ? "" : "hidden"}>
      <legend>Kontrola</legend><div class="admin-kv-grid" data-admin-create-review></div>
      <p class="admin-notice">Server vznikne jako REQUESTED a joins zůstanou zavřené do dokončení provisioningu.</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="submit">Create Server</button>
    </fieldset>
    <button class="admin-button" type="button" data-admin-create-cancel>Zrušit</button>
    <p data-admin-create-error role="alert"></p>
  </form>`;
  const kv$2 = (label, value) => `<span><small>${escape$2(label)}</small><strong>${escape$2(value)}</strong></span>`;
  const escape$2 = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const registrationMinutes = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 6e4;
  const renderAdminRegistration = (server, session) => {
    const state = String(server.registrationState || "not_scheduled");
    const canSchedule = server.provisioningState === "ready" && server.status === "lobby" && (state === "not_scheduled" || state === "closed" || state === "closed_early");
    const canCancel = server.provisioningState === "ready" && server.status === "lobby" && state === "scheduled";
    const canClose = session.role === "owner" && state === "open";
    return `<section class="admin-registration" aria-labelledby="admin-registration-${attr$1(server.serverInstanceId)}">
    <div class="admin-registration__head">
      <div><span>REGISTRACE HRÁČŮ</span><h5 id="admin-registration-${attr$1(server.serverInstanceId)}">${escape$1(stateLabel(state))}</h5></div>
      <strong data-admin-registration-countdown data-registration-state="${attr$1(state)}"
        data-registration-opens-at="${attr$1(server.registrationOpensAt ?? "")}" data-registration-closes-at="${attr$1(server.registrationClosesAt ?? "")}">
        ${escape$1(countdown(server))}
      </strong>
    </div>
    <div class="admin-kv-grid">
      ${kv$1("Otevření", timeWithZone(server.registrationOpensAt))}${kv$1("Automatické zavření", timeWithZone(server.registrationClosesAt))}
      ${kv$1("Délka", `${server.registrationWindowMinutes ?? registrationMinutes} minut`)}
      ${kv$1("Připravení hráči", `${numberOrDash(server.readyPlayers)} / ${numberOrDash(server.minimumReadyPlayersToStart)}`)}
    </div>
    <label class="admin-registration__schedule"><span>Plánované otevření · ${escape$1(browserTimeZone())}</span>
      <input type="datetime-local" data-admin-registration-opens-at ${canSchedule ? "" : "disabled"}>
    </label>
    <div class="admin-registration__actions">
      ${button(server, "schedule-registration", "Naplánovat registraci", canSchedule)}
      ${button(server, "open-registration-now", "Otevřít nyní na 60 minut", canSchedule)}
      ${button(server, "cancel-registration", "Zrušit plán", canCancel)}
      ${session.role === "owner" ? button(server, "close-registration-now", "Uzavřít registraci nyní", canClose, true) : ""}
    </div>
  </section>`;
  };
  const renderAdminStartReadiness = (server) => {
    const canStart = server.canStart === true;
    return `<section class="admin-start-readiness ${canStart ? "is-ready" : "is-blocked"}">
    <span>PŘIPRAVENÍ HRÁČI <strong>${escape$1(numberOrDash(server.readyPlayers))} / ${escape$1(numberOrDash(server.minimumReadyPlayersToStart))}</strong></span>
    <span>START SERVERU <strong>${canStart ? "PŘIPRAVENO" : "BLOKOVÁNO"}</strong></span>
    ${canStart ? "" : `<p>${escape$1(server.startDisabledReason || "Čekám na autoritativní stav serveru.")}</p>`}
  </section>`;
  };
  const button = (server, action2, label, enabled, dangerous = false) => `<button class="admin-button${dangerous ? " admin-button--danger" : ""}" type="button"
    data-admin-registration-action="${attr$1(action2)}" data-admin-server-id="${attr$1(server.serverInstanceId)}"
    ${enabled ? "" : 'disabled aria-disabled="true"'}>${escape$1(label)}</button>`;
  const stateLabel = (state) => ({
    not_scheduled: "NENAPLÁNOVÁNO",
    scheduled: "NAPLÁNOVÁNO",
    open: "REGISTRACE OTEVŘENA",
    closed: "REGISTRACE UKONČENA",
    closed_early: "NOUZOVĚ UKONČENO"
  })[state] || "NENAPLÁNOVÁNO";
  const countdown = (server) => server.registrationState === "open" ? `zbývá ${duration(server.registrationRemainingMs)}` : server.registrationState === "scheduled" ? `začne za ${duration(server.registrationRemainingMs)}` : "";
  const duration = (value) => {
    const seconds = Math.max(0, Math.floor(Number(value ?? 0) / 1e3));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
  };
  const numberOrDash = (value) => Number.isFinite(value) ? Number(value) : "–";
  const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "místní čas";
  const timeWithZone = (value) => value ? `${new Date(value).toLocaleString("cs-CZ")} · ${browserTimeZone()}` : "–";
  const kv$1 = (label, value) => `<span><small>${escape$1(label)}</small><strong>${escape$1(value)}</strong></span>`;
  const attr$1 = (value) => escape$1(value);
  const escape$1 = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const renderLogin = (message = "Přihlaste se do admin konzole.") => `
  <section class="admin-login" aria-labelledby="admin-login-title">
    <p class="admin-boot__eyebrow">Empire Streets</p>
    <h1 id="admin-login-title">Admin konzole</h1>
    <p>${escape(message)}</p>
    <form data-admin-login>
      <label><span>Uživatelské jméno</span><input data-admin-username type="text" autocomplete="username" required></label>
      <label><span>Heslo</span><input data-admin-password type="password" autocomplete="current-password" required></label>
      <button class="admin-button admin-button--primary" type="submit">Přihlásit</button>
      <p data-admin-login-error role="alert"></p>
    </form>
  </section>`;
  const renderLoading = () => `
  <section class="admin-login" role="status"><p class="admin-boot__eyebrow">Read-only monitoring</p><h1>Načítám admin konzoli...</h1></section>`;
  const renderUnavailable = (detail) => `
  <section class="admin-login" role="alert"><p class="admin-boot__eyebrow">Read-only monitoring</p>
    <h1>ADMIN SERVER NEDOSTUPNÝ</h1><p>${escape(detail)}</p>
    <button class="admin-button admin-button--primary" type="button" data-admin-refresh>Obnovit</button>
  </section>`;
  const renderDashboard = (input) => `
  <aside class="admin-sidebar">
    <div class="admin-brand"><span class="admin-brand__mark">ES</span><div><p>Empire Streets</p><strong>Admin</strong></div></div>
    <nav class="admin-nav" aria-label="Sekce admin konzole">
      ${nav("overview", "Overview")}${nav("servers", "Servery")}${nav("players", "Hráči")}${nav("map", "Mapa")}
      ${nav("economy", "Ekonomika")}${nav("production", "Výroba")}${nav("police", "Police")}${nav("liveness", "Liveness")}
      ${nav("commands", "Commands")}${nav("events", "Events")}${nav("diagnostics", "Diagnostics")}
    </nav>
  </aside>
  <section class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar__title"><p>Durable control plane</p><h1>Read-only admin</h1></div>
      <div class="admin-topbar__controls">
        <div class="admin-profile"><span>Operátor</span><strong>${escape(input.session.displayName)} · ${escape(input.session.role)}</strong></div>
        <button class="admin-button" type="button" data-admin-refresh>Obnovit</button>
        <button class="admin-button" type="button" data-admin-logout>Odhlásit</button>
      </div>
    </header>
    <div class="admin-content">
      ${renderOverview(input.overview)}
      ${renderControlPlane(
    input.controlPlane,
    input.session,
    input.wizardOpen,
    input.wizardStep,
    input.selectedInstanceId,
    input.frontendBuildSha ?? null
  )}
      ${renderServers(input.overview.instances, input.selectedInstanceId)}
      ${input.selectedInstanceId ? renderDetail(input.detail) : renderNoSelection()}
    </div>
  </section>`;
  const renderOverview = (overview) => `
  <section id="admin-overview" class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Overview</p><h2>Autoritativní stav instancí</h2></div>${badge("DB AVAILABLE", "success")}</div>
    <div class="admin-metrics">
      ${metric("Známé servery", overview.counts.known)}${metric("Live", overview.counts.live)}${metric("Stale", overview.counts.stale)}
      ${metric("Offline", overview.counts.offline)}${metric("No worker", overview.counts.noWorker)}${metric("Failed", overview.counts.failed)}
      ${metric("Running", overview.counts.running)}${metric("Lobby", overview.counts.lobby)}${metric("Paused", overview.counts.paused)}
      ${metric("Hráči", overview.counts.players)}
    </div>
    <p class="admin-copy">Data vygenerována ${time(overview.generatedAt)}. Stav LIVE určuje durable heartbeat, ne úspěch HTTP requestu.</p>
  </section>`;
  const renderControlPlane = (control, session, wizardOpen, wizardStep, selectedInstanceId, frontendBuildSha) => {
    if (!control) return `<section class="admin-panel" role="status"><h3>Načítám control plane...</h3></section>`;
    const frontendCompatible = Boolean(frontendBuildSha) && frontendBuildSha === control.apiBuildSha && control.buildCompatibility === "current";
    const accountPlatformReady = control.databaseAvailable && control.migrationsCurrent && control.sessionSecurity === "current" && control.originPolicy === "current" && frontendCompatible;
    const gameHostingDeployed = control.writesEnabled && control.provisioningEnabled && control.workerStatus === "online" && Boolean(control.workerBuildSha);
    const ready = !control.unavailableCode && frontendCompatible && session.role !== "viewer";
    const selected = control.servers.find((entry) => entry.serverInstanceId === selectedInstanceId) ?? null;
    return `<section id="admin-control-plane" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Hosted control plane</span><h3>Provisioning a lifecycle</h3></div>
      ${badge(control.unavailableCode ?? "WRITES ENABLED", ready ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Account platform", accountPlatformReady ? "READY" : "BLOCKED")}
      ${kv("Game hosting", gameHostingDeployed ? "DEPLOYED" : "NOT DEPLOYED")}
      ${kv("Database", control.databaseAvailable ? "AVAILABLE" : "UNAVAILABLE")}
      ${kv("Migrace", control.migrationsCurrent ? "CURRENT" : "PENDING")}${kv("Worker", control.workerStatus.toUpperCase())}
      ${kv("Provisioning", control.provisioningEnabled ? "ENABLED" : "DISABLED")}
      ${kv("Build parity", frontendCompatible ? "CURRENT" : "BLOCKED")}
      ${kv("Session security", (control.sessionSecurity ?? "blocked").toUpperCase())}
      ${kv("Origin policy", (control.originPolicy ?? "blocked").toUpperCase())}
      ${kv("Registrace", control.registrationEnabled ? "ENABLED" : "DISABLED")}
      ${kv("Frontend SHA", frontendBuildSha ?? "NEZNÁMÉ")}${kv("API SHA", control.apiBuildSha ?? "NEZNÁMÉ")}
      ${kv("Worker SHA", control.workerBuildSha ?? "NEZNÁMÉ")}${kv("Schema", control.schemaVersion ?? "NEZNÁMÉ")}</div>
    ${renderBuildCompatibility(frontendBuildSha, control.apiBuildSha, control.workerBuildSha, gameHostingDeployed)}
    ${ready && !wizardOpen ? `<button class="admin-button admin-button--primary" type="button" data-admin-create-open>Vytvořit server</button>` : ""}
    ${wizardOpen && ready ? renderAdminCreateWizard(wizardStep) : ""}
    ${selected && ready ? renderLifecycle(selected, session) : ""}
  </section>`;
  };
  const renderBuildCompatibility = (frontend, api, worker, gameHostingDeployed = true) => {
    if (!gameHostingDeployed) {
      if (!frontend || !api) {
        return `<p class="admin-notice">Build účtové platformy nelze potvrdit, protože frontend nebo API SHA chybí.</p>`;
      }
      return frontend === api ? `<p class="admin-copy">Frontend a API běží ze stejného buildu. Herní worker není nasazený.</p>` : `<p class="admin-notice">POZOR: Frontend a API neběží ze stejného SHA. Herní worker není nasazený.</p>`;
    }
    const values = [frontend, api ?? null, worker ?? null];
    if (values.some((value) => !value)) {
      return `<p class="admin-notice">Kompatibilitu buildů nelze potvrdit, protože alespoň jedno SHA chybí.</p>`;
    }
    return new Set(values).size === 1 ? `<p class="admin-copy">Frontend, API a worker běží ze stejného buildu.</p>` : `<p class="admin-notice">POZOR: Frontend, API a worker neběží ze stejného SHA.</p>`;
  };
  const renderLifecycle = (server, session) => `
  <div class="admin-lifecycle"><h4>Lifecycle: ${escape(server.displayName)}</h4>
    <p>${pill(server.status)} ${pill(server.provisioningState)} · version ${server.version}</p>
    <div class="admin-kv-grid">${kv("Šablona", server.serverTemplate === "full" ? "Plnohodnotný server" : "Kontrolní test")}
      ${kv("Committed players", server.committedPlayers ?? 0)}
      ${kv("Reserved slots", server.reservedSlots ?? 0)}${kv("Capacity", server.capacity)}
      ${kv("Join policy", server.joinPolicy)}${kv("Lease owner", server.runtimeLeaseOwnerId)}
      ${kv("Last error", server.lastErrorCode)}</div>
    ${renderAdminRegistration(server, session)}
    ${renderAdminStartReadiness(server)}
    <label><span>Důvod akce</span><input data-admin-action-reason minlength="3" maxlength="240" required></label>
    <div class="admin-lifecycle__actions">
      ${lifecycleButton(server, "start", "Start")}${lifecycleButton(server, "pause", "Pause")}
      ${lifecycleButton(server, "resume", "Resume")}${lifecycleButton(server, "restart", "Safe restart")}
      ${session.role === "owner" ? lifecycleButton(server, "stop", "Stop") : ""}
    </div><p data-admin-action-error role="alert"></p>
  </div>`;
  const lifecycleButton = (server, action2, label) => {
    const unavailableReason = lifecycleUnavailableReason(server, action2);
    const disabled = unavailableReason ? ` disabled aria-disabled="true" title="${attr(unavailableReason)}"` : "";
    return `<button class="admin-button" type="button" data-admin-lifecycle="${attr(action2)}" data-admin-server-id="${attr(server.serverInstanceId)}"${disabled}>${escape(label)}</button>`;
  };
  const lifecycleUnavailableReason = (server, action2) => {
    if (server.provisioningState !== "ready") return "Počkejte na dokončení provisioningu.";
    if (action2 === "start") {
      if (server.status !== "lobby") return "Spustit lze pouze server v lobby.";
      if (server.canStart !== true) return server.startDisabledReason || "Čekám na autoritativní stav připravených hráčů.";
      return null;
    }
    if (action2 === "pause") return server.status === "running" ? null : "Pozastavit lze pouze běžící server.";
    if (action2 === "resume") return server.status === "paused" ? null : "Pokračovat lze pouze u pozastaveného serveru.";
    if (action2 === "restart") return server.status === "running" ? null : "Restartovat lze pouze běžící server.";
    if (action2 === "stop") return ["lobby", "running", "paused", "restarting"].includes(server.status) ? null : "Server už nelze zastavit.";
    return "Akce není dostupná.";
  };
  const renderServers = (instances, selected) => `
  <section id="admin-servers" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Servery</span><h3>Durable instance registry</h3></div>${badge(`${instances.length} INSTANCÍ`, "info")}</div>
    ${instances.length === 0 ? `<p class="admin-copy">Žádné instance.</p>` : table(
    ["Instance", "Mode / region", "Status", "Worker", "Hráči", "Snapshot", "Heartbeat"],
    instances.map((item) => `<tr class="${item.serverInstanceId === selected ? "is-selected" : ""}">
        <td><a href="?instance=${encodeURIComponent(item.serverInstanceId)}" data-admin-instance="${attr(item.serverInstanceId)}"><strong>${escape(item.displayName)}</strong><br><small>${escape(item.serverInstanceId)}</small></a></td>
        <td>${escape(item.mode)} / ${escape(item.region)}</td><td>${pill(item.status)}</td><td>${pill(item.workerStatus)}</td>
        <td>${item.playerCount} / ${item.capacity}</td><td>${time(item.lastSnapshotAt)}</td><td>${time(item.lastHeartbeatAt)}</td></tr>`).join("")
  )}
  </section>`;
  const renderNoSelection = () => `
  <section class="admin-panel" role="status"><div class="admin-panel__head"><div><span>Detail</span><h3>Vyberte instanci</h3></div></div>
    <p class="admin-copy">Bez explicitně vybrané instance se detailní data nenačítají.</p></section>`;
  const renderDetail = (detail) => detail ? `
  <section class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Instance detail</p><h2>${escape(detail.summary.displayName)}</h2><small>${escape(detail.serverInstanceId)}</small></div>
      ${badge(detail.summary.workerStatus.toUpperCase(), detail.summary.workerStatus === "live" ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Mode", detail.summary.mode)}${kv("Region", detail.summary.region)}${kv("Status", detail.summary.status)}
      ${kv("Join policy", detail.summary.joinPolicy)}${kv("Tick", detail.summary.currentTick)}${kv("State version", detail.summary.stateVersion)}
      ${kv("Snapshot", time(detail.summary.lastSnapshotAt))}${kv("Heartbeat", time(detail.summary.lastHeartbeatAt))}${kv("Lease owner", detail.summary.leaseOwner)}</div>
    ${detail.runtimeAvailable ? "" : `<p class="admin-notice">Live runtime není dostupný. Zobrazená data pocházejí z durable snapshotu a mohou být stale.</p>`}
  </section>
  ${section("players", "Hráči", table(["Hráč", "Stav", "Districty", "Cash", "Heat"], detail.players.map((row) => `<tr><td>${escape(row.displayName)}<br><small>${escape(row.playerId)}</small></td><td>${escape(row.status)}</td><td>${row.ownedDistrictCount}</td><td>${row.cash}</td><td>${row.heat}</td></tr>`).join("")))}
  ${section("map", "Mapa", table(["District", "Zone", "Owner", "Heat", "Buildings"], detail.districts.map((row) => `<tr><td>${escape(row.name)}<br><small>${escape(row.districtId)}</small></td><td>${escape(row.zone)}</td><td>${escape(row.ownerPlayerId ?? "-")}</td><td>${row.heat}</td><td>${row.buildingCount}</td></tr>`).join("")))}
  ${section("economy", "Ekonomika", `<div class="admin-kv-grid">${kv("Clean cash", detail.economy.totalCleanCash)}${kv("Dirty cash", detail.economy.totalDirtyCash)}${kv("Resources", Object.values(detail.economy.totalResources).reduce((sum, value) => sum + value, 0))}</div>`)}
  ${section("production", "Výroba", `<div class="admin-kv-grid">${kv("Buildings", detail.production.productionBuildingCount)}${kv("Ready", detail.production.readyToCollectCount)}${kv("Crafts", detail.production.activeCraftCount)}${kv("Storage full", detail.production.storageFullCount)}</div>`)}
  ${section("police", "Police", `<div class="admin-kv-grid">${kv("Pressure", detail.police.heatPressure)}${kv("Max heat", detail.police.maxPlayerHeat)}${kv("Wanted", detail.police.wantedPlayerCount)}${kv("Raids", detail.police.pendingRaidCount)}</div>`)}
  ${section("liveness", "Liveness", `<div class="admin-kv-grid">${kv("Active", detail.liveness.activePlayers)}${kv("Playable", detail.liveness.playablePlayers)}${kv("Sealed", detail.liveness.temporarilySealedPlayers)}${kv("Softlocks", detail.liveness.invalidSoftlocks)}</div>`)}
  ${section("commands", "Commands", table(["Type", "Command", "Actor", "Tick", "Received"], detail.commands.map((row) => `<tr><td>${escape(row.commandType)}</td><td>${escape(row.commandId)}</td><td>${escape(row.actorId)}</td><td>${row.tickAtReceive}</td><td>${time(row.receivedAt)}</td></tr>`).join("")))}
  ${section("events", "Events", table(["Type", "Event", "Command", "Tick", "Occurred"], detail.events.map((row) => `<tr><td>${escape(row.eventType)}</td><td>${escape(row.eventId)}</td><td>${escape(row.causedByCommandId ?? "-")}</td><td>${row.tick}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
  ${section("diagnostics", "Diagnostics", table(["Level", "Category", "Code", "Command", "Occurred"], detail.diagnostics.map((row) => `<tr><td>${pill(row.level)}</td><td>${escape(row.category)}</td><td>${escape(row.messageCode)}</td><td>${escape(row.commandId ?? "-")}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
` : `<section class="admin-panel" role="status"><h3>Načítám detail instance...</h3></section>`;
  const nav = (id2, label) => `<a class="admin-nav__item" href="#admin-${id2}"><span class="admin-nav__dot"></span><strong>${escape(label)}</strong></a>`;
  const section = (id2, title, body) => `<section id="admin-${id2}" class="admin-panel admin-section-anchor"><div class="admin-panel__head"><div><span>Instance</span><h3>${escape(title)}</h3></div></div>${body}</section>`;
  const metric = (label, value) => `<article class="admin-metric"><span>${escape(label)}</span><strong>${value}</strong></article>`;
  const kv = (label, value) => `<span><small>${escape(label)}</small><strong>${escape(value ?? "-")}</strong></span>`;
  const badge = (label, tone) => `<span class="admin-badge admin-badge--${tone}">${escape(label)}</span>`;
  const pill = (value) => `<span class="admin-table-status">${escape(value)}</span>`;
  const table = (headers, rows) => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map((head) => `<th>${escape(head)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">Žádná data.</td></tr>`}</tbody></table></div>`;
  const time = (value) => value ? escape(new Date(value).toLocaleString("cs-CZ")) : "-";
  const escape = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const attr = escape;
  const POLL_INTERVAL_MS = 1e4;
  const MAX_BACKOFF_MS = 8e4;
  const createAdminApp = (options = {}) => {
    const client = options.client ?? createAdminApiClient();
    const pollInterval = Math.max(1e3, options.pollIntervalMs ?? POLL_INTERVAL_MS);
    let target = null;
    let session = null;
    let overview = null;
    let detail = null;
    let controlPlane = null;
    let selectedInstanceId = selectedFromUrl();
    let requestSequence = 0;
    let activeRequest = null;
    let timer = null;
    let backoff = pollInterval;
    let wizardOpen = false;
    let wizardStep = 1;
    let createIdempotencyKey = null;
    const mount = async (mountTarget) => {
      target = mountTarget ?? document.getElementById("admin-dashboard-root");
      if (!target) return;
      target.innerHTML = renderLoading();
      document.addEventListener("visibilitychange", handleVisibility);
      registration.start();
      try {
        session = await client.getSession();
        await refresh();
      } catch (error) {
        if (!session) showLogin(initialLoginMessage(error));
        else handleError(error);
      }
    };
    const refresh = async () => {
      if (!target || !session || document.hidden) return;
      if (wizardOpen) {
        schedule(pollInterval);
        return;
      }
      const sequence = ++requestSequence;
      activeRequest == null ? void 0 : activeRequest.abort();
      activeRequest = new AbortController();
      try {
        const requestedInstanceId = selectedInstanceId;
        const [nextOverview, nextDetail, nextControlPlane] = await Promise.all([
          client.getOverview(activeRequest.signal),
          requestedInstanceId ? client.getInstance(requestedInstanceId, activeRequest.signal) : Promise.resolve(null),
          client.getControlPlane(activeRequest.signal)
        ]);
        if (sequence !== requestSequence || requestedInstanceId !== selectedInstanceId) return;
        overview = nextOverview;
        detail = nextDetail;
        controlPlane = nextControlPlane;
        registration.syncClock(controlPlane.generatedAt);
        backoff = pollInterval;
        render();
        schedule(pollInterval);
      } catch (error) {
        if (isAbort(error)) return;
        backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
        handleError(error);
        if (session) schedule(backoff);
      }
    };
    const render = () => {
      if (!target || !session || !overview) return;
      target.innerHTML = renderDashboard({
        session,
        overview,
        detail,
        selectedInstanceId,
        controlPlane,
        wizardOpen,
        wizardStep,
        frontendBuildSha: readFrontendBuildSha()
      });
      bindActions();
      registration.restoreDraft();
      registration.updateCountdowns();
    };
    const bindActions = () => {
      var _a, _b;
      target == null ? void 0 : target.querySelectorAll("[data-admin-instance]").forEach((link) => link.addEventListener("click", (event) => {
        var _a2;
        event.preventDefault();
        const next = ((_a2 = link.dataset.adminInstance) == null ? void 0 : _a2.trim()) || null;
        if (next === selectedInstanceId) return;
        selectedInstanceId = next;
        detail = null;
        updateUrl(next);
        render();
        void refresh();
      }));
      (_a = target == null ? void 0 : target.querySelector("[data-admin-refresh]")) == null ? void 0 : _a.addEventListener("click", () => void refresh());
      (_b = target == null ? void 0 : target.querySelector("[data-admin-logout]")) == null ? void 0 : _b.addEventListener("click", () => void logout());
      creation.bind();
      target == null ? void 0 : target.querySelectorAll("[data-admin-lifecycle]").forEach((button2) => button2.addEventListener("click", () => void submitLifecycle(button2)));
      registration.bind();
    };
    const submitLifecycle = async (button2) => {
      var _a;
      const instanceId = button2.dataset.adminServerId;
      const action2 = button2.dataset.adminLifecycle;
      const hosted = controlPlane == null ? void 0 : controlPlane.servers.find((entry) => entry.serverInstanceId === instanceId);
      const reason = ((_a = target == null ? void 0 : target.querySelector("[data-admin-action-reason]")) == null ? void 0 : _a.value.trim()) ?? "";
      if (!instanceId || !action2 || !hosted) return;
      if (reason.length < 3) {
        const message = target == null ? void 0 : target.querySelector("[data-admin-action-error]");
        if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
        return;
      }
      button2.disabled = true;
      try {
        await client.requestLifecycleAction(instanceId, { action: action2, expectedVersion: hosted.version, reason }, createKey());
        await refresh();
      } catch (error) {
        const message = target == null ? void 0 : target.querySelector("[data-admin-action-error]");
        if (message) message.textContent = error instanceof Error ? error.message : "Akci nebylo možné zařadit.";
        button2.disabled = false;
      }
    };
    const bindLogin = () => {
      const form = target == null ? void 0 : target.querySelector("[data-admin-login]");
      const usernameInput = target == null ? void 0 : target.querySelector("[data-admin-username]");
      const passwordInput = target == null ? void 0 : target.querySelector("[data-admin-password]");
      if (!form || !usernameInput || !passwordInput) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        passwordInput.value = "";
        try {
          session = await client.login(username, password);
          overview = null;
          controlPlane = null;
          detail = null;
          target.innerHTML = renderLoading();
          await refresh();
        } catch (error) {
          const message = target == null ? void 0 : target.querySelector("[data-admin-login-error]");
          if (message) message.textContent = loginErrorMessage(error);
        }
      });
    };
    const logout = async () => {
      activeRequest == null ? void 0 : activeRequest.abort();
      clearSchedule();
      registration.stop();
      try {
        await client.logout();
      } catch (_error) {
      }
      showLogin("Admin session byla ukončena.");
    };
    const showLogin = (message) => {
      session = null;
      overview = null;
      detail = null;
      controlPlane = null;
      if (target) target.innerHTML = renderLogin(message);
      bindLogin();
    };
    const handleError = (error) => {
      var _a;
      if (!target) return;
      if (error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"))) {
        showLogin(error.code === "ADMIN_SESSION_EXPIRED" ? "Admin session vypršela." : void 0);
        return;
      }
      target.innerHTML = renderUnavailable(error instanceof Error ? error.message : "Monitoring není dostupný.");
      (_a = target.querySelector("[data-admin-refresh]")) == null ? void 0 : _a.addEventListener("click", () => void refresh());
    };
    const handleVisibility = () => {
      if (document.hidden) {
        activeRequest == null ? void 0 : activeRequest.abort();
        clearSchedule();
        registration.stop();
      } else {
        registration.start();
        if (session) void refresh();
      }
    };
    const schedule = (delay) => {
      clearSchedule();
      timer = setTimeout(() => void refresh(), delay);
    };
    const clearSchedule = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const registration = createAdminRegistrationController({
      client,
      target: () => target,
      selectedInstanceId: () => selectedInstanceId,
      controlPlane: () => controlPlane,
      refresh,
      createKey
    });
    const creation = createAdminCreateController({
      client,
      target: () => target,
      state: () => ({ wizardOpen, wizardStep, idempotencyKey: createIdempotencyKey }),
      updateState: (next) => {
        if (next.wizardOpen !== void 0) wizardOpen = next.wizardOpen;
        if (next.wizardStep !== void 0) wizardStep = next.wizardStep;
        if (next.idempotencyKey !== void 0) createIdempotencyKey = next.idempotencyKey;
      },
      selectInstance: (instanceId) => {
        selectedInstanceId = instanceId;
        updateUrl(instanceId);
      },
      render,
      refresh,
      createKey
    });
    return { mount, refresh };
  };
  const selectedFromUrl = () => typeof location === "undefined" ? null : new URL(location.href).searchParams.get("instance");
  const updateUrl = (instanceId) => {
    const url = new URL(location.href);
    instanceId ? url.searchParams.set("instance", instanceId) : url.searchParams.delete("instance");
    history.replaceState(null, "", url);
  };
  const isAbort = (error) => error instanceof DOMException && error.name === "AbortError";
  const createKey = () => `admin-ui:${crypto.randomUUID()}`;
  const readFrontendBuildSha = () => {
    var _a;
    const value = ((_a = document.querySelector('meta[name="empire-build-sha"]')) == null ? void 0 : _a.content.trim()) ?? "";
    return value && value !== "__EMPIRE_BUILD_SHA__" && value !== "local" ? value : null;
  };
  const initialLoginMessage = (error) => {
    if (error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"))) {
      return error.code === "ADMIN_SESSION_EXPIRED" ? "Admin session vypršela." : void 0;
    }
    if (error instanceof AdminApiError && error.code === "ADMIN_CONFIGURATION_UNAVAILABLE") {
      return "Admin API momentálně není připojené k databázi. Přihlášení můžeš zkusit, ale serverové připojení musí být nejdřív dostupné.";
    }
    return "Admin API momentálně neodpovídá. Přihlašovací formulář zůstává dostupný pro další pokus.";
  };
  const loginErrorMessage = (error) => {
    if (error instanceof AdminApiError && error.code === "ADMIN_INVALID_RESPONSE") {
      return "Admin API nevrátilo platná data. Nepoužívej VS Code Live Server; spusť `npm run dev:hosted-api` a `npm run dev:admin`.";
    }
    if (error instanceof AdminApiError && error.code === "ADMIN_CONFIGURATION_UNAVAILABLE") {
      return "Admin server nemá nastavené databázové připojení. Zkontroluj produkční EMPIRE_DATABASE_URL.";
    }
    if (error instanceof AdminApiError && error.code === "ADMIN_DATABASE_UNAVAILABLE") {
      return "Admin databáze je právě nedostupná. Zkus přihlášení znovu později.";
    }
    return error instanceof Error ? error.message : "Přihlášení selhalo.";
  };
  void createAdminApp().mount();
})();
