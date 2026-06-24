import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDistrictGeometry
} from "../page-assets/js/app/map/mapGeometry.js";

// One-time migration helper. The active source of truth is now
// packages/game-config/src/maps/empire-streets-city-map.json.

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(rootDir, "packages/game-config/src/maps/empire-streets-city-map.json");

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 980;
const EDGE_KEY_SCALE = 100;

const zoneByLegacyType = {
  economy: "commercial",
  industrial: "industrial",
  resident: "residential",
  park: "park",
  downtown: "downtown"
};

const spawnZonesByLegacyId = new Map([
  [1, ["west"]],
  [24, ["west"]],
  [47, ["west"]],
  [70, ["west"]],
  [93, ["west"]],
  [116, ["west"]],
  [139, ["west", "south"]],
  [23, ["east", "south"]],
  [46, ["east"]],
  [69, ["east"]],
  [92, ["east"]],
  [115, ["east"]],
  [138, ["east"]],
  [161, ["east"]],
  [142, ["south"]],
  [146, ["south"]],
  [149, ["south"]],
  [152, ["south"]],
  [155, ["south"]],
  [159, ["south"]]
]);

function normalizeNumber(value) {
  return Number(Number(value).toFixed(3));
}

function getOpenPolygon(polygon) {
  const points = polygon.map((point) => ({
    x: normalizeNumber(point.x),
    y: normalizeNumber(point.y)
  }));
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first.x === last.x && first.y === last.y) {
    points.pop();
  }
  return points;
}

function pointKey(point) {
  return `${Math.round(point.x * EDGE_KEY_SCALE)}:${Math.round(point.y * EDGE_KEY_SCALE)}`;
}

function edgeKey(left, right) {
  const leftKey = pointKey(left);
  const rightKey = pointKey(right);
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

function edgeLength(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function deriveNeighborIds(districts) {
  const edgeOwners = new Map();

  for (const district of districts) {
    const polygon = district.polygon;
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (edgeLength(start, end) < 0.25) {
        continue;
      }
      const key = edgeKey(start, end);
      const owners = edgeOwners.get(key) ?? new Set();
      owners.add(district.id);
      edgeOwners.set(key, owners);
    }
  }

  const neighborSets = new Map(districts.map((district) => [district.id, new Set()]));
  for (const owners of edgeOwners.values()) {
    if (owners.size < 2) {
      continue;
    }
    const ids = [...owners];
    for (const left of ids) {
      for (const right of ids) {
        if (left !== right) {
          neighborSets.get(left)?.add(right);
        }
      }
    }
  }

  return Object.fromEntries(
    [...neighborSets.entries()].map(([id, neighbors]) => [
      id,
      [...neighbors].sort((left, right) => Number(left.replace("district:", "")) - Number(right.replace("district:", "")))
    ])
  );
}

function createManifest() {
  const geometry = createDistrictGeometry(CANVAS_WIDTH, CANVAS_HEIGHT);
  const districts = geometry.districts
    .map((district) => {
      const legacyId = Number(district.id);
      const id = `district:${legacyId}`;
      const zone = zoneByLegacyType[district.districtType] ?? "residential";
      const spawnZones = spawnZonesByLegacyId.get(legacyId) ?? [];
      return {
        id,
        legacyId,
        rowIndex: district.rowIndex,
        columnIndex: district.columnIndex,
        name: `District ${legacyId}`,
        zone,
        polygon: getOpenPolygon(district.polygon),
        neighborIds: [],
        ...(spawnZones.length > 0 ? { spawnZones, isSpawnCandidate: true } : {}),
        ...(zone === "downtown" ? { isDowntown: true } : {})
      };
    })
    .sort((left, right) => left.legacyId - right.legacyId);
  const neighborsById = deriveNeighborIds(districts);

  return {
    id: "empire-streets-city",
    version: 1,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    districts: districts.map((district) => ({
      ...district,
      neighborIds: neighborsById[district.id] ?? []
    }))
  };
}

const manifest = createManifest();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath} (${manifest.districts.length} districts).`);
