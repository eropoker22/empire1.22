import type { PublicModeConfig } from "../contracts/public-mode-config";

/**
 * Responsibility: Shared public mode metadata safe for clients and admin views.
 * Belongs here: labels and namespaced client storage metadata.
 * Does not belong here: hidden balancing numbers or private server policy values.
 */
export const basePublicModeConfig: PublicModeConfig = {
  mode: "free",
  label: "Empire Streets",
  matchStyle: "short",
  tickRateMs: 5000,
  sessionKeyPrefix: "empire:base"
};

