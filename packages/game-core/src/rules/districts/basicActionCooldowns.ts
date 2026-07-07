import type { ConflictBalanceConfig } from "../../contracts";

const DEFAULT_ROB_COOLDOWN_TICKS = 2;
const DEFAULT_HEIST_COOLDOWN_TICKS = 2;

export const createRobCooldownKey = (targetDistrictId: string): string => `rob:${targetDistrictId}`;
export const createRobSourceCooldownKey = (sourceDistrictId: string): string => `rob-source:${sourceDistrictId}`;
export const createHeistCooldownKey = (targetDistrictId: string): string => `heist:${targetDistrictId}`;
export const createHeistSourceCooldownKey = (sourceDistrictId: string): string => `heist-source:${sourceDistrictId}`;

export const resolveRobCooldownTicks = (
  config?: Pick<ConflictBalanceConfig, "robCooldownTicks">
): number => sanitizeCooldownTicks(config?.robCooldownTicks ?? DEFAULT_ROB_COOLDOWN_TICKS);

export const resolveHeistCooldownTicks = (
  config?: Pick<ConflictBalanceConfig, "heistCooldownTicks">
): number => sanitizeCooldownTicks(config?.heistCooldownTicks ?? DEFAULT_HEIST_COOLDOWN_TICKS);

const sanitizeCooldownTicks = (value: number | undefined): number =>
  Math.max(0, Math.floor(Number(value ?? 0) || 0));
