import { clamp, createSeededRandom } from "../runtime/utils.js";

const MIN_VALID_AREA = 48;
const POINT_EPSILON = 0.001;
const VERTEX_KEY_SCALE = 100;

function clonePoint(point) {
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0)
  };
}

function isSamePoint(left, right) {
  return Math.abs(Number(left?.x ?? 0) - Number(right?.x ?? 0)) <= POINT_EPSILON
    && Math.abs(Number(left?.y ?? 0) - Number(right?.y ?? 0)) <= POINT_EPSILON;
}

function getOpenPolygon(points) {
  const openPoints = Array.isArray(points)
    ? points.map(clonePoint).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];

  if (openPoints.length > 2 && isSamePoint(openPoints[0], openPoints[openPoints.length - 1])) {
    openPoints.pop();
  }

  return openPoints;
}

function closePolygon(points) {
  const openPoints = getOpenPolygon(points);
  if (openPoints.length === 0) {
    return [];
  }

  return [...openPoints, clonePoint(openPoints[0])];
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandomFromParts(...parts) {
  return createSeededRandom(hashString(parts.join(":")));
}

function getVertexKey(point) {
  return `${Math.round(Number(point?.x ?? 0) * VERTEX_KEY_SCALE)}:${Math.round(Number(point?.y ?? 0) * VERTEX_KEY_SCALE)}`;
}

function getEdgeKey(startKey, endKey) {
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function normalizeOrganicConfig(config = {}) {
  const edgeSegments = Math.max(1, Math.min(12, Math.round(Number(config.edgeSegments ?? 5) || 5)));
  return {
    organicEdges: config.organicEdges !== false,
    edgeSegments,
    jitterAmount: Math.max(0, Math.min(24, Number(config.jitterAmount ?? 10) || 0)),
    cornerJitter: Math.max(0, Math.min(12, Number(config.cornerJitter ?? 4) || 0)),
    smoothPasses: Math.max(0, Math.min(3, Math.round(Number(config.smoothPasses ?? 1) || 0))),
    seed: String(config.seed || "empire-streets-map-v1"),
    bounds: config.bounds || null,
    requiredPoint: config.requiredPoint || null
  };
}

function clampPointToBounds(point, bounds) {
  if (!bounds) {
    return point;
  }

  return {
    x: clamp(point.x, Number(bounds.minX ?? 0), Number(bounds.maxX ?? point.x)),
    y: clamp(point.y, Number(bounds.minY ?? 0), Number(bounds.maxY ?? point.y))
  };
}

function isBoundaryPoint(point, bounds) {
  if (!bounds) {
    return false;
  }

  return Math.abs(point.x - Number(bounds.minX ?? point.x)) <= POINT_EPSILON
    || Math.abs(point.x - Number(bounds.maxX ?? point.x)) <= POINT_EPSILON
    || Math.abs(point.y - Number(bounds.minY ?? point.y)) <= POINT_EPSILON
    || Math.abs(point.y - Number(bounds.maxY ?? point.y)) <= POINT_EPSILON;
}

function getJitteredCorner(point, districtId, pointIndex, config) {
  const amount = config.cornerJitter;
  if (amount <= 0) {
    return clonePoint(point);
  }

  const random = createRandomFromParts(config.seed, "district", districtId, "corner", pointIndex);
  return clampPointToBounds({
    x: point.x + ((random() * 2) - 1) * amount,
    y: point.y + ((random() * 2) - 1) * amount
  }, config.bounds);
}

function getSharedCornerPoint(point, vertexKey, config) {
  const amount = config.cornerJitter;
  if (amount <= 0 || isBoundaryPoint(point, config.bounds)) {
    return clonePoint(point);
  }

  const random = createRandomFromParts(config.seed, "shared-corner", vertexKey);
  return clampPointToBounds({
    x: point.x + ((random() * 2) - 1) * amount,
    y: point.y + ((random() * 2) - 1) * amount
  }, config.bounds);
}

function getEdgeJitter(edgeLength, districtId, edgeIndex, segmentIndex, config) {
  const maxJitter = Math.min(config.jitterAmount, edgeLength * 0.18);
  if (maxJitter <= 0) {
    return 0;
  }

  const random = createRandomFromParts(config.seed, "district", districtId, "edge", edgeIndex, "segment", segmentIndex);
  return ((random() * 2) - 1) * maxJitter;
}

function getSharedEdgeJitter(edgeLength, edgeKey, segmentIndex, config) {
  const maxJitter = Math.min(config.jitterAmount, edgeLength * 0.18);
  if (maxJitter <= 0) {
    return 0;
  }

  const random = createRandomFromParts(config.seed, "shared-edge", edgeKey, "segment", segmentIndex);
  return ((random() * 2) - 1) * maxJitter;
}

function smoothOrganicPolygon(points, config) {
  let smoothed = getOpenPolygon(points);

  for (let passIndex = 0; passIndex < config.smoothPasses; passIndex += 1) {
    smoothed = smoothed.map((point, index) => {
      const previous = smoothed[(index - 1 + smoothed.length) % smoothed.length];
      const next = smoothed[(index + 1) % smoothed.length];
      return clampPointToBounds({
        x: previous.x * 0.18 + point.x * 0.64 + next.x * 0.18,
        y: previous.y * 0.18 + point.y * 0.64 + next.y * 0.18
      }, config.bounds);
    });
  }

  return smoothed;
}

function getPolygonArea(points) {
  const polygon = getOpenPolygon(points);
  if (polygon.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

function direction(a, b, c) {
  return ((c.x - a.x) * (b.y - a.y)) - ((b.x - a.x) * (c.y - a.y));
}

function isPointOnSegment(a, b, point) {
  return Math.min(a.x, b.x) - POINT_EPSILON <= point.x
    && point.x <= Math.max(a.x, b.x) + POINT_EPSILON
    && Math.min(a.y, b.y) - POINT_EPSILON <= point.y
    && point.y <= Math.max(a.y, b.y) + POINT_EPSILON
    && Math.abs(direction(a, b, point)) <= POINT_EPSILON;
}

function doSegmentsIntersect(a, b, c, d) {
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);

  if (((d1 > POINT_EPSILON && d2 < -POINT_EPSILON) || (d1 < -POINT_EPSILON && d2 > POINT_EPSILON))
    && ((d3 > POINT_EPSILON && d4 < -POINT_EPSILON) || (d3 < -POINT_EPSILON && d4 > POINT_EPSILON))) {
    return true;
  }

  return isPointOnSegment(c, d, a)
    || isPointOnSegment(c, d, b)
    || isPointOnSegment(a, b, c)
    || isPointOnSegment(a, b, d);
}

function hasSelfIntersection(points) {
  const polygon = getOpenPolygon(points);
  const edgeCount = polygon.length;

  for (let leftIndex = 0; leftIndex < edgeCount; leftIndex += 1) {
    const leftStart = polygon[leftIndex];
    const leftEnd = polygon[(leftIndex + 1) % edgeCount];

    for (let rightIndex = leftIndex + 1; rightIndex < edgeCount; rightIndex += 1) {
      const areAdjacent = Math.abs(leftIndex - rightIndex) <= 1
        || (leftIndex === 0 && rightIndex === edgeCount - 1);
      if (areAdjacent) {
        continue;
      }

      const rightStart = polygon[rightIndex];
      const rightEnd = polygon[(rightIndex + 1) % edgeCount];
      if (doSegmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true;
      }
    }
  }

  return false;
}

function isPointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;
  const openPolygon = getOpenPolygon(polygon);

  for (let index = 0, previousIndex = openPolygon.length - 1; index < openPolygon.length; previousIndex = index, index += 1) {
    const current = openPolygon[index];
    const previous = openPolygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isValidOrganicPolygon(candidatePoints, originalPoints, config) {
  const candidate = getOpenPolygon(candidatePoints);
  const originalArea = getPolygonArea(originalPoints);
  const candidateArea = getPolygonArea(candidate);

  if (candidate.length < 3 || candidateArea < Math.max(MIN_VALID_AREA, originalArea * 0.45)) {
    return false;
  }

  if (candidateArea > originalArea * 1.65 || hasSelfIntersection(candidate)) {
    return false;
  }

  if (config.requiredPoint && !isPointInPolygon(config.requiredPoint, candidate)) {
    return false;
  }

  return true;
}

function createOriginalDistricts(districts) {
  return (Array.isArray(districts) ? districts : [])
    .map((district) => ({
      ...district,
      polygon: closePolygon(district?.polygon)
    }))
    .filter((district) => district.polygon.length >= 4);
}

function createSharedCornerMap(originalDistricts, config) {
  const cornerAccumulators = new Map();

  for (const district of originalDistricts) {
    for (const point of getOpenPolygon(district.polygon)) {
      const key = getVertexKey(point);
      const current = cornerAccumulators.get(key) || {
        x: 0,
        y: 0,
        count: 0,
        boundary: false
      };
      current.x += point.x;
      current.y += point.y;
      current.count += 1;
      current.boundary = current.boundary || isBoundaryPoint(point, config.bounds);
      cornerAccumulators.set(key, current);
    }
  }

  const cornerMap = new Map();

  for (const [key, corner] of cornerAccumulators.entries()) {
    const averaged = {
      x: corner.x / corner.count,
      y: corner.y / corner.count
    };
    cornerMap.set(key, corner.boundary ? averaged : getSharedCornerPoint(averaged, key, config));
  }

  return cornerMap;
}

function createSharedEdgePolyline(startKey, endKey, cornerMap, config) {
  const canonicalStartKey = startKey < endKey ? startKey : endKey;
  const canonicalEndKey = startKey < endKey ? endKey : startKey;
  const edgeKey = getEdgeKey(startKey, endKey);
  const start = cornerMap.get(canonicalStartKey);
  const end = cornerMap.get(canonicalEndKey);

  if (!start || !end) {
    return [];
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const edgeLength = Math.hypot(dx, dy);

  if (edgeLength <= POINT_EPSILON) {
    return [clonePoint(start), clonePoint(end)];
  }

  const normalX = -dy / edgeLength;
  const normalY = dx / edgeLength;
  const polyline = [clampPointToBounds(start, config.bounds)];

  for (let segmentIndex = 1; segmentIndex < config.edgeSegments; segmentIndex += 1) {
    const ratio = segmentIndex / config.edgeSegments;
    const taper = Math.sin(Math.PI * ratio);
    const jitter = getSharedEdgeJitter(edgeLength, edgeKey, segmentIndex, config) * taper;
    polyline.push(clampPointToBounds({
      x: start.x + dx * ratio + normalX * jitter,
      y: start.y + dy * ratio + normalY * jitter
    }, config.bounds));
  }

  polyline.push(clampPointToBounds(end, config.bounds));
  return polyline;
}

function appendPolyline(target, polyline) {
  for (const point of polyline) {
    if (target.length === 0 || !isSamePoint(target[target.length - 1], point)) {
      target.push(clonePoint(point));
    }
  }
}

function buildSharedOrganicDistricts(originalDistricts, config) {
  const cornerMap = createSharedCornerMap(originalDistricts, config);
  const edgePolylines = new Map();

  for (const district of originalDistricts) {
    const polygon = getOpenPolygon(district.polygon);
    for (let index = 0; index < polygon.length; index += 1) {
      const startKey = getVertexKey(polygon[index]);
      const endKey = getVertexKey(polygon[(index + 1) % polygon.length]);
      const edgeKey = getEdgeKey(startKey, endKey);

      if (!edgePolylines.has(edgeKey)) {
        edgePolylines.set(edgeKey, {
          startKey: startKey < endKey ? startKey : endKey,
          endKey: startKey < endKey ? endKey : startKey,
          polyline: createSharedEdgePolyline(startKey, endKey, cornerMap, config)
        });
      }
    }
  }

  return originalDistricts.map((district) => {
    const polygon = getOpenPolygon(district.polygon);
    const organicPoints = [];

    for (let index = 0; index < polygon.length; index += 1) {
      const startKey = getVertexKey(polygon[index]);
      const endKey = getVertexKey(polygon[(index + 1) % polygon.length]);
      const sharedEdge = edgePolylines.get(getEdgeKey(startKey, endKey));

      if (!sharedEdge?.polyline?.length) {
        appendPolyline(organicPoints, [polygon[index], polygon[(index + 1) % polygon.length]]);
        continue;
      }

      appendPolyline(
        organicPoints,
        startKey === sharedEdge.startKey
          ? sharedEdge.polyline
          : [...sharedEdge.polyline].reverse()
      );
    }

    return {
      ...district,
      polygon: closePolygon(organicPoints)
    };
  });
}

function isValidSharedOrganicDistricts(candidateDistricts, originalDistricts, config) {
  if (candidateDistricts.length !== originalDistricts.length) {
    return false;
  }

  return candidateDistricts.every((district, index) => {
    const original = originalDistricts[index];
    return isValidOrganicPolygon(district.polygon, original.polygon, {
      ...config,
      requiredPoint: Number.isFinite(Number(district.centerX)) && Number.isFinite(Number(district.centerY))
        ? { x: Number(district.centerX), y: Number(district.centerY) }
        : null
    });
  });
}

function buildOrganicCandidate(original, districtId, normalizedConfig) {
  const corners = original.map((point, pointIndex) => getJitteredCorner(point, districtId, pointIndex, normalizedConfig));
  const organicPoints = [];

  for (let edgeIndex = 0; edgeIndex < corners.length; edgeIndex += 1) {
    const start = corners[edgeIndex];
    const end = corners[(edgeIndex + 1) % corners.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const edgeLength = Math.hypot(dx, dy);

    if (edgeLength <= POINT_EPSILON) {
      continue;
    }

    const normalX = -dy / edgeLength;
    const normalY = dx / edgeLength;
    organicPoints.push(clampPointToBounds(start, normalizedConfig.bounds));

    for (let segmentIndex = 1; segmentIndex < normalizedConfig.edgeSegments; segmentIndex += 1) {
      const ratio = segmentIndex / normalizedConfig.edgeSegments;
      const taper = Math.sin(Math.PI * ratio);
      const jitter = getEdgeJitter(edgeLength, districtId, edgeIndex, segmentIndex, normalizedConfig) * taper;
      organicPoints.push(clampPointToBounds({
        x: start.x + dx * ratio + normalX * jitter,
        y: start.y + dy * ratio + normalY * jitter
      }, normalizedConfig.bounds));
    }
  }

  const smoothed = smoothOrganicPolygon(organicPoints, normalizedConfig);
  return closePolygon(smoothed);
}

export function createOrganicDistrictPolygon(points, districtId, config = {}) {
  const normalizedConfig = normalizeOrganicConfig(config);
  const original = getOpenPolygon(points);

  if (original.length < 3) {
    return closePolygon(original);
  }

  if (!normalizedConfig.organicEdges) {
    return closePolygon(original);
  }

  const candidate = buildOrganicCandidate(original, districtId, normalizedConfig);
  if (isValidOrganicPolygon(candidate, original, normalizedConfig)) {
    return candidate;
  }

  if (normalizedConfig.cornerJitter > 0) {
    const edgeOnlyConfig = { ...normalizedConfig, cornerJitter: 0 };
    const edgeOnlyCandidate = buildOrganicCandidate(original, districtId, edgeOnlyConfig);
    if (isValidOrganicPolygon(edgeOnlyCandidate, original, edgeOnlyConfig)) {
      return edgeOnlyCandidate;
    }
  }

  return closePolygon(original);
}

export function createOrganicDistrictPolygons(districts, config = {}) {
  const normalizedConfig = normalizeOrganicConfig(config);
  const originalDistricts = createOriginalDistricts(districts);

  if (!normalizedConfig.organicEdges || originalDistricts.length === 0) {
    return originalDistricts;
  }

  const configAttempts = [
    normalizedConfig,
    { ...normalizedConfig, cornerJitter: 0 },
    { ...normalizedConfig, cornerJitter: 0, jitterAmount: normalizedConfig.jitterAmount * 0.5 },
    { ...normalizedConfig, cornerJitter: 0, jitterAmount: 0 }
  ];

  for (const attemptConfig of configAttempts) {
    const candidateDistricts = buildSharedOrganicDistricts(originalDistricts, attemptConfig);
    if (isValidSharedOrganicDistricts(candidateDistricts, originalDistricts, attemptConfig)) {
      return candidateDistricts;
    }
  }

  return originalDistricts;
}
