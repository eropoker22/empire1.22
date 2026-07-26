import {
  DAY_MAP_IMAGE_PATH,
  DISTRICT_CANVAS_SELECTOR,
  DISTRICT_TOOLTIP_GOSSIP_SELECTOR,
  DISTRICT_TOOLTIP_SELECTOR,
  DISTRICT_TOOLTIP_TYPE_SELECTOR,
  DISTRICT_TOOLTIP_VALUE_SELECTOR,
  MAP_CANVAS_SELECTOR,
  MAP_PHASE_SELECTOR,
  MAP_VIEWPORT_SELECTOR,
  NIGHT_MAP_IMAGE_PATH
} from "../runtime/constants.js";
import {
  MAP_EFFECTS_CANVAS_CLASS,
  MAP_HOVER_CANVAS_CLASS,
  MAP_INTERACTION_OVERLAY_CLASS,
  MAP_SELECTION_CANVAS_CLASS,
  MAP_STATIC_CANVAS_CLASS
} from "./mapConstants.js";
import { initMapShell } from "./mapShell.js";

const loadImage = (windowRef, source) => new Promise((resolve, reject) => {
  const image = new windowRef.Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
  image.src = source;
});

export const createServerMapPresentationShell = (options = {}) => (
  (options.initMapShell || initMapShell)({
    root: options.root,
    document: options.documentRef,
    selectors: {
      canvas: DISTRICT_CANVAS_SELECTOR,
      phaseHost: MAP_PHASE_SELECTOR,
      viewport: MAP_VIEWPORT_SELECTOR,
      canvasHost: MAP_CANVAS_SELECTOR,
      tooltip: DISTRICT_TOOLTIP_SELECTOR,
      tooltipValue: DISTRICT_TOOLTIP_VALUE_SELECTOR,
      tooltipType: DISTRICT_TOOLTIP_TYPE_SELECTOR,
      tooltipGossip: DISTRICT_TOOLTIP_GOSSIP_SELECTOR
    },
    classes: {
      effectsCanvas: MAP_EFFECTS_CANVAS_CLASS,
      hoverCanvas: MAP_HOVER_CANVAS_CLASS,
      interactionOverlay: MAP_INTERACTION_OVERLAY_CLASS,
      selectionCanvas: MAP_SELECTION_CANVAS_CLASS,
      staticCanvas: MAP_STATIC_CANVAS_CLASS
    }
  })
);

export const loadServerMapPresentationImages = (options = {}) => {
  const pending = options.loadMapImages?.() || Promise.all([
    loadImage(options.windowRef, DAY_MAP_IMAGE_PATH).catch(() => null),
    loadImage(options.windowRef, NIGHT_MAP_IMAGE_PATH).catch(() => null)
  ]);
  return Promise.resolve(pending).then((images) => (
    Array.isArray(images) ? { day: images[0], night: images[1] } : images
  ));
};
