// GENERATED FILE. Run `npm run generate:browser-config`; do not edit balance values here.
// Sources: free-mode-pharmacy-config.ts, free-mode-drug-lab-config.ts, free-mode-factory-config.ts, free-mode-armory-config.ts, free-mode-warehouse-config.ts, free-mode-attack-weapons-config.ts.
export const BROWSER_GAMEPLAY_CONFIG = Object.freeze({
  "generatedFrom": [
    "free-mode-pharmacy-config.ts",
    "free-mode-drug-lab-config.ts",
    "free-mode-factory-config.ts",
    "free-mode-armory-config.ts",
    "free-mode-warehouse-config.ts",
    "free-mode-attack-weapons-config.ts"
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
      "queueCap": 8
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
      "queueCap": 6
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
      "queueCap": 3
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
      "queueCap": 8
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
      "queueCap": 5
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
      "queueCap": 4
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
      "queueCap": 2
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
      "queueCap": 1
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
      "queueCap": 6
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
      "queueCap": 4
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
      "queueCap": 4
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
      "queueCap": 3
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
      "queueCap": 2
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
      "queueCap": 4
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
      "queueCap": 5
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
      "queueCap": 4
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
      "queueCap": 2
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
      "queueCap": 4
    }
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
      "queueCap": 8
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
      "queueCap": 4
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
      "queueCap": 2
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
        "queueCap": 8
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
        "queueCap": 4
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
        "queueCap": 2
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
export const FACTORY_RECIPES = BROWSER_GAMEPLAY_CONFIG.factoryRecipes;
export const FACTORY_CONFIG = BROWSER_GAMEPLAY_CONFIG.factory;
export const FACTORY_SLOT_STORAGE_CAPS = BROWSER_GAMEPLAY_CONFIG.factorySlotStorageCaps;
export const FACTORY_SLOT_CONFIG = BROWSER_GAMEPLAY_CONFIG.factorySlots;
export const WAREHOUSE_STORAGE_CONFIG = BROWSER_GAMEPLAY_CONFIG.storage;
export const ATTACK_SETUP_WEAPONS = BROWSER_GAMEPLAY_CONFIG.attackWeapons;
