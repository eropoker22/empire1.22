export interface Clock {
  nowIso(): string;
}

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString()
};

export const createFixedClock = (isoTimestamp: string): Clock => ({
  nowIso: () => isoTimestamp
});
