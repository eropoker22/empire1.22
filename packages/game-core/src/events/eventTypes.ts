/**
 * Responsibility: Central registry of well-known core event type keys.
 * Belongs here: shared event identifiers used by handlers and projections.
 * Does not belong here: runtime event queues or websocket topics.
 */
export const CORE_EVENT_TYPES = {
  districtSpied: "district-spied",
  districtAttacked: "district-attacked",
  districtCaptured: "district-captured",
  trapPlaced: "trap-placed",
  trapTriggered: "trap-triggered",
  buildingActionResolved: "building-action-resolved",
  buildingPlaced: "building-placed",
  productionCollected: "production-collected",
  itemProcessingStarted: "item-processing-started",
  itemCrafted: "item-crafted",
  commandApplied: "command-applied",
  notificationCreated: "notification-created"
} as const;
