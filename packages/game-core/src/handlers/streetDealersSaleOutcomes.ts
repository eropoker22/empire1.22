import type { SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { resolveOpenChannelStats } from "./smugglingTunnelBuildingActions";
import type { StreetDealerIncidentType, StreetDealerSaleSlot } from "./streetDealersTypes";
export const resolveSaleCompletion = (input: {
  state: CoreGameState;
  playerId: string;
  slot: StreetDealerSaleSlot;
  config: StreetDealersBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
}): { rewardDirtyCash: number; heatGain: number; incident?: Record<string, unknown> } => {
  let rewardDirtyCash = Math.max(0, Math.floor(Number(input.slot.rewardDirtyCash || 0)));
  let heatGain = Math.max(0, Math.ceil(Number(input.slot.heatGain || 0)));
  const openChannel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.playerId,
    config: input.smugglingTunnelConfig,
    tick: input.state.root.tick
  });
  if (openChannel.active) {
    rewardDirtyCash = Math.floor(rewardDirtyCash * (1 + openChannel.dealerCompletionRewardBonusPct / 100));
    heatGain = Math.ceil(heatGain * (1 + openChannel.dealerSaleHeatBonusPct / 100));
  }
  const riskPct = Math.min(
    input.config.streetIncidents.maxStreetRiskPct,
    Math.max(0, Number(input.slot.streetRiskPct || 0)) + openChannel.streetIncidentFlatRiskPct
  );
  const saleSeed = `${input.state.serverInstance.worldSeed}:street_dealers:${input.playerId}:${input.slot.saleId}:${input.slot.startedAtTick}`;
  const incidentTriggered = deterministicUnitInterval(`${saleSeed}:trigger`) < riskPct / 100;
  if (!incidentTriggered) return { rewardDirtyCash, heatGain };

  const incidentTypes: StreetDealerIncidentType[] = openChannel.active
    ? ["overloaded_route", "courier_vanished", "police_whisper", "hot_package", "side_skim"]
    : ["loose_talk", "dealer_under_watch", "fake_customer", "street_conflict", "lost_package"];
  const type = incidentTypes[Math.min(incidentTypes.length - 1, Math.floor(deterministicUnitInterval(`${saleSeed}:type`) * incidentTypes.length))];
  if (type === "fake_customer") {
    rewardDirtyCash = Math.floor(rewardDirtyCash * (1 - input.config.streetIncidents.fakeCustomerRewardPenaltyPct / 100));
  } else if (type === "street_conflict") {
    heatGain += input.config.streetIncidents.streetConflictHeatGain;
  } else if (type === "lost_package") {
    rewardDirtyCash = Math.floor(rewardDirtyCash * (1 - input.config.streetIncidents.lostPackageAmountPct / 100));
  } else if (type === "courier_vanished") {
    rewardDirtyCash = Math.floor(rewardDirtyCash * 0.8);
  } else if (type === "hot_package") {
    heatGain += 7;
  } else if (type === "side_skim") {
    rewardDirtyCash = Math.floor(rewardDirtyCash * 0.9);
  }

  return {
    rewardDirtyCash,
    heatGain,
    incident: {
      type,
      label: resolveIncidentLabel(type),
      extraCooldownMinutes: type === "dealer_under_watch"
        ? input.config.streetIncidents.extraCooldownMinutes
        : type === "overloaded_route"
          ? 2
          : 0
    }
  };
};

const resolveIncidentLabel = (type: StreetDealerIncidentType): string => {
  switch (type) {
    case "loose_talk":
      return "Feťák mluvil moc";
    case "dealer_under_watch":
      return "Dealer pod dohledem";
    case "fake_customer":
      return "Falešný zákazník";
    case "street_conflict":
      return "Pouliční konflikt";
    case "lost_package":
      return "Ztracený balík";
    case "overloaded_route":
      return "Přetížená trasa";
    case "courier_vanished":
      return "Kurýr zmizel";
    case "police_whisper":
      return "Policejní šeptanda";
    case "hot_package":
      return "Horký balík";
    case "side_skim":
      return "Zboží šlo bokem";
  }
};

