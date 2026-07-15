import type {
  PendingRaid,
  PoliceConsequenceView,
  PoliceEvent,
  PoliceHeatBreakdownView,
  PolicePendingRaidView,
  PoliceReadModel as SharedPoliceReadModel
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export type PoliceRaidRisk = "none" | "watch" | "elevated" | "ready" | "pending";

export const selectVisiblePendingRaid = (raids: PendingRaid[] | undefined): PendingRaid | null =>
  (raids ?? []).find((raid) => raid.status === "pending" || raid.status === "acknowledged") ?? null;

export const toPendingRaidView = (
  raid: PendingRaid | null,
  currentTick = 0,
  tickRateMs = 0,
  nowMs = 0
): PolicePendingRaidView | null =>
  raid
    ? {
        ...raid,
        id: raid.raidId,
        triggerTick: raid.createdAtTick,
        expiresAtTick: raid.expiresAtTick ?? null,
        targetDistrictId: raid.targetDistrictId ?? null,
        remainingTicks: Math.max(0, Number(raid.expiresAtTick ?? currentTick) - currentTick),
        remainingMs: Math.max(0, Number(raid.expiresAtTick ?? currentTick) - currentTick) * Math.max(0, tickRateMs),
        expiresAtMs: raid.expiresAtTick === null || raid.expiresAtTick === undefined
          ? null
          : nowMs + Math.max(0, Number(raid.expiresAtTick) - currentTick) * Math.max(0, tickRateMs)
      }
    : null;

export const sanitizePoliceFeed = (events: PoliceEvent[] | undefined): PoliceEvent[] =>
  (events ?? [])
    .filter((event): event is PoliceEvent => Boolean(event?.id && event.playerId))
    .slice(0, 8);

export const sanitizeDistrictId = (value: unknown): string | null => {
  const districtId = String(value ?? "").trim();
  return districtId.length > 0 ? districtId : null;
};

export const sanitizeHeat = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export const sanitizeWantedLevel = (value: unknown): number =>
  Math.max(0, Math.min(5, Math.floor(Number(value || 0))));

export const createRecentRaidInfo = (events: PoliceEvent[]): SharedPoliceReadModel["recentRaid"] => {
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

export const createActiveConsequences = (
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

export const createProtectionView = (
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

export const resolveRaidRisk = (
  raidPressure: number,
  raidThreshold: number,
  raidPending: boolean
): PoliceRaidRisk => {
  if (raidPending) return "pending";
  if (raidPressure >= raidThreshold) return "ready";
  if (raidPressure >= raidThreshold * 0.75) return "elevated";
  return raidPressure > 0 ? "watch" : "none";
};

export const createHeatBreakdown = (input: {
  wantedLabel: string;
  playerHeat: number;
  districtHeat: number;
  raidPressure: number;
}): PoliceHeatBreakdownView[] => [
  {
    key: "wantedLevel",
    label: "Hledanost",
    value: input.wantedLabel,
    description: "Osobní policejní stopa hráče. Počítá se z heat hráče, ne z heat districtů."
  },
  {
    key: "playerHeat",
    label: "Heat hráče",
    value: String(input.playerHeat),
    description: "Heat přímo na hráči z hlučných akcí, útoků a špinavých operací."
  },
  {
    key: "districtHeat",
    label: "Heat districtů",
    value: String(input.districtHeat),
    description: "Součet heat ve vlastněných districtech. Může táhnout tlak raidu nahoru i při nízké hledanosti."
  },
  {
    key: "raidPressure",
    label: "Tlak raidu",
    value: String(input.raidPressure),
    description: "Celkový tlak policie, který rozhoduje o warningu a raidu."
  }
];

export const getRecommendedAction = (input: {
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
    action = "Připravená razie je aktivní. Přesuň dirty cash a počítej s následky zásahu.";
  } else if (districtDominant && input.wantedLevel <= 2) {
    action = "Tvoje hledanost je nízká, ale tvoje districty jsou příliš horké. Policie sleduje hlavně tvoje podniky, ne tebe osobně.";
  } else if (districtDominant) {
    action = "Tlak raidu roste hlavně kvůli lokálnímu heat ve vlastněných districtech.";
  } else if (playerDominant) {
    action = "Tvoje osobní policejní stopa je horká. Omez útoky a hlučné akce, než z tebe bude snadný cíl.";
  } else {
    action = getPressureTierAction(input.riskTier);
  }

  if (input.cityHallMitigationActive) {
    notes.push("Magistrát tlumí šanci zásahu, ale extrémní tlak policii nezastaví.");
  }
  if (input.courthouseMitigationActive) {
    notes.push("Soud nezabrání zásahu, ale může zmírnit následky.");
  }

  return [action, ...notes].join(" ");
};

const getPressureTierAction = (riskTier: SharedPoliceReadModel["riskTier"]): string => {
  switch (riskTier) {
    case "extreme":
      return "Tlak raidu je extrémní. Okamžitě ztiš operace, jinak policie udeří.";
    case "high":
      return "Tlak raidu je vysoký. Zvaž pauzu v útocích a stáhni heat z horkých districtů.";
    case "medium":
      return "Policejní tlak roste. Sniž hluk, drž dirty cash mimo ránu a sleduj district heat.";
    case "low":
    default:
      return "Pokračuj opatrně. Heat districtů může přitáhnout raid i bez vysoké hledanosti.";
  }
};
