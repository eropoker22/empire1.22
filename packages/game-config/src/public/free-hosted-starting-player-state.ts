import type {
  HostedStartingMaterialId,
  HostedStartingPlayerStateView
} from "@empire/shared-types";

export const FREE_HOSTED_STARTING_MATERIAL_GROUPS = Object.freeze([
  Object.freeze({
    id: "pharmacy",
    label: "Lékárna",
    materials: Object.freeze([
      Object.freeze({ id: "chemicals", label: "Chemicals" }),
      Object.freeze({ id: "biomass", label: "Biomass" }),
      Object.freeze({ id: "stim-pack", label: "Stim Pack" })
    ])
  }),
  Object.freeze({
    id: "drug-lab",
    label: "Lab",
    materials: Object.freeze([
      Object.freeze({ id: "neon-dust", label: "Neon Dust" }),
      Object.freeze({ id: "pulse-shot", label: "Pulse Shot" }),
      Object.freeze({ id: "velvet-smoke", label: "Velvet Smoke" }),
      Object.freeze({ id: "ghost-serum", label: "Ghost Serum" }),
      Object.freeze({ id: "overdrive-x", label: "Overdrive X" })
    ])
  }),
  Object.freeze({
    id: "factory",
    label: "Továrna",
    materials: Object.freeze([
      Object.freeze({ id: "metal-parts", label: "Metal Parts" }),
      Object.freeze({ id: "tech-core", label: "Tech Core" }),
      Object.freeze({ id: "combat-module", label: "Bojový modul" })
    ])
  }),
  Object.freeze({
    id: "armory",
    label: "Zbrojovka",
    materials: Object.freeze([
      Object.freeze({ id: "baseball-bat", label: "Baseballová pálka" }),
      Object.freeze({ id: "pistol", label: "Pistole" }),
      Object.freeze({ id: "grenade", label: "Granát" }),
      Object.freeze({ id: "smg", label: "SMG" }),
      Object.freeze({ id: "bazooka", label: "Bazuka" }),
      Object.freeze({ id: "vest", label: "Vesta" }),
      Object.freeze({ id: "barricades", label: "Barikády" }),
      Object.freeze({ id: "cameras", label: "Kamery" }),
      Object.freeze({ id: "defense-tower", label: "Obranná věž" }),
      Object.freeze({ id: "alarm", label: "Alarm" })
    ])
  })
] as const);

export const FREE_HOSTED_STARTING_MATERIAL_IDS = Object.freeze(
  FREE_HOSTED_STARTING_MATERIAL_GROUPS.flatMap((group) =>
    group.materials.map((material) => material.id)
  )
) as readonly HostedStartingMaterialId[];

export const FREE_HOSTED_STARTING_PLAYER_STATE: HostedStartingPlayerStateView = Object.freeze({
  cleanCash: 1_500,
  dirtyCash: 300,
  population: 0,
  spySlots: 2,
  materials: Object.freeze({
    chemicals: 10,
    biomass: 6,
    "stim-pack": 0,
    "neon-dust": 0,
    "pulse-shot": 0,
    "velvet-smoke": 0,
    "ghost-serum": 0,
    "overdrive-x": 0,
    "metal-parts": 8,
    "tech-core": 2,
    "combat-module": 0,
    "baseball-bat": 0,
    pistol: 2,
    grenade: 0,
    smg: 1,
    bazooka: 0,
    vest: 0,
    barricades: 0,
    cameras: 0,
    "defense-tower": 0,
    alarm: 0
  })
});

export const copyFreeHostedStartingPlayerState = (): HostedStartingPlayerStateView => ({
  ...FREE_HOSTED_STARTING_PLAYER_STATE,
  materials: { ...FREE_HOSTED_STARTING_PLAYER_STATE.materials }
});
