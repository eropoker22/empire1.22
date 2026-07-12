import type { AttackWeaponsBalanceConfig } from "@empire/game-core";

export const freeModeAttackWeaponsConfig: AttackWeaponsBalanceConfig = {
  "baseball-bat": {
    label: "Baseballová pálka",
    description: "Levná základní zbraň vhodná jako doplnění slabších útoků.",
    baseAttackPower: 5,
    populationRequired: 1
  },
  pistol: {
    label: "Pistole",
    description: "Silná early-game zbraň s dobrým poměrem síly a potřebných obyvatel.",
    baseAttackPower: 10,
    populationRequired: 1
  },
  grenade: {
    label: "Granát",
    description: "Silný burst za jednoho obyvatele proti dobře bráněným districtům.",
    baseAttackPower: 14,
    populationRequired: 1
  },
  smg: {
    label: "SMG",
    description: "Silná zbraň pro důležité útoky, která vyžaduje dva obyvatele.",
    baseAttackPower: 18,
    populationRequired: 2
  },
  bazooka: {
    label: "Bazuka",
    description: "Nejsilnější těžká zbraň. Vysoká síla je vykoupena třemi obyvateli.",
    baseAttackPower: 30,
    populationRequired: 3
  }
};
