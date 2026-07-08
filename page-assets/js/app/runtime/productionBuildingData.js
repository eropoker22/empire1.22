export const PRODUCTION_BUILDING_CONFIG = Object.freeze({
  pharmacy: Object.freeze({
    label: "Lékárna",
    title: "Výroba látek",
    upgradeBaseCost: 3200,
    outputCap: 15,
    queueCap: 15,
    queueCapPerExtraBuilding: 4,
    outputCapPerWarehouse: 5,
    infoText: "Lékárna vyrábí základní materiály pro Lab: Chemicals, Biomass a Stim Pack.",
    infoActions: Object.freeze(["+ Vybrat hotové patří do serverového production/collect flow.", "⇪ Každý level zvedá serverovou produkci a craft rychlost o 10%.", "Chemicals, Biomass a Stim Pack napájí recepty v Labu."])
  }),
  druglab: Object.freeze({
    label: "Lab",
    title: "Výroba drug balíků",
    upgradeBaseCost: 4200,
    outputCap: 15,
    queueCap: 15,
    queueCapPerExtraBuilding: 4,
    outputCapPerWarehouse: 5,
    infoText: "Lab míchá výrobu z Lékarny do drog a podpůrných směsí pro další byznys a boost.",
    infoActions: Object.freeze(["+ Vybrat hotové patří do serverového production/collect flow.", "⇪ Každý level zvedá serverovou produkci a craft rychlost o 10%.", "Lab spotřebovává Chemicals, Biomass a Stim Pack z materiálového skladu."])
  }),
  armory: Object.freeze({
    label: "Zbrojovka",
    title: "Výroba výzbroje",
    upgradeBaseCost: 5200,
    outputCap: 15,
    queueCap: 15,
    queueCapPerExtraBuilding: 4,
    outputCapPerWarehouse: 5,
    infoText: "Zbrojovka vyrábí útočnou i obrannou výzbroj z Metal Parts a Tech Core.",
    infoActions: Object.freeze(["+ Vybrat hotové patří do serverového craft flow.", "⇪ Každý level zvedá serverovou craft rychlost o 10%.", "Zbrojovka bere Metal Parts a Tech Core z materiálového skladu."])
  })
});

export const PRODUCTION_RESOURCE_LABELS = Object.freeze({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "stim-pack": "Stim Pack",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Bojový modul"
});

export const PRODUCTION_SLOT_VISUALS = Object.freeze({
  pharmacy: Object.freeze({
    chemicals: Object.freeze({ slotClass: "pharmacy-slot--cyan", iconToneClass: "pharmacy-slot__icon--cyan", iconGlyphClass: "pharmacy-slot__icon--flask", productLabel: "Materiál" }),
    biomass: Object.freeze({ slotClass: "pharmacy-slot--green", iconToneClass: "pharmacy-slot__icon--green", iconGlyphClass: "pharmacy-slot__icon--leaf", productLabel: "Materiál" }),
    "stim-pack": Object.freeze({ slotClass: "pharmacy-slot--violet", iconToneClass: "pharmacy-slot__icon--violet", iconGlyphClass: "pharmacy-slot__icon--capsule", productLabel: "Materiál" })
  }),
  druglab: Object.freeze({
    "neon-dust": Object.freeze({ iconToneClass: "drug-production-slot__icon--violet", iconGlyphClass: "drug-production-slot__icon--crystal", productLabel: "" }),
    "pulse-shot": Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--powder", productLabel: "" }),
    "velvet-smoke": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--drop", productLabel: "" }),
    "ghost-serum": Object.freeze({ iconToneClass: "drug-production-slot__icon--green", iconGlyphClass: "drug-production-slot__icon--flask", productLabel: "" }),
    "overdrive-x": Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--capsule", productLabel: "" })
  }),
  armory: Object.freeze({
    "baseball-bat": Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" }),
    pistol: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" }),
    grenade: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" }),
    smg: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" }),
    bazooka: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair" }),
    vest: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate" }),
    barricades: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate" }),
    cameras: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate" }),
    "defense-tower": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate" }),
    alarm: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--crate" })
  })
});
