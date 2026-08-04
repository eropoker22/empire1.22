import { createDistrictCanvasRenderer } from "./districtCanvasRenderer.js";
import { createMapCanvasAnimationRenderers } from "./mapCanvasAnimations.js";
import {
  MAP_DEFAULT_OWNER_COLOR,
  MAP_DISTRICT_GEOMETRY_TOP_INSET,
  MAP_DOWNTOWN_DISTRICT_TYPE,
  MAP_OWNER_FILL_ALPHA,
  MAP_REDUCED_ACTIVITY_COLORS,
  MAP_REDUCED_ACTIVITY_FALLBACK_COLOR
} from "./mapConstants.js";
import {
  resolveMapDestroyedFillStyle,
  resolveMapLaunchUnownedFillStyle,
  resolveMapZoneFillStyle
} from "./mapDataAdapter.js";
import { createDistrictGeometry } from "./mapGeometry.js";
import { applyHexAlpha, clamp, createSeededRandom, hexToRgbParts } from "../runtime/utils.js";

const drawDistrictPolygon = (context, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }
  context.closePath();
  return true;
};

const getPolygonBounds = (polygon = []) => {
  const xs = polygon.map((point) => Number(point?.x || 0));
  const ys = polygon.map((point) => Number(point?.y || 0));
  const minX = xs.length ? Math.min(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const normalizeMapVisibilityMode = (value) => (
  ["all", "hide-enemies", "only-player"].includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : "all"
);

export function createServerMapCanvasComposition(options = {}) {
  const modelRef = options.modelRef || { current: null };
  const currentPlayerId = String(options.currentPlayerId || modelRef.current?.currentPlayerId || "current-player");
  const getOwnerColor = (ownerId) => (
    modelRef.current?.ownerColorByPlayerId?.get?.(String(ownerId))
    || (String(ownerId) === currentPlayerId ? modelRef.current?.playerColor : null)
    || MAP_DEFAULT_OWNER_COLOR
  );
  const animationRenderers = createMapCanvasAnimationRenderers({
    getPolygonBounds,
    drawDistrictPolygonPath: drawDistrictPolygon,
    drawDistrictPolygon,
    createSeededRandom,
    clamp,
    getLaunchPlayerColor: getOwnerColor,
    getCurrentPlayerGangColor: () => modelRef.current?.playerColor || MAP_DEFAULT_OWNER_COLOR,
    getCurrentPlayerFactionGlyph: () => options.getFactionGlyph?.(modelRef.current?.factionId) || "✦",
    hexToRgbParts,
    currentPlayerId,
    reducedActivityFallbackColor: MAP_REDUCED_ACTIVITY_FALLBACK_COLOR,
    windowRef: options.windowRef
  });

  const getDistrictFillStyle = (district, isNight, interactionState = {}) => {
    const districtId = Number(district?.id || 0);
    if (interactionState.destroyedDistrictIds?.has?.(districtId)) {
      return resolveMapDestroyedFillStyle(isNight);
    }
    const ownerId = interactionState.districtOwnerById?.[districtId] ?? null;
    if (ownerId) return applyHexAlpha(getOwnerColor(ownerId), MAP_OWNER_FILL_ALPHA);
    if (district?.districtType === MAP_DOWNTOWN_DISTRICT_TYPE) {
      return resolveMapZoneFillStyle(district.districtType, isNight);
    }
    return resolveMapLaunchUnownedFillStyle();
  };

  return createDistrictCanvasRenderer({
    districtGeometryTopInset: MAP_DISTRICT_GEOMETRY_TOP_INSET,
    createDistrictGeometry,
    normalizeMapVisibilityMode,
    getEffectiveOwnedDistrictIds: (state) => new Set(state?.occupiedDistrictIds || []),
    getCurrentPlayerOwnedDistrictIds: (state) => new Set(state?.ownedDistrictIds || []),
    startPhaseOwnerByDistrictId: new Map(),
    getAllianceMapBadge: animationRenderers.getAllianceMapBadge,
    getBountyDistrictMarkers: animationRenderers.getBountyDistrictMarkers,
    getLaunchPlayerColor: getOwnerColor,
    getDistrictFillStyle,
    drawDistrictPolygon,
    drawAllianceDistrictBadge: animationRenderers.drawAllianceDistrictBadge,
    drawCurrentPlayerFactionBadge: animationRenderers.drawCurrentPlayerFactionBadge,
    drawBountyDistrictHighlight: animationRenderers.drawBountyDistrictHighlight,
    drawBountyDistrictBadge: animationRenderers.drawBountyDistrictBadge,
    drawAggregatedMapActivityMarker: animationRenderers.drawAggregatedMapActivityMarker,
    drawReducedMapActivityMarker: animationRenderers.drawReducedMapActivityMarker,
    drawSpyDistrictAnimation: animationRenderers.drawSpyDistrictAnimation,
    drawPoliceDistrictAnimation: animationRenderers.drawPoliceDistrictAnimation,
    drawAttackDistrictAnimation: animationRenderers.drawAttackDistrictAnimation,
    drawOccupyDistrictAnimation: animationRenderers.drawOccupyDistrictAnimation,
    drawRobberyDistrictAnimation: animationRenderers.drawRobberyDistrictAnimation,
    drawTrapDistrictAnimation: animationRenderers.drawTrapDistrictAnimation,
    currentPlayerId,
    reducedActivityColors: MAP_REDUCED_ACTIVITY_COLORS
  });
}
