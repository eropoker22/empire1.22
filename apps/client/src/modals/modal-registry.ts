/**
 * Responsibility: Central registry for modal keys in the client shell.
 * Belongs here: UI-only modal identifiers and container ownership.
 * Does not belong here: gameplay rules or transport logic.
 */
export const MODAL_KEYS = {
  districtDetail: "district-detail",
  buildingAction: "building-action",
  settings: "settings"
} as const;

