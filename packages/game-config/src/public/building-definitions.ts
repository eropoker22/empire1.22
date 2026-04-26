import { publicBuildingNameVariants } from "./building-name-variants";

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

const h = (hours: number): number => hours * 60 * 60 * 1000;
const out = (key: string, amount: number): Record<string, number> => ({ [key]: amount });
const a = (
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
  durationMs: Math.max(1000, h(durationHours)),
  cooldownMs: h(cooldownHours),
  inputCost,
  outputGain,
  heatGain,
  influenceChange,
  reportText: effectSummary
});
const b = (
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
const s = (cleanPerHour: number, dirtyPerHour: number, heatPerDay: number, influencePerDay: number, maxLevel = 5) => ({
  cleanPerHour,
  dirtyPerHour,
  heatPerDay,
  influencePerDay,
  maxLevel
});

export const publicBuildingDefinitions: PublicBuildingDefinition[] = [
  b("central_bank", "Centrální banka", "downtown", "Finance", "Hlavní finanční uzel pro clean cash, kontrolu kapitálu a vysoký systémový vliv.", s(1560, 60, 3, 32), [a("central_bank_reserve_audit", "Reserve Audit", "Přesměruje část rezerv do tvého účtu.", "+clean cash, +vliv, +heat", 8, 5, out("cash", 180), 2)]),
  b("city_hall", "Magistrát", "downtown", "Civic control", "Administrativní centrum s vysokým clean income a vlivem nad městskými procesy.", s(1500, 360, 4, 34), [a("city_hall_permit_pressure", "Permit Pressure", "Protlačí povolení a lokální zakázky.", "+clean cash, +vliv, +heat", 8, 4, out("cash", 150), 3)]),
  b("lobby_club", "Lobby klub", "downtown", "Influence", "Diskrétní klub pro kontakty, špinavé finance a politické páky.", s(180, 1320, 6, 38), [a("lobby_club_backroom_deal", "Backroom Deal", "Domluví vlivnou dohodu mimo záznam.", "+dirty cash, +vliv, +heat", 8, 6, out("dirty-cash", 180), 4)]),
  b("stock_exchange", "Burza", "downtown", "Market", "Volatilní kapitál, rychlé přesuny cashflow a finanční riziko.", s(1080, 60, 3, 24), [a("stock_exchange_market_push", "Market Push", "Krátký tržní tlak vytáhne clean cash.", "+clean cash, +heat", 7, 4, out("cash", 140), 1)]),
  b("court", "Soud", "downtown", "Law", "Právní páka pro tlak na území, obranu a politický vliv.", s(1200, 600, 4, 28), [a("court_case_pressure", "Case Pressure", "Využije právní tlak pro vliv v districtu.", "+vliv, +clean cash, +heat", 9, 4, out("cash", 110), 4)]),
  b("vip_lounge", "VIP salonek", "downtown", "Elite", "Elitní zóna pro high-value kontakty, dirty cash a zákulisní dohody.", s(480, 1320, 6, 36), [a("vip_lounge_private_table", "Private Table", "Uzavře soukromý deal s VIP hosty.", "+dirty cash, +vliv, +heat", 10, 7, out("dirty-cash", 220), 3)]),
  b("airport", "Letiště", "downtown", "Logistics", "Vzdušný logistický uzel pro rychlý přesun zboží a lidí.", s(1140, 60, 4, 22), [a("airport_fast_manifest", "Fast Manifest", "Zrychlí přepravní manifest a vytěží cash.", "+clean cash, +materials, +heat", 9, 5, { cash: 130, "metal-parts": 2 }, 1)]),
  b("port", "Přístav", "downtown", "Logistics", "Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.", s(1560, 510, 5, 26), [a("port_container_cut", "Container Cut", "Vybere z kontejnerů užitečné zásoby.", "+dirty cash, +materials, +heat", 8, 6, { "dirty-cash": 160, "metal-parts": 3 }, 1)]),
  b("parliament", "Parlament", "downtown", "Power", "Nejvyšší politická páka s extrémním clean income a vlivem.", s(1320, 180, 3, 40), [a("parliament_policy_window", "Policy Window", "Otevře krátké politické okno pro zisk vlivu.", "+vliv, +clean cash, +heat", 12, 5, out("cash", 160), 5)]),

  b("mall", "Obchodní centrum", "commercial", "Retail", "Prémiový retail s vysokým clean cashflow a bezpečným veřejným krytím.", s(480, 60, 2.5, 14), [a("mall_peak_hours", "Peak Hours", "Vytěží dopravní špičku obchodního centra.", "+clean cash, +heat", 6, 3, out("cash", 90), 1)]),
  b("restaurant", "Restaurace", "commercial", "Social", "Safe sociální budova pro kšefty, kontakty a menší district akce.", s(300, 30, 3, 14), [a("restaurant_gang_dinner", "Gang Dinner", "Na chvíli zvedne district income a kontakty.", "+clean cash, +vliv, +heat", 8, 4, out("cash", 80), 2, {}, 2), a("restaurant_street_gossip", "Street Gossip", "Získá lokální drby a vliv.", "+vliv, +heat", 6, 3, {}, 3)]),
  b("arcade", "Herna", "commercial", "Cashflow", "Automaty a hry pro rychlé clean i dirty cashflow.", s(360, 72, 5, 20), [a("arcade_tournament", "Turnaj", "Zvedne příjem herny turnajem.", "+clean cash, +heat", 6, 5, out("cash", 90), 1, {}, 2), a("arcade_laundering", "Praní peněz", "Převede část dirty cash přes hernu.", "+clean cash, -dirty cash, +heat", 7, 4, out("cash", 70), 0, out("dirty-cash", 80))]),
  b("pharmacy", "Lékárna", "commercial", "Production", "Support budova se sloty Chemicals, Biomass a Stim Pack. Vyrobené látky živí Drug Lab a bojové boosty.", s(0, 0, 3, 8, 14), [a("produce_chemicals", "Produce Chemicals", "Vyrobí základní chemikálie.", "+chemicals, +heat", 0.003, 1, out("chemicals", 6)), a("produce_biomass", "Produce Biomass", "Vyrobí biomasu pro léky a drogy.", "+biomass, +heat", 0.003, 1, out("biomass", 4)), a("produce_stim_pack", "Produce Stim Pack", "Převede chemicals a biomass na Stim Pack.", "+stim pack, +vliv, +heat", 0.004, 2, out("stim-pack", 1), 1, { chemicals: 2, biomass: 1 })]),
  b("casino", "Kasino", "commercial", "Laundering", "Vysoké cashflow, praní dirty cash, vliv a risk policejního tlaku.", s(480, 132, 7, 30), [a("launder_dirty_cash", "Launder Dirty Cash", "Pere dirty cash přes kasino.", "+clean cash, -dirty cash, +heat", 0.005, 2, out("cash", 80), 1, out("dirty-cash", 100)), a("casino_high_stakes", "High Stakes", "Riskantní sázka s okamžitým ziskem.", "+clean cash, +heat", 6, 10, out("cash", 180), 1)]),
  b("auto_salon", "Autosalon", "commercial", "Logistics", "Legální prodeje, šedý dovoz a mobilita flotily.", s(300, 60, 4, 18, 4), [a("auto_salon_premium_offer", "Premium Offer", "Krátce posílí prodej clean cash.", "+clean cash, +heat", 4, 2, out("cash", 95), 1, {}, 2), a("auto_salon_gray_import", "Šedý dovoz", "Přidá dirty cash přes importní kanál.", "+dirty cash, +heat", 6, 5, out("dirty-cash", 130), 1)]),
  b("fitness_club", "Fitness Club", "commercial", "Combat utility", "Bojová utility budova pro ATK/DEF buffy, vliv a district income.", s(260, 160, 4.5, 26), [a("fitness_gang_training", "Trénink gangu", "Dočasný bojový trénink gangu.", "+gang members, +vliv, +heat", 8, 5, out("gang-members", 1), 2, {}, 2), a("fitness_doping", "Doping", "Agresivní bojový boost s pozdějším rizikem.", "+stim pack efekt, +heat", 12, 8, out("stim-pack", 1), 0, {}, 1)]),
  b("exchange", "Směnárna", "commercial", "Finance", "Rychlé finanční operace, clean/dirty cash a menší heat než kasino.", s(330, 78, 3.5, 18), [a("exchange_dirty_to_clean_cash", "Exchange Dirty Cash", "Smění dirty cash na čisté peníze.", "+clean cash, -dirty cash, +heat", 0.004, 1, out("cash", 45), 0, out("dirty-cash", 50)), a("exchange_quick_liquidity", "Quick Liquidity", "Okamžitě vytáhne clean cash z likvidity.", "+clean cash, +heat", 10, 5, out("cash", 120), 1)]),
  b("office_block", "Kancelářský blok", "commercial", "Corporate", "Korporátní zázemí pro stabilní cash a administrativní krytí.", s(360, 60, 2, 16), [a("office_contract_stack", "Contract Stack", "Vytěží firemní zakázky a kontakty.", "+clean cash, +vliv, +heat", 7, 3, out("cash", 90), 2)]),

  b("apartment_block", "Bytový blok", "residential", "Population", "Personální centrum gangu. Produkuje členy, drží kapacitu a umožňuje náborové akce.", s(90, 30, 3, 10, 4), [a("collect_gang_members", "Collect Gang Members", "Nabere dostupné členy z bytového bloku.", "+gang members, +vliv, +heat", 0.005, 1, out("gang-members", 2), 1), a("apartment_hidden_housing", "Skryté ubytování", "Spustí ochranný režim za cenu income.", "+vliv, +heat", 8, 3, {}, 2, {}, 2)]),
  b("recruitment_center", "Rekrutační centrum", "residential", "Recruitment", "Cílený nábor a posílení obyvatel pro gang.", s(120, 18, 2, 12, 4), [a("recruitment_drive", "Recruitment Drive", "Získá nové členy gangu.", "+gang members, +heat", 4, 3, out("gang-members", 4), 1)]),
  b("brainwash_center", "Brainwash centrum", "residential", "Loyalty", "Tlak na loajalitu populace, vliv a poslušnost území.", s(480, 90, 4, 22), [a("brainwash_loyalty_push", "Loyalty Push", "Zvedne lokální poslušnost a vliv.", "+vliv, +dirty cash, +heat", 8, 5, out("dirty-cash", 90), 4)]),
  b("garage", "Garage", "residential", "Mobility", "Mobilita gangu, vozidla a krytá logistika.", s(180, 30, 2.5, 10), [a("garage_fast_route", "Fast Route", "Zrychlí lokální přesuny a přinese cash.", "+clean cash, +heat", 5, 3, out("cash", 70), 1)]),
  b("taxi_service", "Taxi služba", "residential", "Mobility", "Nenápadná síť řidičů pro pohyb, informace a menší dirty cash.", s(330, 90, 3, 12), [a("taxi_night_routes", "Night Routes", "Noční jízdy přinesou dirty cash.", "+dirty cash, +heat", 6, 4, out("dirty-cash", 90), 1)]),
  b("clinic", "Klinika", "residential", "Recovery", "Regenerace lidí, krytí zranění a stabilizace území.", s(150, 18, 1.5, 10), [a("clinic_patch_up", "Patch Up", "Vrátí část lidí do akce.", "+gang members, +heat", 5, 2, out("gang-members", 2), 1)]),
  b("school", "Škola", "residential", "Training", "Produkuje členy a umí podpořit Drug Lab přes chemický kurz.", s(264, 60, 2, 16, 4), [a("school_lecture", "Náborová přednáška", "Okamžitě přidá nové členy.", "+gang members, +heat", 3, 2, out("gang-members", 4), 1), a("school_chemistry_course", "Zrychlený kurz chemie", "Podpoří chemickou výrobu v districtu.", "+chemicals, +heat", 4, 3, out("chemicals", 4), 1, {}, 2)]),

  b("factory", "Továrna", "industrial", "Production", "Produkční budova pro Metal Parts, Tech Core a Combat Module.", s(0, 0, 3, 10, 14), [a("produce_metal_parts", "Produce Metal Parts", "Vyrobí kovové díly.", "+metal parts, +heat", 0.003, 1, out("metal-parts", 5)), a("produce_tech_core", "Produce Tech Core", "Sestaví Tech Core z dílů.", "+tech core, +heat", 0.005, 2, out("tech-core", 1), 0, out("metal-parts", 2)), a("produce_combat_module", "Produce Combat Module", "Vyrobí Combat Module.", "+combat module, +vliv, +heat", 0.006, 3, out("combat-module", 1), 1, { "metal-parts": 2, "tech-core": 1 })]),
  b("armory", "Zbrojovka", "industrial", "Weapons", "Vyrábí útočné i obranné vybavení z Metal Parts a Tech Core.", s(0, 0, 4, 18, 14), [a("armory_craft_weapons", "Craft Weapons", "Vyrobí zbraně ze skladových materiálů.", "+combat module, +heat", 0.006, 3, out("combat-module", 1), 1, { "metal-parts": 2 }), a("armory_fortify", "Fortify District", "Zvedne obrannou připravenost území.", "+vliv, +heat", 8, 4, {}, 3)]),
  b("warehouse", "Sklad", "industrial", "Storage", "Sklad zvyšuje zásoby, materiály a kapacitu produkčních budov.", s(120, 120, 2.8, 14), [a("collect_stored_resources", "Collect Stored Resources", "Vybere uložené resources.", "+chemicals, +metal parts, +dirty cash, +heat", 0.004, 1, { chemicals: 2, "metal-parts": 2, "dirty-cash": 50 }), a("warehouse_hidden_storage", "Hidden Storage", "Připraví krytý sklad.", "+dirty cash, +vliv, +heat", 10, 4, out("dirty-cash", 90), 2, {}, 3)]),
  b("power_station", "Energetická stanice", "industrial", "Infrastructure", "Napájení produkce a stabilní infrastruktura pro průmysl.", s(240, 18, 2.5, 12), [a("power_station_overclock", "Overclock Grid", "Krátce přetíží grid ve prospěch výroby.", "+tech core, +heat", 8, 5, out("tech-core", 1), 1, {}, 2)]),
  b("data_center", "Datové centrum", "industrial", "Intel", "Datová infrastruktura pro tracking, hacky a cooldown utility.", s(300, 180, 5.5, 32), [a("data_center_tracking", "Player Tracking", "Vytáhne stopu aktivit z dat.", "+vliv, +dirty cash, +heat", 8, 6, out("dirty-cash", 100), 3), a("data_center_data_boost", "Data Boost", "Zrychlí technické operace.", "+tech core, +heat", 12, 8, out("tech-core", 1), 1, {}, 2)]),
  b("research_center", "Výzkumné centrum", "industrial", "Research", "Výzkum optimalizuje produkci, experimenty a technologické upgrady.", s(220, 140, 4.8, 30), [a("research_optimize_production", "Optimalizace výroby", "Zvýší efektivitu produkce.", "+tech core, +heat", 8, 6, out("tech-core", 1), 2, {}, 2), a("research_process_waste", "Zpracování odpadu", "Získá materiály z odpadu.", "+materials, +heat", 6, 3, { chemicals: 2, "metal-parts": 2 }, 1)]),
  b("recycling_center", "Recyklační centrum", "industrial", "Recovery", "Obnova zdrojů, rozklad zásilek a materiálová záchrana.", s(170, 130, 4, 16), [a("recycling_break_shipment", "Break Shipment", "Rozebere zásilku na použitelné materiály.", "+chemicals, +metal parts, +heat", 8, 5, { chemicals: 2, "metal-parts": 5 }, 1)]),

  b("drug_lab", "Drug Lab", "park", "Drug production", "Core produkční budova pro Neon Dust, Pulse Shot a Velvet Smoke. Produkce generuje heat a zásoby drog.", s(0, 0, 6, 20, 14), [a("produce_neon_dust", "Produce Neon Dust", "Syntetizuje Neon Dust.", "+neon dust, +vliv, +heat", 0.004, 3, out("neon-dust", 2), 1, out("chemicals", 1)), a("produce_pulse_shot", "Produce Pulse Shot", "Uvaří Pulse Shot.", "+pulse shot, +vliv, +heat", 0.004, 3, out("pulse-shot", 1), 1, { chemicals: 2, biomass: 1 }), a("produce_velvet_smoke", "Produce Velvet Smoke", "Vyrobí Velvet Smoke.", "+velvet smoke, +vliv, +heat", 0.004, 2, out("velvet-smoke", 2), 1, out("biomass", 2))]),
  b("smuggling_tunnel", "Pašovací tunel", "park", "Smuggling", "Skrytý logistický koridor pro dirty cash, drogy a park income.", s(100, 260, 4.3, 18), [a("smuggling_big_shipment", "Big Shipment", "Protlačí větší zásilku přes tunel.", "+dirty cash, +drugs, +heat", 8, 10, { "dirty-cash": 150, "neon-dust": 2 }, 1)]),
  b("convenience_store", "Večerka", "park", "Cover shop", "Malý obchod, co nikdy nezavírá. Přes den normální kšeft, v noci jiný byznys.", s(210, 78, 2.5, 8), [a("convenience_night_sale", "Noční prodej", "Noční provoz posílí income.", "+cash, +heat", 6, 3, out("cash", 60), 1, {}, 4), a("convenience_small_deal", "Malý deal", "Rychlý prodej Neon Dust.", "+dirty cash, +heat", 7, 4, out("dirty-cash", 90))]),
  b("strip_club", "Strip club", "park", "Nightlife", "Noční podnik s dirty cash, vlivem a kontakty.", s(220, 200, 5, 28), [a("strip_club_vip_night", "VIP Night", "VIP noc zvýší příjmy a kontakty.", "+dirty cash, +vliv, +heat", 6, 6, out("dirty-cash", 140), 3, {}, 2)]),
  b("street_dealers", "Pouliční dealeři", "park", "Distribution", "Pouliční distribuční síť pro drogy, dirty cash a lokální heat.", s(6, 270, 7, 3.5), [a("street_dealers_aggressive_push", "Aggressive Push", "Agresivní pouliční prodej.", "+dirty cash, +heat", 6, 8, out("dirty-cash", 130), 1, {}, 1)])
];

export const getAllPublicBuildingDefinitions = (): PublicBuildingDefinition[] =>
  publicBuildingDefinitions.map((definition) => ({
    ...definition,
    nameVariants: [...definition.nameVariants],
    stats: { ...definition.stats },
    specialActions: definition.specialActions.map((action) => ({
      ...action,
      inputCost: { ...action.inputCost },
      outputGain: { ...action.outputGain }
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
