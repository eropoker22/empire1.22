window.Empire = window.Empire || {};

window.Empire.UI = (() => {
  const weaponCatalog = [
    "Baseballová pálka",
    "Pouliční pistole",
    "Granát",
    "Samopal",
    "Bazuka"
  ];

  const BASE_WEAPON_POWER = Object.freeze({
    attack: Object.freeze({
      "Baseballová pálka": 5,
      "Pouliční pistole": 10,
      Granát: 14,
      Samopal: 18,
      Bazuka: 30
    }),
    defense: Object.freeze({
      "Neprůstřelná vesta": 6,
      "Ocelové barikády": 12,
      "Bezpečnostní kamery": 6,
      "Automatické kulometné stanoviště": 20,
      Alarm: 10
    })
  });
  const BASE_WEAPON_POPULATION_REQUIREMENTS = Object.freeze({
    attack: Object.freeze({
      "Baseballová pálka": 50,
      "Pouliční pistole": 100,
      Granát: 150,
      Samopal: 200,
      Bazuka: 250
    }),
    defense: Object.freeze({
      "Neprůstřelná vesta": 50,
      "Ocelové barikády": 100,
      "Bezpečnostní kamery": 150,
      "Automatické kulometné stanoviště": 200,
      Alarm: 250
    })
  });

  const attackWeaponStats = [
    { name: "Baseballová pálka", power: BASE_WEAPON_POWER.attack["Baseballová pálka"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.attack["Baseballová pálka"] },
    { name: "Pouliční pistole", power: BASE_WEAPON_POWER.attack["Pouliční pistole"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.attack["Pouliční pistole"] },
    { name: "Granát", power: BASE_WEAPON_POWER.attack["Granát"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.attack["Granát"] },
    { name: "Samopal", power: BASE_WEAPON_POWER.attack.Samopal, requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.attack.Samopal },
    { name: "Bazuka", power: BASE_WEAPON_POWER.attack.Bazuka, requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.attack.Bazuka }
  ];

  const LEGACY_ATTACK_WEAPON_ALIASES = Object.freeze({
    Pistole: "Pouliční pistole",
    "Samopal (SMG)": "Samopal",
    "Útočná puška": "Samopal",
    "Explozivní nálož": "Granát",
    Granat: "Granát",
    grenade: "Granát",
    Grenade: "Granát",
    bazooka: "Bazuka",
    Bazooka: "Bazuka",
    smg: "Samopal",
    SMG: "Samopal",
    street_pistol: "Pouliční pistole",
    streetPistol: "Pouliční pistole",
    baseball_bat: "Baseballová pálka",
    baseballBat: "Baseballová pálka"
  });

  const defenseCatalog = [
    "Neprůstřelná vesta",
    "Ocelové barikády",
    "Bezpečnostní kamery",
    "Automatické kulometné stanoviště",
    "Alarm"
  ];

  const defenseWeaponStats = [
    { name: "Neprůstřelná vesta", power: BASE_WEAPON_POWER.defense["Neprůstřelná vesta"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.defense["Neprůstřelná vesta"] },
    { name: "Ocelové barikády", power: BASE_WEAPON_POWER.defense["Ocelové barikády"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.defense["Ocelové barikády"] },
    { name: "Bezpečnostní kamery", power: BASE_WEAPON_POWER.defense["Bezpečnostní kamery"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.defense["Bezpečnostní kamery"] },
    { name: "Automatické kulometné stanoviště", power: BASE_WEAPON_POWER.defense["Automatické kulometné stanoviště"], requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.defense["Automatické kulometné stanoviště"] },
    { name: "Alarm", power: BASE_WEAPON_POWER.defense.Alarm, requiredMembers: BASE_WEAPON_POPULATION_REQUIREMENTS.defense.Alarm }
  ];

  const weaponSpecialMeta = Object.freeze({
    attack: Object.freeze({
      "Granát": Object.freeze({ specialText: "Ignoruje 0.3 % obrany za ks" }),
      "Samopal": Object.freeze({ specialText: "+0.2 power za ks při použití všech 5 attack zbraní" }),
      "Bazuka": Object.freeze({ specialText: "+0.5 % šance na totální destrukci districtu za ks" })
    }),
    defense: Object.freeze({
      "Neprůstřelná vesta": Object.freeze({ specialText: "-0.5 % ztráty obránců za ks" }),
      "Bezpečnostní kamery": Object.freeze({ specialText: "5+ ks = velká šance odhalit špeha" }),
      "Automatické kulometné stanoviště": Object.freeze({ specialText: "-0.3 % síla útoku útočníka za ks" }),
      Alarm: Object.freeze({ specialText: "5+ ks = velká šance selhání vykradení" })
    })
  });
  const uiFormatHelpers = window.Empire.UIHelpers?.createFormatHelpers?.() || null;
  const uiMoneyHelpers = window.Empire.UIHelpers?.createMoneyHelpers?.() || null;

  function resolveAttackWeaponSpecialText(name) {
    return getCombatHelperController()?.resolveAttackWeaponSpecialText?.(name) || "";
  }

  function resolveDefenseWeaponSpecialText(name) {
    return getCombatHelperController()?.resolveDefenseWeaponSpecialText?.(name) || "";
  }

  function getDistrictDefenseWeaponCounts(districtId) {
    return getCombatHelperController()?.getDistrictDefenseWeaponCounts?.(districtId) || {};
  }

  function formatDecimalValue(value, maxFractions = 2) {
    return uiFormatHelpers?.formatDecimalValue?.(value, maxFractions) || "0";
  }

  function escapeHtml(value) {
    return uiFormatHelpers?.escapeHtml?.(value) || "";
  }

  function resolveDistrictDefenseSpecialModifiers(districtId) {
    return getCombatHelperController()?.resolveDistrictDefenseSpecialModifiers?.(districtId) || {
      weaponCounts: {},
      vestCount: 0,
      barricadeCount: 0,
      cameraCount: 0,
      mgNestCount: 0,
      alarmCount: 0,
      defenderMemberLossReductionPct: 0,
      attackDurationIncreasePct: 0,
      attackerAttackPenaltyPct: 0,
      spyDetectionBoostActive: false,
      raidAlarmBoostActive: false
    };
  }

  function resolveAttackDurationMsForDistrict(district) {
    return getCombatHelperController()?.resolveAttackDurationMsForDistrict?.(district) || ATTACK_ACTION_DURATION_MS;
  }

  function resolveActivatedAttackSpecialEffects(selection, district) {
    return getCombatHelperController()?.resolveActivatedAttackSpecialEffects?.(selection, district) || [];
  }

  function getSelectedAttackWeaponCount(selection, weaponName) {
    return getCombatHelperController()?.getSelectedAttackWeaponCount?.(selection, weaponName) || 0;
  }

  function hasFullAttackWeaponSet(selection) {
    return Boolean(getCombatHelperController()?.hasFullAttackWeaponSet?.(selection));
  }

  function getAttackSpecialModifiers(selection) {
    return getCombatHelperController()?.getAttackSpecialModifiers?.(selection) || {
      grenadeDefenseIgnorePct: 0,
      smgBonusPower: 0,
      bazookaCatastropheChancePct: 0,
      fullSetUsed: false
    };
  }

  function calculateAttackPowerFromSelection(selection) {
    return getCombatHelperController()?.calculateAttackPowerFromSelection?.(selection) || {
      rawPower: 0,
      special: getAttackSpecialModifiers(selection),
      fitnessAttackBoostPct: 0
    };
  }
  const DEMO_WEAPON_STACK_SIZE = 10;
  const DEMO_OWNER_AVATAR_POOL = Object.freeze([
    "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
    "../img/avatars/Mafia/8d2dcbe6-00d3-4b6f-98a0-53dc914346c5.jpg",
    "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
    "../img/avatars/Kartel/37b9a32a-4710-4060-a1a9-5cf2e2c924c7.jpg",
    "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
    "../img/avatars/Hacker/53867e7d-cc7e-4f92-b391-88f44bf7e349.jpg",
    "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg",
    "../img/avatars/Korporat/2ef61d31-c01c-44a3-bca5-6171166352b0.jpg",
    "../img/avatars/Motogang/grok_image_1773621173474.jpg",
    "../img/avatars/Motogang/grok_image_1773621230721.jpg",
    "../img/avatars/polucnigang/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
    "../img/avatars/polucnigang/f9b2211e-30fb-46ab-aa4c-16913d8a92c6.jpg",
    "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
    "../img/avatars/SoukromaArmada/bbe6342a-cf92-4459-af42-dbb7beba19f6.jpg",
    "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
    "../img/avatars/Tajnaorganizace/0870f362-b2ce-4607-ad3f-a96b59afcc8d.jpg",
    "../img/avatars/Mafia/grok_image_1773619750005.jpg",
    "../img/avatars/Kartel/f7281b4a-f79f-4d76-b975-5153d414208f.jpg",
    "../img/avatars/Hacker/grok_image_1773621797044.jpg",
    "../img/avatars/Korporat/e4286e80-0587-4e0e-afe4-70c348ee59dd.jpg"
  ]);
  const ONBOARDING_PROFILE_AVATAR = "../img/onboarding.jpg";
  const DEMO_OWNER_FACTIONS = Object.freeze([
    "Mafián",
    "Kartel",
    "Hackeři",
    "Korporace",
    "Motorkářský gang",
    "Pouliční gang",
    "Soukromá armáda",
    "Tajná organizace"
  ]);
  const DEMO_DISTRICT_ATMOSPHERES = Object.freeze({
    downtown: [
      "Luxusní a pod kontrolou",
      "Sterilní a vypjatá",
      "Neonově přepychová"
    ],
    commercial: [
      "Rušná a obchodní",
      "Přelidněná a hlučná",
      "Výdělečná a napjatá"
    ],
    residential: [
      "Napjatá a osobní",
      "Přeplněná a neklidná",
      "Tichá jen na oko"
    ],
    industrial: [
      "Drsná a kovová",
      "Špinavá a těžká",
      "Kouřová a unavená"
    ],
    park: [
      "Temná a podsvětní",
      "Neonová a opuštěná",
      "Divoká a neklidná"
    ],
    default: [
      "Neonová a pod kontrolou",
      "Napjatá a živá",
      "Chladná a ostražitá"
    ]
  });

  const storageDrugTypes = [
    { key: "neonDust", resourceKey: "neon_dust", name: "Neon Dust" },
    { key: "pulseShot", resourceKey: "pulse_shot", name: "Pulse Shot" },
    { key: "velvetSmoke", resourceKey: "velvet_smoke", name: "Velvet Smoke" },
    { key: "ghostSerum", resourceKey: "ghost_serum", name: "Ghost Serum" },
    { key: "overdriveX", resourceKey: "overdrive_x", name: "Overdrive X" }
  ];
  const pharmacySupplyTypes = [
    { key: "chemicals", name: "Chemicals" },
    { key: "biomass", name: "Biomass" },
    { key: "stimPack", name: "Stim Pack" }
  ];
  const factorySupplyTypes = [
    { key: "metalParts", name: "Metal Parts" },
    { key: "techCore", name: "Tech Core" },
    { key: "combatModule", name: "Combat Module" }
  ];
  const ALLIANCE_ICON_OPTIONS = Object.freeze([
    { key: "crown_skull", label: "Lebka s korunou", symbol: "☠" },
    { key: "crossed_knives", label: "Zkřížené nože", symbol: "⚔" },
    { key: "broken_shield", label: "Štít", symbol: "⛨" },
    { key: "snake_dagger", label: "Had kolem nože", symbol: "🐍" },
    { key: "eye_triangle", label: "Oko", symbol: "◉" },
    { key: "flame", label: "Plamen", symbol: "🔥" },
    { key: "spider", label: "Pavouk", symbol: "🕷" },
    { key: "lightning", label: "Blesk", symbol: "⚡" },
    { key: "wolf_head", label: "Vlčí hlava", symbol: "🐺" },
    { key: "broken_mask", label: "Maska", symbol: "🎭" }
  ]);
  const DEFAULT_ALLIANCE_ICON_KEY = "crown_skull";
  const ALLIANCE_MAX_MEMBERS = 4;
  const LOCAL_ALLIANCE_REQUEST_PLAYER_ID = "guest-player";
  const LOCAL_SCENARIO_DISTRICT_INCOME_RULES = Object.freeze({
    commercial: Object.freeze({ clean: 3, dirty: 1 }),
    industrial: Object.freeze({ clean: 3, dirty: 1 }),
    park: Object.freeze({ clean: 2, dirty: 1 }),
    residential: Object.freeze({ clean: 2, dirty: 0.5 }),
    downtown: Object.freeze({ clean: 5, dirty: 2 })
  });
  const BLACKOUT_PLAYER_FALLBACK_DISTRICT_IDS = Object.freeze([84, 95, 92, 120, 126]);
  const BLACKOUT_SCENARIO_INCOME_STORAGE_KEY = "blackoutDistrictIncomeLastAppliedAt";
  const ALLIANCE_READY_WINDOW_MS = 6 * 60 * 60 * 1000;
  const ALLIANCE_TRAP_GRACE_MS = 20 * 1000;
  const DEFAULT_ALLIANCE_DESCRIPTION = "Aliance která všechny zabije";
  const PLAYER_SCENARIO_STORAGE_KEY = "empire_active_player_scenario";
  const DISTRICT_RAID_LOCK_STORAGE_KEY = "empire_district_raid_lock_until_v1";
  const HEAT_JOURNAL_STORAGE_KEY = "empire_heat_journal_v1";
  const HEAT_DIRTY_REDUCTION_STORAGE_KEY = "empire_heat_dirty_reduction_v1";
  const INFO_WINDOWS_HISTORY_STORAGE_KEY = "empire_info_windows_history_v1";
  const INFO_WINDOWS_HISTORY_LIMIT = 80;
  const MARKET_SERVER_RESOURCES = Object.freeze([
    { resourceKey: "neon_dust", name: "Neon Dust" },
    { resourceKey: "pulse_shot", name: "Pulse Shot" },
    { resourceKey: "velvet_smoke", name: "Velvet Smoke" },
    { resourceKey: "ghost_serum", name: "Ghost Serum" },
    { resourceKey: "overdrive_x", name: "Overdrive X" },
    { resourceKey: "weapons", name: "Zbraně" },
    { resourceKey: "materials", name: "Materiály" },
    { resourceKey: "data_shards", name: "Data" }
  ]);
  const MARKET_BLACK_RESOURCE_GROUPS = Object.freeze([
    Object.freeze({
      label: "Lékárna",
      options: pharmacySupplyTypes.map((item) => ({
        resourceKey: item.key === "stimPack" ? "stim_pack" : item.key,
        name: item.name
      }))
    }),
    Object.freeze({
      label: "Drug Lab",
      options: storageDrugTypes.map((item) => ({
        resourceKey: item.resourceKey,
        name: item.name
      }))
    }),
    Object.freeze({
      label: "Továrna",
      options: factorySupplyTypes.map((item) => ({
        resourceKey:
          item.key === "metalParts" ? "metal_parts"
          : item.key === "techCore" ? "tech_core"
          : "combat_module",
        name: item.name
      }))
    }),
    Object.freeze({
      label: "Útočné zbraně",
      options: [
        { resourceKey: "baseball_bat", name: "Baseballová pálka" },
        { resourceKey: "street_pistol", name: "Pouliční pistole" },
        { resourceKey: "grenade", name: "Granát" },
        { resourceKey: "smg", name: "Samopal" },
        { resourceKey: "bazooka", name: "Bazuka" }
      ]
    }),
    Object.freeze({
      label: "Obranné zbraně",
      options: [
        { resourceKey: "bulletproof_vest", name: "Neprůstřelná vesta" },
        { resourceKey: "steel_barricades", name: "Ocelové barikády" },
        { resourceKey: "security_cameras", name: "Bezpečnostní kamery" },
        { resourceKey: "auto_mg_nest", name: "Automatické kulometné stanoviště" },
        { resourceKey: "alarm_system", name: "Alarm" }
      ]
    })
  ]);
  const MARKET_BLACK_RESOURCES = Object.freeze(MARKET_BLACK_RESOURCE_GROUPS.flatMap((group) => group.options));
  const MARKET_RESOURCE_LABELS = Object.freeze(
    [...MARKET_SERVER_RESOURCES, ...MARKET_BLACK_RESOURCES].reduce((acc, item) => {
      if (!acc[item.resourceKey]) acc[item.resourceKey] = item.name;
      return acc;
    }, {})
  );

  const SETTINGS_STORAGE_KEY = "empire_settings";
  const ATTACK_TARGET_COOLDOWN_STORAGE_KEY = "empire_attack_target_cooldown_state_v1";
  const ATTACK_TARGET_COOLDOWN_MS = 30 * 1000;
  const ATTACK_ACTION_DURATION_MS = 20 * 1000;
  const ATTACK_REQUEST_TIMEOUT_MS = 15000;
  const ATTACK_ACTION_LOCK_STORAGE_KEY = "empire_attack_action_lock_until_v1";
  const DISTRICT_TRAP_STORAGE_KEY = "empire_district_trap_state_v1";
  const ATTACK_TARGET_LOCK_STORAGE_KEY = "empire_attack_target_lock_state_v1";
  const TRAP_ATTACK_TARGET_LOCK_MS = 5 * 60 * 60 * 1000;
  const TRAP_MOVE_COOLDOWN_MS = 20 * 1000;
  const RAID_COOLDOWN_STORAGE_KEY = "empire_raid_cooldown_until_v1";
  const RAID_BASE_COOLDOWN_MS = 30 * 1000;
  const RAID_ACTION_DURATION_MS = 20 * 1000;
  const DISTRICT_RAID_LOCK_MS = 2 * 60 * 60 * 1000;
  const GANG_HEAT_DIRTY_COST = 500;
  const GANG_HEAT_DIRTY_REDUCTION = 10;
  const GANG_HEAT_CLEAN_COST = 300;
  const GANG_HEAT_CLEAN_REDUCTION = 15;
  const GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS = 30 * 60 * 1000;
  const GANG_HEAT_DIRTY_TRIGGER_COUNT = 3;
  const GANG_HEAT_POLICE_DURATION_MS = 60 * 60 * 1000;
  const ONBOARDING_ACTION_DURATION_MS = 5 * 1000;

  function resolveOnboardingActionDurationMs(baseDurationMs) {
    return isOnboardingDemoScenarioActive()
      ? ONBOARDING_ACTION_DURATION_MS
      : Math.max(1000, Math.floor(Number(baseDurationMs || 0)));
  }
  const POLICE_RAID_TIER1 = Object.freeze({
    cleanConfiscationPct: 2,
    dirtyConfiscationPctMin: 8,
    dirtyConfiscationPctMax: 15,
    arrestsPct: 12,
    influencePenaltyPct: 5,
    incomePenaltyPct: 10
  });
  const POLICE_RAID_TIER2 = Object.freeze({
    cleanConfiscationPctMin: 2,
    cleanConfiscationPctMax: 7,
    dirtyConfiscationPctMin: 16,
    dirtyConfiscationPctMax: 20,
    drugLossPct: 5,
    arrestsPctMin: 3,
    arrestsPctMax: 7,
    attackWeaponLossPct: 3,
    influencePenaltyPctMin: 6,
    influencePenaltyPctMax: 8,
    incomePenaltyPct: 20,
    productionPenaltyPct: 10
  });
  const POLICE_RAID_TIER3 = Object.freeze({
    incomePenaltyPctMin: 21,
    incomePenaltyPctMax: 26,
    cleanConfiscationPctMin: 2,
    cleanConfiscationPctMax: 7,
    dirtyConfiscationPctMin: 16,
    dirtyConfiscationPctMax: 20,
    drugLossPctMin: 6,
    drugLossPctMax: 9,
    arrestsPctMin: 7,
    arrestsPctMax: 12,
    attackWeaponLossPctMin: 3,
    attackWeaponLossPctMax: 8,
    defenseWeaponLossPctMin: 3,
    defenseWeaponLossPctMax: 8,
    influencePenaltyPctMin: 8,
    influencePenaltyPctMax: 12,
    labProductionPenaltyPctMin: 11,
    labProductionPenaltyPctMax: 13,
    armoryProductionPenaltyPctMin: 8,
    armoryProductionPenaltyPctMax: 13
  });
  const POLICE_RAID_TIER4 = Object.freeze({
    incomePenaltyPctMin: 26,
    incomePenaltyPctMax: 33,
    cleanConfiscationPctMin: 7,
    cleanConfiscationPctMax: 12,
    dirtyConfiscationPctMin: 18,
    dirtyConfiscationPctMax: 23,
    drugLossPctMin: 10,
    drugLossPctMax: 15,
    arrestsPctMin: 11,
    arrestsPctMax: 17,
    attackWeaponLossPct: 11,
    defenseWeaponLossPct: 11,
    attackPowerPenaltyPct: 8,
    defensePowerPenaltyPct: 10,
    influencePenaltyPctMin: 11,
    influencePenaltyPctMax: 14,
    labProductionPenaltyPctMin: 13,
    labProductionPenaltyPctMax: 15,
    armoryProductionPenaltyPctMin: 12,
    armoryProductionPenaltyPctMax: 16
  });
  const POLICE_RAID_TIER5 = Object.freeze({
    incomePenaltyPctMin: 32,
    incomePenaltyPctMax: 40,
    cleanConfiscationPctMin: 14,
    cleanConfiscationPctMax: 18,
    dirtyConfiscationPctMin: 23,
    dirtyConfiscationPctMax: 28,
    materialLossPct: 30,
    drugLossPctMin: 15,
    drugLossPctMax: 17,
    arrestsPctMin: 18,
    arrestsPctMax: 23,
    attackWeaponLossPct: 13,
    defenseWeaponLossPct: 14,
    attackPowerPenaltyPct: 15,
    defensePowerPenaltyPct: 15,
    influencePenaltyPctMin: 14,
    influencePenaltyPctMax: 17,
    productionFreezePct: 100
  });
  const POLICE_RAID_TIER6 = Object.freeze({
    incomePenaltyPct: 100,
    cleanConfiscationPct: 25,
    dirtyConfiscationPct: 45,
    drugLossPct: 23,
    materialLossPct: 35,
    arrestsPct: 30,
    attackWeaponLossPct: 20,
    defenseWeaponLossPct: 20,
    attackPowerPenaltyPct: 30,
    defensePowerPenaltyPct: 30,
    influencePenaltyPct: 25,
    productionFreezePct: 100
  });
  const POLICE_RAID_SPECIALTIES = Object.freeze({
    financial: Object.freeze({ label: "Finanční zásah", icon: "💰" }),
    drug: Object.freeze({ label: "Drogová razie", icon: "🧪" }),
    weapons: Object.freeze({ label: "Zbrojní zásah", icon: "🛡️" }),
    arrests: Object.freeze({ label: "Zatýkací vlna", icon: "👥" }),
    total: Object.freeze({ label: "Celková razie", icon: "⚠️" })
  });
  const POLICE_RAID_SPECIALTY_RANDOM_WEIGHTS = Object.freeze([
    Object.freeze({ key: "total", weight: 55 }),
    Object.freeze({ key: "financial", weight: 11.25 }),
    Object.freeze({ key: "drug", weight: 11.25 }),
    Object.freeze({ key: "weapons", weight: 11.25 }),
    Object.freeze({ key: "arrests", weight: 11.25 })
  ]);
  const POLICE_RAID_SPECIALTY_LOSS_MULTIPLIERS = Object.freeze({
    total: Object.freeze({
      clean: 1,
      dirty: 1,
      income: 1,
      influence: 1,
      arrests: 1,
      drugs: 1,
      attackWeapons: 1,
      defenseWeapons: 1,
      materials: 1,
      labProduction: 1,
      armoryProduction: 1,
      factoryProduction: 1,
      attackPower: 1,
      defensePower: 1
    }),
    financial: Object.freeze({
      clean: 1.35,
      dirty: 1.35,
      income: 1.2,
      influence: 1.15,
      arrests: 0.7,
      drugs: 0.55,
      attackWeapons: 0.6,
      defenseWeapons: 0.6,
      materials: 0.65,
      labProduction: 0.65,
      armoryProduction: 0.6,
      factoryProduction: 0.7,
      attackPower: 0.7,
      defensePower: 0.7
    }),
    drug: Object.freeze({
      clean: 0.75,
      dirty: 1.05,
      income: 1.1,
      influence: 0.9,
      arrests: 0.9,
      drugs: 1.55,
      attackWeapons: 0.7,
      defenseWeapons: 0.7,
      materials: 0.75,
      labProduction: 1.45,
      armoryProduction: 0.7,
      factoryProduction: 0.75,
      attackPower: 0.8,
      defensePower: 0.8
    }),
    weapons: Object.freeze({
      clean: 0.8,
      dirty: 0.95,
      income: 1.05,
      influence: 0.95,
      arrests: 0.85,
      drugs: 0.7,
      attackWeapons: 1.45,
      defenseWeapons: 1.45,
      materials: 1.35,
      labProduction: 0.75,
      armoryProduction: 1.45,
      factoryProduction: 1.35,
      attackPower: 1.25,
      defensePower: 1.25
    }),
    arrests: Object.freeze({
      clean: 0.7,
      dirty: 0.8,
      income: 1,
      influence: 1.05,
      arrests: 1.55,
      drugs: 0.6,
      attackWeapons: 0.7,
      defenseWeapons: 0.7,
      materials: 0.7,
      labProduction: 0.7,
      armoryProduction: 0.7,
      factoryProduction: 0.7,
      attackPower: 0.9,
      defensePower: 0.95
    })
  });
  const POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY = "empire_police_raid_prod_penalty_until_v1";
  const POLICE_RAID_INCOME_PENALTY_STORAGE_KEY = "empire_police_raid_income_penalty_map_v1";
  const POLICE_RAID_COMBAT_PENALTY_STORAGE_KEY = "empire_police_raid_combat_penalty_v1";
  const POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY = "empire_police_raid_building_action_lock_v1";
  const POLICE_RAID_FACTORY_SUPPLIES_STORAGE_KEY = "empire_factory_player_supplies_v1";
  const appliedPoliceRaidImpactKeys = new Set();
  const POLICE_ACTION_TIER_MESSAGES = Object.freeze({
    1: Object.freeze({
      title: "LEHKÁ KONTROLA",
      tone: "is-tier-1",
      text: "Policie se tu jen motá. Pár otázek, pár pohledů zatím nic, co by tě mělo rozhodit."
    }),
    2: Object.freeze({
      title: "🟡 PODEZŘENÍ",
      tone: "is-tier-2",
      text: "Začínají čmuchat víc, než je zdrávo. Někdo něco řekl a oni to berou vážně."
    }),
    3: Object.freeze({
      title: "🟠 TLAK NA DISTRICT",
      tone: "is-tier-3",
      text: "Už to není náhoda. Kontroly, výslechy, lidi mizí z ulic. Policie tlačí a začíná to smrdět průserem."
    }),
    4: Object.freeze({
      title: "🔴 AKTIVNÍ RAZIE",
      tone: "is-tier-4",
      text: "Vlítli tam bez varování. Dveře v hajzlu, lidi na zemi. Berou všechno, co najdou a neptají se."
    }),
    5: Object.freeze({
      title: "🔴 BRUTÁLNÍ ZÁTAH",
      tone: "is-tier-5",
      text: "Tohle už není razie, to je masakr. Mlátí, berou, ničí. Kdo se pohne blbě, skončí v pytli."
    }),
    6: Object.freeze({
      title: "TOTÁLNÍ ČISTKA",
      tone: "is-tier-6",
      text: "Vlítli tam naplno. Sebrali cash, lidi i výbavu. District je vyčištěnej do mrtva a nikdo už tam nic neuhájí."
    })
  });
  const POLICE_ACTION_TIER_QUOTES = Object.freeze({
    1: Object.freeze([
      "Klídek, jen rutina ale ty mi tu nějak smrdíš.",
      "Dneska nic nehledám. Zatím. Ale pamatuju si ksichty.",
      "Hezký místo. Byla by škoda, kdybych se sem musel vrátit s partou.",
      "Ukaž, co tu schováváš nebo si to najdu sám příště.",
      "Neboj, dneska jen koukám. Zítra už možná beru.",
      "Máš štěstí, že mám dneska dobrou náladu.",
      "Zatím to nechám být ale něco mi říká, že se ještě uvidíme.",
      "Nedělej blbosti a možná tě nechám žít v klidu.",
      "Jen si tu dělám obrázek. A věř mi, že se rychle skládá.",
      "Dneska odcházím. Příště už nemusím."
    ]),
    2: Object.freeze([
      "Někdo začal mluvit a tvoje jméno padlo víc než jednou.",
      "Už to není jen rutina. Něco tu nesedí a ty víš co.",
      "Řekni mi to rovnou ušetříš si problémy. Možná.",
      "Začínáš mě fakt zajímat. A to nechceš.",
      "Vidím, jak se tu hýbou věci. A někdo za tím stojí.",
      "Ještě nejdu po tobě naplno ale blíž už být nemůžu.",
      "Stačí jedna chyba. A já tu nebudu sám.",
      "Máš kolem sebe dost bordelu. Dřív nebo později se v tom utopíš.",
      "Já už vím dost. Teď čekám, kolik toho najdu.",
      "Zatím tě jen sleduju ale věř mi, že to rychle skončí."
    ]),
    3: Object.freeze([
      "Už to tu máme pod kontrolou. Ty tu jen čekáš, až tě sundáme.",
      "Lidi mizí, obchody zavírají a ty jsi uprostřed toho bordelu.",
      "Každej kout tady znám. Nemáš se kam schovat.",
      "Tvoje malý impérium se začíná rozpadat. Slyšíš to praskání?",
      "Zatím jen tlačím. A ty už sotva dýcháš.",
      "Každej tvůj krok sledujem. Jedna chyba a končíš.",
      "Ulice už nejsou tvoje. Jen jsi poslední, kdo to ještě nepochopil.",
      "Tvoje lidi začínají mluvit. A věř mi, že rádi.",
      "Není to otázka jestli ale kdy tě rozkopeme na kusy.",
      "Tohle místo už patří nám. Ty jsi tu jen dočasnej problém."
    ]),
    4: Object.freeze([
      "Na zem! Teď hned, nebo tě tam dostanu já!",
      "Konec hry. Všechno jde ven lidi, prachy, zbraně.",
      "Dveře jsou v hajzlu a ty jdeš s nima.",
      "Ruce kde je vidím! Jedna blbost a končíš!",
      "Tohle jsme ti říkali. Teď už jen sklízíš, cos zasel.",
      "Bal to. Tady už nic nepatří tobě.",
      "Každej kout projdeme. Každou krysu vytáhnem.",
      "Už nejsi boss. Teď jsi jen další případ.",
      "Naložit všechno! Nic tu nezůstane!",
      "Měl jsi šanci to držet v klidu. Teď už je pozdě."
    ]),
    5: Object.freeze([
      "Na zem, kurva! Hned, nebo tě složím!",
      "Tohle už neřešíme v klidu. Tohle se řeší silou!",
      "Všechno bereme! Co se nevejde, rozbijem!",
      "Hýbneš se blbě a jdeš k zemi, jasný?!",
      "Tvoje hra skončila. Teď už jen počítáš ztráty!",
      "Nikdo neuteče! Zavřít to tady celý!",
      "Vytáhněte je ven! Každýho jednoho!",
      "Tady už se neptáme. Tady se bere!",
      "Podívej se kolem tohle je konec tvýho malýho království!",
      "Měl jsi odejít včas. Teď už tě jen roznesem na kusy!"
    ]),
    6: Object.freeze([
      "Hotovo. Tady už nic není.",
      "Vyčištěno do posledního šroubu. Můžeš začít znova jestli na to máš.",
      "Tohle místo skončilo. A ty s ním.",
      "Žádný lidi, žádný prachy, žádná moc. Jen prázdno.",
      "Tvoje impérium? Teď je to jen hromada sraček.",
      "Zbylo ti hovno. A to je ještě víc, než sis zasloužil.",
      "Ticho. Přesně takhle to tu má vypadat.",
      "Konec hry. Resetni se a zkus to znova líp.",
      "Tohle město si tě vyplivlo. A ani si toho nevšimlo.",
      "Zapomeň na to, co tu bylo. Už to neexistuje."
    ])
  });
  const POLICE_ACTION_SPECIALTY_QUOTES = Object.freeze({
    financial: Object.freeze([
      "Kde máš prachy? Protože já je teď beru.",
      "Účty zamražený. Cash zabavenej. Gratuluju.",
      "Tvoje peníze právě změnily majitele.",
      "Hraješ si na krále? Bez peněz jsi jen další nula.",
      "Všechno spočítaný, všechno zabavený. Nic ti nezbyde.",
      "Každej špinavej cent jde pryč. Do posledního.",
      "Můžeš si to vydělat znova. My ti to zase vezmem.",
      "Vidím, že jsi vydělával dobře. Škoda, že to nebylo tvoje.",
      "Tvoje impérium stojí na prachách. A ty právě zmizely.",
      "Hotovost, účty, zásoby všechno jde s náma."
    ]),
    drug: Object.freeze([
      "Cítím to už od dveří. A teď to všechno mizí.",
      "Vařil jsi velký věci. Teď to skončilo.",
      "Všechno bereme. Co nevezmem, zničíme.",
      "Tvoje výroba? Už jen odpad.",
      "Každej gram jde pryč. Do posledního.",
      "Tenhle bordel tu končí. Hned.",
      "Dneska nic neprodáš. Nemáš co.",
      "Zkoušel jsi jet ve velkým. Teď jdeš dolů.",
      "Tvoje laby už nejedou. Už nikdy.",
      "Tohle město ti tenhle byznys nenechá."
    ]),
    weapons: Object.freeze([
      "Kolik toho tu máš? Nevadí, všechno jde pryč.",
      "Bez zbraní nejsi nic. A přesně tam tě vracíme.",
      "Všechno zabavit. Nechci tu vidět ani nábojnici.",
      "Tvoje armáda právě přišla o zuby.",
      "Konec hraní na vojáky. Tohle není tvoje válka.",
      "Tyhle hračky ti nepatří. Už vůbec ne.",
      "Seberte to. Každou zbraň, každej kus.",
      "Teď jsi neozbrojenej. A dost zranitelnej.",
      "Zbraně pryč. Teď jsi jen cíl.",
      "Zkus to teď bez nich. Hodně štěstí."
    ]),
    arrests: Object.freeze([
      "Berem všechny. Jednoho po druhým.",
      "Tvoje lidi? Už nejsou tvoji.",
      "Do aut s nima. Všichni.",
      "Kdo tu zůstane, ten má sakra štěstí.",
      "Rozpadne se ti to pod rukama. Sleduj.",
      "Bez lidí nejsi nic. A přesně to teď jsi.",
      "Každýho naložit. Nechci tu nikoho vidět.",
      "Tvůj gang se právě rozpadl.",
      "Konec party. Jedete s náma.",
      "Zbyde ti pár krys jestli vůbec."
    ]),
    total: Object.freeze([
      "Probíhá razie. Drž hlavu dole a počítej ztráty.",
      "Razie je v běhu. Teď už jen sleduješ, co všechno zmizí.",
      "Policie je uvnitř. Tohle nebude levný.",
      "Běží celková razie. Všechno je teď pod tlakem.",
      "Razie právě začala. Nic kolem tebe není v bezpečí."
    ])
  });
  const POLICE_DISTRICT_CLICK_WARNING_QUOTES = Object.freeze([
    "Tady teď ne. Policie to tu právě rozjebává.",
    "Zapomeň na to. District je plnej policajtů."
  ]);
  const SPY_SUCCESS_EMPTY_DISTRICT_QUOTES = Object.freeze([
    "Špehování hotovo. Tvůj špeh je zpátky - prázdno jak v hrobě.",
    "Zpátky bez škrábnutí. Nikdo tam není, můžeš to sebrat.",
    "Špeh se vrátil. District úplně v píči prázdnej.",
    "Hotovo. Nula lidí, nula odporu. Free teritorium.",
    "Tvůj špeh žije a hlásí - nikdo to nedrží.",
    "Čistý průchod. District leží ladem, vezmi si ho.",
    "Špehování OK. Prázdno. Tohle je zadarmo, kurva.",
    "Zpátky v bezpečí. Nikdo tam není, jen čeká na tebe.",
    "Potvrzeno - prázdnej district. Stačí přijít a je tvůj.",
    "Špeh to projel a vrátil se. Nic tam není, žádný sračky."
  ]);
  const SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
    "Špeh zpátky. Máš je přečtený do poslední sračky.",
    "Hotovo. Všechno víš - lidi, zbraně, slabiny. Jsou odkrytí.",
    "Špeh se vrátil. Vidíš jim do všeho. Jsou v píči.",
    "Plný info. Každej kout, každej detail. Nemají šanci.",
    "Špehování čistý. Máš kompletní obraz - teď je roztrhej.",
    "Špeh zpátky. Obrana má díry jak kráva. Využij to.",
    "Všechno odkrytý. Víš přesně, kde je zlomit.",
    "Špeh donesl všechno. Jsou nahý jak svině.",
    "Hotovo. Máš jejich slabiny na talíři.",
    "Špeh žije a ví všechno. Teď jsi o krok před nima ve všem."
  ]);
  const SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
    "Špeh zpátky. Vypadá to prázdně ale něco tam smrdí.",
    "Nula lidí, ale nebylo to čistý. Špeh se stáhnul včas.",
    "District prázdnej, ale špeh měl namále. Něco tam nesedí.",
    "Špeh to projel napůl. Prázdno ale divnej pocit z toho místa.",
    "Nikdo tam není, ale nebylo to safe. Špeh radši zdrhnul.",
    "Prázdnej district, ale něco se tam hnulo. Špeh se stáhnul.",
    "Vypadá to čistě, ale špeh si není jistej. Něco tam nesedí.",
    "Špeh zpátky. Prázdno ale až moc tichý na tohle město.",
    "Nikdo tam není, ale špeh skoro narazil. Bacha na to.",
    "District bez lidí, ale nebyl to clean run. Něco tam může být."
  ]);
  const SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
    "Špeh něco vytáhl, ale zdaleka ne všechno. Můžeš je sundat nebo to totálně posrat.",
    "Nejsou úplně odkrytý. Něco tušíš, ale zbytek je pořádná mlha.",
    "Špeh je zpátky. Máš půlku pravdy a ta druhá půlka ti může pěkně zlomit vaz.",
    "Máš jen částečný info. Stačí to na pořádný risk, ale na jistotu to rozhodně není.",
    "Vidíš jim do karet jen napůl. Ten zbytek tě může pěkně kousnout do zadku."
  ]);
  const SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
    "Prázdno jak svině a stejně jsi o špeha přišel. To je solidní průser.",
    "Nikdo tam není, ale špeh je v prdeli. Něco tam nehraje.",
    "Free teritorium? Možná. Špeh už to neřekne.",
    "Špeh se nevrátil. Prázdno, ale kurevsky divný.",
    "District prázdnej a špeh v hajzlu. Gratuluju."
  ]);
  const SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
    "Špeh v prdeli. Chytli ho. Teď už vědí i o tobě.",
    "Průser. Špeha mají. A už vědí, kdo jim leze po rajónu.",
    "Zatkli ho. Nemáš žádný info - a oni mají tebe.",
    "Špeh v hajzlu. Chytli ho a teď je máš na krku.",
    "Chytli ho při práci. Teď už jen čekej, až si dojdou pro tebe.",
    "Špeh padl. A tvoje jméno už mezi nima koluje.",
    "Zajali ho. Nejenže nic nevíš, oni teď vědí o tobě až moc.",
    "Totální průser. Špeha mají a celý district je ve střehu.",
    "Špeh to totálně posral a teď je v jejich rukách. Gratuluju, jsi na řadě ty.",
    "Nemáš info. Oni mají tvýho člověka. Docela blbá rovnice, co?"
  ]);
  const SPY_DETECTION_WARNING_QUOTES = Object.freeze([
    "Chytili jsme jim špeha. Teď víš, kdo se ti hrabe v rajónu.",
    "Někdo tě zkoušel projet - nevyšlo mu to. Máš ho.",
    "Špeh chycený. Teď je na tobě, co s ním uděláš.",
    "Zachytili jsme krysu. A ví, pro koho makala.",
    "Někdo si na tebe dovolil. Teď máš jeho člověka v rukách.",
    "Špeh je u tebe. Oni chtěli info - teď jsi ho dostal ty.",
    "Zkusili tě projet potichu. Teď držíš jejich špinavou práci.",
    "Chytil jsi ho při činu. Teď víš, kdo po tobě jde.",
    "Nepřítel udělal chybu. A ty ji právě držíš v rukách.",
    "Špeh odhalen a zajat. Teď máš výhodu ty."
  ]);
  const SPY_ALLIANCE_DETECTION_WARNING_QUOTES = Object.freeze([
    "[ALLY] chytil nepřátelskýho špeha. Někdo si na nás dovolil.",
    "U [ALLY] odhalen špeh. Aliance je ve střehu.",
    "Zachycena krysa u [ALLY]. Víme, kdo po nás jde.",
    "[ALLY] má jejich špeha. Někdo nás zkoušel projet potichu.",
    "Špeh odhalen u [ALLY]. Držte se, někdo nás sleduje.",
    "[ALLY] zachytil infiltrace. Máme stopu na nepřítele.",
    "Nepřítel udělal chybu u [ALLY]. Teď máme výhodu.",
    "U [ALLY] chycen špeh. Aliance má oči otevřený.",
    "[ALLY] drží jejich člověka. Někdo se hrabe v našem rajónu.",
    "Špeh skončil u [ALLY]. Teď víme, odkud fouká vítr."
  ]);
  const OWNER_RAID_STORAGE_KEY = "empire_owner_raid_storage_v1";
  const DISTRICT_RAID_STASH_STORAGE_KEY = "empire_district_raid_stash_v1";
  const OCCUPY_ACTION_DURATION_MS = 20 * 1000;
  const SPY_ACTION_DURATION_MS = 20 * 1000;
  const SPY_RECOVERY_COOLDOWN_MS = 30 * 1000;
  const SPY_RECOVERY_TICK_MS = 1000;
  const GUEST_DEFAULT_DIRTY_MONEY = 5000;
  const DEFAULT_SETTINGS = Object.freeze({
    sound: true,
    music: true,
    notifications: true,
    effectsQuality: "high",
    language: "cs",
    mapDistrictBorders: true,
    mapAllianceSymbols: true,
    mapVisibilityMode: "all"
  });

  const districtBuildingCatalog = {
    downtown: [
      "Centrální banka",
      "Magistrát",
      "Lobby klub",
      "Burza",
      "Soud",
      "VIP salonek",
      "Letiště",
      "Přístav",
      "Parlament"
    ],
    commercial: [
      "Obchodní centrum",
      "Restaurace",
      "Herna",
      "Lékárna",
      "Kasino",
      "Autosalon",
      "Fitness Club",
      "Směnárna",
      "Kancelářský blok"
    ],
    residential: [
      "Bytový blok",
      "Rekrutační centrum",
      "Brainwash centrum",
      "Garage",
      "Taxi služba",
      "Klinika",
      "Škola"
    ],
    industrial: [
      "Továrna",
      "Zbrojovka",
      "Sklad",
      "Energetická stanice",
      "Datové centrum",
      "Výzkumné centrum",
      "Recyklační centrum"
    ],
    park: [
      "Drug lab",
      "Pašovací tunel",
      "Večerka",
      "Strip club",
      "Pouliční dealeři"
    ]
  };

  const buildingDistrictTypes = [
    { key: "commercial", label: "Commercial" },
    { key: "industrial", label: "Industrial" },
    { key: "residential", label: "Resident" },
    { key: "park", label: "Park" },
    { key: "downtown", label: "Downtown" }
  ];

  const districtTypeBackgrounds = {
    commercial: "../img/commercial/1.png",
    industrial: "../img/industrial/1.png",
    residential: "../img/residental/1.png",
    park: "../img/park/1.png",
    downtown: "../img/downtown/1.png"
  };

  const namedDowntownExchanges = [
    "Vortex Exchange"
  ];

  const namedDowntownCentralBanks = [
    "Iron Reserve Bank",
    "Obsidian Central Vault"
  ];

  const namedDowntownAirports = [
    "Neon Skyport"
  ];

  const namedDowntownLobbyClubs = [
    "Velvet Influence Club",
    "Shadow Lobby Lounge",
    "Golden Circle Club"
  ];

  const namedDowntownCityHalls = [
    "City Dominion Hall",
    "Urban Control Center"
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
    "Iron Verdict Hall",
    "Obsidian Tribunal"
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

  const namedCommercialOfficeBlocks = [
    "Iron Tower Offices",
    "Blackline Corporate Hub",
    "Neon Business Center",
    "Vortex Office Complex",
    "Skyline Syndicate Offices",
    "ShadowCorp Tower"
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

  const namedIndustrialDataCenters = [
    "NeuroGrid Core",
    "Black Node Nexus",
    "DataForge Complex",
    "Synapse Vault",
    "Quantum Relay Hub",
    "GhostNet Core",
    "Iron Pulse Servers",
    "DeepCode Facility",
    "CipherStack Center",
    "Neon Matrix Node"
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

  const namedIndustrialResearchCenters = [
    "Neon Research Hub",
    "IronMind Labs",
    "Quantum Black Lab",
    "Synapse Forge Center",
    "DarkPulse Research",
    "CipherWorks Institute",
    "NovaCore Laboratory",
    "Obsidian Research Vault"
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

  const namedResidentialBrainwashCenters = [
    "NeuroControl Lab",
    "MindHack Facility",
    "BlackMind Institute",
    "Synapse Override Center",
    "GhostMind Program",
    "PsyCore Lab",
    "Oblivion Mind Center",
    "Neural Dominion Hub",
    "ThoughtForge Facility",
    "Cortex Manipulation Lab"
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

  const namedResidentialTaxiServices = [
    "NightRide Taxi",
    "Neon Cab Co.",
    "GhostDrive Taxi",
    "StreetMove Transport",
    "RapidRide Taxi",
    "Shadow Cab Service",
    "Urban Wheels Taxi",
    "BlackRoute Taxi",
    "Velocity Cab",
    "Backstreet Taxi",
    "FlashRide Taxi"
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

  const commercialDistrictPools = {
    early: [
      {
        key: "early-stable-1",
        tier: "early",
        title: "Stabilní provoz",
        buildings: ["Restaurace", "Fitness Club"]
      },
      {
        key: "early-stable-2",
        tier: "early",
        title: "Civilní utility",
        buildings: ["Restaurace", "Lékárna"]
      },
      {
        key: "early-cash",
        tier: "early",
        title: "Lehký cashflow",
        buildings: ["Restaurace", "Směnárna"]
      },
      {
        key: "early-safe-3",
        tier: "early",
        title: "Bezpečný mix",
        buildings: ["Restaurace", "Lékárna", "Fitness Club"]
      },
      {
        key: "early-launder",
        tier: "early",
        title: "Startovní laundering",
        buildings: ["Autosalon", "Restaurace"]
      }
    ],
    mid: [
      {
        key: "mid-balance-1",
        tier: "mid",
        title: "Utility growth",
        buildings: ["Autosalon", "Lékárna"]
      },
      {
        key: "mid-balance-2",
        tier: "mid",
        title: "Finanční uzel",
        buildings: ["Autosalon", "Směnárna"]
      },
      {
        key: "mid-corp-1",
        tier: "mid",
        title: "Korporátní stabilita",
        buildings: ["Kancelářský blok", "Restaurace"]
      },
      {
        key: "mid-corp-2",
        tier: "mid",
        title: "Administrativní utility",
        buildings: ["Kancelářský blok", "Lékárna", "Restaurace"]
      },
      {
        key: "mid-mall-1",
        tier: "mid",
        title: "Hlavní retail",
        buildings: ["Obchodní centrum", "Restaurace"]
      },
      {
        key: "mid-mix-1",
        tier: "mid",
        title: "Vyvážený obchod",
        buildings: ["Restaurace", "Lékárna", "Směnárna"]
      },
      {
        key: "mid-mix-2",
        tier: "mid",
        title: "Prací front",
        buildings: ["Autosalon", "Směnárna", "Restaurace"]
      }
    ],
    top: [
      {
        key: "top-casino-1",
        tier: "top",
        title: "Kasino hotspot",
        buildings: ["Kasino", "Restaurace"]
      },
      {
        key: "top-casino-2",
        tier: "top",
        title: "Shady premium",
        buildings: ["Kasino", "Restaurace", "Lékárna"]
      },
      {
        key: "top-casino-3",
        tier: "top",
        title: "Black cash engine",
        buildings: ["Kasino", "Směnárna", "Autosalon"]
      },
      {
        key: "top-mall-1",
        tier: "top",
        title: "Prémiový retail",
        buildings: ["Obchodní centrum", "Lékárna", "Restaurace"]
      },
      {
        key: "top-mall-2",
        tier: "top",
        title: "Financial boulevard",
        buildings: ["Obchodní centrum", "Směnárna", "Restaurace"]
      }
    ]
  };

  const residentialDistrictPools = {
    early: [
      {
        key: "res-early-1",
        tier: "early",
        title: "Startovní růst",
        buildings: ["Bytový blok", "Garage"]
      },
      {
        key: "res-early-2",
        tier: "early",
        title: "Stabilní základna",
        buildings: ["Bytový blok", "Brainwash centrum"]
      },
      {
        key: "res-early-3",
        tier: "early",
        title: "První nábor",
        buildings: ["Bytový blok", "Rekrutační centrum"]
      },
      {
        key: "res-early-4",
        tier: "early",
        title: "Obytná kontrola",
        buildings: ["Bytový blok", "Brainwash centrum", "Garage"]
      }
    ],
    mid: [
      {
        key: "res-mid-1",
        tier: "mid",
        title: "Mobilní posily",
        buildings: ["Bytový blok", "Rekrutační centrum", "Garage"]
      },
      {
        key: "res-mid-2",
        tier: "mid",
        title: "Udržitelný růst",
        buildings: ["Bytový blok", "Klinika"]
      },
      {
        key: "res-mid-3",
        tier: "mid",
        title: "Disciplína a kvalita",
        buildings: ["Bytový blok", "Škola"]
      },
      {
        key: "res-mid-4",
        tier: "mid",
        title: "Loajalita a výcvik",
        buildings: ["Brainwash centrum", "Škola"]
      },
      {
        key: "res-mid-5",
        tier: "mid",
        title: "Regenerace fronty",
        buildings: ["Rekrutační centrum", "Klinika"]
      },
      {
        key: "res-mid-6",
        tier: "mid",
        title: "Kontrolovaný development",
        buildings: ["Bytový blok", "Brainwash centrum", "Škola"]
      }
    ],
    late: [
      {
        key: "res-late-1",
        tier: "late",
        title: "Válečné zázemí",
        buildings: ["Bytový blok", "Rekrutační centrum", "Klinika"]
      },
      {
        key: "res-late-2",
        tier: "late",
        title: "Mobilní tlak",
        buildings: ["Rekrutační centrum", "Garage", "Klinika"]
      },
      {
        key: "res-late-3",
        tier: "late",
        title: "Loajální populace",
        buildings: ["Bytový blok", "Brainwash centrum", "Klinika"]
      },
      {
        key: "res-late-4",
        tier: "late",
        title: "Elitní rezidenční zóna",
        buildings: ["Bytový blok", "Škola", "Klinika"]
      },
      {
        key: "res-late-5",
        tier: "late",
        title: "Strategická mobilizace",
        buildings: ["Bytový blok", "Rekrutační centrum", "Škola"]
      }
    ]
  };

  const parkDistrictPools = {
    early: [
      {
        key: "park-early-1",
        tier: "early",
        title: "Street cash",
        buildings: ["Pouliční dealeři", "Večerka"]
      },
      {
        key: "park-early-2",
        tier: "early",
        title: "Quick runners",
        buildings: ["Pouliční dealeři", "Pašovací tunel"]
      },
      {
        key: "park-early-3",
        tier: "early",
        title: "Night cover",
        buildings: ["Strip club", "Večerka"]
      }
    ],
    mid: [
      {
        key: "park-mid-1",
        tier: "mid",
        title: "Distribution lane",
        buildings: ["Drug lab", "Pašovací tunel"]
      },
      {
        key: "park-mid-2",
        tier: "mid",
        title: "Vice market",
        buildings: ["Strip club", "Pouliční dealeři"]
      },
      {
        key: "park-mid-3",
        tier: "mid",
        title: "Covered traffic",
        buildings: ["Pašovací tunel", "Večerka"]
      },
      {
        key: "park-mid-4",
        tier: "mid",
        title: "Hidden production",
        buildings: ["Drug lab", "Večerka"]
      },
      {
        key: "park-mid-5",
        tier: "mid",
        title: "Night logistics",
        buildings: ["Strip club", "Pašovací tunel"]
      }
    ],
    top: [
      {
        key: "park-top-1",
        tier: "top",
        title: "Chaos corridor",
        buildings: ["Drug lab", "Pašovací tunel", "Pouliční dealeři"]
      },
      {
        key: "park-top-2",
        tier: "top",
        title: "Vice empire",
        buildings: ["Drug lab", "Strip club"]
      },
      {
        key: "park-top-3",
        tier: "top",
        title: "Black nightlife",
        buildings: ["Strip club", "Pouliční dealeři", "Večerka"]
      },
      {
        key: "park-top-4",
        tier: "top",
        title: "Hot route",
        buildings: ["Drug lab", "Pašovací tunel", "Večerka"]
      }
    ]
  };

  const industrialDistrictPools = {
    early: [
      {
        key: "ind-early-1",
        tier: "early",
        title: "Základní výroba",
        buildings: ["Továrna", "Sklad"]
      },
      {
        key: "ind-early-2",
        tier: "early",
        title: "Napájená produkce",
        buildings: ["Továrna", "Energetická stanice"]
      },
      {
        key: "ind-early-3",
        tier: "early",
        title: "První militarizace",
        buildings: ["Továrna", "Zbrojovka"]
      },
      {
        key: "ind-early-4",
        tier: "early",
        title: "Zásobovací uzel",
        buildings: ["Sklad", "Energetická stanice"]
      },
      {
        key: "ind-early-5",
        tier: "early",
        title: "Základní výzkum",
        buildings: ["Továrna", "Výzkumné centrum"]
      },
      {
        key: "ind-early-6",
        tier: "early",
        title: "Recyklační tok",
        buildings: ["Sklad", "Recyklační centrum"]
      }
    ],
    mid: [
      {
        key: "ind-mid-1",
        tier: "mid",
        title: "Vojenská výroba",
        buildings: ["Zbrojovka", "Sklad"]
      },
      {
        key: "ind-mid-2",
        tier: "mid",
        title: "Technický provoz",
        buildings: ["Továrna", "Datové centrum"]
      },
      {
        key: "ind-mid-3",
        tier: "mid",
        title: "Efektivní řetězec",
        buildings: ["Továrna", "Sklad", "Energetická stanice"]
      },
      {
        key: "ind-mid-4",
        tier: "mid",
        title: "Zbrojní logistika",
        buildings: ["Zbrojovka", "Sklad", "Energetická stanice"]
      },
      {
        key: "ind-mid-5",
        tier: "mid",
        title: "Datová výroba",
        buildings: ["Sklad", "Datové centrum"]
      },
      {
        key: "ind-mid-6",
        tier: "mid",
        title: "Výzkum a obrana",
        buildings: ["Výzkumné centrum", "Zbrojovka"]
      },
      {
        key: "ind-mid-7",
        tier: "mid",
        title: "Obnova zdrojů",
        buildings: ["Továrna", "Recyklační centrum", "Sklad"]
      }
    ],
    top: [
      {
        key: "ind-top-1",
        tier: "top",
        title: "Arms grid",
        buildings: ["Továrna", "Zbrojovka", "Sklad"]
      },
      {
        key: "ind-top-2",
        tier: "top",
        title: "Power forge",
        buildings: ["Továrna", "Zbrojovka", "Energetická stanice"]
      },
      {
        key: "ind-top-3",
        tier: "top",
        title: "Hack foundry",
        buildings: ["Zbrojovka", "Datové centrum", "Sklad"]
      },
      {
        key: "ind-top-4",
        tier: "top",
        title: "Critical infrastructure",
        buildings: ["Energetická stanice", "Datové centrum", "Sklad"]
      },
      {
        key: "ind-top-5",
        tier: "top",
        title: "War research nexus",
        buildings: ["Zbrojovka", "Výzkumné centrum", "Datové centrum"]
      },
      {
        key: "ind-top-6",
        tier: "top",
        title: "Circular war industry",
        buildings: ["Zbrojovka", "Recyklační centrum", "Továrna"]
      }
    ]
  };

  const downtownDistrictPools = {
    mid: [
      {
        key: "down-mid-1",
        tier: "mid",
        title: "Městské finance",
        buildings: ["Centrální banka", "Magistrát"]
      },
      {
        key: "down-mid-2",
        tier: "mid",
        title: "Politický vliv",
        buildings: ["Lobby klub", "Magistrát"]
      },
      {
        key: "down-mid-3",
        tier: "mid",
        title: "Právní tlak",
        buildings: ["Soud", "Lobby klub"]
      },
      {
        key: "down-mid-4",
        tier: "mid",
        title: "Volatilní kapitál",
        buildings: ["Burza", "VIP salonek"]
      }
    ],
    high: [
      {
        key: "down-high-1",
        tier: "high",
        title: "Korporátní kontrola",
        buildings: ["Centrální banka", "Lobby klub"]
      },
      {
        key: "down-high-2",
        tier: "high",
        title: "Státní pevnost",
        buildings: ["Magistrát", "Soud"]
      },
      {
        key: "down-high-3",
        tier: "high",
        title: "Elitní arbitráž",
        buildings: ["Soud", "VIP salonek"]
      },
      {
        key: "down-high-4",
        tier: "high",
        title: "Burzovní manipulace",
        buildings: ["Burza", "Lobby klub"]
      },
      {
        key: "down-high-5",
        tier: "high",
        title: "Executive chamber",
        buildings: ["Magistrát", "VIP salonek"]
      }
    ],
    core: [
      {
        key: "down-core-1",
        tier: "core",
        title: "Capital nexus",
        buildings: ["Centrální banka", "Magistrát", "VIP salonek"]
      },
      {
        key: "down-core-2",
        tier: "core",
        title: "Shadow exchange",
        buildings: ["Burza", "Lobby klub", "VIP salonek"]
      },
      {
        key: "down-core-3",
        tier: "core",
        title: "Judicial machine",
        buildings: ["Magistrát", "Soud", "Lobby klub"]
      },
      {
        key: "down-core-4",
        tier: "core",
        title: "System override",
        buildings: ["Centrální banka", "Soud", "Lobby klub"]
      }
    ]
  };

  let cachedProfile = null;
  let cachedEconomy = null;
  let cachedMarket = null;
  let marketRefreshHandler = null;
  let marketModalOpenHandler = null;
  let marketBuildingShortcutRefreshHandler = null;
  let marketRenderer = null;
  let characterEventsRotationIntervalId = null;
  let allianceRefreshHandler = null;
  let allianceCountdownIntervalId = null;
  let scenarioIncomeTimer = null;
  let onboardingGrowthTimer = null;
  const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
  const LOCAL_SERVER_CHAT_KEY = "empire_local_server_chat_v1";
  const LOCAL_MARKET_KEY = "empire_local_market_state";
  const LOCAL_BOUNTY_STORAGE_KEY = "empire_local_bounties_v1";
  const DRUG_LAB_PLAYER_STORAGE_KEY = "empire_drug_lab_player_v1";
  const FACTORY_PLAYER_SUPPLIES_STORAGE_KEY = "empire_factory_player_supplies_v1";
  const LOCAL_GANG_MEMBERS_KEY = "empire_local_gang_members";
  const LOCAL_GANG_MEMBERS_SPENT_KEY = "empire_local_gang_members_spent";
  const LOCAL_DISTRICT_DEFENSE_ASSIGNMENTS_KEY = "empire_local_district_defense_assignments_v1";
  const LOCAL_SPY_COUNT_KEY = "empire_local_spy_count_v1";
  const LOCAL_SPY_RECOVERY_QUEUE_KEY = "empire_spy_recovery_queue_v1";
  const LOCAL_DISTRICT_SPY_INTEL_KEY = "empire_district_spy_intel_v1";
  const DISTRICT_SPY_INTEL_RESET_ONCE_KEY = "empire_spy_intel_reset_114_142_v1";
  const DISTRICT_SPY_INTEL_RESET_IDS = Object.freeze([114, 142]);
  const DEFAULT_BASE_SPY_COUNT = 2;
  const BASE_SPY_COUNT_BY_FACTION = Object.freeze({
    "mafian": 2,
    "mafián": 2,
    "kartel": 2,
    "poulicni gang": 2,
    "pouliční gang": 2,
    "tajna organizace": 2,
    "tajná organizace": 2,
    "hackeri": 2,
    "hackeři": 2,
    "motorkarsky gang": 2,
    "motorkářský gang": 2,
    "soukroma armada": 2,
    "soukromá armáda": 2,
    "korporace": 2
  });
  const MAP_BORDER_MODE_STORAGE_KEY = "empire_map_border_mode";
  const MAP_UNKNOWN_NEUTRAL_FILL_STORAGE_KEY = "empire_map_unknown_neutral_fill";
  const MAP_BORDER_MODE_PLAYER = "player";
  const MAP_BORDER_MODE_WHITE = "white";
  const MAP_BORDER_MODE_BLACK = "black";
  const ONBOARDING_TUTORIAL_SPY_DISTRICT_ID = 25;
  const uiDom = window.Empire.UIDom || {
    byId: (id) => document.getElementById(id),
    query: (root, selector) => root?.querySelector(selector) || null,
    queryAll: (root, selector) => Array.from(root?.querySelectorAll(selector) || [])
  };
  const uiStorage = window.Empire?.Storage || null;

  function readStoredValue(key) {
    if (uiStorage?.getItem) {
      return uiStorage.getItem(key);
    }
    return localStorage.getItem(key);
  }

  function writeStoredValue(key, value) {
    if (value == null) {
      removeStoredValue(key);
      return;
    }
    if (uiStorage?.setItem) {
      uiStorage.setItem(key, value);
      return;
    }
    localStorage.setItem(key, value);
  }

  function removeStoredValue(key) {
    if (uiStorage?.removeItem) {
      uiStorage.removeItem(key);
      return;
    }
    localStorage.removeItem(key);
  }

  function readStoredGuestUsername() {
    return readStoredValue("empire_guest_username");
  }

  function readStoredGangName() {
    return readStoredValue("empire_gang_name");
  }

  function readStoredStructure() {
    return readStoredValue("empire_structure");
  }

  function readStoredGangColor() {
    return readStoredValue("empire_gang_color");
  }

  function writeStoredGangColor(value) {
    writeStoredValue("empire_gang_color", value);
  }

  function readStoredAvatar() {
    return readStoredValue("empire_avatar");
  }

  function readStoredObject(key) {
    try {
      const parsed = JSON.parse(readStoredValue(key) || "null");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function writeStoredObject(key, value) {
    writeStoredValue(key, JSON.stringify(value || {}));
  }

  function getMarketRenderer() {
    return getMarketFacade()?.getMarketRenderer?.() || null;
  }

  function getNotificationCenter() {
    return getNotificationsFacade()?.getNotificationCenter?.() || null;
  }

  function getProfileModalController() {
    return getPlayerFacade()?.getProfileModalController?.() || null;
  }

  function getProfileStateController() {
    return getPlayerFacade()?.getProfileStateController?.() || null;
  }

  function getAuthSessionController() {
    return getPlayerFacade()?.getAuthSessionController?.() || null;
  }

  function getRoundStatusController() {
    if (roundStatusController) return roundStatusController;
    const factory = window.Empire.UIRound?.createStatusController;
    if (typeof factory !== "function") return null;
    roundStatusController = factory({
      getRoundPhaseTimer: () => roundPhaseTimer,
      setRoundPhaseTimer: (value) => {
        roundPhaseTimer = value ?? null;
      },
      getRoundStatusState: () => roundStatusState,
      setRoundStatusState: (value) => {
        roundStatusState = value && typeof value === "object" ? value : null;
      },
      getRoundStatusOverride: () => roundStatusOverride,
      updateFreeCtaVisibility
    });
    return roundStatusController;
  }

  function getSettingsModalController() {
    if (settingsModalController) return settingsModalController;
    const factory = window.Empire.UISettings?.createModalController;
    if (typeof factory !== "function") return null;
    settingsModalController = factory({
      SETTINGS_STORAGE_KEY,
      DEFAULT_SETTINGS,
      resolveStoredUnknownNeutralFillEnabled,
      setUnknownNeutralFillEnabled: (value) => {
        unknownNeutralFillEnabled = Boolean(value);
      },
      writeStoredValue,
      MAP_UNKNOWN_NEUTRAL_FILL_STORAGE_KEY,
      applyMapBorderSwitchVisuals,
      syncMapVisionContext,
      pushEvent
    });
    return settingsModalController;
  }

  function getInventoryController() {
    return getCombatFacade()?.getInventoryController?.() || null;
  }

  function getMarketEconomyController() {
    return getMarketFacade()?.getMarketEconomyController?.() || null;
  }

  function getMarketModalController() {
    return getMarketFacade()?.getMarketModalController?.() || null;
  }

  function getPoliceHeatController() {
    if (policeHeatController) return policeHeatController;
    const factory = window.Empire.UIPolice?.createHeatController;
    if (typeof factory !== "function") return null;
    policeHeatController = factory({
      getCachedProfile: () => cachedProfile,
      resolveWantedLevel,
      resolveWantedStars,
      formatDurationLabel,
      buildPoliceRaidImpactKey,
      getPoliceRaidImpactMap,
      resolveStoredPoliceRaidSpecialty,
      resolvePoliceRaidSpecialtyFromOperationType,
      resolvePoliceRaidSpecialty,
      openPoliceActionResultModal,
      spendDirtyCash,
      trySpendCleanCash,
      setPlayerWantedHeat,
      pushEvent,
      registerDirtyHeatReductionAndMaybeTriggerPolice,
      renderGangHeatModal,
      clearGangHeatJournal,
      closeGangHeatModal,
      GANG_HEAT_DIRTY_COST,
      GANG_HEAT_DIRTY_REDUCTION,
      GANG_HEAT_CLEAN_COST,
      GANG_HEAT_CLEAN_REDUCTION,
      GANG_HEAT_DIRTY_TRIGGER_COUNT,
      POLICE_RAID_TIER1,
      POLICE_RAID_TIER2,
      POLICE_RAID_TIER3,
      POLICE_RAID_TIER4,
      POLICE_RAID_TIER5,
      POLICE_RAID_TIER6
    });
    return policeHeatController;
  }
  const ONBOARDING_TUTORIAL_DRUG_LAB_DISTRICT_ID = 18;
  const ONBOARDING_TUTORIAL_ATTACK_DISTRICT_ID = 6;
  const ONBOARDING_TUTORIAL_RAID_DISTRICT_ID = 38;
  let scenarioVisionEnabled = false;
  let scenarioUniqueOwnerColors = false;
  let scenarioProfileAvatarOverride = null;
  let activePlayerScenarioKey = "";
  const DEFAULT_INDEX_MAP_VIEW = "hra";
  const INTERNAL_INDEX_HRA_SCENARIO_KEY = "alliance-ten-blackout";
  let guestIndexMapViewBootstrapped = false;
  let guestIndexBaseSnapshot = null;
  let activeIndexMapView = "";
  const BLACKOUT_LIKE_SCENARIO_KEYS = new Set(["alliance-ten-blackout", "night-20-war"]);
  let activeScenarioOwnerName = "";
  let lastValidBlackoutSources = null;
  let selectedMapBorderMode = MAP_BORDER_MODE_PLAYER;
  let unknownNeutralFillEnabled = false;
  let liveAllianceOwnerNames = new Set();
  let liveAllianceTrapGraceByOwnerName = new Map();
  let liveAllianceIconByName = new Map();
  let scenarioAllianceOwnerNames = new Set();
  let scenarioAllianceIconByName = new Map();
  let scenarioEnemyOwnerNames = new Set();
  let guestModeActive = false;
  let attackModalRefreshTimer = null;
  let lastAttackStepperInteractionAt = 0;
  let lastDefenseStepperInteractionAt = 0;
  let attackResultTimer = null;
  let raidActionTimeoutId = null;
  let raidActionState = { districtId: null, startedAt: 0, endsAt: 0 };
  let attackModalState = { districtId: null, message: "", selectedWeaponCounts: {} };
  let attackConfirmModalState = {
    districtId: null,
    availability: null,
    selectionSummary: null,
    baseDetails: null,
    defensePowerEstimate: 0
  };
  let attackResultModalState = { visible: false };
  let defenseModalRefreshTimer = null;
  let defenseModalState = {
    districtId: null,
    message: "",
    selectedWeaponCounts: {},
    initialAssignmentSelection: {},
    hasInitialAssignment: false
  };
  let districtActionsController = null;
  let allianceModalController = null;
  let profileModalController = null;
  let profileStateController = null;
  let notificationCenter = null;
  let authSessionController = null;
  let roundStatusController = null;
  let settingsModalController = null;
  let inventoryController = null;
  let marketEconomyController = null;
  let marketModalController = null;
  let policeHeatController = null;
  const GANG_HEAT_LEVELS = Object.freeze([
    { stars: 1, label: "Stupeň 1", title: "Základní dohled", description: "Jsi skoro pod radarem. Jen lehké sledování a občasná pozornost." },
    { stars: 2, label: "Stupeň 2", title: "Podezřelý", description: "Policie tě začíná vnímat. Přibývají kontroly a drobný tlak." },
    { stars: 3, label: "Stupeň 3", title: "Známý problém", description: "Tvoje síť je viditelná. Hrozí častější zásahy a sledování." },
    { stars: 4, label: "Stupeň 4", title: "Rizikový cíl", description: "Jsi konkrétní cíl. Razie a blokace jsou výrazně pravděpodobnější." },
    { stars: 5, label: "Stupeň 5", title: "Prioritní cíl", description: "Bezpečnostní složky se na tebe soustředí. Tlak je trvalý a agresivní." },
    { stars: 6, label: "Stupeň 6", title: "Totální hon", description: "Nejtěžší stupeň. Tvůj gang je veřejný nepřítel a systém po tobě jde naplno." }
  ]);
  let cachedSpyCount = null;
  let isSpyCountShownInTopbar = false;
  const actionConfirmPopupController = window.Empire.UIModals?.createActionConfirmPopupController?.({
    rootId: "empire-action-confirm-popup",
    titleId: "empire-action-confirm-popup-title",
    subtitleId: "empire-action-confirm-popup-subtitle",
    durationMs: 2600
  }) || null;
  let topbarStatSwitchTimer = null;
  let roundPhaseTimer = null;
  let policeRaidProtectionTimer = null;
  let roundStatusState = null;
  let roundStatusOverride = null;
  function isBlackoutLikeScenario(scenarioKey = activePlayerScenarioKey) {
    return BLACKOUT_LIKE_SCENARIO_KEYS.has(String(scenarioKey || "").trim().toLowerCase());
  }
  let spyRecoveryIntervalId = null;
  let districtAttackWarningTimer = null;
  const infoWindowHistoryModule = window.Empire.UIHistory?.createInfoWindowHistory?.({
    storageKey: INFO_WINDOWS_HISTORY_STORAGE_KEY,
    limit: INFO_WINDOWS_HISTORY_LIMIT,
    itemsContainerId: "info-history-items",
    clearButtonId: "info-history-clear-btn"
  }) || null;
  const eventFeedModule = window.Empire.UINotifications?.createEventFeed?.({
    containerId: "event-items",
    clearButtonId: "event-clear-btn",
    emptyMessage: "Čekám na rozkazy..."
  }) || null;
  let combatHelperController = null;
  let spyIntelHelpers = null;
  let combatFacade = null;
  let notificationsFacade = null;
  let playerLabelHelpers = null;
  let playerIdentityHelpers = null;
  let playerOwnerMetaHelpers = null;
  let playerDefenseStorageHelpers = null;
  let playerDefenseSnapshotHelpers = null;
  let playerHeatHelpers = null;
  let playerFacade = null;
  let playerPopulationController = null;
  let marketShortcutController = null;
  let marketFacade = null;
  let modalsFacade = null;
  let allianceChatHelpers = null;
  let allianceButtonHelpers = null;
  let allianceDisplayHelpers = null;
  let allianceStateHelpers = null;
  let allianceVisionHelpers = null;
  let allianceFacade = null;

  function getSpyIntelHelpers() {
    if (spyIntelHelpers) return spyIntelHelpers;
    const factory = window.Empire.UICombat?.createSpyIntelHelpers;
    if (typeof factory !== "function") return null;
    spyIntelHelpers = factory();
    return spyIntelHelpers;
  }

  function getCombatHelperController() {
    if (combatHelperController) return combatHelperController;
    const factory = window.Empire.UICombat?.createHelperController;
    if (typeof factory !== "function") return null;
    combatHelperController = factory({
      attackWeaponStats,
      weaponMeta: weaponSpecialMeta,
      readLocalDistrictDefenseAssignments,
      formatDecimalValue,
      isOnboardingDemoScenarioActive,
      isDistrictUnownedForSpyOutcome,
      getDistrictDefenseSnapshot,
      formatDistrictType,
      normalizeSpyIntelKnownFields,
      spySuccessEmptyDistrictQuotes: SPY_SUCCESS_EMPTY_DISTRICT_QUOTES,
      spySuccessOccupiedDistrictQuotes: SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES,
      spyMediumFailEmptyDistrictQuotes: SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES,
      spyMediumFailOccupiedDistrictQuotes: SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES,
      spyMajorFailEmptyDistrictQuotes: SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES,
      spyMajorFailOccupiedDistrictQuotes: SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES,
      ONBOARDING_ACTION_DURATION_MS,
      ATTACK_ACTION_DURATION_MS,
      getFitnessCombatSnapshot: () => window.Empire.Map?.getFitnessCombatSnapshot?.() || null
    });
    return combatHelperController;
  }

  function getCombatFacade() {
    if (combatFacade) return combatFacade;
    const factory = window.Empire.UICombat?.createFacade;
    if (typeof factory !== "function") return null;
    combatFacade = factory({
      createInventoryController: window.Empire.UICombat?.createInventoryController,
      inventoryDeps: {
        attackWeaponStats,
        defenseWeaponStats,
        weaponCatalog,
        defenseCatalog,
        LEGACY_ATTACK_WEAPON_ALIASES,
        readStoredObject,
        writeStoredObject,
        getCachedProfile: () => cachedProfile,
        getCachedEconomy: () => cachedEconomy,
        updateEconomy: (economy, options) => updateEconomy(economy, options),
        hydrateStorageModalValues,
        countPlayerControlledPopulation
      }
    });
    return combatFacade;
  }

  function getNotificationsFacade() {
    if (notificationsFacade) return notificationsFacade;
    const factory = window.Empire.UINotifications?.createFacade;
    if (typeof factory !== "function") return null;
    notificationsFacade = factory({
      createCenter: window.Empire.UINotifications?.createCenter,
      infoWindowHistoryModule,
      eventFeedModule
    });
    return notificationsFacade;
  }

  function getPlayerLabelHelpers() {
    if (playerLabelHelpers) return playerLabelHelpers;
    const factory = window.Empire.UIPlayer?.createLabelHelpers;
    if (typeof factory !== "function") return null;
    playerLabelHelpers = factory({
      normalizeOwnerName
    });
    return playerLabelHelpers;
  }

  function getPlayerIdentityHelpers() {
    if (playerIdentityHelpers) return playerIdentityHelpers;
    const factory = window.Empire.UIPlayer?.createIdentityHelpers;
    if (typeof factory !== "function") return null;
    playerIdentityHelpers = factory({
      getCachedProfile: () => cachedProfile,
      getPlayer: () => window.Empire.player || null,
      readStoredGangName,
      readStoredGuestUsername,
      resolvePlayerAllianceVisualMeta,
      normalizeOwnerName
    });
    return playerIdentityHelpers;
  }

  function getPlayerOwnerMetaHelpers() {
    if (playerOwnerMetaHelpers) return playerOwnerMetaHelpers;
    const factory = window.Empire.UIPlayer?.createOwnerMetaHelpers;
    if (typeof factory !== "function") return null;
    playerOwnerMetaHelpers = factory({
      getPlayerOwnerNameSet,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      normalizeOwnerName,
      getCachedProfile: () => cachedProfile,
      getPlayer: () => window.Empire.player || null,
      readStoredGangName,
      readStoredGuestUsername,
      resolvePlayerAllianceVisualMeta,
      refreshSelectedDistrictModal: () => window.Empire.Map?.refreshSelectedDistrictModal?.(),
      renderMap: () => window.Empire.Map?.render?.(),
      updateDistrict,
      refreshProfilePopulation,
      resolveDemoOwnerFaction,
      resolveDemoOwnerAvatar,
      demoDistrictAtmospheres: DEMO_DISTRICT_ATMOSPHERES,
      hashDistrictSeed
    });
    return playerOwnerMetaHelpers;
  }

  function getPlayerDefenseStorageHelpers() {
    if (playerDefenseStorageHelpers) return playerDefenseStorageHelpers;
    const factory = window.Empire.UIPlayer?.createDefenseStorageHelpers;
    if (typeof factory !== "function") return null;
    playerDefenseStorageHelpers = factory({
      localDistrictDefenseAssignmentsKey: LOCAL_DISTRICT_DEFENSE_ASSIGNMENTS_KEY,
      defenseWeaponStats,
      normalizeOwnerName,
      resolveCurrentPlayerOwnerKey,
      resolveCurrentPlayerOwnerLabel
    });
    return playerDefenseStorageHelpers;
  }

  function getPlayerDefenseSnapshotHelpers() {
    if (playerDefenseSnapshotHelpers) return playerDefenseSnapshotHelpers;
    const factory = window.Empire.UIPlayer?.createDefenseSnapshotHelpers;
    if (typeof factory !== "function") return null;
    playerDefenseSnapshotHelpers = factory({
      readLocalDistrictDefenseAssignments,
      countSelectedDefenseWeapons,
      getPlayerOwnerNameSet,
      resolveCurrentPlayerOwnerKey,
      getActiveAllianceOwnerNames,
      resolveDistrictDefenseEntryByKeys,
      getFitnessCombatSnapshot: () => window.Empire.Map?.getFitnessCombatSnapshot?.() || null
    });
    return playerDefenseSnapshotHelpers;
  }

  function getPlayerHeatHelpers() {
    if (playerHeatHelpers) return playerHeatHelpers;
    const factory = window.Empire.UIPlayer?.createHeatHelpers;
    if (typeof factory !== "function") return null;
    playerHeatHelpers = factory({
      wantedHeatMax: WANTED_HEAT_MAX,
      heatJournalStorageKey: HEAT_JOURNAL_STORAGE_KEY,
      heatDirtyReductionStorageKey: HEAT_DIRTY_REDUCTION_STORAGE_KEY,
      dirtyReductionTriggerWindowMs: GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS,
      dirtyReductionTriggerCount: GANG_HEAT_DIRTY_TRIGGER_COUNT,
      policeDurationMs: GANG_HEAT_POLICE_DURATION_MS,
      wantedHeatTiers: WANTED_HEAT_TIERS,
      gangHeatLevels: GANG_HEAT_LEVELS,
      resolveMoneyBreakdown,
      ensureEconomyCache,
      updateEconomy: (economy, options) => updateEconomy(economy, options),
      updateProfile,
      countPlayerControlledPopulation,
      extractAllianceDisplayName,
      extractAllianceSectorCountHint,
      countAllianceControlledSectors,
      formatSectorCountLabel,
      formatDurationLabel,
      getCachedEconomy: () => cachedEconomy,
      getCachedProfile: () => cachedProfile,
      getPlayer: () => window.Empire.player || null,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      isDistrictOwnedByPlayer,
      isBlackoutLikeScenario,
      blackoutPlayerFallbackDistrictIds: BLACKOUT_PLAYER_FALLBACK_DISTRICT_IDS,
      isOnboardingDemoScenarioActive,
      pushEvent,
      markDistrictPoliceAction: (districtId, payload) => window.Empire.Map?.markDistrictPoliceAction?.(districtId, payload),
      setExternalHeat: (heat, profile) => window.Empire.PoliceHeat?.setExternalHeat?.(heat, profile)
    });
    return playerHeatHelpers;
  }

  function getPlayerFacade() {
    if (playerFacade) return playerFacade;
    const factory = window.Empire.UIPlayer?.createFacade;
    if (typeof factory !== "function") return null;
    playerFacade = factory({
      createProfileModalController: window.Empire.UIProfile?.createProfileModalController,
      createProfileStateController: window.Empire.UIProfile?.createProfileStateController,
      createSessionController: window.Empire.UIAuth?.createSessionController,
      profileModalDeps: {
        getCachedEconomy: () => cachedEconomy,
        getCachedProfile: () => cachedProfile,
        getLastValidBlackoutSources: () => lastValidBlackoutSources,
        setLastValidBlackoutSources: (value) => {
          lastValidBlackoutSources = value ?? null;
        },
        resolveMoneyBreakdown,
        readStoredGuestUsername,
        readStoredGangName,
        readStoredStructure,
        formatFactionLabel,
        resolveWantedLevel,
        resolveActiveProfileAvatar,
        applyProfileModalVisuals,
        formatPoliceRaidProtectionLabel,
        resolvePoliceRaidProtectionUntil,
        formatDurationLabel,
        extractAllianceDisplayName,
        isBlackoutLikeScenario,
        buildBlackoutPlayerSourcesSnapshot,
        resolveActiveScenarioOwnerName,
        hasMeaningfulBlackoutSources,
        collectBlackoutMapPlayerSummaries,
        refreshGangColorDisplays,
        formatWantedHeat,
        formatDecimalValue
      },
      profileStateDeps: {
        getCachedProfile: () => cachedProfile,
        setCachedProfile: (value) => {
          cachedProfile = value ?? null;
        },
        getCachedEconomy: () => cachedEconomy,
        setCachedEconomy: (value) => {
          cachedEconomy = value ?? null;
        },
        getCachedSpyCount: () => cachedSpyCount,
        resolveSpyCountFromPayload,
        setSpyCount,
        resolveFactionBaseSpyCount,
        readStoredStructure,
        renderInfluenceSpyTopbarStat,
        normalizeHexColor,
        writeStoredGangColor,
        formatFactionLabel,
        formatWantedHeat,
        resolveWantedLevel,
        countPlayerControlledPopulation,
        formatAllianceProfileSummary,
        setAllianceButtonState,
        updateProfileWantedStars,
        refreshGangColorDisplays,
        updateWeaponsPopover,
        updateDefensePopover,
        renderGangHeatModal,
        syncMapVisionContext,
        refreshMarketBuildingShortcuts,
        storageDrugTypes,
        normalizeSpyCount,
        getSpyCount,
        resolveMoneyBreakdown,
        syncMoneyStatToCachedValue,
        animateMoneyStatCounter,
        animateMoneyStatValue,
        getLastRenderedCleanMoney: () => lastRenderedCleanMoney,
        setLastRenderedCleanMoney: (value) => {
          lastRenderedCleanMoney = value;
        },
        getLastRenderedDirtyMoney: () => lastRenderedDirtyMoney,
        setLastRenderedDirtyMoney: (value) => {
          lastRenderedDirtyMoney = value;
        },
        syncWeaponStatCounter,
        syncDefenseStatCounter,
        hydrateStorageModalValues
      },
      authSessionDeps: {
        getGuestModeActive: () => guestModeActive,
        setGuestModeActive: (value) => {
          guestModeActive = Boolean(value);
        },
        setScenarioVisionMode,
        setScenarioAllianceOwners,
        setScenarioEnemyOwners,
        updateEconomy: (economy, options) => updateEconomy(economy, options),
        setLiveAllianceOwnersFromAlliance,
        updateProfile,
        resolveFactionBaseSpyCount,
        getCachedProfile: () => cachedProfile,
        readStoredStructure,
        writeSpyRecoveryQueue,
        syncSpyRecoveryTicker,
        setSpyCount,
        getLocalAllianceState,
        renderAllianceChat,
        renderGlobalServerChat,
        syncGuestAllianceLabel,
        syncGuestEconomyFromMarket,
        clearLiveAllianceOwners
      }
    });
    return playerFacade;
  }

  function getPlayerPopulationController() {
    if (playerPopulationController) return playerPopulationController;
    const factory = window.Empire.UIPlayer?.createPopulationController;
    if (typeof factory !== "function") return null;
    playerPopulationController = factory({
      localGangMembersKey: LOCAL_GANG_MEMBERS_KEY,
      localGangMembersSpentKey: LOCAL_GANG_MEMBERS_SPENT_KEY,
      getProfileStateController,
      getCachedProfile: () => cachedProfile,
      getPlayer: () => window.Empire.player || null,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      getPlayerOwnerNameSet,
      getActiveAllianceOwnerNames,
      normalizeOwnerName
    });
    return playerPopulationController;
  }

  function getMarketShortcutController() {
    if (marketShortcutController) return marketShortcutController;
    const factory = window.Empire.UIBuildings?.createShortcutController;
    if (typeof factory !== "function") return null;
    marketShortcutController = factory({
      getMarketModalController
    });
    return marketShortcutController;
  }

  function getMarketFacade() {
    if (marketFacade) return marketFacade;
    const factory = window.Empire.UIMarket?.createFacade;
    if (typeof factory !== "function") return null;
    marketFacade = factory({
      createRenderer: window.Empire.UIMarket?.createRenderer,
      createEconomyController: window.Empire.UIMarket?.createEconomyController,
      createModalController: window.Empire.UIMarket?.createModalController,
      getShortcutController: getMarketShortcutController,
      uiDom,
      marketResourceLabels: MARKET_RESOURCE_LABELS,
      resolveMoneyBreakdown,
      resourceKeyToBalanceKey,
      getCachedMarket: () => cachedMarket,
      setCachedMarket: (value) => {
        cachedMarket = value ?? null;
      },
      economyControllerDeps: {
        LOCAL_MARKET_KEY,
        GUEST_DEFAULT_DIRTY_MONEY,
        storageDrugTypes,
        resolveMoneyBreakdown,
        normalizeSpyCount,
        getSpyCount,
        resolveSpyCountFromPayload,
        setSpyCount,
        updateEconomy: (economy, options) => updateEconomy(economy, options),
        getCachedEconomy: () => cachedEconomy,
        setCachedEconomy: (value) => { cachedEconomy = value ?? null; },
        getCachedProfile: () => cachedProfile,
        setCachedProfile: (value) => { cachedProfile = value ?? null; },
        applyMoneyToProfileSnapshot,
        isBlackoutLikeScenario,
        buildBlackoutPlayerSourcesSnapshot,
        resolveActiveScenarioOwnerName,
        updateProfile,
        makeSeedOrder,
        resourceKeyToBalanceKey
      },
      modalControllerDeps: {
        uiDom,
        MARKET_BLACK_RESOURCES,
        MARKET_SERVER_RESOURCES,
        MARKET_BLACK_RESOURCE_GROUPS,
        getCachedMarket: () => cachedMarket,
        setCachedMarket: (value) => { cachedMarket = value ?? null; },
        getLocalMarketState: () => getLocalMarketState(),
        renderMarketState: (resourceKey, marketTab) => renderMarketState(resourceKey, marketTab),
        pushEvent,
        createLocalMarketOrder: (payload) => createLocalMarketOrder(payload),
        cancelLocalMarketOrder: (orderId) => cancelLocalMarketOrder(orderId),
        recordVerifiedIntelEvent,
        syncGuestEconomyFromMarket,
        updateEconomy: (economy, options) => updateEconomy(economy, options),
        setMobileTopbarCoveredByPrimaryModal,
        normalizeOwnerName,
        isDistrictOwnedByPlayer,
        isOnboardingDemoScenarioActive,
        resolveDistrictById
      },
      getMarketRefreshHandler: () => marketRefreshHandler,
      setMarketRefreshHandler: (handler) => {
        marketRefreshHandler = typeof handler === "function" ? handler : null;
      },
      getMarketModalOpenHandler: () => marketModalOpenHandler,
      setMarketModalOpenHandler: (handler) => {
        marketModalOpenHandler = typeof handler === "function" ? handler : null;
      },
      getMarketBuildingShortcutRefreshHandler: () => marketBuildingShortcutRefreshHandler,
      setMarketBuildingShortcutRefreshHandler: (handler) => {
        marketBuildingShortcutRefreshHandler = typeof handler === "function" ? handler : null;
      }
    });
    return marketFacade;
  }

  function getModalsFacade() {
    if (modalsFacade) return modalsFacade;
    const factory = window.Empire.UIModals?.createFacade;
    if (typeof factory !== "function") return null;
    modalsFacade = factory({
      createDistrictActionsController: window.Empire.UIModals?.createDistrictActionsController,
      districtActionsDeps: {
        bindConfirmModal: window.Empire.UIModals?.bindConfirmModal,
        resolveDistrictById,
        processSpyRecoveryQueue,
        getSpyCount,
        evaluateDistrictActionAvailability,
        scenarioVisionEnabled: () => scenarioVisionEnabled,
        hasToken: () => Boolean(window.Empire.token),
        resolveOnboardingActionDurationMs,
        spyActionDurationMs: SPY_ACTION_DURATION_MS,
        spyRecoveryCooldownMs: SPY_RECOVERY_COOLDOWN_MS,
        resolveRaidDurationWithBoosts,
        formatAttackDurationLabel,
        isRaidActionRunning,
        getRaidCooldownRemainingMs,
        formatRaidCooldownLabel,
        pushEvent,
        startRaidAction,
        raidDistrictApi: (districtId) => window.Empire.API.raidDistrict(districtId),
        formatRaidError,
        startRaidActionFromServerResult,
        showActionConfirmPopup,
        consumeSpyAgents,
        recordVerifiedIntelEvent,
        scheduleSpyActionResult,
        resolveCompleteSpyIntel,
        resolveOccupationRequiredMembers,
        countPlayerControlledPopulation,
        getProfileSnapshot: () => cachedProfile || window.Empire.player || {},
        occupyActionDurationMs: OCCUPY_ACTION_DURATION_MS,
        consumeGangMembers,
        scheduleOccupationActionResult,
        getDistrictTrapControlState,
        getCurrentPlayerTrapPlacement,
        trapMoveCooldownMs: TRAP_MOVE_COOLDOWN_MS,
        isDistrictDefendableByPlayer,
        isDistrictDestroyed,
        setCurrentPlayerTrapDistrict,
        formatTrapMoveCooldownLabel
      },
      actionConfirmPopupController
    });
    return modalsFacade;
  }

  function getAllianceChatHelpers() {
    if (allianceChatHelpers) return allianceChatHelpers;
    const factory = window.Empire.UIAlliance?.createChatHelpers;
    if (typeof factory !== "function") return null;
    allianceChatHelpers = factory({
      localServerChatKey: LOCAL_SERVER_CHAT_KEY,
      normalizeOwnerName,
      resolveActiveScenarioOwnerName,
      getPlayer: () => window.Empire.player || null,
      getCachedProfile: () => cachedProfile,
      readStoredGuestUsername,
      readStoredGangName,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      getLeaderboardServerPlayers: () => Array.isArray(window.Empire.leaderboardServerPlayers) ? window.Empire.leaderboardServerPlayers : []
    });
    return allianceChatHelpers;
  }

  function getAllianceDisplayHelpers() {
    if (allianceDisplayHelpers) return allianceDisplayHelpers;
    const factory = window.Empire.UIAlliance?.createDisplayHelpers;
    if (typeof factory !== "function") return null;
    allianceDisplayHelpers = factory({
      defaultAllianceIconKey: DEFAULT_ALLIANCE_ICON_KEY,
      allianceIconOptions: ALLIANCE_ICON_OPTIONS,
      normalizeOwnerName,
      getScenarioAllianceIconByName: () => scenarioAllianceIconByName,
      getLiveAllianceIconByName: () => liveAllianceIconByName,
      allianceReadyWindowMs: ALLIANCE_READY_WINDOW_MS,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      formatFactionLabel,
      formatSectorCountLabel,
      resolveDemoOwnerFaction,
      resolveDemoOwnerAvatar,
      normalizeHexColor
    });
    return allianceDisplayHelpers;
  }

  function getAllianceButtonHelpers() {
    if (allianceButtonHelpers) return allianceButtonHelpers;
    const factory = window.Empire.UIAlliance?.createButtonHelpers;
    if (typeof factory !== "function") return null;
    allianceButtonHelpers = factory({
      getPlayer: () => window.Empire.player || null,
      formatAllianceProfileSummary,
      extractAllianceDisplayName
    });
    return allianceButtonHelpers;
  }

  function getAllianceStateHelpers() {
    if (allianceStateHelpers) return allianceStateHelpers;
    const factory = window.Empire.UIAlliance?.createStateHelpers;
    if (typeof factory !== "function") return null;
    allianceStateHelpers = factory({
      localAllianceKey: LOCAL_ALLIANCE_KEY,
      localAllianceRequestPlayerId: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
      defaultAllianceDescription: DEFAULT_ALLIANCE_DESCRIPTION,
      defaultAllianceIconKey: DEFAULT_ALLIANCE_ICON_KEY,
      allianceMaxMembers: ALLIANCE_MAX_MEMBERS,
      normalizeOwnerName,
      getCachedProfile: () => cachedProfile,
      readStoredGangName,
      isBlackoutLikeScenario,
      getPlayerOwnerNameSet,
      setScenarioAllianceOwners,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      setDistricts: (districts) => window.Empire.Map?.setDistricts?.(districts),
      computeLocalAllianceReadyState
    });
    return allianceStateHelpers;
  }

  function getAllianceVisionHelpers() {
    if (allianceVisionHelpers) return allianceVisionHelpers;
    const factory = window.Empire.UIAlliance?.createVisionHelpers;
    if (typeof factory !== "function") return null;
    allianceVisionHelpers = factory({
      scenarioVisionEnabled: () => scenarioVisionEnabled,
      setScenarioVisionEnabled: (value) => {
        scenarioVisionEnabled = Boolean(value);
      },
      scenarioUniqueOwnerColors: () => scenarioUniqueOwnerColors,
      setScenarioUniqueOwnerColors: (value) => {
        scenarioUniqueOwnerColors = Boolean(value);
      },
      getScenarioAllianceOwnerNames: () => scenarioAllianceOwnerNames,
      setScenarioAllianceOwnerNames: (value) => {
        scenarioAllianceOwnerNames = value instanceof Set ? value : new Set();
      },
      getScenarioEnemyOwnerNames: () => scenarioEnemyOwnerNames,
      setScenarioEnemyOwnerNames: (value) => {
        scenarioEnemyOwnerNames = value instanceof Set ? value : new Set();
      },
      getLiveAllianceOwnerNames: () => liveAllianceOwnerNames,
      setLiveAllianceOwnerNames: (value) => {
        liveAllianceOwnerNames = value instanceof Set ? value : new Set();
      },
      setLiveAllianceTrapGraceByOwnerName: (value) => {
        liveAllianceTrapGraceByOwnerName = value instanceof Map ? value : new Map();
      },
      setLiveAllianceIconByName: (value) => {
        liveAllianceIconByName = value instanceof Map ? value : new Map();
      },
      getScenarioAllianceIconByName: () => scenarioAllianceIconByName,
      allianceTrapGraceMs: ALLIANCE_TRAP_GRACE_MS,
      defaultAllianceIconKey: DEFAULT_ALLIANCE_ICON_KEY,
      emptyOwnerNames: EMPTY_OWNER_NAMES,
      getLocalAllianceState,
      getPlayerOwnerNameSet,
      getDistricts: () => Array.isArray(window.Empire.districts) ? window.Empire.districts : [],
      normalizeOwnerName,
      resolveAllianceIconKeyByName,
      setAllianceIconMap,
      processSpyRecoveryQueue,
      resolveFactionBaseSpyCount,
      getCachedProfile: () => cachedProfile,
      readStoredStructure,
      readStoredSpyCount,
      readSpyRecoveryQueue,
      getSpyCount,
      setSpyCount,
      renderInfluenceSpyTopbarStat,
      syncSpyRecoveryTicker,
      getSettingsState,
      selectedMapBorderMode: () => selectedMapBorderMode,
      unknownNeutralFillEnabled: () => unknownNeutralFillEnabled,
      normalizeMapVisibilityMode,
      setVisionContext: (context) => window.Empire.Map?.setVisionContext?.(context)
    });
    return allianceVisionHelpers;
  }

  function getAllianceFacade() {
    if (allianceFacade) return allianceFacade;
    const factory = window.Empire.UIAlliance?.createFacade;
    if (typeof factory !== "function") return null;
    allianceFacade = factory({
      createAllianceModalController: window.Empire.UIAlliance?.createAllianceModalController,
      allianceModalDeps: {
        DEFAULT_ALLIANCE_ICON_KEY,
        DEFAULT_ALLIANCE_DESCRIPTION,
        ALLIANCE_ICON_OPTIONS,
        ALLIANCE_MAX_MEMBERS,
        getAllianceRefreshHandler: () => allianceRefreshHandler,
        setAllianceRefreshHandler: (handler) => {
          allianceRefreshHandler = typeof handler === "function" ? handler : null;
        },
        getAllianceCountdownIntervalId: () => allianceCountdownIntervalId,
        setAllianceCountdownIntervalId: (id) => {
          allianceCountdownIntervalId = id ?? null;
        },
        setMobileTopbarCoveredByPrimaryModal,
        isBlackoutLikeScenario,
        getLocalAllianceState,
        saveLocalAllianceState,
        withActiveAlliance,
        renderAllianceChat,
        renderGlobalServerChat,
        setLiveAllianceOwnersFromAlliance,
        syncBlackoutScenarioAllianceDistrictState,
        syncGuestAllianceLabel,
        pushEvent,
        appendLocalAllianceChat,
        resolveCurrentServerChatAuthorName,
        appendLocalServerChatMessage,
        createLocalAlliance,
        leaveLocalAlliance,
        sendLocalAllianceManagementInvite,
        formatAllianceError,
        updateProfile,
        computeLocalAllianceReadyState,
        formatAllianceDueLabelSeconds,
        renderAllianceIdentityMarkup,
        renderAllianceMemberCard,
        bindAllianceMemberAvatarLightbox,
        getAllianceMemberVisualData,
        escapeAllianceMarkup,
        formatAllianceRelativeTime,
        markLocalAllianceReady,
        respondToLocalAllianceMemberInvite,
        requestLocalAllianceInvite,
        respondToLocalAllianceRequest,
        removeLocalAllianceMember,
        startLocalAllianceKickVote,
        castLocalAllianceKickVote
      }
    });
    return allianceFacade;
  }
  const spyActionResultTimeouts = new Set();
  const occupyActionResultTimeouts = new Set();
  const pendingResultModalQueue = [];
  let suppressResultModalQueueAdvance = false;
  const moneyStatAnimationTimers = new WeakMap();
  const moneyStatCountIntervals = new WeakMap();
  const MONEY_STAT_COUNT_TICK_MS = 26;
  let lastRenderedCleanMoney = null;
  let lastRenderedDirtyMoney = null;
  let lastRenderedStorageTotal = null;
  let lastRenderedInfluenceValue = null;
  let lastRenderedTopbarMode = "influence";
  let storageStatPulseTimer = null;
  const districtSpyIntelCache = new Map();
  const EMPTY_OWNER_NAMES = new Set();
  const WANTED_HEAT_MAX = 1000;
  const WANTED_HEAT_TIERS = [
    { stars: 1, min: 0, max: 24 },
    { stars: 2, min: 25, max: 74 },
    { stars: 3, min: 75, max: 149 },
    { stars: 4, min: 150, max: 299 },
    { stars: 5, min: 300, max: 499 },
    { stars: 6, min: 500, max: Number.POSITIVE_INFINITY }
  ];

  function init() {
    selectedMapBorderMode = resolveStoredMapBorderMode();
    writeStoredValue(MAP_UNKNOWN_NEUTRAL_FILL_STORAGE_KEY, "0");
    unknownNeutralFillEnabled = false;
    loadInfoWindowHistory();
    readStoredDistrictSpyIntel();
    applyOneTimeDistrictSpyIntelReset();
    processSpyRecoveryQueue({ notify: false });
    syncSpyRecoveryTicker();
    bindActions();
    initMobileViewportLayoutLock();
    initMobileTopbarScrollState();
    initMobileScenarioCardPlacement();
    initMobileLeaderboardCardPlacement();
    initMobileMarketBuildingShortcutsPlacement();
    initMobilePrimaryActionCardsPlacement();
    initMobileModalTopbarResourceVisibility();
    initMobileTapFocusCleanup();
    initGlobalModalScrollLock();
    initDoubleTapZoomLock();
    initMapModeControls();
    initIndexMapToggleButton();
    startPoliceRaidProtectionTicker();
    startScenarioIncomeTicker();
    renderInfoWindowHistory();
    if (!window.Empire.token) {
      enforceLocalGuestStorageDefaults();
      syncGuestEconomyFromMarket();
    }
    syncMapVisionContext();
    refreshGangColorDisplays();
  }

  function initMobileTapFocusCleanup() {
    const media = window.matchMedia("(max-width: 720px)");
    document.addEventListener("click", (event) => {
      if (!media.matches) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const interactive = target.closest(
        "button, .btn, .nav-btn, .events-hero, .market-building-shortcut, .scenario-preview__btn, .ticker__clear-btn"
      );
      if (!(interactive instanceof HTMLElement)) return;
      window.setTimeout(() => {
        if (interactive instanceof HTMLButtonElement) {
          interactive.blur();
          return;
        }
        if (typeof interactive.blur === "function") {
          interactive.blur();
        }
      }, 0);
    }, true);
  }

  function initGlobalModalScrollLock() {
    const modalNodes = Array.from(document.querySelectorAll(".modal"));
    if (!modalNodes.length) return;
    const body = document.body;
    if (!body) return;
    const html = document.documentElement;

    const applyLock = (locked) => {
      if (locked) {
        if (body.classList.contains("modal-scroll-locked")) return;
        const scrollbarCompensation = Math.max(0, window.innerWidth - (html?.clientWidth || window.innerWidth));
        body.classList.add("modal-scroll-locked");
        body.style.overflow = "hidden";
        if (html) {
          html.style.overflow = "hidden";
        }
        body.style.paddingRight = scrollbarCompensation > 0 ? `${scrollbarCompensation}px` : "";
        return;
      }

      if (!body.classList.contains("modal-scroll-locked")) return;
      body.classList.remove("modal-scroll-locked");
      body.style.overflow = "";
      if (html) {
        html.style.overflow = "";
      }
      body.style.paddingRight = "";
    };

    const applyState = () => {
      const hasOpenModal = modalNodes.some((modal) => !modal.classList.contains("hidden"));
      applyLock(hasOpenModal);
    };

    const observer = new MutationObserver((mutations) => {
      if (!mutations?.length) return;
      applyState();
    });
    modalNodes.forEach((modal) => {
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });
    window.addEventListener("resize", applyState);
    applyState();
  }

  function initDoubleTapZoomLock() {
    const target = document.documentElement;
    if (!target) return;
    let lastTapAt = 0;
    let lastTapTarget = null;
    let multiTouchActive = false;

    const updateMultiTouchState = (event) => {
      multiTouchActive = Boolean(event?.touches && event.touches.length > 1);
    };

    target.addEventListener("touchstart", updateMultiTouchState, { passive: true });
    target.addEventListener("touchmove", updateMultiTouchState, { passive: true });
    target.addEventListener("touchend", (event) => {
      if (multiTouchActive) {
        multiTouchActive = false;
        return;
      }
      const changedTouches = event?.changedTouches;
      if (!changedTouches || changedTouches.length !== 1) return;
      const now = Date.now();
      const tappedTarget = event.target;
      const isDoubleTap = tappedTarget === lastTapTarget && (now - lastTapAt) < 320;
      lastTapAt = now;
      lastTapTarget = tappedTarget;
      if (!isDoubleTap) return;
      event.preventDefault();
    }, { passive: false });
  }

  function stopRoundPhaseTicker() {
    return getRoundStatusController()?.stopRoundPhaseTicker?.();
  }

  function resolveRoundPhaseSnapshot(round) {
    return getRoundStatusController()?.resolveRoundPhaseSnapshot?.(round) || null;
  }

  function buildRoundStatusPresetForMode(mode) {
    return getRoundStatusController()?.buildRoundStatusPresetForMode?.(mode) || null;
  }

  function resolveEffectiveRoundMode(phaseKey, subPhaseKey = "") {
    return getRoundStatusController()?.resolveEffectiveRoundMode?.(phaseKey, subPhaseKey) || {
      mapMode: "night",
      phaseLabel: "NOC"
    };
  }

  function formatRoundClockLabel(minutesInDay) {
    return getRoundStatusController()?.formatRoundClockLabel?.(minutesInDay) || "00:00";
  }

  function resolveRoundClockSnapshot(round) {
    return getRoundStatusController()?.resolveRoundClockSnapshot?.(round) || null;
  }

  function renderRoundStatusState() {
    return getRoundStatusController()?.renderRoundStatusState?.();
  }

  function updateFreeCtaVisibility() {
    const banner = document.getElementById("free-cta-banner");
    if (!banner) return;
    const isFreeMode = String(window.Empire?.mode || "war") === "free";
    const daysRemaining = Number(roundStatusState?.daysRemaining);
    const shouldShow = isFreeMode && Number.isFinite(daysRemaining) && daysRemaining <= 0;
    banner.classList.toggle("hidden", !shouldShow);
  }

  function startRoundPhaseTicker() {
    return getRoundStatusController()?.startRoundPhaseTicker?.();
  }

  function stopScenarioIncomeTicker() {
    if (!scenarioIncomeTimer) return;
    clearInterval(scenarioIncomeTimer);
    scenarioIncomeTimer = null;
  }

  function stopOnboardingGrowthTicker() {
    if (!onboardingGrowthTimer) return;
    clearInterval(onboardingGrowthTimer);
    onboardingGrowthTimer = null;
  }

  function startOnboardingGrowthTicker() {
    stopOnboardingGrowthTicker();
    if (activePlayerScenarioKey !== "onboarding-20-edge") return;
    onboardingGrowthTimer = setInterval(() => {
      if (activePlayerScenarioKey !== "onboarding-20-edge") {
        stopOnboardingGrowthTicker();
        return;
      }
      if (window.Empire.token) {
        stopOnboardingGrowthTicker();
        return;
      }
      addCleanCash(10);
      addDirtyCash(4);
      addInfluence(1);
    }, 12000);
  }

  function isDistrictOwnedByScenarioPlayer(district, ownerName) {
    if (isDistrictOwnedByPlayer(district)) return true;
    const ownerKey = normalizeOwnerName(ownerName);
    if (!ownerKey) return false;
    return normalizeOwnerName(district?.owner) === ownerKey;
  }

  function computeDistrictMinuteIncomeFromOwnedDistricts(districts) {
    let clean = 0;
    let dirty = 0;
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (Boolean(district?.isDestroyed)) return;
      const typeKey = String(district?.type || "").trim().toLowerCase();
      const config = LOCAL_SCENARIO_DISTRICT_INCOME_RULES[typeKey];
      if (!config) return;
      clean += Number(config.clean || 0);
      dirty += Number(config.dirty || 0);
    });
    return { clean, dirty };
  }

  function computeOwnedDistrictMinuteIncome(districts, ownerName) {
    if (!ownerName && !Array.isArray(districts)) return { clean: 0, dirty: 0 };

    let clean = 0;
    let dirty = 0;
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (!isDistrictOwnedByScenarioPlayer(district, ownerName)) return;
      if (Boolean(district?.isDestroyed)) return;
      const typeKey = String(district?.type || "").trim().toLowerCase();
      const config = LOCAL_SCENARIO_DISTRICT_INCOME_RULES[typeKey];
      if (!config) return;
      clean += config.clean;
      dirty += config.dirty;
    });
    return { clean, dirty };
  }

  const BLACKOUT_BUILDING_MINUTE_INCOME_RULES = Object.freeze({
    "Autosalon": Object.freeze({ clean: 5, dirty: 1 }),
    "Fitness Club": Object.freeze({ clean: 6, dirty: 0.5 }),
    "Herna": Object.freeze({ clean: 3, dirty: 3 }),
    "Kancelářský blok": Object.freeze({ clean: 6, dirty: 1 }),
    "Kasino": Object.freeze({ clean: 5, dirty: 4 }),
    "Lékárna": Object.freeze({ clean: 3, dirty: 0.4 }),
    "Obchodní centrum": Object.freeze({ clean: 8, dirty: 1 }),
    "Restaurace": Object.freeze({ clean: 3, dirty: 2 }),
    "Směnárna": Object.freeze({ clean: 3.3333, dirty: 1.6667 }),
    "Datové centrum": Object.freeze({ clean: 5, dirty: 0.4 }),
    "Energetická stanice": Object.freeze({ clean: 4, dirty: 0.3 }),
    "Sklad": Object.freeze({ clean: 2, dirty: 0.2 }),
    "Továrna": Object.freeze({ clean: 1, dirty: 0.2 }),
    "Zbrojovka": Object.freeze({ clean: 1.2, dirty: 0.5 }),
    "Brainwash centrum": Object.freeze({ clean: 8, dirty: 1.5 }),
    "Bytový blok": Object.freeze({ clean: 1.5, dirty: 0.5 }),
    Garage: Object.freeze({ clean: 3, dirty: 0.5 }),
    Klinika: Object.freeze({ clean: 2.6667, dirty: 1.3333 }),
    "Rekrutační centrum": Object.freeze({ clean: 2, dirty: 0.3 }),
    "Škola": Object.freeze({ clean: 4.4, dirty: 1 }),
    "Drug lab": Object.freeze({ clean: 1.5, dirty: 2 }),
    "Pašovací tunel": Object.freeze({ clean: 0.2, dirty: 3 }),
    "Pouliční dealeři": Object.freeze({ clean: 0.1, dirty: 4.5 }),
    "Strip club": Object.freeze({ clean: 8, dirty: 2 }),
    "Večerka": Object.freeze({ clean: 3.5, dirty: 1.3 }),
    "Burza": Object.freeze({ clean: 18, dirty: 1 }),
    "Centrální banka": Object.freeze({ clean: 26, dirty: 1 }),
    "Letiště": Object.freeze({ clean: 19, dirty: 1 }),
    "Lobby klub": Object.freeze({ clean: 3, dirty: 22 }),
    "Magistrát": Object.freeze({ clean: 25, dirty: 6 }),
    "Parlament": Object.freeze({ clean: 22, dirty: 3 }),
    "Přístav": Object.freeze({ clean: 26, dirty: 8.5 }),
    "Soud": Object.freeze({ clean: 20, dirty: 10 }),
    "VIP salonek": Object.freeze({ clean: 8, dirty: 22 }),
    "Taxi služba": Object.freeze({ clean: 5.5, dirty: 1.5 })
  });
  const BLACKOUT_BUILDING_MINUTE_HEAT_RULES = Object.freeze({
    "Pašovací tunel": Object.freeze({ heat: 4.3 / 1440 }),
    "Strip club": Object.freeze({ heat: 5 / 1440 }),
    "Datové centrum": Object.freeze({ heat: 5.5 / 1440 }),
    Sklad: Object.freeze({ heat: 2.8 / 1440 }),
    "Večerka": Object.freeze({ heat: 2.5 / 1440 }),
    "Výzkumné centrum": Object.freeze({ heat: 4.8 / 1440 }),
    "Recyklační centrum": Object.freeze({ heat: 4 / 1440 })
  });
  const BLACKOUT_BUILDING_MINUTE_INFLUENCE_RULES = Object.freeze({
    "Pašovací tunel": Object.freeze({ influence: 18 / 1440 }),
    "Pouliční dealeři": Object.freeze({ influence: 3.5 / 1440 }),
    "Strip club": Object.freeze({ influence: 28 / 1440 }),
    "Datové centrum": Object.freeze({ influence: 32 / 1440 }),
    Sklad: Object.freeze({ influence: 14 / 1440 }),
    "Večerka": Object.freeze({ influence: 8 / 1440 }),
    "Výzkumné centrum": Object.freeze({ influence: 30 / 1440 }),
    "Recyklační centrum": Object.freeze({ influence: 16 / 1440 })
  });

  function computeOwnedBuildingMinuteIncome(districts, ownerName) {
    if (!ownerName && !Array.isArray(districts)) return { clean: 0, dirty: 0, byBuilding: {} };

    let clean = 0;
    let dirty = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (!isDistrictOwnedByScenarioPlayer(district, ownerName)) return;
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_INCOME_RULES[String(building || "").trim()];
        if (!rule) return;
        clean += Number(rule.clean || 0);
        dirty += Number(rule.dirty || 0);
        byBuilding[building] = byBuilding[building] || { clean: 0, dirty: 0, count: 0 };
        byBuilding[building].clean += Number(rule.clean || 0);
        byBuilding[building].dirty += Number(rule.dirty || 0);
        byBuilding[building].count += 1;
      });
    });
    return { clean, dirty, byBuilding };
  }

  function computeBuildingMinuteIncomeFromOwnedDistricts(districts) {
    let clean = 0;
    let dirty = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_INCOME_RULES[String(building || "").trim()];
        if (!rule) return;
        clean += Number(rule.clean || 0);
        dirty += Number(rule.dirty || 0);
        byBuilding[building] = byBuilding[building] || { clean: 0, dirty: 0, count: 0 };
        byBuilding[building].clean += Number(rule.clean || 0);
        byBuilding[building].dirty += Number(rule.dirty || 0);
        byBuilding[building].count += 1;
      });
    });
    return { clean, dirty, byBuilding };
  }

  function computeOwnedBuildingMinuteHeat(districts, ownerName) {
    if (!ownerName && !Array.isArray(districts)) return { total: 0, byBuilding: {} };

    let total = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (!isDistrictOwnedByScenarioPlayer(district, ownerName)) return;
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_HEAT_RULES[String(building || "").trim()];
        if (!rule) return;
        const heat = Number(rule.heat || 0);
        total += heat;
        byBuilding[building] = byBuilding[building] || { heat: 0, count: 0 };
        byBuilding[building].heat += heat;
        byBuilding[building].count += 1;
      });
    });
    return { total, byBuilding };
  }

  function computeBuildingMinuteHeatFromOwnedDistricts(districts) {
    let total = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_HEAT_RULES[String(building || "").trim()];
        if (!rule) return;
        const heat = Number(rule.heat || 0);
        total += heat;
        byBuilding[building] = byBuilding[building] || { heat: 0, count: 0 };
        byBuilding[building].heat += heat;
        byBuilding[building].count += 1;
      });
    });
    return { total, byBuilding };
  }

  function computeOwnedBuildingMinuteInfluence(districts, ownerName) {
    if (!ownerName && !Array.isArray(districts)) return { total: 0, byBuilding: {} };

    let total = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (!isDistrictOwnedByScenarioPlayer(district, ownerName)) return;
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_INFLUENCE_RULES[String(building || "").trim()];
        if (!rule) return;
        const influence = Number(rule.influence || 0);
        total += influence;
        byBuilding[building] = byBuilding[building] || { influence: 0, count: 0 };
        byBuilding[building].influence += influence;
        byBuilding[building].count += 1;
      });
    });
    return { total, byBuilding };
  }

  function computeBuildingMinuteInfluenceFromOwnedDistricts(districts) {
    let total = 0;
    const byBuilding = {};
    (Array.isArray(districts) ? districts : []).forEach((district) => {
      if (Boolean(district?.isDestroyed)) return;
      (Array.isArray(district?.buildings) ? district.buildings : []).forEach((building) => {
        const rule = BLACKOUT_BUILDING_MINUTE_INFLUENCE_RULES[String(building || "").trim()];
        if (!rule) return;
        const influence = Number(rule.influence || 0);
        total += influence;
        byBuilding[building] = byBuilding[building] || { influence: 0, count: 0 };
        byBuilding[building].influence += influence;
        byBuilding[building].count += 1;
      });
    });
    return { total, byBuilding };
  }

  function buildBlackoutPlayerSourcesSnapshot(districts, ownerName) {
    const districtSource = getBlackoutIncomeDistricts(districts);
    const districtIncome = districtSource.length
      ? computeDistrictMinuteIncomeFromOwnedDistricts(districtSource)
      : computeOwnedDistrictMinuteIncome(districts, ownerName);
    const districtInfluencePerMinute = districtSource.reduce((sum, district) => {
      return sum + (String(district?.type || "").trim().toLowerCase() === "park" ? 10 : 0);
    }, 0);
    const buildingIncome = districtSource.length
      ? computeBuildingMinuteIncomeFromOwnedDistricts(districtSource)
      : computeOwnedBuildingMinuteIncome(districts, ownerName);
    const buildingHeat = districtSource.length
      ? computeBuildingMinuteHeatFromOwnedDistricts(districtSource)
      : computeOwnedBuildingMinuteHeat(districts, ownerName);
    const buildingInfluence = districtSource.length
      ? computeBuildingMinuteInfluenceFromOwnedDistricts(districtSource)
      : computeOwnedBuildingMinuteInfluence(districts, ownerName);
    return {
      districtIncomePerMinute: districtIncome,
      districtInfluencePerMinute,
      buildingIncomePerMinute: {
        clean: buildingIncome.clean,
        dirty: buildingIncome.dirty,
        byBuilding: buildingIncome.byBuilding
      },
      buildingHeatPerMinute: {
        total: buildingHeat.total,
        byBuilding: buildingHeat.byBuilding
      },
      buildingInfluencePerMinute: {
        total: buildingInfluence.total,
        byBuilding: buildingInfluence.byBuilding
      },
      totalPerMinute: {
        clean: districtIncome.clean + buildingIncome.clean,
        dirty: districtIncome.dirty + buildingIncome.dirty,
        influence: districtInfluencePerMinute + buildingInfluence.total,
        heat: buildingHeat.total
      }
    };
  }

  function hasMeaningfulBlackoutSources(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return false;
    const district = snapshot.districtIncomePerMinute || {};
    const building = snapshot.buildingIncomePerMinute || {};
    return Number(district.clean || 0) > 0
      || Number(district.dirty || 0) > 0
      || Number(snapshot.districtInfluencePerMinute || 0) > 0
      || Number(building.clean || 0) > 0
      || Number(building.dirty || 0) > 0
      || Number(snapshot?.buildingHeatPerMinute?.total || 0) > 0
      || Number(snapshot?.buildingInfluencePerMinute?.total || 0) > 0;
  }

  function syncBlackoutScenarioDistrictIncome(now = Date.now()) {
    if (window.Empire.token || !isBlackoutLikeScenario()) return;
    const marketState = getLocalMarketState();
    if (!marketState || typeof marketState !== "object") return;

    const scenarioIncomeState = marketState.scenarioIncome && typeof marketState.scenarioIncome === "object"
      ? marketState.scenarioIncome
      : {};
    let lastAppliedAt = Number(scenarioIncomeState[BLACKOUT_SCENARIO_INCOME_STORAGE_KEY] || now);
    let cleanRemainder = Number(scenarioIncomeState.cleanRemainder || 0);
    let dirtyRemainder = Number(scenarioIncomeState.dirtyRemainder || 0);
    let buildingCleanRemainder = Number(scenarioIncomeState.buildingCleanRemainder || 0);
    let buildingDirtyRemainder = Number(scenarioIncomeState.buildingDirtyRemainder || 0);
    let buildingHeatRemainder = Number(scenarioIncomeState.buildingHeatRemainder || 0);
    if (!Number.isFinite(lastAppliedAt) || lastAppliedAt > now) {
      lastAppliedAt = now;
    }
    if (!Number.isFinite(cleanRemainder) || cleanRemainder < 0) {
      cleanRemainder = 0;
    }
    if (!Number.isFinite(dirtyRemainder) || dirtyRemainder < 0) {
      dirtyRemainder = 0;
    }
    if (!Number.isFinite(buildingCleanRemainder) || buildingCleanRemainder < 0) {
      buildingCleanRemainder = 0;
    }
    if (!Number.isFinite(buildingDirtyRemainder) || buildingDirtyRemainder < 0) {
      buildingDirtyRemainder = 0;
    }
    if (!Number.isFinite(buildingHeatRemainder) || buildingHeatRemainder < 0) {
      buildingHeatRemainder = 0;
    }

    const elapsedMs = Math.max(0, now - lastAppliedAt);
    if (elapsedMs <= 0) {
      if (scenarioIncomeState[BLACKOUT_SCENARIO_INCOME_STORAGE_KEY] == null) {
        marketState.scenarioIncome = {
          ...scenarioIncomeState,
          [BLACKOUT_SCENARIO_INCOME_STORAGE_KEY]: now
        };
        saveLocalMarketState(marketState);
      }
      syncGuestEconomyFromMarket();
      return;
    }

    const liveBlackoutSources = buildBlackoutPlayerSourcesSnapshot(window.Empire.districts, resolveActiveScenarioOwnerName());
    if (hasMeaningfulBlackoutSources(liveBlackoutSources)) {
      lastValidBlackoutSources = liveBlackoutSources;
    }
    const activeBlackoutSources = hasMeaningfulBlackoutSources(liveBlackoutSources)
      ? liveBlackoutSources
      : lastValidBlackoutSources || liveBlackoutSources;
    const incomePerMinute = activeBlackoutSources.districtIncomePerMinute || { clean: 0, dirty: 0 };
    const influencePerMinute =
      Math.max(0, Number(activeBlackoutSources.districtInfluencePerMinute || 0))
      + Math.max(0, Number(activeBlackoutSources?.buildingInfluencePerMinute?.total || 0));
    const buildingIncomePerMinute = activeBlackoutSources.buildingIncomePerMinute || { clean: 0, dirty: 0, byBuilding: {} };
    const buildingHeatPerMinute = Math.max(0, Number(activeBlackoutSources?.buildingHeatPerMinute?.total || 0));
    let influenceRemainder = Math.max(0, Number(scenarioIncomeState.influenceRemainder || 0));
    let influenceTickRemainderMs = Math.max(0, Number(scenarioIncomeState.influenceTickRemainderMs || 0));
    const elapsedMinutes = elapsedMs / 60000;
    if (incomePerMinute.clean > 0) {
      const cleanRaw = incomePerMinute.clean * elapsedMinutes + cleanRemainder;
      const cleanWhole = Math.floor(cleanRaw);
      cleanRemainder = Math.max(0, cleanRaw - cleanWhole);
      if (cleanWhole > 0) {
        addLocalMoney(marketState.balances, cleanWhole, "clean");
      }
    }
    if (incomePerMinute.dirty > 0) {
      const dirtyRaw = incomePerMinute.dirty * elapsedMinutes + dirtyRemainder;
      const dirtyWhole = Math.floor(dirtyRaw);
      dirtyRemainder = Math.max(0, dirtyRaw - dirtyWhole);
      if (dirtyWhole > 0) {
        addLocalMoney(marketState.balances, dirtyWhole, "dirty");
      }
    }
    if (buildingIncomePerMinute.clean > 0) {
      const cleanRaw = buildingIncomePerMinute.clean * elapsedMinutes + buildingCleanRemainder;
      const cleanWhole = Math.floor(cleanRaw);
      buildingCleanRemainder = Math.max(0, cleanRaw - cleanWhole);
      if (cleanWhole > 0) {
        addLocalMoney(marketState.balances, cleanWhole, "clean");
      }
    }
    if (buildingIncomePerMinute.dirty > 0) {
      const dirtyRaw = buildingIncomePerMinute.dirty * elapsedMinutes + buildingDirtyRemainder;
      const dirtyWhole = Math.floor(dirtyRaw);
      buildingDirtyRemainder = Math.max(0, dirtyRaw - dirtyWhole);
      if (dirtyWhole > 0) {
        addLocalMoney(marketState.balances, dirtyWhole, "dirty");
      }
    }
    if (influencePerMinute > 0) {
      const influenceElapsedMs = elapsedMs + influenceTickRemainderMs;
      const influenceTicks = Math.floor(influenceElapsedMs / 10000);
      influenceTickRemainderMs = Math.max(0, influenceElapsedMs - influenceTicks * 10000);
      const influenceRaw = (influenceTicks * (influencePerMinute / 6)) + influenceRemainder;
      const influenceWhole = Math.floor(influenceRaw);
      influenceRemainder = Math.max(0, influenceRaw - influenceWhole);
      if (influenceWhole > 0) {
        addInfluence(influenceWhole);
        const currentProfile = cachedProfile || window.Empire.player || null;
        if (currentProfile && typeof currentProfile === "object") {
          const nextInfluence = Math.max(0, Math.floor(Number(currentProfile.influence || 0)) + influenceWhole);
          cachedProfile = { ...currentProfile, influence: nextInfluence };
          window.Empire.player = {
            ...(window.Empire.player || {}),
            influence: nextInfluence
          };
        }
        renderInfluenceSpyTopbarStat({ animate: true });
      }
    } else {
      influenceTickRemainderMs = 0;
    }
    if (buildingHeatPerMinute > 0) {
      const heatRaw = buildingHeatPerMinute * elapsedMinutes + buildingHeatRemainder;
      const heatTenths = Math.floor((heatRaw + Number.EPSILON) * 10);
      const heatDelta = heatTenths / 10;
      buildingHeatRemainder = Math.max(0, heatRaw - heatDelta);
      if (heatDelta > 0) {
        const currentHeat = resolveWantedLevel(cachedProfile || window.Empire.player || {});
        setPlayerWantedHeat(currentHeat + heatDelta);
      }
    }

    marketState.scenarioIncome = {
      ...scenarioIncomeState,
      [BLACKOUT_SCENARIO_INCOME_STORAGE_KEY]: now,
      cleanRemainder,
      dirtyRemainder,
      buildingCleanRemainder,
      buildingDirtyRemainder,
      buildingHeatRemainder,
      influenceRemainder,
      influenceTickRemainderMs,
      buildingIncome: {
        cleanPerMinute: buildingIncomePerMinute.clean,
        dirtyPerMinute: buildingIncomePerMinute.dirty,
        byBuilding: buildingIncomePerMinute.byBuilding
      },
      buildingHeat: {
        perMinute: buildingHeatPerMinute
      }
    };
    saveLocalMarketState(marketState);
    syncGuestEconomyFromMarket();
  }

  function startScenarioIncomeTicker() {
    stopScenarioIncomeTicker();
    syncBlackoutScenarioDistrictIncome();
    scenarioIncomeTimer = setInterval(() => {
      syncBlackoutScenarioDistrictIncome();
    }, 10000);
  }

  function stopPoliceRaidProtectionTicker() {
    if (!policeRaidProtectionTimer) return;
    clearInterval(policeRaidProtectionTimer);
    policeRaidProtectionTimer = null;
  }

  function syncPoliceRaidProtectionDisplays() {
    const profile = cachedProfile || window.Empire.player || {};
    const protectionText = `Ochrana po razii: ${formatPoliceRaidProtectionLabel(profile)}`;
    const gangHeatProtection = document.getElementById("gang-heat-modal-protection");
    if (gangHeatProtection && !gangHeatProtection.closest(".hidden")) {
      gangHeatProtection.textContent = protectionText;
    }
    const profileProtection = document.getElementById("profile-modal-raid-protection");
    if (profileProtection && !profileProtection.closest(".hidden")) {
      profileProtection.textContent = formatPoliceRaidProtectionLabel(profile);
    }
    const wantedEl = document.getElementById("profile-modal-wanted");
    const wantedLockEl = document.getElementById("profile-modal-wanted-lock");
    if (wantedEl && !wantedEl.closest(".hidden")) {
      wantedEl.title = `Hledanost: ${formatWantedHeat(resolveWantedLevel(profile))} | ${formatPoliceRaidProtectionLabel(profile)}`;
    }
    if (wantedLockEl) {
      const until = resolvePoliceRaidProtectionUntil(profile);
      const active = until > Date.now();
      wantedLockEl.classList.toggle("hidden", !active);
      wantedLockEl.title = active ? `Aktivní ochrana po razii: ${formatDurationLabel(until - Date.now())}` : "Bez aktivní ochrany po razii";
    }
  }

  function startPoliceRaidProtectionTicker() {
    stopPoliceRaidProtectionTicker();
    syncPoliceRaidProtectionDisplays();
    policeRaidProtectionTimer = setInterval(() => {
      syncPoliceRaidProtectionDisplays();
    }, 1000);
  }

  function initMapModeControls() {
    const root = document.getElementById("map-mode-switch");
    const buttons = Array.from(document.querySelectorAll("[data-map-mode]"));
    if (!root || !buttons.length) return;

    const syncVisibility = () => {
      root.classList.remove("hidden");
    };

    const syncState = () => {
      const activeMode = String(window.Empire.Map?.getMapMode?.() || "night").trim().toLowerCase();
      if (!activePlayerScenarioKey || isBlackoutLikeScenario()) {
        roundStatusOverride = buildRoundStatusPresetForMode(activeMode);
        renderRoundStatusState();
      }
      buttons.forEach((button) => {
        const mode = String(button.getAttribute("data-map-mode") || "").trim().toLowerCase();
        button.classList.toggle("is-active", mode === activeMode);
        button.setAttribute("aria-pressed", mode === activeMode ? "true" : "false");
      });
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = String(button.getAttribute("data-map-mode") || "").trim().toLowerCase();
        if (!mode) return;
        roundStatusOverride = buildRoundStatusPresetForMode(mode);
        window.Empire.Map?.setMapMode?.(mode);
        renderRoundStatusState();
        syncState();
      });
    });

    document.addEventListener("empire:map-mode-changed", syncState);
    document.addEventListener("empire:scenario-applied", syncVisibility);
    syncState();
    syncVisibility();
  }

  function cloneIndexMapSnapshotValue(value) {
    try {
      return JSON.parse(JSON.stringify(value ?? null));
    } catch {
      return value ?? null;
    }
  }

  function captureGuestIndexBaseSnapshot() {
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    return {
      profile: cloneIndexMapSnapshotValue(window.Empire.player || {}),
      districts: cloneIndexMapSnapshotValue(districts),
      mapMode: String(window.Empire.Map?.getMapMode?.() || "night").trim().toLowerCase() || "night"
    };
  }

  function syncIndexMapToggleButton() {
    const toggleButton = document.getElementById("map-view-toggle");
    if (!toggleButton) return;
    const shouldShow = !window.Empire.token && guestIndexMapViewBootstrapped && guestIndexBaseSnapshot?.districts?.length;
    toggleButton.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;
    const hraActive = activeIndexMapView === "hra" || activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY;
    toggleButton.classList.toggle("is-active", hraActive);
    toggleButton.setAttribute("aria-pressed", hraActive ? "true" : "false");
    toggleButton.textContent = hraActive ? "INDEX" : "HRA";
    toggleButton.title = hraActive
      ? "Přepnout na původní index mapu"
      : "Přepnout na HRA mapu";
  }

  function applyGuestIndexBaseSnapshot(options = {}) {
    const snapshot = guestIndexBaseSnapshot;
    if (!snapshot?.districts?.length) return;
    const preferredMode = String(options?.mapMode || window.Empire.Map?.getMapMode?.() || snapshot.mapMode || "night").trim().toLowerCase();
    activePlayerScenarioKey = "";
    activeScenarioOwnerName = "";
    scenarioUniqueOwnerColors = false;
    scenarioProfileAvatarOverride = null;
    setScenarioVisionMode(false);
    setScenarioAllianceOwners([]);
    setScenarioEnemyOwners([]);
    setScenarioAllianceIcons([]);
    syncMapVisionContext();
    roundStatusOverride = buildRoundStatusPresetForMode(preferredMode);
    stopOnboardingGrowthTicker();
    window.Empire.player = cloneIndexMapSnapshotValue(snapshot.profile || {});
    window.Empire.Map?.clearUnderAttackDistricts?.();
    window.Empire.Map?.clearPoliceActions?.();
    window.Empire.Map?.clearSpyActions?.();
    window.Empire.Map?.clearRaidActions?.();
    window.Empire.Map?.clearBountyDistrictMarkers?.();
    window.Empire.Map?.setDistricts?.(cloneIndexMapSnapshotValue(snapshot.districts || []));
    window.Empire.Map?.setMapMode?.(preferredMode || snapshot.mapMode || "night");
    updateProfile(window.Empire.player || {});
    renderRoundStatusState();
    activeIndexMapView = "index";
    syncIndexMapToggleButton();
  }

  function applyIndexMapView(viewKey, options = {}) {
    const normalizedView = String(viewKey || "").trim().toLowerCase() === "index" ? "index" : "hra";
    const preferredMode = String(options?.mapMode || window.Empire.Map?.getMapMode?.() || "night").trim().toLowerCase() || "night";
    if (normalizedView === "index") {
      applyGuestIndexBaseSnapshot({ mapMode: preferredMode });
      return;
    }
    applyPlayerScenario(INTERNAL_INDEX_HRA_SCENARIO_KEY);
    if (preferredMode) {
      roundStatusOverride = buildRoundStatusPresetForMode(preferredMode);
      window.Empire.Map?.setMapMode?.(preferredMode);
      renderRoundStatusState();
    }
    activeIndexMapView = "hra";
    syncIndexMapToggleButton();
  }

  function initIndexMapToggleButton() {
    const toggleButton = document.getElementById("map-view-toggle");
    if (!toggleButton || toggleButton.dataset.bound === "1") {
      syncIndexMapToggleButton();
      return;
    }
    toggleButton.dataset.bound = "1";
    toggleButton.addEventListener("click", () => {
      if (window.Empire.token || !guestIndexMapViewBootstrapped) return;
      const nextView = activeIndexMapView === "hra" || activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY
        ? "index"
        : "hra";
      applyIndexMapView(nextView, {
        mapMode: window.Empire.Map?.getMapMode?.() || "night"
      });
    });
    syncIndexMapToggleButton();
  }

  function bootstrapGuestIndexMapView() {
    if (window.Empire.token || guestIndexMapViewBootstrapped) {
      syncIndexMapToggleButton();
      return;
    }
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    if (!districts.length || !window.Empire.Map?.setDistricts) {
      syncIndexMapToggleButton();
      return;
    }
    guestIndexBaseSnapshot = captureGuestIndexBaseSnapshot();
    guestIndexMapViewBootstrapped = true;
    initIndexMapToggleButton();
    applyIndexMapView(DEFAULT_INDEX_MAP_VIEW, {
      mapMode: guestIndexBaseSnapshot?.mapMode || "night"
    });
  }

  function initMobileViewportLayoutLock() {
    const media = window.matchMedia("(max-width: 720px)");
    const root = document.documentElement;
    let lastWidth = window.innerWidth;

    const apply = () => {
      if (!media.matches) {
        root.style.removeProperty("--mobile-locked-vh");
        return;
      }
      const vh = Math.max(
        0,
        Math.floor(window.innerHeight || window.visualViewport?.height || document.documentElement.clientHeight || 0)
      );
      if (vh > 0) {
        root.style.setProperty("--mobile-locked-vh", `${vh}px`);
      }
      lastWidth = window.innerWidth;
    };

    apply();
    window.addEventListener("orientationchange", () => {
      window.setTimeout(apply, 140);
    });
    window.addEventListener("resize", () => {
      if (!media.matches) {
        apply();
        return;
      }
      const widthDelta = Math.abs(window.innerWidth - lastWidth);
      if (widthDelta > 40) {
        apply();
      }
    });
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
    } else if (typeof media.addListener === "function") {
      media.addListener(apply);
    }
  }

  function initMobileTopbarScrollState() {
    const media = window.matchMedia("(max-width: 720px)");
    const topbar = document.querySelector(".topbar");
    let ticking = false;
    let condensed = false;

    const applyState = () => {
      ticking = false;
      if (media.matches) {
        const scrollY = Math.max(0, window.scrollY || 0);
        if (!condensed && scrollY > 44) {
          condensed = true;
        } else if (condensed && scrollY < 18) {
          condensed = false;
        }
      } else {
        condensed = false;
      }
      document.body.classList.toggle("is-mobile-topbar-condensed", condensed);
      if (topbar && media.matches) {
        document.documentElement.style.setProperty("--mobile-topbar-offset", `${Math.ceil(topbar.offsetHeight)}px`);
      } else {
        document.documentElement.style.removeProperty("--mobile-topbar-offset");
      }
      if (topbar && !media.matches) {
        document.documentElement.style.setProperty("--desktop-topbar-offset", `${Math.ceil(topbar.offsetHeight)}px`);
      } else {
        document.documentElement.style.removeProperty("--desktop-topbar-offset");
      }
    };

    const requestApply = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(applyState);
    };

    applyState();
    window.addEventListener("scroll", requestApply, { passive: true });
    window.addEventListener("resize", requestApply);
    if (window.visualViewport && !media.matches) {
      window.visualViewport.addEventListener("resize", requestApply);
      window.visualViewport.addEventListener("scroll", requestApply);
    }
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", requestApply);
    } else if (typeof media.addListener === "function") {
      media.addListener(requestApply);
    }
  }

  function setMobileTopbarCoveredByPrimaryModal(covered) {
    const media = window.matchMedia("(max-width: 720px)");
    document.body.classList.toggle("mobile-primary-modal-covers-topbar", Boolean(covered) && media.matches);
  }

  function initMobileScenarioCardPlacement() {
    const scenarioCard = document.getElementById("scenario-card");
    const scenarioAnchor = document.getElementById("scenario-card-anchor");
    const profileGangCard = document.getElementById("profile-gang-card");
    const main = document.querySelector(".main");
    if (!scenarioCard || !scenarioAnchor || !profileGangCard || !main) return;

    let profileAnchor = document.getElementById("profile-gang-card-anchor");
    if (!profileAnchor) {
      profileAnchor = document.createElement("div");
      profileAnchor.id = "profile-gang-card-anchor";
      profileAnchor.className = "hidden";
      profileAnchor.setAttribute("aria-hidden", "true");
      profileGangCard.insertAdjacentElement("beforebegin", profileAnchor);
    }

    const media = window.matchMedia("(max-width: 720px)");
    const restoreToPanel = () => {
      if (scenarioCard.parentElement === scenarioAnchor.parentElement && scenarioCard.previousElementSibling === scenarioAnchor) {
        return;
      }
      scenarioAnchor.insertAdjacentElement("afterend", scenarioCard);
    };

    const restoreProfileToPanel = () => {
      if (profileGangCard.parentElement === profileAnchor.parentElement && profileGangCard.previousElementSibling === profileAnchor) {
        return;
      }
      profileAnchor.insertAdjacentElement("afterend", profileGangCard);
    };

    const moveProfileUnderResources = () => {
      if (profileGangCard.parentElement === main && profileGangCard === main.firstElementChild) {
        return;
      }
      main.insertAdjacentElement("afterbegin", profileGangCard);
    };

    const moveScenarioToProfileSlot = () => {
      if (scenarioCard.parentElement === profileAnchor.parentElement && scenarioCard.previousElementSibling === profileAnchor) {
        return;
      }
      profileAnchor.insertAdjacentElement("afterend", scenarioCard);
    };

    const applyPlacement = () => {
      if (media.matches) {
        moveProfileUnderResources();
        moveScenarioToProfileSlot();
        return;
      }
      restoreProfileToPanel();
      restoreToPanel();
    };

    applyPlacement();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyPlacement);
    } else if (typeof media.addListener === "function") {
      media.addListener(applyPlacement);
    }
    window.addEventListener("resize", applyPlacement);
  }

  function initMobileLeaderboardCardPlacement() {
    const leaderboardCard = document.getElementById("leaderboard-card");
    const leaderboardAnchor = document.getElementById("leaderboard-card-anchor");
    const allianceChatCard = document.getElementById("alliance-chat-card");
    if (!leaderboardCard || !leaderboardAnchor || !allianceChatCard) return;

    const media = window.matchMedia("(max-width: 1200px)");

    const restoreToLeftPanel = () => {
      if (
        leaderboardCard.parentElement === leaderboardAnchor.parentElement
        && leaderboardCard.previousElementSibling === leaderboardAnchor
      ) {
        return;
      }
      leaderboardAnchor.insertAdjacentElement("afterend", leaderboardCard);
    };

    const moveUnderAllianceChat = () => {
      if (
        leaderboardCard.parentElement === allianceChatCard.parentElement
        && leaderboardCard.previousElementSibling === allianceChatCard
      ) {
        return;
      }
      allianceChatCard.insertAdjacentElement("afterend", leaderboardCard);
    };

    const applyPlacement = () => {
      if (media.matches) {
        moveUnderAllianceChat();
        return;
      }
      restoreToLeftPanel();
    };

    applyPlacement();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyPlacement);
    } else if (typeof media.addListener === "function") {
      media.addListener(applyPlacement);
    }
    window.addEventListener("resize", applyPlacement);
  }

  function initMobileMarketBuildingShortcutsPlacement() {
    const shortcuts = document.getElementById("market-building-shortcuts");
    const homeAnchor = document.getElementById("market-building-shortcuts-anchor");
    const mobileAnchor = document.getElementById("mobile-market-shortcuts-anchor");
    if (!shortcuts || !homeAnchor || !mobileAnchor) return;

    const media = window.matchMedia("(max-width: 720px)");

    const restoreToLeftPanel = () => {
      if (
        shortcuts.parentElement === homeAnchor.parentElement
        && shortcuts.previousElementSibling === homeAnchor
      ) {
        return;
      }
      homeAnchor.insertAdjacentElement("afterend", shortcuts);
    };

    const moveUnderProfile = () => {
      if (
        shortcuts.parentElement === mobileAnchor.parentElement
        && shortcuts.previousElementSibling === mobileAnchor
      ) {
        return;
      }
      mobileAnchor.insertAdjacentElement("afterend", shortcuts);
    };

    const applyPlacement = () => {
      if (media.matches) {
        moveUnderProfile();
        return;
      }
      restoreToLeftPanel();
    };

    applyPlacement();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyPlacement);
    } else if (typeof media.addListener === "function") {
      media.addListener(applyPlacement);
    }
    window.addEventListener("resize", applyPlacement);
  }

  function initMobilePrimaryActionCardsPlacement() {
    const shortcuts = document.getElementById("market-building-shortcuts");
    const cityEventsCard = document.getElementById("city-events-open")?.closest(".card");
    const buildingsCard = document.getElementById("buildings-open")?.closest(".card");
    const marketCard = document.getElementById("market-open")?.closest(".card");
    const cityEventsAnchor = document.getElementById("city-events-card-anchor");
    const buildingsAnchor = document.getElementById("buildings-card-anchor");
    const marketAnchor = document.getElementById("market-card-anchor");
    if (
      !shortcuts
      || !cityEventsCard
      || !buildingsCard
      || !marketCard
      || !cityEventsAnchor
      || !buildingsAnchor
      || !marketAnchor
    ) {
      return;
    }

    const media = window.matchMedia("(max-width: 720px)");

    const restoreToLeftPanel = () => {
      cityEventsAnchor.insertAdjacentElement("afterend", cityEventsCard);
      buildingsAnchor.insertAdjacentElement("afterend", buildingsCard);
      marketAnchor.insertAdjacentElement("afterend", marketCard);
    };

    const moveUnderShortcuts = () => {
      let insertAfter = shortcuts;
      [cityEventsCard, buildingsCard, marketCard].forEach((card) => {
        insertAfter.insertAdjacentElement("afterend", card);
        insertAfter = card;
      });
    };

    const applyPlacement = () => {
      if (media.matches) {
        moveUnderShortcuts();
        return;
      }
      restoreToLeftPanel();
    };

    applyPlacement();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyPlacement);
    } else if (typeof media.addListener === "function") {
      media.addListener(applyPlacement);
    }
    window.addEventListener("resize", applyPlacement);
  }

  function initMobileModalTopbarResourceVisibility() {
    const media = window.matchMedia("(max-width: 720px)");
    const modalNodes = Array.from(document.querySelectorAll(".modal"));
    const topbarVisibleBuildingTypes = new Set(["building-detail-modal:drug-lab", "building-detail-modal:pharmacy", "building-detail-modal:factory", "building-detail-modal:armory"]);
    const topbarHiddenModalIds = new Set([
      "events-modal",
      "buildings-modal",
      "bounty-modal",
      "storage-modal",
      "leaderboard-modal",
      "profile-modal",
      "gang-heat-modal",
      "alliance-modal",
      "alliance-create-modal",
      "alliance-management-modal",
      "settings-modal",
      "district-modal",
      "district-defense-modal",
      "spy-confirm-modal",
      "raid-confirm-modal",
      "occupy-confirm-modal",
      "spy-result-modal",
      "spy-warning-modal",
      "raid-result-modal",
      "police-action-result-modal",
      "boost-modal",
      "attack-modal",
      "attack-confirm-modal",
      "attack-result-modal"
    ]);
    if (!modalNodes.length) return;

    const applyState = () => {
      if (!media.matches) {
        document.body.classList.remove("mobile-hide-topbar");
        document.body.classList.remove("mobile-hide-topbar-stats");
        document.body.classList.remove("mobile-police-modal-open");
        document.body.classList.remove("mobile-boost-modal-open");
        return;
      }

      const openModals = modalNodes.filter((modal) => !modal.classList.contains("hidden"));
      const hasNonSpecialBuildingDetailOpen = openModals.some((modal) => (
        modal.id === "building-detail-modal"
        && !topbarVisibleBuildingTypes.has(`${modal.id}:${String(modal.dataset.buildingMechanicsType || "").trim()}`)
      ));
      const hasSpecialBuildingDetailOpen = openModals.some((modal) => (
        modal.id === "building-detail-modal"
        && topbarVisibleBuildingTypes.has(`${modal.id}:${String(modal.dataset.buildingMechanicsType || "").trim()}`)
      ));
      const shouldHideTopbar = openModals.some((modal) => topbarHiddenModalIds.has(modal.id)) || hasNonSpecialBuildingDetailOpen;
      const policeModalOpen = openModals.some((modal) => modal.id === "police-action-result-modal");
      const boostModalOpen = openModals.some((modal) => modal.id === "boost-modal");
      const shouldHideStats = false;
      document.body.classList.toggle("mobile-hide-topbar", shouldHideTopbar);
      document.body.classList.toggle("mobile-hide-topbar-stats", shouldHideStats);
      document.body.classList.toggle("mobile-police-modal-open", policeModalOpen);
      document.body.classList.toggle("mobile-boost-modal-open", boostModalOpen);
    };

    const observer = new MutationObserver((mutations) => {
      if (!mutations?.length) return;
      applyState();
    });

    modalNodes.forEach((modal) => {
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyState);
    } else if (typeof media.addListener === "function") {
      media.addListener(applyState);
    }
    window.addEventListener("resize", applyState);
    applyState();
  }

  function recordVerifiedIntelEvent(payload = {}) {
    const record = window.Empire.Map?.recordIntelEvent;
    if (typeof record !== "function") return;
    try {
      record({
        ...payload,
        intelLevel: "verified"
      });
    } catch {}
  }

  function normalizeSpyIntelKnownFields(rawEntry) {
    return getSpyIntelHelpers()?.normalizeSpyIntelKnownFields?.(rawEntry) || {
      weapons: rawEntry?.weapons !== null && rawEntry?.weapons !== undefined && rawEntry?.weapons !== "",
      powerRangeLabel: Boolean(String(rawEntry?.powerRangeLabel || "").trim()),
      districtType: Boolean(String(rawEntry?.districtType || "").trim()),
      atmosphere: Boolean(String(rawEntry?.atmosphere || "").trim()),
      buildings: Array.isArray(rawEntry?.buildings)
    };
  }

  function hasCompleteSpyIntel(rawEntry) {
    return getSpyIntelHelpers()?.hasCompleteSpyIntel?.(rawEntry) || false;
  }

  function mergeDistrictSpyIntelEntries(previousEntry, nextEntry) {
    return getSpyIntelHelpers()?.mergeDistrictSpyIntelEntries?.(previousEntry, nextEntry)
      || nextEntry
      || previousEntry
      || null;
  }

  function normalizeDistrictSpyIntelEntry(districtId, rawEntry) {
    return getSpyIntelHelpers()?.normalizeDistrictSpyIntelEntry?.(districtId, rawEntry) || null;
  }

  function readStoredDistrictSpyIntel() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_DISTRICT_SPY_INTEL_KEY) || "{}");
      if (!parsed || typeof parsed !== "object") return;
      Object.entries(parsed).forEach(([districtId, rawEntry]) => {
        const normalized = normalizeDistrictSpyIntelEntry(districtId, rawEntry);
        if (!normalized) return;
        districtSpyIntelCache.set(String(normalized.districtId), normalized);
      });
    } catch {}
  }

  function writeStoredDistrictSpyIntel() {
    const serialized = {};
    districtSpyIntelCache.forEach((entry, districtId) => {
      serialized[String(districtId)] = {
        weapons: entry.weapons,
        powerRangeLabel: entry.powerRangeLabel,
        buildings: Array.isArray(entry.buildings) ? [...entry.buildings] : [],
        districtType: entry.districtType,
        atmosphere: entry.atmosphere,
        knownFields: { ...(entry.knownFields || {}) },
        createdAt: entry.createdAt
      };
    });
    localStorage.setItem(LOCAL_DISTRICT_SPY_INTEL_KEY, JSON.stringify(serialized));
  }

  function clearDistrictSpyIntel(districtId) {
    const key = String(Number(districtId));
    if (!districtSpyIntelCache.has(key)) return false;
    districtSpyIntelCache.delete(key);
    writeStoredDistrictSpyIntel();
    return true;
  }

  function applyOneTimeDistrictSpyIntelReset() {
    const alreadyApplied = localStorage.getItem(DISTRICT_SPY_INTEL_RESET_ONCE_KEY) === "1";
    if (alreadyApplied) return;
    DISTRICT_SPY_INTEL_RESET_IDS.forEach((districtId) => {
      clearDistrictSpyIntel(districtId);
    });
    localStorage.setItem(DISTRICT_SPY_INTEL_RESET_ONCE_KEY, "1");
  }

  function setDistrictSpyIntel(districtId, intelData, options = {}) {
    const persist = options?.persist !== false;
    const normalized = normalizeDistrictSpyIntelEntry(districtId, intelData);
    if (!normalized) return null;
    const cacheKey = String(normalized.districtId);
    const merged = mergeDistrictSpyIntelEntries(districtSpyIntelCache.get(cacheKey) || null, normalized) || normalized;
    districtSpyIntelCache.set(cacheKey, merged);
    if (persist) {
      writeStoredDistrictSpyIntel();
    }
    return { ...merged, buildings: [...merged.buildings] };
  }

  function getDistrictSpyIntel(districtId) {
    const key = String(Number(districtId));
    if (!districtSpyIntelCache.has(key)) return null;
    const value = districtSpyIntelCache.get(key);
    if (!value) return null;
    return { ...value, buildings: [...value.buildings] };
  }

  function normalizeSpyCount(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Math.max(0, Math.floor(Number(fallback) || 0));
    return Math.max(0, Math.floor(parsed));
  }

  function resolveFactionBaseSpyCount(structureValue) {
    const factionKey = String(structureValue || "").trim().toLowerCase();
    const configured = BASE_SPY_COUNT_BY_FACTION[factionKey];
    return Number.isFinite(Number(configured))
      ? normalizeSpyCount(configured, DEFAULT_BASE_SPY_COUNT)
      : DEFAULT_BASE_SPY_COUNT;
  }

  function readStoredSpyCount() {
    const parsed = Number(localStorage.getItem(LOCAL_SPY_COUNT_KEY));
    if (!Number.isFinite(parsed)) return null;
    return normalizeSpyCount(parsed, null);
  }

  function resolveSpyCountFromPayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    const candidates = [
      payload.spyCount,
      payload.spy_count,
      payload.spies,
      payload.spyAgents,
      payload.spy_agents,
      payload.availableSpies,
      payload.available_spies
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const parsed = Number(candidates[i]);
      if (Number.isFinite(parsed)) return normalizeSpyCount(parsed, 0);
    }
    return null;
  }

  function getSpyCount() {
    if (cachedSpyCount != null) return cachedSpyCount;
    const fromStorage = readStoredSpyCount();
    if (fromStorage != null) {
      cachedSpyCount = fromStorage;
      return cachedSpyCount;
    }
    const fallbackFaction = cachedProfile?.structure || readStoredStructure();
    cachedSpyCount = resolveFactionBaseSpyCount(fallbackFaction);
    localStorage.setItem(LOCAL_SPY_COUNT_KEY, String(cachedSpyCount));
    return cachedSpyCount;
  }

  function renderInfluenceSpyTopbarStat({ animate = false, instant = false } = {}) {
    const wrap = document.getElementById("stat-influence-wrap");
    const label = document.getElementById("stat-influence-label");
    const value = document.getElementById("stat-influence");
    if (!wrap || !label || !value) return;

    const influenceValue = normalizeSpyCount(cachedEconomy?.influence || 0, 0);
    const spyCount = getSpyCount();
    const topbarMode = isSpyCountShownInTopbar ? "spies" : "influence";

    value.dataset.influenceValue = String(influenceValue);
    value.dataset.spyValue = String(spyCount);
    label.textContent = topbarMode === "spies" ? "Špeh" : "Vliv";
    if (instant) {
      syncMoneyStatToCachedValue(value, topbarMode === "spies" ? spyCount : influenceValue, { prefix: "" });
      lastRenderedInfluenceValue = influenceValue;
      lastRenderedTopbarMode = topbarMode;
      wrap.classList.toggle("is-spies", isSpyCountShownInTopbar);
      const shownLabel = isSpyCountShownInTopbar ? `${spyCount} špehů` : `${influenceValue} vlivu`;
      const hiddenLabel = isSpyCountShownInTopbar ? `${influenceValue} vlivu` : `${spyCount} špehů`;
      wrap.setAttribute("aria-label", `${shownLabel}. Klikni pro přepnutí na ${hiddenLabel}.`);
      return;
    }
    if (topbarMode === "spies") {
      stopMoneyStatCounter(value);
      value.textContent = String(spyCount);
    } else if (lastRenderedTopbarMode === "influence" && lastRenderedInfluenceValue != null) {
      animateMoneyStatCounter(value, influenceValue, { prefix: "" });
      if (influenceValue !== lastRenderedInfluenceValue) {
        animateMoneyStatValue(value, influenceValue - lastRenderedInfluenceValue);
      }
    } else {
      stopMoneyStatCounter(value);
      value.textContent = String(influenceValue);
    }
    lastRenderedInfluenceValue = influenceValue;
    lastRenderedTopbarMode = topbarMode;
    wrap.classList.toggle("is-spies", isSpyCountShownInTopbar);

    const shownLabel = isSpyCountShownInTopbar ? `${spyCount} špehů` : `${influenceValue} vlivu`;
    const hiddenLabel = isSpyCountShownInTopbar ? `${influenceValue} vlivu` : `${spyCount} špehů`;
    wrap.setAttribute("aria-label", `${shownLabel}. Klikni pro přepnutí na ${hiddenLabel}.`);

    if (!animate) return;
    wrap.classList.remove("is-switching");
    void wrap.offsetWidth;
    wrap.classList.add("is-switching");
    if (topbarStatSwitchTimer) clearTimeout(topbarStatSwitchTimer);
    topbarStatSwitchTimer = setTimeout(() => {
      wrap.classList.remove("is-switching");
      topbarStatSwitchTimer = null;
    }, 340);
  }

  function setSpyCount(value, { persist = true, animate = false } = {}) {
    cachedSpyCount = normalizeSpyCount(value, 0);
    if (persist) {
      localStorage.setItem(LOCAL_SPY_COUNT_KEY, String(cachedSpyCount));
    }
    if (cachedEconomy && typeof cachedEconomy === "object") {
      cachedEconomy.spyCount = cachedSpyCount;
      cachedEconomy.spies = cachedSpyCount;
    }
    renderInfluenceSpyTopbarStat({ animate });
    const spyModal = document.getElementById("spy-confirm-modal");
    if (spyModal && !spyModal.classList.contains("hidden")) {
      renderSpyConfirmModal();
    }
    return cachedSpyCount;
  }

  function consumeSpyAgents(amount = 1) {
    const required = normalizeSpyCount(amount, 0);
    if (required <= 0) return true;
    const available = getSpyCount();
    if (available < required) return false;
    setSpyCount(available - required, { persist: true, animate: isSpyCountShownInTopbar });
    return true;
  }

  function normalizeSpyRecoveryQueue(value) {
    if (!Array.isArray(value)) return [];
    const now = Date.now();
    return value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > now - 24 * 60 * 60 * 1000)
      .map((entry) => Math.max(0, Math.floor(entry)))
      .sort((a, b) => a - b);
  }

  function readSpyRecoveryQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_SPY_RECOVERY_QUEUE_KEY) || "[]");
      return normalizeSpyRecoveryQueue(parsed);
    } catch {
      return [];
    }
  }

  function writeSpyRecoveryQueue(queue) {
    localStorage.setItem(LOCAL_SPY_RECOVERY_QUEUE_KEY, JSON.stringify(normalizeSpyRecoveryQueue(queue)));
  }

  function syncSpyRecoveryTicker() {
    const queue = readSpyRecoveryQueue();
    if (!queue.length) {
      if (spyRecoveryIntervalId != null) {
        clearInterval(spyRecoveryIntervalId);
        spyRecoveryIntervalId = null;
      }
      return;
    }
    if (spyRecoveryIntervalId != null) return;
    spyRecoveryIntervalId = setInterval(() => {
      processSpyRecoveryQueue({ notify: true });
    }, SPY_RECOVERY_TICK_MS);
  }

  function processSpyRecoveryQueue({ notify = false } = {}) {
    const queue = readSpyRecoveryQueue();
    if (!queue.length) {
      syncSpyRecoveryTicker();
      return 0;
    }

    const now = Date.now();
    let recovered = 0;
    const pending = [];
    queue.forEach((entry) => {
      if (entry <= now) {
        recovered += 1;
      } else {
        pending.push(entry);
      }
    });
    writeSpyRecoveryQueue(pending);
    if (recovered > 0) {
      setSpyCount(getSpyCount() + recovered, { persist: true, animate: isSpyCountShownInTopbar });
      pushInfoWindowHistoryEntry({
        title: recovered === 1 ? "Špeh je znovu dostupný" : "Špehové jsou znovu dostupní",
        text: recovered === 1
          ? "1 špeh se vrátil a je připraven k akci."
          : `${recovered} špehové se vrátili a jsou připraveni k akci.`
      });
      if (notify) {
        pushEvent(
          recovered === 1
            ? "1 špeh je opět dostupný."
            : `${recovered} špehové jsou opět dostupní.`
        );
      }
    }
    syncSpyRecoveryTicker();
    return recovered;
  }

  function enqueueSpyRecovery(amount = 1, cooldownMs = SPY_RECOVERY_COOLDOWN_MS) {
    const count = normalizeSpyCount(amount, 0);
    if (count <= 0) return;
    const delay = Math.max(0, Math.floor(Number(cooldownMs) || SPY_RECOVERY_COOLDOWN_MS));
    const now = Date.now();
    const queue = readSpyRecoveryQueue();
    for (let i = 0; i < count; i += 1) {
      queue.push(now + delay);
    }
    writeSpyRecoveryQueue(queue);
    syncSpyRecoveryTicker();
  }

  function getSpyAvailabilitySnapshot() {
    processSpyRecoveryQueue({ notify: false });
    const available = getSpyCount();
    const queue = readSpyRecoveryQueue();
    const nextRecoveryAt = queue.length ? Number(queue[0]) : 0;
    const nextRecoveryRemainingMs = nextRecoveryAt > 0
      ? Math.max(0, nextRecoveryAt - Date.now())
      : 0;
    return {
      available,
      hasRecoveryQueued: queue.length > 0,
      nextRecoveryRemainingMs
    };
  }

  function initInfluenceSpyToggle() {
    const wrap = document.getElementById("stat-influence-wrap");
    if (!wrap || wrap.dataset.spyToggleBound === "1") return;
    wrap.dataset.spyToggleBound = "1";

    const toggle = () => {
      isSpyCountShownInTopbar = !isSpyCountShownInTopbar;
      renderInfluenceSpyTopbarStat({ animate: true });
      document.dispatchEvent(new CustomEvent("empire:topbar-resource-toggle", {
        detail: {
          mode: isSpyCountShownInTopbar ? "spies" : "influence"
        }
      }));
    };

    wrap.addEventListener("click", toggle);
    wrap.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });

    renderInfluenceSpyTopbarStat();
  }

  function bindActions() {
    const safeInit = (name, fn) => {
      try {
        fn();
      } catch (error) {
        console.error(`${name} failed`, error);
      }
    };

    safeInit("initMarketModal", initMarketModal);
    safeInit("initEventsModal", initEventsModal);
    safeInit("initBountyModal", initBountyModal);
    safeInit("initBuildingsModal", initBuildingsModal);
    safeInit("initAllianceModal", initAllianceModal);
    safeInit("initBoostModal", initBoostModal);
    safeInit("initMapBorderModeControls", initMapBorderModeControls);
    safeInit("initMarketBuildingShortcuts", initMarketBuildingShortcuts);
    safeInit("initLeaderboardModal", initLeaderboardModal);
    safeInit("initStorageModal", initStorageModal);
    safeInit("initMoneyStatSkipControls", initMoneyStatSkipControls);
    safeInit("initInfluenceSpyToggle", initInfluenceSpyToggle);
    safeInit("initWeaponsModal", initWeaponsModal);
    safeInit("initWeaponsPopover", initWeaponsPopover);
    safeInit("initDistrictDefenseModal", initDistrictDefenseModal);
    safeInit("initAttackModal", initAttackModal);
    safeInit("initAttackConfirmModal", initAttackConfirmModal);
    safeInit("initAttackResultModal", initAttackResultModal);
    safeInit("initRaidResultModal", initRaidResultModal);
    safeInit("initPoliceActionResultModal", initPoliceActionResultModal);
    safeInit("initSpyConfirmModal", initSpyConfirmModal);
    safeInit("initRaidConfirmModal", initRaidConfirmModal);
    safeInit("initOccupyConfirmModal", initOccupyConfirmModal);
    safeInit("initTrapConfirmModal", initTrapConfirmModal);
    safeInit("initSpyResultModal", initSpyResultModal);
    safeInit("initSpyDetectionAlertModal", initSpyDetectionAlertModal);
    safeInit("initGangHeatModal", initGangHeatModal);
    safeInit("initEventFeedControls", initEventFeedControls);
    safeInit("initInfoWindowHistoryControls", initInfoWindowHistoryControls);
    safeInit("initPlayerScenarioButtons", initPlayerScenarioButtons);
    document.getElementById("attack-btn").addEventListener("click", async () => {
      if (!window.Empire.selectedDistrict) return;
      const attackBtn = document.getElementById("attack-btn");
      const actionMode = attackBtn?.dataset?.actionMode === "occupy" ? "occupy" : "attack";
      const availability = evaluateDistrictActionAvailability(window.Empire.selectedDistrict, actionMode);
      if (!availability.allowed) {
        pushEvent(availability.reason);
        return;
      }
      if (actionMode === "occupy") {
        openOccupyConfirmModal(window.Empire.selectedDistrict);
        return;
      }
      openAttackModal(window.Empire.selectedDistrict);
    });

    const raidBtn = document.getElementById("raid-btn");
    if (raidBtn) {
      raidBtn.addEventListener("click", () => {
        if (!window.Empire.selectedDistrict) return;
        const availability = evaluateDistrictActionAvailability(window.Empire.selectedDistrict, "raid");
        if (!availability.allowed) {
          pushEvent(availability.reason);
          return;
        }
        if (isRaidActionRunning()) {
          pushEvent("Krádež už právě probíhá. Současně může běžet jen jedna.");
          return;
        }
        const cooldownMs = getRaidCooldownRemainingMs();
        if (cooldownMs > 0) {
          pushEvent(`Krádež je na cooldownu ještě ${formatRaidCooldownLabel(cooldownMs)}.`);
          return;
        }
        openRaidConfirmModal(window.Empire.selectedDistrict);
      });
    }

    const spyBtn = document.getElementById("spy-btn");
    if (spyBtn) {
      spyBtn.addEventListener("click", () => {
        if (!window.Empire.selectedDistrict) return;
        if (spyBtn.disabled) {
          if (spyBtn.title) pushEvent(spyBtn.title);
          return;
        }
        const availability = evaluateDistrictActionAvailability(window.Empire.selectedDistrict, "spy");
        if (!availability.allowed) {
          pushEvent(availability.reason);
          return;
        }
        openSpyConfirmModal(window.Empire.selectedDistrict);
      });
    }

    const defenseBtn = document.getElementById("defense-btn");
    if (defenseBtn) {
      defenseBtn.addEventListener("click", () => {
        if (!window.Empire.selectedDistrict) return;
        if (!isDistrictDefendableByPlayer(window.Empire.selectedDistrict)) {
          pushEvent("Obranu lze nastavovat jen ve vlastním nebo aliančním distriktu.");
          return;
        }
        const weaponAccess = resolveCombatWeaponAccess("defense");
        if (!weaponAccess.allowed) {
          pushEvent("Obrana momentálně není dostupná.");
          return;
        }
        openDistrictDefenseModal(window.Empire.selectedDistrict);
      });
    }

    const trapBtn = document.getElementById("trap-btn");
    if (trapBtn) {
      trapBtn.addEventListener("click", () => {
        const district = window.Empire.selectedDistrict;
        if (!district) return;
        if (!isDistrictDefendableByPlayer(district)) {
          pushEvent("Past lze nastražit jen do vlastního nebo aliančního districtu.");
          return;
        }
        if (isDistrictDestroyed(district)) {
          pushEvent("Do zničeného districtu nelze nastražit past.");
          return;
        }
        const trapState = getDistrictTrapControlState(district);
        if (trapState?.isActiveHere || trapState?.moveLocked) {
          if (trapState?.moveLocked) {
            pushEvent(`Past nelze přesunout ještě ${formatTrapMoveCooldownLabel(trapState.moveCooldownRemainingMs)}.`);
          }
          return;
        }
        openTrapConfirmModal(district);
      });
    }

    const refreshRoundBtn = document.getElementById("refresh-round");
    if (refreshRoundBtn) {
      refreshRoundBtn.addEventListener("click", () => {
        window.Empire.API.refreshRound();
      });
    }

    const navProfile = document.getElementById("nav-profile");
    if (navProfile) {
      navProfile.addEventListener("click", () => {
        showProfileModal();
      });
    }

    document.querySelectorAll("[data-nav-settings]").forEach((button) => {
      button.addEventListener("click", () => {
        showSettingsModal();
      });
    });

    document.querySelectorAll("[data-nav-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        localStorage.removeItem("empire_token");
        removeStoredValue("empire_structure");
        window.Empire?.__storagePatch?.removeItem?.("empire:active_auth_mode");
        window.Empire?.__storagePatch?.removeItem?.("empire:active_guest_mode");
        const mode = window.Empire?.mode || "war";
        window.location.href = window.Empire?.getGameModeUrl?.("login", mode) || `login.html?mode=${mode}`;
      });
    });

    const weaponsAttackBtn = document.getElementById("weapons-attack-btn");
    if (weaponsAttackBtn) {
      weaponsAttackBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openWeaponsModal("attack");
      });
    }

    const weaponsDefenseBtn = document.getElementById("weapons-defense-btn");
    if (weaponsDefenseBtn) {
      weaponsDefenseBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openWeaponsModal("defense");
      });
    }
  }

  function initBoostModal() {
    const openBtn = document.getElementById("map-boost-btn");
    const root = document.getElementById("boost-modal");
    const backdrop = document.getElementById("boost-modal-backdrop");
    const closeBtn = document.getElementById("boost-modal-close");
    const modalBody = root?.querySelector(".boost-modal__body") || null;
    const tabButtons = Array.from(root?.querySelectorAll("[data-boost-tab]") || []);
    const actionsPanel = document.getElementById("boost-modal-panel-actions");
    const infoPanel = document.getElementById("boost-modal-panel-info");
    const content = document.getElementById("boost-modal-content");
    const status = document.getElementById("boost-modal-status");
    if (!openBtn || !root || !content) return;
    let activeTab = "actions";
    let swipeState = null;

    const isMobileSwipeViewport = () => window.matchMedia("(max-width: 720px)").matches;

    const setTab = (tab) => {
      activeTab = tab === "info" ? "info" : "actions";
      root.classList.toggle("is-info-tab", activeTab === "info");
      if (actionsPanel) actionsPanel.classList.toggle("hidden", activeTab !== "actions");
      if (infoPanel) infoPanel.classList.toggle("hidden", activeTab !== "info");
      tabButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.boostTab === activeTab);
      });
    };

    const resetSwipeState = () => {
      swipeState = null;
    };

    const finalizeSwipe = () => {
      if (!swipeState) return;
      const {
        startX, startY, lastX, lastY, startedAt
      } = swipeState;
      resetSwipeState();
      if (!isMobileSwipeViewport()) return;
      const deltaX = lastX - startX;
      const deltaY = lastY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const duration = Date.now() - startedAt;
      if (duration > 700 || absX < 34 || absX < absY * 1.15 || absY > 90) return;
      if (deltaX < 0 && activeTab === "actions") setTab("info");
      if (deltaX > 0 && activeTab === "info") setTab("actions");
    };

    const pharmacyBoostDefinitions = [
      {
        key: "recon",
        label: "Ghost Serum boost",
        resourceKey: "ghostSerum",
        resourceLabel: "Ghost Serum",
        cost: 1,
        className: "btn boost-modal__boost-btn boost-modal__boost-btn--ghost",
        description: "+50 % spy speed, +30 % info quality, +25 % attack speed, +25 % steal speed, 2h"
      },
      {
        key: "neuro",
        label: "Overdrive X boost",
        resourceKey: "overdriveX",
        resourceLabel: "Overdrive X",
        cost: 1,
        className: "btn boost-modal__boost-btn boost-modal__boost-btn--overdrive",
        description: "+20 % aktivní akce, 2h, +3 heat"
      }
    ];

    const factoryBoostDefinitions = [
      {
        key: "assault",
        label: "Assault Protocol",
        cost: 2,
        className: "btn boost-modal__factory-btn boost-modal__factory-btn--assault",
        description: "+30 % attack síla, 2h, +3 heat"
      },
      {
        key: "rapid",
        label: "Rapid Strike",
        cost: 3,
        className: "btn boost-modal__factory-btn boost-modal__factory-btn--rapid",
        description: "+40 % rychlost útoku, +25 % rychlost vykrádání, 1.5h, +4 heat"
      },
      {
        key: "breach",
        label: "Breach Mode",
        cost: 4,
        className: "btn boost-modal__factory-btn boost-modal__factory-btn--breach",
        description: "+20 % šance zničit budovu, +15 % ignorování obrany, 2h, +5 heat"
      }
    ];

    const renderPharmacyStatus = (snapshot, ghostSerum, overdriveX) => {
      const effective = snapshot?.effective || {};
      const longestByType = new Map();
      if (Array.isArray(snapshot?.activeEffects)) {
        snapshot.activeEffects.forEach((entry) => {
          const rawType = String(entry?.type || "").trim().toLowerCase();
          const normalizedType = rawType === "neuro" ? "overdrive" : "ghost";
          const remainingMs = Math.max(0, Number(entry?.remainingMs || 0));
          const current = Number(longestByType.get(normalizedType) || 0);
          if (remainingMs > current) {
            longestByType.set(normalizedType, remainingMs);
          }
        });
      }
      const effectParts = [];
      if (longestByType.has("ghost")) {
        effectParts.push(`Ghost Serum boost: ${formatDurationLabel(longestByType.get("ghost"))}`);
      }
      if (longestByType.has("overdrive")) {
        effectParts.push(`Overdrive X boost: ${formatDurationLabel(longestByType.get("overdrive"))}`);
      }
      const effectsLabel = effectParts.length ? effectParts.join(", ") : "žádné";
      return (
        `Ghost Serum: ${ghostSerum} ks • Overdrive X: ${overdriveX} ks • Aktivní boosty: ${effectsLabel}. `
        + `Spy +${Math.max(0, Math.round(Number(effective.spySpeedPct || 0)))}%, `
        + `Info +${Math.max(0, Math.round(Number(effective.infoQualityPct || 0)))}%, `
        + `Attack +${Math.max(0, Math.round(Number(effective.attackSpeedPct || 0)))}%, `
        + `Steal +${Math.max(0, Math.round(Number(effective.stealSpeedPct || 0)))}%`
      );
    };

    const renderFactoryStatus = (snapshot, modules) => {
      const effective = snapshot?.effective || {};
      const labels = { assault: "Assault", rapid: "Rapid", breach: "Breach" };
      const effectParts = Array.isArray(snapshot?.activeEffects)
        ? snapshot.activeEffects
          .slice(0, 4)
          .map((entry) => `${labels[entry.type] || entry.type}: ${formatDurationLabel(entry.remainingMs)}`)
        : [];
      const effectsLabel = effectParts.length ? effectParts.join(", ") : "žádné";
      return (
        `Továrna • Combat Module: ${modules} ks • Aktivní: ${effectsLabel}. `
        + `ATK síla +${Math.max(0, Math.round(Number(effective.attackPowerPct || 0)))}%, `
        + `ATK rychlost +${Math.max(0, Math.round(Number(effective.attackSpeedPct || 0)))}%, `
        + `Raid rychlost +${Math.max(0, Math.round(Number(effective.raidSpeedPct || 0)))}%, `
        + `Destroy +${Math.max(0, Math.round(Number(effective.destroyBuildingChancePct || 0)))}%, `
        + `Ignore DEF +${Math.max(0, Math.round(Number(effective.defenseIgnorePct || 0)))}%, `
        + `DEF -${Math.max(0, Math.round(Number(effective.defensePenaltyPct || 0)))}%, `
        + `Police risk +${Math.max(0, Math.round(Number(effective.policeInterventionRiskPct || 0)))}%`
      );
    };

    const render = () => {
      const pharmacySnapshot = window.Empire.Map?.getPharmacyBoostSnapshot?.();
      const factorySnapshot = window.Empire.Map?.getFactoryBoostSnapshot?.();
      if (!pharmacySnapshot && !factorySnapshot) {
        content.innerHTML = '<div class="boost-modal__empty">Boost panel není dostupný.</div>';
        if (status) status.textContent = "";
        return;
      }

      const ghostSerum = Math.max(0, Math.floor(Number(pharmacySnapshot?.drugInventory?.ghostSerum || 0)));
      const overdriveX = Math.max(0, Math.floor(Number(pharmacySnapshot?.drugInventory?.overdriveX || 0)));
      const combatModule = Math.max(0, Math.floor(Number(factorySnapshot?.supplies?.combatModule || 0)));
      const pharmacyButtons = pharmacyBoostDefinitions
        .map((entry) => {
          const availableAmount = Math.max(0, Math.floor(Number(
            entry.resourceKey === "overdriveX" ? overdriveX : ghostSerum
          )));
          const canAfford = availableAmount >= entry.cost;
          return `
            <button
              class="${entry.className}"
              type="button"
              data-boost-building="pharmacy"
              data-boost-action="${entry.key}"
              title="${entry.description}"
              ${canAfford ? "" : "disabled"}
            >
              ${entry.label}
            </button>
          `;
        })
        .join("");
      const factoryButtons = factoryBoostDefinitions
        .map((entry) => {
          const canAfford = combatModule >= entry.cost;
          return `
            <button
              class="${entry.className}"
              type="button"
              data-boost-building="factory"
              data-boost-action="${entry.key}"
              title="${entry.description}"
              ${canAfford ? "" : "disabled"}
            >
              ${entry.label}
            </button>
          `;
        })
        .join("");

      const pharmacyCard = pharmacySnapshot
        ? `
          <section class="boost-modal__building">
            <div class="boost-modal__head">
              <div class="boost-modal__name">Drug lab</div>
              <div class="boost-modal__value">Boost drogy: <strong>Ghost Serum ${ghostSerum} ks • Overdrive X ${overdriveX} ks</strong></div>
            </div>
            <div class="boost-modal__actions">
              ${pharmacyButtons}
            </div>
          </section>
        `
        : '<div class="boost-modal__empty">Lékárna boosty nejsou dostupné.</div>';
      const factoryCard = factorySnapshot
        ? `
          <section class="boost-modal__building">
            <div class="boost-modal__head">
              <div class="boost-modal__name">Továrna</div>
              <div class="boost-modal__value">Combat Module: <strong>${combatModule} ks</strong></div>
            </div>
            <div class="boost-modal__actions">
              ${factoryButtons}
            </div>
          </section>
        `
        : '<div class="boost-modal__empty">Továrna boosty nejsou dostupné.</div>';

      content.innerHTML = `${pharmacyCard}${factoryCard}`;

      if (status) {
        const lines = [];
        if (pharmacySnapshot) lines.push(renderPharmacyStatus(pharmacySnapshot, ghostSerum, overdriveX));
        if (factorySnapshot) lines.push(renderFactoryStatus(factorySnapshot, combatModule));
        status.textContent = lines.join(" | ");
      }
    };

    const close = () => {
      root.classList.add("hidden");
      setTab("actions");
      resetSwipeState();
    };
    const open = () => {
      render();
      setTab("actions");
      root.classList.remove("hidden");
    };

    openBtn.addEventListener("click", open);
    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setTab(button.dataset.boostTab || "actions");
      });
    });
    if (modalBody) {
      modalBody.addEventListener("touchstart", (event) => {
        if (root.classList.contains("hidden")) return;
        if (!isMobileSwipeViewport()) return;
        if (!event.touches || event.touches.length !== 1) {
          resetSwipeState();
          return;
        }
        const touch = event.touches[0];
        swipeState = {
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
          startedAt: Date.now()
        };
      }, { passive: true });
      modalBody.addEventListener("touchmove", (event) => {
        if (!swipeState) return;
        if (!event.touches || event.touches.length !== 1) {
          resetSwipeState();
          return;
        }
        const touch = event.touches[0];
        swipeState.lastX = touch.clientX;
        swipeState.lastY = touch.clientY;
      }, { passive: true });
      modalBody.addEventListener("touchend", (event) => {
        if (!swipeState) return;
        if (event.changedTouches && event.changedTouches.length) {
          const touch = event.changedTouches[0];
          swipeState.lastX = touch.clientX;
          swipeState.lastY = touch.clientY;
        }
        finalizeSwipe();
      }, { passive: true });
      modalBody.addEventListener("touchcancel", resetSwipeState, { passive: true });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionBtn = target.closest("[data-boost-action]");
      if (!(actionBtn instanceof HTMLButtonElement)) return;
      const boostKey = String(actionBtn.dataset.boostAction || "").trim();
      const building = String(actionBtn.dataset.boostBuilding || "").trim().toLowerCase();
      if (!boostKey) return;
      let result = null;
      if (building === "factory") {
        result = window.Empire.Map?.useFactoryBoost?.(boostKey);
      } else {
        result = window.Empire.Map?.usePharmacyBoost?.(boostKey);
      }
      if (result?.message) {
        pushEvent(result.message);
      } else {
        pushEvent("Boost akce se nepodařila.");
      }
      render();
    });
  }

  function formatAttackError(errorCode) {
    switch (String(errorCode || "").trim().toLowerCase()) {
      case "cooldown":
        return "Útok je na cooldownu.";
      case "insufficient_funds":
        return "Na útok nemáš dostatek prostředků.";
      case "insufficient_weapons":
        return "Nemáš žádné zbraně, které by šlo použít.";
      case "insufficient_members":
        return "Nemáš dost členů gangu pro odemčení použitelné zbraně.";
      case "not_found":
        return "Cílový distrikt nebyl nalezen.";
      case "own_district":
        return "Vlastní distrikt nelze napadnout.";
      case "allied_district":
        return "Alianční distrikt nelze napadnout.";
      case "destroyed_district":
        return "Distrikt je zničený a nelze na něj útočit.";
      case "not_adjacent":
        return "Útočit můžeš jen na distrikt, který sousedí s tvým dobytým distriktem.";
      case "attack_failed":
        return "Útok se nepodařilo zpracovat.";
      default:
        return "Útok se nepodařilo provést.";
    }
  }

  function formatRaidError(errorCode) {
    switch (String(errorCode || "").trim().toLowerCase()) {
      case "cooldown":
        return "Krádež je na cooldownu.";
      case "district_locked":
        return "Tento distrikt je po krádeži dočasně zamčený.";
      case "not_adjacent":
        return "Vykrást můžeš jen sousední distrikt podle pravidel území.";
      case "own_district":
        return "Vlastní distrikt nelze vykrást.";
      case "allied_district":
        return "Alianční distrikt nelze vykrást.";
      case "destroyed_district":
        return "Distrikt je zničený a nepoužitelný.";
      case "raid_failed":
        return "Krádež se nepodařilo zpracovat.";
      default:
        return "Krádež se nepodařilo provést.";
    }
  }

  function initLeaderboardModal() {
    const openBtn = document.getElementById("leaderboard-open");
    const root = document.getElementById("leaderboard-modal");
    const backdrop = document.getElementById("leaderboard-modal-backdrop");
    const closeBtn = document.getElementById("leaderboard-modal-close");
    const content = document.getElementById("leaderboard-modal-content");
    if (!openBtn || !root || !content) return;

    const avatarPool = [
      "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
      "../img/avatars/Mafia/8d2dcbe6-00d3-4b6f-98a0-53dc914346c5.jpg",
      "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
      "../img/avatars/Kartel/37b9a32a-4710-4060-a1a9-5cf2e2c924c7.jpg",
      "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
      "../img/avatars/Hacker/53867e7d-cc7e-4f92-b391-88f44bf7e349.jpg",
      "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg",
      "../img/avatars/Korporat/2ef61d31-c01c-44a3-bca5-6171166352b0.jpg",
      "../img/avatars/Motogang/grok_image_1773621173474.jpg",
      "../img/avatars/Motogang/grok_image_1773621230721.jpg",
      "../img/avatars/polucnigang/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
      "../img/avatars/polucnigang/f9b2211e-30fb-46ab-aa4c-16913d8a92c6.jpg",
      "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
      "../img/avatars/SoukromaArmada/bbe6342a-cf92-4459-af42-dbb7beba19f6.jpg",
      "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
      "../img/avatars/Tajnaorganizace/0870f362-b2ce-4607-ad3f-a96b59afcc8d.jpg",
      "../img/avatars/Mafia/grok_image_1773619750005.jpg",
      "../img/avatars/Kartel/f7281b4a-f79f-4d76-b975-5153d414208f.jpg",
      "../img/avatars/Hacker/grok_image_1773621797044.jpg",
      "../img/avatars/Korporat/e4286e80-0587-4e0e-afe4-70c348ee59dd.jpg"
    ];

    const nickPool = [
      "RazorVlk", "GhostMara", "NyxPrime", "IronShade", "VortexAce",
      "BlackComet", "NeonRiot", "CobraUnit", "UrbanHex", "SteelDrift",
      "ZeroPulse", "NightCipher", "CrimsonDot", "VoltRaven", "SilentBrick",
      "AlphaDock", "ChromeLynx", "DeltaWolf", "ShadowMint", "MetroHawk",
      "ApexNova", "ToxicRay", "RetroKane", "FrostMamba", "StreetRune",
      "KiloGhost", "RustQueen", "NovaPilot", "BetaVenom", "PixelVandal",
      "OnyxRoad", "DarkMirage", "TurboSable", "ViperCrown", "CoreHunter",
      "PlasmaRook", "RiftRunner", "FlintByte", "HydraLoop", "CipherFox"
    ];

    const alliancePool = [
      "Neon Syndicate",
      "Iron Wolves",
      "Black Harbor",
      "Vortex Pact",
      "Street Dominion",
      "Shadow Cartel",
      "Chrome Circuit",
      "Night Crown",
      "Obsidian Order",
      "Steel Mirage",
      "Urban Serpents",
      "Ghost Collective"
    ];

    const currentServerEntries = Array.from({ length: 20 }, (_, index) => ({
      rank: index + 1,
      nick: nickPool[index],
      influenceRate: 980 - index * 28 + (index % 3) * 9,
      capturedSectors: 48 - index * 2 + (index % 4),
      alliance: alliancePool[index % alliancePool.length],
      avatar: avatarPool[index % avatarPool.length]
    }));

    window.Empire = window.Empire || {};
    window.Empire.leaderboardServerPlayers = currentServerEntries.map((entry) => ({
      id: `leaderboard-${entry.rank}-${entry.nick}`,
      name: entry.nick,
      nick: entry.nick,
      avatar: entry.avatar,
      totalHeat: Math.max(0, Math.floor(Number(entry.influenceRate || 0) / 4)),
      heat: Math.max(0, Math.floor(Number(entry.influenceRate || 0) / 4)),
      influence: Math.max(0, Math.floor(Number(entry.influenceRate || 0))),
      ownedDistrictCount: Math.max(0, Math.floor(Number(entry.capturedSectors || 0) / 4)),
      districtCount: Math.max(0, Math.floor(Number(entry.capturedSectors || 0) / 4)),
      cash: Math.max(0, Math.floor(Number(entry.influenceRate || 0) * 120)),
      dirtyCash: Math.max(0, Math.floor(Number(entry.influenceRate || 0) * 70)),
      lastIllegalActionAt: Date.now() - Math.max(1, entry.rank) * 20 * 60 * 1000,
      policePressure: Math.max(0, Math.floor(Number(entry.influenceRate || 0) / 12))
    }));

    const monthlyEntries = Array.from({ length: 40 }, (_, index) => ({
      rank: index + 1,
      nick: nickPool[index],
      score: 18750 - index * 245 + (index % 4) * 19,
      capturedSectors: 62 - index + (index % 5)
    }));

    const state = {
      tab: "server"
    };

    const renderServerEntries = () =>
      currentServerEntries
        .map(
          (entry) => `
            <div class="leaderboard-entry leaderboard-entry--server">
              <div class="leaderboard-rank">#${entry.rank}</div>
              <img class="leaderboard-avatar" src="${entry.avatar}" alt="Avatar ${entry.nick}" loading="lazy" />
              <div class="leaderboard-main">
                <div class="leaderboard-nick">${entry.nick}</div>
                <div class="leaderboard-sub">Aliance: ${entry.alliance}</div>
              </div>
              <div class="leaderboard-values">
                <div class="leaderboard-value">
                  <span>Míra vlivu</span>
                  <strong>${entry.influenceRate}</strong>
                </div>
                <div class="leaderboard-value leaderboard-value--sector">
                  <span>Dobyté sektory</span>
                  <strong>${entry.capturedSectors}</strong>
                </div>
              </div>
            </div>
          `
        )
        .join("");

    const renderMonthlyEntries = () =>
      monthlyEntries
        .map(
          (entry) => `
            <div class="leaderboard-entry leaderboard-entry--monthly">
              <div class="leaderboard-rank">#${entry.rank}</div>
              <div class="leaderboard-main">
                <div class="leaderboard-nick">${entry.nick}</div>
                <div class="leaderboard-sub">Měsíční výkon</div>
              </div>
              <div class="leaderboard-values">
                <div class="leaderboard-value">
                  <span>Body</span>
                  <strong>${entry.score}</strong>
                </div>
                <div class="leaderboard-value leaderboard-value--sector">
                  <span>Dobyté sektory</span>
                  <strong>${entry.capturedSectors}</strong>
                </div>
              </div>
            </div>
          `
        )
        .join("");

    const render = () => {
      const isServer = state.tab === "server";
      const podiumEntries = (isServer ? currentServerEntries : monthlyEntries)
        .slice(0, 3)
        .sort((a, b) => {
          const aValue = isServer ? Number(a.influenceRate || 0) : Number(a.score || 0);
          const bValue = isServer ? Number(b.influenceRate || 0) : Number(b.score || 0);
          return bValue - aValue;
        });
      content.innerHTML = `
        <div class="leaderboard-tabs">
          <button class="leaderboard-tab ${isServer ? "is-active" : ""}" type="button" data-leaderboard-tab="server">
            Aktuální server
          </button>
          <button class="leaderboard-tab ${!isServer ? "is-active" : ""}" type="button" data-leaderboard-tab="monthly">
            Měsíční
          </button>
        </div>
        <div class="leaderboard-board">
          <div class="leaderboard-hero">
            <div class="leaderboard-hero__eyebrow">Top 3</div>
            <div class="leaderboard-hero__title">${isServer ? "Dominance serveru" : "Měsíční podium"}</div>
            <div class="leaderboard-podium">
              ${podiumEntries
                .map((entry, index) => {
                  const place = index + 1;
                  const metricValue = isServer ? entry.influenceRate : entry.score;
                  return `
                    <div class="leaderboard-podium__entry leaderboard-podium__entry--place-${place}">
                      <div class="leaderboard-podium__place">#${place}</div>
                      <img class="leaderboard-podium__avatar" src="${entry.avatar || podiumEntries[0]?.avatar || ""}" alt="Avatar ${entry.nick}" loading="lazy" />
                      <div class="leaderboard-podium__nick">${entry.nick}</div>
                      <div class="leaderboard-podium__metric">${metricValue}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
          <div class="leaderboard-board__meta">
            ${isServer
              ? "Top 20 hráčů na aktuálním serveru."
              : "Top 40 hráčů v měsíční statistice."}
          </div>
          <div class="leaderboard-list">
            ${isServer ? renderServerEntries() : renderMonthlyEntries()}
          </div>
        </div>
      `;
    };

    content.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tabButton = target.closest("[data-leaderboard-tab]");
      if (!(tabButton instanceof HTMLElement)) return;
      const tab = tabButton.dataset.leaderboardTab;
      if (tab !== "server" && tab !== "monthly") return;
      if (state.tab === tab) return;
      state.tab = tab;
      render();
    });

    const close = () => root.classList.add("hidden");
    const open = () => {
      state.tab = "server";
      render();
      root.classList.remove("hidden");
    };

    openBtn.addEventListener("click", open);
    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function initStorageModal() {
    const trigger = document.getElementById("stat-storage-wrap");
    const root = document.getElementById("storage-modal");
    const backdrop = document.getElementById("storage-modal-backdrop");
    const closeBtn = document.getElementById("storage-modal-close");
    if (!trigger || !root) return;
    const mobileMedia = window.matchMedia("(max-width: 720px)");

    const setStorageScrollLock = (locked) => {
      const body = document.body;
      const html = document.documentElement;
      if (!body || !html) return;

      if (!mobileMedia.matches) {
        body.classList.remove("mobile-storage-modal-open");
        html.classList.remove("mobile-storage-modal-open");
        delete body.dataset.storageScrollLockY;
        return;
      }

      if (locked) {
        if (body.classList.contains("mobile-storage-modal-open")) return;
        body.classList.add("mobile-storage-modal-open");
        html.classList.add("mobile-storage-modal-open");
        return;
      }

      body.classList.remove("mobile-storage-modal-open");
      html.classList.remove("mobile-storage-modal-open");
      delete body.dataset.storageScrollLockY;
    };

    const close = () => {
      root.classList.add("hidden");
      setStorageScrollLock(false);
    };
    const open = () => {
      hydrateStorageModalValues();
      root.classList.remove("hidden");
      setStorageScrollLock(true);
    };

    trigger.addEventListener("click", open);
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    root.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-use-drug]");
      if (!(button instanceof HTMLButtonElement)) return;
      const drugKey = String(button.dataset.useDrug || "").trim();
      if (!drugKey) return;
      if (!window.Empire.token) {
        pushEvent("Použití drog je dostupné jen po přihlášení.");
        return;
      }
      button.disabled = true;
      try {
        const result = await window.Empire.API.useDrug(drugKey, 1);
        if (result?.error) {
          pushEvent(`Drogy: ${result.error}`);
          return;
        }
        const economy = await window.Empire.API.getEconomy();
        updateEconomy(economy);
        const profile = await window.Empire.API.getProfile();
        updateProfile(profile);
        pushEvent(`Aktivováno: ${storageDrugTypes.find((item) => item.resourceKey === drugKey)?.name || drugKey}`);
      } finally {
        button.disabled = false;
      }
    });
  }

  function initMoneyStatSkipControls() {
    const cleanWrap = document.getElementById("stat-clean-wrap");
    const dirtyWrap = document.getElementById("stat-dirty-wrap");
    const cleanMoney = document.getElementById("stat-clean-money");
    const dirtyMoney = document.getElementById("stat-dirty-money");
    if (!cleanWrap && !dirtyWrap && !cleanMoney && !dirtyMoney) return;

    const skipToLatest = (kind) => {
      const money = resolveMoneyBreakdown(cachedEconomy || {});
      if (kind === "clean") {
        syncMoneyStatToCachedValue(cleanMoney || cleanWrap, money.cleanMoney);
        return;
      }
      syncMoneyStatToCachedValue(dirtyMoney || dirtyWrap, money.dirtyMoney);
    };

    const bind = (element, kind) => {
      if (!element || element.dataset.moneySkipBound === "1") return;
      element.dataset.moneySkipBound = "1";
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        skipToLatest(kind);
      });
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        skipToLatest(kind);
      });
      if (!element.hasAttribute("role")) element.setAttribute("role", "button");
      if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
    };

    bind(cleanWrap, "clean");
    bind(cleanMoney, "clean");
    bind(dirtyWrap, "dirty");
    bind(dirtyMoney, "dirty");
  }

  function hydrateStorageModalValues() {
    const economy = cachedEconomy || {};
    const player = window.Empire.player || {};
    const currentGangMembers = countPlayerControlledPopulation(cachedProfile || player);
    const pharmacySnapshot = window.Empire.Map?.getPharmacyBoostSnapshot?.() || null;
    const factorySnapshot = window.Empire.Map?.getFactoryBoostSnapshot?.() || null;
    const attackCounts = resolveWeaponCounts();
    const defenseCounts = resolveDefenseCounts();
    const pharmacySupplies = pharmacySnapshot?.supplies || player.labSupplies || {};
    const factorySupplies = factorySnapshot?.supplies || {};
    const attackEntries = attackWeaponStats.map((item) => ({
      name: item.name,
      value: findInventoryValueByName(attackCounts, item.name),
      metaLabel: `Síla ${item.power}`,
      unlocked: currentGangMembers >= item.requiredMembers
    }));
    const defenseEntries = defenseWeaponStats.map((item) => ({
      name: item.name,
      value: findInventoryValueByName(defenseCounts, item.name),
      metaLabel: `Síla ${item.power}`,
      unlocked: currentGangMembers >= item.requiredMembers
    }));
    const pharmacyEntries = pharmacySupplyTypes.map((item) => ({
      name: item.name,
      value: Math.max(0, Math.floor(Number(pharmacySupplies[item.key] || 0))),
      tone: item.key === "chemicals"
        ? "chemicals"
        : (item.key === "biomass" ? "biomass" : (item.key === "stimPack" ? "stim" : ""))
    }));
    const factoryEntries = factorySupplyTypes.map((item) => {
      const rawValue = Math.max(0, Math.floor(Number(factorySupplies[item.key] || 0)));
      const value = window.Empire.token ? rawValue : Math.max(20, rawValue);
      return {
        name: item.name,
        value
      };
    });
    const totalDrugs = Number(economy.drugs ?? player.drugs ?? 0);
    const drugInventory = economy.drugInventory || player.drugInventory || null;
    const activeDrugs = economy.activeDrugs || player.activeDrugs || null;
    const drugEntries = resolveStorageDrugEntries(totalDrugs, drugInventory, activeDrugs);
    const attackTotal = getAttackWeaponTotal(attackCounts);
    const defenseTotal = getDefenseWeaponTotal(defenseCounts);
    const pharmacyTotal = pharmacyEntries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.value || 0))), 0);
    const factoryTotal = factoryEntries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.value || 0))), 0);
    const drugTotal = drugEntries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.value || 0))), 0);
    const storageTotal = attackTotal + defenseTotal + pharmacyTotal + factoryTotal + drugTotal;

    renderStorageList("storage-modal-attack-list", attackEntries, "ks");
    renderStorageList("storage-modal-defense-list", defenseEntries, "ks");
    renderStorageList("storage-modal-pharmacy-list", pharmacyEntries, "ks");
    renderStorageList("storage-modal-factory-list", factoryEntries, "ks");
    renderStorageList("storage-modal-drugs-list", drugEntries, "bal.", { allowDrugUse: true });
    pulseStorageStat(storageTotal);
  }

  function pulseStorageStat(nextTotal) {
    const wrap = document.getElementById("stat-storage-wrap");
    const safeTotal = Math.max(0, Math.floor(Number(nextTotal || 0)));
    if (!wrap) {
      lastRenderedStorageTotal = safeTotal;
      return;
    }
    if (lastRenderedStorageTotal == null) {
      lastRenderedStorageTotal = safeTotal;
      return;
    }
    const delta = safeTotal - lastRenderedStorageTotal;
    lastRenderedStorageTotal = safeTotal;
    if (!delta) return;
    wrap.classList.remove("is-storage-up", "is-storage-down");
    void wrap.offsetWidth;
    wrap.classList.add(delta > 0 ? "is-storage-up" : "is-storage-down");
    if (storageStatPulseTimer) {
      window.clearTimeout(storageStatPulseTimer);
    }
    storageStatPulseTimer = window.setTimeout(() => {
      wrap.classList.remove("is-storage-up", "is-storage-down");
      storageStatPulseTimer = null;
    }, 1100);
  }

  function findInventoryValueByName(source, name) {
    const safeSource = source && typeof source === "object" ? source : {};
    const key = Object.keys(safeSource).find((candidate) => candidate.toLowerCase() === String(name || "").toLowerCase());
    if (!key) return 0;
    const value = Number(safeSource[key] || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function resolveStorageDrugEntries(totalDrugs, drugInventory, activeDrugs) {
    const parsedTotal = Number(totalDrugs || 0);
    const safeTotal = Number.isFinite(parsedTotal) ? Math.max(0, Math.floor(parsedTotal)) : 0;
    const safeInventory = drugInventory && typeof drugInventory === "object" ? drugInventory : {};
    const safeActive = activeDrugs && typeof activeDrugs === "object" ? activeDrugs : {};

    let used = 0;
    const entries = storageDrugTypes.map((item) => {
      const count = Math.max(0, Math.floor(Number(safeInventory[item.key] || 0)));
      used += count;
      const effect = safeActive[item.key] || {};
      const remainingSeconds = Math.max(0, Math.floor(Number(effect.remainingSeconds || 0)));
      return {
        key: item.resourceKey,
        name: item.name,
        value: count,
        active: Boolean(effect.active),
        activeLabel: remainingSeconds > 0
          ? `aktivní ${formatDurationLabel(remainingSeconds * 1000)}`
          : ""
      };
    });

    const remainder = Math.max(0, safeTotal - used);
    if (entries.length > 0 && remainder > 0) entries[0].value += remainder;
    return entries;
  }

  function renderStorageList(containerId, entries, suffix = "", options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const safeEntries = Array.isArray(entries) ? entries : [];
    const allowDrugUse = Boolean(options.allowDrugUse && window.Empire.token);
    container.innerHTML = safeEntries
      .map((entry) => {
        const valueLabel = suffix
          ? `${entry.value} ${suffix}`
          : `${entry.value}`;
        const metaParts = [entry.metaLabel, entry.requirementLabel, entry.activeLabel]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .map((value) => `<span class="storage-modal__meta">${value}</span>`)
          .join("");
        const useButton = allowDrugUse && entry.key
          ? `<button class="btn btn--ghost" data-use-drug="${entry.key}" ${entry.value <= 0 ? "disabled" : ""}>Použít</button>`
          : "";
        const toneClass = entry.tone ? ` storage-modal__item--${entry.tone}` : "";
        const toneValueClass = entry.tone ? ` storage-modal__value--${entry.tone}` : "";
        return `
          <div class="storage-modal__item ${entry.unlocked === false ? "is-locked" : ""}${toneClass}">
            <span>${entry.name} ${metaParts}</span>
            <strong class="storage-modal__value${toneValueClass}">${valueLabel}</strong>
            ${useButton}
          </div>
        `;
      })
      .join("");
  }

  function initDistrictDefenseModal() {
    const root = document.getElementById("district-defense-modal");
    const backdrop = document.getElementById("district-defense-modal-backdrop");
    const closeBtn = document.getElementById("district-defense-modal-close");
    const startBtn = document.getElementById("defense-modal-start");
    const weaponButtons = document.getElementById("defense-modal-weapons");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", closeDefenseModal);
    if (closeBtn) closeBtn.addEventListener("click", closeDefenseModal);
    if (weaponButtons) {
      const handleDefenseStepperInteraction = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const launchButton = target.closest("[data-defense-launch]");
        if (launchButton) {
          if (startBtn && !startBtn.disabled) startBtn.click();
          return;
        }
        const button = target.closest("[data-defense-weapon][data-defense-action]");
        if (!button) return;
        const now = Date.now();
        if (event.type === "click" && now - lastDefenseStepperInteractionAt < 120) {
          return;
        }
        lastDefenseStepperInteractionAt = now;
        if (event.type === "pointerdown") {
          event.preventDefault();
        }
        const name = String(button.getAttribute("data-defense-weapon") || "").trim();
        const action = String(button.getAttribute("data-defense-action") || "").trim();
        if (!name) return;
        if (action !== "increase" && action !== "decrease") return;
        const availability = getDefenseModalAvailability();
        const summary = getDefenseSelectionSummary(availability);
        const item = defenseWeaponStats.find((entry) => entry.name === name);
        if (!item) return;
        const current = Math.max(0, Math.floor(Number(summary.selection[name] || 0)));
        const maxCount = getDefenseWeaponMaxCount(item, summary, availability);
        let nextCount = current;
        if (action === "increase") {
          nextCount = current < maxCount ? current + 1 : current;
        } else if (action === "decrease") {
          nextCount = current > 0 ? current - 1 : 0;
        }
        defenseModalState.selectedWeaponCounts = {
          ...(defenseModalState.selectedWeaponCounts || {}),
          [name]: nextCount
        };
        if (nextCount <= 0) {
          delete defenseModalState.selectedWeaponCounts[name];
        }
        setDefenseModalNote("");
        renderDefenseModal();
      };
      weaponButtons.addEventListener("dblclick", (event) => {
        event.preventDefault();
      });
      weaponButtons.addEventListener("pointerdown", handleDefenseStepperInteraction);
      weaponButtons.addEventListener("click", handleDefenseStepperInteraction);
    }
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const district = resolveDistrictById(defenseModalState.districtId);
        if (!district) {
          setDefenseModalNote("Nejprve vyber distrikt.");
          return;
        }
        const availability = getDefenseModalAvailability();
        const selectionSummary = getDefenseSelectionSummary(availability);
        const previousSelection = sanitizeDefenseSelection(defenseModalState.initialAssignmentSelection || {});
        const hadPreviousDefense = Boolean(defenseModalState.hasInitialAssignment);
        const hasAnySelectedDefense = selectionSummary.totalUsedMembers > 0;
        const selectedWeapons = defenseWeaponStats
          .map((item) => {
            const count = Math.max(0, Math.floor(Number(selectionSummary.selection?.[item.name] || 0)));
            return count > 0 ? `${count}× ${item.name}` : "";
          })
          .filter(Boolean);
        const defensePower = defenseWeaponStats.reduce((sum, item) => {
          const count = Math.max(0, Math.floor(Number(selectionSummary.selection?.[item.name] || 0)));
          return sum + (count * Number(item.power || 0));
        }, 0);

        const releaseWeapons = {};
        const consumeWeapons = {};
        defenseWeaponStats.forEach((item) => {
          const prevCount = Math.max(0, Math.floor(Number(previousSelection[item.name] || 0)));
          const nextCount = Math.max(0, Math.floor(Number(selectionSummary.selection?.[item.name] || 0)));
          if (nextCount > prevCount) {
            consumeWeapons[item.name] = nextCount - prevCount;
          } else if (prevCount > nextCount) {
            releaseWeapons[item.name] = prevCount - nextCount;
          }
        });
        const previousUsedMembers = defenseWeaponStats.reduce((sum, item) => {
          const count = Math.max(0, Math.floor(Number(previousSelection[item.name] || 0)));
          return sum + count * Math.max(0, Math.floor(Number(item.requiredMembers || 0)));
        }, 0);
        const releasedMembers = Math.max(0, previousUsedMembers - selectionSummary.totalUsedMembers);
        const consumedMembers = Math.max(0, selectionSummary.totalUsedMembers - previousUsedMembers);

        if (Object.keys(releaseWeapons).length > 0) {
          addCraftedDefense(releaseWeapons);
        }
        if (releasedMembers > 0) {
          addGangMembers(releasedMembers);
        }
        if (Object.keys(consumeWeapons).length > 0) {
          consumeDefenseWeaponCounts(consumeWeapons);
        }
        if (consumedMembers > 0) {
          consumeGangMembers(consumedMembers);
        }

        saveDistrictDefenseAssignment(
          district,
          hasAnySelectedDefense ? selectionSummary.selection : {},
          hasAnySelectedDefense ? selectionSummary.totalUsedMembers : 0,
          hasAnySelectedDefense ? defensePower : 0
        );
        window.Empire.Map?.refreshSelectedDistrictModal?.();
        if (!hasAnySelectedDefense && hadPreviousDefense) {
          pushEvent(`Obrana distriktu ${district.name || `#${district.id}`} byla zrušena. Zbraně i členové se vrátili do skladu.`);
        } else {
          pushEvent(`Obrana distriktu ${district.name || `#${district.id}`} byla ${hadPreviousDefense ? "upravena" : "nastavena"}. Zbraně: ${selectedWeapons.length ? selectedWeapons.join(", ") : "žádné"}. Členové gangu: ${selectionSummary.totalUsedMembers}. Síla obrany: ${defensePower}.`);
        }
        closeDefenseModal();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDefenseModal();
    });
  }

  function openDistrictDefenseModal(district) {
    const root = document.getElementById("district-defense-modal");
    const districtLabel = document.getElementById("defense-modal-district");
    if (!root) return;
    const currentAssignment = getDistrictDefenseAssignmentForCurrentPlayer(district?.id);
    const initialSelection = currentAssignment?.selection || {};
    defenseModalState = {
      districtId: district?.id ?? null,
      message: "",
      selectedWeaponCounts: { ...initialSelection },
      initialAssignmentSelection: { ...initialSelection },
      hasInitialAssignment: Boolean(currentAssignment?.hasDefense)
    };
    if (districtLabel) {
      districtLabel.textContent = district?.name || `Distrikt #${district?.id ?? "-"}`;
    }
    root.classList.remove("hidden");
    renderDefenseModal();
    if (defenseModalRefreshTimer) clearInterval(defenseModalRefreshTimer);
    defenseModalRefreshTimer = setInterval(() => {
      const modal = document.getElementById("district-defense-modal");
      if (!modal || modal.classList.contains("hidden")) {
        closeDefenseModal();
        return;
      }
      renderDefenseModal();
    }, 250);
  }

  function setDefenseModalNote(message) {
    defenseModalState.message = String(message || "");
    const note = document.getElementById("defense-modal-note");
    if (!note) return;
    note.textContent = defenseModalState.message;
  }

  function renderDefenseModal() {
    const root = document.getElementById("district-defense-modal");
    if (!root || root.classList.contains("hidden")) return;
    const district = resolveDistrictById(defenseModalState.districtId);
    const districtLabel = document.getElementById("defense-modal-district");
    const membersCountEl = document.getElementById("defense-modal-members-count");
    const usedMembersEl = document.getElementById("defense-modal-used-members");
    const powerEl = document.getElementById("defense-modal-power");
    const weaponButtons = document.getElementById("defense-modal-weapons");
    const startBtn = document.getElementById("defense-modal-start");
    const note = document.getElementById("defense-modal-note");
    if (!districtLabel || !membersCountEl || !usedMembersEl || !powerEl || !weaponButtons || !startBtn || !note) return;

    const availability = getDefenseModalAvailability();
    const selectionSummary = getDefenseSelectionSummary(availability);
    const hasExistingDefense = Boolean(defenseModalState.hasInitialAssignment);
    if (district) {
      districtLabel.textContent = district.name || `Distrikt #${district.id}`;
    } else {
      districtLabel.textContent = "-";
    }
    membersCountEl.textContent = String(selectionSummary.remainingMembers);
    usedMembersEl.textContent = String(selectionSummary.totalUsedMembers);
    powerEl.textContent = String(defenseWeaponStats.reduce((sum, item) => {
      const count = Math.max(0, Math.floor(Number(selectionSummary.selection[item.name] || 0)));
      return sum + (count * Number(item.power || 0));
    }, 0));
    renderDefenseWeaponButtons(weaponButtons, availability);
    let noteText = defenseModalState.message || "";
    if (hasExistingDefense) {
      noteText = defenseModalState.message || "Uprava obrany je aktivní. Odebrané zbraně a členové se po uložení vrátí zpět.";
    }
    if (availability.availableWeapons <= 0) {
      noteText = "Ve skladu nejsou žádné obranné zbraně.";
    } else if (selectionSummary.remainingMembers < 0) {
      noteText = "Nemáš dost členů gangu pro tuto kombinaci.";
    }
    note.textContent = noteText;
    startBtn.textContent = hasExistingDefense ? "Upravit obranu" : "Nastavit obranu";
    startBtn.disabled = selectionSummary.totalUsedMembers <= 0 && !hasExistingDefense;
  }

  function closeDefenseModal() {
    const root = document.getElementById("district-defense-modal");
    if (root) root.classList.add("hidden");
    defenseModalState = {
      districtId: null,
      message: "",
      selectedWeaponCounts: {},
      initialAssignmentSelection: {},
      hasInitialAssignment: false
    };
    if (defenseModalRefreshTimer) {
      clearInterval(defenseModalRefreshTimer);
      defenseModalRefreshTimer = null;
    }
  }

  function readAttackTargetCooldownState() {
    try {
      const raw = localStorage.getItem(ATTACK_TARGET_COOLDOWN_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const now = Date.now();
      return Object.entries(parsed).reduce((acc, [attackerKey, targets]) => {
        const safeAttackerKey = normalizeOwnerName(attackerKey);
        if (!safeAttackerKey || !targets || typeof targets !== "object" || Array.isArray(targets)) return acc;
        const sanitizedTargets = Object.entries(targets).reduce((targetAcc, [targetKey, until]) => {
          const safeTargetKey = normalizeOwnerName(targetKey);
          const safeUntil = Number(until);
          if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= now) return targetAcc;
          targetAcc[safeTargetKey] = Math.floor(safeUntil);
          return targetAcc;
        }, {});
        if (Object.keys(sanitizedTargets).length) {
          acc[safeAttackerKey] = sanitizedTargets;
        }
        return acc;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function saveAttackTargetCooldownState(nextState) {
    const now = Date.now();
    const safeState = !nextState || typeof nextState !== "object"
      ? {}
      : Object.entries(nextState).reduce((acc, [attackerKey, targets]) => {
          const safeAttackerKey = normalizeOwnerName(attackerKey);
          if (!safeAttackerKey || !targets || typeof targets !== "object" || Array.isArray(targets)) return acc;
          const sanitizedTargets = Object.entries(targets).reduce((targetAcc, [targetKey, until]) => {
            const safeTargetKey = normalizeOwnerName(targetKey);
            const safeUntil = Number(until);
            if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= now) return targetAcc;
            targetAcc[safeTargetKey] = Math.floor(safeUntil);
            return targetAcc;
          }, {});
          if (Object.keys(sanitizedTargets).length) {
            acc[safeAttackerKey] = sanitizedTargets;
          }
          return acc;
        }, {});
    localStorage.setItem(ATTACK_TARGET_COOLDOWN_STORAGE_KEY, JSON.stringify(safeState));
    return safeState;
  }

  function getAttackTargetCooldownRemainingMs(targetOwnerKey) {
    const attackerKey = resolveCurrentPlayerOwnerKey();
    const safeTargetKey = normalizeOwnerName(targetOwnerKey);
    if (!safeTargetKey) return 0;
    const state = readAttackTargetCooldownState();
    const until = Number(state?.[attackerKey]?.[safeTargetKey] || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return 0;
    return Math.max(0, until - Date.now());
  }

  function setAttackTargetCooldownUntil(targetOwnerKey, until) {
    const attackerKey = resolveCurrentPlayerOwnerKey();
    const safeTargetKey = normalizeOwnerName(targetOwnerKey);
    const safeUntil = Number(until);
    if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= Date.now()) return 0;
    const state = readAttackTargetCooldownState();
    state[attackerKey] = state[attackerKey] && typeof state[attackerKey] === "object" ? state[attackerKey] : {};
    state[attackerKey][safeTargetKey] = Math.floor(safeUntil);
    saveAttackTargetCooldownState(state);
    return state[attackerKey][safeTargetKey];
  }

  function formatAttackCooldownLabel(ms) {
    const safe = Math.max(0, Math.floor(Number(ms) || 0));
    const seconds = Math.ceil(safe / 1000);
    return seconds > 0 ? `${seconds}s` : "Připraveno";
  }

  function getActiveAttackCooldownRemainingMs() {
    const until = Number(localStorage.getItem(ATTACK_ACTION_LOCK_STORAGE_KEY) || 0);
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(ATTACK_ACTION_LOCK_STORAGE_KEY);
      return 0;
    }
    return Math.max(0, until - Date.now());
  }

  function setActiveAttackCooldownUntil(value) {
    const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    if (safeValue <= Date.now()) {
      localStorage.removeItem(ATTACK_ACTION_LOCK_STORAGE_KEY);
      return 0;
    }
    localStorage.setItem(ATTACK_ACTION_LOCK_STORAGE_KEY, String(safeValue));
    return safeValue;
  }

  function formatAttackDurationLabel(ms) {
    const safe = Math.max(0, Math.floor(Number(ms) || 0));
    const seconds = Math.ceil(safe / 1000);
    if (seconds <= 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (remainder > 0) return `${minutes}m ${remainder}s`;
    return `${minutes}m`;
  }

  function getRaidCooldownUntil() {
    const parsed = Number(localStorage.getItem(RAID_COOLDOWN_STORAGE_KEY) || 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  }

  function setRaidCooldownUntil(value) {
    const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    localStorage.setItem(RAID_COOLDOWN_STORAGE_KEY, String(safeValue));
    return safeValue;
  }

  function getRaidCooldownRemainingMs() {
    return Math.max(0, getRaidCooldownUntil() - Date.now());
  }

  function readDistrictTrapState() {
    try {
      const raw = localStorage.getItem(DISTRICT_TRAP_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.entries(parsed).reduce((acc, [ownerKey, entry]) => {
        const safeOwnerKey = normalizeOwnerName(ownerKey);
        const safeDistrictId = Number(entry?.districtId);
        if (!safeOwnerKey || !Number.isFinite(safeDistrictId)) return acc;
        acc[safeOwnerKey] = {
          districtId: Math.max(0, Math.floor(safeDistrictId)),
          targetOwnerKey: normalizeOwnerName(entry?.targetOwnerKey),
          targetOwnerLabel: String(entry?.targetOwnerLabel || "").trim(),
          districtName: String(entry?.districtName || "").trim(),
          placedAt: Math.max(0, Math.floor(Number(entry?.placedAt || 0))),
          moveLockedUntil: Math.max(0, Math.floor(Number(entry?.moveLockedUntil || 0)))
        };
        return acc;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function saveDistrictTrapState(nextState) {
    const safeState = !nextState || typeof nextState !== "object"
      ? {}
      : Object.entries(nextState).reduce((acc, [ownerKey, entry]) => {
          const safeOwnerKey = normalizeOwnerName(ownerKey);
          const safeDistrictId = Number(entry?.districtId);
          if (!safeOwnerKey || !Number.isFinite(safeDistrictId)) return acc;
          acc[safeOwnerKey] = {
            districtId: Math.max(0, Math.floor(safeDistrictId)),
            targetOwnerKey: normalizeOwnerName(entry?.targetOwnerKey),
            targetOwnerLabel: String(entry?.targetOwnerLabel || "").trim(),
            districtName: String(entry?.districtName || "").trim(),
            placedAt: Math.max(0, Math.floor(Number(entry?.placedAt || 0))),
            moveLockedUntil: Math.max(0, Math.floor(Number(entry?.moveLockedUntil || 0)))
          };
          return acc;
        }, {});
    localStorage.setItem(DISTRICT_TRAP_STORAGE_KEY, JSON.stringify(safeState));
    return safeState;
  }

  function getCurrentPlayerTrapPlacement() {
    const ownerKey = resolveCurrentPlayerOwnerKey();
    const state = readDistrictTrapState();
    const entry = state[ownerKey];
    return entry ? { ownerKey, ...entry } : null;
  }

  function getDistrictTrapEntry(districtId) {
    const safeDistrictId = Number(districtId);
    if (!Number.isFinite(safeDistrictId)) return null;
    const state = readDistrictTrapState();
    for (const [ownerKey, entry] of Object.entries(state)) {
      if (Number(entry?.districtId) === safeDistrictId) {
        return { ownerKey, ...entry };
      }
    }
    return null;
  }

  function getTrapMoveCooldownRemainingMs(entry) {
    return Math.max(0, Number(entry?.moveLockedUntil || 0) - Date.now());
  }

  function getAllianceTrapGraceRemainingMs(district) {
    if (!district || isDistrictOwnedByPlayer(district) || !isDistrictOwnedByAlliance(district)) return 0;
    const ownerKey = normalizeOwnerName(district?.owner);
    if (!ownerKey) return 0;
    return Math.max(0, Number(liveAllianceTrapGraceByOwnerName.get(ownerKey) || 0) - Date.now());
  }

  function formatTrapMoveCooldownLabel(ms) {
    const safe = Math.max(0, Math.ceil(Number(ms) || 0));
    const totalSeconds = Math.max(0, Math.ceil(safe / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function setCurrentPlayerTrapDistrict(district) {
    const safeDistrictId = Number(district?.id);
    if (!Number.isFinite(safeDistrictId)) {
      return { ok: false, reason: "invalid_district" };
    }
    const ownerKey = resolveCurrentPlayerOwnerKey();
    const state = readDistrictTrapState();
    const previous = state[ownerKey] || null;
    const moveCooldownRemainingMs = getTrapMoveCooldownRemainingMs(previous);
    if (previous && Number(previous.districtId) !== safeDistrictId && moveCooldownRemainingMs > 0 && !isOnboardingDemoScenarioActive()) {
      return {
        ok: false,
        reason: "move_locked",
        moveCooldownRemainingMs
      };
    }
    state[ownerKey] = {
      districtId: Math.max(0, Math.floor(safeDistrictId)),
      targetOwnerKey: normalizeOwnerName(district?.owner),
      targetOwnerLabel: String(district?.ownerNick || district?.owner || "").trim(),
      districtName: String(district?.name || `Distrikt #${safeDistrictId}`).trim(),
      placedAt: Date.now(),
      moveLockedUntil: Date.now() + TRAP_MOVE_COOLDOWN_MS
    };
    saveDistrictTrapState(state);
    return {
      ok: true,
      moved: Boolean(previous && Number(previous.districtId) !== safeDistrictId),
      previousDistrictId: previous?.districtId ?? null,
      isActiveHere: Number(previous?.districtId) === safeDistrictId,
      moveLockedUntil: Number(state[ownerKey]?.moveLockedUntil || 0)
    };
  }

  function consumeDistrictTrap(districtId) {
    const safeDistrictId = Number(districtId);
    if (!Number.isFinite(safeDistrictId)) return null;
    const state = readDistrictTrapState();
    const foundEntry = Object.entries(state).find(([, entry]) => Number(entry?.districtId) === safeDistrictId);
    if (!foundEntry) return null;
    const [ownerKey, entry] = foundEntry;
    delete state[ownerKey];
    saveDistrictTrapState(state);
    return { ownerKey, ...entry };
  }

  function getDistrictTrapControlState(district) {
    if (!district || !isDistrictDefendableByPlayer(district) || isDistrictDestroyed(district)) {
      return {
        visible: false,
        label: "Past",
        title: "",
        isActiveHere: false,
        hasTrapElsewhere: false,
        moveLocked: false,
        moveCooldownRemainingMs: 0,
        countdownLabel: "",
        buildingVisible: false,
        buttonDisabled: true
      };
    }
    const currentPlacement = getCurrentPlayerTrapPlacement();
    const isActiveHere = Number(currentPlacement?.districtId) === Number(district?.id);
    const hasTrapElsewhere = Boolean(currentPlacement && !isActiveHere);
    const moveCooldownRemainingMs = getTrapMoveCooldownRemainingMs(currentPlacement);
    const allianceTrapGraceRemainingMs = getAllianceTrapGraceRemainingMs(district);
    const moveLocked = moveCooldownRemainingMs > 0;
    const countdownLabel = moveLocked ? formatTrapMoveCooldownLabel(moveCooldownRemainingMs) : "";
    const allianceGraceLocked = allianceTrapGraceRemainingMs > 0;
    const allianceGraceLabel = allianceGraceLocked ? formatTrapMoveCooldownLabel(allianceTrapGraceRemainingMs) : "";
    const sourceDistrictLabel = currentPlacement?.districtName || `distriktu #${currentPlacement?.districtId ?? "-"}`;
    const title = isActiveHere
      ? (moveLocked
          ? `Past je aktivní v tomto districtu. Přesun bude možný za ${countdownLabel}.`
          : "V tomto districtu je nastražená tvoje past.")
      : allianceGraceLocked
        ? `Past do nově přidaného aliančního districtu půjde vložit za ${allianceGraceLabel}.`
      : hasTrapElsewhere
        ? (moveLocked
            ? `Past je dočasně zamčená v ${sourceDistrictLabel}. Přesun bude možný za ${countdownLabel}.`
            : `Máš jen 1 past. Kliknutím ji přesuneš z ${sourceDistrictLabel}.`)
        : "Nastraž 1 past do svého nebo aliančního districtu.";
    return {
      visible: true,
      isActiveHere,
      hasTrapElsewhere,
      moveLocked,
      moveCooldownRemainingMs,
      countdownLabel,
      buttonDisabled: isActiveHere || moveLocked || allianceGraceLocked,
      label: isActiveHere ? "Past aktivní" : (hasTrapElsewhere ? "Přesunout past" : "Past"),
      subtitle: moveLocked ? countdownLabel : (allianceGraceLocked ? allianceGraceLabel : ""),
      title,
      buildingVisible: isActiveHere,
      buildingLabel: "Past",
      buildingMeta: "Aktivní"
    };
  }

  function readAttackTargetLockState() {
    try {
      const raw = localStorage.getItem(ATTACK_TARGET_LOCK_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const now = Date.now();
      return Object.entries(parsed).reduce((acc, [attackerKey, targets]) => {
        const safeAttackerKey = normalizeOwnerName(attackerKey);
        if (!safeAttackerKey || !targets || typeof targets !== "object" || Array.isArray(targets)) return acc;
        const sanitizedTargets = Object.entries(targets).reduce((targetAcc, [targetKey, until]) => {
          const safeTargetKey = normalizeOwnerName(targetKey);
          const safeUntil = Number(until);
          if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= now) return targetAcc;
          targetAcc[safeTargetKey] = Math.floor(safeUntil);
          return targetAcc;
        }, {});
        if (Object.keys(sanitizedTargets).length) {
          acc[safeAttackerKey] = sanitizedTargets;
        }
        return acc;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function saveAttackTargetLockState(nextState) {
    const now = Date.now();
    const safeState = !nextState || typeof nextState !== "object"
      ? {}
      : Object.entries(nextState).reduce((acc, [attackerKey, targets]) => {
          const safeAttackerKey = normalizeOwnerName(attackerKey);
          if (!safeAttackerKey || !targets || typeof targets !== "object" || Array.isArray(targets)) return acc;
          const sanitizedTargets = Object.entries(targets).reduce((targetAcc, [targetKey, until]) => {
            const safeTargetKey = normalizeOwnerName(targetKey);
            const safeUntil = Number(until);
            if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= now) return targetAcc;
            targetAcc[safeTargetKey] = Math.floor(safeUntil);
            return targetAcc;
          }, {});
          if (Object.keys(sanitizedTargets).length) {
            acc[safeAttackerKey] = sanitizedTargets;
          }
          return acc;
        }, {});
    localStorage.setItem(ATTACK_TARGET_LOCK_STORAGE_KEY, JSON.stringify(safeState));
    return safeState;
  }

  function getAttackTargetLockRemainingMs(targetOwnerKey) {
    const attackerKey = resolveCurrentPlayerOwnerKey();
    const safeTargetKey = normalizeOwnerName(targetOwnerKey);
    if (!safeTargetKey) return 0;
    const state = readAttackTargetLockState();
    const until = Number(state?.[attackerKey]?.[safeTargetKey] || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return 0;
    return Math.max(0, until - Date.now());
  }

  function setAttackTargetLockUntil(targetOwnerKey, until) {
    const attackerKey = resolveCurrentPlayerOwnerKey();
    const safeTargetKey = normalizeOwnerName(targetOwnerKey);
    const safeUntil = Number(until);
    if (!safeTargetKey || !Number.isFinite(safeUntil) || safeUntil <= Date.now()) return 0;
    const state = readAttackTargetLockState();
    state[attackerKey] = state[attackerKey] && typeof state[attackerKey] === "object" ? state[attackerKey] : {};
    state[attackerKey][safeTargetKey] = Math.floor(safeUntil);
    saveAttackTargetLockState(state);
    return state[attackerKey][safeTargetKey];
  }

  function readDistrictRaidLockState() {
    try {
      const raw = localStorage.getItem(DISTRICT_RAID_LOCK_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const now = Date.now();
      return Object.entries(parsed).reduce((acc, [districtId, until]) => {
        const safeDistrictId = Number(districtId);
        const safeUntil = Number(until);
        if (!Number.isFinite(safeDistrictId) || !Number.isFinite(safeUntil) || safeUntil <= now) return acc;
        acc[String(safeDistrictId)] = Math.floor(safeUntil);
        return acc;
      }, {});
    } catch (_) {
      return {};
    }
  }

  function saveDistrictRaidLockState(nextState) {
    const safeState = !nextState || typeof nextState !== "object"
      ? {}
      : Object.entries(nextState).reduce((acc, [districtId, until]) => {
          const safeDistrictId = Number(districtId);
          const safeUntil = Number(until);
          if (!Number.isFinite(safeDistrictId) || !Number.isFinite(safeUntil) || safeUntil <= Date.now()) return acc;
          acc[String(safeDistrictId)] = Math.floor(safeUntil);
          return acc;
        }, {});
    localStorage.setItem(DISTRICT_RAID_LOCK_STORAGE_KEY, JSON.stringify(safeState));
    return safeState;
  }

  function setDistrictRaidLockUntil(districtId, until) {
    const safeDistrictId = Number(districtId);
    if (!Number.isFinite(safeDistrictId)) return 0;
    const safeUntil = Number(until);
    const currentState = readDistrictRaidLockState();
    if (!Number.isFinite(safeUntil) || safeUntil <= Date.now()) {
      delete currentState[String(safeDistrictId)];
      saveDistrictRaidLockState(currentState);
      return 0;
    }
    currentState[String(safeDistrictId)] = Math.floor(safeUntil);
    saveDistrictRaidLockState(currentState);
    return currentState[String(safeDistrictId)];
  }

  function getDistrictRaidLockRemainingMs(districtId) {
    const safeDistrictId = Number(districtId);
    if (!Number.isFinite(safeDistrictId)) return 0;
    const currentState = readDistrictRaidLockState();
    const until = Number(currentState[String(safeDistrictId)] || 0);
    if (!Number.isFinite(until) || until <= Date.now()) {
      if (currentState[String(safeDistrictId)]) {
        delete currentState[String(safeDistrictId)];
        saveDistrictRaidLockState(currentState);
      }
      return 0;
    }
    return Math.max(0, until - Date.now());
  }

  function isRaidActionRunning() {
    return Number(raidActionState.endsAt || 0) > Date.now();
  }

  function resolveRaidDurationWithBoosts() {
    if (isOnboardingDemoScenarioActive()) {
      return ONBOARDING_ACTION_DURATION_MS;
    }
    const pharmacySnapshot = window.Empire.Map?.getPharmacyBoostSnapshot?.();
    const factorySnapshot = window.Empire.Map?.getFactoryBoostSnapshot?.();
    const stealSpeedPct = Math.max(0, Number(pharmacySnapshot?.effective?.stealSpeedPct || 0));
    const raidSpeedPct = Math.max(0, Number(factorySnapshot?.effective?.raidSpeedPct || 0));
    const totalSpeedPct = stealSpeedPct + raidSpeedPct;
    const multiplier = Math.max(0.2, 1 - totalSpeedPct / 100);
    return Math.max(5000, Math.round(RAID_ACTION_DURATION_MS * multiplier));
  }

  function formatRaidCooldownLabel(ms) {
    return formatAttackCooldownLabel(ms);
  }

  function getAttackModalAvailability(district = null) {
    const counts = resolveWeaponCounts();
    const availableWeapons = getAttackWeaponTotal(counts);
    const actualMembers = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(cachedProfile || window.Empire.player || {})) || 0));
    const weaponAccess = resolveCombatWeaponAccess("attack", actualMembers);
    const cooldownTargetOwner = normalizeOwnerName(district?.owner);
    const targetCooldownMs = getAttackTargetCooldownRemainingMs(cooldownTargetOwner);
    const activeAttackCooldownMs = getActiveAttackCooldownRemainingMs();
    return {
      availableWeapons,
      actualMembers,
      weaponCounts: counts,
      weaponAccess,
      unlockedWeapon: weaponAccess.weapon || null,
      cooldownMs: Math.max(targetCooldownMs, activeAttackCooldownMs)
    };
  }

  function getAttackSelectionSummary(availability, selectionCounts = attackModalState.selectedWeaponCounts || {}) {
    const actualMembers = Math.max(0, Math.floor(Number(availability?.actualMembers || 0)));
    const weaponCounts = availability?.weaponCounts || resolveWeaponCounts();
    const selection = attackWeaponStats.reduce((acc, item) => {
      const count = Math.max(0, Math.floor(Number(selectionCounts?.[item.name] || 0)));
      acc[item.name] = count;
      return acc;
    }, {});
    const totalUsedMembers = attackWeaponStats.reduce((sum, item) => {
      const count = Number(selection[item.name] || 0);
      return sum + (Number.isFinite(count) ? count * Number(item.requiredMembers || 0) : 0);
    }, 0);
    const remainingMembers = Math.max(0, actualMembers - totalUsedMembers);
    const remainingWeaponCounts = attackWeaponStats.reduce((acc, item) => {
      const stock = Math.max(0, Math.floor(Number(weaponCounts[item.name] || 0)));
      const selected = Math.max(0, Math.floor(Number(selection[item.name] || 0)));
      acc[item.name] = Math.max(0, stock - selected);
      return acc;
    }, {});
    return {
      actualMembers,
      remainingMembers,
      totalUsedMembers,
      weaponCounts,
      remainingWeaponCounts,
      selection
    };
  }

  function getAttackWeaponMaxCount(item, summary, availability) {
    const stock = Math.max(0, Math.floor(Number(summary?.weaponCounts?.[item.name] ?? availability?.weaponCounts?.[item.name] ?? 0)));
    const current = Math.max(0, Math.floor(Number(summary?.selection?.[item.name] || 0)));
    const otherUsedMembers = Math.max(0, Number(summary?.totalUsedMembers || 0) - current * Number(item.requiredMembers || 0));
    const remainingForThisWeapon = Math.max(0, Number(summary?.actualMembers || 0) - otherUsedMembers);
    const byMembers = Math.floor(remainingForThisWeapon / Math.max(1, Number(item.requiredMembers || 0)));
    return Math.max(0, Math.min(stock, byMembers));
  }

  function setAttackModalNote(message) {
    attackModalState.message = String(message || "");
    const note = document.getElementById("attack-modal-note");
    if (!note) return;
    note.textContent = attackModalState.message;
  }

  function getPopupRoots() {
    return Array.from(document.querySelectorAll(".modal"));
  }

  function closeAllPopupWindows() {
    suppressResultModalQueueAdvance = true;
    try {
      closeAttackModal();
      closeAttackConfirmModal();
      closeAttackResultModal();
      closeRaidResultModal();
      closePoliceActionResultModal();
      closeDefenseModal();
      closeSpyConfirmModal();
      closeOccupyConfirmModal();
      closeSpyResultModal();
    } finally {
      suppressResultModalQueueAdvance = false;
    }
    getPopupRoots().forEach((root) => {
      if (root instanceof HTMLElement) {
        root.classList.add("hidden");
      }
    });
    document.querySelectorAll(".stat__popover.is-open").forEach((popover) => {
      popover.classList.remove("is-open");
    });
  }

  function resolveCompleteSpyIntel(districtId) {
    const intel = getDistrictSpyIntel(districtId);
    return hasCompleteSpyIntel(intel) ? intel : null;
  }

  function getAttackResultDetails(district, availability) {
    const nick = String(district?.ownerNick || district?.owner_username || district?.ownerUsername || district?.owner || "Neznámý").trim() || "Neznámý";
    const factionRaw = String(
      district?.ownerFaction ||
      district?.ownerStructure ||
      district?.owner_structure ||
      district?.ownerRole ||
      district?.owner_role ||
      "Neznámá"
    ).trim();
    const alliance = String(district?.ownerAllianceName || district?.owner_alliance_name || "Bez aliance").trim() || "Bez aliance";
    const selectedWeapons = attackWeaponStats
      .map((item) => {
        const count = Math.max(0, Math.floor(Number(availability?.selection?.[item.name] || 0)));
        return count > 0 ? `${count}× ${item.name}` : "";
      })
      .filter(Boolean);
    const members = Math.max(0, Math.floor(Number(availability?.totalUsedMembers || 0)));
    const powerCalc = calculateAttackPowerFromSelection(availability?.selection);
    const attackPowerRaw = powerCalc.rawPower;
    const defenseSpecial = resolveDistrictDefenseSpecialModifiers(district?.id);
    const combatPenalty = getPoliceRaidCombatPenalty();
    const attackPenaltyPct = Math.max(
      0,
      Number(combatPenalty.attackPct || 0) + Number(defenseSpecial.attackerAttackPenaltyPct || 0)
    );
    const attackPower = Math.max(0, Math.floor(attackPowerRaw * (1 - attackPenaltyPct / 100)));
    const durationMs = resolveAttackDurationMsForDistrict(district);
    return {
      nickname: nick,
      faction: formatFactionLabel(factionRaw),
      alliance,
      weapons: selectedWeapons.length ? selectedWeapons.join(", ") : "Žádná zbraň",
      attackPower,
      specialModifiers: powerCalc.special,
      defenseSpecialModifiers: defenseSpecial,
      members,
      durationMs,
      durationLabel: formatAttackDurationLabel(durationMs),
      summary: `Spustil jsi útok na hráče ${nick}.`
    };
  }

  function formatAttackSelectionSummary(selectionSummary) {
    const items = attackWeaponStats
      .map((item) => {
        const count = Math.max(0, Math.floor(Number(selectionSummary?.selection?.[item.name] || 0)));
        return count > 0 ? `${count}× ${item.name}` : "";
      })
      .filter(Boolean);
    return items.length > 0 ? items.join(", ") : "Žádná zbraň";
  }

  function getAttackDefensePowerEstimate(district, selection = null) {
    const snapshot = window.Empire.UI?.getDistrictDefenseSnapshot?.(district?.id) || null;
    const special = getAttackSpecialModifiers(selection);
    const defenseIgnoreMultiplier = Math.max(0, 1 - Math.max(0, Number(special.grenadeDefenseIgnorePct || 0)) / 100);
    const knownPower = [
      Number(snapshot?.self?.power || 0),
      Number(snapshot?.ally?.power || 0)
    ].reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0);
    const combatPenalty = getPoliceRaidCombatPenalty();
    if (knownPower > 0) {
      const reduced = knownPower
        * (1 - Math.max(0, Number(combatPenalty.defensePct || 0)) / 100)
        * defenseIgnoreMultiplier;
      return Math.max(0, Math.floor(reduced));
    }
    const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
    const influence = Math.max(0, Math.floor(Number(district?.influence || district?.influence_level || 0)));
    const fallback = Math.max(26, Math.floor(influence * 1.5 + buildings.length * 26 + (district?.owner ? 48 : 12)));
    const reducedFallback = fallback
      * (1 - Math.max(0, Number(combatPenalty.defensePct || 0)) / 100)
      * defenseIgnoreMultiplier;
    return Math.max(26, Math.floor(reducedFallback));
  }

  function resolveAttackOutcomeMeta(outcomeKey) {
    const key = String(outcomeKey || "").trim().toLowerCase();
    switch (key) {
      case "total_success":
        return {
          key,
          title: "TOTÁLNÍ ÚSPĚCH",
          tone: "success",
          badge: "District je tvůj",
          summary: "Rozjebali jste je na kusy. District je tvůj. Kdo tam ještě dýchá, už maká pro tebe nebo chcípne do rána."
        };
      case "pyrrhic_victory":
        return {
          key,
          title: "PYRRHOVO VÍTĚZSTVÍ",
          tone: "warning",
          badge: "Obrana zničená",
          summary: "Sejmul jsi jejich obranu, ale tvoji lidi šli do sraček s nima. Půlka chcípla, zbraně v hajzlu. District pořád stojí ale sotva."
        };
      case "catastrophe":
        return {
          key,
          title: "KATASTROFA",
          tone: "critical",
          badge: "District shořel",
          summary: "Všechno shořelo do prdele. Baráky, lidi, zásoby. Jen popel a smrad. Tady už není co brát, jen prázdná díra."
        };
      case "failure":
      default:
        return {
          key: "failure",
          title: "NEÚSPĚCH",
          tone: "danger",
          badge: "Útok odražen",
          summary: "Totální průser. Vběhli jste tam jak idioti a nechali tam krev i výbavu. Oni taky něco ztratili, ale ty jsi ten, co dostal přes držku."
        };
    }
  }

  function buildAttackOutcomeDetails(district, availability, selectionSummary, attackResult = null) {
    const base = getAttackResultDetails(district, {
      ...availability,
      ...selectionSummary
    });
    const attackPower = Math.max(0, Math.floor(Number(attackResult?.attackPower ?? base.attackPower ?? 0)));
    const defensePower = Math.max(0, Math.floor(Number(
      attackResult?.defensePower ?? getAttackDefensePowerEstimate(district, selectionSummary?.selection)
    )));
    const outcomeMeta = resolveAttackOutcomeMeta(attackResult?.outcomeKey || "");
    const districtDestroyed = Boolean(attackResult?.destroyed || outcomeMeta.key === "catastrophe");
    const attackerLossPct = Math.max(0, Math.floor(Number(attackResult?.attackerLossPct || 0)));
    const defenseSpecial = resolveDistrictDefenseSpecialModifiers(district?.id);
    const defenderLossBasePct = Math.max(0, Math.floor(Number(attackResult?.defenderLossPct || 0)));
    const defenderLossPct = Math.max(
      0,
      Math.floor(defenderLossBasePct * (1 - Math.max(0, Number(defenseSpecial.defenderMemberLossReductionPct || 0)) / 100))
    );
    const districtLossPct = Math.max(0, Math.floor(Number(attackResult?.districtLossPct || 0)));
    const selectedWeaponLosses = {};
    attackWeaponStats.forEach((item) => {
      const selected = Math.max(0, Math.floor(Number(selectionSummary?.selection?.[item.name] || 0)));
      if (!selected) return;
      let lost = selected;
      if (outcomeMeta.key === "total_success") {
        lost = 0;
      } else if (outcomeMeta.key === "pyrrhic_victory") {
        lost = Math.ceil(selected * 0.5);
      }
      selectedWeaponLosses[item.name] = lost;
    });
    const lostMembers = outcomeMeta.key === "total_success"
      ? 0
      : outcomeMeta.key === "pyrrhic_victory"
        ? Math.ceil(Number(selectionSummary?.totalUsedMembers || 0) * 0.5)
        : Math.max(0, Math.floor(Number(selectionSummary?.totalUsedMembers || 0)));

    const availableRows = {
      attackPower: `${attackPower}`,
      defensePower: `${defensePower}`,
      attackerLosses: `${attackerLossPct}%`,
      defenderLosses: `${defenderLossPct}%`,
      districtState: districtDestroyed
        ? "Zničený"
        : outcomeMeta.key === "total_success"
          ? "Obsazený"
          : "Stojí"
    };

    return {
      ...base,
      districtId: district?.id ?? null,
      districtName: district?.name || `Distrikt #${district?.id ?? "-"}`,
      title: outcomeMeta.title,
      outcomeBadge: outcomeMeta.badge,
      outcomeTone: outcomeMeta.tone,
      summary: outcomeMeta.summary,
      outcomeKey: outcomeMeta.key,
      attackPower,
      defensePower,
      winChancePct: Math.round(calculateAttackWinChancePct(attackPower, defensePower)),
      attackerLossPct,
      defenderLossPct,
      districtLossPct,
      districtDestroyed,
      selectedWeaponLosses,
      lostMembers,
      attackRowValue: availableRows.attackPower,
      defenseRowValue: availableRows.defensePower,
      attackerLossesRowValue: availableRows.attackerLosses,
      defenderLossesRowValue: availableRows.defenderLosses,
      districtStateValue: districtDestroyed ? "Zničený" : (outcomeMeta.key === "total_success" ? "Obsazený" : "Stojí"),
      durationValue: base.durationLabel,
      activatedSpecialEffects: resolveActivatedAttackSpecialEffects(selectionSummary?.selection, district)
    };
  }

  function scheduleAttackResultModal(details, selectionSummary) {
    if (attackResultTimer) {
      clearTimeout(attackResultTimer);
      attackResultTimer = null;
    }
    const safeDetails = { ...(details || {}) };
    const safeSelectionSummary = selectionSummary ? { ...selectionSummary } : null;
    attackResultTimer = setTimeout(() => {
      attackResultTimer = null;
      applyAttackOutcomeLosses(safeSelectionSummary, safeDetails.outcomeKey);
      const district = resolveDistrictById(safeDetails.districtId);
      const previousOwnerName = district ? String(district?.ownerNick || district?.owner || "").trim() : "";
      const outcomeKey = String(safeDetails.outcomeKey || "").trim().toLowerCase();
      if (district && (outcomeKey === "catastrophe" || safeDetails.districtDestroyed)) {
        district.owner = null;
        district.ownerNick = null;
        district.ownerAllianceName = null;
        district.ownerAllianceIconKey = null;
        district.ownerPlayerId = null;
        district.influence = 0;
        district.income = 0;
        district.isDestroyed = true;
        district.destroyedAt = Date.now();
        updateDistrict(district);
        window.Empire.Map?.refreshSelectedDistrictModal?.();
        window.Empire.Map?.render?.();
      } else if (district && outcomeKey === "total_success") {
        claimDistrictForPlayer(district);
      }
      openAttackResultModal(safeDetails);
      document.dispatchEvent(new CustomEvent("empire:attack-resolved", {
        detail: {
          districtId: safeDetails.districtId ?? null,
          outcomeKey,
          previousOwnerName,
          details: {
            ...safeDetails,
            previousOwnerName
          }
        }
      }));
    }, Math.max(1000, Math.floor(Number(safeDetails.durationMs || ATTACK_ACTION_DURATION_MS))));
  }

  function calculateAttackWinChancePct(attackPower, defensePower) {
    const attack = Math.max(0, Math.floor(Number(attackPower) || 0));
    const defense = Math.max(0, Math.floor(Number(defensePower) || 0));
    const total = attack + defense;
    if (total <= 0) return 0;
    return (attack / total) * 100;
  }

  function resolveAttackOutcomeFromPower(attackPower, defensePower, options = {}) {
    const attack = Math.max(0, Math.floor(Number(attackPower) || 0));
    const defense = Math.max(0, Math.floor(Number(defensePower) || 0));
    const districtId = Number(options?.districtId);
    const bonusCatastropheChancePct = Math.max(0, Number(options?.bonusCatastropheChancePct || 0));
    if (isOnboardingDemoScenarioActive()) {
      return {
        outcomeKey: "total_success",
        winChancePct: 100,
        attackerLossPct: 0,
        defenderLossPct: 100,
        districtLossPct: 100,
        destroyed: false
      };
    }
    if (activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY && districtId === 89) {
      return {
        outcomeKey: "catastrophe",
        winChancePct: 100,
        attackerLossPct: 100,
        defenderLossPct: 100,
        districtLossPct: 100,
        destroyed: true
      };
    }
    const catastrophe = Math.random() < ((8 + bonusCatastropheChancePct) / 100);
    const winChancePct = calculateAttackWinChancePct(attack, defense);
    if (catastrophe) {
      return {
        outcomeKey: "catastrophe",
        winChancePct,
        attackerLossPct: 100,
        defenderLossPct: 100,
        districtLossPct: 100,
        destroyed: true
      };
    }
    if ((Math.random() * 100) < winChancePct) {
      const total = Math.max(1, attack + defense);
      const marginPct = ((attack - defense) / total) * 100;
      const totalSuccessChancePct = Math.max(35, Math.min(85, 55 + marginPct));
      if ((Math.random() * 100) < totalSuccessChancePct) {
        return {
          outcomeKey: "total_success",
          winChancePct,
          attackerLossPct: 0,
          defenderLossPct: 100,
          districtLossPct: 100,
          destroyed: false
        };
      }
      return {
        outcomeKey: "pyrrhic_victory",
        winChancePct,
        attackerLossPct: 50,
        defenderLossPct: 100,
        districtLossPct: 25,
        destroyed: false
      };
    }
    return {
      outcomeKey: "failure",
      winChancePct,
      attackerLossPct: 100,
      defenderLossPct: 20,
      districtLossPct: 20,
      destroyed: false
    };
  }

  function applyAttackOutcomeLosses(selectionSummary, outcomeKey) {
    const key = String(outcomeKey || "").trim().toLowerCase();
    const weaponLosses = {};
    const returnedWeapons = {};
    attackWeaponStats.forEach((item) => {
      const selected = Math.max(0, Math.floor(Number(selectionSummary?.selection?.[item.name] || 0)));
      if (!selected) return;
      const lost = key === "pyrrhic_victory"
        ? Math.ceil(selected * 0.5)
        : key === "total_success"
          ? 0
          : selected;
      if (lost > 0) weaponLosses[item.name] = lost;
      const returned = Math.max(0, selected - lost);
      if (returned > 0) returnedWeapons[item.name] = returned;
    });
    const lostMembers = key === "pyrrhic_victory"
      ? Math.ceil(Math.max(0, Number(selectionSummary?.totalUsedMembers || 0)) * 0.5)
      : key === "total_success"
        ? 0
        : Math.max(0, Math.floor(Number(selectionSummary?.totalUsedMembers || 0)));
    let redirectedToInjured = 0;
    let injuryQueueAfter = null;
    let directLostMembers = lostMembers;
    if (Object.keys(returnedWeapons).length > 0) {
      restoreAttackWeaponCounts(returnedWeapons);
    }
    if (lostMembers > 0) {
      const clinicResult = window.Empire.Map?.registerClinicCasualties?.(lostMembers, {
        source: "attack",
        outcomeKey: key
      }) || null;
      if (clinicResult && typeof clinicResult === "object") {
        redirectedToInjured = Math.max(0, Math.floor(Number(clinicResult.toInjuredQueue || 0)));
        directLostMembers = Math.max(0, Math.floor(Number(clinicResult.directDeaths || 0)));
        injuryQueueAfter = Number.isFinite(Number(clinicResult.injuredQueue))
          ? Math.max(0, Math.floor(Number(clinicResult.injuredQueue)))
          : null;
      }
      if (directLostMembers > 0) {
        consumeGangMembers(directLostMembers);
      }
    }
    return {
      weaponLosses,
      returnedWeapons,
      lostMembers: directLostMembers,
      redirectedToInjured,
      injuryQueueAfter
    };
  }

  function isOnboardingDemoScenarioActive() {
    return activePlayerScenarioKey === "onboarding-20-edge" && scenarioVisionEnabled && !window.Empire.token;
  }

  function shouldLockOnboardingResultModal() {
    const onboardingState = window.Empire.Onboarding?.getState?.();
    return Boolean(onboardingState?.active) && isOnboardingDemoScenarioActive();
  }

  function renderAttackResultModal(details) {
    const root = document.getElementById("attack-result-modal");
    const content = document.getElementById("attack-result-modal-content");
    const badge = document.getElementById("attack-result-modal-badge");
    const summary = document.getElementById("attack-result-modal-summary");
    const title = document.querySelector("#attack-result-modal .modal__header h3");
    const nickname = document.getElementById("attack-result-modal-nickname");
    const faction = document.getElementById("attack-result-modal-faction");
    const alliance = document.getElementById("attack-result-modal-alliance");
    const weapons = document.getElementById("attack-result-modal-weapons");
    const power = document.getElementById("attack-result-modal-power");
    const members = document.getElementById("attack-result-modal-members");
    const duration = document.getElementById("attack-result-modal-duration");
    const targetLabel = document.getElementById("attack-result-modal-label-target");
    const attackLabel = document.getElementById("attack-result-modal-label-attack");
    const defenseLabel = document.getElementById("attack-result-modal-label-defense");
    const attackLossLabel = document.getElementById("attack-result-modal-label-attack-losses");
    const defenseLossLabel = document.getElementById("attack-result-modal-label-defense-losses");
    const stateLabel = document.getElementById("attack-result-modal-label-state");
    const durationLabel = document.getElementById("attack-result-modal-label-duration");
    const defenseRow = alliance?.closest(".modal__row") || null;
    const showDefensePower = String(details?.outcomeKey || "").trim().toLowerCase() === "total_success";
    if (content) {
      content.classList.remove("is-total-success", "is-pyrrhic-victory", "is-failure", "is-catastrophe");
      const outcomeClass = details?.outcomeKey
        ? `is-${String(details.outcomeKey).replace(/_/g, "-")}`
        : "is-failure";
      content.classList.add(outcomeClass);
    }
    if (badge) badge.textContent = details.outcomeBadge || "Výsledek útoku";
    if (title) title.textContent = details.title || "Výsledek útoku";
    if (summary) {
      const specialLines = Array.isArray(details?.activatedSpecialEffects)
        ? details.activatedSpecialEffects.filter(Boolean)
        : [];
      summary.textContent = specialLines.length
        ? `${details.summary || ""} Aktivované efekty: ${specialLines.join(" • ")}`
        : (details.summary || "");
    }
    if (targetLabel) targetLabel.textContent = "Cíl";
    if (attackLabel) attackLabel.textContent = "Útočná síla";
    if (defenseLabel) defenseLabel.textContent = "Obranná síla";
    if (attackLossLabel) attackLossLabel.textContent = "Ztráty útočníka";
    if (defenseLossLabel) defenseLossLabel.textContent = "Ztráty obránce";
    if (stateLabel) stateLabel.textContent = "Stav districtu";
    if (durationLabel) durationLabel.textContent = "Trvání";
    if (nickname) nickname.textContent = details.districtName || `Distrikt #${details.districtId ?? "-"}`;
    if (faction) faction.textContent = `${details.attackPower ?? 0}`;
    if (alliance) alliance.textContent = showDefensePower ? `${details.defensePower ?? 0}` : "-";
    if (weapons) weapons.textContent = `${details.attackerLossPct ?? 0}%`;
    if (power) power.textContent = `${details.defenderLossPct ?? 0}%`;
    if (members) members.textContent = details.districtStateValue || "-";
    if (duration) duration.textContent = details.durationValue || details.durationLabel || "-";
    if (defenseRow) defenseRow.classList.toggle("hidden", !showDefensePower);
    if (!root) return;
  }

  function renderAttackWeaponButtons(container, availability) {
    if (!container) return;
    const summary = getAttackSelectionSummary(availability);
    const weaponCards = attackWeaponStats
      .map((item) => {
        const amount = Math.max(0, Math.floor(Number(summary.selection[item.name] || 0)));
        const stock = Math.max(0, Math.floor(Number(summary.remainingWeaponCounts[item.name] || 0)));
        const maxCount = getAttackWeaponMaxCount(item, summary, availability);
        const unlocked = stock > 0 && maxCount > 0;
        return `
          <div class="attack-modal__weapon ${amount > 0 ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}">
            <div class="attack-modal__weapon-body">
              <span class="attack-modal__weapon-name">${item.name}</span>
              <span class="attack-modal__weapon-meta">Síla ${item.power} • Min. ${item.requiredMembers} členů • ${stock} ks skladem</span>
              ${resolveAttackWeaponSpecialText(item.name) ? `<span class="attack-modal__weapon-meta attack-modal__weapon-meta--special">${resolveAttackWeaponSpecialText(item.name)}</span>` : ""}
            </div>
            <div class="attack-modal__weapon-stepper">
              <button
                type="button"
                class="attack-modal__step-btn"
                data-attack-weapon="${item.name}"
                data-attack-action="decrease"
                ${amount <= 0 ? "disabled" : ""}
              >−</button>
              <strong class="attack-modal__weapon-count">×${amount}</strong>
              <button
                type="button"
                class="attack-modal__step-btn"
                data-attack-weapon="${item.name}"
                data-attack-action="increase"
                ${!unlocked ? "disabled" : ""}
              >+</button>
            </div>
          </div>
        `;
      })
      .join("");
    const selectedDistrict = resolveDistrictById(attackModalState.districtId);
    const nextAvailability = availability || getAttackModalAvailability(selectedDistrict);
    const nextSummary = getAttackSelectionSummary(nextAvailability);
    const isReady = Number(nextAvailability?.cooldownMs || 0) <= 0
      && nextSummary.totalUsedMembers > 0
      && (scenarioVisionEnabled && !window.Empire.token || Boolean(window.Empire.token));
    container.innerHTML = `${weaponCards}
      <div class="attack-modal__weapon attack-modal__weapon--launch ${isReady ? "" : "is-locked"}">
        <div class="attack-modal__weapon-body">
          <span class="attack-modal__weapon-name">Spustit útok</span>
          <span class="attack-modal__weapon-meta">Potvrdí vybranou sestavu a otevře finální potvrzení útoku.</span>
        </div>
        <div class="attack-modal__weapon-stepper attack-modal__weapon-stepper--launch">
          <button
            type="button"
            class="btn btn--danger attack-modal__launch-inline-btn"
            data-attack-launch="1"
            ${isReady ? "" : "disabled"}
          >Spustit útok</button>
        </div>
      </div>
    `;
  }

  function getDefenseModalAvailability() {
    const counts = resolveDefenseCounts();
    const initialSelection = sanitizeDefenseSelection(defenseModalState.initialAssignmentSelection || {});
    const mergedCounts = defenseWeaponStats.reduce((acc, item) => {
      const inStorage = Math.max(0, Math.floor(Number(counts[item.name] || 0)));
      const alreadyAssignedHere = Math.max(0, Math.floor(Number(initialSelection[item.name] || 0)));
      acc[item.name] = inStorage + alreadyAssignedHere;
      return acc;
    }, {});
    const availableWeapons = getDefenseWeaponTotal(mergedCounts);
    const baseMembers = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(cachedProfile || window.Empire.player || {})) || 0));
    const initialUsedMembers = defenseWeaponStats.reduce((sum, item) => {
      const count = Math.max(0, Math.floor(Number(initialSelection[item.name] || 0)));
      return sum + count * Math.max(0, Math.floor(Number(item.requiredMembers || 0)));
    }, 0);
    const actualMembers = Math.max(0, baseMembers + initialUsedMembers);
    const weaponAccess = resolveCombatWeaponAccess("defense", actualMembers);
    return {
      availableWeapons,
      actualMembers,
      weaponCounts: mergedCounts,
      weaponAccess,
      unlockedWeapon: weaponAccess.weapon || null,
      initialSelection,
      initialUsedMembers
    };
  }

  function getDefenseSelectionSummary(availability, selectionCounts = defenseModalState.selectedWeaponCounts || {}) {
    const actualMembers = Math.max(0, Math.floor(Number(availability?.actualMembers || 0)));
    const weaponCounts = availability?.weaponCounts || resolveDefenseCounts();
    const selection = defenseWeaponStats.reduce((acc, item) => {
      const count = Math.max(0, Math.floor(Number(selectionCounts?.[item.name] || 0)));
      acc[item.name] = count;
      return acc;
    }, {});
    const totalUsedMembers = defenseWeaponStats.reduce((sum, item) => {
      const count = Number(selection[item.name] || 0);
      return sum + (Number.isFinite(count) ? count * Number(item.requiredMembers || 0) : 0);
    }, 0);
    const remainingMembers = Math.max(0, actualMembers - totalUsedMembers);
    const remainingWeaponCounts = defenseWeaponStats.reduce((acc, item) => {
      const stock = Math.max(0, Math.floor(Number(weaponCounts[item.name] || 0)));
      const selected = Math.max(0, Math.floor(Number(selection[item.name] || 0)));
      acc[item.name] = Math.max(0, stock - selected);
      return acc;
    }, {});
    return {
      actualMembers,
      remainingMembers,
      totalUsedMembers,
      weaponCounts,
      remainingWeaponCounts,
      selection
    };
  }

  function getDefenseWeaponMaxCount(item, summary, availability) {
    const stock = Math.max(0, Math.floor(Number(summary?.weaponCounts?.[item.name] ?? availability?.weaponCounts?.[item.name] ?? 0)));
    const current = Math.max(0, Math.floor(Number(summary?.selection?.[item.name] || 0)));
    const otherUsedMembers = Math.max(0, Number(summary?.totalUsedMembers || 0) - current * Number(item.requiredMembers || 0));
    const remainingForThisWeapon = Math.max(0, Number(summary?.actualMembers || 0) - otherUsedMembers);
    const byMembers = Math.floor(remainingForThisWeapon / Math.max(1, Number(item.requiredMembers || 0)));
    return Math.max(0, Math.min(stock, byMembers));
  }

  function renderDefenseWeaponButtons(container, availability) {
    if (!container) return;
    const summary = getDefenseSelectionSummary(availability);
    const weaponCards = defenseWeaponStats
      .map((item) => {
        const amount = Math.max(0, Math.floor(Number(summary.selection[item.name] || 0)));
        const stock = Math.max(0, Math.floor(Number(summary.remainingWeaponCounts[item.name] || 0)));
        const maxCount = getDefenseWeaponMaxCount(item, summary, availability);
        const unlocked = stock > 0 && maxCount > 0;
        return `
          <div class="attack-modal__weapon ${amount > 0 ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}">
            <div class="attack-modal__weapon-body">
              <span class="attack-modal__weapon-name">${item.name}</span>
              <span class="attack-modal__weapon-meta">Síla ${item.power} • Min. ${item.requiredMembers} členů • ${stock} ks skladem</span>
              ${resolveDefenseWeaponSpecialText(item.name) ? `<span class="attack-modal__weapon-meta attack-modal__weapon-meta--special">${resolveDefenseWeaponSpecialText(item.name)}</span>` : ""}
            </div>
            <div class="attack-modal__weapon-stepper">
              <button
                type="button"
                class="attack-modal__step-btn"
                data-defense-weapon="${item.name}"
                data-defense-action="decrease"
                ${amount <= 0 ? "disabled" : ""}
              >−</button>
              <strong class="attack-modal__weapon-count">×${amount}</strong>
              <button
                type="button"
                class="attack-modal__step-btn"
                data-defense-weapon="${item.name}"
                data-defense-action="increase"
                ${!unlocked ? "disabled" : ""}
              >+</button>
            </div>
          </div>
        `;
      })
      .join("");
    const isReady = summary.totalUsedMembers > 0 || Boolean(defenseModalState.hasInitialAssignment);
    container.innerHTML = `${weaponCards}
      <div class="attack-modal__weapon attack-modal__weapon--launch ${isReady ? "" : "is-locked"}">
        <div class="attack-modal__weapon-body">
          <span class="attack-modal__weapon-name">Nastavit obranu</span>
          <span class="attack-modal__weapon-meta">Uloží aktuální rozložení obranných zbraní do districtu.</span>
        </div>
        <div class="attack-modal__weapon-stepper attack-modal__weapon-stepper--launch">
          <button
            type="button"
            class="btn btn--primary attack-modal__launch-inline-btn"
            data-defense-launch="1"
            ${isReady ? "" : "disabled"}
          >Nastavit obranu</button>
        </div>
      </div>
    `;
  }

  function openAttackResultModal(details) {
    const root = document.getElementById("attack-result-modal");
    if (!root) return;
    if (isResultModalVisible()) {
      pendingResultModalQueue.push({ kind: "attack", payload: details });
      return;
    }
    const nextState = {
      ...(details || {}),
      visible: true
    };
    attackResultModalState = nextState;
    renderAttackResultModal(attackResultModalState);
    pushInfoWindowHistoryEntry({
      title: String(nextState?.title || "Výsledek útoku").trim() || "Výsledek útoku",
      text: [
        String(nextState?.summary || "").trim(),
        `Cíl: ${String(nextState?.districtName || `Distrikt #${nextState?.districtId ?? "-"}`)}`,
        `Stav: ${String(nextState?.districtStateValue || "-")}`
      ].filter(Boolean).join(" • ")
    });
    root.classList.remove("hidden");
  }

  function closeAttackResultModal() {
    const root = document.getElementById("attack-result-modal");
    if (root) root.classList.add("hidden");
    attackResultModalState = { visible: false };
    if (suppressResultModalQueueAdvance) return;
    if (!pendingResultModalQueue.length) return;
    setTimeout(() => {
      renderNextPendingResultModal();
    }, 80);
  }

  function closeAttackConfirmModal() {
    const root = document.getElementById("attack-confirm-modal");
    if (root) root.classList.add("hidden");
    attackConfirmModalState = {
      districtId: null,
      availability: null,
      selectionSummary: null,
      baseDetails: null,
      defensePowerEstimate: 0
    };
  }

  function renderAttackConfirmModal() {
    const root = document.getElementById("attack-confirm-modal");
    const districtEl = document.getElementById("attack-confirm-modal-district");
    const defenseRowEl = document.getElementById("attack-confirm-modal-defense-row");
    const defenseEl = document.getElementById("attack-confirm-modal-defense");
    const weaponsEl = document.getElementById("attack-confirm-modal-weapons");
    const membersEl = document.getElementById("attack-confirm-modal-members");
    const powerEl = document.getElementById("attack-confirm-modal-power");
    const noteEl = document.getElementById("attack-confirm-modal-note");
    const confirmBtn = document.getElementById("attack-confirm-modal-confirm");
    if (!root || root.classList.contains("hidden")) return;
    if (!districtEl || !defenseRowEl || !defenseEl || !weaponsEl || !membersEl || !powerEl || !noteEl || !confirmBtn) return;

    const district = resolveDistrictById(attackConfirmModalState.districtId);
    const availability = attackConfirmModalState.availability || getAttackModalAvailability(district);
    const selectionSummary = attackConfirmModalState.selectionSummary || getAttackSelectionSummary(availability);
    const baseDetails = attackConfirmModalState.baseDetails || getAttackResultDetails(district, {
      ...availability,
      ...selectionSummary
    });
    const spyIntel = resolveCompleteSpyIntel(district?.id);
    const usedMembers = Math.max(0, Math.floor(Number(selectionSummary?.totalUsedMembers || 0)));
    const attackPower = Math.max(0, Math.floor(Number(baseDetails.attackPower || 0)));
    const defensePowerEstimate = Math.max(0, Math.floor(Number(
      attackConfirmModalState.defensePowerEstimate || getAttackDefensePowerEstimate(district, selectionSummary?.selection)
    )));
    const winChancePct = isOnboardingDemoScenarioActive()
      ? 100
      : Math.round(calculateAttackWinChancePct(attackPower, defensePowerEstimate));

    districtEl.textContent = district?.name || `Distrikt #${district?.id ?? "-"}`;
    if (spyIntel && String(spyIntel.powerRangeLabel || "").trim()) {
      defenseRowEl.classList.remove("hidden");
      const range = String(spyIntel.powerRangeLabel).trim();
      defenseEl.innerHTML = `${range} <span class="attack-confirm-modal__intel-chip">ze špehování</span>`;
    } else {
      defenseRowEl.classList.add("hidden");
      defenseEl.textContent = "-";
    }
    weaponsEl.textContent = formatAttackSelectionSummary(selectionSummary);
    membersEl.textContent = String(usedMembers);
    powerEl.textContent = String(attackPower);
    noteEl.textContent = Number(availability?.cooldownMs || 0) > 0
      ? `Další útok můžeš spustit za ${formatAttackCooldownLabel(availability.cooldownMs)}.`
      : `Po potvrzení se útok spustí na ${baseDetails.durationLabel || formatAttackDurationLabel(ATTACK_ACTION_DURATION_MS)}. Odhad šance na výhru: ${winChancePct} %. Výsledek se ukáže až po doběhnutí plamenů.`;

    confirmBtn.disabled = !district || usedMembers <= 0 || attackPower <= 0 || Number(availability?.cooldownMs || 0) > 0;
  }

  function openAttackConfirmModal(payload) {
    const root = document.getElementById("attack-confirm-modal");
    if (!root) return;
    attackConfirmModalState = {
      districtId: payload?.districtId ?? null,
      availability: payload?.availability || null,
      selectionSummary: payload?.selectionSummary || null,
      baseDetails: payload?.baseDetails || null,
      defensePowerEstimate: Math.max(0, Math.floor(Number(payload?.defensePowerEstimate || 0)))
    };
    root.classList.remove("hidden");
    renderAttackConfirmModal();
    document.dispatchEvent(new CustomEvent("empire:attack-confirm-modal-opened", {
      detail: {
        districtId: attackConfirmModalState.districtId,
        district: resolveDistrictById(attackConfirmModalState.districtId) || null
      }
    }));
  }

  async function startAttackActionFromConfirmModal() {
    const district = resolveDistrictById(attackConfirmModalState.districtId);
    if (!district) {
      closeAttackConfirmModal();
      closeAttackModal();
      return;
    }

    const availability = attackConfirmModalState.availability || getAttackModalAvailability(district);
    const selectionSummary = attackConfirmModalState.selectionSummary || getAttackSelectionSummary(availability);
    const baseDetails = attackConfirmModalState.baseDetails || getAttackResultDetails(district, {
      ...availability,
      ...selectionSummary
    });
    const defensePowerEstimate = Math.max(0, Math.floor(Number(
      attackConfirmModalState.defensePowerEstimate || getAttackDefensePowerEstimate(district, selectionSummary?.selection)
    )));
    const attackSpecial = getAttackSpecialModifiers(selectionSummary?.selection);
    const demoMode = scenarioVisionEnabled && !window.Empire.token;
    const actionDurationMs = Math.max(1000, Math.floor(Number(baseDetails.durationMs || ATTACK_ACTION_DURATION_MS)));
    const confirmBtn = document.getElementById("attack-confirm-modal-confirm");
    const noteEl = document.getElementById("attack-confirm-modal-note");
    const trapEntry = getDistrictTrapEntry(district?.id);
    let sourceDistrictId = null;

    if (Number(availability?.cooldownMs || 0) > 0) {
      if (noteEl) noteEl.textContent = `Další útok můžeš spustit za ${formatAttackCooldownLabel(availability.cooldownMs)}.`;
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    if (trapEntry) {
      showActionConfirmPopup({
        tone: "attack",
        title: "ÚTOK POTVRZEN",
        subtitle: district?.name || `Distrikt #${district?.id ?? "-"}`
      });
      const consumedTrap = consumeDistrictTrap(district?.id);
      const lockUntil = setAttackTargetLockUntil(district?.owner, Date.now() + TRAP_ATTACK_TARGET_LOCK_MS);
      const lockMs = Math.max(0, Number(lockUntil || 0) - Date.now());
      const targetLabel = String(district?.ownerNick || district?.owner || consumedTrap?.targetOwnerLabel || "Neznámý").trim() || "Neznámý";
      closeAllPopupWindows();
      setAttackTargetCooldownUntil(
        district?.owner,
        Date.now() + actionDurationMs + ATTACK_TARGET_COOLDOWN_MS
      );
      pushEvent(`Past v districtu ${district?.name || `#${district?.id ?? "-"}`} zrušila útok. Na hráče ${targetLabel} máš cooldown ${formatDurationLabel(lockMs || TRAP_ATTACK_TARGET_LOCK_MS)}.`);
      openAttackResultModal({
        districtId: district?.id ?? null,
        districtName: district?.name || `Distrikt #${district?.id ?? "-"}`,
        title: "PAST AKTIVOVÁNA",
        outcomeBadge: "Útok zrušen",
        outcomeTone: "critical",
        outcomeKey: "failure",
        summary: `V districtu byla nastražená past. Útok se rozpadl dřív, než začal. Na hráče ${targetLabel} nemůžeš znovu zaútočit ${formatDurationLabel(lockMs || TRAP_ATTACK_TARGET_LOCK_MS)}.`,
        attackPower: baseDetails.attackPower,
        defensePower: defensePowerEstimate,
        attackerLossPct: 0,
        defenderLossPct: 0,
        districtStateValue: "Past spuštěna",
        durationValue: formatDurationLabel(lockMs || TRAP_ATTACK_TARGET_LOCK_MS),
        activatedSpecialEffects: ["Past zrušila útok a spustila 5h cooldown na další útok proti tomuto hráči."]
      });
      return;
    }

    if (!demoMode && !window.Empire.token) {
      const message = "Bez přihlášení lze útok jen připravit.";
      if (noteEl) noteEl.textContent = message;
      pushEvent(message);
      return;
    }

    if (confirmBtn) confirmBtn.disabled = true;
    if (noteEl) noteEl.textContent = "Po potvrzení se útok spouští...";

    let details = null;
    if (demoMode) {
      const outcomeRoll = resolveAttackOutcomeFromPower(baseDetails.attackPower, defensePowerEstimate, {
        bonusCatastropheChancePct: attackSpecial.bazookaCatastropheChancePct,
        districtId: district?.id
      });
      details = buildAttackOutcomeDetails(district, availability, selectionSummary, {
        ...outcomeRoll,
        attackPower: baseDetails.attackPower,
        defensePower: defensePowerEstimate
      });
    } else {
      try {
        const result = await Promise.race([
          window.Empire.API.attackDistrict(district.id),
          new Promise((_, reject) => {
            window.setTimeout(() => {
              reject(new Error("Server neodpověděl na útok včas. Zkus to prosím znovu."));
            }, ATTACK_REQUEST_TIMEOUT_MS);
          })
        ]);
        if (result?.error) {
          const errorMessage = result.error === "cooldown" && Number(result?.cooldownMs || 0) > 0
            ? `Na stejného hráče můžeš znovu zaútočit za ${formatAttackCooldownLabel(Number(result.cooldownMs || 0))}.`
            : formatAttackError(result.error);
          if (noteEl) noteEl.textContent = errorMessage;
          if (confirmBtn) confirmBtn.disabled = false;
          pushEvent(errorMessage);
          recordVerifiedIntelEvent({
            type: "attack_failed",
            districtId: district.id,
            message: errorMessage
          });
          return;
        }
        details = buildAttackOutcomeDetails(district, availability, selectionSummary, {
          ...result,
          attackPower: result?.attackPower ?? baseDetails.attackPower,
          defensePower: result?.defensePower ?? defensePowerEstimate
        });
        sourceDistrictId = result?.sourceDistrictId ?? null;
      } catch (error) {
        const message = error?.message || "Útok se nepodařilo spustit.";
        if (noteEl) noteEl.textContent = message;
        if (confirmBtn) confirmBtn.disabled = false;
        pushEvent(message);
        return;
      }
    }

    try {
      showActionConfirmPopup({
        tone: "attack",
        title: "ÚTOK POTVRZEN",
        subtitle: district?.name || `Distrikt #${district?.id ?? "-"}`
      });

      const markerResult = window.Empire.Map?.markDistrictUnderAttack?.(district.id, {
        attackerDistrictId: sourceDistrictId,
        durationMs: actionDurationMs,
        source: demoMode ? "scenario-attack" : "player-attack"
      });
      if (markerResult && markerResult.ok === false) {
        const message = "Útok se nepodařilo spustit. Zkus to znovu.";
        if (noteEl) noteEl.textContent = message;
        if (confirmBtn) confirmBtn.disabled = false;
        pushEvent(message);
        return;
      }

      closeAllPopupWindows();
      setActiveAttackCooldownUntil(Date.now() + actionDurationMs);
      const isAttackOnOtherPlayer =
        Boolean(district)
        && !isDistrictUnownedForSpyOutcome(district)
        && !isDistrictOwnedByPlayer(district);
      if (isAttackOnOtherPlayer) {
        const currentHeat = resolveWantedLevel(window.Empire.player);
        setPlayerWantedHeat(currentHeat + 5, "Spuštěný útok na jiného hráče", "rise");
      }
      document.dispatchEvent(new CustomEvent("empire:attack-started", {
        detail: {
          districtId: district?.id ?? null,
          district: district || null,
          durationMs: actionDurationMs
        }
      }));
      setAttackTargetCooldownUntil(
        district?.owner,
        Date.now() + actionDurationMs + ATTACK_TARGET_COOLDOWN_MS
      );

      pushEvent(`${details.title}: ${details.summary}`);
      recordVerifiedIntelEvent({
        type: "attack_outcome",
        districtId: district.id,
        message: details.summary
      });
      try {
        consumeAttackWeaponCounts(selectionSummary?.selection || {});
      } catch (error) {
        console.error("Attack weapon consume failed", error);
      }
      scheduleAttackResultModal(details, selectionSummary);
    } catch (error) {
      const message = error?.message || "Útok se nepodařilo dokončit.";
      if (noteEl) noteEl.textContent = message;
      if (confirmBtn) confirmBtn.disabled = false;
      pushEvent(message);
    }
  }

  function initAttackConfirmModal() {
    const root = document.getElementById("attack-confirm-modal");
    const backdrop = document.getElementById("attack-confirm-modal-backdrop");
    const closeBtn = document.getElementById("attack-confirm-modal-close");
    const cancelBtn = document.getElementById("attack-confirm-modal-cancel");
    const confirmBtn = document.getElementById("attack-confirm-modal-confirm");
    if (!root) return;

    if (backdrop) backdrop.addEventListener("click", closeAttackConfirmModal);
    if (closeBtn) closeBtn.addEventListener("click", closeAttackConfirmModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeAttackConfirmModal);
    if (confirmBtn) confirmBtn.addEventListener("click", startAttackActionFromConfirmModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeAttackConfirmModal();
      }
    });
  }

  function renderAttackModal() {
    const root = document.getElementById("attack-modal");
    if (!root || root.classList.contains("hidden")) return;
    const district = resolveDistrictById(attackModalState.districtId);
    const districtLabel = document.getElementById("attack-modal-district");
    const membersCountEl = document.getElementById("attack-modal-members-count");
    const usedMembersEl = document.getElementById("attack-modal-used-members");
    const powerEl = document.getElementById("attack-modal-power");
    const weaponButtons = document.getElementById("attack-modal-weapons");
    const cooldownEl = document.getElementById("attack-modal-cooldown");
    const startBtn = document.getElementById("attack-modal-start");
    const note = document.getElementById("attack-modal-note");
    if (!districtLabel || !membersCountEl || !usedMembersEl || !powerEl || !weaponButtons || !cooldownEl || !startBtn || !note) {
      return;
    }

    const availability = getAttackModalAvailability(district);
    const demoMode = scenarioVisionEnabled && !window.Empire.token;
    const selectionSummary = getAttackSelectionSummary(availability);

    if (!attackModalState.districtId && district?.id != null) {
      attackModalState = { districtId: district.id, message: attackModalState.message || "", selectedWeaponCounts: attackModalState.selectedWeaponCounts || {} };
    }

    if (district) {
      districtLabel.textContent = district.name || `Distrikt #${district.id}`;
    } else {
      districtLabel.textContent = "-";
    }

    membersCountEl.textContent = String(selectionSummary.remainingMembers);
    usedMembersEl.textContent = String(selectionSummary.totalUsedMembers);
    powerEl.textContent = String(attackWeaponStats.reduce((sum, item) => {
      const count = Math.max(0, Math.floor(Number(selectionSummary.selection[item.name] || 0)));
      return sum + (count * Number(item.power || 0));
    }, 0));
    renderAttackWeaponButtons(weaponButtons, availability);

    const cooldownMs = availability.cooldownMs;
    cooldownEl.textContent = cooldownMs > 0
      ? formatAttackCooldownLabel(cooldownMs)
      : "Připraveno";

    let noteText = attackModalState.message || "";
    if (!window.Empire.token && !demoMode) {
      noteText = "Bez přihlášení lze v této verzi útok jen připravit.";
    } else if (cooldownMs > 0) {
      noteText = `Útok je na cooldownu ještě ${formatAttackCooldownLabel(cooldownMs)}.`;
    } else if (availability.availableWeapons <= 0) {
      noteText = "Ve skladu nejsou žádné zbraně.";
    } else if (selectionSummary.remainingMembers < 0) {
      noteText = "Nemáš dost členů gangu pro tuto kombinaci.";
    }
    note.textContent = noteText;

    const isReady = cooldownMs <= 0
      && selectionSummary.totalUsedMembers > 0
      && (demoMode || Boolean(window.Empire.token));
    startBtn.disabled = !isReady;
    startBtn.textContent = "Spustit útok";
  }

  function closeAttackModal() {
    const root = document.getElementById("attack-modal");
    if (root) root.classList.add("hidden");
    attackModalState = { districtId: null, message: "", selectedWeaponCounts: {} };
    if (attackModalRefreshTimer) {
      clearInterval(attackModalRefreshTimer);
      attackModalRefreshTimer = null;
    }
  }

  function openAttackModal(district) {
    const root = document.getElementById("attack-modal");
    if (!root) return;

    attackModalState = { districtId: district?.id ?? null, message: "", selectedWeaponCounts: {} };
    setAttackModalNote("");
    root.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("empire:attack-modal-opened", {
      detail: {
        districtId: district?.id ?? null,
        district: district || null
      }
    }));
    renderAttackModal();

    if (attackModalRefreshTimer) clearInterval(attackModalRefreshTimer);
    attackModalRefreshTimer = setInterval(() => {
      const modal = document.getElementById("attack-modal");
      if (!modal || modal.classList.contains("hidden")) {
        closeAttackModal();
        return;
      }
      renderAttackModal();
    }, 250);
  }

  function initAttackModal() {
    const root = document.getElementById("attack-modal");
    const backdrop = document.getElementById("attack-modal-backdrop");
    const closeBtn = document.getElementById("attack-modal-close");
    const startBtn = document.getElementById("attack-modal-start");
    const weaponButtons = document.getElementById("attack-modal-weapons");
    if (!root) return;

    if (backdrop) backdrop.addEventListener("click", closeAttackModal);
    if (closeBtn) closeBtn.addEventListener("click", closeAttackModal);
    if (weaponButtons) {
      const handleAttackStepperInteraction = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const launchButton = target.closest("[data-attack-launch]");
        if (launchButton) {
          if (startBtn && !startBtn.disabled) startBtn.click();
          return;
        }
        const button = target.closest("[data-attack-weapon][data-attack-action]");
        if (!button) return;
        const now = Date.now();
        if (event.type === "click" && now - lastAttackStepperInteractionAt < 120) {
          return;
        }
        lastAttackStepperInteractionAt = now;
        if (event.type === "pointerdown") {
          event.preventDefault();
        }
        const name = String(button.getAttribute("data-attack-weapon") || "").trim();
        const action = String(button.getAttribute("data-attack-action") || "").trim();
        if (!name) return;
        if (action !== "increase" && action !== "decrease") return;
        const selectedDistrict = resolveDistrictById(attackModalState.districtId);
        const availability = getAttackModalAvailability(selectedDistrict);
        const summary = getAttackSelectionSummary(availability);
        const item = attackWeaponStats.find((entry) => entry.name === name);
        if (!item) return;
        const current = Math.max(0, Math.floor(Number(summary.selection[name] || 0)));
        const maxCount = getAttackWeaponMaxCount(item, summary, availability);
        let nextCount = current;
        if (action === "increase") {
          nextCount = current < maxCount ? current + 1 : current;
        } else if (action === "decrease") {
          nextCount = current > 0 ? current - 1 : 0;
        }
        attackModalState.selectedWeaponCounts = {
          ...(attackModalState.selectedWeaponCounts || {}),
          [name]: nextCount
        };
        if (nextCount <= 0) {
          delete attackModalState.selectedWeaponCounts[name];
        }
        setAttackModalNote("");
        renderAttackModal();
      };
      weaponButtons.addEventListener("dblclick", (event) => {
        event.preventDefault();
      });
      weaponButtons.addEventListener("pointerdown", handleAttackStepperInteraction);
      weaponButtons.addEventListener("click", handleAttackStepperInteraction);
    }
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        const district = resolveDistrictById(attackModalState.districtId);
        if (!district) {
          setAttackModalNote("Nejprve vyber cíl útoku.");
          return;
        }
        const availability = getAttackModalAvailability(district);
        const demoMode = scenarioVisionEnabled && !window.Empire.token;
        if (availability.cooldownMs > 0) {
          setAttackModalNote(`Útok je na cooldownu ještě ${formatAttackCooldownLabel(availability.cooldownMs)}.`);
          renderAttackModal();
          return;
        }
        const selectionSummary = getAttackSelectionSummary(availability);
        if (selectionSummary.totalUsedMembers <= 0) {
          setAttackModalNote("");
          renderAttackModal();
          return;
        }
        if (selectionSummary.remainingMembers < 0) {
          setAttackModalNote("Nemáš dost členů gangu pro tuto kombinaci.");
          renderAttackModal();
          return;
        }
        const baseDetails = getAttackResultDetails(district, {
          ...availability,
          ...selectionSummary
        });
        const defensePowerEstimate = getAttackDefensePowerEstimate(district, selectionSummary?.selection);

        if (!window.Empire.token && !demoMode) {
          setAttackModalNote("Bez přihlášení lze útok jen připravit v ukázkovém stavu.");
          renderAttackModal();
          return;
        }

        openAttackConfirmModal({
          districtId: district.id,
          availability,
          selectionSummary,
          baseDetails,
          defensePowerEstimate
        });
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAttackModal();
    });
  }

  function initAttackResultModal() {
    const root = document.getElementById("attack-result-modal");
    const backdrop = document.getElementById("attack-result-modal-backdrop");
    const closeBtn = document.getElementById("attack-result-modal-close");
    const okBtn = document.getElementById("attack-result-modal-ok");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", () => {
      if (shouldLockOnboardingResultModal()) return;
      closeAttackResultModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeAttackResultModal);
    if (okBtn) okBtn.addEventListener("click", closeAttackResultModal);
    document.addEventListener("keydown", (event) => {
      if (shouldLockOnboardingResultModal()) return;
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeAttackResultModal();
      }
    });
  }

  function closeRaidResultModal() {
    const root = document.getElementById("raid-result-modal");
    if (root) root.classList.add("hidden");
    if (suppressResultModalQueueAdvance) return;
    if (!pendingResultModalQueue.length) return;
    setTimeout(() => {
      renderNextPendingResultModal();
    }, 80);
  }

  function openRaidResultModal(payload = {}) {
    const root = document.getElementById("raid-result-modal");
    const content = document.getElementById("raid-result-modal-content");
    const title = document.getElementById("raid-result-modal-title");
    const summary = document.getElementById("raid-result-modal-summary");
    const details = document.getElementById("raid-result-modal-details");
    if (!root || !content || !title || !summary || !details) return;
    if (isResultModalVisible()) {
      pendingResultModalQueue.push({ kind: "raid", payload });
      return;
    }

    const tone = String(payload.tone || "").trim();
    content.classList.remove("is-clean-success", "is-dirty-fail", "is-disaster", "is-alert");
    if (tone) content.classList.add(tone);
    title.textContent = String(payload.title || "Výsledek krádeže").trim() || "Výsledek krádeže";
    const summaryText = String(payload.summary || "").trim();
    summary.textContent = summaryText;
    summary.hidden = !summaryText;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    details.innerHTML = rows.map((row) => `
      <div class="modal__row">
        <span>${row.label}</span>
        <strong>${row.value}</strong>
      </div>
    `).join("");
    pushInfoWindowHistoryEntry({
      title: title.textContent || "Výsledek krádeže",
      text: summaryText,
      rows
    });
    root.classList.remove("hidden");
  }

  function initRaidResultModal() {
    const root = document.getElementById("raid-result-modal");
    const backdrop = document.getElementById("raid-result-modal-backdrop");
    const closeBtn = document.getElementById("raid-result-modal-close");
    const okBtn = document.getElementById("raid-result-modal-ok");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", () => {
      if (shouldLockOnboardingResultModal()) return;
      closeRaidResultModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeRaidResultModal);
    if (okBtn) okBtn.addEventListener("click", closeRaidResultModal);
    document.addEventListener("keydown", (event) => {
      if (shouldLockOnboardingResultModal()) return;
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeRaidResultModal();
      }
    });
  }

  function closePoliceActionResultModal() {
    clearDistrictAttackWarningTimer();
    window.Empire.mapClickLockUntil = Date.now() + 420;
    const root = document.getElementById("police-action-result-modal");
    if (root) {
      root.classList.add("hidden");
      root.style.zIndex = "";
    }
    if (suppressResultModalQueueAdvance) return;
    if (!pendingResultModalQueue.length) return;
    setTimeout(() => {
      renderNextPendingResultModal();
    }, 80);
  }

  function openPoliceActionResultModal(payload = {}) {
    const root = document.getElementById("police-action-result-modal");
    const content = document.getElementById("police-action-result-modal-content");
    const title = document.getElementById("police-action-result-modal-title");
    const badge = document.getElementById("police-action-result-modal-badge");
    const summary = document.getElementById("police-action-result-modal-summary");
    const details = document.getElementById("police-action-result-modal-details");
    if (!root || !content || !title || !badge || !summary || !details) return;
    if (isResultModalVisible()) {
      pendingResultModalQueue.push({ kind: "police", payload });
      return;
    }

    const toneTokens = String(payload.tone || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    content.classList.remove(
      "is-tier-1", "is-tier-2", "is-tier-3", "is-tier-4", "is-tier-5", "is-tier-6",
      "is-specialty-financial", "is-specialty-drug", "is-specialty-weapons", "is-specialty-arrests", "is-specialty-total",
      "is-district-raid-warning", "is-district-attack-warning"
    );
    toneTokens.forEach((token) => {
      content.classList.add(token);
    });

    title.textContent = String(payload.title || "Policejní akce").trim() || "Policejní akce";
    badge.textContent = String(payload.badge || "").trim() || "Policejní zásah";
    const summaryText = String(payload.summary || "").trim();
    summary.textContent = summaryText;
    summary.hidden = !summaryText;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    details.innerHTML = rows.map((row) => `
      <div class="modal__row">
        <span>${row.label}</span>
        <strong>${row.value}</strong>
      </div>
    `).join("");
    pushInfoWindowHistoryEntry({
      title: title.textContent || "Policejní akce",
      text: summaryText,
      rows
    });
    root.style.zIndex = "9999";
    root.classList.remove("hidden");
    clearDistrictAttackWarningTimer();
    if (typeof payload.onOpen === "function") {
      try {
        payload.onOpen({ root, content, title, badge, summary, details });
      } catch (error) {
        console.error("Police action modal onOpen failed", error);
      }
    }
  }

  function openDistrictPoliceRaidWarningModal(district = null, policeAction = {}) {
    const districtName = String(district?.name || "").trim() || `District #${district?.id ?? "-"}`;
    const ownerNick = String(
      district?.ownerNick
      || district?.owner_username
      || district?.ownerUsername
      || district?.owner
      || "Neznámý"
    ).trim() || "Neznámý";
    const raidSpecialty = resolveStoredPoliceRaidSpecialty(policeAction)
      || resolvePoliceRaidSpecialtyFromOperationType(policeAction?.operationType, policeAction)
      || POLICE_RAID_SPECIALTIES.total;
    const raidSpecialtyKey = String(
      policeAction?.raidSpecialtyKey
      || Object.entries(POLICE_RAID_SPECIALTIES).find(([, meta]) => meta === raidSpecialty)?.[0]
      || "total"
    ).trim().toLowerCase();
    const raidTypeLabel = String(raidSpecialty?.label || "Celková razie").trim() || "Celková razie";
    const normalizedOwnerNick = normalizeOwnerName(ownerNick);
    const warningSummary = normalizedOwnerNick === normalizeOwnerName("Sněhulák")
      ? "Tady teď ne. Policie to tu právě rozjebává."
      : normalizedOwnerNick === normalizeOwnerName("Poltergeist")
        ? "Zapomeň na to. District je plnej policajtů."
        : "Tady teď ne. Policie to tu právě rozjebává.";
    const resolvedWarningSummary = warningSummary;
    const specialtyTone = ({
      financial: "is-specialty-financial",
      drug: "is-specialty-drug",
      weapons: "is-specialty-weapons",
      arrests: "is-specialty-arrests",
      total: "is-specialty-total"
    })[raidSpecialtyKey] || "is-specialty-total";

    openPoliceActionResultModal({
      tone: `${specialtyTone} is-district-raid-warning`,
      title: "Policejní razie v districtu",
      badge: raidTypeLabel,
      summary: resolvedWarningSummary,
      rows: [
        { label: "Hráč", value: ownerNick },
        { label: "Typ razie", value: raidTypeLabel }
      ]
    });
  }

  function openDistrictAttackInProgressModal(district = null, attackMarker = {}) {
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    const attackerDistrictId = Number(attackMarker?.attackerDistrictId);
    const attackerDistrict = Number.isFinite(attackerDistrictId)
      ? districts.find((entry) => Number(entry?.id) === attackerDistrictId) || null
      : null;
    const attackerName = String(
      attackerDistrict?.ownerNick
      || attackerDistrict?.owner_username
      || attackerDistrict?.ownerUsername
      || attackerDistrict?.owner
      || "Neznámý gang"
    ).trim() || "Neznámý gang";
    const defenderName = String(
      district?.ownerNick
      || district?.owner_username
      || district?.ownerUsername
      || district?.owner
      || "Neobsazeno"
    ).trim() || "Neobsazeno";

    openPoliceActionResultModal({
      tone: "is-district-attack-warning",
      title: "Útok probíhá",
      badge: "Boj o district",
      summary: "",
      rows: [
        { label: "Útočník", value: attackerName },
        { label: "Obránce", value: defenderName },
        { label: "Konec boje za", value: formatAttackDurationLabel(Math.max(0, Number(attackMarker?.expiresAt || 0) - Date.now())) }
      ],
      onOpen: ({ root, details }) => {
        const renderRows = () => {
          if (!root || root.classList.contains("hidden")) {
            clearDistrictAttackWarningTimer();
            return;
          }
          const remainingMs = Math.max(0, Number(attackMarker?.expiresAt || 0) - Date.now());
          details.innerHTML = `
            <div class="modal__row">
              <span>Útočník</span>
              <strong>${attackerName}</strong>
            </div>
            <div class="modal__row">
              <span>Obránce</span>
              <strong>${defenderName}</strong>
            </div>
            <div class="modal__row">
              <span>Konec boje za</span>
              <strong>${formatAttackDurationLabel(remainingMs)}</strong>
            </div>
          `;
          if (remainingMs <= 0) {
            clearDistrictAttackWarningTimer();
            closePoliceActionResultModal();
          }
        };
        renderRows();
        districtAttackWarningTimer = window.setInterval(renderRows, 1000);
      }
    });
  }

  function initPoliceActionResultModal() {
    const root = document.getElementById("police-action-result-modal");
    const backdrop = document.getElementById("police-action-result-modal-backdrop");
    const closeBtn = document.getElementById("police-action-result-modal-close");
    const okBtn = document.getElementById("police-action-result-modal-ok");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", () => {
      if (shouldLockOnboardingResultModal()) return;
      closePoliceActionResultModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closePoliceActionResultModal);
    if (okBtn) okBtn.addEventListener("click", closePoliceActionResultModal);
    document.addEventListener("keydown", (event) => {
      if (shouldLockOnboardingResultModal()) return;
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closePoliceActionResultModal();
      }
    });

      document.addEventListener("empire:police-action-started", (event) => {
        const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
        const source = String(detail.source || "").trim().toLowerCase();
        if (source.startsWith("scenario-")) return;

      const wantedHeat = resolveWantedLevel(cachedProfile || window.Empire.player || {});
      const wantedTier = resolveWantedStars(wantedHeat);
      const tierEntry = POLICE_ACTION_TIER_MESSAGES[wantedTier] || POLICE_ACTION_TIER_MESSAGES[1];
      const policeQuote = resolvePoliceActionTierQuote(wantedTier);
      const districtId = Number(detail.districtId);
      const district = Number.isFinite(districtId)
        ? (Array.isArray(window.Empire.districts) ? window.Empire.districts.find((item) => Number(item?.id) === districtId) : null)
        : null;
      const districtName = String(district?.name || "").trim() || `District #${detail.districtId ?? "-"}`;
      if (district && isDistrictOwnedByPlayer(district)) {
        if (wantedTier === 1) {
          applyPoliceRaidTier1Impacts(detail, district);
        } else if (wantedTier === 2) {
          applyPoliceRaidTier2Impacts(detail, district);
        } else if (wantedTier === 3) {
          applyPoliceRaidTier3Impacts(detail, district);
        } else if (wantedTier === 4) {
          applyPoliceRaidTier4Impacts(detail, district);
        } else if (wantedTier === 5) {
          applyPoliceRaidTier5Impacts(detail, district);
        } else if (wantedTier === 6) {
          applyPoliceRaidTier6Impacts(detail, district);
        }
      }
      const specialty =
        resolveStoredPoliceRaidSpecialty(detail)
        || resolvePoliceRaidSpecialtyFromOperationType(detail.operationType, detail)
        || resolvePoliceRaidSpecialty(wantedTier, detail);
      const specialtyQuote = resolvePoliceActionSpecialtyQuote(specialty.key);

      openPoliceActionResultModal({
        title: "Policejní akce",
        badge: `Stupeň ${wantedTier}/6 • ${specialty.label}`,
        tone: tierEntry.tone,
        summary: specialtyQuote || policeQuote || tierEntry.text,
        rows: [
          { label: "Hláška", value: tierEntry.title },
          { label: "Policejní hláška", value: specialtyQuote || policeQuote || tierEntry.text },
          { label: "District", value: districtName },
          { label: "Typ razie", value: `${specialty.icon} ${specialty.label}` }
        ]
      });
    });
  }

  function buildPoliceRaidImpactKey(detail = {}) {
    const districtId = String(detail?.districtId ?? "").trim();
    const startedAt = Math.max(0, Math.floor(Number(detail?.startedAt) || 0));
    const source = String(detail?.source || "police-action").trim() || "police-action";
    return `${districtId}:${startedAt}:${source}`;
  }

  function resolvePoliceActionTierQuote(tier) {
    const safeTier = Math.max(1, Math.floor(Number(tier) || 1));
    const quotes = Array.isArray(POLICE_ACTION_TIER_QUOTES[safeTier]) ? POLICE_ACTION_TIER_QUOTES[safeTier] : [];
    if (!quotes.length) return "";
    return String(quotes[Math.floor(Math.random() * quotes.length)] || "").trim();
  }

  function resolvePoliceActionSpecialtyQuote(specialtyKey) {
    const safeKey = String(specialtyKey || "").trim().toLowerCase();
    const quotes = Array.isArray(POLICE_ACTION_SPECIALTY_QUOTES[safeKey]) ? POLICE_ACTION_SPECIALTY_QUOTES[safeKey] : [];
    if (!quotes.length) return "";
    return String(quotes[Math.floor(Math.random() * quotes.length)] || "").trim();
  }

  function getPoliceRaidImpactMap() {
    if (!window.Empire._localPoliceRaidImpacts || !(window.Empire._localPoliceRaidImpacts instanceof Map)) {
      window.Empire._localPoliceRaidImpacts = new Map();
    }
    return window.Empire._localPoliceRaidImpacts;
  }

  function applyPoliceRaidTier1Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 1);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const cleanPct = scalePoliceRaidLossPct(POLICE_RAID_TIER1.cleanConfiscationPct, raidSpecialty.key, "clean");
    const dirtyPctRoll = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER1.dirtyConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER1.dirtyConfiscationPctMax - POLICE_RAID_TIER1.dirtyConfiscationPctMin + 1)
    ), raidSpecialty.key, "dirty");
    const influenceLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER1.influencePenaltyPct, raidSpecialty.key, "influence");
    const arrestsPct = scalePoliceRaidLossPct(POLICE_RAID_TIER1.arrestsPct, raidSpecialty.key, "arrests");
    const incomePenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER1.incomePenaltyPct, raidSpecialty.key, "income");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyPctRoll / 100));

    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);
    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;

    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);
    economy.influence = nextInfluence;
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 1,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct: cleanPct,
      dirtyLoss,
      dirtyLossPct: dirtyPctRoll,
      arrested,
      arrestsPct,
      influenceLoss,
      influenceLossPct,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 1: income -${incomePenaltyPct}%, `
      + `zabaveno $${cleanLoss} clean a $${dirtyLoss} dirty, zatčeno ${arrested} lidí, vliv -${influenceLoss}.`
    );
    return impactRecord;
  }

  function setPoliceRaidProductionPenalty(buildingKey, pct, untilTimestamp) {
    const key = String(buildingKey || "").trim().toLowerCase();
    if (!key) return null;
    const safePct = Math.max(0, Math.floor(Number(pct) || 0));
    const safeUntil = Math.max(0, Math.floor(Number(untilTimestamp) || 0));
    let store = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        store = parsed;
      }
    } catch {}
    const nowMs = Date.now();
    Object.keys(store).forEach((entryKey) => {
      const entry = store[entryKey];
      const until = Math.max(0, Math.floor(Number(entry?.until || 0)));
      if (until <= nowMs) delete store[entryKey];
    });
    const currentUntil = Math.max(0, Math.floor(Number(store[key]?.until || 0)));
    if (safeUntil > currentUntil) {
      store[key] = { pct: safePct, until: safeUntil };
      localStorage.setItem(POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY, JSON.stringify(store));
    }
    return store[key] || null;
  }

  function setPoliceRaidIncomePenaltyForDistrict(districtId, pct, untilTimestamp) {
    const key = String(districtId || "").trim();
    if (!key) return null;
    const safePct = Math.max(0, Math.floor(Number(pct) || 0));
    const safeUntil = Math.max(0, Math.floor(Number(untilTimestamp) || 0));
    let store = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_INCOME_PENALTY_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        store = parsed;
      }
    } catch {}
    const nowMs = Date.now();
    Object.keys(store).forEach((entryKey) => {
      const entry = store[entryKey];
      const until = Math.max(0, Math.floor(Number(entry?.until || 0)));
      if (until <= nowMs) delete store[entryKey];
    });
    const currentUntil = Math.max(0, Math.floor(Number(store[key]?.until || 0)));
    if (safeUntil > currentUntil) {
      store[key] = { pct: safePct, until: safeUntil };
      localStorage.setItem(POLICE_RAID_INCOME_PENALTY_STORAGE_KEY, JSON.stringify(store));
    }
    return store[key] || null;
  }

  function setPoliceRaidIncomePenaltyForOwnedDistricts(pct, untilTimestamp) {
    const safePct = Math.max(0, Math.floor(Number(pct) || 0));
    const safeUntil = Math.max(0, Math.floor(Number(untilTimestamp) || 0));
    const ownedDistricts = getOwnedPlayerDistricts();
    if (!ownedDistricts.length || safePct <= 0 || safeUntil <= 0) return 0;
    let applied = 0;
    ownedDistricts.forEach((district) => {
      if (!district?.id) return;
      const entry = setPoliceRaidIncomePenaltyForDistrict(district.id, safePct, safeUntil);
      if (entry) applied += 1;
    });
    return applied;
  }

  function setPoliceRaidCombatPenalty(attackPenaltyPct, defensePenaltyPct, untilTimestamp) {
    const safeUntil = Math.max(0, Math.floor(Number(untilTimestamp) || 0));
    if (safeUntil <= 0) return null;
    const nextAttackPct = Math.max(0, Math.floor(Number(attackPenaltyPct) || 0));
    const nextDefensePct = Math.max(0, Math.floor(Number(defensePenaltyPct) || 0));
    let current = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_COMBAT_PENALTY_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) current = parsed;
    } catch {}
    const currentUntil = Math.max(0, Math.floor(Number(current?.until || 0)));
    if (safeUntil > currentUntil) {
      current = {
        attackPct: nextAttackPct,
        defensePct: nextDefensePct,
        until: safeUntil
      };
      localStorage.setItem(POLICE_RAID_COMBAT_PENALTY_STORAGE_KEY, JSON.stringify(current));
    }
    return current;
  }

  function getPoliceRaidCombatPenalty(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_COMBAT_PENALTY_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { attackPct: 0, defensePct: 0, until: 0 };
      const until = Math.max(0, Math.floor(Number(parsed.until || 0)));
      if (until <= nowMs) {
        localStorage.removeItem(POLICE_RAID_COMBAT_PENALTY_STORAGE_KEY);
        return { attackPct: 0, defensePct: 0, until: 0 };
      }
      return {
        attackPct: Math.max(0, Math.floor(Number(parsed.attackPct || 0))),
        defensePct: Math.max(0, Math.floor(Number(parsed.defensePct || 0))),
        until
      };
    } catch {
      return { attackPct: 0, defensePct: 0, until: 0 };
    }
  }

  function setPoliceRaidBuildingActionLock(lockKey, untilTimestamp) {
    const key = String(lockKey || "").trim().toLowerCase();
    if (!key) return null;
    const safeUntil = Math.max(0, Math.floor(Number(untilTimestamp) || 0));
    if (safeUntil <= 0) return null;
    let store = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) store = parsed;
    } catch {}
    const currentUntil = Math.max(0, Math.floor(Number(store[key] || 0)));
    if (safeUntil > currentUntil) {
      store[key] = safeUntil;
      localStorage.setItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY, JSON.stringify(store));
    }
    return store;
  }

  function applyPoliceRaidMaterialConfiscation(economyRef, lossPct) {
    const safeLossPct = Math.max(0, Math.floor(Number(lossPct) || 0));
    if (safeLossPct <= 0) {
      return { totalLoss: 0, lossPct: 0, byResource: {} };
    }

    const economy = economyRef && typeof economyRef === "object" ? economyRef : ensureEconomyCache();
    const byResource = {};
    let totalLoss = 0;

    const keyMap = {
      metalParts: "metal_parts",
      techCore: "tech_core",
      combatModule: "combat_module"
    };
    Object.keys(keyMap).forEach((economyKey) => {
      const current = Math.max(0, Math.floor(Number(economy[economyKey] || 0)));
      const loss = Math.max(0, Math.floor(current * safeLossPct / 100));
      if (loss <= 0) {
        byResource[economyKey] = 0;
        return;
      }
      economy[economyKey] = Math.max(0, current - loss);
      byResource[economyKey] = loss;
      totalLoss += loss;
    });
    economy.materials = Math.max(
      0,
      Math.floor(Number(economy.metalParts || 0) + Number(economy.techCore || 0) + Number(economy.combatModule || 0))
    );

    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_FACTORY_SUPPLIES_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        ["metalParts", "techCore", "combatModule"].forEach((resourceKey) => {
          const current = Math.max(0, Math.floor(Number(parsed[resourceKey] || 0)));
          const loss = Math.max(0, Math.floor(current * safeLossPct / 100));
          parsed[resourceKey] = Math.max(0, current - loss);
        });
        localStorage.setItem(POLICE_RAID_FACTORY_SUPPLIES_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}

    return { totalLoss, lossPct: safeLossPct, byResource };
  }

  function isPoliceRaidAllActionsBlocked(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      const lockUntil = Math.max(0, Math.floor(Number(parsed.all_actions_blocked || 0)));
      if (lockUntil <= nowMs) return false;
      return true;
    } catch {
      return false;
    }
  }

  function applyPoliceRaidTier2Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 2);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const cleanLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER2.cleanConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER2.cleanConfiscationPctMax - POLICE_RAID_TIER2.cleanConfiscationPctMin + 1)
    ), raidSpecialty.key, "clean");
    const dirtyLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER2.dirtyConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER2.dirtyConfiscationPctMax - POLICE_RAID_TIER2.dirtyConfiscationPctMin + 1)
    ), raidSpecialty.key, "dirty");
    const drugLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER2.drugLossPct, raidSpecialty.key, "drugs");
    const attackWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER2.attackWeaponLossPct, raidSpecialty.key, "attackWeapons");
    const incomePenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER2.incomePenaltyPct, raidSpecialty.key, "income");
    const productionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER2.productionPenaltyPct, raidSpecialty.key, "labProduction");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanLossPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyLossPct / 100));
    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);

    const drugInventory = economy.drugInventory && typeof economy.drugInventory === "object"
      ? { ...economy.drugInventory }
      : {};
    let totalDrugLoss = 0;
    storageDrugTypes.forEach((drug) => {
      const current = Math.max(0, Math.floor(Number(drugInventory[drug.key] || 0)));
      const loss = Math.max(0, Math.floor(current * drugLossPct / 100));
      if (loss > 0) {
        drugInventory[drug.key] = Math.max(0, current - loss);
        totalDrugLoss += loss;
      } else {
        drugInventory[drug.key] = current;
      }
    });
    const totalDrugs = storageDrugTypes.reduce((sum, drug) => sum + Number(drugInventory[drug.key] || 0), 0);

    const currentWeapons = resolveWeaponCounts();
    const nextWeapons = { ...currentWeapons };
    let attackWeaponLoss = 0;
    attackWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * attackWeaponLossPct / 100));
      if (loss > 0) {
        nextWeapons[item.name] = Math.max(0, current - loss);
        attackWeaponLoss += loss;
      } else {
        nextWeapons[item.name] = current;
      }
    });
    if (attackWeaponLoss > 0) {
      persistWeaponCounts(nextWeapons);
    }

    const influenceLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER2.influencePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER2.influencePenaltyPctMax - POLICE_RAID_TIER2.influencePenaltyPctMin + 1)
    ), raidSpecialty.key, "influence");
    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);

    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;
    economy.drugInventory = drugInventory;
    economy.drugs = totalDrugs;
    economy.influence = nextInfluence;
    economy.weapons = getAttackWeaponTotal(nextWeapons);
    economy.weaponsDetail = { ...nextWeapons };
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const arrestsPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER2.arrestsPctMin
      + Math.random() * (POLICE_RAID_TIER2.arrestsPctMax - POLICE_RAID_TIER2.arrestsPctMin + 1)
    ), raidSpecialty.key, "arrests");
    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("lab", productionPenaltyPct, expiresAt);

    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 2,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct,
      dirtyLoss,
      dirtyLossPct,
      drugLoss: totalDrugLoss,
      drugLossPct,
      arrested,
      arrestsPct,
      attackWeaponLoss,
      attackWeaponLossPct,
      influenceLoss,
      influenceLossPct,
      productionPenaltyPct,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true,
      raidBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 2: income -${incomePenaltyPct}%, `
      + `clean -${cleanLossPct}% ($${cleanLoss}), dirty -${dirtyLossPct}% ($${dirtyLoss}), `
      + `drogy -${drugLossPct}% (${totalDrugLoss}), zatčeno ${arrested} (${arrestsPct}%), `
      + `út. zbraně -${attackWeaponLossPct}% (${attackWeaponLoss}), vliv -${influenceLossPct}% (${influenceLoss}).`
    );
    return impactRecord;
  }

  function applyPoliceRaidTier3Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 3);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const cleanLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.cleanConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER3.cleanConfiscationPctMax - POLICE_RAID_TIER3.cleanConfiscationPctMin + 1)
    ), raidSpecialty.key, "clean");
    const dirtyLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.dirtyConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER3.dirtyConfiscationPctMax - POLICE_RAID_TIER3.dirtyConfiscationPctMin + 1)
    ), raidSpecialty.key, "dirty");
    const incomePenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.incomePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER3.incomePenaltyPctMax - POLICE_RAID_TIER3.incomePenaltyPctMin + 1)
    ), raidSpecialty.key, "income");
    const drugLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.drugLossPctMin
      + Math.random() * (POLICE_RAID_TIER3.drugLossPctMax - POLICE_RAID_TIER3.drugLossPctMin + 1)
    ), raidSpecialty.key, "drugs");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanLossPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyLossPct / 100));
    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);

    const drugInventory = economy.drugInventory && typeof economy.drugInventory === "object"
      ? { ...economy.drugInventory }
      : {};
    let totalDrugLoss = 0;
    storageDrugTypes.forEach((drug) => {
      const current = Math.max(0, Math.floor(Number(drugInventory[drug.key] || 0)));
      const loss = Math.max(0, Math.floor(current * drugLossPct / 100));
      if (loss > 0) {
        drugInventory[drug.key] = Math.max(0, current - loss);
        totalDrugLoss += loss;
      } else {
        drugInventory[drug.key] = current;
      }
    });
    const totalDrugs = storageDrugTypes.reduce((sum, drug) => sum + Number(drugInventory[drug.key] || 0), 0);

    const attackLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.attackWeaponLossPctMin
      + Math.random() * (POLICE_RAID_TIER3.attackWeaponLossPctMax - POLICE_RAID_TIER3.attackWeaponLossPctMin + 1)
    ), raidSpecialty.key, "attackWeapons");
    const defenseLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.defenseWeaponLossPctMin
      + Math.random() * (POLICE_RAID_TIER3.defenseWeaponLossPctMax - POLICE_RAID_TIER3.defenseWeaponLossPctMin + 1)
    ), raidSpecialty.key, "defenseWeapons");
    const currentAttackWeapons = resolveWeaponCounts();
    const nextAttackWeapons = { ...currentAttackWeapons };
    let attackWeaponLoss = 0;
    attackWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextAttackWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * attackLossPct / 100));
      if (loss > 0) {
        nextAttackWeapons[item.name] = Math.max(0, current - loss);
        attackWeaponLoss += loss;
      } else {
        nextAttackWeapons[item.name] = current;
      }
    });
    if (attackWeaponLoss > 0) {
      persistWeaponCounts(nextAttackWeapons);
    }

    const currentDefenseWeapons = resolveDefenseCounts();
    const nextDefenseWeapons = { ...currentDefenseWeapons };
    let defenseWeaponLoss = 0;
    defenseWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextDefenseWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * defenseLossPct / 100));
      if (loss > 0) {
        nextDefenseWeapons[item.name] = Math.max(0, current - loss);
        defenseWeaponLoss += loss;
      } else {
        nextDefenseWeapons[item.name] = current;
      }
    });
    if (defenseWeaponLoss > 0) {
      persistDefenseCounts(nextDefenseWeapons);
    }

    const influenceLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.influencePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER3.influencePenaltyPctMax - POLICE_RAID_TIER3.influencePenaltyPctMin + 1)
    ), raidSpecialty.key, "influence");
    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);

    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;
    economy.drugInventory = drugInventory;
    economy.drugs = totalDrugs;
    economy.influence = nextInfluence;
    economy.weapons = getAttackWeaponTotal(nextAttackWeapons);
    economy.weaponsDetail = { ...nextAttackWeapons };
    economy.defense = getDefenseWeaponTotal(nextDefenseWeapons);
    economy.defenseDetail = { ...nextDefenseWeapons };
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const arrestsPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.arrestsPctMin
      + Math.random() * (POLICE_RAID_TIER3.arrestsPctMax - POLICE_RAID_TIER3.arrestsPctMin + 1)
    ), raidSpecialty.key, "arrests");
    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const labProductionPenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.labProductionPenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER3.labProductionPenaltyPctMax - POLICE_RAID_TIER3.labProductionPenaltyPctMin + 1)
    ), raidSpecialty.key, "labProduction");
    const armoryProductionPenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER3.armoryProductionPenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER3.armoryProductionPenaltyPctMax - POLICE_RAID_TIER3.armoryProductionPenaltyPctMin + 1)
    ), raidSpecialty.key, "armoryProduction");

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("lab", labProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("armory", armoryProductionPenaltyPct, expiresAt);

    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 3,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct,
      dirtyLoss,
      dirtyLossPct,
      drugLoss: totalDrugLoss,
      drugLossPct,
      arrested,
      arrestsPct,
      attackWeaponLoss,
      attackWeaponLossPct: attackLossPct,
      defenseWeaponLoss,
      defenseWeaponLossPct: defenseLossPct,
      influenceLoss,
      influenceLossPct,
      labProductionPenaltyPct,
      armoryProductionPenaltyPct,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true,
      raidBlocked: true,
      attackBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 3: income -${incomePenaltyPct}%, `
      + `clean -${cleanLossPct}% ($${cleanLoss}), dirty -${dirtyLossPct}% ($${dirtyLoss}), `
      + `drogy -${drugLossPct}% (${totalDrugLoss}), zatčeno ${arrested} (${arrestsPct}%), `
      + `út. zbraně -${attackLossPct}% (${attackWeaponLoss}), obr. zbraně -${defenseLossPct}% (${defenseWeaponLoss}), `
      + `vliv -${influenceLossPct}% (${influenceLoss}), lab/drug -${labProductionPenaltyPct}%, zbrojovka -${armoryProductionPenaltyPct}%.`
    );
    return impactRecord;
  }

  function applyPoliceRaidTier4Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 4);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const cleanLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.cleanConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER4.cleanConfiscationPctMax - POLICE_RAID_TIER4.cleanConfiscationPctMin + 1)
    ), raidSpecialty.key, "clean");
    const dirtyLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.dirtyConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER4.dirtyConfiscationPctMax - POLICE_RAID_TIER4.dirtyConfiscationPctMin + 1)
    ), raidSpecialty.key, "dirty");
    const incomePenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.incomePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER4.incomePenaltyPctMax - POLICE_RAID_TIER4.incomePenaltyPctMin + 1)
    ), raidSpecialty.key, "income");
    const drugLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.drugLossPctMin
      + Math.random() * (POLICE_RAID_TIER4.drugLossPctMax - POLICE_RAID_TIER4.drugLossPctMin + 1)
    ), raidSpecialty.key, "drugs");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanLossPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyLossPct / 100));
    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);

    const drugInventory = economy.drugInventory && typeof economy.drugInventory === "object"
      ? { ...economy.drugInventory }
      : {};
    let totalDrugLoss = 0;
    storageDrugTypes.forEach((drug) => {
      const current = Math.max(0, Math.floor(Number(drugInventory[drug.key] || 0)));
      const loss = Math.max(0, Math.floor(current * drugLossPct / 100));
      if (loss > 0) {
        drugInventory[drug.key] = Math.max(0, current - loss);
        totalDrugLoss += loss;
      } else {
        drugInventory[drug.key] = current;
      }
    });
    const totalDrugs = storageDrugTypes.reduce((sum, drug) => sum + Number(drugInventory[drug.key] || 0), 0);

    const currentAttackWeapons = resolveWeaponCounts();
    const nextAttackWeapons = { ...currentAttackWeapons };
    let attackWeaponLoss = 0;
    attackWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextAttackWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * scalePoliceRaidLossPct(POLICE_RAID_TIER4.attackWeaponLossPct, raidSpecialty.key, "attackWeapons") / 100));
      if (loss > 0) {
        nextAttackWeapons[item.name] = Math.max(0, current - loss);
        attackWeaponLoss += loss;
      } else {
        nextAttackWeapons[item.name] = current;
      }
    });
    if (attackWeaponLoss > 0) {
      persistWeaponCounts(nextAttackWeapons);
    }

    const currentDefenseWeapons = resolveDefenseCounts();
    const nextDefenseWeapons = { ...currentDefenseWeapons };
    let defenseWeaponLoss = 0;
    defenseWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextDefenseWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * scalePoliceRaidLossPct(POLICE_RAID_TIER4.defenseWeaponLossPct, raidSpecialty.key, "defenseWeapons") / 100));
      if (loss > 0) {
        nextDefenseWeapons[item.name] = Math.max(0, current - loss);
        defenseWeaponLoss += loss;
      } else {
        nextDefenseWeapons[item.name] = current;
      }
    });
    if (defenseWeaponLoss > 0) {
      persistDefenseCounts(nextDefenseWeapons);
    }

    const attackWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER4.attackWeaponLossPct, raidSpecialty.key, "attackWeapons");
    const defenseWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER4.defenseWeaponLossPct, raidSpecialty.key, "defenseWeapons");
    const attackPowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER4.attackPowerPenaltyPct, raidSpecialty.key, "attackPower");
    const defensePowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER4.defensePowerPenaltyPct, raidSpecialty.key, "defensePower");
    const influenceLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.influencePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER4.influencePenaltyPctMax - POLICE_RAID_TIER4.influencePenaltyPctMin + 1)
    ), raidSpecialty.key, "influence");
    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);

    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;
    economy.drugInventory = drugInventory;
    economy.drugs = totalDrugs;
    economy.influence = nextInfluence;
    economy.weapons = getAttackWeaponTotal(nextAttackWeapons);
    economy.weaponsDetail = { ...nextAttackWeapons };
    economy.defense = getDefenseWeaponTotal(nextDefenseWeapons);
    economy.defenseDetail = { ...nextDefenseWeapons };
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const arrestsPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.arrestsPctMin
      + Math.random() * (POLICE_RAID_TIER4.arrestsPctMax - POLICE_RAID_TIER4.arrestsPctMin + 1)
    ), raidSpecialty.key, "arrests");
    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const labProductionPenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.labProductionPenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER4.labProductionPenaltyPctMax - POLICE_RAID_TIER4.labProductionPenaltyPctMin + 1)
    ), raidSpecialty.key, "labProduction");
    const armoryProductionPenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER4.armoryProductionPenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER4.armoryProductionPenaltyPctMax - POLICE_RAID_TIER4.armoryProductionPenaltyPctMin + 1)
    ), raidSpecialty.key, "armoryProduction");

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("lab", labProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("armory", armoryProductionPenaltyPct, expiresAt);
    setPoliceRaidCombatPenalty(
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      expiresAt
    );
    setPoliceRaidBuildingActionLock("pharmacy_factory_special", expiresAt);

    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 4,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct,
      dirtyLoss,
      dirtyLossPct,
      drugLoss: totalDrugLoss,
      drugLossPct,
      arrested,
      arrestsPct,
      attackWeaponLoss,
      attackWeaponLossPct,
      defenseWeaponLoss,
      defenseWeaponLossPct,
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      influenceLoss,
      influenceLossPct,
      labProductionPenaltyPct,
      armoryProductionPenaltyPct,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true,
      raidBlocked: true,
      attackBlocked: true,
      occupyBlocked: true,
      pharmacyFactorySpecialBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 4: income -${incomePenaltyPct}%, `
      + `clean -${cleanLossPct}% ($${cleanLoss}), dirty -${dirtyLossPct}% ($${dirtyLoss}), `
      + `drogy -${drugLossPct}% (${totalDrugLoss}), zatčeno ${arrested} (${arrestsPct}%), `
      + `út. zbraně -${attackWeaponLossPct}% (${attackWeaponLoss}), `
      + `obr. zbraně -${defenseWeaponLossPct}% (${defenseWeaponLoss}), `
      + `síla útok -${attackPowerPenaltyPct}%, síla obrana -${defensePowerPenaltyPct}%, `
      + `vliv -${influenceLossPct}% (${influenceLoss}), lab/drug -${labProductionPenaltyPct}%, zbrojovka -${armoryProductionPenaltyPct}%.`
    );
    return impactRecord;
  }

  function applyPoliceRaidTier5Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 5);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const cleanLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.cleanConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER5.cleanConfiscationPctMax - POLICE_RAID_TIER5.cleanConfiscationPctMin + 1)
    ), raidSpecialty.key, "clean");
    const dirtyLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.dirtyConfiscationPctMin
      + Math.random() * (POLICE_RAID_TIER5.dirtyConfiscationPctMax - POLICE_RAID_TIER5.dirtyConfiscationPctMin + 1)
    ), raidSpecialty.key, "dirty");
    const incomePenaltyPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.incomePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER5.incomePenaltyPctMax - POLICE_RAID_TIER5.incomePenaltyPctMin + 1)
    ), raidSpecialty.key, "income");
    const drugLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.drugLossPctMin
      + Math.random() * (POLICE_RAID_TIER5.drugLossPctMax - POLICE_RAID_TIER5.drugLossPctMin + 1)
    ), raidSpecialty.key, "drugs");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanLossPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyLossPct / 100));
    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);

    const materialLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.materialLossPct, raidSpecialty.key, "materials");
    const materialLossResult = applyPoliceRaidMaterialConfiscation(economy, materialLossPct);

    const drugInventory = economy.drugInventory && typeof economy.drugInventory === "object"
      ? { ...economy.drugInventory }
      : {};
    let totalDrugLoss = 0;
    storageDrugTypes.forEach((drug) => {
      const current = Math.max(0, Math.floor(Number(drugInventory[drug.key] || 0)));
      const loss = Math.max(0, Math.floor(current * drugLossPct / 100));
      if (loss > 0) {
        drugInventory[drug.key] = Math.max(0, current - loss);
        totalDrugLoss += loss;
      } else {
        drugInventory[drug.key] = current;
      }
    });
    const totalDrugs = storageDrugTypes.reduce((sum, drug) => sum + Number(drugInventory[drug.key] || 0), 0);

    const currentAttackWeapons = resolveWeaponCounts();
    const nextAttackWeapons = { ...currentAttackWeapons };
    let attackWeaponLoss = 0;
    attackWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextAttackWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * scalePoliceRaidLossPct(POLICE_RAID_TIER5.attackWeaponLossPct, raidSpecialty.key, "attackWeapons") / 100));
      if (loss > 0) {
        nextAttackWeapons[item.name] = Math.max(0, current - loss);
        attackWeaponLoss += loss;
      } else {
        nextAttackWeapons[item.name] = current;
      }
    });
    if (attackWeaponLoss > 0) persistWeaponCounts(nextAttackWeapons);

    const currentDefenseWeapons = resolveDefenseCounts();
    const nextDefenseWeapons = { ...currentDefenseWeapons };
    let defenseWeaponLoss = 0;
    defenseWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextDefenseWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * scalePoliceRaidLossPct(POLICE_RAID_TIER5.defenseWeaponLossPct, raidSpecialty.key, "defenseWeapons") / 100));
      if (loss > 0) {
        nextDefenseWeapons[item.name] = Math.max(0, current - loss);
        defenseWeaponLoss += loss;
      } else {
        nextDefenseWeapons[item.name] = current;
      }
    });
    if (defenseWeaponLoss > 0) persistDefenseCounts(nextDefenseWeapons);

    const attackWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.attackWeaponLossPct, raidSpecialty.key, "attackWeapons");
    const defenseWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.defenseWeaponLossPct, raidSpecialty.key, "defenseWeapons");
    const attackPowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.attackPowerPenaltyPct, raidSpecialty.key, "attackPower");
    const defensePowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.defensePowerPenaltyPct, raidSpecialty.key, "defensePower");
    const influenceLossPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.influencePenaltyPctMin
      + Math.random() * (POLICE_RAID_TIER5.influencePenaltyPctMax - POLICE_RAID_TIER5.influencePenaltyPctMin + 1)
    ), raidSpecialty.key, "influence");
    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);

    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;
    economy.drugInventory = drugInventory;
    economy.drugs = totalDrugs;
    economy.influence = nextInfluence;
    economy.weapons = getAttackWeaponTotal(nextAttackWeapons);
    economy.weaponsDetail = { ...nextAttackWeapons };
    economy.defense = getDefenseWeaponTotal(nextDefenseWeapons);
    economy.defenseDetail = { ...nextDefenseWeapons };
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const arrestsPct = scalePoliceRaidLossPct(Math.floor(
      POLICE_RAID_TIER5.arrestsPctMin
      + Math.random() * (POLICE_RAID_TIER5.arrestsPctMax - POLICE_RAID_TIER5.arrestsPctMin + 1)
    ), raidSpecialty.key, "arrests");
    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    const labProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.productionFreezePct, raidSpecialty.key, "labProduction");
    const armoryProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.productionFreezePct, raidSpecialty.key, "armoryProduction");
    const factoryProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER5.productionFreezePct, raidSpecialty.key, "factoryProduction");
    setPoliceRaidProductionPenalty("lab", labProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("armory", armoryProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("factory", factoryProductionPenaltyPct, expiresAt);
    setPoliceRaidCombatPenalty(
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      expiresAt
    );
    setPoliceRaidBuildingActionLock("pharmacy_factory_special", expiresAt);
    setPoliceRaidBuildingActionLock("all_special_buildings", expiresAt);

    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 5,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct,
      dirtyLoss,
      dirtyLossPct,
      materialLoss: materialLossResult.totalLoss,
      materialLossPct: materialLossPct,
      drugLoss: totalDrugLoss,
      drugLossPct,
      arrested,
      arrestsPct,
      attackWeaponLoss,
      attackWeaponLossPct,
      defenseWeaponLoss,
      defenseWeaponLossPct,
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      influenceLoss,
      influenceLossPct,
      labProductionPenaltyPct,
      armoryProductionPenaltyPct,
      factoryProductionPenaltyPct,
      productionFrozen: labProductionPenaltyPct >= 100 && armoryProductionPenaltyPct >= 100 && factoryProductionPenaltyPct >= 100,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true,
      raidBlocked: true,
      attackBlocked: true,
      occupyBlocked: true,
      pharmacyFactorySpecialBlocked: true,
      allSpecialBuildingsBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 5: income -${incomePenaltyPct}%, `
      + `clean -${cleanLossPct}% ($${cleanLoss}), dirty -${dirtyLossPct}% ($${dirtyLoss}), `
      + `materiály -${materialLossPct}% (${materialLossResult.totalLoss}), `
      + `drogy -${drugLossPct}% (${totalDrugLoss}), zatčeno ${arrested} (${arrestsPct}%), `
      + `út. zbraně -${attackWeaponLossPct}% (${attackWeaponLoss}), `
      + `obr. zbraně -${defenseWeaponLossPct}% (${defenseWeaponLoss}), `
      + `síla útok -${attackPowerPenaltyPct}%, síla obrana -${defensePowerPenaltyPct}%, `
      + `vliv -${influenceLossPct}% (${influenceLoss}), lab -${labProductionPenaltyPct}%, zbrojovka -${armoryProductionPenaltyPct}%, továrna -${factoryProductionPenaltyPct}%.`
    );
    return impactRecord;
  }

  function applyPoliceRaidTier6Impacts(detail, district) {
    const impactKey = buildPoliceRaidImpactKey(detail);
    if (!impactKey || appliedPoliceRaidImpactKeys.has(impactKey)) return null;
    appliedPoliceRaidImpactKeys.add(impactKey);

    const currentProfile = cachedProfile || window.Empire.player || {};
    const raidSpecialty = resolvePoliceRaidImpactSpecialty(detail, 6);
    const economy = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economy || {});
    const incomePenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.incomePenaltyPct, raidSpecialty.key, "income");
    const cleanLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.cleanConfiscationPct, raidSpecialty.key, "clean");
    const dirtyLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.dirtyConfiscationPct, raidSpecialty.key, "dirty");
    const drugLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.drugLossPct, raidSpecialty.key, "drugs");
    const materialLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.materialLossPct, raidSpecialty.key, "materials");
    const attackWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.attackWeaponLossPct, raidSpecialty.key, "attackWeapons");
    const defenseWeaponLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.defenseWeaponLossPct, raidSpecialty.key, "defenseWeapons");
    const attackPowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.attackPowerPenaltyPct, raidSpecialty.key, "attackPower");
    const defensePowerPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.defensePowerPenaltyPct, raidSpecialty.key, "defensePower");
    const influenceLossPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.influencePenaltyPct, raidSpecialty.key, "influence");
    const arrestsPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.arrestsPct, raidSpecialty.key, "arrests");
    const cleanLoss = Math.max(0, Math.floor(money.cleanMoney * cleanLossPct / 100));
    const dirtyLoss = Math.max(0, Math.floor(money.dirtyMoney * dirtyLossPct / 100));
    money.cleanMoney = Math.max(0, money.cleanMoney - cleanLoss);
    money.dirtyMoney = Math.max(0, money.dirtyMoney - dirtyLoss);

    const materialLossResult = applyPoliceRaidMaterialConfiscation(economy, materialLossPct);

    const drugInventory = economy.drugInventory && typeof economy.drugInventory === "object"
      ? { ...economy.drugInventory }
      : {};
    let totalDrugLoss = 0;
    storageDrugTypes.forEach((drug) => {
      const current = Math.max(0, Math.floor(Number(drugInventory[drug.key] || 0)));
      const loss = Math.max(0, Math.floor(current * drugLossPct / 100));
      if (loss > 0) {
        drugInventory[drug.key] = Math.max(0, current - loss);
        totalDrugLoss += loss;
      } else {
        drugInventory[drug.key] = current;
      }
    });
    const totalDrugs = storageDrugTypes.reduce((sum, drug) => sum + Number(drugInventory[drug.key] || 0), 0);

    const currentAttackWeapons = resolveWeaponCounts();
    const nextAttackWeapons = { ...currentAttackWeapons };
    let attackWeaponLoss = 0;
    attackWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextAttackWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * attackWeaponLossPct / 100));
      if (loss > 0) {
        nextAttackWeapons[item.name] = Math.max(0, current - loss);
        attackWeaponLoss += loss;
      } else {
        nextAttackWeapons[item.name] = current;
      }
    });
    if (attackWeaponLoss > 0) persistWeaponCounts(nextAttackWeapons);

    const currentDefenseWeapons = resolveDefenseCounts();
    const nextDefenseWeapons = { ...currentDefenseWeapons };
    let defenseWeaponLoss = 0;
    defenseWeaponStats.forEach((item) => {
      const current = Math.max(0, Math.floor(Number(nextDefenseWeapons[item.name] || 0)));
      const loss = Math.max(0, Math.floor(current * defenseWeaponLossPct / 100));
      if (loss > 0) {
        nextDefenseWeapons[item.name] = Math.max(0, current - loss);
        defenseWeaponLoss += loss;
      } else {
        nextDefenseWeapons[item.name] = current;
      }
    });
    if (defenseWeaponLoss > 0) persistDefenseCounts(nextDefenseWeapons);

    const currentInfluence = Math.max(0, Math.floor(Number(economy.influence || 0)));
    const influenceLoss = Math.max(0, Math.floor(currentInfluence * influenceLossPct / 100));
    const nextInfluence = Math.max(0, currentInfluence - influenceLoss);

    economy.cleanMoney = money.cleanMoney;
    economy.dirtyMoney = money.dirtyMoney;
    economy.balance = money.cleanMoney + money.dirtyMoney;
    economy.drugInventory = drugInventory;
    economy.drugs = totalDrugs;
    economy.influence = nextInfluence;
    economy.weapons = getAttackWeaponTotal(nextAttackWeapons);
    economy.weaponsDetail = { ...nextAttackWeapons };
    economy.defense = getDefenseWeaponTotal(nextDefenseWeapons);
    economy.defenseDetail = { ...nextDefenseWeapons };
    updateEconomy(economy);

    updateProfile({
      ...currentProfile,
      influence: nextInfluence
    });

    const population = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(currentProfile)) || 0));
    const arrested = Math.max(0, Math.floor(population * arrestsPct / 100));
    if (arrested > 0) consumeGangMembers(arrested);

    const expiresAt = Math.max(0, Math.floor(Number(detail?.startedAt || 0) + Number(detail?.durationMs || GANG_HEAT_POLICE_DURATION_MS)));
    const labProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.productionFreezePct, raidSpecialty.key, "labProduction");
    const armoryProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.productionFreezePct, raidSpecialty.key, "armoryProduction");
    const factoryProductionPenaltyPct = scalePoliceRaidLossPct(POLICE_RAID_TIER6.productionFreezePct, raidSpecialty.key, "factoryProduction");
    setPoliceRaidIncomePenaltyForOwnedDistricts(incomePenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("lab", labProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("armory", armoryProductionPenaltyPct, expiresAt);
    setPoliceRaidProductionPenalty("factory", factoryProductionPenaltyPct, expiresAt);
    setPoliceRaidBuildingActionLock("pharmacy_factory_special", expiresAt);
    setPoliceRaidBuildingActionLock("all_special_buildings", expiresAt);
    setPoliceRaidBuildingActionLock("all_actions_blocked", expiresAt);
    setPoliceRaidCombatPenalty(
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      expiresAt
    );

    const impactRecord = {
      key: impactKey,
      districtId: Number(district?.id),
      startedAt: Math.max(0, Math.floor(Number(detail?.startedAt) || Date.now())),
      expiresAt,
      tier: 6,
      incomePenaltyPct,
      cleanLoss,
      cleanLossPct,
      dirtyLoss,
      dirtyLossPct,
      materialLoss: materialLossResult.totalLoss,
      materialLossPct,
      drugLoss: totalDrugLoss,
      drugLossPct,
      arrested,
      arrestsPct,
      attackWeaponLoss,
      attackWeaponLossPct,
      defenseWeaponLoss,
      defenseWeaponLossPct,
      attackPowerPenaltyPct,
      defensePowerPenaltyPct,
      influenceLoss,
      influenceLossPct,
      labProductionPenaltyPct,
      armoryProductionPenaltyPct,
      factoryProductionPenaltyPct,
      productionFrozen: labProductionPenaltyPct >= 100 && armoryProductionPenaltyPct >= 100 && factoryProductionPenaltyPct >= 100,
      raidSpecialtyKey: raidSpecialty.key,
      raidSpecialtyLabel: raidSpecialty.label,
      spyBlocked: true,
      raidBlocked: true,
      attackBlocked: true,
      occupyBlocked: true,
      pharmacyFactorySpecialBlocked: true,
      allSpecialBuildingsBlocked: true,
      allActionsBlocked: true
    };
    getPoliceRaidImpactMap().set(impactKey, impactRecord);
    pushEvent(
      `Razia (${district?.name || `#${district?.id}`}) - Tier 6: income -${incomePenaltyPct}%, clean -${cleanLossPct}%, `
      + `dirty -${dirtyLossPct}%, materiály -${materialLossPct}%, `
      + `drogy -${drugLossPct}%, zatčeno ${arrested} (${arrestsPct}%), `
      + `út. zbraně -${attackWeaponLossPct}%, obr. zbraně -${defenseWeaponLossPct}%, `
      + `síla útok -${attackPowerPenaltyPct}%, síla obrana -${defensePowerPenaltyPct}%, `
      + `vliv -${influenceLossPct}%, lab -${labProductionPenaltyPct}%, zbrojovka -${armoryProductionPenaltyPct}%, továrna -${factoryProductionPenaltyPct}%.`
    );
    return impactRecord;
  }

  function isDistrictUnownedForSpyOutcome(district) {
    const owner = String(district?.owner || "").trim().toLowerCase();
    if (!owner) return true;
    return owner === "neobsazeno" || owner === "nikdo";
  }

  function districtHasSecurityCameras(district) {
    if (!district?.id || isDistrictUnownedForSpyOutcome(district)) return false;
    const store = readLocalDistrictDefenseAssignments();
    const districtStore = store[String(district.id)] && typeof store[String(district.id)] === "object"
      ? store[String(district.id)]
      : {};
    const ownerKey = normalizeOwnerName(district?.owner);
    const ownerEntry = ownerKey && districtStore[ownerKey] && typeof districtStore[ownerKey] === "object"
      ? districtStore[ownerKey]
      : null;
    const weaponCounts = ownerEntry?.weaponCounts && typeof ownerEntry.weaponCounts === "object"
      ? ownerEntry.weaponCounts
      : {};
    return Math.max(0, Math.floor(Number(weaponCounts["Bezpečnostní kamery"] || 0))) > 0;
  }

  function resolveRaidOutcomeChances(district) {
    const base = isDistrictUnownedForSpyOutcome(district)
      ? { clean_success: 78, dirty_fail: 18, disaster: 4 }
      : { clean_success: 70, dirty_fail: 20, disaster: 10 };
    if (!districtHasSecurityCameras(district)) return base;
    const remaining = 75;
    const nonDisasterBase = Math.max(1, base.clean_success + base.dirty_fail);
    const clean = (base.clean_success / nonDisasterBase) * remaining;
    const dirty = remaining - clean;
    return {
      clean_success: clean,
      dirty_fail: dirty,
      disaster: 25
    };
  }

  function resolveRaidOutcomeKey(district) {
    if (isOnboardingDemoScenarioActive()) {
      return "clean_success";
    }
    const chances = { ...resolveRaidOutcomeChances(district) };
    const defenseSpecial = resolveDistrictDefenseSpecialModifiers(district?.id);
    if (defenseSpecial.raidAlarmBoostActive) {
      const cleanPenalty = Math.min(chances.clean_success - 5, 25);
      chances.clean_success = Math.max(5, chances.clean_success - cleanPenalty);
      chances.dirty_fail += 5;
      chances.disaster += cleanPenalty - 5;
    }
    const roll = Math.random() * 100;
    if (roll < chances.clean_success) return "clean_success";
    if (roll < chances.clean_success + chances.dirty_fail) return "dirty_fail";
    return "disaster";
  }

  function resolveEmptyDistrictRaidStash(district) {
    const buildingCount = Math.max(1, (Array.isArray(district?.buildings) ? district.buildings.length : 0) || 1);
    const tierWeight = resolveOccupationTierRarityWeight(district?.buildingTier);
    const seed = Math.abs(hashDistrictSeed(`raid-empty:${district?.id}:${district?.type || ""}`));
    const materialBase = 24 + buildingCount * 12 + Math.round(tierWeight * 60) + (seed % 16);
    return {
      metal_parts: Math.max(12, Math.floor(materialBase * 0.55)),
      tech_core: Math.max(6, Math.floor(materialBase * 0.28)),
      combat_module: Math.max(1, Math.floor(materialBase * 0.08))
    };
  }

  function applyRaidLootToPlayer(loot = {}) {
    const applied = {};
    Object.entries(loot || {}).forEach(([resourceKey, amount]) => {
      const gained = addEconomyResource(resourceKey, amount);
      if (gained > 0) applied[resourceKey] = gained;
    });
    return applied;
  }

  function formatRaidLootLabel(loot = {}) {
    const labels = {
      metal_parts: "MP",
      tech_core: "TC",
      combat_module: "CM",
      materials: "MAT",
      drugs: "DRG",
      weapons: "WPN"
    };
    const parts = Object.entries(loot)
      .map(([resourceKey, amount]) => {
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
        if (safeAmount <= 0) return "";
        return `${labels[resourceKey] || resourceKey} ${safeAmount}`;
      })
      .filter(Boolean);
    return parts.length ? parts.join(" • ") : "Nic";
  }

  function applyRaidGangLoss(lossPct) {
    const totalMembers = Math.max(0, Math.floor(Number(countPlayerControlledPopulation(cachedProfile || window.Empire.player || {})) || 0));
    const loss = Math.max(0, Math.floor(totalMembers * Math.max(0, Number(lossPct) || 0) / 100));
    if (loss > 0) {
      consumeGangMembers(loss);
    }
    return loss;
  }

  function buildRaidResultPayload({ district, outcomeKey, loot, cooldownMs, gangLoss, targetAlerted }) {
    const districtLabel = district?.name || `Distrikt #${district?.id ?? "-"}`;
    if (outcomeKey === "clean_success") {
      return {
        tone: "is-clean-success",
        title: "ČISTÁ KRÁDEŽ",
        summary: "Vlezli jste tam, sebrali co šlo a zmizeli jak duchové. Ani kurva nevěděli, že tam někdo byl. Prachy jsou tvoje.",
        rows: [
          { label: "Cíl", value: districtLabel },
          { label: "Získáno", value: formatRaidLootLabel(loot) },
          { label: "Trvání", value: formatAttackDurationLabel(resolveRaidDurationWithBoosts()) },
          { label: "Cooldown", value: formatRaidCooldownLabel(cooldownMs) }
        ]
      };
    }
    if (outcomeKey === "dirty_fail") {
      return {
        tone: "is-dirty-fail",
        title: "ŠPINAVÁ KRÁDEŽ",
        summary: "Vzali jste lup ale nebylo to čistý. Trochu krve, trochu bordelu. Něco jsi nechal na místě, ale pořád jsi v plusu.",
        rows: [
          { label: "Cíl", value: districtLabel },
          { label: "Ztráta členů", value: `${gangLoss}` },
          { label: "Cooldown", value: formatRaidCooldownLabel(cooldownMs) },
          { label: "Zisk", value: formatRaidLootLabel(loot) }
        ]
      };
    }
    return {
      tone: targetAlerted ? "is-alert" : "is-disaster",
      title: "PRŮSER",
      summary: "Posrali jste to. Chytili vás při činu, někdo to odnesl a zbytek zdrhal jak krysy. Nemáš nic, jen ostudu a ztráty.",
      rows: [
        { label: "Cíl", value: districtLabel },
        { label: "Ztráta členů", value: `${gangLoss}` },
        { label: "Cooldown", value: formatRaidCooldownLabel(cooldownMs) },
        { label: "Upozornění cíle", value: targetAlerted ? "Ano" : "Ne" }
      ]
    };
  }

  function maybeShowRaidTargetAlert(district) {
    const targetOwner = normalizeOwnerName(district?.owner);
    const playerOwners = getPlayerOwnerNameSet();
    if (!targetOwner || !playerOwners.has(targetOwner)) return false;
    openRaidResultModal({
      tone: "is-alert",
      title: "Pokus o krádež",
      summary: `Někdo se pokusil vykrást tvůj distrikt ${district?.name || `#${district?.id ?? "-"}`}.`,
      rows: [
        { label: "District", value: district?.name || `#${district?.id ?? "-"}` },
        { label: "Stav", value: "Pokus odhalen" }
      ]
    });
    return true;
  }

  function finalizeRaidActionResult({ districtId, durationMs }) {
    raidActionTimeoutId = null;
    raidActionState = { districtId: null, startedAt: 0, endsAt: 0 };
    window.Empire.Map?.clearRaidActions?.();

    const district = resolveDistrictById(districtId);
    if (!district) return;
    const outcomeKey = resolveRaidOutcomeKey(district);
    let cooldownMs = RAID_BASE_COOLDOWN_MS;
    let loot = {};
    let cleanLoot = {};
    let gangLoss = 0;
    let targetAlerted = false;

    if (isDistrictUnownedForSpyOutcome(district)) {
      const nextLoot = {};
      updateDistrictRaidStash(district, (current) => {
        const next = { ...current };
        Object.entries(current).forEach(([resourceKey, amount]) => {
          const available = Math.max(0, Math.floor(Number(amount || 0)));
          const stolen = available > 0
            ? Math.min(available, Math.max(1, Math.floor(available * 0.25)))
            : 0;
          if (stolen > 0) {
            nextLoot[resourceKey] = stolen;
            next[resourceKey] = Math.max(0, available - stolen);
          }
        });
        return next;
      });
      cleanLoot = nextLoot;
    } else {
      const nextLoot = {};
      const stealPct = 2 + Math.floor(Math.random() * 5);
      updateOwnerRaidInventory(district.owner, (current) => {
        const next = { ...current };
        ["metal_parts", "tech_core", "combat_module", "drugs", "weapons"].forEach((resourceKey) => {
          const available = Math.max(0, Math.floor(Number(current[resourceKey] || 0)));
          const stolen = available > 0
            ? Math.min(available, Math.max(1, Math.floor(available * (stealPct / 100))))
            : 0;
          if (stolen > 0) {
            nextLoot[resourceKey] = stolen;
            next[resourceKey] = Math.max(0, available - stolen);
          }
        });
        return next;
      });
      cleanLoot = nextLoot;
    }

    if (outcomeKey === "clean_success") {
      loot = cleanLoot;
      applyRaidLootToPlayer(loot);
      pushEvent(`Krádež v districtu ${district.name || `#${district.id}`} dopadla čistě. Zisk: ${formatRaidLootLabel(loot)}.`);
    } else if (outcomeKey === "dirty_fail") {
      const dirtyPct = 20 + Math.floor(Math.random() * 11);
      loot = Object.entries(cleanLoot).reduce((acc, [resourceKey, amount]) => {
        const baseAmount = Math.max(0, Math.floor(Number(amount || 0)));
        if (baseAmount <= 0) return acc;
        const dirtyAmount = Math.max(1, Math.floor(baseAmount * dirtyPct / 100));
        if (dirtyAmount > 0) acc[resourceKey] = dirtyAmount;
        return acc;
      }, {});
      if (Object.keys(loot).length) {
        applyRaidLootToPlayer(loot);
      }
      cooldownMs = Math.round(RAID_BASE_COOLDOWN_MS * 1.2);
      gangLoss = applyRaidGangLoss(2.5);
      pushEvent(`Špinavá krádež v districtu ${district.name || `#${district.id}`}. Zisk: ${formatRaidLootLabel(loot)}. Přišel jsi o ${gangLoss} členů gangu.`);
    } else {
      cooldownMs = Math.round(RAID_BASE_COOLDOWN_MS * 1.5);
      gangLoss = applyRaidGangLoss(5);
      targetAlerted = !isDistrictUnownedForSpyOutcome(district);
      if (targetAlerted) {
        maybeShowRaidTargetAlert(district);
      }
      pushEvent(`Krádež v districtu ${district.name || `#${district.id}`} skončila průserem. Ztráta členů: ${gangLoss}.`);
    }

    setRaidCooldownUntil(Date.now() + cooldownMs);
    setDistrictRaidLockUntil(district.id, Date.now() + DISTRICT_RAID_LOCK_MS);
    openRaidResultModal(buildRaidResultPayload({
      district,
      outcomeKey,
      loot,
      cooldownMs,
      gangLoss,
      targetAlerted
    }));
    document.dispatchEvent(new CustomEvent("empire:raid-resolved", {
      detail: {
        districtId: district.id,
        outcomeKey,
        loot,
        cooldownMs,
        gangLoss,
        targetAlerted,
        durationMs
      }
    }));
  }

  function startRaidAction(district) {
    if (!district) return;
    const durationMs = resolveRaidDurationWithBoosts();
    raidActionState = {
      districtId: district.id,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs
    };
    if (raidActionTimeoutId) {
      clearTimeout(raidActionTimeoutId);
    }
    raidActionTimeoutId = setTimeout(() => {
      finalizeRaidActionResult({ districtId: district.id, durationMs });
    }, durationMs);
    window.Empire.Map?.markDistrictRaidAction?.(district.id, {
      durationMs,
      source: "raid-action"
    });
    document.dispatchEvent(new CustomEvent("empire:raid-started", {
      detail: {
        districtId: district.id,
        district,
        durationMs
      }
    }));
    recordVerifiedIntelEvent({
      type: "raid_started",
      districtId: district.id
    });
    pushEvent(`Krádež v districtu ${district.name || `#${district.id}`} byla spuštěna. Trvání ${formatAttackDurationLabel(durationMs)}.`);
    const districtModal = document.getElementById("district-modal");
    if (districtModal) districtModal.classList.add("hidden");
  }

  function startRaidActionFromServerResult(district, result = {}) {
    if (!district) return;
    const durationMs = Math.max(1000, Math.floor(Number(result?.durationMs || RAID_ACTION_DURATION_MS)));
    const cooldownMs = Math.max(0, Math.floor(Number(result?.cooldownMs || 0)));
    const postActionCooldownMs = Math.max(0, Math.floor(Number(result?.postActionCooldownMs || 0)));
    const districtLockMs = Math.max(0, Math.floor(Number(result?.districtLockMs || DISTRICT_RAID_LOCK_MS)));
    const outcomeKey = String(result?.outcomeKey || "disaster").trim().toLowerCase();
    const loot = result?.loot && typeof result.loot === "object" ? result.loot : {};
    const gangLoss = Math.max(0, Math.floor(Number(result?.gangLoss || 0)));
    const targetAlerted = Boolean(result?.targetAlerted);

    raidActionState = {
      districtId: district.id,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs
    };
    if (raidActionTimeoutId) {
      clearTimeout(raidActionTimeoutId);
      raidActionTimeoutId = null;
    }

    window.Empire.Map?.markDistrictRaidAction?.(district.id, {
      durationMs,
      source: "raid-action"
    });
    document.dispatchEvent(new CustomEvent("empire:raid-started", {
      detail: {
        districtId: district.id,
        district,
        durationMs
      }
    }));
    recordVerifiedIntelEvent({
      type: "raid_started",
      districtId: district.id
    });
    pushEvent(`Krádež v districtu ${district.name || `#${district.id}`} byla spuštěna. Trvání ${formatAttackDurationLabel(durationMs)}.`);

    if (gangLoss > 0) {
      const currentLosses = Math.max(
        0,
        Math.floor(
          Number(
            cachedProfile?.raidMemberLosses
            ?? cachedProfile?.raid_member_losses
            ?? window.Empire.player?.raidMemberLosses
            ?? window.Empire.player?.raid_member_losses
            ?? 0
          ) || 0
        )
      );
      const nextLosses = currentLosses + gangLoss;
      if (cachedProfile && typeof cachedProfile === "object") {
        cachedProfile.raidMemberLosses = nextLosses;
        cachedProfile.raid_member_losses = nextLosses;
      }
      window.Empire.player = {
        ...(window.Empire.player || {}),
        raidMemberLosses: nextLosses,
        raid_member_losses: nextLosses
      };
      refreshProfilePopulation();
    }

    setRaidCooldownUntil(Date.now() + cooldownMs);
    setDistrictRaidLockUntil(district.id, Date.now() + districtLockMs);

    raidActionTimeoutId = setTimeout(() => {
      raidActionTimeoutId = null;
      raidActionState = { districtId: null, startedAt: 0, endsAt: 0 };
      window.Empire.Map?.clearRaidActions?.();
      openRaidResultModal(buildRaidResultPayload({
        district,
        outcomeKey,
        loot,
        cooldownMs: postActionCooldownMs || cooldownMs,
        gangLoss,
        targetAlerted
      }));
      document.dispatchEvent(new CustomEvent("empire:raid-resolved", {
        detail: {
          districtId: district.id,
          outcomeKey,
          loot,
          cooldownMs,
          postActionCooldownMs,
          districtLockMs,
          gangLoss,
          targetAlerted,
          durationMs
        }
      }));
    }, durationMs);

    const districtModal = document.getElementById("district-modal");
    if (districtModal) districtModal.classList.add("hidden");
  }

  function resolveOccupationTierRarityWeight(tierValue) {
    return getCombatHelperController()?.resolveOccupationTierRarityWeight?.(tierValue) || 0.4;
  }

  function resolveOccupationRequiredMembers(district, spyIntel = null) {
    return getCombatHelperController()?.resolveOccupationRequiredMembers?.(district, spyIntel) || 50;
  }

  function resolvePlayerDistrictOwnerLabel() {
    return getPlayerOwnerMetaHelpers()?.resolvePlayerDistrictOwnerLabel?.()
      || "Tvůj gang";
  }

  function resolvePlayerDistrictOwnerColor() {
    return getPlayerOwnerMetaHelpers()?.resolvePlayerDistrictOwnerColor?.() || "";
  }

  function resolvePlayerAllianceVisualMeta() {
    return getAllianceVisionHelpers()?.resolvePlayerAllianceVisualMeta?.() || { name: null, iconKey: null };
  }

  function claimDistrictForPlayer(district) {
    return getPlayerOwnerMetaHelpers()?.claimDistrictForPlayer?.(district);
  }

  function rollSpyOutcome(district) {
    return getCombatHelperController()?.rollSpyOutcome?.(district) || {
      key: "major_fail",
      chances: { success: 0, mediumFail: 0, majorFail: 100 }
    };
  }

  function resolveSpyDefensePenalty(districtId) {
    return getCombatHelperController()?.resolveSpyDefensePenalty?.(districtId) || {
      securityCameraCount: 0,
      alarmSystemCount: 0,
      successPenalty: 0,
      majorShift: 0
    };
  }

  function estimateSpyDefenseIntel(district) {
    return getCombatHelperController()?.estimateSpyDefenseIntel?.(district) || {
      weapons: 0,
      powerEstimate: 0,
      powerRangeLabel: "0 až 0"
    };
  }

  function resolveDistrictAtmosphereForSpy(district) {
    return getCombatHelperController()?.resolveDistrictAtmosphereForSpy?.(district) || "Neznámá";
  }

  function buildSpyIntelPayload(district) {
    return getCombatHelperController()?.buildSpyIntelPayload?.(district) || {
      weapons: 0,
      powerRangeLabel: "0 až 0",
      buildings: [],
      districtType: "Neznámý",
      atmosphere: "Neznámá",
      createdAt: Date.now()
    };
  }

  function buildPartialSpyIntelPayload(district) {
    return getCombatHelperController()?.buildPartialSpyIntelPayload?.(district) || {
      weapons: null,
      powerRangeLabel: null,
      districtType: null,
      atmosphere: null,
      buildings: [],
      knownFields: {
        weapons: false,
        powerRangeLabel: false,
        districtType: false,
        atmosphere: false,
        buildings: false
      },
      createdAt: Date.now()
    };
  }

  function buildSpySuccessDetailsMarkup(intel) {
    return getCombatHelperController()?.buildSpySuccessDetailsMarkup?.(intel) || "";
  }

  function resolveSpySuccessSummary(district) {
    return getCombatHelperController()?.resolveSpySuccessSummary?.(district)
      || `Špehování distriktu ${district?.name || `Distrikt #${district?.id ?? "-"}`} dopadlo úspěšně.`;
  }

  function resolveSpyMediumFailSummary(district) {
    return getCombatHelperController()?.resolveSpyMediumFailSummary?.(district)
      || `Akce v ${district?.name || `Distrikt #${district?.id ?? "-"}`} nedopadla dobře, ale tvůj špeh se vrátil.`;
  }

  function resolveSpyMajorFailSummary(district) {
    return getCombatHelperController()?.resolveSpyMajorFailSummary?.(district)
      || `Špeh byl v districtu ${district?.name || `Distrikt #${district?.id ?? "-"}`} zajat. Ve zdroji je zamčen na 60 sekund.`;
  }

  function isResultModalVisible() {
    const roots = [
      document.getElementById("spy-result-modal"),
      document.getElementById("spy-warning-modal"),
      document.getElementById("raid-result-modal"),
      document.getElementById("attack-result-modal"),
      document.getElementById("police-action-result-modal")
    ];
    return roots.some((root) => Boolean(root && !root.classList.contains("hidden")));
  }

  function renderNextPendingResultModal() {
    if (!pendingResultModalQueue.length) return;
    const next = pendingResultModalQueue.shift();
    if (!next || typeof next !== "object") return;
    if (next.kind === "occupy") {
      renderOccupationResultModal(next.payload);
      return;
    }
    if (next.kind === "attack") {
      openAttackResultModal(next.payload);
      return;
    }
    if (next.kind === "raid") {
      openRaidResultModal(next.payload);
      return;
    }
    if (next.kind === "spy_alert") {
      openSpyDetectionAlertModal(next.payload);
      return;
    }
    if (next.kind === "police") {
      openPoliceActionResultModal(next.payload);
      return;
    }
    openSpyResultModal(next.payload);
  }

  function closeSpyResultModal() {
    const root = document.getElementById("spy-result-modal");
    if (root) root.classList.add("hidden");
    if (suppressResultModalQueueAdvance) return;
    if (!pendingResultModalQueue.length) return;
    setTimeout(() => {
      renderNextPendingResultModal();
    }, 80);
  }

  function closeSpyDetectionAlertModal() {
    const root = document.getElementById("spy-warning-modal");
    if (root) root.classList.add("hidden");
    if (suppressResultModalQueueAdvance) return;
    if (!pendingResultModalQueue.length) return;
    setTimeout(() => {
      renderNextPendingResultModal();
    }, 80);
  }

  function renderSpyResultModal({ outcomeKey, district, chances, spyIntel = null }) {
    const root = document.getElementById("spy-result-modal");
    const content = document.getElementById("spy-result-modal-content");
    const title = document.getElementById("spy-result-modal-title");
    const summary = document.getElementById("spy-result-modal-summary");
    const details = document.getElementById("spy-result-modal-details");
    if (!root || !content || !title || !summary || !details) return;

    const districtName = district?.name || `Distrikt #${district?.id ?? "-"}`;
    content.classList.remove("is-success", "is-medium-fail", "is-major-fail");

    if (outcomeKey === "success") {
      content.classList.add("is-success");
      title.textContent = "Špehování: Úspěch";
      summary.textContent = resolveSpySuccessSummary(district);
      details.innerHTML = buildSpySuccessDetailsMarkup(spyIntel);
    } else if (outcomeKey === "medium_fail") {
      content.classList.add("is-medium-fail");
      title.textContent = "Špehování: Částečný neúspěch";
      summary.textContent = resolveSpyMediumFailSummary(district);
      details.innerHTML = `
        <div class="modal__row">
          <span>Stav špeha</span>
          <strong>Vrátil se</strong>
        </div>
        ${spyIntel ? buildSpySuccessDetailsMarkup(spyIntel) : ""}
      `;
    } else {
      content.classList.add("is-major-fail");
      title.textContent = "Špehování: Velký neúspěch";
      summary.textContent = resolveSpyMajorFailSummary(district);
      details.innerHTML = `
        <div class="modal__row">
          <span>Stav špeha</span>
          <strong>Zajat (60s)</strong>
        </div>
      `;
    }

    pushInfoWindowHistoryEntry({
      title: title.textContent || "Výsledek špehování",
      text: [
        summary.textContent || "",
        `Cíl: ${districtName}`
      ].filter(Boolean).join(" • ")
    });
    root.classList.remove("hidden");
  }

  function openSpyResultModal(payload) {
    if (isResultModalVisible()) {
      pendingResultModalQueue.push({ kind: "spy", payload });
      return;
    }
    renderSpyResultModal(payload);
  }

  function renderSpyDetectionAlertModal({
    district,
    summary,
    badgeLabel = "Vlastní district pod tlakem",
    alertKind = "player",
    attackerNick = "Neznámý hráč",
    attackerGang = "Neznámý gang",
    attackerAlliance = "Bez aliance",
    detectedAt = Date.now()
  }) {
    const root = document.getElementById("spy-warning-modal");
    const content = document.getElementById("spy-warning-modal-content");
    const title = document.getElementById("spy-warning-modal-title");
    const badge = document.getElementById("spy-warning-modal-badge");
    const summaryEl = document.getElementById("spy-warning-modal-summary");
    const details = document.getElementById("spy-warning-modal-details");
    if (!root || !content || !title || !badge || !summaryEl || !details) return;

    const districtName = district?.name || `Distrikt #${district?.id ?? "-"}`;
    const detectedAtLabel = formatSpyDetectionAlertTime(detectedAt);
    content.classList.remove("is-success", "is-medium-fail", "is-major-fail", "is-player-alert", "is-alliance-alert");
    content.classList.add(alertKind === "alliance" ? "is-alliance-alert" : "is-player-alert");
    title.textContent = "Upozornění: Neúspěšné špehování";
    badge.textContent = badgeLabel;
    summaryEl.textContent = String(summary || "").trim() || `Někdo se pokusil neúspěšně špehovat district ${districtName}. Špeha vyslal: ${attackerNick}.`;
    details.innerHTML = `
      <div class="modal__row">
        <span>Cíl</span>
        <strong>${districtName}</strong>
      </div>
      <div class="modal__row">
        <span>Odeslal špeha</span>
        <strong class="spy-warning-modal__identity spy-warning-modal__identity--nick">${attackerNick}</strong>
      </div>
      <div class="modal__row">
        <span>Gang útočníka</span>
        <strong class="spy-warning-modal__identity spy-warning-modal__identity--gang">${attackerGang}</strong>
      </div>
      <div class="modal__row">
        <span>Aliance útočníka</span>
        <strong class="spy-warning-modal__identity spy-warning-modal__identity--alliance">${attackerAlliance}</strong>
      </div>
      <div class="modal__row">
        <span>Čas zachycení</span>
        <strong>${detectedAtLabel}</strong>
      </div>
      <div class="modal__row">
        <span>Stav districtu</span>
        <strong>Špeh byl odhalen</strong>
      </div>
    `;

    pushInfoWindowHistoryEntry({
      title: title.textContent || "Upozornění na špehování",
      text: [
        summaryEl.textContent || "",
        `Cíl: ${districtName}`,
        `Útočník: ${attackerNick}`
      ].filter(Boolean).join(" • ")
    });
    root.classList.remove("hidden");
  }

  function openSpyDetectionAlertModal(payload) {
    if (isResultModalVisible()) {
      pendingResultModalQueue.push({ kind: "spy_alert", payload });
      return;
    }
    renderSpyDetectionAlertModal(payload);
  }

  function initSpyResultModal() {
    const root = document.getElementById("spy-result-modal");
    const backdrop = document.getElementById("spy-result-modal-backdrop");
    const closeBtn = document.getElementById("spy-result-modal-close");
    const okBtn = document.getElementById("spy-result-modal-ok");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", () => {
      if (shouldLockOnboardingResultModal()) return;
      closeSpyResultModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeSpyResultModal);
    if (okBtn) okBtn.addEventListener("click", closeSpyResultModal);
    document.addEventListener("keydown", (event) => {
      if (shouldLockOnboardingResultModal()) return;
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeSpyResultModal();
      }
    });
  }

  function initSpyDetectionAlertModal() {
    const root = document.getElementById("spy-warning-modal");
    const backdrop = document.getElementById("spy-warning-modal-backdrop");
    const closeBtn = document.getElementById("spy-warning-modal-close");
    const okBtn = document.getElementById("spy-warning-modal-ok");
    if (!root) return;
    if (backdrop) backdrop.addEventListener("click", closeSpyDetectionAlertModal);
    if (closeBtn) closeBtn.addEventListener("click", closeSpyDetectionAlertModal);
    if (okBtn) okBtn.addEventListener("click", closeSpyDetectionAlertModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeSpyDetectionAlertModal();
      }
    });
  }

  function notifyDistrictOwnerAboutSpyFailure(district) {
    if (!district || !district.owner || !isDistrictDefendableByPlayer(district)) return;
    const districtName = district?.name || `Distrikt #${district?.id ?? "-"}`;
    const isAllianceDistrict = isDistrictOwnedByAlliance(district);
    const detectedAt = Date.now();
    const attackerNick = resolveCurrentPlayerNick();
    const attackerGang = resolveCurrentPlayerGangName();
    const attackerAlliance = resolveCurrentPlayerAllianceName();
    const allianceName = String(
      district?.ownerAllianceName
      || district?.owner_alliance_name
      || resolvePlayerAllianceVisualMeta()?.name
      || "Aliance"
    ).trim() || "Aliance";
    const quotes = isAllianceDistrict
      ? SPY_ALLIANCE_DETECTION_WARNING_QUOTES
      : SPY_DETECTION_WARNING_QUOTES;
    const summary = quotes.length
      ? String(quotes[Math.floor(Math.random() * quotes.length)] || "")
        .replaceAll("[ALLY]", allianceName)
        .concat(` Špeha vyslal: ${attackerNick} • gang ${attackerGang} • aliance ${attackerAlliance}.`)
        .trim()
      : `Někdo se pokusil neúspěšně špehovat district ${districtName}. Špeha vyslal: ${attackerNick} • gang ${attackerGang} • aliance ${attackerAlliance}.`;
    pushEvent(
      isAllianceDistrict
        ? `Varování: ${allianceName} zachytila cizího špeha od ${attackerNick} (${attackerGang} / ${attackerAlliance}).`
        : `Varování: ${districtName} zachytil špeha od ${attackerNick} (${attackerGang} / ${attackerAlliance}).`
    );
    openSpyDetectionAlertModal({
      district,
      summary,
      badgeLabel: isAllianceDistrict ? `Aliance v ohrožení • ${allianceName}` : "Vlastní district pod tlakem",
      alertKind: isAllianceDistrict ? "alliance" : "player",
      attackerNick,
      attackerGang,
      attackerAlliance,
      detectedAt
    });
  }

  function finalizeSpyActionResult({ districtId }) {
    const district = resolveDistrictById(districtId);
    if (!district) return;
    const rolled = rollSpyOutcome(district);
    const outcomeKey = rolled.key;
    const demoMode = scenarioVisionEnabled && !window.Empire.token;
    let discoveredIntel = null;

    if (outcomeKey === "success") {
      discoveredIntel = setDistrictSpyIntel(
        district.id,
        buildSpyIntelPayload(district),
        { persist: !demoMode }
      );
      enqueueSpyRecovery(1, SPY_RECOVERY_COOLDOWN_MS);
      pushEvent(`Špehování distriktu ${district.name || `#${district.id}`} bylo úspěšné.`);
    } else if (outcomeKey === "medium_fail") {
      discoveredIntel = setDistrictSpyIntel(
        district.id,
        buildPartialSpyIntelPayload(district),
        { persist: !demoMode }
      );
      setSpyCount(getSpyCount() + 1, { persist: true, animate: isSpyCountShownInTopbar });
      pushEvent("Špehování nedopadlo dobře, ale špeh se vrátil.");
    } else {
      enqueueSpyRecovery(1, 60 * 1000);
      pushEvent("Špehování selhalo. Špeh byl zajat a je zamčen na 60s.");
      if (!isDistrictUnownedForSpyOutcome(district)) {
        notifyDistrictOwnerAboutSpyFailure(district);
      }
    }

    openSpyResultModal({ outcomeKey, district, chances: rolled.chances, spyIntel: discoveredIntel });
    document.dispatchEvent(new CustomEvent("empire:spy-resolved", {
      detail: {
        districtId: district.id,
        outcomeKey,
        spyIntel: discoveredIntel
      }
    }));
  }

  function scheduleSpyActionResult(districtId) {
    const timeoutId = setTimeout(() => {
      spyActionResultTimeouts.delete(timeoutId);
      finalizeSpyActionResult({ districtId });
    }, resolveOnboardingActionDurationMs(SPY_ACTION_DURATION_MS));
    spyActionResultTimeouts.add(timeoutId);
  }

  function renderOccupationResultModal(details) {
    openAttackResultModal(details);
  }

  function scheduleOccupationActionResult(districtId, requiredMembers = 0) {
    const durationMs = resolveOnboardingActionDurationMs(OCCUPY_ACTION_DURATION_MS);
    const timeoutId = setTimeout(() => {
      occupyActionResultTimeouts.delete(timeoutId);
      const district = resolveDistrictById(districtId);
      if (!district) return;

      claimDistrictForPlayer(district);

      const districtName = district?.name || `Distrikt #${district?.id ?? "-"}`;
      const payload = {
        districtId: district?.id ?? null,
        districtName,
        title: "Distrikt obsazen",
        outcomeBadge: "Obsazení dokončeno",
        outcomeTone: "total_success",
        outcomeKey: "total_success",
        summary: `Distrikt ${districtName} je teď pod tvou kontrolou.`,
        attackPower: Math.max(0, Math.floor(Number(requiredMembers || 0))),
        defensePower: 0,
        attackerLossPct: 0,
        defenderLossPct: 100,
        districtStateValue: "Obsazený",
        durationValue: formatAttackDurationLabel(durationMs),
        activatedSpecialEffects: []
      };

      pushEvent(`Distrikt ${districtName} byl úspěšně obsazen.`);
      if (isResultModalVisible()) {
        pendingResultModalQueue.push({ kind: "occupy", payload });
      } else {
        renderOccupationResultModal(payload);
      }
      document.dispatchEvent(new CustomEvent("empire:occupy-resolved", {
        detail: {
          districtId: district?.id ?? null,
          district: district || null,
          requiredMembers: Math.max(0, Math.floor(Number(requiredMembers || 0))),
          durationMs
        }
      }));
    }, durationMs);
    occupyActionResultTimeouts.add(timeoutId);
  }

  function getDistrictActionsController() {
    return getModalsFacade()?.getDistrictActionsController?.() || null;
  }

  function closeSpyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.closeSpyConfirmModal) return controller.closeSpyConfirmModal();
  }

  function closeRaidConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.closeRaidConfirmModal) return controller.closeRaidConfirmModal();
  }

  function showActionConfirmPopup({ tone = "attack", title = "AKCE POTVRZENA", subtitle = "" } = {}) {
    return getModalsFacade()?.showActionConfirmPopup?.({ tone, title, subtitle });
  }

  function renderSpyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.renderSpyConfirmModal) return controller.renderSpyConfirmModal();
  }

  function openSpyConfirmModal(district) {
    const controller = getDistrictActionsController();
    if (controller?.openSpyConfirmModal) return controller.openSpyConfirmModal(district);
  }

  function renderRaidConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.renderRaidConfirmModal) return controller.renderRaidConfirmModal();
  }

  function openRaidConfirmModal(district) {
    const controller = getDistrictActionsController();
    if (controller?.openRaidConfirmModal) return controller.openRaidConfirmModal(district);
  }

  async function startRaidActionFromModal() {
    const controller = getDistrictActionsController();
    if (controller?.startRaidActionFromModal) return controller.startRaidActionFromModal();
  }

  function initRaidConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.initRaidConfirmModal) return controller.initRaidConfirmModal();
  }

  function startSpyActionFromModal() {
    const controller = getDistrictActionsController();
    if (controller?.startSpyActionFromModal) return controller.startSpyActionFromModal();
  }

  function initSpyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.initSpyConfirmModal) return controller.initSpyConfirmModal();
  }

  function closeOccupyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.closeOccupyConfirmModal) return controller.closeOccupyConfirmModal();
  }

  function renderOccupyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.renderOccupyConfirmModal) return controller.renderOccupyConfirmModal();
  }

  function openOccupyConfirmModal(district) {
    const controller = getDistrictActionsController();
    if (controller?.openOccupyConfirmModal) return controller.openOccupyConfirmModal(district);
  }

  function startOccupyActionFromModal() {
    const controller = getDistrictActionsController();
    if (controller?.startOccupyActionFromModal) return controller.startOccupyActionFromModal();
  }

  function initOccupyConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.initOccupyConfirmModal) return controller.initOccupyConfirmModal();
  }

  function closeTrapConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.closeTrapConfirmModal) return controller.closeTrapConfirmModal();
  }

  function renderTrapConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.renderTrapConfirmModal) return controller.renderTrapConfirmModal();
  }

  function openTrapConfirmModal(district) {
    const controller = getDistrictActionsController();
    if (controller?.openTrapConfirmModal) return controller.openTrapConfirmModal(district);
  }

  function placeTrapFromModal() {
    const controller = getDistrictActionsController();
    if (controller?.placeTrapFromModal) return controller.placeTrapFromModal();
  }

  function initTrapConfirmModal() {
    const controller = getDistrictActionsController();
    if (controller?.initTrapConfirmModal) return controller.initTrapConfirmModal();
  }
  function normalizeOwnerName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getPlayerOwnerNameSet() {
    const player = window.Empire.player || {};
    const names = [
      activeScenarioOwnerName,
      player.gangName,
      player.gang_name,
      player.gang,
      player.username,
      player.name,
      cachedProfile?.gangName,
      cachedProfile?.gang_name,
      cachedProfile?.gang,
      cachedProfile?.username,
      cachedProfile?.name,
      readStoredGuestUsername(),
      readStoredGangName()
    ]
      .map((value) => normalizeOwnerName(value))
      .filter(Boolean);
    return new Set(names);
  }

  function resolveCurrentPlayerOwnerKey() {
    const player = window.Empire.player || {};
    const candidates = [
      activeScenarioOwnerName,
      player.username,
      player.name,
      player.gangName,
      player.gang_name,
      player.gang,
      cachedProfile?.username,
      cachedProfile?.name,
      cachedProfile?.gangName,
      cachedProfile?.gang_name,
      cachedProfile?.gang,
      readStoredGuestUsername(),
      readStoredGangName()
    ];
    return candidates.map((value) => normalizeOwnerName(value)).find(Boolean) || "guest-player";
  }

  function resolveActiveScenarioOwnerName() {
    return String(activeScenarioOwnerName || resolveScenarioOwnerName() || "").trim();
  }

  function isDistrictDestroyed(district) {
    if (!district || typeof district !== "object") return false;
    return Boolean(district.isDestroyed || district.is_destroyed || district.destroyed);
  }

  function isDistrictOwnedByPlayer(district) {
    if (isDistrictDestroyed(district)) return false;
    const owner = normalizeOwnerName(district?.owner);
    if (!owner) return false;
    return getPlayerOwnerNameSet().has(owner);
  }

  function isDistrictOwnedByAlliance(district) {
    if (isDistrictDestroyed(district)) return false;
    const owner = normalizeOwnerName(district?.owner);
    if (!owner) return false;
    if (isDistrictOwnedByPlayer(district)) return false;
    return getActiveAllianceOwnerNames().has(owner);
  }

  function isDistrictDefendableByPlayer(district) {
    return isDistrictOwnedByPlayer(district) || isDistrictOwnedByAlliance(district);
  }

  function resolveDistrictById(districtId, districts = window.Empire.districts) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    if (districtId == null) return null;
    const targetKey = String(districtId);
    return safeDistricts.find((district) => String(district?.id) === targetKey) || null;
  }

  function isDistrictAdjacentToOwnedTerritory(district, { includeAllianceTerritory = false } = {}) {
    const safeDistrict = district || window.Empire.selectedDistrict;
    if (!safeDistrict?.id) return false;
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    if (!districts.length) return false;

    const targetDistrict = resolveDistrictById(safeDistrict.id, districts);
    if (!targetDistrict) return false;

    const adjacency = buildDistrictAdjacency(districts);
    const neighbors = adjacency.get(targetDistrict.id);
    if (!neighbors || !neighbors.size) return false;

    const allowedOwnerNames = new Set(getPlayerOwnerNameSet());
    if (includeAllianceTerritory) {
      getActiveAllianceOwnerNames().forEach((name) => {
        allowedOwnerNames.add(name);
      });
    }

    if (!allowedOwnerNames.size) return false;

    const districtsById = new Map(districts.map((item) => [item.id, item]));
    for (const neighborId of neighbors) {
      const neighbor = districtsById.get(neighborId);
      if (!neighbor) continue;
      const owner = normalizeOwnerName(neighbor.owner);
      if (owner && allowedOwnerNames.has(owner)) {
        return true;
      }
    }

    return false;
  }

  function evaluateRaidAdjacencyAvailability(district) {
    const safeDistrict = district || window.Empire.selectedDistrict;
    if (!safeDistrict?.id) {
      return { allowed: false, reason: "Nejprve vyber distrikt." };
    }
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    if (!districts.length) {
      return { allowed: false, reason: "Nepodařilo se načíst mapu distriktů." };
    }

    const targetDistrict = resolveDistrictById(safeDistrict.id, districts);
    if (!targetDistrict) {
      return { allowed: false, reason: "Vybraný distrikt se nepodařilo dohledat." };
    }

    const adjacency = buildDistrictAdjacency(districts);
    const targetNeighbors = adjacency.get(targetDistrict.id);
    if (!targetNeighbors || !targetNeighbors.size) {
      return { allowed: false, reason: "Vykrást můžeš jen sousední distrikt." };
    }

    const playerOwnerNames = new Set(getPlayerOwnerNameSet());
    const allianceOwnerNames = new Set(
      Array.from(getActiveAllianceOwnerNames()).filter((ownerName) => ownerName && !playerOwnerNames.has(ownerName))
    );
    const districtsById = new Map(districts.map((entry) => [entry.id, entry]));

    for (const neighborId of targetNeighbors) {
      const neighbor = districtsById.get(neighborId);
      const owner = normalizeOwnerName(neighbor?.owner);
      if (owner && playerOwnerNames.has(owner)) {
        return { allowed: true, reason: "", mode: "player" };
      }
    }

    if (!allianceOwnerNames.size) {
      return {
        allowed: false,
        reason: "Vykrást můžeš jen distrikt, který sousedí s tvým distriktem nebo s kvalifikovaným aliančním distriktem."
      };
    }

    const alliedAdjacencyCounts = new Map();
    districts.forEach((entry) => {
      const owner = normalizeOwnerName(entry?.owner);
      if (!owner || !allianceOwnerNames.has(owner) || isDistrictDestroyed(entry)) return;
      const neighbors = adjacency.get(entry.id);
      if (!neighbors || !neighbors.size) return;
      for (const neighborId of neighbors) {
        const neighbor = districtsById.get(neighborId);
        const neighborOwner = normalizeOwnerName(neighbor?.owner);
        if (neighborOwner && playerOwnerNames.has(neighborOwner)) {
          alliedAdjacencyCounts.set(owner, (alliedAdjacencyCounts.get(owner) || 0) + 1);
          break;
        }
      }
    });

    const qualifiedAllianceOwners = new Set(
      Array.from(alliedAdjacencyCounts.entries())
        .filter(([, count]) => Number(count) >= 2)
        .map(([owner]) => owner)
    );

    for (const neighborId of targetNeighbors) {
      const neighbor = districtsById.get(neighborId);
      const owner = normalizeOwnerName(neighbor?.owner);
      if (owner && qualifiedAllianceOwners.has(owner)) {
        return { allowed: true, reason: "", mode: "alliance" };
      }
    }

    return {
      allowed: false,
      reason: "Vykrást můžeš jen distrikt, který sousedí s tvým distriktem nebo s distriktem spojence, který má aspoň 2 sousední distrikty s tvým územím."
    };
  }

  function evaluateDistrictActionAvailability(district, action) {
    if (!district) {
      return { allowed: false, reason: "Nejprve vyber distrikt." };
    }
    const districtId = Number(district?.id);
    const onboardingDemoActive = activePlayerScenarioKey === "onboarding-20-edge" && scenarioVisionEnabled && !window.Empire.token;
    if (isDistrictDestroyed(district)) {
      return { allowed: false, reason: "Distrikt je zničený a nepoužitelný." };
    }

    if (hasActivePoliceRaidImpactLock("allActionsBlocked") || isPoliceRaidAllActionsBlocked()) {
      return { allowed: false, reason: "Během policejní razie jsou všechny akce dočasně zakázány." };
    }

    if (action === "attack" && hasActivePoliceRaidImpactLock("attackBlocked")) {
      return { allowed: false, reason: "Během policejní razie je útok dočasně zakázán." };
    }
    if (action === "occupy" && hasActivePoliceRaidImpactLock("occupyBlocked")) {
      return { allowed: false, reason: "Během policejní razie je obsazování dočasně zakázáno." };
    }

    if (isDistrictDefendableByPlayer(district)) {
      if (action === "attack") {
        return { allowed: false, reason: "Vlastní nebo alianční distrikt nelze napadnout. Použij Obranu." };
      }
      if (action === "raid") {
        return { allowed: false, reason: "Vlastní nebo alianční distrikt nelze vykrást. Použij Obranu." };
      }
      if (action === "spy") {
        return { allowed: false, reason: "Vlastní nebo alianční distrikt nelze špehovat. Použij Obranu." };
      }
    }

    if (action === "attack") {
      if (onboardingDemoActive && districtId === ONBOARDING_TUTORIAL_ATTACK_DISTRICT_ID) {
        return { allowed: true, reason: "" };
      }
      const activeAttackCooldownMs = getActiveAttackCooldownRemainingMs();
      if (activeAttackCooldownMs > 0) {
        return {
          allowed: false,
          reason: `Další útok můžeš spustit za ${formatAttackCooldownLabel(activeAttackCooldownMs)}.`
        };
      }
      const completeSpyIntel = resolveCompleteSpyIntel(district?.id);
      if (isDistrictUnownedForSpyOutcome(district) && !completeSpyIntel) {
        return { allowed: false, reason: "Na neobsazený distrikt musí nejdřív proběhnout úspěšné špehování." };
      }
      if (isDistrictUnownedForSpyOutcome(district) && completeSpyIntel) {
        return { allowed: false, reason: "Pro prázdný vyspěhovaný distrikt použij akci Obsadit." };
      }
      const targetAttackLockMs = getAttackTargetLockRemainingMs(district?.owner);
      if (targetAttackLockMs > 0) {
        return {
          allowed: false,
          reason: `Na hráče ${String(district?.ownerNick || district?.owner || "Neznámý").trim() || "Neznámý"} nemůžeš po aktivaci pasti útočit ještě ${formatDurationLabel(targetAttackLockMs)}.`
        };
      }
      const adjacent = isDistrictAdjacentToOwnedTerritory(district, { includeAllianceTerritory: false });
      return adjacent
        ? { allowed: true, reason: "" }
        : { allowed: false, reason: "Útočit můžeš jen na distrikt, který sousedí s tvým dobytým distriktem." };
    }

    if (action === "occupy") {
      if (onboardingDemoActive && districtId === ONBOARDING_TUTORIAL_SPY_DISTRICT_ID) {
        if (!resolveCompleteSpyIntel(district?.id)) {
          return { allowed: false, reason: "Nejdřív musí proběhnout úspěšné špehování tohoto distriktu." };
        }
        return { allowed: true, reason: "" };
      }
      if (!isDistrictUnownedForSpyOutcome(district)) {
        return { allowed: false, reason: "Obsadit lze jen neobsazený distrikt." };
      }
      if (!resolveCompleteSpyIntel(district?.id)) {
        return { allowed: false, reason: "Nejdřív musí proběhnout úspěšné špehování tohoto distriktu." };
      }
      const adjacent = isDistrictAdjacentToOwnedTerritory(district, { includeAllianceTerritory: true });
      return adjacent
        ? { allowed: true, reason: "" }
        : { allowed: false, reason: "Obsadit můžeš jen distrikt sousedící s tvým nebo aliančním distriktem." };
    }

    if (action === "raid" || action === "spy") {
      if (action === "spy" && hasActivePoliceRaidImpactLock("spyBlocked")) {
        return { allowed: false, reason: "Během policejní razie je špehování dočasně zakázáno." };
      }
      if (action === "raid" && hasActivePoliceRaidImpactLock("raidBlocked")) {
        return { allowed: false, reason: "Během policejní razie je vykrádání dočasně zakázáno." };
      }
      if (onboardingDemoActive && districtId === ONBOARDING_TUTORIAL_SPY_DISTRICT_ID) {
        return { allowed: true, reason: "" };
      }
      if (action === "raid") {
        if (onboardingDemoActive && districtId === ONBOARDING_TUTORIAL_RAID_DISTRICT_ID) {
          return { allowed: true, reason: "" };
        }
        const globalRaidCooldownMs = getRaidCooldownRemainingMs();
        if (globalRaidCooldownMs > 0) {
          return {
            allowed: false,
            reason: `Krádež je na cooldownu ještě ${formatRaidCooldownLabel(globalRaidCooldownMs)}.`
          };
        }
        const districtRaidLockMs = getDistrictRaidLockRemainingMs(districtId);
        if (districtRaidLockMs > 0) {
          return {
            allowed: false,
            reason: `Distrikt je po krádeži zamčený ještě ${formatAttackDurationLabel(districtRaidLockMs)}.`
          };
        }
        if (!window.Empire.token) {
          return { allowed: true, reason: "" };
        }
        return evaluateRaidAdjacencyAvailability(district);
      }
      if (!window.Empire.token) {
        return { allowed: true, reason: "" };
      }
      const adjacent = isDistrictAdjacentToOwnedTerritory(district, { includeAllianceTerritory: true });
      return adjacent
        ? { allowed: true, reason: "" }
        : { allowed: false, reason: "Špehovat můžeš jen distrikt, který sousedí s tvým nebo aliančním distriktem." };
    }

    return { allowed: false, reason: "Akci nelze provést." };
  }

  function resolveCombatWeaponAccess(mode, gangMembers = countPlayerControlledPopulation(cachedProfile || window.Empire.player || {})) {
    const stats = mode === "defense" ? defenseWeaponStats : attackWeaponStats;
    const sorted = Array.isArray(stats) ? stats : [];
    const currentMembers = Math.max(0, Math.floor(Number(gangMembers) || 0));
    const unlocked = sorted.filter((item) => currentMembers >= Number(item.requiredMembers || 0));
    return {
      allowed: unlocked.length > 0,
      currentMembers,
      weapon: unlocked.length ? unlocked[unlocked.length - 1] : null,
      nextRequiredMembers: unlocked.length < sorted.length ? Number(sorted[unlocked.length]?.requiredMembers || 0) : null
    };
  }

  function buildWeaponDetailMap(stats, quantity = DEMO_WEAPON_STACK_SIZE) {
    return (Array.isArray(stats) ? stats : []).reduce((acc, item) => {
      if (!item?.name) return acc;
      acc[item.name] = Math.max(0, Math.floor(Number(quantity) || 0));
      return acc;
    }, {});
  }

  function createDemoWeaponLoadout(quantity = DEMO_WEAPON_STACK_SIZE) {
    const attackDetail = buildWeaponDetailMap(attackWeaponStats, quantity);
    const defenseDetail = buildWeaponDetailMap(defenseWeaponStats, quantity);
    return {
      weaponsDetail: attackDetail,
      defenseDetail,
      weapons: getAttackWeaponTotal(attackDetail),
      defense: getDefenseWeaponTotal(defenseDetail)
    };
  }

  function createOnboardingDemoEconomy() {
    const loadout = createDemoWeaponLoadout(1);
    return {
      cleanMoney: 1200,
      dirtyMoney: 2000,
      balance: 3200,
      drugs: 6,
      materials: 12,
      influence: 8,
      spyCount: 2,
      spies: 2,
      drugInventory: {
        neonDust: 3,
        pulseShot: 1,
        velvetSmoke: 1,
        ghostSerum: 1,
        overdriveX: 0
      },
      activeDrugs: {},
      ...loadout
    };
  }

  function resolveDemoOwnerFaction(ownerName) {
    const safeOwner = String(ownerName || "").trim();
    if (!safeOwner) return DEMO_OWNER_FACTIONS[0];
    const index = hashDistrictSeed(`${safeOwner}:faction`, safeOwner.length) % DEMO_OWNER_FACTIONS.length;
    return DEMO_OWNER_FACTIONS[index];
  }

  function resolveDemoOwnerAvatar(ownerName) {
    const safeOwner = String(ownerName || "").trim();
    if (!safeOwner) return DEMO_OWNER_AVATAR_POOL[0];
    const index = hashDistrictSeed(`${safeOwner}:avatar`, safeOwner.length) % DEMO_OWNER_AVATAR_POOL.length;
    return DEMO_OWNER_AVATAR_POOL[index];
  }

  function resolveDemoOwnerColor(ownerName) {
    return getPlayerOwnerMetaHelpers()?.resolveDemoOwnerColor?.(ownerName) || null;
  }

  function resolveDemoDistrictAtmosphere(district, ownerName) {
    return getPlayerOwnerMetaHelpers()?.resolveDemoDistrictAtmosphere?.(district, ownerName) || null;
  }

  function buildDemoDistrictOwnerMeta(ownerName, district) {
    return getPlayerOwnerMetaHelpers()?.buildDemoDistrictOwnerMeta?.(ownerName, district) || {
      ownerStructure: null,
      ownerFaction: null,
      ownerAvatar: null,
      ownerAtmosphere: null
    };
  }

  function getActiveAllianceOwnerNames() {
    return getAllianceVisionHelpers()?.getActiveAllianceOwnerNames?.()
      || (scenarioVisionEnabled ? scenarioAllianceOwnerNames : liveAllianceOwnerNames);
  }

  function getActiveEnemyOwnerNames() {
    return getAllianceVisionHelpers()?.getActiveEnemyOwnerNames?.()
      || (scenarioVisionEnabled ? scenarioEnemyOwnerNames : EMPTY_OWNER_NAMES);
  }

  function setScenarioVisionMode(enabled) {
    return getAllianceVisionHelpers()?.setScenarioVisionMode?.(enabled);
  }

  function setScenarioAllianceOwners(ownerNames) {
    return getAllianceVisionHelpers()?.setScenarioAllianceOwners?.(ownerNames);
  }

  function setScenarioEnemyOwners(ownerNames) {
    return getAllianceVisionHelpers()?.setScenarioEnemyOwners?.(ownerNames);
  }

  function setScenarioAllianceIcons(entries) {
    return getAllianceVisionHelpers()?.setScenarioAllianceIcons?.(entries);
  }

  function setLiveAllianceOwnersFromAlliance(alliance) {
    return getAllianceVisionHelpers()?.setLiveAllianceOwnersFromAlliance?.(alliance);
  }

  function clearLiveAllianceOwners() {
    return getAllianceVisionHelpers()?.clearLiveAllianceOwners?.();
  }

  function normalizeMapBorderMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === MAP_BORDER_MODE_WHITE || mode === MAP_BORDER_MODE_BLACK || mode === MAP_BORDER_MODE_PLAYER) {
      return mode;
    }
    return MAP_BORDER_MODE_PLAYER;
  }

  function resolveStoredMapBorderMode() {
    return normalizeMapBorderMode(readStoredValue(MAP_BORDER_MODE_STORAGE_KEY));
  }

  function resolveMapBorderPlayerColor() {
    return normalizeHexColor(readStoredGangColor()) || "#22d3ee";
  }

  function resolveStoredUnknownNeutralFillEnabled() {
    return readStoredValue(MAP_UNKNOWN_NEUTRAL_FILL_STORAGE_KEY) === "1";
  }

  function applyMapBorderSwitchVisuals() {
    const root = document.getElementById("map-border-switch");
    if (root) {
      root.style.setProperty("--map-border-player-color", resolveMapBorderPlayerColor());
    }
    const swatches = Array.from(document.querySelectorAll("[data-map-border-color]"));
    if (!swatches.length) return;
    swatches.forEach((swatch) => {
      const mode = normalizeMapBorderMode(swatch.dataset.mapBorderColor);
      swatch.classList.toggle("is-active", mode === selectedMapBorderMode);
      swatch.setAttribute("aria-pressed", mode === selectedMapBorderMode ? "true" : "false");
    });
    const neutralToggle = document.getElementById("map-unknown-neutral-fill-toggle");
    if (neutralToggle) {
      neutralToggle.classList.toggle("is-active", unknownNeutralFillEnabled);
      neutralToggle.setAttribute("aria-pressed", unknownNeutralFillEnabled ? "true" : "false");
    }
  }

  function applyMapBorderMode(mode, options = {}) {
    const nextMode = normalizeMapBorderMode(mode);
    selectedMapBorderMode = nextMode;
    if (options.persist !== false) {
      writeStoredValue(MAP_BORDER_MODE_STORAGE_KEY, nextMode);
    }
    applyMapBorderSwitchVisuals();
    syncMapVisionContext();
  }

  function syncOnboardingMobileUnknownToggleVisibility() {
    const neutralToggle = document.getElementById("map-unknown-neutral-fill-toggle");
    if (!neutralToggle) return;
    const isMobileViewport = window.matchMedia("(max-width: 900px)").matches;
    const body = document.body;
    const hasOnboardingStepClass = Array.from(body.classList).some((className) => className.startsWith("onboarding-step-"));
    const onboardingActive = Boolean(
      body.classList.contains("onboarding-active")
      || body.classList.contains("onboarding-ui-locked")
      || hasOnboardingStepClass
      || activePlayerScenarioKey === "onboarding-20-edge"
    );
    const shouldHide = isMobileViewport && onboardingActive;
    neutralToggle.style.display = shouldHide ? "none" : "";
    neutralToggle.style.visibility = shouldHide ? "hidden" : "";
    neutralToggle.disabled = shouldHide;
    neutralToggle.setAttribute("aria-hidden", shouldHide ? "true" : "false");
    if (shouldHide) {
      neutralToggle.setAttribute("tabindex", "-1");
    } else {
      neutralToggle.removeAttribute("tabindex");
    }
  }

  function initMapBorderModeControls() {
    const swatches = Array.from(document.querySelectorAll("[data-map-border-color]"));
    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        applyMapBorderMode(swatch.dataset.mapBorderColor);
      });
    });
    const neutralToggle = document.getElementById("map-unknown-neutral-fill-toggle");
    if (neutralToggle) {
      neutralToggle.addEventListener("click", () => {
        unknownNeutralFillEnabled = !unknownNeutralFillEnabled;
        writeStoredValue(
          MAP_UNKNOWN_NEUTRAL_FILL_STORAGE_KEY,
          unknownNeutralFillEnabled ? "1" : "0"
        );
        applyMapBorderSwitchVisuals();
        syncMapVisionContext();
      });
    }
    const syncUnknownToggleVisibility = () => syncOnboardingMobileUnknownToggleVisibility();
    document.addEventListener("empire:scenario-applied", syncUnknownToggleVisibility);
    document.addEventListener("empire:onboarding:started", syncUnknownToggleVisibility);
    document.addEventListener("empire:onboarding:finished", syncUnknownToggleVisibility);
    document.addEventListener("empire:onboarding:reset", syncUnknownToggleVisibility);
    document.addEventListener("empire:onboarding:step-changed", syncUnknownToggleVisibility);
    window.addEventListener("resize", syncUnknownToggleVisibility);
    applyMapBorderMode(selectedMapBorderMode, { persist: false });
    syncUnknownToggleVisibility();
  }

  function syncMapVisionContext() {
    return getAllianceVisionHelpers()?.syncMapVisionContext?.();
  }

  function resolveMoneyBreakdown(source) {
    return uiMoneyHelpers?.resolveMoneyBreakdown?.(source) || {
      cleanMoney: 0,
      dirtyMoney: 0,
      totalMoney: 0
    };
  }

  function applyMoneyToProfileSnapshot(profile, moneySource) {
    if (uiMoneyHelpers?.applyMoneyToProfileSnapshot) {
      return uiMoneyHelpers.applyMoneyToProfileSnapshot(profile, moneySource);
    }
    const baseProfile = profile && typeof profile === "object" ? profile : {};
    const money = resolveMoneyBreakdown(moneySource);
    return {
      ...baseProfile,
      cleanMoney: money.cleanMoney,
      dirtyMoney: money.dirtyMoney,
      money: money.totalMoney,
      balance: money.totalMoney,
      cash: money.cleanMoney,
      dirtyCash: money.dirtyMoney
    };
  }

  function normalizeHexColor(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return null;
    if (/^#[0-9a-f]{3}$/.test(raw)) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }
    if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
    return null;
  }

  function formatDurationLabel(ms) {
    const safe = Math.max(0, Math.floor(Number(ms) || 0));
    const totalMinutes = Math.ceil(safe / 60000);
    if (totalMinutes <= 1) return "1 min";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  function clearDistrictAttackWarningTimer() {
    if (districtAttackWarningTimer) {
      window.clearInterval(districtAttackWarningTimer);
      districtAttackWarningTimer = null;
    }
  }

  function pickRandomPoliceRaidSpecialtyKey() {
    const weighted = POLICE_RAID_SPECIALTY_RANDOM_WEIGHTS
      .map((entry) => ({
        key: String(entry?.key || "").trim().toLowerCase(),
        weight: Math.max(0, Number(entry?.weight || 0))
      }))
      .filter((entry) => entry.key && entry.weight > 0);
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return "total";
    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.key;
    }
    return weighted[weighted.length - 1]?.key || "total";
  }

  function resolvePoliceRaidSpecialtyKey(tier, detail = {}) {
    const explicitType = String(
      detail?.operationType
      || detail?.operation_type
      || detail?.type
      || detail?.raidSpecialtyKey
      || detail?.raidSpecialty
      || ""
    ).trim().toLowerCase();
    if (explicitType.includes("stealth") || explicitType.includes("shadow") || explicitType.includes("covert")) return "financial";
    if (explicitType.includes("money") || explicitType.includes("cash") || explicitType.includes("bank") || explicitType.includes("finance") || explicitType.includes("economic")) return "financial";
    if (explicitType.includes("drug") || explicitType.includes("narc") || explicitType.includes("chem") || explicitType.includes("dealer") || explicitType.includes("lab")) return "drug";
    if (explicitType.includes("weapon") || explicitType.includes("armory") || explicitType.includes("gun") || explicitType.includes("combat") || explicitType.includes("military")) return "weapons";
    if (explicitType.includes("police") || explicitType.includes("law") || explicitType.includes("order") || explicitType.includes("arrest") || explicitType.includes("control") || explicitType.includes("security")) return "arrests";
    if (explicitType.includes("cash") || explicitType.includes("dirty") || explicitType.includes("money")) return "financial";
    if (explicitType.includes("drug")) return "drug";
    if (explicitType.includes("warehouse") || explicitType.includes("building") || explicitType.includes("weapon")) return "weapons";
    if (explicitType.includes("apartment") || explicitType.includes("district_lock") || explicitType.includes("arrest")) return "arrests";
    return pickRandomPoliceRaidSpecialtyKey();
  }

  function resolvePoliceRaidSpecialty(tier, detail = {}) {
    const key = resolvePoliceRaidSpecialtyKey(tier, detail);
    return {
      key,
      ...(POLICE_RAID_SPECIALTIES[key] || POLICE_RAID_SPECIALTIES.total)
    };
  }

  function resolveStoredPoliceRaidSpecialty(detail = {}) {
    const explicitKey = String(
      detail?.raidSpecialtyKey
      || detail?.raid_specialty_key
      || detail?.raidSpecialty
      || ""
    ).trim().toLowerCase();
    if (!explicitKey) return null;
    const meta = POLICE_RAID_SPECIALTIES[explicitKey];
    if (!meta) return null;
    return { key: explicitKey, ...meta };
  }

  function resolvePoliceRaidSpecialtyFromOperationType(operationType, detail = {}) {
    const stored = resolveStoredPoliceRaidSpecialty(detail);
    if (stored) return stored;
    const normalized = String(
      operationType
      || detail?.operationType
      || detail?.type
      || ""
    ).trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes("stealth") || normalized.includes("shadow") || normalized.includes("covert")) return POLICE_RAID_SPECIALTIES.financial;
    if (normalized.includes("cash") || normalized.includes("dirty")) return POLICE_RAID_SPECIALTIES.financial;
    if (normalized.includes("money") || normalized.includes("finance") || normalized.includes("economic") || normalized.includes("bank")) return POLICE_RAID_SPECIALTIES.financial;
    if (normalized.includes("drug") || normalized.includes("warehouse") || normalized.includes("dealer") || normalized.includes("chem") || normalized.includes("lab")) return POLICE_RAID_SPECIALTIES.drug;
    if (normalized.includes("weapon") || normalized.includes("building_shutdown") || normalized.includes("armory") || normalized.includes("gun") || normalized.includes("combat")) return POLICE_RAID_SPECIALTIES.weapons;
    if (normalized.includes("apartment") || normalized.includes("district_lock") || normalized.includes("arrest") || normalized.includes("police") || normalized.includes("law") || normalized.includes("order")) return POLICE_RAID_SPECIALTIES.arrests;
    if (normalized.includes("coordinated")) return POLICE_RAID_SPECIALTIES.total;
    if (normalized.includes("warning") || normalized.includes("control")) return POLICE_RAID_SPECIALTIES.financial;
    return null;
  }

  function resolvePoliceRaidImpactSpecialty(detail = {}, tier = 1) {
    return resolveStoredPoliceRaidSpecialty(detail)
      || resolvePoliceRaidSpecialtyFromOperationType(detail?.operationType, detail)
      || resolvePoliceRaidSpecialty(tier, detail);
  }

  function resolvePoliceRaidLossMultiplier(specialtyKey, lossKey) {
    const specialty = POLICE_RAID_SPECIALTY_LOSS_MULTIPLIERS[String(specialtyKey || "").trim().toLowerCase()]
      || POLICE_RAID_SPECIALTY_LOSS_MULTIPLIERS.total;
    const multiplier = Number(specialty?.[lossKey]);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  function scalePoliceRaidLossPct(value, specialtyKey, lossKey, maxPct = 100) {
    const safeValue = Math.max(0, Number(value) || 0);
    const nextValue = Math.round(safeValue * resolvePoliceRaidLossMultiplier(specialtyKey, lossKey));
    return Math.max(0, Math.min(maxPct, nextValue));
  }

  function resolveStoredGangColor() {
    return normalizeHexColor(readStoredGangColor());
  }

  function resolveActiveProfileAvatar() {
    return scenarioProfileAvatarOverride || readStoredAvatar() || null;
  }

  function applyProfileModalVisuals(avatarSrc = null) {
    const content = document.querySelector("#profile-modal .modal__content");
    if (!content) return;
    const gangColor = resolveStoredGangColor();
    const fallback = "rgba(34, 211, 238, 0.45)";
    content.style.setProperty("--profile-border-color", gangColor || fallback);
    if (avatarSrc) {
      const safe = String(avatarSrc).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      content.style.setProperty("--profile-avatar-url", `url("${safe}")`);
    } else {
      content.style.setProperty("--profile-avatar-url", "none");
    }
  }

  function formatGangColorText(color) {
    return color ? color.toUpperCase() : "Nevybráno";
  }

  function renderGangColorChipMarkup(color) {
    const label = formatGangColorText(color);
    const dotClass = color ? "gang-color-chip__dot" : "gang-color-chip__dot is-empty";
    const dotStyle = color ? ` style="background:${color}"` : "";
    const textStyle = color ? ` style="color:${color}"` : "";
    return `
      <span class="gang-color-chip">
        <span class="${dotClass}"${dotStyle}></span>
        <span${textStyle}>${label}</span>
      </span>
    `;
  }

  function refreshGangColorDisplays() {
    applyProfileModalVisuals(resolveActiveProfileAvatar());
    applyMapBorderSwitchVisuals();
  }

  function initPlayerScenarioButtons() {
    const scenarioButtons = Array.from(document.querySelectorAll("[data-player-scenario]"));
    if (!scenarioButtons.length) return;
    try {
      localStorage.removeItem(PLAYER_SCENARIO_STORAGE_KEY);
    } catch {}

    const setActiveScenarioButton = (scenarioKey) => {
      scenarioButtons.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate.dataset.playerScenario === scenarioKey);
      });
    };

    scenarioButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const scenarioKey = button.dataset.playerScenario;
        applyPlayerScenario(scenarioKey);
        setActiveScenarioButton(String(scenarioKey || ""));
        activeIndexMapView = String(scenarioKey || "").trim() === INTERNAL_INDEX_HRA_SCENARIO_KEY ? "hra" : "";
        syncIndexMapToggleButton();
        refreshGuestBannerVisibility();
      });
    });
  }

  function cloneScenarioPolygon(polygon) {
    return (Array.isArray(polygon) ? polygon : []).map((point) => [
      Number(point?.[0] || 0),
      Number(point?.[1] || 0)
    ]);
  }

  function resolveScenarioSourceDistricts() {
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    return districts
      .map((district) => {
        const basePolygon = Array.isArray(district?.basePolygon) && district.basePolygon.length
          ? cloneScenarioPolygon(district.basePolygon)
          : cloneScenarioPolygon(district?.polygon);
        return {
          ...district,
          basePolygon,
          polygon: basePolygon
        };
      })
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
  }

  function applyPlayerScenario(scenarioKey) {
    const districts = resolveScenarioSourceDistricts();
    if (!districts.length || !window.Empire.Map?.setDistricts) {
      pushEvent("Mapa ještě není připravená.");
      return;
    }
    activePlayerScenarioKey = String(scenarioKey || "");
    activeScenarioOwnerName = "";
    const normalizedScenarioKey = activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY
        ? "alliance-ten"
        : activePlayerScenarioKey;
    document.body.classList.toggle("scenario-onboarding-20-edge", normalizedScenarioKey === "onboarding-20-edge");
    const forcedMapMode = activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY
      ? "blackout"
      : "";

    const ownerName = resolveScenarioOwnerName();
    activeScenarioOwnerName = ownerName;
    const allyName = "Chavi_Cz";
    scenarioUniqueOwnerColors = false;
    scenarioProfileAvatarOverride = normalizedScenarioKey === "onboarding-20-edge" ? ONBOARDING_PROFILE_AVATAR : null;
    setScenarioAllianceIcons([]);
    syncMapVisionContext();
    const mapScenarioDistrictOwner = (district, owner = null) => ({
      ...district,
      owner: owner || null,
      ownerPlayerId: null,
      ownerNick: null,
      ownerAllianceName: null,
      ownerStructure: owner ? resolveDemoOwnerFaction(owner) : null,
      ownerFaction: owner ? resolveDemoOwnerFaction(owner) : null,
      ownerAvatar: owner ? resolveDemoOwnerAvatar(owner) : null,
      ownerAtmosphere: owner ? resolveDemoDistrictAtmosphere(district, owner) : null,
      isDestroyed: false,
      destroyedAt: null
    });
    let nextDistricts = districts.map((district) => mapScenarioDistrictOwner(district));

    const baseProfile = {
      ...(window.Empire.player || {}),
      ...(cachedProfile || {}),
      username: ownerName,
      name: ownerName,
      gangName: cachedProfile?.gangName || ownerName,
      structure: cachedProfile?.structure || readStoredStructure() || "-",
      alliance: "Žádná",
      districts: 0,
      structure: cachedProfile?.structure || readStoredStructure() || resolveDemoOwnerFaction(ownerName),
      ...createDemoWeaponLoadout()
    };
    let scenarioAttackIncident = null;
    let scenarioPoliceIncident = null;
    let scenarioAttackIncidents = [];
    let scenarioPoliceIncidents = [];
    let scenarioPoliceIncidentIds = [];
    let scenarioDestroyedDistrictId = null;
    roundStatusOverride = null;

    if (normalizedScenarioKey === "full-map") {
      setScenarioVisionMode(true);
      setScenarioAllianceOwners([]);
      setScenarioEnemyOwners([]);
      nextDistricts = districts.map((district) => mapScenarioDistrictOwner(district, ownerName));
      baseProfile.districts = districts.length;
      baseProfile.alliance = "Žádná";
      pushEvent(`Ukázka: ${ownerName} ovládá celou mapu (${districts.length} sektorů).`);
    } else if (normalizedScenarioKey === "single-district") {
      setScenarioVisionMode(true);
      setScenarioAllianceOwners([]);
      setScenarioEnemyOwners([]);
      const bounds = getDistrictBounds(districts);
      const selected = [...districts].sort(
        (a, b) => distanceFromMapCenter(a, bounds) - distanceFromMapCenter(b, bounds)
      )[0];
      if (selected) {
        nextDistricts = districts.map((district) => ({
          ...mapScenarioDistrictOwner(district),
          owner: district.id === selected.id ? ownerName : null
        }));
        baseProfile.districts = 1;
      }
      baseProfile.alliance = "Žádná";
      pushEvent("Ukázka: hráč drží pouze jeden distrikt.");
    } else if (normalizedScenarioKey === "alliance-ten") {
      const enemyOneName = "Mariah";
      const enemyTwoName = "Willy";
      const enemyOwners = [enemyOneName, enemyTwoName];
      const ownAllianceName = "Zabijáci";
      const blackoutAllyName = "Knedlík";
      const enemyAllianceName = "Stínoví vlci";
      const blackoutAllianceName = "Zabijáci";
      const blackoutEnemyAllianceName = "Ledová aliance";
      const blackoutSecondEnemyName = "Ledovec";
      const blackoutThirdEnemyName = "Poltergeist";
      const blackoutFourthEnemyName = "Sněhulák";
      const blackoutFifthEnemyName = "Pepek";
      setScenarioAllianceIcons([
        [ownAllianceName, "lightning"],
        [enemyAllianceName, "wolf_head"],
        [blackoutAllianceName, "lightning"],
        [blackoutEnemyAllianceName, "broken_shield"]
      ]);
      setScenarioVisionMode(true);
      scenarioUniqueOwnerColors = true;
      setScenarioAllianceOwners([allyName]);
      setScenarioEnemyOwners(enemyOwners);
      nextDistricts = assignAllianceTenScenarioOwnership(districts, ownerName, allyName, {
        ownAllianceName,
        enemyOwners,
        enemyAllianceName
      });
      const ownDistrictCount = countOwnedDistrictsForOwner(nextDistricts, ownerName);
      const allyDistrictCount = countOwnedDistrictsForOwner(nextDistricts, allyName);
      const enemyDistrictCount = enemyOwners.reduce(
        (sum, enemyOwner) => sum + countOwnedDistrictsForOwner(nextDistricts, enemyOwner),
        0
      );
      const totalOwned = ownDistrictCount + allyDistrictCount;
      baseProfile.districts = ownDistrictCount;
      baseProfile.alliance = `${ownAllianceName} (2/4 • ${totalOwned} sektorů)`;
      roundStatusOverride = buildRoundStatusPresetForMode(
        activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY ? "blackout" : "night"
      );
      nextDistricts = nextDistricts.map((district) => {
        if (normalizeOwnerName(district?.owner) !== normalizeOwnerName(allyName)) return district;
        return {
          ...district,
          ownerAllianceName: blackoutEnemyAllianceName
        };
      });
      {
        const blackoutPlayerDistrictIds = new Set([84, 95, 92, 120, 126]);
        setScenarioAllianceOwners([blackoutAllyName]);
        nextDistricts = nextDistricts.map((district) => {
          const districtId = Number(district?.id);
          if (blackoutPlayerDistrictIds.has(districtId)) {
            return {
              ...district,
              owner: ownerName,
              ownerNick: ownerName,
              ownerAllianceName: blackoutAllianceName,
              ...buildDemoDistrictOwnerMeta(ownerName, district)
            };
          }
          if (districtId === 143 || districtId === 121) {
            return {
              ...district,
              owner: blackoutThirdEnemyName,
              ownerNick: blackoutThirdEnemyName,
              ownerAllianceName: null,
              ...buildDemoDistrictOwnerMeta(blackoutThirdEnemyName, district)
            };
          }
          if (districtId === 38 || districtId === 25) {
            return {
              ...district,
              owner: blackoutFourthEnemyName,
              ownerNick: blackoutFourthEnemyName,
              ownerAllianceName: blackoutEnemyAllianceName,
              ...buildDemoDistrictOwnerMeta(blackoutFourthEnemyName, district)
            };
          }
          if (districtId === 82) {
            return {
              ...district,
              owner: blackoutSecondEnemyName,
              ownerNick: blackoutSecondEnemyName,
              ownerAllianceName: blackoutEnemyAllianceName,
              ...buildDemoDistrictOwnerMeta(blackoutSecondEnemyName, district)
            };
          }
          if (districtId === 108 || districtId === 103 || districtId === 89) {
            return {
              ...district,
              owner: blackoutFifthEnemyName,
              ownerNick: blackoutFifthEnemyName,
              ownerAllianceName: null,
              ...buildDemoDistrictOwnerMeta(blackoutFifthEnemyName, district)
            };
          }
          if (districtId === 102) {
            return {
              ...district,
              owner: blackoutAllyName,
              ownerNick: blackoutAllyName,
              ownerAllianceName: blackoutAllianceName,
              ...buildDemoDistrictOwnerMeta(blackoutAllyName, district)
            };
          }
          if (districtId === 109) {
            return {
              ...district,
              owner: blackoutAllyName,
              ownerNick: blackoutAllyName,
              ownerAllianceName: blackoutAllianceName,
              ...buildDemoDistrictOwnerMeta(blackoutAllyName, district)
            };
          }
          if (normalizeOwnerName(district?.owner) === normalizeOwnerName(ownerName)) {
            return {
              ...district,
              ownerAllianceName: blackoutAllianceName
            };
          }
          if (normalizeOwnerName(district?.owner) === normalizeOwnerName(allyName)) {
            return {
              ...district,
              ownerAllianceName: blackoutEnemyAllianceName
            };
          }
          return district;
        });
        setScenarioEnemyOwners([enemyOneName, enemyTwoName, blackoutSecondEnemyName, blackoutThirdEnemyName, blackoutFourthEnemyName, blackoutFifthEnemyName]);
        baseProfile.alliance = blackoutAllianceName;
        baseProfile.districts = countOwnedDistrictsForOwner(nextDistricts, ownerName);
      }
      if (activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY) {
        scenarioPoliceIncidentIds = [143, 38];
      }
      pushEvent(`Ukázka: ${ownerName} drží ${ownDistrictCount} sektorů, Chavi_Cz ${allyDistrictCount}.`);
      pushEvent(`Hrozba: nepřátelská aliance (${enemyOneName} + ${enemyTwoName}) drží ${enemyDistrictCount} sousedních sektorů.`);
    } else if (normalizedScenarioKey === "alliance-war") {
      const allyOneName = `${ownerName} - spojenec A`;
      const allyTwoName = "Chavi_Cz";
      const allyTwoAllianceName = "Ledovec";
      const enemyAllianceOne = ["Stínoví vlci 1", "Stínoví vlci 2", "Stínoví vlci 3"];
      const enemyAllianceTwo = ["Neonové kobry 1", "Neonové kobry 2", "Neonové kobry 3"];
      const enemyOwners = [...enemyAllianceOne, ...enemyAllianceTwo];

      setScenarioVisionMode(true);
      setScenarioAllianceOwners([allyOneName, allyTwoName]);
      setScenarioEnemyOwners(enemyOwners);

      const allocations = [
        { owner: ownerName, count: 3 },
        { owner: allyOneName, count: 4 },
        { owner: allyTwoName, count: 4 },
        ...enemyOwners.map((enemyOwner) => ({ owner: enemyOwner, count: 3 }))
      ];
      nextDistricts = assignOwnersToNeighborClusters(districts, allocations, {
        excludeTypes: ["downtown"]
      });
      nextDistricts = nextDistricts.map((district) => {
        if (normalizeOwnerName(district?.owner) !== normalizeOwnerName(allyTwoName)) return district;
        return {
          ...district,
          ownerAllianceName: allyTwoAllianceName
        };
      });
      const ownDistrictCount = countOwnedDistrictsForOwner(nextDistricts, ownerName);
      const allyTotal = countOwnedDistrictsForOwner(nextDistricts, allyOneName)
        + countOwnedDistrictsForOwner(nextDistricts, allyTwoName);
      const enemyTotal = enemyOwners.reduce(
        (sum, enemyOwner) => sum + countOwnedDistrictsForOwner(nextDistricts, enemyOwner),
        0
      );
      baseProfile.districts = ownDistrictCount;
      baseProfile.alliance = `${ownerName} + 2 spojenci (3/4 • ${ownDistrictCount + allyTotal} sektorů)`;
      pushEvent(
        `Ukázka: ty držíš ${ownDistrictCount} sektory, 2 spojenci drží ${allyTotal} a 2 nepřátelské aliance drží ${enemyTotal} sektorů.`
      );
    } else if (normalizedScenarioKey === "alliance-20") {
      const scenario = buildTwentyPlayerAllianceScenario(districts, ownerName);
      if (!scenario.districts.length) {
        pushEvent("Ukázka 20 hráčů se nepodařila připravit.");
        return;
      }
      setScenarioVisionMode(true);
      scenarioUniqueOwnerColors = true;
      syncMapVisionContext();
      setScenarioAllianceOwners(scenario.alliedOwners);
      setScenarioEnemyOwners(scenario.enemyOwners);
      nextDistricts = scenario.districts;
      baseProfile.districts = scenario.ownDistrictCount;
      baseProfile.alliance = `${scenario.ownAllianceName} (${scenario.ownAllianceMemberCount}/${scenario.allianceMemberCap || 2} • ${scenario.ownAllianceDistrictCount} sektorů)`;
      scenarioAttackIncident = scenario.attackIncident || null;
      scenarioPoliceIncident = scenario.policeIncident || null;
      scenarioDestroyedDistrictId = scenario.destroyedDistrictId ?? null;
      pushEvent(
        `Ukázka: ${scenario.playerCount} hráčů ve ${scenario.allianceCount} aliancích. Každý má ${scenario.minPerPlayer}-${scenario.maxPerPlayer} sektorů.`
      );
      if (scenarioAttackIncident?.targetDistrictId != null) {
        pushEvent(
          `Incident: distrikt ${scenarioAttackIncident.sourceDistrictId} zaútočil na distrikt ${scenarioAttackIncident.targetDistrictId}.`
        );
      }
      if (scenarioPoliceIncident?.targetDistrictId != null) {
        pushEvent(
          `Bezpečnost: velká policejní akce probíhá v distriktu ${scenarioPoliceIncident.targetDistrictId}.`
        );
      }
      if (scenarioDestroyedDistrictId != null) {
        pushEvent(`Katastrofa: distrikt ${scenarioDestroyedDistrictId} je vypálený a nepoužitelný.`);
      }
    } else if (normalizedScenarioKey === "night-20-war") {
      const scenario = buildNightTwentyWarScenario(districts, ownerName);
      if (!scenario.districts.length) {
        pushEvent("Noční stav 20 hráčů se nepodařilo připravit.");
        return;
      }
      setScenarioVisionMode(true);
      scenarioUniqueOwnerColors = true;
      setScenarioAllianceIcons(Array.isArray(scenario.allianceIconEntries) ? scenario.allianceIconEntries : []);
      syncMapVisionContext();
      setScenarioAllianceOwners(scenario.alliedOwners);
      setScenarioEnemyOwners(scenario.enemyOwners);
      nextDistricts = scenario.districts;
      baseProfile.districts = scenario.ownDistrictCount;
      baseProfile.alliance = `${scenario.ownAllianceName} (${scenario.ownAllianceMemberCount}/4 • ${scenario.ownAllianceDistrictCount} sektorů)`;
      roundStatusOverride = buildRoundStatusPresetForMode("night");
      scenarioAttackIncidents = Array.isArray(scenario.attackIncidents) ? scenario.attackIncidents : [];
      scenarioPoliceIncidents = Array.isArray(scenario.policeIncidents) ? scenario.policeIncidents : [];
      pushEvent(
        `Noční stav: ${scenario.playerCount} hráčů ve ${scenario.allianceCount} aliancích. Každý má ${scenario.minPerPlayer}-${scenario.maxPerPlayer} sektorů.`
      );
      pushEvent(`Mapa je plně obsazená. Aktivní útoky: ${scenarioAttackIncidents.length}. Policejní razie: ${scenarioPoliceIncidents.length}.`);
    } else if (normalizedScenarioKey === "onboarding-20-edge") {
      const scenario = buildTwentyPlayerEdgeOnboardingScenario(districts, ownerName);
      if (!scenario.districts.length) {
        pushEvent("Onboarding scénář 20 hráčů se nepodařilo připravit.");
        return;
      }
      const onboardingAllianceName = "Vortex Crew";
      setScenarioVisionMode(true);
      scenarioUniqueOwnerColors = true;
      setScenarioAllianceIcons([[onboardingAllianceName, "lightning"]]);
      syncMapVisionContext();
      setScenarioAllianceOwners([]);
      setScenarioEnemyOwners(scenario.enemyOwners);
      nextDistricts = scenario.districts;
      const tutorialEnemyOwner = String(scenario.enemyOwners?.[0] || "Vortex Hounds").trim() || "Vortex Hounds";
      nextDistricts = nextDistricts.map((district) => {
        if (Number(district?.id) === ONBOARDING_TUTORIAL_SPY_DISTRICT_ID) {
          const existingBuildings = Array.isArray(district?.buildings) ? [...district.buildings] : [];
          const normalizedBuildings = existingBuildings.map((building) => normalizeOwnerName(building));
          const filteredBuildings = existingBuildings.filter((building) => {
            const normalized = normalizeOwnerName(building);
            return normalized !== "pouliční dealeři" && normalized !== "poulicni dealeri";
          });
          if (!normalizedBuildings.includes("drug lab") && !normalizedBuildings.includes("druglab")) {
            filteredBuildings.push("Drug lab");
          }
          return {
            ...district,
            owner: null,
            ownerPlayerId: null,
            ownerNick: null,
            ownerAllianceName: null,
            ownerStructure: null,
            ownerFaction: null,
            ownerAvatar: null,
            ownerAtmosphere: null,
            buildings: filteredBuildings
          };
        }
        if (Number(district?.id) === ONBOARDING_TUTORIAL_DRUG_LAB_DISTRICT_ID) {
          const existingBuildings = Array.isArray(district?.buildings) ? [...district.buildings] : [];
          const normalizedBuildings = existingBuildings.map((building) => normalizeOwnerName(building));
          const filteredBuildings = existingBuildings.filter((building) => {
            const normalized = normalizeOwnerName(building);
            return normalized !== "drug lab" && normalized !== "druglab";
          });
          if (!normalizedBuildings.includes("pouliční dealeři") && !normalizedBuildings.includes("poulicni dealeri")) {
            filteredBuildings.push("Pouliční dealeři");
          }
          return {
            ...district,
            buildings: filteredBuildings
          };
        }
        if (Number(district?.id) === ONBOARDING_TUTORIAL_ATTACK_DISTRICT_ID) {
          return {
            ...district,
            owner: tutorialEnemyOwner,
            ownerPlayerId: null,
            ownerNick: tutorialEnemyOwner,
            ownerAllianceName: null,
            ...buildDemoDistrictOwnerMeta(tutorialEnemyOwner, district)
          };
        }
        if (Number(district?.id) === ONBOARDING_TUTORIAL_RAID_DISTRICT_ID) {
          return {
            ...district,
            owner: tutorialEnemyOwner,
            ownerPlayerId: null,
            ownerNick: tutorialEnemyOwner,
            ownerAllianceName: null,
            ...buildDemoDistrictOwnerMeta(tutorialEnemyOwner, district)
          };
        }
        if (Number(district?.id) === 16) {
          return {
            ...district,
            ownerAllianceName: onboardingAllianceName,
            ownerAllianceIconKey: "lightning"
          };
        }
        return district;
      });
      baseProfile.districts = scenario.ownDistrictCount;
      baseProfile.alliance = "Žádná";
      baseProfile.username = "Onboarding Runner";
      baseProfile.cleanMoney = 1200;
      baseProfile.dirtyMoney = 2000;
      baseProfile.drugs = 6;
      baseProfile.materials = 12;
      baseProfile.influence = 8;
      baseProfile.heat = 45;
      baseProfile.wantedLevel = 45;
      baseProfile.wanted = 45;
      baseProfile.policeHeat = 45;
      baseProfile.police_heat = 45;
      const localAllianceState = getLocalAllianceState();
      if (!window.Empire.token) {
        const onboardingAllianceId = "alliance-onboarding-vortex";
        let onboardingAlliance = (localAllianceState.alliances || []).find((alliance) => alliance.id === onboardingAllianceId) || null;
        if (!onboardingAlliance) {
          onboardingAlliance = createLocalAlliance(localAllianceState, {
            name: "Vortex Crew",
            description: "Onboarding aliance pro ukázku READY, členů a odchodu.",
            iconKey: "lightning"
          });
          onboardingAlliance.id = onboardingAllianceId;
          onboardingAlliance.members = Array.isArray(onboardingAlliance.members) ? onboardingAlliance.members : [];
          onboardingAlliance.members[0] = {
            ...(onboardingAlliance.members[0] || {}),
            id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
            username: "Ty",
            gang_name: readStoredGangName() || "Guest Crew",
            alliance_ready_at: null
          };
          onboardingAlliance.members.push(
            {
              id: "alliance-onboarding-member-1",
              username: "Rook",
              gang_name: "Vortex Crew",
              alliance_ready_at: new Date().toISOString()
            },
            {
              id: "alliance-onboarding-member-2",
              username: "Nova",
              gang_name: "Vortex Crew",
              alliance_ready_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
            }
          );
          localAllianceState.activeAllianceId = onboardingAllianceId;
          saveLocalAllianceState(localAllianceState);
        } else {
          onboardingAlliance.members = Array.isArray(onboardingAlliance.members) ? onboardingAlliance.members : [];
          const playerMember = onboardingAlliance.members.find((member) => String(member.id || "") === LOCAL_ALLIANCE_REQUEST_PLAYER_ID);
          if (playerMember) {
            playerMember.alliance_ready_at = null;
            playerMember.username = "Ty";
            playerMember.gang_name = readStoredGangName() || "Guest Crew";
          } else {
            onboardingAlliance.members.unshift({
              id: LOCAL_ALLIANCE_REQUEST_PLAYER_ID,
              username: "Ty",
              gang_name: readStoredGangName() || "Guest Crew",
              alliance_ready_at: null
            });
          }
          localAllianceState.activeAllianceId = onboardingAllianceId;
          saveLocalAllianceState(localAllianceState);
        }
        baseProfile.alliance = `${onboardingAlliance.name} (${Math.min(4, onboardingAlliance.members.length)}/4)`;
      }
      pushEvent(
        `Onboarding: ${scenario.playerCount} hráčů, každý drží 1 okrajový distrikt. Tvůj distrikt přímo sousedí s nepřítelem.`
      );
    } else {
      return;
    }

    window.Empire.player = baseProfile;
    window.Empire.Map.clearUnderAttackDistricts?.();
    window.Empire.Map.clearPoliceActions?.();
    if (forcedMapMode) {
      window.Empire.Map.setMapMode?.(forcedMapMode);
    } else if (roundStatusOverride?.phaseKey) {
      const overrideMode = resolveEffectiveRoundMode(roundStatusOverride.phaseKey, roundStatusOverride.subPhaseKey).mapMode;
      window.Empire.Map.setMapMode?.(overrideMode || roundStatusOverride.phaseKey);
    }
    window.Empire.Map.setDistricts(nextDistricts);
    const attackMarkers = [];
    if (scenarioAttackIncident?.targetDistrictId != null) {
      attackMarkers.push({
        districtId: scenarioAttackIncident.targetDistrictId,
        attackerDistrictId: scenarioAttackIncident.sourceDistrictId,
        durationMs: scenarioAttackIncident.durationMs,
        source: "scenario-alliance-20"
      });
    }
    if (scenarioAttackIncidents.length) {
      scenarioAttackIncidents.forEach((incident, index) => {
        if (incident?.targetDistrictId == null) return;
        attackMarkers.push({
          districtId: incident.targetDistrictId,
          attackerDistrictId: incident.sourceDistrictId,
          durationMs: Number(incident.durationMs || 10 * 60 * 1000),
          source: `scenario-night-20-attack-${index + 1}`
        });
      });
    }
    window.Empire.Map.setUnderAttackDistricts?.(attackMarkers, { replace: true });

    const policeMarkers = [];
    if (scenarioPoliceIncident?.targetDistrictId != null) {
      policeMarkers.push({
        districtId: scenarioPoliceIncident.targetDistrictId,
        durationMs: scenarioPoliceIncident.durationMs,
        source: "scenario-alliance-20-police"
      });
    }
    if (scenarioPoliceIncidents.length) {
      scenarioPoliceIncidents.forEach((incident, index) => {
        if (incident?.targetDistrictId == null) return;
        policeMarkers.push({
          districtId: incident.targetDistrictId,
          durationMs: Number(incident.durationMs || 14 * 60 * 1000),
          source: `scenario-night-20-police-${index + 1}`
        });
      });
    }
    if (scenarioPoliceIncidentIds.length) {
      scenarioPoliceIncidentIds.forEach((districtId) => {
        policeMarkers.push({
          districtId,
          durationMs: 60000,
          source: "scenario-alliance-ten-blackout-police"
        });
      });
    }
    window.Empire.Map.setPoliceActionDistricts?.(policeMarkers, { replace: true });
    if (normalizedScenarioKey === "onboarding-20-edge") {
      clearDistrictSpyIntel(ONBOARDING_TUTORIAL_SPY_DISTRICT_ID);
      clearDistrictSpyIntel(ONBOARDING_TUTORIAL_ATTACK_DISTRICT_ID);
      setLocalGangMembersBonus(0);
      setLocalGangMembersSpent(0);
      updateEconomy(createOnboardingDemoEconomy(), { instant: true });
      startOnboardingGrowthTicker();
    } else {
      stopOnboardingGrowthTicker();
    }
    if (!window.Empire.token && isBlackoutLikeScenario()) {
      const allianceState = String(activePlayerScenarioKey || "").trim() === "night-20-war"
        ? buildNightTwentyWarLocalAllianceState(ownerName, nextDistricts)
        : buildAllianceTenBlackoutLocalAllianceState(ownerName, "Knedlík");
      saveLocalAllianceState(allianceState);
      const marketState = getLocalMarketState();
      marketState.scenarioIncome = {
        ...(marketState.scenarioIncome && typeof marketState.scenarioIncome === "object" ? marketState.scenarioIncome : {}),
        [BLACKOUT_SCENARIO_INCOME_STORAGE_KEY]: Date.now(),
        dirtyRemainder: 0
      };
      saveLocalMarketState(marketState);
      const blackoutSources = buildBlackoutPlayerSourcesSnapshot(nextDistricts, ownerName);
      if (hasMeaningfulBlackoutSources(blackoutSources)) {
        lastValidBlackoutSources = blackoutSources;
      }
      baseProfile.sources = blackoutSources;
      baseProfile.source = blackoutSources;
      Object.assign(baseProfile, applyMoneyToProfileSnapshot(baseProfile, marketState.balances || {}));
      baseProfile.sources = blackoutSources;
      baseProfile.source = blackoutSources;
      syncGuestEconomyFromMarket();
      syncGuestAllianceLabel(allianceState.alliances[0]?.name || "Žádná");
    }
    updateProfile(baseProfile);
    renderRoundStatusState();
    activeIndexMapView = activePlayerScenarioKey === INTERNAL_INDEX_HRA_SCENARIO_KEY ? "hra" : activeIndexMapView;
    syncIndexMapToggleButton();
    document.dispatchEvent(new CustomEvent("empire:scenario-applied", {
      detail: {
        scenarioKey: activePlayerScenarioKey,
        scenarioBaseKey: normalizedScenarioKey,
        ownerName,
        profile: baseProfile,
        districts: nextDistricts
      }
    }));
    if (normalizedScenarioKey === "onboarding-20-edge") {
      window.Empire.Onboarding?.start?.({
        ownerName,
        districts: nextDistricts
      });
    }
  }

  function assignAllianceTenScenarioOwnership(districts, ownerName, allyName, options = {}) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    if (!safeDistricts.length) return [];
    const ownAllianceName = String(options?.ownAllianceName || `${ownerName} + spojenec`).trim();
    const enemyOwners = Array.isArray(options?.enemyOwners)
      ? options.enemyOwners.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const enemyAllianceName = String(options?.enemyAllianceName || "").trim();

    const ownersByDistrict = new Map();
    const districtCenters = new Map(
      safeDistricts.map((district) => [district.id, polygonCentroid(district.polygon || [])])
    );
    const neighborsByDistrict = buildDistrictAdjacency(safeDistricts);
    const available = new Set(
      safeDistricts
        .filter((district) => String(district?.type || "").toLowerCase() !== "downtown")
        .map((district) => district.id)
    );
    const ownerTarget = Math.min(5, available.size);
    const preferredTypes = ["commercial", "industrial", "residential", "park", "downtown"];
    const mapBounds = getDistrictBounds(safeDistricts);
    const requiredOwnerBuildings = ["Lékárna", "Továrna", "Drug lab", "Zbrojovka"];
    const hasBuilding = (district, buildingName) => {
      const wanted = normalizeOwnerName(buildingName);
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      return buildings.some((building) => normalizeOwnerName(building) === wanted);
    };
    const sortByCenterDistance = (a, b) => {
      const distA = distanceFromMapCenter(a, mapBounds);
      const distB = distanceFromMapCenter(b, mapBounds);
      if (distA === distB) return Number(a.id || 0) - Number(b.id || 0);
      return distA - distB;
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

    preferredTypes.forEach((type) => {
      if (ownersByDistrict.size >= ownerTarget) return;
      const candidate = safeDistricts
        .filter((district) => String(district?.type || "").toLowerCase() === type && available.has(district.id))
        .sort(sortByCenterDistance)[0];
      if (!candidate) return;
      ownersByDistrict.set(candidate.id, ownerName);
      available.delete(candidate.id);
    });

    if (ownersByDistrict.size < ownerTarget && available.size) {
      const fallback = safeDistricts
        .filter((district) => available.has(district.id))
        .sort(sortByCenterDistance);
      const missing = Math.min(ownerTarget - ownersByDistrict.size, fallback.length);
      for (let i = 0; i < missing; i += 1) {
        const district = fallback[i];
        ownersByDistrict.set(district.id, ownerName);
        available.delete(district.id);
      }
    }

    const allyTarget = Math.min(5, available.size);
    if (allyTarget > 0) {
      const ownerClusterIds = Array.from(ownersByDistrict.keys());
      const ownerClusterSet = new Set(ownerClusterIds);
      let allySeedId = null;
      if (ownerClusterIds.length) {
        allySeedId = pickNearestToCluster(available, ownerClusterIds, districtCenters, ownerClusterSet);
      }
      if (!allySeedId) {
        allySeedId = pickClusterSeed(available, districtCenters, 1, 2);
      }
      const allyCluster = growDistrictCluster({
        seedId: allySeedId,
        targetSize: allyTarget,
        available,
        neighborsByDistrict,
        districtCenters
      });
      allyCluster.forEach((districtId) => {
        ownersByDistrict.set(districtId, allyName);
        available.delete(districtId);
      });
    }

    if (enemyOwners.length && available.size) {
      const friendlyClusterIds = Array.from(ownersByDistrict.keys());
      const friendlyClusterSet = new Set(friendlyClusterIds);
      const ownerDistrictIds = Array.from(ownersByDistrict.entries())
        .filter(([, owner]) => normalizeOwnerName(owner) === normalizeOwnerName(ownerName))
        .map(([districtId]) => districtId);
      const ownerDistrictSet = new Set(ownerDistrictIds);
      const enemyTarget = Math.min(5, available.size);
      let enemySeedId = null;
      if (ownerDistrictIds.length) {
        const adjacentToOwner = Array.from(available).filter((districtId) => {
          const neighbors = neighborsByDistrict.get(districtId);
          if (!neighbors || !neighbors.size) return false;
          for (const neighborId of neighbors) {
            if (ownerDistrictSet.has(neighborId)) return true;
          }
          return false;
        });
        if (adjacentToOwner.length) {
          enemySeedId = pickNearestToCluster(
            new Set(adjacentToOwner),
            ownerDistrictIds,
            districtCenters,
            ownerDistrictSet
          );
        }
      }
      if (!enemySeedId && friendlyClusterIds.length) {
        enemySeedId = pickNearestToCluster(available, friendlyClusterIds, districtCenters, friendlyClusterSet);
      }
      if (!enemySeedId) {
        enemySeedId = pickClusterSeed(available, districtCenters, 2, 3);
      }
      const enemyCluster = growDistrictCluster({
        seedId: enemySeedId,
        targetSize: enemyTarget,
        available,
        neighborsByDistrict,
        districtCenters
      });
      enemyCluster.forEach((districtId) => {
        available.delete(districtId);
      });

      const splitBase = Math.floor(enemyTarget / enemyOwners.length);
      const splitRemainder = enemyTarget % enemyOwners.length;
      const targetByEnemy = enemyOwners.map((_, index) => splitBase + (index < splitRemainder ? 1 : 0));
      const enemyAvailable = new Set(enemyCluster);

      enemyOwners.forEach((enemyOwner, enemyIndex) => {
        const enemyOwnerTarget = Math.min(targetByEnemy[enemyIndex], enemyAvailable.size);
        if (enemyOwnerTarget < 1) return;
        let enemyOwnerSeed = null;
        if (friendlyClusterIds.length) {
          enemyOwnerSeed = pickNearestToCluster(enemyAvailable, friendlyClusterIds, districtCenters, new Set());
        }
        if (!enemyOwnerSeed && enemyAvailable.size) {
          enemyOwnerSeed = Array.from(enemyAvailable)[0];
        }
        if (!enemyOwnerSeed) return;
        const enemyOwnerCluster = growDistrictCluster({
          seedId: enemyOwnerSeed,
          targetSize: enemyOwnerTarget,
          available: enemyAvailable,
          neighborsByDistrict,
          districtCenters
        });
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
      [normalizeOwnerName(ownerName), ownAllianceName],
      [normalizeOwnerName(allyName), ownAllianceName]
    ]);
    if (enemyAllianceName) {
      enemyOwners.forEach((enemyOwner) => {
        ownerAllianceByKey.set(normalizeOwnerName(enemyOwner), enemyAllianceName);
      });
    }

    return safeDistricts.map((district) => {
      const isDowntown = String(district?.type || "").toLowerCase() === "downtown";
      const owner = isDowntown ? null : (ownersByDistrict.get(district.id) || null);
      return {
        ...district,
        owner,
        ownerPlayerId: null,
        ownerNick: null,
        ownerAllianceName: ownerAllianceByKey.get(normalizeOwnerName(owner)) || null,
        ...buildDemoDistrictOwnerMeta(owner, district)
      };
    });
  }

  function assignOwnersToNeighborClusters(districts, allocations, options = {}) {
    const safeAllocations = Array.isArray(allocations) ? allocations : [];
    const excludedTypes = new Set(
      (Array.isArray(options?.excludeTypes) ? options.excludeTypes : [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const allocatableDistricts = excludedTypes.size
      ? (districts || []).filter(
        (district) => !excludedTypes.has(String(district?.type || "").trim().toLowerCase())
      )
      : (districts || []);
    const districtCenters = new Map(
      (districts || []).map((district) => [district.id, polygonCentroid(district.polygon || [])])
    );
    const neighborsByDistrict = buildDistrictAdjacency(districts || []);
    const available = new Set(allocatableDistricts.map((district) => district.id));
    const ownersByDistrict = new Map();
    const ownerCount = safeAllocations.length;

    safeAllocations.forEach((item, ownerIndex) => {
      const owner = String(item?.owner || "").trim();
      const count = Math.min(Math.max(0, Number(item?.count) || 0), available.size);
      if (!owner || count < 1) return;
      const seedId = pickClusterSeed(available, districtCenters, ownerIndex, ownerCount);
      const clusterIds = growDistrictCluster({
        seedId,
        targetSize: count,
        available,
        neighborsByDistrict,
        districtCenters
      });
      clusterIds.forEach((districtId) => {
        ownersByDistrict.set(districtId, owner);
        available.delete(districtId);
      });
    });

    return districts.map((district) => ({
      ...district,
      owner: ownersByDistrict.get(district.id) || null,
      ownerPlayerId: null,
      ownerNick: null,
      ownerAllianceName: null,
      ...buildDemoDistrictOwnerMeta(ownersByDistrict.get(district.id), district)
    }));
  }

  function buildTwentyPlayerAllianceScenario(districts, ownerName) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const emptyResult = {
      districts: [],
      alliedOwners: [],
      enemyOwners: [],
      attackIncident: null,
      policeIncident: null,
      destroyedDistrictId: null,
      ownDistrictCount: 0,
      ownAllianceName: "Žádná",
      ownAllianceMemberCount: 0,
      ownAllianceDistrictCount: 0,
      playerCount: 0,
      allianceCount: 0,
      minPerPlayer: 0,
      maxPerPlayer: 0
    };
    if (!safeDistricts.length) return emptyResult;

    const maxAllianceSize = 4;
    const maxPlayersByDistricts = Math.max(1, Math.floor(safeDistricts.length / 4));
    const playerCount = Math.max(1, Math.min(20, maxPlayersByDistricts));
    const allianceCount = Math.ceil(playerCount / maxAllianceSize);

    const allianceNamePool = [
      "Neon Syndicate",
      "Iron Wolves",
      "Black Harbor",
      "Vortex Pact",
      "Shadow Cartel",
      "Chrome Circuit",
      "Night Crown",
      "Urban Serpents"
    ];
    const nickPool = [
      "Razor Vex", "Ghost Mara", "Nyx Prime", "Iron Shade", "Vortex Kane",
      "Black Comet", "Neon Riot", "Cobra Unit", "Urban Hex", "Steel Drift",
      "Zero Pulse", "Night Cipher", "Crimson Dot", "Volt Raven", "Silent Brick",
      "Alpha Dock", "Chrome Lynx", "Delta Wolf", "Shadow Mint", "Metro Hawk",
      "Apex Nova", "Toxic Ray", "Retro Kane", "Frost Mamba", "Street Rune",
      "Kilo Ghost", "Rust Queen", "Nova Pilot", "Beta Venom", "Pixel Vandal"
    ];

    const usedNames = new Set();
    const claimUniqueNick = (value, fallbackIndex = 1) => {
      const base = String(value || "").trim() || `Hráč ${fallbackIndex}`;
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(normalizeOwnerName(candidate))) {
        candidate = `${base} ${suffix}`;
        suffix += 1;
      }
      usedNames.add(normalizeOwnerName(candidate));
      return candidate;
    };

    const players = [];
    for (let i = 0; i < playerCount; i += 1) {
      const allianceIndex = Math.floor(i / maxAllianceSize);
      const allianceName = allianceNamePool[allianceIndex % allianceNamePool.length];
      const owner = i === 0
        ? claimUniqueNick(ownerName || "Ty", 1)
        : claimUniqueNick(nickPool[(i - 1) % nickPool.length], i + 1);
      const structure = resolveDemoOwnerFaction(owner);
      players.push({
        owner,
        allianceName,
        allianceIndex,
        districtCount: 4 + ((i * 11 + 3) % 4),
        structure,
        avatar: resolveDemoOwnerAvatar(owner),
        ...createDemoWeaponLoadout()
      });
    }

    let totalTarget = players.reduce((sum, player) => sum + player.districtCount, 0);
    if (totalTarget > safeDistricts.length) {
      let guard = 0;
      while (totalTarget > safeDistricts.length && guard < 10000) {
        let reduced = false;
        for (let i = players.length - 1; i >= 0; i -= 1) {
          if (players[i].districtCount <= 4) continue;
          players[i].districtCount -= 1;
          totalTarget -= 1;
          reduced = true;
          if (totalTarget <= safeDistricts.length) break;
        }
        if (!reduced) break;
        guard += 1;
      }
    }

    const alliances = Array.from({ length: allianceCount }, (_, index) => {
      const members = players.filter((player) => player.allianceIndex === index);
      return {
        index,
        name: allianceNamePool[index % allianceNamePool.length],
        members,
        targetDistricts: members.reduce((sum, member) => sum + member.districtCount, 0)
      };
    });

    const districtCenters = new Map(
      safeDistricts.map((district) => [district.id, polygonCentroid(district.polygon || [])])
    );
    const neighborsByDistrict = buildDistrictAdjacency(safeDistricts);
    const available = new Set(safeDistricts.map((district) => district.id));
    const ownersByDistrict = new Map();

    alliances.forEach((alliance, allianceIndex) => {
      const targetDistricts = Math.min(alliance.targetDistricts, available.size);
      if (targetDistricts < 1) return;
      const seedId = pickClusterSeed(available, districtCenters, allianceIndex, alliances.length);
      if (!seedId) return;

      const allianceCluster = growDistrictCluster({
        seedId,
        targetSize: targetDistricts,
        available,
        neighborsByDistrict,
        districtCenters
      });
      if (!allianceCluster.length) return;
      allianceCluster.forEach((districtId) => {
        available.delete(districtId);
      });

      const allianceAvailable = new Set(allianceCluster);
      alliance.members.forEach((member, memberIndex) => {
        const memberTarget = Math.min(member.districtCount, allianceAvailable.size);
        if (memberTarget < 1) return;
        let memberSeed = pickClusterSeed(allianceAvailable, districtCenters, memberIndex, alliance.members.length);
        if (!memberSeed && allianceAvailable.size) {
          memberSeed = Array.from(allianceAvailable)[0];
        }
        if (!memberSeed) return;
        const memberCluster = growDistrictCluster({
          seedId: memberSeed,
          targetSize: memberTarget,
          available: allianceAvailable,
          neighborsByDistrict,
          districtCenters
        });
        memberCluster.forEach((districtId) => {
          ownersByDistrict.set(districtId, member.owner);
          allianceAvailable.delete(districtId);
        });
      });

      if (allianceAvailable.size) {
        const memberOwners = alliance.members.map((member) => member.owner);
        let ownerIndex = 0;
        allianceAvailable.forEach((districtId) => {
          ownersByDistrict.set(districtId, memberOwners[ownerIndex % memberOwners.length]);
          ownerIndex += 1;
        });
      }
    });

    const ownerAllianceByKey = new Map(
      players.map((player) => [normalizeOwnerName(player.owner), player.allianceName])
    );

    const nextDistricts = safeDistricts.map((district) => {
      const owner = ownersByDistrict.get(district.id) || null;
      const ownerKey = normalizeOwnerName(owner);
      const allianceName = ownerKey ? ownerAllianceByKey.get(ownerKey) || null : null;
      const ownerMeta = owner ? buildDemoDistrictOwnerMeta(owner, district) : {
        ownerStructure: null,
        ownerFaction: null,
        ownerAvatar: null,
        ownerAtmosphere: null
      };
      return {
        ...district,
        owner,
        ownerPlayerId: null,
        ownerNick: owner || null,
        ownerAllianceName: allianceName,
        ...ownerMeta
      };
    });

    const applyOwnerToDistrict = (district, player) => {
      if (!district || !player) return;
      district.owner = player.owner || null;
      district.ownerNick = player.owner || null;
      district.ownerAllianceName = player.allianceName || null;
      district.ownerStructure = player.structure || null;
      district.ownerFaction = player.structure || null;
      district.ownerAvatar = player.avatar || null;
      district.ownerAtmosphere = resolveDemoDistrictAtmosphere(district, player.owner);
    };
    const findDistrictById = (districtId) => {
      const key = String(districtId);
      return nextDistricts.find((district) => String(district?.id) === key) || null;
    };
    const sourceDistrict = findDistrictById(62)
      || nextDistricts.find((district) => district?.owner) || null;
    if (sourceDistrict && !sourceDistrict.owner) {
      const fallbackSourcePlayer = players[1] || players[0] || null;
      applyOwnerToDistrict(sourceDistrict, fallbackSourcePlayer);
    }
    const sourceOwnerKey = normalizeOwnerName(sourceDistrict?.owner);
    const sourceAllianceName = sourceOwnerKey ? ownerAllianceByKey.get(sourceOwnerKey) || null : null;
    const sourceDistrictId = sourceDistrict?.id ?? null;

    let targetDistrict = findDistrictById(107)
      || nextDistricts.find((district) => String(district?.id) !== String(sourceDistrictId)) || null;
    if (targetDistrict && !targetDistrict.owner) {
      const fallbackTargetPlayer = players.find((player) => normalizeOwnerName(player.owner) !== sourceOwnerKey)
        || players[0]
        || null;
      applyOwnerToDistrict(targetDistrict, fallbackTargetPlayer);
    }

    if (targetDistrict && sourceOwnerKey && normalizeOwnerName(targetDistrict.owner) === sourceOwnerKey) {
      const forcedTargetPlayer = players.find((player) => {
        const playerOwnerKey = normalizeOwnerName(player.owner);
        if (!playerOwnerKey || playerOwnerKey === sourceOwnerKey) return false;
        if (!sourceAllianceName) return true;
        return player.allianceName !== sourceAllianceName;
      }) || players.find((player) => normalizeOwnerName(player.owner) !== sourceOwnerKey) || null;
      applyOwnerToDistrict(targetDistrict, forcedTargetPlayer);
    }

    const targetDistrictId = targetDistrict?.id ?? null;
    const attackIncident = sourceDistrictId != null && targetDistrictId != null
      ? {
        sourceDistrictId,
        targetDistrictId,
        durationMs: 12 * 60 * 1000
      }
      : null;
    const policeTargetDistrict = findDistrictById(150)
      || nextDistricts.find((district) => String(district?.id) !== String(targetDistrictId))
      || null;
    const policeIncident = policeTargetDistrict?.id != null
      ? {
        targetDistrictId: policeTargetDistrict.id,
        durationMs: 14 * 60 * 1000
      }
      : null;
    const destroyedDistrict = findDistrictById(69)
      || nextDistricts.find((district) => {
        const name = String(district?.name || "");
        const match = name.match(/(^|[^0-9])69([^0-9]|$)/);
        return Boolean(match);
      })
      || null;
    if (destroyedDistrict) {
      destroyedDistrict.owner = null;
      destroyedDistrict.ownerNick = null;
      destroyedDistrict.ownerAllianceName = null;
      destroyedDistrict.ownerPlayerId = null;
      destroyedDistrict.influence = 0;
      destroyedDistrict.isDestroyed = true;
      destroyedDistrict.destroyedAt = Date.now() - (40 * 60 * 1000);
    }

    const ownOwner = players[0]?.owner || String(ownerName || "Ty");
    const ownOwnerKey = normalizeOwnerName(ownOwner);
    const ownAllianceName = ownerAllianceByKey.get(ownOwnerKey) || "Žádná";
    const ownAllianceMembers = players.filter((player) => player.allianceName === ownAllianceName);
    const alliedOwners = ownAllianceMembers
      .map((player) => player.owner)
      .filter((playerOwner) => normalizeOwnerName(playerOwner) !== ownOwnerKey);
    const enemyOwners = players
      .filter((player) => player.allianceName !== ownAllianceName)
      .map((player) => player.owner);
    const ownDistrictCount = countOwnedDistrictsForOwner(nextDistricts, ownOwner);
    const ownAllianceDistrictCount = nextDistricts.reduce((sum, district) => {
      const districtOwnerKey = normalizeOwnerName(district.owner);
      if (!districtOwnerKey) return sum;
      return ownerAllianceByKey.get(districtOwnerKey) === ownAllianceName ? sum + 1 : sum;
    }, 0);

    const minPerPlayer = players.reduce((min, player) => Math.min(min, player.districtCount), Infinity);
    const maxPerPlayer = players.reduce((max, player) => Math.max(max, player.districtCount), 0);

    return {
      districts: nextDistricts,
      alliedOwners,
      enemyOwners,
      attackIncident,
      policeIncident,
      destroyedDistrictId: destroyedDistrict?.id ?? null,
      ownDistrictCount,
      ownAllianceName,
      ownAllianceMemberCount: ownAllianceMembers.length,
      ownAllianceDistrictCount,
      playerCount: players.length,
      allianceCount: alliances.length,
      minPerPlayer: Number.isFinite(minPerPlayer) ? minPerPlayer : 0,
      maxPerPlayer
    };
  }

  function buildTwentyPlayerEdgeOnboardingScenario(districts, ownerName) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const emptyResult = {
      districts: [],
      enemyOwners: [],
      ownDistrictCount: 0,
      playerCount: 0
    };
    if (!safeDistricts.length) return emptyResult;

    const playerCount = 20;
    const bounds = getDistrictBounds(safeDistricts);
    const width = Math.max(1, Number(bounds.maxX || 0) - Number(bounds.minX || 0));
    const height = Math.max(1, Number(bounds.maxY || 0) - Number(bounds.minY || 0));
    const leftThreshold = bounds.minX + width * 0.2;
    const rightThreshold = bounds.maxX - width * 0.2;
    const bottomThreshold = bounds.maxY - height * 0.2;
    const adjacency = buildDistrictAdjacency(safeDistricts);
    const targetCounts = { left: 7, bottom: 7, right: 6 };

    const edgeCandidates = safeDistricts
      .filter((district) => String(district?.type || "").trim().toLowerCase() !== "downtown")
      .map((district) => {
        const center = polygonCentroid(district.polygon || []);
        const onLeft = center.x <= leftThreshold;
        const onRight = center.x >= rightThreshold;
        const onBottom = center.y >= bottomThreshold;
        if (!onLeft && !onRight && !onBottom) return null;
        let edge = "left";
        if (onBottom) edge = "bottom";
        if (onRight && !onBottom) edge = "right";
        return {
          district,
          center,
          edge,
          sortValue: edge === "bottom" ? center.x : center.y
        };
      })
      .filter(Boolean);

    const groupCandidates = {
      left: edgeCandidates
        .filter((entry) => entry.edge === "left")
        .sort((a, b) => a.sortValue - b.sortValue || Number(a.district?.id || 0) - Number(b.district?.id || 0)),
      bottom: edgeCandidates
        .filter((entry) => entry.edge === "bottom")
        .sort((a, b) => a.sortValue - b.sortValue || Number(a.district?.id || 0) - Number(b.district?.id || 0)),
      right: edgeCandidates
        .filter((entry) => entry.edge === "right")
        .sort((a, b) => a.sortValue - b.sortValue || Number(a.district?.id || 0) - Number(b.district?.id || 0))
    };

    const allCandidates = [...groupCandidates.left, ...groupCandidates.bottom, ...groupCandidates.right];
    const candidateById = new Map(allCandidates.map((entry) => [String(entry?.district?.id ?? ""), entry]));
    const edgeKeys = ["left", "bottom", "right"];
    const pairCandidates = [];

    allCandidates.forEach((entry) => {
      const entryId = String(entry?.district?.id ?? "");
      if (!entryId) return;
      const neighbors = adjacency.get(entry.district.id) || new Set();
      neighbors.forEach((neighborId) => {
        const neighborEntry = candidateById.get(String(neighborId));
        if (!neighborEntry) return;
        const neighborEntryId = String(neighborEntry?.district?.id ?? "");
        if (!neighborEntryId || entryId >= neighborEntryId) return;
        pairCandidates.push([entry, neighborEntry]);
      });
    });

    const canPlaceEntry = (entry, selectedIds) => {
      const neighbors = adjacency.get(entry.district.id) || new Set();
      for (const neighborId of neighbors) {
        if (selectedIds.has(String(neighborId))) return false;
      }
      return true;
    };

    const fillEdgeEntries = (edgeIndex, selectedEntries, selectedIds, countsByEdge) => {
      if (edgeIndex >= edgeKeys.length) return selectedEntries;
      const edgeKey = edgeKeys[edgeIndex];
      const needed = targetCounts[edgeKey] - (countsByEdge[edgeKey] || 0);
      if (needed < 0) return null;
      if (needed === 0) return fillEdgeEntries(edgeIndex + 1, selectedEntries, selectedIds, countsByEdge);

      const candidates = (groupCandidates[edgeKey] || []).filter((entry) => !selectedIds.has(String(entry?.district?.id ?? "")));
      const chooseEntries = (startIndex, remaining, nextEntries, nextIds) => {
        if (remaining === 0) {
          return fillEdgeEntries(edgeIndex + 1, nextEntries, nextIds, {
            ...countsByEdge,
            [edgeKey]: targetCounts[edgeKey]
          });
        }
        for (let i = startIndex; i <= candidates.length - remaining; i += 1) {
          const entry = candidates[i];
          const districtId = String(entry?.district?.id ?? "");
          if (!districtId || nextIds.has(districtId)) continue;
          if (!canPlaceEntry(entry, nextIds)) continue;
          nextIds.add(districtId);
          const result = chooseEntries(i + 1, remaining - 1, [...nextEntries, entry], nextIds);
          nextIds.delete(districtId);
          if (result) return result;
        }
        return null;
      };

      return chooseEntries(0, needed, selectedEntries, new Set(selectedIds));
    };

    let selected = null;
    let adjacentPair = null;
    let adjacentNeighbor = null;

    for (let i = 0; i < pairCandidates.length; i += 1) {
      const [firstEntry, secondEntry] = pairCandidates[i];
      const initialCounts = { left: 0, bottom: 0, right: 0 };
      initialCounts[firstEntry.edge] += 1;
      initialCounts[secondEntry.edge] += 1;
      if (edgeKeys.some((edgeKey) => initialCounts[edgeKey] > targetCounts[edgeKey])) continue;

      const seededEntries = [firstEntry, secondEntry];
      const seededIds = new Set(seededEntries.map((entry) => String(entry?.district?.id ?? "")));
      const completedSelection = fillEdgeEntries(0, seededEntries, seededIds, initialCounts);
      if (!completedSelection) continue;

      selected = completedSelection;
      adjacentPair = firstEntry;
      adjacentNeighbor = secondEntry;
      break;
    }

    if (!selected || !adjacentPair || !adjacentNeighbor) return emptyResult;

    const nickPool = [
      "Razor Vex", "Ghost Mara", "Nyx Prime", "Iron Shade", "Vortex Kane",
      "Black Comet", "Neon Riot", "Cobra Unit", "Urban Hex", "Steel Drift",
      "Zero Pulse", "Night Cipher", "Crimson Dot", "Volt Raven", "Silent Brick",
      "Alpha Dock", "Chrome Lynx", "Delta Wolf", "Shadow Mint", "Metro Hawk",
      "Apex Nova", "Toxic Ray", "Retro Kane", "Frost Mamba", "Street Rune"
    ];
    const usedNames = new Set();
    const claimUniqueNick = (value, fallbackIndex = 1) => {
      const base = String(value || "").trim() || `Hráč ${fallbackIndex}`;
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(normalizeOwnerName(candidate))) {
        candidate = `${base} ${suffix}`;
        suffix += 1;
      }
      usedNames.add(normalizeOwnerName(candidate));
      return candidate;
    };

    const players = [
      claimUniqueNick(ownerName || "Ty", 1),
      ...Array.from({ length: playerCount - 1 }, (_, index) => claimUniqueNick(nickPool[index % nickPool.length], index + 2))
    ];

    const ownerByDistrictId = new Map();
    ownerByDistrictId.set(adjacentPair.district.id, players[0]);
    ownerByDistrictId.set(adjacentNeighbor.district.id, players[1]);

    let playerIndex = 2;
    selected.forEach((entry) => {
      if (ownerByDistrictId.has(entry.district.id)) return;
      ownerByDistrictId.set(entry.district.id, players[playerIndex]);
      playerIndex += 1;
    });

    const nextDistricts = safeDistricts.map((district) => {
      const owner = ownerByDistrictId.get(district.id) || null;
      const ownerMeta = owner ? buildDemoDistrictOwnerMeta(owner, district) : {
        ownerStructure: null,
        ownerFaction: null,
        ownerAvatar: null,
        ownerAtmosphere: null
      };
      return {
        ...district,
        owner,
        ownerPlayerId: null,
        ownerNick: owner || null,
        ownerAllianceName: null,
        ...ownerMeta
      };
    });

    return {
      districts: nextDistricts,
      enemyOwners: players.slice(1),
      ownDistrictCount: 1,
      playerCount
    };
  }

  function buildNightTwentyWarScenario(districts, ownerName) {
    const safeDistricts = Array.isArray(districts) ? [...districts] : [];
    const emptyResult = {
      districts: [],
      alliedOwners: [],
      enemyOwners: [],
      attackIncidents: [],
      policeIncidents: [],
      ownDistrictCount: 0,
      ownAllianceName: "Žádná",
      ownAllianceMemberCount: 0,
      ownAllianceDistrictCount: 0,
      playerCount: 0,
      allianceCount: 0,
      minPerPlayer: 0,
      maxPerPlayer: 0
    };
    if (!safeDistricts.length) return emptyResult;

    const playerCount = Math.min(20, safeDistricts.length);
    if (playerCount < 1) return emptyResult;
    const maxAllianceSize = 2;
    const allianceCount = Math.max(1, Math.ceil(playerCount / maxAllianceSize));
    const allianceNames = [
      "Neon Syndicate",
      "Iron Wolves",
      "Black Harbor",
      "Vortex Pact",
      "Shadow Cartel",
      "Chrome Saints",
      "Ghost Ledger",
      "Riot Dividend",
      "Velvet Crown",
      "Night Blades"
    ];
    const nickPool = [
      "Knedlík", "Poltergeist", "Mariah", "Willy", "Ledovec",
      "Razor Vex", "Ghost Mara", "Nyx Prime", "Iron Shade", "Vortex Kane",
      "Black Comet", "Neon Riot", "Cobra Unit", "Urban Hex", "Steel Drift",
      "Zero Pulse", "Night Cipher", "Crimson Dot", "Volt Raven", "Silent Brick",
      "Alpha Dock", "Chrome Lynx", "Delta Wolf", "Shadow Mint", "Metro Hawk"
    ];
    const usedNames = new Set();
    const claimUniqueNick = (value, fallbackIndex = 1) => {
      const base = String(value || "").trim() || `Hráč ${fallbackIndex}`;
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(normalizeOwnerName(candidate))) {
        candidate = `${base} ${suffix}`;
        suffix += 1;
      }
      usedNames.add(normalizeOwnerName(candidate));
      return candidate;
    };

    const players = Array.from({ length: playerCount }, (_, index) => {
      const allianceIndex = Math.floor(index / maxAllianceSize);
      return {
        owner: index === 0 ? claimUniqueNick(ownerName || "Ty", 1) : claimUniqueNick(nickPool[index - 1], index + 1),
        allianceName: allianceNames[allianceIndex % allianceNames.length],
        allianceIndex,
        districtCount: 6,
        structure: null,
        avatar: null
      };
    }).map((player) => ({
      ...player,
      structure: resolveDemoOwnerFaction(player.owner),
      avatar: resolveDemoOwnerAvatar(player.owner),
      ...createDemoWeaponLoadout()
    }));

    const minTargetPerPlayer = 6;
    const maxTargetPerPlayer = 9;
    let remaining = Math.max(0, safeDistricts.length - (minTargetPerPlayer * playerCount));
    players.forEach((player, index) => {
      if (remaining <= 0) return;
      const add = Math.min(maxTargetPerPlayer - player.districtCount, (index % 3 === 0 ? 2 : 1), remaining);
      player.districtCount += add;
      remaining -= add;
    });
    let guard = 0;
    while (remaining > 0 && guard < 10000) {
      let progressed = false;
      for (let index = 0; index < players.length; index += 1) {
        if (remaining <= 0) break;
        const player = players[index];
        if (player.districtCount >= maxTargetPerPlayer) continue;
        player.districtCount += 1;
        remaining -= 1;
        progressed = true;
      }
      if (!progressed) break;
      guard += 1;
    }
    if (remaining > 0) {
      let cursor = 0;
      while (remaining > 0) {
        const player = players[cursor % players.length];
        player.districtCount += 1;
        remaining -= 1;
        cursor += 1;
      }
    }

    const allocations = players.map((player) => ({ owner: player.owner, count: player.districtCount }));
    let nextDistricts = assignOwnersToNeighborClusters(safeDistricts, allocations, {
      excludeTypes: []
    }).map((district) => ({ ...district, isDestroyed: false, destroyedAt: null }));

    const fallbackOwners = players.map((player) => player.owner);
    let fallbackCursor = 0;
    nextDistricts = nextDistricts.map((district) => {
      if (district?.owner) return district;
      const owner = fallbackOwners[fallbackCursor % fallbackOwners.length] || null;
      fallbackCursor += 1;
      return {
        ...district,
        owner,
        ownerNick: owner,
        ...buildDemoDistrictOwnerMeta(owner, district)
      };
    });

    const ownerAllianceByKey = new Map(players.map((player) => [normalizeOwnerName(player.owner), player.allianceName]));
    const allianceIconCycle = (Array.isArray(ALLIANCE_ICON_OPTIONS) ? ALLIANCE_ICON_OPTIONS : [])
      .map((icon) => String(icon?.key || "").trim())
      .filter(Boolean);
    const allianceIconByName = new Map(
      Array.from(new Set(players.map((player) => player.allianceName))).map((allianceName, index) => [
        allianceName,
        allianceIconCycle[index % allianceIconCycle.length]
      ])
    );
    nextDistricts = nextDistricts.map((district) => {
      const ownerKey = normalizeOwnerName(district?.owner);
      const allianceName = ownerAllianceByKey.get(ownerKey) || null;
      return {
        ...district,
        ownerNick: district?.owner || null,
        ownerAllianceName: allianceName,
        ownerAllianceIconKey: allianceName ? (allianceIconByName.get(allianceName) || null) : null,
        ...buildDemoDistrictOwnerMeta(district?.owner, district)
      };
    });

    const adjacency = buildDistrictAdjacency(nextDistricts);
    const boundaryPairs = [];
    const seenPairs = new Set();
    nextDistricts.forEach((district) => {
      const sourceId = district?.id;
      const sourceOwner = normalizeOwnerName(district?.owner);
      if (!sourceOwner) return;
      const neighbors = adjacency.get(sourceId) || new Set();
      neighbors.forEach((targetId) => {
        const targetDistrict = nextDistricts.find((entry) => String(entry?.id) === String(targetId));
        const targetOwner = normalizeOwnerName(targetDistrict?.owner);
        if (!targetOwner || targetOwner === sourceOwner) return;
        const key = String(sourceId) < String(targetId) ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
        if (seenPairs.has(key)) return;
        seenPairs.add(key);
        boundaryPairs.push({
          sourceDistrictId: sourceId,
          targetDistrictId: targetId,
          durationMs: 10 * 60 * 1000
        });
      });
    });

    const occupied = nextDistricts.filter((district) => district?.owner);
    const policeIncidents = [];
    const policeTargets = new Set();
    occupied
      .slice()
      .sort((left, right) => Number(right?.id || 0) - Number(left?.id || 0))
      .forEach((district) => {
        if (policeIncidents.length >= 2) return;
        const districtId = Number(district?.id);
        if (!Number.isFinite(districtId) || policeTargets.has(districtId)) return;
        policeTargets.add(districtId);
        policeIncidents.push({
          targetDistrictId: districtId,
          durationMs: 16 * 60 * 1000
        });
      });

    const attackIncidents = [];
    const attackerLoadByOwner = new Map();
    const sortedPairs = boundaryPairs
      .filter((pair) => {
        const sourceId = Number(pair?.sourceDistrictId);
        const targetId = Number(pair?.targetDistrictId);
        if (!Number.isFinite(sourceId) || !Number.isFinite(targetId)) return false;
        return !policeTargets.has(sourceId) && !policeTargets.has(targetId);
      })
      .sort((left, right) => Number(left.sourceDistrictId || 0) - Number(right.sourceDistrictId || 0));
    for (let index = 0; index < sortedPairs.length && attackIncidents.length < 20; index += 1) {
      const pair = sortedPairs[index];
      const sourceDistrict = nextDistricts.find((district) => String(district?.id) === String(pair?.sourceDistrictId));
      const attackerKey = normalizeOwnerName(sourceDistrict?.owner);
      if (!attackerKey) continue;
      const currentLoad = Number(attackerLoadByOwner.get(attackerKey) || 0);
      if (currentLoad >= 2) continue;
      attackIncidents.push(pair);
      attackerLoadByOwner.set(attackerKey, currentLoad + 1);
    }
    if (attackIncidents.length < 20) {
      const occupied = nextDistricts.filter((district) => district?.owner);
      for (let index = 0; index < occupied.length && attackIncidents.length < 20; index += 1) {
        const source = occupied[index];
        const target = occupied[(index + 3) % occupied.length];
        if (!source || !target || String(source.id) === String(target.id)) continue;
        if (normalizeOwnerName(source.owner) === normalizeOwnerName(target.owner)) continue;
        const sourceId = Number(source.id);
        const targetId = Number(target.id);
        if (!Number.isFinite(sourceId) || !Number.isFinite(targetId)) continue;
        if (policeTargets.has(sourceId) || policeTargets.has(targetId)) continue;
        const attackerKey = normalizeOwnerName(source.owner);
        if (!attackerKey) continue;
        const currentLoad = Number(attackerLoadByOwner.get(attackerKey) || 0);
        if (currentLoad >= 2) continue;
        const duplicate = attackIncidents.some((incident) =>
          String(incident?.sourceDistrictId) === String(source.id)
          && String(incident?.targetDistrictId) === String(target.id)
        );
        if (duplicate) continue;
        attackIncidents.push({
          sourceDistrictId: source.id,
          targetDistrictId: target.id,
          durationMs: 10 * 60 * 1000
        });
        attackerLoadByOwner.set(attackerKey, currentLoad + 1);
      }
    }

    const ownOwner = players[0]?.owner || String(ownerName || "Ty");
    const ownOwnerKey = normalizeOwnerName(ownOwner);
    const ownAllianceName = ownerAllianceByKey.get(ownOwnerKey) || "Žádná";
    const ownAllianceMembers = players.filter((player) => player.allianceName === ownAllianceName);
    const alliedOwners = ownAllianceMembers
      .map((player) => player.owner)
      .filter((playerOwner) => normalizeOwnerName(playerOwner) !== ownOwnerKey);
    const enemyOwners = players
      .filter((player) => player.allianceName !== ownAllianceName)
      .map((player) => player.owner);
    const ownDistrictCount = countOwnedDistrictsForOwner(nextDistricts, ownOwner);
    const ownAllianceDistrictCount = nextDistricts.reduce((sum, district) => {
      const ownerKey = normalizeOwnerName(district?.owner);
      if (!ownerKey) return sum;
      return ownerAllianceByKey.get(ownerKey) === ownAllianceName ? sum + 1 : sum;
    }, 0);
    const minPerPlayer = players.reduce((min, player) => Math.min(min, player.districtCount), Infinity);
    const maxPerPlayer = players.reduce((max, player) => Math.max(max, player.districtCount), 0);

    return {
      districts: nextDistricts,
      alliedOwners,
      enemyOwners,
      attackIncidents,
      policeIncidents,
      allianceIconEntries: Array.from(allianceIconByName.entries()),
      ownDistrictCount,
      ownAllianceName,
      ownAllianceMemberCount: ownAllianceMembers.length,
      ownAllianceDistrictCount,
      allianceMemberCap: maxAllianceSize,
      playerCount: players.length,
      allianceCount,
      minPerPlayer: Number.isFinite(minPerPlayer) ? minPerPlayer : 0,
      maxPerPlayer
    };
  }

  function countOwnedDistrictsForOwner(districts, ownerName) {
    const normalizedOwner = normalizeOwnerName(ownerName);
    if (!normalizedOwner) return 0;
    return (districts || []).reduce((sum, district) => {
      if (normalizeOwnerName(district.owner) === normalizedOwner) return sum + 1;
      return sum;
    }, 0);
  }

  function pickClusterSeed(available, districtCenters, ownerIndex, ownerCount) {
    const ranked = Array.from(available).sort((a, b) => {
      const centerA = districtCenters.get(a) || { x: 0, y: 0 };
      const centerB = districtCenters.get(b) || { x: 0, y: 0 };
      if (centerA.x === centerB.x) return centerA.y - centerB.y;
      return centerA.x - centerB.x;
    });
    if (!ranked.length) return null;
    if (ranked.length === 1) return ranked[0];
    const ratio = (ownerIndex + 0.5) / Math.max(ownerCount, 1);
    const index = Math.min(ranked.length - 1, Math.max(0, Math.round(ratio * (ranked.length - 1))));
    return ranked[index];
  }

  function growDistrictCluster({ seedId, targetSize, available, neighborsByDistrict, districtCenters }) {
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
      const nextFromFrontier = pickNearestToCluster(frontier, cluster, districtCenters, clusterSet);
      let nextId = nextFromFrontier;
      if (!nextId) {
        nextId = pickNearestToCluster(available, cluster, districtCenters, clusterSet);
      }
      if (!nextId) break;
      cluster.push(nextId);
      clusterSet.add(nextId);
      frontier.delete(nextId);
      pushNeighbors(nextId);
    }

    return cluster;
  }

  function pickNearestToCluster(candidates, cluster, districtCenters, clusterSet) {
    let bestId = null;
    let bestDistance = Infinity;
    candidates.forEach((candidateId) => {
      if (clusterSet.has(candidateId)) return;
      const distance = distanceToCluster(candidateId, cluster, districtCenters);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = candidateId;
      }
    });
    return bestId;
  }

  function distanceToCluster(candidateId, cluster, districtCenters) {
    const from = districtCenters.get(candidateId) || { x: 0, y: 0 };
    let best = Infinity;
    for (let i = 0; i < cluster.length; i += 1) {
      const to = districtCenters.get(cluster[i]) || { x: 0, y: 0 };
      const distance = Math.hypot(from.x - to.x, from.y - to.y);
      if (distance < best) best = distance;
    }
    return best;
  }

  function buildDistrictAdjacency(districts) {
    const adjacency = new Map((districts || []).map((district) => [district.id, new Set()]));
    const edgeOwners = new Map();

    (districts || []).forEach((district) => {
      const polygon = Array.isArray(district.polygon) ? district.polygon : [];
      if (polygon.length < 2) return;
      for (let i = 0; i < polygon.length; i += 1) {
        const from = polygon[i];
        const to = polygon[(i + 1) % polygon.length];
        const edgeKey = normalizeEdgeKey(from, to);
        if (!edgeOwners.has(edgeKey)) edgeOwners.set(edgeKey, []);
        edgeOwners.get(edgeKey).push(district.id);
      }
    });

    edgeOwners.forEach((ownerIds) => {
      const unique = Array.from(new Set(ownerIds));
      for (let i = 0; i < unique.length; i += 1) {
        for (let j = i + 1; j < unique.length; j += 1) {
          const a = unique[i];
          const b = unique[j];
          adjacency.get(a)?.add(b);
          adjacency.get(b)?.add(a);
        }
      }
    });

    return adjacency;
  }

  function normalizeEdgeKey(from, to) {
    const a = normalizePointKey(from);
    const b = normalizePointKey(to);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function normalizePointKey(point) {
    const x = Number(point?.[0] || 0).toFixed(3);
    const y = Number(point?.[1] || 0).toFixed(3);
    return `${x},${y}`;
  }

  function resolveScenarioOwnerName() {
    return getPlayerIdentityHelpers()?.resolveScenarioOwnerName?.()
      || (
        cachedProfile?.gangName
        || cachedProfile?.username
        || readStoredGangName()
        || readStoredGuestUsername()
        || "Tvůj gang"
      );
  }

  function resolveCurrentPlayerOwnerLabel() {
    return getPlayerIdentityHelpers()?.resolveCurrentPlayerOwnerLabel?.()
      || String(resolveScenarioOwnerName() || "Ty");
  }

  function resolveCurrentPlayerNick() {
    return getPlayerIdentityHelpers()?.resolveCurrentPlayerNick?.()
      || String(
        cachedProfile?.username
        || cachedProfile?.name
        || window.Empire.player?.username
        || window.Empire.player?.name
        || readStoredGuestUsername()
        || "Neznámý hráč"
      ).trim()
      || "Neznámý hráč";
  }

  function resolveCurrentPlayerGangName() {
    return getPlayerIdentityHelpers()?.resolveCurrentPlayerGangName?.()
      || String(
        cachedProfile?.gangName
        || cachedProfile?.gang_name
        || window.Empire.player?.gangName
        || window.Empire.player?.gang_name
        || readStoredGangName()
        || resolveScenarioOwnerName()
        || "Neznámý gang"
      ).trim()
      || "Neznámý gang";
  }

  function resolveCurrentPlayerAllianceName() {
    return getPlayerIdentityHelpers()?.resolveCurrentPlayerAllianceName?.()
      || String(
        resolvePlayerAllianceVisualMeta()?.name
        || cachedProfile?.alliance
        || window.Empire.player?.alliance
        || "Bez aliance"
      ).trim()
      || "Bez aliance";
  }

  function formatSpyDetectionAlertTime(timestamp) {
    return getPlayerIdentityHelpers()?.formatSpyDetectionAlertTime?.(timestamp) || "";
  }

  function resolveCurrentPlayerOwnerKey() {
    return getPlayerIdentityHelpers()?.resolveCurrentPlayerOwnerKey?.()
      || normalizeOwnerName(resolveCurrentPlayerOwnerLabel())
      || "player";
  }

  function readLocalDistrictDefenseAssignments() {
    return getPlayerDefenseStorageHelpers()?.readLocalDistrictDefenseAssignments?.() || {};
  }

  function writeLocalDistrictDefenseAssignments(store) {
    return getPlayerDefenseStorageHelpers()?.writeLocalDistrictDefenseAssignments?.(store);
  }

  function countSelectedDefenseWeapons(selection = {}) {
    return getPlayerDefenseStorageHelpers()?.countSelectedDefenseWeapons?.(selection) || 0;
  }

  function sanitizeDefenseSelection(selection = {}) {
    return getPlayerDefenseStorageHelpers()?.sanitizeDefenseSelection?.(selection) || {};
  }

  function getDistrictDefenseAssignmentForCurrentPlayer(districtId) {
    return getPlayerDefenseStorageHelpers()?.getDistrictDefenseAssignmentForCurrentPlayer?.(districtId) || null;
  }

  function saveDistrictDefenseAssignment(district, selection = {}, members = 0, power = 0) {
    return getPlayerDefenseStorageHelpers()?.saveDistrictDefenseAssignment?.(district, selection, members, power) || null;
  }

  function resolveDistrictDefenseEntryByKeys(districtStore, ownerKeys = new Set()) {
    return getPlayerDefenseStorageHelpers()?.resolveDistrictDefenseEntryByKeys?.(districtStore, ownerKeys) || null;
  }

  function getDistrictDefenseSnapshot(districtId) {
    return getPlayerDefenseSnapshotHelpers()?.getDistrictDefenseSnapshot?.(districtId) || {
      self: { label: "Ty", weapons: null, members: null, power: null, hasData: false },
      ally: { label: "Spojenec", weapons: null, members: null, power: null, hasData: false }
    };
  }

  const victorGraveEvents = [
    { id: "victor_01", title: "Rozbitá dodávka", giver: "Victor Grave Kadeř", text: "Jedna dodávka zůstala viset v cizím bloku. Dojeď tam, seber bedny a zmiz dřív, než si toho někdo všimne.", reward: { metalParts: 5, cash: 800, influence: 2 }, risk: { heat: 3 }, successRate: 82, durationMin: 18 },
    { id: "victor_02", title: "Tvrdé vyjednávání", giver: "Victor Grave Kadeř", text: "Jeden obchodník zapomněl, komu má platit. Připomeň mu to po mém.", reward: { cash: 1400, influence: 4 }, risk: { heat: 4 }, successRate: 78, durationMin: 22 },
    { id: "victor_03", title: "Sklad bez majitele", giver: "Victor Grave Kadeř", text: "Ve skladu leží materiál a nikdo ho zrovna nehlídá dost dobře. Udělej to rychle.", reward: { chemical: 4, metalParts: 4, cash: 500 }, risk: { heat: 3 }, successRate: 80, durationMin: 20 },
    { id: "victor_04", title: "Noční výběr", giver: "Victor Grave Kadeř", text: "Po zavíračce bývá město měkký. Vytáhni z toho maximum, než se vzpamatuje.", reward: { dirtyCash: 1800, influence: 3 }, risk: { heat: 5 }, successRate: 74, durationMin: 25 },
    { id: "victor_05", title: "Převoz pod tlakem", giver: "Victor Grave Kadeř", text: "Materiál musí projít přes horkou zónu. Když to zvládneš, lidi si tě začnou pamatovat.", reward: { techCore: 2, cash: 900, influence: 3 }, risk: { heat: 4 }, successRate: 73, durationMin: 24 },
    { id: "victor_06", title: "Rozkopané dveře", giver: "Victor Grave Kadeř", text: "Za těma dveřma je schovaná zásoba. Otevři je po svém, já se ptát nebudu.", reward: { streetPistol: 1, metalParts: 3, influence: 2 }, risk: { heat: 4 }, successRate: 76, durationMin: 19 },
    { id: "victor_07", title: "Tichá lekce", giver: "Victor Grave Kadeř", text: "Jeden malej hráč moc mluví. Nemusí zmizet, stačí aby začal šeptat.", reward: { influence: 6, cash: 700 }, risk: { heat: 3 }, successRate: 84, durationMin: 17 },
    { id: "victor_08", title: "Neonový kufr", giver: "Victor Grave Kadeř", text: "Na rohu čeká kufr, kterej nemá dlouho zůstat bez majitele. Buď rychlej.", reward: { neonViper: 3, cash: 600, influence: 2 }, risk: { heat: 4 }, successRate: 77, durationMin: 16 },
    { id: "victor_09", title: "Smrad z lékárny", giver: "Victor Grave Kadeř", text: "Z jedný lékárny odtéká víc chemie, než je zdravý. Jdi po tom.", reward: { chemical: 6, cash: 500 }, risk: { heat: 3 }, successRate: 83, durationMin: 15 },
    { id: "victor_10", title: "Ochlazení konkurence", giver: "Victor Grave Kadeř", text: "Někdo vedle nás roste moc rychle. Ukaž mu, že asfalt má vždycky poslední slovo.", reward: { influence: 7, dirtyCash: 900 }, risk: { heat: 6 }, successRate: 70, durationMin: 28 },
    { id: "victor_11", title: "Pouliční test loajality", giver: "Victor Grave Kadeř", text: "Ne každej pod tlakem drží hubu. Ověř, kdo je pevnej a kdo je hadr.", reward: { influence: 5, cash: 750 }, risk: { heat: 2 }, successRate: 86, durationMin: 14 },
    { id: "victor_12", title: "Dvě minuty po půlnoci", giver: "Victor Grave Kadeř", text: "V noci mizí kamery, svědci i zábrany. Přesně proto jdeme teď.", reward: { smg: 1, ammo: 20, influence: 3 }, risk: { heat: 5 }, successRate: 68, durationMin: 26 },
    { id: "victor_13", title: "Balík pro špatnou adresu", giver: "Victor Grave Kadeř", text: "Někdo čeká zásilku. Jen škoda, že ji čeká marně.", reward: { overdriveX: 2, cash: 850, influence: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 18 },
    { id: "victor_14", title: "Krev na parkovišti", giver: "Victor Grave Kadeř", text: "Na parkovišti se má uzavřít obchod. Udělej z toho náš obchod.", reward: { dirtyCash: 2000, metalParts: 2 }, risk: { heat: 6 }, successRate: 66, durationMin: 27 },
    { id: "victor_15", title: "Kdo stojí, ten bere", giver: "Victor Grave Kadeř", text: "Některý rajóny patří těm, co v nich vydrží stát nejdýl. Dneska tam budeš stát ty.", reward: { influence: 8, cash: 1000 }, risk: { heat: 5 }, successRate: 72, durationMin: 30 },
    { id: "victor_16", title: "Rozebraná zbrojnice", giver: "Victor Grave Kadeř", text: "Mám tip na rozebranou dílnu. Posbírej všechno, co ještě střílí nebo se dá prodat.", reward: { streetPistol: 1, metalParts: 5, techCore: 1 }, risk: { heat: 4 }, successRate: 75, durationMin: 23 },
    { id: "victor_17", title: "Uražená hrdost", giver: "Victor Grave Kadeř", text: "Jeden blbec se chtěl zviditelnit na cizím jménu. Teď mu vysvětli, že to byl drahej nápad.", reward: { influence: 6, dirtyCash: 1100 }, risk: { heat: 5 }, successRate: 74, durationMin: 21 },
    { id: "victor_18", title: "Pád z nákladní rampy", giver: "Victor Grave Kadeř", text: "Na rampě stojí zboží, co má změnit majitele. Vezmi ho a nic neřeš.", reward: { metalParts: 6, chemical: 3, cash: 600 }, risk: { heat: 4 }, successRate: 81, durationMin: 19 },
    { id: "victor_19", title: "Hlasitý vzkaz", giver: "Victor Grave Kadeř", text: "Někdy nestačí někoho okrást. Někdy musí celej blok vědět, kdo to udělal.", reward: { influence: 9, cash: 900 }, risk: { heat: 7 }, successRate: 64, durationMin: 24 },
    { id: "victor_20", title: "Mokrý prachy", giver: "Victor Grave Kadeř", text: "U vody čeká malej přesun peněz. Když se zdržíš, někdo jiný si namočí ruce místo tebe.", reward: { dirtyCash: 2200, influence: 2 }, risk: { heat: 5 }, successRate: 71, durationMin: 22 },
    { id: "victor_21", title: "Starý dluh, nová bolest", giver: "Victor Grave Kadeř", text: "Starej dluh se dnes zavře. Otázka je jen, jestli penězma nebo zubama.", reward: { cash: 1600, influence: 4 }, risk: { heat: 4 }, successRate: 79, durationMin: 20 },
    { id: "victor_22", title: "Kontejner číslo 9", giver: "Victor Grave Kadeř", text: "V kontejneru číslo 9 leží věci, co nemají vidět ráno. Otevři ho dřív než ostatní.", reward: { techCore: 3, metalParts: 3, cash: 700 }, risk: { heat: 4 }, successRate: 76, durationMin: 18 },
    { id: "victor_23", title: "Měkký cíl", giver: "Victor Grave Kadeř", text: "Slabej článek řetězu bývá nejlevnější cesta dovnitř. Využij to.", reward: { influence: 5, spyGear: 1, cash: 500 }, risk: { heat: 3 }, successRate: 85, durationMin: 16 },
    { id: "victor_24", title: "Velvet Smoke v kufru", giver: "Victor Grave Kadeř", text: "V kufru čeká pár balení Velvet Smoke. Převezmi to, než se z toho stane cizí zisk.", reward: { velvetSmoke: 5, cash: 500, influence: 2 }, risk: { heat: 3 }, successRate: 84, durationMin: 15 },
    { id: "victor_25", title: "Křik v zadní uličce", giver: "Victor Grave Kadeř", text: "Zadní uličky jsou moje kancelář. Dneska tam někomu zrušíš pracovní poměr.", reward: { dirtyCash: 1200, influence: 5 }, risk: { heat: 5 }, successRate: 73, durationMin: 19 },
    { id: "victor_26", title: "Rychlý výkup", giver: "Victor Grave Kadeř", text: "Jeden zoufalec prodává materiál hluboko pod cenou. Seber to všechno, než dostane rozum.", reward: { chemical: 5, metalParts: 5, cash: 300 }, risk: { heat: 2 }, successRate: 88, durationMin: 12 },
    { id: "victor_27", title: "Tlak na rohu", giver: "Victor Grave Kadeř", text: "Na jednom rohu se rozdává respekt zadarmo. To je chyba, kterou dnes opravíš.", reward: { influence: 7, cash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "victor_28", title: "Spadlá bedna", giver: "Victor Grave Kadeř", text: "Někde spadla bedna z transportu. Kdo ji najde první, ten určuje pravidla.", reward: { grenade: 2, metalParts: 2, cash: 400 }, risk: { heat: 4 }, successRate: 77, durationMin: 14 },
    { id: "victor_29", title: "Přepálená dávka", giver: "Victor Grave Kadeř", text: "Někdo vaří moc nahlas a moc blízko. Vlez tam, seber vzorek a zbytek nech rozpadnout.", reward: { ghostSerum: 2, chemical: 3, influence: 3 }, risk: { heat: 5 }, successRate: 69, durationMin: 23 },
    { id: "victor_30", title: "Drobní, ale naši", giver: "Victor Grave Kadeř", text: "Malí dealeři se začínají dívat jinam. Připomeň jim, kde končí každá ulice.", reward: { cash: 1300, influence: 6 }, risk: { heat: 4 }, successRate: 78, durationMin: 20 },
    { id: "victor_31", title: "Tichá zbroj", giver: "Victor Grave Kadeř", text: "Mám kontakt na vybavení, co nechodí přes papíry. Vyber to a neotáčej se.", reward: { bulletproofVest: 1, streetPistol: 1, cash: 300 }, risk: { heat: 3 }, successRate: 82, durationMin: 16 },
    { id: "victor_32", title: "Vyděšený účetní", giver: "Victor Grave Kadeř", text: "Jeden účetní ví, kam tečou peníze. A dneska bude chtít mluvit rychle.", reward: { dirtyCash: 1700, influence: 4, intel: 1 }, risk: { heat: 5 }, successRate: 72, durationMin: 21 },
    { id: "victor_33", title: "První rána zdarma", giver: "Victor Grave Kadeř", text: "Dneska nejde o kořist. Dneska jde o to, kdo dá první ránu a kdo si ji zapamatuje.", reward: { influence: 8, cash: 600 }, risk: { heat: 6 }, successRate: 67, durationMin: 18 },
    { id: "victor_34", title: "Rozbitý automat", giver: "Victor Grave Kadeř", text: "Někdo schovává peníze tam, kde si myslí, že vypadají nevinně. Rozbij to a vezmi obsah.", reward: { cash: 1500, dirtyCash: 500 }, risk: { heat: 3 }, successRate: 85, durationMin: 13 },
    { id: "victor_35", title: "Krátká návštěva v docku", giver: "Victor Grave Kadeř", text: "V doku kotví něco, co tam nemá vydržet do rána. Přesuneme to dřív.", reward: { techCore: 2, chemical: 4, cash: 700 }, risk: { heat: 5 }, successRate: 74, durationMin: 24 },
    { id: "victor_36", title: "Neonový nátlak", giver: "Victor Grave Kadeř", text: "Jeden klub má dneska přinést víc než hudbu. Vlez tam, zatlač a vytáhni z toho hodnotu.", reward: { dirtyCash: 1900, neonViper: 2, influence: 3 }, risk: { heat: 6 }, successRate: 68, durationMin: 25 },
    { id: "victor_37", title: "Kov a krev", giver: "Victor Grave Kadeř", text: "Tam, kde je kov, bývá i zisk. Tam, kde je zisk, bývá i problém. Dneska si vezmeš oboje.", reward: { metalParts: 7, cash: 600, influence: 2 }, risk: { heat: 4 }, successRate: 80, durationMin: 18 },
    { id: "victor_38", title: "Tlačenice u zadního vstupu", giver: "Victor Grave Kadeř", text: "Zadní vstup je vždycky levnější než fronta. A mnohem výnosnější.", reward: { smg: 1, cash: 500, influence: 3 }, risk: { heat: 5 }, successRate: 71, durationMin: 20 },
    { id: "victor_39", title: "Stůl pro dva, problém pro jednoho", giver: "Victor Grave Kadeř", text: "V restauraci proběhne schůzka. Ty se postaráš, aby domů neodnesli všechno, co přinesli.", reward: { cash: 1800, intel: 1, influence: 2 }, risk: { heat: 4 }, successRate: 77, durationMin: 22 },
    { id: "victor_40", title: "Zkušební tlak", giver: "Victor Grave Kadeř", text: "Chci vidět, jak makáš, když tě někdo tlačí do zdi. Tahle práce je přesně na to.", reward: { influence: 6, techCore: 1, cash: 400 }, risk: { heat: 3 }, successRate: 83, durationMin: 15 },
    { id: "victor_41", title: "Bazuka ve stínu", giver: "Victor Grave Kadeř", text: "Někdo schoval těžší kus železa tam, kde se bojí pro něj vrátit. To není náš problém.", reward: { bazooka: 1, ammo: 4, influence: 4 }, risk: { heat: 7 }, successRate: 58, durationMin: 30 },
    { id: "victor_42", title: "Hluk před bouří", giver: "Victor Grave Kadeř", text: "Celý blok je nervózní. To je nejlepší chvíle sebrat to, co není přibitý.", reward: { cash: 1100, metalParts: 4, influence: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 18 },
    { id: "victor_43", title: "Ztracený kamerový záznam", giver: "Victor Grave Kadeř", text: "Někdo si myslí, že ho chrání záznam. Zmizí záznam, zmizí i jeho jistota.", reward: { securityCameras: 1, intel: 1, cash: 500 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "victor_44", title: "Převzetí směny", giver: "Victor Grave Kadeř", text: "Končí směna, začíná chaos. Přesně v tom chaosu vyděláš nejvíc.", reward: { dirtyCash: 1600, chemical: 2, influence: 3 }, risk: { heat: 4 }, successRate: 81, durationMin: 17 },
    { id: "victor_45", title: "Když se nikdo neptá", giver: "Victor Grave Kadeř", text: "Tohle je ten druh práce, kde nikdo nic neviděl a nikdo nic neví. Mám tyhle práce rád.", reward: { ghostSerum: 3, cash: 600, influence: 2 }, risk: { heat: 2 }, successRate: 87, durationMin: 13 },
    { id: "victor_46", title: "Rozpal ulici", giver: "Victor Grave Kadeř", text: "Dneska nechci čistou práci. Dneska chci, aby se o tom mluvilo ještě zítra ráno.", reward: { influence: 10, dirtyCash: 800 }, risk: { heat: 8 }, successRate: 60, durationMin: 26 },
    { id: "victor_47", title: "Pod pultem", giver: "Victor Grave Kadeř", text: "Jeden obchod má vzadu něco lepšího než ve výloze. Jdi si pro to.", reward: { overdriveX: 2, velvetSmoke: 3, cash: 400 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "victor_48", title: "Zlomený alarm", giver: "Victor Grave Kadeř", text: "Alarm se dá vypnout dvěma způsoby. Já mám radši ten hlučnější.", reward: { alarm: 1, metalParts: 3, cash: 500 }, risk: { heat: 5 }, successRate: 73, durationMin: 19 },
    { id: "victor_49", title: "Síla bez omluvy", giver: "Victor Grave Kadeř", text: "Někdy je plán přeceňovanej. Vleť tam, udělej tlak a odejdi silnější než jsi přišel.", reward: { influence: 9, cash: 900, streetPistol: 1 }, risk: { heat: 6 }, successRate: 69, durationMin: 21 },
    { id: "victor_50", title: "Ulice si pamatuje", giver: "Victor Grave Kadeř", text: "Tohle není jen práce. Tohle je podpis. Udělej to tak, aby si město zapamatovalo, kdo tady určuje rytmus.", reward: { influence: 12, dirtyCash: 1400, techCore: 2 }, risk: { heat: 7 }, successRate: 63, durationMin: 29 },
    { id: "victor_51", title: "Rozkopnutý sklad", giver: "Victor Grave Kadeř", text: "Někdo si myslí, že plechové dveře znamenají bezpečí. Dneska zjistí, že jsou to jen dražší třísky.", reward: { metalParts: 6, cash: 900, influence: 3 }, risk: { heat: 4 }, successRate: 79, durationMin: 19 },
    { id: "victor_52", title: "Cizí roh", giver: "Victor Grave Kadeř", text: "Na našem území si někdo staví vlastní jméno. Sejmi tu pohádku dřív, než jí někdo uvěří.", reward: { influence: 7, dirtyCash: 1000 }, risk: { heat: 5 }, successRate: 75, durationMin: 21 },
    { id: "victor_53", title: "Závora dolů", giver: "Victor Grave Kadeř", text: "Jeden vjezd se dnes na chvíli zavře. A všechno, co zůstane uvnitř, bude naše.", reward: { chemical: 4, metalParts: 4, cash: 700 }, risk: { heat: 4 }, successRate: 81, durationMin: 18 },
    { id: "victor_54", title: "Ruce na kapotu", giver: "Victor Grave Kadeř", text: "Na parkovišti stojí auto, co veze víc než plech. Otevři ho a vyber, co se hodí.", reward: { techCore: 2, cash: 800, influence: 2 }, risk: { heat: 4 }, successRate: 77, durationMin: 17 },
    { id: "victor_55", title: "Krátká porada", giver: "Victor Grave Kadeř", text: "Jeden chytrák potřebuje vysvětlit realitu. Ty budeš ten výukový materiál.", reward: { influence: 6, cash: 900 }, risk: { heat: 3 }, successRate: 84, durationMin: 15 },
    { id: "victor_56", title: "Prachy v mrazáku", giver: "Victor Grave Kadeř", text: "Někteří lidi schovávají peníze vedle masa. Dneska rozmrazíš jejich jistoty.", reward: { dirtyCash: 1800, influence: 2 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "victor_57", title: "Přeložená zásilka", giver: "Victor Grave Kadeř", text: "Jedna bedna má změnit adresu dřív, než změří teplotu skladu. Nezdržuj se.", reward: { chemical: 5, cash: 600, influence: 2 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "victor_58", title: "Těžká pěst", giver: "Victor Grave Kadeř", text: "Někde nestačí mluvit. Někde musíš nechat odpověď otisknutou ve zdi.", reward: { influence: 8, dirtyCash: 700 }, risk: { heat: 5 }, successRate: 72, durationMin: 20 },
    { id: "victor_59", title: "Chybná směna", giver: "Victor Grave Kadeř", text: "Ve směnárně mají dneska špatný kurz. Pro ně. Pro nás je to výdělek.", reward: { cash: 1600, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "victor_60", title: "Noční inventura", giver: "Victor Grave Kadeř", text: "V noci se nejlíp počítá cizí majetek. Zvlášť když si ho ráno už nikdo nespočítá.", reward: { metalParts: 5, techCore: 1, cash: 700 }, risk: { heat: 4 }, successRate: 79, durationMin: 19 },
    { id: "victor_61", title: "Rozlitá krev, čistý zisk", giver: "Victor Grave Kadeř", text: "Někdo si chtěl hrát na tvrdýho. Nech mu tvrdou lekci a měkký kolena.", reward: { influence: 9, cash: 1000 }, risk: { heat: 6 }, successRate: 68, durationMin: 23 },
    { id: "victor_62", title: "Balík pod mostem", giver: "Victor Grave Kadeř", text: "Pod mostem čeká balík bez majitele. A když ho nevezmeš ty, vezme ho někdo rychlejší.", reward: { velvetSmoke: 4, cash: 500, influence: 2 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "victor_63", title: "Vymáhání po staru", giver: "Victor Grave Kadeř", text: "Ten dluh je malej jen na papíře. Udělej z něj velkej problém, dokud nebude splacenej.", reward: { cash: 1500, influence: 5 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "victor_64", title: "Přístup jen pro tvrdé", giver: "Victor Grave Kadeř", text: "Za zadním vstupem leží věci pro lidi bez skrupulí. Tak tam běž jako domů.", reward: { streetPistol: 1, metalParts: 3, cash: 500 }, risk: { heat: 4 }, successRate: 76, durationMin: 16 },
    { id: "victor_65", title: "Vybitý kamerový dohled", giver: "Victor Grave Kadeř", text: "Někdo se spoléhá na kamery. Dneska mu ukážeš, že kabely křičí míň než lidi.", reward: { securityCameras: 1, influence: 3, cash: 400 }, risk: { heat: 3 }, successRate: 83, durationMin: 14 },
    { id: "victor_66", title: "Tři minuty strachu", giver: "Victor Grave Kadeř", text: "Stačí tři minuty a celej blok začne šeptat. Udělej z nich dlouhý tři minuty.", reward: { influence: 8, dirtyCash: 900 }, risk: { heat: 6 }, successRate: 69, durationMin: 18 },
    { id: "victor_67", title: "Lékárna po zavíračce", giver: "Victor Grave Kadeř", text: "Po zavíračce zůstává uvnitř víc než jen světla. Posbírej to, co má cenu.", reward: { chemical: 6, ghostSerum: 1, cash: 500 }, risk: { heat: 4 }, successRate: 81, durationMin: 18 },
    { id: "victor_68", title: "Narušený deal", giver: "Victor Grave Kadeř", text: "Dva lidi se chtějí domluvit bez nás. To je chyba, kterou je potřeba zpeněžit.", reward: { dirtyCash: 1700, influence: 3 }, risk: { heat: 5 }, successRate: 74, durationMin: 20 },
    { id: "victor_69", title: "Otevřený kufr", giver: "Victor Grave Kadeř", text: "Kufr je otevřenej, nervy taky. Vezmi všechno, co uneseš, a zmiz dřív než cvakne zámek.", reward: { overdriveX: 2, cash: 700, influence: 2 }, risk: { heat: 4 }, successRate: 78, durationMin: 15 },
    { id: "victor_70", title: "Směna skončila", giver: "Victor Grave Kadeř", text: "Když lidi končí směnu, dělají chyby. Ty na těch chybách dneska vyděláš.", reward: { cash: 1300, metalParts: 4 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "victor_71", title: "Přetlačená ulice", giver: "Victor Grave Kadeř", text: "Na tý ulici je moc cizích ramen a málo našeho jména. Vyrovnej to.", reward: { influence: 7, cash: 900 }, risk: { heat: 5 }, successRate: 76, durationMin: 19 },
    { id: "victor_72", title: "Náklad bez pojištění", giver: "Victor Grave Kadeř", text: "Jeden převoz nemá ochranu ani štěstí. Přesně takový věci mám rád.", reward: { techCore: 2, chemical: 3, cash: 600 }, risk: { heat: 4 }, successRate: 80, durationMin: 18 },
    { id: "victor_73", title: "Páka na účetního", giver: "Victor Grave Kadeř", text: "Účetní nejsou tvrdí. Jen vypadají draze. Stlač ho a pustí víc, než čekáš.", reward: { dirtyCash: 1500, influence: 4 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "victor_74", title: "Betonová lekce", giver: "Victor Grave Kadeř", text: "Dneska někdo pochopí, že beton je tvrdší než jeho ego. Ty budeš ten překlad.", reward: { influence: 9, cash: 800 }, risk: { heat: 6 }, successRate: 67, durationMin: 21 },
    { id: "victor_75", title: "Špinavý schody", giver: "Victor Grave Kadeř", text: "Ve vchodu se schází lidi, co zapomněli platit za klid. Připomeň jim sazebník.", reward: { cash: 1400, dirtyCash: 400, influence: 3 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "victor_76", title: "Nedodaná bedna", giver: "Victor Grave Kadeř", text: "Jeden zákazník dneska nic nedostane. Protože všechno skončí v tvých rukách.", reward: { grenade: 2, metalParts: 2, cash: 500 }, risk: { heat: 5 }, successRate: 73, durationMin: 19 },
    { id: "victor_77", title: "Přesun pod tlakem", giver: "Victor Grave Kadeř", text: "Musíš dostat zásobu přes místo, kde všichni čumí. To je přesně chvíle, kdy se pozná, kdo má nervy.", reward: { velvetSmoke: 5, cash: 600, influence: 3 }, risk: { heat: 5 }, successRate: 71, durationMin: 22 },
    { id: "victor_78", title: "Vyrvaná jistota", giver: "Victor Grave Kadeř", text: "Jeden člověk je moc v pohodě. A pohodlí na ulici bývá dočasná věc.", reward: { influence: 6, dirtyCash: 1000 }, risk: { heat: 4 }, successRate: 81, durationMin: 15 },
    { id: "victor_79", title: "Nabouraný převoz", giver: "Victor Grave Kadeř", text: "Nehoda se dá zařídit různě. Hlavní je, aby po ní zůstalo něco použitelného.", reward: { metalParts: 6, cash: 700, influence: 2 }, risk: { heat: 5 }, successRate: 72, durationMin: 20 },
    { id: "victor_80", title: "Půlnoční výběrčí", giver: "Victor Grave Kadeř", text: "Po půlnoci bývají lidi štědřejší. Hlavně když mají důvod se bát odmítnout.", reward: { cash: 1700, influence: 4 }, risk: { heat: 5 }, successRate: 75, durationMin: 18 },
    { id: "victor_81", title: "Cizí železo", giver: "Victor Grave Kadeř", text: "V dílně zůstalo pár kusů železa bez dozoru. Tak tam nechoď pro dovolení.", reward: { metalParts: 7, techCore: 1, cash: 400 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "victor_82", title: "Vysoký tlak, nízký hlas", giver: "Victor Grave Kadeř", text: "Někdo mluví moc nahlas o věcech, co by měly zůstat pod stolem. Ztiš ho.", reward: { influence: 8, dirtyCash: 800 }, risk: { heat: 5 }, successRate: 74, durationMin: 17 },
    { id: "victor_83", title: "Slepý roh", giver: "Victor Grave Kadeř", text: "Na slepým rohu se dneska ztratí jedna zásilka a několik iluzí.", reward: { ghostSerum: 2, cash: 600, influence: 2 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "victor_84", title: "Rozjetej motor", giver: "Victor Grave Kadeř", text: "Motor běží, řidič je nervózní a náklad je cennej. Stačí být rychlejší než panika.", reward: { cash: 1200, chemical: 4, influence: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 18 },
    { id: "victor_85", title: "Pevná ruka", giver: "Victor Grave Kadeř", text: "Někdy je rozdíl mezi chaosem a respektem jen v tom, kdo drží situaci za krk.", reward: { influence: 10, cash: 700 }, risk: { heat: 6 }, successRate: 66, durationMin: 22 },
    { id: "victor_86", title: "Podlomený obchod", giver: "Victor Grave Kadeř", text: "Jeden podnik dneska vydělá míň, než čekal. Protože část zisku půjde domů s tebou.", reward: { dirtyCash: 1600, cash: 500, influence: 2 }, risk: { heat: 4 }, successRate: 81, durationMin: 17 },
    { id: "victor_87", title: "Špatně zamčený box", giver: "Victor Grave Kadeř", text: "Box je zamčenej jen pro slušný lidi. Ty tam nejdeš slušně.", reward: { streetPistol: 1, overdriveX: 1, cash: 400 }, risk: { heat: 4 }, successRate: 77, durationMin: 15 },
    { id: "victor_88", title: "Řeči z okna", giver: "Victor Grave Kadeř", text: "Někdo se dívá z okna a myslí si, že je mimo hru. Připomeň mu, že ulice sahá výš.", reward: { influence: 7, cash: 800 }, risk: { heat: 5 }, successRate: 73, durationMin: 18 },
    { id: "victor_89", title: "Kyselý náklad", giver: "Victor Grave Kadeř", text: "Jedna várka chemie se má ztratit cestou. Tak jí pomoz zmizet správným směrem.", reward: { chemical: 7, cash: 500, influence: 2 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "victor_90", title: "Příliš klidný klub", giver: "Victor Grave Kadeř", text: "Ten klub je dneska až moc v klidu. Udělej tam takovej tlak, aby se začalo platit za ticho.", reward: { dirtyCash: 1900, influence: 4 }, risk: { heat: 6 }, successRate: 70, durationMin: 23 },
    { id: "victor_91", title: "Rozbitý stůl", giver: "Victor Grave Kadeř", text: "Když se rozbije stůl, často se otevřou i kapsy. Využij obojí.", reward: { cash: 1400, influence: 3 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "victor_92", title: "Přeseknutá dohoda", giver: "Victor Grave Kadeř", text: "Někdo si myslí, že může obchodovat bez povolení. Dneska zjistí, že povolení vypadá jako ty.", reward: { influence: 8, dirtyCash: 900 }, risk: { heat: 5 }, successRate: 75, durationMin: 19 },
    { id: "victor_93", title: "Kufr plný problémů", giver: "Victor Grave Kadeř", text: "V kufru je víc problémů než oblečení. Otevři ho a změň problémy na zásoby.", reward: { smg: 1, ammo: 20, influence: 3 }, risk: { heat: 6 }, successRate: 65, durationMin: 24 },
    { id: "victor_94", title: "Kroky ve skladu", giver: "Victor Grave Kadeř", text: "Sklad dneska nebude tichej. A po tvým odchodu nebude ani plnej.", reward: { metalParts: 5, chemical: 3, cash: 700 }, risk: { heat: 4 }, successRate: 81, durationMin: 18 },
    { id: "victor_95", title: "Poslední varování", giver: "Victor Grave Kadeř", text: "Někdo už jedno varování dostal. Teď dostane takový, co se nedá přeslechnout.", reward: { influence: 9, cash: 900 }, risk: { heat: 6 }, successRate: 68, durationMin: 20 },
    { id: "victor_96", title: "Vlhký bankovky", giver: "Victor Grave Kadeř", text: "U přístavu se dneska lepí bankovky na špatný ruce. Ty máš zařídit, aby se lepily na správný.", reward: { dirtyCash: 2100, influence: 3 }, risk: { heat: 5 }, successRate: 72, durationMin: 21 },
    { id: "victor_97", title: "Odtržená směna", giver: "Victor Grave Kadeř", text: "Jedna parta dneska nedokončí směnu v pohodě. A ty z toho vytáhneš, co půjde.", reward: { cash: 1200, metalParts: 4, influence: 2 }, risk: { heat: 4 }, successRate: 82, durationMin: 17 },
    { id: "victor_98", title: "Tvrdý přepočet", giver: "Victor Grave Kadeř", text: "Když se špatně přepočítáš na ulici, někdo jiný si to spočítá za tebe. Jdi jim pomoct s matematikou.", reward: { cash: 1500, influence: 5 }, risk: { heat: 5 }, successRate: 76, durationMin: 18 },
    { id: "victor_99", title: "Díra v plotě", giver: "Victor Grave Kadeř", text: "Každý plot má slabý místo. A za každým slabým místem bývá něco, co se dá odnést.", reward: { techCore: 2, chemical: 2, cash: 600 }, risk: { heat: 3 }, successRate: 84, durationMin: 15 },
    { id: "victor_100", title: "Victorův podpis", giver: "Victor Grave Kadeř", text: "Tohle není jen další práce. Tohle je připomínka všem v okolí, kdo má v ulicích poslední slovo.", reward: { influence: 12, dirtyCash: 1500, metalParts: 3 }, risk: { heat: 7 }, successRate: 62, durationMin: 27 }
  ];
  const leonSwitchVargaEvents = [
    { id: "leon_01", title: "Kšeft z kufru", giver: "Leon Switch Varga", text: "Na parkovišti stojí kufr plnej věcí, co oficiálně neexistujou. Přijeď, zaplať správně a zmiz dřív, než se někdo začne ptát.", reward: { metalParts: 4, chemical: 3, cash: 500 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "leon_02", title: "Levný zboží, drahý následky", giver: "Leon Switch Varga", text: "Mám deal, kterej smrdí už z dálky. Ale marže je krásná. Vem to, než to někdo vyžere před tebou.", reward: { cash: 1400, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "leon_03", title: "Kontakt ze zadní uličky", giver: "Leon Switch Varga", text: "Jeden můj kontakt chce mluvit jen venku, mezi odpadkama a špínou. Což většinou znamená, že nabídka stojí za to.", reward: { influence: 4, chemical: 4, cash: 400 }, risk: { heat: 3 }, successRate: 84, durationMin: 15 },
    { id: "leon_04", title: "Přeprodej bez otázek", giver: "Leon Switch Varga", text: "Dostaneš zboží. Neptáš se odkud je. Jen ho otočíš rychle a draze. Přesně tak se vydělává ve městě.", reward: { cash: 1700, influence: 3 }, risk: { heat: 3 }, successRate: 87, durationMin: 13 },
    { id: "leon_05", title: "Špinavý kontakt", giver: "Leon Switch Varga", text: "Jeden kontakt je nervózní a chce se něčeho zbavit. Ty budeš ten, kdo mu uleví od nákladu i od peněz.", reward: { overdriveX: 2, cash: 700, influence: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "leon_06", title: "Zboží pod pultem", giver: "Leon Switch Varga", text: "Ve výloze nic není. Ale pod pultem leží věci, kvůli kterým se vyplatí přijít zadním vchodem.", reward: { streetPistol: 1, cash: 500, influence: 2 }, risk: { heat: 4 }, successRate: 78, durationMin: 16 },
    { id: "leon_07", title: "Rychlá otočka", giver: "Leon Switch Varga", text: "Koupíš levně, prodáš rychle, zmizíš dřív, než někdo zjistí, že byl právě obranej. Klasika.", reward: { cash: 1500, dirtyCash: 400 }, risk: { heat: 2 }, successRate: 89, durationMin: 12 },
    { id: "leon_08", title: "Zásilka bez jména", giver: "Leon Switch Varga", text: "Přijde bedna bez jména, bez papírů a bez výmluv. To bývají ty nejlepší obchody.", reward: { chemical: 5, metalParts: 3, cash: 500 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "leon_09", title: "Přehazovačka", giver: "Leon Switch Varga", text: "Dvě party si mají předat zboží. Ty zařídíš, aby po cestě změnilo majitele i cenu.", reward: { dirtyCash: 1600, influence: 3 }, risk: { heat: 4 }, successRate: 77, durationMin: 18 },
    { id: "leon_10", title: "Sleva za ticho", giver: "Leon Switch Varga", text: "Jeden prodejce udělá hezkou cenu. Protože ví, že když ji neudělá, může přestat prodávat úplně.", reward: { velvetSmoke: 5, cash: 400, influence: 3 }, risk: { heat: 3 }, successRate: 85, durationMin: 15 },
    { id: "leon_11", title: "Noční burza", giver: "Leon Switch Varga", text: "Po půlnoci se otevírá trh pro lidi, co nechtějí účtenky. Tam chodí skutečný peníze.", reward: { cash: 1800, dirtyCash: 500 }, risk: { heat: 4 }, successRate: 81, durationMin: 17 },
    { id: "leon_12", title: "Falešný prostředník", giver: "Leon Switch Varga", text: "Jedna schůzka potřebuje prostředníka. Ty budeš ten prostředník. A taky ten, kdo si ukousne největší část.", reward: { influence: 5, cash: 1200 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "leon_13", title: "Drahá adresa", giver: "Leon Switch Varga", text: "Někdy neprodáváš zboží. Někdy prodáváš jen to, že víš, kam jít a na koho zatlačit.", reward: { influence: 6, dirtyCash: 700 }, risk: { heat: 3 }, successRate: 84, durationMin: 13 },
    { id: "leon_14", title: "Kradený kov", giver: "Leon Switch Varga", text: "Mám partu, co tahá kov z míst, kde už ho nikdo nebude postrádat. Otoč to na trhu, než vystydne stopa.", reward: { metalParts: 7, cash: 600 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_15", title: "Kapsy plný marže", giver: "Leon Switch Varga", text: "Dneska nejde o sílu. Dneska jde o to, kdo vytěží víc z cizí blbosti. A to jsi ty.", reward: { cash: 1600, influence: 4 }, risk: { heat: 2 }, successRate: 90, durationMin: 12 },
    { id: "leon_16", title: "Podivný léky", giver: "Leon Switch Varga", text: "Někdo prodává farmaceutický zásoby bokem. Kvalita pochybná, zisk krásnej. Takže to bereme.", reward: { chemical: 6, ghostSerum: 1, cash: 400 }, risk: { heat: 4 }, successRate: 80, durationMin: 18 },
    { id: "leon_17", title: "Překupník v běhu", giver: "Leon Switch Varga", text: "Jeden malej překupník panikaří a chce všechno střelit hned. Vezmi mu to za směšnou cenu.", reward: { cash: 1300, metalParts: 3, influence: 2 }, risk: { heat: 2 }, successRate: 91, durationMin: 11 },
    { id: "leon_18", title: "Druhá ruka, první zisk", giver: "Leon Switch Varga", text: "Tohle zboží už někdo vlastnil. A teď ho budeš vlastnit ty. Krátce. Než ho prodáš ještě dráž.", reward: { streetPistol: 1, dirtyCash: 900, influence: 2 }, risk: { heat: 4 }, successRate: 78, durationMin: 16 },
    { id: "leon_19", title: "Směna ve tmě", giver: "Leon Switch Varga", text: "Žádný světla, žádný jména, žádný potvrzení. Jen deal a rychlý ruce.", reward: { overdriveX: 2, velvetSmoke: 3, cash: 500 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "leon_20", title: "Kontakt z druhý strany města", giver: "Leon Switch Varga", text: "Mám tip z části města, kam normálně nechodíš. Což je přesně důvod, proč tam leží prachy.", reward: { influence: 5, cash: 1100 }, risk: { heat: 3 }, successRate: 83, durationMin: 15 },
    { id: "leon_21", title: "Nadupaná přirážka", giver: "Leon Switch Varga", text: "Někdo něco zoufale potřebuje. A zoufalství je jen jiný slovo pro vyšší cenu.", reward: { cash: 1900, influence: 3 }, risk: { heat: 2 }, successRate: 88, durationMin: 13 },
    { id: "leon_22", title: "Kšeft mezi popelnicema", giver: "Leon Switch Varga", text: "Když se velký peníze řeší mezi popelnicema, většinou z toho něco kápne i bokem. Dneska hodně.", reward: { dirtyCash: 1700, chemical: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "leon_23", title: "Dveře bez cedule", giver: "Leon Switch Varga", text: "Za jedněma neoznačenýma dveřma čeká nabídka, co se nebude opakovat. Buď první uvnitř.", reward: { techCore: 2, cash: 700, influence: 2 }, risk: { heat: 4 }, successRate: 77, durationMin: 18 },
    { id: "leon_24", title: "Tichý přepočet", giver: "Leon Switch Varga", text: "Někdo se přepočítal v náš prospěch. A ty mu teď pomůžeš tu chybu už nenapravit.", reward: { cash: 1500, dirtyCash: 500 }, risk: { heat: 2 }, successRate: 89, durationMin: 12 },
    { id: "leon_25", title: "Otoč to, než to shnije", giver: "Leon Switch Varga", text: "Jedna várka je horká, jedna špinavá a jedna se kazí. Neřeš která je která. Prostě to otoč.", reward: { chemical: 4, velvetSmoke: 4, cash: 600 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "leon_26", title: "Fix za fixem", giver: "Leon Switch Varga", text: "Dneska neprodáváš věc. Dneska prodáváš řešení. A řešení ve městě bývají dražší než kulky.", reward: { influence: 6, cash: 1200 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "leon_27", title: "Sektorovej překup", giver: "Leon Switch Varga", text: "Co je levný v jednom sektoru, je drahý v druhým. A ty budeš ten most mezi chamtivostí a nouzí.", reward: { cash: 1750, influence: 3 }, risk: { heat: 3 }, successRate: 86, durationMin: 15 },
    { id: "leon_28", title: "Balíček pro nervózního klienta", giver: "Leon Switch Varga", text: "Klient chce diskrétnost. To znamená vyšší cenu a rychlejší nohy. Obojí máš.", reward: { ghostSerum: 2, cash: 800, influence: 2 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "leon_29", title: "Cizí problém, náš zisk", giver: "Leon Switch Varga", text: "Někdo má moc zboží, málo času a nulovou páteř. Přesně z takových se žije nejlíp.", reward: { metalParts: 5, cash: 900, influence: 3 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "leon_30", title: "Pouliční licence", giver: "Leon Switch Varga", text: "Na tomhle bloku nikdo neprodává bez toho, aby něco neodvedl. Dneska vybíráš ty.", reward: { cash: 1400, dirtyCash: 600, influence: 4 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_31", title: "Zlomený řetězec", giver: "Leon Switch Varga", text: "Jeden dodavatelský řetězec právě praskl. A ty posbíráš, co z něj vypadne na zem.", reward: { chemical: 5, techCore: 1, cash: 600 }, risk: { heat: 3 }, successRate: 85, durationMin: 15 },
    { id: "leon_32", title: "Přestřelená cena", giver: "Leon Switch Varga", text: "Někdo chce moc. Ty mu zaplatíš málo. A ještě na tom vyděláš. Tomu říkám obchod.", reward: { cash: 1600, influence: 3 }, risk: { heat: 2 }, successRate: 90, durationMin: 11 },
    { id: "leon_33", title: "Tichý runner", giver: "Leon Switch Varga", text: "Potřebuju, aby něco přešlo přes tři bloky a nikdo to nezastavil. Žádná sláva, jen čistý profit.", reward: { overdriveX: 1, cash: 1000, influence: 2 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "leon_34", title: "Výprodej strachu", giver: "Leon Switch Varga", text: "Když začne někdo panikařit, prodává hluboko pod cenou. A my jsme přesně ti, co to umí využít.", reward: { metalParts: 6, chemical: 3, cash: 400 }, risk: { heat: 2 }, successRate: 91, durationMin: 12 },
    { id: "leon_35", title: "Spodní police", giver: "Leon Switch Varga", text: "To nejlepší zboží nebývá na očích. Bývá dole, za plentou, mezi věcma bez původu.", reward: { streetPistol: 1, velvetSmoke: 3, cash: 500 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "leon_36", title: "Dohoda na rohu", giver: "Leon Switch Varga", text: "Na rohu čeká deal. Malej stůl, špinavý ruce, velký peníze. Nezvor to.", reward: { dirtyCash: 1800, influence: 3 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "leon_37", title: "Sběrač marže", giver: "Leon Switch Varga", text: "Dva blbci se hádají o cenu. Ty přijdeš mezi ně a odejdeš s největším kusem.", reward: { cash: 1700, influence: 4 }, risk: { heat: 3 }, successRate: 87, durationMin: 13 },
    { id: "leon_38", title: "Krabice bez původu", giver: "Leon Switch Varga", text: "Mám tři krabice. Jedna je legální, druhá ne a třetí je nejlepší neotvírat. Vezmi všechny.", reward: { chemical: 3, metalParts: 3, ghostSerum: 1, cash: 400 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "leon_39", title: "Pouliční arbitráž", giver: "Leon Switch Varga", text: "Jedna strana má zboží, druhá peníze a obě mají málo mozku. Ty z toho vytěžíš nejvíc.", reward: { cash: 1800, dirtyCash: 400 }, risk: { heat: 3 }, successRate: 88, durationMin: 12 },
    { id: "leon_40", title: "Tlačenice o bedny", giver: "Leon Switch Varga", text: "Došlo pár beden a pár lidí po nich skočí. Ty skočíš rychlejc a prodáš je s přirážkou.", reward: { techCore: 2, cash: 900, influence: 2 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "leon_41", title: "Klient bez nervů", giver: "Leon Switch Varga", text: "Můj klient se sype a chce všechno hned. Tak mu to dej. Ale draho.", reward: { overdriveX: 2, cash: 900, dirtyCash: 300 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "leon_42", title: "Zadní schodiště", giver: "Leon Switch Varga", text: "Na zadním schodišti se dneska budou měnit ruce, kapsy a loajalita. Buď u toho první.", reward: { influence: 5, cash: 1000 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "leon_43", title: "Přeskládání trhu", giver: "Leon Switch Varga", text: "Jedna várka zmizí z trhu a jiná se objeví za dvojnásobek. Krása volný ulice.", reward: { cash: 1900, influence: 3 }, risk: { heat: 4 }, successRate: 81, durationMin: 17 },
    { id: "leon_44", title: "Vypůjčený sklad", giver: "Leon Switch Varga", text: "Na pár minut si půjčíš cizí sklad. Na pár hodin z něj budeš žít.", reward: { metalParts: 6, chemical: 4, cash: 500 }, risk: { heat: 4 }, successRate: 80, durationMin: 18 },
    { id: "leon_45", title: "Nelegální přirážka", giver: "Leon Switch Varga", text: "Některý věci jsou drahý proto, že jsou vzácný. Jiný proto, že za ně můžeš skončit v problému. Tohle je ten druhý případ.", reward: { streetPistol: 1, cash: 800, influence: 3 }, risk: { heat: 5 }, successRate: 74, durationMin: 19 },
    { id: "leon_46", title: "Šeptaná nabídka", giver: "Leon Switch Varga", text: "Když někdo šeptá cenu, většinou ví, že je buď moc dobrá, nebo moc špinavá. Mně jsou sympatický obě možnosti.", reward: { dirtyCash: 1500, ghostSerum: 1, influence: 2 }, risk: { heat: 4 }, successRate: 80, durationMin: 15 },
    { id: "leon_47", title: "Pouliční broker", giver: "Leon Switch Varga", text: "Dneska seš prostředník mezi hladovejma rukama a plným bednama. A prostředník bere vždycky první kus.", reward: { cash: 1750, influence: 4 }, risk: { heat: 3 }, successRate: 87, durationMin: 13 },
    { id: "leon_48", title: "Přepálený zájem", giver: "Leon Switch Varga", text: "Když někdo něco chce až moc, přestává řešit cenu. A přesně v tu chvíli přicházíš ty.", reward: { cash: 2000, influence: 3 }, risk: { heat: 2 }, successRate: 89, durationMin: 12 },
    { id: "leon_49", title: "Černý seznam kontaktů", giver: "Leon Switch Varga", text: "Mám seznam jmen, adres a slabin. Nechci ho celý. Stačí mi, když z něj vytěžíš maximum.", reward: { influence: 7, dirtyCash: 900 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_50", title: "Leonův řez", giver: "Leon Switch Varga", text: "Pamatuj si to. V tomhle městě nevyhrává ten, kdo něco má. Vyhrává ten, kdo si z každýho kšeftu ukousne největší kus. Dneska to budeš ty.", reward: { cash: 2200, influence: 5, techCore: 2 }, risk: { heat: 5 }, successRate: 76, durationMin: 20 },
    { id: "leon_51", title: "Krabice od špíny", giver: "Leon Switch Varga", text: "Na kraji sektoru čeká pár beden, co už prošly moc rukama. Smrdí, jsou kradený a přesně proto na nich vyděláš nejvíc.", reward: { metalParts: 5, chemical: 3, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_52", title: "Obchod se strachem", giver: "Leon Switch Varga", text: "Jeden malej dealer se bojí, že ho někdo obere. Nabídni mu ochranu. Drahou, špinavou a povinnou.", reward: { cash: 1500, influence: 4 }, risk: { heat: 4 }, successRate: 81, durationMin: 15 },
    { id: "leon_53", title: "Přesunutá zásilka", giver: "Leon Switch Varga", text: "Jedna zásilka má dojet jinam. Ty zařídíš, že skončí u nás. Bez hluku, bez výčitek, se ziskem.", reward: { chemical: 5, techCore: 1, cash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "leon_54", title: "Vysátý sklad", giver: "Leon Switch Varga", text: "Ve skladu zůstalo víc, než měl majitel přiznat. Tak mu pomůžeme s inventurou po svým.", reward: { metalParts: 7, cash: 700, influence: 2 }, risk: { heat: 5 }, successRate: 76, durationMin: 19 },
    { id: "leon_55", title: "Cena za mlčení", giver: "Leon Switch Varga", text: "Někdo viděl víc, než měl. Nech ho pochopit, že ticho je levnější než nemocnice.", reward: { dirtyCash: 1400, influence: 5 }, risk: { heat: 5 }, successRate: 78, durationMin: 16 },
    { id: "leon_56", title: "Přeprodej krve", giver: "Leon Switch Varga", text: "Po jednom špinavým střetu zůstalo na zemi vybavení. Posbírej to a otoč to, než zaschne krev.", reward: { streetPistol: 1, metalParts: 3, cash: 600 }, risk: { heat: 5 }, successRate: 74, durationMin: 18 },
    { id: "leon_57", title: "Mokrej deal u kanálu", giver: "Leon Switch Varga", text: "U kanálu se mají měnit ruce, peníze a loajalita. Dohlídni, aby všechno skončilo v našich kapsách.", reward: { dirtyCash: 1700, influence: 3 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "leon_58", title: "Špatná adresa, dobrý zisk", giver: "Leon Switch Varga", text: "Jedna zásilka půjde na špatnou adresu. A ta adresa bude naše. Někdy je logistika krásná věc.", reward: { velvetSmoke: 5, chemical: 2, cash: 500 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "leon_59", title: "Rozprodej paniky", giver: "Leon Switch Varga", text: "Když se někdo začne bát razie, prodá i vlastní boty. Kup levně všechno, co pustí z ruky.", reward: { metalParts: 4, overdriveX: 1, cash: 700 }, risk: { heat: 3 }, successRate: 88, durationMin: 13 },
    { id: "leon_60", title: "Špinavé procento", giver: "Leon Switch Varga", text: "Dva idioti chtějí udělat obchod. Ty jim ho umožníš. A ukousneš si takovej podíl, že je to bude bolet až doma.", reward: { cash: 1800, influence: 4 }, risk: { heat: 3 }, successRate: 87, durationMin: 14 },
    { id: "leon_61", title: "Bedny z rozbité dodávky", giver: "Leon Switch Varga", text: "Na krajnici stojí dodávka, co nedojela. Někdo brečí nad plechem, ty vyděláš na obsahu.", reward: { chemical: 4, metalParts: 5, cash: 600 }, risk: { heat: 4 }, successRate: 83, durationMin: 16 },
    { id: "leon_62", title: "Šelma mezi překupníky", giver: "Leon Switch Varga", text: "Na trhu je moc hladových krys. Buď největší z nich a stáhni jim nejlepší kusy přímo před nosem.", reward: { cash: 1600, dirtyCash: 500, influence: 3 }, risk: { heat: 4 }, successRate: 82, durationMin: 15 },
    { id: "leon_63", title: "Kontakty v bordelu", giver: "Leon Switch Varga", text: "Nejlepší informace neleží v kanceláři. Leží v zakouřeným bordelu mezi lidma, co mluví, když si myslí, že jsou v bezpečí.", reward: { influence: 6, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 81, durationMin: 17 },
    { id: "leon_64", title: "Levný kulky, drahá noc", giver: "Leon Switch Varga", text: "Někdo se chce zbavit železa, než přijde kontrola. Seber to levně a pošli dál ještě před svítáním.", reward: { smg: 1, cash: 700, influence: 2 }, risk: { heat: 5 }, successRate: 73, durationMin: 19 },
    { id: "leon_65", title: "Kapsářský velkoobchod", giver: "Leon Switch Varga", text: "Malej zloděj ukradl víc, než zvládne prodat. Tak ho odlehči. Klidně i od iluzí.", reward: { cash: 1400, metalParts: 3, influence: 2 }, risk: { heat: 3 }, successRate: 89, durationMin: 12 },
    { id: "leon_66", title: "Přehoz přes sektor", giver: "Leon Switch Varga", text: "V jednom sektoru je bída, v druhým hlad. Ty propojíš jedno s druhým a zbytek shrábneš.", reward: { cash: 1750, influence: 4 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "leon_67", title: "Ostrá přirážka", giver: "Leon Switch Varga", text: "Klient chce zboží hned. To znamená jediný: zvedni cenu, usměj se a nech ho krvácet do peněženky.", reward: { cash: 1900, dirtyCash: 300 }, risk: { heat: 2 }, successRate: 90, durationMin: 11 },
    { id: "leon_68", title: "Zadní pokoj", giver: "Leon Switch Varga", text: "V zadním pokoji se dneska budou přehazovat věci, co neměly opustit sklad. Dohlídni, aby opustily i majitele.", reward: { techCore: 2, chemical: 3, cash: 500 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "leon_69", title: "Srážka zájmů", giver: "Leon Switch Varga", text: "Dvě party chtějí to samý zboží. Ty jim prodáš naději, chaos a nakonec to zinkasuješ celý.", reward: { cash: 1800, influence: 5 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "leon_70", title: "Oškrabaná marže", giver: "Leon Switch Varga", text: "Na dealu už si ukousli jiní. Ty z toho seškrábneš poslední vrstvu. A ta bývá nejtučnější.", reward: { dirtyCash: 1500, cash: 500 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "leon_71", title: "Výprodej slabosti", giver: "Leon Switch Varga", text: "Někdo potřebuje rychle cash a prodá všechno pod cenou. Ty potřebuješ jen přijít včas a bejt bez slitování.", reward: { metalParts: 6, chemical: 2, cash: 400 }, risk: { heat: 2 }, successRate: 92, durationMin: 12 },
    { id: "leon_72", title: "Rozsypaný lékárenský zboží", giver: "Leon Switch Varga", text: "Po jedný hádce zůstalo pár beden z lékárny bez dozoru. Posbírej to a prodej to dřív, než se majitel probere.", reward: { chemical: 7, ghostSerum: 1, cash: 400 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_73", title: "Prašivej broker", giver: "Leon Switch Varga", text: "Dneska nebudeš obchodník. Dneska budeš hyena s kontakty. A hyeny se v tomhle městě nají nejlíp.", reward: { cash: 1700, influence: 4 }, risk: { heat: 3 }, successRate: 88, durationMin: 13 },
    { id: "leon_74", title: "Dohoda v dešti", giver: "Leon Switch Varga", text: "Když prší, lidi méně koukají. To je ideální chvíle poslat špinavý zboží přes půl bloku.", reward: { velvetSmoke: 4, overdriveX: 2, cash: 500 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "leon_75", title: "Výběr od zoufalců", giver: "Leon Switch Varga", text: "Dneska neokradeš bohatý. Dneska vytěžíš zoufalý. A zoufalí platí nejrychlejc.", reward: { dirtyCash: 1600, influence: 4 }, risk: { heat: 4 }, successRate: 84, durationMin: 15 },
    { id: "leon_76", title: "Překup za rozbitým barem", giver: "Leon Switch Varga", text: "Za jedním rozbitým barem čeká týpek s věcma, co by oficiálně měly být zamčený jinde. Tak je oficiálně přesuň k nám.", reward: { streetPistol: 1, chemical: 2, cash: 600 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "leon_77", title: "Křivá směnka", giver: "Leon Switch Varga", text: "Někdo se upsál špatným lidem. Ty od něj koupíš dluh za drobný a vybereš ho jako plnou cenu.", reward: { cash: 1800, dirtyCash: 400, influence: 3 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "leon_78", title: "Špinavý přepočet beden", giver: "Leon Switch Varga", text: "Na papíře jich je deset. Ve skutečnosti jich může zmizet dvanáct. Takovej účetnictví já respektuju.", reward: { metalParts: 5, techCore: 1, cash: 700 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "leon_79", title: "Přepálený zájemce", giver: "Leon Switch Varga", text: "Jeden kupec chce zboží tak moc, že už necítí pach podrazu. Přesně takový mám nejradši.", reward: { cash: 2000, influence: 3 }, risk: { heat: 2 }, successRate: 89, durationMin: 11 },
    { id: "leon_80", title: "Rozřezaná trasa", giver: "Leon Switch Varga", text: "Běžná přepravní trasa je dneska mrtvá. Vezmeš náklad bokem a z marže uděláš malý svinstvo.", reward: { chemical: 4, metalParts: 4, cash: 600 }, risk: { heat: 3 }, successRate: 87, durationMin: 14 },
    { id: "leon_81", title: "Sektorový pijavice", giver: "Leon Switch Varga", text: "Na každým sektoru visí někdo, kdo už saje moc dlouho. Dneska ho odsajeme my.", reward: { dirtyCash: 1700, influence: 4 }, risk: { heat: 5 }, successRate: 77, durationMin: 18 },
    { id: "leon_82", title: "Levná bolest, drahý zisk", giver: "Leon Switch Varga", text: "Někdo prodá cennej materiál jen proto, aby přežil noc. Ty si z jeho bolesti uděláš obchodní model.", reward: { techCore: 2, cash: 800, influence: 2 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "leon_83", title: "Kufr po mrtvým dealu", giver: "Leon Switch Varga", text: "Po jednom zpackaným setkání zůstal kufr bez dozoru. Otevři ho a udělej z cizího průseru náš profit.", reward: { overdriveX: 2, dirtyCash: 900, influence: 2 }, risk: { heat: 5 }, successRate: 75, durationMin: 18 },
    { id: "leon_84", title: "Prodej přes bolest", giver: "Leon Switch Varga", text: "Někdy nestačí nabídnout cenu. Někdy musíš nabídnout i důvod, proč ji mají přijmout bez keců.", reward: { cash: 1600, influence: 5 }, risk: { heat: 4 }, successRate: 82, durationMin: 15 },
    { id: "leon_85", title: "Rozebranej kontejner", giver: "Leon Switch Varga", text: "V přístavu někdo otevřel, co otevřít neměl. Posbírej zbytky a pošli je dál, než přijdou uniformy.", reward: { metalParts: 6, chemical: 3, cash: 600 }, risk: { heat: 5 }, successRate: 76, durationMin: 19 },
    { id: "leon_86", title: "Pobodaná nabídka", giver: "Leon Switch Varga", text: "Jeden obchod skončil nožem ve stole. To znamená dvě věci: méně zájemců a víc prostoru pro nás.", reward: { streetPistol: 1, cash: 700, dirtyCash: 400 }, risk: { heat: 5 }, successRate: 74, durationMin: 18 },
    { id: "leon_87", title: "Otočka přes špínu", giver: "Leon Switch Varga", text: "Tohle zboží je tak špinavý, že by si zasloužilo vlastní kanalizaci. Přesně proto má krásnou marži.", reward: { velvetSmoke: 5, chemical: 3, cash: 500 }, risk: { heat: 4 }, successRate: 83, durationMin: 15 },
    { id: "leon_88", title: "Rozšlapaný kontakt", giver: "Leon Switch Varga", text: "Jeden kontakt dostal přes hubu a chce zmizet. Nech ho zmizet. Ale nejdřív z něj vytáhni všechno cenný.", reward: { influence: 7, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 84, durationMin: 15 },
    { id: "leon_89", title: "Přesun černé várky", giver: "Leon Switch Varga", text: "Várka je horká, sektor nervózní a čas krátkej. Přesuň to, než se někdo začne zajímat moc.", reward: { ghostSerum: 2, chemical: 4, cash: 500 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_90", title: "Drahý mlčení u stolu", giver: "Leon Switch Varga", text: "U jednoho stolu sedí lidi, co by spolu normálně nemluvili. Ty jim pomůžeš najít společnou řeč. Za velmi nepříjemnou cenu.", reward: { cash: 1900, influence: 4 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "leon_91", title: "Prohnilý deal", giver: "Leon Switch Varga", text: "Ten kšeft je prohnilej od základu. Ale i z prohnilýho dřeva se dá postavit pěkně hnusnej zisk.", reward: { dirtyCash: 1600, cash: 400 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "leon_92", title: "Tahání za nitky", giver: "Leon Switch Varga", text: "Dneska nebudeš tahat bedny. Dneska budeš tahat lidi. A lidi se prodávají ještě líp než zboží.", reward: { influence: 8, cash: 1000 }, risk: { heat: 4 }, successRate: 83, durationMin: 16 },
    { id: "leon_93", title: "Sklad pro krysy", giver: "Leon Switch Varga", text: "Jeden sklad je tak děravej, že si z něj bere každej. Dneska si z něj vezmeme nejvíc my.", reward: { metalParts: 7, cash: 600, influence: 2 }, risk: { heat: 4 }, successRate: 84, durationMin: 15 },
    { id: "leon_94", title: "Zuby trhu", giver: "Leon Switch Varga", text: "Trh není místo pro obchodníky. Je to místo pro predátory. Tak koukej kousat.", reward: { cash: 1800, influence: 5 }, risk: { heat: 3 }, successRate: 88, durationMin: 13 },
    { id: "leon_95", title: "Rozkradený papíry", giver: "Leon Switch Varga", text: "Některý zásilky cestují díky razítku. Dneska se postaráš, aby papíry zmizely a zboží zůstalo nám.", reward: { techCore: 2, dirtyCash: 700, influence: 3 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "leon_96", title: "Překupnický masakr", giver: "Leon Switch Varga", text: "Na jednom rohu se dneska roztrhá několik překupníků o stejnou věc. Ty to vezmeš první a prodáš jim to zpátky dráž.", reward: { cash: 2100, influence: 4 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "leon_97", title: "Vydřená marže", giver: "Leon Switch Varga", text: "Tohle nebude hezkej obchod. Tohle bude špinavý, tvrdý a přesně tak výdělečný, jak to mám rád.", reward: { dirtyCash: 1700, influence: 4 }, risk: { heat: 5 }, successRate: 78, durationMin: 18 },
    { id: "leon_98", title: "Dodávka z pekla", giver: "Leon Switch Varga", text: "Jedna dodávka veze tolik bordelu, že by ji nikdo neměl vidět. Postarej se, aby ji nikdo ani nedopočítal.", reward: { chemical: 5, metalParts: 5, cash: 700 }, risk: { heat: 5 }, successRate: 77, durationMin: 19 },
    { id: "leon_99", title: "Řez z každý kapsy", giver: "Leon Switch Varga", text: "Dneska nebudeš brát jen z jednoho zdroje. Dneska si ukousneš z každý kapsy, co se v sektoru pohne.", reward: { cash: 2000, dirtyCash: 500, influence: 4 }, risk: { heat: 4 }, successRate: 82, durationMin: 16 },
    { id: "leon_100", title: "Leonova špinavá škola", giver: "Leon Switch Varga", text: "Zapamatuj si to. Ulice nepatří tomu, kdo má čistý ruce. Patří tomu, kdo umí z každýho svinstva udělat zisk. Dneska budeš učit ostatní.", reward: { cash: 2300, influence: 6, techCore: 2 }, risk: { heat: 5 }, successRate: 77, durationMin: 20 }
  ];
  const nyraValeEvents = [
    { id: "nyra_01", title: "Špatně zamčený telefon", giver: "Nyra Vale", text: "Jeden idiot nechal telefon bez dozoru a bez zámku. Vezmi z něj všechno, co se dá prodat, zneužít nebo poslat správným lidem.", reward: { influence: 5, dirtyCash: 700 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "nyra_02", title: "Šeptaná slabina", giver: "Nyra Vale", text: "V každém sektoru je někdo, kdo ví příliš moc a pije příliš levně. Sedni si k němu a nech ho mluvit.", reward: { influence: 6, cash: 800 }, risk: { heat: 2 }, successRate: 88, durationMin: 13 },
    { id: "nyra_03", title: "První lež zdarma", giver: "Nyra Vale", text: "Rozšiř mezi správné uši malou lež. Když se chytne, ostatní udělají zbytek práce za tebe.", reward: { influence: 7, dirtyCash: 500 }, risk: { heat: 3 }, successRate: 84, durationMin: 12 },
    { id: "nyra_04", title: "Fotka, která bolí", giver: "Nyra Vale", text: "Jedna fotka má větší váhu než zásobník. Získej ji a pak sleduj, jak rychle se mění loajalita za ticho.", reward: { influence: 8, cash: 900 }, risk: { heat: 3 }, successRate: 82, durationMin: 15 },
    { id: "nyra_05", title: "Odcizený seznam", giver: "Nyra Vale", text: "Někdo si vede seznam jmen, adres a dluhů. Ten seznam dnes změní majitele. A s ním i půlku města.", reward: { influence: 7, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "nyra_06", title: "Cizí paranoia", giver: "Nyra Vale", text: "Není třeba někoho zničit. Stačí, aby začal pochybovat o lidech kolem sebe. To už zvládne rozebrat zbytek sám.", reward: { influence: 9, cash: 600 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_07", title: "Ztracený přístup", giver: "Nyra Vale", text: "Jeden přístupový kód se má ztratit. Ty se postaráš, aby se ztratil správnému člověku do kapsy.", reward: { techCore: 1, influence: 4, cash: 500 }, risk: { heat: 3 }, successRate: 83, durationMin: 15 },
    { id: "nyra_08", title: "Vydírání bez hlasu", giver: "Nyra Vale", text: "Někdy není potřeba říct ani slovo. Jen poslat správný důkaz na správné místo a počkat, kdo přijde platit první.", reward: { dirtyCash: 1200, influence: 6 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "nyra_09", title: "Nastražená zpráva", giver: "Nyra Vale", text: "Pošli jednu zprávu tak, aby vypadala, že přišla od někoho jiného. Lidi jsou překvapivě ochotní si ničit životy sami.", reward: { influence: 8, cash: 700 }, risk: { heat: 4 }, successRate: 78, durationMin: 17 },
    { id: "nyra_10", title: "Tichá výměna", giver: "Nyra Vale", text: "Na střeše proběhne výměna informací. Ty se neukážeš. Jen zajistíš, že jedna strana odejde chudší a druhá vyděšená.", reward: { influence: 5, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "nyra_11", title: "Rozbitá důvěra", giver: "Nyra Vale", text: "Dva lidi si ještě pořád věří. To je chyba, kterou dnes opravíš.", reward: { influence: 9, cash: 800 }, risk: { heat: 3 }, successRate: 83, durationMin: 13 },
    { id: "nyra_12", title: "Záznam z chodby", giver: "Nyra Vale", text: "Na jedné chodbě visí kamera, která viděla víc, než by měla. Stáhni záznam dřív, než ho smaže někdo jiný.", reward: { influence: 6, cash: 700, dirtyCash: 300 }, risk: { heat: 3 }, successRate: 85, durationMin: 15 },
    { id: "nyra_13", title: "Toxický drb", giver: "Nyra Vale", text: "Jedna dobře vypuštěná informace dokáže otrávit celý sektor. Vypusť ji jemně a sleduj, kdo se začne dusit první.", reward: { influence: 10, dirtyCash: 500 }, risk: { heat: 4 }, successRate: 77, durationMin: 18 },
    { id: "nyra_14", title: "Dívka u baru", giver: "Nyra Vale", text: "Některé dveře neotevře páčidlo, ale úsměv a dvě správné otázky. Dnes otevřeš právě takové.", reward: { influence: 5, cash: 900 }, risk: { heat: 2 }, successRate: 89, durationMin: 12 },
    { id: "nyra_15", title: "Složka bez jména", giver: "Nyra Vale", text: "V jedné zásuvce leží složka, která nemá existovat. Vezmi ji a připomeň městu, že papír někdy řeže hlouběji než nůž.", reward: { influence: 7, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_16", title: "Podvržený podpis", giver: "Nyra Vale", text: "Stačí jeden podpis na špatném místě a někdo se probudí s hodně drahým problémem.", reward: { cash: 1000, influence: 6 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "nyra_17", title: "Noční odposlech", giver: "Nyra Vale", text: "Na jednu noc zapojíš uši tam, kam nepatří. To, co zachytíš, prodáš třikrát různým lidem.", reward: { dirtyCash: 1100, influence: 6 }, risk: { heat: 4 }, successRate: 81, durationMin: 18 },
    { id: "nyra_18", title: "Jméno na seznamu", giver: "Nyra Vale", text: "Jedno jméno se objeví na špatném seznamu. A pak už jen sleduj, jak rychle začne jeho majitel panikařit.", reward: { influence: 8, cash: 700 }, risk: { heat: 3 }, successRate: 84, durationMin: 13 },
    { id: "nyra_19", title: "Špína v archivu", giver: "Nyra Vale", text: "Nejlepší tajemství nejsou na ulici. Jsou uložená, seřazená a čekají, až je někdo použije správným způsobem.", reward: { influence: 7, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 82, durationMin: 15 },
    { id: "nyra_20", title: "Falešná stopa", giver: "Nyra Vale", text: "Naveď lovce na špatnou adresu a kořist zůstane bez dozoru. Krása manipulace je v tom, že nikdo neví, kdo začal.", reward: { cash: 900, influence: 6 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "nyra_21", title: "Cizí heslo", giver: "Nyra Vale", text: "Někdo používá stejné heslo všude. Smutné. Ale výdělečné.", reward: { influence: 5, cash: 800, dirtyCash: 300 }, risk: { heat: 2 }, successRate: 90, durationMin: 11 },
    { id: "nyra_22", title: "Přítelkyně problému", giver: "Nyra Vale", text: "Dnes se nebudeš prát. Dnes někomu nabídneš řešení, které ho udělá závislým na další schůzce s námi.", reward: { influence: 7, dirtyCash: 700 }, risk: { heat: 3 }, successRate: 85, durationMin: 12 },
    { id: "nyra_23", title: "Šepot na schodišti", giver: "Nyra Vale", text: "Na schodišti se dnes řekne něco, co nemělo nikdy zaznít nahlas. Ty budeš stát dost blízko, aby to mělo cenu.", reward: { influence: 6, cash: 700 }, risk: { heat: 2 }, successRate: 88, durationMin: 12 },
    { id: "nyra_24", title: "Zkažený deal", giver: "Nyra Vale", text: "Není třeba obchod zastavit. Stačí ho jen trochu pokazit, aby se obě strany začaly navzájem podezírat.", reward: { influence: 9, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "nyra_25", title: "Sklenička navíc", giver: "Nyra Vale", text: "Lidi po třetí skleničce říkají věci, za které by ráno platili. Ty jim tu šanci dáš.", reward: { cash: 1000, influence: 5 }, risk: { heat: 2 }, successRate: 91, durationMin: 11 },
    { id: "nyra_26", title: "Zamčená minulost", giver: "Nyra Vale", text: "Každý má minulost, kterou by nejradši utopil. Ty ji jen vytáhneš na hladinu a nabídneš ručník za správnou cenu.", reward: { dirtyCash: 1300, influence: 7 }, risk: { heat: 4 }, successRate: 78, durationMin: 17 },
    { id: "nyra_27", title: "Slabé místo aliance", giver: "Nyra Vale", text: "Každá aliance má člena, co drží hubu jen do chvíle, než dostane správnou nabídku. Najdi ho.", reward: { influence: 8, cash: 900 }, risk: { heat: 4 }, successRate: 80, durationMin: 18 },
    { id: "nyra_28", title: "Cizí deník", giver: "Nyra Vale", text: "Papír snese všechno. A některé papíry snesou dost na to, aby někdo začal platit pravidelně.", reward: { influence: 7, dirtyCash: 800 }, risk: { heat: 3 }, successRate: 84, durationMin: 14 },
    { id: "nyra_29", title: "Otrávené podezření", giver: "Nyra Vale", text: "Stačí zasít malou pochybnost a sledovat, jak si ji lidi zalijí vlastní panikou.", reward: { influence: 10, cash: 600 }, risk: { heat: 4 }, successRate: 77, durationMin: 17 },
    { id: "nyra_30", title: "Tichá výstraha", giver: "Nyra Vale", text: "Ne všichni potřebují dostat přes hubu. Některým stačí obálka bez odesílatele a špatný spánek na týden dopředu.", reward: { influence: 6, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 85, durationMin: 13 },
    { id: "nyra_31", title: "Přesměrovaná nenávist", giver: "Nyra Vale", text: "Dneska někoho nenasměruješ k cíli. Nasměruješ ho k omylu. A omyly v našem městě bývají smrtelně drahé.", reward: { influence: 8, cash: 800 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "nyra_32", title: "Stará hlasová schránka", giver: "Nyra Vale", text: "Někdo zapomněl smazat hlasovky. Ty zapomeneš mít slitování.", reward: { dirtyCash: 1000, influence: 6 }, risk: { heat: 3 }, successRate: 86, durationMin: 12 },
    { id: "nyra_33", title: "Zblízka a bez otisků", giver: "Nyra Vale", text: "Potřebuju, abys byl dost blízko na to slyšet pravdu a dost chytrej na to, abys po sobě nic nenechal.", reward: { influence: 7, cash: 700 }, risk: { heat: 3 }, successRate: 84, durationMin: 15 },
    { id: "nyra_34", title: "Lehký dotek chaosu", giver: "Nyra Vale", text: "Nebudeme rozbíjet dveře. Jen jemně zatlačíme na správné lidi a zbytek město rozebere samo.", reward: { influence: 9, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 78, durationMin: 16 },
    { id: "nyra_35", title: "Smazaná kamera", giver: "Nyra Vale", text: "Někde chybí pár minut záznamu. Postarej se, aby chyběly přesně ty, které potřebujeme.", reward: { cash: 900, influence: 5 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_36", title: "Noční návštěva", giver: "Nyra Vale", text: "Dnes někomu necháš za dveřmi důkaz, který tam neměl nikdy být. A pak počkáš, kdo začne křičet první.", reward: { influence: 8, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 15 },
    { id: "nyra_37", title: "Dva kroky od zrady", giver: "Nyra Vale", text: "Zrada nezačíná nožem do zad. Začíná jednou pochybností a správně položenou otázkou.", reward: { influence: 10, cash: 700 }, risk: { heat: 4 }, successRate: 76, durationMin: 18 },
    { id: "nyra_38", title: "Kapesní tajemství", giver: "Nyra Vale", text: "Malé USB, velké problémy. Najdi ho a pak rozhodneme, kdo si za jeho návrat zaplatí nejvíc.", reward: { dirtyCash: 1200, influence: 5 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_39", title: "Rozhovor za plentou", giver: "Nyra Vale", text: "Za jednou tenkou stěnou se dnes probere něco, co může rozpárat celý sektor. Naslouchej.", reward: { influence: 7, cash: 800 }, risk: { heat: 2 }, successRate: 89, durationMin: 12 },
    { id: "nyra_40", title: "Podvržená účast", giver: "Nyra Vale", text: "Někdo bude vypadat, jako že byl na místě, kde nikdy nestál. A někdo jiný za to zaplatí, aby to zmizelo.", reward: { dirtyCash: 1100, influence: 7 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "nyra_41", title: "Zaměněná obálka", giver: "Nyra Vale", text: "Stačí jedna obálka v nesprávných rukách a celý večer dostane nový směr.", reward: { cash: 900, influence: 6 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_42", title: "Přepnutá loajalita", giver: "Nyra Vale", text: "Někteří lidé nejsou věrní. Jen ještě nedostali lepší nabídku. Dnes ji dostanou.", reward: { influence: 8, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "nyra_43", title: "Křehká pověst", giver: "Nyra Vale", text: "Pověst je sklo. Jedna prasklina a zbytek už udělá tlak okolí. Ty uděláš tu prasklinu.", reward: { influence: 9, cash: 700 }, risk: { heat: 3 }, successRate: 83, durationMin: 14 },
    { id: "nyra_44", title: "Vzkaz bez podpisu", giver: "Nyra Vale", text: "Pošli vzkaz, který nebude znít jako hrozba. Jen jako něco, co by si chytrý člověk neměl dovolit ignorovat.", reward: { dirtyCash: 1000, influence: 6 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_45", title: "Druhé dno šuplíku", giver: "Nyra Vale", text: "Vždycky mě zajímá, co lidi schovávají pod tím, co schovávají. Tam bývá skutečná cena.", reward: { influence: 7, cash: 900, dirtyCash: 300 }, risk: { heat: 3 }, successRate: 85, durationMin: 15 },
    { id: "nyra_46", title: "Zlá kombinace", giver: "Nyra Vale", text: "Spoj dvě pravdy s jednou lží a dostaneš příběh, který rozbije víc vztahů než pistole kolen.", reward: { influence: 10, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 78, durationMin: 17 },
    { id: "nyra_47", title: "Stín za zády", giver: "Nyra Vale", text: "Někdo musí mít pocit, že ho někdo sleduje. A ten pocit ho má stát peníze.", reward: { cash: 1000, influence: 6 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_48", title: "Šepot v síti", giver: "Nyra Vale", text: "Dnes nevypustíš zprávu do ulic. Dnes ji pustíš do správných kanálů a necháš ji udělat ošklivější práci tiše.", reward: { influence: 8, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_49", title: "Pád masky", giver: "Nyra Vale", text: "Každý někde hraje roli. Najdi místo, kde se zapomněl převléct zpátky do své lži.", reward: { influence: 9, cash: 800 }, risk: { heat: 4 }, successRate: 79, durationMin: 16 },
    { id: "nyra_50", title: "Nyřin tah", giver: "Nyra Vale", text: "Pamatuj si to. Kulka udělá díru. Tajemství udělá prázdno. Dneska v tom prázdnu vyděláme víc než ostatní za celou noc.", reward: { influence: 12, dirtyCash: 1400, cash: 900 }, risk: { heat: 5 }, successRate: 75, durationMin: 19 },
    { id: "nyra_51", title: "Druhá obálka", giver: "Nyra Vale", text: "První obálka člověka znervózní. Druhá ho připraví o spánek. Doruč tu druhou a nech ho přemýšlet, co všechno ještě víme.", reward: { influence: 8, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 86, durationMin: 14 },
    { id: "nyra_52", title: "Prasklina v hlavě", giver: "Nyra Vale", text: "Někdy není potřeba někoho zlomit. Stačí mu do hlavy zasadit jednu otázku, která tam začne hnít.", reward: { influence: 10, cash: 700 }, risk: { heat: 3 }, successRate: 84, durationMin: 13 },
    { id: "nyra_53", title: "Cizí hlas ve tmě", giver: "Nyra Vale", text: "Jedna zpráva přehraná správným hlasem dokáže rozebrat víc než zbraň. Pošli ji a nech jejich jistoty umřít potichu.", reward: { influence: 9, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "nyra_54", title: "Ztráta jistoty", giver: "Nyra Vale", text: "Dnes nikomu nevezmeš peníze. Dnes mu vezmeš pocit bezpečí. A ten bývá dražší.", reward: { influence: 11, cash: 600 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "nyra_55", title: "Nespolehlivá vzpomínka", giver: "Nyra Vale", text: "Přesvědč někoho, že si pamatuje věc, která se nikdy nestala. Lidi si zbytek lži dopíšou sami.", reward: { influence: 10, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "nyra_56", title: "Ztracený klid", giver: "Nyra Vale", text: "Jedna maličkost zmizí z bytu, druhá se objeví na špatném místě. A najednou začne mít někdo pocit, že už není sám.", reward: { influence: 9, cash: 800 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_57", title: "Zrcadlo bez odrazu", giver: "Nyra Vale", text: "Každý má obraz sám o sobě. Ty ho dnes rozbiješ a necháš střepy, aby řezaly ještě dlouho potom.", reward: { influence: 12, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 76, durationMin: 19 },
    { id: "nyra_58", title: "Špatná hodina", giver: "Nyra Vale", text: "Vzbuď někoho uprostřed noci zprávou, která nedává smysl. Ráno už ho bude rozkládat vlastní představivost.", reward: { influence: 8, cash: 700 }, risk: { heat: 2 }, successRate: 90, durationMin: 11 },
    { id: "nyra_59", title: "Tenká nitka loajality", giver: "Nyra Vale", text: "Důvěra není zeď. Je to nit. A dnes ji stačí jen lehce naříznout.", reward: { influence: 11, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_60", title: "Zapomenutý klíč", giver: "Nyra Vale", text: "Někdo najde klíč, který nikdy nevlastnil. Přesně od chvíle, kdy ho vezme do ruky, začne přemýšlet, co všechno už někdo otevřel před ním.", reward: { influence: 9, cash: 800, dirtyCash: 300 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_61", title: "Úsměv a jed", giver: "Nyra Vale", text: "Nejhorší rány nepřicházejí v hněvu. Přicházejí s klidem, úsměvem a přesně zvolenou větou.", reward: { influence: 10, dirtyCash: 800 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_62", title: "Hlas na druhém konci", giver: "Nyra Vale", text: "Jedno anonymní zavolání. Jeden správný tón. Jeden večer, který už nikdy nebude normální.", reward: { influence: 8, cash: 900 }, risk: { heat: 3 }, successRate: 85, durationMin: 13 },
    { id: "nyra_63", title: "Návštěva bez svědků", giver: "Nyra Vale", text: "Někdy stačí, aby někdo zahlédl stín za dveřmi a už si nikdy nebude jistý, jestli byl sám.", reward: { influence: 9, dirtyCash: 900 }, risk: { heat: 4 }, successRate: 81, durationMin: 15 },
    { id: "nyra_64", title: "Zpožděná pravda", giver: "Nyra Vale", text: "Pravda je nejjedovatější, když přijde pozdě. Doruč ji přesně ve chvíli, kdy už nikdo nebude věřit vysvětlení.", reward: { influence: 11, cash: 700 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "nyra_65", title: "Křehký dech", giver: "Nyra Vale", text: "Připomeň někomu, jak moc snadno se může zlomit jeho svět. Ne silou. Jen přesností.", reward: { influence: 10, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_66", title: "Prázdná židle", giver: "Nyra Vale", text: "Na schůzce nech jednu židli prázdnou a jednu informaci navíc. Paranoia pak zaplní zbytek místnosti sama.", reward: { influence: 9, cash: 800 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_67", title: "Kroky za zády", giver: "Nyra Vale", text: "Nech někoho slyšet kroky tam, kde nikdo není. To, co si domyslí, bude horší než skutečnost.", reward: { influence: 12, dirtyCash: 600 }, risk: { heat: 4 }, successRate: 77, durationMin: 18 },
    { id: "nyra_68", title: "Rozladěné nervy", giver: "Nyra Vale", text: "Rozbij někomu rytmus dne. Jeden telefon ráno, jeden vzkaz večer, jedna cizí věc doma. Pak už se rozbije sám.", reward: { influence: 10, cash: 700 }, risk: { heat: 3 }, successRate: 88, durationMin: 12 },
    { id: "nyra_69", title: "Otevřená rána", giver: "Nyra Vale", text: "Každý má místo, kam se nevrací. Ty ho tam dnes pošleš zpátky, aniž bys se ho dotkla.", reward: { influence: 11, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 78, durationMin: 17 },
    { id: "nyra_70", title: "Cizí oči", giver: "Nyra Vale", text: "Někdo musí uvěřit, že je sledovaný. Ne proto, že to je pravda. Ale protože strach platí rychleji než důkazy.", reward: { influence: 9, cash: 900 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_71", title: "Jemné rozvrácení", giver: "Nyra Vale", text: "Nezničíš skupinu útokem. Zničíš ji tím, že si každý začne myslet, že ostatní něco skrývají.", reward: { influence: 12, dirtyCash: 700 }, risk: { heat: 4 }, successRate: 79, durationMin: 18 },
    { id: "nyra_72", title: "Jed v tichu", giver: "Nyra Vale", text: "Některé věci není třeba říkat nahlas. Stačí je nechat v hlavě správného člověka dost dlouho.", reward: { influence: 10, cash: 800 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_73", title: "Noc bez odpovědí", giver: "Nyra Vale", text: "Pošli sérii náznaků a pak zmiz. Nejhorší nejsou odpovědi. Nejhorší je, když žádné nepřijdou.", reward: { influence: 9, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_74", title: "Přesná slabost", giver: "Nyra Vale", text: "Síla je hlučná. Slabost je tichá. Najdi ji, stiskni ji a sleduj, jak se celý člověk ohne kolem ní.", reward: { influence: 11, cash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_75", title: "Porušený rytmus", giver: "Nyra Vale", text: "Lidé přežívají díky rutině. Znič ji a zbytek jejich jistot se začne sypat sám.", reward: { influence: 8, dirtyCash: 1000 }, risk: { heat: 3 }, successRate: 88, durationMin: 12 },
    { id: "nyra_76", title: "Místnost bez vzduchu", giver: "Nyra Vale", text: "Zaveď někoho do rozhovoru, kde nebude moct lhát ani utéct. To bývá nejčistší forma násilí.", reward: { influence: 10, cash: 900 }, risk: { heat: 4 }, successRate: 81, durationMin: 15 },
    { id: "nyra_77", title: "Vzkaz pod kůži", giver: "Nyra Vale", text: "Nech zprávu tam, kde ji najde jen ten správný člověk. A kde se jí nebude umět zbavit ani po přečtení.", reward: { influence: 9, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_78", title: "Vina bez svědků", giver: "Nyra Vale", text: "Dnes nevyvoláš strach. Dnes vyvoláš vinu. A vina člověka rozloží zevnitř mnohem pomaleji a důkladněji.", reward: { influence: 12, cash: 700 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "nyra_79", title: "Pocit cizí přítomnosti", giver: "Nyra Vale", text: "Uprav pár detailů a nech někoho dojít domů do prostoru, který už nebude působit jako jeho vlastní.", reward: { influence: 10, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 82, durationMin: 15 },
    { id: "nyra_80", title: "Tichý nátlak", giver: "Nyra Vale", text: "Nátlak nemusí křičet. Stačí, když se usadí vedle člověka a dýchá mu na krk celé odpoledne.", reward: { influence: 9, cash: 900 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_81", title: "Narušený spánek", giver: "Nyra Vale", text: "Vyčerpaný člověk se láme snáz. Připrav ho o klidnou noc a ráno už udělá chybu sám.", reward: { influence: 11, dirtyCash: 700 }, risk: { heat: 3 }, successRate: 89, durationMin: 11 },
    { id: "nyra_82", title: "Jméno ve špatných ústech", giver: "Nyra Vale", text: "Dnes rozšíříš jedno jméno přesně tam, kde ho nikdo nechce slyšet. Škody pak udělá sama jeho ozvěna.", reward: { influence: 10, cash: 800 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "nyra_83", title: "Dům plný ticha", giver: "Nyra Vale", text: "Některá ticha nejsou klidná. Jsou nemocná. Ujisti se, že jedno takové dnes někoho doma počká.", reward: { influence: 9, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_84", title: "Úhel pohledu", giver: "Nyra Vale", text: "Nepotřebuješ měnit fakta. Stačí změnit pořadí, ve kterém je někdo uslyší. A najednou z pravdy začne téct jed.", reward: { influence: 11, cash: 700 }, risk: { heat: 4 }, successRate: 80, durationMin: 17 },
    { id: "nyra_85", title: "Cizí otisk", giver: "Nyra Vale", text: "Nech na místě něco, co tam nepatří. Člověk si pak zbytek scénáře dopíše sám a většinou mnohem hůř, než bychom vymysleli my.", reward: { influence: 8, dirtyCash: 1000 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_86", title: "Dvě verze noci", giver: "Nyra Vale", text: "Stejný večer, dvě různé verze, tři různí svědci. Až se to začne srážet, nezůstane nikomu pevná půda pod nohama.", reward: { influence: 12, cash: 800 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "nyra_87", title: "Rozklad jistoty", giver: "Nyra Vale", text: "Něčí sebevědomí stojí na jedné představě. Dnes mu ji vezmeš a necháš ho sledovat, jak se rozsype všechno okolo.", reward: { influence: 10, dirtyCash: 900 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_88", title: "Přesně načasované ticho", giver: "Nyra Vale", text: "Někdy je nejkrutější neodpovědět. Dnes necháš ticho pracovat déle, než je pro někoho zdravé.", reward: { influence: 9, cash: 900 }, risk: { heat: 2 }, successRate: 91, durationMin: 11 },
    { id: "nyra_89", title: "Neviditelná trhlina", giver: "Nyra Vale", text: "Na povrchu nebude vidět nic. Ale uvnitř už začne všechno praskat. To jsou moje oblíbené práce.", reward: { influence: 11, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 79, durationMin: 17 },
    { id: "nyra_90", title: "Přítomnost bez tváře", giver: "Nyra Vale", text: "Postarej se, aby někdo cítil něčí blízkost, aniž by kdy zahlédl tvář. Lidská představivost je levná a smrtelně účinná zbraň.", reward: { influence: 10, cash: 800 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_91", title: "Sběr slabých míst", giver: "Nyra Vale", text: "Dnes neřešíš velké tajemství. Dnes posbíráš deset malých. A z těch malých se staví nejhorší klece.", reward: { influence: 8, dirtyCash: 1100 }, risk: { heat: 3 }, successRate: 88, durationMin: 12 },
    { id: "nyra_92", title: "Pod kůží města", giver: "Nyra Vale", text: "V každém sektoru pulzuje strach, jen ho nikdo nechce pojmenovat. Dnes mu dáš tvar a cenu.", reward: { influence: 12, cash: 700 }, risk: { heat: 4 }, successRate: 78, durationMin: 18 },
    { id: "nyra_93", title: "Slovo, které zůstane", giver: "Nyra Vale", text: "Vyber jednu větu, která se člověku usadí v hlavě jako střep. A pak ji řekni přesně jednou.", reward: { influence: 9, dirtyCash: 900 }, risk: { heat: 3 }, successRate: 87, durationMin: 12 },
    { id: "nyra_94", title: "Cizí dotek v prostoru", giver: "Nyra Vale", text: "Přesuň pár věcí, nech pár stop a jednu nejasnost. Nic víc. To úplně stačí na dlouhou noc bez dechu.", reward: { influence: 10, cash: 800 }, risk: { heat: 3 }, successRate: 86, durationMin: 13 },
    { id: "nyra_95", title: "Hlad po odpovědi", giver: "Nyra Vale", text: "Dnes někomu nedáš důkaz. Dáš mu jen dost na to, aby po zbytku začal šílet toužit.", reward: { influence: 11, dirtyCash: 800 }, risk: { heat: 4 }, successRate: 80, durationMin: 16 },
    { id: "nyra_96", title: "Jedovatá blízkost", giver: "Nyra Vale", text: "Nejhorší hrozby nejsou daleko. Jsou těsně vedle člověka, ve stejné místnosti, v obyčejném tónu hlasu.", reward: { influence: 10, cash: 900 }, risk: { heat: 3 }, successRate: 85, durationMin: 14 },
    { id: "nyra_97", title: "Vnitřní pád", giver: "Nyra Vale", text: "Některé lidi není třeba srazit. Stačí jim odebrat poslední oporu a oni se zřítí sami.", reward: { influence: 12, dirtyCash: 900 }, risk: { heat: 4 }, successRate: 77, durationMin: 18 },
    { id: "nyra_98", title: "Tři náznaky", giver: "Nyra Vale", text: "První náznak znejistí. Druhý rozhodí. Třetí zlomí. Doruč všechny tři ve správném pořadí.", reward: { influence: 11, cash: 800 }, risk: { heat: 4 }, successRate: 81, durationMin: 16 },
    { id: "nyra_99", title: "Tma mezi lidmi", giver: "Nyra Vale", text: "Největší temnota není v ulicích. Je mezi lidmi, kteří si přestali věřit. Rozšiř ji.", reward: { influence: 13, dirtyCash: 800 }, risk: { heat: 5 }, successRate: 75, durationMin: 19 },
    { id: "nyra_100", title: "Nyřin jed", giver: "Nyra Vale", text: "Zapamatuj si to. Strach je hlasitý jen na začátku. Pak ztichne, usadí se v člověku a začne ho požírat zevnitř. Dnes ten hlad nakrmíme.", reward: { influence: 14, dirtyCash: 1500, cash: 900 }, risk: { heat: 5 }, successRate: 74, durationMin: 20 }
  ];

  function initEventsModal() {
    const openBtn = document.getElementById("city-events-open");
    const modal = document.getElementById("events-modal");
    const backdrop = document.getElementById("events-modal-backdrop");
    const closeBtn = document.getElementById("events-modal-close");
    const tasklist = document.getElementById("events-tasklist");
    const agentName = document.getElementById("events-agent-name");
    const agentType = document.getElementById("events-agent-type");
    const agentDesc = document.getElementById("events-agent-desc");
    const agentQuote = document.getElementById("events-agent-quote");
    const eventsRefreshCountdown = document.getElementById("events-refresh-countdown");
    const agentButtons = Array.from(document.querySelectorAll(".events-agent"));

    if (!modal || !openBtn) return;

    const rewardLabels = {
      cash: "clean cash",
      dirtyCash: "dirty cash",
      influence: "influence",
      metalParts: "metal parts",
      chemical: "chemicals",
      techCore: "tech core",
      streetPistol: "street pistol",
      neonViper: "Neon Viper",
      overdriveX: "Overdrive X",
      velvetSmoke: "Velvet Smoke",
      ghostSerum: "Ghost Serum",
      smg: "SMG",
      ammo: "ammo",
      grenade: "grenade",
      spyGear: "spy gear",
      intel: "intel",
      bulletproofVest: "bulletproof vest",
      bazooka: "bazooka",
      securityCameras: "security camera",
      alarm: "alarm module"
    };

    const formatRewardEntry = (resourceKey, amount) => {
      const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
      if (!safeAmount) return "";
      const label = rewardLabels[resourceKey] || resourceKey;
      if (resourceKey === "cash" || resourceKey === "dirtyCash") {
        return `+${safeAmount.toLocaleString("cs-CZ")} ${label}`;
      }
      return `+${safeAmount} ${label}`;
    };

    const mapCityEventsToTasks = (eventPool, agentKey) => (Array.isArray(eventPool) ? eventPool : []).map((event) => {
      const rewardEntries = Object.entries(event.reward || {})
        .map(([key, value]) => formatRewardEntry(key, value))
        .filter(Boolean);
      const heatRisk = Math.max(0, Math.floor(Number(event?.risk?.heat || 0)));
      return {
        id: event.id,
        agentKey,
        giver: String(event.giver || "").trim(),
        title: event.title,
        desc: event.text,
        reward: { ...(event.reward || {}) },
        gains: rewardEntries,
        risk: heatRisk > 0 ? `Heat +${heatRisk}` : "",
        successRate: Math.max(0, Math.min(100, Math.floor(Number(event.successRate || 0)))),
        durationSec: Math.max(1, Math.floor(Number(event.durationMin || 1)))
      };
    });
    const resolveEventDifficultyMeta = (successRate) => {
      const value = Math.max(0, Math.min(100, Math.floor(Number(successRate || 0))));
      if (value >= 86) return { key: "easy", label: "Easy" };
      if (value >= 73) return { key: "medium", label: "Medium" };
      return { key: "hard", label: "Hard" };
    };
    const victorTasks = mapCityEventsToTasks(victorGraveEvents, "victor");
    const leonTasks = mapCityEventsToTasks(leonSwitchVargaEvents, "leon");
    const nyraTasks = mapCityEventsToTasks(nyraValeEvents, "nira");

    const agents = {
      victor: {
        name: "Victor Grave Kadeř",
        type: "Pouliční boss",
        desc:
          "Bývalý vyhazovač, co si vymlátil vlastní teritorium. Neřeší kecy, jen výsledky. Respekt si bere silou.",
        quote: "Buď to vezmeš nebo to vezme někdo jinej.",
        tasks: victorTasks
      },
      leon: {
        name: "Leon Switch Varga",
        type: "Fixer / obchodník",
        desc:
          "Všechno ví, všechno zařídí. Má kontakty v každém sektoru a nikdy nepracuje zadarmo.",
        quote: "Nejde o to, co máš. Jde o to, co z toho vytěžíš.",
        tasks: leonTasks
      },
      nira: {
        name: "Nyra Vale",
        type: "Informační síť / vliv",
        desc:
          "Vlastní několik klubů a ví o každém všechno. Usmívá se ale tahá za nitky v pozadí.",
        quote: "Informace jsou dražší než krev. A já jich mám dost.",
        tasks: nyraTasks
      }
    };

    const taskLookup = new Map();
    [victorTasks, leonTasks, nyraTasks].forEach((pool) => {
      pool.forEach((task) => {
        if (!task?.id) return;
        taskLookup.set(String(task.id), task);
      });
    });

    const ensureEventDetailModalShell = () => {
      let root = document.getElementById("event-detail-modal");
      if (!root) {
        const shell = document.createElement("div");
        shell.id = "event-detail-modal";
        shell.className = "modal hidden";
        shell.innerHTML = `
          <div id="event-detail-modal-backdrop" class="modal__backdrop"></div>
          <div class="modal__content modal__content--profile event-detail-modal__content">
            <div class="modal__header">
              <h3 id="event-detail-title">Detail eventu</h3>
              <button class="modal__close" id="event-detail-modal-close" aria-label="Zavřít">✕</button>
            </div>
            <div class="modal__body event-detail-modal__body">
              <div class="event-detail-modal__meta">
                <span id="event-detail-giver">-</span>
                <span id="event-detail-stats">Úspěšnost 0% • 0 min</span>
              </div>
              <p class="event-detail-modal__desc" id="event-detail-desc"></p>
              <div class="event-detail-modal__section">
                <div class="event-detail-modal__label">Co hráč může získat</div>
                <div class="event-detail-modal__chips" id="event-detail-gains"></div>
              </div>
              <div class="event-detail-modal__section">
                <div class="event-detail-modal__label">Riziko</div>
                <div class="event-detail-modal__chips" id="event-detail-risk"></div>
              </div>
              <div class="event-detail-modal__actions">
                <button class="btn btn--primary" id="event-detail-accept">Accept</button>
                <button class="btn btn--ghost" id="event-detail-decline">Decline</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(shell);
        root = shell;
      }
      return {
        root,
        backdrop: document.getElementById("event-detail-modal-backdrop"),
        closeBtn: document.getElementById("event-detail-modal-close"),
        title: document.getElementById("event-detail-title"),
        giver: document.getElementById("event-detail-giver"),
        stats: document.getElementById("event-detail-stats"),
        desc: document.getElementById("event-detail-desc"),
        gains: document.getElementById("event-detail-gains"),
        risk: document.getElementById("event-detail-risk"),
        acceptBtn: document.getElementById("event-detail-accept"),
        declineBtn: document.getElementById("event-detail-decline")
      };
    };

    const detailShell = ensureEventDetailModalShell();
    const detailModal = detailShell.root;
    const detailBackdrop = detailShell.backdrop;
    const detailCloseBtn = detailShell.closeBtn;
    const detailTitle = detailShell.title;
    const detailGiver = detailShell.giver;
    const detailStats = detailShell.stats;
    const detailDesc = detailShell.desc;
    const detailGains = detailShell.gains;
    const detailRisk = detailShell.risk;
    const detailAcceptBtn = detailShell.acceptBtn;
    const detailDeclineBtn = detailShell.declineBtn;

    const renderDetailChips = (container, values, variant = "gain") => {
      if (!container) return;
      const list = Array.isArray(values) ? values.filter(Boolean) : [];
      if (!list.length) {
        container.innerHTML = variant === "risk"
          ? '<span class="events-task__gain-chip events-task__gain-chip--muted">Nízké</span>'
          : '<span class="events-task__gain-chip events-task__gain-chip--muted">Bez garantované odměny</span>';
        return;
      }
      container.innerHTML = list.map((value) => {
        const className = variant === "risk" ? "events-task__risk-chip" : "events-task__gain-chip";
        return `<span class="${className}">${escapeHtml(String(value))}</span>`;
      }).join("");
    };

    const rewardToResourceKeyMap = {
      chemical: "chemicals",
      chemicals: "chemicals",
      ammo: "materials",
      alarm: "alarmSystem",
      intel: "dataShards",
      spyGear: "dataShards",
      neonViper: "neonDust"
    };

    const normalizeRewardResourceKey = (key) => {
      const rawKey = String(key || "").trim();
      if (!rawKey) return "";
      return rewardToResourceKeyMap[rawKey] || rawKey;
    };

    const applyEventRewardsToPlayerState = (task) => {
      const rewardEntries = Object.entries(task?.reward || {});
      if (!rewardEntries.length) return [];
      const appliedLabels = [];

      rewardEntries.forEach(([key, rawAmount]) => {
        const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
        if (!amount) return;
        if (key === "cash") {
          addCleanCash(amount);
          appliedLabels.push(`+${amount.toLocaleString("cs-CZ")} clean cash`);
          return;
        }
        if (key === "dirtyCash") {
          addDirtyCash(amount);
          appliedLabels.push(`+${amount.toLocaleString("cs-CZ")} dirty cash`);
          return;
        }
        if (key === "influence") {
          addInfluence(amount);
          if (cachedProfile && typeof cachedProfile === "object") {
            cachedProfile.influence = Math.max(0, Math.floor(Number(cachedProfile.influence || 0) + amount));
            window.Empire.player = {
              ...(window.Empire.player || {}),
              influence: cachedProfile.influence
            };
          }
          appliedLabels.push(`+${amount} influence`);
          return;
        }
        const normalizedResource = normalizeRewardResourceKey(key);
        const added = addEconomyResource(normalizedResource, amount);
        if (added > 0) {
          appliedLabels.push(formatRewardEntry(normalizedResource, added));
        }
      });

      return appliedLabels;
    };

    const activeCityEventRuns = new Map();
    const getCityEventRunState = (taskId) => {
      const run = activeCityEventRuns.get(String(taskId || "").trim());
      if (!run) return { active: false, remainingSec: 0 };
      const remainingMs = Math.max(0, Number(run.endsAt || 0) - Date.now());
      return {
        active: remainingMs > 0,
        remainingSec: Math.max(0, Math.ceil(remainingMs / 1000))
      };
    };
    const writeCityEventsInfo = (message) => {
      if (!agentDesc) return;
      const text = String(message || "").trim();
      if (!text) return;
      agentDesc.textContent = text;
    };

    const resolveEventOutcomePool = (task, wasSuccess) => {
      const title = String(task?.title || "Event").trim();
      const risk = String(task?.risk || "Heat +0").trim();
      const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
      if (wasSuccess) {
        return [
          `${title}: operace proběhla čistě. Výsledek dorazil do skladu.`,
          `${title}: cíl splněn za ${durationSec}s. Trasa byla tichá a bez úniku.`,
          `${title}: úspěch. ${risk} zůstalo pod kontrolou.`
        ];
      }
      return [
        `${title}: akce se rozpadla během přesunu. Bez zisku.`,
        `${title}: operace selhala. Kontakt zmizel ještě před dokončením.`,
        `${title}: průser. ${risk} vystřelilo nahoru a zisk je nulový.`
      ];
    };

    const resolveRandomOutcomeLine = (task, wasSuccess) => {
      const pool = resolveEventOutcomePool(task, wasSuccess);
      if (!pool.length) return wasSuccess ? "Event dokončen úspěšně." : "Event selhal.";
      const index = Math.max(0, Math.floor(Math.random() * pool.length)) % pool.length;
      return String(pool[index] || pool[0] || "").trim();
    };

    const finalizeCityEventRun = (runId) => {
      const run = activeCityEventRuns.get(runId);
      if (!run) return;
      activeCityEventRuns.delete(runId);

      const task = run.task;
      const successRoll = Math.random() * 100;
      const wasSuccess = successRoll <= Math.max(0, Math.min(100, Number(task?.successRate || 0)));
      const outcomeLine = resolveRandomOutcomeLine(task, wasSuccess);

      if (wasSuccess) {
        const appliedRewards = applyEventRewardsToPlayerState(task);
        const gainInfo = appliedRewards.length
          ? ` • Zisk: ${appliedRewards.join(", ")}`
          : "";
        const infoMessage = `${outcomeLine}${gainInfo}`;
        writeCityEventsInfo(infoMessage);
        pushInfoWindowHistoryEntry({
          title: `Event dokončen • ${String(task?.title || "City Event")}`,
          text: infoMessage
        });
        pushEvent(`${outcomeLine}${gainInfo}`);
        showActionConfirmPopup({
          tone: "spy",
          title: "EVENT DOKONČEN",
          subtitle: infoMessage
        });
        if (selectedAgentKey) renderTasks(selectedAgentKey);
        renderPlayerCharacterEvents();
        return;
      }

      writeCityEventsInfo(outcomeLine);
      pushInfoWindowHistoryEntry({
        title: `Event selhal • ${String(task?.title || "City Event")}`,
        text: outcomeLine
      });
      pushEvent(outcomeLine);
      showActionConfirmPopup({
        tone: "attack",
        title: "EVENT SELHAL",
        subtitle: outcomeLine
      });
      if (selectedAgentKey) renderTasks(selectedAgentKey);
      renderPlayerCharacterEvents();
    };

    const startCityEventRun = (task) => {
      const taskId = String(task?.id || "").trim();
      if (!taskId) return false;
      if (activeCityEventRuns.has(taskId)) {
        pushEvent(`Event ${task.title} už běží.`);
        showActionConfirmPopup({
          tone: "spy",
          title: "EVENT UŽ BĚŽÍ",
          subtitle: `${task.title} je právě aktivní.`
        });
        return false;
      }
      const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
      const run = {
        id: taskId,
        task,
        startedAt: Date.now(),
        endsAt: Date.now() + (durationSec * 1000),
        timeoutId: null
      };
      run.timeoutId = window.setTimeout(() => {
        finalizeCityEventRun(taskId);
      }, durationSec * 1000);
      activeCityEventRuns.set(taskId, run);
      writeCityEventsInfo(`Event běží: ${task.title} • dokončení za ${durationSec}s`);
      pushEvent(`Spuštěno: ${task.title} • trvání ${durationSec}s`);
      showActionConfirmPopup({
        tone: "attack",
        title: "EVENT SPUŠTĚN",
        subtitle: `${task.title} • ${durationSec}s`
      });
      if (selectedAgentKey) renderTasks(selectedAgentKey);
      renderPlayerCharacterEvents();
      return true;
    };

    let selectedEventTask = null;
    const openEventDetailModal = (task) => {
      if (!task || !detailModal) return;
      selectedEventTask = task;
      const difficulty = resolveEventDifficultyMeta(task.successRate);
      if (detailTitle) detailTitle.textContent = String(task.title || "Detail eventu");
      if (detailGiver) detailGiver.textContent = String(task.giver || agents[task.agentKey || ""]?.name || "-");
      if (detailStats) {
        const runState = getCityEventRunState(task.id);
        detailStats.innerHTML = `
          <span>Úspěšnost ${Math.max(0, Math.floor(Number(task.successRate || 0)))}% • ${Math.max(1, Math.floor(Number(task.durationSec || 1)))} s${runState.active ? ` • Zamčeno ${runState.remainingSec}s` : ""}</span>
          <span class="event-detail-modal__difficulty event-difficulty event-difficulty--${difficulty.key}">${difficulty.label}</span>
        `;
      }
      if (detailDesc) detailDesc.textContent = String(task.desc || "");
      renderDetailChips(detailGains, task.gains, "gain");
      renderDetailChips(detailRisk, task.risk ? [task.risk] : [], "risk");
      const runState = getCityEventRunState(task.id);
      if (detailAcceptBtn) {
        detailAcceptBtn.disabled = runState.active;
        detailAcceptBtn.textContent = runState.active ? `Probíhá (${runState.remainingSec}s)` : "Accept";
      }
      detailModal.classList.remove("hidden");
    };

    const closeEventDetailModal = () => {
      if (!detailModal) return;
      detailModal.classList.add("hidden");
      selectedEventTask = null;
    };

    if (detailBackdrop) detailBackdrop.addEventListener("click", closeEventDetailModal);
    if (detailCloseBtn) detailCloseBtn.addEventListener("click", closeEventDetailModal);
    if (detailAcceptBtn) {
      detailAcceptBtn.addEventListener("click", () => {
        if (!selectedEventTask) return;
        startCityEventRun(selectedEventTask);
        closeEventDetailModal();
      });
    }
    if (detailDeclineBtn) {
      detailDeclineBtn.addEventListener("click", () => {
        if (!selectedEventTask) return;
        pushEvent(`Odmítnuto: ${selectedEventTask.title}`);
        closeEventDetailModal();
      });
    }

    const renderTasks = (agentKey) => {
      const agent = agents[agentKey];
      if (!agent || !tasklist) return;
      selectedAgentKey = agentKey;
      agentButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.agent === agentKey));
      if (agentName) agentName.textContent = agent.name;
      if (agentType) agentType.textContent = agent.type;
      if (agentDesc) agentDesc.textContent = agent.desc;
      if (agentQuote) agentQuote.textContent = agent.quote;
      const visibleTasks = resolveVisibleCharacterTasks(agentKey, agent.tasks);
      tasklist.innerHTML = visibleTasks
        .map(
          (task) => {
            const hasOperationalMeta = Number.isFinite(Number(task?.successRate)) || Number.isFinite(Number(task?.durationSec));
            const successRate = Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0))));
            const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
            const difficulty = resolveEventDifficultyMeta(successRate);
            const runState = getCityEventRunState(task?.id);
            const metaLabel = hasOperationalMeta
              ? `Úspěšnost ${successRate}% • ${durationSec}s${runState.active ? ` • Zamčeno ${runState.remainingSec}s` : ""}`
              : "Dynamická operace";
            return `
          <div class="events-task${runState.active ? " events-task--locked" : ""}" data-event-open="${task.id || ""}" data-event-locked="${runState.active ? "1" : "0"}">
            <div class="events-task__title">${task.title}</div>
            <div class="events-task__desc">${task.desc}</div>
            <div class="events-task__meta">
              <span>${metaLabel}</span>
              <span class="event-difficulty event-difficulty--${difficulty.key}">${difficulty.label}</span>
            </div>
          </div>
        `;
          }
        )
        .join("");
      tasklist.querySelectorAll("[data-event-open]").forEach((row) => {
        if (!(row instanceof HTMLElement) || row.dataset.bound === "1") return;
        row.dataset.bound = "1";
        const openFromRow = (event) => {
          if (event) event.preventDefault();
          const taskId = String(row.dataset.eventOpen || "").trim();
          if (!taskId) return;
          const selectedTask = taskLookup.get(taskId);
          if (!selectedTask) return;
          openEventDetailModal(selectedTask);
        };
        row.addEventListener("pointerdown", openFromRow);
        row.addEventListener("click", openFromRow);
      });
      modal.classList.remove("events-modal--compact");
    };

    const playerCharacterEventsList = document.getElementById("player-character-events-list");
    const playerCharacterEventsNext = document.getElementById("player-character-events-next");
    const characterEventPools = [
      { key: "victor", name: "Victor", tasks: victorTasks },
      { key: "leon", name: "Leon", tasks: leonTasks },
      { key: "nira", name: "Nyra", tasks: nyraTasks }
    ];
    const poolIndexes = {
      victor: 0,
      leon: 0,
      nira: 0
    };
    const MAX_VISIBLE_EVENTS_PER_CHARACTER = 3;
    let selectedAgentKey = null;
    const CHARACTER_EVENTS_REFRESH_SECONDS = 30;
    let secondsToNextCharacterRefresh = CHARACTER_EVENTS_REFRESH_SECONDS;

    const updateEventsRefreshCountdownLabel = () => {
      if (!eventsRefreshCountdown) return;
      if (!isBlackoutLikeScenario()) {
        eventsRefreshCountdown.textContent = "refresh paused";
        return;
      }
      eventsRefreshCountdown.textContent = `refresh ${Math.max(0, Math.floor(Number(secondsToNextCharacterRefresh || 0)))}s`;
    };

    const resolveVisibleCharacterTasks = (poolKey, tasks) => {
      const safeTasks = Array.isArray(tasks) ? tasks : [];
      if (!safeTasks.length) return [];
      const activePinned = safeTasks
        .filter((task) => getCityEventRunState(task?.id).active)
        .slice(0, MAX_VISIBLE_EVENTS_PER_CHARACTER);
      const remainingSlots = Math.max(0, MAX_VISIBLE_EVENTS_PER_CHARACTER - activePinned.length);
      if (remainingSlots <= 0) return activePinned;

      const rotatingPool = safeTasks.filter((task) => {
        const taskId = String(task?.id || "").trim();
        return !activePinned.some((activeTask) => String(activeTask?.id || "").trim() === taskId);
      });
      if (!rotatingPool.length) return activePinned;
      if (rotatingPool.length <= remainingSlots) return [...activePinned, ...rotatingPool];

      const offset = Math.max(0, Math.floor(Number(poolIndexes[poolKey] || 0))) % rotatingPool.length;
      const rotated = [];
      for (let index = 0; index < remainingSlots; index += 1) {
        rotated.push(rotatingPool[(offset + index) % rotatingPool.length]);
      }
      return [...activePinned, ...rotated];
    };

    const renderPlayerCharacterEvents = () => {
      if (!playerCharacterEventsList) return;
      if (!isBlackoutLikeScenario()) {
        playerCharacterEventsList.innerHTML = '<button class="player-character-event" type="button" disabled>Eventy jsou aktivní ve stavu HRA.</button>';
        if (playerCharacterEventsNext) playerCharacterEventsNext.textContent = "stav: mimo HRA";
        return;
      }
      const groupedItems = characterEventPools.map((pool) => ({
        key: pool.key,
        name: pool.name,
        tasks: resolveVisibleCharacterTasks(pool.key, pool.tasks)
      })).filter((group) => Array.isArray(group.tasks) && group.tasks.length);
      if (!groupedItems.length) {
        playerCharacterEventsList.innerHTML = '<button class="player-character-event" type="button" disabled>Žádné eventy</button>';
        return;
      }
      playerCharacterEventsList.innerHTML = groupedItems.map((group) => `
        <div class="player-character-group">
          <div class="player-character-group__title">${escapeHtml(group.name)} • ${group.tasks.length} eventy</div>
          ${group.tasks.map((task) => `
            <button class="player-character-event${getCityEventRunState(task.id).active ? " player-character-event--locked" : ""}" type="button" data-character-event-id="${task.id}">
              <span class="player-character-event__agent">${escapeHtml(group.name)}</span>
              <span class="player-character-event__meta">Úspěšnost ${task.successRate}% • ${task.durationSec}s${getCityEventRunState(task.id).active ? ` • Zamčeno ${getCityEventRunState(task.id).remainingSec}s` : ""}</span>
              <span class="player-character-event__difficulty event-difficulty event-difficulty--${resolveEventDifficultyMeta(task.successRate).key}">${resolveEventDifficultyMeta(task.successRate).label}</span>
              <span class="player-character-event__title">${escapeHtml(task.title)}</span>
            </button>
          `).join("")}
        </div>
      `).join("");
      playerCharacterEventsList.querySelectorAll("[data-character-event-id]").forEach((row) => {
        if (!(row instanceof HTMLElement) || row.dataset.bound === "1") return;
        row.dataset.bound = "1";
        const openFromRow = (event) => {
          if (event) event.preventDefault();
          const taskId = String(row.dataset.characterEventId || "").trim();
          if (!taskId) return;
          const selectedTask = taskLookup.get(taskId);
          if (!selectedTask) return;
          openEventDetailModal(selectedTask);
        };
        row.addEventListener("pointerdown", openFromRow);
        row.addEventListener("click", openFromRow);
      });
    };

    const rotateCharacterEvents = () => {
      Object.keys(poolIndexes).forEach((key) => {
        const pool = characterEventPools.find((entry) => entry.key === key);
        const size = Array.isArray(pool?.tasks) ? pool.tasks.length : 0;
        if (!size) return;
        poolIndexes[key] = (Math.max(0, Math.floor(Number(poolIndexes[key] || 0))) + 1) % size;
      });
      secondsToNextCharacterRefresh = CHARACTER_EVENTS_REFRESH_SECONDS;
      renderPlayerCharacterEvents();
      updateEventsRefreshCountdownLabel();
      if (selectedAgentKey) {
        renderTasks(selectedAgentKey);
      }
    };

    let lastKnownScenarioKey = activePlayerScenarioKey;
    renderPlayerCharacterEvents();
    updateEventsRefreshCountdownLabel();
    if (playerCharacterEventsNext) {
      playerCharacterEventsNext.textContent = isBlackoutLikeScenario()
        ? `refresh za ${CHARACTER_EVENTS_REFRESH_SECONDS} s`
        : "stav: mimo HRA";
    }
    if (characterEventsRotationIntervalId) {
      clearInterval(characterEventsRotationIntervalId);
      characterEventsRotationIntervalId = null;
    }
    characterEventsRotationIntervalId = setInterval(() => {
      if (selectedAgentKey && modal && !modal.classList.contains("hidden")) {
        renderTasks(selectedAgentKey);
      }
      if (detailModal && !detailModal.classList.contains("hidden") && selectedEventTask) {
        const refreshedTask = taskLookup.get(String(selectedEventTask.id || "").trim()) || selectedEventTask;
        openEventDetailModal(refreshedTask);
      }
      if (lastKnownScenarioKey !== activePlayerScenarioKey) {
        lastKnownScenarioKey = activePlayerScenarioKey;
        secondsToNextCharacterRefresh = CHARACTER_EVENTS_REFRESH_SECONDS;
        renderPlayerCharacterEvents();
        updateEventsRefreshCountdownLabel();
      }
      if (!isBlackoutLikeScenario()) return;
      secondsToNextCharacterRefresh -= 1;
      if (secondsToNextCharacterRefresh <= 0) {
        rotateCharacterEvents();
        return;
      }
      updateEventsRefreshCountdownLabel();
      if (playerCharacterEventsNext) {
        playerCharacterEventsNext.textContent = `refresh za ${secondsToNextCharacterRefresh} s`;
      }
    }, 1000);

    const resetToCompactState = () => {
      agentButtons.forEach((btn) => btn.classList.remove("is-active"));
      if (agentName) agentName.textContent = "Vyber postavu";
      if (agentType) agentType.textContent = "Každá má jiné questy";
      if (agentDesc) {
        agentDesc.textContent = "Klikni na postavu a zobrazí se její popis a dočasné úkoly.";
      }
      if (agentQuote) agentQuote.textContent = "";
      if (tasklist) tasklist.innerHTML = "";
      modal.classList.add("events-modal--compact");
    };

    const openModal = () => {
      resetToCompactState();
      setMobileTopbarCoveredByPrimaryModal(true);
      modal.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("empire:city-events-opened", {
        detail: {
          open: true
        }
      }));
    };
    const closeModal = () => {
      modal.classList.add("hidden");
      modal.classList.add("events-modal--compact");
      setMobileTopbarCoveredByPrimaryModal(false);
    };

    openBtn.addEventListener("click", openModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeModal();
      }
      if (event.key === "Escape" && detailModal && !detailModal.classList.contains("hidden")) {
        closeEventDetailModal();
      }
    });

    agentButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        renderTasks(btn.dataset.agent);
        document.dispatchEvent(new CustomEvent("empire:city-events-agent-selected", {
          detail: {
            agentKey: btn.dataset.agent || null,
            agentName: agents[btn.dataset.agent || ""]?.name || null
          }
        }));
      });
    });

    if (tasklist) {
      tasklist.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-event-open]");
        if (!(row instanceof HTMLElement)) return;
        const taskId = String(row.dataset.eventOpen || "").trim();
        if (!taskId) return;
        const selectedTask = taskLookup.get(taskId);
        if (!selectedTask) return;
        openEventDetailModal(selectedTask);
      });
      tasklist.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-event-open]");
        if (!(row instanceof HTMLElement)) return;
        event.preventDefault();
        const taskId = String(row.dataset.eventOpen || "").trim();
        if (!taskId) return;
        const selectedTask = taskLookup.get(taskId);
        if (!selectedTask) return;
        openEventDetailModal(selectedTask);
      });
    }

    if (playerCharacterEventsList) {
      playerCharacterEventsList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-character-event-id]");
        if (!(row instanceof HTMLElement)) return;
        const taskId = String(row.dataset.characterEventId || "").trim();
        if (!taskId) return;
        const selectedTask = taskLookup.get(taskId);
        if (!selectedTask) return;
        openEventDetailModal(selectedTask);
      });
      playerCharacterEventsList.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-character-event-id]");
        if (!(row instanceof HTMLElement)) return;
        event.preventDefault();
        const taskId = String(row.dataset.characterEventId || "").trim();
        if (!taskId) return;
        const selectedTask = taskLookup.get(taskId);
        if (!selectedTask) return;
        openEventDetailModal(selectedTask);
      });
    }
  }

  const BOUNTY_HUNT_MODE_THRESHOLD = 10000;
  const bountyUnitValueMap = {
    clean_cash: 1,
    neonDust: 180,
    pulseShot: 220,
    velvetSmoke: 260,
    ghostSerum: 320,
    overdriveX: 420,
    metalParts: 120,
    techCore: 220,
    combatModule: 340
  };

  function formatBountyMoneyValue(value) {
    return `$${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("cs-CZ")}`;
  }

  function formatBountyObjectiveLabel(value) {
    const safeValue = String(value || "").trim();
    if (safeValue === "successful-attack") return "Za úspěšný útok";
    if (safeValue === "destroy-units") return "Za zničení jednotek";
    return "Za obsazení districtu";
  }

  function resolveBountyThreatLevel(districtCount) {
    const safeCount = Math.max(0, Math.floor(Number(districtCount || 0)));
    if (safeCount >= 18) return { label: "Extreme threat", tone: "extreme" };
    if (safeCount >= 10) return { label: "High threat", tone: "high" };
    if (safeCount >= 5) return { label: "Medium threat", tone: "medium" };
    return { label: "Low threat", tone: "low" };
  }

  function resolveBountyLastActivityLabel(player) {
    const explicitValue = String(
      player?.lastActivity
      || player?.lastActivityLabel
      || player?.activity
      || ""
    ).trim();
    if (explicitValue) return explicitValue;
    return Math.max(0, Math.floor(Number(player?.districtCount || 0))) > 0
      ? "Aktivní na mapě"
      : "Bez potvrzené aktivity";
  }

  function getBountyUnitValue(resourceKey) {
    return Math.max(0, Math.floor(Number(
      bountyUnitValueMap[String(resourceKey || "").trim()]
      || 0
    )));
  }

  function initBountyModal() {
    window.Empire.openBountyModalShortcut = () => {
      window.Empire.Bounty?.openModal?.();
    };
    const existingModal = document.getElementById("bounty-modal");
    if (existingModal) existingModal.remove();
    setMobileTopbarCoveredByPrimaryModal(false);
    try {
      localStorage.removeItem(LOCAL_BOUNTY_STORAGE_KEY);
    } catch {}
    syncBountyDistrictMarkers([]);
    return;
    const shell = ensureBountyModalShell();
    const {
      root,
      backdrop,
      closeBtn,
      cancelBtn,
      targetSelect,
      districtSelect,
      submitBtn,
      targetName,
      targetAlliance,
      targetDistricts,
      targetActivity,
      targetThreat,
      targetAvatar,
      targetAvatarFallback,
      cashRange,
      cashInput,
      cashAvailable,
      drugTypeSelect,
      drugsInput,
      drugsAvailable,
      materialTypeSelect,
      materialsInput,
      materialsAvailable,
      anonymousInput,
      previewTarget,
      previewValue,
      previewType,
      previewDuration,
      previewAnonymous,
      huntModeState,
      huntModeProgressFill,
      huntModeProgressLabel,
      districtField
    } = shell;
    if (
      !root || !targetSelect || !districtSelect || !submitBtn || !cancelBtn
      || !targetName || !targetAlliance || !targetDistricts || !targetActivity || !targetThreat
      || !targetAvatar || !targetAvatarFallback
      || !cashRange || !cashInput || !cashAvailable
      || !drugTypeSelect || !drugsInput || !drugsAvailable
      || !materialTypeSelect || !materialsInput || !materialsAvailable
      || !anonymousInput
      || !previewTarget || !previewValue || !previewType || !previewDuration || !previewAnonymous
      || !huntModeState || !huntModeProgressFill || !huntModeProgressLabel || !districtField
    ) return;

    const objectiveInputs = Array.from(root.querySelectorAll('input[name="bounty-objective"]'));
    const durationInputs = Array.from(root.querySelectorAll('input[name="bounty-duration"]'));
    if (!objectiveInputs.length || !durationInputs.length) return;

    const getSelectedObjectiveType = () => {
      const selected = objectiveInputs.find((input) => input.checked);
      return String(selected?.value || "occupy-sector").trim() || "occupy-sector";
    };
    const getSelectedDurationHours = () => {
      const selected = durationInputs.find((input) => input.checked);
      return Math.max(1, Math.floor(Number(selected?.value || 12)));
    };

    const clampInputValue = (input, maxValue) => {
      const safeMax = Math.max(0, Math.floor(Number(maxValue || 0)));
      const nextValue = Math.min(safeMax, Math.max(0, Math.floor(Number(input?.value || 0))));
      if (input) {
        input.max = String(safeMax);
        input.value = String(nextValue);
      }
      return nextValue;
    };

    const renderTargetOptions = (players) => {
      let safePlayers = Array.isArray(players) ? players : [];
      if (!safePlayers.length && (isBlackoutLikeScenario() || scenarioVisionEnabled)) {
        const byName = new Map();
        (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).forEach((district) => {
          const ownerName = String(
            district?.ownerNick
            || district?.owner_username
            || district?.ownerUsername
            || district?.owner
            || ""
          ).trim();
          const normalized = normalizeOwnerName(ownerName);
          if (!normalized) return;
          const current = byName.get(normalized) || {
            name: ownerName,
            districtCount: 0,
            allianceName: String(
              district?.ownerAllianceName
              || district?.owner_alliance_name
              || ""
            ).trim() || "Bez aliance",
            avatar: String(district?.ownerAvatar || "").trim()
          };
          current.districtCount += 1;
          byName.set(normalized, current);
        });
        safePlayers = Array.from(byName.values())
          .filter((entry) => normalizeOwnerName(entry?.name) !== resolveCurrentPlayerOwnerKey())
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "cs"));
      }
      if (!safePlayers.length && !window.Empire.token) {
        safePlayers = [{
          name: "Mariah",
          districtCount: 1,
          allianceName: "Bez aliance",
          avatar: ""
        }];
      }
      const currentValue = String(targetSelect.value || "").trim();
      targetSelect.innerHTML = safePlayers.length
        ? [
          '<option value="">Vyber hráče</option>',
          ...safePlayers.map((player) => {
            const districtCount = Math.max(0, Math.floor(Number(player?.districtCount || 0)));
            return `<option value="${escapeHtml(String(player?.name || ""))}">${escapeHtml(String(player?.name || ""))} • ${districtCount} districtů</option>`;
          })
        ].join("")
        : '<option value="">Žádný nepřátelský hráč na mapě</option>';
      if (safePlayers.some((player) => String(player?.name || "") === currentValue)) {
        targetSelect.value = currentValue;
      } else if (safePlayers[0]?.name) {
        targetSelect.value = String(safePlayers[0].name);
        if (targetSelect.selectedIndex <= 0 && targetSelect.options.length > 1) {
          targetSelect.selectedIndex = 1;
        }
      }
    };

    const renderDistrictOptions = (playerName) => {
      const normalized = normalizeOwnerName(playerName);
      const districts = (Array.isArray(window.Empire.districts) ? window.Empire.districts : [])
        .filter((district) => normalizeOwnerName(
          district?.ownerNick
          || district?.owner_username
          || district?.ownerUsername
          || district?.owner
        ) === normalized)
        .sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || ""), "cs", { numeric: true }));
      const currentValue = String(districtSelect.value || "").trim();
      districtSelect.innerHTML = [
        '<option value="">Jakýkoli district</option>',
        ...districts.map((district) => {
          const districtId = String(district?.id || "").trim();
          const districtName = String(district?.name || "Distrikt").trim() || "Distrikt";
          return `<option value="${escapeHtml(districtId)}">#${escapeHtml(districtId)} • ${escapeHtml(districtName)}</option>`;
        })
      ].join("");
      if (currentValue && districts.some((district) => String(district?.id || "") === currentValue)) {
        districtSelect.value = currentValue;
      }
    };

    const renderRewardTypeOptions = () => {
      const availability = getBountyAvailableResourceMap();
      const currentDrugKey = String(drugTypeSelect.value || "").trim();
      const currentMaterialKey = String(materialTypeSelect.value || "").trim();

      drugTypeSelect.innerHTML = storageDrugTypes
        .map((item) => {
          const available = Math.max(0, Math.floor(Number(availability[item.key] || 0)));
          return `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)} • ${available} ks</option>`;
        })
        .join("");
      materialTypeSelect.innerHTML = factorySupplyTypes
        .map((item) => {
          const available = Math.max(0, Math.floor(Number(availability[item.key] || 0)));
          return `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)} • ${available} ks</option>`;
        })
        .join("");

      if (storageDrugTypes.some((item) => item.key === currentDrugKey)) {
        drugTypeSelect.value = currentDrugKey;
      } else if (storageDrugTypes[0]?.key) {
        drugTypeSelect.value = storageDrugTypes[0].key;
      }
      if (factorySupplyTypes.some((item) => item.key === currentMaterialKey)) {
        materialTypeSelect.value = currentMaterialKey;
      } else if (factorySupplyTypes[0]?.key) {
        materialTypeSelect.value = factorySupplyTypes[0].key;
      }
    };

    const renderTargetCard = (players, playerName) => {
      const selected = (Array.isArray(players) ? players : []).find((player) => String(player?.name || "") === String(playerName || ""));
      if (!selected) {
        targetName.textContent = "Nevybrán cíl";
        targetAlliance.textContent = "Bez aliance";
        targetDistricts.textContent = "Districtů: 0";
        targetActivity.textContent = "Poslední aktivita: -";
        targetThreat.textContent = "Low threat";
        targetThreat.dataset.tone = "low";
        targetAvatar.src = "";
        targetAvatar.alt = "Target avatar";
        targetAvatar.classList.add("is-empty");
        targetAvatarFallback.textContent = "??";
        return null;
      }

      const allianceLabel = String(selected?.allianceName || "").trim() || "Bez aliance";
      const districtCount = Math.max(0, Math.floor(Number(selected?.districtCount || 0)));
      const threat = resolveBountyThreatLevel(districtCount);
      const avatar = String(selected?.avatar || "").trim();

      targetName.textContent = String(selected?.name || "Hráč");
      targetAlliance.textContent = allianceLabel === "Bez aliance" ? "Bez aliance" : `[${allianceLabel}]`;
      targetDistricts.textContent = `Districtů: ${districtCount}`;
      targetActivity.textContent = `Poslední aktivita: ${resolveBountyLastActivityLabel(selected)}`;
      targetThreat.textContent = threat.label;
      targetThreat.dataset.tone = threat.tone;
      targetAvatarFallback.textContent = String(selected?.name || "??").trim().slice(0, 2).toUpperCase() || "??";

      if (avatar) {
        targetAvatar.src = avatar;
        targetAvatar.alt = `Avatar ${selected.name}`;
        targetAvatar.classList.remove("is-empty");
      } else {
        targetAvatar.src = "";
        targetAvatar.alt = "Target avatar";
        targetAvatar.classList.add("is-empty");
      }

      return selected;
    };
    const syncRewardInputs = () => {
      const aggregateAvailability = getBountyAggregateAvailabilityMap();
      const detailedAvailability = getBountyAvailableResourceMap();
      const selectedDrugKey = String(drugTypeSelect.value || "").trim();
      const selectedMaterialKey = String(materialTypeSelect.value || "").trim();

      const cashMax = Math.max(0, Math.floor(Number(aggregateAvailability.cash || 0)));
      const drugsMax = Math.max(0, Math.floor(Number(detailedAvailability[selectedDrugKey] || 0)));
      const materialsMax = Math.max(0, Math.floor(Number(detailedAvailability[selectedMaterialKey] || 0)));

      cashRange.max = String(cashMax);
      cashInput.max = String(cashMax);
      cashRange.value = String(Math.min(cashMax, Math.max(0, Math.floor(Number(cashRange.value || cashInput.value || 0)))));
      cashInput.value = String(Math.min(cashMax, Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)))));
      clampInputValue(drugsInput, drugsMax);
      clampInputValue(materialsInput, materialsMax);

      cashAvailable.textContent = `máš: ${cashMax.toLocaleString("cs-CZ")}`;
      drugsAvailable.textContent = `máš: ${drugsMax.toLocaleString("cs-CZ")} ks`;
      materialsAvailable.textContent = `máš: ${materialsMax.toLocaleString("cs-CZ")} ks`;
    };

    const syncDistrictFieldState = () => {
      const objectiveType = getSelectedObjectiveType();
      const districtMode = objectiveType === "occupy-sector";
      districtField.hidden = !districtMode;
      districtSelect.disabled = !districtMode;
      if (!districtMode) districtSelect.value = "";
    };

    const syncPreview = (players) => {
      const selectedTarget = renderTargetCard(players, targetSelect.value);
      const objectiveType = getSelectedObjectiveType();
      const durationHours = getSelectedDurationHours();
      const selectedDrug = storageDrugTypes.find((item) => item.key === String(drugTypeSelect.value || "").trim());
      const selectedMaterial = factorySupplyTypes.find((item) => item.key === String(materialTypeSelect.value || "").trim());
      const cashAmount = Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)));
      const drugAmount = Math.max(0, Math.floor(Number(drugsInput.value || 0)));
      const materialAmount = Math.max(0, Math.floor(Number(materialsInput.value || 0)));
      const totalValue = cashAmount
        + drugAmount * getBountyUnitValue(selectedDrug?.key)
        + materialAmount * getBountyUnitValue(selectedMaterial?.key);
      const progressPct = Math.max(0, Math.min(100, Math.round((totalValue / BOUNTY_HUNT_MODE_THRESHOLD) * 100)));

      previewTarget.textContent = selectedTarget?.name || "Nevybrán cíl";
      previewValue.textContent = formatBountyMoneyValue(totalValue);
      previewType.textContent = formatBountyObjectiveLabel(objectiveType);
      previewDuration.textContent = `${durationHours}h`;
      previewAnonymous.textContent = anonymousInput.checked ? "Anonymní vypsání" : "Veřejné vypsání";

      if (totalValue >= BOUNTY_HUNT_MODE_THRESHOLD) {
        huntModeState.textContent = "HUNT MODE AKTIVNÍ";
        huntModeState.dataset.mode = "active";
        huntModeProgressFill.style.width = "100%";
        huntModeProgressLabel.textContent = "Celé město dostalo důvod jít po cíli.";
      } else {
        huntModeState.textContent = "Hunt mode se plní";
        huntModeState.dataset.mode = "charging";
        huntModeProgressFill.style.width = `${progressPct}%`;
        huntModeProgressLabel.textContent = `Do HUNT MODE zbývá ${formatBountyMoneyValue(BOUNTY_HUNT_MODE_THRESHOLD - totalValue)}.`;
      }

      submitBtn.disabled = !selectedTarget || totalValue <= 0;
    };

    const renderBountyModalState = () => {
      const players = collectBountyEligiblePlayers();
      renderTargetOptions(players);
      renderDistrictOptions(targetSelect.value);
      renderRewardTypeOptions();
      syncRewardInputs();
      syncDistrictFieldState();
      syncPreview(players);
      return players;
    };

    let initialized = root.dataset.initialized === "1";
    const closeModal = () => {
      root.classList.add("hidden");
      setMobileTopbarCoveredByPrimaryModal(false);
    };
    const openModal = () => {
      root.classList.remove("hidden");
      setMobileTopbarCoveredByPrimaryModal(true);
      try {
        renderBountyModalState();
      } catch {
        pushEvent("Bounty kartu se nepodařilo načíst.");
      }
    };

    if (!initialized) {
      root.dataset.initialized = "1";
      let lastTriggerAt = 0;
      const openFromTrigger = (source = "city-events-card") => {
        const now = Date.now();
        if (now - lastTriggerAt < 220) return;
        lastTriggerAt = now;
        document.dispatchEvent(new CustomEvent("empire:bounty-button-clicked", {
          detail: { source }
        }));
        openModal();
      };

      const bindDirectButton = () => {
        const button = document.getElementById("map-bounty-open");
        if (!button || button.dataset.bountyBound === "1") return;
        button.dataset.bountyBound = "1";
        const handleOpen = (event, source) => {
          event.preventDefault();
          openFromTrigger(source);
        };
        button.addEventListener("click", (event) => handleOpen(event, "map-bounty-direct"));
        button.addEventListener("pointerdown", (event) => handleOpen(event, "map-bounty-pointer"));
      };

      bindDirectButton();
      window.Empire.openBountyModalShortcut = () => {
        openFromTrigger("city-events-card-shortcut");
      };

      if (root.dataset.triggerBound !== "1") {
        root.dataset.triggerBound = "1";
        document.addEventListener("click", (event) => {
          const trigger = event.target instanceof Element ? event.target.closest("#map-bounty-open") : null;
          if (!trigger) return;
          event.preventDefault();
          openFromTrigger("map-bounty-delegated");
        }, true);
        document.addEventListener("pointerdown", (event) => {
          const trigger = event.target instanceof Element ? event.target.closest("#map-bounty-open") : null;
          if (!trigger) return;
          event.preventDefault();
          openFromTrigger("map-bounty-delegated-pointer");
        }, true);
        document.addEventListener("empire:open-bounty-modal", () => {
          openFromTrigger("city-events-card-custom-event");
        });
      }

      if (backdrop) backdrop.addEventListener("click", closeModal);
      if (closeBtn) closeBtn.addEventListener("click", closeModal);
      cancelBtn.addEventListener("click", closeModal);

      targetSelect.addEventListener("change", () => {
        const players = collectBountyEligiblePlayers();
        renderDistrictOptions(targetSelect.value);
        syncPreview(players);
      });
      districtSelect.addEventListener("change", () => {
        syncPreview(collectBountyEligiblePlayers());
      });

      cashRange.addEventListener("input", () => {
        cashInput.value = String(Math.max(0, Math.floor(Number(cashRange.value || 0))));
        syncPreview(collectBountyEligiblePlayers());
      });
      cashInput.addEventListener("input", () => {
        const nextValue = clampInputValue(cashInput, Number(cashInput.max || 0));
        cashRange.value = String(nextValue);
        syncPreview(collectBountyEligiblePlayers());
      });
      drugsInput.addEventListener("input", () => {
        clampInputValue(drugsInput, Number(drugsInput.max || 0));
        syncPreview(collectBountyEligiblePlayers());
      });
      materialsInput.addEventListener("input", () => {
        clampInputValue(materialsInput, Number(materialsInput.max || 0));
        syncPreview(collectBountyEligiblePlayers());
      });
      drugTypeSelect.addEventListener("change", () => {
        syncRewardInputs();
        syncPreview(collectBountyEligiblePlayers());
      });
      materialTypeSelect.addEventListener("change", () => {
        syncRewardInputs();
        syncPreview(collectBountyEligiblePlayers());
      });
      anonymousInput.addEventListener("change", () => {
        syncPreview(collectBountyEligiblePlayers());
      });
      objectiveInputs.forEach((input) => {
        input.addEventListener("change", () => {
          syncDistrictFieldState();
          syncPreview(collectBountyEligiblePlayers());
        });
      });
      durationInputs.forEach((input) => {
        input.addEventListener("change", () => {
          syncPreview(collectBountyEligiblePlayers());
        });
      });
      submitBtn.addEventListener("click", async () => {
        const eligiblePlayers = collectBountyEligiblePlayers();
        const targetNameValue = String(targetSelect.value || "").trim();
        if (!targetNameValue) {
          pushEvent("Vyber cílového hráče pro bounty.");
          return;
        }
        const selectedTarget = eligiblePlayers.find((player) => String(player?.name || "").trim() === targetNameValue);
        if (!selectedTarget) {
          pushEvent("Na členy vlastní aliance nelze bounty vypsat.");
          return;
        }

        const selectedDrug = storageDrugTypes.find((item) => item.key === String(drugTypeSelect.value || "").trim());
        const selectedMaterial = factorySupplyTypes.find((item) => item.key === String(materialTypeSelect.value || "").trim());
        const rewards = [
          {
            key: "cash_bundle",
            label: "Cash",
            amount: Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)))
          },
          selectedDrug ? {
            key: selectedDrug.key,
            label: selectedDrug.name,
            amount: Math.max(0, Math.floor(Number(drugsInput.value || 0)))
          } : null,
          selectedMaterial ? {
            key: selectedMaterial.key,
            label: selectedMaterial.name,
            amount: Math.max(0, Math.floor(Number(materialsInput.value || 0)))
          } : null
        ].filter((entry) => entry && entry.amount > 0);
        if (!rewards.length) {
          pushEvent("Bounty musí obsahovat alespoň jednu odměnu.");
          return;
        }

        for (let i = 0; i < rewards.length; i += 1) {
          const spendResult = spendBountyResource(rewards[i].key, rewards[i].amount);
          if (!spendResult?.ok) {
            for (let rollbackIndex = 0; rollbackIndex < i; rollbackIndex += 1) {
              restoreBountyResource(rewards[rollbackIndex].key, rewards[rollbackIndex].amount);
            }
            pushEvent(`Nedostatek zdroje pro bounty: ${rewards[i].label}.`);
            syncRewardInputs();
            syncPreview(eligiblePlayers);
            return;
          }
        }

        const objectiveType = getSelectedObjectiveType();
        const districtValue = objectiveType === "occupy-sector"
          ? String(districtSelect.value || "").trim()
          : "";

        try {
          await createPersistedBounty({
            targetUsername: selectedTarget.name,
            targetDistrictId: districtValue || null,
            rewards,
            objectiveType,
            isAnonymous: Boolean(anonymousInput.checked),
            durationHours: getSelectedDurationHours()
          });
          pushEvent(
            districtValue
              ? `Bounty vypsána na ${selectedTarget.name} za #${districtValue}.`
              : `Bounty vypsána na ${selectedTarget.name}.`
          );
          renderBountyModalState();
        } catch (error) {
          rewards.forEach((reward) => {
            restoreBountyResource(reward.key, reward.amount);
          });
          const errorCode = String(error?.message || error?.error || "").trim();
          if (errorCode === "allied_target") {
            pushEvent("Na členy vlastní aliance nelze bounty vypsat.");
          } else if (errorCode === "invalid_target_district") {
            pushEvent("Vybraný district už cíli nepatří.");
          } else if (errorCode === "missing_target") {
            pushEvent("Cílový hráč už není dostupný.");
          } else {
            pushEvent("Bounty se nepodařilo uložit.");
          }
          syncRewardInputs();
          syncPreview(eligiblePlayers);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !root.classList.contains("hidden")) {
          closeModal();
        }
      });
      initialized = true;
    }

    try {
      renderBountyModalState();
    } catch {}

    void loadPersistedBounties().then((entries) => {
      syncBountyDistrictMarkers(entries);
    }).catch(() => {
      syncBountyDistrictMarkers([]);
    });
  }

  function ensureBountyModalShell() {
    return ensureBountyModalShellV2();
  }

  function collectBountyEligiblePlayersV2() {
    const ownOwnerNames = new Set(getPlayerOwnerNameSet());
    const ownOwnerKey = resolveCurrentPlayerOwnerKey();
    if (ownOwnerKey) ownOwnerNames.add(ownOwnerKey);

    const alliedOwnerNames = new Set(getActiveAllianceOwnerNames());
    const localAllianceState = !window.Empire.token ? getLocalAllianceState() : null;
    const activeAlliance = localAllianceState?.activeAlliance || null;
    (Array.isArray(activeAlliance?.members) ? activeAlliance.members : [])
      .map((member) => normalizeOwnerName(member?.username))
      .filter(Boolean)
      .forEach((key) => alliedOwnerNames.add(key));

    const ownAllianceName = extractAllianceDisplayName(
      activeAlliance?.name
      || cachedProfile?.alliance
      || window.Empire.player?.alliance
      || "Bez aliance"
    );
    const shouldFilterAllianceByName = ownAllianceName && ownAllianceName !== "Žádná" && ownAllianceName !== "Bez aliance";

    const byName = new Map();
    (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).forEach((district) => {
      const ownerName = String(
        district?.ownerNick
        || district?.owner_username
        || district?.ownerUsername
        || district?.owner
        || ""
      ).trim();
      const ownerKey = normalizeOwnerName(ownerName);
      if (!ownerKey || ownOwnerNames.has(ownerKey) || alliedOwnerNames.has(ownerKey)) return;

      const allianceName = String(
        district?.ownerAllianceName
        || district?.owner_alliance_name
        || ""
      ).trim() || "Bez aliance";
      if (shouldFilterAllianceByName && extractAllianceDisplayName(allianceName) === ownAllianceName) return;

      const current = byName.get(ownerKey) || {
        name: ownerName,
        allianceName,
        districtCount: 0,
        avatar: String(district?.ownerAvatar || "").trim()
      };
      current.districtCount += 1;
      if (!current.avatar) current.avatar = String(district?.ownerAvatar || "").trim();
      if (!current.allianceName || current.allianceName === "Bez aliance") {
        current.allianceName = allianceName;
      }
      byName.set(ownerKey, current);
    });

    let result = Array.from(byName.values())
      .filter((entry) => Math.max(0, Math.floor(Number(entry?.districtCount || 0))) > 0)
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "cs"));

    if (!result.length && isBlackoutLikeScenario()) {
      result = [{
        name: "Mariah",
        allianceName: "Bez aliance",
        districtCount: 1,
        avatar: ""
      }];
    }

    return result;
  }

  function getBountyModalResourceAvailabilityV2() {
    const economy = getLiveBountyEconomySnapshot();
    const marketBalances = getGuestBlackoutLiveBalances() || {};
    const domEconomy = getEconomySnapshotFromDom();
    const factoryState = readFactoryPlayerSuppliesState();
    const drugInventory = economy?.drugInventory && typeof economy.drugInventory === "object"
      ? economy.drugInventory
      : {};
    const economyMoney = resolveMoneyBreakdown(economy || {});
    const marketMoney = resolveMoneyBreakdown(marketBalances || {});
    const domMoney = resolveMoneyBreakdown(domEconomy || {});

    const availability = {
      cash: Math.max(
        0,
        Math.floor(
          isGuestBlackoutScenarioActive()
            ? Math.max(economyMoney.cleanMoney || 0, marketMoney.cleanMoney || 0, domMoney.cleanMoney || 0)
            : Math.max(economyMoney.cleanMoney || 0, domMoney.cleanMoney || 0)
        )
      )
    };

    storageDrugTypes.forEach((item) => {
      availability[item.key] = Math.max(
        0,
        Math.floor(
          Number(drugInventory[item.key] || 0)
          || Number(economy?.[item.key] || 0)
          || Number(marketBalances[item.key] || 0)
        )
      );
    });

    factorySupplyTypes.forEach((item) => {
      availability[item.key] = Math.max(
        0,
        Math.floor(
          Number(factoryState?.[item.key] || 0)
          || Number(economy?.[item.key] || 0)
          || Number(marketBalances[item.key] || 0)
        )
      );
    });

    return availability;
  }

  function formatBountyRewardSummaryV2(rewards) {
    return (Array.isArray(rewards) ? rewards : [])
      .map((reward) => `${Math.max(0, Math.floor(Number(reward?.amount || 0)))}x ${String(reward?.label || "").trim()}`)
      .filter(Boolean)
      .join(", ");
  }

  function ensureBountyModalShellV2() {
    let root = document.getElementById("bounty-modal");
    if (root && !root.querySelector(".bounty-board__content")) {
      root.remove();
      root = null;
    }

    if (!root) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div id="bounty-modal" class="modal hidden bounty-board-modal">
          <div id="bounty-modal-backdrop" class="modal__backdrop"></div>
          <div class="modal__content bounty-board__content">
            <header class="bounty-board__header">
              <div class="bounty-board__header-copy">
                <div class="bounty-board__eyebrow">Bounty board</div>
                <h3>VYPSAT ODMĚNU</h3>
                <p>Označ hráče a vystav ho celému městu.</p>
              </div>
              <button id="bounty-modal-close" class="modal__close" type="button" aria-label="Zavřít">×</button>
            </header>
            <div class="bounty-board__layout">
              <section class="bounty-board__column bounty-board__column--left">
                <div class="bounty-board__panel">
                  <div class="bounty-board__panel-head">
                    <span class="bounty-board__kicker">Target</span>
                    <strong>Koho jdeš označit</strong>
                  </div>
                  <label class="bounty-board__field">
                    <span>Hráč</span>
                    <select id="bounty-modal-target" class="bounty-board__input"></select>
                  </label>
                  <div class="bounty-board__target-card">
                    <div class="bounty-board__avatar-wrap">
                      <img id="bounty-target-avatar" class="bounty-board__avatar is-empty" alt="Target avatar" />
                      <span id="bounty-target-avatar-fallback" class="bounty-board__avatar-fallback">??</span>
                    </div>
                    <div class="bounty-board__target-copy">
                      <div id="bounty-target-name" class="bounty-board__target-name">Nevybrán cíl</div>
                      <div id="bounty-target-alliance" class="bounty-board__target-meta">Aliance: Bez aliance</div>
                      <div id="bounty-target-districts" class="bounty-board__target-meta">Districtů: 0</div>
                      <div id="bounty-target-activity" class="bounty-board__target-meta">Poslední aktivita: -</div>
                    </div>
                    <div id="bounty-target-threat" class="bounty-board__threat" data-tone="low">Low threat</div>
                  </div>
                </div>

                <div class="bounty-board__panel">
                  <div class="bounty-board__panel-head">
                    <span class="bounty-board__kicker">Nastavení odměny</span>
                    <strong>Cash, drogy a materiály</strong>
                  </div>
                  <div class="bounty-board__resource-list">
                    <div class="bounty-board__resource-row">
                      <div class="bounty-board__resource-head">
                        <span class="bounty-board__resource-icon">💊</span>
                        <div>
                          <div class="bounty-board__resource-name">Drogy</div>
                          <div id="bounty-drugs-available" class="bounty-board__resource-have">Máš: 0 ks</div>
                        </div>
                      </div>
                      <div class="bounty-board__resource-controls">
                        <select id="bounty-drug-type" class="bounty-board__input"></select>
                        <input id="bounty-drugs-input" class="bounty-board__input bounty-board__input--number" type="number" min="0" max="0" step="1" value="0" />
                      </div>
                    </div>

                    <div class="bounty-board__resource-row">
                      <div class="bounty-board__resource-head">
                        <span class="bounty-board__resource-icon">🧱</span>
                        <div>
                          <div class="bounty-board__resource-name">Materiály</div>
                          <div id="bounty-materials-available" class="bounty-board__resource-have">Máš: 0 ks</div>
                        </div>
                      </div>
                      <div class="bounty-board__resource-controls">
                        <select id="bounty-material-type" class="bounty-board__input"></select>
                        <input id="bounty-materials-input" class="bounty-board__input bounty-board__input--number" type="number" min="0" max="0" step="1" value="0" />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bounty-board__panel">
                  <div class="bounty-board__panel-head">
                    <span class="bounty-board__kicker">Typ bounty</span>
                    <strong>Co musí město splnit</strong>
                  </div>
                  <div class="bounty-board__choice-grid">
                    <label class="bounty-board__choice">
                      <input type="radio" name="bounty-objective" value="occupy-sector" checked />
                      <span>Za obsazení districtu</span>
                    </label>
                    <label class="bounty-board__choice">
                      <input type="radio" name="bounty-objective" value="successful-attack" />
                      <span>Za úspěšný útok</span>
                    </label>
                    <label class="bounty-board__choice">
                      <input type="radio" name="bounty-objective" value="destroy-units" />
                      <span>Za zničení jednotek</span>
                    </label>
                  </div>
                  <label id="bounty-district-field" class="bounty-board__field">
                    <span>Konkrétní district</span>
                    <select id="bounty-modal-district" class="bounty-board__input"></select>
                  </label>
                </div>

                <div class="bounty-board__settings">
                  <div class="bounty-board__panel bounty-board__panel--compact">
                    <div class="bounty-board__panel-head">
                      <span class="bounty-board__kicker">Trvání</span>
                    </div>
                    <div class="bounty-board__segment-grid">
                      <label class="bounty-board__segment"><input type="radio" name="bounty-duration" value="6" /><span>6h</span></label>
                      <label class="bounty-board__segment"><input type="radio" name="bounty-duration" value="12" checked /><span>12h</span></label>
                      <label class="bounty-board__segment"><input type="radio" name="bounty-duration" value="24" /><span>24h</span></label>
                    </div>
                  </div>
                  <div class="bounty-board__panel bounty-board__panel--compact">
                    <div class="bounty-board__panel-head">
                      <span class="bounty-board__kicker">Anonymita</span>
                    </div>
                    <label class="bounty-board__toggle">
                      <input id="bounty-anonymous-input" type="checkbox" checked />
                      <span>Anonymní vypsání odměny</span>
                      <small>OFF = target vidí, kdo ho označil.</small>
                    </label>
                  </div>
                </div>
              </section>

              <section class="bounty-board__column bounty-board__column--right">
                <div class="bounty-board__panel bounty-board__preview">
                  <div id="bounty-preview-target" class="bounty-board__preview-target">Nevybrán cíl</div>
                  <div id="bounty-preview-value" class="bounty-board__preview-value">$0</div>
                  <div class="bounty-board__preview-grid">
                    <div><span>Typ</span><strong id="bounty-preview-type">Za obsazení districtu</strong></div>
                    <div><span>Trvání</span><strong id="bounty-preview-duration">12h</strong></div>
                    <div><span>Anonymita</span><strong id="bounty-preview-anonymous">Anonymní</strong></div>
                  </div>
                </div>

                <div class="bounty-board__panel">
                  <div id="bounty-hunt-state" class="bounty-board__hunt-state" data-mode="charging">Hunt mode se plní</div>
                  <div class="bounty-board__progress"><div id="bounty-hunt-progress-fill" class="bounty-board__progress-fill"></div></div>
                  <div id="bounty-hunt-progress-label" class="bounty-board__progress-label">Do HUNT MODE zbývá $10,000.</div>
                </div>

                <div class="bounty-board__panel bounty-board__warning">
                  <div>Ta akce upozorní celé město.</div>
                  <div>Po potvrzení nelze bounty zrušit.</div>
                  <div>Target může reagovat protiakcí.</div>
                </div>

                <div class="bounty-board__panel bounty-board__table-panel">
                  <div class="bounty-board__panel-head">
                    <span class="bounty-board__kicker">Aktivní odměny</span>
                    <strong>Hráči a odměny</strong>
                  </div>
                  <div class="bounty-board__table-wrap">
                    <table class="bounty-board__table">
                      <thead>
                        <tr><th>Hráč</th><th>District</th><th>Odměna</th><th>Režim</th><th>Do</th></tr>
                      </thead>
                      <tbody id="bounty-board-body"></tbody>
                    </table>
                    <div id="bounty-board-empty" class="bounty-board__empty">Zatím tu není žádná aktivní bounty.</div>
                  </div>
                </div>

                <div class="bounty-board__actions">
                  <button id="bounty-modal-cancel" class="btn bounty-board__cancel" type="button">Zrušit</button>
                  <button id="bounty-modal-submit" class="btn bounty-board__submit" type="button">VYPSAT ODMĚNU</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      `;
      root = wrapper.firstElementChild;
      document.body.appendChild(root);
    }

    return {
      root,
      backdrop: document.getElementById("bounty-modal-backdrop"),
      closeBtn: document.getElementById("bounty-modal-close"),
      cancelBtn: document.getElementById("bounty-modal-cancel"),
      targetSelect: document.getElementById("bounty-modal-target"),
      districtSelect: document.getElementById("bounty-modal-district"),
      submitBtn: document.getElementById("bounty-modal-submit"),
      targetName: document.getElementById("bounty-target-name"),
      targetAlliance: document.getElementById("bounty-target-alliance"),
      targetDistricts: document.getElementById("bounty-target-districts"),
      targetActivity: document.getElementById("bounty-target-activity"),
      targetThreat: document.getElementById("bounty-target-threat"),
      targetAvatar: document.getElementById("bounty-target-avatar"),
      targetAvatarFallback: document.getElementById("bounty-target-avatar-fallback"),
      cashRange: document.getElementById("bounty-cash-range"),
      cashInput: document.getElementById("bounty-cash-input"),
      cashAvailable: document.getElementById("bounty-cash-available"),
      drugTypeSelect: document.getElementById("bounty-drug-type"),
      drugsInput: document.getElementById("bounty-drugs-input"),
      drugsAvailable: document.getElementById("bounty-drugs-available"),
      materialTypeSelect: document.getElementById("bounty-material-type"),
      materialsInput: document.getElementById("bounty-materials-input"),
      materialsAvailable: document.getElementById("bounty-materials-available"),
      anonymousInput: document.getElementById("bounty-anonymous-input"),
      previewTarget: document.getElementById("bounty-preview-target"),
      previewValue: document.getElementById("bounty-preview-value"),
      previewType: document.getElementById("bounty-preview-type"),
      previewDuration: document.getElementById("bounty-preview-duration"),
      previewAnonymous: document.getElementById("bounty-preview-anonymous"),
      huntModeState: document.getElementById("bounty-hunt-state"),
      huntModeProgressFill: document.getElementById("bounty-hunt-progress-fill"),
      huntModeProgressLabel: document.getElementById("bounty-hunt-progress-label"),
      districtField: document.getElementById("bounty-district-field"),
      boardBody: document.getElementById("bounty-board-body"),
      boardEmpty: document.getElementById("bounty-board-empty")
    };
  }

  function initBountyModalV2() {
    const shell = ensureBountyModalShellV2();
    const {
      root,
      backdrop,
      closeBtn,
      cancelBtn,
      targetSelect,
      districtSelect,
      submitBtn,
      targetName,
      targetAlliance,
      targetDistricts,
      targetActivity,
      targetThreat,
      targetAvatar,
      targetAvatarFallback,
      cashRange,
      cashInput,
      cashAvailable,
      drugTypeSelect,
      drugsInput,
      drugsAvailable,
      materialTypeSelect,
      materialsInput,
      materialsAvailable,
      anonymousInput,
      previewTarget,
      previewValue,
      previewType,
      previewDuration,
      previewAnonymous,
      huntModeState,
      huntModeProgressFill,
      huntModeProgressLabel,
      districtField,
      boardBody,
      boardEmpty
    } = shell;
    if (!root || !targetSelect || !districtSelect || !submitBtn || !boardBody || !boardEmpty) return;

    const objectiveInputs = Array.from(root.querySelectorAll('input[name="bounty-objective"]'));
    const durationInputs = Array.from(root.querySelectorAll('input[name="bounty-duration"]'));
    if (!objectiveInputs.length || !durationInputs.length) return;

    const modalState = root.__bountyV2State || {
      players: [],
      bounties: [],
      openLock: 0
    };
    root.__bountyV2State = modalState;

    const syncBountyModalLayout = () => {
      const content = root.querySelector(".bounty-board__content");
      const layout = root.querySelector(".bounty-board__layout");
      if (!(content instanceof HTMLElement) || !(layout instanceof HTMLElement)) return;

      const viewportWidth = Math.max(
        Number(window.innerWidth || 0),
        Number(document.documentElement?.clientWidth || 0)
      );
      const viewportHeight = Math.max(
        Number(window.innerHeight || 0),
        Number(document.documentElement?.clientHeight || 0)
      );

      if (viewportWidth <= 640) {
        root.style.paddingTop = "max(12px, env(safe-area-inset-top))";
        root.style.paddingRight = "5px";
        root.style.paddingLeft = "5px";
        root.style.paddingBottom = "12px";
        content.style.width = `calc(${Math.max(320, viewportWidth)}px - 10px)`;
        content.style.maxWidth = `calc(${Math.max(320, viewportWidth)}px - 10px)`;
        content.style.maxHeight = `${Math.max(320, viewportHeight - 24)}px`;
        layout.style.gridTemplateColumns = "1fr";
        return;
      }

      root.style.paddingRight = "";
      root.style.paddingLeft = "";

      if (viewportWidth <= 980) {
        root.style.paddingTop = "96px";
        root.style.paddingBottom = "18px";
        content.style.width = `${Math.min(920, Math.max(640, viewportWidth - 24))}px`;
        content.style.maxWidth = `${Math.min(920, Math.max(640, viewportWidth - 24))}px`;
        content.style.maxHeight = `${Math.max(420, viewportHeight - 124)}px`;
        layout.style.gridTemplateColumns = "minmax(0, 1fr) minmax(380px, 0.86fr)";
        return;
      }

      root.style.paddingTop = "16px";
      root.style.paddingBottom = "8px";
      content.style.width = `${Math.min(1060, Math.max(780, viewportWidth - 48))}px`;
      content.style.maxWidth = `${Math.min(1060, Math.max(780, viewportWidth - 48))}px`;
      content.style.maxHeight = `${Math.max(520, viewportHeight - 24)}px`;
      layout.style.gridTemplateColumns = "minmax(0, 1fr) minmax(290px, 0.76fr)";
    };

    const getSelectedObjectiveType = () => {
      const selected = objectiveInputs.find((input) => input.checked);
      return String(selected?.value || "occupy-sector").trim() || "occupy-sector";
    };
    const getSelectedDurationHours = () => {
      const selected = durationInputs.find((input) => input.checked);
      return Math.max(1, Math.min(24, Math.floor(Number(selected?.value || 12))));
    };
    const clampIntInput = (input, maxValue) => {
      const safeMax = Math.max(0, Math.floor(Number(maxValue || 0)));
      const nextValue = Math.min(safeMax, Math.max(0, Math.floor(Number(input?.value || 0))));
      input.max = String(safeMax);
      input.value = String(nextValue);
      return nextValue;
    };
    const selectedPlayer = () => modalState.players.find((player) => String(player?.name || "").trim() === String(targetSelect.value || "").trim()) || null;
    const selectedDrug = () => storageDrugTypes.find((item) => item.key === String(drugTypeSelect.value || "").trim()) || null;
    const selectedMaterial = () => factorySupplyTypes.find((item) => item.key === String(materialTypeSelect.value || "").trim()) || null;

    const renderTargetOptions = () => {
      const previous = String(targetSelect.value || "").trim();
      targetSelect.innerHTML = modalState.players.length
        ? [
          '<option value="">Vyber hráče</option>',
          ...modalState.players.map((player) => `<option value="${escapeHtml(String(player?.name || "").trim())}">${escapeHtml(`${String(player?.name || "").trim()} • ${Math.max(0, Math.floor(Number(player?.districtCount || 0)))} districtů`)}</option>`)
        ].join("")
        : '<option value="">Žádný dostupný cíl</option>';
      if (modalState.players.some((player) => String(player?.name || "").trim() === previous)) {
        targetSelect.value = previous;
      } else if (modalState.players[0]?.name) {
        targetSelect.value = String(modalState.players[0].name).trim();
      }
    };

    const renderDistrictOptions = () => {
      const target = selectedPlayer();
      const previous = String(districtSelect.value || "").trim();
      const districts = (Array.isArray(window.Empire.districts) ? window.Empire.districts : [])
        .filter((district) => normalizeOwnerName(
          district?.ownerNick
          || district?.owner_username
          || district?.ownerUsername
          || district?.owner
        ) === normalizeOwnerName(target?.name))
        .sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || ""), "cs", { numeric: true }));
      districtSelect.innerHTML = [
        '<option value="">Jakýkoli district</option>',
        ...districts.map((district) => `<option value="${escapeHtml(String(district?.id || "").trim())}">#${escapeHtml(String(district?.id || "").trim())} • ${escapeHtml(String(district?.name || "Distrikt").trim())}</option>`)
      ].join("");
      if (previous && districts.some((district) => String(district?.id || "").trim() === previous)) {
        districtSelect.value = previous;
      }
    };

    const renderResourceOptions = () => {
      const availability = getBountyModalResourceAvailabilityV2();
      const currentDrugKey = String(drugTypeSelect.value || "").trim();
      const currentMaterialKey = String(materialTypeSelect.value || "").trim();
      drugTypeSelect.innerHTML = storageDrugTypes.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)} • ${Math.max(0, Math.floor(Number(availability[item.key] || 0)))} ks</option>`).join("");
      materialTypeSelect.innerHTML = factorySupplyTypes.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)} • ${Math.max(0, Math.floor(Number(availability[item.key] || 0)))} ks</option>`).join("");
      drugTypeSelect.value = storageDrugTypes.some((item) => item.key === currentDrugKey) ? currentDrugKey : (storageDrugTypes[0]?.key || "");
      materialTypeSelect.value = factorySupplyTypes.some((item) => item.key === currentMaterialKey) ? currentMaterialKey : (factorySupplyTypes[0]?.key || "");
    };

    const syncInputs = () => {
      const availability = getBountyModalResourceAvailabilityV2();
      const cashMax = Math.max(0, Math.floor(Number(availability.cash || 0)));
      cashRange.max = String(cashMax);
      cashInput.max = String(cashMax);
      const cashValue = Math.min(cashMax, Math.max(Math.floor(Number(cashRange.value || 0)), Math.floor(Number(cashInput.value || 0))));
      cashRange.value = String(cashValue);
      cashInput.value = String(cashValue);
      clampIntInput(drugsInput, Number(availability[String(drugTypeSelect.value || "").trim()] || 0));
      clampIntInput(materialsInput, Number(availability[String(materialTypeSelect.value || "").trim()] || 0));
      cashAvailable.textContent = `Máš: ${cashMax.toLocaleString("cs-CZ")}$`;
      drugsAvailable.textContent = `Máš: ${Math.max(0, Math.floor(Number(availability[String(drugTypeSelect.value || "").trim()] || 0))).toLocaleString("cs-CZ")} ks`;
      materialsAvailable.textContent = `Máš: ${Math.max(0, Math.floor(Number(availability[String(materialTypeSelect.value || "").trim()] || 0))).toLocaleString("cs-CZ")} ks`;
    };

    const syncTargetCard = () => {
      const target = selectedPlayer();
      if (!target) {
        targetName.textContent = "Nevybrán cíl";
        targetAlliance.textContent = "Aliance: Bez aliance";
        targetDistricts.textContent = "Districtů: 0";
        targetActivity.textContent = "Poslední aktivita: -";
        targetThreat.textContent = "Low threat";
        targetThreat.dataset.tone = "low";
        targetAvatar.src = "";
        targetAvatar.classList.add("is-empty");
        targetAvatarFallback.textContent = "??";
        return null;
      }
      const threat = resolveBountyThreatLevel(Math.max(0, Math.floor(Number(target?.districtCount || 0))));
      targetName.textContent = String(target?.name || "Hráč");
      targetAlliance.textContent = `Aliance: ${String(target?.allianceName || "").trim() || "Bez aliance"}`;
      targetDistricts.textContent = `Districtů: ${Math.max(0, Math.floor(Number(target?.districtCount || 0)))}`;
      targetActivity.textContent = `Poslední aktivita: ${resolveBountyLastActivityLabel(target)}`;
      targetThreat.textContent = threat.label;
      targetThreat.dataset.tone = threat.tone;
      targetAvatarFallback.textContent = String(target?.name || "??").trim().slice(0, 2).toUpperCase() || "??";
      if (String(target?.avatar || "").trim()) {
        targetAvatar.src = String(target.avatar).trim();
        targetAvatar.classList.remove("is-empty");
      } else {
        targetAvatar.src = "";
        targetAvatar.classList.add("is-empty");
      }
      return target;
    };

    const collectRewards = () => {
      const rewards = [];
      const cashAmount = Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)));
      const drugAmount = Math.max(0, Math.floor(Number(drugsInput.value || 0)));
      const materialAmount = Math.max(0, Math.floor(Number(materialsInput.value || 0)));
      if (cashAmount > 0) rewards.push({ key: "cash_bundle", label: "Cash", amount: cashAmount });
      if (selectedDrug() && drugAmount > 0) rewards.push({ key: selectedDrug().key, label: selectedDrug().name, amount: drugAmount });
      if (selectedMaterial() && materialAmount > 0) rewards.push({ key: selectedMaterial().key, label: selectedMaterial().name, amount: materialAmount });
      return rewards;
    };

    const syncPreview = () => {
      const target = syncTargetCard();
      const rewards = collectRewards();
      const totalValue = rewards.reduce((sum, reward) => sum + (reward.key === "cash_bundle" ? reward.amount : reward.amount * getBountyUnitValue(reward.key)), 0);
      const progressPct = Math.max(0, Math.min(100, Math.round((totalValue / BOUNTY_HUNT_MODE_THRESHOLD) * 100)));
      previewTarget.textContent = target?.name || "Nevybrán cíl";
      previewValue.textContent = formatBountyMoneyValue(totalValue);
      previewType.textContent = formatBountyObjectiveLabel(getSelectedObjectiveType());
      previewDuration.textContent = `${getSelectedDurationHours()}h`;
      previewAnonymous.textContent = anonymousInput.checked ? "Anonymní" : "Veřejné";
      if (totalValue >= BOUNTY_HUNT_MODE_THRESHOLD) {
        huntModeState.textContent = "HUNT MODE AKTIVNÍ";
        huntModeState.dataset.mode = "active";
        huntModeProgressFill.style.width = "100%";
        huntModeProgressLabel.textContent = "Celé město dostalo důvod jít po cíli.";
      } else {
        huntModeState.textContent = "Hunt mode se plní";
        huntModeState.dataset.mode = "charging";
        huntModeProgressFill.style.width = `${progressPct}%`;
        huntModeProgressLabel.textContent = `Do HUNT MODE zbývá ${formatBountyMoneyValue(BOUNTY_HUNT_MODE_THRESHOLD - totalValue)}.`;
      }
      districtField.hidden = getSelectedObjectiveType() !== "occupy-sector";
      districtSelect.disabled = getSelectedObjectiveType() !== "occupy-sector";
      submitBtn.disabled = !target || rewards.length === 0;
      return { target, rewards };
    };

    const renderBoard = () => {
      const activeEntries = (Array.isArray(modalState.bounties) ? modalState.bounties : [])
        .filter((entry) => String(entry?.status || "active").trim() === "active")
        .slice(0, 8);
      boardBody.innerHTML = activeEntries.map((entry) => `
        <tr>
          <td>${escapeHtml(String(entry?.targetName || "-").trim() || "-")}</td>
          <td>${String(entry?.districtId || "").trim() ? `#${escapeHtml(String(entry.districtId).trim())}` : "Jakýkoli"}</td>
          <td>${escapeHtml(formatBountyRewardSummaryV2(entry?.rewards) || "-")}</td>
          <td>${entry?.isAnonymous === false ? "Veřejná" : "Anonymní"}</td>
          <td>${escapeHtml(formatBountyExpiryLabel(entry?.expiresAt))}</td>
        </tr>
      `).join("");
      boardEmpty.hidden = activeEntries.length > 0;
    };

    const refreshView = () => {
      modalState.players = collectBountyEligiblePlayersV2();
      renderTargetOptions();
      renderDistrictOptions();
      renderResourceOptions();
      syncInputs();
      syncPreview();
      renderBoard();
    };

    const reloadBoard = async () => {
      try {
        modalState.bounties = await loadPersistedBounties();
      } catch {
        modalState.bounties = readBountyEntries();
      }
      renderBoard();
    };

    const closeModal = () => {
      root.classList.add("hidden");
      setMobileTopbarCoveredByPrimaryModal(false);
    };
    const openModal = async () => {
      root.classList.remove("hidden");
      setMobileTopbarCoveredByPrimaryModal(true);
      try {
        refreshView();
        await reloadBoard();
        syncBountyModalLayout();
        requestAnimationFrame(() => syncBountyModalLayout());
      } catch (error) {
        console.error("Bounty open failed", error);
        pushEvent("Bounty kartu se nepodařilo načíst.");
      }
    };

    if (root.dataset.bountyV2Bound !== "1") {
      root.dataset.bountyV2Bound = "1";
      const openFromTrigger = (event) => {
        if (event?.preventDefault) event.preventDefault();
        const now = Date.now();
        if (now - modalState.openLock < 220) return;
        modalState.openLock = now;
        void openModal().catch(() => pushEvent("Bounty kartu se nepodařilo načíst."));
      };

      const trigger = document.getElementById("map-bounty-open");
      if (trigger && trigger.dataset.bountyBoundV2 !== "1") {
        trigger.dataset.bountyBoundV2 = "1";
        trigger.addEventListener("click", openFromTrigger);
        trigger.addEventListener("pointerdown", openFromTrigger);
      }

      window.Empire.openBountyModalShortcut = () => openFromTrigger();
      document.addEventListener("empire:open-bounty-modal", openFromTrigger);
      backdrop.addEventListener("click", closeModal);
      closeBtn.addEventListener("click", closeModal);
      cancelBtn.addEventListener("click", closeModal);
      targetSelect.addEventListener("change", () => { renderDistrictOptions(); syncPreview(); });
      districtSelect.addEventListener("change", syncPreview);
      cashRange.addEventListener("input", () => { cashInput.value = String(Math.max(0, Math.floor(Number(cashRange.value || 0)))); syncPreview(); });
      cashInput.addEventListener("input", () => { cashRange.value = String(clampIntInput(cashInput, Number(cashInput.max || 0))); syncPreview(); });
      drugsInput.addEventListener("input", () => { clampIntInput(drugsInput, Number(drugsInput.max || 0)); syncPreview(); });
      materialsInput.addEventListener("input", () => { clampIntInput(materialsInput, Number(materialsInput.max || 0)); syncPreview(); });
      drugTypeSelect.addEventListener("change", () => { syncInputs(); syncPreview(); });
      materialTypeSelect.addEventListener("change", () => { syncInputs(); syncPreview(); });
      anonymousInput.addEventListener("change", syncPreview);
      objectiveInputs.forEach((input) => input.addEventListener("change", syncPreview));
      durationInputs.forEach((input) => input.addEventListener("change", syncPreview));
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !root.classList.contains("hidden")) closeModal();
      });
      window.addEventListener("resize", () => {
        if (!root.classList.contains("hidden")) syncBountyModalLayout();
      });

      submitBtn.addEventListener("click", async () => {
        const preview = syncPreview();
        if (!preview.target) {
          pushEvent("Vyber cílového hráče pro bounty.");
          return;
        }
        if (!preview.rewards.length) {
          pushEvent("Bounty musí obsahovat alespoň jednu odměnu.");
          return;
        }

        const spentRewards = [];
        for (const reward of preview.rewards) {
          const spendResult = spendBountyResource(reward.key, reward.amount);
          if (!spendResult?.ok) {
            spentRewards.forEach((entry) => restoreBountyResource(entry.key, entry.amount));
            pushEvent(`Nedostatek zdroje pro bounty: ${reward.label}.`);
            syncInputs();
            syncPreview();
            return;
          }
          spentRewards.push(reward);
        }

        try {
          const objectiveType = getSelectedObjectiveType();
          const districtId = objectiveType === "occupy-sector" ? String(districtSelect.value || "").trim() || null : null;
          await createPersistedBounty({
            targetUsername: preview.target.name,
            targetDistrictId: districtId,
            objectiveType,
            rewards: preview.rewards,
            isAnonymous: Boolean(anonymousInput.checked),
            durationHours: getSelectedDurationHours()
          });
          pushEvent(districtId ? `Bounty vypsána na ${preview.target.name} za #${districtId}.` : `Bounty vypsána na ${preview.target.name}.`);
          await reloadBoard();
          refreshView();
        } catch (error) {
          spentRewards.forEach((reward) => restoreBountyResource(reward.key, reward.amount));
          const errorCode = String(error?.message || error?.error || "").trim();
          if (errorCode === "allied_target") pushEvent("Na členy vlastní aliance nelze bounty vypsat.");
          else if (errorCode === "invalid_target_district") pushEvent("Vybraný district už cíli nepatří.");
          else if (errorCode === "missing_target") pushEvent("Cílový hráč už není dostupný.");
          else pushEvent("Bounty se nepodařilo uložit.");
          syncInputs();
          syncPreview();
        }
      });
    }

    root.classList.add("hidden");
  }

  function initBuildingsModal() {
    const openBtn = document.getElementById("buildings-open");
    const root = document.getElementById("buildings-modal");
    const backdrop = document.getElementById("buildings-modal-backdrop");
    const closeBtn = document.getElementById("buildings-modal-close");
    const typeList = document.getElementById("buildings-type-list");
    const detail = document.getElementById("buildings-modal-detail");
    const content = root.querySelector(".buildings-modal__content");

    if (!root || !openBtn || !typeList || !detail || !content) return;

    let currentRenderedEntries = [];
    let activeDistrictType = null;
    const selectedBuildingTypeByDistrict = new Map();

    const closeModal = () => {
      root.classList.add("hidden");
      setMobileTopbarCoveredByPrimaryModal(false);
    };

    const renderTypes = (selectedType) => {
      typeList.innerHTML = buildingDistrictTypes
        .map(
          (type) => `
            <button class="buildings-modal__type-btn buildings-modal__type-btn--${type.key} ${type.key === selectedType ? "is-active" : ""}" data-building-type="${type.key}">
              ${type.label}
            </button>
          `
        )
        .join("");
    };

    const renderDetail = (typeKey) => {
      const selected = buildingDistrictTypes.find((type) => type.key === typeKey) || null;
      if (!selected) {
        currentRenderedEntries = [];
        activeDistrictType = null;
        content.classList.remove("buildings-modal__content--with-bg");
        content.style.backgroundImage = "";
        detail.innerHTML = `
        <section class="buildings-modal__detail-card">
          <div class="buildings-modal__detail-title">Vyber distrikt</div>
          <div class="buildings-modal__empty">Po výběru distriktu uvidíš dostupné typy budov.</div>
        </section>
        `;
        return;
      }

      const backgroundImage = districtTypeBackgrounds[selected.key] || "";
      const detailState = renderDistrictTypeDetail(selected.key, selectedBuildingTypeByDistrict.get(selected.key));
      currentRenderedEntries = detailState.entries;
      if (detailState.selectedBaseName) {
        selectedBuildingTypeByDistrict.set(selected.key, detailState.selectedBaseName);
      }
      activeDistrictType = selected.key;

      content.classList.toggle("buildings-modal__content--with-bg", Boolean(backgroundImage));
      content.style.backgroundImage = backgroundImage
        ? `linear-gradient(rgba(3, 7, 18, 0.54), rgba(3, 7, 18, 0.68)), url('${backgroundImage}')`
        : "";

      detail.innerHTML = `
        <section class="buildings-modal__detail-card" data-building-district-type="${selected.key}">
          <div class="buildings-modal__detail-title">${selected.label}</div>
          <div class="buildings-modal__detail-meta">${formatDistrictType(selected.key)}</div>
          ${detailState.markup}
        </section>
      `;
    };

    const renderBuildings = (selectedType = activeDistrictType) => {
      renderTypes(selectedType);
      renderDetail(selectedType);
    };

    openBtn.addEventListener("click", () => {
      activeDistrictType = null;
      selectedBuildingTypeByDistrict.clear();
      renderBuildings(null);
      setMobileTopbarCoveredByPrimaryModal(true);
      root.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("empire:buildings-modal-opened", {
        detail: {
          open: true
        }
      }));
    });
    typeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-building-type]");
      if (!(button instanceof HTMLElement)) return;
      const selectedType = button.dataset.buildingType;
      if (!selectedType) return;
      renderBuildings(selectedType);
    });
    detail.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const typeButton = target.closest("[data-building-base-name]");
      if (typeButton instanceof HTMLElement) {
        if (typeButton.hasAttribute("data-building-locked")) {
          pushEvent("Typ budovy je zamčený. V tomto stavu ho nevlastníš.");
          return;
        }
        const selectedBaseName = typeButton.dataset.buildingBaseName;
        if (!selectedBaseName) return;
        selectedBuildingTypeByDistrict.set(activeDistrictType, selectedBaseName);
        renderDetail(activeDistrictType);
        return;
      }

      const button = target.closest("[data-building-entry-index]");
      if (!(button instanceof HTMLElement)) return;
      if (button.hasAttribute("data-building-locked")) {
        pushEvent("Budova je zamčená. Tento typ distriktu v ukázkovém stavu nevlastníš.");
        return;
      }
      const entryIndex = Number(button.dataset.buildingEntryIndex);
      const entry = currentRenderedEntries[entryIndex];
      if (!entry) return;
      const pseudoDistrict = {
        id: entry.districtId,
        type: entry.districtType
      };
      const detailInput = {
        baseName: entry.baseName,
        variantName: entry.variantName || null,
        districtId: entry.districtId,
        buildingIndex: Number.isFinite(Number(entry.buildingIndex))
          ? Math.max(0, Math.floor(Number(entry.buildingIndex)))
          : null
      };
      if (window.Empire.Map?.showBuildingDetail) {
        root.classList.add("hidden");
        setMobileTopbarCoveredByPrimaryModal(false);
        window.Empire.Map.showBuildingDetail(detailInput, pseudoDistrict);
      }
    });
    if (backdrop) backdrop.addEventListener("click", closeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function resolveBuildingsForDistrictType(typeKey) {
    return districtBuildingCatalog[typeKey] || [
      "Operační základna",
      "Sklad",
      "Kontrolní bod",
      "Garáž",
      "Bezpečný dům"
    ];
  }

  function renderDistrictTypeDetail(typeKey, selectedBaseName) {
    const entries = resolveBuildingEntriesForDistrictType(typeKey);
    if (!entries.length) {
      return {
        entries: [],
        selectedBaseName: null,
        markup: '<div class="buildings-modal__empty">Pro tento typ zatím nejsou dostupné budovy.</div>'
      };
    }

    const groupedByType = new Map();
    entries.forEach((entry) => {
      const key = String(entry.baseName || "Neznámá budova");
      if (!groupedByType.has(key)) {
        groupedByType.set(key, {
          baseName: key,
          count: 0,
          unlockedCount: 0,
          unlocked: false
        });
      }
      const group = groupedByType.get(key);
      group.count += 1;
      if (entry.unlocked) group.unlockedCount += 1;
      group.unlocked = group.unlocked || Boolean(entry.unlocked);
    });

    const baseTypes = Array.from(groupedByType.values()).sort((a, b) =>
      a.baseName.localeCompare(b.baseName, "cs", { sensitivity: "base" })
    );
    const activeBaseName = baseTypes.some((item) => item.baseName === selectedBaseName && item.unlocked)
      ? selectedBaseName
      : null;
    const scopedEntries = activeBaseName
      ? entries
        .filter((entry) => entry.baseName === activeBaseName && entry.unlocked)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "cs", { sensitivity: "base" }))
      : [];

    return {
      entries: scopedEntries,
      selectedBaseName: activeBaseName,
      markup: `
      <div class="buildings-modal__group">
        <div class="buildings-modal__building-grid">
          ${baseTypes
            .map((item) => {
              const activeClass = item.baseName === activeBaseName ? " is-active" : "";
              return `
                <button
                  class="buildings-modal__building buildings-modal__building--interactive${activeClass}${item.unlocked ? "" : " buildings-modal__building--locked"}"
                  type="button"
                  data-building-base-name="${item.baseName}"
                  ${item.unlocked ? "" : 'data-building-locked="1" disabled aria-disabled="true"'}
                >
                  <span>${item.baseName}</span>
                  <span>${item.unlocked ? `${item.unlockedCount}x` : "LOCKED"}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="buildings-modal__group-divider" aria-hidden="true"></div>
      <div class="buildings-modal__group buildings-modal__group--variants">
        <div class="buildings-modal__building-grid">
          ${activeBaseName
            ? scopedEntries
              .map(
                (entry, index) => {
                  return `
              <button
                class="buildings-modal__building buildings-modal__building--interactive"
                type="button"
                data-building-entry-index="${index}"
                data-building-type="${typeKey}"
              >
                <span>${entry.displayName}</span>
              </button>
            `;
                }
              )
              .join("")
            : '<div class="buildings-modal__empty">Nejdřív vyber odemčený typ budovy.</div>'}
        </div>
      </div>
    `
    };
  }

  function resolveBuildingEntriesForDistrictType(typeKey) {
    if (scenarioVisionEnabled) {
      const scenarioEntries = resolveScenarioBuildingEntriesForDistrictType(typeKey);
      if (scenarioEntries.length) return scenarioEntries;
    }

    const ownedEntries = resolveOwnedBuildingEntriesForDistrictType(typeKey);
    if (ownedEntries.length) return ownedEntries;

    const buildings = resolveBuildingsForDistrictType(typeKey);
    const lockContext = resolveBuildingsLockContext(typeKey);
    return buildings.map((building, index) => {
      const baseName = String(building || "Neznámá budova");
      const isUnlocked = !lockContext.enforceLocks || lockContext.unlockedBuildings.has(normalizeOwnerName(baseName));
      return {
        baseName,
        variantName: null,
        displayName: baseName,
        districtType: typeKey,
        districtId: hashDistrictSeed(baseName, typeKey.length),
        buildingIndex: index,
        unlocked: isUnlocked
      };
    });
  }

  function resolveScenarioBuildingEntriesForDistrictType(typeKey) {
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    const playerNames = getPlayerOwnerNameSet();
    const entries = [];

    districts.forEach((district) => {
      if (district.type !== typeKey) return;

      const districtLabel = String(district.name || `${formatDistrictType(typeKey)} ${district.id || "?"}`);
      const owner = normalizeOwnerName(district.owner);
      const isOwnedByPlayer = Boolean(owner && playerNames.has(owner));
      const buildings = Array.isArray(district.buildings) ? district.buildings : [];

      buildings.forEach((building, index) => {
        const baseName = String(building || "Neznámá budova");
        const named = resolveDistrictBuildingDisplayName(district, index, baseName, districtLabel);
        const variantName = named !== baseName ? named : null;
        entries.push({
          baseName,
          variantName,
          displayName: named,
          districtType: typeKey,
          districtId: Number.isFinite(Number(district.id))
            ? Number(district.id)
            : hashDistrictSeed(`${districtLabel}:${baseName}`, index),
          buildingIndex: index,
          unlocked: isOwnedByPlayer
        });
      });
    });

    return entries;
  }

  function resolveOwnedBuildingEntriesForDistrictType(typeKey) {
    const playerNames = getPlayerOwnerNameSet();
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    const entries = [];

    districts.forEach((district) => {
      if (district.type !== typeKey) return;
      const owner = normalizeOwnerName(district.owner);
      if (!owner || !playerNames.has(owner)) return;

      const districtLabel = String(district.name || `${formatDistrictType(typeKey)} ${district.id || "?"}`);
      const buildings = Array.isArray(district.buildings) ? district.buildings : [];
      buildings.forEach((building, index) => {
        const baseName = String(building || "Neznámá budova");
        const named = resolveDistrictBuildingDisplayName(district, index, baseName, districtLabel);
        const variantName = named !== baseName ? named : null;
        entries.push({
          baseName,
          variantName,
          displayName: named,
          districtType: typeKey,
          districtId: Number.isFinite(Number(district.id))
            ? Number(district.id)
            : hashDistrictSeed(`${districtLabel}:${baseName}`, index),
          buildingIndex: index,
          unlocked: true
        });
      });
    });

    return entries;
  }

  function resolveDistrictBuildingDisplayName(district, index, baseName, districtLabel) {
    const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
    const override = overrides[index];
    if (typeof override === "string" && override.trim()) {
      return override.trim();
    }
    return `${baseName} • ${districtLabel}`;
  }

  function resolveBuildingsLockContext(typeKey) {
    if (!scenarioVisionEnabled) {
      return { enforceLocks: false, unlockedBuildings: new Set() };
    }
    return {
      enforceLocks: true,
      unlockedBuildings: getOwnedBuildingsForType(typeKey)
    };
  }

  function getOwnedBuildingsForType(typeKey) {
    const playerNames = getPlayerOwnerNameSet();
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    const ownedBuildings = new Set();

    districts.forEach((district) => {
      if (district.type !== typeKey) return;
      const owner = normalizeOwnerName(district.owner);
      if (!owner || !playerNames.has(owner)) return;
      const buildings = Array.isArray(district.buildings) ? district.buildings : [];
      buildings.forEach((building) => {
        ownedBuildings.add(normalizeOwnerName(building));
      });
    });

    return ownedBuildings;
  }

  function assignDistrictMetadata(districts) {
    if (!Array.isArray(districts) || !districts.length) return districts;
    const nextDistricts = districts.map((district) => ({
      ...district,
      buildings: Array.isArray(district.buildings) ? district.buildings : [],
      buildingNameOverrides: Array.isArray(district.buildingNameOverrides) ? [...district.buildingNameOverrides] : [],
      buildingTier: district.buildingTier || null,
      buildingSetKey: district.buildingSetKey || null,
      buildingSetTitle: district.buildingSetTitle || null
    }));

    const bounds = getDistrictBounds(nextDistricts);
    assignDistrictTypePools(nextDistricts, bounds, {
      type: "commercial",
      pools: commercialDistrictPools,
      tiers: ["early", "mid", "top"],
      ratios: { low: 0.4, high: 0.2 }
    });
    assignDistrictTypePools(nextDistricts, bounds, {
      type: "residential",
      pools: residentialDistrictPools,
      tiers: ["early", "mid", "late"],
      ratios: { low: 0.45, high: 0.2 }
    });
    assignDistrictTypePools(nextDistricts, bounds, {
      type: "park",
      pools: parkDistrictPools,
      tiers: ["early", "mid", "top"],
      ratios: { low: 0.45, high: 0.25 }
    });
    assignDistrictTypePools(nextDistricts, bounds, {
      type: "industrial",
      pools: industrialDistrictPools,
      tiers: ["early", "mid", "top"],
      ratios: { low: 0.4, high: 0.25 }
    });
    assignDistrictTypePools(nextDistricts, bounds, {
      type: "downtown",
      pools: downtownDistrictPools,
      tiers: ["mid", "high", "core"],
      ratios: { low: 0.4, high: 0.25 }
    });
    rebalanceCommercialArcades(nextDistricts, 7);
    rebalanceCommercialCasinos(nextDistricts, 4);
    rebalanceCommercialExchanges(nextDistricts, 12);
    rebalanceCommercialRestaurants(nextDistricts, 18);
    rebalanceResidentialTaxi(nextDistricts, {
      removeBrainwash: 11,
      addTaxi: 11
    });
    rebalanceIndustrialStorage(nextDistricts, {
      removeStorage: 12,
      addArmories: 6,
      addFactories: 6
    });
    rebalanceIndustrialUtilityCounts(nextDistricts, {
      targetStorage: 21,
      reduceDataCenters: 5,
      reducePowerStations: 10
    });
    rebalanceIndustrialStrategicCounts(nextDistricts, {
      targetArmories: 10,
      targetResearchCenters: 8,
      targetRecyclingCenters: 8
    });
    rebalanceDowntownCivicInfrastructure(nextDistricts);
    spreadRareDistrictBuildingSets(nextDistricts, [
      {
        type: "park",
        rareBuildings: ["Drug lab", "Strip club", "Pašovací tunel"],
        onlyTiers: ["mid", "top"]
      },
      {
        type: "industrial",
        rareBuildings: ["Datové centrum", "Výzkumné centrum", "Recyklační centrum", "Zbrojovka"],
        onlyTiers: ["mid", "top"]
      },
      {
        type: "commercial",
        rareBuildings: ["Kasino", "Obchodní centrum"],
        onlyTiers: ["top"]
      },
      {
        type: "residential",
        rareBuildings: ["Škola", "Brainwash centrum"],
        onlyTiers: ["mid", "late"]
      }
    ]);
    if (shouldApplyLegacyDistrictIdTypeOverrides(nextDistricts)) {
      swapDistrictMetadataByIds(nextDistricts, 112, 80);
      swapDistrictMetadataByIds(nextDistricts, 157, 80);
      swapDistrictMetadataByIds(nextDistricts, 68, 114);
      swapDistrictTypeByIds(nextDistricts, 112, 68);
      swapDistrictTypeByIds(nextDistricts, 161, 26);
      swapDistrictTypeByIds(nextDistricts, 161, 68);
      swapDistrictTypeByIds(nextDistricts, 121, 27);
      swapDistrictTypeByIds(nextDistricts, 20, 3);
      swapDistrictTypeByIds(nextDistricts, 3, 27);
      swapDistrictTypeByIds(nextDistricts, 20, 3);
      swapDistrictTypeByIds(nextDistricts, 95, 3);
      swapDistrictTypeByIds(nextDistricts, 95, 27);
      swapDistrictTypeByIds(nextDistricts, 143, 161);
      swapDistrictTypeByIds(nextDistricts, 21, 152);
      swapDistrictTypeByIds(nextDistricts, 19, 149);
      setDistrictTypeByIdWithPreservedCounts(nextDistricts, 2, "industrial", [19]);
      setDistrictTypeByIdWithPreservedCounts(nextDistricts, 19, "industrial", [2]);
    }
    setDistrictTypeByIdWithPreservedCounts(nextDistricts, 3, "downtown", [26]);
    setDistrictTypeByIdWithPreservedCounts(nextDistricts, 26, "downtown", [3]);
    assignDowntownExchangeNames(nextDistricts);
    assignDowntownCentralBankNames(nextDistricts);
    assignDowntownAirportNames(nextDistricts);
    assignDowntownLobbyClubNames(nextDistricts);
    assignDowntownCityHallNames(nextDistricts);
    assignDowntownParliamentNames(nextDistricts);
    assignDowntownPortNames(nextDistricts);
    assignDowntownCourtNames(nextDistricts);
    assignDowntownVipLoungeNames(nextDistricts);
    assignCommercialMallNames(nextDistricts);
    assignCommercialRestaurantNames(nextDistricts);
    assignCommercialPharmacyNames(nextDistricts);
    assignCommercialAutoSalonNames(nextDistricts);
    assignCommercialFitnessClubNames(nextDistricts);
    assignCommercialOfficeBlockNames(nextDistricts);
    assignCommercialExchangeNames(nextDistricts);
    assignCommercialArcadeNames(nextDistricts);
    assignCommercialCasinoNames(nextDistricts);
    assignIndustrialDataCenterNames(nextDistricts);
    assignIndustrialPowerStationNames(nextDistricts);
    assignIndustrialStorageNames(nextDistricts);
    assignIndustrialFactoryNames(nextDistricts);
    assignIndustrialArmoryNames(nextDistricts);
    assignIndustrialResearchCenterNames(nextDistricts);
    assignIndustrialRecyclingCenterNames(nextDistricts);
    assignResidentialBrainwashNames(nextDistricts);
    assignResidentialApartmentBlockNames(nextDistricts);
    assignResidentialGarageNames(nextDistricts);
    assignResidentialClinicNames(nextDistricts);
    assignResidentialRecruitNames(nextDistricts);
    assignResidentialSchoolNames(nextDistricts);
    assignResidentialTaxiNames(nextDistricts);
    assignParkDrugLabNames(nextDistricts);
    assignParkSmugglingTunnelNames(nextDistricts);
    assignParkStreetDealersNames(nextDistricts);
    assignParkStripClubNames(nextDistricts);
    assignParkConvenienceStoreNames(nextDistricts);
    nextDistricts.forEach((district) => {
      const allianceName = String(district?.ownerAllianceName || "").trim();
      district.ownerAllianceIconKey = allianceName
        ? (resolveAllianceIconKeyByName(allianceName) || district.ownerAllianceIconKey || null)
        : null;
    });

    return nextDistricts;
  }

  function shouldApplyLegacyDistrictIdTypeOverrides(districts) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    if (safeDistricts.length < 150) return false;
    let hasMapId161 = false;
    let legacyCount = 0;
    for (let i = 0; i < safeDistricts.length; i += 1) {
      const legacyId = resolveLegacyDistrictId(safeDistricts[i]);
      if (!Number.isFinite(legacyId)) continue;
      legacyCount += 1;
      if (legacyId === 161) hasMapId161 = true;
    }
    return hasMapId161 && legacyCount >= 150;
  }

  function resolveLegacyDistrictId(district) {
    const directMapId = Number(district?.mapId ?? district?.map_id);
    if (Number.isFinite(directMapId)) return Math.max(1, Math.floor(directMapId));
    const numericId = Number(district?.id);
    if (Number.isFinite(numericId)) return Math.max(1, Math.floor(numericId));
    const name = String(district?.name || "").trim();
    if (!name) return NaN;
    const match = name.match(/(\d+)\s*$/);
    if (!match) return NaN;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : NaN;
  }

  function findDistrictByLegacyId(districts, legacyId) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const target = Number(legacyId);
    if (!Number.isFinite(target)) return null;
    const safeTarget = Math.max(1, Math.floor(target));
    return safeDistricts.find((district) => resolveLegacyDistrictId(district) === safeTarget) || null;
  }

  function assignDowntownExchangeNames(districts) {
    assignNamedDowntownBuildings(districts, "Burza", namedDowntownExchanges);
  }

  function assignDowntownCentralBankNames(districts) {
    assignNamedDowntownBuildings(districts, "Centrální banka", namedDowntownCentralBanks);
  }

  function assignDowntownAirportNames(districts) {
    assignNamedDowntownBuildings(districts, "Letiště", namedDowntownAirports);
  }

  function assignDowntownLobbyClubNames(districts) {
    assignNamedDowntownBuildings(districts, "Lobby klub", namedDowntownLobbyClubs);
  }

  function assignDowntownCityHallNames(districts) {
    assignNamedDowntownBuildings(districts, "Magistrát", namedDowntownCityHalls);
  }

  function assignDowntownParliamentNames(districts) {
    assignNamedDowntownBuildings(districts, "Parlament", namedDowntownParliaments);
  }

  function assignDowntownPortNames(districts) {
    assignNamedDowntownBuildings(districts, "Přístav", namedDowntownPorts);
  }

  function assignDowntownCourtNames(districts) {
    assignNamedDowntownBuildings(districts, "Soud", namedDowntownCourts);
  }

  function assignDowntownVipLoungeNames(districts) {
    assignNamedDowntownBuildings(districts, "VIP salonek", namedDowntownVipLounges);
  }

  function assignCommercialMallNames(districts) {
    assignNamedCommercialBuildings(districts, "Obchodní centrum", namedCommercialMalls);
  }

  function assignCommercialRestaurantNames(districts) {
    assignNamedCommercialBuildings(districts, "Restaurace", namedCommercialRestaurants);
  }

  function assignCommercialPharmacyNames(districts) {
    assignNamedCommercialBuildings(districts, "Lékárna", namedCommercialPharmacies);
  }

  function assignCommercialAutoSalonNames(districts) {
    assignNamedCommercialBuildings(districts, "Autosalon", namedCommercialAutoSalons);
  }

  function assignCommercialFitnessClubNames(districts) {
    assignNamedCommercialBuildings(districts, "Fitness Club", namedCommercialFitnessClubs);
  }

  function assignCommercialOfficeBlockNames(districts) {
    assignNamedCommercialBuildings(districts, "Kancelářský blok", namedCommercialOfficeBlocks);
  }

  function assignCommercialExchangeNames(districts) {
    assignNamedCommercialBuildings(districts, "Směnárna", namedCommercialExchanges);
  }

  function assignCommercialArcadeNames(districts) {
    assignNamedCommercialBuildings(districts, "Herna", namedCommercialArcades);
  }

  function assignCommercialCasinoNames(districts) {
    assignNamedCommercialBuildings(districts, "Kasino", namedCommercialCasinos);
  }

  function assignIndustrialDataCenterNames(districts) {
    assignNamedIndustrialBuildings(districts, "Datové centrum", namedIndustrialDataCenters);
  }

  function assignIndustrialPowerStationNames(districts) {
    assignNamedIndustrialBuildings(districts, "Energetická stanice", namedIndustrialPowerStations);
  }

  function assignIndustrialStorageNames(districts) {
    assignNamedIndustrialBuildings(districts, "Sklad", namedIndustrialStorages);
  }

  function assignIndustrialFactoryNames(districts) {
    assignNamedIndustrialBuildings(districts, "Továrna", namedIndustrialFactories);
  }

  function assignIndustrialArmoryNames(districts) {
    assignNamedIndustrialBuildings(districts, "Zbrojovka", namedIndustrialArmories);
  }

  function assignIndustrialResearchCenterNames(districts) {
    assignNamedIndustrialBuildings(districts, "Výzkumné centrum", namedIndustrialResearchCenters);
  }

  function assignIndustrialRecyclingCenterNames(districts) {
    assignNamedIndustrialBuildings(districts, "Recyklační centrum", namedIndustrialRecyclingCenters);
  }

  function assignResidentialBrainwashNames(districts) {
    assignNamedResidentialBuildings(districts, "Brainwash centrum", namedResidentialBrainwashCenters);
  }

  function assignResidentialApartmentBlockNames(districts) {
    assignNamedResidentialBuildings(districts, "Bytový blok", namedResidentialApartmentBlocks);
  }

  function assignResidentialGarageNames(districts) {
    assignNamedResidentialBuildings(districts, "Garage", namedResidentialGarages);
  }

  function assignResidentialClinicNames(districts) {
    assignNamedResidentialBuildings(districts, "Klinika", namedResidentialClinics);
  }

  function assignResidentialRecruitNames(districts) {
    assignNamedResidentialBuildings(districts, "Rekrutační centrum", namedResidentialRecruitCenters);
  }

  function assignResidentialSchoolNames(districts) {
    assignNamedResidentialBuildings(districts, "Škola", namedResidentialSchools);
  }

  function assignResidentialTaxiNames(districts) {
    assignNamedResidentialBuildings(districts, "Taxi služba", namedResidentialTaxiServices);
  }

  function assignParkDrugLabNames(districts) {
    assignNamedParkBuildings(districts, "Drug lab", namedParkDrugLabs);
  }

  function assignParkSmugglingTunnelNames(districts) {
    assignNamedParkBuildings(districts, "Pašovací tunel", namedParkSmugglingTunnels);
  }

  function assignParkStreetDealersNames(districts) {
    assignNamedParkBuildings(districts, "Pouliční dealeři", namedParkStreetDealers);
  }

  function assignParkStripClubNames(districts) {
    assignNamedParkBuildings(districts, "Strip club", namedParkStripClubs);
  }

  function assignParkConvenienceStoreNames(districts) {
    assignNamedParkBuildings(districts, "Večerka", namedParkConvenienceStores);
  }

  function assignNamedCommercialBuildings(districts, buildingName, customNames) {
    if (!Array.isArray(districts) || !districts.length) return;
    if (!Array.isArray(customNames) || !customNames.length) return;
    const targets = districts
      .filter((district) => district.type === "commercial" && Array.isArray(district.buildings))
      .sort((a, b) => a.id - b.id)
      .flatMap((district) =>
        district.buildings
          .map((name, index) => (name === buildingName ? { district, index } : null))
          .filter(Boolean)
      );

    targets.forEach((target, index) => {
      const customName = customNames[index];
      if (!customName) return;
      if (!Array.isArray(target.district.buildingNameOverrides)) {
        target.district.buildingNameOverrides = [];
      }
      target.district.buildingNameOverrides[target.index] = customName;
    });
  }

  function assignNamedIndustrialBuildings(districts, buildingName, customNames) {
    if (!Array.isArray(districts) || !districts.length) return;
    if (!Array.isArray(customNames) || !customNames.length) return;
    const targets = districts
      .filter((district) => district.type === "industrial" && Array.isArray(district.buildings))
      .sort((a, b) => a.id - b.id)
      .flatMap((district) =>
        district.buildings
          .map((name, index) => (name === buildingName ? { district, index } : null))
          .filter(Boolean)
      );

    targets.forEach((target, index) => {
      const customName = customNames[index];
      if (!customName) return;
      if (!Array.isArray(target.district.buildingNameOverrides)) {
        target.district.buildingNameOverrides = [];
      }
      target.district.buildingNameOverrides[target.index] = customName;
    });
  }

  function assignNamedResidentialBuildings(districts, buildingName, customNames) {
    if (!Array.isArray(districts) || !districts.length) return;
    if (!Array.isArray(customNames) || !customNames.length) return;
    const targets = districts
      .filter((district) => district.type === "residential" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .flatMap((district) =>
        district.buildings
          .map((name, index) => (name === buildingName ? { district, index } : null))
          .filter(Boolean)
      );

    targets.forEach((target, index) => {
      const customName = customNames[index];
      if (!customName) return;
      if (!Array.isArray(target.district.buildingNameOverrides)) {
        target.district.buildingNameOverrides = [];
      }
      target.district.buildingNameOverrides[target.index] = customName;
    });
  }

  function assignNamedParkBuildings(districts, buildingName, customNames) {
    if (!Array.isArray(districts) || !districts.length) return;
    if (!Array.isArray(customNames) || !customNames.length) return;
    const targets = districts
      .filter((district) => district.type === "park" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .flatMap((district) =>
        district.buildings
          .map((name, index) => (name === buildingName ? { district, index } : null))
          .filter(Boolean)
      );

    targets.forEach((target, index) => {
      const customName = customNames[index];
      if (!customName) return;
      if (!Array.isArray(target.district.buildingNameOverrides)) {
        target.district.buildingNameOverrides = [];
      }
      target.district.buildingNameOverrides[target.index] = customName;
    });
  }

  function assignNamedDowntownBuildings(districts, buildingName, customNames) {
    if (!Array.isArray(districts) || !districts.length) return;
    if (!Array.isArray(customNames) || !customNames.length) return;
    const targets = districts
      .filter((district) => district.type === "downtown" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .flatMap((district) =>
        district.buildings
          .map((name, index) => (name === buildingName ? { district, index } : null))
          .filter(Boolean)
      );

    targets.forEach((target, index) => {
      const customName = customNames[index];
      if (!customName) return;
      if (!Array.isArray(target.district.buildingNameOverrides)) {
        target.district.buildingNameOverrides = [];
      }
      target.district.buildingNameOverrides[target.index] = customName;
    });
  }

  function rebalanceCommercialArcades(districts, targetArcades = 7) {
    if (!Array.isArray(districts) || !districts.length) return;
    const desired = Math.max(0, Math.floor(Number(targetArcades) || 0));
    const commercialDistricts = districts
      .filter((district) => district.type === "commercial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const arcadeSlots = [];
    const restaurantSlots = [];
    commercialDistricts.forEach((district) => {
      district.buildings.forEach((building, index) => {
        if (building === "Herna") arcadeSlots.push({ district, index });
        if (building === "Restaurace") restaurantSlots.push({ district, index });
      });
    });

    if (arcadeSlots.length < desired) {
      const needed = desired - arcadeSlots.length;
      for (let i = 0; i < needed && i < restaurantSlots.length; i += 1) {
        const slot = restaurantSlots[i];
        slot.district.buildings[slot.index] = "Herna";
      }
      return;
    }

    if (arcadeSlots.length > desired) {
      const overflow = arcadeSlots.length - desired;
      for (let i = 0; i < overflow; i += 1) {
        const slot = arcadeSlots[i];
        slot.district.buildings[slot.index] = "Restaurace";
      }
    }
  }

  function rebalanceCommercialCasinos(districts, targetCasinos = 4) {
    if (!Array.isArray(districts) || !districts.length) return;
    const desired = Math.max(0, Math.floor(Number(targetCasinos) || 0));
    const commercialDistricts = districts
      .filter((district) => district.type === "commercial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const casinoSlots = [];
    const restaurantSlots = [];
    commercialDistricts.forEach((district) => {
      district.buildings.forEach((building, index) => {
        if (building === "Kasino") casinoSlots.push({ district, index });
        if (building === "Restaurace") restaurantSlots.push({ district, index });
      });
    });

    if (casinoSlots.length < desired) {
      const needed = desired - casinoSlots.length;
      for (let i = 0; i < needed && i < restaurantSlots.length; i += 1) {
        const slot = restaurantSlots[i];
        slot.district.buildings[slot.index] = "Kasino";
      }
      return;
    }

    if (casinoSlots.length > desired) {
      const extra = casinoSlots.length - desired;
      for (let i = 0; i < extra; i += 1) {
        const slot = casinoSlots[casinoSlots.length - 1 - i];
        if (!slot) continue;
        slot.district.buildings[slot.index] = "Restaurace";
      }
    }
  }

  function rebalanceCommercialExchanges(districts, targetExchanges = 12) {
    if (!Array.isArray(districts) || !districts.length) return;
    const desired = Math.max(0, Math.floor(Number(targetExchanges) || 0));
    const commercialDistricts = districts
      .filter((district) => district.type === "commercial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const exchangeSlots = [];
    const restaurantSlots = [];
    commercialDistricts.forEach((district) => {
      district.buildings.forEach((building, index) => {
        if (building === "Směnárna") exchangeSlots.push({ district, index });
        if (building === "Restaurace") restaurantSlots.push({ district, index });
      });
    });

    if (exchangeSlots.length < desired) {
      const needed = desired - exchangeSlots.length;
      for (let i = 0; i < needed && i < restaurantSlots.length; i += 1) {
        const slot = restaurantSlots[i];
        slot.district.buildings[slot.index] = "Směnárna";
      }
      return;
    }

    if (exchangeSlots.length > desired) {
      const extra = exchangeSlots.length - desired;
      for (let i = 0; i < extra; i += 1) {
        const slot = exchangeSlots[exchangeSlots.length - 1 - i];
        if (!slot) continue;
        slot.district.buildings[slot.index] = "Restaurace";
      }
    }
  }

  function rebalanceCommercialRestaurants(districts, targetRestaurants = 18) {
    if (!Array.isArray(districts) || !districts.length) return;
    const desired = Math.max(0, Math.floor(Number(targetRestaurants) || 0));
    const commercialDistricts = districts
      .filter((district) => district.type === "commercial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const restaurantSlots = [];
    const convertibleToRestaurant = [];
    commercialDistricts.forEach((district) => {
      district.buildings.forEach((building, index) => {
        if (building === "Restaurace") {
          restaurantSlots.push({ district, index });
          return;
        }
        if (
          building === "Kancelářský blok"
          || building === "Autosalon"
          || building === "Fitness Club"
          || building === "Lékárna"
          || building === "Obchodní centrum"
        ) {
          convertibleToRestaurant.push({ district, index });
        }
      });
    });

    if (restaurantSlots.length < desired) {
      const needed = desired - restaurantSlots.length;
      for (let i = 0; i < needed && i < convertibleToRestaurant.length; i += 1) {
        const slot = convertibleToRestaurant[i];
        slot.district.buildings[slot.index] = "Restaurace";
      }
      return;
    }

    if (restaurantSlots.length > desired) {
      const extra = restaurantSlots.length - desired;
      for (let i = 0; i < extra; i += 1) {
        const slot = restaurantSlots[restaurantSlots.length - 1 - i];
        if (!slot) continue;
        slot.district.buildings[slot.index] = "Kancelářský blok";
      }
    }
  }

  function rebalanceIndustrialStorage(
    districts,
    { removeStorage = 12, addArmories = 6, addFactories = 6 } = {}
  ) {
    if (!Array.isArray(districts) || !districts.length) return;
    const removeTarget = Math.max(0, Math.floor(Number(removeStorage) || 0));
    const armoryTarget = Math.max(0, Math.floor(Number(addArmories) || 0));
    const factoryTarget = Math.max(0, Math.floor(Number(addFactories) || 0));
    if (!removeTarget || (!armoryTarget && !factoryTarget)) return;

    const industrialDistricts = districts
      .filter((district) => district.type === "industrial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    let storageSlots = industrialDistricts.flatMap((district) =>
      district.buildings
        .map((building, index) =>
          building === "Sklad" ? { district, index, key: `${district.id}:${index}` } : null
        )
        .filter(Boolean)
    );

    const replacementOrder = [
      ...Array.from({ length: armoryTarget }, () => "Zbrojovka"),
      ...Array.from({ length: factoryTarget }, () => "Továrna")
    ];
    const maxReplacements = Math.min(removeTarget, replacementOrder.length, storageSlots.length);
    if (!maxReplacements) return;

    storageSlots = storageSlots.slice(0, maxReplacements);
    const selected = [];

    const takeSlots = (targetName, count) => {
      if (!count || !storageSlots.length) return [];
      const preferred = [];
      const fallback = [];
      storageSlots.forEach((slot) => {
        if (slot.district.buildings.includes(targetName)) fallback.push(slot);
        else preferred.push(slot);
      });
      const picks = [...preferred.slice(0, count)];
      if (picks.length < count) {
        picks.push(...fallback.slice(0, count - picks.length));
      }
      const pickedKeys = new Set(picks.map((slot) => slot.key));
      storageSlots = storageSlots.filter((slot) => !pickedKeys.has(slot.key));
      return picks;
    };

    const armoryReplaceCount = Math.min(armoryTarget, maxReplacements);
    const factoryReplaceCount = Math.min(factoryTarget, maxReplacements - armoryReplaceCount);

    takeSlots("Zbrojovka", armoryReplaceCount).forEach((slot) =>
      selected.push({ ...slot, next: "Zbrojovka" })
    );
    takeSlots("Továrna", factoryReplaceCount).forEach((slot) =>
      selected.push({ ...slot, next: "Továrna" })
    );

    selected.forEach((slot) => {
      slot.district.buildings[slot.index] = slot.next;
    });
  }

  function rebalanceIndustrialUtilityCounts(
    districts,
    { targetStorage = 21, reduceDataCenters = 5, reducePowerStations = 10 } = {}
  ) {
    if (!Array.isArray(districts) || !districts.length) return;
    const desiredStorage = Math.max(0, Math.floor(Number(targetStorage) || 0));
    const dataReduction = Math.max(0, Math.floor(Number(reduceDataCenters) || 0));
    const powerReduction = Math.max(0, Math.floor(Number(reducePowerStations) || 0));
    if (!desiredStorage && !dataReduction && !powerReduction) return;

    const industrialDistricts = districts
      .filter((district) => district.type === "industrial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const collectSlots = (buildingName) => industrialDistricts.flatMap((district) =>
      district.buildings
        .map((building, index) => (building === buildingName ? { district, index, key: `${district.id}:${index}` } : null))
        .filter(Boolean)
    );

    let storageSlots = collectSlots("Sklad");
    let storageNeeded = Math.max(0, desiredStorage - storageSlots.length);
    if (!storageNeeded) return;

    const applyReplacement = (buildingName, maxReduction) => {
      if (!storageNeeded || !maxReduction) return;
      const slots = collectSlots(buildingName);
      const replacements = Math.min(storageNeeded, maxReduction, slots.length);
      for (let i = 0; i < replacements; i += 1) {
        const slot = slots[i];
        slot.district.buildings[slot.index] = "Sklad";
      }
      storageNeeded -= replacements;
    };

    applyReplacement("Datové centrum", dataReduction);
    applyReplacement("Energetická stanice", powerReduction);
  }

  function rebalanceIndustrialStrategicCounts(
    districts,
    { targetArmories = 10, targetResearchCenters = 8, targetRecyclingCenters = 8 } = {}
  ) {
    if (!Array.isArray(districts) || !districts.length) return;
    const industrialDistricts = districts
      .filter((district) => district.type === "industrial" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    if (!industrialDistricts.length) return;

    const desired = new Map([
      ["Zbrojovka", Math.max(0, Math.floor(Number(targetArmories) || 0))],
      ["Výzkumné centrum", Math.max(0, Math.floor(Number(targetResearchCenters) || 0))],
      ["Recyklační centrum", Math.max(0, Math.floor(Number(targetRecyclingCenters) || 0))]
    ]);
    const protectedNames = new Set(desired.keys());
    const fallbackCycle = ["Továrna", "Sklad", "Energetická stanice", "Datové centrum"];

    const collectSlots = () => industrialDistricts.flatMap((district) =>
      district.buildings.map((building, index) => ({
        district,
        index,
        key: `${district.id}:${index}`,
        building: String(building || "")
      }))
    );

    const countByBuilding = () => {
      const counts = new Map();
      collectSlots().forEach((slot) => {
        counts.set(slot.building, (counts.get(slot.building) || 0) + 1);
      });
      return counts;
    };

    const chooseFallback = (counts) => {
      let pick = fallbackCycle[0];
      let pickCount = Number.POSITIVE_INFINITY;
      fallbackCycle.forEach((name) => {
        const value = counts.get(name) || 0;
        if (value < pickCount) {
          pick = name;
          pickCount = value;
        }
      });
      return pick;
    };

    desired.forEach((targetCount, targetName) => {
      const counts = countByBuilding();
      const currentCount = counts.get(targetName) || 0;
      if (currentCount <= targetCount) return;
      const overflow = collectSlots().filter((slot) => slot.building === targetName).slice(targetCount);
      overflow.forEach((slot) => {
        const fallback = chooseFallback(countByBuilding());
        slot.district.buildings[slot.index] = fallback;
      });
    });

    desired.forEach((targetCount, targetName) => {
      let currentCount = countByBuilding().get(targetName) || 0;
      if (currentCount >= targetCount) return;
      let needed = targetCount - currentCount;
      while (needed > 0) {
        const counts = countByBuilding();
        const candidates = collectSlots().filter((slot) => {
          if (slot.building === targetName) return false;
          if (!protectedNames.has(slot.building)) return true;
          const slotDesired = desired.get(slot.building) || 0;
          return (counts.get(slot.building) || 0) > slotDesired;
        });
        if (!candidates.length) break;
        const slot = candidates[0];
        slot.district.buildings[slot.index] = targetName;
        needed -= 1;
      }
      currentCount = countByBuilding().get(targetName) || 0;
      if (currentCount < targetCount) return;
    });
  }

  function rebalanceResidentialTaxi(
    districts,
    { removeBrainwash = 11, addTaxi = 11 } = {}
  ) {
    if (!Array.isArray(districts) || !districts.length) return;
    const removeTarget = Math.max(0, Math.floor(Number(removeBrainwash) || 0));
    const addTarget = Math.max(0, Math.floor(Number(addTaxi) || 0));
    if (!removeTarget || !addTarget) return;

    const residentialDistricts = districts
      .filter((district) => district.type === "residential" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const brainwashSlots = residentialDistricts.flatMap((district) =>
      district.buildings
        .map((building, index) => (building === "Brainwash centrum" ? { district, index } : null))
        .filter(Boolean)
    );

    const replacements = Math.min(removeTarget, addTarget, brainwashSlots.length);
    if (!replacements) return;

    for (let i = 0; i < replacements; i += 1) {
      const slot = brainwashSlots[i];
      slot.district.buildings[slot.index] = "Taxi služba";
    }
  }

  function rebalanceDowntownCivicInfrastructure(districts) {
    if (!Array.isArray(districts) || !districts.length) return;
    const downtownDistricts = districts
      .filter((district) => district.type === "downtown" && Array.isArray(district.buildings))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    if (!downtownDistricts.length) return;

    const bankSlots = [];
    const magistrateSlots = [];
    downtownDistricts.forEach((district) => {
      district.buildings.forEach((building, index) => {
        if (building === "Centrální banka") bankSlots.push({ district, index });
        if (building === "Magistrát") magistrateSlots.push({ district, index });
      });
    });

    const bankReplacements = ["Letiště", "Přístav"];
    const magistrateReplacements = ["Přístav", "Přístav", "Parlament"];

    for (let i = 0; i < bankReplacements.length && i < bankSlots.length; i += 1) {
      const slot = bankSlots[i];
      slot.district.buildings[slot.index] = bankReplacements[i];
    }

    for (let i = 0; i < magistrateReplacements.length && i < magistrateSlots.length; i += 1) {
      const slot = magistrateSlots[i];
      slot.district.buildings[slot.index] = magistrateReplacements[i];
    }
  }

  function assignDistrictTypePools(districts, bounds, config) {
    const typedDistricts = districts.filter((district) => district.type === config.type);
    if (!typedDistricts.length) return;

    const ranked = typedDistricts
      .map((district) => ({
        district,
        distance: distanceFromMapCenter(district, bounds)
      }))
      .sort((a, b) => b.distance - a.distance);

    const total = ranked.length;
    const lowCount = Math.max(1, Math.round(total * config.ratios.low));
    const highCount = total >= 5 ? Math.max(1, Math.round(total * config.ratios.high)) : Math.min(1, total);
    const midCount = Math.max(0, total - lowCount - highCount);

    ranked.forEach((entry, index) => {
      let tier = config.tiers[1];
      if (index < lowCount) tier = config.tiers[0];
      else if (index >= lowCount + midCount) tier = config.tiers[2];
      const set = pickDistrictSet(config.pools, entry.district, tier, index);
      entry.district.buildings = Array.isArray(set.buildings) ? [...set.buildings] : [];
      entry.district.buildingNameOverrides = [];
      entry.district.buildingTier = set.tier;
      entry.district.buildingSetKey = set.key;
      entry.district.buildingSetTitle = set.title;
    });
  }

  function spreadRareDistrictBuildingSets(districts, configs) {
    if (!Array.isArray(districts) || !districts.length || !Array.isArray(configs)) return;
    configs.forEach((config) => {
      spreadRareDistrictBuildingSetsByType(districts, config);
    });
  }

  function swapDistrictMetadataByIds(districts, firstId, secondId) {
    if (!Array.isArray(districts) || !districts.length) return;
    const first = findDistrictByLegacyId(districts, firstId);
    const second = findDistrictByLegacyId(districts, secondId);
    if (!first || !second) return;

    const firstSnapshot = {
      type: first.type,
      income: first.income,
      influence: first.influence,
      buildings: Array.isArray(first.buildings) ? [...first.buildings] : [],
      buildingNameOverrides: Array.isArray(first.buildingNameOverrides) ? [...first.buildingNameOverrides] : [],
      buildingTier: first.buildingTier || null,
      buildingSetKey: first.buildingSetKey || null,
      buildingSetTitle: first.buildingSetTitle || null
    };
    const secondSnapshot = {
      type: second.type,
      income: second.income,
      influence: second.influence,
      buildings: Array.isArray(second.buildings) ? [...second.buildings] : [],
      buildingNameOverrides: Array.isArray(second.buildingNameOverrides) ? [...second.buildingNameOverrides] : [],
      buildingTier: second.buildingTier || null,
      buildingSetKey: second.buildingSetKey || null,
      buildingSetTitle: second.buildingSetTitle || null
    };

    first.type = secondSnapshot.type;
    first.income = secondSnapshot.income;
    first.influence = secondSnapshot.influence;
    first.buildings = secondSnapshot.buildings;
    first.buildingNameOverrides = secondSnapshot.buildingNameOverrides;
    first.buildingTier = secondSnapshot.buildingTier;
    first.buildingSetKey = secondSnapshot.buildingSetKey;
    first.buildingSetTitle = secondSnapshot.buildingSetTitle;

    second.type = firstSnapshot.type;
    second.income = firstSnapshot.income;
    second.influence = firstSnapshot.influence;
    second.buildings = firstSnapshot.buildings;
    second.buildingNameOverrides = firstSnapshot.buildingNameOverrides;
    second.buildingTier = firstSnapshot.buildingTier;
    second.buildingSetKey = firstSnapshot.buildingSetKey;
    second.buildingSetTitle = firstSnapshot.buildingSetTitle;
  }

  function swapDistrictTypeByIds(districts, firstId, secondId) {
    if (!Array.isArray(districts) || !districts.length) return;
    const first = findDistrictByLegacyId(districts, firstId);
    const second = findDistrictByLegacyId(districts, secondId);
    if (!first || !second) return;

    const firstType = first.type;
    first.type = second.type;
    second.type = firstType;
  }

  function setDistrictTypeByIdWithPreservedCounts(districts, districtId, nextType, protectedIds = []) {
    if (!Array.isArray(districts) || !districts.length) return false;
    const safeType = String(nextType || "").trim().toLowerCase();
    if (!safeType) return false;
    const target = findDistrictByLegacyId(districts, districtId);
    if (!target) return false;
    const currentType = String(target?.type || "").trim().toLowerCase();
    if (!currentType || currentType === safeType) return true;

    const protectedSet = new Set((Array.isArray(protectedIds) ? protectedIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .map((id) => Math.max(1, Math.floor(id))));
    protectedSet.add(Math.max(1, Math.floor(Number(districtId) || 0)));

    const donor = districts.find((entry) => {
      const entryId = resolveLegacyDistrictId(entry);
      if (!Number.isFinite(entryId) || protectedSet.has(entryId)) return false;
      return String(entry?.type || "").trim().toLowerCase() === safeType;
    });
    if (!donor) return false;

    donor.type = currentType;
    target.type = safeType;
    return true;
  }

  function spreadRareDistrictBuildingSetsByType(districts, config) {
    const type = String(config?.type || "").trim().toLowerCase();
    const rareBuildings = new Set(
      (Array.isArray(config?.rareBuildings) ? config.rareBuildings : [])
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    );
    if (!type || !rareBuildings.size) return;

    const allowedTiers = new Set(
      (Array.isArray(config?.onlyTiers) ? config.onlyTiers : [])
        .map((tier) => String(tier || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const typedDistricts = districts.filter((district) => {
      if (String(district?.type || "").trim().toLowerCase() !== type) return false;
      if (!allowedTiers.size) return true;
      return allowedTiers.has(String(district?.buildingTier || "").trim().toLowerCase());
    });
    if (typedDistricts.length < 2) return;

    const packageEntries = typedDistricts.map((district) => {
      const buildings = Array.isArray(district.buildings) ? [...district.buildings] : [];
      const rareCount = buildings.reduce((sum, building) => sum + (rareBuildings.has(String(building || "").trim()) ? 1 : 0), 0);
      return {
        district,
        packageData: {
          buildings,
          buildingNameOverrides: Array.isArray(district.buildingNameOverrides) ? [...district.buildingNameOverrides] : [],
          buildingTier: district.buildingTier || null,
          buildingSetKey: district.buildingSetKey || null,
          buildingSetTitle: district.buildingSetTitle || null
        },
        rareCount,
        centroid: polygonCentroid(district.polygon || [])
      };
    });

    const rarePackages = packageEntries.filter((entry) => entry.rareCount > 0);
    if (rarePackages.length < 2) return;

    const targets = pickMaxSpreadDistrictTargets(packageEntries, rarePackages.length);
    if (targets.length !== rarePackages.length) return;

    const targetIds = new Set(targets.map((entry) => Number(entry?.district?.id)));
    const rareSourceIds = new Set(rarePackages.map((entry) => Number(entry?.district?.id)));
    const rareByStrength = [...rarePackages].sort((a, b) => {
      if (a.rareCount === b.rareCount) return Number(a.district?.id || 0) - Number(b.district?.id || 0);
      return b.rareCount - a.rareCount;
    });
    const nonRarePackages = packageEntries.filter((entry) => !rareSourceIds.has(Number(entry?.district?.id)));

    const finalPackagesByDistrictId = new Map();
    targets.forEach((target, index) => {
      finalPackagesByDistrictId.set(Number(target.district?.id), rareByStrength[index].packageData);
    });

    const remainingTargetDistricts = packageEntries
      .filter((entry) => !targetIds.has(Number(entry?.district?.id)))
      .sort((a, b) => Number(a.district?.id || 0) - Number(b.district?.id || 0));
    nonRarePackages.forEach((entry, index) => {
      const target = remainingTargetDistricts[index];
      if (!target) return;
      finalPackagesByDistrictId.set(Number(target.district?.id), entry.packageData);
    });

    packageEntries.forEach((entry) => {
      const nextPackage = finalPackagesByDistrictId.get(Number(entry.district?.id));
      if (!nextPackage) return;
      entry.district.buildings = [...nextPackage.buildings];
      entry.district.buildingNameOverrides = [...nextPackage.buildingNameOverrides];
      entry.district.buildingTier = nextPackage.buildingTier;
      entry.district.buildingSetKey = nextPackage.buildingSetKey;
      entry.district.buildingSetTitle = nextPackage.buildingSetTitle;
    });
  }

  function pickMaxSpreadDistrictTargets(entries, count) {
    const pool = Array.isArray(entries) ? entries.filter(Boolean) : [];
    const targetCount = Math.max(0, Math.min(pool.length, Math.floor(Number(count) || 0)));
    if (!targetCount) return [];

    const center = resolveEntriesCenter(pool);
    const sorted = [...pool].sort((a, b) => {
      const aRadius = distanceFromMapPoint(a.centroid, center);
      const bRadius = distanceFromMapPoint(b.centroid, center);
      if (aRadius === bRadius) return Number(a.district?.id || 0) - Number(b.district?.id || 0);
      return bRadius - aRadius;
    });
    const selected = [sorted[0]];

    while (selected.length < targetCount) {
      let bestCandidate = null;
      let bestDistance = -1;
      for (let i = 0; i < sorted.length; i += 1) {
        const candidate = sorted[i];
        if (!candidate || selected.includes(candidate)) continue;
        const nearestSelectedDistance = selected.reduce((minDistance, chosen) => {
          const distance = distanceBetweenPoints(candidate.centroid, chosen.centroid);
          return Math.min(minDistance, distance);
        }, Number.POSITIVE_INFINITY);
        if (nearestSelectedDistance > bestDistance) {
          bestDistance = nearestSelectedDistance;
          bestCandidate = candidate;
        }
      }
      if (!bestCandidate) break;
      selected.push(bestCandidate);
    }

    return selected;
  }

  function distanceFromMapPoint(point, target) {
    const dx = Number(point?.x || 0) - Number(target?.x || 0);
    const dy = Number(point?.y || 0) - Number(target?.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function resolveEntriesCenter(entries) {
    const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!safeEntries.length) return { x: 0, y: 0 };
    const total = safeEntries.reduce((acc, entry) => {
      acc.x += Number(entry?.centroid?.x || 0);
      acc.y += Number(entry?.centroid?.y || 0);
      return acc;
    }, { x: 0, y: 0 });
    return {
      x: total.x / safeEntries.length,
      y: total.y / safeEntries.length
    };
  }

  function distanceBetweenPoints(a, b) {
    const dx = Number(a?.x || 0) - Number(b?.x || 0);
    const dy = Number(a?.y || 0) - Number(b?.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pickCommercialSet(district, tier, index) {
    const pool = commercialDistrictPools[tier] || commercialDistrictPools.mid;
    const offset = hashDistrictSeed(district.id, index) % pool.length;
    return pool[offset];
  }

  function pickDistrictSet(pools, district, tier, index) {
    const fallbackTier = Object.keys(pools)[1] || Object.keys(pools)[0];
    const pool = pools[tier] || pools[fallbackTier] || [];
    const offset = hashDistrictSeed(district.id, index) % pool.length;
    return pool[offset];
  }

  function hashDistrictSeed(seed, extra = 0) {
    const text = `${seed || ""}:${extra}`;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function getDistrictBounds(districts) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    districts.forEach((district) => {
      (district.polygon || []).forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    return {
      minX: Number.isFinite(minX) ? minX : 0,
      minY: Number.isFinite(minY) ? minY : 0,
      maxX: Number.isFinite(maxX) ? maxX : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0
    };
  }

  function distanceFromMapCenter(district, bounds) {
    const center = polygonCentroid(district.polygon || []);
    const mapCenterX = (bounds.minX + bounds.maxX) / 2;
    const mapCenterY = (bounds.minY + bounds.maxY) / 2;
    const dx = center.x - mapCenterX;
    const dy = center.y - mapCenterY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function polygonCentroid(polygon) {
    if (!Array.isArray(polygon) || !polygon.length) {
      return { x: 0, y: 0 };
    }
    const sum = polygon.reduce(
      (acc, point) => {
        acc.x += Number(point[0] || 0);
        acc.y += Number(point[1] || 0);
        return acc;
      },
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / polygon.length,
      y: sum.y / polygon.length
    };
  }

  function formatDistrictType(type) {
    const labels = {
      downtown: "Centrum",
      commercial: "Komerční zóna",
      residential: "Rezidenční zóna",
      industrial: "Průmyslová zóna",
      park: "Park"
    };
    return labels[type] || type || "Neznámý typ";
  }

  async function hydrateAfterAuth() {
    return getAuthSessionController()?.hydrateAfterAuth?.();
  }

  function extractAllianceDisplayName(allianceValue) {
    return getPlayerLabelHelpers()?.extractAllianceDisplayName?.(allianceValue) || "";
  }

  function extractAllianceSectorCountHint(allianceValue) {
    return getPlayerLabelHelpers()?.extractAllianceSectorCountHint?.(allianceValue) || 0;
  }

  function formatSectorCountLabel(value) {
    return getPlayerLabelHelpers()?.formatSectorCountLabel?.(value) || "0 sektorů";
  }

  function formatPopulationLabel(value) {
    return getPlayerLabelHelpers()?.formatPopulationLabel?.(value) || "0";
  }

  function getLocalGangMembersBonus() {
    return getPlayerPopulationController()?.getLocalGangMembersBonus?.() || 0;
  }

  function setLocalGangMembersBonus(value) {
    return getPlayerPopulationController()?.setLocalGangMembersBonus?.(value) || 0;
  }

  function getLocalGangMembersSpent() {
    return getPlayerPopulationController()?.getLocalGangMembersSpent?.() || 0;
  }

  function setLocalGangMembersSpent(value) {
    return getPlayerPopulationController()?.setLocalGangMembersSpent?.(value) || 0;
  }

  function consumeGangMembers(amount) {
    const controller = getPlayerPopulationController();
    if (controller?.consumeGangMembers) {
      return controller.consumeGangMembers(amount);
    }
    return countPlayerControlledPopulation(cachedProfile || window.Empire.player || {});
  }

  function refreshProfilePopulation() {
    const controller = getPlayerPopulationController();
    if (controller?.refreshProfilePopulation) {
      return controller.refreshProfilePopulation();
    }
    return countPlayerControlledPopulation(cachedProfile || window.Empire.player || {});
  }

  function addGangMembers(amount) {
    const controller = getPlayerPopulationController();
    if (controller?.addGangMembers) {
      return controller.addGangMembers(amount);
    }
    return countPlayerControlledPopulation(cachedProfile || window.Empire.player || {});
  }

  function getCurrentGangMembers() {
    return getPlayerPopulationController()?.getCurrentGangMembers?.() || 0;
  }

  function countAllianceControlledSectors() {
    return getPlayerPopulationController()?.countAllianceControlledSectors?.() || 0;
  }

  function countPlayerControlledPopulation(profile) {
    const controller = getPlayerPopulationController();
    if (controller?.countPlayerControlledPopulation) {
      return controller.countPlayerControlledPopulation(profile);
    }
    return Math.max(0, Number(profile?.population || 0));
  }

  function formatFactionLabel(value) {
    return getPlayerLabelHelpers()?.formatFactionLabel?.(value) || "-";
  }

  function clampWantedHeat(value) {
    return getPlayerHeatHelpers()?.clampWantedHeat?.(value) || 0;
  }

  function resolveStealthHeatMultiplier(profile) {
    return getPlayerHeatHelpers()?.resolveStealthHeatMultiplier?.(profile) || 1;
  }

  function formatWantedHeat(value) {
    return getPlayerHeatHelpers()?.formatWantedHeat?.(value) || "0";
  }

  function readGangHeatJournal() {
    return getPlayerHeatHelpers()?.readGangHeatJournal?.() || [];
  }

  function saveGangHeatJournal(entries) {
    return getPlayerHeatHelpers()?.saveGangHeatJournal?.(entries) || [];
  }

  function clearGangHeatJournal() {
    return getPlayerHeatHelpers()?.clearGangHeatJournal?.();
  }

  function appendGangHeatJournalEntry(type, amount, reason, createdAt = Date.now()) {
    return getPlayerHeatHelpers()?.appendGangHeatJournalEntry?.(type, amount, reason, createdAt) || null;
  }

  function formatRelativeHeatTime(timestamp) {
    return getPlayerHeatHelpers()?.formatRelativeHeatTime?.(timestamp) || "právě teď";
  }

  function getOwnedPlayerDistricts() {
    return getPlayerHeatHelpers()?.getOwnedPlayerDistricts?.() || [];
  }

  function getBlackoutIncomeDistricts(districtsInput = window.Empire.districts) {
    return getPlayerHeatHelpers()?.getBlackoutIncomeDistricts?.(districtsInput) || [];
  }

  function spendDirtyCash(amount) {
    const helper = getPlayerHeatHelpers();
    if (helper?.spendDirtyCash) {
      return helper.spendDirtyCash(amount);
    }
    return { ok: false, reason: "unavailable", available: 0 };
  }

  function setPlayerWantedHeat(nextHeat, reason = "", type = "fall") {
    return getPlayerHeatHelpers()?.setPlayerWantedHeat?.(nextHeat, reason, type) || 0;
  }

  function readDirtyHeatReductionTimestamps() {
    return getPlayerHeatHelpers()?.readDirtyHeatReductionTimestamps?.() || [];
  }

  function saveDirtyHeatReductionTimestamps(entries) {
    return getPlayerHeatHelpers()?.saveDirtyHeatReductionTimestamps?.(entries) || [];
  }

  function registerDirtyHeatReductionAndMaybeTriggerPolice() {
    return getPlayerHeatHelpers()?.registerDirtyHeatReductionAndMaybeTriggerPolice?.() || {
      triggered: false,
      count: 0,
      districtId: null
    };
  }

  function resolveWantedStars(heatValue) {
    return getPlayerHeatHelpers()?.resolveWantedStars?.(heatValue) || 6;
  }

  function updateProfileWantedStars(heatValue) {
    return getPlayerHeatHelpers()?.updateProfileWantedStars?.(heatValue);
  }

  function resolveWantedLevel(profile) {
    return getPlayerHeatHelpers()?.resolveWantedLevel?.(profile) || 0;
  }

  function resolvePoliceRaidProtectionUntil(profile) {
    return getPlayerHeatHelpers()?.resolvePoliceRaidProtectionUntil?.(profile) || 0;
  }

  function formatPoliceRaidProtectionLabel(profile) {
    return getPlayerHeatHelpers()?.formatPoliceRaidProtectionLabel?.(profile) || "Bez ochrany";
  }

  function formatAllianceProfileSummary(profile) {
    return getPlayerHeatHelpers()?.formatAllianceProfileSummary?.(profile) || "Žádná";
  }

  function updateProfile(profile) {
    const controller = getProfileStateController();
    if (controller?.updateProfile) {
      return controller.updateProfile(profile);
    }
  }

  function closeGangHeatModal() {
    return getPlayerHeatHelpers()?.closeGangHeatModal?.();
  }

  function renderGangHeatModal() {
    return getPlayerHeatHelpers()?.renderGangHeatModal?.();
  }

  function openGangHeatModal() {
    return getPlayerHeatHelpers()?.openGangHeatModal?.();
  }

  function getActiveOwnedPoliceRaidContext() {
    return getPoliceHeatController()?.getActiveOwnedPoliceRaidContext?.() || null;
  }

  function hasActivePoliceRaidImpactLock(fieldName) {
    const activeRaid = getActiveOwnedPoliceRaidContext();
    if (!activeRaid || !Array.isArray(activeRaid.actions)) return false;
    return activeRaid.actions.some((entry) => {
      const key = buildPoliceRaidImpactKey(entry || {});
      const impact = key ? getPoliceRaidImpactMap().get(key) : null;
      return Boolean(impact?.[fieldName]);
    });
  }

  function isPoliceRaidBuildingSpecialActionsLocked(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      let changed = false;
      let hasActiveLock = false;
      ["pharmacy_factory_special", "all_special_buildings"].forEach((lockKey) => {
        const until = Math.max(0, Math.floor(Number(parsed[lockKey] || 0)));
        if (until > nowMs) {
          hasActiveLock = true;
          return;
        }
        if (parsed[lockKey]) {
          delete parsed[lockKey];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY, JSON.stringify(parsed));
      }
      return hasActiveLock;
    } catch {
      return false;
    }
  }

  function openGangHeatPanelOrRaidImpactModal() {
    return getPoliceHeatController()?.openGangHeatPanelOrRaidImpactModal?.();
  }

  function handleGangHeatReduction(mode) {
    return getPoliceHeatController()?.handleGangHeatReduction?.(mode);
  }

  function initGangHeatModal() {
    return getPoliceHeatController()?.initGangHeatModal?.();
  }

  function setGuestMode(isGuest) {
    return getAuthSessionController()?.setGuestMode?.(isGuest);
  }

  function refreshGuestBannerVisibility() {
    return getAuthSessionController()?.refreshGuestBannerVisibility?.();
  }

  function initProfileModal() {
    const controller = getProfileModalController();
    if (controller?.initProfileModal) {
      return controller.initProfileModal();
    }
  }

  function getAllianceModalController() {
    return getAllianceFacade()?.getAllianceModalController?.() || null;
  }

  function initAllianceModal() {
    return getAllianceFacade()?.initAllianceModal?.();
  }

  function getAllianceIconOption(iconKey) {
    return getAllianceDisplayHelpers()?.getAllianceIconOption?.(iconKey)
      || ALLIANCE_ICON_OPTIONS[0];
  }

  function normalizeAllianceNameKey(value) {
    return getAllianceDisplayHelpers()?.normalizeAllianceNameKey?.(value) || normalizeOwnerName(value);
  }

  function normalizeAllianceIconKey(value) {
    return getAllianceDisplayHelpers()?.normalizeAllianceIconKey?.(value) || getAllianceIconOption(value).key;
  }

  function setAllianceIconMap(targetMap, entries) {
    return getAllianceDisplayHelpers()?.setAllianceIconMap?.(targetMap, entries);
  }

  function resolveAllianceIconKeyByName(allianceName) {
    return getAllianceDisplayHelpers()?.resolveAllianceIconKeyByName?.(allianceName) || null;
  }

  function escapeAllianceMarkup(value) {
    return getAllianceDisplayHelpers()?.escapeAllianceMarkup?.(value) || "";
  }

  function renderAllianceIdentityMarkup(alliance) {
    return getAllianceDisplayHelpers()?.renderAllianceIdentityMarkup?.(alliance) || "";
  }

  function formatAllianceError(errorKey) {
    return getAllianceDisplayHelpers()?.formatAllianceError?.(errorKey) || String(errorKey || "Neznámá chyba.");
  }

  function computeLocalAllianceReadyState(readyAt) {
    return getAllianceDisplayHelpers()?.computeLocalAllianceReadyState?.(readyAt) || {
      readyAt: readyAt || null,
      readyDueAt: null,
      isReadyWindowActive: false,
      isReadyOverdue: true
    };
  }

  function formatAllianceDueLabel(isoValue) {
    return getAllianceDisplayHelpers()?.formatAllianceDueLabel?.(isoValue) || "READY chybí";
  }

  function formatAllianceDueLabelSeconds(isoValue) {
    return getAllianceDisplayHelpers()?.formatAllianceDueLabelSeconds?.(isoValue) || "00:00:00";
  }

  function formatAllianceRelativeTime(isoValue) {
    return getAllianceDisplayHelpers()?.formatAllianceRelativeTime?.(isoValue) || "-";
  }

  function countOwnedDistrictsForAllianceMember(memberName) {
    return getAllianceDisplayHelpers()?.countOwnedDistrictsForAllianceMember?.(memberName) || 0;
  }

  function getAllianceMemberVisualData(member) {
    return getAllianceDisplayHelpers()?.getAllianceMemberVisualData?.(member) || {
      sectorCount: 0,
      sectorLabel: "0 sektorů",
      faction: "-",
      avatar: "",
      color: null
    };
  }

  function renderAllianceMemberCard(member, kickVotes = []) {
    return getAllianceDisplayHelpers()?.renderAllianceMemberCard?.(member, kickVotes) || "";
  }

  function bindAllianceMemberAvatarLightbox(root = document) {
    return getAllianceDisplayHelpers()?.bindAllianceMemberAvatarLightbox?.(root);
  }

  function renderAllianceState(activeAlliance, alliances, incomingInvites = []) {
    const controller = getAllianceModalController();
    if (controller?.renderAllianceState) {
      return controller.renderAllianceState(activeAlliance, alliances, incomingInvites);
    }
  }

  function renderAllianceManagementState(activeAlliance) {
    const controller = getAllianceModalController();
    if (controller?.renderAllianceManagementState) {
      return controller.renderAllianceManagementState(activeAlliance);
    }
  }

  function resolveCurrentServerChatAuthorName() {
    return getAllianceChatHelpers()?.resolveCurrentServerChatAuthorName?.() || "Ty";
  }

  function collectServerChatParticipants(limit = 10) {
    return getAllianceChatHelpers()?.collectServerChatParticipants?.(limit) || [];
  }

  function normalizeServerChatMessages(rawMessages) {
    return getAllianceChatHelpers()?.normalizeServerChatMessages?.(rawMessages) || [];
  }

  function buildDefaultServerChatMessages() {
    return getAllianceChatHelpers()?.buildDefaultServerChatMessages?.() || [];
  }

  function getLocalServerChatMessages() {
    return getAllianceChatHelpers()?.getLocalServerChatMessages?.() || [];
  }

  function saveLocalServerChatMessages(messages) {
    return getAllianceChatHelpers()?.saveLocalServerChatMessages?.(messages);
  }

  function appendLocalServerChatMessage(message) {
    return getAllianceChatHelpers()?.appendLocalServerChatMessage?.(message) || [];
  }

  function renderGlobalServerChat(messages) {
    return getAllianceChatHelpers()?.renderGlobalServerChat?.(messages);
  }

  function renderAllianceChat(messages) {
    return getAllianceChatHelpers()?.renderAllianceChat?.(messages);
  }

  function buildAllianceTenBlackoutLocalAllianceState(ownerName, allyName) {
    return getAllianceStateHelpers()?.buildAllianceTenBlackoutLocalAllianceState?.(ownerName, allyName) || null;
  }

  function buildNightTwentyWarLocalAllianceState(ownerName, districts) {
    return getAllianceStateHelpers()?.buildNightTwentyWarLocalAllianceState?.(ownerName, districts) || null;
  }

  function syncBlackoutScenarioAllianceDistrictState(activeAlliance) {
    return getAllianceStateHelpers()?.syncBlackoutScenarioAllianceDistrictState?.(activeAlliance);
  }

  function getLocalAllianceState() {
    return getAllianceStateHelpers()?.getLocalAllianceState?.() || {
      activeAllianceId: null,
      alliances: [],
      requests: [],
      memberInvites: [],
      kickVotes: [],
      notifications: [],
      auditLogs: [],
      chat: [],
      activeAlliance: null,
      incomingInvites: []
    };
  }

  function saveLocalAllianceState(state) {
    return getAllianceStateHelpers()?.saveLocalAllianceState?.(state);
  }

  function withActiveAlliance(state) {
    return getAllianceStateHelpers()?.withActiveAlliance?.(state) || state;
  }

  function appendLocalAllianceChat(state, message) {
    return getAllianceStateHelpers()?.appendLocalAllianceChat?.(state, message);
  }

  function createLocalAlliance(state, options) {
    return getAllianceStateHelpers()?.createLocalAlliance?.(state, options) || null;
  }

  function requestLocalAllianceInvite(state, allianceId) {
    return getAllianceStateHelpers()?.requestLocalAllianceInvite?.(state, allianceId) || null;
  }

  function sendLocalAllianceManagementInvite(state, username) {
    return getAllianceStateHelpers()?.sendLocalAllianceManagementInvite?.(state, username) || null;
  }

  function leaveLocalAlliance(state) {
    return getAllianceStateHelpers()?.leaveLocalAlliance?.(state);
  }

  function respondToLocalAllianceRequest(state, requestId, accept) {
    return getAllianceStateHelpers()?.respondToLocalAllianceRequest?.(state, requestId, accept) || null;
  }

  function respondToLocalAllianceMemberInvite(state, inviteId, accept) {
    return getAllianceStateHelpers()?.respondToLocalAllianceMemberInvite?.(state, inviteId, accept) || null;
  }

  function markLocalAllianceReady(state) {
    return getAllianceStateHelpers()?.markLocalAllianceReady?.(state) || null;
  }

  function removeLocalAllianceMember(state, memberId) {
    return getAllianceStateHelpers()?.removeLocalAllianceMember?.(state, memberId) || null;
  }

  function startLocalAllianceKickVote(state, memberId) {
    return getAllianceStateHelpers()?.startLocalAllianceKickVote?.(state, memberId) || null;
  }

  function castLocalAllianceKickVote(state, voteId) {
    return getAllianceStateHelpers()?.castLocalAllianceKickVote?.(state, voteId) || null;
  }

  function syncGuestAllianceLabel(allianceName) {
    return getAllianceButtonHelpers()?.syncGuestAllianceLabel?.(allianceName);
  }

  function renderAllianceButtonLabel(button, label) {
    return getAllianceButtonHelpers()?.renderAllianceButtonLabel?.(button, label);
  }

  function setAllianceButtonState(allianceName) {
    return getAllianceButtonHelpers()?.setAllianceButtonState?.(allianceName);
  }

  function initSettingsModal() {
    return getSettingsModalController()?.initSettingsModal?.();
  }

  function initWeaponsModal() {
    return getInventoryController()?.initWeaponsModal?.();
  }

  function initMarketModal() {
    return getMarketFacade()?.initMarketModal?.();
  }

  async function openMarketModal(preferredTab = "server") {
    return getMarketFacade()?.openMarketModal?.(preferredTab);
  }

  function refreshMarketBuildingShortcuts() {
    return getMarketFacade()?.refreshMarketBuildingShortcuts?.();
  }

  function initMarketBuildingShortcuts() {
    return getMarketFacade()?.initMarketBuildingShortcuts?.();
  }

  function formatMarketResourceName(resourceKey) {
    return getMarketFacade()?.formatMarketResourceName?.(resourceKey)
      || MARKET_RESOURCE_LABELS[resourceKey]
      || String(resourceKey || "").replace(/_/g, " ");
  }

  function formatCompactMarketResourceName(resourceKey) {
    return getMarketFacade()?.formatCompactMarketResourceName?.(resourceKey)
      || formatMarketResourceName(resourceKey);
  }

  function renderMarketState(resourceKey, marketTab = "server") {
    return getMarketFacade()?.renderMarketState?.(resourceKey, marketTab);
  }

  async function handleMarketUpdate() {
    return getMarketFacade()?.handleMarketUpdate?.();
  }

  function getLocalMarketState() {
    return getMarketFacade()?.getLocalMarketState?.() || {};
  }

  function enforceLocalGuestStorageDefaults() {
    return getMarketFacade()?.enforceLocalGuestStorageDefaults?.();
  }

  function saveLocalMarketState(state) {
    return getMarketFacade()?.saveLocalMarketState?.(state);
  }

  function normalizeLocalMarketBalances(balances) {
    return getMarketFacade()?.normalizeLocalMarketBalances?.(balances);
  }

  function spendLocalMoney(balances, amount) {
    return getMarketFacade()?.spendLocalMoney?.(balances, amount) || false;
  }

  function addLocalMoney(balances, amount, bucket = "clean") {
    return getMarketFacade()?.addLocalMoney?.(balances, amount, bucket);
  }

  function getEconomySnapshotFromDom() {
    return getMarketFacade()?.getEconomySnapshotFromDom?.() || {};
  }

  function ensureEconomyCache() {
    return getMarketFacade()?.ensureEconomyCache?.() || {};
  }

  function getEconomySnapshot() {
    return getMarketFacade()?.getEconomySnapshot?.() || {};
  }

  function trySpendCash(amount) {
    return getMarketFacade()?.trySpendCash?.(amount) || { ok: false, reason: "unavailable" };
  }

  function trySpendCleanCash(amount) {
    return getMarketFacade()?.trySpendCleanCash?.(amount) || { ok: false, reason: "unavailable" };
  }

  function addCleanCash(amount) {
    return getMarketFacade()?.addCleanCash?.(amount) || 0;
  }

  function addDirtyCash(amount) {
    return getMarketFacade()?.addDirtyCash?.(amount) || 0;
  }

  function trySpendMaterials(amount) {
    return getMarketFacade()?.trySpendMaterials?.(amount) || { ok: false, reason: "unavailable" };
  }

  function addMaterials(amount) {
    return getMarketFacade()?.addMaterials?.(amount) || 0;
  }

  function addInfluence(amount) {
    return getMarketFacade()?.addInfluence?.(amount) || 0;
  }

  function readBountyEntries() {
    return [];
  }

  function saveBountyEntries(entries) {
    try {
      localStorage.removeItem(LOCAL_BOUNTY_STORAGE_KEY);
    } catch {}
    syncBountyDistrictMarkers([]);
    return [];
  }

  function hasPersistedBountyApi() {
    return Boolean(
      window.Empire?.token
      && window.Empire?.API?.getBounties
      && window.Empire?.API?.createBounty
      && window.Empire?.API?.claimBounties
    );
  }

  function resolveBountyCreatedAtValue(entry) {
    const raw = entry?.createdAt;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const parsed = Date.parse(String(raw || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function loadPersistedBounties() {
    syncBountyDistrictMarkers([]);
    return [];
  }

  async function createPersistedBounty(payload) {
    syncBountyDistrictMarkers([]);
    return { ok: false, bounties: [] };
  }

  function readDrugLabPlayerSupplyState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRUG_LAB_PLAYER_STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDrugLabPlayerSupplyState(state) {
    localStorage.setItem(DRUG_LAB_PLAYER_STORAGE_KEY, JSON.stringify(state && typeof state === "object" ? state : {}));
  }

  function readFactoryPlayerSuppliesState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FACTORY_PLAYER_SUPPLIES_STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeFactoryPlayerSuppliesState(state) {
    localStorage.setItem(FACTORY_PLAYER_SUPPLIES_STORAGE_KEY, JSON.stringify(state && typeof state === "object" ? state : {}));
  }

  function isGuestBlackoutScenarioActive() {
    return !window.Empire.token && isBlackoutLikeScenario();
  }

  function syncGuestBlackoutMarketBalancesFromEconomy() {
    if (!isGuestBlackoutScenarioActive()) return;
    const state = getLocalMarketState();
    const balances = state?.balances && typeof state.balances === "object" ? state.balances : null;
    if (!balances) return;
    const economySnapshot = ensureEconomyCache();
    const money = resolveMoneyBreakdown(economySnapshot || {});
    const nextCleanMoney = Math.max(0, Math.floor(Number(money.cleanMoney || 0)));
    const nextDirtyMoney = Math.max(0, Math.floor(Number(money.dirtyMoney || 0)));
    if (
      Number(balances.cleanMoney || 0) === nextCleanMoney
      && Number(balances.dirtyMoney || 0) === nextDirtyMoney
    ) {
      return;
    }
    balances.cleanMoney = nextCleanMoney;
    balances.dirtyMoney = nextDirtyMoney;
    balances.money = nextCleanMoney + nextDirtyMoney;
    saveLocalMarketState(state);
  }

  function applyGuestBlackoutCleanCashDelta(delta) {
    if (!isGuestBlackoutScenarioActive()) return null;
    syncGuestBlackoutMarketBalancesFromEconomy();
    const state = getLocalMarketState();
    const balances = state?.balances && typeof state.balances === "object" ? state.balances : null;
    if (!balances) return null;
    const current = Math.max(0, Math.floor(Number(balances.cleanMoney || 0)));
    const next = Math.max(0, current + Math.floor(Number(delta || 0)));
    const appliedDelta = next - current;
    balances.cleanMoney = next;
    balances.money = Math.max(0, Math.floor(Number(balances.cleanMoney || 0) + Number(balances.dirtyMoney || 0)));
    saveLocalMarketState(state);
    syncGuestEconomyFromMarket();
    return appliedDelta;
  }

  function applyGuestBlackoutInventoryDelta(balanceKey, delta) {
    if (!isGuestBlackoutScenarioActive()) return null;
    const state = getLocalMarketState();
    const balances = state?.balances && typeof state.balances === "object" ? state.balances : null;
    if (!balances) return null;
    const safeKey = String(balanceKey || "").trim();
    if (!safeKey) return null;
    const current = Math.max(0, Math.floor(Number(balances[safeKey] || 0)));
    const next = Math.max(0, current + Math.floor(Number(delta || 0)));
    const appliedDelta = next - current;
    balances[safeKey] = next;
    if (storageDrugTypes.some((item) => item.key === safeKey)) {
      balances.drugs = Math.max(0, Math.floor(Number(balances.drugs || 0) + appliedDelta));
    }
    if (factorySupplyTypes.some((item) => item.key === safeKey)) {
      balances.materials = Math.max(0, Math.floor(Number(balances.materials || 0) + appliedDelta));
    }
    saveLocalMarketState(state);
    syncGuestEconomyFromMarket();
    return appliedDelta;
  }

  function getLiveBountyEconomySnapshot() {
    if (isGuestBlackoutScenarioActive()) {
      syncBlackoutScenarioDistrictIncome();
      syncGuestBlackoutMarketBalancesFromEconomy();
      syncGuestEconomyFromMarket();
      const state = getLocalMarketState();
      const balances = state?.balances && typeof state.balances === "object" ? state.balances : {};
      return {
        ...getEconomySnapshot(),
        cleanMoney: Math.max(0, Math.floor(Number(balances.cleanMoney || 0))),
        dirtyMoney: Math.max(0, Math.floor(Number(balances.dirtyMoney || 0))),
        drugs: Math.max(0, Math.floor(Number(balances.drugs || 0))),
        materials: Math.max(0, Math.floor(Number(balances.materials || 0))),
        neonDust: Math.max(0, Math.floor(Number(balances.neonDust || 0))),
        pulseShot: Math.max(0, Math.floor(Number(balances.pulseShot || 0))),
        velvetSmoke: Math.max(0, Math.floor(Number(balances.velvetSmoke || 0))),
        ghostSerum: Math.max(0, Math.floor(Number(balances.ghostSerum || 0))),
        overdriveX: Math.max(0, Math.floor(Number(balances.overdriveX || 0))),
        metalParts: Math.max(0, Math.floor(Number(balances.metalParts || 0))),
        techCore: Math.max(0, Math.floor(Number(balances.techCore || 0))),
        combatModule: Math.max(0, Math.floor(Number(balances.combatModule || 0))),
        drugInventory: storageDrugTypes.reduce((acc, item) => {
          acc[item.key] = Math.max(0, Math.floor(Number(balances[item.key] || 0)));
          return acc;
        }, {})
      };
    }
    return getEconomySnapshot();
  }

  function getGuestBlackoutLiveBalances() {
    if (!isGuestBlackoutScenarioActive()) return null;
    const state = getLocalMarketState();
    const balances = state?.balances && typeof state.balances === "object" ? state.balances : null;
    return balances || null;
  }

  function getBountyResourceDefinitions() {
    return [
      ...pharmacySupplyTypes.map((item) => ({
        key: item.key,
        label: item.name,
        source: "pharmacy",
        group: "Lékárna"
      })),
      ...storageDrugTypes.map((item) => ({
        key: item.key,
        label: item.name,
        source: "drugLab",
        group: "Drug lab"
      })),
      ...factorySupplyTypes.map((item) => ({
        key: item.key,
        label: item.name,
        source: "factory",
        group: "Továrna"
      })),
      ...attackWeaponStats.map((item) => ({
        key: `attack:${item.name}`,
        label: item.name,
        source: "armoryAttack",
        group: "Zbrojovka"
      })),
      ...defenseWeaponStats.map((item) => ({
        key: `defense:${item.name}`,
        label: item.name,
        source: "armoryDefense",
        group: "Zbrojovka"
      }))
    ];
  }

  function getBountyAvailableResourceMap() {
    const economy = getLiveBountyEconomySnapshot();
    const drugLabPlayer = readDrugLabPlayerSupplyState();
    const labSupplies = drugLabPlayer?.labSupplies && typeof drugLabPlayer.labSupplies === "object"
      ? drugLabPlayer.labSupplies
      : {};
    const attackCounts = resolveWeaponCounts();
    const defenseCounts = resolveDefenseCounts();
    const availability = {
      clean_cash: Math.max(0, Math.floor(Number(economy.cleanMoney || 0)))
    };

    pharmacySupplyTypes.forEach((item) => {
      availability[item.key] = Math.max(0, Math.floor(Number(labSupplies[item.key] || 0)));
    });
    storageDrugTypes.forEach((item) => {
      availability[item.key] = Math.max(0, Math.floor(Number(economy?.drugInventory?.[item.key] || economy?.[item.key] || 0)));
    });
    factorySupplyTypes.forEach((item) => {
      availability[item.key] = Math.max(0, Math.floor(Number(economy?.[item.key] || 0)));
    });
    attackWeaponStats.forEach((item) => {
      availability[`attack:${item.name}`] = Math.max(0, Math.floor(Number(attackCounts[item.name] || 0)));
    });
    defenseWeaponStats.forEach((item) => {
      availability[`defense:${item.name}`] = Math.max(0, Math.floor(Number(defenseCounts[item.name] || 0)));
    });

    return availability;
  }

  function getBountyAggregateAvailabilityMap() {
    const economy = getLiveBountyEconomySnapshot();
    return {
      cash: Math.max(0, Math.floor(Number(economy.cleanMoney || 0))),
      drugs: Math.max(0, Math.floor(Number(economy.drugs || 0))),
      materials: Math.max(0, Math.floor(Number(economy.materials || 0)))
    };
  }

  function formatBountyExpiryLabel(value) {
    const expiresAt = Date.parse(String(value || ""));
    if (!Number.isFinite(expiresAt)) return "-";
    return new Date(expiresAt).toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function spendBountyResource(resourceKey, amount) {
    const key = String(resourceKey || "").trim();
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!key || value <= 0) return { ok: true, spent: 0 };

    if (key === "cash_bundle") {
      if (isGuestBlackoutScenarioActive()) {
        const appliedDelta = applyGuestBlackoutCleanCashDelta(-value);
        if (appliedDelta == null || Math.abs(appliedDelta) < value) {
          if (appliedDelta != null && appliedDelta < 0) applyGuestBlackoutCleanCashDelta(-appliedDelta);
          return { ok: false, reason: "insufficient_clean_cash", available: Math.abs(appliedDelta || 0) };
        }
        return { ok: true, spent: value, cleanSpent: value, dirtySpent: 0 };
      }
      return trySpendCleanCash(value);
    }

    if (key === "material_bundle") {
      const removed = removeEconomyResource("materials", value);
      if (removed < value) {
        if (removed > 0) addEconomyResource("materials", removed);
        return { ok: false, reason: "insufficient_resource", available: removed };
      }
      return { ok: true, spent: value };
    }

    if (key === "drug_bundle") {
      let remaining = value;
      let removedTotal = 0;
      for (const drug of storageDrugTypes) {
        if (remaining <= 0) break;
        const available = Math.max(0, Math.floor(Number(getEconomySnapshot()?.drugInventory?.[drug.key] || getEconomySnapshot()?.[drug.key] || 0)));
        const toRemove = Math.min(available, remaining);
        if (toRemove <= 0) continue;
        const removed = removeEconomyResource(drug.key, toRemove);
        removedTotal += removed;
        remaining -= removed;
      }
      if (removedTotal < value) {
        if (removedTotal > 0) {
          addEconomyResource(storageDrugTypes[0]?.key || "neonDust", removedTotal);
        }
        return { ok: false, reason: "insufficient_resource", available: removedTotal };
      }
      hydrateStorageModalValues();
      return { ok: true, spent: value };
    }

    if (key === "clean_cash") {
      if (isGuestBlackoutScenarioActive()) {
        const appliedDelta = applyGuestBlackoutCleanCashDelta(-value);
        if (appliedDelta == null || Math.abs(appliedDelta) < value) {
          if (appliedDelta != null && appliedDelta < 0) applyGuestBlackoutCleanCashDelta(-appliedDelta);
          return { ok: false, reason: "insufficient_clean_cash", available: Math.abs(appliedDelta || 0) };
        }
        return { ok: true, spent: value, cleanSpent: value, dirtySpent: 0 };
      }
      return trySpendCleanCash(value);
    }

    if (pharmacySupplyTypes.some((item) => item.key === key)) {
      const playerState = readDrugLabPlayerSupplyState();
      const nextSupplies = playerState?.labSupplies && typeof playerState.labSupplies === "object"
        ? { ...playerState.labSupplies }
        : {};
      const available = Math.max(0, Math.floor(Number(nextSupplies[key] || 0)));
      if (available < value) {
        return { ok: false, reason: "insufficient_resource", available };
      }
      nextSupplies[key] = available - value;
      writeDrugLabPlayerSupplyState({
        ...playerState,
        labSupplies: nextSupplies
      });
      hydrateStorageModalValues();
      return { ok: true, spent: value };
    }

    if (storageDrugTypes.some((item) => item.key === key)) {
      if (isGuestBlackoutScenarioActive()) {
        const appliedDelta = applyGuestBlackoutInventoryDelta(key, -value);
        if (appliedDelta == null || Math.abs(appliedDelta) < value) {
          if (appliedDelta != null && appliedDelta < 0) applyGuestBlackoutInventoryDelta(key, -appliedDelta);
          return { ok: false, reason: "insufficient_resource", available: Math.abs(appliedDelta || 0) };
        }
        hydrateStorageModalValues();
        return { ok: true, spent: value };
      }
      const resourceKeyMapped = storageDrugTypes.find((item) => item.key === key)?.resourceKey || key;
      const removed = removeEconomyResource(resourceKeyMapped, value);
      if (removed < value) {
        if (removed > 0) addEconomyResource(resourceKeyMapped, removed);
        return { ok: false, reason: "insufficient_resource", available: removed };
      }
      hydrateStorageModalValues();
      return { ok: true, spent: value };
    }

    if (factorySupplyTypes.some((item) => item.key === key)) {
      if (isGuestBlackoutScenarioActive()) {
        const appliedDelta = applyGuestBlackoutInventoryDelta(key, -value);
        if (appliedDelta == null || Math.abs(appliedDelta) < value) {
          if (appliedDelta != null && appliedDelta < 0) applyGuestBlackoutInventoryDelta(key, -appliedDelta);
          return { ok: false, reason: "insufficient_resource", available: Math.abs(appliedDelta || 0) };
        }
        const nextFactorySupplies = {
          ...readFactoryPlayerSuppliesState()
        };
        nextFactorySupplies[key] = Math.max(0, Math.floor(Number(nextFactorySupplies[key] || 0) - value));
        writeFactoryPlayerSuppliesState(nextFactorySupplies);
        hydrateStorageModalValues();
        return { ok: true, spent: value };
      }
      const marketKey =
        key === "metalParts" ? "metal_parts"
        : key === "techCore" ? "tech_core"
        : "combat_module";
      const removed = removeEconomyResource(marketKey, value);
      if (removed < value) {
        if (removed > 0) addEconomyResource(marketKey, removed);
        return { ok: false, reason: "insufficient_resource", available: removed };
      }
      const nextFactorySupplies = {
        ...readFactoryPlayerSuppliesState()
      };
      nextFactorySupplies[key] = Math.max(0, Math.floor(Number(nextFactorySupplies[key] || 0) - value));
      writeFactoryPlayerSuppliesState(nextFactorySupplies);
      hydrateStorageModalValues();
      return { ok: true, spent: value };
    }

    if (key.startsWith("attack:")) {
      const weaponName = key.slice("attack:".length);
      const available = Math.max(0, Math.floor(Number(resolveWeaponCounts()?.[weaponName] || 0)));
      if (available < value) {
        return { ok: false, reason: "insufficient_resource", available };
      }
      consumeAttackWeaponCounts({ [weaponName]: value });
      return { ok: true, spent: value };
    }

    if (key.startsWith("defense:")) {
      const defenseName = key.slice("defense:".length);
      const available = Math.max(0, Math.floor(Number(resolveDefenseCounts()?.[defenseName] || 0)));
      if (available < value) {
        return { ok: false, reason: "insufficient_resource", available };
      }
      const current = resolveDefenseCounts();
      current[defenseName] = Math.max(0, Math.floor(Number(current[defenseName] || 0) - value));
      persistDefenseCounts(current);
      return { ok: true, spent: value };
    }

    return { ok: false, reason: "unsupported_resource", available: 0 };
  }

  function syncBountyDistrictMarkers(entries = readBountyEntries()) {
    if (window.Empire.Map?.setBountyDistrictMarkers) {
      window.Empire.Map.setBountyDistrictMarkers([]);
    }
  }

  function grantBountyReward(resourceKey, amount) {
    const key = String(resourceKey || "").trim();
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!key || value <= 0) return;
    restoreBountyResource(key, value);
  }

  async function claimMatchingBountiesForOccupation(district, previousOwnerName) {
    if (window.Empire.Bounty?.claimMatchingBountiesForOccupation) {
      return window.Empire.Bounty.claimMatchingBountiesForOccupation(district, previousOwnerName);
    }
    return { claimedEntries: [], rewardSummary: "" };
  }

  function restoreBountyResource(resourceKey, amount) {
    const key = String(resourceKey || "").trim();
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!key || value <= 0) return;

    if (key === "cash_bundle") {
      if (isGuestBlackoutScenarioActive()) {
        applyGuestBlackoutCleanCashDelta(value);
        return;
      }
      addCleanCash(value);
      return;
    }
    if (key === "material_bundle") {
      addEconomyResource("materials", value);
      return;
    }
    if (key === "drug_bundle") {
      addEconomyResource(storageDrugTypes[0]?.key || "neonDust", value);
      hydrateStorageModalValues();
      return;
    }

    if (key === "clean_cash") {
      if (isGuestBlackoutScenarioActive()) {
        applyGuestBlackoutCleanCashDelta(value);
        return;
      }
      addCleanCash(value);
      return;
    }
    if (pharmacySupplyTypes.some((item) => item.key === key)) {
      const playerState = readDrugLabPlayerSupplyState();
      const nextSupplies = playerState?.labSupplies && typeof playerState.labSupplies === "object"
        ? { ...playerState.labSupplies }
        : {};
      nextSupplies[key] = Math.max(0, Math.floor(Number(nextSupplies[key] || 0) + value));
      writeDrugLabPlayerSupplyState({
        ...playerState,
        labSupplies: nextSupplies
      });
      hydrateStorageModalValues();
      return;
    }
    if (storageDrugTypes.some((item) => item.key === key)) {
      if (isGuestBlackoutScenarioActive()) {
        applyGuestBlackoutInventoryDelta(key, value);
        hydrateStorageModalValues();
        return;
      }
      const resourceKeyMapped = storageDrugTypes.find((item) => item.key === key)?.resourceKey || key;
      addEconomyResource(resourceKeyMapped, value);
      hydrateStorageModalValues();
      return;
    }
    if (factorySupplyTypes.some((item) => item.key === key)) {
      if (isGuestBlackoutScenarioActive()) {
        applyGuestBlackoutInventoryDelta(key, value);
        const nextFactorySupplies = {
          ...readFactoryPlayerSuppliesState()
        };
        nextFactorySupplies[key] = Math.max(0, Math.floor(Number(nextFactorySupplies[key] || 0) + value));
        writeFactoryPlayerSuppliesState(nextFactorySupplies);
        hydrateStorageModalValues();
        return;
      }
      const marketKey =
        key === "metalParts" ? "metal_parts"
        : key === "techCore" ? "tech_core"
        : "combat_module";
      addEconomyResource(marketKey, value);
      const nextFactorySupplies = {
        ...readFactoryPlayerSuppliesState()
      };
      nextFactorySupplies[key] = Math.max(0, Math.floor(Number(nextFactorySupplies[key] || 0) + value));
      writeFactoryPlayerSuppliesState(nextFactorySupplies);
      hydrateStorageModalValues();
      return;
    }
    if (key.startsWith("attack:")) {
      addCraftedWeapons({ [key.slice("attack:".length)]: value });
      return;
    }
    if (key.startsWith("defense:")) {
      addCraftedDefense({ [key.slice("defense:".length)]: value });
    }
  }

  function collectBountyEligiblePlayers() {
    const ownOwnerNames = getPlayerOwnerNameSet();
    const ownName = resolveCurrentPlayerOwnerKey();
    const localAllianceState = !window.Empire.token ? getLocalAllianceState() : null;
    const activeAlliance = localAllianceState?.activeAlliance || null;
    const activeAllianceName = extractAllianceDisplayName(
      activeAlliance?.name
      || cachedProfile?.alliance
      || window.Empire.player?.alliance
      || "Žádná"
    );
    const alliedPlayers = new Set([
      ...Array.from(getActiveAllianceOwnerNames()),
      ...Array.from(ownOwnerNames)
    ]);
    (
      (Array.isArray(activeAlliance?.members) ? activeAlliance.members : [])
        .map((member) => normalizeOwnerName(member?.username))
        .filter(Boolean)
    ).forEach((memberName) => alliedPlayers.add(memberName));
    if (ownName) alliedPlayers.add(ownName);

    const byName = new Map();
    const pushCandidate = (name, allianceName = "Bez aliance", districtCountDelta = 0, avatar = "") => {
      const safeName = String(name || "").trim();
      const normalized = normalizeOwnerName(safeName);
      if (!normalized || alliedPlayers.has(normalized)) return;
      const current = byName.get(normalized) || {
        name: safeName,
        allianceName: String(allianceName || "").trim() || "Bez aliance",
        districtCount: 0,
        avatar: String(avatar || "").trim()
      };
      current.districtCount = Math.max(0, Math.floor(Number(current.districtCount || 0) + Number(districtCountDelta || 0)));
      if (!current.allianceName || current.allianceName === "Bez aliance") {
        current.allianceName = String(allianceName || "").trim() || "Bez aliance";
      }
      if (!current.avatar) {
        current.avatar = String(avatar || "").trim();
      }
      byName.set(normalized, current);
    };

    const mapOwners = new Map();
    (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).forEach((district) => {
      const ownerName = String(
        district?.ownerNick
        || district?.owner_username
        || district?.ownerUsername
        || district?.owner
        || ""
      ).trim();
      const normalized = normalizeOwnerName(ownerName);
      if (!normalized || alliedPlayers.has(normalized)) return;
      const current = mapOwners.get(normalized) || {
        name: ownerName,
        allianceName: String(
          district?.ownerAllianceName
          || district?.owner_alliance_name
          || ""
        ).trim() || "Bez aliance",
        districtCount: 0,
        avatar: String(district?.ownerAvatar || "").trim()
      };
      current.districtCount += 1;
      if (!current.avatar) current.avatar = String(district?.ownerAvatar || "").trim();
      if (!current.allianceName || current.allianceName === "Bez aliance") {
        current.allianceName = String(
          district?.ownerAllianceName
          || district?.owner_alliance_name
          || ""
        ).trim() || "Bez aliance";
      }
      mapOwners.set(normalized, current);
    });

    Array.from(mapOwners.values()).forEach((entry) => {
      pushCandidate(
        entry.name,
        entry.allianceName,
        entry.districtCount,
        entry.avatar
      );
    });

    if (isBlackoutLikeScenario() || scenarioVisionEnabled) {
      Array.from(getActiveEnemyOwnerNames()).forEach((enemyOwner) => {
        const normalizedEnemy = normalizeOwnerName(enemyOwner);
        if (!normalizedEnemy || alliedPlayers.has(normalizedEnemy)) return;
        const mapEntry = mapOwners.get(normalizedEnemy);
        pushCandidate(
          mapEntry?.name || enemyOwner,
          mapEntry?.allianceName || "Bez aliance",
          mapEntry?.districtCount || 0,
          mapEntry?.avatar || ""
        );
      });
    }

    if (window.Empire.token) {
      (Array.isArray(window.Empire.leaderboardServerPlayers) ? window.Empire.leaderboardServerPlayers : []).forEach((player) => {
        const safeId = String(player?.id || "");
        if (safeId.startsWith("leaderboard-")) return;
        const playerName = String(player?.name || player?.nick || "").trim();
        const districtCount = Math.max(0, Math.floor(Number(player?.districtCount || player?.ownedDistrictCount || 0)));
        pushCandidate(playerName, "Bez aliance", districtCount, String(player?.avatar || "").trim());
      });
    }

    const safeActiveAllianceName = extractAllianceDisplayName(activeAllianceName || "Žádná");
    const compareAllianceName = safeActiveAllianceName
      && safeActiveAllianceName !== "Žádná"
      && safeActiveAllianceName !== "Bez aliance";

    let result = Array.from(byName.values())
      .filter((player) => !ownOwnerNames.has(normalizeOwnerName(player?.name)))
      .filter((player) => {
        if (!compareAllianceName) return true;
        const playerAllianceName = extractAllianceDisplayName(player?.allianceName || "Bez aliance");
        return playerAllianceName !== safeActiveAllianceName;
      })
      .filter((player) => Math.max(0, Math.floor(Number(player?.districtCount || 0))) > 0 || !scenarioVisionEnabled)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "cs"));

    if (!result.length && (isBlackoutLikeScenario() || scenarioVisionEnabled)) {
      const fallback = [];
      const seen = new Set();
      (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).forEach((district) => {
        const ownerName = String(
          district?.ownerNick
          || district?.owner_username
          || district?.ownerUsername
          || district?.owner
          || ""
        ).trim();
        const normalized = normalizeOwnerName(ownerName);
        if (!normalized || ownOwnerNames.has(normalized) || alliedPlayers.has(normalized) || seen.has(normalized)) return;
        const districtCount = (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).filter((entry) => normalizeOwnerName(
          entry?.ownerNick
          || entry?.owner_username
          || entry?.ownerUsername
          || entry?.owner
        ) === normalized).length;
        fallback.push({
          name: ownerName,
          allianceName: String(district?.ownerAllianceName || district?.owner_alliance_name || "").trim() || "Bez aliance",
          districtCount,
          avatar: String(district?.ownerAvatar || "").trim()
        });
        seen.add(normalized);
      });
      result = fallback.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "cs"));
    }

    if (!result.length && isBlackoutLikeScenario()) {
      result = [{
        name: "Mariah",
        allianceName: "Bez aliance",
        districtCount: 1,
        avatar: ""
      }];
    }

    return result;
  }

  function launderDirtyCash(portion) {
    return getMarketFacade()?.launderDirtyCash?.(portion) || 0;
  }

  function makeSeedOrder(resourceKey, side, remainingQuantity, pricePerUnit, username) {
    return {
      id: `seed-${resourceKey}-${side}-${username}-${pricePerUnit}`,
      resourceKey,
      side,
      remainingQuantity,
      pricePerUnit,
      username,
      createdAt: Date.now()
    };
  }

  function resourceKeyToBalanceKey(resourceKey) {
    const mapping = {
      data_shards: "dataShards",
      neon_dust: "neonDust",
      pulse_shot: "pulseShot",
      velvet_smoke: "velvetSmoke",
      ghost_serum: "ghostSerum",
      overdrive_x: "overdriveX",
      stim_pack: "stimPack",
      metal_parts: "metalParts",
      tech_core: "techCore",
      combat_module: "combatModule",
      baseball_bat: "baseballBat",
      street_pistol: "streetPistol",
      bulletproof_vest: "bulletproofVest",
      steel_barricades: "steelBarricades",
      security_cameras: "securityCameras",
      auto_mg_nest: "autoMgNest",
      alarm_system: "alarmSystem"
    };
    return mapping[resourceKey] || resourceKey;
  }

  function addEconomyResource(resourceKey, amount) {
    return getMarketEconomyController()?.addEconomyResource?.(resourceKey, amount) || 0;
  }

  function removeEconomyResource(resourceKey, amount) {
    return getMarketEconomyController()?.removeEconomyResource?.(resourceKey, amount) || 0;
  }

  function readOwnerRaidStorageState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OWNER_RAID_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveOwnerRaidStorageState(state) {
    localStorage.setItem(OWNER_RAID_STORAGE_KEY, JSON.stringify(state && typeof state === "object" ? state : {}));
  }

  function seedOwnerRaidInventory(ownerName) {
    const normalizedOwner = normalizeOwnerName(ownerName);
    const districts = (Array.isArray(window.Empire.districts) ? window.Empire.districts : []).filter(
      (district) => normalizeOwnerName(district?.owner) === normalizedOwner
    );
    const ownedCount = Math.max(1, districts.length || 1);
    const seed = Math.abs(hashDistrictSeed(`${normalizedOwner}:${ownedCount}:raid-storage`));
    return {
      metal_parts: Math.max(20, 24 + ownedCount * 6 + (seed % 18)),
      tech_core: Math.max(8, 10 + ownedCount * 3 + (seed % 9)),
      combat_module: Math.max(3, 4 + Math.floor(ownedCount / 2) + (seed % 4)),
      drugs: Math.max(24, 30 + ownedCount * 7 + (seed % 25)),
      weapons: Math.max(18, 20 + ownedCount * 5 + (seed % 20))
    };
  }

  function getOwnerRaidInventory(ownerName) {
    const ownerKey = normalizeOwnerName(ownerName);
    if (!ownerKey) return {};
    const state = readOwnerRaidStorageState();
    if (!state[ownerKey] || typeof state[ownerKey] !== "object") {
      state[ownerKey] = seedOwnerRaidInventory(ownerName);
      saveOwnerRaidStorageState(state);
    }
    return { ...state[ownerKey] };
  }

  function updateOwnerRaidInventory(ownerName, updater) {
    const ownerKey = normalizeOwnerName(ownerName);
    if (!ownerKey) return {};
    const state = readOwnerRaidStorageState();
    const current = state[ownerKey] && typeof state[ownerKey] === "object"
      ? { ...state[ownerKey] }
      : seedOwnerRaidInventory(ownerName);
    const next = typeof updater === "function" ? updater(current) : current;
    state[ownerKey] = next && typeof next === "object" ? next : current;
    saveOwnerRaidStorageState(state);
    return { ...state[ownerKey] };
  }

  function readDistrictRaidStashState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DISTRICT_RAID_STASH_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveDistrictRaidStashState(state) {
    localStorage.setItem(DISTRICT_RAID_STASH_STORAGE_KEY, JSON.stringify(state && typeof state === "object" ? state : {}));
  }

  function getDistrictRaidStash(district) {
    const districtKey = String(district?.id || "").trim();
    if (!districtKey) return {};
    const state = readDistrictRaidStashState();
    if (!state[districtKey] || typeof state[districtKey] !== "object") {
      state[districtKey] = resolveEmptyDistrictRaidStash(district);
      saveDistrictRaidStashState(state);
    }
    return { ...state[districtKey] };
  }

  function updateDistrictRaidStash(district, updater) {
    const districtKey = String(district?.id || "").trim();
    if (!districtKey) return {};
    const state = readDistrictRaidStashState();
    const current = state[districtKey] && typeof state[districtKey] === "object"
      ? { ...state[districtKey] }
      : resolveEmptyDistrictRaidStash(district);
    const next = typeof updater === "function" ? updater(current) : current;
    state[districtKey] = next && typeof next === "object" ? next : current;
    saveDistrictRaidStashState(state);
    return { ...state[districtKey] };
  }

  function createLocalMarketOrder({ resourceKey, side, quantity, pricePerUnit }) {
    return getMarketEconomyController()?.createLocalMarketOrder?.({ resourceKey, side, quantity, pricePerUnit }) || { error: "unavailable" };
  }

  function cancelLocalMarketOrder(orderId) {
    return getMarketEconomyController()?.cancelLocalMarketOrder?.(orderId) || { error: "unavailable" };
  }

  function matchLocalMarketOrder(state, order) {
    return getMarketEconomyController()?.matchLocalMarketOrder?.(state, order);
  }

  function syncGuestEconomyFromMarket() {
    return getMarketEconomyController()?.syncGuestEconomyFromMarket?.();
  }

  function initWeaponsPopover() {
    return getInventoryController()?.initWeaponsPopover?.();
  }

  function openWeaponsModal(mode) {
    return getInventoryController()?.openWeaponsModal?.(mode);
  }

  function collectBlackoutMapPlayerSummaries() {
    const districts = Array.isArray(window.Empire.districts) ? window.Empire.districts : [];
    const ownOwnerNames = getPlayerOwnerNameSet();
    const players = new Map();
    districts.forEach((district) => {
      const ownerName = String(
        district?.ownerNick
        || district?.owner_username
        || district?.ownerUsername
        || district?.owner
        || ""
      ).trim();
      const normalized = normalizeOwnerName(ownerName);
      if (!normalized || ownOwnerNames.has(normalized)) return;
      const current = players.get(normalized) || {
        name: ownerName,
        districtCount: 0
      };
      current.districtCount += 1;
      players.set(normalized, current);
    });
    return Array.from(players.values())
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "cs"));
  }

  function hydrateProfileModal(profile) {
    const controller = getProfileModalController();
    if (controller?.hydrateProfileModal) {
      return controller.hydrateProfileModal(profile);
    }
  }

  function showProfileModal() {
    const controller = getProfileModalController();
    if (controller?.showProfileModal) {
      return controller.showProfileModal();
    }
  }

  function showSettingsModal() {
    return getSettingsModalController()?.showSettingsModal?.();
  }

  function getSettingsState() {
    return getSettingsModalController()?.getSettingsState?.() || {
      ...DEFAULT_SETTINGS,
      mapVisibilityMode: "all",
      mapAllianceSymbols: true
    };
  }

  function normalizeMapVisibilityMode(value) {
    return getSettingsModalController()?.normalizeMapVisibilityMode?.(value) || DEFAULT_SETTINGS.mapVisibilityMode;
  }

  function animateMoneyStatValue(element, delta) {
    if (!element || !delta) return;
    const nextClass = delta > 0 ? "is-money-up" : "is-money-down";
    element.classList.remove("is-money-up", "is-money-down");
    void element.offsetWidth;
    element.classList.add(nextClass);
    const existingTimer = moneyStatAnimationTimers.get(element);
    if (existingTimer) clearTimeout(existingTimer);
    const timerId = setTimeout(() => {
      element.classList.remove("is-money-up", "is-money-down");
      moneyStatAnimationTimers.delete(element);
    }, 1050);
    moneyStatAnimationTimers.set(element, timerId);
  }

  function parseMoneyValueFromElement(element) {
    if (!element) return 0;
    const raw = String(element.textContent || "").replace(/[^\d-]/g, "");
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  }

  function stopMoneyStatCounter(element) {
    if (!element) return;
    const activeInterval = moneyStatCountIntervals.get(element);
    if (activeInterval) {
      clearInterval(activeInterval);
      moneyStatCountIntervals.delete(element);
    }
  }

  function animateMoneyStatCounter(element, targetValue, options = {}) {
    if (!element) return;
    const safeTarget = Math.max(0, Math.floor(Number(targetValue) || 0));
    const prefix = String(options?.prefix ?? "$");
    stopMoneyStatCounter(element);
    let current = parseMoneyValueFromElement(element);
    if (current === safeTarget) {
      element.textContent = `${prefix}${safeTarget}`;
      return;
    }

    const direction = safeTarget > current ? 1 : -1;
    const intervalId = setInterval(() => {
      current += direction;
      element.textContent = `${prefix}${current}`;
      if (current === safeTarget) {
        clearInterval(intervalId);
        moneyStatCountIntervals.delete(element);
      }
    }, MONEY_STAT_COUNT_TICK_MS);
    moneyStatCountIntervals.set(element, intervalId);
  }

  function syncMoneyStatToCachedValue(element, value, options = {}) {
    if (!element) return;
    stopMoneyStatCounter(element);
    const activeTimer = moneyStatAnimationTimers.get(element);
    if (activeTimer) {
      clearTimeout(activeTimer);
      moneyStatAnimationTimers.delete(element);
    }
    element.classList.remove("is-money-up", "is-money-down");
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    const prefix = String(options?.prefix ?? "$");
    element.textContent = `${prefix}${safeValue}`;
  }

  function updateEconomy(economy, { instant = false } = {}) {
    const controller = getProfileStateController();
    if (controller?.updateEconomy) {
      return controller.updateEconomy(economy, { instant });
    }
  }

  function normalizeAttackWeaponLabel(name) {
    return getInventoryController()?.normalizeAttackWeaponLabel?.(name) || "";
  }

  function readLocalWeaponCounts() {
    return getInventoryController()?.readLocalWeaponCounts?.() || {};
  }

  function writeLocalWeaponCounts(store) {
    return getInventoryController()?.writeLocalWeaponCounts?.(store);
  }

  function persistWeaponCounts(store) {
    return getInventoryController()?.persistWeaponCounts?.(store);
  }

  function consumeAttackWeaponCounts(selectionCounts = {}) {
    return getInventoryController()?.consumeAttackWeaponCounts?.(selectionCounts) || {};
  }

  function restoreAttackWeaponCounts(selectionCounts = {}) {
    return getInventoryController()?.restoreAttackWeaponCounts?.(selectionCounts) || {};
  }

  function readLocalDefenseCounts() {
    return getInventoryController()?.readLocalDefenseCounts?.() || {};
  }

  function writeLocalDefenseCounts(store) {
    return getInventoryController()?.writeLocalDefenseCounts?.(store);
  }

  function persistDefenseCounts(store) {
    return getInventoryController()?.persistDefenseCounts?.(store);
  }

  function consumeDefenseWeaponCounts(selectionCounts = {}) {
    return getInventoryController()?.consumeDefenseWeaponCounts?.(selectionCounts) || {};
  }

  function resolveWeaponCounts() {
    return getInventoryController()?.resolveWeaponCounts?.() || {};
  }

  function getAttackWeaponTotal(counts = {}) {
    return getInventoryController()?.getAttackWeaponTotal?.(counts) || 0;
  }

  function syncWeaponStatCounter() {
    return getInventoryController()?.syncWeaponStatCounter?.();
  }

  function getDefenseWeaponTotal(counts = {}) {
    return getInventoryController()?.getDefenseWeaponTotal?.(counts) || 0;
  }

  function syncDefenseStatCounter() {
    return getInventoryController()?.syncDefenseStatCounter?.();
  }

  function addCraftedWeapons(weaponMap = {}) {
    return getInventoryController()?.addCraftedWeapons?.(weaponMap) || {};
  }

  function addCraftedDefense(weaponMap = {}) {
    return getInventoryController()?.addCraftedDefense?.(weaponMap) || {};
  }

  function updateWeaponsPopover() {
    return getInventoryController()?.updateWeaponsPopover?.();
  }

  function resolveDefenseCounts() {
    return getInventoryController()?.resolveDefenseCounts?.() || {};
  }

  function updateDefensePopover() {
    return getInventoryController()?.updateDefensePopover?.();
  }

  function updateDistrict(district) {
    if (!district) return;
    const name = document.getElementById("district-name");
    if (!name) return;
    const displayName = district.name || `${district.type} #${district.id}`;
    if (isDistrictDestroyed(district)) {
      document.getElementById("district-owner").textContent = "Nikdo (zničený)";
      document.getElementById("district-income").textContent = "0 / nepoužitelný";
      document.getElementById("district-influence").textContent = 0;
    } else {
      document.getElementById("district-owner").textContent = district.owner || "Neobsazeno";
      document.getElementById("district-income").textContent = `$${district.income || 0}/hod`;
      document.getElementById("district-influence").textContent = district.influence || 0;
    }
    name.textContent = displayName;
    refreshMarketBuildingShortcuts();
  }

  function updateRound(round) {
    return getRoundStatusController()?.updateRound?.(round);
  }

  function loadInfoWindowHistory() {
    getNotificationCenter()?.loadInfoWindowHistory?.();
  }

  function renderInfoWindowHistory() {
    getNotificationCenter()?.renderInfoWindowHistory?.();
  }

  function pushInfoWindowHistoryEntry({ title, text, rows } = {}) {
    getNotificationCenter()?.pushInfoWindowHistoryEntry?.({ title, text, rows });
  }

  function removeInfoWindowHistoryEntry(entryId) {
    getNotificationCenter()?.removeInfoWindowHistoryEntry?.(entryId);
  }

  function clearInfoWindowHistory() {
    getNotificationCenter()?.clearInfoWindowHistory?.();
  }

  function initInfoWindowHistoryControls() {
    getNotificationCenter()?.initInfoWindowHistoryControls?.();
  }

  function getRoundStatusSnapshot() {
    return getRoundStatusController()?.getRoundStatusSnapshot?.() || null;
  }

  function pushEvent(text) {
    getNotificationCenter()?.pushEvent?.(text);
  }

  function clearEventFeed() {
    getNotificationCenter()?.clearEventFeed?.();
  }

  function initEventFeedControls() {
    getNotificationCenter()?.initEventFeedControls?.();
  }

  return {
    assignDistrictMetadata,
    bootstrapGuestIndexMapView,
    evaluateDistrictActionAvailability,
    init,
    hydrateAfterAuth,
    updateProfile,
    updateEconomy,
    updateDistrict,
    updateRound,
    pushEvent,
    collectBountyEligiblePlayers,
    refreshMarketBuildingShortcuts,
    openMarketModal,
    handleMarketUpdate,
    getDistrictRaidLockRemainingMs,
    getRaidCooldownRemainingMs,
    getRoundStatusSnapshot,
    setGuestMode,
    initProfileModal,
    initSettingsModal,
    addGangMembers,
    getCurrentGangMembers,
    getSpyAvailabilitySnapshot,
    getEconomySnapshot,
    trySpendCash,
    trySpendCleanCash,
    trySpendMaterials,
    addCleanCash,
    addDirtyCash,
    addMaterials,
    addInfluence,
    launderDirtyCash,
    refreshProfilePopulation,
    addCraftedWeapons,
    addCraftedDefense,
    getDistrictDefenseSnapshot,
    getDistrictSpyIntel,
    hasCompleteSpyIntel,
    getDistrictTrapControlState,
    getActiveAttackCooldownRemainingMs,
    resolveAllianceIconKeyByName,
    openDistrictPoliceRaidWarningModal,
    openDistrictAttackInProgressModal
  };
})();

