import { getAssetPath } from "../../config.js";

const RESTAURANT_BG_1 = getAssetPath("budovy/commercial/restaurace/res1.png");
const RESTAURANT_BG_2 = getAssetPath("budovy/commercial/restaurace/res2.png");
const RESTAURANT_BG_3 = getAssetPath("budovy/commercial/restaurace/res3.png");
const RESTAURANT_BG_4 = getAssetPath("budovy/commercial/restaurace/res4.png");
const EXCHANGE_BG_1 = getAssetPath("budovy/commercial/smenarna/sme1.png");
const EXCHANGE_BG_2 = getAssetPath("budovy/commercial/smenarna/sme2.png");
const EXCHANGE_BG_3 = getAssetPath("budovy/commercial/smenarna/sme3.png");
const EXCHANGE_BG_4 = getAssetPath("budovy/commercial/smenarna/sme4.png");
const MALL_BG_1 = getAssetPath("budovy/commercial/obchodnicentrum/obch1.png");
const MALL_BG_2 = getAssetPath("budovy/commercial/obchodnicentrum/obch2.png");
const MALL_BG_3 = getAssetPath("budovy/commercial/obchodnicentrum/obch3.png");
const MALL_BG_4 = getAssetPath("budovy/commercial/obchodnicentrum/obch4.png");
const AUTOSALON_BG_1 = getAssetPath("budovy/commercial/autosalon/aut1.png");
const AUTOSALON_BG_2 = getAssetPath("budovy/commercial/autosalon/aur2.png");
const AUTOSALON_BG_3 = getAssetPath("budovy/commercial/autosalon/aut3.png");
const AUTOSALON_BG_4 = getAssetPath("budovy/commercial/autosalon/aut4.png");
const FITNESS_CLUB_BG_1 = getAssetPath("budovy/commercial/fitnessclub/fit1.png");
const FITNESS_CLUB_BG_2 = getAssetPath("budovy/commercial/fitnessclub/fit2.png");
const FITNESS_CLUB_BG_3 = getAssetPath("budovy/commercial/fitnessclub/fit3.png");
const FITNESS_CLUB_BG_4 = getAssetPath("budovy/commercial/fitnessclub/fit4.png");
const CASINO_BG_1 = getAssetPath("budovy/commercial/kasino/cas1.png");
const CASINO_BG_2 = getAssetPath("budovy/commercial/kasino/cas3.png");
const CASINO_BG_3 = getAssetPath("budovy/commercial/kasino/cas4.png");
const ARCADE_BG_1 = getAssetPath("budovy/residental/herna/her1.png");
const ARCADE_BG_2 = getAssetPath("budovy/residental/herna/her2.png");
const ARCADE_BG_3 = getAssetPath("budovy/residental/herna/her3.png");
const ARCADE_BG_4 = getAssetPath("budovy/residental/herna/her4.png");
const RECRUITMENT_CENTER_BG_1 = getAssetPath("budovy/residental/rekcentrum/rek1.png");
const RECRUITMENT_CENTER_BG_2 = getAssetPath("budovy/residental/rekcentrum/rek2.png");
const RECRUITMENT_CENTER_BG_3 = getAssetPath("budovy/residental/rekcentrum/rek3.png");
const RECRUITMENT_CENTER_BG_4 = getAssetPath("budovy/residental/rekcentrum/rek4.png");
const GARAGE_BG_1 = getAssetPath("budovy/residental/garage/gar1.png");
const GARAGE_BG_2 = getAssetPath("budovy/residental/garage/gar2.png");
const GARAGE_BG_3 = getAssetPath("budovy/residental/garage/gar3.png");
const GARAGE_BG_4 = getAssetPath("budovy/residental/garage/gar4.png");
const SCHOOL_BG_1 = getAssetPath("budovy/residental/skola/sko1.png");
const SCHOOL_BG_2 = getAssetPath("budovy/residental/skola/sko2.png");
const SCHOOL_BG_3 = getAssetPath("budovy/residental/skola/sko3.png");
const SCHOOL_BG_4 = getAssetPath("budovy/residental/skola/sko4.png");
const APARTMENT_BLOCK_BG_1 = getAssetPath("budovy/residental/blok/blok1.png");
const APARTMENT_BLOCK_BG_2 = getAssetPath("budovy/residental/blok/blok2.png");
const APARTMENT_BLOCK_BG_3 = getAssetPath("budovy/residental/blok/blok3.png");
const APARTMENT_BLOCK_BG_4 = getAssetPath("budovy/residental/blok/blok4.png");
const APARTMENT_BLOCK_BG_5 = getAssetPath("budovy/residental/blok/blok5.png");

export const DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME = Object.freeze({
  "Bytový blok": Object.freeze([
    APARTMENT_BLOCK_BG_1,
    APARTMENT_BLOCK_BG_2,
    APARTMENT_BLOCK_BG_3,
    APARTMENT_BLOCK_BG_4,
    APARTMENT_BLOCK_BG_5
  ]),
  Autosalon: Object.freeze([
    AUTOSALON_BG_1,
    AUTOSALON_BG_2,
    AUTOSALON_BG_3,
    AUTOSALON_BG_4
  ]),
  "Fitness Club": Object.freeze([
    FITNESS_CLUB_BG_1,
    FITNESS_CLUB_BG_2,
    FITNESS_CLUB_BG_3,
    FITNESS_CLUB_BG_4
  ]),
  "Směnárna": Object.freeze([
    EXCHANGE_BG_1,
    EXCHANGE_BG_2,
    EXCHANGE_BG_3,
    EXCHANGE_BG_4
  ]),
  Kasino: Object.freeze([
    CASINO_BG_1,
    CASINO_BG_2,
    CASINO_BG_3
  ]),
  Herna: Object.freeze([
    ARCADE_BG_1,
    ARCADE_BG_2,
    ARCADE_BG_3,
    ARCADE_BG_4
  ]),
  "Rekrutační centrum": Object.freeze([
    RECRUITMENT_CENTER_BG_1,
    RECRUITMENT_CENTER_BG_2,
    RECRUITMENT_CENTER_BG_3,
    RECRUITMENT_CENTER_BG_4
  ]),
  Garage: Object.freeze([
    GARAGE_BG_1,
    GARAGE_BG_2,
    GARAGE_BG_3,
    GARAGE_BG_4
  ]),
  "Škola": Object.freeze([
    SCHOOL_BG_1,
    SCHOOL_BG_2,
    SCHOOL_BG_3,
    SCHOOL_BG_4
  ]),
  "Obchodní centrum": Object.freeze([
    MALL_BG_1,
    MALL_BG_2,
    MALL_BG_3,
    MALL_BG_4
  ]),
  Restaurace: Object.freeze([
    RESTAURANT_BG_1,
    RESTAURANT_BG_2,
    RESTAURANT_BG_3,
    RESTAURANT_BG_4
  ])
});

export const DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME = Object.freeze({
  "Blok 1": APARTMENT_BLOCK_BG_1,
  "Blok 2": APARTMENT_BLOCK_BG_1,
  "Blok 3": APARTMENT_BLOCK_BG_1,
  "Blok 4": APARTMENT_BLOCK_BG_1,
  "Blok 5": APARTMENT_BLOCK_BG_1,
  "Blok 6": APARTMENT_BLOCK_BG_1,
  "Blok 7": APARTMENT_BLOCK_BG_1,
  "Blok 8": APARTMENT_BLOCK_BG_1,
  "Blok 9": APARTMENT_BLOCK_BG_2,
  "Blok 10": APARTMENT_BLOCK_BG_2,
  "Blok 11": APARTMENT_BLOCK_BG_2,
  "Blok 12": APARTMENT_BLOCK_BG_2,
  "Blok 13": APARTMENT_BLOCK_BG_2,
  "Blok 14": APARTMENT_BLOCK_BG_2,
  "Blok 15": APARTMENT_BLOCK_BG_2,
  "Blok 16": APARTMENT_BLOCK_BG_3,
  "Blok 17": APARTMENT_BLOCK_BG_3,
  "Blok 18": APARTMENT_BLOCK_BG_3,
  "Blok 19": APARTMENT_BLOCK_BG_3,
  "Blok 20": APARTMENT_BLOCK_BG_3,
  "Blok 21": APARTMENT_BLOCK_BG_3,
  "Blok 22": APARTMENT_BLOCK_BG_3,
  "Blok 23": APARTMENT_BLOCK_BG_4,
  "Blok 24": APARTMENT_BLOCK_BG_4,
  "Blok 25": APARTMENT_BLOCK_BG_4,
  "Blok 26": APARTMENT_BLOCK_BG_4,
  "Blok 27": APARTMENT_BLOCK_BG_4,
  "Blok 28": APARTMENT_BLOCK_BG_4,
  "Blok 29": APARTMENT_BLOCK_BG_4,
  "Blok 30": APARTMENT_BLOCK_BG_5,
  "Blok 31": APARTMENT_BLOCK_BG_5,
  "Blok 32": APARTMENT_BLOCK_BG_5,
  "Blok 33": APARTMENT_BLOCK_BG_5,
  "Blok 34": APARTMENT_BLOCK_BG_5,
  "Blok 35": APARTMENT_BLOCK_BG_5,
  "Blok 36": APARTMENT_BLOCK_BG_5,
  "ZeroSum Vault": EXCHANGE_BG_1,
  "Neon Arbitrage": EXCHANGE_BG_1,
  "Phantom Rates": EXCHANGE_BG_1,
  "Cashflow Mirage": EXCHANGE_BG_2,
  "Obsidian Exchange": EXCHANGE_BG_2,
  "Flux Currency Lab": EXCHANGE_BG_2,
  "DeadDrop Finance": EXCHANGE_BG_3,
  "Parallax Exchange": EXCHANGE_BG_3,
  "Ghost Ledger": EXCHANGE_BG_3,
  "Black Circuit Exchange": EXCHANGE_BG_4,
  "Silver Pulse Desk": EXCHANGE_BG_4,
  "Midnight Convertor": EXCHANGE_BG_4,
  "Neon Mall": MALL_BG_1,
  "Iron Market Plaza": MALL_BG_2,
  "Karina shopping center": MALL_BG_3,
  "Neon Motors": AUTOSALON_BG_1,
  "Iron Wheels Garage": AUTOSALON_BG_1,
  "Blackline Autos": AUTOSALON_BG_2,
  "Street Kings Motors": AUTOSALON_BG_2,
  "Midnight Drive Showroom": AUTOSALON_BG_3,
  "Chrome Syndicate Cars": AUTOSALON_BG_3,
  "Ghost Ride Autos": AUTOSALON_BG_4,
  "Velocity X Garage": AUTOSALON_BG_4,
  "Iron District Gym": FITNESS_CLUB_BG_1,
  "Beast Factory": FITNESS_CLUB_BG_2,
  "Street Power Club": FITNESS_CLUB_BG_3,
  "No Mercy Fitness": FITNESS_CLUB_BG_4,
  "Neon Bite": RESTAURANT_BG_1,
  "Black Plate": RESTAURANT_BG_1,
  "Street Fuel": RESTAURANT_BG_1,
  "Blood & Grill": RESTAURANT_BG_1,
  "Midnight Diner": RESTAURANT_BG_1,
  "Iron Taste": RESTAURANT_BG_1,
  "Shadow Kitchen": RESTAURANT_BG_1,
  "Dirty Spoon": RESTAURANT_BG_2,
  "Vice Kitchen": RESTAURANT_BG_2,
  "Urban Hunger": RESTAURANT_BG_2,
  "Smoke & Meat": RESTAURANT_BG_2,
  "The Last Bite": RESTAURANT_BG_2,
  "Gangster Grill": RESTAURANT_BG_2,
  "Concrete Kitchen": RESTAURANT_BG_2,
  "Dark Appetite": RESTAURANT_BG_3,
  "Night Feast": RESTAURANT_BG_3,
  "The Hungry Syndicate": RESTAURANT_BG_3,
  "Rusty Fork": RESTAURANT_BG_3,
  "Back Alley Bistro": RESTAURANT_BG_3,
  "Sinful Kitchen": RESTAURANT_BG_3,
  "Underground Taste": RESTAURANT_BG_3,
  "Savage Kitchen": RESTAURANT_BG_4,
  "Chrome Diner": RESTAURANT_BG_4,
  "Heat Kitchen": RESTAURANT_BG_4,
  "No Mercy Meals": RESTAURANT_BG_4,
  "Broken Plate": RESTAURANT_BG_4,
  "Elite Hunger": RESTAURANT_BG_4,
  "Dominion Prime Casino": CASINO_BG_1,
  "High Rollers Sanctum": CASINO_BG_1,
  "Velvet Eclipse Casino": CASINO_BG_2,
  "Neon Crown Palace": CASINO_BG_3,
  "Neon Jackpots": ARCADE_BG_1,
  "Lucky Circuit": ARCADE_BG_1,
  "Black Reel Club": ARCADE_BG_2,
  "Midnight Slots": ARCADE_BG_2,
  "Spin Syndicate": ARCADE_BG_3,
  "Velvet Jackpot Lounge": ARCADE_BG_3,
  "Ghost Spin Arcade": ARCADE_BG_4,
  "Iron Recruit Hub": RECRUITMENT_CENTER_BG_1,
  "Street Army Center": RECRUITMENT_CENTER_BG_1,
  "BlackFlag Recruitment": RECRUITMENT_CENTER_BG_1,
  "Shadow Enlistment": RECRUITMENT_CENTER_BG_2,
  "Warborn Center": RECRUITMENT_CENTER_BG_2,
  "Ghost Recruit Station": RECRUITMENT_CENTER_BG_2,
  "Bloodline Recruitment": RECRUITMENT_CENTER_BG_3,
  "Urban Soldiers Hub": RECRUITMENT_CENTER_BG_3,
  "Vortex Recruit Base": RECRUITMENT_CENTER_BG_3,
  "Frontline Enlistment": RECRUITMENT_CENTER_BG_4,
  "No Mercy Recruitment": RECRUITMENT_CENTER_BG_4,
  "Iron Garage": GARAGE_BG_1,
  "Street Wheels Hub": GARAGE_BG_1,
  "BlackTorque Garage": GARAGE_BG_2,
  "Ghost Garage": GARAGE_BG_2,
  "NightRide Workshop": GARAGE_BG_3,
  "SteelDrive Garage": GARAGE_BG_3,
  "BackAlley Garage": GARAGE_BG_4,
  "Velocity Garage": GARAGE_BG_4,
  "Shadow Wheels": GARAGE_BG_4,
  "Street Academy": SCHOOL_BG_1,
  "Neon Learning Center": SCHOOL_BG_1,
  "Urban Knowledge Hub": SCHOOL_BG_1,
  "IronMind School": SCHOOL_BG_1,
  "Shadow Education": SCHOOL_BG_2,
  "Vortex Academy": SCHOOL_BG_2,
  "CoreSkill Institute": SCHOOL_BG_2,
  "Future Minds School": SCHOOL_BG_2,
  "BlackBoard Academy": SCHOOL_BG_3,
  "City Knowledge Center": SCHOOL_BG_3,
  "BrainCore School": SCHOOL_BG_3,
  "NextGen Academy": SCHOOL_BG_4,
  "StreetWise Institute": SCHOOL_BG_4,
  "LogicLab School": SCHOOL_BG_4
});
