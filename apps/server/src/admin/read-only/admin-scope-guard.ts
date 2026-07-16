import type { AdminInstanceDetailView } from "@empire/shared-types";

export const assertAdminInstanceDetailScope = (
  requestedInstanceId: string,
  detail: AdminInstanceDetailView
): void => {
  const scopedValues = [
    detail,
    detail.summary,
    detail.freshness,
    detail.economy,
    detail.production,
    detail.police,
    detail.liveness,
    detail.snapshot,
    ...detail.players,
    ...detail.districts,
    ...detail.alliances,
    ...detail.commands,
    ...detail.events,
    ...detail.diagnostics
  ];
  if (scopedValues.some((entry) => entry.serverInstanceId !== requestedInstanceId)) {
    throw new Error("Admin instance projection contains a row from another server instance.");
  }
};
