import type { FactionDefinition, PlayerFactionId } from "@empire/shared-types";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";

export const DEFAULT_PLAYER_FACTION_ID: PlayerFactionId = "mafian";

export const FACTION_DEFINITIONS: readonly FactionDefinition[] = [
  {
    id: "mafian",
    name: "Mafián",
    tagline: "Staré peníze, staré krytí.",
    description: "Stabilní ekonomika, výpalné a vliv na správných dveřích.",
    playstyleSummary: "Economy / clean cash / influence / heat control mimo obsazování",
    strengths: ["clean cash", "legální income", "heat management mimo obsazování"],
    weaknesses: ["slabší tech", "slabší špehování"],
    passiveModifiers: { cleanIncomeMultiplier: 1.1, heatGainMultiplier: 0.96, spySuccessChanceBonus: -0.03 },
    passiveEffectSummary: ["Clean income +10 %", "-4 % heat z útoků, heistů, akcí budov a pasivního tlaku", "Spy -3 p. b."],
    specialAction: {
      name: "Tichá dohoda",
      description: "Mafián zatlačí na správné kontakty a na krátký čas sníží nový policejní heat ze svých akcí.",
      status: "preview",
      intendedFutureEffect: [
        "Sníží nový heat gain o 35 % na omezenou dobu.",
        "Neodstraňuje existující heat.",
        "Neruší pending raids.",
        "Neruší aktivní raids.",
        "Nestackuje se."
      ]
    },
    uiTheme: { accent: "#d7b46a", glow: "rgba(215,180,106,.45)", surface: "rgba(38,30,22,.92)", glyph: "M" },
    recommendedFor: "hráče, kteří chtějí stabilní ekonomiku a kontrolu tempa",
    difficulty: "snadná"
  },
  {
    id: "kartel",
    name: "Kartel",
    tagline: "Prachy tečou rychle. Krev taky.",
    description: "Kartel staví impérium na dirty cash, drogách a pašování. Vydělává rychleji z ilegálních zdrojů a jeho produkce jede tvrději než u ostatních frakcí. Každá zásilka má ale stopu: Kartel generuje víc policejního tlaku, hůř vydělává čisté peníze a při obraně území není tak pevný.",
    playstyleSummary: "Dirty cash / illegal production / drugs / smuggling / high risk economy",
    strengths: ["dirty cash", "ilegální produkce", "drogy", "pašování", "high risk economy"],
    weaknesses: ["víc heat z ilegálních akcí", "slabší clean income", "slabší defense"],
    passiveModifiers: {
      dirtyIncomeMultiplier: 1.18,
      illegalProductionMultiplier: 1.15,
      smugglingIncomeMultiplier: 1.1,
      illegalActionHeatGainMultiplier: 1.15,
      cleanIncomeMultiplier: 0.92,
      defensePowerMultiplier: 0.95
    },
    passiveEffectSummary: [
      "+18 % dirty income",
      "+15 % produkce v podporovaných ilegálních budovách",
      "+10 % pašování",
      "+15 % heat z ilegálních akcí",
      "-8 % clean income",
      "-5 % defense power"
    ],
    specialAction: {
      name: "Noční zásilka",
      description: "Kartel spustí riskantní zásilku přes město. Přinese dirty cash podle vlastněné ilegální sítě, ale výrazně zvýší policejní heat.",
      status: "preview",
      intendedFutureEffect: [
        "Instant dirty cash reward podle vlastněných illegal/smuggling/drug buildings.",
        "Base dirty cash 500.",
        "Dirty cash per illegal building 100.",
        "Dirty cash per smuggling building 150.",
        "Dirty cash per drug building 120.",
        "Player heat gain 12.",
        "District heat gain 3 na relevantní vlastněný illegal district, pokud to pipeline podporuje.",
        "Vytvoří suspicion-style city feed event, pokud to pipeline podporuje.",
        "Cooldown: 2700 sekund.",
        "Nedává clean cash.",
        "Nedává okamžité resources.",
        "Nesnižuje heat.",
        "Neruší raids.",
        "Nestackuje se.",
        "Suggested cost: influence 15."
      ]
    },
    uiTheme: { accent: "#ff3f5f", glow: "rgba(255,63,95,.5)", surface: "rgba(42,14,22,.94)", glyph: "K" },
    recommendedFor: "hráče, kteří chtějí rychlé prachy a zvládnou tlak",
    difficulty: "střední"
  },
  {
    id: "kult",
    name: "Kult",
    tagline: "Město se zlomí vírou.",
    description: "Kult roste skrz vliv, loajalitu a strach. Přitahuje víc lidí, lépe drží obsazené districty a dokáže město zaplavit neklidem. Není ale silný v čisté ekonomice ani v přímém útoku.",
    playstyleSummary: "Influence / population / defense / manipulation / city feed chaos",
    strengths: ["influence", "population", "defense", "manipulace", "drby / podezření"],
    weaknesses: ["slabší clean economy", "slabší přímý útok", "vyšší market fee připravujeme"],
    passiveModifiers: {
      influenceGainMultiplier: 1.2,
      populationGenerationMultiplier: 1.1,
      defensePowerMultiplier: 1.1,
      rumorGenerationMultiplier: 1.1,
      cleanIncomeMultiplier: 0.9,
      marketFeeMultiplier: 1.1,
      attackPowerMultiplier: 0.95
    },
    passiveEffectSummary: [
      "+20 % influence gain",
      "+10 % population generation",
      "+10 % defense power",
      "-10 % clean income",
      "-5 % attack power"
    ],
    plannedPassiveEffectSummary: [
      "Silnější práce s drby / podezřením",
      "+10 % market fee"
    ],
    specialAction: {
      name: "Masová posedlost",
      description: "Kult rozpoutá v ulicích fanatickou vlnu oddanosti. Na krátký čas posílí vliv, růst populace a obranu, ale přitáhne policejní pozornost.",
      status: "preview",
      intendedFutureEffect: [
        "Duration: 600 sekund.",
        "Cooldown: 2400 sekund.",
        "Aktivní influence gain multiplier 1.35.",
        "Aktivní population generation multiplier 1.20.",
        "Aktivní defense power multiplier 1.10.",
        "Přidá player heat nebo district heat.",
        "Vytvoří suspicion-style city feed event.",
        "Nestackuje se.",
        "Nedává instant cash.",
        "Nedává instant resources.",
        "Neruší raids.",
        "Neblokuje útoky.",
        "Suggested cost: influence 30."
      ]
    },
    uiTheme: { accent: "#a855f7", glow: "rgba(168,85,247,.48)", surface: "rgba(31,19,45,.94)", glyph: "K" },
    recommendedFor: "hráče, kteří chtějí držet území a dusit okolí",
    difficulty: "střední"
  },
  {
    id: "tajna-organizace",
    name: "Tajná organizace",
    tagline: "Nevidíš nás. Jen následky.",
    description: "Tajná organizace ovládá město přes infiltrace, špehování, falešné stopy a spící buňky. Má přesnější informace, lépe odhaluje pasti a dokáže provádět tajné operace s menším policejním tlakem. V otevřené válce ale ztrácí sílu.",
    playstyleSummary: "Spying / infiltration / traps / secret actions / false information / low heat",
    strengths: ["špehování", "infiltrace", "traps", "tajné akce", "false information", "low heat"],
    weaknesses: ["slabší přímý boj", "slabší clean income", "slabší dirty income"],
    passiveModifiers: {
      spySuccessChanceBonus: 0.15,
      spyInfoQualityMultiplier: 1.15,
      trapDetectionChanceBonus: 0.15,
      secretActionHeatGainMultiplier: 0.92,
      rumorTruthMultiplier: 1.1,
      attackPowerMultiplier: 0.9,
      cleanIncomeMultiplier: 0.92,
      dirtyIncomeMultiplier: 0.92
    },
    passiveEffectSummary: [
      "+15 % šance na úspěšné špehování",
      "+15 % šance odhalit pasti",
      "+10 % kvalita intel/drbů",
      "-10 % attack power",
      "-8 % clean income",
      "-8 % dirty income"
    ],
    plannedPassiveEffectSummary: [
      "+15 % kvalita informací ze špehování",
      "-8 % heat z tajných akcí"
    ],
    specialAction: {
      name: "Spící buňka",
      description: "Tajná organizace skrytě aktivuje buňku ve vlastním districtu. První nepřátelský útok nebo pokus o obsazení bude oslabený a pro útočníka dražší.",
      status: "preview",
      intendedFutureEffect: [
        "Target: jeden vlastněný district.",
        "Duration: 1800 sekund.",
        "Cooldown: 3600 sekund.",
        "Cost: influence 25 + clean cash 1000.",
        "Trigger: nepřítel zaútočí na chráněný district.",
        "Trigger: nepřítel se pokusí obsadit chráněný district.",
        "Enemy attack power multiplier 0.85.",
        "Enemy occupy power multiplier 0.85.",
        "Enemy loss multiplier 1.10.",
        "Enemy cooldown penalty 180 sekund.",
        "Efekt se po triggeru spotřebuje.",
        "Lze položit jen na vlastněný district.",
        "Nestackuje se na stejném districtu.",
        "Nenahrazuje toxic trap mechaniku.",
        "Neobchází existující trap mechaniky.",
        "Neodstraňuje heat.",
        "Neruší raids.",
        "Není globálně viditelná.",
        "Nemá být běžně odhalená rumory.",
        "Může být naznačená jen high-quality spyingem, pokud to spy systém podporuje.",
        "Vyprší, pokud se nepoužije."
      ]
    },
    uiTheme: { accent: "#67e8f9", glow: "rgba(103,232,249,.44)", surface: "rgba(8,30,42,.94)", glyph: "T" },
    recommendedFor: "hráče, kteří chtějí vědět víc než ostatní",
    difficulty: "těžká"
  },
  {
    id: "hackeri",
    name: "Hackeři",
    tagline: "Kdo ovládá data, ovládá válku.",
    description: "Hackeři nevyhrávají přes hrubou sílu. Čtou město přes kamery, alarmy, datová centra a potvrzené drby. Jejich informace jsou výrazně spolehlivější a jejich technická obrana je silnější než u ostatních frakcí. V otevřeném boji ale ztrácí.",
    playstyleSummary: "Tech / confirmed rumors / cameras / alarms / spying / digital sabotage",
    strengths: ["tech", "confirmed rumors", "cameras", "alarms", "spying", "digital sabotage"],
    weaknesses: ["slabší attack power", "slabší dirty income", "slabší základní obrana bez kamer/alarmů"],
    passiveModifiers: {
      rumorTruthMultiplier: 1.5,
      cameraEffectivenessMultiplier: 1.15,
      alarmEffectivenessMultiplier: 1.15,
      techProductionMultiplier: 1.1,
      spySuccessChanceBonus: 0.1,
      attackPowerMultiplier: 0.92,
      dirtyIncomeMultiplier: 0.92,
      baseDefensePowerMultiplier: 0.95
    },
    passiveEffectSummary: [
      "+50 % pravdivost rumorů s truthChancePct",
      "+15 % účinnost kamer",
      "+15 % účinnost alarmů",
      "+10 % tech production",
      "+10 % šance na úspěšné špehování",
      "-8 % attack power",
      "-8 % dirty income",
      "-5 % základní obrana bez kamer/alarmů"
    ],
    specialAction: {
      name: "Výpadek systému",
      description: "Hackeři naruší cílový district. Na krátký čas oslabí kamery, alarmy a technickou obranu cíle, čímž zvýší šanci na úspěšné špehování nebo vykradení.",
      status: "preview",
      intendedFutureEffect: [
        "Target: enemy district.",
        "Duration: 600 sekund.",
        "Cooldown: 2400 sekund.",
        "Target camera effectiveness multiplier 0.80.",
        "Target alarm effectiveness multiplier 0.80.",
        "Spy against target chance bonus 0.15.",
        "Robbery against target chance bonus 0.10.",
        "Player heat gain 4.",
        "Neodhaluje pasti automaticky.",
        "Nevypíná toxic traps.",
        "Negarantuje úspěšné špehování.",
        "Negarantuje úspěšné vykradení.",
        "Neruší raids.",
        "Neodstraňuje heat.",
        "Nestackuje se na stejném cíli.",
        "Suggested cost: tech core 1 + influence 15."
      ]
    },
    uiTheme: { accent: "#22d3ee", glow: "rgba(34,211,238,.48)", surface: "rgba(8,27,34,.94)", glyph: "H" },
    recommendedFor: "hráče, kteří rádi hrají přes data a trh",
    difficulty: "těžká"
  },
  {
    id: "motorkarsky-gang",
    name: "Motorkářský gang",
    tagline: "Rychlost zabíjí.",
    description: "Motorkáři nehrají na trpělivost. Vyráží rychle, berou co najdou a mizí dřív, než se město vzpamatuje. Mají kratší cooldowny na agresivní akce a víc vydělají z vykrádání. Jenže držet území není jejich silná stránka a rychlý chaos zanechává větší policejní stopu.",
    playstyleSummary: "Speed / robbery / attacks / pressure / dirty cash",
    strengths: ["rychlé cooldowny", "vykrádání", "útoky", "map pressure", "dirty cash"],
    weaknesses: ["slabší obrana districtů", "vyšší heat z útoků, obsazování a vykrádání"],
    passiveModifiers: {
      robberyCooldownMultiplier: 0.85,
      attackCooldownMultiplier: 0.9,
      occupyCooldownMultiplier: 0.9,
      robberyDirtyCashLootMultiplier: 1.1,
      defensePowerMultiplier: 0.9,
      aggressiveActionHeatGainMultiplier: 1.08
    },
    passiveEffectSummary: [
      "-15 % cooldown na vykrádání",
      "-10 % cooldown na útoky",
      "-10 % cooldown na obsazování",
      "+10 % dirty cash z vykrádání",
      "-10 % obrana districtů",
      "+8 % heat z útoků, obsazování a vykrádání"
    ],
    specialAction: {
      name: "Bleskový nájezd",
      description: "Gang vyrazí do ulic bez varování. Další vykradení nebo útok proběhne výrazně rychleji a silněji, ale vygeneruje víc heat.",
      status: "preview",
      intendedFutureEffect: [
        "Platí na další vykradení nebo útok.",
        "Další agresivní akce duration multiplier 0.60.",
        "Další robbery loot multiplier 1.15.",
        "Další attack power multiplier 1.10.",
        "Další aggressive action heat multiplier 1.15.",
        "Nestackuje se.",
        "Vyprší po omezené době, pokud se nepoužije.",
        "Cooldown: medium.",
        "Suggested cost: dirty cash + influence."
      ]
    },
    uiTheme: { accent: "#f97316", glow: "rgba(249,115,22,.46)", surface: "rgba(45,24,12,.94)", glyph: "B" },
    recommendedFor: "hráče, kteří chtějí early tlak a tempo",
    difficulty: "střední"
  },
  {
    id: "soukroma-armada",
    name: "Soukromá armáda",
    tagline: "Když diplomacie selže, přijde faktura.",
    description: "Soukromá armáda nehraje na pouliční chaos. Nasazuje vycvičené jednotky, taktiku a přesilu. Je silnější v útoku, lépe brání districty a při obsazování ztrácí méně vybavení. Profesionální násilí je ale drahé a viditelné.",
    playstyleSummary: "Combat / defense / occupation / territory control / expensive operations",
    strengths: ["attack power", "defense power", "combat losses", "occupation", "territory control"],
    weaknesses: ["vyšší upkeep / combat cost", "vyšší heat z agresivních akcí", "slabší clean income"],
    passiveModifiers: {
      attackPowerMultiplier: 1.12,
      defensePowerMultiplier: 1.12,
      equipmentLossMultiplier: 0.9,
      occupyPowerMultiplier: 1.1,
      upkeepCostMultiplier: 1.12,
      aggressiveActionHeatGainMultiplier: 1.08,
      cleanIncomeMultiplier: 0.92
    },
    passiveEffectSummary: [
      "+12 % attack power",
      "+12 % defense power",
      "-10 % ztráty vybavení v boji",
      "+8 % heat z útoků a obsazování",
      "-8 % clean income"
    ],
    plannedPassiveEffectSummary: [
      "+10 % síla při obsazování",
      "+12 % upkeep / combat cost"
    ],
    specialAction: {
      name: "Taktické nasazení",
      description: "Soukromá armáda spustí profesionální zásah. Další útok nebo obsazení districtu získá výrazný bojový bonus a nižší ztráty, ale vygeneruje více heat.",
      status: "preview",
      intendedFutureEffect: [
        "Platí pouze na další útok nebo obsazení districtu.",
        "Neplatí na vykrádání.",
        "Next combat action power multiplier 1.25.",
        "Next occupy power multiplier 1.25.",
        "Next combat loss multiplier 0.80.",
        "Next combat heat multiplier 1.15.",
        "Duration: 900 sekund.",
        "Cooldown: 2700 sekund.",
        "Nestackuje se.",
        "Vyprší, pokud se nepoužije.",
        "Negarantuje vítězství.",
        "Neobchází pasti.",
        "Neruší efekty nepřátelských pastí.",
        "Neodstraňuje heat.",
        "Neruší raids.",
        "Suggested cost: clean cash 2000 + dirty cash 500 + influence 15."
      ]
    },
    uiTheme: { accent: "#ef4444", glow: "rgba(239,68,68,.5)", surface: "rgba(40,18,18,.94)", glyph: "S" },
    recommendedFor: "hráče, kteří chtějí řešit mapu silou",
    difficulty: "snadná"
  },
  {
    id: "korporace",
    name: "Korporát",
    tagline: "Zločin je špinavý. Moc je legální.",
    description: "Korporát nevlastní ulice přes strach, ale přes smlouvy, právníky, bezpečnostní systémy a účty, které nikdo nechce kontrolovat. Vydělává silněji z čisté ekonomiky, lépe obchoduje a dokáže zmírnit následky policejního tlaku. V pouliční špíně ale ztrácí tempo.",
    playstyleSummary: "Clean economy / legal cover / defense systems / market efficiency / safer growth",
    strengths: ["clean economy", "legal cover", "defense systems", "market efficiency", "safer growth"],
    weaknesses: ["dirty income", "robbery loot", "delší útoky"],
    passiveModifiers: {
      cleanIncomeMultiplier: 1.15,
      heatGainMultiplier: 0.97,
      defenseSystemEffectivenessMultiplier: 1.1,
      marketFeeMultiplier: 0.9,
      dirtyIncomeMultiplier: 0.85,
      robberyLootMultiplier: 0.9,
      attackDurationMultiplier: 1.1
    },
    passiveEffectSummary: [
      "+15 % clean income",
      "-3 % heat z útoků, heistů, akcí budov a pasivního tlaku",
      "+10 % efekt obranných systémů",
      "-15 % dirty income",
      "-10 % loot z vykrádání",
      "+10 % délka útoků"
    ],
    plannedPassiveEffectSummary: ["-10 % market fee"],
    specialAction: {
      name: "Právní štít",
      description: "Korporát aktivuje právníky, compliance tým a krizové krytí. Další policejní razie má mírnější následky, ale není zrušena.",
      status: "preview",
      intendedFutureEffect: [
        "Platí pouze na další policejní razii.",
        "Next raid consequence multiplier 0.65.",
        "Duration: 1200 sekund.",
        "Cooldown: 3600 sekund.",
        "Neruší razii.",
        "Nesnižuje aktuální heat.",
        "Neodstraňuje pending raid.",
        "Neodstraňuje active raid.",
        "Nestackuje se.",
        "Musí zůstat slabší než mitigace Soudu.",
        "Pokud během duration nepřijde razie, efekt vyprší.",
        "Suggested cost: clean cash 3000 + influence 20."
      ]
    },
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
