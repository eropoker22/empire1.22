import {
  copyFreeHostedStartingPlayerState,
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  FREE_HOSTED_STARTING_PLAYER_STATE
} from "@empire/game-config";
import type {
  AdminApiErrorView,
  HostedStartingMaterialId,
  HostedStartingPlayerStateView
} from "@empire/shared-types";

const STATE_KEYS = new Set(["cleanCash", "dirtyCash", "population", "influence", "spySlots", "materials"]);
const MATERIAL_KEYS = new Set<string>(FREE_HOSTED_STARTING_MATERIAL_IDS);
const MAX_CASH = 1_000_000_000;
const MAX_POPULATION = 1_000_000;
const MAX_INFLUENCE = 1_000_000;
const MAX_MATERIAL_AMOUNT = 1_000_000;

export const parseHostedStartingPlayerState = (value: unknown) => {
  if (value === undefined) {
    return accept(copyFreeHostedStartingPlayerState());
  }
  if (!record(value) || Object.keys(value).some((key) => !STATE_KEYS.has(key))) {
    return reject("ADMIN_STARTING_STATE_INVALID", "Počáteční stav hráče není platný.");
  }
  const materialInput = value.materials;
  const influence = value.influence === undefined
    ? FREE_HOSTED_STARTING_PLAYER_STATE.influence
    : value.influence;
  if (!integerInRange(value.cleanCash, 0, MAX_CASH)
    || !integerInRange(value.dirtyCash, 0, MAX_CASH)
    || !integerInRange(value.population, 0, MAX_POPULATION)
    || !integerInRange(influence, 0, MAX_INFLUENCE)
    || value.spySlots !== 2
    || !record(materialInput)
    || Object.keys(materialInput).length !== MATERIAL_KEYS.size
    || Object.keys(materialInput).some((key) => !MATERIAL_KEYS.has(key))) {
    return reject("ADMIN_STARTING_STATE_INVALID", "Počáteční stav hráče není platný.");
  }
  const materials = Object.fromEntries(FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [
    materialId,
    materialInput[materialId]
  ])) as Record<HostedStartingMaterialId, unknown>;
  if (Object.values(materials).some((amount) => !integerInRange(amount, 0, MAX_MATERIAL_AMOUNT))) {
    return reject("ADMIN_STARTING_STATE_INVALID", "Počáteční množství materiálů není platné.");
  }
  return accept<HostedStartingPlayerStateView>({
    cleanCash: Number(value.cleanCash),
    dirtyCash: Number(value.dirtyCash),
    population: Number(value.population),
    influence: Number(influence),
    spySlots: 2,
    materials: Object.fromEntries(Object.entries(materials).map(([key, amount]) => [
      key,
      Number(amount)
    ])) as HostedStartingPlayerStateView["materials"]
  });
};

export const parsePersistedHostedStartingPlayerState = (value: unknown) => {
  if (value == null) {
    return reject("ADMIN_STARTING_STATE_INVALID", "Počáteční stav hráče není platný.");
  }
  if (typeof value !== "string") {
    return parseHostedStartingPlayerState(value);
  }
  try {
    return parseHostedStartingPlayerState(JSON.parse(value) as unknown);
  } catch {
    return reject("ADMIN_STARTING_STATE_INVALID", "Počáteční stav hráče není platný.");
  }
};

const integerInRange = (value: unknown, minimum: number, maximum: number): boolean =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const accept = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const reject = (code: string, message: string) => ({
  accepted: false as const,
  data: null,
  errors: [{ code, message } satisfies AdminApiErrorView]
});
