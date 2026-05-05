export const MAP_DEFAULT_DISTRICT_TYPE = "resident";
export const MAP_UNKNOWN_DISTRICT_TYPE = "unknown";
export const MAP_DOWNTOWN_DISTRICT_TYPE = "downtown";
export const MAP_GRID_ROWS = 7;
export const MAP_GRID_COLUMNS = 23;
export const MAP_GEOMETRY_SEED = 20260419;
export const MAP_GEOMETRY_NEIGHBOR_LIMIT = 18;
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
    imagePath: "../img/residental/1.png"
  }),
  industrial: Object.freeze({
    typeKey: "industrial",
    label: "Průmyslový sektor",
    shortLabel: "Průmysl",
    mood: "Komíny, kov a servisní koridory dávají districtu tvrdý, hlučný charakter.",
    imagePath: "../img/industrial/1.png"
  }),
  economy: Object.freeze({
    typeKey: "economy",
    label: "Komerční sektor",
    shortLabel: "Komerce",
    mood: "Výlohy, trh a tok peněz drží district živý a neustále pod dohledem.",
    imagePath: "../img/commercial/1.png"
  }),
  park: Object.freeze({
    typeKey: "park",
    label: "Parkový sektor",
    shortLabel: "Park",
    mood: "Tma mezi stromy, mlha a tiché stezky vytvářejí slepá místa pro pohyb i past.",
    imagePath: "../img/park/1.png"
  }),
  downtown: Object.freeze({
    typeKey: "downtown",
    label: "Downtown",
    shortLabel: "Downtown",
    mood: "Vysoké věže, hustý provoz a agresivní neon dávají centru největší tlak.",
    imagePath: "../img/downtown/1.png"
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
