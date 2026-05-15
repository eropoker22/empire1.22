// Compatibility bridge for legacy static pages.
// Authoritative gameplay faction balance lives in packages/game-config/src/public/faction-definitions.ts.

const BASE_PREVIEW_START = Object.freeze({
  cleanMoney: 1500,
  dirtyMoney: 300
});

export const FACTION_WEAPON_PRESETS = Object.freeze({
  mafian: { pistol: 1 },
  kartel: { pistol: 1 },
  kult: { barricades: 1 },
  "tajna-organizace": { cameras: 1 },
  hackeri: { cameras: 1 },
  "motorkarsky-gang": { "baseball-bat": 2, pistol: 1 },
  "soukroma-armada": { pistol: 2, vest: 1, barricades: 1 },
  korporace: {}
});

export const FACTION_CATALOG = Object.freeze({
  mafian: createFactionCatalogEntry({
    id: "mafian",
    name: "Mafián",
    tagline: "Staré peníze, staré krytí.",
    description: "Stabilní ekonomika, výpalné a vliv na správných dveřích.",
    cashBonus: 250,
    dirtyBonus: 40,
    influence: 6,
    heat: 0,
    advantages: ["Clean income +10 %", "Heat gain -4 %", "Legální budovy drží tempo"],
    disadvantages: ["Slabší tech", "Slabší špehování"]
  }),
  kartel: createFactionCatalogEntry({
    id: "kartel",
    name: "Kartel",
    tagline: "Rychlá špína, rychlý problém.",
    description: "Dirty cash, drogy a pašování, které přitahují heat.",
    cashBonus: 100,
    dirtyBonus: 180,
    influence: 0,
    heat: 3,
    advantages: ["Dirty income +15 %", "Illegal production +10 %", "Rychlé cashflow"],
    disadvantages: ["Heat gain +8 %", "Větší policejní tlak"]
  }),
  kult: createFactionCatalogEntry({
    id: "kult",
    name: "Kult",
    tagline: "Víra je munice.",
    description: "Fanatismus, influence a tvrdé držení districtů.",
    cashBonus: 80,
    dirtyBonus: 60,
    influence: 14,
    heat: 0,
    advantages: ["Influence +15 %", "Defense +5 %", "Lepší držení území"],
    disadvantages: ["Clean income -5 %", "Pomalejší cash start"]
  }),
  "tajna-organizace": createFactionCatalogEntry({
    id: "tajna-organizace",
    name: "Tajná organizace",
    tagline: "Nevidíš je. To je pointa.",
    description: "Špehování, infiltrace a menší stopa v policejních systémech.",
    cashBonus: 150,
    dirtyBonus: 70,
    influence: 0,
    heat: 0,
    advantages: ["Spy +10 p. b.", "Heat gain -8 %", "Lepší informace"],
    disadvantages: ["Attack power -5 %", "Menší hrubá síla"]
  }),
  hackeri: createFactionCatalogEntry({
    id: "hackeri",
    name: "Hackeři",
    tagline: "Město je jen špatně zamčený terminál.",
    description: "Data, sabotage, market intel a asymetrická válka.",
    cashBonus: 120,
    dirtyBonus: 60,
    influence: 0,
    heat: 0,
    advantages: ["Tech production +10 %", "Spy/intel +8 p. b.", "Market výhoda"],
    disadvantages: ["Defense -5 %", "Slabší fyzická obrana"]
  }),
  "motorkarsky-gang": createFactionCatalogEntry({
    id: "motorkarsky-gang",
    name: "Motorkářský gang",
    tagline: "Rychle dovnitř. Rychle ven.",
    description: "Mobilita, early aggression a špinavé malé výhody.",
    cashBonus: 80,
    dirtyBonus: 140,
    influence: 0,
    heat: 2,
    advantages: ["Attack duration -8 %", "Dirty income +5 %", "Rychlé tempo"],
    disadvantages: ["Defense -5 %", "Horší dlouhá stabilita"]
  }),
  "soukroma-armada": createFactionCatalogEntry({
    id: "soukroma-armada",
    name: "Soukromá armáda",
    tagline: "Když diplomacie krvácí, přijde kontrakt.",
    description: "Combat, obrana, vybavení a tvrdé držení mapy.",
    cashBonus: 100,
    dirtyBonus: 50,
    influence: 0,
    heat: 3,
    advantages: ["Attack +5 %", "Defense +10 %", "Menší ztráty vybavení"],
    disadvantages: ["Heat gain +5 %", "Vyšší provozní tlak"]
  }),
  korporace: createFactionCatalogEntry({
    id: "korporace",
    name: "Korporace",
    tagline: "Legální zločin je pořád zločin.",
    description: "Finance, downtown páky a čisté cashflow s úsměvem v obleku.",
    cashBonus: 300,
    dirtyBonus: 0,
    influence: 5,
    heat: 0,
    advantages: ["Clean income +15 %", "Market fee -10 %", "Downtown finance synergy"],
    disadvantages: ["Dirty income -8 %", "Pomalejší early combat"]
  })
});

function createFactionCatalogEntry(input) {
  return Object.freeze({
    id: input.id,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    startingPackage: {
      cleanMoney: BASE_PREVIEW_START.cleanMoney + input.cashBonus,
      dirtyMoney: BASE_PREVIEW_START.dirtyMoney + input.dirtyBonus,
      influence: input.influence,
      heat: input.heat
    },
    advantages: input.advantages,
    disadvantages: input.disadvantages
  });
}
