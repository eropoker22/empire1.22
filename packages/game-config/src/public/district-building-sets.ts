import { publicBuildingDefinitions } from "./building-definitions";

export interface PublicDistrictBuildingSet {
  key: string;
  zone: string;
  tier: string;
  title: string;
  buildingTypes: string[];
}

export interface ResolveDistrictBuildingTypesInput {
  districtId: string;
  zone?: string | null;
  buildingSetKey?: string | null;
  buildingTier?: string | null;
  legacyBuildingNames?: readonly string[] | null;
}

const set = (
  zone: string,
  tier: string,
  key: string,
  title: string,
  buildingTypes: string[]
): PublicDistrictBuildingSet => ({ key, zone, tier, title, buildingTypes });

export const publicDistrictBuildingSetPools: Record<string, PublicDistrictBuildingSet[]> = {
  commercial: [
    set("commercial", "early", "early-stable-1", "Stabilní provoz", ["restaurant", "fitness_club"]),
    set("commercial", "early", "early-stable-2", "Civilní utility", ["restaurant", "pharmacy"]),
    set("commercial", "early", "early-cash", "Lehký cashflow", ["restaurant", "exchange"]),
    set("commercial", "early", "early-safe-3", "Bezpečný mix", ["restaurant", "pharmacy", "fitness_club"]),
    set("commercial", "early", "early-launder", "Startovní mobilita", ["car_dealer", "restaurant"]),
    set("commercial", "mid", "mid-balance-1", "Utility growth", ["car_dealer", "pharmacy"]),
    set("commercial", "mid", "mid-balance-2", "Finanční uzel", ["car_dealer", "exchange"]),
    set("commercial", "mid", "mid-corp-1", "Korporátní stabilita", ["shopping_mall", "restaurant"]),
    set("commercial", "mid", "mid-corp-2", "Administrativní utility", ["shopping_mall", "pharmacy", "restaurant"]),
    set("commercial", "mid", "mid-mall-1", "Hlavní retail", ["shopping_mall", "restaurant"]),
    set("commercial", "mid", "mid-mix-1", "Vyvážený obchod", ["restaurant", "pharmacy", "exchange"]),
    set("commercial", "mid", "mid-mix-2", "Mobilní front", ["car_dealer", "exchange", "restaurant"]),
    set("commercial", "top", "top-casino-1", "Kasino hotspot", ["casino", "restaurant"]),
    set("commercial", "top", "top-casino-2", "Shady premium", ["casino", "restaurant", "pharmacy"]),
    set("commercial", "top", "top-casino-3", "Black cash engine", ["casino", "exchange", "car_dealer"]),
    set("commercial", "top", "top-mall-1", "Prémiový retail", ["shopping_mall", "pharmacy", "restaurant"]),
    set("commercial", "top", "top-mall-2", "Financial boulevard", ["shopping_mall", "exchange", "restaurant"])
  ],
  residential: [
    set("residential", "early", "res-early-1", "Startovní růst", ["apartment_block", "garage"]),
    set("residential", "early", "res-early-2", "Stabilní základna", ["apartment_block", "arcade"]),
    set("residential", "early", "res-early-3", "První nábor", ["apartment_block", "recruitment_center"]),
    set("residential", "early", "res-early-4", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
    set("residential", "mid", "res-mid-1", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
    set("residential", "mid", "res-mid-2", "Udržitelný růst", ["apartment_block", "clinic"]),
    set("residential", "mid", "res-mid-3", "Disciplína a kvalita", ["apartment_block", "school"]),
    set("residential", "mid", "res-mid-4", "Loajalita a výcvik", ["arcade", "school"]),
    set("residential", "mid", "res-mid-5", "Regenerace fronty", ["recruitment_center", "clinic"]),
    set("residential", "mid", "res-mid-6", "Kontrolovaný development", ["apartment_block", "arcade", "school"]),
    set("residential", "late", "res-late-1", "Válečné zázemí", ["apartment_block", "recruitment_center", "clinic"]),
    set("residential", "late", "res-late-2", "Mobilní tlak", ["recruitment_center", "garage", "clinic"]),
    set("residential", "late", "res-late-3", "Loajální populace", ["apartment_block", "arcade", "clinic"]),
    set("residential", "late", "res-late-4", "Elitní rezidenční zóna", ["apartment_block", "school", "clinic"]),
    set("residential", "late", "res-late-5", "Strategická mobilizace", ["apartment_block", "recruitment_center", "school"])
  ],
  park: [
    set("park", "early", "park-early-1", "Street cash", ["street_dealers", "convenience_store"]),
    set("park", "early", "park-early-2", "Quick runners", ["street_dealers", "smuggling_tunnel"]),
    set("park", "early", "park-early-3", "Night cover", ["strip_club", "convenience_store"]),
    set("park", "mid", "park-mid-1", "Distribution lane", ["drug_lab", "smuggling_tunnel"]),
    set("park", "mid", "park-mid-2", "Vice market", ["strip_club", "street_dealers"]),
    set("park", "mid", "park-mid-3", "Covered traffic", ["smuggling_tunnel", "convenience_store"]),
    set("park", "mid", "park-mid-4", "Hidden production", ["drug_lab", "convenience_store"]),
    set("park", "mid", "park-mid-5", "Night logistics", ["strip_club", "smuggling_tunnel"]),
    set("park", "top", "park-top-1", "Chaos corridor", ["drug_lab", "smuggling_tunnel", "street_dealers"]),
    set("park", "top", "park-top-2", "Vice empire", ["drug_lab", "strip_club"]),
    set("park", "top", "park-top-3", "Black nightlife", ["strip_club", "street_dealers", "convenience_store"]),
    set("park", "top", "park-top-4", "Hot route", ["drug_lab", "smuggling_tunnel", "convenience_store"])
  ],
  industrial: [
    set("industrial", "early", "ind-early-1", "Základní výroba", ["factory", "warehouse"]),
    set("industrial", "early", "ind-early-2", "Napájená produkce", ["factory", "power_station"]),
    set("industrial", "early", "ind-early-3", "První militarizace", ["factory", "armory"]),
    set("industrial", "early", "ind-early-4", "Zásobovací uzel", ["warehouse", "power_station"]),
    set("industrial", "early", "ind-early-5", "Základní recyklace", ["factory", "recycling_center"]),
    set("industrial", "early", "ind-early-6", "Recyklační tok", ["warehouse", "recycling_center"]),
    set("industrial", "mid", "ind-mid-1", "Vojenská výroba", ["armory", "warehouse"]),
    set("industrial", "mid", "ind-mid-2", "Technický provoz", ["factory", "recycling_center"]),
    set("industrial", "mid", "ind-mid-3", "Efektivní řetězec", ["factory", "warehouse", "power_station"]),
    set("industrial", "mid", "ind-mid-4", "Zbrojní logistika", ["armory", "warehouse", "power_station"]),
    set("industrial", "mid", "ind-mid-5", "Recyklační sklad", ["warehouse", "recycling_center"]),
    set("industrial", "mid", "ind-mid-6", "Recyklace a obrana", ["recycling_center", "armory"]),
    set("industrial", "mid", "ind-mid-7", "Obnova zdrojů", ["factory", "recycling_center", "warehouse"]),
    set("industrial", "top", "ind-top-1", "Arms grid", ["factory", "armory", "warehouse"]),
    set("industrial", "top", "ind-top-2", "Power forge", ["factory", "armory", "power_station"]),
    set("industrial", "top", "ind-top-3", "Scrap foundry", ["armory", "recycling_center", "warehouse"]),
    set("industrial", "top", "ind-top-4", "Critical recovery", ["power_station", "recycling_center", "warehouse"]),
    set("industrial", "top", "ind-top-5", "Heavy recycle", ["armory", "recycling_center", "factory"]),
    set("industrial", "top", "ind-top-6", "Circular war industry", ["armory", "recycling_center", "factory"])
  ],
  downtown: [
    set("downtown", "mid", "down-mid-1", "Městské finance", ["central_bank", "city_hall"]),
    set("downtown", "mid", "down-mid-2", "Politický vliv", ["lobby_club", "city_hall"]),
    set("downtown", "mid", "down-mid-3", "Právní tlak", ["court", "lobby_club"]),
    set("downtown", "mid", "down-mid-4", "Volatilní kapitál", ["stock_exchange", "vip_lounge"]),
    set("downtown", "mid", "down-mid-5", "Dopravní manifest", ["airport", "port"]),
    set("downtown", "high", "down-high-1", "Korporátní kontrola", ["central_bank", "lobby_club"]),
    set("downtown", "high", "down-high-2", "Státní pevnost", ["city_hall", "court"]),
    set("downtown", "high", "down-high-3", "Elitní arbitráž", ["court", "vip_lounge"]),
    set("downtown", "high", "down-high-4", "Burzovní manipulace", ["stock_exchange", "lobby_club"]),
    set("downtown", "high", "down-high-5", "Executive chamber", ["city_hall", "vip_lounge"]),
    set("downtown", "high", "down-high-6", "Politický terminál", ["parliament", "airport"]),
    set("downtown", "core", "down-core-1", "Capital nexus", ["central_bank", "city_hall", "vip_lounge"]),
    set("downtown", "core", "down-core-2", "Shadow exchange", ["stock_exchange", "lobby_club", "vip_lounge"]),
    set("downtown", "core", "down-core-3", "Judicial machine", ["city_hall", "court", "lobby_club"]),
    set("downtown", "core", "down-core-4", "System override", ["central_bank", "court", "lobby_club"]),
    set("downtown", "core", "down-core-5", "Capital logistics", ["parliament", "airport", "port"])
  ]
};

const downtownFixedBuildingSetByDistrictId: Record<string, PublicDistrictBuildingSet> = {
  "79": set("downtown", "core", "downtown-fixed-79", "Elitní arbitráž", ["court", "vip_lounge"]),
  "80": set("downtown", "core", "downtown-fixed-80", "Městské finance", ["central_bank"]),
  "81": set("downtown", "core", "downtown-fixed-81", "Politický vliv", ["lobby_club", "central_bank"]),
  "82": set("downtown", "core", "downtown-fixed-82", "Volatilní kapitál", ["stock_exchange"]),
  "83": set("downtown", "core", "downtown-fixed-83", "Právní tlak", ["court"]),
  "58": set("downtown", "core", "downtown-fixed-58", "Městská kontrola", ["city_hall", "parliament"]),
  "57": set("downtown", "core", "downtown-fixed-57", "Lobby síť", ["lobby_club", "airport"]),
  "59": set("downtown", "core", "downtown-fixed-59", "VIP patro", ["vip_lounge", "port"])
};

const fixedBuildingSetByDistrictId: Record<string, PublicDistrictBuildingSet> = {
  "4": set("residential", "early", "residential-fixed-4", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "7": set("residential", "early", "residential-fixed-7", "Stabilní základna", ["apartment_block", "arcade"]),
  "10": set("residential", "early", "residential-fixed-10", "Stabilní základna", ["apartment_block", "arcade"]),
  "15": set("residential", "early", "residential-fixed-15", "Startovní růst", ["apartment_block", "garage"]),
  "19": set("residential", "early", "residential-fixed-19", "Stabilní základna", ["apartment_block", "arcade"]),
  "22": set("residential", "early", "residential-fixed-22", "První nábor", ["apartment_block", "recruitment_center"]),
  "24": set("residential", "early", "residential-fixed-24", "Stabilní základna", ["apartment_block", "arcade"]),
  "28": set("residential", "early", "residential-fixed-28", "Stabilní základna", ["apartment_block", "arcade"]),
  "32": set("residential", "mid", "residential-fixed-32", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "35": set("residential", "mid", "residential-fixed-35", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "40": set("residential", "mid", "residential-fixed-40", "Regenerace fronty", ["recruitment_center", "school"]),
  "44": set("residential", "early", "residential-fixed-44", "První nábor", ["apartment_block", "recruitment_center"]),
  "49": set("residential", "mid", "residential-fixed-49", "Kontrolovaný development", ["apartment_block", "arcade", "clinic"]),
  "54": set("residential", "mid", "residential-fixed-54", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "60": set("residential", "late", "residential-fixed-60", "Mobilní tlak", ["recruitment_center", "school", "clinic"]),
  "65": set("residential", "mid", "residential-fixed-65", "Regenerace fronty", ["recruitment_center", "clinic"]),
  "69": set("residential", "early", "residential-fixed-69", "Stabilní základna", ["apartment_block", "arcade"]),
  "71": set("residential", "mid", "residential-fixed-71", "Regenerace fronty", ["recruitment_center", "clinic"]),
  "74": set("residential", "late", "residential-fixed-74", "Válečné zázemí", ["apartment_block", "recruitment_center", "clinic"]),
  "85": set("residential", "late", "residential-fixed-85", "Mobilní tlak", ["recruitment_center", "garage", "clinic"]),
  "88": set("residential", "late", "residential-fixed-88", "Elitní rezidenční zóna", ["apartment_block", "garage", "clinic"]),
  "90": set("residential", "mid", "residential-fixed-90", "Loajalita a výcvik", ["arcade", "school"]),
  "96": set("residential", "mid", "residential-fixed-96", "Loajalita a výcvik", ["arcade", "school"]),
  "99": set("residential", "mid", "residential-fixed-99", "Loajalita a výcvik", ["arcade", "school"]),
  "101": set("residential", "mid", "residential-fixed-101", "Loajalita a výcvik", ["arcade", "school"]),
  "108": set("residential", "mid", "residential-fixed-108", "Udržitelný růst", ["apartment_block", "clinic"]),
  "115": set("residential", "early", "residential-fixed-115", "Stabilní základna", ["apartment_block", "arcade"]),
  "117": set("residential", "early", "residential-fixed-117", "První nábor", ["apartment_block", "recruitment_center"]),
  "122": set("residential", "mid", "residential-fixed-122", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "126": set("residential", "mid", "residential-fixed-126", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "129": set("residential", "mid", "residential-fixed-129", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "133": set("residential", "early", "residential-fixed-133", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "135": set("residential", "early", "residential-fixed-135", "Startovní růst", ["apartment_block", "garage"]),
  "142": set("residential", "early", "residential-fixed-142", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "147": set("residential", "early", "residential-fixed-147", "Startovní růst", ["apartment_block", "garage"]),
  "151": set("residential", "early", "residential-fixed-151", "První nábor", ["apartment_block", "recruitment_center"]),
  "154": set("residential", "early", "residential-fixed-154", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "160": set("residential", "early", "residential-fixed-160", "Startovní růst", ["apartment_block", "garage"])
};

const tierOrderByZone: Record<string, string[]> = {
  commercial: ["early", "mid", "top"],
  residential: ["early", "mid", "late"],
  park: ["early", "mid", "top"],
  industrial: ["early", "mid", "top"],
  downtown: ["mid", "high", "core"]
};

const normalizedLabelToTypeId = Object.fromEntries(
  publicBuildingDefinitions.flatMap((definition) => [
    [normalizeBuildingName(definition.label), definition.buildingTypeId],
    [normalizeBuildingName(definition.buildingTypeId), definition.buildingTypeId]
  ])
);

export const getBuildingTypeIdForLegacyName = (name: string): string | null =>
  normalizedLabelToTypeId[normalizeBuildingName(name)] ?? null;

export const getBuildingTypesForLegacyNames = (names: readonly string[] | null | undefined): string[] => {
  const buildingTypes = (Array.isArray(names) ? names : [])
    .map((name) => getBuildingTypeIdForLegacyName(String(name || "")))
    .filter((buildingType): buildingType is string => Boolean(buildingType));
  return Array.from(new Set(buildingTypes));
};

export const resolveDistrictBuildingSet = (
  input: ResolveDistrictBuildingTypesInput
): PublicDistrictBuildingSet | null => {
  const zone = normalizeZone(input.zone);
  const pool = publicDistrictBuildingSetPools[zone] ?? [];
  if (pool.length < 1) {
    return null;
  }
  const directSet = input.buildingSetKey
    ? pool.find((candidate) => candidate.key === input.buildingSetKey)
    : null;
  if (directSet) {
    return directSet;
  }
  const fixedSet = fixedBuildingSetByDistrictId[normalizeDistrictIdKey(input.districtId)];
  if (fixedSet && fixedSet.zone === zone) {
    return fixedSet;
  }
  const fixedDowntownSet = zone === "downtown"
    ? downtownFixedBuildingSetByDistrictId[normalizeDistrictIdKey(input.districtId)]
    : null;
  if (fixedDowntownSet) {
    return fixedDowntownSet;
  }
  const tier = resolveDistrictTier(zone, input.districtId, input.buildingTier);
  const tierPool = pool.filter((candidate) => candidate.tier === tier);
  const candidates = tierPool.length > 0 ? tierPool : pool;
  return candidates[hashDistrictSeed(input.districtId) % candidates.length] ?? null;
};

export const resolveDistrictBuildingTypes = (input: ResolveDistrictBuildingTypesInput): string[] => {
  const legacyBuildingTypes = getBuildingTypesForLegacyNames(input.legacyBuildingNames);
  if (legacyBuildingTypes.length > 0) {
    return legacyBuildingTypes;
  }
  return resolveDistrictBuildingSet(input)?.buildingTypes ?? [];
};

const resolveDistrictTier = (zone: string, districtId: string, explicitTier?: string | null): string => {
  const orderedTiers = tierOrderByZone[zone] ?? ["early", "mid", "top"];
  const normalizedTier = String(explicitTier || "").trim().toLowerCase();
  if (orderedTiers.includes(normalizedTier)) {
    return normalizedTier;
  }
  const bucket = hashDistrictSeed(districtId) % 100;
  if (bucket < 40) return orderedTiers[0] ?? "early";
  if (bucket >= 75) return orderedTiers[2] ?? orderedTiers[0] ?? "top";
  return orderedTiers[1] ?? orderedTiers[0] ?? "mid";
};

const normalizeZone = (zone: string | null | undefined): string => {
  const normalized = String(zone || "").trim().toLowerCase();
  return publicDistrictBuildingSetPools[normalized] ? normalized : "residential";
};

function normalizeBuildingName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeDistrictIdKey(value: string): string {
  const match = String(value || "").match(/\d+/u);
  return match?.[0] ?? "";
}

const hashDistrictSeed = (seed: string): number => {
  const text = String(seed || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};
