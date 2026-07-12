function createFallbackGeometry(width = 0, height = 0) {
  return { width, height, districts: [] };
}

function normalizeFallbackVisibilityMode(value) {
  return value || 'all';
}

function safeSet(value) {
  return value instanceof Set ? value : new Set();
}

function noopDrawPolygon() {}
function noopDrawAnimation() {}
function noopGetBadge() { return null; }
function noopGetMarkers() { return new Map(); }

export function createDistrictCanvasRenderer(deps = {}) {
  const {
    districtGeometryTopInset = 0,
    createDistrictGeometry = createFallbackGeometry,
    normalizeMapVisibilityMode = normalizeFallbackVisibilityMode,
    getEffectiveOwnedDistrictIds = safeSet,
    getCurrentPlayerOwnedDistrictIds = safeSet,
    startPhaseOwnerByDistrictId = new Map(),
    getAllianceMapBadge = noopGetBadge,
    getBountyDistrictMarkers = noopGetMarkers,
    getLaunchPlayerColor = () => '#67e1ff',
    getDistrictFillStyle = () => 'rgba(103, 225, 255, 0.16)',
    drawDistrictPolygon = noopDrawPolygon,
    drawAllianceDistrictBadge = noopDrawAnimation,
    drawCurrentPlayerFactionBadge = noopDrawAnimation,
    drawBountyDistrictHighlight = noopDrawAnimation,
    drawBountyDistrictBadge = noopDrawAnimation,
    drawReducedMapActivityMarker = noopDrawAnimation,
    drawSpyDistrictAnimation = noopDrawAnimation,
    drawPoliceDistrictAnimation = noopDrawAnimation,
    drawAttackDistrictAnimation = noopDrawAnimation,
    drawOccupyDistrictAnimation = noopDrawAnimation,
    drawRobberyDistrictAnimation = noopDrawAnimation,
    drawTrapDistrictAnimation = noopDrawAnimation,
    currentPlayerId = 'current-player',
    reducedActivityColors = {}
  } = deps;

function drawMapImage(context, image, width, height) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = drawHeight * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = drawWidth / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawDowntownNeonBorder(context, district, isNight, reducedMapEffects, borderScale = 1) {
  if (String(district?.districtType || "").trim().toLowerCase() !== "downtown") {
    return;
  }

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineJoin = "round";
  context.lineCap = "round";

  drawDistrictPolygon(context, district.polygon);
  context.shadowBlur = reducedMapEffects ? 8 : 26;
  context.shadowColor = "rgba(255, 44, 202, 0.95)";
  context.strokeStyle = isNight
    ? "rgba(255, 44, 202, 0.42)"
    : "rgba(255, 44, 202, 0.34)";
  context.lineWidth = (reducedMapEffects ? 3.2 : 6.8) * borderScale;
  context.stroke();

  if (!reducedMapEffects) {
    drawDistrictPolygon(context, district.polygon);
    context.shadowBlur = 16;
    context.shadowColor = "rgba(255, 160, 236, 0.92)";
    context.strokeStyle = isNight
      ? "rgba(255, 104, 224, 0.78)"
      : "rgba(255, 71, 194, 0.68)";
    context.lineWidth = 3.3 * borderScale;
    context.stroke();
  }

  drawDistrictPolygon(context, district.polygon);
  context.shadowBlur = reducedMapEffects ? 4 : 10;
  context.shadowColor = "rgba(255, 231, 252, 0.88)";
  context.strokeStyle = isNight
    ? "rgba(255, 232, 252, 0.96)"
    : "rgba(255, 184, 242, 0.88)";
  context.lineWidth = (reducedMapEffects ? 1.4 : 1.65) * borderScale;
  context.stroke();

  context.restore();
}

function getPolygonBounds(polygon = []) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of polygon) {
    const x = Number(point?.x ?? 0);
    const y = Number(point?.y ?? 0);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function deterministicUnit(seed) {
  const value = Math.sin(Number(seed || 0) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawDestroyedDistrictOverlay(context, district, isNight, reducedMapEffects, borderScale = 1) {
  const bounds = getPolygonBounds(district?.polygon);
  const centerX = Number(district?.centerX ?? ((bounds.minX + bounds.maxX) / 2));
  const centerY = Number(district?.centerY ?? ((bounds.minY + bounds.maxY) / 2));
  const scale = Math.max(0.72, Math.min(1.35, Math.min(bounds.width / 68, bounds.height / 72)));

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.clip();

  const ashGradient = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  ashGradient.addColorStop(0, "rgba(2, 2, 4, 0.84)");
  ashGradient.addColorStop(0.34, "rgba(31, 7, 9, 0.78)");
  ashGradient.addColorStop(0.66, "rgba(5, 5, 8, 0.9)");
  ashGradient.addColorStop(1, "rgba(70, 14, 14, 0.64)");
  context.fillStyle = ashGradient;
  context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

  context.globalCompositeOperation = "screen";
  const redCore = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, Math.max(bounds.width, bounds.height) * 0.72);
  redCore.addColorStop(0, isNight ? "rgba(255, 48, 48, 0.28)" : "rgba(255, 24, 24, 0.2)");
  redCore.addColorStop(0.48, "rgba(255, 32, 32, 0.1)");
  redCore.addColorStop(1, "rgba(255, 32, 32, 0)");
  context.fillStyle = redCore;
  context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

  if (!reducedMapEffects) {
    for (let index = 0; index < 3; index += 1) {
      const smokeX = bounds.minX + bounds.width * (0.18 + deterministicUnit(district.id * 31 + index) * 0.62);
      const smokeY = bounds.minY + bounds.height * (0.1 + deterministicUnit(district.id * 47 + index) * 0.42);
      const smokeSize = Math.max(bounds.width, bounds.height) * (0.22 + deterministicUnit(district.id * 59 + index) * 0.16);
      const smoke = context.createRadialGradient(smokeX, smokeY, 2, smokeX, smokeY, smokeSize);
      smoke.addColorStop(0, "rgba(5, 8, 12, 0.78)");
      smoke.addColorStop(0.54, "rgba(17, 24, 39, 0.34)");
      smoke.addColorStop(1, "rgba(17, 24, 39, 0)");
      context.globalCompositeOperation = "source-over";
      context.fillStyle = smoke;
      context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
    }

    context.globalCompositeOperation = "screen";
    context.lineCap = "round";
    for (let index = 0; index < 5; index += 1) {
      const sparkX = bounds.minX + bounds.width * (0.16 + deterministicUnit(district.id * 71 + index) * 0.68);
      const sparkY = bounds.minY + bounds.height * (0.22 + deterministicUnit(district.id * 83 + index) * 0.56);
      context.beginPath();
      context.arc(sparkX, sparkY, Math.max(1.2, 1.8 * scale), 0, Math.PI * 2);
      context.fillStyle = index % 2 === 0 ? "rgba(255, 116, 36, 0.82)" : "rgba(255, 221, 87, 0.72)";
      context.shadowBlur = 8;
      context.shadowColor = "rgba(255, 75, 35, 0.72)";
      context.fill();
    }
  }

  context.globalCompositeOperation = "source-over";
  context.shadowBlur = 0;
  context.lineJoin = "round";
  context.lineCap = "round";

  const crackLines = [
    [0.12, 0.24, 0.42, 0.48, 0.56, 0.44],
    [0.24, 0.76, 0.5, 0.54, 0.72, 0.62],
    [0.64, 0.18, 0.54, 0.42, 0.86, 0.72],
    [0.1, 0.52, 0.34, 0.58, 0.46, 0.82]
  ];

  for (const [startX, startY, midX, midY, endX, endY] of crackLines) {
    context.beginPath();
    context.moveTo(bounds.minX + bounds.width * startX, bounds.minY + bounds.height * startY);
    context.lineTo(bounds.minX + bounds.width * midX, bounds.minY + bounds.height * midY);
    context.lineTo(bounds.minX + bounds.width * endX, bounds.minY + bounds.height * endY);
    context.strokeStyle = "rgba(0, 0, 0, 0.88)";
    context.lineWidth = Math.max(1.2, 2.3 * scale);
    context.stroke();

    context.strokeStyle = "rgba(255, 88, 88, 0.24)";
    context.lineWidth = Math.max(0.6, 0.9 * scale);
    context.stroke();
  }

  if (!reducedMapEffects) {
    context.setLineDash([Math.max(5, 8 * scale), Math.max(4, 6 * scale)]);
    context.beginPath();
    context.moveTo(bounds.minX - bounds.width * 0.08, bounds.minY + bounds.height * 0.72);
    context.lineTo(bounds.maxX + bounds.width * 0.08, bounds.minY + bounds.height * 0.44);
    context.strokeStyle = "rgba(255, 214, 75, 0.58)";
    context.lineWidth = Math.max(2, 4 * scale);
    context.stroke();
    context.setLineDash([]);

    const signY = bounds.minY + bounds.height * 0.27;
    context.beginPath();
    context.moveTo(bounds.minX + bounds.width * 0.16, signY);
    context.lineTo(bounds.minX + bounds.width * 0.42, signY + bounds.height * 0.06);
    context.strokeStyle = "rgba(103, 232, 249, 0.58)";
    context.lineWidth = Math.max(1, 1.7 * scale);
    context.shadowBlur = 10;
    context.shadowColor = "rgba(103, 232, 249, 0.7)";
    context.stroke();

    context.beginPath();
    context.moveTo(bounds.minX + bounds.width * 0.62, bounds.minY + bounds.height * 0.76);
    context.lineTo(bounds.minX + bounds.width * 0.84, bounds.minY + bounds.height * 0.7);
    context.strokeStyle = "rgba(244, 114, 182, 0.56)";
    context.shadowColor = "rgba(244, 114, 182, 0.72)";
    context.stroke();
    context.shadowBlur = 0;

    for (let index = 0; index < 4; index += 1) {
      const holeX = bounds.minX + bounds.width * (0.18 + deterministicUnit(district.id * 97 + index) * 0.64);
      const holeY = bounds.minY + bounds.height * (0.18 + deterministicUnit(district.id * 109 + index) * 0.62);
      context.beginPath();
      context.arc(holeX, holeY, Math.max(1.3, 2 * scale), 0, Math.PI * 2);
      context.fillStyle = "rgba(0, 0, 0, 0.78)";
      context.fill();
      context.strokeStyle = "rgba(255, 130, 130, 0.18)";
      context.lineWidth = 0.7;
      context.stroke();
    }
  }

  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  drawDistrictPolygon(context, district.polygon);
  context.shadowBlur = reducedMapEffects ? 8 : 18;
  context.shadowColor = "rgba(255, 31, 31, 0.96)";
  context.strokeStyle = isNight ? "rgba(255, 45, 45, 0.86)" : "rgba(248, 45, 45, 0.76)";
  context.lineWidth = (reducedMapEffects ? 2.2 : 3.6) * borderScale;
  context.stroke();
  context.restore();

}

function renderDistrictActivityEffects(context, geometry, interactionState = {}, options = {}) {
  const reducedMapEffects = Boolean(options.reducedMapEffects ?? interactionState.reducedMapEffects);
  const activeSpyDistrictIds = interactionState.activeSpyDistrictIds || new Set();
  const activeSpyMarkersByDistrictId = interactionState.activeSpyMarkersByDistrictId || new Map();
  const activePoliceDistrictIds = interactionState.activePoliceDistrictIds || new Set();
  const activePoliceMarkersByDistrictId = interactionState.activePoliceMarkersByDistrictId || new Map();
  const activeAttackDistrictIds = interactionState.activeAttackDistrictIds || new Set();
  const activeAttackMarkersByDistrictId = interactionState.activeAttackMarkersByDistrictId || new Map();
  const activeOccupyDistrictIds = interactionState.activeOccupyDistrictIds || new Set();
  const activeOccupyCountdownByDistrictId = interactionState.activeOccupyCountdownByDistrictId || new Map();
  const activeRobberyDistrictIds = interactionState.activeRobberyDistrictIds || new Set();
  const activeRobberyMarkersByDistrictId = interactionState.activeRobberyMarkersByDistrictId || new Map();
  const activeTrapDistrictIds = interactionState.activeTrapDistrictIds || new Set();
  const animationTick = interactionState.animationTick ?? 0;

  for (const district of geometry?.districts || []) {
    if (reducedMapEffects) {
      if (activeSpyDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "spy", reducedActivityColors.spy);
      }
      if (activePoliceDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "police", reducedActivityColors.police);
      }
      if (activeAttackDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "attack", reducedActivityColors.attack);
      }
      if (activeOccupyDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "occupy", getLaunchPlayerColor(currentPlayerId));
      }
      if (activeRobberyDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "robbery", reducedActivityColors.robbery);
      }
      if (activeTrapDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "trap", reducedActivityColors.trap);
      }
      continue;
    }

    if (activeSpyDistrictIds.has(district.id)) {
      drawSpyDistrictAnimation(context, district, activeSpyMarkersByDistrictId.get(district.id), animationTick);
    }
    if (activePoliceDistrictIds.has(district.id)) {
      drawPoliceDistrictAnimation(context, district, activePoliceMarkersByDistrictId.get(district.id), animationTick);
    }
    if (activeAttackDistrictIds.has(district.id)) {
      drawAttackDistrictAnimation(context, district, activeAttackMarkersByDistrictId.get(district.id), animationTick);
    }
    if (activeOccupyDistrictIds.has(district.id)) {
      drawOccupyDistrictAnimation(context, district, animationTick / 1600);
    }
    if (activeRobberyDistrictIds.has(district.id)) {
      drawRobberyDistrictAnimation(context, district, activeRobberyMarkersByDistrictId.get(district.id), animationTick);
    }
    if (activeTrapDistrictIds.has(district.id)) {
      drawTrapDistrictAnimation(context, district, animationTick / 2800);
    }
  }
}

function renderDistrictEffectsCanvas(canvas, phase, interactionState = {}, geometry = null, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return geometry;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return geometry;
  }

  const resolvedGeometry = geometry || interactionState.geometryCache || createDistrictGeometry(
    canvas.width,
    canvas.height,
    0,
    districtGeometryTopInset,
    0
  );
  context.clearRect(0, 0, canvas.width, canvas.height);
  renderDistrictActivityEffects(context, resolvedGeometry, interactionState, options);
  return resolvedGeometry;
}

function renderDistrictCanvas(canvas, phase, interactionState = {}, imageSet = null, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return null;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const width = canvas.width;
  const height = canvas.height;
  const cachedGeometry = interactionState?.geometryCache;
  const geometry = cachedGeometry && cachedGeometry.width === width && cachedGeometry.height === height
    ? cachedGeometry
    : createDistrictGeometry(width, height, 0, districtGeometryTopInset, 0);
  if (interactionState && typeof interactionState === "object") {
    interactionState.geometryCache = geometry;
  }
  const isNight = phase === "night";
  const hoveredDistrictId = interactionState.hoveredDistrictId ?? null;
  const selectedDistrictId = interactionState.selectedDistrictId ?? null;
  const borderColor = interactionState.borderColor ?? "white";
  const showDistrictBorders = interactionState.showDistrictBorders !== false;
  const showAllianceSymbols = interactionState.showAllianceSymbols !== false;
  const reducedMapEffects = Boolean(interactionState.reducedMapEffects);
  const borderScale = options.compactDistrictBorders ? 0.72 : 1;
  const mapVisibilityMode = normalizeMapVisibilityMode(interactionState.mapVisibilityMode);
  const effectiveOwnedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || startPhaseOwnerByDistrictId;
  const getDistrictAllianceBadge = (ownerId) => (
    showAllianceSymbols && mapVisibilityMode !== "only-player" && ownerId !== null && ownerId !== undefined
      ? getAllianceMapBadge(ownerId)
      : null
  );
  const bountyDistrictMarkers = getBountyDistrictMarkers();

  context.clearRect(0, 0, width, height);

  const activeImage = isNight ? imageSet?.night : imageSet?.day;

  if (activeImage) {
    drawMapImage(context, activeImage, width, height);
  } else {
    const backgroundGradient = context.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, isNight ? "#04111f" : "#102235");
    backgroundGradient.addColorStop(0.5, isNight ? "#08172b" : "#16344f");
    backgroundGradient.addColorStop(1, isNight ? "#050b16" : "#0b1828");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = reducedMapEffects
    ? (isNight ? "rgba(4, 8, 14, 0.18)" : "rgba(6, 14, 24, 0.08)")
    : (isNight ? "rgba(4, 8, 14, 0.28)" : "rgba(6, 14, 24, 0.14)");
  context.fillRect(0, 0, width, height);

  if (!reducedMapEffects) {
    context.save();
    context.globalCompositeOperation = "screen";
    const imageBloom = context.createRadialGradient(width * 0.52, height * 0.42, 30, width * 0.52, height * 0.42, width * 0.58);
    imageBloom.addColorStop(0, isNight ? "rgba(103, 225, 255, 0.12)" : "rgba(255, 255, 255, 0.08)");
    imageBloom.addColorStop(1, "rgba(103, 225, 255, 0)");
    context.fillStyle = imageBloom;
    context.fillRect(0, 0, width, height);
    context.restore();

    const glowGradient = context.createRadialGradient(width * 0.2, height * 0.18, 20, width * 0.2, height * 0.18, width * 0.55);
    glowGradient.addColorStop(0, isNight ? "rgba(103, 225, 255, 0.22)" : "rgba(103, 225, 255, 0.15)");
    glowGradient.addColorStop(1, "rgba(103, 225, 255, 0)");
    context.fillStyle = glowGradient;
    context.fillRect(0, 0, width, height);
  }

  for (const district of geometry.districts) {
    const isHovered = district.id === hoveredDistrictId;
    const isSelected = district.id === selectedDistrictId;
    const isOwned = effectiveOwnedDistrictIds.has(district.id);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(district.id);
    const isDestroyed = interactionState.destroyedDistrictIds?.has?.(district.id) === true;
    const isDowntownDistrict = String(district.districtType || "").trim().toLowerCase() === "downtown";
    const rawLaunchOwnerId = launchOwnerByDistrictId.get(district.id) ?? null;
    const launchOwnerId = !isOwnedByCurrentPlayer ? rawLaunchOwnerId : null;
    const shouldShowLaunchOwnerMarker = showAllianceSymbols && mapVisibilityMode === "all" && Boolean(launchOwnerId);
    const launchOwnerColor = launchOwnerId ? getLaunchPlayerColor(launchOwnerId) : null;
    const currentPlayerColor = getLaunchPlayerColor(currentPlayerId);
    const fillStyle = getDistrictFillStyle(district, isNight, interactionState);

    drawDistrictPolygon(context, district.polygon);
    context.fillStyle = fillStyle;
    context.fill();

    if (isDestroyed) {
      drawDestroyedDistrictOverlay(context, district, isNight, reducedMapEffects, borderScale);
    }

    drawDowntownNeonBorder(context, district, isNight, reducedMapEffects, borderScale);

    if (isSelected) {
      context.save();
      context.shadowBlur = reducedMapEffects ? 0 : 26;
      context.shadowColor = isNight ? "rgba(255, 154, 61, 0.74)" : "rgba(255, 154, 61, 0.6)";
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = "rgba(255, 154, 61, 0.96)";
      context.lineWidth = (reducedMapEffects ? 2.4 : 4) * borderScale;
      context.stroke();
      context.restore();
    }

    const shouldDrawBorder = showDistrictBorders || isSelected || isOwnedByCurrentPlayer || Boolean(launchOwnerColor);
    if (shouldDrawBorder) {
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = isSelected
        ? "rgba(255, 154, 61, 0.92)"
        : isOwnedByCurrentPlayer
            ? currentPlayerColor
          : launchOwnerColor
            ? launchOwnerColor
          : isDowntownDistrict
            ? "rgba(255, 71, 194, 0.96)"
          : borderColor === "black" || borderColor === "red"
            ? "rgba(5, 8, 12, 0.92)"
          : isNight
            ? "rgba(242, 248, 255, 0.96)"
            : "rgba(245, 250, 255, 0.92)";
      context.lineWidth = (isSelected ? 2.8 : isOwnedByCurrentPlayer || launchOwnerColor ? 1.8 : 1.2) * borderScale;
      context.stroke();
    }

    if (!launchOwnerId && isOwnedByCurrentPlayer) {
      context.save();
      context.globalCompositeOperation = "screen";
      context.shadowBlur = reducedMapEffects ? 12 : isNight ? 32 : 24;
      context.shadowColor = currentPlayerColor;
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = currentPlayerColor;
      context.lineWidth = (reducedMapEffects ? 3.2 : 5) * borderScale;
      context.stroke();
      context.shadowBlur = reducedMapEffects ? 5 : 12;
      context.lineWidth = (reducedMapEffects ? 1.8 : 2.3) * borderScale;
      context.stroke();
      context.restore();
    }

    if (shouldShowLaunchOwnerMarker && launchOwnerId === currentPlayerId) {
      const allianceBadge = getDistrictAllianceBadge(currentPlayerId);
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      } else {
        drawCurrentPlayerFactionBadge(context, district, isNight);
      }
    } else if (shouldShowLaunchOwnerMarker) {
      const allianceBadge = getDistrictAllianceBadge(launchOwnerId);
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      }
    }

    if (!launchOwnerId && isOwned && !isOwnedByCurrentPlayer) {
      const allianceBadge = getDistrictAllianceBadge(district.ownerPlayerId ?? district.ownerId ?? null);
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      }
    }

    const bountyMarker = bountyDistrictMarkers instanceof Map
      ? bountyDistrictMarkers.get(district.id)
      : bountyDistrictMarkers?.[district.id];

    if (bountyMarker) {
      drawBountyDistrictHighlight(context, district, isNight);
      drawBountyDistrictBadge(context, district, bountyMarker, isNight);
    }

  }

  if (options.renderActivityEffects !== false) {
    renderDistrictActivityEffects(context, geometry, interactionState, { reducedMapEffects });
  }

  context.fillStyle = isNight ? "rgba(6, 12, 22, 0.08)" : "rgba(255, 255, 255, 0.015)";
  context.fillRect(0, 0, width, height);

  return geometry;
}



  return {
    drawMapImage,
    renderDistrictEffectsCanvas,
    renderDistrictCanvas
  };
}
