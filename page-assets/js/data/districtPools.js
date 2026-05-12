import { registerEmpireData } from "./registry.js";

export const DISTRICT_BUILDING_PACKAGE_POOLS = Object.freeze({
  resident: Object.freeze({
    early: Object.freeze([
      Object.freeze({ key: "res-early-1", tier: "early", title: "Startovní růst", buildings: Object.freeze(["Bytový blok", "Garage"]) }),
      Object.freeze({ key: "res-early-2", tier: "early", title: "Stabilní základna", buildings: Object.freeze(["Bytový blok", "Herna"]) }),
      Object.freeze({ key: "res-early-3", tier: "early", title: "První nábor", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum"]) }),
      Object.freeze({ key: "res-early-4", tier: "early", title: "Obytná kontrola", buildings: Object.freeze(["Bytový blok", "Herna", "Garage"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "res-mid-1", tier: "mid", title: "Mobilní posily", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum", "Garage"]) }),
      Object.freeze({ key: "res-mid-2", tier: "mid", title: "Udržitelný růst", buildings: Object.freeze(["Bytový blok", "Klinika"]) }),
      Object.freeze({ key: "res-mid-3", tier: "mid", title: "Disciplína a kvalita", buildings: Object.freeze(["Bytový blok", "Škola"]) }),
      Object.freeze({ key: "res-mid-4", tier: "mid", title: "Loajalita a výcvik", buildings: Object.freeze(["Herna", "Škola"]) }),
      Object.freeze({ key: "res-mid-5", tier: "mid", title: "Regenerace fronty", buildings: Object.freeze(["Rekrutační centrum", "Klinika"]) }),
      Object.freeze({ key: "res-mid-6", tier: "mid", title: "Kontrolovaný development", buildings: Object.freeze(["Bytový blok", "Herna", "Škola"]) })
    ]),
    late: Object.freeze([
      Object.freeze({ key: "res-late-1", tier: "late", title: "Válečné zázemí", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum", "Klinika"]) }),
      Object.freeze({ key: "res-late-2", tier: "late", title: "Mobilní tlak", buildings: Object.freeze(["Rekrutační centrum", "Garage", "Klinika"]) }),
      Object.freeze({ key: "res-late-3", tier: "late", title: "Loajální populace", buildings: Object.freeze(["Bytový blok", "Herna", "Klinika"]) }),
      Object.freeze({ key: "res-late-4", tier: "late", title: "Elitní rezidenční zóna", buildings: Object.freeze(["Bytový blok", "Škola", "Klinika"]) }),
      Object.freeze({ key: "res-late-5", tier: "late", title: "Strategická mobilizace", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum", "Škola"]) })
    ])
  }),
  economy: Object.freeze({
    early: Object.freeze([
      Object.freeze({ key: "eco-early-1", tier: "early", title: "Stabilní provoz", buildings: Object.freeze(["Restaurace", "Fitness Club"]) }),
      Object.freeze({ key: "eco-early-2", tier: "early", title: "Civilní utility", buildings: Object.freeze(["Restaurace", "Lékárna"]) }),
      Object.freeze({ key: "eco-early-3", tier: "early", title: "Lehký cashflow", buildings: Object.freeze(["Restaurace", "Směnárna"]) }),
      Object.freeze({ key: "eco-early-4", tier: "early", title: "Bezpečný mix", buildings: Object.freeze(["Restaurace", "Lékárna", "Fitness Club"]) }),
      Object.freeze({ key: "eco-early-5", tier: "early", title: "Startovní mobilita", buildings: Object.freeze(["Autosalon", "Restaurace"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "eco-mid-1", tier: "mid", title: "Utility growth", buildings: Object.freeze(["Autosalon", "Lékárna"]) }),
      Object.freeze({ key: "eco-mid-2", tier: "mid", title: "Finanční uzel", buildings: Object.freeze(["Autosalon", "Směnárna"]) }),
      Object.freeze({ key: "eco-mid-3", tier: "mid", title: "Korporátní stabilita", buildings: Object.freeze(["Obchodní centrum", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-4", tier: "mid", title: "Administrativní utility", buildings: Object.freeze(["Obchodní centrum", "Lékárna", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-5", tier: "mid", title: "Hlavní retail", buildings: Object.freeze(["Obchodní centrum", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-6", tier: "mid", title: "Vyvážený obchod", buildings: Object.freeze(["Restaurace", "Lékárna", "Směnárna"]) }),
      Object.freeze({ key: "eco-mid-7", tier: "mid", title: "Mobilní front", buildings: Object.freeze(["Autosalon", "Směnárna", "Restaurace"]) })
    ]),
    top: Object.freeze([
      Object.freeze({ key: "eco-top-1", tier: "top", title: "Kasino hotspot", buildings: Object.freeze(["Kasino", "Restaurace"]) }),
      Object.freeze({ key: "eco-top-2", tier: "top", title: "Shady premium", buildings: Object.freeze(["Kasino", "Restaurace", "Lékárna"]) }),
      Object.freeze({ key: "eco-top-3", tier: "top", title: "Black cash engine", buildings: Object.freeze(["Kasino", "Směnárna", "Autosalon"]) }),
      Object.freeze({ key: "eco-top-4", tier: "top", title: "Prémiový retail", buildings: Object.freeze(["Obchodní centrum", "Lékárna", "Restaurace"]) }),
      Object.freeze({ key: "eco-top-5", tier: "top", title: "Financial boulevard", buildings: Object.freeze(["Obchodní centrum", "Směnárna", "Restaurace"]) })
    ])
  }),
  park: Object.freeze({
    early: Object.freeze([
      Object.freeze({ key: "park-early-1", tier: "early", title: "Street cash", buildings: Object.freeze(["Pouliční dealeři", "Večerka"]) }),
      Object.freeze({ key: "park-early-2", tier: "early", title: "Quick runners", buildings: Object.freeze(["Pouliční dealeři", "Pašovací tunel"]) }),
      Object.freeze({ key: "park-early-3", tier: "early", title: "Night cover", buildings: Object.freeze(["Strip club", "Večerka"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "park-mid-1", tier: "mid", title: "Distribution lane", buildings: Object.freeze(["Drug lab", "Pašovací tunel"]) }),
      Object.freeze({ key: "park-mid-2", tier: "mid", title: "Vice market", buildings: Object.freeze(["Strip club", "Pouliční dealeři"]) }),
      Object.freeze({ key: "park-mid-3", tier: "mid", title: "Covered traffic", buildings: Object.freeze(["Pašovací tunel", "Večerka"]) }),
      Object.freeze({ key: "park-mid-4", tier: "mid", title: "Hidden production", buildings: Object.freeze(["Drug lab", "Večerka"]) }),
      Object.freeze({ key: "park-mid-5", tier: "mid", title: "Night logistics", buildings: Object.freeze(["Strip club", "Pašovací tunel"]) })
    ]),
    top: Object.freeze([
      Object.freeze({ key: "park-top-1", tier: "top", title: "Chaos corridor", buildings: Object.freeze(["Drug lab", "Pašovací tunel", "Pouliční dealeři"]) }),
      Object.freeze({ key: "park-top-2", tier: "top", title: "Vice empire", buildings: Object.freeze(["Drug lab", "Strip club"]) }),
      Object.freeze({ key: "park-top-3", tier: "top", title: "Black nightlife", buildings: Object.freeze(["Strip club", "Pouliční dealeři", "Večerka"]) }),
      Object.freeze({ key: "park-top-4", tier: "top", title: "Hot route", buildings: Object.freeze(["Drug lab", "Pašovací tunel", "Večerka"]) })
    ])
  }),
  industrial: Object.freeze({
    early: Object.freeze([
      Object.freeze({ key: "ind-early-1", tier: "early", title: "Základní výroba", buildings: Object.freeze(["Továrna", "Sklad"]) }),
      Object.freeze({ key: "ind-early-2", tier: "early", title: "Napájená produkce", buildings: Object.freeze(["Továrna", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-early-3", tier: "early", title: "První militarizace", buildings: Object.freeze(["Továrna", "Zbrojovka"]) }),
      Object.freeze({ key: "ind-early-4", tier: "early", title: "Zásobovací uzel", buildings: Object.freeze(["Sklad", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-early-5", tier: "early", title: "Základní recyklace", buildings: Object.freeze(["Továrna", "Recyklační centrum"]) }),
      Object.freeze({ key: "ind-early-6", tier: "early", title: "Recyklační tok", buildings: Object.freeze(["Sklad", "Recyklační centrum"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "ind-mid-1", tier: "mid", title: "Vojenská výroba", buildings: Object.freeze(["Zbrojovka", "Sklad"]) }),
      Object.freeze({ key: "ind-mid-2", tier: "mid", title: "Technický provoz", buildings: Object.freeze(["Továrna", "Recyklační centrum"]) }),
      Object.freeze({ key: "ind-mid-3", tier: "mid", title: "Efektivní řetězec", buildings: Object.freeze(["Továrna", "Sklad", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-mid-4", tier: "mid", title: "Zbrojní logistika", buildings: Object.freeze(["Zbrojovka", "Sklad", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-mid-5", tier: "mid", title: "Recyklační sklad", buildings: Object.freeze(["Sklad", "Recyklační centrum"]) }),
      Object.freeze({ key: "ind-mid-6", tier: "mid", title: "Recyklace a obrana", buildings: Object.freeze(["Recyklační centrum", "Zbrojovka"]) }),
      Object.freeze({ key: "ind-mid-7", tier: "mid", title: "Obnova zdrojů", buildings: Object.freeze(["Továrna", "Recyklační centrum", "Sklad"]) })
    ]),
    top: Object.freeze([
      Object.freeze({ key: "ind-top-1", tier: "top", title: "Arms grid", buildings: Object.freeze(["Továrna", "Zbrojovka", "Sklad"]) }),
      Object.freeze({ key: "ind-top-2", tier: "top", title: "Power forge", buildings: Object.freeze(["Továrna", "Zbrojovka", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-top-3", tier: "top", title: "Scrap foundry", buildings: Object.freeze(["Zbrojovka", "Recyklační centrum", "Sklad"]) }),
      Object.freeze({ key: "ind-top-4", tier: "top", title: "Critical recovery", buildings: Object.freeze(["Energetická stanice", "Recyklační centrum", "Sklad"]) }),
      Object.freeze({ key: "ind-top-5", tier: "top", title: "Heavy recycle", buildings: Object.freeze(["Zbrojovka", "Recyklační centrum", "Továrna"]) })
    ])
  }),
  downtown: Object.freeze({
    mid: Object.freeze([
      Object.freeze({ key: "down-mid-1", tier: "mid", title: "Městské finance", buildings: Object.freeze(["Centrální banka", "Magistrát"]) }),
      Object.freeze({ key: "down-mid-2", tier: "mid", title: "Politický vliv", buildings: Object.freeze(["Lobby klub", "Magistrát"]) }),
      Object.freeze({ key: "down-mid-3", tier: "mid", title: "Právní tlak", buildings: Object.freeze(["Soud", "Lobby klub"]) }),
      Object.freeze({ key: "down-mid-4", tier: "mid", title: "Volatilní kapitál", buildings: Object.freeze(["Burza", "VIP salonek"]) }),
      Object.freeze({ key: "down-mid-5", tier: "mid", title: "Dopravní manifest", buildings: Object.freeze(["Letiště", "Přístav"]) })
    ]),
    high: Object.freeze([
      Object.freeze({ key: "down-high-1", tier: "high", title: "Korporátní kontrola", buildings: Object.freeze(["Centrální banka", "Lobby klub"]) }),
      Object.freeze({ key: "down-high-2", tier: "high", title: "Státní pevnost", buildings: Object.freeze(["Magistrát", "Soud"]) }),
      Object.freeze({ key: "down-high-3", tier: "high", title: "Elitní arbitráž", buildings: Object.freeze(["Soud", "VIP salonek"]) }),
      Object.freeze({ key: "down-high-4", tier: "high", title: "Burzovní manipulace", buildings: Object.freeze(["Burza", "Lobby klub"]) }),
      Object.freeze({ key: "down-high-5", tier: "high", title: "Executive chamber", buildings: Object.freeze(["Magistrát", "VIP salonek"]) }),
      Object.freeze({ key: "down-high-6", tier: "high", title: "Politický terminál", buildings: Object.freeze(["Parlament", "Letiště"]) })
    ]),
    core: Object.freeze([
      Object.freeze({ key: "down-core-1", tier: "core", title: "Capital nexus", buildings: Object.freeze(["Centrální banka", "Magistrát", "VIP salonek"]) }),
      Object.freeze({ key: "down-core-2", tier: "core", title: "Shadow exchange", buildings: Object.freeze(["Burza", "Lobby klub", "VIP salonek"]) }),
      Object.freeze({ key: "down-core-3", tier: "core", title: "Judicial machine", buildings: Object.freeze(["Magistrát", "Soud", "Lobby klub"]) }),
      Object.freeze({ key: "down-core-4", tier: "core", title: "System override", buildings: Object.freeze(["Centrální banka", "Soud", "Lobby klub"]) }),
      Object.freeze({ key: "down-core-5", tier: "core", title: "Capital logistics", buildings: Object.freeze(["Parlament", "Letiště", "Přístav"]) })
    ])
  })
});

export const DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID = Object.freeze({
  79: Object.freeze({ key: "downtown-fixed-79", tier: "core", title: "Elitní arbitráž", buildings: Object.freeze(["Soud", "VIP salonek"]) }),
  80: Object.freeze({ key: "downtown-fixed-80", tier: "core", title: "Městské finance", buildings: Object.freeze(["Centrální banka"]) }),
  81: Object.freeze({ key: "downtown-fixed-81", tier: "core", title: "Politický vliv", buildings: Object.freeze(["Lobby klub", "Centrální banka"]) }),
  82: Object.freeze({ key: "downtown-fixed-82", tier: "core", title: "Volatilní kapitál", buildings: Object.freeze(["Burza"]) }),
  83: Object.freeze({ key: "downtown-fixed-83", tier: "core", title: "Právní tlak", buildings: Object.freeze(["Soud"]) }),
  58: Object.freeze({ key: "downtown-fixed-58", tier: "core", title: "Městská kontrola", buildings: Object.freeze(["Magistrát", "Parlament"]) }),
  57: Object.freeze({ key: "downtown-fixed-57", tier: "core", title: "Lobby síť", buildings: Object.freeze(["Lobby klub", "Letiště"]) }),
  59: Object.freeze({ key: "downtown-fixed-59", tier: "core", title: "VIP patro", buildings: Object.freeze(["VIP salonek", "Přístav"]) })
});

export const residentialDistrictPools = DISTRICT_BUILDING_PACKAGE_POOLS.resident;
export const commercialDistrictPools = DISTRICT_BUILDING_PACKAGE_POOLS.economy;
export const parkDistrictPools = DISTRICT_BUILDING_PACKAGE_POOLS.park;
export const industrialDistrictPools = DISTRICT_BUILDING_PACKAGE_POOLS.industrial;
export const downtownDistrictPools = DISTRICT_BUILDING_PACKAGE_POOLS.downtown;

export function formatDistrictBuildingTierLabel(tier) {
  switch (String(tier || "").trim().toLowerCase()) {
    case "early":
      return "Early";
    case "mid":
      return "Mid";
    case "late":
      return "Late";
    case "top":
      return "Top";
    case "high":
      return "High";
    case "core":
      return "Core";
    default:
      return "Set";
  }
}

export const districtPoolsData = registerEmpireData("districtPools", Object.freeze({
  districtBuildingPackagePools: DISTRICT_BUILDING_PACKAGE_POOLS,
  downtownFixedBuildingPackagesByDistrictId: DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  residentialDistrictPools,
  commercialDistrictPools,
  parkDistrictPools,
  industrialDistrictPools,
  downtownDistrictPools
}));
