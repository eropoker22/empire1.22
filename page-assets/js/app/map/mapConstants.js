export const MAP_DEFAULT_DISTRICT_TYPE = "resident";
export const MAP_UNKNOWN_DISTRICT_TYPE = "unknown";
export const MAP_DOWNTOWN_DISTRICT_TYPE = "downtown";
export const MAP_GRID_ROWS = 7;
export const MAP_GRID_COLUMNS = 23;
export const MAP_GEOMETRY_SEED = 20260419;
export const MAP_GEOMETRY_NEIGHBOR_LIMIT = 18;
export const MAP_DISTRICT_GEOMETRY_TOP_INSET = 48;
export const DISTRICT_SHAPE_CONFIG = Object.freeze({
  organicEdges: true,
  edgeSegments: 5,
  // Increase these carefully: hit testing uses the same organic polygon.
  jitterAmount: 10,
  cornerJitter: 4,
  smoothPasses: 1,
  seed: "empire-streets-map-v1"
});
export const MAP_OWNER_FILL_ALPHA = "33";
export const MAP_DEFAULT_OWNER_COLOR = "#67e1ff";
export const MAP_CURRENT_PLAYER_LABEL = "TY";
export const MAP_UNOWNED_OWNER_LABEL = "Neobsazeno";
export const MAP_DESTROYED_OWNER_LABEL = "Zničený";
export const MAP_LAUNCH_UNOWNED_FILL_STYLE = "rgba(0, 0, 0, 0)";
export const MAP_DISTRICT_SELECTION_DRAG_THRESHOLD = 10;
export const MAP_DISTRICT_SELECTION_SUPPRESS_MS = 220;
export const MAP_INTERACTION_OVERLAY_CLASS = "map-interaction-overlay";
export const MAP_HOVER_CANVAS_CLASS = "map-hover-canvas";
export const MAP_HAS_HOVER_CLASS = "has-map-hover";
export const MAP_DISTRICT_FOCUSED_CLASS = "is-district-focused";
export const MAP_HOVER_STROKE_STYLE = "rgba(103, 225, 255, 0.95)";
export const MAP_REDUCED_ACTIVITY_FALLBACK_COLOR = "#67e1ff";

export const MAP_BASE_DISTRICT_TYPES = Object.freeze([
  "resident",
  "industrial",
  "economy",
  "park"
]);

export const MAP_DISTRICT_TYPE_ORDER = Object.freeze([
  "resident",
  "economy",
  "industrial",
  "park",
  "downtown"
]);

export const MAP_DESTROYED_FILL_STYLES = Object.freeze({
  day: "rgba(98, 28, 28, 0.24)",
  night: "rgba(255, 96, 96, 0.16)"
});

export const MAP_HIDDEN_FILL_STYLES = Object.freeze({
  day: "rgba(214, 228, 240, 0.11)",
  night: "rgba(196, 210, 224, 0.08)"
});

export const MAP_ZONE_FILL_STYLES = Object.freeze({
  day: Object.freeze({
    downtown: "rgba(255, 71, 194, 0.24)",
    industrial: "rgba(255, 154, 61, 0.18)",
    resident: "rgba(103, 225, 255, 0.14)",
    economy: "rgba(113, 255, 188, 0.16)",
    park: "rgba(165, 255, 89, 0.14)"
  }),
  night: Object.freeze({
    downtown: "rgba(255, 71, 194, 0.18)",
    industrial: "rgba(255, 154, 61, 0.12)",
    resident: "rgba(103, 225, 255, 0.10)",
    economy: "rgba(113, 255, 188, 0.11)",
    park: "rgba(165, 255, 89, 0.09)"
  })
});

export const MAP_REDUCED_ACTIVITY_COLORS = Object.freeze({
  spy: "#a6ebff",
  police: "#60a5fa",
  attack: "#fb923c",
  occupy: null,
  robbery: "#94a3b8",
  trap: "#a3ff60"
});

export const DISTRICT_ATMOSPHERE_META = Object.freeze({
  resident: Object.freeze({
    typeKey: "resident",
    label: "Rezidenční sektor",
    shortLabel: "Rezidenční",
    mood: "Úzké bloky, studené lampy a civilní provoz kryjí pohyb lidí i menších přesunů.",
    imagePath: "../img/residental/1.png",
    imagePaths: Object.freeze([
      "../img/residental/1.png",
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
      "../img/residental/u6568429269_ultra_realistic_futuristic_cyberpunk_residential__f7a77fe8-ab6b-4dda-9a87-ce74f484cba5_3.png"
    ])
  }),
  industrial: Object.freeze({
    typeKey: "industrial",
    label: "Průmyslový sektor",
    shortLabel: "Průmysl",
    mood: "Komíny, kov a servisní koridory dávají districtu tvrdý, hlučný charakter.",
    imagePath: "../img/industrial/1.png",
    imagePaths: Object.freeze([
      "../img/industrial/1.png",
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
      "../img/industrial/u6568429269_ultra_realistic_futuristic_cyberpunk_industrial_c_a28bf0fd-ad5d-4eb8-bcb5-1ae5d11fc967_2.png"
    ])
  }),
  economy: Object.freeze({
    typeKey: "economy",
    label: "Komerční sektor",
    shortLabel: "Komerce",
    mood: "Výlohy, trh a tok peněz drží district živý a neustále pod dohledem.",
    imagePath: "../img/commercial/1.png",
    imagePaths: Object.freeze([
      "../img/commercial/1.png",
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
      "../img/commercial/u6568429269_ultra_realistic_cyberpunk_residential_district_at_ebf246bf-a944-47da-9d77-35cd0c8cb70f_3.png",
      "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_32d9d42c-9397-4a7a-b58a-1d29d6a49940_1.png",
      "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_32d9d42c-9397-4a7a-b58a-1d29d6a49940_3.png",
      "../img/commercial/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_3.png"
    ])
  }),
  park: Object.freeze({
    typeKey: "park",
    label: "Parkový sektor",
    shortLabel: "Park",
    mood: "Tma mezi stromy, mlha a tiché stezky vytvářejí slepá místa pro pohyb i past.",
    imagePath: "../img/park/1.png",
    imagePaths: Object.freeze([
      "../img/park/1.png",
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
      "../img/park/u6568429269_ultra_realistic_futuristic_cyberpunk_city_park_at_4e6e39a1-7ff7-4445-9365-b559a33df0ba_0.png"
    ])
  }),
  downtown: Object.freeze({
    typeKey: "downtown",
    label: "Downtown",
    shortLabel: "Downtown",
    mood: "Vysoké věže, hustý provoz a agresivní neon dávají centru největší tlak.",
    imagePath: "../img/downtown/1.png",
    imagePaths: Object.freeze([
      "../img/downtown/1.png",
      "../img/downtown/u6568429269_ultra_realistic_cyberpunk_downtown_district_at_ni_84a7bf7c-e03a-420b-9857-c421d73f33a8_1.png",
      "../img/downtown/u6568429269_ultra_realistic_cyberpunk_luxury_commercial_distr_dc550711-88c1-45c7-8ddb-316de1b5fd2a_3.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_1.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_2.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_corporate_co_97954e9e-ca7b-408f-900d-96dcfa46b674_3.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_9fd803d9-f679-43c7-b791-40f5f958e092_2.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_1.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_2.png",
      "../img/downtown/u6568429269_ultra_realistic_futuristic_cyberpunk_downtown_pla_c8027657-4880-4137-acb3-a6b8ac44d0ff_3.png"
    ])
  }),
  unknown: Object.freeze({
    typeKey: "unknown",
    label: "Skrytý sektor",
    shortLabel: "Skryto",
    mood: "District je mimo dohled. Atmosféra, obrana i provoz nejsou potvrzené.",
    imagePath: "../img/blackout.png"
  })
});

export const DISTRICT_BUILDING_TYPE_META = Object.freeze({
  resident: Object.freeze({
    key: "resident",
    label: "Rezidenční districty",
    shortLabel: "Rezidence"
  }),
  economy: Object.freeze({
    key: "economy",
    label: "Komerční districty",
    shortLabel: "Komerce"
  }),
  industrial: Object.freeze({
    key: "industrial",
    label: "Průmyslové districty",
    shortLabel: "Průmysl"
  }),
  park: Object.freeze({
    key: "park",
    label: "Parkové districty",
    shortLabel: "Park"
  }),
  downtown: Object.freeze({
    key: "downtown",
    label: "Downtown districty",
    shortLabel: "Downtown"
  })
});

export const DISTRICT_BUILDING_TYPE_ORDER = MAP_DISTRICT_TYPE_ORDER;
