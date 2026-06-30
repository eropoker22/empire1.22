import { publicBuildingNameVariants } from "./building-name-variants";

export interface PublicBuildingActionEffectModifiers {
  incomeMultiplier?: number;
  cleanIncomeMultiplier?: number;
  dirtyIncomeMultiplier?: number;
  influenceMultiplier?: number;
  heatMultiplier?: number;
  influencePerDay?: number;
  heatPerDay?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
}

export interface PublicBuildingActionConfig {
  actionId: string;
  label: string;
  description: string;
  effectSummary: string;
  durationMs: number;
  cooldownMs: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  heatGain: number;
  influenceChange: number;
  effectModifiers?: PublicBuildingActionEffectModifiers;
  reportText: string;
}

export interface PublicBuildingDefinition {
  buildingTypeId: string;
  label: string;
  nameVariants: string[];
  zone: string;
  role: string;
  info: string;
  stats: {
    cleanPerHour: number;
    dirtyPerHour: number;
    heatPerDay: number;
    influencePerDay: number;
    maxLevel: number;
  };
  specialActions: PublicBuildingActionConfig[];
}

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const freeActionCooldownMs = 90 * second;

const out = (key: string, amount: number): Record<string, number> => ({ [key]: amount });
const resources = (entries: Record<string, number>): Record<string, number> => ({ ...entries });

const action = (input: {
  actionId: string;
  label: string;
  description: string;
  effectSummary: string;
  cooldownMs?: number;
  durationMs?: number;
  heatGain?: number;
  outputGain?: Record<string, number>;
  influenceChange?: number;
  inputCost?: Record<string, number>;
  effectModifiers?: PublicBuildingActionEffectModifiers;
}): PublicBuildingActionConfig => ({
  actionId: input.actionId,
  label: input.label,
  description: input.description,
  effectSummary: input.effectSummary,
  durationMs: Math.max(0, Math.floor(Number(input.durationMs ?? 0))),
  cooldownMs: Math.max(1000, Math.floor(Number(input.cooldownMs ?? freeActionCooldownMs))),
  inputCost: { ...(input.inputCost ?? {}) },
  outputGain: { ...(input.outputGain ?? {}) },
  heatGain: Math.floor(Number(input.heatGain ?? 0)),
  influenceChange: Number(input.influenceChange ?? 0),
  effectModifiers: input.effectModifiers ? { ...input.effectModifiers } : undefined,
  reportText: input.effectSummary
});

const legacyAction = (
  actionId: string,
  label: string,
  description: string,
  effectSummary: string,
  cooldownHours: number,
  heatGain: number,
  outputGain: Record<string, number> = {},
  influenceChange = 0,
  inputCost: Record<string, number> = {},
  durationHours = 0
): PublicBuildingActionConfig => ({
  actionId,
  label,
  description,
  effectSummary,
  durationMs: Math.max(1000, durationHours * hour),
  cooldownMs: cooldownHours * hour,
  inputCost,
  outputGain,
  heatGain,
  influenceChange,
  reportText: effectSummary
});

const stat = (cleanPerHour: number, dirtyPerHour: number, heatPerDay: number, influencePerDay: number, maxLevel = 5) => ({
  cleanPerHour,
  dirtyPerHour,
  heatPerDay,
  influencePerDay,
  maxLevel
});

const perMinuteStat = (cleanPerMinute: number, dirtyPerMinute: number, heatPerDay = 0, influencePerDay = 0, maxLevel = 5) =>
  stat(cleanPerMinute * 60, dirtyPerMinute * 60, heatPerDay, influencePerDay, maxLevel);

const building = (
  buildingTypeId: string,
  label: string,
  zone: string,
  role: string,
  info: string,
  stats: PublicBuildingDefinition["stats"],
  specialActions: PublicBuildingActionConfig[]
): PublicBuildingDefinition => ({
  buildingTypeId,
  label,
  nameVariants: publicBuildingNameVariants[buildingTypeId] ?? [],
  zone,
  role,
  info,
  stats,
  specialActions
});

export const publicBuildingDefinitions: PublicBuildingDefinition[] = [
  building("central_bank", "Centrální banka", "downtown", "Ultra rare / finance / reserve / market stability", "Centrální banka netiskne chaos. Drží ho pod zámkem. Kdo ovládá rezervy, nemusí vyhrávat každou přestřelku. Stačí, když přežije každou krizi.", perMinuteStat(160, 0, 0.1 * 60 * 24, 0.35 * 60 * 24, 1), [
    action({ actionId: "liquidity_injection", label: "Likviditní injekce", description: "Okamžitě přidá clean cash podle velikosti čisté ekonomiky hráče.", effectSummary: "Cena 20 influence, +clean cash, +heat, +Financial Oversight risk", cooldownMs: 20 * minute, heatGain: 4, influenceChange: -20 }),
    action({ actionId: "frozen_accounts", label: "Zmrazené účty", description: "Dočasně zvýší ochranu clean cash a sníží finanční ztráty.", effectSummary: "Cena 2000 clean cash, ochrana rezerv, horší market fee", durationMs: 8 * minute, cooldownMs: 24 * minute, heatGain: 5, inputCost: out("cash", 2000) }),
    action({ actionId: "currency_intervention", label: "Kurzovní intervence", description: "Stabilizuje vybranou market kategorii a tlumí Tržní tlak Burzy.", effectSummary: "Cena 3000 clean cash + 25 influence, nižší volatilita, +heat", durationMs: 8 * minute, cooldownMs: 28 * minute, heatGain: 7, inputCost: out("cash", 3000), influenceChange: -25 })
  ]),
  building("city_hall", "Magistrát", "downtown", "Ultra rare / politics / city control / heat management", "Magistrát není gangová základna. Je to místo, kde se zločin mění na razítko. Kdo drží magistrát, nemusí mít vždy větší zbraň. Stačí, když má správný podpis.", perMinuteStat(130, 0, 0.12 * 60 * 24, 0.85 * 60 * 24, 1), [
    action({ actionId: "official_cover", label: "Úřední krytí", description: "Na 8 minut sníží heat gain, police control chance a rumor chance ve všech vlastněných districtech.", effectSummary: "Cena 1500 clean + 25 influence, heat +2, scandal risk +8 %", cooldownMs: 20 * minute, durationMs: 8 * minute, heatGain: 2, inputCost: out("cash", 1500), influenceChange: -25 }),
    action({ actionId: "city_contract", label: "Městská zakázka", description: "Převede politický vliv na clean cash podle počtu legálních budov hráče.", effectSummary: "Cena 20 influence, reward 1500 + legální budovy × 120, heat +3", cooldownMs: 18 * minute, heatGain: 3, influenceChange: -20 }),
    action({ actionId: "emergency_decree", label: "Nouzová vyhláška", description: "Na 6 minut spustí městský režim: Noční hlídky, Zastavené kontroly nebo Stavební uzávěru.", effectSummary: "Cena 2500 clean + 40 influence, heat +8, city-wide efekt", cooldownMs: 28 * minute, durationMs: 6 * minute, heatGain: 8, inputCost: out("cash", 2500), influenceChange: -40 })
  ]),
  building("lobby_club", "Lobby Club", "downtown", "Ultra rare / lobbying / influence / political support", "Lobby Club není úřad. Je to místnost vedle úřadu, kde se rozhodne dřív, než někdo zvedne ruku. Kdo drží Lobby Club, nevládne městu přímo. Jen šeptá lidem, kteří městem hýbou.", perMinuteStat(95, 0, 0.1 * 60 * 24, 0.65 * 60 * 24, 1), [
    action({ actionId: "backroom_pressure", label: "Zákulisní tlak", description: "Na 8 minut posílí influence produkci všech budov, zlevní influence akce a sníží negativní drby.", effectSummary: "Cena 1200 clean + 25 influence, influence +18 %, influence akce -10 %, heat +3", cooldownMs: 20 * minute, durationMs: 8 * minute, heatGain: 3, inputCost: out("cash", 1200), influenceChange: -25 }),
    action({ actionId: "quiet_negotiation", label: "Tiché vyjednávání", description: "Zkrátí jeden aktivní politický nebo společenský cooldown, sníží rizika a zlevní další influence akci.", effectSummary: "Cena 1500 clean + 15 influence, cooldown -20 % zbývajícího času, heat +2", cooldownMs: 24 * minute, heatGain: 2, inputCost: out("cash", 1500), influenceChange: -15 }),
    action({ actionId: "media_screen", label: "Mediální clona", description: "Na 8 minut tlumí negativní drby, snižuje jejich pravdivost a zlepšuje civilní rumor truth.", effectSummary: "Cena 2000 clean, negativní drby -35 %, police warning +6 %, heat +4", cooldownMs: 26 * minute, durationMs: 8 * minute, heatGain: 4, inputCost: out("cash", 2000) })
  ]),
  building("stock_exchange", "Burza", "downtown", "Ultra rare / economy / market control / financial power", "Burza je jediná na mapě. Neprodává zboží. Ovládá ceny, poplatky a rytmus celé ekonomiky. Skleněná věž v Downtownu, kde se války nevedou noži, ale grafy.", perMinuteStat(220, 0, 0.18 * 60 * 24, 0.45 * 60 * 24, 1), [
    action({ actionId: "speculative_buy", label: "Spekulativní nákup", description: "Investuje clean cash do vybrané market kategorie. Výsledek může být zisk, neutrální pohyb nebo ztráta.", effectSummary: "Cena 2500 clean + investice, heat +5, financial inspection risk +6 %", cooldownMs: 16 * minute, heatGain: 5, inputCost: out("cash", 2500) }),
    action({ actionId: "market_pressure", label: "Tržní tlak", description: "Na 10 minut server-wide pumpne nebo dumpne ceny vybrané market kategorie.", effectSummary: "Cena 3000 clean + 15 influence, heat +8, server-wide market efekt", cooldownMs: 22 * minute, durationMs: 10 * minute, heatGain: 8, inputCost: out("cash", 3000), influenceChange: -15 }),
    action({ actionId: "insider_window", label: "Insider Window", description: "Na 6 minut zlepší trend hints, fee reduction a šanci Spekulativního nákupu.", effectSummary: "Cena 1500 clean, heat +4, 3 trend hints, extra fee reduction -8 %", cooldownMs: 18 * minute, durationMs: 6 * minute, heatGain: 4, inputCost: out("cash", 1500) })
  ]),
  building("court", "Soud", "downtown", "Ultra rare / passive legal protection / police raid mitigation / influence", "Soud nevypne policii. Jen zařídí, aby její zásah bolel míň. Když máš rozsudky, odklady a správné právníky, i razie ztratí zuby.", perMinuteStat(105, 0, 0.08 * 60 * 24, 0.72 * 60 * 24, 1), []),
  building("vip_lounge", "VIP Salonek", "downtown", "Rare / elite rumors / high truth intel / influence", "VIP Salonek je luxusní informační uzel. Za tlumeným světlem a drahým stolem se mluví rychleji než ve městě dole. Nedává jistotu, ale jeho zákulisní drby bývají nebezpečně blízko pravdě.", perMinuteStat(105, 30, 0.13 * 60 * 24, 0.48 * 60 * 24, 1), []),
  building("airport", "Letiště", "downtown", "Ultra rare / logistics / import / black market support / mobility", "Letiště je brána města. Co ostatní musí vyrábět, ty můžeš dovézt. Co ostatní musí vozit ulicemi, ty pošleš přes runway. Ale každý kontejner má papíry. A každý falešný papír jednou někdo zkontroluje.", perMinuteStat(180, 45, 0.2 * 60 * 24, 0.2 * 60 * 24, 1), [
    action({ actionId: "express_import", label: "Expresní dovoz", description: "Po 90 sekundách doručí importní zásilku vybrané kategorie do skladu hráče.", effectSummary: "Cena 2000 clean, heat +6, customs risk 10 %", cooldownMs: 18 * minute, durationMs: 90 * 1000, heatGain: 6, inputCost: out("cash", 2000) }),
    action({ actionId: "black_charter", label: "Černý charter", description: "Na 8 minut otevře speciální Black Market nabídku.", effectSummary: "Cena 2500 dirty, heat +9, nabídka -6 %, celní zátah při nákupu 15 %", cooldownMs: 24 * minute, durationMs: 8 * minute, heatGain: 9, inputCost: out("dirty-cash", 2500) }),
    action({ actionId: "evacuation_corridor", label: "Evakuační koridor", description: "Na 7 minut zlepší únik, ztráty při neúspěchu a návratovou logistiku.", effectSummary: "Cena 1800 clean, heat +5, escape +18 %, ztráty -10 %", cooldownMs: 26 * minute, durationMs: 7 * minute, heatGain: 5, inputCost: out("cash", 1800) })
  ]),
  building("port", "Přístav", "downtown", "Logistics", "Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.", perMinuteStat(26, 8.5, 5, 26), [
    action({ actionId: "port_container_cut", label: "Container Cut", description: "Vybere z kontejnerů užitečné zásoby.", effectSummary: "+dirty cash, +materials, +heat", heatGain: 6, outputGain: resources({ "dirty-cash": 160, "metal-parts": 3 }), influenceChange: 1 })
  ]),
  building("parliament", "Parlament", "downtown", "Power", "Nejvyšší politická páka s extrémním clean income a vlivem.", perMinuteStat(22, 3, 3, 40), [
    action({ actionId: "parliament_policy_window", label: "Policy Window", description: "Otevře krátké politické okno pro zisk vlivu.", effectSummary: "+vliv, +clean cash, +heat", heatGain: 5, outputGain: out("cash", 160), influenceChange: 5 })
  ]),

  building("shopping_mall", "Obchodní centrum", "commercial", "Economy / market / influence / multiplier", "Obchodní centrum generuje peníze, menší dirty cash, vliv a snižuje ceny na marketu. Výlohy svítí, kasy pípají a pod parkovištěm se domlouvají dohody, které nikdy neuvidíš na účtence. Obchodní centrum není jen nákupní zóna. Je to tepna zásobování.", perMinuteStat(95, 22, 0.09 * 60 * 24, 0.24 * 60 * 24, 1), []),
  building("restaurant", "Restaurace", "commercial", "Economy / rumors / influence / city life", "Restaurace generuje čisté peníze, trochu vlivu a městské drby. Žádné akce, žádné složitosti. Jen místo, kde město mluví. Stoly u okna, zadní vchod pro kurýry a kuchyně, kde se slyší víc než na ulici.", perMinuteStat(38, 0, 57.6, 172.8, 1), []),
  building("arcade", "Herna", "commercial", "Economy / dirty cash / laundering / network", "Herna je pouliční cashflow. Blikající automaty, špinavé mince, zadní pokladna a dým z cigaret. Sama o sobě tě nespasí, ale síť heren dokáže krmit gang celou free session.", perMinuteStat(42, 72, 172.8, 259.2, 1), [
    action({ actionId: "night_machines", label: "Noční automaty", description: "Dočasně zvýší clean, dirty, vliv, heat a audit risk Herny. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 7 minut", cooldownMs: 16 * minute, durationMs: 7 * minute, effectModifiers: { cleanIncomeMultiplier: 1.35, dirtyIncomeMultiplier: 1.65, influenceMultiplier: 1.15, heatMultiplier: 1.45 } }),
    action({ actionId: "back_cashdesk", label: "Zadní pokladna", description: "Instantně vypere 13 % aktuálního dirty cash hráče přes zadní pokladnu.", effectSummary: "-dirty cash, +clean cash po 15 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 12 * minute, heatGain: 3, influenceChange: 1 })
  ]),
  building("casino", "Kasino", "commercial", "Laundering / high-risk", "Vzácná high-value neonová pračka peněz. Dává extrémní cashflow, dirty cash a vliv, ale rychle zvedá heat a audit risk.", perMinuteStat(140, 260, 648, 1008, 4), [
    action({ actionId: "quiet_backroom", label: "Tichá herna", description: "Instantně vypere 24 % aktuálního dirty cash hráče až do limitu kasina.", effectSummary: "-dirty cash, +clean cash po 9 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 14 * minute, heatGain: 7, influenceChange: 3 }),
    action({ actionId: "vip_night", label: "VIP noc", description: "Dočasně zvýší casino income, vliv, heat a audit risk. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 10 minut", cooldownMs: 26 * minute, durationMs: 10 * minute, effectModifiers: { cleanIncomeMultiplier: 1.7, dirtyIncomeMultiplier: 1.55, influenceMultiplier: 1.25, heatMultiplier: 1.6 } }),
    action({ actionId: "bribed_inspector", label: "Podplacený inspektor", description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší tlak.", effectSummary: "Cena 5500 clean cash, šance selhání 14 %, heat control, audit control", cooldownMs: 32 * minute, durationMs: 12 * minute, inputCost: out("cash", 5500) })
  ]),
  building("car_dealer", "Autosalon", "commercial", "Economy / mobility / logistics / cooldown multiplier", "Autosalon generuje peníze a zlepšuje mobilitu gangu. Lesklé kapoty vpředu, falešné smlouvy vzadu a klíče od aut, která nikdy neuvidí papíry. Autosalon není jen showroom. Je to úniková trasa na kolech.", perMinuteStat(68, 18, 0.08 * 60 * 24, 0, 1), []),
  building("fitness_club", "Fitness Club", "commercial", "Economy / combat support / physical training", "Fitness Club generuje čistý příjem a posiluje fyzickou sílu útoku i obrany. Nezískáš víc lidí. Získáš tvrdší lidi. Rezavé činky, rozbité zrcadlo a trenér, který nepočítá opakování, ale přežití.", perMinuteStat(72, 0, 0.04 * 60 * 24, 0, 1), []),
  building("exchange", "Směnárna", "commercial", "Economy / laundering / network", "Směnárna pere menší částky bezpečněji než kasino. Jedna směnárna je služba. Síť směnáren je finanční pavouk přes celé město.", perMinuteStat(70, 95, 230.4, 403.2, 1), [
    action({ actionId: "good_rate", label: "Výhodný kurz", description: "Instantně vypere 16 % aktuálního dirty cash hráče přes síť směnáren.", effectSummary: "-dirty cash, +clean cash po 12 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 11 * minute, heatGain: 4, influenceChange: 1.5 })
  ]),
  building("apartment_block", "Bytový blok", "residential", "Population / gang members", "Bytový blok negeneruje peníze ani heat. Jen lidi. A lidi jsou munice města.", stat(0, 0, 0, 0, 1), [
    action({ actionId: "collect_population", label: "Vybrat obyvatele", description: "Přesune lokálně uložené obyvatele do globální populace hráče a členů gangu.", effectSummary: "+obyvatelé, +gang members, bez heatu a bez peněz", cooldownMs: 0 })
  ]),
  building("recruitment_center", "Rekrutační centrum", "residential", "Support / population support / combat multiplier", "Rekrutační centrum nevyrábí lidi. Dělá z obyvatel použitelný gang a z výbavy skutečnou sílu. Lidi přijdou z bloků. Tady se z nich stává armáda ulice.", perMinuteStat(35, 0, 0.07 * 60 * 24, 0, 1), []),
  building("garage", "Garáž", "residential", "Economy / logistics / cooldown multiplier", "Garáž generuje čistý příjem a snižuje cooldowny logistických, pohybových a přípravných akcí. Motory běží pod plechovou střechou, kufry mizí ve tmě a někdo vždycky ví, kudy projet bez kamer. Garáž není jen místo pro auta. Je to tempo celého gangu.", perMinuteStat(42, 0, 0.06 * 60 * 24, 0, 1), []),
  building("clinic", "Klinika", "residential", "Economy / recovery / support", "Klinika nevyrábí zbraně ani gang. Zachraňuje to, co by jinak město sežralo.", stat(3300, 0, 43.2, 0, 1), [
    action({
      actionId: "stabilization_protocol",
      label: "Stabilizační protokol",
      description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
      effectSummary: "recovery pool, cena 1200 clean, +1 heat",
      cooldownMs: 18 * minute,
      heatGain: 1,
      inputCost: out("cash", 1200)
    })
  ]),
  building("school", "Škola", "residential", "Population / education / city life", "Škola generuje malé peníze a trochu obyvatel. Není to kasárna. Je to místo, kde město vyrábí chytřejší lidi. Rozbité lavice, studené chodby a tabule popsané věcmi, které se v učebnicích neučí.", perMinuteStat(18, 0, 0, 0.05 * 60 * 24, 1), [
    action({ actionId: "collect_students", label: "Vybrat studenty", description: "Přesune lokálně uložené studenty do globální populace hráče.", effectSummary: "+obyvatelé, bez heatu", cooldownMs: 0 }),
    action({ actionId: "evening_course", label: "Večerní kurz", description: "Na 20 minut zvýší produkci lidí. Nestackuje se.", effectSummary: "Cena 600 clean cash, +60 % produkce lidí na 20 minut", cooldownMs: 35 * minute, durationMs: 20 * minute, inputCost: out("cash", 600), effectModifiers: {} })
  ]),

  building("factory", "Továrna", "industrial", "Production", "Produkční budova pro Metal Parts, Tech Core a Combat Module.", stat(0, 0, 3, 10, 14), [
    legacyAction("produce_metal_parts", "Produce Metal Parts", "Vyrobí kovové díly.", "+metal parts, +heat", 0.003, 1, out("metal-parts", 5)),
    legacyAction("produce_tech_core", "Produce Tech Core", "Sestaví Tech Core z dílů.", "+tech core, +heat", 0.005, 2, out("tech-core", 1), 0, out("metal-parts", 2)),
    legacyAction("produce_combat_module", "Produce Combat Module", "Vyrobí Combat Module.", "+combat module, +vliv, +heat", 0.006, 3, out("combat-module", 1), 1, { "metal-parts": 2, "tech-core": 1 })
  ]),
  building("armory", "Zbrojovka", "industrial", "Weapons", "Vyrábí útočné i obranné vybavení z Metal Parts a Tech Core.", stat(0, 0, 4, 18, 14), [
    legacyAction("armory_craft_weapons", "Craft Weapons", "Vyrobí zbraně ze skladových materiálů.", "+combat module, +heat", 0.006, 3, out("combat-module", 1), 1, { "metal-parts": 2 }),
    legacyAction("armory_fortify", "Fortify District", "Zvedne obrannou připravenost území.", "+vliv, +heat", 8, 4, {}, 3)
  ]),
  building("warehouse", "Sklad", "industrial", "Economy / storage / logistics", "Sklad drží zásoby města pohromadě. Negeneruje špinavé peníze ani vliv, ale bez skladů se impérium zadusí vlastním materiálem.", stat(2700, 0, 86.4, 0, 4), []),
  building("power_station", "Energetická stanice", "industrial", "Infrastructure / support / defense multiplier", "Energetická stanice nezavádí nový zdroj. Zvedá výkon města, drží infrastrukturu při životě a posiluje bezpečnostní systémy. Když svítí stanice, město dýchá rychleji. Kamery vidí ostřeji. Alarmy řvou dřív.", perMinuteStat(50, 0, 115.2, 0, 1), [
    action({ actionId: "backup_grid_switch", label: "Přepnutí na záložní síť", description: "Na 25 minut zvýší infrastructure bonus, posílí kamery a alarmy a přidá výkon Továrnám a Zbrojovkám. Nestackuje se sama se sebou.", effectSummary: "Cena 1200 clean cash, +12 % infrastructure, +20 % kamery, +20 % alarm, heat +3 na 25 minut", cooldownMs: 60 * minute, durationMs: 25 * minute, inputCost: out("cash", 1200), heatGain: 3 }),
    action({ actionId: "power_station_feed_production", label: "Napájet výrobu", description: "Na 25 minut dočasně zvýší čistý provoz districtu.", effectSummary: "+18 % clean income na 25 minut, heat +2", cooldownMs: 60 * minute, durationMs: 25 * minute, heatGain: 2, effectModifiers: { cleanIncomeMultiplier: 1.18 } }),
    action({ actionId: "power_station_reduce_heat", label: "Snížit heat", description: "Serverově sníží heat districtu.", effectSummary: "Heat -2, cooldown 60 minut", cooldownMs: 60 * minute, heatGain: -2 })
  ]),
  building("recycling_center", "Recyklační centrum", "industrial", "Support / salvage / item recovery", "Recyklační centrum nevrací lidi. Vrací železo, zbraně, moduly a všechno, co se dá po boji ještě vytáhnout ze šrotu. Když bitva skončí, někdo počítá mrtvé. Recyklační centrum počítá, co se dá znovu použít.", perMinuteStat(40, 0, 0.08 * 60 * 24, 0, 1), [
    action({ actionId: "extract_losses", label: "Vytěžit ztráty", description: "Vrátí část neexpirovaných itemových ztrát ze salvage poolu. Nikdy nevrací populaci ani členy gangu.", effectSummary: "Cena 900 clean cash, salvage podle sítě Recyklačních center, heat +2", cooldownMs: 16 * minute, inputCost: out("cash", 900), heatGain: 2 })
  ]),

  building("pharmacy", "Lékárna", "commercial", "Production", "Support budova se sloty Chemicals, Biomass a Stim Pack. Vyrobené látky živí Drug Lab a bojové boosty.", stat(0, 0, 3, 8, 14), [
    legacyAction("produce_chemicals", "Produce Chemicals", "Vyrobí základní chemikálie.", "+chemicals, +heat", 0.003, 1, out("chemicals", 6)),
    legacyAction("produce_biomass", "Produce Biomass", "Vyrobí biomasu pro léky a drogy.", "+biomass, +heat", 0.003, 1, out("biomass", 4)),
    legacyAction("produce_stim_pack", "Produce Stim Pack", "Převede chemicals a biomass na Stim Pack.", "+stim pack, +vliv, +heat", 0.004, 2, out("stim-pack", 1), 1, { chemicals: 2, biomass: 1 })
  ]),
  building("drug_lab", "Drug Lab", "park", "Drug production", "Core produkční budova pro Neon Dust, Pulse Shot a Velvet Smoke. Produkce generuje heat a zásoby drog.", stat(0, 0, 6, 20, 14), [
    legacyAction("produce_neon_dust", "Produce Neon Dust", "Syntetizuje Neon Dust.", "+neon dust, +vliv, +heat", 0.004, 3, out("neon-dust", 2), 1, out("chemicals", 1)),
    legacyAction("produce_pulse_shot", "Produce Pulse Shot", "Uvaří Pulse Shot.", "+pulse shot, +vliv, +heat", 0.004, 3, out("pulse-shot", 1), 1, { chemicals: 2, biomass: 1 }),
    legacyAction("produce_velvet_smoke", "Produce Velvet Smoke", "Vyrobí Velvet Smoke.", "+velvet smoke, +vliv, +heat", 0.004, 2, out("velvet-smoke", 2), 1, out("biomass", 2))
  ]),
  building("smuggling_tunnel", "Pašovací tunel", "park", "Dirty cash / smuggling / dealer support / risk reward", "Pašovací tunel je přísun špinavých peněz a tepna pouliční distribuce. Lab vyrobí látky. Dealeři je prodají. Tunely drží proud peněz a zboží dostatečně temný na to, aby město nevidělo, odkud opravdu přichází.", perMinuteStat(0, 54, 0.07 * 60 * 24, 0, 1), [
    action({ actionId: "open_channel", label: "Otevřít kanál", description: "Na 15 minut posílí dirty cash tunelů a prodej Pouličních dealerů. Nestackuje se.", effectSummary: "Cena 800 clean cash, heat +5, +45 % tunel dirty, dealer boost, +risk", cooldownMs: 30 * minute, durationMs: 15 * minute, inputCost: out("cash", 800), heatGain: 5 })
  ]),
  building("convenience_store", "Večerka", "park", "Economy / dirty cash / rumors / influence / street life", "Večerka generuje malé čisté peníze, drobné dirty cash, trochu vlivu a lokální pouliční drby. Zářivky bzučí, dveře pípají a kamera nad regálem vidí víc, než by měla. Večerka není nebezpečná. Nebezpeční jsou lidé, kteří se v ní v noci zastavují.", perMinuteStat(32, 18, 72, 144, 1), []),
  building("strip_club", "Strip Club", "park", "Economy / influence / rumors / social network", "Strip Club generuje peníze, vliv a drby. Není to jen podnik. Je to místo, kde město mluví. Neon na mokrém skle, basy pod podlahou a VIP salonek, kde se šeptá víc než v kanceláři starosty.", perMinuteStat(75, 65, 259.2, 547.2, 1), [
    action({ actionId: "strip_club_collect_cash", label: "Vybrat cash", description: "Okamžitě vybere noční dirty cash ze Strip Clubu.", effectSummary: "+360 dirty cash, heat +3", cooldownMs: 10 * minute, outputGain: out("dirty-cash", 360), heatGain: 3 }),
    action({ actionId: "vip_lounge", label: "Hostit VIP klienty", description: "Dočasně zvýší clean cash, dirty cash, vliv, heat a šanci na drb. Nestackuje se sám se sebou.", effectSummary: "Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 30 minut", cooldownMs: 60 * minute, durationMs: 30 * minute, inputCost: out("cash", 800), effectModifiers: { cleanIncomeMultiplier: 1.45, dirtyIncomeMultiplier: 1.35, influenceMultiplier: 1.55, heatMultiplier: 1.5 } }),
    action({ actionId: "bar_whispers", label: "Šeptanda u baru", description: "Za vliv okamžitě vygeneruje pravděpodobnostní drb. Drb může být falešný.", effectSummary: "Cena 25 influence, instantní drb, heat +2", cooldownMs: 14 * minute, heatGain: 2 }),
    action({ actionId: "private_party", label: "Získat kompro", description: "Přidá okamžitý vliv, dočasně zvýší influence production a může přinést kontakt, extra drb nebo skandál.", effectSummary: "Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 %", cooldownMs: 30 * minute, durationMs: 10 * minute, inputCost: out("cash", 1500), heatGain: 6, influenceChange: 8, effectModifiers: { influenceMultiplier: 1.7 } })
  ]),
  building("street_dealers", "Pouliční dealeři", "park", "Dirty cash / drug distribution / street economy", "Pouliční dealeři generují slabší dirty cash a prodávají látky z Drug Labu za špinavé peníze. Lab vyrobí produkt. Pouliční dealeři ho promění v peníze.", perMinuteStat(0, 36, 0.06 * 60 * 24, 0, 1), [
    action({ actionId: "start_drug_sale", label: "Spustit prodej", description: "Použije globální dealer slot k prodeji látky vyrobené v Drug Labu za dirty cash.", effectSummary: "dealer slot, dirty cash, heat, street risk" }),
    action({ actionId: "street_dealers_collect_hot_cash", label: "Vybrat hot cash", description: "Okamžitě vybere menší balík dirty cash z ulice.", effectSummary: "+280 dirty cash, heat +3", cooldownMs: 10 * minute, outputGain: out("dirty-cash", 280), heatGain: 3 }),
    action({ actionId: "street_dealers_move_stash", label: "Přesunout stash", description: "Spotřebuje biomass a přesune stash do dirty cash.", effectSummary: "Cena 3 biomass, +1000 dirty cash, heat +1", cooldownMs: 10 * minute, inputCost: out("biomass", 3), outputGain: out("dirty-cash", 1000), heatGain: 1 })
  ])
];

export const getAllPublicBuildingDefinitions = (): PublicBuildingDefinition[] =>
  publicBuildingDefinitions.map((definition) => ({
    ...definition,
    nameVariants: [...definition.nameVariants],
    stats: { ...definition.stats },
    specialActions: definition.specialActions.map((buildingAction) => ({
      ...buildingAction,
      inputCost: { ...buildingAction.inputCost },
      outputGain: { ...buildingAction.outputGain },
      effectModifiers: buildingAction.effectModifiers ? { ...buildingAction.effectModifiers } : undefined
    }))
  }));

export const getDefaultBuildingTypesForZone = (zone: string): string[] => {
  const normalizedZone = String(zone || "").trim().toLowerCase();
  if (normalizedZone === "starter") {
    return publicBuildingDefinitions.map((definition) => definition.buildingTypeId);
  }
  return publicBuildingDefinitions
    .filter((definition) => definition.zone === normalizedZone)
    .map((definition) => definition.buildingTypeId);
};
