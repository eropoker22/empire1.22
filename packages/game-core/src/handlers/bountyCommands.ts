import type {
  Bounty,
  BountyObjectiveType,
  CancelBountyCommand,
  CreateBountyCommand
} from "@empire/shared-types";
import {
  BOUNTY_DURATION_OPTIONS_HOURS,
  BOUNTY_MIN_REWARD_CLEAN_CASH
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { expireBounties } from "./bountyClaims";
import { changeCleanCash, createBountyEventPayload, getPlayerResourceState, rejected } from "./bountyCommandUtils";

export type BountyCommand = CreateBountyCommand | CancelBountyCommand;
export { expireBounties, resolveBountyClaims, type BountyClaimInput } from "./bountyClaims";

export const handleBountyCommand = (
  state: CoreGameState,
  command: BountyCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const expiry = expireBounties(state, context);
  const currentState = expiry.nextState;
  const result = command.type === "create-bounty"
    ? createBounty(currentState, command, context)
    : cancelBounty(currentState, command);
  return {
    ...result,
    events: [...expiry.events, ...result.events]
  };
};

export const createBounty = (
  state: CoreGameState,
  command: CreateBountyCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const creator = state.playersById[command.playerId];
  const target = state.playersById[command.payload.targetPlayerId];
  const rewardCleanCash = Math.floor(Number(command.payload.rewardCleanCash || 0));
  const durationHours = Math.floor(Number(command.payload.durationHours || 0));
  const objectiveType = command.payload.objectiveType;
  const targetDistrictId = command.payload.targetDistrictId ?? null;

  if (!creator) return rejected(state, "bounty_creator_not_found", "Zadavatel bounty nebyl nalezen.");
  if (!target || target.status !== "active") return rejected(state, "bounty_target_not_found", "Cíl bounty není aktivní.");
  if (target.id === creator.id) return rejected(state, "bounty_target_self", "Nemůžeš vypsat bounty sám na sebe.");
  if (!isBountyObjectiveType(objectiveType)) return rejected(state, "bounty_invalid_objective", "Neplatný typ cíle bounty.");
  if (!Number.isInteger(command.payload.rewardCleanCash) || rewardCleanCash < BOUNTY_MIN_REWARD_CLEAN_CASH) {
    return rejected(state, "bounty_reward_too_low", `Minimální odměna bounty je ${BOUNTY_MIN_REWARD_CLEAN_CASH} clean cash.`);
  }
  if (!BOUNTY_DURATION_OPTIONS_HOURS.includes(durationHours as typeof BOUNTY_DURATION_OPTIONS_HOURS[number])) {
    return rejected(state, "bounty_invalid_duration", "Neplatná délka bounty.");
  }
  if (objectiveType === "attack-district" && !targetDistrictId) {
    return rejected(state, "bounty_target_district_required", "Pro bounty na district musíš vybrat cílový district.");
  }
  if (targetDistrictId && !isActiveDistrictOwnedBy(state, targetDistrictId, target.id)) {
    return rejected(state, "bounty_target_district_invalid", "Vybraný district nepatří cíli bounty.");
  }

  const resourceState = getPlayerResourceState(state, creator);
  if (!resourceState) return rejected(state, "bounty_resource_state_not_found", "Resource state hráče nebyl nalezen.");
  if (Math.floor(Number(resourceState.balances.cash || 0)) < rewardCleanCash) {
    return rejected(state, "bounty_insufficient_clean_cash", "Nemáš dost clean cash na složení bounty.");
  }

  const bountyId = `bounty:${command.id}`;
  if (state.bountiesById?.[bountyId]) {
    return { nextState: state, events: [], errors: [] };
  }

  const durationTicks = Math.ceil((durationHours * 60 * 60 * 1000) / Math.max(1, context.config.tickRateMs));
  const bounty: Bounty = {
    id: bountyId,
    createdByPlayerId: creator.id,
    targetPlayerId: target.id,
    targetDistrictId,
    objectiveType,
    rewardCleanCash,
    status: "active",
    createdAtTick: state.root.tick,
    expiresAtTick: state.root.tick + durationTicks,
    claimedByPlayerId: null,
    claimedAtTick: null,
    cancelledAtTick: null,
    isAnonymous: command.payload.isAnonymous === true,
    version: 1
  };
  const nextResourceState = changeCleanCash(resourceState, -rewardCleanCash);
  const nextState: CoreGameState = {
    ...state,
    bountiesById: {
      ...(state.bountiesById || {}),
      [bounty.id]: bounty
    },
    resourceStatesById: {
      ...state.resourceStatesById,
      [nextResourceState.id]: nextResourceState
    },
    root: {
      ...state.root,
      version: state.root.version + 1
    }
  };

  return {
    nextState,
    events: [createEvent(CORE_EVENT_TYPES.bountyCreated, createBountyEventPayload(bounty))],
    errors: []
  };
};

export const cancelBounty = (
  state: CoreGameState,
  command: CancelBountyCommand
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const bounty = state.bountiesById?.[command.payload.bountyId];
  if (!bounty) return rejected(state, "bounty_not_found", "Bounty nebyla nalezena.");
  if (bounty.createdByPlayerId !== command.playerId) return rejected(state, "bounty_cancel_forbidden", "Bounty může zrušit jen její zadavatel.");
  if (bounty.status !== "active") return rejected(state, "bounty_cancel_not_active", "Zrušit jde jen aktivní bounty.");

  const creator = state.playersById[bounty.createdByPlayerId];
  const resourceState = creator ? getPlayerResourceState(state, creator) : null;
  if (!resourceState) return rejected(state, "bounty_resource_state_not_found", "Resource state zadavatele nebyl nalezen.");

  const cancelled: Bounty = {
    ...bounty,
    status: "cancelled",
    cancelledAtTick: state.root.tick,
    version: bounty.version + 1
  };
  const nextResourceState = changeCleanCash(resourceState, bounty.rewardCleanCash);
  const nextState: CoreGameState = {
    ...state,
    bountiesById: {
      ...(state.bountiesById || {}),
      [cancelled.id]: cancelled
    },
    resourceStatesById: {
      ...state.resourceStatesById,
      [nextResourceState.id]: nextResourceState
    },
    root: {
      ...state.root,
      version: state.root.version + 1
    }
  };

  return {
    nextState,
    events: [createEvent(CORE_EVENT_TYPES.bountyCancelled, createBountyEventPayload(cancelled))],
    errors: []
  };
};

const isActiveDistrictOwnedBy = (state: CoreGameState, districtId: string, playerId: string): boolean => {
  const district = state.districtsById[districtId];
  return Boolean(district && district.ownerPlayerId === playerId && district.status !== "destroyed" && !district.lockdownUntilTick);
};

const isBountyObjectiveType = (value: unknown): value is BountyObjectiveType =>
  value === "attack-player" || value === "attack-district" || value === "destroy-player-district";
