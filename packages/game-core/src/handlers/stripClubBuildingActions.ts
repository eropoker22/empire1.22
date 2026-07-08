import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, LobbyClubBalanceConfig, ResolvedGameModeConfig, StripClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { applyResolvedRumorEventsToState, createPassiveBuildingRumorInput, type ResolveRumorEventInput } from "../rules/events/rumorPipeline";

export interface StripClubNetworkMultipliers {
  incomeMultiplier: number;
  influenceMultiplier: number;
  rumorMultiplier: number;
  heatMultiplier: number;
}

export interface StripClubRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  buildingHint: string | null;
  probabilityVisible: boolean;
  verifiedIntel: boolean;
  text: string;
}

export interface StripClubActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  stripClubResult: Record<string, unknown>;
}

interface StripClubMetadata {
  vipLoungeExpiresAtTick?: number;
  privatePartyExpiresAtTick?: number;
  lastPassiveRumorCheckTick?: number;
  rumorEvents: StripClubRumor[];
  contacts: Array<{ id: string; label: string; effectSummary: string; expiresAtTick: number | null; gainedAtTick: number }>;
  scandalEvents: Array<Record<string, unknown>>;
}

export const getOwnedStripClubCount = (
  state: CoreGameState,
  playerId: string,
  config: StripClubBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveStripClubNetworkMultipliers = (
  count: number,
  config: StripClubBalanceConfig
): StripClubNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraStripClub / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraStripClub / 100),
    rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraStripClub / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStripClub / 100)
  };
};

export const resolveStripClubRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: StripClubBalanceConfig;
  vipActive?: boolean;
}) => {
  const stripClubCount = getOwnedStripClubCount(input.state, input.playerId, input.config);
  const network = resolveStripClubNetworkMultipliers(stripClubCount, input.config);
  return {
    stripClubCount,
    network,
    passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier + (input.vipActive ? input.config.vipLounge.rumorChanceFlatBonusPct : 0)),
    truthChancePct: Math.min(
      input.config.maxTruthChancePct,
      input.config.baseTruthChancePct + Math.max(0, stripClubCount - 1) * input.config.truthChancePctPerExtraClub
    ),
    districtHintChancePct: input.config.districtHintChancePct,
    buildingHintChancePct: input.config.buildingHintChancePct,
    probabilityVisible: false,
    verifiedIntelEligible: false
  };
};

export const applyStripClubIncomeModifiers = (input: {
  config: StripClubBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
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
  const metadata = cleanupStripClubMetadata(getStripClubMetadata(input.building), input.tick);
  const network = resolveStripClubNetworkMultipliers(getOwnedStripClubCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  const vipActive = (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick;
  const partyActive = (metadata.privatePartyExpiresAtTick ?? 0) > input.tick;
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * (vipActive ? 1 + input.config.vipLounge.cleanIncomeBonusPct / 100 : 1),
    dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * (vipActive ? 1 + input.config.vipLounge.dirtyIncomeBonusPct / 100 : 1),
    heatPerDay: input.heatPerDay * network.heatMultiplier * (vipActive ? 1 + input.config.vipLounge.heatBonusPct / 100 : 1),
    influencePerDay: input.influencePerDay * network.influenceMultiplier * (vipActive ? 1 + input.config.vipLounge.influenceBonusPct / 100 : 1) * (partyActive ? 1 + input.config.privateParty.influenceProductionBonusPct / 100 : 1),
    maxLevel: 1
  };
};

export const resolveStripClubAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  stripClubConfig: StripClubBalanceConfig;
  tickRateMs: number;
  commandId: string;
}): StripClubActionResolution | null => {
  const config = input.stripClubConfig;
  if (input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = cleanupStripClubMetadata(getStripClubMetadata(input.building), input.state.root.tick);

  if (input.action.actionId === config.vipLounge.actionId) {
    metadata.vipLoungeExpiresAtTick = input.state.root.tick + minutesToTicks(config.vipLounge.durationMinutes, input.tickRateMs);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - config.vipLounge.cleanCashCost) },
      buildingMetadata: withStripClubMetadata(input.building, metadata),
      heatGain: 0,
      influenceChange: 0,
      inputCost: { cash: config.vipLounge.cleanCashCost },
      outputGain: {},
      effectModifiers: input.action.effectModifiers,
      reportText: `VIP salonek aktivní ${config.vipLounge.durationMinutes} minut. Rumor chance +${config.vipLounge.rumorChanceFlatBonusPct} %.`,
      stripClubResult: { type: "temporary_boost", activeUntilTick: metadata.vipLoungeExpiresAtTick, rumorChanceFlatBonusPct: config.vipLounge.rumorChanceFlatBonusPct }
    };
  }

  if (input.action.actionId === config.privateParty.actionId) {
    metadata.privatePartyExpiresAtTick = input.state.root.tick + minutesToTicks(config.privateParty.durationMinutes, input.tickRateMs);
    const extraRumor = deterministicRollPct(`${input.commandId}:extra-rumor:${input.state.root.tick}`) < config.privateParty.extraRumorChancePct
      ? generateStripClubRumor({
          state: input.state,
          playerId: input.building.ownerPlayerId ?? "",
          buildingId: input.building.id,
          config,
          seed: `${input.commandId}:party-rumor:${input.state.root.tick}`
        })
      : null;
    const contact = deterministicRollPct(`${input.commandId}:contact:${input.state.root.tick}`) < config.privateParty.contactChancePct
      ? resolveContact(config, input.commandId, input.state.root.tick, input.tickRateMs)
      : null;
    const scandal = deterministicRollPct(`${input.commandId}:scandal:${input.state.root.tick}`) < config.privateParty.scandalChancePct;

    if (extraRumor) {
      metadata.rumorEvents.push(extraRumor);
    }
    if (contact) {
      metadata.contacts.push(contact);
    }
    if (scandal) {
      const scandalRumor = generateStripClubRumor({
        state: input.state,
        playerId: input.building.ownerPlayerId ?? "",
        buildingId: input.building.id,
        config,
        seed: `${input.commandId}:scandal-rumor:${input.state.root.tick}`,
        forcedType: "relationships",
        forcedFalse: false
      });
      metadata.rumorEvents.push(scandalRumor);
      metadata.scandalEvents.push({ tick: input.state.root.tick, rumor: scandalRumor });
    }

    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - config.privateParty.cleanCashCost) },
      buildingMetadata: withStripClubMetadata(input.building, metadata),
      heatGain: config.privateParty.heatGain + (scandal ? config.privateParty.scandalHeatGain : 0),
      influenceChange: config.privateParty.instantInfluenceGain - (scandal ? config.privateParty.scandalInfluenceLoss : 0),
      inputCost: { cash: config.privateParty.cleanCashCost },
      outputGain: {},
      effectModifiers: input.action.effectModifiers,
      reportText: scandal
        ? "Soukromá party skončila skandálem. Heat výrazně vzrostl a vliv klesl."
        : "Soukromá party přinesla vliv a zákulisní příležitosti.",
      stripClubResult: {
        type: "influence_contact_event",
        activeUntilTick: metadata.privatePartyExpiresAtTick,
        extraRumor,
        contact,
        scandal,
        scandalRiskPct: config.privateParty.scandalChancePct
      }
    };
  }

  return null;
};

export const validateStripClubAction = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  stripClubConfig?: StripClubBalanceConfig;
}): string | null => {
  const config = input.stripClubConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = getStripClubMetadata(input.building);
  if (input.actionId === config.vipLounge.actionId && (metadata.vipLoungeExpiresAtTick ?? 0) > input.state.root.tick) {
    return "strip_club_vip_lounge_active";
  }
  if (input.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.state.root.tick) {
    return "strip_club_private_party_active";
  }
  return null;
};

export const applyStripClubPassiveRumors = (
  state: CoreGameState,
  config: StripClubBalanceConfig,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig,
  dayNightConfig?: ResolvedGameModeConfig
): CoreGameState => {
  const intervalTicks = minutesToTicks(config.passiveRumorIntervalMinutes, tickRateMs);
  let buildingsById = state.buildingsById;
  let changed = false;
  const feedInputs: ResolveRumorEventInput[] = [];

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupStripClubMetadata(getStripClubMetadata(building), state.root.tick);
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = {
        ...buildingsById,
        [building.id]: {
          ...building,
          metadata: withStripClubMetadata(building, metadata),
          version: building.version + 1
        }
      };
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
      continue;
    }
    const stats = resolveStripClubRumorStats({
      state,
      playerId: building.ownerPlayerId,
      config,
      vipActive: (metadata.vipLoungeExpiresAtTick ?? 0) > state.root.tick
    });
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      const rumor = generateStripClubRumor({
        state,
        playerId: building.ownerPlayerId,
        buildingId: building.id,
        config,
        seed: `${building.id}:passive-rumor-event:${state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      feedInputs.push(createPassiveBuildingRumorInput({
        state,
        building,
        source: "strip_club",
        rumor,
        severity: "medium",
        negative: ["relationships", "police", "laundering"].includes(rumor.type)
      }));
    }
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withStripClubMetadata(building, metadata),
        version: building.version + 1
      }
    };
    changed = true;
  }

  const metadataState = changed ? { ...state, buildingsById } : state;
  return feedInputs.length > 0
    ? applyResolvedRumorEventsToState(metadataState, feedInputs, { lobbyClubConfig, config: dayNightConfig })
    : metadataState;
};

export const getStripClubMetadata = (building: CoreGameState["buildingsById"][string]): StripClubMetadata => {
  const raw = isRecord(building.metadata?.stripClub) ? building.metadata.stripClub : {};
  return {
    vipLoungeExpiresAtTick: asOptionalTick(raw.vipLoungeExpiresAtTick),
    privatePartyExpiresAtTick: asOptionalTick(raw.privatePartyExpiresAtTick),
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : [],
    contacts: Array.isArray(raw.contacts) ? raw.contacts.filter(isRecord).map(normalizeContact).slice(-8) : [],
    scandalEvents: Array.isArray(raw.scandalEvents) ? raw.scandalEvents.filter(isRecord).slice(-8) : []
  };
};

const generateStripClubRumor = (input: {
  state: CoreGameState;
  playerId: string;
  buildingId: string;
  config: StripClubBalanceConfig;
  seed: string;
  forcedType?: string;
  forcedFalse?: boolean;
}): StripClubRumor => {
  const stats = resolveStripClubRumorStats({ state: input.state, playerId: input.playerId, config: input.config });
  const rawType = input.forcedType ?? input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
  const type = rawType === "traps" ? "fake" : rawType;
  const truthChancePct = stats.truthChancePct;
  const isTrue = input.forcedFalse === true ? false : deterministicRollPct(`${input.seed}:truth`) < truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const verifiedIntel = stats.verifiedIntelEligible && isTrue && deterministicRollPct(`${input.seed}:verified`) < 18;
  return {
    type,
    truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    probabilityVisible: stats.probabilityVisible,
    verifiedIntel,
    text: ""
  };
};

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
};

const pickBuildingHint = (state: CoreGameState, seed: string): string | null => {
  const buildings = Object.values(state.buildingsById).filter((building) => building.status === "active");
  return buildings.length > 0 ? buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null : null;
};

const resolveContact = (
  config: StripClubBalanceConfig,
  commandId: string,
  tick: number,
  tickRateMs: number
) => {
  const contact = config.contacts[Math.floor(deterministicRollPct(`${commandId}:contact-kind:${tick}`) / 100 * config.contacts.length)] ?? config.contacts[0];
  return {
    id: contact.id,
    label: contact.label,
    effectSummary: contact.effectSummary,
    expiresAtTick: contact.durationMinutes ? tick + minutesToTicks(contact.durationMinutes, tickRateMs) : null,
    gainedAtTick: tick
  };
};

const cleanupStripClubMetadata = (metadata: StripClubMetadata, tick: number): StripClubMetadata => ({
  ...metadata,
  vipLoungeExpiresAtTick: (metadata.vipLoungeExpiresAtTick ?? 0) > tick ? metadata.vipLoungeExpiresAtTick : undefined,
  privatePartyExpiresAtTick: (metadata.privatePartyExpiresAtTick ?? 0) > tick ? metadata.privatePartyExpiresAtTick : undefined,
  rumorEvents: metadata.rumorEvents.slice(-12),
  contacts: metadata.contacts.filter((contact) => contact.expiresAtTick === null || contact.expiresAtTick > tick).slice(-8),
  scandalEvents: metadata.scandalEvents.slice(-8)
});

const withStripClubMetadata = (
  building: CoreGameState["buildingsById"][string],
  stripClub: StripClubMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  stripClub
});

const normalizeRumor = (value: Record<string, unknown>): StripClubRumor => ({
  type: String(value.type || "fake"),
  truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
  isTrue: Boolean(value.isTrue),
  districtHint: value.districtHint ? String(value.districtHint) : null,
  buildingHint: value.buildingHint ? String(value.buildingHint) : null,
  probabilityVisible: Boolean(value.probabilityVisible),
  verifiedIntel: Boolean(value.verifiedIntel),
  text: String(value.text || "")
});

const normalizeContact = (value: Record<string, unknown>) => ({
  id: String(value.id || ""),
  label: String(value.label || ""),
  effectSummary: String(value.effectSummary || ""),
  expiresAtTick: value.expiresAtTick === null ? null : asOptionalTick(value.expiresAtTick) ?? null,
  gainedAtTick: Math.max(0, Math.floor(Number(value.gainedAtTick || 0)))
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));

const deterministicRollPct = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 100;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
