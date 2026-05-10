import type { Notification, ResourceState, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig, StreetDealerDrugSaleConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { composeEntityId } from "../utils";
import { deterministicUnitInterval } from "../utils/math";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";
import { resolveDealerSupplyStats, resolveOpenChannelStats } from "./smugglingTunnelBuildingActions";

export type StreetDealerIncidentType =
  | "loose_talk"
  | "dealer_under_watch"
  | "fake_customer"
  | "street_conflict"
  | "lost_package"
  | "overloaded_route"
  | "courier_vanished"
  | "police_whisper"
  | "hot_package"
  | "side_skim";

export interface StreetDealerSaleSlot {
  slotId: string;
  saleId?: string;
  itemId?: string;
  itemLabel?: string;
  amount?: number;
  startedAtTick?: number;
  completesAtTick?: number;
  rewardDirtyCash?: number;
  heatGain?: number;
  streetRiskPct?: number;
  originDistrictId?: string;
  originBuildingId?: string;
  cooldownUntilTick?: number;
}

export interface StreetDealersPlayerMetadata {
  slots: StreetDealerSaleSlot[];
  saleHistory: Array<Record<string, unknown>>;
}

export interface StreetDealerNetworkMultipliers {
  passiveDirtyIncomeMultiplier: number;
  salePriceMultiplier: number;
  saleSpeedMultiplier: number;
  heatMultiplier: number;
}

export interface StreetDealersActionResolution {
  balances: Record<string, number>;
  buildingMetadata?: Record<string, unknown>;
  playerMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  streetDealerResult: Record<string, unknown>;
}

export const getOwnedStreetDealerCount = (
  state: CoreGameState,
  playerId: string,
  config: StreetDealersBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveStreetDealerNetworkMultipliers = (
  count: number,
  config: StreetDealersBalanceConfig
): StreetDealerNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    passiveDirtyIncomeMultiplier: Math.min(
      config.network.maxPassiveDirtyIncomeMultiplier,
      1 + extra * config.network.passiveDirtyIncomeBonusPctPerExtraDealer / 100
    ),
    salePriceMultiplier: Math.min(
      config.network.maxSalePriceMultiplier,
      1 + extra * config.network.salePriceBonusPctPerExtraDealer / 100
    ),
    saleSpeedMultiplier: Math.min(
      config.network.maxSaleSpeedMultiplier,
      1 + extra * config.network.saleSpeedBonusPctPerExtraDealer / 100
    ),
    heatMultiplier: Math.min(
      config.network.maxHeatMultiplier,
      1 + extra * config.network.heatBonusPctPerExtraDealer / 100
    )
  };
};

export const resolveStreetDealerSlotCount = (
  ownedCount: number,
  config: StreetDealersBalanceConfig
): number =>
  config.dealerSlots.find((tier) =>
    ownedCount >= tier.minOwned && (tier.maxOwned === null || ownedCount <= tier.maxOwned)
  )?.slots ?? 0;

export const applyStreetDealersIncomeModifiers = (input: {
  config: StreetDealersBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveStreetDealerNetworkMultipliers(
    getOwnedStreetDealerCount(input.state, input.building.ownerPlayerId, input.config),
    input.config
  );
  const dealerSupply = resolveDealerSupplyStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.smugglingTunnelConfig
  });
  return {
    cleanPerHour: 0,
    dirtyPerHour: input.dirtyPerHour * network.passiveDirtyIncomeMultiplier * (1 + dealerSupply.passiveDirtyIncomeBonusPct / 100),
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

export const resolveStreetDealersAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  command: RunBuildingActionCommand;
  balances: Record<string, number>;
  config: StreetDealersBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
}): StreetDealersActionResolution | null => {
  if (input.action.actionId !== input.config.startDrugSale.actionId || input.building.buildingTypeId !== input.config.buildingTypeId) {
    return null;
  }

  const ownedCount = getOwnedStreetDealerCount(input.state, input.player.id, input.config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, input.config);
  const slotId = resolveRequestedSlotId(input.command.payload, slotCount);
  const drug = resolveDrugConfig(input.command.payload.itemId, input.config);
  const amount = Math.floor(Number(input.command.payload.amount || 0));
  const network = resolveStreetDealerNetworkMultipliers(ownedCount, input.config);
  const dealerSupply = resolveDealerSupplyStats({ state: input.state, playerId: input.player.id, config: input.smugglingTunnelConfig });
  const openChannel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.player.id,
    config: input.smugglingTunnelConfig,
    tick: input.state.root.tick
  });
  const salePriceMultiplier = network.salePriceMultiplier
    * (1 + dealerSupply.salePriceBonusPct / 100 + openChannel.dealerSalePriceBonusPct / 100);
  const saleSpeedMultiplier = network.saleSpeedMultiplier
    * (1 + dealerSupply.saleSpeedBonusPct / 100 + openChannel.dealerSaleSpeedBonusPct / 100);
  const saleHeatMultiplier = network.heatMultiplier
    * (1 + dealerSupply.saleHeatRiskBonusPct / 100);
  const rewardDirtyCash = Math.floor(amount * drug.basePriceDirtyCash * salePriceMultiplier);
  const durationTicks = Math.max(
    1,
    Math.ceil((drug.baseDurationMinutes * 60000 / saleSpeedMultiplier) / Math.max(1, input.tickRateMs))
  );
  const heatGain = Math.ceil(amount * drug.baseHeatPerUnit * saleHeatMultiplier);
  const heatPreview = Math.ceil(heatGain * (1 + openChannel.dealerSaleHeatBonusPct / 100));
  const streetRiskPct = resolveStreetRiskPct(amount, drug, input.config, dealerSupply.streetRiskReductionPct);
  const streetRiskPreviewPct = Math.min(input.config.streetIncidents.maxStreetRiskPct, streetRiskPct + openChannel.streetIncidentFlatRiskPct);
  const metadata = getStreetDealersPlayerMetadata(input.player);
  const nextSlot: StreetDealerSaleSlot = {
    slotId,
    saleId: composeEntityId("street-sale", `${input.command.id}:${slotId}`),
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount,
    startedAtTick: input.state.root.tick,
    completesAtTick: input.state.root.tick + durationTicks,
    rewardDirtyCash,
    heatGain,
    streetRiskPct,
    originDistrictId: input.command.payload.districtId,
    originBuildingId: input.command.payload.buildingId
  };
  const nextMetadata: StreetDealersPlayerMetadata = {
    slots: upsertSlot(metadata.slots, nextSlot),
    saleHistory: metadata.saleHistory
  };

  return {
    balances: {
      ...input.balances,
      [drug.itemId]: Math.max(0, Number(input.balances[drug.itemId] || 0) - amount)
    },
    playerMetadata: withStreetDealersPlayerMetadata(input.player, nextMetadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: { [drug.itemId]: amount },
    outputGain: {},
    reportText: `Dealer slot ${slotId} prodává ${amount}x ${drug.label}. Hotovo za ${durationTicks} ticků, street risk ${streetRiskPct} %.`,
    streetDealerResult: {
      type: "sale_started",
      slotId,
      itemId: drug.itemId,
      itemLabel: drug.label,
      amount,
      ownedStreetDealers: ownedCount,
      availableSlots: slotCount,
      multipliers: network,
      dealerSupply,
      openChannel,
      effectiveMultipliers: {
        salePriceMultiplier,
        saleSpeedMultiplier,
        saleHeatMultiplier
      },
      rewardPreviewDirtyCash: rewardDirtyCash,
      heatPreview,
      durationTicks,
      completesAtTick: nextSlot.completesAtTick,
      streetRiskPct: streetRiskPreviewPct
    }
  };
};

export const validateStreetDealersAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  command: RunBuildingActionCommand;
  actionId: string;
  balances: Record<string, number>;
  config?: StreetDealersBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.actionId !== config.startDrugSale.actionId || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const ownedCount = getOwnedStreetDealerCount(input.state, input.player.id, config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, config);
  if (ownedCount <= 0 || slotCount <= 0) return "street_dealers_no_owned_dealers";

  const slotId = resolveRequestedSlotId(input.command.payload, slotCount);
  if (!slotId) return "street_dealers_missing_slot";
  if (!isValidSlotId(slotId, slotCount)) return "street_dealers_invalid_slot";

  const metadata = getStreetDealersPlayerMetadata(input.player);
  const slot = metadata.slots.find((candidate) => candidate.slotId === slotId);
  if (isStreetDealerSlotLocked(slot, input.state.root.tick)) return "street_dealers_slot_locked";

  const drug = resolveDrugConfigOrNull(input.command.payload.itemId, config);
  if (!drug) return "street_dealers_invalid_drug_item";

  const amount = Math.floor(Number(input.command.payload.amount || 0));
  if (amount <= 0) return "street_dealers_invalid_amount";
  if (amount > drug.maxAmountPerSlot) return "street_dealers_amount_above_slot_cap";
  if (Math.max(0, Number(input.balances[drug.itemId] || 0)) < amount) return "street_dealers_insufficient_drug_stock";
  return null;
};

export const completeStreetDealerSales = (
  state: CoreGameState,
  config: StreetDealersBalanceConfig,
  smugglingTunnelConfig: SmugglingTunnelBalanceConfig | undefined,
  tickRateMs: number
): { nextState: CoreGameState; events: CoreEvent[] } => {
  let playersById = state.playersById;
  let resourceStatesById = state.resourceStatesById;
  let districtsById = state.districtsById;
  let policeStatesById = state.policeStatesById;
  let notificationsById = state.notificationsById;
  let notificationIds = state.root.notificationIds;
  const events: CoreEvent[] = [];
  let changed = false;

  for (const player of Object.values(state.playersById)) {
    const metadata = getStreetDealersPlayerMetadata(playersById[player.id] ?? player);
    if (metadata.slots.length <= 0) continue;

    const currentResourceState = resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    let nextBalances = currentResourceState.balances;
    let currentPoliceState = policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
    let playerChanged = false;
    const nextSlots: StreetDealerSaleSlot[] = [];
    const history = [...metadata.saleHistory];

    for (const slot of metadata.slots) {
      if (slot.saleId && Number(slot.completesAtTick || 0) <= state.root.tick) {
        const completion = resolveSaleCompletion({ state, playerId: player.id, slot, config, smugglingTunnelConfig, tickRateMs });
        nextBalances = {
          ...nextBalances,
          "dirty-cash": Math.max(0, Number(nextBalances["dirty-cash"] || 0) + completion.rewardDirtyCash)
        };

        const district = districtsById[slot.originDistrictId ?? ""];
        if (district) {
          districtsById = {
            ...districtsById,
            [district.id]: {
              ...district,
              heat: Math.max(0, Number(district.heat || 0) + completion.heatGain),
              version: district.version + 1
            }
          };
        }

        const nextPoliceHeat = Math.max(0, Number(currentPoliceState.heat || 0) + completion.heatGain);
        currentPoliceState = {
          ...currentPoliceState,
          heat: nextPoliceHeat,
          wantedLevel: resolveWantedLevel(nextPoliceHeat),
          version: currentPoliceState.version + (policeStatesById[currentPoliceState.id] ? 1 : 0)
        };
        const result = {
          type: "sale_completed",
          slotId: slot.slotId,
          itemId: slot.itemId,
          itemLabel: slot.itemLabel,
          amount: slot.amount,
          rewardDirtyCash: completion.rewardDirtyCash,
          baseRewardDirtyCash: slot.rewardDirtyCash,
          heatGain: completion.heatGain,
          streetRiskPct: slot.streetRiskPct,
          incident: completion.incident
        };
        history.push({ tick: state.root.tick, ...result });
        const notification = createStreetDealerSaleNotification({
          state,
          playerId: player.id,
          slot,
          result,
          districtId: slot.originDistrictId ?? "",
          buildingId: slot.originBuildingId ?? "",
          eventId: composeEntityId("event", `${slot.saleId}:completed`)
        });
        notificationsById = { ...notificationsById, [notification.id]: notification };
        notificationIds = [...notificationIds, notification.id];
        events.push(
          createEvent(CORE_EVENT_TYPES.buildingActionResolved, {
            playerId: player.id,
            districtId: slot.originDistrictId,
            buildingId: slot.originBuildingId,
            buildingTypeId: config.buildingTypeId,
            actionId: config.startDrugSale.actionId,
            outputGain: { "dirty-cash": completion.rewardDirtyCash },
            inputCost: {},
            resourceDelta: { "dirty-cash": completion.rewardDirtyCash },
            dirtyCashDelta: completion.rewardDirtyCash,
            heatGain: completion.heatGain,
            influenceChange: 0,
            streetDealerResult: result,
            reportText: notification.payload.message,
            eventId: notification.payload.eventId
          }),
          createEvent(CORE_EVENT_TYPES.notificationCreated, {
            notificationId: notification.id,
            recipientId: player.id,
            category: notification.category
          })
        );

        if (completion.incident?.type === "dealer_under_watch" || completion.incident?.type === "overloaded_route") {
          nextSlots.push({
            slotId: slot.slotId,
            cooldownUntilTick: state.root.tick + minutesToTicks(Number(completion.incident.extraCooldownMinutes || config.streetIncidents.extraCooldownMinutes), tickRateMs)
          });
        }
        playerChanged = true;
        continue;
      }

      if (!slot.saleId && Number(slot.cooldownUntilTick || 0) <= state.root.tick) {
        playerChanged = true;
        continue;
      }

      nextSlots.push(slot);
    }

    if (!playerChanged) continue;

    const nextMetadata: StreetDealersPlayerMetadata = {
      slots: nextSlots,
      saleHistory: history.slice(-20)
    };
    playersById = {
      ...playersById,
      [player.id]: {
        ...player,
        metadata: withStreetDealersPlayerMetadata(player, nextMetadata),
        version: player.version + 1
      }
    };
    resourceStatesById = {
      ...resourceStatesById,
      [currentResourceState.id]: {
        ...currentResourceState,
        balances: nextBalances,
        lastUpdatedTick: state.root.tick,
        version: currentResourceState.version + (resourceStatesById[currentResourceState.id] ? 1 : 0)
      }
    };
    policeStatesById = {
      ...policeStatesById,
      [currentPoliceState.id]: currentPoliceState
    };
    changed = true;
  }

  return changed
    ? {
        nextState: {
          ...state,
          playersById,
          resourceStatesById,
          districtsById,
          policeStatesById,
          notificationsById,
          root: {
            ...state.root,
            notificationIds,
            version: state.root.version + 1
          }
        },
        events
      }
    : { nextState: state, events };
};

export const getStreetDealersPlayerMetadata = (
  player: CoreGameState["playersById"][string]
): StreetDealersPlayerMetadata => {
  const raw = isRecord(player.metadata?.streetDealers) ? player.metadata.streetDealers : {};
  return {
    slots: Array.isArray(raw.slots) ? raw.slots.map(readSlot).filter((slot): slot is StreetDealerSaleSlot => Boolean(slot)) : [],
    saleHistory: Array.isArray(raw.saleHistory) ? raw.saleHistory.filter(isRecord).slice(-20) : []
  };
};

const withStreetDealersPlayerMetadata = (
  player: CoreGameState["playersById"][string],
  streetDealers: StreetDealersPlayerMetadata
): Record<string, unknown> => ({
  ...(player.metadata ?? {}),
  streetDealers
});

const resolveRequestedSlotId = (
  payload: RunBuildingActionCommand["payload"],
  slotCount: number
): string => {
  const requested = String(payload.dealerSlotId || payload.slotId || "").trim();
  if (!requested && slotCount > 0) return "slot-1";
  return requested;
};

const resolveDrugConfig = (
  itemId: unknown,
  config: StreetDealersBalanceConfig
): StreetDealerDrugSaleConfig => {
  const drug = resolveDrugConfigOrNull(itemId, config);
  if (!drug) {
    throw new Error(`Unsupported street dealer drug item: ${String(itemId ?? "").trim()}`);
  }
  return drug;
};

const resolveDrugConfigOrNull = (
  itemId: unknown,
  config: StreetDealersBalanceConfig
): StreetDealerDrugSaleConfig | null => {
  const requested = String(itemId ?? "").trim();
  const drug = config.sellableDrugs.find((candidate) =>
    candidate.itemId === requested || (candidate.aliases ?? []).includes(requested)
  );
  return drug ?? null;
};

const isValidSlotId = (slotId: string, slotCount: number): boolean => {
  const match = /^slot-(\d+)$/.exec(slotId);
  if (!match) return false;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 1 && index <= slotCount;
};

const resolveStreetRiskPct = (
  amount: number,
  drug: StreetDealerDrugSaleConfig,
  config: StreetDealersBalanceConfig,
  streetRiskReductionPct = 0
): number =>
  Math.min(
    config.streetIncidents.maxStreetRiskPct,
    (drug.baseStreetRiskPct + Math.max(0, amount)) * (1 - Math.max(0, streetRiskReductionPct) / 100)
  );

const isStreetDealerSlotLocked = (
  slot: StreetDealerSaleSlot | undefined,
  tick: number
): boolean =>
  Boolean(slot?.saleId) || Number(slot?.cooldownUntilTick || 0) > tick;

const upsertSlot = (
  slots: StreetDealerSaleSlot[],
  nextSlot: StreetDealerSaleSlot
): StreetDealerSaleSlot[] => [
  ...slots.filter((slot) => slot.slotId !== nextSlot.slotId),
  nextSlot
].sort((left, right) => left.slotId.localeCompare(right.slotId));

const resolveSaleCompletion = (input: {
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

const createStreetDealerSaleNotification = (input: {
  state: CoreGameState;
  playerId: string;
  slot: StreetDealerSaleSlot;
  result: Record<string, unknown>;
  districtId: string;
  buildingId: string;
  eventId: string;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.slot.saleId}:report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.building-action",
    title: "Pouliční prodej dokončen",
    bodyKey: "report.building-action",
    payload: {
      reportId: composeEntityId("report", `${input.slot.saleId}:building-action`),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: input.playerId,
      districtId: input.districtId,
      buildingId: input.buildingId,
      buildingTypeId: "street_dealers",
      buildingType: "street_dealers",
      buildingActionId: "start_drug_sale",
      actionId: "start_drug_sale",
      actionLabel: "Spustit prodej",
      result: "success",
      success: true,
      inputCost: {},
      outputGain: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      resourceDelta: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      cashDelta: 0,
      dirtyCashDelta: Number(input.result.rewardDirtyCash || 0),
      heatDelta: Number(input.result.heatGain || 0),
      influenceDelta: 0,
      producedItems: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      consumedItems: {},
      cooldownUntilTick: 0,
      message: createCompletionMessage(input.result),
      policeImpact: {
        heatDelta: Number(input.result.heatGain || 0)
      },
      streetDealerResult: input.result,
      heatGain: Number(input.result.heatGain || 0),
      influenceChange: 0,
      tick: input.state.root.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

const createCompletionMessage = (result: Record<string, unknown>): string => {
  const incident = isRecord(result.incident) ? ` Incident: ${String(result.incident.label || result.incident.type)}.` : "";
  return `Pouliční prodej dokončen. Dirty cash +${Number(result.rewardDirtyCash || 0)}, heat +${Number(result.heatGain || 0)}.${incident}`;
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

const readSlot = (value: unknown): StreetDealerSaleSlot | null => {
  if (!isRecord(value)) return null;
  const slotId = String(value.slotId || "").trim();
  if (!slotId) return null;
  return {
    slotId,
    saleId: optionalString(value.saleId),
    itemId: optionalString(value.itemId),
    itemLabel: optionalString(value.itemLabel),
    amount: optionalNumber(value.amount),
    startedAtTick: optionalTick(value.startedAtTick),
    completesAtTick: optionalTick(value.completesAtTick),
    rewardDirtyCash: optionalNumber(value.rewardDirtyCash),
    heatGain: optionalNumber(value.heatGain),
    streetRiskPct: optionalNumber(value.streetRiskPct),
    originDistrictId: optionalString(value.originDistrictId),
    originBuildingId: optionalString(value.originBuildingId),
    cooldownUntilTick: optionalTick(value.cooldownUntilTick)
  };
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const optionalString = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : undefined;
};

const optionalTick = (value: unknown): number | undefined => {
  const amount = optionalNumber(value);
  return amount === undefined ? undefined : Math.floor(amount);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
