window.Empire = window.Empire || {};

window.Empire.Map = (() => {
  const state = {
    canvas: null,
    ctx: null,
    tooltip: null,
    modal: null,
    districts: [],
    districtIndexById: new Map(),
    districtAdjacencyById: new Map(),
    baseDistrictTypeById: new Map(),
    roads: [],
    hoverId: null,
    selectedId: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    hasViewportOverride: false,
    isPanning: false,
    isPinching: false,
    touchMoved: false,
    lastTouchAt: 0,
    panStart: { x: 0, y: 0 },
    viewStart: { x: 0, y: 0 },
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchWorldCenter: null,
    mapImage: null,
    mapMode: "night",
    mapSize: { width: 1400, height: 900 },
    vision: {
      fogPreviewMode: false,
      alliedOwnerNames: new Set(),
      enemyOwnerNames: new Set(),
      allowEnemyModalIntelInFog: false,
      uniqueOwnerColors: false,
      districtBorderMode: "player",
      unknownNeutralFillEnabled: false,
      showDistrictBorders: true,
      showAllianceSymbols: true,
      districtVisibilityMode: "all"
    },
    alliancePatternCache: new Map(),
    distinctOwnerColorByName: new Map(),
    attackedDistricts: new Map(),
    policeDistrictActions: new Map(),
    spyDistrictActions: new Map(),
    raidDistrictActions: new Map(),
    bountyDistrictMarkers: new Map(),
    onboardingFocusDistrictId: null,
    onboardingFocusMode: "full",
    attackAnimationIntervalId: null,
    activeBuildingDetail: null,
    activeBuildingDetailTab: "stats",
    pendingDataCenterTarget: null
  };

  const DISTRICT_ATTACK_MARKER_DEFAULT_DURATION_MS = 8 * 60 * 1000;
  const DISTRICT_ATTACK_MARKER_MIN_DURATION_MS = 15 * 1000;
  const DISTRICT_ATTACK_MARKER_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
  const DISTRICT_POLICE_ACTION_DEFAULT_DURATION_MS = 60 * 60 * 1000;
  const DISTRICT_POLICE_ACTION_MIN_DURATION_MS = 60 * 60 * 1000;
  const DISTRICT_POLICE_ACTION_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
  const DISTRICT_POLICE_INCOME_PENALTY_PCT = 10;
  const POLICE_RAID_INCOME_PENALTY_STORAGE_KEY = "empire_police_raid_income_penalty_map_v1";
  const DISTRICT_SPY_ACTION_DEFAULT_DURATION_MS = 20 * 1000;
  const DISTRICT_SPY_ACTION_MIN_DURATION_MS = 5 * 1000;
  const DISTRICT_SPY_ACTION_MAX_DURATION_MS = 30 * 60 * 1000;
  const DISTRICT_RAID_ACTION_DEFAULT_DURATION_MS = 20 * 1000;
  const DISTRICT_RAID_ACTION_MIN_DURATION_MS = 5 * 1000;
  const DISTRICT_RAID_ACTION_MAX_DURATION_MS = 30 * 60 * 1000;
  const POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY = "empire_police_raid_prod_penalty_until_v1";
  const POLICE_RAID_PRODUCTION_PENALTY_PCT = 10;
  const POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY = "empire_police_raid_building_action_lock_v1";
  const DISTRICT_ATTACK_ANIMATION_INTERVAL_MS = 120;
  const DISTRICT_TOP_NO_DRAW_RATIO = 0.08;
  const DOWNTOWN_VERTICAL_OFFSET_RATIO = 0.04;
  const DOWNTOWN_WARP_RADIUS_X_RATIO = 0.42;
  const DOWNTOWN_WARP_RADIUS_Y_RATIO = 0.38;
  const MAP_MODE_STORAGE_KEY = "empire_map_mode_v1";
  const MAP_MODE_IMAGE_BY_KEY = Object.freeze({
    day: "../img/mapaden2.png",
    night: "../img/mapanoc.png",
    blackout: "../img/blackout.png"
  });
  const ALLIANCE_ICON_SYMBOL_BY_KEY = Object.freeze({
    crown_skull: "☠︎",
    crossed_knives: "⚔︎",
    broken_shield: "⛨",
    snake_dagger: "🐍︎",
    eye_triangle: "◉",
    flame: "🔥︎",
    spider: "🕷︎",
    lightning: "⚡︎",
    wolf_head: "🐺︎",
    broken_mask: "🎭︎"
  });

  const ownerPalette = [
    "rgba(244,114,182,0.34)",
    "rgba(168,85,247,0.34)",
    "rgba(45,212,191,0.34)",
    "rgba(56,189,248,0.35)",
    "rgba(250,204,21,0.34)"
  ];

  const enemyPalette = [
    "rgba(244,114,182,0.22)",
    "rgba(168,85,247,0.22)",
    "rgba(45,212,191,0.22)",
    "rgba(56,189,248,0.22)",
    "rgba(250,204,21,0.22)"
  ];

  const allyPalette = [
    "rgba(56,189,248,0.46)",
    "rgba(34,197,94,0.46)",
    "rgba(250,204,21,0.46)",
    "rgba(168,85,247,0.46)"
  ];

  const districtOwnerAvatarPool = [
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

  const parkImages = [
    "../img/park/u6568429269_abandoned_cyberpunk_city_park_at_night_overgrown__cd9ea708-7c9a-4e69-b5be-3a6fef6c66f8_0.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_city_park_at_night_neon_917cc19e-b454-41b6-94aa-86d5b38f751f_0.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_city_park_at_night_neon_917cc19e-b454-41b6-94aa-86d5b38f751f_2.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_city_park_at_night_neon_917cc19e-b454-41b6-94aa-86d5b38f751f_3.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_park_in_the_middle_of_a_1bcdf12d-0e40-43da-8917-5671e6fdafc6_0.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_park_in_the_middle_of_a_bba7cad8-8fa0-45eb-8f08-b10ca754da9f_3.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_park_in_the_middle_of_a_ca05a4a0-8207-478c-a7fb-2e315210fa60_2.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_park_in_the_middle_of_a_cfb7f673-84fa-469c-8158-40911aae18a6_0.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_underground_city_park_h_6cc910b5-951d-4778-96c4-33ce2a4b2d96_0.png",
    "../img/park/u6568429269_ultra_realistic_cyberpunk_underground_city_park_h_6cc910b5-951d-4778-96c4-33ce2a4b2d96_2.png",
    "../img/park/1.png",
    "../img/park/u6568429269_ultra_realistic_futuristic_cyberpunk_city_park_at_4e6e39a1-7ff7-4445-9365-b559a33df0ba_0.png"
  ];

  const downtownImages = [
    "../img/downtown/u6568429269_ultra_realistic_cyberpunk_downtown_district_at_ni_84a7bf7c-e03a-420b-9857-c421d73f33a8_1.png",
    "../img/downtown/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_dc550711-88c1-45c7-8ddb-316de1b5fd2a_3.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_1.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_2.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_3.png",
    "../img/downtown/1.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_9fd803d9-f679-43c7-b791-40f5f958e092_2.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_1.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_2.png",
    "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_3.png"
  ];

  const commercialImages = [
    "../img/commercial/u6568429269_ultra_realistic_crowded_cyberpunk_downtown_street_bf83567e-d1a3-4c69-a7d5-a3fb1424a11e_1.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_commercial_district_at__0bcf500a-879b-4a0d-a670-0b6c262016e7_0.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_commercial_district_at__0bcf500a-879b-4a0d-a670-0b6c262016e7_2.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_commercial_district_at__0bcf500a-879b-4a0d-a670-0b6c262016e7_3.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_low-income_residential__915a91cd-d3c4-4f62-a2b5-9fa9aaeae2f6_3.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_b75e77b8-4c90-473c-95c0-ba4c6c1456eb_0.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_b75e77b8-4c90-473c-95c0-ba4c6c1456eb_1.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_b75e77b8-4c90-473c-95c0-ba4c6c1456eb_2.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_b75e77b8-4c90-473c-95c0-ba4c6c1456eb_3.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_dc550711-88c1-45c7-8ddb-316de1b5fd2a_1.png",
    "../img/commercial/1.png",
    "../img/commercial/u6568429269_ultra_realistic_cyberpunk_residential_district_at_ebf246bf-a944-47da-9d77-35cd0c8cb70f_3.png",
    "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_32d9d42c-9397-4a7a-b58a-1d29d6a49940_1.png",
    "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_32d9d42c-9397-4a7a-b58a-1d29d6a49940_3.png",
    "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_3.png"
  ];

  const residentialImages = [
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_low-income_residential__915a91cd-d3c4-4f62-a2b5-9fa9aaeae2f6_0.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_low-income_residential__915a91cd-d3c4-4f62-a2b5-9fa9aaeae2f6_1.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_low-income_residential__915a91cd-d3c4-4f62-a2b5-9fa9aaeae2f6_2.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_low-income_residential__915a91cd-d3c4-4f62-a2b5-9fa9aaeae2f6_3.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_43c96961-b974-45bc-be97-11174e6e52f3_0.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_43c96961-b974-45bc-be97-11174e6e52f3_1.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_43c96961-b974-45bc-be97-11174e6e52f3_2.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_43c96961-b974-45bc-be97-11174e6e52f3_3.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_ebf246bf-a944-47da-9d77-35cd0c8cb70f_0.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_ebf246bf-a944-47da-9d77-35cd0c8cb70f_1.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_at_ebf246bf-a944-47da-9d77-35cd0c8cb70f_2.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_wi_cffdadea-d0bc-4bb6-b888-64e83e9d1a03_1.png",
    "../img/residental/u6568429269_ultra_realistic_cyberpunk_residential_district_wi_cffdadea-d0bc-4bb6-b888-64e83e9d1a03_3.png",
    "../img/residental/u6568429269_ultra_realistic_futuristic_cyberpunk_residential__f7a77fe8-ab6b-4dda-9a87-ce74f484cba5_0.png",
    "../img/residental/u6568429269_ultra_realistic_futuristic_cyberpunk_residential__f7a77fe8-ab6b-4dda-9a87-ce74f484cba5_1.png",
    "../img/residental/1.png",
    "../img/residental/u6568429269_ultra_realistic_futuristic_cyberpunk_residential__f7a77fe8-ab6b-4dda-9a87-ce74f484cba5_3.png"
  ];

  const industrialImages = [
    "../img/industrial/u6568429269_abandoned_cyberpunk_industrial_district_rusted_fa_ffa1ef94-6abe-4ea8-8522-43d3820a31a1_1.png",
    "../img/industrial/u6568429269_abandoned_cyberpunk_industrial_district_rusted_fa_ffa1ef94-6abe-4ea8-8522-43d3820a31a1_2.png",
    "../img/industrial/u6568429269_abandoned_cyberpunk_industrial_district_rusted_fa_ffa1ef94-6abe-4ea8-8522-43d3820a31a1_3.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_district_at__4d2b0b70-40d2-409a-9c48-f1e775e647a0_0.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_district_at__4d2b0b70-40d2-409a-9c48-f1e775e647a0_1.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_district_at__4d2b0b70-40d2-409a-9c48-f1e775e647a0_2.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_district_at__4d2b0b70-40d2-409a-9c48-f1e775e647a0_3.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_harbor_distr_a663b49c-fa89-417d-b6c4-923679ae9fe7_1.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_harbor_distr_a663b49c-fa89-417d-b6c4-923679ae9fe7_2.png",
    "../img/industrial/u6568429269_ultra_realistic_cyberpunk_industrial_harbor_distr_a663b49c-fa89-417d-b6c4-923679ae9fe7_3.png",
    "../img/industrial/u6568429269_ultra_realistic_futuristic_cyberpunk_industrial_c_a28bf0fd-ad5d-4eb8-bcb5-1ae5d11fc967_0.png",
    "../img/industrial/u6568429269_ultra_realistic_futuristic_cyberpunk_industrial_c_a28bf0fd-ad5d-4eb8-bcb5-1ae5d11fc967_1.png",
    "../img/industrial/u6568429269_ultra_realistic_futuristic_cyberpunk_industrial_c_a28bf0fd-ad5d-4eb8-bcb5-1ae5d11fc967_2.png",
    "../img/industrial/1.png"
  ];

  const districtImageOverrides = {
    "park:106": ["../img/park/1.png"],
    "commercial:10": ["../img/commercial/1.png"]
  };

  const APARTMENT_BLOCK_NAME = "Bytový blok";
  const APARTMENT_BLOCK_STORAGE_KEY = "empire_apartment_block_mechanics_v1";
  const APARTMENT_BLOCK_CONFIG = Object.freeze({
    maxLevel: 4,
    baseProductionPerCycle: 2,
    productionCycleMs: 10 * 60 * 1000,
    baseCapacity: 24,
    baseCleanIncomePerHour: 90,
    cleanIncomePerGangMemberPerHour: 0,
    baseDirtyIncomePerHour: 30,
    dirtyIncomePerGangMemberPerHour: 0,
    baseHeatPerDay: 5,
    recruitRange: { min: 5, max: 15 },
    actionCooldowns: {
      recruit: 3 * 60 * 60 * 1000,
      motivation: 6 * 60 * 60 * 1000,
      hiddenHousing: 8 * 60 * 60 * 1000
    },
    actionDurations: {
      motivation: 2 * 60 * 60 * 1000,
      hiddenHousing: 2 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 5000,
      3: 15000,
      4: 40000
    },
    upgradePctPerLevel: 0.1
  });

  const SCHOOL_BUILDING_NAME = "Škola";
  const SCHOOL_BUILDING_STORAGE_KEY = "empire_school_building_mechanics_v1";
  const SCHOOL_BUILDING_CONFIG = Object.freeze({
    maxLevel: 4,
    baseProductionPerCycle: 1,
    productionCycleMs: 10 * 60 * 1000,
    baseCapacity: 12,
    baseCleanIncomePerHour: 264,
    cleanIncomePerTenMembersPerHour: 0,
    baseDirtyIncomePerHour: 60,
    dirtyIncomePerTenMembersPerHour: 0,
    baseHeatPerDay: 2,
    baseDrugLabPassiveBonusPct: 10,
    chemistryBoostPct: 25,
    eveningHeatReductionPct: 20,
    lectureRange: { min: 4, max: 10 },
    actionCooldowns: {
      lecture: 3 * 60 * 60 * 1000,
      chemistry: 4 * 60 * 60 * 1000,
      evening: 6 * 60 * 60 * 1000
    },
    actionDurations: {
      chemistry: 2 * 60 * 60 * 1000,
      evening: 2 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 5000,
      3: 15000,
      4: 40000
    },
    upgradePctPerLevel: 0.1
  });

  const FITNESS_CLUB_NAME = "Fitness Club";
  const FITNESS_BUILDING_STORAGE_KEY = "empire_fitness_building_mechanics_v1";
  const FITNESS_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 260,
    baseDirtyIncomePerHour: 160,
    baseHeatPerDay: 4.5,
    baseInfluencePerHour: 26 / 24,
    gangTrainingAttackBoostPct: 10,
    gangTrainingDefenseBoostPct: 10,
    talentRecruitmentInfluenceBoostPct: 10,
    talentRecruitmentDistrictIncomeBoostPct: 2,
    dopingRushAttackBoostPct: 35,
    dopingCrashDefensePenaltyPct: 10,
    actionHeatAdded: {
      gangTraining: 5,
      talentRecruitment: 4,
      doping: 8
    },
    actionCooldowns: {
      gangTraining: 8 * 60 * 60 * 1000,
      talentRecruitment: 10 * 60 * 60 * 1000,
      doping: 12 * 60 * 60 * 1000
    },
    actionDurations: {
      gangTraining: 2 * 60 * 60 * 1000,
      talentRecruitmentInfluence: 2 * 60 * 60 * 1000,
      talentRecruitmentIncome: 4 * 60 * 60 * 1000,
      dopingRush: 1 * 60 * 60 * 1000,
      dopingCrash: 1 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 9000,
      3: 28000,
      4: 65000,
      5: 140000
    }
  });

  const CASINO_BUILDING_NAME = "Kasino";
  const CASINO_BUILDING_STORAGE_KEY = "empire_casino_building_mechanics_v1";
  const CASINO_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 300,
    baseDirtyIncomePerHour: 240,
    memberBonusPerTenMembersPerHour: 0,
    memberBonusCleanShare: 90 / 110,
    memberBonusDirtyShare: 20 / 110,
    baseHeatPerDay: 7,
    baseInfluencePerDay: 30,
    highStakesCashBoostMinPct: 50,
    highStakesCashBoostMaxPct: 150,
    vipIncomeBoostPct: 40,
    launderingPct: 20,
    launderingBonusPctLevel5: 10,
    cleanIncomeBonusPctLevel4: 20,
    gossipIntervalMsLevel3: 2 * 60 * 60 * 1000,
    actionHeatAdded: {
      highStakes: 10,
      laundering: 6,
      vipEvening: 7
    },
    actionCooldowns: {
      highStakes: 6 * 60 * 60 * 1000,
      laundering: 8 * 60 * 60 * 1000,
      vipEvening: 10 * 60 * 60 * 1000
    },
    actionDurations: {
      vipEvening: 2 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 15000,
      3: 45000,
      4: 100000,
      5: 220000
    },
    upgradePctPerLevel: 0.1
  });

  const ARCADE_BUILDING_NAME = "Herna";
  const ARCADE_BUILDING_STORAGE_KEY = "empire_arcade_building_mechanics_v1";
  const ARCADE_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 180,
    cleanIncomePerTenMembersPerHour: 0,
    baseDirtyIncomePerHour: 180,
    dirtyIncomePerTenMembersPerHour: 0,
    baseHeatPerDay: 5,
    baseInfluencePerDay: 20,
    actionBoosts: {
      tournamentIncomePct: 35,
      launderingPct: 10,
      nightRunDirtyIncomePct: 50,
      level3DirtyIncomePct: 15,
      level5PassiveLaunderingPct: 5
    },
    actionHeatAdded: {
      tournament: 5,
      laundering: 4,
      nightRun: 7
    },
    actionCooldowns: {
      tournament: 6 * 60 * 60 * 1000,
      laundering: 7 * 60 * 60 * 1000,
      nightRun: 8 * 60 * 60 * 1000
    },
    actionDurations: {
      tournament: 2 * 60 * 60 * 1000,
      nightRun: 1 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 10000,
      3: 30000,
      4: 70000,
      5: 150000
    },
    upgradePctPerLevel: 0.1
  });

  const AUTO_SALON_BUILDING_NAME = "Autosalon";
  const AUTO_SALON_BUILDING_STORAGE_KEY = "empire_auto_salon_building_mechanics_v1";
  const AUTO_SALON_BUILDING_CONFIG = Object.freeze({
    maxLevel: 4,
    baseCleanIncomePerHour: 300,
    cleanIncomePerTenMembersPerHour: 0,
    baseDirtyIncomePerHour: 60,
    dirtyIncomePerTenMembersPerHour: 0,
    baseHeatPerDay: 4,
    baseInfluencePerHour: 2,
    actionBoosts: {
      premiumOfferCleanIncomePct: 50,
      grayImportDirtyIncomePct: 80,
      fleetLogisticsPct: 20,
      fleetCleanBonusPerHour: 15
    },
    raidRiskPcts: {
      grayImport: 10
    },
    actionHeatAdded: {
      premiumOffer: 2,
      grayImport: 5,
      fleet: 3
    },
    actionCooldowns: {
      premiumOffer: 4 * 60 * 60 * 1000,
      grayImport: 6 * 60 * 60 * 1000,
      fleet: 5 * 60 * 60 * 1000
    },
    actionDurations: {
      premiumOffer: 2 * 60 * 60 * 1000,
      grayImport: 2 * 60 * 60 * 1000,
      fleet: 2 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 10000,
      3: 26000,
      4: 60000
    },
    upgradePctPerLevel: 0.1
  });

  const EXCHANGE_BUILDING_NAME = "Směnárna";
  const EXCHANGE_BUILDING_STORAGE_KEY = "empire_exchange_building_mechanics_v1";
  const EXCHANGE_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 200,
    cleanIncomePerTenMembersPerHour: 0,
    baseDirtyIncomePerHour: 100,
    dirtyIncomePerTenMembersPerHour: 0,
    baseHeatPerDay: 3.5,
    baseInfluencePerDay: 18,
    actionBoosts: {
      exchangeCashCost: 5000,
      exchangeMaterialsGain: 5,
      exchangeMaterialsCost: 5,
      exchangeCashGain: 4000,
      exchangeBetterConversionPctLevel3: 20,
      hiddenTransferCleanCashPct: 15,
      quickLiquidityCleanCash: 5000,
      cleanIncomeBonusPctLevel4: 20,
      heatReductionPctLevel5: 20,
      districtIncomeBonusPct: 0
    },
    actionHeatAdded: {
      exchange: 3,
      hiddenTransfer: 4,
      quickLiquidity: 5
    },
    actionCooldowns: {
      exchange: 6 * 60 * 60 * 1000,
      hiddenTransfer: 8 * 60 * 60 * 1000,
      quickLiquidity: 10 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 7000,
      3: 20000,
      4: 50000,
      5: 110000
    },
    upgradePctPerLevel: 0.1
  });

  const RESTAURANT_BUILDING_NAME = "Restaurace";
  const RESTAURANT_BUILDING_STORAGE_KEY = "empire_restaurant_building_mechanics_v1";
  const RESTAURANT_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 180,
    cleanIncomePerTenMembersPerHour: 0,
    baseDirtyIncomePerHour: 120,
    dirtyIncomePerTenMembersPerHour: 0,
    baseHeatPerDay: 3,
    baseInfluencePerDay: 14,
    actionBoosts: {
      gangDinnerDistrictIncomePct: 15,
      vipReservationCleanIncomePct: 30,
      vipReservationInfluencePct: 5,
      streetGossipRareChancePct: 30,
      level3RareChanceBonusPct: 15,
      level3AccuracyBonusPct: 25,
      level5ExtraGossipCount: 1,
      level5WeaknessRevealChancePct: 15,
      level4HeatReductionPct: 5
    },
    actionHeatAdded: {
      gangDinner: 4,
      vipReservation: 5,
      streetGossip: 3
    },
    actionCooldowns: {
      gangDinner: 8 * 60 * 60 * 1000,
      vipReservation: 8 * 60 * 60 * 1000,
      streetGossip: 6 * 60 * 60 * 1000
    },
    actionDurations: {
      gangDinner: 2 * 60 * 60 * 1000,
      vipReservation: 2 * 60 * 60 * 1000
    },
    upgradeCosts: {
      2: 6000,
      3: 18000,
      4: 40000,
      5: 90000
    },
    upgradePctPerLevel: 0.1
  });

  const CONVENIENCE_STORE_BUILDING_NAME = "Večerka";
  const CONVENIENCE_STORE_BUILDING_STORAGE_KEY = "empire_convenience_store_building_mechanics_v1";
  const CONVENIENCE_STORE_BUILDING_CONFIG = Object.freeze({
    maxLevel: 5,
    baseCleanIncomePerHour: 140,
    baseDirtyIncomePerHour: 100,
    baseHeatPerDay: 2.5,
    baseInfluencePerDay: 8,
    incomeBoostPctLevel2: 10,
    cleanIncomeBoostPctLevel3: 15,
    incomeBoostPctLevel4: 20,
    heatMultiplierLevel5: 0.7,
    actionBoosts: {
      nightSaleIncomePct: 25,
      coverOpsHeatReductionPct: 30
    },
    actionHeatAdded: {
      nightSale: 3,
      smallDeal: 4,
      coverOps: 2
    },
    actionCooldowns: {
      nightSale: 6 * 60 * 60 * 1000,
      smallDeal: 7 * 60 * 60 * 1000,
      coverOps: 10 * 60 * 60 * 1000
    },
    actionDurations: {
      nightSale: 4 * 60 * 60 * 1000,
      coverOps: 4 * 60 * 60 * 1000
    },
    smallDealNeonDustReward: 10,
    upgradeCosts: {
      2: 4000,
      3: 12000,
      4: 30000,
      5: 70000
    }
  });

  const SMUGGLING_TUNNEL_BUILDING_NAME = "Pašovací tunel";
  const STREET_DEALERS_BUILDING_NAME = "Pouliční dealeři";
  const STRIP_CLUB_BUILDING_NAME = "Strip club";
  const DATA_CENTER_BUILDING_NAME = "Datové centrum";
  const WAREHOUSE_BUILDING_NAME = "Sklad";
  const RESEARCH_CENTER_BUILDING_NAME = "Výzkumné centrum";
  const RECYCLING_CENTER_BUILDING_NAME = "Recyklační centrum";
  const SMUGGLING_TUNNEL_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 6000,
      3: 18000,
      4: 45000,
      5: 110000
    }),
    baseHeatPerDay: 4.3,
    incomeBoostPctLevel2: 10,
    incomeBoostPctLevel5: 30,
    dirtyIncomeBoostPctLevel4: 20,
    heatMultiplierLevel2: 0.95,
    heatMultiplierLevel4: 1.1,
    bigShipmentExtraDropsAtLevel3: 7,
    level5HeatIgnoreChancePct: 10,
    baseInfluencePerDay: 18,
    actions: Object.freeze({
      nightTransport: Object.freeze({
        cooldownMs: 6 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        dirtyIncomeBoostPct: 40,
        heatAdded: 6
      }),
      bigShipment: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        drugsReward: 13,
        heatAdded: 10
      }),
      rerouteFlow: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        parkIncomeBoostPct: 25,
        heatAdded: 8
      })
    })
  });
  const STREET_DEALERS_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 5000,
      3: 15000,
      4: 35000,
      5: 90000
    }),
    incomeBoostPctLevel2: 10,
    dirtyIncomeBoostPctLevel3: 15,
    incomeBoostPctLevel4: 20,
    incomeBoostPctLevel5: 30,
    heatMultiplierLevel4: 1.05,
    spyRewardAtLevel5: 1,
    baseInfluencePerDay: 3.5,
    passiveHeatPerTick: 1,
    passiveHeatIntervalMs: 5 * 60 * 1000,
    sales: Object.freeze({
      networkMaxCapacityPctPerExtraBuilding: 10,
      networkSpeedPctPerExtraBuilding: 5,
      slots: Object.freeze([
        Object.freeze({
          id: 1,
          resourceKey: "neonDust",
          label: "Neon Dust",
          baseSlotCap: 120,
          unitsPerHour: 600,
          dirtyCashPerUnit: 0.45
        }),
        Object.freeze({
          id: 2,
          resourceKey: "pulseShot",
          label: "Pulse Shot",
          baseSlotCap: 120,
          unitsPerHour: 600,
          dirtyCashPerUnit: 0.65
        }),
        Object.freeze({
          id: 3,
          resourceKey: "velvetSmoke",
          label: "Velvet Smoke",
          baseSlotCap: 120,
          unitsPerHour: 600,
          dirtyCashPerUnit: 0.85
        })
      ])
    }),
    actions: Object.freeze({
      salesBoost: Object.freeze({
        cooldownMs: 5 * 60 * 60 * 1000,
        durationMs: 3 * 60 * 60 * 1000,
        incomeBoostPct: 30,
        heatAdded: 4
      }),
      aggressivePush: Object.freeze({
        cooldownMs: 6 * 60 * 60 * 1000,
        durationMs: 60 * 60 * 1000,
        dirtyIncomeBoostPct: 70,
        heatAdded: 8
      }),
      territoryExpansion: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        incomeStackPct: 5,
        heatAdded: 5
      })
    })
  });
  const STREET_DEALERS_RESOURCE_KEYS = Object.freeze(
    STREET_DEALERS_CONFIG.sales.slots.map((slot) => String(slot.resourceKey || "").trim()).filter(Boolean)
  );
  const STRIP_CLUB_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 8000,
      3: 25000,
      4: 60000,
      5: 130000
    }),
    baseHeatPerDay: 5,
    baseInfluencePerDay: 28,
    incomeBoostPctLevel2: 10,
    cleanIncomeBoostPctLevel4: 20,
    vipBonusPctLevel3: 20,
    vipDoubleChancePctLevel5: 10,
    actions: Object.freeze({
      vipNight: Object.freeze({
        cooldownMs: 6 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        incomeBoostPct: 50,
        heatAdded: 6
      }),
      privateServices: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        dirtyCashBoost: 1500,
        influenceBoost: 10,
        rumorsMin: 4,
        rumorsMax: 8,
        heatAdded: 7
      }),
      dirtyDeals: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        targetIncomeBoostPct: 20,
        heatAdded: 9
      })
    })
  });
  const DATA_CENTER_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 12000,
      3: 35000,
      4: 80000,
      5: 180000
    }),
    baseHeatPerDay: 5.5,
    baseInfluencePerDay: 32,
    incomeBoostPctLevel2: 10,
    cleanIncomeBoostPctLevel4: 20,
    intelInfoBonusAtLevel3: 2,
    hackEffectBoostPctLevel5: 25,
    actions: Object.freeze({
      playerTracking: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        heatAdded: 6,
        minActions: 1,
        maxActions: 3
      }),
      hackIncome: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        incomeBoostPct: 20,
        heatAdded: 10
      }),
      dataBoost: Object.freeze({
        cooldownMs: 12 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        cooldownReductionPct: 15,
        heatAdded: 8
      })
    })
  });
  const WAREHOUSE_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 6000,
      3: 18000,
      4: 40000,
      5: 95000
    }),
    baseHeatPerDay: 2.8,
    baseInfluencePerDay: 14,
    incomeBoostPctLevel2: 10,
    incomeBoostPctLevel3: 15,
    incomeBoostPctLevel4: 20,
    extraMaterialsLevel5: 5,
    actions: Object.freeze({
      stockpile: Object.freeze({
        cooldownMs: 6 * 60 * 60 * 1000,
        randomMaterialsReward: 2,
        heatAdded: 3
      }),
      quickDistribution: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        actionsEffectBoostPct: 5,
        heatAdded: 5
      }),
      hiddenStorage: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        durationMs: 3 * 60 * 60 * 1000,
        raidProtectionPct: 20,
        heatAdded: 4
      })
    })
  });
  const RESEARCH_CENTER_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 10000,
      3: 30000,
      4: 75000,
      5: 160000
    }),
    baseHeatPerDay: 4.8,
    baseInfluencePerDay: 30,
    incomeBoostPctLevel2: 10,
    actionsEffectBoostPctLevel3: 15,
    productionBoostPctLevel4: 20,
    permanentProductionTimeReductionPctLevel5: 10,
    actions: Object.freeze({
      optimizeProduction: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        factoryArmorySpeedBoostPct: 30,
        heatAdded: 6
      }),
      experimentalSeries: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        durationMs: 60 * 60 * 1000,
        factoryArmoryProductionBoostPct: 50,
        failChancePct: 20,
        heatAdded: 9
      }),
      technologyUpgrade: Object.freeze({
        cooldownMs: 12 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        armoryDrugLabTimeReductionPct: 20,
        heatAdded: 7
      })
    })
  });
  const RECYCLING_CENTER_CONFIG = Object.freeze({
    maxLevel: 5,
    upgradeCosts: Object.freeze({
      2: 7000,
      3: 20000,
      4: 48000,
      5: 105000
    }),
    baseHeatPerDay: 4,
    baseInfluencePerDay: 16,
    incomeBoostPctLevel2: 10,
    extraWasteMaterialsLevel3: 1,
    cleanIncomeBoostPctLevel4: 20,
    heatMultiplierLevel4: 0.95,
    restorePctBase: 10,
    restorePctLevel5: 18,
    actions: Object.freeze({
      processWaste: Object.freeze({
        cooldownMs: 6 * 60 * 60 * 1000,
        randomMaterialsReward: 2,
        heatAdded: 3
      }),
      breakShipment: Object.freeze({
        cooldownMs: 8 * 60 * 60 * 1000,
        chemicalsReward: 2,
        metalPartsReward: 5,
        heatAdded: 5
      }),
      emergencyRecovery: Object.freeze({
        cooldownMs: 10 * 60 * 60 * 1000,
        heatAdded: 6
      })
    })
  });

  const PHARMACY_BUILDING_NAME = "Lékárna";
  const PHARMACY_BUILDING_STORAGE_KEY = "empire_pharmacy_building_mechanics_v1";
  const PHARMACY_CONFIG = Object.freeze({
    maxLevel: 14,
    baseCleanIncomePerHour: 0,
    baseDirtyIncomePerHour: 0,
    baseProductionPerHour: Object.freeze({
      chemicals: 300,
      biomass: 200,
      stimPack: 144
    }),
    slotStorageCaps: Object.freeze({
      chemicals: 20,
      biomass: 30,
      stimPack: 30
    }),
    baseHeatPerDay: 3,
    upgradePctPerLevel: 0.1,
    boostDurationMs: 2 * 60 * 60 * 1000,
    boosts: Object.freeze({
      recon: Object.freeze({
        resourceKey: "ghostSerum",
        resourceLabel: "Ghost Serum",
        drugCost: 1,
        spySpeedPct: 50,
        infoQualityPct: 30
      }),
      action: Object.freeze({
        resourceKey: "ghostSerum",
        resourceLabel: "Ghost Serum",
        drugCost: 1,
        attackSpeedPct: 25,
        stealSpeedPct: 25
      }),
      neuro: Object.freeze({
        resourceKey: "overdriveX",
        resourceLabel: "Overdrive X",
        drugCost: 1,
        activeActionsPct: 20,
        heatAdded: 3
      })
    })
  });
  const PHARMACY_RESOURCE_KEYS = Object.freeze(["chemicals", "biomass", "stimPack"]);
  const PHARMACY_SLOT_CONFIG = Object.freeze([
    Object.freeze({ id: 1, resourceKey: "chemicals", label: "Chemicals", basePerHour: PHARMACY_CONFIG.baseProductionPerHour.chemicals }),
    Object.freeze({ id: 2, resourceKey: "biomass", label: "Biomass", basePerHour: PHARMACY_CONFIG.baseProductionPerHour.biomass }),
    Object.freeze({ id: 3, resourceKey: "stimPack", label: "Stim Pack", basePerHour: PHARMACY_CONFIG.baseProductionPerHour.stimPack })
  ]);

  const FACTORY_BUILDING_NAME = "Továrna";
  const FACTORY_BUILDING_STORAGE_KEY = "empire_factory_building_mechanics_v1";
  const FACTORY_PLAYER_STORAGE_KEY = "empire_factory_player_supplies_v1";
  const FACTORY_CONFIG = Object.freeze({
    maxLevel: 14,
    baseProductionPerHour: Object.freeze({
      metalParts: 360,
      techCore: 200
    }),
    upgradePctPerLevel: 0.1,
    combatModule: Object.freeze({
      metalPartsCost: 4,
      techCoreCost: 3,
      durationMs: 15 * 60 * 1000,
      heatPerUnit: 1
    })
  });
  const PHARMACY_UNIT_CLEAN_COST = Object.freeze({
    chemicals: 20,
    biomass: 50,
    stimPack: 95
  });
  const FACTORY_SLOT_STORAGE_CAP = 20;
  const FACTORY_COMBAT_BOOSTS = Object.freeze({
    assault: Object.freeze({
      combatModuleCost: 2,
      durationMs: 2 * 60 * 60 * 1000,
      attackPowerPct: 30,
      heatAdded: 3
    }),
    rapid: Object.freeze({
      combatModuleCost: 3,
      durationMs: 90 * 60 * 1000,
      attackSpeedPct: 40,
      raidSpeedPct: 25,
      defensePenaltyPct: 10,
      heatAdded: 4
    }),
    breach: Object.freeze({
      combatModuleCost: 4,
      durationMs: 2 * 60 * 60 * 1000,
      destroyBuildingChancePct: 20,
      defenseIgnorePct: 15,
      policeInterventionRiskPct: 35,
      heatAdded: 5
    })
  });
  const FACTORY_RESOURCE_KEYS = Object.freeze(["metalParts", "techCore", "combatModule"]);
  const FACTORY_SLOT_CONFIG = Object.freeze([
    Object.freeze({ id: 1, resourceKey: "metalParts", label: "Metal Parts", mode: "produce" }),
    Object.freeze({ id: 2, resourceKey: "techCore", label: "Tech Core", mode: "produce" }),
    Object.freeze({ id: 3, resourceKey: "combatModule", label: "Combat Module", mode: "craft" })
  ]);

  const ARMORY_BUILDING_NAME = "Zbrojovka";
  const ARMORY_BUILDING_STORAGE_KEY = "empire_armory_building_mechanics_v1";
  const ARMORY_BASE_WEAPON_POWER = Object.freeze({
    attack: Object.freeze({
      baseballBat: 5,
      streetPistol: 10,
      grenade: 14,
      smg: 18,
      bazooka: 30
    }),
    defense: Object.freeze({
      bulletproofVest: 6,
      steelBarricades: 12,
      securityCameras: 6,
      autoMgNest: 20,
      alarmSystem: 10
    })
  });
  const ARMORY_CONFIG = Object.freeze({
    maxLevel: 14,
    upgradePctPerLevel: 0.1,
    weapons: Object.freeze({
      baseballBat: Object.freeze({
        id: "baseballBat",
        category: "attack",
        name: "Baseballová pálka",
        metalPartsCost: 2,
        techCoreCost: 0,
        durationMs: 8 * 1000,
        attackPower: ARMORY_BASE_WEAPON_POWER.attack.baseballBat,
        specialEffect: "Attack power 5",
        drawback: "Slabý damage, slabá proti obranným budovám",
        role: "Early game, rychlé farmení slabých distriktů",
        heatPerUnit: 0
      }),
      streetPistol: Object.freeze({
        id: "streetPistol",
        category: "attack",
        name: "Pouliční pistole",
        metalPartsCost: 3,
        techCoreCost: 1,
        durationMs: 10 * 1000,
        attackPower: ARMORY_BASE_WEAPON_POWER.attack.streetPistol,
        specialEffect: "Attack power 10",
        drawback: "Průměrná síla",
        role: "Univerzální zbraň, early-mid game",
        heatPerUnit: 0
      }),
      grenade: Object.freeze({
        id: "grenade",
        category: "attack",
        name: "Granát",
        metalPartsCost: 4,
        techCoreCost: 1,
        durationMs: 15 * 1000,
        attackPower: ARMORY_BASE_WEAPON_POWER.attack.grenade,
        specialEffect: "Attack power 14, ignoruje 0.3 % obrany",
        drawback: "Jednorázově orientovaný efekt, menší dlouhodobá hodnota",
        role: "Burst damage, prolomení obrany",
        heatPerUnit: 0
      }),
      smg: Object.freeze({
        id: "smg",
        category: "attack",
        name: "Samopal",
        metalPartsCost: 5,
        techCoreCost: 2,
        durationMs: 20 * 1000,
        attackPower: ARMORY_BASE_WEAPON_POWER.attack.smg,
        specialEffect: "Attack power 18, +0.2 power za ks při použití všech 5 attack zbraní v jednom útoku",
        drawback: "Slabší proti silným hráčům",
        role: "Mid game dominance, tlak na slabší hráče",
        heatPerUnit: 0
      }),
      bazooka: Object.freeze({
        id: "bazooka",
        category: "attack",
        name: "Bazuka",
        metalPartsCost: 8,
        techCoreCost: 4,
        durationMs: 35 * 1000,
        attackPower: ARMORY_BASE_WEAPON_POWER.attack.bazooka,
        specialEffect: "Attack power 30, 1 ks zvyšuje o 0.5 % šanci na totální destrukci napadeného districtu",
        drawback: "Extrémně drahá",
        role: "Heavy attack / endgame push",
        heatPerUnit: 4
      }),
      bulletproofVest: Object.freeze({
        id: "bulletproofVest",
        category: "defense",
        name: "Neprůstřelná vesta",
        metalPartsCost: 3,
        techCoreCost: 1,
        durationMs: 8 * 1000,
        defensePower: ARMORY_BASE_WEAPON_POWER.defense.bulletproofVest,
        specialEffect: "Defense power 6, snižuje ztráty počtu obyvatel gangu o 0.5 % za ks",
        drawback: "Slabá proti těžkým zbraním",
        role: "Základní ochrana gangu, early game přežití",
        heatPerUnit: 0
      }),
      steelBarricades: Object.freeze({
        id: "steelBarricades",
        category: "defense",
        name: "Ocelové barikády",
        metalPartsCost: 6,
        techCoreCost: 2,
        durationMs: 15 * 1000,
        defensePower: ARMORY_BASE_WEAPON_POWER.defense.steelBarricades,
        specialEffect: "Defense power 12",
        drawback: "Částečně ignorováno granáty a bazukou",
        role: "Obrana districtu, základní wall",
        heatPerUnit: 0
      }),
      securityCameras: Object.freeze({
        id: "securityCameras",
        category: "defense",
        name: "Bezpečnostní kamery",
        metalPartsCost: 4,
        techCoreCost: 3,
        durationMs: 18 * 1000,
        defensePower: ARMORY_BASE_WEAPON_POWER.defense.securityCameras,
        specialEffect: "Defense power 6, při 5+ kusech velká šance na odhalení špeha",
        drawback: "Slabý přímý defense",
        role: "Intel / counter spy, ochrana před překvapením",
        heatPerUnit: 0
      }),
      autoMgNest: Object.freeze({
        id: "autoMgNest",
        category: "defense",
        name: "Automatické kulometné stanoviště",
        metalPartsCost: 10,
        techCoreCost: 5,
        durationMs: 25 * 1000,
        defensePower: ARMORY_BASE_WEAPON_POWER.defense.autoMgNest,
        specialEffect: "Defense power 20, 1 ks snižuje útočníkovi sílu útoku o 0.3 %",
        drawback: "Méně efektivní proti granátům a bazuce",
        role: "Hlavní obranný damage dealer",
        heatPerUnit: 0
      }),
      alarmSystem: Object.freeze({
        id: "alarmSystem",
        category: "defense",
        name: "Alarm",
        metalPartsCost: 2,
        techCoreCost: 1,
        durationMs: 12 * 1000,
        defensePower: ARMORY_BASE_WEAPON_POWER.defense.alarmSystem,
        specialEffect: "Defense power 10, při 5+ kusech velká šance na selhání vykradení districtu",
        drawback: "Nechrání přímo (support)",
        role: "Support obrana, propojení s policií",
        heatPerUnit: 0
      })
    })
  });
  const ARMORY_WEAPON_KEYS = Object.freeze(Object.keys(ARMORY_CONFIG.weapons));
  const ARMORY_BATCH_MAX_UNITS = 20;
  const ARMORY_ATTACK_WEAPON_KEYS = Object.freeze(
    ARMORY_WEAPON_KEYS.filter((key) => ARMORY_CONFIG.weapons[key]?.category !== "defense")
  );
  const ARMORY_DEFENSE_WEAPON_KEYS = Object.freeze(
    ARMORY_WEAPON_KEYS.filter((key) => ARMORY_CONFIG.weapons[key]?.category === "defense")
  );
  const ARMORY_SLOT_CONFIG = Object.freeze(
    ARMORY_WEAPON_KEYS.map((weaponKey, index) =>
      Object.freeze({
        id: index + 1,
        weaponKey,
        label: ARMORY_CONFIG.weapons[weaponKey].name,
        category: ARMORY_CONFIG.weapons[weaponKey]?.category === "defense" ? "defense" : "attack"
      })
    )
  );
  const ARMORY_SPECIAL_ACTIONS = Object.freeze({
    attackBoost: Object.freeze({
      cooldownMs: 6 * 60 * 60 * 1000,
      durationMs: 2 * 60 * 60 * 1000,
      productionBoostPct: 20,
      immediateHeat: 10,
      passiveHeatPerHour: 5
    }),
    defenseBoost: Object.freeze({
      cooldownMs: 6 * 60 * 60 * 1000,
      durationMs: 2 * 60 * 60 * 1000,
      productionBoostPct: 20,
      immediateHeat: 10,
      passiveHeatPerHour: 5
    })
  });

  const DRUG_LAB_BUILDING_NAME = "Drug lab";
  const DRUG_LAB_BUILDING_STORAGE_KEY = "empire_drug_lab_building_mechanics_v1";
  const DRUG_LAB_PLAYER_STORAGE_KEY = "empire_drug_lab_player_v1";
  const DRUG_LAB_EVENT_LOG_LIMIT = 80;
  const DRUG_LAB_SUPPLY_KEYS = Object.freeze(["chemicals", "biomass", "stimPack"]);
  const DRUG_LAB_CONFIG = Object.freeze({
    maxLevel: 4,
    maxSlots: 4,
    baseStorageCapacity: 100,
    baseCleanIncomePerHour: 0,
    baseDirtyIncomePerHour: 0,
    storageBonusPerWarehousePct: 20,
    productionBonusPerWarehousePct: 3,
    upgradePctPerLevel: 0.1,
    upgradeCosts: {
      2: 5000,
      3: 15000,
      4: 40000
    },
    specialActions: {
      overclock: {
        cooldownMs: 6 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        productionBoostPct: 50,
        immediateHeat: 3
      },
      cleanBatch: {
        cooldownMs: 5 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        effectBoostPct: 20
      },
      hiddenOperation: {
        cooldownMs: 6 * 60 * 60 * 1000,
        durationMs: 2 * 60 * 60 * 1000,
        heatReductionPct: 30,
        productionPenaltyPct: 20
      }
    },
    pulseShotProductionBoostPct: 15,
    ghostSerumHeatReductionPct: 15,
    overdriveUseImmediateHeat: 8,
    overdriveCrashDurationMs: 60 * 60 * 1000,
    overdriveCrashPenaltyPct: 10
  });

  const DRUG_CONFIG = Object.freeze({
    neonDust: Object.freeze({
      id: "neonDust",
      name: "Neon Dust",
      productionPerHour: 200,
      supplyCost: Object.freeze({ chemicals: 3, biomass: 1, stimPack: 0 }),
      heatPerHour: 1,
      useAmount: 5,
      effectDurationMs: 2 * 60 * 60 * 1000,
      description: "Chemický prášek podobný speedu. Recept: 3x Chemicals + 1x Biomass. Výroba 1 balení / 18s. +10 % income z Pouličních dealerů, +5 % dirty cash z Heren a Večerek"
    }),
    pulseShot: Object.freeze({
      id: "pulseShot",
      name: "Pulse Shot",
      productionPerHour: 720 / 7,
      supplyCost: Object.freeze({ chemicals: 2, biomass: 1, stimPack: 2 }),
      heatPerHour: 2,
      useAmount: 3,
      effectDurationMs: 2 * 60 * 60 * 1000,
      description: "To nejlepší na trhu. Recept: 2x Chemicals + 1x Biomass + 2x Stim Pack. Výroba 1 balení / 35s. +15 % rychlost produkce všech budov"
    }),
    velvetSmoke: Object.freeze({
      id: "velvetSmoke",
      name: "Velvet Smoke",
      productionPerHour: 360,
      supplyCost: Object.freeze({ chemicals: 2, biomass: 1, stimPack: 0 }),
      heatPerHour: 3,
      useAmount: 2,
      effectDurationMs: 2 * 60 * 60 * 1000,
      description: "Nejlevnější droga (tabák). Recept: 2x Chemicals + 1x Biomass. Výroba 1 balení / 10s. +20 % vliv ze všech budov, +10 % income z restaurací a klubů"
    }),
    ghostSerum: Object.freeze({
      id: "ghostSerum",
      name: "Ghost Serum",
      productionPerHour: 90,
      supplyCost: Object.freeze({ chemicals: 1, biomass: 2, stimPack: 2 }),
      heatPerHour: 4,
      useAmount: 1,
      effectDurationMs: 2 * 60 * 60 * 1000,
      description: "Recept: 1x Chemicals + 2x Biomass + 2x Stim Pack. Výroba 1 balení / 40s. -20 % šance na policejní razii, -15 % heat gain"
    }),
    overdriveX: Object.freeze({
      id: "overdriveX",
      name: "Overdrive X",
      productionPerHour: 720 / 11,
      supplyCost: Object.freeze({ chemicals: 3, biomass: 1, stimPack: 3 }),
      heatPerHour: 6,
      useAmount: 1,
      effectDurationMs: 2 * 60 * 60 * 1000,
      description: "Recept: 3x Chemicals + 1x Biomass + 3x Stim Pack. Výroba 1 balení / 55s. +25 % síla gangu, +20 % všechny příjmy; po konci crash -10 % výkon"
    })
  });
  const DRUG_LAB_DRUG_KEYS = Object.freeze(Object.keys(DRUG_CONFIG));

  function getDrugLabSupplyCost(drugType, amount = 1) {
    const drug = DRUG_CONFIG[String(drugType || "").trim()];
    const units = Math.max(1, Math.floor(Number(amount) || 1));
    const base = drug?.supplyCost || {};
    return {
      chemicals: Math.max(0, Math.floor(Number(base.chemicals || 0) * units)),
      biomass: Math.max(0, Math.floor(Number(base.biomass || 0) * units)),
      stimPack: Math.max(0, Math.floor(Number(base.stimPack || 0) * units))
    };
  }

  const DISTRICT_GOSSIP_STORAGE_KEY = "empire_district_gossip_history_v1";
  const DISTRICT_GOSSIP_MAX_PER_DISTRICT = 40;
  const DISTRICT_GOSSIP_DEMO_SEED_KEY = "empire_district_gossip_demo_seed_v1";
  const DISTRICT_GOSSIP_DISABLED_INTEL_TYPES = new Set(["attack_success", "attack_failed", "raid_started"]);
  const DISTRICT_GOSSIP_QUALITY_PRESETS = Object.freeze({
    common: Object.freeze({ label: "Běžný", chance: 70, accuracyMin: 60, accuracyMax: 80 }),
    quality: Object.freeze({ label: "Kvalitní", chance: 25, accuracyMin: 80, accuracyMax: 95 }),
    rare: Object.freeze({ label: "Vzácný", chance: 5, accuracyMin: 90, accuracyMax: 100 })
  });
  const DISTRICT_GOSSIP_CATEGORY_LABELS = Object.freeze({
    economy: "Ekonomický",
    defense: "Obranný",
    attack: "Útočný",
    production: "Produkční",
    heat: "Heat",
    special: "Speciální"
  });
  const DISTRICT_GOSSIP_TEXT_LIBRARY = Object.freeze({
    common: Object.freeze({
      economy: Object.freeze([
        "District {district} generuje nadprůměrný cash.",
        "V districtu {district} teče stabilní tok čistých peněz.",
        "District {district} má slabší income, než se tváří.",
        "V districtu {district} se cash točí hlavně večer.",
        "District {district} drží příjem přes malé provozy.",
        "V districtu {district} někdo stahuje zisky bokem.",
        "District {district} má nečekaně silný dirty cash tok.",
        "V districtu {district} padá income po změně směn.",
        "District {district} je finančně pod tlakem.",
        "V districtu {district} se připravuje rychlá výměna hotovosti."
      ]),
      defense: Object.freeze([
        "District {district} má roztažené hlídky.",
        "V districtu {district} obrana nehlídá všechny vstupy.",
        "District {district} je oslabený po přesunu lidí.",
        "V districtu {district} chybí záložní obranná linka.",
        "District {district} drží obranu jen na papíře.",
        "V districtu {district} je slabý noční dohled.",
        "District {district} má pomalou reakci obrany.",
        "V districtu {district} je mezera v severní části.",
        "District {district} je citlivý na rychlý tlak.",
        "V districtu {district} obrana působí podstav."
      ]),
      attack: Object.freeze([
        "Hráč {owner} v districtu {district} plánuje tlak.",
        "V districtu {district} se chystá útočný přesun.",
        "Hráč {owner} právě přesouvá útočné zbraně.",
        "District {district} připravuje krátké okno útoku.",
        "V districtu {district} roste aktivita bojových týmů.",
        "Hráč {owner} z districtu {district} testuje obranu okolí.",
        "District {district} má zvýšený pohyb před akcí.",
        "V districtu {district} je slyšet příprava na nájezd.",
        "Hráč {owner} může z districtu {district} udeřit brzy.",
        "District {district} má napjatou útočnou logistiku."
      ]),
      production: Object.freeze([
        "District {district} drží výrobní tempo bez pauz.",
        "V districtu {district} jede produkce i mimo špičku.",
        "District {district} navyšuje výstup v tichém režimu.",
        "V districtu {district} běží zpracování zásob naplno.",
        "District {district} má stabilní produkční linku.",
        "V districtu {district} roste spotřeba materiálů.",
        "District {district} přesměroval výrobu na klíčové položky.",
        "V districtu {district} se připravuje větší výrobní dávka.",
        "District {district} používá rychlé výrobní protokoly.",
        "V districtu {district} chybí jen malý vstup pro max výkon."
      ]),
      heat: Object.freeze([
        "District {district} má zvýšený heat.",
        "V districtu {district} policie častěji patroluje.",
        "District {district} je blízko policejního zájmu.",
        "V districtu {district} roste tlak po poslední akci.",
        "District {district} táhne pozornost médií i policie.",
        "V districtu {district} je teplota operací nebezpečně vysoká.",
        "District {district} má nestabilní heat křivku.",
        "V districtu {district} jde heat nahoru každou hodinou.",
        "District {district} je po sérii hlučných akcí pod dohledem.",
        "V districtu {district} stačí málo a přijde zásah."
      ]),
      special: Object.freeze([
        "District {district} má skrytou slabinu.",
        "V districtu {district} je budova s podezřelým cooldownem.",
        "District {district} může mít otevřený boční vstup.",
        "V districtu {district} se objevila interní zrada.",
        "District {district} má nestandardní rotaci hlídek.",
        "V districtu {district} někdo manipuluje interní info.",
        "District {district} skrývá krátké okno příležitosti.",
        "V districtu {district} se dá čekat nečekaný obrat.",
        "District {district} drží citlivou slabinu logistiky.",
        "V districtu {district} někdo vědomě pouští falešné stopy."
      ])
    }),
    quality: Object.freeze({
      economy: Object.freeze([
        "Kvalitní intel: District {district} přidává silný clean cash v pravidelných vlnách.",
        "Kvalitní intel: V districtu {district} je citelný rozdíl mezi clean a dirty tokem.",
        "Kvalitní intel: District {district} má slabý výnos mimo večerní hodiny.",
        "Kvalitní intel: V districtu {district} někdo krátí příjmy vlastnímu týmu.",
        "Kvalitní intel: District {district} drží vysoký cashflow přes dvě hlavní budovy."
      ]),
      defense: Object.freeze([
        "Kvalitní intel: District {district} má slabý pravý flank obrany.",
        "Kvalitní intel: V districtu {district} chybí zálohy při delším boji.",
        "Kvalitní intel: District {district} má nízkou hloubku obrany.",
        "Kvalitní intel: V districtu {district} rotace hlídek vytváří předvídatelné okno.",
        "Kvalitní intel: District {district} je obranně nejzranitelnější v noci."
      ]),
      attack: Object.freeze([
        "Kvalitní intel: Hráč {owner} přes district {district} chystá údernou akci.",
        "Kvalitní intel: V districtu {district} je krátké okno pro protiútok.",
        "Kvalitní intel: Hráč {owner} vyčerpal část armády při posledním tlaku.",
        "Kvalitní intel: District {district} přesouvá útočné vybavení mimo sektor.",
        "Kvalitní intel: District {district} bude útočně aktivní v dalších hodinách."
      ]),
      production: Object.freeze([
        "Kvalitní intel: District {district} vyrábí klíčové zdroje bez přestávky.",
        "Kvalitní intel: V districtu {district} běží produkce se zvýšenou efektivitou.",
        "Kvalitní intel: District {district} drží zrychlený výrobní cyklus.",
        "Kvalitní intel: V districtu {district} je produkce citlivá na sabotáže.",
        "Kvalitní intel: District {district} má slabé krytí výrobních tras."
      ]),
      heat: Object.freeze([
        "Kvalitní intel: District {district} je blízko cílené policejní kontrole.",
        "Kvalitní intel: V districtu {district} heat roste kvůli opakovaným akcím.",
        "Kvalitní intel: District {district} drží rizikový profil pro raid.",
        "Kvalitní intel: V districtu {district} stačí jeden incident k zásahu.",
        "Kvalitní intel: District {district} je sledovaný víc než okolní sektory."
      ]),
      special: Object.freeze([
        "Kvalitní intel: District {district} má slabinu v koordinačním řetězci.",
        "Kvalitní intel: V districtu {district} běží budova s dlouhým cooldownem.",
        "Kvalitní intel: District {district} skrývá rizikový bod obrany.",
        "Kvalitní intel: V districtu {district} unikají interní informace ven.",
        "Kvalitní intel: District {district} je náchylný na přesný timing útoku."
      ])
    }),
    rare: Object.freeze({
      economy: Object.freeze([
        "Potvrzený intel: District {district} drží přesný cashflow profil a je nadprůměrně výnosný.",
        "Potvrzený intel: V districtu {district} je hlavní finanční uzel frakce."
      ]),
      defense: Object.freeze([
        "Potvrzený intel: District {district} má low defense a minimum záloh.",
        "Potvrzený intel: V districtu {district} je kritická mezera v obraně."
      ]),
      attack: Object.freeze([
        "Potvrzený intel: Hráč {owner} po akci v districtu {district} vyčerpal útočné síly.",
        "Potvrzený intel: District {district} má potvrzené přípravy na útok v krátkém čase."
      ]),
      production: Object.freeze([
        "Potvrzený intel: District {district} vyrábí klíčový zdroj v maximálním režimu.",
        "Potvrzený intel: V districtu {district} je produkční linka s nejvyšší prioritou."
      ]),
      heat: Object.freeze([
        "Potvrzený intel: District {district} je těsně před policejním zásahem."
      ]),
      special: Object.freeze([
        "Potvrzený intel: District {district} má skrytou slabinu, která mění výsledek boje."
      ])
    })
  });
  const SIMPLE_CASH_BUILDING_STORAGE_KEY = "empire_simple_cash_building_mechanics_v1";

  const BUILDING_INCOME_CLEAN_RATIO = 0.9;
  const BUILDING_INCOME_DIRTY_RATIO = 0.1;
  const BUILDING_INFLUENCE_PER_HOUR = 1;

  let apartmentBlockStore = loadApartmentBlockStore();
  let schoolBuildingStore = loadSchoolBuildingStore();
  let fitnessBuildingStore = loadFitnessBuildingStore();
  let casinoBuildingStore = loadCasinoBuildingStore();
  let arcadeBuildingStore = loadArcadeBuildingStore();
  let autoSalonBuildingStore = loadAutoSalonBuildingStore();
  let exchangeBuildingStore = loadExchangeBuildingStore();
  let restaurantBuildingStore = loadRestaurantBuildingStore();
  let convenienceStoreBuildingStore = loadConvenienceStoreBuildingStore();
  let pharmacyBuildingStore = loadPharmacyBuildingStore();
  let simpleCashBuildingStore = loadSimpleCashBuildingStore();
  let factoryBuildingStore = loadFactoryBuildingStore();
  let armoryBuildingStore = loadArmoryBuildingStore();
  let factoryPlayerSupplies = loadFactoryPlayerSupplies();
  let drugLabBuildingStore = loadDrugLabBuildingStore();
  let drugLabPlayerState = loadDrugLabPlayerState();
  let districtGossipStore = loadDistrictGossipStore();

  function init() {
    state.canvas = document.getElementById("city-map");
    state.tooltip = document.getElementById("map-tooltip");
    if (!state.canvas) return;
    state.ctx = state.canvas.getContext("2d");
    state.mapMode = resolveStoredMapMode();

    clearSpyGeneratedGossipOnRefresh();
    clearDisabledIntelTypeDistrictGossipOnRefresh();
    resetPharmacyProducedStateOnRefresh();
    loadMapImage(state.mapMode);
    generateCity();
    seedDemoDistrictGossip();
    initModal();
    initDistrictAtmosphereLightbox();
    initBuildingDetailModal();
    bindEvents();
    resizeCanvas();
  }

  function loadApartmentBlockStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(APARTMENT_BLOCK_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveApartmentBlockStore() {
    localStorage.setItem(APARTMENT_BLOCK_STORAGE_KEY, JSON.stringify(apartmentBlockStore));
  }

  function loadSchoolBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCHOOL_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveSchoolBuildingStore() {
    localStorage.setItem(SCHOOL_BUILDING_STORAGE_KEY, JSON.stringify(schoolBuildingStore));
  }

  function loadFitnessBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FITNESS_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveFitnessBuildingStore() {
    localStorage.setItem(FITNESS_BUILDING_STORAGE_KEY, JSON.stringify(fitnessBuildingStore));
  }

  function loadCasinoBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CASINO_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveCasinoBuildingStore() {
    localStorage.setItem(CASINO_BUILDING_STORAGE_KEY, JSON.stringify(casinoBuildingStore));
  }

  function loadArcadeBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARCADE_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveArcadeBuildingStore() {
    localStorage.setItem(ARCADE_BUILDING_STORAGE_KEY, JSON.stringify(arcadeBuildingStore));
  }

  function loadAutoSalonBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUTO_SALON_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveAutoSalonBuildingStore() {
    localStorage.setItem(AUTO_SALON_BUILDING_STORAGE_KEY, JSON.stringify(autoSalonBuildingStore));
  }

  function loadExchangeBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EXCHANGE_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveExchangeBuildingStore() {
    localStorage.setItem(EXCHANGE_BUILDING_STORAGE_KEY, JSON.stringify(exchangeBuildingStore));
  }

  function loadRestaurantBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RESTAURANT_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveRestaurantBuildingStore() {
    localStorage.setItem(RESTAURANT_BUILDING_STORAGE_KEY, JSON.stringify(restaurantBuildingStore));
  }

  function loadConvenienceStoreBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONVENIENCE_STORE_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveConvenienceStoreBuildingStore() {
    localStorage.setItem(CONVENIENCE_STORE_BUILDING_STORAGE_KEY, JSON.stringify(convenienceStoreBuildingStore));
  }

  function loadPharmacyBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PHARMACY_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function savePharmacyBuildingStore() {
    localStorage.setItem(PHARMACY_BUILDING_STORAGE_KEY, JSON.stringify(pharmacyBuildingStore));
  }

  function loadSimpleCashBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SIMPLE_CASH_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveSimpleCashBuildingStore() {
    localStorage.setItem(SIMPLE_CASH_BUILDING_STORAGE_KEY, JSON.stringify(simpleCashBuildingStore));
  }

  function resetPharmacyProducedStateOnRefresh(now = Date.now()) {
    const nextStore = {};
    let changed = false;
    Object.entries(pharmacyBuildingStore || {}).forEach(([instanceKey, rawState]) => {
      const snapshot = sanitizePharmacyState(rawState, now);
      snapshot.resources = createPharmacyResourceMap();
      snapshot.slots = (Array.isArray(snapshot.slots) ? snapshot.slots : []).map((slot, index) => {
        const defaults = createPharmacyDefaultSlots(now);
        const safeSlot = sanitizePharmacySlot(slot, defaults[index], now);
        safeSlot.producedAmount = 0;
        safeSlot.productionRemainder = 0;
        safeSlot.lastTick = now;
        return safeSlot;
      });
      nextStore[instanceKey] = snapshot;
      changed = true;
    });
    if (!changed) return;
    pharmacyBuildingStore = nextStore;
    savePharmacyBuildingStore();
  }

  function loadFactoryBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FACTORY_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveFactoryBuildingStore() {
    localStorage.setItem(FACTORY_BUILDING_STORAGE_KEY, JSON.stringify(factoryBuildingStore));
  }

  function loadArmoryBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARMORY_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveArmoryBuildingStore() {
    localStorage.setItem(ARMORY_BUILDING_STORAGE_KEY, JSON.stringify(armoryBuildingStore));
  }

  function loadFactoryPlayerSupplies() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FACTORY_PLAYER_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const normalized = createFactoryPlayerSupplyMap(parsed);
        if (!window.Empire?.token) {
          normalized.metalParts = Math.max(20, Math.floor(Number(normalized.metalParts || 0)));
          normalized.techCore = Math.max(20, Math.floor(Number(normalized.techCore || 0)));
          normalized.combatModule = Math.max(20, Math.floor(Number(normalized.combatModule || 0)));
        } else if (!Object.prototype.hasOwnProperty.call(parsed, "combatModule")) {
          normalized.combatModule = 2;
        }
        return normalized;
      }
    } catch {}
    if (!window.Empire?.token) {
      return { metalParts: 20, techCore: 20, combatModule: 20 };
    }
    return { combatModule: 2 };
  }

  function saveFactoryPlayerSupplies() {
    localStorage.setItem(FACTORY_PLAYER_STORAGE_KEY, JSON.stringify(factoryPlayerSupplies));
  }

  function loadDrugLabBuildingStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRUG_LAB_BUILDING_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveDrugLabBuildingStore() {
    localStorage.setItem(DRUG_LAB_BUILDING_STORAGE_KEY, JSON.stringify(drugLabBuildingStore));
  }

  function loadDrugLabPlayerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRUG_LAB_PLAYER_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveDrugLabPlayerState() {
    localStorage.setItem(DRUG_LAB_PLAYER_STORAGE_KEY, JSON.stringify(drugLabPlayerState));
  }

  function loadDistrictGossipStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DISTRICT_GOSSIP_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return {};
  }

  function saveDistrictGossipStore() {
    localStorage.setItem(DISTRICT_GOSSIP_STORAGE_KEY, JSON.stringify(districtGossipStore));
  }

  function clearSpyGeneratedGossipOnRefresh() {
    if (!districtGossipStore || typeof districtGossipStore !== "object") return;
    let changed = false;
    const nextStore = {};

    Object.entries(districtGossipStore).forEach(([districtPart, rawEntries]) => {
      const safeEntries = Array.isArray(rawEntries) ? rawEntries : [];
      const filtered = safeEntries
        .map((entry) => sanitizeDistrictGossipEntry(entry))
        .filter(Boolean)
        .filter((entry) => String(entry.intelType || "").trim().toLowerCase() !== "spy_started");
      if (filtered.length !== safeEntries.length) changed = true;
      nextStore[districtPart] = filtered.slice(0, DISTRICT_GOSSIP_MAX_PER_DISTRICT);
    });

    if (!changed) return;
    districtGossipStore = nextStore;
    saveDistrictGossipStore();
  }

  function normalizeBuildingKeyPart(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_.:#]/g, "");
  }

  function createApartmentDefaultState(now = Date.now()) {
    return {
      level: 1,
      storedMembers: 0,
      productionRemainder: 0,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastProductionAt: now,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        recruit: 0,
        motivation: 0,
        hiddenHousing: 0
      },
      effects: {
        motivationUntil: 0,
        hiddenHousingUntil: 0
      },
      hiddenHousingActive: false,
      loyaltyPenalty: 0,
      extraHeat: 0
    };
  }

  function sanitizeApartmentState(rawState, now = Date.now()) {
    const fallback = createApartmentDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, APARTMENT_BLOCK_CONFIG.maxLevel)
      : 1;
    const storedMembers = Math.max(0, Math.floor(Number(rawState?.storedMembers || 0)));
    const productionRemainder = Number(rawState?.productionRemainder || 0);
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean ?? rawState?.incomeRemainder ?? 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastProductionAt = Number(rawState?.lastProductionAt || now);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      storedMembers,
      productionRemainder: Number.isFinite(productionRemainder) ? Math.max(0, productionRemainder) : 0,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastProductionAt: Number.isFinite(lastProductionAt) ? Math.max(0, lastProductionAt) : fallback.lastProductionAt,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        recruit: Math.max(0, Number(cooldownsRaw.recruit || 0)),
        motivation: Math.max(0, Number(cooldownsRaw.motivation || 0)),
        hiddenHousing: Math.max(0, Number(cooldownsRaw.hiddenHousing || 0))
      },
      effects: {
        motivationUntil: Math.max(0, Number(effectsRaw.motivationUntil || 0)),
        hiddenHousingUntil: Math.max(0, Number(effectsRaw.hiddenHousingUntil || 0))
      },
      hiddenHousingActive: Boolean(rawState?.hiddenHousingActive),
      loyaltyPenalty: Math.max(0, Number(rawState?.loyaltyPenalty || 0)),
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function resolveBuildingInstanceKey(context, district) {
    const districtId = context?.districtId ?? district?.id ?? "unknown";
    const districtPart = normalizeBuildingKeyPart(districtId) || "unknown";

    const explicitIndex = Number(context?.buildingIndex);
    const indexPart = Number.isFinite(explicitIndex) ? String(Math.max(0, Math.floor(explicitIndex))) : "x";

    const variantPart = normalizeBuildingKeyPart(context?.variantName || "");
    const basePart = normalizeBuildingKeyPart(context?.baseName || "building");
    const namePart = variantPart || basePart || "building";

    return `${districtPart}:${indexPart}:${namePart}`;
  }

  function getApartmentStateByKey(instanceKey, now = Date.now()) {
    const current = apartmentBlockStore[instanceKey];
    const sanitized = sanitizeApartmentState(current, now);
    apartmentBlockStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistApartmentState(instanceKey, nextState) {
    apartmentBlockStore[instanceKey] = sanitizeApartmentState(nextState, Date.now());
    saveApartmentBlockStore();
    return apartmentBlockStore[instanceKey];
  }

  function createSchoolDefaultState(now = Date.now()) {
    return {
      level: 1,
      storedMembers: 0,
      productionRemainder: 0,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastProductionAt: now,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        lecture: 0,
        chemistry: 0,
        evening: 0
      },
      effects: {
        chemistryUntil: 0,
        eveningUntil: 0
      },
      eveningProgramActive: false,
      districtHeatReductionActive: false,
      loyaltyPenalty: 0,
      extraHeat: 0
    };
  }

  function sanitizeSchoolState(rawState, now = Date.now()) {
    const fallback = createSchoolDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, SCHOOL_BUILDING_CONFIG.maxLevel)
      : 1;
    const storedMembers = Math.max(0, Math.floor(Number(rawState?.storedMembers || 0)));
    const productionRemainder = Number(rawState?.productionRemainder || 0);
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean ?? rawState?.incomeRemainder ?? 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastProductionAt = Number(rawState?.lastProductionAt || now);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      storedMembers,
      productionRemainder: Number.isFinite(productionRemainder) ? Math.max(0, productionRemainder) : 0,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastProductionAt: Number.isFinite(lastProductionAt) ? Math.max(0, lastProductionAt) : fallback.lastProductionAt,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        lecture: Math.max(0, Number(cooldownsRaw.lecture || 0)),
        chemistry: Math.max(0, Number(cooldownsRaw.chemistry || 0)),
        evening: Math.max(0, Number(cooldownsRaw.evening || 0))
      },
      effects: {
        chemistryUntil: Math.max(0, Number(effectsRaw.chemistryUntil || 0)),
        eveningUntil: Math.max(0, Number(effectsRaw.eveningUntil || 0))
      },
      eveningProgramActive: Boolean(rawState?.eveningProgramActive),
      districtHeatReductionActive: Boolean(rawState?.districtHeatReductionActive),
      loyaltyPenalty: Math.max(0, Number(rawState?.loyaltyPenalty || 0)),
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getSchoolStateByKey(instanceKey, now = Date.now()) {
    const current = schoolBuildingStore[instanceKey];
    const sanitized = sanitizeSchoolState(current, now);
    schoolBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistSchoolState(instanceKey, nextState) {
    schoolBuildingStore[instanceKey] = sanitizeSchoolState(nextState, Date.now());
    saveSchoolBuildingStore();
    return schoolBuildingStore[instanceKey];
  }

  function createFitnessDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        gangTraining: 0,
        talentRecruitment: 0,
        doping: 0
      },
      effects: {
        gangTrainingUntil: 0,
        talentRecruitmentInfluenceUntil: 0,
        talentRecruitmentIncomeUntil: 0,
        dopingRushUntil: 0,
        dopingCrashUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeFitnessState(rawState, now = Date.now()) {
    const fallback = createFitnessDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, FITNESS_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean ?? rawState?.incomeRemainder ?? 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const lastGossipAt = Number(rawState?.lastGossipAt || 0);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        gangTraining: Math.max(0, Number(cooldownsRaw.gangTraining || cooldownsRaw.training || 0)),
        talentRecruitment: Math.max(0, Number(cooldownsRaw.talentRecruitment || cooldownsRaw.premium || 0)),
        doping: Math.max(0, Number(cooldownsRaw.doping || 0))
      },
      effects: {
        gangTrainingUntil: Math.max(0, Number(effectsRaw.gangTrainingUntil || effectsRaw.trainingUntil || 0)),
        talentRecruitmentInfluenceUntil: Math.max(
          0,
          Number(effectsRaw.talentRecruitmentInfluenceUntil || effectsRaw.premiumUntil || 0)
        ),
        talentRecruitmentIncomeUntil: Math.max(
          0,
          Number(effectsRaw.talentRecruitmentIncomeUntil || effectsRaw.premiumUntil || 0)
        ),
        dopingRushUntil: Math.max(0, Number(effectsRaw.dopingRushUntil || 0)),
        dopingCrashUntil: Math.max(0, Number(effectsRaw.dopingCrashUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getFitnessStateByKey(instanceKey, now = Date.now()) {
    const current = fitnessBuildingStore[instanceKey];
    const sanitized = sanitizeFitnessState(current, now);
    fitnessBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistFitnessState(instanceKey, nextState) {
    fitnessBuildingStore[instanceKey] = sanitizeFitnessState(nextState, Date.now());
    saveFitnessBuildingStore();
    return fitnessBuildingStore[instanceKey];
  }

  function createCasinoDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      lastGossipAt: 0,
      cooldowns: {
        highStakes: 0,
        laundering: 0,
        vipEvening: 0
      },
      effects: {
        vipEveningUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeCasinoState(rawState, now = Date.now()) {
    const fallback = createCasinoDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, CASINO_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      lastGossipAt: Number.isFinite(lastGossipAt) ? Math.max(0, lastGossipAt) : 0,
      cooldowns: {
        highStakes: Math.max(0, Number(cooldownsRaw.highStakes || cooldownsRaw.vip || 0)),
        laundering: Math.max(0, Number(cooldownsRaw.laundering || 0)),
        vipEvening: Math.max(0, Number(cooldownsRaw.vipEvening || 0))
      },
      effects: {
        vipEveningUntil: Math.max(0, Number(effectsRaw.vipEveningUntil || effectsRaw.vipUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getCasinoStateByKey(instanceKey, now = Date.now()) {
    const current = casinoBuildingStore[instanceKey];
    const sanitized = sanitizeCasinoState(current, now);
    casinoBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistCasinoState(instanceKey, nextState) {
    casinoBuildingStore[instanceKey] = sanitizeCasinoState(nextState, Date.now());
    saveCasinoBuildingStore();
    return casinoBuildingStore[instanceKey];
  }

  function createArcadeDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        tournament: 0,
        laundering: 0,
        nightRun: 0
      },
      effects: {
        tournamentUntil: 0,
        nightRunUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeArcadeState(rawState, now = Date.now()) {
    const fallback = createArcadeDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, ARCADE_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        tournament: Math.max(0, Number(cooldownsRaw.tournament || cooldownsRaw.slots || 0)),
        laundering: Math.max(0, Number(cooldownsRaw.laundering || cooldownsRaw.backroom || 0)),
        nightRun: Math.max(0, Number(cooldownsRaw.nightRun || cooldownsRaw.deal || 0))
      },
      effects: {
        tournamentUntil: Math.max(0, Number(effectsRaw.tournamentUntil || effectsRaw.slotsUntil || 0)),
        nightRunUntil: Math.max(0, Number(effectsRaw.nightRunUntil || effectsRaw.dealUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getArcadeStateByKey(instanceKey, now = Date.now()) {
    const current = arcadeBuildingStore[instanceKey];
    const sanitized = sanitizeArcadeState(current, now);
    arcadeBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistArcadeState(instanceKey, nextState) {
    arcadeBuildingStore[instanceKey] = sanitizeArcadeState(nextState, Date.now());
    saveArcadeBuildingStore();
    return arcadeBuildingStore[instanceKey];
  }

  function createAutoSalonDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        premiumOffer: 0,
        grayImport: 0,
        fleet: 0
      },
      effects: {
        premiumOfferUntil: 0,
        grayImportUntil: 0,
        fleetUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeAutoSalonState(rawState, now = Date.now()) {
    const fallback = createAutoSalonDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, AUTO_SALON_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        premiumOffer: Math.max(0, Number(cooldownsRaw.premiumOffer || 0)),
        grayImport: Math.max(0, Number(cooldownsRaw.grayImport || 0)),
        fleet: Math.max(0, Number(cooldownsRaw.fleet || 0))
      },
      effects: {
        premiumOfferUntil: Math.max(0, Number(effectsRaw.premiumOfferUntil || 0)),
        grayImportUntil: Math.max(0, Number(effectsRaw.grayImportUntil || 0)),
        fleetUntil: Math.max(0, Number(effectsRaw.fleetUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getAutoSalonStateByKey(instanceKey, now = Date.now()) {
    const current = autoSalonBuildingStore[instanceKey];
    const sanitized = sanitizeAutoSalonState(current, now);
    autoSalonBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistAutoSalonState(instanceKey, nextState) {
    autoSalonBuildingStore[instanceKey] = sanitizeAutoSalonState(nextState, Date.now());
    saveAutoSalonBuildingStore();
    return autoSalonBuildingStore[instanceKey];
  }

  function createExchangeDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        exchange: 0,
        hiddenTransfer: 0,
        quickLiquidity: 0
      },
      effects: {
        hiddenTransferUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeExchangeState(rawState, now = Date.now()) {
    const fallback = createExchangeDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, EXCHANGE_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        exchange: Math.max(0, Number(cooldownsRaw.exchange || cooldownsRaw.silentTransfer || 0)),
        hiddenTransfer: Math.max(0, Number(cooldownsRaw.hiddenTransfer || cooldownsRaw.favorableRate || 0)),
        quickLiquidity: Math.max(0, Number(cooldownsRaw.quickLiquidity || cooldownsRaw.financialNetwork || 0))
      },
      effects: {
        hiddenTransferUntil: Math.max(0, Number(effectsRaw.hiddenTransferUntil || effectsRaw.favorableRateUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getExchangeStateByKey(instanceKey, now = Date.now()) {
    const current = exchangeBuildingStore[instanceKey];
    const sanitized = sanitizeExchangeState(current, now);
    exchangeBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistExchangeState(instanceKey, nextState) {
    exchangeBuildingStore[instanceKey] = sanitizeExchangeState(nextState, Date.now());
    saveExchangeBuildingStore();
    return exchangeBuildingStore[instanceKey];
  }

  function createRestaurantDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        gangDinner: 0,
        vipReservation: 0,
        streetGossip: 0
      },
      effects: {
        gangDinnerUntil: 0,
        gangDinnerDistrictPart: "",
        vipReservationUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeRestaurantState(rawState, now = Date.now()) {
    const fallback = createRestaurantDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, RESTAURANT_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        gangDinner: Math.max(0, Number(cooldownsRaw.gangDinner || cooldownsRaw.happyHour || 0)),
        vipReservation: Math.max(0, Number(cooldownsRaw.vipReservation || cooldownsRaw.backTable || 0)),
        streetGossip: Math.max(0, Number(cooldownsRaw.streetGossip || cooldownsRaw.birthdayParty || 0))
      },
      effects: {
        gangDinnerUntil: Math.max(0, Number(effectsRaw.gangDinnerUntil || effectsRaw.happyHourUntil || 0)),
        gangDinnerDistrictPart: String(effectsRaw.gangDinnerDistrictPart || "").trim(),
        vipReservationUntil: Math.max(0, Number(effectsRaw.vipReservationUntil || effectsRaw.backTableUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getRestaurantStateByKey(instanceKey, now = Date.now()) {
    const current = restaurantBuildingStore[instanceKey];
    const sanitized = sanitizeRestaurantState(current, now);
    restaurantBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistRestaurantState(instanceKey, nextState) {
    restaurantBuildingStore[instanceKey] = sanitizeRestaurantState(nextState, Date.now());
    saveRestaurantBuildingStore();
    return restaurantBuildingStore[instanceKey];
  }

  function createConvenienceStoreDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        nightSale: 0,
        smallDeal: 0,
        coverOps: 0
      },
      effects: {
        nightSaleUntil: 0,
        coverOpsUntil: 0
      },
      extraHeat: 0
    };
  }

  function sanitizeConvenienceStoreState(rawState, now = Date.now()) {
    const fallback = createConvenienceStoreDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, CONVENIENCE_STORE_BUILDING_CONFIG.maxLevel)
      : 1;
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    return {
      level,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, lastIncomeAt) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, lastInfluenceAt) : fallback.lastInfluenceAt,
      cooldowns: {
        nightSale: Math.max(0, Number(cooldownsRaw.nightSale || cooldownsRaw.nightShift || 0)),
        smallDeal: Math.max(0, Number(cooldownsRaw.smallDeal || cooldownsRaw.backCounter || 0)),
        coverOps: Math.max(0, Number(cooldownsRaw.coverOps || cooldownsRaw.localRumors || 0))
      },
      effects: {
        nightSaleUntil: Math.max(0, Number(effectsRaw.nightSaleUntil || effectsRaw.nightShiftUntil || 0)),
        coverOpsUntil: Math.max(0, Number(effectsRaw.coverOpsUntil || effectsRaw.backCounterUntil || 0))
      },
      extraHeat: Math.max(0, Number(rawState?.extraHeat || 0))
    };
  }

  function getConvenienceStoreStateByKey(instanceKey, now = Date.now()) {
    const current = convenienceStoreBuildingStore[instanceKey];
    const sanitized = sanitizeConvenienceStoreState(current, now);
    convenienceStoreBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistConvenienceStoreState(instanceKey, nextState) {
    convenienceStoreBuildingStore[instanceKey] = sanitizeConvenienceStoreState(nextState, Date.now());
    saveConvenienceStoreBuildingStore();
    return convenienceStoreBuildingStore[instanceKey];
  }

  function createPharmacyResourceMap(rawMap = {}, floorValues = true) {
    return PHARMACY_RESOURCE_KEYS.reduce((acc, key) => {
      const parsed = Number(rawMap?.[key] || 0);
      const safeValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      acc[key] = floorValues ? Math.floor(safeValue) : safeValue;
      return acc;
    }, {});
  }

  function createStreetDealerDefaultSlot(slotConfig, now = Date.now()) {
    const safeConfig = slotConfig || {};
    return {
      id: Math.max(1, Math.floor(Number(safeConfig.id) || 1)),
      resourceKey: String(safeConfig.resourceKey || "").trim(),
      queuedUnits: 10,
      storedUnits: 0,
      soldUnitsTotal: 0,
      salesUnitRemainder: 0,
      cashRemainder: 0,
      lastTick: Math.max(0, Math.floor(Number(now) || Date.now()))
    };
  }

  function createStreetDealerDefaultSlots(now = Date.now()) {
    return STREET_DEALERS_CONFIG.sales.slots.map((slotConfig) => createStreetDealerDefaultSlot(slotConfig, now));
  }

  function sanitizeStreetDealerSlot(rawSlot, fallbackSlot, now = Date.now()) {
    const fallback = fallbackSlot || createStreetDealerDefaultSlot({}, now);
    const id = Math.max(1, Math.floor(Number(rawSlot?.id ?? fallback.id ?? 1) || 1));
    const expectedResourceKey = String(fallback.resourceKey || "").trim();
    const resourceKeyRaw = String(rawSlot?.resourceKey || expectedResourceKey).trim();
    const resourceKey = STREET_DEALERS_RESOURCE_KEYS.includes(resourceKeyRaw) ? resourceKeyRaw : expectedResourceKey;
    const queuedUnitsRaw = Number(rawSlot?.queuedUnits ?? 10);
    const storedUnitsRaw = Number(rawSlot?.storedUnits ?? rawSlot?.producedAmount ?? 0);
    const soldUnitsTotalRaw = Number(rawSlot?.soldUnitsTotal || 0);
    const salesUnitRemainderRaw = Number(rawSlot?.salesUnitRemainder || 0);
    const cashRemainderRaw = Number(rawSlot?.cashRemainder || 0);
    const lastTickRaw = Number(rawSlot?.lastTick || now);
    return {
      id,
      resourceKey,
      queuedUnits: Number.isFinite(queuedUnitsRaw) ? clamp(Math.floor(queuedUnitsRaw), 1, 999) : 10,
      storedUnits: Number.isFinite(storedUnitsRaw) ? Math.max(0, Math.floor(storedUnitsRaw)) : 0,
      soldUnitsTotal: Number.isFinite(soldUnitsTotalRaw) ? Math.max(0, Math.floor(soldUnitsTotalRaw)) : 0,
      salesUnitRemainder: Number.isFinite(salesUnitRemainderRaw) ? Math.max(0, salesUnitRemainderRaw) : 0,
      cashRemainder: Number.isFinite(cashRemainderRaw) ? Math.max(0, cashRemainderRaw) : 0,
      lastTick: Number.isFinite(lastTickRaw) ? Math.max(0, Math.floor(lastTickRaw)) : Math.max(0, Math.floor(Number(now) || Date.now()))
    };
  }

  function createPharmacyDefaultSlot(slotId, resourceKey, now = Date.now()) {
    return {
      id: Math.max(1, Math.floor(Number(slotId) || 0)),
      resourceKey: String(resourceKey || "").trim(),
      isProducing: false,
      queuedUnits: 1,
      queueRemaining: 0,
      producedAmount: 0,
      lastTick: now,
      productionRemainder: 0
    };
  }

  function sanitizePharmacySlot(rawSlot, fallbackSlot, now = Date.now()) {
    const id = Math.max(1, Math.floor(Number(rawSlot?.id ?? fallbackSlot?.id ?? 1) || 1));
    const expectedResourceKey = String(fallbackSlot?.resourceKey || "").trim();
    const resourceKeyRaw = String(rawSlot?.resourceKey || expectedResourceKey).trim();
    const resourceKey = PHARMACY_RESOURCE_KEYS.includes(resourceKeyRaw) ? resourceKeyRaw : expectedResourceKey;
    const queuedUnitsRaw = Number(rawSlot?.queuedUnits ?? (rawSlot?.isProducing ? 0 : 1));
    const queueRemainingRaw = Number(rawSlot?.queueRemaining || 0);
    const producedAmountRaw = Number(rawSlot?.producedAmount || 0);
    const lastTickRaw = Number(rawSlot?.lastTick || now);
    const remainderRaw = Number(rawSlot?.productionRemainder || 0);
    return {
      id,
      resourceKey,
      isProducing: Boolean(rawSlot?.isProducing),
      queuedUnits: Number.isFinite(queuedUnitsRaw)
        ? clamp(Math.floor(queuedUnitsRaw), Boolean(rawSlot?.isProducing) ? 0 : 1, 999)
        : (Boolean(rawSlot?.isProducing) ? 0 : 1),
      queueRemaining: Number.isFinite(queueRemainingRaw) ? Math.max(0, Math.floor(queueRemainingRaw)) : 0,
      producedAmount: Number.isFinite(producedAmountRaw) ? Math.max(0, Math.floor(producedAmountRaw)) : 0,
      lastTick: Number.isFinite(lastTickRaw) ? Math.max(0, Math.floor(lastTickRaw)) : now,
      productionRemainder: Number.isFinite(remainderRaw) ? Math.max(0, remainderRaw) : 0
    };
  }

  function createPharmacyDefaultSlots(now = Date.now()) {
    return PHARMACY_SLOT_CONFIG.map((slot) => createPharmacyDefaultSlot(slot.id, slot.resourceKey, now));
  }

  function createPharmacyDefaultState(now = Date.now()) {
    return {
      level: 1,
      slots: createPharmacyDefaultSlots(now),
      resources: createPharmacyResourceMap(),
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      lastIncomeAt: now,
      cooldowns: {
        recon: 0,
        action: 0,
        neuro: 0
      },
      effects: {
        reconUntil: 0,
        actionUntil: 0,
        neuroUntil: 0
      }
    };
  }

  function sanitizePharmacyState(rawState, now = Date.now()) {
    const fallback = createPharmacyDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, PHARMACY_CONFIG.maxLevel)
      : 1;
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};
    const slotsRaw = Array.isArray(rawState?.slots) ? rawState.slots : [];
    const fallbackSlots = createPharmacyDefaultSlots(now);
    const slots = fallbackSlots.map((fallbackSlot, index) =>
      sanitizePharmacySlot(slotsRaw[index], fallbackSlot, now)
    );
    const resources = createPharmacyResourceMap(rawState?.resources);
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);

    if (!slotsRaw.length && rawState?.resources && typeof rawState.resources === "object") {
      // Backward compatibility with older pharmacy state without slot system.
      slots.forEach((slot) => {
        slot.producedAmount = Math.max(0, Math.floor(Number(resources[slot.resourceKey] || 0)));
      });
    }

    return {
      level,
      slots,
      resources,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, Math.floor(lastIncomeAt)) : fallback.lastIncomeAt,
      cooldowns: {
        recon: Math.max(0, Number(cooldownsRaw.recon || 0)),
        action: Math.max(0, Number(cooldownsRaw.action || 0)),
        neuro: Math.max(0, Number(cooldownsRaw.neuro || 0))
      },
      effects: {
        reconUntil: Math.max(0, Number(effectsRaw.reconUntil || 0)),
        actionUntil: Math.max(0, Number(effectsRaw.actionUntil || 0)),
        neuroUntil: Math.max(0, Number(effectsRaw.neuroUntil || 0))
      }
    };
  }

  function getPharmacyStateByKey(instanceKey, now = Date.now()) {
    const current = pharmacyBuildingStore[instanceKey];
    const sanitized = sanitizePharmacyState(current, now);
    pharmacyBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistPharmacyState(instanceKey, nextState) {
    pharmacyBuildingStore[instanceKey] = sanitizePharmacyState(nextState, Date.now());
    savePharmacyBuildingStore();
    return pharmacyBuildingStore[instanceKey];
  }

  function getPharmacyUpgradeCost(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 2, PHARMACY_CONFIG.maxLevel);
    const rawCost = 5000 * Math.pow(1.47, safeLevel - 2);
    return Math.max(1000, Math.round(rawCost / 100) * 100);
  }

  function getPharmacyLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, PHARMACY_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * PHARMACY_CONFIG.upgradePctPerLevel;
  }

  function calculatePharmacyProductionRates(levelMultiplier = 1) {
    const multiplier = Math.max(0, Number(levelMultiplier) || 0);
    const buildingMultiplier = 1 + getPharmacyProductionBonusPct() / 100;
    const policePenaltyMultiplier = Math.max(0, 1 - getGlobalPoliceRaidProductionPenaltyPct("lab", Date.now()) / 100);
    return {
      chemicalsPerHour: PHARMACY_CONFIG.baseProductionPerHour.chemicals * multiplier * buildingMultiplier * policePenaltyMultiplier,
      biomassPerHour: PHARMACY_CONFIG.baseProductionPerHour.biomass * multiplier * buildingMultiplier * policePenaltyMultiplier,
      stimPackPerHour: PHARMACY_CONFIG.baseProductionPerHour.stimPack * multiplier * buildingMultiplier * policePenaltyMultiplier
    };
  }

  function calculatePharmacyCashRates(levelMultiplier = 1) {
    const multiplier = Math.max(0, Number(levelMultiplier) || 0);
    return {
      hourlyCleanIncome: PHARMACY_CONFIG.baseCleanIncomePerHour * multiplier,
      hourlyDirtyIncome: PHARMACY_CONFIG.baseDirtyIncomePerHour * multiplier
    };
  }

  function syncPharmacyProduction(instanceState, now = Date.now()) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getPharmacyLevelMultiplier(stateRef.level);
    const rates = calculatePharmacyProductionRates(levelMultiplier);
    const produced = createPharmacyResourceMap({}, false);
    const safeSlots = Array.isArray(stateRef.slots) && stateRef.slots.length
      ? stateRef.slots
      : createPharmacyDefaultSlots(nowMs);
    const defaultSlots = createPharmacyDefaultSlots(nowMs);

    stateRef.slots = safeSlots.map((rawSlot, index) =>
      sanitizePharmacySlot(rawSlot, defaultSlots[index], nowMs)
    );

    const rateByResource = {
      chemicals: rates.chemicalsPerHour,
      biomass: rates.biomassPerHour,
      stimPack: rates.stimPackPerHour
    };
    const resourceCaps = PHARMACY_CONFIG.slotStorageCaps || {};
    const slotCapMultiplier = getPharmacyStorageCapMultiplier();

    stateRef.slots.forEach((slot) => {
      let from = Number(slot.lastTick || nowMs);
      if (!Number.isFinite(from) || from > nowMs) {
        from = nowMs;
      }
      if (!slot.isProducing) {
        slot.lastTick = nowMs;
        return;
      }
      const elapsedMs = Math.max(0, nowMs - from);
      if (elapsedMs <= 0) {
        slot.lastTick = nowMs;
        return;
      }
      const resourceKey = PHARMACY_RESOURCE_KEYS.includes(slot.resourceKey) ? slot.resourceKey : null;
      if (!resourceKey) {
        slot.lastTick = nowMs;
        slot.productionRemainder = 0;
        return;
      }
      const queuedRemaining = Math.max(0, Math.floor(Number(slot.queueRemaining || 0)));
      if (queuedRemaining <= 0) {
        slot.isProducing = false;
        slot.lastTick = nowMs;
        slot.productionRemainder = 0;
        return;
      }
      const perHour = Math.max(0, Number(rateByResource[resourceKey] || 0));
      const raw = (elapsedMs / 3600000) * perHour + Number(slot.productionRemainder || 0);
      const gained = Math.max(0, Math.floor(raw));
      slot.productionRemainder = Math.max(0, raw - gained);
      if (gained > 0) {
        const baseCapRaw = Number(resourceCaps[resourceKey]);
        const capRaw = Number.isFinite(baseCapRaw) ? Math.max(0, Math.floor(baseCapRaw * slotCapMultiplier)) : Number.NaN;
        const hasCap = Number.isFinite(capRaw);
        const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
        const freeSpace = hasCap ? Math.max(0, Math.floor(capRaw - currentAmount)) : gained;
        const storable = hasCap ? Math.min(gained, freeSpace, queuedRemaining) : Math.min(gained, queuedRemaining);
        if (storable > 0) {
          slot.producedAmount = Math.max(0, currentAmount + storable);
          stateRef.resources[resourceKey] = Math.max(0, Math.floor(Number(stateRef.resources[resourceKey] || 0) + storable));
          produced[resourceKey] = Math.max(0, Math.floor(Number(produced[resourceKey] || 0) + storable));
          slot.queueRemaining = Math.max(0, queuedRemaining - storable);
        }
        if (hasCap && storable < gained) {
          slot.productionRemainder = 0;
        }
        if (Math.max(0, Math.floor(Number(slot.queueRemaining || 0))) <= 0) {
          slot.isProducing = false;
          slot.productionRemainder = 0;
        }
        if (hasCap && Math.max(0, Math.floor(Number(slot.producedAmount || 0))) >= Math.floor(capRaw)) {
          slot.isProducing = false;
        }
      }
      slot.lastTick = nowMs;
    });

    const activeSlots = stateRef.slots.reduce((sum, slot) => sum + (slot.isProducing ? 1 : 0), 0);
    return { rates, produced, levelMultiplier, activeSlots };
  }

  function syncPharmacyIncome(instanceState, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getPharmacyLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const rates = calculatePharmacyCashRates(levelMultiplier);

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      rates: {
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier
      }
    };
  }

  function createSimpleCashBuildingDefaultState(now = Date.now()) {
    return {
      level: 1,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      influenceRemainder: 0,
      lastIncomeAt: now,
      lastInfluenceAt: now,
      cooldowns: {
        nightTransport: 0,
        bigShipment: 0,
        rerouteFlow: 0,
        salesBoost: 0,
        aggressivePush: 0,
        territoryExpansion: 0,
        vipNight: 0,
        privateServices: 0,
        dirtyDeals: 0,
        playerTracking: 0,
        hackIncome: 0,
        dataBoost: 0,
        stockpile: 0,
        quickDistribution: 0,
        hiddenStorage: 0,
        optimizeProduction: 0,
        experimentalSeries: 0,
        technologyUpgrade: 0,
        processWaste: 0,
        breakShipment: 0,
        emergencyRecovery: 0
      },
      effects: {
        nightTransportUntil: 0,
        rerouteFlowUntil: 0,
        salesBoostUntil: 0,
        aggressivePushUntil: 0,
        vipNightUntil: 0,
        vipNightMultiplier: 1,
        dirtyDealsUntil: 0,
        hackIncomeUntil: 0,
        dataBoostUntil: 0,
        quickDistributionUntil: 0,
        hiddenStorageUntil: 0,
        optimizeProductionUntil: 0,
        experimentalSeriesUntil: 0,
        technologyUpgradeUntil: 0
      },
      stacks: {
        dealerTerritory: 0
      },
      streetDealerSlots: createStreetDealerDefaultSlots(now),
      streetDealerLastHeatTickAt: now,
      dataCenterTrackingOwner: "",
      dataCenterHackTargetDistrictId: "",
      warehouseLastMaterialsSummary: "",
      researchLastExperimentFailedAt: 0,
      recyclingLastRecoveryAt: 0
    };
  }

  function sanitizeSimpleCashBuildingState(rawState, now = Date.now()) {
    const fallback = createSimpleCashBuildingDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const incomeRemainderClean = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirty = Number(rawState?.incomeRemainderDirty || 0);
    const influenceRemainder = Number(rawState?.influenceRemainder || 0);
    const lastIncomeAt = Number(rawState?.lastIncomeAt || now);
    const lastInfluenceAt = Number(rawState?.lastInfluenceAt || now);
    const lastGossipAt = Number(rawState?.lastGossipAt || 0);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};
    const stacksRaw = rawState?.stacks || {};
    const streetDealerSlotsRaw = Array.isArray(rawState?.streetDealerSlots) ? rawState.streetDealerSlots : [];
    const fallbackStreetDealerSlots = createStreetDealerDefaultSlots(now);
    const streetDealerSlots = fallbackStreetDealerSlots.map((fallbackSlot, index) =>
      sanitizeStreetDealerSlot(streetDealerSlotsRaw[index], fallbackSlot, now)
    );
    const streetDealerLastHeatTickAtRaw = Number(rawState?.streetDealerLastHeatTickAt || now);
    return {
      level: Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1,
      incomeRemainderClean: Number.isFinite(incomeRemainderClean) ? Math.max(0, incomeRemainderClean) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirty) ? Math.max(0, incomeRemainderDirty) : 0,
      influenceRemainder: Number.isFinite(influenceRemainder) ? Math.max(0, influenceRemainder) : 0,
      lastIncomeAt: Number.isFinite(lastIncomeAt) ? Math.max(0, Math.floor(lastIncomeAt)) : fallback.lastIncomeAt,
      lastInfluenceAt: Number.isFinite(lastInfluenceAt) ? Math.max(0, Math.floor(lastInfluenceAt)) : fallback.lastInfluenceAt,
      cooldowns: {
        nightTransport: Math.max(0, Number(cooldownsRaw.nightTransport || 0)),
        bigShipment: Math.max(0, Number(cooldownsRaw.bigShipment || 0)),
        rerouteFlow: Math.max(0, Number(cooldownsRaw.rerouteFlow || 0)),
        salesBoost: Math.max(0, Number(cooldownsRaw.salesBoost || 0)),
        aggressivePush: Math.max(0, Number(cooldownsRaw.aggressivePush || 0)),
        territoryExpansion: Math.max(0, Number(cooldownsRaw.territoryExpansion || 0)),
        vipNight: Math.max(0, Number(cooldownsRaw.vipNight || 0)),
        privateServices: Math.max(0, Number(cooldownsRaw.privateServices || 0)),
        dirtyDeals: Math.max(0, Number(cooldownsRaw.dirtyDeals || 0)),
        playerTracking: Math.max(0, Number(cooldownsRaw.playerTracking || 0)),
        hackIncome: Math.max(0, Number(cooldownsRaw.hackIncome || 0)),
        dataBoost: Math.max(0, Number(cooldownsRaw.dataBoost || 0)),
        stockpile: Math.max(0, Number(cooldownsRaw.stockpile || 0)),
        quickDistribution: Math.max(0, Number(cooldownsRaw.quickDistribution || 0)),
        hiddenStorage: Math.max(0, Number(cooldownsRaw.hiddenStorage || 0)),
        optimizeProduction: Math.max(0, Number(cooldownsRaw.optimizeProduction || 0)),
        experimentalSeries: Math.max(0, Number(cooldownsRaw.experimentalSeries || 0)),
        technologyUpgrade: Math.max(0, Number(cooldownsRaw.technologyUpgrade || 0)),
        processWaste: Math.max(0, Number(cooldownsRaw.processWaste || 0)),
        breakShipment: Math.max(0, Number(cooldownsRaw.breakShipment || 0)),
        emergencyRecovery: Math.max(0, Number(cooldownsRaw.emergencyRecovery || 0))
      },
      effects: {
        nightTransportUntil: Math.max(0, Number(effectsRaw.nightTransportUntil || 0)),
        rerouteFlowUntil: Math.max(0, Number(effectsRaw.rerouteFlowUntil || 0)),
        salesBoostUntil: Math.max(0, Number(effectsRaw.salesBoostUntil || 0)),
        aggressivePushUntil: Math.max(0, Number(effectsRaw.aggressivePushUntil || 0)),
        vipNightUntil: Math.max(0, Number(effectsRaw.vipNightUntil || 0)),
        vipNightMultiplier: Math.max(1, Math.floor(Number(effectsRaw.vipNightMultiplier || 1))),
        dirtyDealsUntil: Math.max(0, Number(effectsRaw.dirtyDealsUntil || 0)),
        hackIncomeUntil: Math.max(0, Number(effectsRaw.hackIncomeUntil || 0)),
        dataBoostUntil: Math.max(0, Number(effectsRaw.dataBoostUntil || 0)),
        quickDistributionUntil: Math.max(0, Number(effectsRaw.quickDistributionUntil || 0)),
        hiddenStorageUntil: Math.max(0, Number(effectsRaw.hiddenStorageUntil || 0)),
        optimizeProductionUntil: Math.max(0, Number(effectsRaw.optimizeProductionUntil || 0)),
        experimentalSeriesUntil: Math.max(0, Number(effectsRaw.experimentalSeriesUntil || 0)),
        technologyUpgradeUntil: Math.max(0, Number(effectsRaw.technologyUpgradeUntil || 0))
      },
      stacks: {
        dealerTerritory: Math.max(0, Math.floor(Number(stacksRaw.dealerTerritory || 0)))
      },
      streetDealerSlots,
      streetDealerLastHeatTickAt: Number.isFinite(streetDealerLastHeatTickAtRaw)
        ? Math.max(0, Math.floor(streetDealerLastHeatTickAtRaw))
        : fallback.streetDealerLastHeatTickAt,
      dataCenterTrackingOwner: String(rawState?.dataCenterTrackingOwner || "").trim(),
      dataCenterHackTargetDistrictId: String(rawState?.dataCenterHackTargetDistrictId || "").trim(),
      warehouseLastMaterialsSummary: String(rawState?.warehouseLastMaterialsSummary || "").trim(),
      researchLastExperimentFailedAt: Math.max(0, Number(rawState?.researchLastExperimentFailedAt || 0)),
      recyclingLastRecoveryAt: Math.max(0, Number(rawState?.recyclingLastRecoveryAt || 0))
    };
  }

  function getSimpleCashBuildingStateByKey(instanceKey, now = Date.now()) {
    const current = simpleCashBuildingStore[instanceKey];
    const sanitized = sanitizeSimpleCashBuildingState(current, now);
    simpleCashBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistSimpleCashBuildingState(instanceKey, nextState) {
    simpleCashBuildingStore[instanceKey] = sanitizeSimpleCashBuildingState(nextState, Date.now());
    saveSimpleCashBuildingStore();
    return simpleCashBuildingStore[instanceKey];
  }

  function resolveCleanDirtySplitCost(totalCost, cleanRatio = 0.8) {
    const total = Math.max(0, Math.floor(Number(totalCost) || 0));
    const ratio = Math.max(0, Math.min(1, Number(cleanRatio) || 0));
    const cleanCost = Math.max(0, Math.floor(total * ratio));
    const dirtyCost = Math.max(0, total - cleanCost);
    return { total, cleanCost, dirtyCost };
  }

  function formatUpgradeCostLabel(mechanicsType, nextUpgradeCost) {
    const totalCost = Math.max(0, Math.floor(Number(nextUpgradeCost) || 0));
    if (mechanicsType === "smuggling-tunnel") {
      const split = resolveCleanDirtySplitCost(totalCost, 0.8);
      return `C$${split.cleanCost} + D$${split.dirtyCost}`;
    }
    return `$${totalCost}`;
  }

  function createFactoryResourceMap(rawMap = {}, floorValues = true) {
    return FACTORY_RESOURCE_KEYS.reduce((acc, key) => {
      const parsed = Number(rawMap?.[key] || 0);
      const safeValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      acc[key] = floorValues ? Math.floor(safeValue) : safeValue;
      return acc;
    }, {});
  }

  function createFactoryPlayerSupplyMap(rawMap = {}) {
    return createFactoryResourceMap(rawMap, true);
  }

  function createFactoryDefaultSlot(slotId, resourceKey, mode, now = Date.now()) {
    return {
      id: Math.max(1, Math.floor(Number(slotId) || 0)),
      resourceKey: String(resourceKey || "").trim(),
      mode: String(mode || "produce").trim(),
      isProducing: false,
      producedAmount: 0,
      lastTick: now,
      productionRemainder: 0
    };
  }

  function sanitizeFactorySlot(rawSlot, fallbackSlot, now = Date.now()) {
    const id = Math.max(1, Math.floor(Number(rawSlot?.id ?? fallbackSlot?.id ?? 1) || 1));
    const expectedResourceKey = String(fallbackSlot?.resourceKey || "").trim();
    const resourceKeyRaw = String(rawSlot?.resourceKey || expectedResourceKey).trim();
    const resourceKey = FACTORY_RESOURCE_KEYS.includes(resourceKeyRaw) ? resourceKeyRaw : expectedResourceKey;
    const expectedMode = String(fallbackSlot?.mode || "produce").trim();
    const modeRaw = String(rawSlot?.mode || expectedMode).trim().toLowerCase();
    const mode = modeRaw === "craft" ? "craft" : "produce";
    const producedAmountRaw = Number(rawSlot?.producedAmount || 0);
    const lastTickRaw = Number(rawSlot?.lastTick || now);
    const remainderRaw = Number(rawSlot?.productionRemainder || 0);
    return {
      id,
      resourceKey,
      mode,
      isProducing: Boolean(rawSlot?.isProducing),
      producedAmount: Number.isFinite(producedAmountRaw) ? Math.max(0, Math.floor(producedAmountRaw)) : 0,
      lastTick: Number.isFinite(lastTickRaw) ? Math.max(0, Math.floor(lastTickRaw)) : now,
      productionRemainder: Number.isFinite(remainderRaw) ? Math.max(0, remainderRaw) : 0
    };
  }

  function createFactoryDefaultSlots(now = Date.now()) {
    return FACTORY_SLOT_CONFIG.map((slot) =>
      createFactoryDefaultSlot(slot.id, slot.resourceKey, slot.mode, now)
    );
  }

  function createFactoryDefaultState(now = Date.now()) {
    return {
      level: 1,
      slots: createFactoryDefaultSlots(now),
      resources: createFactoryResourceMap(),
      cooldowns: {
        assault: 0,
        rapid: 0,
        breach: 0
      },
      effects: {
        assaultUntil: 0,
        rapidUntil: 0,
        breachUntil: 0
      }
    };
  }

  function sanitizeFactoryState(rawState, now = Date.now()) {
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, FACTORY_CONFIG.maxLevel)
      : 1;
    const slotsRaw = Array.isArray(rawState?.slots) ? rawState.slots : [];
    const fallbackSlots = createFactoryDefaultSlots(now);
    const slots = fallbackSlots.map((fallbackSlot, index) =>
      sanitizeFactorySlot(slotsRaw[index], fallbackSlot, now)
    );
    const resources = createFactoryResourceMap(rawState?.resources);
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};

    if (!slotsRaw.length && rawState?.resources && typeof rawState.resources === "object") {
      slots.forEach((slot) => {
        slot.producedAmount = Math.max(0, Math.floor(Number(resources[slot.resourceKey] || 0)));
      });
    }

    return {
      level,
      slots,
      resources,
      cooldowns: {
        assault: Math.max(0, Number(cooldownsRaw.assault || 0)),
        rapid: Math.max(0, Number(cooldownsRaw.rapid || 0)),
        breach: Math.max(0, Number(cooldownsRaw.breach || 0))
      },
      effects: {
        assaultUntil: Math.max(0, Number(effectsRaw.assaultUntil || 0)),
        rapidUntil: Math.max(0, Number(effectsRaw.rapidUntil || 0)),
        breachUntil: Math.max(0, Number(effectsRaw.breachUntil || 0))
      }
    };
  }

  function getFactoryStateByKey(instanceKey, now = Date.now()) {
    const current = factoryBuildingStore[instanceKey];
    const sanitized = sanitizeFactoryState(current, now);
    factoryBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistFactoryState(instanceKey, nextState) {
    factoryBuildingStore[instanceKey] = sanitizeFactoryState(nextState, Date.now());
    saveFactoryBuildingStore();
    return factoryBuildingStore[instanceKey];
  }

  function getFactoryPlayerSuppliesSnapshot() {
    factoryPlayerSupplies = createFactoryPlayerSupplyMap(factoryPlayerSupplies);
    return factoryPlayerSupplies;
  }

  function persistFactoryPlayerSuppliesSnapshot(nextState) {
    factoryPlayerSupplies = createFactoryPlayerSupplyMap(nextState);
    saveFactoryPlayerSupplies();
    return factoryPlayerSupplies;
  }

  function getFactoryUpgradeCost(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 2, FACTORY_CONFIG.maxLevel);
    const rawCost = 5000 * Math.pow(1.47, safeLevel - 2);
    return Math.max(1000, Math.round(rawCost / 100) * 100);
  }

  function getFactoryLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, FACTORY_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * FACTORY_CONFIG.upgradePctPerLevel;
  }

  function calculateFactoryProductionRates(levelMultiplier = 1) {
    const multiplier = Math.max(0, Number(levelMultiplier) || 0);
    return {
      metalPartsPerHour: FACTORY_CONFIG.baseProductionPerHour.metalParts * multiplier,
      techCorePerHour: FACTORY_CONFIG.baseProductionPerHour.techCore * multiplier,
      combatModulePerHour: ((60 * 60 * 1000) / FACTORY_CONFIG.combatModule.durationMs) * multiplier
    };
  }

  function syncFactoryProduction(instanceState, now = Date.now(), options = {}) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getFactoryLevelMultiplier(stateRef.level);
    const ownedFactoryCountRaw = Number(options?.ownedFactoryCount);
    const ownedFactoryCount = Number.isFinite(ownedFactoryCountRaw)
      ? Math.max(1, Math.floor(ownedFactoryCountRaw))
      : Math.max(1, collectOwnedFactoryEntries().length || 1);
    const networkBonusRaw = Number(options?.networkProductionBonusPct);
    const networkProductionBonusPct = Number.isFinite(networkBonusRaw)
      ? Math.max(0, networkBonusRaw)
      : Math.max(0, (ownedFactoryCount - 1) * 10);
    const totalProductionMultiplier = Math.max(
      0.1,
      levelMultiplier * (1 + networkProductionBonusPct / 100)
    );
    const researchBoost = getOwnedResearchCenterProductionBoostSnapshot(nowMs);
    const researchFactoryMultiplier = Math.max(0.01, Number(researchBoost.factorySpeedMultiplier || 1));
    const factoryPenaltyPct = getGlobalPoliceRaidProductionPenaltyPct("factory", nowMs);
    const factoryPenaltyMultiplier = Math.max(0, 1 - factoryPenaltyPct / 100);
    const effectiveProductionMultiplier = totalProductionMultiplier * researchFactoryMultiplier * factoryPenaltyMultiplier;
    const rates = calculateFactoryProductionRates(effectiveProductionMultiplier);
    const produced = createFactoryResourceMap({}, false);
    const applyHeat = options?.applyHeat !== false;
    let heatAdded = 0;

    stateRef.resources = createFactoryResourceMap(stateRef.resources);
    const safeSlots = Array.isArray(stateRef.slots) && stateRef.slots.length
      ? stateRef.slots
      : createFactoryDefaultSlots(nowMs);
    const defaultSlots = createFactoryDefaultSlots(nowMs);
    stateRef.slots = safeSlots.map((rawSlot, index) =>
      sanitizeFactorySlot(rawSlot, defaultSlots[index], nowMs)
    );

    stateRef.slots.forEach((slot) => {
      let from = Number(slot.lastTick || nowMs);
      if (!Number.isFinite(from) || from > nowMs) {
        from = nowMs;
      }
      if (!slot.isProducing) {
        slot.lastTick = nowMs;
        return;
      }
      const elapsedMs = Math.max(0, nowMs - from);
      if (elapsedMs <= 0) {
        slot.lastTick = nowMs;
        return;
      }

      if (effectiveProductionMultiplier <= 0) {
        slot.lastTick = nowMs;
        return;
      }

      if (slot.mode === "craft" || slot.resourceKey === "combatModule") {
        const scaledDurationMs = Math.max(
          1,
          Math.round(FACTORY_CONFIG.combatModule.durationMs / effectiveProductionMultiplier)
        );
        const cycleRaw =
          elapsedMs / scaledDurationMs
          + Number(slot.productionRemainder || 0);
        const cycles = Math.max(0, Math.floor(cycleRaw));
        slot.productionRemainder = Math.max(0, cycleRaw - cycles);
        if (cycles > 0) {
          const maxFromMetal = Math.floor(
            Number(stateRef.resources.metalParts || 0) / FACTORY_CONFIG.combatModule.metalPartsCost
          );
          const maxFromTech = Math.floor(
            Number(stateRef.resources.techCore || 0) / FACTORY_CONFIG.combatModule.techCoreCost
          );
          const crafted = Math.max(0, Math.min(cycles, maxFromMetal, maxFromTech));
          if (crafted > 0) {
            const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
            const slotSpace = Math.max(0, FACTORY_SLOT_STORAGE_CAP - currentAmount);
            const storable = Math.min(crafted, slotSpace);
            stateRef.resources.metalParts = Math.max(
              0,
              Math.floor(
                Number(stateRef.resources.metalParts || 0)
                - crafted * FACTORY_CONFIG.combatModule.metalPartsCost
              )
            );
            stateRef.resources.techCore = Math.max(
              0,
              Math.floor(
                Number(stateRef.resources.techCore || 0)
                - crafted * FACTORY_CONFIG.combatModule.techCoreCost
              )
            );
            stateRef.resources.combatModule = Math.max(
              0,
              Math.floor(Number(stateRef.resources.combatModule || 0) + crafted)
            );
            slot.producedAmount = Math.max(0, currentAmount + storable);
            produced.combatModule = Math.max(0, Math.floor(Number(produced.combatModule || 0) + crafted));
            heatAdded += crafted * FACTORY_CONFIG.combatModule.heatPerUnit;
          }
        }
      } else {
        const perHour = slot.resourceKey === "metalParts"
          ? rates.metalPartsPerHour
          : rates.techCorePerHour;
        const raw = (elapsedMs / 3600000) * Math.max(0, Number(perHour || 0)) + Number(slot.productionRemainder || 0);
        const gained = Math.max(0, Math.floor(raw));
        slot.productionRemainder = Math.max(0, raw - gained);
        if (gained > 0) {
          const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
          const slotSpace = Math.max(0, FACTORY_SLOT_STORAGE_CAP - currentAmount);
          const storable = Math.min(gained, slotSpace);
          slot.producedAmount = Math.max(0, currentAmount + storable);
          stateRef.resources[slot.resourceKey] = Math.max(
            0,
            Math.floor(Number(stateRef.resources[slot.resourceKey] || 0) + gained)
          );
          produced[slot.resourceKey] = Math.max(
            0,
            Math.floor(Number(produced[slot.resourceKey] || 0) + gained)
          );
        }
      }
      slot.lastTick = nowMs;
    });

    const activeSlots = stateRef.slots.reduce((sum, slot) => sum + (slot.isProducing ? 1 : 0), 0);
    let nextHeat = null;
    if (applyHeat && heatAdded > 0) {
      nextHeat = addPlayerHeatFromBuilding(heatAdded);
    }

    return {
      rates,
      produced,
      levelMultiplier,
      totalProductionMultiplier: effectiveProductionMultiplier,
      ownedFactoryCount,
      networkProductionBonusPct,
      activeSlots,
      heatAdded,
      nextHeat
    };
  }

  function createArmoryWeaponMap(rawMap = {}, floorValues = true) {
    return ARMORY_WEAPON_KEYS.reduce((acc, key) => {
      const parsed = Number(rawMap?.[key] || 0);
      const safeValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      acc[key] = floorValues ? Math.floor(safeValue) : safeValue;
      return acc;
    }, {});
  }

  function resolveArmoryCollectableWeapons(rawState) {
    const storedWeapons = createArmoryWeaponMap(rawState?.storedWeapons);
    const slotProducedWeapons = createArmoryWeaponMap();
    const safeSlots = Array.isArray(rawState?.slots) ? rawState.slots : [];

    safeSlots.forEach((rawSlot) => {
      const weaponKey = ARMORY_WEAPON_KEYS.includes(String(rawSlot?.weaponKey || "").trim())
        ? String(rawSlot.weaponKey).trim()
        : null;
      if (!weaponKey) return;
      slotProducedWeapons[weaponKey] += Math.max(0, Math.floor(Number(rawSlot?.producedAmount || 0)));
    });

    return ARMORY_WEAPON_KEYS.reduce((acc, weaponKey) => {
      acc[weaponKey] = Math.max(
        0,
        Math.floor(
          Math.max(
            Number(storedWeapons[weaponKey] || 0),
            Number(slotProducedWeapons[weaponKey] || 0)
          )
        )
      );
      return acc;
    }, createArmoryWeaponMap());
  }

  function createArmoryDefaultSlot(slotId, weaponKey, now = Date.now()) {
    const safeWeaponKey = String(weaponKey || "").trim();
    const config = ARMORY_CONFIG.weapons[safeWeaponKey] || null;
    const category = config?.category === "defense" ? "defense" : "attack";
    return {
      id: Math.max(1, Math.floor(Number(slotId) || 0)),
      weaponKey: safeWeaponKey,
      category,
      isProducing: false,
      producedAmount: 0,
      batchMaxUnits: 0,
      queuedUnits: 1,
      remainingUnits: 0,
      lastTick: now,
      productionRemainder: 0
    };
  }

  function sanitizeArmorySlot(rawSlot, fallbackSlot, now = Date.now()) {
    const id = Math.max(1, Math.floor(Number(rawSlot?.id ?? fallbackSlot?.id ?? 1) || 1));
    const expectedWeaponKey = String(fallbackSlot?.weaponKey || "").trim();
    const weaponKeyRaw = String(rawSlot?.weaponKey || expectedWeaponKey).trim();
    const weaponKey = ARMORY_WEAPON_KEYS.includes(weaponKeyRaw) ? weaponKeyRaw : expectedWeaponKey;
    const config = ARMORY_CONFIG.weapons[weaponKey] || null;
    const category = config?.category === "defense" ? "defense" : "attack";
    const producedAmountRaw = Number(rawSlot?.producedAmount || 0);
    const batchMaxUnitsRaw = Number(rawSlot?.batchMaxUnits || 0);
    const queuedUnitsRaw = Number(rawSlot?.queuedUnits || 1);
    const remainingUnitsRaw = Number(rawSlot?.remainingUnits || 0);
    const lastTickRaw = Number(rawSlot?.lastTick || now);
    const remainderRaw = Number(rawSlot?.productionRemainder || 0);
    return {
      id,
      weaponKey,
      category,
      isProducing: Boolean(rawSlot?.isProducing),
      producedAmount: Number.isFinite(producedAmountRaw) ? Math.max(0, Math.floor(producedAmountRaw)) : 0,
      batchMaxUnits: Number.isFinite(batchMaxUnitsRaw) ? clamp(Math.floor(batchMaxUnitsRaw), 0, ARMORY_BATCH_MAX_UNITS) : 0,
      queuedUnits: Number.isFinite(queuedUnitsRaw) ? clamp(Math.floor(queuedUnitsRaw), 1, ARMORY_BATCH_MAX_UNITS) : 1,
      remainingUnits: Number.isFinite(remainingUnitsRaw) ? Math.max(0, Math.floor(remainingUnitsRaw)) : 0,
      lastTick: Number.isFinite(lastTickRaw) ? Math.max(0, Math.floor(lastTickRaw)) : now,
      productionRemainder: Number.isFinite(remainderRaw) ? Math.max(0, remainderRaw) : 0
    };
  }

  function createArmoryDefaultSlots(now = Date.now()) {
    return ARMORY_SLOT_CONFIG.map((slot) => createArmoryDefaultSlot(slot.id, slot.weaponKey, now));
  }

  function createArmoryDefaultCooldownState() {
    return {
      attackBoost: 0,
      defenseBoost: 0
    };
  }

  function createArmoryDefaultEffectState() {
    return {
      attackBoostUntil: 0,
      defenseBoostUntil: 0
    };
  }

  function createArmoryDefaultState(now = Date.now()) {
    return {
      level: 1,
      slots: createArmoryDefaultSlots(now),
      storedWeapons: createArmoryWeaponMap(),
      cooldowns: createArmoryDefaultCooldownState(),
      effects: createArmoryDefaultEffectState(),
      boostHeatRemainder: 0,
      lastBoostHeatAt: now
    };
  }

  function sanitizeArmoryState(rawState, now = Date.now()) {
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, ARMORY_CONFIG.maxLevel)
      : 1;
    const slotsRaw = Array.isArray(rawState?.slots) ? rawState.slots : [];
    const fallbackSlots = createArmoryDefaultSlots(now);
    const slots = fallbackSlots.map((fallbackSlot, index) =>
      sanitizeArmorySlot(slotsRaw[index], fallbackSlot, now)
    );
    const storedWeapons = createArmoryWeaponMap(rawState?.storedWeapons || rawState?.resources || {});
    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};
    const boostHeatRemainderRaw = Number(rawState?.boostHeatRemainder || 0);
    const lastBoostHeatAtRaw = Number(rawState?.lastBoostHeatAt || now);

    if (!slotsRaw.length && rawState?.storedWeapons && typeof rawState.storedWeapons === "object") {
      slots.forEach((slot) => {
        slot.producedAmount = Math.max(0, Math.floor(Number(storedWeapons[slot.weaponKey] || 0)));
      });
    }

    return {
      level,
      slots,
      storedWeapons,
      cooldowns: {
        attackBoost: Math.max(0, Number(cooldownsRaw.attackBoost || 0)),
        defenseBoost: Math.max(0, Number(cooldownsRaw.defenseBoost || 0))
      },
      effects: {
        attackBoostUntil: Math.max(0, Number(effectsRaw.attackBoostUntil || 0)),
        defenseBoostUntil: Math.max(0, Number(effectsRaw.defenseBoostUntil || 0))
      },
      boostHeatRemainder: Number.isFinite(boostHeatRemainderRaw) ? Math.max(0, boostHeatRemainderRaw) : 0,
      lastBoostHeatAt: Number.isFinite(lastBoostHeatAtRaw) ? Math.max(0, Math.floor(lastBoostHeatAtRaw)) : now
    };
  }

  function getArmoryStateByKey(instanceKey, now = Date.now()) {
    const current = armoryBuildingStore[instanceKey];
    const sanitized = sanitizeArmoryState(current, now);
    armoryBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistArmoryState(instanceKey, nextState) {
    armoryBuildingStore[instanceKey] = sanitizeArmoryState(nextState, Date.now());
    saveArmoryBuildingStore();
    return armoryBuildingStore[instanceKey];
  }

  function getArmoryUpgradeCost(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 2, ARMORY_CONFIG.maxLevel);
    const rawCost = 5000 * Math.pow(1.47, safeLevel - 2);
    return Math.max(1000, Math.round(rawCost / 100) * 100);
  }

  function getArmoryLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, ARMORY_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * ARMORY_CONFIG.upgradePctPerLevel;
  }

  function calculateArmoryProductionRates(levelMultiplier = 1, options = {}) {
    const multiplier = Math.max(0, Number(levelMultiplier) || 0);
    const attackMultiplier = Math.max(0, Number(options?.attackMultiplier) || 0);
    const defenseMultiplier = Math.max(0, Number(options?.defenseMultiplier) || 0);
    return ARMORY_WEAPON_KEYS.reduce((acc, key) => {
      const weapon = ARMORY_CONFIG.weapons[key];
      const basePerHour = 3600000 / Math.max(1, Number(weapon.durationMs || 1));
      const categoryMultiplier = weapon?.category === "defense" ? defenseMultiplier : attackMultiplier;
      acc[key] = basePerHour * multiplier * categoryMultiplier;
      return acc;
    }, {});
  }

  function getArmoryBoostSnapshot(armoryState, now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const effects = armoryState?.effects || {};
    const attackBoostActive = Number(effects.attackBoostUntil || 0) > nowMs;
    const defenseBoostActive = Number(effects.defenseBoostUntil || 0) > nowMs;
    const attackProductionMultiplier = attackBoostActive
      ? (1 + ARMORY_SPECIAL_ACTIONS.attackBoost.productionBoostPct / 100)
      : 1;
    const defenseProductionMultiplier = defenseBoostActive
      ? (1 + ARMORY_SPECIAL_ACTIONS.defenseBoost.productionBoostPct / 100)
      : 1;
    const passiveHeatPerHour =
      (attackBoostActive ? ARMORY_SPECIAL_ACTIONS.attackBoost.passiveHeatPerHour : 0)
      + (defenseBoostActive ? ARMORY_SPECIAL_ACTIONS.defenseBoost.passiveHeatPerHour : 0);
    const activeLabels = [];
    if (attackBoostActive) {
      activeLabels.push(`Attack gun boost +${ARMORY_SPECIAL_ACTIONS.attackBoost.productionBoostPct}%`);
    }
    if (defenseBoostActive) {
      activeLabels.push(`Defense gun boost +${ARMORY_SPECIAL_ACTIONS.defenseBoost.productionBoostPct}%`);
    }
    return {
      attackBoostActive,
      defenseBoostActive,
      attackProductionMultiplier,
      defenseProductionMultiplier,
      passiveHeatPerHour,
      activeLabels,
      activeCount: activeLabels.length
    };
  }

  function applyArmoryPassiveBoostHeat(armoryState, now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    let from = Number(armoryState?.lastBoostHeatAt || nowMs);
    if (!Number.isFinite(from) || from > nowMs) {
      from = nowMs;
    }
    let gained = 0;
    if (from < nowMs) {
      const effects = armoryState?.effects || {};
      const attackUntil = Math.max(0, Number(effects.attackBoostUntil || 0));
      const defenseUntil = Math.max(0, Number(effects.defenseBoostUntil || 0));
      const attackStart = Math.max(0, attackUntil - ARMORY_SPECIAL_ACTIONS.attackBoost.durationMs);
      const defenseStart = Math.max(0, defenseUntil - ARMORY_SPECIAL_ACTIONS.defenseBoost.durationMs);
      const attackOverlapMs = Math.max(0, Math.min(nowMs, attackUntil) - Math.max(from, attackStart));
      const defenseOverlapMs = Math.max(0, Math.min(nowMs, defenseUntil) - Math.max(from, defenseStart));
      const rawHeat =
        (attackOverlapMs / 3600000) * ARMORY_SPECIAL_ACTIONS.attackBoost.passiveHeatPerHour
        + (defenseOverlapMs / 3600000) * ARMORY_SPECIAL_ACTIONS.defenseBoost.passiveHeatPerHour
        + Math.max(0, Number(armoryState?.boostHeatRemainder || 0));
      gained = Math.max(0, Math.floor(rawHeat));
      armoryState.boostHeatRemainder = Math.max(0, rawHeat - gained);
    }
    armoryState.lastBoostHeatAt = nowMs;
    let nextHeat = null;
    if (gained > 0) {
      nextHeat = addPlayerHeatFromBuilding(gained);
    }
    return { gained, nextHeat };
  }

  function syncArmoryProduction(instanceState, now = Date.now(), options = {}) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getArmoryLevelMultiplier(stateRef.level);
    const ownedArmoryCountRaw = Number(options?.ownedArmoryCount);
    const ownedArmoryCount = Number.isFinite(ownedArmoryCountRaw)
      ? Math.max(1, Math.floor(ownedArmoryCountRaw))
      : Math.max(1, collectOwnedArmoryEntries().length || 1);
    const networkBonusRaw = Number(options?.networkProductionBonusPct);
    const networkProductionBonusPct = Number.isFinite(networkBonusRaw)
      ? Math.max(0, networkBonusRaw)
      : Math.max(0, (ownedArmoryCount - 1) * 10);
    const baseProductionMultiplier = Math.max(
      0.1,
      levelMultiplier * (1 + networkProductionBonusPct / 100)
    );
    const researchBoost = getOwnedResearchCenterProductionBoostSnapshot(nowMs);
    const researchArmoryMultiplier = Math.max(0.01, Number(researchBoost.armorySpeedMultiplier || 1));
    const boostSnapshot = getArmoryBoostSnapshot(stateRef, nowMs);
    const armoryPenaltyPct = getGlobalPoliceRaidProductionPenaltyPct("armory", nowMs);
    const armoryPenaltyMultiplier = Math.max(0, 1 - armoryPenaltyPct / 100);
    const rates = calculateArmoryProductionRates(baseProductionMultiplier, {
      attackMultiplier: boostSnapshot.attackProductionMultiplier * armoryPenaltyMultiplier * researchArmoryMultiplier,
      defenseMultiplier: boostSnapshot.defenseProductionMultiplier * armoryPenaltyMultiplier * researchArmoryMultiplier
    });
    const produced = createArmoryWeaponMap({}, false);
    const applyHeat = options?.applyHeat !== false;
    let heatAdded = 0;

    stateRef.storedWeapons = createArmoryWeaponMap(stateRef.storedWeapons);
    const safeSlots = Array.isArray(stateRef.slots) && stateRef.slots.length
      ? stateRef.slots
      : createArmoryDefaultSlots(nowMs);
    const defaultSlots = createArmoryDefaultSlots(nowMs);
    stateRef.slots = safeSlots.map((rawSlot, index) =>
      sanitizeArmorySlot(rawSlot, defaultSlots[index], nowMs)
    );

    const factorySupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    let factorySuppliesChanged = false;

    stateRef.slots.forEach((slot) => {
      let from = Number(slot.lastTick || nowMs);
      if (!Number.isFinite(from) || from > nowMs) {
        from = nowMs;
      }
      if (!slot.isProducing) {
        slot.lastTick = nowMs;
        return;
      }
      const elapsedMs = Math.max(0, nowMs - from);
      if (elapsedMs <= 0) {
        slot.lastTick = nowMs;
        return;
      }
      const weaponKey = ARMORY_WEAPON_KEYS.includes(slot.weaponKey) ? slot.weaponKey : null;
      const weapon = weaponKey ? ARMORY_CONFIG.weapons[weaponKey] : null;
      if (!weapon) {
        slot.lastTick = nowMs;
        slot.productionRemainder = 0;
        return;
      }

      const categoryProductionMultiplier = baseProductionMultiplier
        * (slot.category === "defense"
          ? boostSnapshot.defenseProductionMultiplier
          : boostSnapshot.attackProductionMultiplier)
        * researchArmoryMultiplier
        * armoryPenaltyMultiplier;
      if (categoryProductionMultiplier <= 0) {
        slot.lastTick = nowMs;
        return;
      }
      const scaledDurationMs = Math.max(1, Math.round(Number(weapon.durationMs || 1) / categoryProductionMultiplier));
      const rawCycles = (elapsedMs / scaledDurationMs) + Number(slot.productionRemainder || 0);
      const cycles = Math.max(0, Math.floor(rawCycles));
      slot.productionRemainder = Math.max(0, rawCycles - cycles);
      if (cycles > 0) {
        const queuedRemaining = Math.max(0, Math.floor(Number(slot.remainingUnits || 0)));
        const usesQueuedMode = queuedRemaining > 0;
        let crafted = 0;
        if (queuedRemaining > 0) {
          crafted = Math.max(0, Math.min(cycles, queuedRemaining));
          slot.remainingUnits = Math.max(0, queuedRemaining - crafted);
        } else {
          const metalCost = Math.max(0, Math.floor(Number(weapon.metalPartsCost || 0)));
          const techCost = Math.max(0, Math.floor(Number(weapon.techCoreCost || 0)));
          const maxFromMetal = metalCost > 0
            ? Math.floor(Number(factorySupplies.metalParts || 0) / metalCost)
            : cycles;
          const maxFromTech = techCost > 0
            ? Math.floor(Number(factorySupplies.techCore || 0) / techCost)
            : cycles;
          crafted = Math.max(0, Math.min(cycles, maxFromMetal, maxFromTech));
          if (crafted > 0) {
            if (metalCost > 0) {
              factorySupplies.metalParts = Math.max(
                0,
                Math.floor(Number(factorySupplies.metalParts || 0) - crafted * metalCost)
              );
            }
            if (techCost > 0) {
              factorySupplies.techCore = Math.max(
                0,
                Math.floor(Number(factorySupplies.techCore || 0) - crafted * techCost)
              );
            }
            factorySuppliesChanged = true;
          }
        }
        if (crafted > 0) {
          stateRef.storedWeapons[weaponKey] = Math.max(
            0,
            Math.floor(Number(stateRef.storedWeapons[weaponKey] || 0) + crafted)
          );
          slot.producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0) + crafted));
          produced[weaponKey] = Math.max(0, Math.floor(Number(produced[weaponKey] || 0) + crafted));
          heatAdded += crafted * Math.max(0, Math.floor(Number(weapon.heatPerUnit || 0)));
        }
        if (usesQueuedMode && Number(slot.remainingUnits || 0) <= 0) {
          slot.isProducing = false;
          slot.productionRemainder = 0;
        }
      }
      const batchMaxUnits = Math.max(0, Math.floor(Number(slot.batchMaxUnits || 0)));
      const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
      if (batchMaxUnits > 0 && producedAmount > batchMaxUnits) {
        slot.producedAmount = batchMaxUnits;
      }
      slot.lastTick = nowMs;
    });

    if (factorySuppliesChanged) {
      persistFactoryPlayerSuppliesSnapshot(factorySupplies);
    }

    const activeSlots = stateRef.slots.reduce((sum, slot) => sum + (slot.isProducing ? 1 : 0), 0);
    let nextHeat = null;
    if (applyHeat && heatAdded > 0) {
      nextHeat = addPlayerHeatFromBuilding(heatAdded);
    }

    return {
      rates,
      produced,
      levelMultiplier,
      totalProductionMultiplier: baseProductionMultiplier,
      ownedArmoryCount,
      networkProductionBonusPct,
      activeSlots,
      heatAdded,
      nextHeat,
      factorySupplies: createFactoryPlayerSupplyMap(factorySupplies),
      boostSnapshot
    };
  }

  function createDrugLabAmountMap(rawMap = {}) {
    return DRUG_LAB_DRUG_KEYS.reduce((acc, key) => {
      const value = Number(rawMap?.[key] || 0);
      acc[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      return acc;
    }, {});
  }

  function createDrugLabSupplyMap(rawMap = {}) {
    return DRUG_LAB_SUPPLY_KEYS.reduce((acc, key) => {
      const value = Number(rawMap?.[key] || 0);
      acc[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      return acc;
    }, {});
  }

  function createDefaultDrugLabEffectState() {
    return { active: false, endsAt: 0, potencyMultiplier: 1 };
  }

  function createDefaultDrugLabActiveEffects() {
    return {
      neonDust: createDefaultDrugLabEffectState(),
      pulseShot: createDefaultDrugLabEffectState(),
      velvetSmoke: createDefaultDrugLabEffectState(),
      ghostSerum: createDefaultDrugLabEffectState(),
      overdriveX: createDefaultDrugLabEffectState(),
      overdriveCrash: createDefaultDrugLabEffectState()
    };
  }

  function sanitizeDrugLabEffectState(raw) {
    const active = Boolean(raw?.active);
    const endsAtRaw = Number(raw?.endsAt || 0);
    const potencyRaw = Number(raw?.potencyMultiplier || 1);
    return {
      active,
      endsAt: Number.isFinite(endsAtRaw) ? Math.max(0, Math.floor(endsAtRaw)) : 0,
      potencyMultiplier: Number.isFinite(potencyRaw) ? Math.max(1, potencyRaw) : 1
    };
  }

  function sanitizeDrugLabEventLogEntry(rawEntry) {
    const text = String(rawEntry?.text || "").trim();
    if (!text) return null;
    const createdAt = Math.max(0, Math.floor(Number(rawEntry?.createdAt) || Date.now()));
    const id = String(rawEntry?.id || `${createdAt}-${Math.floor(Math.random() * 1000000)}`);
    return { id, text, createdAt };
  }

  function createDrugLabDefaultSlot(slotId, now = Date.now()) {
    return {
      id: slotId,
      activeDrugType: "neonDust",
      isProducing: false,
      queuedUnits: 1,
      queueRemaining: 0,
      producedAmount: 0,
      lastTick: now,
      startedAt: 0,
      productionRemainder: 0
    };
  }

  function sanitizeDrugLabSlot(rawSlot, slotId, now = Date.now()) {
    const activeDrugTypeRaw = String(rawSlot?.activeDrugType || "").trim();
    const activeDrugType = DRUG_CONFIG[activeDrugTypeRaw] ? activeDrugTypeRaw : "neonDust";
    const producedAmountRaw = Number(rawSlot?.producedAmount || 0);
    const queuedUnitsRaw = Number(rawSlot?.queuedUnits ?? (rawSlot?.isProducing ? 0 : 1));
    const queueRemainingRaw = Number(rawSlot?.queueRemaining || 0);
    const lastTickRaw = Number(rawSlot?.lastTick || now);
    const startedAtRaw = Number(rawSlot?.startedAt || 0);
    const remainderRaw = Number(rawSlot?.productionRemainder || 0);
    const isProducing = Boolean(rawSlot?.isProducing);
    return {
      id: slotId,
      activeDrugType,
      isProducing,
      queuedUnits: Number.isFinite(queuedUnitsRaw)
        ? clamp(Math.floor(queuedUnitsRaw), isProducing ? 0 : 1, 999)
        : (isProducing ? 0 : 1),
      queueRemaining: Number.isFinite(queueRemainingRaw) ? Math.max(0, Math.floor(queueRemainingRaw)) : 0,
      producedAmount: Number.isFinite(producedAmountRaw) ? Math.max(0, Math.floor(producedAmountRaw)) : 0,
      lastTick: Number.isFinite(lastTickRaw) ? Math.max(0, Math.floor(lastTickRaw)) : now,
      startedAt: Number.isFinite(startedAtRaw) ? Math.max(0, Math.floor(startedAtRaw)) : 0,
      productionRemainder: Number.isFinite(remainderRaw) ? Math.max(0, remainderRaw) : 0
    };
  }

  function createDrugLabDefaultState(now = Date.now()) {
    return {
      level: 1,
      slots: Array.from({ length: DRUG_LAB_CONFIG.maxSlots }, (_, index) => createDrugLabDefaultSlot(index + 1, now)),
      storage: createDrugLabAmountMap(),
      storageEnhanced: createDrugLabAmountMap(),
      heatRemainder: 0,
      incomeRemainderClean: 0,
      incomeRemainderDirty: 0,
      lastHeatAt: now,
      lastIncomeAt: now,
      cooldowns: {
        overclock: 0,
        cleanBatch: 0,
        hiddenOperation: 0
      },
      effects: {
        overclockUntil: 0,
        cleanBatchUntil: 0,
        hiddenOperationUntil: 0
      }
    };
  }

  function sanitizeDrugLabState(rawState, now = Date.now()) {
    const fallback = createDrugLabDefaultState(now);
    const levelRaw = Number(rawState?.level);
    const level = Number.isFinite(levelRaw)
      ? clamp(Math.floor(levelRaw), 1, DRUG_LAB_CONFIG.maxLevel)
      : 1;

    const slotsRaw = Array.isArray(rawState?.slots) ? rawState.slots : [];
    const slots = Array.from({ length: DRUG_LAB_CONFIG.maxSlots }, (_, index) =>
      sanitizeDrugLabSlot(slotsRaw[index], index + 1, now)
    );

    const cooldownsRaw = rawState?.cooldowns || {};
    const effectsRaw = rawState?.effects || {};
    const heatRemainderRaw = Number(rawState?.heatRemainder || 0);
    const incomeRemainderCleanRaw = Number(rawState?.incomeRemainderClean || 0);
    const incomeRemainderDirtyRaw = Number(rawState?.incomeRemainderDirty || 0);
    const lastHeatAtRaw = Number(rawState?.lastHeatAt || now);
    const lastIncomeAtRaw = Number(rawState?.lastIncomeAt || now);

    return {
      level,
      slots,
      storage: createDrugLabAmountMap(rawState?.storage),
      storageEnhanced: createDrugLabAmountMap(rawState?.storageEnhanced),
      heatRemainder: Number.isFinite(heatRemainderRaw) ? Math.max(0, heatRemainderRaw) : 0,
      incomeRemainderClean: Number.isFinite(incomeRemainderCleanRaw) ? Math.max(0, incomeRemainderCleanRaw) : 0,
      incomeRemainderDirty: Number.isFinite(incomeRemainderDirtyRaw) ? Math.max(0, incomeRemainderDirtyRaw) : 0,
      lastHeatAt: Number.isFinite(lastHeatAtRaw) ? Math.max(0, Math.floor(lastHeatAtRaw)) : fallback.lastHeatAt,
      lastIncomeAt: Number.isFinite(lastIncomeAtRaw) ? Math.max(0, Math.floor(lastIncomeAtRaw)) : fallback.lastIncomeAt,
      cooldowns: {
        overclock: Math.max(0, Number(cooldownsRaw.overclock || 0)),
        cleanBatch: Math.max(0, Number(cooldownsRaw.cleanBatch || 0)),
        hiddenOperation: Math.max(0, Number(cooldownsRaw.hiddenOperation || 0))
      },
      effects: {
        overclockUntil: Math.max(0, Number(effectsRaw.overclockUntil || 0)),
        cleanBatchUntil: Math.max(0, Number(effectsRaw.cleanBatchUntil || 0)),
        hiddenOperationUntil: Math.max(0, Number(effectsRaw.hiddenOperationUntil || 0))
      }
    };
  }

  function createDrugLabPlayerDefaultState(now = Date.now()) {
    return {
      totalHeat: 0,
      hasWarehouse: false,
      activeDrugEffects: createDefaultDrugLabActiveEffects(),
      enhancedDrugs: createDrugLabAmountMap(),
      labSupplies: createDrugLabSupplyMap(),
      eventLog: [],
      lastUpdatedAt: now
    };
  }

  function sanitizeDrugLabPlayerState(rawState, now = Date.now()) {
    const fallback = createDrugLabPlayerDefaultState(now);
    const effectsRaw = rawState?.activeDrugEffects || {};
    const activeDrugEffects = createDefaultDrugLabActiveEffects();
    Object.keys(activeDrugEffects).forEach((key) => {
      activeDrugEffects[key] = sanitizeDrugLabEffectState(effectsRaw[key]);
    });
    const rawLog = Array.isArray(rawState?.eventLog) ? rawState.eventLog : [];
    const eventLog = rawLog
      .map((entry) => sanitizeDrugLabEventLogEntry(entry))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, DRUG_LAB_EVENT_LOG_LIMIT);
    const totalHeatRaw = Number(rawState?.totalHeat || 0);
    const lastUpdatedAtRaw = Number(rawState?.lastUpdatedAt || now);

    return {
      totalHeat: Number.isFinite(totalHeatRaw) ? Math.max(0, Math.floor(totalHeatRaw)) : 0,
      hasWarehouse: Boolean(rawState?.hasWarehouse),
      activeDrugEffects,
      enhancedDrugs: createDrugLabAmountMap(rawState?.enhancedDrugs),
      labSupplies: createDrugLabSupplyMap(rawState?.labSupplies || rawState?.pharmacyResources || {}),
      eventLog,
      lastUpdatedAt: Number.isFinite(lastUpdatedAtRaw) ? Math.max(0, Math.floor(lastUpdatedAtRaw)) : fallback.lastUpdatedAt
    };
  }

  function getDrugLabStateByKey(instanceKey, now = Date.now()) {
    const current = drugLabBuildingStore[instanceKey];
    const sanitized = sanitizeDrugLabState(current, now);
    drugLabBuildingStore[instanceKey] = sanitized;
    return sanitized;
  }

  function persistDrugLabState(instanceKey, nextState) {
    drugLabBuildingStore[instanceKey] = sanitizeDrugLabState(nextState, Date.now());
    saveDrugLabBuildingStore();
    return drugLabBuildingStore[instanceKey];
  }

  function getDrugLabPlayerSnapshot(now = Date.now()) {
    drugLabPlayerState = sanitizeDrugLabPlayerState(drugLabPlayerState, now);
    return drugLabPlayerState;
  }

  function persistDrugLabPlayerSnapshot(nextState) {
    drugLabPlayerState = sanitizeDrugLabPlayerState(nextState, Date.now());
    saveDrugLabPlayerState();
    return drugLabPlayerState;
  }

  function isWarehouseBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "sklad" || normalized === "warehouse";
  }

  function getOwnedWarehouseCountForDrugLab() {
    const districts = Array.isArray(state.districts) ? state.districts : [];
    let total = 0;
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      buildings.forEach((building) => {
        if (isWarehouseBaseName(building)) {
          total += 1;
        }
      });
    });
    return Math.max(0, total);
  }

  const FACTORY_CASH_RATES = Object.freeze({
    hourlyCleanIncome: 0,
    hourlyDirtyIncome: 0
  });
  const ARMORY_CASH_RATES = Object.freeze({
    hourlyCleanIncome: 0,
    hourlyDirtyIncome: 0
  });
  const SIMPLE_BUILDING_CASH_RATES = Object.freeze({
    "Brainwash centrum": Object.freeze({
      hourlyCleanIncome: 480,
      hourlyDirtyIncome: 90
    }),
    "Magistrát": Object.freeze({
      hourlyCleanIncome: 1500,
      hourlyDirtyIncome: 360
    }),
    "Burza": Object.freeze({
      hourlyCleanIncome: 1080,
      hourlyDirtyIncome: 60
    }),
    "Centrální banka": Object.freeze({
      hourlyCleanIncome: 1560,
      hourlyDirtyIncome: 60
    }),
    "Letiště": Object.freeze({
      hourlyCleanIncome: 1140,
      hourlyDirtyIncome: 60
    }),
    "Lobby klub": Object.freeze({
      hourlyCleanIncome: 180,
      hourlyDirtyIncome: 1320
    }),
    "VIP salonek": Object.freeze({
      hourlyCleanIncome: 480,
      hourlyDirtyIncome: 1320
    }),
    "Parlament": Object.freeze({
      hourlyCleanIncome: 1320,
      hourlyDirtyIncome: 180
    }),
    "Přístav": Object.freeze({
      hourlyCleanIncome: 1560,
      hourlyDirtyIncome: 510
    }),
    "Soud": Object.freeze({
      hourlyCleanIncome: 1200,
      hourlyDirtyIncome: 600
    }),
    "Pašovací tunel": Object.freeze({
      hourlyCleanIncome: 100,
      hourlyDirtyIncome: 260
    }),
    "Pouliční dealeři": Object.freeze({
      hourlyCleanIncome: 6,
      hourlyDirtyIncome: 270
    }),
    "Strip club": Object.freeze({
      hourlyCleanIncome: 220,
      hourlyDirtyIncome: 200
    }),
    Garage: Object.freeze({
      hourlyCleanIncome: 180,
      hourlyDirtyIncome: 30
    }),
    "Taxi služba": Object.freeze({
      hourlyCleanIncome: 330,
      hourlyDirtyIncome: 90
    }),
    Klinika: Object.freeze({
      hourlyCleanIncome: 150,
      hourlyDirtyIncome: 18
    }),
    "Rekrutační centrum": Object.freeze({
      hourlyCleanIncome: 120,
      hourlyDirtyIncome: 18
    }),
    "Datové centrum": Object.freeze({
      hourlyCleanIncome: 300,
      hourlyDirtyIncome: 180
    }),
    "Výzkumné centrum": Object.freeze({
      hourlyCleanIncome: 220,
      hourlyDirtyIncome: 140
    }),
    "Recyklační centrum": Object.freeze({
      hourlyCleanIncome: 170,
      hourlyDirtyIncome: 130
    }),
    "Energetická stanice": Object.freeze({
      hourlyCleanIncome: 240,
      hourlyDirtyIncome: 18
    }),
    "Sklad": Object.freeze({
      hourlyCleanIncome: 120,
      hourlyDirtyIncome: 120
    }),
    "Kancelářský blok": Object.freeze({
      hourlyCleanIncome: 360,
      hourlyDirtyIncome: 60
    }),
    "Obchodní centrum": Object.freeze({
      hourlyCleanIncome: 480,
      hourlyDirtyIncome: 60
    })
  });
  const CONFIGURED_BUILDING_CASH_RATES = Object.freeze({
    ...SIMPLE_BUILDING_CASH_RATES,
    [APARTMENT_BLOCK_NAME]: Object.freeze({
      hourlyCleanIncome: 90,
      hourlyDirtyIncome: 30
    }),
    [SCHOOL_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 264,
      hourlyDirtyIncome: 60
    }),
    [FITNESS_CLUB_NAME]: Object.freeze({
      hourlyCleanIncome: 260,
      hourlyDirtyIncome: 160
    }),
    [CASINO_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 480,
      hourlyDirtyIncome: 132
    }),
    [ARCADE_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 360,
      hourlyDirtyIncome: 72
    }),
    [AUTO_SALON_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 300,
      hourlyDirtyIncome: 60
    }),
    [EXCHANGE_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 330,
      hourlyDirtyIncome: 78
    }),
    [RESTAURANT_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 300,
      hourlyDirtyIncome: 30
    }),
    [CONVENIENCE_STORE_BUILDING_NAME]: Object.freeze({
      hourlyCleanIncome: 210,
      hourlyDirtyIncome: 78
    })
  });

  function getDrugLabStorageCapacityMultiplier() {
    const warehouseCount = getOwnedWarehouseCountForDrugLab();
    if (warehouseCount <= 0) return 1;
    return Math.pow(1 + DRUG_LAB_CONFIG.storageBonusPerWarehousePct / 100, warehouseCount);
  }

  function getDrugLabStorageCapacityBonusPct() {
    return Math.max(0, (getDrugLabStorageCapacityMultiplier() - 1) * 100);
  }

  function getSafeDrugLabEconomySnapshot() {
    const getSnapshot = window.Empire.UI?.getEconomySnapshot;
    if (typeof getSnapshot === "function") {
      return getSnapshot();
    }
    return {
      cleanMoney: 0,
      dirtyMoney: 0,
      influence: 0,
      drugs: 0,
      drugInventory: createDrugLabAmountMap(),
      activeDrugs: {}
    };
  }

  function normalizeDrugLabInventoryFromEconomy(economy) {
    return createDrugLabAmountMap(economy?.drugInventory || economy || {});
  }

  function mapDrugLabEffectsToUiPayload(activeDrugEffects, now = Date.now()) {
    const safeEffects = activeDrugEffects && typeof activeDrugEffects === "object"
      ? activeDrugEffects
      : createDefaultDrugLabActiveEffects();
    return DRUG_LAB_DRUG_KEYS.reduce((acc, key) => {
      const stateRef = sanitizeDrugLabEffectState(safeEffects[key]);
      const remainingSeconds = stateRef.active
        ? Math.max(0, Math.ceil((Number(stateRef.endsAt || 0) - now) / 1000))
        : 0;
      acc[key] = { active: stateRef.active && remainingSeconds > 0, remainingSeconds };
      return acc;
    }, {});
  }

  function applyDrugLabEconomySnapshot(economy, inventory, playerState, now = Date.now()) {
    const safeEconomy = economy && typeof economy === "object" ? { ...economy } : {};
    const safeInventory = createDrugLabAmountMap(inventory);
    const totalDrugs = DRUG_LAB_DRUG_KEYS.reduce((sum, key) => sum + Number(safeInventory[key] || 0), 0);
    safeEconomy.drugInventory = {
      ...(safeEconomy.drugInventory && typeof safeEconomy.drugInventory === "object" ? safeEconomy.drugInventory : {}),
      ...safeInventory
    };
    safeEconomy.drugs = totalDrugs;
    safeEconomy.activeDrugs = mapDrugLabEffectsToUiPayload(playerState?.activeDrugEffects, now);
    const updateEconomy = window.Empire.UI?.updateEconomy;
    if (typeof updateEconomy === "function") {
      updateEconomy(safeEconomy);
    }
    return safeEconomy;
  }

  function resolveDrugLabSchoolBoostPct(instanceKey, now = Date.now()) {
    const districtPart = String(instanceKey || "").split(":")[0] || "";
    if (!districtPart) {
      return { passivePct: 0, chemistryPct: 0, totalPct: 0 };
    }
    let passivePct = 0;
    let chemistryPct = 0;
    Object.entries(schoolBuildingStore || {}).forEach(([key, rawState]) => {
      const keyDistrictPart = String(key || "").split(":")[0] || "";
      if (keyDistrictPart !== districtPart) return;
      const snapshot = sanitizeSchoolState(rawState, now);
      const levelMultiplier = getSchoolLevelMultiplier(snapshot.level);
      passivePct += SCHOOL_BUILDING_CONFIG.baseDrugLabPassiveBonusPct * levelMultiplier;
      if (now < Number(snapshot.effects.chemistryUntil || 0)) {
        chemistryPct += SCHOOL_BUILDING_CONFIG.chemistryBoostPct;
      }
    });
    const totalPct = Math.max(0, passivePct + chemistryPct);
    return { passivePct: Math.max(0, passivePct), chemistryPct: Math.max(0, chemistryPct), totalPct };
  }

  function getDrugLabEffectLabel(drugType) {
    if (drugType === "neonDust") return "Neon Dust";
    if (drugType === "pulseShot") return "Pulse Shot";
    if (drugType === "velvetSmoke") return "Velvet Smoke";
    if (drugType === "ghostSerum") return "Ghost Serum";
    if (drugType === "overdriveX") return "Overdrive X";
    if (drugType === "overdriveCrash") return "Overdrive Crash";
    return drugType;
  }

  function pushDrugLabLog(playerState, text, now = Date.now(), options = {}) {
    const entry = sanitizeDrugLabEventLogEntry({
      id: `${now}-${Math.floor(Math.random() * 1000000)}`,
      text,
      createdAt: now
    });
    if (!entry) return null;
    const existing = Array.isArray(playerState?.eventLog) ? playerState.eventLog : [];
    existing.unshift(entry);
    playerState.eventLog = existing
      .map((item) => sanitizeDrugLabEventLogEntry(item))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, DRUG_LAB_EVENT_LOG_LIMIT);
    if (!options?.silentUiEvent) {
      window.Empire.UI?.pushEvent?.(`Drug Lab: ${text}`);
    }
    return entry;
  }

  class DrugLabCore {
    constructor({ instanceKey, district, buildingState, playerState, inventory }) {
      this.instanceKey = instanceKey;
      this.district = district || null;
      this.building = buildingState;
      this.player = playerState;
      this.inventory = inventory;
    }

    getScaledStat(baseValue, level = this.building.level) {
      const safeBase = Number(baseValue || 0);
      const safeLevel = clamp(Math.floor(Number(level) || 1), 1, DRUG_LAB_CONFIG.maxLevel);
      return safeBase * (1 + (safeLevel - 1) * DRUG_LAB_CONFIG.upgradePctPerLevel);
    }

    getUnlockedSlotCount() {
      return clamp(Math.floor(Number(this.building.level) || 1), 1, DRUG_LAB_CONFIG.maxSlots);
    }

    getStorageCapacity() {
      return Math.max(1, Math.floor(DRUG_LAB_CONFIG.baseStorageCapacity * getDrugLabStorageCapacityMultiplier()));
    }

    getCurrentStoredTotal() {
      const normalTotal = DRUG_LAB_DRUG_KEYS.reduce((sum, key) => sum + Number(this.building.storage[key] || 0), 0);
      const enhancedTotal = DRUG_LAB_DRUG_KEYS.reduce(
        (sum, key) => sum + Number(this.building.storageEnhanced[key] || 0),
        0
      );
      return Math.max(0, Math.floor(normalTotal + enhancedTotal));
    }

    canStoreMore(amount) {
      const requested = Number.isFinite(Number(amount)) ? Math.max(0, Math.floor(Number(amount))) : 0;
      return this.getCurrentStoredTotal() + requested <= this.getStorageCapacity();
    }

    getSlotById(slotId) {
      const safeId = Math.max(1, Math.floor(Number(slotId) || 0));
      return this.building.slots.find((slot) => Number(slot.id) === safeId) || null;
    }

    isOverclockActive(now = Date.now()) {
      return now < Number(this.building.effects.overclockUntil || 0);
    }

    isCleanBatchActive(now = Date.now()) {
      return now < Number(this.building.effects.cleanBatchUntil || 0);
    }

    isHiddenOperationActive(now = Date.now()) {
      return now < Number(this.building.effects.hiddenOperationUntil || 0);
    }

    getSchoolProductionBoostPct(now = Date.now()) {
      return resolveDrugLabSchoolBoostPct(this.instanceKey, now).totalPct;
    }

    getProductionMultiplier(now = Date.now()) {
      let multiplier = this.getScaledStat(1, this.building.level);
      const schoolBoostPct = this.getSchoolProductionBoostPct(now);
      if (schoolBoostPct > 0) {
        multiplier *= 1 + schoolBoostPct / 100;
      }
      const networkBonusPct = getOwnedDrugLabNetworkProductionBonusPct();
      if (networkBonusPct > 0) {
        multiplier *= 1 + networkBonusPct / 100;
      }
      if (this.isOverclockActive(now)) {
        multiplier *= 1 + DRUG_LAB_CONFIG.specialActions.overclock.productionBoostPct / 100;
      }
      if (this.isHiddenOperationActive(now)) {
        multiplier *= 1 - DRUG_LAB_CONFIG.specialActions.hiddenOperation.productionPenaltyPct / 100;
      }
      if (this.player.activeDrugEffects.pulseShot.active && now < Number(this.player.activeDrugEffects.pulseShot.endsAt || 0)) {
        multiplier *= 1 + DRUG_LAB_CONFIG.pulseShotProductionBoostPct / 100;
      }
      if (
        this.player.activeDrugEffects.overdriveCrash.active
        && now < Number(this.player.activeDrugEffects.overdriveCrash.endsAt || 0)
      ) {
        multiplier *= 1 - DRUG_LAB_CONFIG.overdriveCrashPenaltyPct / 100;
      }
      const policePenaltyPct = getGlobalPoliceRaidProductionPenaltyPct("lab", now);
      if (policePenaltyPct > 0) {
        multiplier *= 1 - policePenaltyPct / 100;
      }
      const researchBoost = getOwnedResearchCenterProductionBoostSnapshot(now);
      multiplier *= Math.max(0.01, Number(researchBoost.drugLabSpeedMultiplier || 1));
      return Math.max(0, multiplier);
    }

    getHeatMultiplier(now = Date.now()) {
      let multiplier = 1;
      if (this.isHiddenOperationActive(now)) {
        multiplier *= 1 - DRUG_LAB_CONFIG.specialActions.hiddenOperation.heatReductionPct / 100;
      }
      if (
        this.player.activeDrugEffects.ghostSerum.active
        && now < Number(this.player.activeDrugEffects.ghostSerum.endsAt || 0)
      ) {
        multiplier *= 1 - DRUG_LAB_CONFIG.ghostSerumHeatReductionPct / 100;
      }
      return Math.max(0, multiplier);
    }

    startProduction(slotId, drugType, now = Date.now(), units = 1) {
      const slot = this.getSlotById(slotId);
      if (!slot) {
        return { ok: false, message: "Slot neexistuje." };
      }
      if (Number(slot.id) > this.getUnlockedSlotCount()) {
        return { ok: false, message: "Slot je zatím zamčený." };
      }
      const safeDrugType = String(drugType || slot.activeDrugType || "").trim();
      if (!DRUG_CONFIG[safeDrugType]) {
        return { ok: false, message: "Vyber drogu pro produkci." };
      }
      const safeUnits = clamp(
        Math.floor(Number(units) || Number(slot.queuedUnits) || (slot.isProducing ? 0 : 1)),
        slot.isProducing ? 0 : 1,
        999
      );
      if (slot.isProducing && Math.max(0, Math.floor(Number(slot.queueRemaining || 0))) > 0) {
        if (String(slot.activeDrugType || "").trim() !== safeDrugType) {
          return { ok: false, message: `Slot ${slot.id}: při běžící výrobě nelze změnit látku.` };
        }
        if (safeUnits <= 0) {
          return { ok: false, message: `Slot ${slot.id}: nastav počet dávek pro přidání.` };
        }
        slot.queuedUnits = 0;
        slot.queueRemaining = Math.max(0, Math.floor(Number(slot.queueRemaining || 0))) + safeUnits;
        slot.lastTick = now;
        return { ok: true, message: `Slot ${slot.id}: do fronty přidáno ${safeUnits} dávek.`, silentUiEvent: true };
      }
      slot.activeDrugType = safeDrugType;
      slot.queuedUnits = 0;
      slot.queueRemaining = safeUnits;
      slot.isProducing = true;
      slot.startedAt = slot.startedAt > 0 ? slot.startedAt : now;
      slot.lastTick = now;
      return { ok: true, message: `Slot ${slot.id}: produkce ${DRUG_CONFIG[safeDrugType].name} spuštěna (${safeUnits}x).` };
    }

    stopProduction(slotId, now = Date.now()) {
      const slot = this.getSlotById(slotId);
      if (!slot) {
        return { ok: false, message: "Slot neexistuje." };
      }
      if (!slot.isProducing) {
        return { ok: false, message: `Slot ${slot.id}: produkce neběží.` };
      }
      slot.isProducing = false;
      slot.queueRemaining = 0;
      slot.lastTick = now;
      return { ok: true, message: `Slot ${slot.id}: produkce zastavena.` };
    }

    updateProduction(now = Date.now()) {
      const unlockedSlots = this.getUnlockedSlotCount();
      const storageCapacity = this.getStorageCapacity();
      const productionMultiplier = this.getProductionMultiplier(now);
      const producedByDrug = createDrugLabAmountMap();

      this.building.slots.forEach((slot) => {
        if (Number(slot.id) > unlockedSlots) {
          slot.isProducing = false;
          slot.lastTick = now;
          slot.productionRemainder = 0;
          return;
        }
        if (!slot.isProducing) {
          slot.lastTick = now;
          return;
        }
        const drug = DRUG_CONFIG[slot.activeDrugType];
        if (!drug) {
          slot.isProducing = false;
          slot.lastTick = now;
          slot.productionRemainder = 0;
          return;
        }
        const previousTick = Number(slot.lastTick || now);
        const elapsedMs = Math.max(0, now - previousTick);
        if (elapsedMs <= 0) {
          slot.lastTick = now;
          return;
        }

        const totalStored = this.getCurrentStoredTotal();
        if (totalStored >= storageCapacity) {
          slot.lastTick = now;
          slot.productionRemainder = 0;
          return;
        }

        const hoursElapsed = elapsedMs / 3600000;
        const productionPerHour = drug.productionPerHour * productionMultiplier;
        const rawProduced = hoursElapsed * productionPerHour + Number(slot.productionRemainder || 0);
        const producedWhole = Math.max(0, Math.floor(rawProduced));
        slot.productionRemainder = Math.max(0, rawProduced - producedWhole);

        if (producedWhole > 0) {
          const queuedRemaining = Math.max(0, Math.floor(Number(slot.queueRemaining || 0)));
          const freeSpace = Math.max(0, storageCapacity - this.getCurrentStoredTotal());
          const storable = Math.max(
            0,
            Math.min(producedWhole, freeSpace, queuedRemaining > 0 ? queuedRemaining : producedWhole)
          );
          if (storable > 0) {
            const targetStorage = this.isCleanBatchActive(now) ? this.building.storageEnhanced : this.building.storage;
            targetStorage[drug.id] = Math.max(0, Number(targetStorage[drug.id] || 0) + storable);
            slot.producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0) + storable));
            producedByDrug[drug.id] += storable;
            if (queuedRemaining > 0) {
              slot.queueRemaining = Math.max(0, queuedRemaining - storable);
              if (slot.queueRemaining <= 0) {
                slot.isProducing = false;
                slot.productionRemainder = 0;
              }
            }
          }
          if (storable < producedWhole && this.getCurrentStoredTotal() >= storageCapacity) {
            slot.productionRemainder = 0;
          }
        }

        slot.lastTick = now;
      });

      return producedByDrug;
    }

    collectDrugs() {
      const collected = createDrugLabAmountMap();
      const collectedEnhanced = createDrugLabAmountMap();
      let total = 0;

      DRUG_LAB_DRUG_KEYS.forEach((key) => {
        const normalAmount = Math.max(0, Math.floor(Number(this.building.storage[key] || 0)));
        const enhancedAmount = Math.max(0, Math.floor(Number(this.building.storageEnhanced[key] || 0)));
        const fullAmount = normalAmount + enhancedAmount;
        this.building.storage[key] = 0;
        this.building.storageEnhanced[key] = 0;
        collected[key] = fullAmount;
        collectedEnhanced[key] = enhancedAmount;
        total += fullAmount;
      });

      return { total, collected, collectedEnhanced };
    }

    applyDrugEffect(drugType, now = Date.now(), potencyMultiplier = 1) {
      if (!DRUG_CONFIG[drugType]) {
        return { ok: false, message: "Neznámý efekt drogy." };
      }
      const stateRef = sanitizeDrugLabEffectState(this.player.activeDrugEffects[drugType] || {});
      stateRef.active = true;
      stateRef.endsAt = now + DRUG_CONFIG[drugType].effectDurationMs;
      stateRef.potencyMultiplier = Math.max(1, Number(potencyMultiplier) || 1);
      this.player.activeDrugEffects[drugType] = stateRef;
      return {
        ok: true,
        message: `${DRUG_CONFIG[drugType].name} aktivován na ${formatDurationLabel(DRUG_CONFIG[drugType].effectDurationMs)}.`
      };
    }

    useDrug(drugType, now = Date.now()) {
      const drug = DRUG_CONFIG[drugType];
      if (!drug) {
        return { ok: false, message: "Neznámá droga." };
      }
      const available = Math.max(0, Math.floor(Number(this.inventory[drugType] || 0)));
      if (available < drug.useAmount) {
        return { ok: false, message: `${drug.name}: nedostatek kusů (${available}/${drug.useAmount}).` };
      }

      const enhancedAvailable = Math.max(0, Math.floor(Number(this.player.enhancedDrugs[drugType] || 0)));
      const enhancedUsed = Math.min(drug.useAmount, enhancedAvailable);
      const potencyMultiplier = enhancedUsed > 0
        ? 1 + DRUG_LAB_CONFIG.specialActions.cleanBatch.effectBoostPct / 100
        : 1;

      this.inventory[drugType] = Math.max(0, available - drug.useAmount);
      this.player.enhancedDrugs[drugType] = Math.max(0, enhancedAvailable - enhancedUsed);

      const effectResult = this.applyDrugEffect(drugType, now, potencyMultiplier);
      if (!effectResult.ok) {
        return effectResult;
      }

      if (drugType === "overdriveX") {
        this.player.totalHeat = Math.max(0, Number(this.player.totalHeat || 0) + DRUG_LAB_CONFIG.overdriveUseImmediateHeat);
      }

      const messageParts = [`${drug.name} použita (${drug.useAmount} ks).`];
      if (enhancedUsed > 0) {
        messageParts.push("Čistá várka: +20 % síla efektu.");
      }
      if (drugType === "overdriveX") {
        messageParts.push(`Heat +${DRUG_LAB_CONFIG.overdriveUseImmediateHeat}.`);
      }
      return {
        ok: true,
        message: messageParts.join(" ")
      };
    }

    updateDrugEffects(now = Date.now()) {
      return this.updateTimedEffects(now);
    }

    calculateCurrentHeatPerHour(now = Date.now()) {
      const unlockedSlots = this.getUnlockedSlotCount();
      const baseHeatPerHour = this.building.slots.reduce((sum, slot) => {
        if (Number(slot.id) > unlockedSlots) return sum;
        if (!slot.isProducing) return sum;
        const drug = DRUG_CONFIG[slot.activeDrugType];
        if (!drug) return sum;
        return sum + Number(drug.heatPerHour || 0);
      }, 0);
      return Math.max(0, baseHeatPerHour * this.getHeatMultiplier(now));
    }

    applyPassiveHeat(now = Date.now()) {
      let from = Number(this.building.lastHeatAt || now);
      if (!Number.isFinite(from) || from > now) {
        from = now;
      }
      let gained = 0;
      if (from < now) {
        const hoursElapsed = (now - from) / 3600000;
        const rawHeat = hoursElapsed * this.calculateCurrentHeatPerHour(now) + Number(this.building.heatRemainder || 0);
        gained = Math.max(0, Math.floor(rawHeat));
        this.building.heatRemainder = Math.max(0, rawHeat - gained);
      }
      this.building.lastHeatAt = now;
      if (gained > 0) {
        this.player.totalHeat = Math.max(0, Math.floor(Number(this.player.totalHeat || 0) + gained));
      }
      return gained;
    }

    upgradeBuilding(player) {
      const nextLevel = Math.max(1, Math.floor(Number(this.building.level || 1)) + 1);
      if (nextLevel > DRUG_LAB_CONFIG.maxLevel) {
        return { ok: false, message: "Drug Lab je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(DRUG_LAB_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const spendResult = spend(cost);
      if (!spendResult?.ok) {
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      this.building.level = nextLevel;
      return { ok: true, message: `Drug Lab vylepšen na level ${nextLevel} za $${cost}.` };
    }

    useOverclock(player, now = Date.now()) {
      const cooldownLeft = Math.max(0, Number(this.building.cooldowns.overclock || 0) - now);
      if (cooldownLeft > 0) {
        return { ok: false, message: `Overclock je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      this.building.effects.overclockUntil = now + DRUG_LAB_CONFIG.specialActions.overclock.durationMs;
      this.building.cooldowns.overclock = now + DRUG_LAB_CONFIG.specialActions.overclock.cooldownMs;
      this.player.totalHeat = Math.max(
        0,
        Math.floor(Number(this.player.totalHeat || 0) + DRUG_LAB_CONFIG.specialActions.overclock.immediateHeat)
      );
      return {
        ok: true,
        message:
          `Overclock aktivní na ${formatDurationLabel(DRUG_LAB_CONFIG.specialActions.overclock.durationMs)}. `
          + `Produkce +${DRUG_LAB_CONFIG.specialActions.overclock.productionBoostPct} %, `
          + `heat +${DRUG_LAB_CONFIG.specialActions.overclock.immediateHeat}.`
      };
    }

    useCleanBatch(player, now = Date.now()) {
      const cooldownLeft = Math.max(0, Number(this.building.cooldowns.cleanBatch || 0) - now);
      if (cooldownLeft > 0) {
        return { ok: false, message: `Čistá várka je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      this.building.effects.cleanBatchUntil = now + DRUG_LAB_CONFIG.specialActions.cleanBatch.durationMs;
      this.building.cooldowns.cleanBatch = now + DRUG_LAB_CONFIG.specialActions.cleanBatch.cooldownMs;
      return {
        ok: true,
        message:
          `Čistá várka aktivní na ${formatDurationLabel(DRUG_LAB_CONFIG.specialActions.cleanBatch.durationMs)}. `
          + `Nové dávky budou mít +${DRUG_LAB_CONFIG.specialActions.cleanBatch.effectBoostPct} % sílu efektu.`
      };
    }

    useHiddenOperation(player, now = Date.now()) {
      const cooldownLeft = Math.max(0, Number(this.building.cooldowns.hiddenOperation || 0) - now);
      if (cooldownLeft > 0) {
        return { ok: false, message: `Skrytý provoz je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      this.building.effects.hiddenOperationUntil = now + DRUG_LAB_CONFIG.specialActions.hiddenOperation.durationMs;
      this.building.cooldowns.hiddenOperation = now + DRUG_LAB_CONFIG.specialActions.hiddenOperation.cooldownMs;
      return {
        ok: true,
        message:
          `Skrytý provoz aktivní na ${formatDurationLabel(DRUG_LAB_CONFIG.specialActions.hiddenOperation.durationMs)}. `
          + `Heat z výroby -${DRUG_LAB_CONFIG.specialActions.hiddenOperation.heatReductionPct} %, `
          + `produkce -${DRUG_LAB_CONFIG.specialActions.hiddenOperation.productionPenaltyPct} %.`
      };
    }

    updateTimedEffects(now = Date.now()) {
      const expiredEffects = [];
      Object.keys(this.player.activeDrugEffects || {}).forEach((effectKey) => {
        const stateRef = this.player.activeDrugEffects[effectKey];
        if (!stateRef?.active) return;
        const endsAt = Number(stateRef.endsAt || 0);
        if (now < endsAt) return;
        stateRef.active = false;
        stateRef.endsAt = 0;
        stateRef.potencyMultiplier = 1;
        expiredEffects.push(effectKey);
        if (effectKey === "overdriveX") {
          const crashRef = this.player.activeDrugEffects.overdriveCrash || createDefaultDrugLabEffectState();
          crashRef.active = true;
          crashRef.endsAt = now + DRUG_LAB_CONFIG.overdriveCrashDurationMs;
          crashRef.potencyMultiplier = 1;
          this.player.activeDrugEffects.overdriveCrash = crashRef;
          expiredEffects.push("overdriveCrash_started");
        }
      });
      return { expiredEffects };
    }
  }

  function persistDrugLabRuntime(sync, now = Date.now()) {
    persistDrugLabState(sync.instanceKey, sync.building);
    persistDrugLabPlayerSnapshot(sync.player);
    sync.economy = applyDrugLabEconomySnapshot(sync.economy, sync.inventory, sync.player, now);
    return sync;
  }

  function syncDrugLabIncome(instanceState, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getDrugLabLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const hourlyCleanIncome = Math.max(0, Number(DRUG_LAB_CONFIG.baseCleanIncomePerHour || 0))
      * levelMultiplier
      * districtIncomeMultiplier;
    const hourlyDirtyIncome = Math.max(0, Number(DRUG_LAB_CONFIG.baseDirtyIncomePerHour || 0))
      * levelMultiplier
      * districtIncomeMultiplier;

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw = hoursElapsed * hourlyCleanIncome + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw = hoursElapsed * hourlyDirtyIncome + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      rates: {
        hourlyCleanIncome,
        hourlyDirtyIncome,
        hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
      }
    };
  }

  function runDrugLabTick(context, district, now = Date.now()) {
    const instanceKey = resolveBuildingInstanceKey(context, district);
    const building = getDrugLabStateByKey(instanceKey, now);
    const player = getDrugLabPlayerSnapshot(now);
    const economy = getSafeDrugLabEconomySnapshot();
    const inventory = normalizeDrugLabInventoryFromEconomy(economy);
    const core = new DrugLabCore({
      instanceKey,
      district,
      buildingState: building,
      playerState: player,
      inventory
    });
    const incomeSync = syncDrugLabIncome(building, now, district || context?.districtId);
    const timed = core.updateTimedEffects(now);
    const producedByDrug = core.updateProduction(now);
    const heatAdded = core.applyPassiveHeat(now);
    const producedTotal = DRUG_LAB_DRUG_KEYS.reduce(
      (sum, key) => sum + Math.max(0, Math.floor(Number(producedByDrug?.[key] || 0))),
      0
    );
    if (producedTotal > 0) {
      const collected = core.collectDrugs();
      DRUG_LAB_DRUG_KEYS.forEach((key) => {
        inventory[key] = Math.max(0, Math.floor(Number(inventory[key] || 0) + Number(collected.collected[key] || 0)));
        player.enhancedDrugs[key] = Math.max(
          0,
          Math.floor(Number(player.enhancedDrugs[key] || 0) + Number(collected.collectedEnhanced[key] || 0))
        );
      });
    }

    if (Array.isArray(timed.expiredEffects) && timed.expiredEffects.length) {
      timed.expiredEffects.forEach((effectKey) => {
        if (effectKey === "overdriveCrash_started") {
          pushDrugLabLog(player, "Overdrive Crash aktivní: výkon -10 % na 1 hodinu.", now);
          return;
        }
        pushDrugLabLog(player, `Efekt ${getDrugLabEffectLabel(effectKey)} vypršel.`, now);
      });
    }

    persistDrugLabRuntime({ instanceKey, building, player, economy, inventory }, now);

    return {
      instanceKey,
      building,
      player,
      economy,
      inventory,
      core,
      timed,
      producedByDrug,
      heatAdded,
      incomeSync
    };
  }

  function formatDrugLabTimeLabel(timestampMs) {
    const safeTs = Math.max(0, Math.floor(Number(timestampMs) || 0));
    if (safeTs <= 0) return "-";
    try {
      return new Date(safeTs).toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return "-";
    }
  }

  function getApartmentLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, APARTMENT_BLOCK_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * APARTMENT_BLOCK_CONFIG.upgradePctPerLevel;
  }

  function getSchoolLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, SCHOOL_BUILDING_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * SCHOOL_BUILDING_CONFIG.upgradePctPerLevel;
  }

  function getFitnessLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, FITNESS_BUILDING_CONFIG.maxLevel);
    const incomeMultiplier =
      1
      + (level >= 2 ? 0.10 : 0)
      + (level >= 4 ? 0.20 : 0);
    const actionEffectMultiplier = level >= 3 ? 1.15 : 1;
    const heatMultiplier = level >= 4 ? 1.05 : 1;
    const permanentAttackPct = level >= 5 ? 10 : 0;
    const permanentDefensePct = level >= 5 ? 5 : 0;
    return {
      level,
      incomeMultiplier,
      actionEffectMultiplier,
      heatMultiplier,
      permanentAttackPct,
      permanentDefensePct
    };
  }

  function getFitnessLevelMultiplier(levelRaw) {
    return getFitnessLevelEffects(levelRaw).incomeMultiplier;
  }

  function getCasinoLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, CASINO_BUILDING_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * CASINO_BUILDING_CONFIG.upgradePctPerLevel;
  }

  function getArcadeLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, ARCADE_BUILDING_CONFIG.maxLevel);
    if (safeLevel >= 4) return 1.2;
    if (safeLevel >= 2) return 1.1;
    return 1;
  }

  function getAutoSalonLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, AUTO_SALON_BUILDING_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * AUTO_SALON_BUILDING_CONFIG.upgradePctPerLevel;
  }

  function getExchangeLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, EXCHANGE_BUILDING_CONFIG.maxLevel);
    return safeLevel >= 2 ? 1.1 : 1;
  }

  function getRestaurantLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, RESTAURANT_BUILDING_CONFIG.maxLevel);
    if (safeLevel >= 4) return 1.3;
    if (safeLevel >= 2) return 1.1;
    return 1;
  }

  function getConvenienceStoreLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, CONVENIENCE_STORE_BUILDING_CONFIG.maxLevel);
    return safeLevel >= 4 ? 1.3 : safeLevel >= 2 ? 1.1 : 1;
  }

  function getDrugLabLevelMultiplier(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 1), 1, DRUG_LAB_CONFIG.maxLevel);
    return 1 + (safeLevel - 1) * DRUG_LAB_CONFIG.upgradePctPerLevel;
  }

  function formatDecimalValue(value, maxFractions = 2) {
    const safe = Number(value || 0);
    if (!Number.isFinite(safe)) return "0";
    const formatted = safe.toFixed(maxFractions);
    return formatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
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

  function formatProductionDurationLabel(ms) {
    const safe = Math.max(0, Math.floor(Number(ms) || 0));
    const totalSeconds = Math.max(1, Math.ceil(safe / 1000));
    if (totalSeconds < 3600) return `${totalSeconds}s`;
    const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    return `${hours}h`;
  }

  function payoutBuildingIncome(totalIncome) {
    const total = Math.max(0, Math.floor(Number(totalIncome) || 0));
    if (total <= 0) return { total: 0, clean: 0, dirty: 0 };

    const dirtyBase = Math.max(0, Math.floor(total * BUILDING_INCOME_DIRTY_RATIO));
    const cleanBase = Math.max(0, Math.floor(total * BUILDING_INCOME_CLEAN_RATIO));
    const roundingRemainder = Math.max(0, total - (cleanBase + dirtyBase));
    const cleanPayout = cleanBase + roundingRemainder;
    const dirtyPayout = dirtyBase;
    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;

    if (cleanPayout > 0 && typeof addClean === "function") {
      addClean(cleanPayout);
    }

    if (dirtyPayout > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyPayout);
      } else if (typeof addClean === "function") {
        addClean(dirtyPayout);
      }
    }

    return { total, clean: cleanPayout, dirty: dirtyPayout };
  }

  function payoutDirectBuildingIncome(cleanIncome = 0, dirtyIncome = 0) {
    const cleanPayout = Math.max(0, Math.floor(Number(cleanIncome) || 0));
    const dirtyPayout = Math.max(0, Math.floor(Number(dirtyIncome) || 0));
    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;

    if (cleanPayout > 0 && typeof addClean === "function") {
      addClean(cleanPayout);
    }
    if (dirtyPayout > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyPayout);
      } else if (typeof addClean === "function") {
        addClean(dirtyPayout);
      }
    }

    return {
      total: cleanPayout + dirtyPayout,
      clean: cleanPayout,
      dirty: dirtyPayout
    };
  }

  function syncSimpleCashBuildingIncome(instanceState, rates, now = Date.now(), districtOrId = null, options = {}) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const extraIncomePct = Math.max(0, Number(options?.extraIncomePct || 0));
    const extraCleanIncomePct = Math.max(0, Number(options?.extraCleanIncomePct || 0));
    const extraDirtyIncomePct = Math.max(0, Number(options?.extraDirtyIncomePct || 0));
    const globalIncomeMultiplier = Math.max(0, 1 + extraIncomePct / 100);
    const cleanIncomeMultiplier = Math.max(0, 1 + extraCleanIncomePct / 100);
    const dirtyIncomeMultiplier = Math.max(0, 1 + extraDirtyIncomePct / 100);
    const hourlyCleanIncome =
      Math.max(0, Number(rates?.hourlyCleanIncome || 0)) * districtIncomeMultiplier * globalIncomeMultiplier * cleanIncomeMultiplier;
    const hourlyDirtyIncome =
      Math.max(0, Number(rates?.hourlyDirtyIncome || 0)) * districtIncomeMultiplier * globalIncomeMultiplier * dirtyIncomeMultiplier;

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw = hoursElapsed * hourlyCleanIncome + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw = hoursElapsed * hourlyDirtyIncome + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      rates: {
        hourlyCleanIncome,
        hourlyDirtyIncome,
        hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
      }
    };
  }

  function applyBuildingInfluenceTick(instanceState, nowMs, perHour = BUILDING_INFLUENCE_PER_HOUR) {
    const stateRef = instanceState;
    const influenceRate = Math.max(0, Number(perHour) || 0);
    let influenceFrom = Number(stateRef.lastInfluenceAt || nowMs);
    if (!Number.isFinite(influenceFrom) || influenceFrom > nowMs) {
      influenceFrom = nowMs;
    }

    let gained = 0;
    if (influenceFrom < nowMs && influenceRate > 0) {
      const hoursElapsed = (nowMs - influenceFrom) / 3600000;
      const gainedRaw = hoursElapsed * influenceRate + Number(stateRef.influenceRemainder || 0);
      gained = Math.max(0, Math.floor(gainedRaw));
      stateRef.influenceRemainder = Math.max(0, gainedRaw - gained);
    }
    stateRef.lastInfluenceAt = nowMs;

    if (gained > 0) {
      const addInfluence = window.Empire.UI?.addInfluence;
      if (typeof addInfluence === "function") {
        addInfluence(gained);
      }
    }
    return gained;
  }

  function normalizeBuildingTypeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function isFitnessClubBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "fitness club" || normalized === "fitnessclub" || normalized === "fitness centrum";
  }

  function isCasinoBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "kasino" || normalized === "casino";
  }

  function isArcadeBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "herna" || normalized === "arcade";
  }

  function isAutoSalonBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "autosalon" || normalized === "auto salon";
  }

  function isExchangeBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "smenarna" || normalized === "exchange";
  }

  function isRestaurantBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "restaurace" || normalized === "restaurant";
  }

  function isConvenienceStoreBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "vecerka" || normalized === "convenience store";
  }

  function isPharmacyBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "lekarna" || normalized === "pharmacy";
  }

  function isFactoryBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "tovarna" || normalized === "factory";
  }

  function isArmoryBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "zbrojovka" || normalized === "armory";
  }

  function isDrugLabBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "drug lab" || normalized === "druglab";
  }

  function isSmugglingTunnelBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "pasovaci tunel" || normalized === "smuggling tunnel";
  }

  function isStreetDealersBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "poulicni dealeri" || normalized === "street dealers" || normalized === "street dealer";
  }

  function isStripClubBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "strip club" || normalized === "stripclub";
  }

  function isDataCenterBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "datove centrum" || normalized === "data center" || normalized === "datacenter";
  }

  function isResearchCenterBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "vyzkumne centrum" || normalized === "research center" || normalized === "researchcentre";
  }

  function isRecyclingCenterBaseName(value) {
    const normalized = normalizeBuildingTypeName(value);
    return normalized === "recyklacni centrum" || normalized === "recycling center" || normalized === "recyclingcentre";
  }

  function collectOwnedSimpleCashEntriesByMatcher(matcher) {
    if (typeof matcher !== "function") return [];
    const districts = Array.isArray(state.districts) ? state.districts : [];
    const entries = [];
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
      const districtLabel = String(district?.name || `Distrikt #${district?.id ?? "-"}`);
      buildings.forEach((building, index) => {
        if (!matcher(building)) return;
        const baseName = String(building || "Neznámá budova");
        const overrideRaw = String(overrides[index] || "").trim();
        const variantName = overrideRaw && overrideRaw !== baseName ? overrideRaw : null;
        const context = {
          baseName,
          variantName,
          districtId: district?.id ?? null,
          buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
        };
        entries.push({
          district,
          context,
          instanceKey: resolveBuildingInstanceKey(context, district),
          displayName: variantName || `${baseName} • ${districtLabel}`
        });
      });
    });
    return entries;
  }

  function collectOwnedPharmacyEntries() {
    const districts = Array.isArray(state.districts) ? state.districts : [];
    const entries = [];
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
      const districtLabel = String(district?.name || `Distrikt #${district?.id ?? "-"}`);
      buildings.forEach((building, index) => {
        if (!isPharmacyBaseName(building)) return;
        const baseName = String(building || PHARMACY_BUILDING_NAME);
        const overrideRaw = String(overrides[index] || "").trim();
        const variantName = overrideRaw && overrideRaw !== baseName ? overrideRaw : null;
        const displayName = variantName || `${baseName} • ${districtLabel}`;
        entries.push({
          district,
          districtId: district?.id ?? null,
          buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null,
          baseName,
          variantName,
          displayName,
          context: {
            baseName,
            variantName,
            districtId: district?.id ?? null,
            buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
          }
        });
      });
    });
    return entries;
  }

  function getOwnedPharmacyCount() {
    return Math.max(0, collectOwnedPharmacyEntries().length);
  }

  function getPharmacyProductionBonusPct() {
    return Math.max(0, getOwnedPharmacyCount() * 5);
  }

  function getPharmacyStorageCapMultiplier() {
    const warehouseCount = getOwnedWarehouseCountForDrugLab();
    if (warehouseCount <= 0) return 1;
    return 1 + warehouseCount * 0.2;
  }

  function getPharmacyStorageCapBonusPct() {
    return Math.max(0, (getPharmacyStorageCapMultiplier() - 1) * 100);
  }

  function collectOwnedFactoryEntries() {
    const districts = Array.isArray(state.districts) ? state.districts : [];
    const entries = [];
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
      const districtLabel = String(district?.name || `Distrikt #${district?.id ?? "-"}`);
      buildings.forEach((building, index) => {
        if (!isFactoryBaseName(building)) return;
        const baseName = String(building || FACTORY_BUILDING_NAME);
        const overrideRaw = String(overrides[index] || "").trim();
        const variantName = overrideRaw && overrideRaw !== baseName ? overrideRaw : null;
        const displayName = variantName || `${baseName} • ${districtLabel}`;
        entries.push({
          district,
          districtId: district?.id ?? null,
          buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null,
          baseName,
          variantName,
          displayName,
          context: {
            baseName,
            variantName,
            districtId: district?.id ?? null,
            buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
          }
        });
      });
    });
    return entries;
  }

  function collectOwnedArmoryEntries() {
    const districts = Array.isArray(state.districts) ? state.districts : [];
    const entries = [];
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
      const districtLabel = String(district?.name || `Distrikt #${district?.id ?? "-"}`);
      buildings.forEach((building, index) => {
        if (!isArmoryBaseName(building)) return;
        const baseName = String(building || ARMORY_BUILDING_NAME);
        const overrideRaw = String(overrides[index] || "").trim();
        const variantName = overrideRaw && overrideRaw !== baseName ? overrideRaw : null;
        const displayName = variantName || `${baseName} • ${districtLabel}`;
        entries.push({
          district,
          districtId: district?.id ?? null,
          buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null,
          baseName,
          variantName,
          displayName,
          context: {
            baseName,
            variantName,
            districtId: district?.id ?? null,
            buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
          }
        });
      });
    });
    return entries;
  }

  function resolvePrimaryOwnedPharmacyTarget(context, district) {
    const ownedEntries = collectOwnedPharmacyEntries();
    if (ownedEntries.length) {
      const primary = ownedEntries[0];
      return {
        entries: ownedEntries,
        primary,
        context: primary.context,
        district: primary.district
      };
    }

    return {
      entries: [],
      primary: null,
      context,
      district: resolveDistrictRecord(district || context?.districtId) || district || null
    };
  }

  function resolvePrimaryOwnedFactoryTarget(context, district) {
    const ownedEntries = collectOwnedFactoryEntries();
    if (ownedEntries.length) {
      const primary = ownedEntries[0];
      return {
        entries: ownedEntries,
        primary,
        context: primary.context,
        district: primary.district
      };
    }

    return {
      entries: [],
      primary: null,
      context,
      district: resolveDistrictRecord(district || context?.districtId) || district || null
    };
  }

  function resolvePrimaryOwnedArmoryTarget(context, district) {
    const ownedEntries = collectOwnedArmoryEntries();
    if (ownedEntries.length) {
      const primary = ownedEntries[0];
      return {
        entries: ownedEntries,
        primary,
        context: primary.context,
        district: primary.district
      };
    }

    return {
      entries: [],
      primary: null,
      context,
      district: resolveDistrictRecord(district || context?.districtId) || district || null
    };
  }

  function collectOwnedDrugLabEntries() {
    const districts = Array.isArray(state.districts) ? state.districts : [];
    const entries = [];
    districts.forEach((district) => {
      if (!isDistrictOwnedByPlayer(district)) return;
      const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
      const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
      const districtLabel = String(district?.name || `Distrikt #${district?.id ?? "-"}`);
      buildings.forEach((building, index) => {
        if (!isDrugLabBaseName(building)) return;
        const baseName = String(building || DRUG_LAB_BUILDING_NAME);
        const overrideRaw = String(overrides[index] || "").trim();
        const variantName = overrideRaw && overrideRaw !== baseName ? overrideRaw : null;
        const displayName = variantName || `${baseName} • ${districtLabel}`;
        entries.push({
          district,
          districtId: district?.id ?? null,
          buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null,
          baseName,
          variantName,
          displayName,
          context: {
            baseName,
            variantName,
            districtId: district?.id ?? null,
            buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
          }
        });
      });
    });
    return entries;
  }

  function getOwnedDrugLabNetworkProductionBonusPct() {
    const ownedCount = collectOwnedDrugLabEntries().length;
    return Math.max(0, ownedCount) * 5;
  }

  function resolvePrimaryOwnedDrugLabTarget(context, district) {
    const ownedEntries = collectOwnedDrugLabEntries();
    if (ownedEntries.length) {
      const primary = ownedEntries[0];
      return {
        entries: ownedEntries,
        primary,
        context: primary.context,
        district: primary.district
      };
    }

    return {
      entries: [],
      primary: null,
      context,
      district: resolveDistrictRecord(district || context?.districtId) || district || null
    };
  }

  function readCurrentPlayerHeatValue() {
    const profile = window.Empire.player || {};
    const candidates = [
      profile?.wantedLevel,
      profile?.wanted_level,
      profile?.wanted,
      profile?.heat,
      profile?.notoriety,
      profile?.policeHeat,
      profile?.police_heat,
      window.Empire?.PoliceHeat?.state?.player?.totalHeat
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const parsed = Number(candidates[i]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return 0;
  }

  function appendHeatJournalEntry(type, amount, reason, createdAt = Date.now()) {
    try {
      const raw = localStorage.getItem("empire_heat_journal_v1");
      const current = raw ? JSON.parse(raw) : [];
      const entries = Array.isArray(current) ? current : [];
      entries.unshift({
        type: String(type || "").trim().toLowerCase(),
        amount: Math.max(0, Math.round((Number(amount) || 0) * 10) / 10),
        reason: String(reason || "").trim(),
        createdAt: Math.max(0, Math.floor(Number(createdAt) || Date.now()))
      });
      localStorage.setItem("empire_heat_journal_v1", JSON.stringify(entries.slice(0, 40)));
    } catch {}
  }

  function addPlayerHeatFromBuilding(amount, reason = "Provoz budov a akce") {
    const delta = Math.max(0, Number(amount) || 0);
    if (!delta) return readCurrentPlayerHeatValue();
    const reasonLower = String(reason || "").trim().toLowerCase();
    const isConvenienceOwnAction =
      reasonLower === "noční prodej"
      || reasonLower === "maly deal"
      || reasonLower === "malý deal"
      || reasonLower === "krytí operací"
      || reasonLower === "kryti operaci";
    const coverOpsMultiplier = isConvenienceOwnAction ? 1 : getOwnedConvenienceCoverOpsHeatMultiplier(Date.now(), "__global__");
    const effectiveDelta = Math.max(0, delta * coverOpsMultiplier);
    const nextHeat = Math.max(0, readCurrentPlayerHeatValue() + effectiveDelta);
    const currentProfile = window.Empire.player && typeof window.Empire.player === "object"
      ? window.Empire.player
      : {};
    const nextProfile = {
      ...currentProfile,
      heat: nextHeat,
      wantedLevel: nextHeat,
      wanted: nextHeat,
      policeHeat: nextHeat,
      police_heat: nextHeat
    };

    const updateProfile = window.Empire.UI?.updateProfile;
    if (typeof updateProfile === "function") {
      updateProfile(nextProfile);
    } else {
      window.Empire.player = nextProfile;
    }

    const setExternalHeat = window.Empire.PoliceHeat?.setExternalHeat;
    if (typeof setExternalHeat === "function") {
      setExternalHeat(nextHeat, nextProfile);
    }

    appendHeatJournalEntry("rise", effectiveDelta, reason);

    return nextHeat;
  }

  function getPharmacyBoostSnapshot(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const activeEffects = [];
    const totals = {
      spySpeedPct: 0,
      infoQualityPct: 0,
      attackSpeedPct: 0,
      stealSpeedPct: 0,
      activeActionsPct: 0
    };
    const counts = {
      recon: 0,
      action: 0,
      neuro: 0
    };
    const playerSnapshot = getDrugLabPlayerSnapshot(nowMs);
    const supplies = createDrugLabSupplyMap(playerSnapshot.labSupplies || {});
    const economy = getSafeDrugLabEconomySnapshot();
    const drugInventory = normalizeDrugLabInventoryFromEconomy(economy);

    Object.entries(pharmacyBuildingStore || {}).forEach(([instanceKey, rawState]) => {
      const snapshot = sanitizePharmacyState(rawState, nowMs);
      pharmacyBuildingStore[instanceKey] = snapshot;
      const reconRemaining = Math.max(0, Number(snapshot.effects.reconUntil || 0) - nowMs);
      if (reconRemaining > 0) {
        counts.recon += 1;
        totals.spySpeedPct += PHARMACY_CONFIG.boosts.recon.spySpeedPct;
        totals.infoQualityPct += PHARMACY_CONFIG.boosts.recon.infoQualityPct;
        activeEffects.push({ type: "recon", remainingMs: reconRemaining });
      }
      const actionRemaining = Math.max(0, Number(snapshot.effects.actionUntil || 0) - nowMs);
      if (actionRemaining > 0) {
        counts.recon += 1;
        totals.attackSpeedPct += PHARMACY_CONFIG.boosts.action.attackSpeedPct;
        totals.stealSpeedPct += PHARMACY_CONFIG.boosts.action.stealSpeedPct;
        activeEffects.push({ type: "recon", remainingMs: actionRemaining });
      }
      const neuroRemaining = Math.max(0, Number(snapshot.effects.neuroUntil || 0) - nowMs);
      if (neuroRemaining > 0) {
        counts.neuro += 1;
        totals.activeActionsPct += PHARMACY_CONFIG.boosts.neuro.activeActionsPct;
        activeEffects.push({ type: "neuro", remainingMs: neuroRemaining });
      }
    });

    return {
      activeCount: activeEffects.length,
      activeEffects,
      counts,
      supplies,
      drugInventory,
      bonuses: {
        ...totals
      },
      effective: {
        spySpeedPct: totals.spySpeedPct + totals.activeActionsPct,
        infoQualityPct: totals.infoQualityPct,
        attackSpeedPct: totals.attackSpeedPct + totals.activeActionsPct,
        stealSpeedPct: totals.stealSpeedPct + totals.activeActionsPct,
        activeActionsPct: totals.activeActionsPct
      }
    };
  }

  function usePharmacyBoost(boostType, now = Date.now()) {
    const type = String(boostType || "").trim().toLowerCase();
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const target = resolvePrimaryOwnedPharmacyTarget(null, null);
    if (!target?.context) {
      return { ok: false, message: "Boost nelze aktivovat: nevlastníš žádnou Lékárnu." };
    }

    const instanceKey = resolveBuildingInstanceKey(target.context, target.district);
    const snapshot = getPharmacyStateByKey(instanceKey, nowMs);
    syncPharmacyProduction(snapshot, nowMs);
    const player = getDrugLabPlayerSnapshot(nowMs);
    player.labSupplies = createDrugLabSupplyMap(player.labSupplies || {});
    const economy = getSafeDrugLabEconomySnapshot();
    const inventory = normalizeDrugLabInventoryFromEconomy(economy);

    const config = PHARMACY_CONFIG.boosts[type] || null;
    if (!config) {
      persistPharmacyState(instanceKey, snapshot);
      persistDrugLabPlayerSnapshot(player);
      return { ok: false, message: "Neznámý boost." };
    }

    const resolvedType = type === "action" ? "recon" : type;
    const untilKey = resolvedType === "recon" ? "reconUntil" : "neuroUntil";
    const cooldownLeft = Math.max(0, Number(snapshot.cooldowns[resolvedType] || 0) - nowMs);
    if (cooldownLeft > 0) {
      persistPharmacyState(instanceKey, snapshot);
      persistDrugLabPlayerSnapshot(player);
      return { ok: false, message: `${resolvedType === "recon" ? "Ghost Serum" : "Overdrive X"} boost je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
    }

    const resourceKey = String(config.resourceKey || "").trim() || "ghostSerum";
    const resourceLabel = String(config.resourceLabel || resourceKey).trim() || resourceKey;
    const drugCost = Math.max(0, Math.floor(Number(config.drugCost || 0)));
    const availableDrugs = Math.max(0, Math.floor(Number(inventory[resourceKey] || 0)));
    if (availableDrugs < drugCost) {
      persistPharmacyState(instanceKey, snapshot);
      persistDrugLabPlayerSnapshot(player);
      applyDrugLabEconomySnapshot(economy, inventory, player, nowMs);
      return { ok: false, message: `Nedostatek ${resourceLabel} (${availableDrugs}/${drugCost}).` };
    }

    inventory[resourceKey] = Math.max(0, availableDrugs - drugCost);
    snapshot.effects[untilKey] = nowMs + PHARMACY_CONFIG.boostDurationMs;
    snapshot.cooldowns[resolvedType] = nowMs + PHARMACY_CONFIG.boostDurationMs;
    if (resolvedType === "recon") {
      snapshot.effects.actionUntil = nowMs + PHARMACY_CONFIG.boostDurationMs;
      snapshot.cooldowns.action = nowMs + PHARMACY_CONFIG.boostDurationMs;
    }

    let heatNote = "";
    if (type === "neuro") {
      const nextHeat = addPlayerHeatFromBuilding(PHARMACY_CONFIG.boosts.neuro.heatAdded);
      heatNote = ` Heat +${PHARMACY_CONFIG.boosts.neuro.heatAdded} (celkem ${nextHeat}).`;
    }

    persistPharmacyState(instanceKey, snapshot);
    persistDrugLabPlayerSnapshot(player);
    applyDrugLabEconomySnapshot(economy, inventory, player, nowMs);

    const boostLabel = resolvedType === "recon" ? "Ghost Serum boost" : "Overdrive X boost";
    return {
      ok: true,
      message:
        `${boostLabel} aktivní na ${formatDurationLabel(PHARMACY_CONFIG.boostDurationMs)}. `
        + `Spotřeba ${drugCost} ${resourceLabel} (zbývá ${inventory[resourceKey]}).${heatNote}`
    };
  }

  function getFactoryBoostSnapshot(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const activeEffects = [];
    const totals = {
      attackPowerPct: 0,
      attackSpeedPct: 0,
      raidSpeedPct: 0,
      destroyBuildingChancePct: 0,
      defenseIgnorePct: 0,
      defensePenaltyPct: 0,
      policeInterventionRiskPct: 0
    };
    const counts = {
      assault: 0,
      rapid: 0,
      breach: 0
    };
    const supplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());

    Object.entries(factoryBuildingStore || {}).forEach(([instanceKey, rawState]) => {
      const snapshot = sanitizeFactoryState(rawState, nowMs);
      factoryBuildingStore[instanceKey] = snapshot;
      const assaultRemaining = Math.max(0, Number(snapshot.effects.assaultUntil || 0) - nowMs);
      if (assaultRemaining > 0) {
        counts.assault += 1;
        totals.attackPowerPct += FACTORY_COMBAT_BOOSTS.assault.attackPowerPct;
        activeEffects.push({ type: "assault", remainingMs: assaultRemaining });
      }
      const rapidRemaining = Math.max(0, Number(snapshot.effects.rapidUntil || 0) - nowMs);
      if (rapidRemaining > 0) {
        counts.rapid += 1;
        totals.attackSpeedPct += FACTORY_COMBAT_BOOSTS.rapid.attackSpeedPct;
        totals.raidSpeedPct += FACTORY_COMBAT_BOOSTS.rapid.raidSpeedPct;
        totals.defensePenaltyPct += FACTORY_COMBAT_BOOSTS.rapid.defensePenaltyPct;
        activeEffects.push({ type: "rapid", remainingMs: rapidRemaining });
      }
      const breachRemaining = Math.max(0, Number(snapshot.effects.breachUntil || 0) - nowMs);
      if (breachRemaining > 0) {
        counts.breach += 1;
        totals.destroyBuildingChancePct += FACTORY_COMBAT_BOOSTS.breach.destroyBuildingChancePct;
        totals.defenseIgnorePct += FACTORY_COMBAT_BOOSTS.breach.defenseIgnorePct;
        totals.policeInterventionRiskPct += FACTORY_COMBAT_BOOSTS.breach.policeInterventionRiskPct;
        activeEffects.push({ type: "breach", remainingMs: breachRemaining });
      }
    });

    return {
      activeCount: activeEffects.length,
      activeEffects,
      counts,
      supplies,
      bonuses: {
        ...totals
      },
      effective: {
        ...totals
      }
    };
  }

  function useFactoryBoost(boostType, now = Date.now()) {
    const type = String(boostType || "").trim().toLowerCase();
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const target = resolvePrimaryOwnedFactoryTarget(null, null);
    if (!target?.context) {
      return { ok: false, message: "Boost nelze aktivovat: nevlastníš žádnou Továrnu." };
    }

    const instanceKey = resolveBuildingInstanceKey(target.context, target.district);
    const snapshot = getFactoryStateByKey(instanceKey, nowMs);
    syncFactoryProduction(snapshot, nowMs, { applyHeat: true });
    const player = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    const config = FACTORY_COMBAT_BOOSTS[type] || null;
    if (!config) {
      persistFactoryState(instanceKey, snapshot);
      persistFactoryPlayerSuppliesSnapshot(player);
      return { ok: false, message: "Neznámý combat boost." };
    }

    const untilKey = type === "assault" ? "assaultUntil" : type === "rapid" ? "rapidUntil" : "breachUntil";
    const activeLeft = Math.max(0, Number(snapshot.effects[untilKey] || 0) - nowMs);
    if (activeLeft > 0) {
      persistFactoryState(instanceKey, snapshot);
      persistFactoryPlayerSuppliesSnapshot(player);
      return {
        ok: false,
        message: `${type === "assault" ? "Assault Protocol" : type === "rapid" ? "Rapid Strike" : "Breach Mode"} je už aktivní (${formatDurationLabel(activeLeft)}).`
      };
    }

    const moduleCost = Math.max(0, Math.floor(Number(config.combatModuleCost || 0)));
    const availableModules = Math.max(0, Math.floor(Number(player.combatModule || 0)));
    if (availableModules < moduleCost) {
      persistFactoryState(instanceKey, snapshot);
      persistFactoryPlayerSuppliesSnapshot(player);
      return { ok: false, message: `Nedostatek Combat Module (${availableModules}/${moduleCost}).` };
    }

    player.combatModule = Math.max(0, availableModules - moduleCost);
    snapshot.effects[untilKey] = nowMs + config.durationMs;
    snapshot.cooldowns[type] = nowMs + config.durationMs;
    const nextHeat = addPlayerHeatFromBuilding(config.heatAdded);

    persistFactoryState(instanceKey, snapshot);
    persistFactoryPlayerSuppliesSnapshot(player);

    const boostLabel = type === "assault" ? "Assault Protocol" : type === "rapid" ? "Rapid Strike" : "Breach Mode";
    return {
      ok: true,
      message:
        `${boostLabel} aktivní na ${formatDurationLabel(config.durationMs)}. `
        + `Spotřeba ${moduleCost} Combat Module (zbývá ${player.combatModule}). `
        + `Heat +${config.heatAdded} (celkem ${nextHeat}).`
    };
  }

  function resolveDistrictRecord(districtOrId) {
    if (districtOrId && typeof districtOrId === "object" && Array.isArray(districtOrId.buildings)) {
      return districtOrId;
    }
    const districtId = districtOrId && typeof districtOrId === "object"
      ? districtOrId.id
      : districtOrId;
    const targetKey = String(districtId ?? "").trim();
    if (!targetKey) return null;
    return state.districts.find((item) => String(item?.id) === targetKey) || null;
  }

  function districtHasDrugLab(districtOrId) {
    const districtRecord = resolveDistrictRecord(districtOrId);
    if (!districtRecord) return false;
    const buildings = Array.isArray(districtRecord.buildings) ? districtRecord.buildings : [];
    return buildings.some((building) => {
      const normalized = normalizeBuildingTypeName(building);
      return normalized === "drug lab" || normalized === "druglab";
    });
  }

  function playerOwnsAnyBuildingNames(targetNames = []) {
    const normalizedTargets = new Set(
      (Array.isArray(targetNames) ? targetNames : [])
        .map((entry) => normalizeBuildingTypeName(entry))
        .filter(Boolean)
    );
    if (!normalizedTargets.size) return false;
    if (!Array.isArray(state.districts) || !state.districts.length) return false;

    return state.districts.some((district) => {
      if (!isDistrictOwnedByPlayer(district)) return false;
      const buildings = Array.isArray(district.buildings) ? district.buildings : [];
      return buildings.some((building) => normalizedTargets.has(normalizeBuildingTypeName(building)));
    });
  }

  function playerOwnsDrugLabOrStreetDealers() {
    return playerOwnsAnyBuildingNames([
      "Drug lab",
      "druglab",
      "Pouliční dealeři",
      "poulicni dealeri",
      "Street dealers"
    ]);
  }

  function playerOwnsFleetLogisticsTargets() {
    return playerOwnsAnyBuildingNames([
      "Garage",
      "Garáž",
      "Taxi služba",
      "Taxi sluzba",
      "Pašovací tunel",
      "Pasovaci tunel"
    ]);
  }

  function resolveDistrictIdentityPart(districtOrId) {
    const districtRecord = resolveDistrictRecord(districtOrId);
    const districtId = districtRecord?.id ?? districtOrId;
    return normalizeBuildingKeyPart(districtId) || "unknown";
  }

  function getOwnedFitnessGlobalBoostSnapshot(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    let attackBoostPct = 0;
    let defenseBoostPct = 0;
    let influenceBoostPct = 0;
    let districtIncomeBoostPct = 0;

    Object.entries(fitnessBuildingStore || {}).forEach(([instanceKey, rawState]) => {
      const snapshot = sanitizeFitnessState(rawState, nowMs);
      fitnessBuildingStore[instanceKey] = snapshot;
      const levelEffects = getFitnessLevelEffects(snapshot.level);
      const actionEffectMultiplier = Math.max(1, Number(levelEffects.actionEffectMultiplier || 1));
      const effects = snapshot.effects || {};

      attackBoostPct += Math.max(0, Number(levelEffects.permanentAttackPct || 0));
      defenseBoostPct += Math.max(0, Number(levelEffects.permanentDefensePct || 0));

      if (nowMs < Math.max(0, Number(effects.gangTrainingUntil || 0))) {
        attackBoostPct += FITNESS_BUILDING_CONFIG.gangTrainingAttackBoostPct * actionEffectMultiplier;
        defenseBoostPct += FITNESS_BUILDING_CONFIG.gangTrainingDefenseBoostPct * actionEffectMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.talentRecruitmentInfluenceUntil || 0))) {
        influenceBoostPct += FITNESS_BUILDING_CONFIG.talentRecruitmentInfluenceBoostPct * actionEffectMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.talentRecruitmentIncomeUntil || 0))) {
        districtIncomeBoostPct += FITNESS_BUILDING_CONFIG.talentRecruitmentDistrictIncomeBoostPct * actionEffectMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.dopingRushUntil || 0))) {
        attackBoostPct += FITNESS_BUILDING_CONFIG.dopingRushAttackBoostPct * actionEffectMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.dopingCrashUntil || 0))) {
        defenseBoostPct -= FITNESS_BUILDING_CONFIG.dopingCrashDefensePenaltyPct * actionEffectMultiplier;
      }
    });

    return {
      attackBoostPct,
      defenseBoostPct,
      influenceBoostPct,
      districtIncomeBoostPct
    };
  }

  function getFitnessCombatSnapshot(now = Date.now()) {
    const snapshot = getOwnedFitnessGlobalBoostSnapshot(now);
    return {
      attackBoostPct: Number(snapshot.attackBoostPct || 0),
      defenseBoostPct: Number(snapshot.defenseBoostPct || 0),
      influenceBoostPct: Number(snapshot.influenceBoostPct || 0),
      districtIncomeBoostPct: Number(snapshot.districtIncomeBoostPct || 0)
    };
  }

  function getDistrictCashIncomeBoostPct(districtOrId, now = Date.now()) {
    const districtRecord = resolveDistrictRecord(districtOrId);
    const districtKey = normalizeDistrictId(districtRecord?.id ?? districtOrId);
    const districtPart = resolveDistrictIdentityPart(districtOrId);
    if (!districtPart) return 0;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    let boostPct = 0;

    Object.entries(exchangeBuildingStore || {}).forEach(([instanceKey, rawState]) => {
      const keyDistrictPart = String(instanceKey || "").split(":")[0] || "unknown";
      if (keyDistrictPart !== districtPart) return;
      const snapshot = sanitizeExchangeState(rawState, nowMs);
      if (nowMs >= Number(snapshot.effects.financialNetworkUntil || 0)) return;
      boostPct += EXCHANGE_BUILDING_CONFIG.actionBoosts.districtIncomeBonusPct * getExchangeLevelMultiplier(snapshot.level);
    });

    let restaurantDinnerBoostPct = 0;
    Object.values(restaurantBuildingStore || {}).forEach((rawState) => {
      const snapshot = sanitizeRestaurantState(rawState, nowMs);
      if (nowMs >= Number(snapshot.effects.gangDinnerUntil || 0)) return;
      const targetPart = String(snapshot.effects.gangDinnerDistrictPart || "").trim();
      if (!targetPart || targetPart !== districtPart) return;
      restaurantDinnerBoostPct = Math.max(
        restaurantDinnerBoostPct,
        Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.gangDinnerDistrictIncomePct || 0))
      );
    });
    boostPct += restaurantDinnerBoostPct;

    boostPct += Math.max(0, Number(getOwnedFitnessGlobalBoostSnapshot(nowMs).districtIncomeBoostPct || 0));

    if (districtKey) {
      const policePenaltyPct = getPoliceRaidIncomePenaltyPctForDistrict(districtKey, nowMs);
      if (policePenaltyPct > 0) {
        boostPct -= policePenaltyPct;
      }
    }

    return boostPct;
  }

  function getPoliceRaidIncomePenaltyPctForDistrict(districtKey, nowMs = Date.now()) {
    const districtPart = normalizeDistrictId(districtKey);
    if (!districtPart) return 0;
    let penaltyPct = 0;
    const policeAction = state.policeDistrictActions.get(districtPart);
    if (policeAction && Number(policeAction.expiresAt || 0) > nowMs) {
      penaltyPct = Math.max(penaltyPct, DISTRICT_POLICE_INCOME_PENALTY_PCT);
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_INCOME_PENALTY_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return penaltyPct;
      }
      const entry = parsed[districtPart];
      const until = Math.max(0, Math.floor(Number(entry?.until || 0)));
      const pct = Math.max(0, Math.floor(Number(entry?.pct || 0)));
      if (until > nowMs && pct > 0) {
        penaltyPct = Math.max(penaltyPct, pct);
      }
    } catch {}

    return penaltyPct;
  }

  function getGlobalPoliceRaidProductionPenaltyPct(buildingKey = "lab", now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    try {
      const raw = localStorage.getItem(POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const key = String(buildingKey || "lab").trim().toLowerCase() || "lab";
          const entry = parsed[key];
          const until = Math.max(0, Math.floor(Number(entry?.until || 0)));
          const pct = Math.max(0, Math.floor(Number(entry?.pct || 0)));
          if (until > nowMs && pct > 0) {
            const protectionPct = getOwnedWarehouseRaidProtectionPct(nowMs);
            if (protectionPct > 0) {
              return Math.max(0, pct * (1 - protectionPct / 100));
            }
            return pct;
          }
          return 0;
        }
      }
    } catch {}
    let blockedUntil = 0;
    try {
      blockedUntil = Math.max(0, Math.floor(Number(localStorage.getItem(POLICE_RAID_PRODUCTION_PENALTY_STORAGE_KEY) || 0)));
    } catch {}
    if (nowMs < blockedUntil) {
      const protectionPct = getOwnedWarehouseRaidProtectionPct(nowMs);
      const basePenalty = POLICE_RAID_PRODUCTION_PENALTY_PCT;
      if (protectionPct > 0) {
        return Math.max(0, basePenalty * (1 - protectionPct / 100));
      }
      return basePenalty;
    }
    return 0;
  }

  function isPoliceRaidSpecialActionBlockedForBuilding(buildingType = "", now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const normalized = String(buildingType || "").trim().toLowerCase();
    if (!normalized) return false;
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      const allActionsBlockedUntil = Math.max(0, Math.floor(Number(parsed.all_actions_blocked || 0)));
      if (allActionsBlockedUntil > nowMs) return true;
      const pharmacyFactoryLockUntil = Math.max(0, Math.floor(Number(parsed.pharmacy_factory_special || 0)));
      const allSpecialBuildingsLockUntil = Math.max(0, Math.floor(Number(parsed.all_special_buildings || 0)));
      if (allSpecialBuildingsLockUntil > nowMs) {
        return (
          normalized === "pharmacy"
          || normalized === "factory"
          || normalized === "armory"
          || normalized === "drug-lab"
          || normalized === "druglab"
          || normalized === "smuggling-tunnel"
          || normalized === "street-dealers"
          || normalized === "strip-club"
          || normalized === "data-center"
          || normalized === "warehouse"
          || normalized === "research-center"
          || normalized === "recycling-center"
        );
      }
      if (pharmacyFactoryLockUntil <= nowMs) return false;
      return normalized === "pharmacy" || normalized === "factory";
    } catch {
      return false;
    }
  }

  function isPoliceRaidAllActionsBlocked(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICE_RAID_BUILDING_ACTION_LOCK_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      return Math.max(0, Math.floor(Number(parsed.all_actions_blocked || 0))) > nowMs;
    } catch {
      return false;
    }
  }

  function getPoliceActionSnapshot(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    pruneExpiredPoliceActions(nowMs);
    const actions = [];
    state.policeDistrictActions.forEach((marker, districtId) => {
      const expiresAt = Math.max(0, Math.floor(Number(marker?.expiresAt) || 0));
      const startedAt = Math.max(0, Math.floor(Number(marker?.startedAt) || 0));
      const remainingMs = Math.max(0, expiresAt - nowMs);
      if (remainingMs <= 0) return;
      actions.push({
        districtId,
        source: String(marker?.source || "police-action").trim() || "police-action",
        operationType: String(marker?.operationType || "").trim(),
        raidSpecialtyKey: String(marker?.raidSpecialtyKey || "").trim(),
        startedAt,
        expiresAt,
        remainingMs
      });
    });
    actions.sort((a, b) => b.remainingMs - a.remainingMs);
    return {
      now: nowMs,
      activeCount: actions.length,
      incomePenaltyPct: DISTRICT_POLICE_INCOME_PENALTY_PCT,
      actions
    };
  }

  function sanitizeDistrictGossipEntry(rawEntry) {
    const createdAt = Math.max(0, Math.floor(Number(rawEntry?.createdAt) || Date.now()));
    const text = String(rawEntry?.text || "").trim();
    if (!text) return null;
    const id = String(rawEntry?.id || `${createdAt}-${Math.floor(Math.random() * 1000000)}`);
    const sourceBuilding = String(rawEntry?.sourceBuilding || "").trim() || null;
    const sourceDistrictId = rawEntry?.sourceDistrictId ?? null;
    const intelLevelRaw = String(rawEntry?.intelLevel || "").trim().toLowerCase();
    const intelLevel = intelLevelRaw === "verified" ? "verified" : "rumor";
    const intelType = String(rawEntry?.intelType || "").trim() || "rumor";
    const qualityKeyRaw = String(rawEntry?.gossipQuality || rawEntry?.quality || "").trim().toLowerCase();
    const qualityKey = qualityKeyRaw === "rare" || qualityKeyRaw === "quality" ? qualityKeyRaw : "common";
    const categoryRaw = String(rawEntry?.gossipCategory || rawEntry?.category || "").trim().toLowerCase();
    const gossipCategory = Object.prototype.hasOwnProperty.call(DISTRICT_GOSSIP_CATEGORY_LABELS, categoryRaw)
      ? categoryRaw
      : "special";
    const accuracyRaw = Number(rawEntry?.accuracyPct ?? rawEntry?.accuracy ?? rawEntry?.precisionPct ?? 0);
    const accuracyPct = Number.isFinite(accuracyRaw) ? Math.max(0, Math.min(100, Math.floor(accuracyRaw))) : 0;
    const truthStateRaw = String(rawEntry?.truthState || "").trim().toLowerCase();
    const truthState = truthStateRaw === "true" || truthStateRaw === "partial" || truthStateRaw === "false"
      ? truthStateRaw
      : (accuracyPct >= 90 ? "true" : accuracyPct >= 75 ? "partial" : "false");
    return {
      id,
      text,
      createdAt,
      sourceBuilding,
      sourceDistrictId,
      intelLevel,
      intelType,
      gossipQuality: qualityKey,
      gossipCategory,
      accuracyPct,
      truthState
    };
  }

  function getGossipQualityPreset(qualityKey) {
    const key = String(qualityKey || "").trim().toLowerCase();
    return DISTRICT_GOSSIP_QUALITY_PRESETS[key] || DISTRICT_GOSSIP_QUALITY_PRESETS.common;
  }

  function getGossipQualityLabel(entry) {
    const preset = getGossipQualityPreset(entry?.gossipQuality);
    return preset.label;
  }

  function getGossipCategoryLabel(entry) {
    const key = String(entry?.gossipCategory || "").trim().toLowerCase();
    return DISTRICT_GOSSIP_CATEGORY_LABELS[key] || "Speciální";
  }

  function getGossipTruthLabel(entry) {
    const key = String(entry?.truthState || "").trim().toLowerCase();
    if (key === "true") return "Pravdivý";
    if (key === "partial") return "Částečný";
    if (key === "false") return "Falešný";
    const accuracy = Math.max(0, Math.min(100, Math.floor(Number(entry?.accuracyPct || 0))));
    if (accuracy >= 90) return "Pravdivý";
    if (accuracy >= 75) return "Částečný";
    return "Falešný";
  }

  function getDistrictGossipEntries(districtOrId, limit = 20) {
    const districtPart = resolveDistrictIdentityPart(districtOrId);
    if (!districtPart) return [];
    const rawEntries = Array.isArray(districtGossipStore?.[districtPart]) ? districtGossipStore[districtPart] : [];
    const entries = rawEntries
      .map((entry) => sanitizeDistrictGossipEntry(entry))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 1));
    districtGossipStore[districtPart] = entries.slice(0, DISTRICT_GOSSIP_MAX_PER_DISTRICT);
    return entries.slice(0, safeLimit);
  }

  function appendDistrictGossip(districtOrId, text, metadata = {}) {
    const districtPart = resolveDistrictIdentityPart(districtOrId);
    if (!districtPart) return null;
    const qualityKey = String(metadata?.gossipQuality || metadata?.quality || "common").trim().toLowerCase();
    const normalizedQuality = qualityKey === "rare" || qualityKey === "quality" ? qualityKey : "common";
    const categoryKey = String(metadata?.gossipCategory || metadata?.category || "special").trim().toLowerCase();
    const normalizedCategory = Object.prototype.hasOwnProperty.call(DISTRICT_GOSSIP_CATEGORY_LABELS, categoryKey)
      ? categoryKey
      : "special";
    const accuracyRaw = Number(metadata?.accuracyPct ?? metadata?.accuracy ?? 0);
    const normalizedAccuracy = Number.isFinite(accuracyRaw) ? Math.max(0, Math.min(100, Math.floor(accuracyRaw))) : 0;
    const truthStateRaw = String(metadata?.truthState || "").trim().toLowerCase();
    const normalizedTruthState = truthStateRaw === "true" || truthStateRaw === "partial" || truthStateRaw === "false"
      ? truthStateRaw
      : (normalizedAccuracy >= 90 ? "true" : normalizedAccuracy >= 75 ? "partial" : "false");
    const entry = sanitizeDistrictGossipEntry({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      text,
      createdAt: metadata?.createdAt ?? Date.now(),
      sourceBuilding: metadata?.sourceBuilding || null,
      sourceDistrictId: metadata?.sourceDistrictId ?? null,
      intelLevel: metadata?.intelLevel || "rumor",
      intelType: metadata?.intelType || "rumor",
      gossipQuality: normalizedQuality,
      gossipCategory: normalizedCategory,
      accuracyPct: normalizedAccuracy,
      truthState: normalizedTruthState
    });
    if (!entry) return null;
    const existing = Array.isArray(districtGossipStore[districtPart]) ? districtGossipStore[districtPart] : [];
    existing.push(entry);
    districtGossipStore[districtPart] = existing
      .map((item) => sanitizeDistrictGossipEntry(item))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, DISTRICT_GOSSIP_MAX_PER_DISTRICT);
    saveDistrictGossipStore();
    return entry;
  }

  function seedDemoDistrictGossip() {
    try {
      if (localStorage.getItem(DISTRICT_GOSSIP_DEMO_SEED_KEY) === "1") return;
    } catch {}

    const demoData = {
      94: [
        {
          intelLevel: "verified",
          intelType: "attack_success",
          text: "Potvrzený intel: V districtu 94 proběhl noční útok na sklad zbraní.",
          gossipQuality: "rare",
          gossipCategory: "attack",
          accuracyPct: 96,
          truthState: "true"
        },
        {
          intelLevel: "rumor",
          intelType: "rumor",
          text: "Drb: V districtu 94 se mluví o novém dodavateli chemie z předměstí.",
          gossipQuality: "common",
          gossipCategory: "production",
          accuracyPct: 71,
          truthState: "partial"
        },
        {
          intelLevel: "verified",
          intelType: "market_order_created",
          text: "Potvrzený intel: Přes district 94 šel velký nákupní příkaz na drogy.",
          gossipQuality: "quality",
          gossipCategory: "economy",
          accuracyPct: 88,
          truthState: "true"
        },
        {
          intelLevel: "rumor",
          intelType: "rumor",
          text: "Drb: V districtu 94 někdo uplácí personál v restauracích.",
          gossipQuality: "common",
          gossipCategory: "special",
          accuracyPct: 67,
          truthState: "false"
        }
      ],
      69: [
        {
          intelLevel: "verified",
          intelType: "raid_started",
          text: "Potvrzený intel: V districtu 69 bylo potvrzeno vykrádání noční směny.",
          gossipQuality: "rare",
          gossipCategory: "heat",
          accuracyPct: 97,
          truthState: "true"
        },
        {
          intelLevel: "rumor",
          intelType: "rumor",
          text: "Drb: V districtu 69 se zvyšuje pohyb pouličních dealerů kolem herny.",
          gossipQuality: "quality",
          gossipCategory: "production",
          accuracyPct: 83,
          truthState: "partial"
        },
        {
          intelLevel: "verified",
          intelType: "spy_started",
          text: "Potvrzený intel: V districtu 69 běží cizí špionážní síť.",
          gossipQuality: "rare",
          gossipCategory: "attack",
          accuracyPct: 94,
          truthState: "true"
        },
        {
          intelLevel: "rumor",
          intelType: "rumor",
          text: "Drb: V districtu 69 se připravuje tichý přesun hotovosti přes taxislužby.",
          gossipQuality: "common",
          gossipCategory: "economy",
          accuracyPct: 74,
          truthState: "partial"
        }
      ]
    };

    const now = Date.now();
    Object.entries(demoData).forEach(([districtId, entries], districtOffset) => {
      entries.forEach((entry, index) => {
        appendDistrictGossip(districtId, entry.text, {
          createdAt: now - (districtOffset * 10 + index) * 60000,
          intelLevel: entry.intelLevel,
          intelType: entry.intelType,
          gossipQuality: entry.gossipQuality,
          gossipCategory: entry.gossipCategory,
          accuracyPct: entry.accuracyPct,
          truthState: entry.truthState
        });
      });
    });

    try {
      localStorage.setItem(DISTRICT_GOSSIP_DEMO_SEED_KEY, "1");
    } catch {}
  }

  function resolveIntelEventDistrictTargets(payload = {}) {
    const explicitTargets = Array.isArray(payload?.districtIds)
      ? payload.districtIds.map((id) => resolveDistrictRecord(id)).filter(Boolean)
      : [];
    if (explicitTargets.length) return explicitTargets;

    const singleTarget = resolveDistrictRecord(payload?.district || payload?.districtId);
    if (singleTarget) return [singleTarget];

    const selectedTarget = resolveDistrictRecord(state.selectedId);
    if (selectedTarget) return [selectedTarget];

    const playerDistricts = (Array.isArray(state.districts) ? state.districts : []).filter((district) =>
      isDistrictOwnedByPlayer(district)
    );
    if (playerDistricts.length) {
      return [playerDistricts[Math.floor(Math.random() * playerDistricts.length)]];
    }

    if (Array.isArray(state.districts) && state.districts.length) {
      return [state.districts[Math.floor(Math.random() * state.districts.length)]];
    }

    return [];
  }

  function formatMarketResourceLabel(resourceKey) {
    const normalized = String(resourceKey || "").trim().toLowerCase();
    if (normalized === "drugs") return "drogy";
    if (normalized === "weapons") return "zbraně";
    if (normalized === "materials") return "materiály";
    if (normalized === "data_shards" || normalized === "data") return "data";
    if (normalized === "chemicals") return "chemicals";
    if (normalized === "biomass") return "biomass";
    if (normalized === "stim_pack") return "stim pack";
    if (normalized === "neon_dust") return "neon dust";
    if (normalized === "pulse_shot") return "pulse shot";
    if (normalized === "velvet_smoke") return "velvet smoke";
    if (normalized === "ghost_serum") return "ghost serum";
    if (normalized === "overdrive_x") return "overdrive x";
    if (normalized === "metal_parts") return "metal parts";
    if (normalized === "tech_core") return "tech core";
    if (normalized === "combat_module") return "combat module";
    if (normalized === "baseball_bat") return "baseballová pálka";
    if (normalized === "street_pistol") return "pouliční pistole";
    if (normalized === "grenade") return "granát";
    if (normalized === "smg") return "samopal";
    if (normalized === "bazooka") return "bazuka";
    if (normalized === "bulletproof_vest") return "neprůstřelná vesta";
    if (normalized === "steel_barricades") return "ocelové barikády";
    if (normalized === "security_cameras") return "bezpečnostní kamery";
    if (normalized === "auto_mg_nest") return "automatické kulometné stanoviště";
    if (normalized === "alarm_system") return "alarm";
    return "komodita";
  }

  function clearDisabledIntelTypeDistrictGossipOnRefresh() {
    const nextStore = {};
    let changed = false;
    Object.entries(districtGossipStore || {}).forEach(([districtId, entries]) => {
      const currentEntries = Array.isArray(entries) ? entries : [];
      const filteredEntries = currentEntries.filter((entry) => {
        const intelType = String(entry?.intelType || "").trim().toLowerCase();
        return !DISTRICT_GOSSIP_DISABLED_INTEL_TYPES.has(intelType);
      });
      if (filteredEntries.length !== currentEntries.length) {
        changed = true;
      }
      if (filteredEntries.length) {
        nextStore[districtId] = filteredEntries;
      }
    });
    if (!changed) return;
    districtGossipStore = nextStore;
    saveDistrictGossipStore();
  }

  function formatMarketSideLabel(side) {
    return String(side || "").trim().toLowerCase() === "sell" ? "prodejní" : "nákupní";
  }

  function buildRandomVerifiedDistrictGossip(district, payload = {}) {
    const districtLabel = resolveDistrictNumberLabel(district);
    const seedSource = `${districtLabel}:${Date.now()}:${payload?.districtId || ""}:${payload?.sourceBuilding || ""}`;
    const seed = Math.abs(hashOwner(seedSource));
    const options = [
      `Potvrzený intel: V districtu ${districtLabel} proběhl tichý přesun hotovosti přes noční podniky.`,
      `Potvrzený intel: V districtu ${districtLabel} byla zachycena nečekaná zásilka materiálu po zavírací době.`,
      `Potvrzený intel: V districtu ${districtLabel} se mění směny ochranky kvůli interním sporům.`,
      `Potvrzený intel: V districtu ${districtLabel} došlo k přesunu zbraní do provizorního skladu.`,
      `Potvrzený intel: V districtu ${districtLabel} byl zaznamenán zvýšený pohyb kurýrů mezi podniky.`,
      `Potvrzený intel: V districtu ${districtLabel} se připravuje rychlá výměna vedení lokální buňky.`,
      `Potvrzený intel: V districtu ${districtLabel} byla potvrzena dohoda o ochraně tras.`,
      `Potvrzený intel: V districtu ${districtLabel} se krátkodobě stáhla pouliční hlídka kvůli internímu rozkazu.`
    ];
    return options[seed % options.length];
  }

  function buildIntelEventText(type, district, payload = {}) {
    const districtLabel = resolveDistrictNumberLabel(district);
    const resourceLabel = formatMarketResourceLabel(payload.resourceKey);
    const sideLabel = formatMarketSideLabel(payload.side);
    const quantityLabel = Math.max(0, Math.floor(Number(payload.quantity) || 0));
    const priceLabel = Math.max(0, Math.floor(Number(payload.pricePerUnit) || 0));
    const fallbackMessage = String(payload.message || "").trim();

    if (type === "attack_success") {
      return `Potvrzený intel: V districtu ${districtLabel} proběhl útok a kontrola sektoru byla narušena.`;
    }
    if (type === "attack_failed") {
      return `Potvrzený intel: Pokus o útok v districtu ${districtLabel} byl odražen.`;
    }
    if (type === "raid_started") {
      return `Potvrzený intel: V districtu ${districtLabel} bylo zahájeno vykrádání.`;
    }
    if (type === "spy_started") {
      return buildRandomVerifiedDistrictGossip(district, payload);
    }
    if (type === "market_order_created") {
      const details = quantityLabel > 0 && priceLabel > 0
        ? ` (${quantityLabel} ks / $${priceLabel})`
        : "";
      return `Potvrzený intel: Přes district ${districtLabel} prošel ${sideLabel} příkaz na ${resourceLabel}${details}.`;
    }
    if (type === "market_order_cancelled") {
      return `Potvrzený intel: V districtu ${districtLabel} byl stažen tržní příkaz na ${resourceLabel}.`;
    }
    if (fallbackMessage) {
      return `Potvrzený intel: ${fallbackMessage}`;
    }
    return `Potvrzený intel: V districtu ${districtLabel} byl zaznamenán pohyb v podsvětí.`;
  }

  function recordIntelEvent(payload = {}) {
    const type = String(payload?.type || "").trim().toLowerCase();
    if (!type) return [];
    if (DISTRICT_GOSSIP_DISABLED_INTEL_TYPES.has(type)) return [];
    const targets = resolveIntelEventDistrictTargets(payload);
    if (!targets.length) return [];
    const now = Date.now();
    const entries = [];

    targets.forEach((district, index) => {
      const text = buildIntelEventText(type, district, payload);
      const entry = appendDistrictGossip(district, text, {
        createdAt: now + index,
        sourceBuilding: payload?.sourceBuilding || null,
        sourceDistrictId: payload?.sourceDistrictId ?? payload?.districtId ?? district?.id ?? null,
        intelLevel: "verified",
        intelType: type
      });
      if (entry) {
        entries.push({
          ...entry,
          districtId: district?.id ?? null,
          districtName: district?.name || null
        });
      }
    });

    refreshOpenDistrictGossipSection();
    return entries;
  }

  function syncApartmentProductionAndIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getApartmentLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const capacity = Math.max(1, Math.floor(APARTMENT_BLOCK_CONFIG.baseCapacity * levelMultiplier));
    const cycleMs = APARTMENT_BLOCK_CONFIG.productionCycleMs;

    stateRef.hiddenHousingActive = stateRef.hiddenHousingActive && nowMs < Number(stateRef.effects.hiddenHousingUntil || 0);

    if (stateRef.storedMembers >= capacity) {
      stateRef.storedMembers = capacity;
      stateRef.productionRemainder = 0;
      stateRef.lastProductionAt = nowMs;
    } else {
      let productionFrom = Number(stateRef.lastProductionAt || nowMs);
      if (!Number.isFinite(productionFrom) || productionFrom > nowMs) {
        productionFrom = nowMs;
      }
      const cycleCount = Math.max(0, Math.floor((nowMs - productionFrom) / cycleMs));
      if (cycleCount > 0) {
        let reachedCapacity = false;
        let appliedCycles = 0;
        for (let i = 0; i < cycleCount; i += 1) {
          const cycleTime = productionFrom + (i + 1) * cycleMs;
          const motivationActive = cycleTime < Number(stateRef.effects.motivationUntil || 0);
          const cycleMultiplier = motivationActive ? 2 : 1;
          const producedRaw =
            APARTMENT_BLOCK_CONFIG.baseProductionPerCycle * levelMultiplier * cycleMultiplier
            + Number(stateRef.productionRemainder || 0);
          const producedWhole = Math.floor(producedRaw);
          stateRef.productionRemainder = Math.max(0, producedRaw - producedWhole);
          if (producedWhole > 0) {
            stateRef.storedMembers = Math.min(capacity, Number(stateRef.storedMembers || 0) + producedWhole);
            if (stateRef.storedMembers >= capacity) {
              stateRef.productionRemainder = 0;
              reachedCapacity = true;
              appliedCycles = i + 1;
              break;
            }
          }
          appliedCycles = i + 1;
        }
        if (reachedCapacity) {
          stateRef.lastProductionAt = nowMs;
        } else {
          stateRef.lastProductionAt = productionFrom + appliedCycles * cycleMs;
        }
      }
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    const hiddenUntil = Number(stateRef.effects.hiddenHousingUntil || 0);
    const hiddenActive = stateRef.hiddenHousingActive && incomeFrom < hiddenUntil;
    if (hiddenActive) {
      const blockedUntil = Math.min(nowMs, hiddenUntil);
      incomeFrom = blockedUntil;
      if (nowMs >= hiddenUntil) {
        stateRef.hiddenHousingActive = false;
      }
    }

    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const hourlyCleanIncome =
        (APARTMENT_BLOCK_CONFIG.baseCleanIncomePerHour
          + Math.max(0, Number(totalGangMembers || 0)) * APARTMENT_BLOCK_CONFIG.cleanIncomePerGangMemberPerHour)
        * levelMultiplier
        * districtIncomeMultiplier;
      const hourlyDirtyIncome =
        (APARTMENT_BLOCK_CONFIG.baseDirtyIncomePerHour
          + Math.max(0, Number(totalGangMembers || 0)) * APARTMENT_BLOCK_CONFIG.dirtyIncomePerGangMemberPerHour)
        * levelMultiplier
        * districtIncomeMultiplier;
      const cleanRaw = hoursElapsed * hourlyCleanIncome + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw = hoursElapsed * hourlyDirtyIncome + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    applyBuildingInfluenceTick(stateRef, nowMs, BUILDING_INFLUENCE_PER_HOUR);

    return { cleanIncomeGained, dirtyIncomeGained };
  }

  function resolveApartmentBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getApartmentStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncApartmentProductionAndIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistApartmentState(key, snapshot);

    const levelMultiplier = getApartmentLevelMultiplier(snapshot.level);
    const capacity = Math.max(1, Math.floor(APARTMENT_BLOCK_CONFIG.baseCapacity * levelMultiplier));
    const motivationActive = now < Number(snapshot.effects.motivationUntil || 0);
    const hiddenHousingActive = snapshot.hiddenHousingActive && now < Number(snapshot.effects.hiddenHousingUntil || 0);
    const productionPerCycle =
      APARTMENT_BLOCK_CONFIG.baseProductionPerCycle
      * levelMultiplier
      * (motivationActive ? 2 : 1);
    const hourlyCleanIncome = hiddenHousingActive
      ? 0
      : (APARTMENT_BLOCK_CONFIG.baseCleanIncomePerHour
        + totalGangMembers * APARTMENT_BLOCK_CONFIG.cleanIncomePerGangMemberPerHour)
      * levelMultiplier;
    const hourlyDirtyIncome = hiddenHousingActive
      ? 0
      : (APARTMENT_BLOCK_CONFIG.baseDirtyIncomePerHour
        + totalGangMembers * APARTMENT_BLOCK_CONFIG.dirtyIncomePerGangMemberPerHour)
      * levelMultiplier;
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const dailyIncome = hourlyIncome * 24;
    const nextLevel = snapshot.level < APARTMENT_BLOCK_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? APARTMENT_BLOCK_CONFIG.upgradeCosts[nextLevel] || 0 : 0;

    const effects = [];
    if (motivationActive) {
      effects.push(`Motivační večer (${formatDurationLabel(snapshot.effects.motivationUntil - now)})`);
    }
    if (hiddenHousingActive) {
      effects.push(`Skryté ubytování (${formatDurationLabel(snapshot.effects.hiddenHousingUntil - now)})`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome,
      info:
        "Bytový blok je personální centrum gangu: každých 10 minut produkuje členy do kapacity, kterou musíš pravidelně vybírat tlačítkem Vybrat členy. Pokud je kapacita plná, produkce se zastaví. Budova generuje clean a dirty cash, Nábor z ulice okamžitě doplní část kapacity, Motivační večer na 2h zdvojnásobí produkci a Skryté ubytování na 2h vypne income, ale aktivuje ochranný režim. Každý upgrade zvyšuje produkci, kapacitu i income o 10 %.",
      specialActions: [
        "Nábor z ulice: Cooldown 3h, okamžitě přidá náhodně 5 až 15 členů do kapacity budovy a přidá +5 heat.",
        "Motivační večer: Cooldown 6h, na 2h zdvojnásobí produkci členů v budově.",
        "Skryté ubytování: Cooldown 8h, na 2h nastaví income budovy na 0 a aktivuje ochranný režim proti razii."
      ],
      mechanics: {
        type: "apartment-block",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        storedMembers: Math.max(0, Math.floor(snapshot.storedMembers || 0)),
        capacity,
        productionPerCycle,
        heatPerDay: APARTMENT_BLOCK_CONFIG.baseHeatPerDay + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.length ? effects.join(" • ") : "Žádné",
        cooldowns: {
          recruit: Math.max(0, Number(snapshot.cooldowns.recruit || 0) - now),
          motivation: Math.max(0, Number(snapshot.cooldowns.motivation || 0) - now),
          hiddenHousing: Math.max(0, Number(snapshot.cooldowns.hiddenHousing || 0) - now)
        },
        hiddenHousingActive,
        loyaltyPenalty: Number(snapshot.loyaltyPenalty || 0)
      }
    };
  }

  function resolveActiveBuildingContext() {
    const current = state.activeBuildingDetail;
    if (!current || typeof current !== "object") return null;
    const district = current.district || null;
    const context = current.context || null;
    if (!context) return null;
    return { district, context };
  }

  function handleApartmentBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getApartmentStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncApartmentProductionAndIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const levelMultiplier = getApartmentLevelMultiplier(snapshot.level);
    const capacity = Math.max(1, Math.floor(APARTMENT_BLOCK_CONFIG.baseCapacity * levelMultiplier));
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "collect") {
      const collected = Math.max(0, Math.floor(Number(snapshot.storedMembers || 0)));
      if (collected <= 0) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: "Bytový blok: Není co vybrat." };
      }
      const addMembers = window.Empire.UI?.addGangMembers;
      if (typeof addMembers === "function") {
        addMembers(collected);
      }
      snapshot.storedMembers = 0;
      snapshot.lastProductionAt = now;
      persistApartmentState(key, snapshot);
      return { ok: true, message: `Bytový blok: Přidáno ${collected} členů do gangu.` };
    }

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.recruit);
      if (cooldownLeft > 0) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: `Nábor z ulice je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const randomAdded =
        APARTMENT_BLOCK_CONFIG.recruitRange.min
        + Math.floor(Math.random() * (APARTMENT_BLOCK_CONFIG.recruitRange.max - APARTMENT_BLOCK_CONFIG.recruitRange.min + 1));
      const freeSpace = Math.max(0, capacity - Math.floor(snapshot.storedMembers || 0));
      const added = Math.max(0, Math.min(freeSpace, randomAdded));
      snapshot.storedMembers = Math.min(capacity, Math.floor(snapshot.storedMembers || 0) + added);
      snapshot.cooldowns.recruit = now + APARTMENT_BLOCK_CONFIG.actionCooldowns.recruit;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + 5;
      persistApartmentState(key, snapshot);
      return {
        ok: true,
        message: `Nábor z ulice: +${added} členů (${snapshot.storedMembers}/${capacity}), heat +5.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.motivation);
      if (cooldownLeft > 0) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: `Motivační večer je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.motivationUntil = now + APARTMENT_BLOCK_CONFIG.actionDurations.motivation;
      snapshot.cooldowns.motivation = now + APARTMENT_BLOCK_CONFIG.actionCooldowns.motivation;
      snapshot.loyaltyPenalty = Number(snapshot.loyaltyPenalty || 0);
      persistApartmentState(key, snapshot);
      return {
        ok: true,
        message: "Motivační večer aktivní na 2h. Produkce členů je nyní x2."
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.hiddenHousing);
      if (cooldownLeft > 0) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: `Skryté ubytování je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.hiddenHousingActive = true;
      snapshot.effects.hiddenHousingUntil = now + APARTMENT_BLOCK_CONFIG.actionDurations.hiddenHousing;
      snapshot.cooldowns.hiddenHousing = now + APARTMENT_BLOCK_CONFIG.actionCooldowns.hiddenHousing;
      snapshot.lastIncomeAt = now;
      persistApartmentState(key, snapshot);
      return {
        ok: true,
        message: "Skryté ubytování aktivní na 2h. Budova má během efektu 0 income."
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > APARTMENT_BLOCK_CONFIG.maxLevel) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: "Bytový blok je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(APARTMENT_BLOCK_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistApartmentState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistApartmentState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }

      snapshot.level = nextLevel;
      persistApartmentState(key, snapshot);
      return { ok: true, message: `Bytový blok vylepšen na level ${nextLevel} za $${cost}.` };
    }

    persistApartmentState(key, snapshot);
    return null;
  }

  function syncSchoolProductionAndIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getSchoolLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const capacity = Math.max(1, Math.floor(SCHOOL_BUILDING_CONFIG.baseCapacity * levelMultiplier));
    const cycleMs = SCHOOL_BUILDING_CONFIG.productionCycleMs;

    stateRef.eveningProgramActive = stateRef.eveningProgramActive && nowMs < Number(stateRef.effects.eveningUntil || 0);
    stateRef.districtHeatReductionActive =
      stateRef.districtHeatReductionActive && nowMs < Number(stateRef.effects.eveningUntil || 0);

    if (stateRef.storedMembers >= capacity) {
      stateRef.storedMembers = capacity;
      stateRef.productionRemainder = 0;
      stateRef.lastProductionAt = nowMs;
    } else {
      let productionFrom = Number(stateRef.lastProductionAt || nowMs);
      if (!Number.isFinite(productionFrom) || productionFrom > nowMs) {
        productionFrom = nowMs;
      }
      const cycleCount = Math.max(0, Math.floor((nowMs - productionFrom) / cycleMs));
      if (cycleCount > 0) {
        const producedRaw =
          cycleCount * SCHOOL_BUILDING_CONFIG.baseProductionPerCycle * levelMultiplier
          + Number(stateRef.productionRemainder || 0);
        const producedWhole = Math.max(0, Math.floor(producedRaw));
        stateRef.productionRemainder = Math.max(0, producedRaw - producedWhole);
        stateRef.storedMembers = Math.min(capacity, Number(stateRef.storedMembers || 0) + producedWhole);
        if (stateRef.storedMembers >= capacity) {
          stateRef.productionRemainder = 0;
          stateRef.lastProductionAt = nowMs;
        } else {
          stateRef.lastProductionAt = productionFrom + cycleCount * cycleMs;
        }
      }
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    const eveningUntil = Number(stateRef.effects.eveningUntil || 0);
    const eveningActive = stateRef.eveningProgramActive && incomeFrom < eveningUntil;
    if (eveningActive) {
      const blockedUntil = Math.min(nowMs, eveningUntil);
      incomeFrom = blockedUntil;
      if (nowMs >= eveningUntil) {
        stateRef.eveningProgramActive = false;
        stateRef.districtHeatReductionActive = false;
      }
    }

    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
      const hourlyCleanIncome =
        (SCHOOL_BUILDING_CONFIG.baseCleanIncomePerHour
          + memberSteps * SCHOOL_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
        * levelMultiplier
        * districtIncomeMultiplier;
      const hourlyDirtyIncome =
        (SCHOOL_BUILDING_CONFIG.baseDirtyIncomePerHour
          + memberSteps * SCHOOL_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
        * levelMultiplier
        * districtIncomeMultiplier;
      const cleanRaw = hoursElapsed * hourlyCleanIncome + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw = hoursElapsed * hourlyDirtyIncome + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    applyBuildingInfluenceTick(stateRef, nowMs, BUILDING_INFLUENCE_PER_HOUR);

    return { cleanIncomeGained, dirtyIncomeGained };
  }

  function resolveSchoolBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getSchoolStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncSchoolProductionAndIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistSchoolState(key, snapshot);

    const levelMultiplier = getSchoolLevelMultiplier(snapshot.level);
    const capacity = Math.max(1, Math.floor(SCHOOL_BUILDING_CONFIG.baseCapacity * levelMultiplier));
    const chemistryActive = now < Number(snapshot.effects.chemistryUntil || 0);
    const eveningActive = snapshot.eveningProgramActive && now < Number(snapshot.effects.eveningUntil || 0);
    const hasDrugLab = districtHasDrugLab(district || context?.districtId);
    const passiveDrugLabBonusPct = hasDrugLab
      ? SCHOOL_BUILDING_CONFIG.baseDrugLabPassiveBonusPct * levelMultiplier
      : 0;
    const chemistryBoostPct = hasDrugLab && chemistryActive ? SCHOOL_BUILDING_CONFIG.chemistryBoostPct : 0;
    const totalDrugLabBoostPct = passiveDrugLabBonusPct + chemistryBoostPct;
    const productionPerCycle = SCHOOL_BUILDING_CONFIG.baseProductionPerCycle * levelMultiplier;
    const memberSteps = Math.max(0, Math.floor(totalGangMembers / 10));
    const hourlyCleanIncome = eveningActive
      ? 0
      : (SCHOOL_BUILDING_CONFIG.baseCleanIncomePerHour
        + memberSteps * SCHOOL_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
      * levelMultiplier;
    const hourlyDirtyIncome = eveningActive
      ? 0
      : (SCHOOL_BUILDING_CONFIG.baseDirtyIncomePerHour
        + memberSteps * SCHOOL_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
      * levelMultiplier;
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const dailyIncome = hourlyIncome * 24;
    const nextLevel = snapshot.level < SCHOOL_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? SCHOOL_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;

    const effects = [];
    effects.push(hasDrugLab
      ? `Pasivní bonus Drug Lab +${formatDecimalValue(passiveDrugLabBonusPct, 2)}%`
      : "Pasivní bonus Drug Lab: není aktivní (v districtu není Drug Lab)");
    if (chemistryActive) {
      effects.push(`Zrychlený kurz chemie (${formatDurationLabel(snapshot.effects.chemistryUntil - now)})`);
    }
    if (hasDrugLab && totalDrugLabBoostPct > 0) {
      effects.push(`Celkový boost Drug Lab +${formatDecimalValue(totalDrugLabBoostPct, 2)}%`);
    }
    if (eveningActive) {
      effects.push(`Večerní program (${formatDurationLabel(snapshot.effects.eveningUntil - now)})`);
    }
    if (snapshot.districtHeatReductionActive && eveningActive) {
      effects.push(`Heat districtu -${SCHOOL_BUILDING_CONFIG.eveningHeatReductionPct}%`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome,
      info:
        "Škola produkuje 1 člena každých 10 minut do kapacity 12 (škáluje s levelem) a přes Vybrat členy je převádí do gangu. Budova generuje clean a dirty cash, heat 2/24h. Akce: Náborová přednáška (CD 3h, +4 až +10 členů, +2 heat), Zrychlený kurz chemie (CD 4h, 2h, Drug Lab +25 %, +3 heat), Večerní program (CD 6h, 2h, heat districtu -20 %, income školy 0). Upgrady L2/L3/L4 za $5000/$15000/$40000 dávají +10 % produkce, income, kapacity a síly pasivního bonusu Drug Lab.",
      specialActions: [
        "Náborová přednáška: Cooldown 3h, okamžitě přidá náhodně 4 až 10 členů do kapacity školy a přidá +2 heat.",
        "Zrychlený kurz chemie: Cooldown 4h, trvá 2h a pokud je v districtu Drug Lab, zvýší jeho rychlost o +25 % (+3 heat).",
        "Večerní program: Cooldown 6h, trvá 2h, snižuje heat districtu o 20 %, ale income školy je během efektu 0."
      ],
      mechanics: {
        type: "school",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        storedMembers: Math.max(0, Math.floor(snapshot.storedMembers || 0)),
        capacity,
        productionPerCycle,
        heatPerDay: SCHOOL_BUILDING_CONFIG.baseHeatPerDay + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          lecture: Math.max(0, Number(snapshot.cooldowns.lecture || 0) - now),
          chemistry: Math.max(0, Number(snapshot.cooldowns.chemistry || 0) - now),
          evening: Math.max(0, Number(snapshot.cooldowns.evening || 0) - now)
        },
        hasDrugLab,
        passiveDrugLabBonusPct,
        chemistryBoostPct,
        totalDrugLabBoostPct,
        districtHeatReductionPct: eveningActive ? SCHOOL_BUILDING_CONFIG.eveningHeatReductionPct : 0,
        eveningProgramActive: eveningActive
      }
    };
  }

  function handleSchoolBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getSchoolStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncSchoolProductionAndIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const levelMultiplier = getSchoolLevelMultiplier(snapshot.level);
    const capacity = Math.max(1, Math.floor(SCHOOL_BUILDING_CONFIG.baseCapacity * levelMultiplier));
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));
    const hasDrugLab = districtHasDrugLab(district || context?.districtId);

    if (actionId === "collect") {
      const collected = Math.max(0, Math.floor(Number(snapshot.storedMembers || 0)));
      if (collected <= 0) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: "Škola: Není co vybrat." };
      }
      const addMembers = window.Empire.UI?.addGangMembers;
      if (typeof addMembers === "function") {
        addMembers(collected);
      }
      snapshot.storedMembers = 0;
      snapshot.lastProductionAt = now;
      persistSchoolState(key, snapshot);
      return { ok: true, message: `Škola: Přidáno ${collected} členů do gangu.` };
    }

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.lecture);
      if (cooldownLeft > 0) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: `Náborová přednáška je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const randomAdded =
        SCHOOL_BUILDING_CONFIG.lectureRange.min
        + Math.floor(Math.random() * (SCHOOL_BUILDING_CONFIG.lectureRange.max - SCHOOL_BUILDING_CONFIG.lectureRange.min + 1));
      const freeSpace = Math.max(0, capacity - Math.floor(snapshot.storedMembers || 0));
      const added = Math.max(0, Math.min(freeSpace, randomAdded));
      snapshot.storedMembers = Math.min(capacity, Math.floor(snapshot.storedMembers || 0) + added);
      snapshot.cooldowns.lecture = now + SCHOOL_BUILDING_CONFIG.actionCooldowns.lecture;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + 2;
      persistSchoolState(key, snapshot);
      return {
        ok: true,
        message: `Náborová přednáška: +${added} členů (${snapshot.storedMembers}/${capacity}), heat +2.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.chemistry);
      if (cooldownLeft > 0) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: `Zrychlený kurz chemie je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.chemistryUntil = now + SCHOOL_BUILDING_CONFIG.actionDurations.chemistry;
      snapshot.cooldowns.chemistry = now + SCHOOL_BUILDING_CONFIG.actionCooldowns.chemistry;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + 3;
      persistSchoolState(key, snapshot);
      return {
        ok: true,
        message: hasDrugLab
          ? "Zrychlený kurz chemie aktivní na 2h. Drug Lab v districtu má +25 % rychlost."
          : "Zrychlený kurz chemie aktivní na 2h. V districtu ale chybí Drug Lab, bonus se teď neaplikuje."
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.evening);
      if (cooldownLeft > 0) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: `Večerní program je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.eveningProgramActive = true;
      snapshot.districtHeatReductionActive = true;
      snapshot.effects.eveningUntil = now + SCHOOL_BUILDING_CONFIG.actionDurations.evening;
      snapshot.cooldowns.evening = now + SCHOOL_BUILDING_CONFIG.actionCooldowns.evening;
      snapshot.lastIncomeAt = now;
      persistSchoolState(key, snapshot);
      return {
        ok: true,
        message: "Večerní program aktivní na 2h. Heat districtu -20 %, income školy během efektu = 0."
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > SCHOOL_BUILDING_CONFIG.maxLevel) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: "Škola je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(SCHOOL_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistSchoolState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistSchoolState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistSchoolState(key, snapshot);
      return { ok: true, message: `Škola vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistSchoolState(key, snapshot);
    return null;
  }

  function syncFitnessIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelEffects = getFitnessLevelEffects(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const talentRecruitmentIncomeActive = nowMs < Number(stateRef.effects.talentRecruitmentIncomeUntil || 0);
    const talentRecruitmentInfluenceActive = nowMs < Number(stateRef.effects.talentRecruitmentInfluenceUntil || 0);
    const actionEffectMultiplier = Math.max(1, Number(levelEffects.actionEffectMultiplier || 1));
    const talentRecruitmentIncomeBoostPct = talentRecruitmentIncomeActive
      ? FITNESS_BUILDING_CONFIG.talentRecruitmentDistrictIncomeBoostPct * actionEffectMultiplier
      : 0;
    const incomeMultiplier = Math.max(0, 1 + talentRecruitmentIncomeBoostPct / 100);
    const talentRecruitmentInfluenceBoostPct = talentRecruitmentInfluenceActive
      ? FITNESS_BUILDING_CONFIG.talentRecruitmentInfluenceBoostPct * actionEffectMultiplier
      : 0;
    const influenceMultiplier = Math.max(0, 1 + talentRecruitmentInfluenceBoostPct / 100);

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const baseHourlyCleanIncome = FITNESS_BUILDING_CONFIG.baseCleanIncomePerHour * levelEffects.incomeMultiplier;
      const baseHourlyDirtyIncome = FITNESS_BUILDING_CONFIG.baseDirtyIncomePerHour * levelEffects.incomeMultiplier;
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (baseHourlyCleanIncome * incomeMultiplier * districtIncomeMultiplier)
        + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (baseHourlyDirtyIncome * incomeMultiplier * districtIncomeMultiplier)
        + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    if (cleanIncomeGained > 0 || dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(cleanIncomeGained, dirtyIncomeGained);
    }

    const influencePerHour = FITNESS_BUILDING_CONFIG.baseInfluencePerHour * influenceMultiplier;
    applyBuildingInfluenceTick(stateRef, nowMs, influencePerHour);

    return { cleanIncomeGained, dirtyIncomeGained };
  }

  function resolveFitnessBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getFitnessStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncFitnessIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistFitnessState(key, snapshot);

    const levelEffects = getFitnessLevelEffects(snapshot.level);
    const actionEffectMultiplier = Math.max(1, Number(levelEffects.actionEffectMultiplier || 1));
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(district || context?.districtId, now);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const gangTrainingActive = now < Number(snapshot.effects.gangTrainingUntil || 0);
    const talentRecruitmentInfluenceActive = now < Number(snapshot.effects.talentRecruitmentInfluenceUntil || 0);
    const talentRecruitmentIncomeActive = now < Number(snapshot.effects.talentRecruitmentIncomeUntil || 0);
    const dopingRushActive = now < Number(snapshot.effects.dopingRushUntil || 0);
    const dopingCrashActive = now < Number(snapshot.effects.dopingCrashUntil || 0);

    const gangTrainingAttackBoostPct = FITNESS_BUILDING_CONFIG.gangTrainingAttackBoostPct * actionEffectMultiplier;
    const gangTrainingDefenseBoostPct = FITNESS_BUILDING_CONFIG.gangTrainingDefenseBoostPct * actionEffectMultiplier;
    const talentRecruitmentInfluenceBoostPct = FITNESS_BUILDING_CONFIG.talentRecruitmentInfluenceBoostPct * actionEffectMultiplier;
    const talentRecruitmentIncomeBoostPct = FITNESS_BUILDING_CONFIG.talentRecruitmentDistrictIncomeBoostPct * actionEffectMultiplier;
    const dopingRushAttackBoostPct = FITNESS_BUILDING_CONFIG.dopingRushAttackBoostPct * actionEffectMultiplier;
    const dopingCrashDefensePenaltyPct = FITNESS_BUILDING_CONFIG.dopingCrashDefensePenaltyPct * actionEffectMultiplier;

    const currentIncomeMultiplier = Math.max(0, 1 + (talentRecruitmentIncomeActive ? talentRecruitmentIncomeBoostPct : 0) / 100);
    const baseHourlyCleanIncome = FITNESS_BUILDING_CONFIG.baseCleanIncomePerHour * levelEffects.incomeMultiplier;
    const baseHourlyDirtyIncome = FITNESS_BUILDING_CONFIG.baseDirtyIncomePerHour * levelEffects.incomeMultiplier;
    const hourlyCleanIncome = baseHourlyCleanIncome * currentIncomeMultiplier * districtIncomeMultiplier;
    const hourlyDirtyIncome = baseHourlyDirtyIncome * currentIncomeMultiplier * districtIncomeMultiplier;
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const dailyIncome = hourlyIncome * 24;
    const nextLevel = snapshot.level < FITNESS_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? FITNESS_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;

    const effects = [];
    if (gangTrainingActive) {
      effects.push(
        `Trénink gangu (ATK +${formatDecimalValue(gangTrainingAttackBoostPct, 2)}%, DEF +${formatDecimalValue(gangTrainingDefenseBoostPct, 2)}%, ${formatDurationLabel(
          snapshot.effects.gangTrainingUntil - now
        )})`
      );
    }
    if (talentRecruitmentInfluenceActive || talentRecruitmentIncomeActive) {
      const influencePart = talentRecruitmentInfluenceActive
        ? `Vliv +${formatDecimalValue(talentRecruitmentInfluenceBoostPct, 2)}%`
        : "Vliv bonus skončil";
      const incomePart = talentRecruitmentIncomeActive
        ? `district income +${formatDecimalValue(talentRecruitmentIncomeBoostPct, 2)}%`
        : "district income bonus skončil";
      const influenceLeft = Math.max(0, Number(snapshot.effects.talentRecruitmentInfluenceUntil || 0) - now);
      const incomeLeft = Math.max(0, Number(snapshot.effects.talentRecruitmentIncomeUntil || 0) - now);
      effects.push(`Nábor talentu (${influencePart}, ${incomePart}, ${formatDurationLabel(Math.max(influenceLeft, incomeLeft))})`);
    }
    if (dopingRushActive) {
      effects.push(
        `Doping (+${formatDecimalValue(dopingRushAttackBoostPct, 2)}% ATK, ${formatDurationLabel(snapshot.effects.dopingRushUntil - now)})`
      );
    }
    if (dopingCrashActive) {
      effects.push(
        `Doping crash (-${formatDecimalValue(dopingCrashDefensePenaltyPct, 2)}% DEF, ${formatDurationLabel(snapshot.effects.dopingCrashUntil - now)})`
      );
    }

    const totalAttackBoostPct =
      Math.max(0, Number(levelEffects.permanentAttackPct || 0))
      + (gangTrainingActive ? gangTrainingAttackBoostPct : 0)
      + (dopingRushActive ? dopingRushAttackBoostPct : 0);
    const totalDefenseBoostPct =
      Math.max(0, Number(levelEffects.permanentDefensePct || 0))
      + (gangTrainingActive ? gangTrainingDefenseBoostPct : 0)
      - (dopingCrashActive ? dopingCrashDefensePenaltyPct : 0);

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome,
      info:
        "Síla, disciplína a respekt. Fitness Club je bojová utility budova s pevnými příjmy, tlakem na heat a taktickými buffy pro útok, obranu, vliv i district income.",
      specialActions: [
        "Trénink gangu: Cooldown 8h, trvá 2h, +10% ATK a +10% DEF (na L3+ silnější), heat +5.",
        "Nábor talentu: Cooldown 10h, vliv +10% na 2h, district income +2% na 4h (na L3+ silnější), heat +4.",
        "Doping: Cooldown 12h, +35% ATK na 1h (na L3+ silnější), po skončení -10% DEF na 1h, heat +8."
      ],
      mechanics: {
        type: "fitness-club",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay:
          FITNESS_BUILDING_CONFIG.baseHeatPerDay * levelEffects.heatMultiplier + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.length ? effects.join(" • ") : "Žádné",
        cooldowns: {
          gangTraining: Math.max(0, Number(snapshot.cooldowns.gangTraining || 0) - now),
          talentRecruitment: Math.max(0, Number(snapshot.cooldowns.talentRecruitment || 0) - now),
          doping: Math.max(0, Number(snapshot.cooldowns.doping || 0) - now)
        },
        gangTrainingAttackBoostPct,
        gangTrainingDefenseBoostPct,
        talentRecruitmentInfluenceBoostPct,
        talentRecruitmentIncomeBoostPct,
        dopingRushAttackBoostPct,
        dopingCrashDefensePenaltyPct,
        currentIncomeMultiplier,
        hourlyCleanIncome,
        hourlyDirtyIncome,
        districtIncomeBoostPct,
        levelIncomeMultiplier: levelEffects.incomeMultiplier,
        actionEffectMultiplier,
        permanentAttackPct: levelEffects.permanentAttackPct,
        permanentDefensePct: levelEffects.permanentDefensePct,
        totalAttackBoostPct,
        totalDefenseBoostPct,
        gangTrainingActive,
        talentRecruitmentInfluenceActive,
        talentRecruitmentIncomeActive,
        dopingRushActive,
        dopingCrashActive
      }
    };
  }

  function handleFitnessBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getFitnessStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncFitnessIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const levelEffects = getFitnessLevelEffects(snapshot.level);
    const actionEffectMultiplier = Math.max(1, Number(levelEffects.actionEffectMultiplier || 1));
    const heatMultiplier = Math.max(0.01, Number(levelEffects.heatMultiplier || 1));
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.gangTraining);
      if (cooldownLeft > 0) {
        persistFitnessState(key, snapshot);
        return { ok: false, message: `Trénink gangu je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.gangTrainingUntil = now + FITNESS_BUILDING_CONFIG.actionDurations.gangTraining;
      snapshot.cooldowns.gangTraining = now + FITNESS_BUILDING_CONFIG.actionCooldowns.gangTraining;
      const addedHeat = FITNESS_BUILDING_CONFIG.actionHeatAdded.gangTraining * heatMultiplier;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + addedHeat;
      persistFitnessState(key, snapshot);
      return {
        ok: true,
        message:
          `Trénink gangu aktivní na 2h. `
          + `ATK +${formatDecimalValue(FITNESS_BUILDING_CONFIG.gangTrainingAttackBoostPct * actionEffectMultiplier, 2)}%, `
          + `DEF +${formatDecimalValue(FITNESS_BUILDING_CONFIG.gangTrainingDefenseBoostPct * actionEffectMultiplier, 2)}%, `
          + `heat +${formatDecimalValue(addedHeat, 2)}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.talentRecruitment);
      if (cooldownLeft > 0) {
        persistFitnessState(key, snapshot);
        return { ok: false, message: `Nábor talentu je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.talentRecruitmentInfluenceUntil = now + FITNESS_BUILDING_CONFIG.actionDurations.talentRecruitmentInfluence;
      snapshot.effects.talentRecruitmentIncomeUntil = now + FITNESS_BUILDING_CONFIG.actionDurations.talentRecruitmentIncome;
      snapshot.cooldowns.talentRecruitment = now + FITNESS_BUILDING_CONFIG.actionCooldowns.talentRecruitment;
      const addedHeat = FITNESS_BUILDING_CONFIG.actionHeatAdded.talentRecruitment * heatMultiplier;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + addedHeat;
      snapshot.lastIncomeAt = now;
      snapshot.lastInfluenceAt = now;
      persistFitnessState(key, snapshot);
      return {
        ok: true,
        message:
          `Nábor talentu aktivní: `
          + `vliv +${formatDecimalValue(FITNESS_BUILDING_CONFIG.talentRecruitmentInfluenceBoostPct * actionEffectMultiplier, 2)}% na 2h, `
          + `district income +${formatDecimalValue(FITNESS_BUILDING_CONFIG.talentRecruitmentDistrictIncomeBoostPct * actionEffectMultiplier, 2)}% na 4h, `
          + `heat +${formatDecimalValue(addedHeat, 2)}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.doping);
      if (cooldownLeft > 0) {
        persistFitnessState(key, snapshot);
        return { ok: false, message: `Doping je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const rushUntil = now + FITNESS_BUILDING_CONFIG.actionDurations.dopingRush;
      snapshot.effects.dopingRushUntil = rushUntil;
      snapshot.effects.dopingCrashUntil = rushUntil + FITNESS_BUILDING_CONFIG.actionDurations.dopingCrash;
      snapshot.cooldowns.doping = now + FITNESS_BUILDING_CONFIG.actionCooldowns.doping;
      const addedHeat = FITNESS_BUILDING_CONFIG.actionHeatAdded.doping * heatMultiplier;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + addedHeat;
      persistFitnessState(key, snapshot);
      return {
        ok: true,
        message:
          `Doping aktivní na 1h. `
          + `ATK +${formatDecimalValue(FITNESS_BUILDING_CONFIG.dopingRushAttackBoostPct * actionEffectMultiplier, 2)}%, `
          + `poté 1h DEF -${formatDecimalValue(FITNESS_BUILDING_CONFIG.dopingCrashDefensePenaltyPct * actionEffectMultiplier, 2)}%, `
          + `heat +${formatDecimalValue(addedHeat, 2)}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > FITNESS_BUILDING_CONFIG.maxLevel) {
        persistFitnessState(key, snapshot);
        return { ok: false, message: "Fitness Club je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(FITNESS_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistFitnessState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistFitnessState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistFitnessState(key, snapshot);
      return { ok: true, message: `Fitness Club vylepšen na level ${nextLevel} za $${cost}.` };
    }

    persistFitnessState(key, snapshot);
    return null;
  }

  function calculateCasinoHourlyRates(totalGangMembers, levelMultiplier, vipBoostPct = 0, cleanBonusPct = 0) {
    const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
    const memberBonusTotal =
      memberSteps * CASINO_BUILDING_CONFIG.memberBonusPerTenMembersPerHour * Math.max(0, Number(levelMultiplier || 1));
    const baseCleanIncome = CASINO_BUILDING_CONFIG.baseCleanIncomePerHour * levelMultiplier;
    const baseDirtyIncome = CASINO_BUILDING_CONFIG.baseDirtyIncomePerHour * levelMultiplier;
    const bonusCleanIncome = memberBonusTotal * CASINO_BUILDING_CONFIG.memberBonusCleanShare;
    const bonusDirtyIncome = memberBonusTotal * CASINO_BUILDING_CONFIG.memberBonusDirtyShare;
    const incomeMultiplier = Math.max(0, 1 + Math.max(0, Number(vipBoostPct || 0)) / 100);
    const cleanMultiplier = Math.max(0, 1 + Math.max(0, Number(cleanBonusPct || 0)) / 100);
    const hourlyCleanIncome = (baseCleanIncome + bonusCleanIncome) * incomeMultiplier * cleanMultiplier;
    const hourlyDirtyIncome = (baseDirtyIncome + bonusDirtyIncome) * incomeMultiplier;
    return {
      memberSteps,
      memberBonusTotal,
      incomeMultiplier,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function syncCasinoIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getCasinoLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const vipEveningActive = nowMs < Number(stateRef.effects.vipEveningUntil || 0);
    const vipEveningBoostPct = vipEveningActive ? CASINO_BUILDING_CONFIG.vipIncomeBoostPct * levelMultiplier : 0;
    const cleanBonusPct = Number(stateRef.level || 1) >= 4 ? CASINO_BUILDING_CONFIG.cleanIncomeBonusPctLevel4 : 0;
    const rates = calculateCasinoHourlyRates(totalGangMembers, levelMultiplier, vipEveningBoostPct, cleanBonusPct);

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    const baseInfluencePerHour = Math.max(0, Number(CASINO_BUILDING_CONFIG.baseInfluencePerDay || 0)) / 24;
    applyBuildingInfluenceTick(stateRef, nowMs, baseInfluencePerHour);

    let gossipGenerated = 0;
    if (Number(stateRef.level || 1) >= 3) {
      const intervalMs = Math.max(60 * 1000, Number(CASINO_BUILDING_CONFIG.gossipIntervalMsLevel3 || 0));
      const nextGossipAt = Number(stateRef.lastGossipAt || 0) + intervalMs;
      if (nextGossipAt > 0 && nowMs >= nextGossipAt) {
        const rumors = generateRestaurantDistrictGossips(districtOrId, 1, nowMs);
        gossipGenerated = Math.max(0, rumors.length);
        stateRef.lastGossipAt = nowMs;
      } else if (Number(stateRef.lastGossipAt || 0) <= 0) {
        stateRef.lastGossipAt = nowMs;
      }
    } else if (Number(stateRef.lastGossipAt || 0) > 0) {
      stateRef.lastGossipAt = 0;
    }

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      vipEveningActive,
      vipEveningBoostPct,
      gossipGenerated,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      },
      districtIncomeBoostPct
    };
  }

  function resolveCasinoBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getCasinoStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncResult = syncCasinoIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistCasinoState(key, snapshot);

    const levelMultiplier = getCasinoLevelMultiplier(snapshot.level);
    const nextLevel = snapshot.level < CASINO_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? CASINO_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const vipEveningBoostPct = CASINO_BUILDING_CONFIG.vipIncomeBoostPct * levelMultiplier;
    const launderingPct =
      CASINO_BUILDING_CONFIG.launderingPct * levelMultiplier
      + (snapshot.level >= 5 ? CASINO_BUILDING_CONFIG.launderingBonusPctLevel5 : 0);
    const cleanBonusPct = Number(snapshot.level || 1) >= 4 ? CASINO_BUILDING_CONFIG.cleanIncomeBonusPctLevel4 : 0;
    const rates = syncResult.rates || calculateCasinoHourlyRates(totalGangMembers, levelMultiplier, 0, cleanBonusPct);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    if (syncResult.vipEveningActive) {
      effects.push(`VIP večer (+${formatDecimalValue(vipEveningBoostPct, 2)}% income, ${formatDurationLabel(snapshot.effects.vipEveningUntil - now)})`);
    }
    if (Number(snapshot.level || 1) >= 4) {
      effects.push(`L4 bonus clean cash +${formatDecimalValue(CASINO_BUILDING_CONFIG.cleanIncomeBonusPctLevel4, 2)}%`);
    }
    if (Number(snapshot.level || 1) >= 5) {
      effects.push(`L5 bonus praní +${formatDecimalValue(CASINO_BUILDING_CONFIG.launderingBonusPctLevel5, 2)}%`);
    }
    if (Number(syncResult.gossipGenerated || 0) > 0) {
      effects.push(`Vygenerováno drbů: ${Math.max(0, Math.floor(Number(syncResult.gossipGenerated || 0)))}`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyCleanIncome: Number(rates.hourlyCleanIncome || 0),
      hourlyDirtyIncome: Number(rates.hourlyDirtyIncome || 0),
      hourlyIncome,
      dailyIncome,
      info:
        "Velké prachy, velké risky. Kasino tlačí vysoký cashflow, čistí dirty cash, generuje vliv a od L3 dodává pravidelné drby.",
      specialActions: [
        "High Stakes: Cooldown 6h, okamžitě přidá náhodně +50 až +150 % z hodinového income kasina a přidá +10 heat.",
        "Praní peněz: Cooldown 8h, převede 20 % dirty cash na clean (škáluje s levelem), přidá +6 heat.",
        "VIP večer: Cooldown 10h, na 2h zvýší income kasina o +40 % (škáluje s levelem) a přidá +7 heat."
      ],
      mechanics: {
        type: "casino",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: CASINO_BUILDING_CONFIG.baseHeatPerDay * levelMultiplier + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          highStakes: Math.max(0, Number(snapshot.cooldowns.highStakes || 0) - now),
          laundering: Math.max(0, Number(snapshot.cooldowns.laundering || 0) - now),
          vipEvening: Math.max(0, Number(snapshot.cooldowns.vipEvening || 0) - now)
        },
        vipEveningBoostPct,
        launderingPct,
        currentIncomeMultiplier: rates.incomeMultiplier,
        hourlyCleanIncome: rates.hourlyCleanIncome,
        hourlyDirtyIncome: rates.hourlyDirtyIncome,
        vipEveningActive: syncResult.vipEveningActive
      }
    };
  }

  function handleCasinoBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getCasinoStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncAtStart = syncCasinoIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const levelMultiplier = getCasinoLevelMultiplier(snapshot.level);
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.highStakes);
      if (cooldownLeft > 0) {
        persistCasinoState(key, snapshot);
        return { ok: false, message: `High Stakes je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const rates = syncAtStart?.rates
        || calculateCasinoHourlyRates(totalGangMembers, levelMultiplier, 0, snapshot.level >= 4 ? CASINO_BUILDING_CONFIG.cleanIncomeBonusPctLevel4 : 0);
      const hourlyBase = Math.max(0, Number(rates.hourlyTotalIncome || 0));
      const bonusPct = CASINO_BUILDING_CONFIG.highStakesCashBoostMinPct
        + Math.random() * (CASINO_BUILDING_CONFIG.highStakesCashBoostMaxPct - CASINO_BUILDING_CONFIG.highStakesCashBoostMinPct);
      const reward = Math.max(0, Math.floor(hourlyBase * (bonusPct / 100)));
      if (reward > 0) {
        window.Empire.UI?.addCleanCash?.(reward);
      }
      snapshot.cooldowns.highStakes = now + CASINO_BUILDING_CONFIG.actionCooldowns.highStakes;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + CASINO_BUILDING_CONFIG.actionHeatAdded.highStakes;
      persistCasinoState(key, snapshot);
      return {
        ok: true,
        message: `High Stakes: +${formatDecimalValue(bonusPct, 1)}% cash (zisk $${reward}). Heat +${CASINO_BUILDING_CONFIG.actionHeatAdded.highStakes}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.laundering);
      if (cooldownLeft > 0) {
        persistCasinoState(key, snapshot);
        return { ok: false, message: `Praní peněz je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }

      const launderingPct =
        CASINO_BUILDING_CONFIG.launderingPct * levelMultiplier
        + (snapshot.level >= 5 ? CASINO_BUILDING_CONFIG.launderingBonusPctLevel5 : 0);
      const launderDirty = window.Empire.UI?.launderDirtyCash;
      const launderedAmount = typeof launderDirty === "function" ? launderDirty(launderingPct / 100) : 0;

      snapshot.cooldowns.laundering = now + CASINO_BUILDING_CONFIG.actionCooldowns.laundering;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + CASINO_BUILDING_CONFIG.actionHeatAdded.laundering;
      persistCasinoState(key, snapshot);
      return {
        ok: true,
        message:
          `Praní peněz: převedeno $${Math.max(0, Math.floor(launderedAmount))} do čistých. `
          + `Převod ${formatDecimalValue(launderingPct, 2)}% dirty -> clean, heat +${CASINO_BUILDING_CONFIG.actionHeatAdded.laundering}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.vipEvening);
      if (cooldownLeft > 0) {
        persistCasinoState(key, snapshot);
        return { ok: false, message: `VIP večer je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.vipEveningUntil = now + CASINO_BUILDING_CONFIG.actionDurations.vipEvening;
      snapshot.cooldowns.vipEvening = now + CASINO_BUILDING_CONFIG.actionCooldowns.vipEvening;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + CASINO_BUILDING_CONFIG.actionHeatAdded.vipEvening;
      persistCasinoState(key, snapshot);
      return {
        ok: true,
        message: `VIP večer aktivní na 2h. Income kasina +${formatDecimalValue(CASINO_BUILDING_CONFIG.vipIncomeBoostPct * levelMultiplier, 2)}%, heat +${CASINO_BUILDING_CONFIG.actionHeatAdded.vipEvening}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > CASINO_BUILDING_CONFIG.maxLevel) {
        persistCasinoState(key, snapshot);
        return { ok: false, message: "Kasino je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(CASINO_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistCasinoState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistCasinoState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistCasinoState(key, snapshot);
      return { ok: true, message: `Kasino vylepšeno na level ${nextLevel} za $${cost}.` };
    }

    persistCasinoState(key, snapshot);
    return null;
  }

  function calculateArcadeHourlyRates(
    totalGangMembers,
    levelMultiplier,
    { incomeBoostPct = 0, dirtyBoostPct = 0, dirtyUpgradePct = 0 } = {}
  ) {
    const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
    const baseCleanIncome =
      (ARCADE_BUILDING_CONFIG.baseCleanIncomePerHour
        + memberSteps * ARCADE_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
      * levelMultiplier;
    const baseDirtyIncome =
      (ARCADE_BUILDING_CONFIG.baseDirtyIncomePerHour
        + memberSteps * ARCADE_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
      * levelMultiplier
      * Math.max(0, 1 + Math.max(0, Number(dirtyUpgradePct || 0)) / 100);
    const currentIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(incomeBoostPct || 0)) / 100);
    const currentDirtyIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(dirtyBoostPct || 0)) / 100);
    const hourlyCleanIncome = baseCleanIncome * currentIncomeMultiplier;
    const hourlyDirtyIncome = baseDirtyIncome * currentIncomeMultiplier * currentDirtyIncomeMultiplier;

    return {
      memberSteps,
      baseCleanIncome,
      baseDirtyIncome,
      currentIncomeMultiplier,
      currentDirtyIncomeMultiplier,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function syncArcadeIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getArcadeLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const tournamentActive = nowMs < Number(stateRef.effects.tournamentUntil || 0);
    const nightRunActive = nowMs < Number(stateRef.effects.nightRunUntil || 0);
    const incomeBoostPct = tournamentActive ? ARCADE_BUILDING_CONFIG.actionBoosts.tournamentIncomePct : 0;
    const dirtyBoostPct = nightRunActive ? ARCADE_BUILDING_CONFIG.actionBoosts.nightRunDirtyIncomePct : 0;
    const dirtyUpgradePct = stateRef.level >= 3 ? ARCADE_BUILDING_CONFIG.actionBoosts.level3DirtyIncomePct : 0;
    const rates = calculateArcadeHourlyRates(totalGangMembers, levelMultiplier, {
      incomeBoostPct,
      dirtyBoostPct,
      dirtyUpgradePct
    });

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    let passiveLaunderedAmount = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      if (stateRef.level >= 5) {
        passiveLaunderedAmount = Math.max(
          0,
          Math.floor(dirtyIncomeGained * (Math.max(0, Number(ARCADE_BUILDING_CONFIG.actionBoosts.level5PassiveLaunderingPct || 0)) / 100))
        );
        if (passiveLaunderedAmount > 0) {
          cleanIncomeGained += passiveLaunderedAmount;
          dirtyIncomeGained = Math.max(0, dirtyIncomeGained - passiveLaunderedAmount);
        }
      }
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    const influencePerHour = Math.max(0, Number(ARCADE_BUILDING_CONFIG.baseInfluencePerDay || 0)) / 24;
    applyBuildingInfluenceTick(stateRef, nowMs, influencePerHour);

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      passiveLaunderedAmount,
      tournamentActive,
      nightRunActive,
      incomeBoostPct,
      dirtyBoostPct,
      dirtyUpgradePct,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      },
      districtIncomeBoostPct
    };
  }

  function resolveArcadeBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getArcadeStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncResult = syncArcadeIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistArcadeState(key, snapshot);

    const levelMultiplier = getArcadeLevelMultiplier(snapshot.level);
    const nextLevel = snapshot.level < ARCADE_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? ARCADE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const rates = syncResult.rates || calculateArcadeHourlyRates(totalGangMembers, levelMultiplier);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;
    const passiveLaunderingPct = snapshot.level >= 5 ? ARCADE_BUILDING_CONFIG.actionBoosts.level5PassiveLaunderingPct : 0;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    if (syncResult.tournamentActive) {
      effects.push(
        `Turnaj (+${formatDecimalValue(syncResult.incomeBoostPct, 2)}% income, ${formatDurationLabel(
          snapshot.effects.tournamentUntil - now
        )})`
      );
    }
    if (syncResult.nightRunActive) {
      effects.push(
        `Noční tah (+${formatDecimalValue(syncResult.dirtyBoostPct, 2)}% dirty cash, ${formatDurationLabel(
          snapshot.effects.nightRunUntil - now
        )})`
      );
    }
    if (syncResult.dirtyUpgradePct > 0) {
      effects.push(`L3 bonus (+${formatDecimalValue(syncResult.dirtyUpgradePct, 2)}% dirty cash)`);
    }
    if (passiveLaunderingPct > 0) {
      effects.push(`L5 pasivní praní (${formatDecimalValue(passiveLaunderingPct, 2)}% dirty -> clean)`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyIncome,
      dailyIncome,
      info:
        "Menší než kasino, ale pořád jede. Automaty, hry a rychlý cash. Herna generuje čisté i špinavé peníze a přes akce umí krátkodobě zvednout příjmy nebo prát dirty cash.",
      specialActions: [
        "Turnaj: Cooldown 6h, trvá 2h, zvýší income herny o +35 % a přidá +5 heat.",
        "Praní peněz: Cooldown 7h, okamžitě převede 10 % dirty cash na clean cash a přidá +4 heat.",
        "Noční tah: Cooldown 8h, trvá 1h, zvýší dirty cash herny o +50 % a přidá +7 heat."
      ],
      mechanics: {
        type: "arcade",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: ARCADE_BUILDING_CONFIG.baseHeatPerDay * levelMultiplier + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          tournament: Math.max(0, Number(snapshot.cooldowns.tournament || 0) - now),
          laundering: Math.max(0, Number(snapshot.cooldowns.laundering || 0) - now),
          nightRun: Math.max(0, Number(snapshot.cooldowns.nightRun || 0) - now)
        },
        launderingPct: ARCADE_BUILDING_CONFIG.actionBoosts.launderingPct,
        passiveLaunderingPct,
        passiveLaunderedAmount: syncResult.passiveLaunderedAmount,
        currentIncomeMultiplier: rates.currentIncomeMultiplier,
        currentDirtyIncomeMultiplier: rates.currentDirtyIncomeMultiplier,
        tournamentActive: syncResult.tournamentActive,
        nightRunActive: syncResult.nightRunActive,
        dirtyUpgradePct: syncResult.dirtyUpgradePct
      }
    };
  }

  function handleArcadeBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getArcadeStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncArcadeIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.tournament);
      if (cooldownLeft > 0) {
        persistArcadeState(key, snapshot);
        return { ok: false, message: `Turnaj je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.tournamentUntil = now + ARCADE_BUILDING_CONFIG.actionDurations.tournament;
      snapshot.cooldowns.tournament = now + ARCADE_BUILDING_CONFIG.actionCooldowns.tournament;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + ARCADE_BUILDING_CONFIG.actionHeatAdded.tournament;
      persistArcadeState(key, snapshot);
      return {
        ok: true,
        message:
          `Turnaj aktivní na ${formatDurationLabel(ARCADE_BUILDING_CONFIG.actionDurations.tournament)}. `
          + `Income herny +${formatDecimalValue(ARCADE_BUILDING_CONFIG.actionBoosts.tournamentIncomePct, 2)}%, `
          + `heat +${ARCADE_BUILDING_CONFIG.actionHeatAdded.tournament}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.laundering);
      if (cooldownLeft > 0) {
        persistArcadeState(key, snapshot);
        return { ok: false, message: `Praní peněz je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const launderingPct = Math.max(0, Number(ARCADE_BUILDING_CONFIG.actionBoosts.launderingPct || 0));
      const launderDirty = window.Empire.UI?.launderDirtyCash;
      const launderedAmount = typeof launderDirty === "function" ? launderDirty(launderingPct / 100) : 0;
      snapshot.cooldowns.laundering = now + ARCADE_BUILDING_CONFIG.actionCooldowns.laundering;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + ARCADE_BUILDING_CONFIG.actionHeatAdded.laundering;
      persistArcadeState(key, snapshot);
      return {
        ok: true,
        message:
          `Praní peněz: převedeno $${Math.max(0, Math.floor(launderedAmount))} do čistých. `
          + `Převod ${formatDecimalValue(launderingPct, 2)}% dirty -> clean, heat +${ARCADE_BUILDING_CONFIG.actionHeatAdded.laundering}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.nightRun);
      if (cooldownLeft > 0) {
        persistArcadeState(key, snapshot);
        return { ok: false, message: `Noční tah je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.nightRunUntil = now + ARCADE_BUILDING_CONFIG.actionDurations.nightRun;
      snapshot.cooldowns.nightRun = now + ARCADE_BUILDING_CONFIG.actionCooldowns.nightRun;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0)) + ARCADE_BUILDING_CONFIG.actionHeatAdded.nightRun;
      persistArcadeState(key, snapshot);
      return {
        ok: true,
        message:
          `Noční tah aktivní na ${formatDurationLabel(ARCADE_BUILDING_CONFIG.actionDurations.nightRun)}. `
          + `Dirty cash +${formatDecimalValue(ARCADE_BUILDING_CONFIG.actionBoosts.nightRunDirtyIncomePct, 2)}%, `
          + `heat +${ARCADE_BUILDING_CONFIG.actionHeatAdded.nightRun}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > ARCADE_BUILDING_CONFIG.maxLevel) {
        persistArcadeState(key, snapshot);
        return { ok: false, message: "Herna je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(ARCADE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistArcadeState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistArcadeState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistArcadeState(key, snapshot);
      return { ok: true, message: `Herna vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistArcadeState(key, snapshot);
    return null;
  }

  function calculateAutoSalonHourlyRates(
    totalGangMembers,
    levelMultiplier,
    { cleanBoostPct = 0, dirtyBoostPct = 0, fleetCleanBonusPerHour = 0 } = {}
  ) {
    const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
    const baseCleanIncome =
      (AUTO_SALON_BUILDING_CONFIG.baseCleanIncomePerHour
        + memberSteps * AUTO_SALON_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
      * levelMultiplier;
    const baseDirtyIncome =
      (AUTO_SALON_BUILDING_CONFIG.baseDirtyIncomePerHour
        + memberSteps * AUTO_SALON_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
      * levelMultiplier;
    const currentCleanIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(cleanBoostPct || 0)) / 100);
    const currentDirtyIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(dirtyBoostPct || 0)) / 100);
    const hourlyCleanIncome =
      baseCleanIncome * currentCleanIncomeMultiplier + Math.max(0, Number(fleetCleanBonusPerHour || 0));
    const hourlyDirtyIncome = baseDirtyIncome * currentDirtyIncomeMultiplier;

    return {
      memberSteps,
      baseCleanIncome,
      baseDirtyIncome,
      currentCleanIncomeMultiplier,
      currentDirtyIncomeMultiplier,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function syncAutoSalonIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getAutoSalonLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const premiumOfferActive = nowMs < Number(stateRef.effects.premiumOfferUntil || 0);
    const grayImportActive = nowMs < Number(stateRef.effects.grayImportUntil || 0);
    const fleetActive = nowMs < Number(stateRef.effects.fleetUntil || 0);
    const cleanBoostPct = premiumOfferActive
      ? AUTO_SALON_BUILDING_CONFIG.actionBoosts.premiumOfferCleanIncomePct * levelMultiplier
      : 0;
    const dirtyBoostPct = grayImportActive
      ? AUTO_SALON_BUILDING_CONFIG.actionBoosts.grayImportDirtyIncomePct * levelMultiplier
      : 0;
    const fleetCleanBonusPerHour = fleetActive
      ? AUTO_SALON_BUILDING_CONFIG.actionBoosts.fleetCleanBonusPerHour * levelMultiplier
      : 0;

    const rates = calculateAutoSalonHourlyRates(totalGangMembers, levelMultiplier, {
      cleanBoostPct,
      dirtyBoostPct,
      fleetCleanBonusPerHour
    });

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    applyBuildingInfluenceTick(stateRef, nowMs, AUTO_SALON_BUILDING_CONFIG.baseInfluencePerHour);

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      premiumOfferActive,
      grayImportActive,
      fleetActive,
      cleanBoostPct,
      dirtyBoostPct,
      fleetCleanBonusPerHour,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      },
      districtIncomeBoostPct
    };
  }

  function resolveAutoSalonBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getAutoSalonStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncResult = syncAutoSalonIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistAutoSalonState(key, snapshot);

    const levelMultiplier = getAutoSalonLevelMultiplier(snapshot.level);
    const nextLevel = snapshot.level < AUTO_SALON_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? AUTO_SALON_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const fleetLogisticsPct = AUTO_SALON_BUILDING_CONFIG.actionBoosts.fleetLogisticsPct * levelMultiplier;
    const grayImportRaidRiskPct = AUTO_SALON_BUILDING_CONFIG.raidRiskPcts.grayImport * levelMultiplier;
    const rates = syncResult.rates || calculateAutoSalonHourlyRates(totalGangMembers, levelMultiplier);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;
    const hasLogisticsTargets = playerOwnsFleetLogisticsTargets();
    const activeLogisticsBoostPct = syncResult.fleetActive && hasLogisticsTargets ? fleetLogisticsPct : 0;
    const activeRaidRiskPct = syncResult.grayImportActive ? grayImportRaidRiskPct : 0;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    if (syncResult.premiumOfferActive) {
      effects.push(
        `Prémiová nabídka (+${formatDecimalValue(syncResult.cleanBoostPct, 2)}% clean income, ${formatDurationLabel(
          snapshot.effects.premiumOfferUntil - now
        )})`
      );
    }
    if (syncResult.grayImportActive) {
      effects.push(
        `Šedý dovoz (+${formatDecimalValue(syncResult.dirtyBoostPct, 2)}% dirty income, +${formatDecimalValue(
          grayImportRaidRiskPct,
          2
        )}% riziko razie, ${formatDurationLabel(snapshot.effects.grayImportUntil - now)})`
      );
    }
    if (syncResult.fleetActive) {
      const logisticsLabel = hasLogisticsTargets
        ? `Garage/Taxi služba/Pašovací tunel +${formatDecimalValue(fleetLogisticsPct, 2)}% efektivita`
        : "Logistický bonus se neaplikuje (nevlastníš Garage/Taxi služba/Pašovací tunel)";
      effects.push(
        `Rychlá flotila (+$${formatDecimalValue(syncResult.fleetCleanBonusPerHour, 2)} clean/h, ${logisticsLabel}, ${formatDurationLabel(
          snapshot.effects.fleetUntil - now
        )})`
      );
    }
    if (activeRaidRiskPct > 0) {
      effects.push(`Celkové riziko razie +${formatDecimalValue(activeRaidRiskPct, 2)}%`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyIncome,
      dailyIncome,
      info:
        "Autosalon je logisticko-ekonomická budova s čistým i dirty cashflow. Generuje silný legální příjem, stabilní dirty příjem a přes akce umí krátkodobě zesílit prodeje, šedý dovoz i mobilitu flotily. Upgrady škálují příjmy, sílu akcí i logistické bonusy.",
      specialActions: [
        "Prémiová nabídka: Cooldown 4h, trvá 2h, zvýší legální income autosalonu o +50 % (škáluje s levelem) a přidá +2 heat.",
        "Šedý dovoz: Cooldown 6h, trvá 2h, zvýší dirty income autosalonu o +80 % (škáluje s levelem), přidá +5 heat a na 2h zvýší riziko policejní razie v districtu o +10 % (škáluje s levelem).",
        "Rychlá flotila: Cooldown 5h, trvá 2h, přidá autosalonu +15 clean cash/h (škáluje s levelem), a pokud vlastníš Garage, Taxi služba nebo Pašovací tunel, zvýší jejich efektivitu o +20 % (škáluje s levelem); zároveň přidá +3 heat."
      ],
      mechanics: {
        type: "auto-salon",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: AUTO_SALON_BUILDING_CONFIG.baseHeatPerDay + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          premiumOffer: Math.max(0, Number(snapshot.cooldowns.premiumOffer || 0) - now),
          grayImport: Math.max(0, Number(snapshot.cooldowns.grayImport || 0) - now),
          fleet: Math.max(0, Number(snapshot.cooldowns.fleet || 0) - now)
        },
        fleetLogisticsPct,
        activeLogisticsBoostPct,
        hasLogisticsTargets,
        currentCleanIncomeMultiplier: rates.currentCleanIncomeMultiplier,
        currentDirtyIncomeMultiplier: rates.currentDirtyIncomeMultiplier,
        fleetCleanBonusPerHour: syncResult.fleetCleanBonusPerHour,
        activeRaidRiskPct,
        premiumOfferActive: syncResult.premiumOfferActive,
        grayImportActive: syncResult.grayImportActive,
        fleetActive: syncResult.fleetActive
      }
    };
  }

  function handleAutoSalonBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getAutoSalonStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncAutoSalonIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const levelMultiplier = getAutoSalonLevelMultiplier(snapshot.level);
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.premiumOffer);
      if (cooldownLeft > 0) {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: `Prémiová nabídka je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const cleanBoostPct = AUTO_SALON_BUILDING_CONFIG.actionBoosts.premiumOfferCleanIncomePct * levelMultiplier;
      snapshot.effects.premiumOfferUntil = now + AUTO_SALON_BUILDING_CONFIG.actionDurations.premiumOffer;
      snapshot.cooldowns.premiumOffer = now + AUTO_SALON_BUILDING_CONFIG.actionCooldowns.premiumOffer;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.premiumOffer;
      persistAutoSalonState(key, snapshot);
      return {
        ok: true,
        message: `Prémiová nabídka aktivní na 2h. Clean income autosalonu +${formatDecimalValue(cleanBoostPct, 2)}%, heat +${AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.premiumOffer}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.grayImport);
      if (cooldownLeft > 0) {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: `Šedý dovoz je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const dirtyBoostPct = AUTO_SALON_BUILDING_CONFIG.actionBoosts.grayImportDirtyIncomePct * levelMultiplier;
      const raidRiskPct = AUTO_SALON_BUILDING_CONFIG.raidRiskPcts.grayImport * levelMultiplier;
      snapshot.effects.grayImportUntil = now + AUTO_SALON_BUILDING_CONFIG.actionDurations.grayImport;
      snapshot.cooldowns.grayImport = now + AUTO_SALON_BUILDING_CONFIG.actionCooldowns.grayImport;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.grayImport;
      persistAutoSalonState(key, snapshot);
      return {
        ok: true,
        message: `Šedý dovoz aktivní na 2h. Dirty income +${formatDecimalValue(dirtyBoostPct, 2)}%, riziko razie +${formatDecimalValue(
          raidRiskPct,
          2
        )}%, heat +${AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.grayImport}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.fleet);
      if (cooldownLeft > 0) {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: `Rychlá flotila je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const fleetCleanBonus = AUTO_SALON_BUILDING_CONFIG.actionBoosts.fleetCleanBonusPerHour * levelMultiplier;
      const fleetLogisticsPct = AUTO_SALON_BUILDING_CONFIG.actionBoosts.fleetLogisticsPct * levelMultiplier;
      const hasTargets = playerOwnsFleetLogisticsTargets();
      snapshot.effects.fleetUntil = now + AUTO_SALON_BUILDING_CONFIG.actionDurations.fleet;
      snapshot.cooldowns.fleet = now + AUTO_SALON_BUILDING_CONFIG.actionCooldowns.fleet;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.fleet;
      persistAutoSalonState(key, snapshot);
      return {
        ok: true,
        message:
          `Rychlá flotila aktivní na 2h. Autosalon +$${formatDecimalValue(fleetCleanBonus, 2)} clean/h, `
          + `${hasTargets ? `Garage/Taxi služba/Pašovací tunel +${formatDecimalValue(fleetLogisticsPct, 2)}% efektivita, ` : "logistický bonus se neaplikuje (nevlastníš cílové budovy), "}`
          + `heat +${AUTO_SALON_BUILDING_CONFIG.actionHeatAdded.fleet}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > AUTO_SALON_BUILDING_CONFIG.maxLevel) {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: "Autosalon je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(AUTO_SALON_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistAutoSalonState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistAutoSalonState(key, snapshot);
      return { ok: true, message: `Autosalon vylepšen na level ${nextLevel} za $${cost}.` };
    }

    persistAutoSalonState(key, snapshot);
    return null;
  }

  function calculateExchangeHourlyRates(
    totalGangMembers,
    levelMultiplier,
    { cleanBoostPct = 0, cleanBonusPct = 0 } = {}
  ) {
    const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
    const baseCleanIncome =
      (EXCHANGE_BUILDING_CONFIG.baseCleanIncomePerHour
        + memberSteps * EXCHANGE_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
      * levelMultiplier
      * Math.max(0, 1 + Math.max(0, Number(cleanBonusPct || 0)) / 100);
    const baseDirtyIncome =
      (EXCHANGE_BUILDING_CONFIG.baseDirtyIncomePerHour
        + memberSteps * EXCHANGE_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
      * levelMultiplier;
    const currentCleanIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(cleanBoostPct || 0)) / 100);
    const hourlyCleanIncome = baseCleanIncome * currentCleanIncomeMultiplier;
    const hourlyDirtyIncome = baseDirtyIncome;

    return {
      memberSteps,
      baseCleanIncome,
      baseDirtyIncome,
      currentCleanIncomeMultiplier,
      currentDirtyIncomeMultiplier: 1,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function syncExchangeIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getExchangeLevelMultiplier(stateRef.level);
    const cleanBonusPct = stateRef.level >= 4 ? EXCHANGE_BUILDING_CONFIG.actionBoosts.cleanIncomeBonusPctLevel4 : 0;
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const rates = calculateExchangeHourlyRates(totalGangMembers, levelMultiplier, {
      cleanBoostPct: 0,
      cleanBonusPct
    });

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    const influencePerHour = Math.max(0, Number(EXCHANGE_BUILDING_CONFIG.baseInfluencePerDay || 0)) / 24;
    applyBuildingInfluenceTick(stateRef, nowMs, influencePerHour);

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      cleanBonusPct,
      districtIncomeBoostPct,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      }
    };
  }

  function resolveExchangeBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getExchangeStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncResult = syncExchangeIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistExchangeState(key, snapshot);

    const levelMultiplier = getExchangeLevelMultiplier(snapshot.level);
    const nextLevel = snapshot.level < EXCHANGE_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? EXCHANGE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const rates = syncResult.rates || calculateExchangeHourlyRates(totalGangMembers, levelMultiplier);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;
    const conversionBonusPct = snapshot.level >= 3 ? EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeBetterConversionPctLevel3 : 0;
    const heatReductionPct = snapshot.level >= 5 ? EXCHANGE_BUILDING_CONFIG.actionBoosts.heatReductionPctLevel5 : 0;
    const baseHeatPerDay = Math.max(0, Number(EXCHANGE_BUILDING_CONFIG.baseHeatPerDay || 0));
    const reducedBaseHeatPerDay = heatReductionPct > 0
      ? baseHeatPerDay * Math.max(0, 1 - heatReductionPct / 100)
      : baseHeatPerDay;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    if (conversionBonusPct > 0) effects.push(`L3 lepší konverze (+${formatDecimalValue(conversionBonusPct, 2)}%)`);
    if (syncResult.cleanBonusPct > 0) effects.push(`L4 bonus (+${formatDecimalValue(syncResult.cleanBonusPct, 2)}% clean income)`);
    if (heatReductionPct > 0) effects.push(`L5 menší heat (-${formatDecimalValue(heatReductionPct, 2)}%)`);
    if (syncResult.districtIncomeBoostPct > 0) {
      effects.push(`Celkový district income boost +${formatDecimalValue(syncResult.districtIncomeBoostPct, 2)}%`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyIncome,
      dailyIncome,
      info:
        "Peníze mění podobu. Hotovost, crypto i špinavé prachy projdou přes správné ruce. Směnárna drží stabilní clean/dirty příjem, vliv a rychlé finanční akce.",
      specialActions: [
        "Směna: Cooldown 6h, převede cash ↔ materiály, přidá +3 heat.",
        "Skrytý převod: Cooldown 8h, okamžitě přidá +15 % clean cash a přidá +4 heat.",
        "Rychlá likvidita: Cooldown 10h, okamžitě přidá +5000 clean cash a přidá +5 heat."
      ],
      mechanics: {
        type: "exchange",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: reducedBaseHeatPerDay + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          exchange: Math.max(0, Number(snapshot.cooldowns.exchange || 0) - now),
          hiddenTransfer: Math.max(0, Number(snapshot.cooldowns.hiddenTransfer || 0) - now),
          quickLiquidity: Math.max(0, Number(snapshot.cooldowns.quickLiquidity || 0) - now)
        },
        conversionBonusPct,
        heatReductionPct,
        currentCleanIncomeMultiplier: rates.currentCleanIncomeMultiplier,
        currentDirtyIncomeMultiplier: rates.currentDirtyIncomeMultiplier,
        districtIncomeBoostPct: syncResult.districtIncomeBoostPct
      }
    };
  }

  function handleExchangeBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getExchangeStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncExchangeIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.exchange);
      if (cooldownLeft > 0) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: `Směna je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const conversionBonusMultiplier = snapshot.level >= 3
        ? 1 + (Math.max(0, Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeBetterConversionPctLevel3 || 0)) / 100)
        : 1;
      const cashCostBase = Math.max(0, Math.floor(Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeCashCost || 0)));
      const materialsGainBase = Math.max(0, Math.floor(Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeMaterialsGain || 0)));
      const materialsCost = Math.max(0, Math.floor(Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeMaterialsCost || 0)));
      const cashGainBase = Math.max(0, Math.floor(Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.exchangeCashGain || 0)));
      const cashCost = Math.max(1, Math.floor(cashCostBase / conversionBonusMultiplier));
      const materialsGain = Math.max(1, Math.floor(materialsGainBase * conversionBonusMultiplier));
      const cashGain = Math.max(1, Math.floor(cashGainBase * conversionBonusMultiplier));
      const spendClean = window.Empire.UI?.trySpendCleanCash;
      const addMaterials = window.Empire.UI?.addMaterials;
      const spendMaterials = window.Empire.UI?.trySpendMaterials;
      const addClean = window.Empire.UI?.addCleanCash;
      let convertedLabel = "";

      if (typeof spendClean === "function" && typeof addMaterials === "function") {
        const spendResult = spendClean(cashCost);
        if (spendResult?.ok) {
          addMaterials(materialsGain);
          convertedLabel = `cash -> materiály ($${cashCost} -> ${materialsGain} MAT)`;
        }
      }
      if (!convertedLabel && typeof spendMaterials === "function" && typeof addClean === "function") {
        const spendResult = spendMaterials(materialsCost);
        if (spendResult?.ok) {
          addClean(cashGain);
          convertedLabel = `materiály -> cash (${materialsCost} MAT -> $${cashGain})`;
        }
      }
      if (!convertedLabel) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: "Směna selhala: nedostatek cash i materiálů pro konverzi." };
      }
      snapshot.cooldowns.exchange = now + EXCHANGE_BUILDING_CONFIG.actionCooldowns.exchange;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + EXCHANGE_BUILDING_CONFIG.actionHeatAdded.exchange;
      persistExchangeState(key, snapshot);
      return {
        ok: true,
        message: `Směna provedena (${convertedLabel}). Heat +${EXCHANGE_BUILDING_CONFIG.actionHeatAdded.exchange}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.hiddenTransfer);
      if (cooldownLeft > 0) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: `Skrytý převod je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const currentCleanCash = Math.max(0, Math.floor(Number(window.Empire.UI?.getEconomySnapshot?.()?.cleanMoney || 0)));
      const gainPct = Math.max(0, Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.hiddenTransferCleanCashPct || 0));
      const gainAmount = Math.max(0, Math.floor(currentCleanCash * (gainPct / 100)));
      if (gainAmount > 0) {
        window.Empire.UI?.addCleanCash?.(gainAmount);
      }
      snapshot.cooldowns.hiddenTransfer = now + EXCHANGE_BUILDING_CONFIG.actionCooldowns.hiddenTransfer;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + EXCHANGE_BUILDING_CONFIG.actionHeatAdded.hiddenTransfer;
      persistExchangeState(key, snapshot);
      return {
        ok: true,
        message: `Skrytý převod: +$${gainAmount} clean cash (${formatDecimalValue(gainPct, 2)}%). Heat +${EXCHANGE_BUILDING_CONFIG.actionHeatAdded.hiddenTransfer}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.quickLiquidity);
      if (cooldownLeft > 0) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: `Rychlá likvidita je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const quickCash = Math.max(0, Math.floor(Number(EXCHANGE_BUILDING_CONFIG.actionBoosts.quickLiquidityCleanCash || 0)));
      if (quickCash > 0) {
        window.Empire.UI?.addCleanCash?.(quickCash);
      }
      snapshot.cooldowns.quickLiquidity = now + EXCHANGE_BUILDING_CONFIG.actionCooldowns.quickLiquidity;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + EXCHANGE_BUILDING_CONFIG.actionHeatAdded.quickLiquidity;
      persistExchangeState(key, snapshot);
      return {
        ok: true,
        message: `Rychlá likvidita: +$${quickCash} clean cash. Heat +${EXCHANGE_BUILDING_CONFIG.actionHeatAdded.quickLiquidity}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > EXCHANGE_BUILDING_CONFIG.maxLevel) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: "Směnárna je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(EXCHANGE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistExchangeState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistExchangeState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistExchangeState(key, snapshot);
      return { ok: true, message: `Směnárna vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistExchangeState(key, snapshot);
    return null;
  }

  function calculateRestaurantHourlyRates(
    totalGangMembers,
    levelMultiplier,
    { cleanBoostPct = 0 } = {}
  ) {
    const memberSteps = Math.max(0, Math.floor(Math.max(0, Number(totalGangMembers || 0)) / 10));
    const baseCleanIncome =
      (RESTAURANT_BUILDING_CONFIG.baseCleanIncomePerHour
        + memberSteps * RESTAURANT_BUILDING_CONFIG.cleanIncomePerTenMembersPerHour)
      * levelMultiplier;
    const baseDirtyIncome =
      (RESTAURANT_BUILDING_CONFIG.baseDirtyIncomePerHour
        + memberSteps * RESTAURANT_BUILDING_CONFIG.dirtyIncomePerTenMembersPerHour)
      * levelMultiplier;
    const currentCleanIncomeMultiplier = Math.max(0, 1 + Math.max(0, Number(cleanBoostPct || 0)) / 100);
    const hourlyCleanIncome = baseCleanIncome * currentCleanIncomeMultiplier;
    const hourlyDirtyIncome = baseDirtyIncome;

    return {
      memberSteps,
      baseCleanIncome,
      baseDirtyIncome,
      currentCleanIncomeMultiplier,
      currentDirtyIncomeMultiplier: 1,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function applyGossipTemplateContext(template, context = {}) {
    const districtLabel = String(context?.districtLabel || "?");
    const ownerLabel = String(context?.ownerLabel || "Neznámý");
    const districtType = String(context?.districtType || "district");
    return String(template || "")
      .replaceAll("{district}", districtLabel)
      .replaceAll("{owner}", ownerLabel)
      .replaceAll("{type}", districtType);
  }

  function pickGossipTemplate(templates, context = {}) {
    if (!Array.isArray(templates) || !templates.length) return "";
    const index = Math.max(0, Math.floor(Math.random() * templates.length)) % templates.length;
    const picked = templates[index];
    if (typeof picked === "function") {
      return String(picked(String(context?.districtLabel || "?")));
    }
    return applyGossipTemplateContext(picked, context);
  }

  function buildDistrictGossipText(targetDistrict, spec = {}) {
    const districtLabel = resolveDistrictNumberLabel(targetDistrict);
    const category = String(spec?.category || "").trim().toLowerCase();
    const truthState = String(spec?.truthState || "").trim().toLowerCase();
    const quality = String(spec?.quality || "").trim().toLowerCase();
    const districtType = String(targetDistrict?.type || "").trim().toLowerCase() || "district";
    const districtIncome = Math.max(0, Math.floor(Number(targetDistrict?.income || 0)));
    const districtBuildings = Array.isArray(targetDistrict?.buildings) ? targetDistrict.buildings : [];
    const hasDrugLab = districtBuildings.some((building) => String(building || "").trim().toLowerCase() === "drug lab");
    const hasFactory = districtBuildings.some((building) => String(building || "").trim().toLowerCase() === "továrna");
    const hasArmory = districtBuildings.some((building) => String(building || "").trim().toLowerCase() === "zbrojovka");
    const defenseSnapshot = window.Empire.UI?.getDistrictDefenseSnapshot?.(targetDistrict?.id) || null;
    const defensePower = Math.max(
      0,
      Math.floor(Number(defenseSnapshot?.self?.power ?? defenseSnapshot?.ally?.power ?? 0))
    );
    const lowDefense = defensePower > 0 && defensePower <= 30;
    const highHeat = Math.max(0, Number(targetDistrict?.heat || 0)) >= 10;
    const ownerLabel = String(targetDistrict?.ownerNick || targetDistrict?.owner || "").trim() || `District ${districtLabel}`;

    const categoryKey = Object.prototype.hasOwnProperty.call(DISTRICT_GOSSIP_TEXT_LIBRARY.common, category)
      ? category
      : "special";
    const tierKey = quality === "rare" || spec?.rare || truthState === "true"
      ? "rare"
      : quality === "quality" || truthState === "partial"
        ? "quality"
        : "common";
    const tierPool = DISTRICT_GOSSIP_TEXT_LIBRARY[tierKey] || DISTRICT_GOSSIP_TEXT_LIBRARY.common;
    const baseText = pickGossipTemplate(tierPool[categoryKey], {
      districtLabel,
      ownerLabel,
      districtType
    });
    if (categoryKey === "defense" && lowDefense) {
      return `Potvrzený intel: District ${districtLabel} má low defense a obrana je momentálně slabá.`;
    }
    if (categoryKey === "heat" && highHeat) {
      return `Potvrzený intel: District ${districtLabel} má vysoký heat a policejní zájem.`;
    }
    if (categoryKey === "production") {
      if (hasDrugLab) return `Potvrzený intel: District ${districtLabel} produkuje drogy přes vlastní infrastrukturu.`;
      if (hasFactory) return `Potvrzený intel: District ${districtLabel} jede na výrobních linkách naplno.`;
      if (hasArmory) return `Potvrzený intel: District ${districtLabel} drží zbrojní výrobu v chodu.`;
    }
    if (categoryKey === "economy" && districtIncome > 0) {
      return `Potvrzený intel: District ${districtLabel} generuje zhruba $${districtIncome}/hod.`;
    }
    if (categoryKey === "attack") {
      return pickGossipTemplate([
        (label) => `Hráč v districtu ${label} plánuje útok.`,
        (label) => `Hráč v districtu ${label} právě přesouvá síly.`,
        (label) => `Hráč v districtu ${label} je po akci oslabený.`
      ], { districtLabel });
    }
    if (categoryKey === "special" && spec?.truthState === "false") {
      return pickGossipTemplate([
        (label) => `Falešný drb: District ${label} má skrytou slabinu.`,
        (label) => `Falešný drb: District ${label} je téměř bez obrany.`,
        (label) => `Falešný drb: District ${label} je připravený k pádu.`
      ], { districtLabel });
    }
    return baseText || pickGossipTemplate(DISTRICT_GOSSIP_TEXT_LIBRARY.common.special, { districtLabel, ownerLabel, districtType });
  }

  function generateRestaurantDistrictGossips(
    sourceDistrict,
    rumorCount,
    now = Date.now(),
    sourceBuildingName = RESTAURANT_BUILDING_NAME,
    {
      targetDistrict = null,
      rareChancePct = 30,
      accuracyMultiplier = 1,
      weaknessRevealChancePct = 0
    } = {}
  ) {
    const safeCount = Math.max(0, Math.floor(Number(rumorCount) || 0));
    if (safeCount <= 0) return [];
    const districts = Array.isArray(state.districts) ? state.districts.filter(Boolean) : [];
    if (!districts.length) return [];

    const sourceId = sourceDistrict && typeof sourceDistrict === "object"
      ? sourceDistrict.id
      : sourceDistrict ?? null;
    const explicitTarget = resolveDistrictRecord(targetDistrict);
    const candidateDistricts = explicitTarget
      ? [explicitTarget]
      : districts.filter((district) => String(district?.id) !== String(sourceId));
    const pool = candidateDistricts.length ? candidateDistricts : districts;
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    const created = [];
    const safeRareChancePct = Math.max(0, Math.min(100, Number(rareChancePct) || 0));
    const safeWeaknessChancePct = Math.max(0, Math.min(100, Number(weaknessRevealChancePct) || 0));
    const safeAccuracyMultiplier = Math.max(0.5, Math.min(2, Number(accuracyMultiplier) || 1));
    for (let i = 0; i < safeCount; i += 1) {
      const district = shuffled[i % shuffled.length];
      if (!district) continue;
      const qualityRoll = Math.random() * 100;
      const forcedRare = qualityRoll < safeRareChancePct;
      const tierRoll = Math.random() * 100;
      const qualityKey = forcedRare || tierRoll >= 95 ? "rare" : tierRoll >= 70 ? "quality" : "common";
      const qualityPreset = getGossipQualityPreset(qualityKey);
      const accuracyMin = Math.max(0, Math.floor(qualityPreset.accuracyMin * safeAccuracyMultiplier));
      const accuracyMax = Math.max(accuracyMin, Math.floor(qualityPreset.accuracyMax * safeAccuracyMultiplier));
      const weaknessRoll = Math.random() * 100;
      const rare = qualityKey === "rare" || weaknessRoll < safeRareChancePct;
      const chosenCategory = (() => {
        const categories = ["economy", "defense", "attack", "production", "heat", "special"];
        if (rare && Math.random() < 0.5) return "special";
        if (qualityKey === "rare") return categories[Math.floor(Math.random() * categories.length)];
        const weights = rare
          ? [2, 2, 2, 2, 2, 4]
          : [3, 3, 2, 2, 2, 2];
        const total = weights.reduce((sum, value) => sum + value, 0);
        let cursor = Math.random() * total;
        for (let index = 0; index < categories.length; index += 1) {
          cursor -= weights[index];
          if (cursor <= 0) return categories[index];
        }
        return "special";
      })();
      const weakness = chosenCategory === "special" && weaknessRoll < safeWeaknessChancePct;
      const rawAccuracy = Math.max(60, Math.min(100, Math.floor(accuracyMin + Math.random() * (accuracyMax - accuracyMin + 1))));
      const truthState = rawAccuracy >= 90 ? "true" : rawAccuracy >= 75 ? "partial" : "false";
      const text = buildDistrictGossipText(district, {
        category: chosenCategory,
        truthState,
        quality: qualityKey,
        rare
      });
      const intelLevel = truthState === "true" || rare ? "verified" : "rumor";
      const intelType = weakness ? "restaurant_weakness" : rare ? "restaurant_rare" : `restaurant_${chosenCategory}`;
      const entry = appendDistrictGossip(district, text, {
        createdAt: now + i,
        sourceBuilding: String(sourceBuildingName || RESTAURANT_BUILDING_NAME),
        sourceDistrictId: sourceId,
        intelLevel,
        intelType,
        gossipQuality: qualityKey,
        gossipCategory: chosenCategory,
        accuracyPct: rawAccuracy,
        truthState
      });
      if (entry) {
        created.push({
          ...entry,
          districtId: district.id,
          districtName: district.name || `Distrikt #${resolveDistrictNumberLabel(district)}`
        });
      }
    }
    return created;
  }

  function generateConvenienceStoreLocalGossip(sourceDistrict, now = Date.now()) {
    const districts = Array.isArray(state.districts) ? state.districts.filter(Boolean) : [];
    if (!districts.length) return null;
    const sourceRecord = resolveDistrictRecord(sourceDistrict);
    const sourceId = sourceRecord?.id ?? (sourceDistrict && typeof sourceDistrict === "object" ? sourceDistrict.id : sourceDistrict);
    const preferredSource = sourceRecord && Math.random() < 0.5 ? sourceRecord : null;

    let targetDistrict = preferredSource;
    if (!targetDistrict) {
      const pool = sourceRecord && districts.length > 1
        ? districts.filter((district) => String(district?.id) !== String(sourceRecord.id))
        : districts;
      const pickPool = pool.length ? pool : districts;
      targetDistrict = pickPool[Math.floor(Math.random() * pickPool.length)] || sourceRecord || districts[0] || null;
    }
    if (!targetDistrict) return null;

    const text = buildDistrictGossipText(targetDistrict);
    const entry = appendDistrictGossip(targetDistrict, text, {
      createdAt: now,
      sourceBuilding: CONVENIENCE_STORE_BUILDING_NAME,
      sourceDistrictId: sourceId ?? null
    });
    if (!entry) return null;
    return {
      ...entry,
      districtId: targetDistrict.id,
      districtName: targetDistrict.name || `Distrikt #${resolveDistrictNumberLabel(targetDistrict)}`
    };
  }

  function syncRestaurantIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelMultiplier = getRestaurantLevelMultiplier(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const vipReservationActive = nowMs < Number(stateRef.effects.vipReservationUntil || 0);
    const vipReservationCleanBoostPct = vipReservationActive
      ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationCleanIncomePct || 0))
      : 0;
    const vipReservationInfluenceBoostPct = vipReservationActive
      ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationInfluencePct || 0))
      : 0;
    const rates = calculateRestaurantHourlyRates(totalGangMembers, levelMultiplier, {
      cleanBoostPct: vipReservationCleanBoostPct
    });

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    const baseInfluencePerHour = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.baseInfluencePerDay || 0)) / 24;
    const currentInfluencePerHour = baseInfluencePerHour
      * Math.max(1, levelMultiplier)
      * (1 + Math.max(0, vipReservationInfluenceBoostPct) / 100);
    applyBuildingInfluenceTick(stateRef, nowMs, currentInfluencePerHour);

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      vipReservationActive,
      vipReservationCleanBoostPct,
      vipReservationInfluenceBoostPct,
      currentInfluencePerHour,
      districtIncomeBoostPct,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      }
    };
  }

  function resolveRestaurantBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getRestaurantStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    const syncResult = syncRestaurantIncome(snapshot, totalGangMembers, now, district || context?.districtId);
    persistRestaurantState(key, snapshot);

    const levelMultiplier = getRestaurantLevelMultiplier(snapshot.level);
    const nextLevel = snapshot.level < RESTAURANT_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? RESTAURANT_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const dinnerDistrictIncomeBoostPct = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.gangDinnerDistrictIncomePct || 0));
    const vipCleanBoostPct = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationCleanIncomePct || 0));
    const vipInfluenceBoostPct = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationInfluencePct || 0));
    const rareChancePct =
      Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.streetGossipRareChancePct || 0))
      + (snapshot.level >= 3 ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level3RareChanceBonusPct || 0)) : 0);
    const accuracyBonusPct = snapshot.level >= 3
      ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level3AccuracyBonusPct || 0))
      : 0;
    const extraGossipCount = snapshot.level >= 5 ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level5ExtraGossipCount || 0)) : 0;
    const weaknessRevealChancePct = snapshot.level >= 5
      ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level5WeaknessRevealChancePct || 0))
      : 0;
    const heatReductionPct = snapshot.level >= 4
      ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level4HeatReductionPct || 0))
      : 0;
    const rates = syncResult.rates || calculateRestaurantHourlyRates(totalGangMembers, levelMultiplier);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;
    const dinnerDistrictLabel = resolveDistrictNumberLabel(resolveDistrictRecord(snapshot.effects.gangDinnerDistrictPart));
    const baseHeatPerDay = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.baseHeatPerDay || 0));
    const reducedHeatPerDay = heatReductionPct > 0
      ? baseHeatPerDay * Math.max(0, 1 - heatReductionPct / 100)
      : baseHeatPerDay;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    effects.push(`Vliv +${formatDecimalValue(syncResult.currentInfluencePerHour, 2)} / h`);
    if (now < Number(snapshot.effects.gangDinnerUntil || 0)) {
      effects.push(
        `Večeře pro gang (district #${dinnerDistrictLabel}, +${formatDecimalValue(dinnerDistrictIncomeBoostPct, 2)}% income, ${formatDurationLabel(
          snapshot.effects.gangDinnerUntil - now
        )})`
      );
    }
    if (syncResult.vipReservationActive) {
      effects.push(
        `VIP rezervace (+${formatDecimalValue(syncResult.vipReservationCleanBoostPct, 2)}% clean income, +${formatDecimalValue(
          syncResult.vipReservationInfluenceBoostPct,
          2
        )}% vliv, ${formatDurationLabel(snapshot.effects.vipReservationUntil - now)})`
      );
    }
    if (syncResult.districtIncomeBoostPct > 0) {
      effects.push(`Celkový district income boost +${formatDecimalValue(syncResult.districtIncomeBoostPct, 2)}%`);
    }
    if (accuracyBonusPct > 0) effects.push(`L3 přesnost drbů +${formatDecimalValue(accuracyBonusPct, 2)}%`);
    if (heatReductionPct > 0) effects.push(`L4 menší heat -${formatDecimalValue(heatReductionPct, 2)}%`);
    if (extraGossipCount > 0) effects.push(`L5 extra drb +${Math.floor(extraGossipCount)}`);
    if (weaknessRevealChancePct > 0) effects.push(`L5 šance odhalit slabinu +${formatDecimalValue(weaknessRevealChancePct, 2)}%`);

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyIncome,
      dailyIncome,
      info:
        "Jídlo, alkohol, kontakty. Tady se řeší kšefty a rodí drby. Restaurace je safe sociální budova se stabilním clean/dirty cashflow, menším vlivem a cílenými district akcemi.",
      specialActions: [
        "Večeře pro gang: Cooldown 8h, vybereš vlastní district a na 2h zvýší income všech budov v tomto districtu o +15 %, +4 heat.",
        "VIP rezervace: Cooldown 8h, na 2h dá restauraci +30 % clean income a +5 % vliv, +5 heat.",
        "Drby z ulice: Cooldown 6h, vybereš district a získáš 1-2 drby (L5 +1 extra), 30% šance na vzácný drb (L3 vyšší), +3 heat."
      ],
      mechanics: {
        type: "restaurant",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: reducedHeatPerDay + Math.max(0, Number(snapshot.extraHeat || 0)),
        effectsLabel: effects.join(" • "),
        cooldowns: {
          gangDinner: Math.max(0, Number(snapshot.cooldowns.gangDinner || 0) - now),
          vipReservation: Math.max(0, Number(snapshot.cooldowns.vipReservation || 0) - now),
          streetGossip: Math.max(0, Number(snapshot.cooldowns.streetGossip || 0) - now)
        },
        dinnerDistrictIncomeBoostPct,
        vipCleanBoostPct,
        vipInfluenceBoostPct,
        rareChancePct,
        accuracyBonusPct,
        extraGossipCount,
        weaknessRevealChancePct,
        heatReductionPct,
        currentCleanIncomeMultiplier: rates.currentCleanIncomeMultiplier,
        currentDirtyIncomeMultiplier: rates.currentDirtyIncomeMultiplier,
        currentInfluencePerHour: syncResult.currentInfluencePerHour,
        districtIncomeBoostPct: syncResult.districtIncomeBoostPct,
        vipReservationActive: syncResult.vipReservationActive
      }
    };
  }

  function handleRestaurantBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getRestaurantStateByKey(key, now);
    const totalGangMembers = Number(window.Empire.UI?.getCurrentGangMembers?.() || 0);
    syncRestaurantIncome(snapshot, totalGangMembers, now, district || context?.districtId);

    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.gangDinner);
      if (cooldownLeft > 0) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `Večeře pro gang je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const rawDistrictId = window.prompt("Zadej číslo vlastního districtu pro Večeři pro gang:");
      if (rawDistrictId == null) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: "Večeře pro gang zrušena." };
      }
      const districtId = String(rawDistrictId || "").trim();
      const targetDistrict = resolveDistrictRecord(districtId);
      if (!targetDistrict) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `District ${districtId || "?"} nebyl nalezen.` };
      }
      if (!isDistrictOwnedByPlayer(targetDistrict)) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `District #${resolveDistrictNumberLabel(targetDistrict)} není tvůj.` };
      }
      snapshot.effects.gangDinnerUntil = now + RESTAURANT_BUILDING_CONFIG.actionDurations.gangDinner;
      snapshot.effects.gangDinnerDistrictPart = resolveDistrictIdentityPart(targetDistrict);
      snapshot.cooldowns.gangDinner = now + RESTAURANT_BUILDING_CONFIG.actionCooldowns.gangDinner;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + RESTAURANT_BUILDING_CONFIG.actionHeatAdded.gangDinner;
      persistRestaurantState(key, snapshot);
      return {
        ok: true,
        message:
          `Večeře pro gang aktivní v districtu #${resolveDistrictNumberLabel(targetDistrict)} na 2h. `
          + `Income všech tvých budov v cíli +${RESTAURANT_BUILDING_CONFIG.actionBoosts.gangDinnerDistrictIncomePct}%, `
          + `heat +${RESTAURANT_BUILDING_CONFIG.actionHeatAdded.gangDinner}.`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.vipReservation);
      if (cooldownLeft > 0) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `VIP rezervace je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.vipReservationUntil = now + RESTAURANT_BUILDING_CONFIG.actionDurations.vipReservation;
      snapshot.cooldowns.vipReservation = now + RESTAURANT_BUILDING_CONFIG.actionCooldowns.vipReservation;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + RESTAURANT_BUILDING_CONFIG.actionHeatAdded.vipReservation;
      persistRestaurantState(key, snapshot);
      return {
        ok: true,
        message:
          `VIP rezervace aktivní na 2h. Clean income restaurace +${RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationCleanIncomePct}%, `
          + `vliv +${RESTAURANT_BUILDING_CONFIG.actionBoosts.vipReservationInfluencePct}%, `
          + `heat +${RESTAURANT_BUILDING_CONFIG.actionHeatAdded.vipReservation}.`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.streetGossip);
      if (cooldownLeft > 0) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `Drby z ulice jsou na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      const rawDistrictId = window.prompt("Zadej číslo districtu, o kterém chceš drby:");
      if (rawDistrictId == null) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: "Drby z ulice zrušeny." };
      }
      const districtId = String(rawDistrictId || "").trim();
      const targetDistrict = resolveDistrictRecord(districtId);
      if (!targetDistrict) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `District ${districtId || "?"} nebyl nalezen.` };
      }
      const baseRumorCount = 1 + Math.floor(Math.random() * 2);
      const extraRumorCount = snapshot.level >= 5 ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level5ExtraGossipCount || 0)) : 0;
      const rumorCount = Math.max(1, Math.floor(baseRumorCount + extraRumorCount));
      const rareChancePct =
        Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.streetGossipRareChancePct || 0))
        + (snapshot.level >= 3 ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level3RareChanceBonusPct || 0)) : 0);
      const accuracyMultiplier = 1 + (
        snapshot.level >= 3
          ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level3AccuracyBonusPct || 0)) / 100
          : 0
      );
      const weaknessRevealChancePct = snapshot.level >= 5
        ? Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.actionBoosts.level5WeaknessRevealChancePct || 0))
        : 0;
      const rumors = generateRestaurantDistrictGossips(
        district || context?.districtId || null,
        rumorCount,
        now,
        RESTAURANT_BUILDING_NAME,
        {
          targetDistrict,
          rareChancePct,
          accuracyMultiplier,
          weaknessRevealChancePct
        }
      );
      snapshot.cooldowns.streetGossip = now + RESTAURANT_BUILDING_CONFIG.actionCooldowns.streetGossip;
      snapshot.extraHeat = Math.max(0, Number(snapshot.extraHeat || 0))
        + RESTAURANT_BUILDING_CONFIG.actionHeatAdded.streetGossip;
      persistRestaurantState(key, snapshot);

      const pushEvent = window.Empire.UI?.pushEvent;
      if (typeof pushEvent === "function") {
        rumors.forEach((rumor) => {
          pushEvent(`Drb: ${rumor.text}`);
        });
      }
      refreshOpenDistrictGossipSection();
      return {
        ok: true,
        message: rumors.length
          ? `Drby z ulice: district #${resolveDistrictNumberLabel(targetDistrict)} → získal jsi ${rumors.length} drby. Heat +${RESTAURANT_BUILDING_CONFIG.actionHeatAdded.streetGossip}.`
          : `Drby z ulice: pro district #${resolveDistrictNumberLabel(targetDistrict)} se nepodařilo získat žádný drb.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > RESTAURANT_BUILDING_CONFIG.maxLevel) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: "Restaurace je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(RESTAURANT_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistRestaurantState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistRestaurantState(key, snapshot);
      return { ok: true, message: `Restaurace vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistRestaurantState(key, snapshot);
    return null;
  }

  function calculateConvenienceStoreHourlyRates(
    levelEffects,
    {
      nightSaleIncomeBoostPct = 0
    } = {}
  ) {
    const baseCleanIncome = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.baseCleanIncomePerHour || 0));
    const baseDirtyIncome = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.baseDirtyIncomePerHour || 0));
    const totalIncomeBoostPct =
      Math.max(0, Number(levelEffects?.incomeBoostPct || 0))
      + Math.max(0, Number(nightSaleIncomeBoostPct || 0));
    const currentCleanIncomeMultiplier =
      Math.max(0, 1 + totalIncomeBoostPct / 100)
      * Math.max(0, 1 + Math.max(0, Number(levelEffects?.cleanIncomeBoostPct || 0)) / 100);
    const currentDirtyIncomeMultiplier = Math.max(0, 1 + totalIncomeBoostPct / 100);
    const hourlyCleanIncome = baseCleanIncome * currentCleanIncomeMultiplier;
    const hourlyDirtyIncome = baseDirtyIncome * currentDirtyIncomeMultiplier;

    return {
      baseCleanIncome,
      baseDirtyIncome,
      currentCleanIncomeMultiplier,
      currentDirtyIncomeMultiplier,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyTotalIncome: hourlyCleanIncome + hourlyDirtyIncome
    };
  }

  function syncConvenienceStoreIncome(instanceState, totalGangMembers, now = Date.now(), districtOrId = null) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const levelEffects = getConvenienceStoreLevelEffects(stateRef.level);
    const districtIncomeBoostPct = getDistrictCashIncomeBoostPct(districtOrId, nowMs);
    const districtIncomeMultiplier = Math.max(0, 1 + districtIncomeBoostPct / 100);
    const nightSaleActive = nowMs < Number(stateRef.effects.nightSaleUntil || 0);
    const coverOpsActive = nowMs < Number(stateRef.effects.coverOpsUntil || 0);
    const actionBoostMultiplier = Math.max(1, 1 + getOwnedWarehouseActionEffectBoostPct(nowMs) / 100);
    const nightSaleIncomeBoostPct = nightSaleActive
      ? CONVENIENCE_STORE_BUILDING_CONFIG.actionBoosts.nightSaleIncomePct * actionBoostMultiplier
      : 0;
    const rates = calculateConvenienceStoreHourlyRates(levelEffects, {
      nightSaleIncomeBoostPct
    });

    let incomeFrom = Number(stateRef.lastIncomeAt || nowMs);
    if (!Number.isFinite(incomeFrom) || incomeFrom > nowMs) {
      incomeFrom = nowMs;
    }

    let cleanIncomeGained = 0;
    let dirtyIncomeGained = 0;
    if (incomeFrom < nowMs) {
      const hoursElapsed = (nowMs - incomeFrom) / 3600000;
      const cleanRaw =
        hoursElapsed * (rates.hourlyCleanIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderClean || 0);
      const dirtyRaw =
        hoursElapsed * (rates.hourlyDirtyIncome * districtIncomeMultiplier) + Number(stateRef.incomeRemainderDirty || 0);
      cleanIncomeGained = Math.max(0, Math.floor(cleanRaw));
      dirtyIncomeGained = Math.max(0, Math.floor(dirtyRaw));
      stateRef.incomeRemainderClean = Math.max(0, cleanRaw - cleanIncomeGained);
      stateRef.incomeRemainderDirty = Math.max(0, dirtyRaw - dirtyIncomeGained);
    }
    stateRef.lastIncomeAt = nowMs;

    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    if (cleanIncomeGained > 0 && typeof addClean === "function") {
      addClean(cleanIncomeGained);
    }
    if (dirtyIncomeGained > 0) {
      if (typeof addDirty === "function") {
        addDirty(dirtyIncomeGained);
      } else if (typeof addClean === "function") {
        addClean(dirtyIncomeGained);
      }
    }

    const currentInfluencePerHour = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.baseInfluencePerDay || 0)) / 24;
    applyBuildingInfluenceTick(stateRef, nowMs, currentInfluencePerHour);

    return {
      cleanIncomeGained,
      dirtyIncomeGained,
      levelEffects,
      nightSaleActive,
      coverOpsActive,
      nightSaleIncomeBoostPct,
      currentInfluencePerHour,
      districtIncomeBoostPct,
      rates: {
        ...rates,
        hourlyCleanIncome: rates.hourlyCleanIncome * districtIncomeMultiplier,
        hourlyDirtyIncome: rates.hourlyDirtyIncome * districtIncomeMultiplier,
        hourlyTotalIncome: (rates.hourlyCleanIncome + rates.hourlyDirtyIncome) * districtIncomeMultiplier
      }
    };
  }

  function resolveConvenienceStoreBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getConvenienceStoreStateByKey(key, now);
    const syncResult = syncConvenienceStoreIncome(snapshot, 0, now, district || context?.districtId);
    persistConvenienceStoreState(key, snapshot);

    const levelEffects = getConvenienceStoreLevelEffects(snapshot.level);
    const nextLevel = snapshot.level < CONVENIENCE_STORE_BUILDING_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? CONVENIENCE_STORE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0 : 0;
    const rates = syncResult.rates || calculateConvenienceStoreHourlyRates(levelEffects);
    const hourlyIncome = rates.hourlyTotalIncome;
    const dailyIncome = hourlyIncome * 24;

    const effects = [
      `Income C:$${formatDecimalValue(rates.hourlyCleanIncome, 2)} / D:$${formatDecimalValue(rates.hourlyDirtyIncome, 2)}`
    ];
    effects.push(`Vliv +${formatDecimalValue(syncResult.currentInfluencePerHour, 2)} / h`);
    if (syncResult.nightSaleActive) {
      effects.push(
        `Noční prodej (+${formatDecimalValue(syncResult.nightSaleIncomeBoostPct, 2)}% income, ${formatDurationLabel(snapshot.effects.nightSaleUntil - now)})`
      );
    }
    if (syncResult.coverOpsActive) {
      effects.push(`Krytí operací aktivní (${formatDurationLabel(snapshot.effects.coverOpsUntil - now)})`);
    }
    if (snapshot.level >= 2) effects.push(`Upgrade income +${CONVENIENCE_STORE_BUILDING_CONFIG.incomeBoostPctLevel2}%`);
    if (snapshot.level >= 3) effects.push(`Upgrade clean +${CONVENIENCE_STORE_BUILDING_CONFIG.cleanIncomeBoostPctLevel3}%`);
    if (snapshot.level >= 4) effects.push(`Upgrade income +${CONVENIENCE_STORE_BUILDING_CONFIG.incomeBoostPctLevel4}%`);
    if (snapshot.level >= 5) effects.push(`Upgrade heat -${formatDecimalValue((1 - CONVENIENCE_STORE_BUILDING_CONFIG.heatMultiplierLevel5) * 100, 2)}%`);
    if (syncResult.districtIncomeBoostPct > 0) {
      effects.push(`Celkový district income boost +${formatDecimalValue(syncResult.districtIncomeBoostPct, 2)}%`);
    }

    return {
      ...fallback,
      baseName: context.baseName,
      displayName: context.variantName || context.baseName,
      hourlyIncome,
      dailyIncome,
      info:
        "Malý obchod, co nikdy nezavírá. Přes den normální kšeft, v noci úplně jiný byznys.",
      specialActions: [
        "Noční prodej: +25% income na 4h • heat +3 • cooldown 6h.",
        "Malý deal: +10 ks Neon Dust • heat +4 • cooldown 7h.",
        "Krytí operací: snížení heat jiné budovy o -30% na 4h • heat +2 • cooldown 10h."
      ],
      mechanics: {
        type: "convenience-store",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: CONVENIENCE_STORE_BUILDING_CONFIG.baseHeatPerDay * levelEffects.heatMultiplier,
        effectsLabel: effects.join(" • "),
        cooldowns: {
          nightSale: Math.max(0, Number(snapshot.cooldowns.nightSale || 0) - now),
          smallDeal: Math.max(0, Number(snapshot.cooldowns.smallDeal || 0) - now),
          coverOps: Math.max(0, Number(snapshot.cooldowns.coverOps || 0) - now)
        },
        currentCleanIncomeMultiplier: rates.currentCleanIncomeMultiplier,
        currentDirtyIncomeMultiplier: rates.currentDirtyIncomeMultiplier,
        currentInfluencePerHour: syncResult.currentInfluencePerHour,
        districtIncomeBoostPct: syncResult.districtIncomeBoostPct
      }
    };
  }

  function handleConvenienceStoreBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getConvenienceStoreStateByKey(key, now);
    syncConvenienceStoreIncome(snapshot, 0, now, district || context?.districtId);
    const toCooldownLeft = (until) => Math.max(0, Math.floor(Number(until || 0) - now));

    if (actionId === "1") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.nightSale);
      if (cooldownLeft > 0) {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: `Noční prodej je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.nightSaleUntil = now + CONVENIENCE_STORE_BUILDING_CONFIG.actionDurations.nightSale;
      snapshot.cooldowns.nightSale = now + CONVENIENCE_STORE_BUILDING_CONFIG.actionCooldowns.nightSale;
      const nextHeat = addPlayerHeatFromBuilding(CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.nightSale, "Noční prodej");
      persistConvenienceStoreState(key, snapshot);
      return {
        ok: true,
        message:
          `Noční prodej aktivní na ${formatDurationLabel(CONVENIENCE_STORE_BUILDING_CONFIG.actionDurations.nightSale)}. `
          + `Income +${CONVENIENCE_STORE_BUILDING_CONFIG.actionBoosts.nightSaleIncomePct}%, `
          + `heat +${CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.nightSale} (celkem ${formatDecimalValue(nextHeat, 1)}).`
      };
    }

    if (actionId === "2") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.smallDeal);
      if (cooldownLeft > 0) {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: `Malý deal je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.cooldowns.smallDeal = now + CONVENIENCE_STORE_BUILDING_CONFIG.actionCooldowns.smallDeal;
      const gainedDrugs = grantInstantDrugReward(CONVENIENCE_STORE_BUILDING_CONFIG.smallDealNeonDustReward);
      const nextHeat = addPlayerHeatFromBuilding(CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.smallDeal, "Malý deal");
      persistConvenienceStoreState(key, snapshot);
      return {
        ok: true,
        message:
          `Malý deal proběhl: +${gainedDrugs} ks Neon Dust. `
          + `Heat +${CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.smallDeal} (celkem ${formatDecimalValue(nextHeat, 1)}).`
      };
    }

    if (actionId === "3") {
      const cooldownLeft = toCooldownLeft(snapshot.cooldowns.coverOps);
      if (cooldownLeft > 0) {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: `Krytí operací je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
      }
      snapshot.effects.coverOpsUntil = now + CONVENIENCE_STORE_BUILDING_CONFIG.actionDurations.coverOps;
      snapshot.cooldowns.coverOps = now + CONVENIENCE_STORE_BUILDING_CONFIG.actionCooldowns.coverOps;
      const nextHeat = addPlayerHeatFromBuilding(CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.coverOps, "Krytí operací");
      persistConvenienceStoreState(key, snapshot);
      return {
        ok: true,
        message:
          `Krytí operací aktivní na ${formatDurationLabel(CONVENIENCE_STORE_BUILDING_CONFIG.actionDurations.coverOps)}. `
          + `Heat jiné budovy -${CONVENIENCE_STORE_BUILDING_CONFIG.actionBoosts.coverOpsHeatReductionPct}%, `
          + `heat +${CONVENIENCE_STORE_BUILDING_CONFIG.actionHeatAdded.coverOps} (celkem ${formatDecimalValue(nextHeat, 1)}).`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > CONVENIENCE_STORE_BUILDING_CONFIG.maxLevel) {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: "Večerka je na maximálním levelu." };
      }
      const cost = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.upgradeCosts[nextLevel] || 0));
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistConvenienceStoreState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistConvenienceStoreState(key, snapshot);
      return { ok: true, message: `Večerka vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistConvenienceStoreState(key, snapshot);
    return null;
  }

  function resolveFactoryBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const primaryTarget = resolvePrimaryOwnedFactoryTarget(context, district);
    const activeContext = primaryTarget.context || context;
    const activeDistrict = primaryTarget.district || district || null;
    const key = resolveBuildingInstanceKey(activeContext, activeDistrict);
    const ownedFactoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, (ownedFactoryCount - 1) * 10);
    const snapshot = getFactoryStateByKey(key, now);
    const syncResult = syncFactoryProduction(snapshot, now, {
      applyHeat: true,
      ownedFactoryCount,
      networkProductionBonusPct
    });
    const cashState = getSimpleCashBuildingStateByKey(key, now);
    const cashSyncResult = syncSimpleCashBuildingIncome(cashState, FACTORY_CASH_RATES, now, activeDistrict || activeContext?.districtId);
    persistSimpleCashBuildingState(key, cashState);
    persistFactoryState(key, snapshot);

    const levelMultiplier = getFactoryLevelMultiplier(snapshot.level);
    const totalProductionMultiplier = levelMultiplier * (1 + networkProductionBonusPct / 100);
    const factoryPenaltyPct = getGlobalPoliceRaidProductionPenaltyPct("factory", now);
    const factoryPenaltyMultiplier = Math.max(0, 1 - factoryPenaltyPct / 100);
    const effectiveProductionMultiplier = totalProductionMultiplier * factoryPenaltyMultiplier;
    const rates = calculateFactoryProductionRates(effectiveProductionMultiplier);
    const nextLevel = snapshot.level < FACTORY_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? getFactoryUpgradeCost(nextLevel) : 0;
    const resources = createFactoryResourceMap(snapshot.resources);
    const playerSupplies = getFactoryPlayerSuppliesSnapshot();
    const boostSnapshot = getFactoryBoostSnapshot(now);
      const slots = (Array.isArray(snapshot.slots) ? snapshot.slots : []).map((slot) => {
        const config = FACTORY_SLOT_CONFIG.find((entry) => Number(entry.id) === Number(slot.id)) || null;
        const isCraftSlot = String(config?.mode || slot.mode || "").trim() === "craft";
        const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
        const perHour = slot.resourceKey === "metalParts"
          ? rates.metalPartsPerHour
          : slot.resourceKey === "techCore"
            ? rates.techCorePerHour
            : rates.combatModulePerHour;
      return {
        id: Number(slot.id),
        resourceKey: slot.resourceKey,
        resourceLabel: config?.label || slot.resourceKey,
        mode: config?.mode || slot.mode || "produce",
        isProducing: Boolean(slot.isProducing),
        producedAmount,
        slotCap: FACTORY_SLOT_STORAGE_CAP,
        perHour: Math.max(0, Number(perHour || 0)),
        effectiveDurationMs: isCraftSlot
          ? Math.max(1, Math.round(FACTORY_CONFIG.combatModule.durationMs / Math.max(0.01, effectiveProductionMultiplier)))
          : 0
      };
    });
    const activeSlots = Math.max(0, Math.floor(Number(syncResult.activeSlots || 0)));
    const storedTotal = FACTORY_RESOURCE_KEYS.reduce((sum, resourceKey) => sum + Number(resources[resourceKey] || 0), 0);
    const hourlyCleanIncome = Number(cashSyncResult?.rates?.hourlyCleanIncome || 0);
    const hourlyDirtyIncome = Number(cashSyncResult?.rates?.hourlyDirtyIncome || 0);
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const effects = [
      `Síť Továren: ${ownedFactoryCount} budov (+${formatDecimalValue(networkProductionBonusPct, 2)}% rychlost výroby)`
    ];

    const primaryDisplayName = primaryTarget.primary?.displayName || activeContext?.variantName || activeContext?.baseName;
    const otherDisplayNames = primaryTarget.entries.slice(1).map((entry) => entry.displayName);
    const combinedDisplayName = otherDisplayNames.length
      ? `${primaryDisplayName} | Další: ${otherDisplayNames.join(", ")}`
      : primaryDisplayName;

    return {
      ...fallback,
      baseName: activeContext.baseName,
      displayName: combinedDisplayName || activeContext.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome: hourlyIncome * 24,
      info:
        "Továrna je produkční budova základních zbraňových materiálů. "
        + "Vyrábí Metal Parts a Tech Core, z nich následně craftí Combat Module. Combat boosty aktivuješ přes Boost tlačítko nad mapou.",
      specialActions: [
        "Slot 1: Metal Parts (rychlá základní výroba).",
        "Slot 2: Tech Core (pomalejší pokročilá výroba).",
        `Slot 3: Combat Module (${FACTORY_CONFIG.combatModule.metalPartsCost} MP + ${FACTORY_CONFIG.combatModule.techCoreCost} TC, ${formatDurationLabel(FACTORY_CONFIG.combatModule.durationMs)}, +${FACTORY_CONFIG.combatModule.heatPerUnit} heat / ks).`,
        "Combat boosty: Assault Protocol (2 CM), Rapid Strike (3 CM), Breach Mode (4 CM) přes Boost tlačítko."
      ],
      mechanics: {
        type: "factory",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: 0,
        effectsLabel: effects.join(" • "),
        resources,
        playerSupplies,
        slots,
        activeSlots,
        storedTotal,
        hourlyCleanIncome,
        hourlyDirtyIncome,
        ratesPerHour: {
          metalParts: rates.metalPartsPerHour,
          techCore: rates.techCorePerHour,
          combatModule: rates.combatModulePerHour
        },
        producedSinceLastTick: createFactoryResourceMap(syncResult.produced),
        heatAddedSinceLastTick: Math.max(0, Math.floor(Number(syncResult.heatAdded || 0))),
        ownedFactoryCount,
        networkProductionBonusPct,
        productionMultiplier: effectiveProductionMultiplier,
        primaryContext: activeContext,
        primaryDistrictId: activeDistrict?.id ?? null
      }
    };
  }

  function handleFactoryBuildingAction(actionId, activeContext) {
    const inputDistrict = activeContext?.district || null;
    const inputContext = activeContext?.context || null;
    if (!inputContext) {
      return { ok: false, message: "Továrna: není aktivní detail budovy." };
    }
    const primaryTarget = resolvePrimaryOwnedFactoryTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const ownedFactoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, (ownedFactoryCount - 1) * 10);
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getFactoryStateByKey(key, now);
    syncFactoryProduction(snapshot, now, {
      applyHeat: true,
      ownedFactoryCount,
      networkProductionBonusPct
    });

    if (actionId === "1" || actionId === "2" || actionId === "3") {
      if (isPoliceRaidSpecialActionBlockedForBuilding("factory", now)) {
        persistFactoryState(key, snapshot);
        return { ok: false, message: "Speciální akce Továrny jsou během razie dočasně zakázané." };
      }
      persistFactoryState(key, snapshot);
      return { ok: false, message: "Combat boosty z Combat Module budou napojené v dalším kroku." };
    }

    if (actionId === "collect") {
      const collected = createFactoryResourceMap(snapshot.resources);
      const totalCollected = FACTORY_RESOURCE_KEYS.reduce((sum, resourceKey) => sum + Number(collected[resourceKey] || 0), 0);
      if (totalCollected <= 0) {
        persistFactoryState(key, snapshot);
        return { ok: false, message: "Továrna: není co vybrat." };
      }
      snapshot.resources = createFactoryResourceMap();
      if (Array.isArray(snapshot.slots)) {
        snapshot.slots.forEach((slot) => {
          slot.producedAmount = 0;
          slot.productionRemainder = 0;
          slot.lastTick = now;
        });
      }
      const player = getFactoryPlayerSuppliesSnapshot();
      FACTORY_RESOURCE_KEYS.forEach((resourceKey) => {
        player[resourceKey] = Math.max(
          0,
          Math.floor(Number(player[resourceKey] || 0) + Number(collected[resourceKey] || 0))
        );
      });
      persistFactoryState(key, snapshot);
      persistFactoryPlayerSuppliesSnapshot(player);
      return {
        ok: true,
        message:
          `Továrna -> Sklad hráče: MP ${collected.metalParts}, TC ${collected.techCore}, CM ${collected.combatModule}. `
          + `Stav skladu: MP ${player.metalParts}, TC ${player.techCore}, CM ${player.combatModule}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > FACTORY_CONFIG.maxLevel) {
        persistFactoryState(key, snapshot);
        return { ok: false, message: "Továrna je na maximálním levelu." };
      }
      const cost = getFactoryUpgradeCost(nextLevel);
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistFactoryState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistFactoryState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistFactoryState(key, snapshot);
      return { ok: true, message: `Továrna vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistFactoryState(key, snapshot);
    return null;
  }

  function applyArmoryWeaponsToPlayerInventory(weaponMap = {}) {
    const byNameAttack = {};
    const byNameDefense = {};
    const byKey = createArmoryWeaponMap();
    ARMORY_WEAPON_KEYS.forEach((weaponKey) => {
      const amount = Math.max(0, Math.floor(Number(weaponMap?.[weaponKey] || 0)));
      if (!amount) return;
      byKey[weaponKey] = amount;
      const config = ARMORY_CONFIG.weapons[weaponKey];
      if (!config) return;
      if (config.category === "defense") {
        byNameDefense[config.name] = amount;
      } else {
        byNameAttack[config.name] = amount;
      }
    });
    const total = ARMORY_WEAPON_KEYS.reduce((sum, weaponKey) => sum + Number(byKey[weaponKey] || 0), 0);
    if (!total) {
      return { total: 0, byKey };
    }

    const addCraftedWeapons = window.Empire.UI?.addCraftedWeapons;
    if (typeof addCraftedWeapons === "function" && Object.keys(byNameAttack).length) {
      addCraftedWeapons(byNameAttack);
    } else if (Object.keys(byNameAttack).length) {
      try {
        const current = JSON.parse(localStorage.getItem("empire_weapons_detail") || "{}");
        const merged = current && typeof current === "object" && !Array.isArray(current) ? current : {};
        Object.entries(byNameAttack).forEach(([name, amount]) => {
          const delta = Math.max(0, Math.floor(Number(amount) || 0));
          if (!delta) return;
          merged[name] = Math.max(0, Math.floor(Number(merged[name] || 0) + delta));
        });
        localStorage.setItem("empire_weapons_detail", JSON.stringify(merged));
      } catch {}
    }

    const addCraftedDefense = window.Empire.UI?.addCraftedDefense;
    if (typeof addCraftedDefense === "function" && Object.keys(byNameDefense).length) {
      addCraftedDefense(byNameDefense);
    } else if (Object.keys(byNameDefense).length) {
      try {
        const current = JSON.parse(localStorage.getItem("empire_defense_detail") || "{}");
        const merged = current && typeof current === "object" && !Array.isArray(current) ? current : {};
        Object.entries(byNameDefense).forEach(([name, amount]) => {
          const delta = Math.max(0, Math.floor(Number(amount) || 0));
          if (!delta) return;
          merged[name] = Math.max(0, Math.floor(Number(merged[name] || 0) + delta));
        });
        localStorage.setItem("empire_defense_detail", JSON.stringify(merged));
      } catch {}
    }

    return { total, byKey };
  }

  function resolveArmoryBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const primaryTarget = resolvePrimaryOwnedArmoryTarget(context, district);
    const activeContext = primaryTarget.context || context;
    const activeDistrict = primaryTarget.district || district || null;
    const key = resolveBuildingInstanceKey(activeContext, activeDistrict);
    const ownedArmoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, ownedArmoryCount * 10);
    const snapshot = getArmoryStateByKey(key, now);
    applyArmoryPassiveBoostHeat(snapshot, now);
    const syncResult = syncArmoryProduction(snapshot, now, {
      applyHeat: true,
      ownedArmoryCount,
      networkProductionBonusPct
    });
    const cashState = getSimpleCashBuildingStateByKey(key, now);
    const cashSyncResult = syncSimpleCashBuildingIncome(cashState, ARMORY_CASH_RATES, now, activeDistrict || activeContext?.districtId);
    persistSimpleCashBuildingState(key, cashState);
    persistArmoryState(key, snapshot);

    const levelMultiplier = getArmoryLevelMultiplier(snapshot.level);
    const baseProductionMultiplier = levelMultiplier * (1 + networkProductionBonusPct / 100);
    const boostSnapshot = getArmoryBoostSnapshot(snapshot, now);
    const armoryPenaltyPct = getGlobalPoliceRaidProductionPenaltyPct("armory", now);
    const armoryPenaltyMultiplier = Math.max(0, 1 - armoryPenaltyPct / 100);
    const rates = calculateArmoryProductionRates(baseProductionMultiplier, {
      attackMultiplier: boostSnapshot.attackProductionMultiplier * armoryPenaltyMultiplier,
      defenseMultiplier: boostSnapshot.defenseProductionMultiplier * armoryPenaltyMultiplier
    });
    const nextLevel = snapshot.level < ARMORY_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? getArmoryUpgradeCost(nextLevel) : 0;
    const storedWeapons = resolveArmoryCollectableWeapons(snapshot);
    const playerMaterials = syncResult.factorySupplies || createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    const slots = (Array.isArray(snapshot.slots) ? snapshot.slots : []).map((slot) => {
      const config = ARMORY_CONFIG.weapons[slot.weaponKey] || null;
      const category = config?.category === "defense" ? "defense" : "attack";
      const powerValue = category === "defense"
        ? Math.max(0, Math.floor(Number(config?.defensePower || 0)))
        : Math.max(0, Math.floor(Number(config?.attackPower || 0)));
      const categoryProductionMultiplier = baseProductionMultiplier
        * (category === "defense"
          ? boostSnapshot.defenseProductionMultiplier
          : boostSnapshot.attackProductionMultiplier)
        * armoryPenaltyMultiplier;
        return {
          id: Number(slot.id),
          weaponKey: slot.weaponKey,
          category,
          weaponName: config?.name || slot.weaponKey,
          isProducing: Boolean(slot.isProducing),
          batchMaxUnits: Math.min(
            ARMORY_BATCH_MAX_UNITS,
            Math.max(
              0,
              Math.floor(Number(slot.batchMaxUnits || 0) || (Number(slot.producedAmount || 0) + Number(slot.remainingUnits || 0)))
            )
          ),
          queuedUnits: clamp(Math.max(1, Math.floor(Number(slot.queuedUnits || 1))), 1, ARMORY_BATCH_MAX_UNITS),
          remainingUnits: Math.max(0, Math.floor(Number(slot.remainingUnits || 0))),
          producedAmount: Math.max(0, Math.floor(Number(slot.producedAmount || 0))),
        perHour: Math.max(0, Number(rates[slot.weaponKey] || 0)),
        powerLabel: category === "defense" ? "Defense" : "Attack",
        powerValue,
        metalPartsCost: Math.max(0, Math.floor(Number(config?.metalPartsCost || 0))),
        techCoreCost: Math.max(0, Math.floor(Number(config?.techCoreCost || 0))),
        durationMs: Math.max(1, Math.floor(Number(config?.durationMs || 60000))),
          effectiveDurationMs: Math.max(1, Math.round(Number(config?.durationMs || 60000) / Math.max(0.01, categoryProductionMultiplier))),
          specialEffect: String(config?.specialEffect || ""),
          drawback: String(config?.drawback || ""),
          role: String(config?.role || ""),
          heatPerUnit: Math.max(0, Math.floor(Number(config?.heatPerUnit || 0))),
          canAffordQueue: (
            Number(playerMaterials.metalParts || 0) >= Math.max(0, Math.floor(Number(config?.metalPartsCost || 0))) * clamp(Math.max(1, Math.floor(Number(slot.queuedUnits || 1))), 1, ARMORY_BATCH_MAX_UNITS)
            && Number(playerMaterials.techCore || 0) >= Math.max(0, Math.floor(Number(config?.techCoreCost || 0))) * clamp(Math.max(1, Math.floor(Number(slot.queuedUnits || 1))), 1, ARMORY_BATCH_MAX_UNITS)
          ),
          batchAtMax: Math.min(
            ARMORY_BATCH_MAX_UNITS,
            Math.max(
              0,
              Math.floor(Number(slot.batchMaxUnits || 0) || (Number(slot.producedAmount || 0) + Number(slot.remainingUnits || 0)))
            )
          ) >= ARMORY_BATCH_MAX_UNITS
        };
      });
    const attackSlots = slots.filter((slot) => slot.category !== "defense");
    const defenseSlots = slots.filter((slot) => slot.category === "defense");
    const activeAttackSlots = attackSlots.reduce((sum, slot) => sum + (slot.isProducing ? 1 : 0), 0);
    const activeDefenseSlots = defenseSlots.reduce((sum, slot) => sum + (slot.isProducing ? 1 : 0), 0);
    const activeSlots = Math.max(0, Math.floor(Number(syncResult.activeSlots || 0)));
    const storedTotal = ARMORY_WEAPON_KEYS.reduce((sum, weaponKey) => sum + Number(storedWeapons[weaponKey] || 0), 0);
    const storedAttackTotal = ARMORY_ATTACK_WEAPON_KEYS.reduce((sum, weaponKey) => sum + Number(storedWeapons[weaponKey] || 0), 0);
    const storedDefenseTotal = ARMORY_DEFENSE_WEAPON_KEYS.reduce((sum, weaponKey) => sum + Number(storedWeapons[weaponKey] || 0), 0);
    const hourlyCleanIncome = Number(cashSyncResult?.rates?.hourlyCleanIncome || 0);
    const hourlyDirtyIncome = Number(cashSyncResult?.rates?.hourlyDirtyIncome || 0);
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const effects = [
      `Síť aktivních továren (+${formatDecimalValue(networkProductionBonusPct, 2)}% rychlost výroby za budovu)`
    ];

    const primaryDisplayName = primaryTarget.primary?.displayName || activeContext?.variantName || activeContext?.baseName;
    const otherDisplayNames = primaryTarget.entries.slice(1).map((entry) => entry.displayName);
    const combinedDisplayName = otherDisplayNames.length
      ? `${primaryDisplayName} | Další: ${otherDisplayNames.join(", ")}`
      : primaryDisplayName;

    return {
      ...fallback,
      baseName: activeContext.baseName,
      displayName: combinedDisplayName || activeContext.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome: hourlyIncome * 24,
      info:
        "Zbrojovka vyrábí útočné i obranné vybavení z Metal Parts a Tech Core. "
        + "Výroba je oddělená do dvou sekcí (útok/obrana), každá položka má vlastní slot, recept a čas.",
      specialActions: [
        "Útok (sloty 1-5): Baseballová pálka, Pouliční pistole, Granát, Samopal, Bazuka.",
        "Baseballová pálka: attack power 5.",
        "Pouliční pistole: attack power 10.",
        "Granát: attack power 14. Specialita: ignoruje 0.3 % obrany.",
        "Samopal: attack power 18. Specialita: +0.2 power za ks při použití všech 5 attack zbraní v jednom útoku.",
        "Bazuka: attack power 30. Specialita: 1 ks zvyšuje o 0.5 % šanci na totální destrukci napadeného districtu.",
        "Obrana (sloty 6-10): Neprůstřelná vesta, Ocelové barikády, Bezpečnostní kamery, Automatické kulometné stanoviště, Alarm.",
        "Neprůstřelná vesta: defense power 6. Specialita: snižuje ztráty počtu obyvatel gangu o 0.5 % za ks.",
        "Ocelové barikády: defense power 12.",
        "Bezpečnostní kamery: defense power 6. Specialita: při 5+ kusech velká šance na odhalení špeha.",
        "Automatické kulometné stanoviště: defense power 20. Specialita: 1 ks snižuje útočníkovi sílu útoku o 0.3 %.",
        "Alarm: defense power 10. Specialita: při 5+ kusech velká šance na selhání vykradení districtu.",
        "Attack gun boost: trvání 2h, cooldown 6h, +20 % rychlost výroby útočných zbraní, okamžitě +10 heat, během boostu +5 heat/h.",
        "Defense gun boost: trvání 2h, cooldown 6h, +20 % rychlost výroby obranných zbraní, okamžitě +10 heat, během boostu +5 heat/h."
      ],
      mechanics: {
        type: "armory",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerHour: Math.max(0, Number(boostSnapshot.passiveHeatPerHour || 0)),
        heatPerDay: Math.max(0, Number(boostSnapshot.passiveHeatPerHour || 0)) * 24,
        effectsLabel: effects.join(" • "),
        storedWeapons,
        playerMaterials,
        slots,
        attackSlots,
        defenseSlots,
        activeSlots,
        activeAttackSlots,
        activeDefenseSlots,
        storedTotal,
        storedAttackTotal,
        storedDefenseTotal,
        hourlyCleanIncome,
        hourlyDirtyIncome,
        ratesPerHour: rates,
        producedSinceLastTick: createArmoryWeaponMap(syncResult.produced),
        heatAddedSinceLastTick: Math.max(0, Math.floor(Number(syncResult.heatAdded || 0))),
        ownedArmoryCount,
        networkProductionBonusPct,
        productionMultiplier: baseProductionMultiplier * armoryPenaltyMultiplier,
        attackProductionMultiplier: baseProductionMultiplier * boostSnapshot.attackProductionMultiplier * armoryPenaltyMultiplier,
        defenseProductionMultiplier: baseProductionMultiplier * boostSnapshot.defenseProductionMultiplier * armoryPenaltyMultiplier,
        cooldowns: {
          attackBoost: Math.max(0, Number(snapshot.cooldowns.attackBoost || 0) - now),
          defenseBoost: Math.max(0, Number(snapshot.cooldowns.defenseBoost || 0) - now)
        },
        boosts: {
          attackBoostActive: boostSnapshot.attackBoostActive,
          defenseBoostActive: boostSnapshot.defenseBoostActive,
          attackBoostUntil: Math.max(0, Number(snapshot.effects.attackBoostUntil || 0) - now),
          defenseBoostUntil: Math.max(0, Number(snapshot.effects.defenseBoostUntil || 0) - now)
        },
        primaryContext: activeContext,
        primaryDistrictId: activeDistrict?.id ?? null
      }
    };
  }

  function handleArmoryBuildingAction(actionId, activeContext) {
    const inputDistrict = activeContext?.district || null;
    const inputContext = activeContext?.context || null;
    if (!inputContext) {
      return { ok: false, message: "Zbrojovka: není aktivní detail budovy." };
    }
    const primaryTarget = resolvePrimaryOwnedArmoryTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const ownedArmoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, ownedArmoryCount * 10);
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getArmoryStateByKey(key, now);
    applyArmoryPassiveBoostHeat(snapshot, now);
    const syncResult = syncArmoryProduction(snapshot, now, {
      applyHeat: true,
      ownedArmoryCount,
      networkProductionBonusPct
    });
    if (actionId === "1" || actionId === "2" || actionId === "3") {
      if (isPoliceRaidSpecialActionBlockedForBuilding("armory", now)) {
        persistArmoryState(key, snapshot);
        return { ok: false, message: "Speciální akce Zbrojovky jsou během razie dočasně zakázané." };
      }
      if (actionId === "1") {
        const cooldownLeft = Math.max(0, Number(snapshot.cooldowns.attackBoost || 0) - now);
        if (cooldownLeft > 0) {
          persistArmoryState(key, snapshot);
          return { ok: false, message: `Attack gun boost je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        }
        snapshot.effects.attackBoostUntil = now + ARMORY_SPECIAL_ACTIONS.attackBoost.durationMs;
        snapshot.cooldowns.attackBoost = now + ARMORY_SPECIAL_ACTIONS.attackBoost.cooldownMs;
        snapshot.lastBoostHeatAt = now;
        const nextHeat = addPlayerHeatFromBuilding(ARMORY_SPECIAL_ACTIONS.attackBoost.immediateHeat);
        persistArmoryState(key, snapshot);
        return {
          ok: true,
          message:
            `Attack gun boost aktivní na ${formatDurationLabel(ARMORY_SPECIAL_ACTIONS.attackBoost.durationMs)} `
            + `(+${ARMORY_SPECIAL_ACTIONS.attackBoost.productionBoostPct}% produkce útoku). `
            + `Heat +${ARMORY_SPECIAL_ACTIONS.attackBoost.immediateHeat} (celkem ${nextHeat}) `
            + `a během boostu +${ARMORY_SPECIAL_ACTIONS.attackBoost.passiveHeatPerHour}/h.`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = Math.max(0, Number(snapshot.cooldowns.defenseBoost || 0) - now);
        if (cooldownLeft > 0) {
          persistArmoryState(key, snapshot);
          return { ok: false, message: `Defense gun boost je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        }
        snapshot.effects.defenseBoostUntil = now + ARMORY_SPECIAL_ACTIONS.defenseBoost.durationMs;
        snapshot.cooldowns.defenseBoost = now + ARMORY_SPECIAL_ACTIONS.defenseBoost.cooldownMs;
        snapshot.lastBoostHeatAt = now;
        const nextHeat = addPlayerHeatFromBuilding(ARMORY_SPECIAL_ACTIONS.defenseBoost.immediateHeat);
        persistArmoryState(key, snapshot);
        return {
          ok: true,
          message:
            `Defense gun boost aktivní na ${formatDurationLabel(ARMORY_SPECIAL_ACTIONS.defenseBoost.durationMs)} `
            + `(+${ARMORY_SPECIAL_ACTIONS.defenseBoost.productionBoostPct}% produkce obrany). `
            + `Heat +${ARMORY_SPECIAL_ACTIONS.defenseBoost.immediateHeat} (celkem ${nextHeat}) `
            + `a během boostu +${ARMORY_SPECIAL_ACTIONS.defenseBoost.passiveHeatPerHour}/h.`
        };
      }
      persistArmoryState(key, snapshot);
      return { ok: false, message: "Zbrojovka: neznámá speciální akce." };
    }

    if (actionId === "collect") {
      const collected = resolveArmoryCollectableWeapons(snapshot);
      const totalCollected = ARMORY_WEAPON_KEYS.reduce((sum, weaponKey) => sum + Number(collected[weaponKey] || 0), 0);
      if (totalCollected <= 0) {
        persistArmoryState(key, snapshot);
        return { ok: false, message: "Zbrojovka: není co vybrat." };
      }

      snapshot.storedWeapons = createArmoryWeaponMap();
      if (Array.isArray(snapshot.slots)) {
        snapshot.slots.forEach((slot) => {
          slot.producedAmount = 0;
          slot.productionRemainder = 0;
          slot.lastTick = now;
        });
      }
      persistArmoryState(key, snapshot);
      applyArmoryWeaponsToPlayerInventory(collected);

      const attackSummary = ARMORY_ATTACK_WEAPON_KEYS
        .map((weaponKey) => {
          const config = ARMORY_CONFIG.weapons[weaponKey];
          const short = config?.name || weaponKey;
          const amount = Math.max(0, Math.floor(Number(collected[weaponKey] || 0)));
          return `${short} ${amount}`;
        })
        .join(", ");
      const defenseSummary = ARMORY_DEFENSE_WEAPON_KEYS
        .map((weaponKey) => {
          const config = ARMORY_CONFIG.weapons[weaponKey];
          const short = config?.name || weaponKey;
          const amount = Math.max(0, Math.floor(Number(collected[weaponKey] || 0)));
          return `${short} ${amount}`;
        })
        .join(", ");

      return {
        ok: true,
        message: `Zbrojovka -> Inventář | Útok: ${attackSummary}. Obrana: ${defenseSummary}.`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > ARMORY_CONFIG.maxLevel) {
        persistArmoryState(key, snapshot);
        return { ok: false, message: "Zbrojovka je na maximálním levelu." };
      }
      const cost = getArmoryUpgradeCost(nextLevel);
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistArmoryState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistArmoryState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistArmoryState(key, snapshot);
      return { ok: true, message: `Zbrojovka vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistArmoryState(key, snapshot);
    return null;
  }

  function resolvePharmacyBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const primaryTarget = resolvePrimaryOwnedPharmacyTarget(context, district);
    const activeContext = primaryTarget.context || context;
    const activeDistrict = primaryTarget.district || district || null;
    const key = resolveBuildingInstanceKey(activeContext, activeDistrict);
    const snapshot = getPharmacyStateByKey(key, now);
    const syncResult = syncPharmacyProduction(snapshot, now);
    const incomeSyncResult = syncPharmacyIncome(snapshot, now, activeDistrict || activeContext?.districtId);
    persistPharmacyState(key, snapshot);

    const levelMultiplier = getPharmacyLevelMultiplier(snapshot.level);
    const rates = calculatePharmacyProductionRates(levelMultiplier);
    const ownedPharmacyCount = getOwnedPharmacyCount();
    const pharmacyProductionBonusPct = getPharmacyProductionBonusPct();
    const ownedWarehouseCount = getOwnedWarehouseCountForDrugLab();
    const pharmacyStorageCapBonusPct = getPharmacyStorageCapBonusPct();
    const slotCapMultiplier = getPharmacyStorageCapMultiplier();
    const nextLevel = snapshot.level < PHARMACY_CONFIG.maxLevel ? snapshot.level + 1 : null;
    const nextUpgradeCost = nextLevel ? getPharmacyUpgradeCost(nextLevel) : 0;
    const boostSnapshot = getPharmacyBoostSnapshot(now);
    const resources = createPharmacyResourceMap(snapshot.resources);
    const slots = (Array.isArray(snapshot.slots) ? snapshot.slots : []).map((slot) => {
      const config = PHARMACY_SLOT_CONFIG.find((entry) => Number(entry.id) === Number(slot.id)) || null;
      return {
        id: Number(slot.id),
        resourceKey: slot.resourceKey,
        resourceLabel: config?.label || slot.resourceKey,
        isProducing: Boolean(slot.isProducing),
        queuedUnits: slot.isProducing
          ? Math.max(0, Math.floor(Number(slot.queuedUnits || 0)))
          : Math.max(1, Math.floor(Number(slot.queuedUnits || 1))),
        queueRemaining: Math.max(0, Math.floor(Number(slot.queueRemaining || 0))),
        producedAmount: Math.max(0, Math.floor(Number(slot.producedAmount || 0))),
        slotCap: Number.isFinite(Number(PHARMACY_CONFIG.slotStorageCaps?.[slot.resourceKey]))
          ? Math.max(0, Math.floor(Number(PHARMACY_CONFIG.slotStorageCaps[slot.resourceKey]) * slotCapMultiplier))
          : Number.NaN,
        cleanCostPerUnit: Math.max(0, Math.floor(Number(PHARMACY_UNIT_CLEAN_COST[slot.resourceKey] || 0))),
        perHour: Math.max(0, Number(
          slot.resourceKey === "chemicals"
            ? rates.chemicalsPerHour
            : slot.resourceKey === "biomass"
              ? rates.biomassPerHour
              : rates.stimPackPerHour
        ))
      };
    });
    const activeSlots = Math.max(0, Math.floor(Number(syncResult.activeSlots || 0)));
    const storedTotal = PHARMACY_RESOURCE_KEYS.reduce((sum, resourceKey) => sum + Number(resources[resourceKey] || 0), 0);
    const hourlyCleanIncome = Number(incomeSyncResult?.rates?.hourlyCleanIncome || 0);
    const hourlyDirtyIncome = Number(incomeSyncResult?.rates?.hourlyDirtyIncome || 0);
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    const dailyIncome = hourlyIncome * 24;

    const effects = [];
    if (boostSnapshot.activeCount > 0) {
      effects.push(
        `Globální boost: spy +${formatDecimalValue(boostSnapshot.effective.spySpeedPct, 2)}%, `
        + `attack +${formatDecimalValue(boostSnapshot.effective.attackSpeedPct, 2)}%, `
        + `steal +${formatDecimalValue(boostSnapshot.effective.stealSpeedPct, 2)}%`
      );
      const activeLabels = boostSnapshot.activeEffects
        .slice(0, 3)
        .map((entry) => `${entry.type} ${formatDurationLabel(entry.remainingMs)}`)
        .join(", ");
      if (activeLabels) {
        effects.push(`Aktivní boosty: ${activeLabels}`);
      }
    }
    effects.push(`Síť Lékáren: ${ownedPharmacyCount} (+${formatDecimalValue(pharmacyProductionBonusPct, 2)}% rychlost produkce)`);
    effects.push(`Sklady hráče: ${ownedWarehouseCount} (+${formatDecimalValue(pharmacyStorageCapBonusPct, 2)}% maximální výroba slotů)`);
    effects.push(`Boost zásoby: Ghost Serum ${Math.max(0, Math.floor(Number(boostSnapshot.drugInventory?.ghostSerum || 0)))} • Overdrive X ${Math.max(0, Math.floor(Number(boostSnapshot.drugInventory?.overdriveX || 0)))}`);

    const primaryDisplayName = primaryTarget.primary?.displayName || activeContext?.variantName || activeContext?.baseName;
    const otherDisplayNames = primaryTarget.entries.slice(1).map((entry) => entry.displayName);
    const combinedDisplayName = otherDisplayNames.length
      ? `${primaryDisplayName} | Další: ${otherDisplayNames.join(", ")}`
      : primaryDisplayName;

    return {
      ...fallback,
      baseName: activeContext.baseName,
      displayName: combinedDisplayName || activeContext.baseName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome,
      info:
        "Lékárna je support budova se 3 sloty (Chemicals, Biomass, Stim Pack). "
        + "Po vybrání surovin se vše převede do Drug Lab zásob. Boosty se aktivují přes tlačítko Boost nad mapou a spotřebovávají Ghost Serum / Overdrive X.",
      specialActions: [
        "Vybrat suroviny: přesune Chemicals/Biomass/Stim Pack z Lékárny do zásob Drug Labu.",
        "Boost tlačítko (nad mapou): Recon (1 Ghost Serum), Action (1 Ghost Serum), Neuro (1 Overdrive X +3 heat), každý na 2h."
      ],
      mechanics: {
        type: "pharmacy",
        instanceKey: key,
        level: snapshot.level,
        nextLevel,
        nextUpgradeCost,
        heatPerDay: PHARMACY_CONFIG.baseHeatPerDay,
        effectsLabel: effects.length ? effects.join(" • ") : "Žádné",
        cooldowns: {
          recon: Math.max(0, Number(snapshot.cooldowns.recon || 0) - now),
          action: Math.max(0, Number(snapshot.cooldowns.action || 0) - now),
          neuro: Math.max(0, Number(snapshot.cooldowns.neuro || 0) - now)
        },
        resources,
        slots,
        activeSlots,
        storedTotal,
        ratesPerHour: {
          chemicals: rates.chemicalsPerHour,
          biomass: rates.biomassPerHour,
          stimPack: rates.stimPackPerHour
        },
        ownedPharmacyCount,
        pharmacyProductionBonusPct,
        ownedWarehouseCount,
        pharmacyStorageCapBonusPct,
        producedSinceLastTick: createPharmacyResourceMap(syncResult.produced),
        globalBoost: boostSnapshot.effective,
        drugLabSupplies: createDrugLabSupplyMap(boostSnapshot.supplies || {}),
        boostActiveCount: Math.max(0, Number(boostSnapshot.activeCount || 0))
      }
    };
  }

  function handlePharmacyBuildingAction(actionId, activeContext) {
    const inputDistrict = activeContext?.district || null;
    const inputContext = activeContext?.context || null;
    if (!inputContext) {
      return { ok: false, message: "Lékárna: není aktivní detail budovy." };
    }
    const primaryTarget = resolvePrimaryOwnedPharmacyTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getPharmacyStateByKey(key, now);
    syncPharmacyProduction(snapshot, now);
    if (actionId === "1" || actionId === "2" || actionId === "3") {
      if (isPoliceRaidSpecialActionBlockedForBuilding("pharmacy", now)) {
        persistPharmacyState(key, snapshot);
        return { ok: false, message: "Speciální akce Lékárny jsou během razie dočasně zakázané." };
      }
      persistPharmacyState(key, snapshot);
      return { ok: false, message: "Boosty aktivuješ přes tlačítko Boost nad mapou." };
    }

    if (actionId === "collect") {
      const collected = createPharmacyResourceMap(snapshot.resources);
      const totalCollected = PHARMACY_RESOURCE_KEYS.reduce((sum, resourceKey) => sum + Number(collected[resourceKey] || 0), 0);
      if (totalCollected <= 0) {
        persistPharmacyState(key, snapshot);
        return { ok: false, message: "Lékárna: není co vybrat." };
      }
      snapshot.resources = createPharmacyResourceMap();
      const player = getDrugLabPlayerSnapshot(now);
      player.labSupplies = createDrugLabSupplyMap(player.labSupplies || {});
      PHARMACY_RESOURCE_KEYS.forEach((resourceKey) => {
        player.labSupplies[resourceKey] = Math.max(
          0,
          Math.floor(Number(player.labSupplies[resourceKey] || 0) + Number(collected[resourceKey] || 0))
        );
      });
      const heatAdded = Math.max(0, Number(collected.chemicals || 0)) * 0.5;
      const nextHeat = heatAdded > 0 ? addPlayerHeatFromBuilding(heatAdded) : readCurrentPlayerHeatValue();
      if (Array.isArray(snapshot.slots)) {
        snapshot.slots.forEach((slot) => {
          slot.producedAmount = 0;
          slot.productionRemainder = 0;
          slot.lastTick = now;
        });
      }
      persistPharmacyState(key, snapshot);
      persistDrugLabPlayerSnapshot(player);
      return {
        ok: true,
        message:
          `Lékárna -> Drug Lab: vybráno C ${collected.chemicals}, B ${collected.biomass}, S ${collected.stimPack}. `
          + `Stav zásob DL: C ${player.labSupplies.chemicals}, B ${player.labSupplies.biomass}, S ${player.labSupplies.stimPack}. `
          + `Heat +${formatDecimalValue(heatAdded, 1)} (celkem ${formatDecimalValue(nextHeat, 1)}).`
      };
    }

    if (actionId === "upgrade") {
      const nextLevel = Math.floor(snapshot.level || 1) + 1;
      if (nextLevel > PHARMACY_CONFIG.maxLevel) {
        persistPharmacyState(key, snapshot);
        return { ok: false, message: "Lékárna je na maximálním levelu." };
      }
      const cost = getPharmacyUpgradeCost(nextLevel);
      const spend = window.Empire.UI?.trySpendCleanCash;
      if (typeof spend !== "function") {
        persistPharmacyState(key, snapshot);
        return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
      }
      const result = spend(cost);
      if (!result?.ok) {
        persistPharmacyState(key, snapshot);
        return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
      }
      snapshot.level = nextLevel;
      persistPharmacyState(key, snapshot);
      return { ok: true, message: `Lékárna vylepšena na level ${nextLevel} za $${cost}.` };
    }

    persistPharmacyState(key, snapshot);
    return null;
  }

  function resolveDrugLabBuildingDetails(context, district, fallback) {
    const now = Date.now();
    const primaryTarget = resolvePrimaryOwnedDrugLabTarget(context, district);
    const activeContext = primaryTarget.context || context;
    const activeDistrict = primaryTarget.district || district || null;
    const sync = runDrugLabTick(activeContext, activeDistrict, now);
    const { core, building, player, instanceKey } = sync;
    const buildingState = building && typeof building === "object" ? building : createDrugLabDefaultState(now);
    const playerState = player && typeof player === "object" ? player : createDrugLabDefaultPlayerState();
    const unlockedSlots = core.getUnlockedSlotCount();
    const storageCapacity = core.getStorageCapacity();
    const storedTotal = core.getCurrentStoredTotal();
    const heatPerHour = core.calculateCurrentHeatPerHour(now);
    const heatPerDay = heatPerHour * 24;
    const nextLevel = building.level < DRUG_LAB_CONFIG.maxLevel ? building.level + 1 : null;
    const nextUpgradeCost = nextLevel ? Number(DRUG_LAB_CONFIG.upgradeCosts[nextLevel] || 0) : 0;
    const schoolBoost = resolveDrugLabSchoolBoostPct(instanceKey, now);
    const ownedLabCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, ownedLabCount * 5);
    const ownedWarehouseCount = getOwnedWarehouseCountForDrugLab();
    const storageCapacityBonusPct = getDrugLabStorageCapacityBonusPct();
    const pharmacySupplies = createDrugLabSupplyMap(playerState.labSupplies || {});
    const incomeRates = sync.incomeSync?.rates || {
      hourlyCleanIncome: Math.max(0, Number(DRUG_LAB_CONFIG.baseCleanIncomePerHour || 0)) * getDrugLabLevelMultiplier(buildingState.level),
      hourlyDirtyIncome: Math.max(0, Number(DRUG_LAB_CONFIG.baseDirtyIncomePerHour || 0)) * getDrugLabLevelMultiplier(buildingState.level),
      hourlyTotalIncome: 0
    };
    if (!incomeRates.hourlyTotalIncome) {
      incomeRates.hourlyTotalIncome = incomeRates.hourlyCleanIncome + incomeRates.hourlyDirtyIncome;
    }

    const slots = (Array.isArray(buildingState.slots) ? buildingState.slots : []).map((slot) => {
      const unlocked = Number(slot.id) <= unlockedSlots;
      const activeDrug = DRUG_CONFIG[slot.activeDrugType] || DRUG_CONFIG.neonDust;
      const isProducing = unlocked && Boolean(slot.isProducing);
      const queuedUnits = isProducing
        ? Math.max(0, Math.floor(Number(slot.queuedUnits || 0)))
        : Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
      const queuedSupplyCost = getDrugLabSupplyCost(activeDrug.id, queuedUnits);
      return {
        id: Number(slot.id),
        unlocked,
        activeDrugType: activeDrug.id,
        activeDrugName: activeDrug.name,
        isProducing,
        queuedUnits,
        queueRemaining: Math.max(0, Math.floor(Number(slot.queueRemaining || 0))),
        supplyCost: getDrugLabSupplyCost(activeDrug.id, 1),
        queuedSupplyCost,
        producedAmount: Math.max(0, Math.floor(Number(slot.producedAmount || 0))),
        lastTick: Math.max(0, Number(slot.lastTick || 0)),
        startedAt: Math.max(0, Number(slot.startedAt || 0))
      };
    });
    const activeSlots = slots.filter((slot) => slot.unlocked && slot.isProducing).length;
    // Supplies are consumed only on Start/Add action.
    // Switching drug type in a slot must never reserve or subtract supplies.
    const queuedSupplyDemand = createDrugLabSupplyMap();
    const availableQueuedSupplies = createDrugLabSupplyMap(pharmacySupplies);

    const effects = [];
    if (ownedWarehouseCount > 0) {
      effects.push(
        `Sklady v území: ${ownedWarehouseCount} (+${formatDecimalValue(storageCapacityBonusPct, 2)}% kapacita)`
      );
    }
    if (schoolBoost.totalPct > 0) {
      effects.push(`Škola v districtu: boost produkce +${formatDecimalValue(schoolBoost.totalPct, 2)}%`);
    }
    if (networkProductionBonusPct > 0) {
      effects.push(`Síť laboratoří: +${formatDecimalValue(networkProductionBonusPct, 2)}% produkce`);
    }
    if (core.isOverclockActive(now)) {
      effects.push(`Overclock (${formatDurationLabel(Number(buildingState.effects?.overclockUntil || 0) - now)})`);
    }
    if (core.isCleanBatchActive(now)) {
      effects.push(`Čistá várka (${formatDurationLabel(Number(buildingState.effects?.cleanBatchUntil || 0) - now)})`);
    }
    if (core.isHiddenOperationActive(now)) {
      effects.push(`Skrytý provoz (${formatDurationLabel(Number(buildingState.effects?.hiddenOperationUntil || 0) - now)})`);
    }
    Object.entries(playerState.activeDrugEffects || {}).forEach(([key, stateRef]) => {
      if (!stateRef?.active) return;
      if (now >= Number(stateRef.endsAt || 0)) return;
      effects.push(
        `${getDrugLabEffectLabel(key)} (${formatDurationLabel(Number(stateRef.endsAt || 0) - now)}${
          Number(stateRef.potencyMultiplier || 1) > 1
            ? `, síla x${formatDecimalValue(stateRef.potencyMultiplier, 2)}`
            : ""
        })`
      );
    });

    const primaryDisplayName = primaryTarget.primary?.displayName || activeContext?.variantName || activeContext?.baseName;
    const otherDisplayNames = primaryTarget.entries.slice(1).map((entry) => entry.displayName);
    const combinedDisplayName = otherDisplayNames.length
      ? `${primaryDisplayName} | Další: ${otherDisplayNames.join(", ")}`
      : primaryDisplayName;

    return {
      ...fallback,
      baseName: activeContext.baseName,
      displayName: combinedDisplayName || activeContext.baseName,
      hourlyCleanIncome: incomeRates.hourlyCleanIncome,
      hourlyDirtyIncome: incomeRates.hourlyDirtyIncome,
      hourlyIncome: incomeRates.hourlyTotalIncome,
      dailyIncome: incomeRates.hourlyTotalIncome * 24,
      info:
        "Drug Lab je produkční core budova: každý slot vyrábí zvolenou drogu v reálném čase, produkce generuje heat, "
        + "výstup jde do interního skladu a až po vybrání do hráčových zásob. "
        + "Speciální akce mění riziko/výkon a kapacitu skladu zvyšují budovy Sklad v tvém území.",
      specialActions: [
        "Overclock výroby: cooldown 6h, trvání 2h, +50 % produkce všech slotů, okamžitě +3 heat.",
        "Čistá várka: cooldown 5h, trvání 2h, nově vyrobené dávky jsou enhanced (+20 % síla efektu při použití).",
        "Skrytý provoz: cooldown 6h, trvání 2h, heat z výroby -30 %, produkce -20 %."
      ],
      mechanics: {
        type: "drug-lab",
        instanceKey,
        level: buildingState.level,
        nextLevel,
        nextUpgradeCost,
        cooldowns: {
          overclock: Math.max(0, Number(buildingState.cooldowns?.overclock || 0) - now),
          cleanBatch: Math.max(0, Number(buildingState.cooldowns?.cleanBatch || 0) - now),
          hiddenOperation: Math.max(0, Number(buildingState.cooldowns?.hiddenOperation || 0) - now)
        },
        heatPerDay,
        heatPerHour,
        effectsLabel: effects.length ? effects.join(" • ") : "Žádné",
        unlockedSlots,
        activeSlots,
        slots,
        storage: createDrugLabAmountMap(buildingState.storage),
        storageEnhanced: createDrugLabAmountMap(buildingState.storageEnhanced),
        storedTotal,
        storageCapacity,
        pharmacySupplies,
        availableQueuedSupplies,
        queuedSupplyDemand,
        currentProductionMultiplier: core.getProductionMultiplier(now),
        ownedWarehouseCount,
        storageCapacityBonusPct,
        playerActiveEffects: Object.entries(player.activeDrugEffects || {})
          .map(([key, effect]) => {
            const active = Boolean(effect?.active && now < Number(effect?.endsAt || 0));
            return {
              key,
              name: getDrugLabEffectLabel(key),
              active,
              remainingMs: active ? Math.max(0, Number(effect.endsAt || 0) - now) : 0,
              potencyMultiplier: Number(effect?.potencyMultiplier || 1)
            };
          })
          .filter((entry) => entry.active),
        playerStats: {
          totalHeat: Math.max(0, Math.floor(Number(playerState.totalHeat || 0)))
        },
        ownedLabCount,
        networkProductionBonusPct,
        primaryContext: activeContext,
        primaryDistrictId: activeDistrict?.id ?? null,
        hourlyCleanIncome: incomeRates.hourlyCleanIncome,
        hourlyDirtyIncome: incomeRates.hourlyDirtyIncome,
        hourlyTotalIncome: incomeRates.hourlyTotalIncome
      }
    };
  }

  function runDrugLabAction(action, activeContext, payload = {}) {
    const inputDistrict = activeContext?.district || null;
    const inputContext = activeContext?.context || null;
    if (!inputContext) {
      return { ok: false, message: "Drug Lab: není aktivní detail budovy." };
    }
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    const primaryTarget = resolvePrimaryOwnedDrugLabTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const sync = runDrugLabTick(context, district, now);
    const { core, player, building, inventory } = sync;
    let result = null;
    const onboardingState = window.Empire.Onboarding?.getState?.();
    const onboardingProductionActive = Boolean(onboardingState?.active) && onboardingState.stepId === "production";

    if (action === "collect") {
      const collected = core.collectDrugs();
      if (collected.total <= 0) {
        result = { ok: false, message: "Drug Lab: ve skladu není nic k vybrání." };
      } else {
        DRUG_LAB_DRUG_KEYS.forEach((key) => {
          inventory[key] = Math.max(0, Math.floor(Number(inventory[key] || 0) + Number(collected.collected[key] || 0)));
          player.enhancedDrugs[key] = Math.max(
            0,
            Math.floor(Number(player.enhancedDrugs[key] || 0) + Number(collected.collectedEnhanced[key] || 0))
          );
        });
        result = {
          ok: true,
          message:
            `Drug Lab: vybráno ${collected.total} dávek do zásob hráče`
            + ` (${DRUG_LAB_DRUG_KEYS.map((key) => `${DRUG_CONFIG[key].name} ${collected.collected[key] || 0}`).join(", ")}).`
        };
      }
    } else if (action === "overclock") {
      result = core.useOverclock(player, now);
    } else if (action === "cleanBatch") {
      result = core.useCleanBatch(player, now);
    } else if (action === "hiddenOperation") {
      result = core.useHiddenOperation(player, now);
    } else if (action === "upgrade") {
      result = core.upgradeBuilding(player);
    } else if (action === "slotSelect") {
      const slotId = Math.max(1, Math.floor(Number(payload.slotId) || 0));
      const slot = core.getSlotById(slotId);
      const drugType = String(payload.drugType || "").trim();
      if (!slot) {
        result = { ok: false, message: "Slot neexistuje." };
      } else if (Number(slot.id) > core.getUnlockedSlotCount()) {
        result = { ok: false, message: "Slot je zamčený." };
      } else if (slot.isProducing && Math.max(0, Math.floor(Number(slot.queueRemaining || 0))) > 0) {
        result = { ok: false, message: `Slot ${slot.id}: nejdřív zastav výrobu, pak můžeš změnit drogu.` };
      } else if (!DRUG_CONFIG[drugType]) {
        result = { ok: false, message: "Neznámá droga." };
      } else {
        slot.activeDrugType = drugType;
        slot.lastTick = now;
        slot.productionRemainder = 0;
        result = { ok: true, message: `Slot ${slot.id}: nastavena droga ${DRUG_CONFIG[drugType].name}.`, silentUiEvent: true };
      }
    } else if (action === "slotAmount") {
      const slotId = Math.max(1, Math.floor(Number(payload.slotId) || 0));
      const delta = Math.floor(Number(payload.delta) || 0);
      const slot = core.getSlotById(slotId);
      if (!slot) {
        result = { ok: false, message: "Slot neexistuje." };
      } else if (Number(slot.id) > core.getUnlockedSlotCount()) {
        result = { ok: false, message: "Slot je zamčený." };
      } else if (!delta) {
        result = { ok: false, message: "Neplatná změna množství." };
      } else {
        const minUnits = slot.isProducing ? 0 : 1;
        const currentUnits = slot.isProducing
          ? Math.max(0, Math.floor(Number(slot.queuedUnits || 0)))
          : Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
        slot.queuedUnits = clamp(currentUnits + delta, minUnits, 999);
        result = { ok: true, message: `Slot ${slot.id}: nastaveno ${slot.queuedUnits} dávek.`, silentUiEvent: true };
      }
    } else if (action === "slotStart") {
      const slotId = Math.max(1, Math.floor(Number(payload.slotId) || 0));
      const slot = core.getSlotById(slotId);
      const wasProducing = Boolean(slot?.isProducing && Math.max(0, Math.floor(Number(slot?.queueRemaining || 0))) > 0);
      const selectedDrug = String(payload.drugType || slot?.activeDrugType || "").trim();
      const selectedUnits = clamp(
        Math.floor(Number(payload.units) || Number(slot?.queuedUnits || (wasProducing ? 0 : 1))),
        wasProducing ? 0 : 1,
        999
      );
      const appendedUnits = selectedUnits;
      const supplyCost = getDrugLabSupplyCost(selectedDrug, appendedUnits);
      const availableSupplies = createDrugLabSupplyMap(player.labSupplies || {});
      const hasEnough =
        Number(availableSupplies.chemicals || 0) >= Number(supplyCost.chemicals || 0)
        && Number(availableSupplies.biomass || 0) >= Number(supplyCost.biomass || 0)
        && Number(availableSupplies.stimPack || 0) >= Number(supplyCost.stimPack || 0);
      if (!hasEnough && onboardingProductionActive) {
        player.labSupplies = createDrugLabSupplyMap(player.labSupplies || {});
        player.labSupplies.chemicals = Math.max(
          Number(player.labSupplies.chemicals || 0),
          Number(supplyCost.chemicals || 0)
        );
        player.labSupplies.biomass = Math.max(
          Number(player.labSupplies.biomass || 0),
          Number(supplyCost.biomass || 0)
        );
        player.labSupplies.stimPack = Math.max(
          Number(player.labSupplies.stimPack || 0),
          Number(supplyCost.stimPack || 0)
        );
      }
      const refreshedSupplies = createDrugLabSupplyMap(player.labSupplies || {});
      const canStartNow =
        Number(refreshedSupplies.chemicals || 0) >= Number(supplyCost.chemicals || 0)
        && Number(refreshedSupplies.biomass || 0) >= Number(supplyCost.biomass || 0)
        && Number(refreshedSupplies.stimPack || 0) >= Number(supplyCost.stimPack || 0);
      if (!canStartNow) {
        result = {
          ok: false,
          message:
            `Nedostatek vstupů z Lékárny (potřeba C ${supplyCost.chemicals}, B ${supplyCost.biomass}, S ${supplyCost.stimPack}; `
            + `máš C ${refreshedSupplies.chemicals}, B ${refreshedSupplies.biomass}, S ${refreshedSupplies.stimPack}).`
        };
      } else {
        result = core.startProduction(slotId, selectedDrug, now, selectedUnits);
        if (result?.ok) {
          player.labSupplies = createDrugLabSupplyMap(player.labSupplies || {});
          player.labSupplies.chemicals = Math.max(
            0,
            Math.floor(Number(player.labSupplies.chemicals || 0) - Number(supplyCost.chemicals || 0))
          );
          player.labSupplies.biomass = Math.max(
            0,
            Math.floor(Number(player.labSupplies.biomass || 0) - Number(supplyCost.biomass || 0))
          );
          player.labSupplies.stimPack = Math.max(
            0,
            Math.floor(Number(player.labSupplies.stimPack || 0) - Number(supplyCost.stimPack || 0))
          );
          result.message += ` Spotřeba: C ${supplyCost.chemicals}, B ${supplyCost.biomass}, S ${supplyCost.stimPack}.`;
          if (wasProducing) {
            result.silentUiEvent = true;
          }
          document.dispatchEvent(new CustomEvent("empire:drug-lab-production-started", {
            detail: {
              districtId: district?.id ?? context?.districtId ?? null,
              slotId,
              drugType: selectedDrug,
              units: selectedUnits
            }
          }));
        }
      }
    } else if (action === "slotStop") {
      const slotId = Math.max(1, Math.floor(Number(payload.slotId) || 0));
      result = core.stopProduction(slotId, now);
    } else if (action === "useDrug") {
      const drugType = String(payload.drugType || "").trim();
      result = core.useDrug(drugType, now);
    } else {
      result = { ok: false, message: "Neznámá akce Drug Labu." };
    }

    if (result?.ok) {
      pushDrugLabLog(player, result.message, now, { silentUiEvent: Boolean(result.silentUiEvent) });
    }
    persistDrugLabRuntime(sync, now);
    return result;
  }

  function handleDrugLabBuildingAction(actionId, activeContext) {
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    if (actionId === "1") return runDrugLabAction("overclock", activeContext);
    if (actionId === "2") return runDrugLabAction("cleanBatch", activeContext);
    if (actionId === "3") return runDrugLabAction("hiddenOperation", activeContext);
    if (actionId === "collect") return runDrugLabAction("collect", activeContext);
    if (actionId === "upgrade") return runDrugLabAction("upgrade", activeContext);
    return { ok: false, message: "Neznámá akce Drug Labu." };
  }

  function renderDrugLabDetailPanel(details) {
    const root = document.getElementById("building-detail-drug-lab");
    if (!root) return;
    const mechanics = details?.mechanics;
    const mechanicsType = String(mechanics?.type || "").trim();
    const getProductBadge = (value, explicitKind = "") => {
      const normalized = String(value || "").trim().toLowerCase();
      const kind = String(explicitKind || "").trim().toLowerCase();
      if (kind === "gear") return { tone: "steel", icon: "gear" };
      if (kind === "chip") return { tone: "cyan", icon: "chip" };
      if (kind === "crate") return { tone: "amber", icon: "crate" };
      if (kind === "attack") return { tone: "red", icon: "crosshair" };
      if (kind === "defense") return { tone: "cyan", icon: "shield" };
      if (!normalized) return { tone: "neutral", icon: "dot" };
      if (normalized.includes("stim")) return { tone: "violet", icon: "plus" };
      if (normalized.includes("chem")) return { tone: "cyan", icon: "flask" };
      if (normalized.includes("bio")) return { tone: "green", icon: "leaf" };
      if (normalized.includes("meth")) return { tone: "cyan", icon: "crystal" };
      if (normalized.includes("coke") || normalized.includes("kok")) return { tone: "red", icon: "powder" };
      if (normalized.includes("pill")) return { tone: "amber", icon: "capsule" };
      if (normalized.includes("acid")) return { tone: "violet", icon: "drop" };
      if (normalized.includes("combat module")) return { tone: "amber", icon: "crate" };
      if (normalized.includes("tech core")) return { tone: "cyan", icon: "chip" };
      if (normalized.includes("metal part")) return { tone: "steel", icon: "gear" };
      return { tone: "neutral", icon: "dot" };
    };
    if (
      mechanicsType !== "drug-lab"
      && mechanicsType !== "pharmacy"
      && mechanicsType !== "factory"
      && mechanicsType !== "armory"
      && mechanicsType !== "street-dealers"
    ) {
      root.innerHTML = "";
      root.classList.add("hidden");
      return;
    }

    if (mechanicsType === "street-dealers") {
      const slotRows = (Array.isArray(mechanics.streetDealerSlots) ? mechanics.streetDealerSlots : [])
        .map((slot) => {
          const resourceLabel = String(slot.resourceLabel || slot.resourceKey || "Slot");
          const productBadge = getProductBadge(resourceLabel);
          const queuedUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
          const storedUnits = Math.max(0, Math.floor(Number(slot.storedUnits || 0)));
          const slotCap = Math.max(0, Math.floor(Number(slot.slotCap || 0)));
          const unitsPerHour = Math.max(0, Number(slot.unitsPerHour || 0));
          const unitsPerMinute = unitsPerHour / 60;
          const dirtyCashPerUnit = Math.max(0, Number(slot.dirtyCashPerUnit || 0));
          const dirtyPerHour = Math.max(0, Number(slot.dirtyPerHour || 0));
          const atCap = slotCap > 0 && storedUnits >= slotCap;
          return `
            <article class="pharmacy-slot pharmacy-slot--${productBadge.tone}${storedUnits > 0 ? " pharmacy-slot--active" : " pharmacy-slot--idle"}">
              <div class="pharmacy-slot__head">
                <div class="pharmacy-slot__title-wrap">
                  <div class="pharmacy-slot__title-line">
                    <span class="pharmacy-slot__icon pharmacy-slot__icon--${productBadge.tone} pharmacy-slot__icon--${productBadge.icon}" aria-hidden="true"></span>
                    <strong class="pharmacy-slot__title">${resourceLabel}</strong>
                  </div>
                </div>
                <span class="pharmacy-slot__state">${storedUnits > 0 ? "Prodává" : "Prázdný"}</span>
              </div>
              <div class="pharmacy-slot__metrics">
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Ve slotu</span>
                  <strong class="pharmacy-slot__metric-value">${storedUnits}/${slotCap}</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Rychlost</span>
                  <strong class="pharmacy-slot__metric-value">${formatDecimalValue(unitsPerMinute, 2)} ks/min</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Výnos</span>
                  <strong class="pharmacy-slot__metric-value">$${formatDecimalValue(dirtyPerHour, 2)} D/h</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Cena</span>
                  <strong class="pharmacy-slot__metric-value">$${formatDecimalValue(dirtyCashPerUnit, 2)} / ks</strong>
                </div>
              </div>
              <div class="drug-lab-stepper">
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-street-dealer-slot-id="${slot.id}" data-street-dealer-slot-adjust="-1">-</button>
                <strong class="drug-lab-stepper__value">${queuedUnits}</strong>
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-street-dealer-slot-id="${slot.id}" data-street-dealer-slot-adjust="1">+</button>
              </div>
              <div class="pharmacy-slot__actions">
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--start" type="button" data-street-dealer-slot-load="${slot.id}" ${atCap ? "disabled" : ""}>
                  Vložit
                </button>
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--stop" type="button" data-street-dealer-slot-unload="${slot.id}" ${storedUnits <= 0 ? "disabled" : ""}>
                  Vyjmout
                </button>
              </div>
            </article>
          `;
        })
        .join("");
      const supplies = mechanics.playerDrugInventory || {};
      const ownedStreetDealersCount = Math.max(1, Math.floor(Number(mechanics.ownedStreetDealersCount || 1)));
      root.innerHTML = `
        <section class="drug-lab-card pharmacy-card">
          <div class="pharmacy-stock-grid">
            <div class="pharmacy-stock-card">
              <span class="pharmacy-stock-card__label">Drogy hráče</span>
              <div class="pharmacy-stock-card__values">
                <span>Neon ${Math.max(0, Math.floor(Number(supplies.neonDust || 0)))}</span>
                <span>Pulse ${Math.max(0, Math.floor(Number(supplies.pulseShot || 0)))}</span>
                <span>Velvet ${Math.max(0, Math.floor(Number(supplies.velvetSmoke || 0)))}</span>
              </div>
            </div>
            <div class="pharmacy-stock-card pharmacy-stock-card--accent">
              <span class="pharmacy-stock-card__label">Síť dealerů</span>
              <div class="pharmacy-stock-card__values">
                <span>${ownedStreetDealersCount} budov</span>
                <span>Max +${formatDecimalValue(mechanics.networkMaxCapacityBonusPct || 0, 2)}%</span>
                <span>Rychlost +${formatDecimalValue(mechanics.networkSpeedBonusPct || 0, 2)}%</span>
              </div>
            </div>
          </div>
          <div class="pharmacy-slot-grid street-dealers-slot-grid">
            ${slotRows}
          </div>
        </section>
      `;
      root.classList.remove("hidden");
      return;
    }

    if (mechanicsType === "pharmacy") {
      const slotRows = (Array.isArray(mechanics.slots) ? mechanics.slots : [])
        .map((slot) => {
          const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
          const queuedUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
          const queueRemaining = Math.max(0, Math.floor(Number(slot.queueRemaining || 0)));
          const perHour = formatDecimalValue(slot.perHour || 0, 2);
          const cleanCostPerUnit = Math.max(0, Math.floor(Number(slot.cleanCostPerUnit || 0)));
          const totalCleanCost = cleanCostPerUnit * queuedUnits;
          const productBadge = getProductBadge(slot.resourceLabel);
          const slotCapRaw = Number(slot.slotCap);
          const isSlotAtCap = Number.isFinite(slotCapRaw) && producedAmount >= Math.max(0, Math.floor(slotCapRaw));
          const producedLabel = Number.isFinite(slotCapRaw)
            ? `${producedAmount}/${Math.max(0, Math.floor(slotCapRaw))}`
            : `${producedAmount}`;
          return `
            <article class="pharmacy-slot pharmacy-slot--${productBadge.tone}${slot.isProducing ? " pharmacy-slot--active" : " pharmacy-slot--idle"}">
              <div class="pharmacy-slot__head">
                <div class="pharmacy-slot__title-wrap">
                  <div class="pharmacy-slot__title-line">
                    <span class="pharmacy-slot__icon pharmacy-slot__icon--${productBadge.tone} pharmacy-slot__icon--${productBadge.icon}" aria-hidden="true"></span>
                    <strong class="pharmacy-slot__title">${slot.resourceLabel}</strong>
                  </div>
                </div>
                <span class="pharmacy-slot__state">${slot.isProducing ? "Aktivní" : "Připraven"}</span>
              </div>
              <div class="pharmacy-slot__metrics">
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Rychlost</span>
                  <strong class="pharmacy-slot__metric-value">${perHour}/h</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Vyrobeno</span>
                  <strong class="pharmacy-slot__metric-value">${producedLabel}</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Cena</span>
                  <strong class="pharmacy-slot__metric-value">$${cleanCostPerUnit} / ks</strong>
                </div>
                <div class="pharmacy-slot__metric">
                  <span class="pharmacy-slot__metric-label">Ve frontě</span>
                  <strong class="pharmacy-slot__metric-value">${queueRemaining}</strong>
                </div>
              </div>
              <div class="drug-lab-stepper">
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-pharmacy-slot-id="${slot.id}" data-pharmacy-slot-adjust="-1">-</button>
                <strong class="drug-lab-stepper__value">${queuedUnits}</strong>
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-pharmacy-slot-id="${slot.id}" data-pharmacy-slot-adjust="1">+</button>
              </div>
              <div class="pharmacy-slot__actions">
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--start" type="button" data-pharmacy-slot-start="${slot.id}" ${isSlotAtCap ? "disabled" : ""}>
                  Vyrobit • $${totalCleanCost}
                </button>
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--stop" type="button" data-pharmacy-slot-stop="${slot.id}" ${!slot.isProducing ? "disabled" : ""}>
                  Zastavit
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      const resources = mechanics.resources || {};
      const drugLabSupplies = mechanics.drugLabSupplies || {};
      const internalChemicals = Math.max(0, Math.floor(Number(resources.chemicals || 0)));
      const internalBiomass = Math.max(0, Math.floor(Number(resources.biomass || 0)));
      const internalStimPack = Math.max(0, Math.floor(Number(resources.stimPack || 0)));
      const labChemicals = Math.max(0, Math.floor(Number(drugLabSupplies.chemicals || 0)));
      const labBiomass = Math.max(0, Math.floor(Number(drugLabSupplies.biomass || 0)));
      const labStimPack = Math.max(0, Math.floor(Number(drugLabSupplies.stimPack || 0)));

      root.innerHTML = `
        <section class="drug-lab-card pharmacy-card">
          <div class="pharmacy-stock-grid">
            <div class="pharmacy-stock-card">
              <span class="pharmacy-stock-card__label">Interní sklad Lékárny</span>
              <div class="pharmacy-stock-card__values">
                <span>C ${internalChemicals}</span>
                <span>B ${internalBiomass}</span>
                <span>S ${internalStimPack}</span>
              </div>
            </div>
            <div class="pharmacy-stock-card pharmacy-stock-card--accent">
              <span class="pharmacy-stock-card__label">Zásoby Drug Labu</span>
              <div class="pharmacy-stock-card__values">
                <span>C ${labChemicals}</span>
                <span>B ${labBiomass}</span>
                <span>S ${labStimPack}</span>
              </div>
            </div>
          </div>
          <div class="pharmacy-slot-grid">
            ${slotRows}
          </div>
        </section>
      `;
      root.classList.remove("hidden");
      return;
    }

    if (mechanicsType === "factory") {
      const slotRows = (Array.isArray(mechanics.slots) ? mechanics.slots : [])
        .map((slot) => {
          const isCraftSlot = String(slot.mode || "").trim() === "craft";
          const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
          const isSlotAtCap = Number.isFinite(Number(slot.slotCap))
            ? producedAmount >= Math.max(0, Math.floor(Number(slot.slotCap || FACTORY_SLOT_STORAGE_CAP)))
            : producedAmount >= FACTORY_SLOT_STORAGE_CAP;
          const productBadge = getProductBadge(
            slot.resourceLabel,
            isCraftSlot
              ? "crate"
              : String(slot.resourceKey || "").trim() === "techCore"
                ? "chip"
                : "gear"
          );
          const slotCap = Math.max(0, Math.floor(Number(slot.slotCap || FACTORY_SLOT_STORAGE_CAP)));
          const producedLabel = isCraftSlot
            ? formatDurationLabel(slot.effectiveDurationMs || FACTORY_CONFIG.combatModule.durationMs)
            : `${producedAmount}/${slotCap || FACTORY_SLOT_STORAGE_CAP}`;
          return `
            <article class="factory-slot${slot.isProducing ? " factory-slot--active" : ""}">
              <div class="factory-slot__head">
                <div class="factory-slot__title-wrap">
                  <span class="drug-production-slot__icon drug-production-slot__icon--${productBadge.tone} drug-production-slot__icon--${productBadge.icon}" aria-hidden="true"></span>
                  <div class="drug-production-slot__titles">
                    <strong class="drug-production-slot__title">${slot.resourceLabel}</strong>
                  </div>
                </div>
                <span class="drug-production-slot__state">${slot.isProducing ? "Produkuje" : isSlotAtCap ? "Plný" : "Připraven"}</span>
              </div>
              <div class="drug-production-slot__metrics">
                <div class="drug-production-slot__metric">
                  <span class="drug-production-slot__metric-label">${isCraftSlot ? "Recept" : "Rychlost"}</span>
                  <strong class="drug-production-slot__metric-value${isCraftSlot ? " factory-slot__recipe-value" : ""}">${isCraftSlot ? `<span class="factory-slot__recipe-line">4 MP</span><span class="factory-slot__recipe-line factory-slot__recipe-line--secondary">+ 3 TC</span>` : `${formatDecimalValue(slot.perHour || 0, 2)}/h`}</strong>
                </div>
                <div class="drug-production-slot__metric">
                  <span class="drug-production-slot__metric-label">${isCraftSlot ? "Čas / kus" : "Vyrobeno"}</span>
                  <strong class="drug-production-slot__metric-value">${producedLabel}</strong>
                </div>
                <div class="drug-production-slot__metric">
                  <span class="drug-production-slot__metric-label">Cena</span>
                  <strong class="drug-production-slot__metric-value factory-slot__price-value">$20</strong>
                </div>
              </div>
              <div class="factory-slot__actions">
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--start" type="button" data-factory-slot-start="${slot.id}" ${slot.isProducing ? "disabled" : ""}>
                  Spustit
                </button>
                <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--stop" type="button" data-factory-slot-stop="${slot.id}" ${!slot.isProducing ? "disabled" : ""}>
                  Zastavit
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      const resources = mechanics.resources || {};
      const playerSupplies = mechanics.playerSupplies || {};

      root.innerHTML = `
        <section class="drug-lab-card drug-production-card factory-card">
          <div class="drug-production-card__stats">
            <div class="drug-production-stat">
              <span class="drug-production-stat__label">Interní sklad Továrny</span>
              <strong class="drug-production-stat__value">MP ${Math.max(0, Math.floor(Number(resources.metalParts || 0)))} • TC ${Math.max(0, Math.floor(Number(resources.techCore || 0)))} • CM ${Math.max(0, Math.floor(Number(resources.combatModule || 0)))}</strong>
              <small class="drug-production-stat__meta">aktuálně vyrobené zásoby budovy</small>
            </div>
            <div class="drug-production-stat">
              <span class="drug-production-stat__label">Sklad hráče</span>
              <strong class="drug-production-stat__value">MP ${Math.max(0, Math.floor(Number(playerSupplies.metalParts || 0)))} • TC ${Math.max(0, Math.floor(Number(playerSupplies.techCore || 0)))} • CM ${Math.max(0, Math.floor(Number(playerSupplies.combatModule || 0)))}</strong>
              <small class="drug-production-stat__meta">materiály dostupné mimo budovu</small>
            </div>
          </div>
          <div class="factory-slot-grid">
            ${slotRows}
          </div>
        </section>
      `;
      root.classList.remove("hidden");
      return;
    }

    if (mechanicsType === "armory") {
      const sourceSlots = Array.isArray(mechanics.slots) ? mechanics.slots : [];
      const attackSlots = Array.isArray(mechanics.attackSlots)
        ? mechanics.attackSlots
        : sourceSlots.filter((slot) => String(slot.category || "").trim() !== "defense");
      const defenseSlots = Array.isArray(mechanics.defenseSlots)
        ? mechanics.defenseSlots
        : sourceSlots.filter((slot) => String(slot.category || "").trim() === "defense");
      const playerMaterials = mechanics.playerMaterials || {};
      const renderSlotRows = (slots) => slots
        .map((slot) => {
          const slotBadge = getProductBadge(slot.weaponName, String(slot.category || "").trim() === "defense" ? "defense" : "attack");
          return `
          <article class="armory-slot${slot.isProducing ? " armory-slot--active" : ""}">
              <div class="armory-slot__head">
              <div class="armory-slot__title-wrap">
                <span class="drug-production-slot__icon drug-production-slot__icon--${slotBadge.tone} drug-production-slot__icon--${slotBadge.icon}" aria-hidden="true"></span>
                <div class="drug-production-slot__titles">
                  <strong class="drug-production-slot__title">${slot.weaponName}</strong>
                </div>
              </div>
              <span class="drug-production-slot__state">${slot.isProducing ? "Produkuje" : "Připraven"}</span>
            </div>
            <div class="drug-production-slot__metrics">
              <div class="drug-production-slot__metric">
                <span class="drug-production-slot__metric-label">Vyrobeno</span>
                <strong class="drug-production-slot__metric-value armory-slot__produced-value">
                  ${Math.max(0, Math.floor(Number(slot.producedAmount || 0)))}/${ARMORY_BATCH_MAX_UNITS}
                </strong>
              </div>
              <div class="drug-production-slot__metric">
                <span class="drug-production-slot__metric-label">Ve frontě</span>
                <strong class="drug-production-slot__metric-value armory-slot__queue-value">
                  ${Math.max(0, Math.floor(Number(slot.remainingUnits || 0)))}
                </strong>
              </div>
              <div class="drug-production-slot__metric">
                <span class="drug-production-slot__metric-label">Čas / kus</span>
                <strong class="drug-production-slot__metric-value">${formatProductionDurationLabel(slot.effectiveDurationMs || slot.durationMs)}</strong>
              </div>
              <div class="drug-production-slot__metric drug-production-slot__metric--supplies">
                <span class="drug-production-slot__metric-label">Recept / dávka</span>
                <div class="armory-slot__materials-row">
                  <span class="armory-slot__material-pill armory-slot__material-pill--metal">
                    <span class="armory-slot__material-name">Metal Parts</span>
                    <strong class="armory-slot__material-value">${Math.max(0, Math.floor(Number(slot.metalPartsCost || 0)))}</strong>
                  </span>
                  <span class="armory-slot__material-pill armory-slot__material-pill--tech">
                    <span class="armory-slot__material-name">Tech Core</span>
                    <strong class="armory-slot__material-value">${Math.max(0, Math.floor(Number(slot.techCoreCost || 0)))}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div class="drug-production-slot__controls">
              <div class="drug-lab-stepper">
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-armory-slot-id="${slot.id}" data-armory-slot-adjust="-1">-</button>
                <strong class="drug-lab-stepper__value">${Math.max(1, Math.floor(Number(slot.queuedUnits || 1)))}</strong>
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-armory-slot-id="${slot.id}" data-armory-slot-adjust="1">+</button>
              </div>
              <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--start" type="button" data-armory-slot-start="${slot.id}" ${
                ((!slot.canAffordQueue) || (slot.isProducing && slot.batchAtMax)) ? "disabled" : ""
              }>
                ${slot.isProducing ? "Přidat" : "Spustit"}
              </button>
              <button class="drug-lab-mini-btn pharmacy-slot__btn pharmacy-slot__btn--stop" type="button" data-armory-slot-stop="${slot.id}" ${!slot.isProducing ? "disabled" : ""}>
                Zastavit
              </button>
            </div>
          </article>
        `;
        })
        .join("");
      const attackRows = renderSlotRows(attackSlots);
      const defenseRows = renderSlotRows(defenseSlots);
      const storedWeapons = mechanics.storedWeapons || {};
      const attackStoredLabel = ARMORY_ATTACK_WEAPON_KEYS
        .map((weaponKey) => {
          const count = Math.max(0, Math.floor(Number(storedWeapons[weaponKey] || 0)));
          const short =
            weaponKey === "baseballBat" ? "BP"
            : weaponKey === "streetPistol" ? "PP"
            : weaponKey === "grenade" ? "GR"
            : weaponKey === "smg" ? "SM"
            : weaponKey === "bazooka" ? "BZ"
            : weaponKey.toUpperCase();
          return `${short} ${count}`;
        })
        .join(" • ");
      const defenseStoredLabel = ARMORY_DEFENSE_WEAPON_KEYS
        .map((weaponKey) => {
          const count = Math.max(0, Math.floor(Number(storedWeapons[weaponKey] || 0)));
          const short =
            weaponKey === "bulletproofVest" ? "NV"
            : weaponKey === "steelBarricades" ? "OB"
            : weaponKey === "securityCameras" ? "BK"
            : weaponKey === "autoMgNest" ? "AKS"
            : weaponKey === "alarmSystem" ? "Alarm"
            : weaponKey.toUpperCase();
          return `${short} ${count}`;
        })
        .join(" • ");
      const metalPartsInStorage = Math.max(0, Math.floor(Number(playerMaterials.metalParts || 0)));
      const techCoreInStorage = Math.max(0, Math.floor(Number(playerMaterials.techCore || 0)));

      root.innerHTML = `
        <section class="drug-lab-card drug-production-card armory-card">
          <div class="drug-production-card__stats">
            <div class="drug-production-stat">
              <span class="drug-production-stat__label">Vyrobené útočné zbraně</span>
              <strong class="drug-production-stat__value">${attackStoredLabel}</strong>
            </div>
            <div class="drug-production-stat">
              <span class="drug-production-stat__label">Vyrobené obranné zbraně</span>
              <strong class="drug-production-stat__value">${defenseStoredLabel}</strong>
            </div>
          </div>
        </section>
        <section class="drug-lab-card drug-production-card armory-card armory-card--materials-sticky">
          <div class="drug-production-card__stats armory-card__materials-stats">
            <div class="drug-production-stat armory-material-stat">
              <span class="drug-production-stat__label">Metal Parts</span>
              <strong class="drug-production-stat__value">${metalPartsInStorage}</strong>
            </div>
            <div class="drug-production-stat armory-material-stat">
              <span class="drug-production-stat__label">Tech Core</span>
              <strong class="drug-production-stat__value">${techCoreInStorage}</strong>
            </div>
          </div>
        </section>
        <div class="armory-layout">
          <div class="drug-lab-card armory-card armory-card--section armory-card--attack">
            <div class="pharmacy-slot-grid">
              ${attackRows}
            </div>
          </div>
          <div class="drug-lab-card armory-card armory-card--section armory-card--defense">
            <div class="pharmacy-slot-grid">
              ${defenseRows}
            </div>
          </div>
        </div>
      `;
      root.classList.remove("hidden");
      return;
    }

    const slotRows = (Array.isArray(mechanics.slots) ? mechanics.slots : [])
      .map((slot) => {
        const options = DRUG_LAB_DRUG_KEYS
          .map((key) =>
            `<option value="${key}" ${slot.activeDrugType === key ? "selected" : ""}>${DRUG_CONFIG[key].name}</option>`
          )
          .join("");
        const activeDrugName = DRUG_CONFIG[String(slot.activeDrugType || "").trim()]?.name || "Není vybráno";
        const productBadge = getProductBadge(activeDrugName);
        if (!slot.unlocked) {
          return `
            <article class="drug-production-slot drug-production-slot--locked">
              <div class="drug-production-slot__head">
                <div class="drug-production-slot__title-wrap">
                  <span class="drug-production-slot__icon drug-production-slot__icon--neutral drug-production-slot__icon--dot" aria-hidden="true"></span>
                  <strong class="drug-production-slot__title">Zamčená výrobní linka</strong>
                </div>
                <span class="drug-production-slot__state">Zamčeno</span>
              </div>
              <div class="drug-production-slot__empty">Odemkneš na vyšším levelu Drug Labu.</div>
            </article>
          `;
        }
        return `
          <article class="drug-production-slot${slot.isProducing ? " drug-production-slot--active" : ""}">
              <div class="drug-production-slot__head">
                <div class="drug-production-slot__title-wrap">
                  <span class="drug-production-slot__icon drug-production-slot__icon--${productBadge.tone} drug-production-slot__icon--${productBadge.icon}" aria-hidden="true"></span>
                  <div class="drug-production-slot__titles">
                    <strong class="drug-production-slot__title">${activeDrugName}</strong>
                  </div>
                </div>
              <span class="drug-production-slot__state">${slot.isProducing ? "Produkuje" : "Připraven"}</span>
            </div>
            <div class="drug-production-slot__metrics">
              <div class="drug-production-slot__metric drug-production-slot__metric--inline">
                <span class="drug-production-slot__metric-label">
                  Vyrobeno
                  <strong class="drug-production-slot__metric-inline-value">${slot.producedAmount}</strong>
                </span>
              </div>
              <div class="drug-production-slot__metric drug-production-slot__metric--inline">
                <span class="drug-production-slot__metric-label">
                  Ve frontě
                  <strong class="drug-production-slot__metric-inline-value">${Math.max(0, Math.floor(Number(slot.queueRemaining || 0)))}</strong>
                </span>
              </div>
              <div class="drug-production-slot__metric drug-production-slot__metric--inline">
                <span class="drug-production-slot__metric-label">
                  Nastaveno
                  <strong class="drug-production-slot__metric-inline-value">${slot.isProducing ? Math.max(0, Math.floor(Number(slot.queuedUnits || 0))) : Math.max(1, Math.floor(Number(slot.queuedUnits || 1)))}</strong>
                </span>
              </div>
              <div class="drug-production-slot__metric drug-production-slot__metric--supplies">
                <span class="drug-production-slot__metric-label">Vstupy / dávka</span>
                <div class="drug-production-slot__supply-row">
                  <span class="drug-production-slot__supply-pill drug-production-slot__supply-pill--chemicals">
                    <span class="drug-production-slot__supply-name">Chemicals</span>
                    <strong class="drug-production-slot__supply-value">${Math.max(0, Math.floor(Number(slot.supplyCost?.chemicals || 0)))}</strong>
                  </span>
                  <span class="drug-production-slot__supply-pill drug-production-slot__supply-pill--biomass">
                    <span class="drug-production-slot__supply-name">Biomass</span>
                    <strong class="drug-production-slot__supply-value">${Math.max(0, Math.floor(Number(slot.supplyCost?.biomass || 0)))}</strong>
                  </span>
                  <span class="drug-production-slot__supply-pill drug-production-slot__supply-pill--stim">
                    <span class="drug-production-slot__supply-name">Stim Pack</span>
                    <strong class="drug-production-slot__supply-value">${Math.max(0, Math.floor(Number(slot.supplyCost?.stimPack || 0)))}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div class="drug-production-slot__controls">
              <select data-drug-lab-slot-select="${slot.id}" ${slot.isProducing ? "disabled" : ""}>
                ${options}
              </select>
              <div class="drug-lab-stepper">
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-drug-lab-slot-id="${slot.id}" data-drug-lab-slot-adjust="-1">-</button>
                <strong class="drug-lab-stepper__value">${slot.isProducing ? Math.max(0, Math.floor(Number(slot.queuedUnits || 0))) : Math.max(1, Math.floor(Number(slot.queuedUnits || 1)))}</strong>
                <button class="drug-lab-mini-btn drug-lab-mini-btn--step" type="button" data-drug-lab-slot-id="${slot.id}" data-drug-lab-slot-adjust="1">+</button>
              </div>
              <button class="drug-lab-mini-btn" type="button" data-drug-lab-slot-start="${slot.id}" ${
                ""
              }>
                ${slot.isProducing ? "Přidat" : "Start"}
              </button>
              <button class="drug-lab-mini-btn" type="button" data-drug-lab-slot-stop="${slot.id}" ${
                !slot.isProducing ? "disabled" : ""
              }>
                Stop
              </button>
            </div>
          </article>
        `;
      })
      .join("");
    const ownedLabCount = Math.max(1, Math.floor(Number(mechanics.ownedLabCount || 1)));
    const networkProductionBonusPct = Math.max(0, Number(mechanics.networkProductionBonusPct || 0));
    const ownedLabLabel = ownedLabCount === 1
      ? "budova"
      : (ownedLabCount >= 2 && ownedLabCount <= 4 ? "budovy" : "budov");
    const networkStatusLabel =
      `Síť Drug Labů: ${ownedLabCount} ${ownedLabLabel} (+${formatDecimalValue(networkProductionBonusPct, 2)}% produkce)`;
    const ownedWarehouseCount = Math.max(0, Math.floor(Number(mechanics.ownedWarehouseCount || 0)));
    const storageCapacityBonusPct = Math.max(0, Number(mechanics.storageCapacityBonusPct || 0));
    const ownedWarehouseLabel = ownedWarehouseCount === 1
      ? "sklad"
      : (ownedWarehouseCount >= 2 && ownedWarehouseCount <= 4 ? "sklady" : "skladů");
    const warehouseStatusLabel = ownedWarehouseCount > 0
      ? `Sklady v území: ${ownedWarehouseCount} ${ownedWarehouseLabel} (+${formatDecimalValue(storageCapacityBonusPct, 2)}% kapacita)`
      : "Sklady v území: 0 (bez bonusu kapacity)";
    const pharmacySupplies = mechanics.pharmacySupplies || {};
    const availableQueuedSupplies = mechanics.availableQueuedSupplies || pharmacySupplies;
    const queuedSupplyDemand = mechanics.queuedSupplyDemand || createDrugLabSupplyMap();
    const supplyStatusLabel =
      `Vstup z Lékárny: C ${Math.max(0, Math.floor(Number(availableQueuedSupplies.chemicals || 0)))} • `
      + `B ${Math.max(0, Math.floor(Number(availableQueuedSupplies.biomass || 0)))} • `
      + `S ${Math.max(0, Math.floor(Number(availableQueuedSupplies.stimPack || 0)))}`;
    const storageStatusLabel =
      `Interní sklad: ${Math.max(0, Math.floor(Number(mechanics.storedTotal || 0)))}/${Math.max(1, Math.floor(Number(mechanics.storageCapacity || 0)))}`;

    const effectsRows = Array.isArray(mechanics.playerActiveEffects) && mechanics.playerActiveEffects.length
      ? mechanics.playerActiveEffects
        .map((effect) => `
          <div class="drug-lab-list__item">
            <span>${effect.name}</span>
            <span class="drug-lab-list__value">${formatDurationLabel(effect.remainingMs)}</span>
            <small>${effect.potencyMultiplier > 1 ? `síla x${formatDecimalValue(effect.potencyMultiplier, 2)}` : "standard"}</small>
          </div>
        `)
        .join("")
      : `<div class="drug-lab-list__item"><span>Žádné aktivní efekty</span><span class="drug-lab-list__value">-</span><small>-</small></div>`;

    root.innerHTML = `
      <section class="drug-lab-card drug-production-card">
        <div class="drug-production-card__header">
          <div>
            <p class="drug-production-card__subtitle">Řízení výroby, spotřeby vstupů a kapacity skladu.</p>
          </div>
        </div>
        <div class="drug-production-card__stats">
          <div class="drug-production-stat">
            <span class="drug-production-stat__label">Síť Drug Labů</span>
            <strong class="drug-production-stat__value">${ownedLabCount} ${ownedLabLabel}</strong>
            <small class="drug-production-stat__meta">+${formatDecimalValue(networkProductionBonusPct, 2)}% produkce</small>
          </div>
          <div class="drug-production-stat">
            <span class="drug-production-stat__label">Interní sklad</span>
            <strong class="drug-production-stat__value">${Math.max(0, Math.floor(Number(mechanics.storedTotal || 0)))}/${Math.max(1, Math.floor(Number(mechanics.storageCapacity || 0)))}</strong>
            <small class="drug-production-stat__meta">zastaví výrobu při naplnění</small>
          </div>
          <div class="drug-production-stat">
            <span class="drug-production-stat__label">Vstup z Lékárny</span>
            <strong class="drug-production-stat__value">C ${Math.max(0, Math.floor(Number(availableQueuedSupplies.chemicals || 0)))} • B ${Math.max(0, Math.floor(Number(availableQueuedSupplies.biomass || 0)))} • S ${Math.max(0, Math.floor(Number(availableQueuedSupplies.stimPack || 0)))}</strong>
            <small class="drug-production-stat__meta">rezervace ve frontě: C ${Math.max(0, Math.floor(Number(queuedSupplyDemand.chemicals || 0)))} • B ${Math.max(0, Math.floor(Number(queuedSupplyDemand.biomass || 0)))} • S ${Math.max(0, Math.floor(Number(queuedSupplyDemand.stimPack || 0)))}</small>
          </div>
          <div class="drug-production-stat">
            <span class="drug-production-stat__label">Sklady v území</span>
            <strong class="drug-production-stat__value">${ownedWarehouseCount} ${ownedWarehouseLabel}</strong>
            <small class="drug-production-stat__meta">${ownedWarehouseCount > 0 ? `+${formatDecimalValue(storageCapacityBonusPct, 2)}% kapacita` : "bez bonusu kapacity"}</small>
          </div>
        </div>
        <div class="pharmacy-slot-grid">
          ${slotRows}
        </div>
      </section>

      <div class="drug-lab-card">
        <div class="drug-lab-list">${effectsRows}</div>
      </div>
      <div class="drug-lab-card">
        <p class="drug-lab-card__meta">
          Výroba se zastaví po naplnění interního skladu, potom je potřeba použít tlačítko Vybrat drogy.
        </p>
      </div>
    `;

    root.classList.remove("hidden");
    const activeDetail = state.activeBuildingDetail || null;
    const detailDistrict = activeDetail?.district || null;
    const detailContext = activeDetail?.context || null;
    document.dispatchEvent(new CustomEvent("empire:building-detail-opened", {
      detail: {
        districtId: detailDistrict?.id ?? detailContext?.districtId ?? null,
        district: detailDistrict,
        context: detailContext,
        details
      }
    }));
  }

  function handleDrugLabInlineControl(target, activeContext) {
    if (isPoliceRaidAllActionsBlocked(Date.now())) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané.", silentUiEvent: true };
    }
    const amountBtn = target.closest("[data-drug-lab-slot-adjust][data-drug-lab-slot-id]");
    if (amountBtn instanceof HTMLElement) {
      const slotId = Number(amountBtn.dataset.drugLabSlotId || 0);
      const delta = Number(amountBtn.dataset.drugLabSlotAdjust || 0);
      return runDrugLabAction("slotAmount", activeContext, { slotId, delta });
    }

    const select = target.closest("[data-drug-lab-slot-select]");
    if (select instanceof HTMLSelectElement) {
      const slotId = Number(select.dataset.drugLabSlotSelect || 0);
      const drugType = String(select.value || "").trim();
      return runDrugLabAction("slotSelect", activeContext, { slotId, drugType });
    }

    const startBtn = target.closest("[data-drug-lab-slot-start]");
    if (startBtn instanceof HTMLElement) {
      const slotId = Number(startBtn.dataset.drugLabSlotStart || 0);
      return runDrugLabAction("slotStart", activeContext, { slotId });
    }

    const stopBtn = target.closest("[data-drug-lab-slot-stop]");
    if (stopBtn instanceof HTMLElement) {
      const slotId = Number(stopBtn.dataset.drugLabSlotStop || 0);
      return runDrugLabAction("slotStop", activeContext, { slotId });
    }

    return null;
  }

  function handlePharmacyInlineControl(target, activeContext) {
    const now = Date.now();
    const inputContext = activeContext?.context || null;
    const inputDistrict = activeContext?.district || null;
    if (!inputContext) return null;
    const primaryTarget = resolvePrimaryOwnedPharmacyTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané.", silentUiEvent: true };
    }
    const instanceKey = resolveBuildingInstanceKey(context, district);
    const snapshot = getPharmacyStateByKey(instanceKey, now);
    syncPharmacyProduction(snapshot, now);

    const adjustBtn = target.closest("[data-pharmacy-slot-adjust][data-pharmacy-slot-id]");
    if (adjustBtn instanceof HTMLElement) {
      const slotId = Math.max(1, Math.floor(Number(adjustBtn.dataset.pharmacySlotId) || 0));
      const delta = Math.floor(Number(adjustBtn.dataset.pharmacySlotAdjust) || 0);
      const slot = (Array.isArray(snapshot.slots) ? snapshot.slots : []).find((entry) => Number(entry.id) === slotId) || null;
      if (!slot || !delta) {
        persistPharmacyState(instanceKey, snapshot);
        return { ok: false, message: "Slot Lékárny neexistuje.", silentUiEvent: true };
      }
      const currentUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
      const nextUnits = clamp(currentUnits + delta, 1, 999);
      slot.queuedUnits = nextUnits;
      persistPharmacyState(instanceKey, snapshot);
      return {
        ok: true,
        message: `Lékárna slot ${slotId}: nastaveno ${nextUnits} ks.`,
        silentUiEvent: true
      };
    }

    const setSlotState = (slotId, shouldProduce) => {
      const safeSlotId = Math.max(1, Math.floor(Number(slotId) || 0));
      const slot = (Array.isArray(snapshot.slots) ? snapshot.slots : []).find((entry) => Number(entry.id) === safeSlotId) || null;
      if (!slot) {
        persistPharmacyState(instanceKey, snapshot);
        return { ok: false, message: "Slot Lékárny neexistuje." };
      }
      const resourceKey = PHARMACY_RESOURCE_KEYS.includes(String(slot.resourceKey || "").trim()) ? String(slot.resourceKey).trim() : null;
      const capRaw = resourceKey ? Number(PHARMACY_CONFIG.slotStorageCaps?.[resourceKey]) : Number.NaN;
      const hasCap = Number.isFinite(capRaw);
      const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
      const resourceAmount = resourceKey ? Math.max(0, Math.floor(Number(snapshot.resources?.[resourceKey] || 0))) : 0;
      if (hasCap && producedAmount >= Math.floor(capRaw) && resourceAmount < producedAmount) {
        slot.isProducing = false;
      }
      if (shouldProduce) {
        const resourceKey = PHARMACY_RESOURCE_KEYS.includes(String(slot.resourceKey || "").trim()) ? String(slot.resourceKey).trim() : null;
        const unitCost = resourceKey ? Math.max(0, Math.floor(Number(PHARMACY_UNIT_CLEAN_COST[resourceKey] || 0))) : 0;
        const cap = hasCap ? Math.max(0, Math.floor(capRaw)) : Number.POSITIVE_INFINITY;
        const queuedCurrent = Math.max(0, Math.floor(Number(slot.queueRemaining || 0)));
        const currentUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
        const freeSpace = Math.max(0, cap - producedAmount - queuedCurrent);
        const requestedUnits = Math.max(0, Math.min(currentUnits, freeSpace));
        if (requestedUnits <= 0) {
          persistPharmacyState(instanceKey, snapshot);
          return { ok: false, message: `Slot ${safeSlotId} nemá místo pro další výrobu.` };
        }
        const totalCost = requestedUnits * unitCost;
        const spendCleanCash = window.Empire.UI?.trySpendCleanCash;
        if (typeof spendCleanCash !== "function") {
          persistPharmacyState(instanceKey, snapshot);
          return { ok: false, message: "Lékárna: chybí ekonomický modul pro clean cash." };
        }
        const spendResult = spendCleanCash(totalCost);
        if (!spendResult?.ok) {
          persistPharmacyState(instanceKey, snapshot);
          return { ok: false, message: `Nedostatek clean cash (potřeba $${totalCost}).` };
        }
        if (hasCap && producedAmount >= Math.floor(capRaw)) {
          persistPharmacyState(instanceKey, snapshot);
          return { ok: false, message: `Slot ${safeSlotId} je plný. Nejprve vyber suroviny do skladu.` };
        }
        if (slot.isProducing && queuedCurrent > 0) {
          slot.queueRemaining = queuedCurrent + requestedUnits;
          slot.queuedUnits = 1;
          slot.lastTick = now;
          persistPharmacyState(instanceKey, snapshot);
          return {
            ok: true,
            message: `Lékárna slot ${safeSlotId}: do fronty přidáno ${requestedUnits} ks za $${totalCost}.`
          };
        }
        slot.isProducing = true;
        slot.queuedUnits = 0;
        slot.queueRemaining = requestedUnits;
        slot.lastTick = now;
        slot.productionRemainder = 0;
        persistPharmacyState(instanceKey, snapshot);
        return { ok: true, message: `Lékárna slot ${safeSlotId}: výroba spuštěna (${requestedUnits} ks) za $${totalCost}.` };
      }
      if (!slot.isProducing) {
        persistPharmacyState(instanceKey, snapshot);
        return { ok: false, message: `Slot ${safeSlotId} neběží.` };
      }
      const refundUnits = Math.max(0, Math.floor(Number(slot.queueRemaining || 0)));
      const refundUnitCost = resourceKey ? Math.max(0, Math.floor(Number(PHARMACY_UNIT_CLEAN_COST[resourceKey] || 0))) : 0;
      const refundTotal = refundUnits * refundUnitCost;
      const refundCleanCash = window.Empire.UI?.addCleanCash;
      if (refundTotal > 0 && typeof refundCleanCash === "function") {
        refundCleanCash(refundTotal);
      }
      slot.isProducing = false;
      slot.queueRemaining = 0;
      slot.queuedUnits = 1;
      slot.productionRemainder = 0;
      slot.lastTick = now;
      persistPharmacyState(instanceKey, snapshot);
      return {
        ok: true,
        message: refundTotal > 0
          ? `Lékárna slot ${safeSlotId}: výroba zastavena. Vráceno $${refundTotal} clean cash za ${refundUnits} ks z fronty.`
          : `Lékárna slot ${safeSlotId}: výroba zastavena.`
      };
    };

    const startBtn = target.closest("[data-pharmacy-slot-start]");
    if (startBtn instanceof HTMLElement) {
      const slotId = Number(startBtn.dataset.pharmacySlotStart || 0);
      return setSlotState(slotId, true);
    }
    const stopBtn = target.closest("[data-pharmacy-slot-stop]");
    if (stopBtn instanceof HTMLElement) {
      const slotId = Number(stopBtn.dataset.pharmacySlotStop || 0);
      return setSlotState(slotId, false);
    }
    return null;
  }

  function handleStreetDealersInlineControl(target, activeContext) {
    const now = Date.now();
    const context = activeContext?.context || null;
    const district = activeContext?.district || null;
    if (!context) return null;
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané.", silentUiEvent: true };
    }
    const instanceKey = resolveBuildingInstanceKey(context, district);
    const snapshot = getSimpleCashBuildingStateByKey(instanceKey, now);
    const ownedStreetDealersCount = getOwnedStreetDealersCount();
    syncStreetDealerSales(snapshot, now, { ownedStreetDealersCount });
    applyStreetDealerPassiveHeatTick(snapshot, now);
    const networkEffects = getStreetDealerNetworkEffects(ownedStreetDealersCount);
    const fallbackSlots = createStreetDealerDefaultSlots(now);
    const currentSlots = Array.isArray(snapshot.streetDealerSlots) ? snapshot.streetDealerSlots : [];
    snapshot.streetDealerSlots = fallbackSlots.map((fallbackSlot, index) =>
      sanitizeStreetDealerSlot(currentSlots[index], fallbackSlot, now)
    );

    const adjustBtn = target.closest("[data-street-dealer-slot-adjust][data-street-dealer-slot-id]");
    if (adjustBtn instanceof HTMLElement) {
      const slotId = Math.max(1, Math.floor(Number(adjustBtn.dataset.streetDealerSlotId) || 0));
      const delta = Math.floor(Number(adjustBtn.dataset.streetDealerSlotAdjust) || 0);
      const slot = snapshot.streetDealerSlots.find((entry) => Number(entry.id) === slotId) || null;
      if (!slot || !delta) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: "Slot dealerů neexistuje.", silentUiEvent: true };
      }
      const nextUnits = clamp(Math.max(1, Math.floor(Number(slot.queuedUnits || 1))) + delta, 1, 999);
      slot.queuedUnits = nextUnits;
      persistSimpleCashBuildingState(instanceKey, snapshot);
      return { ok: true, message: `Pouliční dealeři slot ${slotId}: nastaveno ${nextUnits} ks.`, silentUiEvent: true };
    }

    const loadBtn = target.closest("[data-street-dealer-slot-load]");
    if (loadBtn instanceof HTMLElement) {
      const slotId = Math.max(1, Math.floor(Number(loadBtn.dataset.streetDealerSlotLoad) || 0));
      const slot = snapshot.streetDealerSlots.find((entry) => Number(entry.id) === slotId) || null;
      if (!slot) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: "Slot dealerů neexistuje." };
      }
      const slotConfig = getStreetDealerSlotConfigByResourceKey(slot.resourceKey);
      if (!slotConfig) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: "Neznámý typ slotu dealerů." };
      }
      const slotCap = getStreetDealerSlotCapacity(slotConfig, networkEffects);
      const storedUnits = Math.max(0, Math.floor(Number(slot.storedUnits || 0)));
      const freeSpace = Math.max(0, slotCap - storedUnits);
      if (freeSpace <= 0) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: `Slot ${slotId} je plný.` };
      }
      const economy = getSafeDrugLabEconomySnapshot();
      const inventory = createDrugLabAmountMap(normalizeDrugLabInventoryFromEconomy(economy));
      const resourceKey = String(slot.resourceKey || "").trim();
      const availableSupply = Math.max(0, Math.floor(Number(inventory[resourceKey] || 0)));
      const desiredUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
      const loadUnits = Math.max(0, Math.min(desiredUnits, availableSupply, freeSpace));
      if (loadUnits <= 0) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: `Nedostatek drog ${slotConfig.label} v inventáři.` };
      }
      slot.storedUnits = storedUnits + loadUnits;
      inventory[resourceKey] = Math.max(0, availableSupply - loadUnits);
      persistSimpleCashBuildingState(instanceKey, snapshot);
      applyDrugLabEconomySnapshot(economy, inventory, getDrugLabPlayerSnapshot(now), now);
      return {
        ok: true,
        message:
          `Pouliční dealeři slot ${slotId}: vloženo ${loadUnits} ${slotConfig.label}. `
          + `Ve slotu ${slot.storedUnits}/${slotCap} • hráč má ${Math.max(0, Math.floor(Number(inventory[resourceKey] || 0)))} ks.`
      };
    }

    const unloadBtn = target.closest("[data-street-dealer-slot-unload]");
    if (unloadBtn instanceof HTMLElement) {
      const slotId = Math.max(1, Math.floor(Number(unloadBtn.dataset.streetDealerSlotUnload) || 0));
      const slot = snapshot.streetDealerSlots.find((entry) => Number(entry.id) === slotId) || null;
      if (!slot) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: "Slot dealerů neexistuje." };
      }
      const slotConfig = getStreetDealerSlotConfigByResourceKey(slot.resourceKey);
      if (!slotConfig) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: "Neznámý typ slotu dealerů." };
      }
      const storedUnits = Math.max(0, Math.floor(Number(slot.storedUnits || 0)));
      if (storedUnits <= 0) {
        persistSimpleCashBuildingState(instanceKey, snapshot);
        return { ok: false, message: `Slot ${slotId} je prázdný.` };
      }
      const desiredUnits = Math.max(1, Math.floor(Number(slot.queuedUnits || 1)));
      const unloadUnits = Math.max(1, Math.min(desiredUnits, storedUnits));
      const economy = getSafeDrugLabEconomySnapshot();
      const inventory = createDrugLabAmountMap(normalizeDrugLabInventoryFromEconomy(economy));
      const resourceKey = String(slot.resourceKey || "").trim();
      slot.storedUnits = Math.max(0, storedUnits - unloadUnits);
      inventory[resourceKey] = Math.max(
        0,
        Math.floor(Number(inventory[resourceKey] || 0) + unloadUnits)
      );
      persistSimpleCashBuildingState(instanceKey, snapshot);
      applyDrugLabEconomySnapshot(economy, inventory, getDrugLabPlayerSnapshot(now), now);
      return {
        ok: true,
        message:
          `Pouliční dealeři slot ${slotId}: vráceno ${unloadUnits} ${slotConfig.label} do inventáře hráče.`
      };
    }

    persistSimpleCashBuildingState(instanceKey, snapshot);
    return null;
  }

  function handleFactoryInlineControl(target, activeContext) {
    const now = Date.now();
    const inputContext = activeContext?.context || null;
    const inputDistrict = activeContext?.district || null;
    if (!inputContext) return null;
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané.", silentUiEvent: true };
    }
    const primaryTarget = resolvePrimaryOwnedFactoryTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const ownedFactoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, (ownedFactoryCount - 1) * 10);
    const instanceKey = resolveBuildingInstanceKey(context, district);
    const snapshot = getFactoryStateByKey(instanceKey, now);
    syncFactoryProduction(snapshot, now, {
      applyHeat: true,
      ownedFactoryCount,
      networkProductionBonusPct
    });

    const setSlotState = (slotId, shouldProduce) => {
      const safeSlotId = Math.max(1, Math.floor(Number(slotId) || 0));
      const slot = (Array.isArray(snapshot.slots) ? snapshot.slots : []).find((entry) => Number(entry.id) === safeSlotId) || null;
      if (!slot) {
        persistFactoryState(instanceKey, snapshot);
        return { ok: false, message: "Slot Továrny neexistuje." };
      }
      if (shouldProduce) {
        if (slot.isProducing) {
          persistFactoryState(instanceKey, snapshot);
          return { ok: false, message: `Slot ${safeSlotId} už běží.` };
        }
        slot.isProducing = true;
        slot.lastTick = now;
        persistFactoryState(instanceKey, snapshot);
        return { ok: true, message: `Továrna slot ${safeSlotId}: výroba spuštěna.` };
      }
      if (!slot.isProducing) {
        persistFactoryState(instanceKey, snapshot);
        return { ok: false, message: `Slot ${safeSlotId} neběží.` };
      }
      slot.isProducing = false;
      slot.lastTick = now;
      persistFactoryState(instanceKey, snapshot);
      return { ok: true, message: `Továrna slot ${safeSlotId}: výroba zastavena.` };
    };

    const startBtn = target.closest("[data-factory-slot-start]");
    if (startBtn instanceof HTMLElement) {
      const slotId = Number(startBtn.dataset.factorySlotStart || 0);
      return setSlotState(slotId, true);
    }
    const stopBtn = target.closest("[data-factory-slot-stop]");
    if (stopBtn instanceof HTMLElement) {
      const slotId = Number(stopBtn.dataset.factorySlotStop || 0);
      return setSlotState(slotId, false);
    }
    return null;
  }

  function handleArmoryInlineControl(target, activeContext) {
    const now = Date.now();
    const inputContext = activeContext?.context || null;
    const inputDistrict = activeContext?.district || null;
    if (!inputContext) return null;
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané.", silentUiEvent: true };
    }
    const primaryTarget = resolvePrimaryOwnedArmoryTarget(inputContext, inputDistrict);
    const context = primaryTarget.context || inputContext;
    const district = primaryTarget.district || inputDistrict;
    const ownedArmoryCount = Math.max(1, primaryTarget.entries.length || 1);
    const networkProductionBonusPct = Math.max(0, (ownedArmoryCount - 1) * 10);
    const instanceKey = resolveBuildingInstanceKey(context, district);
    const snapshot = getArmoryStateByKey(instanceKey, now);
    const syncResult = syncArmoryProduction(snapshot, now, {
      applyHeat: true,
      ownedArmoryCount,
      networkProductionBonusPct
    });
    const adjustBtn = target.closest("[data-armory-slot-adjust][data-armory-slot-id]");
    if (adjustBtn instanceof HTMLElement) {
      const slotId = Math.max(1, Math.floor(Number(adjustBtn.dataset.armorySlotId) || 0));
      const delta = Math.floor(Number(adjustBtn.dataset.armorySlotAdjust) || 0);
      const slot = (Array.isArray(snapshot.slots) ? snapshot.slots : []).find((entry) => Number(entry.id) === slotId) || null;
      if (!slot || !delta) {
        persistArmoryState(instanceKey, snapshot);
        return { ok: false, message: "Slot Zbrojovky neexistuje.", silentUiEvent: true };
      }
      slot.queuedUnits = clamp(Math.floor(Number(slot.queuedUnits || 1) + delta), 1, ARMORY_BATCH_MAX_UNITS);
      persistArmoryState(instanceKey, snapshot);
      return { ok: true, message: `Zbrojovka slot ${slotId}: nastaveno ${slot.queuedUnits} ks.`, silentUiEvent: true };
    }

    const setSlotState = (slotId, shouldProduce) => {
      const safeSlotId = Math.max(1, Math.floor(Number(slotId) || 0));
      const slot = (Array.isArray(snapshot.slots) ? snapshot.slots : []).find((entry) => Number(entry.id) === safeSlotId) || null;
      if (!slot) {
        persistArmoryState(instanceKey, snapshot);
        return { ok: false, message: "Slot Zbrojovky neexistuje.", silentUiEvent: true };
      }
      if (shouldProduce) {
        const config = ARMORY_CONFIG.weapons[String(slot.weaponKey || "").trim()] || null;
        if (!config) {
          persistArmoryState(instanceKey, snapshot);
          return { ok: false, message: "Zbraň pro slot neexistuje.", silentUiEvent: true };
        }
        const units = clamp(Math.floor(Number(slot.queuedUnits || 1)), 1, ARMORY_BATCH_MAX_UNITS);
        const metalCost = Math.max(0, Math.floor(Number(config.metalPartsCost || 0)));
        const techCost = Math.max(0, Math.floor(Number(config.techCoreCost || 0)));
        const currentBatchUnits = clamp(Math.floor(Number(slot.batchMaxUnits || 0)), 0, ARMORY_BATCH_MAX_UNITS);
        const availableBatchSpace = Math.max(0, ARMORY_BATCH_MAX_UNITS - currentBatchUnits);
        const requestedUnits = slot.isProducing ? Math.min(units, availableBatchSpace) : units;
        if (requestedUnits <= 0) {
          persistArmoryState(instanceKey, snapshot);
          return { ok: false, message: `Slot ${safeSlotId} má batch naplněný.`, silentUiEvent: true };
        }
        const totalMetalCost = requestedUnits * metalCost;
        const totalTechCost = requestedUnits * techCost;
        const availableSupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
        if (
          Number(availableSupplies.metalParts || 0) < totalMetalCost
          || Number(availableSupplies.techCore || 0) < totalTechCost
        ) {
          persistArmoryState(instanceKey, snapshot);
          return {
            ok: false,
            message:
              `Nedostatek materiálu (potřeba MP ${totalMetalCost}, TC ${totalTechCost}; `
              + `máš MP ${availableSupplies.metalParts}, TC ${availableSupplies.techCore}).`,
            silentUiEvent: true
          };
        }
        availableSupplies.metalParts = Math.max(0, Math.floor(Number(availableSupplies.metalParts || 0) - totalMetalCost));
        availableSupplies.techCore = Math.max(0, Math.floor(Number(availableSupplies.techCore || 0) - totalTechCost));
        persistFactoryPlayerSuppliesSnapshot(availableSupplies);
        const currentlyProducing = Boolean(slot.isProducing && Math.max(0, Math.floor(Number(slot.remainingUnits || 0))) > 0);
        if (currentlyProducing) {
          slot.remainingUnits = Math.max(0, Math.floor(Number(slot.remainingUnits || 0))) + requestedUnits;
          slot.batchMaxUnits = Math.min(ARMORY_BATCH_MAX_UNITS, Math.max(0, Math.floor(Number(slot.batchMaxUnits || 0))) + requestedUnits);
          slot.queuedUnits = 1;
          slot.lastTick = now;
          persistArmoryState(instanceKey, snapshot);
          return {
            ok: true,
            message:
              `Zbrojovka slot ${safeSlotId}: do fronty přidáno ${requestedUnits} ks. `
              + `Spotřeba MP ${totalMetalCost}, TC ${totalTechCost}.`,
            silentUiEvent: true
          };
        }
        slot.isProducing = true;
        slot.producedAmount = 0;
        slot.batchMaxUnits = requestedUnits;
        slot.remainingUnits = requestedUnits;
        slot.queuedUnits = 1;
        slot.lastTick = now;
        slot.productionRemainder = 0;
        persistArmoryState(instanceKey, snapshot);
        return {
          ok: true,
          message:
            `Zbrojovka slot ${safeSlotId}: výroba spuštěna (${requestedUnits} ks). `
            + `Spotřeba MP ${totalMetalCost}, TC ${totalTechCost}.`,
          silentUiEvent: true
        };
      }
      if (!slot.isProducing) {
        persistArmoryState(instanceKey, snapshot);
        return { ok: false, message: `Slot ${safeSlotId} neběží.`, silentUiEvent: true };
      }
      slot.isProducing = false;
      slot.remainingUnits = 0;
      slot.lastTick = now;
      persistArmoryState(instanceKey, snapshot);
      return { ok: true, message: `Zbrojovka slot ${safeSlotId}: výroba zastavena.`, silentUiEvent: true };
    };

    const startBtn = target.closest("[data-armory-slot-start]");
    if (startBtn instanceof HTMLElement) {
      const slotId = Number(startBtn.dataset.armorySlotStart || 0);
      return setSlotState(slotId, true);
    }
    const stopBtn = target.closest("[data-armory-slot-stop]");
    if (stopBtn instanceof HTMLElement) {
      const slotId = Number(stopBtn.dataset.armorySlotStop || 0);
      return setSlotState(slotId, false);
    }
    return null;
  }

  function generateCity() {
    const seed = "empire-city-v1";
    const width = state.mapSize.width;
    const height = state.mapSize.height;
    const districtCount = 161;
    const city = window.Empire.CityGen.generate({ seed, width, height, districtCount });
    const enrichedDistricts = window.Empire.UI?.assignDistrictMetadata
      ? window.Empire.UI.assignDistrictMetadata(city.districts)
      : city.districts;
    const nextDistricts = Array.isArray(enrichedDistricts) ? [...enrichedDistricts] : [];
    if (nextDistricts.length) {
      const targetIndex = nextDistricts.reduce((bestIndex, district, index, arr) => {
        const districtId = Number(district?.id || 0);
        const bestId = Number(arr[bestIndex]?.id || 0);
        return districtId > bestId ? index : bestIndex;
      }, 0);
      const target = nextDistricts[targetIndex] || null;
      if (target) {
        nextDistricts[targetIndex] = {
          ...target,
          type: "downtown",
          buildings: [],
          buildingNameOverrides: [],
          buildingTier: null,
          buildingSetKey: null,
          buildingSetTitle: null
        };
      }
    }
    setDistricts(nextDistricts);
  }

  function bindEvents() {
    state.canvas.addEventListener("mousemove", onMouseMove);
    state.canvas.addEventListener("mouseleave", onMouseLeave);
    state.canvas.addEventListener("mousedown", onMouseDown);
    state.canvas.addEventListener("mouseup", onMouseUp);
    state.canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    state.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    state.canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    state.canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });
    state.canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    const rect = state.canvas.getBoundingClientRect();
    state.canvas.width = rect.width * window.devicePixelRatio;
    state.canvas.height = rect.height * window.devicePixelRatio;
    state.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    const minScale = getMinScale();
    if (!state.hasViewportOverride) {
      // On fresh load keep map maximally zoomed out (whole city visible).
      state.scale = minScale;
      centerMap();
    } else if (state.scale < minScale) {
      state.scale = minScale;
    }
    clampPan();
    render();
  }

  function toWorld(x, y) {
    return {
      x: (x - state.offsetX) / state.scale,
      y: (y - state.offsetY) / state.scale
    };
  }

  function isMapClickTemporarilyLocked() {
    return Number(window.Empire.mapClickLockUntil || 0) > Date.now();
  }

  function onMouseMove(event) {
    if (isTouchGhost()) return;
    if (state.isPanning) {
      const dx = event.clientX - state.panStart.x;
      const dy = event.clientY - state.panStart.y;
      state.offsetX = state.viewStart.x + dx;
      state.offsetY = state.viewStart.y + dy;
      clampPan();
      render();
      return;
    }

    const rect = state.canvas.getBoundingClientRect();
    const point = toWorld(event.clientX - rect.left, event.clientY - rect.top);
    const hovered = pickDistrict(point.x, point.y);
    state.hoverId = hovered ? hovered.id : null;
    updateTooltip(hovered, event.clientX, event.clientY);
    render();
  }

  function onMouseLeave() {
    if (isTouchGhost()) return;
    if (state.isPanning) return;
    state.hoverId = null;
    hideTooltip();
    render();
  }

  function onMouseDown(event) {
    if (isTouchGhost()) return;
    if (isMapClickTemporarilyLocked()) return;
    if (event.button !== 0) return;
    state.isPanning = true;
    state.hasViewportOverride = true;
    state.panStart = { x: event.clientX, y: event.clientY };
    state.viewStart = { x: state.offsetX, y: state.offsetY };
    state.canvas.style.cursor = "grabbing";
  }

  function notifySelectedDistrictChange() {
    const refreshShortcuts = window.Empire.UI?.refreshMarketBuildingShortcuts;
    if (typeof refreshShortcuts === "function") {
      refreshShortcuts();
    }
  }

  function clearPendingDataCenterTargeting() {
    state.pendingDataCenterTarget = null;
  }

  function enterDataCenterMapTargeting(actionId, activeContext) {
    const context = activeContext?.context || null;
    if (!context) return false;
    const district = activeContext?.district || null;
    const instanceKey = resolveBuildingInstanceKey(context, district);
    state.pendingDataCenterTarget = {
      actionId: String(actionId || "").trim(),
      instanceKey,
      activeContext: {
        context,
        district
      },
      startedAt: Date.now()
    };
    const buildingModal = document.getElementById("building-detail-modal");
    if (buildingModal) buildingModal.classList.add("hidden");
    state.activeBuildingDetail = null;
    state.activeBuildingDetailTab = "stats";
    document.getElementById("district-modal")?.classList.add("hidden");
    document.getElementById("modal-buildings")?.classList.add("hidden");
    return true;
  }

  function handlePendingDataCenterTargetDistrictSelection(district) {
    const pending = state.pendingDataCenterTarget;
    if (!pending) return false;
    if (!district || isDistrictDestroyed(district) || !district?.owner) {
      window.Empire.UI?.pushEvent?.("Vyber obsazený distrikt na mapě pro akci Datového centra.");
      return true;
    }
    if (isDistrictOwnedByPlayer(district)) {
      window.Empire.UI?.pushEvent?.("Vyber cizí distrikt (ne vlastní).");
      return true;
    }
    const districtLabel = `#${resolveDistrictNumberLabel(district)} ${district.name || "Distrikt"}`;
    const actionLabel =
      pending.actionId === "1" ? "Sledování hráče"
      : pending.actionId === "2" ? "Hack income"
      : "Datová akce";
    const ownerLabel = String(district.owner || "").trim();
    const confirmMessage =
      pending.actionId === "1"
        ? `Použít akci "${actionLabel}" na hráče "${ownerLabel}" přes distrikt ${districtLabel}?`
        : `Použít akci "${actionLabel}" na distrikt ${districtLabel}?`;
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      window.Empire.UI?.pushEvent?.("Akce zrušena. Vyber jiný distrikt, nebo spusť akci znovu.");
      return true;
    }
    state.pendingDataCenterTarget = {
      ...pending,
      selectedDistrictId: String(district.id ?? "").trim(),
      selectedDistrictOwner: ownerLabel
    };
    const result = handleParkSpecialBuildingAction(pending.actionId, pending.activeContext);
    clearPendingDataCenterTargeting();
    if (result?.message) {
      window.Empire.UI?.pushEvent?.(result.message);
    }
    return true;
  }

  function isDistrictValidForPendingDataCenterTarget(district, pendingTarget = state.pendingDataCenterTarget) {
    if (!pendingTarget || !district) return false;
    if (isDistrictDestroyed(district)) return false;
    if (!district?.owner) return false;
    if (isDistrictOwnedByPlayer(district)) return false;
    const actionId = String(pendingTarget.actionId || "").trim();
    return actionId === "1" || actionId === "2";
  }

  function onMouseUp(event) {
    if (isTouchGhost()) return;
    if (isMapClickTemporarilyLocked()) return;
    if (event.button !== 0) return;
    if (!state.isPanning) return;
    const moved = Math.hypot(
      event.clientX - state.panStart.x,
      event.clientY - state.panStart.y
    );
    state.isPanning = false;
    state.canvas.style.cursor = "grab";
    if (moved > 6) return;

    const rect = state.canvas.getBoundingClientRect();
    const point = toWorld(event.clientX - rect.left, event.clientY - rect.top);
    const picked = pickDistrict(point.x, point.y);
    if (handlePendingDataCenterTargetDistrictSelection(picked)) {
      render();
      return;
    }
    if (picked) {
      state.selectedId = picked.id;
      window.Empire.selectedDistrict = picked;
      document.dispatchEvent(new CustomEvent("empire:district-selected", {
        detail: {
          districtId: picked.id,
          district: picked
        }
      }));
      notifySelectedDistrictChange();
      showModal(picked);
      render();
    }
  }

  function onWindowMouseMove(event) {
    if (isTouchGhost() || !state.isPanning) return;
    const dx = event.clientX - state.panStart.x;
    const dy = event.clientY - state.panStart.y;
    state.offsetX = state.viewStart.x + dx;
    state.offsetY = state.viewStart.y + dy;
    clampPan();
    render();
  }

  function onWheel(event) {
    if (isTouchGhost()) return;
    event.preventDefault();
    state.hasViewportOverride = true;
    const delta = -event.deltaY * 0.0015;
    const minScale = getMinScale();
    const newScale = clamp(state.scale * (1 + delta), minScale, 2.5);

    const rect = state.canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    zoomAtPoint(mx, my, newScale);
  }

  function onTouchStart(event) {
    if (!event.touches.length) return;
    if (isMapClickTemporarilyLocked()) {
      event.preventDefault();
      return;
    }
    state.lastTouchAt = Date.now();
    hideTooltip();

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      state.isPinching = false;
      state.isPanning = true;
      state.touchMoved = false;
      state.hasViewportOverride = true;
      state.panStart = { x: touch.clientX, y: touch.clientY };
      state.viewStart = { x: state.offsetX, y: state.offsetY };
      event.preventDefault();
      return;
    }

    if (event.touches.length >= 2) {
      state.hasViewportOverride = true;
      beginPinch(event.touches[0], event.touches[1]);
      event.preventDefault();
    }
  }

  function onTouchMove(event) {
    if (!event.touches.length) return;
    state.lastTouchAt = Date.now();

    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = distanceBetweenTouches(first, second);
      if (!state.isPinching || !state.pinchStartDistance) {
        beginPinch(first, second);
      }

      const rect = state.canvas.getBoundingClientRect();
      const midpoint = midpointBetweenTouches(first, second);
      const newScale = clamp(
        state.pinchStartScale * (distance / state.pinchStartDistance),
        getMinScale(),
        2.5
      );
      state.scale = newScale;
      state.offsetX = midpoint.x - rect.left - (state.pinchWorldCenter?.x || 0) * newScale;
      state.offsetY = midpoint.y - rect.top - (state.pinchWorldCenter?.y || 0) * newScale;
      clampPan();
      render();
      event.preventDefault();
      return;
    }

    if (!state.isPanning) return;
    const touch = event.touches[0];
    const dx = touch.clientX - state.panStart.x;
    const dy = touch.clientY - state.panStart.y;
    if (Math.hypot(dx, dy) > 4) state.touchMoved = true;
    state.offsetX = state.viewStart.x + dx;
    state.offsetY = state.viewStart.y + dy;
    clampPan();
    render();
    event.preventDefault();
  }

  function onTouchEnd(event) {
    if (isMapClickTemporarilyLocked()) {
      event.preventDefault();
      return;
    }
    state.lastTouchAt = Date.now();

    if (state.isPinching && event.touches.length >= 2) {
      beginPinch(event.touches[0], event.touches[1]);
      event.preventDefault();
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      state.isPinching = false;
      state.isPanning = true;
      state.panStart = { x: touch.clientX, y: touch.clientY };
      state.viewStart = { x: state.offsetX, y: state.offsetY };
      state.touchMoved = true;
      event.preventDefault();
      return;
    }

    const changedTouch = event.changedTouches[0];
    const shouldOpenDistrict =
      changedTouch &&
      !state.isPinching &&
      state.isPanning &&
      !state.touchMoved;

    state.isPanning = false;
    state.isPinching = false;

    if (shouldOpenDistrict) {
      const rect = state.canvas.getBoundingClientRect();
      const point = toWorld(changedTouch.clientX - rect.left, changedTouch.clientY - rect.top);
      const picked = pickDistrict(point.x, point.y);
      if (handlePendingDataCenterTargetDistrictSelection(picked)) {
        render();
        event.preventDefault();
        return;
      }
      if (picked) {
        state.selectedId = picked.id;
        window.Empire.selectedDistrict = picked;
        document.dispatchEvent(new CustomEvent("empire:district-selected", {
          detail: {
            districtId: picked.id,
            district: picked
          }
        }));
        notifySelectedDistrictChange();
        showModal(picked);
        render();
      }
    }

    event.preventDefault();
  }

  function onTouchCancel() {
    state.lastTouchAt = Date.now();
    state.isPanning = false;
    state.isPinching = false;
    state.touchMoved = false;
  }

  function pickDistrict(x, y) {
    if (y < resolveDistrictTopNoDrawY()) return null;
    for (let i = 0; i < state.districts.length; i += 1) {
      const district = state.districts[i];
      if (pointInPolygon([x, y], district.polygon)) {
        return district;
      }
    }
    return null;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect = yi > point[1] !== yj > point[1] &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
    return inside;
  }

  function render() {
    const ctx = state.ctx;
    const canvas = state.canvas;
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.scale, state.scale);

    drawBackground(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      0,
      resolveDistrictTopNoDrawY(),
      state.mapSize.width,
      Math.max(0, state.mapSize.height - resolveDistrictTopNoDrawY())
    );
    ctx.clip();
    drawDistricts(ctx);
    ctx.restore();
    drawDistrictTopCutLine(ctx);
    ctx.restore();
  }

  function resolveDistrictTopNoDrawY() {
    return state.mapSize.height * DISTRICT_TOP_NO_DRAW_RATIO;
  }

  function drawDistrictTopCutLine(ctx) {
    if (!shouldDrawDistrictBorders()) return;
    const cutY = resolveDistrictTopNoDrawY();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, cutY);
    ctx.lineTo(state.mapSize.width, cutY);
    ctx.strokeStyle = resolveDistrictBorderStroke();
    ctx.lineWidth = 2;
    ctx.stroke();

    const activeDistrictId = state.selectedId != null ? state.selectedId : state.hoverId;
    const activeDistrict = activeDistrictId != null
      ? resolveDistrictById(activeDistrictId)
      : null;
    const polygon = Array.isArray(activeDistrict?.polygon) ? activeDistrict.polygon : [];
    if (polygon.length >= 3) {
      let minY = Number.POSITIVE_INFINITY;
      polygon.forEach(([, y]) => {
        const safeY = Number(y || 0);
        minY = Math.min(minY, safeY);
      });
      const isTopDistrict = Number.isFinite(minY) && minY <= cutY + 2;
      if (isTopDistrict) {
        const segments = getPolygonHorizontalSegmentsAtY(polygon, cutY);
        segments.forEach(([rawStartX, rawEndX]) => {
          const startX = Math.max(0, rawStartX);
          const endX = Math.min(state.mapSize.width, rawEndX);
          if (endX <= startX) return;
          ctx.beginPath();
          ctx.moveTo(startX, cutY);
          ctx.lineTo(endX, cutY);
          ctx.strokeStyle = state.selectedId != null ? "#facc15" : "#38bdf8";
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      }
    }
    ctx.restore();
  }

  function drawBackground(ctx) {
    ctx.fillStyle = "#0b1119";
    ctx.fillRect(-2000, -2000, 6000, 6000);
    if (state.mapImage && state.mapImage.complete) {
      ctx.drawImage(state.mapImage, 0, 0, state.mapSize.width, state.mapSize.height);
    }
  }

  function drawDistricts(ctx) {
    const now = Date.now();
    const pendingDataCenterTarget = state.pendingDataCenterTarget;
    const isHackIncomeTargeting = String(pendingDataCenterTarget?.actionId || "").trim() === "2";
    const borderStroke = resolveDistrictBorderStroke();
    const districtOverlays = [];
    pruneExpiredAttackMarkers(now);
    pruneExpiredPoliceActions(now);
    pruneExpiredSpyActions(now);
    syncAttackAnimationTicker();

    state.districts.forEach((district) => {
      const fill = districtFill(district);
      const destroyed = isDistrictDestroyed(district);
      const hiddenByMode = shouldHideDistrictByVisibilityMode(district);
      const districtKey = normalizeDistrictId(district?.id);
      const attackMarker = districtKey ? state.attackedDistricts.get(districtKey) : null;
      const policeAction = districtKey ? state.policeDistrictActions.get(districtKey) : null;
      const spyAction = districtKey ? state.spyDistrictActions.get(districtKey) : null;
      const raidAction = districtKey ? state.raidDistrictActions.get(districtKey) : null;
      const bountyMarker = districtKey ? state.bountyDistrictMarkers.get(districtKey) : null;
      ctx.fillStyle = fill;
      ctx.strokeStyle = destroyed || hiddenByMode || !shouldDrawDistrictBorders()
        ? "rgba(0,0,0,0)"
        : borderStroke;
      ctx.lineWidth = 1;

      ctx.beginPath();
      district.polygon.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.save();
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.fill();
      if (!hiddenByMode && shouldDrawDistrictBorders()) {
        ctx.stroke();
      }
      if (isHackIncomeTargeting && isDistrictValidForPendingDataCenterTarget(district, pendingDataCenterTarget)) {
        ctx.save();
        ctx.fillStyle = "rgba(239, 68, 68, 0.24)";
        ctx.fill();
        ctx.strokeStyle = "rgba(248, 113, 113, 0.82)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      drawDistrictAllianceIcon(ctx, district);

      if (bountyMarker && !destroyed && !hiddenByMode) {
        drawDistrictBountyEffect(ctx, district, bountyMarker, now);
      }

      if (!hiddenByMode && shouldDrawDistrictBorders() && (district.id === state.hoverId || district.id === state.selectedId)) {
        ctx.strokeStyle = district.id === state.selectedId ? "#facc15" : "#38bdf8";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (destroyed) {
        drawDestroyedDistrictEffect(ctx, district, now);
      }
      if (!destroyed) {
        drawDistrictTrapToxicMist(ctx, district, now);
      }
      districtOverlays.push({
        district,
        attackMarker,
        policeAction,
        spyAction,
        raidAction,
        bountyMarker,
        isOnboardingFocus: String(district?.id) === String(state.onboardingFocusDistrictId || "")
      });
    });

    districtOverlays.forEach((entry) => {
      if (entry.attackMarker) {
        drawDistrictAttackEffect(ctx, entry.district, entry.attackMarker, now);
      }
      if (entry.policeAction) {
        drawDistrictPoliceActionEffect(ctx, entry.district, entry.policeAction, now);
      }
      if (entry.spyAction) {
        drawDistrictSpyActionEffect(ctx, entry.district, entry.spyAction, now);
      }
      if (entry.raidAction) {
        drawDistrictRaidActionEffect(ctx, entry.district, entry.raidAction, now);
      }
      if (entry.bountyMarker) {
        drawDistrictBountyMarker(ctx, entry.district, entry.bountyMarker, now);
      }
      if (entry.isOnboardingFocus) {
        drawOnboardingFocusDistrictEffect(ctx, entry.district, now);
      }
    });
  }

  function drawOnboardingFocusDistrictEffect(ctx, district, now = Date.now()) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    const haloAlpha = 0.18 + pulse * 0.18;
    const strokeAlpha = 0.62 + pulse * 0.28;
    const borderOnly = state.onboardingFocusMode === "border";

    if (!borderOnly && drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.fillStyle = `rgba(34,211,238,${haloAlpha.toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.strokeStyle = `rgba(103,232,249,${strokeAlpha.toFixed(3)})`;
      ctx.lineWidth = 4 + pulse * 2.2;
      ctx.shadowColor = "rgba(34,211,238,0.85)";
      ctx.shadowBlur = 22 + pulse * 14;
      ctx.stroke();
      ctx.restore();
    }
  }

  function normalizeDistrictId(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function resolveAttackMarkerDurationMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DISTRICT_ATTACK_MARKER_DEFAULT_DURATION_MS;
    return Math.max(
      DISTRICT_ATTACK_MARKER_MIN_DURATION_MS,
      Math.min(DISTRICT_ATTACK_MARKER_MAX_DURATION_MS, Math.floor(parsed))
    );
  }

  function resolvePoliceActionDurationMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DISTRICT_POLICE_ACTION_DEFAULT_DURATION_MS;
    return Math.max(
      DISTRICT_POLICE_ACTION_MIN_DURATION_MS,
      Math.min(DISTRICT_POLICE_ACTION_MAX_DURATION_MS, Math.floor(parsed))
    );
  }

  function resolveSpyActionDurationMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DISTRICT_SPY_ACTION_DEFAULT_DURATION_MS;
    return Math.max(
      DISTRICT_SPY_ACTION_MIN_DURATION_MS,
      Math.min(DISTRICT_SPY_ACTION_MAX_DURATION_MS, Math.floor(parsed))
    );
  }

  function drawDistrictBountyMarker(ctx, district, marker, now = Date.now()) {
    const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
    if (polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(polygon);
    const bounds = polygonBounds(polygon);
    const pulse = 0.5 + 0.5 * Math.sin(now / 320);
    const radius = Math.max(4, Math.min(7, Math.min(bounds.width, bounds.height) * 0.045));
    const markerX = Math.min(bounds.maxX - radius * 1.2, cx + bounds.width * 0.18);
    const markerY = Math.max(bounds.minY + radius * 1.2, cy - bounds.height * 0.18);

    ctx.save();
    ctx.translate(markerX, markerY);
    ctx.rotate(-0.28);
    ctx.strokeStyle = `rgba(254, 202, 202, ${(0.82 + pulse * 0.18).toFixed(3)})`;
    ctx.fillStyle = "rgba(127, 29, 29, 0.92)";
    ctx.lineWidth = 1.15;
    ctx.shadowColor = "rgba(220, 38, 38, 0.55)";
    ctx.shadowBlur = 8 + pulse * 4;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-radius * 1.1, 0);
    ctx.lineTo(radius * 1.1, 0);
    ctx.moveTo(0, -radius * 1.1);
    ctx.lineTo(0, radius * 1.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(radius * 1.15, -radius * 1.15);
    ctx.lineTo(radius * 2.05, -radius * 2.05);
    ctx.lineTo(radius * 1.45, -radius * 2.15);
    ctx.moveTo(radius * 2.05, -radius * 2.05);
    ctx.lineTo(radius * 2.15, -radius * 1.45);
    ctx.stroke();

    const count = Math.max(1, Math.floor(Number(marker?.count || 1)));
    if (count > 1) {
      ctx.fillStyle = "#fee2e2";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(count), 0, 0.5);
    }
    ctx.restore();
  }

  function drawDistrictBountyEffect(ctx, district, marker, now = Date.now()) {
    if (!drawDistrictPolygonPath(ctx, district?.polygon)) return;

    const huntModeActive = Boolean(marker?.huntModeActive);
    const pulseRate = huntModeActive ? 180 : 320;
    const pulse = 0.5 + 0.5 * Math.sin(now / pulseRate);
    const fillAlpha = huntModeActive ? 0.1 + pulse * 0.08 : 0.05 + pulse * 0.05;
    const strokeAlpha = huntModeActive ? 0.62 + pulse * 0.22 : 0.4 + pulse * 0.18;

    ctx.save();
    drawDistrictPolygonPath(ctx, district.polygon);
    ctx.fillStyle = `rgba(127, 29, 29, ${fillAlpha.toFixed(3)})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawDistrictPolygonPath(ctx, district.polygon);
    ctx.strokeStyle = `rgba(248, 113, 113, ${strokeAlpha.toFixed(3)})`;
    ctx.lineWidth = huntModeActive ? 4.2 + pulse * 2 : 2.6 + pulse * 1.2;
    ctx.shadowColor = huntModeActive ? "rgba(239, 68, 68, 0.95)" : "rgba(239, 68, 68, 0.7)";
    ctx.shadowBlur = huntModeActive ? 22 + pulse * 14 : 12 + pulse * 8;
    ctx.stroke();
    ctx.restore();
  }

  function resolveRaidActionDurationMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DISTRICT_RAID_ACTION_DEFAULT_DURATION_MS;
    return Math.max(
      DISTRICT_RAID_ACTION_MIN_DURATION_MS,
      Math.min(DISTRICT_RAID_ACTION_MAX_DURATION_MS, Math.floor(parsed))
    );
  }

  function pruneExpiredAttackMarkers(now = Date.now()) {
    if (!state.attackedDistricts.size) return false;
    let changed = false;
    for (const [districtKey, marker] of state.attackedDistricts.entries()) {
      if (!marker || !Number.isFinite(Number(marker.expiresAt)) || Number(marker.expiresAt) <= now) {
        state.attackedDistricts.delete(districtKey);
        changed = true;
      }
    }
    return changed;
  }

  function pruneExpiredPoliceActions(now = Date.now()) {
    if (!state.policeDistrictActions.size) return false;
    let changed = false;
    for (const [districtKey, marker] of state.policeDistrictActions.entries()) {
      if (!marker || !Number.isFinite(Number(marker.expiresAt)) || Number(marker.expiresAt) <= now) {
        state.policeDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    return changed;
  }

  function pruneExpiredSpyActions(now = Date.now()) {
    if (!state.spyDistrictActions.size) return false;
    let changed = false;
    for (const [districtKey, marker] of state.spyDistrictActions.entries()) {
      if (!marker || !Number.isFinite(Number(marker.expiresAt)) || Number(marker.expiresAt) <= now) {
        state.spyDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    return changed;
  }

  function pruneExpiredRaidActions(now = Date.now()) {
    if (!state.raidDistrictActions.size) return false;
    let changed = false;
    for (const [districtKey, marker] of state.raidDistrictActions.entries()) {
      if (!marker || !Number.isFinite(Number(marker.expiresAt)) || Number(marker.expiresAt) <= now) {
        state.raidDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    return changed;
  }

  function reconcileBountyMarkersWithDistricts() {
    if (!state.bountyDistrictMarkers.size) return;
    const validDistrictIds = mapDistrictIdSet();
    for (const districtKey of state.bountyDistrictMarkers.keys()) {
      if (!validDistrictIds.has(districtKey)) {
        state.bountyDistrictMarkers.delete(districtKey);
      }
    }
  }

  function hasDestroyedDistricts() {
    return state.districts.some((district) => isDistrictDestroyed(district));
  }

  function syncAttackAnimationTicker() {
    if (state.attackedDistricts.size > 0 || state.policeDistrictActions.size > 0 || state.spyDistrictActions.size > 0 || state.raidDistrictActions.size > 0 || hasDestroyedDistricts()) {
      if (state.attackAnimationIntervalId != null) return;
      state.attackAnimationIntervalId = setInterval(() => {
        const now = Date.now();
        const attackChanged = pruneExpiredAttackMarkers(now);
        const policeChanged = pruneExpiredPoliceActions(now);
        const spyChanged = pruneExpiredSpyActions(now);
        const raidChanged = pruneExpiredRaidActions(now);
        if (state.attackedDistricts.size < 1 && state.policeDistrictActions.size < 1 && state.spyDistrictActions.size < 1 && state.raidDistrictActions.size < 1 && !hasDestroyedDistricts()) {
          syncAttackAnimationTicker();
          if (attackChanged || policeChanged || spyChanged || raidChanged) render();
          return;
        }
        render();
      }, DISTRICT_ATTACK_ANIMATION_INTERVAL_MS);
      return;
    }

    if (state.attackAnimationIntervalId != null) {
      clearInterval(state.attackAnimationIntervalId);
      state.attackAnimationIntervalId = null;
    }
  }

  function mapDistrictIdSet() {
    if (state.districtIndexById instanceof Map && state.districtIndexById.size) {
      return new Set(state.districtIndexById.keys());
    }
    return new Set(
      state.districts
        .map((district) => normalizeDistrictId(district?.id))
        .filter(Boolean)
    );
  }

  function normalizePolygonPoint(point) {
    if (Array.isArray(point)) {
      return [Number(point[0] || 0), Number(point[1] || 0)];
    }
    if (point && typeof point === "object") {
      return [Number(point.x || 0), Number(point.y || 0)];
    }
    return [0, 0];
  }

  function normalizeMapPointForEdge(point) {
    const [x, y] = normalizePolygonPoint(point);
    return `${x.toFixed(3)},${y.toFixed(3)}`;
  }

  function clonePolygonPoints(points) {
    return (Array.isArray(points) ? points : []).map(normalizePolygonPoint);
  }

  function resolveDistrictBasePolygon(district) {
    const base = Array.isArray(district?.basePolygon) ? district.basePolygon : district?.polygon;
    return clonePolygonPoints(base);
  }

  function mapPolygonToBounds(points, sourceBounds, targetBounds) {
    const safePoints = Array.isArray(points) ? points : [];
    const srcWidth = Number(sourceBounds?.width || 0);
    const srcHeight = Number(sourceBounds?.height || 0);
    const dstWidth = Number(targetBounds?.width || 0);
    const dstHeight = Number(targetBounds?.height || 0);
    if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) return safePoints;
    const srcMinX = Number(sourceBounds.minX || 0);
    const srcMinY = Number(sourceBounds.minY || 0);
    const dstMinX = Number(targetBounds.minX || 0);
    const dstMinY = Number(targetBounds.minY || 0);
    const scaleX = dstWidth / srcWidth;
    const scaleY = dstHeight / srcHeight;
    return safePoints.map(([x, y]) => [
      dstMinX + (x - srcMinX) * scaleX,
      dstMinY + (y - srcMinY) * scaleY
    ]);
  }

  function fitDistrictPolygonsToMap(districts) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const allPoints = safeDistricts.flatMap((district) =>
      clonePolygonPoints(Array.isArray(district?.basePolygon) ? district.basePolygon : district?.polygon)
    );
    if (allPoints.length < 3) return safeDistricts;

    const sourceBounds = {
      minX: 0,
      minY: 0,
      width: state.mapSize.width,
      height: state.mapSize.height
    };
    if (sourceBounds.width <= 0 || sourceBounds.height <= 0) return safeDistricts;

    const topCutY = resolveDistrictTopNoDrawY();
    const targetBounds = {
      minX: 0,
      minY: topCutY,
      width: state.mapSize.width,
      height: Math.max(1, state.mapSize.height - topCutY)
    };
    const mappedDistricts = safeDistricts.map((district) => {
      const basePolygon = clonePolygonPoints(
        Array.isArray(district?.basePolygon) ? district.basePolygon : district?.polygon
      );
      return {
        ...district,
        basePolygon,
        polygon: mapPolygonToBounds(basePolygon, sourceBounds, targetBounds)
      };
    });

    const downtownDistricts = mappedDistricts.filter((district) => district?.type === "downtown");
    if (!downtownDistricts.length) return mappedDistricts;

    const downtownCenters = downtownDistricts
      .map((district) => {
        const poly = Array.isArray(district?.polygon) ? district.polygon : [];
        if (poly.length < 3) return null;
        return polygonCentroid(poly);
      })
      .filter(Boolean);
    if (!downtownCenters.length) return mappedDistricts;

    const downtownCenterX = downtownCenters.reduce((sum, [x]) => sum + Number(x || 0), 0) / downtownCenters.length;
    const downtownCenterY = downtownCenters.reduce((sum, [, y]) => sum + Number(y || 0), 0) / downtownCenters.length;
    const offsetYMax = state.mapSize.height * DOWNTOWN_VERTICAL_OFFSET_RATIO;
    const radiusX = Math.max(1, state.mapSize.width * DOWNTOWN_WARP_RADIUS_X_RATIO);
    const radiusY = Math.max(1, state.mapSize.height * DOWNTOWN_WARP_RADIUS_Y_RATIO);

    return mappedDistricts.map((district) => {
      const poly = Array.isArray(district?.polygon) ? district.polygon : [];
      if (poly.length < 3) return district;
      const warpedPolygon = poly.map(([x, y]) => {
        const nx = (Number(x || 0) - downtownCenterX) / radiusX;
        const ny = (Number(y || 0) - downtownCenterY) / radiusY;
        const influence = Math.max(0, 1 - (nx * nx + ny * ny));
        return [Number(x || 0), Number(y || 0) - influence * offsetYMax];
      });
      return {
        ...district,
        polygon: warpedPolygon
      };
    });
  }

  function normalizeMapEdgeKey(from, to) {
    const a = normalizeMapPointForEdge(from);
    const b = normalizeMapPointForEdge(to);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function buildDistrictAdjacencyIndex(districts) {
    const adjacency = new Map();
    const edgeOwners = new Map();
    const safeDistricts = Array.isArray(districts) ? districts : [];

    safeDistricts.forEach((district) => {
      const districtKey = normalizeDistrictId(district?.id);
      if (!districtKey) return;
      if (!adjacency.has(districtKey)) {
        adjacency.set(districtKey, new Set());
      }
      const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
      if (polygon.length < 2) return;
      for (let i = 0; i < polygon.length; i += 1) {
        const from = polygon[i];
        const to = polygon[(i + 1) % polygon.length];
        const edgeKey = normalizeMapEdgeKey(from, to);
        if (!edgeOwners.has(edgeKey)) {
          edgeOwners.set(edgeKey, []);
        }
        edgeOwners.get(edgeKey).push(districtKey);
      }
    });

    edgeOwners.forEach((owners) => {
      const unique = Array.from(new Set(owners));
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

  function resolveDistrictById(districtId) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return null;
    return state.districtIndexById.get(districtKey) || null;
  }

  function resolveNeighborDistricts(districtId, limit = 4) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return [];
    const neighbors = state.districtAdjacencyById.get(districtKey);
    if (!neighbors || !neighbors.size) return [];
    const ownDistrict = resolveDistrictById(districtKey);
    const ownCenter = ownDistrict?.polygon ? polygonCentroid(ownDistrict.polygon) : [0, 0];
    const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
    const ranked = Array.from(neighbors)
      .map((neighborKey) => resolveDistrictById(neighborKey))
      .filter(Boolean)
      .map((neighborDistrict) => {
        const [nx, ny] = polygonCentroid(neighborDistrict.polygon || []);
        const dx = nx - ownCenter[0];
        const dy = ny - ownCenter[1];
        return {
          district: neighborDistrict,
          distance: Math.sqrt(dx * dx + dy * dy)
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.district);
    if (!safeLimit) return ranked;
    return ranked.slice(0, safeLimit);
  }

  function hslToRgbChannels(hueDegrees, saturation, lightness) {
    const hue = (((Number(hueDegrees) || 0) % 360) + 360) % 360 / 360;
    const sat = clampUnit(saturation);
    const light = clampUnit(lightness);

    if (sat === 0) {
      const channel = clampColorChannel(light * 255);
      return [channel, channel, channel];
    }

    const q = light < 0.5
      ? light * (1 + sat)
      : light + sat - light * sat;
    const p = 2 * light - q;
    const hueToChannel = (tRaw) => {
      let t = tRaw;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    return [
      clampColorChannel(hueToChannel(hue + 1 / 3) * 255),
      clampColorChannel(hueToChannel(hue) * 255),
      clampColorChannel(hueToChannel(hue - 1 / 3) * 255)
    ];
  }

  function rebuildDistinctOwnerColorIndex() {
    state.distinctOwnerColorByName.clear();
    if (!state.vision.uniqueOwnerColors) return;

    const ownerKeys = Array.from(new Set(
      state.districts
        .map((district) => normalizeName(district?.owner))
        .filter(Boolean)
    )).sort();
    if (!ownerKeys.length) return;

    const playerOwnerKeys = getPlayerOwnerNames();
    const preferredPlayerColor = normalizeHexColor(localStorage.getItem("empire_gang_color"));
    const usedColorKeys = new Set();
    const colorKey = (channels) => Array.isArray(channels) ? channels.join(",") : "";

    const preferredPlayerChannels = preferredPlayerColor
      ? parseCssColorChannels(preferredPlayerColor)
      : null;
    if (preferredPlayerChannels) {
      ownerKeys.forEach((ownerKey) => {
        if (!playerOwnerKeys.has(ownerKey)) return;
        state.distinctOwnerColorByName.set(ownerKey, preferredPlayerChannels);
      });
      usedColorKeys.add(colorKey(preferredPlayerChannels));
    }

    const unassignedOwners = ownerKeys.filter((ownerKey) => !state.distinctOwnerColorByName.has(ownerKey));
    const unassignedCount = unassignedOwners.length;
    if (!unassignedCount) return;

    const hueOffset = hashOwner(`${ownerKeys.join("|")}:unique-owner-colors`) % 360;
    unassignedOwners.forEach((ownerKey, index) => {
      let hue = (hueOffset + (index * 360) / unassignedCount) % 360;
      let light = 0.55 + (((index % 4) - 1.5) * 0.025);
      let channels = hslToRgbChannels(hue, 0.82, light);
      let guard = 0;
      while (usedColorKeys.has(colorKey(channels)) && guard < 96) {
        hue = (hue + 11.25) % 360;
        light = 0.54 + ((guard % 5) - 2) * 0.018;
        channels = hslToRgbChannels(hue, 0.82, light);
        guard += 1;
      }
      state.distinctOwnerColorByName.set(ownerKey, channels);
      usedColorKeys.add(colorKey(channels));
    });
  }

  function resolveDistinctOwnerChannels(owner) {
    const ownerKey = normalizeName(owner);
    if (!ownerKey) return null;
    const channels = state.distinctOwnerColorByName.get(ownerKey);
    if (!Array.isArray(channels) || channels.length !== 3) return null;
    return channels;
  }

  function resolveDistinctOwnerFill(owner, alpha = 0.4) {
    const channels = resolveDistinctOwnerChannels(owner);
    if (!channels) return null;
    const safeAlpha = Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 0.4;
    return `rgba(${channels[0]},${channels[1]},${channels[2]},${safeAlpha})`;
  }

  function reconcileAttackMarkersWithDistricts() {
    if (!state.attackedDistricts.size) return;
    const districtIdSet = mapDistrictIdSet();
    let changed = false;
    for (const districtKey of state.attackedDistricts.keys()) {
      if (!districtIdSet.has(districtKey)) {
        state.attackedDistricts.delete(districtKey);
        changed = true;
      }
    }
    if (changed) {
      syncAttackAnimationTicker();
    }
  }

  function reconcilePoliceActionsWithDistricts() {
    if (!state.policeDistrictActions.size) return;
    const districtIdSet = mapDistrictIdSet();
    let changed = false;
    for (const districtKey of state.policeDistrictActions.keys()) {
      if (!districtIdSet.has(districtKey)) {
        state.policeDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    if (changed) {
      syncAttackAnimationTicker();
    }
  }

  function reconcileSpyActionsWithDistricts() {
    if (!state.spyDistrictActions.size) return;
    const districtIdSet = mapDistrictIdSet();
    let changed = false;
    for (const districtKey of state.spyDistrictActions.keys()) {
      if (!districtIdSet.has(districtKey)) {
        state.spyDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    if (changed) {
      syncAttackAnimationTicker();
    }
  }

  function reconcileRaidActionsWithDistricts() {
    if (!state.raidDistrictActions.size) return;
    const districtIdSet = mapDistrictIdSet();
    let changed = false;
    for (const districtKey of state.raidDistrictActions.keys()) {
      if (!districtIdSet.has(districtKey)) {
        state.raidDistrictActions.delete(districtKey);
        changed = true;
      }
    }
    if (changed) {
      syncAttackAnimationTicker();
    }
  }

  function markDistrictUnderAttack(districtId, options = {}) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) {
      return { ok: false, reason: "invalid_district" };
    }
    const districtExists = Boolean(resolveDistrictById(districtKey));
    if (!districtExists) {
      return { ok: false, reason: "district_not_found" };
    }

    const now = Date.now();
    const durationMs = resolveAttackMarkerDurationMs(options?.durationMs);
    const attackerDistrictKey = normalizeDistrictId(options?.attackerDistrictId);
    const markerSeed = hashOwner(`${attackerDistrictKey || "unknown"}:${districtKey}:attack-marker`);

    state.attackedDistricts.set(districtKey, {
      districtId: districtKey,
      attackerDistrictId: attackerDistrictKey || null,
      source: String(options?.source || "combat").trim() || "combat",
      startedAt: now,
      expiresAt: now + durationMs,
      seed: markerSeed,
      flameAnchors: null
    });
    const deferRender = Boolean(options?.deferRender || options?.silent);
    if (!deferRender) {
      syncAttackAnimationTicker();
      render();
    }

    return { ok: true };
  }

  function setUnderAttackDistricts(markers, options = {}) {
    const safeMarkers = Array.isArray(markers) ? markers : [];
    const replace = options?.replace !== false;
    if (replace) {
      state.attackedDistricts.clear();
    }
    safeMarkers.forEach((item) => {
      const districtId = item?.districtId ?? item?.id;
      if (districtId == null) return;
      markDistrictUnderAttack(districtId, {
        attackerDistrictId: item?.attackerDistrictId,
        durationMs: item?.durationMs,
        source: item?.source,
        deferRender: true
      });
    });
    syncAttackAnimationTicker();
    render();
  }

  function markDistrictPoliceAction(districtId, options = {}) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) {
      return { ok: false, reason: "invalid_district" };
    }
    const districtExists = Boolean(resolveDistrictById(districtKey));
    if (!districtExists) {
      return { ok: false, reason: "district_not_found" };
    }

    const now = Date.now();
    const durationMs = resolvePoliceActionDurationMs(options?.durationMs);
    const markerSeed = hashOwner(`${districtKey}:${String(options?.source || "police-action")}:police-action`);
    const operationType = String(options?.operationType || "").trim();
    const raidSpecialtyKey = String(options?.raidSpecialtyKey || "").trim();

    state.policeDistrictActions.set(districtKey, {
      districtId: districtKey,
      source: String(options?.source || "police-action").trim() || "police-action",
      operationType,
      raidSpecialtyKey,
      startedAt: now,
      expiresAt: now + durationMs,
      seed: markerSeed
    });
    document.dispatchEvent(new CustomEvent("empire:police-action-started", {
      detail: {
        districtId: districtKey,
        durationMs,
        source: String(options?.source || "police-action").trim() || "police-action",
        operationType,
        raidSpecialtyKey,
        startedAt: now
      }
    }));
    const deferRender = Boolean(options?.deferRender || options?.silent);
    if (!deferRender) {
      syncAttackAnimationTicker();
      render();
    }

    return { ok: true };
  }

  function setPoliceActionDistricts(markers, options = {}) {
    const safeMarkers = Array.isArray(markers) ? markers : [];
    const replace = options?.replace !== false;
    if (replace) {
      state.policeDistrictActions.clear();
    }
    safeMarkers.forEach((item) => {
      const districtId = item?.districtId ?? item?.id;
      if (districtId == null) return;
      markDistrictPoliceAction(districtId, {
        durationMs: item?.durationMs,
        source: item?.source,
        deferRender: true
      });
    });
    syncAttackAnimationTicker();
    render();
  }

  function markDistrictSpyAction(districtId, options = {}) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) {
      return { ok: false, reason: "invalid_district" };
    }
    const districtExists = Boolean(resolveDistrictById(districtKey));
    if (!districtExists) {
      return { ok: false, reason: "district_not_found" };
    }

    const now = Date.now();
    const durationMs = resolveSpyActionDurationMs(options?.durationMs);
    const markerSeed = hashOwner(`${districtKey}:${String(options?.source || "spy-action")}:spy-action`);

    state.spyDistrictActions.set(districtKey, {
      districtId: districtKey,
      source: String(options?.source || "spy-action").trim() || "spy-action",
      startedAt: now,
      expiresAt: now + durationMs,
      seed: markerSeed
    });
    syncAttackAnimationTicker();
    render();

    return { ok: true };
  }

  function setSpyActionDistricts(markers, options = {}) {
    const safeMarkers = Array.isArray(markers) ? markers : [];
    const replace = options?.replace !== false;
    if (replace) {
      state.spyDistrictActions.clear();
    }
    safeMarkers.forEach((item) => {
      const districtId = item?.districtId ?? item?.id;
      if (districtId == null) return;
      markDistrictSpyAction(districtId, {
        durationMs: item?.durationMs,
        source: item?.source
      });
    });
    if (!safeMarkers.length && replace) {
      syncAttackAnimationTicker();
      render();
    }
  }

  function setBountyDistrictMarkers(markers) {
    state.bountyDistrictMarkers.clear();
    const safeMarkers = Array.isArray(markers) ? markers : [];
    safeMarkers.forEach((marker) => {
      const districtKey = normalizeDistrictId(marker?.districtId);
      if (!districtKey) return;
      state.bountyDistrictMarkers.set(districtKey, {
        districtId: marker?.districtId,
        count: Math.max(1, Math.floor(Number(marker?.count || 1))),
        targetName: String(marker?.targetName || "").trim(),
        huntModeActive: Boolean(marker?.huntModeActive)
      });
    });
    reconcileBountyMarkersWithDistricts();
    render();
  }

  function clearBountyDistrictMarkers() {
    if (!state.bountyDistrictMarkers.size) return;
    state.bountyDistrictMarkers.clear();
    render();
  }

  function markDistrictRaidAction(districtId, options = {}) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) {
      return { ok: false, reason: "invalid_district" };
    }
    const districtExists = Boolean(resolveDistrictById(districtKey));
    if (!districtExists) {
      return { ok: false, reason: "district_not_found" };
    }

    const now = Date.now();
    const durationMs = resolveRaidActionDurationMs(options?.durationMs);
    const markerSeed = hashOwner(`${districtKey}:${String(options?.source || "raid-action")}:raid-action`);

    state.raidDistrictActions.set(districtKey, {
      districtId: districtKey,
      source: String(options?.source || "raid-action").trim() || "raid-action",
      startedAt: now,
      expiresAt: now + durationMs,
      seed: markerSeed
    });
    syncAttackAnimationTicker();
    render();

    return { ok: true };
  }

  function clearDistrictRaidAction(districtId) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return;
    if (!state.raidDistrictActions.delete(districtKey)) return;
    syncAttackAnimationTicker();
    render();
  }

  function clearAllRaidActions() {
    if (!state.raidDistrictActions.size) return;
    state.raidDistrictActions.clear();
    syncAttackAnimationTicker();
    render();
  }

  function clearDistrictUnderAttack(districtId) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return;
    if (!state.attackedDistricts.delete(districtKey)) return;
    syncAttackAnimationTicker();
    render();
  }

  function clearAllUnderAttackDistricts() {
    if (!state.attackedDistricts.size) return;
    state.attackedDistricts.clear();
    syncAttackAnimationTicker();
    render();
  }

  function clearDistrictPoliceAction(districtId) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return;
    if (!state.policeDistrictActions.delete(districtKey)) return;
    syncAttackAnimationTicker();
    render();
  }

  function clearAllPoliceActions() {
    if (!state.policeDistrictActions.size) return;
    state.policeDistrictActions.clear();
    syncAttackAnimationTicker();
    render();
  }

  function clearDistrictSpyAction(districtId) {
    const districtKey = normalizeDistrictId(districtId);
    if (!districtKey) return;
    if (!state.spyDistrictActions.delete(districtKey)) return;
    syncAttackAnimationTicker();
    render();
  }

  function clearAllSpyActions() {
    if (!state.spyDistrictActions.size) return;
    state.spyDistrictActions.clear();
    syncAttackAnimationTicker();
    render();
  }

  function drawDistrictPolygonPath(ctx, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    ctx.beginPath();
    polygon.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    return true;
  }

  function polygonBounds(poly) {
    const points = Array.isArray(poly) ? poly : [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.forEach((point) => {
      const x = Number(point?.[0] || 0);
      const y = Number(point?.[1] || 0);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    };
  }

  function getPolygonHorizontalSegmentsAtY(poly, y, epsilon = 0.0001) {
    const points = Array.isArray(poly) ? poly : [];
    const targetY = Number(y);
    if (points.length < 3 || !Number.isFinite(targetY)) return [];
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const x1 = Number(current?.[0] || 0);
      const y1 = Number(current?.[1] || 0);
      const x2 = Number(next?.[0] || 0);
      const y2 = Number(next?.[1] || 0);
      if (Math.abs(y2 - y1) <= epsilon) continue;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (targetY < minY || targetY >= maxY) continue;
      const ratio = (targetY - y1) / (y2 - y1);
      intersections.push(x1 + (x2 - x1) * ratio);
    }
    intersections.sort((a, b) => a - b);
    const segments = [];
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const startX = intersections[index];
      const endX = intersections[index + 1];
      if (!Number.isFinite(startX) || !Number.isFinite(endX)) continue;
      if (endX - startX <= epsilon) continue;
      segments.push([startX, endX]);
    }
    return segments;
  }

  function createSeededRandom(seed) {
    let value = (Math.floor(Number(seed) || 0) >>> 0) || 1;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function clampUnit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  }

  function resolveAttackFlameAnchorCount(bounds) {
    const width = Math.max(20, Number(bounds?.width || 0));
    const height = Math.max(20, Number(bounds?.height || 0));
    const area = width * height;
    return Math.max(3, Math.min(8, Math.round(area / 8800) + 3));
  }

  function createAttackFlameAnchors(district, marker, bounds) {
    const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
    if (polygon.length < 3) return [];
    const safeBounds = bounds && Number.isFinite(bounds.width) ? bounds : polygonBounds(polygon);
    const width = Math.max(20, safeBounds.width || 0);
    const height = Math.max(20, safeBounds.height || 0);
    const targetCount = resolveAttackFlameAnchorCount(safeBounds);
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 1;
    const random = createSeededRandom(safeSeed ^ 0x4c7f9d1b);
    const anchors = [];
    const aspectRatio = width / Math.max(1, height);
    const cols = Math.max(1, Math.ceil(Math.sqrt(targetCount * aspectRatio)));
    const rows = Math.max(1, Math.ceil(targetCount / cols));
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const minDistance = Math.max(4, Math.min(cellWidth, cellHeight) * 0.45);
    const candidatePoints = [];
    const probeOffsets = [
      [0, 0],
      [0.22, -0.18],
      [-0.2, 0.2],
      [0.18, 0.24],
      [-0.18, -0.18],
      [0.36, 0],
      [-0.36, 0],
      [0, 0.34],
      [0, -0.34]
    ];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const centerX = safeBounds.minX + (col + 0.5) * cellWidth;
        const centerY = safeBounds.minY + (row + 0.5) * cellHeight;
        const jitterX = (random() - 0.5) * cellWidth * 0.28;
        const jitterY = (random() - 0.5) * cellHeight * 0.28;
        let accepted = null;

        for (let i = 0; i < probeOffsets.length; i += 1) {
          const [ox, oy] = probeOffsets[(i + col + row) % probeOffsets.length];
          const x = centerX + jitterX + ox * cellWidth * 0.32;
          const y = centerY + jitterY + oy * cellHeight * 0.32;
          if (pointInPolygon([x, y], polygon)) {
            accepted = { x, y };
            break;
          }
        }

        if (accepted) {
          candidatePoints.push(accepted);
        }
      }
    }

    if (candidatePoints.length > targetCount) {
      const stride = candidatePoints.length / targetCount;
      for (let i = 0; i < targetCount; i += 1) {
        const index = Math.min(candidatePoints.length - 1, Math.floor((i + 0.5) * stride));
        anchors.push(candidatePoints[index]);
      }
    } else {
      anchors.push(...candidatePoints);
    }

    const pointTooClose = (point, points, distance) => points.some((existing) =>
      Math.hypot(point.x - existing.x, point.y - existing.y) < distance
    );

    let tries = 0;
    const maxTries = targetCount * 120;
    while (anchors.length < targetCount && tries < maxTries) {
      const candidate = {
        x: safeBounds.minX + random() * width,
        y: safeBounds.minY + random() * height
      };
      if (!pointInPolygon([candidate.x, candidate.y], polygon)) {
        tries += 1;
        continue;
      }
      if (pointTooClose(candidate, anchors, minDistance * 0.72)) {
        tries += 1;
        continue;
      }
      anchors.push(candidate);
      tries += 1;
    }

    const [cx, cy] = polygonCentroid(polygon);
    while (anchors.length < targetCount) {
      const angle = random() * Math.PI * 2;
      const radius = Math.min(width, height) * (0.1 + random() * 0.24);
      anchors.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    }

    return anchors.slice(0, targetCount).map((point) => ({
      x: point.x,
      y: point.y,
      scale: 0.56 + random() * 0.62,
      phase: random() * Math.PI * 2,
      jitter: 0.5 + random() * 0.9
    }));
  }

  function getAttackFlameAnchors(district, marker, bounds) {
    if (!marker || typeof marker !== "object") return [];
    if (!Array.isArray(marker.flameAnchors) || !marker.flameAnchors.length) {
      marker.flameAnchors = createAttackFlameAnchors(district, marker, bounds);
    }
    return marker.flameAnchors;
  }

  function samplePointInsidePolygon(polygon, bounds, random, maxTries = 140) {
    const safePolygon = Array.isArray(polygon) ? polygon : [];
    if (safePolygon.length < 3) return { x: 0, y: 0 };
    const safeBounds = bounds && Number.isFinite(bounds.width) ? bounds : polygonBounds(safePolygon);
    const width = Math.max(1, Number(safeBounds.width || 1));
    const height = Math.max(1, Number(safeBounds.height || 1));
    const tries = Math.max(20, Math.floor(Number(maxTries) || 140));
    for (let i = 0; i < tries; i += 1) {
      const x = safeBounds.minX + random() * width;
      const y = safeBounds.minY + random() * height;
      if (pointInPolygon([x, y], safePolygon)) {
        return { x, y };
      }
    }
    const [cx, cy] = polygonCentroid(safePolygon);
    return { x: cx, y: cy };
  }

  function resolveDestroyedCrackCount(bounds) {
    const width = Math.max(20, Number(bounds?.width || 0));
    const height = Math.max(20, Number(bounds?.height || 0));
    const area = width * height;
    return Math.max(22, Math.min(64, Math.round(area / 4200)));
  }

  function createDestroyedCrackPolyline(startPoint, direction, length, random, polygon) {
    const points = [{ x: startPoint.x, y: startPoint.y }];
    const safeLength = Math.max(10, Number(length || 0));
    const minStep = Math.max(4, safeLength * 0.09);
    const maxStep = Math.max(minStep + 2, safeLength * 0.25);
    const stepCount = Math.max(2, Math.floor(2 + random() * 3));
    let remaining = safeLength;
    let angle = direction;
    let current = startPoint;

    for (let step = 0; step < stepCount && remaining > 2; step += 1) {
      const stepLength = Math.min(remaining, minStep + random() * (maxStep - minStep));
      const nextAngle = angle + (random() - 0.5) * 0.72;
      const candidate = {
        x: current.x + Math.cos(nextAngle) * stepLength,
        y: current.y + Math.sin(nextAngle) * stepLength
      };
      if (!pointInPolygon([candidate.x, candidate.y], polygon)) {
        angle = nextAngle + Math.PI * (0.7 + random() * 0.4);
        continue;
      }
      points.push(candidate);
      current = candidate;
      angle = nextAngle;
      remaining -= stepLength;
    }

    return points;
  }

  function buildDestroyedCrackSegments(district, safeSeed, bounds) {
    const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
    if (polygon.length < 3) return [];
    const random = createSeededRandom(safeSeed ^ 0x5a7b3c1d);
    const crackCount = resolveDestroyedCrackCount(bounds);
    const minDimension = Math.max(20, Math.min(bounds.width || 20, bounds.height || 20));
    const segments = [];

    for (let i = 0; i < crackCount; i += 1) {
      const start = samplePointInsidePolygon(polygon, bounds, random);
      const angle = random() * Math.PI * 2;
      const length = minDimension * (0.16 + random() * 0.5);
      const primary = createDestroyedCrackPolyline(start, angle, length, random, polygon);
      if (primary.length > 1) {
        segments.push({
          points: primary,
          width: 0.7 + random() * 1.1,
          alpha: 0.08 + random() * 0.12
        });
      }

      if (primary.length > 2 && random() < 0.45) {
        const branchOrigin = primary[Math.max(1, Math.floor(random() * (primary.length - 1)))];
        const branchAngle = angle + (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.9);
        const branchLength = length * (0.25 + random() * 0.35);
        const branch = createDestroyedCrackPolyline(branchOrigin, branchAngle, branchLength, random, polygon);
        if (branch.length > 1) {
          segments.push({
            points: branch,
            width: 0.5 + random() * 0.8,
            alpha: 0.06 + random() * 0.08
          });
        }
      }
    }

    return segments;
  }

  function getDestroyedCrackSegments(district, safeSeed, bounds) {
    if (!district || typeof district !== "object") return [];
    const cachedSeed = Number(district.__destroyedCrackSeed);
    const cachedSegments = district.__destroyedCrackSegments;
    if (cachedSeed === safeSeed && Array.isArray(cachedSegments) && cachedSegments.length) {
      return cachedSegments;
    }
    const next = buildDestroyedCrackSegments(district, safeSeed, bounds);
    district.__destroyedCrackSeed = safeSeed;
    district.__destroyedCrackSegments = next;
    return next;
  }

  function drawAttackSmokeInDistrict(ctx, district, marker, now, cx, cy, bounds, pulse, lifeRatio) {
    if (!drawDistrictPolygonPath(ctx, district.polygon)) return;
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const random = createSeededRandom(safeSeed ^ 0x1e3d5a77);
    const baseRadius = Math.max(16, Math.min(52, Math.min(bounds.width || 16, bounds.height || 16) * 0.42));
    const smokeStrength = Math.max(0.24, 0.52 - lifeRatio * 0.17);

    ctx.save();
    drawDistrictPolygonPath(ctx, district.polygon);
    ctx.clip();
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < 8; i += 1) {
      const drift = Math.sin(now / 820 + i * 0.62 + safeSeed * 0.00013);
      const x = cx + (random() - 0.5) * baseRadius * 1.6 + drift * baseRadius * 0.14;
      const y = cy - baseRadius * (0.32 + random() * 0.3) - Math.abs(drift) * baseRadius * 0.18;
      const radius = baseRadius * (0.65 + random() * 0.85 + pulse * 0.16);
      const alphaCore = smokeStrength * (0.7 + random() * 0.3);
      const alphaMid = alphaCore * 0.62;
      const gradient = ctx.createRadialGradient(x, y, radius * 0.16, x, y, radius);
      gradient.addColorStop(0, `rgba(28, 28, 32, ${alphaCore.toFixed(3)})`);
      gradient.addColorStop(0.58, `rgba(20, 20, 24, ${alphaMid.toFixed(3)})`);
      gradient.addColorStop(1, "rgba(12, 12, 14, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawAttackSmokeInNeighborDistricts(ctx, district, marker, now, cx, cy, bounds, pulse, lifeRatio) {
    const neighbors = resolveNeighborDistricts(district?.id, 5);
    if (!neighbors.length) return;
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;

    neighbors.forEach((neighbor, index) => {
      if (!Array.isArray(neighbor?.polygon) || neighbor.polygon.length < 3) return;
      const [nx, ny] = polygonCentroid(neighbor.polygon);
      const mix = 0.58 + index * 0.03;
      const smokeX = cx + (nx - cx) * mix;
      const smokeY = cy + (ny - cy) * mix - (bounds.height || 20) * 0.06;
      const baseRadius = Math.max(14, Math.min(40, Math.min(bounds.width || 14, bounds.height || 14) * 0.34));
      const radius = baseRadius * (1.24 + pulse * 0.16 + index * 0.08);
      const strength = Math.max(0.08, (0.24 - index * 0.03) * (1 - lifeRatio * 0.3));
      if (strength <= 0.01) return;

      ctx.save();
      drawDistrictPolygonPath(ctx, neighbor.polygon);
      ctx.clip();
      ctx.globalCompositeOperation = "source-over";
      const sway = Math.sin((now / 900) + index + safeSeed * 0.00009) * radius * 0.06;
      const gradient = ctx.createRadialGradient(smokeX + sway, smokeY, radius * 0.14, smokeX + sway, smokeY, radius);
      gradient.addColorStop(0, `rgba(24, 24, 28, ${strength.toFixed(3)})`);
      gradient.addColorStop(0.62, `rgba(18, 18, 22, ${(strength * 0.55).toFixed(3)})`);
      gradient.addColorStop(1, "rgba(10, 10, 12, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(smokeX + sway, smokeY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawAttackAmbientSmokeAroundDistrict(ctx, marker, now, cx, cy, bounds, pulse, lifeRatio) {
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const spreadBase = Math.max(34, Math.min(120, Math.max(bounds.width || 34, bounds.height || 34) * 0.6));
    const intensity = Math.max(0.06, 0.18 - lifeRatio * 0.06);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * 2 * i) / 4 + (safeSeed % 31) * 0.04;
      const drift = Math.sin(now / 980 + i * 0.7 + safeSeed * 0.00007);
      const centerX = cx + Math.cos(angle) * spreadBase * (0.42 + i * 0.08) + drift * spreadBase * 0.08;
      const centerY = cy + Math.sin(angle) * spreadBase * (0.26 + i * 0.06) - spreadBase * 0.14;
      const radius = spreadBase * (0.95 + pulse * 0.2 + i * 0.18);
      const coreAlpha = intensity * (0.65 - i * 0.1);
      if (coreAlpha <= 0.01) continue;
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.12, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(26, 26, 30, ${coreAlpha.toFixed(3)})`);
      gradient.addColorStop(0.6, `rgba(18, 18, 22, ${(coreAlpha * 0.55).toFixed(3)})`);
      gradient.addColorStop(1, "rgba(10, 10, 12, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawAttackFlameSprite(ctx, x, y, size, alpha, phase, pulse) {
    const safeSize = Math.max(10, Number(size || 0));
    const safeAlpha = Math.max(0.12, Math.min(1, Number(alpha || 0)));
    const wobble = Math.sin(Date.now() / 140 + Number(phase || 0)) * safeSize * 0.05;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + pulse * 0.04, 1 + pulse * 0.08);
    ctx.globalAlpha = safeAlpha;

    const outerGradient = ctx.createLinearGradient(0, safeSize * 0.62, 0, -safeSize * 0.88);
    outerGradient.addColorStop(0, "rgba(120, 16, 0, 0.96)");
    outerGradient.addColorStop(0.36, "rgba(255, 94, 0, 0.94)");
    outerGradient.addColorStop(0.72, "rgba(255, 174, 36, 0.9)");
    outerGradient.addColorStop(1, "rgba(255, 241, 153, 0.84)");

    ctx.beginPath();
    ctx.moveTo(0, -safeSize * 0.92 + wobble);
    ctx.bezierCurveTo(
      safeSize * 0.52, -safeSize * 0.48,
      safeSize * 0.62, safeSize * 0.04,
      0, safeSize * 0.7
    );
    ctx.bezierCurveTo(
      -safeSize * 0.62, safeSize * 0.04,
      -safeSize * 0.52, -safeSize * 0.48,
      0, -safeSize * 0.92 + wobble
    );
    ctx.closePath();
    ctx.fillStyle = outerGradient;
    ctx.shadowBlur = safeSize * 0.5;
    ctx.shadowColor = "rgba(255, 98, 0, 0.72)";
    ctx.fill();

    const innerGradient = ctx.createLinearGradient(0, safeSize * 0.48, 0, -safeSize * 0.56);
    innerGradient.addColorStop(0, "rgba(255, 164, 40, 0.92)");
    innerGradient.addColorStop(0.46, "rgba(255, 219, 115, 0.9)");
    innerGradient.addColorStop(1, "rgba(255, 248, 214, 0.82)");

    ctx.beginPath();
    ctx.moveTo(0, -safeSize * 0.56 + wobble * 0.6);
    ctx.bezierCurveTo(
      safeSize * 0.28, -safeSize * 0.22,
      safeSize * 0.26, safeSize * 0.1,
      0, safeSize * 0.42
    );
    ctx.bezierCurveTo(
      -safeSize * 0.26, safeSize * 0.1,
      -safeSize * 0.28, -safeSize * 0.22,
      0, -safeSize * 0.56 + wobble * 0.6
    );
    ctx.closePath();
    ctx.fillStyle = innerGradient;
    ctx.shadowBlur = safeSize * 0.24;
    ctx.shadowColor = "rgba(255, 214, 120, 0.7)";
    ctx.fill();

    ctx.restore();
  }

  function drawDestroyedDistrictSmoke(ctx, district, now, safeSeed, cx, cy, bounds) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();
      for (let i = 0; i < 3; i += 1) {
        const angle = (Math.PI * 2 * i) / 3 + (safeSeed % 37) * 0.01;
        const drift = Math.sin(now / (5200 + i * 900) + i + safeSeed * 0.00007) * 4;
        const smokeX = cx + Math.cos(angle) * (bounds.width * (0.1 + i * 0.05)) + drift;
        const smokeY = cy + Math.sin(angle) * (bounds.height * (0.08 + i * 0.04)) - bounds.height * 0.12;
        const radius = Math.max(22, Math.min(72, Math.max(bounds.width, bounds.height) * (0.22 + i * 0.06)));
        const gradient = ctx.createRadialGradient(smokeX, smokeY, radius * 0.12, smokeX, smokeY, radius);
        gradient.addColorStop(0, "rgba(38, 38, 44, 0.10)");
        gradient.addColorStop(0.62, "rgba(24, 24, 30, 0.06)");
        gradient.addColorStop(1, "rgba(12, 12, 16, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const neighbors = resolveNeighborDistricts(district.id, 2);
    neighbors.forEach((neighbor, index) => {
      if (!neighbor?.polygon || neighbor.polygon.length < 3) return;
      const [nx, ny] = polygonCentroid(neighbor.polygon);
      const nb = polygonBounds(neighbor.polygon);
      const drift = Math.cos(now / (7000 + index * 1100) + safeSeed * 0.00009 + index) * 3;
      const radius = Math.max(26, Math.min(68, Math.max(nb.width, nb.height) * 0.26));
      ctx.save();
      drawDistrictPolygonPath(ctx, neighbor.polygon);
      ctx.clip();
      const haze = ctx.createRadialGradient(nx + drift, ny - nb.height * 0.08, radius * 0.12, nx + drift, ny - nb.height * 0.08, radius);
      haze.addColorStop(0, "rgba(30, 30, 36, 0.07)");
      haze.addColorStop(0.6, "rgba(22, 22, 28, 0.04)");
      haze.addColorStop(1, "rgba(12, 12, 16, 0)");
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(nx + drift, ny - nb.height * 0.08, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawDestroyedDistrictEffect(ctx, district, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const marker = {
      seed: hashOwner(`destroyed:${normalizeDistrictId(district?.id) || district?.name || "district"}`)
    };
    const safeSeed = Number.isFinite(Number(marker.seed)) ? Number(marker.seed) : 0;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();

      const radius = Math.max(bounds.width || 20, bounds.height || 20) * 0.92;
      const charLayer = ctx.createRadialGradient(
        cx + Math.sin(now / 3900 + safeSeed * 0.00003) * 5,
        cy - Math.cos(now / 4400 + safeSeed * 0.00004) * 4,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      charLayer.addColorStop(0, "rgba(10, 10, 12, 0.98)");
      charLayer.addColorStop(0.34, "rgba(7, 7, 9, 0.96)");
      charLayer.addColorStop(0.72, "rgba(4, 4, 6, 0.95)");
      charLayer.addColorStop(1, "rgba(2, 2, 4, 0.98)");
      ctx.fillStyle = charLayer;
      ctx.fillRect(bounds.minX - 8, bounds.minY - 8, bounds.width + 16, bounds.height + 16);

      const crackSegments = getDestroyedCrackSegments(district, safeSeed, bounds);
      ctx.globalCompositeOperation = "screen";
      crackSegments.forEach((segment, index) => {
        const points = Array.isArray(segment?.points) ? segment.points : [];
        if (points.length < 2) return;
        const alpha = Math.max(0.04, Math.min(0.24, Number(segment.alpha || 0.1)));
        const hueBoost = index % 6;
        ctx.strokeStyle = `rgba(255, ${Math.round(64 + hueBoost * 5)}, 18, ${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.4, Math.min(2.2, Number(segment.width || 0.8)));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length; p += 1) {
          ctx.lineTo(points[p].x, points[p].y);
        }
        ctx.stroke();
      });

      const craterGlow = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius * 0.52);
      craterGlow.addColorStop(0, "rgba(255, 112, 24, 0.16)");
      craterGlow.addColorStop(0.35, "rgba(255, 78, 18, 0.09)");
      craterGlow.addColorStop(1, "rgba(255, 52, 12, 0)");
      ctx.fillStyle = craterGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.52, 0, Math.PI * 2);
      ctx.fill();

      const emberCount = 12;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < emberCount; i += 1) {
        const ring = 0.12 + (i % 5) * 0.055;
        const angle = (Math.PI * 2 * i) / emberCount + (safeSeed % 41) * 0.01 + i * 0.24;
        const distance = Math.min(bounds.width || 26, bounds.height || 26) * ring + (i % 4) * 2.1;
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance * 0.78;
        const size = 0.65 + (i % 3) * 0.5;
        const alpha = 0.08 - (i % 4) * 0.013;
        if (alpha <= 0.03) continue;
        ctx.fillStyle = `rgba(255, ${Math.round(95 + i * 2.5)}, 28, ${Math.min(0.2, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const ashCount = 14;
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < ashCount; i += 1) {
        const phase = i * 0.71 + safeSeed * 0.0009;
        const driftX = Math.sin(now / (2900 + (i % 4) * 300) + phase) * (3 + (i % 3) * 1.4);
        const rise = ((now / (3100 + (i % 5) * 460) + i * 0.11) % 1);
        const anchorAngle = (Math.PI * 2 * i) / ashCount + phase * 0.23;
        const anchorRadius = radius * (0.08 + (i % 6) * 0.03);
        const baseX = cx + Math.cos(anchorAngle) * anchorRadius;
        const baseY = cy + Math.sin(anchorAngle) * anchorRadius * 0.72;
        const x = baseX + driftX;
        const y = baseY - rise * (12 + (i % 5) * 5);
        const size = 0.55 + (i % 3) * 0.25;
        const alpha = 0.06 * (1 - rise);
        if (alpha <= 0.008) continue;
        ctx.fillStyle = `rgba(88, 88, 96, ${Math.min(0.08, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawDestroyedDistrictSmoke(ctx, district, now, safeSeed, cx, cy, bounds);
  }

  function drawDistrictTrapToxicMist(ctx, district, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const trapState = window.Empire.UI?.getDistrictTrapControlState?.(district);
    if (!trapState?.isActiveHere) return;

    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const safeSeed = hashOwner(`trap:${normalizeDistrictId(district?.id) || district?.name || "district"}`);
    const particleCount = Math.max(12, Math.min(22, Math.round(Math.max(bounds.width || 18, bounds.height || 18) / 7)));
    const baseRadius = Math.max(1.8, Math.min(4.6, Math.min(bounds.width || 18, bounds.height || 18) * 0.041));

    if (!drawDistrictPolygonPath(ctx, district.polygon)) return;

    ctx.save();
    drawDistrictPolygonPath(ctx, district.polygon);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";

    const pulse = 0.5 + 0.5 * Math.sin(now / 320 + safeSeed * 0.00019);
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(bounds.width || 24, bounds.height || 24) * 0.8);
    coreGlow.addColorStop(0, `rgba(214, 255, 82, ${(0.18 + pulse * 0.1).toFixed(3)})`);
    coreGlow.addColorStop(0.35, `rgba(57, 255, 20, ${(0.16 + pulse * 0.08).toFixed(3)})`);
    coreGlow.addColorStop(0.7, `rgba(0, 255, 170, ${(0.12 + pulse * 0.06).toFixed(3)})`);
    coreGlow.addColorStop(1, "rgba(0, 255, 170, 0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(bounds.width || 24, bounds.height || 24) * 0.8, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < particleCount; i += 1) {
      const phase = i * 0.73 + safeSeed * 0.00011;
      const progress = ((now / (4300 + (i % 5) * 260)) + i * 0.124 + safeSeed * 0.0000017) % 1;
      const rise = 1 - progress;
      const lateralBase = Math.sin(phase * 2.1) * (bounds.width || 20) * 0.22;
      const sway = Math.sin(now / (640 + (i % 4) * 90) + phase) * (3.2 + (i % 3) * 1.2);
      const drift = Math.cos(now / (920 + (i % 6) * 84) + phase * 1.7) * (1.8 + (i % 2) * 1.1);
      const x = cx + lateralBase + sway + drift;
      const y = cy + (bounds.height || 20) * (0.28 - rise * 0.6) + Math.sin(phase) * 4;
      const radius = baseRadius * (0.9 + (i % 4) * 0.26);
      const alpha = 0.14 + ((Math.sin(now / 540 + phase) + 1) * 0.5) * 0.14;
      const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius * 2.6);
      gradient.addColorStop(0, `rgba(240, 255, 110, ${Math.min(0.34, alpha + 0.09).toFixed(3)})`);
      gradient.addColorStop(0.24, `rgba(132, 255, 0, ${Math.min(0.3, alpha + 0.06).toFixed(3)})`);
      gradient.addColorStop(0.58, `rgba(0, 255, 157, ${Math.min(0.24, alpha).toFixed(3)})`);
      gradient.addColorStop(0.82, `rgba(0, 230, 255, ${Math.min(0.18, alpha * 0.82).toFixed(3)})`);
      gradient.addColorStop(1, "rgba(22, 163, 74, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();

      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(201, 255, 84, ${Math.min(0.24, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(phase) * 1.8, y - radius * 0.3, radius * 0.56, 0, Math.PI * 2);
        ctx.fill();
      }

      if (i % 4 === 1) {
        ctx.fillStyle = `rgba(0, 255, 170, ${Math.min(0.2, alpha * 0.92).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x - Math.sin(phase) * 1.4, y + radius * 0.22, radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const borderPulse = 0.5 + 0.5 * Math.sin(now / 540 + safeSeed * 0.00017);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 18 + borderPulse * 14;
    ctx.shadowColor = `rgba(57, 255, 20, ${(0.24 + borderPulse * 0.14).toFixed(3)})`;
    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.strokeStyle = `rgba(132, 255, 0, ${(0.22 + borderPulse * 0.12).toFixed(3)})`;
      ctx.lineWidth = 1.5 + borderPulse * 1.15;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -((now / 42 + safeSeed) % 120);
      ctx.stroke();
      ctx.strokeStyle = `rgba(0, 255, 255, ${(0.14 + borderPulse * 0.08).toFixed(3)})`;
      ctx.lineWidth = 0.95 + borderPulse * 0.58;
      ctx.setLineDash([2, 8]);
      ctx.lineDashOffset = (now / 36 + safeSeed) % 120;
      ctx.stroke();
      ctx.strokeStyle = `rgba(240, 255, 110, ${(0.1 + borderPulse * 0.08).toFixed(3)})`;
      ctx.lineWidth = 0.55 + borderPulse * 0.34;
      ctx.setLineDash([1, 7]);
      ctx.lineDashOffset = -((now / 24 + safeSeed) % 120);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawDistrictAttackEffect(ctx, district, marker, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const markerSource = String(marker?.source || "").trim().toLowerCase();
    if (markerSource.includes("occupy")) {
      drawDistrictOccupyEffect(ctx, district, marker, now);
      return;
    }
    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const baseRadius = Math.max(16, Math.min(46, Math.min(bounds.width || 16, bounds.height || 16) * 0.36));
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const concurrentAttacks = Math.max(0, Number(state.attackedDistricts.size || 0));
    const highLoadMode = concurrentAttacks > 8;
    const pulse = 0.86 + Math.sin(now / 170 + safeSeed * 0.0017) * 0.18;
    const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
      ? clampUnit((now - marker.startedAt) / (marker.expiresAt - marker.startedAt))
      : 0;
    const alpha = Math.max(0.32, 0.86 - lifeRatio * 0.42);
    const flameAnchors = getAttackFlameAnchors(district, marker, bounds);

    if (highLoadMode) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0.24, alpha * 0.62);
      const liteGlowRadius = baseRadius * (0.94 + pulse * 0.14);
      const liteGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.14, cx, cy, liteGlowRadius);
      liteGlow.addColorStop(0, "rgba(255, 239, 160, 0.74)");
      liteGlow.addColorStop(0.5, "rgba(255, 96, 0, 0.46)");
      liteGlow.addColorStop(1, "rgba(255, 60, 0, 0)");
      ctx.fillStyle = liteGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, liteGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      if (drawDistrictPolygonPath(ctx, district.polygon)) {
        ctx.strokeStyle = `rgba(255, 108, 18, ${Math.min(0.72, 0.42 + pulse * 0.18)})`;
        ctx.lineWidth = 0.95 + pulse * 0.42;
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = -((now / 58 + safeSeed) % 120);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      return;
    }

    drawAttackAmbientSmokeAroundDistrict(ctx, marker, now, cx, cy, bounds, pulse, lifeRatio);
    drawAttackSmokeInDistrict(ctx, district, marker, now, cx, cy, bounds, pulse, lifeRatio);
    drawAttackSmokeInNeighborDistricts(ctx, district, marker, now, cx, cy, bounds, pulse, lifeRatio);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * 0.9;

    const glowRadius = baseRadius * (1.08 + pulse * 0.26);
    const glow = ctx.createRadialGradient(cx, cy, baseRadius * 0.16, cx, cy, glowRadius);
    glow.addColorStop(0, "rgba(255, 250, 205, 0.92)");
    glow.addColorStop(0.26, "rgba(255, 181, 82, 0.72)");
    glow.addColorStop(0.6, "rgba(255, 92, 0, 0.52)");
    glow.addColorStop(1, "rgba(255, 53, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    const coreFlameSize = Math.max(18, Math.round(baseRadius * (1.02 + pulse * 0.22)));
    const coreWobbleX = Math.sin(now / 175 + safeSeed * 0.0011) * 1.8;
    const coreWobbleY = Math.cos(now / 145 + safeSeed * 0.0014) * 1.1
      - Math.abs(Math.sin(now / 220 + safeSeed * 0.0008)) * 1.6;
    ctx.globalAlpha = Math.max(0.46, alpha * 0.92);
    drawAttackFlameSprite(
      ctx,
      cx + coreWobbleX,
      cy + coreWobbleY,
      coreFlameSize,
      Math.max(0.42, alpha * 0.9),
      safeSeed * 0.00021,
      pulse
    );

    flameAnchors.forEach((anchor) => {
      const safeScale = Math.max(0.5, Math.min(1.7, Number(anchor?.scale || 1)));
      const phase = Number(anchor?.phase || 0);
      const jitterPower = Math.max(0.2, Number(anchor?.jitter || 0.8));
      const wobbleX = Math.sin(now / 205 + phase) * jitterPower * 1.1;
      const wobbleY = Math.cos(now / 165 + phase * 1.7) * jitterPower * 0.82
        - Math.abs(Math.sin(now / 260 + phase)) * 1.7;
      const flameSize = Math.max(
        12,
        Math.round(baseRadius * safeScale * (0.62 + pulse * 0.24 + Math.sin(now / 145 + phase) * 0.12))
      );
      ctx.globalAlpha = Math.max(0.28, alpha * (0.66 + safeScale * 0.18));
      drawAttackFlameSprite(
        ctx,
        Number(anchor.x || cx) + wobbleX,
        Number(anchor.y || cy) + wobbleY,
        flameSize * 0.82,
        Math.max(0.3, alpha * (0.78 + safeScale * 0.16)),
        phase,
        pulse
      );
      ctx.globalAlpha = Math.max(0.2, alpha * (0.36 + safeScale * 0.08));
      ctx.font = `${flameSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 8 + flameSize * 0.4;
      ctx.shadowColor = "rgba(255, 113, 0, 0.9)";
      ctx.fillText("🔥", Number(anchor.x || cx) + wobbleX, Number(anchor.y || cy) + wobbleY);
    });

    ctx.globalAlpha = alpha * 0.54;
    ctx.fillStyle = "rgba(255,132,24,0.36)";
    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7 + now / 700 + safeSeed * 0.00004;
      const radius = baseRadius * (0.14 + (i % 3) * 0.08);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.7 - baseRadius * 0.18;
      const size = 1.2 + (i % 2) * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = Math.max(0.2, alpha * 0.72);
    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.strokeStyle = `rgba(255, 92, 0, ${Math.min(0.9, 0.5 + pulse * 0.25)})`;
      ctx.lineWidth = 1.2 + pulse * 0.95;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -((now / 40 + safeSeed) % 180);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawDistrictOccupyEffect(ctx, district, marker, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const basePulse = (Math.sin(now / 145 + safeSeed * 0.0013) + 1) * 0.5;
    const fastPulse = (Math.sin(now / 72 + safeSeed * 0.0021) + 1) * 0.5;
    const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
      ? clampUnit((now - marker.startedAt) / (marker.expiresAt - marker.startedAt))
      : 0;
    const fade = Math.max(0.38, 1 - lifeRatio * 0.42);
    const baseRadius = Math.max(16, Math.min(58, Math.min(bounds.width || 20, bounds.height || 20) * 0.55));

    const playerHex = normalizeHexColor(localStorage.getItem("empire_gang_color"));
    const playerColor = playerHex ? hexToRgba(playerHex, 1) : "rgba(34,197,94,1)";
    const channels = parseCssColorChannels(playerColor) || [34, 197, 94];
    const [r, g, b] = channels;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();
      ctx.globalCompositeOperation = "screen";

      const fillAlpha = (0.18 + basePulse * 0.26 + fastPulse * 0.2) * fade;
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.72, fillAlpha).toFixed(3)})`;
      ctx.fillRect(bounds.minX - 6, bounds.minY - 6, (bounds.width || 12) + 12, (bounds.height || 12) + 12);

      const coreGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.12, cx, cy, baseRadius * (1.2 + basePulse * 0.55));
      coreGlow.addColorStop(0, `rgba(${r},${g},${b},${(0.72 * fade).toFixed(3)})`);
      coreGlow.addColorStop(0.48, `rgba(${r},${g},${b},${(0.36 * fade).toFixed(3)})`);
      coreGlow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * (1.22 + basePulse * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const strokeAlpha = (0.45 + basePulse * 0.4 + fastPulse * 0.18) * fade;
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(0.94, strokeAlpha).toFixed(3)})`;
      ctx.lineWidth = 2.1 + basePulse * 2.6;
      ctx.setLineDash([9, 6]);
      ctx.lineDashOffset = -((now / 26 + safeSeed) % 220);
      ctx.shadowColor = `rgba(${r},${g},${b},0.88)`;
      ctx.shadowBlur = 10 + basePulse * 14;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawDistrictRaidActionEffect(ctx, district, marker, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const bounds = polygonBounds(district.polygon);
    const [cx, cy] = polygonCentroid(district.polygon);
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const minDimension = Math.max(24, Math.min(bounds.width || 24, bounds.height || 24));
    const maxDimension = Math.max(28, Math.max(bounds.width || 28, bounds.height || 28));
    const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
      ? clampUnit((now - marker.startedAt) / (marker.expiresAt - marker.startedAt))
      : 0;
    const fade = Math.max(0.24, 1 - lifeRatio * 0.38);
    const flicker = 0.42 + ((Math.sin(now / 70 + safeSeed * 0.0021) + 1) * 0.5) * 0.58;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();

      const sweepWidth = Math.max(18, minDimension * 0.46);
      for (let i = 0; i < 3; i += 1) {
        const progress = ((now / (420 + i * 80)) + safeSeed * 0.0007 + i * 0.31) % 1;
        const shadowX = bounds.minX - sweepWidth + progress * (bounds.width + sweepWidth * 2);
        const shadowAlpha = (0.12 + flicker * 0.2) * fade * (1 - i * 0.12);
        const gradient = ctx.createLinearGradient(shadowX, bounds.minY, shadowX + sweepWidth, bounds.maxY);
        gradient.addColorStop(0, "rgba(3,4,7,0)");
        gradient.addColorStop(0.45, `rgba(3,4,7,${shadowAlpha.toFixed(3)})`);
        gradient.addColorStop(1, "rgba(3,4,7,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(shadowX, bounds.minY - 8, sweepWidth, (bounds.height || 20) + 16);
      }

      const glitchCount = 5;
      for (let i = 0; i < glitchCount; i += 1) {
        const phase = (now / (95 + i * 22) + safeSeed * 0.0014 + i) % 1;
        const lineY = bounds.minY + phase * Math.max(12, bounds.height);
        const lineHeight = 1.2 + (i % 2) * 1.4;
        const lineWidth = Math.max(16, maxDimension * (0.42 + (i % 3) * 0.16));
        const offsetX = Math.sin(now / 85 + i + safeSeed * 0.0009) * maxDimension * 0.22;
        ctx.fillStyle = `rgba(148,163,184,${(0.12 + flicker * 0.14).toFixed(3)})`;
        ctx.fillRect(cx - lineWidth / 2 + offsetX, lineY, lineWidth, lineHeight);
      }

      ctx.fillStyle = `rgba(2, 6, 12, ${(0.16 + flicker * 0.12).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(16, minDimension * 0.36), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      ctx.strokeStyle = `rgba(71, 85, 105, ${(0.2 + flicker * 0.16).toFixed(3)})`;
      ctx.lineWidth = 1.2 + flicker * 0.8;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -((now / 38 + safeSeed) % 140);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawDistrictPoliceActionEffect(ctx, district, marker, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const minDimension = Math.max(22, Math.min(bounds.width || 22, bounds.height || 22));
    const baseRadius = Math.max(22, Math.min(64, minDimension * 0.52));
    const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
      ? clampUnit((now - marker.startedAt) / (marker.expiresAt - marker.startedAt))
      : 0;
    const fade = Math.max(0.34, 1 - lifeRatio * 0.45);
    const redPulse = 0.28 + ((Math.sin(now / 145 + safeSeed * 0.0012) + 1) * 0.5) * 0.72;
    const bluePulse = 0.28 + ((Math.sin(now / 145 + Math.PI + safeSeed * 0.0012) + 1) * 0.5) * 0.72;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();
      ctx.globalCompositeOperation = "screen";

      const redGlow = ctx.createRadialGradient(
        cx - baseRadius * 0.32,
        cy - baseRadius * 0.04,
        baseRadius * 0.12,
        cx - baseRadius * 0.32,
        cy - baseRadius * 0.04,
        baseRadius * 1.45
      );
      redGlow.addColorStop(0, `rgba(255, 88, 92, ${(0.44 * redPulse * fade).toFixed(3)})`);
      redGlow.addColorStop(0.62, `rgba(255, 52, 62, ${(0.2 * redPulse * fade).toFixed(3)})`);
      redGlow.addColorStop(1, "rgba(255, 38, 48, 0)");
      ctx.fillStyle = redGlow;
      ctx.beginPath();
      ctx.arc(cx - baseRadius * 0.32, cy - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      const blueGlow = ctx.createRadialGradient(
        cx + baseRadius * 0.32,
        cy - baseRadius * 0.04,
        baseRadius * 0.12,
        cx + baseRadius * 0.32,
        cy - baseRadius * 0.04,
        baseRadius * 1.45
      );
      blueGlow.addColorStop(0, `rgba(64, 179, 255, ${(0.44 * bluePulse * fade).toFixed(3)})`);
      blueGlow.addColorStop(0.62, `rgba(50, 122, 255, ${(0.2 * bluePulse * fade).toFixed(3)})`);
      blueGlow.addColorStop(1, "rgba(42, 90, 255, 0)");
      ctx.fillStyle = blueGlow;
      ctx.beginPath();
      ctx.arc(cx + baseRadius * 0.32, cy - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beaconCount = 4;
    const ringRadius = baseRadius * 0.62;
    for (let i = 0; i < beaconCount; i += 1) {
      const pulse = i % 2 === 0 ? redPulse : bluePulse;
      const isRed = i % 2 === 0;
      const angle = now / 780 + i * ((Math.PI * 2) / beaconCount) + safeSeed * 0.00019;
      const x = cx + Math.cos(angle) * ringRadius;
      const y = cy + Math.sin(angle) * ringRadius * 0.72;
      const beamRadius = baseRadius * (1.62 + pulse * 0.44);
      const beamDirection = now / 330 * (isRed ? 1 : -1) + i * 0.8;
      const beamSpread = 0.36 + pulse * 0.2;
      const beaconColor = isRed
        ? `rgba(255, 66, 72, ${(0.3 + pulse * 0.42) * fade})`
        : `rgba(56, 164, 255, ${(0.3 + pulse * 0.42) * fade})`;

      ctx.fillStyle = beaconColor;
      ctx.shadowBlur = 10 + pulse * 14;
      ctx.shadowColor = isRed ? "rgba(255, 58, 70, 0.95)" : "rgba(52, 150, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(x, y, 3.2 + pulse * 3.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = (0.1 + pulse * 0.16) * fade;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, beamRadius, beamDirection - beamSpread * 0.5, beamDirection + beamSpread * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      const borderMix = redPulse - bluePulse;
      ctx.strokeStyle = borderMix >= 0
        ? `rgba(255, 92, 96, ${Math.max(0.28, 0.4 * fade)})`
        : `rgba(68, 172, 255, ${Math.max(0.28, 0.4 * fade)})`;
      ctx.lineWidth = 1.2 + Math.max(redPulse, bluePulse) * 1.3;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -(now / 52 + safeSeed) % 130;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawDistrictSpyActionEffect(ctx, district, marker, now = Date.now()) {
    if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(district.polygon);
    const bounds = polygonBounds(district.polygon);
    const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
    const maxDimension = Math.max(26, Math.max(bounds.width || 26, bounds.height || 26));
    const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
      ? clampUnit((now - marker.startedAt) / (marker.expiresAt - marker.startedAt))
      : 0;
    const fade = Math.max(0.3, 1 - lifeRatio * 0.5);
    const sweepAngle = now / 470 + safeSeed * 0.00021;
    const coneSpread = 0.36 + Math.sin(now / 620 + safeSeed * 0.00031) * 0.08;
    const beamLength = Math.max(42, Math.min(170, maxDimension * 1.5));
    const originRadiusX = Math.max(10, (bounds.width || 24) * 0.24);
    const originRadiusY = Math.max(8, (bounds.height || 24) * 0.2);
    const originX = cx + Math.cos(sweepAngle * 0.58 + 1.05) * originRadiusX;
    const originY = cy + Math.sin(sweepAngle * 0.54 + 0.67) * originRadiusY;

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.save();
      drawDistrictPolygonPath(ctx, district.polygon);
      ctx.clip();
      ctx.globalCompositeOperation = "screen";

      const beam = ctx.createRadialGradient(originX, originY, beamLength * 0.05, originX, originY, beamLength);
      beam.addColorStop(0, `rgba(242, 255, 216, ${(0.42 * fade).toFixed(3)})`);
      beam.addColorStop(0.28, `rgba(206, 250, 255, ${(0.26 * fade).toFixed(3)})`);
      beam.addColorStop(0.7, `rgba(120, 214, 255, ${(0.1 * fade).toFixed(3)})`);
      beam.addColorStop(1, "rgba(88, 180, 255, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, beamLength, sweepAngle - coneSpread, sweepAngle + coneSpread);
      ctx.closePath();
      ctx.fill();

      const haloRadius = Math.max(14, Math.min(44, maxDimension * 0.34));
      const halo = ctx.createRadialGradient(originX, originY, haloRadius * 0.1, originX, originY, haloRadius);
      halo.addColorStop(0, `rgba(246, 255, 230, ${(0.5 * fade).toFixed(3)})`);
      halo.addColorStop(0.65, `rgba(172, 234, 255, ${(0.2 * fade).toFixed(3)})`);
      halo.addColorStop(1, "rgba(100, 186, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(originX, originY, haloRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(242, 255, 218, ${(0.72 * fade).toFixed(3)})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(214, 249, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(originX, originY, 3.6 + Math.sin(now / 120 + safeSeed * 0.0009) * 0.8, 0, Math.PI * 2);
    ctx.fill();

    if (drawDistrictPolygonPath(ctx, district.polygon)) {
      ctx.strokeStyle = `rgba(166, 235, 255, ${(0.42 * fade).toFixed(3)})`;
      ctx.lineWidth = 1.2 + Math.sin(now / 280 + safeSeed * 0.0012) * 0.4;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -((now / 48 + safeSeed) % 150);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function resolveDistrictAllianceLabel(district) {
    const explicit = String(district?.ownerAllianceName || "").trim();
    if (explicit) return explicit;
    return deriveAllianceNameFromOwnerLabel(district?.owner);
  }

  function resolveDistrictAllianceIconKey(district) {
    const explicit = String(district?.ownerAllianceIconKey || "").trim();
    if (explicit) return explicit;
    return window.Empire.UI?.resolveAllianceIconKeyByName?.(resolveDistrictAllianceLabel(district)) || "";
  }

  function resolveDistrictAllianceIconSymbol(district) {
    const iconKey = resolveDistrictAllianceIconKey(district);
    return ALLIANCE_ICON_SYMBOL_BY_KEY[iconKey] || "";
  }

  function drawDistrictAllianceIcon(ctx, district) {
    if (!ctx || !district?.owner || isDistrictDestroyed(district)) return;
    if (state.vision.showAllianceSymbols === false) return;
    if (shouldHideDistrictByVisibilityMode(district)) return;
    const symbol = resolveDistrictAllianceIconSymbol(district);
    if (!symbol) return;
    const bounds = polygonBounds(district.polygon);
    const minDimension = Math.max(20, Math.min(bounds.width || 20, bounds.height || 20));
    const maxDimension = Math.max(20, Math.max(bounds.width || 20, bounds.height || 20));
    const fontSize = Math.max(14, Math.min(36, minDimension * 0.44));
    const [cx, cy] = polygonCentroid(district.polygon);
    const iconY = cy + Math.min(maxDimension * 0.05, 5);

    ctx.save();
    ctx.font = `900 ${fontSize}px "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2.5, fontSize * 0.14);
    ctx.strokeStyle = "rgba(255,255,255,0.86)";
    ctx.shadowColor = "rgba(255,255,255,0.28)";
    ctx.shadowBlur = Math.max(4, fontSize * 0.18);
    ctx.strokeText(symbol, cx, iconY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(5, 7, 11, 0.96)";
    ctx.fillText(symbol, cx, iconY);
    ctx.restore();
  }

  function resolveAlliancePatternKey(district) {
    if (!district?.owner) return "";
    const allianceLabel = resolveDistrictAllianceLabel(district);
    const normalized = normalizeName(allianceLabel);
    if (!normalized) return "";
    if (normalized === "žádná" || normalized === "bez aliance" || normalized === "none") return "";
    return normalized;
  }

  function resolveAlliancePatternVariant(allianceKey) {
    return hashOwner(`${allianceKey}:pattern`) % 6;
  }

  function resolveAlliancePatternColors(allianceKey) {
    const hue = hashOwner(`${allianceKey}:hue`) % 360;
    const primaryHue = (hue + 175) % 360;
    const secondaryHue = (hue + 312) % 360;
    const tertiaryHue = (hue + 48) % 360;
    return {
      primary: `hsla(${primaryHue}, 100%, 74%, 0.82)`,
      secondary: `hsla(${secondaryHue}, 100%, 70%, 0.66)`,
      tertiary: `hsla(${tertiaryHue}, 100%, 80%, 0.44)`
    };
  }

  function resolveAlliancePatternOpacity(district) {
    if (isDistrictOwnedByPlayer(district)) return 0.5;
    if (isDistrictOwnedByAlly(district)) return 0.46;
    if (isDistrictOwnedByEnemy(district)) return 0.42;
    return 0.38;
  }

  function drawPatternStar(ctx, centerX, centerY, outerRadius, innerRadius, points = 5) {
    const safePoints = Math.max(3, Math.floor(Number(points) || 5));
    const angleStep = Math.PI / safePoints;
    ctx.beginPath();
    for (let i = 0; i < safePoints * 2; i += 1) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function createAlliancePattern(ctx, allianceKey, variant) {
    if (!ctx || typeof document === "undefined") return null;
    const tileSize = 34;
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = tileSize;
    patternCanvas.height = tileSize;
    const patternCtx = patternCanvas.getContext("2d");
    if (!patternCtx) return null;

    const colors = resolveAlliancePatternColors(allianceKey);
    patternCtx.clearRect(0, 0, tileSize, tileSize);
    patternCtx.lineCap = "round";
    patternCtx.lineJoin = "round";

    switch (variant) {
      case 0: {
        patternCtx.fillStyle = colors.primary;
        const points = [[8, 9], [24, 20]];
        points.forEach(([x, y]) => {
          patternCtx.beginPath();
          patternCtx.arc(x, y, 4.1, 0, Math.PI * 2);
          patternCtx.fill();
        });
        patternCtx.fillStyle = colors.tertiary;
        patternCtx.beginPath();
        patternCtx.arc(26, 8, 2.5, 0, Math.PI * 2);
        patternCtx.fill();
        break;
      }
      case 1: {
        patternCtx.strokeStyle = colors.primary;
        patternCtx.lineWidth = 3;
        for (let x = -tileSize; x <= tileSize * 2; x += 14) {
          patternCtx.beginPath();
          patternCtx.moveTo(x, 0);
          patternCtx.lineTo(x + tileSize, tileSize);
          patternCtx.stroke();
        }
        patternCtx.strokeStyle = colors.tertiary;
        patternCtx.lineWidth = 2;
        for (let x = -tileSize; x <= tileSize * 2; x += 14) {
          patternCtx.beginPath();
          patternCtx.moveTo(x + 6, 0);
          patternCtx.lineTo(x + tileSize + 6, tileSize);
          patternCtx.stroke();
        }
        break;
      }
      case 2: {
        patternCtx.strokeStyle = colors.primary;
        patternCtx.lineWidth = 2.4;
        for (let y = 6; y < tileSize; y += 14) {
          patternCtx.beginPath();
          patternCtx.moveTo(0, y);
          patternCtx.lineTo(tileSize, y);
          patternCtx.stroke();
        }
        patternCtx.strokeStyle = colors.secondary;
        patternCtx.lineWidth = 2;
        for (let x = 6; x < tileSize; x += 14) {
          patternCtx.beginPath();
          patternCtx.moveTo(x, 0);
          patternCtx.lineTo(x, tileSize);
          patternCtx.stroke();
        }
        break;
      }
      case 3: {
        patternCtx.fillStyle = colors.primary;
        drawPatternStar(patternCtx, 10, 10, 5.6, 2.35, 5);
        patternCtx.fillStyle = colors.secondary;
        drawPatternStar(patternCtx, 25, 23, 5, 2.1, 5);
        patternCtx.fillStyle = colors.tertiary;
        patternCtx.beginPath();
        patternCtx.arc(8, 26, 2.1, 0, Math.PI * 2);
        patternCtx.fill();
        break;
      }
      case 4: {
        patternCtx.fillStyle = colors.primary;
        patternCtx.fillRect(4, 4, 8, 8);
        patternCtx.fillRect(20, 4, 8, 8);
        patternCtx.fillStyle = colors.secondary;
        patternCtx.fillRect(12, 13, 8, 8);
        patternCtx.fillRect(4, 22, 8, 8);
        patternCtx.fillStyle = colors.tertiary;
        patternCtx.fillRect(22, 22, 6, 6);
        break;
      }
      case 5:
      default: {
        patternCtx.strokeStyle = colors.primary;
        patternCtx.lineWidth = 2.8;
        [[3, 6], [3, 21]].forEach(([x, y]) => {
          patternCtx.beginPath();
          patternCtx.moveTo(x, y);
          patternCtx.lineTo(x + 8, y + 6);
          patternCtx.lineTo(x + 16, y);
          patternCtx.stroke();
        });
        patternCtx.strokeStyle = colors.secondary;
        patternCtx.lineWidth = 2.2;
        [[18, 10], [18, 25]].forEach(([x, y]) => {
          patternCtx.beginPath();
          patternCtx.moveTo(x, y);
          patternCtx.lineTo(x + 7, y + 5);
          patternCtx.lineTo(x + 14, y);
          patternCtx.stroke();
        });
        break;
      }
    }

    return ctx.createPattern(patternCanvas, "repeat");
  }

  function resolveAlliancePattern(ctx, district) {
    const allianceKey = resolveAlliancePatternKey(district);
    if (!allianceKey) return null;
    const variant = resolveAlliancePatternVariant(allianceKey);
    const cacheKey = `${allianceKey}:${variant}`;
    const cached = state.alliancePatternCache.get(cacheKey);
    if (cached) return cached;
    const next = createAlliancePattern(ctx, allianceKey, variant);
    if (!next) return null;
    state.alliancePatternCache.set(cacheKey, next);
    return next;
  }

  function districtFill(district) {
    if (isDistrictDestroyed(district)) {
      return "rgba(9, 9, 11, 0.9)";
    }

    if (shouldHideDistrictByVisibilityMode(district)) {
      return resolveHiddenDistrictFill();
    }

    if (state.vision.uniqueOwnerColors && district?.owner) {
      if (isDistrictOwnedByPlayer(district)) {
        const playerFill = resolveDistinctOwnerFill(district.owner, 0.5);
        if (playerFill) return playerFill;
      }
      if (isDistrictOwnedByAlly(district)) {
        const allyDistinctFill = resolveDistinctOwnerFill(district.owner, 0.46);
        if (allyDistinctFill) return allyDistinctFill;
      }
      if (isDistrictOwnedByEnemy(district)) {
        const enemyDistinctFill = resolveDistinctOwnerFill(district.owner, 0.42);
        if (enemyDistinctFill) return enemyDistinctFill;
      }
      const ownerDistinctFill = resolveDistinctOwnerFill(district.owner, 0.38);
      if (ownerDistinctFill) return ownerDistinctFill;
    }

      if (isDistrictOwnedByPlayer(district)) return resolvePlayerOwnedFill();
      if (isDistrictOwnedByAlly(district)) return allyFill(district.owner);
      if (isDistrictOwnedByEnemy(district)) return enemyFill(district.owner);
      if (district.owner) return ownerFill(district.owner);
      if (state.vision.fogPreviewMode) {
        if (district.type === "downtown") return "rgba(248,113,113,0.28)";
        if (state.vision.unknownNeutralFillEnabled) return "rgba(148,163,184,0.22)";
        return "rgba(0,0,0,0)";
      }
      switch (district.type) {
        case "downtown":
          return "rgba(248,113,113,0.28)";
        case "industrial":
          return "rgba(148,163,184,0.28)";
        case "commercial":
          return "rgba(56,189,248,0.28)";
        case "park":
          return "rgba(34,197,94,0.22)";
        case "residential":
        default:
          return "rgba(253,186,116,0.24)";
      }
    }

  function ownerFill(owner) {
    if (state.vision.uniqueOwnerColors) {
      const distinct = resolveDistinctOwnerFill(owner, 0.35);
      if (distinct) return distinct;
    }
    const normalized = normalizeName(owner);
    if (!normalized) return "rgba(34,197,94,0.35)";
    const index = hashOwner(normalized) % ownerPalette.length;
    return ownerPalette[index];
  }

  function enemyFill(owner) {
    if (state.vision.uniqueOwnerColors) {
      const distinct = resolveDistinctOwnerFill(owner, 0.22);
      if (distinct) return distinct;
    }
    const normalized = normalizeName(owner);
    if (!normalized) return "rgba(203,213,225,0.22)";
    const index = hashOwner(normalized) % enemyPalette.length;
    return enemyPalette[index];
  }

  function allyFill(owner) {
    if (state.vision.uniqueOwnerColors) {
      const distinct = resolveDistinctOwnerFill(owner, 0.46);
      if (distinct) return distinct;
    }
    const normalized = normalizeName(owner);
    if (!normalized) return allyPalette[0];
    const alliedOwners = Array.from(state.vision.alliedOwnerNames);
    const indexByOrder = alliedOwners.indexOf(normalized);
    if (indexByOrder >= 0) {
      return allyPalette[indexByOrder % allyPalette.length];
    }
    const indexByHash = hashOwner(normalized) % allyPalette.length;
    return allyPalette[indexByHash];
  }

  function resolvePlayerOwnedFill() {
    const stored = normalizeHexColor(localStorage.getItem("empire_gang_color"));
    if (!stored) return "rgba(34,197,94,0.45)";
    return hexToRgba(stored, 0.45);
  }

  function normalizeDistrictBorderMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "white" || mode === "black" || mode === "player") return mode;
    return "player";
  }

  function normalizeDistrictVisibilityMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "all" || mode === "hide-enemies" || mode === "only-player") return mode;
    return "all";
  }

  function shouldHideDistrictByVisibilityMode(district) {
    const mode = normalizeDistrictVisibilityMode(state.vision.districtVisibilityMode);
    if (mode === "all") return false;
    if (mode === "hide-enemies") return isDistrictOwnedByEnemy(district);
    if (mode === "only-player") return !isDistrictOwnedByPlayer(district);
    return false;
  }

  function shouldDrawDistrictBorders() {
    return state.vision.showDistrictBorders !== false;
  }

  function resolveDistrictBorderStroke() {
    const mode = normalizeDistrictBorderMode(state.vision.districtBorderMode);
    if (mode === "white") return "rgba(248,250,252,0.9)";
    if (mode === "black") return "rgba(2,6,23,0.92)";
    const playerColor = normalizeHexColor(localStorage.getItem("empire_gang_color"));
    if (!playerColor) return "rgba(34,211,238,0.78)";
    return hexToRgba(playerColor, 0.9);
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

  function hexToRgba(hex, alpha = 1) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return "rgba(34,197,94,0.45)";
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${r},${g},${b},${safeAlpha})`;
  }

  function clampColorChannel(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(255, Math.round(numeric)));
  }

  function parseCssColorChannels(colorValue) {
    const raw = String(colorValue || "").trim();
    if (!raw) return null;

    const rgbMatch = raw.match(/rgba?\(\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*,\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*,\s*([0-9]{1,3}(?:\.[0-9]+)?)/i);
    if (rgbMatch) {
      return [
        clampColorChannel(rgbMatch[1]),
        clampColorChannel(rgbMatch[2]),
        clampColorChannel(rgbMatch[3])
      ];
    }

    const normalizedHex = normalizeHexColor(raw);
    if (normalizedHex) {
      return [
        parseInt(normalizedHex.slice(1, 3), 16),
        parseInt(normalizedHex.slice(3, 5), 16),
        parseInt(normalizedHex.slice(5, 7), 16)
      ];
    }

    return null;
  }

  function resolveDistrictAccentChannels(district) {
    const channelsFromFill = parseCssColorChannels(districtFill(district));
    if (channelsFromFill) return channelsFromFill;
    return [34, 211, 238];
  }

  function resolveHiddenDistrictFill() {
    return "rgba(0,0,0,0)";
  }

  function applyDistrictModalAccent(district) {
    const content = state.modal?.root?.querySelector(".modal__content");
    if (!content) return;
    const [r, g, b] = resolveDistrictAccentChannels(district);
    content.style.setProperty("--district-accent-rgb", `${r}, ${g}, ${b}`);

    const glowAlpha = isDistrictOwnedByPlayer(district)
      ? 0.42
      : isDistrictOwnedByAlly(district)
        ? 0.36
        : isDistrictOwnedByEnemy(district)
          ? 0.33
          : 0.28;
    content.style.setProperty("--district-accent-glow-alpha", String(glowAlpha));
  }

  function isPlayerOwner(ownerName) {
    return getPlayerOwnerNames().has(normalizeName(ownerName));
  }

  function isDistrictDestroyed(district) {
    if (!district || typeof district !== "object") return false;
    return Boolean(district.isDestroyed || district.is_destroyed || district.destroyed);
  }

  function isDistrictOwnedByPlayer(district) {
    if (isDistrictDestroyed(district)) return false;
    if (!district?.owner) return false;
    return isPlayerOwner(String(district.owner).trim());
  }

  function isDistrictOwnedByAlly(district) {
    if (isDistrictDestroyed(district)) return false;
    if (!district?.owner) return false;
    const owner = normalizeName(district.owner);
    if (!owner) return false;
    if (isPlayerOwner(owner)) return false;
    return state.vision.alliedOwnerNames.has(owner);
  }

  function isDistrictOwnedByEnemy(district) {
    if (isDistrictDestroyed(district)) return false;
    if (!district?.owner) return false;
    const owner = normalizeName(district.owner);
    if (!owner) return false;
    if (isPlayerOwner(owner)) return false;
    if (state.vision.alliedOwnerNames.has(owner)) return false;
    return state.vision.enemyOwnerNames.has(owner);
  }

  function isDistrictDefendable(district) {
    return isDistrictOwnedByPlayer(district) || isDistrictOwnedByAlly(district);
  }

  function getPlayerOwnerNames() {
    const player = window.Empire.player || {};
    const names = [
      player.gangName,
      player.gang_name,
      player.gang,
      player.username,
      player.name,
      localStorage.getItem("empire_guest_username"),
      localStorage.getItem("empire_gang_name")
    ]
      .map((value) => normalizeName(value))
      .filter(Boolean);
    return new Set(names);
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hashOwner(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function updateDistrictGallery(district) {
    const gallery = document.getElementById("modal-park-gallery");
    const grid = document.getElementById("modal-park-images");
    const title = document.querySelector("#modal-park-gallery .modal__gallery-title");
    if (!gallery || !grid) return;

    if (!district) {
      gallery.classList.add("hidden");
      grid.innerHTML = "";
      return;
    }

    const imageSets = {
      park: { title: "Atmosféra parku", images: parkImages },
      downtown: { title: "Atmosféra downtownu", images: downtownImages },
      commercial: { title: "Atmosféra komerce", images: commercialImages },
      residential: { title: "Atmosféra rezidenční zóny", images: residentialImages },
      industrial: { title: "Atmosféra industriální zóny", images: industrialImages }
    };
    const set = imageSets[district.type];
    if (!set) {
      gallery.classList.add("hidden");
      grid.innerHTML = "";
      return;
    }

    const total = set.images.length;
    if (total === 0) {
      gallery.classList.add("hidden");
      return;
    }

    const overrideKey = `${district.type}:${district.id}`;
    const overrideImages = districtImageOverrides[overrideKey];
    if (Array.isArray(overrideImages) && overrideImages.length) {
      grid.innerHTML = overrideImages
        .map((src, index) => `
          <img src="${src}" alt="${set.title} ${index + 1}" loading="lazy" />
        `)
        .join("");
      gallery.classList.remove("hidden");
      return;
    }

    const seedSource = typeof district.id === "number"
      ? district.id
      : String(district.id || "")
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const picks = [set.images[seedSource % total]];
    if (title) title.textContent = set.title;

    grid.innerHTML = picks
      .map((src, index) => `
        <img src="${src}" alt="${set.title} ${index + 1}" loading="lazy" />
      `)
      .join("");
    gallery.classList.remove("hidden");
  }



  function polygonCentroid(poly) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const len = poly.length;
    for (let i = 0; i < len; i += 1) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % len];
      const a = x0 * y1 - x1 * y0;
      area += a;
      cx += (x0 + x1) * a;
      cy += (y0 + y1) * a;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-6) return [poly[0][0], poly[0][1]];
    return [cx / (6 * area), cy / (6 * area)];
  }

  function updateTooltip(district, clientX, clientY) {
    if (!state.tooltip) return;
    if (!district) {
      hideTooltip();
      return;
    }
    if (isDistrictDestroyed(district)) {
      state.tooltip.classList.remove("hidden");
      const districtNumber = resolveDistrictNumberLabel(district);
      state.tooltip.innerHTML = `
        <div class="map-tooltip__title">Vypálený distrikt</div>
        <div>Distrikt č.: ${districtNumber}</div>
        <div>Stav: Zničený a nepoužitelný</div>
        <div>Vlastník: Nikdo</div>
        <div>Příjem: 0</div>
      `;
      placeTooltipWithinMap(clientX, clientY);
      return;
    }
    const defendableByPlayer = isDistrictDefendable(district);
    const isDowntown = district.type === "downtown";
    const ownerRelation = resolveDistrictOwnerRelation(district);
    const ownerIntelSection = buildOwnerIntelSection(district, ownerRelation);

    state.tooltip.classList.remove("hidden");

    if (state.vision.fogPreviewMode && !defendableByPlayer) {
      const districtNumber = resolveDistrictNumberLabel(district);
      const gossipSection = buildTooltipGossipSection(district, 2);
      state.tooltip.innerHTML = ownerRelation === "enemy"
        ? `
          <div class="map-tooltip__title">Nepřátelský sektor</div>
          <div>Distrikt č.: ${districtNumber}</div>
          ${ownerIntelSection}
          <div>Detailní info sektoru je skryté.</div>
          ${gossipSection}
        `
        : isDowntown
          ? `
            <div class="map-tooltip__title">Downtown sektor</div>
            <div>Distrikt č.: ${districtNumber}</div>
            <div>Citlivá zóna města.</div>
            ${gossipSection}
          `
          : `
            <div class="map-tooltip__title">Distrikt č. ${districtNumber}</div>
            <div>Informace o cizím distriktu jsou skryté.</div>
            ${gossipSection}
          `;
      placeTooltipWithinMap(clientX, clientY);
      return;
    }

    const canViewDistrictBuildings = defendableByPlayer;
    const buildingLine =
      canViewDistrictBuildings && Array.isArray(district.buildings) && district.buildings.length
        ? `
          <div class="map-tooltip__section">
            <div class="map-tooltip__label">Budovy</div>
            <div class="map-tooltip__tags">
              ${district.buildings.map((building) => `<span class="map-tooltip__tag">${building}</span>`).join("")}
            </div>
          </div>
        `
        : "";
    const setLine = canViewDistrictBuildings && district.buildingSetTitle
      ? `<div class="map-tooltip__section"><div class="map-tooltip__label">Set</div><div>${district.buildingSetTitle}</div></div>`
      : "";
    const gossipLine = buildTooltipGossipSection(district, 2);

    const hideEnemyEconomyIntel = ownerRelation === "enemy";
    state.tooltip.innerHTML = `
      <div class="map-tooltip__title">${district.name}</div>
      <div>Typ: ${district.type}</div>
      <div>Vlastník: ${district.owner || "Neobsazeno"}</div>
      <div>Příjem: ${hideEnemyEconomyIntel ? "Skryto" : `$${district.income}/hod`}</div>
      <div>Vliv: ${hideEnemyEconomyIntel ? "Skryto" : district.influence}</div>
      ${ownerIntelSection}
      ${setLine}
      ${buildingLine}
      ${gossipLine}
    `;
    placeTooltipWithinMap(clientX, clientY);
  }

  function buildTooltipGossipSection(district, limit = 2) {
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 1));
    const entries = getDistrictGossipEntries(district, safeLimit);
    if (!entries.length) {
      return `
        <div class="map-tooltip__section">
          <div class="map-tooltip__label">Drby</div>
          <div class="map-tooltip__gossip-empty">Zatím bez drbů.</div>
        </div>
      `;
    }
    const items = entries
      .map((entry) => `
        <div class="map-tooltip__gossip-item">
          <span>${escapeHtml(entry.text)}</span>
        </div>
      `)
      .join("");
    return `
      <div class="map-tooltip__section">
        <div class="map-tooltip__label">Drby</div>
        <div class="map-tooltip__gossip-list">${items}</div>
      </div>
    `;
  }

  function resolveDistrictNumberLabel(district) {
    const numericId = Number(district?.id);
    if (Number.isFinite(numericId)) {
      return `${Math.max(0, Math.floor(numericId))}`;
    }

    const name = String(district?.name || "");
    const fromName = name.match(/(\d+)/);
    if (fromName?.[1]) {
      return fromName[1];
    }

    const rawId = String(district?.id || "").trim();
    if (!rawId) return "?";
    if (rawId.includes("-")) {
      return rawId.split("-")[0];
    }
    return rawId;
  }

  function resolveDistrictOwnerRelation(district) {
    if (isDistrictOwnedByAlly(district)) return "ally";
    if (isDistrictOwnedByEnemy(district)) return "enemy";
    return "other";
  }

  function buildOwnerIntelSection(district, relation) {
    if (!district?.owner) return "";
    if (relation !== "ally" && relation !== "enemy") return "";
    const intel = resolveOwnerIntel(district, relation);
    if (!intel) return "";
    const relationLabel = relation === "ally" ? "Spojenecký hráč" : "Nepřátelský hráč";
    const members = intel.allianceMembers.map((nick) => escapeHtml(nick)).join(", ");
    return `
      <div class="map-tooltip__section">
        <div class="map-tooltip__label">${relationLabel}</div>
        <div>Nick: ${escapeHtml(intel.nick)}</div>
        <div>Gang: ${escapeHtml(intel.gangName)}</div>
        <div>Aliance: ${members}</div>
      </div>
    `;
  }

  function resolveOwnerIntel(district, relation) {
    const owner = normalizeName(district?.owner);
    if (!owner) return null;

    const ownerSeed = hashOwner(`${owner}:${relation}`);
    const nick = generateSyntheticNick(ownerSeed);
    const gangName = generateSyntheticGangName(ownerSeed);
    const allianceMembers = generateSyntheticAllianceMembers(owner, relation, ownerSeed, nick);

    return {
      nick,
      gangName,
      allianceMembers
    };
  }

  function generateSyntheticNick(seed) {
    const prefixes = ["Razor", "Ghost", "Viper", "Nyx", "Cipher", "Blaze", "Nova", "Kane", "Venom", "Sable"];
    const suffixes = ["Hex", "Prime", "Zero", "Fox", "Core", "Volt", "Reign", "Shade", "Drift", "Flux"];
    const first = prefixes[Math.abs(seed) % prefixes.length];
    const second = suffixes[Math.abs(Math.floor(seed / 7)) % suffixes.length];
    const number = 10 + (Math.abs(seed) % 90);
    return `${first} ${second}-${number}`;
  }

  function generateSyntheticGangName(seed) {
    const first = ["Neon", "Iron", "Black", "Shadow", "Obsidian", "Chrome", "Crimson", "Night", "Vortex", "Steel"];
    const second = ["Syndicate", "Cartel", "Legion", "Covenant", "Raiders", "Empire", "Network", "Coalition", "Order", "Circle"];
    return `${first[Math.abs(seed) % first.length]} ${second[Math.abs(Math.floor(seed / 11)) % second.length]}`;
  }

  function generateSyntheticAllianceMembers(owner, relation, seed, ownerNick) {
    const members = [ownerNick];
    const relationOwners = relation === "ally"
      ? Array.from(state.vision.alliedOwnerNames || [])
      : Array.from(state.vision.enemyOwnerNames || []);
    const uniqueOwners = Array.from(new Set(relationOwners.map((name) => normalizeName(name)).filter(Boolean)));

    uniqueOwners.forEach((candidate) => {
      if (members.length >= 3) return;
      if (candidate === owner) return;
      const candidateSeed = hashOwner(`${candidate}:${relation}`);
      const nick = generateSyntheticNick(candidateSeed);
      if (!members.includes(nick)) members.push(nick);
    });

    let fillerIndex = 0;
    while (members.length < 3) {
      const fillerNick = generateSyntheticNick(seed + 97 * (fillerIndex + 1));
      if (!members.includes(fillerNick)) members.push(fillerNick);
      fillerIndex += 1;
    }

    return members.slice(0, 3);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function placeTooltipWithinMap(clientX, clientY) {
    if (!state.tooltip) return;
    const margin = 12;
    const inset = 6;
    let left = Number(clientX || 0) + margin;
    let top = Number(clientY || 0) + margin;

    const mapRect = state.canvas?.getBoundingClientRect?.();
    if (!mapRect) {
      state.tooltip.style.left = `${left}px`;
      state.tooltip.style.top = `${top}px`;
      return;
    }

    const tooltipRect = state.tooltip.getBoundingClientRect();
    const minLeft = mapRect.left + inset;
    const maxLeft = mapRect.right - tooltipRect.width - inset;
    const minTop = mapRect.top + inset;
    const maxTop = mapRect.bottom - tooltipRect.height - inset;

    if (maxLeft < minLeft) {
      left = minLeft;
    } else {
      left = Math.min(maxLeft, Math.max(minLeft, left));
    }

    if (maxTop < minTop) {
      top = minTop;
    } else {
      top = Math.min(maxTop, Math.max(minTop, top));
    }

    state.tooltip.style.left = `${left}px`;
    state.tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (!state.tooltip) return;
    state.tooltip.classList.add("hidden");
  }

  function applyUpdate(update) {
    if (!update || typeof update !== "object") return;
    if (Array.isArray(update.districts)) {
      setDistricts(update.districts);
    }
    if (Array.isArray(update.attackedDistricts)) {
      setUnderAttackDistricts(update.attackedDistricts, { replace: true });
    }
    if (Array.isArray(update.policeActions)) {
      setPoliceActionDistricts(update.policeActions, { replace: true });
    }
    if (Array.isArray(update.spyActions)) {
      setSpyActionDistricts(update.spyActions, { replace: true });
    }
    if (Array.isArray(update.raidActions)) {
      update.raidActions.forEach((item) => {
        const districtId = item?.districtId ?? item?.id;
        if (districtId == null) return;
        markDistrictRaidAction(districtId, {
          durationMs: item?.durationMs,
          source: item?.source || "map-update-raid"
        });
      });
    }
    const eventTargetId = update.attackEvent?.targetDistrictId
      ?? update.attackEvent?.districtId
      ?? update.underAttackDistrictId;
    if (eventTargetId != null) {
      markDistrictUnderAttack(eventTargetId, {
        attackerDistrictId: update.attackEvent?.sourceDistrictId ?? update.attackEvent?.attackerDistrictId,
        durationMs: update.attackEvent?.durationMs,
        source: update.attackEvent?.source || "map-update"
      });
    }
    const policeTargetId = update.policeEvent?.targetDistrictId
      ?? update.policeEvent?.districtId
      ?? update.policeActionDistrictId;
    if (policeTargetId != null) {
      markDistrictPoliceAction(policeTargetId, {
        durationMs: update.policeEvent?.durationMs,
        source: update.policeEvent?.source || "map-update",
        operationType: update.policeEvent?.operationType || "",
        raidSpecialtyKey: update.policeEvent?.raidSpecialtyKey || ""
      });
    }
    const spyTargetId = update.spyEvent?.targetDistrictId
      ?? update.spyEvent?.districtId
      ?? update.spyActionDistrictId;
    if (spyTargetId != null) {
      markDistrictSpyAction(spyTargetId, {
        durationMs: update.spyEvent?.durationMs,
        source: update.spyEvent?.source || "map-update-spy"
      });
    }
    const raidTargetId = update.raidEvent?.targetDistrictId
      ?? update.raidEvent?.districtId
      ?? update.raidActionDistrictId;
    if (raidTargetId != null) {
      markDistrictRaidAction(raidTargetId, {
        durationMs: update.raidEvent?.durationMs,
        source: update.raidEvent?.source || "map-update-raid"
      });
    }
  }

  function setVisionContext(context = {}) {
    state.vision.fogPreviewMode = Boolean(context.fogPreviewMode);
    const allied = Array.isArray(context.alliedOwnerNames) ? context.alliedOwnerNames : [];
    const enemies = Array.isArray(context.enemyOwnerNames) ? context.enemyOwnerNames : [];
    state.vision.allowEnemyModalIntelInFog = Boolean(context.allowEnemyModalIntelInFog);
    state.vision.uniqueOwnerColors = Boolean(context.uniqueOwnerColors);
    state.vision.districtBorderMode = normalizeDistrictBorderMode(context.districtBorderMode);
    state.vision.unknownNeutralFillEnabled = Boolean(context.unknownNeutralFillEnabled);
    state.vision.showDistrictBorders = context.showDistrictBorders !== false;
    state.vision.showAllianceSymbols = context.showAllianceSymbols !== false;
    state.vision.districtVisibilityMode = normalizeDistrictVisibilityMode(context.districtVisibilityMode);
    state.vision.alliedOwnerNames = new Set(
      allied
        .map((value) => normalizeName(value))
        .filter(Boolean)
    );
    state.vision.enemyOwnerNames = new Set(
      enemies
        .map((value) => normalizeName(value))
        .filter(Boolean)
    );
    rebuildDistinctOwnerColorIndex();
    render();
  }

  function buildDistrictTypeOverrides(districts) {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const shouldApplyLegacyOverrides = (() => {
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
    })();
    const incomingTypeById = new Map(
      safeDistricts.map((district) => [
        normalizeDistrictId(district?.id),
        String(district?.type || "residential")
      ])
    );
    const shouldRefreshBaseTypes =
      !state.baseDistrictTypeById.size
      || state.baseDistrictTypeById.size !== incomingTypeById.size
      || Array.from(incomingTypeById.keys()).some((districtId) => !state.baseDistrictTypeById.has(districtId));
    if (shouldRefreshBaseTypes) {
      state.baseDistrictTypeById = new Map(
        incomingTypeById
      );
    }
    const byId = new Map(state.baseDistrictTypeById);
    const swapTypeByDistrictIds = (a, b) => {
      const firstId = resolveDistrictKeyByLegacyId(safeDistricts, a);
      const secondId = resolveDistrictKeyByLegacyId(safeDistricts, b);
      if (!byId.has(firstId) || !byId.has(secondId)) return;
      const firstType = byId.get(firstId);
      const secondType = byId.get(secondId);
      byId.set(firstId, secondType);
      byId.set(secondId, firstType);
    };
    if (shouldApplyLegacyOverrides) {
      swapTypeByDistrictIds(114, 68);
      swapTypeByDistrictIds(95, 20);
    }
    const forceTypeByLegacyId = (legacyId, nextType) => {
      const districtKey = resolveDistrictKeyByLegacyId(safeDistricts, legacyId);
      if (!districtKey || !byId.has(districtKey)) return;
      byId.set(districtKey, String(nextType || "").trim().toLowerCase() || "residential");
    };
    forceTypeByLegacyId(3, "downtown");
    forceTypeByLegacyId(26, "downtown");
    return byId;
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

  function resolveDistrictKeyByLegacyId(districts, legacyId) {
    const safeLegacyId = Number(legacyId);
    if (!Number.isFinite(safeLegacyId)) return "";
    const target = Math.max(1, Math.floor(safeLegacyId));
    for (let i = 0; i < districts.length; i += 1) {
      const district = districts[i];
      if (resolveLegacyDistrictId(district) !== target) continue;
      return normalizeDistrictId(district?.id);
    }
    return "";
  }

  function resolveDistrictNumberForLabel(district, fallbackIndex = 0) {
    const directMapId = Number(district?.mapId ?? district?.map_id);
    if (Number.isFinite(directMapId) && directMapId > 0) {
      return Math.floor(directMapId);
    }
    const legacyId = resolveLegacyDistrictId(district);
    if (Number.isFinite(legacyId) && legacyId > 0) {
      return Math.floor(legacyId);
    }
    return Math.max(1, Math.floor(Number(fallbackIndex) + 1));
  }

  function setDistricts(districts) {
    if (!Array.isArray(districts) || districts.length < 1) return;
    const districtTypeOverrides = buildDistrictTypeOverrides(districts);
    let normalized = districts.map((district, index) => {
      const districtId = normalizeDistrictId(district?.id);
      const districtType = districtTypeOverrides.get(districtId) || district.type || "residential";
      const basePolygon = resolveDistrictBasePolygon(district);
      const districtNumber = resolveDistrictNumberForLabel(district, index);
      return {
        id: district.id,
        mapId: Number.isFinite(Number(district?.mapId ?? district?.map_id))
          ? Math.max(1, Math.floor(Number(district?.mapId ?? district?.map_id)))
          : null,
        name: `District č. ${districtNumber}`,
        type: districtType,
        owner: district.owner || null,
        ownerPlayerId: district.ownerPlayerId || district.owner_player_id || null,
        ownerNick: district.ownerNick || district.owner_nick || district.ownerUsername || district.owner_username || null,
        ownerAllianceName: district.ownerAllianceName || district.owner_alliance_name || null,
        ownerAllianceIconKey: district.ownerAllianceIconKey || district.owner_alliance_icon_key || null,
        ownerAvatar: district.ownerAvatar || district.owner_avatar || null,
        ownerStructure: district.ownerStructure || district.owner_structure || district.faction || null,
        ownerFaction: district.ownerFaction || district.owner_faction || district.ownerStructure || district.faction || null,
        ownerAtmosphere: district.ownerAtmosphere || district.owner_atmosphere || null,
        influence: Number(district.influence || 0),
        income: Number(district.income || 0),
        isDestroyed: Boolean(district.isDestroyed || district.is_destroyed || district.destroyed),
        destroyedAt: district.destroyedAt || district.destroyed_at || null,
        basePolygon,
        polygon: basePolygon,
        buildings: Array.isArray(district.buildings) ? district.buildings : [],
        buildingNameOverrides: Array.isArray(district.buildingNameOverrides) ? district.buildingNameOverrides : [],
        buildingTier: district.buildingTier || null,
        buildingSetKey: district.buildingSetKey || null,
        buildingSetTitle: district.buildingSetTitle || null
      };
    });

    if (window.Empire.UI?.assignDistrictMetadata) {
      normalized = window.Empire.UI.assignDistrictMetadata(normalized);
    }
    normalized = fitDistrictPolygonsToMap(normalized);
    const hasPolygons = normalized.every((d) => Array.isArray(d.polygon));
    if (!hasPolygons) return;

    state.districts = normalized;
    state.districtIndexById = new Map(
      normalized
        .map((district) => [normalizeDistrictId(district?.id), district])
        .filter(([districtKey]) => Boolean(districtKey))
    );
    state.districtAdjacencyById = buildDistrictAdjacencyIndex(normalized);
    state.alliancePatternCache.clear();
    rebuildDistinctOwnerColorIndex();
    reconcileAttackMarkersWithDistricts();
    reconcilePoliceActionsWithDistricts();
    reconcileSpyActionsWithDistricts();
    reconcileRaidActionsWithDistricts();
    reconcileBountyMarkersWithDistricts();
    pruneExpiredAttackMarkers(Date.now());
    pruneExpiredPoliceActions(Date.now());
    pruneExpiredSpyActions(Date.now());
    pruneExpiredRaidActions(Date.now());
    syncAttackAnimationTicker();
    state.roads = buildRoadNetworkFromDistricts(normalized);
    window.Empire.districts = normalized;
    if (window.Empire.selectedDistrict?.id != null) {
      const selected = normalized.find((district) => String(district.id) === String(window.Empire.selectedDistrict.id)) || null;
      window.Empire.selectedDistrict = selected;
      state.selectedId = selected ? selected.id : null;
    }
    notifySelectedDistrictChange();
    render();
    window.Empire.Bounty?.applyBountyVisualsToMap?.();
  }

  function initModal() {
    const root = document.getElementById("district-modal");
    const backdrop = document.getElementById("modal-backdrop");
    const closeBtn = document.getElementById("modal-close");
    if (!root) return;
    state.modal = { root, backdrop, closeBtn };
    if (backdrop) backdrop.addEventListener("click", hideModal);
    root.addEventListener("click", (event) => {
      if (event.target === root || event.target === backdrop) {
        hideModal();
      }
    });
    if (closeBtn) closeBtn.addEventListener("click", hideModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideModal();
      if (event.key === "Enter" && !state.modal?.root?.classList.contains("hidden")) {
        const defense = document.getElementById("defense-btn");
        if (defense && !defense.classList.contains("hidden") && !defense.disabled) {
          defense.click();
          return;
        }
        const attack = document.getElementById("attack-btn");
        if (attack && !attack.classList.contains("hidden") && !attack.disabled) attack.click();
      }
    });
  }

  let districtModalRefreshIntervalId = null;

  function startDistrictModalRefreshTicker() {
    if (districtModalRefreshIntervalId) return;
    districtModalRefreshIntervalId = setInterval(() => {
      if (!state.modal?.root || state.modal.root.classList.contains("hidden")) return;
      const selected = window.Empire.selectedDistrict?.id != null
        ? state.districts.find((district) => String(district?.id) === String(window.Empire.selectedDistrict.id)) || null
        : null;
      if (!selected) return;
      updateDistrictRaidLockRow(selected);
      updateModalActionsForDistrict(selected);
    }, 1000);
  }

  function stopDistrictModalRefreshTicker() {
    if (!districtModalRefreshIntervalId) return;
    clearInterval(districtModalRefreshIntervalId);
    districtModalRefreshIntervalId = null;
  }

  document.addEventListener("empire:onboarding:focus-district", (event) => {
    state.onboardingFocusDistrictId = event.detail?.districtId != null ? String(event.detail.districtId) : null;
    state.onboardingFocusMode = String(event.detail?.focusMode || "full").trim() || "full";
    render();
  });

  document.addEventListener("empire:spy-started", (event) => {
    const districtId = event.detail?.districtId != null ? String(event.detail.districtId) : "";
    if (!districtId || districtId !== String(state.onboardingFocusDistrictId || "")) return;
    state.onboardingFocusMode = "border";
    render();
  });

  document.addEventListener("empire:occupy-started", (event) => {
    const districtId = event.detail?.districtId != null ? String(event.detail.districtId) : "";
    if (!districtId || districtId !== String(state.onboardingFocusDistrictId || "")) return;
    state.onboardingFocusMode = "border";
    render();
  });

  document.addEventListener("empire:onboarding:finished", () => {
    state.onboardingFocusDistrictId = null;
    state.onboardingFocusMode = "full";
    render();
  });

  document.addEventListener("empire:onboarding:reset", () => {
    state.onboardingFocusDistrictId = null;
    state.onboardingFocusMode = "full";
    render();
  });

  function initBuildingDetailModal() {
    const root = document.getElementById("building-detail-modal");
    if (!root) return;

    const backdrop = document.getElementById("building-detail-modal-backdrop");
    const closeBtn = document.getElementById("building-detail-modal-close");
    const modalBody = root.querySelector(".modal__body");
    const tabButtons = Array.from(root.querySelectorAll("[data-building-tab]"));
    const actionButtons = Array.from(root.querySelectorAll("[data-building-action]"));
    const panelStats = document.getElementById("building-detail-panel-stats");
    const panelInfo = document.getElementById("building-detail-panel-info");
    let swipeState = null;

    const setTab = (tab) => {
      const showInfo = tab === "info";
      state.activeBuildingDetailTab = showInfo ? "info" : "stats";
      if (panelStats) panelStats.classList.toggle("hidden", showInfo);
      if (panelInfo) panelInfo.classList.toggle("hidden", !showInfo);
      root.classList.toggle("is-info-tab", showInfo);
      tabButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.buildingTab === tab);
      });
      updateArmoryMaterialsStickyCompactState();
    };

    const isMobileSwipeViewport = () => window.matchMedia("(max-width: 900px)").matches;
    const resetSwipeState = () => {
      swipeState = null;
    };
    const finalizeSwipe = () => {
      if (!swipeState) return;
      const now = Date.now();
      const { startX, startY, lastX, lastY, startedAt } = swipeState;
      resetSwipeState();
      if (!isMobileSwipeViewport()) return;
      const deltaX = lastX - startX;
      const deltaY = lastY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const elapsedMs = Math.max(0, now - startedAt);
      if (absX < 46) return;
      if (absX < absY * 1.25) return;
      if (elapsedMs > 850 && absX < 70) return;
      if (deltaX < 0) {
        setTab("info");
      } else if (deltaX > 0) {
        setTab("stats");
      }
    };

    const close = () => {
      root.classList.add("hidden");
      state.activeBuildingDetail = null;
      state.activeBuildingDetailTab = "stats";
      resetSwipeState();
    };

    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (panelStats) {
      panelStats.addEventListener("scroll", updateArmoryMaterialsStickyCompactState, { passive: true });
    }
    root.addEventListener("click", (event) => {
      if (event.target === root || event.target === backdrop) close();
    });
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.buildingTab || "stats"));
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
    actionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const actionId = button.dataset.buildingAction || "?";
        const activeContext = resolveActiveBuildingContext();
        const context = activeContext?.context || null;
        const buildingName = document.getElementById("building-detail-name")?.textContent || context?.baseName || "Budova";
        const baseName = String(context?.baseName || "").trim();
        if (isPoliceRaidAllActionsBlocked(Date.now())) {
          window.Empire.UI?.pushEvent?.("Během policejní razie jsou všechny akce v budovách dočasně zakázané.");
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === APARTMENT_BLOCK_NAME) {
          const result = handleApartmentBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === SCHOOL_BUILDING_NAME) {
          const result = handleSchoolBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (isFitnessClubBaseName(baseName)) {
          const result = handleFitnessBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === CASINO_BUILDING_NAME || isCasinoBaseName(baseName)) {
          const result = handleCasinoBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === ARCADE_BUILDING_NAME || isArcadeBaseName(baseName)) {
          const result = handleArcadeBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === AUTO_SALON_BUILDING_NAME || isAutoSalonBaseName(baseName)) {
          const result = handleAutoSalonBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === EXCHANGE_BUILDING_NAME || isExchangeBaseName(baseName)) {
          const result = handleExchangeBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === RESTAURANT_BUILDING_NAME || isRestaurantBaseName(baseName)) {
          const result = handleRestaurantBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === CONVENIENCE_STORE_BUILDING_NAME || isConvenienceStoreBaseName(baseName)) {
          const result = handleConvenienceStoreBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (
          baseName === SMUGGLING_TUNNEL_BUILDING_NAME
          || isSmugglingTunnelBaseName(baseName)
          || baseName === STREET_DEALERS_BUILDING_NAME
          || isStreetDealersBaseName(baseName)
          || baseName === STRIP_CLUB_BUILDING_NAME
          || isStripClubBaseName(baseName)
          || baseName === DATA_CENTER_BUILDING_NAME
          || isDataCenterBaseName(baseName)
          || baseName === WAREHOUSE_BUILDING_NAME
          || isWarehouseBaseName(baseName)
          || baseName === RESEARCH_CENTER_BUILDING_NAME
          || isResearchCenterBaseName(baseName)
          || baseName === RECYCLING_CENTER_BUILDING_NAME
          || isRecyclingCenterBaseName(baseName)
        ) {
          const isDataCenter = baseName === DATA_CENTER_BUILDING_NAME || isDataCenterBaseName(baseName);
          if (isDataCenter && (actionId === "1" || actionId === "2")) {
            const entered = enterDataCenterMapTargeting(actionId, activeContext);
            if (entered) {
              const targetHint = actionId === "1"
                ? "Datové centrum: vyber na mapě cizí distrikt hráče, kterého chceš sledovat."
                : "Datové centrum: vyber na mapě cizí distrikt pro hack income.";
              window.Empire.UI?.pushEvent?.(`${targetHint} Potom potvrď akci v okně.`);
              refreshActiveBuildingDetailModal();
              return;
            }
          }
          const result = handleParkSpecialBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === ARMORY_BUILDING_NAME || isArmoryBaseName(baseName)) {
          const result = handleArmoryBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === FACTORY_BUILDING_NAME || isFactoryBaseName(baseName)) {
          const result = handleFactoryBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === PHARMACY_BUILDING_NAME || isPharmacyBaseName(baseName)) {
          const result = handlePharmacyBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === DRUG_LAB_BUILDING_NAME || isDrugLabBaseName(baseName)) {
          const result = handleDrugLabBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (baseName === ARMORY_BUILDING_NAME || isArmoryBaseName(baseName)) {
          const result = handleArmoryBuildingAction(actionId, activeContext);
          if (result?.message) {
            window.Empire.UI?.pushEvent?.(result.message);
          }
          refreshActiveBuildingDetailModal();
          return;
        }

        if (actionId === "upgrade") {
          window.Empire.UI?.pushEvent?.(`${buildingName}: Upgrade bude doplněn později.`);
          return;
        }

        if (actionId === "collect") {
          window.Empire.UI?.pushEvent?.(`${buildingName}: Výběr členů bude dostupný po nastavení mechaniky.`);
          return;
        }
        window.Empire.UI?.pushEvent?.(`${buildingName}: Akce ${actionId} bude doplněna později.`);
      });
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (isPoliceRaidAllActionsBlocked(Date.now())) {
        window.Empire.UI?.pushEvent?.("Během policejní razie jsou všechny akce v budovách dočasně zakázané.");
        refreshActiveBuildingDetailModal();
        return;
      }
      const activeContext = resolveActiveBuildingContext();
      const context = activeContext?.context || null;
      const baseName = String(context?.baseName || "").trim();
      const currentMechanicsType = String(root.dataset.buildingMechanicsType || "").trim();
      let result = null;
      if (currentMechanicsType === "drug-lab" || baseName === DRUG_LAB_BUILDING_NAME || isDrugLabBaseName(baseName)) {
        result = handleDrugLabInlineControl(target, activeContext);
      } else if (currentMechanicsType === "armory" || baseName === ARMORY_BUILDING_NAME || isArmoryBaseName(baseName)) {
        result = handleArmoryInlineControl(target, activeContext);
      } else if (currentMechanicsType === "factory" || baseName === FACTORY_BUILDING_NAME || isFactoryBaseName(baseName)) {
        result = handleFactoryInlineControl(target, activeContext);
      } else if (currentMechanicsType === "pharmacy" || baseName === PHARMACY_BUILDING_NAME || isPharmacyBaseName(baseName)) {
        result = handlePharmacyInlineControl(target, activeContext);
      } else if (currentMechanicsType === "street-dealers" || baseName === STREET_DEALERS_BUILDING_NAME || isStreetDealersBaseName(baseName)) {
        result = handleStreetDealersInlineControl(target, activeContext);
      } else {
        return;
      }
      if (result?.message && !result?.silentUiEvent) {
        window.Empire.UI?.pushEvent?.(result.message);
      }
      if (result) {
        refreshActiveBuildingDetailModal();
      }
    });
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (isPoliceRaidAllActionsBlocked(Date.now())) {
        window.Empire.UI?.pushEvent?.("Během policejní razie jsou všechny akce v budovách dočasně zakázané.");
        refreshActiveBuildingDetailModal();
        return;
      }
      const titleActionBtn = target.closest("[data-building-title-action]");
      if (titleActionBtn instanceof HTMLElement) {
        const actionId = String(titleActionBtn.dataset.buildingTitleAction || "").trim();
        if (!actionId) return;
        const modalActionBtn = root.querySelector(`[data-building-action="${actionId}"]`);
        if (modalActionBtn instanceof HTMLButtonElement && !modalActionBtn.disabled) {
          modalActionBtn.click();
        }
        return;
      }
      if (target.closest("[data-drug-lab-slot-select]")) return;
      const activeContext = resolveActiveBuildingContext();
      const context = activeContext?.context || null;
      const baseName = String(context?.baseName || "").trim();
      const currentMechanicsType = String(root.dataset.buildingMechanicsType || "").trim();
      let result = null;
      if (currentMechanicsType === "drug-lab" || baseName === DRUG_LAB_BUILDING_NAME || isDrugLabBaseName(baseName)) {
        result = handleDrugLabInlineControl(target, activeContext);
      } else if (currentMechanicsType === "armory" || baseName === ARMORY_BUILDING_NAME || isArmoryBaseName(baseName)) {
        result = handleArmoryInlineControl(target, activeContext);
      } else if (currentMechanicsType === "factory" || baseName === FACTORY_BUILDING_NAME || isFactoryBaseName(baseName)) {
        result = handleFactoryInlineControl(target, activeContext);
      } else if (currentMechanicsType === "pharmacy" || baseName === PHARMACY_BUILDING_NAME || isPharmacyBaseName(baseName)) {
        result = handlePharmacyInlineControl(target, activeContext);
      } else if (currentMechanicsType === "street-dealers" || baseName === STREET_DEALERS_BUILDING_NAME || isStreetDealersBaseName(baseName)) {
        result = handleStreetDealersInlineControl(target, activeContext);
      } else {
        return;
      }
      if (result?.message && !result?.silentUiEvent) {
        window.Empire.UI?.pushEvent?.(result.message);
      }
      if (result) {
        refreshActiveBuildingDetailModal();
      }
    });
    setInterval(() => {
      if (root.classList.contains("hidden")) return;
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && activeElement.closest("#building-detail-modal")
        && activeElement.matches("[data-drug-lab-slot-select]")
      ) {
        return;
      }
      const active = resolveActiveBuildingContext();
      const baseName = String(active?.context?.baseName || "").trim();
      const currentMechanicsType = String(root.dataset.buildingMechanicsType || "").trim();
      if (
        !(
          currentMechanicsType === "drug-lab"
          || currentMechanicsType === "armory"
          || currentMechanicsType === "factory"
          || currentMechanicsType === "pharmacy"
          || currentMechanicsType === "smuggling-tunnel"
          || currentMechanicsType === "street-dealers"
          || currentMechanicsType === "strip-club"
          || currentMechanicsType === "data-center"
          || currentMechanicsType === "warehouse"
          || currentMechanicsType === "research-center"
          || currentMechanicsType === "recycling-center"
          || 
          baseName === DRUG_LAB_BUILDING_NAME
          || isDrugLabBaseName(baseName)
          || baseName === ARMORY_BUILDING_NAME
          || isArmoryBaseName(baseName)
          || baseName === FACTORY_BUILDING_NAME
          || isFactoryBaseName(baseName)
          || baseName === PHARMACY_BUILDING_NAME
          || isPharmacyBaseName(baseName)
          || baseName === SMUGGLING_TUNNEL_BUILDING_NAME
          || isSmugglingTunnelBaseName(baseName)
          || baseName === STREET_DEALERS_BUILDING_NAME
          || isStreetDealersBaseName(baseName)
          || baseName === STRIP_CLUB_BUILDING_NAME
          || isStripClubBaseName(baseName)
          || baseName === DATA_CENTER_BUILDING_NAME
          || isDataCenterBaseName(baseName)
          || baseName === WAREHOUSE_BUILDING_NAME
          || isWarehouseBaseName(baseName)
          || baseName === RESEARCH_CENTER_BUILDING_NAME
          || isResearchCenterBaseName(baseName)
          || baseName === RECYCLING_CENTER_BUILDING_NAME
          || isRecyclingCenterBaseName(baseName)
        )
      ) return;
      refreshActiveBuildingDetailModal();
    }, 1000);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (state.pendingDataCenterTarget) {
        clearPendingDataCenterTargeting();
        window.Empire.UI?.pushEvent?.("Datové centrum: výběr cíle zrušen.");
        return;
      }
      close();
    });
  }

  function setBuildingDetailActionButtons(details) {
    const root = document.getElementById("building-detail-modal");
    if (!root) return;

    const actionButtons = Array.from(root.querySelectorAll("[data-building-action]"));
    const buttonByAction = new Map(actionButtons.map((button) => [button.dataset.buildingAction, button]));
    const collectBtn = buttonByAction.get("collect");
    const action1Btn = buttonByAction.get("1");
    const action2Btn = buttonByAction.get("2");
    const action3Btn = buttonByAction.get("3");
    const upgradeBtn = buttonByAction.get("upgrade");
    const specialActionsGroup = action1Btn?.closest(".building-detail-actions__group") || null;
    const upgradeGroup = upgradeBtn?.closest(".building-detail-actions__group") || null;

    actionButtons.forEach((button) => {
      button.classList.remove("hidden");
    });
    if (specialActionsGroup) specialActionsGroup.classList.remove("hidden");
    if (upgradeGroup) upgradeGroup.classList.remove("hidden");
    if (action1Btn) action1Btn.textContent = "Akce 1";
    if (action2Btn) action2Btn.textContent = "Akce 2";
    if (action3Btn) action3Btn.textContent = "Akce 3";
    if (collectBtn) collectBtn.textContent = "Vybrat členy";
    if (collectBtn) collectBtn.classList.add("hidden");
    if (upgradeBtn) upgradeBtn.textContent = "Upgrade";
    actionButtons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("title");
    });

    const mechanics = details?.mechanics;
    const mechanicsType = String(mechanics?.type || "").trim();
    const supportsCustomActions =
      mechanicsType === "apartment-block"
      || mechanicsType === "school"
      || mechanicsType === "fitness-club"
      || mechanicsType === "casino"
      || mechanicsType === "arcade"
      || mechanicsType === "auto-salon"
      || mechanicsType === "exchange"
      || mechanicsType === "restaurant"
      || mechanicsType === "convenience-store"
      || mechanicsType === "smuggling-tunnel"
      || mechanicsType === "street-dealers"
      || mechanicsType === "strip-club"
      || mechanicsType === "data-center"
      || mechanicsType === "warehouse"
      || mechanicsType === "research-center"
      || mechanicsType === "recycling-center"
      || mechanicsType === "armory"
      || mechanicsType === "factory"
      || mechanicsType === "pharmacy"
      || mechanicsType === "drug-lab";
    if (!supportsCustomActions) {
      return;
    }

    if (collectBtn && mechanicsType === "school") {
      collectBtn.classList.remove("hidden");
      collectBtn.disabled = mechanics.storedMembers <= 0;
      collectBtn.title = mechanics.storedMembers <= 0 ? "Budova nemá nasbírané členy." : "";
    } else if (collectBtn && mechanicsType === "drug-lab") {
      collectBtn.classList.remove("hidden");
      collectBtn.textContent = "Vybrat drogy";
      collectBtn.disabled = Math.max(0, Number(mechanics.storedTotal || 0)) <= 0;
      collectBtn.title = collectBtn.disabled ? "Drug Lab sklad je prázdný." : "";
    } else if (collectBtn && mechanicsType === "pharmacy") {
      collectBtn.classList.remove("hidden");
      collectBtn.textContent = "Vybrat suroviny";
      collectBtn.disabled = Math.max(0, Number(mechanics.storedTotal || 0)) <= 0;
      collectBtn.title = collectBtn.disabled ? "Lékárna nemá vyrobené suroviny." : "";
    } else if (collectBtn && mechanicsType === "factory") {
      collectBtn.classList.remove("hidden");
      collectBtn.textContent = "Vybrat materiály";
      collectBtn.disabled = Math.max(0, Number(mechanics.storedTotal || 0)) <= 0;
      collectBtn.title = collectBtn.disabled ? "Továrna nemá vyrobené materiály." : "";
    } else if (collectBtn && mechanicsType === "armory") {
      collectBtn.classList.add("hidden");
    }
    if (
      collectBtn
      && (
        mechanicsType === "armory"
        || mechanicsType === "pharmacy"
        || mechanicsType === "factory"
        || mechanicsType === "drug-lab"
      )
    ) {
      collectBtn.classList.add("hidden");
    }

    const applyActionButtonState = (button, label, cooldownMs) => {
      if (!button) return;
      const cooldownLeft = Math.max(0, Number(cooldownMs || 0));
      button.textContent = label;
      button.disabled = cooldownLeft > 0;
      button.title = cooldownLeft > 0 ? `Cooldown ${formatDurationLabel(cooldownLeft)}` : "";
    };

    if (mechanicsType === "apartment-block") {
      applyActionButtonState(action1Btn, "Nábor z ulice", mechanics.cooldowns?.recruit);
      applyActionButtonState(action2Btn, "Motivační večer", mechanics.cooldowns?.motivation);
      applyActionButtonState(action3Btn, "Skryté ubytování", mechanics.cooldowns?.hiddenHousing);
    } else if (mechanicsType === "school") {
      applyActionButtonState(action1Btn, "Náborová přednáška", mechanics.cooldowns?.lecture);
      applyActionButtonState(action2Btn, "Zrychlený kurz chemie", mechanics.cooldowns?.chemistry);
      applyActionButtonState(action3Btn, "Večerní program", mechanics.cooldowns?.evening);
    } else if (mechanicsType === "fitness-club") {
      applyActionButtonState(action1Btn, "Trénink gangu", mechanics.cooldowns?.gangTraining);
      applyActionButtonState(action2Btn, "Nábor talentu", mechanics.cooldowns?.talentRecruitment);
      applyActionButtonState(action3Btn, "Doping", mechanics.cooldowns?.doping);
    } else if (mechanicsType === "casino") {
      applyActionButtonState(action1Btn, "High Stakes", mechanics.cooldowns?.highStakes);
      applyActionButtonState(action2Btn, "Praní peněz", mechanics.cooldowns?.laundering);
      applyActionButtonState(action3Btn, "VIP večer", mechanics.cooldowns?.vipEvening);
    } else if (mechanicsType === "arcade") {
      applyActionButtonState(action1Btn, "Turnaj", mechanics.cooldowns?.tournament);
      applyActionButtonState(action2Btn, "Praní peněz", mechanics.cooldowns?.laundering);
      applyActionButtonState(action3Btn, "Noční tah", mechanics.cooldowns?.nightRun);
    } else if (mechanicsType === "auto-salon") {
      applyActionButtonState(action1Btn, "Prémiová nabídka", mechanics.cooldowns?.premiumOffer);
      applyActionButtonState(action2Btn, "Šedý dovoz", mechanics.cooldowns?.grayImport);
      applyActionButtonState(action3Btn, "Rychlá flotila", mechanics.cooldowns?.fleet);
    } else if (mechanicsType === "exchange") {
      applyActionButtonState(action1Btn, "Směna", mechanics.cooldowns?.exchange);
      applyActionButtonState(action2Btn, "Skrytý převod", mechanics.cooldowns?.hiddenTransfer);
      applyActionButtonState(action3Btn, "Rychlá likvidita", mechanics.cooldowns?.quickLiquidity);
    } else if (mechanicsType === "restaurant") {
      applyActionButtonState(action1Btn, "Večeře pro gang", mechanics.cooldowns?.gangDinner);
      applyActionButtonState(action2Btn, "VIP rezervace", mechanics.cooldowns?.vipReservation);
      applyActionButtonState(action3Btn, "Drby z ulice", mechanics.cooldowns?.streetGossip);
    } else if (mechanicsType === "convenience-store") {
      applyActionButtonState(action1Btn, "Noční prodej", mechanics.cooldowns?.nightSale);
      applyActionButtonState(action2Btn, "Malý deal", mechanics.cooldowns?.smallDeal);
      applyActionButtonState(action3Btn, "Krytí operací", mechanics.cooldowns?.coverOps);
    } else if (mechanicsType === "smuggling-tunnel") {
      applyActionButtonState(action1Btn, "Noční převoz", mechanics.cooldowns?.nightTransport);
      applyActionButtonState(action2Btn, "Velká zásilka", mechanics.cooldowns?.bigShipment);
      applyActionButtonState(action3Btn, "Přesměrování toku", mechanics.cooldowns?.rerouteFlow);
    } else if (mechanicsType === "street-dealers") {
      applyActionButtonState(action1Btn, "Boost prodeje", mechanics.cooldowns?.salesBoost);
      applyActionButtonState(action2Btn, "Agresivní push", mechanics.cooldowns?.aggressivePush);
      applyActionButtonState(action3Btn, "Rozšíření rajónu", mechanics.cooldowns?.territoryExpansion);
    } else if (mechanicsType === "strip-club") {
      applyActionButtonState(action1Btn, "VIP noc", mechanics.cooldowns?.vipNight);
      applyActionButtonState(action2Btn, "Soukromé služby", mechanics.cooldowns?.privateServices);
      applyActionButtonState(action3Btn, "Špinavé dohody", mechanics.cooldowns?.dirtyDeals);
    } else if (mechanicsType === "data-center") {
      applyActionButtonState(action1Btn, "Sledování hráče", mechanics.cooldowns?.playerTracking);
      applyActionButtonState(action2Btn, "Hack income", mechanics.cooldowns?.hackIncome);
      applyActionButtonState(action3Btn, "Datový boost", mechanics.cooldowns?.dataBoost);
    } else if (mechanicsType === "warehouse") {
      applyActionButtonState(action1Btn, "Hromadění zásob", mechanics.cooldowns?.stockpile);
      applyActionButtonState(action2Btn, "Rychlá distribuce", mechanics.cooldowns?.quickDistribution);
      applyActionButtonState(action3Btn, "Skrytý sklad", mechanics.cooldowns?.hiddenStorage);
    } else if (mechanicsType === "research-center") {
      applyActionButtonState(action1Btn, "Optimalizace výroby", mechanics.cooldowns?.optimizeProduction);
      applyActionButtonState(action2Btn, "Experimentální série", mechanics.cooldowns?.experimentalSeries);
      applyActionButtonState(action3Btn, "Technologický upgrade", mechanics.cooldowns?.technologyUpgrade);
    } else if (mechanicsType === "recycling-center") {
      applyActionButtonState(action1Btn, "Zpracování odpadu", mechanics.cooldowns?.processWaste);
      applyActionButtonState(action2Btn, "Rozborka zásilky", mechanics.cooldowns?.breakShipment);
      applyActionButtonState(action3Btn, "Nouzová obnova", mechanics.cooldowns?.emergencyRecovery);
    } else if (mechanicsType === "armory") {
      applyActionButtonState(action1Btn, "Attack gun boost", mechanics.cooldowns?.attackBoost);
      applyActionButtonState(action2Btn, "Defense gun boost", mechanics.cooldowns?.defenseBoost);
      if (action3Btn) {
        action3Btn.classList.add("hidden");
        action3Btn.disabled = true;
        action3Btn.title = "";
      }
    } else if (mechanicsType === "factory") {
      applyActionButtonState(action1Btn, "Akce 1", 0);
      applyActionButtonState(action2Btn, "Akce 2", 0);
      if (action3Btn) {
        action3Btn.classList.add("hidden");
        action3Btn.disabled = true;
        action3Btn.title = "";
      }
    } else if (mechanicsType === "pharmacy") {
      applyActionButtonState(action1Btn, "Akce 1", 0);
      applyActionButtonState(action2Btn, "Akce 2", 0);
      if (action3Btn) {
        action3Btn.classList.add("hidden");
        action3Btn.disabled = true;
        action3Btn.title = "";
      }
    } else if (mechanicsType === "drug-lab") {
      applyActionButtonState(action1Btn, "Overclock výroby", mechanics.cooldowns?.overclock);
      applyActionButtonState(action2Btn, "Čistá várka", mechanics.cooldowns?.cleanBatch);
      applyActionButtonState(action3Btn, "Skrytý provoz", mechanics.cooldowns?.hiddenOperation);
    }

    if (upgradeBtn) {
      if (mechanics.nextLevel && mechanics.nextUpgradeCost > 0) {
        const upgradeCostLabel = formatUpgradeCostLabel(mechanicsType, mechanics.nextUpgradeCost);
        upgradeBtn.textContent = `Upgrade L${mechanics.nextLevel} (${upgradeCostLabel})`;
        upgradeBtn.disabled = false;
        upgradeBtn.title = "";
      } else {
        upgradeBtn.textContent = "MAX level";
        upgradeBtn.disabled = true;
        upgradeBtn.title = "Budova je na maximálním levelu.";
      }
      upgradeBtn.classList.add("hidden");
    }
  }

  function updateArmoryMaterialsStickyCompactState() {
    const root = document.getElementById("building-detail-modal");
    if (!root || root.classList.contains("hidden")) return;
    if (String(root.dataset.buildingMechanicsType || "").trim() !== "armory") return;
    const panelStats = document.getElementById("building-detail-panel-stats");
    if (!panelStats || panelStats.classList.contains("hidden")) return;
    const stickyCard = panelStats.querySelector(".armory-card--materials-sticky");
    if (!(stickyCard instanceof HTMLElement)) return;
    const isCompact = stickyCard.classList.contains("is-scroll-compact");
    const enterCompactAt = 12;
    const exitCompactAt = 4;
    const scrollTop = Math.max(0, Number(panelStats.scrollTop) || 0);
    const shouldCompact = isCompact ? scrollTop > exitCompactAt : scrollTop > enterCompactAt;
    stickyCard.classList.toggle("is-scroll-compact", shouldCompact);
  }

  function updateBuildingMechanicsPanel(details) {
    const root = document.getElementById("building-detail-mechanics");
    const storedLabel = document.getElementById("building-detail-label-stored");
    const productionLabel = document.getElementById("building-detail-label-production");
    const heatLabel = document.getElementById("building-detail-label-heat");
    const effectsLabel = document.getElementById("building-detail-label-effects");
    const level = document.getElementById("building-detail-level");
    const stored = document.getElementById("building-detail-stored-members");
    const production = document.getElementById("building-detail-member-production");
    const heat = document.getElementById("building-detail-heat");
    const effects = document.getElementById("building-detail-effects");
    const infoEffects = document.getElementById("building-info-effects");
    const effectsRow = effects?.closest(".modal__row") || null;
    const productionRow = production?.closest(".modal__row") || null;
    const storedRow = stored?.closest(".modal__row") || null;
    const heatRow = heat?.closest(".modal__row") || null;
    const levelRow = level?.closest(".modal__row") || null;
    if (!root || !stored || !production || !heat || !effects) return;

    const mechanics = details?.mechanics;
    const mechanicsType = String(mechanics?.type || "").trim();
    if (
      !mechanics
      || (
        mechanicsType !== "apartment-block"
        && mechanicsType !== "school"
        && mechanicsType !== "fitness-club"
        && mechanicsType !== "casino"
        && mechanicsType !== "arcade"
        && mechanicsType !== "auto-salon"
        && mechanicsType !== "exchange"
        && mechanicsType !== "restaurant"
        && mechanicsType !== "convenience-store"
        && mechanicsType !== "smuggling-tunnel"
        && mechanicsType !== "street-dealers"
        && mechanicsType !== "strip-club"
        && mechanicsType !== "data-center"
        && mechanicsType !== "warehouse"
        && mechanicsType !== "research-center"
        && mechanicsType !== "recycling-center"
        && mechanicsType !== "armory"
        && mechanicsType !== "factory"
        && mechanicsType !== "pharmacy"
        && mechanicsType !== "drug-lab"
      )
    ) {
      root.classList.add("hidden");
      renderDrugLabDetailPanel(null);
      if (infoEffects) infoEffects.textContent = "Žádné aktivní mechaniky.";
      return;
    }

    if (storedLabel) storedLabel.textContent = "Uložení členové";
    if (productionLabel) productionLabel.textContent = "Produkce členů";
    if (heatLabel) heatLabel.textContent = "Heat";
    if (effectsLabel) effectsLabel.textContent = "Aktivní efekty";
    if (effectsRow) effectsRow.classList.remove("hidden");
    if (productionRow) productionRow.classList.remove("hidden");
    if (storedRow) storedRow.classList.remove("hidden");
    if (levelRow) levelRow.classList.remove("hidden");
    if (storedRow) storedRow.classList.remove("building-detail-pharmacy-row--stored");
    if (productionRow) productionRow.classList.remove("building-detail-pharmacy-row--production");
    if (heatRow) heatRow.classList.remove("building-detail-pharmacy-row--heat");
    root.style.removeProperty("display");
    root.style.removeProperty("grid-template-columns");
    root.style.removeProperty("gap");
    [storedRow, productionRow, heatRow].forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      row.style.removeProperty("display");
      row.style.removeProperty("grid-template-columns");
      row.style.removeProperty("align-items");
      row.style.removeProperty("gap");
      row.style.removeProperty("grid-column");
      row.style.removeProperty("order");
    });
    if (level) level.textContent = `L${mechanics.level}`;
    heat.textContent = `${formatDecimalValue(mechanics.heatPerDay, 2)} / 24h`;
    if (mechanicsType === "fitness-club") {
      if (storedLabel) storedLabel.textContent = "Bojový bonus";
      if (productionLabel) productionLabel.textContent = "Income bonus";
      const attackBoost = Number(mechanics.totalAttackBoostPct || 0);
      const defenseBoost = Number(mechanics.totalDefenseBoostPct || 0);
      const defensePrefix = defenseBoost >= 0 ? "+" : "";
      stored.textContent = `ATK +${formatDecimalValue(attackBoost, 2)}% • DEF ${defensePrefix}${formatDecimalValue(defenseBoost, 2)}%`;
      const districtBoost = Math.max(0, Number(mechanics.talentRecruitmentIncomeActive ? mechanics.talentRecruitmentIncomeBoostPct : 0));
      production.textContent =
        `x${formatDecimalValue(mechanics.currentIncomeMultiplier, 2)}`
        + (districtBoost > 0 ? ` • district +${formatDecimalValue(districtBoost, 2)}%` : "");
    } else if (mechanicsType === "casino") {
      if (storedLabel) storedLabel.textContent = "Praní bonus";
      if (productionLabel) productionLabel.textContent = "Income multiplikátor";
      stored.textContent = `+${formatDecimalValue(mechanics.launderingPct, 2)}%`;
      production.textContent = `x${formatDecimalValue(mechanics.currentIncomeMultiplier, 2)}`;
    } else if (mechanicsType === "arcade") {
      if (storedLabel) storedLabel.textContent = "Praní bonus";
      if (productionLabel) productionLabel.textContent = "Income multiplikátor";
      const passiveLabel = Number(mechanics.passiveLaunderingPct || 0) > 0
        ? ` • pasivně +${formatDecimalValue(mechanics.passiveLaunderedAmount || 0, 0)} C/tick`
        : "";
      stored.textContent = `+${formatDecimalValue(mechanics.launderingPct || 0, 2)}%${passiveLabel}`;
      production.textContent =
        `C x${formatDecimalValue(mechanics.currentIncomeMultiplier, 2)} • `
        + `D x${formatDecimalValue(mechanics.currentDirtyIncomeMultiplier, 2)}`;
    } else if (mechanicsType === "auto-salon") {
      if (storedLabel) storedLabel.textContent = "Logistický bonus";
      if (productionLabel) productionLabel.textContent = "Income multiplikátor";
      stored.textContent = mechanics.fleetActive && mechanics.hasLogisticsTargets
        ? `+${formatDecimalValue(mechanics.fleetLogisticsPct, 2)}%`
        : "0%";
      const fleetBonusLabel = mechanics.fleetCleanBonusPerHour > 0
        ? ` (+$${formatDecimalValue(mechanics.fleetCleanBonusPerHour, 2)} C/h)`
        : "";
      production.textContent =
        `C x${formatDecimalValue(mechanics.currentCleanIncomeMultiplier, 2)} • `
        + `D x${formatDecimalValue(mechanics.currentDirtyIncomeMultiplier, 2)}${fleetBonusLabel}`;
    } else if (mechanicsType === "exchange") {
      if (storedLabel) storedLabel.textContent = "Konverzní bonus";
      if (productionLabel) productionLabel.textContent = "Clean income multiplikátor";
      const heatReductionLabel = Number(mechanics.heatReductionPct || 0) > 0
        ? ` • heat -${formatDecimalValue(mechanics.heatReductionPct, 2)}%`
        : "";
      stored.textContent = `+${formatDecimalValue(mechanics.conversionBonusPct || 0, 2)}%${heatReductionLabel}`;
      production.textContent =
        `C x${formatDecimalValue(mechanics.currentCleanIncomeMultiplier, 2)}`
        + ` • D x${formatDecimalValue(mechanics.currentDirtyIncomeMultiplier, 2)}`;
    } else if (mechanicsType === "restaurant") {
      if (storedLabel) storedLabel.textContent = "Drby / přesnost";
      if (productionLabel) productionLabel.textContent = "Income multiplikátor";
      stored.textContent =
        `rare ${formatDecimalValue(mechanics.rareChancePct || 0, 2)}%`
        + ` • +${formatDecimalValue(mechanics.accuracyBonusPct || 0, 2)}%`
        + (Number(mechanics.extraGossipCount || 0) > 0 ? ` • +${Math.floor(Number(mechanics.extraGossipCount || 0))} drb` : "");
      const districtBoostLabel = mechanics.districtIncomeBoostPct > 0
        ? ` • District +${formatDecimalValue(mechanics.districtIncomeBoostPct, 2)}%`
        : "";
      production.textContent =
        `C x${formatDecimalValue(mechanics.currentCleanIncomeMultiplier, 2)} • `
        + `D x${formatDecimalValue(mechanics.currentDirtyIncomeMultiplier, 2)} • `
        + `V +${formatDecimalValue(mechanics.currentInfluencePerHour, 2)}/h${districtBoostLabel}`;
    } else if (mechanicsType === "convenience-store") {
      if (storedLabel) storedLabel.textContent = "Krytí operací";
      if (productionLabel) productionLabel.textContent = "Income multiplikátor";
      const coverReductionPct = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.actionBoosts.coverOpsHeatReductionPct || 0));
      stored.textContent = Number(mechanics.cooldowns?.coverOps || 0) > 0
        ? `- ${formatDecimalValue(coverReductionPct, 2)}% heat (aktivní)`
        : "neaktivní";
      const districtBoostLabel = mechanics.districtIncomeBoostPct > 0
        ? ` • District +${formatDecimalValue(mechanics.districtIncomeBoostPct, 2)}%`
        : "";
      production.textContent =
        `C x${formatDecimalValue(mechanics.currentCleanIncomeMultiplier, 2)} • `
        + `D x${formatDecimalValue(mechanics.currentDirtyIncomeMultiplier, 2)} • `
        + `V +${formatDecimalValue(mechanics.currentInfluencePerHour || 0, 2)}/h`
        + `${districtBoostLabel}`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay, 2)} / 24h`;
    } else if (mechanicsType === "smuggling-tunnel") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Tok";
      if (productionLabel) productionLabel.textContent = "Síťový bonus";
      stored.textContent = `${formatDecimalValue((details.hourlyIncome || 0) / 60, 2)} / min`;
      production.textContent = `Tato budova +${formatDecimalValue(SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.parkIncomeBoostPct, 2)}% (akce 3)`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "street-dealers") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Stacky / sloty";
      if (productionLabel) productionLabel.textContent = "Prodej / síť";
      const stacksCount = Math.max(0, Math.floor(Number(mechanics.stacks?.dealerTerritory || 0)));
      const stackPct = stacksCount * STREET_DEALERS_CONFIG.actions.territoryExpansion.incomeStackPct;
      const slots = Array.isArray(mechanics.streetDealerSlots) ? mechanics.streetDealerSlots : [];
      const filledSlots = slots.filter((slot) => Math.max(0, Math.floor(Number(slot?.storedUnits || 0))) > 0).length;
      stored.textContent = `${stacksCount} • ${filledSlots}/${Math.max(1, slots.length)} sloty`;
      production.textContent =
        `+${formatDecimalValue(stackPct, 2)}% income • `
        + `D +${formatDecimalValue(mechanics.slotSalesDirtyPerHour || 0, 2)}/h • `
        + `max +${formatDecimalValue(mechanics.networkMaxCapacityBonusPct || 0, 2)}% • `
        + `rychlost +${formatDecimalValue(mechanics.networkSpeedBonusPct || 0, 2)}%`;
      const passiveHeatPerTick = Math.max(0, Number(mechanics.passiveHeatPerTick || 0));
      const passiveHeatIntervalMs = Math.max(1, Number(mechanics.passiveHeatIntervalMs || (5 * 60 * 1000)));
      heat.textContent =
        `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h `
        + `(pasivně +${formatDecimalValue(passiveHeatPerTick, 1)} / ${formatDurationLabel(passiveHeatIntervalMs)})`;
    } else if (mechanicsType === "strip-club") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Soukromé služby";
      if (productionLabel) productionLabel.textContent = "Síť dohod";
      stored.textContent = "dirty cash / drby / vliv";
      production.textContent = `Dealeři/Tunel +${formatDecimalValue(STRIP_CLUB_CONFIG.actions.dirtyDeals.targetIncomeBoostPct, 2)}% (akce 3)`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "data-center") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Sledování";
      if (productionLabel) productionLabel.textContent = "Hack bonus";
      stored.textContent = mechanics.effectsLabel?.includes("Sledovaný hráč:")
        ? "hráč označen"
        : "bez cíle";
      production.textContent = `Hack income +${formatDecimalValue(DATA_CENTER_CONFIG.actions.hackIncome.incomeBoostPct, 2)}%`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "warehouse") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Logistika";
      if (productionLabel) productionLabel.textContent = "Distribuce";
      stored.textContent = "materiály / drogy / zbraně";
      production.textContent = `Efekt akcí +${formatDecimalValue(WAREHOUSE_CONFIG.actions.quickDistribution.actionsEffectBoostPct, 2)}% (akce 2)`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "research-center") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Tech boost";
      if (productionLabel) productionLabel.textContent = "Výroba";
      stored.textContent = "Továrna / Zbrojovka / Drug lab";
      production.textContent = "Akce: rychlost + produkce + čas výroby";
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "recycling-center") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Recyklace";
      if (productionLabel) productionLabel.textContent = "Obnova";
      stored.textContent = "šrot / chemie / zásoby";
      production.textContent = "Návrat části ztrát z poslední razie";
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || 0, 2)} / 24h`;
    } else if (mechanicsType === "armory") {
      if (storedLabel) storedLabel.textContent = "Vyrobené zbraně";
      if (productionLabel) productionLabel.textContent = "Aktivní sloty / výroba";
      if (heatLabel) heatLabel.textContent = "Heat výroby";
      if (levelRow) levelRow.classList.add("hidden");
      if (productionRow) productionRow.classList.add("hidden");
      if (effectsRow) effectsRow.classList.add("hidden");
      root.style.display = "grid";
      root.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      root.style.gap = "8px";
      [storedRow, heatRow].forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        row.style.display = "grid";
        row.style.gridTemplateColumns = "minmax(0, 1fr) auto";
        row.style.alignItems = "center";
        row.style.gap = "10px";
      });
      if (storedRow instanceof HTMLElement) {
        storedRow.style.gridColumn = "1";
        storedRow.style.order = "1";
      }
      if (heatRow instanceof HTMLElement) {
        heatRow.style.gridColumn = "2";
        heatRow.style.order = "2";
      }
      const activeAttackSlots = Math.max(0, Math.floor(Number(mechanics.activeAttackSlots || 0)));
      const totalAttackSlots = Math.max(1, Math.floor(Number((mechanics.attackSlots || []).length || 0)));
      const activeDefenseSlots = Math.max(0, Math.floor(Number(mechanics.activeDefenseSlots || 0)));
      const totalDefenseSlots = Math.max(1, Math.floor(Number((mechanics.defenseSlots || []).length || 0)));
      const storedAttackTotal = Math.max(0, Math.floor(Number(mechanics.storedAttackTotal || 0)));
      const storedDefenseTotal = Math.max(0, Math.floor(Number(mechanics.storedDefenseTotal || 0)));
      stored.textContent = `Útok ${storedAttackTotal} • Obrana ${storedDefenseTotal}`;
      production.textContent = `U ${activeAttackSlots}/${totalAttackSlots} • O ${activeDefenseSlots}/${totalDefenseSlots}`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerHour || 0, 2)} / h`;
    } else if (mechanicsType === "factory") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedRow) storedRow.classList.add("hidden");
      if (productionLabel) productionLabel.textContent = "Síť aktivních továren";
      if (heatLabel) heatLabel.textContent = "Heat";
      if (productionRow) productionRow.classList.add("hidden");
      const resources = mechanics.resources || {};
      const rates = mechanics.ratesPerHour || {};
      stored.textContent =
        `${Math.max(0, Math.floor(Number(resources.metalParts || 0)))}/`
        + `${Math.max(0, Math.floor(Number(resources.techCore || 0)))}/`
        + `${Math.max(0, Math.floor(Number(resources.combatModule || 0)))}`;
      production.textContent =
        `MP ${formatDecimalValue(rates.metalParts || 0, 2)}/h • `
        + `TC ${formatDecimalValue(rates.techCore || 0, 2)}/h • `
        + `CM ${formatDecimalValue(rates.combatModule || 0, 2)}/h`;
      heat.textContent = `+${FACTORY_CONFIG.combatModule.heatPerUnit} / Combat Module`;
    } else if (mechanicsType === "pharmacy") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Suroviny C/B/S";
      if (productionLabel) productionLabel.textContent = "Síťové bonusy";
      if (effectsRow) effectsRow.classList.add("hidden");
      if (storedRow) storedRow.classList.add("building-detail-pharmacy-row--stored");
      if (productionRow) productionRow.classList.add("building-detail-pharmacy-row--production");
      if (heatRow) heatRow.classList.add("building-detail-pharmacy-row--heat");
      root.style.display = "grid";
      root.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      root.style.gap = "8px";
      [storedRow, heatRow, productionRow].forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        row.style.display = "grid";
        row.style.gridTemplateColumns = "minmax(0, 1fr) auto";
        row.style.alignItems = "center";
        row.style.gap = "10px";
      });
      if (storedRow instanceof HTMLElement) {
        storedRow.style.gridColumn = "1";
        storedRow.style.order = "1";
      }
      if (heatRow instanceof HTMLElement) {
        heatRow.style.gridColumn = "2";
        heatRow.style.order = "2";
      }
      if (productionRow instanceof HTMLElement) {
        productionRow.style.gridColumn = "1 / -1";
        productionRow.style.order = "3";
      }
      const resources = mechanics.resources || {};
      stored.textContent =
        `${Math.max(0, Math.floor(Number(resources.chemicals || 0)))}/`
        + `${Math.max(0, Math.floor(Number(resources.biomass || 0)))}/`
        + `${Math.max(0, Math.floor(Number(resources.stimPack || 0)))}`;
      production.textContent =
        `Sklad(+${formatDecimalValue(mechanics.pharmacyStorageCapBonusPct || 0, 2)}%)\n`
        + `Síť lékáren(+${formatDecimalValue(mechanics.pharmacyProductionBonusPct || 0, 2)}% rychlost)`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay || PHARMACY_CONFIG.baseHeatPerDay, 2)} / 24h`;
    } else if (mechanicsType === "drug-lab") {
      if (levelRow) levelRow.classList.add("hidden");
      if (storedLabel) storedLabel.textContent = "Interní sklad";
      if (productionLabel) productionLabel.textContent = "Aktivní sloty";
      if (heatLabel) heatLabel.textContent = "Heat z výroby";
      if (productionRow) productionRow.classList.add("hidden");
      if (effectsRow) effectsRow.classList.add("hidden");
      stored.textContent = `${Math.max(0, Math.floor(Number(mechanics.storedTotal || 0)))} / ${Math.max(1, Math.floor(Number(mechanics.storageCapacity || 0)))}`;
      production.textContent =
        `${Math.max(0, Math.floor(Number(mechanics.activeSlots || 0)))}/${Math.max(1, Math.floor(Number(mechanics.unlockedSlots || 0)))} • `
        + `x${formatDecimalValue(mechanics.currentProductionMultiplier || 1, 2)}`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerHour || 0, 2)} / h`;
    } else {
      stored.textContent = `${mechanics.storedMembers} / ${mechanics.capacity}`;
      production.textContent = `${formatDecimalValue(mechanics.productionPerCycle, 2)} / 10 min`;
      heat.textContent = `${formatDecimalValue(mechanics.heatPerDay, 2)} / 24h`;
    }
    const rawEffectsLabel = String(mechanics.effectsLabel || "").trim();
    const effectsMultilineLabel = rawEffectsLabel
      ? rawEffectsLabel.replace(/\s*•\s*/g, "\n")
      : "Žádné";
    effects.textContent = effectsMultilineLabel;
    if (infoEffects) {
      infoEffects.textContent = rawEffectsLabel
        ? rawEffectsLabel.replace(/\s*•\s*/g, "\n")
        : "Žádné aktivní mechaniky.";
    }
    renderDrugLabDetailPanel(details);
    root.classList.remove("hidden");
  }

  function refreshActiveBuildingDetailModal() {
    const active = resolveActiveBuildingContext();
    if (!active) return;
    openBuildingDetailModal(active.context, active.district || null);
  }

  function resolveBuildingInfoActions(details) {
    const customActions = Array.isArray(details?.specialActions)
      ? details.specialActions.filter((entry) => {
        if (typeof entry === "string") return Boolean(entry.trim());
        if (!entry || typeof entry !== "object") return false;
        return Boolean(String(entry.title || "").trim()) || Boolean(String(entry.description || "").trim());
      })
      : [];
    if (customActions.length) return customActions;

    const mechanicsType = String(details?.mechanics?.type || "").trim();
    if (mechanicsType === "apartment-block") {
      return [
        "Nábor z ulice: Cooldown 3h, okamžitě přidá náhodně 5 až 15 členů do kapacity budovy a přidá +5 heat.",
        "Motivační večer: Cooldown 6h, na 2h zdvojnásobí produkci členů v budově.",
        "Skryté ubytování: Cooldown 8h, na 2h nastaví income budovy na 0 a aktivuje ochranný režim proti razii."
      ];
    }
    if (mechanicsType === "school") {
      return [
        "Náborová přednáška: Cooldown 3h, okamžitě přidá náhodně 4 až 10 členů do kapacity školy a přidá +2 heat.",
        "Zrychlený kurz chemie: Cooldown 4h, trvá 2h a pokud je v districtu Drug Lab, zvýší jeho rychlost o +25 % (+3 heat).",
        "Večerní program: Cooldown 6h, trvá 2h, snižuje heat districtu o 20 %, ale income školy je během efektu 0."
      ];
    }
    if (mechanicsType === "fitness-club") {
      return [
        "Trénink gangu: Cooldown 8h, trvá 2h, +10% útok a +10% obrana (na L3+ silnější), heat +5.",
        "Nábor talentu: Cooldown 10h, +10% vliv na 2h a +2% district income na 4h (na L3+ silnější), heat +4.",
        "Doping: Cooldown 12h, +35% útok na 1h (na L3+ silnější), potom -10% obrana na 1h, heat +8."
      ];
    }
    if (mechanicsType === "casino") {
      return [
        "High Stakes: Cooldown 6h, okamžitě přidá +50 až +150 % cash (z hodinového income kasina) a +10 heat.",
        "Praní peněz: Cooldown 8h, převede 20 % dirty cash na clean (škáluje s levelem), +6 heat.",
        "VIP večer: Cooldown 10h, trvá 2h, +40 % income kasina (škáluje s levelem), +7 heat."
      ];
    }
    if (mechanicsType === "arcade") {
      return [
        "Turnaj: Cooldown 6h, trvá 2h, zvýší income herny o +35 % a přidá +5 heat.",
        "Praní peněz: Cooldown 7h, okamžitě převede 10 % dirty cash na clean cash a přidá +4 heat.",
        "Noční tah: Cooldown 8h, trvá 1h, zvýší dirty cash herny o +50 % a přidá +7 heat."
      ];
    }
    if (mechanicsType === "auto-salon") {
      return [
        "Prémiová nabídka: Cooldown 4h, trvá 2h, zvýší legální income autosalonu o +50 % (škáluje s levelem) a přidá +2 heat.",
        "Šedý dovoz: Cooldown 6h, trvá 2h, zvýší dirty income autosalonu o +80 % (škáluje s levelem), přidá +5 heat a na 2h zvýší riziko policejní razie v districtu o +10 % (škáluje s levelem).",
        "Rychlá flotila: Cooldown 5h, trvá 2h, přidá autosalonu +15 clean cash/h (škáluje s levelem), a pokud vlastníš Garage, Taxi služba nebo Pašovací tunel, zvýší jejich efektivitu o +20 % (škáluje s levelem); zároveň přidá +3 heat."
      ];
    }
    if (mechanicsType === "exchange") {
      return [
        "Směna: Cooldown 6h, převede cash ↔ materiály a přidá +3 heat.",
        "Skrytý převod: Cooldown 8h, okamžitě přidá +15 % clean cash a přidá +4 heat.",
        "Rychlá likvidita: Cooldown 10h, okamžitě přidá +5000 clean cash a přidá +5 heat."
      ];
    }
    if (mechanicsType === "restaurant") {
      return [
        "Večeře pro gang: Cooldown 8h, vybereš vlastní district a na 2h zvýší income všech budov v tom districtu o +15 %, +4 heat.",
        "VIP rezervace: Cooldown 8h, na 2h dá restauraci +30 % clean income a +5 % vliv, +5 heat.",
        "Drby z ulice: Cooldown 6h, vybereš district, získáš 1-2 drby (L5 +1), 30% šance na vzácný drb (L3 vyšší), +3 heat."
      ];
    }
    if (mechanicsType === "convenience-store") {
      return [
        "Noční prodej: Cooldown 6h, trvá 4h, zvýší income večerky o +25 % a přidá +3 heat.",
        "Malý deal: Cooldown 7h, okamžitě přidá +10 ks Neon Dust a +4 heat.",
        "Krytí operací: Cooldown 10h, trvá 4h, sníží heat jiné budovy o -30 % a přidá +2 heat."
      ];
    }
    if (mechanicsType === "smuggling-tunnel") {
      return [
        "Noční převoz: Cooldown 6h, trvá 2h, zvýší dirty cash Pašovacího tunelu o +40 % a přidá +6 heat.",
        "Velká zásilka: Cooldown 8h, okamžitě přidá +13 drog do zásob a +10 heat.",
        "Přesměrování toku: Cooldown 10h, trvá 2h, zvýší income této budovy o +25 % a přidá +8 heat."
      ];
    }
    if (mechanicsType === "street-dealers") {
      return [
        "Boost prodeje: Cooldown 5h, trvá 3h, zvýší income dealerů o +30 % a přidá +4 heat.",
        "Agresivní push: Cooldown 6h, trvá 1h, zvýší dirty cash dealerů o +70 % a přidá +8 heat.",
        "Rozšíření rajónu: Cooldown 10h, přidá trvalý stack (+5 % income), stackuje se bez limitu, +5 heat."
      ];
    }
    if (mechanicsType === "strip-club") {
      return [
        "VIP noc: Cooldown 6h, trvá 2h, zvýší income Strip clubu o +50 % a přidá +6 heat.",
        "Soukromé služby: Cooldown 8h, +1500 dirty cash, vygeneruje 4-8 drbů, +10 vliv a +7 heat.",
        "Špinavé dohody: Cooldown 10h, trvá 2h, zvýší income budovy Pouliční dealeři nebo Pašovací tunel o +20 % a přidá +9 heat."
      ];
    }
    if (mechanicsType === "data-center") {
      return [
        "Sledování hráče: Cooldown 8h, vybereš hráče a získáš 1-3 poslední akce + slabé districty (+6 heat).",
        "Hack income: Cooldown 8h, vybereš nepřátelský distrikt, na 2h zvýší income Datového centra o +20 % (+10 heat).",
        "Datový boost: Cooldown 12h, na 2h sníží cooldowny akcí o -15 % (+8 heat)."
      ];
    }
    if (mechanicsType === "warehouse") {
      return [
        "Hromadění zásob: Cooldown 6h, +2 náhodné materiály z Lékárny/Továrny (+3 heat).",
        "Rychlá distribuce: Cooldown 8h, na 2h zvýší efekt akcí v jiných budovách o +5 % (+5 heat).",
        "Skrytý sklad: Cooldown 10h, na 3h sníží účinnost razie proti ztrátě zdrojů (+4 heat)."
      ];
    }
    if (mechanicsType === "research-center") {
      return [
        "Optimalizace výroby: Cooldown 8h, na 2h +30% rychlost produkce Továrna/Zbrojovka (+6 heat).",
        "Experimentální série: Cooldown 10h, na 1h +50% produkce Továrna/Zbrojovka, 20% fail bez efektu (+9 heat).",
        "Technologický upgrade: Cooldown 12h, na 2h -20% čas výroby v Drug lab a Zbrojovka (+7 heat)."
      ];
    }
    if (mechanicsType === "recycling-center") {
      return [
        "Zpracování odpadu: Cooldown 6h, +2 náhodné materiály z Drug lab/Zbrojovka/Lékárna/Továrna (+3 heat).",
        "Rozborka zásilky: Cooldown 8h, +2 Chemicals a +5 Metal Parts (+5 heat).",
        "Nouzová obnova: Cooldown 10h, vrátí 10-18% zabaveného z poslední razie po potvrzení (+6 heat)."
      ];
    }
    if (mechanicsType === "armory") {
      return [
        "Útok: Baseballová pálka, Pouliční pistole, Granát, Samopal, Bazuka.",
        "Obrana: Neprůstřelná vesta, Ocelové barikády, Bezpečnostní kamery, Automatické kulometné stanoviště, Alarm.",
        "Attack gun boost: Cooldown 6h, trvá 2h, +20 % produkce útočných zbraní, okamžitě +10 heat a během trvání +5 heat/h.",
        "Defense gun boost: Cooldown 6h, trvá 2h, +20 % produkce obranných zbraní, okamžitě +10 heat a během trvání +5 heat/h."
      ];
    }
    if (mechanicsType === "factory") {
      return [
        "Slot 1 vyrábí Metal Parts (základní materiál pro zbraně).",
        "Slot 2 vyrábí Tech Core (pokročilý materiál).",
        `Slot 3 craftí Combat Module: ${FACTORY_CONFIG.combatModule.metalPartsCost} Metal Parts + ${FACTORY_CONFIG.combatModule.techCoreCost} Tech Core, ${formatDurationLabel(FACTORY_CONFIG.combatModule.durationMs)} na kus a +${FACTORY_CONFIG.combatModule.heatPerUnit} heat za kus.`,
        "Combat boosty se aktivují přes Boost nad mapou: Assault Protocol (2 CM), Rapid Strike (3 CM), Breach Mode (4 CM)."
      ];
    }
    if (mechanicsType === "pharmacy") {
      return [
        "Lékárna má 3 sloty: Chemicals, Biomass, Stim Pack. Každý slot lze zvlášť spustit/zastavit.",
        "Vybrat suroviny přesune vyrobené látky do zásob Drug Labu (centrální vstup C/B/S).",
        "Boosty aktivuješ tlačítkem Boost nad mapou: Recon (1 Ghost Serum), Action (1 Ghost Serum), Neuro (1 Overdrive X, +3 heat), trvání 2h."
      ];
    }
    if (mechanicsType === "drug-lab") {
      return [
        "Overclock výroby: Cooldown 6h, trvá 2h, +50 % produkce všech slotů a okamžitě +3 heat.",
        "Čistá várka: Cooldown 5h, trvá 2h, nově vyrobené drogy jsou enhanced (+20 % síla efektu při použití).",
        "Skrytý provoz: Cooldown 6h, trvá 2h, heat z výroby -30 %, ale produkce -20 %."
      ];
    }
    return ["Speciální akce této budovy budou doplněny."];
  }

  function normalizeBuildingInfoActionRows(actions) {
    return (Array.isArray(actions) ? actions : []).map((entry) => {
      if (entry && typeof entry === "object") {
        const title = String(entry.title || "").trim();
        const description = String(entry.description || "").trim();
        if (!title && !description) return null;
        return { title, description };
      }
      const raw = String(entry || "").trim();
      if (!raw) return null;
      const colonIndex = raw.indexOf(":");
      if (colonIndex <= 0) return { title: raw, description: "" };
      const title = raw.slice(0, colonIndex).trim();
      const description = raw.slice(colonIndex + 1).trim();
      return { title: title || raw, description };
    }).filter(Boolean);
  }

  function formatInfoCooldownCountdown(msRaw) {
    const totalSeconds = Math.max(0, Math.ceil(Math.max(0, Number(msRaw || 0)) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours} h / ${minutes} min / ${seconds} s`;
  }

  function resolveInfoActionCooldownMs(mechanicsType, actionTitle, mechanics) {
    const title = normalizeBuildingTypeName(actionTitle);
    const cooldowns = mechanics?.cooldowns || {};
    if (mechanicsType === "smuggling-tunnel") {
      if (title.includes("nocni prevoz")) return cooldowns.nightTransport;
      if (title.includes("velka zasilka")) return cooldowns.bigShipment;
      if (title.includes("presmerovani toku")) return cooldowns.rerouteFlow;
      return null;
    }
    if (mechanicsType === "street-dealers") {
      if (title.includes("boost prodeje")) return cooldowns.salesBoost;
      if (title.includes("agresivni push")) return cooldowns.aggressivePush;
      if (title.includes("rozsireni rajonu")) return cooldowns.territoryExpansion;
      return null;
    }
    if (mechanicsType === "strip-club") {
      if (title.includes("vip noc")) return cooldowns.vipNight;
      if (title.includes("soukrome sluzby")) return cooldowns.privateServices;
      if (title.includes("spinave dohody")) return cooldowns.dirtyDeals;
      return null;
    }
    if (mechanicsType === "convenience-store") {
      if (title.includes("nocni prodej")) return cooldowns.nightSale;
      if (title.includes("maly deal")) return cooldowns.smallDeal;
      if (title.includes("kryti operaci")) return cooldowns.coverOps;
      return null;
    }
    if (mechanicsType === "data-center") {
      if (title.includes("sledovani hrace")) return cooldowns.playerTracking;
      if (title.includes("hack income")) return cooldowns.hackIncome;
      if (title.includes("datovy boost")) return cooldowns.dataBoost;
      return null;
    }
    if (mechanicsType === "warehouse") {
      if (title.includes("hromadeni zasob")) return cooldowns.stockpile;
      if (title.includes("rychla distribuce")) return cooldowns.quickDistribution;
      if (title.includes("skryty sklad")) return cooldowns.hiddenStorage;
      return null;
    }
    if (mechanicsType === "research-center") {
      if (title.includes("optimalizace vyroby")) return cooldowns.optimizeProduction;
      if (title.includes("experimentalni serie")) return cooldowns.experimentalSeries;
      if (title.includes("technologicky upgrade")) return cooldowns.technologyUpgrade;
      return null;
    }
    if (mechanicsType === "recycling-center") {
      if (title.includes("zpracovani odpadu")) return cooldowns.processWaste;
      if (title.includes("rozborka zasilky")) return cooldowns.breakShipment;
      if (title.includes("nouzova obnova")) return cooldowns.emergencyRecovery;
      return null;
    }
    return null;
  }

  function resolveUpgradeEffectSummary(mechanicsType) {
    const defaultSummary = "zvýší levelové bonusy budovy podle jejího typu (income/produkce/kapacita).";
    if (mechanicsType === "apartment-block") return "+10 % produkce členů, +10 % kapacita, +10 % income.";
    if (mechanicsType === "school") return "+10 % produkce členů, +10 % kapacita, +10 % income.";
    if (mechanicsType === "fitness-club") return "+10 % síla bonusů a škálování income dle levelu.";
    if (mechanicsType === "casino") return "+10 % škálování income a síly akcí dle levelu.";
    if (mechanicsType === "arcade") return "+10 % škálování income a bonusů praní dle levelu.";
    if (mechanicsType === "auto-salon") return "+10 % škálování clean/dirty income a síly akcí.";
    if (mechanicsType === "exchange") return "+10 % škálování income a konverzních bonusů.";
    if (mechanicsType === "restaurant") return "+10 % škálování income a síly efektů akcí.";
    if (mechanicsType === "convenience-store") return "+10 % škálování income a efektů podpůrných akcí.";
    if (mechanicsType === "smuggling-tunnel") return "zvýší levelové multiplikátory tunelu a sílu jeho akcí.";
    if (mechanicsType === "street-dealers") return "zvýší levelové multiplikátory dealerů a sílu jejich akcí.";
    if (mechanicsType === "strip-club") return "zvýší levelové multiplikátory income a sílu akcí klubu.";
    if (mechanicsType === "data-center") return "zvýší kvalitu intel výstupů a škálování akcí datového centra.";
    if (mechanicsType === "warehouse") return "zvýší levelové bonusy logistiky a efektivitu skladových akcí.";
    if (mechanicsType === "research-center") return "zvýší levelové bonusy výzkumu a sílu technologických akcí.";
    if (mechanicsType === "recycling-center") return "zvýší levelové bonusy recyklace a efektivitu obnovy zdrojů.";
    if (mechanicsType === "armory") return "+10 % rychlost výroby slotů a škálování produkce zbraní.";
    if (mechanicsType === "factory") return "+10 % rychlost výroby slotů a škálování produkce materiálů.";
    if (mechanicsType === "pharmacy") return "+10 % rychlost výroby slotů a škálování outputu surovin.";
    if (mechanicsType === "drug-lab") return "+10 % rychlost výroby a škálování výkonu slotů Drug Labu.";
    return defaultSummary;
  }

  function appendBuildingUpgradeInfoRow(list, details, mechanicsType) {
    if (!(list instanceof HTMLElement)) return;
    const mechanics = details?.mechanics || {};
    const nextLevel = Math.max(0, Math.floor(Number(mechanics.nextLevel || 0)));
    const nextUpgradeCost = Math.max(0, Math.floor(Number(mechanics.nextUpgradeCost || 0)));
    const li = document.createElement("li");
    li.className = "building-info-action-row building-info-action-row--upgrade";
    const title = document.createElement("strong");
    title.className = "building-info-action-row__title";
    if (nextLevel > 0 && nextUpgradeCost > 0) {
      const upgradeCostLabel = formatUpgradeCostLabel(mechanicsType, nextUpgradeCost);
      title.textContent = `Upgrade na L${nextLevel}`;
      const description = document.createElement("span");
      description.className = "building-info-action-row__desc";
      description.textContent = `Cena: ${upgradeCostLabel} • Efekt: ${resolveUpgradeEffectSummary(mechanicsType)}`;
      li.append(title, description);
    } else {
      title.textContent = "Upgrade";
      const description = document.createElement("span");
      description.className = "building-info-action-row__desc";
      description.textContent = "Budova je na maximálním levelu.";
      li.append(title, description);
    }
    list.appendChild(li);
  }

  function renderBuildingInfoActions(details) {
    const list = document.getElementById("building-info-actions");
    if (!list) return;
    list.innerHTML = "";
    const mechanicsType = String(details?.mechanics?.type || "").trim();
    const useLabGridLayout =
      mechanicsType === "drug-lab"
      || mechanicsType === "pharmacy"
      || mechanicsType === "factory";
    list.classList.toggle("building-info-card__actions--armory", mechanicsType === "armory");
    list.classList.toggle("building-info-card__actions--drug-lab", useLabGridLayout);
    appendBuildingUpgradeInfoRow(list, details, mechanicsType);
    if (mechanicsType === "armory") {
      const attackRows = [
        ["Baseballová pálka", "AP 5 • 8s", "Rychlý low-tier tlak"],
        ["Pouliční pistole", "AP 10 • 10s", "Stabilní early pressure"],
        ["Granát", "AP 14 • 15s", "Ignoruje 0.3 % obrany za ks"],
        ["Samopal", "AP 18 • 20s", "+0.2 power za ks při full attack setu"],
        ["Bazuka", "AP 30 • 35s", "+0.5 % šance na totální destrukci za ks"]
      ];
      const defenseRows = [
        ["Neprůstřelná vesta", "DP 6 • 8s", "-0.5 % ztráty obránců za ks"],
        ["Ocelové barikády", "DP 12 • 15s", "+0.02 % délka útoku za ks"],
        ["Bezpečnostní kamery", "DP 6 • 18s", "5+ ks = vysoká šance odhalit špeha"],
        ["Kulometné stanoviště", "DP 20 • 25s", "-0.3 % síla útoku útočníka za ks"],
        ["Alarm", "DP 10 • 12s", "5+ ks = vysoká šance selhání vykradení"]
      ];
      const createSection = (title, tone, rows) => {
        const li = document.createElement("li");
        li.className = `armory-info-block armory-info-block--${tone}`;
        li.innerHTML = `
          <div class="armory-info-block__head">
            <span class="armory-info-block__badge">${title}</span>
            <span class="armory-info-block__hint"></span>
          </div>
          <div class="armory-info-block__grid">
            ${rows.map(([name, meta, effect]) => `
              <article class="armory-info-chip armory-info-chip--${tone}">
                <strong class="armory-info-chip__title">${name}</strong>
                <span class="armory-info-chip__meta">${meta}</span>
                <span class="armory-info-chip__effect">${effect}</span>
              </article>
            `).join("")}
          </div>
        `;
        return li;
      };
      const createBoostSection = () => {
        const li = document.createElement("li");
        li.className = "armory-info-block armory-info-block--boost";
        li.innerHTML = `
          <div class="armory-info-block__head">
            <span class="armory-info-block__badge">Boosty</span>
            <span class="armory-info-block__hint"></span>
          </div>
          <div class="armory-info-block__grid armory-info-block__grid--boosts">
            <article class="armory-info-chip armory-info-chip--boost">
              <strong class="armory-info-chip__title">Attack gun boost</strong>
              <span class="armory-info-chip__meta">2h • CD 6h</span>
              <span class="armory-info-chip__effect">+20 % produkce útočných zbraní • +10 heat • +5 heat/h</span>
            </article>
            <article class="armory-info-chip armory-info-chip--boost">
              <strong class="armory-info-chip__title">Defense gun boost</strong>
              <span class="armory-info-chip__meta">2h • CD 6h</span>
              <span class="armory-info-chip__effect">+20 % produkce obranných zbraní • +10 heat • +5 heat/h</span>
            </article>
          </div>
        `;
        return li;
      };
      list.appendChild(createSection("Útočné systémy", "attack", attackRows));
      list.appendChild(createSection("Obranné systémy", "defense", defenseRows));
      list.appendChild(createBoostSection());
      return;
    }
    if (mechanicsType === "drug-lab") {
      const productRows = [
        ["Velvet Smoke", "10s • 2C / 1B", "Nejlevnější tabáková droga, tlak na vliv a cashflow"],
        ["Neon Dust", "18s • 3C / 1B", "Chemický prášek podobný speedu, rychlý street push"],
        ["Pulse Shot", "35s • 2C / 1B / 2S", "Top tržní produkt s vysokou hodnotou a tlakem na výkon"],
        ["Ghost Serum", "40s • 1C / 2B / 2S", "Taktická látka pro stealth a nižší raid pressure"],
        ["Overdrive X", "55s • 3C / 1B / 3S", "Agresivní výkonový stimulant s vysokým výnosem"]
      ];
      const boostRows = [
        ["Overclock výroby", "2h • CD 6h", "+50 % produkce všech slotů • +3 heat"],
        ["Čistá várka", "2h • CD 5h", "Nové dávky jsou enhanced • +20 % síla efektu"],
        ["Skrytý provoz", "2h • CD 6h", "Heat z výroby -30 % • produkce -20 %"]
      ];
      const createSection = (title, tone, rows) => {
        const li = document.createElement("li");
        li.className = `lab-info-block lab-info-block--${tone}`;
        li.innerHTML = `
          <div class="lab-info-block__head">
            <span class="lab-info-block__badge">${title}</span>
            <span class="lab-info-block__hint"></span>
          </div>
          <div class="lab-info-block__grid ${tone === "boost" ? "lab-info-block__grid--boosts" : ""}">
            ${rows.map(([name, meta, effect]) => `
              <article class="lab-info-chip lab-info-chip--${tone}">
                <strong class="lab-info-chip__title">${name}</strong>
                <span class="lab-info-chip__meta">${meta}</span>
                <span class="lab-info-chip__effect">${effect}</span>
              </article>
            `).join("")}
          </div>
        `;
        return li;
      };
      list.appendChild(createSection("Produkce", "product", productRows));
      list.appendChild(createSection("Lab boosty", "boost", boostRows));
      return;
    }
    if (mechanicsType === "pharmacy") {
      const supplyRows = [
        ["Chemicals", "12s / ks • max 20 ks", "Základní chemická surovina pro výrobu v Drug Labu"],
        ["Biomass", "18s / ks • max 30 ks", "Biologická složka pro street a lab recepty"],
        ["Stim Pack", "25s / ks • max 30 ks", "Pokročilý vstup pro silnější recepty a boost chemii"]
      ];
      const utilityRows = [
        ["Ghost Serum boost", "1× Ghost Serum", "Stealth / recon boost přes panel Boost"],
        ["Overdrive X boost", "1× Overdrive X", "Akční výkonový boost přes panel Boost"]
      ];
      const createSection = (title, tone, rows, hint = "") => {
        const li = document.createElement("li");
        li.className = `lab-info-block lab-info-block--${tone}`;
        li.innerHTML = `
          <div class="lab-info-block__head">
            <span class="lab-info-block__badge">${title}</span>
            <span class="lab-info-block__hint">${hint}</span>
          </div>
          <div class="lab-info-block__grid ${tone === "boost" ? "lab-info-block__grid--boosts" : ""}">
            ${rows.map(([name, meta, effect]) => `
              <article class="lab-info-chip lab-info-chip--${tone}">
                <strong class="lab-info-chip__title">${name}</strong>
                <span class="lab-info-chip__meta">${meta}</span>
                <span class="lab-info-chip__effect">${effect}</span>
              </article>
            `).join("")}
          </div>
        `;
        return li;
      };
      list.appendChild(createSection("Výroba surovin", "product", supplyRows));
      list.appendChild(createSection("Boost utility", "boost", utilityRows));
      return;
    }
    if (mechanicsType === "factory") {
      const materialRows = [
        ["Metal Parts", "10s / ks", "Základní materiál pro zbraně a obranu"],
        ["Tech Core", "18s / ks", "Pokročilá komponenta pro silnější kusy"],
        ["Combat Module", "15m / ks", "Boost materiál pro fight akce a factory protokoly"]
      ];
      const boostRows = [
        ["Assault Protocol", "2 CM", "+attack tlak a agresivní tempo"],
        ["Rapid Strike", "3 CM", "+attack/raid speed, větší průraz"],
        ["Breach Mode", "4 CM", "+destroy chance a breach pressure"]
      ];
      const createSection = (title, tone, rows, hint = "") => {
        const li = document.createElement("li");
        li.className = `lab-info-block lab-info-block--${tone}`;
        li.innerHTML = `
          <div class="lab-info-block__head">
            <span class="lab-info-block__badge">${title}</span>
            <span class="lab-info-block__hint">${hint}</span>
          </div>
          <div class="lab-info-block__grid ${tone === "boost" ? "lab-info-block__grid--boosts" : ""}">
            ${rows.map(([name, meta, effect]) => `
              <article class="lab-info-chip lab-info-chip--${tone}">
                <strong class="lab-info-chip__title">${name}</strong>
                <span class="lab-info-chip__meta">${meta}</span>
                <span class="lab-info-chip__effect">${effect}</span>
              </article>
            `).join("")}
          </div>
        `;
        return li;
      };
      list.appendChild(createSection("Produkce", "product", materialRows));
      list.appendChild(createSection("Combat boosty", "boost", boostRows));
      return;
    }
    const actions = normalizeBuildingInfoActionRows(resolveBuildingInfoActions(details));
    actions.forEach((item) => {
      const li = document.createElement("li");
      li.className = "building-info-action-row";
      const title = document.createElement("strong");
      title.className = "building-info-action-row__title";
      title.textContent = item.title || "Speciální akce";
      li.appendChild(title);
      if (item.description) {
        const description = document.createElement("span");
        description.className = "building-info-action-row__desc";
        description.textContent = item.description;
        li.appendChild(description);
      }
      const cooldownMs = resolveInfoActionCooldownMs(mechanicsType, item.title, details?.mechanics);
      if (cooldownMs != null) {
        const cooldown = document.createElement("span");
        cooldown.className = "building-info-action-row__cooldown";
        cooldown.textContent = `Cooldown: ${formatInfoCooldownCountdown(cooldownMs)}`;
        li.appendChild(cooldown);
      }
      list.appendChild(li);
    });
  }

  function openBuildingDetailModal(buildingName, district) {
    const root = document.getElementById("building-detail-modal");
    if (!root) return;
    const isMobileViewport = typeof window.matchMedia === "function"
      && window.matchMedia("(max-width: 720px)").matches;
    if (isMobileViewport) {
      document.getElementById("buildings-modal")?.classList.add("hidden");
      document.getElementById("district-modal")?.classList.add("hidden");
      document.getElementById("modal-buildings")?.classList.add("hidden");
    }

    const context = resolveBuildingDetailContext(buildingName);
    let details;
    try {
      details = resolveBuildingDetails(context, district);
    } catch (error) {
      console.error("Building detail open failed", {
        buildingName,
        context,
        district,
        error
      });
      details = {
        baseName: context.baseName,
        displayName: context.variantName || context.baseName,
        hourlyIncome: 0,
        dailyIncome: 0,
        info: "Detail budovy se nepodařilo načíst. Zkus to znovu.",
        mechanics: null,
        specialActions: []
      };
    }
    details = applyConfiguredBuildingCashFallback(details, context);
    const mechanics = details?.mechanics || null;
    const mechanicsType = String(details?.mechanics?.type || "").trim();
    if (mechanicsType) {
      root.dataset.buildingMechanicsType = mechanicsType;
    } else {
      delete root.dataset.buildingMechanicsType;
    }
    const title = document.getElementById("building-detail-title");
    const name = document.getElementById("building-detail-name");
    const hourly = document.getElementById("building-detail-hourly");
    const daily = document.getElementById("building-detail-daily");
    const cleanHourly = document.getElementById("building-detail-clean-hourly");
    const cleanDaily = document.getElementById("building-detail-clean-daily");
    const dirtyHourly = document.getElementById("building-detail-dirty-hourly");
    const dirtyDaily = document.getElementById("building-detail-dirty-daily");
    const info = document.getElementById("building-detail-info-text");
    const infoHeading = document.getElementById("building-info-heading");
    const infoSubtitle = document.getElementById("building-info-subtitle");
    const infoHourly = document.getElementById("building-info-hourly");
    const infoDaily = document.getElementById("building-info-daily");
    const infoCleanHourly = document.getElementById("building-info-clean-hourly");
    const infoCleanDaily = document.getElementById("building-info-clean-daily");
    const infoDirtyHourly = document.getElementById("building-info-dirty-hourly");
    const infoDirtyDaily = document.getElementById("building-info-dirty-daily");
    const infoEffects = document.getElementById("building-info-effects");
    const closeButton = document.getElementById("building-detail-modal-close");
    const panelStats = document.getElementById("building-detail-panel-stats");
    const panelInfo = document.getElementById("building-detail-panel-info");
    const tabButtons = Array.from(root.querySelectorAll("[data-building-tab]"));
    const hourlyRow = hourly?.closest(".modal__row") || null;
    const dailyRow = daily?.closest(".modal__row") || null;
    const cleanHourlyRow = cleanHourly?.closest(".modal__row") || null;
    const cleanDailyRow = cleanDaily?.closest(".modal__row") || null;
    const dirtyHourlyRow = dirtyHourly?.closest(".modal__row") || null;
    const dirtyDailyRow = dirtyDaily?.closest(".modal__row") || null;
    const infoHourlyRow = infoHourly?.closest(".building-info-card__stat") || null;
    const infoDailyRow = infoDaily?.closest(".building-info-card__stat") || null;
    const infoCleanHourlyRow = infoCleanHourly?.closest(".building-info-card__stat") || null;
    const infoCleanDailyRow = infoCleanDaily?.closest(".building-info-card__stat") || null;
    const infoDirtyHourlyRow = infoDirtyHourly?.closest(".building-info-card__stat") || null;
    const infoDirtyDailyRow = infoDirtyDaily?.closest(".building-info-card__stat") || null;
    const infoCard = panelInfo?.querySelector(".building-info-card") || null;
    const infoHead = infoHeading?.closest(".building-info-card__head") || null;
    const infoStatsSection = panelInfo?.querySelector(".building-info-card__stats") || null;
    const infoEffectsSection = infoEffects?.closest(".building-info-card__section") || null;

    let activeContext = context;
    let activeDistrict = district || null;
    const primaryContext = details?.mechanics?.primaryContext;
    if (primaryContext && typeof primaryContext === "object") {
      activeContext = primaryContext;
    }
    const primaryDistrictId = details?.mechanics?.primaryDistrictId;
    if (primaryDistrictId != null) {
      activeDistrict = resolveDistrictRecord(primaryDistrictId) || activeDistrict;
    } else if (primaryContext?.districtId != null) {
      activeDistrict = resolveDistrictRecord(primaryContext.districtId) || activeDistrict;
    }
    state.activeBuildingDetail = { context: activeContext, district: activeDistrict };
    const buildingDividerColor = String(
      activeDistrict?.ownerColor
      || district?.ownerColor
      || districtFill(activeDistrict || district || {})
      || ""
    ).trim();
    root.style.setProperty("--building-divider-color", buildingDividerColor || "var(--building-header-accent)");

    if (title) {
      title.textContent = details.baseName;
      let slotBadgeText = "";
      if (mechanicsType === "pharmacy" || mechanicsType === "factory") {
        slotBadgeText =
          `Aktivní sloty ${Math.max(0, Math.floor(Number(mechanics.activeSlots || 0)))}/`
          + `${Math.max(1, Math.floor(Number((mechanics.slots || []).length || 0)))}`;
      } else if (mechanicsType === "drug-lab") {
        slotBadgeText =
          `Aktivní sloty ${Math.max(0, Math.floor(Number(mechanics.activeSlots || 0)))}/`
          + `${Math.max(1, Math.floor(Number(mechanics.unlockedSlots || 0)))}`;
      } else if (mechanicsType === "armory") {
        slotBadgeText =
          `Aktivní sloty ${Math.max(0, Math.floor(Number(mechanics.activeAttackSlots || 0))) + Math.max(0, Math.floor(Number(mechanics.activeDefenseSlots || 0)))}/`
          + `${Math.max(1, Math.floor(Number((mechanics.attackSlots || []).length || 0))) + Math.max(1, Math.floor(Number((mechanics.defenseSlots || []).length || 0)))}`;
      }
      if (slotBadgeText) {
        const badge = document.createElement("span");
        badge.className = "building-detail-title__badge";
        const compactSlotBadgeText = slotBadgeText.replace(/^Aktivní sloty/i, "AS");
        badge.innerHTML = `
          <span class="building-detail-title__badge-text building-detail-title__badge-text--full">${slotBadgeText}</span>
          <span class="building-detail-title__badge-text building-detail-title__badge-text--compact">${compactSlotBadgeText}</span>
        `;
        title.appendChild(badge);
      }
      const supportsTopTitleActions =
        mechanicsType === "apartment-block"
        || mechanicsType === "school"
        || mechanicsType === "fitness-club"
        || mechanicsType === "casino"
        || mechanicsType === "arcade"
        || mechanicsType === "auto-salon"
        || mechanicsType === "exchange"
        || mechanicsType === "restaurant"
        || mechanicsType === "convenience-store"
        || mechanicsType === "smuggling-tunnel"
        || mechanicsType === "street-dealers"
        || mechanicsType === "strip-club"
        || mechanicsType === "data-center"
        || mechanicsType === "warehouse"
        || mechanicsType === "research-center"
        || mechanicsType === "recycling-center"
        || mechanicsType === "armory"
        || mechanicsType === "pharmacy"
        || mechanicsType === "drug-lab"
        || mechanicsType === "factory";
      if (supportsTopTitleActions) {
        const supportsTopCollectAction =
          mechanicsType === "apartment-block"
          || mechanicsType === "school"
          || mechanicsType === "armory"
          || mechanicsType === "pharmacy"
          || mechanicsType === "drug-lab"
          || mechanicsType === "factory";
        const collectStoredAmount =
          mechanicsType === "apartment-block" || mechanicsType === "school"
            ? Math.max(0, Number(mechanics.storedMembers || 0))
            : Math.max(0, Number(mechanics.storedTotal || 0));
        const canCollect = supportsTopCollectAction && collectStoredAmount > 0;
        const canUpgrade = Boolean(mechanics.nextLevel && Number(mechanics.nextUpgradeCost || 0) > 0);
        const collectVerb =
          mechanicsType === "apartment-block" || mechanicsType === "school" ? "členy"
          : mechanicsType === "armory" ? "zbraně"
          : mechanicsType === "pharmacy" ? "suroviny"
          : mechanicsType === "factory" ? "materiály"
          : "drogy";

        if (supportsTopCollectAction) {
          const collectPlusBtn = document.createElement("button");
          collectPlusBtn.type = "button";
          collectPlusBtn.className = "building-detail-title__action-btn building-detail-title__action-btn--collect";
          collectPlusBtn.dataset.buildingTitleAction = "collect";
          collectPlusBtn.textContent = "+";
          collectPlusBtn.disabled = !canCollect;
          collectPlusBtn.title = canCollect
            ? `Vybrat ${collectVerb} do inventáře`
            : `${details.baseName} nemá co vybrat.`;
          title.appendChild(collectPlusBtn);
        }

        const upgradeBtn = document.createElement("button");
        upgradeBtn.type = "button";
        upgradeBtn.className = "building-detail-title__action-btn building-detail-title__action-btn--upgrade";
        upgradeBtn.dataset.buildingTitleAction = "upgrade";
        upgradeBtn.textContent = "↑";
        upgradeBtn.disabled = !canUpgrade;
        const upgradeCostLabel = formatUpgradeCostLabel(mechanicsType, mechanics.nextUpgradeCost);
        upgradeBtn.title = canUpgrade
          ? `Upgrade na L${Math.max(0, Math.floor(Number(mechanics.nextLevel || 0)))} za ${upgradeCostLabel}`
          : "Budova je na maximálním levelu.";
        title.appendChild(upgradeBtn);
      }
    }
    if (closeButton) {
      const headerLevelId = "building-detail-header-level";
      let levelBadge = document.getElementById(headerLevelId);
      if (!levelBadge) {
        levelBadge = document.createElement("span");
        levelBadge.id = headerLevelId;
        levelBadge.className = "building-detail-header-level";
        closeButton.parentElement?.insertBefore(levelBadge, closeButton);
      }
      const showHeaderLevel =
        mechanicsType === "pharmacy"
        || mechanicsType === "drug-lab"
        || mechanicsType === "factory"
        || mechanicsType === "armory";
      if (showHeaderLevel) {
        levelBadge.textContent = `L${Math.max(1, Math.floor(Number(mechanics?.level || 1)))}`;
        levelBadge.classList.remove("hidden");
      } else {
        levelBadge.classList.add("hidden");
      }
    }
    if (name) name.textContent = details.displayName;
    const sameTypeOwnedCount = (() => {
      if (!mechanics || typeof mechanics !== "object") return 0;
      if (mechanicsType === "pharmacy") return Math.max(0, Math.floor(Number(mechanics.ownedPharmacyCount || 0)));
      if (mechanicsType === "factory") return Math.max(0, Math.floor(Number(mechanics.ownedFactoryCount || 0)));
      if (mechanicsType === "armory") return Math.max(0, Math.floor(Number(mechanics.ownedArmoryCount || 0)));
      if (mechanicsType === "drug-lab") return Math.max(0, Math.floor(Number(mechanics.ownedLabCount || 0)));
      return 0;
    })();
    root.classList.toggle("building-detail-many-owned", sameTypeOwnedCount > 3);
    const hourlyLabel = formatBuildingIncomeLabel(details);
    const dailyLabel = `$${formatDecimalValue(details.dailyIncome, 2)} / den`;
    const cashBreakdown = resolveBuildingCashBreakdown(details);
    const cleanHourlyValue = cashBreakdown.hourlyCleanIncome || 0;
    const dirtyHourlyValue = cashBreakdown.hourlyDirtyIncome || 0;
    const totalHourlyValue = Math.max(0, Number(details?.hourlyIncome || 0));
    const hideIncomeRowsForMechanics = mechanicsType === "street-dealers";
    const hasCashBreakdown = (cleanHourlyValue > 0 || dirtyHourlyValue > 0) && !hideIncomeRowsForMechanics;
    const showBaseIncomeRows = totalHourlyValue > 0 && !hideIncomeRowsForMechanics;
    if (hourlyRow) hourlyRow.classList.toggle("hidden", !showBaseIncomeRows);
    if (dailyRow) dailyRow.classList.toggle("hidden", !showBaseIncomeRows);
    if (infoHourlyRow) infoHourlyRow.classList.toggle("hidden", !showBaseIncomeRows);
    if (infoDailyRow) infoDailyRow.classList.toggle("hidden", !showBaseIncomeRows);
    if (cleanHourlyRow) cleanHourlyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (cleanDailyRow) cleanDailyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (dirtyHourlyRow) dirtyHourlyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (dirtyDailyRow) dirtyDailyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (infoCleanHourlyRow) infoCleanHourlyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (infoCleanDailyRow) infoCleanDailyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (infoDirtyHourlyRow) infoDirtyHourlyRow.classList.toggle("hidden", !hasCashBreakdown);
    if (infoDirtyDailyRow) infoDirtyDailyRow.classList.toggle("hidden", !hasCashBreakdown);
    const cleanHourlyLabel = `$${formatDecimalValue(cleanHourlyValue, 2)} / hod`;
    const cleanDailyLabel = formatBuildingDailyLabel(cleanHourlyValue);
    const dirtyHourlyLabel = `$${formatDecimalValue(dirtyHourlyValue, 2)} / hod`;
    const dirtyDailyLabel = formatBuildingDailyLabel(dirtyHourlyValue);
    if (hourly) hourly.textContent = hourlyLabel;
    if (daily) daily.textContent = dailyLabel;
    if (cleanHourly) cleanHourly.textContent = cleanHourlyLabel;
    if (cleanDaily) cleanDaily.textContent = cleanDailyLabel;
    if (dirtyHourly) dirtyHourly.textContent = dirtyHourlyLabel;
    if (dirtyDaily) dirtyDaily.textContent = dirtyDailyLabel;
    if (info) info.textContent = details.info;
    if (infoHourly) infoHourly.textContent = hourlyLabel;
    if (infoDaily) infoDaily.textContent = dailyLabel;
    if (infoCleanHourly) infoCleanHourly.textContent = cleanHourlyLabel;
    if (infoCleanDaily) infoCleanDaily.textContent = cleanDailyLabel;
    if (infoDirtyHourly) infoDirtyHourly.textContent = dirtyHourlyLabel;
    if (infoDirtyDaily) infoDirtyDaily.textContent = dirtyDailyLabel;
    if (infoEffects) infoEffects.textContent = details?.mechanics?.effectsLabel || "Žádné aktivní mechaniky.";
    renderBuildingInfoActions(details);
    const compactTechInfo =
      mechanicsType === "armory"
      || mechanicsType === "drug-lab"
      || mechanicsType === "pharmacy"
      || mechanicsType === "factory";
    if (infoCard) {
      infoCard.classList.toggle("building-info-card--compact-tech", compactTechInfo);
      infoCard.classList.toggle("building-info-card--compact-armory", mechanicsType === "armory");
      infoCard.classList.toggle("building-info-card--compact-drug-lab", mechanicsType === "drug-lab");
      infoCard.classList.toggle("building-info-card--compact-factory", mechanicsType === "factory");
    }
    if (infoHead) infoHead.classList.toggle("hidden", compactTechInfo);
    if (infoStatsSection) infoStatsSection.classList.add("hidden");
    if (infoEffectsSection) infoEffectsSection.classList.add("hidden");
    if (infoHeading) infoHeading.textContent = `Taktický profil: ${details.displayName}`;
    if (infoSubtitle) {
      let subtitle = "Přehled role budovy v districtu a ekonomice gangu.";
      if (mechanicsType === "apartment-block") {
        subtitle = "Personální budova zaměřená na růst členů, kapacitu a stabilní cashflow.";
      } else if (mechanicsType === "school") {
        subtitle = "Náborová a podpůrná budova, která zesiluje districtové mechaniky.";
      } else if (mechanicsType === "fitness-club") {
        subtitle = "Combat podpora: trénink, nábor a rizikový doping pro tlak v útoku i obraně.";
      } else if (mechanicsType === "casino") {
        subtitle = "Velké prachy i risk: cashflow, High Stakes, praní peněz a VIP večer.";
      } else if (mechanicsType === "arcade") {
        subtitle = "Hybrid clean/dirty budova s automatovými akcemi a napojením na drogový byznys.";
      } else if (mechanicsType === "auto-salon") {
        subtitle = "Logisticko-ekonomická budova s čistým i dirty income a bonusy pro mobilitu.";
      } else if (mechanicsType === "exchange") {
        subtitle = "Finanční uzel pro směnu cash a materiálů, skryté převody a okamžitou likviditu.";
      } else if (mechanicsType === "restaurant") {
        subtitle = "Sociální safe budova: stabilní cashflow, cílené district buffy a zpravodajské drby.";
      } else if (mechanicsType === "convenience-store") {
        subtitle = "Nonstop obchod: stabilní clean/dirty cashflow, lokální vliv a krytí operací pro další budovy.";
      } else if (mechanicsType === "data-center") {
        subtitle = "Informační uzel pro sledování hráčů, hack příjmů a globální správu cooldownů akcí.";
      } else if (mechanicsType === "warehouse") {
        subtitle = "Logistické centrum pro zásoby, distribuci efektů akcí a ochranu zdrojů při raziích.";
      } else if (mechanicsType === "research-center") {
        subtitle = "Technologická budova pro zrychlení a navýšení produkce klíčových výrobních budov.";
      } else if (mechanicsType === "recycling-center") {
        subtitle = "Recyklační uzel pro návrat zásob, chemie a částečnou obnovu ztrát po raziích.";
      } else if (mechanicsType === "armory") {
        subtitle = "Výrobní zbrojní uzel pro útok i obranu districtů: recepty, časování a zásobování z Továrny.";
      } else if (mechanicsType === "factory") {
        subtitle = "Produkční jádro pro výrobu zbraňových materiálů a Combat Module.";
      } else if (mechanicsType === "pharmacy") {
        subtitle = "Support budova pro výrobu surovin a taktických boostů akcí napříč gangem.";
      } else if (mechanicsType === "drug-lab") {
        subtitle = "Produkční laboratoř pro drogy: sloty, heat risk management, buffy a skladová logistika.";
      }
      infoSubtitle.textContent = subtitle;
    }
    const preserveInfoTab = !root.classList.contains("hidden") && state.activeBuildingDetailTab === "info";
    const activeTab = preserveInfoTab ? "info" : "stats";
    if (!preserveInfoTab) {
      state.activeBuildingDetailTab = "stats";
    }
    if (panelStats) panelStats.classList.toggle("hidden", activeTab === "info");
    if (panelInfo) panelInfo.classList.toggle("hidden", activeTab !== "info");
    root.classList.toggle("is-info-tab", activeTab === "info");
    tabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.buildingTab === activeTab);
    });
    updateBuildingMechanicsPanel(details);
    setBuildingDetailActionButtons(details);

    root.classList.remove("hidden");
    updateArmoryMaterialsStickyCompactState();
  }

  function showBuildingDetail(buildingName, district) {
    openBuildingDetailModal(buildingName, district || null);
  }

  function resolveBuildingCashBreakdown(details) {
    const directCleanRaw = details?.hourlyCleanIncome;
    const directDirtyRaw = details?.hourlyDirtyIncome;
    const mechanicsCleanRaw = details?.mechanics?.hourlyCleanIncome;
    const mechanicsDirtyRaw = details?.mechanics?.hourlyDirtyIncome;
    const directClean = directCleanRaw == null ? null : Number(directCleanRaw);
    const directDirty = directDirtyRaw == null ? null : Number(directDirtyRaw);
    const mechanicsClean = mechanicsCleanRaw == null ? null : Number(mechanicsCleanRaw);
    const mechanicsDirty = mechanicsDirtyRaw == null ? null : Number(mechanicsDirtyRaw);
    const hourlyCleanIncome = Number.isFinite(directClean)
      ? Math.max(0, directClean)
      : Number.isFinite(mechanicsClean)
        ? Math.max(0, mechanicsClean)
        : null;
    const hourlyDirtyIncome = Number.isFinite(directDirty)
      ? Math.max(0, directDirty)
      : Number.isFinite(mechanicsDirty)
        ? Math.max(0, mechanicsDirty)
        : null;
    return { hourlyCleanIncome, hourlyDirtyIncome };
  }

  function resolveConfiguredBuildingCashProfile(buildingInput) {
    const context = resolveBuildingDetailContext(buildingInput);
    return CONFIGURED_BUILDING_CASH_RATES[context.baseName] || null;
  }

  function applyConfiguredBuildingCashFallback(details, buildingInput) {
    const configuredRates = resolveConfiguredBuildingCashProfile(buildingInput);
    if (!configuredRates) return details;
    const currentHourlyIncome = Number(details?.hourlyIncome);
    const currentDailyIncome = Number(details?.dailyIncome);
    const currentBreakdown = resolveBuildingCashBreakdown(details);
    const configuredHourlyIncome =
      Math.max(0, Number(configuredRates.hourlyCleanIncome || 0))
      + Math.max(0, Number(configuredRates.hourlyDirtyIncome || 0));
    const shouldPatchHourly = !Number.isFinite(currentHourlyIncome) || currentHourlyIncome <= 0;
    const shouldPatchDaily = !Number.isFinite(currentDailyIncome) || currentDailyIncome <= 0;
    const shouldPatchClean =
      !Number.isFinite(Number(currentBreakdown.hourlyCleanIncome))
      || Number(currentBreakdown.hourlyCleanIncome) <= 0;
    const shouldPatchDirty =
      !Number.isFinite(Number(currentBreakdown.hourlyDirtyIncome))
      || Number(currentBreakdown.hourlyDirtyIncome) <= 0;
    if (!shouldPatchHourly && !shouldPatchDaily && !shouldPatchClean && !shouldPatchDirty) {
      return details;
    }
    return {
      ...details,
      hourlyIncome: shouldPatchHourly ? configuredHourlyIncome : currentHourlyIncome,
      dailyIncome: shouldPatchDaily ? configuredHourlyIncome * 24 : currentDailyIncome,
      hourlyCleanIncome: shouldPatchClean
        ? Math.max(0, Number(configuredRates.hourlyCleanIncome || 0))
        : Number(currentBreakdown.hourlyCleanIncome || 0),
      hourlyDirtyIncome: shouldPatchDirty
        ? Math.max(0, Number(configuredRates.hourlyDirtyIncome || 0))
        : Number(currentBreakdown.hourlyDirtyIncome || 0)
    };
  }

  function resolveBuildingHourlyValue(value) {
    const safe = Number(value);
    return Number.isFinite(safe) ? Math.max(0, safe) : 0;
  }

  function formatBuildingDailyLabel(hourlyValue) {
    return `$${formatDecimalValue(resolveBuildingHourlyValue(hourlyValue) * 24, 2)} / den`;
  }

  function formatBuildingIncomeLabel(details) {
    const hourlyLabel = `$${formatDecimalValue(details?.hourlyIncome || 0, 2)} / hod`;
    const { hourlyCleanIncome, hourlyDirtyIncome } = resolveBuildingCashBreakdown(details);
    const cleanValue = Number(hourlyCleanIncome || 0);
    const dirtyValue = Number(hourlyDirtyIncome || 0);
    if ((hourlyCleanIncome == null && hourlyDirtyIncome == null) || (cleanValue <= 0 && dirtyValue <= 0)) {
      return hourlyLabel;
    }
    return `${hourlyLabel} • C ${formatDecimalValue(cleanValue / 60, 2)}/min • D ${formatDecimalValue(dirtyValue / 60, 2)}/min`;
  }

  function resolveParkSpecialBuildingType(baseName) {
    if (isSmugglingTunnelBaseName(baseName)) return "smuggling-tunnel";
    if (isStreetDealersBaseName(baseName)) return "street-dealers";
    if (isStripClubBaseName(baseName)) return "strip-club";
    if (isDataCenterBaseName(baseName)) return "data-center";
    if (isWarehouseBaseName(baseName)) return "warehouse";
    if (isResearchCenterBaseName(baseName)) return "research-center";
    if (isRecyclingCenterBaseName(baseName)) return "recycling-center";
    return "";
  }

  function grantInstantDrugReward(amount = 0) {
    const gained = Math.max(0, Math.floor(Number(amount) || 0));
    if (!gained) return 0;
    const getEconomySnapshot = window.Empire.UI?.getEconomySnapshot;
    const updateEconomy = window.Empire.UI?.updateEconomy;
    if (typeof getEconomySnapshot !== "function" || typeof updateEconomy !== "function") {
      return 0;
    }
    const snapshot = getEconomySnapshot() || {};
    const nextEconomy = {
      ...snapshot,
      drugInventory: {
        ...(snapshot.drugInventory && typeof snapshot.drugInventory === "object" ? snapshot.drugInventory : {})
      }
    };
    nextEconomy.drugInventory.neonDust = Math.max(
      0,
      Math.floor(Number(nextEconomy.drugInventory.neonDust || 0) + gained)
    );
    nextEconomy.drugs = Math.max(0, Math.floor(Number(snapshot.drugs || 0) + gained));
    updateEconomy(nextEconomy);
    return gained;
  }

  function getSmugglingTunnelLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, SMUGGLING_TUNNEL_CONFIG.maxLevel);
    const incomeBoostPct =
      (level >= 2 ? SMUGGLING_TUNNEL_CONFIG.incomeBoostPctLevel2 : 0)
      + (level >= 5 ? SMUGGLING_TUNNEL_CONFIG.incomeBoostPctLevel5 : 0);
    const dirtyIncomeBoostPct = level >= 4 ? SMUGGLING_TUNNEL_CONFIG.dirtyIncomeBoostPctLevel4 : 0;
    let heatMultiplier = 1;
    if (level >= 2) heatMultiplier *= SMUGGLING_TUNNEL_CONFIG.heatMultiplierLevel2;
    if (level >= 4) heatMultiplier *= SMUGGLING_TUNNEL_CONFIG.heatMultiplierLevel4;
    const bigShipmentBonusDrugs = level >= 3 ? SMUGGLING_TUNNEL_CONFIG.bigShipmentExtraDropsAtLevel3 : 0;
    const ignoreHeatChancePct = level >= 5 ? SMUGGLING_TUNNEL_CONFIG.level5HeatIgnoreChancePct : 0;
    return {
      level,
      incomeBoostPct,
      dirtyIncomeBoostPct,
      heatMultiplier,
      bigShipmentBonusDrugs,
      ignoreHeatChancePct
    };
  }

  function getStreetDealersLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, STREET_DEALERS_CONFIG.maxLevel);
    const incomeBoostPct =
      (level >= 2 ? STREET_DEALERS_CONFIG.incomeBoostPctLevel2 : 0)
      + (level >= 4 ? STREET_DEALERS_CONFIG.incomeBoostPctLevel4 : 0)
      + (level >= 5 ? STREET_DEALERS_CONFIG.incomeBoostPctLevel5 : 0);
    const dirtyIncomeBoostPct = level >= 3 ? STREET_DEALERS_CONFIG.dirtyIncomeBoostPctLevel3 : 0;
    const heatMultiplier = level >= 4 ? STREET_DEALERS_CONFIG.heatMultiplierLevel4 : 1;
    const spyReward = level >= 5 ? STREET_DEALERS_CONFIG.spyRewardAtLevel5 : 0;
    return {
      level,
      incomeBoostPct,
      dirtyIncomeBoostPct,
      heatMultiplier,
      spyReward
    };
  }

  function getOwnedStreetDealersCount() {
    const entries = collectOwnedSimpleCashEntriesByMatcher(isStreetDealersBaseName);
    return Math.max(1, entries.length || 1);
  }

  function getStreetDealerNetworkEffects(ownedStreetDealersCountRaw) {
    const ownedStreetDealersCount = Math.max(1, Math.floor(Number(ownedStreetDealersCountRaw) || 1));
    const extraBuildings = Math.max(0, ownedStreetDealersCount - 1);
    const maxCapacityBonusPct =
      extraBuildings * Math.max(0, Number(STREET_DEALERS_CONFIG.sales.networkMaxCapacityPctPerExtraBuilding || 0));
    const speedBonusPct =
      extraBuildings * Math.max(0, Number(STREET_DEALERS_CONFIG.sales.networkSpeedPctPerExtraBuilding || 0));
    return {
      ownedStreetDealersCount,
      extraBuildings,
      maxCapacityBonusPct,
      speedBonusPct,
      maxCapacityMultiplier: Math.max(1, 1 + maxCapacityBonusPct / 100),
      speedMultiplier: Math.max(1, 1 + speedBonusPct / 100)
    };
  }

  function getStreetDealerSlotConfigByResourceKey(resourceKey) {
    const safeKey = String(resourceKey || "").trim();
    return STREET_DEALERS_CONFIG.sales.slots.find((slot) => String(slot.resourceKey || "").trim() === safeKey) || null;
  }

  function createStreetDealerDrugInventory(rawInventory = {}) {
    const source = rawInventory && typeof rawInventory === "object" ? rawInventory : {};
    return {
      neonDust: Math.max(0, Math.floor(Number(source.neonDust || 0))),
      pulseShot: Math.max(0, Math.floor(Number(source.pulseShot || 0))),
      velvetSmoke: Math.max(0, Math.floor(Number(source.velvetSmoke || 0)))
    };
  }

  function getStreetDealerSlotCapacity(slotConfig, networkEffects) {
    const baseSlotCap = Math.max(0, Math.floor(Number(slotConfig?.baseSlotCap || 0)));
    const multiplier = Math.max(1, Number(networkEffects?.maxCapacityMultiplier || 1));
    return Math.max(0, Math.floor(baseSlotCap * multiplier));
  }

  function syncStreetDealerSales(instanceState, now = Date.now(), options = {}) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const ownedStreetDealersCountRaw = Number(options?.ownedStreetDealersCount);
    const networkEffects = getStreetDealerNetworkEffects(
      Number.isFinite(ownedStreetDealersCountRaw) ? ownedStreetDealersCountRaw : getOwnedStreetDealersCount()
    );
    const slots = Array.isArray(stateRef.streetDealerSlots) && stateRef.streetDealerSlots.length
      ? stateRef.streetDealerSlots
      : createStreetDealerDefaultSlots(nowMs);
    const fallbackSlots = createStreetDealerDefaultSlots(nowMs);
    stateRef.streetDealerSlots = fallbackSlots.map((fallbackSlot, index) =>
      sanitizeStreetDealerSlot(slots[index], fallbackSlot, nowMs)
    );

    let dirtyIncomeGained = 0;
    const slotSummaries = stateRef.streetDealerSlots.map((slot) => {
      const slotConfig = getStreetDealerSlotConfigByResourceKey(slot.resourceKey) || {};
      const slotCap = getStreetDealerSlotCapacity(slotConfig, networkEffects);
      if (slotCap >= 0) {
        slot.storedUnits = Math.min(Math.max(0, Math.floor(Number(slot.storedUnits || 0))), slotCap);
      }
      let from = Number(slot.lastTick || nowMs);
      if (!Number.isFinite(from) || from > nowMs) from = nowMs;
      const elapsedMs = Math.max(0, nowMs - from);
      const unitsPerHour = Math.max(0, Number(slotConfig.unitsPerHour || 0)) * networkEffects.speedMultiplier;
      const dirtyCashPerUnit = Math.max(0, Number(slotConfig.dirtyCashPerUnit || 0));
      let soldUnits = 0;
      if (elapsedMs > 0 && unitsPerHour > 0 && dirtyCashPerUnit > 0) {
        const rawToSell = (elapsedMs / 3600000) * unitsPerHour + Math.max(0, Number(slot.salesUnitRemainder || 0));
        const desiredToSell = Math.max(0, Math.floor(rawToSell));
        slot.salesUnitRemainder = Math.max(0, rawToSell - desiredToSell);
        const available = Math.max(0, Math.floor(Number(slot.storedUnits || 0)));
        soldUnits = Math.max(0, Math.min(available, desiredToSell));
        if (soldUnits > 0) {
          slot.storedUnits = Math.max(0, available - soldUnits);
          slot.soldUnitsTotal = Math.max(0, Math.floor(Number(slot.soldUnitsTotal || 0) + soldUnits));
          const rawDirty = soldUnits * dirtyCashPerUnit + Math.max(0, Number(slot.cashRemainder || 0));
          const dirty = Math.max(0, Math.floor(rawDirty));
          slot.cashRemainder = Math.max(0, rawDirty - dirty);
          dirtyIncomeGained += dirty;
        } else {
          slot.cashRemainder = Math.max(0, Number(slot.cashRemainder || 0));
        }
        if (Math.max(0, Math.floor(Number(slot.storedUnits || 0))) <= 0) {
          slot.salesUnitRemainder = 0;
        }
      }
      slot.lastTick = nowMs;
      const storedUnits = Math.max(0, Math.floor(Number(slot.storedUnits || 0)));
      return {
        id: slot.id,
        resourceKey: slot.resourceKey,
        resourceLabel: String(slotConfig.label || slot.resourceKey || "").trim() || "Slot",
        queuedUnits: Math.max(1, Math.floor(Number(slot.queuedUnits || 1))),
        storedUnits,
        soldUnitsTotal: Math.max(0, Math.floor(Number(slot.soldUnitsTotal || 0))),
        slotCap,
        unitsPerHour,
        dirtyCashPerUnit,
        dirtyPerHour: unitsPerHour * dirtyCashPerUnit,
        soldUnitsTick: soldUnits
      };
    });

    if (dirtyIncomeGained > 0) {
      payoutDirectBuildingIncome(0, dirtyIncomeGained);
    }

    return {
      dirtyIncomeGained,
      networkEffects,
      slots: slotSummaries
    };
  }

  function applyStreetDealerPassiveHeatTick(instanceState, now = Date.now()) {
    const stateRef = instanceState;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const intervalMs = Math.max(1, Math.floor(Number(STREET_DEALERS_CONFIG.passiveHeatIntervalMs || (5 * 60 * 1000))));
    const heatPerTick = Math.max(0, Number(STREET_DEALERS_CONFIG.passiveHeatPerTick || 0));
    let from = Number(stateRef.streetDealerLastHeatTickAt || nowMs);
    if (!Number.isFinite(from) || from > nowMs) from = nowMs;
    const elapsedMs = Math.max(0, nowMs - from);
    const ticks = Math.max(0, Math.floor(elapsedMs / intervalMs));
    if (ticks <= 0 || heatPerTick <= 0) {
      stateRef.streetDealerLastHeatTickAt = from;
      return {
        ticks: 0,
        heatAdded: 0,
        nextHeat: readCurrentPlayerHeatValue()
      };
    }
    const heatAdded = ticks * heatPerTick;
    const nextHeat = addPlayerHeatFromBuilding(heatAdded, "Pouliční dealeři: pasivní provoz");
    stateRef.streetDealerLastHeatTickAt = from + ticks * intervalMs;
    return {
      ticks,
      heatAdded,
      nextHeat
    };
  }

  function getStripClubLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, STRIP_CLUB_CONFIG.maxLevel);
    const incomeBoostPct = level >= 2 ? STRIP_CLUB_CONFIG.incomeBoostPctLevel2 : 0;
    const cleanIncomeBoostPct = level >= 4 ? STRIP_CLUB_CONFIG.cleanIncomeBoostPctLevel4 : 0;
    const vipExtraBoostPct = level >= 3 ? STRIP_CLUB_CONFIG.vipBonusPctLevel3 : 0;
    const vipDoubleChancePct = level >= 5 ? STRIP_CLUB_CONFIG.vipDoubleChancePctLevel5 : 0;
    return {
      level,
      incomeBoostPct,
      cleanIncomeBoostPct,
      vipExtraBoostPct,
      vipDoubleChancePct
    };
  }

  function getConvenienceStoreLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, CONVENIENCE_STORE_BUILDING_CONFIG.maxLevel);
    const incomeBoostPct =
      (level >= 2 ? CONVENIENCE_STORE_BUILDING_CONFIG.incomeBoostPctLevel2 : 0)
      + (level >= 4 ? CONVENIENCE_STORE_BUILDING_CONFIG.incomeBoostPctLevel4 : 0);
    const cleanIncomeBoostPct = level >= 3 ? CONVENIENCE_STORE_BUILDING_CONFIG.cleanIncomeBoostPctLevel3 : 0;
    const heatMultiplier = level >= 5 ? CONVENIENCE_STORE_BUILDING_CONFIG.heatMultiplierLevel5 : 1;
    return {
      level,
      incomeBoostPct,
      cleanIncomeBoostPct,
      heatMultiplier
    };
  }

  function collectOwnedConvenienceStoreEntries() {
    return collectOwnedSimpleCashEntriesByMatcher(isConvenienceStoreBaseName);
  }

  function getOwnedConvenienceCoverOpsHeatMultiplier(now = Date.now(), targetBaseName = "") {
    const safeTargetName = String(targetBaseName || "").trim();
    if (!safeTargetName || isConvenienceStoreBaseName(safeTargetName)) return 1;
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const entries = collectOwnedConvenienceStoreEntries();
    const hasActiveCoverOps = entries.some((entry) => {
      const snapshot = getConvenienceStoreStateByKey(entry.instanceKey, nowMs);
      return nowMs < Math.max(0, Number(snapshot?.effects?.coverOpsUntil || 0));
    });
    if (!hasActiveCoverOps) return 1;
    const reductionPct = Math.max(0, Number(CONVENIENCE_STORE_BUILDING_CONFIG.actionBoosts.coverOpsHeatReductionPct || 0));
    return Math.max(0, 1 - reductionPct / 100);
  }

  function getOwnedStripClubTargetBoostPct(now = Date.now(), targetBaseName = "") {
    const safeTargetName = String(targetBaseName || "").trim();
    if (!isStreetDealersBaseName(safeTargetName) && !isSmugglingTunnelBaseName(safeTargetName)) {
      return 0;
    }
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const entries = collectOwnedSimpleCashEntriesByMatcher(isStripClubBaseName);
    const hasActiveBoost = entries.some((entry) => {
      const snapshot = getSimpleCashBuildingStateByKey(entry.instanceKey, nowMs);
      return nowMs < Math.max(0, Number(snapshot?.effects?.dirtyDealsUntil || 0));
    });
    if (!hasActiveBoost) return 0;
    const basePct = Math.max(0, Number(STRIP_CLUB_CONFIG.actions.dirtyDeals.targetIncomeBoostPct || 0));
    const actionBoostMultiplier = Math.max(1, 1 + getOwnedWarehouseActionEffectBoostPct(nowMs) / 100);
    return basePct * actionBoostMultiplier;
  }

  function getDataCenterLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, DATA_CENTER_CONFIG.maxLevel);
    const incomeBoostPct = level >= 2 ? DATA_CENTER_CONFIG.incomeBoostPctLevel2 : 0;
    const cleanIncomeBoostPct = level >= 4 ? DATA_CENTER_CONFIG.cleanIncomeBoostPctLevel4 : 0;
    const intelInfoBonus = level >= 3 ? DATA_CENTER_CONFIG.intelInfoBonusAtLevel3 : 0;
    const hackEffectMultiplier = level >= 5 ? 1 + DATA_CENTER_CONFIG.hackEffectBoostPctLevel5 / 100 : 1;
    return {
      level,
      incomeBoostPct,
      cleanIncomeBoostPct,
      intelInfoBonus,
      hackEffectMultiplier
    };
  }

  function getWarehouseLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, WAREHOUSE_CONFIG.maxLevel);
    const incomeBoostPct =
      (level >= 2 ? WAREHOUSE_CONFIG.incomeBoostPctLevel2 : 0)
      + (level >= 3 ? WAREHOUSE_CONFIG.incomeBoostPctLevel3 : 0)
      + (level >= 4 ? WAREHOUSE_CONFIG.incomeBoostPctLevel4 : 0);
    const extraMaterials = level >= 5 ? WAREHOUSE_CONFIG.extraMaterialsLevel5 : 0;
    return {
      level,
      incomeBoostPct,
      extraMaterials
    };
  }

  function getResearchCenterLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, RESEARCH_CENTER_CONFIG.maxLevel);
    const incomeBoostPct = level >= 2 ? RESEARCH_CENTER_CONFIG.incomeBoostPctLevel2 : 0;
    const actionsEffectMultiplier = level >= 3 ? 1 + RESEARCH_CENTER_CONFIG.actionsEffectBoostPctLevel3 / 100 : 1;
    const productionBoostPct = level >= 4 ? RESEARCH_CENTER_CONFIG.productionBoostPctLevel4 : 0;
    const permanentTimeReductionPct = level >= 5 ? RESEARCH_CENTER_CONFIG.permanentProductionTimeReductionPctLevel5 : 0;
    return {
      level,
      incomeBoostPct,
      actionsEffectMultiplier,
      productionBoostPct,
      permanentTimeReductionPct
    };
  }

  function getOwnedResearchCenterProductionBoostSnapshot(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const entries = collectOwnedSimpleCashEntriesByMatcher(isResearchCenterBaseName);
    let factorySpeedMultiplier = 1;
    let armorySpeedMultiplier = 1;
    let drugLabSpeedMultiplier = 1;

    entries.forEach((entry) => {
      const snapshot = getSimpleCashBuildingStateByKey(entry.instanceKey, nowMs);
      const levelEffects = getResearchCenterLevelEffects(snapshot.level);
      const effects = snapshot.effects || {};
      const actionMultiplier = Math.max(1, Number(levelEffects.actionsEffectMultiplier || 1));

      const level4Pct = Math.max(0, Number(levelEffects.productionBoostPct || 0));
      if (level4Pct > 0) {
        const level4Multiplier = 1 + level4Pct / 100;
        factorySpeedMultiplier *= level4Multiplier;
        armorySpeedMultiplier *= level4Multiplier;
      }

      const level5ReductionPct = Math.max(0, Number(levelEffects.permanentTimeReductionPct || 0));
      if (level5ReductionPct > 0) {
        const level5SpeedMultiplier = 1 / Math.max(0.01, 1 - level5ReductionPct / 100);
        factorySpeedMultiplier *= level5SpeedMultiplier;
        armorySpeedMultiplier *= level5SpeedMultiplier;
      }

      if (nowMs < Math.max(0, Number(effects.optimizeProductionUntil || 0))) {
        const optimizePct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.optimizeProduction.factoryArmorySpeedBoostPct || 0))
          * actionMultiplier;
        const optimizeMultiplier = 1 + optimizePct / 100;
        factorySpeedMultiplier *= optimizeMultiplier;
        armorySpeedMultiplier *= optimizeMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.experimentalSeriesUntil || 0))) {
        const experimentPct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.experimentalSeries.factoryArmoryProductionBoostPct || 0))
          * actionMultiplier;
        const experimentMultiplier = 1 + experimentPct / 100;
        factorySpeedMultiplier *= experimentMultiplier;
        armorySpeedMultiplier *= experimentMultiplier;
      }
      if (nowMs < Math.max(0, Number(effects.technologyUpgradeUntil || 0))) {
        const timeReductionPct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.armoryDrugLabTimeReductionPct || 0))
          * actionMultiplier;
        const speedMultiplier = 1 / Math.max(0.01, 1 - timeReductionPct / 100);
        armorySpeedMultiplier *= speedMultiplier;
        drugLabSpeedMultiplier *= speedMultiplier;
      }
    });

    return {
      factorySpeedMultiplier: Math.max(0.01, factorySpeedMultiplier),
      armorySpeedMultiplier: Math.max(0.01, armorySpeedMultiplier),
      drugLabSpeedMultiplier: Math.max(0.01, drugLabSpeedMultiplier)
    };
  }

  function getRecyclingCenterLevelEffects(levelRaw) {
    const level = clamp(Math.floor(Number(levelRaw) || 1), 1, RECYCLING_CENTER_CONFIG.maxLevel);
    const incomeBoostPct = level >= 2 ? RECYCLING_CENTER_CONFIG.incomeBoostPctLevel2 : 0;
    const extraWasteMaterials = level >= 3 ? RECYCLING_CENTER_CONFIG.extraWasteMaterialsLevel3 : 0;
    const cleanIncomeBoostPct = level >= 4 ? RECYCLING_CENTER_CONFIG.cleanIncomeBoostPctLevel4 : 0;
    const heatMultiplier = level >= 4 ? RECYCLING_CENTER_CONFIG.heatMultiplierLevel4 : 1;
    const emergencyRestorePct = level >= 5 ? RECYCLING_CENTER_CONFIG.restorePctLevel5 : RECYCLING_CENTER_CONFIG.restorePctBase;
    return {
      level,
      incomeBoostPct,
      extraWasteMaterials,
      cleanIncomeBoostPct,
      heatMultiplier,
      emergencyRestorePct
    };
  }

  function distributeIntegerByWeights(totalRaw, keys = [], weights = {}) {
    const total = Math.max(0, Math.floor(Number(totalRaw) || 0));
    const safeKeys = (Array.isArray(keys) ? keys : []).filter(Boolean);
    if (!total || !safeKeys.length) return {};
    const byKey = {};
    const weighted = safeKeys.map((key) => {
      const weight = Math.max(0, Number(weights?.[key] || 1));
      return { key, weight: weight > 0 ? weight : 1 };
    });
    const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0) || safeKeys.length;
    let assigned = 0;
    weighted.forEach((item) => {
      const raw = (total * item.weight) / weightSum;
      const value = Math.max(0, Math.floor(raw));
      byKey[item.key] = value;
      assigned += value;
    });
    let rest = Math.max(0, total - assigned);
    let cursor = 0;
    while (rest > 0) {
      const key = weighted[cursor % weighted.length].key;
      byKey[key] = Math.max(0, Math.floor(Number(byKey[key] || 0) + 1));
      rest -= 1;
      cursor += 1;
    }
    return byKey;
  }

  function grantRecyclingRandomMaterials(amount = 0) {
    const rolls = Math.max(0, Math.floor(Number(amount) || 0));
    if (!rolls) return { total: 0, summary: "bez materiálů" };
    const factoryPool = ["metalParts", "techCore", "combatModule"];
    const pharmacyPool = ["chemicals", "biomass", "stimPack"];
    const drugPool = DRUG_LAB_DRUG_KEYS.slice();
    const armoryPool = ARMORY_WEAPON_KEYS.slice();
    const summaryCounts = {};

    const factorySupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    const playerState = getDrugLabPlayerSnapshot();
    playerState.labSupplies = createDrugLabSupplyMap(playerState.labSupplies || {});
    const economy = window.Empire.UI?.getEconomySnapshot?.() || {};
    const nextEconomy = {
      ...economy,
      drugInventory: {
        ...(economy.drugInventory && typeof economy.drugInventory === "object" ? economy.drugInventory : {})
      }
    };
    const attackReward = {};
    const defenseReward = {};

    for (let index = 0; index < rolls; index += 1) {
      const sourcePick = Math.floor(Math.random() * 4);
      if (sourcePick === 0) {
        const key = factoryPool[Math.floor(Math.random() * factoryPool.length)];
        factorySupplies[key] = Math.max(0, Math.floor(Number(factorySupplies[key] || 0) + 1));
        summaryCounts[key] = Math.max(0, Math.floor(Number(summaryCounts[key] || 0) + 1));
      } else if (sourcePick === 1) {
        const key = pharmacyPool[Math.floor(Math.random() * pharmacyPool.length)];
        playerState.labSupplies[key] = Math.max(0, Math.floor(Number(playerState.labSupplies[key] || 0) + 1));
        summaryCounts[key] = Math.max(0, Math.floor(Number(summaryCounts[key] || 0) + 1));
      } else if (sourcePick === 2) {
        const key = drugPool[Math.floor(Math.random() * drugPool.length)];
        nextEconomy.drugInventory[key] = Math.max(0, Math.floor(Number(nextEconomy.drugInventory[key] || 0) + 1));
        summaryCounts[key] = Math.max(0, Math.floor(Number(summaryCounts[key] || 0) + 1));
      } else {
        const key = armoryPool[Math.floor(Math.random() * armoryPool.length)];
        const weaponName = ARMORY_CONFIG.weapons?.[key]?.name || key;
        if (ARMORY_ATTACK_WEAPON_KEYS.includes(key)) {
          attackReward[weaponName] = Math.max(0, Math.floor(Number(attackReward[weaponName] || 0) + 1));
        } else {
          defenseReward[weaponName] = Math.max(0, Math.floor(Number(defenseReward[weaponName] || 0) + 1));
        }
        summaryCounts[weaponName] = Math.max(0, Math.floor(Number(summaryCounts[weaponName] || 0) + 1));
      }
    }

    const totalDrugs = DRUG_LAB_DRUG_KEYS.reduce((sum, key) => sum + Math.max(0, Math.floor(Number(nextEconomy.drugInventory[key] || 0))), 0);
    nextEconomy.drugs = totalDrugs;
    if (typeof window.Empire.UI?.updateEconomy === "function") {
      window.Empire.UI.updateEconomy(nextEconomy);
    }
    persistFactoryPlayerSuppliesSnapshot(factorySupplies);
    persistDrugLabPlayerSnapshot(playerState);
    if (Object.keys(attackReward).length) window.Empire.UI?.addCraftedWeapons?.(attackReward);
    if (Object.keys(defenseReward).length) window.Empire.UI?.addCraftedDefense?.(defenseReward);

    const labelMap = {
      metalParts: "Metal Parts",
      techCore: "Tech Core",
      combatModule: "Combat Module",
      chemicals: "Chemicals",
      biomass: "Biomass",
      stimPack: "Stim Pack",
      neonDust: "Neon Dust",
      pulseShot: "Pulse Shot",
      velvetSmoke: "Velvet Smoke",
      ghostSerum: "Ghost Serum",
      overdriveX: "Overdrive X"
    };
    const summary = Object.entries(summaryCounts)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${labelMap[key] || key} +${value}`)
      .join(", ");
    return {
      total: rolls,
      summary: summary || "bez materiálů"
    };
  }

  function resolveLatestPoliceRaidImpactRecord() {
    const mapRef = window.Empire?._localPoliceRaidImpacts;
    if (!(mapRef instanceof Map) || !mapRef.size) return null;
    let latest = null;
    mapRef.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const startedAt = Math.max(0, Math.floor(Number(entry.startedAt || 0)));
      if (!latest || startedAt > Math.max(0, Math.floor(Number(latest.startedAt || 0)))) {
        latest = entry;
      }
    });
    return latest;
  }

  function buildRecyclingEmergencyRecoveryPlan(impactRecord, restorePctRaw) {
    const restorePct = Math.max(0, Math.min(100, Number(restorePctRaw) || 0));
    if (!impactRecord || restorePct <= 0) return null;
    const recoverValue = (value) => Math.max(0, Math.floor(Math.max(0, Number(value) || 0) * restorePct / 100));
    const recovered = {
      cleanCash: recoverValue(impactRecord.cleanLoss),
      dirtyCash: recoverValue(impactRecord.dirtyLoss),
      influence: recoverValue(impactRecord.influenceLoss),
      gangMembers: recoverValue(impactRecord.arrested),
      materialsTotal: recoverValue(impactRecord.materialLoss),
      drugsTotal: recoverValue(impactRecord.drugLoss),
      attackWeaponsTotal: recoverValue(impactRecord.attackWeaponLoss),
      defenseWeaponsTotal: recoverValue(impactRecord.defenseWeaponLoss)
    };
    const materialSplit = distributeIntegerByWeights(recovered.materialsTotal, ["metalParts", "techCore", "combatModule"], {
      metalParts: 5,
      techCore: 3,
      combatModule: 2
    });
    const drugSplit = distributeIntegerByWeights(recovered.drugsTotal, DRUG_LAB_DRUG_KEYS, {});
    const attackSplit = distributeIntegerByWeights(recovered.attackWeaponsTotal, ARMORY_ATTACK_WEAPON_KEYS, {});
    const defenseSplit = distributeIntegerByWeights(recovered.defenseWeaponsTotal, ARMORY_DEFENSE_WEAPON_KEYS, {});
    return {
      restorePct,
      impactStartedAt: Math.max(0, Math.floor(Number(impactRecord.startedAt || 0))),
      impactTier: Math.max(0, Math.floor(Number(impactRecord.tier || 0))),
      recovered,
      materialSplit,
      drugSplit,
      attackSplit,
      defenseSplit
    };
  }

  function formatRecyclingRecoveryPlanSummary(plan) {
    if (!plan) return "Nebyl nalezen záznam o poslední policejní razii.";
    const parts = [];
    if (plan.recovered.cleanCash > 0) parts.push(`clean $${plan.recovered.cleanCash}`);
    if (plan.recovered.dirtyCash > 0) parts.push(`dirty $${plan.recovered.dirtyCash}`);
    if (plan.recovered.influence > 0) parts.push(`vliv +${plan.recovered.influence}`);
    if (plan.recovered.gangMembers > 0) parts.push(`lidé +${plan.recovered.gangMembers}`);
    if (plan.recovered.materialsTotal > 0) parts.push(`materiály +${plan.recovered.materialsTotal}`);
    if (plan.recovered.drugsTotal > 0) parts.push(`drogy +${plan.recovered.drugsTotal}`);
    if (plan.recovered.attackWeaponsTotal > 0) parts.push(`út. zbraně +${plan.recovered.attackWeaponsTotal}`);
    if (plan.recovered.defenseWeaponsTotal > 0) parts.push(`obr. zbraně +${plan.recovered.defenseWeaponsTotal}`);
    return parts.length ? parts.join(" • ") : "Žádné položky k navrácení.";
  }

  function applyRecyclingRecoveryPlan(plan) {
    if (!plan) return false;
    const addClean = window.Empire.UI?.addCleanCash;
    const addDirty = window.Empire.UI?.addDirtyCash;
    const addInfluence = window.Empire.UI?.addInfluence;
    const addGangMembers = window.Empire.UI?.addGangMembers;
    if (plan.recovered.cleanCash > 0 && typeof addClean === "function") addClean(plan.recovered.cleanCash);
    if (plan.recovered.dirtyCash > 0 && typeof addDirty === "function") addDirty(plan.recovered.dirtyCash);
    if (plan.recovered.influence > 0 && typeof addInfluence === "function") addInfluence(plan.recovered.influence);
    if (plan.recovered.gangMembers > 0 && typeof addGangMembers === "function") addGangMembers(plan.recovered.gangMembers);

    const economy = window.Empire.UI?.getEconomySnapshot?.() || {};
    const nextEconomy = {
      ...economy,
      drugInventory: {
        ...(economy.drugInventory && typeof economy.drugInventory === "object" ? economy.drugInventory : {})
      }
    };
    const factorySupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    const attackReward = {};
    const defenseReward = {};

    const materialByEconomyKey = {
      metalParts: Math.max(0, Math.floor(Number(plan.materialSplit?.metalParts || 0))),
      techCore: Math.max(0, Math.floor(Number(plan.materialSplit?.techCore || 0))),
      combatModule: Math.max(0, Math.floor(Number(plan.materialSplit?.combatModule || 0)))
    };
    Object.keys(materialByEconomyKey).forEach((key) => {
      const gain = materialByEconomyKey[key];
      if (!gain) return;
      nextEconomy[key] = Math.max(0, Math.floor(Number(nextEconomy[key] || 0) + gain));
      factorySupplies[key] = Math.max(0, Math.floor(Number(factorySupplies[key] || 0) + gain));
    });
    nextEconomy.materials = Math.max(
      0,
      Math.floor(Number(nextEconomy.metalParts || 0) + Number(nextEconomy.techCore || 0) + Number(nextEconomy.combatModule || 0))
    );

    DRUG_LAB_DRUG_KEYS.forEach((key) => {
      const gain = Math.max(0, Math.floor(Number(plan.drugSplit?.[key] || 0)));
      if (!gain) return;
      nextEconomy.drugInventory[key] = Math.max(0, Math.floor(Number(nextEconomy.drugInventory[key] || 0) + gain));
    });
    nextEconomy.drugs = DRUG_LAB_DRUG_KEYS.reduce(
      (sum, key) => sum + Math.max(0, Math.floor(Number(nextEconomy.drugInventory[key] || 0))),
      0
    );

    ARMORY_ATTACK_WEAPON_KEYS.forEach((key) => {
      const gain = Math.max(0, Math.floor(Number(plan.attackSplit?.[key] || 0)));
      if (!gain) return;
      const name = ARMORY_CONFIG.weapons?.[key]?.name || key;
      attackReward[name] = Math.max(0, Math.floor(Number(attackReward[name] || 0) + gain));
    });
    ARMORY_DEFENSE_WEAPON_KEYS.forEach((key) => {
      const gain = Math.max(0, Math.floor(Number(plan.defenseSplit?.[key] || 0)));
      if (!gain) return;
      const name = ARMORY_CONFIG.weapons?.[key]?.name || key;
      defenseReward[name] = Math.max(0, Math.floor(Number(defenseReward[name] || 0) + gain));
    });

    if (typeof window.Empire.UI?.updateEconomy === "function") window.Empire.UI.updateEconomy(nextEconomy);
    persistFactoryPlayerSuppliesSnapshot(factorySupplies);
    if (Object.keys(attackReward).length) window.Empire.UI?.addCraftedWeapons?.(attackReward);
    if (Object.keys(defenseReward).length) window.Empire.UI?.addCraftedDefense?.(defenseReward);
    return true;
  }

  function getOwnedWarehouseActionEffectBoostPct(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const entries = collectOwnedSimpleCashEntriesByMatcher(isWarehouseBaseName);
    const hasActive = entries.some((entry) => {
      const snapshot = getSimpleCashBuildingStateByKey(entry.instanceKey, nowMs);
      return nowMs < Math.max(0, Number(snapshot?.effects?.quickDistributionUntil || 0));
    });
    return hasActive ? Math.max(0, Number(WAREHOUSE_CONFIG.actions.quickDistribution.actionsEffectBoostPct || 0)) : 0;
  }

  function getOwnedWarehouseRaidProtectionPct(now = Date.now()) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const entries = collectOwnedSimpleCashEntriesByMatcher(isWarehouseBaseName);
    const hasActive = entries.some((entry) => {
      const snapshot = getSimpleCashBuildingStateByKey(entry.instanceKey, nowMs);
      return nowMs < Math.max(0, Number(snapshot?.effects?.hiddenStorageUntil || 0));
    });
    return hasActive ? Math.max(0, Number(WAREHOUSE_CONFIG.actions.hiddenStorage.raidProtectionPct || 0)) : 0;
  }

  function grantWarehouseRandomMaterials(amount = 0) {
    const rolls = Math.max(0, Math.floor(Number(amount) || 0));
    if (!rolls) return { total: 0, summary: "bez materiálů" };
    const factoryPool = ["metalParts", "techCore", "combatModule"];
    const pharmacyPool = ["chemicals", "biomass", "stimPack"];
    const summaryCounts = {
      metalParts: 0,
      techCore: 0,
      combatModule: 0,
      chemicals: 0,
      biomass: 0,
      stimPack: 0
    };
    const factorySupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
    const playerState = getDrugLabPlayerSnapshot();
    playerState.labSupplies = createDrugLabSupplyMap(playerState.labSupplies || {});

    for (let index = 0; index < rolls; index += 1) {
      const pickFactory = Math.random() < 0.5;
      if (pickFactory) {
        const key = factoryPool[Math.floor(Math.random() * factoryPool.length)];
        factorySupplies[key] = Math.max(0, Math.floor(Number(factorySupplies[key] || 0) + 1));
        summaryCounts[key] += 1;
      } else {
        const key = pharmacyPool[Math.floor(Math.random() * pharmacyPool.length)];
        playerState.labSupplies[key] = Math.max(0, Math.floor(Number(playerState.labSupplies[key] || 0) + 1));
        summaryCounts[key] += 1;
      }
    }

    persistFactoryPlayerSuppliesSnapshot(factorySupplies);
    persistDrugLabPlayerSnapshot(playerState);

    const labelMap = {
      metalParts: "Metal Parts",
      techCore: "Tech Core",
      combatModule: "Combat Module",
      chemicals: "Chemicals",
      biomass: "Biomass",
      stimPack: "Stim Pack"
    };
    const summary = Object.entries(summaryCounts)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${labelMap[key] || key} +${value}`)
      .join(", ");
    return {
      total: rolls,
      summary: summary || "bez materiálů"
    };
  }

  function collectEnemyDistrictEntriesForDataCenter() {
    const districts = Array.isArray(state.districts) ? state.districts.filter(Boolean) : [];
    return districts.filter((district) => {
      if (isDistrictDestroyed(district)) return false;
      if (!district?.owner) return false;
      if (isDistrictOwnedByPlayer(district)) return false;
      return true;
    });
  }

  function resolveDataCenterTargetOwner(levelEffects) {
    const enemyDistricts = collectEnemyDistrictEntriesForDataCenter();
    const owners = Array.from(new Set(enemyDistricts.map((district) => String(district.owner || "").trim()).filter(Boolean)));
    if (!owners.length) return "";
    return owners[0];
  }

  function resolveDataCenterTargetDistrict(levelEffects) {
    const enemyDistricts = collectEnemyDistrictEntriesForDataCenter();
    if (!enemyDistricts.length) return null;
    return enemyDistricts[0];
  }

  function buildDataCenterTrackingIntel(ownerName, levelEffects) {
    const owner = String(ownerName || "").trim();
    const ownerDistricts = collectEnemyDistrictEntriesForDataCenter().filter((district) => normalizeName(district.owner) === normalizeName(owner));
    const buildingPool = ownerDistricts
      .flatMap((district) => Array.isArray(district.buildings) ? district.buildings : [])
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    const uniqueBuildings = Array.from(new Set(buildingPool));
    const selectedBuildings = uniqueBuildings.slice(0, Math.max(1, Math.min(3 + levelEffects.intelInfoBonus, uniqueBuildings.length)));
    const candidateActions = [
      `naposledy útočil na distrikt #${resolveDistrictNumberLabel(ownerDistricts[0] || { id: "?" })}`,
      `naposledy špehoval hráče ${ownerDistricts[1]?.owner || "v okolí"}`,
      "provedl rychlý přesun cash mezi distrikty",
      "aktivoval boost produkce v klíčové budově",
      "přeskupil obranné jednotky v okrajové zóně"
    ];
    const maxActions = Math.max(DATA_CENTER_CONFIG.actions.playerTracking.minActions, DATA_CENTER_CONFIG.actions.playerTracking.maxActions + levelEffects.intelInfoBonus);
    const actionCount = clamp(
      DATA_CENTER_CONFIG.actions.playerTracking.minActions + Math.floor(Math.random() * Math.max(1, maxActions)),
      DATA_CENTER_CONFIG.actions.playerTracking.minActions,
      maxActions
    );
    const sampledActions = candidateActions.slice(0, actionCount);
    const weakDistricts = ownerDistricts
      .slice()
      .sort((left, right) => Math.max(0, Number(left?.income || 0)) - Math.max(0, Number(right?.income || 0)))
      .slice(0, Math.max(1, Math.min(2 + levelEffects.intelInfoBonus, ownerDistricts.length)))
      .map((district) => `#${resolveDistrictNumberLabel(district)} ${district.name || "Distrikt"}`);
    const stockEstimate = `${formatDecimalValue(70 + Math.random() * 60, 0)}% odhad zásob (±30%)`;
    return {
      actions: sampledActions,
      weakDistricts,
      buildings: selectedBuildings,
      stockEstimate
    };
  }

  function reduceCooldownMapValues(cooldownsRaw, nowMs, reductionPct) {
    if (!cooldownsRaw || typeof cooldownsRaw !== "object") return;
    const ratio = Math.max(0, 1 - Math.max(0, Number(reductionPct || 0)) / 100);
    Object.keys(cooldownsRaw).forEach((key) => {
      const until = Math.max(0, Number(cooldownsRaw[key] || 0));
      if (until <= nowMs) return;
      cooldownsRaw[key] = nowMs + Math.floor((until - nowMs) * ratio);
    });
  }

  function applyDataCenterGlobalCooldownReduction(now = Date.now(), reductionPct = 0) {
    const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
    const pct = Math.max(0, Number(reductionPct || 0));
    if (pct <= 0) return;
    const stores = [
      [apartmentBlockStore, saveApartmentBlockStore],
      [schoolBuildingStore, saveSchoolBuildingStore],
      [fitnessBuildingStore, saveFitnessBuildingStore],
      [casinoBuildingStore, saveCasinoBuildingStore],
      [arcadeBuildingStore, saveArcadeBuildingStore],
      [autoSalonBuildingStore, saveAutoSalonBuildingStore],
      [exchangeBuildingStore, saveExchangeBuildingStore],
      [restaurantBuildingStore, saveRestaurantBuildingStore],
      [convenienceStoreBuildingStore, saveConvenienceStoreBuildingStore],
      [pharmacyBuildingStore, savePharmacyBuildingStore],
      [simpleCashBuildingStore, saveSimpleCashBuildingStore],
      [factoryBuildingStore, saveFactoryBuildingStore],
      [armoryBuildingStore, saveArmoryBuildingStore],
      [drugLabBuildingStore, saveDrugLabBuildingStore]
    ];
    stores.forEach(([storeRef, saveRef]) => {
      if (!storeRef || typeof storeRef !== "object") return;
      Object.values(storeRef).forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        reduceCooldownMapValues(entry.cooldowns, nowMs, pct);
      });
      if (typeof saveRef === "function") saveRef();
    });
  }

  function grantInstantSpyReward(amount) {
    const gained = Math.max(0, Math.floor(Number(amount) || 0));
    if (!gained) return 0;
    const getEconomySnapshot = window.Empire.UI?.getEconomySnapshot;
    const updateEconomy = window.Empire.UI?.updateEconomy;
    if (typeof getEconomySnapshot !== "function" || typeof updateEconomy !== "function") {
      return 0;
    }
    const snapshot = getEconomySnapshot() || {};
    const currentSpies = Math.max(
      0,
      Math.floor(Number(snapshot.spies ?? snapshot.spyCount ?? snapshot.availableSpies ?? 0))
    );
    const nextSpies = currentSpies + gained;
    updateEconomy({
      ...snapshot,
      spies: nextSpies,
      spyCount: nextSpies
    });
    return gained;
  }

  function trySpendWithCleanDirtySplit(totalCost, cleanRatio = 0.8) {
    const split = resolveCleanDirtySplitCost(totalCost, cleanRatio);
    const total = split.total;
    if (!total) return { ok: true, cleanCost: 0, dirtyCost: 0 };
    const cleanCost = split.cleanCost;
    const dirtyCost = split.dirtyCost;
    const getEconomySnapshot = window.Empire.UI?.getEconomySnapshot;
    const updateEconomy = window.Empire.UI?.updateEconomy;
    if (typeof getEconomySnapshot !== "function" || typeof updateEconomy !== "function") {
      return { ok: false, reason: "missing_economy_module", cleanCost, dirtyCost };
    }
    const economy = getEconomySnapshot() || {};
    const availableClean = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
    const availableDirty = Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)));
    if (availableClean < cleanCost) {
      return { ok: false, reason: "insufficient_clean_cash", cleanCost, dirtyCost, availableClean, availableDirty };
    }
    if (availableDirty < dirtyCost) {
      return { ok: false, reason: "insufficient_dirty_cash", cleanCost, dirtyCost, availableClean, availableDirty };
    }
    const nextEconomy = {
      ...economy,
      cleanMoney: availableClean - cleanCost,
      dirtyMoney: availableDirty - dirtyCost
    };
    nextEconomy.balance = Number(nextEconomy.cleanMoney || 0) + Number(nextEconomy.dirtyMoney || 0);
    updateEconomy(nextEconomy);
    return { ok: true, cleanCost, dirtyCost };
  }

  function resolveParkSpecialBuildingDetails(context, district, fallback, cashProfile) {
    const type = resolveParkSpecialBuildingType(context?.baseName);
    if (!type) return null;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getSimpleCashBuildingStateByKey(key, now);
    const buildingLevel = Math.max(1, Math.floor(Number(snapshot.level || 1)));
    const effects = snapshot.effects || {};
    const cooldowns = snapshot.cooldowns || {};
    const stacks = snapshot.stacks || {};
    const toCooldown = (value) => Math.max(0, Number(value || 0) - now);
    const warehouseActionBoostPct = type === "warehouse" ? 0 : getOwnedWarehouseActionEffectBoostPct(now);
    const warehouseActionBoostMultiplier = Math.max(1, 1 + warehouseActionBoostPct / 100);

    let extraIncomePct = 0;
    let extraCleanIncomePct = 0;
    let extraDirtyIncomePct = 0;
    let heatPerDay = 0;
    let influencePerHour = 0;
    let mechanicsType = "";
    let info = fallback.info;
    let specialActions = [];
    let streetDealerNetworkEffects = null;
    let streetDealerSalesSync = null;
    let streetDealerHeatSync = null;
    let streetDealerSalesDirtyPerHour = 0;

    if (type === "smuggling-tunnel") {
      mechanicsType = "smuggling-tunnel";
      const levelEffects = getSmugglingTunnelLevelEffects(buildingLevel);
      heatPerDay = SMUGGLING_TUNNEL_CONFIG.baseHeatPerDay * levelEffects.heatMultiplier;
      influencePerHour = Math.max(0, Number(SMUGGLING_TUNNEL_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      extraIncomePct += getOwnedStripClubTargetBoostPct(now, context?.baseName);
      extraDirtyIncomePct += levelEffects.dirtyIncomeBoostPct;
      if (now < Number(effects.nightTransportUntil || 0)) {
        extraDirtyIncomePct += SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.dirtyIncomeBoostPct * warehouseActionBoostMultiplier;
      }
      if (now < Number(effects.rerouteFlowUntil || 0)) {
        extraIncomePct += SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.parkIncomeBoostPct * warehouseActionBoostMultiplier;
      }
      info =
        "Pod městem vede síť špinavých tunelů. Drogy, zbraně i lidi se přesouvají mimo oči zákona. "
        + "Kdo kontroluje tok, kontroluje město.";
      specialActions = [
        "Noční převoz: +40% dirty cash na 2h • heat +6 • cooldown 6h.",
        "Velká zásilka: +13 drogy • heat +10 • cooldown 8h.",
        "Přesměrování toku: +25% income této budovy na 2h • heat +8 • cooldown 10h."
      ];
    } else if (type === "street-dealers") {
      mechanicsType = "street-dealers";
      const levelEffects = getStreetDealersLevelEffects(buildingLevel);
      const stackIncomePct = Math.max(0, Math.floor(Number(stacks.dealerTerritory || 0))) * STREET_DEALERS_CONFIG.actions.territoryExpansion.incomeStackPct;
      const ownedStreetDealersCount = getOwnedStreetDealersCount();
      const networkEffects = getStreetDealerNetworkEffects(ownedStreetDealersCount);
      const salesSync = syncStreetDealerSales(snapshot, now, { ownedStreetDealersCount });
      const heatSync = applyStreetDealerPassiveHeatTick(snapshot, now);
      const salesDirtyPerHour = (Array.isArray(salesSync.slots) ? salesSync.slots : [])
        .reduce((sum, slot) => sum + Math.max(0, Number(slot?.dirtyPerHour || 0)), 0);
      influencePerHour = Math.max(0, Number(STREET_DEALERS_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      extraIncomePct += getOwnedStripClubTargetBoostPct(now, context?.baseName);
      extraDirtyIncomePct += levelEffects.dirtyIncomeBoostPct;
      heatPerDay = (24 * 60 / 5) * Math.max(0, Number(STREET_DEALERS_CONFIG.passiveHeatPerTick || 0));
      if (now < Number(effects.salesBoostUntil || 0)) {
        extraIncomePct += STREET_DEALERS_CONFIG.actions.salesBoost.incomeBoostPct * warehouseActionBoostMultiplier;
      }
      if (now < Number(effects.aggressivePushUntil || 0)) {
        extraDirtyIncomePct += STREET_DEALERS_CONFIG.actions.aggressivePush.dirtyIncomeBoostPct * warehouseActionBoostMultiplier;
      }
      extraIncomePct += stackIncomePct;
      info =
        "Pouliční dealeři drží síť menších rajónů. Do slotů vkládáš Neon Dust, Pulse Shot a Velvet Smoke "
        + "z inventáře hráče a ty se průběžně prodávají za dirty cash.";
      specialActions = [
        "Boost prodeje: +30% income na 3h • heat +4 • cooldown 5h.",
        "Agresivní push: +70% dirty cash na 1h • heat +8 • cooldown 6h.",
        "Rozšíření rajónu: +1 stack (+5% income trvale) • heat +5 • cooldown 10h."
      ];
      streetDealerNetworkEffects = networkEffects;
      streetDealerSalesSync = salesSync;
      streetDealerHeatSync = heatSync;
      streetDealerSalesDirtyPerHour = salesDirtyPerHour;
    } else if (type === "strip-club") {
      mechanicsType = "strip-club";
      const levelEffects = getStripClubLevelEffects(buildingLevel);
      heatPerDay = Math.max(0, Number(STRIP_CLUB_CONFIG.baseHeatPerDay || 0));
      influencePerHour = Math.max(0, Number(STRIP_CLUB_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      extraCleanIncomePct += levelEffects.cleanIncomeBoostPct;
      if (now < Number(effects.vipNightUntil || 0)) {
        const vipMultiplier = Math.max(1, Math.floor(Number(effects.vipNightMultiplier || 1)));
        const vipBoost =
          (STRIP_CLUB_CONFIG.actions.vipNight.incomeBoostPct + levelEffects.vipExtraBoostPct) * vipMultiplier;
        extraIncomePct += vipBoost * warehouseActionBoostMultiplier;
      }
      info =
        "Strip club generuje vysoký cashflow a přes soukromé dohody umí krátkodobě posílit další byznysy.";
      specialActions = [
        "VIP noc: +50% income na 2h • heat +6 • cooldown 6h.",
        "Soukromé služby: +1500 dirty cash • 4-8 drbů • +10 vliv • heat +7 • cooldown 8h.",
        "Špinavé dohody: +20% income budovy Pouliční dealeři nebo Pašovací tunel na 2h • heat +9 • cooldown 10h."
      ];
    } else if (type === "data-center") {
      mechanicsType = "data-center";
      const levelEffects = getDataCenterLevelEffects(buildingLevel);
      heatPerDay = Math.max(0, Number(DATA_CENTER_CONFIG.baseHeatPerDay || 0));
      influencePerHour = Math.max(0, Number(DATA_CENTER_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      extraCleanIncomePct += levelEffects.cleanIncomeBoostPct;
      if (now < Number(effects.hackIncomeUntil || 0)) {
        const baseHackPct = Math.max(0, Number(DATA_CENTER_CONFIG.actions.hackIncome.incomeBoostPct || 0));
        extraIncomePct += baseHackPct * levelEffects.hackEffectMultiplier * warehouseActionBoostMultiplier;
      }
      info =
        "Servery jedou nonstop. Data o hráčích, pohybech a útocích dávají přehled dopředu tomu, kdo je umí číst.";
      specialActions = [
        "Sledování hráče: výběr hráče, 1-3 poslední akce + slabé districty • heat +6 • cooldown 8h.",
        "Hack income: výběr nepřátelského districtu, +20% income na 2h • heat +10 • cooldown 8h.",
        "Datový boost: -15% cooldown všech akcí na 2h • heat +8 • cooldown 12h."
      ];
    } else if (type === "warehouse") {
      mechanicsType = "warehouse";
      const levelEffects = getWarehouseLevelEffects(buildingLevel);
      heatPerDay = Math.max(0, Number(WAREHOUSE_CONFIG.baseHeatPerDay || 0));
      influencePerHour = Math.max(0, Number(WAREHOUSE_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      info =
        "Tady se drží všechno — drogy, materiály i zbraně. Bez skladu nemáš co prodávat ani čím bojovat.";
      specialActions = [
        "Hromadění zásob: +2 náhodné materiály z Lékárny nebo Továrny • heat +3 • cooldown 6h.",
        "Rychlá distribuce: +5% efekt akcí v jiných budovách na 2h • heat +5 • cooldown 8h.",
        "Skrytý sklad: ochrana proti ztrátě zdrojů na 3h (razie má o 10–30% nižší účinnost) • heat +4 • cooldown 10h."
      ];
    } else if (type === "research-center") {
      mechanicsType = "research-center";
      const levelEffects = getResearchCenterLevelEffects(buildingLevel);
      heatPerDay = Math.max(0, Number(RESEARCH_CENTER_CONFIG.baseHeatPerDay || 0));
      influencePerHour = Math.max(0, Number(RESEARCH_CENTER_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      info =
        "Experimenty, prototypy a nové technologie dávají tvému gangu náskok. Ostatní vyrábí, ty vylepšuješ.";
      specialActions = [
        "Optimalizace výroby: +30% rychlost produkce Továrna + Zbrojovka na 2h • heat +6 • cooldown 8h.",
        "Experimentální série: +50% produkce Továrna + Zbrojovka na 1h, 20% fail bez efektu • heat +9 • cooldown 10h.",
        "Technologický upgrade: -20% čas výroby Drug lab + Zbrojovka na 2h • heat +7 • cooldown 12h."
      ];
    } else if (type === "recycling-center") {
      mechanicsType = "recycling-center";
      const levelEffects = getRecyclingCenterLevelEffects(buildingLevel);
      heatPerDay = Math.max(0, Number(RECYCLING_CENTER_CONFIG.baseHeatPerDay || 0)) * Math.max(0, Number(levelEffects.heatMultiplier || 1));
      influencePerHour = Math.max(0, Number(RECYCLING_CENTER_CONFIG.baseInfluencePerDay || 0)) / 24;
      extraIncomePct += levelEffects.incomeBoostPct;
      extraCleanIncomePct += levelEffects.cleanIncomeBoostPct;
      info =
        "Místo, kde rozbitý vybavení, chemický odpad a zbytky po operacích vracíš zpátky do oběhu.";
      specialActions = [
        "Zpracování odpadu: +2 náhodné materiály z Drug lab/Zbrojovka/Lékárna/Továrna • heat +3 • cooldown 6h.",
        "Rozborka zásilky: +2 Chemicals +5 Metal Parts • heat +5 • cooldown 8h.",
        "Nouzová obnova: vrátí část zabaveného z poslední policejní razie po potvrzení • heat +6 • cooldown 10h."
      ];
    }

    const syncResult = syncSimpleCashBuildingIncome(
      snapshot,
      cashProfile,
      now,
      district || context?.districtId,
      { extraIncomePct, extraCleanIncomePct, extraDirtyIncomePct }
    );
    if (influencePerHour > 0) {
      applyBuildingInfluenceTick(snapshot, now, influencePerHour);
    }
    persistSimpleCashBuildingState(key, snapshot);
    const hourlyCleanIncome = Number(syncResult?.rates?.hourlyCleanIncome || cashProfile?.hourlyCleanIncome || 0);
    const hourlyDirtyIncome = Number(syncResult?.rates?.hourlyDirtyIncome || cashProfile?.hourlyDirtyIncome || 0);
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;

    const effectsLabel = [];
    if (type === "smuggling-tunnel") {
      if (now < Number(effects.nightTransportUntil || 0)) {
        effectsLabel.push(`Noční převoz +${SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.dirtyIncomeBoostPct}% dirty`);
      }
      if (now < Number(effects.rerouteFlowUntil || 0)) {
        effectsLabel.push(`Přesměrování toku aktivní (+${SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.parkIncomeBoostPct}% Park income)`);
      }
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${SMUGGLING_TUNNEL_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`Velká zásilka: lepší drop (+${SMUGGLING_TUNNEL_CONFIG.bigShipmentExtraDropsAtLevel3})`);
      if (buildingLevel >= 4) effectsLabel.push(`Upgrade dirty +${SMUGGLING_TUNNEL_CONFIG.dirtyIncomeBoostPctLevel4}% • heat +10%`);
      if (buildingLevel >= 5) effectsLabel.push(`Upgrade income +${SMUGGLING_TUNNEL_CONFIG.incomeBoostPctLevel5}% • 10% ignorace heat z akcí`);
    } else if (type === "street-dealers") {
      const stacksCount = Math.max(0, Math.floor(Number(stacks.dealerTerritory || 0)));
      const networkEffects = streetDealerNetworkEffects || getStreetDealerNetworkEffects(1);
      const salesSync = streetDealerSalesSync || { slots: [] };
      const salesDirtyPerHour = Math.max(0, Number(streetDealerSalesDirtyPerHour || 0));
      const heatSync = streetDealerHeatSync || { heatAdded: 0 };
      if (stacksCount > 0) {
        effectsLabel.push(`Stacky rajónu: ${stacksCount} (+${stacksCount * STREET_DEALERS_CONFIG.actions.territoryExpansion.incomeStackPct}% income)`);
      }
      if (networkEffects.extraBuildings > 0) {
        effectsLabel.push(
          `Síť dealerů: ${networkEffects.ownedStreetDealersCount} budov `
          + `(max +${formatDecimalValue(networkEffects.maxCapacityBonusPct, 2)}%, rychlost +${formatDecimalValue(networkEffects.speedBonusPct, 2)}%)`
        );
      }
      if (salesDirtyPerHour > 0) {
        effectsLabel.push(`Slotový prodej: +${formatDecimalValue(salesDirtyPerHour, 2)} dirty/h`);
      }
      if (Number(heatSync.heatAdded || 0) > 0) {
        effectsLabel.push(`Pasivní heat tick: +${formatDecimalValue(heatSync.heatAdded, 1)}`);
      }
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${STREET_DEALERS_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`Upgrade dirty +${STREET_DEALERS_CONFIG.dirtyIncomeBoostPctLevel3}%`);
      if (buildingLevel >= 4) effectsLabel.push(`Upgrade income +${STREET_DEALERS_CONFIG.incomeBoostPctLevel4}% • heat +5%`);
      if (buildingLevel >= 5) effectsLabel.push(`Upgrade income +${STREET_DEALERS_CONFIG.incomeBoostPctLevel5}% • +1 špeh`);
      if (now < Number(effects.salesBoostUntil || 0)) effectsLabel.push("Boost prodeje aktivní");
      if (now < Number(effects.aggressivePushUntil || 0)) effectsLabel.push("Agresivní push aktivní");
    } else if (type === "strip-club") {
      if (now < Number(effects.vipNightUntil || 0)) effectsLabel.push("VIP noc aktivní");
      if (now < Number(effects.dirtyDealsUntil || 0)) effectsLabel.push("Špinavé dohody aktivní");
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${STRIP_CLUB_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`VIP efekty posíleny (+${STRIP_CLUB_CONFIG.vipBonusPctLevel3}%)`);
      if (buildingLevel >= 4) effectsLabel.push(`Upgrade clean +${STRIP_CLUB_CONFIG.cleanIncomeBoostPctLevel4}%`);
      if (buildingLevel >= 5) effectsLabel.push(`VIP: ${STRIP_CLUB_CONFIG.vipDoubleChancePctLevel5}% šance na 2× efekt`);
    } else if (type === "data-center") {
      if (now < Number(effects.hackIncomeUntil || 0)) effectsLabel.push("Hack income aktivní");
      if (now < Number(effects.dataBoostUntil || 0)) effectsLabel.push("Datový boost aktivní");
      if (snapshot.dataCenterHackTargetDistrictId) effectsLabel.push(`Cíl hacku: #${snapshot.dataCenterHackTargetDistrictId}`);
      if (snapshot.dataCenterTrackingOwner) effectsLabel.push(`Sledovaný hráč: ${snapshot.dataCenterTrackingOwner}`);
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${DATA_CENTER_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push("Lepší data: více intel informací");
      if (buildingLevel >= 4) effectsLabel.push(`Upgrade clean +${DATA_CENTER_CONFIG.cleanIncomeBoostPctLevel4}%`);
      if (buildingLevel >= 5) effectsLabel.push(`Hack akce +${DATA_CENTER_CONFIG.hackEffectBoostPctLevel5}% efekt`);
    } else if (type === "warehouse") {
      if (now < Number(effects.quickDistributionUntil || 0)) effectsLabel.push("Rychlá distribuce aktivní");
      if (now < Number(effects.hiddenStorageUntil || 0)) effectsLabel.push("Skrytý sklad aktivní");
      if (snapshot.warehouseLastMaterialsSummary) effectsLabel.push(`Poslední zásoby: ${snapshot.warehouseLastMaterialsSummary}`);
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${WAREHOUSE_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`Upgrade income +${WAREHOUSE_CONFIG.incomeBoostPctLevel3}%`);
      if (buildingLevel >= 4) effectsLabel.push(`Upgrade income +${WAREHOUSE_CONFIG.incomeBoostPctLevel4}%`);
      if (buildingLevel >= 5) effectsLabel.push(`Hromadění zásob +${WAREHOUSE_CONFIG.extraMaterialsLevel5} extra materiálů`);
    } else if (type === "research-center") {
      if (now < Number(effects.optimizeProductionUntil || 0)) effectsLabel.push("Optimalizace výroby aktivní");
      if (now < Number(effects.experimentalSeriesUntil || 0)) effectsLabel.push("Experimentální série aktivní");
      if (now < Number(effects.technologyUpgradeUntil || 0)) effectsLabel.push("Technologický upgrade aktivní");
      if (snapshot.researchLastExperimentFailedAt > 0 && now - Number(snapshot.researchLastExperimentFailedAt || 0) < 2 * 60 * 60 * 1000) {
        effectsLabel.push("Poslední experiment: fail");
      }
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${RESEARCH_CENTER_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`Akce +${RESEARCH_CENTER_CONFIG.actionsEffectBoostPctLevel3}% efekt`);
      if (buildingLevel >= 4) effectsLabel.push(`Produkce +${RESEARCH_CENTER_CONFIG.productionBoostPctLevel4}%`);
      if (buildingLevel >= 5) {
        effectsLabel.push(`Zbrojovka/Továrna: -${RESEARCH_CENTER_CONFIG.permanentProductionTimeReductionPctLevel5}% výrobní čas trvale`);
      }
    } else if (type === "recycling-center") {
      if (buildingLevel >= 2) effectsLabel.push(`Upgrade income +${RECYCLING_CENTER_CONFIG.incomeBoostPctLevel2}%`);
      if (buildingLevel >= 3) effectsLabel.push(`Zpracování odpadu: +${RECYCLING_CENTER_CONFIG.extraWasteMaterialsLevel3} extra materiál`);
      if (buildingLevel >= 4) {
        effectsLabel.push(`Upgrade clean +${RECYCLING_CENTER_CONFIG.cleanIncomeBoostPctLevel4}%`);
        effectsLabel.push("Heat -5%");
      }
      if (buildingLevel >= 5) effectsLabel.push(`Nouzová obnova: ${RECYCLING_CENTER_CONFIG.restorePctLevel5}% návrat`);
      if (snapshot.recyclingLastRecoveryAt > 0 && now - Number(snapshot.recyclingLastRecoveryAt || 0) < 2 * 60 * 60 * 1000) {
        effectsLabel.push("Nouzová obnova nedávno aktivní");
      }
    }

    let nextLevel = null;
    let nextUpgradeCost = 0;
    if (type === "smuggling-tunnel" && buildingLevel < SMUGGLING_TUNNEL_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(SMUGGLING_TUNNEL_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "street-dealers" && buildingLevel < STREET_DEALERS_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(STREET_DEALERS_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "strip-club" && buildingLevel < STRIP_CLUB_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(STRIP_CLUB_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "data-center" && buildingLevel < DATA_CENTER_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(DATA_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "warehouse" && buildingLevel < WAREHOUSE_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(WAREHOUSE_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "research-center" && buildingLevel < RESEARCH_CENTER_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(RESEARCH_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
    } else if (type === "recycling-center" && buildingLevel < RECYCLING_CENTER_CONFIG.maxLevel) {
      nextLevel = buildingLevel + 1;
      nextUpgradeCost = Math.max(0, Number(RECYCLING_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
    }

    return {
      ...fallback,
      info,
      specialActions,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome: hourlyIncome * 24,
      mechanics: {
        type: mechanicsType,
        level: buildingLevel,
        nextLevel,
        nextUpgradeCost,
        storedMembers: 0,
        capacity: 0,
        productionPerCycle: 0,
        heatPerDay,
        effectsLabel: effectsLabel.length ? effectsLabel.join(" • ") : "Žádné",
        cooldowns: {
          nightTransport: toCooldown(cooldowns.nightTransport),
          bigShipment: toCooldown(cooldowns.bigShipment),
          rerouteFlow: toCooldown(cooldowns.rerouteFlow),
          salesBoost: toCooldown(cooldowns.salesBoost),
          aggressivePush: toCooldown(cooldowns.aggressivePush),
          territoryExpansion: toCooldown(cooldowns.territoryExpansion),
          vipNight: toCooldown(cooldowns.vipNight),
          privateServices: toCooldown(cooldowns.privateServices),
          dirtyDeals: toCooldown(cooldowns.dirtyDeals),
          playerTracking: toCooldown(cooldowns.playerTracking),
          hackIncome: toCooldown(cooldowns.hackIncome),
          dataBoost: toCooldown(cooldowns.dataBoost),
          stockpile: toCooldown(cooldowns.stockpile),
          quickDistribution: toCooldown(cooldowns.quickDistribution),
          hiddenStorage: toCooldown(cooldowns.hiddenStorage),
          optimizeProduction: toCooldown(cooldowns.optimizeProduction),
          experimentalSeries: toCooldown(cooldowns.experimentalSeries),
          technologyUpgrade: toCooldown(cooldowns.technologyUpgrade),
          processWaste: toCooldown(cooldowns.processWaste),
          breakShipment: toCooldown(cooldowns.breakShipment),
          emergencyRecovery: toCooldown(cooldowns.emergencyRecovery)
        },
        stacks: {
          dealerTerritory: Math.max(0, Math.floor(Number(stacks.dealerTerritory || 0)))
        },
        ownedStreetDealersCount: Math.max(1, Math.floor(Number(streetDealerNetworkEffects?.ownedStreetDealersCount || getOwnedStreetDealersCount()))),
        networkMaxCapacityBonusPct: Math.max(0, Number(streetDealerNetworkEffects?.maxCapacityBonusPct || 0)),
        networkSpeedBonusPct: Math.max(0, Number(streetDealerNetworkEffects?.speedBonusPct || 0)),
        streetDealerSlots: Array.isArray(streetDealerSalesSync?.slots)
          ? streetDealerSalesSync.slots
          : [],
        playerDrugInventory: createStreetDealerDrugInventory(normalizeDrugLabInventoryFromEconomy(getSafeDrugLabEconomySnapshot())),
        slotSalesDirtyPerHour: Math.max(0, Number(streetDealerSalesDirtyPerHour || 0)),
        passiveHeatPerTick: Math.max(0, Number(STREET_DEALERS_CONFIG.passiveHeatPerTick || 0)),
        passiveHeatIntervalMs: Math.max(1, Number(STREET_DEALERS_CONFIG.passiveHeatIntervalMs || (5 * 60 * 1000))),
        activeIncomeBonusPct: extraIncomePct,
        activeDirtyBonusPct: extraDirtyIncomePct
      }
    };
  }

  function handleParkSpecialBuildingAction(actionId, activeContext) {
    const { district, context } = activeContext || {};
    const type = resolveParkSpecialBuildingType(context?.baseName);
    if (!type) return null;
    const now = Date.now();
    if (isPoliceRaidAllActionsBlocked(now)) {
      return { ok: false, message: "Během policejní razie jsou všechny akce v budovách dočasně zakázané." };
    }
    if (isPoliceRaidSpecialActionBlockedForBuilding(type, now) && (actionId === "1" || actionId === "2" || actionId === "3")) {
      return { ok: false, message: "Speciální akce této budovy jsou během razie dočasně zakázané." };
    }
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getSimpleCashBuildingStateByKey(key, now);
    const buildingLevel = Math.max(1, Math.floor(Number(snapshot.level || 1)));
    const toCooldownLeft = (value) => Math.max(0, Number(value || 0) - now);
    const addInfluence = window.Empire.UI?.addInfluence;
    const applyActionHeat = (baseHeat, reason) => {
      const safeHeat = Math.max(0, Number(baseHeat) || 0);
      if (!safeHeat) return readCurrentPlayerHeatValue();
      if (type === "smuggling-tunnel") {
        const levelEffects = getSmugglingTunnelLevelEffects(buildingLevel);
        const shouldIgnore =
          levelEffects.ignoreHeatChancePct > 0
          && Math.random() < (levelEffects.ignoreHeatChancePct / 100);
        if (shouldIgnore) {
          return readCurrentPlayerHeatValue();
        }
        const adjustedHeat = safeHeat * Math.max(0, Number(levelEffects.heatMultiplier || 1));
        return addPlayerHeatFromBuilding(adjustedHeat, reason);
      }
      if (type === "street-dealers") {
        const levelEffects = getStreetDealersLevelEffects(buildingLevel);
        const adjustedHeat = safeHeat * Math.max(0, Number(levelEffects.heatMultiplier || 1));
        return addPlayerHeatFromBuilding(adjustedHeat, reason);
      }
      return addPlayerHeatFromBuilding(safeHeat, reason);
    };

    if (type === "smuggling-tunnel") {
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.nightTransport);
        if (cooldownLeft > 0) return { ok: false, message: `Noční převoz je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.nightTransportUntil = now + SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.durationMs;
        snapshot.cooldowns.nightTransport = now + SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.cooldownMs;
        const levelEffects = getSmugglingTunnelLevelEffects(buildingLevel);
        const nextHeat = applyActionHeat(SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.heatAdded, "Noční převoz");
        persistSimpleCashBuildingState(key, snapshot);
        const heatInfo = levelEffects.ignoreHeatChancePct > 0
          ? `heat +${formatDecimalValue(SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.heatAdded * levelEffects.heatMultiplier, 1)} (10% šance ignorace)`
          : `heat +${formatDecimalValue(SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.heatAdded * levelEffects.heatMultiplier, 1)}`;
        return { ok: true, message: `Noční převoz aktivní na ${formatDurationLabel(SMUGGLING_TUNNEL_CONFIG.actions.nightTransport.durationMs)}. Dirty cash +40%, ${heatInfo} (celkem ${formatDecimalValue(nextHeat, 1)}).` };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.bigShipment);
        if (cooldownLeft > 0) return { ok: false, message: `Velká zásilka je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const levelEffects = getSmugglingTunnelLevelEffects(buildingLevel);
        snapshot.cooldowns.bigShipment = now + SMUGGLING_TUNNEL_CONFIG.actions.bigShipment.cooldownMs;
        const totalDrugsReward = SMUGGLING_TUNNEL_CONFIG.actions.bigShipment.drugsReward + levelEffects.bigShipmentBonusDrugs;
        const gainedDrugs = grantInstantDrugReward(totalDrugsReward);
        const nextHeat = applyActionHeat(SMUGGLING_TUNNEL_CONFIG.actions.bigShipment.heatAdded, "Velká zásilka");
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Velká zásilka dorazila: +${gainedDrugs} drogy, heat +${formatDecimalValue(SMUGGLING_TUNNEL_CONFIG.actions.bigShipment.heatAdded * levelEffects.heatMultiplier, 1)} (celkem ${formatDecimalValue(nextHeat, 1)}).` };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.rerouteFlow);
        if (cooldownLeft > 0) return { ok: false, message: `Přesměrování toku je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.rerouteFlowUntil = now + SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.durationMs;
        snapshot.cooldowns.rerouteFlow = now + SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.cooldownMs;
        const levelEffects = getSmugglingTunnelLevelEffects(buildingLevel);
        const nextHeat = applyActionHeat(SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.heatAdded, "Přesměrování toku");
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Přesměrování toku aktivní na ${formatDurationLabel(SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.durationMs)}. Tato budova +25% income, heat +${formatDecimalValue(SMUGGLING_TUNNEL_CONFIG.actions.rerouteFlow.heatAdded * levelEffects.heatMultiplier, 1)} (celkem ${formatDecimalValue(nextHeat, 1)}).` };
      }
    }

    if (type === "street-dealers") {
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.salesBoost);
        if (cooldownLeft > 0) return { ok: false, message: `Boost prodeje je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.salesBoostUntil = now + STREET_DEALERS_CONFIG.actions.salesBoost.durationMs;
        snapshot.cooldowns.salesBoost = now + STREET_DEALERS_CONFIG.actions.salesBoost.cooldownMs;
        const levelEffects = getStreetDealersLevelEffects(buildingLevel);
        const nextHeat = applyActionHeat(STREET_DEALERS_CONFIG.actions.salesBoost.heatAdded, "Boost prodeje");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Boost prodeje aktivní na ${formatDurationLabel(STREET_DEALERS_CONFIG.actions.salesBoost.durationMs)}. `
            + `Income +30%, heat +${formatDecimalValue(STREET_DEALERS_CONFIG.actions.salesBoost.heatAdded * levelEffects.heatMultiplier, 1)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.aggressivePush);
        if (cooldownLeft > 0) return { ok: false, message: `Agresivní push je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.aggressivePushUntil = now + STREET_DEALERS_CONFIG.actions.aggressivePush.durationMs;
        snapshot.cooldowns.aggressivePush = now + STREET_DEALERS_CONFIG.actions.aggressivePush.cooldownMs;
        const levelEffects = getStreetDealersLevelEffects(buildingLevel);
        const nextHeat = applyActionHeat(STREET_DEALERS_CONFIG.actions.aggressivePush.heatAdded, "Agresivní push");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Agresivní push aktivní na ${formatDurationLabel(STREET_DEALERS_CONFIG.actions.aggressivePush.durationMs)}. `
            + `Dirty cash +70%, heat +${formatDecimalValue(STREET_DEALERS_CONFIG.actions.aggressivePush.heatAdded * levelEffects.heatMultiplier, 1)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.territoryExpansion);
        if (cooldownLeft > 0) return { ok: false, message: `Rozšíření rajónu je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.cooldowns.territoryExpansion = now + STREET_DEALERS_CONFIG.actions.territoryExpansion.cooldownMs;
        snapshot.stacks.dealerTerritory = Math.max(0, Math.floor(Number(snapshot.stacks.dealerTerritory || 0))) + 1;
        const stackBonus = snapshot.stacks.dealerTerritory * STREET_DEALERS_CONFIG.actions.territoryExpansion.incomeStackPct;
        const levelEffects = getStreetDealersLevelEffects(buildingLevel);
        const nextHeat = applyActionHeat(STREET_DEALERS_CONFIG.actions.territoryExpansion.heatAdded, "Rozšíření rajónu");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Rozšíření rajónu: stack +1 (celkem ${snapshot.stacks.dealerTerritory}, bonus +${stackBonus}% income). `
            + `Heat +${formatDecimalValue(STREET_DEALERS_CONFIG.actions.territoryExpansion.heatAdded * levelEffects.heatMultiplier, 1)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (type === "strip-club") {
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.vipNight);
        if (cooldownLeft > 0) return { ok: false, message: `VIP noc je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const levelEffects = getStripClubLevelEffects(buildingLevel);
        const hasDouble =
          levelEffects.vipDoubleChancePct > 0
          && Math.random() < (levelEffects.vipDoubleChancePct / 100);
        const vipMultiplier = hasDouble ? 2 : 1;
        snapshot.effects.vipNightUntil = now + STRIP_CLUB_CONFIG.actions.vipNight.durationMs;
        snapshot.effects.vipNightMultiplier = vipMultiplier;
        snapshot.cooldowns.vipNight = now + STRIP_CLUB_CONFIG.actions.vipNight.cooldownMs;
        const nextHeat = applyActionHeat(STRIP_CLUB_CONFIG.actions.vipNight.heatAdded, "VIP noc");
        persistSimpleCashBuildingState(key, snapshot);
        const vipBoostPct =
          (STRIP_CLUB_CONFIG.actions.vipNight.incomeBoostPct + levelEffects.vipExtraBoostPct) * vipMultiplier;
        return {
          ok: true,
          message:
            `VIP noc aktivní na ${formatDurationLabel(STRIP_CLUB_CONFIG.actions.vipNight.durationMs)}. `
            + `Income +${formatDecimalValue(vipBoostPct, 1)}%${hasDouble ? " (2× efekt)" : ""}, `
            + `heat +6 (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.privateServices);
        if (cooldownLeft > 0) return { ok: false, message: `Soukromé služby jsou na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.cooldowns.privateServices = now + STRIP_CLUB_CONFIG.actions.privateServices.cooldownMs;
        payoutDirectBuildingIncome(0, STRIP_CLUB_CONFIG.actions.privateServices.dirtyCashBoost);
        if (typeof addInfluence === "function") {
          addInfluence(STRIP_CLUB_CONFIG.actions.privateServices.influenceBoost);
        }
        const rumorMin = Math.max(0, Math.floor(Number(STRIP_CLUB_CONFIG.actions.privateServices.rumorsMin || 0)));
        const rumorMax = Math.max(rumorMin, Math.floor(Number(STRIP_CLUB_CONFIG.actions.privateServices.rumorsMax || 0)));
        const rumorCount = rumorMin + Math.floor(Math.random() * (rumorMax - rumorMin + 1));
        const rumors = generateRestaurantDistrictGossips(
          district || context?.districtId || null,
          rumorCount,
          now,
          STRIP_CLUB_BUILDING_NAME
        );
        const pushEvent = window.Empire.UI?.pushEvent;
        if (typeof pushEvent === "function") {
          rumors.forEach((rumor) => pushEvent(`Drb: ${rumor.text}`));
        }
        refreshOpenDistrictGossipSection();
        const nextHeat = applyActionHeat(STRIP_CLUB_CONFIG.actions.privateServices.heatAdded, "Soukromé služby");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Soukromé služby: +$${STRIP_CLUB_CONFIG.actions.privateServices.dirtyCashBoost} dirty, `
            + `${rumors.length} drbů, +${STRIP_CLUB_CONFIG.actions.privateServices.influenceBoost} vliv. `
            + `Heat +7 (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.dirtyDeals);
        if (cooldownLeft > 0) return { ok: false, message: `Špinavé dohody jsou na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.dirtyDealsUntil = now + STRIP_CLUB_CONFIG.actions.dirtyDeals.durationMs;
        snapshot.cooldowns.dirtyDeals = now + STRIP_CLUB_CONFIG.actions.dirtyDeals.cooldownMs;
        const nextHeat = applyActionHeat(STRIP_CLUB_CONFIG.actions.dirtyDeals.heatAdded, "Špinavé dohody");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Špinavé dohody aktivní na ${formatDurationLabel(STRIP_CLUB_CONFIG.actions.dirtyDeals.durationMs)}. `
            + `Pouliční dealeři/Pašovací tunel +${STRIP_CLUB_CONFIG.actions.dirtyDeals.targetIncomeBoostPct}% income, `
            + `heat +9 (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (type === "data-center") {
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.playerTracking);
        if (cooldownLeft > 0) return { ok: false, message: `Sledování hráče je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const levelEffects = getDataCenterLevelEffects(buildingLevel);
        const pendingTarget = state.pendingDataCenterTarget;
        const pendingInstanceKey = String(pendingTarget?.instanceKey || "").trim();
        const trackedOwner =
          pendingTarget
          && pendingTarget.actionId === "1"
          && pendingInstanceKey === String(key || "").trim()
          ? String(pendingTarget.selectedDistrictOwner || "").trim()
          : resolveDataCenterTargetOwner(levelEffects);
        if (!trackedOwner) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Nebyl vybrán žádný hráč pro sledování." };
        }
        const intel = buildDataCenterTrackingIntel(trackedOwner, levelEffects);
        snapshot.cooldowns.playerTracking = now + DATA_CENTER_CONFIG.actions.playerTracking.cooldownMs;
        snapshot.dataCenterTrackingOwner = trackedOwner;
        const nextHeat = addPlayerHeatFromBuilding(DATA_CENTER_CONFIG.actions.playerTracking.heatAdded, "Sledování hráče");
        persistSimpleCashBuildingState(key, snapshot);
        const intelLines = [
          `Intel: ${trackedOwner}`,
          `Akce: ${intel.actions.join(" • ") || "bez záznamu"}`,
          `Slabé districty: ${intel.weakDistricts.join(", ") || "nezjištěno"}`,
          `Budovy: ${intel.buildings.join(", ") || "nezjištěno"}`,
          `Sklad: ${intel.stockEstimate}`
        ];
        const pushEvent = window.Empire.UI?.pushEvent;
        if (typeof pushEvent === "function") {
          intelLines.forEach((line) => pushEvent(line));
        }
        return {
          ok: true,
          message:
            `Sledování hráče aktivní: ${trackedOwner}. Získané intel info: ${intel.actions.length} akce. `
            + `Heat +${DATA_CENTER_CONFIG.actions.playerTracking.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.hackIncome);
        if (cooldownLeft > 0) return { ok: false, message: `Hack income je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const levelEffects = getDataCenterLevelEffects(buildingLevel);
        const pendingTarget = state.pendingDataCenterTarget;
        const pendingInstanceKey = String(pendingTarget?.instanceKey || "").trim();
        const selectedDistrictId =
          pendingTarget
          && pendingTarget.actionId === "2"
          && pendingInstanceKey === String(key || "").trim()
          ? String(pendingTarget.selectedDistrictId || "").trim()
          : "";
        const targetDistrict = selectedDistrictId
          ? resolveDistrictRecord(selectedDistrictId)
          : resolveDataCenterTargetDistrict(levelEffects);
        if (!targetDistrict) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Není dostupný žádný nepřátelský distrikt pro hack." };
        }
        snapshot.effects.hackIncomeUntil = now + DATA_CENTER_CONFIG.actions.hackIncome.durationMs;
        snapshot.cooldowns.hackIncome = now + DATA_CENTER_CONFIG.actions.hackIncome.cooldownMs;
        snapshot.dataCenterHackTargetDistrictId = String(targetDistrict.id ?? "").trim();
        const nextHeat = addPlayerHeatFromBuilding(DATA_CENTER_CONFIG.actions.hackIncome.heatAdded, "Hack income");
        persistSimpleCashBuildingState(key, snapshot);
        const baseBoost = Math.max(0, Number(DATA_CENTER_CONFIG.actions.hackIncome.incomeBoostPct || 0));
        const effectiveBoost = baseBoost * levelEffects.hackEffectMultiplier;
        return {
          ok: true,
          message:
            `Hack income aktivní na ${formatDurationLabel(DATA_CENTER_CONFIG.actions.hackIncome.durationMs)} `
            + `z districtu #${resolveDistrictNumberLabel(targetDistrict)} (${targetDistrict.name || "Distrikt"}). `
            + `Income +${formatDecimalValue(effectiveBoost, 2)}%, heat +${DATA_CENTER_CONFIG.actions.hackIncome.heatAdded} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.dataBoost);
        if (cooldownLeft > 0) return { ok: false, message: `Datový boost je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.dataBoostUntil = now + DATA_CENTER_CONFIG.actions.dataBoost.durationMs;
        snapshot.cooldowns.dataBoost = now + DATA_CENTER_CONFIG.actions.dataBoost.cooldownMs;
        applyDataCenterGlobalCooldownReduction(now, DATA_CENTER_CONFIG.actions.dataBoost.cooldownReductionPct);
        const nextHeat = addPlayerHeatFromBuilding(DATA_CENTER_CONFIG.actions.dataBoost.heatAdded, "Datový boost");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Datový boost aktivní na ${formatDurationLabel(DATA_CENTER_CONFIG.actions.dataBoost.durationMs)}. `
            + `Cooldowny akcí -${DATA_CENTER_CONFIG.actions.dataBoost.cooldownReductionPct}%, `
            + `heat +${DATA_CENTER_CONFIG.actions.dataBoost.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (type === "warehouse") {
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.stockpile);
        if (cooldownLeft > 0) return { ok: false, message: `Hromadění zásob je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const levelEffects = getWarehouseLevelEffects(buildingLevel);
        const materialsToGrant =
          Math.max(0, Number(WAREHOUSE_CONFIG.actions.stockpile.randomMaterialsReward || 0))
          + Math.max(0, Number(levelEffects.extraMaterials || 0));
        const reward = grantWarehouseRandomMaterials(materialsToGrant);
        snapshot.cooldowns.stockpile = now + WAREHOUSE_CONFIG.actions.stockpile.cooldownMs;
        snapshot.warehouseLastMaterialsSummary = reward.summary;
        const nextHeat = addPlayerHeatFromBuilding(WAREHOUSE_CONFIG.actions.stockpile.heatAdded, "Hromadění zásob");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Hromadění zásob: +${reward.total} materiálů (${reward.summary}). `
            + `Heat +${WAREHOUSE_CONFIG.actions.stockpile.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.quickDistribution);
        if (cooldownLeft > 0) return { ok: false, message: `Rychlá distribuce je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.quickDistributionUntil = now + WAREHOUSE_CONFIG.actions.quickDistribution.durationMs;
        snapshot.cooldowns.quickDistribution = now + WAREHOUSE_CONFIG.actions.quickDistribution.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(WAREHOUSE_CONFIG.actions.quickDistribution.heatAdded, "Rychlá distribuce");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Rychlá distribuce aktivní na ${formatDurationLabel(WAREHOUSE_CONFIG.actions.quickDistribution.durationMs)}. `
            + `Efekt akcí v jiných budovách +${WAREHOUSE_CONFIG.actions.quickDistribution.actionsEffectBoostPct}%, `
            + `heat +${WAREHOUSE_CONFIG.actions.quickDistribution.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.hiddenStorage);
        if (cooldownLeft > 0) return { ok: false, message: `Skrytý sklad je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.hiddenStorageUntil = now + WAREHOUSE_CONFIG.actions.hiddenStorage.durationMs;
        snapshot.cooldowns.hiddenStorage = now + WAREHOUSE_CONFIG.actions.hiddenStorage.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(WAREHOUSE_CONFIG.actions.hiddenStorage.heatAdded, "Skrytý sklad");
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Skrytý sklad aktivní na ${formatDurationLabel(WAREHOUSE_CONFIG.actions.hiddenStorage.durationMs)}. `
            + `Razie má nižší účinnost proti ztrátě zdrojů, heat +${WAREHOUSE_CONFIG.actions.hiddenStorage.heatAdded} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (type === "research-center") {
      const levelEffects = getResearchCenterLevelEffects(buildingLevel);
      const actionMultiplier = Math.max(1, Number(levelEffects.actionsEffectMultiplier || 1));
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.optimizeProduction);
        if (cooldownLeft > 0) return { ok: false, message: `Optimalizace výroby je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.optimizeProductionUntil = now + RESEARCH_CENTER_CONFIG.actions.optimizeProduction.durationMs;
        snapshot.cooldowns.optimizeProduction = now + RESEARCH_CENTER_CONFIG.actions.optimizeProduction.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(RESEARCH_CENTER_CONFIG.actions.optimizeProduction.heatAdded, "Optimalizace výroby");
        persistSimpleCashBuildingState(key, snapshot);
        const effectivePct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.optimizeProduction.factoryArmorySpeedBoostPct || 0))
          * actionMultiplier;
        return {
          ok: true,
          message:
            `Optimalizace výroby aktivní na ${formatDurationLabel(RESEARCH_CENTER_CONFIG.actions.optimizeProduction.durationMs)}. `
            + `Továrna/Zbrojovka +${formatDecimalValue(effectivePct, 2)}% rychlost produkce, `
            + `heat +${RESEARCH_CENTER_CONFIG.actions.optimizeProduction.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.experimentalSeries);
        if (cooldownLeft > 0) return { ok: false, message: `Experimentální série je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.cooldowns.experimentalSeries = now + RESEARCH_CENTER_CONFIG.actions.experimentalSeries.cooldownMs;
        const didFail = Math.random() < (Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.experimentalSeries.failChancePct || 0)) / 100);
        if (didFail) {
          snapshot.researchLastExperimentFailedAt = now;
        } else {
          snapshot.effects.experimentalSeriesUntil = now + RESEARCH_CENTER_CONFIG.actions.experimentalSeries.durationMs;
        }
        const nextHeat = addPlayerHeatFromBuilding(RESEARCH_CENTER_CONFIG.actions.experimentalSeries.heatAdded, "Experimentální série");
        persistSimpleCashBuildingState(key, snapshot);
        if (didFail) {
          return {
            ok: true,
            message:
              `Experimentální série selhala (žádný efekt). Heat +${RESEARCH_CENTER_CONFIG.actions.experimentalSeries.heatAdded} `
              + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
          };
        }
        const effectivePct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.experimentalSeries.factoryArmoryProductionBoostPct || 0))
          * actionMultiplier;
        return {
          ok: true,
          message:
            `Experimentální série aktivní na ${formatDurationLabel(RESEARCH_CENTER_CONFIG.actions.experimentalSeries.durationMs)}. `
            + `Továrna/Zbrojovka +${formatDecimalValue(effectivePct, 2)}% produkce, `
            + `heat +${RESEARCH_CENTER_CONFIG.actions.experimentalSeries.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.technologyUpgrade);
        if (cooldownLeft > 0) return { ok: false, message: `Technologický upgrade je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        snapshot.effects.technologyUpgradeUntil = now + RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.durationMs;
        snapshot.cooldowns.technologyUpgrade = now + RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.heatAdded, "Technologický upgrade");
        persistSimpleCashBuildingState(key, snapshot);
        const effectiveReductionPct =
          Math.max(0, Number(RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.armoryDrugLabTimeReductionPct || 0))
          * actionMultiplier;
        return {
          ok: true,
          message:
            `Technologický upgrade aktivní na ${formatDurationLabel(RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.durationMs)}. `
            + `Drug lab/Zbrojovka -${formatDecimalValue(effectiveReductionPct, 2)}% výrobní čas, `
            + `heat +${RESEARCH_CENTER_CONFIG.actions.technologyUpgrade.heatAdded} (celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (type === "recycling-center") {
      const levelEffects = getRecyclingCenterLevelEffects(buildingLevel);
      if (actionId === "1") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.processWaste);
        if (cooldownLeft > 0) return { ok: false, message: `Zpracování odpadu je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const rewardCount =
          Math.max(0, Number(RECYCLING_CENTER_CONFIG.actions.processWaste.randomMaterialsReward || 0))
          + Math.max(0, Number(levelEffects.extraWasteMaterials || 0));
        const reward = grantRecyclingRandomMaterials(rewardCount);
        snapshot.cooldowns.processWaste = now + RECYCLING_CENTER_CONFIG.actions.processWaste.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(
          RECYCLING_CENTER_CONFIG.actions.processWaste.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)),
          "Zpracování odpadu"
        );
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Zpracování odpadu: +${reward.total} materiálů (${reward.summary}). `
            + `Heat +${formatDecimalValue(RECYCLING_CENTER_CONFIG.actions.processWaste.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)), 2)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "2") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.breakShipment);
        if (cooldownLeft > 0) return { ok: false, message: `Rozborka zásilky je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const playerState = getDrugLabPlayerSnapshot();
        playerState.labSupplies = createDrugLabSupplyMap(playerState.labSupplies || {});
        playerState.labSupplies.chemicals = Math.max(
          0,
          Math.floor(Number(playerState.labSupplies.chemicals || 0) + RECYCLING_CENTER_CONFIG.actions.breakShipment.chemicalsReward)
        );
        persistDrugLabPlayerSnapshot(playerState);
        const factorySupplies = createFactoryPlayerSupplyMap(getFactoryPlayerSuppliesSnapshot());
        factorySupplies.metalParts = Math.max(
          0,
          Math.floor(Number(factorySupplies.metalParts || 0) + RECYCLING_CENTER_CONFIG.actions.breakShipment.metalPartsReward)
        );
        persistFactoryPlayerSuppliesSnapshot(factorySupplies);
        snapshot.cooldowns.breakShipment = now + RECYCLING_CENTER_CONFIG.actions.breakShipment.cooldownMs;
        const nextHeat = addPlayerHeatFromBuilding(
          RECYCLING_CENTER_CONFIG.actions.breakShipment.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)),
          "Rozborka zásilky"
        );
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Rozborka zásilky: +${RECYCLING_CENTER_CONFIG.actions.breakShipment.chemicalsReward} Chemicals, `
            + `+${RECYCLING_CENTER_CONFIG.actions.breakShipment.metalPartsReward} Metal Parts. `
            + `Heat +${formatDecimalValue(RECYCLING_CENTER_CONFIG.actions.breakShipment.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)), 2)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
      if (actionId === "3") {
        const cooldownLeft = toCooldownLeft(snapshot.cooldowns.emergencyRecovery);
        if (cooldownLeft > 0) return { ok: false, message: `Nouzová obnova je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
        const latestImpact = resolveLatestPoliceRaidImpactRecord();
        const plan = buildRecyclingEmergencyRecoveryPlan(latestImpact, levelEffects.emergencyRestorePct);
        if (!plan) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Nenalezen záznam o poslední policejní razii." };
        }
        const summary = formatRecyclingRecoveryPlanSummary(plan);
        const impactDate = plan.impactStartedAt > 0 ? new Date(plan.impactStartedAt).toLocaleString("cs-CZ") : "neznámý čas";
        const confirmed = window.confirm(
          `Nouzová obnova vrátí ${formatDecimalValue(plan.restorePct, 0)}% z poslední razie (${impactDate}).\n\n`
          + `${summary}\n\nPotvrdit akci?`
        );
        if (!confirmed) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Nouzová obnova zrušena." };
        }
        applyRecyclingRecoveryPlan(plan);
        snapshot.cooldowns.emergencyRecovery = now + RECYCLING_CENTER_CONFIG.actions.emergencyRecovery.cooldownMs;
        snapshot.recyclingLastRecoveryAt = now;
        const nextHeat = addPlayerHeatFromBuilding(
          RECYCLING_CENTER_CONFIG.actions.emergencyRecovery.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)),
          "Nouzová obnova"
        );
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Nouzová obnova provedena (${formatDecimalValue(plan.restorePct, 0)}%): ${summary}. `
            + `Heat +${formatDecimalValue(RECYCLING_CENTER_CONFIG.actions.emergencyRecovery.heatAdded * Math.max(0, Number(levelEffects.heatMultiplier || 1)), 2)} `
            + `(celkem ${formatDecimalValue(nextHeat, 1)}).`
        };
      }
    }

    if (actionId === "upgrade") {
      if (type === "smuggling-tunnel") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > SMUGGLING_TUNNEL_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Pašovací tunel je na maximálním levelu." };
        }
        const totalCost = Math.max(0, Number(SMUGGLING_TUNNEL_CONFIG.upgradeCosts[nextLevel] || 0));
        const spendResult = trySpendWithCleanDirtySplit(totalCost, 0.8);
        if (!spendResult.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return {
            ok: false,
            message:
              `Nedostatek prostředků na upgrade (potřeba C $${spendResult.cleanCost || 0} + D $${spendResult.dirtyCost || 0}).`
          };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Pašovací tunel vylepšen na L${nextLevel} za C $${spendResult.cleanCost} + D $${spendResult.dirtyCost}.`
        };
      }
      if (type === "street-dealers") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > STREET_DEALERS_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Pouliční dealeři jsou na maximálním levelu." };
        }
        const cost = Math.max(0, Number(STREET_DEALERS_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        const levelEffects = getStreetDealersLevelEffects(nextLevel);
        const spyReward = grantInstantSpyReward(levelEffects.spyReward);
        persistSimpleCashBuildingState(key, snapshot);
        return {
          ok: true,
          message:
            `Pouliční dealeři vylepšeni na L${nextLevel} za $${cost}`
            + (spyReward > 0 ? ` • +${spyReward} špeh.` : ".")
        };
      }
      if (type === "strip-club") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > STRIP_CLUB_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Strip club je na maximálním levelu." };
        }
        const cost = Math.max(0, Number(STRIP_CLUB_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Strip club vylepšen na L${nextLevel} za $${cost}.` };
      }
      if (type === "data-center") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > DATA_CENTER_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Datové centrum je na maximálním levelu." };
        }
        const cost = Math.max(0, Number(DATA_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Datové centrum vylepšeno na L${nextLevel} za $${cost}.` };
      }
      if (type === "warehouse") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > WAREHOUSE_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Sklad je na maximálním levelu." };
        }
        const cost = Math.max(0, Number(WAREHOUSE_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Sklad vylepšen na L${nextLevel} za $${cost}.` };
      }
      if (type === "research-center") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > RESEARCH_CENTER_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Výzkumné centrum je na maximálním levelu." };
        }
        const cost = Math.max(0, Number(RESEARCH_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Výzkumné centrum vylepšeno na L${nextLevel} za $${cost}.` };
      }
      if (type === "recycling-center") {
        const nextLevel = buildingLevel + 1;
        if (nextLevel > RECYCLING_CENTER_CONFIG.maxLevel) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Recyklační centrum je na maximálním levelu." };
        }
        const cost = Math.max(0, Number(RECYCLING_CENTER_CONFIG.upgradeCosts[nextLevel] || 0));
        const spend = window.Empire.UI?.trySpendCleanCash;
        if (typeof spend !== "function") {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: "Upgrade nelze provést: chybí ekonomický modul." };
        }
        const spendResult = spend(cost);
        if (!spendResult?.ok) {
          persistSimpleCashBuildingState(key, snapshot);
          return { ok: false, message: `Nedostatek cash na upgrade (potřeba $${cost}).` };
        }
        snapshot.level = nextLevel;
        persistSimpleCashBuildingState(key, snapshot);
        return { ok: true, message: `Recyklační centrum vylepšeno na L${nextLevel} za $${cost}.` };
      }
      persistSimpleCashBuildingState(key, snapshot);
      return { ok: false, message: `${context?.baseName || "Budova"}: Upgrade bude doplněn později.` };
    }

    persistSimpleCashBuildingState(key, snapshot);
    return { ok: false, message: `${context?.baseName || "Budova"}: Neznámá akce.` };
  }

  function resolveSimpleCashBuildingDetails(context, district, fallback, cashProfile) {
    const specialDetails = resolveParkSpecialBuildingDetails(context, district, fallback, cashProfile);
    if (specialDetails) return specialDetails;
    const now = Date.now();
    const key = resolveBuildingInstanceKey(context, district);
    const snapshot = getSimpleCashBuildingStateByKey(key, now);
    const syncResult = syncSimpleCashBuildingIncome(
      snapshot,
      cashProfile,
      now,
      district || context?.districtId
    );
    persistSimpleCashBuildingState(key, snapshot);
    const hourlyCleanIncome = Number(syncResult?.rates?.hourlyCleanIncome || cashProfile?.hourlyCleanIncome || 0);
    const hourlyDirtyIncome = Number(syncResult?.rates?.hourlyDirtyIncome || cashProfile?.hourlyDirtyIncome || 0);
    const hourlyIncome = hourlyCleanIncome + hourlyDirtyIncome;
    return {
      ...fallback,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome: hourlyIncome * 24
    };
  }

  function resolveBuildingDetails(buildingName, district) {
    const context = resolveBuildingDetailContext(buildingName);
    const safeName = context.baseName;
    const displayName = context.variantName || safeName;
    const districtSeed = district?.id || 0;
    const seed = hashOwner(`${districtSeed}:${safeName}:${context.variantName || ""}`);
    const mallProfiles = {
      "Neon Mall": {
        hourlyIncome: 612,
        info:
          "Neon Mall je high-volume retail uzel. Rychle točí hotovost a zvyšuje tempo příjmů v komerční zóně."
      },
      "Iron Market Plaza": {
        hourlyIncome: 576,
        info:
          "Iron Market Plaza je těžký tržní hub. Má stabilní výnos a bonus pro obchodní operace v širším okolí."
      },
      "Karina shopping center": {
        hourlyIncome: 648,
        info:
          "Karina shopping center je prémiové obchodní centrum s nejvyšším obratem. Je silné na dlouhodobý ekonomický tlak."
      }
    };
    const restaurantProfiles = {
      "Neon Bite": {
        hourlyIncome: 286,
        info: "Rychlá neonová kuchyně. Zvyšuje noční cashflow a pomáhá držet tlak na soupeře."
      },
      "Black Plate": {
        hourlyIncome: 278,
        info: "High-risk gastro front. Vhodné pro tiché praní menších částek při stabilní kontrole."
      },
      "Street Fuel": {
        hourlyIncome: 264,
        info: "Jídlo pro pouliční týmy. Posiluje operativu v okolních sektorech během konfliktu."
      },
      "Blood & Grill": {
        hourlyIncome: 298,
        info: "Agresivní grill point. Přináší vyšší příjem, ale přitahuje větší pozornost."
      },
      "Midnight Diner": {
        hourlyIncome: 272,
        info: "Noční diner s dlouhou provozní dobou. Stabilní income i mimo hlavní špičku."
      },
      "Iron Taste": {
        hourlyIncome: 266,
        info: "Tvrdý industriální styl. Dobře funguje v zónách s častým pohybem posil."
      },
      "Shadow Kitchen": {
        hourlyIncome: 281,
        info: "Skrytá kuchyně pro interní síť. Vhodná pro nenápadný růst vlivu."
      },
      "Dirty Spoon": {
        hourlyIncome: 252,
        info: "Levná frontová kuchyně. Nižší výnos, ale rychlá a spolehlivá rotace peněz."
      },
      "Vice Kitchen": {
        hourlyIncome: 294,
        info: "Silně napojená na noční trh. Zvyšuje obrat v rizikových časech."
      },
      "Urban Hunger": {
        hourlyIncome: 260,
        info: "Městský fast servis. Udržuje stabilní tok zákazníků celý den."
      },
      "Smoke & Meat": {
        hourlyIncome: 288,
        info: "Prémiový smokehouse. Vyšší marže a lepší efekt při dlouhodobém držení sektoru."
      },
      "The Last Bite": {
        hourlyIncome: 257,
        info: "Pozdní provoz pro poslední vlnu klientů. Dobré doplnění ekonomiky distriktu."
      },
      "Gangster Grill": {
        hourlyIncome: 301,
        info: "Silný brand pod kontrolou gangu. Roste rychleji, když je zóna bezpečná."
      },
      "Concrete Kitchen": {
        hourlyIncome: 269,
        info: "Betonový core point. Stabilní příjmy s nízkou volatilitou."
      },
      "Dark Appetite": {
        hourlyIncome: 284,
        info: "Noir restaurace pro VIP kontakty. Pomáhá budovat vliv mezi klíčovými lidmi."
      },
      "Night Feast": {
        hourlyIncome: 276,
        info: "Noční hostiny a eventy. Krátké špičky s výraznějším výdělkem."
      },
      "The Hungry Syndicate": {
        hourlyIncome: 305,
        info: "Syndikátní jídelní uzel. Výborný výkon při propojení více commercial sektorů."
      },
      "Rusty Fork": {
        hourlyIncome: 249,
        info: "Starší podnik s loajální klientelou. Pomalejší, ale velmi stabilní cashflow."
      },
      "Back Alley Bistro": {
        hourlyIncome: 262,
        info: "Bistro v zadních uličkách. Výhodné pro skrytý provoz bez velké publicity."
      },
      "Sinful Kitchen": {
        hourlyIncome: 292,
        info: "Rizikový nightlife spot. Umí tahat vyšší příjmy za cenu většího napětí."
      },
      "Underground Taste": {
        hourlyIncome: 274,
        info: "Podzemní kulinářská síť. Podporuje ekonomiku v konfliktních oblastech."
      },
      "Savage Kitchen": {
        hourlyIncome: 297,
        info: "Tvrdý street koncept. Silný výnos během agresivní expanze."
      },
      "Chrome Diner": {
        hourlyIncome: 267,
        info: "Chromový diner nové generace. Konzistentní příjem s dobrým poměrem rizika."
      },
      "Heat Kitchen": {
        hourlyIncome: 289,
        info: "Horká kuchyně s rychlým obratem. Funguje nejlépe při aktivním trhu."
      },
      "No Mercy Meals": {
        hourlyIncome: 303,
        info: "Bezkompromisní provozní model. Vysoký potenciál výdělku pro ofenzivní hru."
      },
      "Broken Plate": {
        hourlyIncome: 255,
        info: "Low-profile spot. Menší výnos, ale výborná odolnost při výkyvech."
      },
      "Elite Hunger": {
        hourlyIncome: 312,
        info: "Elitní koncept pro horní vrstvu města. Nejvyšší restauranční obrat v síti."
      }
    };
    const activeSpecialProfile =
      context.variantName && safeName === "Obchodní centrum"
        ? mallProfiles[context.variantName] || null
        : context.variantName && safeName === "Restaurace"
          ? restaurantProfiles[context.variantName] || null
          : null;
    const simpleCashProfile = SIMPLE_BUILDING_CASH_RATES[safeName] || null;
    const hourlyCleanIncome = simpleCashProfile
      ? simpleCashProfile.hourlyCleanIncome
      : activeSpecialProfile?.hourlyIncome || 0;
    const hourlyDirtyIncome = simpleCashProfile
      ? simpleCashProfile.hourlyDirtyIncome
      : activeSpecialProfile?.hourlyDirtyIncome || 0;
    const hourlyIncome = simpleCashProfile
      ? hourlyCleanIncome + hourlyDirtyIncome
      : activeSpecialProfile
        ? activeSpecialProfile.hourlyIncome
        : 60 + (seed % 31) * 12;
    const dailyIncome = hourlyIncome * 24;
    const infoSamples = [
      "Tahle budova drží lokální cashflow a pomáhá stabilizovat kontrolu sektoru při dlouhých konfliktech.",
      "Budova funguje jako logistický uzel. Je vhodná pro podporu útoku i obrany podle aktuální situace.",
      "Poskytuje operativní zázemí pro lidi v terénu, takže zvyšuje efektivitu gangových aktivit v okolí.",
      "Je to strategický bod pro ekonomiku distriktu. V pozdější fázi hry může výrazně zvednout výnosy.",
      "Budova je vhodná pro tichý růst vlivu. Největší přínos má při držení sektoru delší dobu."
    ];
    const info = activeSpecialProfile?.info || infoSamples[seed % infoSamples.length];
    const fallbackDetails = {
      baseName: safeName,
      displayName,
      hourlyCleanIncome,
      hourlyDirtyIncome,
      hourlyIncome,
      dailyIncome,
      info,
      specialActions: []
    };
    if (simpleCashProfile) {
      return resolveSimpleCashBuildingDetails(context, district, fallbackDetails, simpleCashProfile);
    }
    if (safeName === APARTMENT_BLOCK_NAME) {
      return resolveApartmentBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === SCHOOL_BUILDING_NAME) {
      return resolveSchoolBuildingDetails(context, district, fallbackDetails);
    }
    if (isFitnessClubBaseName(safeName)) {
      return resolveFitnessBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === CASINO_BUILDING_NAME || isCasinoBaseName(safeName)) {
      return resolveCasinoBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === ARCADE_BUILDING_NAME || isArcadeBaseName(safeName)) {
      return resolveArcadeBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === AUTO_SALON_BUILDING_NAME || isAutoSalonBaseName(safeName)) {
      return resolveAutoSalonBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === EXCHANGE_BUILDING_NAME || isExchangeBaseName(safeName)) {
      return resolveExchangeBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === RESTAURANT_BUILDING_NAME || isRestaurantBaseName(safeName)) {
      return resolveRestaurantBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === CONVENIENCE_STORE_BUILDING_NAME || isConvenienceStoreBaseName(safeName)) {
      return resolveConvenienceStoreBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === ARMORY_BUILDING_NAME || isArmoryBaseName(safeName)) {
      return resolveArmoryBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === FACTORY_BUILDING_NAME || isFactoryBaseName(safeName)) {
      return resolveFactoryBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === PHARMACY_BUILDING_NAME || isPharmacyBaseName(safeName)) {
      return resolvePharmacyBuildingDetails(context, district, fallbackDetails);
    }
    if (safeName === DRUG_LAB_BUILDING_NAME || isDrugLabBaseName(safeName)) {
      return resolveDrugLabBuildingDetails(context, district, fallbackDetails);
    }
    return fallbackDetails;
  }

  function showModal(district) {
    if (!state.modal?.root) return;
    const districtKey = normalizeDistrictId(district?.id);
    const activeAttackMarker = districtKey ? state.attackedDistricts.get(districtKey) : null;
    if (activeAttackMarker && Number(activeAttackMarker.expiresAt || 0) > Date.now()) {
      hideModal();
      window.Empire.UI?.openDistrictAttackInProgressModal?.(district, activeAttackMarker);
      return;
    }
    const activePoliceAction = districtKey ? state.policeDistrictActions.get(districtKey) : null;
    if (activePoliceAction && Number(activePoliceAction.expiresAt || 0) > Date.now()) {
      hideModal();
      window.Empire.UI?.openDistrictPoliceRaidWarningModal?.(district, activePoliceAction);
      return;
    }
    const defendableByPlayer = isDistrictDefendable(district);
    const isDowntown = district.type === "downtown";
    const districtNumber = resolveDistrictNumberLabel(district);
    const isEnemyDistrict = isEnemyOwnedDistrictForModal(district);
    const revealEnemyIntelInFog = state.vision.fogPreviewMode
      && state.vision.allowEnemyModalIntelInFog
      && isEnemyDistrict;
    const revealDistrictDetails = !state.vision.fogPreviewMode || defendableByPlayer || revealEnemyIntelInFog;
    const spyIntel = window.Empire.UI?.getDistrictSpyIntel?.(district?.id) || null;
    const hasSpyIntel = Boolean(spyIntel);
    const spyKnownFields = spyIntel?.knownFields && typeof spyIntel.knownFields === "object"
      ? spyIntel.knownFields
      : {};
    const hasDistrictTypeIntel = Boolean(spyKnownFields.districtType);
    applyDistrictModalAccent(district);
    updateModalActionsForDistrict(district);
    updateDistrictRaidLockRow(district);

    if (isDistrictDestroyed(district)) {
      document.getElementById("modal-name").textContent = district.name || "Distrikt";
      document.getElementById("modal-name-income").textContent = "V piči, zničen.";
      document.getElementById("modal-owner").textContent = "Nikdo";
      updateDistrictDefenseSummary(null, { spyIntel });
      updateDistrictBuildings(null, { spyIntel });
      updateDistrictGossip(district);
      updateDistrictOwnerProfile(district, { visible: false, spyIntel });
      state.modal.root.classList.remove("hidden");
      startDistrictModalRefreshTicker();
      return;
    }

    if (revealDistrictDetails) {
      document.getElementById("modal-name").textContent = district.name || "Distrikt";
      document.getElementById("modal-name-income").textContent = isEnemyDistrict ? "Skryto" : `$${district.income || 0}/hod`;
      document.getElementById("modal-owner").textContent = district.owner || "Neobsazeno";
      updateDistrictBuildings(defendableByPlayer ? district : null, { spyIntel });
      updateDistrictGossip(district);
    } else {
      document.getElementById("modal-name").textContent = hasDistrictTypeIntel
        ? (district.name || `District č. ${districtNumber}`)
        : `District č. ${districtNumber}`;
      document.getElementById("modal-name-income").textContent = "Skryto";
      document.getElementById("modal-owner").textContent = "Skryto";
      updateDistrictDefenseSummary(null, { spyIntel });
      updateDistrictBuildings(null, { spyIntel });
      updateDistrictGossip(district);
    }

    if (revealDistrictDetails) {
      updateDistrictDefenseSummary(district, {
        knownSelf: defendableByPlayer,
        knownAlly: defendableByPlayer,
        spyIntel
      });
    } else if (hasSpyIntel) {
      updateDistrictDefenseSummary(null, { spyIntel });
    }

    updateDistrictOwnerProfile(district, {
      visible: revealDistrictDetails,
      isEnemy: isEnemyDistrict,
      spyIntel
    });
    state.modal.root.classList.remove("hidden");
    startDistrictModalRefreshTicker();
    document.dispatchEvent(new CustomEvent("empire:district-modal-opened", {
      detail: {
        districtId: district?.id ?? null,
        district,
        revealDistrictDetails,
        spyIntel
      }
    }));
  }

  function isEnemyOwnedDistrictForModal(district) {
    if (!district?.owner) return false;
    if (isDistrictOwnedByPlayer(district)) return false;
    if (isDistrictOwnedByAlly(district)) return false;
    return true;
  }

  function resolveDistrictOwnerAvatar(district) {
    const explicitAvatar = String(district?.ownerAvatar || "").trim();
    if (explicitAvatar) return explicitAvatar;
    if (!districtOwnerAvatarPool.length) return "";
    const seedSource = String(district?.ownerPlayerId || district?.ownerNick || district?.owner || "")
      .trim()
      .toLowerCase();
    if (!seedSource) return districtOwnerAvatarPool[0];
    const avatarIndex = hashOwner(seedSource) % districtOwnerAvatarPool.length;
    return districtOwnerAvatarPool[avatarIndex];
  }

  function resolveDistrictAtmosphereImage(district, isEnemy = false) {
    if (isEnemy) return "";
    const type = String(district?.type || "").trim().toLowerCase();
    const imageSets = {
      park: parkImages,
      downtown: downtownImages,
      commercial: commercialImages,
      residential: residentialImages,
      industrial: industrialImages
    };
    const set = imageSets[type];
    if (!Array.isArray(set) || !set.length) return "";
    const overrideKey = `${type}:${district?.id}`;
    const overrideImages = districtImageOverrides[overrideKey];
    if (Array.isArray(overrideImages) && overrideImages.length) {
      return overrideImages[0] || "";
    }
    const seedSource = typeof district?.id === "number"
      ? district.id
      : String(district?.id || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return set[seedSource % set.length] || "";
  }

  function resolveDistrictFactionLabel(district, isEnemy = false) {
    if (isEnemy) return "Neznámá";
    const explicit = String(
      district?.ownerStructure ||
      district?.ownerFaction ||
      district?.owner_structure ||
      district?.owner_faction ||
      ""
    ).trim();
    return explicit || "Neznámá";
  }

  function deriveAllianceNameFromOwnerLabel(ownerLabel) {
    const raw = String(ownerLabel || "").trim();
    if (!raw) return "";
    const withoutIndex = raw.replace(/\s+\d+$/u, "").trim();
    const allyMatch = withoutIndex.match(/^(.*?)\s*-\s*spojenec(?:\s+[A-Z])?$/iu);
    if (allyMatch?.[1]) return String(allyMatch[1]).trim();
    if (withoutIndex && withoutIndex !== raw) return withoutIndex;
    return "";
  }

  function updateDistrictOwnerProfile(district, options = {}) {
    const visible = typeof options === "object" ? Boolean(options.visible) : Boolean(options);
    const isEnemy = typeof options === "object" ? Boolean(options.isEnemy) : false;
    const spyIntel = typeof options === "object" ? options.spyIntel || null : null;
    const content = state.modal?.root?.querySelector(".modal__content");
    const ownerValue = document.getElementById("modal-owner");
    const ownerRow = ownerValue?.closest(".modal__row") || null;
    const ownerLabel = ownerRow?.querySelector("span") || null;
    const allianceRow = document.getElementById("modal-owner-alliance-row");
    const allianceValue = document.getElementById("modal-owner-alliance");
    const allianceLabel = allianceRow?.querySelector("span") || null;
    const factionRow = document.getElementById("modal-owner-faction-row");
    const factionValue = document.getElementById("modal-owner-faction");
    const factionLabelNode = factionRow?.querySelector("span") || null;
    const atmosphereRow = document.getElementById("modal-owner-atmosphere-row");
    const atmosphereValue = document.getElementById("modal-owner-atmosphere");
    const atmosphereImage = document.getElementById("modal-owner-atmosphere-image");
    if (!content || !ownerValue || !allianceRow || !allianceValue || !factionRow || !factionValue || !atmosphereRow || !atmosphereValue || !atmosphereImage) return;

    content.classList.toggle("district-modal--spy-intel-compact", !visible && Boolean(spyIntel));
    if (ownerLabel) ownerLabel.textContent = "Vlastník";
    if (allianceLabel) allianceLabel.textContent = "Aliance";
    if (factionLabelNode) factionLabelNode.textContent = "Frakce";

    if (!visible && !spyIntel) {
      allianceRow.classList.add("hidden");
      factionRow.classList.add("hidden");
      atmosphereRow.classList.add("hidden");
      content.classList.remove("district-modal--unowned");
      allianceValue.textContent = "Bez aliance";
      factionValue.textContent = "Neznámá";
      atmosphereValue.textContent = "Neznámá";
      atmosphereImage.removeAttribute("src");
      atmosphereImage.removeAttribute("data-district-name");
      atmosphereImage.removeAttribute("data-district-type");
      atmosphereImage.removeAttribute("data-district-owner");
      atmosphereImage.classList.add("hidden");
      atmosphereValue.classList.remove("hidden");
      content.classList.remove("district-owner-bg-active");
      content.style.setProperty("--district-owner-avatar-url", "none");
      content.style.setProperty("--district-owner-avatar-opacity", "0");
      return;
    }

    const useSpyOnlyIntel = !visible && Boolean(spyIntel);
    const hasNoOwner = !district?.owner;
    const explicitOwnerNick = String(district?.ownerNick || "").trim();
    const explicitOwnerAlliance = String(district?.ownerAllianceName || "").trim();
    const fallbackOwnerNick = String(district?.owner || "Neznámý");
    const fallbackAllianceName = deriveAllianceNameFromOwnerLabel(district?.owner);
    const ownerNick = useSpyOnlyIntel
      ? (hasNoOwner ? "Prázdné" : "Skryto")
      : (explicitOwnerNick || fallbackOwnerNick);
    const ownerAlliance = useSpyOnlyIntel
      ? (hasNoOwner ? "Prázdné" : "Skryto")
      : (explicitOwnerAlliance || fallbackAllianceName || "Bez aliance");
    const avatarSrc = useSpyOnlyIntel ? "" : resolveDistrictOwnerAvatar(district);
    const spyKnownFields = spyIntel?.knownFields && typeof spyIntel.knownFields === "object"
      ? spyIntel.knownFields
      : {};
    const factionLabel = useSpyOnlyIntel
      ? `Typ: ${spyKnownFields.districtType === false ? "Nezjištěno" : (String(spyIntel?.districtType || "").trim() || "Neznámý")}`
      : resolveDistrictFactionLabel(district, isEnemy);
    const atmosphereLabel = spyKnownFields.atmosphere === false
      ? "Nezjištěno"
      : String(spyIntel?.atmosphere || "").trim();
    const atmosphereSrc = useSpyOnlyIntel ? "" : resolveDistrictAtmosphereImage(district, isEnemy);
    content.classList.toggle("district-modal--unowned", !useSpyOnlyIntel && hasNoOwner);

    ownerValue.textContent = ownerNick;
    allianceValue.textContent = ownerAlliance;
    factionValue.textContent = factionLabel;
    atmosphereValue.textContent = atmosphereSrc
      ? ""
      : (atmosphereLabel || "Neznámá");
    atmosphereValue.classList.toggle(
      "modal__nowrap-value",
      !atmosphereSrc && /^(neznámá|nezjištěno)$/iu.test(String(atmosphereValue.textContent || "").trim())
    );
    allianceRow.classList.remove("hidden");
    factionRow.classList.remove("hidden");
    atmosphereRow.classList.toggle("hidden", useSpyOnlyIntel);
    content.classList.toggle("district-owner-bg-active", !useSpyOnlyIntel);
    if (useSpyOnlyIntel && hasNoOwner) {
      if (ownerLabel) ownerLabel.textContent = "Aliance / Vlastník";
      ownerValue.textContent = "Prázdné";
      allianceRow.classList.add("hidden");
    } else if (useSpyOnlyIntel) {
      if (ownerLabel) ownerLabel.textContent = "Vlastník";
      if (allianceLabel) allianceLabel.textContent = "Aliance";
    }
    if (useSpyOnlyIntel && factionLabelNode) {
      factionLabelNode.textContent = "Typ distriktu";
    }
    if (atmosphereSrc) {
      atmosphereImage.src = atmosphereSrc;
      atmosphereImage.dataset.districtName = district?.name || `Distrikt ${resolveDistrictNumberLabel(district)}`;
      atmosphereImage.dataset.districtType = String(district?.type || "-");
      atmosphereImage.dataset.districtOwner = ownerNick;
      atmosphereImage.classList.remove("hidden");
      atmosphereValue.classList.add("hidden");
    } else {
      atmosphereImage.removeAttribute("src");
      atmosphereImage.removeAttribute("data-district-name");
      atmosphereImage.removeAttribute("data-district-type");
      atmosphereImage.removeAttribute("data-district-owner");
      atmosphereImage.classList.add("hidden");
      atmosphereValue.classList.remove("hidden");
    }

    if (!avatarSrc) {
      content.style.setProperty("--district-owner-avatar-url", "none");
      content.style.setProperty("--district-owner-avatar-opacity", "0");
      return;
    }

    const safeAvatar = avatarSrc
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"");
    content.style.setProperty("--district-owner-avatar-url", `url("${safeAvatar}")`);
    content.style.setProperty("--district-owner-avatar-opacity", "0.98");
  }

  function formatDistrictDefenseSummary(entry) {
    if (!entry || !entry.hasData) return "";
    const weapons = Math.max(0, Math.floor(Number(entry.weapons) || 0));
    const members = Math.max(0, Math.floor(Number(entry.members) || 0));
    const power = Math.max(0, Math.floor(Number(entry.power) || 0));
    return `Zbraně: ${weapons} • Lidé: ${members} • Síla: ${power}`;
  }

  function formatDistrictRaidLockLabel(ms) {
    const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (hours > 0 || minutes > 0) {
      parts.push(`${String(minutes).padStart(hours > 0 ? 2 : 1, "0")}m`);
    }
    parts.push(`${String(seconds).padStart(hours > 0 || minutes > 0 ? 2 : 1, "0")}s`);
    return parts.join(" ");
  }

  function updateDistrictRaidLockRow(district) {
    const row = document.getElementById("modal-raid-lock-row");
    const value = document.getElementById("modal-raid-lock");
    if (!row || !value) return;
    const remainingMs = window.Empire.UI?.getDistrictRaidLockRemainingMs?.(district?.id) || 0;
    row.classList.toggle("hidden", remainingMs <= 0);
    value.textContent = remainingMs > 0 ? formatDistrictRaidLockLabel(remainingMs) : "";
  }

  function updateDistrictDefenseSummary(district, options = {}) {
    const selfValue = document.getElementById("modal-defense-self");
    const allyValue = document.getElementById("modal-defense-ally");
    const selfRow = selfValue?.closest(".modal__row");
    const allyRow = allyValue?.closest(".modal__row");
    const spyIntel = options?.spyIntel || null;
    if (!selfValue || !allyValue) return;
    if (!district?.id && !spyIntel) {
      selfValue.textContent = "";
      allyValue.textContent = "";
      if (selfRow) selfRow.classList.add("hidden");
      if (allyRow) allyRow.classList.add("hidden");
      return;
    }
    if (!district?.id && spyIntel) {
      const knownFields = spyIntel?.knownFields && typeof spyIntel.knownFields === "object"
        ? spyIntel.knownFields
        : {};
      const weapons = knownFields.weapons === false
        ? "Nezjištěno"
        : `${Math.max(0, Math.floor(Number(spyIntel.weapons) || 0))}`;
      const powerRangeLabel = knownFields.powerRangeLabel === false
        ? "Nezjištěno"
        : (String(spyIntel.powerRangeLabel || "").trim() || "Neznámá");
      selfValue.textContent = `Odhad obrany • Zbraně: ${weapons} • Síla: ${powerRangeLabel}`;
      allyValue.textContent = "";
      if (selfRow) selfRow.classList.remove("hidden");
      if (allyRow) allyRow.classList.add("hidden");
      return;
    }
    const snapshot = window.Empire.UI?.getDistrictDefenseSnapshot?.(district.id) || null;
    const selfEntry = snapshot?.self || { hasData: false };
    const allyEntry = snapshot?.ally || { hasData: false };
    const knownSelf = Boolean(options.knownSelf);
    const knownAlly = Boolean(options.knownAlly);
    const showSelf = Boolean(selfEntry.hasData) || knownSelf;
    const showAlly = Boolean(allyEntry.hasData) || knownAlly;

    if (!selfEntry.hasData && spyIntel) {
      const knownFields = spyIntel?.knownFields && typeof spyIntel.knownFields === "object"
        ? spyIntel.knownFields
        : {};
      const weapons = knownFields.weapons === false
        ? "Nezjištěno"
        : `${Math.max(0, Math.floor(Number(spyIntel.weapons) || 0))}`;
      const powerRangeLabel = knownFields.powerRangeLabel === false
        ? "Nezjištěno"
        : (String(spyIntel.powerRangeLabel || "").trim() || "Neznámá");
      selfValue.textContent = `Odhad obrany • Zbraně: ${weapons} • Síla: ${powerRangeLabel}`;
    } else {
      selfValue.textContent = selfEntry.hasData ? formatDistrictDefenseSummary(selfEntry) : "Bez obrany";
    }
    allyValue.textContent = allyEntry.hasData ? formatDistrictDefenseSummary(allyEntry) : "Bez obrany";
    if (selfRow) selfRow.classList.toggle("hidden", !showSelf);
    if (allyRow) allyRow.classList.toggle("hidden", !showAlly);
    if (spyIntel && selfRow) selfRow.classList.remove("hidden");
  }

  function updateModalActionsForDistrict(district) {
    const attackBtn = document.getElementById("attack-btn");
    const raidBtn = document.getElementById("raid-btn");
    const spyBtn = document.getElementById("spy-btn");
    const defenseBtn = document.getElementById("defense-btn");
    const trapBtn = document.getElementById("trap-btn");
    const actionWrap = document.getElementById("district-modal-actions");
    if (!attackBtn || !raidBtn || !spyBtn || !defenseBtn || !trapBtn || !actionWrap) return;

    const defendableByPlayer = isDistrictDefendable(district);
    const evaluateAction = window.Empire.UI?.evaluateDistrictActionAvailability;
    const ownerValue = String(district?.owner || "").trim().toLowerCase();
    const isUnowned = !ownerValue || ownerValue === "neobsazeno" || ownerValue === "nikdo";
    const isEnemyDistrict = !defendableByPlayer && !isUnowned;
    const spyIntel = window.Empire.UI?.getDistrictSpyIntel?.(district?.id) || null;
    const hasSpyIntel = Boolean(spyIntel);
    const hasCompleteSpyIntel = Boolean(window.Empire.UI?.hasCompleteSpyIntel?.(spyIntel));
    const attackActionMode = isUnowned && hasCompleteSpyIntel ? "occupy" : "attack";
    const attackState = typeof evaluateAction === "function"
      ? evaluateAction(district, attackActionMode)
      : { allowed: !defendableByPlayer, reason: "" };
    const raidState = typeof evaluateAction === "function"
      ? evaluateAction(district, "raid")
      : { allowed: !defendableByPlayer, reason: "" };
    const spyState = typeof evaluateAction === "function"
      ? evaluateAction(district, "spy")
      : { allowed: !defendableByPlayer, reason: "" };
    const spyAvailability = window.Empire.UI?.getSpyAvailabilitySnapshot?.()
      || { available: 0, hasRecoveryQueued: false, nextRecoveryRemainingMs: 0 };
    const noSpyAvailable = Number(spyAvailability.available || 0) <= 0;
    const spyRecoveryRemainingMs = Math.max(0, Math.floor(Number(spyAvailability.nextRecoveryRemainingMs) || 0));
    const trapControlState = window.Empire.UI?.getDistrictTrapControlState?.(district)
      || { visible: false, label: "Past", title: "", isActiveHere: false };
    const destroyed = isDistrictDestroyed(district);
    actionWrap.classList.toggle("hidden", destroyed);
    const globalRaidCooldownMs = window.Empire.UI?.getRaidCooldownRemainingMs?.() || 0;
    const raidLockRemainingMs = window.Empire.UI?.getDistrictRaidLockRemainingMs?.(district?.id) || 0;
    const activeAttackCooldownMs = window.Empire.UI?.getActiveAttackCooldownRemainingMs?.() || 0;
    const showTrapControl = !destroyed
      && defendableByPlayer
      && trapControlState.visible;
    const showTrapActionButton = showTrapControl && !trapControlState.isActiveHere;

    const hasAttackCooldown = attackActionMode === "attack" && activeAttackCooldownMs > 0;
    const showAttack = !destroyed && !defendableByPlayer && (attackState.allowed || hasAttackCooldown);
    const hasRaidCooldown = globalRaidCooldownMs > 0 || raidLockRemainingMs > 0;
    const showRaid = !destroyed && !defendableByPlayer && (raidState.allowed || hasRaidCooldown);
    const showSpy = !destroyed && !defendableByPlayer && spyState.allowed && !hasCompleteSpyIntel;
    const showOccupyRaidPair = showAttack && showRaid && attackActionMode === "occupy";
    const showSpyRaidPair = !showAttack && showRaid && showSpy;

    attackBtn.classList.toggle("hidden", !showAttack);
    raidBtn.classList.toggle("hidden", !showRaid);
    spyBtn.classList.toggle("hidden", !showSpy);
    defenseBtn.classList.toggle("hidden", destroyed || !defendableByPlayer);
    trapBtn.classList.toggle("hidden", !showTrapActionButton);
    actionWrap.classList.toggle("district-modal__actions--occupy-raid", showOccupyRaidPair);
    actionWrap.classList.toggle("district-modal__actions--spy-raid", showSpyRaidPair);
    actionWrap.classList.toggle("district-modal__actions--defense-trap", showTrapActionButton);
    actionWrap.classList.toggle("district-modal__actions--trap-active", !destroyed && defendableByPlayer && Boolean(trapControlState.isActiveHere));
    actionWrap.classList.toggle("district-modal__actions--defense-only", !destroyed && defendableByPlayer && !showTrapActionButton);
    actionWrap.classList.toggle("district-modal__actions--enemy", !destroyed && isEnemyDistrict && showAttack && showSpy);
    attackBtn.dataset.actionMode = attackActionMode;
    if (attackActionMode === "attack" && hasAttackCooldown) {
      attackBtn.textContent = `Zaútočit • ${formatDistrictRaidLockLabel(activeAttackCooldownMs)}`;
    } else {
      attackBtn.textContent = attackActionMode === "occupy" ? "Obsadit" : "Zaútočit";
    }
    if (globalRaidCooldownMs > 0) {
      raidBtn.textContent = `Vykrást • ${formatDistrictRaidLockLabel(globalRaidCooldownMs)}`;
    } else if (raidLockRemainingMs > 0) {
      raidBtn.textContent = `Vykrást • ${formatDistrictRaidLockLabel(raidLockRemainingMs)}`;
    } else {
      raidBtn.textContent = "Vykrást";
    }
    if (showSpy && noSpyAvailable && spyRecoveryRemainingMs > 0) {
      spyBtn.textContent = `Špehovat • ${formatDistrictRaidLockLabel(spyRecoveryRemainingMs)}`;
    } else if (showSpy && noSpyAvailable) {
      spyBtn.textContent = "Špehovat • 0 špehů";
    } else {
      spyBtn.textContent = "Špehovat";
    }
    defenseBtn.textContent = "Obrana";
    const trapLabel = trapControlState.label || "Past";
    const trapSubtitle = String(trapControlState.subtitle || "").trim();
    trapBtn.innerHTML = trapSubtitle
      ? `<span class="district-action-btn__label">${trapLabel}</span><span class="district-action-btn__sub">${trapSubtitle}</span>`
      : `<span class="district-action-btn__label">${trapLabel}</span>`;
    attackBtn.disabled = !attackState.allowed;
    raidBtn.disabled = !raidState.allowed;
    spyBtn.disabled = Boolean(showSpy && (noSpyAvailable || !spyState.allowed));
    defenseBtn.disabled = false;
    trapBtn.disabled = Boolean(trapControlState.buttonDisabled);
    attackBtn.setAttribute("aria-disabled", attackState.allowed ? "false" : "true");
    raidBtn.setAttribute("aria-disabled", raidState.allowed ? "false" : "true");
    spyBtn.setAttribute("aria-disabled", spyBtn.disabled ? "true" : "false");
    defenseBtn.setAttribute("aria-disabled", "false");
    trapBtn.setAttribute("aria-disabled", trapControlState.buttonDisabled ? "true" : "false");
    attackBtn.title = attackState.allowed ? "" : (attackState.reason || "");
    raidBtn.title = raidState.allowed ? "" : (raidState.reason || "");
    if (spyBtn.disabled && noSpyAvailable && spyRecoveryRemainingMs > 0) {
      spyBtn.title = `Nemáš dostupného špeha. Další bude k dispozici za ${formatDistrictRaidLockLabel(spyRecoveryRemainingMs)}.`;
    } else if (spyBtn.disabled && noSpyAvailable) {
      spyBtn.title = "Nemáš žádné dostupné špehy.";
    } else {
      spyBtn.title = spyState.allowed ? "" : (spyState.reason || "");
    }
    defenseBtn.title = "Nastav obranu districtu.";
    trapBtn.title = trapControlState.title || "";
    trapBtn.classList.toggle("district-action-btn--cooldown", Boolean(trapControlState.moveLocked));
    trapBtn.classList.toggle("district-action-btn--active", Boolean(trapControlState.isActiveHere));
    attackBtn.classList.toggle("district-action-btn--cooldown", !attackState.allowed && hasAttackCooldown);
    raidBtn.classList.toggle("district-action-btn--cooldown", !raidState.allowed && hasRaidCooldown);
    spyBtn.classList.toggle("district-action-btn--cooldown", Boolean(showSpy && noSpyAvailable));
    trapBtn.setAttribute("aria-label", trapSubtitle ? `${trapLabel} ${trapSubtitle}` : trapLabel);
  }

  function hideModal() {
    if (!state.modal?.root) return;
    stopDistrictModalRefreshTicker();
    state.modal.root.classList.add("hidden");
  }

  function closeSelectedDistrictModal() {
    hideModal();
  }

  function refreshSelectedDistrictModal() {
    if (!state.modal?.root || state.modal.root.classList.contains("hidden")) return;
    const selected = window.Empire.selectedDistrict?.id != null
      ? state.districts.find((district) => String(district?.id) === String(window.Empire.selectedDistrict.id)) || null
      : null;
    if (!selected) return;
    showModal(selected);
  }

  function resolveDistrictBuildingIconKey(buildingName) {
    const normalized = String(buildingName || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!normalized) return null;
    if (normalized.includes("lekarna")) return "pharmacy";
    if (normalized.includes("drug lab")) return "drug-lab";
    if (normalized.includes("tovarna")) return "factory";
    if (normalized.includes("zbrojovka")) return "armory";
    return null;
  }

  function resolveDistrictBuildingIconSvg(iconKey) {
    switch (iconKey) {
      case "pharmacy":
        return `
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4"></rect>
            <path d="M12 7.5v9"></path>
            <path d="M7.5 12h9"></path>
          </svg>
        `;
      case "drug-lab":
        return `
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <path d="M9 3h6"></path>
            <path d="M10 3v4.4L5.8 15.2a4.7 4.7 0 0 0 4.1 5.8h4.2a4.7 4.7 0 0 0 4.1-5.8L14 7.4V3"></path>
            <path d="M8.2 13h7.6"></path>
          </svg>
        `;
      case "factory":
        return `
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <path d="M3 21V9l6 3V9l6 3V7l6-3v17"></path>
            <path d="M3 21h18"></path>
            <path d="M7 21v-4"></path>
            <path d="M11 21v-4"></path>
            <path d="M15 21v-4"></path>
          </svg>
        `;
      case "armory":
        return `
          <svg viewBox="0 0 24 24" role="presentation" focusable="false">
            <path d="M5 5l14 14"></path>
            <path d="M19 5L5 19"></path>
            <path d="M3.8 8.1L8.1 3.8"></path>
            <path d="M15.9 20.2l4.3-4.3"></path>
            <path d="M15.9 3.8l4.3 4.3"></path>
            <path d="M3.8 15.9l4.3 4.3"></path>
          </svg>
        `;
      default:
        return "";
    }
  }

  function renderDistrictBuildingName(buildingName, iconKey) {
    if (!iconKey) return `<span class="district-buildings__name">${buildingName}</span>`;
    const iconSvg = resolveDistrictBuildingIconSvg(iconKey);
    return `
      <span class="district-buildings__name-wrap">
        <span class="district-buildings__icon" aria-hidden="true">${iconSvg}</span>
        <span class="district-buildings__name">${buildingName}</span>
      </span>
    `;
  }

  function updateDistrictBuildings(district, options = {}) {
    const root = document.getElementById("modal-buildings");
    const title = document.getElementById("modal-buildings-title");
    const list = document.getElementById("modal-buildings-list");
    const spyIntel = options?.spyIntel || null;
    if (!root || !title || !list) return;
    if (!district && !spyIntel) {
      root.classList.add("hidden");
      list.classList.remove("district-buildings--trap-wide");
      list.innerHTML = "";
      return;
    }

    const knownFields = spyIntel?.knownFields && typeof spyIntel.knownFields === "object"
      ? spyIntel.knownFields
      : {};
    const buildings = district
      ? (Array.isArray(district.buildings) ? district.buildings : [])
      : (Array.isArray(spyIntel?.buildings) ? spyIntel.buildings : []);
    const trapControlState = district ? (window.Empire.UI?.getDistrictTrapControlState?.(district) || null) : null;
    const visibleBuildings = district && trapControlState?.buildingVisible
      ? [...buildings, "__district_trap__"]
      : buildings;
    if (!district && knownFields.buildings === false) {
      root.classList.remove("hidden");
      title.textContent = "Budovy v distriktu";
      list.classList.remove("district-buildings--trap-wide");
      list.innerHTML = '<div class="district-buildings__empty">Budovy se nepodařilo zjistit.</div>';
      return;
    }
    if (!visibleBuildings.length) {
      root.classList.add("hidden");
      list.classList.remove("district-buildings--trap-wide");
      list.innerHTML = "";
      return;
    }
    const lockMeta = district ? resolveBuildingLockMeta(district) : { locked: true, label: "" };
    const shouldStretchTrapCard = Boolean(district && trapControlState?.buildingVisible && buildings.length === 2);
    list.classList.toggle("district-buildings--trap-wide", shouldStretchTrapCard);

    title.textContent = district?.buildingSetTitle
      ? `Budovy v distriktu • ${district.buildingSetTitle} (${district.buildingTier || "set"})`
      : "Budovy v distriktu";
    list.innerHTML = visibleBuildings
      .map((building, index) => {
        if (building === "__district_trap__") {
          return `<div class="district-buildings__item district-buildings__item--trap">
            <span class="district-buildings__name">${trapControlState?.buildingLabel || "Past"}</span>
            <span class="district-buildings__lock district-buildings__lock--trap">${trapControlState?.buildingMeta || "aktivní"}</span>
          </div>`;
        }
        const iconKey = resolveDistrictBuildingIconKey(building);
        const iconClass = iconKey ? ` district-buildings__item--icon-${iconKey}` : "";
        return `
          <button
            class="district-buildings__item district-buildings__item--interactive${iconClass}${lockMeta.locked ? " district-buildings__item--locked" : ""}"
            type="button"
            data-building-index="${index}"
            ${lockMeta.locked ? 'data-building-locked="1" disabled aria-disabled="true"' : ""}
          >
            ${renderDistrictBuildingName(building, iconKey)}
            ${lockMeta.locked && lockMeta.label ? `<span class="district-buildings__lock">${lockMeta.label}</span>` : ""}
          </button>
        `;
      })
      .join("");
    if (!district) {
      root.classList.remove("hidden");
      return;
    }
    list.querySelectorAll("[data-building-index]:not([data-building-locked])").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-building-index"));
        const buildingName = visibleBuildings[index];
        if (buildingName === "__district_trap__") return;
        if (!buildingName) return;
        const detailInput = resolveBuildingDetailInput(district, index, buildingName);
        document.getElementById("district-modal")?.classList.add("hidden");
        document.getElementById("modal-buildings")?.classList.add("hidden");
        openBuildingDetailModal(detailInput, district);
      });
    });
    root.classList.remove("hidden");
  }

  function initDistrictAtmosphereLightbox() {
    const trigger = document.getElementById("modal-owner-atmosphere-image");
    const root = document.getElementById("district-atmosphere-lightbox");
    const backdrop = document.getElementById("district-atmosphere-lightbox-backdrop");
    const closeBtn = document.getElementById("district-atmosphere-lightbox-close");
    const image = document.getElementById("district-atmosphere-lightbox-image");
    const title = document.getElementById("district-atmosphere-lightbox-title");
    const meta = document.getElementById("district-atmosphere-lightbox-meta");
    if (!trigger || !root || !image || !title || !meta) return;

    const open = () => {
      const src = String(trigger.getAttribute("src") || "").trim();
      if (!src) return;
      image.src = src;
      title.textContent = trigger.dataset.districtName || "Atmosféra distriktu";
      const parts = [
        trigger.dataset.districtType ? `Typ: ${trigger.dataset.districtType}` : "",
        trigger.dataset.districtOwner ? `Vlastník: ${trigger.dataset.districtOwner}` : ""
      ].filter(Boolean);
      meta.textContent = parts.join(" • ");
      root.classList.remove("hidden");
    };

    const close = () => {
      root.classList.add("hidden");
      image.removeAttribute("src");
    };

    trigger.addEventListener("click", open);
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    root.addEventListener("click", (event) => {
      if (event.target === root) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.classList.contains("hidden")) close();
    });
  }

  function formatDistrictGossipTimestamp(timestamp) {
    const value = Math.max(0, Math.floor(Number(timestamp) || 0));
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}. ${hours}:${minutes}`;
  }

  function updateDistrictGossip(district) {
    const root = document.getElementById("modal-gossip");
    const list = document.getElementById("modal-gossip-list");
    if (!root || !list) return;
    if (!district) {
      root.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    const entries = getDistrictGossipEntries(district, 24);
    if (!entries.length) {
      list.innerHTML = `
        <div class="district-gossip__item district-gossip__item--placeholder">
          <div class="district-gossip__text">Zatím žádné drby pro tento distrikt.</div>
        </div>
      `;
      root.classList.remove("hidden");
      return;
    }

    list.innerHTML = entries
      .map((entry) => `
        <div class="district-gossip__item">
          <div class="district-gossip__text">${escapeHtml(entry.text)}</div>
          <div class="district-gossip__meta-row">
            <div class="district-gossip__meta">${formatDistrictGossipTimestamp(entry.createdAt)}</div>
          </div>
        </div>
      `)
      .join("");
    root.classList.remove("hidden");
  }

  function refreshOpenDistrictGossipSection() {
    if (!state.modal?.root || state.modal.root.classList.contains("hidden")) return;
    const selected = state.districts.find((district) => String(district?.id) === String(state.selectedId));
    if (!selected) return;
    updateDistrictGossip(selected);
  }

  function resolveDistrictBuildingName(district, index, fallbackName) {
    const overrides = Array.isArray(district?.buildingNameOverrides) ? district.buildingNameOverrides : [];
    const named = overrides[index];
    if (typeof named === "string" && named.trim()) {
      return named.trim();
    }
    return String(fallbackName || "Neznámá budova");
  }

  function resolveBuildingDetailInput(district, index, fallbackName) {
    const baseName = String(fallbackName || "Neznámá budova");
    const variantName = resolveDistrictBuildingName(district, index, baseName);
    return {
      baseName,
      variantName: variantName !== baseName ? variantName : null,
      districtId: district?.id ?? null,
      buildingIndex: Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : null
    };
  }

  function resolveBuildingDetailContext(buildingInput) {
    if (buildingInput && typeof buildingInput === "object") {
      const baseName = String(buildingInput.baseName || buildingInput.name || "Neznámá budova");
      const variantRaw = String(buildingInput.variantName || "").trim();
      const variantName = variantRaw && variantRaw !== baseName ? variantRaw : null;
      const districtId = buildingInput.districtId ?? null;
      const indexRaw = Number(buildingInput.buildingIndex);
      const buildingIndex = Number.isFinite(indexRaw) ? Math.max(0, Math.floor(indexRaw)) : null;
      return { baseName, variantName, districtId, buildingIndex };
    }
    return {
      baseName: String(buildingInput || "Neznámá budova"),
      variantName: null,
      districtId: null,
      buildingIndex: null
    };
  }

  function resolveBuildingLockMeta(district) {
    if (isDistrictOwnedByPlayer(district)) {
      return { locked: false, label: "" };
    }
    if (isDistrictOwnedByAlly(district)) {
      return { locked: true, label: "ALLY LOCKED" };
    }
    return { locked: true, label: "LOCKED" };
  }

  function clampPan() {
    const viewW = state.canvas.width / window.devicePixelRatio;
    const viewH = state.canvas.height / window.devicePixelRatio;
    const mapW = state.mapSize.width * state.scale;
    const mapH = state.mapSize.height * state.scale;

    if (mapW <= viewW) {
      state.offsetX = (viewW - mapW) / 2;
    } else {
      const minX = viewW - mapW;
      state.offsetX = clamp(state.offsetX, minX, 0);
    }

    if (mapH <= viewH) {
      state.offsetY = (viewH - mapH) / 2;
    } else {
      const minY = viewH - mapH;
      state.offsetY = clamp(state.offsetY, minY, 0);
    }
  }

  function loadMapImage() {
    const img = new Image();
    img.src = MAP_MODE_IMAGE_BY_KEY[state.mapMode] || MAP_MODE_IMAGE_BY_KEY.night;
    img.onload = () => {
      document.dispatchEvent(new CustomEvent("empire:map-mode-changed", {
        detail: { mapMode: state.mapMode }
      }));
      render();
    };
    state.mapImage = img;
  }

  function normalizeMapMode(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "day") return "day";
    if (key === "blackout") return "blackout";
    return "night";
  }

  function resolveStoredMapMode() {
    try {
      return normalizeMapMode(localStorage.getItem(MAP_MODE_STORAGE_KEY) || "night");
    } catch {
      return "night";
    }
  }

  function setMapMode(mode) {
    const nextMode = normalizeMapMode(mode);
    if (state.mapMode === nextMode) return;
    state.mapMode = nextMode;
    try {
      localStorage.setItem(MAP_MODE_STORAGE_KEY, nextMode);
    } catch {}
    const img = new Image();
    img.src = MAP_MODE_IMAGE_BY_KEY[nextMode] || MAP_MODE_IMAGE_BY_KEY.night;
    img.onload = () => {
      state.mapImage = img;
      document.dispatchEvent(new CustomEvent("empire:map-mode-changed", {
        detail: { mapMode: nextMode }
      }));
      render();
    };
    img.onerror = () => {
      render();
    };
  }

  function getMapMode() {
    return normalizeMapMode(state.mapMode);
  }

  function buildRoadNetworkFromDistricts(districts) {
    const centroids = districts.map((district) => ({
      id: district.id,
      point: polygonCentroid(district.polygon)
    }));

    const roads = [];
    centroids.forEach((node) => {
      const nearest = centroids
        .filter((other) => other.id !== node.id)
        .map((other) => ({
          other,
          dist: Math.hypot(
            other.point[0] - node.point[0],
            other.point[1] - node.point[1]
          )
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);

      nearest.forEach((edge) => {
        roads.push({ from: node.point, to: edge.other.point });
      });
    });

    return roads;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getMinScale() {
    return Math.max(
      state.canvas.width / window.devicePixelRatio / state.mapSize.width,
      state.canvas.height / window.devicePixelRatio / state.mapSize.height
    );
  }

  function centerMap() {
    const viewW = state.canvas.width / window.devicePixelRatio;
    const viewH = state.canvas.height / window.devicePixelRatio;
    const mapW = state.mapSize.width * state.scale;
    const mapH = state.mapSize.height * state.scale;
    state.offsetX = (viewW - mapW) / 2;
    state.offsetY = (viewH - mapH) / 2;
  }

  function zoomAtPoint(viewX, viewY, newScale) {
    const worldBefore = toWorld(viewX, viewY);
    state.scale = newScale;
    state.offsetX = viewX - worldBefore.x * newScale;
    state.offsetY = viewY - worldBefore.y * newScale;
    clampPan();
    render();
  }

  function beginPinch(firstTouch, secondTouch) {
    const rect = state.canvas.getBoundingClientRect();
    const midpoint = midpointBetweenTouches(firstTouch, secondTouch);
    state.isPinching = true;
    state.isPanning = false;
    state.touchMoved = true;
    state.pinchStartDistance = Math.max(distanceBetweenTouches(firstTouch, secondTouch), 1);
    state.pinchStartScale = state.scale;
    state.pinchWorldCenter = toWorld(midpoint.x - rect.left, midpoint.y - rect.top);
  }

  function distanceBetweenTouches(firstTouch, secondTouch) {
    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY
    );
  }

  function midpointBetweenTouches(firstTouch, secondTouch) {
    return {
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2
    };
  }

  function isTouchGhost() {
    return Date.now() - state.lastTouchAt < 500;
  }

  return {
    init,
    render,
    getMapMode,
    setMapMode,
    setDistricts,
    refreshSelectedDistrictModal,
    closeSelectedDistrictModal,
    applyUpdate,
    setVisionContext,
    showBuildingDetail,
    recordIntelEvent,
    markDistrictUnderAttack,
    clearDistrictUnderAttack,
    clearUnderAttackDistricts: clearAllUnderAttackDistricts,
    setUnderAttackDistricts,
    markDistrictPoliceAction,
    clearDistrictPoliceAction,
    clearPoliceActions: clearAllPoliceActions,
    setPoliceActionDistricts,
    markDistrictSpyAction,
    clearDistrictSpyAction,
    clearSpyActions: clearAllSpyActions,
    setSpyActionDistricts,
    markDistrictRaidAction,
    clearDistrictRaidAction,
    clearRaidActions: clearAllRaidActions,
    getPharmacyBoostSnapshot,
    usePharmacyBoost,
    setBountyDistrictMarkers,
    clearBountyDistrictMarkers,
    getPoliceActionSnapshot,
    getFactoryBoostSnapshot,
    useFactoryBoost,
    getFitnessCombatSnapshot
  };
})();
