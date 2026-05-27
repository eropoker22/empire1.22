export const distance = (left: { x: number; y: number }, right: { x: number; y: number }): number =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);

export const groupBy = <T>(items: readonly T[], getKey: (item: T) => string): Record<string, T[]> =>
  items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});

export const countBy = <T>(items: readonly T[], getKey: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

export const countWeighted = <T>(
  items: readonly T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number
): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + getValue(item);
    return counts;
  }, {});

export const aggregateMatrixStats = (entries: Array<{ key: string; placement: number; top8: boolean; win: boolean }>) =>
  Object.fromEntries(Object.entries(groupBy(entries, (entry) => entry.key)).map(([key, group]) => {
    const wins = group.filter((entry) => entry.win).length;
    const top8 = group.filter((entry) => entry.top8).length;
    return [key, {
      runs: group.length,
      wins,
      winRate: round2(wins / Math.max(1, group.length)),
      top8,
      top8Rate: round2(top8 / Math.max(1, group.length)),
      averagePlacement: round1(average(group.map((entry) => entry.placement)))
    }];
  }));

export const pickBestEntity = (entities: Record<string, { winRate: number; top8Rate: number; averagePlacement: number }>): string | null =>
  Object.entries(entities).sort(([, left], [, right]) =>
    (right.winRate - left.winRate) || (right.top8Rate - left.top8Rate) || (left.averagePlacement - right.averagePlacement)
  )[0]?.[0] ?? null;

export const pickWorstEntity = (entities: Record<string, { winRate: number; top8Rate: number; averagePlacement: number }>): string | null =>
  Object.entries(entities).sort(([, left], [, right]) =>
    (left.winRate - right.winRate) || (left.top8Rate - right.top8Rate) || (right.averagePlacement - left.averagePlacement)
  )[0]?.[0] ?? null;

export const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : sum(values) / values.length;

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + Number(value || 0), 0);

export const round1 = (value: number): number => Math.round(value * 10) / 10;
export const round2 = (value: number): number => Math.round(value * 100) / 100;
export const clamp = (min: number, max: number, value: number): number => Math.max(min, Math.min(max, value));
