export interface VipLoungeRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

export interface VipLoungeMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: VipLoungeRumor[];
}
