import { resolveDistrictActions } from "../../../packages/shared/src/district-action-policy.js";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_SETUP_WEAPONS,
  DEFAULT_GANG_MEMBERS,
  MAX_SPIES,
  ROBBERY_COOLDOWN_MS,
  SPY_COOLDOWN_MS
} from "../../../packages/game-config/src/legacy-page/combat-config.js";
import {
  ARMORY_RECIPES,
  DEFAULT_DRUG_INVENTORY,
  FACTORY_COMBAT_BOOSTS,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  FACTORY_CONFIG,
  FACTORY_RESOURCE_KEYS,
  DRUGLAB_RECIPES,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP,
  getMarketPriceKey,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG,
  PHARMACY_RECIPES
} from "../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  FACTION_CATALOG,
  FACTION_WEAPON_PRESETS
} from "../../../packages/game-config/src/legacy-page/faction-config.js";
import {
  calculateAttackDeployment,
  calculateDefensePower,
  calculateTotalDefensePower,
  estimateDistrictDefense,
  formatDefenseLoadout,
  getAttackScenarioMemberLoss,
  getRobberyLootForOrder,
  getRobberyScenarioMemberLoss,
  resolveAttackOutcome,
  resolveAttackScenario,
  resolveRobberyScenario,
  validateAttackSelection
} from "../../../packages/game-core/src/legacy-page/combat-preview-rules.js";
import {
  canStartProduction,
  formatDurationLabel
} from "../../../packages/game-core/src/legacy-page/production-preview-rules.js";
import { resolveSpyScenario } from "../../../packages/game-core/src/legacy-page/spy-preview-rules.js";
import {
  getAuthoritySession,
  updateStoredPreviewSession
} from "./model/authority-state.js";

const PAGE_ROOT_SELECTOR = "main[data-page]";
const MOUNT_SELECTOR = "[data-mount-role], [id$='-mount'], [id$='-root']";
const AUTH_FORM_SELECTOR = "#auth-form";
const AUTH_STATUS_MOUNT_SELECTOR = "#auth-status-mount";
const AUTH_IDENTITY_SELECTOR = "#auth-identity";
const AUTH_FACTION_INPUT_SELECTOR = "#auth-faction";
const NAV_SETTINGS_SELECTOR = "[data-nav-settings]";
const NAV_LOGOUT_SELECTOR = "[data-nav-logout]";
const FACTION_OPTION_SELECTOR = "[data-faction-option]";
const FACTION_NAME_SELECTOR = "[data-faction-name]";
const FACTION_TAGLINE_SELECTOR = "[data-faction-tagline]";
const FACTION_DESCRIPTION_SELECTOR = "[data-faction-description]";
const FACTION_CLEAN_MONEY_SELECTOR = "[data-faction-clean-money]";
const FACTION_DIRTY_MONEY_SELECTOR = "[data-faction-dirty-money]";
const FACTION_INFLUENCE_SELECTOR = "[data-faction-influence]";
const FACTION_HEAT_SELECTOR = "[data-faction-heat]";
const FACTION_ADVANTAGES_SELECTOR = "[data-faction-advantages]";
const FACTION_DISADVANTAGES_SELECTOR = "[data-faction-disadvantages]";
const PHASE_TOGGLE_SELECTOR = "[data-phase-toggle]";
const BORDER_TOGGLE_SELECTOR = "[data-border-toggle]";
const MAP_PHASE_SELECTOR = "[data-map-phase]";
const MAP_VIEWPORT_SELECTOR = "[data-map-viewport]";
const MAP_CANVAS_SELECTOR = "[data-map-canvas]";
const MAP_ZOOM_BUTTON_SELECTOR = "[data-map-zoom]";
const DISTRICT_CANVAS_SELECTOR = "[data-district-canvas]";
const DISTRICT_TOOLTIP_SELECTOR = "[data-district-tooltip]";
const DISTRICT_TOOLTIP_VALUE_SELECTOR = "[data-district-tooltip-value]";
const DISTRICT_TOOLTIP_TYPE_SELECTOR = "[data-district-tooltip-type]";
const DISTRICT_TOOLTIP_GOSSIP_SELECTOR = "[data-district-tooltip-gossip]";
const DISTRICT_POPUP_SELECTOR = "[data-district-popup]";
const DISTRICT_POPUP_CARD_SELECTOR = "[data-district-popup-card]";
const DISTRICT_POPUP_TITLE_SELECTOR = "[data-district-popup-title]";
const DISTRICT_POPUP_TYPE_SELECTOR = "[data-district-popup-type]";
const DISTRICT_POPUP_OWNER_SELECTOR = "[data-district-popup-owner]";
const DISTRICT_POPUP_OWNER_META_SELECTOR = "[data-district-popup-owner-meta]";
const DISTRICT_POPUP_OWNER_AVATAR_SELECTOR = "[data-district-popup-owner-avatar]";
const DISTRICT_POPUP_OWNER_AVATAR_FALLBACK_SELECTOR = "[data-district-popup-owner-avatar-fallback]";
const DISTRICT_POPUP_DEFENSE_SELECTOR = "[data-district-popup-defense]";
const DISTRICT_POPUP_DEFENSE_POWER_SELECTOR = "[data-district-popup-defense-power]";
const DISTRICT_POPUP_RESIDENTS_SELECTOR = "[data-district-popup-residents]";
const DISTRICT_POPUP_INCOME_SELECTOR = "[data-district-popup-income]";
const DISTRICT_POPUP_HEAT_SELECTOR = "[data-district-popup-heat]";
const DISTRICT_POPUP_INFLUENCE_SELECTOR = "[data-district-popup-influence]";
const DISTRICT_POPUP_FLAGS_SELECTOR = "[data-district-popup-flags]";
const DISTRICT_POPUP_TOGGLE_SELECTOR = "[data-district-popup-toggle]";
const DISTRICT_POPUP_CLOSE_SELECTOR = "[data-district-popup-close]";
const DISTRICT_POPUP_ATMOSPHERE_IMAGE_SELECTOR = "[data-district-popup-atmosphere-image]";
const DISTRICT_POPUP_ATMOSPHERE_LABEL_SELECTOR = "[data-district-popup-atmosphere-label]";
const DISTRICT_POPUP_ATMOSPHERE_MOOD_SELECTOR = "[data-district-popup-atmosphere-mood]";
const DISTRICT_POPUP_BUILDINGS_SELECTOR = "[data-district-popup-buildings]";
const DISTRICT_POPUP_BUILDINGS_META_SELECTOR = "[data-district-popup-buildings-meta]";
const DISTRICT_POPUP_BUILDINGS_LIST_SELECTOR = "[data-district-popup-buildings-list]";
const DISTRICT_POPUP_GOSSIP_SELECTOR = "[data-district-popup-gossip]";
const DISTRICT_POPUP_GOSSIP_LIST_SELECTOR = "[data-district-popup-gossip-list]";
const DISTRICT_ACTION_SECTION_SELECTOR = "[data-district-action-section]";
const DISTRICT_ACTIONS_SELECTOR = "[data-district-actions]";
const SPY_TOAST_SELECTOR = "[data-spy-toast]";
const ATTACK_TOAST_SELECTOR = "[data-attack-toast]";
const ROBBERY_TOAST_SELECTOR = "[data-robbery-toast]";
const GAME_PHASE_TOGGLE_SELECTOR = "[data-game-phase-toggle]";
const BUILDING_ACTION_STATE_SELECTOR = "[data-building-action-state]";
const BUILDING_ACTION_SUMMARY_SELECTOR = "[data-building-action-summary]";
const BUILDING_ACTION_META_SELECTOR = "[data-building-action-meta]";
const BUILDING_ACTION_CLEAR_SELECTOR = "[data-building-action-clear]";
const BUILDING_ACTION_FEED_SELECTOR = "[data-building-action-feed]";
const BUILDING_ACTION_EMPTY_SELECTOR = "[data-building-action-empty]";
const BUILDING_ACTION_REMOVE_SELECTOR = "[data-building-action-remove]";
const SPY_CAPTURE_COOLDOWN_MS = 40_000;
const DEV_ONLY_POLICE_INTERVAL_MS = 30_000;
const DEV_ONLY_DESTROYED_DISTRICT_ID = 8;
const GANG_MEMBERS_SELECTOR = "[data-gang-members]";
const GANG_HEAT_SELECTOR = "[data-gang-heat]";
const GANG_STAR_SELECTOR = "[data-gang-star]";
const GANG_STARS_SELECTOR = "[data-gang-stars]";
const WANTED_POPUP_SELECTOR = "[data-wanted-popup]";
const WANTED_POPUP_CLOSE_SELECTOR = "[data-wanted-popup-close]";
const WANTED_POPUP_HEAT_SELECTOR = "[data-wanted-popup-heat]";
const WANTED_POPUP_LEVEL_SELECTOR = "[data-wanted-popup-level]";
const WANTED_POPUP_TIER_SELECTOR = "[data-wanted-popup-tier]";
const WANTED_POPUP_DESCRIPTION_SELECTOR = "[data-wanted-popup-description]";
const WANTED_POPUP_PROTECTION_SELECTOR = "[data-wanted-popup-protection]";
const WANTED_POPUP_LEVELS_SELECTOR = "[data-wanted-popup-levels]";
const WANTED_POPUP_RISE_LIST_SELECTOR = "[data-wanted-popup-rise-list]";
const WANTED_POPUP_FALL_LIST_SELECTOR = "[data-wanted-popup-fall-list]";
const WANTED_POPUP_FEEDBACK_SELECTOR = "[data-wanted-popup-feedback]";
const WANTED_POPUP_DIRTY_ACTION_SELECTOR = "[data-wanted-popup-dirty]";
const WANTED_POPUP_CLEAN_ACTION_SELECTOR = "[data-wanted-popup-clean]";
const WANTED_POPUP_CLEAR_LOG_SELECTOR = "[data-wanted-popup-clear-log]";
const PLAYER_PROFILE_OPEN_SELECTOR = "[data-player-profile-open]";
const PLAYER_POPUP_SELECTOR = "[data-player-popup]";
const PLAYER_POPUP_CARD_SELECTOR = "[data-player-popup-card]";
const PLAYER_POPUP_CLOSE_SELECTOR = "[data-player-popup-close]";
const BUILDINGS_POPUP_OPEN_SELECTOR = "[data-buildings-popup-open]";
const BUILDINGS_POPUP_SELECTOR = "[data-buildings-popup]";
const BUILDINGS_POPUP_CLOSE_SELECTOR = "[data-buildings-popup-close]";
const BUILDINGS_POPUP_TYPES_SELECTOR = "[data-buildings-popup-types]";
const BUILDINGS_POPUP_DETAIL_SELECTOR = "[data-buildings-popup-detail]";
const MARKET_POPUP_OPEN_SELECTOR = "[data-market-popup-open]";
const MARKET_POPUP_SELECTOR = "[data-market-popup]";
const MARKET_POPUP_CLOSE_SELECTOR = "[data-market-popup-close]";
const MARKET_TAB_SELECTOR = "[data-market-tab]";
const MARKET_COPY_SELECTOR = "[data-market-copy]";
const MARKET_LIST_SELECTOR = "[data-market-list]";
const SETTINGS_MODAL_SELECTOR = "#settings-modal";
const SETTINGS_MODAL_BACKDROP_SELECTOR = "#settings-modal-backdrop";
const SETTINGS_MODAL_CLOSE_SELECTOR = "#settings-modal-close";
const SETTINGS_SAVE_SELECTOR = "#settings-save-btn";
const SETTINGS_MAP_BORDERS_SELECTOR = "#settings-map-district-borders";
const SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR = "#settings-map-alliance-symbols";
const SETTINGS_MAP_VISIBILITY_SELECTOR = "#settings-map-visibility";
const SETTINGS_LANGUAGE_SELECTOR = "#settings-language";
const TOPBAR_CLEAN_MONEY_SELECTOR = "[data-topbar-clean-money]";
const TOPBAR_DIRTY_MONEY_SELECTOR = "[data-topbar-dirty-money]";
const TOPBAR_INFLUENCE_SELECTOR = "[data-topbar-influence]";
const TOPBAR_SPY_PILL_SELECTOR = "[data-topbar-spy-pill]";
const TOPBAR_SPY_LABEL_SELECTOR = "[data-topbar-spy-label]";
const TOPBAR_SPY_VALUE_SELECTOR = "[data-topbar-spy-value]";
const PLAYER_POPUP_CLEAN_MONEY_SELECTOR = "[data-player-popup-clean-money]";
const PLAYER_POPUP_DIRTY_MONEY_SELECTOR = "[data-player-popup-dirty-money]";
const PLAYER_POPUP_INFLUENCE_SELECTOR = "[data-player-popup-influence]";
const PLAYER_POPUP_IDENTITY_SELECTOR = "[data-player-popup-identity]";
const PLAYER_POPUP_FACTION_SELECTOR = "[data-player-popup-faction]";
const PLAYER_POPUP_SERVER_SELECTOR = "[data-player-popup-server]";
const PLAYER_POPUP_START_DISTRICT_SELECTOR = "[data-player-popup-start-district]";
const PLAYER_POPUP_HEAT_SELECTOR = "[data-player-popup-heat]";
const PLAYER_POPUP_PROTECTION_SELECTOR = "[data-player-popup-protection]";
const PLAYER_POPUP_GANG_SELECTOR = "[data-player-popup-gang]";
const PLAYER_POPUP_ALLIANCE_SELECTOR = "[data-player-popup-alliance]";
const PLAYER_POPUP_DISTRICTS_SELECTOR = "[data-player-popup-districts]";
const ALLIANCE_POPUP_OPEN_SELECTOR = "[data-alliance-popup-open]";
const ALLIANCE_POPUP_SELECTOR = "[data-alliance-popup]";
const ALLIANCE_POPUP_CLOSE_SELECTOR = "[data-alliance-popup-close]";
const STORAGE_POPUP_OPEN_SELECTOR = "[data-storage-popup-open]";
const STORAGE_POPUP_SELECTOR = "[data-storage-popup]";
const STORAGE_POPUP_CLOSE_SELECTOR = "[data-storage-popup-close]";
const STORAGE_MATERIAL_COUNT_SELECTOR = "[data-storage-material-count]";
const STORAGE_DRUG_COUNT_SELECTOR = "[data-storage-drug-count]";
const STORAGE_FACTORY_COUNT_SELECTOR = "[data-storage-factory-count]";
const PHARMACY_POPUP_OPEN_SELECTOR = "[data-pharmacy-popup-open]";
const PHARMACY_POPUP_SELECTOR = "[data-pharmacy-popup]";
const PHARMACY_POPUP_CLOSE_SELECTOR = "[data-pharmacy-popup-close]";
const DRUGLAB_POPUP_OPEN_SELECTOR = "[data-druglab-popup-open]";
const DRUGLAB_POPUP_SELECTOR = "[data-druglab-popup]";
const DRUGLAB_POPUP_CLOSE_SELECTOR = "[data-druglab-popup-close]";
const FACTORY_POPUP_OPEN_SELECTOR = "[data-factory-popup-open]";
const FACTORY_POPUP_SELECTOR = "[data-factory-popup]";
const FACTORY_POPUP_CLOSE_SELECTOR = "[data-factory-popup-close]";
const FACTORY_LEVEL_SELECTOR = "[data-factory-level]";
const FACTORY_HEADER_LEVEL_SELECTOR = "[data-factory-header-level]";
const FACTORY_MULTIPLIER_SELECTOR = "[data-factory-multiplier]";
const FACTORY_OWNED_COUNT_SELECTOR = "[data-factory-owned-count]";
const FACTORY_UPGRADE_COST_SELECTOR = "[data-factory-upgrade-cost]";
const FACTORY_RESOURCE_METAL_SELECTOR = "[data-factory-resource-metal]";
const FACTORY_RESOURCE_TECH_SELECTOR = "[data-factory-resource-tech]";
const FACTORY_RESOURCE_COMBAT_SELECTOR = "[data-factory-resource-combat]";
const FACTORY_SUPPLY_METAL_SELECTOR = "[data-factory-supply-metal]";
const FACTORY_SUPPLY_TECH_SELECTOR = "[data-factory-supply-tech]";
const FACTORY_SUPPLY_COMBAT_SELECTOR = "[data-factory-supply-combat]";
const FACTORY_SLOT_LIST_SELECTOR = "[data-factory-slot-list]";
const FACTORY_EFFECTS_LABEL_SELECTOR = "[data-factory-effects-label]";
const FACTORY_UPGRADE_SELECTOR = "[data-factory-upgrade]";
const FACTORY_COLLECT_SELECTOR = "[data-factory-collect]";
const FACTORY_ACTIVE_BOOST_SELECTOR = "[data-factory-active-boost]";
const FACTORY_BOOST_BUTTON_SELECTOR = "[data-factory-boost]";
const FACTORY_TAB_SELECTOR = "[data-factory-tab]";
const FACTORY_PANEL_SELECTOR = "[data-factory-panel]";
const ARMORY_POPUP_OPEN_SELECTOR = "[data-armory-popup-open]";
const ARMORY_POPUP_SELECTOR = "[data-armory-popup]";
const ARMORY_POPUP_CLOSE_SELECTOR = "[data-armory-popup-close]";
const PRODUCTION_BUILDING_TAB_SELECTOR = "[data-production-building-tab]";
const PRODUCTION_BUILDING_PANEL_SELECTOR = "[data-production-building-panel]";
const PRODUCTION_BUILDING_LEVEL_SELECTOR = "[data-production-building-level]";
const PRODUCTION_BUILDING_HEADER_LEVEL_SELECTOR = "[data-production-building-header-level]";
const PRODUCTION_BUILDING_MULTIPLIER_SELECTOR = "[data-production-building-multiplier]";
const PRODUCTION_BUILDING_READY_SELECTOR = "[data-production-building-ready]";
const PRODUCTION_BUILDING_UPGRADE_COST_SELECTOR = "[data-production-building-upgrade-cost]";
const PRODUCTION_BUILDING_EFFECTS_SELECTOR = "[data-production-building-effects]";
const PRODUCTION_BUILDING_COLLECT_SELECTOR = "[data-production-building-collect]";
const PRODUCTION_BUILDING_UPGRADE_SELECTOR = "[data-production-building-upgrade]";
const PRODUCTION_BUILDING_INFO_TEXT_SELECTOR = "[data-production-building-info-text]";
const PRODUCTION_BUILDING_INFO_EFFECTS_SELECTOR = "[data-production-building-info-effects]";
const PRODUCTION_BUILDING_INFO_ACTIONS_SELECTOR = "[data-production-building-info-actions]";
const ATTACK_SETUP_POPUP_SELECTOR = "[data-attack-setup-popup]";
const ATTACK_SETUP_CARD_SELECTOR = "[data-attack-setup-card]";
const ATTACK_SETUP_CLOSE_SELECTOR = "[data-attack-setup-close]";
const ATTACK_SETUP_ATMOSPHERE_IMAGE_SELECTOR = "[data-attack-setup-atmosphere-image]";
const ATTACK_SETUP_ATMOSPHERE_LABEL_SELECTOR = "[data-attack-setup-atmosphere-label]";
const ATTACK_TARGET_TITLE_SELECTOR = "[data-attack-target-title]";
const ATTACK_SOURCE_SELECT_SELECTOR = "[data-attack-source-select]";
const ATTACK_AVAILABLE_POPULATION_SELECTOR = "[data-attack-available-population]";
const ATTACK_REQUIRED_POPULATION_SELECTOR = "[data-attack-required-population]";
const ATTACK_ESTIMATED_POWER_SELECTOR = "[data-attack-estimated-power]";
const ATTACK_STATUS_SELECTOR = "[data-attack-status]";
const ATTACK_WEAPON_INPUT_SELECTOR = "[data-attack-weapon-input]";
const ATTACK_OWNED_SELECTOR = "[data-attack-owned]";
const ATTACK_CONFIRM_SELECTOR = "[data-attack-confirm]";
const ATTACK_CONFIRM_POPUP_SELECTOR = "[data-attack-confirm-popup]";
const ATTACK_CONFIRM_CARD_SELECTOR = "[data-attack-confirm-card]";
const ATTACK_CONFIRM_CLOSE_SELECTOR = "[data-attack-confirm-close]";
const ATTACK_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR = "[data-attack-confirm-atmosphere-image]";
const ATTACK_CONFIRM_ATMOSPHERE_LABEL_SELECTOR = "[data-attack-confirm-atmosphere-label]";
const ATTACK_CONFIRM_TITLE_SELECTOR = "[data-attack-confirm-title]";
const ATTACK_CONFIRM_SOURCE_SELECTOR = "[data-attack-confirm-source]";
const ATTACK_CONFIRM_MEMBERS_SELECTOR = "[data-attack-confirm-members]";
const ATTACK_CONFIRM_POWER_SELECTOR = "[data-attack-confirm-power]";
const ATTACK_CONFIRM_SCENARIO_SELECTOR = "[data-attack-confirm-scenario]";
const ATTACK_CONFIRM_DURATION_SELECTOR = "[data-attack-confirm-duration]";
const ATTACK_CONFIRM_NOTE_SELECTOR = "[data-attack-confirm-note]";
const ATTACK_CONFIRM_BUTTON_SELECTOR = "[data-attack-confirm-button]";
const ROBBERY_SETUP_POPUP_SELECTOR = "[data-robbery-setup-popup]";
const ROBBERY_SETUP_CARD_SELECTOR = "[data-robbery-setup-card]";
const ROBBERY_SETUP_CLOSE_SELECTOR = "[data-robbery-setup-close]";
const ROBBERY_SETUP_ATMOSPHERE_IMAGE_SELECTOR = "[data-robbery-setup-atmosphere-image]";
const ROBBERY_SETUP_ATMOSPHERE_LABEL_SELECTOR = "[data-robbery-setup-atmosphere-label]";
const ROBBERY_TARGET_TITLE_SELECTOR = "[data-robbery-target-title]";
const ROBBERY_SOURCE_SELECT_SELECTOR = "[data-robbery-source-select]";
const ROBBERY_AVAILABLE_MEMBERS_SELECTOR = "[data-robbery-available-members]";
const ROBBERY_MEMBER_INPUT_SELECTOR = "[data-robbery-member-input]";
const ROBBERY_STATUS_SELECTOR = "[data-robbery-status]";
const ROBBERY_CONFIRM_SELECTOR = "[data-robbery-confirm]";
const ROBBERY_CONFIRM_POPUP_SELECTOR = "[data-robbery-confirm-popup]";
const ROBBERY_CONFIRM_CARD_SELECTOR = "[data-robbery-confirm-card]";
const ROBBERY_CONFIRM_CLOSE_SELECTOR = "[data-robbery-confirm-close]";
const ROBBERY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR = "[data-robbery-confirm-atmosphere-image]";
const ROBBERY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR = "[data-robbery-confirm-atmosphere-label]";
const ROBBERY_CONFIRM_TITLE_SELECTOR = "[data-robbery-confirm-title]";
const ROBBERY_CONFIRM_SOURCE_SELECTOR = "[data-robbery-confirm-source]";
const ROBBERY_CONFIRM_MEMBERS_SELECTOR = "[data-robbery-confirm-members]";
const ROBBERY_CONFIRM_DURATION_SELECTOR = "[data-robbery-confirm-duration]";
const ROBBERY_CONFIRM_NOTE_SELECTOR = "[data-robbery-confirm-note]";
const ROBBERY_CONFIRM_BUTTON_SELECTOR = "[data-robbery-confirm-button]";
const DEFENSE_SETUP_POPUP_SELECTOR = "[data-defense-setup-popup]";
const DEFENSE_SETUP_CARD_SELECTOR = "[data-defense-setup-card]";
const DEFENSE_SETUP_CLOSE_SELECTOR = "[data-defense-setup-close]";
const DEFENSE_SETUP_ATMOSPHERE_IMAGE_SELECTOR = "[data-defense-setup-atmosphere-image]";
const DEFENSE_SETUP_ATMOSPHERE_LABEL_SELECTOR = "[data-defense-setup-atmosphere-label]";
const DEFENSE_TARGET_TITLE_SELECTOR = "[data-defense-target-title]";
const DEFENSE_STATUS_SELECTOR = "[data-defense-status]";
const DEFENSE_ESTIMATED_POWER_SELECTOR = "[data-defense-estimated-power]";
const DEFENSE_WEAPON_INPUT_SELECTOR = "[data-defense-weapon-input]";
const DEFENSE_OWNED_SELECTOR = "[data-defense-owned]";
const DEFENSE_RESIDENTS_INPUT_SELECTOR = "[data-defense-residents-input]";
const DEFENSE_CONFIRM_SELECTOR = "[data-defense-confirm]";
const TRAP_CONFIRM_POPUP_SELECTOR = "[data-trap-confirm-popup]";
const TRAP_CONFIRM_CARD_SELECTOR = "[data-trap-confirm-card]";
const TRAP_CONFIRM_CLOSE_SELECTOR = "[data-trap-confirm-close]";
const TRAP_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR = "[data-trap-confirm-atmosphere-image]";
const TRAP_CONFIRM_ATMOSPHERE_LABEL_SELECTOR = "[data-trap-confirm-atmosphere-label]";
const TRAP_CONFIRM_TITLE_SELECTOR = "[data-trap-confirm-title]";
const TRAP_CONFIRM_COOLDOWN_SELECTOR = "[data-trap-confirm-cooldown]";
const TRAP_CONFIRM_NOTE_SELECTOR = "[data-trap-confirm-note]";
const TRAP_CONFIRM_BUTTON_SELECTOR = "[data-trap-confirm-button]";
const SPY_CONFIRM_POPUP_SELECTOR = "[data-spy-confirm-popup]";
const SPY_CONFIRM_CARD_SELECTOR = "[data-spy-confirm-card]";
const SPY_CONFIRM_CLOSE_SELECTOR = "[data-spy-confirm-close]";
const SPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR = "[data-spy-confirm-atmosphere-image]";
const SPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR = "[data-spy-confirm-atmosphere-label]";
const SPY_CONFIRM_TITLE_SELECTOR = "[data-spy-confirm-title]";
const SPY_CONFIRM_SOURCE_SELECTOR = "[data-spy-confirm-source]";
const SPY_CONFIRM_AVAILABLE_SELECTOR = "[data-spy-confirm-available]";
const SPY_CONFIRM_DURATION_SELECTOR = "[data-spy-confirm-duration]";
const SPY_CONFIRM_NOTE_SELECTOR = "[data-spy-confirm-note]";
const SPY_CONFIRM_BUTTON_SELECTOR = "[data-spy-confirm-button]";
const OCCUPY_CONFIRM_POPUP_SELECTOR = "[data-occupy-confirm-popup]";
const OCCUPY_CONFIRM_CARD_SELECTOR = "[data-occupy-confirm-card]";
const OCCUPY_CONFIRM_CLOSE_SELECTOR = "[data-occupy-confirm-close]";
const OCCUPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR = "[data-occupy-confirm-atmosphere-image]";
const OCCUPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR = "[data-occupy-confirm-atmosphere-label]";
const OCCUPY_CONFIRM_TITLE_SELECTOR = "[data-occupy-confirm-title]";
const OCCUPY_CONFIRM_SOURCE_SELECTOR = "[data-occupy-confirm-source]";
const OCCUPY_CONFIRM_CONDITION_SELECTOR = "[data-occupy-confirm-condition]";
const OCCUPY_CONFIRM_DURATION_SELECTOR = "[data-occupy-confirm-duration]";
const OCCUPY_CONFIRM_NOTE_SELECTOR = "[data-occupy-confirm-note]";
const OCCUPY_CONFIRM_BUTTON_SELECTOR = "[data-occupy-confirm-button]";
const SPY_RESULT_MODAL_SELECTOR = "#spy-result-modal";
const SPY_RESULT_MODAL_BACKDROP_SELECTOR = "#spy-result-modal-backdrop";
const SPY_RESULT_MODAL_CLOSE_SELECTOR = "#spy-result-modal-close";
const SPY_RESULT_MODAL_OK_SELECTOR = "#spy-result-modal-ok";
const SPY_RESULT_MODAL_CONTENT_SELECTOR = "#spy-result-modal-content";
const SPY_RESULT_MODAL_TITLE_SELECTOR = "#spy-result-modal-title";
const SPY_RESULT_MODAL_SUMMARY_SELECTOR = "#spy-result-modal-summary";
const SPY_RESULT_MODAL_DETAILS_SELECTOR = "#spy-result-modal-details";
const SPY_WARNING_MODAL_SELECTOR = "#spy-warning-modal";
const SPY_WARNING_MODAL_BACKDROP_SELECTOR = "#spy-warning-modal-backdrop";
const SPY_WARNING_MODAL_CLOSE_SELECTOR = "#spy-warning-modal-close";
const SPY_WARNING_MODAL_OK_SELECTOR = "#spy-warning-modal-ok";
const SPY_WARNING_MODAL_CONTENT_SELECTOR = "#spy-warning-modal-content";
const SPY_WARNING_MODAL_TITLE_SELECTOR = "#spy-warning-modal-title";
const SPY_WARNING_MODAL_BADGE_SELECTOR = "#spy-warning-modal-badge";
const SPY_WARNING_MODAL_SUMMARY_SELECTOR = "#spy-warning-modal-summary";
const SPY_WARNING_MODAL_DETAILS_SELECTOR = "#spy-warning-modal-details";
const RAID_RESULT_MODAL_SELECTOR = "#raid-result-modal";
const RAID_RESULT_MODAL_BACKDROP_SELECTOR = "#raid-result-modal-backdrop";
const RAID_RESULT_MODAL_CLOSE_SELECTOR = "#raid-result-modal-close";
const RAID_RESULT_MODAL_OK_SELECTOR = "#raid-result-modal-ok";
const RAID_RESULT_MODAL_CONTENT_SELECTOR = "#raid-result-modal-content";
const RAID_RESULT_MODAL_TITLE_SELECTOR = "#raid-result-modal-title";
const RAID_RESULT_MODAL_SUMMARY_SELECTOR = "#raid-result-modal-summary";
const RAID_RESULT_MODAL_DETAILS_SELECTOR = "#raid-result-modal-details";
const ATTACK_RESULT_MODAL_SELECTOR = "#attack-result-modal";
const ATTACK_RESULT_MODAL_BACKDROP_SELECTOR = "#attack-result-modal-backdrop";
const ATTACK_RESULT_MODAL_CLOSE_SELECTOR = "#attack-result-modal-close";
const ATTACK_RESULT_MODAL_OK_SELECTOR = "#attack-result-modal-ok";
const ATTACK_RESULT_MODAL_CONTENT_SELECTOR = "#attack-result-modal-content";
const ATTACK_RESULT_MODAL_TITLE_SELECTOR = "#attack-result-modal-title";
const ATTACK_RESULT_MODAL_BADGE_SELECTOR = "#attack-result-modal-badge";
const ATTACK_RESULT_MODAL_SUMMARY_SELECTOR = "#attack-result-modal-summary";
const ATTACK_RESULT_MODAL_STATS_SELECTOR = "#attack-result-modal-stats";
const ATTACK_RESULT_MODAL_TARGET_LABEL_SELECTOR = "#attack-result-modal-label-target";
const ATTACK_RESULT_MODAL_TARGET_VALUE_SELECTOR = "#attack-result-modal-nickname";
const ATTACK_RESULT_MODAL_ATTACK_LABEL_SELECTOR = "#attack-result-modal-label-attack";
const ATTACK_RESULT_MODAL_ATTACK_VALUE_SELECTOR = "#attack-result-modal-faction";
const ATTACK_RESULT_MODAL_DEFENSE_LABEL_SELECTOR = "#attack-result-modal-label-defense";
const ATTACK_RESULT_MODAL_DEFENSE_VALUE_SELECTOR = "#attack-result-modal-alliance";
const ATTACK_RESULT_MODAL_ATTACK_LOSS_LABEL_SELECTOR = "#attack-result-modal-label-attack-losses";
const ATTACK_RESULT_MODAL_ATTACK_LOSS_VALUE_SELECTOR = "#attack-result-modal-weapons";
const ATTACK_RESULT_MODAL_DEFENSE_LOSS_LABEL_SELECTOR = "#attack-result-modal-label-defense-losses";
const ATTACK_RESULT_MODAL_DEFENSE_LOSS_VALUE_SELECTOR = "#attack-result-modal-power";
const ATTACK_RESULT_MODAL_STATE_LABEL_SELECTOR = "#attack-result-modal-label-state";
const ATTACK_RESULT_MODAL_STATE_VALUE_SELECTOR = "#attack-result-modal-members";
const ATTACK_RESULT_MODAL_DURATION_LABEL_SELECTOR = "#attack-result-modal-label-duration";
const ATTACK_RESULT_MODAL_DURATION_VALUE_SELECTOR = "#attack-result-modal-duration";
const POLICE_ACTION_RESULT_MODAL_SELECTOR = "#police-action-result-modal";
const POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR = "#police-action-result-modal-backdrop";
const POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR = "#police-action-result-modal-close";
const POLICE_ACTION_RESULT_MODAL_OK_SELECTOR = "#police-action-result-modal-ok";
const POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR = "#police-action-result-modal-content";
const POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR = "#police-action-result-modal-title";
const POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR = "#police-action-result-modal-badge";
const POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR = "#police-action-result-modal-summary";
const POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR = "#police-action-result-modal-details";
const CITY_CLOCK_SELECTOR = "[data-city-clock]";
const CITY_DAY_PHASE_SELECTOR = "[data-city-day-phase]";
const CITY_GAME_PHASE_SELECTOR = "[data-city-game-phase]";
const CITY_STATUS_SELECTOR = "[data-city-status]";
const CITY_PRODUCTION_SELECTOR = "[data-city-production]";
const DAY_MAP_IMAGE_PATH = "../../img/mapaden2.png";
const NIGHT_MAP_IMAGE_PATH = "../../img/mapanoc.png";
const STORAGE_WEAPON_COUNT_SELECTOR = "[data-storage-weapon-count]";
const BUILDING_ACTION_EMPTY_SNAPSHOT = Object.freeze({
  tone: "idle",
  title: "Připraveno",
  summary: "Žádné uliční zprávy. Panel čeká na další akci ve městě.",
  meta: "Čeká na první herní akci"
});
const BUILDING_ACTION_LOG_LIMIT = 30;
const MONEY_STAT_COUNT_TICK_MS = 26;
const DISTRICT_GOSSIP_MAX_PER_DISTRICT = 24;
const buildingActionPanels = new WeakMap();
const attackMissionTimers = new Map();
const occupyMissionTimers = new Map();
const robberyMissionTimers = new Map();
const spyMissionTimers = new Map();
const productionTimers = new Map();
const moneyStatAnimationTimers = new Map();
const moneyStatCountIntervals = new Map();
const pendingResultModalQueue = [];
let policeActionResultLiveTimerId = null;
let spyToastTimerId = null;
let attackToastTimerId = null;
let robberyToastTimerId = null;
let devOnlyPoliceNextActionAt = 0;
let devOnlyPoliceLastTargetPlayerId = null;
let marketPriceTimerId = null;
const ATTACK_WEAPON_LABELS = Object.freeze({
  "baseball-bat": "Baseballová pálka",
  pistol: "Pistole",
  grenade: "Granát",
  smg: "SMG",
  bazooka: "Bazuka",
  vest: "Vesta",
  barricades: "Barikády",
  cameras: "Kamery",
  "defense-tower": "Defense tower",
  alarm: "Alarm"
});
const GANG_HEAT_DIRTY_COST = 500;
const GANG_HEAT_DIRTY_REDUCTION = 10;
const GANG_HEAT_CLEAN_COST = 300;
const GANG_HEAT_CLEAN_REDUCTION = 15;
const GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS = 30 * 60 * 1000;
const GANG_HEAT_DIRTY_TRIGGER_COUNT = 3;
const GANG_HEAT_POLICE_DURATION_MS = 60 * 60 * 1000;
const GANG_HEAT_RAID_PROTECTION_MS = 5 * 60 * 60 * 1000;
const GANG_HEAT_JOURNAL_LIMIT = 18;
const GANG_HEAT_AUTO_POLICE_INTERVAL_BY_TIER = Object.freeze({
  1: 0,
  2: 4 * 60 * 1000,
  3: 3 * 60 * 1000,
  4: 2 * 60 * 1000,
  5: 90 * 1000,
  6: 60 * 1000
});
const GANG_HEAT_TIERS = Object.freeze([
  Object.freeze({
    id: 1,
    minHeat: 0,
    maxHeat: 24,
    label: "Tier 1",
    title: "Nízký heat",
    description: "Lehký dohled. Gang je skoro pod radarem."
  }),
  Object.freeze({
    id: 2,
    minHeat: 25,
    maxHeat: 74,
    label: "Tier 2",
    title: "Podezřelý",
    description: "Policie už si všímá provozu, cashflow a pohybu lidí."
  }),
  Object.freeze({
    id: 3,
    minHeat: 75,
    maxHeat: 149,
    label: "Tier 3",
    title: "Známý problém",
    description: "Častější kontroly, víc otázek a první cílené zásahy."
  }),
  Object.freeze({
    id: 4,
    minHeat: 150,
    maxHeat: 299,
    label: "Tier 4",
    title: "Rizikový cíl",
    description: "Aktivní tlak na distrikty, sklady a krycí provozy."
  }),
  Object.freeze({
    id: 5,
    minHeat: 300,
    maxHeat: 499,
    label: "Tier 5",
    title: "Prioritní cíl",
    description: "Těžké razie, zabavení zásob a rychlé uzávěry districtů."
  }),
  Object.freeze({
    id: 6,
    minHeat: 500,
    maxHeat: Number.POSITIVE_INFINITY,
    label: "Tier 6",
    title: "Totální hon",
    description: "Koordinované zásahy, tvrdé blokády a permanentní tlak."
  })
]);
const GANG_HEAT_DECAY_BY_TIER = Object.freeze({
  1: 4,
  2: 3,
  3: 2,
  4: 1.5,
  5: 1,
  6: 0.6
});
const POLICE_RAID_SPECIALTIES = Object.freeze({
  financial: Object.freeze({ key: "financial", label: "Finanční zásah", icon: "💰" }),
  drug: Object.freeze({ key: "drug", label: "Drogová razie", icon: "🧪" }),
  weapons: Object.freeze({ key: "weapons", label: "Zbrojní zásah", icon: "🛡️" }),
  arrests: Object.freeze({ key: "arrests", label: "Zatýkací vlna", icon: "👥" }),
  total: Object.freeze({ key: "total", label: "Celková razie", icon: "⚠️" })
});
const POLICE_SPECIALTY_RANDOM_WEIGHTS = Object.freeze([
  Object.freeze({ key: "total", weight: 55 }),
  Object.freeze({ key: "financial", weight: 11.25 }),
  Object.freeze({ key: "drug", weight: 11.25 }),
  Object.freeze({ key: "weapons", weight: 11.25 }),
  Object.freeze({ key: "arrests", weight: 11.25 })
]);
const POLICE_OPERATION_TYPES = Object.freeze({
  warning_notice: Object.freeze({
    key: "warning_notice",
    label: "Lehká kontrola",
    minTier: 1,
    weight: 11,
    durationMs: 15 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `District ${districtName} je pod lehkým dohledem. Hlídky jen sondují provoz a pohyb lidí.`
  }),
  district_control: Object.freeze({
    key: "district_control",
    label: "Kontrola districtu",
    minTier: 2,
    weight: 9,
    durationMs: 18 * 60 * 1000,
    specialtyKey: "arrests",
    summary: (districtName) => `V districtu ${districtName} probíhá zvýšená policejní kontrola a sběr informací.`
  }),
  cash_seizure: Object.freeze({
    key: "cash_seizure",
    label: "Kontrola cashflow",
    minTier: 3,
    weight: 7,
    durationMs: 22 * 60 * 1000,
    specialtyKey: "financial",
    summary: (districtName) => `Finanční jednotka sleduje podezřelé toky peněz kolem districtu ${districtName}.`
  }),
  warehouse_raid: Object.freeze({
    key: "warehouse_raid",
    label: "Skladová razie",
    minTier: 4,
    weight: 6,
    durationMs: 30 * 60 * 1000,
    specialtyKey: "weapons",
    summary: (districtName) => `Policie prohledává sklady a logistické body v districtu ${districtName}.`
  }),
  district_lock: Object.freeze({
    key: "district_lock",
    label: "Uzávěra districtu",
    minTier: 5,
    weight: 7,
    durationMs: 40 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `District ${districtName} je dočasně pod policejní uzávěrou.`
  }),
  apartment_search: Object.freeze({
    key: "apartment_search",
    label: "Domovní prohlídky",
    minTier: 4,
    weight: 6,
    durationMs: 35 * 60 * 1000,
    specialtyKey: "arrests",
    summary: (districtName) => `V districtu ${districtName} běží domovní prohlídky a odvozy podezřelých.`
  }),
  drug_seizure: Object.freeze({
    key: "drug_seizure",
    label: "Drogová razie",
    minTier: 3,
    weight: 8,
    durationMs: 24 * 60 * 1000,
    specialtyKey: "drug",
    summary: (districtName) => `Narkotická jednotka míří na výrobu a distribuci v districtu ${districtName}.`
  }),
  dirty_cash_seizure: Object.freeze({
    key: "dirty_cash_seizure",
    label: "Zásah proti praní peněz",
    minTier: 3,
    weight: 8,
    durationMs: 26 * 60 * 1000,
    specialtyKey: "financial",
    summary: (districtName) => `Podezřelé praní peněz přitáhlo finanční zásah do districtu ${districtName}.`
  }),
  building_shutdown: Object.freeze({
    key: "building_shutdown",
    label: "Odstávka provozu",
    minTier: 4,
    weight: 7,
    durationMs: 35 * 60 * 1000,
    specialtyKey: "weapons",
    summary: (districtName) => `Jedna z budov v districtu ${districtName} je pod nucenou odstávkou.`
  }),
  coordinated_operation: Object.freeze({
    key: "coordinated_operation",
    label: "Koordinovaná operace",
    minTier: 6,
    weight: 10,
    durationMs: 55 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `Na district ${districtName} běží koordinovaná razie více jednotek.`
  })
});
const POLICE_OPERATION_SEVERITY_MULTIPLIER = Object.freeze({
  warning_notice: 0,
  district_control: 0.55,
  cash_seizure: 0.8,
  warehouse_raid: 1,
  district_lock: 1.15,
  apartment_search: 0.9,
  drug_seizure: 0.9,
  dirty_cash_seizure: 0.95,
  building_shutdown: 1,
  coordinated_operation: 1.35
});
const POLICE_ACTION_TIER_MESSAGES = Object.freeze({
  1: Object.freeze({
    title: "LEHKÁ KONTROLA",
    tone: "is-tier-1",
    text: "Policie se tu jen motá. Pár otázek, pár pohledů zatím nic, co by tě mělo rozhodit."
  }),
  2: Object.freeze({
    title: "🟡 PODEZŘENÍ",
    tone: "is-tier-2",
    text: "Začínají čmuchat víc, než je zdrávo. Někdo něco řekl a oni to berou vážně."
  }),
  3: Object.freeze({
    title: "🟠 TLAK NA DISTRICT",
    tone: "is-tier-3",
    text: "Už to není náhoda. Kontroly, výslechy, lidi mizí z ulic. Policie tlačí a začíná to smrdět průserem."
  }),
  4: Object.freeze({
    title: "🔴 AKTIVNÍ RAZIE",
    tone: "is-tier-4",
    text: "Vlítli tam bez varování. Dveře v hajzlu, lidi na zemi. Berou všechno, co najdou a neptají se."
  }),
  5: Object.freeze({
    title: "🔴 BRUTÁLNÍ ZÁTAH",
    tone: "is-tier-5",
    text: "Tohle už není razie, to je masakr. Mlátí, berou, ničí. Kdo se pohne blbě, skončí v pytli."
  }),
  6: Object.freeze({
    title: "TOTÁLNÍ ČISTKA",
    tone: "is-tier-6",
    text: "Vlítli tam naplno. Sebrali cash, lidi i výbavu. District je vyčištěnej do mrtva a nikdo už tam nic neuhájí."
  })
});
const POLICE_ACTION_TIER_QUOTES = Object.freeze({
  1: Object.freeze([
    "Klídek, jen rutina ale ty mi tu nějak smrdíš.",
    "Dneska nic nehledám. Zatím. Ale pamatuju si ksichty.",
    "Hezký místo. Byla by škoda, kdybych se sem musel vrátit s partou.",
    "Ukaž, co tu schováváš nebo si to najdu sám příště.",
    "Neboj, dneska jen koukám. Zítra už možná beru.",
    "Máš štěstí, že mám dneska dobrou náladu.",
    "Zatím to nechám být ale něco mi říká, že se ještě uvidíme.",
    "Nedělej blbosti a možná tě nechám žít v klidu.",
    "Jen si tu dělám obrázek. A věř mi, že se rychle skládá.",
    "Dneska odcházím. Příště už nemusím."
  ]),
  2: Object.freeze([
    "Někdo začal mluvit a tvoje jméno padlo víc než jednou.",
    "Už to není jen rutina. Něco tu nesedí a ty víš co.",
    "Řekni mi to rovnou ušetříš si problémy. Možná.",
    "Začínáš mě fakt zajímat. A to nechceš.",
    "Vidím, jak se tu hýbou věci. A někdo za tím stojí.",
    "Ještě nejdu po tobě naplno ale blíž už být nemůžu.",
    "Stačí jedna chyba. A já tu nebudu sám.",
    "Máš kolem sebe dost bordelu. Dřív nebo později se v tom utopíš.",
    "Já už vím dost. Teď čekám, kolik toho najdu.",
    "Zatím tě jen sleduju ale věř mi, že to rychle skončí."
  ]),
  3: Object.freeze([
    "Už to tu máme pod kontrolou. Ty tu jen čekáš, až tě sundáme.",
    "Lidi mizí, obchody zavírají a ty jsi uprostřed toho bordelu.",
    "Každej kout tady znám. Nemáš se kam schovat.",
    "Tvoje malý impérium se začíná rozpadat. Slyšíš to praskání?",
    "Zatím jen tlačím. A ty už sotva dýcháš.",
    "Každej tvůj krok sledujem. Jedna chyba a končíš.",
    "Ulice už nejsou tvoje. Jen jsi poslední, kdo to ještě nepochopil.",
    "Tvoje lidi začínají mluvit. A věř mi, že rádi.",
    "Není to otázka jestli ale kdy tě rozkopeme na kusy.",
    "Tohle místo už patří nám. Ty jsi tu jen dočasnej problém."
  ]),
  4: Object.freeze([
    "Na zem! Teď hned, nebo tě tam dostanu já!",
    "Konec hry. Všechno jde ven lidi, prachy, zbraně.",
    "Dveře jsou v hajzlu a ty jdeš s nima.",
    "Ruce kde je vidím! Jedna blbost a končíš!",
    "Tohle jsme ti říkali. Teď už jen sklízíš, cos zasel.",
    "Bal to. Tady už nic nepatří tobě.",
    "Každej kout projdeme. Každou krysu vytáhnem.",
    "Už nejsi boss. Teď jsi jen další případ.",
    "Naložit všechno! Nic tu nezůstane!",
    "Měl jsi šanci to držet v klidu. Teď už je pozdě."
  ]),
  5: Object.freeze([
    "Na zem, kurva! Hned, nebo tě složím!",
    "Tohle už neřešíme v klidu. Tohle se řeší silou!",
    "Všechno bereme! Co se nevejde, rozbijem!",
    "Hýbneš se blbě a jdeš k zemi, jasný?!",
    "Tvoje hra skončila. Teď už jen počítáš ztráty!",
    "Nikdo neuteče! Zavřít to tady celý!",
    "Vytáhněte je ven! Každýho jednoho!",
    "Tady už se neptáme. Tady se bere!",
    "Podívej se kolem tohle je konec tvýho malýho království!",
    "Měl jsi odejít včas. Teď už tě jen roznesem na kusy!"
  ]),
  6: Object.freeze([
    "Hotovo. Tady už nic není.",
    "Vyčištěno do posledního šroubu. Můžeš začít znova jestli na to máš.",
    "Tohle místo skončilo. A ty s ním.",
    "Žádný lidi, žádný prachy, žádná moc. Jen prázdno.",
    "Tvoje impérium? Teď je to jen hromada sraček.",
    "Zbylo ti hovno. A to je ještě víc, než sis zasloužil.",
    "Ticho. Přesně takhle to tu má vypadat.",
    "Konec hry. Resetni se a zkus to znova líp.",
    "Tohle město si tě vyplivlo. A ani si toho nevšimlo.",
    "Zapomeň na to, co tu bylo. Už to neexistuje."
  ])
});
const POLICE_ACTION_SPECIALTY_QUOTES = Object.freeze({
  financial: Object.freeze([
    "Kde máš prachy? Protože já je teď beru.",
    "Účty zamražený. Cash zabavenej. Gratuluju.",
    "Tvoje peníze právě změnily majitele.",
    "Hraješ si na krále? Bez peněz jsi jen další nula.",
    "Všechno spočítaný, všechno zabavený. Nic ti nezbyde.",
    "Každej špinavej cent jde pryč. Do posledního.",
    "Můžeš si to vydělat znova. My ti to zase vezmem.",
    "Vidím, že jsi vydělával dobře. Škoda, že to nebylo tvoje.",
    "Tvoje impérium stojí na prachách. A ty právě zmizely.",
    "Hotovost, účty, zásoby všechno jde s náma."
  ]),
  drug: Object.freeze([
    "Cítím to už od dveří. A teď to všechno mizí.",
    "Vařil jsi velký věci. Teď to skončilo.",
    "Všechno bereme. Co nevezmem, zničíme.",
    "Tvoje výroba? Už jen odpad.",
    "Každej gram jde pryč. Do posledního.",
    "Tenhle bordel tu končí. Hned.",
    "Dneska nic neprodáš. Nemáš co.",
    "Zkoušel jsi jet ve velkým. Teď jdeš dolů.",
    "Tvoje laby už nejedou. Už nikdy.",
    "Tohle město ti tenhle byznys nenechá."
  ]),
  weapons: Object.freeze([
    "Kolik toho tu máš? Nevadí, všechno jde pryč.",
    "Bez zbraní nejsi nic. A přesně tam tě vracíme.",
    "Všechno zabavit. Nechci tu vidět ani nábojnici.",
    "Tvoje armáda právě přišla o zuby.",
    "Konec hraní na vojáky. Tohle není tvoje válka.",
    "Tyhle hračky ti nepatří. Už vůbec ne.",
    "Seberte to. Každou zbraň, každej kus.",
    "Teď jsi neozbrojenej. A dost zranitelnej.",
    "Zbraně pryč. Teď jsi jen cíl.",
    "Zkus to teď bez nich. Hodně štěstí."
  ]),
  arrests: Object.freeze([
    "Berem všechny. Jednoho po druhým.",
    "Tvoje lidi? Už nejsou tvoji.",
    "Do aut s nima. Všichni.",
    "Kdo tu zůstane, ten má sakra štěstí.",
    "Rozpadne se ti to pod rukama. Sleduj.",
    "Bez lidí nejsi nic. A přesně to teď jsi.",
    "Každýho naložit. Nechci tu nikoho vidět.",
    "Tvůj gang se právě rozpadl.",
    "Konec party. Jedete s náma.",
    "Zbyde ti pár krys jestli vůbec."
  ]),
  total: Object.freeze([
    "Probíhá razie. Drž hlavu dole a počítej ztráty.",
    "Razie je v běhu. Teď už jen sleduješ, co všechno zmizí.",
    "Policie je uvnitř. Tohle nebude levný.",
    "Běží celková razie. Všechno je teď pod tlakem.",
    "Razie právě začala. Nic kolem tebe není v bezpečí."
  ])
});
const POLICE_DISTRICT_CLICK_WARNING_QUOTES = Object.freeze([
  "Tady teď ne. Policie to tu právě rozjebává.",
  "Zapomeň na to. District je plnej policajtů."
]);
const SPY_SUCCESS_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Špehování hotovo. Tvůj špeh je zpátky - prázdno jak v hrobě.",
  "Zpátky bez škrábnutí. Nikdo tam není, můžeš to sebrat.",
  "Špeh se vrátil. District úplně v píči prázdnej.",
  "Hotovo. Nula lidí, nula odporu. Free teritorium.",
  "Tvůj špeh žije a hlásí - nikdo to nedrží.",
  "Čistý průchod. District leží ladem, vezmi si ho.",
  "Špehování OK. Prázdno. Tohle je zadarmo, kurva.",
  "Zpátky v bezpečí. Nikdo tam není, jen čeká na tebe.",
  "Potvrzeno - prázdnej district. Stačí přijít a je tvůj.",
  "Špeh to projel a vrátil se. Nic tam není, žádný sračky."
]);
const SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh zpátky. Máš je přečtený do poslední sračky.",
  "Hotovo. Všechno víš - lidi, zbraně, slabiny. Jsou odkrytí.",
  "Špeh se vrátil. Vidíš jim do všeho. Jsou v píči.",
  "Plný info. Každej kout, každej detail. Nemají šanci.",
  "Špehování čistý. Máš kompletní obraz - teď je roztrhej.",
  "Špeh zpátky. Obrana má díry jak kráva. Využij to.",
  "Všechno odkrytý. Víš přesně, kde je zlomit.",
  "Špeh donesl všechno. Jsou nahý jak svině.",
  "Hotovo. Máš jejich slabiny na talíři.",
  "Špeh žije a ví všechno. Teď jsi o krok před nima ve všem."
]);
const SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Špeh zpátky. Vypadá to prázdně ale něco tam smrdí.",
  "Nula lidí, ale nebylo to čistý. Špeh se stáhnul včas.",
  "District prázdnej, ale špeh měl namále. Něco tam nesedí.",
  "Špeh to projel napůl. Prázdno ale divnej pocit z toho místa.",
  "Nikdo tam není, ale nebylo to safe. Špeh radši zdrhnul.",
  "Prázdnej district, ale něco se tam hnulo. Špeh se stáhnul.",
  "Vypadá to čistě, ale špeh si není jistej. Něco tam nesedí.",
  "Špeh zpátky. Prázdno ale až moc tichý na tohle město.",
  "Nikdo tam není, ale špeh skoro narazil. Bacha na to.",
  "District bez lidí, ale nebyl to clean run. Něco tam může být."
]);
const SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh něco vytáhl, ale zdaleka ne všechno. Můžeš je sundat nebo to totálně posrat.",
  "Nejsou úplně odkrytý. Něco tušíš, ale zbytek je pořádná mlha.",
  "Špeh je zpátky. Máš půlku pravdy a ta druhá půlka ti může pěkně zlomit vaz.",
  "Máš jen částečný info. Stačí to na pořádný risk, ale na jistotu to rozhodně není.",
  "Vidíš jim do karet jen napůl. Ten zbytek tě může pěkně kousnout do zadku."
]);
const SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Prázdno jak svině a stejně jsi o špeha přišel. To je solidní průser.",
  "Nikdo tam není, ale špeh je v prdeli. Něco tam nehraje.",
  "Free teritorium? Možná. Špeh už to neřekne.",
  "Špeh se nevrátil. Prázdno, ale kurevsky divný.",
  "District prázdnej a špeh v hajzlu. Gratuluju."
]);
const SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh v prdeli. Chytli ho. Teď už vědí i o tobě.",
  "Průser. Špeha mají. A už vědí, kdo jim leze po rajónu.",
  "Zatkli ho. Nemáš žádný info - a oni mají tebe.",
  "Špeh v hajzlu. Chytli ho a teď je máš na krku.",
  "Chytli ho při práci. Teď už jen čekej, až si dojdou pro tebe.",
  "Špeh padl. A tvoje jméno už mezi nima koluje.",
  "Zajali ho. Nejenže nic nevíš, oni teď vědí o tobě až moc.",
  "Totální průser. Špeha mají a celý district je ve střehu.",
  "Špeh to totálně posral a teď je v jejich rukách. Gratuluju, jsi na řadě ty.",
  "Nemáš info. Oni mají tvýho člověka. Docela blbá rovnice, co?"
]);
const SPY_DETECTION_WARNING_QUOTES = Object.freeze([
  "Chytili jsme jim špeha. Teď víš, kdo se ti hrabe v rajónu.",
  "Někdo tě zkoušel projet - nevyšlo mu to. Máš ho.",
  "Špeh chycený. Teď je na tobě, co s ním uděláš.",
  "Zachytili jsme krysu. A ví, pro koho makala.",
  "Někdo si na tebe dovolil. Teď máš jeho člověka v rukách.",
  "Špeh je u tebe. Oni chtěli info - teď jsi ho dostal ty.",
  "Zkusili tě projet potichu. Teď držíš jejich špinavou práci.",
  "Chytil jsi ho při činu. Teď víš, kdo po tobě jde.",
  "Nepřítel udělal chybu. A ty ji právě držíš v rukách.",
  "Špeh odhalen a zajat. Teď máš výhodu ty."
]);
const SPY_ALLIANCE_DETECTION_WARNING_QUOTES = Object.freeze([
  "[ALLY] chytil nepřátelskýho špeha. Někdo si na nás dovolil.",
  "U [ALLY] odhalen špeh. Aliance je ve střehu.",
  "Zachycena krysa u [ALLY]. Víme, kdo po nás jde.",
  "[ALLY] má jejich špeha. Někdo nás zkoušel projet potichu.",
  "Špeh odhalen u [ALLY]. Držte se, někdo nás sleduje.",
  "[ALLY] zachytil infiltrace. Máme stopu na nepřítele.",
  "Nepřítel udělal chybu u [ALLY]. Teď máme výhodu.",
  "U [ALLY] chycen špeh. Aliance má oči otevřený.",
  "[ALLY] drží jejich člověka. Někdo se hrabe v našem rajónu.",
  "Špeh skončil u [ALLY]. Teď víme, odkud fouká vítr."
]);
const POLICE_TIER_IMPACT_PROFILE = Object.freeze({
  1: Object.freeze({ cleanPct: 0, dirtyPct: 0, drugPct: 0, weaponPct: 0, materialPct: 0, influencePct: 0, membersPct: 0 }),
  2: Object.freeze({ cleanPct: 2, dirtyPct: 8, drugPct: 0, weaponPct: 0, materialPct: 0, influencePct: 4, membersPct: 3 }),
  3: Object.freeze({ cleanPct: 4, dirtyPct: 12, drugPct: 6, weaponPct: 3, materialPct: 0, influencePct: 6, membersPct: 5 }),
  4: Object.freeze({ cleanPct: 8, dirtyPct: 18, drugPct: 10, weaponPct: 8, materialPct: 8, influencePct: 8, membersPct: 8 }),
  5: Object.freeze({ cleanPct: 12, dirtyPct: 24, drugPct: 15, weaponPct: 12, materialPct: 16, influencePct: 12, membersPct: 12 }),
  6: Object.freeze({ cleanPct: 25, dirtyPct: 40, drugPct: 20, weaponPct: 18, materialPct: 24, influencePct: 18, membersPct: 18 })
});
const POLICE_SPECIALTY_IMPACT_MULTIPLIER = Object.freeze({
  total: Object.freeze({ clean: 1, dirty: 1, drugs: 1, weapons: 1, materials: 1, influence: 1, members: 1 }),
  financial: Object.freeze({ clean: 1.35, dirty: 1.45, drugs: 0.55, weapons: 0.6, materials: 0.7, influence: 1.2, members: 0.7 }),
  drug: Object.freeze({ clean: 0.75, dirty: 1.05, drugs: 1.7, weapons: 0.7, materials: 1.2, influence: 0.9, members: 0.85 }),
  weapons: Object.freeze({ clean: 0.8, dirty: 0.95, drugs: 0.7, weapons: 1.7, materials: 1.45, influence: 0.95, members: 0.9 }),
  arrests: Object.freeze({ clean: 0.7, dirty: 0.8, drugs: 0.65, weapons: 0.8, materials: 0.75, influence: 1.1, members: 1.7 })
});
let topbarStatSwitchTimer = null;
let lastRenderedCleanMoney = null;
let lastRenderedDirtyMoney = null;
let lastRenderedInfluenceValue = null;
let lastRenderedTopbarMode = null;
let startPhaseResourceSimulationState = null;
const PREVIEW_SESSION_STORAGE_KEY = "empireStreets.session.v1";
const SETTINGS_STORAGE_KEY = "empire_settings";
const DEFAULT_SETTINGS = Object.freeze({
  language: "cs",
  mapDistrictBorders: true,
  mapAllianceSymbols: true,
  mapVisibilityMode: "all"
});

function normalizeMapVisibilityMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "all" || mode === "hide-enemies" || mode === "only-player") {
    return mode;
  }
  return DEFAULT_SETTINGS.mapVisibilityMode;
}

function getSettingsState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {})
    };

    return {
      ...merged,
      language: String(merged.language || DEFAULT_SETTINGS.language).trim().toLowerCase() === "en" ? "en" : "cs",
      mapDistrictBorders: Boolean(merged.mapDistrictBorders),
      mapAllianceSymbols: Boolean(merged.mapAllianceSymbols),
      mapVisibilityMode: normalizeMapVisibilityMode(merged.mapVisibilityMode)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function applySettingsState(settings) {
  const normalized = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    language: String(settings?.language || DEFAULT_SETTINGS.language).trim().toLowerCase() === "en" ? "en" : "cs",
    mapDistrictBorders: Boolean(settings?.mapDistrictBorders),
    mapAllianceSymbols: Boolean(settings?.mapAllianceSymbols),
    mapVisibilityMode: normalizeMapVisibilityMode(settings?.mapVisibilityMode)
  };

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  document.documentElement.lang = normalized.language;
  document.documentElement.dataset.language = normalized.language;
  document.documentElement.dataset.mapVisibilityMode = normalized.mapVisibilityMode;
  document.dispatchEvent(new CustomEvent("empire:settings-changed", {
    detail: { settings: normalized }
  }));

  return normalized;
}

function getStoredRegistration() {
  return getAuthoritySession().registration ?? null;
}

function setStoredRegistration(payload) {
  updateStoredPreviewSession((session) => ({ ...session, registration: payload }));
}

function getRegistrationAccentColor(factionId) {
  const palette = {
    mafian: "#67e1ff",
    kartel: "#ff9a3d",
    kult: "#71ffbc",
    "tajna-organizace": "#ff47c2",
    hackeri: "#a5ff59",
    "motorkarsky-gang": "#8a7dff",
    "soukroma-armada": "#ff6b6b",
    korporace: "#ffd166"
  };

  return palette[String(factionId || "").trim().toLowerCase()] || "#67e1ff";
}

function normalizeRuntimeHexColor(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

function hexToRgbParts(hexColor) {
  const sanitized = String(hexColor || "").trim().replace("#", "");
  const normalized = sanitized.length === 3
    ? sanitized.split("").map((part) => part + part).join("")
    : sanitized.padEnd(6, "0").slice(0, 6);
  const numeric = Number.parseInt(normalized, 16);

  if (!Number.isFinite(numeric)) {
    return [103, 225, 255];
  }

  return [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255
  ];
}

function applyHexAlpha(hexColor, alphaHex = "ff") {
  const normalizedColor = normalizeRuntimeHexColor(hexColor);
  const normalizedAlpha = String(alphaHex || "ff").trim().toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(2, "f").slice(0, 2);
  return normalizedColor ? `${normalizedColor}${normalizedAlpha}` : `#67e1ff${normalizedAlpha}`;
}

function getCurrentPlayerGangColor() {
  const registration = getStoredRegistration();
  return normalizeRuntimeHexColor(registration?.gangColor) || getRegistrationAccentColor(registration?.factionId || "mafian");
}

let launchPlayerColorMap = null;
let launchPlayerColorMapCurrentColor = null;

function createLaunchPlayerColorMap(currentPlayerColor) {
  const usedColors = new Set();
  const colorMap = new Map();

  colorMap.set(CURRENT_PLAYER_ID, currentPlayerColor);
  usedColors.add(currentPlayerColor);

  for (let ownerId = 1; ownerId <= START_PHASE_PLAYER_COLORS.length; ownerId += 1) {
    if (ownerId === CURRENT_PLAYER_ID) {
      continue;
    }

    const color = START_PHASE_PLAYER_COLORS.find((candidate) => !usedColors.has(candidate));

    if (!color) {
      throw new Error("No unique dev-only launch player colors are left.");
    }

    colorMap.set(ownerId, color);
    usedColors.add(color);
  }

  return colorMap;
}

function normalizeLaunchPlayerPaletteColor(color) {
  const normalizedColor = normalizeRuntimeHexColor(color);
  return START_PHASE_PLAYER_COLORS.includes(normalizedColor) ? normalizedColor : null;
}

function getCurrentPlayerFactionGlyph() {
  const registration = getStoredRegistration();
  const factionId = String(registration?.factionId || "mafian").trim().toLowerCase();
  const glyphByFactionId = {
    mafian: "♛",
    kartel: "✶",
    kult: "✦",
    "tajna-organizace": "◈",
    hackeri: "⌘",
    "motorkarsky-gang": "⚡",
    "soukroma-armada": "⛨",
    korporace: "⬢"
  };
  return glyphByFactionId[factionId] || "✦";
}

function getPlayerDistrictColor(ownerId) {
  const currentPlayerColor = normalizeLaunchPlayerPaletteColor(getCurrentPlayerGangColor()) || START_PHASE_PLAYER_COLORS[0];

  if (!launchPlayerColorMap || launchPlayerColorMapCurrentColor !== currentPlayerColor) {
    launchPlayerColorMap = createLaunchPlayerColorMap(currentPlayerColor);
    launchPlayerColorMapCurrentColor = currentPlayerColor;
  }

  const color = launchPlayerColorMap.get(Number(ownerId));

  if (!color) {
    throw new Error(`No unique dev-only launch color is assigned for player ${ownerId}.`);
  }

  return color;
}

function getStoredWeaponInventory() {
  return getAuthoritySession().inventory.weapons;
}

function setStoredWeaponInventory(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      weapons: { ...DEFAULT_WEAPON_INVENTORY, ...(payload || {}) }
    }
  }));
}

function getStoredMaterialInventory() {
  return getAuthoritySession().inventory.materials;
}

function setStoredMaterialInventory(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      materials: { ...DEFAULT_MATERIAL_INVENTORY, ...(payload || {}) }
    }
  }));
}

function getResolvedMaterialInventory() {
  const storedInventory = getStoredMaterialInventory();

  if (storedInventory) {
    return {
      ...DEFAULT_MATERIAL_INVENTORY,
      ...storedInventory
    };
  }

  setStoredMaterialInventory(DEFAULT_MATERIAL_INVENTORY);
  return { ...DEFAULT_MATERIAL_INVENTORY };
}

const FACTORY_SUPPLY_MATERIAL_KEY_MAP = Object.freeze({
  "metal-parts": "metalParts",
  "tech-core": "techCore"
});

function getFactorySupplyKeyForMaterial(itemId) {
  return FACTORY_SUPPLY_MATERIAL_KEY_MAP[itemId] || null;
}

function getStoredDrugInventory() {
  return getAuthoritySession().inventory.drugs;
}

function setStoredDrugInventory(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      drugs: { ...DEFAULT_DRUG_INVENTORY, ...(payload || {}) }
    }
  }));
}

function getResolvedDrugInventory() {
  const storedInventory = getStoredDrugInventory();

  if (storedInventory) {
    return {
      ...DEFAULT_DRUG_INVENTORY,
      ...storedInventory
    };
  }

  setStoredDrugInventory(DEFAULT_DRUG_INVENTORY);
  return { ...DEFAULT_DRUG_INVENTORY };
}

function getStoredProductionState() {
  return getAuthoritySession().production.jobs;
}

function setStoredProductionState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      jobs: payload && typeof payload === "object" ? payload : {}
    }
  }));
}

function getResolvedProductionState() {
  const storedState = getStoredProductionState();
  return storedState && typeof storedState === "object" ? storedState : {};
}

function getStoredEconomyState() {
  return getAuthoritySession().economy;
}

function setStoredEconomyState(payload) {
  updateStoredPreviewSession((session) => ({ ...session, economy: payload || session.economy }));
  document.dispatchEvent(new CustomEvent("empire:economy-state-changed"));
}

function getResolvedEconomyState() {
  const storedState = getStoredEconomyState();

  if (storedState && Number.isFinite(storedState.cleanMoney) && Number.isFinite(storedState.dirtyMoney)) {
    return {
      cleanMoney: storedState.cleanMoney,
      dirtyMoney: storedState.dirtyMoney
    };
  }

  const registration = getStoredRegistration();
  const faction = registration?.factionId && FACTION_CATALOG[registration.factionId]
    ? FACTION_CATALOG[registration.factionId]
    : FACTION_CATALOG.mafian;
  const nextState = {
    cleanMoney: faction.startingPackage.cleanMoney,
    dirtyMoney: faction.startingPackage.dirtyMoney
  };
  setStoredEconomyState(nextState);
  return nextState;
}

function getStoredMarketPriceState() {
  return getAuthoritySession().market;
}

function setStoredMarketPriceState(payload) {
  updateStoredPreviewSession((session) => ({ ...session, market: payload || session.market }));
}

function createDefaultMarketPriceState() {
  const items = {};

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      items[getMarketPriceKey(tabId, item.itemId)] = {
        price: item.price,
        previousPrice: item.price
      };
    }
  }

  return {
    nextRefreshAt: new Date(Date.now() + MARKET_PRICE_REFRESH_MS).toISOString(),
    items
  };
}

function getResolvedMarketPriceState() {
  const storedState = getStoredMarketPriceState();

  if (storedState?.items && storedState.nextRefreshAt) {
    return storedState;
  }

  const nextState = createDefaultMarketPriceState();
  setStoredMarketPriceState(nextState);
  return nextState;
}

function getPriceVarianceForTab(tabId) {
  return tabId === "black-market" ? 0.18 : 0.1;
}

function computeNextDynamicPrice(basePrice, currentPrice, variance) {
  const directionFactor = 1 + ((Math.random() * 2) - 1) * variance;
  const nextPrice = Math.round(currentPrice * directionFactor);
  const minPrice = Math.round(basePrice * 0.55);
  const maxPrice = Math.round(basePrice * 1.75);
  return clamp(nextPrice, minPrice, maxPrice);
}

function refreshMarketPricesIfNeeded(force = false) {
  const state = getResolvedMarketPriceState();
  const nextRefreshAt = new Date(state.nextRefreshAt).getTime();

  if (!force && nextRefreshAt > Date.now()) {
    return state;
  }

  const nextItems = { ...state.items };

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      const priceKey = getMarketPriceKey(tabId, item.itemId);
      const currentPrice = nextItems[priceKey]?.price ?? item.price;
      nextItems[priceKey] = {
        previousPrice: currentPrice,
        price: computeNextDynamicPrice(item.price, currentPrice, getPriceVarianceForTab(tabId))
      };
    }
  }

  const nextState = {
    nextRefreshAt: new Date(Date.now() + MARKET_PRICE_REFRESH_MS).toISOString(),
    items: nextItems
  };

  setStoredMarketPriceState(nextState);
  return nextState;
}

function getMarketPriceEntry(tabId, itemId) {
  const state = refreshMarketPricesIfNeeded(false);
  return state.items[getMarketPriceKey(tabId, itemId)] || null;
}

function getMarketRefreshCountdownSeconds() {
  const state = getResolvedMarketPriceState();
  const ms = new Date(state.nextRefreshAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

function parseMoneyValueFromElement(element) {
  if (!element) {
    return 0;
  }

  const raw = String(element.textContent || "").replace(/[^\d-]/g, "");
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}

function stopMoneyStatCounter(element) {
  if (!element) {
    return;
  }

  const activeInterval = moneyStatCountIntervals.get(element);
  if (activeInterval) {
    window.clearInterval(activeInterval);
    moneyStatCountIntervals.delete(element);
  }
}

function animateMoneyStatValue(element, delta) {
  if (!element || !delta) {
    return;
  }

  const nextClass = delta > 0 ? "is-money-up" : "is-money-down";
  element.classList.remove("is-money-up", "is-money-down");
  void element.offsetWidth;
  element.classList.add(nextClass);

  const activeTimer = moneyStatAnimationTimers.get(element);
  if (activeTimer) {
    window.clearTimeout(activeTimer);
  }

  const timerId = window.setTimeout(() => {
    element.classList.remove("is-money-up", "is-money-down");
    moneyStatAnimationTimers.delete(element);
  }, 1050);
  moneyStatAnimationTimers.set(element, timerId);
}

function animateMoneyStatCounter(element, targetValue, options = {}) {
  if (!element) {
    return;
  }

  const safeTarget = Math.max(0, Math.floor(Number(targetValue) || 0));
  const prefix = String(options?.prefix ?? "$");
  const suffix = String(options?.suffix ?? "");
  stopMoneyStatCounter(element);

  let current = parseMoneyValueFromElement(element);
  if (current === safeTarget) {
    element.textContent = `${prefix}${safeTarget}${suffix}`;
    return;
  }

  const direction = safeTarget > current ? 1 : -1;
  const intervalId = window.setInterval(() => {
    current += direction;
    element.textContent = `${prefix}${current}${suffix}`;

    if (current === safeTarget) {
      window.clearInterval(intervalId);
      moneyStatCountIntervals.delete(element);
    }
  }, MONEY_STAT_COUNT_TICK_MS);

  moneyStatCountIntervals.set(element, intervalId);
}

function syncMoneyStatToCachedValue(element, value, options = {}) {
  if (!element) {
    return;
  }

  stopMoneyStatCounter(element);
  const activeTimer = moneyStatAnimationTimers.get(element);
  if (activeTimer) {
    window.clearTimeout(activeTimer);
    moneyStatAnimationTimers.delete(element);
  }

  element.classList.remove("is-money-up", "is-money-down");
  const safeValue = Math.max(0, Math.floor(Number(value) || 0));
  const prefix = String(options?.prefix ?? "$");
  const suffix = String(options?.suffix ?? "");
  element.textContent = `${prefix}${safeValue}${suffix}`;
}

function applyTopbarEconomy(root, { instant = false } = {}) {
  const scope = root.ownerDocument || document;
  const topbarCleanMoney = scope.querySelector(TOPBAR_CLEAN_MONEY_SELECTOR);
  const topbarDirtyMoney = scope.querySelector(TOPBAR_DIRTY_MONEY_SELECTOR);
  const displaySnapshot = getDisplayedResourceSnapshot();
  const isDistrictResourceMode = displaySnapshot.sourceMode === "district";
  const economy = {
    cleanMoney: displaySnapshot.cleanMoney,
    dirtyMoney: displaySnapshot.dirtyMoney
  };
  const cleanMoneyPill = topbarCleanMoney?.closest(".resource-pill") || null;
  const dirtyMoneyPill = topbarDirtyMoney?.closest(".resource-pill") || null;

  if (cleanMoneyPill) {
    cleanMoneyPill.title = isDistrictResourceMode
      ? `DEV-ONLY: čisté peníze běží +${formatDistrictMoneyAmount(displaySnapshot.cleanMoneyPerMinute)}/min z ${displaySnapshot.districtCount} distriktů.`
      : "Aktuální stav čistých peněz.";
  }

  if (dirtyMoneyPill) {
    dirtyMoneyPill.title = isDistrictResourceMode
      ? (displaySnapshot.dirtyMoneyPerMinute > 0
          ? `DEV-ONLY: špinavé peníze běží +${formatDistrictMoneyAmount(displaySnapshot.dirtyMoneyPerMinute)}/min z ${displaySnapshot.districtCount} distriktů.`
          : "DEV-ONLY: distrikty právě nepřidávají špinavé peníze.")
      : "Aktuální stav špinavých peněz.";
  }

  if (topbarCleanMoney) {
    if (instant || lastRenderedCleanMoney === null) {
      syncMoneyStatToCachedValue(topbarCleanMoney, economy.cleanMoney);
    } else {
      animateMoneyStatCounter(topbarCleanMoney, economy.cleanMoney);
    }
  }

  if (topbarDirtyMoney) {
    if (instant || lastRenderedDirtyMoney === null) {
      syncMoneyStatToCachedValue(topbarDirtyMoney, economy.dirtyMoney);
    } else {
      animateMoneyStatCounter(topbarDirtyMoney, economy.dirtyMoney);
    }
  }

  if (!instant && topbarCleanMoney && lastRenderedCleanMoney !== null && economy.cleanMoney !== lastRenderedCleanMoney) {
    animateMoneyStatValue(topbarCleanMoney, economy.cleanMoney - lastRenderedCleanMoney);
  }

  if (!instant && topbarDirtyMoney && lastRenderedDirtyMoney !== null && economy.dirtyMoney !== lastRenderedDirtyMoney) {
    animateMoneyStatValue(topbarDirtyMoney, economy.dirtyMoney - lastRenderedDirtyMoney);
  }

  lastRenderedCleanMoney = economy.cleanMoney;
  lastRenderedDirtyMoney = economy.dirtyMoney;
}

function getStoredGangState() {
  return getAuthoritySession().gang;
}

function getStoredWorldState() {
  return getAuthoritySession().world || {
    ownedDistrictIds: [],
    phaseState: {
      mapPhase: "night",
      gamePhase: "live",
      cityMinutes: 22 * 60 + 14
    },
    destroyedDistrictIds: [],
    districtDefenseById: {},
    districtDefenseLoadoutById: {},
    districtDefenseResidentsById: {},
    districtTrapById: {},
    districtGossipById: {},
    districtPoliceActionById: {},
    devOnlyScenarioDestroyedDistrictId: null
  };
}

function setStoredWorldState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    world: payload || session.world
  }));
  document.dispatchEvent(new CustomEvent("empire:world-state-changed"));
}

function getResolvedWorldState() {
  const world = getStoredWorldState();
  return {
    ownedDistrictIds: Array.isArray(world.ownedDistrictIds) ? world.ownedDistrictIds.map(Number).filter(Boolean) : [],
    phaseState: world.phaseState && typeof world.phaseState === "object"
      ? {
          mapPhase: world.phaseState.mapPhase === "day" ? "day" : "night",
          gamePhase: world.phaseState.gamePhase === "launch" ? "launch" : "live",
          cityMinutes: Number.parseInt(String(world.phaseState.cityMinutes ?? (22 * 60 + 14)), 10) || (22 * 60 + 14)
        }
      : {
          mapPhase: "night",
          gamePhase: "live",
          cityMinutes: 22 * 60 + 14
        },
    destroyedDistrictIds: Array.isArray(world.destroyedDistrictIds) ? world.destroyedDistrictIds.map(Number).filter(Boolean) : [],
    districtDefenseById: world.districtDefenseById && typeof world.districtDefenseById === "object" ? world.districtDefenseById : {},
    districtDefenseLoadoutById: world.districtDefenseLoadoutById && typeof world.districtDefenseLoadoutById === "object"
      ? world.districtDefenseLoadoutById
      : {},
    districtDefenseResidentsById: world.districtDefenseResidentsById && typeof world.districtDefenseResidentsById === "object"
      ? world.districtDefenseResidentsById
      : {},
    districtTrapById: world.districtTrapById && typeof world.districtTrapById === "object"
      ? world.districtTrapById
      : {},
    districtGossipById: world.districtGossipById && typeof world.districtGossipById === "object"
      ? world.districtGossipById
      : {},
    districtPoliceActionById: world.districtPoliceActionById && typeof world.districtPoliceActionById === "object"
      ? world.districtPoliceActionById
      : {},
    devOnlyScenarioDestroyedDistrictId: Number(world.devOnlyScenarioDestroyedDistrictId || 0) || null
  };
}

function normalizePoliceActionMarker(districtId, marker) {
  if (!districtId || !marker || typeof marker !== "object") {
    return null;
  }

  const startedAt = Number(marker.startedAt || new Date().getTime()) || Date.now();
  const expiresAt = Number(marker.expiresAt || (startedAt + GANG_HEAT_POLICE_DURATION_MS)) || (startedAt + GANG_HEAT_POLICE_DURATION_MS);
  if (expiresAt <= Date.now()) {
    return null;
  }

  const operationType = resolvePoliceOperationType(marker.operationType)?.key
    || resolveRandomPoliceOperationType(resolveGangHeatTier(getResolvedGangState().heat).id, marker.source)
    || "warning_notice";
  const specialtyMeta = resolvePoliceSpecialty(marker.raidSpecialtyKey || resolvePoliceOperationType(operationType)?.specialtyKey);

  return {
    districtId: Number(districtId),
    source: String(marker.source || "police-action").trim() || "police-action",
    operationType,
    raidSpecialtyKey: specialtyMeta.key,
    startedAt,
    expiresAt,
    seed: Number(marker.seed || districtId) || Number(districtId) || 1
  };
}

function getResolvedDistrictPoliceActions() {
  const worldState = getResolvedWorldState();
  const entries = Object.entries(worldState.districtPoliceActionById || {});
  if (entries.length === 0) {
    return {};
  }

  const nextActions = {};
  let removedExpiredAction = false;

  for (const [districtId, marker] of entries) {
    const normalized = normalizePoliceActionMarker(districtId, marker);
    if (!normalized) {
      removedExpiredAction = true;
      continue;
    }

    nextActions[String(normalized.districtId)] = normalized;
  }

  if (removedExpiredAction || Object.keys(nextActions).length !== entries.length) {
    updateStoredPreviewSession((session) => ({
      ...session,
      gang: {
        ...(session.gang || {}),
        policeRaidProtectionUntil: removedExpiredAction
          ? Math.max(
              Number(session?.gang?.policeRaidProtectionUntil || 0) || 0,
              Date.now() + GANG_HEAT_RAID_PROTECTION_MS
            )
          : Number(session?.gang?.policeRaidProtectionUntil || 0) || 0
      },
      world: {
        ...(session.world || {}),
        districtPoliceActionById: nextActions
      }
    }));
    document.dispatchEvent(new CustomEvent("empire:police-state-changed"));
  }

  return nextActions;
}

function getDistrictPoliceAction(districtId) {
  const normalizedDistrictId = Number(districtId);
  if (!normalizedDistrictId) {
    return null;
  }

  return getResolvedDistrictPoliceActions()[String(normalizedDistrictId)] || null;
}

function markDistrictPoliceAction(districtId, options = {}) {
  const normalizedDistrictId = Number(districtId);
  if (!normalizedDistrictId) {
    return { ok: false, reason: "invalid_district" };
  }

  const worldState = getResolvedWorldState();
  const ownedDistrictIds = Array.isArray(worldState.ownedDistrictIds) ? worldState.ownedDistrictIds : [];
  if (!ownedDistrictIds.includes(normalizedDistrictId) && options.ignoreOwnership !== true) {
    return { ok: false, reason: "district_not_owned" };
  }

  const gangState = getResolvedGangState();
  if (gangState.policeRaidProtectionUntil > Date.now() && options.ignoreProtection !== true) {
    return { ok: false, reason: "raid_protection_active" };
  }

  const tier = resolveGangHeatTier(gangState.heat);
  const operationKey = resolvePoliceOperationType(options.operationType)?.key
    || resolveRandomPoliceOperationType(tier.id, options.source)
    || "warning_notice";
  const operationMeta = resolvePoliceOperationType(operationKey) || POLICE_OPERATION_TYPES.warning_notice;
  const specialtyKey = resolvePoliceSpecialty(options.raidSpecialtyKey || operationMeta.specialtyKey || resolveRandomPoliceSpecialtyKey()).key;
  const now = Date.now();
  const durationMs = Math.max(60_000, Number(options.durationMs || operationMeta.durationMs || GANG_HEAT_POLICE_DURATION_MS) || GANG_HEAT_POLICE_DURATION_MS);
  const impact = options.skipImpact === true
    ? { rows: [] }
    : applyPoliceActionImpact({
        districtId: normalizedDistrictId,
        operationType: operationKey,
        raidSpecialtyKey: specialtyKey
      }, tier);
  const nextMarker = {
    districtId: normalizedDistrictId,
    source: String(options.source || "police-action").trim() || "police-action",
    operationType: operationKey,
    raidSpecialtyKey: specialtyKey,
    startedAt: now,
    expiresAt: now + durationMs,
    seed: Number(options.seed || normalizedDistrictId) || normalizedDistrictId,
    impact
  };

  if (impact.rows?.length) {
    appendGangHeatJournalEntry("rise", 0, `Police zasáhla District ${normalizedDistrictId}. ${operationMeta.label}.`);
  }

  setStoredWorldState({
    ...worldState,
    districtPoliceActionById: {
      ...(worldState.districtPoliceActionById || {}),
      [normalizedDistrictId]: nextMarker
    }
  });
  document.dispatchEvent(new CustomEvent("empire:police-state-changed", {
    detail: {
      districtId: normalizedDistrictId,
      marker: nextMarker
    }
  }));

  return { ok: true, marker: nextMarker };
}

function syncDevOnlyDestroyedDistrictState() {
  const phaseState = getResolvedPhaseState();
  const storedWorldState = getStoredWorldState();
  const destroyedDistrictIds = Array.isArray(storedWorldState.destroyedDistrictIds)
    ? storedWorldState.destroyedDistrictIds.map(Number).filter(Boolean)
    : [];
  const ownedDistrictIds = Array.isArray(storedWorldState.ownedDistrictIds)
    ? storedWorldState.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
  const isLaunchPhase = (phaseState.gamePhase || "live") === "launch";
  const isApplied = storedWorldState.devOnlyScenarioDestroyedDistrictId === DEV_ONLY_DESTROYED_DISTRICT_ID;
  const hasDestroyedDistrict = destroyedDistrictIds.includes(DEV_ONLY_DESTROYED_DISTRICT_ID);

  if (isLaunchPhase) {
    if (isApplied && hasDestroyedDistrict && !ownedDistrictIds.includes(DEV_ONLY_DESTROYED_DISTRICT_ID)) {
      return;
    }

    setStoredWorldState({
      ...storedWorldState,
      ownedDistrictIds: ownedDistrictIds.filter((districtId) => districtId !== DEV_ONLY_DESTROYED_DISTRICT_ID),
      destroyedDistrictIds: Array.from(new Set([...destroyedDistrictIds, DEV_ONLY_DESTROYED_DISTRICT_ID])),
      devOnlyScenarioDestroyedDistrictId: DEV_ONLY_DESTROYED_DISTRICT_ID
    });
    return;
  }

  if (!isApplied) {
    return;
  }

  setStoredWorldState({
    ...storedWorldState,
    destroyedDistrictIds: destroyedDistrictIds.filter((districtId) => districtId !== DEV_ONLY_DESTROYED_DISTRICT_ID),
    devOnlyScenarioDestroyedDistrictId: null
  });
}

function syncDevOnlyPolicePressure() {
  const phaseState = getResolvedPhaseState();
  const now = Date.now();

  if ((phaseState.gamePhase || "live") !== "launch") {
    devOnlyPoliceNextActionAt = 0;
    devOnlyPoliceLastTargetPlayerId = null;
    return { triggered: false, marker: null };
  }

  if (!devOnlyPoliceNextActionAt) {
    devOnlyPoliceNextActionAt = now + DEV_ONLY_POLICE_INTERVAL_MS;
    return { triggered: false, marker: null };
  }

  if (devOnlyPoliceNextActionAt > now) {
    return { triggered: false, marker: null };
  }

  const worldState = getResolvedWorldState();
  const destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
  const activePoliceActions = getResolvedDistrictPoliceActions();
  const activePoliceEntries = Object.entries(activePoliceActions)
    .map(([districtId, marker]) => [Number(districtId), marker])
    .filter(([districtId, marker]) => Boolean(districtId && marker));
  if (activePoliceEntries.length > 1) {
    const [keptDistrictId, keptMarker] = activePoliceEntries
      .slice()
      .sort((left, right) => Number(right[1]?.startedAt || 0) - Number(left[1]?.startedAt || 0))[0];
    setStoredWorldState({
      ...worldState,
      districtPoliceActionById: {
        [keptDistrictId]: keptMarker
      }
    });
    return { triggered: false, marker: keptMarker || null };
  }

  const activePoliceDistrictIds = new Set(activePoliceEntries.map(([districtId]) => districtId));
  if (activePoliceDistrictIds.size > 0) {
    return { triggered: false, marker: activePoliceEntries[0]?.[1] || null };
  }

  const launchDistrictEntries = Array.from(START_PHASE_OWNER_BY_DISTRICT_ID.entries())
    .map(([districtId, ownerId]) => ({ districtId: Number(districtId), ownerId: Number(ownerId) }))
    .filter(({ districtId, ownerId }) => districtId > 0 && ownerId > 0 && ownerId !== CURRENT_PLAYER_ID)
    .filter(({ districtId }) => !destroyedDistrictIds.has(districtId));

  if (launchDistrictEntries.length <= 0) {
    devOnlyPoliceNextActionAt = now + DEV_ONLY_POLICE_INTERVAL_MS;
    return { triggered: false, marker: null };
  }

  const preferredEntries = launchDistrictEntries.filter(({ ownerId }) => ownerId !== devOnlyPoliceLastTargetPlayerId);
  const candidateEntries = preferredEntries.length > 0 ? preferredEntries : launchDistrictEntries;
  const idleEntries = candidateEntries.filter(({ districtId }) => !activePoliceDistrictIds.has(districtId));
  const eligibleEntries = idleEntries.length > 0 ? idleEntries : candidateEntries;
  const selectedEntry = eligibleEntries[Math.floor(Math.random() * eligibleEntries.length)] || null;

  devOnlyPoliceNextActionAt = now + DEV_ONLY_POLICE_INTERVAL_MS;
  if (!selectedEntry) {
    return { triggered: false, marker: null };
  }

  const result = markDistrictPoliceAction(selectedEntry.districtId, {
    source: "dev-only-launch-pressure",
    ignoreOwnership: true,
    ignoreProtection: true,
    skipImpact: true
  });

  if (!result.ok) {
    return { triggered: false, marker: null };
  }

  devOnlyPoliceLastTargetPlayerId = selectedEntry.ownerId;
  return { triggered: true, marker: result.marker || null };
}

const DISTRICT_GOSSIP_SEED_LIBRARY = Object.freeze({
  resident: Object.freeze({
    rumors: Object.freeze([
      "Drb: Ve vnitrobloku se šeptá o nové posádce, která vybírá nájem ve dvě ráno.",
      "Drb: V činžácích se ztrácí hotovost a sousedi prý moc mluví.",
      "Drb: V zadních dvorech se večer střídají hlídky bez poznávacích znaků.",
      "Drb: Domovní vchody hlídají děti a posílají světelné signály přes ulici."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: Obytný sektor drží silná uliční síť a cizí pohyb se tu dlouho neschová.",
      "Potvrzený intel: V rezidenčním bloku funguje stabilní logistika lidí i peněz."
    ])
  }),
  industrial: Object.freeze({
    rumors: Object.freeze([
      "Drb: U ramp se po směně přesouvají bedny bez evidence.",
      "Drb: Z haly mizí kov a v noci tam hučí kompresory déle než mají.",
      "Drb: Dělníci mluví o skrytém skladu za servisním tunelem.",
      "Drb: V továrním pásu někdo vykupuje ochranné vybavení po celých paletách."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: Průmyslový sektor drží zásoby materiálu a rychlý přesun techniky.",
      "Potvrzený intel: V průmyslu bývá tvrdší obrana a lepší krytí pro těžkou výzbroj."
    ])
  }),
  economy: Object.freeze({
    rumors: Object.freeze([
      "Drb: V kancelářích se točí účetní knihy, které nikdo nechce vidět za denního světla.",
      "Drb: Směnárny v sektoru jedou přes zadní dveře a bez kamer.",
      "Drb: Kurýři nosí balíčky mezi barem, bankou a podzemní garáží.",
      "Drb: V obchodním bloku mizí zboží ještě dřív, než se objeví v inventuře."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: Ekonomický sektor je silný na cashflow, vliv a rychlé krytí transakcí.",
      "Potvrzený intel: V tomto sektoru se dobře schovávají výplaty i tiché nákupy."
    ])
  }),
  park: Object.freeze({
    rumors: Object.freeze([
      "Drb: V parku se po setmění schází kurýři bez telefonů a bez poznávacích znamení.",
      "Drb: Stromová linie skrývá tiché přesuny mezi dvěma sousedními districtama.",
      "Drb: Hlídky tu mizí v mlze a objevují se až u servisní brány.",
      "Drb: V parku se prý testují pasti dřív, než jdou do ostrého provozu."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: Parkový sektor dává dobré krytí pro přesuny a nenápadný dohled.",
      "Potvrzený intel: Přirozené stíny a členitost terénu tu nahrávají špehování i léčkám."
    ])
  }),
  downtown: Object.freeze({
    rumors: Object.freeze([
      "Drb: Downtown nikdy nespí a hlídky se tu mění po minutách.",
      "Drb: V neonových ulicích se prodává informace rychleji než zboží.",
      "Drb: Kluby v centru perou peníze přes VIP boxy a soukromé výtahy.",
      "Drb: Nad střechami centra se přesouvají kurýři přes servisní lávky."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: Downtown je hlučný, drahý a plný očí, ale zároveň skrývá nejvíc příležitostí.",
      "Potvrzený intel: Centrum přitahuje obchod, vliv i nejrychlejší eskalaci konfliktu."
    ])
  }),
  unknown: Object.freeze({
    rumors: Object.freeze([
      "Drb: V sektoru je cítit nervozita a někdo tam chystá změnu kontroly.",
      "Drb: Noční provoz v districtu je hustší než obvykle a lidé mizí do bočních ulic.",
      "Drb: V okolí se šíří řeči o překladišti, které se otevře jen na pár minut."
    ]),
    verified: Object.freeze([
      "Potvrzený intel: District drží vlastní rytmus a reaguje rychle na cizí zásah."
    ])
  })
});

function normalizeDistrictGossipKey(districtOrId) {
  const rawValue = typeof districtOrId === "object" && districtOrId
    ? (districtOrId.id ?? districtOrId.districtId ?? "")
    : districtOrId;

  return String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.:#]/g, "") || "unknown";
}

function resolveDistrictNumericId(districtOrId) {
  const rawValue = typeof districtOrId === "object" && districtOrId
    ? (districtOrId.id ?? districtOrId.districtId ?? 0)
    : districtOrId;

  return Number.parseInt(String(rawValue ?? 0).replace("district:", ""), 10) || 0;
}

function formatDistrictReference(districtOrId) {
  const districtId = resolveDistrictNumericId(districtOrId);
  return districtId > 0 ? `District ${districtId}` : "Neznámý district";
}

function sanitizeDistrictGossipEntry(rawEntry) {
  const createdAt = Math.max(0, Math.floor(Number(rawEntry?.createdAt) || Date.now()));
  const text = String(rawEntry?.text || "").trim();

  if (!text) {
    return null;
  }

  const id = String(rawEntry?.id || `${createdAt}-${Math.floor(Math.random() * 1_000_000)}`);
  const sourceBuilding = String(rawEntry?.sourceBuilding || "").trim() || null;
  const sourceDistrictId = rawEntry?.sourceDistrictId ?? null;
  const intelLevel = String(rawEntry?.intelLevel || "").trim().toLowerCase() === "verified" ? "verified" : "rumor";
  const intelType = String(rawEntry?.intelType || "").trim().toLowerCase() || "rumor";

  return {
    id,
    text,
    createdAt,
    sourceBuilding,
    sourceDistrictId,
    intelLevel,
    intelType
  };
}

function getDistrictGossipEntries(districtOrId, limit = DISTRICT_GOSSIP_MAX_PER_DISTRICT) {
  const districtKey = normalizeDistrictGossipKey(districtOrId);
  const rawEntries = Array.isArray(getResolvedWorldState().districtGossipById?.[districtKey])
    ? getResolvedWorldState().districtGossipById[districtKey]
    : [];

  return rawEntries
    .map((entry) => sanitizeDistrictGossipEntry(entry))
    .filter(Boolean)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, Math.max(1, Math.floor(Number(limit) || 1)));
}

function appendDistrictGossip(districtOrId, text, metadata = {}) {
  const districtKey = normalizeDistrictGossipKey(districtOrId);

  if (!districtKey) {
    return null;
  }

  const entry = sanitizeDistrictGossipEntry({
    id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    text,
    createdAt: metadata?.createdAt ?? Date.now(),
    sourceBuilding: metadata?.sourceBuilding || null,
    sourceDistrictId: metadata?.sourceDistrictId ?? null,
    intelLevel: metadata?.intelLevel || "rumor",
    intelType: metadata?.intelType || "rumor"
  });

  if (!entry) {
    return null;
  }

  const worldState = getResolvedWorldState();
  const existingEntries = Array.isArray(worldState.districtGossipById?.[districtKey])
    ? worldState.districtGossipById[districtKey]
    : [];
  const nextEntries = [...existingEntries, entry]
    .map((item) => sanitizeDistrictGossipEntry(item))
    .filter(Boolean)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, DISTRICT_GOSSIP_MAX_PER_DISTRICT);

  setStoredWorldState({
    ...worldState,
    districtGossipById: {
      ...(worldState.districtGossipById || {}),
      [districtKey]: nextEntries
    }
  });

  return entry;
}

function buildSeedDistrictGossipEntries(district) {
  if (!district) {
    return [];
  }

  const districtType = String(district.districtType || "unknown").trim().toLowerCase();
  const catalog = DISTRICT_GOSSIP_SEED_LIBRARY[districtType] || DISTRICT_GOSSIP_SEED_LIBRARY.unknown;
  const districtNumber = Math.max(1, resolveDistrictNumericId(district));
  const rumorPool = Array.isArray(catalog.rumors) && catalog.rumors.length > 0
    ? catalog.rumors
    : DISTRICT_GOSSIP_SEED_LIBRARY.unknown.rumors;
  const verifiedPool = Array.isArray(catalog.verified) && catalog.verified.length > 0
    ? catalog.verified
    : DISTRICT_GOSSIP_SEED_LIBRARY.unknown.verified;
  const now = Date.now();

  return [
    sanitizeDistrictGossipEntry({
      id: `seed-rumor-a:${districtNumber}`,
      text: rumorPool[districtNumber % rumorPool.length],
      createdAt: now - (districtNumber % 6 + 5) * 60_000,
      intelLevel: "rumor",
      intelType: "rumor"
    }),
    sanitizeDistrictGossipEntry({
      id: `seed-rumor-b:${districtNumber}`,
      text: rumorPool[(districtNumber + 2) % rumorPool.length],
      createdAt: now - (districtNumber % 7 + 18) * 60_000,
      intelLevel: "rumor",
      intelType: "rumor"
    }),
    sanitizeDistrictGossipEntry({
      id: `seed-verified:${districtNumber}`,
      text: verifiedPool[(districtNumber + 1) % verifiedPool.length],
      createdAt: now - (districtNumber % 5 + 32) * 60_000,
      intelLevel: "verified",
      intelType: "district_seed"
    })
  ].filter(Boolean);
}

function ensureDistrictPassiveGossip(district) {
  if (!district) {
    return [];
  }

  const currentEntries = getDistrictGossipEntries(district);

  if (currentEntries.length > 0) {
    return currentEntries;
  }

  const seedEntries = buildSeedDistrictGossipEntries(district);
  const worldState = getResolvedWorldState();
  const districtKey = normalizeDistrictGossipKey(district);

  setStoredWorldState({
    ...worldState,
    districtGossipById: {
      ...(worldState.districtGossipById || {}),
      [districtKey]: seedEntries
    }
  });

  return seedEntries;
}

function formatDistrictGossipTimestamp(timestamp) {
  const value = Math.max(0, Math.floor(Number(timestamp) || 0));

  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}. ${hours}:${minutes}`;
}

function buildDistrictIntelEventText(type, districtOrId, payload = {}) {
  const districtLabel = formatDistrictReference(districtOrId);
  const sourceLabel = payload?.sourceDistrictId ? formatDistrictReference(payload.sourceDistrictId) : null;
  const scenarioLabel = String(payload?.scenarioLabel || "").trim();
  const lootLabel = String(payload?.lootLabel || "").trim();

  switch (String(type || "").trim().toLowerCase()) {
    case "attack_started":
      return `Potvrzený intel: ${sourceLabel || "Neznámá posádka"} vyráží na útok proti ${districtLabel}.`;
    case "attack_success":
      return `Potvrzený intel: ${districtLabel} padl po tvrdém útoku a kontrola sektoru se změnila.`;
    case "attack_pyrrhic":
      return `Potvrzený intel: V ${districtLabel} proběhl krvavý střet. Útočníci převážili, ale sektor nikdo neudržel.`;
    case "attack_failed":
      return `Potvrzený intel: Pokus o útok na ${districtLabel} byl odražen.`;
    case "attack_catastrophe":
      return `Potvrzený intel: ${districtLabel} skončil po útoku v ruinách.`;
    case "attack_trapped":
      return `Potvrzený intel: Útok na ${districtLabel} zlomila toxická past a útočníci zmizeli beze stopy.`;
    case "spy_started":
      return `Potvrzený intel: V okolí ${districtLabel} byl zaznamenán cizí špeh.`;
    case "spy_success":
      return `Potvrzený intel: Někdo si z ${districtLabel} odnesl přesný přehled o sektoru.`;
    case "spy_partial":
      return `Potvrzený intel: O ${districtLabel} unikl částečný report. Typ sektoru je známý, obrana ne.`;
    case "spy_failed":
      return `Potvrzený intel: Pokus o špionáž v ${districtLabel} selhal dřív, než se dostal k jádru sektoru.`;
    case "raid_started":
      return `Potvrzený intel: V ${districtLabel} bylo zahájeno vykradení.`;
    case "raid_success":
      return lootLabel
        ? `Potvrzený intel: ${districtLabel} přišel při nočním nájezdu o ${lootLabel}.`
        : `Potvrzený intel: ${districtLabel} přišel při nočním nájezdu o část zásob.`;
    case "raid_empty":
      return `Potvrzený intel: Nájezd na ${districtLabel} proběhl, ale uvnitř nezůstal žádný použitelný loot.`;
    case "raid_failed":
      return `Potvrzený intel: Vykradení v ${districtLabel} se rozpadlo bez zisku.`;
    case "trap_armed":
      return `Drb: V uličkách kolem ${districtLabel} je cítit toxický kouř a něco tam není v pořádku.`;
    case "trap_moved":
      return `Drb: Past byla přesunuta blíž k přístupovým trasám do ${districtLabel}.`;
    case "trap_triggered":
      return `Potvrzený intel: V ${districtLabel} se aktivovala toxická past a útok se rozpadl během několika vteřin.`;
    case "occupy_started":
      return `Potvrzený intel: V ${districtLabel} začalo tiché obsazování po infiltrační akci.`;
    case "occupy_success":
      return `Potvrzený intel: ${districtLabel} převzala nová posádka a sektor změnil vlajku.`;
    default:
      return scenarioLabel
        ? `Potvrzený intel: ${districtLabel} zaznamenal událost ${scenarioLabel}.`
        : `Potvrzený intel: V ${districtLabel} byl zaznamenán pohyb v podsvětí.`;
  }
}

function recordDistrictIntelEvent({
  type,
  districtId,
  intelLevel = "verified",
  createdAt = Date.now(),
  sourceDistrictId = null,
  sourceBuilding = null,
  scenarioLabel = "",
  lootLabel = ""
} = {}) {
  const normalizedDistrictId = resolveDistrictNumericId(districtId);

  if (!normalizedDistrictId || !type) {
    return null;
  }

  const text = buildDistrictIntelEventText(type, normalizedDistrictId, {
    sourceDistrictId,
    scenarioLabel,
    lootLabel
  });

  return appendDistrictGossip(normalizedDistrictId, text, {
    createdAt,
    sourceDistrictId,
    sourceBuilding,
    intelLevel,
    intelType: type
  });
}

function getResolvedPhaseState() {
  return getResolvedWorldState().phaseState || {
    mapPhase: "night",
    gamePhase: "live",
    cityMinutes: 22 * 60 + 14
  };
}

function syncPhaseHostFromAuthority(phaseHost) {
  if (!phaseHost) {
    return getResolvedPhaseState();
  }

  const phaseState = getResolvedPhaseState();
  const nextMapPhase = phaseState.mapPhase === "day" ? "day" : "night";
  const nextGamePhase = phaseState.gamePhase === "launch" ? "launch" : "live";

  if (phaseHost.dataset.mapPhase !== nextMapPhase) {
    phaseHost.dataset.mapPhase = nextMapPhase;
    phaseHost.dispatchEvent(new CustomEvent("mapphasechange", { detail: { phase: nextMapPhase } }));
  }

  if (phaseHost.dataset.gamePhase !== nextGamePhase) {
    phaseHost.dataset.gamePhase = nextGamePhase;
    phaseHost.dispatchEvent(new CustomEvent("gamephasechange", { detail: { gamePhase: nextGamePhase } }));
  }

  return phaseState;
}

function setStoredGangState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    gang: {
      ...(session.gang || {}),
      ...(payload || {})
    }
  }));
  document.dispatchEvent(new CustomEvent("empire:gang-state-changed"));
}

function getResolvedGangState() {
  const storedState = getStoredGangState();
  const members = clamp(Number.parseInt(String(storedState?.members ?? DEFAULT_GANG_MEMBERS), 10) || DEFAULT_GANG_MEMBERS, 0, 9999);
  const influence = Math.max(0, Number.parseInt(String(storedState?.influence ?? 0), 10) || 0);
  const heat = clamp(Number.parseInt(String(storedState?.heat ?? 0), 10) || 0, 0, 9999);
  const policeRaidProtectionUntil = Math.max(0, Number(storedState?.policeRaidProtectionUntil || 0) || 0);
  const autoPoliceNextActionAt = Math.max(0, Number(storedState?.autoPoliceNextActionAt || 0) || 0);
  const heatJournal = Array.isArray(storedState?.heatJournal)
    ? storedState.heatJournal.filter((entry) => entry && typeof entry === "object").slice(0, GANG_HEAT_JOURNAL_LIMIT)
    : [];
  const dirtyHeatReductionTimestamps = Array.isArray(storedState?.dirtyHeatReductionTimestamps)
    ? storedState.dirtyHeatReductionTimestamps.map((entry) => Number(entry)).filter(Number.isFinite)
    : [];
  const lastHeatDecayAt = typeof storedState?.lastHeatDecayAt === "string" && storedState.lastHeatDecayAt
    ? storedState.lastHeatDecayAt
    : new Date().toISOString();

  return {
    members,
    influence,
    heat,
    policeRaidProtectionUntil,
    autoPoliceNextActionAt,
    heatJournal,
    dirtyHeatReductionTimestamps,
    lastHeatDecayAt
  };
}

function clampGangHeat(value) {
  return clamp(Number.parseInt(String(value ?? 0), 10) || 0, 0, 9999);
}

function clampGangInfluence(value) {
  return Math.max(0, Number.parseInt(String(value ?? 0), 10) || 0);
}

function resolveGangHeatTier(heatValue = 0) {
  const safeHeat = clampGangHeat(heatValue);
  return GANG_HEAT_TIERS.find((entry) => safeHeat >= entry.minHeat && safeHeat <= entry.maxHeat) || GANG_HEAT_TIERS[0];
}

function normalizeGangHeatJournal(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object" && typeof entry.reason === "string")
    .map((entry, index) => ({
      id: String(entry.id || `heat-log-${Date.now()}-${index}`),
      type: entry.type === "fall" ? "fall" : "rise",
      amount: Math.max(0, Number.parseInt(String(entry.amount || 0), 10) || 0),
      reason: String(entry.reason || "").trim(),
      createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString()
    }))
    .filter((entry) => entry.reason)
    .slice(0, GANG_HEAT_JOURNAL_LIMIT);
}

function appendGangHeatJournalEntry(type, amount, reason) {
  const safeReason = String(reason || "").trim();
  if (!safeReason) {
    return;
  }

  const safeType = type === "fall" ? "fall" : "rise";
  const safeAmount = Math.max(0, Number.parseInt(String(amount || 0), 10) || 0);
  updateStoredPreviewSession((session) => ({
    ...session,
    gang: {
      ...(session.gang || {}),
      heatJournal: normalizeGangHeatJournal([
        {
          id: `heat-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: safeType,
          amount: safeAmount,
          reason: safeReason,
          createdAt: new Date().toISOString()
        },
        ...normalizeGangHeatJournal(session?.gang?.heatJournal)
      ])
    }
  }));
  document.dispatchEvent(new CustomEvent("empire:gang-state-changed"));
}

function clearGangHeatJournal() {
  setStoredGangState({ heatJournal: [] });
}

function formatGangHeatProtectionLabel(untilValue) {
  const until = Math.max(0, Number(untilValue || 0) || 0);
  if (until <= Date.now()) {
    return "Bez ochrany";
  }

  return formatDurationLabel(until - Date.now());
}

function syncGangHeatDecay() {
  const gangState = getResolvedGangState();
  const lastDecayAt = new Date(gangState.lastHeatDecayAt || Date.now()).getTime();
  const safeLastDecayAt = Number.isFinite(lastDecayAt) ? lastDecayAt : Date.now();
  const elapsedMs = Math.max(0, Date.now() - safeLastDecayAt);
  if (elapsedMs < 60 * 1000) {
    return getResolvedGangState();
  }

  const tier = resolveGangHeatTier(gangState.heat);
  const decayPerHour = Number(GANG_HEAT_DECAY_BY_TIER[tier.id] || 0);
  const reducedAmount = Math.floor((elapsedMs / (60 * 60 * 1000)) * decayPerHour);
  if (reducedAmount <= 0) {
    setStoredGangState({ lastHeatDecayAt: new Date().toISOString() });
    return getResolvedGangState();
  }

  const nextHeat = Math.max(0, gangState.heat - reducedAmount);
  updateStoredPreviewSession((session) => ({
    ...session,
    gang: {
      ...(session.gang || {}),
      heat: nextHeat,
      lastHeatDecayAt: new Date().toISOString()
    }
  }));
  appendGangHeatJournalEntry("fall", reducedAmount, "Heat postupně vychládá.");
  return getResolvedGangState();
}

function setGangHeatValue(nextHeat, options = {}) {
  const safeHeat = clampGangHeat(nextHeat);
  const gangState = getResolvedGangState();
  const previousHeat = clampGangHeat(gangState.heat);
  updateStoredPreviewSession((session) => ({
    ...session,
    gang: {
      ...(session.gang || {}),
      heat: safeHeat,
      lastHeatDecayAt: new Date().toISOString()
    }
  }));
  if (options?.reason && safeHeat !== previousHeat) {
    appendGangHeatJournalEntry(
      options.type === "fall" ? "fall" : "rise",
      Math.abs(safeHeat - previousHeat),
      options.reason
    );
  } else {
    document.dispatchEvent(new CustomEvent("empire:gang-state-changed"));
  }
  return safeHeat;
}

function setGangInfluenceValue(nextInfluence) {
  const safeInfluence = clampGangInfluence(nextInfluence);
  setStoredGangState({ influence: safeInfluence });
  return safeInfluence;
}

function getGangAutoPoliceIntervalMs(tierId) {
  return Math.max(0, Number(GANG_HEAT_AUTO_POLICE_INTERVAL_BY_TIER[tierId] || 0) || 0);
}

function syncGangAutoPolicePressure() {
  const phaseState = getResolvedPhaseState();
  if ((phaseState.gamePhase || "live") === "launch") {
    return { triggered: false, marker: null };
  }

  const gangState = getResolvedGangState();
  const tier = resolveGangHeatTier(gangState.heat);
  const intervalMs = getGangAutoPoliceIntervalMs(tier.id);
  const now = Date.now();
  const activePoliceActionCount = Object.keys(getResolvedDistrictPoliceActions()).length;
  const ownedDistrictIds = getResolvedWorldState().ownedDistrictIds;

  if (intervalMs <= 0 || !ownedDistrictIds.length) {
    if (gangState.autoPoliceNextActionAt > 0) {
      setStoredGangState({ autoPoliceNextActionAt: 0 });
    }
    return { triggered: false, marker: null };
  }

  if (gangState.policeRaidProtectionUntil > now) {
    const nextActionAt = gangState.policeRaidProtectionUntil + intervalMs;
    if (gangState.autoPoliceNextActionAt !== nextActionAt) {
      setStoredGangState({ autoPoliceNextActionAt: nextActionAt });
    }
    return { triggered: false, marker: null };
  }

  const desiredLatestActionAt = now + intervalMs;
  const scheduledActionAt = Math.max(0, Number(gangState.autoPoliceNextActionAt || 0) || 0);
  if (!scheduledActionAt) {
    setStoredGangState({ autoPoliceNextActionAt: desiredLatestActionAt });
    return { triggered: false, marker: null };
  }

  if (scheduledActionAt > desiredLatestActionAt) {
    setStoredGangState({ autoPoliceNextActionAt: desiredLatestActionAt });
    return { triggered: false, marker: null };
  }

  if (activePoliceActionCount > 0 || scheduledActionAt > now) {
    return { triggered: false, marker: null };
  }

  const targetDistrictId = ownedDistrictIds[Math.floor(Math.random() * ownedDistrictIds.length)];
  const result = markDistrictPoliceAction(targetDistrictId, {
    source: "auto-heat-pressure"
  });

  setStoredGangState({
    autoPoliceNextActionAt: now + intervalMs
  });

  if (!result.ok) {
    return { triggered: false, marker: null };
  }

  appendGangHeatJournalEntry("rise", 0, `Vysoký heat přitáhl automatický policejní zásah do District ${targetDistrictId}.`);
  return {
    triggered: true,
    marker: result.marker || null
  };
}

function addGangHeat(root, delta = 0, reason = "Police heat") {
  const safeDelta = Math.max(0, Math.floor(Number(delta || 0)));
  if (!safeDelta) {
    return getResolvedGangState().heat;
  }

  const nextHeat = setGangHeatValue(getResolvedGangState().heat + safeDelta, {
    reason,
    type: "rise"
  });
  if (root instanceof HTMLElement) {
    const heatButton = root.querySelector(GANG_HEAT_SELECTOR);
    if (heatButton) {
      heatButton.textContent = String(nextHeat);
    }
  }
  return nextHeat;
}

function trySpendGangMoney(kind, amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  const economyState = getResolvedEconomyState();
  const key = kind === "dirty" ? "dirtyMoney" : "cleanMoney";
  const currentValue = Math.max(0, Math.floor(Number(economyState[key] || 0)));

  if (currentValue < safeAmount) {
    return { ok: false, missing: safeAmount - currentValue };
  }

  setStoredEconomyState({
    ...economyState,
    [key]: currentValue - safeAmount
  });

  return { ok: true, nextValue: currentValue - safeAmount };
}

function resolveWeightedRandomKey(weightedEntries, fallbackKey) {
  const safeEntries = Array.isArray(weightedEntries) ? weightedEntries.filter((entry) => Number(entry?.weight) > 0) : [];
  if (safeEntries.length === 0) {
    return fallbackKey;
  }

  const totalWeight = safeEntries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  if (totalWeight <= 0) {
    return fallbackKey;
  }

  let cursor = Math.random() * totalWeight;
  for (const entry of safeEntries) {
    cursor -= Number(entry.weight || 0);
    if (cursor <= 0) {
      return String(entry.key || fallbackKey);
    }
  }

  return String(safeEntries[safeEntries.length - 1]?.key || fallbackKey);
}

function resolvePoliceSpecialty(key) {
  return POLICE_RAID_SPECIALTIES[String(key || "").trim().toLowerCase()] || POLICE_RAID_SPECIALTIES.total;
}

function resolvePoliceOperationType(key) {
  return POLICE_OPERATION_TYPES[String(key || "").trim().toLowerCase()] || null;
}

function resolveRandomPoliceSpecialtyKey() {
  return resolveWeightedRandomKey(POLICE_SPECIALTY_RANDOM_WEIGHTS, "total");
}

function resolveRandomPoliceOperationType(tierId, source = "") {
  const normalizedSource = String(source || "").trim().toLowerCase();
  if (normalizedSource === "heat-dirty-bribe") {
    return tierId >= 4 ? "dirty_cash_seizure" : "district_control";
  }

  const eligible = Object.values(POLICE_OPERATION_TYPES)
    .filter((entry) => Number(entry.minTier || 1) <= Number(tierId || 1))
    .map((entry) => ({ key: entry.key, weight: entry.weight }));

  return resolveWeightedRandomKey(eligible, "warning_notice");
}

function applyPercentageLoss(value, percent) {
  const safeValue = Math.max(0, Math.floor(Number(value || 0)));
  const safePercent = Math.max(0, Number(percent || 0));
  if (safeValue <= 0 || safePercent <= 0) {
    return { nextValue: safeValue, lostValue: 0 };
  }

  const lostValue = Math.min(safeValue, Math.max(0, Math.floor((safeValue * safePercent) / 100)));
  return {
    nextValue: Math.max(0, safeValue - lostValue),
    lostValue
  };
}

function applyInventoryPenalty(inventoryName, percent) {
  const safePercent = Math.max(0, Number(percent || 0));
  if (safePercent <= 0) {
    return { totalLost: 0, entries: [] };
  }

  const currentInventory = inventoryName === "materials"
    ? getResolvedMaterialInventory()
    : inventoryName === "drugs"
      ? getResolvedDrugInventory()
      : getResolvedWeaponInventory();
  const nextInventory = { ...currentInventory };
  const entries = [];
  let totalLost = 0;

  for (const [itemId, amount] of Object.entries(currentInventory || {})) {
    const result = applyPercentageLoss(amount, safePercent);
    if (result.lostValue <= 0) {
      continue;
    }

    nextInventory[itemId] = result.nextValue;
    totalLost += result.lostValue;
    entries.push({
      itemId,
      lostValue: result.lostValue
    });
  }

  if (inventoryName === "materials") {
    setStoredMaterialInventory(nextInventory);
  } else if (inventoryName === "drugs") {
    setStoredDrugInventory(nextInventory);
  } else {
    setStoredWeaponInventory(nextInventory);
  }

  return { totalLost, entries };
}

function summarizePenaltyEntries(entries, resolver) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length <= 0) {
    return "0";
  }

  return safeEntries
    .slice(0, 3)
    .map((entry) => `${resolver(entry.itemId)} -${entry.lostValue}`)
    .join(", ");
}

function applyPoliceActionImpact(marker, tier) {
  const specialtyMeta = resolvePoliceSpecialty(marker?.raidSpecialtyKey);
  const specialtyMultiplier = POLICE_SPECIALTY_IMPACT_MULTIPLIER[specialtyMeta.key] || POLICE_SPECIALTY_IMPACT_MULTIPLIER.total;
  const tierImpact = POLICE_TIER_IMPACT_PROFILE[tier.id] || POLICE_TIER_IMPACT_PROFILE[1];
  const severity = POLICE_OPERATION_SEVERITY_MULTIPLIER[String(marker?.operationType || "").trim().toLowerCase()] ?? 1;

  const cleanPct = tierImpact.cleanPct * severity * specialtyMultiplier.clean;
  const dirtyPct = tierImpact.dirtyPct * severity * specialtyMultiplier.dirty;
  const drugPct = tierImpact.drugPct * severity * specialtyMultiplier.drugs;
  const weaponPct = tierImpact.weaponPct * severity * specialtyMultiplier.weapons;
  const materialPct = tierImpact.materialPct * severity * specialtyMultiplier.materials;
  const influencePct = tierImpact.influencePct * severity * specialtyMultiplier.influence;
  const membersPct = tierImpact.membersPct * severity * specialtyMultiplier.members;

  const economyState = getResolvedEconomyState();
  const cleanLoss = applyPercentageLoss(economyState.cleanMoney, cleanPct);
  const dirtyLoss = applyPercentageLoss(economyState.dirtyMoney, dirtyPct);
  setStoredEconomyState({
    ...economyState,
    cleanMoney: cleanLoss.nextValue,
    dirtyMoney: dirtyLoss.nextValue
  });

  const drugLoss = applyInventoryPenalty("drugs", drugPct);
  const weaponLoss = applyInventoryPenalty("weapons", weaponPct);
  const materialLoss = applyInventoryPenalty("materials", materialPct);

  const gangState = getResolvedGangState();
  const membersLoss = applyPercentageLoss(gangState.members, membersPct);
  const influenceLoss = applyPercentageLoss(gangState.influence, influencePct);
  setStoredGangState({
    members: membersLoss.nextValue,
    influence: influenceLoss.nextValue
  });

  const impactRows = [
    cleanLoss.lostValue > 0 ? { label: "Zabaveno clean", value: formatCurrency(cleanLoss.lostValue) } : null,
    dirtyLoss.lostValue > 0 ? { label: "Zabaveno dirty", value: formatCurrency(dirtyLoss.lostValue) } : null,
    drugLoss.totalLost > 0 ? { label: "Zabavené drogy", value: summarizePenaltyEntries(drugLoss.entries, getProductionResourceLabel) } : null,
    weaponLoss.totalLost > 0 ? { label: "Zabavená výzbroj", value: summarizePenaltyEntries(weaponLoss.entries, (itemId) => ATTACK_WEAPON_LABELS[itemId] || itemId) } : null,
    materialLoss.totalLost > 0 ? { label: "Zabavený materiál", value: summarizePenaltyEntries(materialLoss.entries, getProductionResourceLabel) } : null,
    membersLoss.lostValue > 0 ? { label: "Zatčení členové", value: `${membersLoss.lostValue}` } : null,
    influenceLoss.lostValue > 0 ? { label: "Ztracený vliv", value: `${influenceLoss.lostValue}` } : null
  ].filter(Boolean);

  return {
    cleanLoss: cleanLoss.lostValue,
    dirtyLoss: dirtyLoss.lostValue,
    drugLoss: drugLoss.totalLost,
    weaponLoss: weaponLoss.totalLost,
    materialLoss: materialLoss.totalLost,
    membersLoss: membersLoss.lostValue,
    influenceLoss: influenceLoss.lostValue,
    rows: impactRows
  };
}

function getStoredAttackOrders() {
  return getAuthoritySession().missions.attackOrders;
}

function setStoredAttackOrders(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    missions: {
      ...session.missions,
      attackOrders: Array.isArray(payload) ? payload : []
    }
  }));
}

function getStoredOccupyOrders() {
  return getAuthoritySession().missions.occupyOrders || [];
}

function setStoredOccupyOrders(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    missions: {
      ...session.missions,
      occupyOrders: Array.isArray(payload) ? payload : []
    }
  }));
}

function getStoredRobberyOrders() {
  return getAuthoritySession().missions.robberyOrders;
}

function setStoredRobberyOrders(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    missions: {
      ...session.missions,
      robberyOrders: Array.isArray(payload) ? payload : []
    }
  }));
}

function renderGangMembersState(root) {
  const gangMembers = root.querySelector(GANG_MEMBERS_SELECTOR);

  if (gangMembers) {
    gangMembers.textContent = String(getResolvedGangState().members);
  }
}

function formatCombatLootLabel(itemId) {
  const key = String(itemId || "").trim().toLowerCase();
  const labels = {
    chemicals: "Chemicals",
    biomass: "Biomass",
    "stim-pack": "Stim Pack",
    "metal-parts": "Metal Parts",
    "tech-core": "Tech Core"
  };

  return labels[key] || itemId;
}

function escapeModalHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function pickRandomQuote(quotes = [], fallback = "") {
  const safeQuotes = Array.isArray(quotes)
    ? quotes.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (safeQuotes.length <= 0) {
    return String(fallback || "").trim();
  }
  return safeQuotes[Math.floor(Math.random() * safeQuotes.length)] || String(fallback || "").trim();
}

function getRuntimeDistrictById(districtId) {
  const normalizedDistrictId = resolveDistrictNumericId(districtId);
  if (!normalizedDistrictId) {
    return null;
  }
  return window.empireStreetsDistrictState?.getDistrictById?.(normalizedDistrictId) || null;
}

function isCurrentPlayerOwnedDistrict(districtId) {
  const normalizedDistrictId = resolveDistrictNumericId(districtId);
  if (!normalizedDistrictId) {
    return false;
  }
  const worldState = getResolvedWorldState();
  if (Array.isArray(worldState.ownedDistrictIds) && worldState.ownedDistrictIds.includes(normalizedDistrictId)) {
    return true;
  }
  return Number(START_PHASE_OWNER_BY_DISTRICT_ID.get(normalizedDistrictId)) === CURRENT_PLAYER_ID;
}

function getResultDistrictOwnerLabel(districtId, fallbackOwnerLabel = "") {
  const normalizedDistrictId = resolveDistrictNumericId(districtId);
  const fallback = String(fallbackOwnerLabel || "").trim();
  if (!normalizedDistrictId) {
    return fallback || "Neznámý";
  }
  const worldState = getResolvedWorldState();
  if (Array.isArray(worldState.destroyedDistrictIds) && worldState.destroyedDistrictIds.includes(normalizedDistrictId)) {
    return "Zničený";
  }
  if (Array.isArray(worldState.ownedDistrictIds) && worldState.ownedDistrictIds.includes(normalizedDistrictId)) {
    return "TY";
  }
  const launchOwnerId = Number(START_PHASE_OWNER_BY_DISTRICT_ID.get(normalizedDistrictId) || 0);
  if (launchOwnerId > 0) {
    return launchOwnerId === CURRENT_PLAYER_ID ? "TY" : getLaunchPlayerName(launchOwnerId);
  }
  return fallback || "Neobsazeno";
}

function isDistrictUnownedForSpyResult(districtId, fallbackOwnerLabel = "") {
  return getResultDistrictOwnerLabel(districtId, fallbackOwnerLabel) === "Neobsazeno";
}

function getCurrentPlayerIdentityLabel() {
  const registration = getStoredRegistration();
  return String(registration?.identity || "Host").trim() || "Host";
}

function getCurrentPlayerGangLabel() {
  const registration = getStoredRegistration();
  return String(registration?.identity ? `${registration.identity} Crew` : "Guest Crew").trim() || "Guest Crew";
}

function getCurrentPlayerAllianceLabel() {
  const allianceName = window.empireStreetsAllianceState?.getActiveAlliance?.()?.name
    || document.querySelector("[data-gang-alliance]")?.textContent
    || "";
  return String(allianceName || "").trim() || "Žádná";
}

function getDistrictDefenseIntelSummary(districtId, fallbackDefensePower = 0) {
  const normalizedDistrictId = resolveDistrictNumericId(districtId);
  const worldState = getResolvedWorldState();
  const loadout = worldState.districtDefenseLoadoutById?.[normalizedDistrictId] || {};
  const weaponCount = Object.values(loadout).reduce(
    (sum, amount) => sum + Math.max(0, Number.parseInt(String(amount || 0), 10) || 0),
    0
  );
  const defensePower = Math.max(
    0,
    Number.parseInt(String(worldState.districtDefenseById?.[normalizedDistrictId] ?? fallbackDefensePower ?? 0), 10) || 0
  );
  const lowerPower = Math.max(0, Math.floor(defensePower * 0.8));
  const upperPower = Math.max(lowerPower, Math.ceil(defensePower * 1.2));
  return {
    weaponsLabel: `${weaponCount > 0 ? weaponCount : Math.max(0, Math.round(defensePower / 36))} ks`,
    powerRangeLabel: `${lowerPower} až ${upperPower}`,
    defensePower
  };
}

function buildSpyResultRows(districtId, mission = {}, options = {}) {
  const district = getRuntimeDistrictById(districtId);
  const buildingProfile = district ? resolveDistrictBuildingProfile(district) : null;
  const typeMeta = district
    ? (DISTRICT_BUILDING_TYPE_META[district.districtType] || DISTRICT_BUILDING_TYPE_META.resident)
    : (DISTRICT_BUILDING_TYPE_META[String(mission?.districtType || "").trim().toLowerCase()] || DISTRICT_BUILDING_TYPE_META.resident);
  const atmosphereMeta = district ? getDistrictAtmosphereMeta(district) : DISTRICT_ATMOSPHERE_META.unknown;
  const defenseIntel = getDistrictDefenseIntelSummary(districtId, options.defensePower ?? 0);
  const buildingLabel = buildingProfile?.buildings?.length
    ? buildingProfile.buildings.map((building) => building.displayName).join(", ")
    : "Bez významných budov";
  const rows = [];

  if (options.spyStatusLabel) {
    rows.push({ label: "Stav špeha", value: options.spyStatusLabel });
  }

  rows.push(
    {
      label: "Odhad zbraní v districtu",
      value: options.showWeapons === false ? "Nezjištěno" : defenseIntel.weaponsLabel
    },
    {
      label: "Odhad síly obrany",
      value: options.showPowerRange === false ? "Nezjištěno" : defenseIntel.powerRangeLabel
    },
    {
      label: "Typ distriktu",
      value: options.showType === false ? "Nezjištěno" : (typeMeta?.label || "Neznámý")
    },
    {
      label: "Atmosféra",
      value: options.showAtmosphere === false ? "Nezjištěno" : (atmosphereMeta?.label || "Neznámá")
    },
    {
      label: "Budovy",
      value: options.showBuildings === false ? "Nezjištěno" : buildingLabel
    }
  );

  return rows;
}

function resolveAttackOutcomeMeta(outcomeKey) {
  const key = String(outcomeKey || "").trim().toLowerCase();
  switch (key) {
    case "total-success":
      return {
        key,
        title: "TOTÁLNÍ ÚSPĚCH",
        badge: "District je tvůj",
        summary: "Rozjebali jste je na kusy. District je tvůj. Kdo tam ještě dýchá, už maká pro tebe nebo chcípne do rána."
      };
    case "pyrrhic-victory":
      return {
        key,
        title: "PYRRHOVO VÍTĚZSTVÍ",
        badge: "Obrana zničená",
        summary: "Sejmul jsi jejich obranu, ale tvoji lidi šli do sraček s nima. Půlka chcípla, zbraně v hajzlu. District pořád stojí ale sotva."
      };
    case "catastrophe":
      return {
        key,
        title: "KATASTROFA",
        badge: "District shořel",
        summary: "Všechno shořelo do prdele. Baráky, lidi, zásoby. Jen popel a smrad. Tady už není co brát, jen prázdná díra."
      };
    case "trap-triggered":
      return {
        key,
        title: "TOXICKÁ PAST",
        badge: "Past sepnuta",
        summary: "Útok skončil v toxický pasti. Celá skupina šla do hajzlu dřív, než stačila cokoliv urvat."
      };
    case "failure":
    default:
      return {
        key: "failure",
        title: "NEÚSPĚCH",
        badge: "Útok odražen",
        summary: "Totální průser. Vběhli jste tam jak idioti a nechali tam krev i výbavu. Oni taky něco ztratili, ale ty jsi ten, co dostal přes držku."
      };
  }
}

function resolvePoliceActionTierQuote(tierId) {
  return pickRandomQuote(POLICE_ACTION_TIER_QUOTES[Math.max(1, Number.parseInt(String(tierId || 1), 10) || 1)] || []);
}

function resolvePoliceActionSpecialtyQuote(specialtyKey) {
  return pickRandomQuote(POLICE_ACTION_SPECIALTY_QUOTES[String(specialtyKey || "").trim().toLowerCase()] || []);
}

function createPoliceActionStartedPayload(district, policeAction) {
  const districtName = formatDistrictReference(district || policeAction?.districtId);
  const tier = resolveGangHeatTier(getResolvedGangState().heat);
  const tierEntry = POLICE_ACTION_TIER_MESSAGES[tier.id] || POLICE_ACTION_TIER_MESSAGES[1];
  const specialtyMeta = resolvePoliceSpecialty(policeAction?.raidSpecialtyKey || resolvePoliceOperationType(policeAction?.operationType)?.specialtyKey);
  const specialtyQuote = resolvePoliceActionSpecialtyQuote(specialtyMeta.key);
  const policeQuote = resolvePoliceActionTierQuote(tier.id);

  return {
    tone: `${tierEntry.tone} is-specialty-${specialtyMeta.key}`,
    title: "Policejní akce",
    badge: `Stupeň ${tier.id}/6 • ${specialtyMeta.label}`,
    summary: specialtyQuote || policeQuote || tierEntry.text,
    rows: [
      { label: "Hláška", value: tierEntry.title },
      { label: "Policejní hláška", value: specialtyQuote || policeQuote || tierEntry.text },
      { label: "District", value: districtName },
      { label: "Typ razie", value: `${specialtyMeta.icon} ${specialtyMeta.label}` }
    ]
  };
}

function createDistrictPoliceRaidWarningPayload(district, policeAction) {
  const districtId = resolveDistrictNumericId(district || policeAction?.districtId);
  const specialtyMeta = resolvePoliceSpecialty(policeAction?.raidSpecialtyKey || resolvePoliceOperationType(policeAction?.operationType)?.specialtyKey);
  return {
    tone: `is-specialty-${specialtyMeta.key} is-district-raid-warning`,
    title: "Policejní razie v districtu",
    badge: specialtyMeta.label,
    summary: pickRandomQuote(POLICE_DISTRICT_CLICK_WARNING_QUOTES, "Tady teď ne. Policie to tu právě rozjebává."),
    syncToBuildingAction: false,
    rows: [
      { label: "Hráč", value: getResultDistrictOwnerLabel(districtId) },
      { label: "Typ razie", value: specialtyMeta.label }
    ]
  };
}

function createOwnedDistrictPoliceRaidAlertPayload(district, policeAction) {
  const districtId = resolveDistrictNumericId(district || policeAction?.districtId);
  const specialtyMeta = resolvePoliceSpecialty(policeAction?.raidSpecialtyKey || resolvePoliceOperationType(policeAction?.operationType)?.specialtyKey);
  return {
    tone: `is-specialty-${specialtyMeta.key} is-owned-district-raid-alert`,
    title: "Policejní razie v tvém districtu",
    badge: `Tvůj district pod razií • ${specialtyMeta.label}`,
    summary: pickRandomQuote(
      [
        "Policie právě najela do tvého districtu. Všechno je pod tlakem a bere se, co jde.",
        "Razie běží přímo u tebe. Teď jde o škody a o to, co ještě zůstane stát.",
        "Tvůj district je právě pod policejním zásahem. Situace je horká a nestabilní."
      ],
      "Policie právě razí tvůj district."
    ),
    syncToBuildingAction: false,
    rows: [
      { label: "District", value: formatDistrictReference(districtId) },
      { label: "Vlastník", value: getResultDistrictOwnerLabel(districtId) },
      { label: "Typ razie", value: specialtyMeta.label }
    ]
  };
}

function createDistrictAttackInProgressPayload(district, attackMarker) {
  const districtId = resolveDistrictNumericId(district || attackMarker?.districtId);
  const attackerDistrictId = resolveDistrictNumericId(attackMarker?.attackerDistrictId || attackMarker?.sourceDistrictId);
  const buildRows = () => {
    const remainingMs = Math.max(0, Number(attackMarker?.expiresAt || 0) - Date.now());
    return [
      { label: "Útočník", value: getResultDistrictOwnerLabel(attackerDistrictId, "Neznámý gang") },
      { label: "Obránce", value: getResultDistrictOwnerLabel(districtId, "Neobsazeno") },
      { label: "Konec boje za", value: formatDurationLabel(remainingMs), nowrap: true }
    ];
  };

  return {
    tone: "is-district-attack-warning",
    title: "Útok probíhá",
    badge: "Boj o district",
    summary: "",
    syncToBuildingAction: false,
    rows: buildRows(),
    getRows: buildRows,
    refreshMs: 1000,
    autoCloseWhen: () => Math.max(0, Number(attackMarker?.expiresAt || 0) - Date.now()) <= 0
  };
}

function clearPoliceActionResultLiveTimer() {
  if (policeActionResultLiveTimerId !== null) {
    window.clearInterval(policeActionResultLiveTimerId);
    policeActionResultLiveTimerId = null;
  }
}

function createSpyDetectionAlertPayload(districtId) {
  const district = getRuntimeDistrictById(districtId);
  const allianceLabel = getCurrentPlayerAllianceLabel();
  const useAllianceAlert = allianceLabel && allianceLabel !== "Žádná";
  const attackerNick = getCurrentPlayerIdentityLabel();
  const attackerGang = getCurrentPlayerGangLabel();
  const attackerAlliance = allianceLabel;
  const summaryBase = useAllianceAlert
    ? pickRandomQuote(SPY_ALLIANCE_DETECTION_WARNING_QUOTES, "")
    : pickRandomQuote(SPY_DETECTION_WARNING_QUOTES, "");

  return {
    title: "Upozornění: Neúspěšné špehování",
    badge: useAllianceAlert ? `Aliance v ohrožení • ${allianceLabel}` : "Vlastní district pod tlakem",
    summary: summaryBase
      .replaceAll("[ALLY]", allianceLabel)
      .concat(` Špeha vyslal: ${attackerNick} • gang ${attackerGang} • aliance ${attackerAlliance}.`)
      .trim(),
    alertKind: useAllianceAlert ? "alliance" : "player",
    district,
    attackerNick,
    attackerGang,
    attackerAlliance,
    detectedAt: Date.now()
  };
}

function renderActionResultRows(container, rows = []) {
  if (!container) {
    return;
  }

  container.innerHTML = rows
    .filter((row) => row && row.label != null && row.value != null)
    .map((row) => `
      <div class="modal__row">
        <span>${escapeModalHtml(row.label)}</span>
        <strong class="${row.nowrap ? "modal__nowrap-value" : ""}">${escapeModalHtml(row.value)}</strong>
      </div>
    `)
    .join("");
}

function getVisibleResultModal(root) {
  return [
    root.querySelector(SPY_RESULT_MODAL_SELECTOR),
    root.querySelector(SPY_WARNING_MODAL_SELECTOR),
    root.querySelector(RAID_RESULT_MODAL_SELECTOR),
    root.querySelector(ATTACK_RESULT_MODAL_SELECTOR),
    root.querySelector(POLICE_ACTION_RESULT_MODAL_SELECTOR)
  ].find((element) => element && !element.classList.contains("hidden")) || null;
}

function renderNextPendingResultModal(root) {
  if (!root || getVisibleResultModal(root) || pendingResultModalQueue.length <= 0) {
    return;
  }

  const nextItem = pendingResultModalQueue.shift();

  if (!nextItem) {
    return;
  }

  if (nextItem.kind === "spy") {
    openSpyResultModal(root, nextItem.payload);
    return;
  }

  if (nextItem.kind === "occupy") {
    openOccupationResultModal(root, nextItem.payload);
    return;
  }

  if (nextItem.kind === "spy_alert") {
    openSpyWarningModal(root, nextItem.payload);
    return;
  }

  if (nextItem.kind === "raid") {
    openRaidResultModal(root, nextItem.payload);
    return;
  }

  if (nextItem.kind === "attack") {
    openAttackResultModal(root, nextItem.payload);
    return;
  }

  if (nextItem.kind === "police") {
    openPoliceActionResultModal(root, nextItem.payload);
  }
}

function queueOrOpenResultModal(root, kind, payload) {
  if (!root) {
    return;
  }

  if (getVisibleResultModal(root)) {
    pendingResultModalQueue.push({ kind, payload });
    return;
  }

  if (kind === "spy") {
    openSpyResultModal(root, payload);
    return;
  }

  if (kind === "occupy") {
    openOccupationResultModal(root, payload);
    return;
  }

  if (kind === "spy_alert") {
    openSpyWarningModal(root, payload);
    return;
  }

  if (kind === "raid") {
    openRaidResultModal(root, payload);
    return;
  }

  if (kind === "attack") {
    openAttackResultModal(root, payload);
    return;
  }

  if (kind === "police") {
    openPoliceActionResultModal(root, payload);
  }
}

function closeResultModal(root, selector) {
  const modal = root?.querySelector(selector);

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  window.setTimeout(() => {
    renderNextPendingResultModal(root);
  }, 80);
}

function openSpyResultModal(root, payload = {}) {
  const modal = root?.querySelector(SPY_RESULT_MODAL_SELECTOR);
  const content = root?.querySelector(SPY_RESULT_MODAL_CONTENT_SELECTOR);
  const title = root?.querySelector(SPY_RESULT_MODAL_TITLE_SELECTOR);
  const summary = root?.querySelector(SPY_RESULT_MODAL_SUMMARY_SELECTOR);
  const details = root?.querySelector(SPY_RESULT_MODAL_DETAILS_SELECTOR);

  if (!modal || !content || !title || !summary || !details) {
    return;
  }

  content.classList.remove("is-success", "is-medium-fail", "is-major-fail", "is-player-alert", "is-alliance-alert");
  content.classList.add(payload.tone || "is-major-fail");
  title.textContent = payload.title || "Výsledek špehování";
  summary.textContent = payload.summary || "";
  renderActionResultRows(details, payload.rows || []);
  modal.classList.remove("hidden");
}

function openOccupationResultModal(root, payload = {}) {
  openSpyResultModal(root, payload);
}

function openSpyWarningModal(root, payload = {}) {
  const modal = root?.querySelector(SPY_WARNING_MODAL_SELECTOR);
  const content = root?.querySelector(SPY_WARNING_MODAL_CONTENT_SELECTOR);
  const title = root?.querySelector(SPY_WARNING_MODAL_TITLE_SELECTOR);
  const badge = root?.querySelector(SPY_WARNING_MODAL_BADGE_SELECTOR);
  const summary = root?.querySelector(SPY_WARNING_MODAL_SUMMARY_SELECTOR);
  const details = root?.querySelector(SPY_WARNING_MODAL_DETAILS_SELECTOR);

  if (!modal || !content || !title || !badge || !summary || !details) {
    return;
  }

  const districtName = formatDistrictReference(payload.district || payload.districtId);
  const detectedAtLabel = formatDistrictGossipTimestamp(payload.detectedAt || Date.now());
  const attackerNick = String(payload.attackerNick || "Neznámý hráč");
  const attackerGang = String(payload.attackerGang || "Neznámý gang");
  const attackerAlliance = String(payload.attackerAlliance || "Bez aliance");

  content.classList.remove("is-success", "is-medium-fail", "is-major-fail", "is-player-alert", "is-alliance-alert");
  content.classList.add(payload.alertKind === "alliance" ? "is-alliance-alert" : "is-player-alert");
  title.textContent = payload.title || "Upozornění: Neúspěšné špehování";
  badge.textContent = payload.badge || "Vlastní district pod tlakem";
  summary.textContent = payload.summary || "";
  details.innerHTML = `
    <div class="modal__row">
      <span>Cíl</span>
      <strong>${escapeModalHtml(districtName)}</strong>
    </div>
    <div class="modal__row">
      <span>Odeslal špeha</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--nick">${escapeModalHtml(attackerNick)}</strong>
    </div>
    <div class="modal__row">
      <span>Gang útočníka</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--gang">${escapeModalHtml(attackerGang)}</strong>
    </div>
    <div class="modal__row">
      <span>Aliance útočníka</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--alliance">${escapeModalHtml(attackerAlliance)}</strong>
    </div>
    <div class="modal__row">
      <span>Čas zachycení</span>
      <strong class="modal__nowrap-value">${escapeModalHtml(detectedAtLabel)}</strong>
    </div>
    <div class="modal__row">
      <span>Stav districtu</span>
      <strong>Špeh byl odhalen</strong>
    </div>
  `;
  modal.classList.remove("hidden");
}

function openRaidResultModal(root, payload = {}) {
  const modal = root?.querySelector(RAID_RESULT_MODAL_SELECTOR);
  const content = root?.querySelector(RAID_RESULT_MODAL_CONTENT_SELECTOR);
  const title = root?.querySelector(RAID_RESULT_MODAL_TITLE_SELECTOR);
  const summary = root?.querySelector(RAID_RESULT_MODAL_SUMMARY_SELECTOR);
  const details = root?.querySelector(RAID_RESULT_MODAL_DETAILS_SELECTOR);

  if (!modal || !content || !title || !summary || !details) {
    return;
  }

  content.classList.remove("is-clean-success", "is-dirty-fail", "is-disaster", "is-alert");
  content.classList.add(payload.tone || "is-alert");
  title.textContent = payload.title || "Výsledek krádeže";
  summary.textContent = payload.summary || "";
  renderActionResultRows(details, payload.rows || []);
  modal.classList.remove("hidden");
}

function openAttackResultModal(root, payload = {}) {
  const modal = root?.querySelector(ATTACK_RESULT_MODAL_SELECTOR);
  const content = root?.querySelector(ATTACK_RESULT_MODAL_CONTENT_SELECTOR);
  const title = root?.querySelector(ATTACK_RESULT_MODAL_TITLE_SELECTOR);
  const badge = root?.querySelector(ATTACK_RESULT_MODAL_BADGE_SELECTOR);
  const summary = root?.querySelector(ATTACK_RESULT_MODAL_SUMMARY_SELECTOR);
  const stats = root?.querySelector(ATTACK_RESULT_MODAL_STATS_SELECTOR);
  const targetLabel = root?.querySelector(ATTACK_RESULT_MODAL_TARGET_LABEL_SELECTOR);
  const targetValue = root?.querySelector(ATTACK_RESULT_MODAL_TARGET_VALUE_SELECTOR);
  const attackLabel = root?.querySelector(ATTACK_RESULT_MODAL_ATTACK_LABEL_SELECTOR);
  const attackValue = root?.querySelector(ATTACK_RESULT_MODAL_ATTACK_VALUE_SELECTOR);
  const defenseLabel = root?.querySelector(ATTACK_RESULT_MODAL_DEFENSE_LABEL_SELECTOR);
  const defenseValue = root?.querySelector(ATTACK_RESULT_MODAL_DEFENSE_VALUE_SELECTOR);
  const attackLossLabel = root?.querySelector(ATTACK_RESULT_MODAL_ATTACK_LOSS_LABEL_SELECTOR);
  const attackLossValue = root?.querySelector(ATTACK_RESULT_MODAL_ATTACK_LOSS_VALUE_SELECTOR);
  const defenseLossLabel = root?.querySelector(ATTACK_RESULT_MODAL_DEFENSE_LOSS_LABEL_SELECTOR);
  const defenseLossValue = root?.querySelector(ATTACK_RESULT_MODAL_DEFENSE_LOSS_VALUE_SELECTOR);
  const stateLabel = root?.querySelector(ATTACK_RESULT_MODAL_STATE_LABEL_SELECTOR);
  const stateValue = root?.querySelector(ATTACK_RESULT_MODAL_STATE_VALUE_SELECTOR);
  const durationLabel = root?.querySelector(ATTACK_RESULT_MODAL_DURATION_LABEL_SELECTOR);
  const durationValue = root?.querySelector(ATTACK_RESULT_MODAL_DURATION_VALUE_SELECTOR);

  if (
    !modal
    || !content
    || !title
    || !badge
    || !summary
    || !stats
    || !targetLabel
    || !targetValue
    || !attackLabel
    || !attackValue
    || !defenseLabel
    || !defenseValue
    || !attackLossLabel
    || !attackLossValue
    || !defenseLossLabel
    || !defenseLossValue
    || !stateLabel
    || !stateValue
    || !durationLabel
    || !durationValue
  ) {
    return;
  }

  content.classList.remove("is-total-success", "is-pyrrhic-victory", "is-failure", "is-catastrophe", "is-trap-triggered");
  content.classList.add(payload.tone || "is-failure");
  title.textContent = payload.title || "Výsledek útoku";
  badge.textContent = payload.badge || "Výsledek útoku";
  summary.textContent = payload.summary || "";
  targetLabel.textContent = payload.targetLabel || "Cíl";
  targetValue.textContent = payload.districtName || payload.target || "-";
  attackLabel.textContent = payload.attackLabel || "Útočná síla";
  attackValue.textContent = payload.attackPower != null ? String(payload.attackPower) : "-";
  defenseLabel.textContent = payload.defenseLabel || "Obranná síla";
  defenseValue.textContent = payload.showDefensePower === false ? "-" : (payload.defensePower != null ? String(payload.defensePower) : "-");
  attackLossLabel.textContent = payload.attackLossLabel || "Ztráty útočníka";
  attackLossValue.textContent = payload.attackerLossesLabel || "-";
  defenseLossLabel.textContent = payload.defenseLossLabel || "Ztráty obránce";
  defenseLossValue.textContent = payload.defenderLossesLabel || "-";
  stateLabel.textContent = payload.stateLabel || "Stav districtu";
  stateValue.textContent = payload.districtStateValue || "-";
  durationLabel.textContent = payload.durationLabel || "Trvání";
  durationValue.textContent = payload.durationValue || "-";
  defenseValue.closest(".modal__row")?.classList.toggle("hidden", payload.showDefensePower === false);
  modal.classList.remove("hidden");
}

function closePoliceActionResultModal(root) {
  const modal = root?.querySelector(POLICE_ACTION_RESULT_MODAL_SELECTOR);
  if (!modal) {
    return;
  }

  clearPoliceActionResultLiveTimer();
  modal.classList.add("hidden");
  window.setTimeout(() => {
    renderNextPendingResultModal(root);
  }, 80);
}

function openPoliceActionResultModal(root, payload = {}) {
  const modal = root?.querySelector(POLICE_ACTION_RESULT_MODAL_SELECTOR);
  const content = root?.querySelector(POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR);
  const title = root?.querySelector(POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR);
  const badge = root?.querySelector(POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR);
  const summary = root?.querySelector(POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR);
  const details = root?.querySelector(POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR);

  if (!modal || !content || !title || !badge || !summary || !details) {
    return;
  }

  clearPoliceActionResultLiveTimer();
  content.classList.remove(
    "is-tier-1",
    "is-tier-2",
    "is-tier-3",
    "is-tier-4",
    "is-tier-5",
    "is-tier-6",
    "is-specialty-financial",
    "is-specialty-drug",
    "is-specialty-weapons",
    "is-specialty-arrests",
    "is-specialty-total",
    "is-district-raid-warning",
    "is-district-attack-warning"
  );

  for (const token of String(payload.tone || "").split(/\s+/).map((entry) => entry.trim()).filter(Boolean)) {
    content.classList.add(token);
  }

  if (payload.syncToBuildingAction !== false) {
    syncBuildingActionSource(root, {
      tone: "event",
      title: payload.title || "Policejní akce",
      summary: payload.summary || "",
      meta: payload.badge || "Policejní zásah",
      resultKind: "police",
      resultPayload: cloneBuildingActionResultPayload(payload)
    });
    appendBuildingActionResultEntry(root, "police", payload, {
      tone: "event",
      title: payload.title || "Policejní akce",
      summary: payload.summary || "",
      meta: payload.badge || "Policejní zásah"
    });
  }

  title.textContent = payload.title || "Policejní akce";
  badge.textContent = payload.badge || "Policejní zásah";
  summary.textContent = payload.summary || "";
  const renderRows = () => {
    const resolvedRows = typeof payload.getRows === "function"
      ? payload.getRows()
      : (payload.rows || []);
    renderActionResultRows(details, resolvedRows);
  };
  renderRows();
  modal.classList.remove("hidden");

  if (typeof payload.getRows === "function" && Number(payload.refreshMs || 0) > 0) {
    policeActionResultLiveTimerId = window.setInterval(() => {
      if (modal.classList.contains("hidden")) {
        clearPoliceActionResultLiveTimer();
        return;
      }

      renderRows();

      if (typeof payload.autoCloseWhen === "function" && payload.autoCloseWhen()) {
        clearPoliceActionResultLiveTimer();
        closePoliceActionResultModal(root);
      }
    }, Number(payload.refreshMs));
  }
}

function resolveBuildingActionTone(rawTone) {
  const tone = String(rawTone || "").trim().toLowerCase();
  if (tone === "idle" || tone === "success" || tone === "warning" || tone === "error") {
    return tone;
  }

  return "event";
}

function resolveBuildingActionTheme(rawTone) {
  const tone = String(rawTone || "").trim().toLowerCase();

  if (
    tone.includes("fail")
    || tone.includes("disaster")
    || tone.includes("catastrophe")
    || tone.includes("trap-triggered")
  ) {
    return "negative";
  }

  if (
    tone.includes("success")
    || tone.includes("victory")
    || tone.includes("clean")
  ) {
    return "positive";
  }

  return "neutral";
}

function normalizeBuildingActionSnapshot(snapshot) {
  const tone = resolveBuildingActionTone(snapshot?.tone);
  const title = String(snapshot?.title || "").trim();
  const summary = String(snapshot?.summary || "").trim();
  const meta = String(snapshot?.meta || "").trim();
  const resultKind = String(snapshot?.resultKind || "").trim();
  const resultPayload = snapshot?.resultPayload && typeof snapshot.resultPayload === "object"
    ? snapshot.resultPayload
    : null;

  return {
    tone,
    title: title || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.title : "Uliční zpráva"),
    summary: summary || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.summary : "Bez detailu."),
    meta: meta || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.meta : ""),
    resultKind,
    resultPayload
  };
}

function createBuildingActionFingerprint(snapshot) {
  const normalizedSnapshot = normalizeBuildingActionSnapshot(snapshot);
  return [
    normalizedSnapshot.tone,
    normalizedSnapshot.title,
    normalizedSnapshot.summary,
    normalizedSnapshot.meta
  ].join("::");
}

function formatBuildingActionTimestamp(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function createBuildingActionEntry(snapshot) {
  const normalizedSnapshot = normalizeBuildingActionSnapshot(snapshot);
  const timestampMs = Number.isFinite(Number(snapshot?.timestampMs))
    ? Number(snapshot.timestampMs)
    : Date.now();

  return {
    ...normalizedSnapshot,
    id: String(snapshot?.id || `street-news-${timestampMs}-${Math.random().toString(36).slice(2, 8)}`),
    timestampMs,
    timeLabel: formatBuildingActionTimestamp(timestampMs)
  };
}

function cloneBuildingActionResultPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    ...payload,
    rows: Array.isArray(payload.rows)
      ? payload.rows.map((row) => ({ ...row }))
      : payload.rows
  };
}

function appendBuildingActionResultEntry(root, kind, payload, snapshot = {}) {
  const normalizedPayload = cloneBuildingActionResultPayload(payload);
  const title = String(payload?.title || snapshot.title || "Uliční zpráva").trim();
  const summary = String(payload?.summary || snapshot.summary || "Bez detailu.").trim();
  const meta = String(snapshot.meta || "Klikni pro detail výsledku").trim();

  appendBuildingActionEntry(root, {
    ...snapshot,
    tone: payload?.tone || snapshot.tone || "event",
    title,
    summary,
    meta,
    resultKind: kind,
    resultPayload: normalizedPayload
  }, { syncPreview: false });
}

function resolveBuildingActionPanel(root) {
  const cached = buildingActionPanels.get(root);
  if (cached) {
    return cached;
  }

  const stateElement = root.querySelector(BUILDING_ACTION_STATE_SELECTOR);
  const summaryElement = root.querySelector(BUILDING_ACTION_SUMMARY_SELECTOR);
  const metaElement = root.querySelector(BUILDING_ACTION_META_SELECTOR);
  const clearButton = root.querySelector(BUILDING_ACTION_CLEAR_SELECTOR);
  const feedElement = root.querySelector(BUILDING_ACTION_FEED_SELECTOR);
  const emptyElement = root.querySelector(BUILDING_ACTION_EMPTY_SELECTOR);

  if (
    !(stateElement instanceof HTMLElement)
    || !(summaryElement instanceof HTMLElement)
    || !(metaElement instanceof HTMLElement)
    || !(clearButton instanceof HTMLButtonElement)
    || !(feedElement instanceof HTMLElement)
    || !(emptyElement instanceof HTMLElement)
  ) {
    return null;
  }

  const panel = {
    stateElement,
    summaryElement,
    metaElement,
    clearButton,
    feedElement,
    emptyElement,
    entries: [],
    captureScheduled: false,
    skipFingerprint: "",
    lastFingerprint: "",
    currentSnapshot: null,
    observer: null
  };

  buildingActionPanels.set(root, panel);
  return panel;
}

function syncBuildingActionSource(root, snapshot) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  const normalizedSnapshot = normalizeBuildingActionSnapshot(snapshot);
  panel.currentSnapshot = normalizedSnapshot;
  panel.skipFingerprint = createBuildingActionFingerprint(normalizedSnapshot);
  panel.stateElement.textContent = normalizedSnapshot.title;
  panel.stateElement.classList.toggle("building-action-status__state--idle", normalizedSnapshot.tone === "idle");
  panel.summaryElement.textContent = normalizedSnapshot.summary;
  panel.metaElement.textContent = normalizedSnapshot.meta;

  const isClickable = Boolean(normalizedSnapshot.resultKind && normalizedSnapshot.resultPayload);
  if (isClickable) {
    panel.summaryElement.hidden = true;
    panel.summaryElement.classList.remove("building-action-status__line--clickable");
    panel.summaryElement.removeAttribute("role");
    panel.summaryElement.tabIndex = -1;
    panel.metaElement.hidden = true;
    panel.metaElement.textContent = "";
    panel.metaElement.classList.remove("building-action-status__line--clickable");
    panel.metaElement.removeAttribute("role");
    panel.metaElement.tabIndex = -1;
  } else {
    panel.summaryElement.hidden = false;
    panel.summaryElement.classList.remove("building-action-status__line--clickable");
    panel.summaryElement.removeAttribute("role");
    panel.summaryElement.tabIndex = -1;
    panel.metaElement.hidden = !normalizedSnapshot.meta;
  }
}

function readBuildingActionSource(root) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return null;
  }

  const title = panel.stateElement.textContent?.trim() || "";
  const summary = panel.summaryElement.textContent?.trim() || "";
  const meta = panel.metaElement.textContent?.trim() || "";

  if (!title && !summary && !meta) {
    return null;
  }

  return normalizeBuildingActionSnapshot({
    tone: panel.stateElement.classList.contains("building-action-status__state--idle") ? "idle" : "event",
    title,
    summary,
    meta
  });
}

function openCurrentBuildingActionResultModal(root) {
  const panel = resolveBuildingActionPanel(root);
  const snapshot = panel?.currentSnapshot;

  if (!panel || !snapshot?.resultKind || !snapshot?.resultPayload) {
    return;
  }

  queueOrOpenResultModal(root, snapshot.resultKind, snapshot.resultPayload);
}

function createBuildingActionItemElement(root, entry) {
  const item = document.createElement("article");
  item.className = `building-action-status__item building-action-status__item--${entry.tone} building-action-status__item--${resolveBuildingActionTheme(entry.resultPayload?.tone || entry.tone)}`;
  item.dataset.buildingActionId = entry.id;

  if (entry.resultKind) {
    item.classList.add("building-action-status__item--clickable");
    item.dataset.buildingActionResultKind = entry.resultKind;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Otevřít detail zprávy ${entry.title}`);
  }

  item.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest(BUILDING_ACTION_REMOVE_SELECTOR)) {
      return;
    }

    if (!entry.resultKind || !entry.resultPayload) {
      return;
    }

    queueOrOpenResultModal(root, entry.resultKind, entry.resultPayload);
  });

  item.addEventListener("keydown", (event) => {
    if (!entry.resultKind || !entry.resultPayload) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    queueOrOpenResultModal(root, entry.resultKind, entry.resultPayload);
  });

  const head = document.createElement("div");
  head.className = "building-action-status__item-head";

  const title = document.createElement("strong");
  title.className = "building-action-status__item-title";
  title.textContent = entry.title;
  head.append(title);

  const controls = document.createElement("div");
  controls.className = "building-action-status__item-controls";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "button building-action-status__item-delete";
  removeButton.dataset.buildingActionRemove = entry.id;
  removeButton.setAttribute("aria-label", `Smazat zprávu ${entry.title}`);
  removeButton.innerHTML = "<span aria-hidden=\"true\">✕</span>";
  controls.append(removeButton);

  head.append(controls);
  item.append(head);

  const summary = document.createElement("p");
  summary.className = "building-action-status__item-summary";
  summary.textContent = entry.summary;
  item.append(summary);

  if (entry.meta) {
    const meta = document.createElement("p");
    meta.className = "building-action-status__item-meta";
    meta.textContent = entry.meta;
    item.append(meta);
  }

  return item;
}

function renderBuildingActionFeed(root, { syncPreview = false, previewSnapshot = null } = {}) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  panel.feedElement.replaceChildren(
    ...panel.entries.map((entry) => createBuildingActionItemElement(root, entry))
  );

  const hasEntries = panel.entries.length > 0;
  panel.emptyElement.hidden = hasEntries;
  panel.feedElement.hidden = !hasEntries;
  panel.clearButton.disabled = !hasEntries;
  panel.clearButton.setAttribute("aria-disabled", hasEntries ? "false" : "true");

  if (syncPreview) {
    const snapshot = previewSnapshot || panel.entries[0] || BUILDING_ACTION_EMPTY_SNAPSHOT;
    syncBuildingActionSource(root, snapshot);
  }
}

function appendBuildingActionEntry(root, snapshot, { syncPreview = false } = {}) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  const entry = createBuildingActionEntry(snapshot);
  const fingerprint = createBuildingActionFingerprint(entry);

  if (entry.tone === "idle") {
    renderBuildingActionFeed(root, { syncPreview: true, previewSnapshot: entry });
    return;
  }

  if (!entry.resultKind || !entry.resultPayload) {
    renderBuildingActionFeed(root, { syncPreview, previewSnapshot: entry });
    return;
  }

  if (panel.entries[0] && createBuildingActionFingerprint(panel.entries[0]) === fingerprint) {
    renderBuildingActionFeed(root, { syncPreview, previewSnapshot: entry });
    return;
  }

  panel.entries = [entry, ...panel.entries].slice(0, BUILDING_ACTION_LOG_LIMIT);
  panel.lastFingerprint = fingerprint;
  renderBuildingActionFeed(root, { syncPreview, previewSnapshot: entry });
  panel.feedElement.scrollTop = 0;
}

function captureBuildingActionMutation(root) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  panel.captureScheduled = false;
  const snapshot = readBuildingActionSource(root);
  if (!snapshot) {
    return;
  }

  const fingerprint = createBuildingActionFingerprint(snapshot);
  if (panel.skipFingerprint && panel.skipFingerprint === fingerprint) {
    panel.skipFingerprint = "";
    return;
  }

  panel.skipFingerprint = "";
  if (snapshot.tone === "idle" || panel.lastFingerprint === fingerprint) {
    return;
  }

  appendBuildingActionEntry(root, snapshot, { syncPreview: false });
}

function scheduleBuildingActionMutationCapture(root) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel || panel.captureScheduled) {
    return;
  }

  panel.captureScheduled = true;
  queueMicrotask(() => {
    captureBuildingActionMutation(root);
  });
}

function setBuildingActionFeedback(root, tone, title, summary, meta = "") {
  const snapshot = normalizeBuildingActionSnapshot({
    tone,
    title,
    summary,
    meta
  });

  syncBuildingActionSource(root, snapshot);
  appendBuildingActionEntry(root, snapshot, { syncPreview: false });
}

function completeAttackOrder(root, orderId) {
  const orders = getStoredAttackOrders();
  const order = orders.find((entry) => entry.id === orderId);

  if (!order) {
    attackMissionTimers.delete(orderId);
    return;
  }

  setStoredAttackOrders(orders.filter((entry) => entry.id !== orderId));
  attackMissionTimers.delete(orderId);

  const gangState = getResolvedGangState();
  const worldState = getResolvedWorldState();
  const targetDistrictId = Number.parseInt(String(order.targetDistrictId || "").replace("district:", ""), 10) || 0;
  const trapState = worldState.districtTrapById?.[targetDistrictId];
  const trapTriggered = Boolean(trapState?.isArmed && Number(trapState.ownerId) !== CURRENT_PLAYER_ID);
  const trapOutcome = {
    key: "trap-triggered",
    label: "Toxická past",
    capturesDistrict: false,
    destroysDistrict: false,
    defenseLossRatio: 0
  };
  const scenarioLabel = trapTriggered ? trapOutcome.label : resolveAttackScenario(order);
  const outcome = trapTriggered
    ? trapOutcome
    : (order.resolvedScenario || { key: "failure", label: scenarioLabel, capturesDistrict: false, destroysDistrict: false, defenseLossRatio: 0 });
  const deployedMembers = Number.parseInt(String(order.requiredPopulation ?? 0), 10) || 0;
  const memberLoss = getAttackScenarioMemberLoss(scenarioLabel, deployedMembers);
  const returningMembers = Math.max(0, deployedMembers - memberLoss);
  const currentDefense = order.targetDefensePower ?? worldState.districtDefenseById[targetDistrictId] ?? 0;
  const breachInfrastructureHit = Boolean(
    order.factoryBoost?.type === "breach"
    && !trapTriggered
    && !outcome.destroysDistrict
    && Math.random() < (Number(order.factoryBoost?.destroyBuildingChancePct || 0) / 100)
  );
  const nextDefenseBase = Math.max(0, Math.round(currentDefense * (1 - (outcome.defenseLossRatio ?? 0))));
  const nextDefense = breachInfrastructureHit ? 0 : nextDefenseBase;
  const launchOwnerId = START_PHASE_OWNER_BY_DISTRICT_ID.get(targetDistrictId);
  const targetOwnerName = launchOwnerId ? getLaunchPlayerName(launchOwnerId) : "Neobsazeno";

  setStoredGangState({
    members: gangState.members + returningMembers
  });
  setStoredWorldState({
    ...worldState,
    ownedDistrictIds: outcome.capturesDistrict
      ? Array.from(new Set([...(worldState.ownedDistrictIds || []), targetDistrictId]))
      : outcome.destroysDistrict
        ? (worldState.ownedDistrictIds || []).filter((districtId) => districtId !== targetDistrictId)
        : (worldState.ownedDistrictIds || []),
    destroyedDistrictIds: outcome.destroysDistrict
      ? Array.from(new Set([...worldState.destroyedDistrictIds, targetDistrictId]))
      : worldState.destroyedDistrictIds.filter((districtId) => districtId !== targetDistrictId),
    districtDefenseById: {
      ...worldState.districtDefenseById,
      [targetDistrictId]: nextDefense
    },
    districtDefenseLoadoutById: {
      ...worldState.districtDefenseLoadoutById,
      [targetDistrictId]: outcome.capturesDistrict || outcome.destroysDistrict || breachInfrastructureHit
        ? {}
        : (worldState.districtDefenseLoadoutById?.[targetDistrictId] || {})
    },
    districtDefenseResidentsById: {
      ...worldState.districtDefenseResidentsById,
      [targetDistrictId]: outcome.capturesDistrict || outcome.destroysDistrict
        ? 0
        : Math.max(0, Number.parseInt(String(worldState.districtDefenseResidentsById?.[targetDistrictId] ?? 0), 10) || 0)
    },
    districtTrapById: {
      ...worldState.districtTrapById,
      [targetDistrictId]: trapTriggered
        ? {
            ...trapState,
            isArmed: false,
            triggeredAt: new Date().toISOString()
          }
        : outcome.capturesDistrict || outcome.destroysDistrict
          ? null
          : (worldState.districtTrapById?.[targetDistrictId] || null)
    }
  });
  if (outcome.capturesDistrict) {
    window.empireStreetsDistrictState?.captureDistrict?.(targetDistrictId);
  }
  if (outcome.destroysDistrict) {
    window.empireStreetsDistrictState?.destroyDistrict?.(targetDistrictId);
  }
  recordDistrictIntelEvent({
    type: trapTriggered
      ? "attack_trapped"
      : outcome.destroysDistrict
        ? "attack_catastrophe"
        : outcome.capturesDistrict
          ? "attack_success"
          : outcome.key === "pyrrhic-victory"
            ? "attack_pyrrhic"
            : "attack_failed",
    districtId: targetDistrictId,
    sourceDistrictId: order.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel
  });
  renderGangMembersState(root);

  const attackOutcomeMeta = resolveAttackOutcomeMeta(trapTriggered ? "trap-triggered" : outcome.key);
  const attackerLossPct = deployedMembers > 0 ? Math.round((memberLoss / deployedMembers) * 100) : 0;
  const defenderLossValue = trapTriggered ? 0 : Math.max(0, Math.round(Number(currentDefense || 0) - nextDefense));
  const defenderLossPct = Number(currentDefense || 0) > 0
    ? Math.round((defenderLossValue / Number(currentDefense || 0)) * 100)
    : (outcome.destroysDistrict || outcome.capturesDistrict ? 100 : 0);
  const attackResultPayload = {
    tone: `is-${attackOutcomeMeta.key}`,
    outcomeKey: attackOutcomeMeta.key,
    title: attackOutcomeMeta.title,
    badge: attackOutcomeMeta.badge,
    summary: attackOutcomeMeta.summary,
    districtName: `District ${targetDistrictId}`,
    attackPower: Math.max(0, Math.floor(Number(order.estimatedAttackPower ?? 0) || 0)),
    defensePower: Math.max(0, Math.floor(Number(currentDefense ?? 0) || 0)),
    attackerLossesLabel: `${attackerLossPct}%`,
    defenderLossesLabel: `${defenderLossPct}%`,
    districtStateValue: trapTriggered
      ? "Past aktivována"
      : outcome.destroysDistrict
        ? "Zničený"
        : outcome.capturesDistrict
          ? "Obsazený"
          : "Stojí",
    durationValue: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()),
    showDefensePower: String(outcome.key || "").trim().toLowerCase() === "total-success"
  };
  syncBuildingActionSource(root, {
    tone: trapTriggered || outcome.destroysDistrict ? "error" : outcome.capturesDistrict ? "success" : "warning",
    title: attackResultPayload.title,
    summary: attackResultPayload.summary,
    meta: `${order.sourceDistrictId} → ${order.targetDistrictId} · ${scenarioLabel}`,
    resultKind: "attack",
    resultPayload: attackResultPayload
  });
  appendBuildingActionResultEntry(root, "attack", attackResultPayload);
  queueOrOpenResultModal(root, "attack", attackResultPayload);

  window.dispatchEvent(new CustomEvent("empire:bounty-action-resolved", {
    detail: {
      action: "attack",
      sourceDistrictId: Number.parseInt(String(order.sourceDistrictId || "").replace("district:", ""), 10) || 0,
      targetDistrictId,
      targetOwnerName,
      scenarioLabel,
      capturesDistrict: Boolean(outcome.capturesDistrict),
      destroysDistrict: Boolean(outcome.destroysDistrict),
      successfulAttack: !trapTriggered && outcome.key !== "failure",
      defenseReduced: nextDefense < Number(currentDefense || 0) || Boolean(outcome.capturesDistrict) || Boolean(outcome.destroysDistrict)
    }
  }));
}

function scheduleAttackOrder(root, order) {
  if (!order?.id || attackMissionTimers.has(order.id)) {
    return;
  }

  const remainingMs = new Date(order.resolveAt || order.returnAt || order.createdAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    completeAttackOrder(root, order.id);
    return;
  }

  const timerId = window.setTimeout(() => {
    completeAttackOrder(root, order.id);
  }, remainingMs);

  attackMissionTimers.set(order.id, timerId);
}

function bindAttackOrders(root) {
  for (const order of getStoredAttackOrders()) {
    scheduleAttackOrder(root, order);
  }
}

function completeOccupyOrder(root, orderId) {
  const orders = getStoredOccupyOrders();
  const order = orders.find((entry) => entry.id === orderId);

  if (!order) {
    occupyMissionTimers.delete(orderId);
    return;
  }

  setStoredOccupyOrders(orders.filter((entry) => entry.id !== orderId));
  occupyMissionTimers.delete(orderId);

  const targetDistrictId = Number.parseInt(String(order.targetDistrictId || "").replace("district:", ""), 10) || 0;
  const spyIntel = getResolvedSpyIntel();
  const worldState = getResolvedWorldState();
  const launchOwnerId = START_PHASE_OWNER_BY_DISTRICT_ID.get(targetDistrictId);
  const targetOwnerName = launchOwnerId ? getLaunchPlayerName(launchOwnerId) : "Neobsazeno";

  setStoredSpyIntel({
    occupiableDistrictIds: spyIntel.occupiableDistrictIds.filter((districtId) => districtId !== targetDistrictId),
    revealedTypeDistrictIds: spyIntel.revealedTypeDistrictIds || [],
    revealedDefenseDistrictIds: spyIntel.revealedDefenseDistrictIds || []
  });
  setStoredWorldState({
    ...worldState,
    ownedDistrictIds: Array.from(new Set([...(worldState.ownedDistrictIds || []), targetDistrictId])),
    destroyedDistrictIds: (worldState.destroyedDistrictIds || []).filter((districtId) => districtId !== targetDistrictId)
  });
  window.empireStreetsDistrictState?.captureDistrict?.(targetDistrictId);
  recordDistrictIntelEvent({
    type: "occupy_success",
    districtId: targetDistrictId,
    sourceDistrictId: order.sourceDistrictId,
    intelLevel: "verified"
  });

  const occupyResultPayload = {
    tone: "is-success",
    title: "Obsazení: Úspěch",
    summary: `District ${targetDistrictId} byl úspěšně obsazen a připadl tvému gangu.`,
    rows: [
      { label: "Zdroj", value: String(order.sourceDistrictId || "---") },
      { label: "Cíl", value: `District ${targetDistrictId}` },
      { label: "Trvání", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true },
      { label: "Stav districtu", value: "Obsazený" }
    ]
  };
  syncBuildingActionSource(root, {
    tone: "success",
    title: occupyResultPayload.title,
    summary: occupyResultPayload.summary,
    meta: `${order.sourceDistrictId} → district:${targetDistrictId} · obsazení dokončeno`,
    resultKind: "occupy",
    resultPayload: occupyResultPayload
  });
  appendBuildingActionResultEntry(root, "occupy", occupyResultPayload);
  queueOrOpenResultModal(root, "occupy", occupyResultPayload);

  window.dispatchEvent(new CustomEvent("empire:bounty-action-resolved", {
    detail: {
      action: "occupy",
      sourceDistrictId: Number.parseInt(String(order.sourceDistrictId || "").replace("district:", ""), 10) || 0,
      targetDistrictId,
      targetOwnerName,
      capturesDistrict: true,
      successfulAttack: false,
      defenseReduced: true
    }
  }));
}

function scheduleOccupyOrder(root, order) {
  if (!order?.id || occupyMissionTimers.has(order.id)) {
    return;
  }

  const remainingMs = new Date(order.resolveAt || order.createdAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    completeOccupyOrder(root, order.id);
    return;
  }

  const timerId = window.setTimeout(() => {
    completeOccupyOrder(root, order.id);
  }, remainingMs);

  occupyMissionTimers.set(order.id, timerId);
}

function bindOccupyOrders(root) {
  for (const order of getStoredOccupyOrders()) {
    scheduleOccupyOrder(root, order);
  }
}

function completeRobberyOrder(root, orderId) {
  const orders = getStoredRobberyOrders();
  const order = orders.find((entry) => entry.id === orderId);

  if (!order) {
    robberyMissionTimers.delete(orderId);
    return;
  }

  setStoredRobberyOrders(orders.filter((entry) => entry.id !== orderId));
  robberyMissionTimers.delete(orderId);

  const scenarioLabel = resolveRobberyScenario(order);
  const deployedMembers = Number.parseInt(String(order.deployedMembers ?? 0), 10) || 0;
  const memberLoss = getRobberyScenarioMemberLoss(scenarioLabel, deployedMembers);
  const returningMembers = Math.max(0, deployedMembers - memberLoss);
  const loot = getRobberyLootForOrder(order, scenarioLabel);
  const lootEntries = Object.entries(loot);
  setStoredGangState({
    members: getResolvedGangState().members + returningMembers
  });
  renderGangMembersState(root);

  if (lootEntries.length > 0) {
    for (const [itemId, amount] of lootEntries) {
      setInventoryAmount("materials", itemId, getInventoryAmount("materials", itemId) + amount);
    }
  }

  recordDistrictIntelEvent({
    type: lootEntries.length > 0 ? "raid_success" : (memberLoss >= deployedMembers ? "raid_failed" : "raid_empty"),
    districtId: order.targetDistrictId,
    sourceDistrictId: order.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel,
    lootLabel: lootEntries.map(([itemId, amount]) => `${itemId} x${amount}`).join(", ")
  });

  const lootLabel = lootEntries.length > 0
    ? lootEntries.map(([itemId, amount]) => `${formatCombatLootLabel(itemId)} x${amount}`).join(", ")
    : "Žádný";
  const raidTone = lootEntries.length > 0
    ? (memberLoss > 0 ? "is-dirty-fail" : "is-clean-success")
    : (memberLoss >= deployedMembers ? "is-disaster" : "is-alert");
  const raidResultPayload = {
    tone: raidTone,
    title: lootEntries.length > 0
      ? (memberLoss > 0 ? "ŠPINAVÁ KRÁDEŽ" : "ČISTÁ KRÁDEŽ")
      : "PRŮSER",
    summary: lootEntries.length > 0
      ? (memberLoss > 0
        ? "Vzali jste lup ale nebylo to čistý. Trochu krve, trochu bordelu. Něco jsi nechal na místě, ale pořád jsi v plusu."
        : "Vlezli jste tam, sebrali co šlo a zmizeli jak duchové. Ani kurva nevěděli, že tam někdo byl. Prachy jsou tvoje.")
      : "Posrali jste to. Chytili vás při činu, někdo to odnesl a zbytek zdrhal jak krysy. Nemáš nic, jen ostudu a ztráty.",
    rows: [
      ...(lootEntries.length > 0
        ? (memberLoss > 0
          ? [
              { label: "Cíl", value: `District ${order.targetDistrictId}` },
              { label: "Ztráta členů", value: `${memberLoss}` },
              { label: "Cooldown", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true },
              { label: "Zisk", value: lootLabel }
            ]
          : [
              { label: "Cíl", value: `District ${order.targetDistrictId}` },
              { label: "Získáno", value: lootLabel },
              { label: "Trvání", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true },
              { label: "Cooldown", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true }
            ])
        : [
            { label: "Cíl", value: `District ${order.targetDistrictId}` },
            { label: "Ztráta členů", value: `${memberLoss}` },
            { label: "Cooldown", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true },
            { label: "Upozornění cíle", value: raidTone === "is-alert" ? "Ano" : "Ne" }
          ])
    ]
  };
  syncBuildingActionSource(root, {
    tone: raidTone === "is-clean-success" ? "success" : raidTone === "is-alert" ? "warning" : "error",
    title: raidResultPayload.title,
    summary: raidResultPayload.summary,
    meta: `${order.sourceDistrictId} → ${order.targetDistrictId} · ${scenarioLabel}`,
    resultKind: "raid",
    resultPayload: raidResultPayload
  });
  appendBuildingActionResultEntry(root, "raid", raidResultPayload);
  queueOrOpenResultModal(root, "raid", raidResultPayload);
}

function scheduleRobberyOrder(root, order) {
  if (!order?.id || robberyMissionTimers.has(order.id)) {
    return;
  }

  const remainingMs = new Date(order.resolveAt || order.createdAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    completeRobberyOrder(root, order.id);
    return;
  }

  const timerId = window.setTimeout(() => {
    completeRobberyOrder(root, order.id);
  }, remainingMs);

  robberyMissionTimers.set(order.id, timerId);
}

function bindRobberyOrders(root) {
  for (const order of getStoredRobberyOrders()) {
    scheduleRobberyOrder(root, order);
  }
}

function getStoredSpyState() {
  return getAuthoritySession().missions.spy;
}

function setStoredSpyState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    missions: {
      ...session.missions,
      spy: payload || session.missions.spy
    }
  }));
}

function getSpyMissionPhase(mission) {
  if (!mission || typeof mission !== "object") {
    return "active";
  }

  return mission.status === "captured" ? "captured" : "active";
}

function getSpyMissionExpiryTimestamp(mission) {
  const phase = getSpyMissionPhase(mission);
  const rawTimestamp = phase === "captured"
    ? mission.cooldownUntil
    : (mission.returnAt || mission.createdAt);
  const timestamp = new Date(rawTimestamp || Date.now()).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function isSpyMissionActiveOnMap(mission) {
  return getSpyMissionPhase(mission) === "active";
}

function getResolvedSpyState() {
  const storedState = getStoredSpyState();

  if (storedState && Array.isArray(storedState.missions)) {
    const now = Date.now();
    const missions = storedState.missions
      .filter((mission) => mission && mission.id)
      .filter((mission) => (
        getSpyMissionPhase(mission) !== "captured"
        || getSpyMissionExpiryTimestamp(mission) > now
      ));

    const available = clamp(MAX_SPIES - missions.length, 0, MAX_SPIES);
    if (
      missions.length !== storedState.missions.length
      || available !== clamp(Number(storedState.available ?? MAX_SPIES), 0, MAX_SPIES)
    ) {
      setStoredSpyState({
        ...storedState,
        available,
        missions
      });
    }

    return {
      available,
      missions
    };
  }

  const nextState = {
    available: MAX_SPIES,
    missions: []
  };
  setStoredSpyState(nextState);
  return nextState;
}

function getStoredSpyIntel() {
  return getAuthoritySession().missions.spyIntel;
}

function setStoredSpyIntel(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    missions: {
      ...session.missions,
      spyIntel: payload || session.missions.spyIntel
    }
  }));
}

function getResolvedSpyIntel() {
  const storedIntel = getStoredSpyIntel();

  if (storedIntel && Array.isArray(storedIntel.occupiableDistrictIds)) {
    return {
      occupiableDistrictIds: storedIntel.occupiableDistrictIds.map((districtId) => Number(districtId)).filter(Boolean),
      revealedTypeDistrictIds: Array.isArray(storedIntel.revealedTypeDistrictIds)
        ? storedIntel.revealedTypeDistrictIds.map((districtId) => Number(districtId)).filter(Boolean)
        : [],
      revealedDefenseDistrictIds: Array.isArray(storedIntel.revealedDefenseDistrictIds)
        ? storedIntel.revealedDefenseDistrictIds.map((districtId) => Number(districtId)).filter(Boolean)
        : []
    };
  }

  const nextIntel = { occupiableDistrictIds: [], revealedTypeDistrictIds: [], revealedDefenseDistrictIds: [] };
  setStoredSpyIntel(nextIntel);
  return nextIntel;
}

function createWeaponInventoryFromFaction(factionId) {
  return { ...DEFAULT_WEAPON_INVENTORY, ...(FACTION_WEAPON_PRESETS[factionId] || {}) };
}

function getResolvedWeaponInventory() {
  const storedInventory = getStoredWeaponInventory();

  if (storedInventory) {
    return {
      ...DEFAULT_WEAPON_INVENTORY,
      ...storedInventory
    };
  }

  const registration = getStoredRegistration();
  const factionId = registration?.factionId && FACTION_CATALOG[registration.factionId]
    ? registration.factionId
    : "mafian";
  const nextInventory = createWeaponInventoryFromFaction(factionId);
  setStoredWeaponInventory(nextInventory);
  return nextInventory;
}

function getProductionJob(jobId) {
  return getResolvedProductionState()[jobId] || null;
}

function persistProductionJob(jobId, payload) {
  const productionState = getResolvedProductionState();
  productionState[jobId] = payload;
  setStoredProductionState(productionState);
}

function clearProductionJob(jobId) {
  const productionState = getResolvedProductionState();
  delete productionState[jobId];
  setStoredProductionState(productionState);
}

function applyInventoryOutput(output) {
  if (!output) {
    return;
  }

  if (output.inventory === "materials") {
    const factorySupplyKey = getFactorySupplyKeyForMaterial(output.itemId);

    if (factorySupplyKey) {
      const supplies = getStoredFactorySupplies();
      setStoredFactorySupplies({
        ...supplies,
        [factorySupplyKey]: Math.max(0, Number(supplies[factorySupplyKey] || 0) + Number(output.amount || 0))
      });
      return;
    }

    const inventory = getResolvedMaterialInventory();
    inventory[output.itemId] = (inventory[output.itemId] ?? 0) + output.amount;
    setStoredMaterialInventory(inventory);
    return;
  }

  if (output.inventory === "drugs") {
    const inventory = getResolvedDrugInventory();
    inventory[output.itemId] = (inventory[output.itemId] ?? 0) + output.amount;
    setStoredDrugInventory(inventory);
    return;
  }

  if (output.inventory === "weapons") {
    const inventory = getResolvedWeaponInventory();
    inventory[output.itemId] = (inventory[output.itemId] ?? 0) + output.amount;
    setStoredWeaponInventory(inventory);
  }
}

function hasEnoughMaterials(inputs = {}) {
  return Object.entries(inputs).every(([itemId, amount]) => getInventoryAmount("materials", itemId) >= amount);
}

function consumeMaterials(inputs = {}) {
  for (const [itemId, amount] of Object.entries(inputs)) {
    const currentAmount = getInventoryAmount("materials", itemId);
    setInventoryAmount("materials", itemId, currentAmount - amount);
  }
}

function syncCompletedProductionJobs() {
  const productionState = getResolvedProductionState();
  let hasChanges = false;

  for (const [jobId, job] of Object.entries(productionState)) {
    if (job?.status === "running" && new Date(job.readyAt).getTime() <= Date.now()) {
      productionState[jobId] = {
        ...job,
        status: "ready"
      };
      hasChanges = true;
    }
  }

  if (hasChanges) {
    setStoredProductionState(productionState);
  }
}

function scheduleProductionJob(jobId, rerender) {
  if (productionTimers.has(jobId)) {
    return;
  }

  const job = getProductionJob(jobId);

  if (!job || job.status !== "running") {
    return;
  }

  const remainingMs = new Date(job.readyAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    persistProductionJob(jobId, { ...job, status: "ready" });
    rerender();
    return;
  }

  const timerId = window.setTimeout(() => {
    productionTimers.delete(jobId);
    const currentJob = getProductionJob(jobId);

    if (currentJob?.status === "running") {
      persistProductionJob(jobId, { ...currentJob, status: "ready" });
      rerender();
    }
  }, remainingMs);

  productionTimers.set(jobId, timerId);
}

const PRODUCTION_BUILDING_CONFIG = Object.freeze({
  pharmacy: Object.freeze({
    label: "Lékárna",
    title: "Výroba látek",
    upgradeBaseCost: 3200,
    infoText: "Lékárna drží základní chemické vstupy pro další výrobu. Je to první vrstva produkčního řetězce mezi materiálem a finálním produktem.",
    infoActions: Object.freeze([
      "+ Vybrat hotové přesune dokončené dávky do skladu materiálů.",
      "⇪ Upgrade zvyšuje rychlost výroby celé budovy o 10 % za level.",
      "Chemicals, Biomass a Stim Pack napájí recepty v Labu."
    ])
  }),
  druglab: Object.freeze({
    label: "Lab",
    title: "Výroba drug balíků",
    upgradeBaseCost: 4200,
    infoText: "Lab přetváří látky z Lékárny na finální balíky pro distribuci. Vyšší level zkracuje craft a zrychluje obrat celé nelegální produkce.",
    infoActions: Object.freeze([
      "+ Vybrat hotové přesune dokončené balíky do skladu drog.",
      "⇪ Upgrade zvyšuje rychlost craftu všech receptů v Labu.",
      "Lab spotřebovává Chemicals, Biomass a Stim Pack z materiálového skladu."
    ])
  }),
  armory: Object.freeze({
    label: "Zbrojovka",
    title: "Výroba výzbroje",
    upgradeBaseCost: 5200,
    infoText: "Zbrojovka převádí Metal Parts a Tech Core na útočné i obranné vybavení. Je to hlavní zdroj výzbroje pro útoky i defense loadouty districtů.",
    infoActions: Object.freeze([
      "+ Vybrat hotové přesune zbraně do skladu výzbroje.",
      "⇪ Upgrade zvyšuje rychlost výroby zbrojovky o 10 % za level.",
      "Zbrojovka bere Metal Parts a Tech Core z materiálového skladu."
    ])
  })
});

function getStoredProductionBuildingsState() {
  return getAuthoritySession().production?.buildings || {};
}

function getStoredProductionBuildingState(buildingName) {
  const state = getStoredProductionBuildingsState()?.[buildingName];
  return {
    level: Math.max(1, Math.floor(Number(state?.level || 1)))
  };
}

function setStoredProductionBuildingState(buildingName, payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      buildings: {
        ...(session.production?.buildings || {}),
        [buildingName]: {
          level: Math.max(1, Math.floor(Number(payload?.level || 1)))
        }
      }
    }
  }));
}

function getProductionBuildingMultiplier(buildingName, level = 1) {
  const normalizedLevel = Math.max(1, Math.floor(Number(level || 1)));
  void buildingName;
  return 1 + ((normalizedLevel - 1) * 0.1);
}

function getProductionBuildingUpgradeCost(buildingName, nextLevel = 2) {
  const config = PRODUCTION_BUILDING_CONFIG[buildingName];
  const baseCost = Number(config?.upgradeBaseCost || 3500);
  const normalizedLevel = Math.max(2, Math.floor(Number(nextLevel || 2)));
  return Math.round(baseCost * Math.pow(1.42, normalizedLevel - 2));
}

function getProductionBuildingReadyCount(buildingName, recipes) {
  return Object.keys(recipes || {}).reduce((total, recipeId) => {
    const job = getProductionJob(`${buildingName}:${recipeId}`);
    return total + (job?.status === "ready" ? 1 : 0);
  }, 0);
}

function collectReadyProductionForBuilding(buildingName, recipes) {
  let collected = 0;

  for (const recipeId of Object.keys(recipes || {})) {
    const jobKey = `${buildingName}:${recipeId}`;
    const job = getProductionJob(jobKey);

    if (!job || job.status !== "ready") {
      continue;
    }

    applyInventoryOutput(job.output);
    clearProductionJob(jobKey);
    collected += Math.max(0, Number(job.output?.amount || 0));
  }

  return collected;
}

function getProductionBuildingEffectsLabel(buildingName, level) {
  const multiplier = getProductionBuildingMultiplier(buildingName, level);
  const bonusPct = Math.max(0, Math.round((multiplier - 1) * 100));
  const label = PRODUCTION_BUILDING_CONFIG[buildingName]?.label || "Budova";
  return bonusPct > 0
    ? `${label} · produkce +${bonusPct}%`
    : `${label} · základní produkční rychlost`;
}

function getFactoryCollectableAmount(factoryState) {
  return (factoryState?.slots || []).reduce((total, slot) => (
    total + Math.max(0, Math.floor(Number(slot?.producedAmount || 0)))
  ), 0);
}

function collectFactoryOutputsToSupplies() {
  const syncResult = syncFactoryProduction(getStoredFactoryState());
  const nextState = syncResult.state;
  const nextSupplies = getStoredFactorySupplies();
  let collected = 0;

  for (const slot of nextState.slots || []) {
    const amount = Math.max(0, Math.floor(Number(slot?.producedAmount || 0)));

    if (amount <= 0 || !slot?.resourceKey) {
      continue;
    }

    nextSupplies[slot.resourceKey] = Math.max(0, Math.floor(Number(nextSupplies[slot.resourceKey] || 0) + amount));
    slot.producedAmount = 0;
    collected += amount;
  }

  setStoredFactoryState(nextState);
  setStoredFactorySupplies(nextSupplies);
  return collected;
}

const PRODUCTION_RESOURCE_LABELS = Object.freeze({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "stim-pack": "Stim Pack",
  "metal-parts": "Metal Parts",
  "tech-core": "Tech Core"
});

const PRODUCTION_SLOT_VISUALS = Object.freeze({
  pharmacy: Object.freeze({
    chemicals: Object.freeze({ slotClass: "pharmacy-slot--cyan", iconToneClass: "pharmacy-slot__icon--cyan", iconGlyphClass: "pharmacy-slot__icon--flask", productLabel: "Materiál" }),
    biomass: Object.freeze({ slotClass: "pharmacy-slot--green", iconToneClass: "pharmacy-slot__icon--green", iconGlyphClass: "pharmacy-slot__icon--leaf", productLabel: "Materiál" }),
    "stim-pack": Object.freeze({ slotClass: "pharmacy-slot--violet", iconToneClass: "pharmacy-slot__icon--violet", iconGlyphClass: "pharmacy-slot__icon--capsule", productLabel: "Materiál" })
  }),
  druglab: Object.freeze({
    "neon-dust": Object.freeze({ iconToneClass: "drug-production-slot__icon--violet", iconGlyphClass: "drug-production-slot__icon--crystal", productLabel: "Drug balík" }),
    "pulse-shot": Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--powder", productLabel: "Drug balík" }),
    "velvet-smoke": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--drop", productLabel: "Drug balík" }),
    "ghost-serum": Object.freeze({ iconToneClass: "drug-production-slot__icon--green", iconGlyphClass: "drug-production-slot__icon--flask", productLabel: "Drug balík" }),
    "overdrive-x": Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--capsule", productLabel: "Drug balík" })
  }),
  armory: Object.freeze({
    "baseball-bat": Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--crate", productLabel: "Výzbroj" }),
    pistol: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Výzbroj" }),
    grenade: Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--powder", productLabel: "Výzbroj" }),
    smg: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Výzbroj" }),
    bazooka: Object.freeze({ iconToneClass: "drug-production-slot__icon--red", iconGlyphClass: "drug-production-slot__icon--crosshair", productLabel: "Výzbroj" }),
    vest: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" }),
    barricades: Object.freeze({ iconToneClass: "drug-production-slot__icon--amber", iconGlyphClass: "drug-production-slot__icon--crate", productLabel: "Defense" }),
    cameras: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--chip", productLabel: "Defense" }),
    "defense-tower": Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" }),
    alarm: Object.freeze({ iconToneClass: "drug-production-slot__icon--cyan", iconGlyphClass: "drug-production-slot__icon--shield", productLabel: "Defense" })
  })
});

function getProductionResourceLabel(itemId) {
  return PRODUCTION_RESOURCE_LABELS[itemId] || String(itemId || "").trim() || "Materiál";
}

function getProductionSlotState(job) {
  if (!job) {
    return { label: "Připraveno", isActive: false };
  }

  if (job.status === "running") {
    return { label: "Výroba", isActive: true };
  }

  return { label: "Hotovo", isActive: true };
}

function createMetricBlock({ label, value, inline = false }) {
  const metric = document.createElement("div");
  metric.className = inline
    ? "drug-production-slot__metric drug-production-slot__metric--inline"
    : "drug-production-slot__metric";

  const labelElement = document.createElement("span");
  labelElement.className = "drug-production-slot__metric-label";
  labelElement.textContent = label;

  if (inline) {
    const valueElement = document.createElement("span");
    valueElement.className = "drug-production-slot__metric-inline-value";
    valueElement.textContent = value;
    metric.append(labelElement, valueElement);
    return metric;
  }

  const valueElement = document.createElement("strong");
  valueElement.className = "drug-production-slot__metric-value";
  valueElement.textContent = value;
  metric.append(labelElement, valueElement);
  return metric;
}

function createPharmacyMetricBlock(label, value) {
  const metric = document.createElement("div");
  metric.className = "pharmacy-slot__metric";
  const labelElement = document.createElement("span");
  labelElement.className = "pharmacy-slot__metric-label";
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.className = "pharmacy-slot__metric-value";
  valueElement.textContent = value;
  metric.append(labelElement, valueElement);
  return metric;
}

function createDrugSupplyRow(inputs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "drug-production-slot__metric drug-production-slot__metric--supplies";

  const label = document.createElement("span");
  label.className = "drug-production-slot__metric-label";
  label.textContent = "Vstupy";

  const row = document.createElement("div");
  row.className = "drug-production-slot__supply-row";

  for (const [itemId, amount] of Object.entries(inputs)) {
    const pill = document.createElement("div");
    const variant = itemId === "chemicals"
      ? "drug-production-slot__supply-pill--chemicals"
      : itemId === "biomass"
        ? "drug-production-slot__supply-pill--biomass"
        : "drug-production-slot__supply-pill--stim";
    pill.className = `drug-production-slot__supply-pill ${variant}`;

    const name = document.createElement("span");
    name.className = "drug-production-slot__supply-name";
    name.textContent = getProductionResourceLabel(itemId);

    const value = document.createElement("strong");
    value.className = "drug-production-slot__supply-value";
    value.textContent = `${getInventoryAmount("materials", itemId)}/${amount}`;

    pill.append(name, value);
    row.append(pill);
  }

  wrap.append(label, row);
  return wrap;
}

function createArmoryMaterialsRow(inputs = {}) {
  const row = document.createElement("div");
  row.className = "armory-slot__materials-row";

  for (const [itemId, amount] of Object.entries(inputs)) {
    const pill = document.createElement("div");
    pill.className = `armory-slot__material-pill ${itemId === "metal-parts" ? "armory-slot__material-pill--metal" : "armory-slot__material-pill--tech"}`;

    const name = document.createElement("span");
    name.className = "armory-slot__material-name";
    name.textContent = getProductionResourceLabel(itemId);

    const value = document.createElement("strong");
    value.className = "armory-slot__material-value";
    value.textContent = `${getInventoryAmount("materials", itemId)}/${amount}`;

    pill.append(name, value);
    row.append(pill);
  }

  return row;
}

function createProductionCard(buildingName, recipeId, recipeKey, recipe, rerender) {
  const job = getProductionJob(recipeKey);
  const buildingState = getStoredProductionBuildingState(buildingName);
  const durationMultiplier = getProductionBuildingMultiplier(buildingName, buildingState.level);
  const effectiveDurationMs = Math.max(1000, Math.round(recipe.durationMs / durationMultiplier));
  const slotState = getProductionSlotState(job);
  const canStart = !job && hasEnoughMaterials(recipe.inputs || {});
  const outputInventoryAmount = getInventoryAmount(recipe.output.inventory, recipe.output.itemId);
  const visual = PRODUCTION_SLOT_VISUALS[buildingName]?.[recipeId] || null;
  const card = document.createElement("article");
  const startButton = document.createElement("button");
  const collectButton = document.createElement("button");

  if (buildingName === "pharmacy") {
    card.className = [
      "pharmacy-slot",
      visual?.slotClass || "",
      slotState.isActive ? "pharmacy-slot--active" : "pharmacy-slot--idle"
    ].filter(Boolean).join(" ");

    const head = document.createElement("div");
    head.className = "pharmacy-slot__head";

    const titleLine = document.createElement("div");
    titleLine.className = "pharmacy-slot__title-line";

    const icon = document.createElement("span");
    icon.className = `pharmacy-slot__icon ${visual?.iconToneClass || "pharmacy-slot__icon--cyan"} ${visual?.iconGlyphClass || "pharmacy-slot__icon--flask"}`;
    icon.setAttribute("aria-hidden", "true");

    const titleWrap = document.createElement("div");
    titleWrap.className = "pharmacy-slot__title-wrap";
    const title = document.createElement("strong");
    title.className = "pharmacy-slot__title";
    title.textContent = recipe.name;
    const product = document.createElement("span");
    product.className = "pharmacy-slot__product";
    product.textContent = visual?.productLabel || "Materiál";
    titleWrap.append(title, product);
    titleLine.append(icon, titleWrap);

    const state = document.createElement("span");
    state.className = "pharmacy-slot__state";
    state.textContent = slotState.label;
    head.append(titleLine, state);

    const metrics = document.createElement("div");
    metrics.className = "pharmacy-slot__metrics";
    metrics.append(
      createPharmacyMetricBlock("Výstup", `${recipe.output.amount} ks`),
      createPharmacyMetricBlock("Čas", formatDurationLabel(effectiveDurationMs))
    );

    const actions = document.createElement("div");
    actions.className = "pharmacy-slot__actions";
    startButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--start";
    collectButton.className = "button pharmacy-slot__btn pharmacy-slot__btn--stop";
    actions.append(startButton, collectButton);
    card.append(head, metrics, actions);
  } else if (buildingName === "druglab") {
    card.className = slotState.isActive
      ? "drug-production-slot drug-production-slot--active"
      : "drug-production-slot";

    const head = document.createElement("div");
    head.className = "drug-production-slot__head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "drug-production-slot__title-wrap";
    const icon = document.createElement("span");
    icon.className = `drug-production-slot__icon ${visual?.iconToneClass || "drug-production-slot__icon--violet"} ${visual?.iconGlyphClass || "drug-production-slot__icon--crystal"}`;
    icon.setAttribute("aria-hidden", "true");

    const titles = document.createElement("div");
    titles.className = "drug-production-slot__titles";
    const product = document.createElement("span");
    product.className = "drug-production-slot__product";
    product.textContent = visual?.productLabel || "Drug balík";
    const title = document.createElement("strong");
    title.className = "drug-production-slot__title";
    title.textContent = recipe.name;
    titles.append(product, title);
    titleWrap.append(icon, titles);

    const state = document.createElement("span");
    state.className = "drug-production-slot__state";
    state.textContent = slotState.label;
    head.append(titleWrap, state);

    const metrics = document.createElement("div");
    metrics.className = "drug-production-slot__metrics";
    metrics.append(
      createMetricBlock({ label: "Výstup", value: `${recipe.output.amount} ks` }),
      createMetricBlock({ label: "Čas", value: formatDurationLabel(effectiveDurationMs) }),
      createMetricBlock({ label: "Ve skladu", value: `${outputInventoryAmount} ks`, inline: true }),
      createDrugSupplyRow(recipe.inputs || {})
    );

    const actions = document.createElement("div");
    actions.className = "drug-production-slot__controls";
    startButton.className = "button drug-lab-mini-btn";
    startButton.dataset.drugLabSlotStart = "true";
    collectButton.className = "button drug-lab-mini-btn";
    collectButton.dataset.drugLabSlotStop = "true";
    actions.append(startButton, collectButton);
    card.append(head, metrics, actions);
  } else {
    card.className = slotState.isActive
      ? "armory-slot drug-production-slot armory-slot--active drug-production-slot--active"
      : "armory-slot drug-production-slot";

    const head = document.createElement("div");
    head.className = "armory-slot__head drug-production-slot__head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "armory-slot__title-wrap drug-production-slot__title-wrap";
    const icon = document.createElement("span");
    icon.className = `drug-production-slot__icon ${visual?.iconToneClass || "drug-production-slot__icon--red"} ${visual?.iconGlyphClass || "drug-production-slot__icon--crosshair"}`;
    icon.setAttribute("aria-hidden", "true");

    const titles = document.createElement("div");
    titles.className = "drug-production-slot__titles";
    const product = document.createElement("span");
    product.className = "drug-production-slot__product";
    product.textContent = visual?.productLabel || "Výzbroj";
    const title = document.createElement("strong");
    title.className = "drug-production-slot__title";
    title.textContent = recipe.name;
    titles.append(product, title);
    titleWrap.append(icon, titles);

    const state = document.createElement("span");
    state.className = "drug-production-slot__state";
    state.textContent = slotState.label;
    head.append(titleWrap, state);

    const metrics = document.createElement("div");
    metrics.className = "drug-production-slot__metrics";
    metrics.append(
      createMetricBlock({ label: "Výstup", value: `${recipe.output.amount} ks` }),
      createMetricBlock({ label: "Čas", value: formatDurationLabel(effectiveDurationMs) }),
      createMetricBlock({ label: "Ve skladu", value: `${outputInventoryAmount} ks`, inline: true })
    );

    const supplyMetric = document.createElement("div");
    supplyMetric.className = "drug-production-slot__metric drug-production-slot__metric--supplies";
    const supplyLabel = document.createElement("span");
    supplyLabel.className = "drug-production-slot__metric-label";
    supplyLabel.textContent = "Materiál";
    supplyMetric.append(supplyLabel, createArmoryMaterialsRow(recipe.inputs || {}));
    metrics.append(supplyMetric);

    const actions = document.createElement("div");
    actions.className = "drug-production-slot__controls";
    startButton.className = "button drug-lab-mini-btn";
    startButton.dataset.armorySlotStart = "true";
    collectButton.className = "button drug-lab-mini-btn";
    collectButton.dataset.armorySlotStop = "true";
    actions.append(startButton, collectButton);
    card.append(head, metrics, actions);
  }

  startButton.type = "button";
  startButton.textContent = !job ? "Spustit" : job.status === "running" ? "Běží" : "Čeká";
  startButton.disabled = !canStart;
  startButton.addEventListener("click", () => {
    if (!hasEnoughMaterials(recipe.inputs || {})) {
      rerender();
      return;
    }

    consumeMaterials(recipe.inputs || {});
    persistProductionJob(recipeKey, {
      status: "running",
      readyAt: new Date(Date.now() + effectiveDurationMs).toISOString(),
      output: recipe.output
    });
    rerender();
    scheduleProductionJob(recipeKey, rerender);
  });

  collectButton.type = "button";
  collectButton.textContent = "Vybrat";
  collectButton.disabled = !job || job.status !== "ready";
  collectButton.addEventListener("click", () => {
    const currentJob = getProductionJob(recipeKey);

    if (!currentJob || currentJob.status !== "ready") {
      rerender();
      return;
    }

    applyInventoryOutput(currentJob.output);
    clearProductionJob(recipeKey);
    rerender();
  });

  if (job?.status === "running") {
    scheduleProductionJob(recipeKey, rerender);
  }

  return card;
}

function renderProductionPanel(root, panelName, recipes, rerender) {
  const mount = root.querySelector(`[data-production-panel=\"${panelName}\"]`);

  if (!mount) {
    return;
  }

  syncCompletedProductionJobs();
  mount.replaceChildren();

  const safeRerender = typeof rerender === "function"
    ? rerender
    : () => {
        renderProductionPanel(root, panelName, recipes);
      };

  for (const [recipeId, recipe] of Object.entries(recipes)) {
    mount.append(createProductionCard(panelName, recipeId, `${panelName}:${recipeId}`, recipe, safeRerender));
  }
}

function bindProductionBuildingPopup(root, {
  buildingName,
  openSelector,
  popupSelector,
  closeSelector,
  recipes
}) {
  const openButton = root.querySelector(openSelector);
  const popup = root.querySelector(popupSelector);
  const closeElements = Array.from(root.querySelectorAll(closeSelector));

  if (!openButton || !popup || closeElements.length === 0) {
    return;
  }

  const config = PRODUCTION_BUILDING_CONFIG[buildingName];
  const levelElement = popup.querySelector(PRODUCTION_BUILDING_LEVEL_SELECTOR);
  const headerLevelElement = popup.querySelector(PRODUCTION_BUILDING_HEADER_LEVEL_SELECTOR);
  const multiplierElement = popup.querySelector(PRODUCTION_BUILDING_MULTIPLIER_SELECTOR);
  const readyElement = popup.querySelector(PRODUCTION_BUILDING_READY_SELECTOR);
  const upgradeCostElement = popup.querySelector(PRODUCTION_BUILDING_UPGRADE_COST_SELECTOR);
  const effectsElement = popup.querySelector(PRODUCTION_BUILDING_EFFECTS_SELECTOR);
  const collectButton = popup.querySelector(PRODUCTION_BUILDING_COLLECT_SELECTOR);
  const upgradeButton = popup.querySelector(PRODUCTION_BUILDING_UPGRADE_SELECTOR);
  const infoTextElement = popup.querySelector(PRODUCTION_BUILDING_INFO_TEXT_SELECTOR);
  const infoEffectsElement = popup.querySelector(PRODUCTION_BUILDING_INFO_EFFECTS_SELECTOR);
  const infoActionsElement = popup.querySelector(PRODUCTION_BUILDING_INFO_ACTIONS_SELECTOR);
  const tabButtons = Array.from(popup.querySelectorAll(PRODUCTION_BUILDING_TAB_SELECTOR))
    .filter((button) => String(button.dataset.productionBuildingTab || "").startsWith(`${buildingName}:`));
  const panels = Array.from(popup.querySelectorAll(PRODUCTION_BUILDING_PANEL_SELECTOR))
    .filter((panel) => String(panel.dataset.productionBuildingPanel || "").startsWith(`${buildingName}:`));
  const maxLevel = 14;

  const setActiveTab = (tabName = "stats") => {
    for (const button of tabButtons) {
      const isActive = button.dataset.productionBuildingTab === `${buildingName}:${tabName}`;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.productionBuildingPanel !== `${buildingName}:${tabName}`;
    }
  };

  const renderDashboard = () => {
    syncCompletedProductionJobs();
    const state = getStoredProductionBuildingState(buildingName);
    const multiplier = getProductionBuildingMultiplier(buildingName, state.level);
    const readyCount = getProductionBuildingReadyCount(buildingName, recipes);
    const upgradeCost = state.level < maxLevel ? getProductionBuildingUpgradeCost(buildingName, state.level + 1) : 0;

    if (levelElement) {
      levelElement.textContent = String(state.level);
    }

    if (headerLevelElement) {
      headerLevelElement.textContent = `Lv ${state.level}`;
    }

    if (multiplierElement) {
      multiplierElement.textContent = `${multiplier.toFixed(2)}x`;
    }

    if (readyElement) {
      readyElement.textContent = `${readyCount}/${Object.keys(recipes || {}).length}`;
    }

    if (upgradeCostElement) {
      upgradeCostElement.textContent = state.level < maxLevel ? formatCurrency(upgradeCost) : "MAX";
    }

    if (effectsElement) {
      effectsElement.textContent = getProductionBuildingEffectsLabel(buildingName, state.level);
    }

    if (infoTextElement) {
      infoTextElement.textContent = config?.infoText || "";
    }

    if (infoEffectsElement) {
      infoEffectsElement.textContent = `${getProductionBuildingEffectsLabel(buildingName, state.level)} · ${readyCount} hotových receptů čeká na vyzvednutí.`;
    }

    if (infoActionsElement) {
      infoActionsElement.replaceChildren();
      for (const entry of config?.infoActions || []) {
        const item = document.createElement("li");
        item.textContent = entry;
        infoActionsElement.append(item);
      }
    }

    if (collectButton instanceof HTMLButtonElement) {
      collectButton.disabled = readyCount <= 0;
      collectButton.textContent = "+";
      const collectLabel = readyCount > 0
        ? `Vybrat hotové do skladu (${readyCount})`
        : "Vybrat hotové do skladu";
      collectButton.title = collectLabel;
      collectButton.setAttribute("aria-label", collectLabel);
    }

    if (upgradeButton instanceof HTMLButtonElement) {
      upgradeButton.disabled = state.level >= maxLevel;
      upgradeButton.textContent = state.level >= maxLevel ? "MAX" : "⇪";
      const upgradeLabel = state.level >= maxLevel
        ? "Max level"
        : `Upgrade budovy (${formatCurrency(upgradeCost)})`;
      upgradeButton.title = upgradeLabel;
      upgradeButton.setAttribute("aria-label", upgradeLabel);
    }

    renderProductionPanel(root, buildingName, recipes, renderDashboard);
  };

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const tabName = String(button.dataset.productionBuildingTab || "").split(":")[1] || "stats";
      setActiveTab(tabName);
    });
  }

  if (collectButton instanceof HTMLButtonElement) {
    collectButton.addEventListener("click", () => {
      const collected = collectReadyProductionForBuilding(buildingName, recipes);
      renderDashboard();

      if (collected <= 0) {
        setBuildingActionFeedback(root, "warning", config?.label || "Budova", "Není nic hotového k vyzvednutí.");
        return;
      }

      setBuildingActionFeedback(
        root,
        "success",
        config?.label || "Budova",
        `${config?.label || "Budova"} přesunula hotovou výrobu do skladu.`,
        `Vyzvednuto ${collected} ks · ${getProductionBuildingEffectsLabel(buildingName, getStoredProductionBuildingState(buildingName).level)}`
      );
    });
  }

  if (upgradeButton instanceof HTMLButtonElement) {
    upgradeButton.addEventListener("click", () => {
      const currentState = getStoredProductionBuildingState(buildingName);

      if (currentState.level >= maxLevel) {
        renderDashboard();
        return;
      }

      const nextLevel = currentState.level + 1;
      const upgradeCost = getProductionBuildingUpgradeCost(buildingName, nextLevel);
      const economyState = getResolvedEconomyState();

      if (economyState.cleanMoney < upgradeCost) {
        setBuildingActionFeedback(root, "warning", config?.label || "Budova", `Na upgrade chybí ${formatCurrency(upgradeCost - economyState.cleanMoney)}.`);
        renderDashboard();
        return;
      }

      setStoredEconomyState({
        ...economyState,
        cleanMoney: economyState.cleanMoney - upgradeCost
      });
      setStoredProductionBuildingState(buildingName, {
        level: nextLevel
      });
      applyTopbarEconomy(root);
      renderDashboard();
      setBuildingActionFeedback(
        root,
        "success",
        config?.label || "Budova",
        `${config?.label || "Budova"} byla upgradovaná na level ${nextLevel}.`,
        `${getProductionBuildingEffectsLabel(buildingName, nextLevel)}`
      );
    });
  }

  const openPopup = () => {
    setActiveTab("stats");
    renderDashboard();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });
}

function getInventoryAmount(inventoryName, itemId) {
  if (inventoryName === "materials") {
    const factorySupplyKey = getFactorySupplyKeyForMaterial(itemId);

    if (factorySupplyKey) {
      return getStoredFactorySupplies()[factorySupplyKey] ?? 0;
    }

    return getResolvedMaterialInventory()[itemId] ?? 0;
  }

  if (inventoryName === "drugs") {
    return getResolvedDrugInventory()[itemId] ?? 0;
  }

  if (inventoryName === "weapons") {
    return getResolvedWeaponInventory()[itemId] ?? 0;
  }

  return 0;
}

function setInventoryAmount(inventoryName, itemId, nextAmount) {
  if (inventoryName === "materials") {
    const factorySupplyKey = getFactorySupplyKeyForMaterial(itemId);

    if (factorySupplyKey) {
      const supplies = getStoredFactorySupplies();
      setStoredFactorySupplies({
        ...supplies,
        [factorySupplyKey]: Math.max(0, nextAmount)
      });
      return;
    }

    const inventory = getResolvedMaterialInventory();
    inventory[itemId] = Math.max(0, nextAmount);
    setStoredMaterialInventory(inventory);
    return;
  }

  if (inventoryName === "drugs") {
    const inventory = getResolvedDrugInventory();
    inventory[itemId] = Math.max(0, nextAmount);
    setStoredDrugInventory(inventory);
    return;
  }

  if (inventoryName === "weapons") {
    const inventory = getResolvedWeaponInventory();
    inventory[itemId] = Math.max(0, nextAmount);
    setStoredWeaponInventory(inventory);
  }
}

function createFactoryResourceMap(rawValue = {}, floorValues = true) {
  return FACTORY_RESOURCE_KEYS.reduce((accumulator, key) => {
    const amount = Number(rawValue?.[key] || 0);
    accumulator[key] = floorValues ? Math.max(0, Math.floor(amount)) : Math.max(0, amount);
    return accumulator;
  }, {});
}

function createFactoryPlayerSupplyMap(rawValue = {}) {
  return createFactoryResourceMap(rawValue, true);
}

function createFactoryDefaultSlot(slot, now = Date.now()) {
  return {
    id: slot.id,
    resourceKey: slot.resourceKey,
    mode: slot.mode,
    isProducing: true,
    producedAmount: 0,
    productionRemainder: 0,
    slotCap: FACTORY_SLOT_STORAGE_CAP,
    lastTick: now
  };
}

function createFactoryDefaultState(now = Date.now()) {
  return {
    level: 1,
    resources: createFactoryResourceMap(),
    slots: FACTORY_SLOT_CONFIG.map((slot) => createFactoryDefaultSlot(slot, now)),
    updatedAt: now
  };
}

function sanitizeFactoryState(rawState, now = Date.now()) {
  const fallback = createFactoryDefaultState(now);
  return {
    ...fallback,
    ...(rawState || {}),
    level: Math.max(1, Math.min(FACTORY_CONFIG.maxLevel, Math.floor(Number(rawState?.level || 1)))),
    resources: createFactoryResourceMap(rawState?.resources),
    slots: FACTORY_SLOT_CONFIG.map((slot, index) => {
      const source = Array.isArray(rawState?.slots) ? rawState.slots[index] : null;
      return {
        ...createFactoryDefaultSlot(slot, now),
        ...(source || {}),
        id: slot.id,
        resourceKey: slot.resourceKey,
        mode: slot.mode,
        isProducing: source?.isProducing !== false,
        producedAmount: Math.max(0, Math.floor(Number(source?.producedAmount || 0))),
        productionRemainder: Math.max(0, Number(source?.productionRemainder || 0)),
        slotCap: FACTORY_SLOT_STORAGE_CAP,
        lastTick: Math.max(0, Math.floor(Number(source?.lastTick || now)))
      };
    }),
    updatedAt: Math.max(0, Math.floor(Number(rawState?.updatedAt || now)))
  };
}

function getStoredFactoryState() {
  return sanitizeFactoryState(getAuthoritySession().production.factory);
}

function setStoredFactoryState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      factory: sanitizeFactoryState(payload)
    }
  }));
}

function getStoredFactorySupplies() {
  return createFactoryPlayerSupplyMap(getAuthoritySession().inventory.factorySupplies);
}

function setStoredFactorySupplies(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      factorySupplies: createFactoryPlayerSupplyMap(payload)
    }
  }));
}

function getFactoryUpgradeCost(level) {
  const safeLevel = Math.max(2, Math.min(FACTORY_CONFIG.maxLevel, Math.floor(Number(level) || 1)));
  const rawCost = 5000 * Math.pow(1.47, safeLevel - 2);
  return Math.max(1000, Math.round(rawCost / 100) * 100);
}

function getFactoryLevelMultiplier(level) {
  const safeLevel = Math.max(1, Math.min(FACTORY_CONFIG.maxLevel, Math.floor(Number(level) || 1)));
  return 1 + (safeLevel - 1) * FACTORY_CONFIG.upgradePctPerLevel;
}

function calculateFactoryProductionRates(levelMultiplier = 1) {
  const multiplier = Math.max(0, Number(levelMultiplier) || 0);
  return {
    metalPartsPerHour: FACTORY_CONFIG.baseProductionPerHour.metalParts * multiplier,
    techCorePerHour: FACTORY_CONFIG.baseProductionPerHour.techCore * multiplier,
    combatModulePerHour: ((60 * 60 * 1000) / FACTORY_CONFIG.combatModule.durationMs) * multiplier
  };
}

function syncFactoryProduction(instanceState, now = Date.now(), options = {}) {
  const stateRef = sanitizeFactoryState(instanceState, now);
  const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
  const ownedFactoryCount = Math.max(1, Math.floor(Number(options?.ownedFactoryCount || 1)));
  const networkProductionBonusPct = Math.max(0, Number(options?.networkProductionBonusPct ?? ((ownedFactoryCount - 1) * 10)) || 0);
  const levelMultiplier = getFactoryLevelMultiplier(stateRef.level);
  const effectiveProductionMultiplier = Math.max(0.1, levelMultiplier * (1 + networkProductionBonusPct / 100));
  const rates = calculateFactoryProductionRates(effectiveProductionMultiplier);
  const produced = createFactoryResourceMap({}, false);

  stateRef.slots.forEach((slot) => {
    let from = Number(slot.lastTick || nowMs);
    if (!Number.isFinite(from) || from > nowMs) {
      from = nowMs;
    }
    if (!slot.isProducing) {
      slot.lastTick = nowMs;
      return;
    }
    const elapsedMs = Math.max(0, nowMs - from);
    if (elapsedMs <= 0) {
      slot.lastTick = nowMs;
      return;
    }
    if (slot.mode === "craft" || slot.resourceKey === "combatModule") {
      const scaledDurationMs = Math.max(1, Math.round(FACTORY_CONFIG.combatModule.durationMs / effectiveProductionMultiplier));
      const cycleRaw = elapsedMs / scaledDurationMs + Number(slot.productionRemainder || 0);
      const cycles = Math.max(0, Math.floor(cycleRaw));
      slot.productionRemainder = Math.max(0, cycleRaw - cycles);
      if (cycles > 0) {
        const maxFromMetal = Math.floor(Number(stateRef.resources.metalParts || 0) / FACTORY_CONFIG.combatModule.metalPartsCost);
        const maxFromTech = Math.floor(Number(stateRef.resources.techCore || 0) / FACTORY_CONFIG.combatModule.techCoreCost);
        const crafted = Math.max(0, Math.min(cycles, maxFromMetal, maxFromTech));
        if (crafted > 0) {
          const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
          const slotSpace = Math.max(0, FACTORY_SLOT_STORAGE_CAP - currentAmount);
          const storable = Math.min(crafted, slotSpace);
          stateRef.resources.metalParts = Math.max(0, Math.floor(Number(stateRef.resources.metalParts || 0) - crafted * FACTORY_CONFIG.combatModule.metalPartsCost));
          stateRef.resources.techCore = Math.max(0, Math.floor(Number(stateRef.resources.techCore || 0) - crafted * FACTORY_CONFIG.combatModule.techCoreCost));
          stateRef.resources.combatModule = Math.max(0, Math.floor(Number(stateRef.resources.combatModule || 0) + crafted));
          slot.producedAmount = Math.max(0, currentAmount + storable);
          produced.combatModule = Math.max(0, Math.floor(Number(produced.combatModule || 0) + crafted));
        }
      }
    } else {
      const perHour = slot.resourceKey === "metalParts" ? rates.metalPartsPerHour : rates.techCorePerHour;
      const raw = (elapsedMs / 3600000) * Math.max(0, Number(perHour || 0)) + Number(slot.productionRemainder || 0);
      const gained = Math.max(0, Math.floor(raw));
      slot.productionRemainder = Math.max(0, raw - gained);
      if (gained > 0) {
        const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
        const slotSpace = Math.max(0, FACTORY_SLOT_STORAGE_CAP - currentAmount);
        const storable = Math.min(gained, slotSpace);
        slot.producedAmount = Math.max(0, currentAmount + storable);
        stateRef.resources[slot.resourceKey] = Math.max(0, Math.floor(Number(stateRef.resources[slot.resourceKey] || 0) + gained));
        produced[slot.resourceKey] = Math.max(0, Math.floor(Number(produced[slot.resourceKey] || 0) + gained));
      }
    }
    slot.lastTick = nowMs;
  });

  stateRef.updatedAt = nowMs;
  return {
    state: stateRef,
    rates,
    produced,
    ownedFactoryCount,
    networkProductionBonusPct,
    productionMultiplier: effectiveProductionMultiplier
  };
}

function getFactoryActiveBoost(now = Date.now()) {
  const factoryState = getStoredFactoryState();
  const activeBoost = factoryState.boosts?.active || null;
  if (!activeBoost?.type || !activeBoost?.expiresAt) {
    return null;
  }
  const expiresAt = new Date(activeBoost.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    setStoredFactoryState({
      ...factoryState,
      boosts: { active: null },
      updatedAt: now
    });
    return null;
  }
  return activeBoost;
}

function clearFactoryActiveBoost() {
  const factoryState = getStoredFactoryState();
  setStoredFactoryState({
    ...factoryState,
    boosts: { active: null },
    updatedAt: Date.now()
  });
}

function activateFactoryBoost(boostType) {
  const boostConfig = FACTORY_COMBAT_BOOSTS[boostType];
  if (!boostConfig) {
    return { ok: false, reason: "Neznámý boost." };
  }
  const supplies = getStoredFactorySupplies();
  const currentModules = Math.max(0, Math.floor(Number(supplies.combatModule || 0)));
  if (currentModules < boostConfig.combatModuleCost) {
    return { ok: false, reason: `Chybí ${boostConfig.combatModuleCost - currentModules} Combat Module.` };
  }

  setStoredFactorySupplies({
    ...supplies,
    combatModule: currentModules - boostConfig.combatModuleCost
  });

  const factoryState = getStoredFactoryState();
  setStoredFactoryState({
    ...factoryState,
    boosts: {
      active: {
        type: boostType,
        label: boostConfig.label,
        expiresAt: new Date(Date.now() + boostConfig.durationMs).toISOString(),
        config: boostConfig
      }
    },
    updatedAt: Date.now()
  });

  return { ok: true, boost: boostConfig };
}

function getStoredPharmacyBoostState() {
  const state = getAuthoritySession().production?.pharmacyBoosts;
  return {
    effects: {
      reconUntil: Number(state?.effects?.reconUntil || 0),
      actionUntil: Number(state?.effects?.actionUntil || 0),
      neuroUntil: Number(state?.effects?.neuroUntil || 0),
      neuroCrashUntil: Number(state?.effects?.neuroCrashUntil || 0)
    },
    cooldowns: {
      recon: Number(state?.cooldowns?.recon || 0),
      action: Number(state?.cooldowns?.action || 0),
      neuro: Number(state?.cooldowns?.neuro || 0)
    }
  };
}

function setStoredPharmacyBoostState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      pharmacyBoosts: payload
    }
  }));
}

function getPharmacyBoostSnapshot(now = Date.now()) {
  const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
  const state = getStoredPharmacyBoostState();
  const activeEffects = [];
  const totals = {
    spySpeedPct: 0,
    infoQualityPct: 0,
    attackSpeedPct: 0,
    stealSpeedPct: 0,
    activeActionsPct: 0
  };
  const counts = {
    recon: 0,
    action: 0,
    neuro: 0
  };
  const drugInventory = getStoredDrugInventory();

  const reconRemaining = Math.max(0, Number(state.effects.reconUntil || 0) - nowMs);
  if (reconRemaining > 0) {
    counts.recon += 1;
    totals.spySpeedPct += 50;
    totals.infoQualityPct += 30;
    activeEffects.push({ type: "recon", remainingMs: reconRemaining });
  }

  const actionRemaining = Math.max(0, Number(state.effects.actionUntil || 0) - nowMs);
  if (actionRemaining > 0) {
    counts.action += 1;
    totals.attackSpeedPct += 25;
    totals.stealSpeedPct += 25;
    activeEffects.push({ type: "action", remainingMs: actionRemaining });
  }

  const neuroRemaining = Math.max(0, Number(state.effects.neuroUntil || 0) - nowMs);
  if (neuroRemaining > 0) {
    counts.neuro += 1;
    totals.activeActionsPct += 20;
    activeEffects.push({ type: "neuro", remainingMs: neuroRemaining });
  } else {
    const neuroCrashRemaining = Math.max(0, Number(state.effects.neuroCrashUntil || 0) - nowMs);
    if (neuroCrashRemaining > 0) {
      totals.activeActionsPct -= 10;
      activeEffects.push({ type: "crash", remainingMs: neuroCrashRemaining });
    }
  }

  return {
    activeCount: activeEffects.length,
    activeEffects,
    counts,
    drugInventory: {
      ghostSerum: Math.max(0, Math.floor(Number(drugInventory["ghost-serum"] || 0))),
      overdriveX: Math.max(0, Math.floor(Number(drugInventory["overdrive-x"] || 0)))
    },
    bonuses: { ...totals },
    effective: {
      spySpeedPct: totals.spySpeedPct + totals.activeActionsPct,
      infoQualityPct: totals.infoQualityPct,
      attackSpeedPct: totals.attackSpeedPct + totals.activeActionsPct,
      stealSpeedPct: totals.stealSpeedPct + totals.activeActionsPct,
      activeActionsPct: totals.activeActionsPct
    }
  };
}

function usePharmacyBoost(boostType, now = Date.now()) {
  const type = String(boostType || "").trim().toLowerCase();
  const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
  const state = getStoredPharmacyBoostState();
  const inventory = getStoredDrugInventory();
  const config = type === "recon"
    ? { resourceKey: "ghost-serum", resourceLabel: "Ghost Serum", drugCost: 1, cooldownKey: "recon", effectKey: "reconUntil" }
    : type === "action"
      ? { resourceKey: "ghost-serum", resourceLabel: "Ghost Serum", drugCost: 1, cooldownKey: "action", effectKey: "actionUntil" }
      : type === "neuro"
        ? { resourceKey: "overdrive-x", resourceLabel: "Overdrive X", drugCost: 1, cooldownKey: "neuro", effectKey: "neuroUntil", heatAdded: 3 }
        : null;

  if (!config) {
    return { ok: false, message: "Neznámý boost." };
  }

  const cooldownLeft = Math.max(0, Number(state.cooldowns[config.cooldownKey] || 0) - nowMs);
  if (cooldownLeft > 0) {
    return { ok: false, message: `${config.resourceLabel} boost je na cooldownu (${formatDurationLabel(cooldownLeft)}).` };
  }

  const available = Math.max(0, Math.floor(Number(inventory[config.resourceKey] || 0)));
  if (available < config.drugCost) {
    return { ok: false, message: `Nedostatek ${config.resourceLabel} (${available}/${config.drugCost}).` };
  }

  setStoredDrugInventory({
    ...inventory,
    [config.resourceKey]: available - config.drugCost
  });

  setStoredPharmacyBoostState({
    effects: {
      ...state.effects,
      [config.effectKey]: nowMs + (2 * 60 * 60 * 1000),
      actionUntil: type === "recon"
        ? nowMs + (2 * 60 * 60 * 1000)
        : state.effects.actionUntil,
      neuroCrashUntil: type === "neuro"
        ? nowMs + (2 * 60 * 60 * 1000) + (60 * 60 * 1000)
        : state.effects.neuroCrashUntil
    },
    cooldowns: {
      ...state.cooldowns,
      [config.cooldownKey]: nowMs + (2 * 60 * 60 * 1000),
      action: type === "recon"
        ? nowMs + (2 * 60 * 60 * 1000)
        : state.cooldowns.action
    }
  });

  return {
    ok: true,
    message: `${config.resourceLabel} boost aktivní na ${formatDurationLabel(2 * 60 * 60 * 1000)}. Spotřeba ${config.drugCost} ks.${config.heatAdded ? ` Heat +${config.heatAdded}.` : ""}`,
    heatAdded: Number(config.heatAdded || 0)
  };
}

function getFactoryBoostSnapshot(now = Date.now()) {
  const activeBoost = getFactoryActiveBoost(now);
  const supplies = getStoredFactorySupplies();
  const effective = {
    attackPowerPct: 0,
    attackSpeedPct: 0,
    raidSpeedPct: 0,
    destroyBuildingChancePct: 0,
    defenseIgnorePct: 0,
    defensePenaltyPct: 0,
    policeInterventionRiskPct: 0
  };
  const activeEffects = [];

  if (activeBoost?.type) {
    const config = activeBoost.config || FACTORY_COMBAT_BOOSTS[activeBoost.type] || {};
    effective.attackPowerPct = Number(config.attackPowerPct || 0);
    effective.attackSpeedPct = Number(config.attackSpeedPct || 0);
    effective.raidSpeedPct = Number(config.raidSpeedPct || 0);
    effective.destroyBuildingChancePct = Number(config.destroyBuildingChancePct || 0);
    effective.defenseIgnorePct = Number(config.defenseIgnorePct || 0);
    effective.defensePenaltyPct = Number(config.defensePenaltyPct || 0);
    effective.policeInterventionRiskPct = Number(config.policeInterventionRiskPct || 0);
    activeEffects.push({
      type: activeBoost.type,
      remainingMs: Math.max(0, new Date(activeBoost.expiresAt).getTime() - Date.now())
    });
  }

  return {
    activeCount: activeEffects.length,
    activeEffects,
    supplies: {
      metalParts: Math.max(0, Math.floor(Number(supplies.metalParts || 0))),
      techCore: Math.max(0, Math.floor(Number(supplies.techCore || 0))),
      combatModule: Math.max(0, Math.floor(Number(supplies.combatModule || 0)))
    },
    bonuses: { ...effective },
    effective
  };
}

function getAttackActionDurationMs(baseMs = ATTACK_COOLDOWN_MS) {
  const snapshot = getPharmacyBoostSnapshot();
  const speedPct = Number(snapshot.effective.attackSpeedPct || 0);
  return Math.max(1000, Math.round(baseMs * (1 - speedPct / 100)));
}

function getSpyActionDurationMs(baseMs = SPY_COOLDOWN_MS) {
  const snapshot = getPharmacyBoostSnapshot();
  const speedPct = Number(snapshot.effective.spySpeedPct || 0);
  return Math.max(1000, Math.round(baseMs * (1 - speedPct / 100)));
}

function getRobberyActionDurationMs(baseMs = ROBBERY_COOLDOWN_MS) {
  const factorySnapshot = getFactoryBoostSnapshot();
  const pharmacySnapshot = getPharmacyBoostSnapshot();
  const speedPct = Number(factorySnapshot.effective.raidSpeedPct || 0) + Number(pharmacySnapshot.effective.stealSpeedPct || 0);
  return Math.max(1000, Math.round(baseMs * (1 - speedPct / 100)));
}

function resolveSpyScenarioWithBoost(mission) {
  const baseScenario = resolveSpyScenario(mission);
  const intelQualityPct = Math.max(0, Math.floor(Number(mission?.intelQualityPct || 0)));

  if (intelQualityPct < 30) {
    return baseScenario;
  }

  if (baseScenario === "Neúspěch") {
    return "Částečný úspěch";
  }

  if (baseScenario === "Částečný úspěch") {
    return "Úspěch";
  }

  return baseScenario;
}

function getFactoryAttackBoostContext({ attackPower, defensePower } = {}) {
  const activeBoost = getFactoryActiveBoost();
  const pharmacySnapshot = getPharmacyBoostSnapshot();
  const normalizedAttackPower = Math.max(0, Math.round(Number(attackPower || 0)));
  const normalizedDefensePower = Math.max(0, Math.round(Number(defensePower || 0)));
  const context = {
    activeBoost: activeBoost || null,
    effectiveAttackPower: normalizedAttackPower,
    effectiveDefensePower: normalizedDefensePower,
    cooldownMs: getAttackActionDurationMs(ATTACK_COOLDOWN_MS),
    summaryLabel: ""
  };

  if (!activeBoost?.type) {
    return context;
  }

  const config = activeBoost.config || FACTORY_COMBAT_BOOSTS[activeBoost.type] || null;

  if (!config) {
    if (Number(pharmacySnapshot.effective.attackSpeedPct || 0) > 0) {
      context.summaryLabel = `Pharmacy boost: útok dorazí za ${Math.ceil(context.cooldownMs / 1000)}s`;
    }
    return context;
  }

  if (config.attackPowerPct) {
    context.effectiveAttackPower = Math.max(
      0,
      Math.round(normalizedAttackPower * (1 + Number(config.attackPowerPct || 0) / 100))
    );
  }

  if (config.defenseIgnorePct) {
    context.effectiveDefensePower = Math.max(
      0,
      Math.round(normalizedDefensePower * (1 - Number(config.defenseIgnorePct || 0) / 100))
    );
  }

  const totalAttackSpeedPct = Number(config.attackSpeedPct || 0) + Number(pharmacySnapshot.effective.attackSpeedPct || 0);
  if (totalAttackSpeedPct) {
    context.cooldownMs = Math.max(1000, Math.round(ATTACK_COOLDOWN_MS * (1 - totalAttackSpeedPct / 100)));
  }

  context.summaryLabel = activeBoost.type === "assault"
    ? `Boost ${config.label}: síla útoku +${config.attackPowerPct}%`
    : activeBoost.type === "rapid"
      ? `Boost ${config.label}: útok dorazí za ${Math.ceil(context.cooldownMs / 1000)}s`
      : activeBoost.type === "breach"
        ? `Boost ${config.label}: obrana cíle -${config.defenseIgnorePct}%`
        : `Boost ${config.label}`;

  return context;
}

function bindMarketPopup(root) {
  const openButton = root.querySelector(MARKET_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(MARKET_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(MARKET_POPUP_CLOSE_SELECTOR));
  const tabs = Array.from(root.querySelectorAll(MARKET_TAB_SELECTOR));
  const copyElement = root.querySelector(MARKET_COPY_SELECTOR);
  const listElement = root.querySelector(MARKET_LIST_SELECTOR);

  if (!openButton || !popup || closeElements.length === 0 || !copyElement || !listElement || tabs.length === 0) {
    return;
  }

  let activeTab = "market";

  const renderMarketTab = () => {
    const priceState = refreshMarketPricesIfNeeded(false);
    const tabConfig = MARKET_TAB_CONFIG[activeTab] || MARKET_TAB_CONFIG.market;
    copyElement.textContent = `${tabConfig.copy} Další změna cen za ${getMarketRefreshCountdownSeconds()} s.`;
    listElement.replaceChildren();

    for (const item of tabConfig.items) {
      const amount = getInventoryAmount(item.inventory, item.itemId);
      const priceEntry = priceState.items[getMarketPriceKey(activeTab, item.itemId)] || {
        price: item.price,
        previousPrice: item.price
      };
      const delta = priceEntry.price - priceEntry.previousPrice;
      const row = document.createElement("div");
      row.className = "market-popup-row";

      const info = document.createElement("div");
      info.className = "market-popup-row__info";

      const name = document.createElement("strong");
      name.className = "market-popup-row__name";
      name.textContent = item.name;

      const meta = document.createElement("span");
      meta.className = "market-popup-row__meta";
      meta.textContent = `Sklad ${amount} ks · ${priceEntry.price}$ / ks`;

      const trend = document.createElement("span");
      trend.className = "market-popup-row__trend";
      trend.dataset.marketTrend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      trend.textContent = delta > 0
        ? `▲ +${delta}$`
        : delta < 0
          ? `▼ ${delta}$`
          : "• beze změny";

      info.append(name, meta, trend);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "button market-popup-row__sell";
      action.textContent = "Prodat vše";
      action.disabled = amount <= 0;
      action.addEventListener("click", () => {
        const currentAmount = getInventoryAmount(item.inventory, item.itemId);

        if (currentAmount <= 0) {
          renderMarketTab();
          return;
        }

        setInventoryAmount(item.inventory, item.itemId, 0);
        const economy = getResolvedEconomyState();
        const payoutKey = tabConfig.payout;
        const nextEconomy = {
          ...economy,
          [payoutKey]: economy[payoutKey] + currentAmount * priceEntry.price
        };
        setStoredEconomyState(nextEconomy);
        applyTopbarEconomy(root);
        renderMarketTab();
      });

      row.append(info, action);
      listElement.append(row);
    }

    for (const tab of tabs) {
      tab.classList.toggle("is-active", tab.dataset.marketTab === activeTab);
    }
  };

  const openPopup = () => {
    renderMarketTab();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      if (!tab.dataset.marketTab) {
        return;
      }

      activeTab = tab.dataset.marketTab;
      renderMarketTab();
    });
  }

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  const scheduleMarketRefresh = () => {
    if (marketPriceTimerId !== null) {
      window.clearTimeout(marketPriceTimerId);
    }

    const state = getResolvedMarketPriceState();
    const delay = Math.max(250, new Date(state.nextRefreshAt).getTime() - Date.now());

    marketPriceTimerId = window.setTimeout(() => {
      refreshMarketPricesIfNeeded(true);
      if (!popup.hidden) {
        renderMarketTab();
      }
      scheduleMarketRefresh();
    }, delay);
  };

  scheduleMarketRefresh();
}

function collectMounts(root) {
  return Array.from(root.querySelectorAll(MOUNT_SELECTOR))
    .filter((element) => element !== root)
    .map((element) => ({
      id: element.id,
      role: element.dataset.mountRole || "generic",
      node: element
    }));
}

function createPageContext(root) {
  const mounts = collectMounts(root);
  const mountsByRole = Object.fromEntries(
    mounts.map((mount) => [mount.role, mount.node])
  );

  return {
    name: root.dataset.page || "unknown",
    root,
    mounts,
    mountsByRole
  };
}

function markMounts(context) {
  for (const mount of context.mounts) {
    mount.node.dataset.mountReady = "true";
  }
}

function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashCell(rowIndex, columnIndex) {
  let value = (rowIndex + 1) * 374761393 + (columnIndex + 1) * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  return (value ^ (value >> 16)) >>> 0;
}

function isDowntownCell(rowIndex, columnIndex) {
  const isDowntownRow = rowIndex === 3 || rowIndex === 4;
  const isDowntownColumn = columnIndex >= 9 && columnIndex <= 12;
  return isDowntownRow && isDowntownColumn;
}

function createDistrictTypeGrid(rows, columns) {
  const districtTypes = ["resident", "industrial", "economy", "park"];
  const grid = Array.from({ length: rows }, () => Array(columns).fill(null));
  const counts = Object.fromEntries(districtTypes.map((type) => [type, 0]));
  const targetCount = Math.floor(((rows * columns) - 8) / districtTypes.length);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      if (isDowntownCell(rowIndex, columnIndex)) {
        grid[rowIndex][columnIndex] = "downtown";
        continue;
      }

      const neighborOffsets = [
        [0, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1],
        [0, -2],
        [-2, 0]
      ];
      const scoredTypes = districtTypes.map((type) => {
        let score = counts[type] > targetCount ? 3 : 0;

        for (const [rowOffset, columnOffset] of neighborOffsets) {
          const neighborRow = rowIndex + rowOffset;
          const neighborColumn = columnIndex + columnOffset;
          const neighborType = grid[neighborRow]?.[neighborColumn];

          if (neighborType !== type) {
            continue;
          }

          if (rowOffset === 0 && Math.abs(columnOffset) === 1) {
            score += 14;
          } else if (Math.abs(rowOffset) === 1 && Math.abs(columnOffset) <= 1) {
            score += 11;
          } else {
            score += 5;
          }
        }

        score += (hashCell(rowIndex + counts[type] + 31, columnIndex + type.length + 17) % 7) * 0.1;
        return { type, score };
      });

      scoredTypes.sort((left, right) => left.score - right.score);
      const chosenType = scoredTypes[0].type;
      grid[rowIndex][columnIndex] = chosenType;
      counts[chosenType] += 1;
    }
  }

  return grid;
}

const DISTRICT_TYPE_GRID = createDistrictTypeGrid(7, 23);
const START_PHASE_OWNER_COORDINATES = [
  [0, 1], [0, 6], [0, 11], [0, 16], [0, 21],
  [1, 3], [1, 9], [1, 15],
  [2, 1], [2, 7], [2, 18],
  [3, 4], [3, 18],
  [4, 2], [4, 20],
  [5, 5], [5, 11], [5, 17],
  [6, 7], [6, 15]
];
const START_PHASE_PLAYER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#06b6d4",
  "#a21caf",
  "#7f1d1d",
  "#6b8e23",
  "#84cc16",
  "#a7f3d0",
  "#fa8072",
  "#ff7f50",
  "#ffd700",
  "#c0c0c0",
  "#f5f5dc",
  "#8b4513",
  "#111111",
  "#ffffff",
  "#9ca3af",
  "#4f46e5",
  "#0f52ba",
  "#50c878",
  "#dc143c",
  "#e6e6fa",
  "#ffdab9",
  "#36454f"
];
const START_PHASE_PLAYER_NAMES = [
  "NeonRaven",
  "GhostByte",
  "ViperHex",
  "BlazeZero",
  "KnoxFlux",
  "JaxCircuit",
  "ShadowGrid",
  "MaddoxChrome",
  "AxelPulse",
  "ReaperNova",
  "DrakeVoid",
  "StrykerWave",
  "ZaneCipher",
  "HunterGlitch",
  "PhoenixRay",
  "RykerStatic",
  "DexVector",
  "ColtNeon",
  "AceSignal",
  "OnyxDrive"
];
const CURRENT_PLAYER_ID = 1;
const LAUNCH_PLAYER_FACTION_ORDER = Object.freeze([
  "mafian",
  "kartel",
  "kult",
  "tajna-organizace",
  "hackeri",
  "motorkarsky-gang",
  "soukroma-armada",
  "korporace"
]);
const LAUNCH_PLAYER_AVATAR_BY_FACTION_ID = Object.freeze({
  mafian: "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
  kartel: "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
  kult: "../img/avatars/polucnigang/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
  "tajna-organizace": "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
  hackeri: "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
  "motorkarsky-gang": "../img/avatars/Motogang/grok_image_1773621173474.jpg",
  "soukroma-armada": "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
  korporace: "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg"
});

function createLaunchOwnerMap() {
  const ownerMap = new Map();

  for (let index = 0; index < START_PHASE_OWNER_COORDINATES.length; index += 1) {
    const [rowIndex, columnIndex] = START_PHASE_OWNER_COORDINATES[index];
    const rawDistrictId = rowIndex * 23 + columnIndex + 1;
    ownerMap.set(remapDistrictId(rawDistrictId), index + 1);
  }

  return ownerMap;
}

const START_PHASE_OWNER_BY_DISTRICT_ID = createLaunchOwnerMap();

function getLaunchPlayerColor(ownerId) {
  return getPlayerDistrictColor(ownerId);
}

function getLaunchPlayerName(ownerId) {
  return START_PHASE_PLAYER_NAMES[(ownerId - 1) % START_PHASE_PLAYER_NAMES.length] || `Player ${ownerId}`;
}

function getLaunchPlayerFactionId(ownerId) {
  if (Number(ownerId) === CURRENT_PLAYER_ID) {
    const registration = getStoredRegistration();
    if (registration?.factionId) {
      return registration.factionId;
    }
  }

  return LAUNCH_PLAYER_FACTION_ORDER[(Number(ownerId) - 1) % LAUNCH_PLAYER_FACTION_ORDER.length] || "mafian";
}

function getLaunchPlayerAvatar(ownerId) {
  if (Number(ownerId) === CURRENT_PLAYER_ID) {
    const registration = getStoredRegistration();
    if (registration?.avatar) {
      return String(registration.avatar).trim();
    }
  }

  const factionId = getLaunchPlayerFactionId(ownerId);
  return LAUNCH_PLAYER_AVATAR_BY_FACTION_ID[factionId] || LAUNCH_PLAYER_AVATAR_BY_FACTION_ID.mafian;
}

function getCurrentPlayerLaunchStartDistrictId() {
  for (const [districtId, ownerId] of START_PHASE_OWNER_BY_DISTRICT_ID.entries()) {
    if (Number(ownerId) === CURRENT_PLAYER_ID) {
      return Number(districtId) || null;
    }
  }

  const fallbackOwnedDistrictIds = getResolvedWorldState().ownedDistrictIds || [];
  return Number(fallbackOwnedDistrictIds[0] || 0) || null;
}

function getLaunchPlayerLabel(ownerId) {
  return ownerId === CURRENT_PLAYER_ID ? "TY" : `P${ownerId}`;
}

function getDistrictOwnerLabel(district, interactionState = {}) {
  if (interactionState.destroyedDistrictIds?.has(district.id)) {
    return "Zničený";
  }

  const launchOwnerId = (interactionState.gamePhase || "launch") === "launch"
    ? interactionState.launchOwnerByDistrictId?.get(district.id)
    : null;

  if (launchOwnerId) {
    return launchOwnerId === CURRENT_PLAYER_ID ? "TY" : getLaunchPlayerName(launchOwnerId);
  }

  const ownedDistrictIds = interactionState.ownedDistrictIds || new Set();
  return ownedDistrictIds.has(district.id) ? "TY" : "Neobsazeno";
}

function classifyDistrictType(rowIndex, columnIndex) {
  return DISTRICT_TYPE_GRID[rowIndex]?.[columnIndex] || "resident";
}

function getEffectiveOwnedDistrictIds(interactionState = {}) {
  const ownedDistrictIds = new Set(interactionState.ownedDistrictIds || []);

  if ((interactionState.gamePhase || "launch") === "launch") {
    const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;

    for (const districtId of launchOwnerByDistrictId.keys()) {
      ownedDistrictIds.add(Number(districtId));
    }
  }

  return ownedDistrictIds;
}

function getCurrentPlayerOwnedDistrictIds(interactionState = {}) {
  const ownedDistrictIds = new Set(interactionState.ownedDistrictIds || []);

  if ((interactionState.gamePhase || "launch") === "launch") {
    const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;

    for (const [districtId, ownerId] of launchOwnerByDistrictId.entries()) {
      if (ownerId === CURRENT_PLAYER_ID) {
        ownedDistrictIds.add(Number(districtId));
      }
    }
  }

  return ownedDistrictIds;
}

let districtResourceCatalogCache = null;

function getDistrictResourceCatalog() {
  if (Array.isArray(districtResourceCatalogCache)) {
    return districtResourceCatalogCache;
  }

  const rowCount = DISTRICT_TYPE_GRID.length;
  const columnCount = DISTRICT_TYPE_GRID[0]?.length || 0;
  const typeByDistrictId = new Map();
  const districts = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const rawDistrictId = rowIndex * columnCount + columnIndex + 1;
      typeByDistrictId.set(rawDistrictId, DISTRICT_TYPE_GRID[rowIndex]?.[columnIndex] || "resident");
    }
  }

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const rawDistrictId = rowIndex * columnCount + columnIndex + 1;
      districts.push({
        id: remapDistrictId(rawDistrictId),
        rowIndex,
        columnIndex,
        districtType: remapDistrictType(rawDistrictId, typeByDistrictId)
      });
    }
  }

  districtResourceCatalogCache = districts;
  return districts;
}

function isDistrictTypeVisible(district, interactionState = {}) {
  if (!district) {
    return false;
  }

  if (interactionState.destroyedDistrictIds?.has(district.id)) {
    return true;
  }

  if (district.districtType === "downtown") {
    return true;
  }

  const spyIntel = getResolvedSpyIntel();
  if (spyIntel.revealedTypeDistrictIds.includes(Number(district.id))) {
    return true;
  }

  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);

  if (currentPlayerOwnedDistrictIds.has(Number(district.id))) {
    return true;
  }

  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;
  const launchOwnerId = launchOwnerByDistrictId?.get(district.id);

  if (launchOwnerId && launchOwnerId !== CURRENT_PLAYER_ID) {
    return false;
  }

  if ((interactionState.gamePhase || "launch") !== "launch") {
    return true;
  }

  const revealedDistrictIds = interactionState.revealedDistrictIds || new Set();
  const ownedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  return revealedDistrictIds.has(district.id) || ownedDistrictIds.has(district.id);
}

function isDistrictTypeHidden(district, interactionState = {}) {
  return !isDistrictTypeVisible(district, interactionState);
}

const DISTRICT_ATMOSPHERE_META = Object.freeze({
  resident: {
    typeKey: "resident",
    label: "Rezidenční sektor",
    shortLabel: "Rezidenční",
    mood: "Úzké bloky, studené lampy a civilní provoz kryjí pohyb lidí i menších přesunů.",
    imagePath: "../img/residental/1.png"
  },
  industrial: {
    typeKey: "industrial",
    label: "Průmyslový sektor",
    shortLabel: "Průmysl",
    mood: "Komíny, kov a servisní koridory dávají districtu tvrdý, hlučný charakter.",
    imagePath: "../img/industrial/1.png"
  },
  economy: {
    typeKey: "economy",
    label: "Komerční sektor",
    shortLabel: "Komerce",
    mood: "Výlohy, trh a tok peněz drží district živý a neustále pod dohledem.",
    imagePath: "../img/commercial/1.png"
  },
  park: {
    typeKey: "park",
    label: "Parkový sektor",
    shortLabel: "Park",
    mood: "Tma mezi stromy, mlha a tiché stezky vytvářejí slepá místa pro pohyb i past.",
    imagePath: "../img/park/1.png"
  },
  downtown: {
    typeKey: "downtown",
    label: "Downtown",
    shortLabel: "Downtown",
    mood: "Vysoké věže, hustý provoz a agresivní neon dávají centru největší tlak.",
    imagePath: "../img/downtown/1.png"
  },
  unknown: {
    typeKey: "unknown",
    label: "Skrytý sektor",
    shortLabel: "Skryto",
    mood: "District je mimo dohled. Atmosféra, obrana i provoz nejsou potvrzené.",
    imagePath: "../img/blackout.png"
  }
});

const DISTRICT_BUILDING_TYPE_META = Object.freeze({
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

const DISTRICT_BUILDING_TYPE_ORDER = Object.freeze(["resident", "economy", "industrial", "park", "downtown"]);

const namedDowntownExchanges = [
  "Vortex Exchange"
];

const namedDowntownCentralBanks = [
  "Iron Reserve Bank",
  "Obsidian Central Vault"
];

const namedDowntownAirports = [
  "Neon Skyport"
];

const namedDowntownLobbyClubs = [
  "Velvet Influence Club",
  "Shadow Lobby Lounge",
  "Golden Circle Club"
];

const namedDowntownCityHalls = [
  "City Dominion Hall",
  "Urban Control Center"
];

const namedDowntownParliaments = [
  "The Vortex Council"
];

const namedDowntownPorts = [
  "Black Tide Port",
  "Ironsea Dockyard",
  "Shadow Harbor"
];

const namedDowntownCourts = [
  "High Justice Court",
  "Iron Verdict Hall",
  "Obsidian Tribunal"
];

const namedDowntownVipLounges = [
  "Platinum Lounge",
  "Eclipse VIP Gold Room"
];

const namedCommercialMalls = [
  "Neon Mall",
  "Iron Market Plaza",
  "Karina shopping center"
];

const namedCommercialRestaurants = [
  "Neon Bite",
  "Black Plate",
  "Street Fuel",
  "Blood & Grill",
  "Midnight Diner",
  "Iron Taste",
  "Shadow Kitchen",
  "Dirty Spoon",
  "Vice Kitchen",
  "Urban Hunger",
  "Smoke & Meat",
  "The Last Bite",
  "Gangster Grill",
  "Concrete Kitchen",
  "Dark Appetite",
  "Night Feast",
  "The Hungry Syndicate",
  "Rusty Fork",
  "Back Alley Bistro",
  "Sinful Kitchen",
  "Underground Taste",
  "Savage Kitchen",
  "Chrome Diner",
  "Heat Kitchen",
  "No Mercy Meals",
  "Broken Plate",
  "Elite Hunger"
];

const namedCommercialPharmacies = [
  "Neon Medics",
  "Pulse Pharmacy",
  "Black Cross Pharma",
  "Street Remedy",
  "NightCare Clinic",
  "Iron Vein Pharmacy",
  "QuickFix Med",
  "Shadow Medics",
  "Urban Cure",
  "Last Chance Pharmacy"
];

const namedCommercialAutoSalons = [
  "Neon Motors",
  "Iron Wheels Garage",
  "Blackline Autos",
  "Street Kings Motors",
  "Midnight Drive Showroom",
  "Chrome Syndicate Cars",
  "Ghost Ride Autos",
  "Velocity X Garage"
];

const namedCommercialFitnessClubs = [
  "Iron District Gym",
  "Beast Factory",
  "Street Power Club",
  "No Mercy Fitness"
];

const namedCommercialOfficeBlocks = [
  "Iron Tower Offices",
  "Blackline Corporate Hub",
  "Neon Business Center",
  "Vortex Office Complex",
  "Skyline Syndicate Offices",
  "ShadowCorp Tower"
];

const namedCommercialExchanges = [
  "ZeroSum Vault",
  "Neon Arbitrage",
  "Phantom Rates",
  "Cashflow Mirage",
  "Obsidian Exchange",
  "Flux Currency Lab",
  "DeadDrop Finance",
  "Parallax Exchange",
  "Ghost Ledger",
  "Black Circuit Exchange",
  "Silver Pulse Desk",
  "Midnight Convertor"
];

const namedCommercialArcades = [
  "Neon Jackpots",
  "Lucky Circuit",
  "Black Reel Club",
  "Midnight Slots",
  "Spin Syndicate",
  "Velvet Jackpot Lounge",
  "Ghost Spin Arcade"
];

const namedCommercialCasinos = [
  "Dominion Prime Casino",
  "High Rollers Sanctum",
  "Velvet Eclipse Casino",
  "Neon Crown Palace"
];

const namedIndustrialDataCenters = [
  "NeuroGrid Core",
  "Black Node Nexus",
  "DataForge Complex",
  "Synapse Vault",
  "Quantum Relay Hub",
  "GhostNet Core",
  "Iron Pulse Servers",
  "DeepCode Facility",
  "CipherStack Center",
  "Neon Matrix Node"
];

const namedIndustrialPowerStations = [
  "Neon Power Grid",
  "IronVolt Station",
  "BlackCore Energy",
  "Pulse Reactor",
  "Voltage Nexus",
  "Dark Energy Hub",
  "GridLock Station",
  "Quantum Power Plant",
  "Overcharge Facility",
  "ThunderCore Station",
  "Nova Energy Complex",
  "Static Surge Plant",
  "Flux Power Systems",
  "Obsidian Reactor",
  "HyperGrid Control"
];

const namedIndustrialStorages = [
  "IronVault Storage",
  "BlackCrate Depot",
  "Shadow Storage Hub",
  "CargoCore Warehouse",
  "Ghost Stockpile",
  "SteelBox Depot",
  "NightStorage Facility",
  "Hidden Goods Warehouse",
  "VaultLine Storage",
  "Obsidian Depot",
  "DeadDrop Warehouse",
  "Lockdown Storage",
  "Backroom Stockpile",
  "SecureHold Facility",
  "SteelNest Depot",
  "GridSafe Storage",
  "NightCrate Complex",
  "CargoLock Hub",
  "SilentVault Depot",
  "IronGate Warehouse",
  "DarkReserve Storage"
];

const namedIndustrialFactories = [
  "IronWorks Factory",
  "BlackSmoke Industries",
  "RustCore Plant",
  "SteelPulse Factory",
  "GrimeWorks Facility",
  "DarkForge Industrial",
  "Vortex Manufacturing",
  "HeavyGear Plant",
  "SmokeLine Industries",
  "Obsidian Production",
  "Dust & Steel Works",
  "NightShift Factory",
  "CoreMechanix Plant",
  "Ashline Industries",
  "BruteForce Manufacturing",
  "IronClad Works",
  "GritFactory Complex",
  "SteelHive Plant",
  "ToxicFlow Industries",
  "ShadowMachina Works",
  "HyperSteel Production",
  "GrindCore Factory",
  "MassDrive Industries",
  "DirtyWorks Plant",
  "Overload Manufacturing"
];

const namedIndustrialArmories = [
  "Iron Arsenal",
  "BlackForge Armory",
  "WarCore Factory",
  "Steel Reaper Works",
  "Crimson Armory",
  "Bullet Syndicate",
  "Deadshot Industries",
  "Obsidian Weapons Lab",
  "Vortex Arms Facility",
  "Nightfall Armory",
  "RapidFire Complex",
  "HellTrigger Works",
  "Ghost Weapon Systems",
  "Bloodline Arsenal",
  "Savage Arms Co.",
  "Zero Mercy Armory",
  "Titan Forge Weapons",
  "DarkSteel Industries",
  "Recoil Factory",
  "Phantom Arms Lab",
  "Iron Rain Arsenal"
];

const namedIndustrialResearchCenters = [
  "Neon Research Hub",
  "IronMind Labs",
  "Quantum Black Lab",
  "Synapse Forge Center",
  "DarkPulse Research",
  "CipherWorks Institute",
  "NovaCore Laboratory",
  "Obsidian Research Vault"
];

const namedIndustrialRecyclingCenters = [
  "SteelLoop Recycling",
  "BlackCycle Depot",
  "NeoWaste Recovery",
  "Iron Reclaim Facility",
  "ScrapCore Center",
  "Urban Reforge Plant",
  "DustLine Recycling",
  "GhostMetal Recovery"
];

const namedResidentialBrainwashCenters = [
  "NeuroControl Lab",
  "MindHack Facility",
  "BlackMind Institute",
  "Synapse Override Center",
  "GhostMind Program",
  "PsyCore Lab",
  "Oblivion Mind Center",
  "Neural Dominion Hub",
  "ThoughtForge Facility",
  "Cortex Manipulation Lab"
];

const namedResidentialApartmentBlocks = Array.from(
  { length: 36 },
  (_, index) => `Blok ${index + 1}`
);

const namedResidentialGarages = [
  "Iron Garage",
  "Street Wheels Hub",
  "BlackTorque Garage",
  "Ghost Garage",
  "NightRide Workshop",
  "SteelDrive Garage",
  "BackAlley Garage",
  "Velocity Garage",
  "Shadow Wheels"
];

const namedResidentialClinics = [
  "NightCare Clinic",
  "BlackCross Medical",
  "PulseFix Clinic",
  "StreetMed Center",
  "Iron Health Unit",
  "GhostCare Facility",
  "RapidAid Clinic",
  "ShadowMed Center",
  "LastHope Clinic",
  "Urban Recovery"
];

const namedResidentialRecruitCenters = [
  "Iron Recruit Hub",
  "Street Army Center",
  "BlackFlag Recruitment",
  "Shadow Enlistment",
  "Warborn Center",
  "Ghost Recruit Station",
  "Bloodline Recruitment",
  "Urban Soldiers Hub",
  "Vortex Recruit Base",
  "Frontline Enlistment",
  "No Mercy Recruitment"
];

const namedResidentialSchools = [
  "Street Academy",
  "Neon Learning Center",
  "Urban Knowledge Hub",
  "IronMind School",
  "Shadow Education",
  "Vortex Academy",
  "CoreSkill Institute",
  "Future Minds School",
  "BlackBoard Academy",
  "City Knowledge Center",
  "BrainCore School",
  "NextGen Academy",
  "StreetWise Institute",
  "LogicLab School"
];

const namedResidentialTaxiServices = [
  "NightRide Taxi",
  "Neon Cab Co.",
  "GhostDrive Taxi",
  "StreetMove Transport",
  "RapidRide Taxi",
  "Shadow Cab Service",
  "Urban Wheels Taxi",
  "BlackRoute Taxi",
  "Velocity Cab",
  "Backstreet Taxi",
  "FlashRide Taxi"
];

const namedParkDrugLabs = [
  "Neon Chem Lab",
  "BlackDust Factory",
  "GhostCook Lab",
  "Shadow Chemistry",
  "CrystalForge",
  "NightBatch Lab",
  "Toxic Synthesis",
  "DarkMix Facility",
  "StreetLab X",
  "PureRush Lab",
  "SilentCook Lab"
];

const namedParkSmugglingTunnels = [
  "Ghost Tunnel",
  "BlackRoute Passage",
  "Shadow Transit",
  "Silent Tunnel Network",
  "Underground Flow",
  "DarkPath Tunnel",
  "Hidden Route X",
  "Night Tunnel Line",
  "Smugglers Vein",
  "Phantom Passage",
  "DeepRoute Tunnel",
  "Backline Tunnel",
  "ZeroTrace Route",
  "Iron Tunnel"
];

const namedParkStreetDealers = [
  "Corner Dealers",
  "Night Sellers",
  "Ghost Pushers",
  "Street Hustlers",
  "Shadow Dealers",
  "QuickDrop Crew",
  "BackAlley Sellers",
  "Neon Push",
  "Silent Dealers",
  "FastCash Crew",
  "Dirty Hands",
  "Block Hustlers",
  "Dark Trade Crew",
  "Urban Pushers",
  "NoFace Dealers"
];

const namedParkStripClubs = [
  "Velvet Nights",
  "Neon Desire",
  "Midnight Dolls",
  "Crimson Lounge",
  "Silk & Sin",
  "Shadow Seduction",
  "Dark Angels Club",
  "Electric Temptation",
  "Night Velvet",
  "Obsidian Desire",
  "RedLight Palace",
  "Forbidden Lounge",
  "Lust District",
  "Golden Sinners",
  "Vice Lounge"
];

const namedParkConvenienceStores = [
  "QuickStop Market",
  "NightMart",
  "Urban MiniShop",
  "Street Corner Store",
  "24/7 Neon Shop",
  "FastBuy Market",
  "Backstreet Market",
  "GhostMart",
  "QuickPick Store",
  "City MiniMarket",
  "FlashMart",
  "Night Supply",
  "Urban Grab Shop",
  "RapidBuy Store",
  "Street Essentials",
  "MiniCore Market",
  "InstantShop",
  "Shadow Mart",
  "EasyBuy Corner",
  "Daily Needs Shop"
];


const DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME = Object.freeze({
  Burza: namedDowntownExchanges,
  "Centrální banka": namedDowntownCentralBanks,
  Letiště: namedDowntownAirports,
  "Lobby klub": namedDowntownLobbyClubs,
  Magistrát: namedDowntownCityHalls,
  Parlament: namedDowntownParliaments,
  "Přístav": namedDowntownPorts,
  Soud: namedDowntownCourts,
  "VIP salonek": namedDowntownVipLounges,
  "Obchodní centrum": namedCommercialMalls,
  Restaurace: namedCommercialRestaurants,
  "Lékárna": namedCommercialPharmacies,
  Autosalon: namedCommercialAutoSalons,
  "Fitness Club": namedCommercialFitnessClubs,
  "Kancelářský blok": namedCommercialOfficeBlocks,
  "Směnárna": namedCommercialExchanges,
  Herna: namedCommercialArcades,
  Kasino: namedCommercialCasinos,
  "Datové centrum": namedIndustrialDataCenters,
  "Energetická stanice": namedIndustrialPowerStations,
  Sklad: namedIndustrialStorages,
  "Továrna": namedIndustrialFactories,
  "Zbrojovka": namedIndustrialArmories,
  "Výzkumné centrum": namedIndustrialResearchCenters,
  "Recyklační centrum": namedIndustrialRecyclingCenters,
  "Brainwash centrum": namedResidentialBrainwashCenters,
  "Bytový blok": namedResidentialApartmentBlocks,
  Garage: namedResidentialGarages,
  Klinika: namedResidentialClinics,
  "Rekrutační centrum": namedResidentialRecruitCenters,
  "Škola": namedResidentialSchools,
  "Taxi služba": namedResidentialTaxiServices,
  "Drug lab": namedParkDrugLabs,
  "Pašovací tunel": namedParkSmugglingTunnels,
  "Pouliční dealeři": namedParkStreetDealers,
  "Strip club": namedParkStripClubs,
  "Večerka": namedParkConvenienceStores
});


const DISTRICT_MINUTE_INCOME_RULES_EMPIRE2 = Object.freeze({
  resident: Object.freeze({ clean: 2, dirty: 0.5 }),
  economy: Object.freeze({ clean: 3, dirty: 1 }),
  industrial: Object.freeze({ clean: 3, dirty: 1 }),
  park: Object.freeze({ clean: 2, dirty: 1 }),
  downtown: Object.freeze({ clean: 5, dirty: 2 })
});

const DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2 = Object.freeze({
  "Autosalon": Object.freeze({ clean: 5, dirty: 1 }),
  "Fitness Club": Object.freeze({ clean: 6, dirty: 0.5 }),
  Herna: Object.freeze({ clean: 3, dirty: 3 }),
  "Kancelářský blok": Object.freeze({ clean: 6, dirty: 1 }),
  Kasino: Object.freeze({ clean: 5, dirty: 4 }),
  "Lékárna": Object.freeze({ clean: 3, dirty: 0.4 }),
  "Obchodní centrum": Object.freeze({ clean: 8, dirty: 1 }),
  Restaurace: Object.freeze({ clean: 3, dirty: 2 }),
  "Směnárna": Object.freeze({ clean: 3.3333, dirty: 1.6667 }),
  "Datové centrum": Object.freeze({ clean: 5, dirty: 0.4 }),
  "Energetická stanice": Object.freeze({ clean: 4, dirty: 0.3 }),
  Sklad: Object.freeze({ clean: 2, dirty: 0.2 }),
  "Továrna": Object.freeze({ clean: 1, dirty: 0.2 }),
  "Zbrojovka": Object.freeze({ clean: 1.2, dirty: 0.5 }),
  "Brainwash centrum": Object.freeze({ clean: 8, dirty: 1.5 }),
  "Bytový blok": Object.freeze({ clean: 1.5, dirty: 0.5 }),
  Garage: Object.freeze({ clean: 3, dirty: 0.5 }),
  Klinika: Object.freeze({ clean: 2.5, dirty: 0.3 }),
  "Rekrutační centrum": Object.freeze({ clean: 2, dirty: 0.3 }),
  "Škola": Object.freeze({ clean: 4.4, dirty: 1 }),
  "Drug lab": Object.freeze({ clean: 1.5, dirty: 2 }),
  "Pašovací tunel": Object.freeze({ clean: 0.2, dirty: 3 }),
  "Pouliční dealeři": Object.freeze({ clean: 0.1, dirty: 4.5 }),
  "Strip club": Object.freeze({ clean: 8, dirty: 2 }),
  "Večerka": Object.freeze({ clean: 3.5, dirty: 1.3 }),
  Burza: Object.freeze({ clean: 18, dirty: 1 }),
  "Centrální banka": Object.freeze({ clean: 26, dirty: 1 }),
  "Letiště": Object.freeze({ clean: 19, dirty: 1 }),
  "Lobby klub": Object.freeze({ clean: 3, dirty: 22 }),
  "Magistrát": Object.freeze({ clean: 25, dirty: 6 }),
  Parlament: Object.freeze({ clean: 22, dirty: 3 }),
  "Přístav": Object.freeze({ clean: 26, dirty: 8.5 }),
  Soud: Object.freeze({ clean: 20, dirty: 10 }),
  "VIP salonek": Object.freeze({ clean: 8, dirty: 22 }),
  "Taxi služba": Object.freeze({ clean: 5.5, dirty: 1.5 })
});

const DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2 = Object.freeze({
  "Pašovací tunel": Object.freeze({ heat: 4.3 / 1440 }),
  "Strip club": Object.freeze({ heat: 5 / 1440 }),
  "Datové centrum": Object.freeze({ heat: 5.5 / 1440 }),
  Sklad: Object.freeze({ heat: 2.8 / 1440 }),
  "Večerka": Object.freeze({ heat: 2.5 / 1440 }),
  "Výzkumné centrum": Object.freeze({ heat: 4.8 / 1440 }),
  "Recyklační centrum": Object.freeze({ heat: 4 / 1440 })
});

const DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2 = Object.freeze({
  "Pašovací tunel": Object.freeze({ influence: 18 / 1440 }),
  "Pouliční dealeři": Object.freeze({ influence: 3.5 / 1440 }),
  "Strip club": Object.freeze({ influence: 28 / 1440 }),
  "Datové centrum": Object.freeze({ influence: 32 / 1440 }),
  Sklad: Object.freeze({ influence: 14 / 1440 }),
  "Večerka": Object.freeze({ influence: 8 / 1440 }),
  "Výzkumné centrum": Object.freeze({ influence: 30 / 1440 }),
  "Recyklační centrum": Object.freeze({ influence: 16 / 1440 })
});
const START_PHASE_RESOURCE_SIMULATION = Object.freeze({
  cleanPerMinuteByDistrictType: Object.freeze({
    resident: 5,
    industrial: 10,
    park: 20,
    economy: 40,
    downtown: 50
  }),
  influencePerMinute: 1
});

const DISTRICT_BUILDING_PACKAGE_POOLS = Object.freeze({
  resident: Object.freeze({
    early: Object.freeze([
      Object.freeze({ key: "res-early-1", tier: "early", title: "Startovní růst", buildings: Object.freeze(["Bytový blok", "Garage"]) }),
      Object.freeze({ key: "res-early-2", tier: "early", title: "Stabilní základna", buildings: Object.freeze(["Bytový blok", "Brainwash centrum"]) }),
      Object.freeze({ key: "res-early-3", tier: "early", title: "První nábor", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum"]) }),
      Object.freeze({ key: "res-early-4", tier: "early", title: "Obytná kontrola", buildings: Object.freeze(["Bytový blok", "Brainwash centrum", "Garage"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "res-mid-1", tier: "mid", title: "Mobilní posily", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum", "Garage"]) }),
      Object.freeze({ key: "res-mid-2", tier: "mid", title: "Udržitelný růst", buildings: Object.freeze(["Bytový blok", "Klinika"]) }),
      Object.freeze({ key: "res-mid-3", tier: "mid", title: "Disciplína a kvalita", buildings: Object.freeze(["Bytový blok", "Škola"]) }),
      Object.freeze({ key: "res-mid-4", tier: "mid", title: "Loajalita a výcvik", buildings: Object.freeze(["Brainwash centrum", "Škola"]) }),
      Object.freeze({ key: "res-mid-5", tier: "mid", title: "Regenerace fronty", buildings: Object.freeze(["Rekrutační centrum", "Klinika"]) }),
      Object.freeze({ key: "res-mid-6", tier: "mid", title: "Kontrolovaný development", buildings: Object.freeze(["Bytový blok", "Brainwash centrum", "Škola"]) })
    ]),
    late: Object.freeze([
      Object.freeze({ key: "res-late-1", tier: "late", title: "Válečné zázemí", buildings: Object.freeze(["Bytový blok", "Rekrutační centrum", "Klinika"]) }),
      Object.freeze({ key: "res-late-2", tier: "late", title: "Mobilní tlak", buildings: Object.freeze(["Rekrutační centrum", "Garage", "Klinika"]) }),
      Object.freeze({ key: "res-late-3", tier: "late", title: "Loajální populace", buildings: Object.freeze(["Bytový blok", "Brainwash centrum", "Klinika"]) }),
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
      Object.freeze({ key: "eco-early-5", tier: "early", title: "Startovní laundering", buildings: Object.freeze(["Autosalon", "Restaurace"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "eco-mid-1", tier: "mid", title: "Utility growth", buildings: Object.freeze(["Autosalon", "Lékárna"]) }),
      Object.freeze({ key: "eco-mid-2", tier: "mid", title: "Finanční uzel", buildings: Object.freeze(["Autosalon", "Směnárna"]) }),
      Object.freeze({ key: "eco-mid-3", tier: "mid", title: "Korporátní stabilita", buildings: Object.freeze(["Kancelářský blok", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-4", tier: "mid", title: "Administrativní utility", buildings: Object.freeze(["Kancelářský blok", "Lékárna", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-5", tier: "mid", title: "Hlavní retail", buildings: Object.freeze(["Obchodní centrum", "Restaurace"]) }),
      Object.freeze({ key: "eco-mid-6", tier: "mid", title: "Vyvážený obchod", buildings: Object.freeze(["Restaurace", "Lékárna", "Směnárna"]) }),
      Object.freeze({ key: "eco-mid-7", tier: "mid", title: "Prací front", buildings: Object.freeze(["Autosalon", "Směnárna", "Restaurace"]) })
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
      Object.freeze({ key: "ind-early-5", tier: "early", title: "Základní výzkum", buildings: Object.freeze(["Továrna", "Výzkumné centrum"]) }),
      Object.freeze({ key: "ind-early-6", tier: "early", title: "Recyklační tok", buildings: Object.freeze(["Sklad", "Recyklační centrum"]) })
    ]),
    mid: Object.freeze([
      Object.freeze({ key: "ind-mid-1", tier: "mid", title: "Vojenská výroba", buildings: Object.freeze(["Zbrojovka", "Sklad"]) }),
      Object.freeze({ key: "ind-mid-2", tier: "mid", title: "Technický provoz", buildings: Object.freeze(["Továrna", "Datové centrum"]) }),
      Object.freeze({ key: "ind-mid-3", tier: "mid", title: "Efektivní řetězec", buildings: Object.freeze(["Továrna", "Sklad", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-mid-4", tier: "mid", title: "Zbrojní logistika", buildings: Object.freeze(["Zbrojovka", "Sklad", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-mid-5", tier: "mid", title: "Datová výroba", buildings: Object.freeze(["Sklad", "Datové centrum"]) }),
      Object.freeze({ key: "ind-mid-6", tier: "mid", title: "Výzkum a obrana", buildings: Object.freeze(["Výzkumné centrum", "Zbrojovka"]) }),
      Object.freeze({ key: "ind-mid-7", tier: "mid", title: "Obnova zdrojů", buildings: Object.freeze(["Továrna", "Recyklační centrum", "Sklad"]) })
    ]),
    top: Object.freeze([
      Object.freeze({ key: "ind-top-1", tier: "top", title: "Arms grid", buildings: Object.freeze(["Továrna", "Zbrojovka", "Sklad"]) }),
      Object.freeze({ key: "ind-top-2", tier: "top", title: "Power forge", buildings: Object.freeze(["Továrna", "Zbrojovka", "Energetická stanice"]) }),
      Object.freeze({ key: "ind-top-3", tier: "top", title: "Hack foundry", buildings: Object.freeze(["Zbrojovka", "Datové centrum", "Sklad"]) }),
      Object.freeze({ key: "ind-top-4", tier: "top", title: "Critical infrastructure", buildings: Object.freeze(["Energetická stanice", "Datové centrum", "Sklad"]) }),
      Object.freeze({ key: "ind-top-5", tier: "top", title: "Heavy recycle", buildings: Object.freeze(["Zbrojovka", "Recyklační centrum", "Továrna"]) })
    ])
  }),
  downtown: Object.freeze({
    mid: Object.freeze([
      Object.freeze({ key: "down-mid-1", tier: "mid", title: "Městské finance", buildings: Object.freeze(["Centrální banka", "Magistrát"]) }),
      Object.freeze({ key: "down-mid-2", tier: "mid", title: "Politický vliv", buildings: Object.freeze(["Lobby klub", "Magistrát"]) }),
      Object.freeze({ key: "down-mid-3", tier: "mid", title: "Právní tlak", buildings: Object.freeze(["Soud", "Lobby klub"]) }),
      Object.freeze({ key: "down-mid-4", tier: "mid", title: "Volatilní kapitál", buildings: Object.freeze(["Burza", "VIP salonek"]) })
    ]),
    high: Object.freeze([
      Object.freeze({ key: "down-high-1", tier: "high", title: "Korporátní kontrola", buildings: Object.freeze(["Centrální banka", "Lobby klub"]) }),
      Object.freeze({ key: "down-high-2", tier: "high", title: "Státní pevnost", buildings: Object.freeze(["Magistrát", "Soud"]) }),
      Object.freeze({ key: "down-high-3", tier: "high", title: "Elitní arbitráž", buildings: Object.freeze(["Soud", "VIP salonek"]) }),
      Object.freeze({ key: "down-high-4", tier: "high", title: "Burzovní manipulace", buildings: Object.freeze(["Burza", "Lobby klub"]) }),
      Object.freeze({ key: "down-high-5", tier: "high", title: "Executive chamber", buildings: Object.freeze(["Magistrát", "VIP salonek"]) })
    ]),
    core: Object.freeze([
      Object.freeze({ key: "down-core-1", tier: "core", title: "Capital nexus", buildings: Object.freeze(["Centrální banka", "Magistrát", "VIP salonek"]) }),
      Object.freeze({ key: "down-core-2", tier: "core", title: "Shadow exchange", buildings: Object.freeze(["Burza", "Lobby klub", "VIP salonek"]) }),
      Object.freeze({ key: "down-core-3", tier: "core", title: "Judicial machine", buildings: Object.freeze(["Magistrát", "Soud", "Lobby klub"]) }),
      Object.freeze({ key: "down-core-4", tier: "core", title: "System override", buildings: Object.freeze(["Centrální banka", "Soud", "Lobby klub"]) })
    ])
  })
});

function formatDistrictBuildingTierLabel(tier) {
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

function getDistrictCoreWeight(district) {
  const rowIndex = Number.isFinite(Number(district?.rowIndex)) ? Number(district.rowIndex) : 3;
  const columnIndex = Number.isFinite(Number(district?.columnIndex)) ? Number(district.columnIndex) : 11;
  const rowDistance = Math.abs(rowIndex - 3) / 3;
  const columnDistance = Math.abs(columnIndex - 11) / 11;
  return clamp(1 - (rowDistance * 0.55 + columnDistance * 0.45), 0, 1);
}

function resolveDistrictBuildingTier(district) {
  const districtType = String(district?.districtType || "resident");
  const weight = getDistrictCoreWeight(district);

  if (districtType === "downtown") {
    if (weight >= 0.86) return "core";
    if (weight >= 0.7) return "high";
    return "mid";
  }

  if (districtType === "resident") {
    if (weight >= 0.7) return "late";
    if (weight >= 0.42) return "mid";
    return "early";
  }

  if (weight >= 0.72) return "top";
  if (weight >= 0.42) return "mid";
  return "early";
}

function getDistrictBuildingSeed(district) {
  const rowIndex = Number.isFinite(Number(district?.rowIndex)) ? Number(district.rowIndex) : Number(district?.id || 0);
  const columnIndex = Number.isFinite(Number(district?.columnIndex)) ? Number(district.columnIndex) : String(district?.districtType || "").length;
  const districtId = Number(district?.id || 0) || 0;
  return hashCell(rowIndex + districtId, columnIndex + districtId);
}

function getDistrictBuildingVariantName(district, buildingName, buildingIndex = 0) {
  const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
  const variants = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME[baseName];

  if (!Array.isArray(variants) || variants.length <= 0) {
    return baseName;
  }

  const districtId = Number(district?.id || 0) || 0;
  const seed = getDistrictBuildingSeed(district) + (districtId * 31) + (Math.max(0, buildingIndex) * 17);
  return variants[Math.abs(seed) % variants.length] || baseName;
}

function resolveDistrictBuildingPackage(district) {
  const districtType = DISTRICT_BUILDING_TYPE_META[district?.districtType]
    ? district.districtType
    : "resident";
  const tier = resolveDistrictBuildingTier({ ...district, districtType });
  const poolsByTier = DISTRICT_BUILDING_PACKAGE_POOLS[districtType] || DISTRICT_BUILDING_PACKAGE_POOLS.resident;
  const pool = poolsByTier[tier]
    || Object.values(poolsByTier).find((entry) => Array.isArray(entry) && entry.length > 0)
    || [];
  const seed = getDistrictBuildingSeed(district);
  const selected = pool.length > 0 ? pool[seed % pool.length] : null;

  return selected || {
    key: `${districtType}-${tier}-fallback`,
    tier,
    title: "Základní set",
    buildings: []
  };
}

function resolveDistrictBuildingProfile(district) {
  if (!district) {
    return null;
  }

  const districtType = DISTRICT_BUILDING_TYPE_META[district.districtType]
    ? district.districtType
    : "resident";
  const typeMeta = DISTRICT_BUILDING_TYPE_META[districtType] || DISTRICT_BUILDING_TYPE_META.resident;
  const packageMeta = resolveDistrictBuildingPackage({ ...district, districtType });
  const buildings = Array.isArray(packageMeta.buildings)
    ? packageMeta.buildings.map((buildingName, index) => {
        const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
        const displayName = getDistrictBuildingVariantName(district, baseName, index);

        return {
          index,
          baseName,
          displayName,
          variantName: displayName !== baseName ? displayName : null
        };
      })
    : [];

  return {
    districtId: Number(district.id) || 0,
    districtLabel: `District ${district.id}`,
    typeKey: districtType,
    typeLabel: typeMeta.label,
    typeShortLabel: typeMeta.shortLabel,
    setKey: String(packageMeta.key || ""),
    setTitle: String(packageMeta.title || "District set"),
    tier: String(packageMeta.tier || resolveDistrictBuildingTier({ ...district, districtType }) || "mid"),
    buildings
  };
}

function getDistrictEconomySnapshot(district) {
  if (!district) {
    return {
      baseCleanHourlyIncome: 0,
      baseDirtyHourlyIncome: 0,
      buildingCleanHourlyIncome: 0,
      buildingDirtyHourlyIncome: 0,
      cleanHourlyIncome: 0,
      dirtyHourlyIncome: 0,
      totalHourlyIncome: 0,
      districtInfluencePerHour: 0,
      buildingInfluencePerHour: 0,
      totalInfluencePerHour: 0,
      passiveHeatPerDay: 0
    };
  }

  const districtType = DISTRICT_MINUTE_INCOME_RULES_EMPIRE2[district?.districtType]
    ? district.districtType
    : "resident";
  const districtIncomeRule = DISTRICT_MINUTE_INCOME_RULES_EMPIRE2[districtType] || DISTRICT_MINUTE_INCOME_RULES_EMPIRE2.resident;
  const buildingProfile = resolveDistrictBuildingProfile(district);
  const baseCleanPerMinute = Number(districtIncomeRule.clean || 0);
  const baseDirtyPerMinute = Number(districtIncomeRule.dirty || 0);
  const districtInfluencePerMinute = districtType === "park" ? 10 : 0;
  let buildingCleanPerMinute = 0;
  let buildingDirtyPerMinute = 0;
  let buildingHeatPerMinute = 0;
  let buildingInfluencePerMinute = 0;

  for (const building of buildingProfile?.buildings || []) {
    const buildingName = String(building?.baseName || building?.displayName || "").trim();
    if (!buildingName) {
      continue;
    }

    const incomeRule = DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2[buildingName];
    let cleanPerMinute = Number(incomeRule?.clean || 0);
    let dirtyPerMinute = Number(incomeRule?.dirty || 0);
    let heatPerMinute = Number(DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2[buildingName]?.heat || 0);
    let influencePerMinute = Number(DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2[buildingName]?.influence || 0);
    const activeEffects = getActiveDistrictBuildingEffects(district, buildingName);

    for (const effect of activeEffects) {
      const incomeBoost = Math.max(0, Number(effect.incomeBoostPct || 0)) / 100;
      const cleanBoost = Math.max(0, Number(effect.cleanIncomeBoostPct || 0)) / 100;
      const dirtyBoost = Math.max(0, Number(effect.dirtyIncomeBoostPct || 0)) / 100;
      const influenceBoost = Math.max(0, Number(effect.influenceBoostPct || 0)) / 100;
      cleanPerMinute *= 1 + incomeBoost + cleanBoost;
      dirtyPerMinute *= 1 + incomeBoost + dirtyBoost;
      influencePerMinute *= 1 + influenceBoost;
      influencePerMinute += Math.max(0, Number(effect.influencePerDay || 0)) / 1440;
      heatPerMinute *= Math.max(0, Number(effect.heatMultiplier || 1));
      heatPerMinute += Math.max(0, Number(effect.heatPerDay || 0)) / 1440;
    }

    if (incomeRule) {
      buildingCleanPerMinute += cleanPerMinute;
      buildingDirtyPerMinute += dirtyPerMinute;
    }

    const heatRule = DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2[buildingName];
    if (heatRule) {
      buildingHeatPerMinute += heatPerMinute;
    }

    const influenceRule = DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2[buildingName];
    if (influenceRule || influencePerMinute > 0) {
      buildingInfluencePerMinute += influencePerMinute;
    }
  }

  const baseCleanHourlyIncome = Math.max(0, baseCleanPerMinute * 60);
  const baseDirtyHourlyIncome = Math.max(0, baseDirtyPerMinute * 60);
  const buildingCleanHourlyIncome = Math.max(0, buildingCleanPerMinute * 60);
  const buildingDirtyHourlyIncome = Math.max(0, buildingDirtyPerMinute * 60);
  const cleanHourlyIncome = Math.max(0, baseCleanHourlyIncome + buildingCleanHourlyIncome);
  const dirtyHourlyIncome = Math.max(0, baseDirtyHourlyIncome + buildingDirtyHourlyIncome);
  const districtInfluencePerHour = Math.max(0, districtInfluencePerMinute * 60);
  const buildingInfluencePerHour = Math.max(0, buildingInfluencePerMinute * 60);
  const passiveHeatPerDay = Math.max(0, buildingHeatPerMinute * 1440);

  return {
    baseCleanHourlyIncome,
    baseDirtyHourlyIncome,
    buildingCleanHourlyIncome,
    buildingDirtyHourlyIncome,
    cleanHourlyIncome,
    dirtyHourlyIncome,
    totalHourlyIncome: Math.max(0, cleanHourlyIncome + dirtyHourlyIncome),
    districtInfluencePerHour,
    buildingInfluencePerHour,
    totalInfluencePerHour: Math.max(0, districtInfluencePerHour + buildingInfluencePerHour),
    passiveHeatPerDay
  };
}

function formatDistrictMetricNumber(value = 0, maximumFractionDigits = 1) {
  const safeValue = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
  const roundedInteger = Math.round(safeValue);
  const hasDecimals = Math.abs(safeValue - roundedInteger) > Number.EPSILON;
  return safeValue.toLocaleString("cs-CZ", {
    minimumFractionDigits: hasDecimals ? Math.min(maximumFractionDigits, 1) : 0,
    maximumFractionDigits
  });
}

function formatDistrictMoneyAmount(value = 0) {
  return `$${Math.max(0, Math.round(Number(value || 0))).toLocaleString("cs-CZ")}`;
}

function formatDistrictIncomeLabel(hourlyIncome = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "V piči, zničen.";
  }

  return `${formatDistrictMoneyAmount(hourlyIncome)}/hod`;
}

function formatDistrictHeatLabel(heatPerDay = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "0/den";
  }

  const safeHeat = Math.max(0, Math.round(Number(heatPerDay || 0) * 10) / 10);
  const hasDecimals = Math.abs(safeHeat - Math.round(safeHeat)) > Number.EPSILON;
  const formatted = safeHeat.toLocaleString("cs-CZ", {
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 1
  });

  return safeHeat > 0 ? `+${formatted}/den` : "0/den";
}

function formatDistrictInfluenceLabel(influencePerHour = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "0/hod";
  }

  const safeInfluence = Math.max(0, Number(influencePerHour || 0));
  return safeInfluence > 0 ? `+${formatDistrictMetricNumber(safeInfluence, 2)}/hod` : "0/hod";
}

function isStartPhaseResourceSimulationActive(phaseState = getResolvedPhaseState()) {
  return (phaseState?.gamePhase || "live") === "launch";
}

function resetStartPhaseResourceSimulationState() {
  startPhaseResourceSimulationState = null;
}

function resolveStartPhaseResourceDistrictType(district) {
  return START_PHASE_RESOURCE_SIMULATION.cleanPerMinuteByDistrictType[district?.districtType]
    ? district.districtType
    : "resident";
}

function getCurrentPlayerStartPhaseSourceSnapshot() {
  const worldState = getResolvedWorldState();
  const interactionState = {
    ownedDistrictIds: new Set(worldState.ownedDistrictIds || []),
    gamePhase: isStartPhaseResourceSimulationActive(worldState.phaseState) ? "launch" : "live",
    launchOwnerByDistrictId: new Map(START_PHASE_OWNER_BY_DISTRICT_ID),
    destroyedDistrictIds: new Set(worldState.destroyedDistrictIds || [])
  };
  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  const destroyedDistrictIds = interactionState.destroyedDistrictIds;

  let cleanMoneyPerMinute = 0;
  let dirtyMoneyPerMinute = 0;
  let influencePerMinute = 0;
  let heatPerDay = 0;
  let heatPerMinute = 0;
  let districtCount = 0;

  for (const district of getDistrictResourceCatalog()) {
    const districtId = Number(district.id);
    if (!currentPlayerOwnedDistrictIds.has(districtId) || destroyedDistrictIds.has(districtId)) {
      continue;
    }

    const districtType = resolveStartPhaseResourceDistrictType(district);
    const districtIncomeRule = DISTRICT_MINUTE_INCOME_RULES_EMPIRE2[districtType] || DISTRICT_MINUTE_INCOME_RULES_EMPIRE2.resident;
    const snapshot = getDistrictEconomySnapshot(district);
    cleanMoneyPerMinute += Number(START_PHASE_RESOURCE_SIMULATION.cleanPerMinuteByDistrictType[districtType] || 0);
    dirtyMoneyPerMinute += Number(districtIncomeRule.dirty || 0);
    influencePerMinute += START_PHASE_RESOURCE_SIMULATION.influencePerMinute;
    heatPerDay += Number(snapshot.passiveHeatPerDay || 0);
    heatPerMinute += Number(snapshot.passiveHeatPerDay || 0) / 1440;
    districtCount += 1;
  }

  return {
    cleanMoneyPerMinute: Math.max(0, cleanMoneyPerMinute),
    dirtyMoneyPerMinute: Math.max(0, dirtyMoneyPerMinute),
    influencePerMinute: Math.max(0, influencePerMinute),
    heatPerDay: Math.max(0, Math.round(heatPerDay * 10) / 10),
    heatPerMinute: Math.max(0, heatPerMinute),
    districtCount
  };
}

function getCurrentPlayerDistrictSourceSnapshot() {
  return getCurrentPlayerStartPhaseSourceSnapshot();
}

function syncCurrentPlayerDistrictCountDisplays(root, districtCount) {
  const scope = root?.ownerDocument || document;
  const normalizedCount = String(Math.max(0, Number(districtCount) || 0));
  const gangDistricts = root.querySelector("[data-gang-districts]");
  const playerDistricts = scope.querySelector(PLAYER_POPUP_DISTRICTS_SELECTOR);

  root.dataset.currentPlayerDistrictCount = normalizedCount;

  if (gangDistricts) {
    gangDistricts.textContent = normalizedCount;
  }

  if (playerDistricts) {
    playerDistricts.textContent = normalizedCount;
  }
}

function createStoredResourceSnapshot() {
  const economy = getResolvedEconomyState();
  const influence = getResolvedGangState().influence;
  return {
    cleanMoney: economy.cleanMoney,
    dirtyMoney: economy.dirtyMoney,
    influence,
    heatPerDay: 0,
    heatPerMinute: 0,
    districtCount: 0,
    cleanMoneyPerMinute: 0,
    dirtyMoneyPerMinute: 0,
    influencePerMinute: 0,
    sourceMode: "stored"
  };
}

function createStartPhaseDisplayedResourceSnapshot() {
  const districtSnapshot = getCurrentPlayerStartPhaseSourceSnapshot();
  const economy = getResolvedEconomyState();
  const gangState = getResolvedGangState();

  return {
    cleanMoney: Math.max(0, Math.floor(Number(economy.cleanMoney || 0))),
    dirtyMoney: Math.max(0, Math.floor(Number(economy.dirtyMoney || 0))),
    influence: Math.max(0, Math.floor(Number(gangState.influence || 0))),
    heatPerDay: districtSnapshot.heatPerDay,
    heatPerMinute: districtSnapshot.heatPerMinute,
    districtCount: districtSnapshot.districtCount,
    cleanMoneyPerMinute: districtSnapshot.cleanMoneyPerMinute,
    dirtyMoneyPerMinute: districtSnapshot.dirtyMoneyPerMinute,
    influencePerMinute: districtSnapshot.influencePerMinute,
    sourceMode: "district"
  };
}

function syncStartPhaseResourceSimulation(root, now = Date.now()) {
  if (!isStartPhaseResourceSimulationActive()) {
    resetStartPhaseResourceSimulationState();
    return;
  }

  const districtSnapshot = getCurrentPlayerStartPhaseSourceSnapshot();
  const economyState = getResolvedEconomyState();
  const gangState = getResolvedGangState();

  if (!startPhaseResourceSimulationState || startPhaseResourceSimulationState.phase !== "launch") {
    startPhaseResourceSimulationState = {
      phase: "launch",
      lastAppliedAt: now,
      cleanRemainder: 0,
      dirtyRemainder: 0,
      influenceRemainder: 0,
      influenceTickRemainderMs: 0,
      heatRemainder: 0
    };
    applyTopbarEconomy(root, { instant: true });
    return;
  }

  let lastAppliedAt = Number(startPhaseResourceSimulationState.lastAppliedAt || now);
  if (!Number.isFinite(lastAppliedAt) || lastAppliedAt > now) {
    lastAppliedAt = now;
  }

  const elapsedMs = Math.max(0, now - lastAppliedAt);
  if (elapsedMs <= 0) {
    return;
  }

  const elapsedMinutes = elapsedMs / 60000;
  let cleanRemainder = Math.max(0, Number(startPhaseResourceSimulationState.cleanRemainder || 0));
  let dirtyRemainder = Math.max(0, Number(startPhaseResourceSimulationState.dirtyRemainder || 0));
  let influenceRemainder = Math.max(0, Number(startPhaseResourceSimulationState.influenceRemainder || 0));
  let influenceTickRemainderMs = Math.max(0, Number(startPhaseResourceSimulationState.influenceTickRemainderMs || 0));
  let heatRemainder = Math.max(0, Number(startPhaseResourceSimulationState.heatRemainder || 0));

  let cleanDelta = 0;
  let dirtyDelta = 0;
  let influenceDelta = 0;
  let heatDelta = 0;

  if (districtSnapshot.cleanMoneyPerMinute > 0) {
    const cleanRaw = districtSnapshot.cleanMoneyPerMinute * elapsedMinutes + cleanRemainder;
    cleanDelta = Math.floor(cleanRaw);
    cleanRemainder = Math.max(0, cleanRaw - cleanDelta);
  }

  if (districtSnapshot.dirtyMoneyPerMinute > 0) {
    const dirtyRaw = districtSnapshot.dirtyMoneyPerMinute * elapsedMinutes + dirtyRemainder;
    dirtyDelta = Math.floor(dirtyRaw);
    dirtyRemainder = Math.max(0, dirtyRaw - dirtyDelta);
  }

  if (districtSnapshot.influencePerMinute > 0) {
    const influenceElapsedMs = elapsedMs + influenceTickRemainderMs;
    const influenceTicks = Math.floor(influenceElapsedMs / 10000);
    influenceTickRemainderMs = Math.max(0, influenceElapsedMs - influenceTicks * 10000);
    const influenceRaw = (influenceTicks * (districtSnapshot.influencePerMinute / 6)) + influenceRemainder;
    influenceDelta = Math.floor(influenceRaw);
    influenceRemainder = Math.max(0, influenceRaw - influenceDelta);
  } else {
    influenceTickRemainderMs = 0;
  }

  if (districtSnapshot.heatPerMinute > 0) {
    const heatRaw = districtSnapshot.heatPerMinute * elapsedMinutes + heatRemainder;
    heatDelta = Math.floor(heatRaw);
    heatRemainder = Math.max(0, heatRaw - heatDelta);
  }

  startPhaseResourceSimulationState = {
    phase: "launch",
    lastAppliedAt: now,
    cleanRemainder,
    dirtyRemainder,
    influenceRemainder,
    influenceTickRemainderMs,
    heatRemainder
  };

  if (cleanDelta > 0 || dirtyDelta > 0) {
    setStoredEconomyState({
      cleanMoney: Math.max(0, Math.floor(Number(economyState.cleanMoney || 0)) + cleanDelta),
      dirtyMoney: Math.max(0, Math.floor(Number(economyState.dirtyMoney || 0)) + dirtyDelta)
    });
    applyTopbarEconomy(root, { instant: true });
  }

  if (influenceDelta > 0) {
    setStoredGangState({
      influence: Math.max(0, Math.floor(Number(gangState.influence || 0)) + influenceDelta)
    });
    renderSpyResourceState(root, { animate: true });
  }

  if (heatDelta > 0) {
    setGangHeatValue(Number(gangState.heat || 0) + heatDelta, {
      type: "rise",
      reason: "Pasivní heat z budov v ovládaných distriktech."
    });
  }
}

function syncStartPhaseDistrictIncome(root, now = Date.now()) {
  syncStartPhaseResourceSimulation(root, now);
}

function getDisplayedResourceSnapshot() {
  if (isStartPhaseResourceSimulationActive()) {
    return createStartPhaseDisplayedResourceSnapshot();
  }

  resetStartPhaseResourceSimulationState();
  return createStoredResourceSnapshot();
}

function normalizeBuildingLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BUILDING_POPUP_TARGETS = Object.freeze([
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

function resolveBuildingPopupTarget(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  if (!lookupKey) {
    return null;
  }

  return BUILDING_POPUP_TARGETS.find((target) => target.lookupKeys.includes(lookupKey)) || null;
}

const DISTRICT_BUILDING_DETAIL_PROFILES = Object.freeze({
  "bytovy blok": Object.freeze({
    role: "Rezidenční kontrola",
    info: "Bytový blok drží základ populace v districtu a vytváří prostor pro nábor členů gangu.",
    actions: Object.freeze(["Collect gang members", "Stabilizovat nájemníky", "Zvýšit lokální vliv"])
  }),
  garage: Object.freeze({
    role: "Mobilita",
    info: "Garage podporuje přesuny posádek, rychlejší výjezdy a logistiku mezi obsazenými districty.",
    actions: Object.freeze(["Připravit vozidla", "Zkrátit výjezd", "Zajistit únikové trasy"])
  }),
  "brainwash centrum": Object.freeze({
    role: "Loajalita",
    info: "Brainwash centrum drží morálku a poslušnost v lokální populaci.",
    actions: Object.freeze(["Zvýšit loajalitu", "Potlačit odpor", "Vytvořit propagandu"])
  }),
  "rekrutacni centrum": Object.freeze({
    role: "Nábor",
    info: "Rekrutační centrum převádí lokální populaci na použitelné členy gangu.",
    actions: Object.freeze(["Collect gang members", "Zrychlit nábor", "Prověřit nováčky"])
  }),
  klinika: Object.freeze({
    role: "Podpora",
    info: "Klinika pomáhá držet posádku v provozu po konfliktech a snižuje ztráty v dlouhých taženích.",
    actions: Object.freeze(["Ošetřit posádku", "Zvýšit obnovu", "Stabilizovat district"])
  }),
  skola: Object.freeze({
    role: "Výcvik",
    info: "Škola zvyšuje kvalitu místní sítě a podporuje dlouhodobý růst vlivu.",
    actions: Object.freeze(["Trénovat členy", "Zvýšit disciplínu", "Budovat vliv"])
  }),
  restaurace: Object.freeze({
    role: "Cashflow",
    info: "Restaurace generuje stabilní čistý i špinavý cashflow a slouží jako lokální kontaktní bod.",
    actions: Object.freeze(["Vybrat tržby", "Krýt schůzky", "Posílit lokální síť"])
  }),
  "fitness club": Object.freeze({
    role: "Legální front",
    info: "Fitness Club je civilní front s dobrým čistým příjmem a nízkým rizikem.",
    actions: Object.freeze(["Vybrat členské poplatky", "Nabrat vyhazovače", "Držet nízký heat"])
  }),
  smenarna: Object.freeze({
    role: "Finance",
    info: "Směnárna mění špinavé peníze na čistší kapitál a pomáhá stabilizovat ekonomiku.",
    actions: Object.freeze(["Exchange dirty to clean cash", "Zkontrolovat kurz", "Zakrýt transakce"])
  }),
  autosalon: Object.freeze({
    role: "Finance a logistika",
    info: "Autosalon pere peníze přes drahé zboží a zároveň podporuje mobilitu posádek.",
    actions: Object.freeze(["Vybrat prodeje", "Připravit flotilu", "Zakryt špinavý cash"])
  }),
  "kancelarsky blok": Object.freeze({
    role: "Administrativa",
    info: "Kancelářský blok drží legální krytí, smlouvy a firemní cashflow.",
    actions: Object.freeze(["Vybrat nájem", "Založit front firmu", "Zvýšit krytí"])
  }),
  "obchodni centrum": Object.freeze({
    role: "Retail",
    info: "Obchodní centrum vytváří silný čistý příjem a stabilní zákaznický provoz.",
    actions: Object.freeze(["Vybrat tržby", "Rozšířit obchody", "Maskovat provoz"])
  }),
  kasino: Object.freeze({
    role: "Praní peněz",
    info: "Kasino je prémiový zdroj špinavých peněz a hlavní místo pro laundering.",
    actions: Object.freeze(["Launder dirty cash", "Vybrat herní zisk", "Hostit VIP večer"])
  }),
  "poulicni dealeri": Object.freeze({
    role: "Distribuce",
    info: "Pouliční dealeři vytváří vysoký dirty cash, ale zvedají pozornost v okolí.",
    actions: Object.freeze(["Rozšířit distribuci", "Vybrat cash", "Přesunout stash"])
  }),
  vecerka: Object.freeze({
    role: "Malý front",
    info: "Večerka je nízkoprofilový front pro drobné tržby, zásoby a lokální kontakty.",
    actions: Object.freeze(["Vybrat tržby", "Schovat zásoby", "Získat info z ulice"])
  }),
  "pasovaci tunel": Object.freeze({
    role: "Logistika",
    info: "Pašovací tunel posouvá zboží mimo běžný dohled a zvyšuje špinavý tok zdrojů.",
    actions: Object.freeze(["Big shipment", "Přesunout zásilku", "Snížit stopu"])
  }),
  "strip club": Object.freeze({
    role: "Noční provoz",
    info: "Strip club generuje cashflow, kontakty a vliv ve večerní ekonomice districtu.",
    actions: Object.freeze(["Vybrat cash", "Hostit VIP klienty", "Získat kompromat"])
  }),
  sklad: Object.freeze({
    role: "Skladování",
    info: "Sklad drží materiály, zbraně a zásoby připravené pro další akce.",
    actions: Object.freeze(["Collect stored resources", "Zkontrolovat zásoby", "Přesunout materiál"])
  }),
  "energeticka stanice": Object.freeze({
    role: "Infrastruktura",
    info: "Energetická stanice podporuje průmyslovou výrobu a drží provoz districtu stabilní.",
    actions: Object.freeze(["Stabilizovat síť", "Napájet výrobu", "Snížit výpadky"])
  }),
  "vyzkumne centrum": Object.freeze({
    role: "Výzkum",
    info: "Výzkumné centrum zvyšuje technickou hodnotu districtu a otevírá silnější synergie.",
    actions: Object.freeze(["Analyzovat technologii", "Zvýšit efektivitu", "Testovat prototyp"])
  }),
  "datove centrum": Object.freeze({
    role: "Intel",
    info: "Datové centrum zvyšuje informační kontrolu, vliv a technický přehled nad městem.",
    actions: Object.freeze(["Získat intel", "Zvýšit vliv", "Monitorovat síť"])
  }),
  "recyklacni centrum": Object.freeze({
    role: "Materiály",
    info: "Recyklační centrum vrací část odpadu do použitelných materiálů a drží průmysl levnější.",
    actions: Object.freeze(["Získat materiály", "Přečistit odpad", "Snížit náklady"])
  }),
  lekarna: Object.freeze({
    role: "Chemická podpora",
    info: "Lékárna vyrábí základní chemii, biomass a stim packy pro další crafting a podporu posádky.",
    actions: Object.freeze(["Vyrobit stim pack", "Black market med kit", "Medical cover"])
  }),
  "drug lab": Object.freeze({
    role: "Drug výroba",
    info: "Drug lab převádí materiály na hotové substance a drží nejvyšší dirty cash potenciál v districtu.",
    actions: Object.freeze(["Overclock batch", "Clean batch", "Hidden operation"])
  }),
  lab: Object.freeze({
    role: "Drug výroba",
    info: "Lab převádí materiály na hotové substance a drží nejvyšší dirty cash potenciál v districtu.",
    actions: Object.freeze(["Overclock batch", "Clean batch", "Hidden operation"])
  }),
  tovarna: Object.freeze({
    role: "Průmyslová výroba",
    info: "Továrna vyrábí Metal Parts, Tech Core a Combat Module pro zbrojovku, útoky a průmyslové boosty.",
    actions: Object.freeze(["Combat module run", "Rapid assembly", "Industrial overdrive"])
  }),
  zbrojovka: Object.freeze({
    role: "Výzbroj",
    info: "Zbrojovka mění průmyslové zásoby na útočnou i obrannou výzbroj použitelnou v attack a defense flow.",
    actions: Object.freeze(["Attack loadout", "Defense kit", "Fortify district"])
  })
});

function getDistrictBuildingDetailProfile(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  return DISTRICT_BUILDING_DETAIL_PROFILES[lookupKey] || DISTRICT_BUILDING_DETAIL_PROFILES[popupLookupKey] || Object.freeze({
    role: "District asset",
    info: `${buildingName} je pevná budova přiřazená mapou districtu. Ovlivňuje ekonomiku, heat nebo vliv podle typu zóny.`,
    actions: Object.freeze(["Zkontrolovat provoz", "Vybrat lokální výnos", "Prověřit napojení"])
  });
}

const DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES = Object.freeze({
  restaurace: Object.freeze([
    Object.freeze({ clean: 180, dirty: 90, heat: 1, summary: "Lokální tržby přepsány do zdrojů." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 18, influence: 2, heat: 1, summary: "Schůzky zvedly dočasný income budovy." }),
    Object.freeze({ influence: 4, heat: 2, durationMs: 60 * 60 * 1000, influenceBoostPct: 12, summary: "Lokální síť posílila vliv districtu." })
  ]),
  "fitness club": Object.freeze([
    Object.freeze({ clean: 220, heat: 1, summary: "Členské poplatky připsány do clean cash." }),
    Object.freeze({ members: 2, influence: 2, heat: 2, summary: "Vyhazovači přidáni do posádky." }),
    Object.freeze({ heat: -3, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.85, summary: "Nízký profil snižuje heat." })
  ]),
  smenarna: Object.freeze([
    Object.freeze({ exchangeDirty: 900, exchangeRate: 0.78, heat: 2, summary: "Směna dirty cash na clean cash proběhla." }),
    Object.freeze({ clean: 120, influence: 1, summary: "Kurz přinesl menší clean zisk." }),
    Object.freeze({ heat: -2, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.9, summary: "Transakce byly zakryté." })
  ]),
  autosalon: Object.freeze([
    Object.freeze({ clean: 260, dirty: 80, heat: 1, summary: "Prodeje aut přidaly cash." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 15, influence: 2, summary: "Flotila zvedla logistiku a income." }),
    Object.freeze({ exchangeDirty: 1100, exchangeRate: 0.82, heat: 2, summary: "Dirty cash byl zakryt přes autosalon." })
  ]),
  "kancelarsky blok": Object.freeze([
    Object.freeze({ clean: 240, summary: "Nájem připsán do clean cash." }),
    Object.freeze({ durationMs: 3 * 60 * 60 * 1000, cleanIncomeBoostPct: 18, influence: 3, summary: "Front firma zvýšila clean income." }),
    Object.freeze({ heat: -2, influence: 2, summary: "Krytí snížilo heat a přidalo vliv." })
  ]),
  "obchodni centrum": Object.freeze([
    Object.freeze({ clean: 340, dirty: 60, heat: 1, summary: "Retail tržby zapsány do zdrojů." }),
    Object.freeze({ durationMs: 3 * 60 * 60 * 1000, cleanIncomeBoostPct: 22, summary: "Rozšíření obchodů zvedlo clean income." }),
    Object.freeze({ heat: -2, dirty: 120, summary: "Provoz maskoval špinavé peníze." })
  ]),
  kasino: Object.freeze([
    Object.freeze({ exchangeDirty: 1400, exchangeRate: 0.84, heat: 3, summary: "Kasino vypralo dirty cash." }),
    Object.freeze({ dirty: 420, heat: 3, summary: "Herní zisk přidán do dirty cash." }),
    Object.freeze({ dirty: 360, influence: 6, heat: 4, durationMs: 2 * 60 * 60 * 1000, dirtyIncomeBoostPct: 25, summary: "VIP večer zvýšil vliv i dirty income." })
  ]),
  "poulicni dealeri": Object.freeze([
    Object.freeze({ dirty: 360, heat: 4, durationMs: 2 * 60 * 60 * 1000, dirtyIncomeBoostPct: 35, summary: "Distribuce zvedla dirty cash a income." }),
    Object.freeze({ dirty: 280, heat: 3, summary: "Hotový cash byl vybrán." }),
    Object.freeze({ materials: { biomass: 2 }, heat: 1, summary: "Stash přesunut do zásob." })
  ]),
  vecerka: Object.freeze([
    Object.freeze({ clean: 130, dirty: 70, heat: 1, summary: "Tržby z večerky připsány." }),
    Object.freeze({ materials: { chemicals: 1, biomass: 1 }, heat: 1, summary: "Zásoby schované do inventáře." }),
    Object.freeze({ influence: 3, heat: 1, summary: "Ulice dodala nové info." })
  ]),
  "pasovaci tunel": Object.freeze([
    Object.freeze({ dirty: 520, materials: { "tech-core": 1 }, heat: 5, summary: "Velká zásilka prošla tunelem." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, dirtyIncomeBoostPct: 30, heat: 4, summary: "Tok zásilek dočasně zvedl dirty income." }),
    Object.freeze({ heat: -3, influence: 2, summary: "Stopa zásilky byla snížena." })
  ]),
  "strip club": Object.freeze([
    Object.freeze({ dirty: 360, heat: 3, summary: "Noční cash vybrán." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 35, influence: 5, heat: 4, summary: "VIP klienti zvedli income i vliv." }),
    Object.freeze({ influence: 7, heat: 3, summary: "Kompromat přidal vliv." })
  ]),
  sklad: Object.freeze([
    Object.freeze({ materials: { chemicals: 2, "metal-parts": 2 }, heat: 1, summary: "Skladové zásoby připsány." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 12, influence: 2, heat: 2, summary: "Materiál se přesunul a zvedl income." }),
    Object.freeze({ heat: -2, durationMs: 3 * 60 * 60 * 1000, heatMultiplier: 0.88, summary: "Skrytý sklad snížil policejní stopu." })
  ]),
  "energeticka stanice": Object.freeze([
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 12, heat: 1, summary: "Síť stabilizována, income běží rychleji." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, cleanIncomeBoostPct: 18, heat: 2, summary: "Výroba dostala napájecí boost." }),
    Object.freeze({ heat: -2, summary: "Výpadky byly snížené." })
  ]),
  "vyzkumne centrum": Object.freeze([
    Object.freeze({ materials: { "tech-core": 2 }, heat: 2, summary: "Technologie připsána do zásob." }),
    Object.freeze({ durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 18, influence: 4, heat: 3, summary: "Efektivita zvýšila income a vliv." }),
    Object.freeze({ materials: { "metal-parts": 2, "tech-core": 1 }, heat: 4, summary: "Prototyp přidal technické zdroje." })
  ]),
  "datove centrum": Object.freeze([
    Object.freeze({ influence: 7, heat: 3, summary: "Intel přepsán do vlivu." }),
    Object.freeze({ influence: 5, heat: 2, durationMs: 2 * 60 * 60 * 1000, influenceBoostPct: 22, summary: "Síť dočasně zvedla vliv districtu." }),
    Object.freeze({ influence: 4, clean: 160, heat: 4, summary: "Monitorování přineslo data a clean cash." })
  ]),
  "recyklacni centrum": Object.freeze([
    Object.freeze({ materials: { biomass: 3, "metal-parts": 2 }, heat: 1, summary: "Materiály získané z odpadu." }),
    Object.freeze({ materials: { chemicals: 2, "metal-parts": 5 }, heat: 3, summary: "Rozebraná zásilka přidala materiály." }),
    Object.freeze({ heat: -2, materials: { "tech-core": 1 }, summary: "Nouzová obnova snížila heat a dala tech core." })
  ]),
  lekarna: Object.freeze([
    Object.freeze({ materials: { "stim-pack": 3, chemicals: 2 }, heat: 1, summary: "Lékárna přepsala stim packy a chemii do zásob." }),
    Object.freeze({ clean: 180, dirty: 120, materials: { "stim-pack": 1 }, heat: 2, summary: "Black market med kit přidal cash i support zásoby." }),
    Object.freeze({ heat: -3, influence: 2, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.85, summary: "Medical cover snížil heat a kryje district." })
  ]),
  "drug lab": Object.freeze([
    Object.freeze({ drugs: { "neon-dust": 4, "pulse-shot": 3 }, dirty: 280, heat: 5, durationMs: 90 * 60 * 1000, dirtyIncomeBoostPct: 30, summary: "Overclock batch přidal drogy a dočasný dirty income." }),
    Object.freeze({ drugs: { "velvet-smoke": 3, "ghost-serum": 1 }, clean: 160, heat: 2, summary: "Clean batch přepsal hotové substance a clean cash." }),
    Object.freeze({ drugs: { "overdrive-x": 1 }, heat: -2, influence: 3, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.9, summary: "Hidden operation drží lab pod radarem." })
  ]),
  lab: Object.freeze([
    Object.freeze({ drugs: { "neon-dust": 4, "pulse-shot": 3 }, dirty: 280, heat: 5, durationMs: 90 * 60 * 1000, dirtyIncomeBoostPct: 30, summary: "Overclock batch přidal drogy a dočasný dirty income." }),
    Object.freeze({ drugs: { "velvet-smoke": 3, "ghost-serum": 1 }, clean: 160, heat: 2, summary: "Clean batch přepsal hotové substance a clean cash." }),
    Object.freeze({ drugs: { "overdrive-x": 1 }, heat: -2, influence: 3, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.9, summary: "Hidden operation drží lab pod radarem." })
  ]),
  tovarna: Object.freeze([
    Object.freeze({ factorySupplies: { combatModule: 1 }, materials: { "metal-parts": 3, "tech-core": 1 }, heat: 3, summary: "Combat module run přidal průmyslové zásoby." }),
    Object.freeze({ factorySupplies: { metalParts: 5, techCore: 2 }, durationMs: 90 * 60 * 1000, cleanIncomeBoostPct: 18, heat: 2, summary: "Rapid assembly zrychlil průmyslový výstup." }),
    Object.freeze({ factorySupplies: { combatModule: 2 }, durationMs: 2 * 60 * 60 * 1000, incomeBoostPct: 20, heat: 5, summary: "Industrial overdrive zvýšil income i combat modules." })
  ]),
  zbrojovka: Object.freeze([
    Object.freeze({ weapons: { pistol: 2, smg: 1, grenade: 1 }, heat: 4, durationMs: 90 * 60 * 1000, influenceBoostPct: 10, summary: "Attack loadout přidal útočnou výzbroj." }),
    Object.freeze({ weapons: { vest: 2, barricades: 2, cameras: 1 }, heat: 2, influence: 2, summary: "Defense kit přidal obrannou výzbroj." }),
    Object.freeze({ weapons: { "defense-tower": 1, alarm: 2 }, heat: -2, influence: 3, durationMs: 2 * 60 * 60 * 1000, heatMultiplier: 0.9, summary: "Fortify district přidal obranu a snížil heat." })
  ])
});

function getDistrictBuildingSpecialActionProfile(buildingName, actionIndex) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  const profiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[lookupKey] || DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[popupLookupKey] || [];
  return profiles[actionIndex] || null;
}

const DISTRICT_BUILDING_DETAIL_STATE_KEY = "empireStreets.districtBuildingDetails.v1";
const DISTRICT_BUILDING_DETAIL_DEFAULT_ACCRUAL_MS = 60 * 60 * 1000;
const DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS = 4 * 60 * 60 * 1000;
const DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS = 90 * 1000;
const DISTRICT_BUILDING_DETAIL_MAX_LEVEL = 8;

const DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES = Object.freeze({
  "bytovy blok": "apartment-block",
  "rekrutacni centrum": "apartment-block",
  skola: "school",
  garage: "garage",
  "brainwash centrum": "loyalty",
  klinika: "clinic",
  restaurace: "restaurant",
  "fitness club": "fitness-club",
  smenarna: "exchange",
  autosalon: "auto-salon",
  "kancelarsky blok": "office",
  "obchodni centrum": "retail",
  kasino: "casino",
  "poulicni dealeri": "street-dealers",
  vecerka: "convenience-store",
  "pasovaci tunel": "smuggling-tunnel",
  "strip club": "strip-club",
  sklad: "warehouse",
  "energeticka stanice": "power-plant",
  "vyzkumne centrum": "research-center",
  "datove centrum": "data-center",
  "recyklacni centrum": "recycling-center",
  lekarna: "pharmacy",
  "drug lab": "drug-lab",
  lab: "drug-lab",
  tovarna: "factory",
  zbrojovka: "armory"
});

const districtBuildingDetailContextByShell = new WeakMap();

function getDistrictBuildingRule(ruleSet, buildingName, fallback) {
  const direct = ruleSet?.[buildingName];
  if (direct) {
    return direct;
  }

  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const matchingKey = Object.keys(ruleSet || {}).find((ruleKey) => normalizeBuildingLookupKey(ruleKey) === lookupKey);
  return matchingKey ? ruleSet[matchingKey] : fallback;
}

function getActiveDistrictBuildingEffects(district, buildingName, now = Date.now()) {
  const entry = getDistrictBuildingDetailEntry(district, buildingName);
  return (entry.activeEffects || []).filter((effect) => Number(effect.expiresAt || 0) > now);
}

function getDistrictBuildingDetailStorageKey(district, buildingName) {
  const districtId = district?.id == null ? "unknown" : String(district.id);
  return `${districtId}:${normalizeBuildingLookupKey(buildingName) || "building"}`;
}

function getStoredDistrictBuildingDetailState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISTRICT_BUILDING_DETAIL_STATE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setStoredDistrictBuildingDetailState(payload) {
  try {
    window.localStorage.setItem(DISTRICT_BUILDING_DETAIL_STATE_KEY, JSON.stringify(payload && typeof payload === "object" ? payload : {}));
  } catch {
    // Detail budovy je legacy klientský stav; když storage selže, UI zůstane funkční bez perzistence.
  }
}

function getDistrictBuildingDetailEntry(district, buildingName) {
  const state = getStoredDistrictBuildingDetailState();
  const key = getDistrictBuildingDetailStorageKey(district, buildingName);
  const entry = state[key] && typeof state[key] === "object" ? state[key] : {};
  const level = Math.max(1, Math.min(DISTRICT_BUILDING_DETAIL_MAX_LEVEL, Math.floor(Number(entry.level || 1))));
  const lastCollectedAt = Number.isFinite(Number(entry.lastCollectedAt))
    ? Number(entry.lastCollectedAt)
    : Date.now() - DISTRICT_BUILDING_DETAIL_DEFAULT_ACCRUAL_MS;
  const actionCooldowns = entry.actionCooldowns && typeof entry.actionCooldowns === "object"
    ? entry.actionCooldowns
    : {};
  const activeEffects = Array.isArray(entry.activeEffects)
    ? entry.activeEffects
        .filter((effect) => effect && typeof effect === "object")
        .filter((effect) => Number(effect.expiresAt || 0) > Date.now())
    : [];

  return {
    level,
    lastCollectedAt,
    actionCooldowns,
    activeEffects
  };
}

function updateDistrictBuildingDetailEntry(district, buildingName, updater) {
  const state = getStoredDistrictBuildingDetailState();
  const key = getDistrictBuildingDetailStorageKey(district, buildingName);
  const current = getDistrictBuildingDetailEntry(district, buildingName);
  state[key] = updater(current) || current;
  setStoredDistrictBuildingDetailState(state);
  return state[key];
}

function resolveDistrictBuildingDetailMechanicsType(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  return DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[lookupKey] || DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[popupLookupKey] || "district-asset";
}

function formatDistrictBuildingMoney(value) {
  return formatCurrency(Math.max(0, Math.floor(Number(value) || 0)));
}

function formatDistrictBuildingCooldown(ms) {
  const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

function getDistrictBuildingActionDescription(action, mechanics, buildingName = "", actionIndex = -1) {
  const actionKey = normalizeBuildingLookupKey(action);
  const actionProfile = getDistrictBuildingSpecialActionProfile(buildingName, actionIndex);

  if (actionProfile) {
    const parts = [
      actionProfile.clean ? `Clean +${formatDistrictBuildingMoney(actionProfile.clean)}` : "",
      actionProfile.dirty ? `Dirty +${formatDistrictBuildingMoney(actionProfile.dirty)}` : "",
      actionProfile.influence ? `Vliv +${actionProfile.influence}` : "",
      actionProfile.heat ? `Heat ${actionProfile.heat > 0 ? "+" : ""}${actionProfile.heat}` : "",
      ...Object.entries(actionProfile.materials || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.drugs || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.weapons || {}).map(([itemId, amount]) => `${ATTACK_WEAPON_LABELS[itemId] || itemId} x${amount}`),
      ...Object.entries(actionProfile.factorySupplies || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      actionProfile.incomeBoostPct ? `Income +${actionProfile.incomeBoostPct}%` : "",
      actionProfile.cleanIncomeBoostPct ? `Clean income +${actionProfile.cleanIncomeBoostPct}%` : "",
      actionProfile.dirtyIncomeBoostPct ? `Dirty income +${actionProfile.dirtyIncomeBoostPct}%` : ""
    ].filter(Boolean);

    return parts.length > 0
      ? `${actionProfile.summary || "Speciální akce budovy."} ${parts.join(" · ")}.`
      : actionProfile.summary || "Speciální akce budovy se zapíše do dev-only zdrojů.";
  }

  if (actionKey.includes("collect gang") || actionKey.includes("nabor")) {
    return `Přidá ${mechanics.memberGain} členů gangu podle levelu budovy.`;
  }
  if (actionKey.includes("collect stored") || actionKey.includes("material") || actionKey.includes("zasob")) {
    return `Vygeneruje skladové zásoby: Chemicals x${mechanics.materialGain} a Metal Parts x${mechanics.materialGain}.`;
  }
  if (actionKey.includes("launder")) {
    return `Vypere až ${formatDistrictBuildingMoney(mechanics.moneyActionAmount)} dirty cash se ztrátou provize.`;
  }
  if (actionKey.includes("exchange")) {
    return `Smění až ${formatDistrictBuildingMoney(mechanics.moneyActionAmount)} dirty cash na clean cash.`;
  }
  if (actionKey.includes("vliv") || actionKey.includes("intel") || actionKey.includes("monitor")) {
    return `Přidá +${mechanics.influenceActionGain} vliv a aktualizuje horní lištu.`;
  }
  if (actionKey.includes("heat") || actionKey.includes("stopu") || actionKey.includes("zakryt")) {
    return "Sníží heat a zapíše výsledek do informačního panelu.";
  }
  if (actionKey.includes("cash") || actionKey.includes("trzb") || actionKey.includes("zisk")) {
    return `Okamžitě vybere část výnosu: ${formatDistrictBuildingMoney(mechanics.quickCashGain)}.`;
  }

  return "Spustí lokální building akci s cooldownem a reportem v informačním panelu.";
}

function resolveDistrictBuildingDetailMechanics(district, buildingName) {
  const entry = getDistrictBuildingDetailEntry(district, buildingName);
  const mechanicsType = resolveDistrictBuildingDetailMechanicsType(buildingName);
  const income = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2, buildingName, { clean: 0, dirty: 0 });
  const heatRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2, buildingName, { heat: 0 });
  const influenceRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2, buildingName, { influence: 0 });
  const now = Date.now();
  const elapsedMs = Math.min(DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS, Math.max(0, now - entry.lastCollectedAt));
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const multiplier = 1 + ((entry.level - 1) * 0.14);
  const cleanHourly = Math.max(0, Math.round(Number(income.clean || 0) * 60 * multiplier));
  const dirtyHourly = Math.max(0, Math.round(Number(income.dirty || 0) * 60 * multiplier));
  const storedClean = Math.max(0, Math.floor(cleanHourly * elapsedHours));
  const storedDirty = Math.max(0, Math.floor(dirtyHourly * elapsedHours));
  const memberGain = Math.max(1, Math.floor((entry.level + 1) * Math.max(0.5, elapsedHours)));
  const materialGain = Math.max(1, Math.floor((entry.level + 2) * Math.max(0.75, elapsedHours)));
  const influenceActionGain = Math.max(1, Math.ceil(entry.level * 1.5));
  const quickCashGain = Math.max(50, Math.round((cleanHourly + dirtyHourly) / 4));
  const moneyActionAmount = Math.max(250, entry.level * 650);
  const upgradeCost = entry.level >= DISTRICT_BUILDING_DETAIL_MAX_LEVEL
    ? 0
    : Math.max(850, Math.round((cleanHourly + dirtyHourly + 120) * (entry.level + 2) * 2.4));
  const nextLevel = entry.level >= DISTRICT_BUILDING_DETAIL_MAX_LEVEL ? null : entry.level + 1;
  const dailyHeat = Math.round(Number(heatRule.heat || 0) * 1440 * 10) / 10;
  const dailyInfluence = Math.round(Number(influenceRule.influence || 0) * 1440 * 10) / 10;
  const activeEffectLabels = (entry.activeEffects || [])
    .map((effect) => `${effect.label || "Efekt"} ${formatDistrictBuildingCooldown(Number(effect.expiresAt || 0) - Date.now())}`)
    .filter(Boolean);
  const canCollect =
    storedClean > 0
    || storedDirty > 0
    || mechanicsType === "apartment-block"
    || mechanicsType === "school"
    || mechanicsType === "warehouse"
    || mechanicsType === "recycling-center";
  const storedOutputLabel = [
    storedClean > 0 ? `${formatDistrictBuildingMoney(storedClean)} clean` : "",
    storedDirty > 0 ? `${formatDistrictBuildingMoney(storedDirty)} dirty` : "",
    mechanicsType === "apartment-block" || mechanicsType === "school" ? `${memberGain} členů` : "",
    mechanicsType === "warehouse" || mechanicsType === "recycling-center" ? `${materialGain * 2} zásob` : ""
  ].filter(Boolean).join(" · ") || "Zatím nic";
  const effectsLabel = [
    cleanHourly > 0 ? `Clean cash +${formatDistrictBuildingMoney(cleanHourly)}/hod` : "",
    dirtyHourly > 0 ? `Dirty cash +${formatDistrictBuildingMoney(dirtyHourly)}/hod` : "",
    dailyHeat > 0 ? `Heat +${dailyHeat}/den` : "",
    dailyInfluence > 0 ? `Vliv +${dailyInfluence}/den` : "",
    ...activeEffectLabels,
    `Level multiplier x${multiplier.toFixed(2)}`
  ].filter(Boolean).join(" · ");

  return {
    mechanicsType,
    level: entry.level,
    nextLevel,
    upgradeCost,
    cleanHourly,
    dirtyHourly,
    storedClean,
    storedDirty,
    memberGain,
    materialGain,
    influenceActionGain,
    quickCashGain,
    moneyActionAmount,
    dailyHeat,
    dailyInfluence,
    canCollect,
    storedOutputLabel,
    effectsLabel,
    actionCooldowns: entry.actionCooldowns
  };
}

function createDistrictBuildingMechanicRow(label, value) {
  const row = document.createElement("div");
  row.className = "district-building-detail-mechanic-row";
  const rowLabel = document.createElement("span");
  rowLabel.textContent = label;
  const rowValue = document.createElement("strong");
  rowValue.textContent = value;
  row.append(rowLabel, rowValue);
  return row;
}

function syncDistrictBuildingDetailTabs(shell, activeTab) {
  const normalizedTab = activeTab === "info" ? "info" : "stats";
  shell.dataset.activeDistrictBuildingDetailTab = normalizedTab;
  shell.querySelectorAll("[data-district-building-detail-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.districtBuildingDetailTab === normalizedTab);
  });
  shell.querySelectorAll("[data-district-building-detail-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.districtBuildingDetailPanel !== normalizedTab);
  });
}

function refreshDistrictBuildingDetailPopup(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  openGenericDistrictBuildingDetail(root, context.district, context.buildingName, context.displayName);
}

function collectDistrictBuildingDetailOutput(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (!mechanics.canCollect) {
    setBuildingActionFeedback(root, "warning", context.buildingName, "Budova zatím nemá připravený výstup.", "Počkej na další tick produkce.");
    return;
  }

  const economy = getResolvedEconomyState();
  let cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  let dirtyMoney = Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)));
  const summary = [];

  if (mechanics.storedClean > 0 || mechanics.storedDirty > 0) {
    cleanMoney += mechanics.storedClean;
    dirtyMoney += mechanics.storedDirty;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root, { instant: true });
    if (mechanics.storedClean > 0) {
      summary.push(`${formatDistrictBuildingMoney(mechanics.storedClean)} clean`);
    }
    if (mechanics.storedDirty > 0) {
      summary.push(`${formatDistrictBuildingMoney(mechanics.storedDirty)} dirty`);
    }
  }

  if (mechanics.mechanicsType === "apartment-block" || mechanics.mechanicsType === "school") {
    const gangState = getResolvedGangState();
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + mechanics.memberGain) });
    renderGangMembersState(root);
    summary.push(`${mechanics.memberGain} členů`);
  }

  if (mechanics.mechanicsType === "warehouse" || mechanics.mechanicsType === "recycling-center") {
    applyInventoryOutput({ inventory: "materials", itemId: "chemicals", amount: mechanics.materialGain });
    applyInventoryOutput({ inventory: "materials", itemId: "metal-parts", amount: mechanics.materialGain });
    summary.push(`Chemicals x${mechanics.materialGain}`, `Metal Parts x${mechanics.materialGain}`);
  }

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    lastCollectedAt: Date.now()
  }));

  setBuildingActionFeedback(
    root,
    "success",
    `${context.buildingName}: výstup vybrán`,
    summary.length > 0 ? summary.join(" · ") : "Výstup byl zapsán.",
    context.district?.id ? `District ${context.district.id}` : "Fixed building"
  );
  refreshDistrictBuildingDetailPopup(root, shell);
}

function upgradeDistrictBuildingDetail(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (!mechanics.nextLevel) {
    setBuildingActionFeedback(root, "warning", context.buildingName, "Budova je na maximálním levelu.", `L${mechanics.level}`);
    return;
  }

  const economy = getResolvedEconomyState();
  const cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  if (cleanMoney < mechanics.upgradeCost) {
    setBuildingActionFeedback(
      root,
      "warning",
      `${context.buildingName}: upgrade nejde`,
      `Chybí ${formatDistrictBuildingMoney(mechanics.upgradeCost - cleanMoney)} clean cash.`,
      `Cena upgradu ${formatDistrictBuildingMoney(mechanics.upgradeCost)}`
    );
    return;
  }

  setStoredEconomyState({
    cleanMoney: cleanMoney - mechanics.upgradeCost,
    dirtyMoney: Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)))
  });
  applyTopbarEconomy(root, { instant: true });
  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    level: mechanics.nextLevel
  }));

  setBuildingActionFeedback(
    root,
    "success",
    `${context.buildingName}: upgrade`,
    `Budova je teď na levelu ${mechanics.nextLevel}.`,
    `Cena ${formatDistrictBuildingMoney(mechanics.upgradeCost)}`
  );
  refreshDistrictBuildingDetailPopup(root, shell);
}

function applyDistrictBuildingSpecialAction(root, context, action, actionProfile, mechanics) {
  const economy = getResolvedEconomyState();
  const gangState = getResolvedGangState();
  let cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  let dirtyMoney = Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)));
  let economyChanged = false;
  let influenceChanged = false;
  let membersChanged = false;
  const summaryParts = [];

  if (actionProfile.exchangeDirty) {
    const amount = Math.min(dirtyMoney, Math.max(0, Math.floor(Number(actionProfile.exchangeDirty || 0))));
    if (amount <= 0) {
      setBuildingActionFeedback(root, "warning", action, "Nemáš žádný dirty cash pro převod.", context.buildingName);
      return null;
    }
    const cleanGain = Math.floor(amount * Math.max(0, Number(actionProfile.exchangeRate || 0.75)));
    dirtyMoney -= amount;
    cleanMoney += cleanGain;
    economyChanged = true;
    summaryParts.push(`${formatDistrictBuildingMoney(amount)} dirty -> ${formatDistrictBuildingMoney(cleanGain)} clean`);
  }

  if (actionProfile.clean) {
    cleanMoney += Math.max(0, Math.floor(Number(actionProfile.clean || 0)));
    economyChanged = true;
    summaryParts.push(`Clean +${formatDistrictBuildingMoney(actionProfile.clean)}`);
  }

  if (actionProfile.dirty) {
    dirtyMoney += Math.max(0, Math.floor(Number(actionProfile.dirty || 0)));
    economyChanged = true;
    summaryParts.push(`Dirty +${formatDistrictBuildingMoney(actionProfile.dirty)}`);
  }

  if (economyChanged) {
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root, { instant: true });
  }

  if (actionProfile.members) {
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + Math.floor(Number(actionProfile.members || 0))) });
    renderGangMembersState(root);
    membersChanged = true;
    summaryParts.push(`Členové +${Math.floor(Number(actionProfile.members || 0))}`);
  }

  if (actionProfile.influence) {
    setGangInfluenceValue(Number(gangState.influence || 0) + Math.floor(Number(actionProfile.influence || 0)));
    renderSpyResourceState(root, { animate: true });
    influenceChanged = true;
    summaryParts.push(`Vliv +${Math.floor(Number(actionProfile.influence || 0))}`);
  }

  if (actionProfile.heat) {
    const heatDelta = Math.floor(Number(actionProfile.heat || 0));
    setGangHeatValue(Number(gangState.heat || 0) + heatDelta, {
      type: heatDelta < 0 ? "fall" : "rise",
      reason: `${context.buildingName}: ${action}`
    });
    summaryParts.push(`Heat ${heatDelta > 0 ? "+" : ""}${heatDelta}`);
  }

  for (const [itemId, amount] of Object.entries(actionProfile.materials || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount <= 0) continue;
    applyInventoryOutput({ inventory: "materials", itemId, amount: safeAmount });
    summaryParts.push(`${itemId} x${safeAmount}`);
  }

  for (const [itemId, amount] of Object.entries(actionProfile.drugs || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount <= 0) continue;
    applyInventoryOutput({ inventory: "drugs", itemId, amount: safeAmount });
    summaryParts.push(`${itemId} x${safeAmount}`);
  }

  for (const [itemId, amount] of Object.entries(actionProfile.weapons || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount <= 0) continue;
    applyInventoryOutput({ inventory: "weapons", itemId, amount: safeAmount });
    summaryParts.push(`${ATTACK_WEAPON_LABELS[itemId] || itemId} x${safeAmount}`);
  }

  if (actionProfile.factorySupplies && typeof actionProfile.factorySupplies === "object") {
    const supplies = getStoredFactorySupplies();
    const nextSupplies = { ...supplies };

    for (const [itemId, amount] of Object.entries(actionProfile.factorySupplies)) {
      const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
      if (safeAmount <= 0) continue;
      nextSupplies[itemId] = Math.max(0, Math.floor(Number(nextSupplies[itemId] || 0)) + safeAmount);
      summaryParts.push(`${itemId} x${safeAmount}`);
    }

    setStoredFactorySupplies(nextSupplies);
  }

  const durationMs = Math.max(0, Number(actionProfile.durationMs || 0));
  const activeEffect = durationMs > 0
    ? {
        label: action,
        expiresAt: Date.now() + durationMs,
        incomeBoostPct: Math.max(0, Number(actionProfile.incomeBoostPct || 0)),
        cleanIncomeBoostPct: Math.max(0, Number(actionProfile.cleanIncomeBoostPct || 0)),
        dirtyIncomeBoostPct: Math.max(0, Number(actionProfile.dirtyIncomeBoostPct || 0)),
        influenceBoostPct: Math.max(0, Number(actionProfile.influenceBoostPct || 0)),
        influencePerDay: Math.max(0, Number(actionProfile.influencePerDay || 0)),
        heatMultiplier: Math.max(0, Number(actionProfile.heatMultiplier || 1)),
        heatPerDay: Math.max(0, Number(actionProfile.heatPerDay || 0))
      }
    : null;

  if (activeEffect) {
    summaryParts.push(`Efekt ${formatDistrictBuildingCooldown(durationMs)}`);
  }

  if (!economyChanged && !influenceChanged && !membersChanged && !actionProfile.heat && !activeEffect && summaryParts.length <= 0) {
    const influenceGain = Math.max(1, Math.floor(mechanics.influenceActionGain / 2));
    setGangInfluenceValue(Number(gangState.influence || 0) + influenceGain);
    renderSpyResourceState(root, { animate: true });
    summaryParts.push(`Vliv +${influenceGain}`);
  }

  return {
    activeEffect,
    summary: summaryParts.join(" · ") || actionProfile.summary || "Akce proběhla."
  };
}

function runDistrictBuildingDetailAction(root, shell, actionIndex) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const profile = getDistrictBuildingDetailProfile(context.buildingName);
  const action = profile.actions[actionIndex];
  if (!action) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  const cooldownUntil = Number(mechanics.actionCooldowns?.[actionIndex] || 0);
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  if (cooldownRemaining > 0) {
    setBuildingActionFeedback(root, "warning", action, `Akce má cooldown ${formatDistrictBuildingCooldown(cooldownRemaining)}.`, context.buildingName);
    return;
  }

  const actionProfile = getDistrictBuildingSpecialActionProfile(context.buildingName, actionIndex);
  const actionResult = applyDistrictBuildingSpecialAction(
    root,
    context,
    action,
    actionProfile || {},
    mechanics
  );

  if (!actionResult) {
    return;
  }

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    activeEffects: actionResult.activeEffect
      ? [...(entry.activeEffects || []), actionResult.activeEffect]
      : (entry.activeEffects || []),
    actionCooldowns: {
      ...(entry.actionCooldowns || {}),
      [actionIndex]: Date.now() + DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS
    }
  }));

  setBuildingActionFeedback(
    root,
    "success",
    action,
    actionResult.summary,
    context.district?.id ? `${context.buildingName} · District ${context.district.id}` : context.buildingName
  );
  refreshDistrictBuildingDetailPopup(root, shell);
}

function ensureDistrictBuildingDetailPopup(root) {
  let shell = root.querySelector("[data-district-building-detail-popup]");
  if (shell instanceof HTMLElement) {
    return shell;
  }

  shell = document.createElement("div");
  shell.className = "district-building-detail-shell";
  shell.dataset.districtBuildingDetailPopup = "true";
  shell.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "district-building-detail-backdrop";
  backdrop.dataset.districtBuildingDetailClose = "true";

  const card = document.createElement("div");
  card.className = "district-building-detail-card building-detail-modal__content";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Detail budovy");

  const header = document.createElement("div");
  header.className = "modal__header";

  const title = document.createElement("h3");
  title.className = "district-building-detail-title";
  const titleText = document.createElement("span");
  titleText.dataset.districtBuildingDetailTitle = "true";
  titleText.textContent = "Detail budovy";
  const titleBadge = document.createElement("span");
  titleBadge.className = "building-detail-title__badge";
  titleBadge.dataset.districtBuildingDetailBadge = "true";
  title.append(titleText, titleBadge);

  const collectButton = document.createElement("button");
  collectButton.type = "button";
  collectButton.className = "building-detail-title__action-btn building-detail-title__action-btn--collect";
  collectButton.dataset.districtBuildingDetailCollect = "true";
  collectButton.setAttribute("aria-label", "Vybrat výstup budovy");
  collectButton.title = "Vybrat výstup budovy";
  collectButton.textContent = "+";

  const upgradeButton = document.createElement("button");
  upgradeButton.type = "button";
  upgradeButton.className = "building-detail-title__action-btn building-detail-title__action-btn--upgrade";
  upgradeButton.dataset.districtBuildingDetailUpgrade = "true";
  upgradeButton.setAttribute("aria-label", "Upgradovat budovu");
  upgradeButton.title = "Upgradovat budovu";
  upgradeButton.textContent = "↑";

  const levelBadge = document.createElement("span");
  levelBadge.className = "building-detail-header-level";
  levelBadge.dataset.districtBuildingDetailLevel = "true";
  levelBadge.textContent = "L1";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "modal__close";
  closeButton.dataset.districtBuildingDetailClose = "true";
  closeButton.setAttribute("aria-label", "Zavřít detail budovy");
  closeButton.textContent = "✕";

  header.append(title, collectButton, upgradeButton, levelBadge, closeButton);

  const body = document.createElement("div");
  body.className = "modal__body district-building-detail-body";

  const tabs = document.createElement("div");
  tabs.className = "building-detail-tabs district-building-detail-tabs";
  const statsTab = document.createElement("button");
  statsTab.type = "button";
  statsTab.className = "building-detail-tabs__btn is-active";
  statsTab.dataset.districtBuildingDetailTab = "stats";
  statsTab.textContent = "Statistiky";
  const infoTab = document.createElement("button");
  infoTab.type = "button";
  infoTab.className = "building-detail-tabs__btn";
  infoTab.dataset.districtBuildingDetailTab = "info";
  infoTab.textContent = "Info";
  tabs.append(statsTab, infoTab);

  const statsPanel = document.createElement("div");
  statsPanel.className = "building-detail-panel district-building-detail-panel";
  statsPanel.dataset.districtBuildingDetailPanel = "stats";

  const infoPanel = document.createElement("div");
  infoPanel.className = "building-detail-panel district-building-detail-panel hidden";
  infoPanel.dataset.districtBuildingDetailPanel = "info";

  const name = document.createElement("h4");
  name.className = "district-building-detail-name";
  name.dataset.districtBuildingDetailName = "true";

  const meta = document.createElement("p");
  meta.className = "district-building-detail-meta";
  meta.dataset.districtBuildingDetailMeta = "true";

  const stats = document.createElement("div");
  stats.className = "building-info-card__stats district-building-detail-stats";
  stats.dataset.districtBuildingDetailStats = "true";

  const mechanicsSection = document.createElement("div");
  mechanicsSection.className = "building-info-card__section";
  const mechanicsTitle = document.createElement("h5");
  mechanicsTitle.textContent = "Mechaniky";
  const mechanicsList = document.createElement("div");
  mechanicsList.className = "building-detail-mechanics district-building-detail-mechanics";
  mechanicsList.dataset.districtBuildingDetailMechanics = "true";
  mechanicsSection.append(mechanicsTitle, mechanicsList);

  const effectsSection = document.createElement("div");
  effectsSection.className = "building-info-card__section";
  const effectsTitle = document.createElement("h5");
  effectsTitle.textContent = "Efekty";
  const effects = document.createElement("p");
  effects.className = "building-info-card__effects";
  effects.dataset.districtBuildingDetailEffects = "true";
  effectsSection.append(effectsTitle, effects);

  const infoSection = document.createElement("div");
  infoSection.className = "building-info-card building-info-card__section district-building-detail-info-card";
  const infoTitle = document.createElement("h5");
  infoTitle.textContent = "Info";
  const info = document.createElement("p");
  info.className = "building-detail-info-text";
  info.dataset.districtBuildingDetailInfo = "true";
  infoSection.append(infoTitle, info);

  const actionSection = document.createElement("div");
  actionSection.className = "building-info-card__section";
  const actionTitle = document.createElement("h5");
  actionTitle.textContent = "Speciální akce";
  const actions = document.createElement("div");
  actions.className = "building-info-card__actions district-building-detail-actions";
  actions.dataset.districtBuildingDetailActions = "true";
  actionSection.append(actionTitle, actions);

  statsPanel.append(name, meta, stats, mechanicsSection, effectsSection);
  infoPanel.append(infoSection, actionSection);
  body.append(tabs, statsPanel, infoPanel);
  card.append(header, body);
  shell.append(backdrop, card);
  root.append(shell);

  const close = () => {
    shell.hidden = true;
  };

  shell.querySelectorAll("[data-district-building-detail-close]").forEach((element) => {
    element.addEventListener("click", close);
  });

  collectButton.addEventListener("click", () => {
    collectDistrictBuildingDetailOutput(root, shell);
  });

  upgradeButton.addEventListener("click", () => {
    upgradeDistrictBuildingDetail(root, shell);
  });

  body.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tabButton = target.closest("[data-district-building-detail-tab]");
    if (tabButton instanceof HTMLElement) {
      syncDistrictBuildingDetailTabs(shell, tabButton.dataset.districtBuildingDetailTab || "stats");
      return;
    }

    const actionButton = target.closest("[data-district-building-detail-action-index]");
    if (actionButton instanceof HTMLButtonElement) {
      const actionIndex = Number.parseInt(actionButton.dataset.districtBuildingDetailActionIndex || "", 10);
      if (Number.isFinite(actionIndex)) {
        runDistrictBuildingDetailAction(root, shell, actionIndex);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shell.hidden) {
      close();
    }
  });

  return shell;
}

function createDistrictBuildingStat(label, value) {
  const stat = document.createElement("div");
  stat.className = "building-info-card__stat";
  const statLabel = document.createElement("span");
  statLabel.textContent = label;
  const statValue = document.createElement("strong");
  statValue.textContent = value;
  stat.append(statLabel, statValue);
  return stat;
}

function openGenericDistrictBuildingDetail(root, district, buildingName, displayName = buildingName) {
  const shell = ensureDistrictBuildingDetailPopup(root);
  const profile = getDistrictBuildingDetailProfile(buildingName);
  const mechanics = resolveDistrictBuildingDetailMechanics(district, buildingName);
  const buildingProfile = resolveDistrictBuildingProfile(district);
  const displayLabel = String(displayName || buildingName || "Budova").trim() || "Budova";

  districtBuildingDetailContextByShell.set(shell, { district, buildingName, displayName: displayLabel });
  shell.dataset.buildingMechanicsType = mechanics.mechanicsType;

  const title = shell.querySelector("[data-district-building-detail-title]");
  const badge = shell.querySelector("[data-district-building-detail-badge]");
  const level = shell.querySelector("[data-district-building-detail-level]");
  const collectButton = shell.querySelector("[data-district-building-detail-collect]");
  const upgradeButton = shell.querySelector("[data-district-building-detail-upgrade]");
  const name = shell.querySelector("[data-district-building-detail-name]");
  const meta = shell.querySelector("[data-district-building-detail-meta]");
  const stats = shell.querySelector("[data-district-building-detail-stats]");
  const mechanicsList = shell.querySelector("[data-district-building-detail-mechanics]");
  const effects = shell.querySelector("[data-district-building-detail-effects]");
  const info = shell.querySelector("[data-district-building-detail-info]");
  const actions = shell.querySelector("[data-district-building-detail-actions]");

  if (title) {
    title.textContent = displayLabel;
  }

  if (badge) {
    badge.textContent = profile.role;
  }

  if (level) {
    level.textContent = `L${mechanics.level}`;
  }

  if (collectButton instanceof HTMLButtonElement) {
    collectButton.disabled = !mechanics.canCollect;
    collectButton.title = mechanics.canCollect
      ? `Vybrat připravený výstup: ${mechanics.storedOutputLabel}`
      : "Budova zatím nemá co vybrat.";
  }

  if (upgradeButton instanceof HTMLButtonElement) {
    upgradeButton.disabled = !mechanics.nextLevel;
    upgradeButton.title = mechanics.nextLevel
      ? `Upgrade na L${mechanics.nextLevel} za ${formatDistrictBuildingMoney(mechanics.upgradeCost)}`
      : "Budova je na maximálním levelu.";
  }

  if (name) {
    name.textContent = displayLabel;
  }

  if (meta) {
    meta.textContent = [
      displayLabel !== buildingName ? buildingName : "",
      profile.role,
      district?.id ? `District ${district.id}` : "",
      buildingProfile?.setTitle || ""
    ].filter(Boolean).join(" · ");
  }

  if (stats) {
    stats.replaceChildren(
      createDistrictBuildingStat("Čisté / hod", formatDistrictBuildingMoney(mechanics.cleanHourly)),
      createDistrictBuildingStat("Špinavé / hod", formatDistrictBuildingMoney(mechanics.dirtyHourly)),
      createDistrictBuildingStat("Heat / den", `+${mechanics.dailyHeat}`),
      createDistrictBuildingStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createDistrictBuildingStat("Zóna", DISTRICT_BUILDING_TYPE_META[buildingProfile?.typeKey]?.shortLabel || "District"),
      createDistrictBuildingStat("Tier", formatDistrictBuildingTierLabel(buildingProfile?.tier || "mid")),
      createDistrictBuildingStat("Připraveno", mechanics.storedOutputLabel),
      createDistrictBuildingStat("Upgrade", mechanics.nextLevel ? `${formatDistrictBuildingMoney(mechanics.upgradeCost)} -> L${mechanics.nextLevel}` : "Max level")
    );
  }

  if (mechanicsList) {
    mechanicsList.replaceChildren(
      createDistrictBuildingMechanicRow("Výnos", `${formatDistrictBuildingMoney(mechanics.cleanHourly + mechanics.dirtyHourly)} / hod`),
      createDistrictBuildingMechanicRow("Stored output", mechanics.storedOutputLabel),
      createDistrictBuildingMechanicRow("Collect", mechanics.canCollect ? "Připraveno" : "Čeká na produkci"),
      createDistrictBuildingMechanicRow("Cooldown akce", formatDistrictBuildingCooldown(DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS))
    );
  }

  if (effects) {
    effects.textContent = mechanics.effectsLabel || "Žádné aktivní mechaniky.";
  }

  if (info) {
    info.textContent = profile.info;
  }

  if (actions) {
    actions.replaceChildren();
    profile.actions.forEach((action, actionIndex) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "building-info-action-row";
      row.dataset.districtBuildingDetailActionIndex = String(actionIndex);
      const cooldownUntil = Number(mechanics.actionCooldowns?.[actionIndex] || 0);
      const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
      row.disabled = cooldownRemaining > 0;
      const title = document.createElement("strong");
      title.className = "building-info-action-row__title";
      title.textContent = action;
      const description = document.createElement("span");
      description.className = "building-info-action-row__desc";
      description.textContent = getDistrictBuildingActionDescription(action, mechanics, buildingName, actionIndex);
      const cooldown = document.createElement("span");
      cooldown.className = "building-info-action-row__cooldown";
      cooldown.textContent = cooldownRemaining > 0
        ? `Cooldown: ${formatDistrictBuildingCooldown(cooldownRemaining)}`
        : `Cooldown: ${formatDistrictBuildingCooldown(DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS)}`;
      row.append(title, description);
      row.append(cooldown);
      actions.append(row);
    });
  }

  syncDistrictBuildingDetailTabs(shell, shell.dataset.activeDistrictBuildingDetailTab || "stats");
  shell.hidden = false;
}

function getDistrictAtmosphereMeta(district, interactionState = {}) {
  if (!district || isDistrictTypeHidden(district, interactionState)) {
    return DISTRICT_ATMOSPHERE_META.unknown;
  }

  return DISTRICT_ATMOSPHERE_META[district.districtType] || DISTRICT_ATMOSPHERE_META.unknown;
}

function applyDistrictAtmosphere({
  card,
  imageElement,
  labelElement,
  moodElement,
  atmosphereMeta
}) {
  if (card) {
    card.dataset.districtType = atmosphereMeta.typeKey || "unknown";
  }

  if (imageElement instanceof HTMLImageElement) {
    imageElement.src = atmosphereMeta.imagePath;
    imageElement.alt = `${atmosphereMeta.label} – atmosféra města`;
  }

  if (labelElement) {
    labelElement.textContent = atmosphereMeta.label;
  }

  if (moodElement) {
    moodElement.textContent = atmosphereMeta.mood;
  }
}

function getAdjacentDistrictIdsFromGeometry(geometry, districtId) {
  if (!geometry?.districts || districtId === null || districtId === undefined) {
    return [];
  }

  const targetDistrict = geometry.districts.find((district) => district.id === Number(districtId));

  if (!targetDistrict) {
    return [];
  }

  return geometry.districts
    .filter((district) => {
      const rowDistance = Math.abs(district.rowIndex - targetDistrict.rowIndex);
      const columnDistance = Math.abs(district.columnIndex - targetDistrict.columnIndex);
      return district.id !== targetDistrict.id && ((rowDistance === 1 && columnDistance === 0) || (rowDistance === 0 && columnDistance === 1));
    })
    .map((district) => district.id);
}

function renderSpyResourceState(root, { animate = false, instant = false } = {}) {
  const scope = root.ownerDocument || document;
  const spyPill = scope.querySelector(TOPBAR_SPY_PILL_SELECTOR);
  const spyLabel = scope.querySelector(TOPBAR_SPY_LABEL_SELECTOR);
  const spyValue = scope.querySelector(TOPBAR_SPY_VALUE_SELECTOR);
  const spyState = getResolvedSpyState();
  const influenceValue = scope.querySelector(TOPBAR_INFLUENCE_SELECTOR);
  const displaySnapshot = getDisplayedResourceSnapshot();
  const storedInfluenceValue = displaySnapshot.influence;
  const isDistrictResourceMode = displaySnapshot.sourceMode === "district";
  const resourceMode = spyPill?.dataset.resourceMode === "spy" ? "spy" : "influence";

  if (!spyPill || !spyLabel || !spyValue) {
    return spyState;
  }

  spyValue.dataset.influenceValue = String(storedInfluenceValue);
  spyValue.dataset.spyValue = String(spyState.available);
  if (influenceValue) {
    influenceValue.dataset.influenceValue = String(storedInfluenceValue);
    influenceValue.textContent = String(storedInfluenceValue);
  }
  spyLabel.textContent = resourceMode === "spy" ? "Špeh" : "Vliv";

  if (instant) {
    syncMoneyStatToCachedValue(
      spyValue,
      resourceMode === "spy" ? spyState.available : storedInfluenceValue,
      { prefix: "" }
    );
    lastRenderedInfluenceValue = storedInfluenceValue;
    lastRenderedTopbarMode = resourceMode;
  } else if (resourceMode === "spy") {
    stopMoneyStatCounter(spyValue);
    spyValue.textContent = String(spyState.available);
    lastRenderedTopbarMode = resourceMode;
  } else if (lastRenderedTopbarMode === "influence" && lastRenderedInfluenceValue !== null) {
    animateMoneyStatCounter(spyValue, storedInfluenceValue, { prefix: "" });
    if (storedInfluenceValue !== lastRenderedInfluenceValue) {
      animateMoneyStatValue(spyValue, storedInfluenceValue - lastRenderedInfluenceValue);
    }
    lastRenderedTopbarMode = resourceMode;
  } else {
    syncMoneyStatToCachedValue(spyValue, storedInfluenceValue, { prefix: "" });
    lastRenderedTopbarMode = resourceMode;
  }

  lastRenderedInfluenceValue = storedInfluenceValue;

  spyPill.classList.toggle("resource-pill--influence", resourceMode !== "spy");
  spyPill.classList.toggle("resource-pill--spy", resourceMode === "spy");
  spyPill.classList.toggle("is-spies", resourceMode === "spy");

  const shownLabel = resourceMode === "spy"
    ? `${spyState.available} špehů`
    : `${storedInfluenceValue} vlivu`;
  const hiddenLabel = resourceMode === "spy"
    ? `${storedInfluenceValue} vlivu`
    : `${spyState.available} špehů`;
  spyPill.setAttribute(
    "aria-label",
    `${shownLabel}. Klikni pro přepnutí na ${hiddenLabel}.`
  );
  spyPill.title = resourceMode === "spy"
    ? (spyState.available > 0
        ? `Dostupní špehové ${spyState.available}/${MAX_SPIES}. Klikni pro přepnutí na vliv.`
        : "Všichni špehové jsou právě na misi. Klikni pro přepnutí na vliv.")
    : (isDistrictResourceMode
        ? `DEV-ONLY: vliv běží +${formatDistrictMetricNumber(displaySnapshot.influencePerMinute, 2)}/min z ${displaySnapshot.districtCount} distriktů. Klikni pro přepnutí na špehy.`
        : `Vliv: ${storedInfluenceValue}. Klikni pro přepnutí na špehy.`);

  if (animate) {
    spyPill.classList.remove("is-switching");
    void spyPill.offsetWidth;
    spyPill.classList.add("is-switching");
    if (topbarStatSwitchTimer) {
      window.clearTimeout(topbarStatSwitchTimer);
    }
    topbarStatSwitchTimer = window.setTimeout(() => {
      spyPill.classList.remove("is-switching");
      topbarStatSwitchTimer = null;
    }, 340);
  }

  return spyState;
}

function completeSpyMission(root, missionId) {
  const storedSpyState = getStoredSpyState();
  const storedMissions = Array.isArray(storedSpyState?.missions)
    ? storedSpyState.missions.filter((entry) => entry && entry.id)
    : [];
  const mission = storedMissions.find((entry) => entry.id === missionId);

  if (!mission) {
    spyMissionTimers.delete(missionId);
    return;
  }

  const scenarioLabel = resolveSpyScenarioWithBoost(mission);
  const remainingMissions = storedMissions.filter((entry) => entry.id !== missionId);
  const isCapturedOnMajorFail = scenarioLabel === "Neúspěch";

  if (isCapturedOnMajorFail) {
    const cooldownUntil = new Date(Date.now() + SPY_CAPTURE_COOLDOWN_MS).toISOString();
    setStoredSpyState({
      available: clamp(MAX_SPIES - (remainingMissions.length + 1), 0, MAX_SPIES),
      missions: [
        ...remainingMissions,
        {
          ...mission,
          status: "captured",
          capturedAt: new Date().toISOString(),
          cooldownUntil
        }
      ]
    });
  } else {
    setStoredSpyState({
      available: clamp(MAX_SPIES - remainingMissions.length, 0, MAX_SPIES),
      missions: remainingMissions
    });
  }

  renderSpyResourceState(root);
  spyMissionTimers.delete(missionId);

  const spyIntel = getResolvedSpyIntel();
  const worldState = getResolvedWorldState();
  const knownDefensePower = Number(worldState.districtDefenseById?.[mission.targetDistrictId] ?? 0);

  if (scenarioLabel === "Úspěch") {
    setStoredSpyIntel({
      occupiableDistrictIds: Array.from(new Set([
        ...spyIntel.occupiableDistrictIds,
        Number(mission.targetDistrictId)
      ])),
      revealedTypeDistrictIds: Array.from(new Set([
        ...(spyIntel.revealedTypeDistrictIds || []),
        Number(mission.targetDistrictId)
      ])),
      revealedDefenseDistrictIds: Array.from(new Set([
        ...(spyIntel.revealedDefenseDistrictIds || []),
        Number(mission.targetDistrictId)
      ]))
    });
  } else if (scenarioLabel === "Částečný úspěch") {
    setStoredSpyIntel({
      occupiableDistrictIds: spyIntel.occupiableDistrictIds,
      revealedTypeDistrictIds: Array.from(new Set([
        ...(spyIntel.revealedTypeDistrictIds || []),
        Number(mission.targetDistrictId)
      ])),
      revealedDefenseDistrictIds: spyIntel.revealedDefenseDistrictIds || []
    });
  }

  recordDistrictIntelEvent({
    type: scenarioLabel === "Úspěch" ? "spy_success" : scenarioLabel === "Částečný úspěch" ? "spy_partial" : "spy_failed",
    districtId: mission.targetDistrictId,
    sourceDistrictId: mission.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel
  });

  const isUnownedDistrict = isDistrictUnownedForSpyResult(mission.targetDistrictId, mission.ownerLabel);
  const spyResultPayload = {
    tone: scenarioLabel === "Úspěch" ? "is-success" : scenarioLabel === "Částečný úspěch" ? "is-medium-fail" : "is-major-fail",
    title: scenarioLabel === "Úspěch" ? "Špehování: Úspěch" : scenarioLabel === "Částečný úspěch" ? "Špehování: Částečný neúspěch" : "Špehování: Velký neúspěch",
    summary: scenarioLabel === "Úspěch"
      ? pickRandomQuote(
          isUnownedDistrict ? SPY_SUCCESS_EMPTY_DISTRICT_QUOTES : SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES,
          `Špehování distriktu District ${mission.targetDistrictId} dopadlo úspěšně.`
        )
      : scenarioLabel === "Částečný úspěch"
        ? pickRandomQuote(
            isUnownedDistrict ? SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES : SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES,
            `Akce v District ${mission.targetDistrictId} nedopadla dobře, ale tvůj špeh se vrátil.`
          )
        : pickRandomQuote(
            isUnownedDistrict ? SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES : SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES,
            `Špeh byl v districtu District ${mission.targetDistrictId} zajat.`
          ),
    rows: scenarioLabel === "Úspěch"
      ? buildSpyResultRows(mission.targetDistrictId, mission, {
          defensePower: knownDefensePower
        })
      : scenarioLabel === "Částečný úspěch"
        ? buildSpyResultRows(mission.targetDistrictId, mission, {
            defensePower: knownDefensePower,
            spyStatusLabel: "Vrátil se",
            showWeapons: false,
            showPowerRange: false,
            showAtmosphere: false,
            showBuildings: false
          })
        : [
            { label: "Stav špeha", value: "Zajat" },
            { label: "Cooldown", value: formatDurationLabel(SPY_CAPTURE_COOLDOWN_MS), nowrap: true }
          ]
  };
  syncBuildingActionSource(root, {
    tone: scenarioLabel === "Úspěch" ? "success" : scenarioLabel === "Částečný úspěch" ? "warning" : "error",
    title: spyResultPayload.title,
    summary: spyResultPayload.summary,
    meta: `Zdroj ${mission.sourceDistrictId} · Cíl ${mission.targetDistrictId} · ${scenarioLabel}`,
    resultKind: "spy",
    resultPayload: spyResultPayload
  });
  appendBuildingActionResultEntry(root, "spy", spyResultPayload);
  queueOrOpenResultModal(root, "spy", spyResultPayload);

  if (scenarioLabel === "Neúspěch" && isCurrentPlayerOwnedDistrict(mission.targetDistrictId)) {
    queueOrOpenResultModal(root, "spy_alert", createSpyDetectionAlertPayload(mission.targetDistrictId));
  }
}

function scheduleSpyMission(root, mission) {
  if (!mission?.id || spyMissionTimers.has(mission.id)) {
    return;
  }

  const remainingMs = getSpyMissionExpiryTimestamp(mission) - Date.now();

  if (remainingMs <= 0) {
    if (getSpyMissionPhase(mission) === "captured") {
      const spyState = getResolvedSpyState();
      const remainingMissions = spyState.missions.filter((entry) => entry.id !== mission.id);
      setStoredSpyState({
        available: clamp(MAX_SPIES - remainingMissions.length, 0, MAX_SPIES),
        missions: remainingMissions
      });
      renderSpyResourceState(root);
      spyMissionTimers.delete(mission.id);
    } else {
      completeSpyMission(root, mission.id);
    }
    return;
  }

  const timerId = window.setTimeout(() => {
    if (getSpyMissionPhase(mission) === "captured") {
      const spyState = getResolvedSpyState();
      const remainingMissions = spyState.missions.filter((entry) => entry.id !== mission.id);
      setStoredSpyState({
        available: clamp(MAX_SPIES - remainingMissions.length, 0, MAX_SPIES),
        missions: remainingMissions
      });
      renderSpyResourceState(root);
      spyMissionTimers.delete(mission.id);
      return;
    }

    completeSpyMission(root, mission.id);
  }, remainingMs);

  spyMissionTimers.set(mission.id, timerId);
}

function bindSpyMissions(root) {
  const spyState = renderSpyResourceState(root);

  for (const mission of spyState.missions) {
    scheduleSpyMission(root, mission);
  }
}

function showSpyToast(root) {
  const toast = root.querySelector(SPY_TOAST_SELECTOR);

  if (!toast) {
    return;
  }

  if (spyToastTimerId !== null) {
    window.clearTimeout(spyToastTimerId);
  }

  toast.hidden = false;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  spyToastTimerId = window.setTimeout(() => {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 1800);
}

function showAttackToast(root) {
  const toast = root.querySelector(ATTACK_TOAST_SELECTOR);

  if (!toast) {
    return;
  }

  if (attackToastTimerId !== null) {
    window.clearTimeout(attackToastTimerId);
  }

  toast.hidden = false;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  attackToastTimerId = window.setTimeout(() => {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 1800);
}

function showRobberyToast(root) {
  const toast = root.querySelector(ROBBERY_TOAST_SELECTOR);

  if (!toast) {
    return;
  }

  if (robberyToastTimerId !== null) {
    window.clearTimeout(robberyToastTimerId);
  }

  toast.hidden = false;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  robberyToastTimerId = window.setTimeout(() => {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 1800);
}

function getDistrictFillStyle(district, isNight, interactionState = {}) {
  if (interactionState.destroyedDistrictIds?.has(district.id)) {
    return isNight ? "rgba(255, 96, 96, 0.16)" : "rgba(98, 28, 28, 0.24)";
  }

  const ownedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  const gamePhase = interactionState.gamePhase || "launch";

  if (gamePhase === "launch" && !ownedDistrictIds.has(district.id)) {
    return "rgba(0, 0, 0, 0)";
  }

  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;
  const launchOwnerId = gamePhase === "launch"
    ? launchOwnerByDistrictId.get(district.id)
    : null;

  if (launchOwnerId) {
    const playerColor = getLaunchPlayerColor(launchOwnerId);
    return applyHexAlpha(playerColor, "33");
  }

  if (ownedDistrictIds.has(district.id)) {
    const playerColor = getCurrentPlayerGangColor();
    return applyHexAlpha(playerColor, "33");
  }

  if (isDistrictTypeHidden(district, interactionState)) {
    return isNight ? "rgba(196, 210, 224, 0.08)" : "rgba(214, 228, 240, 0.11)";
  }

  const palette = {
    downtown: isNight ? "rgba(255, 71, 194, 0.18)" : "rgba(255, 71, 194, 0.24)",
    industrial: isNight ? "rgba(255, 154, 61, 0.12)" : "rgba(255, 154, 61, 0.18)",
    resident: isNight ? "rgba(103, 225, 255, 0.10)" : "rgba(103, 225, 255, 0.14)",
    economy: isNight ? "rgba(113, 255, 188, 0.11)" : "rgba(113, 255, 188, 0.16)",
    park: isNight ? "rgba(165, 255, 89, 0.09)" : "rgba(165, 255, 89, 0.14)"
  };

  return palette[district.districtType] || palette.resident;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.src = source;
  });
}

function createStops(segmentCount, totalSize, random) {
  const step = totalSize / segmentCount;
  const stops = Array.from({ length: segmentCount + 1 }, (_, index) => index * step);

  for (let index = 1; index < stops.length - 1; index += 1) {
    const jitter = (random() - 0.5) * step * 0.18;
    stops[index] += jitter;
  }

  stops[0] = 0;
  stops[stops.length - 1] = totalSize;
  return stops;
}

function clipPolygonAgainstBisector(polygon, site, otherSite) {
  const dx = otherSite.x - site.x;
  const dy = otherSite.y - site.y;
  const midpointX = (site.x + otherSite.x) / 2;
  const midpointY = (site.y + otherSite.y) / 2;
  const signedDistance = (point) => ((point.x - midpointX) * dx) + ((point.y - midpointY) * dy);
  const clipped = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentDistance = signedDistance(current);
    const nextDistance = signedDistance(next);
    const currentInside = currentDistance <= 0;
    const nextInside = nextDistance <= 0;

    if (currentInside) {
      clipped.push(current);
    }

    if (currentInside !== nextInside) {
      const denominator = currentDistance - nextDistance;
      const ratio = Math.abs(denominator) < 0.00001 ? 0 : currentDistance / denominator;

      clipped.push({
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio
      });
    }
  }

  return clipped;
}

function remapDistrictId(districtId) {
  if (districtId === 57) {
    return 104;
  }

  if (districtId === 104) {
    return 57;
  }

  if (districtId === 58) {
    return 103;
  }

  if (districtId === 103) {
    return 58;
  }

  if (districtId === 102) {
    return 83;
  }

  if (districtId === 83) {
    return 102;
  }

  if (districtId === 59) {
    return 105;
  }

  if (districtId === 105) {
    return 59;
  }

  return districtId;
}

function remapDistrictType(districtId, typeByDistrictId) {
  return typeByDistrictId.get(remapDistrictId(districtId)) || typeByDistrictId.get(districtId) || "resident";
}

function createDistrictGeometry(width, height, insetX = 0, insetTop = 0, insetBottom = 0) {
  const columns = 23;
  const rows = 7;
  const random = createSeededRandom(20260419);
  const innerWidth = width - insetX * 2;
  const innerHeight = height - insetTop - insetBottom;
  const xStops = createStops(columns, innerWidth, random).map((value) => value + insetX);
  const yStops = createStops(rows, innerHeight, random).map((value) => value + insetTop);
  const districts = [];
  const sites = [];
  const typeByDistrictId = new Map();
  let districtId = 1;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cellLeft = xStops[columnIndex];
      const cellRight = xStops[columnIndex + 1];
      const cellTop = yStops[rowIndex];
      const cellBottom = yStops[rowIndex + 1];
      const cellWidth = cellRight - cellLeft;
      const cellHeight = cellBottom - cellTop;
      const districtType = classifyDistrictType(rowIndex, columnIndex);
      const siteHash = hashCell(rowIndex + 101, columnIndex + 131);
      const staggerOffset = rowIndex % 2 === 0 ? cellWidth * 0.14 : -cellWidth * 0.14;
      const centerX = (cellLeft + cellRight) / 2
        + staggerOffset
        + ((siteHash % 7) - 3) * cellWidth * 0.035;
      const centerY = (cellTop + cellBottom) / 2
        + (((Math.floor(siteHash / 7)) % 7) - 3) * cellHeight * 0.045;

      sites.push({
        id: districtId,
        rowIndex,
        columnIndex,
        districtType,
        x: clamp(centerX, cellLeft + cellWidth * 0.16, cellRight - cellWidth * 0.16),
        y: clamp(centerY, cellTop + cellHeight * 0.18, cellBottom - cellHeight * 0.18)
      });
      typeByDistrictId.set(districtId, districtType);

      districtId += 1;
    }
  }

  for (const site of sites) {
    let polygon = [
      { x: insetX, y: insetTop },
      { x: width - insetX, y: insetTop },
      { x: width - insetX, y: height - insetBottom },
      { x: insetX, y: height - insetBottom }
    ];

    const candidateNeighbors = sites
      .filter((otherSite) => otherSite.id !== site.id)
      .map((otherSite) => ({
        otherSite,
        distance: ((otherSite.x - site.x) ** 2) + ((otherSite.y - site.y) ** 2)
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 18);

    for (const { otherSite } of candidateNeighbors) {
      polygon = clipPolygonAgainstBisector(polygon, site, otherSite);

      if (polygon.length < 3) {
        break;
      }
    }

    if (polygon.length >= 3) {
      districts.push({
        id: remapDistrictId(site.id),
        rowIndex: site.rowIndex,
        columnIndex: site.columnIndex,
        districtType: remapDistrictType(site.id, typeByDistrictId),
        centerX: site.x,
        centerY: site.y,
        polygon
      });
    }
  }

  return { districts, xStops, yStops, width, height };
}

function drawDistrictPolygon(context, polygon) {
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);

  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }

  context.closePath();
}

function drawDistrictPolygonPath(context, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  drawDistrictPolygon(context, polygon);
  return true;
}

function getPolygonBounds(polygon) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of polygon || []) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function isPointInsidePolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function resolveAttackFlameAnchorCount(bounds) {
  const width = Math.max(20, Number(bounds?.width || 0));
  const height = Math.max(20, Number(bounds?.height || 0));
  const area = width * height;
  return Math.max(3, Math.min(8, Math.round(area / 8800) + 3));
}

function createAttackFlameAnchors(district, marker, bounds) {
  const polygon = Array.isArray(district?.polygon) ? district.polygon : [];

  if (polygon.length < 3) {
    return [];
  }

  const safeBounds = bounds && Number.isFinite(bounds.width) ? bounds : getPolygonBounds(polygon);
  const width = Math.max(20, safeBounds.width || 0);
  const height = Math.max(20, safeBounds.height || 0);
  const targetCount = resolveAttackFlameAnchorCount(safeBounds);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 1;
  const random = createSeededRandom(safeSeed ^ 0x4c7f9d1b);
  const anchors = [];

  let tries = 0;
  const maxTries = targetCount * 90;

  while (anchors.length < targetCount && tries < maxTries) {
    const candidate = {
      x: safeBounds.minX + random() * width,
      y: safeBounds.minY + random() * height
    };

    if (!isPointInsidePolygon(candidate, polygon)) {
      tries += 1;
      continue;
    }

    const tooClose = anchors.some((existing) => Math.hypot(candidate.x - existing.x, candidate.y - existing.y) < Math.min(width, height) * 0.16);

    if (tooClose) {
      tries += 1;
      continue;
    }

    anchors.push({
      ...candidate,
      scale: 0.62 + random() * 0.9,
      phase: random() * Math.PI * 2,
      jitter: 0.45 + random() * 0.65
    });
    tries += 1;
  }

  return anchors;
}

function getAttackFlameAnchors(district, marker, bounds) {
  if (!marker || typeof marker !== "object") {
    return [];
  }

  if (!Array.isArray(marker.flameAnchors) || !marker.flameAnchors.length) {
    marker.flameAnchors = createAttackFlameAnchors(district, marker, bounds);
  }

  return marker.flameAnchors;
}

function drawAttackAmbientSmokeAroundDistrict(context, marker, now, centerX, centerY, bounds, pulse, lifeRatio) {
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
  const spreadBase = Math.max(34, Math.min(120, Math.max(bounds.width || 34, bounds.height || 34) * 0.6));
  const intensity = Math.max(0.06, 0.18 - lifeRatio * 0.06);

  context.save();
  context.globalCompositeOperation = "source-over";

  for (let index = 0; index < 4; index += 1) {
    const angle = (Math.PI * 2 * index) / 4 + (safeSeed % 31) * 0.04;
    const drift = Math.sin(now / 980 + index * 0.7 + safeSeed * 0.00007);
    const smokeX = centerX + Math.cos(angle) * spreadBase * (0.42 + index * 0.08) + drift * spreadBase * 0.08;
    const smokeY = centerY + Math.sin(angle) * spreadBase * (0.26 + index * 0.06) - spreadBase * 0.14;
    const radius = spreadBase * (0.95 + pulse * 0.2 + index * 0.18);
    const coreAlpha = intensity * (0.65 - index * 0.1);

    if (coreAlpha <= 0.01) {
      continue;
    }

    const gradient = context.createRadialGradient(smokeX, smokeY, radius * 0.12, smokeX, smokeY, radius);
    gradient.addColorStop(0, `rgba(26, 26, 30, ${coreAlpha.toFixed(3)})`);
    gradient.addColorStop(0.6, `rgba(18, 18, 22, ${(coreAlpha * 0.55).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(10, 10, 12, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAttackSmokeInDistrict(context, district, marker, now, centerX, centerY, bounds, pulse, lifeRatio) {
  if (!drawDistrictPolygonPath(context, district.polygon)) {
    return;
  }

  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : 0;
  const random = createSeededRandom(safeSeed ^ 0x1e3d5a77);
  const baseRadius = Math.max(16, Math.min(52, Math.min(bounds.width || 16, bounds.height || 16) * 0.42));
  const smokeStrength = Math.max(0.24, 0.52 - lifeRatio * 0.17);

  context.save();
  drawDistrictPolygonPath(context, district.polygon);
  context.clip();

  for (let index = 0; index < 8; index += 1) {
    const drift = Math.sin(now / 820 + index * 0.62 + safeSeed * 0.00013);
    const x = centerX + (random() - 0.5) * baseRadius * 1.6 + drift * baseRadius * 0.14;
    const y = centerY - baseRadius * (0.32 + random() * 0.3) - Math.abs(drift) * baseRadius * 0.18;
    const radius = baseRadius * (0.65 + random() * 0.85 + pulse * 0.16);
    const alphaCore = smokeStrength * (0.7 + random() * 0.3);
    const alphaMid = alphaCore * 0.62;
    const gradient = context.createRadialGradient(x, y, radius * 0.16, x, y, radius);
    gradient.addColorStop(0, `rgba(28, 28, 32, ${alphaCore.toFixed(3)})`);
    gradient.addColorStop(0.58, `rgba(20, 20, 24, ${alphaMid.toFixed(3)})`);
    gradient.addColorStop(1, "rgba(12, 12, 14, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAttackFlameSprite(context, x, y, size, alpha, phase, pulse) {
  const safeSize = Math.max(10, Number(size || 0));
  const safeAlpha = Math.max(0.12, Math.min(1, Number(alpha || 0)));
  const wobble = Math.sin(Date.now() / 140 + Number(phase || 0)) * safeSize * 0.05;

  context.save();
  context.translate(x, y);
  context.scale(1 + pulse * 0.04, 1 + pulse * 0.08);
  context.globalAlpha = safeAlpha;

  const outerGradient = context.createLinearGradient(0, safeSize * 0.62, 0, -safeSize * 0.88);
  outerGradient.addColorStop(0, "rgba(120, 16, 0, 0.96)");
  outerGradient.addColorStop(0.36, "rgba(255, 94, 0, 0.94)");
  outerGradient.addColorStop(0.72, "rgba(255, 174, 36, 0.9)");
  outerGradient.addColorStop(1, "rgba(255, 241, 153, 0.84)");

  context.beginPath();
  context.moveTo(0, -safeSize * 0.92 + wobble);
  context.bezierCurveTo(
    safeSize * 0.52, -safeSize * 0.48,
    safeSize * 0.62, safeSize * 0.04,
    0, safeSize * 0.7
  );
  context.bezierCurveTo(
    -safeSize * 0.62, safeSize * 0.04,
    -safeSize * 0.52, -safeSize * 0.48,
    0, -safeSize * 0.92 + wobble
  );
  context.closePath();
  context.fillStyle = outerGradient;
  context.shadowBlur = safeSize * 0.5;
  context.shadowColor = "rgba(255, 98, 0, 0.72)";
  context.fill();

  const innerGradient = context.createLinearGradient(0, safeSize * 0.48, 0, -safeSize * 0.56);
  innerGradient.addColorStop(0, "rgba(255, 164, 40, 0.92)");
  innerGradient.addColorStop(0.46, "rgba(255, 219, 115, 0.9)");
  innerGradient.addColorStop(1, "rgba(255, 248, 214, 0.82)");

  context.beginPath();
  context.moveTo(0, -safeSize * 0.56 + wobble * 0.6);
  context.bezierCurveTo(
    safeSize * 0.28, -safeSize * 0.22,
    safeSize * 0.26, safeSize * 0.1,
    0, safeSize * 0.42
  );
  context.bezierCurveTo(
    -safeSize * 0.26, safeSize * 0.1,
    -safeSize * 0.28, -safeSize * 0.22,
    0, -safeSize * 0.56 + wobble * 0.6
  );
  context.closePath();
  context.fillStyle = innerGradient;
  context.shadowBlur = safeSize * 0.24;
  context.shadowColor = "rgba(255, 214, 120, 0.7)";
  context.fill();
  context.restore();
}

function getPointOnPolygonPerimeter(polygon, progress) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return null;
  }

  const segments = [];
  let totalLength = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  if (totalLength <= 0) {
    return polygon[0];
  }

  let targetDistance = (progress % 1) * totalLength;

  for (const segment of segments) {
    if (targetDistance <= segment.length) {
      const ratio = segment.length <= 0 ? 0 : targetDistance / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      };
    }

    targetDistance -= segment.length;
  }

  return polygon[0];
}

function drawSpyDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.3, 1 - lifeRatio * 0.5);
  const sweepAngle = now / 470 + safeSeed * 0.00021;
  const coneSpread = 0.36 + Math.sin(now / 620 + safeSeed * 0.00031) * 0.08;
  const maxDimension = Math.max(26, Math.max(bounds.width || 26, bounds.height || 26));
  const beamLength = Math.max(42, Math.min(170, maxDimension * 1.5));
  const originRadiusX = Math.max(10, (bounds.width || 24) * 0.24);
  const originRadiusY = Math.max(8, (bounds.height || 24) * 0.2);
  const originX = district.centerX + Math.cos(sweepAngle * 0.58 + 1.05) * originRadiusX;
  const originY = district.centerY + Math.sin(sweepAngle * 0.54 + 0.67) * originRadiusY;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();
    context.globalCompositeOperation = "screen";

    const beam = context.createRadialGradient(originX, originY, beamLength * 0.05, originX, originY, beamLength);
    beam.addColorStop(0, `rgba(242, 255, 216, ${(0.42 * fade).toFixed(3)})`);
    beam.addColorStop(0.28, `rgba(206, 250, 255, ${(0.26 * fade).toFixed(3)})`);
    beam.addColorStop(0.7, `rgba(120, 214, 255, ${(0.1 * fade).toFixed(3)})`);
    beam.addColorStop(1, "rgba(88, 180, 255, 0)");
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(originX, originY);
    context.arc(originX, originY, beamLength, sweepAngle - coneSpread, sweepAngle + coneSpread);
    context.closePath();
    context.fill();

    const haloRadius = Math.max(14, Math.min(44, maxDimension * 0.34));
    const halo = context.createRadialGradient(originX, originY, haloRadius * 0.1, originX, originY, haloRadius);
    halo.addColorStop(0, `rgba(246, 255, 230, ${(0.5 * fade).toFixed(3)})`);
    halo.addColorStop(0.65, `rgba(172, 234, 255, ${(0.2 * fade).toFixed(3)})`);
    halo.addColorStop(1, "rgba(100, 186, 255, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(originX, originY, haloRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = `rgba(242, 255, 218, ${(0.72 * fade).toFixed(3)})`;
  context.shadowBlur = 12;
  context.shadowColor = "rgba(214, 249, 255, 0.9)";
  context.beginPath();
  context.arc(originX, originY, 3.6 + Math.sin(now / 120 + safeSeed * 0.0009) * 0.8, 0, Math.PI * 2);
  context.fill();

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.strokeStyle = `rgba(166, 235, 255, ${(0.42 * fade).toFixed(3)})`;
    context.lineWidth = 1.2 + Math.sin(now / 280 + safeSeed * 0.0012) * 0.4;
    context.setLineDash([4, 6]);
    context.lineDashOffset = -((now / 48 + safeSeed) % 150);
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();
}

function drawPoliceDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const minDimension = Math.max(22, Math.min(bounds.width || 22, bounds.height || 22));
  const baseRadius = Math.max(22, Math.min(64, minDimension * 0.52));
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.34, 1 - lifeRatio * 0.45);
  const redPulse = 0.28 + ((Math.sin(now / 145 + safeSeed * 0.0012) + 1) * 0.5) * 0.72;
  const bluePulse = 0.28 + ((Math.sin(now / 145 + Math.PI + safeSeed * 0.0012) + 1) * 0.5) * 0.72;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();
    context.globalCompositeOperation = "screen";

    const redGlow = context.createRadialGradient(
      district.centerX - baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 0.12,
      district.centerX - baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 1.45
    );
    redGlow.addColorStop(0, `rgba(255, 88, 92, ${(0.44 * redPulse * fade).toFixed(3)})`);
    redGlow.addColorStop(0.62, `rgba(255, 52, 62, ${(0.2 * redPulse * fade).toFixed(3)})`);
    redGlow.addColorStop(1, "rgba(255, 38, 48, 0)");
    context.fillStyle = redGlow;
    context.beginPath();
    context.arc(district.centerX - baseRadius * 0.32, district.centerY - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
    context.fill();

    const blueGlow = context.createRadialGradient(
      district.centerX + baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 0.12,
      district.centerX + baseRadius * 0.32,
      district.centerY - baseRadius * 0.04,
      baseRadius * 1.45
    );
    blueGlow.addColorStop(0, `rgba(64, 179, 255, ${(0.44 * bluePulse * fade).toFixed(3)})`);
    blueGlow.addColorStop(0.62, `rgba(50, 122, 255, ${(0.2 * bluePulse * fade).toFixed(3)})`);
    blueGlow.addColorStop(1, "rgba(42, 90, 255, 0)");
    context.fillStyle = blueGlow;
    context.beginPath();
    context.arc(district.centerX + baseRadius * 0.32, district.centerY - baseRadius * 0.04, baseRadius * 1.45, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  const beaconCount = 4;
  const ringRadius = baseRadius * 0.62;
  for (let index = 0; index < beaconCount; index += 1) {
    const pulse = index % 2 === 0 ? redPulse : bluePulse;
    const isRed = index % 2 === 0;
    const angle = now / 780 + index * ((Math.PI * 2) / beaconCount) + safeSeed * 0.00019;
    const x = district.centerX + Math.cos(angle) * ringRadius;
    const y = district.centerY + Math.sin(angle) * ringRadius * 0.72;
    const beamRadius = baseRadius * (1.62 + pulse * 0.44);
    const beamDirection = now / 330 * (isRed ? 1 : -1) + index * 0.8;
    const beamSpread = 0.36 + pulse * 0.2;
    const beaconColor = isRed
      ? `rgba(255, 66, 72, ${(0.3 + pulse * 0.42) * fade})`
      : `rgba(56, 164, 255, ${(0.3 + pulse * 0.42) * fade})`;

    context.fillStyle = beaconColor;
    context.shadowBlur = 10 + pulse * 14;
    context.shadowColor = isRed ? "rgba(255, 58, 70, 0.95)" : "rgba(52, 150, 255, 0.95)";
    context.beginPath();
    context.arc(x, y, 3.2 + pulse * 3.4, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = (0.1 + pulse * 0.16) * fade;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, beamRadius, beamDirection - beamSpread * 0.5, beamDirection + beamSpread * 0.5);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  if (drawDistrictPolygonPath(context, district.polygon)) {
    const borderMix = redPulse - bluePulse;
    context.strokeStyle = borderMix >= 0
      ? `rgba(255, 92, 96, ${Math.max(0.28, 0.4 * fade)})`
      : `rgba(68, 172, 255, ${Math.max(0.28, 0.4 * fade)})`;
    context.lineWidth = 1.2 + Math.max(redPulse, bluePulse) * 1.3;
    context.setLineDash([6, 5]);
    context.lineDashOffset = -((now / 52 + safeSeed) % 130);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
}

function drawAttackDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const baseRadius = Math.max(16, Math.min(46, Math.min(bounds.width || 16, bounds.height || 16) * 0.36));
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const pulse = 0.86 + Math.sin(now / 170 + safeSeed * 0.0017) * 0.18;
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const alpha = Math.max(0.32, 0.86 - lifeRatio * 0.42);
  const flameAnchors = getAttackFlameAnchors(district, marker || { seed: safeSeed }, bounds);

  drawAttackAmbientSmokeAroundDistrict(context, marker || { seed: safeSeed }, now, district.centerX, district.centerY, bounds, pulse, lifeRatio);
  drawAttackSmokeInDistrict(context, district, marker || { seed: safeSeed }, now, district.centerX, district.centerY, bounds, pulse, lifeRatio);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = alpha * 0.9;

  const glowRadius = baseRadius * (1.08 + pulse * 0.26);
  const glow = context.createRadialGradient(district.centerX, district.centerY, baseRadius * 0.16, district.centerX, district.centerY, glowRadius);
  glow.addColorStop(0, "rgba(255, 250, 205, 0.92)");
  glow.addColorStop(0.26, "rgba(255, 181, 82, 0.72)");
  glow.addColorStop(0.6, "rgba(255, 92, 0, 0.52)");
  glow.addColorStop(1, "rgba(255, 53, 0, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(district.centerX, district.centerY, glowRadius, 0, Math.PI * 2);
  context.fill();

  const coreFlameSize = Math.max(18, Math.round(baseRadius * (1.02 + pulse * 0.22)));
  const coreWobbleX = Math.sin(now / 175 + safeSeed * 0.0011) * 1.8;
  const coreWobbleY = Math.cos(now / 145 + safeSeed * 0.0014) * 1.1
    - Math.abs(Math.sin(now / 220 + safeSeed * 0.0008)) * 1.6;
  context.globalAlpha = Math.max(0.46, alpha * 0.92);
  drawAttackFlameSprite(
    context,
    district.centerX + coreWobbleX,
    district.centerY + coreWobbleY,
    coreFlameSize,
    Math.max(0.42, alpha * 0.9),
    safeSeed * 0.00021,
    pulse
  );

  flameAnchors.forEach((anchor) => {
    const safeScale = Math.max(0.5, Math.min(1.7, Number(anchor?.scale || 1)));
    const phase = Number(anchor?.phase || 0);
    const jitterPower = Math.max(0.2, Number(anchor?.jitter || 0.8));
    const wobbleX = Math.sin(now / 205 + phase) * jitterPower * 1.1;
    const wobbleY = Math.cos(now / 165 + phase * 1.7) * jitterPower * 0.82
      - Math.abs(Math.sin(now / 260 + phase)) * 1.7;
    const flameSize = Math.max(
      12,
      Math.round(baseRadius * safeScale * (0.62 + pulse * 0.24 + Math.sin(now / 145 + phase) * 0.12))
    );

    context.globalAlpha = Math.max(0.28, alpha * (0.66 + safeScale * 0.18));
    drawAttackFlameSprite(
      context,
      Number(anchor.x || district.centerX) + wobbleX,
      Number(anchor.y || district.centerY) + wobbleY,
      flameSize * 0.82,
      Math.max(0.3, alpha * (0.78 + safeScale * 0.16)),
      phase,
      pulse
    );
    context.globalAlpha = Math.max(0.2, alpha * (0.36 + safeScale * 0.08));
    context.font = `${flameSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowBlur = 8 + flameSize * 0.4;
    context.shadowColor = "rgba(255, 113, 0, 0.9)";
    context.fillText("🔥", Number(anchor.x || district.centerX) + wobbleX, Number(anchor.y || district.centerY) + wobbleY);
  });

  context.globalAlpha = alpha * 0.54;
  context.fillStyle = "rgba(255,132,24,0.36)";
  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7 + now / 700 + safeSeed * 0.00004;
    const radius = baseRadius * (0.14 + (index % 3) * 0.08);
    const x = district.centerX + Math.cos(angle) * radius;
    const y = district.centerY + Math.sin(angle) * radius * 0.7 - baseRadius * 0.18;
    const size = 1.2 + (index % 2) * 0.7;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = Math.max(0.2, alpha * 0.72);
  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.strokeStyle = `rgba(255, 92, 0, ${Math.min(0.9, 0.5 + pulse * 0.25)})`;
    context.lineWidth = 1.2 + pulse * 0.95;
    context.setLineDash([7, 5]);
    context.lineDashOffset = -((now / 40 + safeSeed) % 180);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();
}

function drawRobberyDistrictAnimation(context, district, marker, now = Date.now()) {
  if (!district || !Array.isArray(district.polygon) || district.polygon.length < 3) {
    return;
  }

  const bounds = getPolygonBounds(district.polygon);
  const safeSeed = Number.isFinite(Number(marker?.seed)) ? Number(marker.seed) : Number(district.id) || 0;
  const minDimension = Math.max(24, Math.min(bounds.width || 24, bounds.height || 24));
  const maxDimension = Math.max(28, Math.max(bounds.width || 28, bounds.height || 28));
  const lifeRatio = marker?.startedAt && marker?.expiresAt && marker.expiresAt > marker.startedAt
    ? clamp((now - marker.startedAt) / (marker.expiresAt - marker.startedAt), 0, 1)
    : 0;
  const fade = Math.max(0.24, 1 - lifeRatio * 0.38);
  const flicker = 0.42 + ((Math.sin(now / 70 + safeSeed * 0.0021) + 1) * 0.5) * 0.58;

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    drawDistrictPolygonPath(context, district.polygon);
    context.clip();

    const sweepWidth = Math.max(18, minDimension * 0.46);
    for (let index = 0; index < 3; index += 1) {
      const progress = ((now / (420 + index * 80)) + safeSeed * 0.0007 + index * 0.31) % 1;
      const shadowX = bounds.minX - sweepWidth + progress * (bounds.width + sweepWidth * 2);
      const shadowAlpha = (0.12 + flicker * 0.2) * fade * (1 - index * 0.12);
      const gradient = context.createLinearGradient(shadowX, bounds.minY, shadowX + sweepWidth, bounds.maxY);
      gradient.addColorStop(0, "rgba(3,4,7,0)");
      gradient.addColorStop(0.45, `rgba(3,4,7,${shadowAlpha.toFixed(3)})`);
      gradient.addColorStop(1, "rgba(3,4,7,0)");
      context.fillStyle = gradient;
      context.fillRect(shadowX, bounds.minY - 8, sweepWidth, (bounds.height || 20) + 16);
    }

    for (let index = 0; index < 5; index += 1) {
      const phase = (now / (95 + index * 22) + safeSeed * 0.0014 + index) % 1;
      const lineY = bounds.minY + phase * Math.max(12, bounds.height);
      const lineHeight = 1.2 + (index % 2) * 1.4;
      const lineWidth = Math.max(16, maxDimension * (0.42 + (index % 3) * 0.16));
      const offsetX = Math.sin(now / 85 + index + safeSeed * 0.0009) * maxDimension * 0.22;
      context.fillStyle = `rgba(148,163,184,${(0.12 + flicker * 0.14).toFixed(3)})`;
      context.fillRect(district.centerX - lineWidth / 2 + offsetX, lineY, lineWidth, lineHeight);
    }

    context.fillStyle = `rgba(2, 6, 12, ${(0.16 + flicker * 0.12).toFixed(3)})`;
    context.beginPath();
    context.arc(district.centerX, district.centerY, Math.max(16, minDimension * 0.36), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  if (drawDistrictPolygonPath(context, district.polygon)) {
    context.save();
    context.strokeStyle = `rgba(71, 85, 105, ${(0.2 + flicker * 0.16).toFixed(3)})`;
    context.lineWidth = 1.2 + flicker * 0.8;
    context.setLineDash([5, 7]);
    context.lineDashOffset = -((now / 38 + safeSeed) % 140);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}

function drawTrapDistrictAnimation(context, district, animationProgress) {
  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.clip();

  const pulse = 0.5 + Math.sin(animationProgress * Math.PI * 2) * 0.5;
  const smokeLayers = [
    { offsetX: -24, offsetY: -12, radius: 26, phase: 0.08 },
    { offsetX: 18, offsetY: -18, radius: 22, phase: 0.31 },
    { offsetX: -8, offsetY: 16, radius: 28, phase: 0.57 },
    { offsetX: 26, offsetY: 10, radius: 18, phase: 0.81 }
  ];

  for (const layer of smokeLayers) {
    const drift = ((animationProgress + layer.phase) % 1) * 18;
    const gradient = context.createRadialGradient(
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      4,
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      layer.radius + pulse * 6
    );
    gradient.addColorStop(0, `rgba(160, 255, 96, ${0.18 + pulse * 0.12})`);
    gradient.addColorStop(0.4, `rgba(96, 255, 162, ${0.12 + pulse * 0.08})`);
    gradient.addColorStop(1, "rgba(96, 255, 162, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(
      district.centerX + layer.offsetX + drift * 0.3,
      district.centerY + layer.offsetY - drift * 0.45,
      layer.radius + pulse * 6,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  context.restore();

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = `rgba(160, 255, 96, ${0.22 + pulse * 0.18})`;
  context.lineWidth = 2;
  context.shadowBlur = 18;
  context.shadowColor = "rgba(160, 255, 96, 0.45)";
  context.stroke();
  context.restore();
}

function drawOccupyDistrictAnimation(context, district, animationProgress) {
  context.save();
  const playerColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
  const pulse = 0.5 + Math.sin(animationProgress * Math.PI * 4) * 0.5;
  const alpha = 0.18 + pulse * 0.28;

  drawDistrictPolygon(context, district.polygon);
  context.fillStyle = `${playerColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  context.fill();

  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = playerColor;
  context.lineWidth = 3;
  context.shadowBlur = 22;
  context.shadowColor = playerColor;
  context.stroke();
  context.restore();
}

function drawOccupyCountdownLabel(context, district, remainingSeconds) {
  context.save();
  const label = `${Math.max(0, remainingSeconds)}s`;
  const playerColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
  const labelWidth = 28 + (label.length * 7);
  const labelX = district.centerX - (labelWidth / 2);
  const labelY = district.centerY - 28;

  context.fillStyle = "rgba(6, 14, 22, 0.86)";
  context.strokeStyle = playerColor;
  context.lineWidth = 1.2;
  context.shadowBlur = 18;
  context.shadowColor = playerColor;
  context.beginPath();
  context.roundRect(labelX, labelY, labelWidth, 18, 8);
  context.fill();
  context.stroke();

  context.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#effdff";
  context.fillText(label, district.centerX, labelY + 9.5);
  context.restore();
}

function getAllianceMapBadge() {
  const provider = window.empireStreetsAllianceState;
  if (provider && typeof provider.getMapBadge === "function") {
    return provider.getMapBadge() || null;
  }
  return null;
}

function drawCurrentPlayerFactionBadge(context, district, isNight = true) {
  if (!district) {
    return;
  }

  const badgeColor = getCurrentPlayerGangColor();
  const badgeGlyph = getCurrentPlayerFactionGlyph();
  const [red, green, blue] = hexToRgbParts(badgeColor);
  const neonGlow = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.92 : 0.68})`;
  const softGlow = `rgba(${red}, ${green}, ${blue}, ${isNight ? 0.42 : 0.28})`;

  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 22px Segoe UI Symbol, Segoe UI Emoji, Bahnschrift, sans-serif";
  context.lineWidth = 1.5;
  context.strokeStyle = isNight ? "rgba(8, 12, 20, 0.94)" : "rgba(236, 246, 255, 0.82)";
  context.fillStyle = isNight ? "#f8feff" : "#ffffff";
  context.shadowBlur = isNight ? 26 : 20;
  context.shadowColor = neonGlow;
  context.strokeText(String(badgeGlyph), district.centerX, district.centerY + 0.5);
  context.fillText(String(badgeGlyph), district.centerX, district.centerY + 0.5);

  context.font = "900 11px Bahnschrift, Segoe UI, sans-serif";
  context.fillStyle = badgeColor;
  context.shadowBlur = isNight ? 18 : 12;
  context.shadowColor = softGlow;
  context.fillText("TY", district.centerX, district.centerY + 18.5);
  context.restore();
}

function getBountyDistrictMarkers() {
  const provider = window.empireStreetsBountyState;
  if (provider && typeof provider.getDistrictMarkers === "function") {
    return provider.getDistrictMarkers() || new Map();
  }
  return new Map();
}

function drawAllianceDistrictBadge(context, district, badge, isNight = true) {
  if (!district || !badge?.symbol) {
    return;
  }

  context.save();
  context.font = "900 17px Bahnschrift, Segoe UI Symbol, Segoe UI Emoji, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = isNight ? "rgba(224, 196, 255, 0.96)" : "rgba(99, 52, 212, 0.92)";
  context.shadowBlur = isNight ? 22 : 16;
  context.shadowColor = isNight ? "rgba(168, 85, 247, 0.84)" : "rgba(103, 225, 255, 0.42)";
  context.fillText(String(badge.symbol), district.centerX, district.centerY);
  context.restore();
}

function drawBountyDistrictBadge(context, district, marker, isNight = true) {
  if (!district || !marker) {
    return;
  }

  const accentColor = "#ef4444";
  const badgeX = district.centerX;
  const badgeY = district.centerY - 19;

  context.save();
  context.strokeStyle = accentColor;
  context.fillStyle = isNight ? "rgba(18, 10, 14, 0.88)" : "rgba(44, 15, 22, 0.82)";
  context.lineWidth = 1.8;
  context.shadowBlur = isNight ? 20 : 12;
  context.shadowColor = accentColor;
  context.beginPath();
  context.arc(badgeX, badgeY, 9.5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(badgeX, badgeY, 3.2, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(badgeX - 12, badgeY);
  context.lineTo(badgeX - 4.6, badgeY);
  context.moveTo(badgeX + 4.6, badgeY);
  context.lineTo(badgeX + 12, badgeY);
  context.moveTo(badgeX, badgeY - 12);
  context.lineTo(badgeX, badgeY - 4.6);
  context.moveTo(badgeX, badgeY + 4.6);
  context.lineTo(badgeX, badgeY + 12);
  context.stroke();
  context.restore();
}

function drawBountyDistrictHighlight(context, district, isNight = true) {
  if (!district) {
    return;
  }

  context.save();
  drawDistrictPolygon(context, district.polygon);
  context.fillStyle = isNight ? "rgba(239, 68, 68, 0.18)" : "rgba(220, 38, 38, 0.14)";
  context.fill();

  context.save();
  context.shadowBlur = isNight ? 28 : 18;
  context.shadowColor = isNight ? "rgba(248, 113, 113, 0.8)" : "rgba(220, 38, 38, 0.46)";
  drawDistrictPolygon(context, district.polygon);
  context.strokeStyle = isNight ? "rgba(252, 165, 165, 0.9)" : "rgba(220, 38, 38, 0.9)";
  context.lineWidth = 3;
  context.stroke();
  context.restore();
  context.restore();
}

function isPointInDistrict(point, district) {
  let inside = false;

  for (let index = 0, previousIndex = district.polygon.length - 1; index < district.polygon.length; previousIndex = index, index += 1) {
    const current = district.polygon[index];
    const previous = district.polygon[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function getDistrictAtPoint(geometry, point) {
  for (let index = geometry.districts.length - 1; index >= 0; index -= 1) {
    const district = geometry.districts[index];

    if (isPointInDistrict(point, district)) {
      return district;
    }
  }

  return null;
}

function drawMapImage(context, image, width, height) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = drawHeight * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = drawWidth / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function renderDistrictCanvas(canvas, phase, interactionState = {}, imageSet = null) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const cachedGeometry = interactionState?.geometryCache;
  const geometry = cachedGeometry && cachedGeometry.width === width && cachedGeometry.height === height
    ? cachedGeometry
    : createDistrictGeometry(width, height, 0, 0, 0);
  if (interactionState && typeof interactionState === "object") {
    interactionState.geometryCache = geometry;
  }
  const isNight = phase === "night";
  const hoveredDistrictId = interactionState.hoveredDistrictId ?? null;
  const selectedDistrictId = interactionState.selectedDistrictId ?? null;
  const borderColor = interactionState.borderColor ?? "white";
  const showDistrictBorders = interactionState.showDistrictBorders !== false;
  const showAllianceSymbols = interactionState.showAllianceSymbols !== false;
  const mapVisibilityMode = normalizeMapVisibilityMode(interactionState.mapVisibilityMode);
  const effectiveOwnedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;
  const activeSpyDistrictIds = interactionState.activeSpyDistrictIds || new Set();
  const activeSpyMarkersByDistrictId = interactionState.activeSpyMarkersByDistrictId || new Map();
  const activePoliceDistrictIds = interactionState.activePoliceDistrictIds || new Set();
  const activePoliceMarkersByDistrictId = interactionState.activePoliceMarkersByDistrictId || new Map();
  const activeAttackDistrictIds = interactionState.activeAttackDistrictIds || new Set();
  const activeAttackMarkersByDistrictId = interactionState.activeAttackMarkersByDistrictId || new Map();
  const activeOccupyDistrictIds = interactionState.activeOccupyDistrictIds || new Set();
  const activeOccupyCountdownByDistrictId = interactionState.activeOccupyCountdownByDistrictId || new Map();
  const activeRobberyDistrictIds = interactionState.activeRobberyDistrictIds || new Set();
  const activeRobberyMarkersByDistrictId = interactionState.activeRobberyMarkersByDistrictId || new Map();
  const activeTrapDistrictIds = interactionState.activeTrapDistrictIds || new Set();
  const animationTick = interactionState.animationTick ?? 0;
  const allianceBadge = showAllianceSymbols && mapVisibilityMode !== "only-player"
    ? getAllianceMapBadge()
    : null;
  const bountyDistrictMarkers = getBountyDistrictMarkers();

  context.clearRect(0, 0, width, height);

  const activeImage = isNight ? imageSet?.night : imageSet?.day;

  if (activeImage) {
    drawMapImage(context, activeImage, width, height);
  } else {
    const backgroundGradient = context.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, isNight ? "#04111f" : "#102235");
    backgroundGradient.addColorStop(0.5, isNight ? "#08172b" : "#16344f");
    backgroundGradient.addColorStop(1, isNight ? "#050b16" : "#0b1828");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = isNight ? "rgba(4, 8, 14, 0.28)" : "rgba(6, 14, 24, 0.14)";
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalCompositeOperation = "screen";
  const imageBloom = context.createRadialGradient(width * 0.52, height * 0.42, 30, width * 0.52, height * 0.42, width * 0.58);
  imageBloom.addColorStop(0, isNight ? "rgba(103, 225, 255, 0.12)" : "rgba(255, 255, 255, 0.08)");
  imageBloom.addColorStop(1, "rgba(103, 225, 255, 0)");
  context.fillStyle = imageBloom;
  context.fillRect(0, 0, width, height);
  context.restore();

  const glowGradient = context.createRadialGradient(width * 0.2, height * 0.18, 20, width * 0.2, height * 0.18, width * 0.55);
  glowGradient.addColorStop(0, isNight ? "rgba(103, 225, 255, 0.22)" : "rgba(103, 225, 255, 0.15)");
  glowGradient.addColorStop(1, "rgba(103, 225, 255, 0)");
  context.fillStyle = glowGradient;
  context.fillRect(0, 0, width, height);

  for (const district of geometry.districts) {
    const isHovered = district.id === hoveredDistrictId;
    const isSelected = district.id === selectedDistrictId;
    const isOwned = effectiveOwnedDistrictIds.has(district.id);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(district.id);
    const rawLaunchOwnerId = launchOwnerByDistrictId.get(district.id) ?? null;
    const showEnemyMarkers = showAllianceSymbols && mapVisibilityMode === "all";
    const launchOwnerId = showEnemyMarkers ? rawLaunchOwnerId : null;
    const launchOwnerColor = launchOwnerId ? getLaunchPlayerColor(launchOwnerId) : null;
    const currentPlayerColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
    const fillStyle = getDistrictFillStyle(district, isNight, interactionState);

    drawDistrictPolygon(context, district.polygon);
    context.fillStyle = fillStyle;
    context.fill();

    if (isHovered || isSelected) {
      context.save();
      context.shadowBlur = isSelected ? 26 : 20;
      context.shadowColor = isNight ? "rgba(103, 225, 255, 0.9)" : "rgba(79, 232, 255, 0.8)";
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = isSelected
        ? "rgba(255, 154, 61, 0.96)"
        : "rgba(103, 225, 255, 0.98)";
      context.lineWidth = isSelected ? 4 : 3;
      context.stroke();
      context.restore();
    }

    const shouldDrawBorder = showDistrictBorders || isSelected || isHovered || isOwnedByCurrentPlayer || Boolean(launchOwnerColor);
    if (shouldDrawBorder) {
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = isSelected
        ? "rgba(255, 154, 61, 0.92)"
        : isHovered
          ? "rgba(103, 225, 255, 0.95)"
          : isOwnedByCurrentPlayer
            ? currentPlayerColor
          : launchOwnerColor
            ? launchOwnerColor
          : borderColor === "black"
            ? "rgba(5, 8, 12, 0.92)"
          : isNight
            ? "rgba(242, 248, 255, 0.96)"
            : "rgba(245, 250, 255, 0.92)";
      context.lineWidth = isSelected ? 2.8 : isHovered ? 2.2 : isOwnedByCurrentPlayer || launchOwnerColor ? 1.8 : 1.2;
      context.stroke();
    }

    if (launchOwnerId && !isOwnedByCurrentPlayer) {
      context.save();
      context.shadowBlur = isNight ? 24 : 18;
      context.shadowColor = launchOwnerColor;
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = launchOwnerColor;
      context.lineWidth = 3.8;
      context.stroke();
      context.restore();
    }

    if (!launchOwnerId && isOwnedByCurrentPlayer) {
      context.save();
      context.shadowBlur = isNight ? 24 : 18;
      context.shadowColor = currentPlayerColor;
      drawDistrictPolygon(context, district.polygon);
      context.strokeStyle = currentPlayerColor;
      context.lineWidth = 3.6;
      context.stroke();
      context.restore();
    }

    if (launchOwnerId && launchOwnerId === CURRENT_PLAYER_ID) {
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      } else {
        drawCurrentPlayerFactionBadge(context, district, isNight);
      }
    } else if (launchOwnerId) {
      context.save();
      context.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = launchOwnerColor;
      context.shadowBlur = 16;
      context.shadowColor = launchOwnerColor;
      context.fillText(getLaunchPlayerLabel(launchOwnerId), district.centerX, district.centerY);
      context.restore();
    }

    if (!launchOwnerId && isOwnedByCurrentPlayer) {
      if (allianceBadge) {
        drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
      } else {
        drawCurrentPlayerFactionBadge(context, district, isNight);
      }
    } else if (!launchOwnerId && allianceBadge && isOwned) {
      drawAllianceDistrictBadge(context, district, allianceBadge, isNight);
    }

    const bountyMarker = bountyDistrictMarkers instanceof Map
      ? bountyDistrictMarkers.get(district.id)
      : bountyDistrictMarkers?.[district.id];

    if (bountyMarker) {
      drawBountyDistrictHighlight(context, district, isNight);
      drawBountyDistrictBadge(context, district, bountyMarker, isNight);
    }

    if (activeSpyDistrictIds.has(district.id)) {
      drawSpyDistrictAnimation(context, district, activeSpyMarkersByDistrictId.get(district.id), animationTick);
    }

    if (activePoliceDistrictIds.has(district.id)) {
      drawPoliceDistrictAnimation(context, district, activePoliceMarkersByDistrictId.get(district.id), animationTick);
    }

    if (activeAttackDistrictIds.has(district.id)) {
      drawAttackDistrictAnimation(context, district, activeAttackMarkersByDistrictId.get(district.id), animationTick);
    }

    if (activeOccupyDistrictIds.has(district.id)) {
      drawOccupyDistrictAnimation(context, district, animationTick / 1600);
      drawOccupyCountdownLabel(context, district, activeOccupyCountdownByDistrictId.get(district.id) ?? 0);
    }

    if (activeRobberyDistrictIds.has(district.id)) {
      drawRobberyDistrictAnimation(context, district, activeRobberyMarkersByDistrictId.get(district.id), animationTick);
    }

    if (activeTrapDistrictIds.has(district.id)) {
      drawTrapDistrictAnimation(context, district, animationTick / 2800);
    }
  }

  context.fillStyle = isNight ? "rgba(6, 12, 22, 0.08)" : "rgba(255, 255, 255, 0.015)";
  context.fillRect(0, 0, width, height);

  return geometry;
}

function bindDistrictCanvas(root) {
  const canvas = root.querySelector(DISTRICT_CANVAS_SELECTOR);
  const phaseHost = root.querySelector(MAP_PHASE_SELECTOR);
  const viewport = root.querySelector(MAP_VIEWPORT_SELECTOR);
  const canvasHost = root.querySelector(MAP_CANVAS_SELECTOR);
  const mapStage = root.querySelector("#game-map-stage");
  const mapMount = root.querySelector("#game-map-mount");
  const tooltip = root.querySelector(DISTRICT_TOOLTIP_SELECTOR);
  const tooltipValue = root.querySelector(DISTRICT_TOOLTIP_VALUE_SELECTOR);
  const tooltipType = root.querySelector(DISTRICT_TOOLTIP_TYPE_SELECTOR);
  const tooltipGossip = root.querySelector(DISTRICT_TOOLTIP_GOSSIP_SELECTOR);
  const popup = root.querySelector(DISTRICT_POPUP_SELECTOR);
  const popupCard = root.querySelector(DISTRICT_POPUP_CARD_SELECTOR);
  const popupTitle = root.querySelector(DISTRICT_POPUP_TITLE_SELECTOR);
  const popupType = root.querySelector(DISTRICT_POPUP_TYPE_SELECTOR);
  const popupOwner = root.querySelector(DISTRICT_POPUP_OWNER_SELECTOR);
  const popupOwnerMeta = root.querySelector(DISTRICT_POPUP_OWNER_META_SELECTOR);
  const popupOwnerAvatar = root.querySelector(DISTRICT_POPUP_OWNER_AVATAR_SELECTOR);
  const popupOwnerAvatarFallback = root.querySelector(DISTRICT_POPUP_OWNER_AVATAR_FALLBACK_SELECTOR);
  const popupDefense = root.querySelector(DISTRICT_POPUP_DEFENSE_SELECTOR);
  const popupDefensePower = root.querySelector(DISTRICT_POPUP_DEFENSE_POWER_SELECTOR);
  const popupResidents = root.querySelector(DISTRICT_POPUP_RESIDENTS_SELECTOR);
  const popupIncome = root.querySelector(DISTRICT_POPUP_INCOME_SELECTOR);
  const popupHeat = root.querySelector(DISTRICT_POPUP_HEAT_SELECTOR);
  const popupInfluence = root.querySelector(DISTRICT_POPUP_INFLUENCE_SELECTOR);
  const popupFlags = root.querySelector(DISTRICT_POPUP_FLAGS_SELECTOR);
  const popupToggle = root.querySelector(DISTRICT_POPUP_TOGGLE_SELECTOR);
  const popupAtmosphereImage = root.querySelector(DISTRICT_POPUP_ATMOSPHERE_IMAGE_SELECTOR);
  const popupAtmosphereLabel = root.querySelector(DISTRICT_POPUP_ATMOSPHERE_LABEL_SELECTOR);
  const popupAtmosphereMood = root.querySelector(DISTRICT_POPUP_ATMOSPHERE_MOOD_SELECTOR);
  const popupBuildings = root.querySelector(DISTRICT_POPUP_BUILDINGS_SELECTOR);
  const popupBuildingsMeta = root.querySelector(DISTRICT_POPUP_BUILDINGS_META_SELECTOR);
  const popupBuildingsList = root.querySelector(DISTRICT_POPUP_BUILDINGS_LIST_SELECTOR);
  const popupGossip = root.querySelector(DISTRICT_POPUP_GOSSIP_SELECTOR);
  const popupGossipList = root.querySelector(DISTRICT_POPUP_GOSSIP_LIST_SELECTOR);
  const districtActionSectionHead = root.querySelector(".district-popup-action-section__head");
  const districtActionSection = root.querySelector(DISTRICT_ACTION_SECTION_SELECTOR);
  const districtActionsMount = root.querySelector(DISTRICT_ACTIONS_SELECTOR);
  const popupCloseElements = Array.from(root.querySelectorAll(DISTRICT_POPUP_CLOSE_SELECTOR));
  const buildingsPopupOpenButton = root.querySelector(BUILDINGS_POPUP_OPEN_SELECTOR);
  const buildingsPopup = root.querySelector(BUILDINGS_POPUP_SELECTOR);
  const buildingsPopupTypeMount = root.querySelector(BUILDINGS_POPUP_TYPES_SELECTOR);
  const buildingsPopupDetailMount = root.querySelector(BUILDINGS_POPUP_DETAIL_SELECTOR);
  const buildingsPopupCloseElements = Array.from(root.querySelectorAll(BUILDINGS_POPUP_CLOSE_SELECTOR));
  const attackSetupPopup = root.querySelector(ATTACK_SETUP_POPUP_SELECTOR);
  const attackSetupCard = root.querySelector(ATTACK_SETUP_CARD_SELECTOR);
  const attackSetupCloseElements = Array.from(root.querySelectorAll(ATTACK_SETUP_CLOSE_SELECTOR));
  const attackSetupAtmosphereImage = root.querySelector(ATTACK_SETUP_ATMOSPHERE_IMAGE_SELECTOR);
  const attackSetupAtmosphereLabel = root.querySelector(ATTACK_SETUP_ATMOSPHERE_LABEL_SELECTOR);
  const attackTargetTitle = root.querySelector(ATTACK_TARGET_TITLE_SELECTOR);
  const attackSourceSelect = root.querySelector(ATTACK_SOURCE_SELECT_SELECTOR);
  const attackAvailablePopulation = root.querySelector(ATTACK_AVAILABLE_POPULATION_SELECTOR);
  const attackRequiredPopulation = root.querySelector(ATTACK_REQUIRED_POPULATION_SELECTOR);
  const attackEstimatedPower = root.querySelector(ATTACK_ESTIMATED_POWER_SELECTOR);
  const attackStatus = root.querySelector(ATTACK_STATUS_SELECTOR);
  const attackWeaponInputs = Array.from(root.querySelectorAll(ATTACK_WEAPON_INPUT_SELECTOR));
  const attackOwnedElements = Array.from(root.querySelectorAll(ATTACK_OWNED_SELECTOR));
  const attackConfirmButton = root.querySelector(ATTACK_CONFIRM_SELECTOR);
  const attackConfirmPopup = root.querySelector(ATTACK_CONFIRM_POPUP_SELECTOR);
  const attackConfirmCard = root.querySelector(ATTACK_CONFIRM_CARD_SELECTOR);
  const attackConfirmCloseElements = Array.from(root.querySelectorAll(ATTACK_CONFIRM_CLOSE_SELECTOR));
  const attackConfirmAtmosphereImage = root.querySelector(ATTACK_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR);
  const attackConfirmAtmosphereLabel = root.querySelector(ATTACK_CONFIRM_ATMOSPHERE_LABEL_SELECTOR);
  const attackConfirmTitle = root.querySelector(ATTACK_CONFIRM_TITLE_SELECTOR);
  const attackConfirmSource = root.querySelector(ATTACK_CONFIRM_SOURCE_SELECTOR);
  const attackConfirmMembers = root.querySelector(ATTACK_CONFIRM_MEMBERS_SELECTOR);
  const attackConfirmPower = root.querySelector(ATTACK_CONFIRM_POWER_SELECTOR);
  const attackConfirmScenario = root.querySelector(ATTACK_CONFIRM_SCENARIO_SELECTOR);
  const attackConfirmDuration = root.querySelector(ATTACK_CONFIRM_DURATION_SELECTOR);
  const attackConfirmNote = root.querySelector(ATTACK_CONFIRM_NOTE_SELECTOR);
  const attackConfirmFinalButton = root.querySelector(ATTACK_CONFIRM_BUTTON_SELECTOR);
  const robberySetupPopup = root.querySelector(ROBBERY_SETUP_POPUP_SELECTOR);
  const robberySetupCard = root.querySelector(ROBBERY_SETUP_CARD_SELECTOR);
  const robberySetupCloseElements = Array.from(root.querySelectorAll(ROBBERY_SETUP_CLOSE_SELECTOR));
  const robberySetupAtmosphereImage = root.querySelector(ROBBERY_SETUP_ATMOSPHERE_IMAGE_SELECTOR);
  const robberySetupAtmosphereLabel = root.querySelector(ROBBERY_SETUP_ATMOSPHERE_LABEL_SELECTOR);
  const robberyTargetTitle = root.querySelector(ROBBERY_TARGET_TITLE_SELECTOR);
  const robberySourceSelect = root.querySelector(ROBBERY_SOURCE_SELECT_SELECTOR);
  const robberyAvailableMembers = root.querySelector(ROBBERY_AVAILABLE_MEMBERS_SELECTOR);
  const robberyMemberInput = root.querySelector(ROBBERY_MEMBER_INPUT_SELECTOR);
  const robberyStatus = root.querySelector(ROBBERY_STATUS_SELECTOR);
  const robberyConfirmButton = root.querySelector(ROBBERY_CONFIRM_SELECTOR);
  const robberyConfirmPopup = root.querySelector(ROBBERY_CONFIRM_POPUP_SELECTOR);
  const robberyConfirmCard = root.querySelector(ROBBERY_CONFIRM_CARD_SELECTOR);
  const robberyConfirmCloseElements = Array.from(root.querySelectorAll(ROBBERY_CONFIRM_CLOSE_SELECTOR));
  const robberyConfirmAtmosphereImage = root.querySelector(ROBBERY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR);
  const robberyConfirmAtmosphereLabel = root.querySelector(ROBBERY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR);
  const robberyConfirmTitle = root.querySelector(ROBBERY_CONFIRM_TITLE_SELECTOR);
  const robberyConfirmSource = root.querySelector(ROBBERY_CONFIRM_SOURCE_SELECTOR);
  const robberyConfirmMembers = root.querySelector(ROBBERY_CONFIRM_MEMBERS_SELECTOR);
  const robberyConfirmDuration = root.querySelector(ROBBERY_CONFIRM_DURATION_SELECTOR);
  const robberyConfirmNote = root.querySelector(ROBBERY_CONFIRM_NOTE_SELECTOR);
  const robberyConfirmFinalButton = root.querySelector(ROBBERY_CONFIRM_BUTTON_SELECTOR);
  const defenseSetupPopup = root.querySelector(DEFENSE_SETUP_POPUP_SELECTOR);
  const defenseSetupCard = root.querySelector(DEFENSE_SETUP_CARD_SELECTOR);
  const defenseSetupCloseElements = Array.from(root.querySelectorAll(DEFENSE_SETUP_CLOSE_SELECTOR));
  const defenseSetupAtmosphereImage = root.querySelector(DEFENSE_SETUP_ATMOSPHERE_IMAGE_SELECTOR);
  const defenseSetupAtmosphereLabel = root.querySelector(DEFENSE_SETUP_ATMOSPHERE_LABEL_SELECTOR);
  const defenseTargetTitle = root.querySelector(DEFENSE_TARGET_TITLE_SELECTOR);
  const defenseStatus = root.querySelector(DEFENSE_STATUS_SELECTOR);
  const defenseEstimatedPower = root.querySelector(DEFENSE_ESTIMATED_POWER_SELECTOR);
  const defenseWeaponInputs = Array.from(root.querySelectorAll(DEFENSE_WEAPON_INPUT_SELECTOR));
  const defenseOwnedElements = Array.from(root.querySelectorAll(DEFENSE_OWNED_SELECTOR));
  const defenseResidentsInput = root.querySelector(DEFENSE_RESIDENTS_INPUT_SELECTOR);
  const defenseConfirmButton = root.querySelector(DEFENSE_CONFIRM_SELECTOR);
  const trapConfirmPopup = root.querySelector(TRAP_CONFIRM_POPUP_SELECTOR);
  const trapConfirmCard = root.querySelector(TRAP_CONFIRM_CARD_SELECTOR);
  const trapConfirmCloseElements = Array.from(root.querySelectorAll(TRAP_CONFIRM_CLOSE_SELECTOR));
  const trapConfirmAtmosphereImage = root.querySelector(TRAP_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR);
  const trapConfirmAtmosphereLabel = root.querySelector(TRAP_CONFIRM_ATMOSPHERE_LABEL_SELECTOR);
  const trapConfirmTitle = root.querySelector(TRAP_CONFIRM_TITLE_SELECTOR);
  const trapConfirmCooldown = root.querySelector(TRAP_CONFIRM_COOLDOWN_SELECTOR);
  const trapConfirmNote = root.querySelector(TRAP_CONFIRM_NOTE_SELECTOR);
  const trapConfirmButton = root.querySelector(TRAP_CONFIRM_BUTTON_SELECTOR);
  const spyConfirmPopup = root.querySelector(SPY_CONFIRM_POPUP_SELECTOR);
  const spyConfirmCard = root.querySelector(SPY_CONFIRM_CARD_SELECTOR);
  const spyConfirmCloseElements = Array.from(root.querySelectorAll(SPY_CONFIRM_CLOSE_SELECTOR));
  const spyConfirmAtmosphereImage = root.querySelector(SPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR);
  const spyConfirmAtmosphereLabel = root.querySelector(SPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR);
  const spyConfirmTitle = root.querySelector(SPY_CONFIRM_TITLE_SELECTOR);
  const spyConfirmSource = root.querySelector(SPY_CONFIRM_SOURCE_SELECTOR);
  const spyConfirmAvailable = root.querySelector(SPY_CONFIRM_AVAILABLE_SELECTOR);
  const spyConfirmDuration = root.querySelector(SPY_CONFIRM_DURATION_SELECTOR);
  const spyConfirmNote = root.querySelector(SPY_CONFIRM_NOTE_SELECTOR);
  const spyConfirmButton = root.querySelector(SPY_CONFIRM_BUTTON_SELECTOR);
  const occupyConfirmPopup = root.querySelector(OCCUPY_CONFIRM_POPUP_SELECTOR);
  const occupyConfirmCard = root.querySelector(OCCUPY_CONFIRM_CARD_SELECTOR);
  const occupyConfirmCloseElements = Array.from(root.querySelectorAll(OCCUPY_CONFIRM_CLOSE_SELECTOR));
  const occupyConfirmAtmosphereImage = root.querySelector(OCCUPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR);
  const occupyConfirmAtmosphereLabel = root.querySelector(OCCUPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR);
  const occupyConfirmTitle = root.querySelector(OCCUPY_CONFIRM_TITLE_SELECTOR);
  const occupyConfirmSource = root.querySelector(OCCUPY_CONFIRM_SOURCE_SELECTOR);
  const occupyConfirmCondition = root.querySelector(OCCUPY_CONFIRM_CONDITION_SELECTOR);
  const occupyConfirmDuration = root.querySelector(OCCUPY_CONFIRM_DURATION_SELECTOR);
  const occupyConfirmNote = root.querySelector(OCCUPY_CONFIRM_NOTE_SELECTOR);
  const occupyConfirmButton = root.querySelector(OCCUPY_CONFIRM_BUTTON_SELECTOR);
  const spyResultModal = root.querySelector(SPY_RESULT_MODAL_SELECTOR);
  const spyResultModalBackdrop = root.querySelector(SPY_RESULT_MODAL_BACKDROP_SELECTOR);
  const spyResultModalClose = root.querySelector(SPY_RESULT_MODAL_CLOSE_SELECTOR);
  const spyResultModalOk = root.querySelector(SPY_RESULT_MODAL_OK_SELECTOR);
  const spyWarningModal = root.querySelector(SPY_WARNING_MODAL_SELECTOR);
  const spyWarningModalBackdrop = root.querySelector(SPY_WARNING_MODAL_BACKDROP_SELECTOR);
  const spyWarningModalClose = root.querySelector(SPY_WARNING_MODAL_CLOSE_SELECTOR);
  const spyWarningModalOk = root.querySelector(SPY_WARNING_MODAL_OK_SELECTOR);
  const raidResultModal = root.querySelector(RAID_RESULT_MODAL_SELECTOR);
  const raidResultModalBackdrop = root.querySelector(RAID_RESULT_MODAL_BACKDROP_SELECTOR);
  const raidResultModalClose = root.querySelector(RAID_RESULT_MODAL_CLOSE_SELECTOR);
  const raidResultModalOk = root.querySelector(RAID_RESULT_MODAL_OK_SELECTOR);
  const attackResultModal = root.querySelector(ATTACK_RESULT_MODAL_SELECTOR);
  const attackResultModalBackdrop = root.querySelector(ATTACK_RESULT_MODAL_BACKDROP_SELECTOR);
  const attackResultModalClose = root.querySelector(ATTACK_RESULT_MODAL_CLOSE_SELECTOR);
  const attackResultModalOk = root.querySelector(ATTACK_RESULT_MODAL_OK_SELECTOR);
  const policeActionResultModal = root.querySelector(POLICE_ACTION_RESULT_MODAL_SELECTOR);
  const policeActionResultModalBackdrop = root.querySelector(POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR);
  const policeActionResultModalClose = root.querySelector(POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR);
  const policeActionResultModalOk = root.querySelector(POLICE_ACTION_RESULT_MODAL_OK_SELECTOR);
  const buildingActionState = root.querySelector(BUILDING_ACTION_STATE_SELECTOR);
  const buildingActionSummary = root.querySelector(BUILDING_ACTION_SUMMARY_SELECTOR);
  const buildingActionMeta = root.querySelector(BUILDING_ACTION_META_SELECTOR);
  const gangMembersValue = root.querySelector(GANG_MEMBERS_SELECTOR);

  if (!canvas || !phaseHost || !viewport || !canvasHost) {
    return;
  }

  let interactionOverlay = canvasHost.querySelector(".map-interaction-overlay");
  if (!(interactionOverlay instanceof HTMLDivElement)) {
    interactionOverlay = document.createElement("div");
    interactionOverlay.className = "map-interaction-overlay";
    interactionOverlay.setAttribute("aria-hidden", "true");
    canvasHost.append(interactionOverlay);
  }

  const initialSettings = getSettingsState();
  const interactionState = {
    hoveredDistrictId: null,
    selectedDistrictId: null,
    borderColor: phaseHost.dataset.borderColor || "white",
    showDistrictBorders: initialSettings.mapDistrictBorders,
    showAllianceSymbols: initialSettings.mapAllianceSymbols,
    mapVisibilityMode: initialSettings.mapVisibilityMode,
    gamePhase: phaseHost.dataset.gamePhase || "launch",
    revealedDistrictIds: new Set(),
    ownedDistrictIds: new Set(getResolvedWorldState().ownedDistrictIds),
    destroyedDistrictIds: new Set(getResolvedWorldState().destroyedDistrictIds),
    launchOwnerByDistrictId: new Map(START_PHASE_OWNER_BY_DISTRICT_ID),
    activeSpyDistrictIds: new Set(),
    activeSpyMarkersByDistrictId: new Map(),
    activePoliceDistrictIds: new Set(
      Object.keys(getResolvedDistrictPoliceActions()).map(Number).filter(Boolean)
    ),
    activePoliceMarkersByDistrictId: new Map(
      Object.entries(getResolvedDistrictPoliceActions())
        .map(([districtId, marker]) => [Number(districtId), marker])
        .filter(([districtId, marker]) => Boolean(districtId && marker))
    ),
    activeAttackDistrictIds: new Set(),
    activeAttackMarkersByDistrictId: new Map(),
    activeOccupyDistrictIds: new Set(
      getStoredOccupyOrders().map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
    ),
    activeOccupyCountdownByDistrictId: new Map(
      getStoredOccupyOrders().map((order) => ([
        Number(String(order.targetDistrictId || "").replace("district:", "")),
        Math.max(0, Math.ceil((new Date(order.resolveAt || order.createdAt).getTime() - Date.now()) / 1000))
      ]))
    ),
    activeRobberyDistrictIds: new Set(),
    activeRobberyMarkersByDistrictId: new Map(),
    activeTrapDistrictIds: new Set(
      Object.entries(getResolvedWorldState().districtTrapById || {})
        .filter(([, trap]) => trap?.isArmed)
        .map(([districtId]) => Number(districtId))
        .filter(Boolean)
    ),
    animationTick: 0,
    geometryCache: null
  };
  let geometry = null;
  let imageSet = null;
  let spyAnimationFrameId = null;
  let popupRefreshTimerId = null;
  let pendingAttackContext = null;
  let isDistrictPopupOverviewEnabled = false;
  let lastTooltipDistrictId = null;
  const districtSelectionGesture = {
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClickUntil: 0
  };
  const DISTRICT_SELECTION_DRAG_THRESHOLD = 10;
  const DISTRICT_SELECTION_SUPPRESS_MS = 220;

  const syncInteractionDistrictAuthorityState = () => {
    const worldState = getResolvedWorldState();
    interactionState.ownedDistrictIds = new Set(worldState.ownedDistrictIds || []);
    interactionState.destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
    interactionState.launchOwnerByDistrictId = new Map(START_PHASE_OWNER_BY_DISTRICT_ID);

    for (const destroyedDistrictId of interactionState.destroyedDistrictIds) {
      interactionState.ownedDistrictIds.delete(Number(destroyedDistrictId));
      interactionState.launchOwnerByDistrictId.delete(Number(destroyedDistrictId));
    }
  };

  syncInteractionDistrictAuthorityState();

  const hideTooltip = () => {
    if (tooltip) {
      tooltip.hidden = true;
    }
    if (tooltipGossip) {
      tooltipGossip.replaceChildren();
    }
    lastTooltipDistrictId = null;
  };

  const hasActiveDistrictModal = () => [
    popup,
    attackSetupPopup,
    attackConfirmPopup,
    robberySetupPopup,
    robberyConfirmPopup,
    defenseSetupPopup,
    trapConfirmPopup,
    spyConfirmPopup,
    occupyConfirmPopup
  ].some((element) => element && !element.hidden);

  const setOverlayPoint = (name, x, y) => {
    if (!(interactionOverlay instanceof HTMLDivElement)) {
      return;
    }

    const clampedX = Math.min(Math.max(x, 0), 100);
    const clampedY = Math.min(Math.max(y, 0), 100);
    interactionOverlay.style.setProperty(`--${name}-x`, `${clampedX}%`);
    interactionOverlay.style.setProperty(`--${name}-y`, `${clampedY}%`);
  };

  const syncMapInteractionVisualState = (options = {}) => {
    const hoveredDistrict = options.hoveredDistrict ?? (
      geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null
    );
    const focusedDistrict = options.focusedDistrict ?? (
      geometry?.districts?.find((district) => district.id === interactionState.selectedDistrictId) || null
    );
    const hasHover = Boolean(hoveredDistrict && !options.suppressHover);
    const hasFocus = Boolean(focusedDistrict && hasActiveDistrictModal());

    if (interactionOverlay instanceof HTMLDivElement) {
      interactionOverlay.classList.toggle("is-hovering", hasHover);
      interactionOverlay.classList.toggle("is-focused", hasFocus);
    }

    canvasHost.classList.toggle("has-map-hover", hasHover);
    canvasHost.classList.toggle("is-district-focused", hasFocus);
    viewport.classList.toggle("has-map-hover", hasHover);
    viewport.classList.toggle("is-district-focused", hasFocus);
    mapMount?.classList.toggle("has-map-hover", hasHover);
    mapMount?.classList.toggle("is-district-focused", hasFocus);
    mapStage?.classList.toggle("has-map-hover", hasHover);
    mapStage?.classList.toggle("is-district-focused", hasFocus);

    if (hasFocus) {
      setOverlayPoint(
        "map-focus",
        (focusedDistrict.centerX / canvas.width) * 100,
        (focusedDistrict.centerY / canvas.height) * 100
      );
    }
  };

  const closePopup = () => {
    interactionState.selectedDistrictId = null;
    pendingAttackContext = null;

    if (popupRefreshTimerId !== null) {
      window.clearInterval(popupRefreshTimerId);
      popupRefreshTimerId = null;
    }

    if (popup) {
      popup.hidden = true;
    }

    if (attackSetupPopup) {
      attackSetupPopup.hidden = true;
    }

    if (attackConfirmPopup) {
      attackConfirmPopup.hidden = true;
    }

    if (robberySetupPopup) {
      robberySetupPopup.hidden = true;
    }

    if (robberyConfirmPopup) {
      robberyConfirmPopup.hidden = true;
    }

    if (defenseSetupPopup) {
      defenseSetupPopup.hidden = true;
    }

    if (trapConfirmPopup) {
      trapConfirmPopup.hidden = true;
    }

    if (spyConfirmPopup) {
      spyConfirmPopup.hidden = true;
    }

    if (occupyConfirmPopup) {
      occupyConfirmPopup.hidden = true;
    }

    syncMapInteractionVisualState({
      hoveredDistrict: geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null,
      focusedDistrict: null
    });
    render();
  };

  const closeAttackSetupPopup = () => {
    pendingAttackContext = null;
    if (attackSetupPopup) {
      attackSetupPopup.hidden = true;
    }
  };

  const closeAttackConfirmPopup = () => {
    pendingAttackContext = null;
    if (attackConfirmPopup) {
      attackConfirmPopup.hidden = true;
    }
  };

  const closeRobberySetupPopup = () => {
    if (robberySetupPopup) {
      robberySetupPopup.hidden = true;
    }
  };

  const closeRobberyConfirmPopup = () => {
    if (robberyConfirmPopup) {
      robberyConfirmPopup.hidden = true;
    }
  };

  const closeDefenseSetupPopup = () => {
    if (defenseSetupPopup) {
      defenseSetupPopup.hidden = true;
    }
  };

  const closeTrapConfirmPopup = () => {
    if (trapConfirmPopup) {
      trapConfirmPopup.hidden = true;
    }
  };

  const closeSpyConfirmPopup = () => {
    if (spyConfirmPopup) {
      spyConfirmPopup.hidden = true;
    }
  };

  const closeOccupyConfirmPopup = () => {
    if (occupyConfirmPopup) {
      occupyConfirmPopup.hidden = true;
    }
  };

  const getSelectedDistrict = () => (
    geometry?.districts?.find((district) => district.id === interactionState.selectedDistrictId) || null
  );

  const getDistrictDefenseState = (districtId) => {
    const normalizedDistrictId = Number(districtId);
    const worldState = getResolvedWorldState();
    const loadout = worldState.districtDefenseLoadoutById?.[normalizedDistrictId] || {};
    const residents = Math.max(
      0,
      Number.parseInt(String(worldState.districtDefenseResidentsById?.[normalizedDistrictId] ?? 0), 10) || 0
    );
    const storedPower = Number.parseInt(String(worldState.districtDefenseById?.[normalizedDistrictId] ?? 0), 10) || 0;
    const calculatedPower = calculateTotalDefensePower({ loadout, residents });

    return {
      loadout,
      residents,
      totalPower: Math.max(storedPower, calculatedPower)
    };
  };

  const getCurrentPlayerTrapDistrictId = () => {
    const trapEntries = Object.entries(getResolvedWorldState().districtTrapById || {});
    const currentPlayerTrap = trapEntries.find(([, trap]) => trap?.isArmed && Number(trap.ownerId) === CURRENT_PLAYER_ID);
    return currentPlayerTrap ? Number(currentPlayerTrap[0]) : null;
  };

  const getCurrentPlayerTrapMoveCooldownSeconds = () => {
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();

    if (!currentTrapDistrictId) {
      return 0;
    }

    const trapState = getResolvedWorldState().districtTrapById?.[currentTrapDistrictId];
    const lastTrapActionAt = trapState?.movedAt || trapState?.armedAt;

    if (!lastTrapActionAt) {
      return 0;
    }

    const remainingMs = new Date(lastTrapActionAt).getTime() + 25_000 - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  };

  const getDistrictTrapControlState = (district) => {
    if (!district) {
      return {
        visible: false,
        label: "Past",
        subtitle: "",
        title: "",
        buttonDisabled: true,
        isActiveHere: false,
        hasTrapElsewhere: false,
        moveLocked: false,
        buildingVisible: false,
        buildingLabel: "Toxická past",
        buildingMeta: "aktivní"
      };
    }

    const ownedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = ownedDistrictIds.has(Number(district.id));
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const hasTrapHere = Number(currentTrapDistrictId) === Number(district.id);
    const hasTrapElsewhere = Number(currentTrapDistrictId) > 0 && Number(currentTrapDistrictId) !== Number(district.id);
    const moveLocked = hasTrapElsewhere && Number(trapMoveCooldownSeconds) > 0;
    const sourceDistrictLabel = hasTrapElsewhere ? `District ${currentTrapDistrictId}` : "";

    let label = "Past";
    let subtitle = "";
    let title = "";
    let buttonDisabled = true;

    if (!isOwnedByCurrentPlayer) {
      title = `Past lze nastražit jen na vlastním districtu ${district.id}.`;
    } else if (isDestroyed) {
      title = "Do zničeného districtu nelze nastražit past.";
    } else if (hasTrapHere) {
      label = "Past aktivní";
      subtitle = trapMoveCooldownSeconds > 0 ? `${trapMoveCooldownSeconds}s cooldown` : "v tomto districtu";
      title = trapMoveCooldownSeconds > 0
        ? `Past už v tomto districtu běží. Přesun bude možný za ${trapMoveCooldownSeconds}s.`
        : `V tomto districtu je nastražená tvoje past.`;
    } else if (moveLocked) {
      label = "Přesunout past";
      subtitle = `${trapMoveCooldownSeconds}s`;
      title = `Past je zamčená v ${sourceDistrictLabel}. Přesun bude možný za ${trapMoveCooldownSeconds}s.`;
    } else if (hasTrapElsewhere) {
      label = "Přesunout past";
      subtitle = sourceDistrictLabel;
      title = `Máš jen 1 past. Přesuneš ji z ${sourceDistrictLabel} do tohoto districtu.`;
      buttonDisabled = false;
    } else {
      title = "Nastraž 1 past do svého districtu.";
      buttonDisabled = false;
    }

    return {
      visible: isOwnedByCurrentPlayer,
      label,
      subtitle,
      title,
      buttonDisabled,
      isActiveHere: hasTrapHere,
      hasTrapElsewhere,
      moveLocked,
      buildingVisible: hasTrapHere,
      buildingLabel: "Toxická past",
      buildingMeta: trapMoveCooldownSeconds > 0 ? `aktivní • ${trapMoveCooldownSeconds}s` : "aktivní"
    };
  };

  const hasKnownDistrictDefense = (district) => {
    if (!district) {
      return false;
    }

    const ownedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);

    if (ownedDistrictIds.has(Number(district.id))) {
      return true;
    }

    const spyIntel = getResolvedSpyIntel();
    return spyIntel.revealedDefenseDistrictIds.includes(Number(district.id));
  };

  const renderDistrictDefenseSummary = (district) => {
    if (!district || !popupDefense || !popupDefensePower) {
      return;
    }

    if (interactionState.destroyedDistrictIds.has(Number(district.id))) {
      popupDefense.textContent = "Rozpadlá";
      popupDefensePower.textContent = "0";

      if (popupResidents) {
        popupResidents.textContent = "0";
      }
      return;
    }

    if (!hasKnownDistrictDefense(district)) {
      popupDefense.textContent = "Neznámá";
      popupDefensePower.textContent = "Neznámá";

      if (popupResidents) {
        popupResidents.textContent = "Neznámí";
      }
      return;
    }

    const { loadout, residents, totalPower } = getDistrictDefenseState(district.id);
    popupDefense.textContent = formatDefenseLoadout(loadout) || "Žádná";
    popupDefensePower.textContent = String(totalPower);

    if (popupResidents) {
      popupResidents.textContent = String(residents);
    }
  };

  const renderDistrictEconomySummary = (district) => {
    if (!popupIncome || !popupHeat || !popupInfluence) {
      return;
    }

    if (!district) {
      popupIncome.textContent = "Bez dat";
      popupHeat.textContent = "Bez dat";
      popupInfluence.textContent = "Bez dat";
      return;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const isHidden = isLaunchPhase && isDistrictTypeHidden(district, interactionState) && !isOwnedByCurrentPlayer;
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));
    const economySnapshot = getDistrictEconomySnapshot(district);

    popupIncome.textContent = formatDistrictIncomeLabel(economySnapshot.totalHourlyIncome, {
      hidden: isHidden,
      destroyed: isDestroyed
    });
    popupHeat.textContent = formatDistrictHeatLabel(economySnapshot.passiveHeatPerDay, {
      hidden: isHidden,
      destroyed: isDestroyed
    });
    popupInfluence.textContent = formatDistrictInfluenceLabel(economySnapshot.totalInfluencePerHour, {
      hidden: isHidden,
      destroyed: isDestroyed
    });
  };

  const renderDistrictTooltipGossip = (district) => {
    if (!tooltipGossip) {
      return;
    }

    if (!district) {
      tooltipGossip.replaceChildren();
      return;
    }

    const entries = ensureDistrictPassiveGossip(district).slice(0, 2);
    tooltipGossip.replaceChildren();

    const label = document.createElement("div");
    label.className = "district-hover-tooltip__gossip-label";
    label.textContent = "Drby";
    tooltipGossip.append(label);

    const list = document.createElement("div");
    list.className = "district-hover-tooltip__gossip-list";

    if (entries.length <= 0) {
      const empty = document.createElement("div");
      empty.className = "district-hover-tooltip__gossip-empty";
      empty.textContent = "Zatím bez drbů.";
      list.append(empty);
    } else {
      for (const entry of entries) {
        const item = document.createElement("div");
        item.className = "district-hover-tooltip__gossip-item";

        const badge = document.createElement("span");
        badge.className = `district-hover-tooltip__gossip-badge district-hover-tooltip__gossip-badge--${entry.intelLevel === "verified" ? "verified" : "rumor"}`;
        badge.textContent = entry.intelLevel === "verified" ? "OVĚŘENO" : "DRB";

        const text = document.createElement("span");
        text.className = "district-hover-tooltip__gossip-text";
        text.textContent = entry.text;

        item.append(badge, text);
        list.append(item);
      }
    }

    tooltipGossip.append(list);
  };

  const renderDistrictPopupGossip = (district) => {
    if (!popupGossip || !popupGossipList) {
      return;
    }

    if (!district) {
      popupGossip.hidden = true;
      popupGossipList.replaceChildren();
      return;
    }

    const entries = getDistrictGossipEntries(district);
    const hasRealGossip = entries.some((entry) => String(entry?.intelType || "").trim().toLowerCase() !== "district_seed");

    popupGossip.hidden = !hasRealGossip;
    popupGossipList.replaceChildren();

    if (!hasRealGossip) {
      return;
    }

    for (const entry of entries) {
      if (String(entry?.intelType || "").trim().toLowerCase() === "district_seed") {
        continue;
      }

      const item = document.createElement("div");
      item.className = "district-popup-gossip__item";

      const text = document.createElement("div");
      text.className = "district-popup-gossip__text";
      text.textContent = entry.text;

      const metaRow = document.createElement("div");
      metaRow.className = "district-popup-gossip__meta-row";

      const badge = document.createElement("span");
      badge.className = `district-popup-gossip__badge district-popup-gossip__badge--${entry.intelLevel === "verified" ? "verified" : "rumor"}`;
      badge.textContent = entry.intelLevel === "verified" ? "OVĚŘENO" : "DRB";

      const meta = document.createElement("span");
      meta.className = "district-popup-gossip__meta";
      meta.textContent = formatDistrictGossipTimestamp(entry.createdAt);

      metaRow.append(badge, meta);
      item.append(text, metaRow);
      popupGossipList.append(item);
    }
  };

  const renderDistrictPopupFlags = (flags) => {
    if (!popupFlags) {
      return;
    }

    popupFlags.replaceChildren();

    for (const flag of flags) {
      const element = document.createElement("span");
      element.className = `district-popup-flag district-popup-flag--${flag.tone || "neutral"}`;
      element.textContent = flag.label;
      popupFlags.append(element);
    }
  };

  const openDistrictBuildingDetail = (district, buildingName, options = {}) => {
    const safeDistrict = district && geometry?.districts?.length
      ? geometry.districts.find((entry) => Number(entry.id) === Number(district.id)) || district
      : district;
    const buildingLabel = String(buildingName || "Budova").trim() || "Budova";
    const popupTarget = options.preferGenericDetail ? null : resolveBuildingPopupTarget(buildingLabel);

    if (safeDistrict?.id) {
      interactionState.selectedDistrictId = Number(safeDistrict.id);
      render();
      openPopup(safeDistrict);
    }

    if (options.closeBuildingsPopup) {
      closeBuildingsPopup();
    }

    if (!popupTarget) {
      if (popup) {
        popup.hidden = true;
      }
      openGenericDistrictBuildingDetail(root, safeDistrict, buildingLabel, options.displayName || buildingLabel);
      return true;
    }

    const openButton = root.querySelector(popupTarget.openSelector);
    if (!(openButton instanceof HTMLButtonElement)) {
      setBuildingActionFeedback(
        root,
        "warning",
        popupTarget.label,
        `Popup pro ${popupTarget.label} není momentálně dostupný.`,
        safeDistrict?.id ? `District ${safeDistrict.id}` : ""
      );
      return false;
    }

    openButton.click();
    if (popup) {
      popup.hidden = true;
    }
    return true;
  };

  const renderDistrictPopupBuildings = (district) => {
    if (!popupBuildings || !popupBuildingsMeta || !popupBuildingsList) {
      return;
    }

    popupBuildings.hidden = false;
    popupBuildingsList.replaceChildren();

    if (!district) {
      popupBuildingsMeta.textContent = "Bez dat";

      const empty = document.createElement("div");
      empty.className = "district-popup-buildings__empty";
      empty.textContent = "Budovy pro tento distrikt nejsou dostupné.";
      popupBuildingsList.append(empty);
      return;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const isHidden = isLaunchPhase && isDistrictTypeHidden(district, interactionState) && !isOwnedByCurrentPlayer;
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));

    if (isDestroyed) {
      popupBuildingsMeta.textContent = "Spálený blok";

      const destroyedMessage = document.createElement("div");
      destroyedMessage.className = "district-popup-buildings__empty";
      destroyedMessage.textContent = "V tomhle districtu po totálním zničení nezůstalo nic použitelného.";
      popupBuildingsList.append(destroyedMessage);
      return;
    }

    if (isHidden) {
      popupBuildingsMeta.textContent = "Nezjištěno";

      const hiddenMessage = document.createElement("div");
      hiddenMessage.className = "district-popup-buildings__empty";
      hiddenMessage.textContent = "Bez spy nebo vlastnictví zatím nevíš, jaké budovy jsou v tomto distriktu.";
      popupBuildingsList.append(hiddenMessage);
      return;
    }

    const buildingProfile = resolveDistrictBuildingProfile(district);
    if (!buildingProfile || buildingProfile.buildings.length <= 0) {
      popupBuildingsMeta.textContent = "Prázdný set";

      const empty = document.createElement("div");
      empty.className = "district-popup-buildings__empty";
      empty.textContent = "Tento distrikt teď nemá přiřazené žádné budovy.";
      popupBuildingsList.append(empty);
      return;
    }

    popupBuildingsMeta.textContent = `${buildingProfile.setTitle} · ${formatDistrictBuildingTierLabel(buildingProfile.tier)}`;
    const trapControlState = getDistrictTrapControlState(district);

    for (const building of buildingProfile.buildings) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "button district-popup-buildings__chip district-popup-buildings__chip--button";
      chip.dataset.districtBuildingName = building.baseName || building.displayName;
      chip.textContent = building.displayName;
      popupBuildingsList.append(chip);
    }

    if (trapControlState.buildingVisible) {
      const trapCard = document.createElement("div");
      trapCard.className = "district-popup-buildings__chip district-popup-buildings__chip--trap";

      const trapLabel = document.createElement("span");
      trapLabel.className = "district-popup-buildings__trap-label";
      trapLabel.textContent = trapControlState.buildingLabel || "Toxická past";

      const trapMeta = document.createElement("span");
      trapMeta.className = "district-popup-buildings__trap-meta";
      trapMeta.textContent = trapControlState.buildingMeta || "aktivní";

      trapCard.append(trapLabel, trapMeta);
      popupBuildingsList.append(trapCard);
    }
  };

  const getSourceDistrictsForBuildingType = (typeKey = "") => {
    if (!geometry?.districts?.length) {
      return [];
    }

    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);

    return geometry.districts
      .filter((district) => !typeKey || district.districtType === typeKey)
      .filter((district) => !isLaunchPhase || currentPlayerOwnedDistrictIds.has(Number(district.id)))
      .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0));
  };

  const getFirstAvailableBuildingDistrictType = () =>
    DISTRICT_BUILDING_TYPE_ORDER.find((typeKey) => getSourceDistrictsForBuildingType(typeKey).length > 0)
    || DISTRICT_BUILDING_TYPE_ORDER[0];

  const getBuildingEntriesForDistrictType = (typeKey = "") => {
    const districts = getSourceDistrictsForBuildingType(typeKey);
    const entries = [];

    for (const district of districts) {
      const buildingProfile = resolveDistrictBuildingProfile(district);
      if (!buildingProfile?.buildings?.length) {
        continue;
      }

      for (const building of buildingProfile.buildings) {
        const baseName = String(building.baseName || building.displayName || "Neznámá budova").trim() || "Neznámá budova";
        const displayName = String(building.displayName || baseName).trim() || baseName;
        const districtLabel = buildingProfile.districtLabel || `District ${district.id}`;

        entries.push({
          baseName,
          displayName,
          variantName: building.variantName || (displayName !== baseName ? displayName : null),
          districtId: Number(district.id) || 0,
          districtLabel,
          districtType: buildingProfile.typeKey,
          setTitle: buildingProfile.setTitle,
          tier: buildingProfile.tier
        });
      }
    }

    return entries.sort((left, right) =>
      left.baseName.localeCompare(right.baseName, "cs", { sensitivity: "base" })
      || Number(left.districtId || 0) - Number(right.districtId || 0)
    );
  };

  let activeBuildingsDistrictType = null;
  const selectedBuildingBaseNameByType = new Map();

  const renderBuildingsPopupTypes = (selectedType) => {
    if (!buildingsPopupTypeMount) {
      return;
    }

    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const typeButtons = DISTRICT_BUILDING_TYPE_ORDER.map((typeKey) => {
      const meta = DISTRICT_BUILDING_TYPE_META[typeKey] || DISTRICT_BUILDING_TYPE_META.resident;
      const districtCount = getSourceDistrictsForBuildingType(typeKey).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `button buildings-popup__type-btn buildings-popup__type-btn--${typeKey}${typeKey === selectedType ? " is-active" : ""}`;
      button.dataset.buildingsDistrictType = typeKey;

      const label = document.createElement("span");
      label.className = "buildings-popup__type-label";
      label.textContent = meta.shortLabel;

      const count = document.createElement("span");
      count.className = "buildings-popup__type-meta";
      count.textContent = districtCount > 0
        ? `${districtCount} districtů`
        : isLaunchPhase
          ? "Bez vlastního districtu"
          : "Bez districtu na mapě";

      button.append(label, count);
      return button;
    });

    buildingsPopupTypeMount.replaceChildren(...typeButtons);
  };

  const renderBuildingsPopupDetail = (selectedType) => {
    if (!buildingsPopupDetailMount) {
      return;
    }

    if (!selectedType || !DISTRICT_BUILDING_TYPE_META[selectedType]) {
      buildingsPopupDetailMount.replaceChildren();

      const card = document.createElement("section");
      card.className = "buildings-popup__detail-card";

      const title = document.createElement("h4");
      title.className = "buildings-popup__detail-title";
      title.textContent = "Vyber typ districtu";

      const empty = document.createElement("div");
      empty.className = "buildings-popup__empty";
      empty.textContent = "Po výběru typu uvidíš odemčené typy budov a konkrétní pojmenované budovy v tvých districtech.";

      card.append(title, empty);
      buildingsPopupDetailMount.append(card);
      return;
    }

    const meta = DISTRICT_BUILDING_TYPE_META[selectedType] || DISTRICT_BUILDING_TYPE_META.resident;
    const isLaunchPhase = (interactionState.gamePhase || "launch") === "launch";
    const entries = getBuildingEntriesForDistrictType(selectedType);
    const groupedByBaseName = new Map();

    for (const entry of entries) {
      const existing = groupedByBaseName.get(entry.baseName) || {
        baseName: entry.baseName,
        count: 0
      };

      existing.count += 1;
      groupedByBaseName.set(entry.baseName, existing);
    }

    const baseTypes = Array.from(groupedByBaseName.values()).sort((left, right) =>
      left.baseName.localeCompare(right.baseName, "cs", { sensitivity: "base" })
    );
    const selectedBaseName = String(selectedBuildingBaseNameByType.get(selectedType) || "").trim();
    const activeBaseName = baseTypes.some((entry) => entry.baseName === selectedBaseName)
      ? selectedBaseName
      : (baseTypes[0]?.baseName || "");
    const scopedEntries = activeBaseName
      ? entries
        .filter((entry) => entry.baseName === activeBaseName)
        .sort((left, right) => Number(left.districtId || 0) - Number(right.districtId || 0))
      : [];

    if (activeBaseName) {
      selectedBuildingBaseNameByType.set(selectedType, activeBaseName);
    } else {
      selectedBuildingBaseNameByType.delete(selectedType);
    }

    buildingsPopupDetailMount.replaceChildren();

    const card = document.createElement("section");
    card.className = "buildings-popup__detail-card";
    card.dataset.buildingDistrictType = selectedType;

    const title = document.createElement("h4");
    title.className = "buildings-popup__detail-title";
    title.textContent = meta.label;

    const copy = document.createElement("p");
    copy.className = "buildings-popup__detail-copy";
    copy.textContent = isLaunchPhase
      ? "DEV-ONLY fáze zobrazuje jen budovy v districtech, které aktuálně vlastníš."
      : "LIVE fáze zobrazuje všechny budovy vybraného typu districtu, jako by byly tvoje.";

    card.append(title, copy);

    if (entries.length <= 0) {
      const empty = document.createElement("div");
      empty.className = "buildings-popup__empty";
      empty.textContent = isLaunchPhase
        ? "Zaber nebo kup district tohoto typu a tady se objeví jeho budovy."
        : "Na mapě teď nejsou dostupné žádné budovy pro tento typ districtu.";
      card.append(empty);
      buildingsPopupDetailMount.append(card);
      return;
    }

    const buildingTypeGroup = document.createElement("div");
    buildingTypeGroup.className = "buildings-popup__group buildings-popup__group--types";

    const buildingTypeGrid = document.createElement("div");
    buildingTypeGrid.className = "buildings-popup__building-grid buildings-popup__building-grid--types";

    for (const item of baseTypes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `button buildings-popup__building buildings-popup__building--type buildings-popup__building--interactive${item.baseName === activeBaseName ? " is-active" : ""}`;
      button.dataset.buildingsSelectBaseName = item.baseName;
      button.dataset.buildingsSelectBaseType = selectedType;

      const name = document.createElement("span");
      name.textContent = item.baseName;

      const count = document.createElement("span");
      count.textContent = `${item.count}x`;

      button.append(name, count);
      buildingTypeGrid.append(button);
    }

    const divider = document.createElement("div");
    divider.className = "buildings-popup__group-divider";
    divider.setAttribute("aria-hidden", "true");

    const variantsGroup = document.createElement("div");
    variantsGroup.className = "buildings-popup__group buildings-popup__group--names";

    const variantsGrid = document.createElement("div");
    variantsGrid.className = "buildings-popup__building-grid buildings-popup__building-grid--names";

    if (scopedEntries.length > 0) {
      for (const entry of scopedEntries) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button buildings-popup__building buildings-popup__building--name buildings-popup__building--interactive";
        button.dataset.buildingsOpenBuildingName = entry.baseName;
        button.dataset.buildingsOpenBuildingDisplayName = entry.displayName;
        button.dataset.buildingsOpenBuildingDistrictId = String(entry.districtId);

        const label = document.createElement("span");
        label.textContent = entry.displayName;

        button.title = `${entry.displayName} · ${entry.districtLabel}`;
        button.append(label);
        variantsGrid.append(button);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "buildings-popup__empty";
      empty.textContent = "Vyber typ budovy a zobrazí se její districty.";
      variantsGroup.append(empty);
    }

    buildingTypeGroup.append(buildingTypeGrid);
    variantsGroup.append(variantsGrid);
    card.append(buildingTypeGroup, divider, variantsGroup);
    buildingsPopupDetailMount.append(card);
  };

  const renderBuildingsPopup = (selectedType = activeBuildingsDistrictType) => {
    const nextType = selectedType && DISTRICT_BUILDING_TYPE_META[selectedType]
      ? selectedType
      : null;
    activeBuildingsDistrictType = nextType;
    renderBuildingsPopupTypes(nextType);
    renderBuildingsPopupDetail(nextType);
  };

  const closeBuildingsPopup = () => {
    if (buildingsPopup) {
      buildingsPopup.hidden = true;
    }
  };

  const openBuildingsPopup = () => {
    if (!buildingsPopup) {
      return;
    }

    selectedBuildingBaseNameByType.clear();
    renderBuildingsPopup(null);
    buildingsPopup.hidden = false;
    document.dispatchEvent(new CustomEvent("empire:buildings-popup-opened", { detail: { open: true } }));
  };

  const applyDistrictPopupOverviewMode = () => {
    if (!popupCard) {
      return;
    }

    popupCard.dataset.overviewEnabled = isDistrictPopupOverviewEnabled ? "true" : "false";

    if (popupToggle instanceof HTMLButtonElement) {
      popupToggle.textContent = isDistrictPopupOverviewEnabled ? "Vypnout přehled" : "Zapnout přehled";
      popupToggle.setAttribute("aria-pressed", isDistrictPopupOverviewEnabled ? "true" : "false");
    }
  };

  const getAvailableAttackPopulation = () => {
    const rawValue = gangMembersValue?.textContent || "0";
    const numericValue = Number.parseInt(rawValue.replace(/[^\d]/g, ""), 10) || 0;
    return numericValue;
  };

  const getAdjacentOwnedDistrictIds = (district) => {
    if (!district) {
      return [];
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    return getAdjacentDistrictIdsFromGeometry(geometry, district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
  };

  const getPreparedAttackContext = (district) => {
    if (!district) {
      return null;
    }

    const sourceDistrictId = attackSourceSelect instanceof HTMLSelectElement ? attackSourceSelect.value : "";
    const { totalResidents, totalPower, canConfirm } = renderAttackSummary();
    const worldState = getResolvedWorldState();
    const baseDefensePower = worldState.districtDefenseById[district.id]
      ?? estimateDistrictDefense({
        districtType: district.districtType,
        isOccupied: getDistrictOwnerLabel(district, interactionState) !== "Neobsazeno",
        districtId: district.id
      });
    const boostContext = getFactoryAttackBoostContext({
      attackPower: totalPower,
      defensePower: baseDefensePower
    });
    const hasTrapDefense = Boolean(worldState.districtTrapById?.[district.id]?.isArmed);
    const resolvedScenario = resolveAttackOutcome({
      attackPower: boostContext.effectiveAttackPower,
      defensePower: boostContext.effectiveDefensePower
    });
    const attackLoadout = {};
    const selectedWeapons = [];

    for (const input of attackWeaponInputs) {
      const weaponId = input.dataset.attackWeaponInput;
      const amount = Number.parseInt(input.value || "0", 10) || 0;

      if (!weaponId || amount <= 0) {
        continue;
      }

      attackLoadout[weaponId] = amount;
      selectedWeapons.push(`${ATTACK_WEAPON_LABELS[weaponId] || weaponId} x${amount}`);
    }

    return {
      sourceDistrictId,
      totalResidents,
      totalPower,
      canConfirm,
      attackLoadout,
      selectedWeaponsLabel: selectedWeapons.join(", "),
      baseDefensePower,
      boostContext,
      hasTrapDefense,
      resolvedScenario
    };
  };

  const renderAttackSummary = () => {
    if (!attackRequiredPopulation || !attackEstimatedPower || !attackStatus || !attackSourceSelect) {
      return { totalResidents: 0, totalPower: 0, canConfirm: false };
    }

    const selectedLoadout = {};

    for (const input of attackWeaponInputs) {
      const weaponId = input.dataset.attackWeaponInput;

      if (!weaponId || !ATTACK_SETUP_WEAPONS[weaponId]) {
        continue;
      }

      const amount = Math.max(0, Number.parseInt(input.value || "0", 10) || 0);

      if (amount > 0) {
        selectedLoadout[weaponId] = amount;
      }
    }

    const { totalResidents, totalPower } = calculateAttackDeployment(selectedLoadout);
    const availablePopulation = getAvailableAttackPopulation();
    const { canConfirm, status } = validateAttackSelection({
      sourceDistrictId: attackSourceSelect.value,
      totalResidents,
      totalPower,
      availablePopulation
    });

    attackAvailablePopulation.textContent = String(availablePopulation);
    attackRequiredPopulation.textContent = String(totalResidents);
    attackEstimatedPower.textContent = String(totalPower);
    attackStatus.textContent = status;

    if (attackConfirmButton instanceof HTMLButtonElement) {
      attackConfirmButton.disabled = !canConfirm;
    }

    return { totalResidents, totalPower, canConfirm };
  };

  const renderRobberySummary = () => {
    if (!robberyStatus || !robberySourceSelect || !robberyAvailableMembers || !(robberyMemberInput instanceof HTMLInputElement)) {
      return { deployedMembers: 0, canConfirm: false };
    }

    const availableMembers = getAvailableAttackPopulation();
    const deployedMembers = clamp(Number.parseInt(robberyMemberInput.value || "0", 10) || 0, 0, availableMembers);
    robberyMemberInput.value = String(deployedMembers);
    robberyAvailableMembers.textContent = String(availableMembers);

    const hasSourceDistrict = Boolean(robberySourceSelect.value);
    const canConfirm = hasSourceDistrict && deployedMembers > 0;

    robberyStatus.textContent = !hasSourceDistrict
      ? "Chybí sousední district"
      : deployedMembers <= 0
        ? "Vyber členy gangu"
        : "Připraveno";

    if (robberyConfirmButton instanceof HTMLButtonElement) {
      robberyConfirmButton.disabled = !canConfirm;
    }

    return { deployedMembers, canConfirm };
  };

  const renderDefenseSummary = () => {
    if (
      !defenseStatus ||
      !defenseEstimatedPower ||
      !(defenseResidentsInput instanceof HTMLInputElement)
    ) {
      return { residents: 0, totalPower: 0, canConfirm: false };
    }

    const selectedLoadout = {};

    for (const input of defenseWeaponInputs) {
      const weaponId = input.dataset.defenseWeaponInput;

      if (!weaponId) {
        continue;
      }

      const maxInventory = Number.parseInt(input.max || "0", 10) || 0;
      const amount = clamp(Number.parseInt(input.value || "0", 10) || 0, 0, maxInventory);
      input.value = String(amount);

      if (amount > 0) {
        selectedLoadout[weaponId] = amount;
      }
    }

    const residents = Math.max(0, Number.parseInt(defenseResidentsInput.value || "0", 10) || 0);
    defenseResidentsInput.value = String(residents);

    const totalPower = calculateTotalDefensePower({ loadout: selectedLoadout, residents });
    defenseEstimatedPower.textContent = String(totalPower);
    defenseStatus.textContent = totalPower > 0 ? "Připraveno" : "Bez obrany";

    if (defenseConfirmButton instanceof HTMLButtonElement) {
      defenseConfirmButton.disabled = false;
    }

    return { residents, totalPower, canConfirm: true };
  };

  const populateAttackSetupPopup = (district) => {
    if (
      !attackSetupPopup ||
      !attackTargetTitle ||
      !attackSourceSelect ||
      !attackAvailablePopulation ||
      !attackRequiredPopulation ||
      !attackEstimatedPower ||
      !attackStatus
    ) {
      return;
    }

    pendingAttackContext = null;

    const ownedInventory = getResolvedWeaponInventory();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(geometry, district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    applyDistrictAtmosphere({
      card: attackSetupCard,
      imageElement: attackSetupAtmosphereImage,
      labelElement: attackSetupAtmosphereLabel,
      atmosphereMeta
    });

    attackTargetTitle.textContent = `District ${district.id}`;
    attackSourceSelect.replaceChildren();

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = adjacentOwnedDistrictIds.length > 0 ? "Vyber district" : "Žádný sousední district";
    attackSourceSelect.append(placeholderOption);

    for (const sourceDistrictId of adjacentOwnedDistrictIds) {
      const option = document.createElement("option");
      option.value = String(sourceDistrictId);
      option.textContent = `District ${sourceDistrictId}`;
      attackSourceSelect.append(option);
    }

    if (adjacentOwnedDistrictIds.length === 1) {
      attackSourceSelect.value = String(adjacentOwnedDistrictIds[0]);
    }

    attackSourceSelect.disabled = adjacentOwnedDistrictIds.length === 0;

    for (const ownedElement of attackOwnedElements) {
      const weaponId = ownedElement.dataset.attackOwned;

      if (!weaponId) {
        continue;
      }

      ownedElement.textContent = String(ownedInventory[weaponId] ?? 0);
    }

    for (const input of attackWeaponInputs) {
      const weaponId = input.dataset.attackWeaponInput;
      const ownedAmount = weaponId ? ownedInventory[weaponId] ?? 0 : 0;
      input.value = "0";
      input.max = String(ownedAmount);
      input.disabled = ownedAmount <= 0;
    }

    renderAttackSummary();
  };

  const populateAttackConfirmPopup = (district, preparedContext = null) => {
    if (
      !district ||
      !attackConfirmTitle ||
      !attackConfirmSource ||
      !attackConfirmMembers ||
      !attackConfirmPower ||
      !attackConfirmScenario ||
      !attackConfirmDuration ||
      !attackConfirmNote
    ) {
      return;
    }

    const context = preparedContext || pendingAttackContext || getPreparedAttackContext(district);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const scenarioLabel = context?.hasTrapDefense ? "Toxická past" : (context?.resolvedScenario?.label || "Neznámý");
    const cooldownSeconds = Math.ceil(Number(context?.boostContext?.cooldownMs || ATTACK_COOLDOWN_MS) / 1000);

    pendingAttackContext = context;

    applyDistrictAtmosphere({
      card: attackConfirmCard,
      imageElement: attackConfirmAtmosphereImage,
      labelElement: attackConfirmAtmosphereLabel,
      atmosphereMeta
    });

    attackConfirmTitle.textContent = `District ${district.id}`;
    attackConfirmSource.textContent = context?.sourceDistrictId ? `District ${context.sourceDistrictId}` : "Žádný soused";
    attackConfirmMembers.textContent = String(context?.totalResidents ?? 0);
    attackConfirmPower.textContent = String(context?.boostContext?.effectiveAttackPower ?? context?.totalPower ?? 0);
    attackConfirmScenario.textContent = scenarioLabel;
    attackConfirmDuration.textContent = `${cooldownSeconds}s`;
    attackConfirmNote.textContent = !context?.sourceDistrictId
      ? "Útok vyžaduje sousední vlastní district."
      : !context?.canConfirm
        ? "Nejdřív nastav validní loadout a dostatek obyvatel pro útok."
        : context?.hasTrapDefense
          ? `Cíl je krytý toxickou pastí. Útočná výzbroj: ${context.selectedWeaponsLabel || "bez výzbroje"}.`
          : `Výzbroj: ${context?.selectedWeaponsLabel || "bez výzbroje"}.${context?.boostContext?.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`;

    if (attackConfirmFinalButton instanceof HTMLButtonElement) {
      attackConfirmFinalButton.disabled = !context?.canConfirm;
    }
  };

  const populateRobberySetupPopup = (district) => {
    if (
      !robberySetupPopup ||
      !robberyTargetTitle ||
      !(robberySourceSelect instanceof HTMLSelectElement) ||
      !robberyAvailableMembers ||
      !(robberyMemberInput instanceof HTMLInputElement) ||
      !robberyStatus
    ) {
      return;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(geometry, district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    applyDistrictAtmosphere({
      card: robberySetupCard,
      imageElement: robberySetupAtmosphereImage,
      labelElement: robberySetupAtmosphereLabel,
      atmosphereMeta
    });

    robberyTargetTitle.textContent = `District ${district.id}`;
    robberySourceSelect.replaceChildren();

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = adjacentOwnedDistrictIds.length > 0 ? "Vyber district" : "Žádný sousední district";
    robberySourceSelect.append(placeholderOption);

    for (const sourceDistrictId of adjacentOwnedDistrictIds) {
      const option = document.createElement("option");
      option.value = String(sourceDistrictId);
      option.textContent = `District ${sourceDistrictId}`;
      robberySourceSelect.append(option);
    }

    if (adjacentOwnedDistrictIds.length === 1) {
      robberySourceSelect.value = String(adjacentOwnedDistrictIds[0]);
    }

    robberySourceSelect.disabled = adjacentOwnedDistrictIds.length === 0;
    robberyMemberInput.value = "0";
    robberyMemberInput.max = String(getAvailableAttackPopulation());
    renderRobberySummary();
  };

  const populateRobberyConfirmPopup = (district) => {
    if (
      !district ||
      !robberyConfirmTitle ||
      !robberyConfirmSource ||
      !robberyConfirmMembers ||
      !robberyConfirmDuration ||
      !robberyConfirmNote
    ) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const { deployedMembers, canConfirm } = renderRobberySummary();
    const sourceDistrictId = robberySourceSelect instanceof HTMLSelectElement ? robberySourceSelect.value : "";

    applyDistrictAtmosphere({
      card: robberyConfirmCard,
      imageElement: robberyConfirmAtmosphereImage,
      labelElement: robberyConfirmAtmosphereLabel,
      atmosphereMeta
    });

    robberyConfirmTitle.textContent = `District ${district.id}`;
    robberyConfirmSource.textContent = sourceDistrictId ? `District ${sourceDistrictId}` : "Žádný soused";
    robberyConfirmMembers.textContent = String(deployedMembers);
    robberyConfirmDuration.textContent = `${Math.ceil(ROBBERY_COOLDOWN_MS / 1000)}s`;
    robberyConfirmNote.textContent = !sourceDistrictId
      ? "Vykradení vyžaduje sousední vlastní district."
      : deployedMembers <= 0
        ? "Nejdřív nastav počet nasazených členů gangu."
        : "Po potvrzení vyrazí crew na loot run. District musí být prázdný a návrat proběhne po cooldownu.";

    if (robberyConfirmFinalButton instanceof HTMLButtonElement) {
      robberyConfirmFinalButton.disabled = !canConfirm;
    }
  };

  const populateDefenseSetupPopup = (district) => {
    if (
      !defenseSetupPopup ||
      !defenseTargetTitle ||
      !(defenseResidentsInput instanceof HTMLInputElement) ||
      !defenseStatus ||
      !defenseEstimatedPower
    ) {
      return;
    }

    const ownedInventory = getResolvedWeaponInventory();
    const currentDefense = getDistrictDefenseState(district.id);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    applyDistrictAtmosphere({
      card: defenseSetupCard,
      imageElement: defenseSetupAtmosphereImage,
      labelElement: defenseSetupAtmosphereLabel,
      atmosphereMeta
    });

    defenseTargetTitle.textContent = `District ${district.id}`;

    for (const ownedElement of defenseOwnedElements) {
      const weaponId = ownedElement.dataset.defenseOwned;

      if (!weaponId) {
        continue;
      }

      const currentAmount = currentDefense.loadout[weaponId] ?? 0;
      ownedElement.textContent = String((ownedInventory[weaponId] ?? 0) + currentAmount);
    }

    for (const input of defenseWeaponInputs) {
      const weaponId = input.dataset.defenseWeaponInput;
      const currentAmount = weaponId ? currentDefense.loadout[weaponId] ?? 0 : 0;
      const availableAmount = weaponId ? (ownedInventory[weaponId] ?? 0) + currentAmount : 0;
      input.max = String(availableAmount);
      input.value = String(currentAmount);
      input.disabled = availableAmount <= 0 && currentAmount <= 0;
    }

    defenseResidentsInput.value = String(currentDefense.residents);
    renderDefenseSummary();
  };

  const persistDefenseSetup = (selectedDistrict) => {
    if (!selectedDistrict) {
      return;
    }

    const { residents, totalPower } = renderDefenseSummary();
    const currentDefense = getDistrictDefenseState(selectedDistrict.id);
    const ownedInventory = getResolvedWeaponInventory();
    const nextInventory = { ...ownedInventory };
    const nextLoadout = {};

    for (const input of defenseWeaponInputs) {
      const weaponId = input.dataset.defenseWeaponInput;

      if (!weaponId) {
        continue;
      }

      const availableAmount = (ownedInventory[weaponId] ?? 0) + (currentDefense.loadout[weaponId] ?? 0);
      const nextAmount = clamp(Number.parseInt(input.value || "0", 10) || 0, 0, availableAmount);

      input.value = String(nextAmount);
      nextInventory[weaponId] = Math.max(0, availableAmount - nextAmount);

      if (nextAmount > 0) {
        nextLoadout[weaponId] = nextAmount;
      }
    }

    const worldState = getResolvedWorldState();
    setStoredWeaponInventory(nextInventory);
    setStoredWorldState({
      ...worldState,
      districtDefenseById: {
        ...worldState.districtDefenseById,
        [selectedDistrict.id]: totalPower
      },
      districtDefenseLoadoutById: {
        ...worldState.districtDefenseLoadoutById,
        [selectedDistrict.id]: nextLoadout
      },
      districtDefenseResidentsById: {
        ...worldState.districtDefenseResidentsById,
        [selectedDistrict.id]: residents
      }
    });

    if (buildingActionState) {
      buildingActionState.textContent = "Obrana";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `District ${selectedDistrict.id} má obranu: ${formatDefenseLoadout(nextLoadout) || "Žádná"}. Obyvatelé v obraně: ${residents}.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Síla obrany ${totalPower} · District ${selectedDistrict.id}`;
    }

    populateDefenseSetupPopup(selectedDistrict);
    render();
  };

  const populateTrapConfirmPopup = (district) => {
    if (!district || !trapConfirmTitle || !trapConfirmCooldown || !trapConfirmNote) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const isMovingTrap = Boolean(currentTrapDistrictId && currentTrapDistrictId !== district.id);
    const isSameDistrict = Number(currentTrapDistrictId) === Number(district.id);

    applyDistrictAtmosphere({
      card: trapConfirmCard,
      imageElement: trapConfirmAtmosphereImage,
      labelElement: trapConfirmAtmosphereLabel,
      atmosphereMeta
    });

    trapConfirmTitle.textContent = `District ${district.id}`;
    trapConfirmCooldown.textContent = trapMoveCooldownSeconds > 0 ? `${trapMoveCooldownSeconds}s` : "Připraveno";
    trapConfirmNote.textContent = isSameDistrict
      ? "Toxická past už je aktivní v tomto districtu."
      : isMovingTrap
        ? `Přesune aktivní toxickou past z District ${currentTrapDistrictId} sem. Po přesunu se znovu rozjede toxický kouř.`
        : "Nastraží toxickou past do vybraného distriktu. Útočník v ní ztratí všechny nasazené lidi i výzbroj.";

    if (trapConfirmButton instanceof HTMLButtonElement) {
      trapConfirmButton.textContent = isMovingTrap ? "Přesunout past" : "Nastražit past";
      trapConfirmButton.disabled = isSameDistrict || (isMovingTrap && trapMoveCooldownSeconds > 0);
    }
  };

  const populateSpyConfirmPopup = (district) => {
    if (!district || !spyConfirmTitle || !spyConfirmSource || !spyConfirmAvailable || !spyConfirmDuration || !spyConfirmNote) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const spyState = getResolvedSpyState();
    const hasSourceDistrict = adjacentOwnedDistrictIds.length > 0;
    const canConfirm = hasSourceDistrict && spyState.available > 0;

    applyDistrictAtmosphere({
      card: spyConfirmCard,
      imageElement: spyConfirmAtmosphereImage,
      labelElement: spyConfirmAtmosphereLabel,
      atmosphereMeta
    });

    spyConfirmTitle.textContent = `District ${district.id}`;
    spyConfirmSource.textContent = hasSourceDistrict ? `District ${adjacentOwnedDistrictIds[0]}` : "Žádný soused";
    spyConfirmAvailable.textContent = String(spyState.available);
    spyConfirmDuration.textContent = `${Math.ceil(SPY_COOLDOWN_MS / 1000)}s`;
    spyConfirmNote.textContent = !hasSourceDistrict
      ? "Špehování vyžaduje sousední vlastní district."
      : spyState.available <= 0
        ? "Nemáš dostupného špeha. Bez špeha akci nespustíš."
        : "Částečný úspěch odhalí typ distriktu. Úspěch odhalí i obranu a odemkne akci Obsadit.";

    if (spyConfirmButton instanceof HTMLButtonElement) {
      spyConfirmButton.disabled = !canConfirm;
      spyConfirmButton.textContent = "Vyslat špeha";
    }
  };

  const populateOccupyConfirmPopup = (district) => {
    if (!district || !occupyConfirmTitle || !occupyConfirmSource || !occupyConfirmCondition || !occupyConfirmDuration || !occupyConfirmNote) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const spyIntel = getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(district.id));
    const hasSourceDistrict = adjacentOwnedDistrictIds.length > 0;
    const canConfirm = hasSourceDistrict && canOccupyAfterSpy;

    applyDistrictAtmosphere({
      card: occupyConfirmCard,
      imageElement: occupyConfirmAtmosphereImage,
      labelElement: occupyConfirmAtmosphereLabel,
      atmosphereMeta
    });

    occupyConfirmTitle.textContent = `District ${district.id}`;
    occupyConfirmSource.textContent = hasSourceDistrict ? `District ${adjacentOwnedDistrictIds[0]}` : "Žádný soused";
    occupyConfirmCondition.textContent = canOccupyAfterSpy ? "Špehování potvrzeno" : "Chybí špehování";
    occupyConfirmDuration.textContent = "20s";
    occupyConfirmNote.textContent = !hasSourceDistrict
      ? "Obsazení vyžaduje sousední vlastní district."
      : !canOccupyAfterSpy
        ? "Nejdřív musí proběhnout úspěšné špehování. Teprve pak lze district obsadit."
        : "Po potvrzení se spustí 20 sekundové obsazování. District bliká tvojí barvou a po doběhnutí přejde pod tebe.";

    if (occupyConfirmButton instanceof HTMLButtonElement) {
      occupyConfirmButton.disabled = !canConfirm;
      occupyConfirmButton.textContent = "Spustit obsazení";
    }
  };

  const applyAttackAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    const context = pendingAttackContext || getPreparedAttackContext(selectedDistrict);

    if (!context?.canConfirm) {
      return false;
    }

    const ownedInventory = getResolvedWeaponInventory();
    const nextInventory = { ...ownedInventory };

    for (const [weaponId, amount] of Object.entries(context.attackLoadout || {})) {
      nextInventory[weaponId] = Math.max(0, (nextInventory[weaponId] ?? 0) - amount);
    }

    const createdOrder = {
      id: `attack-order:${Date.now()}`,
      playerId: `player:${CURRENT_PLAYER_ID}`,
      targetDistrictId: `district:${selectedDistrict.id}`,
      sourceDistrictId: `district:${context.sourceDistrictId}`,
      attackLoadout: context.attackLoadout,
      requiredPopulation: context.totalResidents,
      estimatedAttackPower: context.boostContext.effectiveAttackPower,
      targetDefensePower: context.boostContext.effectiveDefensePower,
      baseAttackPower: context.totalPower,
      baseDefensePower: context.baseDefensePower,
      factoryBoost: context.boostContext.activeBoost?.type
        ? {
            type: context.boostContext.activeBoost.type,
            label: context.boostContext.activeBoost.label,
            attackPowerPct: Number(context.boostContext.activeBoost.config?.attackPowerPct || 0),
            attackSpeedPct: Number(context.boostContext.activeBoost.config?.attackSpeedPct || 0),
            defenseIgnorePct: Number(context.boostContext.activeBoost.config?.defenseIgnorePct || 0),
            destroyBuildingChancePct: Number(context.boostContext.activeBoost.config?.destroyBuildingChancePct || 0),
            policeInterventionRiskPct: Number(context.boostContext.activeBoost.config?.policeInterventionRiskPct || 0),
            heatAdded: Number(context.boostContext.activeBoost.config?.heatAdded || 0)
          }
        : null,
      resolvedScenario: context.resolvedScenario,
      hasTrapDefense: context.hasTrapDefense,
      createdAt: new Date().toISOString(),
      resolveAt: new Date(Date.now() + context.boostContext.cooldownMs).toISOString(),
      status: "cooldown"
    };

    setStoredGangState({
      members: Math.max(0, getResolvedGangState().members - context.totalResidents)
    });
    setStoredWeaponInventory(nextInventory);
    if (context.boostContext.activeBoost?.type) {
      clearFactoryActiveBoost();
    }
    setStoredAttackOrders([
      ...getStoredAttackOrders(),
      createdOrder
    ]);
    renderGangMembersState(root);
    scheduleAttackOrder(root, createdOrder);
    recordDistrictIntelEvent({
      type: "attack_started",
      districtId: selectedDistrict.id,
      sourceDistrictId: context.sourceDistrictId,
      intelLevel: "verified"
    });

    if (buildingActionState) {
      buildingActionState.textContent = "Rozkaz";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = createdOrder.hasTrapDefense
        ? `District ${context.sourceDistrictId} zahájí útok na District ${selectedDistrict.id}. Cíl je krytý toxickou pastí. Výzbroj: ${context.selectedWeaponsLabel}.${context.boostContext.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`
        : `District ${context.sourceDistrictId} zahájí útok na District ${selectedDistrict.id}. Výzbroj: ${context.selectedWeaponsLabel}. Výsledek: ${createdOrder.resolvedScenario.label}.${context.boostContext.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Síla ${createdOrder.estimatedAttackPower} · Obrana ${createdOrder.targetDefensePower} · Obyvatelé ${context.totalResidents} · cooldown ${Math.ceil(context.boostContext.cooldownMs / 1000)}s`;
    }

    pendingAttackContext = null;
    showAttackToast(root);
    closeAttackConfirmPopup();
    closeAttackSetupPopup();
    closePopup();
    return true;
  };

  const applyTrapAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    const worldState = getResolvedWorldState();
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const nextTrapState = { ...(worldState.districtTrapById || {}) };

    if (currentTrapDistrictId === selectedDistrict.id) {
      return false;
    }

    if (currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id && trapMoveCooldownSeconds > 0) {
      if (buildingActionState) {
        buildingActionState.textContent = "Past";
        buildingActionState.classList.remove("building-action-status__state--idle");
      }

      if (buildingActionSummary) {
        buildingActionSummary.textContent = `Past lze přesunout až za ${trapMoveCooldownSeconds} sekund.`;
      }

      if (buildingActionMeta) {
        buildingActionMeta.textContent = `Aktivní past v District ${currentTrapDistrictId} · cooldown běží`;
      }

      return false;
    }

    if (currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id) {
      nextTrapState[currentTrapDistrictId] = {
        ...nextTrapState[currentTrapDistrictId],
        isArmed: false,
        movedAt: new Date().toISOString()
      };
    }

    nextTrapState[selectedDistrict.id] = {
      ownerId: CURRENT_PLAYER_ID,
      isArmed: true,
      armedAt: nextTrapState[selectedDistrict.id]?.armedAt || new Date().toISOString(),
      movedAt: currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id
        ? new Date().toISOString()
        : (nextTrapState[selectedDistrict.id]?.movedAt || null)
    };

    setStoredWorldState({
      ...worldState,
      districtTrapById: nextTrapState
    });
    recordDistrictIntelEvent({
      type: currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id ? "trap_moved" : "trap_armed",
      districtId: selectedDistrict.id,
      sourceDistrictId: currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id ? currentTrapDistrictId : selectedDistrict.id,
      intelLevel: "rumor"
    });

    if (buildingActionState) {
      buildingActionState.textContent = "Past";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id
        ? `Past byla přesunuta z District ${currentTrapDistrictId} do District ${selectedDistrict.id}. Toxický kouř je aktivní.`
        : `District ${selectedDistrict.id} má nastraženou toxickou past. Toxický kouř je aktivní.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Vlastní district ${selectedDistrict.id} · 1 aktivní past na hráče`;
    }

    closeTrapConfirmPopup();
    closePopup();
    ensureMissionAnimationLoop();
    return true;
  };

  const applyOccupyAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(selectedDistrict);
    const spyIntel = getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(selectedDistrict.id));

    if (!canOccupyAfterSpy || adjacentOwnedDistrictIds.length <= 0) {
      return false;
    }

    const createdOrder = {
      id: `occupy-order:${Date.now()}`,
      sourceDistrictId: `district:${adjacentOwnedDistrictIds[0]}`,
      targetDistrictId: `district:${selectedDistrict.id}`,
      createdAt: new Date().toISOString(),
      resolveAt: new Date(Date.now() + 20_000).toISOString(),
      status: "cooldown"
    };

    setStoredOccupyOrders([
      ...getStoredOccupyOrders().filter((order) => Number(String(order.targetDistrictId || "").replace("district:", "")) !== Number(selectedDistrict.id)),
      createdOrder
    ]);
    recordDistrictIntelEvent({
      type: "occupy_started",
      districtId: selectedDistrict.id,
      sourceDistrictId: createdOrder.sourceDistrictId,
      intelLevel: "verified"
    });
    scheduleOccupyOrder(root, createdOrder);
    render();
    ensureMissionAnimationLoop();

    if (buildingActionState) {
      buildingActionState.textContent = "Obsazení";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `District ${selectedDistrict.id} se obsazuje po spy akci Úspěch. Obsazení potrvá 20 sekund.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Zdroj District ${adjacentOwnedDistrictIds[0]} · District ${selectedDistrict.id} · cooldown 20s`;
    }

    closeOccupyConfirmPopup();
    closePopup();
    return true;
  };

  const applyRobberyAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    const sourceDistrictId = robberySourceSelect instanceof HTMLSelectElement ? robberySourceSelect.value : "";
    const { deployedMembers, canConfirm } = renderRobberySummary();

    if (!canConfirm) {
      return false;
    }

    setStoredGangState({
      members: Math.max(0, getResolvedGangState().members - deployedMembers)
    });
    renderGangMembersState(root);

    const robberyDurationMs = getRobberyActionDurationMs();
    const createdOrder = {
      id: `robbery-order:${Date.now()}`,
      playerId: `player:${CURRENT_PLAYER_ID}`,
      targetDistrictId: `district:${selectedDistrict.id}`,
      sourceDistrictId: `district:${sourceDistrictId}`,
      deployedMembers,
      createdAt: new Date().toISOString(),
      resolveAt: new Date(Date.now() + robberyDurationMs).toISOString(),
      status: "cooldown"
    };

    setStoredRobberyOrders([
      ...getStoredRobberyOrders(),
      createdOrder
    ]);
    recordDistrictIntelEvent({
      type: "raid_started",
      districtId: selectedDistrict.id,
      sourceDistrictId,
      intelLevel: "verified"
    });
    scheduleRobberyOrder(root, createdOrder);
    render();
    ensureMissionAnimationLoop();

    if (buildingActionState) {
      buildingActionState.textContent = "Vykradení";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `District ${sourceDistrictId} zahájí vykradení District ${selectedDistrict.id}. Nasazeno ${deployedMembers} členů gangu. Akce běží ${Math.ceil(robberyDurationMs / 1000)} sekund.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Loot run · Členové ${deployedMembers} · Cíl District ${selectedDistrict.id} · cooldown ${Math.ceil(robberyDurationMs / 1000)}s`;
    }

    hideTooltip();
    closePopup();
    showRobberyToast(root);
    return true;
  };

  const applySpyAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(selectedDistrict);
    const latestSpyState = getResolvedSpyState();
    const activeMissionCount = Array.isArray(latestSpyState.missions) ? latestSpyState.missions.length : 0;

    if (adjacentOwnedDistrictIds.length === 0 || latestSpyState.available <= 0 || activeMissionCount >= MAX_SPIES) {
      return false;
    }

    const pharmacySnapshot = getPharmacyBoostSnapshot();
    const spyDurationMs = getSpyActionDurationMs();
    const mission = {
      id: `spy-mission:${Date.now()}`,
      sourceDistrictId: adjacentOwnedDistrictIds[0],
      targetDistrictId: selectedDistrict.id,
      ownerLabel: getDistrictOwnerLabel(selectedDistrict, interactionState),
      districtType: selectedDistrict.districtType,
      intelQualityPct: Number(pharmacySnapshot.effective.infoQualityPct || 0),
      createdAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + spyDurationMs).toISOString()
    };

    setStoredSpyState({
      available: clamp(MAX_SPIES - (activeMissionCount + 1), 0, MAX_SPIES),
      missions: [...latestSpyState.missions, mission]
    });
    recordDistrictIntelEvent({
      type: "spy_started",
      districtId: selectedDistrict.id,
      sourceDistrictId: mission.sourceDistrictId,
      intelLevel: "verified"
    });
    renderSpyResourceState(root);
    scheduleSpyMission(root, mission);
    render();
    ensureMissionAnimationLoop();

    if (buildingActionState) {
      buildingActionState.textContent = "Spy";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `Špeh byl vyslán z District ${mission.sourceDistrictId} do District ${mission.targetDistrictId}. Report dorazí za ${Math.ceil(spyDurationMs / 1000)} sekund.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `1 špeh na misi · návrat ${new Date(mission.returnAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    }

    showSpyToast(root);
    closeSpyConfirmPopup();
    closePopup();
    return true;
  };

  const openPopup = (district) => {
    if (!popup || !popupTitle || !popupType || !popupOwner || !district) {
      return;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(geometry, district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
    const spyState = getResolvedSpyState();
    const spyIntel = getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(district.id));
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const isOccupying = getStoredOccupyOrders()
      .some((order) => Number(String(order.targetDistrictId || "").replace("district:", "")) === Number(district.id));
    const isUnoccupied = getDistrictOwnerLabel(district, interactionState) === "Neobsazeno";
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const launchOwnerId = (interactionState.gamePhase || "launch") === "launch"
      ? interactionState.launchOwnerByDistrictId?.get(district.id)
      : null;
    const ownerAvatar = launchOwnerId ? getLaunchPlayerAvatar(launchOwnerId) : "";
    const ownerLabel = getDistrictOwnerLabel(district, interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(district.id);
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));
    const hasKnownDefense = hasKnownDistrictDefense(district);
    const activePoliceAction = getDistrictPoliceAction(district.id);
    const trapControlState = getDistrictTrapControlState(district);

    popupTitle.textContent = `District ${district.id}`;
    popupType.textContent = isDestroyed ? "Totálně zničený district" : atmosphereMeta.shortLabel;
    popupOwner.textContent = isDestroyed ? "Nikdo" : ownerLabel;
    if (popupOwnerMeta) {
      const ownerFactionId = launchOwnerId ? getLaunchPlayerFactionId(launchOwnerId) : null;
      const ownerFactionLabel = ownerFactionId && FACTION_CATALOG[ownerFactionId]
        ? FACTION_CATALOG[ownerFactionId].name
        : "Bez frakce";
      popupOwnerMeta.textContent = isDestroyed
        ? "Nikdo (zničený) · district je nepoužitelný"
        : launchOwnerId
        ? `${ownerFactionLabel} · ${launchOwnerId === CURRENT_PLAYER_ID ? "Tvůj profil" : `Hráč ${launchOwnerId}`}`
        : "Bez aktivního vlastníka";
    }
    if (popupOwnerAvatar instanceof HTMLImageElement) {
      popupOwnerAvatar.src = isDestroyed ? "" : ownerAvatar;
      popupOwnerAvatar.classList.toggle("is-empty", isDestroyed || !ownerAvatar);
    }
    if (popupOwnerAvatarFallback) {
      popupOwnerAvatarFallback.textContent = isDestroyed ? "×" : String(ownerLabel || "?").slice(0, 1).toUpperCase();
    }

    if (popupCard) {
      const hasOwnerAvatar = !isDestroyed && Boolean(ownerAvatar);
      const safeOwnerAvatarUrl = hasOwnerAvatar
        ? `url("${String(ownerAvatar).replace(/(["\\])/g, "\\$1")}")`
        : "none";
      popupCard.classList.toggle("district-owner-bg-active", hasOwnerAvatar);
      popupCard.style.setProperty("--district-owner-avatar-url", safeOwnerAvatarUrl);
      popupCard.style.setProperty("--district-owner-avatar-opacity", hasOwnerAvatar ? "0.24" : "0");
    }

    applyDistrictAtmosphere({
      card: popupCard,
      imageElement: popupAtmosphereImage,
      labelElement: popupAtmosphereLabel,
      moodElement: popupAtmosphereMood,
      atmosphereMeta
    });

    renderDistrictPopupFlags(isDestroyed
      ? [
          { label: "Totální destrukce", tone: "danger" },
          { label: "Nikdo", tone: "muted" },
          { label: "Nepoužitelný", tone: "danger" }
        ]
      : [
          {
            label: isOwnedByCurrentPlayer ? "Tvůj" : ownerLabel === "Neobsazeno" ? "Volný" : "Cizí",
            tone: isOwnedByCurrentPlayer ? "good" : ownerLabel === "Neobsazeno" ? "neutral" : "warning"
          },
          {
            label: adjacentOwnedDistrictIds.length > 0 ? `Napojený: ${adjacentOwnedDistrictIds.length}` : "Bez napojení",
            tone: adjacentOwnedDistrictIds.length > 0 ? "good" : "muted"
          },
          {
            label: hasKnownDefense ? "Obrana známá" : "Obrana skrytá",
            tone: hasKnownDefense ? "neutral" : "muted"
          },
          ...(activePoliceAction
            ? [{
                label: "Policejní akce",
                tone: "danger"
              }]
            : []),
          {
            label: isOccupying ? "Obsazování běží" : canOccupyAfterSpy ? "Připraveno k obsazení" : "Obsazení nepřipravené",
            tone: isOccupying ? "warning" : canOccupyAfterSpy ? "good" : "muted"
          },
          ...(currentTrapDistrictId === district.id
            ? [{ label: "Toxická past", tone: "danger" }]
            : [])
        ]);

    renderDistrictDefenseSummary(district);
    renderDistrictEconomySummary(district);
    renderDistrictPopupBuildings(district);
    renderDistrictPopupGossip(district);

    const resolvedActions = activePoliceAction
      ? []
      : resolveDistrictActions({
          districtId: district.id,
          isOwnedByCurrentPlayer: currentPlayerOwnedDistrictIds.has(district.id),
          isDestroyed: interactionState.destroyedDistrictIds.has(district.id),
          hasAdjacentOwnedDistrict: adjacentOwnedDistrictIds.length > 0,
          isUnoccupied,
          canOccupyAfterSpy,
          availableSpies: spyState.available,
          isOccupying,
          currentTrapDistrictId,
          trapMoveCooldownSeconds
        }).filter((action) => action.visible);

    const hasEnabledDistrictAction = resolvedActions.some((action) => action.enabled);

    if (districtActionSection) {
      districtActionSection.hidden = !activePoliceAction && !hasEnabledDistrictAction;
      districtActionSection.style.display = districtActionSection.hidden ? "none" : "";
    }
    if (districtActionSectionHead) {
      districtActionSectionHead.hidden = hasEnabledDistrictAction;
    }

    if (districtActionsMount) {
      districtActionsMount.replaceChildren();

      if (activePoliceAction) {
        const actionRow = document.createElement("div");
        actionRow.className = "district-popup-action-row";

        const reason = document.createElement("p");
        reason.className = "district-popup-action-reason";
        reason.textContent = "District je právě pod policejní akcí. Detail zásahu je otevřený v policejním okně.";
        actionRow.append(reason);
        districtActionsMount.append(actionRow);
      } else {
        for (const action of resolvedActions) {
          const actionRow = document.createElement("div");
          actionRow.className = "district-popup-action-row";

          const button = document.createElement("button");
          button.type = "button";
          button.className = "button district-popup-action";
          button.dataset.districtActionId = action.id;
          button.dataset.districtActionLabel = action.label;
          button.disabled = !action.enabled;

          if (action.id === "trap") {
            button.classList.add("district-popup-action--stacked");
            button.dataset.districtTrapState = trapControlState.isActiveHere
              ? "active"
              : trapControlState.moveLocked
                ? "cooldown"
                : trapControlState.hasTrapElsewhere
                  ? "move"
                  : "idle";

            const label = document.createElement("span");
            label.className = "district-popup-action__label";
            label.textContent = trapControlState.label || action.label;

            button.append(label);

            if (trapControlState.subtitle) {
              const subtitle = document.createElement("span");
              subtitle.className = "district-popup-action__sub";
              subtitle.textContent = trapControlState.subtitle;
              button.append(subtitle);
            }

            button.disabled = Boolean(trapControlState.buttonDisabled);
            if (trapControlState.title) {
              button.title = trapControlState.title;
            }
          } else {
            button.textContent = action.label;
            if (action.reason) {
              button.title = action.reason;
            }
          }

          actionRow.append(button);

          const actionReason = action.id === "trap"
            ? (trapControlState.title || action.reason)
            : action.reason;

          if (actionReason) {
            const reason = document.createElement("p");
            reason.className = "district-popup-action-reason";
            reason.textContent = normalizeDistrictActionReason(actionReason);
            actionRow.append(reason);
          }

          districtActionsMount.append(actionRow);
        }
      }
    }

    popup.hidden = false;
    applyDistrictPopupOverviewMode();
    syncMapInteractionVisualState({
      hoveredDistrict: geometry?.districts?.find((entry) => entry.id === interactionState.hoveredDistrictId) || null,
      focusedDistrict: district
    });

    if (popupRefreshTimerId !== null) {
      window.clearInterval(popupRefreshTimerId);
    }

    popupRefreshTimerId = window.setInterval(() => {
      const refreshedDistrict = getSelectedDistrict();

      if (!refreshedDistrict || popup?.hidden) {
        if (popupRefreshTimerId !== null) {
          window.clearInterval(popupRefreshTimerId);
          popupRefreshTimerId = null;
        }
        return;
      }

      openPopup(refreshedDistrict);

      if (trapConfirmPopup && !trapConfirmPopup.hidden) {
        populateTrapConfirmPopup(refreshedDistrict);
      }

      if (spyConfirmPopup && !spyConfirmPopup.hidden) {
        populateSpyConfirmPopup(refreshedDistrict);
      }

      if (occupyConfirmPopup && !occupyConfirmPopup.hidden) {
        populateOccupyConfirmPopup(refreshedDistrict);
      }

      if (attackConfirmPopup && !attackConfirmPopup.hidden) {
        populateAttackConfirmPopup(refreshedDistrict, pendingAttackContext);
      }

      if (robberyConfirmPopup && !robberyConfirmPopup.hidden) {
        populateRobberyConfirmPopup(refreshedDistrict);
      }
    }, 1000);
  };

  const updateTooltip = (event, district) => {
    if (!tooltip || !tooltipValue || !tooltipType || !district) {
      hideTooltip();
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const districtIdLabel = String(district.id);
    const launchOwnerId = interactionState.gamePhase === "launch"
      ? interactionState.launchOwnerByDistrictId.get(district.id)
      : null;
    const districtTypeLabel = getDistrictAtmosphereMeta(district, interactionState).shortLabel;
    const tooltipTypeLabel = launchOwnerId
      ? `${launchOwnerId === CURRENT_PLAYER_ID ? "TY" : getLaunchPlayerName(launchOwnerId)}`
      : districtTypeLabel;
    if (district.id !== lastTooltipDistrictId) {
      tooltipValue.textContent = districtIdLabel;
      tooltipType.textContent = tooltipTypeLabel;
      renderDistrictTooltipGossip(district);
      lastTooltipDistrictId = district.id;
    }
    tooltip.hidden = false;

    const tooltipWidth = tooltip.offsetWidth || 84;
    const tooltipHeight = tooltip.offsetHeight || 52;
    const pointerX = event.clientX - viewportRect.left;
    const pointerY = event.clientY - viewportRect.top;
    const offsetX = 12;
    const offsetY = 8;
    const preferredLeft = pointerX + offsetX;
    const fallbackLeft = pointerX - tooltipWidth - offsetX;
    const nextLeft = clamp(
      preferredLeft + tooltipWidth <= viewportRect.width - 8 ? preferredLeft : fallbackLeft,
      8,
      Math.max(8, viewportRect.width - tooltipWidth - 8)
    );
    const nextTop = clamp(
      pointerY - Math.round(tooltipHeight * 0.34) + offsetY,
      8,
      Math.max(8, viewportRect.height - tooltipHeight - 8)
    );

    tooltip.style.transform = `translate(${nextLeft}px, ${nextTop}px)`;
  };

  const toCanvasPoint = (event) => {
    const canvasRect = canvasHost.getBoundingClientRect();
    const normalizedX = ((event.clientX - canvasRect.left) / canvasRect.width) * canvas.width;
    const normalizedY = ((event.clientY - canvasRect.top) / canvasRect.height) * canvas.height;

    return {
      x: normalizedX,
      y: normalizedY
    };
  };

  const syncHoverOverlayPoint = (event) => {
    const canvasPoint = toCanvasPoint(event);
    setOverlayPoint(
      "map-hover",
      (canvasPoint.x / canvas.width) * 100,
      (canvasPoint.y / canvas.height) * 100
    );
  };

  const renderCanvasOnly = () => {
    geometry = renderDistrictCanvas(canvas, phaseHost.dataset.mapPhase || "day", interactionState, imageSet);
  };

  const beginDistrictSelectionGesture = (event) => {
    districtSelectionGesture.pointerId = event.pointerId;
    districtSelectionGesture.startX = event.clientX;
    districtSelectionGesture.startY = event.clientY;
    districtSelectionGesture.moved = false;
  };

  const trackDistrictSelectionGesture = (event) => {
    if (districtSelectionGesture.pointerId !== event.pointerId || districtSelectionGesture.moved) {
      return;
    }

    const deltaX = event.clientX - districtSelectionGesture.startX;
    const deltaY = event.clientY - districtSelectionGesture.startY;
    if ((deltaX * deltaX) + (deltaY * deltaY) >= DISTRICT_SELECTION_DRAG_THRESHOLD * DISTRICT_SELECTION_DRAG_THRESHOLD) {
      districtSelectionGesture.moved = true;
    }
  };

  const endDistrictSelectionGesture = (event) => {
    if (districtSelectionGesture.pointerId !== event.pointerId) {
      return;
    }

    if (districtSelectionGesture.moved) {
      districtSelectionGesture.suppressClickUntil = window.performance.now() + DISTRICT_SELECTION_SUPPRESS_MS;
    }

    districtSelectionGesture.pointerId = null;
    districtSelectionGesture.moved = false;
  };

  const render = () => {
    syncPhaseHostFromAuthority(phaseHost);
    interactionState.borderColor = phaseHost.dataset.borderColor || "white";
    interactionState.gamePhase = phaseHost.dataset.gamePhase || "launch";
    interactionState.animationTick = Date.now();
    const activeSpyMissions = getResolvedSpyState().missions;
    const mapVisibleSpyMissions = activeSpyMissions.filter(isSpyMissionActiveOnMap);
    interactionState.activeSpyDistrictIds = new Set(
      mapVisibleSpyMissions.map((mission) => Number(mission.targetDistrictId)).filter(Boolean)
    );
    interactionState.activeSpyMarkersByDistrictId = new Map(
      mapVisibleSpyMissions
        .map((mission) => {
          const districtId = Number(mission.targetDistrictId);
          if (!districtId) {
            return null;
          }

          return [
            districtId,
            {
              seed: districtId,
              startedAt: new Date(mission.createdAt || Date.now()).getTime(),
              expiresAt: getSpyMissionExpiryTimestamp(mission)
            }
          ];
        })
        .filter(Boolean)
    );
    const activePoliceActions = getResolvedDistrictPoliceActions();
    interactionState.activePoliceDistrictIds = new Set(
      Object.keys(activePoliceActions).map(Number).filter(Boolean)
    );
    interactionState.activePoliceMarkersByDistrictId = new Map(
      Object.entries(activePoliceActions)
        .map(([districtId, marker]) => [Number(districtId), marker])
        .filter(([districtId, marker]) => Boolean(districtId && marker))
    );
    const activeAttackOrders = getStoredAttackOrders();
    interactionState.activeAttackDistrictIds = new Set(
      activeAttackOrders.map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
    );
    interactionState.activeAttackMarkersByDistrictId = new Map(
      activeAttackOrders
        .map((order) => {
          const districtId = Number(String(order.targetDistrictId || "").replace("district:", ""));
          if (!districtId) {
            return null;
          }

          return [
            districtId,
            {
              seed: districtId,
              source: order.status || "attack",
              attackerDistrictId: Number(String(order.sourceDistrictId || "").replace("district:", "")) || null,
              startedAt: new Date(order.createdAt || Date.now()).getTime(),
              expiresAt: new Date(order.resolveAt || Date.now() + ATTACK_COOLDOWN_MS).getTime()
            }
          ];
        })
        .filter(Boolean)
    );
    interactionState.activeOccupyDistrictIds = new Set(
      getStoredOccupyOrders().map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
    );
    interactionState.activeOccupyCountdownByDistrictId = new Map(
      getStoredOccupyOrders().map((order) => ([
        Number(String(order.targetDistrictId || "").replace("district:", "")),
        Math.max(0, Math.ceil((new Date(order.resolveAt || order.createdAt).getTime() - Date.now()) / 1000))
      ]))
    );
    const activeRobberyOrders = getStoredRobberyOrders();
    interactionState.activeRobberyDistrictIds = new Set(
      activeRobberyOrders.map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
    );
    interactionState.activeRobberyMarkersByDistrictId = new Map(
      activeRobberyOrders
        .map((order) => {
          const districtId = Number(String(order.targetDistrictId || "").replace("district:", ""));
          if (!districtId) {
            return null;
          }

          return [
            districtId,
            {
              seed: districtId,
              startedAt: new Date(order.createdAt || Date.now()).getTime(),
              expiresAt: new Date(order.resolveAt || Date.now() + ROBBERY_COOLDOWN_MS).getTime()
            }
          ];
        })
        .filter(Boolean)
    );
    interactionState.activeTrapDistrictIds = new Set(
      Object.entries(getResolvedWorldState().districtTrapById || {})
        .filter(([, trap]) => trap?.isArmed)
        .map(([districtId]) => Number(districtId))
        .filter(Boolean)
    );
    renderCanvasOnly();
    syncMapInteractionVisualState({
      hoveredDistrict: geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null,
      focusedDistrict: hasActiveDistrictModal() ? getSelectedDistrict() : null
    });

    if (buildingsPopup && !buildingsPopup.hidden) {
      const nextType = getSourceDistrictsForBuildingType(activeBuildingsDistrictType).length > 0
        ? activeBuildingsDistrictType
        : getFirstAvailableBuildingDistrictType();
      renderBuildingsPopup(nextType);
    }
  };

  const ensureMissionAnimationLoop = () => {
    const hasActiveSpyMissions = interactionState.activeSpyDistrictIds.size > 0;
    const hasActivePoliceMissions = interactionState.activePoliceDistrictIds.size > 0;
    const hasActiveAttackMissions = interactionState.activeAttackDistrictIds.size > 0;
    const hasActiveOccupyMissions = interactionState.activeOccupyDistrictIds.size > 0;
    const hasActiveRobberyMissions = interactionState.activeRobberyDistrictIds.size > 0;
    const hasActiveTrapDistricts = interactionState.activeTrapDistrictIds.size > 0;
    const hasActiveMissions = hasActiveSpyMissions
      || hasActivePoliceMissions
      || hasActiveAttackMissions
      || hasActiveOccupyMissions
      || hasActiveRobberyMissions
      || hasActiveTrapDistricts;

    if (!hasActiveMissions) {
      if (spyAnimationFrameId !== null) {
        window.cancelAnimationFrame(spyAnimationFrameId);
        spyAnimationFrameId = null;
      }
      return;
    }

    if (spyAnimationFrameId !== null) {
      return;
    }

    const animate = () => {
      const mapVisibleSpyMissions = getResolvedSpyState().missions.filter(isSpyMissionActiveOnMap);
      interactionState.activeSpyDistrictIds = new Set(
        mapVisibleSpyMissions.map((mission) => Number(mission.targetDistrictId)).filter(Boolean)
      );
      interactionState.activeSpyMarkersByDistrictId = new Map(
        mapVisibleSpyMissions
          .map((mission) => {
            const districtId = Number(mission.targetDistrictId);
            if (!districtId) {
              return null;
            }

            return [
              districtId,
              {
                seed: districtId,
                startedAt: new Date(mission.createdAt || Date.now()).getTime(),
                expiresAt: getSpyMissionExpiryTimestamp(mission)
              }
            ];
          })
          .filter(Boolean)
      );
      const activePoliceActions = getResolvedDistrictPoliceActions();
      interactionState.activePoliceDistrictIds = new Set(
        Object.keys(activePoliceActions).map(Number).filter(Boolean)
      );
      interactionState.activePoliceMarkersByDistrictId = new Map(
        Object.entries(activePoliceActions)
          .map(([districtId, marker]) => [Number(districtId), marker])
          .filter(([districtId, marker]) => Boolean(districtId && marker))
      );
      interactionState.activeAttackDistrictIds = new Set(
        getStoredAttackOrders().map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
      );
      interactionState.activeAttackMarkersByDistrictId = new Map(
        getStoredAttackOrders()
          .map((order) => {
            const districtId = Number(String(order.targetDistrictId || "").replace("district:", ""));
            if (!districtId) {
              return null;
            }

            return [
              districtId,
              {
                seed: districtId,
                source: order.status || "attack",
                attackerDistrictId: Number(String(order.sourceDistrictId || "").replace("district:", "")) || null,
                startedAt: new Date(order.createdAt || Date.now()).getTime(),
                expiresAt: new Date(order.resolveAt || Date.now() + ATTACK_COOLDOWN_MS).getTime()
              }
            ];
          })
          .filter(Boolean)
      );
      interactionState.activeOccupyDistrictIds = new Set(
        getStoredOccupyOrders().map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
      );
      interactionState.activeOccupyCountdownByDistrictId = new Map(
        getStoredOccupyOrders().map((order) => ([
          Number(String(order.targetDistrictId || "").replace("district:", "")),
          Math.max(0, Math.ceil((new Date(order.resolveAt || order.createdAt).getTime() - Date.now()) / 1000))
        ]))
      );
      interactionState.activeRobberyDistrictIds = new Set(
        getStoredRobberyOrders().map((order) => Number(String(order.targetDistrictId || "").replace("district:", ""))).filter(Boolean)
      );
      interactionState.activeRobberyMarkersByDistrictId = new Map(
        getStoredRobberyOrders()
          .map((order) => {
            const districtId = Number(String(order.targetDistrictId || "").replace("district:", ""));
            if (!districtId) {
              return null;
            }

            return [
              districtId,
              {
                seed: districtId,
                startedAt: new Date(order.createdAt || Date.now()).getTime(),
                expiresAt: new Date(order.resolveAt || Date.now() + ROBBERY_COOLDOWN_MS).getTime()
              }
            ];
          })
          .filter(Boolean)
      );
      interactionState.activeTrapDistrictIds = new Set(
        Object.entries(getResolvedWorldState().districtTrapById || {})
          .filter(([, trap]) => trap?.isArmed)
          .map(([districtId]) => Number(districtId))
          .filter(Boolean)
      );

      if (
        interactionState.activeSpyDistrictIds.size === 0 &&
        interactionState.activePoliceDistrictIds.size === 0 &&
        interactionState.activeAttackDistrictIds.size === 0 &&
        interactionState.activeOccupyDistrictIds.size === 0 &&
        interactionState.activeRobberyDistrictIds.size === 0 &&
        interactionState.activeTrapDistrictIds.size === 0
      ) {
        spyAnimationFrameId = null;
        render();
        return;
      }

      render();
      spyAnimationFrameId = window.requestAnimationFrame(animate);
    };

    spyAnimationFrameId = window.requestAnimationFrame(animate);
  };

  const districtStateApi = {
    revealDistrictType(districtId) {
      interactionState.revealedDistrictIds.add(Number(districtId));
      render();
    },
    concealDistrictType(districtId) {
      interactionState.revealedDistrictIds.delete(Number(districtId));
      render();
    },
    captureDistrict(districtId) {
      const normalizedDistrictId = Number(districtId);
      interactionState.destroyedDistrictIds.delete(normalizedDistrictId);
      interactionState.launchOwnerByDistrictId.delete(normalizedDistrictId);
      interactionState.ownedDistrictIds.add(normalizedDistrictId);
      interactionState.revealedDistrictIds.add(normalizedDistrictId);
      render();
    },
    destroyDistrict(districtId) {
      const normalizedDistrictId = Number(districtId);
      interactionState.destroyedDistrictIds.add(normalizedDistrictId);
      interactionState.ownedDistrictIds.delete(normalizedDistrictId);
      interactionState.launchOwnerByDistrictId.delete(normalizedDistrictId);
      interactionState.revealedDistrictIds.add(normalizedDistrictId);
      render();
    },
    loseDistrict(districtId) {
      interactionState.ownedDistrictIds.delete(Number(districtId));
      render();
    },
    setOwnedDistricts(districtIds = []) {
      interactionState.ownedDistrictIds = new Set(districtIds.map((districtId) => Number(districtId)));

      for (const districtId of interactionState.ownedDistrictIds) {
        interactionState.revealedDistrictIds.add(districtId);
      }

      render();
    },
    getDistrictById(districtId) {
      const normalizedDistrictId = Number(districtId);
      return geometry?.districts?.find((district) => Number(district.id) === normalizedDistrictId) || null;
    },
    getState() {
      return {
        gamePhase: interactionState.gamePhase,
        revealedDistrictIds: Array.from(interactionState.revealedDistrictIds),
        ownedDistrictIds: Array.from(interactionState.ownedDistrictIds),
        destroyedDistrictIds: Array.from(interactionState.destroyedDistrictIds),
        launchOwners: Array.from(interactionState.launchOwnerByDistrictId.entries())
      };
    }
  };

  const normalizeDistrictActionReason = (reason) => {
    const normalizedReason = String(reason || "").trim();

    if (!normalizedReason) {
      return "";
    }

    const replacements = new Map([
      ["Requires an adjacent owned district.", "Chybí sousední tvůj district."],
      ["District must be unclaimed.", "District musí být volný."],
      ["District must be owned by current player.", "Musí to být tvůj district."],
      ["District is already occupied.", "District už je obsazený."],
      ["Spy action required before occupy.", "Nejdřív je potřeba spy."],
      ["No spies available.", "Nemáš volného spy."],
      ["Occupy action already in progress.", "Obsazování už běží."],
      ["Trap is already active here.", "Past už tu je aktivní."],
      ["Trap move is on cooldown.", "Přesun pasti je v cooldownu."],
      ["District is destroyed.", "District je zničený."]
    ]);

    return replacements.get(normalizedReason) || normalizedReason;
  };

  window.empireStreetsDistrictState = districtStateApi;

  phaseHost.addEventListener("mapphasechange", render);
  phaseHost.addEventListener("mapborderchange", render);
  document.addEventListener("empire:settings-changed", (event) => {
    const settings = event.detail?.settings || getSettingsState();
    interactionState.showDistrictBorders = Boolean(settings.mapDistrictBorders);
    interactionState.showAllianceSymbols = Boolean(settings.mapAllianceSymbols);
    interactionState.mapVisibilityMode = normalizeMapVisibilityMode(settings.mapVisibilityMode);
    render();
  });
  phaseHost.addEventListener("gamephasechange", render);
  window.addEventListener("empire:alliance-state-changed", render);
  window.addEventListener("empire:bounty-state-changed", render);
  document.addEventListener("empire:world-state-changed", () => {
    syncInteractionDistrictAuthorityState();
    render();
    ensureMissionAnimationLoop();
  });
  document.addEventListener("empire:police-state-changed", () => {
    render();
    ensureMissionAnimationLoop();
  });
  document.addEventListener("empire:police-state-changed", (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    const marker = detail?.marker && typeof detail.marker === "object" ? detail.marker : null;
    if (!marker) {
      return;
    }

    const district = geometry?.districts?.find((entry) => Number(entry.id) === Number(marker.districtId)) || null;
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    if (!currentPlayerOwnedDistrictIds.has(Number(marker.districtId))) {
      return;
    }

    openPoliceActionResultModal(root, createOwnedDistrictPoliceRaidAlertPayload(district, marker));
  });
  let hoverPointerFrameId = null;
  let pendingHoverEvent = null;

  const flushHoverPointerMove = () => {
    hoverPointerFrameId = null;

    if (!pendingHoverEvent || !geometry) {
      pendingHoverEvent = null;
      return;
    }

    const event = pendingHoverEvent;
    pendingHoverEvent = null;
    const district = getDistrictAtPoint(geometry, toCanvasPoint(event));
    const nextHoveredId = district ? district.id : null;

    if (nextHoveredId !== interactionState.hoveredDistrictId) {
      interactionState.hoveredDistrictId = nextHoveredId;
      viewport.style.cursor = district ? "pointer" : "";
      renderCanvasOnly();
    }

    if (district) {
      syncHoverOverlayPoint(event);
    }
    syncMapInteractionVisualState({
      hoveredDistrict: district,
      focusedDistrict: hasActiveDistrictModal() ? getSelectedDistrict() : null
    });
    updateTooltip(event, district);
  };

  viewport.addEventListener("pointermove", (event) => {
    if (!geometry) {
      return;
    }

    trackDistrictSelectionGesture(event);
    pendingHoverEvent = event;
    if (hoverPointerFrameId === null) {
      hoverPointerFrameId = window.requestAnimationFrame(flushHoverPointerMove);
    }
  });

  viewport.addEventListener("pointerleave", () => {
    if (hoverPointerFrameId !== null) {
      window.cancelAnimationFrame(hoverPointerFrameId);
      hoverPointerFrameId = null;
    }
    pendingHoverEvent = null;

    if (interactionState.hoveredDistrictId !== null) {
      interactionState.hoveredDistrictId = null;
      viewport.style.cursor = "";
      renderCanvasOnly();
    }

    syncMapInteractionVisualState({
      hoveredDistrict: null,
      focusedDistrict: hasActiveDistrictModal() ? getSelectedDistrict() : null,
      suppressHover: true
    });
    hideTooltip();
  });

  viewport.addEventListener("pointerdown", beginDistrictSelectionGesture);
  viewport.addEventListener("pointerup", endDistrictSelectionGesture);
  viewport.addEventListener("pointercancel", endDistrictSelectionGesture);
  viewport.addEventListener("pointerleave", (event) => {
    endDistrictSelectionGesture(event);
  });

  viewport.addEventListener("click", (event) => {
    if (!geometry) {
      return;
    }

    if (window.performance.now() < districtSelectionGesture.suppressClickUntil) {
      districtSelectionGesture.suppressClickUntil = 0;
      return;
    }

    const district = getDistrictAtPoint(geometry, toCanvasPoint(event));
    interactionState.selectedDistrictId = district ? district.id : null;
    render();

    if (district) {
      openPopup(district);
      const activeAttackMarker = interactionState.activeAttackMarkersByDistrictId.get(district.id);
      if (activeAttackMarker) {
        queueOrOpenResultModal(root, "police", createDistrictAttackInProgressPayload(district, activeAttackMarker));
      }
      const activePoliceAction = getDistrictPoliceAction(district.id);
      if (activePoliceAction) {
        queueOrOpenResultModal(root, "police", createDistrictPoliceRaidWarningPayload(district, activePoliceAction));
      }
    } else {
      closePopup();
    }
  });

  for (const closeElement of popupCloseElements) {
    closeElement.addEventListener("click", closePopup);
  }

  if (popupBuildingsList) {
    popupBuildingsList.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const chipButton = target.closest("[data-district-building-name]");
      if (!(chipButton instanceof HTMLButtonElement)) {
        return;
      }

      const selectedDistrict = getSelectedDistrict();
      if (!selectedDistrict) {
        return;
      }

      openDistrictBuildingDetail(selectedDistrict, chipButton.dataset.districtBuildingName || "", {
        preferGenericDetail: true
      });
    });
  }

  if (buildingsPopupOpenButton instanceof HTMLButtonElement) {
    buildingsPopupOpenButton.addEventListener("click", openBuildingsPopup);
  }

  for (const closeElement of buildingsPopupCloseElements) {
    closeElement.addEventListener("click", closeBuildingsPopup);
  }

  if (buildingsPopupTypeMount) {
    buildingsPopupTypeMount.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const typeButton = target.closest("[data-buildings-district-type]");
      if (!(typeButton instanceof HTMLElement)) {
        return;
      }

      const districtType = String(typeButton.dataset.buildingsDistrictType || "").trim();
      if (!districtType) {
        return;
      }

      renderBuildingsPopup(districtType);
    });
  }

  if (buildingsPopupDetailMount) {
    buildingsPopupDetailMount.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const baseButton = target.closest("[data-buildings-select-base-name]");
      if (baseButton instanceof HTMLButtonElement) {
        const selectedBaseName = String(baseButton.dataset.buildingsSelectBaseName || "").trim();
        const selectedType = String(baseButton.dataset.buildingsSelectBaseType || activeBuildingsDistrictType || "").trim();

        if (!selectedBaseName || !selectedType) {
          return;
        }

        selectedBuildingBaseNameByType.set(selectedType, selectedBaseName);
        renderBuildingsPopupDetail(selectedType);
        return;
      }

      const buildingButton = target.closest("[data-buildings-open-building-name]");
      if (buildingButton instanceof HTMLButtonElement) {
        const districtId = Number(buildingButton.dataset.buildingsOpenBuildingDistrictId || 0);
        const district = districtId && geometry?.districts?.length
          ? geometry.districts.find((entry) => Number(entry.id) === districtId) || null
          : null;

        if (!district) {
          return;
        }

        openDistrictBuildingDetail(district, buildingButton.dataset.buildingsOpenBuildingName || "", {
          closeBuildingsPopup: true,
          displayName: buildingButton.dataset.buildingsOpenBuildingDisplayName || "",
          preferGenericDetail: true
        });
        return;
      }

      const openButton = target.closest("[data-buildings-open-district-id]");
      if (!(openButton instanceof HTMLButtonElement)) {
        return;
      }

      const districtId = Number(openButton.dataset.buildingsOpenDistrictId || 0);
      if (!districtId || !geometry?.districts?.length) {
        return;
      }

      const district = geometry.districts.find((entry) => Number(entry.id) === districtId) || null;
      if (!district) {
        return;
      }

      interactionState.selectedDistrictId = district.id;
      render();
      closeBuildingsPopup();
      openPopup(district);
    });
  }

  if (districtActionsMount) {
    districtActionsMount.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionButton = target.closest("[data-district-action-id]");

      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      const actionId = actionButton.dataset.districtActionId;
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      const isOccupying = getStoredOccupyOrders()
        .some((order) => Number(String(order.targetDistrictId || "").replace("district:", "")) === Number(selectedDistrict.id));

      if (isOccupying) {
        if (buildingActionState) {
          buildingActionState.textContent = "Obsazení";
          buildingActionState.classList.remove("building-action-status__state--idle");
        }

        if (buildingActionSummary) {
          buildingActionSummary.textContent = `District ${selectedDistrict.id} se právě obsazuje. Během cooldownu nejdou spustit další akce.`;
        }

        if (buildingActionMeta) {
          buildingActionMeta.textContent = `District ${selectedDistrict.id} · probíhá obsazení`;
        }
        return;
      }

      if (actionId === "defense") {
        populateDefenseSetupPopup(selectedDistrict);

        if (defenseSetupPopup) {
          defenseSetupPopup.hidden = false;
        }
        return;
      }

      if (actionId === "trap") {
        const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
        const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();

        if (currentTrapDistrictId === selectedDistrict.id) {
          return;
        }

        if (currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id && trapMoveCooldownSeconds > 0) {
          if (buildingActionState) {
            buildingActionState.textContent = "Past";
            buildingActionState.classList.remove("building-action-status__state--idle");
          }

          if (buildingActionSummary) {
            buildingActionSummary.textContent = `Past lze přesunout až za ${trapMoveCooldownSeconds} sekund.`;
          }

          if (buildingActionMeta) {
            buildingActionMeta.textContent = `Aktivní past v District ${currentTrapDistrictId} · cooldown běží`;
          }

          openPopup(selectedDistrict);
          return;
        }

        populateTrapConfirmPopup(selectedDistrict);

        if (trapConfirmPopup) {
          trapConfirmPopup.hidden = false;
        }
        return;
      }

      if (actionId === "occupy") {
        populateOccupyConfirmPopup(selectedDistrict);

        if (occupyConfirmPopup) {
          occupyConfirmPopup.hidden = false;
        }
        return;
      }

      if (actionId === "attack") {
        populateAttackSetupPopup(selectedDistrict);
        attackSetupPopup.hidden = false;
        return;
      }

      if (actionId === "spy") {
        populateSpyConfirmPopup(selectedDistrict);

        if (spyConfirmPopup) {
          spyConfirmPopup.hidden = false;
        }
        return;
      }

      if (actionId === "rob") {
        const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
        const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(geometry, selectedDistrict.id)
          .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
        const isUnoccupied = getDistrictOwnerLabel(selectedDistrict, interactionState) === "Neobsazeno";

        if (adjacentOwnedDistrictIds.length === 0 || !isUnoccupied) {
          return;
        }
        populateRobberySetupPopup(selectedDistrict);
        if (robberySetupPopup) {
          robberySetupPopup.hidden = false;
        }
        return;
      }
    });
  }

  if (popupToggle instanceof HTMLButtonElement) {
    popupToggle.addEventListener("click", () => {
      isDistrictPopupOverviewEnabled = !isDistrictPopupOverviewEnabled;
      applyDistrictPopupOverviewMode();
    });
  }

  if (attackSourceSelect) {
    attackSourceSelect.addEventListener("change", () => {
      renderAttackSummary();
    });
  }

  const adjustStepperInput = (input, delta, maxResolver = null) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const resolvedMax = typeof maxResolver === "function"
      ? Math.max(0, Math.floor(Number(maxResolver() || 0)))
      : Math.max(0, Math.floor(Number(input.max || 0)));
    const nextValue = clamp((Number.parseInt(input.value || "0", 10) || 0) + delta, 0, resolvedMax);
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  for (const input of attackWeaponInputs) {
    input.addEventListener("input", () => {
      const weaponId = input.dataset.attackWeaponInput;
      const ownedInventory = getResolvedWeaponInventory();
      const maxInventory = weaponId ? ownedInventory[weaponId] ?? 0 : 0;
      const normalizedValue = clamp(Number.parseInt(input.value || "0", 10) || 0, 0, maxInventory);
      input.value = String(normalizedValue);
      renderAttackSummary();
    });
  }

  for (const button of Array.from(root.querySelectorAll('[data-stepper-action][data-stepper-target]'))) {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-stepper-action");
      const target = button.getAttribute("data-stepper-target");
      const delta = action === "decrement" ? -1 : 1;

      if (target === "defense-residents" && defenseResidentsInput instanceof HTMLInputElement) {
        adjustStepperInput(defenseResidentsInput, delta, () => Number.MAX_SAFE_INTEGER);
        return;
      }

      if (target === "robbery-members" && robberyMemberInput instanceof HTMLInputElement) {
        adjustStepperInput(robberyMemberInput, delta, getAvailableAttackPopulation);
        return;
      }

      const attackInput = attackWeaponInputs.find((input) => input.dataset.attackWeaponInput === target);
      if (attackInput) {
        adjustStepperInput(attackInput, delta, () => {
          const weaponId = attackInput.dataset.attackWeaponInput;
          const ownedInventory = getResolvedWeaponInventory();
          return weaponId ? (ownedInventory[weaponId] ?? 0) : 0;
        });
        return;
      }

      const defenseInput = defenseWeaponInputs.find((input) => input.dataset.defenseWeaponInput === target);
      if (defenseInput) {
        adjustStepperInput(defenseInput, delta, () => {
          const selectedDistrict = getSelectedDistrict();
          if (!selectedDistrict) {
            return Number(defenseInput.max || 0);
          }
          const currentDefense = getDistrictDefenseState(selectedDistrict.id);
          const ownedInventory = getResolvedWeaponInventory();
          const weaponId = defenseInput.dataset.defenseWeaponInput;
          return weaponId ? ((ownedInventory[weaponId] ?? 0) + (currentDefense.loadout[weaponId] ?? 0)) : 0;
        });
      }
    });
  }

  for (const closeElement of attackSetupCloseElements) {
    closeElement.addEventListener("click", closeAttackSetupPopup);
  }

  for (const closeElement of attackConfirmCloseElements) {
    closeElement.addEventListener("click", closeAttackConfirmPopup);
  }

  if (robberySourceSelect instanceof HTMLSelectElement) {
    robberySourceSelect.addEventListener("change", () => {
      renderRobberySummary();
    });
  }

  if (robberyMemberInput instanceof HTMLInputElement) {
    robberyMemberInput.addEventListener("input", () => {
      renderRobberySummary();
    });
  }

  for (const closeElement of robberySetupCloseElements) {
    closeElement.addEventListener("click", closeRobberySetupPopup);
  }

  for (const closeElement of robberyConfirmCloseElements) {
    closeElement.addEventListener("click", closeRobberyConfirmPopup);
  }

  if (defenseResidentsInput instanceof HTMLInputElement) {
    defenseResidentsInput.addEventListener("input", () => {
      defenseResidentsInput.value = String(Math.max(0, Number.parseInt(defenseResidentsInput.value || "0", 10) || 0));
      persistDefenseSetup(getSelectedDistrict());
    });
  }

  for (const input of defenseWeaponInputs) {
    input.addEventListener("input", () => {
      persistDefenseSetup(getSelectedDistrict());
    });
  }

  for (const closeElement of defenseSetupCloseElements) {
    closeElement.addEventListener("click", closeDefenseSetupPopup);
  }

  for (const closeElement of trapConfirmCloseElements) {
    closeElement.addEventListener("click", closeTrapConfirmPopup);
  }

  for (const closeElement of spyConfirmCloseElements) {
    closeElement.addEventListener("click", closeSpyConfirmPopup);
  }

  for (const closeElement of occupyConfirmCloseElements) {
    closeElement.addEventListener("click", closeOccupyConfirmPopup);
  }

  spyResultModalBackdrop?.addEventListener("click", () => closeResultModal(root, SPY_RESULT_MODAL_SELECTOR));
  spyResultModalClose?.addEventListener("click", () => closeResultModal(root, SPY_RESULT_MODAL_SELECTOR));
  spyResultModalOk?.addEventListener("click", () => closeResultModal(root, SPY_RESULT_MODAL_SELECTOR));

  spyWarningModalBackdrop?.addEventListener("click", () => closeResultModal(root, SPY_WARNING_MODAL_SELECTOR));
  spyWarningModalClose?.addEventListener("click", () => closeResultModal(root, SPY_WARNING_MODAL_SELECTOR));
  spyWarningModalOk?.addEventListener("click", () => closeResultModal(root, SPY_WARNING_MODAL_SELECTOR));

  raidResultModalBackdrop?.addEventListener("click", () => closeResultModal(root, RAID_RESULT_MODAL_SELECTOR));
  raidResultModalClose?.addEventListener("click", () => closeResultModal(root, RAID_RESULT_MODAL_SELECTOR));
  raidResultModalOk?.addEventListener("click", () => closeResultModal(root, RAID_RESULT_MODAL_SELECTOR));

  attackResultModalBackdrop?.addEventListener("click", () => closeResultModal(root, ATTACK_RESULT_MODAL_SELECTOR));
  attackResultModalClose?.addEventListener("click", () => closeResultModal(root, ATTACK_RESULT_MODAL_SELECTOR));
  attackResultModalOk?.addEventListener("click", () => closeResultModal(root, ATTACK_RESULT_MODAL_SELECTOR));

  policeActionResultModalBackdrop?.addEventListener("click", () => closePoliceActionResultModal(root));
  policeActionResultModalClose?.addEventListener("click", () => closePoliceActionResultModal(root));
  policeActionResultModalOk?.addEventListener("click", () => closePoliceActionResultModal(root));

  if (attackConfirmButton) {
    attackConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();
      const preparedContext = getPreparedAttackContext(selectedDistrict);

      if (!selectedDistrict || !preparedContext?.canConfirm) {
        return;
      }

      pendingAttackContext = preparedContext;
      populateAttackConfirmPopup(selectedDistrict, preparedContext);

      if (attackConfirmPopup) {
        attackConfirmPopup.hidden = false;
      }
    });
  }

  if (attackConfirmFinalButton instanceof HTMLButtonElement) {
    attackConfirmFinalButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      applyAttackAction(selectedDistrict);
    });
  }

  if (robberyConfirmButton instanceof HTMLButtonElement) {
    robberyConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      const { canConfirm } = renderRobberySummary();

      if (!canConfirm) {
        return;
      }

      populateRobberyConfirmPopup(selectedDistrict);

      if (robberyConfirmPopup) {
        robberyConfirmPopup.hidden = false;
      }
    });
  }

  if (robberyConfirmFinalButton instanceof HTMLButtonElement) {
    robberyConfirmFinalButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      applyRobberyAction(selectedDistrict);
    });
  }

  if (defenseConfirmButton instanceof HTMLButtonElement) {
    defenseConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();
      persistDefenseSetup(selectedDistrict);
      closeDefenseSetupPopup();
      openPopup(selectedDistrict);
    });
  }

  if (trapConfirmButton instanceof HTMLButtonElement) {
    trapConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      applyTrapAction(selectedDistrict);
    });
  }

  if (spyConfirmButton instanceof HTMLButtonElement) {
    spyConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      applySpyAction(selectedDistrict);
    });
  }

  if (occupyConfirmButton instanceof HTMLButtonElement) {
    occupyConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      applyOccupyAction(selectedDistrict);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && popup && !popup.hidden) {
      closePopup();
    }

    if (event.key === "Escape" && buildingsPopup && !buildingsPopup.hidden) {
      closeBuildingsPopup();
    }

    if (event.key === "Escape" && attackSetupPopup && !attackSetupPopup.hidden) {
      closeAttackSetupPopup();
    }

    if (event.key === "Escape" && attackConfirmPopup && !attackConfirmPopup.hidden) {
      closeAttackConfirmPopup();
    }

    if (event.key === "Escape" && robberySetupPopup && !robberySetupPopup.hidden) {
      closeRobberySetupPopup();
    }

    if (event.key === "Escape" && robberyConfirmPopup && !robberyConfirmPopup.hidden) {
      closeRobberyConfirmPopup();
    }

    if (event.key === "Escape" && defenseSetupPopup && !defenseSetupPopup.hidden) {
      closeDefenseSetupPopup();
    }

    if (event.key === "Escape" && trapConfirmPopup && !trapConfirmPopup.hidden) {
      closeTrapConfirmPopup();
    }

    if (event.key === "Escape" && spyConfirmPopup && !spyConfirmPopup.hidden) {
      closeSpyConfirmPopup();
    }

    if (event.key === "Escape" && occupyConfirmPopup && !occupyConfirmPopup.hidden) {
      closeOccupyConfirmPopup();
    }

    if (event.key === "Escape" && spyResultModal && !spyResultModal.classList.contains("hidden")) {
      closeResultModal(root, SPY_RESULT_MODAL_SELECTOR);
    }

    if (event.key === "Escape" && spyWarningModal && !spyWarningModal.classList.contains("hidden")) {
      closeResultModal(root, SPY_WARNING_MODAL_SELECTOR);
    }

    if (event.key === "Escape" && raidResultModal && !raidResultModal.classList.contains("hidden")) {
      closeResultModal(root, RAID_RESULT_MODAL_SELECTOR);
    }

    if (event.key === "Escape" && attackResultModal && !attackResultModal.classList.contains("hidden")) {
      closeResultModal(root, ATTACK_RESULT_MODAL_SELECTOR);
    }

    if (event.key === "Escape" && policeActionResultModal && !policeActionResultModal.classList.contains("hidden")) {
      closePoliceActionResultModal(root);
    }
  });

  Promise.all([
    loadImage(DAY_MAP_IMAGE_PATH),
    loadImage(NIGHT_MAP_IMAGE_PATH)
  ])
    .then(([day, night]) => {
      imageSet = { day, night };
      render();
      ensureMissionAnimationLoop();
    })
    .catch(() => {
      render();
      ensureMissionAnimationLoop();
    });

  window.addEventListener("beforeunload", () => {
    if (spyAnimationFrameId !== null) {
      window.cancelAnimationFrame(spyAnimationFrameId);
    }
  }, { once: true });
}

function bindMapPhaseToggle(root) {
  const mapPhaseHost = root.querySelector(MAP_PHASE_SELECTOR);
  const toggleButton = root.querySelector(PHASE_TOGGLE_SELECTOR);

  if (!mapPhaseHost || !toggleButton) {
    return;
  }

  const phaseState = syncPhaseHostFromAuthority(mapPhaseHost);
  toggleButton.textContent = phaseState.mapPhase === "day" ? "Fáze: DEN" : "Fáze: NOC";
  toggleButton.disabled = true;
  toggleButton.title = "Fáze se nyní řídí autoritativním backend stavem.";
}

function bindBorderColorToggle(root) {
  const mapPhaseHost = root.querySelector(MAP_PHASE_SELECTOR);
  const toggleButton = root.querySelector(BORDER_TOGGLE_SELECTOR);

  if (!mapPhaseHost || !toggleButton) {
    return;
  }

  const setBorderColor = (borderColor) => {
    mapPhaseHost.dataset.borderColor = borderColor;
    toggleButton.textContent = borderColor === "black" ? "Hrany: ČERNÁ" : "Hrany: BÍLÁ";
  };

  setBorderColor(mapPhaseHost.dataset.borderColor || "white");

  toggleButton.addEventListener("click", () => {
    const nextBorderColor = mapPhaseHost.dataset.borderColor === "black" ? "white" : "black";
    setBorderColor(nextBorderColor);
    mapPhaseHost.dispatchEvent(new CustomEvent("mapborderchange", { detail: { borderColor: nextBorderColor } }));
  });
}

function bindGamePhaseToggle(root) {
  const mapPhaseHost = root.querySelector(MAP_PHASE_SELECTOR);
  const toggleButton = root.querySelector(GAME_PHASE_TOGGLE_SELECTOR);

  if (!mapPhaseHost || !toggleButton) {
    return;
  }

  const setGamePhase = (gamePhase) => {
    const worldState = getResolvedWorldState();
    setStoredWorldState({
      ...worldState,
      phaseState: {
        ...(worldState.phaseState || {}),
        mapPhase: worldState.phaseState?.mapPhase === "day" ? "day" : "night",
        gamePhase: gamePhase === "launch" ? "launch" : "live",
        cityMinutes: worldState.phaseState?.cityMinutes ?? (22 * 60 + 14)
      }
    });
    syncDevOnlyDestroyedDistrictState();

    const phaseState = syncPhaseHostFromAuthority(mapPhaseHost);
    toggleButton.textContent = phaseState.gamePhase === "launch" ? "Fáze hry: DEV-ONLY" : "Fáze hry: LIVE";
  };

  const initialPhaseState = syncPhaseHostFromAuthority(mapPhaseHost);
  toggleButton.textContent = initialPhaseState.gamePhase === "launch" ? "Fáze hry: DEV-ONLY" : "Fáze hry: LIVE";
  toggleButton.disabled = false;
  toggleButton.title = "Přepnout fázi hry";

  toggleButton.addEventListener("click", () => {
    const currentPhaseState = getResolvedPhaseState();
    const nextGamePhase = currentPhaseState.gamePhase === "launch" ? "live" : "launch";
    setGamePhase(nextGamePhase);
  });
}

function bindMapNavigation(root) {
  const viewport = root.querySelector(MAP_VIEWPORT_SELECTOR);
  const canvasHost = root.querySelector(MAP_CANVAS_SELECTOR);
  const zoomButtons = Array.from(root.querySelectorAll(MAP_ZOOM_BUTTON_SELECTOR));

  if (!viewport || !canvasHost) {
    return;
  }

  const MIN_SCALE = 1;
  const MAX_SCALE = 3;
  const ZOOM_STEP = 0.18;
  const state = {
    scale: 1,
    x: 0,
    y: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };

  const clampOffset = () => {
    const maxX = ((state.scale - 1) * viewport.clientWidth) / 2;
    const maxY = ((state.scale - 1) * viewport.clientHeight) / 2;
    state.x = Math.min(Math.max(state.x, -maxX), maxX);
    state.y = Math.min(Math.max(state.y, -maxY), maxY);
  };

  const render = () => {
    clampOffset();
    canvasHost.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  };

  const setScale = (nextScale) => {
    state.scale = Math.min(Math.max(nextScale, MIN_SCALE), MAX_SCALE);

    if (state.scale === MIN_SCALE) {
      state.x = 0;
      state.y = 0;
    }

    render();
  };

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setScale(state.scale + direction * ZOOM_STEP);
  });

  for (const button of zoomButtons) {
    button.addEventListener("click", () => {
      const direction = button.dataset.mapZoom === "in" ? 1 : -1;
      setScale(state.scale + direction * ZOOM_STEP);
    });
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (state.scale <= 1) {
      return;
    }

    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });

  let dragPointerFrameId = null;
  let pendingDragEvent = null;

  const flushDragPointerMove = () => {
    dragPointerFrameId = null;
    const event = pendingDragEvent;
    pendingDragEvent = null;

    if (!event || state.pointerId !== event.pointerId) {
      return;
    }

    state.x = state.originX + (event.clientX - state.startX);
    state.y = state.originY + (event.clientY - state.startY);
    render();
  };

  viewport.addEventListener("pointermove", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    pendingDragEvent = event;
    if (dragPointerFrameId === null) {
      dragPointerFrameId = window.requestAnimationFrame(flushDragPointerMove);
    }
  });

  const releasePointer = (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    if (dragPointerFrameId !== null) {
      window.cancelAnimationFrame(dragPointerFrameId);
      dragPointerFrameId = null;
    }
    pendingDragEvent = null;
    state.pointerId = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", releasePointer);
  viewport.addEventListener("pointerleave", (event) => {
    if (state.pointerId === event.pointerId) {
      releasePointer(event);
    }
  });

  render();
}

function bindBuildingActionStatus(root) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  renderBuildingActionFeed(root, { syncPreview: true });

  if (panel.observer) {
    panel.observer.disconnect();
  }

  panel.clearButton.addEventListener("click", () => {
    panel.entries = [];
    panel.lastFingerprint = "";
    panel.skipFingerprint = "";
    renderBuildingActionFeed(root, { syncPreview: true, previewSnapshot: BUILDING_ACTION_EMPTY_SNAPSHOT });
  });

  panel.feedElement.addEventListener("click", (event) => {
    const removeButton = event.target instanceof Element
      ? event.target.closest(BUILDING_ACTION_REMOVE_SELECTOR)
      : null;

    if (!(removeButton instanceof HTMLButtonElement)) {
      return;
    }

    const messageId = String(removeButton.dataset.buildingActionRemove || "").trim();
    if (!messageId) {
      return;
    }

    panel.entries = panel.entries.filter((entry) => entry.id !== messageId);
    panel.lastFingerprint = panel.entries[0]
      ? createBuildingActionFingerprint(panel.entries[0])
      : "";
    panel.skipFingerprint = "";
    renderBuildingActionFeed(root, {
      syncPreview: true,
      previewSnapshot: panel.entries[0] || BUILDING_ACTION_EMPTY_SNAPSHOT
    });
  });

  panel.feedElement.addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const removeButton = event.target.closest(BUILDING_ACTION_REMOVE_SELECTOR);
    if (removeButton instanceof HTMLButtonElement) {
      return;
    }

    const actionItem = event.target.closest(".building-action-status__item");

    if (!(actionItem instanceof HTMLElement)) {
      return;
    }

    const messageId = String(actionItem.dataset.buildingActionId || "").trim();
    const entry = messageId
      ? panel.entries.find((candidate) => candidate.id === messageId)
      : null;

    if (!entry?.resultKind || !entry.resultPayload) {
      return;
    }

    event.preventDefault();
    queueOrOpenResultModal(root, entry.resultKind, entry.resultPayload);
  });

  const openCurrentResultFromSummary = () => openCurrentBuildingActionResultModal(root);

  panel.summaryElement.addEventListener("click", openCurrentResultFromSummary);
  panel.metaElement.addEventListener("click", openCurrentResultFromSummary);
  panel.summaryElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCurrentResultFromSummary();
    }
  });
  panel.metaElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCurrentResultFromSummary();
    }
  });

  panel.observer = new MutationObserver(() => {
    scheduleBuildingActionMutationCapture(root);
  });

  for (const element of [panel.stateElement, panel.summaryElement, panel.metaElement]) {
    panel.observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
}

function bindSettingsModal(root) {
  const scope = root.ownerDocument || document;
  const openButtons = Array.from(scope.querySelectorAll(NAV_SETTINGS_SELECTOR));
  const modal = scope.querySelector(SETTINGS_MODAL_SELECTOR);
  const backdrop = scope.querySelector(SETTINGS_MODAL_BACKDROP_SELECTOR);
  const closeButton = scope.querySelector(SETTINGS_MODAL_CLOSE_SELECTOR);
  const saveButton = scope.querySelector(SETTINGS_SAVE_SELECTOR);
  const mapBordersInput = scope.querySelector(SETTINGS_MAP_BORDERS_SELECTOR);
  const mapAllianceSymbolsInput = scope.querySelector(SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR);
  const mapVisibilitySelect = scope.querySelector(SETTINGS_MAP_VISIBILITY_SELECTOR);
  const languageSelect = scope.querySelector(SETTINGS_LANGUAGE_SELECTOR);

  if (
    openButtons.length === 0
    || !(modal instanceof HTMLElement)
    || !(saveButton instanceof HTMLButtonElement)
    || !(mapBordersInput instanceof HTMLInputElement)
    || !(mapAllianceSymbolsInput instanceof HTMLInputElement)
    || !(mapVisibilitySelect instanceof HTMLSelectElement)
    || !(languageSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  let settingsSnapshot = null;
  const mobileMedia = window.matchMedia("(max-width: 720px)");

  const syncMobileSettingsBackdropState = (open) => {
    scope.body?.classList.toggle("mobile-settings-modal-open", Boolean(open) && mobileMedia.matches);
  };

  const applySettingsToForm = (settings) => {
    mapBordersInput.checked = Boolean(settings.mapDistrictBorders);
    mapAllianceSymbolsInput.checked = Boolean(settings.mapAllianceSymbols);
    mapVisibilitySelect.value = normalizeMapVisibilityMode(settings.mapVisibilityMode);
    languageSelect.value = settings.language === "en" ? "en" : "cs";
  };

  const captureFormSettings = () => ({
    mapDistrictBorders: Boolean(mapBordersInput.checked),
    mapAllianceSymbols: Boolean(mapAllianceSymbolsInput.checked),
    mapVisibilityMode: normalizeMapVisibilityMode(mapVisibilitySelect.value),
    language: languageSelect.value === "en" ? "en" : "cs"
  });

  const previewSettings = () => {
    applySettingsState(captureFormSettings());
  };

  const closeModal = ({ revert = false } = {}) => {
    if (revert && settingsSnapshot) {
      applySettingsState(settingsSnapshot);
    }
    settingsSnapshot = null;
    modal.classList.add("hidden");
    syncMobileSettingsBackdropState(false);
  };

  const openModal = () => {
    settingsSnapshot = getSettingsState();
    applySettingsToForm(settingsSnapshot);
    modal.classList.remove("hidden");
    syncMobileSettingsBackdropState(true);
  };

  const saveSettings = () => {
    applySettingsState(captureFormSettings());
    settingsSnapshot = null;
    modal.classList.add("hidden");
    syncMobileSettingsBackdropState(false);
  };

  for (const button of openButtons) {
    button.addEventListener("click", openModal);
  }

  mapBordersInput.addEventListener("change", previewSettings);
  mapAllianceSymbolsInput.addEventListener("change", previewSettings);
  mapVisibilitySelect.addEventListener("change", previewSettings);
  languageSelect.addEventListener("change", previewSettings);
  backdrop?.addEventListener("click", () => closeModal({ revert: true }));
  closeButton?.addEventListener("click", () => closeModal({ revert: true }));
  saveButton.addEventListener("click", saveSettings);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal({ revert: true });
    }
  });
}

function bindLogoutActions(root) {
  const scope = root.ownerDocument || document;
  const buttons = Array.from(scope.querySelectorAll(NAV_LOGOUT_SELECTOR));

  if (buttons.length === 0) {
    return;
  }

  const logout = () => {
    const mode = String(getStoredRegistration()?.serverMode || "").trim().toLowerCase();
    window.localStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
    const nextHref = mode === "war" || mode === "free"
      ? `./login.html?mode=${mode}`
      : "./login.html";
    window.location.href = nextHref;
  };

  for (const button of buttons) {
    button.addEventListener("click", logout);
  }
}

function formatCurrency(value) {
  return `$${value}`;
}

function replaceListItems(listElement, values) {
  if (!listElement) {
    return;
  }

  listElement.replaceChildren(
    ...values.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    })
  );
}

function applyFactionPreview(root, factionId) {
  const faction = FACTION_CATALOG[factionId] || FACTION_CATALOG.mafian;

  const nameElement = root.querySelector(FACTION_NAME_SELECTOR);
  const taglineElement = root.querySelector(FACTION_TAGLINE_SELECTOR);
  const descriptionElement = root.querySelector(FACTION_DESCRIPTION_SELECTOR);
  const cleanMoneyElement = root.querySelector(FACTION_CLEAN_MONEY_SELECTOR);
  const dirtyMoneyElement = root.querySelector(FACTION_DIRTY_MONEY_SELECTOR);
  const influenceElement = root.querySelector(FACTION_INFLUENCE_SELECTOR);
  const heatElement = root.querySelector(FACTION_HEAT_SELECTOR);
  const advantagesElement = root.querySelector(FACTION_ADVANTAGES_SELECTOR);
  const disadvantagesElement = root.querySelector(FACTION_DISADVANTAGES_SELECTOR);

  if (nameElement) {
    nameElement.textContent = faction.name;
  }

  if (taglineElement) {
    taglineElement.textContent = faction.tagline;
  }

  if (descriptionElement) {
    descriptionElement.textContent = faction.description;
  }

  if (cleanMoneyElement) {
    cleanMoneyElement.textContent = formatCurrency(faction.startingPackage.cleanMoney);
  }

  if (dirtyMoneyElement) {
    dirtyMoneyElement.textContent = formatCurrency(faction.startingPackage.dirtyMoney);
  }

  if (influenceElement) {
    influenceElement.textContent = String(faction.startingPackage.influence);
  }

  if (heatElement) {
    heatElement.textContent = String(faction.startingPackage.heat);
  }

  replaceListItems(advantagesElement, faction.advantages);
  replaceListItems(disadvantagesElement, faction.disadvantages);
}

function renderAuthStatus(statusMount, title, note) {
  if (!statusMount) {
    return;
  }

  statusMount.replaceChildren();

  const label = document.createElement("span");
  label.className = "placeholder-label";
  label.textContent = "Registrace";

  const titleElement = document.createElement("h3");
  titleElement.className = "placeholder-title";
  titleElement.textContent = title;

  const noteElement = document.createElement("p");
  noteElement.className = "panel-note";
  noteElement.textContent = note;

  statusMount.append(label, titleElement, noteElement);
}

function bindFactionRegistration(root) {
  const authForm = root.querySelector(AUTH_FORM_SELECTOR);
  const identityInput = root.querySelector(AUTH_IDENTITY_SELECTOR);
  const factionInput = root.querySelector(AUTH_FACTION_INPUT_SELECTOR);
  const statusMount = root.querySelector(AUTH_STATUS_MOUNT_SELECTOR);
  const factionOptions = Array.from(root.querySelectorAll(FACTION_OPTION_SELECTOR));

  if (!authForm || !identityInput || !factionInput || factionOptions.length === 0) {
    return;
  }

  const existingRegistration = getStoredRegistration();

  const setActiveFaction = (factionId) => {
    factionInput.value = factionId;

    for (const option of factionOptions) {
      option.classList.toggle("is-active", option.dataset.factionId === factionId);
    }

    applyFactionPreview(root, factionId);
  };

  if (existingRegistration?.factionId && FACTION_CATALOG[existingRegistration.factionId]) {
    setActiveFaction(existingRegistration.factionId);
    identityInput.value = existingRegistration.identity || "Host";
    identityInput.readOnly = true;

    for (const option of factionOptions) {
      option.disabled = true;
    }

    renderAuthStatus(
      statusMount,
      "Frakce uzamčena",
      `Účet ${existingRegistration.identity || "Host"} už vstoupil do serveru jako ${FACTION_CATALOG[existingRegistration.factionId].name}. Frakci už nelze změnit.`
    );
  } else {
    setActiveFaction(factionInput.value || "mafian");

    for (const option of factionOptions) {
      option.addEventListener("click", () => {
        setActiveFaction(option.dataset.factionId || "mafian");
      });
    }

    renderAuthStatus(
      statusMount,
      "Výběr frakce",
      "Vyber frakci před registrací. Po vstupu na server se volba uzamkne a určí startovní zdroje, heat i profil výhod."
    );
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const registration = getStoredRegistration();

    if (registration?.factionId) {
      renderAuthStatus(
        statusMount,
        "Frakce uzamčena",
        `Účet ${registration.identity || "Host"} už má pevně zvolenou frakci ${FACTION_CATALOG[registration.factionId].name}.`
      );
      return;
    }

    const identity = identityInput.value.trim() || "Host";
    const factionId = factionInput.value in FACTION_CATALOG ? factionInput.value : "mafian";
    const now = new Date().toISOString();

    setStoredRegistration({ identity, factionId, lockedAt: now });
    setStoredWeaponInventory(createWeaponInventoryFromFaction(factionId));
    setStoredMaterialInventory(DEFAULT_MATERIAL_INVENTORY);
    setStoredDrugInventory(DEFAULT_DRUG_INVENTORY);
    setStoredProductionState({});
    setStoredEconomyState({
      cleanMoney: FACTION_CATALOG[factionId].startingPackage.cleanMoney,
      dirtyMoney: FACTION_CATALOG[factionId].startingPackage.dirtyMoney
    });
    setStoredMarketPriceState(createDefaultMarketPriceState());
    setStoredGangState({
      members: DEFAULT_GANG_MEMBERS,
      influence: FACTION_CATALOG[factionId].startingPackage.influence,
      heat: FACTION_CATALOG[factionId].startingPackage.heat,
      policeRaidProtectionUntil: 0,
      autoPoliceNextActionAt: 0,
      heatJournal: [],
      dirtyHeatReductionTimestamps: [],
      lastHeatDecayAt: new Date().toISOString()
    });
    identityInput.value = identity;
    identityInput.readOnly = true;

    for (const option of factionOptions) {
      option.disabled = true;
    }

    renderAuthStatus(
      statusMount,
      "Registrace dokončena",
      `${identity} vstoupil do serveru jako ${FACTION_CATALOG[factionId].name}. Frakce je od ${now} pevně uzamčená.`
    );
  });
}

function bindGangWantedStatus(root) {
  const heatButton = root.querySelector(GANG_HEAT_SELECTOR);
  const starContainer = root.querySelector(GANG_STARS_SELECTOR);
  const stars = Array.from(root.querySelectorAll(GANG_STAR_SELECTOR));
  const popup = root.querySelector(WANTED_POPUP_SELECTOR);
  const popupHeat = root.querySelector(WANTED_POPUP_HEAT_SELECTOR);
  const popupLevel = root.querySelector(WANTED_POPUP_LEVEL_SELECTOR);
  const popupTier = root.querySelector(WANTED_POPUP_TIER_SELECTOR);
  const popupDescription = root.querySelector(WANTED_POPUP_DESCRIPTION_SELECTOR);
  const popupProtection = root.querySelector(WANTED_POPUP_PROTECTION_SELECTOR);
  const popupLevels = root.querySelector(WANTED_POPUP_LEVELS_SELECTOR);
  const popupRiseList = root.querySelector(WANTED_POPUP_RISE_LIST_SELECTOR);
  const popupFallList = root.querySelector(WANTED_POPUP_FALL_LIST_SELECTOR);
  const popupFeedback = root.querySelector(WANTED_POPUP_FEEDBACK_SELECTOR);
  const dirtyActionButton = root.querySelector(WANTED_POPUP_DIRTY_ACTION_SELECTOR);
  const cleanActionButton = root.querySelector(WANTED_POPUP_CLEAN_ACTION_SELECTOR);
  const clearLogButton = root.querySelector(WANTED_POPUP_CLEAR_LOG_SELECTOR);
  const popupCloseElements = Array.from(root.querySelectorAll(WANTED_POPUP_CLOSE_SELECTOR));

  if (
    !heatButton
    || !starContainer
    || stars.length === 0
    || !popup
    || !popupHeat
    || !popupLevel
    || !popupTier
    || !popupDescription
    || !popupProtection
    || !popupLevels
    || !popupRiseList
    || !popupFallList
  ) {
    return;
  }

  const formatRelativeHeatTime = (createdAt) => {
    const timestamp = new Date(createdAt || Date.now()).getTime();
    const diffMs = Math.max(0, Date.now() - (Number.isFinite(timestamp) ? timestamp : Date.now()));
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes <= 0) {
      return "právě teď";
    }
    if (diffMinutes < 60) {
      return `před ${diffMinutes} min`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `před ${diffHours} h`;
    }
    return `před ${Math.floor(diffHours / 24)} d`;
  };

  const renderFeedback = (tone, message) => {
    if (!popupFeedback) {
      return;
    }
    const resolvedMessage = String(message || "").trim();
    popupFeedback.classList.remove("is-warning", "is-success", "is-danger");
    popupFeedback.hidden = !resolvedMessage;
    popupFeedback.textContent = resolvedMessage;
    if (!resolvedMessage) {
      return;
    }
    popupFeedback.classList.add(
      tone === "danger" ? "is-danger" : tone === "success" ? "is-success" : "is-warning"
    );
  };

  const renderJournalList = (mount, entries, emptyText) => {
    mount.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "wanted-popup-empty";
      empty.textContent = emptyText;
      mount.append(empty);
      return;
    }

    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "wanted-popup-item";

      const title = document.createElement("strong");
      title.textContent = entry.reason;

      const delta = document.createElement("span");
      delta.className = `wanted-popup-delta ${entry.type === "fall" ? "is-fall" : "is-rise"}`;
      delta.textContent = `${entry.type === "fall" ? "-" : "+"}${Math.max(0, Number(entry.amount || 0))} heat`;

      const timestamp = document.createElement("small");
      timestamp.textContent = formatRelativeHeatTime(entry.createdAt);

      item.append(title, delta, timestamp);
      mount.append(item);
    }
  };

  const registerDirtyHeatReduction = () => {
    const gangState = getResolvedGangState();
    const now = Date.now();
    const recent = gangState.dirtyHeatReductionTimestamps
      .filter((timestamp) => now - Number(timestamp) <= GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS);
    recent.push(now);
    setStoredGangState({ dirtyHeatReductionTimestamps: recent });
    return recent;
  };

  const triggerPoliceActionFromDirtyBribe = () => {
    const recent = registerDirtyHeatReduction();
    if (recent.length < GANG_HEAT_DIRTY_TRIGGER_COUNT) {
      return { triggered: false, count: recent.length, districtId: null, marker: null };
    }

    setStoredGangState({ dirtyHeatReductionTimestamps: [] });
    const ownedDistrictIds = getResolvedWorldState().ownedDistrictIds;
    if (!ownedDistrictIds.length) {
      return { triggered: false, count: recent.length, districtId: null, marker: null };
    }

    const targetDistrictId = ownedDistrictIds[Math.floor(Math.random() * ownedDistrictIds.length)];
    const triggerResult = markDistrictPoliceAction(targetDistrictId, {
      source: "heat-dirty-bribe",
      durationMs: GANG_HEAT_POLICE_DURATION_MS
    });
    if (!triggerResult.ok) {
      return { triggered: false, count: recent.length, districtId: null, marker: null };
    }

    return { triggered: true, count: recent.length, districtId: targetDistrictId, marker: triggerResult.marker || null };
  };

  const syncWantedStatus = () => {
    const gangState = syncGangHeatDecay();
    const heatValue = gangState.heat;
    const level = resolveGangHeatTier(heatValue);
    const economyState = getResolvedEconomyState();

    for (const [index, star] of stars.entries()) {
      star.classList.toggle("is-active", index < level.id);
    }

    starContainer.setAttribute("aria-label", `Heat ${heatValue} · ${level.title}`);
    heatButton.textContent = String(heatValue);
    heatButton.title = `${level.label} • ${level.title}`;
    popupHeat.textContent = String(heatValue);
    popupLevel.textContent = `${level.id} / 6`;
    popupTier.textContent = `${level.label} • ${level.title}`;
    popupDescription.textContent = level.description;
    popupProtection.textContent = formatGangHeatProtectionLabel(gangState.policeRaidProtectionUntil);

    popupLevels.replaceChildren();
    for (const tier of GANG_HEAT_TIERS) {
      const entry = document.createElement("div");
      entry.className = `wanted-popup-level ${tier.id === level.id ? "is-active" : ""}`;

      const title = document.createElement("strong");
      title.textContent = tier.label;

      const copy = document.createElement("span");
      copy.textContent = tier.title;

      entry.append(title, copy);
      popupLevels.append(entry);
    }

    const journal = normalizeGangHeatJournal(gangState.heatJournal);
    renderJournalList(
      popupRiseList,
      journal.filter((entry) => entry.type === "rise").slice(0, 6),
      "Zatím bez nových důvodů růstu."
    );
    renderJournalList(
      popupFallList,
      journal.filter((entry) => entry.type === "fall").slice(0, 6),
      "Zatím bez nových důvodů poklesu."
    );

    if (dirtyActionButton instanceof HTMLButtonElement) {
      dirtyActionButton.disabled = economyState.dirtyMoney < GANG_HEAT_DIRTY_COST;
    }

    if (cleanActionButton instanceof HTMLButtonElement) {
      cleanActionButton.disabled = economyState.cleanMoney < GANG_HEAT_CLEAN_COST;
    }
  };

  const openPopup = () => {
    renderFeedback("", "");
    syncWantedStatus();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  heatButton.addEventListener("click", openPopup);

  dirtyActionButton?.addEventListener("click", () => {
    const spendResult = trySpendGangMoney("dirty", GANG_HEAT_DIRTY_COST);
    if (!spendResult.ok) {
      renderFeedback("warning", `Chybí ${formatCurrency(spendResult.missing || 0)} dirty cash.`);
      syncWantedStatus();
      return;
    }

    const nextHeat = setGangHeatValue(getResolvedGangState().heat - GANG_HEAT_DIRTY_REDUCTION, {
      reason: "Uplacení tlaku špinavými penězi.",
      type: "fall"
    });
    const triggerState = triggerPoliceActionFromDirtyBribe();
    applyTopbarEconomy(root);
    renderFeedback(
      triggerState.triggered ? "danger" : "success",
      triggerState.triggered
        ? `Heat snížen na ${nextHeat}. Podezřelé praní přitáhlo policii do District ${triggerState.districtId}.${Array.isArray(triggerState.marker?.impact?.rows) && triggerState.marker.impact.rows.length ? ` Dopad: ${triggerState.marker.impact.rows.slice(0, 2).map((row) => `${row.label} ${row.value}`).join(" • ")}.` : ""}`
        : `Heat snížen na ${nextHeat}. Dirty cash stáhlo tlak policie.`
    );
    syncWantedStatus();
  });

  cleanActionButton?.addEventListener("click", () => {
    const spendResult = trySpendGangMoney("clean", GANG_HEAT_CLEAN_COST);
    if (!spendResult.ok) {
      renderFeedback("warning", `Chybí ${formatCurrency(spendResult.missing || 0)} clean cash.`);
      syncWantedStatus();
      return;
    }

    const nextHeat = setGangHeatValue(getResolvedGangState().heat - GANG_HEAT_CLEAN_REDUCTION, {
      reason: "Legální krytí a zahlazení stop.",
      type: "fall"
    });
    applyTopbarEconomy(root);
    renderFeedback("success", `Heat snížen na ${nextHeat}. Legal cover stáhlo policejní tlak.`);
    syncWantedStatus();
  });

  clearLogButton?.addEventListener("click", () => {
    clearGangHeatJournal();
    renderFeedback("success", "Heat log je vyčištěný.");
    syncWantedStatus();
  });

  for (const closeElement of popupCloseElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  document.addEventListener("empire:gang-state-changed", syncWantedStatus);
  document.addEventListener("empire:police-state-changed", syncWantedStatus);
  document.addEventListener("empire:economy-state-changed", syncWantedStatus);

  syncWantedStatus();
}

function bindPlayerProfilePopup(root) {
  const scope = root.ownerDocument || document;
  const openButton = scope.querySelector(PLAYER_PROFILE_OPEN_SELECTOR);
  const popup = scope.querySelector(PLAYER_POPUP_SELECTOR);
  const popupCard = scope.querySelector(PLAYER_POPUP_CARD_SELECTOR);
  const closeElements = Array.from(scope.querySelectorAll(PLAYER_POPUP_CLOSE_SELECTOR));
  const popupName = scope.querySelector("[data-player-popup-name]");
  const popupIdentity = scope.querySelector(PLAYER_POPUP_IDENTITY_SELECTOR);
  const popupFaction = scope.querySelector(PLAYER_POPUP_FACTION_SELECTOR);
  const popupServer = scope.querySelector(PLAYER_POPUP_SERVER_SELECTOR);
  const popupStartDistrict = scope.querySelector(PLAYER_POPUP_START_DISTRICT_SELECTOR);
  const popupCleanMoney = scope.querySelector(PLAYER_POPUP_CLEAN_MONEY_SELECTOR);
  const popupDirtyMoney = scope.querySelector(PLAYER_POPUP_DIRTY_MONEY_SELECTOR);
  const popupInfluence = scope.querySelector(PLAYER_POPUP_INFLUENCE_SELECTOR);
  const popupHeat = scope.querySelector(PLAYER_POPUP_HEAT_SELECTOR);
  const popupProtection = scope.querySelector(PLAYER_POPUP_PROTECTION_SELECTOR);
  const popupGang = scope.querySelector(PLAYER_POPUP_GANG_SELECTOR);
  const popupAlliance = scope.querySelector(PLAYER_POPUP_ALLIANCE_SELECTOR);
  const popupDistricts = scope.querySelector(PLAYER_POPUP_DISTRICTS_SELECTOR);

  if (!openButton || !popup || !popupCard || closeElements.length === 0) {
    return;
  }

  const syncPlayerProfileResources = () => {
    const displaySnapshot = getDisplayedResourceSnapshot();
    const registration = getStoredRegistration();
    const faction = registration?.factionId && FACTION_CATALOG[registration.factionId]
      ? FACTION_CATALOG[registration.factionId]
      : null;
    const avatarSrc = getLaunchPlayerAvatar(CURRENT_PLAYER_ID);
    const districtCount = getCurrentPlayerDistrictSourceSnapshot().districtCount;
    const startDistrictId = Number(registration?.startDistrictId || 0) || getCurrentPlayerLaunchStartDistrictId();
    const allianceLabel = window.empireStreetsAllianceState?.getActiveAlliance?.()?.name
      || root.querySelector("[data-gang-alliance]")?.textContent?.trim()
      || "Žádná";
    const identityLabel = registration?.identity || "Host";
    const gangLabel = registration?.identity ? `${registration.identity} Crew` : "Guest Crew";
    const serverLabel = registration?.serverLabel || registration?.serverId || "-";
    const accentColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
    const accentRgb = hexToRgbParts(accentColor).join(", ");

    if (avatarSrc) {
      popupCard.style.setProperty("--player-popup-avatar-url", `url("${String(avatarSrc).replace(/"/g, '\\"')}")`);
    } else {
      popupCard.style.setProperty("--player-popup-avatar-url", "none");
    }
    popupCard.style.setProperty("--player-popup-border-color", accentColor);

    if (openButton instanceof HTMLButtonElement) {
      openButton.style.setProperty("--player-profile-accent", accentColor);
      openButton.style.setProperty("--player-profile-accent-rgb", accentRgb);
      openButton.style.setProperty("--player-profile-accent-rgb-soft", accentRgb);
      openButton.dataset.playerFaction = String(registration?.factionId || "mafian");
    }

    if (popupName) {
      popupName.textContent = identityLabel;
    }

    if (popupIdentity) {
      popupIdentity.textContent = identityLabel;
    }

    if (popupFaction) {
      popupFaction.textContent = faction?.name || "-";
    }

    if (popupServer) {
      popupServer.textContent = serverLabel;
    }

    if (popupStartDistrict) {
      popupStartDistrict.textContent = startDistrictId ? `District ${startDistrictId}` : "-";
    }

    if (popupCleanMoney) {
      popupCleanMoney.textContent = formatDistrictMoneyAmount(displaySnapshot.cleanMoney);
    }

    if (popupDirtyMoney) {
      popupDirtyMoney.textContent = formatDistrictMoneyAmount(displaySnapshot.dirtyMoney);
    }

    if (popupInfluence) {
      popupInfluence.textContent = String(displaySnapshot.influence);
    }

    if (popupGang) {
      popupGang.textContent = gangLabel;
    }

    if (popupAlliance) {
      popupAlliance.textContent = allianceLabel || "Žádná";
    }

    if (popupDistricts) {
      popupDistricts.textContent = String(Math.max(0, Number(districtCount) || 0));
    }

    syncCurrentPlayerDistrictCountDisplays(root, districtCount);

    const gangState = getResolvedGangState();
    if (popupHeat) {
      popupHeat.textContent = String(gangState.heat);
    }

    if (popupProtection) {
      popupProtection.textContent = formatGangHeatProtectionLabel(gangState.policeRaidProtectionUntil);
    }
  };

  const openPopup = () => {
    syncPlayerProfileResources();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  document.addEventListener("empire:gang-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:police-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:economy-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:world-state-changed", syncPlayerProfileResources);
  window.addEventListener("empire:alliance-state-changed", syncPlayerProfileResources);

  syncPlayerProfileResources();
}

function bindRegisteredPlayerState(root) {
  const registration = getStoredRegistration();
  renderGangMembersState(root);

  if (!registration?.factionId || !FACTION_CATALOG[registration.factionId]) {
    return;
  }

  const faction = FACTION_CATALOG[registration.factionId];
  const scope = root.ownerDocument || document;
  const topbarInfluence = scope.querySelector(TOPBAR_INFLUENCE_SELECTOR);
  const gangFaction = root.querySelector("[data-gang-faction]");
  const gangHeat = root.querySelector(GANG_HEAT_SELECTOR);
  const playerName = scope.querySelector("[data-player-popup-name]");
  const playerIdentity = scope.querySelector(PLAYER_POPUP_IDENTITY_SELECTOR);
  const playerGang = scope.querySelector(PLAYER_POPUP_GANG_SELECTOR);
  const playerFaction = scope.querySelector(PLAYER_POPUP_FACTION_SELECTOR);
  const playerServer = scope.querySelector(PLAYER_POPUP_SERVER_SELECTOR);
  const playerStartDistrict = scope.querySelector(PLAYER_POPUP_START_DISTRICT_SELECTOR);

  applyTopbarEconomy(root, { instant: true });

  if (topbarInfluence) {
    topbarInfluence.dataset.influenceValue = String(getDisplayedResourceSnapshot().influence);
  }

  renderSpyResourceState(root, { instant: true });

  if (gangFaction) {
    gangFaction.textContent = faction.name;
  }

  syncCurrentPlayerDistrictCountDisplays(root, getCurrentPlayerDistrictSourceSnapshot().districtCount);

  if (gangHeat) {
    gangHeat.textContent = String(getResolvedGangState().heat);
  }

  if (playerName) {
    playerName.textContent = registration.identity || "Host";
  }

  if (playerIdentity) {
    playerIdentity.textContent = registration.identity || "Host";
  }

  if (playerGang) {
    playerGang.textContent = registration.identity ? `${registration.identity} Crew` : "Guest Crew";
  }

  if (playerFaction) {
    playerFaction.textContent = faction.name;
  }

  if (playerServer) {
    playerServer.textContent = registration.serverLabel || registration.serverId || "-";
  }

  if (playerStartDistrict) {
    const startDistrictId = Number(registration.startDistrictId || 0) || getCurrentPlayerLaunchStartDistrictId();
    playerStartDistrict.textContent = startDistrictId ? `District ${startDistrictId}` : "-";
  }

  const syncGangOverview = () => {
    applyTopbarEconomy(root);
    renderSpyResourceState(root);
    syncCurrentPlayerDistrictCountDisplays(root, getCurrentPlayerDistrictSourceSnapshot().districtCount);
    if (gangHeat) {
      gangHeat.textContent = String(getResolvedGangState().heat);
    }
  };

  document.addEventListener("empire:economy-state-changed", syncGangOverview);
  document.addEventListener("empire:gang-state-changed", syncGangOverview);
  document.addEventListener("empire:police-state-changed", syncGangOverview);
  document.addEventListener("empire:world-state-changed", syncGangOverview);
  window.addEventListener("empire:alliance-state-changed", syncGangOverview);
}

function bindAlliancePopup(root) {
  const openButton = root.querySelector(ALLIANCE_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(ALLIANCE_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(ALLIANCE_POPUP_CLOSE_SELECTOR));

  if (!openButton || !popup || closeElements.length === 0) {
    return;
  }

  const openPopup = () => {
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });
}

function bindArmoryPopup(root) {
  bindProductionBuildingPopup(root, {
    buildingName: "armory",
    openSelector: ARMORY_POPUP_OPEN_SELECTOR,
    popupSelector: ARMORY_POPUP_SELECTOR,
    closeSelector: ARMORY_POPUP_CLOSE_SELECTOR,
    recipes: ARMORY_RECIPES
  });
}

function bindPharmacyPopup(root) {
  bindProductionBuildingPopup(root, {
    buildingName: "pharmacy",
    openSelector: PHARMACY_POPUP_OPEN_SELECTOR,
    popupSelector: PHARMACY_POPUP_SELECTOR,
    closeSelector: PHARMACY_POPUP_CLOSE_SELECTOR,
    recipes: PHARMACY_RECIPES
  });
}

function bindDrugLabPopup(root) {
  bindProductionBuildingPopup(root, {
    buildingName: "druglab",
    openSelector: DRUGLAB_POPUP_OPEN_SELECTOR,
    popupSelector: DRUGLAB_POPUP_SELECTOR,
    closeSelector: DRUGLAB_POPUP_CLOSE_SELECTOR,
    recipes: DRUGLAB_RECIPES
  });
}

function bindFactoryPopup(root) {
  const openButton = root.querySelector(FACTORY_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(FACTORY_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(FACTORY_POPUP_CLOSE_SELECTOR));
  const slotList = root.querySelector(FACTORY_SLOT_LIST_SELECTOR);
  const levelElement = root.querySelector(FACTORY_LEVEL_SELECTOR);
  const headerLevelElement = root.querySelector(FACTORY_HEADER_LEVEL_SELECTOR);
  const multiplierElement = root.querySelector(FACTORY_MULTIPLIER_SELECTOR);
  const ownedCountElement = root.querySelector(FACTORY_OWNED_COUNT_SELECTOR);
  const upgradeCostElement = root.querySelector(FACTORY_UPGRADE_COST_SELECTOR);
  const metalElement = root.querySelector(FACTORY_RESOURCE_METAL_SELECTOR);
  const techElement = root.querySelector(FACTORY_RESOURCE_TECH_SELECTOR);
  const combatElement = root.querySelector(FACTORY_RESOURCE_COMBAT_SELECTOR);
  const supplyMetalElement = root.querySelector(FACTORY_SUPPLY_METAL_SELECTOR);
  const supplyTechElement = root.querySelector(FACTORY_SUPPLY_TECH_SELECTOR);
  const supplyCombatElement = root.querySelector(FACTORY_SUPPLY_COMBAT_SELECTOR);
  const effectsLabelElement = root.querySelector(FACTORY_EFFECTS_LABEL_SELECTOR);
  const upgradeButton = root.querySelector(FACTORY_UPGRADE_SELECTOR);
  const collectButton = root.querySelector(FACTORY_COLLECT_SELECTOR);
  const activeBoostElement = root.querySelector(FACTORY_ACTIVE_BOOST_SELECTOR);
  const boostButtons = Array.from(root.querySelectorAll(FACTORY_BOOST_BUTTON_SELECTOR));
  const tabButtons = Array.from(popup.querySelectorAll(FACTORY_TAB_SELECTOR));
  const panels = Array.from(popup.querySelectorAll(FACTORY_PANEL_SELECTOR));

  if (
    !openButton || !popup || closeElements.length === 0 || !slotList || !levelElement || !multiplierElement
    || !ownedCountElement || !upgradeCostElement || !metalElement || !techElement || !combatElement
    || !supplyMetalElement || !supplyTechElement || !supplyCombatElement || !effectsLabelElement || !upgradeButton
    || !collectButton
    || !activeBoostElement
  ) {
    return;
  }

  const setActiveTab = (tabName = "stats") => {
    for (const button of tabButtons) {
      const isActive = button.dataset.factoryTab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.factoryPanel !== tabName;
    }
  };

  const renderFactoryDashboard = () => {
    const syncResult = syncFactoryProduction(getStoredFactoryState());
    const factoryState = syncResult.state;
    const supplyState = getStoredFactorySupplies();
    setStoredFactoryState(factoryState);
    const collectableAmount = getFactoryCollectableAmount(factoryState);

    levelElement.textContent = String(factoryState.level);
    if (headerLevelElement) {
      headerLevelElement.textContent = `Lv ${factoryState.level}`;
    }
    multiplierElement.textContent = `${syncResult.productionMultiplier.toFixed(2)}x`;
    ownedCountElement.textContent = String(syncResult.ownedFactoryCount);
    upgradeCostElement.textContent = factoryState.level < FACTORY_CONFIG.maxLevel
      ? formatCurrency(getFactoryUpgradeCost(factoryState.level + 1))
      : "MAX";
    metalElement.textContent = String(factoryState.resources.metalParts || 0);
    techElement.textContent = String(factoryState.resources.techCore || 0);
    combatElement.textContent = String(factoryState.resources.combatModule || 0);
    supplyMetalElement.textContent = String(supplyState.metalParts || 0);
    supplyTechElement.textContent = String(supplyState.techCore || 0);
    supplyCombatElement.textContent = String(supplyState.combatModule || 0);
    effectsLabelElement.textContent = `Síť Továren: ${syncResult.ownedFactoryCount} budova (+${syncResult.networkProductionBonusPct}% rychlost výroby)`;
    upgradeButton.disabled = factoryState.level >= FACTORY_CONFIG.maxLevel;
    upgradeButton.textContent = factoryState.level >= FACTORY_CONFIG.maxLevel ? "MAX" : "⇪";
    upgradeButton.title = factoryState.level >= FACTORY_CONFIG.maxLevel
      ? "Max level"
      : `Upgrade budovy (${factoryState.level < FACTORY_CONFIG.maxLevel ? formatCurrency(getFactoryUpgradeCost(factoryState.level + 1)) : "MAX"})`;
    upgradeButton.setAttribute("aria-label", upgradeButton.title);
    collectButton.disabled = collectableAmount <= 0;
    collectButton.textContent = "+";
    collectButton.title = collectableAmount > 0
      ? `Vybrat hotové do skladu (${collectableAmount})`
      : "Vybrat hotové do skladu";
    collectButton.setAttribute("aria-label", collectButton.title);
    const activeBoost = getFactoryActiveBoost();
    activeBoostElement.textContent = activeBoost
      ? `${activeBoost.label} · ${Math.max(0, Math.ceil((new Date(activeBoost.expiresAt).getTime() - Date.now()) / 1000))}s`
      : "Žádný aktivní";

    for (const button of boostButtons) {
      const boostType = button.dataset.factoryBoost;
      const boostConfig = FACTORY_COMBAT_BOOSTS[boostType];
      if (!boostConfig) {
        button.disabled = true;
        continue;
      }
      const isActive = activeBoost?.type === boostType;
      button.disabled = isActive || Number(supplyState.combatModule || 0) < boostConfig.combatModuleCost;
      button.textContent = isActive ? "Aktivní" : `${boostConfig.label} (${boostConfig.combatModuleCost})`;
    }

    slotList.replaceChildren();
    slotList.classList.add("factory-slot-grid");

    for (const slot of factoryState.slots) {
      const slotConfig = FACTORY_SLOT_CONFIG.find((item) => item.id === slot.id) || null;
      const perHour = slot.resourceKey === "metalParts"
        ? syncResult.rates.metalPartsPerHour
        : slot.resourceKey === "techCore"
          ? syncResult.rates.techCorePerHour
          : syncResult.rates.combatModulePerHour;
      const slotVisual = slot.resourceKey === "metalParts"
        ? {
            iconToneClass: "drug-production-slot__icon--amber",
            iconGlyphClass: "drug-production-slot__icon--crate",
            typeLabel: `Výrobní slot ${slot.id}`,
            profileLabel: "Profil",
            primaryLine: "Surovinový výstup",
            secondaryLine: "Základ pro další výrobu"
          }
        : slot.resourceKey === "techCore"
          ? {
              iconToneClass: "drug-production-slot__icon--cyan",
              iconGlyphClass: "drug-production-slot__icon--chip",
              typeLabel: `Výrobní slot ${slot.id}`,
              profileLabel: "Profil",
              primaryLine: "Pokročilé jádro",
              secondaryLine: "Support pro vyšší tier"
            }
          : {
              iconToneClass: "drug-production-slot__icon--red",
              iconGlyphClass: "drug-production-slot__icon--crosshair",
              typeLabel: `Craft slot ${slot.id}`,
              profileLabel: "Recept",
              primaryLine: `${FACTORY_CONFIG.combatModule.metalPartsCost} MP + ${FACTORY_CONFIG.combatModule.techCoreCost} TC`,
              secondaryLine: `${formatDurationLabel(FACTORY_CONFIG.combatModule.durationMs)} / kus`
            };
      const card = document.createElement("article");
      card.className = slot.isProducing
        ? "factory-slot drug-production-slot factory-slot--active drug-production-slot--active"
        : "factory-slot drug-production-slot";

      const head = document.createElement("div");
      head.className = "factory-slot__head drug-production-slot__head";

      const titleWrap = document.createElement("div");
      titleWrap.className = "factory-slot__title-wrap drug-production-slot__title-wrap";

      const icon = document.createElement("span");
      icon.className = `drug-production-slot__icon ${slotVisual.iconToneClass} ${slotVisual.iconGlyphClass}`;
      icon.setAttribute("aria-hidden", "true");

      const labelWrap = document.createElement("div");
      labelWrap.className = "drug-production-slot__titles";

      const eyebrow = document.createElement("span");
      eyebrow.className = "drug-production-slot__product";
      eyebrow.textContent = slotVisual.typeLabel;

      const title = document.createElement("strong");
      title.className = "drug-production-slot__title";
      title.textContent = slotConfig?.label || slot.resourceKey;
      labelWrap.append(eyebrow, title);
      titleWrap.append(icon, labelWrap);

      const status = document.createElement("span");
      status.className = "drug-production-slot__state";
      status.textContent = slot.isProducing ? "Aktivní" : "Pauza";
      head.append(titleWrap, status);

      const metrics = document.createElement("div");
      metrics.className = "drug-production-slot__metrics";

      const outputMetric = document.createElement("div");
      outputMetric.className = "drug-production-slot__metric";
      const outputLabel = document.createElement("span");
      outputLabel.className = "drug-production-slot__metric-label";
      outputLabel.textContent = "Výstup";
      const outputValue = document.createElement("strong");
      outputValue.className = "drug-production-slot__metric-value";
      outputValue.textContent = `${perHour.toFixed(2)} / h`;
      outputMetric.append(outputLabel, outputValue);

      const profileMetric = document.createElement("div");
      profileMetric.className = "drug-production-slot__metric";
      const profileLabel = document.createElement("span");
      profileLabel.className = "drug-production-slot__metric-label";
      profileLabel.textContent = slotVisual.profileLabel;
      const profileValue = document.createElement("div");
      profileValue.className = "factory-slot__recipe-value";
      const profilePrimary = document.createElement("span");
      profilePrimary.className = "factory-slot__recipe-line";
      profilePrimary.textContent = slotVisual.primaryLine;
      const profileSecondary = document.createElement("span");
      profileSecondary.className = "factory-slot__recipe-line factory-slot__recipe-line--secondary";
      profileSecondary.textContent = slotVisual.secondaryLine;
      profileValue.append(profilePrimary, profileSecondary);
      profileMetric.append(profileLabel, profileValue);

      const storageMetric = document.createElement("div");
      storageMetric.className = "drug-production-slot__metric drug-production-slot__metric--inline";
      const storageLabel = document.createElement("span");
      storageLabel.className = "drug-production-slot__metric-label";
      storageLabel.textContent = "Ve slotu";
      const storageValue = document.createElement("span");
      storageValue.className = "drug-production-slot__metric-inline-value factory-slot__price-value";
      storageValue.textContent = `${slot.producedAmount}/${FACTORY_SLOT_STORAGE_CAP}`;
      storageMetric.append(storageLabel, storageValue);

      metrics.append(outputMetric, profileMetric, storageMetric);

      const actions = document.createElement("div");
      actions.className = "factory-slot__actions";

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "button drug-lab-mini-btn factory-slot-button";
      toggleButton.dataset.factorySlotToggleState = slot.isProducing ? "stop" : "start";
      toggleButton.textContent = slot.isProducing ? "Pozastavit produkci" : "Spustit produkci";
      toggleButton.addEventListener("click", () => {
        const nextState = getStoredFactoryState();
        const targetSlot = nextState.slots.find((item) => item.id === slot.id);
        if (!targetSlot) return;
        targetSlot.isProducing = !targetSlot.isProducing;
        targetSlot.lastTick = Date.now();
        setStoredFactoryState(nextState);
        renderFactoryDashboard();
      });

      actions.append(toggleButton);
      card.append(head, metrics, actions);
      slotList.append(card);
    }
  };

  const openPopup = () => {
    setActiveTab("stats");
    renderFactoryDashboard();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.factoryTab || "stats");
    });
  }

  collectButton.addEventListener("click", () => {
    const collected = collectFactoryOutputsToSupplies();
    renderFactoryDashboard();

    if (collected <= 0) {
      setBuildingActionFeedback(root, "warning", "Továrna", "Není nic hotového k vyzvednutí.");
      return;
    }

    setBuildingActionFeedback(root, "success", "Továrna", "Továrna přesunula hotovou výrobu do skladu.", `Vyzvednuto ${collected} ks.`);
  });

  upgradeButton.addEventListener("click", () => {
    const factoryState = getStoredFactoryState();
    if (factoryState.level >= FACTORY_CONFIG.maxLevel) {
      return;
    }
    const nextLevel = factoryState.level + 1;
    const upgradeCost = getFactoryUpgradeCost(nextLevel);
    const economyState = getResolvedEconomyState();
    if (economyState.cleanMoney < upgradeCost) {
      setBuildingActionFeedback(root, "warning", "Továrna", `Na upgrade chybí ${formatCurrency(upgradeCost - economyState.cleanMoney)}.`);
      return;
    }
    setStoredEconomyState({
      ...economyState,
      cleanMoney: economyState.cleanMoney - upgradeCost
    });
    applyTopbarEconomy(root);
    setStoredFactoryState({
      ...factoryState,
      level: nextLevel,
      updatedAt: Date.now()
    });
    setBuildingActionFeedback(root, "success", "Továrna", `Továrna byla upgradovaná na level ${nextLevel}.`);
    renderFactoryDashboard();
  });

  for (const button of boostButtons) {
    button.addEventListener("click", () => {
      const boostType = button.dataset.factoryBoost;
      const result = activateFactoryBoost(boostType);
      if (!result.ok) {
        setBuildingActionFeedback(root, "warning", "Factory boost", result.reason);
        renderFactoryDashboard();
        return;
      }
      setBuildingActionFeedback(root, "success", "Factory boost", `${result.boost.label} je aktivní pro další útok.`);
      renderFactoryDashboard();
    });
  }

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });
}

function bindStoragePopup(root) {
  const scope = root.ownerDocument || document;
  const openButton = scope.querySelector(STORAGE_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(STORAGE_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(STORAGE_POPUP_CLOSE_SELECTOR));
  const weaponCounters = Array.from(root.querySelectorAll(STORAGE_WEAPON_COUNT_SELECTOR));
  const materialCounters = Array.from(root.querySelectorAll(STORAGE_MATERIAL_COUNT_SELECTOR));
  const drugCounters = Array.from(root.querySelectorAll(STORAGE_DRUG_COUNT_SELECTOR));
  const factoryCounters = Array.from(root.querySelectorAll(STORAGE_FACTORY_COUNT_SELECTOR));

  if (!openButton || !popup || closeElements.length === 0 || weaponCounters.length === 0) {
    return;
  }

  const renderStorageInventory = () => {
    const inventory = getResolvedWeaponInventory();
    const materialInventory = getResolvedMaterialInventory();
    const drugInventory = getResolvedDrugInventory();
    const factorySupplies = getStoredFactorySupplies();

    for (const counter of weaponCounters) {
      const weaponId = counter.dataset.storageWeaponCount;

      if (!weaponId) {
        continue;
      }

      counter.textContent = `${inventory[weaponId] ?? 0} ks`;
    }

    for (const counter of materialCounters) {
      const materialId = counter.dataset.storageMaterialCount;

      if (!materialId) {
        continue;
      }

      counter.textContent = `${materialInventory[materialId] ?? 0} ks`;
    }

    for (const counter of drugCounters) {
      const drugId = counter.dataset.storageDrugCount;

      if (!drugId) {
        continue;
      }

      counter.textContent = `${drugInventory[drugId] ?? 0} ks`;
    }

    for (const counter of factoryCounters) {
      const factoryId = counter.dataset.storageFactoryCount;

      if (!factoryId) {
        continue;
      }

      counter.textContent = `${factorySupplies[factoryId] ?? 0} ks`;
    }
  };

  const openPopup = () => {
    renderStorageInventory();
    popup.hidden = false;
  };

  const closePopup = () => {
    popup.hidden = true;
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  renderStorageInventory();
}

function bindSpyResourceToggle(root) {
  const scope = root.ownerDocument || document;
  const spyPill = scope.querySelector(TOPBAR_SPY_PILL_SELECTOR);
  const spyValue = scope.querySelector(TOPBAR_SPY_VALUE_SELECTOR);

  if (!spyPill || !spyValue) {
    return;
  }

  if (!spyPill.dataset.resourceMode) {
    spyPill.dataset.resourceMode = "influence";
  }

  if (!spyValue.dataset.influenceValue) {
    spyValue.dataset.influenceValue = spyValue.textContent || "0";
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest(TOPBAR_SPY_PILL_SELECTOR);

    if (!(trigger instanceof HTMLButtonElement) || trigger !== spyPill) {
      return;
    }

    event.preventDefault();
    spyPill.dataset.resourceMode = spyPill.dataset.resourceMode === "spy" ? "influence" : "spy";
    renderSpyResourceState(root, { animate: true });
  });

  renderSpyResourceState(root, { instant: true });
}

function bindCityStatusBar(root) {
  const phaseHost = root.querySelector(MAP_PHASE_SELECTOR);
  const clockElement = root.querySelector(CITY_CLOCK_SELECTOR);
  const dayPhaseElement = root.querySelector(CITY_DAY_PHASE_SELECTOR);
  const gamePhaseElement = root.querySelector(CITY_GAME_PHASE_SELECTOR);
  const statusElement = root.querySelector(CITY_STATUS_SELECTOR);
  const productionElement = root.querySelector(CITY_PRODUCTION_SELECTOR);

  if (!phaseHost || !clockElement || !dayPhaseElement || !gamePhaseElement || !statusElement || !productionElement) {
    return;
  }

  let clockTimerId = null;

  const getMapPhaseFromClock = (cityMinutes) => {
    const hour = Math.floor(cityMinutes / 60) % 24;
    return hour >= 6 && hour < 20 ? "day" : "night";
  };

  const tickPhaseClock = () => {
    syncDevOnlyDestroyedDistrictState();
    syncStartPhaseDistrictIncome(root);

    const worldState = getResolvedWorldState();
    const currentPhaseState = worldState.phaseState || getResolvedPhaseState();
    const nextCityMinutes = ((currentPhaseState.cityMinutes ?? (22 * 60 + 14)) + 7) % (24 * 60);

    setStoredWorldState({
      ...worldState,
      phaseState: {
        ...currentPhaseState,
        cityMinutes: nextCityMinutes,
        mapPhase: getMapPhaseFromClock(nextCityMinutes),
        gamePhase: currentPhaseState.gamePhase === "launch" ? "launch" : "live"
      }
    });

    updatePhaseStatus();
    syncGangAutoPolicePressure();
    syncDevOnlyPolicePressure();
  };

  const updatePhaseStatus = () => {
    const phaseState = syncPhaseHostFromAuthority(phaseHost);
    const cityMinutes = phaseState.cityMinutes ?? (22 * 60 + 14);
    const hours = String(Math.floor(cityMinutes / 60) % 24).padStart(2, "0");
    const minutes = String(cityMinutes % 60).padStart(2, "0");
    const mapPhase = phaseHost.dataset.mapPhase === "night" ? "NOC" : "DEN";
    const gamePhase = phaseHost.dataset.gamePhase === "launch" ? "DEV-ONLY" : "LIVE";
    const productionLabel = mapPhase === "NOC"
      ? "-8 % noční směna"
      : gamePhase === "DEV-ONLY"
        ? "+6 % rozjezd výroby"
        : "+12 % denní směna";

    clockElement.textContent = `${hours}:${minutes}`;
    dayPhaseElement.textContent = mapPhase;
    gamePhaseElement.textContent = gamePhase;
    statusElement.textContent = mapPhase === "NOC"
      ? "Město nespí"
      : gamePhase === "DEV-ONLY"
        ? "Rozjezd ulic"
        : "Klid před bouří";
    productionElement.textContent = productionLabel;
  };

  updatePhaseStatus();
  syncDevOnlyDestroyedDistrictState();
  syncStartPhaseDistrictIncome(root);
  syncGangAutoPolicePressure();
  syncDevOnlyPolicePressure();
  clockTimerId = window.setInterval(tickPhaseClock, 1000);

  phaseHost.addEventListener("mapphasechange", updatePhaseStatus);
  phaseHost.addEventListener("gamephasechange", updatePhaseStatus);
  phaseHost.addEventListener("gamephasechange", () => {
    syncStartPhaseDistrictIncome(root);
  });

  window.addEventListener("beforeunload", () => {
    if (clockTimerId !== null) {
      window.clearInterval(clockTimerId);
    }
  }, { once: true });
}

function bootstrapPage() {
  const root = document.querySelector(PAGE_ROOT_SELECTOR);
  if (!root) {
    return;
  }

  syncDevOnlyDestroyedDistrictState();
  syncPhaseHostFromAuthority(root.querySelector(MAP_PHASE_SELECTOR));

  const context = createPageContext(root);
  window.empireStreetsPage = context;
  markMounts(context);
  bindFactionRegistration(root);
  bindRegisteredPlayerState(root);
  bindDistrictCanvas(root);
  bindMapPhaseToggle(root);
  bindBorderColorToggle(root);
  bindGamePhaseToggle(root);
  bindMapNavigation(root);
  bindBuildingActionStatus(root);
  bindSettingsModal(root);
  bindLogoutActions(root);
  bindGangWantedStatus(root);
  bindPlayerProfilePopup(root);
  bindAlliancePopup(root);
  bindMarketPopup(root);
  bindStoragePopup(root);
  bindPharmacyPopup(root);
  bindDrugLabPopup(root);
  bindFactoryPopup(root);
  bindArmoryPopup(root);
  bindCityStatusBar(root);
  bindSpyResourceToggle(root);
  bindAttackOrders(root);
  bindOccupyOrders(root);
  bindRobberyOrders(root);
  bindSpyMissions(root);
  applySettingsState(getSettingsState());
  root.dataset.bootstrap = "ready";
  document.documentElement.dataset.page = context.name;
}

export {
  ARMORY_RECIPES,
  ATTACK_COOLDOWN_MS,
  ATTACK_SETUP_WEAPONS,
  CURRENT_PLAYER_ID,
  DEFAULT_DRUG_INVENTORY,
  DEFAULT_GANG_MEMBERS,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  DISTRICT_TYPE_GRID,
  DRUGLAB_RECIPES,
  FACTION_CATALOG,
  FACTION_WEAPON_PRESETS,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG,
  MAX_SPIES,
  PAGE_ROOT_SELECTOR,
  PHARMACY_RECIPES,
  ROBBERY_COOLDOWN_MS,
  SPY_COOLDOWN_MS,
  START_PHASE_OWNER_BY_DISTRICT_ID,
  START_PHASE_OWNER_COORDINATES,
  START_PHASE_PLAYER_COLORS,
  START_PHASE_PLAYER_NAMES,
  addGangHeat,
  applyFactionPreview,
  applyTopbarEconomy,
  bindAlliancePopup,
  bindArmoryPopup,
  bindAttackOrders,
  bindBorderColorToggle,
  bindBuildingActionStatus,
  bindCityStatusBar,
  bindDistrictCanvas,
  bindDrugLabPopup,
  bindFactoryPopup,
  bindFactionRegistration,
  bindGamePhaseToggle,
  bindGangWantedStatus,
  bindMapNavigation,
  bindMapPhaseToggle,
  bindMarketPopup,
  bindPharmacyPopup,
  bindPlayerProfilePopup,
  bindRegisteredPlayerState,
  bindRobberyOrders,
  bindSpyMissions,
  bindSpyResourceToggle,
  bindStoragePopup,
  bootstrapPage,
  clamp,
  classifyDistrictType,
  clearProductionJob,
  collectMounts,
  completeAttackOrder,
  completeRobberyOrder,
  completeSpyMission,
  computeNextDynamicPrice,
  consumeMaterials,
  createDefaultMarketPriceState,
  createDistrictGeometry,
  createDistrictTypeGrid,
  createLaunchOwnerMap,
  createPageContext,
  createProductionCard,
  createSeededRandom,
  createStops,
  createWeaponInventoryFromFaction,
  drawAttackDistrictAnimation,
  activateFactoryBoost,
  drawDistrictPolygon,
  drawMapImage,
  drawRobberyDistrictAnimation,
  drawSpyDistrictAnimation,
  formatCurrency,
  formatDurationLabel,
  getAdjacentDistrictIdsFromGeometry,
  getAttackScenarioMemberLoss,
  getCurrentPlayerOwnedDistrictIds,
  getDistrictAtPoint,
  getDistrictFillStyle,
  getDistrictOwnerLabel,
  getEffectiveOwnedDistrictIds,
  getFactoryBoostSnapshot,
  getInventoryAmount,
  getLaunchPlayerColor,
  getLaunchPlayerAvatar,
  getLaunchPlayerFactionId,
  getLaunchPlayerLabel,
  getLaunchPlayerName,
  getMarketPriceEntry,
  getMarketPriceKey,
  getMarketRefreshCountdownSeconds,
  getPointOnPolygonPerimeter,
  getPriceVarianceForTab,
  getProductionJob,
  getResolvedDrugInventory,
  getResolvedEconomyState,
  getResolvedGangState,
  getResolvedMarketPriceState,
  getResolvedMaterialInventory,
  getPharmacyBoostSnapshot,
  getResolvedProductionState,
  getResolvedSpyIntel,
  getResolvedSpyState,
  getResolvedWeaponInventory,
  getRobberyLootForOrder,
  getRobberyScenarioMemberLoss,
  getStoredAttackOrders,
  getStoredDrugInventory,
  getStoredEconomyState,
  getStoredGangState,
  getStoredMarketPriceState,
  getStoredMaterialInventory,
  getStoredProductionState,
  getStoredRegistration,
  getStoredRobberyOrders,
  getStoredSpyIntel,
  getStoredSpyState,
  getStoredWeaponInventory,
  hasEnoughMaterials,
  hashCell,
  isDistrictTypeHidden,
  isDistrictTypeVisible,
  isDowntownCell,
  isPointInDistrict,
  loadImage,
  markMounts,
  persistProductionJob,
  refreshMarketPricesIfNeeded,
  remapDistrictId,
  remapDistrictType,
  renderDistrictCanvas,
  renderGangMembersState,
  renderProductionPanel,
  renderAuthStatus,
  renderSpyResourceState,
  replaceListItems,
  resolveAttackScenario,
  resolveRobberyScenario,
  resolveSpyScenario,
  scheduleAttackOrder,
  scheduleProductionJob,
  scheduleRobberyOrder,
  scheduleSpyMission,
  setBuildingActionFeedback,
  setInventoryAmount,
  setStoredAttackOrders,
  setStoredDrugInventory,
  setStoredEconomyState,
  setStoredGangState,
  setStoredMarketPriceState,
  setStoredMaterialInventory,
  setStoredProductionState,
  setStoredRegistration,
  setStoredRobberyOrders,
  setStoredSpyIntel,
  setStoredSpyState,
  setStoredWeaponInventory,
  usePharmacyBoost,
  showAttackToast,
  showRobberyToast,
  showSpyToast,
  syncCompletedProductionJobs
};
