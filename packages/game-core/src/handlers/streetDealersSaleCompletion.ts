import type { SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { composeEntityId } from "../utils";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";
import { minutesToTicks } from "./streetDealersActionHelpers";
import { getStreetDealersPlayerMetadata, withStreetDealersPlayerMetadata } from "./streetDealersMetadata";
import { createStreetDealerSaleNotification } from "./streetDealersNotifications";
import { createPlayerResourceState } from "./streetDealersPlayerState";
import { resolveSaleCompletion } from "./streetDealersSaleOutcomes";
import type { StreetDealerSaleSlot, StreetDealersPlayerMetadata } from "./streetDealersTypes";
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

