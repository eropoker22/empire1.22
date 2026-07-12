/**
 * Responsibility: Shared transport shape for the server-authoritative warehouse
 * upgrade preview attached to one district building.
 */
export interface WarehouseUpgradePreviewView {
  before: WarehouseUpgradeCapacityView[];
  after: WarehouseUpgradeCapacityView[];
  capacityIncreases: boolean;
  noIncreaseReason: string | null;
}

export interface WarehouseUpgradeCapacityView {
  id: "bulk" | "tactical" | "strategic";
  label: string;
  capacity: number;
}
