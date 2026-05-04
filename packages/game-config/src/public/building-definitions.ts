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
  building("central_bank", "Centrální banka", "downtown", "Finance", "Hlavní finanční uzel pro clean cash a kontrolu kapitálu.", perMinuteStat(26, 1, 3, 32), [
    action({ actionId: "central_bank_reserve_audit", label: "Reserve Audit", description: "Přesměruje část rezerv do tvého účtu.", effectSummary: "+clean cash, +vliv, +heat", heatGain: 5, outputGain: out("cash", 180), influenceChange: 2 })
  ]),
  building("city_hall", "Magistrát", "downtown", "Civic control", "Administrativní centrum pro městské procesy a legální krytí.", perMinuteStat(25, 6, 4, 34), [
    action({ actionId: "city_hall_permit_pressure", label: "Permit Pressure", description: "Protlačí povolení a lokální zakázky.", effectSummary: "+clean cash, +vliv, +heat", heatGain: 4, outputGain: out("cash", 150), influenceChange: 3 })
  ]),
  building("lobby_club", "Lobby klub", "downtown", "Influence", "Diskrétní klub pro kontakty, špinavé finance a politické páky.", perMinuteStat(3, 22, 6, 38), [
    action({ actionId: "lobby_club_backroom_deal", label: "Backroom Deal", description: "Domluví vlivnou dohodu mimo záznam.", effectSummary: "+dirty cash, +vliv, +heat", heatGain: 6, outputGain: out("dirty-cash", 180), influenceChange: 4 })
  ]),
  building("stock_exchange", "Burza", "downtown", "Market", "Volatilní kapitál a rychlé přesuny cashflow.", perMinuteStat(18, 1, 3, 24), [
    action({ actionId: "stock_exchange_market_push", label: "Market Push", description: "Krátký tržní tlak vytáhne clean cash.", effectSummary: "+clean cash, +heat", heatGain: 4, outputGain: out("cash", 140), influenceChange: 1 })
  ]),
  building("court", "Soud", "downtown", "Law", "Právní páka pro tlak na území, obranu a politický vliv.", perMinuteStat(16, 4, 3.2, 32), [
    action({ actionId: "court_case_pressure", label: "Case Pressure", description: "Využije právní tlak pro vliv, krytí a obranu districtu.", effectSummary: "+vliv, +obrana, +clean cash, +heat", heatGain: 3, outputGain: out("cash", 110), influenceChange: 5 })
  ]),
  building("vip_lounge", "VIP salonek", "downtown", "Elite", "Elitní zóna pro high-value kontakty, dirty cash a zákulisní dohody.", perMinuteStat(8, 22, 6, 36), [
    action({ actionId: "vip_lounge_private_table", label: "Private Table", description: "Uzavře soukromý deal s VIP hosty.", effectSummary: "+dirty cash, +vliv, +heat", heatGain: 7, outputGain: out("dirty-cash", 220), influenceChange: 3 })
  ]),
  building("airport", "Letiště", "downtown", "Logistics", "Vzdušný logistický uzel pro rychlý přesun zboží, lidí a informací.", perMinuteStat(14, 2, 4, 20), [
    action({ actionId: "airport_fast_manifest", label: "Fast Manifest", description: "Zrychlí přepravní manifest a vytěží cash, zásoby a stopu o okolí.", effectSummary: "+clean cash, +suroviny, +info, +heat", heatGain: 5, outputGain: resources({ cash: 130, "metal-parts": 2, "tech-core": 1 }), influenceChange: 1 })
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
  building("school", "Škola", "residential", "Training", "Produkuje členy a podporuje disciplínu a chemické zázemí.", perMinuteStat(4.4, 1, 2, 16), [
    action({ actionId: "school_lecture", label: "Trénovat členy", description: "Okamžitě přidá nové členy.", effectSummary: "+gang members, +heat", heatGain: 2, outputGain: out("gang-members", 4), influenceChange: 1 }),
    action({ actionId: "school_discipline", label: "Zvýšit disciplínu", description: "Disciplína zlepší obranu na pár minut.", effectSummary: "+obrana, +defense, +vliv, +heat", durationMs: 8 * minute, heatGain: 2, outputGain: out("vest", 1), influenceChange: 2, effectModifiers: { defenseMultiplier: 1.08 } }),
    action({ actionId: "school_chemistry_course", label: "Budovat vliv", description: "Kurz a kontakty přidají chemii i vliv.", effectSummary: "+chemicals, +vliv, +heat", heatGain: 3, outputGain: out("chemicals", 4), influenceChange: 3 })
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
    action({ actionId: "backup_grid_switch", label: "Přepnutí na záložní síť", description: "Na 8 minut zvýší infrastructure bonus, posílí kamery a alarmy a přidá výkon Továrnám a Zbrojovkám. Nestackuje se sama se sebou.", effectSummary: "Cena 1200 clean cash, +12 % infrastructure, +20 % kamery, +20 % alarm, heat +3 na 8 minut", cooldownMs: 22 * minute, durationMs: 8 * minute, inputCost: out("cash", 1200), heatGain: 3 })
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
  building("smuggling_tunnel", "Pašovací tunel", "park", "Dirty cash / smuggling / stash / risk reward", "Pašovací tunel není obchod. Je to díra pod městem, která plive špinavé peníze. Čím déle ji necháš běžet, tím větší balík vytáhneš. A tím víc bude město cítit, že pod ním něco hnije.", perMinuteStat(0, 62, 0.03 * 60 * 24, 0, 1), [
    action({ actionId: "silent_channel", label: "Tichý kanál", description: "Na 8 minut zvýší dirty cash produkci, passive heat a kapacitu dávky v daném tunelu. Nestackuje se a po skončení má riziko zátahu.", effectSummary: "Cena 600 dirty cash, +80 % dirty production, +100 % passive heat, +25 % kapacita, 12 % zátah", cooldownMs: 20 * minute, durationMs: 8 * minute, inputCost: out("dirty-cash", 600) })
  ]),
  building("convenience_store", "Večerka", "park", "Economy / dirty cash / rumors / influence / street life", "Večerka generuje malé čisté peníze, drobné dirty cash, trochu vlivu a lokální pouliční drby. Zářivky bzučí, dveře pípají a kamera nad regálem vidí víc, než by měla. Večerka není nebezpečná. Nebezpeční jsou lidé, kteří se v ní v noci zastavují.", perMinuteStat(32, 18, 72, 144, 1), []),
  building("strip_club", "Strip Club", "park", "Economy / influence / rumors / social network", "Strip Club generuje peníze, vliv a drby. Není to jen podnik. Je to místo, kde město mluví. Neon na mokrém skle, basy pod podlahou a VIP salonek, kde se šeptá víc než v kanceláři starosty.", perMinuteStat(75, 65, 259.2, 547.2, 1), [
    action({ actionId: "vip_lounge", label: "VIP salonek", description: "Dočasně zvýší clean cash, dirty cash, vliv, heat a šanci na drb. Nestackuje se sám se sebou.", effectSummary: "Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 8 minut", cooldownMs: 18 * minute, durationMs: 8 * minute, inputCost: out("cash", 800), effectModifiers: { cleanIncomeMultiplier: 1.45, dirtyIncomeMultiplier: 1.35, influenceMultiplier: 1.55, heatMultiplier: 1.5 } }),
    action({ actionId: "bar_whispers", label: "Šeptanda u baru", description: "Za vliv okamžitě vygeneruje pravděpodobnostní drb. Drb může být falešný.", effectSummary: "Cena 25 influence, instantní drb, heat +2", cooldownMs: 14 * minute, heatGain: 2 }),
    action({ actionId: "private_party", label: "Soukromá party", description: "Přidá okamžitý vliv, dočasně zvýší influence production a může přinést kontakt, extra drb nebo skandál.", effectSummary: "Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 %", cooldownMs: 24 * minute, durationMs: 10 * minute, inputCost: out("cash", 1500), heatGain: 6, influenceChange: 8, effectModifiers: { influenceMultiplier: 1.7 } })
  ]),
  building("street_dealers", "Pouliční dealeři", "park", "Distribution", "Pouliční distribuční síť pro drogy, dirty cash a lokální heat.", perMinuteStat(0.1, 4.5, 7, 3.5), [
    action({ actionId: "street_dealers_aggressive_push", label: "Rozšířit distribuci", description: "Distribuce zvedne dirty cash a income.", effectSummary: "+dirty cash, +dirty income, +heat", durationMs: 10 * minute, heatGain: 4, outputGain: out("dirty-cash", 360), effectModifiers: { dirtyIncomeMultiplier: 1.35 } }),
    action({ actionId: "street_dealers_collect_cash", label: "Vybrat cash", description: "Hotový cash se vybere.", effectSummary: "+dirty cash, +heat", heatGain: 3, outputGain: out("dirty-cash", 280) }),
    action({ actionId: "street_dealers_move_stash", label: "Přesunout stash", description: "Stash se přesune do zásob.", effectSummary: "+biomass, +heat", heatGain: 1, outputGain: out("biomass", 2) })
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
