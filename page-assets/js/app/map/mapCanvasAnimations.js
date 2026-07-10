import { getAllianceIconById, getAllianceIconByTag } from "../alliance-icons.js";

function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }
  return Math.min(max, Math.max(min, numericValue));
}

function createFallbackSeededRandom(seed = 1) {
  let value = Number.isFinite(Number(seed)) ? Number(seed) : 1;
  return function nextRandom() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function getFallbackPolygonBounds(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  polygon.forEach((point) => {
    const x = Number(point?.x || 0);
    const y = Number(point?.y || 0);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function noopDrawPolygonPath() {
  return false;
}

function noopDrawPolygon() {
  return false;
}

function fallbackHexToRgbParts(color) {
  const hex = String(color || '#67e1ff').replace('#', '').trim();
  const normalized = hex.length === 3
    ? hex.split('').map((part) => part + part).join('')
    : hex.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) || 0);
}

const ALLIANCE_CANVAS_ICON_DEFINITIONS = Object.freeze({
  bull: { paths: ["M11 18c14 0 25 7 32 20h14c7-13 18-20 32-20-4 16-12 27-25 32l7 20-21 22-21-22 7-20C23 45 15 34 11 18Zm28 35-5 15 16 17 16-17-5-15H39Zm-2-4c4-4 8-6 13-6s9 2 13 6H37Z"], circles: [{ cx: 40, cy: 62, r: 4 }, { cx: 60, cy: 62, r: 4 }] },
  claw: { paths: ["M26 11h15L28 88H12l14-77Zm26 0h15L50 88H34l18-77Zm27 0h15L72 88H56l23-77Z"] },
  cobra: { paths: ["M50 8c22 4 36 22 36 48 0 18-14 32-36 36-22-4-36-18-36-36C14 30 28 12 50 8Zm0 13c-12 8-18 19-18 34 0 12 6 20 18 24 12-4 18-12 18-24 0-15-6-26-18-34Z", "M38 45c8-4 16-4 24 0l-6 10H44l-6-10Zm2 22h20l-10 13-10-13Z"], circles: [{ cx: 42, cy: 39, r: 4 }, { cx: 58, cy: 39, r: 4 }] },
  crown: { paths: ["M12 32 32 52 50 16l18 36 20-20-8 50H20L12 32Zm18 39h40l2-14-10 9-12-25-12 25-10-9 2 14Z", "M24 87h52v8H24v-8Z"] },
  dagger: { paths: ["M54 8 67 21 45 66 34 55 54 8Z", "M28 55 45 72l-9 9-17-17 9-9Zm-9 26 8 8-8 8-8-8 8-8Zm13-31 23 23-7 7-23-23 7-7Z"] },
  eye: { paths: ["M6 50c12-21 27-32 44-32s32 11 44 32C82 71 67 82 50 82S18 71 6 50Zm44-19c-11 0-20 8-20 19s9 19 20 19 20-8 20-19-9-19-20-19Z"], circles: [{ cx: 50, cy: 50, r: 10 }] },
  fangs: { paths: ["M20 12c18 7 30 17 36 31L37 92C24 70 18 44 20 12Zm60 0c2 32-4 58-17 80L44 43c6-14 18-24 36-31Z", "M38 24h24v12H38V24Z"] },
  fist: { paths: ["M18 39c0-7 5-12 12-12 3 0 5 1 7 3 1-7 6-11 13-11 6 0 10 3 12 8 2-2 5-3 8-3 7 0 12 5 12 12v28c0 16-12 27-32 27S18 80 18 64V39Zm13 2v21h9V41h-9Zm18-10v31h9V31h-9Zm18 6v25h8V37h-8ZM28 70c3 7 10 10 22 10s19-3 22-10H28Z"] },
  ghost: { paths: ["M50 10c20 0 34 15 34 36v44l-12-9-10 9-12-9-12 9-10-9-12 9V46c0-21 14-36 34-36Zm-14 39c6 0 10-4 10-10-9-3-17 0-20 7 2 2 5 3 10 3Zm28 0c5 0 8-1 10-3-3-7-11-10-20-7 0 6 4 10 10 10Z"] },
  hydra: { paths: ["M18 25 35 8l14 17-10 12 11 18 11-18-10-12L65 8l17 17-10 13 12 13-14 12-12-14v34H42V49L30 63 16 51l12-13-10-13Z"], circles: [{ cx: 35, cy: 28, r: 4 }, { cx: 65, cy: 28, r: 4 }, { cx: 50, cy: 40, r: 4 }] },
  jackal: { paths: ["M20 10 43 33l7-17 7 17 23-23-9 49-21 32-21-32-9-49Zm18 42-9-8 4 17 12 6-7-15Zm24 0-7 15 12-6 4-17-9 8ZM42 73h16l-8 13-8-13Z"] },
  mask: { paths: ["M14 31c24-13 48-13 72 0l-9 38c-11 14-24 21-27 21s-16-7-27-21L14 31Zm19 23c8-4 16-4 24 1-8 10-18 12-30 4l6-5Zm34 0 6 5c-12 8-22 6-30-4 8-5 16-5 24-1ZM40 72h20L50 82 40 72Z"] },
  raven: { paths: ["M15 55c20-28 44-39 74-32-15 5-26 13-33 25l32 6-36 9-18 25-2-23-17-10Z", "M57 35c6-6 15-9 27-9-10 5-16 10-19 16l-8-7Z"], circles: [{ cx: 61, cy: 40, r: 3 }] },
  reaper: { paths: ["M50 10c-18 3-31 18-31 39 0 17 9 31 22 36v-9h-8V62h7l-7-8 8-10 9 8 9-8 8 10-7 8h7v14h-8v9c13-5 22-19 22-36 0-21-13-36-31-39Zm-9 50c-5 0-9-3-9-8 8-3 14-1 18 5-2 2-5 3-9 3Zm18 0c-4 0-7-1-9-3 4-6 10-8 18-5 0 5-4 8-9 8Z", "M72 15c12 10 18 24 18 42 0 12-4 23-11 32 2-12 3-23 1-33-2-18-9-31-8-41Z"] },
  scorpion: { paths: ["M37 36h26l10 18-10 18H37L27 54l10-18Zm8 12v12h10V48H45Z", "M28 43 12 33l7-8 15 13-6 5Zm44 0 16-10-7-8-15 13 6 5ZM28 65 12 77l7 8 15-15-6-5Zm44 0 16 12-7 8-15-15 6-5ZM50 36c0-14 8-24 22-27l7 12-12-2c-6 4-8 10-8 17h-9Z", "M78 9 94 20 82 31l-5-10 1-12Z"] },
  skull: { paths: ["M50 10c22 0 37 15 37 36 0 15-7 26-20 31v13H33V77C20 72 13 61 13 46c0-21 15-36 37-36ZM34 53c8 0 13-5 13-13-12-3-22 1-25 9 2 3 6 4 12 4Zm32 0c6 0 10-1 12-4-3-8-13-12-25-9 0 8 5 13 13 13ZM44 70h12l-6-13-6 13Zm-1 9v9h5v-9h-5Zm9 0v9h5v-9h-5Z"] },
  snake: { paths: ["M54 12c20 0 34 15 34 33 0 16-11 29-28 29H35c-7 0-12 3-12 8 0 4 4 7 11 7h28v-9H35c-15 0-25-7-25-18 0-12 10-20 25-20h25c7 0 12-4 12-10 0-7-6-12-16-12H35v12L12 22 35 8v12h19Z"], circles: [{ cx: 61, cy: 32, r: 4 }] },
  spider: { paths: ["M33 42 12 30l4-8 23 15-6 5Zm34 0 21-12-4-8-23 15 6 5ZM30 55 8 54v-9l24 3-2 7Zm40 0 22-1v-9l-24 3 2 7ZM32 68 14 82l6 7 19-17-7-4Zm36 0 18 14-6 7-19-17 7-4ZM40 28 29 11l8-4 9 18-6 3Zm20 0L71 11l-8-4-9 18 6 3Z"], circles: [{ cx: 50, cy: 34, r: 12 }, { cx: 50, cy: 58, r: 17 }] },
  vulture: { paths: ["M11 31c25-12 47-10 69 5l10-8-4 22-23 4 9-9c-14-6-27-8-39-4l16 13-7 35-10-31-21-27Z", "M58 28c8-10 19-13 32-9-11 3-18 8-21 15l-11-6Z"], circles: [{ cx: 65, cy: 35, r: 3 }] },
  wolf: { paths: ["M16 14 36 28l14-15 14 15 20-14-8 33-26 40-26-40-8-33Zm24 34-12-6 7 16 12 4-7-14Zm20 0-7 14 12-4 7-16-12 6ZM39 67l11 17 11-17H39Z"] }
});

export function createMapCanvasAnimationRenderers(deps = {}) {
  const {
    getPolygonBounds = getFallbackPolygonBounds,
    drawDistrictPolygonPath = noopDrawPolygonPath,
    drawDistrictPolygon = noopDrawPolygon,
    createSeededRandom = createFallbackSeededRandom,
    clamp = clampNumber,
    getLaunchPlayerColor = () => '#67e1ff',
    getCurrentPlayerGangColor = () => '#67e1ff',
    getCurrentPlayerFactionGlyph = () => '◆',
    hexToRgbParts = fallbackHexToRgbParts,
    currentPlayerId = 'current-player',
    reducedActivityFallbackColor = '#67e1ff',
    windowRef = typeof window !== 'undefined' ? window : null,
    ImageCtor = windowRef?.Image || globalThis.Image,
    documentRef = windowRef?.document || globalThis.document
  } = deps;
  const allianceIconImageCache = new Map();
  const allianceIconTintCache = new Map();

function isPointInsidePolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function resolveAttackFlameAnchorCount(bounds) {
  const width = Math.max(20, Number(bounds?.width || 0));
  const height = Math.max(20, Number(bounds?.height || 0));
  const area = width * height;
  return Math.max(3, Math.min(8, Math.round(area / 8800) + 3));
}

function createAttackFlameAnchors(district, marker, bounds) {
  const polygon = Array.isArray(district?.polygon) ? district.polygon : [];

  if (polygon.length < 3) {
    return [];
  }

  const safeBounds = bounds && Number.isFinite(bounds.width) ? bounds : getPolygonBounds(polygon);
  const width = Math.max(20, safeBounds.width || 0);
  const height = Math.max(20, safeBounds.height || 0);
  const targetCount = resolveAttackFlameAnchorCount(safeBounds);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 1;
  const random = createSeededRandom(safeSeed ^ 0x4c7f9d1b);
  const anchors = [];

  let tries = 0;
  const maxTries = targetCount * 90;

  while (anchors.length < targetCount && tries < maxTries) {
    const candidate = {
      x: safeBounds.minX + random() * width,
      y: safeBounds.minY + random() * height
    };

    if (!isPointInsidePolygon(candidate, polygon)) {
      tries += 1;
      continue;
    }

    const tooClose = anchors.some((existing) => Math.hypot(candidate.x - existing.x, candidate.y - existing.y) < Math.min(width, height) * 0.16);

    if (tooClose) {
      tries += 1;
      continue;
    }

    anchors.push({
      ...candidate,
      scale: 0.62 + random() * 0.9,
      phase: random() * Math.PI * 2,
      jitter: 0.45 + random() * 0.65
    });
    tries += 1;
  }

  return anchors;
}

function getAttackFlameAnchors(district, marker, bounds) {
  if (!marker || typeof marker !== "object") {
    return [];
  }

  if (!Array.isArray(marker.flameAnchors) || !marker.flameAnchors.length) {
    marker.flameAnchors = createAttackFlameAnchors(district, marker, bounds);
  }

  return marker.flameAnchors;
}

function drawAttackAmbientSmokeAroundDistrict(context, marker, now, centerX, centerY, bounds, pulse, lifeRatio) {
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
  const spreadBase = Math.max(34, Math.min(120, Math.max(bounds.width || 34, bounds.height || 34) * 0.6));
  const intensity = Math.max(0.06, 0.18 - lifeRatio * 0.06);

  context.save();
  context.globalCompositeOperation = "source-over";

  for (let index = 0; index < 4; index += 1) {
    const angle = (Math.PI * 2 * index) / 4 + (safeSeed % 31) * 0.04;
    const drift = Math.sin(now / 980 + index * 0.7 + safeSeed * 0.00007);
    const smokeX = centerX + Math.cos(angle) * spreadBase * (0.42 + index * 0.08) + drift * spreadBase * 0.08;
    const smokeY = centerY + Math.sin(angle) * spreadBase * (0.26 + index * 0.06) - spreadBase * 0.14;
    const radius = spreadBase * (0.95 + pulse * 0.2 + index * 0.18);
    const coreAlpha = intensity * (0.65 - index * 0.1);

    if (coreAlpha <= 0.01) {
      continue;
    }

    const gradient = context.createRadialGradient(smokeX, smokeY, radius * 0.12, smokeX, smokeY, radius);
    gradient.addColorStop(0, `rgba(26, 26, 30, ${coreAlpha.toFixed(3)})`);
    gradient.addColorStop(0.6, `rgba(18, 18, 22, ${(coreAlpha * 0.55).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(10, 10, 12, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAttackSmokeInDistrict(context, district, marker, now, centerX, centerY, bounds, pulse, lifeRatio) {
  if (!drawDistrictPolygonPath(context, district.polygon)) {
    return;
  }

  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
  const random = createSeededRandom(safeSeed ^ 0x1e3d5a77);
  const baseRadius = Math.max(16, Math.min(52, Math.min(bounds.width || 16, bounds.height || 16) * 0.42));
  const smokeStrength = Math.max(0.24, 0.52 - lifeRatio * 0.17);

  context.save();
  drawDistrictPolygonPath(context, district.polygon);
  context.clip();

  for (let index = 0; index < 8; index += 1) {
    const drift = Math.sin(now / 820 + index * 0.62 + safeSeed * 0.00013);
    const x = centerX + (random() - 0.5) * baseRadius * 1.6 + drift * baseRadius * 0.14;
    const y = centerY - baseRadius * (0.32 + random() * 0.3) - Math.abs(drift) * baseRadius * 0.18;
    const radius = baseRadius * (0.65 + random() * 0.85 + pulse * 0.16);
    const alphaCore = smokeStrength * (0.7 + random() * 0.3);
    const alphaMid = alphaCore * 0.62;
    const gradient = context.createRadialGradient(x, y, radius * 0.16, x, y, radius);
    gradient.addColorStop(0, `rgba(28, 28, 32, ${alphaCore.toFixed(3)})`);
    gradient.addColorStop(0.58, `rgba(20, 20, 24, ${alphaMid.toFixed(3)})`);
    gradient.addColorStop(1, "rgba(12, 12, 14, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAttackFlameSprite(context, x, y, size, alpha, phase, pulse) {
  const safeSize = Math.max(10, Number(size || 0));
  const safeAlpha = Math.max(0.12, Math.min(1, Number(alpha || 0)));
  const wobble = Math.sin(Date.now() / 140 + Number(phase || 0)) * safeSize * 0.05;

  context.save();
  context.translate(x, y);
  context.scale(1 + pulse * 0.04, 1 + pulse * 0.08);
  context.globalAlpha = safeAlpha;

  const outerGradient = context.createLinearGradient(0, safeSize * 0.62, 0, -safeSize * 0.88);
  outerGradient.addColorStop(0, "rgba(120, 16, 0, 0.96)");
  outerGradient.addColorStop(0.36, "rgba(255, 94, 0, 0.94)");
  outerGradient.addColorStop(0.72, "rgba(255, 174, 36, 0.9)");
  outerGradient.addColorStop(1, "rgba(255, 241, 153, 0.84)");

  context.beginPath();
  context.moveTo(0, -safeSize * 0.92 + wobble);
  context.bezierCurveTo(
    safeSize * 0.52, -safeSize * 0.48,
    safeSize * 0.62, safeSize * 0.04,
    0, safeSize * 0.7
  );
  context.bezierCurveTo(
    -safeSize * 0.62, safeSize * 0.04,
    -safeSize * 0.52, -safeSize * 0.48,
    0, -safeSize * 0.92 + wobble
  );
  context.closePath();
  context.fillStyle = outerGradient;
  context.shadowBlur = safeSize * 0.5;
  context.shadowColor = "rgba(255, 98, 0, 0.72)";
  context.fill();

  const innerGradient = context.createLinearGradient(0, safeSize * 0.48, 0, -safeSize * 0.56);
  innerGradient.addColorStop(0, "rgba(255, 164, 40, 0.92)");
  innerGradient.addColorStop(0.46, "rgba(255, 219, 115, 0.9)");
  innerGradient.addColorStop(1, "rgba(255, 248, 214, 0.82)");

  context.beginPath();
  context.moveTo(0, -safeSize * 0.56 + wobble * 0.6);
  context.bezierCurveTo(
    safeSize * 0.28, -safeSize * 0.22,
    safeSize * 0.26, safeSize * 0.1,
    0, safeSize * 0.42
  );
  context.bezierCurveTo(
    -safeSize * 0.26, safeSize * 0.1,
    -safeSize * 0.28, -safeSize * 0.22,
    0, -safeSize * 0.56 + wobble * 0.6
  );
  context.closePath();
  context.fillStyle = innerGradient;
  context.shadowBlur = safeSize * 0.24;
  context.shadowColor = "rgba(255, 214, 120, 0.7)";
  context.fill();
  context.restore();
}

function getPointOnPolygonPerimeter(polygon, progress) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return null;
  }

  const segments = [];
  let totalLength = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  if (totalLength <= 0) {
    return polygon[0];
  }

  let targetDistance = (progress % 1) * totalLength;

  for (const segment of segments) {
    if (targetDistance <= segment.length) {
      const ratio = segment.length <= 0 ? 0 : targetDistance / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      };
    }

    targetDistance -= segment.length;
  }

  return polygon[0];
}

function drawSpyDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.3, 1 - lifeRatio * 0.5);
  const sweepAngle = now / 470 + safeSeed * 0.00021;
  const coneSpread = 0.36 + Math.sin(now / 620 + safeSeed * 0.00031) * 0.08;
  const maxDimension = Math.max(26, Math.max(bounds.width || 26, bounds.height || 26));
  const beamLength = Math.max(42, Math.min(170, maxDimension * 1.5));
  const originRadiusX = Math.max(10, (bounds.width || 24) * 0.24);
  const originRadiusY = Math.max(8, (bounds.height || 24) * 0.2);
  const originX = district.centerX + Math.cos(sweepAngle * 0.58 + 1.05) * originRadiusX;
  const originY = district.centerY + Math.sin(sweepAngle * 0.54 + 0.67) * originRadiusY;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();
    context.globalCompositeOperation = "screen";

    const beam = context.createRadialGradient(originX, originY, beamLength * 0.05, originX, originY, beamLength);
    beam.addColorStop(0, `rgba(242, 255, 216, ${(0.42 * fade).toFixed(3)})`);
    beam.addColorStop(0.28, `rgba(206, 250, 255, ${(0.26 * fade).toFixed(3)})`);
    beam.addColorStop(0.7, `rgba(120, 214, 255, ${(0.1 * fade).toFixed(3)})`);
    beam.addColorStop(1, "rgba(88, 180, 255, 0)");
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(originX, originY);
    context.arc(originX, originY, beamLength, sweepAngle - coneSpread, sweepAngle + coneSpread);
    context.closePath();
    context.fill();

    const haloRadius = Math.max(14, Math.min(44, maxDimension * 0.34));
    const halo = context.createRadialGradient(originX, originY, haloRadius * 0.1, originX, originY, haloRadius);
    halo.addColorStop(0, `rgba(246, 255, 230, ${(0.5 * fade).toFixed(3)})`);
    halo.addColorStop(0.65, `rgba(172, 234, 255, ${(0.2 * fade).toFixed(3)})`);
    halo.addColorStop(1, "rgba(100, 186, 255, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(originX, originY, haloRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = `rgba(242, 255, 218, ${(0.72 * fade).toFixed(3)})`;
  context.shadowBlur = 12;
  context.shadowColor = "rgba(214, 249, 255, 0.9)";
  context.beginPath();
  context.arc(originX, originY, 3.6 + Math.sin(now / 120 + safeSeed * 0.0009) * 0.8, 0, Math.PI * 2);
  context.fill();

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.strokeStyle = `rgba(166, 235, 255, ${(0.42 * fade).toFixed(3)})`;
    context.lineWidth = 1.2 + Math.sin(now / 280 + safeSeed * 0.0012) * 0.4;
    context.setLineDash([4, 6]);
    context.lineDashOffset = -((now / 48 + safeSeed) % 150);
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();
}

function drawPoliceDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const minDimension = Math.max(22, Math.min(bounds.width || 22, bounds.height || 22));
  const baseRadius = Math.max(22, Math.min(64, minDimension * 0.52));
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.34, 1 - lifeRatio * 0.45);
  const redPulse = 0.28 + ((Math.sin(now / 145 + safeSeed * 0.0012) + 1) * 0.5) * 0.72;
  const bluePulse = 0.28 + ((Math.sin(now / 145 + Math.PI + safeSeed * 0.0012) + 1) * 0.5) * 0.72;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();
    context.globalCompositeOperation = "screen";

    const redGlow = context.createRadialGradient(
      district.centerX - baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 0.12,
      district.centerX - baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 1.45
    );
    redGlow.addColorStop(0, `rgba(255, 88, 92, ${(0.44 * redPulse * fade).toFixed(3)})`);
    redGlow.addColorStop(0.62, `rgba(255, 52, 62, ${(0.2 * redPulse * fade).toFixed(3)})`);
    redGlow.addColorStop(1, "rgba(255, 38, 48, 0)");
    context.fillStyle = redGlow;
    context.beginPath();
    context.arc(district.centerX - baseRadius * 0.32, district.centerY - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
    context.fill();

    const blueGlow = context.createRadialGradient(
      district.centerX + baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 0.12,
      district.centerX + baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 1.45
    );
    blueGlow.addColorStop(0, `rgba(64, 179, 255, ${(0.44 * bluePulse * fade).toFixed(3)})`);
    blueGlow.addColorStop(0.62, `rgba(50, 122, 255, ${(0.2 * bluePulse * fade).toFixed(3)})`);
    blueGlow.addColorStop(1, "rgba(42, 90, 255, 0)");
    context.fillStyle = blueGlow;
    context.beginPath();
    context.arc(district.centerX + baseRadius * 0.32, district.centerY - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  const beaconCount = 4;
  const ringRadius = baseRadius * 0.62;
  for (let index = 0; index < beaconCount; index += 1) {
    const pulse = index % 2 === 0 ? redPulse : bluePulse;
    const isRed = index % 2 === 0;
    const angle = now / 780 + index * ((Math.PI * 2) / beaconCount) + safeSeed * 0.00019;
    const x = district.centerX + Math.cos(angle) * ringRadius;
    const y = district.centerY + Math.sin(angle) * ringRadius * 0.72;
    const beamRadius = baseRadius * (1.62 + pulse * 0.44);
    const beamDirection = now / 330 * (isRed ? 1 : -1) + index * 0.8;
    const beamSpread = 0.36 + pulse * 0.2;
    const beaconColor = isRed
      ? `rgba(255, 66, 72, ${(0.3 + pulse * 0.42) * fade})`
      : `rgba(56, 164, 255, ${(0.3 + pulse * 0.42) * fade})`;

    context.fillStyle = beaconColor;
    context.shadowBlur = 10 + pulse * 14;
    context.shadowColor = isRed ? "rgba(255, 58, 70, 0.95)" : "rgba(52, 150, 255, 0.95)";
    context.beginPath();
    context.arc(x, y, 3.2 + pulse * 3.4, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = (0.1 + pulse * 0.16) * fade;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, beamRadius, beamDirection - beamSpread * 0.5, beamDirection + beamSpread * 0.5);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  if (drawDistrictPolygonPath(context, district.polygon)) {
    const borderMix = redPulse - bluePulse;
    context.strokeStyle = borderMix >= 0
      ? `rgba(255, 92, 96, ${Math.max(0.28, 0.4 * fade)})`
      : `rgba(68, 172, 255, ${Math.max(0.28, 0.4 * fade)})`;
    context.lineWidth = 1.2 + Math.max(redPulse, bluePulse) * 1.3;
    context.setLineDash([6, 5]);
    context.lineDashOffset = -((now / 52 + safeSeed) % 130);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
}

function drawAttackDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const baseRadius = Math.max(16, Math.min(46, Math.min(bounds.width || 16, bounds.height || 16) * 0.36));
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const pulse = 0.86 + Math.sin(now / 170 + safeSeed * 0.0017) * 0.18;
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const alpha = Math.max(0.32, 0.86 - lifeRatio * 0.42);
  const flameAnchors = getAttackFlameAnchors(district, marker || { seed: safeSeed }, bounds);

  drawAttackAmbientSmokeAroundDistrict(context, marker || { seed: safeSeed }, now, district.centerX, district.centerY, bounds, pulse, lifeRatio);
  drawAttackSmokeInDistrict(context, district, marker || { seed: safeSeed }, now, district.centerX, district.centerY, bounds, pulse, lifeRatio);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = alpha * 0.9;

  const glowRadius = baseRadius * (1.08 + pulse * 0.26);
  const glow = context.createRadialGradient(district.centerX, district.centerY, baseRadius * 0.16, district.centerX, district.centerY, glowRadius);
  glow.addColorStop(0, "rgba(255, 250, 205, 0.92)");
  glow.addColorStop(0.26, "rgba(255, 181, 82, 0.72)");
  glow.addColorStop(0.6, "rgba(255, 92, 0, 0.52)");
  glow.addColorStop(1, "rgba(255, 53, 0, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(district.centerX, district.centerY, glowRadius, 0, Math.PI * 2);
  context.fill();

  const coreFlameSize = Math.max(18, Math.round(baseRadius * (1.02 + pulse * 0.22)));
  const coreWobbleX = Math.sin(now / 175 + safeSeed * 0.0011) * 1.8;
  const coreWobbleY = Math.cos(now / 145 + safeSeed * 0.0014) * 1.1
    - Math.abs(Math.sin(now / 220 + safeSeed * 0.0008)) * 1.6;
  context.globalAlpha = Math.max(0.46, alpha * 0.92);
  drawAttackFlameSprite(
    context,
    district.centerX + coreWobbleX,
    district.centerY + coreWobbleY,
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

    context.globalAlpha = Math.max(0.28, alpha * (0.66 + safeScale * 0.18));
    drawAttackFlameSprite(
      context,
      Number(anchor.x || district.centerX) + wobbleX,
      Number(anchor.y || district.centerY) + wobbleY,
      flameSize * 0.82,
      Math.max(0.3, alpha * (0.78 + safeScale * 0.16)),
      phase,
      pulse
    );
  });

  context.globalAlpha = alpha * 0.54;
  context.fillStyle = "rgba(255,132,24,0.36)";
  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7 + now / 700 + safeSeed * 0.00004;
    const radius = baseRadius * (0.14 + (index % 3) * 0.08);
    const x = district.centerX + Math.cos(angle) * radius;
    const y = district.centerY + Math.sin(angle) * radius * 0.7 - baseRadius * 0.18;
    const size = 1.2 + (index % 2) * 0.7;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = Math.max(0.2, alpha * 0.72);
  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.strokeStyle = `rgba(255, 92, 0, ${Math.min(0.9, 0.5 + pulse * 0.25)})`;
    context.lineWidth = 1.2 + pulse * 0.95;
    context.setLineDash([7, 5]);
    context.lineDashOffset = -((now / 40 + safeSeed) % 180);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
}

function drawRobberyDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const minDimension = Math.max(24, Math.min(bounds.width || 24, bounds.height || 24));
  const maxDimension = Math.max(28, Math.max(bounds.width || 28, bounds.height || 28));
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.24, 1 - lifeRatio * 0.38);
  const flicker = 0.42 + ((Math.sin(now / 70 + safeSeed * 0.0021) + 1) * 0.5) * 0.58;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();

    const sweepWidth = Math.max(18, minDimension * 0.46);
    for (let index = 0; index < 3; index += 1) {
      const progress = ((now / (420 + index * 80)) + safeSeed * 0.0007 + index * 0.31) % 1;
      const shadowX = bounds.minX - sweepWidth + progress * (bounds.width + sweepWidth * 2);
      const shadowAlpha = (0.12 + flicker * 0.2) * fade * (1 - index * 0.12);
      const gradient = context.createLinearGradient(shadowX, bounds.minY, shadowX + sweepWidth, bounds.maxY);
      gradient.addColorStop(0, "rgba(3,4,7,0)");
      gradient.addColorStop(0.45, `rgba(3,4,7,${shadowAlpha.toFixed(3)})`);
      gradient.addColorStop(1, "rgba(3,4,7,0)");
      context.fillStyle = gradient;
      context.fillRect(shadowX, bounds.minY - 8, sweepWidth, (bounds.height || 20) + 16);
    }

    for (let index = 0; index < 5; index += 1) {
      const phase = (now / (95 + index * 22) + safeSeed * 0.0014 + index) % 1;
      const lineY = bounds.minY + phase * Math.max(12, bounds.height);
      const lineHeight = 1.2 + (index % 2) * 1.4;
      const lineWidth = Math.max(16, maxDimension * (0.42 + (index % 3) * 0.16));
      const offsetX = Math.sin(now / 85 + index + safeSeed * 0.0009) * maxDimension * 0.22;
      context.fillStyle = `rgba(148,163,184,${(0.12 + flicker * 0.14).toFixed(3)})`;
      context.fillRect(district.centerX - lineWidth / 2 + offsetX, lineY, lineWidth, lineHeight);
    }

    context.fillStyle = `rgba(2, 6, 12, ${(0.16 + flicker * 0.12).toFixed(3)})`;
    context.beginPath();
    context.arc(district.centerX, district.centerY, Math.max(16, minDimension * 0.36), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    context.strokeStyle = `rgba(71, 85, 105, ${(0.2 + flicker * 0.16).toFixed(3)})`;
    context.lineWidth = 1.2 + flicker * 0.8;
    context.setLineDash([5, 7]);
    context.lineDashOffset = -((now / 38 + safeSeed) % 140);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}

function drawTrapDistrictAnimation(context, district, animationProgress) {
  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.clip();

  const pulse = 0.5 + Math.sin(animationProgress * Math.PI * 2) * 0.5;
  const smokeLayers = [
    { offsetX: -24, offsetY: -12, radius: 26, phase: 0.08 },
    { offsetX: 18, offsetY: -18, radius: 22, phase: 0.31 },
    { offsetX: -8, offsetY: 16, radius: 28, phase: 0.57 },
    { offsetX: 26, offsetY: 10, radius: 18, phase: 0.81 }
  ];

  for (const layer of smokeLayers) {
    const drift = ((animationProgress + layer.phase) % 1) * 18;
    const gradient = context.createRadialGradient(
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      4,
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      layer.radius + pulse * 6
    );
    gradient.addColorStop(0, `rgba(160, 255, 96, ${0.18 + pulse * 0.12})`);
    gradient.addColorStop(0.4, `rgba(96, 255, 162, ${0.12 + pulse * 0.08})`);
    gradient.addColorStop(1, "rgba(96, 255, 162, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      layer.radius + pulse * 6,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  context.restore();

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = `rgba(160, 255, 96, ${0.22 + pulse * 0.18})`;
  context.lineWidth = 2;
  context.shadowBlur = 18;
  context.shadowColor = "rgba(160, 255, 96, 0.45)";
  context.stroke();
  context.restore();
}

function drawOccupyDistrictAnimation(context, district, animationProgress) {
  context.save();
  const playerColor = getLaunchPlayerColor(currentPlayerId);
  const pulse = 0.5 + Math.sin(animationProgress * Math.PI * 4) * 0.5;
  const alpha = 0.18 + pulse * 0.28;

  drawDistrictPolygon(context, district.polygon);
  context.fillStyle = `${playerColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  context.fill();

  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = playerColor;
  context.lineWidth = 3;
  context.shadowBlur = 22;
  context.shadowColor = playerColor;
  context.stroke();
  context.restore();
}

function drawOccupyCountdownLabel(context, district, remainingSeconds) {
  context.save();
  const label = `${Math.max(0, remainingSeconds)}s`;
  const playerColor = getLaunchPlayerColor(currentPlayerId);
  const labelWidth = 28 + (label.length * 7);
  const labelX = district.centerX - (labelWidth / 2);
  const labelY = district.centerY - 28;

  context.fillStyle = "rgba(6, 14, 22, 0.86)";
  context.strokeStyle = playerColor;
  context.lineWidth = 1.2;
  context.shadowBlur = 18;
  context.shadowColor = playerColor;
  context.beginPath();
  context.roundRect(labelX, labelY, labelWidth, 18, 8);
  context.fill();
  context.stroke();

  context.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#effdff";
  context.fillText(label, district.centerX, labelY + 9.5);
  context.restore();
}

function drawReducedMapActivityIcon(context, type, x, y, size, color) {
  const iconType = String(type || "").trim().toLowerCase();
  const markerColor = String(color || "#67e1ff").trim() || "#67e1ff";
  const half = size / 2;

  context.save();
  context.strokeStyle = markerColor;
  context.fillStyle = markerColor;
  context.lineWidth = Math.max(1.6, size * 0.08);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (iconType === "spy") {
    context.beginPath();
    context.ellipse(x, y, half * 0.82, half * 0.42, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x, y, half * 0.22, 0, Math.PI * 2);
    context.fill();
  } else if (iconType === "police") {
    context.beginPath();
    context.moveTo(x, y - half * 0.78);
    context.lineTo(x + half * 0.62, y - half * 0.48);
    context.lineTo(x + half * 0.5, y + half * 0.36);
    context.quadraticCurveTo(x, y + half * 0.84, x - half * 0.5, y + half * 0.36);
    context.lineTo(x - half * 0.62, y - half * 0.48);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(x, y - half * 0.34);
    context.lineTo(x + half * 0.16, y - half * 0.02);
    context.lineTo(x + half * 0.5, y + half * 0.02);
    context.lineTo(x + half * 0.24, y + half * 0.24);
    context.lineTo(x + half * 0.3, y + half * 0.58);
    context.lineTo(x, y + half * 0.4);
    context.lineTo(x - half * 0.3, y + half * 0.58);
    context.lineTo(x - half * 0.24, y + half * 0.24);
    context.lineTo(x - half * 0.5, y + half * 0.02);
    context.lineTo(x - half * 0.16, y - half * 0.02);
    context.closePath();
    context.fill();
  } else if (iconType === "attack") {
    drawAttackFlameSprite(context, x, y + half * 0.06, size * 0.9, 0.95, 0.2, 1);
  } else if (iconType === "occupy") {
    context.beginPath();
    context.moveTo(x - half * 0.42, y + half * 0.68);
    context.lineTo(x - half * 0.42, y - half * 0.72);
    context.stroke();
    context.beginPath();
    context.moveTo(x - half * 0.34, y - half * 0.68);
    context.lineTo(x + half * 0.54, y - half * 0.48);
    context.lineTo(x - half * 0.34, y - half * 0.14);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x - half * 0.68, y + half * 0.72);
    context.lineTo(x + half * 0.24, y + half * 0.72);
    context.stroke();
  } else if (iconType === "robbery") {
    context.beginPath();
    context.moveTo(x - half * 0.54, y + half * 0.56);
    context.quadraticCurveTo(x - half * 0.64, y - half * 0.12, x - half * 0.24, y - half * 0.3);
    context.quadraticCurveTo(x, y - half * 0.44, x + half * 0.24, y - half * 0.3);
    context.quadraticCurveTo(x + half * 0.64, y - half * 0.12, x + half * 0.54, y + half * 0.56);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(x - half * 0.2, y - half * 0.38);
    context.quadraticCurveTo(x, y - half * 0.7, x + half * 0.2, y - half * 0.38);
    context.stroke();
    context.beginPath();
    context.moveTo(x - half * 0.24, y + half * 0.02);
    context.lineTo(x + half * 0.24, y + half * 0.02);
    context.moveTo(x - half * 0.1, y + half * 0.24);
    context.lineTo(x + half * 0.18, y + half * 0.24);
    context.stroke();
  } else if (iconType === "trap") {
    context.beginPath();
    context.moveTo(x, y - half * 0.72);
    context.lineTo(x + half * 0.74, y + half * 0.58);
    context.lineTo(x - half * 0.74, y + half * 0.58);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(x, y - half * 0.32);
    context.lineTo(x, y + half * 0.16);
    context.stroke();
    context.beginPath();
    context.arc(x, y + half * 0.38, half * 0.06, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.arc(x, y, half * 0.55, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x, y, half * 0.18, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawReducedMapActivityMarker(context, district, _type, color) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const markerColor = String(color || reducedActivityFallbackColor).trim() || reducedActivityFallbackColor;
  const bounds = getPolygonBounds(district.polygon);
  const pulse = 0.5 + Math.sin(Date.now() / 420 + Number(district.id || 0)) * 0.5;
  const radius = Math.max(18, Math.min(56, Math.min(bounds.width || 18, bounds.height || 18) * 0.58));

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.clip();
  const glow = context.createRadialGradient(
    district.centerX,
    district.centerY,
    radius * 0.08,
    district.centerX,
    district.centerY,
    radius * (1.1 + pulse * 0.25)
  );
  glow.addColorStop(0, `${markerColor}38`);
  glow.addColorStop(0.58, `${markerColor}18`);
  glow.addColorStop(1, `${markerColor}00`);
  context.fillStyle = glow;
  context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
  context.restore();

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = `${markerColor}9c`;
  context.lineWidth = 1.1 + pulse * 0.8;
  context.shadowBlur = 6 + pulse * 8;
  context.shadowColor = markerColor;
  context.stroke();
  context.restore();
}

function getAllianceMapBadge(ownerId = null) {
  const provider = windowRef?.empireStreetsAllianceState;
  if (ownerId !== null && ownerId !== undefined && provider && typeof provider.getMapBadgeForOwner === "function") {
    return provider.getMapBadgeForOwner(ownerId) || null;
  }
  if (provider && typeof provider.getMapBadge === "function") {
    return provider.getMapBadge() || null;
  }
  return null;
}

function drawCurrentPlayerFactionBadge(context, district, isNight = true) {
  if (!district) {
    return;
  }

  const badgeColor = getCurrentPlayerGangColor();
  const badgeGlyph = getCurrentPlayerFactionGlyph();
  const [red, green, blue] = hexToRgbParts(badgeColor);
  const neonGlow = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.92 : 0.68})`;
  const softGlow = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.42 : 0.28})`;

  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 22px Segoe UI Symbol, Segoe UI Emoji, Bahnschrift, sans-serif";
  context.lineWidth = 1.5;
  context.strokeStyle = isNight ? "rgba(8, 12, 20, 0.94)" : "rgba(236, 246, 255, 0.82)";
  context.fillStyle = isNight ? "#f8feff" : "#ffffff";
  context.shadowBlur = isNight ? 26 : 20;
  context.shadowColor = neonGlow;
  context.strokeText(String(badgeGlyph), district.centerX, district.centerY + 0.5);
  context.fillText(String(badgeGlyph), district.centerX, district.centerY + 0.5);

  context.font = "900 11px Bahnschrift, Segoe UI, sans-serif";
  context.fillStyle = badgeColor;
  context.shadowBlur = isNight ? 18 : 12;
  context.shadowColor = softGlow;
  context.fillText("TY", district.centerX, district.centerY + 18.5);
  context.restore();
}

function getBountyDistrictMarkers() {
  const provider = windowRef?.empireStreetsBountyState;
  if (provider && typeof provider.getDistrictMarkers === "function") {
    return provider.getDistrictMarkers() || new Map();
  }
  return new Map();
}

function getAllianceIconImage(asset) {
  if (!asset || typeof ImageCtor !== "function") {
    return null;
  }
  const cached = allianceIconImageCache.get(asset);
  if (cached) {
    return cached.status === "loaded" ? cached.image : null;
  }

  const image = new ImageCtor();
  const entry = { image, status: "loading" };
  image.onload = () => {
    entry.status = "loaded";
  };
  image.onerror = () => {
    entry.status = "error";
  };
  image.src = asset;
  allianceIconImageCache.set(asset, entry);
  return null;
}

function createTintedAllianceIconCanvas(image, size, color) {
  if (!image || !documentRef?.createElement) {
    return null;
  }
  const safeSize = Math.max(24, Math.min(64, Math.round(Number(size) || 32)));
  const cacheKey = `${image.src || "inline"}:${safeSize}:${color}`;
  const cached = allianceIconTintCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const canvas = documentRef.createElement("canvas");
  canvas.width = safeSize;
  canvas.height = safeSize;
  const offscreenContext = canvas.getContext?.("2d");
  if (!offscreenContext) {
    return null;
  }

  offscreenContext.clearRect(0, 0, safeSize, safeSize);
  offscreenContext.drawImage(image, 0, 0, safeSize, safeSize);
  offscreenContext.globalCompositeOperation = "source-in";
  offscreenContext.fillStyle = color;
  offscreenContext.fillRect(0, 0, safeSize, safeSize);
  offscreenContext.globalCompositeOperation = "source-over";
  allianceIconTintCache.set(cacheKey, canvas);
  return canvas;
}

function getAllianceBadgeRegistryIcon(badge) {
  if (badge?.iconKey) {
    return getAllianceIconById(badge.iconKey);
  }
  return getAllianceIconByTag(badge?.tag);
}

function drawInlineAllianceBadgeIcon(context, badge, x, y, size = 32, color = "#f7c948") {
  const registryIcon = getAllianceBadgeRegistryIcon(badge);
  const definition = ALLIANCE_CANVAS_ICON_DEFINITIONS[registryIcon?.id];
  const Path2DCtor = windowRef?.Path2D || globalThis.Path2D;
  if (!definition || typeof Path2DCtor !== "function") {
    return false;
  }

  const safeSize = Math.max(18, Math.min(64, Number(size) || 32));
  const scale = safeSize / 100;
  context.save();
  context.translate(x - safeSize / 2, y - safeSize / 2);
  context.scale(scale, scale);
  context.fillStyle = color;

  for (const pathData of definition.paths || []) {
    context.fill(new Path2DCtor(pathData));
  }

  for (const circle of definition.circles || []) {
    context.beginPath();
    context.arc(Number(circle.cx || 0), Number(circle.cy || 0), Number(circle.r || 0), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
  return true;
}

function drawFallbackAllianceBadgeText(context, badge, x, y, isNight, softGlow) {
  const text = String(badge?.symbol || badge?.tag || "AL").slice(0, 4);
  context.font = "900 18px Bahnschrift, Segoe UI Symbol, Segoe UI Emoji, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 2.2;
  context.strokeStyle = isNight ? "rgba(3, 8, 16, 0.92)" : "rgba(232, 246, 255, 0.72)";
  context.fillStyle = isNight ? "rgba(245, 235, 255, 0.98)" : "rgba(255, 255, 255, 0.96)";
  context.strokeText(text, x, y);
  context.fillText(text, x, y);

  context.fillStyle = isNight ? "rgba(191, 235, 255, 0.72)" : "rgba(68, 84, 196, 0.72)";
  context.shadowBlur = isNight ? 18 : 12;
  context.shadowColor = softGlow;
  context.fillText(text, x, y - 0.5);
}

function drawAllianceBadgeIcon(context, badge, x, y, size = 32, color = "#f7c948") {
  if (drawInlineAllianceBadgeIcon(context, badge, x, y, size, color)) {
    return true;
  }

  const registryIcon = badge?.asset
    ? { asset: badge.asset }
    : badge?.iconKey
      ? getAllianceIconById(badge.iconKey)
      : getAllianceIconByTag(badge?.tag);
  const image = getAllianceIconImage(registryIcon?.asset);
  const tintedCanvas = createTintedAllianceIconCanvas(image, size, color);
  if (!tintedCanvas) {
    return false;
  }

  const half = size / 2;
  context.drawImage(tintedCanvas, x - half, y - half, size, size);
  return true;
}

function getAllianceBadgeColor(badge, fallbackColor = "#f7c948") {
  const color = String(badge?.color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallbackColor;
}

function drawAllianceDistrictBadge(context, district, badge, isNight = true) {
  if (!district || !badge?.symbol) {
    return;
  }

  const badgeColor = getAllianceBadgeColor(badge, getLaunchPlayerColor(currentPlayerId));
  const [red, green, blue] = hexToRgbParts(badgeColor);
  const haloRadius = 19;
  const symbolY = district.centerY - 0.5;
  const primaryGlow = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.78 : 0.58})`;
  const softGlow = isNight ? "rgba(168, 85, 247, 0.58)" : "rgba(34, 211, 238, 0.38)";
  const halo = context.createRadialGradient(
    district.centerX,
    symbolY,
    2,
    district.centerX,
    symbolY,
    haloRadius
  );
  halo.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.3 : 0.2})`);
  halo.addColorStop(0.58, isNight ? "rgba(168, 85, 247, 0.18)" : "rgba(34, 211, 238, 0.13)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");

  context.save();
  context.beginPath();
  context.arc(district.centerX, symbolY, haloRadius, 0, Math.PI * 2);
  context.fillStyle = halo;
  context.fill();

  context.beginPath();
  context.arc(district.centerX, symbolY, 14, 0, Math.PI * 2);
  context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.42 : 0.3})`;
  context.lineWidth = 1.25;
  context.shadowBlur = isNight ? 16 : 10;
  context.shadowColor = primaryGlow;
  context.stroke();

  context.shadowBlur = isNight ? 28 : 20;
  context.shadowColor = primaryGlow;
  const iconDrawn = drawAllianceBadgeIcon(
    context,
    badge,
    district.centerX,
    symbolY,
    30,
    badgeColor
  );
  if (!iconDrawn) {
    drawFallbackAllianceBadgeText(context, badge, district.centerX, symbolY, isNight, softGlow);
  }
  context.restore();
}

function drawBountyDistrictBadge(context, district, marker, isNight = true) {
  if (!district || !marker) {
    return;
  }

  const accentColor = "#ef4444";
  const badgeX = district.centerX;
  const badgeY = district.centerY - 19;

  context.save();
  context.strokeStyle = accentColor;
  context.fillStyle = isNight ? "rgba(18, 10, 14, 0.88)" : "rgba(44, 15, 22, 0.82)";
  context.lineWidth = 1.8;
  context.shadowBlur = isNight ? 20 : 12;
  context.shadowColor = accentColor;
  context.beginPath();
  context.arc(badgeX, badgeY, 9.5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(badgeX, badgeY, 3.2, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(badgeX - 12, badgeY);
  context.lineTo(badgeX - 4.6, badgeY);
  context.moveTo(badgeX + 4.6, badgeY);
  context.lineTo(badgeX + 12, badgeY);
  context.moveTo(badgeX, badgeY - 12);
  context.lineTo(badgeX, badgeY - 4.6);
  context.moveTo(badgeX, badgeY + 4.6);
  context.lineTo(badgeX, badgeY + 12);
  context.stroke();
  context.restore();
}

function drawBountyDistrictHighlight(context, district, isNight = true) {
  if (!district) {
    return;
  }

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.fillStyle = isNight ? "rgba(239, 68, 68, 0.18)" : "rgba(220, 38, 38, 0.14)";
  context.fill();

  context.save();
  context.shadowBlur = isNight ? 28 : 18;
  context.shadowColor = isNight ? "rgba(248, 113, 113, 0.8)" : "rgba(220, 38, 38, 0.46)";
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = isNight ? "rgba(252, 165, 165, 0.9)" : "rgba(220, 38, 38, 0.9)";
  context.lineWidth = 3;
  context.stroke();
  context.restore();
  context.restore();
}


  return {
    drawAllianceDistrictBadge,
    drawAttackDistrictAnimation,
    drawBountyDistrictBadge,
    drawBountyDistrictHighlight,
    drawCurrentPlayerFactionBadge,
    drawOccupyCountdownLabel,
    drawOccupyDistrictAnimation,
    drawPoliceDistrictAnimation,
    drawReducedMapActivityMarker,
    drawRobberyDistrictAnimation,
    drawSpyDistrictAnimation,
    drawTrapDistrictAnimation,
    getAllianceMapBadge,
    getBountyDistrictMarkers,
    getPointOnPolygonPerimeter
  };
}
