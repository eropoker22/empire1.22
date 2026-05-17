export interface Clock {
  now(): Date;
  nowIso(): string;
}

export const createSystemClock = (): Clock => ({
  now: () => new Date(),
  nowIso: () => new Date().toISOString()
});

export const systemClock: Clock = createSystemClock();

export const createFixedClock = (timestamp: string | Date): Clock => {
  const fixedTime = typeof timestamp === "string"
    ? new Date(timestamp)
    : new Date(timestamp.getTime());

  return {
    now: () => new Date(fixedTime.getTime()),
    nowIso: () => fixedTime.toISOString()
  };
};
