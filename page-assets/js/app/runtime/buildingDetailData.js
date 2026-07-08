import {
  ARMORY_POPUP_OPEN_SELECTOR,
  DRUGLAB_POPUP_OPEN_SELECTOR,
  FACTORY_POPUP_OPEN_SELECTOR,
  PHARMACY_POPUP_OPEN_SELECTOR
} from "./constants.js";

export const BUILDING_POPUP_TARGETS = Object.freeze([
  Object.freeze({
    label: "Lékárna",
    openSelector: PHARMACY_POPUP_OPEN_SELECTOR,
    lookupKeys: Object.freeze(["lekarna", "pharmacy"])
  }),
  Object.freeze({
    label: "Drug lab",
    openSelector: DRUGLAB_POPUP_OPEN_SELECTOR,
    lookupKeys: Object.freeze(["drug lab", "druglab", "lab"])
  }),
  Object.freeze({
    label: "Továrna",
    openSelector: FACTORY_POPUP_OPEN_SELECTOR,
    lookupKeys: Object.freeze(["tovarna", "factory"])
  }),
  Object.freeze({
    label: "Zbrojovka",
    openSelector: ARMORY_POPUP_OPEN_SELECTOR,
    lookupKeys: Object.freeze(["zbrojovka", "armory"])
  })
]);


const GARAGE_DETAIL_PROFILE = Object.freeze({
  role: "Logistika",
  info: "Garáž je pasivní logistické zázemí. Generuje clean cash, zvedá heat a každá vlastněná garáž zkracuje cooldowny útoků, obsazení districtů, district loupeží a části support akcí.",
  actions: Object.freeze([])
});

export const DISTRICT_BUILDING_DETAIL_PROFILES = Object.freeze({
  "bytovy blok": Object.freeze({
    role: "Členové gangu",
    info: "Bytový blok negeneruje cash ani heat. Jen lidi. A v tomhle městě jsou lidi palivo každé války.",
    actions: Object.freeze(["Vybrat obyvatele"])
  }),
  garage: GARAGE_DETAIL_PROFILE,
  garaz: GARAGE_DETAIL_PROFILE,
  "rekrutacni centrum": Object.freeze({
    role: "Nábor",
    info: "Rekrutační centrum není zdroj populace. Bere lidi z bytových bloků a dělá z nich použitelný gang. Posiluje nábor, kapacitu zázemí a bojovou hodnotu výbavy.",
    actions: Object.freeze([])
  }),
  klinika: Object.freeze({
    role: "Recovery",
    info: "Klinika drží gang při životě. Sama nevyrábí zbraně ani lidi, ale přes Stabilizační protokol vrací část čerstvých ztrát zpět do hry, než recovery pool vyprší.",
    actions: Object.freeze(["Stabilizační protokol"])
  }),
  skola: Object.freeze({
    role: "Vzdělání",
    info: "Škola pomalu přidává populaci a malé clean cash. Večerní kurz dočasně zrychlí nábor členů v bytových blocích.",
    actions: Object.freeze(["Večerní kurz"])
  }),
  restaurace: Object.freeze({
    role: "Lokální cashflow",
    info: "Restaurace generuje prachy a funguje jako místo pro schůzky všeho druhu.",
    actions: Object.freeze(["Vybrat tržby", "Krýt schůzky", "Posílit lokální síť"])
  }),
  "fitness club": Object.freeze({
    role: "Síla gangu",
    info: "Fitness Club generuje čistý příjem a posiluje fyzickou sílu útoku i obrany. Nezískáš víc lidí. Získáš tvrdší lidi. Rezavé činky, rozbité zrcadlo a trenér, který nepočítá opakování, ale přežití.",
    actions: Object.freeze([])
  }),
  herna: Object.freeze({
    role: "Dirty cash",
    info: "Herna je pouliční cashflow a menší pračka. Vyrábí clean i dirty cash, síť heren zvedá výnos a limit praní, ale akce přidávají heat a audit risk.",
    actions: Object.freeze(["Noční automaty", "Zadní pokladna"])
  }),
  smenarna: Object.freeze({
    role: "Praní peněz",
    info: "Směnárna pere menší částky bezpečněji než kasino. Jedna směnárna je služba. Síť směnáren je finanční pavouk přes celé město.",
    actions: Object.freeze(["Výhodný kurz"])
  }),
  autosalon: Object.freeze({
    role: "Mobilita",
    info: "Autosalon generuje peníze a zlepšuje mobilitu gangu. Lesklé kapoty vpředu, falešné smlouvy vzadu a klíče od aut, která nikdy neuvidí papíry. Autosalon není jen showroom. Je to strategická budova k mobilitě hráče.",
    actions: Object.freeze([])
  }),
  "obchodni centrum": Object.freeze({
    role: "Market",
    info: "Obchodní centrum generuje peníze, menší dirty cash, vliv a snižuje ceny na marketu. Výlohy svítí, kasy pípají a pod parkovištěm se domlouvají dohody, které nikdy neuvidíš na účtence.",
    actions: Object.freeze([])
  }),
  kasino: Object.freeze({
    role: "High-risk praní",
    info: "Kasino není jen místo, kde se hraje. Je to neonová pračka peněz, politická kancelář a past na chamtivé hráče. Kdo ho drží, bohatne rychle. Kdo pere moc, skončí pod reflektory policie.",
    actions: Object.freeze(["Tichá herna", "VIP noc", "Podplacený inspektor"])
  }),
  "poulicni dealeri": Object.freeze({
    role: "Distribuce",
    info: "Pouliční dealeři generují slabší dirty cash a prodávají látky z Drug Labu za špinavé peníze. Lab vyrobí produkt. Pouliční dealeři ho promění v peníze.",
    actions: Object.freeze(["Spustit prodej", "Vybrat hot cash", "Přesunout stash"])
  }),
  vecerka: Object.freeze({
    role: "Pouliční provoz",
    info: "Večerka generuje malé čisté peníze, drobné dirty cash, trochu vlivu a lokální pouliční drby. Zářivky bzučí, dveře pípají a kamera nad regálem vidí víc, než by měla.",
    actions: Object.freeze([])
  }),
  "pasovaci tunel": Object.freeze({
    role: "Pašování",
    info: "Pašovací tunel je přísun špinavých peněz a tepna pouliční distribuce. Lab vyrobí látky. Dealeři je prodají. Tunely drží proud peněz a zboží dostatečně temný na to, aby město nevidělo, odkud opravdu přichází.",
    actions: Object.freeze(["Otevřít kanál"])
  }),
  burza: Object.freeze({
    role: "Ultra rare / economy / market control / financial power",
    info: "Burza je jediná na mapě. Neprodává zboží. Ovládá ceny, poplatky a rytmus celé ekonomiky. Skleněná věž v Downtownu, kde se války nevedou noži, ale grafy.",
    actions: Object.freeze(["Spekulativní nákup", "Tržní tlak", "Insider Window"])
  }),
  "centralni banka": Object.freeze({
    role: "Ultra rare / finance / reserve / market stability",
    info: "Centrální banka drží rezervy města pod zámkem. Kdo ovládá likviditu, přežije i drahou krizi.",
    actions: Object.freeze(["Likviditní injekce", "Zmrazené účty", "Kurzovní intervence"])
  }),
  magistrat: Object.freeze({
    role: "Ultra rare / politics / city control / heat management",
    info: "Magistrát není gangová základna. Je to místo, kde se zločin mění na razítko. Kdo drží magistrát, nemusí mít vždy větší zbraň. Stačí, když má správný podpis.",
    actions: Object.freeze(["Úřední krytí", "Městská zakázka", "Nouzová vyhláška"])
  }),
  "lobby klub": Object.freeze({
    role: "Ultra rare / lobbying / influence / political support",
    info: "Lobby Club není úřad. Je to místnost vedle úřadu, kde se rozhodne dřív, než někdo zvedne ruku. Kdo drží Lobby Club, nevládne městu přímo. Jen šeptá lidem, kteří městem hýbou.",
    actions: Object.freeze(["Zákulisní tlak", "Tiché vyjednávání", "Mediální clona"])
  }),
  "lobby club": Object.freeze({
    role: "Ultra rare / lobbying / influence / political support",
    info: "Lobby Club není úřad. Je to místnost vedle úřadu, kde se rozhodne dřív, než někdo zvedne ruku. Kdo drží Lobby Club, nevládne městu přímo. Jen šeptá lidem, kteří městem hýbou.",
    actions: Object.freeze(["Zákulisní tlak", "Tiché vyjednávání", "Mediální clona"])
  }),
  soud: Object.freeze({
    role: "Ultra rare / passive legal protection / police raid mitigation / influence",
    info: "Soud nevypne policii. Jen zařídí, aby její zásah bolel míň. Když máš rozsudky, odklady a správné právníky, i razie ztratí zuby.",
    actions: Object.freeze([])
  }),
  "vip salonek": Object.freeze({
    role: "Rare / elite rumors / high truth intel / influence",
    info: "VIP Salonek je luxusní informační uzel. Drby vznikají rychleji a s vyšší pravdivostí než v běžném městském šumu, ale nikdy nejsou stoprocentní jistota.",
    actions: Object.freeze([])
  }),
  letiste: Object.freeze({
    role: "Ultra rare / logistics / import / black market support / mobility",
    info: "Letiště je brána města. Co ostatní musí vyrábět, ty můžeš dovézt. Co ostatní musí vozit ulicemi, ty pošleš přes runway. Ale každý kontejner má papíry. A každý falešný papír jednou někdo zkontroluje.",
    actions: Object.freeze(["Expresní dovoz", "Černý charter", "Evakuační koridor"])
  }),
  pristav: Object.freeze({
    role: "Logistics / containers / materials / dirty cash routes",
    info: "Přístav drží těžkou logistiku města. Kontejnery nosí materiály, špinavé peníze a trasy, které se ztrácí mezi papíry.",
    actions: Object.freeze(["Container Cut"])
  }),
  parlament: Object.freeze({
    role: "Ultra rare / power / politics / influence",
    info: "Parlament je nejvyšší politická páka města. Kdo ovládá hlasování, mění tlak ulice na čisté peníze a vliv.",
    actions: Object.freeze(["Policy Window"])
  }),
  "strip club": Object.freeze({
    role: "Noční provoz",
    info: "Strip club generuje cashflow, kontakty a vliv ve večerní ekonomice districtu.",
    actions: Object.freeze(["Vybrat cash", "Hostit VIP klienty", "Získat kompro"])
  }),
  sklad: Object.freeze({
    role: "Skladiště zásob",
    info: "Skladiště drží zásoby města pohromadě. Negeneruje špinavé peníze ani vliv, ale bez skladišť se impérium zadusí vlastním materiálem.",
    actions: Object.freeze([])
  }),
  skladiste: Object.freeze({
    role: "Skladiště zásob",
    info: "Skladiště drží zásoby města pohromadě. Negeneruje špinavé peníze ani vliv, ale bez skladišť se impérium zadusí vlastním materiálem.",
    actions: Object.freeze([])
  }),
  "energeticka stanice": Object.freeze({
    role: "Infrastruktura",
    info: "Energetická stanice podporuje průmyslovou výrobu a drží provoz districtu stabilní.",
    actions: Object.freeze(["Stabilizovat síť", "Napájet výrobu", "Snížit heat"])
  }),
  "recyklacni centrum": Object.freeze({
    role: "Salvage",
    info: "Recyklační centrum vrací železo, zbraně, moduly a všechno, co se dá po boji ještě vytáhnout ze šrotu.",
    actions: Object.freeze(["Vytěžit ztráty"])
  }),
  lekarna: Object.freeze({
    role: "Chemická podpora",
    info: "Lékárna vyrábí základní chemii, biomass a stim packy pro další crafting a podporu posádky.",
    actions: Object.freeze([])
  }),
  "drug lab": Object.freeze({
    role: "Drug výroba",
    info: "Drug lab převádí materiály na hotové substance a drží nejvyšší dirty cash potenciál v districtu.",
    actions: Object.freeze([])
  }),
  lab: Object.freeze({
    role: "Drug výroba",
    info: "Lab převádí materiály na hotové substance a drží nejvyšší dirty cash potenciál v districtu.",
    actions: Object.freeze([])
  }),
  tovarna: Object.freeze({
    role: "Průmyslová výroba",
    info: "Továrna vyrábí Metal Parts, Tech Core a bojový modul jako součástku pro zbrojovku, útoky a průmyslové linky.",
    actions: Object.freeze([])
  }),
  zbrojovka: Object.freeze({
    role: "Výzbroj",
    info: "Zbrojovka mění průmyslové zásoby na útočnou i obrannou výzbroj použitelnou v attack a defense flow.",
    actions: Object.freeze([])
  })
});


export const DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES = Object.freeze({
  "bytovy blok": Object.freeze([
    Object.freeze({ apartmentCollectPopulation: true, cooldownMs: 0, summary: "Přesune lokálně uložené obyvatele do globální populace gangu." })
  ]),
  skola: Object.freeze([
    Object.freeze({ schoolEveningCourse: true, cleanCost: 1000, durationMs: 20 * 60 * 1000, cooldownMs: 35 * 60 * 1000, apartmentPopulationBoostPct: 60, summary: "Večerní kurz zrychlí nábor členů v bytových blocích." })
  ]),
  restaurace: Object.freeze([
    Object.freeze({ clean: 180, dirty: 90, heat: 1, durationMs: 0, cooldownMs: 30 * 60 * 1000, summary: "Lokální tržby přepsány do zdrojů." }),
    Object.freeze({ durationMs: 30 * 60 * 1000, cooldownMs: 30 * 60 * 1000, incomeBoostPct: 18, influence: 2, heat: 1, summary: "Schůzky zvedly dočasný income budovy." }),
    Object.freeze({ influence: 4, heat: 2, durationMs: 30 * 60 * 1000, cooldownMs: 30 * 60 * 1000, influenceBoostPct: 12, summary: "Lokální síť posílila vliv districtu." })
  ]),
  "fitness club": Object.freeze([]),
  klinika: Object.freeze([
    Object.freeze({ clinicStabilizationProtocol: true, cleanCost: 1200, heat: 1, cooldownMs: 18 * 60 * 1000, summary: "Vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu." })
  ]),
  herna: Object.freeze([
    Object.freeze({ arcadeNightMachines: true, durationMs: 7 * 60 * 1000, cooldownMs: 16 * 60 * 1000, cleanIncomeBoostPct: 35, dirtyIncomeBoostPct: 65, influenceBoostPct: 15, heatMultiplier: 1.45, auditRiskBoostPct: 4, summary: "Noční automaty zvednou income, vliv, heat a audit risk." }),
    Object.freeze({ arcadeBackCashdesk: true, minimumDirty: 500, dirtySharePct: 13, maxDirty: 3800, feePct: 15, influence: 1, heat: 3, cooldownMs: 16 * 60 * 1000, auditRiskBoostPct: 3, auditRiskDurationMs: 8 * 60 * 1000, summary: "Zadní pokladna vypere část dirty cash a zvýší audit risk." })
  ]),
  smenarna: Object.freeze([
    Object.freeze({ exchangeOfficeGoodRate: true, minimumDirty: 800, dirtySharePct: 16, maxDirty: 6000, feePct: 12, influence: 1.5, heat: 4, cooldownMs: 11 * 60 * 1000, auditRiskBoostPct: 4, auditRiskDurationMs: 8 * 60 * 1000, summary: "Výhodný kurz vypere menší část dirty cash a zvedne audit risk." })
  ]),
  autosalon: Object.freeze([]),
  "obchodni centrum": Object.freeze([]),
  kasino: Object.freeze([
    Object.freeze({ casinoQuietBackroom: true, minimumDirty: 1500, dirtySharePct: 24, maxDirty: 18000, feePct: 9, influence: 3, heat: 7, cooldownMs: 14 * 60 * 1000, durationMs: 10 * 60 * 1000, auditRiskBoostPct: 6, summary: "Tichá herna vypere část dirty cash a zvýší audit risk." }),
    Object.freeze({ casinoVipNight: true, durationMs: 10 * 60 * 1000, cooldownMs: 26 * 60 * 1000, cleanIncomeBoostPct: 70, dirtyIncomeBoostPct: 55, influenceBoostPct: 25, heatMultiplier: 1.6, auditRiskBoostPct: 8, summary: "VIP noc masivně zvedá income, vliv, heat a audit risk." }),
    Object.freeze({ casinoBribedInspector: true, cleanCost: 5500, failureChancePct: 14, durationMs: 12 * 60 * 1000, cooldownMs: 32 * 60 * 1000, heatSuccess: -16, heatFailure: 12, influenceSuccess: 4, auditRiskReductionPct: 35, auditRiskFailurePct: 10, summary: "Podplacený inspektor je drahá ochrana s rizikem selhání." })
  ]),
  "poulicni dealeri": Object.freeze([
    Object.freeze({ cooldownMs: 0, serverEffectSummary: "Dealer slot prodá vybranou látku za serverově spočítaný dirty cash.", summary: "Spustí serverový prodej látky přes dealer slot." }),
    Object.freeze({ dirty: 280, heat: 3, cooldownMs: 10 * 60 * 1000, summary: "Hotový cash byl vybrán." }),
    Object.freeze({ materialCost: { biomass: 3 }, dirty: 1000, heat: 1, cooldownMs: 10 * 60 * 1000, summary: "Stash proměněn na dirty cash." })
  ]),
  vecerka: Object.freeze([]),
  "pasovaci tunel": Object.freeze([
    Object.freeze({ smugglingOpenChannel: true, cleanCost: 800, heat: 5, durationMs: 15 * 60 * 1000, cooldownMs: 30 * 60 * 1000, dirtyIncomeBoostPct: 45, dealerSalePriceBonusPct: 12, dealerSaleSpeedBonusPct: 10, dealerRewardBonusPct: 10, heatRiskBonusPct: 15, streetIncidentFlatRiskPct: 5, summary: "Otevřený kanál zvedne dirty cash tunelů a prodej dealerů, ale přidá heat a street incident risk." })
  ]),
  burza: Object.freeze([
    Object.freeze({ stockSpeculativeBuy: true, cleanCost: 2500, maxInvestmentCleanCash: 10000, heat: 5, cooldownMs: 16 * 60 * 1000, successChancePct: 65, neutralChancePct: 25, badChancePct: 10, summary: "Investuje clean cash do vybrané market kategorie. Výsledek může být zisk, neutrální pohyb nebo ztráta." }),
    Object.freeze({ stockMarketPressure: true, cleanCost: 3000, influenceCost: 15, heat: 8, durationMs: 10 * 60 * 1000, cooldownMs: 22 * 60 * 1000, pumpPct: 12, dumpPct: -10, blackMarketEffectSharePct: 40, summary: "Na krátkou dobu server-wide pumpne nebo dumpne ceny vybrané kategorie." }),
    Object.freeze({ stockInsiderWindow: true, cleanCost: 1500, heat: 4, durationMs: 6 * 60 * 1000, cooldownMs: 18 * 60 * 1000, trendHints: 3, extraFeeReductionPct: 8, speculativeSuccessBonusPct: 12, summary: "Zlepší trend hints, fee reduction a šanci Spekulativního nákupu." })
  ]),
  "centralni banka": Object.freeze([
    Object.freeze({ centralBankLiquidityInjection: true, influenceCost: 20, heat: 4, cooldownMs: 20 * 60 * 1000, baseRewardCleanCash: 2500, rewardPerCleanEconomyBuilding: 90, maxRewardCleanCash: 8000, summary: "Přidá clean cash podle čisté ekonomiky hráče a zvedne Financial Oversight risk." }),
    Object.freeze({ centralBankFrozenAccounts: true, cleanCost: 2000, heat: 5, durationMs: 8 * 60 * 1000, cooldownMs: 24 * 60 * 1000, cleanCashProtectionBonusPct: 25, dirtyCashProtectionPct: 8, fineReductionPct: 20, marketFeePenaltyPct: 5, summary: "Dočasně chrání rezervy, snižuje pokuty a finanční ztráty, ale zhorší market fee." }),
    Object.freeze({ centralBankCurrencyIntervention: true, cleanCost: 3000, influenceCost: 25, heat: 7, durationMs: 8 * 60 * 1000, cooldownMs: 28 * 60 * 1000, volatilityReductionPct: 30, priceMoveCapPct: 6, marketFeeReductionPct: 6, stockExchangeEffectReductionPct: 25, summary: "Stabilizuje vybranou market kategorii a tlumí Tržní tlak Burzy." })
  ]),
  magistrat: Object.freeze([
    Object.freeze({ cityHallOfficialCover: true, cleanCost: 1500, influenceCost: 25, heat: 2, durationMs: 8 * 60 * 1000, cooldownMs: 20 * 60 * 1000, heatGainReductionPct: 35, policeControlChanceReductionPct: 20, rumorChanceReductionPct: 15, summary: "Cílový vlastněný district dostane politické krytí proti heatu, kontrole a rumorům." }),
    Object.freeze({ cityHallContract: true, influenceCost: 20, heat: 3, cooldownMs: 18 * 60 * 1000, baseRewardCleanCash: 1500, rewardPerLegalBuilding: 120, maxRewardCleanCash: 6500, summary: "Přidá clean cash podle počtu legálních budov hráče." }),
    Object.freeze({ cityHallEmergencyDecree: true, cleanCost: 2500, influenceCost: 40, heat: 8, durationMs: 6 * 60 * 1000, cooldownMs: 28 * 60 * 1000, modes: "night_patrols / suspended_checks / construction_closure", summary: "Spustí krátkou městskou vyhlášku s obranným, policejním nebo zónovým efektem." })
  ]),
  "lobby klub": Object.freeze([
    Object.freeze({ lobbyBackroomPressure: true, cleanCost: 1200, influenceCost: 25, heat: 3, durationMs: 8 * 60 * 1000, cooldownMs: 20 * 60 * 1000, influenceProductionBonusPct: 18, influenceActionCostReductionPct: 10, negativeRumorReductionPct: 15, districtControlPressurePct: 8, summary: "Zákulisní tlak zvedne influence produkci, zlevní influence akce a sníží negativní drby." }),
    Object.freeze({ lobbyQuietNegotiation: true, cleanCost: 1500, influenceCost: 15, heat: 2, cooldownMs: 24 * 60 * 1000, cooldownRemainingReductionPct: 20, riskReductionPct: 10, nextInfluenceActionDiscountPct: 8, summary: "Tiché vyjednávání zkrátí politický/společenský cooldown, sníží rizika a připraví slevu na další influence akci." }),
    Object.freeze({ lobbyMediaScreen: true, cleanCost: 2000, heat: 4, durationMs: 8 * 60 * 1000, cooldownMs: 26 * 60 * 1000, negativeRumorReductionPct: 35, truthReductionPct: 15, policeRaidWarningChancePct: 6, summary: "Mediální clona tlumí negativní drby a zlepšuje veřejný obraz hráče." })
  ]),
  "lobby club": Object.freeze([
    Object.freeze({ lobbyBackroomPressure: true, cleanCost: 1200, influenceCost: 25, heat: 3, durationMs: 8 * 60 * 1000, cooldownMs: 20 * 60 * 1000, influenceProductionBonusPct: 18, influenceActionCostReductionPct: 10, negativeRumorReductionPct: 15, districtControlPressurePct: 8, summary: "Zákulisní tlak zvedne influence produkci, zlevní influence akce a sníží negativní drby." }),
    Object.freeze({ lobbyQuietNegotiation: true, cleanCost: 1500, influenceCost: 15, heat: 2, cooldownMs: 24 * 60 * 1000, cooldownRemainingReductionPct: 20, riskReductionPct: 10, nextInfluenceActionDiscountPct: 8, summary: "Tiché vyjednávání zkrátí politický/společenský cooldown, sníží rizika a připraví slevu na další influence akci." }),
    Object.freeze({ lobbyMediaScreen: true, cleanCost: 2000, heat: 4, durationMs: 8 * 60 * 1000, cooldownMs: 26 * 60 * 1000, negativeRumorReductionPct: 35, truthReductionPct: 15, policeRaidWarningChancePct: 6, summary: "Mediální clona tlumí negativní drby a zlepšuje veřejný obraz hráče." })
  ]),
  "vip salonek": Object.freeze([]),
  letiste: Object.freeze([
    Object.freeze({ airportExpressImport: true, cleanCost: 2000, heat: 6, durationMs: 90 * 1000, cooldownMs: 18 * 60 * 1000, customsRiskPct: 10, summary: "Objedná zásilku materials, rare components, weapons nebo defense items. Přesah přes sklad propadne." }),
    Object.freeze({ airportBlackCharter: true, dirtyCost: 2500, heat: 9, durationMs: 8 * 60 * 1000, cooldownMs: 24 * 60 * 1000, offerDiscountPct: 6, purchaseCustomsRiskPct: 15, summary: "Otevře dočasnou Black Market nabídku s rizikem celního zátahu při nákupu." }),
    Object.freeze({ airportEvacuationCorridor: true, cleanCost: 1800, heat: 5, durationMs: 7 * 60 * 1000, cooldownMs: 26 * 60 * 1000, escapeChanceBonusPct: 18, lossReductionPct: 10, summary: "Zvedne šanci úniku, sníží ztráty při neúspěchu a zrychlí návratovou logistiku." })
  ]),
  pristav: Object.freeze([
    Object.freeze({ dirty: 160, materials: { "metal-parts": 3 }, influence: 1, heat: 6, cooldownMs: 14 * 60 * 1000, summary: "Container Cut vytáhne z kontejnerové trasy dirty cash a metal parts." })
  ]),
  parlament: Object.freeze([
    Object.freeze({ clean: 160, influence: 5, heat: 5, cooldownMs: 18 * 60 * 1000, summary: "Policy Window otevře krátké politické okno pro clean cash a vliv." })
  ]),
  "strip club": Object.freeze([
    Object.freeze({ dirty: 360, heat: 3, cooldownMs: 10 * 60 * 1000, summary: "Noční cash vybrán." }),
    Object.freeze({ cleanCost: 800, durationMs: 30 * 60 * 1000, cooldownMs: 60 * 60 * 1000, cleanIncomeBoostPct: 45, dirtyIncomeBoostPct: 35, influenceBoostPct: 55, heatMultiplier: 1.5, serverEffectSummary: "Šance na drb +10 %", summary: "VIP klienti dočasně zvednou cashflow, vliv, heat a drby." }),
    Object.freeze({ cleanCost: 1500, influence: 8, heat: 6, durationMs: 10 * 60 * 1000, cooldownMs: 30 * 60 * 1000, influenceBoostPct: 70, failureChancePct: 12, serverEffectSummary: "Kontakt / extra drb / riziko skandálu", summary: "Kompro přidá vliv, dočasný influence boost a může přinést kontakt, extra drb nebo skandál." })
  ]),
  sklad: Object.freeze([]),
  skladiste: Object.freeze([]),
  "energeticka stanice": Object.freeze([
    Object.freeze({ cleanCost: 1200, durationMs: 25 * 60 * 1000, cooldownMs: 60 * 60 * 1000, heat: 3, serverEffectSummary: "Infrastructure +12% · kamery +20% · alarm +20% · výroba +10%", summary: "Záložní síť dočasně posílí infrastrukturu, obranu a průmyslovou výrobu." }),
    Object.freeze({ durationMs: 25 * 60 * 1000, cooldownMs: 60 * 60 * 1000, cleanIncomeBoostPct: 18, heat: 2, summary: "Napájení dočasně zvedne čistý provoz districtu." }),
    Object.freeze({ cooldownMs: 60 * 60 * 1000, heat: -2, summary: "Serverově sníží heat districtu." })
  ]),
  "recyklacni centrum": Object.freeze([
    Object.freeze({ recyclingExtractLosses: true, cleanCost: 900, heat: 2, cooldownMs: 16 * 60 * 1000, summary: "Vytěží část neexpirovaných itemových ztrát." })
  ]),
  lekarna: Object.freeze([]),
  "drug lab": Object.freeze([]),
  lab: Object.freeze([]),
  tovarna: Object.freeze([]),
  zbrojovka: Object.freeze([])
});


export const DISTRICT_BUILDING_DETAIL_DEFAULT_ACCRUAL_MS = 60 * 60 * 1000;
export const DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS = 4 * 60 * 60 * 1000;
export const DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS = 90 * 1000;
export const DISTRICT_BUILDING_DETAIL_MAX_LEVEL = 8;
export const CASINO_DETAIL_BASE_LAUNDERING_CAPACITY = 18000;
export const CASINO_DETAIL_BASE_LAUNDERING_FEE_PCT = 9;
export const CASINO_DETAIL_MAX_LEVEL = 4;
export const CASINO_DETAIL_UPGRADES = Object.freeze({
  1: Object.freeze({ clean: 0, techCore: 0, combatModule: 0, incomeBonusPct: 0, launderingLimitBonusPct: 0, launderingFeeReductionPct: 0, actionHeatReductionPct: 0 }),
  2: Object.freeze({ clean: 7500, techCore: 3, combatModule: 0, incomeBonusPct: 12, launderingLimitBonusPct: 8, launderingFeeReductionPct: 0, actionHeatReductionPct: 0 }),
  3: Object.freeze({ clean: 18000, techCore: 7, combatModule: 0, incomeBonusPct: 25, launderingLimitBonusPct: 16, launderingFeeReductionPct: 2, actionHeatReductionPct: 0 }),
  4: Object.freeze({ clean: 38000, techCore: 14, combatModule: 3, incomeBonusPct: 40, launderingLimitBonusPct: 25, launderingFeeReductionPct: 2, actionHeatReductionPct: 8 })
});
export const EXCHANGE_OFFICE_BASE_LAUNDERING_CAPACITY = 6000;
export const EXCHANGE_OFFICE_BASE_AUDIT_RISK_PCT = 4;
export const EXCHANGE_OFFICE_NETWORK_CONFIG = Object.freeze({
  countOnMap: 11,
  incomeBonusPctPerExtraExchange: 8,
  launderingLimitBonusPctPerExtraExchange: 10,
  heatBonusPctPerExtraExchange: 4,
  maxIncomeMultiplier: 1.48,
  maxLaunderingLimitMultiplier: 1.6,
  maxHeatMultiplier: 1.24
});
export const ARCADE_BASE_LAUNDERING_CAPACITY = 3800;
export const ARCADE_BASE_AUDIT_RISK_PCT = 3;
export const ARCADE_NETWORK_CONFIG = Object.freeze({
  countOnMap: 16,
  incomeBonusPctPerExtraArcade: 5,
  launderingLimitBonusPctPerExtraArcade: 6,
  heatBonusPctPerExtraArcade: 3,
  maxIncomeMultiplier: 1.45,
  maxLaunderingLimitMultiplier: 1.55,
  maxHeatMultiplier: 1.27
});
export const APARTMENT_BLOCK_BASE_CAPACITY = 50;
export const APARTMENT_BLOCK_POPULATION_PER_MINUTE = 2;
export const APARTMENT_BLOCK_MIN_COLLECT_POPULATION = 10;
export const APARTMENT_BLOCK_NETWORK_CONFIG = Object.freeze({
  countOnMap: 29,
  populationProductionBonusPctPerExtraBlock: 6,
  capacityBonusPctPerExtraBlock: 8,
  maxPopulationProductionMultiplier: 1.55,
  maxCapacityMultiplier: 1.75
});
export const SCHOOL_CONFIG = Object.freeze({
  countOnMap: 6,
  cleanCashPerMinute: 18,
  influencePerMinute: 0.05,
  populationPerMinute: 0.55,
  baseStudentCapacity: 20,
  populationProductionBonusPctPerExtraSchool: 8,
  studentCapacityBonusPctPerExtraSchool: 10,
  incomeBonusPctPerExtraSchool: 4,
  maxPopulationProductionMultiplier: 1.4,
  maxStudentCapacityMultiplier: 1.5,
  maxIncomeMultiplier: 1.2,
  eveningCourseDurationMs: 20 * 60 * 1000,
  eveningCourseDurationBonusMsPerLevel: 0,
  eveningCourseCooldownMs: 35 * 60 * 1000,
  eveningCourseCleanCost: 1000,
  eveningCoursePopulationMultiplier: 1.6,
  eveningCourseCleanIncomeMultiplier: 1
});
export const WAREHOUSE_BASE_STORAGE_CAPACITIES = Object.freeze({
  genericResources: 500,
  chemicals: 350,
  biomass: 350,
  metalParts: 400,
  techCore: 120,
  combatModule: 80,
  drugsAndBoosts: 220,
  weaponsAndDefense: 160
});
export const WAREHOUSE_NETWORK_CONFIG = Object.freeze({
  countOnMap: 18,
  incomeBonusPctPerExtraWarehouse: 4,
  storageCapacityBonusPctPerExtraWarehouse: 10,
  heatBonusPctPerExtraWarehouse: 3,
  maxIncomeMultiplier: 1.36,
  maxStorageCapacityMultiplier: 1.9,
  maxHeatMultiplier: 1.27
});
export const SHOPPING_MALL_NETWORK_CONFIG = Object.freeze({
  countOnMap: 10,
  cleanIncomeBonusPctPerExtraMall: 5,
  dirtyIncomeBonusPctPerExtraMall: 5,
  influenceBonusPctPerExtraMall: 4,
  heatBonusPctPerExtraMall: 3,
  maxCleanIncomeMultiplier: 1.3,
  maxDirtyIncomeMultiplier: 1.3,
  maxInfluenceMultiplier: 1.24,
  maxHeatMultiplier: 1.18
});
export const RESTAURANT_NETWORK_CONFIG = Object.freeze({
  countOnMap: 36,
  incomeBonusPctPerExtraRestaurant: 2.5,
  influenceBonusPctPerExtraRestaurant: 3,
  rumorChanceBonusPctPerExtraRestaurant: 4,
  heatBonusPctPerExtraRestaurant: 2,
  maxIncomeMultiplier: 1.25,
  maxInfluenceMultiplier: 1.3,
  maxRumorMultiplier: 1.4,
  maxHeatMultiplier: 1.2
});
export const GARAGE_SUPPORT_CONFIG = Object.freeze({
  countOnMap: 16,
  cleanCashPerMinute: 42,
  heatPerMinute: 0.06,
  cooldownReductionPctPerGarage: 2,
  maxCooldownReductionPct: 16,
  fullBonusCategories: Object.freeze([
    "attackPreparation",
    "districtOccupy",
    "districtRobbery"
  ]),
  halfBonusCategories: Object.freeze([
    "districtSpy",
    "trapDetection",
    "clinicRecovery",
    "factoryProductionActions",
    "armoryProductionActions"
  ]),
  excludedCategories: Object.freeze([
    "moneyLaundering",
    "casinoActions",
    "exchangeOfficeActions",
    "arcadeLaunderingActions",
    "vipBoosts",
    "rumorGeneration",
    "passiveProduction"
  ]),
  incomeBonusPctPerExtraGarage: 3,
  heatBonusPctPerExtraGarage: 2,
  maxIncomeMultiplier: 1.21,
  maxHeatMultiplier: 1.14
});
export const AUTO_SALON_SUPPORT_CONFIG = Object.freeze({
  countOnMap: 10,
  mobilityBonusPctPerDealer: 3,
  maxMobilityBonusPct: 21,
  cooldownReductionPctPerDealer: 1.5,
  maxCooldownReductionPct: 10.5,
  combinedGarageDealerMaxReductionPct: 22,
  escapeChanceBonusPctPerDealer: 2,
  maxEscapeChanceBonusPct: 12,
  fullBonusCategories: Object.freeze(["districtRobbery", "districtOccupy", "attackPreparation", "retreatReturn"]),
  halfBonusCategories: Object.freeze(["attackTravelTime", "defenseReposition"]),
  smallBonusCategories: Object.freeze(["clinicEvacuationRecovery", "recyclingSalvageTransport"]),
  excludedCategories: Object.freeze(["moneyLaundering", "casinoActions", "exchangeOfficeActions", "arcadeLaunderingActions", "rumorGeneration", "passiveProduction", "intelScan", "trapDetection"]),
  escapeAppliesTo: Object.freeze(["neúspěšné Vykrást district", "odhalená špionáž", "přepadení při přesunu", "návrat po útoku"]),
  cleanIncomeBonusPctPerExtraDealer: 4,
  dirtyIncomeBonusPctPerExtraDealer: 4,
  heatBonusPctPerExtraDealer: 3,
  maxCleanIncomeMultiplier: 1.24,
  maxDirtyIncomeMultiplier: 1.24,
  maxHeatMultiplier: 1.18
});
export const FITNESS_CLUB_SUPPORT_CONFIG = Object.freeze({
  countOnMap: 5,
  cleanCashPerMinute: 72,
  heatPerMinute: 0.04,
  attackStrengthBonusPctPerClub: 3,
  defenseStrengthBonusPctPerClub: 2,
  maxAttackStrengthBonusPct: 15,
  maxDefenseStrengthBonusPct: 10,
  combinedRecruitmentFitnessAttackCapPct: 24,
  combinedRecruitmentFitnessDefenseCapPct: 18,
  attackApplication: Object.freeze({
    baseGangMemberAttack: 0.75,
    "baseball-bat": 0.75,
    pistol: 0.35,
    grenade: 0.15,
    smg: 0.25,
    bazooka: 0.1
  }),
  defenseApplication: Object.freeze({
    baseGangMemberDefense: 0.75,
    vest: 0.4,
    barricades: 0.2,
    cameras: 0,
    "defense-tower": 0,
    alarm: 0
  }),
  incomeBonusPctPerExtraClub: 5,
  heatBonusPctPerExtraClub: 3,
  maxIncomeMultiplier: 1.2,
  maxHeatMultiplier: 1.12
});
export const RECRUITMENT_CENTER_SUPPORT_CONFIG = Object.freeze({
  countOnMap: 16,
  cleanCashPerMinute: 35,
  heatPerMinute: 0.07,
  populationProductionBonusPctPerCenter: 3,
  apartmentCapacityBonusPctPerCenter: 4,
  maxPopulationProductionBonusPct: 24,
  maxApartmentCapacityBonusPct: 32,
  attackWeaponStrengthBonusPctPerCenter: 2,
  defenseItemStrengthBonusPctPerCenter: 1.5,
  maxAttackWeaponStrengthBonusPct: 16,
  maxDefenseItemStrengthBonusPct: 12,
  maxCombinedCameraAlarmBonusPct: 50,
  incomeBonusPctPerExtraCenter: 3,
  heatBonusPctPerExtraCenter: 3,
  maxIncomeMultiplier: 1.21,
  maxHeatMultiplier: 1.21
});
export const SMUGGLING_TUNNEL_CONFIG = Object.freeze({
  countOnMap: 18,
  dirtyCashPerMinute: 54,
  heatPerMinute: 0.07,
  dirtyProductionBonusPctPerExtraTunnel: 5,
  heatBonusPctPerExtraTunnel: 4,
  maxDirtyProductionMultiplier: 1.35,
  maxHeatMultiplier: 1.28,
  dealerSupplyBonusPctPerTunnel: 4,
  dealerSupplyMaxBonusPct: 32,
  dealerSupplySalePriceSharePct: 50,
  dealerSupplySaleSpeedSharePct: 35,
  dealerSupplyStreetRiskReductionSharePct: 40,
  dealerSupplyPassiveDirtyIncomeSharePct: 25,
  dealerSupplySaleHeatRiskSharePct: 20,
  openChannelCleanCost: 800,
  openChannelHeatGain: 5,
  openChannelDurationMs: 15 * 60 * 1000,
  openChannelCooldownMs: 30 * 60 * 1000,
  openChannelTunnelDirtyProductionBonusPct: 45,
  openChannelDealerSalePriceBonusPct: 12,
  openChannelDealerSaleSpeedBonusPct: 10,
  openChannelDealerCompletionRewardBonusPct: 10,
  openChannelDealerSaleHeatBonusPct: 15,
  openChannelStreetIncidentFlatRiskPct: 5,
  baseBatchCapacity: 0,
  minCollectDirty: Number.POSITIVE_INFINITY,
  maxBatchCapacityMultiplier: 1,
  maxPassiveHeatMultiplier: 1.28,
  passiveHeatBonusPctPerExtraTunnel: 4,
  silentChannelDirtyProductionMultiplier: 1,
  silentChannelHeatMultiplier: 1,
  silentChannelBatchCapacityMultiplier: 1,
  silentChannelRaidChancePct: 0
});
export const CLINIC_BASE_RECOVERY_RATE_PCT = 15;
export const CLINIC_RECOVERY_RATE_PCT_PER_EXTRA = 3;
export const CLINIC_MAX_RECOVERY_RATE_PCT = 40;
export const CLINIC_COUNT_ON_MAP = 8;
export const CLINIC_POOL_TTL_MS = 90 * 60 * 1000;
export const CLINIC_RECOVERABLE_ITEMS = Object.freeze(["population"]);
export const CLINIC_RARE_ITEMS = Object.freeze([]);

export const DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES = Object.freeze({
  "bytovy blok": "apartment-block",
  "rekrutacni centrum": "recruitment-center",
  skola: "school",
  garage: "garage",
  garaz: "garage",
  klinika: "clinic",
  restaurace: "restaurant",
  "fitness club": "fitness-club",
  herna: "arcade",
  smenarna: "exchange",
  autosalon: "auto-salon",
  "obchodni centrum": "retail",
  kasino: "casino",
  "poulicni dealeri": "street-dealers",
  vecerka: "convenience-store",
  "pasovaci tunel": "smuggling-tunnel",
  burza: "stock-exchange",
  "centralni banka": "central-bank",
  magistrat: "city-hall",
  "lobby klub": "lobby-club",
  "lobby club": "lobby-club",
  "vip salonek": "vip-lounge",
  letiste: "airport",
  pristav: "port",
  parlament: "parliament",
  soud: "court",
  "strip club": "strip-club",
  sklad: "warehouse",
  skladiste: "warehouse",
  "energeticka stanice": "power-plant",
  "recyklacni centrum": "recycling-center",
  lekarna: "pharmacy",
  "drug lab": "drug-lab",
  lab: "drug-lab",
  tovarna: "factory",
  zbrojovka: "armory"
});
