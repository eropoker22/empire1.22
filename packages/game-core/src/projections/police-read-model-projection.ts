import type {
  PendingRaid,
  PoliceConsequenceView,
  PoliceEvent,
  PoliceHeatBreakdownView,
  PolicePendingRaidView,
  PoliceReadModel as SharedPoliceReadModel
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveWantedLevel } from "../rules/police/wantedLevel";
import { calculatePlayerPolicePressure } from "../rules/police/policePressure";
import { resolveCityHallNetworkCover, resolveCityHallPoliceMitigation } from "../rules/police/cityHallPoliceMitigation";

export type PoliceRaidRisk = "none" | "watch" | "elevated" | "ready" | "pending";

export interface PoliceHeatSourceView {
  id: string;
  kind: "player" | "district";
  label: string;
  heat: number;
}

export interface PoliceReadModel extends SharedPoliceReadModel {
  projectedWantedLevel: number;
  districtHeat: number;
  totalHeat: number;
  raidPressure: number;
  raidThreshold: number;
  raidPending: boolean;
  raidRisk: PoliceRaidRisk;
  heatSources: PoliceHeatSourceView[];
}

export interface PoliceReadModelOptions {
  selectedDistrictId?: string | null;
}

/**
 * Responsibility: Creates a UI/API-safe police projection from authoritative state.
 * Belongs here: read-only heat aggregation, wanted projection, pressure, and raid lifecycle view.
 * Does not belong here: mutating heat, scheduling raids, or resolving raid outcomes.
 */
export const createPoliceReadModel = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext,
  options: PoliceReadModelOptions = {}
): PoliceReadModel => {
  const player = state.playersById[playerId] ?? null;
  const policeStateId = player?.policeStateId ?? null;
  const policeState = policeStateId ? state.policeStatesById[policeStateId] ?? null : null;
  const pressure = calculatePlayerPolicePressure(state, playerId, context);
  const playerHeat = sanitizeHeat(policeState?.heat);
  const districtSources = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .map((district) => ({
      id: district.id,
      kind: "district" as const,
      label: district.name || district.id,
      heat: sanitizeHeat(district.heat)
    }))
    .filter((source) => source.heat > 0);
  const heatSources = [
    ...(policeState
      ? [{
          id: policeState.id,
          kind: "player" as const,
          label: "Player police heat",
          heat: playerHeat
        }]
      : []),
    ...districtSources
  ].filter((source) => source.heat > 0);
  const districtHeat = districtSources.reduce((total, source) => total + source.heat, 0);
  const totalHeat = playerHeat + districtHeat;
  const projectedWantedLevel = resolveWantedLevel(playerHeat);
  const storedWantedLevel = sanitizeWantedLevel(policeState?.wantedLevel);
  const wantedLevel = Math.max(storedWantedLevel, projectedWantedLevel);
  const pendingRaid = toPendingRaidView(selectVisiblePendingRaid(policeState?.pendingRaids));
  const policeFeed = sanitizePoliceFeed(policeState?.policeEvents);
  const lastPoliceEvent = policeFeed[0] ?? null;
  const recentRaid = createRecentRaidInfo(policeFeed);
  const activeConsequences = createActiveConsequences(state, playerId);
  const raidPending = pendingRaid !== null;
  const courthouseMitigation = pendingRaid?.previewConsequences.courthouseMitigation ?? null;
  const projectedSeverity = pressure.aggregatePressure >= pressure.extremePressureRaidThreshold ? "extreme" : "high";
  const cityHallNetworkCover = resolveCityHallNetworkCover({
    state,
    context,
    playerId
  });
  const cityHallMitigation = resolveCityHallPoliceMitigation({
    state,
    context,
    playerId,
    targetDistrictId: pressure.hottestDistrictHeat >= (context?.config.balance.police?.districtTargetHeatThreshold ?? 60)
      ? pressure.hottestDistrictId
      : null,
    severity: projectedSeverity
  });
  const mitigations = [
    ...(cityHallMitigation || cityHallNetworkCover
      ? [{
        source: (cityHallMitigation ?? cityHallNetworkCover)!.source,
        label: cityHallMitigation
          ? `${cityHallMitigation.label} Snižuje šanci vytvoření zásahu.`
          : `${cityHallNetworkCover!.label} Raidy čistě z player heat bez cílového districtu zatím nekryje.`,
        districtId: cityHallMitigation?.districtId ?? null,
        coveredDistrictIds: cityHallMitigation?.coveredDistrictIds ?? cityHallNetworkCover!.coveredDistrictIds,
        effectiveReductionPct: cityHallMitigation?.effectiveReductionPct ?? 0,
        triggerChancePct: cityHallMitigation?.triggerChancePct
      }]
      : []),
    ...(courthouseMitigation
      ? [{
        source: "courthouse",
        label: "Soud nezabrání zásahu, ale může zmírnit následky.",
        districtId: pendingRaid?.targetDistrictId ?? null,
        effectiveReductionPct: courthouseMitigation.reductionPct
      }]
      : [])
  ];
  const heatBreakdown = createHeatBreakdown({
    wantedLabel: `${wantedLevel} / 5`,
    playerHeat,
    districtHeat,
    raidPressure: pressure.aggregatePressure
  });
  const raidPressureExplanation = "Raid pressure je celkový tlak policie: player heat plus vážený district heat z vlastněných districtů. District heat může přitáhnout raid i bez vysokého wanted levelu.";
  const selectedDistrictId = sanitizeDistrictId(options.selectedDistrictId);
  const selectedDistrict = selectedDistrictId ? state.districtsById[selectedDistrictId] ?? null : null;
  const protection = createProtectionView(mitigations);

  return {
    playerId,
    policeStateId,
    heat: playerHeat,
    playerHeat,
    ownedDistrictHeat: districtHeat,
    wantedLevel,
    wantedLevelLabel: `${wantedLevel} / 5`,
    wantedLabel: `${wantedLevel} / 5`,
    riskTier: raidPending && pressure.riskTier === "low" ? "high" : pressure.riskTier,
    aggregatePressure: pressure.aggregatePressure,
    playerHeatPressure: pressure.playerHeatPressure,
    districtHeatPressure: pressure.districtHeatPressure,
    hottestDistrictId: pressure.hottestDistrictId,
    hottestDistrictHeat: pressure.hottestDistrictHeat,
    selectedDistrictId,
    selectedDistrictHeat: selectedDistrict ? sanitizeHeat(selectedDistrict.heat) : 0,
    pendingRaid,
    activeRaid: pendingRaid
      ? {
          id: pendingRaid.id,
          type: "police-raid-pending",
          severity: pendingRaid.severity,
          status: pendingRaid.status,
          districtId: pendingRaid.targetDistrictId,
          tick: pendingRaid.triggerTick,
          message: pendingRaid.reason
        }
      : null,
    recentRaid,
    activeConsequences,
    raidConsequenceStatus: raidPending
      ? "pending"
      : activeConsequences.length > 0
        ? "active"
        : recentRaid
          ? "recent"
          : "none",
    lastPoliceEvent,
    policeFeed,
    mitigations,
    protection,
    recommendedAction: getRecommendedAction({
      riskTier: pressure.riskTier,
      raidPending,
      wantedLevel,
      playerHeat,
      playerHeatPressure: pressure.playerHeatPressure,
      districtHeat,
      districtHeatPressure: pressure.districtHeatPressure,
      aggregatePressure: pressure.aggregatePressure,
      cityHallMitigationActive: Boolean(cityHallNetworkCover),
      courthouseMitigationActive: Boolean(courthouseMitigation)
    }),
    updatedAtTick: state.root.tick,
    updatedAt: new Date(0).toISOString(),
    projectedWantedLevel,
    districtHeat,
    totalHeat,
    raidPressure: pressure.aggregatePressure,
    raidThreshold: pressure.highPressureRaidThreshold,
    raidPressureExplanation,
    heatBreakdown,
    raidPending,
    raidRisk: resolveRaidRisk(pressure.aggregatePressure, pressure.highPressureRaidThreshold, raidPending),
    heatSources
  };
};

const selectVisiblePendingRaid = (raids: PendingRaid[] | undefined): PendingRaid | null =>
  (raids ?? []).find((raid) => raid.status === "pending" || raid.status === "acknowledged") ?? null;

const toPendingRaidView = (raid: PendingRaid | null): PolicePendingRaidView | null =>
  raid
    ? {
        ...raid,
        id: raid.raidId,
        triggerTick: raid.createdAtTick,
        expiresAtTick: raid.expiresAtTick ?? null,
        targetDistrictId: raid.targetDistrictId ?? null
      }
    : null;

const sanitizePoliceFeed = (events: PoliceEvent[] | undefined): PoliceEvent[] =>
  (events ?? [])
    .filter((event): event is PoliceEvent => Boolean(event?.id && event.playerId))
    .slice(0, 8);

const sanitizeDistrictId = (value: unknown): string | null => {
  const districtId = String(value ?? "").trim();
  return districtId.length > 0 ? districtId : null;
};

const sanitizeHeat = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const sanitizeWantedLevel = (value: unknown): number =>
  Math.max(0, Math.min(5, Math.floor(Number(value || 0))));

const createRecentRaidInfo = (events: PoliceEvent[]): SharedPoliceReadModel["recentRaid"] => {
  const event = events.find((candidate) => String(candidate.type || "").includes("raid")) ?? null;
  if (!event) return null;
  return {
    id: String(event.payload?.raidId ?? event.id),
    type: event.type,
    severity: event.severity,
    status: event.type.includes("resolved")
      ? "resolved"
      : event.type.includes("expired")
        ? "expired"
        : "recent",
    districtId: event.districtId ?? null,
    tick: event.createdAtTick,
    message: event.message
  };
};

const createActiveConsequences = (
  state: CoreGameState,
  playerId: string
): PoliceConsequenceView[] => {
  const currentTick = state.root.tick;
  const districtConsequences = Object.values(state.districtsById)
    .filter((district) =>
      district.ownerPlayerId === playerId
      && district.status === "locked"
      && (!district.lockdownUntilTick || district.lockdownUntilTick > currentTick)
    )
    .map((district) => ({
      id: `police:consequence:district-lockdown:${district.id}`,
      type: "district-lockdown",
      severity: "high",
      districtId: district.id,
      expiresAtTick: district.lockdownUntilTick ?? null
    }));
  const buildingConsequences = Object.values(state.buildingsById)
    .filter((building) =>
      building.ownerPlayerId === playerId
      && building.status === "disabled"
      && (!building.disruptedUntilTick || building.disruptedUntilTick > currentTick)
    )
    .map((building) => ({
      id: `police:consequence:building-disruption:${building.id}`,
      type: "building-disruption",
      severity: "medium",
      districtId: building.districtId,
      expiresAtTick: building.disruptedUntilTick ?? null
    }));

  return [...districtConsequences, ...buildingConsequences];
};

const createProtectionView = (
  mitigations: SharedPoliceReadModel["mitigations"]
): SharedPoliceReadModel["protection"] => {
  const sources = (mitigations ?? []).map((mitigation) => mitigation.source);
  const strongestReductionPct = (mitigations ?? []).reduce(
    (max, mitigation) => Math.max(max, Math.max(0, Number(mitigation.effectiveReductionPct || 0))),
    0
  );

  return {
    raidConsequenceMultiplier: Math.max(0, Math.min(1, 1 - strongestReductionPct / 100)),
    sources: Array.from(new Set(sources))
  };
};

const resolveRaidRisk = (
  raidPressure: number,
  raidThreshold: number,
  raidPending: boolean
): PoliceRaidRisk => {
  if (raidPending) return "pending";
  if (raidPressure >= raidThreshold) return "ready";
  if (raidPressure >= raidThreshold * 0.75) return "elevated";
  return raidPressure > 0 ? "watch" : "none";
};

const createHeatBreakdown = (input: {
  wantedLabel: string;
  playerHeat: number;
  districtHeat: number;
  raidPressure: number;
}): PoliceHeatBreakdownView[] => [
  {
    key: "wantedLevel",
    label: "Wanted level",
    value: input.wantedLabel,
    description: "Osobní policejní stopa hráče. Počítá se z player heat, ne z district heat."
  },
  {
    key: "playerHeat",
    label: "Player heat",
    value: String(input.playerHeat),
    description: "Heat přímo na hráči z hlučných akcí, útoků a špinavých operací."
  },
  {
    key: "districtHeat",
    label: "District heat",
    value: String(input.districtHeat),
    description: "Součet heat ve vlastněných districtech. Může táhnout raid pressure nahoru i při nízkém wanted levelu."
  },
  {
    key: "raidPressure",
    label: "Raid pressure",
    value: String(input.raidPressure),
    description: "Celkový tlak policie, který rozhoduje o warningu a raidu."
  }
];

const getRecommendedAction = (input: {
  riskTier: SharedPoliceReadModel["riskTier"];
  raidPending: boolean;
  wantedLevel: number;
  playerHeat: number;
  playerHeatPressure: number;
  districtHeat: number;
  districtHeatPressure: number;
  aggregatePressure: number;
  cityHallMitigationActive: boolean;
  courthouseMitigationActive: boolean;
}): string => {
  const districtDominant = input.districtHeatPressure >= 60
    && input.districtHeatPressure >= input.playerHeatPressure * 1.25;
  const playerDominant = input.playerHeatPressure >= 60
    && input.playerHeatPressure >= input.districtHeatPressure * 1.25;
  const notes: string[] = [];

  let action: string;
  if (input.raidPending) {
    action = "Pending raid je aktivní. Přesuň dirty cash a počítej s následky zásahu.";
  } else if (districtDominant && input.wantedLevel <= 2) {
    action = "Tvůj wanted level je nízký, ale tvoje districty jsou příliš horké. Policie sleduje hlavně tvoje podniky, ne tebe osobně.";
  } else if (districtDominant) {
    action = "Raid pressure roste hlavně kvůli lokálnímu heat ve vlastněných districtech.";
  } else if (playerDominant) {
    action = "Tvoje osobní policejní stopa je horká. Omez útoky a hlučné akce, než z tebe bude snadný cíl.";
  } else {
    switch (input.riskTier) {
    case "extreme":
        action = "Raid pressure je extrémní. Okamžitě ztiš operace, jinak policie udeří.";
        break;
    case "high":
        action = "Raid pressure je vysoký. Zvaž pauzu v útocích a stáhni heat z horkých districtů.";
        break;
    case "medium":
        action = "Policejní tlak roste. Sniž hluk, drž dirty cash mimo ránu a sleduj district heat.";
        break;
    case "low":
    default:
        action = "Pokračuj opatrně. District heat může přitáhnout raid i bez vysokého wanted levelu.";
        break;
    }
  }

  if (input.cityHallMitigationActive) {
    notes.push("Magistrát tlumí šanci zásahu, ale extrémní tlak policii nezastaví.");
  }
  if (input.courthouseMitigationActive) {
    notes.push("Soud nezabrání zásahu, ale může zmírnit následky.");
  }

  return [action, ...notes].join(" ");
};
