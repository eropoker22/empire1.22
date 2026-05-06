import {
  MAP_BASE_DISTRICT_TYPES,
  MAP_DEFAULT_DISTRICT_TYPE,
  MAP_DISTRICT_GEOMETRY_TOP_INSET,
  MAP_DOWNTOWN_DISTRICT_TYPE,
  DISTRICT_SHAPE_CONFIG,
  MAP_GEOMETRY_NEIGHBOR_LIMIT,
  MAP_GEOMETRY_SEED,
  MAP_GRID_COLUMNS,
  MAP_GRID_ROWS
} from "./mapConstants.js";
import {
  clamp,
  createSeededRandom,
  hashCell
} from "../runtime/utils.js";
import {
  createOrganicDistrictPolygon,
  createOrganicDistrictPolygons
} from "./organicDistrictPolygon.js";

export {
  createOrganicDistrictPolygon,
  createOrganicDistrictPolygons
} from "./organicDistrictPolygon.js";

export function isDowntownCell(rowIndex, columnIndex) {
  const isDowntownRow = rowIndex === 3 || rowIndex === 4;
  const isDowntownColumn = columnIndex >= 9 && columnIndex <= 12;
  return isDowntownRow && isDowntownColumn;
}

export function createDistrictTypeGrid(rows = MAP_GRID_ROWS, columns = MAP_GRID_COLUMNS) {
  const districtTypes = MAP_BASE_DISTRICT_TYPES;
  const grid = Array.from({ length: rows }, () => Array(columns).fill(null));
  const counts = Object.fromEntries(districtTypes.map((type) => [type, 0]));
  const targetCount = Math.floor(((rows * columns) - 8) / districtTypes.length);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      if (isDowntownCell(rowIndex, columnIndex)) {
        grid[rowIndex][columnIndex] = MAP_DOWNTOWN_DISTRICT_TYPE;
        continue;
      }

      const neighborOffsets = [
        [0, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1],
        [0, -2],
        [-2, 0]
      ];
      const scoredTypes = districtTypes.map((type) => {
        let score = counts[type] > targetCount ? 3 : 0;

        for (const [rowOffset, columnOffset] of neighborOffsets) {
          const neighborRow = rowIndex + rowOffset;
          const neighborColumn = columnIndex + columnOffset;
          const neighborType = grid[neighborRow]?.[neighborColumn];

          if (neighborType !== type) {
            continue;
          }

          if (rowOffset === 0 && Math.abs(columnOffset) === 1) {
            score += 14;
          } else if (Math.abs(rowOffset) === 1 && Math.abs(columnOffset) <= 1) {
            score += 11;
          } else {
            score += 5;
          }
        }

        score += (hashCell(rowIndex + counts[type] + 31, columnIndex + type.length + 17) % 7) * 0.1;
        return { type, score };
      });

      scoredTypes.sort((left, right) => left.score - right.score);
      const chosenType = scoredTypes[0].type;
      grid[rowIndex][columnIndex] = chosenType;
      counts[chosenType] += 1;
    }
  }

  return grid;
}

export const DISTRICT_TYPE_GRID = createDistrictTypeGrid(MAP_GRID_ROWS, MAP_GRID_COLUMNS);

export function classifyDistrictType(rowIndex, columnIndex, grid = DISTRICT_TYPE_GRID) {
  return grid[rowIndex]?.[columnIndex] || MAP_DEFAULT_DISTRICT_TYPE;
}

export function remapDistrictId(districtId) {
  if (districtId === 57) {
    return 104;
  }

  if (districtId === 104) {
    return 57;
  }

  if (districtId === 58) {
    return 103;
  }

  if (districtId === 103) {
    return 58;
  }

  if (districtId === 102) {
    return 83;
  }

  if (districtId === 83) {
    return 102;
  }

  if (districtId === 59) {
    return 105;
  }

  if (districtId === 105) {
    return 59;
  }

  return districtId;
}

export function remapDistrictType(districtId, typeByDistrictId) {
  return typeByDistrictId.get(remapDistrictId(districtId)) || typeByDistrictId.get(districtId) || MAP_DEFAULT_DISTRICT_TYPE;
}

export function createLaunchOwnerMap(startCoordinates = [], options = {}) {
  const ownerMap = new Map();
  const columns = Number(options.columns || MAP_GRID_COLUMNS);

  for (let index = 0; index < startCoordinates.length; index += 1) {
    const [rowIndex, columnIndex] = startCoordinates[index];
    const rawDistrictId = rowIndex * columns + columnIndex + 1;
    ownerMap.set(remapDistrictId(rawDistrictId), index + 1);
  }

  return ownerMap;
}

export function createStops(segmentCount, totalSize, random) {
  const step = totalSize / segmentCount;
  const stops = Array.from({ length: segmentCount + 1 }, (_, index) => index * step);

  for (let index = 1; index < stops.length - 1; index += 1) {
    const jitter = (random() - 0.5) * step * 0.18;
    stops[index] += jitter;
  }

  stops[0] = 0;
  stops[stops.length - 1] = totalSize;
  return stops;
}

export function clipPolygonAgainstBisector(polygon, site, otherSite) {
  const dx = otherSite.x - site.x;
  const dy = otherSite.y - site.y;
  const midpointX = (site.x + otherSite.x) / 2;
  const midpointY = (site.y + otherSite.y) / 2;
  const signedDistance = (point) => ((point.x - midpointX) * dx) + ((point.y - midpointY) * dy);
  const clipped = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentDistance = signedDistance(current);
    const nextDistance = signedDistance(next);
    const currentInside = currentDistance <= 0;
    const nextInside = nextDistance <= 0;

    if (currentInside) {
      clipped.push(current);
    }

    if (currentInside !== nextInside) {
      const denominator = currentDistance - nextDistance;
      const ratio = Math.abs(denominator) < 0.00001 ? 0 : currentDistance / denominator;

      clipped.push({
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio
      });
    }
  }

  return clipped;
}

export function createDistrictGeometry(width, height, insetX = 0, insetTop = MAP_DISTRICT_GEOMETRY_TOP_INSET, insetBottom = 0, options = {}) {
  const columns = MAP_GRID_COLUMNS;
  const rows = MAP_GRID_ROWS;
  const geometryOptions = options && typeof options === "object" ? options : {};
  const random = createSeededRandom(MAP_GEOMETRY_SEED);
  const innerWidth = width - insetX * 2;
  const innerHeight = height - insetTop - insetBottom;
  const xStops = createStops(columns, innerWidth, random).map((value) => value + insetX);
  const yStops = createStops(rows, innerHeight, random).map((value) => value + insetTop);
  const districts = [];
  const sites = [];
  const typeByDistrictId = new Map();
  const districtShapeConfig = {
    ...DISTRICT_SHAPE_CONFIG,
    ...(geometryOptions.districtShapeConfig || geometryOptions.shapeConfig || {}),
    bounds: {
      minX: insetX,
      minY: insetTop,
      maxX: width - insetX,
      maxY: height - insetBottom
    }
  };
  let districtId = 1;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cellLeft = xStops[columnIndex];
      const cellRight = xStops[columnIndex + 1];
      const cellTop = yStops[rowIndex];
      const cellBottom = yStops[rowIndex + 1];
      const cellWidth = cellRight - cellLeft;
      const cellHeight = cellBottom - cellTop;
      const districtType = classifyDistrictType(rowIndex, columnIndex);
      const siteHash = hashCell(rowIndex + 101, columnIndex + 131);
      const staggerOffset = rowIndex % 2 === 0 ? cellWidth * 0.14 : -cellWidth * 0.14;
      const centerX = (cellLeft + cellRight) / 2
        + staggerOffset
        + ((siteHash % 7) - 3) * cellWidth * 0.035;
      const centerY = (cellTop + cellBottom) / 2
        + (((Math.floor(siteHash / 7)) % 7) - 3) * cellHeight * 0.045;

      sites.push({
        id: districtId,
        rowIndex,
        columnIndex,
        districtType,
        x: clamp(centerX, cellLeft + cellWidth * 0.16, cellRight - cellWidth * 0.16),
        y: clamp(centerY, cellTop + cellHeight * 0.18, cellBottom - cellHeight * 0.18)
      });
      typeByDistrictId.set(districtId, districtType);

      districtId += 1;
    }
  }

  for (const site of sites) {
    let polygon = [
      { x: insetX, y: insetTop },
      { x: width - insetX, y: insetTop },
      { x: width - insetX, y: height - insetBottom },
      { x: insetX, y: height - insetBottom }
    ];

    const candidateNeighbors = sites
      .filter((otherSite) => otherSite.id !== site.id)
      .map((otherSite) => ({
        otherSite,
        distance: ((otherSite.x - site.x) ** 2) + ((otherSite.y - site.y) ** 2)
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, MAP_GEOMETRY_NEIGHBOR_LIMIT);

    for (const { otherSite } of candidateNeighbors) {
      polygon = clipPolygonAgainstBisector(polygon, site, otherSite);

      if (polygon.length < 3) {
        break;
      }
    }

    if (polygon.length >= 3) {
      const mappedDistrictId = remapDistrictId(site.id);
      districts.push({
        id: mappedDistrictId,
        rowIndex: site.rowIndex,
        columnIndex: site.columnIndex,
        districtType: remapDistrictType(site.id, typeByDistrictId),
        centerX: site.x,
        centerY: site.y,
        polygon
      });
    }
  }

  return {
    districts: createOrganicDistrictPolygons(districts, districtShapeConfig),
    xStops,
    yStops,
    width,
    height
  };
}

export function isPointInDistrict(point, district) {
  if (!point || !Array.isArray(district?.polygon) || district.polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previousIndex = district.polygon.length - 1; index < district.polygon.length; previousIndex = index, index += 1) {
    const current = district.polygon[index];
    const previous = district.polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getDistrictAtPoint(geometry, point) {
  if (!geometry || !Array.isArray(geometry.districts) || !point) {
    return null;
  }

  for (let index = geometry.districts.length - 1; index >= 0; index -= 1) {
    const district = geometry.districts[index];

    if (isPointInDistrict(point, district)) {
      return district;
    }
  }

  return null;
}

export function getAdjacentDistrictIdsFromGeometry(geometry, districtId) {
  if (!geometry?.districts || districtId === null || districtId === undefined) {
    return [];
  }

  const targetDistrict = geometry.districts.find((district) => district.id === Number(districtId));

  if (!targetDistrict) {
    return [];
  }

  return geometry.districts
    .filter((district) => {
      const rowDistance = Math.abs(district.rowIndex - targetDistrict.rowIndex);
      const columnDistance = Math.abs(district.columnIndex - targetDistrict.columnIndex);
      return district.id !== targetDistrict.id && ((rowDistance === 1 && columnDistance === 0) || (rowDistance === 0 && columnDistance === 1));
    })
    .map((district) => district.id);
}
