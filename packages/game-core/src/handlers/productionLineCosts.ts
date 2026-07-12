import { normalizeResourceCosts } from "./productionLineShared";

export const scaleCosts = (costs: Record<string, number>, quantity: number): Record<string, number> =>
  Object.fromEntries(Object.entries(costs).map(([key, amount]) => [key, Math.max(0, Math.floor(Number(amount || 0))) * quantity]));

export const hasRequiredResources = (balances: Record<string, number>, costs: Record<string, number>): boolean =>
  Object.entries(costs).every(([key, amount]) => Math.max(0, Number(balances[key] || 0)) >= amount);

export const addCosts = (left: Record<string, number> | undefined, right: Record<string, number>): Record<string, number> =>
  creditCosts(normalizeResourceCosts(left), right);

export const subtractCosts = (left: Record<string, number> | undefined, right: Record<string, number>): Record<string, number> =>
  debitCosts(normalizeResourceCosts(left), right);

export const limitCosts = (available: Record<string, number> | undefined, requested: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(requested).map(([key, amount]) => [key, Math.min(Math.max(0, Number(available?.[key] || 0)), amount)]));

export const creditCosts = (balances: Record<string, number>, costs: Record<string, number>): Record<string, number> => {
  const next = { ...balances };
  for (const [key, amount] of Object.entries(costs)) next[key] = Math.max(0, Number(next[key] || 0)) + amount;
  return next;
};

export const debitCosts = (balances: Record<string, number>, costs: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(balances).map(([key, amount]) => [key, Math.max(0, Number(amount || 0) - Number(costs[key] || 0))]));

export const equalCosts = (left: Record<string, number>, right: Record<string, number>): boolean => {
  const normalizedRight = normalizeResourceCosts(right);
  return Object.keys(left).length === Object.keys(normalizedRight).length
    && Object.entries(left).every(([key, amount]) => normalizedRight[key] === amount);
};
