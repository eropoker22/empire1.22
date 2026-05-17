/**
 * Responsibility: UI-ready economy/resource projection owned by the server.
 * Belongs here: read-only balances and categorized resource buckets.
 * Does not belong here: economy rules, balance values, or client cache state.
 */
export interface PlayerEconomyView {
  cleanCash: number;
  dirtyCash: number;
  influence: number;
  population: number;
  gangMembers: number;
  resources: Record<string, number>;
  materials: Record<string, number>;
  drugs: Record<string, number>;
  weapons: Record<string, number>;
}
