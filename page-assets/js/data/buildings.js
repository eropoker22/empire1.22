import {
  BUILDING_POPUP_TARGETS,
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "../app/runtime/buildingDetailData.js";
import {
  DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2,
  DISTRICT_MINUTE_INCOME_RULES_EMPIRE2
} from "../app/runtime/districtBuildingData.js";
import { PRODUCTION_BUILDING_CONFIG } from "../app/runtime/productionBuildingData.js";
import { registerEmpireData } from "./registry.js";

export const buildingDistrictTypes = Object.freeze([
  "resident",
  "economy",
  "industrial",
  "park",
  "downtown"
]);

export const DISTRICT_BUILDING_TYPE_META = Object.freeze({
  resident: Object.freeze({
    key: "resident",
    label: "Rezidenční districty",
    shortLabel: "Rezidence"
  }),
  economy: Object.freeze({
    key: "economy",
    label: "Komerční districty",
    shortLabel: "Komerce"
  }),
  industrial: Object.freeze({
    key: "industrial",
    label: "Průmyslové districty",
    shortLabel: "Průmysl"
  }),
  park: Object.freeze({
    key: "park",
    label: "Parkové districty",
    shortLabel: "Park"
  }),
  downtown: Object.freeze({
    key: "downtown",
    label: "Downtown districty",
    shortLabel: "Downtown"
  })
});

export const DISTRICT_BUILDING_TYPE_ORDER = buildingDistrictTypes;

export const districtBuildingCatalog = Object.freeze(
  Object.entries(DISTRICT_BUILDING_DETAIL_PROFILES).map(([key, profile]) => Object.freeze({
    key,
    ...profile
  }))
);

export const buildingsData = registerEmpireData("buildings", Object.freeze({
  buildingDistrictTypes,
  districtBuildingCatalog,
  districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
  districtBuildingTypeOrder: DISTRICT_BUILDING_TYPE_ORDER,
  districtBuildingDetailProfiles: DISTRICT_BUILDING_DETAIL_PROFILES,
  districtBuildingSpecialActionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES,
  districtMinuteIncomeRules: DISTRICT_MINUTE_INCOME_RULES_EMPIRE2,
  districtBuildingMinuteIncomeRules: DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
  districtBuildingMinuteHeatRules: DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
  districtBuildingMinuteInfluenceRules: DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2,
  productionBuildingConfig: PRODUCTION_BUILDING_CONFIG,
  popupTargets: BUILDING_POPUP_TARGETS
}));
