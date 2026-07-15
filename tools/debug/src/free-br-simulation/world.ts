import { FREE_BR_DISTRICT_COUNT, FREE_BR_DOWNTOWN_COUNT, FREE_BR_PLAYER_COUNT } from "./constants";
import { distance } from "./math";
import type { SeededRng } from "./seeded-rng";
import type { FreeBrDistrict, FreeBrDistrictZone } from "./types";

export const createWorldDistricts = (rng: SeededRng): FreeBrDistrict[] => {
  const coords: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 13; y += 1) {
    for (let x = 0; x < 13; x += 1) coords.push({ x, y });
  }
  const removed = new Set(["0:0", "1:0", "0:1", "12:0", "11:0", "12:1", "0:12", "12:12"]);
  const kept = coords.filter((coord) => !removed.has(`${coord.x}:${coord.y}`));
  const center = { x: 6, y: 6 };
  const downtownCoords = new Set(
    [...kept]
      .sort((left, right) => distance(left, center) - distance(right, center))
      .slice(0, FREE_BR_DOWNTOWN_COUNT)
      .map((coord) => `${coord.x}:${coord.y}`)
  );
  const idByCoord = new Map<string, number>();
  kept.forEach((coord, index) => idByCoord.set(`${coord.x}:${coord.y}`, index + 1));
  const downtownBuildings = ["stock_exchange", "central_bank", "airport", "city_hall", "courthouse", "vip_lounge", "port", "parliament"];
  const commonByZone: Record<Exclude<FreeBrDistrictZone, "downtown">, string[]> = {
    residential: ["apartment_block", "school", "clinic", "recruitment_center"],
    commercial: ["restaurant", "exchange", "arcade", "shopping_mall", "convenience_store", "pharmacy"],
    industrial: ["factory", "armory", "warehouse", "garage", "car_dealer", "power_station", "recycling_center"],
    park: ["street_dealers", "drug_lab", "smuggling_tunnel", "strip_club", "casino"]
  };
  let downtownIndex = 0;
  return kept.map((coord, index) => {
    const id = index + 1;
    const isDowntown = downtownCoords.has(`${coord.x}:${coord.y}`);
    const commonZone = isDowntown ? null : resolveZone(coord, rng);
    const zone: FreeBrDistrictZone = commonZone ?? "downtown";
    const buildingType = isDowntown
      ? downtownBuildings[downtownIndex++ % downtownBuildings.length] ?? "central_bank"
      : rng.pick(commonByZone[commonZone ?? "residential"]);
    return {
      id,
      zone,
      ownerPlayerId: null,
      status: "neutral",
      influence: isDowntown ? 35 : rng.int(4, 16),
      heat: 0,
      buildingType,
      adjacentDistrictIds: [
        idByCoord.get(`${coord.x - 1}:${coord.y}`),
        idByCoord.get(`${coord.x + 1}:${coord.y}`),
        idByCoord.get(`${coord.x}:${coord.y - 1}`),
        idByCoord.get(`${coord.x}:${coord.y + 1}`)
      ].filter((value): value is number => Boolean(value)),
      value: isDowntown ? rng.int(8, 12) : rng.int(2, 6),
      baseDefense: isDowntown ? rng.int(22, 34) : rng.int(8, 18),
      isDowntown,
      ownerHistory: [{ tick: 0, ownerPlayerId: null }]
    };
  });
};

export const chooseStartDistrictIds = (districts: FreeBrDistrict[]): number[] => {
  const center = Math.ceil(FREE_BR_DISTRICT_COUNT / 2);
  const candidates = districts
    .filter((district) => !district.isDowntown)
    .sort((left, right) => Math.abs(right.id - center) - Math.abs(left.id - center));
  const step = Math.max(1, Math.floor(candidates.length / FREE_BR_PLAYER_COUNT));
  return Array.from({ length: FREE_BR_PLAYER_COUNT }, (_, index) => candidates[(index * step) % candidates.length]?.id ?? index + 1);
};

const resolveZone = (coord: { x: number; y: number }, rng: SeededRng): Exclude<FreeBrDistrictZone, "downtown"> => {
  if ((coord.x + coord.y) % 7 === 0) return "park";
  if (coord.x % 3 === 0) return "industrial";
  if (coord.y % 3 === 0) return "commercial";
  return rng.pick(["residential", "commercial", "industrial", "park"] as const);
};
