export const PRODUCTION_BUILDING_CONFIG = Object.freeze({
  pharmacy: Object.freeze({
    label: "Lékárna",
    title: "Výroba látek",
    upgradeBaseCost: 3200,
    infoText: "Lékárna vyrábí základní materiály pro Lab: Chemicals, Biomass a Stim Pack.",
    infoActions: Object.freeze(["Každá linka vyrábí položky po jednom kuse.", "⇪ Level mění pouze rychlost výroby.", "Hotové položky se vyzvedávají do globálního SKLADU."])
  }),
  druglab: Object.freeze({
    label: "Lab",
    title: "Výroba drug balíků",
    upgradeBaseCost: 4200,
    infoText: "Lab vyrábí laboratorní látky a komponenty pro Ghost Network, Industrial Overdrive a Tactical Grid.",
    infoActions: Object.freeze(["Každá látka má vlastní výrobní linku.", "⇪ Level mění pouze rychlost výroby.", "Ghost Serum a Overdrive X se spotřebovávají pouze při aktivaci strategického boostu."])
  }),
  armory: Object.freeze({
    label: "Zbrojovka",
    title: "Výroba výzbroje",
    upgradeBaseCost: 5200,
    infoText: "Zbrojovka vyrábí útočné i obranné vybavení z Metal Parts, Tech Core a Combat Module.",
    infoActions: Object.freeze(["Každý cyklus vyrobí právě jeden kus.", "⇪ Level a síť mění pouze rychlost výroby.", "High-tier recepty spotřebovávají Combat Module z globálního SKLADU."])
  })
});

export const PRODUCTION_RESOURCE_LABELS = Object.freeze({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "stim-pack": "Stim Pack",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core",
  "combat-module": "Bojový modul",
  "neon-dust": "Neon Dust",
  "pulse-shot": "Pulse Shot",
  "velvet-smoke": "Velvet Smoke",
  "ghost-serum": "Ghost Serum",
  "overdrive-x": "Overdrive X",
  "baseball-bat": "Baseballová pálka",
  pistol: "Pistole",
  grenade: "Granát",
  smg: "SMG",
  bazooka: "Bazuka",
  vest: "Vesta",
  barricades: "Barikády",
  cameras: "Kamery",
  "defense-tower": "Obranná věž",
  alarm: "Alarm"
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
