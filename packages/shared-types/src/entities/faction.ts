export const PLAYER_FACTION_IDS = [
  "mafian",
  "kartel",
  "kult",
  "tajna-organizace",
  "hackeri",
  "motorkarsky-gang",
  "soukroma-armada",
  "korporace"
] as const;

export type PlayerFactionId = (typeof PLAYER_FACTION_IDS)[number];

export interface FactionStartingPackage {
  cleanMoney: number;
  dirtyMoney: number;
  influence: number;
  heat: number;
  weapons: Record<string, number>;
  buildings: Record<string, number>;
  modifiers: Record<string, number>;
}

export interface FactionDefinition {
  id: PlayerFactionId;
  name: string;
  tagline: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  startingPackage: FactionStartingPackage;
}

export const PLAYER_FACTIONS: readonly FactionDefinition[] = [
  {
    id: "mafian",
    name: "Mafián",
    tagline: "Stará škola vydírání a vlivu",
    description: "Silný ekonomický start, tlak na ochranu a kontrolu lokálního trhu.",
    advantages: ["Vyšší čistý kapitál", "Lepší income z legálních krytí", "Nižší heat decay penalizace"],
    disadvantages: ["Pomalejší expanze do street výroby", "Slabší kyber obrana"],
    startingPackage: {
      cleanMoney: 140000,
      dirtyMoney: 60000,
      influence: 220,
      heat: 30,
      weapons: { pistol: 12, shotgun: 2 },
      buildings: { pharmacy: 1, factory: 1 },
      modifiers: { legalIncomeBoost: 0.12, heatDecayPenalty: -0.08 }
    }
  },
  {
    id: "kartel",
    name: "Kartel",
    tagline: "Výroba, logistika a tvrdé cashflow",
    description: "Rychlý dirty-money start a silný tlak na produkci a distribuci.",
    advantages: ["Vyšší špinavé peníze", "Levnější produkce", "Silnější drug lab start"],
    disadvantages: ["Vyšší základní heat", "Slabší alliance důvěra"],
    startingPackage: {
      cleanMoney: 70000,
      dirtyMoney: 135000,
      influence: 180,
      heat: 55,
      weapons: { pistol: 10, smg: 3 },
      buildings: { "drug-lab": 1, factory: 1 },
      modifiers: { productionCostReduction: 0.14, allianceTrustPenalty: -0.1 }
    }
  },
  {
    id: "kult",
    name: "Kult",
    tagline: "Fanatická disciplína a tichý nátlak",
    description: "Vyšší pasivní vliv a lepší kontrola efektů, ale slabší ekonomika.",
    advantages: ["Vyšší startovní vliv", "Silnější efektové bonusy", "Nižší upkeep členů"],
    disadvantages: ["Méně peněz", "Slabší palebná síla na startu"],
    startingPackage: {
      cleanMoney: 50000,
      dirtyMoney: 45000,
      influence: 320,
      heat: 20,
      weapons: { pistol: 8, melee: 18 },
      buildings: { pharmacy: 1 },
      modifiers: { influenceGainBoost: 0.18, memberUpkeepReduction: 0.12 }
    }
  },
  {
    id: "tajna-organizace",
    name: "Tajná organizace",
    tagline: "Skrytá síť kontaktů a infiltrace",
    description: "Silná infiltrace a nižší viditelnost, ale pomalejší otevřená produkce.",
    advantages: ["Nižší heat generace", "Silnější spy utility", "Lepší informační kontrola"],
    disadvantages: ["Méně veřejného vlivu", "Pomalejší industriální růst"],
    startingPackage: {
      cleanMoney: 80000,
      dirtyMoney: 70000,
      influence: 160,
      heat: 10,
      weapons: { pistol: 9, sniper: 1 },
      buildings: { armory: 1 },
      modifiers: { heatGenerationReduction: 0.16, spyPowerBoost: 0.14 }
    }
  },
  {
    id: "hackeri",
    name: "Hackeři",
    tagline: "Data, sabotáže a asymetrická válka",
    description: "Výborná kontrola informací a rychlý technologický start.",
    advantages: ["Silnější digitální utility", "Vyšší bonus na průzkum", "Rychlejší event reakce"],
    disadvantages: ["Slabší fyzická obrana", "Nižší startovní výzbroj"],
    startingPackage: {
      cleanMoney: 65000,
      dirtyMoney: 50000,
      influence: 240,
      heat: 18,
      weapons: { pistol: 6, emp: 2 },
      buildings: { factory: 1 },
      modifiers: { intelGainBoost: 0.2, physicalDefensePenalty: -0.1 }
    }
  },
  {
    id: "motorkarsky-gang",
    name: "Motorkářský gang",
    tagline: "Mobilita, nájezdy a rychlý tlak",
    description: "Agresivní start s dobrým raid tlakem a mobilitou.",
    advantages: ["Vyšší raid tempo", "Lepší mobilita", "Silný early combat"],
    disadvantages: ["Horší ekonomická stabilita", "Vyšší ztráty při delším konfliktu"],
    startingPackage: {
      cleanMoney: 60000,
      dirtyMoney: 80000,
      influence: 140,
      heat: 45,
      weapons: { pistol: 14, shotgun: 4, molotov: 6 },
      buildings: { armory: 1 },
      modifiers: { raidPowerBoost: 0.14, upkeepPenalty: 0.08 }
    }
  },
  {
    id: "soukroma-armada",
    name: "Soukromá armáda",
    tagline: "Disciplína, výzbroj a tvrdá kontrola",
    description: "Nejlepší bojový start a obrana, vykoupené vyšší cenou a heatem.",
    advantages: ["Silná výzbroj", "Vyšší obrana districtů", "Lepší raid protection"],
    disadvantages: ["Vysoký upkeep", "Vyšší viditelnost pro policii"],
    startingPackage: {
      cleanMoney: 90000,
      dirtyMoney: 50000,
      influence: 170,
      heat: 60,
      weapons: { pistol: 16, rifle: 6, armor: 4 },
      buildings: { armory: 1, factory: 1 },
      modifiers: { defenseBoost: 0.16, upkeepPenalty: 0.14 }
    }
  },
  {
    id: "korporace",
    name: "Korporace",
    tagline: "Kapitál, legal cover a měkká moc",
    description: "Stabilní ekonomika a silné krytí, ale pomalejší underground expanze.",
    advantages: ["Nejvyšší čistý cash start", "Silné legální krytí", "Vyšší diplomacy bias"],
    disadvantages: ["Slabší dirty pipeline", "Pomalejší bojový náběh"],
    startingPackage: {
      cleanMoney: 180000,
      dirtyMoney: 25000,
      influence: 260,
      heat: 12,
      weapons: { pistol: 8, security: 6 },
      buildings: { pharmacy: 1, factory: 1 },
      modifiers: { legalIncomeBoost: 0.18, combatRampPenalty: -0.12 }
    }
  }
] as const;

export const getPlayerFactionDefinition = (
  factionId: PlayerFactionId
): FactionDefinition | undefined => PLAYER_FACTIONS.find((faction) => faction.id === factionId);
