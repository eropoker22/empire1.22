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
    getLaunchPlayerLabel = (playerId) => String(playerId || ''),
    getDistrictFillStyle = () => 'rgba(103, 225, 255, 0.16)',
    drawDistrictPolygon = noopDrawPolygon,
    drawAllianceDistrictBadge = noopDrawAnimation,
    drawCurrentPlayerFactionBadge = noopDrawAnimation,
    drawBountyDistrictHighlight = noopDrawAnimation,
    drawBountyDistrictBadge = noopDrawAnimation,
    drawReducedMapActivityMarker = noopDrawAnimation,
    drawOccupyCountdownLabel = noopDrawAnimation,
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

function renderDistrictCanvas(canvas, phase, interactionState = {}, imageSet = null) {
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
  const mapVisibilityMode = normalizeMapVisibilityMode(interactionState.mapVisibilityMode);
  const effectiveOwnedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || startPhaseOwnerByDistrictId;
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
  const allianceBadge = showAllianceSymbols && mapVisibilityMode !== "only-player"
    ? getAllianceMapBadge()
    : null;
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
    const rawLaunchOwnerId = launchOwnerByDistrictId.get(district.id) ?? null;
    const showEnemyMarkers = showAllianceSymbols && mapVisibilityMode === "all" && !isOwnedByCurrentPlayer;
    const launchOwnerId = showEnemyMarkers ? rawLaunchOwnerId : null;
    const launchOwnerColor = launchOwnerId ? getLaunchPlayerColor(launchOwnerId) : null;
    const currentPlayerColor = getLaunchPlayerColor(currentPlayerId);
    const fillStyle = getDistrictFillStyle(district, isNight, interactionState);

    drawDistrictPolygon(context, district.polygon);
    context.fillStyle = fillStyle;
    context.fill();

    if (isSelected) {
      context.save();
      context.shadowBlur = reducedMapEffects ? 0 : 26;
      context.shadowColor = isNight ? "rgba(255, 154, 61, 0.74)" : "rgba(255, 154, 61, 0.6)";
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = "rgba(255, 154, 61, 0.96)";
      context.lineWidth = reducedMapEffects ? 2.4 : 4;
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
          : borderColor === "black"
            ? "rgba(5, 8, 12, 0.92)"
          : isNight
            ? "rgba(242, 248, 255, 0.96)"
            : "rgba(245, 250, 255, 0.92)";
      context.lineWidth = isSelected ? 2.8 : isOwnedByCurrentPlayer || launchOwnerColor ? 1.8 : 1.2;
      context.stroke();
    }

    if (launchOwnerId && !isOwnedByCurrentPlayer) {
      context.save();
      context.shadowBlur = reducedMapEffects ? 0 : isNight ? 24 : 18;
      context.shadowColor = launchOwnerColor;
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = launchOwnerColor;
      context.lineWidth = reducedMapEffects ? 2.2 : 3.8;
      context.stroke();
      context.restore();
    }

    if (!launchOwnerId && isOwnedByCurrentPlayer) {
      context.save();
      context.shadowBlur = reducedMapEffects ? 0 : isNight ? 24 : 18;
      context.shadowColor = currentPlayerColor;
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = currentPlayerColor;
      context.lineWidth = reducedMapEffects ? 2.2 : 3.6;
      context.stroke();
      context.restore();
    }

    if (launchOwnerId && launchOwnerId === currentPlayerId) {
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      } else {
        drawCurrentPlayerFactionBadge(context, district, isNight);
      }
    } else if (launchOwnerId) {
      context.save();
      context.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = launchOwnerColor;
      context.shadowBlur = 16;
      context.shadowColor = launchOwnerColor;
      context.fillText(getLaunchPlayerLabel(launchOwnerId), district.centerX, district.centerY);
      context.restore();
    }

    if (!launchOwnerId && isOwnedByCurrentPlayer) {
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      } else {
        drawCurrentPlayerFactionBadge(context, district, isNight);
      }
    } else if (!launchOwnerId && allianceBadge && isOwned) {
      drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
    }

    const bountyMarker = bountyDistrictMarkers instanceof Map
      ? bountyDistrictMarkers.get(district.id)
      : bountyDistrictMarkers?.[district.id];

    if (bountyMarker) {
      drawBountyDistrictHighlight(context, district, isNight);
      drawBountyDistrictBadge(context, district, bountyMarker, isNight);
    }

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
        drawOccupyCountdownLabel(context, district, activeOccupyCountdownByDistrictId.get(district.id) ?? 0);
      }

      if (activeRobberyDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "robbery", reducedActivityColors.robbery);
      }

      if (activeTrapDistrictIds.has(district.id)) {
        drawReducedMapActivityMarker(context, district, "trap", reducedActivityColors.trap);
      }
    } else {
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
        drawOccupyCountdownLabel(context, district, activeOccupyCountdownByDistrictId.get(district.id) ?? 0);
      }

      if (activeRobberyDistrictIds.has(district.id)) {
        drawRobberyDistrictAnimation(context, district, activeRobberyMarkersByDistrictId.get(district.id), animationTick);
      }

      if (activeTrapDistrictIds.has(district.id)) {
        drawTrapDistrictAnimation(context, district, animationTick / 2800);
      }
    }
  }

  context.fillStyle = isNight ? "rgba(6, 12, 22, 0.08)" : "rgba(255, 255, 255, 0.015)";
  context.fillRect(0, 0, width, height);

  return geometry;
}



  return {
    drawMapImage,
    renderDistrictCanvas
  };
}
