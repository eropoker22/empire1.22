export { DISTRICT_ATMOSPHERE_META } from "../../data/districtImages.js";
export {
  DISTRICT_BUILDING_TYPE_META,
  DISTRICT_BUILDING_TYPE_ORDER
} from "../../data/buildings.js";

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
