import { createDistrictBuildingSet as set } from "./district-building-set-types";
import type { PublicDistrictBuildingSet } from "./district-building-set-types";

export const downtownFixedBuildingSetByDistrictId: Record<string, PublicDistrictBuildingSet> = {
  "79": set("downtown", "core", "downtown-fixed-79", "Elitní arbitráž", ["court", "vip_lounge"]),
  "80": set("downtown", "core", "downtown-fixed-80", "Městské finance", ["central_bank"]),
  "81": set("downtown", "core", "downtown-fixed-81", "Politický vliv", ["lobby_club", "central_bank"]),
  "82": set("downtown", "core", "downtown-fixed-82", "Volatilní kapitál", ["stock_exchange"]),
  "83": set("downtown", "core", "downtown-fixed-83", "Právní tlak", ["court"]),
  "58": set("downtown", "core", "downtown-fixed-58", "Městská kontrola", ["city_hall", "parliament"]),
  "57": set("downtown", "core", "downtown-fixed-57", "Lobby síť", ["lobby_club", "airport"]),
  "59": set("downtown", "core", "downtown-fixed-59", "VIP patro", ["vip_lounge", "port"])
};

export const fixedBuildingSetByDistrictId: Record<string, PublicDistrictBuildingSet> = {
  "4": set("residential", "early", "residential-fixed-4", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "7": set("residential", "early", "residential-fixed-7", "Stabilní základna", ["apartment_block", "arcade"]),
  "10": set("residential", "early", "residential-fixed-10", "Stabilní základna", ["apartment_block", "arcade"]),
  "15": set("residential", "early", "residential-fixed-15", "Startovní růst", ["apartment_block", "garage"]),
  "19": set("residential", "early", "residential-fixed-19", "Stabilní základna", ["apartment_block", "arcade"]),
  "22": set("residential", "early", "residential-fixed-22", "První nábor", ["apartment_block", "recruitment_center"]),
  "24": set("residential", "early", "residential-fixed-24", "Stabilní základna", ["apartment_block", "arcade"]),
  "28": set("residential", "early", "residential-fixed-28", "Stabilní základna", ["apartment_block", "arcade"]),
  "32": set("residential", "mid", "residential-fixed-32", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "35": set("residential", "mid", "residential-fixed-35", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "40": set("residential", "mid", "residential-fixed-40", "Regenerace fronty", ["recruitment_center", "school"]),
  "44": set("residential", "early", "residential-fixed-44", "První nábor", ["apartment_block", "recruitment_center"]),
  "49": set("residential", "mid", "residential-fixed-49", "Kontrolovaný development", ["apartment_block", "arcade", "clinic"]),
  "54": set("residential", "mid", "residential-fixed-54", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "60": set("residential", "late", "residential-fixed-60", "Mobilní tlak", ["recruitment_center", "school", "clinic"]),
  "65": set("residential", "mid", "residential-fixed-65", "Regenerace fronty", ["recruitment_center", "clinic"]),
  "69": set("residential", "early", "residential-fixed-69", "Stabilní základna", ["apartment_block", "arcade"]),
  "71": set("residential", "mid", "residential-fixed-71", "Regenerace fronty", ["recruitment_center", "clinic"]),
  "74": set("residential", "late", "residential-fixed-74", "Válečné zázemí", ["apartment_block", "recruitment_center", "clinic"]),
  "85": set("residential", "late", "residential-fixed-85", "Mobilní tlak", ["recruitment_center", "garage", "clinic"]),
  "88": set("residential", "late", "residential-fixed-88", "Elitní rezidenční zóna", ["apartment_block", "garage", "clinic"]),
  "90": set("residential", "mid", "residential-fixed-90", "Loajalita a výcvik", ["arcade", "school"]),
  "96": set("residential", "mid", "residential-fixed-96", "Loajalita a výcvik", ["arcade", "school"]),
  "99": set("residential", "mid", "residential-fixed-99", "Loajalita a výcvik", ["arcade", "school"]),
  "101": set("residential", "mid", "residential-fixed-101", "Loajalita a výcvik", ["arcade", "school"]),
  "108": set("residential", "mid", "residential-fixed-108", "Udržitelný růst", ["apartment_block", "clinic"]),
  "115": set("residential", "early", "residential-fixed-115", "Stabilní základna", ["apartment_block", "arcade"]),
  "117": set("residential", "early", "residential-fixed-117", "První nábor", ["apartment_block", "recruitment_center"]),
  "122": set("residential", "mid", "residential-fixed-122", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "126": set("residential", "mid", "residential-fixed-126", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "129": set("residential", "mid", "residential-fixed-129", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
  "133": set("residential", "early", "residential-fixed-133", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "135": set("residential", "early", "residential-fixed-135", "Startovní růst", ["apartment_block", "garage"]),
  "142": set("residential", "early", "residential-fixed-142", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "147": set("residential", "early", "residential-fixed-147", "Startovní růst", ["apartment_block", "garage"]),
  "151": set("residential", "early", "residential-fixed-151", "První nábor", ["apartment_block", "recruitment_center"]),
  "154": set("residential", "early", "residential-fixed-154", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
  "160": set("residential", "early", "residential-fixed-160", "Startovní růst", ["apartment_block", "garage"])
};
