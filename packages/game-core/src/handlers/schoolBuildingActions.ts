import type { FixedBuildingBalanceConfig, SchoolBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { applyFactionPopulationGeneration, getFactionPassiveModifiers } from "../rules/factions/factionRules";
import { deterministicUnitInterval } from "../utils/math";

export type SchoolTalentId =
  | "technician"
  | "informant"
  | "medic"
  | "negotiator"
  | "organizer"
  | "protector";

export interface SchoolMetadata {
  storedStudents: number;
  lastUpdatedTick?: number;
  lastCapacity?: number;
  wasFull?: boolean;
  eveningCourseExpiresAtTick?: number;
}

export interface SchoolNetworkMultipliers {
  populationProductionMultiplier: number;
  studentCapacityMultiplier: number;
  incomeMultiplier: number;
}

export interface SchoolActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: Record<string, number>;
  reportText: string;
  schoolResult: Record<string, unknown>;
}

const TALENT_LABELS: Record<SchoolTalentId, string> = {
  technician: "Technik",
  informant: "Informátor",
  medic: "Medik",
  negotiator: "Vyjednavač",
  organizer: "Organizátor",
  protector: "Ochránce"
};

const TALENT_SUMMARIES: Record<SchoolTalentId, string> = {
  technician: "Technik umí zrychlit výrobu ve Zbrojovce nebo Továrně.",
  informant: "Informátor přinesl slabý civilní drb z okolí Školy.",
  medic: "Medik zná levnější postup pro stabilizaci zraněných.",
  negotiator: "Vyjednavač umí vytěžit z města drobný vliv.",
  organizer: "Organizátor umí zkrátit logistické zdržení.",
  protector: "Ochránce umí krátce podržet obranu nejbližšího vlastního districtu."
};

export const getOwnedSchoolCount = (
  state: CoreGameState,
  playerId: string,
  config: SchoolBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveSchoolNetworkMultipliers = (
  count: number,
  config: SchoolBalanceConfig
): SchoolNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    populationProductionMultiplier: Math.min(
      config.network.maxPopulationProductionMultiplier,
      1 + extra * config.network.populationProductionBonusPctPerExtraSchool / 100
    ),
    studentCapacityMultiplier: Math.min(
      config.network.maxStudentCapacityMultiplier,
      1 + extra * config.network.studentCapacityBonusPctPerExtraSchool / 100
    ),
    incomeMultiplier: Math.min(
      config.network.maxIncomeMultiplier,
      1 + extra * config.network.incomeBonusPctPerExtraSchool / 100
    )
  };
};

export const getSchoolMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): SchoolMetadata => {
  const raw = isRecord(building.metadata?.school) ? building.metadata?.school : {};
  void tick;
  return {
    storedStudents: Math.max(0, Number(raw.storedStudents || 0)),
    lastUpdatedTick: asOptionalTick(raw.lastUpdatedTick),
    lastCapacity: asOptionalNumber(raw.lastCapacity),
    wasFull: Boolean(raw.wasFull),
    eveningCourseExpiresAtTick: asOptionalTick(raw.eveningCourseExpiresAtTick)
  };
};

export const isEveningCourseActive = (
  metadata: SchoolMetadata,
  tick: number
): boolean =>
  Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0)) > tick;

export const resolveSchoolEveningCourseApartmentProductionMultiplier = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: SchoolBalanceConfig;
  tick: number;
}): number => {
  if (!input.config || !input.playerId) {
    return 1;
  }

  const hasActiveEveningCourse = Object.values(input.state.buildingsById).some((building) => {
    if (
      building.buildingTypeId !== input.config?.buildingTypeId
      || building.ownerPlayerId !== input.playerId
      || building.status !== "active"
    ) {
      return false;
    }

    return isEveningCourseActive(getSchoolMetadata(building, input.tick), input.tick);
  });

  return hasActiveEveningCourse
    ? Math.max(1, Number(input.config.eveningCourse.populationProductionMultiplier || 1))
    : 1;
};

export const resolveSchoolTalentChancePct = (input: {
  ownedCount: number;
  config: SchoolBalanceConfig;
  eveningCourseActive?: boolean;
}): number => {
  const extra = Math.max(0, Math.floor(Number(input.ownedCount || 0)) - 1);
  const baseChance = Math.min(
    input.config.talentPool.maxChancePct,
    input.config.talentPool.baseChancePct + extra * input.config.talentPool.chancePctPerExtraSchool
  );
  return Math.min(
    100,
    baseChance + (input.eveningCourseActive ? input.config.talentPool.eveningCourseTalentChanceBonusPct : 0)
  );
};

export const applySchoolIncomeModifiers = (input: {
  config: SchoolBalanceConfig;
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
  const network = resolveSchoolNetworkMultipliers(
    getOwnedSchoolCount(input.state, input.building.ownerPlayerId, input.config),
    input.config
  );
  const metadata = getSchoolMetadata(input.building, input.tick);
  const courseMultiplier = isEveningCourseActive(metadata, input.tick)
    ? input.config.eveningCourse.cleanIncomeMultiplier
    : 1;
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * courseMultiplier,
    dirtyPerHour: 0,
    heatPerDay: 0,
    influencePerDay: input.influencePerDay,
    maxLevel: 1
  };
};

export const resolveSchoolCapacity = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: SchoolBalanceConfig;
}): number => {
  const ownedCount = input.building.ownerPlayerId
    ? getOwnedSchoolCount(input.state, input.building.ownerPlayerId, input.config)
    : 0;
  const network = resolveSchoolNetworkMultipliers(ownedCount, input.config);
  return Math.max(1, Math.floor(input.config.baseStudentCapacity * network.studentCapacityMultiplier + 1e-9));
};

export const applySchoolStudentProduction = (
  state: CoreGameState,
  config: SchoolBalanceConfig,
  tickRateMs: number,
  context?: GameCoreContext
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = getSchoolMetadata(building, state.root.tick);
    const lastTick = metadata.lastUpdatedTick ?? state.root.tick;
    const elapsedTicks = Math.max(0, state.root.tick - lastTick);
    const ownedCount = getOwnedSchoolCount(state, building.ownerPlayerId, config);
    const network = resolveSchoolNetworkMultipliers(ownedCount, config);
    const capacity = resolveSchoolCapacity({ state, building, config });
    const currentStored = Math.min(capacity, metadata.storedStudents);
    const eveningMultiplier = isEveningCourseActive(metadata, state.root.tick)
      ? config.eveningCourse.populationProductionMultiplier
      : 1;
    const baseGain = currentStored >= capacity
      ? 0
      : config.populationPerMinute
        * network.populationProductionMultiplier
        * eveningMultiplier
        * elapsedTicks
        * Math.max(1, tickRateMs)
        / 60000;
    const gain = context
      ? applyFactionPopulationGeneration(baseGain, getFactionPassiveModifiers(state, building.ownerPlayerId, context))
      : baseGain;
    const nextStored = Math.min(capacity, currentStored + gain);
    const nextMetadata: SchoolMetadata = {
      ...metadata,
      storedStudents: nextStored,
      lastUpdatedTick: state.root.tick,
      lastCapacity: capacity,
      wasFull: nextStored >= capacity
    };

    if (
      Math.abs(nextMetadata.storedStudents - metadata.storedStudents) <= Number.EPSILON
      && nextMetadata.lastUpdatedTick === metadata.lastUpdatedTick
      && nextMetadata.lastCapacity === metadata.lastCapacity
      && nextMetadata.wasFull === metadata.wasFull
    ) {
      continue;
    }

    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withSchoolMetadata(building, nextMetadata),
        version: building.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, buildingsById } : state;
};

export const resolveSchoolAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config: SchoolBalanceConfig;
  tickRateMs: number;
}): SchoolActionResolution | null => {
  const metadata = getSchoolMetadata(input.building, input.state.root.tick);
  if (input.actionId === input.config.collectStudents.actionId) {
    const collected = Math.max(0, Math.floor(metadata.storedStudents));
    const ownedCount = input.building.ownerPlayerId
      ? getOwnedSchoolCount(input.state, input.building.ownerPlayerId, input.config)
      : 0;
    const courseActive = isEveningCourseActive(metadata, input.state.root.tick);
    const talentChancePct = resolveSchoolTalentChancePct({
      ownedCount,
      config: input.config,
      eveningCourseActive: courseActive
    });
    const talent = rollSchoolTalent({
      state: input.state,
      building: input.building,
      config: input.config,
      chancePct: talentChancePct,
      eveningCourseActive: courseActive
    });
    const nextMetadata: SchoolMetadata = {
      ...metadata,
      storedStudents: 0,
      lastUpdatedTick: input.state.root.tick,
      wasFull: false
    };
    const talentText = talent
      ? `Uliční zpráva: ${talent.label}. ${talent.summary}`
      : `Talent nepadl (${talentChancePct} % šance).`;

    return {
      balances: input.balances,
      buildingMetadata: withSchoolMetadata(input.building, nextMetadata),
      heatGain: 0,
      influenceChange: 0,
      inputCost: {},
      outputGain: {
        population: collected
      },
      reportText: `Vybral jsi ${collected} obyvatel ze Školy. ${talentText}`,
      schoolResult: {
        type: "collect_students",
        collectedPopulation: collected,
        remainingStoredStudents: 0,
        talentChancePct,
        talent: talent
          ? {
              id: talent.talentId,
              label: talent.label,
              summary: talent.summary
            }
          : null,
        streetNews: talentText
      }
    };
  }

  if (input.actionId !== input.config.eveningCourse.actionId) {
    return null;
  }

  const durationTicks = Math.ceil(input.config.eveningCourse.durationMinutes * 60000 / Math.max(1, input.tickRateMs));
  const nextMetadata: SchoolMetadata = {
    ...metadata,
    eveningCourseExpiresAtTick: input.state.root.tick + durationTicks
  };

  return {
    balances: {
      ...input.balances,
      cash: Math.max(0, Number(input.balances.cash || 0) - input.config.eveningCourse.costCleanCash)
    },
    buildingMetadata: withSchoolMetadata(input.building, nextMetadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: { cash: input.config.eveningCourse.costCleanCash },
    outputGain: {},
    reportText: "Večerní kurz běží. Škola dočasně zvedá výrobu lidí v bytových blocích.",
    schoolResult: {
      type: "education_boost",
      expiresAtTick: nextMetadata.eveningCourseExpiresAtTick,
      talentChanceFlatBonusPct: input.config.eveningCourse.talentChanceFlatBonusPct,
      populationProductionMultiplier: input.config.eveningCourse.populationProductionMultiplier,
      cleanIncomeMultiplier: input.config.eveningCourse.cleanIncomeMultiplier
    }
  };
};

export const validateSchoolAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config?: SchoolBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getSchoolMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.collectStudents.actionId) {
    return metadata.storedStudents > 0 ? null : "school_no_students";
  }
  if (input.actionId !== config.eveningCourse.actionId) return null;
  if (isEveningCourseActive(metadata, input.state.root.tick)) return "school_evening_course_active";
  if (Math.max(0, Number(input.balances.cash || 0)) < config.eveningCourse.costCleanCash) {
    return "school_insufficient_clean_cash";
  }
  return null;
};

const rollSchoolTalent = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: SchoolBalanceConfig;
  chancePct: number;
  eveningCourseActive: boolean;
}): {
  talentId: SchoolTalentId;
  label: string;
  summary: string;
} | null => {
  const roll = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:school:talent:${input.building.id}:${input.state.root.tick}`);
  if (roll >= input.chancePct / 100) {
    return null;
  }
  const betterRoll = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:school:talent:quality:${input.building.id}:${input.state.root.tick}`);
  const betterTalent = input.eveningCourseActive && betterRoll < input.config.talentPool.betterTalentChanceBonusPct / 100;
  const pool: SchoolTalentId[] = betterTalent
    ? ["technician", "medic", "organizer", "protector", "negotiator", "informant"]
    : ["technician", "informant", "medic", "negotiator", "organizer", "protector"];
  const pick = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:school:talent:pick:${input.building.id}:${input.state.root.tick}`);
  const talentId = pool[Math.min(pool.length - 1, Math.floor(pick * pool.length))] ?? "informant";
  const label = TALENT_LABELS[talentId];
  const summary = TALENT_SUMMARIES[talentId];

  return { talentId, label, summary };
};

const withSchoolMetadata = (
  building: CoreGameState["buildingsById"][string],
  school: SchoolMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  school
});

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
