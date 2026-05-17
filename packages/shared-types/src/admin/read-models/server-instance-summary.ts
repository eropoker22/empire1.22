/**
 * Responsibility: Lobby/admin safe summary of one joinable game server instance.
 * Belongs here: public operational metadata and aggregate counts.
 * Does not belong here: hidden balancing values or mutable runtime state.
 */
export interface ServerInstanceSummary {
  serverInstanceId: string;
  displayName: string;
  mode: string;
  region: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  startedAt: string | null;
  createdAt: string;
  tick: number;
  joinable: boolean;
  worldSeed: string | null;
  phase: string;
  map: ServerInstanceMapSummary;
}

export interface ServerInstanceMapSummary {
  totalDistricts: number;
  downtownDistricts: number;
  commercialDistricts: number;
  industrialDistricts: number;
  residentialDistricts: number;
  parkDistricts: number;
}
