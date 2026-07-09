import type { CentralBankBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import { getCentralBankMetadata } from "../handlers/centralBankBuildingActions";
import { getCityHallMetadata } from "../handlers/cityHallBuildingActions";
import { formatNumber, formatTickLabel } from "./district-building-action-formatters";

export const formatFinanceActionCooldown = (
  building: CoreGameState["buildingsById"][string],
  actionId: string,
  tick: number
): string => {
  const remainingTicks = Math.max(0, Number((building.actionCooldowns ?? {})[actionId] || 0) - tick);
  return remainingTicks > 0 ? formatTickLabel(remainingTicks) : "připraveno";
};

export const formatCityHallEmergencyDecree = (
  decree: NonNullable<ReturnType<typeof getCityHallMetadata>["emergencyDecree"]>,
  tick: number
): string => {
  const remaining = formatTickLabel(Math.max(0, decree.expiresAtTick - tick));
  if (decree.modeId === "night_patrols") return `Noční hlídky: hostile akce pomalejší a viditelnější · ${remaining}`;
  if (decree.modeId === "suspended_checks") return `Pozastavené kontroly: nižší heat/audit tlak · ${remaining}`;
  if (decree.modeId === "construction_closure") return `Stavební uzávěra${decree.zone ? ` ${decree.zone}` : ""}: pohyb/obsazování zpomalené · ${remaining}`;
  return `${decree.modeId}${decree.zone ? ` ${decree.zone}` : ""} ${remaining}`;
};

export const resolveCentralBankOversightRiskForUi = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: CentralBankBalanceConfig,
  tick: number
): number => {
  const metadata = getCentralBankMetadata(building, tick);
  const playerId = building.ownerPlayerId;
  const player = playerId ? state.playersById[playerId] : undefined;
  const policeState = player ? state.policeStatesById[player.policeStateId] : undefined;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const heatRisk = Number(policeState?.heat || 0) > config.financialOversight.heatThreshold
    ? config.financialOversight.heatRiskPct
    : 0;
  const stockRisk = playerId && Object.values(state.buildingsById).some((candidate) => candidate.ownerPlayerId === playerId && candidate.status === "active" && candidate.buildingTypeId === "stock_exchange")
    ? config.financialOversight.stockExchangeRiskPct
    : 0;
  const cityHallReduction = playerId && Object.values(state.buildingsById).some((candidate) => candidate.ownerPlayerId === playerId && candidate.status === "active" && candidate.buildingTypeId === "city_hall")
    ? config.financialOversight.cityHallRiskReductionPct
    : 0;
  return Math.max(0, Math.min(100, config.financialOversight.passiveRiskPct + eventRisk + heatRisk + stockRisk - cityHallReduction));
};

export const formatMultiplierBonus = (value: number): string =>
  `${Number(value || 1) >= 1 ? "+" : ""}${formatNumber((Number(value || 1) - 1) * 100)} %`;
