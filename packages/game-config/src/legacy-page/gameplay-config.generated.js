// GENERATED FILE. Run `npm run generate:browser-config`; do not edit balance values here.
// Sources: free-mode-pharmacy-config.ts, free-mode-drug-lab-config.ts, free-mode-factory-config.ts, free-mode-armory-config.ts, free-mode-player-boost-config.ts, free-mode-city-event-config.ts, free-mode-warehouse-config.ts, free-mode-attack-weapons-config.ts, free-mode-street-dealers-config.ts, free-mode-smuggling-tunnel-config.ts, free-mode-convenience-store-config.ts, free-mode-strip-club-config.ts, day-night-action-rules.ts, market-config.ts.
export const BROWSER_GAMEPLAY_CONFIG = Object.freeze({
  "generatedFrom": [
    "free-mode-pharmacy-config.ts",
    "free-mode-drug-lab-config.ts",
    "free-mode-factory-config.ts",
    "free-mode-armory-config.ts",
    "free-mode-player-boost-config.ts",
    "free-mode-city-event-config.ts",
    "free-mode-warehouse-config.ts",
    "free-mode-attack-weapons-config.ts",
    "free-mode-street-dealers-config.ts",
    "free-mode-smuggling-tunnel-config.ts",
    "free-mode-convenience-store-config.ts",
    "free-mode-strip-club-config.ts",
    "day-night-action-rules.ts",
    "market-config.ts"
  ],
  "pharmacyRecipes": {
    "chemicals": {
      "name": "Chemicals",
      "inputs": {},
      "cleanMoneyCost": 360,
      "output": {
        "inventory": "materials",
        "itemId": "chemicals",
        "amount": 1
      },
      "durationMs": 120000,
      "localOutputCap": 12,
      "queueCap": 15
    },
    "biomass": {
      "name": "Biomass",
      "inputs": {},
      "cleanMoneyCost": 420,
      "output": {
        "inventory": "materials",
        "itemId": "biomass",
        "amount": 1
      },
      "durationMs": 240000,
      "localOutputCap": 8,
      "queueCap": 11
    },
    "stim-pack": {
      "name": "Stim Pack",
      "inputs": {},
      "cleanMoneyCost": 800,
      "output": {
        "inventory": "materials",
        "itemId": "stim-pack",
        "amount": 1
      },
      "durationMs": 600000,
      "localOutputCap": 4,
      "queueCap": 7
    }
  },
  "drugLabRecipes": {
    "neon-dust": {
      "name": "Neon Dust",
      "inputs": {
        "chemicals": 2
      },
      "cleanMoneyCost": 500,
      "output": {
        "inventory": "drugs",
        "itemId": "neon-dust",
        "amount": 1
      },
      "durationMs": 300000,
      "localOutputCap": 10,
      "queueCap": 13
    },
    "pulse-shot": {
      "name": "Pulse Shot",
      "inputs": {
        "chemicals": 2,
        "biomass": 1
      },
      "cleanMoneyCost": 800,
      "output": {
        "inventory": "drugs",
        "itemId": "pulse-shot",
        "amount": 1
      },
      "durationMs": 480000,
      "localOutputCap": 6,
      "queueCap": 9
    },
    "velvet-smoke": {
      "name": "Velvet Smoke",
      "inputs": {
        "chemicals": 1,
        "biomass": 2
      },
      "cleanMoneyCost": 900,
      "output": {
        "inventory": "drugs",
        "itemId": "velvet-smoke",
        "amount": 1
      },
      "durationMs": 900000,
      "localOutputCap": 5,
      "queueCap": 8
    },
    "ghost-serum": {
      "name": "Ghost Serum",
      "inputs": {
        "neon-dust": 2,
        "pulse-shot": 1
      },
      "cleanMoneyCost": 2500,
      "output": {
        "inventory": "drugs",
        "itemId": "ghost-serum",
        "amount": 1
      },
      "durationMs": 1200000,
      "localOutputCap": 2,
      "queueCap": 5
    },
    "overdrive-x": {
      "name": "Overdrive X",
      "inputs": {
        "pulse-shot": 1,
        "velvet-smoke": 2
      },
      "cleanMoneyCost": 4500,
      "output": {
        "inventory": "drugs",
        "itemId": "overdrive-x",
        "amount": 1
      },
      "durationMs": 1800000,
      "localOutputCap": 1,
      "queueCap": 4
    }
  },
  "armoryRecipes": {
    "baseball-bat": {
      "name": "Baseballová pálka",
      "inputs": {
        "metal-parts": 2
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "baseball-bat",
        "amount": 1
      },
      "durationMs": 180000,
      "localOutputCap": 8,
      "queueCap": 11
    },
    "pistol": {
      "name": "Pistole",
      "inputs": {
        "metal-parts": 3,
        "tech-core": 1
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "pistol",
        "amount": 1
      },
      "durationMs": 300000,
      "localOutputCap": 5,
      "queueCap": 8
    },
    "grenade": {
      "name": "Granát",
      "inputs": {
        "metal-parts": 2,
        "tech-core": 1
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "grenade",
        "amount": 1
      },
      "durationMs": 360000,
      "localOutputCap": 4,
      "queueCap": 7
    },
    "smg": {
      "name": "SMG",
      "inputs": {
        "metal-parts": 2,
        "combat-module": 1
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "smg",
        "amount": 1
      },
      "durationMs": 480000,
      "localOutputCap": 3,
      "queueCap": 6
    },
    "bazooka": {
      "name": "Bazuka",
      "inputs": {
        "metal-parts": 3,
        "combat-module": 2
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "bazooka",
        "amount": 1
      },
      "durationMs": 840000,
      "localOutputCap": 2,
      "queueCap": 5
    },
    "vest": {
      "name": "Vesta",
      "inputs": {
        "metal-parts": 3,
        "tech-core": 1
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "vest",
        "amount": 1
      },
      "durationMs": 300000,
      "localOutputCap": 5,
      "queueCap": 8
    },
    "barricades": {
      "name": "Barikády",
      "inputs": {
        "metal-parts": 4
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "barricades",
        "amount": 1
      },
      "durationMs": 300000,
      "localOutputCap": 6,
      "queueCap": 9
    },
    "cameras": {
      "name": "Kamery",
      "inputs": {
        "metal-parts": 2,
        "tech-core": 2
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "cameras",
        "amount": 1
      },
      "durationMs": 360000,
      "localOutputCap": 4,
      "queueCap": 7
    },
    "defense-tower": {
      "name": "Obranná věž",
      "inputs": {
        "tech-core": 3,
        "combat-module": 2
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "defense-tower",
        "amount": 1
      },
      "durationMs": 900000,
      "localOutputCap": 2,
      "queueCap": 5
    },
    "alarm": {
      "name": "Alarm",
      "inputs": {
        "metal-parts": 2,
        "tech-core": 1
      },
      "cleanMoneyCost": 0,
      "output": {
        "inventory": "weapons",
        "itemId": "alarm",
        "amount": 1
      },
      "durationMs": 300000,
      "localOutputCap": 4,
      "queueCap": 7
    }
  },
  "playerBoosts": {
    "ghost-network": {
      "boostId": "ghost-network",
      "label": "Ghost Network",
      "category": "intel",
      "description": "Prožeň špiony neviditelnou sítí a vytáhni z districtu víc informací.",
      "shortEffect": "Špionáž −35 % času · rozšířený intel",
      "cleanCashCost": 5000,
      "inputCosts": {
        "ghost-serum": 2,
        "pulse-shot": 2
      },
      "activeDurationTicks": 144,
      "cooldownTicks": 420,
      "consumptionMode": "timed",
      "effect": {
        "spyDurationMultiplier": 0.65,
        "criticalFailureChanceMultiplier": 0.75,
        "extraIntelBlocksOnSuccess": 1
      },
      "uiAccent": "cyan",
      "iconKey": "signal-eye",
      "durationMs": 720000,
      "cooldownMs": 2100000
    },
    "industrial-overdrive": {
      "boostId": "industrial-overdrive",
      "label": "Industrial Overdrive",
      "category": "production",
      "description": "Přetěž výrobní síť a vytlač z každé linky vyšší tempo.",
      "shortEffect": "Všechny výrobní linky +25 % rychlosti",
      "cleanCashCost": 7500,
      "inputCosts": {
        "overdrive-x": 2,
        "combat-module": 2
      },
      "activeDurationTicks": 144,
      "cooldownTicks": 540,
      "consumptionMode": "timed",
      "effect": {
        "productionSpeedMultiplier": 1.25
      },
      "uiAccent": "amber",
      "iconKey": "industrial-gear",
      "durationMs": 720000,
      "cooldownMs": 2700000
    },
    "tactical-grid": {
      "boostId": "tactical-grid",
      "label": "Tactical Grid",
      "category": "combat",
      "description": "Propoj výzbroj, obranu a intel do jediné taktické sítě.",
      "shortEffect": "+12 % k příštímu útoku nebo obraně",
      "cleanCashCost": 10000,
      "inputCosts": {
        "ghost-serum": 2,
        "overdrive-x": 1,
        "combat-module": 3
      },
      "activeDurationTicks": 240,
      "cooldownTicks": 720,
      "consumptionMode": "next-valid-pvp-combat",
      "effect": {
        "combatPowerMultiplier": 1.12
      },
      "uiAccent": "red",
      "iconKey": "tactical-grid",
      "durationMs": 1200000,
      "cooldownMs": 3600000
    }
  },
  "cityEvents": {
    "agents": {
      "victor": {
        "agentId": "victor",
        "name": "Victor Grave Kadeř",
        "typeLabel": "Noční kontakt",
        "requiredInfluence": 0,
        "offerCount": 3,
        "refreshTimes": [
          {
            "hour": 18,
            "minute": 0
          },
          {
            "hour": 22,
            "minute": 0
          },
          {
            "hour": 2,
            "minute": 0
          }
        ],
        "availability": {
          "opensAt": {
            "hour": 18,
            "minute": 0
          },
          "closesAt": {
            "hour": 4,
            "minute": 0
          }
        }
      },
      "leon": {
        "agentId": "leon",
        "name": "Leon Switch Varga",
        "typeLabel": "Fixer a obchodník",
        "requiredInfluence": 100,
        "offerCount": 3,
        "refreshTimes": [
          {
            "hour": 10,
            "minute": 0
          },
          {
            "hour": 22,
            "minute": 0
          }
        ]
      },
      "nyra": {
        "agentId": "nyra",
        "name": "Nyra Vale",
        "typeLabel": "Informační síť",
        "requiredInfluence": 300,
        "offerCount": 3,
        "refreshTimes": [
          {
            "hour": 6,
            "minute": 0
          },
          {
            "hour": 14,
            "minute": 0
          },
          {
            "hour": 22,
            "minute": 0
          }
        ],
        "dossierSlot": {
          "standardOfferCount": 2,
          "rareEligibleHour": 22
        }
      }
    },
    "difficultyBudgets": {
      "easy": {
        "maxReplacementValue": 1200,
        "successRateMin": 86,
        "successRateMax": 94,
        "durationMinutesMin": 10,
        "durationMinutesMax": 14
      },
      "medium": {
        "maxReplacementValue": 2200,
        "successRateMin": 73,
        "successRateMax": 85,
        "durationMinutesMin": 15,
        "durationMinutesMax": 21
      },
      "hard": {
        "maxReplacementValue": 4000,
        "successRateMin": 62,
        "successRateMax": 72,
        "durationMinutesMin": 22,
        "durationMinutesMax": 30
      },
      "rare": {
        "maxReplacementValue": 12000,
        "successRateMin": 55,
        "successRateMax": 65,
        "durationMinutesMin": 25,
        "durationMinutesMax": 35
      }
    },
    "maxActiveRunsPerPlayer": 1,
    "maxStrategicOffersPerCityDay": 1,
    "tickRateMs": 5000,
    "definitions": [
      {
        "id": "victor_01",
        "agentId": "victor",
        "title": "Rozbitá dodávka",
        "description": "Jedna dodávka zůstala viset v cizím bloku. Dojeď tam, seber bedny a zmiz dřív, než si toho někdo všimne.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 5,
          "cash": 700,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_02",
        "agentId": "victor",
        "title": "Tvrdé vyjednávání",
        "description": "Jeden obchodník zapomněl, komu má platit. Připomeň mu to po mém.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 21,
        "reward": {
          "cash": 1400,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_03",
        "agentId": "victor",
        "title": "Sklad bez majitele",
        "description": "Ve skladu leží materiál a nikdo ho zrovna nehlídá dost dobře. Udělej to rychle.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 20,
        "reward": {
          "metal-parts": 4,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1200000,
        "durationTicks": 240
      },
      {
        "id": "victor_04",
        "agentId": "victor",
        "title": "Noční výběr",
        "description": "Po zavíračce bývá město měkký. Vytáhni z toho maximum, než se vzpamatuje.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 21,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_05",
        "agentId": "victor",
        "title": "Převoz pod tlakem",
        "description": "Materiál musí projít přes horkou zónu. Když to zvládneš, lidi si tě začnou pamatovat.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 21,
        "reward": {
          "cash": 900,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_06",
        "agentId": "victor",
        "title": "Rozkopané dveře",
        "description": "Za těma dveřma je schovaná zásoba. Otevři je po svém, já se ptát nebudu.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 3,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_07",
        "agentId": "victor",
        "title": "Tichá lekce",
        "description": "Jeden malej hráč moc mluví. Nemusí zmizet, stačí aby začal šeptat.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_08",
        "agentId": "victor",
        "title": "Neonový kufr",
        "description": "Na rohu čeká kufr, kterej nemá dlouho zůstat bez majitele. Buď rychlej.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 16,
        "reward": {
          "cash": 600,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_09",
        "agentId": "victor",
        "title": "Smrad z lékárny",
        "description": "Z jedný lékárny odtéká víc chemie, než je zdravý. Jdi po tom.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_10",
        "agentId": "victor",
        "title": "Ochlazení konkurence",
        "description": "Někdo vedle nás roste moc rychle. Ukaž mu, že asfalt má vždycky poslední slovo.",
        "difficulty": "hard",
        "successRate": 70,
        "durationMinutes": 28,
        "reward": {
          "influence": 7,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1680000,
        "durationTicks": 336
      },
      {
        "id": "victor_11",
        "agentId": "victor",
        "title": "Pouliční test loajality",
        "description": "Ne každej pod tlakem drží hubu. Ověř, kdo je pevnej a kdo je hadr.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "influence": 3,
          "cash": 750
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "victor_12",
        "agentId": "victor",
        "title": "Dvě minuty po půlnoci",
        "description": "V noci mizí kamery, svědci i zábrany. Přesně proto jdeme teď.",
        "difficulty": "hard",
        "successRate": 68,
        "durationMinutes": 26,
        "reward": {
          "metal-parts": 2,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1560000,
        "durationTicks": 312
      },
      {
        "id": "victor_13",
        "agentId": "victor",
        "title": "Balík pro špatnou adresu",
        "description": "Někdo čeká zásilku. Jen škoda, že ji čeká marně.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 18,
        "reward": {
          "cash": 850,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_14",
        "agentId": "victor",
        "title": "Krev na parkovišti",
        "description": "Na parkovišti se má uzavřít obchod. Udělej z toho náš obchod.",
        "difficulty": "hard",
        "successRate": 66,
        "durationMinutes": 27,
        "reward": {
          "dirty-cash": 2000,
          "metal-parts": 2
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1620000,
        "durationTicks": 324
      },
      {
        "id": "victor_15",
        "agentId": "victor",
        "title": "Kdo stojí, ten bere",
        "description": "Některý rajóny patří těm, co v nich vydrží stát nejdýl. Dneska tam budeš stát ty.",
        "difficulty": "hard",
        "successRate": 72,
        "durationMinutes": 30,
        "reward": {
          "influence": 8,
          "cash": 1000
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1800000,
        "durationTicks": 360
      },
      {
        "id": "victor_16",
        "agentId": "victor",
        "title": "Rozebraná zbrojnice",
        "description": "Mám tip na rozebranou dílnu. Posbírej všechno, co ještě střílí nebo se dá prodat.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 21,
        "reward": {
          "metal-parts": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_17",
        "agentId": "victor",
        "title": "Uražená hrdost",
        "description": "Jeden blbec se chtěl zviditelnit na cizím jménu. Teď mu vysvětli, že to byl drahej nápad.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 21,
        "reward": {
          "influence": 6,
          "dirty-cash": 1100
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_18",
        "agentId": "victor",
        "title": "Pád z nákladní rampy",
        "description": "Na rampě stojí zboží, co má změnit majitele. Vezmi ho a nic neřeš.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 6,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_19",
        "agentId": "victor",
        "title": "Hlasitý vzkaz",
        "description": "Někdy nestačí někoho okrást. Někdy musí celej blok vědět, kdo to udělal.",
        "difficulty": "hard",
        "successRate": 64,
        "durationMinutes": 24,
        "reward": {
          "influence": 8,
          "cash": 900
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1440000,
        "durationTicks": 288
      },
      {
        "id": "victor_20",
        "agentId": "victor",
        "title": "Mokrý prachy",
        "description": "U vody čeká malej přesun peněz. Když se zdržíš, někdo jiný si namočí ruce místo tebe.",
        "difficulty": "hard",
        "successRate": 71,
        "durationMinutes": 22,
        "reward": {
          "dirty-cash": 2200,
          "influence": 2
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_21",
        "agentId": "victor",
        "title": "Starý dluh, nová bolest",
        "description": "Starej dluh se dnes zavře. Otázka je jen, jestli penězma nebo zubama.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 20,
        "reward": {
          "cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1200000,
        "durationTicks": 240
      },
      {
        "id": "victor_22",
        "agentId": "victor",
        "title": "Kontejner číslo 9",
        "description": "V kontejneru číslo 9 leží věci, co nemají vidět ráno. Otevři ho dřív než ostatní.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 3,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_23",
        "agentId": "victor",
        "title": "Měkký cíl",
        "description": "Slabej článek řetězu bývá nejlevnější cesta dovnitř. Využij to.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_24",
        "agentId": "victor",
        "title": "Velvet Smoke v kufru",
        "description": "V kufru čeká pár balení Velvet Smoke. Převezmi to, než se z toho stane cizí zisk.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "cash": 500,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_25",
        "agentId": "victor",
        "title": "Křik v zadní uličce",
        "description": "Zadní uličky jsou moje kancelář. Dneska tam někomu zrušíš pracovní poměr.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 19,
        "reward": {
          "dirty-cash": 1200,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_26",
        "agentId": "victor",
        "title": "Rychlý výkup",
        "description": "Jeden zoufalec prodává materiál hluboko pod cenou. Seber to všechno, než dostane rozum.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "victor_27",
        "agentId": "victor",
        "title": "Tlak na rohu",
        "description": "Na jednom rohu se rozdává respekt zadarmo. To je chyba, kterou dnes opravíš.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_28",
        "agentId": "victor",
        "title": "Spadlá bedna",
        "description": "Někde spadla bedna z transportu. Kdo ji najde první, ten určuje pravidla.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 15,
        "reward": {
          "metal-parts": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_29",
        "agentId": "victor",
        "title": "Přepálená dávka",
        "description": "Někdo vaří moc nahlas a moc blízko. Vlez tam, seber vzorek a zbytek nech rozpadnout.",
        "difficulty": "hard",
        "successRate": 69,
        "durationMinutes": 23,
        "reward": {
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1380000,
        "durationTicks": 276
      },
      {
        "id": "victor_30",
        "agentId": "victor",
        "title": "Drobní, ale naši",
        "description": "Malí dealeři se začínají dívat jinam. Připomeň jim, kde končí každá ulice.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 20,
        "reward": {
          "cash": 1300,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1200000,
        "durationTicks": 240
      },
      {
        "id": "victor_31",
        "agentId": "victor",
        "title": "Tichá zbroj",
        "description": "Mám kontakt na vybavení, co nechodí přes papíry. Vyber to a neotáčej se.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_32",
        "agentId": "victor",
        "title": "Vyděšený účetní",
        "description": "Jeden účetní ví, kam tečou peníze. A dneska bude chtít mluvit rychle.",
        "difficulty": "hard",
        "successRate": 72,
        "durationMinutes": 22,
        "reward": {
          "dirty-cash": 1700,
          "influence": 6
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_33",
        "agentId": "victor",
        "title": "První rána zdarma",
        "description": "Dneska nejde o kořist. Dneska jde o to, kdo dá první ránu a kdo si ji zapamatuje.",
        "difficulty": "hard",
        "successRate": 67,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "cash": 600
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_34",
        "agentId": "victor",
        "title": "Rozbitý automat",
        "description": "Někdo schovává peníze tam, kde si myslí, že vypadají nevinně. Rozbij to a vezmi obsah.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "cash": 1200,
          "dirty-cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_35",
        "agentId": "victor",
        "title": "Krátká návštěva v docku",
        "description": "V doku kotví něco, co tam nemá vydržet do rána. Přesuneme to dřív.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 21,
        "reward": {
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_36",
        "agentId": "victor",
        "title": "Neonový nátlak",
        "description": "Jeden klub má dneska přinést víc než hudbu. Vlez tam, zatlač a vytáhni z toho hodnotu.",
        "difficulty": "hard",
        "successRate": 68,
        "durationMinutes": 25,
        "reward": {
          "dirty-cash": 1900,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1500000,
        "durationTicks": 300
      },
      {
        "id": "victor_37",
        "agentId": "victor",
        "title": "Kov a krev",
        "description": "Tam, kde je kov, bývá i zisk. Tam, kde je zisk, bývá i problém. Dneska si vezmeš oboje.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 6,
          "cash": 400,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_38",
        "agentId": "victor",
        "title": "Tlačenice u zadního vstupu",
        "description": "Zadní vstup je vždycky levnější než fronta. A mnohem výnosnější.",
        "difficulty": "hard",
        "successRate": 71,
        "durationMinutes": 22,
        "reward": {
          "cash": 500,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_39",
        "agentId": "victor",
        "title": "Stůl pro dva, problém pro jednoho",
        "description": "V restauraci proběhne schůzka. Ty se postaráš, aby domů neodnesli všechno, co přinesli.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 21,
        "reward": {
          "cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_40",
        "agentId": "victor",
        "title": "Zkušební tlak",
        "description": "Chci vidět, jak makáš, když tě někdo tlačí do zdi. Tahle práce je přesně na to.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_41",
        "agentId": "victor",
        "title": "Bazuka ve stínu",
        "description": "Někdo schoval těžší kus železa tam, kde se bojí pro něj vrátit. To není náš problém.",
        "difficulty": "rare",
        "successRate": 58,
        "durationMinutes": 30,
        "reward": {
          "combat-module": 1,
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1800000,
        "durationTicks": 360
      },
      {
        "id": "victor_42",
        "agentId": "victor",
        "title": "Hluk před bouří",
        "description": "Celý blok je nervózní. To je nejlepší chvíle sebrat to, co není přibitý.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 18,
        "reward": {
          "cash": 1000,
          "metal-parts": 4,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_43",
        "agentId": "victor",
        "title": "Ztracený kamerový záznam",
        "description": "Někdo si myslí, že ho chrání záznam. Zmizí záznam, zmizí i jeho jistota.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 2,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_44",
        "agentId": "victor",
        "title": "Převzetí směny",
        "description": "Končí směna, začíná chaos. Přesně v tom chaosu vyděláš nejvíc.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_45",
        "agentId": "victor",
        "title": "Když se nikdo neptá",
        "description": "Tohle je ten druh práce, kde nikdo nic neviděl a nikdo nic neví. Mám tyhle práce rád.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 13,
        "reward": {
          "cash": 600,
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "victor_46",
        "agentId": "victor",
        "title": "Rozpal ulici",
        "description": "Dneska nechci čistou práci. Dneska chci, aby se o tom mluvilo ještě zítra ráno.",
        "difficulty": "rare",
        "successRate": 60,
        "durationMinutes": 26,
        "reward": {
          "smg": 1,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1560000,
        "durationTicks": 312
      },
      {
        "id": "victor_47",
        "agentId": "victor",
        "title": "Pod pultem",
        "description": "Jeden obchod má vzadu něco lepšího než ve výloze. Jdi si pro to.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_48",
        "agentId": "victor",
        "title": "Zlomený alarm",
        "description": "Alarm se dá vypnout dvěma způsoby. Já mám radši ten hlučnější.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 3,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_49",
        "agentId": "victor",
        "title": "Síla bez omluvy",
        "description": "Někdy je plán přeceňovanej. Vleť tam, udělej tlak a odejdi silnější než jsi přišel.",
        "difficulty": "hard",
        "successRate": 69,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "cash": 900,
          "pistol": 1
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_50",
        "agentId": "victor",
        "title": "Ulice si pamatuje",
        "description": "Tohle není jen práce. Tohle je podpis. Udělej to tak, aby si město zapamatovalo, kdo tady určuje rytmus.",
        "difficulty": "hard",
        "successRate": 63,
        "durationMinutes": 29,
        "reward": {
          "influence": 8,
          "dirty-cash": 1400
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1740000,
        "durationTicks": 348
      },
      {
        "id": "victor_51",
        "agentId": "victor",
        "title": "Rozkopnutý sklad",
        "description": "Někdo si myslí, že plechové dveře znamenají bezpečí. Dneska zjistí, že jsou to jen dražší třísky.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 6,
          "cash": 400,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_52",
        "agentId": "victor",
        "title": "Cizí roh",
        "description": "Na našem území si někdo staví vlastní jméno. Sejmi tu pohádku dřív, než jí někdo uvěří.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 21,
        "reward": {
          "influence": 6,
          "dirty-cash": 1000
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1260000,
        "durationTicks": 252
      },
      {
        "id": "victor_53",
        "agentId": "victor",
        "title": "Závora dolů",
        "description": "Jeden vjezd se dnes na chvíli zavře. A všechno, co zůstane uvnitř, bude naše.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 4,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_54",
        "agentId": "victor",
        "title": "Ruce na kapotu",
        "description": "Na parkovišti stojí auto, co veze víc než plech. Otevři ho a vyber, co se hodí.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 17,
        "reward": {
          "cash": 800,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_55",
        "agentId": "victor",
        "title": "Krátká porada",
        "description": "Jeden chytrák potřebuje vysvětlit realitu. Ty budeš ten výukový materiál.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_56",
        "agentId": "victor",
        "title": "Prachy v mrazáku",
        "description": "Někteří lidi schovávají peníze vedle masa. Dneska rozmrazíš jejich jistoty.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "dirty-cash": 1600,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_57",
        "agentId": "victor",
        "title": "Přeložená zásilka",
        "description": "Jedna bedna má změnit adresu dřív, než změří teplotu skladu. Nezdržuj se.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "cash": 600,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_58",
        "agentId": "victor",
        "title": "Těžká pěst",
        "description": "Někde nestačí mluvit. Někde musíš nechat odpověď otisknutou ve zdi.",
        "difficulty": "hard",
        "successRate": 72,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_59",
        "agentId": "victor",
        "title": "Chybná směna",
        "description": "Ve směnárně mají dneska špatný kurz. Pro ně. Pro nás je to výdělek.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "cash": 1163,
          "dirty-cash": 436
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_60",
        "agentId": "victor",
        "title": "Noční inventura",
        "description": "V noci se nejlíp počítá cizí majetek. Zvlášť když si ho ráno už nikdo nespočítá.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 5,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_61",
        "agentId": "victor",
        "title": "Rozlitá krev, čistý zisk",
        "description": "Někdo si chtěl hrát na tvrdýho. Nech mu tvrdou lekci a měkký kolena.",
        "difficulty": "hard",
        "successRate": 68,
        "durationMinutes": 23,
        "reward": {
          "influence": 8,
          "cash": 1000
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1380000,
        "durationTicks": 276
      },
      {
        "id": "victor_62",
        "agentId": "victor",
        "title": "Balík pod mostem",
        "description": "Pod mostem čeká balík bez majitele. A když ho nevezmeš ty, vezme ho někdo rychlejší.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "cash": 500,
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "victor_63",
        "agentId": "victor",
        "title": "Vymáhání po staru",
        "description": "Ten dluh je malej jen na papíře. Udělej z něj velkej problém, dokud nebude splacenej.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "cash": 1500,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_64",
        "agentId": "victor",
        "title": "Přístup jen pro tvrdé",
        "description": "Za zadním vstupem leží věci pro lidi bez skrupulí. Tak tam běž jako domů.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 16,
        "reward": {
          "metal-parts": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_65",
        "agentId": "victor",
        "title": "Vybitý kamerový dohled",
        "description": "Někdo se spoléhá na kamery. Dneska mu ukážeš, že kabely křičí míň než lidi.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 3,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_66",
        "agentId": "victor",
        "title": "Tři minuty strachu",
        "description": "Stačí tři minuty a celej blok začne šeptat. Udělej z nich dlouhý tři minuty.",
        "difficulty": "hard",
        "successRate": 69,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_67",
        "agentId": "victor",
        "title": "Lékárna po zavíračce",
        "description": "Po zavíračce zůstává uvnitř víc než jen světla. Posbírej to, co má cenu.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 18,
        "reward": {
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_68",
        "agentId": "victor",
        "title": "Narušený deal",
        "description": "Dva lidi se chtějí domluvit bez nás. To je chyba, kterou je potřeba zpeněžit.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 20,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1200000,
        "durationTicks": 240
      },
      {
        "id": "victor_69",
        "agentId": "victor",
        "title": "Otevřený kufr",
        "description": "Kufr je otevřenej, nervy taky. Vezmi všechno, co uneseš, a zmiz dřív než cvakne zámek.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 15,
        "reward": {
          "cash": 700,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_70",
        "agentId": "victor",
        "title": "Směna skončila",
        "description": "Když lidi končí směnu, dělají chyby. Ty na těch chybách dneska vyděláš.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "cash": 1000,
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_71",
        "agentId": "victor",
        "title": "Přetlačená ulice",
        "description": "Na tý ulici je moc cizích ramen a málo našeho jména. Vyrovnej to.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 19,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_72",
        "agentId": "victor",
        "title": "Náklad bez pojištění",
        "description": "Jeden převoz nemá ochranu ani štěstí. Přesně takový věci mám rád.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 18,
        "reward": {
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_73",
        "agentId": "victor",
        "title": "Páka na účetního",
        "description": "Účetní nejsou tvrdí. Jen vypadají draze. Stlač ho a pustí víc, než čekáš.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1500,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_74",
        "agentId": "victor",
        "title": "Betonová lekce",
        "description": "Dneska někdo pochopí, že beton je tvrdší než jeho ego. Ty budeš ten překlad.",
        "difficulty": "hard",
        "successRate": 67,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "cash": 800
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_75",
        "agentId": "victor",
        "title": "Špinavý schody",
        "description": "Ve vchodu se schází lidi, co zapomněli platit za klid. Připomeň jim sazebník.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "cash": 1244,
          "dirty-cash": 355,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_76",
        "agentId": "victor",
        "title": "Nedodaná bedna",
        "description": "Jeden zákazník dneska nic nedostane. Protože všechno skončí v tvých rukách.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_77",
        "agentId": "victor",
        "title": "Přesun pod tlakem",
        "description": "Musíš dostat zásobu přes místo, kde všichni čumí. To je přesně chvíle, kdy se pozná, kdo má nervy.",
        "difficulty": "hard",
        "successRate": 71,
        "durationMinutes": 22,
        "reward": {
          "cash": 600,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_78",
        "agentId": "victor",
        "title": "Vyrvaná jistota",
        "description": "Jeden člověk je moc v pohodě. A pohodlí na ulici bývá dočasná věc.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 1000
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_79",
        "agentId": "victor",
        "title": "Nabouraný převoz",
        "description": "Nehoda se dá zařídit různě. Hlavní je, aby po ní zůstalo něco použitelného.",
        "difficulty": "hard",
        "successRate": 72,
        "durationMinutes": 22,
        "reward": {
          "metal-parts": 6,
          "cash": 700,
          "influence": 2
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_80",
        "agentId": "victor",
        "title": "Půlnoční výběrčí",
        "description": "Po půlnoci bývají lidi štědřejší. Hlavně když mají důvod se bát odmítnout.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 18,
        "reward": {
          "cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_81",
        "agentId": "victor",
        "title": "Cizí železo",
        "description": "V dílně zůstalo pár kusů železa bez dozoru. Tak tam nechoď pro dovolení.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "metal-parts": 6,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_82",
        "agentId": "victor",
        "title": "Vysoký tlak, nízký hlas",
        "description": "Někdo mluví moc nahlas o věcech, co by měly zůstat pod stolem. Ztiš ho.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_83",
        "agentId": "victor",
        "title": "Slepý roh",
        "description": "Na slepým rohu se dneska ztratí jedna zásilka a několik iluzí.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "cash": 600,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_84",
        "agentId": "victor",
        "title": "Rozjetej motor",
        "description": "Motor běží, řidič je nervózní a náklad je cennej. Stačí být rychlejší než panika.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 18,
        "reward": {
          "cash": 1200,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_85",
        "agentId": "victor",
        "title": "Pevná ruka",
        "description": "Někdy je rozdíl mezi chaosem a respektem jen v tom, kdo drží situaci za krk.",
        "difficulty": "hard",
        "successRate": 66,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "cash": 700
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_86",
        "agentId": "victor",
        "title": "Podlomený obchod",
        "description": "Jeden podnik dneska vydělá míň, než čekal. Protože část zisku půjde domů s tebou.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1219,
          "cash": 380,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_87",
        "agentId": "victor",
        "title": "Špatně zamčený box",
        "description": "Box je zamčenej jen pro slušný lidi. Ty tam nejdeš slušně.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 15,
        "reward": {
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_88",
        "agentId": "victor",
        "title": "Řeči z okna",
        "description": "Někdo se dívá z okna a myslí si, že je mimo hru. Připomeň mu, že ulice sahá výš.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_89",
        "agentId": "victor",
        "title": "Kyselý náklad",
        "description": "Jedna várka chemie se má ztratit cestou. Tak jí pomoz zmizet správným směrem.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "cash": 500,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_90",
        "agentId": "victor",
        "title": "Příliš klidný klub",
        "description": "Ten klub je dneska až moc v klidu. Udělej tam takovej tlak, aby se začalo platit za ticho.",
        "difficulty": "hard",
        "successRate": 70,
        "durationMinutes": 23,
        "reward": {
          "dirty-cash": 1900,
          "influence": 4
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1380000,
        "durationTicks": 276
      },
      {
        "id": "victor_91",
        "agentId": "victor",
        "title": "Rozbitý stůl",
        "description": "Když se rozbije stůl, často se otevřou i kapsy. Využij obojí.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "cash": 1400,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "victor_92",
        "agentId": "victor",
        "title": "Přeseknutá dohoda",
        "description": "Někdo si myslí, že může obchodovat bez povolení. Dneska zjistí, že povolení vypadá jako ty.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 19,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "victor_93",
        "agentId": "victor",
        "title": "Kufr plný problémů",
        "description": "V kufru je víc problémů než oblečení. Otevři ho a změň problémy na zásoby.",
        "difficulty": "hard",
        "successRate": 65,
        "durationMinutes": 24,
        "reward": {
          "metal-parts": 2,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1440000,
        "durationTicks": 288
      },
      {
        "id": "victor_94",
        "agentId": "victor",
        "title": "Kroky ve skladu",
        "description": "Sklad dneska nebude tichej. A po tvým odchodu nebude ani plnej.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 5,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_95",
        "agentId": "victor",
        "title": "Poslední varování",
        "description": "Někdo už jedno varování dostal. Teď dostane takový, co se nedá přeslechnout.",
        "difficulty": "hard",
        "successRate": 68,
        "durationMinutes": 22,
        "reward": {
          "influence": 8,
          "cash": 900
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_96",
        "agentId": "victor",
        "title": "Vlhký bankovky",
        "description": "U přístavu se dneska lepí bankovky na špatný ruce. Ty máš zařídit, aby se lepily na správný.",
        "difficulty": "hard",
        "successRate": 72,
        "durationMinutes": 22,
        "reward": {
          "dirty-cash": 2100,
          "influence": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1320000,
        "durationTicks": 264
      },
      {
        "id": "victor_97",
        "agentId": "victor",
        "title": "Odtržená směna",
        "description": "Jedna parta dneska nedokončí směnu v pohodě. A ty z toho vytáhneš, co půjde.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 17,
        "reward": {
          "cash": 1000,
          "metal-parts": 4,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "victor_98",
        "agentId": "victor",
        "title": "Tvrdý přepočet",
        "description": "Když se špatně přepočítáš na ulici, někdo jiný si to spočítá za tebe. Jdi jim pomoct s matematikou.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 18,
        "reward": {
          "cash": 1500,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "victor_99",
        "agentId": "victor",
        "title": "Díra v plotě",
        "description": "Každý plot má slabý místo. A za každým slabým místem bývá něco, co se dá odnést.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "victor_100",
        "agentId": "victor",
        "title": "Victorův podpis",
        "description": "Tohle není jen další práce. Tohle je připomínka všem v okolí, kdo má v ulicích poslední slovo.",
        "difficulty": "hard",
        "successRate": 62,
        "durationMinutes": 27,
        "reward": {
          "influence": 8,
          "dirty-cash": 1500,
          "metal-parts": 3
        },
        "risk": {
          "successHeat": 4,
          "failureHeat": 10,
          "failureDirtyCashLoss": 400
        },
        "durationMs": 1620000,
        "durationTicks": 324
      },
      {
        "id": "leon_01",
        "agentId": "leon",
        "title": "Kšeft z kufru",
        "description": "Na parkovišti stojí kufr plnej věcí, co oficiálně neexistujou. Přijeď, zaplať správně a zmiz dřív, než se někdo začne ptát.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "metal-parts": 4,
          "chemicals": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_02",
        "agentId": "leon",
        "title": "Levný zboží, drahý následky",
        "description": "Mám deal, kterej smrdí už z dálky. Ale marže je krásná. Vem to, než to někdo vyžere před tebou.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "cash": 1120,
          "dirty-cash": 480
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_03",
        "agentId": "leon",
        "title": "Kontakt ze zadní uličky",
        "description": "Jeden můj kontakt chce mluvit jen venku, mezi odpadkama a špínou. Což většinou znamená, že nabídka stojí za to.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 4,
          "chemicals": 4,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_04",
        "agentId": "leon",
        "title": "Přeprodej bez otázek",
        "description": "Dostaneš zboží. Neptáš se odkud je. Jen ho otočíš rychle a draze. Přesně tak se vydělává ve městě.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_05",
        "agentId": "leon",
        "title": "Špinavý kontakt",
        "description": "Jeden kontakt je nervózní a chce se něčeho zbavit. Ty budeš ten, kdo mu uleví od nákladu i od peněz.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "cash": 700,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_06",
        "agentId": "leon",
        "title": "Zboží pod pultem",
        "description": "Ve výloze nic není. Ale pod pultem leží věci, kvůli kterým se vyplatí přijít zadním vchodem.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 16,
        "reward": {
          "cash": 500,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_07",
        "agentId": "leon",
        "title": "Rychlá otočka",
        "description": "Koupíš levně, prodáš rychle, zmizíš dřív, než někdo zjistí, že byl právě obranej. Klasika.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "cash": 789,
          "dirty-cash": 210
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_08",
        "agentId": "leon",
        "title": "Zásilka bez jména",
        "description": "Přijde bedna bez jména, bez papírů a bez výmluv. To bývají ty nejlepší obchody.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "metal-parts": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_09",
        "agentId": "leon",
        "title": "Přehazovačka",
        "description": "Dvě party si mají předat zboží. Ty zařídíš, aby po cestě změnilo majitele i cenu.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_10",
        "agentId": "leon",
        "title": "Sleva za ticho",
        "description": "Jeden prodejce udělá hezkou cenu. Protože ví, že když ji neudělá, může přestat prodávat úplně.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "velvet-smoke": 1,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_11",
        "agentId": "leon",
        "title": "Noční burza",
        "description": "Po půlnoci se otevírá trh pro lidi, co nechtějí účtenky. Tam chodí skutečný peníze.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 17,
        "reward": {
          "cash": 1252,
          "dirty-cash": 347
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_12",
        "agentId": "leon",
        "title": "Falešný prostředník",
        "description": "Jedna schůzka potřebuje prostředníka. Ty budeš ten prostředník. A taky ten, kdo si ukousne největší část.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "influence": 3,
          "cash": 1000
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_13",
        "agentId": "leon",
        "title": "Drahá adresa",
        "description": "Někdy neprodáváš zboží. Někdy prodáváš jen to, že víš, kam jít a na koho zatlačit.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_14",
        "agentId": "leon",
        "title": "Kradený kov",
        "description": "Mám partu, co tahá kov z míst, kde už ho nikdo nebude postrádat. Otoč to na trhu, než vystydne stopa.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "metal-parts": 6,
          "cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_15",
        "agentId": "leon",
        "title": "Kapsy plný marže",
        "description": "Dneska nejde o sílu. Dneska jde o to, kdo vytěží víc z cizí blbosti. A to jsi ty.",
        "difficulty": "easy",
        "successRate": 90,
        "durationMinutes": 12,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_16",
        "agentId": "leon",
        "title": "Podivný léky",
        "description": "Někdo prodává farmaceutický zásoby bokem. Kvalita pochybná, zisk krásnej. Takže to bereme.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 18,
        "reward": {
          "chemicals": 6,
          "cash": 40
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_17",
        "agentId": "leon",
        "title": "Překupník v běhu",
        "description": "Jeden malej překupník panikaří a chce všechno střelit hned. Vezmi mu to za směšnou cenu.",
        "difficulty": "easy",
        "successRate": 91,
        "durationMinutes": 11,
        "reward": {
          "cash": 300,
          "metal-parts": 3,
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "leon_18",
        "agentId": "leon",
        "title": "Druhá ruka, první zisk",
        "description": "Tohle zboží už někdo vlastnil. A teď ho budeš vlastnit ty. Krátce. Než ho prodáš ještě dráž.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 16,
        "reward": {
          "dirty-cash": 900,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_19",
        "agentId": "leon",
        "title": "Směna ve tmě",
        "description": "Žádný světla, žádný jména, žádný potvrzení. Jen deal a rychlý ruce.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "velvet-smoke": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_20",
        "agentId": "leon",
        "title": "Kontakt z druhý strany města",
        "description": "Mám tip z části města, kam normálně nechodíš. Což je přesně důvod, proč tam leží prachy.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 5,
          "cash": 1100
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_21",
        "agentId": "leon",
        "title": "Nadupaná přirážka",
        "description": "Někdo něco zoufale potřebuje. A zoufalství je jen jiný slovo pro vyšší cenu.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_22",
        "agentId": "leon",
        "title": "Kšeft mezi popelnicema",
        "description": "Když se velký peníze řeší mezi popelnicema, většinou z toho něco kápne i bokem. Dneska hodně.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1480,
          "chemicals": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_23",
        "agentId": "leon",
        "title": "Dveře bez cedule",
        "description": "Za jedněma neoznačenýma dveřma čeká nabídka, co se nebude opakovat. Buď první uvnitř.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "tech-core": 1,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_24",
        "agentId": "leon",
        "title": "Tichý přepočet",
        "description": "Někdo se přepočítal v náš prospěch. A ty mu teď pomůžeš tu chybu už nenapravit.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "cash": 750,
          "dirty-cash": 250
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_25",
        "agentId": "leon",
        "title": "Otoč to, než to shnije",
        "description": "Jedna várka je horká, jedna špinavá a jedna se kazí. Neřeš která je která. Prostě to otoč.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "chemicals": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_26",
        "agentId": "leon",
        "title": "Fix za fixem",
        "description": "Dneska neprodáváš věc. Dneska prodáváš řešení. A řešení ve městě bývají dražší než kulky.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 1200
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_27",
        "agentId": "leon",
        "title": "Sektorovej překup",
        "description": "Co je levný v jednom sektoru, je drahý v druhým. A ty budeš ten most mezi chamtivostí a nouzí.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_28",
        "agentId": "leon",
        "title": "Balíček pro nervózního klienta",
        "description": "Klient chce diskrétnost. To znamená vyšší cenu a rychlejší nohy. Obojí máš.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "cash": 800,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_29",
        "agentId": "leon",
        "title": "Cizí problém, náš zisk",
        "description": "Někdo má moc zboží, málo času a nulovou páteř. Přesně z takových se žije nejlíp.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "metal-parts": 5,
          "cash": 700,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_30",
        "agentId": "leon",
        "title": "Pouliční licence",
        "description": "Na tomhle bloku nikdo neprodává bez toho, aby něco neodvedl. Dneska vybíráš ty.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "cash": 1120,
          "dirty-cash": 480,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_31",
        "agentId": "leon",
        "title": "Zlomený řetězec",
        "description": "Jeden dodavatelský řetězec právě praskl. A ty posbíráš, co z něj vypadne na zem.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "chemicals": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_32",
        "agentId": "leon",
        "title": "Přestřelená cena",
        "description": "Někdo chce moc. Ty mu zaplatíš málo. A ještě na tom vyděláš. Tomu říkám obchod.",
        "difficulty": "easy",
        "successRate": 90,
        "durationMinutes": 11,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "leon_33",
        "agentId": "leon",
        "title": "Tichý runner",
        "description": "Potřebuju, aby něco přešlo přes tři bloky a nikdo to nezastavil. Žádná sláva, jen čistý profit.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_34",
        "agentId": "leon",
        "title": "Výprodej strachu",
        "description": "Když začne někdo panikařit, prodává hluboko pod cenou. A my jsme přesně ti, co to umí využít.",
        "difficulty": "easy",
        "successRate": 91,
        "durationMinutes": 12,
        "reward": {
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_35",
        "agentId": "leon",
        "title": "Spodní police",
        "description": "To nejlepší zboží nebývá na očích. Bývá dole, za plentou, mezi věcma bez původu.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "velvet-smoke": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_36",
        "agentId": "leon",
        "title": "Dohoda na rohu",
        "description": "Na rohu čeká deal. Malej stůl, špinavý ruce, velký peníze. Nezvor to.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_37",
        "agentId": "leon",
        "title": "Sběrač marže",
        "description": "Dva blbci se hádají o cenu. Ty přijdeš mezi ně a odejdeš s největším kusem.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_38",
        "agentId": "leon",
        "title": "Krabice bez původu",
        "description": "Mám tři krabice. Jedna je legální, druhá ne a třetí je nejlepší neotvírat. Vezmi všechny.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "chemicals": 3,
          "metal-parts": 3,
          "cash": 220
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_39",
        "agentId": "leon",
        "title": "Pouliční arbitráž",
        "description": "Jedna strana má zboží, druhá peníze a obě mají málo mozku. Ty z toho vytěžíš nejvíc.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "cash": 818,
          "dirty-cash": 181
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_40",
        "agentId": "leon",
        "title": "Tlačenice o bedny",
        "description": "Došlo pár beden a pár lidí po nich skočí. Ty skočíš rychlejc a prodáš je s přirážkou.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "tech-core": 1,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_41",
        "agentId": "leon",
        "title": "Klient bez nervů",
        "description": "Můj klient se sype a chce všechno hned. Tak mu to dej. Ale draho.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "cash": 750,
          "dirty-cash": 250
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_42",
        "agentId": "leon",
        "title": "Zadní schodiště",
        "description": "Na zadním schodišti se dneska budou měnit ruce, kapsy a loajalita. Buď u toho první.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 5,
          "cash": 1000
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_43",
        "agentId": "leon",
        "title": "Přeskládání trhu",
        "description": "Jedna várka zmizí z trhu a jiná se objeví za dvojnásobek. Krása volný ulice.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 17,
        "reward": {
          "cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_44",
        "agentId": "leon",
        "title": "Vypůjčený sklad",
        "description": "Na pár minut si půjčíš cizí sklad. Na pár hodin z něj budeš žít.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 6,
          "chemicals": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_45",
        "agentId": "leon",
        "title": "Nelegální přirážka",
        "description": "Některý věci jsou drahý proto, že jsou vzácný. Jiný proto, že za ně můžeš skončit v problému. Tohle je ten druhý případ.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 19,
        "reward": {
          "cash": 800,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "leon_46",
        "agentId": "leon",
        "title": "Šeptaná nabídka",
        "description": "Když někdo šeptá cenu, většinou ví, že je buď moc dobrá, nebo moc špinavá. Mně jsou sympatický obě možnosti.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 15,
        "reward": {
          "dirty-cash": 1500,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_47",
        "agentId": "leon",
        "title": "Pouliční broker",
        "description": "Dneska seš prostředník mezi hladovejma rukama a plným bednama. A prostředník bere vždycky první kus.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_48",
        "agentId": "leon",
        "title": "Přepálený zájem",
        "description": "Když někdo něco chce až moc, přestává řešit cenu. A přesně v tu chvíli přicházíš ty.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_49",
        "agentId": "leon",
        "title": "Černý seznam kontaktů",
        "description": "Mám seznam jmen, adres a slabin. Nechci ho celý. Stačí mi, když z něj vytěžíš maximum.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_50",
        "agentId": "leon",
        "title": "Leonův řez",
        "description": "Pamatuj si to. V tomhle městě nevyhrává ten, kdo něco má. Vyhrává ten, kdo si z každýho kšeftu ukousne největší kus. Dneska to budeš ty.",
        "difficulty": "rare",
        "successRate": 65,
        "durationMinutes": 25,
        "reward": {
          "overdrive-x": 1,
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1500000,
        "durationTicks": 300
      },
      {
        "id": "leon_51",
        "agentId": "leon",
        "title": "Krabice od špíny",
        "description": "Na kraji sektoru čeká pár beden, co už prošly moc rukama. Smrdí, jsou kradený a přesně proto na nich vyděláš nejvíc.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "metal-parts": 5,
          "chemicals": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_52",
        "agentId": "leon",
        "title": "Obchod se strachem",
        "description": "Jeden malej dealer se bojí, že ho někdo obere. Nabídni mu ochranu. Drahou, špinavou a povinnou.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 15,
        "reward": {
          "cash": 1500,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_53",
        "agentId": "leon",
        "title": "Přesunutá zásilka",
        "description": "Jedna zásilka má dojet jinam. Ty zařídíš, že skončí u nás. Bez hluku, bez výčitek, se ziskem.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "chemicals": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_54",
        "agentId": "leon",
        "title": "Vysátý sklad",
        "description": "Ve skladu zůstalo víc, než měl majitel přiznat. Tak mu pomůžeme s inventurou po svým.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 6,
          "cash": 400,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "leon_55",
        "agentId": "leon",
        "title": "Cena za mlčení",
        "description": "Někdo viděl víc, než měl. Nech ho pochopit, že ticho je levnější než nemocnice.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 16,
        "reward": {
          "dirty-cash": 1400,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_56",
        "agentId": "leon",
        "title": "Přeprodej krve",
        "description": "Po jednom špinavým střetu zůstalo na zemi vybavení. Posbírej to a otoč to, než zaschne krev.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 18,
        "reward": {
          "metal-parts": 3,
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_57",
        "agentId": "leon",
        "title": "Mokrej deal u kanálu",
        "description": "U kanálu se mají měnit ruce, peníze a loajalita. Dohlídni, aby všechno skončilo v našich kapsách.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1600,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_58",
        "agentId": "leon",
        "title": "Špatná adresa, dobrý zisk",
        "description": "Jedna zásilka půjde na špatnou adresu. A ta adresa bude naše. Někdy je logistika krásná věc.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "chemicals": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_59",
        "agentId": "leon",
        "title": "Rozprodej paniky",
        "description": "Když se někdo začne bát razie, prodá i vlastní boty. Kup levně všechno, co pustí z ruky.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 13,
        "reward": {
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_60",
        "agentId": "leon",
        "title": "Špinavé procento",
        "description": "Dva idioti chtějí udělat obchod. Ty jim ho umožníš. A ukousneš si takovej podíl, že je to bude bolet až doma.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 14,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_61",
        "agentId": "leon",
        "title": "Bedny z rozbité dodávky",
        "description": "Na krajnici stojí dodávka, co nedojela. Někdo brečí nad plechem, ty vyděláš na obsahu.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 16,
        "reward": {
          "chemicals": 1,
          "metal-parts": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_62",
        "agentId": "leon",
        "title": "Šelma mezi překupníky",
        "description": "Na trhu je moc hladových krys. Buď největší z nich a stáhni jim nejlepší kusy přímo před nosem.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 15,
        "reward": {
          "cash": 1219,
          "dirty-cash": 380,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_63",
        "agentId": "leon",
        "title": "Kontakty v bordelu",
        "description": "Nejlepší informace neleží v kanceláři. Leží v zakouřeným bordelu mezi lidma, co mluví, když si myslí, že jsou v bezpečí.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_64",
        "agentId": "leon",
        "title": "Levný kulky, drahá noc",
        "description": "Někdo se chce zbavit železa, než přijde kontrola. Seber to levně a pošli dál ještě před svítáním.",
        "difficulty": "medium",
        "successRate": 73,
        "durationMinutes": 19,
        "reward": {
          "cash": 700,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "leon_65",
        "agentId": "leon",
        "title": "Kapsářský velkoobchod",
        "description": "Malej zloděj ukradl víc, než zvládne prodat. Tak ho odlehči. Klidně i od iluzí.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "cash": 300,
          "metal-parts": 3,
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_66",
        "agentId": "leon",
        "title": "Přehoz přes sektor",
        "description": "V jednom sektoru je bída, v druhým hlad. Ty propojíš jedno s druhým a zbytek shrábneš.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_67",
        "agentId": "leon",
        "title": "Ostrá přirážka",
        "description": "Klient chce zboží hned. To znamená jediný: zvedni cenu, usměj se a nech ho krvácet do peněženky.",
        "difficulty": "easy",
        "successRate": 90,
        "durationMinutes": 11,
        "reward": {
          "cash": 863,
          "dirty-cash": 136
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "leon_68",
        "agentId": "leon",
        "title": "Zadní pokoj",
        "description": "V zadním pokoji se dneska budou přehazovat věci, co neměly opustit sklad. Dohlídni, aby opustily i majitele.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "chemicals": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_69",
        "agentId": "leon",
        "title": "Srážka zájmů",
        "description": "Dvě party chtějí to samý zboží. Ty jim prodáš naději, chaos a nakonec to zinkasuješ celý.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "cash": 1600,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_70",
        "agentId": "leon",
        "title": "Oškrabaná marže",
        "description": "Na dealu už si ukousli jiní. Ty z toho seškrábneš poslední vrstvu. A ta bývá nejtučnější.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "dirty-cash": 750,
          "cash": 250
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_71",
        "agentId": "leon",
        "title": "Výprodej slabosti",
        "description": "Někdo potřebuje rychle cash a prodá všechno pod cenou. Ty potřebuješ jen přijít včas a bejt bez slitování.",
        "difficulty": "easy",
        "successRate": 92,
        "durationMinutes": 12,
        "reward": {
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "leon_72",
        "agentId": "leon",
        "title": "Rozsypaný lékárenský zboží",
        "description": "Po jedný hádce zůstalo pár beden z lékárny bez dozoru. Posbírej to a prodej to dřív, než se majitel probere.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "chemicals": 6,
          "cash": 40
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_73",
        "agentId": "leon",
        "title": "Prašivej broker",
        "description": "Dneska nebudeš obchodník. Dneska budeš hyena s kontakty. A hyeny se v tomhle městě nají nejlíp.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_74",
        "agentId": "leon",
        "title": "Dohoda v dešti",
        "description": "Když prší, lidi méně koukají. To je ideální chvíle poslat špinavý zboží přes půl bloku.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "velvet-smoke": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_75",
        "agentId": "leon",
        "title": "Výběr od zoufalců",
        "description": "Dneska neokradeš bohatý. Dneska vytěžíš zoufalý. A zoufalí platí nejrychlejc.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "dirty-cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_76",
        "agentId": "leon",
        "title": "Překup za rozbitým barem",
        "description": "Za jedním rozbitým barem čeká týpek s věcma, co by oficiálně měly být zamčený jinde. Tak je oficiálně přesuň k nám.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "chemicals": 2,
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_77",
        "agentId": "leon",
        "title": "Křivá směnka",
        "description": "Někdo se upsál špatným lidem. Ty od něj koupíš dluh za drobný a vybereš ho jako plnou cenu.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "cash": 1309,
          "dirty-cash": 290,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_78",
        "agentId": "leon",
        "title": "Špinavý přepočet beden",
        "description": "Na papíře jich je deset. Ve skutečnosti jich může zmizet dvanáct. Takovej účetnictví já respektuju.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "metal-parts": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_79",
        "agentId": "leon",
        "title": "Přepálený zájemce",
        "description": "Jeden kupec chce zboží tak moc, že už necítí pach podrazu. Přesně takový mám nejradši.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 11,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "leon_80",
        "agentId": "leon",
        "title": "Rozřezaná trasa",
        "description": "Běžná přepravní trasa je dneska mrtvá. Vezmeš náklad bokem a z marže uděláš malý svinstvo.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 14,
        "reward": {
          "metal-parts": 4
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_81",
        "agentId": "leon",
        "title": "Sektorový pijavice",
        "description": "Na každým sektoru visí někdo, kdo už saje moc dlouho. Dneska ho odsajeme my.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "dirty-cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_82",
        "agentId": "leon",
        "title": "Levná bolest, drahý zisk",
        "description": "Někdo prodá cennej materiál jen proto, aby přežil noc. Ty si z jeho bolesti uděláš obchodní model.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "influence": 2
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "leon_83",
        "agentId": "leon",
        "title": "Kufr po mrtvým dealu",
        "description": "Po jednom zpackaným setkání zůstal kufr bez dozoru. Otevři ho a udělej z cizího průseru náš profit.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 18,
        "reward": {
          "dirty-cash": 900,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_84",
        "agentId": "leon",
        "title": "Prodej přes bolest",
        "description": "Někdy nestačí nabídnout cenu. Někdy musíš nabídnout i důvod, proč ji mají přijmout bez keců.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 15,
        "reward": {
          "cash": 1600,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_85",
        "agentId": "leon",
        "title": "Rozebranej kontejner",
        "description": "V přístavu někdo otevřel, co otevřít neměl. Posbírej zbytky a pošli je dál, než přijdou uniformy.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 19,
        "reward": {
          "metal-parts": 6,
          "chemicals": 1
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "leon_86",
        "agentId": "leon",
        "title": "Pobodaná nabídka",
        "description": "Jeden obchod skončil nožem ve stole. To znamená dvě věci: méně zájemců a víc prostoru pro nás.",
        "difficulty": "medium",
        "successRate": 74,
        "durationMinutes": 18,
        "reward": {
          "cash": 700,
          "dirty-cash": 400
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_87",
        "agentId": "leon",
        "title": "Otočka přes špínu",
        "description": "Tohle zboží je tak špinavý, že by si zasloužilo vlastní kanalizaci. Přesně proto má krásnou marži.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "chemicals": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_88",
        "agentId": "leon",
        "title": "Rozšlapaný kontakt",
        "description": "Jeden kontakt dostal přes hubu a chce zmizet. Nech ho zmizet. Ale nejdřív z něj vytáhni všechno cenný.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_89",
        "agentId": "leon",
        "title": "Přesun černé várky",
        "description": "Várka je horká, sektor nervózní a čas krátkej. Přesuň to, než se někdo začne zajímat moc.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "chemicals": 4,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_90",
        "agentId": "leon",
        "title": "Drahý mlčení u stolu",
        "description": "U jednoho stolu sedí lidi, co by spolu normálně nemluvili. Ty jim pomůžeš najít společnou řeč. Za velmi nepříjemnou cenu.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_91",
        "agentId": "leon",
        "title": "Prohnilý deal",
        "description": "Ten kšeft je prohnilej od základu. Ale i z prohnilýho dřeva se dá postavit pěkně hnusnej zisk.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "dirty-cash": 800,
          "cash": 200
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_92",
        "agentId": "leon",
        "title": "Tahání za nitky",
        "description": "Dneska nebudeš tahat bedny. Dneska budeš tahat lidi. A lidi se prodávají ještě líp než zboží.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 1000
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_93",
        "agentId": "leon",
        "title": "Sklad pro krysy",
        "description": "Jeden sklad je tak děravej, že si z něj bere každej. Dneska si z něj vezmeme nejvíc my.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "metal-parts": 6,
          "cash": 400,
          "influence": 2
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "leon_94",
        "agentId": "leon",
        "title": "Zuby trhu",
        "description": "Trh není místo pro obchodníky. Je to místo pro predátory. Tak koukej kousat.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "leon_95",
        "agentId": "leon",
        "title": "Rozkradený papíry",
        "description": "Některý zásilky cestují díky razítku. Dneska se postaráš, aby papíry zmizely a zboží zůstalo nám.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "tech-core": 1,
          "influence": 3
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_96",
        "agentId": "leon",
        "title": "Překupnický masakr",
        "description": "Na jednom rohu se dneska roztrhá několik překupníků o stejnou věc. Ty to vezmeš první a prodáš jim to zpátky dráž.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "leon_97",
        "agentId": "leon",
        "title": "Vydřená marže",
        "description": "Tohle nebude hezkej obchod. Tohle bude špinavý, tvrdý a přesně tak výdělečný, jak to mám rád.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "dirty-cash": 1600,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "leon_98",
        "agentId": "leon",
        "title": "Dodávka z pekla",
        "description": "Jedna dodávka veze tolik bordelu, že by ji nikdo neměl vidět. Postarej se, aby ji nikdo ani nedopočítal.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 19,
        "reward": {
          "chemicals": 1,
          "metal-parts": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "leon_99",
        "agentId": "leon",
        "title": "Řez z každý kapsy",
        "description": "Dneska nebudeš brát jen z jednoho zdroje. Dneska si ukousneš z každý kapsy, co se v sektoru pohne.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 16,
        "reward": {
          "cash": 1280,
          "dirty-cash": 320,
          "influence": 4
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "leon_100",
        "agentId": "leon",
        "title": "Leonova špinavá škola",
        "description": "Zapamatuj si to. Ulice nepatří tomu, kdo má čistý ruce. Patří tomu, kdo umí z každýho svinstva udělat zisk. Dneska budeš učit ostatní.",
        "difficulty": "rare",
        "successRate": 65,
        "durationMinutes": 25,
        "reward": {
          "ghost-serum": 1,
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1500000,
        "durationTicks": 300
      },
      {
        "id": "nyra_01",
        "agentId": "nyra",
        "title": "Špatně zamčený telefon",
        "description": "Jeden idiot nechal telefon bez dozoru a bez zámku. Vezmi z něj všechno, co se dá prodat, zneužít nebo poslat správným lidem.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "influence": 3,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "nyra_02",
        "agentId": "nyra",
        "title": "Šeptaná slabina",
        "description": "V každém sektoru je někdo, kdo ví příliš moc a pije příliš levně. Sedni si k němu a nech ho mluvit.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_03",
        "agentId": "nyra",
        "title": "První lež zdarma",
        "description": "Rozšiř mezi správné uši malou lež. Když se chytne, ostatní udělají zbytek práce za tebe.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_04",
        "agentId": "nyra",
        "title": "Fotka, která bolí",
        "description": "Jedna fotka má větší váhu než zásobník. Získej ji a pak sleduj, jak rychle se mění loajalita za ticho.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_05",
        "agentId": "nyra",
        "title": "Odcizený seznam",
        "description": "Někdo si vede seznam jmen, adres a dluhů. Ten seznam dnes změní majitele. A s ním i půlku města.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_06",
        "agentId": "nyra",
        "title": "Cizí paranoia",
        "description": "Není třeba někoho zničit. Stačí, aby začal pochybovat o lidech kolem sebe. To už zvládne rozebrat zbytek sám.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_07",
        "agentId": "nyra",
        "title": "Ztracený přístup",
        "description": "Jeden přístupový kód se má ztratit. Ty se postaráš, aby se ztratil správnému člověku do kapsy.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 4,
          "cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_08",
        "agentId": "nyra",
        "title": "Vydírání bez hlasu",
        "description": "Někdy není potřeba říct ani slovo. Jen poslat správný důkaz na správné místo a počkat, kdo přijde platit první.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "dirty-cash": 1200,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_09",
        "agentId": "nyra",
        "title": "Nastražená zpráva",
        "description": "Pošli jednu zprávu tak, aby vypadala, že přišla od někoho jiného. Lidi jsou překvapivě ochotní si ničit životy sami.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_10",
        "agentId": "nyra",
        "title": "Tichá výměna",
        "description": "Na střeše proběhne výměna informací. Ty se neukážeš. Jen zajistíš, že jedna strana odejde chudší a druhá vyděšená.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 5,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_11",
        "agentId": "nyra",
        "title": "Rozbitá důvěra",
        "description": "Dva lidi si ještě pořád věří. To je chyba, kterou dnes opravíš.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_12",
        "agentId": "nyra",
        "title": "Záznam z chodby",
        "description": "Na jedné chodbě visí kamera, která viděla víc, než by měla. Stáhni záznam dřív, než ho smaže někdo jiný.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 700,
          "dirty-cash": 300
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_13",
        "agentId": "nyra",
        "title": "Toxický drb",
        "description": "Jedna dobře vypuštěná informace dokáže otrávit celý sektor. Vypusť ji jemně a sleduj, kdo se začne dusit první.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "dirty-cash": 500
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_14",
        "agentId": "nyra",
        "title": "Dívka u baru",
        "description": "Některé dveře neotevře páčidlo, ale úsměv a dvě správné otázky. Dnes otevřeš právě takové.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_15",
        "agentId": "nyra",
        "title": "Složka bez jména",
        "description": "V jedné zásuvce leží složka, která nemá existovat. Vezmi ji a připomeň městu, že papír někdy řeže hlouběji než nůž.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_16",
        "agentId": "nyra",
        "title": "Podvržený podpis",
        "description": "Stačí jeden podpis na špatném místě a někdo se probudí s hodně drahým problémem.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "cash": 1000,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_17",
        "agentId": "nyra",
        "title": "Noční odposlech",
        "description": "Na jednu noc zapojíš uši tam, kam nepatří. To, co zachytíš, prodáš třikrát různým lidem.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 18,
        "reward": {
          "dirty-cash": 1100,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_18",
        "agentId": "nyra",
        "title": "Jméno na seznamu",
        "description": "Jedno jméno se objeví na špatném seznamu. A pak už jen sleduj, jak rychle začne jeho majitel panikařit.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_19",
        "agentId": "nyra",
        "title": "Špína v archivu",
        "description": "Nejlepší tajemství nejsou na ulici. Jsou uložená, seřazená a čekají, až je někdo použije správným způsobem.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_20",
        "agentId": "nyra",
        "title": "Falešná stopa",
        "description": "Naveď lovce na špatnou adresu a kořist zůstane bez dozoru. Krása manipulace je v tom, že nikdo neví, kdo začal.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "cash": 900,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "nyra_21",
        "agentId": "nyra",
        "title": "Cizí heslo",
        "description": "Někdo používá stejné heslo všude. Smutné. Ale výdělečné.",
        "difficulty": "easy",
        "successRate": 90,
        "durationMinutes": 11,
        "reward": {
          "influence": 3,
          "cash": 727,
          "dirty-cash": 272
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "nyra_22",
        "agentId": "nyra",
        "title": "Přítelkyně problému",
        "description": "Dnes se nebudeš prát. Dnes někomu nabídneš řešení, které ho udělá závislým na další schůzce s námi.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_23",
        "agentId": "nyra",
        "title": "Šepot na schodišti",
        "description": "Na schodišti se dnes řekne něco, co nemělo nikdy zaznít nahlas. Ty budeš stát dost blízko, aby to mělo cenu.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 700
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_24",
        "agentId": "nyra",
        "title": "Zkažený deal",
        "description": "Není třeba obchod zastavit. Stačí ho jen trochu pokazit, aby se obě strany začaly navzájem podezírat.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_25",
        "agentId": "nyra",
        "title": "Sklenička navíc",
        "description": "Lidi po třetí skleničce říkají věci, za které by ráno platili. Ty jim tu šanci dáš.",
        "difficulty": "easy",
        "successRate": 91,
        "durationMinutes": 11,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "nyra_26",
        "agentId": "nyra",
        "title": "Zamčená minulost",
        "description": "Každý má minulost, kterou by nejradši utopil. Ty ji jen vytáhneš na hladinu a nabídneš ručník za správnou cenu.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1300,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_27",
        "agentId": "nyra",
        "title": "Slabé místo aliance",
        "description": "Každá aliance má člena, co drží hubu jen do chvíle, než dostane správnou nabídku. Najdi ho.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_28",
        "agentId": "nyra",
        "title": "Cizí deník",
        "description": "Papír snese všechno. A některé papíry snesou dost na to, aby někdo začal platit pravidelně.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_29",
        "agentId": "nyra",
        "title": "Otrávené podezření",
        "description": "Stačí zasít malou pochybnost a sledovat, jak si ji lidi zalijí vlastní panikou.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_30",
        "agentId": "nyra",
        "title": "Tichá výstraha",
        "description": "Ne všichni potřebují dostat přes hubu. Některým stačí obálka bez odesílatele a špatný spánek na týden dopředu.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_31",
        "agentId": "nyra",
        "title": "Přesměrovaná nenávist",
        "description": "Dneska někoho nenasměruješ k cíli. Nasměruješ ho k omylu. A omyly v našem městě bývají smrtelně drahé.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_32",
        "agentId": "nyra",
        "title": "Stará hlasová schránka",
        "description": "Někdo zapomněl smazat hlasovky. Ty zapomeneš mít slitování.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 12,
        "reward": {
          "dirty-cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_33",
        "agentId": "nyra",
        "title": "Zblízka a bez otisků",
        "description": "Potřebuju, abys byl dost blízko na to slyšet pravdu a dost chytrej na to, abys po sobě nic nenechal.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_34",
        "agentId": "nyra",
        "title": "Lehký dotek chaosu",
        "description": "Nebudeme rozbíjet dveře. Jen jemně zatlačíme na správné lidi a zbytek město rozebere samo.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_35",
        "agentId": "nyra",
        "title": "Smazaná kamera",
        "description": "Někde chybí pár minut záznamu. Postarej se, aby chyběly přesně ty, které potřebujeme.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "cash": 900,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_36",
        "agentId": "nyra",
        "title": "Noční návštěva",
        "description": "Dnes někomu necháš za dveřmi důkaz, který tam neměl nikdy být. A pak počkáš, kdo začne křičet první.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_37",
        "agentId": "nyra",
        "title": "Dva kroky od zrady",
        "description": "Zrada nezačíná nožem do zad. Začíná jednou pochybností a správně položenou otázkou.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_38",
        "agentId": "nyra",
        "title": "Kapesní tajemství",
        "description": "Malé USB, velké problémy. Najdi ho a pak rozhodneme, kdo si za jeho návrat zaplatí nejvíc.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "dirty-cash": 1200,
          "influence": 5
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_39",
        "agentId": "nyra",
        "title": "Rozhovor za plentou",
        "description": "Za jednou tenkou stěnou se dnes probere něco, co může rozpárat celý sektor. Naslouchej.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_40",
        "agentId": "nyra",
        "title": "Podvržená účast",
        "description": "Někdo bude vypadat, jako že byl na místě, kde nikdy nestál. A někdo jiný za to zaplatí, aby to zmizelo.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "dirty-cash": 1100,
          "influence": 6
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_41",
        "agentId": "nyra",
        "title": "Zaměněná obálka",
        "description": "Stačí jedna obálka v nesprávných rukách a celý večer dostane nový směr.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "cash": 900,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_42",
        "agentId": "nyra",
        "title": "Přepnutá loajalita",
        "description": "Někteří lidé nejsou věrní. Jen ještě nedostali lepší nabídku. Dnes ji dostanou.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_43",
        "agentId": "nyra",
        "title": "Křehká pověst",
        "description": "Pověst je sklo. Jedna prasklina a zbytek už udělá tlak okolí. Ty uděláš tu prasklinu.",
        "difficulty": "medium",
        "successRate": 83,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_44",
        "agentId": "nyra",
        "title": "Vzkaz bez podpisu",
        "description": "Pošli vzkaz, který nebude znít jako hrozba. Jen jako něco, co by si chytrý člověk neměl dovolit ignorovat.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "dirty-cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_45",
        "agentId": "nyra",
        "title": "Druhé dno šuplíku",
        "description": "Vždycky mě zajímá, co lidi schovávají pod tím, co schovávají. Tam bývá skutečná cena.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900,
          "dirty-cash": 300
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_46",
        "agentId": "nyra",
        "title": "Zlá kombinace",
        "description": "Spoj dvě pravdy s jednou lží a dostaneš příběh, který rozbije víc vztahů než pistole kolen.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_47",
        "agentId": "nyra",
        "title": "Stín za zády",
        "description": "Někdo musí mít pocit, že ho někdo sleduje. A ten pocit ho má stát peníze.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "cash": 1000,
          "influence": 3
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_48",
        "agentId": "nyra",
        "title": "Šepot v síti",
        "description": "Dnes nevypustíš zprávu do ulic. Dnes ji pustíš do správných kanálů a necháš ji udělat ošklivější práci tiše.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_49",
        "agentId": "nyra",
        "title": "Pád masky",
        "description": "Každý někde hraje roli. Najdi místo, kde se zapomněl převléct zpátky do své lži.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_50",
        "agentId": "nyra",
        "title": "Nyřin tah",
        "description": "Pamatuj si to. Kulka udělá díru. Tajemství udělá prázdno. Dneska v tom prázdnu vyděláme víc než ostatní za celou noc.",
        "difficulty": "rare",
        "successRate": 65,
        "durationMinutes": 25,
        "reward": {
          "overdrive-x": 1,
          "influence": 8
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1500000,
        "durationTicks": 300
      },
      {
        "id": "nyra_51",
        "agentId": "nyra",
        "title": "Druhá obálka",
        "description": "První obálka člověka znervózní. Druhá ho připraví o spánek. Doruč tu druhou a nech ho přemýšlet, co všechno ještě víme.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 14,
        "reward": {
          "influence": 3,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 840000,
        "durationTicks": 168
      },
      {
        "id": "nyra_52",
        "agentId": "nyra",
        "title": "Prasklina v hlavě",
        "description": "Někdy není potřeba někoho zlomit. Stačí mu do hlavy zasadit jednu otázku, která tam začne hnít.",
        "difficulty": "medium",
        "successRate": 84,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_53",
        "agentId": "nyra",
        "title": "Cizí hlas ve tmě",
        "description": "Jedna zpráva přehraná správným hlasem dokáže rozebrat víc než zbraň. Pošli ji a nech jejich jistoty umřít potichu.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_54",
        "agentId": "nyra",
        "title": "Ztráta jistoty",
        "description": "Dnes nikomu nevezmeš peníze. Dnes mu vezmeš pocit bezpečí. A ten bývá dražší.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_55",
        "agentId": "nyra",
        "title": "Nespolehlivá vzpomínka",
        "description": "Přesvědč někoho, že si pamatuje věc, která se nikdy nestala. Lidi si zbytek lži dopíšou sami.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_56",
        "agentId": "nyra",
        "title": "Ztracený klid",
        "description": "Jedna maličkost zmizí z bytu, druhá se objeví na špatném místě. A najednou začne mít někdo pocit, že už není sám.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_57",
        "agentId": "nyra",
        "title": "Zrcadlo bez odrazu",
        "description": "Každý má obraz sám o sobě. Ty ho dnes rozbiješ a necháš střepy, aby řezaly ještě dlouho potom.",
        "difficulty": "medium",
        "successRate": 76,
        "durationMinutes": 19,
        "reward": {
          "influence": 6,
          "dirty-cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "nyra_58",
        "agentId": "nyra",
        "title": "Špatná hodina",
        "description": "Vzbuď někoho uprostřed noci zprávou, která nedává smysl. Ráno už ho bude rozkládat vlastní představivost.",
        "difficulty": "easy",
        "successRate": 90,
        "durationMinutes": 11,
        "reward": {
          "influence": 3,
          "cash": 700
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "nyra_59",
        "agentId": "nyra",
        "title": "Tenká nitka loajality",
        "description": "Důvěra není zeď. Je to nit. A dnes ji stačí jen lehce naříznout.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_60",
        "agentId": "nyra",
        "title": "Zapomenutý klíč",
        "description": "Někdo najde klíč, který nikdy nevlastnil. Přesně od chvíle, kdy ho vezme do ruky, začne přemýšlet, co všechno už někdo otevřel před ním.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "cash": 727,
          "dirty-cash": 272
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_61",
        "agentId": "nyra",
        "title": "Úsměv a jed",
        "description": "Nejhorší rány nepřicházejí v hněvu. Přicházejí s klidem, úsměvem a přesně zvolenou větou.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_62",
        "agentId": "nyra",
        "title": "Hlas na druhém konci",
        "description": "Jedno anonymní zavolání. Jeden správný tón. Jeden večer, který už nikdy nebude normální.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_63",
        "agentId": "nyra",
        "title": "Návštěva bez svědků",
        "description": "Někdy stačí, aby někdo zahlédl stín za dveřmi a už si nikdy nebude jistý, jestli byl sám.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_64",
        "agentId": "nyra",
        "title": "Zpožděná pravda",
        "description": "Pravda je nejjedovatější, když přijde pozdě. Doruč ji přesně ve chvíli, kdy už nikdo nebude věřit vysvětlení.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_65",
        "agentId": "nyra",
        "title": "Křehký dech",
        "description": "Připomeň někomu, jak moc snadno se může zlomit jeho svět. Ne silou. Jen přesností.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_66",
        "agentId": "nyra",
        "title": "Prázdná židle",
        "description": "Na schůzce nech jednu židli prázdnou a jednu informaci navíc. Paranoia pak zaplní zbytek místnosti sama.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_67",
        "agentId": "nyra",
        "title": "Kroky za zády",
        "description": "Nech někoho slyšet kroky tam, kde nikdo není. To, co si domyslí, bude horší než skutečnost.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "dirty-cash": 600
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_68",
        "agentId": "nyra",
        "title": "Rozladěné nervy",
        "description": "Rozbij někomu rytmus dne. Jeden telefon ráno, jeden vzkaz večer, jedna cizí věc doma. Pak už se rozbije sám.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 700
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_69",
        "agentId": "nyra",
        "title": "Otevřená rána",
        "description": "Každý má místo, kam se nevrací. Ty ho tam dnes pošleš zpátky, aniž bys se ho dotkla.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_70",
        "agentId": "nyra",
        "title": "Cizí oči",
        "description": "Někdo musí uvěřit, že je sledovaný. Ne proto, že to je pravda. Ale protože strach platí rychleji než důkazy.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_71",
        "agentId": "nyra",
        "title": "Jemné rozvrácení",
        "description": "Nezničíš skupinu útokem. Zničíš ji tím, že si každý začne myslet, že ostatní něco skrývají.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_72",
        "agentId": "nyra",
        "title": "Jed v tichu",
        "description": "Některé věci není třeba říkat nahlas. Stačí je nechat v hlavě správného člověka dost dlouho.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_73",
        "agentId": "nyra",
        "title": "Noc bez odpovědí",
        "description": "Pošli sérii náznaků a pak zmiz. Nejhorší nejsou odpovědi. Nejhorší je, když žádné nepřijdou.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_74",
        "agentId": "nyra",
        "title": "Přesná slabost",
        "description": "Síla je hlučná. Slabost je tichá. Najdi ji, stiskni ji a sleduj, jak se celý člověk ohne kolem ní.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_75",
        "agentId": "nyra",
        "title": "Porušený rytmus",
        "description": "Lidé přežívají díky rutině. Znič ji a zbytek jejich jistot se začne sypat sám.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "dirty-cash": 1000
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_76",
        "agentId": "nyra",
        "title": "Místnost bez vzduchu",
        "description": "Zaveď někoho do rozhovoru, kde nebude moct lhát ani utéct. To bývá nejčistší forma násilí.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_77",
        "agentId": "nyra",
        "title": "Vzkaz pod kůži",
        "description": "Nech zprávu tam, kde ji najde jen ten správný člověk. A kde se jí nebude umět zbavit ani po přečtení.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_78",
        "agentId": "nyra",
        "title": "Vina bez svědků",
        "description": "Dnes nevyvoláš strach. Dnes vyvoláš vinu. A vina člověka rozloží zevnitř mnohem pomaleji a důkladněji.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_79",
        "agentId": "nyra",
        "title": "Pocit cizí přítomnosti",
        "description": "Uprav pár detailů a nech někoho dojít domů do prostoru, který už nebude působit jako jeho vlastní.",
        "difficulty": "medium",
        "successRate": 82,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_80",
        "agentId": "nyra",
        "title": "Tichý nátlak",
        "description": "Nátlak nemusí křičet. Stačí, když se usadí vedle člověka a dýchá mu na krk celé odpoledne.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_81",
        "agentId": "nyra",
        "title": "Narušený spánek",
        "description": "Vyčerpaný člověk se láme snáz. Připrav ho o klidnou noc a ráno už udělá chybu sám.",
        "difficulty": "easy",
        "successRate": 89,
        "durationMinutes": 11,
        "reward": {
          "influence": 3,
          "dirty-cash": 700
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "nyra_82",
        "agentId": "nyra",
        "title": "Jméno ve špatných ústech",
        "description": "Dnes rozšíříš jedno jméno přesně tam, kde ho nikdo nechce slyšet. Škody pak udělá sama jeho ozvěna.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_83",
        "agentId": "nyra",
        "title": "Dům plný ticha",
        "description": "Některá ticha nejsou klidná. Jsou nemocná. Ujisti se, že jedno takové dnes někoho doma počká.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_84",
        "agentId": "nyra",
        "title": "Úhel pohledu",
        "description": "Nepotřebuješ měnit fakta. Stačí změnit pořadí, ve kterém je někdo uslyší. A najednou z pravdy začne téct jed.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_85",
        "agentId": "nyra",
        "title": "Cizí otisk",
        "description": "Nech na místě něco, co tam nepatří. Člověk si pak zbytek scénáře dopíše sám a většinou mnohem hůř, než bychom vymysleli my.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "dirty-cash": 1000
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_86",
        "agentId": "nyra",
        "title": "Dvě verze noci",
        "description": "Stejný večer, dvě různé verze, tři různí svědci. Až se to začne srážet, nezůstane nikomu pevná půda pod nohama.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_87",
        "agentId": "nyra",
        "title": "Rozklad jistoty",
        "description": "Něčí sebevědomí stojí na jedné představě. Dnes mu ji vezmeš a necháš ho sledovat, jak se rozsype všechno okolo.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_88",
        "agentId": "nyra",
        "title": "Přesně načasované ticho",
        "description": "Někdy je nejkrutější neodpovědět. Dnes necháš ticho pracovat déle, než je pro někoho zdravé.",
        "difficulty": "easy",
        "successRate": 91,
        "durationMinutes": 11,
        "reward": {
          "influence": 3,
          "cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 660000,
        "durationTicks": 132
      },
      {
        "id": "nyra_89",
        "agentId": "nyra",
        "title": "Neviditelná trhlina",
        "description": "Na povrchu nebude vidět nic. Ale uvnitř už začne všechno praskat. To jsou moje oblíbené práce.",
        "difficulty": "medium",
        "successRate": 79,
        "durationMinutes": 17,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1020000,
        "durationTicks": 204
      },
      {
        "id": "nyra_90",
        "agentId": "nyra",
        "title": "Přítomnost bez tváře",
        "description": "Postarej se, aby někdo cítil něčí blízkost, aniž by kdy zahlédl tvář. Lidská představivost je levná a smrtelně účinná zbraň.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_91",
        "agentId": "nyra",
        "title": "Sběr slabých míst",
        "description": "Dnes neřešíš velké tajemství. Dnes posbíráš deset malých. A z těch malých se staví nejhorší klece.",
        "difficulty": "easy",
        "successRate": 88,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "dirty-cash": 1000
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_92",
        "agentId": "nyra",
        "title": "Pod kůží města",
        "description": "V každém sektoru pulzuje strach, jen ho nikdo nechce pojmenovat. Dnes mu dáš tvar a cenu.",
        "difficulty": "medium",
        "successRate": 78,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "cash": 700
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_93",
        "agentId": "nyra",
        "title": "Slovo, které zůstane",
        "description": "Vyber jednu větu, která se člověku usadí v hlavě jako střep. A pak ji řekni přesně jednou.",
        "difficulty": "easy",
        "successRate": 87,
        "durationMinutes": 12,
        "reward": {
          "influence": 3,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 720000,
        "durationTicks": 144
      },
      {
        "id": "nyra_94",
        "agentId": "nyra",
        "title": "Cizí dotek v prostoru",
        "description": "Přesuň pár věcí, nech pár stop a jednu nejasnost. Nic víc. To úplně stačí na dlouhou noc bez dechu.",
        "difficulty": "easy",
        "successRate": 86,
        "durationMinutes": 13,
        "reward": {
          "influence": 3,
          "cash": 800
        },
        "risk": {
          "successHeat": 1,
          "failureHeat": 3,
          "failureDirtyCashLoss": 0
        },
        "durationMs": 780000,
        "durationTicks": 156
      },
      {
        "id": "nyra_95",
        "agentId": "nyra",
        "title": "Hlad po odpovědi",
        "description": "Dnes někomu nedáš důkaz. Dáš mu jen dost na to, aby po zbytku začal šílet toužit.",
        "difficulty": "medium",
        "successRate": 80,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_96",
        "agentId": "nyra",
        "title": "Jedovatá blízkost",
        "description": "Nejhorší hrozby nejsou daleko. Jsou těsně vedle člověka, ve stejné místnosti, v obyčejném tónu hlasu.",
        "difficulty": "medium",
        "successRate": 85,
        "durationMinutes": 15,
        "reward": {
          "influence": 6,
          "cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 900000,
        "durationTicks": 180
      },
      {
        "id": "nyra_97",
        "agentId": "nyra",
        "title": "Vnitřní pád",
        "description": "Některé lidi není třeba srazit. Stačí jim odebrat poslední oporu a oni se zřítí sami.",
        "difficulty": "medium",
        "successRate": 77,
        "durationMinutes": 18,
        "reward": {
          "influence": 6,
          "dirty-cash": 900
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1080000,
        "durationTicks": 216
      },
      {
        "id": "nyra_98",
        "agentId": "nyra",
        "title": "Tři náznaky",
        "description": "První náznak znejistí. Druhý rozhodí. Třetí zlomí. Doruč všechny tři ve správném pořadí.",
        "difficulty": "medium",
        "successRate": 81,
        "durationMinutes": 16,
        "reward": {
          "influence": 6,
          "cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 960000,
        "durationTicks": 192
      },
      {
        "id": "nyra_99",
        "agentId": "nyra",
        "title": "Tma mezi lidmi",
        "description": "Největší temnota není v ulicích. Je mezi lidmi, kteří si přestali věřit. Rozšiř ji.",
        "difficulty": "medium",
        "successRate": 75,
        "durationMinutes": 19,
        "reward": {
          "influence": 6,
          "dirty-cash": 800
        },
        "risk": {
          "successHeat": 2,
          "failureHeat": 6,
          "failureDirtyCashLoss": 200
        },
        "durationMs": 1140000,
        "durationTicks": 228
      },
      {
        "id": "nyra_100",
        "agentId": "nyra",
        "title": "Nyřin jed",
        "description": "Zapamatuj si to. Strach je hlasitý jen na začátku. Pak ztichne, usadí se v člověku a začne ho požírat zevnitř. Dnes ten hlad nakrmíme.",
        "difficulty": "rare",
        "successRate": 65,
        "durationMinutes": 25,
        "reward": {
          "overdrive-x": 1,
          "influence": 8
        },
        "risk": {
          "successHeat": 6,
          "failureHeat": 12,
          "failureDirtyCashLoss": 600
        },
        "durationMs": 1500000,
        "durationTicks": 300
      }
    ]
  },
  "factoryRecipes": {
    "metal-parts": {
      "name": "Metal Parts",
      "inputs": {},
      "cleanMoneyCost": 300,
      "output": {
        "inventory": "materials",
        "itemId": "metal-parts",
        "amount": 1
      },
      "durationMs": 240000,
      "localOutputCap": 10,
      "queueCap": 13
    },
    "tech-core": {
      "name": "Tech Core",
      "inputs": {
        "metal-parts": 4
      },
      "cleanMoneyCost": 900,
      "output": {
        "inventory": "materials",
        "itemId": "tech-core",
        "amount": 1
      },
      "durationMs": 480000,
      "localOutputCap": 5,
      "queueCap": 8
    },
    "combat-module": {
      "name": "Bojový modul",
      "inputs": {
        "metal-parts": 4,
        "tech-core": 2
      },
      "cleanMoneyCost": 2500,
      "output": {
        "inventory": "materials",
        "itemId": "combat-module",
        "amount": 1
      },
      "durationMs": 900000,
      "localOutputCap": 2,
      "queueCap": 5
    }
  },
  "factory": {
    "maxLevel": 14,
    "upgradeBaseCost": 5000,
    "upgradeCostGrowth": 1.47,
    "upgradeRoundCostTo": 100,
    "upgradePctPerLevel": 0.1,
    "network": {
      "speedMultipliers": {
        "1": 1,
        "2": 1.1,
        "3": 1.2,
        "4": 1.3
      },
      "maxSpeedMultiplier": 1.3
    },
    "slotDurationMs": {
      "metalParts": 240000,
      "techCore": 480000,
      "combatModule": 900000
    },
    "recipes": {
      "metal-parts": {
        "name": "Metal Parts",
        "inputs": {},
        "cleanMoneyCost": 300,
        "output": {
          "inventory": "materials",
          "itemId": "metal-parts",
          "amount": 1
        },
        "durationMs": 240000,
        "localOutputCap": 10,
        "queueCap": 13
      },
      "tech-core": {
        "name": "Tech Core",
        "inputs": {
          "metal-parts": 4
        },
        "cleanMoneyCost": 900,
        "output": {
          "inventory": "materials",
          "itemId": "tech-core",
          "amount": 1
        },
        "durationMs": 480000,
        "localOutputCap": 5,
        "queueCap": 8
      },
      "combat-module": {
        "name": "Bojový modul",
        "inputs": {
          "metal-parts": 4,
          "tech-core": 2
        },
        "cleanMoneyCost": 2500,
        "output": {
          "inventory": "materials",
          "itemId": "combat-module",
          "amount": 1
        },
        "durationMs": 900000,
        "localOutputCap": 2,
        "queueCap": 5
      }
    }
  },
  "factorySlotStorageCaps": {
    "metalParts": 10,
    "techCore": 5,
    "combatModule": 2
  },
  "factorySlots": [
    {
      "id": 1,
      "recipeId": "metal-parts",
      "resourceKey": "metalParts",
      "canonicalResourceKey": "metal-parts",
      "label": "Metal Parts",
      "mode": "produce"
    },
    {
      "id": 2,
      "recipeId": "tech-core",
      "resourceKey": "techCore",
      "canonicalResourceKey": "tech-core",
      "label": "Tech Core",
      "mode": "produce"
    },
    {
      "id": 3,
      "recipeId": "combat-module",
      "resourceKey": "combatModule",
      "canonicalResourceKey": "combat-module",
      "label": "Bojový modul",
      "mode": "produce"
    }
  ],
  "storage": {
    "groups": {
      "bulk": {
        "label": "Hromadné zásoby",
        "baseCapacity": 60,
        "resourceKeys": [
          "chemicals",
          "biomass",
          "metal-parts",
          "neon-dust",
          "baseball-bat",
          "barricades"
        ]
      },
      "tactical": {
        "label": "Taktické zásoby",
        "baseCapacity": 24,
        "resourceKeys": [
          "stim-pack",
          "pulse-shot",
          "velvet-smoke",
          "tech-core",
          "pistol",
          "grenade",
          "vest",
          "cameras",
          "alarm"
        ]
      },
      "strategic": {
        "label": "Strategické zásoby",
        "baseCapacity": 8,
        "resourceKeys": [
          "combat-module",
          "ghost-serum",
          "overdrive-x",
          "smg",
          "bazooka",
          "defense-tower"
        ]
      }
    },
    "warehouseCountMultipliers": {
      "0": 1,
      "1": 1.5,
      "2": 1.6,
      "3": 1.7,
      "4": 1.8,
      "5": 1.9
    },
    "warehouseLevelMultipliers": {
      "1": 1,
      "2": 1.12,
      "3": 1.25,
      "4": 1.4
    }
  },
  "market": {
    "resources": {
      "chemicals": {
        "name": "Chemicals",
        "basePrice": 450,
        "normalMarketStartStock": 24,
        "normalMarketMaxStock": 36,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.9,
        "category": "bulk"
      },
      "biomass": {
        "name": "Biomass",
        "basePrice": 530,
        "normalMarketStartStock": 28,
        "normalMarketMaxStock": 40,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.6,
        "category": "bulk"
      },
      "metal-parts": {
        "name": "Metal Parts",
        "basePrice": 380,
        "normalMarketStartStock": 26,
        "normalMarketMaxStock": 38,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.7,
        "category": "bulk"
      },
      "stim-pack": {
        "name": "Stim Pack",
        "basePrice": 1000,
        "normalMarketStartStock": 6,
        "normalMarketMaxStock": 10,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "neon-dust": {
        "name": "Neon Dust",
        "basePrice": 1900,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 140,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "bulk"
      },
      "baseball-bat": {
        "name": "Baseballová pálka",
        "basePrice": 750,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 120,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "bulk"
      },
      "barricades": {
        "name": "Barikády",
        "basePrice": 1500,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 100,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "bulk"
      },
      "pulse-shot": {
        "name": "Pulse Shot",
        "basePrice": 3010,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 90,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "velvet-smoke": {
        "name": "Velvet Smoke",
        "basePrice": 3260,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 90,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "tech-core": {
        "name": "Tech Core",
        "basePrice": 3260,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 80,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.1,
        "category": "tactical"
      },
      "pistol": {
        "name": "Pistole",
        "basePrice": 4650,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 70,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "grenade": {
        "name": "Granát",
        "basePrice": 4190,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 70,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "vest": {
        "name": "Vesta",
        "basePrice": 4650,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 70,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "cameras": {
        "name": "Kamery",
        "basePrice": 7440,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 50,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "alarm": {
        "name": "Alarm",
        "basePrice": 4190,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 70,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 0.8,
        "category": "tactical"
      },
      "combat-module": {
        "name": "Combat Module",
        "basePrice": 12250,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 24,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.2,
        "category": "strategic"
      },
      "ghost-serum": {
        "name": "Ghost Serum",
        "basePrice": 10670,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 18,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.2,
        "category": "strategic"
      },
      "overdrive-x": {
        "name": "Overdrive X",
        "basePrice": 16490,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 18,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.2,
        "category": "strategic"
      },
      "smg": {
        "name": "SMG",
        "basePrice": 13180,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 16,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.15,
        "category": "strategic"
      },
      "bazooka": {
        "name": "Bazuka",
        "basePrice": 25890,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 8,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.3,
        "category": "strategic"
      },
      "defense-tower": {
        "name": "Obranná věž",
        "basePrice": 34260,
        "normalMarketStartStock": 0,
        "normalMarketMaxStock": 8,
        "minPriceMultiplier": 1,
        "maxPriceMultiplier": 4,
        "blackMarketMarkup": 1.55,
        "volatility": 1.3,
        "category": "strategic"
      }
    },
    "normalMarketResourceIds": [
      "chemicals",
      "biomass",
      "metal-parts",
      "stim-pack"
    ],
    "blackMarketResourceIds": [
      "tech-core",
      "combat-module",
      "neon-dust",
      "pulse-shot",
      "velvet-smoke",
      "ghost-serum",
      "overdrive-x",
      "pistol",
      "grenade",
      "smg",
      "bazooka"
    ],
    "playerMarketResourceIds": [
      "chemicals",
      "biomass",
      "metal-parts",
      "neon-dust",
      "baseball-bat",
      "barricades",
      "stim-pack",
      "pulse-shot",
      "velvet-smoke",
      "tech-core",
      "pistol",
      "grenade",
      "vest",
      "cameras",
      "alarm",
      "combat-module",
      "ghost-serum",
      "overdrive-x",
      "smg",
      "bazooka",
      "defense-tower"
    ],
    "blackMarket": {
      "dirtyCashPaymentMultiplier": 1.25,
      "minRiskFactor": 1,
      "maxRiskFactor": 2.2,
      "rotationSeconds": 1800,
      "offerCount": 2
    },
    "playerMarket": {
      "listingLimitPerSeller": 5,
      "listingTtlSecondsFree": 2700,
      "listingTtlSecondsWar": 21600,
      "minUnitPrice": 1,
      "maxUnitPriceMultiplier": 8,
      "dirtyTradeHeat": 2,
      "dirtyTradePoliceSuspicion": 1
    },
    "stockRegenPerMinute": {
      "chemicals": 1,
      "biomass": 1,
      "metal-parts": 1,
      "neon-dust": 0,
      "baseball-bat": 0,
      "barricades": 0,
      "stim-pack": 0,
      "pulse-shot": 0,
      "velvet-smoke": 0,
      "tech-core": 0,
      "pistol": 0,
      "grenade": 0,
      "vest": 0,
      "cameras": 0,
      "alarm": 0,
      "combat-module": 0,
      "ghost-serum": 0,
      "overdrive-x": 0,
      "smg": 0,
      "bazooka": 0,
      "defense-tower": 0
    },
    "largeTransactionValueFree": {
      "medium": 750,
      "high": 1800,
      "extreme": 3500
    }
  },
  "park": {
    "streetDealers": {
      "id": "street_dealers",
      "buildingTypeId": "street_dealers",
      "name": "Pouliční dealeři",
      "countOnMap": 19,
      "category": [
        "dirty_cash",
        "drug_distribution",
        "street_economy"
      ],
      "cleanCashPerMinute": 0,
      "dirtyCashPerMinute": 36,
      "influencePerMinute": 0,
      "populationPerMinute": 0,
      "heatPerMinute": 0.06,
      "noCleanCash": true,
      "noInfluence": true,
      "noPopulationProduction": true,
      "noIntelPower": true,
      "noLaundering": true,
      "noAuditRisk": true,
      "startDrugSale": {
        "actionId": "start_drug_sale"
      },
      "dealerSlots": [
        {
          "slotId": "slot-1",
          "itemId": "neon-dust"
        },
        {
          "slotId": "slot-2",
          "itemId": "pulse-shot"
        },
        {
          "slotId": "slot-3",
          "itemId": "velvet-smoke"
        }
      ],
      "sellableDrugs": [
        {
          "itemId": "neon-dust",
          "label": "Neon Dust",
          "aliases": [
            "neonDust"
          ],
          "unitSalePriceDirtyCash": 625,
          "cooldownMinutes": 4,
          "baseHeatPerUnit": 2,
          "minimumAmountPerSale": 10,
          "baseStreetRiskPct": 4
        },
        {
          "itemId": "pulse-shot",
          "label": "Pulse Shot",
          "aliases": [
            "pulseShot"
          ],
          "unitSalePriceDirtyCash": 1000,
          "cooldownMinutes": 5,
          "baseHeatPerUnit": 3,
          "minimumAmountPerSale": 10,
          "baseStreetRiskPct": 6
        },
        {
          "itemId": "velvet-smoke",
          "label": "Velvet Smoke",
          "aliases": [
            "velvetSmoke"
          ],
          "unitSalePriceDirtyCash": 1125,
          "cooldownMinutes": 6,
          "baseHeatPerUnit": 4,
          "minimumAmountPerSale": 10,
          "baseStreetRiskPct": 8
        }
      ],
      "streetIncidents": {
        "extraCooldownMinutes": 3,
        "fakeCustomerRewardPenaltyPct": 25,
        "streetConflictHeatGain": 8,
        "lostPackageAmountPct": 15,
        "maxStreetRiskPct": 35
      },
      "network": {
        "passiveDirtyIncomeBonusPctPerExtraDealer": 4,
        "saleSpeedBonusPctPerExtraDealer": 3,
        "heatBonusPctPerExtraDealer": 3,
        "maxPassiveDirtyIncomeMultiplier": 1.28,
        "maxSaleSpeedMultiplier": 1.22,
        "maxHeatMultiplier": 1.22
      }
    },
    "smugglingTunnel": {
      "countOnMap": 18,
      "cleanCashPerMinute": 0,
      "dirtyCashPerMinute": 54,
      "heatPerMinute": 0.07,
      "dirtyProductionBonusPctPerExtraTunnel": 5,
      "heatBonusPctPerExtraTunnel": 4,
      "maxDirtyProductionMultiplier": 1.35,
      "maxHeatMultiplier": 1.28,
      "dealerSupplyBonusPctPerTunnel": 4,
      "dealerSupplyMaxBonusPct": 32,
      "dealerSupplySaleSpeedSharePct": 35,
      "dealerSupplyStreetRiskReductionSharePct": 40,
      "dealerSupplyPassiveDirtyIncomeSharePct": 25,
      "dealerSupplySaleHeatRiskSharePct": 20,
      "openChannelCleanCost": 1800,
      "openChannelHeatGain": 5,
      "openChannelDurationMs": 900000,
      "openChannelCooldownMs": 1800000,
      "openChannelTunnelDirtyProductionBonusPct": 45,
      "openChannelDealerSaleSpeedBonusPct": 10,
      "openChannelDealerSaleHeatBonusPct": 15,
      "openChannelStreetIncidentFlatRiskPct": 5
    },
    "convenienceStore": {
      "id": "convenience_store",
      "buildingTypeId": "convenience_store",
      "countOnMap": 17,
      "category": [
        "economy",
        "dirty_cash",
        "rumors",
        "influence",
        "street_life"
      ],
      "cleanCashPerMinute": 32,
      "dirtyCashPerMinute": 18,
      "influencePerMinute": 0.1,
      "heatPerMinute": 0.05,
      "noSpecialActions": false,
      "noLaundering": true,
      "noAuditRisk": true,
      "populationPerMinute": 0.8333333333333334,
      "basePopulationCapacity": 50,
      "collectPopulation": {
        "actionId": "collect_convenience_store_population",
        "cooldownMinutes": 0,
        "minCollectPopulation": 30
      },
      "passiveRumorIntervalMinutes": 10,
      "maxRumorChecksPerPlayerPerInterval": 1,
      "baseRumorChancePct": 11,
      "truthChanceByOwnedCount": [
        {
          "minOwned": 1,
          "maxOwned": 2,
          "truthChancePct": 42
        },
        {
          "minOwned": 3,
          "maxOwned": 5,
          "truthChancePct": 48
        },
        {
          "minOwned": 6,
          "maxOwned": 8,
          "truthChancePct": 54
        },
        {
          "minOwned": 9,
          "maxOwned": null,
          "truthChancePct": 58
        }
      ],
      "districtHintChancePct": 22,
      "areaHintChancePct": 12,
      "buildingHintChancePct": 6,
      "rumorTypes": [
        "night_movement",
        "suspicious_purchase",
        "courier_trace",
        "small_conflict",
        "police_patrol",
        "robbery_preparation",
        "weak_defense",
        "dirty_cash_movement",
        "fake"
      ],
      "network": {
        "cleanIncomeBonusPctPerExtraStore": 3.5,
        "dirtyIncomeBonusPctPerExtraStore": 3.5,
        "influenceBonusPctPerExtraStore": 4,
        "rumorChanceBonusPctPerExtraStore": 6,
        "heatBonusPctPerExtraStore": 2,
        "maxCleanIncomeMultiplier": 1.25,
        "maxDirtyIncomeMultiplier": 1.25,
        "maxInfluenceMultiplier": 1.3,
        "maxRumorMultiplier": 1.45,
        "maxHeatMultiplier": 1.16,
        "populationPerMinuteBonusPerExtraStore": 0.08333333333333333
      },
      "restaurantSynergy": {
        "firstStoreThreshold": 3,
        "firstRestaurantThreshold": 3,
        "firstCivilRumorChanceBonusPct": 5,
        "secondStoreThreshold": 6,
        "secondRestaurantThreshold": 6,
        "secondCivilRumorChanceBonusPct": 8,
        "truthStoreThreshold": 8,
        "truthRestaurantThreshold": 10,
        "civilRumorTruthBonusPct": 5
      }
    },
    "stripClub": {
      "id": "strip_club",
      "buildingTypeId": "strip_club",
      "countOnMap": 17,
      "category": [
        "economy",
        "influence",
        "rumors",
        "social_network"
      ],
      "cleanCashPerMinute": 75,
      "dirtyCashPerMinute": 65,
      "influencePerMinute": 0.0625,
      "heatPerMinute": 0.059027777777777776,
      "noLaundering": true,
      "noAuditRisk": true,
      "passiveRumorIntervalMinutes": 30,
      "baseRumorChancePct": 100,
      "baseTruthChancePct": 55,
      "truthChancePctPerExtraClub": 3,
      "maxTruthChancePct": 75,
      "districtHintChancePct": 35,
      "buildingHintChancePct": 20,
      "rumorTypes": [
        "money",
        "relationships",
        "police",
        "attacks",
        "storage",
        "laundering",
        "fake"
      ],
      "network": {
        "incomeBonusPctPerExtraStripClub": 5,
        "influenceBonusPctPerExtraStripClub": 7,
        "rumorChanceBonusPctPerExtraStripClub": 8,
        "heatBonusPctPerExtraStripClub": 4,
        "maxIncomeMultiplier": 1.35,
        "maxInfluenceMultiplier": 1.5,
        "maxRumorMultiplier": 1.6,
        "maxHeatMultiplier": 1.28
      },
      "vipLounge": {
        "actionId": "vip_lounge",
        "cooldownMinutes": 60,
        "durationMinutes": 30,
        "cleanCashCost": 800,
        "cleanIncomeBonusPct": 45,
        "dirtyIncomeBonusPct": 35,
        "influenceBonusPct": 55,
        "heatBonusPct": 50,
        "rumorChanceFlatBonusPct": 10
      },
      "privateParty": {
        "actionId": "private_party",
        "cooldownMinutes": 30,
        "durationMinutes": 10,
        "cleanCashCost": 1500,
        "instantInfluenceGain": 8,
        "influenceProductionBonusPct": 70,
        "extraRumorChancePct": 45,
        "heatGain": 6,
        "scandalChancePct": 12,
        "scandalHeatGain": 10,
        "scandalInfluenceLoss": 4
      }
    },
    "dayNightActionRules": {
      "startDrugSale": {
        "preferredPhase": "night",
        "heatMultiplier": 1.3,
        "detectionChanceModifierPct": 10,
        "phaseEffectSummary": "Prodej je dostupný ve dne i v noci. Přes den roste heat a pouliční riziko; cena za kus zůstává pevná."
      },
      "openChannel": {
        "preferredPhase": "night",
        "heatMultiplier": 1.3,
        "detectionChanceModifierPct": 10,
        "phaseEffectSummary": "NOC BONUS: kanál je bezpečnější po setmění. Přes den roste policejní tlak a pouliční riziko."
      }
    }
  },
  "attackWeapons": {
    "baseball-bat": {
      "label": "Baseballová pálka",
      "description": "Levná základní zbraň vhodná jako doplnění slabších útoků.",
      "power": 5,
      "residents": 1
    },
    "pistol": {
      "label": "Pistole",
      "description": "Silná early-game zbraň s dobrým poměrem síly a potřebných obyvatel.",
      "power": 10,
      "residents": 1
    },
    "grenade": {
      "label": "Granát",
      "description": "Silný burst za jednoho obyvatele proti dobře bráněným districtům.",
      "power": 14,
      "residents": 1
    },
    "smg": {
      "label": "SMG",
      "description": "Silná zbraň pro důležité útoky, která vyžaduje dva obyvatele.",
      "power": 18,
      "residents": 2
    },
    "bazooka": {
      "label": "Bazuka",
      "description": "Nejsilnější těžká zbraň. Vysoká síla je vykoupena třemi obyvateli.",
      "power": 30,
      "residents": 3
    }
  }
});

export const PHARMACY_RECIPES = BROWSER_GAMEPLAY_CONFIG.pharmacyRecipes;
export const DRUGLAB_RECIPES = BROWSER_GAMEPLAY_CONFIG.drugLabRecipes;
export const ARMORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.armoryRecipes;
export const PLAYER_BOOST_CONFIG = BROWSER_GAMEPLAY_CONFIG.playerBoosts;
export const CITY_EVENT_CONFIG = BROWSER_GAMEPLAY_CONFIG.cityEvents;
export const FACTORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.factoryRecipes;
export const FACTORY_CONFIG = BROWSER_GAMEPLAY_CONFIG.factory;
export const FACTORY_SLOT_STORAGE_CAPS = BROWSER_GAMEPLAY_CONFIG.factorySlotStorageCaps;
export const FACTORY_SLOT_CONFIG = BROWSER_GAMEPLAY_CONFIG.factorySlots;
export const WAREHOUSE_STORAGE_CONFIG = BROWSER_GAMEPLAY_CONFIG.storage;
export const MARKET_CONFIG = BROWSER_GAMEPLAY_CONFIG.market;
export const ATTACK_SETUP_WEAPONS = BROWSER_GAMEPLAY_CONFIG.attackWeapons;
export const STREET_DEALERS_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.streetDealers;
export const SMUGGLING_TUNNEL_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.smugglingTunnel;
export const CONVENIENCE_STORE_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.convenienceStore;
export const STRIP_CLUB_CONFIG = BROWSER_GAMEPLAY_CONFIG.park.stripClub;
export const PARK_DAY_NIGHT_ACTION_RULES = BROWSER_GAMEPLAY_CONFIG.park.dayNightActionRules;
