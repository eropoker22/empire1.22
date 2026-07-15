import type {
  CityEventBalanceConfig,
  CityEventDefinitionConfig
} from "@empire/game-core/contracts/city-event-balance-config";
import catalog from "./free-mode-city-event-catalog.json";

const definitions = catalog as CityEventDefinitionConfig[];

export const freeModeCityEventConfig: CityEventBalanceConfig = {
  enabled: true,
  agents: {
    victor: {
      agentId: "victor",
      name: "Victor Grave Kadeř",
      typeLabel: "Noční kontakt",
      requiredInfluence: 0,
      offerCount: 3,
      refreshTimes: [
        { hour: 18, minute: 0 },
        { hour: 22, minute: 0 },
        { hour: 2, minute: 0 }
      ],
      availability: {
        opensAt: { hour: 18, minute: 0 },
        closesAt: { hour: 4, minute: 0 }
      }
    },
    leon: {
      agentId: "leon",
      name: "Leon Switch Varga",
      typeLabel: "Fixer a obchodník",
      requiredInfluence: 100,
      offerCount: 3,
      refreshTimes: [
        { hour: 10, minute: 0 },
        { hour: 22, minute: 0 }
      ]
    },
    nyra: {
      agentId: "nyra",
      name: "Nyra Vale",
      typeLabel: "Informační síť",
      requiredInfluence: 300,
      offerCount: 3,
      refreshTimes: [
        { hour: 6, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 22, minute: 0 }
      ],
      dossierSlot: {
        standardOfferCount: 2,
        rareEligibleHour: 22
      }
    }
  },
  definitions,
  difficultyBudgets: {
    easy: {
      maxReplacementValue: 1_200,
      successRateMin: 86,
      successRateMax: 94,
      durationMinutesMin: 10,
      durationMinutesMax: 14
    },
    medium: {
      maxReplacementValue: 2_200,
      successRateMin: 73,
      successRateMax: 85,
      durationMinutesMin: 15,
      durationMinutesMax: 21
    },
    hard: {
      maxReplacementValue: 4_000,
      successRateMin: 62,
      successRateMax: 72,
      durationMinutesMin: 22,
      durationMinutesMax: 30
    },
    rare: {
      maxReplacementValue: 12_000,
      successRateMin: 55,
      successRateMax: 65,
      durationMinutesMin: 25,
      durationMinutesMax: 35
    }
  },
  maxActiveRunsPerPlayer: 1,
  maxStrategicOffersPerCityDay: 1
};
