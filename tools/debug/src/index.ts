/**
 * Responsibility: Entry point for local debug-only tooling.
 * Belongs here: inspectors, replay helpers, and isolated developer utilities.
 * Does not belong here: production server boot or player-facing app code.
 */
export const debugToolShell = {
  run: () => {
    return;
  }
};

export * from "./admin-gameplay-slice-demo";
export * from "./free-mode-pacing/simulate";
