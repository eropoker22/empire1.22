// Compatibility bridge for legacy static pages.
// Authoritative gameplay faction balance lives in packages/game-config/src/public/faction-definitions.ts.

export const FACTION_WEAPON_PRESETS = Object.freeze({});

export const FACTION_CATALOG = Object.freeze({
  mafian: createFactionCatalogEntry({
    id: "mafian",
    name: "Mafián",
    tagline: "Staré peníze, staré krytí.",
    description: "Stabilní ekonomika, výpalné a vliv na správných dveřích.",
    playstyleSummary: "Economy / clean cash / influence / heat control mimo obsazování",
    advantages: ["Clean income +10 %", "-4 % heat z útoků, heistů, akcí budov a pasivního tlaku"],
    disadvantages: ["Spy success chance -3 p. b."],
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
    }
  }),
  kartel: createFactionCatalogEntry({
    id: "kartel",
    name: "Kartel",
    tagline: "Prachy tečou rychle. Krev taky.",
    description: "Kartel staví impérium na dirty cash, drogách a pašování. Vydělává rychleji z ilegálních zdrojů a jeho produkce jede tvrději než u ostatních frakcí. Každá zásilka má ale stopu: Kartel generuje víc policejního tlaku, hůř vydělává čisté peníze a při obraně území není tak pevný.",
    playstyleSummary: "Dirty cash / illegal production / drugs / smuggling / high risk economy",
    advantages: [
      "+18 % dirty income",
      "+15 % produkce v podporovaných ilegálních budovách",
      "+10 % pašování"
    ],
    disadvantages: [
      "+15 % heat z ilegálních akcí",
      "-8 % clean income",
      "-5 % defense power"
    ],
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
        "Heat hráče +12.",
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
    }
  }),
  kult: createFactionCatalogEntry({
    id: "kult",
    name: "Kult",
    tagline: "Město se zlomí vírou.",
    description: "Kult roste skrz vliv, loajalitu a strach. Přitahuje víc lidí, lépe drží obsazené districty a dokáže město zaplavit neklidem. Není ale silný v čisté ekonomice ani v přímém útoku.",
    playstyleSummary: "Influence / population / defense / manipulation / city feed chaos",
    advantages: [
      "+20 % influence gain",
      "+10 % population generation",
      "+10 % defense power"
    ],
    plannedAdvantages: [
        "Silnější práce s drby / podezřením"
    ],
    disadvantages: [
      "-10 % clean income",
      "-5 % attack power"
    ],
    plannedDisadvantages: ["+10 % market fee"],
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
        "Aktivní zisk vlivu +35 %.",
        "Aktivní generování populace +20 %.",
        "Aktivní síla obrany +10 %.",
        "Přidá player heat nebo district heat.",
        "Vytvoří suspicion-style city feed event.",
        "Nestackuje se.",
        "Nedává instant cash.",
        "Nedává instant resources.",
        "Neruší raids.",
        "Neblokuje útoky.",
        "Suggested cost: influence 30."
      ]
    }
  }),
  "tajna-organizace": createFactionCatalogEntry({
    id: "tajna-organizace",
    name: "Tajná organizace",
    tagline: "Nevidíš nás. Jen následky.",
    description: "Tajná organizace ovládá město přes infiltrace, špehování, falešné stopy a spící buňky. Má přesnější informace, lépe odhaluje pasti a dokáže provádět tajné operace s menším policejním tlakem. V otevřené válce ale ztrácí sílu.",
    playstyleSummary: "Spying / infiltration / traps / secret actions / false information / low heat",
    advantages: [
      "+15 % šance na úspěšné špehování",
      "+15 % šance odhalit pasti",
      "+10 % kvalita intel/drbů"
    ],
    plannedAdvantages: [
      "+15 % kvalita informací ze špehování",
      "-8 % heat z tajných akcí"
    ],
    disadvantages: [
      "-10 % attack power",
      "-8 % clean income",
      "-8 % dirty income"
    ],
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
        "Síla útoku nepřítele -15 %.",
        "Síla obsazení nepřítele -15 %.",
        "Ztráty nepřítele +10 %.",
        "Čekání nepřítele +180 sekund.",
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
    }
  }),
  hackeri: createFactionCatalogEntry({
    id: "hackeri",
    name: "Hackeři",
    tagline: "Kdo ovládá data, ovládá válku.",
    description: "Hackeři nevyhrávají přes hrubou sílu. Čtou město přes kamery, alarmy, datová centra a potvrzené drby. Jejich informace jsou výrazně spolehlivější a jejich technická obrana je silnější než u ostatních frakcí. V otevřeném boji ale ztrácí.",
    playstyleSummary: "Tech / confirmed rumors / cameras / alarms / spying / digital sabotage",
    advantages: [
      "+50 % pravdivost rumorů s truthChancePct",
      "+15 % účinnost kamer",
      "+15 % účinnost alarmů",
      "+10 % tech production",
      "+10 % šance na úspěšné špehování"
    ],
    disadvantages: [
      "-8 % attack power",
      "-8 % dirty income",
      "-5 % základní obrana bez kamer/alarmů"
    ],
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
        "Účinnost kamer cíle -20 %.",
        "Účinnost alarmu cíle -20 %.",
        "Spy against target chance bonus 0.15.",
        "Robbery against target chance bonus 0.10.",
        "Heat hráče +4.",
        "Neodhaluje pasti automaticky.",
        "Nevypíná toxic traps.",
        "Negarantuje úspěšné špehování.",
        "Negarantuje úspěšné vykradení.",
        "Neruší raids.",
        "Neodstraňuje heat.",
        "Nestackuje se na stejném cíli.",
        "Suggested cost: tech core 1 + influence 15."
      ]
    }
  }),
  "motorkarsky-gang": createFactionCatalogEntry({
    id: "motorkarsky-gang",
    name: "Motorkářský gang",
    tagline: "Rychlost zabíjí.",
    description: "Motorkáři nehrají na trpělivost. Vyráží rychle, berou co najdou a mizí dřív, než se město vzpamatuje. Mají kratší cooldowny na agresivní akce a víc vydělají z vykrádání. Jenže držet území není jejich silná stránka a rychlý chaos zanechává větší policejní stopu.",
    playstyleSummary: "Speed / robbery / attacks / pressure / dirty cash",
    advantages: [
      "-15 % cooldown na vykrádání",
      "-10 % cooldown na útoky",
      "-10 % cooldown na obsazování",
      "+10 % dirty cash z vykrádání"
    ],
    disadvantages: [
      "-10 % obrana districtů",
      "+8 % heat z útoků, obsazování a vykrádání"
    ],
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
        "Další agresivní akce trvá o 40 % méně.",
        "Další vykradení dá loot +15 %.",
        "Další útok má sílu +10 %.",
        "Další agresivní akce přidá heat +15 %.",
        "Nestackuje se.",
        "Vyprší po omezené době, pokud se nepoužije.",
        "Cooldown: medium.",
        "Suggested cost: dirty cash + influence."
      ]
    }
  }),
  "soukroma-armada": createFactionCatalogEntry({
    id: "soukroma-armada",
    name: "Soukromá armáda",
    tagline: "Když diplomacie selže, přijde faktura.",
    description: "Soukromá armáda nehraje na pouliční chaos. Nasazuje vycvičené jednotky, taktiku a přesilu. Je silnější v útoku, lépe brání districty a při obsazování ztrácí méně vybavení. Profesionální násilí je ale drahé a viditelné.",
    playstyleSummary: "Combat / defense / occupation / territory control / expensive operations",
    advantages: [
      "+12 % attack power",
      "+12 % defense power",
      "-10 % ztráty vybavení v boji"
    ],
    plannedAdvantages: ["+10 % síla při obsazování"],
    disadvantages: [
      "+8 % heat z útoků a obsazování",
      "-8 % clean income"
    ],
    plannedDisadvantages: ["+12 % upkeep / combat cost"],
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
        "Další bojová akce má sílu +25 %.",
        "Další obsazení má sílu +25 %.",
        "Další bojové ztráty -20 %.",
        "Další bojový heat +15 %.",
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
    }
  }),
  korporace: createFactionCatalogEntry({
    id: "korporace",
    name: "Korporát",
    tagline: "Zločin je špinavý. Moc je legální.",
    description: "Korporát nevlastní ulice přes strach, ale přes smlouvy, právníky, bezpečnostní systémy a účty, které nikdo nechce kontrolovat. Vydělává silněji z čisté ekonomiky, lépe obchoduje a dokáže zmírnit následky policejního tlaku. V pouliční špíně ale ztrácí tempo.",
    playstyleSummary: "Clean economy / legal cover / defense systems / market efficiency / safer growth",
    advantages: [
      "+15 % clean income",
      "-3 % heat z útoků, heistů, akcí budov a pasivního tlaku",
      "+10 % efekt obranných systémů"
    ],
    plannedAdvantages: ["-10 % market fee"],
    disadvantages: [
      "-15 % dirty income",
      "-10 % loot z vykrádání",
      "+10 % délka útoků"
    ],
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
        "Další následky raidu -35 %.",
        "Duration: 1200 sekund.",
        "Cooldown: 3600 sekund.",
        "Neruší razii.",
        "Nesnižuje aktuální heat.",
        "Neodstraňuje pending raid.",
        "Neodstraňuje aktivní raid.",
        "Nestackuje se.",
        "Musí zůstat slabší než mitigace Soudu.",
        "Pokud během duration nepřijde razie, efekt vyprší.",
        "Suggested cost: clean cash 3000 + influence 20."
      ]
    }
  })
});

function createFactionCatalogEntry(input) {
  return Object.freeze({
    id: input.id,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    playstyleSummary: input.playstyleSummary,
    advantages: Object.freeze([...(input.advantages || [])]),
    plannedAdvantages: Object.freeze([...(input.plannedAdvantages || [])]),
    disadvantages: Object.freeze([...(input.disadvantages || [])]),
    plannedDisadvantages: Object.freeze([...(input.plannedDisadvantages || [])]),
    coreBackedEffects: Object.freeze([...(input.passiveEffectSummary || input.advantages || [])]),
    plannedEffects: Object.freeze([...(input.plannedPassiveEffectSummary || input.plannedAdvantages || [])]),
    specialAction: input.specialAction ? Object.freeze({
      ...input.specialAction,
      intendedFutureEffect: Object.freeze([...(input.specialAction.intendedFutureEffect || [])])
    }) : null
  });
}
