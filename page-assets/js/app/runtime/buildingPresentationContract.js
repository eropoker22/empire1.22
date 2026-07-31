const normalizeBuildingTypeId = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, "_")
  .replace(/^_+|_+$/gu, "");

const BUILDING_PRESENTATION_DEFINITIONS = Object.freeze({
  central_bank: Object.freeze({ baseName: "Centrální banka", mechanicsType: "central-bank" }),
  city_hall: Object.freeze({ baseName: "Magistrát", mechanicsType: "city-hall" }),
  lobby_club: Object.freeze({ baseName: "Lobby klub", mechanicsType: "lobby-club" }),
  stock_exchange: Object.freeze({ baseName: "Burza", mechanicsType: "stock-exchange" }),
  court: Object.freeze({ baseName: "Soud", mechanicsType: "court" }),
  vip_lounge: Object.freeze({ baseName: "VIP salonek", mechanicsType: "vip-lounge" }),
  airport: Object.freeze({ baseName: "Letiště", mechanicsType: "airport" }),
  port: Object.freeze({ baseName: "Přístav", mechanicsType: "port" }),
  parliament: Object.freeze({ baseName: "Parlament", mechanicsType: "parliament" }),
  shopping_mall: Object.freeze({ baseName: "Obchodní centrum", mechanicsType: "retail" }),
  retail: Object.freeze({ baseName: "Obchodní centrum", mechanicsType: "retail" }),
  restaurant: Object.freeze({ baseName: "Restaurace", mechanicsType: "restaurant" }),
  arcade: Object.freeze({ baseName: "Herna", mechanicsType: "arcade" }),
  casino: Object.freeze({ baseName: "Kasino", mechanicsType: "casino" }),
  car_dealer: Object.freeze({ baseName: "Autosalon", mechanicsType: "auto-salon" }),
  auto_salon: Object.freeze({ baseName: "Autosalon", mechanicsType: "auto-salon" }),
  fitness_club: Object.freeze({ baseName: "Fitness Club", mechanicsType: "fitness-club" }),
  exchange: Object.freeze({ baseName: "Směnárna", mechanicsType: "exchange" }),
  apartment_block: Object.freeze({ baseName: "Bytový blok", mechanicsType: "apartment-block" }),
  recruitment_center: Object.freeze({ baseName: "Rekrutační centrum", mechanicsType: "recruitment-center" }),
  garage: Object.freeze({ baseName: "Garage", mechanicsType: "garage" }),
  clinic: Object.freeze({ baseName: "Klinika", mechanicsType: "clinic" }),
  school: Object.freeze({ baseName: "Škola", mechanicsType: "school" }),
  factory: Object.freeze({ baseName: "Továrna", mechanicsType: "factory" }),
  armory: Object.freeze({ baseName: "Zbrojovka", mechanicsType: "armory" }),
  warehouse: Object.freeze({ baseName: "Skladiště", mechanicsType: "warehouse" }),
  power_station: Object.freeze({ baseName: "Energetická stanice", mechanicsType: "power-plant" }),
  power_plant: Object.freeze({ baseName: "Energetická stanice", mechanicsType: "power-plant" }),
  recycling_center: Object.freeze({ baseName: "Recyklační centrum", mechanicsType: "recycling-center" }),
  pharmacy: Object.freeze({ baseName: "Lékárna", mechanicsType: "pharmacy" }),
  drug_lab: Object.freeze({ baseName: "Drug lab", mechanicsType: "drug-lab" }),
  druglab: Object.freeze({ baseName: "Drug lab", mechanicsType: "drug-lab" }),
  smuggling_tunnel: Object.freeze({ baseName: "Pašovací tunel", mechanicsType: "smuggling-tunnel" }),
  convenience_store: Object.freeze({ baseName: "Večerka", mechanicsType: "convenience-store" }),
  strip_club: Object.freeze({ baseName: "Strip club", mechanicsType: "strip-club" }),
  street_dealers: Object.freeze({ baseName: "Pouliční dealeři", mechanicsType: "street-dealers" })
});

export const BUILDING_DETAIL_LAYOUTS = Object.freeze({
  singlePanel: "single-panel",
  tabbed: "tabbed"
});

export const SINGLE_PANEL_BUILDING_DETAIL_TYPES = Object.freeze([
  "apartment-block",
  "garage",
  "recruitment-center",
  "clinic",
  "arcade",
  "school",
  "restaurant",
  "fitness-club",
  "exchange",
  "auto-salon",
  "retail",
  "casino",
  "warehouse",
  "power-plant",
  "recycling-center",
  "street-dealers",
  "convenience-store",
  "smuggling-tunnel",
  "strip-club"
]);

const singlePanelBuildingTypes = new Set(SINGLE_PANEL_BUILDING_DETAIL_TYPES);

export const BUILDING_DETAIL_VIEW_MODEL_KEYS = Object.freeze([
  "root",
  "shell",
  "districtId",
  "buildingId",
  "buildingTypeId",
  "title",
  "badge",
  "typeLabel",
  "countLabel",
  "backgroundImagePath",
  "mechanicsType",
  "convenienceStoreIsFull",
  "districtType",
  "isDowntownBuilding",
  "layout",
  "levelLabel",
  "showLevel",
  "name",
  "meta",
  "collect",
  "upgrade",
  "stats",
  "emptyStatsText",
  "mechanics",
  "hideMechanicsSection",
  "effectsLabel",
  "effects",
  "intro",
  "showActionsInSinglePanel",
  "actions"
]);

const allowedViewModelKeys = new Set(BUILDING_DETAIL_VIEW_MODEL_KEYS);

const copyRows = (rows) => (
  Array.isArray(rows)
    ? rows.map((row) => (row && typeof row === "object" ? { ...row } : row))
    : []
);

const copyActions = (actions) => copyRows(actions).map((action) => ({
  ...action,
  requiresInput: copyRows(action?.requiresInput),
  serverAction: action?.serverAction ? {
    description: String(action.serverAction.description || ""),
    riskSummary: Array.isArray(action.serverAction.riskSummary)
      ? action.serverAction.riskSummary.slice()
      : []
  } : null,
  dealerSale: action?.dealerSale ? {
    ...action.dealerSale,
    slots: copyRows(action.dealerSale.slots)
  } : null
}));

export function resolveBuildingPresentationDefinition(buildingTypeId = "") {
  return BUILDING_PRESENTATION_DEFINITIONS[normalizeBuildingTypeId(buildingTypeId)] || null;
}

export function resolveBuildingDetailLayout(mechanicsType = "") {
  return singlePanelBuildingTypes.has(String(mechanicsType || "").trim().toLowerCase())
    ? BUILDING_DETAIL_LAYOUTS.singlePanel
    : BUILDING_DETAIL_LAYOUTS.tabbed;
}

export function pickBuildingDetailPresentationViewModel(viewModel = {}, overrides = {}) {
  const source = { ...viewModel, ...overrides };
  const picked = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowedViewModelKeys.has(key)) picked[key] = value;
  }
  picked.layout = source.layout || resolveBuildingDetailLayout(source.mechanicsType);
  picked.collect = source.collect ? { ...source.collect } : { visible: false, enabled: false, title: "" };
  picked.upgrade = source.upgrade ? { ...source.upgrade } : { visible: false, disabled: true, title: "" };
  picked.stats = copyRows(source.stats);
  picked.mechanics = copyRows(source.mechanics);
  picked.effects = copyRows(source.effects);
  picked.actions = copyActions(source.actions);
  return picked;
}
