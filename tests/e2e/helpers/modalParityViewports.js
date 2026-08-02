import { parityViewports } from "./uiParityCapture.js";

export const modalParityViewportNames = Object.freeze([
  "mobile-320x568",
  "mobile-360x800",
  "mobile-390x844",
  "mobile-430x932",
  "tablet-768x1024",
  "tablet-820x1180",
  "desktop-1024x768",
  "desktop-1366x768",
  "desktop-1440x900",
  "desktop-1920x1080"
]);

const parityViewportByName = new Map(
  parityViewports.map((viewport) => [viewport.name, viewport])
);

export const modalParityViewports = Object.freeze(
  modalParityViewportNames.map((name) => {
    const viewport = parityViewportByName.get(name);
    if (!viewport) {
      throw new Error(`Canonical modal parity viewport ${name} is missing.`);
    }
    return Object.freeze({ ...viewport });
  })
);

export const modalParityViewportBatchSize = 2;

export function createModalParityViewportBatches(prefix) {
  const normalizedPrefix = String(prefix || "modal").trim() || "modal";
  return Object.freeze(Array.from(
    { length: Math.ceil(modalParityViewports.length / modalParityViewportBatchSize) },
    (_, batchIndex) => Object.freeze({
      key: `${normalizedPrefix}-${String(batchIndex + 1).padStart(2, "0")}`,
      viewports: Object.freeze(
        modalParityViewports.slice(
          batchIndex * modalParityViewportBatchSize,
          (batchIndex + 1) * modalParityViewportBatchSize
        )
      )
    })
  ));
}

export function validateModalParityViewportMatrix({
  batches,
  viewports
}) {
  const expectedViewportContract = modalParityViewports.map(({ name, width, height }) => (
    `${name}:${width}x${height}`
  ));
  const resolvedViewportContract = Array.from(viewports, ({ name, width, height }) => (
    `${name}:${width}x${height}`
  ));
  if (JSON.stringify(resolvedViewportContract) !== JSON.stringify(expectedViewportContract)) {
    throw new Error("Modal parity must cover the full canonical 10-viewport matrix.");
  }

  const resolvedBatches = Array.from(batches || []);
  if (resolvedBatches.length === 0 || resolvedBatches.some(({ viewports: batchViewports }) => (
    !Array.isArray(batchViewports)
    || batchViewports.length === 0
    || batchViewports.length > modalParityViewportBatchSize
  ))) {
    throw new Error("Modal parity viewport batches must contain one or two viewports.");
  }
  const flattenedBatchContract = resolvedBatches.flatMap(({ viewports: batchViewports }) => (
    batchViewports.map(({ name, width, height }) => `${name}:${width}x${height}`)
  ));
  if (JSON.stringify(flattenedBatchContract) !== JSON.stringify(expectedViewportContract)) {
    throw new Error("Modal parity viewport batches must cover the canonical matrix exactly once.");
  }

  return Object.freeze({
    batchCount: resolvedBatches.length,
    viewportNames: Object.freeze(Array.from(viewports, ({ name }) => name))
  });
}
