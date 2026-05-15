import type { FactionDefinition, PlayerFactionId } from "@empire/shared-types";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";

export const DEFAULT_PLAYER_FACTION_ID: PlayerFactionId = "mafian";

export const FACTION_DEFINITIONS: readonly FactionDefinition[] = [
  {
    id: "mafian",
    name: "Mafián",
    tagline: "Staré peníze, staré krytí.",
    description: "Stabilní ekonomika, výpalné a vliv na správných dveřích.",
    playstyleSummary: "Bezpečnější růst přes clean cash a legální budovy.",
    strengths: ["clean cash", "legální income", "heat management"],
    weaknesses: ["slabší tech", "slabší špehování"],
    startingPackage: { cash: 250, dirtyCash: 40, attackLoadout: { pistol: 1 }, initialInfluence: 6 },
    passiveModifiers: { cleanIncomeMultiplier: 1.1, heatGainMultiplier: 0.96, spySuccessChanceBonus: -0.03 },
    passiveEffectSummary: ["Clean income +10 %", "Heat gain -4 %", "Spy -3 p. b."],
    uiTheme: { accent: "#d7b46a", glow: "rgba(215,180,106,.45)", surface: "rgba(38,30,22,.92)", glyph: "M" },
    recommendedFor: "hráče, kteří chtějí stabilní start a kontrolu tempa",
    difficulty: "snadná"
  },
  {
    id: "kartel",
    name: "Kartel",
    tagline: "Rychlá špína, rychlý problém.",
    description: "Dirty cash, drogy a pašování, které svítí policii do očí.",
    playstyleSummary: "Agresivní cashflow za cenu vyššího heatu.",
    strengths: ["dirty cash", "ilegální produkce", "smuggling"],
    weaknesses: ["vyšší heat", "větší policejní tlak"],
    startingPackage: { cash: 100, dirtyCash: 180, resources: { chemicals: 3 }, attackLoadout: { pistol: 1 }, initialHeat: 3 },
    passiveModifiers: { dirtyIncomeMultiplier: 1.15, illegalProductionMultiplier: 1.1, heatGainMultiplier: 1.08 },
    passiveEffectSummary: ["Dirty income +15 %", "Illegal production +10 %", "Heat gain +8 %"],
    uiTheme: { accent: "#ff3f5f", glow: "rgba(255,63,95,.5)", surface: "rgba(42,14,22,.94)", glyph: "K" },
    recommendedFor: "hráče, kteří chtějí rychlé prachy a zvládnou tlak",
    difficulty: "střední"
  },
  {
    id: "kult",
    name: "Kult",
    tagline: "Víra je munice.",
    description: "Fanatismus, influence a tvrdé držení districtů.",
    playstyleSummary: "Kontrola území přes influence, obranu a retenci lidí.",
    strengths: ["influence", "obrana districtů", "retence populace"],
    weaknesses: ["slabší clean economy", "pomalejší cash start"],
    startingPackage: { cash: 80, dirtyCash: 60, defenseLoadout: { barricades: 1 }, initialInfluence: 14 },
    passiveModifiers: { influenceGainMultiplier: 1.15, defensePowerMultiplier: 1.05, cleanIncomeMultiplier: 0.95 },
    passiveEffectSummary: ["Influence +15 %", "Defense +5 %", "Clean income -5 %"],
    uiTheme: { accent: "#a855f7", glow: "rgba(168,85,247,.48)", surface: "rgba(31,19,45,.94)", glyph: "K" },
    recommendedFor: "hráče, kteří chtějí držet území a dusit okolí",
    difficulty: "střední"
  },
  {
    id: "tajna-organizace",
    name: "Tajná organizace",
    tagline: "Nevidíš je. To je pointa.",
    description: "Špehování, infiltrace a menší stopa v policejních systémech.",
    playstyleSummary: "Intel a nízká viditelnost místo hrubé síly.",
    strengths: ["spy", "nízký heat", "kvalita informací"],
    weaknesses: ["slabší přímý combat", "menší startovní síla"],
    startingPackage: { cash: 150, dirtyCash: 70, resources: { "tech-core": 1 }, defenseLoadout: { cameras: 1 } },
    passiveModifiers: { spySuccessChanceBonus: 0.1, heatGainMultiplier: 0.92, rumorTruthMultiplier: 1.1, attackPowerMultiplier: 0.95 },
    passiveEffectSummary: ["Spy +10 p. b.", "Heat gain -8 %", "Attack power -5 %"],
    uiTheme: { accent: "#67e8f9", glow: "rgba(103,232,249,.44)", surface: "rgba(8,30,42,.94)", glyph: "T" },
    recommendedFor: "hráče, kteří chtějí vědět víc než ostatní",
    difficulty: "těžká"
  },
  {
    id: "hackeri",
    name: "Hackeři",
    tagline: "Město je jen špatně zamčený terminál.",
    description: "Data, sabotage, market intel a asymetrická válka.",
    playstyleSummary: "Tech produkce a intel za cenu slabší fyzické obrany.",
    strengths: ["tech core", "intel", "market"],
    weaknesses: ["slabší fyzická defense", "méně přímá síla"],
    startingPackage: { cash: 120, dirtyCash: 60, resources: { "tech-core": 2, "metal-parts": 1 }, defenseLoadout: { cameras: 1 } },
    passiveModifiers: { techProductionMultiplier: 1.1, spySuccessChanceBonus: 0.08, marketFeeMultiplier: 0.95, defensePowerMultiplier: 0.95 },
    passiveEffectSummary: ["Tech production +10 %", "Spy/intel +8 p. b.", "Defense -5 %"],
    uiTheme: { accent: "#22d3ee", glow: "rgba(34,211,238,.48)", surface: "rgba(8,27,34,.94)", glyph: "H" },
    recommendedFor: "hráče, kteří rádi hrají přes data a trh",
    difficulty: "těžká"
  },
  {
    id: "motorkarsky-gang",
    name: "Motorkářský gang",
    tagline: "Rychle dovnitř. Rychle ven.",
    description: "Mobilita, early aggression a špinavé malé výhody.",
    playstyleSummary: "Rychlejší útoky a heisty, ale horší stabilita obrany.",
    strengths: ["rychlé útoky", "raid tempo", "dirty cash"],
    weaknesses: ["slabší defense", "horší dlouhá stabilita"],
    startingPackage: { cash: 80, dirtyCash: 140, attackLoadout: { "baseball-bat": 2, pistol: 1 }, initialHeat: 2 },
    passiveModifiers: { attackDurationMultiplier: 0.92, dirtyIncomeMultiplier: 1.05, defensePowerMultiplier: 0.95 },
    passiveEffectSummary: ["Attack duration -8 %", "Dirty income +5 %", "Defense -5 %"],
    uiTheme: { accent: "#f97316", glow: "rgba(249,115,22,.46)", surface: "rgba(45,24,12,.94)", glyph: "B" },
    recommendedFor: "hráče, kteří chtějí early tlak a tempo",
    difficulty: "střední"
  },
  {
    id: "soukroma-armada",
    name: "Soukromá armáda",
    tagline: "Když diplomacie krvácí, přijde kontrakt.",
    description: "Combat, obrana, vybavení a tvrdé držení mapy.",
    playstyleSummary: "Silnější útok i obrana za cenu vyšších provozních problémů.",
    strengths: ["attack power", "defense power", "menší ztráty vybavení"],
    weaknesses: ["vyšší heat", "vyšší náklady"],
    startingPackage: { cash: 100, dirtyCash: 50, attackLoadout: { pistol: 2 }, defenseLoadout: { vest: 1, barricades: 1 }, initialHeat: 3 },
    passiveModifiers: { attackPowerMultiplier: 1.05, defensePowerMultiplier: 1.1, equipmentLossMultiplier: 0.95, heatGainMultiplier: 1.05 },
    passiveEffectSummary: ["Attack +5 %", "Defense +10 %", "Heat gain +5 %"],
    uiTheme: { accent: "#ef4444", glow: "rgba(239,68,68,.5)", surface: "rgba(40,18,18,.94)", glyph: "S" },
    recommendedFor: "hráče, kteří chtějí řešit mapu silou",
    difficulty: "snadná"
  },
  {
    id: "korporace",
    name: "Korporace",
    tagline: "Legální zločin je pořád zločin.",
    description: "Finance, downtown páky a čisté cashflow s úsměvem v obleku.",
    playstyleSummary: "Nejsilnější clean economy, slabší dirty tempo a pomalejší boj.",
    strengths: ["clean cash", "finance budovy", "downtown synergy"],
    weaknesses: ["dirty income", "pomalejší early combat"],
    startingPackage: { cash: 300, resources: { "tech-core": 1 }, initialInfluence: 5 },
    passiveModifiers: { cleanIncomeMultiplier: 1.15, dirtyIncomeMultiplier: 0.92, attackDurationMultiplier: 1.05, marketFeeMultiplier: 0.9 },
    passiveEffectSummary: ["Clean income +15 %", "Dirty income -8 %", "Attack duration +5 %"],
    uiTheme: { accent: "#60a5fa", glow: "rgba(96,165,250,.46)", surface: "rgba(13,25,44,.94)", glyph: "C" },
    recommendedFor: "hráče, kteří chtějí ekonomickou převahu",
    difficulty: "snadná"
  }
] as const;

export const FACTION_DEFINITION_BY_ID: Record<PlayerFactionId, FactionDefinition> =
  Object.fromEntries(FACTION_DEFINITIONS.map((definition) => [definition.id, definition])) as Record<PlayerFactionId, FactionDefinition>;

export const LEGACY_FACTION_ID_MAP: Record<string, PlayerFactionId> = {
  mafia: "mafian",
  mafian: "mafian",
  cartel: "kartel",
  kartel: "kartel",
  cult: "kult",
  kult: "kult",
  "tajna-organizace": "tajna-organizace",
  secret: "tajna-organizace",
  hackers: "hackeri",
  hackeri: "hackeri",
  "motorkarsky-gang": "motorkarsky-gang",
  bikers: "motorkarsky-gang",
  "soukroma-armada": "soukroma-armada",
  military: "soukroma-armada",
  corporation: "korporace",
  korporace: "korporace"
};

export const isPlayerFactionId = (value: unknown): value is PlayerFactionId =>
  PLAYER_FACTION_IDS.includes(value as PlayerFactionId);

export const normalizePlayerFactionId = (
  value: unknown,
  fallback: PlayerFactionId = DEFAULT_PLAYER_FACTION_ID
): PlayerFactionId => {
  const normalized = String(value || "").trim().toLowerCase();
  return LEGACY_FACTION_ID_MAP[normalized] ?? (isPlayerFactionId(normalized) ? normalized : fallback);
};

export const getCanonicalFactionDefinition = (factionId: unknown): FactionDefinition =>
  FACTION_DEFINITION_BY_ID[normalizePlayerFactionId(factionId)];
