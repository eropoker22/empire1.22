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
    advantages: ["Čistý příjem +10 %", "-4 % heat z útoků, loupeží, akcí budov a pasivního tlaku"],
    disadvantages: ["Špehování -3 p. b."],
    passiveEffectSummary: ["Čistý příjem +10 %", "-4 % heat z útoků, loupeží, akcí budov a pasivního tlaku", "Špehování -3 p. b."],
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
      "+18 % špinavý příjem",
      "+15 % produkce v podporovaných ilegálních budovách",
      "+10 % pašování"
    ],
    disadvantages: [
      "+15 % heat z ilegálních akcí",
      "-8 % čistý příjem",
      "-5 % síla obrany"
    ],
    passiveEffectSummary: [
      "+18 % špinavý příjem",
      "+15 % produkce v podporovaných ilegálních budovách",
      "+10 % pašování",
      "+15 % heat z ilegálních akcí",
      "-8 % čistý příjem",
      "-5 % síla obrany"
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
      "+20 % zisk vlivu",
      "+10 % tvorba populace",
      "+10 % síla obrany"
    ],
    plannedAdvantages: [
        "Silnější práce s drby a podezřením"
    ],
    disadvantages: [
      "-10 % čistý příjem",
      "-5 % síla útoku"
    ],
    plannedDisadvantages: ["+10 % poplatek na trhu"],
    passiveEffectSummary: [
      "+20 % zisk vlivu",
      "+10 % tvorba populace",
      "+10 % síla obrany",
      "-10 % čistý příjem",
      "-5 % síla útoku"
    ],
    plannedPassiveEffectSummary: [
      "Silnější práce s drby a podezřením",
      "+10 % poplatek na trhu"
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
      "+10 % pravdivost potvrzených drbů"
    ],
    plannedAdvantages: [
      "+15 % kvalita informací ze špehování",
      "-8 % heat z tajných akcí"
    ],
    disadvantages: [
      "-10 % síla útoku",
      "-8 % čistý příjem",
      "-8 % špinavý příjem"
    ],
    passiveEffectSummary: [
      "+15 % šance na úspěšné špehování",
      "+15 % šance odhalit pasti",
      "+10 % pravdivost potvrzených drbů",
      "-10 % síla útoku",
      "-8 % čistý příjem",
      "-8 % špinavý příjem"
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
      "+50 % pravdivost potvrzených drbů",
      "+15 % účinnost kamer",
      "+15 % účinnost alarmů",
      "+10 % produkce technologií",
      "+10 % šance na úspěšné špehování"
    ],
    disadvantages: [
      "-8 % síla útoku",
      "-8 % špinavý příjem",
      "-5 % základní obrana bez kamer a alarmů"
    ],
    passiveEffectSummary: [
      "+50 % pravdivost potvrzených drbů",
      "+15 % účinnost kamer",
      "+15 % účinnost alarmů",
      "+10 % produkce technologií",
      "+10 % šance na úspěšné špehování",
      "-8 % síla útoku",
      "-8 % špinavý příjem",
      "-5 % základní obrana bez kamer a alarmů"
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
      "-15 % doba čekání na vykrádání",
      "-10 % doba čekání na útoky",
      "-10 % doba čekání na obsazování",
      "+10 % špinavé peníze z vykrádání"
    ],
    disadvantages: [
      "-10 % obrana districtů",
      "+8 % heat z útoků, obsazování a vykrádání"
    ],
    passiveEffectSummary: [
      "-15 % doba čekání na vykrádání",
      "-10 % doba čekání na útoky",
      "-10 % doba čekání na obsazování",
      "+10 % špinavé peníze z vykrádání",
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
      "+12 % síla útoku",
      "+12 % síla obrany",
      "-10 % ztráty vybavení v boji",
      "+10 % síla při obsazování"
    ],
    disadvantages: [
      "+8 % heat z útoků a obsazování",
      "-8 % čistý příjem"
    ],
    plannedDisadvantages: ["+12 % náklady na údržbu a boj"],
    passiveEffectSummary: [
      "+12 % síla útoku",
      "+12 % síla obrany",
      "-10 % ztráty vybavení v boji",
      "+10 % síla při obsazování",
      "+8 % heat z útoků a obsazování",
      "-8 % čistý příjem"
    ],
    plannedPassiveEffectSummary: [
      "+12 % náklady na údržbu a boj"
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
      "+15 % čistý příjem",
      "-3 % heat z útoků, loupeží, akcí budov a pasivního tlaku",
      "+10 % efekt obranných systémů"
    ],
    plannedAdvantages: ["-10 % poplatek na trhu"],
    disadvantages: [
      "-15 % špinavý příjem",
      "-10 % kořist z vykrádání",
      "+10 % délka útoků"
    ],
    passiveEffectSummary: [
      "+15 % čistý příjem",
      "-3 % heat z útoků, loupeží, akcí budov a pasivního tlaku",
      "+10 % efekt obranných systémů",
      "-15 % špinavý příjem",
      "-10 % kořist z vykrádání",
      "+10 % délka útoků"
    ],
    plannedPassiveEffectSummary: ["-10 % poplatek na trhu"],
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
