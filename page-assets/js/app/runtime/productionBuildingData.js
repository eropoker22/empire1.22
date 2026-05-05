export const PRODUCTION_BUILDING_CONFIG = Object.freeze({
  pharmacy: Object.freeze({
    label: "Lékárna",
    title: "Výroba látek",
    upgradeBaseCost: 3200,
    infoText: "Lékárna drží základní chemické vstupy pro další výrobu. Je to první vrstva produkčního řetězce mezi materiálem a finálním produktem.",
    infoActions: Object.freeze(["+ Vybrat hotové přesune dokončené dávky do skladu materiálů.", "⇪ Upgrade zvyšuje rychlost výroby celé budovy o 10 % za level.", "Chemicals, Biomass a Stim Pack napájí recepty v Labu."])
  }),
  druglab: Object.freeze({
    label: "Lab",
    title: "Výroba drug balíků",
    upgradeBaseCost: 4200,
    infoText: "Lab přetváří látky z Lékárny na finální balíky pro distribuci. Vyšší level zkracuje craft a zrychluje obrat celé nelegální produkce.",
    infoActions: Object.freeze(["+ Vybrat hotové přesune dokončené balíky do skladu drog.", "⇪ Upgrade zvyšuje rychlost craftu všech receptů v Labu.", "Lab spotřebovává Chemicals, Biomass a Stim Pack z materiálového skladu."])
  }),
  armory: Object.freeze({
    label: "Zbrojovka",
    title: "Výroba výzbroje",
    upgradeBaseCost: 5200,
    infoText: "Zbrojovka převádí Metal Parts a Tech Core na útočné i obranné vybavení. Je to hlavní zdroj výzbroje pro útoky i defense loadouty districtů.",
    infoActions: Object.freeze(["+ Vybrat hotové přesune zbraně do skladu výzbroje.", "⇪ Upgrade zvyšuje rychlost výroby zbrojovky o 10 % za level.", "Zbrojovka bere Metal Parts a Tech Core z materiálového skladu."])
  })
});

export const PRODUCTION_RESOURCE_LABELS = Object.freeze({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "stim-pack": "Stim Pack",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Combat Module"
});

export const PRODUCTION_SLOT_VISUALS = Object.freeze({
  pharmacy: Object.freeze({
    chemicals: Object.freeze({ slotClass: "pharmacy-slot--cyan", iconToneClass: "pharmacy-slot__icon--cyan", iconGlyphClass: "pharmacy-slot__icon--flask", productLabel: "Materiál" }),
    biomass: Object.freeze({ slotClass: "pharmacy-slot--green", iconToneClass: "pharmacy-slot__icon--green", iconGlyphClass: "pharmacy-slot__icon--leaf", productLabel: "Materiál" }),
    "stim-pack": Object.freeze({ slotClass: "pharmacy-slot--violet", iconToneClass: "pharmacy-slot__icon--violet", iconGlyphClass: "pharmacy-slot__icon--capsule", productLabel: "Materiál" })
  }),
  druglab: Object.freeze({
    "neon-dust": Object.freeze({ iconToneClass: "drug-production-slot__icon--violet", iconGlyphClass: "drug-production-slot__icon--crystal", productLabel: "Drug balík" }),
    "pulse-shot": Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--powder", productLabel: "Drug balík" }),
    "velvet-smoke": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--drop", productLabel: "Drug balík" }),
    "ghost-serum": Object.freeze({ iconToneClass: "drug-production-slot__icon--green", iconGlyphClass: "drug-production-slot__icon--flask", productLabel: "Drug balík" }),
    "overdrive-x": Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--capsule", productLabel: "Drug balík" })
  }),
  armory: Object.freeze({
    "baseball-bat": Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crate", productLabel: "Attack" }),
    pistol: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Attack" }),
    grenade: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--powder", productLabel: "Attack" }),
    smg: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Attack" }),
    bazooka: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Attack" }),
    vest: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" }),
    barricades: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate", productLabel: "Defense" }),
    cameras: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--chip", productLabel: "Defense" }),
    "defense-tower": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" }),
    alarm: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" })
  })
});
