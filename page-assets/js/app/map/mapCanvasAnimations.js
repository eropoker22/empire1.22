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
    windowRef = typeof window !== 'undefined' ? window : null
  } = deps;

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
    context.globalAlpha = Math.max(0.2, alpha * (0.36 + safeScale * 0.08));
    context.font = `${flameSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowBlur = 8 + flameSize * 0.4;
    context.shadowColor = "rgba(255, 113, 0, 0.9)";
    context.fillText("🔥", Number(anchor.x || district.centerX) + wobbleX, Number(anchor.y || district.centerY) + wobbleY);
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

function drawReducedMapActivityMarker(context, district, type, color) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const markerType = String(type || "").trim().toLowerCase();
  const markerColor = String(color || reducedActivityFallbackColor).trim() || reducedActivityFallbackColor;
  const iconSize = 24;
  const iconRadius = 15;

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = markerColor;
  context.lineWidth = 1.8;
  context.setLineDash([5, 4]);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "rgba(4, 10, 18, 0.82)";
  context.strokeStyle = markerColor;
  context.lineWidth = 1.2;
  context.shadowBlur = 14;
  context.shadowColor = markerColor;
  context.beginPath();
  context.arc(district.centerX, district.centerY, iconRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  drawReducedMapActivityIcon(context, markerType, district.centerX, district.centerY, iconSize, markerColor);
  context.restore();
}

function getAllianceMapBadge() {
  const provider = windowRef?.empireStreetsAllianceState;
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

function drawAllianceDistrictBadge(context, district, badge, isNight = true) {
  if (!district || !badge?.symbol) {
    return;
  }

  const playerColor = getLaunchPlayerColor(currentPlayerId);
  const [red, green, blue] = hexToRgbParts(playerColor);
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

  context.font = "900 25px Bahnschrift, Segoe UI Symbol, Segoe UI Emoji, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 2.4;
  context.strokeStyle = isNight ? "rgba(3, 8, 16, 0.92)" : "rgba(232, 246, 255, 0.72)";
  context.fillStyle = isNight ? "rgba(245, 235, 255, 0.98)" : "rgba(255, 255, 255, 0.96)";
  context.shadowBlur = isNight ? 28 : 20;
  context.shadowColor = primaryGlow;
  context.strokeText(String(badge.symbol), district.centerX, symbolY);
  context.fillText(String(badge.symbol), district.centerX, symbolY);

  context.fillStyle = isNight ? "rgba(191, 235, 255, 0.72)" : "rgba(68, 84, 196, 0.72)";
  context.shadowBlur = isNight ? 18 : 12;
  context.shadowColor = softGlow;
  context.fillText(String(badge.symbol), district.centerX, symbolY - 0.5);
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
