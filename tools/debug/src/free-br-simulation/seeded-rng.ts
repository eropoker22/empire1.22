export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weightedPick<T extends string>(weights: Partial<Record<T, number>>): T;
  shuffle<T>(items: readonly T[]): T[];
}

export const createSeededRng = (seedInput: string | number = "free-br-canonical"): SeededRng => {
  let state = hashSeed(String(seedInput));

  const next = (): number => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const api: SeededRng = {
    next,
    int(min: number, max: number): number {
      const low = Math.ceil(min);
      const high = Math.floor(max);
      return Math.floor(next() * (high - low + 1)) + low;
    },
    float(min: number, max: number): number {
      return min + (next() * (max - min));
    },
    chance(probability: number): boolean {
      return next() < Math.max(0, Math.min(1, probability));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty collection.");
      }
      return items[Math.floor(next() * items.length)] as T;
    },
    weightedPick<T extends string>(weights: Partial<Record<T, number>>): T {
      const entries = Object.entries(weights)
        .map(([key, value]) => [key, Math.max(0, Number(value || 0))] as [T, number])
        .filter(([, value]) => value > 0);
      if (entries.length === 0) {
        throw new Error("Cannot weighted-pick from an empty weight map.");
      }
      const total = entries.reduce((sum, [, value]) => sum + value, 0);
      let cursor = next() * total;
      for (const [key, value] of entries) {
        cursor -= value;
        if (cursor <= 0) return key;
      }
      return entries[entries.length - 1]?.[0] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex] as T, copy[index] as T];
      }
      return copy;
    }
  };

  return api;
};

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
