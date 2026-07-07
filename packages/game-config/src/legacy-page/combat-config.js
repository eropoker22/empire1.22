export const ATTACK_SETUP_WEAPONS = {
  "baseball-bat": { power: 5, residents: 1 },
  pistol: { power: 10, residents: 1 },
  grenade: { power: 14, residents: 1 },
  smg: { power: 18, residents: 2 },
  bazooka: { power: 30, residents: 3 }
};

const MINUTE_MS = 60_000;

export const ATTACK_COOLDOWN_MS = 22 * MINUTE_MS;
export const ROBBERY_COOLDOWN_MS = 10 * MINUTE_MS;
export const OCCUPY_COOLDOWN_MS = 12 * MINUTE_MS;
export const MAX_SPIES = 2;
export const SPY_COOLDOWN_MS = 6 * MINUTE_MS;
export const DEFAULT_GANG_MEMBERS = 100;
