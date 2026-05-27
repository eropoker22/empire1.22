export type FreeBrStrategyId =
  | "aggressive-expander"
  | "economy-builder"
  | "downtown-rusher"
  | "defensive-turtle"
  | "diplomat"
  | "opportunist"
  | "casual"
  | "high-risk-criminal";

export type FreeBrActivityProfile = "hardcore" | "active" | "casual" | "low";

export type FreeBrScenarioName =
  | "canonical-20p"
  | "aggressive-heavy"
  | "casual-heavy"
  | "downtown-rush"
  | "alliance-heavy"
  | "no-alliance-control"
  | "high-risk-crime";

export type FreeBrDistrictZone = "residential" | "commercial" | "industrial" | "park" | "downtown";
export type FreeBrPlayerStatus = "active" | "defeated";

export type FreeBrActionType =
  | "spy-district"
  | "occupy-district"
  | "attack-district"
  | "craft-item"
  | "run-building-action"
  | "police-raid"
  | "form-alliance"
  | "break-alliance"
  | "betray-alliance"
  | "assist-ally"
  | "elimination"
  | "victory"
  | "pass";

export interface FreeBrScenarioConfig {
  name: FreeBrScenarioName;
  description: string;
  strategyWeights: Partial<Record<FreeBrStrategyId, number>>;
  allianceMultiplier: number;
  aggressionMultiplier: number;
  downtownPreferenceMultiplier: number;
  crimeMultiplier: number;
}

export interface FreeBrSimulationOptions {
  seed?: string | number;
  hours?: number;
  scenario?: FreeBrScenarioName;
  runs?: number;
  startAtIso?: string;
  auditLevel?: "full" | "matrix";
}

export interface FreeBrBotStrategyProfile {
  id: FreeBrStrategyId;
  label: string;
  aggression: number;
  economy: number;
  downtown: number;
  defense: number;
  alliance: number;
  crime: number;
  risk: number;
  activityBias: number;
}

export interface FreeBrPlayer {
  id: string;
  name: string;
  factionId: string;
  strategyId: FreeBrStrategyId;
  activityProfile: FreeBrActivityProfile;
  status: FreeBrPlayerStatus;
  homeDistrictId: number;
  allianceId: string | null;
  riskTolerance: number;
  aggression: number;
  downtownPreference: number;
  economyPreference: number;
  defensePreference: number;
  alliancePreference: number;
  heatTolerance: number;
  resources: Record<string, number>;
  population: number;
  heat: number;
  lastActionTick: number | null;
  cooldowns: Record<string, number>;
  spyIntel: Set<number>;
}

export interface FreeBrDistrict {
  id: number;
  zone: FreeBrDistrictZone;
  ownerPlayerId: string | null;
  status: "neutral" | "controlled" | "destroyed";
  influence: number;
  heat: number;
  buildingType: string;
  adjacentDistrictIds: number[];
  value: number;
  baseDefense: number;
  isDowntown: boolean;
  ownerHistory: Array<{ tick: number; ownerPlayerId: string | null }>;
}

export interface FreeBrAlliance {
  id: string;
  members: string[];
  createdAtTick: number;
  trustScore: number;
  sharedEnemies: string[];
  helpedActions: number;
  betrayalRisk: number;
  status: "active" | "broken";
  brokenAtTick: number | null;
  reason: string;
}

export interface FreeBrAuditEvent {
  tick: number;
  simulatedTime: string;
  localTime: string;
  playerId: string | null;
  factionId: string | null;
  strategyId: FreeBrStrategyId | null;
  actionType: FreeBrActionType;
  targetDistrictId?: number | null;
  targetPlayerId?: string | null;
  result: string;
  heatDelta?: number;
  influenceDelta?: number;
  cashDelta?: number;
  dirtyCashDelta?: number;
  districtDelta?: number;
  notes?: string;
}
