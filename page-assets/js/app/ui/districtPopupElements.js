import * as selectors from "../runtime/constants.js";
import { escapeHtml } from "./htmlEscape.js";

const DISTRICT_POPUP_ATMOSPHERE_SELECTOR = "[data-district-popup-atmosphere]";
const DISTRICT_ATMOSPHERE_WINDOW_SELECTOR = "[data-district-atmosphere-window]";
const DISTRICT_ATMOSPHERE_WINDOW_IMAGE_SELECTOR = "[data-district-atmosphere-window-image]";
const DISTRICT_ATMOSPHERE_WINDOW_LABEL_SELECTOR = "[data-district-atmosphere-window-label]";
const DISTRICT_ATMOSPHERE_WINDOW_MOOD_SELECTOR = "[data-district-atmosphere-window-mood]";
const DISTRICT_ATMOSPHERE_WINDOW_CLOSE_SELECTOR = "[data-district-atmosphere-close]";
const DISTRICT_ACTION_SECTION_HEAD_SELECTOR = ".district-popup-action-section__head";

function query(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }
  return root.querySelector(selector);
}

function queryAll(root, selector) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }
  return Array.from(root.querySelectorAll(selector));
}

export function setElementText(element, value) {
  if (!element) {
    return false;
  }
  element.textContent = String(value ?? "");
  return true;
}

export function setElementHtml(element, value) {
  if (!element) {
    return false;
  }
  element.innerHTML = escapeHtml(value);
  return true;
}

export function setElementValue(element, value) {
  if (!element) {
    return false;
  }
  element.value = value ?? "";
  return true;
}

export function setElementHidden(element, hidden) {
  if (!element) {
    return false;
  }
  element.hidden = Boolean(hidden);
  return true;
}

export function toggleElementClass(element, className, force) {
  if (!element || !className) {
    return false;
  }
  element.classList.toggle(className, force);
  return true;
}

export function hasRequiredDistrictPopupElements(elements = {}) {
  return Boolean(elements.popup && elements.popupCard && elements.popupTitle);
}

export function getDistrictPopupElements(root) {
  return {
    popup: query(root, selectors.DISTRICT_POPUP_SELECTOR),
    popupCard: query(root, selectors.DISTRICT_POPUP_CARD_SELECTOR),
    popupTitle: query(root, selectors.DISTRICT_POPUP_TITLE_SELECTOR),
    popupType: query(root, selectors.DISTRICT_POPUP_TYPE_SELECTOR),
    popupOwner: query(root, selectors.DISTRICT_POPUP_OWNER_SELECTOR),
    popupOwnerMeta: query(root, selectors.DISTRICT_POPUP_OWNER_META_SELECTOR),
    popupOwnerAvatar: query(root, selectors.DISTRICT_POPUP_OWNER_AVATAR_SELECTOR),
    popupOwnerAvatarFallback: query(root, selectors.DISTRICT_POPUP_OWNER_AVATAR_FALLBACK_SELECTOR),
    popupClean: query(root, selectors.DISTRICT_POPUP_CLEAN_SELECTOR),
    popupDirty: query(root, selectors.DISTRICT_POPUP_DIRTY_SELECTOR),
    popupInfluence: query(root, selectors.DISTRICT_POPUP_INFLUENCE_SELECTOR),
    popupPopulation: query(root, selectors.DISTRICT_POPUP_POPULATION_SELECTOR),
    popupSummary: query(root, selectors.DISTRICT_POPUP_SUMMARY_SELECTOR),
    popupFlags: query(root, selectors.DISTRICT_POPUP_FLAGS_SELECTOR),
    popupToggle: query(root, selectors.DISTRICT_POPUP_TOGGLE_SELECTOR),
    popupAtmosphereHero: query(root, DISTRICT_POPUP_ATMOSPHERE_SELECTOR),
    popupAtmosphereImage: query(root, selectors.DISTRICT_POPUP_ATMOSPHERE_IMAGE_SELECTOR),
    popupAtmosphereLabel: query(root, selectors.DISTRICT_POPUP_ATMOSPHERE_LABEL_SELECTOR),
    popupAtmosphereMood: query(root, selectors.DISTRICT_POPUP_ATMOSPHERE_MOOD_SELECTOR),
    popupAtmosphereWindow: query(root, DISTRICT_ATMOSPHERE_WINDOW_SELECTOR),
    popupAtmosphereWindowImage: query(root, DISTRICT_ATMOSPHERE_WINDOW_IMAGE_SELECTOR),
    popupAtmosphereWindowLabel: query(root, DISTRICT_ATMOSPHERE_WINDOW_LABEL_SELECTOR),
    popupAtmosphereWindowMood: query(root, DISTRICT_ATMOSPHERE_WINDOW_MOOD_SELECTOR),
    popupAtmosphereWindowClose: query(root, DISTRICT_ATMOSPHERE_WINDOW_CLOSE_SELECTOR),
    popupBuildings: query(root, selectors.DISTRICT_POPUP_BUILDINGS_SELECTOR),
    popupBuildingsMeta: query(root, selectors.DISTRICT_POPUP_BUILDINGS_META_SELECTOR),
    popupBuildingsList: query(root, selectors.DISTRICT_POPUP_BUILDINGS_LIST_SELECTOR),
    popupGossip: query(root, selectors.DISTRICT_POPUP_GOSSIP_SELECTOR),
    popupGossipList: query(root, selectors.DISTRICT_POPUP_GOSSIP_LIST_SELECTOR),
    districtActionSectionHead: query(root, DISTRICT_ACTION_SECTION_HEAD_SELECTOR),
    districtActionSection: query(root, selectors.DISTRICT_ACTION_SECTION_SELECTOR),
    districtActionsMount: query(root, selectors.DISTRICT_ACTIONS_SELECTOR),
    popupCloseElements: queryAll(root, selectors.DISTRICT_POPUP_CLOSE_SELECTOR),
    buildingsPopupOpenButton: query(root, selectors.BUILDINGS_POPUP_OPEN_SELECTOR),
    buildingsPopup: query(root, selectors.BUILDINGS_POPUP_SELECTOR),
    buildingsPopupTypeMount: query(root, selectors.BUILDINGS_POPUP_TYPES_SELECTOR),
    buildingsPopupDetailMount: query(root, selectors.BUILDINGS_POPUP_DETAIL_SELECTOR),
    buildingsPopupCloseElements: queryAll(root, selectors.BUILDINGS_POPUP_CLOSE_SELECTOR),
    attackSetupPopup: query(root, selectors.ATTACK_SETUP_POPUP_SELECTOR),
    attackSetupCard: query(root, selectors.ATTACK_SETUP_CARD_SELECTOR),
    attackSetupCloseElements: queryAll(root, selectors.ATTACK_SETUP_CLOSE_SELECTOR),
    attackSetupAtmosphereImage: query(root, selectors.ATTACK_SETUP_ATMOSPHERE_IMAGE_SELECTOR),
    attackSetupAtmosphereLabel: query(root, selectors.ATTACK_SETUP_ATMOSPHERE_LABEL_SELECTOR),
    attackTargetTitle: query(root, selectors.ATTACK_TARGET_TITLE_SELECTOR),
    attackSourceSelect: query(root, selectors.ATTACK_SOURCE_SELECT_SELECTOR),
    attackAvailablePopulation: query(root, selectors.ATTACK_AVAILABLE_POPULATION_SELECTOR),
    attackRequiredPopulation: query(root, selectors.ATTACK_REQUIRED_POPULATION_SELECTOR),
    attackEstimatedPower: query(root, selectors.ATTACK_ESTIMATED_POWER_SELECTOR),
    attackStatus: query(root, selectors.ATTACK_STATUS_SELECTOR),
    attackWeaponInputs: queryAll(root, selectors.ATTACK_WEAPON_INPUT_SELECTOR),
    attackOwnedElements: queryAll(root, selectors.ATTACK_OWNED_SELECTOR),
    attackConfirmButton: query(root, selectors.ATTACK_CONFIRM_SELECTOR),
    attackConfirmPopup: query(root, selectors.ATTACK_CONFIRM_POPUP_SELECTOR),
    attackConfirmCard: query(root, selectors.ATTACK_CONFIRM_CARD_SELECTOR),
    attackConfirmCloseElements: queryAll(root, selectors.ATTACK_CONFIRM_CLOSE_SELECTOR),
    attackConfirmAtmosphereImage: query(root, selectors.ATTACK_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR),
    attackConfirmAtmosphereLabel: query(root, selectors.ATTACK_CONFIRM_ATMOSPHERE_LABEL_SELECTOR),
    attackConfirmTitle: query(root, selectors.ATTACK_CONFIRM_TITLE_SELECTOR),
    attackConfirmSource: query(root, selectors.ATTACK_CONFIRM_SOURCE_SELECTOR),
    attackConfirmMembers: query(root, selectors.ATTACK_CONFIRM_MEMBERS_SELECTOR),
    attackConfirmPower: query(root, selectors.ATTACK_CONFIRM_POWER_SELECTOR),
    attackConfirmScenario: query(root, selectors.ATTACK_CONFIRM_SCENARIO_SELECTOR),
    attackConfirmDuration: query(root, selectors.ATTACK_CONFIRM_DURATION_SELECTOR),
    attackConfirmNote: query(root, selectors.ATTACK_CONFIRM_NOTE_SELECTOR),
    attackConfirmFinalButton: query(root, selectors.ATTACK_CONFIRM_BUTTON_SELECTOR),
    robberySetupPopup: query(root, selectors.ROBBERY_SETUP_POPUP_SELECTOR),
    robberySetupCard: query(root, selectors.ROBBERY_SETUP_CARD_SELECTOR),
    robberySetupCloseElements: queryAll(root, selectors.ROBBERY_SETUP_CLOSE_SELECTOR),
    robberySetupAtmosphereImage: query(root, selectors.ROBBERY_SETUP_ATMOSPHERE_IMAGE_SELECTOR),
    robberySetupAtmosphereLabel: query(root, selectors.ROBBERY_SETUP_ATMOSPHERE_LABEL_SELECTOR),
    robberyTargetTitle: query(root, selectors.ROBBERY_TARGET_TITLE_SELECTOR),
    robberySourceSelect: query(root, selectors.ROBBERY_SOURCE_SELECT_SELECTOR),
    robberyAvailableMembers: query(root, selectors.ROBBERY_AVAILABLE_MEMBERS_SELECTOR),
    robberyAvailableSpies: query(root, selectors.ROBBERY_AVAILABLE_SPIES_SELECTOR),
    robberyMemberInput: query(root, selectors.ROBBERY_MEMBER_INPUT_SELECTOR),
    robberyZone: query(root, selectors.ROBBERY_ZONE_SELECTOR),
    robberyRecommendation: query(root, selectors.ROBBERY_RECOMMENDATION_SELECTOR),
    robberyRiskLevel: query(root, selectors.ROBBERY_RISK_LEVEL_SELECTOR),
    robberyLootPreview: query(root, selectors.ROBBERY_LOOT_PREVIEW_SELECTOR),
    robberyTrapPreview: query(root, selectors.ROBBERY_TRAP_PREVIEW_SELECTOR),
    robberyScoutReport: query(root, selectors.ROBBERY_SCOUT_REPORT_SELECTOR),
    robberyHeatEstimate: query(root, selectors.ROBBERY_HEAT_ESTIMATE_SELECTOR),
    robberyRiskDescription: query(root, selectors.ROBBERY_RISK_DESCRIPTION_SELECTOR),
    robberyStatus: query(root, selectors.ROBBERY_STATUS_SELECTOR),
    robberyConfirmButton: query(root, selectors.ROBBERY_CONFIRM_SELECTOR),
    robberyConfirmPopup: query(root, selectors.ROBBERY_CONFIRM_POPUP_SELECTOR),
    robberyConfirmCard: query(root, selectors.ROBBERY_CONFIRM_CARD_SELECTOR),
    robberyConfirmCloseElements: queryAll(root, selectors.ROBBERY_CONFIRM_CLOSE_SELECTOR),
    robberyConfirmAtmosphereImage: query(root, selectors.ROBBERY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR),
    robberyConfirmAtmosphereLabel: query(root, selectors.ROBBERY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR),
    robberyConfirmTitle: query(root, selectors.ROBBERY_CONFIRM_TITLE_SELECTOR),
    robberyConfirmSource: query(root, selectors.ROBBERY_CONFIRM_SOURCE_SELECTOR),
    robberyConfirmMembers: query(root, selectors.ROBBERY_CONFIRM_MEMBERS_SELECTOR),
    robberyConfirmDuration: query(root, selectors.ROBBERY_CONFIRM_DURATION_SELECTOR),
    robberyConfirmNote: query(root, selectors.ROBBERY_CONFIRM_NOTE_SELECTOR),
    robberyConfirmFinalButton: query(root, selectors.ROBBERY_CONFIRM_BUTTON_SELECTOR),
    defenseSetupPopup: query(root, selectors.DEFENSE_SETUP_POPUP_SELECTOR),
    defenseSetupCard: query(root, selectors.DEFENSE_SETUP_CARD_SELECTOR),
    defenseSetupCloseElements: queryAll(root, selectors.DEFENSE_SETUP_CLOSE_SELECTOR),
    defenseSetupAtmosphereImage: query(root, selectors.DEFENSE_SETUP_ATMOSPHERE_IMAGE_SELECTOR),
    defenseSetupAtmosphereLabel: query(root, selectors.DEFENSE_SETUP_ATMOSPHERE_LABEL_SELECTOR),
    defenseTargetTitle: query(root, selectors.DEFENSE_TARGET_TITLE_SELECTOR),
    defenseStatus: query(root, selectors.DEFENSE_STATUS_SELECTOR),
    defenseEstimatedPower: query(root, selectors.DEFENSE_ESTIMATED_POWER_SELECTOR),
    defenseWeaponInputs: queryAll(root, selectors.DEFENSE_WEAPON_INPUT_SELECTOR),
    defenseOwnedElements: queryAll(root, selectors.DEFENSE_OWNED_SELECTOR),
    defenseResidentsInput: query(root, selectors.DEFENSE_RESIDENTS_INPUT_SELECTOR),
    defenseConfirmButton: query(root, selectors.DEFENSE_CONFIRM_SELECTOR),
    trapConfirmPopup: query(root, selectors.TRAP_CONFIRM_POPUP_SELECTOR),
    trapConfirmCard: query(root, selectors.TRAP_CONFIRM_CARD_SELECTOR),
    trapConfirmCloseElements: queryAll(root, selectors.TRAP_CONFIRM_CLOSE_SELECTOR),
    trapConfirmAtmosphereImage: query(root, selectors.TRAP_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR),
    trapConfirmAtmosphereLabel: query(root, selectors.TRAP_CONFIRM_ATMOSPHERE_LABEL_SELECTOR),
    trapConfirmTitle: query(root, selectors.TRAP_CONFIRM_TITLE_SELECTOR),
    trapConfirmCooldown: query(root, selectors.TRAP_CONFIRM_COOLDOWN_SELECTOR),
    trapConfirmNote: query(root, selectors.TRAP_CONFIRM_NOTE_SELECTOR),
    trapConfirmButton: query(root, selectors.TRAP_CONFIRM_BUTTON_SELECTOR),
    spyConfirmPopup: query(root, selectors.SPY_CONFIRM_POPUP_SELECTOR),
    spyConfirmCard: query(root, selectors.SPY_CONFIRM_CARD_SELECTOR),
    spyConfirmCloseElements: queryAll(root, selectors.SPY_CONFIRM_CLOSE_SELECTOR),
    spyConfirmAtmosphereImage: query(root, selectors.SPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR),
    spyConfirmAtmosphereLabel: query(root, selectors.SPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR),
    spyConfirmTitle: query(root, selectors.SPY_CONFIRM_TITLE_SELECTOR),
    spyConfirmSource: query(root, selectors.SPY_CONFIRM_SOURCE_SELECTOR),
    spyConfirmAvailable: query(root, selectors.SPY_CONFIRM_AVAILABLE_SELECTOR),
    spyConfirmDuration: query(root, selectors.SPY_CONFIRM_DURATION_SELECTOR),
    spyConfirmNote: query(root, selectors.SPY_CONFIRM_NOTE_SELECTOR),
    spyConfirmButton: query(root, selectors.SPY_CONFIRM_BUTTON_SELECTOR),
    occupyConfirmPopup: query(root, selectors.OCCUPY_CONFIRM_POPUP_SELECTOR),
    occupyConfirmCard: query(root, selectors.OCCUPY_CONFIRM_CARD_SELECTOR),
    occupyConfirmCloseElements: queryAll(root, selectors.OCCUPY_CONFIRM_CLOSE_SELECTOR),
    occupyConfirmAtmosphereImage: query(root, selectors.OCCUPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR),
    occupyConfirmAtmosphereLabel: query(root, selectors.OCCUPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR),
    occupyConfirmTitle: query(root, selectors.OCCUPY_CONFIRM_TITLE_SELECTOR),
    occupyConfirmSource: query(root, selectors.OCCUPY_CONFIRM_SOURCE_SELECTOR),
    occupyConfirmCondition: query(root, selectors.OCCUPY_CONFIRM_CONDITION_SELECTOR),
    occupyConfirmCost: query(root, selectors.OCCUPY_CONFIRM_COST_SELECTOR),
    occupyConfirmDuration: query(root, selectors.OCCUPY_CONFIRM_DURATION_SELECTOR),
    occupyConfirmNote: query(root, selectors.OCCUPY_CONFIRM_NOTE_SELECTOR),
    occupyConfirmButton: query(root, selectors.OCCUPY_CONFIRM_BUTTON_SELECTOR),
    spyResultModal: query(root, selectors.SPY_RESULT_MODAL_SELECTOR),
    spyResultModalBackdrop: query(root, selectors.SPY_RESULT_MODAL_BACKDROP_SELECTOR),
    spyResultModalClose: query(root, selectors.SPY_RESULT_MODAL_CLOSE_SELECTOR),
    spyResultModalOk: query(root, selectors.SPY_RESULT_MODAL_OK_SELECTOR),
    spyWarningModal: query(root, selectors.SPY_WARNING_MODAL_SELECTOR),
    spyWarningModalBackdrop: query(root, selectors.SPY_WARNING_MODAL_BACKDROP_SELECTOR),
    spyWarningModalClose: query(root, selectors.SPY_WARNING_MODAL_CLOSE_SELECTOR),
    spyWarningModalOk: query(root, selectors.SPY_WARNING_MODAL_OK_SELECTOR),
    raidResultModal: query(root, selectors.RAID_RESULT_MODAL_SELECTOR),
    raidResultModalBackdrop: query(root, selectors.RAID_RESULT_MODAL_BACKDROP_SELECTOR),
    raidResultModalClose: query(root, selectors.RAID_RESULT_MODAL_CLOSE_SELECTOR),
    raidResultModalOk: query(root, selectors.RAID_RESULT_MODAL_OK_SELECTOR),
    attackResultModal: query(root, selectors.ATTACK_RESULT_MODAL_SELECTOR),
    attackResultModalBackdrop: query(root, selectors.ATTACK_RESULT_MODAL_BACKDROP_SELECTOR),
    attackResultModalClose: query(root, selectors.ATTACK_RESULT_MODAL_CLOSE_SELECTOR),
    attackResultModalOk: query(root, selectors.ATTACK_RESULT_MODAL_OK_SELECTOR),
    policeActionResultModal: query(root, selectors.POLICE_ACTION_RESULT_MODAL_SELECTOR),
    policeActionResultModalBackdrop: query(root, selectors.POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR),
    policeActionResultModalClose: query(root, selectors.POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR),
    policeActionResultModalOk: query(root, selectors.POLICE_ACTION_RESULT_MODAL_OK_SELECTOR),
    buildingActionState: query(root, selectors.BUILDING_ACTION_STATE_SELECTOR),
    buildingActionSummary: query(root, selectors.BUILDING_ACTION_SUMMARY_SELECTOR),
    buildingActionMeta: query(root, selectors.BUILDING_ACTION_META_SELECTOR),
    gangMembersValue: query(root, selectors.GANG_MEMBERS_SELECTOR)
  };
}
