import { resolveDistrictActions } from "./legacy/district-action-policy.js";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_SETUP_WEAPONS,
  DEFAULT_GANG_MEMBERS,
  MAX_SPIES,
  OCCUPY_COOLDOWN_MS,
  ROBBERY_COOLDOWN_MS,
  SPY_COOLDOWN_MS
} from "../../../packages/game-config/src/legacy-page/combat-config.js";
import {
  ARMORY_RECIPES,
  DEFAULT_DRUG_INVENTORY,
  DEMO_FACTORY_COMBAT_BOOSTS,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  FACTORY_CONFIG,
  FACTORY_RESOURCE_KEYS,
  DRUGLAB_RECIPES,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP,
  FACTORY_SLOT_STORAGE_CAPS,
  getMarketPriceKey,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG,
  PHARMACY_RECIPES,
  WAREHOUSE_STORAGE_CONFIG
} from "../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  FACTION_CATALOG,
  FACTION_WEAPON_PRESETS
} from "../../../packages/game-config/src/legacy-page/faction-config.js";
import {
  calculateAttackDeployment,
  calculateDefensePower,
  DEFENSE_POWER_BY_WEAPON,
  calculateTotalDefensePower,
  estimateDistrictDefense,
  formatDefenseLoadout,
  createRobberySetupPreview,
  getAttackScenarioMemberLoss,
  getRobberyLootForOrder,
  getRobberyRiskLevel,
  getRobberyScenarioMemberLoss,
  getRobberySuccessChance,
  resolveAttackOutcome,
  resolveAttackScenario,
  resolveRobberyOrderOutcome,
  resolveRobberyScenario,
  validateAttackSelection
} from "../../../packages/game-core/src/legacy-page/combat-preview-rules.js";
import { formatDurationLabel } from "../../../packages/game-core/src/legacy-page/production-preview-rules.js";
import {
  LEGACY_SPY_MISSION_SPY_COUNT,
  applySpyIntelOutcome,
  createCapturedSpyMission,
  getSpyHeatGainForOutcome,
  isSpyCapturedOutcome,
  normalizeSpyOutcome,
  resolveSpyScenario
} from "../../../packages/game-core/src/legacy-page/spy-preview-rules.js";
import {
  getAuthoritySession,
  updateStoredPreviewSession
} from "./model/authority-state.js";
import {
  LEGACY_STORAGE_KEYS,
  clearState as clearLegacyState,
  loadClinicRecoveryPool,
  loadDistrictBuildingDetailState,
  loadSettingsState,
  loadTextStorage,
  saveClinicRecoveryPool,
  saveDistrictBuildingDetailState,
  saveSettingsState
} from "./persistence/legacyStorage.js";
import {
  createSettingsStateRuntime,
  normalizeMapVisibilityMode
} from "./runtime/settingsState.js";
import {
  getDefaultRuntimeRoot as getDefaultRuntimeRootElement,
  readRuntimeSnapshotValue,
  resolveRuntimeRoot as resolveRuntimeRootElement,
  warnRuntimeOrchestrator
} from "./runtime/runtimeRoot.js";
import {
  CURRENT_PLAYER_ID,
  DEMO_SCENARIOS,
  DEV_ONLY_DESTROYED_DISTRICT_ID,
  DEV_ONLY_ONBOARDING_START_STATE,
  DEV_ONLY_POLICE_INTERVAL_MS,
  DEV_ONLY_SPY_FULL_SUCCESS_CHANCE,
  LAUNCH_PLAYER_AVATAR_BY_FACTION_ID,
  LAUNCH_PLAYER_FACTION_ORDER,
  START_PHASE_OWNER_COORDINATES,
  START_PHASE_PLAYER_COLORS,
  START_PHASE_PLAYER_NAMES,
  START_PHASE_RESOURCE_SIMULATION,
  isDemoScenarioMode
} from "./onboarding/demoScenarios.js";
import { bindLeaderboardPopup } from "./features/leaderboard.js";
import { bindMapNavigation } from "./map-navigation.js";
import { createMapCanvasAnimationRenderers } from "./map/mapCanvasAnimations.js";
import { createDistrictCanvasRenderer } from "./map/districtCanvasRenderer.js";
import {
  DISTRICT_ATMOSPHERE_META,
  DISTRICT_BUILDING_TYPE_META,
  DISTRICT_BUILDING_TYPE_ORDER,
  MAP_DEFAULT_DISTRICT_TYPE,
  MAP_DISTRICT_GEOMETRY_TOP_INSET,
  MAP_DISTRICT_FOCUSED_CLASS,
  MAP_DISTRICT_SELECTION_DRAG_THRESHOLD,
  MAP_DISTRICT_SELECTION_SUPPRESS_MS,
  MAP_DOWNTOWN_DISTRICT_TYPE,
  MAP_EFFECTS_CANVAS_CLASS,
  MAP_HAS_HOVER_CLASS,
  MAP_HOVER_CANVAS_CLASS,
  MAP_HOVER_STROKE_STYLE,
  MAP_INTERACTION_OVERLAY_CLASS,
  MAP_OWNER_FILL_ALPHA,
  MAP_REDUCED_ACTIVITY_COLORS,
  MAP_REDUCED_ACTIVITY_FALLBACK_COLOR
} from "./map/mapConstants.js";
import {
  resolveMapDestroyedFillStyle,
  resolveMapDistrictOwnerLabel,
  resolveMapHiddenFillStyle,
  resolveMapLaunchUnownedFillStyle,
  resolveMapZoneFillStyle
} from "./map/mapDataAdapter.js";
import {
  DISTRICT_TYPE_GRID,
  classifyDistrictType,
  createDistrictGeometry,
  createDistrictTypeGrid,
  createLaunchOwnerMap,
  createOrganicDistrictPolygon,
  createStops,
  getAdjacentDistrictIdsFromGeometry,
  getDistrictAtPoint,
  isDowntownCell,
  isPointInDistrict,
  remapDistrictId,
  remapDistrictType
} from "./map/mapGeometry.js";
import {
  buildDistrictActionViewModel,
  buildSelectedDistrictSummaryViewModel,
  getDistrictDisplayName
} from "./map/districtViewModel.js";
import { buildDistrictPopupFlagsViewModel } from "./map/districtPopupFlagsViewModel.js";
import {
  canRenderMap,
  clearMapShellUi,
  getMapShellElements,
  initMapShell,
  renderMapMissingState,
  setMapBusy,
  setMapError,
  syncMapShellVisualState
} from "./map/mapShell.js";
import {
  createDefaultMapOverlayState,
  isOverlayEnabled,
  normalizeMapOverlayState,
  setActiveOverlay,
  toggleOverlay
} from "./map/mapOverlayState.js";
import {
  initMapOverlayControls,
  renderMapOverlayControls,
  updateMapOverlayButtonStates
} from "./map/mapOverlayControls.js";
import {
  clearMapStatusPanel,
  renderMapBusyState,
  renderMapErrorState,
  renderMapStatusPanel
} from "./map/mapStatusPanel.js";
import {
  refreshMapAfterStateChange,
  refreshMapOverlayUi,
  refreshMapStatusUi,
  refreshMapUiShell,
  refreshSelectedDistrictUi
} from "./map/mapRefreshPipeline.js";
import { createMapRenderScheduler } from "./map/mapRenderScheduler.js";
import { buildMapStatusViewModel } from "./map/mapStatusViewModel.js";
import {
  hideDistrictTooltip,
  renderDistrictTooltip
} from "./map/mapTooltip.js";
import { buildMapTooltipViewModel } from "./map/mapTooltipViewModel.js";
import { buildMapMissionMarkersViewModel } from "./map/mapMissionMarkersViewModel.js";
import {
  applyMobilePerformanceMode,
  detectMobilePerformanceMode,
  getCappedDevicePixelRatio,
  getPerformanceMetrics,
  recordMapEffectRender
} from "./performance/mobilePerformanceMode.js";
import { getPoliceTierShortEffect, resolvePoliceOperationImpact } from "./police-raid-config.js";
import { renderPoliceRaidImpactDetails } from "./police-raid-modal.js";
import { createStorageCollectResultPayload } from "./production-collect-results.js";
import {
  PAGE_ROOT_SELECTOR,
  MOUNT_SELECTOR,
  AUTH_FORM_SELECTOR,
  AUTH_STATUS_MOUNT_SELECTOR,
  AUTH_IDENTITY_SELECTOR,
  AUTH_FACTION_INPUT_SELECTOR,
  NAV_SETTINGS_SELECTOR,
  NAV_LOGOUT_SELECTOR,
  FACTION_OPTION_SELECTOR,
  PHASE_TOGGLE_SELECTOR,
  BORDER_TOGGLE_SELECTOR,
  MAP_PHASE_SELECTOR,
  MAP_VIEWPORT_SELECTOR,
  MAP_CANVAS_SELECTOR,
  DISTRICT_CANVAS_SELECTOR,
  DISTRICT_TOOLTIP_SELECTOR,
  DISTRICT_TOOLTIP_VALUE_SELECTOR,
  DISTRICT_TOOLTIP_TYPE_SELECTOR,
  DISTRICT_TOOLTIP_GOSSIP_SELECTOR,
  DISTRICT_POPUP_SELECTOR,
  DISTRICT_POPUP_CARD_SELECTOR,
  DISTRICT_POPUP_TITLE_SELECTOR,
  DISTRICT_POPUP_TYPE_SELECTOR,
  DISTRICT_POPUP_OWNER_SELECTOR,
  DISTRICT_POPUP_OWNER_META_SELECTOR,
  DISTRICT_POPUP_OWNER_AVATAR_SELECTOR,
  DISTRICT_POPUP_OWNER_AVATAR_FALLBACK_SELECTOR,
  DISTRICT_POPUP_DEFENSE_SELECTOR,
  DISTRICT_POPUP_DEFENSE_POWER_SELECTOR,
  DISTRICT_POPUP_RESIDENTS_SELECTOR,
  DISTRICT_POPUP_INCOME_SELECTOR,
  DISTRICT_POPUP_HEAT_SELECTOR,
  DISTRICT_POPUP_INFLUENCE_SELECTOR,
  DISTRICT_POPUP_FLAGS_SELECTOR,
  DISTRICT_POPUP_TOGGLE_SELECTOR,
  DISTRICT_POPUP_CLOSE_SELECTOR,
  DISTRICT_POPUP_ATMOSPHERE_IMAGE_SELECTOR,
  DISTRICT_POPUP_ATMOSPHERE_LABEL_SELECTOR,
  DISTRICT_POPUP_ATMOSPHERE_MOOD_SELECTOR,
  DISTRICT_POPUP_BUILDINGS_SELECTOR,
  DISTRICT_POPUP_BUILDINGS_META_SELECTOR,
  DISTRICT_POPUP_BUILDINGS_LIST_SELECTOR,
  DISTRICT_POPUP_GOSSIP_SELECTOR,
  DISTRICT_POPUP_GOSSIP_LIST_SELECTOR,
  DISTRICT_ACTION_SECTION_SELECTOR,
  DISTRICT_ACTIONS_SELECTOR,
  SPY_TOAST_SELECTOR,
  ATTACK_TOAST_SELECTOR,
  ROBBERY_TOAST_SELECTOR,
  GAME_PHASE_TOGGLE_SELECTOR,
  BUILDING_ACTION_STATE_SELECTOR,
  BUILDING_ACTION_SUMMARY_SELECTOR,
  BUILDING_ACTION_META_SELECTOR,
  BUILDING_ACTION_CLEAR_SELECTOR,
  BUILDING_ACTION_FEED_SELECTOR,
  BUILDING_ACTION_EMPTY_SELECTOR,
  BUILDING_ACTION_REMOVE_SELECTOR,
  GANG_MEMBERS_SELECTOR,
  GANG_HEAT_SELECTOR,
  GANG_STAR_SELECTOR,
  GANG_STARS_SELECTOR,
  WANTED_POPUP_SELECTOR,
  WANTED_POPUP_CLOSE_SELECTOR,
  WANTED_POPUP_HEAT_SELECTOR,
  WANTED_POPUP_LEVEL_SELECTOR,
  WANTED_POPUP_TIER_SELECTOR,
  WANTED_POPUP_DESCRIPTION_SELECTOR,
  WANTED_POPUP_PROTECTION_SELECTOR,
  WANTED_POPUP_LEVELS_SELECTOR,
  WANTED_POPUP_RISE_LIST_SELECTOR,
  WANTED_POPUP_FALL_LIST_SELECTOR,
  WANTED_POPUP_FEEDBACK_SELECTOR,
  WANTED_POPUP_DIRTY_ACTION_SELECTOR,
  WANTED_POPUP_CLEAN_ACTION_SELECTOR,
  WANTED_POPUP_INFLUENCE_ACTION_SELECTOR,
  WANTED_POPUP_CLEAR_LOG_SELECTOR,
  PLAYER_PROFILE_OPEN_SELECTOR,
  PLAYER_POPUP_SELECTOR,
  PLAYER_POPUP_CARD_SELECTOR,
  PLAYER_POPUP_CLOSE_SELECTOR,
  PLAYER_POPUP_AVATAR_SELECTOR,
  PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR,
  BUILDINGS_POPUP_OPEN_SELECTOR,
  BUILDINGS_POPUP_SELECTOR,
  BUILDINGS_POPUP_CLOSE_SELECTOR,
  BUILDINGS_POPUP_TYPES_SELECTOR,
  BUILDINGS_POPUP_DETAIL_SELECTOR,
  MARKET_POPUP_OPEN_SELECTOR,
  MARKET_POPUP_SELECTOR,
  MARKET_POPUP_CLOSE_SELECTOR,
  MARKET_TAB_SELECTOR,
  MARKET_COPY_SELECTOR,
  MARKET_LIST_SELECTOR,
  MARKET_SERVER_BADGE_SELECTOR,
  MARKET_DASHBOARD_SELECTOR,
  MARKET_FEEDBACK_SELECTOR,
  SETTINGS_MODAL_SELECTOR,
  SETTINGS_MODAL_BACKDROP_SELECTOR,
  SETTINGS_MODAL_CLOSE_SELECTOR,
  SETTINGS_SAVE_SELECTOR,
  SETTINGS_MAP_BORDERS_SELECTOR,
  SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR,
  SETTINGS_MAP_REDUCED_EFFECTS_SELECTOR,
  SETTINGS_MAP_VISIBILITY_SELECTOR,
  SETTINGS_LANGUAGE_SELECTOR,
  TOPBAR_INFLUENCE_SELECTOR,
  TOPBAR_SPY_PILL_SELECTOR,
  TOPBAR_SPY_VALUE_SELECTOR,
  PLAYER_POPUP_CLEAN_MONEY_SELECTOR,
  PLAYER_POPUP_DIRTY_MONEY_SELECTOR,
  PLAYER_POPUP_INFLUENCE_SELECTOR,
  PLAYER_POPUP_IDENTITY_SELECTOR,
  PLAYER_POPUP_FACTION_SELECTOR,
  PLAYER_POPUP_SERVER_SELECTOR,
  PLAYER_POPUP_START_DISTRICT_SELECTOR,
  PLAYER_POPUP_HEAT_SELECTOR,
  PLAYER_POPUP_PROTECTION_SELECTOR,
  PLAYER_POPUP_GANG_SELECTOR,
  PLAYER_POPUP_ALLIANCE_SELECTOR,
  PLAYER_POPUP_DISTRICTS_SELECTOR,
  ALLIANCE_POPUP_OPEN_SELECTOR,
  ALLIANCE_POPUP_SELECTOR,
  ALLIANCE_POPUP_CLOSE_SELECTOR,
  STORAGE_POPUP_OPEN_SELECTOR,
  STORAGE_POPUP_SELECTOR,
  STORAGE_POPUP_CLOSE_SELECTOR,
  PHARMACY_POPUP_OPEN_SELECTOR,
  PHARMACY_POPUP_SELECTOR,
  PHARMACY_POPUP_CLOSE_SELECTOR,
  DRUGLAB_POPUP_OPEN_SELECTOR,
  DRUGLAB_POPUP_SELECTOR,
  DRUGLAB_POPUP_CLOSE_SELECTOR,
  FACTORY_POPUP_OPEN_SELECTOR,
  FACTORY_POPUP_SELECTOR,
  FACTORY_POPUP_CLOSE_SELECTOR,
  FACTORY_LEVEL_SELECTOR,
  FACTORY_HEADER_LEVEL_SELECTOR,
  FACTORY_MULTIPLIER_SELECTOR,
  FACTORY_OWNED_COUNT_SELECTOR,
  FACTORY_UPGRADE_COST_SELECTOR,
  FACTORY_RESOURCE_METAL_SELECTOR,
  FACTORY_RESOURCE_TECH_SELECTOR,
  FACTORY_RESOURCE_COMBAT_SELECTOR,
  FACTORY_SUPPLY_METAL_SELECTOR,
  FACTORY_SUPPLY_TECH_SELECTOR,
  FACTORY_SUPPLY_COMBAT_SELECTOR,
  FACTORY_SLOT_LIST_SELECTOR,
  FACTORY_EFFECTS_LABEL_SELECTOR,
  FACTORY_UPGRADE_SELECTOR,
  FACTORY_COLLECT_SELECTOR,
  FACTORY_TAB_SELECTOR,
  FACTORY_PANEL_SELECTOR,
  ARMORY_POPUP_OPEN_SELECTOR,
  ARMORY_POPUP_SELECTOR,
  ARMORY_POPUP_CLOSE_SELECTOR,
  PRODUCTION_BUILDING_TAB_SELECTOR,
  PRODUCTION_BUILDING_PANEL_SELECTOR,
  PRODUCTION_BUILDING_LEVEL_SELECTOR,
  PRODUCTION_BUILDING_HEADER_LEVEL_SELECTOR,
  PRODUCTION_BUILDING_MULTIPLIER_SELECTOR,
  PRODUCTION_BUILDING_READY_SELECTOR,
  PRODUCTION_BUILDING_UPGRADE_COST_SELECTOR,
  PRODUCTION_BUILDING_EFFECTS_SELECTOR,
  PRODUCTION_BUILDING_COLLECT_SELECTOR,
  PRODUCTION_BUILDING_UPGRADE_SELECTOR,
  PRODUCTION_BUILDING_INFO_TEXT_SELECTOR,
  PRODUCTION_BUILDING_INFO_EFFECTS_SELECTOR,
  PRODUCTION_BUILDING_INFO_ACTIONS_SELECTOR,
  ATTACK_SETUP_POPUP_SELECTOR,
  ATTACK_SETUP_CARD_SELECTOR,
  ATTACK_SETUP_CLOSE_SELECTOR,
  ATTACK_SETUP_ATMOSPHERE_IMAGE_SELECTOR,
  ATTACK_SETUP_ATMOSPHERE_LABEL_SELECTOR,
  ATTACK_TARGET_TITLE_SELECTOR,
  ATTACK_SOURCE_SELECT_SELECTOR,
  ATTACK_AVAILABLE_POPULATION_SELECTOR,
  ATTACK_REQUIRED_POPULATION_SELECTOR,
  ATTACK_ESTIMATED_POWER_SELECTOR,
  ATTACK_STATUS_SELECTOR,
  ATTACK_WEAPON_INPUT_SELECTOR,
  ATTACK_OWNED_SELECTOR,
  ATTACK_CONFIRM_SELECTOR,
  ATTACK_CONFIRM_POPUP_SELECTOR,
  ATTACK_CONFIRM_CARD_SELECTOR,
  ATTACK_CONFIRM_CLOSE_SELECTOR,
  ATTACK_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR,
  ATTACK_CONFIRM_ATMOSPHERE_LABEL_SELECTOR,
  ATTACK_CONFIRM_TITLE_SELECTOR,
  ATTACK_CONFIRM_SOURCE_SELECTOR,
  ATTACK_CONFIRM_MEMBERS_SELECTOR,
  ATTACK_CONFIRM_POWER_SELECTOR,
  ATTACK_CONFIRM_SCENARIO_SELECTOR,
  ATTACK_CONFIRM_DURATION_SELECTOR,
  ATTACK_CONFIRM_NOTE_SELECTOR,
  ATTACK_CONFIRM_BUTTON_SELECTOR,
  ROBBERY_SETUP_POPUP_SELECTOR,
  ROBBERY_SETUP_CARD_SELECTOR,
  ROBBERY_SETUP_CLOSE_SELECTOR,
  ROBBERY_SETUP_ATMOSPHERE_IMAGE_SELECTOR,
  ROBBERY_SETUP_ATMOSPHERE_LABEL_SELECTOR,
  ROBBERY_TARGET_TITLE_SELECTOR,
  ROBBERY_SOURCE_SELECT_SELECTOR,
  ROBBERY_AVAILABLE_MEMBERS_SELECTOR,
  ROBBERY_MEMBER_INPUT_SELECTOR,
  ROBBERY_STATUS_SELECTOR,
  ROBBERY_CONFIRM_SELECTOR,
  ROBBERY_CONFIRM_POPUP_SELECTOR,
  ROBBERY_CONFIRM_CARD_SELECTOR,
  ROBBERY_CONFIRM_CLOSE_SELECTOR,
  ROBBERY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR,
  ROBBERY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR,
  ROBBERY_CONFIRM_TITLE_SELECTOR,
  ROBBERY_CONFIRM_SOURCE_SELECTOR,
  ROBBERY_CONFIRM_MEMBERS_SELECTOR,
  ROBBERY_CONFIRM_DURATION_SELECTOR,
  ROBBERY_CONFIRM_NOTE_SELECTOR,
  ROBBERY_CONFIRM_BUTTON_SELECTOR,
  DEFENSE_SETUP_POPUP_SELECTOR,
  DEFENSE_SETUP_CARD_SELECTOR,
  DEFENSE_SETUP_CLOSE_SELECTOR,
  DEFENSE_SETUP_ATMOSPHERE_IMAGE_SELECTOR,
  DEFENSE_SETUP_ATMOSPHERE_LABEL_SELECTOR,
  DEFENSE_TARGET_TITLE_SELECTOR,
  DEFENSE_STATUS_SELECTOR,
  DEFENSE_ESTIMATED_POWER_SELECTOR,
  DEFENSE_WEAPON_INPUT_SELECTOR,
  DEFENSE_OWNED_SELECTOR,
  DEFENSE_RESIDENTS_INPUT_SELECTOR,
  DEFENSE_CONFIRM_SELECTOR,
  TRAP_CONFIRM_POPUP_SELECTOR,
  TRAP_CONFIRM_CARD_SELECTOR,
  TRAP_CONFIRM_CLOSE_SELECTOR,
  TRAP_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR,
  TRAP_CONFIRM_ATMOSPHERE_LABEL_SELECTOR,
  TRAP_CONFIRM_TITLE_SELECTOR,
  TRAP_CONFIRM_COOLDOWN_SELECTOR,
  TRAP_CONFIRM_NOTE_SELECTOR,
  TRAP_CONFIRM_BUTTON_SELECTOR,
  SPY_CONFIRM_POPUP_SELECTOR,
  SPY_CONFIRM_CARD_SELECTOR,
  SPY_CONFIRM_CLOSE_SELECTOR,
  SPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR,
  SPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR,
  SPY_CONFIRM_TITLE_SELECTOR,
  SPY_CONFIRM_SOURCE_SELECTOR,
  SPY_CONFIRM_AVAILABLE_SELECTOR,
  SPY_CONFIRM_DURATION_SELECTOR,
  SPY_CONFIRM_NOTE_SELECTOR,
  SPY_CONFIRM_BUTTON_SELECTOR,
  OCCUPY_CONFIRM_POPUP_SELECTOR,
  OCCUPY_CONFIRM_CARD_SELECTOR,
  OCCUPY_CONFIRM_CLOSE_SELECTOR,
  OCCUPY_CONFIRM_ATMOSPHERE_IMAGE_SELECTOR,
  OCCUPY_CONFIRM_ATMOSPHERE_LABEL_SELECTOR,
  OCCUPY_CONFIRM_TITLE_SELECTOR,
  OCCUPY_CONFIRM_SOURCE_SELECTOR,
  OCCUPY_CONFIRM_CONDITION_SELECTOR,
  OCCUPY_CONFIRM_COST_SELECTOR,
  OCCUPY_CONFIRM_DURATION_SELECTOR,
  OCCUPY_CONFIRM_NOTE_SELECTOR,
  OCCUPY_CONFIRM_BUTTON_SELECTOR,
  SPY_RESULT_MODAL_SELECTOR,
  SPY_RESULT_MODAL_BACKDROP_SELECTOR,
  SPY_RESULT_MODAL_CLOSE_SELECTOR,
  SPY_RESULT_MODAL_OK_SELECTOR,
  SPY_RESULT_MODAL_CONTENT_SELECTOR,
  SPY_RESULT_MODAL_TITLE_SELECTOR,
  SPY_RESULT_MODAL_SUMMARY_SELECTOR,
  SPY_RESULT_MODAL_DETAILS_SELECTOR,
  SPY_WARNING_MODAL_SELECTOR,
  SPY_WARNING_MODAL_BACKDROP_SELECTOR,
  SPY_WARNING_MODAL_CLOSE_SELECTOR,
  SPY_WARNING_MODAL_OK_SELECTOR,
  SPY_WARNING_MODAL_CONTENT_SELECTOR,
  SPY_WARNING_MODAL_TITLE_SELECTOR,
  SPY_WARNING_MODAL_BADGE_SELECTOR,
  SPY_WARNING_MODAL_SUMMARY_SELECTOR,
  SPY_WARNING_MODAL_DETAILS_SELECTOR,
  RAID_RESULT_MODAL_SELECTOR,
  RAID_RESULT_MODAL_BACKDROP_SELECTOR,
  RAID_RESULT_MODAL_CLOSE_SELECTOR,
  RAID_RESULT_MODAL_OK_SELECTOR,
  RAID_RESULT_MODAL_CONTENT_SELECTOR,
  RAID_RESULT_MODAL_TITLE_SELECTOR,
  RAID_RESULT_MODAL_SUMMARY_SELECTOR,
  RAID_RESULT_MODAL_DETAILS_SELECTOR,
  ATTACK_RESULT_MODAL_SELECTOR,
  ATTACK_RESULT_MODAL_BACKDROP_SELECTOR,
  ATTACK_RESULT_MODAL_CLOSE_SELECTOR,
  ATTACK_RESULT_MODAL_OK_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_OK_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR,
  CITY_CLOCK_SELECTOR,
  CITY_DAY_PHASE_SELECTOR,
  CITY_GAME_PHASE_SELECTOR,
  CITY_STATUS_SELECTOR,
  CITY_PRODUCTION_SELECTOR,
  DAY_MAP_IMAGE_PATH,
  NIGHT_MAP_IMAGE_PATH
} from "./runtime/constants.js";
import {
  formatCurrency,
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney,
  formatDistrictHeatLabel,
  formatDistrictIncomeLabel,
  formatDistrictInfluenceLabel,
  formatDistrictMetricNumber,
  formatDistrictMoneyAmount
} from "./runtime/formatters.js";
import { DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME } from "./runtime/buildingDisplayData.js";
import {
  DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME,
  DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME
} from "./runtime/buildingBackgroundData.js";
import {
  applyHexAlpha,
  clamp,
  createSeededRandom,
  hashCell,
  hexToRgbParts,
  normalizeRuntimeHexColor,
  resolveRuntimeAssetUrl
} from "./runtime/utils.js";
import { initRuntimeCompatibilityGlobals } from "./runtime/compatibility.js";
import {
  MARKET_BLACK_HEAT_BY_VALUE,
  MARKET_PLAYER_LISTING_LIMIT,
  MARKET_PLAYER_OWN_LISTING_LIMIT,
  MARKET_PLAYER_SELLER_ID,
  MARKET_PLAYER_TAB_ID,
  MARKET_PLAYER_LISTING_TTL_MS
} from "./runtime/marketData.js";
import {
  createDefaultMarketPriceState as createDefaultMarketPriceStatePayload,
  createDefaultPlayerMarketListings as createDefaultPlayerMarketListingsPayload,
  getMarketServerScope as getMarketServerScopePayload,
  getMarketStockConfig,
  getMarketStockKey,
  getPlayerMarketCatalog,
  isMarketPriceStatePayload,
  normalizeMarketServerId,
  normalizeMarketStockState,
  normalizeMarketTradeState as normalizeMarketTradeStatePayload,
  normalizeMarketTransactions,
  normalizePlayerMarketListings as normalizePlayerMarketListingsPayload,
  withMarketServerId
} from "./runtime/marketState.js";
import {
  ATTACK_WEAPON_IDS,
  ATTACK_WEAPON_LABELS,
  DEFENSE_WEAPON_IDS,
  SPY_CAPTURE_COOLDOWN_MS
} from "./runtime/combatData.js";
import {
  GANG_HEAT_AUTO_POLICE_INTERVAL_BY_TIER,
  GANG_HEAT_CLEAN_COST,
  GANG_HEAT_CLEAN_REDUCTION,
  GANG_HEAT_DECAY_BY_TIER,
  GANG_HEAT_DIRTY_COST,
  GANG_HEAT_DIRTY_REDUCTION,
  GANG_HEAT_DIRTY_TRIGGER_COUNT,
  GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS,
  GANG_HEAT_INFLUENCE_COST,
  GANG_HEAT_INFLUENCE_REDUCTION,
  GANG_HEAT_JOURNAL_LIMIT,
  GANG_HEAT_POLICE_DURATION_MS,
  GANG_HEAT_RAID_PROTECTION_MS,
  GANG_HEAT_TIERS
} from "./runtime/heatData.js";
import {
  PRODUCTION_BUILDING_CONFIG,
  PRODUCTION_RESOURCE_LABELS,
  PRODUCTION_SLOT_VISUALS
} from "./runtime/productionBuildingData.js";
import {
  DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2,
  DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2,
  DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DISTRICT_MINUTE_INCOME_RULES_EMPIRE2,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  formatDistrictBuildingTierLabel
} from "./runtime/districtBuildingData.js";
import {
  APARTMENT_BLOCK_BASE_CAPACITY,
  APARTMENT_BLOCK_MIN_COLLECT_POPULATION,
  APARTMENT_BLOCK_NETWORK_CONFIG,
  APARTMENT_BLOCK_POPULATION_PER_MINUTE,
  ARCADE_BASE_AUDIT_RISK_PCT,
  ARCADE_BASE_LAUNDERING_CAPACITY,
  ARCADE_NETWORK_CONFIG,
  AUTO_SALON_SUPPORT_CONFIG,
  BUILDING_POPUP_TARGETS,
  CASINO_DETAIL_BASE_LAUNDERING_CAPACITY,
  CASINO_DETAIL_BASE_LAUNDERING_FEE_PCT,
  CASINO_DETAIL_MAX_LEVEL,
  CASINO_DETAIL_UPGRADES,
  CLINIC_BASE_RECOVERY_RATE_PCT,
  CLINIC_MAX_RECOVERY_RATE_PCT,
  CLINIC_POOL_TTL_MS,
  CLINIC_RARE_ITEMS,
  CLINIC_RECOVERABLE_ITEMS,
  CLINIC_RECOVERY_RATE_PCT_PER_EXTRA,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS,
  DISTRICT_BUILDING_DETAIL_DEFAULT_ACCRUAL_MS,
  DISTRICT_BUILDING_DETAIL_MAX_LEVEL,
  DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES,
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES,
  EXCHANGE_OFFICE_BASE_AUDIT_RISK_PCT,
  EXCHANGE_OFFICE_BASE_LAUNDERING_CAPACITY,
  EXCHANGE_OFFICE_NETWORK_CONFIG,
  FITNESS_CLUB_SUPPORT_CONFIG,
  GARAGE_SUPPORT_CONFIG,
  POWER_STATION_CONFIG,
  RECYCLING_CENTER_CONFIG,
  RECRUITMENT_CENTER_SUPPORT_CONFIG,
  RESTAURANT_NETWORK_CONFIG,
  SCHOOL_CONFIG,
  SHOPPING_MALL_NETWORK_CONFIG,
  SMUGGLING_TUNNEL_CONFIG,
  WAREHOUSE_NETWORK_CONFIG
} from "./runtime/buildingDetailData.js";
import {
  getBuildingSpecialActionCooldownUntil,
  getRecyclingSalvagePoolView,
  hasLegacyBuildingSpecialActionHandler,
  resolveBuildingSpecialActionDefinition
} from "./runtime/buildingSpecialActionRegistry.js";
import { createServerBuildingActionDefaultPayload } from "./runtime/buildingSpecialActionServerDefaults.js";
import { submitServerBuildingActionCommandBridge } from "./runtime/buildingSpecialActionServerBridge.js";
import { createBuildingSpecialActionConfirmationController } from "./runtime/buildingSpecialActionConfirmation.js";
import {
  formatGarageEffectiveCooldownLabel,
  resolveAutoSalonCategoryForBuildingAction,
  resolveCombinedEffectiveCooldownMs,
  resolveGarageCategoryForBuildingAction
} from "./runtime/garageCooldownRuntime.js";
import {
  resolvePhaseLockedBuildingActionDisabledReason
} from "./runtime/dayNightActionPhaseRuntime.js";
import { createBuildingUpgradeConfirmationViewModel } from "./runtime/buildingUpgradeBenefits.js";
import {
  DISTRICT_GOSSIP_SEED_LIBRARY,
  POLICE_ACTION_SPECIALTY_QUOTES,
  POLICE_ACTION_TIER_MESSAGES,
  POLICE_ACTION_TIER_QUOTES,
  POLICE_DISTRICT_CLICK_WARNING_QUOTES,
  POLICE_OPERATION_TYPES,
  POLICE_RAID_SPECIALTIES,
  POLICE_SPECIALTY_RANDOM_WEIGHTS,
  SPY_ALLIANCE_DETECTION_WARNING_QUOTES,
  SPY_DETECTION_WARNING_QUOTES,
  SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES,
  SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES,
  SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES,
  SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES,
  SPY_SUCCESS_EMPTY_DISTRICT_QUOTES,
  SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES
} from "./runtime/narrativeData.js";
import {
  clearNotifications,
  showError,
  showExistingToast,
  showInfo,
  renderNotificationList,
  showSuccess,
  showToast,
  showWarning
} from "./ui/notifications.js";
import {
  renderHeatBadge,
  renderWantedFeedback,
  renderWantedPanel
} from "./ui/wantedPanel.js";
import { createRuntimePopupBinders } from "./ui/runtimePopupBinders.js";
import { replaceListItems, renderAuthStatus, renderFactionPreviewPanel } from "./ui/authPanel.js";
import {
  renderResourcesPanel as renderResourcesPanelUi,
  bindTopbarMoneySkipControls as bindTopbarMoneySkipControlsUi,
  renderStorageList,
  updateTopbarResources
} from "./ui/resourcesPanel.js";
import { renderBattleReport as renderBattleReportPanel } from "./ui/battleReportPanel.js";
import { renderSimpleResultModal } from "./ui/resultModalPanel.js";
import { createResultModalQueue } from "./ui/resultModalQueue.js";
import { renderPoliceActionResultPanel } from "./ui/policeActionResultPanel.js";
import {
  closeAttackPanel,
  openAttackPanel,
  renderAttackConfirmPanel,
  renderAttackPanel,
  renderAttackProgress
} from "./ui/attackPanel.js";
import {
  closeSpyPanel,
  openSpyPanel,
  renderSpyPanel,
  renderSpyWarningPanel
} from "./ui/spyPanel.js";
import { bindOverflowTextTooltips } from "./ui/overflowTextTooltips.js";
import {
  renderDistrictBuildingList,
  renderDistrictFlags,
  renderDistrictMetricSummary
} from "./ui/districtPanel.js";
import {
  createDistrictActionConfirmationPanelElements,
  resolveOccupyPopulationCostForOwnedCount
} from "./ui/districtActionConfirmationPanel.js";
import { renderDistrictActionHub } from "./ui/districtActionHub.js";
import { renderSelectedDistrictSummary } from "./ui/selectedDistrictSummary.js";
import {
  closeMarketPanel,
  formatMarketPrice,
  getMarketMoneyLabel,
  openMarketPanel,
  renderBlackMarketPanel,
  renderMarketDashboard,
  renderMarketPanel,
  renderPlayerMarketPanel,
  setMarketFeedback as renderMarketFeedback,
  syncMarketTabs
} from "./ui/marketPanel.js";
import {
  renderBuildingActionRows,
  renderBuildingsPopupDetail as renderBuildingsPopupDetailPanel,
  renderBuildingsPopupTypes as renderBuildingsPopupTypesPanel
} from "./ui/buildingPanel.js";
import {
  ensureBuildingDetailPanel,
  renderBuildingDetailPanel,
  renderBuildingDetailInfoSection as renderBuildingDetailInfoSectionPanel,
  syncBuildingDetailTabs as syncBuildingDetailPanelTabs
} from "./ui/buildingDetailPanel.js";
import { getDistrictPopupElements } from "./ui/districtPopupElements.js";
import {
  bindDistrictAtmosphereWindowControls,
  bindDistrictPopupPresentationControls,
  closeDistrictAtmosphereWindow,
  createDistrictPopupModalClosers,
  createDistrictResultModalClosers,
  hasActiveDistrictPopupModal,
  hideDistrictPopupModal,
  hideDistrictPopupModalStack,
  showDistrictPopupModal
} from "./ui/districtPopupModalHelpers.js";
import {
  closeOverlay,
  isOverlayOpen,
  shouldSuppressMapInput
} from "./ui/legacyOverlayCoordinator.js";
import {
  collectMounts as collectMountsUi,
  createPageContext as createPageContextUi,
  markMounts as markMountsUi
} from "./ui/pageContext.js";
import { createBuildingDetailViewModel } from "./runtime/buildingDetailViewModel.js";
import { createBuildingDetailInfoViewModel } from "./runtime/buildingDetailInfoViewModel.js";
import { createPlayerProfileViewModel } from "./runtime/playerProfileViewModel.js";
import {
  createLaunchPlayerColorMap,
  getFactionGlyph,
  getRegistrationAccentColor,
  normalizeLaunchPlayerPaletteColor
} from "./runtime/playerIdentityVisuals.js";
import { createLaunchPlayerRuntime } from "./runtime/launchPlayerRuntime.js";
import { createAuthoritySessionAccessors } from "./runtime/authoritySessionAccessors.js";
import { createDistrictBuildingProfileRuntime } from "./runtime/districtBuildingProfileRuntime.js";
import { createBuildingNetworkRuntime } from "./runtime/buildingNetworkRuntime.js";
import { createDistrictActionPanelRuntime } from "./runtime/districtActionPanelRuntime.js";
import {
  TRAP_MOVE_LOCK_MS,
  createDistrictPopupMetricsRuntime
} from "./runtime/districtPopupMetricsRuntime.js";
import { createBuildingsPopupRuntime } from "./runtime/buildingsPopupRuntime.js";
import { createBuildingActionStatusRuntime } from "./runtime/buildingActionStatusRuntime.js";
import { createRegisteredPlayerStateRuntime } from "./runtime/registeredPlayerStateRuntime.js";
import { createGangWantedStatusRuntime } from "./runtime/gangWantedStatusRuntime.js";
import { createCityStatusBarRuntime } from "./runtime/cityStatusBarRuntime.js";
import {
  bindEliminationCountdownWarning,
  bindEliminationPurgePanel,
  bindEliminationResultPopup
} from "./runtime/eliminationPurgePanelRuntime.js";
import { createPhaseToggleRuntime } from "./runtime/phaseToggleRuntime.js";
import { createProductionBuildingPopupRuntime } from "./runtime/productionBuildingPopupRuntime.js";
import { createFactoryPopupRuntime } from "./runtime/factoryPopupRuntime.js";
import {
  advanceLocalProductionJob,
  collectLocalProduction,
  normalizeLocalProductionJob
} from "./runtime/localProductionLineState.js";
import { createBuildingUpgradeConfirmationController } from "./runtime/buildingUpgradeConfirmation.js";
import { createResultModalRuntime } from "./runtime/resultModalRuntime.js";
import { createMarketPopupRuntime } from "./runtime/marketPopupRuntime.js";
import { createAuthRegistrationRuntime } from "./runtime/authRegistrationRuntime.js";
import {
  createDistrictGossipRuntime,
  formatDistrictGossipTimestamp,
  formatDistrictReference,
  normalizeDistrictGossipKey,
  resolveDistrictNumericId
} from "./runtime/districtGossipRuntime.js";
import {
  applyPercentageLoss,
  clampGangHeat,
  clampGangInfluence,
  formatGangHeatProtectionLabel as formatGangHeatProtectionLabelHelper,
  normalizeGangHeatJournal,
  resolveGangHeatTier,
  resolvePoliceOperationType,
  resolvePoliceSpecialty,
  resolveRandomPoliceOperationType,
  resolveRandomPoliceSpecialtyKey,
  summarizePenaltyEntries
} from "./runtime/gangHeatPoliceHelpers.js";
import {
  createResultPayloadBuilders
} from "./runtime/resultPayloadBuilders.js";
import { createCompletedRegistrationStatusViewModel, createExistingRegistrationViewModel, createFactionPreviewViewModel, createLockedRegistrationStatusViewModel } from "./runtime/authRegistrationViewModel.js";
import { createMarketCopy, createMarketDashboardViewModel, createMarketTradeStateViewModel, getSuggestedPlayerMarketUnitPrice } from "./runtime/marketViewModel.js";
import {
  createMarketCatalogCallbacks,
  createMarketTransaction,
  createPlayerMarketCallbacks,
  getMarketListingTotal
} from "./runtime/marketActionOrchestrator.js";
import {
  createMarketDashboardAdapter,
  getMarketStockAmount,
  getMarketStockLabel,
  getMarketStockPercent,
  getMarketMaxStock,
  resolveMarketHeatRiskByValue
} from "./runtime/marketStockViewModel.js";
import {
  createMarketCatalogPanelPayload,
  createPlayerMarketPanelPayload
} from "./runtime/marketPopupViewModel.js";
import {
  renderFactoryBuildingInfo as renderFactoryBuildingInfoPanel,
  renderServerFactorySlotList,
  renderFactorySlotList,
  renderProductionBuildingInfo as renderProductionBuildingInfoPanel,
  renderProductionPanel as renderProductionPanelUi
} from "./ui/productionPanel.js";
import { renderFactoryDashboardPanel } from "./ui/factoryPanel.js";
import { buildFactoryDashboardViewModel } from "./runtime/factoryViewModel.js";
import {
  createFactoryBuildingInfoViewModel,
  createProductionBuildingInfoViewModel,
  getProductionBuildingEffectsLabel
} from "./runtime/productionInfoViewModel.js";
import { normalizeActionResult } from "./runtime/actionResultOrchestrator.js";
import { createOnboardingBridge } from "./runtime/onboardingBridge.js";
import { createPoliceHeatBridge, resolvePoliceHeatFeedback } from "./runtime/policeHeatBridge.js";
import { createEventRumorBridge, createRumorStreetNewsPayload } from "./runtime/eventRumorBridge.js";
import { renderRecipeCard } from "./ui/recipePanel.js";
import {
  getActionDescription,
  getActionDisabledReason,
  getActionIcon,
  getActionLabel,
  getBuildingActionUi,
  formatBuildingActionOutputProfile,
  formatBuildingActionRiskProfile
} from "./ui/buildingActionUiRegistry.js";
import {
  cloneBuildingActionResultPayload,
  renderBuildingActionResult
} from "./ui/buildingActionResultPanel.js";
import {
  BUILDING_ACTION_EMPTY_SNAPSHOT,
  createBuildingActionEntry,
  createBuildingActionFeedItemElement,
  createBuildingActionFingerprint,
  isBuildingActionEntryOpenable,
  normalizeBuildingActionSnapshot
} from "./ui/eventFeedPanel.js";
import { renderPlayerProfilePanel } from "./ui/playerProfilePanel.js";
import {
  GAMEPLAY_EXECUTION_MODES,
  getGameplayExecutionMode
} from "./runtime/gameplayExecutionMode.js";
// Legacy static-page preview runtime; browser-local only when no server authority is present.
const BUILDING_ACTION_LOG_LIMIT = 30;
const MONEY_STAT_COUNT_TICK_MS = 26;
const CITY_CLOCK_MINUTES_PER_TICK = 1;
// 720 game minutes (06:00-18:00) must take 2 real hours, so one game minute advances every 10 seconds.
const CITY_CLOCK_TICK_MS = 10 * 1000;
const DEFAULT_CITY_MINUTES = 5 * 60 + 55;
const DISTRICT_GOSSIP_MAX_PER_DISTRICT = 2;
const buildingActionPanels = new WeakMap();
const attackMissionTimers = new Map();
const occupyMissionTimers = new Map();
const robberyMissionTimers = new Map();

function hasValidatedServerGameplaySlice() {
  return Boolean(
    latestGameplaySliceReadModel?.player?.playerId
    && latestGameplaySliceReadModel?.player?.instanceId
  );
}

function isServerAuthoritativeGameplayRuntimeReady() {
  if (typeof document === "undefined" || !hasValidatedServerGameplaySlice()) {
    return false;
  }

  const selectedMode = getGameplayExecutionMode({
    diagnosticsMode: getRuntimePerformanceDiagnostics()?.getSummary?.().runtimeMode,
    serverReady: false,
    windowRef: typeof window === "undefined" ? null : window
  });
  return selectedMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
}
const spyMissionTimers = new Map();
const ONBOARDING_ATTACK_TARGET_DISTRICT_ID = 1;
const ONBOARDING_SPY_TARGET_DISTRICT_ID = 2;
const ONBOARDING_TRAP_READY_TIMESTAMP = "2020-01-01T00:00:00.000Z";
const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const productionTimers = new Map();
let policeActionResultLiveTimerId = null;
let devOnlyPoliceNextActionAt = 0;
let devOnlyPoliceLastTargetPlayerId = null;
let startPhaseResourceSimulationState = null;
let districtGossipRuntime = null;
let resultPayloadBuilders = null;
let settingsStateRuntime = null;
let launchPlayerRuntime = null;
const runtimeInitializedRoots = new WeakSet();
const runtimeUiBoundRoots = new WeakSet();
const runtimeContextsByRoot = new WeakMap();
const onboardingBridgesByRoot = new WeakMap();
const policeHeatBridgesByRoot = new WeakMap();
const eventRumorBridgesByRoot = new WeakMap();
const eliminationPurgePanelsByRoot = new WeakMap();
const eliminationResultPopupsByRoot = new WeakMap();
const eliminationCountdownWarningsByRoot = new WeakMap();
const ELIMINATION_RESULT_POPUP_SELECTOR = "[data-elimination-result-popup]";
let latestGameplaySliceReadModel = null;

function getRuntimePerformanceDiagnostics() {
  return typeof window === "undefined" ? null : window.empireStreetsRuntimeDiagnostics || null;
}

function getCurrentGameplayExecutionMode() {
  return getGameplayExecutionMode({
    diagnosticsMode: getRuntimePerformanceDiagnostics()?.getSummary?.().runtimeMode,
    serverReady: isServerAuthoritativeGameplayRuntimeReady(),
    windowRef: typeof window === "undefined" ? null : window
  });
}

function isLocalDemoGameplayExecutionMode() {
  return getCurrentGameplayExecutionMode() === GAMEPLAY_EXECUTION_MODES.localDemo;
}

function shouldRunLocalGameplayRuntime() {
  const diagnostics = getRuntimePerformanceDiagnostics();
  if (diagnostics?.shouldRunLocalTick) {
    return diagnostics.shouldRunLocalTick();
  }
  return isLocalDemoGameplayExecutionMode();
}

function stopLegacyGameplayTimers() {
  for (const timers of [attackMissionTimers, occupyMissionTimers, robberyMissionTimers, spyMissionTimers, productionTimers]) {
    for (const timerId of timers.values()) {
      window.clearTimeout?.(timerId);
    }
    timers.clear();
  }
}

function getServerMarketReadModel() {
  return isServerAuthoritativeGameplayRuntimeReady()
    ? latestGameplaySliceReadModel?.market || null
    : null;
}

function getServerPlayerView() {
  return isServerAuthoritativeGameplayRuntimeReady()
    ? latestGameplaySliceReadModel?.player || null
    : null;
}

function getServerAttackWeaponSetup() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const weapons = latestGameplaySliceReadModel?.player?.attackWeapons?.weapons;
  if (!Array.isArray(weapons) || weapons.length === 0) {
    return null;
  }
  return Object.fromEntries(weapons.map((weapon) => [
    weapon.resourceKey,
    {
      power: Math.max(0, Number(weapon.baseAttackPower) || 0),
      residents: Math.max(0, Number(weapon.populationRequired) || 0),
      label: String(weapon.label || ""),
      description: String(weapon.description || "")
    }
  ]));
}

function getAttackSetupWeapons() {
  return getServerAttackWeaponSetup() || ATTACK_SETUP_WEAPONS;
}

function getAttackWeaponLabels() {
  const serverSetup = getServerAttackWeaponSetup();
  if (!serverSetup) {
    return ATTACK_WEAPON_LABELS;
  }
  return Object.fromEntries(Object.entries(serverSetup).map(([weaponId, weapon]) => [
    weaponId,
    weapon.label || ATTACK_WEAPON_LABELS[weaponId] || weaponId
  ]));
}

function getServerPharmacyReadModel() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const district = latestGameplaySliceReadModel?.district;
  const building = district?.buildings?.find?.((candidate) => candidate?.buildingTypeId === "pharmacy" && candidate?.pharmacy);
  if (!building?.pharmacy || !district?.districtId) {
    return null;
  }
  return {
    ...building.pharmacy,
    districtId: district.districtId,
    level: building.level
  };
}

function getServerDrugLabReadModel() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const district = latestGameplaySliceReadModel?.district;
  const building = district?.buildings?.find?.((candidate) => candidate?.buildingTypeId === "drug_lab" && candidate?.drugLab);
  if (!building?.drugLab || !district?.districtId) {
    return null;
  }
  return {
    ...building.drugLab,
    districtId: district.districtId,
    level: building.level,
    cleanCashAmount: Math.max(0, Number(latestGameplaySliceReadModel?.player?.resourceBalances?.cash || 0))
  };
}

function getServerFactoryReadModel() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const playerFactory = latestGameplaySliceReadModel?.player?.factoryProduction;
  if (playerFactory?.buildingId && playerFactory?.districtId && Array.isArray(playerFactory.productionLines)) {
    return playerFactory;
  }
  const district = latestGameplaySliceReadModel?.district;
  const building = district?.buildings?.find?.((candidate) => candidate?.buildingTypeId === "factory" && candidate?.factory);
  if (!building?.factory || !district?.districtId) {
    return null;
  }
  return {
    ...building.factory,
    districtId: district.districtId,
    buildingId: building.factory.buildingId || building.buildingId,
    level: building.level
  };
}

function getServerTickRateMs() {
  return Math.max(1, Number(latestGameplaySliceReadModel?.mode?.tickRateMs || 5000));
}

function submitServerPharmacyCommand({ type, payload } = {}) {
  return submitServerDistrictActionCommand({
    type,
    payload,
    focusDistrictId: payload?.districtId || latestGameplaySliceReadModel?.district?.districtId
  });
}

function submitServerDrugLabCommand({ type, payload } = {}) {
  return submitServerDistrictActionCommand({
    type,
    payload,
    focusDistrictId: payload?.districtId || latestGameplaySliceReadModel?.district?.districtId
  });
}

function getServerArmoryReadModel() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const district = latestGameplaySliceReadModel?.district;
  const building = district?.buildings?.find?.((candidate) => candidate?.buildingTypeId === "armory" && candidate?.armory);
  if (!building?.armory || !district?.districtId) {
    return null;
  }
  return {
    ...building.armory,
    districtId: district.districtId,
    buildingId: building.armory.buildingId || building.buildingId,
    level: building.level
  };
}

function submitServerFactoryCommand({ type, payload } = {}) {
  return submitServerDistrictActionCommand({
    type,
    payload,
    focusDistrictId: payload?.districtId || latestGameplaySliceReadModel?.district?.districtId
  });
}

function submitServerArmoryCommand({ type, payload } = {}) {
  return submitServerDistrictActionCommand({
    type,
    payload,
    focusDistrictId: payload?.districtId || latestGameplaySliceReadModel?.district?.districtId
  });
}

function createGameplaySliceCommandId(prefix = "command:market") {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

async function submitServerDistrictActionCommand({ type, payload, focusDistrictId } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return { accepted: false, errors: [{ message: "Serverový herní stav ještě není načtený." }] };
  }
  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  if (!slice || !player?.playerId || !player?.instanceId) {
    return { accepted: false, errors: [{ message: "Chybí serverový kontext pro herní akci." }] };
  }
  const request = {
    command: {
      id: createGameplaySliceCommandId(`command:${String(type || "district-action")}`),
      type,
      mode: player.mode || slice.mode?.mode || "free",
      playerId: player.playerId,
      serverInstanceId: player.instanceId,
      issuedAt: new Date().toISOString(),
      payload: payload || {},
      clientRequestId: null
    },
    focusDistrictId: focusDistrictId || slice?.district?.districtId || player.homeDistrictId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) request.snapshotToken = snapshotToken;
  try {
    const response = await fetch(`${getGameplaySliceEndpointBase()}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(request)
    });
    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      body = null;
    }
    if (!response.ok || !body || typeof body !== "object") {
      return {
        accepted: false,
        errors: [{ message: "Server akci se nepodařilo odeslat." }]
      };
    }
    syncGameplaySliceResponse(body);
    return body;
  } catch (_error) {
    return {
      accepted: false,
      errors: [{ message: "Server akci se nepodařilo odeslat." }]
    };
  }
}

function getGameplaySliceEndpointBase() {
  const root = typeof document === "undefined"
    ? null
    : document.querySelector?.("[data-gameplay-slice-client]");
  return String(root?.dataset?.gameplaySliceEndpointBase || "/api/gameplay-slice").replace(/\/+$/u, "");
}

function getGameplaySliceSnapshotToken(serverInstanceId, playerId) {
  try {
    return window.sessionStorage?.getItem?.(`empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}`) || null;
  } catch (_error) {
    return null;
  }
}

function setGameplaySliceSnapshotToken(serverInstanceId, playerId, token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return false;
  }
  try {
    window.sessionStorage?.setItem?.(`empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}`, normalizedToken);
    return true;
  } catch (_error) {
    return false;
  }
}

function syncGameplaySliceResponse(response) {
  const player = latestGameplaySliceReadModel?.player || null;
  const responsePlayer = response?.readModel?.player || player;
  if (response?.snapshotToken && responsePlayer?.instanceId && responsePlayer?.playerId) {
    setGameplaySliceSnapshotToken(responsePlayer.instanceId, responsePlayer.playerId, response.snapshotToken);
  }
  if (response?.readModel) {
    latestGameplaySliceReadModel = response.readModel;
    window.empireStreetsGameplaySliceReadModel = response.readModel;
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", {
      detail: {
        gameplaySlice: response.readModel,
        playerView: response.readModel.player || null
      }
    }));
  }
}

async function submitServerMarketCommand({ action, resourceId, amount, marketType = "normal", paymentType = "cleanCash" } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return {
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    };
  }

  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  const focusDistrictId = slice?.district?.districtId || player?.homeDistrictId || null;
  if (!slice || !player || !focusDistrictId) {
    return {
      accepted: false,
      errors: [{ message: "Market akci nejde odeslat bez server slice kontextu." }]
    };
  }

  const normalizedAction = action === "sell" ? "sell" : "buy";
  const command = {
    id: createGameplaySliceCommandId(normalizedAction === "sell" ? "command:market-sell" : "command:market-buy"),
    type: normalizedAction === "sell" ? "sell-market-resource" : "buy-market-resource",
    mode: player.mode || slice.mode?.mode || "free",
    playerId: player.playerId,
    serverInstanceId: player.instanceId,
    issuedAt: new Date().toISOString(),
    payload: normalizedAction === "sell"
      ? {
          resourceId,
          amount
        }
      : {
          resourceId,
          amount,
          marketType,
          paymentType
        },
    clientRequestId: null
  };
  const request = {
    command,
    focusDistrictId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await fetch(`${getGameplaySliceEndpointBase()}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(request)
  }).then((payload) => payload.json());

  syncGameplaySliceResponse(response);
  return response;
}

async function submitServerBountyCommand({ action = "create", payload = {} } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return {
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    };
  }

  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  const focusDistrictId = slice?.district?.districtId || player?.homeDistrictId || null;
  if (!slice || !player || !focusDistrictId) {
    return {
      accepted: false,
      errors: [{ message: "Bounty akci nejde odeslat bez server slice kontextu." }]
    };
  }

  const normalizedAction = action === "cancel" ? "cancel" : "create";
  const command = {
    id: createGameplaySliceCommandId(normalizedAction === "cancel" ? "command:bounty-cancel" : "command:bounty-create"),
    type: normalizedAction === "cancel" ? "cancel-bounty" : "create-bounty",
    mode: player.mode || slice.mode?.mode || "free",
    playerId: player.playerId,
    serverInstanceId: player.instanceId,
    issuedAt: new Date().toISOString(),
    payload,
    clientRequestId: null
  };
  const request = {
    command,
    focusDistrictId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await fetch(`${getGameplaySliceEndpointBase()}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(request)
  }).then((payloadResponse) => payloadResponse.json());

  syncGameplaySliceResponse(response);
  return response;
}

async function submitServerAllianceCommand({ type = "", payload = {} } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return {
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    };
  }

  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  const focusDistrictId = slice?.district?.districtId || player?.homeDistrictId || null;
  if (!slice || !player || !focusDistrictId) {
    return {
      accepted: false,
      errors: [{ message: "Aliance akci nejde odeslat bez server slice kontextu." }]
    };
  }

  const command = {
    id: createGameplaySliceCommandId(`command:alliance:${String(type || "action")}`),
    type,
    mode: player.mode || slice.mode?.mode || "free",
    playerId: player.playerId,
    serverInstanceId: player.instanceId,
    issuedAt: new Date().toISOString(),
    payload,
    clientRequestId: null
  };
  const request = {
    command,
    focusDistrictId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await fetch(`${getGameplaySliceEndpointBase()}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(request)
  }).then((payloadResponse) => payloadResponse.json());

  syncGameplaySliceResponse(response);
  return response;
}

function resolveServerDistrictIdFromBuildingContext(context = {}) {
  const rawId = context?.serverDistrictId
    || context?.district?.serverDistrictId
    || context?.district?.districtId
    || context?.district?.id
    || "";
  const text = String(rawId || "").trim();
  if (!text) return "";
  return text.startsWith("district:") ? text : `district:${text}`;
}

function normalizeServerBuildingTypeId(value = "") {
  return String(value || "").trim().replace(/-/g, "_");
}

const SERVER_BUILDING_UPGRADE_MAX_LEVEL_BY_TYPE = Object.freeze({
  casino: 4,
  warehouse: 4,
  port: 5,
  parliament: 5,
  pharmacy: 14,
  drug_lab: 14,
  druglab: 14,
  factory: 14,
  armory: 14
});

function getServerAuthoritativeBuildingUpgradeMaxLevel(mechanicsType = "") {
  const serverType = getServerBuildingTypeIdForDetailMechanics(mechanicsType);
  return Math.max(1, Math.floor(Number(SERVER_BUILDING_UPGRADE_MAX_LEVEL_BY_TYPE[serverType] || 1)));
}

async function loadServerGameplaySliceForDistrict(districtId, { forceRefresh = false } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return {
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    };
  }

  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  if (!slice || !player?.instanceId || !player?.playerId) {
    return {
      accepted: false,
      errors: [{ message: "Server slice kontext není připravený." }]
    };
  }

  if (!forceRefresh && slice?.district?.districtId === districtId) {
    return { accepted: true, readModel: slice, errors: [] };
  }

  const request = {
    serverInstanceId: player.instanceId,
    playerId: player.playerId,
    districtId
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await fetch(`${getGameplaySliceEndpointBase()}/load`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(request)
  }).then((payload) => payload.json());

  syncGameplaySliceResponse(response);
  return response;
}

async function resolveServerBuildingActionTarget(context, definition) {
  const districtId = resolveServerDistrictIdFromBuildingContext(context);
  if (!districtId) {
    return { ok: false, message: "Chybí server district id pro spuštění akce." };
  }

  const loadResponse = await loadServerGameplaySliceForDistrict(districtId);
  if (!loadResponse?.accepted && !loadResponse?.readModel) {
    return {
      ok: false,
      message: loadResponse?.errors?.[0]?.message || "Server district detail nejde načíst."
    };
  }

  const slice = latestGameplaySliceReadModel || loadResponse.readModel || null;
  const district = slice?.district || null;
  if (!district || district.districtId !== districtId) {
    return { ok: false, message: "Server nevrátil detail vybraného districtu." };
  }

  const expectedType = normalizeServerBuildingTypeId(definition?.buildingTypeId);
  const building = (district.buildings || []).find((candidate) =>
    normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
      && Array.isArray(candidate?.actions)
      && candidate.actions.some((action) => action?.actionId === definition.actionId)
  ) || (district.buildings || []).find((candidate) =>
    normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
  );

  if (!building?.buildingId) {
    return { ok: false, message: "Server v districtu nenašel odpovídající budovu." };
  }

  const actionView = (building.actions || []).find((action) => action?.actionId === definition.actionId) || null;
  if (!actionView) {
    return { ok: false, message: "Server v budově nenašel tuhle akci." };
  }

  return {
    ok: true,
    districtId,
    buildingId: building.buildingId,
    building,
    actionView
  };
}

function formatServerBuildingActionDisabledReason(actionView) {
  const cooldownTicks = Math.max(0, Math.floor(Number(actionView?.cooldownRemainingTicks || 0)));
  if (cooldownTicks > 0) {
    return `Akce čeká ${formatDistrictBuildingCooldown(cooldownTicks * 5000)}.`;
  }
  return String(actionView?.disabledReason || "").trim();
}

function createServerBuildingActionPayload(target, definition, actionProfile = {}) {
  return {
    districtId: target.districtId,
    buildingId: target.buildingId,
    actionId: definition.actionId,
    ...createServerBuildingActionDefaultPayload(definition.actionId, actionProfile)
  };
}

function getServerBuildingTypeIdForDetailMechanics(mechanicsType = "") {
  const normalized = normalizeServerBuildingTypeId(mechanicsType);
  const aliases = {
    "auto_salon": "car_dealer",
    retail: "shopping_mall",
    "power_plant": "power_station",
    "drug_lab": "drug_lab"
  };
  return aliases[normalized] || normalized;
}

async function resolveServerBuildingUpgradeTarget(context, mechanics = {}) {
  const districtId = resolveServerDistrictIdFromBuildingContext(context);
  if (!districtId) {
    return { ok: false, message: "Chybí server district id pro upgrade." };
  }

  const loadResponse = await loadServerGameplaySliceForDistrict(districtId);
  if (!loadResponse?.accepted && !loadResponse?.readModel) {
    return {
      ok: false,
      message: loadResponse?.errors?.[0]?.message || "Server district detail nejde načíst."
    };
  }

  const slice = latestGameplaySliceReadModel || loadResponse.readModel || null;
  const district = slice?.district || null;
  if (!district || district.districtId !== districtId) {
    return { ok: false, message: "Server nevrátil detail vybraného districtu." };
  }

  const expectedType = getServerBuildingTypeIdForDetailMechanics(mechanics.mechanicsType || resolveDistrictBuildingDetailMechanicsType(context.buildingName));
  const building = (district.buildings || []).find((candidate) =>
    normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
  );

  if (!building?.buildingId) {
    return { ok: false, message: "Server v districtu nenašel odpovídající budovu pro upgrade." };
  }

  return {
    ok: true,
    districtId,
    buildingId: building.buildingId,
    building
  };
}

async function submitServerBuildingUpgradeCommand({ context, mechanics } = {}) {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return {
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    };
  }

  const target = await resolveServerBuildingUpgradeTarget(context, mechanics);
  if (!target.ok) {
    return {
      accepted: false,
      errors: [{ message: target.message }]
    };
  }

  const slice = latestGameplaySliceReadModel || null;
  const player = slice?.player || null;
  if (!slice || !player?.playerId || !player?.instanceId) {
    return {
      accepted: false,
      errors: [{ message: "Server slice kontext není připravený." }]
    };
  }

  const request = {
    command: {
      id: createGameplaySliceCommandId("command:upgrade-building"),
      type: "upgrade-building",
      mode: player.mode || slice.mode?.mode || "free",
      playerId: player.playerId,
      serverInstanceId: player.instanceId,
      issuedAt: new Date().toISOString(),
      payload: {
        districtId: target.districtId,
        buildingId: target.buildingId
      },
      clientRequestId: null
    },
    focusDistrictId: target.districtId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await fetch(`${getGameplaySliceEndpointBase()}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(request)
  }).then((payload) => payload.json());
  syncGameplaySliceResponse(response);
  return response;
}

async function submitServerBuildingActionCommand({ context, actionProfile, definition } = {}) {
  return submitServerBuildingActionCommandBridge({ context, actionProfile, definition }, {
    isReady: isServerAuthoritativeGameplayRuntimeReady,
    getSlice: () => latestGameplaySliceReadModel,
    loadSliceForDistrict: loadServerGameplaySliceForDistrict,
    formatCooldown: formatDistrictBuildingCooldown,
    createCommandId: createGameplaySliceCommandId,
    nowIso: () => new Date().toISOString(),
    getSnapshotToken: getGameplaySliceSnapshotToken,
    getEndpointBase: getGameplaySliceEndpointBase,
    fetchJson: (url, request) => fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(request)
    }).then((payload) => payload.json()),
    syncResponse: syncGameplaySliceResponse
  });
}

function getDefaultRuntimeRoot() {
  return getDefaultRuntimeRootElement(PAGE_ROOT_SELECTOR);
}

function resolveRuntimeRoot(candidate = null) {
  return resolveRuntimeRootElement(candidate, { pageRootSelector: PAGE_ROOT_SELECTOR });
}

function getSettingsStateRuntime() {
  if (!settingsStateRuntime) {
    settingsStateRuntime = createSettingsStateRuntime({
      loadSettingsState,
      saveSettingsState,
      documentRef: typeof document === "undefined" ? null : document
    });
  }
  return settingsStateRuntime;
}

function getSettingsState() {
  return getSettingsStateRuntime().getSettingsState();
}

function applySettingsState(settings) {
  return getSettingsStateRuntime().applySettingsState(settings);
}

function getStoredRegistration() {
  return getAuthoritySession().registration ?? null;
}

function isGuestSession(registration = null) {
  const resolvedRegistration = registration || getStoredRegistration();
  if (!resolvedRegistration) {
    return false;
  }
  return (
    resolvedRegistration.loginKind === "guest"
    || resolvedRegistration.isGuest === true
  );
}

function setStoredRegistration(payload) {
  updateStoredPreviewSession((session) => ({ ...session, registration: payload }));
}

function getMarketServerScope(session = getAuthoritySession()) {
  return getMarketServerScopePayload(session);
}

function createDefaultPlayerMarketListings(serverId = getMarketServerScope().serverId, now = Date.now()) {
  return createDefaultPlayerMarketListingsPayload(serverId, now);
}

function normalizePlayerMarketListings(listings = [], serverId = getMarketServerScope().serverId, now = Date.now()) {
  return normalizePlayerMarketListingsPayload(listings, serverId, now);
}

function normalizeMarketTradeState(state) {
  return normalizeMarketTradeStatePayload(state, { defaultServerId: getMarketServerScope().serverId });
}

function getLaunchPlayerRuntime() {
  if (!launchPlayerRuntime) {
    launchPlayerRuntime = createLaunchPlayerRuntime({
      currentPlayerId: CURRENT_PLAYER_ID,
      playerColors: START_PHASE_PLAYER_COLORS,
      playerNames: START_PHASE_PLAYER_NAMES,
      factionOrder: LAUNCH_PLAYER_FACTION_ORDER,
      avatarByFactionId: LAUNCH_PLAYER_AVATAR_BY_FACTION_ID,
      startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
      getStoredRegistration,
      getWorldState: getResolvedWorldState,
      getLegacyAvatar: () => loadTextStorage(LEGACY_STORAGE_KEYS.avatar, ""),
      normalizeRuntimeHexColor,
      getRegistrationAccentColor,
      getFactionGlyph,
      normalizeLaunchPlayerPaletteColor,
      createLaunchPlayerColorMap
    });
  }
  return launchPlayerRuntime;
}

function getCurrentPlayerGangColor() {
  return getLaunchPlayerRuntime().getCurrentPlayerGangColor();
}

function getCurrentPlayerFactionGlyph() {
  return getLaunchPlayerRuntime().getCurrentPlayerFactionGlyph();
}

function getPlayerDistrictColor(ownerId) {
  return getLaunchPlayerRuntime().getPlayerDistrictColor(ownerId);
}

const FACTORY_SUPPLY_MATERIAL_KEY_MAP = Object.freeze({
  "metal-parts": "metalParts",
  "tech-core": "techCore",
  "combat-module": "combatModule"
});

function getFactorySupplyKeyForMaterial(itemId) {
  return FACTORY_SUPPLY_MATERIAL_KEY_MAP[itemId] || null;
}

const {
  createWeaponInventoryFromFaction,
  getResolvedDrugInventory: getLegacyResolvedDrugInventory,
  getResolvedEconomyState,
  getResolvedMaterialInventory: getLegacyResolvedMaterialInventory,
  getResolvedProductionState,
  getResolvedSpyIntel,
  getResolvedSpyState,
  getSpyMissionExpiryTimestamp,
  getSpyMissionPhase,
  getStoredAttackOrders,
  getStoredDrugInventory,
  getStoredEconomyState,
  getStoredMaterialInventory,
  getStoredOccupyOrders,
  getStoredProductionState,
  getStoredRobberyOrders,
  getStoredSpyIntel,
  getStoredSpyState,
  getStoredWeaponInventory,
  isSpyMissionActiveOnMap,
  resetSpyDistrictState,
  setStoredAttackOrders,
  setStoredDrugInventory,
  setStoredEconomyState,
  setStoredMaterialInventory,
  setStoredOccupyOrders,
  setStoredProductionState,
  setStoredRobberyOrders,
  setStoredSpyIntel,
  setStoredSpyState,
  setStoredWeaponInventory
} = createAuthoritySessionAccessors({
  clamp,
  defaultDrugInventory: DEFAULT_DRUG_INVENTORY,
  defaultMaterialInventory: DEFAULT_MATERIAL_INVENTORY,
  defaultWeaponInventory: DEFAULT_WEAPON_INVENTORY,
  documentRef: typeof document === "undefined" ? null : document,
  factionCatalog: FACTION_CATALOG,
  factionWeaponPresets: FACTION_WEAPON_PRESETS,
  getAuthoritySession,
  getStoredRegistration,
  maxSpies: MAX_SPIES,
  updateStoredPreviewSession
});

function getServerPlayerResourceBalances() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const player = latestGameplaySliceReadModel?.player || null;
  const balances = player?.resourceBalances || player?.economy?.resources || null;
  return balances && typeof balances === "object" ? balances : null;
}

function getServerStorageSummary() {
  if (!isServerAuthoritativeGameplayRuntimeReady()) {
    return null;
  }
  const summary = latestGameplaySliceReadModel?.player?.storage;
  return summary && typeof summary === "object" ? summary : null;
}

function getServerInventoryGroup(groupName, defaults = {}) {
  const player = latestGameplaySliceReadModel?.player || null;
  const balances = getServerPlayerResourceBalances();
  if (!player || !balances) {
    return null;
  }
  const group = player.economy?.[groupName];
  const inventory = group && typeof group === "object" ? group : balances;
  const emptyInventory = Object.fromEntries(Object.keys(defaults).map((key) => [key, 0]));
  return {
    ...emptyInventory,
    ...inventory
  };
}

function getResolvedMaterialInventory() {
  return getServerInventoryGroup("materials", DEFAULT_MATERIAL_INVENTORY)
    || getLegacyResolvedMaterialInventory();
}

function getResolvedDrugInventory() {
  return getServerInventoryGroup("drugs", DEFAULT_DRUG_INVENTORY)
    || getLegacyResolvedDrugInventory();
}

function getStoredMarketPriceState() {
  const session = getAuthoritySession();
  const { serverId } = getMarketServerScope(session);
  const scopedState = session.marketByServerId?.[serverId];

  if (isMarketPriceStatePayload(scopedState)) {
    return withMarketServerId(scopedState, serverId);
  }

  if (isMarketPriceStatePayload(session.market) && normalizeMarketServerId(session.market.serverId) === serverId) {
    return withMarketServerId(session.market, serverId);
  }

  return null;
}

function setStoredMarketPriceState(payload) {
  updateStoredPreviewSession((session) => {
    const { serverId } = getMarketServerScope(session);
    const scopedState = session.marketByServerId?.[serverId];
    const nextState = withMarketServerId(
      payload || scopedState || session.market || createDefaultMarketPriceState(serverId),
      serverId
    );

    return {
      ...session,
      market: nextState,
      marketByServerId: {
        ...(session.marketByServerId || {}),
        [serverId]: nextState
      }
    };
  });
}

function createDefaultMarketPriceState(serverId = getMarketServerScope().serverId) {
  return createDefaultMarketPriceStatePayload(serverId);
}

function getResolvedMarketPriceState() {
  const storedState = getStoredMarketPriceState();

  if (storedState?.items && storedState.nextRefreshAt) {
    return normalizeMarketTradeState(storedState);
  }

  const nextState = createDefaultMarketPriceState();
  setStoredMarketPriceState(nextState);
  return nextState;
}

function getPriceVarianceForTab(tabId) {
  return MARKET_TAB_CONFIG[tabId]?.variance ?? (tabId === "black-market" ? 0.18 : 0.1);
}

function computeNextDynamicPrice(basePrice, currentPrice, variance) {
  const directionFactor = 1 + ((Math.random() * 2) - 1) * variance;
  const nextPrice = Math.round(currentPrice * directionFactor);
  const minPrice = Math.round(basePrice * 0.85);
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

  const nextStock = normalizeMarketStockState(state.stock);

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      const stockConfig = getMarketStockConfig(tabId, item.itemId);
      if (!stockConfig) {
        continue;
      }

      const stockKey = getMarketStockKey(tabId, item.itemId);
      nextStock[stockKey] = clamp(
        Math.floor(Number(nextStock[stockKey] || 0) + Number(stockConfig.regen || 0)),
        0,
        Math.max(0, Number(stockConfig.max || stockConfig.start || 0))
      );
    }
  }

  const nextState = normalizeMarketTradeState({
    ...state,
    serverId: state.serverId || getMarketServerScope().serverId,
    nextRefreshAt: new Date(Date.now() + MARKET_PRICE_REFRESH_MS).toISOString(),
    items: nextItems,
    stock: nextStock
  });

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

function applyTopbarEconomy(root, { instant = false } = {}) {
  const displaySnapshot = getDisplayedResourceSnapshot();
  updateTopbarResources(displaySnapshot, {
    root,
    instant,
    includeSpy: false,
    formatMoneyAmount: formatDistrictMoneyAmount
  });
}

function bindTopbarMoneySkipControls(root) {
  bindTopbarMoneySkipControlsUi(root, {
    getDisplaySnapshot: getDisplayedResourceSnapshot
  });
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
        cityMinutes: DEFAULT_CITY_MINUTES
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

function normalizeRuntimeGamePhase(value) {
  const phase = String(value || "").trim().toLowerCase().replace(/-/gu, "_");
  if (phase === "launch") {
    return "launch";
  }
  if (phase === "final_lockdown" || phase === "final") {
    return "final_lockdown";
  }
  if (phase === "resolved") {
    return "resolved";
  }
  return "live";
}

function normalizeRuntimeCityMinutes(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_CITY_MINUTES), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CITY_MINUTES;
  }
  return ((parsed % (24 * 60)) + (24 * 60)) % (24 * 60);
}

function normalizeWorldOwnedDistrictIds(world) {
  return Array.isArray(world?.ownedDistrictIds)
    ? world.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
}

function haveSameWorldOwnedDistrictIds(leftWorld, rightWorld) {
  const left = normalizeWorldOwnedDistrictIds(leftWorld);
  const right = normalizeWorldOwnedDistrictIds(rightWorld);

  if (left.length !== right.length) {
    return false;
  }

  const rightIds = new Set(right);
  return left.every((districtId) => rightIds.has(districtId));
}

function setStoredWorldState(payload) {
  const previousWorld = getStoredWorldState();
  const nextWorld = payload || previousWorld;
  const ownedDistrictIdsChanged = !haveSameWorldOwnedDistrictIds(previousWorld, nextWorld);

  updateStoredPreviewSession((session) => ({
    ...session,
    world: nextWorld || session.world
  }));
  document.dispatchEvent(new CustomEvent("empire:world-state-changed", {
    detail: {
      ownedDistrictIdsChanged
    }
  }));
}

function pruneDistrictGossipMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawMap).map(([districtKey, entries]) => [
      districtKey,
      Array.isArray(entries)
        ? entries
            .filter((entry) => entry && typeof entry === "object")
            .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
            .slice(0, DISTRICT_GOSSIP_MAX_PER_DISTRICT)
        : []
    ])
  );
}

function getResolvedWorldState() {
  const world = getStoredWorldState();
  return {
    ownedDistrictIds: Array.isArray(world.ownedDistrictIds) ? world.ownedDistrictIds.map(Number).filter(Boolean) : [],
    phaseState: world.phaseState && typeof world.phaseState === "object"
      ? {
          mapPhase: world.phaseState.mapPhase === "day" ? "day" : "night",
          gamePhase: normalizeRuntimeGamePhase(world.phaseState.gamePhase),
          cityMinutes: normalizeRuntimeCityMinutes(world.phaseState.cityMinutes)
        }
      : {
          mapPhase: "night",
          gamePhase: "live",
          cityMinutes: DEFAULT_CITY_MINUTES
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
    districtGossipById: pruneDistrictGossipMap(world.districtGossipById),
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
    seed: Number(marker.seed || districtId) || Number(districtId) || 1,
    impact: marker.impact && typeof marker.impact === "object" ? marker.impact : null
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

function getActivePoliceIncomeMultiplier() {
  const penaltyPct = Object.values(getResolvedDistrictPoliceActions()).reduce((max, marker) => Math.max(max, Number(marker?.impact?.incomePct || 0)), 0);
  return 1 - (clamp(penaltyPct, 0, 100) / 100);
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
  const randomSpecialtyKey = options.raidSpecialtyKey
    ? resolvePoliceSpecialty(options.raidSpecialtyKey).key
    : resolveRandomPoliceSpecialtyKey();
  const operationKey = resolvePoliceOperationType(options.operationType)?.key
    || resolveRandomPoliceOperationType(tier.id, options.source, Math.random, randomSpecialtyKey)
    || "warning_notice";
  const operationMeta = resolvePoliceOperationType(operationKey) || POLICE_OPERATION_TYPES.warning_notice;
  const specialtyKey = resolvePoliceSpecialty(options.raidSpecialtyKey || operationMeta.specialtyKey || randomSpecialtyKey).key;
  const now = Date.now();
  const durationMs = Math.max(60_000, Number(options.durationMs || GANG_HEAT_POLICE_DURATION_MS) || GANG_HEAT_POLICE_DURATION_MS);
  const impact = options.skipImpact === true
    ? { rows: [] }
    : applyPoliceActionImpact(tier, {
        operationKey,
        specialtyKey,
        durationMs
      });
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
  const shouldKeepDestroyedDistrict = isDemoScenarioMode(phaseState)
    || normalizeRuntimeGamePhase(phaseState.gamePhase) === "live";
  const isApplied = storedWorldState.devOnlyScenarioDestroyedDistrictId === DEV_ONLY_DESTROYED_DISTRICT_ID;
  const hasDestroyedDistrict = destroyedDistrictIds.includes(DEV_ONLY_DESTROYED_DISTRICT_ID);

  if (shouldKeepDestroyedDistrict) {
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

  if (!isDemoScenarioMode(phaseState)) {
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

function getDistrictGossipRuntime() {
  if (!districtGossipRuntime) {
    districtGossipRuntime = createDistrictGossipRuntime({
      getWorldState: getResolvedWorldState,
      setWorldState: setStoredWorldState,
      isDevMode: () => isDemoScenarioMode(getResolvedWorldState().phaseState),
      seedLibrary: DISTRICT_GOSSIP_SEED_LIBRARY,
      maxPerDistrict: DISTRICT_GOSSIP_MAX_PER_DISTRICT
    });
  }

  return districtGossipRuntime;
}

function isDistrictGossipDevOnlyMode() {
  return getDistrictGossipRuntime().isDistrictGossipDevOnlyMode();
}

function getDistrictGossipEntries(districtOrId, limit = DISTRICT_GOSSIP_MAX_PER_DISTRICT) {
  return getDistrictGossipRuntime().getDistrictGossipEntries(districtOrId, limit);
}

function appendDistrictGossip(districtOrId, text, metadata = {}) {
  return getDistrictGossipRuntime().appendDistrictGossip(districtOrId, text, metadata);
}

function buildSeedDistrictGossipEntries(district) {
  return getDistrictGossipRuntime().buildSeedDistrictGossipEntries(district);
}

function ensureDistrictPassiveGossip(district) {
  return getDistrictGossipRuntime().ensureDistrictPassiveGossip(district);
}

function recordDistrictIntelEvent(payload = {}) {
  const entry = getDistrictGossipRuntime().recordDistrictIntelEvent(payload);
  if (entry) {
    appendDistrictGossipStreetNews({
      ...entry,
      districtId: payload.districtId,
      playerId: payload.playerId,
      playerName: payload.playerName || getResultDistrictOwnerLabel(payload.districtId, "Neznámý hráč"),
      targetPlayerId: payload.targetPlayerId,
      targetPlayerName: payload.targetPlayerName,
      sourceEventId: entry.id,
      sourceType: "district_gossip",
      category: "rumor",
      message: entry.text,
      timestampMs: entry.createdAt
    });
  }
  return entry;
}

function appendDistrictGossipStreetNews(event = {}) {
  const root = resolveRuntimeRoot(getDefaultRuntimeRoot());
  if (!root) {
    return false;
  }

  const payload = createRumorStreetNewsPayload(event, { getLaunchPlayerName });
  appendBuildingActionResultEntry(root, "police", payload, {
    id: `rumor-street-news:${event.sourceEventId || event.id || event.timestampMs || Date.now()}`,
    tone: "event",
    title: payload.title,
    summary: payload.summary,
    meta: payload.meta,
    timestampMs: event.timestampMs || event.createdAt || Date.now()
  }, {
    syncPreview: true,
    forceLog: true,
    refresh: false
  });
  return true;
}

function getResolvedPhaseState() {
  return getResolvedWorldState().phaseState || {
    mapPhase: "night",
    gamePhase: "live",
    cityMinutes: DEFAULT_CITY_MINUTES
  };
}

function resolveRuntimeBuildingActionPhaseDisabledReason(definition = {}) {
  return resolvePhaseLockedBuildingActionDisabledReason(definition?.actionId, getResolvedPhaseState());
}

function syncPhaseHostFromAuthority(phaseHost) {
  if (!phaseHost) {
    return getResolvedPhaseState();
  }

  const phaseState = getResolvedPhaseState();
  const coreMapPhase = phaseHost.dataset.coreMapPhase === "day" || phaseHost.dataset.coreMapPhase === "night"
    ? phaseHost.dataset.coreMapPhase
    : "";
  const nextMapPhase = coreMapPhase || (phaseState.mapPhase === "day" ? "day" : "night");
  const nextGamePhase = normalizeRuntimeGamePhase(phaseState.gamePhase);

  if (phaseHost.dataset.mapPhase !== nextMapPhase) {
    phaseHost.dataset.mapPhase = nextMapPhase;
    phaseHost.dispatchEvent(new CustomEvent("mapphasechange", { detail: { phase: nextMapPhase } }));
  }

  if (phaseHost.dataset.gamePhase !== nextGamePhase) {
    phaseHost.dataset.gamePhase = nextGamePhase;
    phaseHost.dispatchEvent(new CustomEvent("gamephasechange", { detail: { gamePhase: nextGamePhase } }));
  }

  return {
    ...phaseState,
    mapPhase: nextMapPhase
  };
}

function isFinalLockdownActive() {
  if (normalizeRuntimeGamePhase(getResolvedPhaseState().gamePhase) === "final_lockdown") {
    return true;
  }

  const finalLockdown = getAuthoritySession()?.player?.finalLockdown || null;
  return Boolean(
    finalLockdown?.enabled
    && (finalLockdown.active || finalLockdown.status === "active" || finalLockdown.status === "paused")
  );
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
  return formatGangHeatProtectionLabelHelper(untilValue, { formatDurationLabel });
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
  if (safeHeat !== previousHeat) {
    document.dispatchEvent(new CustomEvent("empire:heat-changed", {
      detail: {
        previousHeat,
        heat: safeHeat,
        delta: safeHeat - previousHeat,
        reason: String(options?.reason || "Heat changed")
      }
    }));
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

function applyInventoryPenalty(inventoryName, percent, allowedItemIds = null) {
  const safePercent = Math.max(0, Number(percent || 0));
  if (safePercent <= 0) {
    return { totalLost: 0, entries: [] };
  }

  const supplies = inventoryName === "materials" ? getStoredFactorySupplies() : null;
  const allowedSet = Array.isArray(allowedItemIds) ? new Set(allowedItemIds) : null;
  const currentInventory = inventoryName === "materials"
    ? { ...getResolvedMaterialInventory(), "metal-parts": supplies.metalParts, "tech-core": supplies.techCore, "combat-module": supplies.combatModule }
    : inventoryName === "drugs"
      ? getResolvedDrugInventory()
      : getResolvedWeaponInventory();
  const nextInventory = { ...currentInventory };
  const entries = [];
  let totalLost = 0;

  for (const [itemId, amount] of Object.entries(currentInventory || {})) {
    if (allowedSet && !allowedSet.has(itemId)) {
      continue;
    }
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
    const { ["metal-parts"]: metalParts, ["tech-core"]: techCore, ["combat-module"]: combatModule, ...materials } = nextInventory;
    setStoredMaterialInventory(materials);
    setStoredFactorySupplies({ ...supplies, metalParts, techCore, combatModule });
  } else if (inventoryName === "drugs") {
    setStoredDrugInventory(nextInventory);
  } else {
    setStoredWeaponInventory(nextInventory);
  }

  return { totalLost, entries };
}

function applyPoliceActionImpact(tier, options = {}) {
  const tierImpact = resolvePoliceOperationImpact(tier.id, options.operationKey, options.specialtyKey);

  const economyState = getResolvedEconomyState();
  const cleanLoss = applyPercentageLoss(economyState.cleanMoney, tierImpact.cleanPct);
  const dirtyLoss = applyPercentageLoss(economyState.dirtyMoney, tierImpact.dirtyPct);
  setStoredEconomyState({
    ...economyState,
    cleanMoney: cleanLoss.nextValue,
    dirtyMoney: dirtyLoss.nextValue
  });

  const drugLoss = applyInventoryPenalty("drugs", tierImpact.drugPct);
  const attackWeaponLoss = applyInventoryPenalty("weapons", tierImpact.attackWeaponPct, ATTACK_WEAPON_IDS);
  const defenseWeaponLoss = applyInventoryPenalty("weapons", tierImpact.defenseWeaponPct, DEFENSE_WEAPON_IDS);
  const materialLoss = applyInventoryPenalty("materials", tierImpact.materialPct);

  const gangState = getResolvedGangState();
  const membersLoss = applyPercentageLoss(gangState.members, tierImpact.membersPct);
  const influenceLoss = applyPercentageLoss(gangState.influence, tierImpact.influencePct);
  setStoredGangState({
    members: membersLoss.nextValue,
    influence: influenceLoss.nextValue
  });

  const impactRows = [
    cleanLoss.lostValue > 0 ? { label: "Zabaveno clean", value: formatCurrency(cleanLoss.lostValue) } : null,
    dirtyLoss.lostValue > 0 ? { label: "Zabaveno dirty", value: formatCurrency(dirtyLoss.lostValue) } : null,
    drugLoss.totalLost > 0 ? { label: "Zabavené drogy", value: summarizePenaltyEntries(drugLoss.entries, getProductionResourceLabel) } : null,
    attackWeaponLoss.totalLost > 0 ? { label: "Zabavené attack zbraně", value: summarizePenaltyEntries(attackWeaponLoss.entries, (itemId) => ATTACK_WEAPON_LABELS[itemId] || itemId) } : null,
    defenseWeaponLoss.totalLost > 0 ? { label: "Zabavené defense zbraně", value: summarizePenaltyEntries(defenseWeaponLoss.entries, (itemId) => ATTACK_WEAPON_LABELS[itemId] || itemId) } : null,
    materialLoss.totalLost > 0 ? { label: "Zabavený materiál", value: summarizePenaltyEntries(materialLoss.entries, getProductionResourceLabel) } : null,
    membersLoss.lostValue > 0 ? { label: "Zatčení členové", value: `${membersLoss.lostValue}` } : null,
    influenceLoss.lostValue > 0 ? { label: "Ztracený vliv", value: `${influenceLoss.lostValue}` } : null
  ].filter(Boolean);

  return {
    cleanLoss: cleanLoss.lostValue,
    dirtyLoss: dirtyLoss.lostValue,
    drugLoss: drugLoss.totalLost,
    attackWeaponLoss: attackWeaponLoss.totalLost,
    defenseWeaponLoss: defenseWeaponLoss.totalLost,
    materialLoss: materialLoss.totalLost,
    membersLoss: membersLoss.lostValue,
    influenceLoss: influenceLoss.lostValue,
    operationKey: tierImpact.operationKey,
    operationLabel: tierImpact.operationLabel,
    severity: tierImpact.severity,
    raidSpecialtyKey: String(options.specialtyKey || ""),
    tierId: tier.id,
    durationMs: Number(options.durationMs || tierImpact.durationMs),
    incomePct: tierImpact.incomePct,
    attackPowerPct: tierImpact.attackPowerPct,
    defensePowerPct: tierImpact.defensePowerPct,
    effectRows: tierImpact.effectRows,
    rows: impactRows
  };
}

function renderGangMembersState(root) {
  renderResourcesPanelUi({ gangMembers: getResolvedGangState().members }, {
    root,
    includeMoney: false,
    includeSpy: false
  });
}

function getResultPayloadBuilders() {
  if (!resultPayloadBuilders) {
    resultPayloadBuilders = createResultPayloadBuilders({
      getDistrictById: (districtId) => window.empireStreetsDistrictState?.getDistrictById?.(districtId) || null,
      getWorldState: getResolvedWorldState,
      startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
      currentPlayerId: CURRENT_PLAYER_ID,
      getLaunchPlayerName,
      getStoredRegistration,
      getAllianceLabel: () => window.empireStreetsAllianceState?.getActiveAlliance?.()?.name
        || document.querySelector("[data-gang-alliance]")?.textContent
        || "",
      resolveDistrictBuildingProfile,
      districtTypeMeta: DISTRICT_BUILDING_TYPE_META,
      unknownAtmosphereMeta: DISTRICT_ATMOSPHERE_META.unknown,
      getDistrictAtmosphereMeta,
      resolvePoliceSpecialty,
      resolvePoliceOperationType,
      resolveGangHeatTier,
      getGangState: getResolvedGangState,
      policeActionTierMessages: POLICE_ACTION_TIER_MESSAGES,
      policeActionTierQuotes: POLICE_ACTION_TIER_QUOTES,
      policeDistrictClickWarningQuotes: POLICE_DISTRICT_CLICK_WARNING_QUOTES,
      spyAllianceDetectionWarningQuotes: SPY_ALLIANCE_DETECTION_WARNING_QUOTES,
      spyDetectionWarningQuotes: SPY_DETECTION_WARNING_QUOTES,
      spySuccessEmptyDistrictQuotes: SPY_SUCCESS_EMPTY_DISTRICT_QUOTES,
      spySuccessOccupiedDistrictQuotes: SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES,
      spyMediumFailEmptyDistrictQuotes: SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES,
      spyMediumFailOccupiedDistrictQuotes: SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES,
      spyMajorFailEmptyDistrictQuotes: SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES,
      spyMajorFailOccupiedDistrictQuotes: SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES,
      spyCaptureCooldownMs: SPY_CAPTURE_COOLDOWN_MS,
      formatDurationLabel,
      gangHeatPoliceDurationMs: GANG_HEAT_POLICE_DURATION_MS,
      formatDistrictReference,
      resolveDistrictNumericId
    });
  }
  return resultPayloadBuilders;
}

function getRuntimeDistrictById(districtId) {
  return getResultPayloadBuilders().getRuntimeDistrictById(districtId);
}

function isCurrentPlayerOwnedDistrict(districtId) {
  return getResultPayloadBuilders().isCurrentPlayerOwnedDistrict(districtId);
}

function getResultDistrictOwnerLabel(districtId, fallbackOwnerLabel = "") {
  return getResultPayloadBuilders().getResultDistrictOwnerLabel(districtId, fallbackOwnerLabel);
}

function isDistrictUnownedForSpyResult(districtId, fallbackOwnerLabel = "") {
  return getResultPayloadBuilders().isDistrictUnownedForSpyResult(districtId, fallbackOwnerLabel);
}

function getCurrentPlayerIdentityLabel() {
  return getResultPayloadBuilders().getCurrentPlayerIdentityLabel();
}

function getCurrentPlayerGangLabel() {
  return getResultPayloadBuilders().getCurrentPlayerGangLabel();
}

function getCurrentPlayerAllianceLabel() {
  return getResultPayloadBuilders().getCurrentPlayerAllianceLabel();
}

function getDistrictDefenseIntelSummary(districtId, fallbackDefensePower = 0) {
  return getResultPayloadBuilders().getDistrictDefenseIntelSummary(districtId, fallbackDefensePower);
}

function buildSpyResultRows(districtId, mission = {}, options = {}) {
  return getResultPayloadBuilders().buildSpyResultRows(districtId, mission, options);
}

function resolvePoliceActionTierQuote(tierId) {
  return getResultPayloadBuilders().resolvePoliceActionTierQuote(tierId);
}

function createPoliceActionInfoRows(districtId, policeAction, specialtyMeta) {
  return getResultPayloadBuilders().createPoliceActionInfoRows(districtId, policeAction, specialtyMeta);
}

function createDistrictPoliceRaidWarningPayload(district, policeAction) {
  return getResultPayloadBuilders().createDistrictPoliceRaidWarningPayload(district, policeAction);
}

function createOwnedDistrictPoliceRaidAlertPayload(district, policeAction) {
  return getResultPayloadBuilders().createOwnedDistrictPoliceRaidAlertPayload(district, policeAction);
}

function createDistrictAttackInProgressPayload(district, attackMarker) {
  return getResultPayloadBuilders().createDistrictAttackInProgressPayload(district, attackMarker);
}

function clearPoliceActionResultLiveTimer() {
  if (policeActionResultLiveTimerId !== null) {
    window.clearInterval(policeActionResultLiveTimerId);
    policeActionResultLiveTimerId = null;
  }
}

function createSpyDetectionAlertPayload(districtId) {
  return getResultPayloadBuilders().createSpyDetectionAlertPayload(districtId);
}

const {
  closeResultModal,
  getResultModalQueue,
  getVisibleResultModal,
  openAttackResultModal,
  openOccupationResultModal,
  openRaidResultModal,
  openResultModalByKind,
  openSpyResultModal,
  openSpyWarningModal,
  queueOrOpenResultModal,
  renderNextPendingResultModal
} = createResultModalRuntime({
  createResultModalQueue,
  formatDistrictGossipTimestamp,
  formatDistrictReference,
  onOpenResult: ({ kind, payload }) => {
    document.dispatchEvent(new CustomEvent("empire:result-modal-opened", {
      detail: { kind, payload }
    }));
  },
  openEliminationResultModal,
  openPoliceActionResultModal,
  renderBattleReportPanel,
  renderSimpleResultModal,
  renderSpyWarningPanel,
  selectors: {
    attackResult: ATTACK_RESULT_MODAL_SELECTOR,
    eliminationResult: ELIMINATION_RESULT_POPUP_SELECTOR,
    policeActionResult: POLICE_ACTION_RESULT_MODAL_SELECTOR,
    raidResult: RAID_RESULT_MODAL_SELECTOR,
    raidResultContent: RAID_RESULT_MODAL_CONTENT_SELECTOR,
    raidResultDetails: RAID_RESULT_MODAL_DETAILS_SELECTOR,
    raidResultSummary: RAID_RESULT_MODAL_SUMMARY_SELECTOR,
    raidResultTitle: RAID_RESULT_MODAL_TITLE_SELECTOR,
    spyResult: SPY_RESULT_MODAL_SELECTOR,
    spyResultContent: SPY_RESULT_MODAL_CONTENT_SELECTOR,
    spyResultDetails: SPY_RESULT_MODAL_DETAILS_SELECTOR,
    spyResultSummary: SPY_RESULT_MODAL_SUMMARY_SELECTOR,
    spyResultTitle: SPY_RESULT_MODAL_TITLE_SELECTOR,
    spyWarning: SPY_WARNING_MODAL_SELECTOR
  }
});

function openEliminationResultModal(root, payload = {}) {
  const popup = eliminationResultPopupsByRoot.get(root);
  if (!popup || typeof popup.open !== "function") {
    return false;
  }
  return popup.open(payload);
}

function closePoliceActionResultModal(root) {
  const modal = root?.querySelector(POLICE_ACTION_RESULT_MODAL_SELECTOR);
  if (!modal) {
    return;
  }

  clearPoliceActionResultLiveTimer();
  modal.classList.add("hidden");
  closeOverlay(modal);
  window.setTimeout(() => {
    renderNextPendingResultModal(root);
  }, 80);
}

function openPoliceActionResultModal(root, payload = {}) {
  clearPoliceActionResultLiveTimer();

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

  const result = renderPoliceActionResultPanel(root, payload, {
    selectors: {
      modal: POLICE_ACTION_RESULT_MODAL_SELECTOR,
      content: POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR,
      title: POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR,
      badge: POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR,
      summary: POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR,
      details: POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR
    },
    formatDurationLabel,
    renderPoliceRaidImpactDetails
  });

  if (!result.ok) {
    return;
  }

  if (result.hasLiveRows && Number(payload.refreshMs || 0) > 0) {
    policeActionResultLiveTimerId = window.setInterval(() => {
      if (result.modal.classList.contains("hidden")) {
        clearPoliceActionResultLiveTimer();
        return;
      }
      result.renderRows();
      if (typeof payload.autoCloseWhen === "function" && payload.autoCloseWhen()) {
        clearPoliceActionResultLiveTimer();
        closePoliceActionResultModal(root);
      }
    }, Number(payload.refreshMs));
  }
}

function normalizeStreetNewsDistrictType(value = "") {
  const text = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  return text.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "";
}

function resolveStreetNewsDistrictId(payload = {}, snapshot = {}) {
  const directValue = snapshot.districtId
    || payload.districtId
    || payload.targetDistrictId
    || payload.sourceDistrictId
    || payload.district?.id
    || payload.districtName
    || "";
  const directId = Number.parseInt(String(directValue || "").replace("district:", ""), 10);
  if (Number.isFinite(directId) && directId > 0) {
    return directId;
  }

  for (const row of Array.isArray(payload.rows) ? payload.rows : []) {
    const label = String(row?.label || "").trim().toLowerCase();
    if (!["district", "cil", "cíl", "target"].includes(label)) {
      continue;
    }
    const rowId = Number.parseInt(String(row?.value || "").replace("district:", ""), 10);
    if (Number.isFinite(rowId) && rowId > 0) {
      return rowId;
    }
  }

  const textCandidates = [
    payload.districtName,
    payload.summary,
    payload.title,
    snapshot.summary,
    snapshot.title,
    snapshot.meta
  ];
  for (const candidate of textCandidates) {
    const match = String(candidate || "").match(/district\s*:?\s*(\d+)/i);
    const textId = Number.parseInt(match?.[1] || "", 10);
    if (Number.isFinite(textId) && textId > 0) {
      return textId;
    }
  }

  return 0;
}

function resolveStreetNewsDistrictType(payload = {}, snapshot = {}) {
  const directType = normalizeStreetNewsDistrictType(
    snapshot.districtType
    || payload.districtType
    || payload.targetDistrictType
    || payload.sourceDistrictType
    || payload.district?.districtType
  );
  if (directType) {
    return directType;
  }

  const districtId = resolveStreetNewsDistrictId(payload, snapshot);
  const district = districtId ? getRuntimeDistrictApi()?.getDistrictById?.(districtId) : null;
  return normalizeStreetNewsDistrictType(district?.districtType) || "unknown";
}

function appendBuildingActionResultEntry(root, kind, payload, snapshot = {}, options = {}) {
  const normalizedPayload = cloneBuildingActionResultPayload(payload);
  const title = String(payload?.title || snapshot.title || "Uliční zpráva").trim();
  const summary = String(payload?.summary || snapshot.summary || "Bez detailu.").trim();
  const meta = String(snapshot.meta || "").trim();
  const districtType = resolveStreetNewsDistrictType(normalizedPayload || payload || {}, snapshot);

  appendBuildingActionEntry(root, {
    ...snapshot,
    tone: payload?.tone || snapshot.tone || "event",
    title,
    summary,
    meta,
    districtType,
    resultKind: kind,
    resultPayload: normalizedPayload
  }, { syncPreview: Boolean(options.syncPreview), forceLog: Boolean(options.forceLog) });

  if (options.resultContainer || options.resultSelector) {
    renderBuildingActionResult(normalizedPayload || payload || {}, {
      container: options.resultContainer,
      root,
      selector: options.resultSelector
    });
  }

  if (options.refresh !== false) {
    refreshAllUi(hydrateInitialState(root));
  }

  document.dispatchEvent(new CustomEvent("empire:action-result", {
    detail: {
      kind,
      payload: normalizedPayload,
      snapshot
    }
  }));
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

  const isClickable = isBuildingActionEntryOpenable(normalizedSnapshot);
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

  if (!panel || !isBuildingActionEntryOpenable(snapshot)) {
    return;
  }

  queueOrOpenResultModal(root, snapshot.resultKind, snapshot.resultPayload);
}

function parseStreetNewsCooldownTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function normalizeStreetNewsCooldownDistrictId(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.floor(direct);
  }

  const match = String(value || "").match(/\d+/u);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formatStreetNewsCooldownDistrict(value) {
  const districtId = normalizeStreetNewsCooldownDistrictId(value);
  return districtId > 0 ? `District ${districtId}` : "District ?";
}

function formatStreetNewsCooldownToken(value, fallback = "Akce") {
  const text = String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return fallback;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const STREET_NEWS_BUILDING_LABELS = Object.freeze({
  "bytovy blok": "Bytový blok",
  garage: "Garáž",
  garaz: "Garáž",
  "rekrutacni centrum": "Rekrutační centrum",
  klinika: "Klinika",
  skola: "Škola",
  restaurace: "Restaurace",
  "fitness club": "Fitness Club",
  herna: "Herna",
  smenarna: "Směnárna",
  autosalon: "Autosalon",
  "obchodni centrum": "Obchodní centrum",
  kasino: "Kasino",
  "poulicni dealeri": "Pouliční dealeři",
  vecerka: "Večerka",
  "pasovaci tunel": "Pašovací tunel",
  burza: "Burza",
  "centralni banka": "Centrální banka",
  magistrat: "Magistrát",
  "lobby klub": "Lobby klub",
  "lobby club": "Lobby Club",
  soud: "Soud",
  "vip salonek": "VIP salonek",
  letiste: "Letiště",
  pristav: "Přístav",
  parlament: "Parlament",
  "strip club": "Strip club",
  sklad: "Sklad",
  skladiste: "Skladiště",
  "energeticka stanice": "Energetická stanice",
  "recyklacni centrum": "Recyklační centrum",
  lekarna: "Lékárna",
  "drug lab": "Drug Lab",
  lab: "Lab",
  tovarna: "Továrna",
  zbrojovka: "Zbrojovka"
});

function resolveStreetNewsBuildingLabel(buildingKey, fallback = "Budova") {
  const normalizedKey = resolveDistrictBuildingCanonicalLookupKey(buildingKey);
  const profile = normalizedKey ? DISTRICT_BUILDING_DETAIL_PROFILES[normalizedKey] : null;
  const label = profile?.displayName || profile?.label || "";
  return label || STREET_NEWS_BUILDING_LABELS[normalizedKey] || STREET_NEWS_BUILDING_LABELS[String(buildingKey || "").trim()] || formatStreetNewsCooldownToken(buildingKey, fallback);
}

function resolveStreetNewsBuildingActionDescriptor(buildingKey, actionKey) {
  const normalizedKey = resolveDistrictBuildingCanonicalLookupKey(buildingKey);
  const profile = normalizedKey ? DISTRICT_BUILDING_DETAIL_PROFILES[normalizedKey] : null;
  const actions = Array.isArray(profile?.actions) ? profile.actions : [];

  for (let index = 0; index < actions.length; index += 1) {
    const actionLabel = actions[index];
    const actionProfile = getDistrictBuildingSpecialActionProfile(normalizedKey || buildingKey, index);
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: normalizedKey || buildingKey,
      actionLabel,
      actionIndex: index,
      actionProfile
    });

    if (String(definition.actionId || "") === String(actionKey || "") || String(index) === String(actionKey || "")) {
      return {
        actionIndex: index,
        actionLabel: definition.label || actionLabel || formatStreetNewsCooldownToken(actionKey, "Akce"),
        actionProfile,
        definition
      };
    }
  }

  return {
    actionIndex: 0,
    actionLabel: formatStreetNewsCooldownToken(actionKey, "Akce"),
    actionProfile: null,
    definition: null
  };
}

function formatStreetNewsCooldownRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteLabel = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const secondLabel = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}h ${minuteLabel}:${secondLabel}` : `${minuteLabel}:${secondLabel}`;
}

function createStreetNewsBuildingCooldownResultPayload({
  districtId,
  buildingKey,
  buildingLabel,
  actionLabel,
  actionProfile,
  definition,
  expiresAt,
  now
}) {
  if (!actionProfile || typeof actionProfile !== "object") {
    return null;
  }

  const district = districtId ? getRuntimeDistrictApi()?.getDistrictById?.(districtId) : null;
  const mechanics = resolveDistrictBuildingDetailMechanics(district, buildingLabel || buildingKey);
  const formatterOptions = {
    mechanics,
    formatMoney: formatDistrictBuildingMoney,
    formatCooldown: formatDistrictBuildingCooldown
  };
  const rewardSummary = formatBuildingActionOutputProfile(actionProfile, formatterOptions)
    || definition?.rewardSummary
    || "Bez přímého zisku.";
  const riskSummary = formatBuildingActionRiskProfile(actionProfile, formatterOptions)
    || definition?.riskSummary
    || "Bez přímého rizika.";
  const remainingLabel = formatStreetNewsCooldownRemaining(expiresAt - now);

  return {
    openable: true,
    syncToBuildingAction: false,
    tone: "event",
    title: `${actionLabel} běží`,
    badge: "Čekání",
    summary: `${formatStreetNewsCooldownDistrict(districtId)} · ${buildingLabel}`,
    districtId,
    districtType: normalizeStreetNewsDistrictType(district?.districtType) || "unknown",
    rows: [
      { label: "Budova", value: buildingLabel },
      { label: "District", value: formatStreetNewsCooldownDistrict(districtId) },
      { label: "Efekt", value: rewardSummary },
      { label: "Riziko", value: riskSummary },
      { label: "Čekání", value: remainingLabel, nowrap: true, countdownUntil: expiresAt }
    ]
  };
}

function createStreetNewsCooldownEntry({
  id,
  title,
  summary,
  meta,
  expiresAt,
  now,
  resultKind = "",
  resultPayload = null,
  districtType = ""
}) {
  return createBuildingActionEntry({
    id,
    tone: "event",
    title,
    summary,
    meta: meta || `Čekání ${formatStreetNewsCooldownRemaining(expiresAt - now)}`,
    sourceKind: "cooldown",
    dismissible: false,
    persistent: true,
    compact: true,
    timestampMs: expiresAt,
    districtType,
    resultKind,
    resultPayload
  });
}

function appendStreetNewsCooldownEntry(entries, payload, now) {
  const expiresAt = parseStreetNewsCooldownTimestamp(payload?.expiresAt);
  if (!expiresAt || expiresAt <= now) {
    return;
  }

  entries.push(createStreetNewsCooldownEntry({
    ...payload,
    expiresAt,
    now
  }));
}

function readStreetNewsCooldownArray(factory) {
  try {
    const value = typeof factory === "function" ? factory() : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readStreetNewsCooldownObject(factory) {
  try {
    const value = typeof factory === "function" ? factory() : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function collectMissionCooldownStreetNewsEntries(now) {
  const entries = [];
  const appendOrder = (kind, title, order, expiresKey, summaryFactory) => {
    const expiresAt = parseStreetNewsCooldownTimestamp(order?.[expiresKey]);
    if (!expiresAt || expiresAt <= now) {
      return;
    }
    appendStreetNewsCooldownEntry(entries, {
      id: `cooldown:${kind}:${String(order?.id || `${order?.sourceDistrictId || ""}:${order?.targetDistrictId || ""}:${expiresAt}`)}`,
      title,
      summary: summaryFactory(order),
      meta: `Čekání ${formatStreetNewsCooldownRemaining(expiresAt - now)}`,
      expiresAt
    }, now);
  };

  for (const order of readStreetNewsCooldownArray(getStoredAttackOrders)) {
    appendOrder("attack", "Útok", order, "resolveAt", (entry) =>
      formatStreetNewsCooldownDistrict(entry?.targetDistrictId)
    );
  }

  for (const order of readStreetNewsCooldownArray(getStoredOccupyOrders)) {
    appendOrder("occupy", "Obsazení", order, "resolveAt", (entry) =>
      `${formatStreetNewsCooldownDistrict(entry?.targetDistrictId)} je obsazován`
    );
  }

  for (const order of readStreetNewsCooldownArray(getStoredRobberyOrders)) {
    appendOrder("robbery", "Vykrást district", order, "resolveAt", (entry) =>
      formatStreetNewsCooldownDistrict(entry?.targetDistrictId)
    );
  }

  const spyState = readStreetNewsCooldownObject(getResolvedSpyState);
  const spyMissions = Array.isArray(spyState.missions) ? spyState.missions : [];
  for (const mission of spyMissions) {
    const isCaptured = mission?.status === "captured";
    const expiresAt = parseStreetNewsCooldownTimestamp(isCaptured ? mission?.cooldownUntil : mission?.returnAt);
    if (!expiresAt || expiresAt <= now) {
      continue;
    }
    appendStreetNewsCooldownEntry(entries, {
      id: `cooldown:spy:${String(mission?.id || `${mission?.sourceDistrictId || ""}:${mission?.targetDistrictId || ""}:${expiresAt}`)}`,
      title: isCaptured ? "Špeh zajat" : "Špehování",
      summary: formatStreetNewsCooldownDistrict(mission?.targetDistrictId),
      meta: `Čekání ${formatStreetNewsCooldownRemaining(expiresAt - now)}`,
      expiresAt
    }, now);
  }

  return entries;
}

function collectTrapCooldownStreetNewsEntries(now) {
  const entries = [];
  const worldState = readStreetNewsCooldownObject(getResolvedWorldState);
  for (const [districtId, trapState] of Object.entries(worldState.districtTrapById || {})) {
    if (!trapState?.isArmed || Number(trapState.ownerId) !== CURRENT_PLAYER_ID) {
      continue;
    }
    const lastTrapActionAt = parseStreetNewsCooldownTimestamp(trapState.movedAt || trapState.armedAt);
    const expiresAt = lastTrapActionAt ? lastTrapActionAt + TRAP_MOVE_LOCK_MS : 0;
    appendStreetNewsCooldownEntry(entries, {
      id: `cooldown:trap:${districtId}`,
      title: "Past",
      summary: `Toxická past v ${formatStreetNewsCooldownDistrict(districtId)}`,
      meta: `Čekání ${formatStreetNewsCooldownRemaining(expiresAt - now)}`,
      expiresAt
    }, now);
  }
  return entries;
}

function collectBuildingCooldownStreetNewsEntries(now) {
  const entries = [];
  const state = readStreetNewsCooldownObject(getStoredDistrictBuildingDetailState);
  if (!state || typeof state !== "object") {
    return entries;
  }

  for (const [storageKey, entry] of Object.entries(state)) {
    if (!entry || typeof entry !== "object" || !entry.actionCooldowns || typeof entry.actionCooldowns !== "object") {
      continue;
    }

    const keyParts = String(storageKey || "").split(":");
    const isSharedBuildingKey = keyParts[0] === SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX.replace(":", "");
    const districtId = isSharedBuildingKey ? 0 : normalizeStreetNewsCooldownDistrictId(keyParts[0]);
    const buildingKey = keyParts.slice(1).join(":") || "budova";
    const buildingLabel = resolveStreetNewsBuildingLabel(buildingKey, "Budova");
    const districtLabel = isSharedBuildingKey ? "Sdílená budova" : formatStreetNewsCooldownDistrict(districtId);

    for (const [actionKey, rawExpiresAt] of Object.entries(entry.actionCooldowns)) {
      if (/ActiveUntil$/i.test(String(actionKey || ""))) {
        continue;
      }
      const expiresAt = parseStreetNewsCooldownTimestamp(rawExpiresAt);
      if (!expiresAt || expiresAt <= now) {
        continue;
      }
      const actionDescriptor = resolveStreetNewsBuildingActionDescriptor(buildingKey, actionKey);
      const actionLabel = actionDescriptor.actionLabel;
      const remainingLabel = formatStreetNewsCooldownRemaining(expiresAt - now);
      const resultPayload = createStreetNewsBuildingCooldownResultPayload({
        districtId,
        buildingKey,
        buildingLabel,
        actionLabel,
        actionProfile: actionDescriptor.actionProfile,
        definition: actionDescriptor.definition,
        expiresAt,
        now
      });

      appendStreetNewsCooldownEntry(entries, {
        id: `cooldown:building:${storageKey}:${actionKey}`,
        title: actionLabel,
        summary: `${districtLabel} · ${buildingLabel}`,
      meta: `Čekání ${remainingLabel}`,
        expiresAt,
        resultKind: resultPayload ? "police" : "",
        resultPayload,
        districtType: resultPayload?.districtType || ""
      }, now);
    }
  }

  return entries;
}

function createActiveCooldownStreetNewsEntries(now = Date.now()) {
  return [
    ...collectMissionCooldownStreetNewsEntries(now),
    ...collectTrapCooldownStreetNewsEntries(now),
    ...collectBuildingCooldownStreetNewsEntries(now)
  ]
    .sort((left, right) => Number(left.timestampMs || 0) - Number(right.timestampMs || 0))
    .slice(0, 16);
}

function renderBuildingActionFeed(root, { syncPreview = false, previewSnapshot = null } = {}) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  const cooldownEntries = createActiveCooldownStreetNewsEntries();
  const visibleEntries = [...cooldownEntries, ...panel.entries];

  panel.feedElement.replaceChildren(
    ...visibleEntries
      .map((entry) => createBuildingActionFeedItemElement(root.ownerDocument || document, entry, {
        removeSelector: BUILDING_ACTION_REMOVE_SELECTOR,
        onOpenResult: (selectedEntry) => queueOrOpenResultModal(root, selectedEntry.resultKind, selectedEntry.resultPayload)
      }))
      .filter(Boolean)
  );

  const hasVisibleEntries = visibleEntries.length > 0;
  const hasDismissibleEntries = panel.entries.some((entry) => entry.dismissible !== false && entry.persistent !== true);
  panel.emptyElement.hidden = hasVisibleEntries;
  panel.feedElement.hidden = !hasVisibleEntries;
  panel.clearButton.disabled = !hasDismissibleEntries;
  panel.clearButton.setAttribute("aria-disabled", hasDismissibleEntries ? "false" : "true");

  if (syncPreview) {
    const snapshot = previewSnapshot || panel.entries[0] || cooldownEntries[0] || BUILDING_ACTION_EMPTY_SNAPSHOT;
    syncBuildingActionSource(root, snapshot);
  }
}

function appendBuildingActionEntry(root, snapshot, { syncPreview = false, forceLog = false } = {}) {
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

  if (!forceLog && (!entry.resultKind || !entry.resultPayload)) {
    renderBuildingActionFeed(root, { syncPreview, previewSnapshot: entry });
    return;
  }

  if (!forceLog && panel.entries[0] && createBuildingActionFingerprint(panel.entries[0]) === fingerprint) {
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

function setBuildingActionFeedback(root, tone, title, summary, meta = "", options = {}) {
  const snapshot = normalizeBuildingActionSnapshot({
    tone,
    title,
    summary,
    meta
  });

  syncBuildingActionSource(root, snapshot);
  appendBuildingActionEntry(root, snapshot, { syncPreview: false, forceLog: Boolean(options.forceLog) });
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

  const attackResultPayload = getResultPayloadBuilders().createAttackResultPayload({
    order,
    targetDistrictId,
    trapTriggered,
    outcome,
    deployedMembers,
    memberLoss,
    currentDefense,
    nextDefense
  });
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
  if (!shouldRunLocalGameplayRuntime() || !order?.id || attackMissionTimers.has(order.id)) {
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

const LEGACY_OCCUPY_FAILURE_CHANCE = 0.05;
const LEGACY_OCCUPY_POPULATION_REFUND_RATIO = 0.1;

const LEGACY_OCCUPY_SUCCESS_MESSAGES = Object.freeze([
  "District změnil vlajku tiše. Ráno už se tam ptali jiných lidí, komu patří chodník.",
  "Ulice přes noc přepsaly pravidla. Nikdo nekřičel, ale všichni pochopili.",
  "Sektor spolkl novou posádku a vyplivl nový pořádek. Staré kontakty mlčí.",
  "Do ulic dorazily nové hlídky. Místní dělají, že je to normální.",
  "District padl bez velkého divadla. O to víc z toho město znervóznělo."
]);

const LEGACY_OCCUPY_FAILURE_MESSAGES = Object.freeze([
  "Pokus o převzetí se rozpadl v bočních ulicích. Lidi zmizeli, district zůstal volný.",
  "District dnes nikoho nepustil dovnitř. Posádka se rozsypala dřív, než stihla pověsit barvy.",
  "Někdo čekal moc dlouho na správný signál. Signál nepřišel, lidi ano.",
  "Obsazení skončilo špatným tichem. Zůstaly jen prázdné kouty a chybějící tváře.",
  "District se tentokrát nepohnul. Ulice sežraly plán i lidi, co ho nesli."
]);

function deterministicUnitIntervalFromText(value) {
  const seed = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function pickLegacyOccupyMessage(order, succeeded) {
  const pool = succeeded ? LEGACY_OCCUPY_SUCCESS_MESSAGES : LEGACY_OCCUPY_FAILURE_MESSAGES;
  const roll = deterministicUnitIntervalFromText(`${order?.id || ""}:${order?.targetDistrictId || ""}:message`);
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))] || pool[0] || "";
}

function resolveLegacyOccupyOutcome(order) {
  const populationCost = Math.max(0, Math.floor(Number(order?.populationCost || 0)));
  const failureChance = Math.max(0, Math.min(1, Number(order?.failureChance ?? LEGACY_OCCUPY_FAILURE_CHANCE)));
  const refundRatio = Math.max(0, Math.min(1, Number(order?.populationRefundRatio ?? LEGACY_OCCUPY_POPULATION_REFUND_RATIO)));
  const roll = deterministicUnitIntervalFromText(`${order?.id || ""}:${order?.targetDistrictId || ""}:outcome`);
  const succeeded = roll >= failureChance;
  const populationRefunded = succeeded ? Math.floor(populationCost * refundRatio) : 0;
  return {
    succeeded,
    populationCost,
    populationRefunded,
    populationLost: Math.max(0, populationCost - populationRefunded),
    successChancePct: Math.round((1 - failureChance) * 100),
    failureChancePct: Math.round(failureChance * 100),
    message: pickLegacyOccupyMessage(order, succeeded)
  };
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
  const occupyOutcome = resolveLegacyOccupyOutcome(order);

  setStoredSpyIntel({
    occupiableDistrictIds: spyIntel.occupiableDistrictIds.filter((districtId) => districtId !== targetDistrictId),
    revealedTypeDistrictIds: spyIntel.revealedTypeDistrictIds || [],
    revealedDefenseDistrictIds: spyIntel.revealedDefenseDistrictIds || []
  });

  if (occupyOutcome.succeeded) {
    setStoredWorldState({
      ...worldState,
      ownedDistrictIds: Array.from(new Set([...(worldState.ownedDistrictIds || []), targetDistrictId])),
      destroyedDistrictIds: (worldState.destroyedDistrictIds || []).filter((districtId) => districtId !== targetDistrictId)
    });
    window.empireStreetsDistrictState?.captureDistrict?.(targetDistrictId);
    if (occupyOutcome.populationRefunded > 0) {
      setStoredGangState({
        members: Math.max(0, Number(getResolvedGangState().members || 0)) + occupyOutcome.populationRefunded
      });
      renderGangMembersState(root);
    }
  }

  recordDistrictIntelEvent({
    type: occupyOutcome.succeeded ? "occupy_success" : "occupy_failed",
    districtId: targetDistrictId,
    sourceDistrictId: order.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel: occupyOutcome.message
  });

  const occupyResultPayload = {
    tone: occupyOutcome.succeeded ? "is-success" : "is-major-fail",
    title: occupyOutcome.succeeded ? "Obsazení: Úspěch" : "Obsazení: Neúspěch",
    summary: occupyOutcome.succeeded
      ? `${occupyOutcome.message} District ${targetDistrictId} připadl tvému gangu. Vrátilo se ${occupyOutcome.populationRefunded} populace, zbytek ceny zmizel v ulicích.`
      : `${occupyOutcome.message} District ${targetDistrictId} zůstal neobsazený a ztratil jsi ${occupyOutcome.populationLost} populace.`,
    rows: [
      { label: "Zdroj", value: String(order.sourceDistrictId || "---") },
      { label: "Cíl", value: `District ${targetDistrictId}` },
      { label: "Cena", value: `${occupyOutcome.populationCost} populace` },
      { label: "Vráceno", value: `${occupyOutcome.populationRefunded} populace` },
      { label: "Ztraceno", value: `${occupyOutcome.populationLost} populace` },
      { label: "Šance", value: `${occupyOutcome.successChancePct}% úspěch / ${occupyOutcome.failureChancePct}% neúspěch`, nowrap: true },
      { label: "Trvání", value: formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime()), nowrap: true },
      { label: "Stav districtu", value: occupyOutcome.succeeded ? "Obsazený" : "Neobsazený" }
    ]
  };
  syncBuildingActionSource(root, {
    tone: occupyOutcome.succeeded ? "success" : "warning",
    title: occupyResultPayload.title,
    summary: occupyResultPayload.summary,
    meta: `${order.sourceDistrictId} → district:${targetDistrictId} · ${occupyOutcome.succeeded ? "obsazení dokončeno" : "obsazení selhalo"}`,
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
      capturesDistrict: occupyOutcome.succeeded,
      successfulAttack: false,
      defenseReduced: occupyOutcome.succeeded
    }
  }));
}

function scheduleOccupyOrder(root, order) {
  if (!shouldRunLocalGameplayRuntime() || !order?.id || occupyMissionTimers.has(order.id)) {
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

  const robberyOutcome = resolveRobberyOrderOutcome(order);
  const scenarioLabel = robberyOutcome.scenarioLabel;
  const deployedMembers = robberyOutcome.deployedMembers;
  const memberLoss = robberyOutcome.memberLoss;
  const returningMembers = robberyOutcome.returningMembers;
  const loot = robberyOutcome.loot;
  const lootEntries = Object.entries(loot);
  setStoredGangState({
    members: getResolvedGangState().members + returningMembers
  });
  renderGangMembersState(root);
  addGangHeat(root, robberyOutcome.heatGain, `Vykrást district ${String(order.targetDistrictId || "").replace("district:", "") || "?"}`);

  if (lootEntries.length > 0) {
    for (const [itemId, amount] of lootEntries) {
      grantRobberyLootItem(itemId, amount);
    }
  }

  recordDistrictIntelEvent({
    type: robberyOutcome.success && lootEntries.length > 0 ? "raid_success" : (!robberyOutcome.success ? "raid_failed" : "raid_empty"),
    districtId: order.targetDistrictId,
    sourceDistrictId: order.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel,
    lootLabel: lootEntries.map(([itemId, amount]) => `${itemId} x${amount}`).join(", "),
    heatGain: robberyOutcome.heatGain,
    riskLevel: robberyOutcome.riskLevel,
    successChance: robberyOutcome.successChance,
    zone: robberyOutcome.zoneKey
  });

  const { raidTone, raidResultPayload } = getResultPayloadBuilders().createRobberyResultPayload({
    order,
    deployedMembers,
    memberLoss,
    lootEntries,
    heatGain: robberyOutcome.heatGain,
    riskLabel: robberyOutcome.riskLabel,
    successChance: robberyOutcome.successChance,
    zoneLabel: robberyOutcome.zoneLabel
  });
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
  if (!shouldRunLocalGameplayRuntime() || !order?.id || robberyMissionTimers.has(order.id)) {
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

function getResolvedWeaponInventory() {
  const serverInventory = getServerInventoryGroup("weapons", DEFAULT_WEAPON_INVENTORY);
  if (serverInventory) {
    return serverInventory;
  }
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
  if (productionTimers.has(jobId)) {
    const timerId = productionTimers.get(jobId);
    const clearTimer = typeof window !== "undefined" && typeof window.clearTimeout === "function" ? window.clearTimeout.bind(window) : globalThis.clearTimeout;
    if (typeof clearTimer === "function") clearTimer(timerId);
    productionTimers.delete(jobId);
  }

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

function normalizeStorageResourceKey(itemId) {
  return ({
    metalParts: "metal-parts",
    techCore: "tech-core",
    combatModule: "combat-module"
  })[itemId] || String(itemId || "").trim();
}

function getInventoryCapacity(itemId) {
  const canonicalKey = normalizeStorageResourceKey(itemId);
  const summary = getGameplayStorageSummary();
  for (const group of summary?.groups || []) {
    const item = (group.items || []).find((entry) => entry.resourceKey === canonicalKey);
    if (item) return Math.max(0, Math.floor(Number(item.maxAmount || 0)));
  }
  return 0;
}

function getReceivableInventoryOutputAmount(output, requestedAmount = output?.amount) {
  if (!output?.itemId) return 0;
  const capacity = getInventoryCapacity(output.itemId);
  if (capacity <= 0) return 0;
  const currentAmount = Math.max(0, Math.floor(Number(getInventoryAmount(output.inventory, output.itemId) || 0)));
  return Math.max(0, Math.min(
    Math.max(0, Math.floor(Number(requestedAmount || 0))),
    capacity - currentAmount
  ));
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

function getScaledProductionInputs(inputs = {}, multiplier = 1) {
  return Object.fromEntries(Object.entries(inputs).map(([itemId, amount]) => [itemId, Number(amount || 0) * Math.max(1, Math.floor(Number(multiplier || 1)))]));
}

function syncCompletedProductionJobs() {
  const productionState = getResolvedProductionState();
  let hasChanges = false;

  for (const [jobId, job] of Object.entries(productionState)) {
    const result = advanceLocalProductionJob(job, Date.now());
    if (result.changed && result.job) {
      productionState[jobId] = result.job;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    setStoredProductionState(productionState);
    document?.dispatchEvent?.(new CustomEvent("empire:production-state-change", {
      detail: { source: "local-production-jobs" }
    }));
  }
}

function advanceLocalProductionJobForE2e(jobId, unitCount = 1) {
  if (typeof window === "undefined" || window.__EMPIRE_E2E__ !== true) return false;
  const count = Math.max(1, Math.floor(Number(unitCount || 1)));
  for (let index = 0; index < count; index += 1) {
    const job = normalizeLocalProductionJob(getProductionJob(jobId));
    if (!job?.isProducing || Number(job.queuedAmount || 0) <= 0) break;
    persistProductionJob(jobId, { ...job, readyAtMs: Date.now() - 1 });
    syncCompletedProductionJobs();
  }
  return true;
}

function advanceFactoryProductionForE2e(resourceKey, elapsedMs = 20 * 60 * 1000) {
  if (typeof window === "undefined" || window.__EMPIRE_E2E__ !== true) return false;
  const factoryState = getStoredFactoryState();
  const targetSlot = factoryState.slots.find((slot) => slot.resourceKey === resourceKey);
  if (!targetSlot) return false;
  targetSlot.lastTick = Date.now() - Math.max(1_000, Math.floor(Number(elapsedMs || 0)));
  const result = syncFactoryProduction(factoryState, Date.now());
  setStoredFactoryState(result.state);
  document.dispatchEvent(new CustomEvent("empire:production-state-change", {
    detail: { source: "local-factory-e2e-clock" }
  }));
  return true;
}

function scheduleProductionJob(jobId, rerender) {
  if (!shouldRunLocalGameplayRuntime()) {
    return;
  }
  if (productionTimers.has(jobId)) {
    const timerId = productionTimers.get(jobId);
    const clearTimer = typeof window !== "undefined" && typeof window.clearTimeout === "function" ? window.clearTimeout.bind(window) : globalThis.clearTimeout;
    if (typeof clearTimer === "function") clearTimer(timerId);
    productionTimers.delete(jobId);
  }

  const job = normalizeLocalProductionJob(getProductionJob(jobId));

  if (!job || !job.isProducing || !job.readyAtMs) {
    return;
  }

  const remainingMs = job.readyAtMs - Date.now();

  if (remainingMs <= 0) {
    const result = advanceLocalProductionJob(job, Date.now());
    if (result.job) persistProductionJob(jobId, result.job);
    rerender();
    if (result.job?.isProducing) scheduleProductionJob(jobId, rerender);
    return;
  }

  const timerId = window.setTimeout(() => {
    productionTimers.delete(jobId);
    const currentJob = normalizeLocalProductionJob(getProductionJob(jobId));

    if (currentJob?.isProducing) {
      const result = advanceLocalProductionJob(currentJob, Date.now());
      if (result.job) persistProductionJob(jobId, result.job);
      rerender();
      if (result.job?.isProducing) scheduleProductionJob(jobId, rerender);
    }
  }, remainingMs);

  productionTimers.set(jobId, timerId);
}

function scheduleStoredProductionJobs(root = getDefaultRuntimeRoot()) {
  syncCompletedProductionJobs();

  const productionState = getResolvedProductionState();
  const rerender = () => refreshAllUi(hydrateInitialState(root));

  for (const [jobId, job] of Object.entries(productionState)) {
    if (normalizeLocalProductionJob(job)?.isProducing) {
      scheduleProductionJob(jobId, rerender);
    }
  }
}

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
    const job = normalizeLocalProductionJob(getProductionJob(`${buildingName}:${recipeId}`));
    return total + (Number(job?.producedAmount || 0) > 0 ? 1 : 0);
  }, 0);
}

function collectReadyProductionForBuilding(buildingName, recipes) {
  let collected = 0;
  let remaining = 0;
  const items = [];

  for (const recipeId of Object.keys(recipes || {})) {
    const jobKey = `${buildingName}:${recipeId}`;
    const job = normalizeLocalProductionJob(getProductionJob(jobKey));

    if (!job || job.producedAmount <= 0) {
      continue;
    }

    const receivableAmount = getReceivableInventoryOutputAmount(job.output, job.producedAmount);
    const result = collectLocalProduction(job, receivableAmount, Date.now());
    if (result.collectedAmount <= 0) {
      remaining += result.remainingAmount;
      continue;
    }
    applyInventoryOutput({ ...job.output, amount: result.collectedAmount });
    if (result.job?.queuedAmount > 0 || result.job?.producedAmount > 0) {
      persistProductionJob(jobKey, result.job);
      if (result.job.isProducing) {
        scheduleProductionJob(jobKey, () => refreshAllUi(hydrateInitialState(getDefaultRuntimeRoot())));
      }
    } else {
      clearProductionJob(jobKey);
    }
    collected += result.collectedAmount;
    remaining += result.remainingAmount;
    items.push({ label: getProductionResourceLabel(job.output?.itemId), amount: result.collectedAmount });
  }

  return { total: collected, remaining, partial: remaining > 0, items };
}

const {
  bindArmoryPopup,
  bindDrugLabPopup,
  bindPharmacyPopup,
  bindProductionBuildingPopup,
  createProductionCard,
  getProductionSlotState,
  renderProductionBuildingInfo,
  renderProductionPanel
} = createProductionBuildingPopupRuntime({
  allowLegacyLocalProduction: isLocalDemoGameplayExecutionMode(),
  allowLegacyProductionUpgrade: isLocalDemoGameplayExecutionMode(),
  isServerAuthoritativeGameplayRuntimeReady,
  ARMORY_POPUP_CLOSE_SELECTOR,
  ARMORY_POPUP_OPEN_SELECTOR,
  ARMORY_POPUP_SELECTOR,
  ARMORY_RECIPES,
  DRUGLAB_POPUP_CLOSE_SELECTOR,
  DRUGLAB_POPUP_OPEN_SELECTOR,
  DRUGLAB_POPUP_SELECTOR,
  DRUGLAB_RECIPES,
  HTMLButtonElement: typeof HTMLButtonElement !== "undefined" ? HTMLButtonElement : null,
  PHARMACY_POPUP_CLOSE_SELECTOR,
  PHARMACY_POPUP_OPEN_SELECTOR,
  PHARMACY_POPUP_SELECTOR,
  PHARMACY_RECIPES,
  PRODUCTION_BUILDING_CONFIG,
  PRODUCTION_SLOT_VISUALS,
  appendBuildingActionResultEntry,
  applyInventoryOutput,
  applyTopbarEconomy,
  clearProductionJob,
  collectReadyProductionForBuilding,
  consumeMaterials,
  createProductionBuildingInfoViewModel,
  createStorageCollectResultPayload,
  documentRef: typeof document === "undefined" ? null : document,
  formatCurrency,
  formatDurationLabel,
  getInventoryAmount,
  getInventoryCapacity,
  getProductionBuildingEffectsLabel,
  getProductionBuildingMultiplier,
  getProductionBuildingReadyCount,
  getProductionBuildingUpgradeCost,
  getProductionJob,
  getProductionResourceLabel,
  getServerArmoryReadModel,
  getServerDrugLabReadModel,
  getServerPharmacyReadModel,
  getServerTickRateMs,
  getOwnedArmoryCount: () => getOwnedSpecialProductionBuildingCount("zbrojovka"),
  getOwnedDrugLabCount: () => getOwnedSpecialProductionBuildingCount("drug lab"),
  getOwnedPharmacyCount: () => getOwnedSpecialProductionBuildingCount("lekarna"),
  getArmoryRecipeStrengthPreview,
  getResolvedEconomyState,
  getScaledProductionInputs,
  getStoredProductionBuildingState,
  hasEnoughMaterials,
  maxLevel: 14,
  normalizeProductionResourceColorKey,
  persistProductionJob,
  renderProductionBuildingInfoPanel,
  renderProductionPanelUi,
  renderRecipeCard,
  scheduleProductionJob,
  selectors: {
    collect: PRODUCTION_BUILDING_COLLECT_SELECTOR,
    effects: PRODUCTION_BUILDING_EFFECTS_SELECTOR,
    headerLevel: PRODUCTION_BUILDING_HEADER_LEVEL_SELECTOR,
    infoActions: PRODUCTION_BUILDING_INFO_ACTIONS_SELECTOR,
    infoEffects: PRODUCTION_BUILDING_INFO_EFFECTS_SELECTOR,
    infoText: PRODUCTION_BUILDING_INFO_TEXT_SELECTOR,
    level: PRODUCTION_BUILDING_LEVEL_SELECTOR,
    multiplier: PRODUCTION_BUILDING_MULTIPLIER_SELECTOR,
    panel: PRODUCTION_BUILDING_PANEL_SELECTOR,
    ready: PRODUCTION_BUILDING_READY_SELECTOR,
    tab: PRODUCTION_BUILDING_TAB_SELECTOR,
    upgrade: PRODUCTION_BUILDING_UPGRADE_SELECTOR,
    upgradeCost: PRODUCTION_BUILDING_UPGRADE_COST_SELECTOR
  },
  setInventoryAmount,
  setBuildingActionFeedback,
  setStoredEconomyState,
  setStoredProductionBuildingState,
  submitServerPharmacyCommand,
  submitServerDrugLabCommand,
  submitServerArmoryCommand,
  syncBuildingDetailTopbarVisibility,
  syncCompletedProductionJobs
});

function collectFactoryOutputsToSupplies() {
  const syncResult = syncFactoryProduction(getStoredFactoryState());
  const nextState = syncResult.state;
  const nextSupplies = getStoredFactorySupplies();
  let collected = 0;
  let remaining = 0;
  const items = [];

  for (const slot of nextState.slots || []) {
    const amount = Math.max(0, Math.floor(Number(slot?.producedAmount || 0)));

    if (amount <= 0 || !slot?.resourceKey) {
      continue;
    }

    const acceptedAmount = getReceivableInventoryOutputAmount({
      inventory: "materials",
      itemId: slot.resourceKey,
      amount
    }, amount);
    if (acceptedAmount > 0) {
      nextSupplies[slot.resourceKey] = Math.max(0, Math.floor(Number(nextSupplies[slot.resourceKey] || 0) + acceptedAmount));
      nextState.resources[slot.resourceKey] = Math.max(0, Math.floor(Number(nextState.resources[slot.resourceKey] || 0) - acceptedAmount));
      slot.producedAmount = Math.max(0, amount - acceptedAmount);
      collected += acceptedAmount;
      items.push({ label: FACTORY_SLOT_CONFIG.find((entry) => entry.resourceKey === slot.resourceKey)?.label || getProductionResourceLabel(slot.resourceKey), amount: acceptedAmount });
    }
    remaining += Math.max(0, amount - acceptedAmount);
    if (slot.queuedAmount > 0 && slot.producedAmount < slot.slotCap) {
      slot.isProducing = true;
      slot.lastTick = Date.now();
      slot.productionRemainder = 0;
    }
  }

  setStoredFactoryState(nextState);
  setStoredFactorySupplies(nextSupplies);
  return { total: collected, remaining, partial: remaining > 0, items };
}

function getProductionResourceLabel(itemId) {
  return PRODUCTION_RESOURCE_LABELS[itemId] || String(itemId || "").trim() || "Materiál";
}

function normalizeProductionResourceColorKey(itemId) {
  const normalized = String(itemId || "").trim();
  const aliases = {
    metalParts: "metal-parts",
    techCore: "tech-core",
    combatModule: "combat-module"
  };
  return aliases[normalized] || normalized;
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

function getRobberyLootInventoryName(itemId) {
  const normalizedItemId = String(itemId || "").trim();
  if (Object.prototype.hasOwnProperty.call(DEFAULT_DRUG_INVENTORY, normalizedItemId)) {
    return "drugs";
  }
  if (Object.prototype.hasOwnProperty.call(DEFAULT_WEAPON_INVENTORY, normalizedItemId)) {
    return "weapons";
  }
  return "materials";
}

function grantRobberyLootItem(itemId, amount) {
  const normalizedItemId = String(itemId || "").trim();
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (!normalizedItemId || safeAmount <= 0) {
    return;
  }

  const inventoryName = getRobberyLootInventoryName(normalizedItemId);
  setInventoryAmount(
    inventoryName,
    normalizedItemId,
    getInventoryAmount(inventoryName, normalizedItemId) + safeAmount
  );
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

function createFixedInventoryAmountMap(template = {}, amount = 0) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  return Object.keys(template || {}).reduce((accumulator, key) => {
    accumulator[key] = safeAmount;
    return accumulator;
  }, {});
}

function createFixedFactorySupplyAmountMap(amount = 0) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  return FACTORY_RESOURCE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = safeAmount;
    return accumulator;
  }, {});
}

function getFactorySlotBaseStorageCap(resourceKey) {
  return Math.max(1, Math.floor(Number(FACTORY_SLOT_STORAGE_CAPS?.[resourceKey] || FACTORY_SLOT_STORAGE_CAP)));
}

function getProductionNetworkBaseOwnedCount() {
  return 1;
}

function normalizeProductionCapacityCount(value, fallback = 0, minValue = 0) {
  const normalized = Math.floor(Number(value));
  if (Number.isFinite(normalized)) {
    return Math.max(minValue, normalized);
  }

  const normalizedFallback = Math.floor(Number(fallback));
  return Number.isFinite(normalizedFallback) ? Math.max(minValue, normalizedFallback) : minValue;
}

function getOwnedSpecialProductionBuildingCount(baseName) {
  if (typeof window === "undefined") {
    return getProductionNetworkBaseOwnedCount();
  }

  return Math.max(getProductionNetworkBaseOwnedCount(), getOwnedDistrictBuildingCountByBaseName(baseName));
}

function createFactoryCapacityOptions(options = {}) {
  return {
    ownedFactoryCount: normalizeProductionCapacityCount(
      options.ownedFactoryCount ?? getOwnedSpecialProductionBuildingCount("tovarna"),
      getProductionNetworkBaseOwnedCount(),
      getProductionNetworkBaseOwnedCount()
    )
  };
}

function getGameplayStorageSummary() {
  const serverSummary = isLocalDemoGameplayExecutionMode() ? null : getServerStorageSummary();
  if (serverSummary) return serverSummary;
  const ownedWarehouseCount = getOwnedWarehouseCount();
  const network = getWarehouseNetworkMultipliers(ownedWarehouseCount);
  const capacity = getWarehouseCapacityBreakdown(ownedWarehouseCount);
  const usage = getWarehouseStorageUsage(capacity);
  const groups = Object.entries(WAREHOUSE_STORAGE_CONFIG.groups || {}).map(([id, group]) => {
    const currentCapacity = Math.max(0, Number(capacity.groups?.[id] || 0));
    return {
      id,
      label: group.label,
      baseCapacity: group.baseCapacity,
      currentCapacity,
      items: (group.resourceKeys || []).map((resourceKey) => {
        const currentAmount = Math.max(0, Math.floor(Number(usage.byResource?.[resourceKey] || 0)));
        const fillPercent = currentCapacity > 0 ? currentAmount / currentCapacity * 100 : 0;
        return {
          resourceKey,
          label: getProductionResourceLabel(resourceKey),
          currentAmount,
          maxAmount: currentCapacity,
          fillPercent,
          isNearCapacity: currentAmount >= currentCapacity * 0.8 && currentAmount < currentCapacity,
          isFull: currentAmount === currentCapacity,
          isOverCapacity: currentAmount > currentCapacity
        };
      })
    };
  });
  return {
    warehouseSummary: {
      ownedWarehouseCount,
      highestWarehouseLevel: network.highestLevel,
      warehouseCountMultiplier: network.warehouseCountMultiplier,
      warehouseLevelMultiplier: network.warehouseLevelMultiplier,
      totalCapacityMultiplier: network.storageCapacityMultiplier
    },
    groups
  };
}

function getFactoryRecipeForResource(resourceKey) {
  const slotConfig = FACTORY_SLOT_CONFIG.find((slot) => slot.resourceKey === resourceKey);
  return FACTORY_CONFIG.recipes?.[slotConfig?.recipeId] || null;
}

function getFactorySlotOutputCap(resourceKey) {
  return Math.max(1, Math.floor(Number(
    getFactoryRecipeForResource(resourceKey)?.localOutputCap || getFactorySlotBaseStorageCap(resourceKey)
  )));
}

function getFactorySlotQueueCap(resourceKey) {
  return Math.max(1, Math.floor(Number(
    getFactoryRecipeForResource(resourceKey)?.queueCap || getFactorySlotBaseStorageCap(resourceKey)
  )));
}

function createFactoryDefaultSlot(slot, now = Date.now(), options = {}) {
  return {
    id: slot.id,
    recipeId: slot.recipeId,
    resourceKey: slot.resourceKey,
    mode: slot.mode,
    isProducing: false,
    queueMode: true,
    queuedAmount: 0,
    producedAmount: 0,
    productionRemainder: 0,
    reservedCleanCash: 0,
    reservedInputs: {},
    slotCap: getFactorySlotOutputCap(slot.resourceKey),
    queueCap: getFactorySlotQueueCap(slot.resourceKey),
    lastTick: now
  };
}

function createFactoryDefaultState(now = Date.now(), options = {}) {
  return {
    level: 1,
    resources: createFactoryResourceMap(),
    slots: FACTORY_SLOT_CONFIG.map((slot) => createFactoryDefaultSlot(slot, now, options)),
    updatedAt: now
  };
}

function sanitizeFactoryState(rawState, now = Date.now(), options = {}) {
  const capacityOptions = createFactoryCapacityOptions(options);
  const fallback = createFactoryDefaultState(now, capacityOptions);
  return {
    ...fallback,
    ...(rawState || {}),
    level: Math.max(1, Math.min(FACTORY_CONFIG.maxLevel, Math.floor(Number(rawState?.level || 1)))),
    resources: createFactoryResourceMap(rawState?.resources),
    slots: FACTORY_SLOT_CONFIG.map((slot, index) => {
      const source = Array.isArray(rawState?.slots) ? rawState.slots[index] : null;
      const outputCap = getFactorySlotOutputCap(slot.resourceKey);
      const queueCap = getFactorySlotQueueCap(slot.resourceKey);
      const queuedAmount = Math.max(0, Math.floor(Number(source?.queuedAmount || 0)));
      return {
        ...createFactoryDefaultSlot(slot, now, capacityOptions),
        ...(source || {}),
        id: slot.id,
        recipeId: slot.recipeId,
        resourceKey: slot.resourceKey,
        mode: slot.mode,
        isProducing: queuedAmount > 0 && source?.isProducing !== false,
        queueMode: true,
        queuedAmount,
        producedAmount: Math.max(0, Math.floor(Number(source?.producedAmount || 0))),
        productionRemainder: Math.max(0, Number(source?.productionRemainder || 0)),
        reservedCleanCash: Math.max(0, Math.floor(Number(source?.reservedCleanCash || 0))),
        reservedInputs: createFactoryResourceMap(source?.reservedInputs),
        slotCap: outputCap,
        queueCap,
        lastTick: Math.max(0, Math.floor(Number(source?.lastTick || now)))
      };
    }),
    updatedAt: Math.max(0, Math.floor(Number(rawState?.updatedAt || now)))
  };
}

function getStoredFactoryState() {
  return sanitizeFactoryState(getAuthoritySession().production.factory, Date.now(), createFactoryCapacityOptions());
}

function setStoredFactoryState(payload) {
  updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      factory: sanitizeFactoryState(payload, Date.now(), createFactoryCapacityOptions())
    }
  }));
}

function getStoredFactorySupplies() {
  const balances = getServerPlayerResourceBalances();
  if (balances) {
    return createFactoryPlayerSupplyMap({
      metalParts: balances["metal-parts"] ?? balances.metalParts,
      techCore: balances["tech-core"] ?? balances.techCore,
      combatModule: balances["combat-module"] ?? balances.combatModule
    });
  }
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
  const rawCost = FACTORY_CONFIG.upgradeBaseCost * Math.pow(FACTORY_CONFIG.upgradeCostGrowth, safeLevel - 2);
  const roundTo = Math.max(1, Number(FACTORY_CONFIG.upgradeRoundCostTo || 1));
  return Math.max(roundTo, Math.round(rawCost / roundTo) * roundTo);
}

function getFactoryLevelMultiplier(level) {
  const safeLevel = Math.max(1, Math.min(FACTORY_CONFIG.maxLevel, Math.floor(Number(level) || 1)));
  return 1 + (safeLevel - 1) * FACTORY_CONFIG.upgradePctPerLevel;
}

function calculateFactoryProductionRates(levelMultiplier = 1) {
  const multiplier = Math.max(0, Number(levelMultiplier) || 0);
  const slotDurationMs = FACTORY_CONFIG.slotDurationMs || {};
  return {
    metalPartsPerHour: ((60 * 60 * 1000) / Math.max(1, Number(slotDurationMs.metalParts || 4 * 60 * 1000))) * multiplier,
    techCorePerHour: ((60 * 60 * 1000) / Math.max(1, Number(slotDurationMs.techCore || 8 * 60 * 1000))) * multiplier,
    combatModulePerHour: ((60 * 60 * 1000) / Math.max(1, Number(slotDurationMs.combatModule || 15 * 60 * 1000))) * multiplier
  };
}

function getFactorySlotProductionDurationMs(resourceKey, productionMultiplier = 1) {
  const slotDurationMs = FACTORY_CONFIG.slotDurationMs || {};
  const fallbackDurationMs = resourceKey === "metalParts"
    ? 4 * 60 * 1000
    : resourceKey === "techCore"
      ? 8 * 60 * 1000
      : 15 * 60 * 1000;
  const baseDurationMs = Math.max(1, Number(slotDurationMs[resourceKey] || fallbackDurationMs));
  return Math.max(1, Math.round(baseDurationMs / Math.max(0.1, Number(productionMultiplier) || 1)));
}

function syncFactoryProduction(instanceState, now = Date.now(), options = {}) {
  const capacityOptions = createFactoryCapacityOptions(options);
  const stateRef = sanitizeFactoryState(instanceState, now, capacityOptions);
  const nowMs = Math.max(0, Math.floor(Number(now) || Date.now()));
  const ownedFactoryCount = capacityOptions.ownedFactoryCount;
  const networkCountKey = Math.min(4, Math.max(1, ownedFactoryCount));
  const networkMultiplier = Math.min(
    Number(FACTORY_CONFIG.network?.maxSpeedMultiplier || 1),
    Number(FACTORY_CONFIG.network?.speedMultipliers?.[networkCountKey] || 1)
  );
  const networkProductionBonusPct = Math.max(0, (networkMultiplier - 1) * 100);
  const levelMultiplier = getFactoryLevelMultiplier(stateRef.level);
  const effectiveProductionMultiplier = Math.max(0.1, levelMultiplier * networkMultiplier);
  const rates = calculateFactoryProductionRates(effectiveProductionMultiplier);
  const produced = createFactoryResourceMap({}, false);

  stateRef.slots.forEach((slot) => {
    let from = Number(slot.lastTick || nowMs);
    if (!Number.isFinite(from) || from > nowMs) {
      from = nowMs;
    }
    const queueRemaining = Math.max(0, Math.floor(Number(slot.queuedAmount || 0)));
    const currentAmount = Math.max(0, Math.floor(Number(slot.producedAmount || 0)));
    const slotSpace = Math.max(0, Math.floor(Number(slot.slotCap || getFactorySlotOutputCap(slot.resourceKey))) - currentAmount);
    if (queueRemaining <= 0 || slotSpace <= 0) {
      slot.isProducing = false;
      slot.lastTick = nowMs;
      return;
    }
    slot.isProducing = true;
    const elapsedMs = Math.max(0, nowMs - from);
    if (elapsedMs <= 0) {
      slot.lastTick = nowMs;
      return;
    }
    const scaledDurationMs = getFactorySlotProductionDurationMs(slot.resourceKey, effectiveProductionMultiplier);
    const rawCycles = elapsedMs / scaledDurationMs + Number(slot.productionRemainder || 0);
    const completed = Math.min(Math.max(0, Math.floor(rawCycles)), queueRemaining, slotSpace);
    if (completed > 0) {
      const recipe = getFactoryRecipeForResource(slot.resourceKey) || {};
      const inputs = recipe.inputs || {};
      slot.producedAmount = currentAmount + completed;
      slot.queuedAmount = queueRemaining - completed;
      slot.reservedCleanCash = Math.max(0, Number(slot.reservedCleanCash || 0) - completed * Number(recipe.cleanMoneyCost || 0));
      slot.reservedInputs = {
        ...slot.reservedInputs,
        metalParts: Math.max(0, Number(slot.reservedInputs?.metalParts || 0) - completed * Number(inputs["metal-parts"] || 0)),
        techCore: Math.max(0, Number(slot.reservedInputs?.techCore || 0) - completed * Number(inputs["tech-core"] || 0)),
        combatModule: Math.max(0, Number(slot.reservedInputs?.combatModule || 0) - completed * Number(inputs["combat-module"] || 0))
      };
      stateRef.resources[slot.resourceKey] = Math.max(0, Math.floor(Number(stateRef.resources[slot.resourceKey] || 0) + completed));
      produced[slot.resourceKey] = Math.max(0, Math.floor(Number(produced[slot.resourceKey] || 0) + completed));
      slot.productionRemainder = completed === Math.floor(rawCycles) ? Math.max(0, rawCycles - completed) : 0;
      slot.isProducing = slot.queuedAmount > 0 && slot.producedAmount < slot.slotCap;
    } else {
      slot.productionRemainder = Math.max(0, rawCycles);
    }
    slot.lastTick = nowMs;
  });

  stateRef.updatedAt = nowMs;
  return {
    state: stateRef,
    rates,
    produced,
    ownedFactoryCount,
    ownedWarehouseCount: 0,
    networkProductionBonusPct,
    productionMultiplier: effectiveProductionMultiplier
  };
}

function getFactoryActiveBoost(now = Date.now()) {
  if (!isLocalDemoGameplayExecutionMode()) return null;
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
  if (!isLocalDemoGameplayExecutionMode()) {
    return { ok: false, reason: "Demo boost je v serverovém režimu vypnutý." };
  }
  const boostConfig = DEMO_FACTORY_COMBAT_BOOSTS[boostType];
  if (!boostConfig) {
    return { ok: false, reason: "Neznámý boost." };
  }
  const supplies = getStoredFactorySupplies();
  const currentModules = Math.max(0, Math.floor(Number(supplies.combatModule || 0)));
  if (currentModules < boostConfig.combatModuleCost) {
    return { ok: false, reason: `Chybí ${boostConfig.combatModuleCost - currentModules} bojový modul.` };
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
    const config = activeBoost.config || DEMO_FACTORY_COMBAT_BOOSTS[activeBoost.type] || {};
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

function resolveDistrictActionCooldownView(baseMs = 0, category = "", extraSpeedPct = 0) {
  const baseCooldownMs = Math.max(0, Math.floor(Number(baseMs || 0)));
  const supportView = resolveCombinedEffectiveCooldownMs({
    baseCooldownMs,
    garageSupport: getGarageSupportStats(getOwnedGarageCount()),
    garageCategory: category,
    autoSalonSupport: getAutoSalonSupportStats(getOwnedAutoSalonCount()),
    autoSalonCategory: category
  });
  const speedPct = Math.max(0, Number(extraSpeedPct || 0));
  const effectiveCooldownMs = speedPct > 0
    ? Math.max(1000, Math.ceil(supportView.effectiveCooldownMs * (1 - speedPct / 100)))
    : supportView.effectiveCooldownMs;

  return {
    ...supportView,
    baseCooldownMs,
    effectiveCooldownMs,
    label: formatGarageEffectiveCooldownLabel({
      baseCooldownMs,
      effectiveCooldownMs,
      formatCooldown: formatDistrictBuildingCooldown
    })
  };
}

function getAttackActionDurationMs(baseMs = ATTACK_COOLDOWN_MS) {
  return resolveDistrictActionCooldownView(baseMs, "attackPreparation", 0).effectiveCooldownMs;
}

function getSpyActionDurationMs(baseMs = SPY_COOLDOWN_MS) {
  return Math.max(1000, Math.round(baseMs));
}

function getRobberyActionDurationMs(baseMs = ROBBERY_COOLDOWN_MS) {
  const factorySnapshot = getFactoryBoostSnapshot();
  const speedPct = Number(factorySnapshot.effective.raidSpeedPct || 0);
  return resolveDistrictActionCooldownView(baseMs, "districtRobbery", speedPct).effectiveCooldownMs;
}

function getRobberyActionCooldownView(baseMs = ROBBERY_COOLDOWN_MS) {
  const factorySnapshot = getFactoryBoostSnapshot();
  const speedPct = Number(factorySnapshot.effective.raidSpeedPct || 0);
  return resolveDistrictActionCooldownView(baseMs, "districtRobbery", speedPct);
}

function getOccupyActionCooldownView(baseMs = OCCUPY_COOLDOWN_MS) {
  return resolveDistrictActionCooldownView(baseMs, "districtOccupy", 0);
}

function getSpyMissionDefenseContext(mission) {
  const targetDistrictId = Number.parseInt(String(mission?.targetDistrictId ?? 0), 10) || 0;
  const worldState = getResolvedWorldState();
  const defenseLoadout = worldState.districtDefenseLoadoutById?.[targetDistrictId] || {};

  return {
    targetSecurity: Number(worldState.districtDefenseById?.[targetDistrictId] ?? 0),
    cameraCount: Number(defenseLoadout.cameras || 0),
    alarmCount: Number(defenseLoadout.alarm || 0),
    infoQualityPct: Number(mission?.intelQualityPct || 0)
  };
}

function resolveSpyScenarioWithBoost(mission) {
  return resolveSpyScenario(mission, {
    ...getSpyMissionDefenseContext(mission),
    ...(isDemoScenarioMode(getResolvedPhaseState())
      ? { devOnlyFullSuccessChance: DEV_ONLY_SPY_FULL_SUCCESS_CHANCE }
      : {})
  });
}

function getFactoryAttackBoostContext({ attackPower, defensePower } = {}) {
  const activeBoost = getFactoryActiveBoost();
  const normalizedAttackPower = Math.max(0, Math.round(Number(attackPower || 0)));
  const normalizedDefensePower = Math.max(0, Math.round(Number(defensePower || 0)));
  const attackCooldownView = resolveDistrictActionCooldownView(ATTACK_COOLDOWN_MS, "attackPreparation", 0);
  const context = {
    activeBoost: activeBoost || null,
    effectiveAttackPower: normalizedAttackPower,
    effectiveDefensePower: normalizedDefensePower,
    cooldownMs: attackCooldownView.effectiveCooldownMs,
    cooldownLabel: attackCooldownView.label,
    summaryLabel: ""
  };

  if (!activeBoost?.type) {
    return context;
  }

  const config = activeBoost.config || DEMO_FACTORY_COMBAT_BOOSTS[activeBoost.type] || null;

  if (!config) {
    if (attackCooldownView.combinedReductionPct > 0) {
      context.summaryLabel = `Útok dorazí za ${context.cooldownLabel}`;
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

  const totalAttackSpeedPct = Number(config.attackSpeedPct || 0);
  const boostedCooldownView = resolveDistrictActionCooldownView(
    ATTACK_COOLDOWN_MS,
    "attackPreparation",
    totalAttackSpeedPct
  );
  context.cooldownMs = boostedCooldownView.effectiveCooldownMs;
  context.cooldownLabel = boostedCooldownView.label;

  context.summaryLabel = activeBoost.type === "assault"
    ? `Boost ${config.label}: síla útoku +${config.attackPowerPct}%`
    : activeBoost.type === "rapid"
      ? `Boost ${config.label}: útok dorazí za ${context.cooldownLabel}`
      : activeBoost.type === "breach"
        ? `Boost ${config.label}: obrana cíle -${config.defenseIgnorePct}%`
        : `Boost ${config.label}`;

  return context;
}

const {
  bindMarketPopup
} = createMarketPopupRuntime({
  MARKET_BLACK_HEAT_BY_VALUE,
  MARKET_PLAYER_LISTING_LIMIT,
  MARKET_PLAYER_LISTING_TTL_MS,
  MARKET_PLAYER_OWN_LISTING_LIMIT,
  MARKET_PLAYER_SELLER_ID,
  MARKET_PLAYER_TAB_ID,
  MARKET_TAB_CONFIG,
  addGangHeat,
  applyShoppingMallMarketDiscountToPrice,
  applyTopbarEconomy,
  clamp,
  closeMarketPanel,
  createMarketCatalogCallbacks,
  createMarketCatalogPanelPayload,
  createMarketCopy,
  createMarketDashboardAdapter,
  createMarketDashboardViewModel,
  createMarketTradeStateViewModel,
  createMarketTransaction,
  createPlayerMarketCallbacks,
  createPlayerMarketPanelPayload,
  documentRef: typeof document === "undefined" ? null : document,
  formatMarketPrice,
  getCurrentPlayerIdentityLabel,
  getInventoryAmount,
  getMarketListingTotal,
  getMarketMaxStock,
  getMarketMoneyLabel,
  getMarketRefreshCountdownSeconds,
  getMarketServerScope,
  getMarketStockAmount,
  getMarketStockConfig,
  getMarketStockKey,
  getMarketStockLabel,
  getMarketStockPercent,
  getPlayerMarketCatalog,
  getResolvedEconomyState,
  getResolvedGangState,
  getResolvedMarketPriceState,
  getServerMarketReadModel,
  getServerPlayerView,
  getShoppingMallMarketDiscountForTab: (...args) => getShoppingMallMarketDiscountForTab(...args),
  getSuggestedPlayerMarketUnitPrice,
  normalizeMarketStockState,
  normalizeMarketTradeState,
  normalizeMarketTransactions,
  normalizePlayerMarketListings,
  openMarketPanel,
  refreshMarketPricesIfNeeded,
  renderBlackMarketPanel,
  renderMarketDashboard,
  renderMarketFeedback,
  renderMarketPanel,
  renderPlayerMarketPanel,
  resolveMarketHeatRiskByValue,
  selectors: {
    close: MARKET_POPUP_CLOSE_SELECTOR,
    copy: MARKET_COPY_SELECTOR,
    dashboard: MARKET_DASHBOARD_SELECTOR,
    feedback: MARKET_FEEDBACK_SELECTOR,
    list: MARKET_LIST_SELECTOR,
    open: MARKET_POPUP_OPEN_SELECTOR,
    popup: MARKET_POPUP_SELECTOR,
    serverBadge: MARKET_SERVER_BADGE_SELECTOR,
    tab: MARKET_TAB_SELECTOR
  },
  setInventoryAmount,
  setStoredEconomyState,
  setStoredMarketPriceState,
  submitServerMarketCommand,
  syncMarketTabs,
  windowRef: typeof window === "undefined" ? null : window
});

function collectMounts(root) {
  return collectMountsUi(root, MOUNT_SELECTOR);
}

function createPageContext(root) {
  return createPageContextUi(root, MOUNT_SELECTOR);
}

const markMounts = markMountsUi;

const START_PHASE_OWNER_BY_DISTRICT_ID = createLaunchOwnerMap(START_PHASE_OWNER_COORDINATES);

function getLaunchPlayerColor(ownerId) {
  return getLaunchPlayerRuntime().getLaunchPlayerColor(ownerId);
}

function getLaunchPlayerName(ownerId) {
  return getLaunchPlayerRuntime().getLaunchPlayerName(ownerId);
}

function getLaunchPlayerFactionId(ownerId) {
  return getLaunchPlayerRuntime().getLaunchPlayerFactionId(ownerId);
}

function getLaunchPlayerAvatar(ownerId) {
  return getLaunchPlayerRuntime().getLaunchPlayerAvatar(ownerId);
}

function normalizeEliminationOwnerId(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = String(value || "").match(/(\d+)$/u);
  const parsed = match ? Number(match[1]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function neutralizeLaunchPlayerDistricts(root, ownerId) {
  const normalizedOwnerId = normalizeEliminationOwnerId(ownerId);
  if (!normalizedOwnerId) return 0;

  const neutralizedDistrictIds = [];
  for (const [districtId, launchOwnerId] of Array.from(START_PHASE_OWNER_BY_DISTRICT_ID.entries())) {
    if (Number(launchOwnerId) === normalizedOwnerId) {
      START_PHASE_OWNER_BY_DISTRICT_ID.delete(districtId);
      neutralizedDistrictIds.push(Number(districtId));
    }
  }

  const worldState = getResolvedWorldState();
  const ownedDistrictIds = Array.isArray(worldState.ownedDistrictIds)
    ? worldState.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
  const neutralizedSet = new Set(neutralizedDistrictIds);
  const nextOwnedDistrictIds = ownedDistrictIds.filter((districtId) => !neutralizedSet.has(Number(districtId)));
  const currentPlayerOwnedChanged = nextOwnedDistrictIds.length !== ownedDistrictIds.length;

  if (currentPlayerOwnedChanged) {
    setStoredWorldState({
      ...worldState,
      ownedDistrictIds: nextOwnedDistrictIds
    });
  } else if (neutralizedDistrictIds.length > 0) {
    document.dispatchEvent(new CustomEvent("empire:world-state-changed", {
      detail: {
        ownedDistrictIdsChanged: false,
        neutralizedDistrictIds
      }
    }));
  }

  if (root && neutralizedDistrictIds.length > 0) {
    refreshAllUi(hydrateInitialState(root));
  }

  return neutralizedDistrictIds.length;
}

function enrichEliminationResultForLaunchMap(root, result = {}) {
  const ownerId = normalizeEliminationOwnerId(result.ownerId || result.playerId);
  const districtsNeutralized = neutralizeLaunchPlayerDistricts(root, ownerId);
  const populationSnapshot = resolveEliminationPopulationSnapshot(result);
  return {
    ownerId,
    gangName: result.gangName || (ownerId ? getLaunchPlayerName(ownerId) : "neznámý gang"),
    avatarSrc: result.avatarSrc || (ownerId ? getLaunchPlayerAvatar(ownerId) : ""),
    districtsNeutralized,
    remainingPlayers: result.remainingPlayers ?? result.activePlayersRemaining ?? populationSnapshot.remainingPlayers,
    activePlayersRemaining: result.activePlayersRemaining ?? result.remainingPlayers ?? populationSnapshot.remainingPlayers,
    serverCapacity: result.serverCapacity ?? result.maxPlayersPerServer ?? populationSnapshot.serverCapacity
  };
}

function resolveEliminationPopulationSnapshot(result = {}) {
  const elimination = latestGameplaySliceReadModel?.elimination
    || latestGameplaySliceReadModel?.player?.elimination
    || {};
  return {
    remainingPlayers: result.remainingPlayers
      ?? result.activePlayersRemaining
      ?? elimination.activePlayersRemaining
      ?? null,
    serverCapacity: result.serverCapacity
      ?? result.maxPlayersPerServer
      ?? latestGameplaySliceReadModel?.server?.maxPlayersPerServer
      ?? null
  };
}

function createEliminationStreetNewsPayload(result = {}) {
  const gangName = String(result.gangName || "neznámý gang").trim();
  const districtCount = Number(result.districtsNeutralized);
  const neutralizedLabel = Number.isFinite(districtCount) && districtCount > 0
    ? `${districtCount} districtů je teď neobsazených`
    : "Districty gangu jsou teď neobsazené";
  return {
    ...result,
    tone: "warning",
    title: result.title || `Očista proběhla: ${gangName}`,
    summary: result.body || `Policie rozdrtila gang ${gangName}. Jeho území se vrací pod kontrolu města.`,
    badge: "Očista dokončena",
    rows: [
      { label: "Gang", value: gangName },
      { label: "Mapa", value: neutralizedLabel }
    ],
    syncToBuildingAction: false
  };
}

function appendEliminationStreetNews(root, result = {}) {
  const payload = createEliminationStreetNewsPayload(result);
  appendBuildingActionResultEntry(root, "elimination", payload, {
    tone: "warning",
    title: payload.title,
    summary: payload.summary,
    meta: payload.badge
  }, {
    syncPreview: true,
    forceLog: true,
    refresh: false
  });
  return payload;
}

function handleEliminationCountdownResolved(root, result = {}) {
  const enrichedResult = {
    ...result,
    ...enrichEliminationResultForLaunchMap(root, result)
  };
  const payload = appendEliminationStreetNews(root, enrichedResult);
  return {
    ...enrichedResult,
    ...payload
  };
}

function getCurrentPlayerLaunchStartDistrictId() {
  return getLaunchPlayerRuntime().getCurrentPlayerLaunchStartDistrictId();
}

function getLaunchPlayerLabel(ownerId) {
  return getLaunchPlayerRuntime().getLaunchPlayerLabel(ownerId);
}

function getDistrictOwnerLabel(district, interactionState = {}) {
  return resolveMapDistrictOwnerLabel(district, interactionState, {
    currentPlayerId: CURRENT_PLAYER_ID,
    getLaunchPlayerName
  });
}

function getEffectiveOwnedDistrictIds(interactionState = {}) {
  return getLaunchPlayerRuntime().getEffectiveOwnedDistrictIds(interactionState);
}

function getCurrentPlayerOwnedDistrictIds(interactionState = {}) {
  return getLaunchPlayerRuntime().getCurrentPlayerOwnedDistrictIds(interactionState);
}

const {
  getDistrictBuildingSeed,
  getDistrictBuildingVariantName,
  getDistrictCoreWeight,
  getDistrictResourceCatalog,
  isDistrictTypeHidden,
  isDistrictTypeVisible,
  resolveDistrictBuildingPackage,
  resolveDistrictBuildingProfile,
  resolveDistrictBuildingTier
} = createDistrictBuildingProfileRuntime({
  clamp,
  currentPlayerId: CURRENT_PLAYER_ID,
  defaultDistrictType: MAP_DEFAULT_DISTRICT_TYPE,
  districtBuildingPackagePools: DISTRICT_BUILDING_PACKAGE_POOLS,
  districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
  districtTypeGrid: DISTRICT_TYPE_GRID,
  districtFixedPackagesByDistrictId: DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  downtownDistrictType: MAP_DOWNTOWN_DISTRICT_TYPE,
  downtownFixedPackagesByDistrictId: DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  getCurrentPlayerOwnedDistrictIds,
  getEffectiveOwnedDistrictIds,
  getResolvedSpyIntel,
  hashCell,
  remapDistrictId,
  remapDistrictType,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  backgroundImagesByBaseName: DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME,
  variantNamesByBaseName: DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME
});

function getDemoLiveMinimumOwnedBuildingCountByBaseName(baseName, worldState = getResolvedWorldState()) {
  const normalizedBaseName = normalizeBuildingLookupKey(baseName);
  if (!normalizedBaseName) {
    return 0;
  }
  const gamePhase = normalizeRuntimeGamePhase(worldState?.phaseState?.gamePhase || worldState?.phase || "live");
  return gamePhase === "live" ? 2 : 0;
}

const {
  getApartmentBlockNetworkMultipliers,
  getArcadeNetworkMultipliers,
  getAutoSalonNetworkMultipliers,
  getAutoSalonSupportStats,
  getClinicNetworkMultipliers,
  getClinicRecoveryRatePct,
  getExchangeOfficeNetworkMultipliers,
  getFitnessClubNetworkMultipliers,
  getFitnessClubSupportStats,
  getGarageNetworkMultipliers,
  getGarageSupportStats,
  getPowerStationNetworkMultipliers,
  getOwnedRecruitmentCenterCount,
  getRecyclingCenterNetworkMultipliers,
  getRecruitmentCenterNetworkMultipliers,
  getRecruitmentCenterSupportStats,
  getOwnedApartmentBlockCount,
  getOwnedArcadeCount,
  getOwnedAutoSalonCount,
  getOwnedClinicCount,
  getOwnedExchangeOfficeCount,
  getOwnedFitnessClubCount,
  getOwnedGarageCount,
  getOwnedPowerStationCount,
  getOwnedRecyclingCenterCount,
  getOwnedRestaurantCount,
  getOwnedSchoolCount,
  getOwnedShoppingMallCountForMarket,
  getOwnedSmugglingTunnelCount,
  getOwnedWarehouseCount,
  getRestaurantNetworkMultipliers,
  getSchoolNetworkMultipliers,
  getShoppingMallMarketDiscountForTab,
  getShoppingMallNetworkMultipliers,
  getSmugglingTunnelCollectHeat,
  getSmugglingTunnelNetworkMultipliers,
  getWarehouseCapacityBreakdown,
  getWarehouseCapacityWarnings,
  getWarehouseNetworkMultipliers,
  getWarehouseStorageUsage
} = createBuildingNetworkRuntime({
  apartmentBlockNetworkConfig: APARTMENT_BLOCK_NETWORK_CONFIG,
  arcadeNetworkConfig: ARCADE_NETWORK_CONFIG,
  autoSalonSupportConfig: AUTO_SALON_SUPPORT_CONFIG,
  clinicBaseRecoveryRatePct: CLINIC_BASE_RECOVERY_RATE_PCT,
  clinicMaxRecoveryRatePct: CLINIC_MAX_RECOVERY_RATE_PCT,
  clinicRecoveryRatePctPerExtra: CLINIC_RECOVERY_RATE_PCT_PER_EXTRA,
  currentPlayerId: CURRENT_PLAYER_ID,
  exchangeOfficeNetworkConfig: EXCHANGE_OFFICE_NETWORK_CONFIG,
  fitnessClubSupportConfig: FITNESS_CLUB_SUPPORT_CONFIG,
  garageSupportConfig: GARAGE_SUPPORT_CONFIG,
  getCurrentPlayerOwnedDistrictIds,
  getDistrictResourceCatalog,
  getBuildingLevel: (district, building) => getDistrictBuildingDetailEntry(district, building?.baseName || "Skladiště").level,
  getResolvedWorldState,
  getStoredDrugInventory,
  getStoredFactorySupplies,
  getStoredMaterialInventory,
  getStoredWeaponInventory,
  getMinimumOwnedBuildingCountByBaseName: getDemoLiveMinimumOwnedBuildingCountByBaseName,
  normalizeBuildingLookupKey,
  powerStationConfig: POWER_STATION_CONFIG,
  recyclingCenterConfig: RECYCLING_CENTER_CONFIG,
  recruitmentCenterSupportConfig: RECRUITMENT_CENTER_SUPPORT_CONFIG,
  restaurantNetworkConfig: RESTAURANT_NETWORK_CONFIG,
  resolveDistrictBuildingProfile,
  schoolConfig: SCHOOL_CONFIG,
  shoppingMallNetworkConfig: SHOPPING_MALL_NETWORK_CONFIG,
  smugglingTunnelConfig: SMUGGLING_TUNNEL_CONFIG,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  warehouseNetworkConfig: WAREHOUSE_NETWORK_CONFIG,
  warehouseStorageConfig: WAREHOUSE_STORAGE_CONFIG
});

function getOwnedDistrictBuildingCountByBaseName(baseName) {
  const normalizedBaseName = normalizeBuildingLookupKey(baseName);
  if (!normalizedBaseName) {
    return 0;
  }

  const worldState = getResolvedWorldState();
  const interactionState = {
    ownedDistrictIds: new Set(worldState.ownedDistrictIds || []),
    gamePhase: worldState.phaseState?.gamePhase === "launch" ? "launch" : "live",
    launchOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID
  };
  const destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
  const ownedDistrictIds = new Set(
    Array.from(getCurrentPlayerOwnedDistrictIds(interactionState) || [])
      .map((districtId) => Number(districtId))
      .filter((districtId) => districtId > 0 && !destroyedDistrictIds.has(districtId))
  );

  const actualCount = getDistrictResourceCatalog().reduce((count, district) => {
    if (!ownedDistrictIds.has(Number(district.id))) {
      return count;
    }

    const profile = resolveDistrictBuildingProfile(district);
    const matchingCount = (profile?.buildings || []).reduce((total, building) => (
      normalizeBuildingLookupKey(building?.baseName) === normalizedBaseName ? total + 1 : total
    ), 0);

    return count + matchingCount;
  }, 0);

  return Math.max(actualCount, getDemoLiveMinimumOwnedBuildingCountByBaseName(normalizedBaseName, worldState));
}

function formatStrengthNumber(value = 0) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(/0+$/u, "").replace(/\.$/u, "");
}

function formatStrengthBonusLabel(value = 0) {
  const safeValue = Math.max(0, Number(value || 0));
  return safeValue > 0 ? `+${formatStrengthNumber(safeValue)}` : "";
}

function resolveCurrentRecruitmentCenterCombatSupport() {
  return getRecruitmentCenterSupportStats(getOwnedRecruitmentCenterCount()) || {};
}

function getArmoryRecipeStrengthPreview(recipeId = "", recipe = {}) {
  const itemId = String(recipe?.output?.itemId || recipeId || "").trim();
  const isDefense = Object.prototype.hasOwnProperty.call(DEFENSE_POWER_BY_WEAPON, itemId);
  const basePower = isDefense
    ? Number(DEFENSE_POWER_BY_WEAPON[itemId] || 0)
    : Number(getAttackSetupWeapons()[itemId]?.power || 0);
  if (!basePower) {
    return null;
  }
  const support = resolveCurrentRecruitmentCenterCombatSupport();
  const bonusPct = isDefense
    ? Math.max(0, Number(support.defenseItemStrengthBonusPct || 0))
    : Math.max(0, Number(support.attackWeaponStrengthBonusPct || 0));
  const bonusPower = basePower * bonusPct / 100;
  return {
    label: isDefense ? "Síla obrany" : "Síla útoku",
    basePower,
    bonusPower,
    bonusLabel: formatStrengthBonusLabel(bonusPower)
  };
}

function getRecruitmentAttackWeaponModifiers(weaponDefinitions = getAttackSetupWeapons()) {
  const support = resolveCurrentRecruitmentCenterCombatSupport();
  const bonusPct = Math.max(0, Number(support.attackWeaponStrengthBonusPct || 0));
  return Object.fromEntries(Object.keys(weaponDefinitions).map((weaponId) => [
    weaponId,
    1 + bonusPct / 100
  ]));
}

function getRecruitmentDefenseItemModifiers() {
  const support = resolveCurrentRecruitmentCenterCombatSupport();
  const defenseBonusPct = Math.max(0, Number(support.defenseItemStrengthBonusPct || 0));
  const cameraBonusPct = Math.max(0, Number(support.cameraStrengthBonusPct ?? defenseBonusPct));
  const alarmBonusPct = Math.max(0, Number(support.alarmStrengthBonusPct ?? defenseBonusPct));
  return Object.fromEntries(Object.keys(DEFENSE_POWER_BY_WEAPON).map((itemId) => {
    const bonusPct = itemId === "cameras"
      ? cameraBonusPct
      : itemId === "alarm"
        ? alarmBonusPct
        : defenseBonusPct;
    return [itemId, 1 + bonusPct / 100];
  }));
}

function calculateAttackDeploymentWithRecruitmentSupport(loadout = {}) {
  const weaponDefinitions = getAttackSetupWeapons();
  const base = calculateAttackDeployment(loadout, {}, weaponDefinitions);
  const boosted = calculateAttackDeployment(loadout, getRecruitmentAttackWeaponModifiers(weaponDefinitions), weaponDefinitions);
  const bonusPower = Math.max(0, Number(boosted.totalPower || 0) - Number(base.totalPower || 0));
  return {
    ...boosted,
    basePower: base.totalPower,
    bonusPower,
    bonusPowerLabel: formatStrengthBonusLabel(bonusPower)
  };
}

function calculateTotalDefensePowerWithRecruitmentSupport(input = {}) {
  const basePower = calculateTotalDefensePower(input);
  const totalPower = calculateTotalDefensePower({
    ...input,
    modifiers: getRecruitmentDefenseItemModifiers()
  });
  const bonusPower = Math.max(0, Number(totalPower || 0) - Number(basePower || 0));
  return {
    totalPower,
    basePower,
    bonusPower,
    bonusPowerLabel: formatStrengthBonusLabel(bonusPower)
  };
}

function applyShoppingMallMarketDiscountToPrice(basePrice, discount) {
  const safeBasePrice = Math.max(1, Math.round(Number(basePrice || 1)));
  const discounted = safeBasePrice * (1 - Math.max(0, Number(discount?.discountPct || 0)) / 100);
  return Math.max(1, Math.ceil(Math.max(discounted, safeBasePrice * Math.max(0, Number(discount?.minFinalPriceMultiplier || 0.7)))));
}

function formatActiveDistrictBuildingEffectLabel(effect = {}, now = Date.now()) {
  const remainingMs = Number(effect.expiresAt || 0) - now;
  if (remainingMs <= 0) {
    return "";
  }
  const label = String(effect.label || "Efekt").trim() || "Efekt";
  const parts = [];
  if (Number(effect.auditRiskBoostPct || 0) > 0) {
    parts.push(`audit risk +${Math.max(0, Number(effect.auditRiskBoostPct || 0))}%`);
  }
  if (Number(effect.auditRiskReductionPct || 0) > 0) {
    parts.push(`audit risk -${Math.max(0, Number(effect.auditRiskReductionPct || 0))}%`);
  }
  if (Number(effect.cleanIncomeBoostPct || 0) > 0) {
    parts.push(`clean income +${Math.max(0, Number(effect.cleanIncomeBoostPct || 0))}%`);
  }
  if (Number(effect.dirtyIncomeBoostPct || 0) > 0) {
    parts.push(`dirty income +${Math.max(0, Number(effect.dirtyIncomeBoostPct || 0))}%`);
  }
  if (Number(effect.dealerSalePriceBonusPct || 0) > 0) {
    parts.push(`cena prodeje +${Math.max(0, Number(effect.dealerSalePriceBonusPct || 0))}%`);
  }
  if (Number(effect.dealerSaleSpeedBonusPct || 0) > 0) {
    parts.push(`čas prodeje -${Math.max(0, Number(effect.dealerSaleSpeedBonusPct || 0))}%`);
  }
  if (Number(effect.dealerRewardBonusPct || effect.dealerCompletionRewardBonusPct || 0) > 0) {
    parts.push(`výplata +${Math.max(0, Number(effect.dealerRewardBonusPct || effect.dealerCompletionRewardBonusPct || 0))}%`);
  }
  if (Number(effect.streetIncidentFlatRiskPct || 0) > 0) {
    parts.push(`incident +${Math.max(0, Number(effect.streetIncidentFlatRiskPct || 0))}%`);
  }
  if (Number(effect.influenceBoostPct || 0) > 0) {
    parts.push(`vliv +${Math.max(0, Number(effect.influenceBoostPct || 0))}%`);
  }
  if (Number(effect.heatMultiplier || 1) !== 1) {
    const heatPct = Math.round((Number(effect.heatMultiplier || 1) - 1) * 100);
    parts.push(`heat ${heatPct >= 0 ? "+" : ""}${heatPct}%`);
  }
  if (Number(effect.instantHeat || 0) !== 0 || Number(effect.instantInfluence || 0) !== 0) {
    const instant = [];
    if (Number(effect.instantHeat || 0) !== 0) {
      instant.push(`heat ${Number(effect.instantHeat || 0) > 0 ? "+" : ""}${Math.floor(Number(effect.instantHeat || 0))}`);
    }
    if (Number(effect.instantInfluence || 0) !== 0) {
      const influence = Number(effect.instantInfluence || 0);
      instant.push(`vliv ${influence > 0 ? "+" : ""}${Number.isInteger(influence) ? String(influence) : influence.toFixed(1).replace(/\.0$/u, "")}`);
    }
    parts.push(`okamžitě: ${instant.join(", ")}`);
  }
  return `${label}: ${[...parts, `zbývá ${formatDistrictBuildingCooldown(remainingMs)}`].join(", ")}`;
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

function isStartPhaseResourceSimulationActive(phaseState = getResolvedPhaseState()) {
  const gamePhase = normalizeRuntimeGamePhase(phaseState?.gamePhase);
  return gamePhase === "launch" || gamePhase === "live";
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
  const gamePhase = normalizeRuntimeGamePhase(worldState.phaseState?.gamePhase);
  const interactionState = {
    ownedDistrictIds: new Set(worldState.ownedDistrictIds || []),
    gamePhase,
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
  const policeIncomeMultiplier = getActivePoliceIncomeMultiplier();

  for (const district of getDistrictResourceCatalog()) {
    const districtId = Number(district.id);
    if (!currentPlayerOwnedDistrictIds.has(districtId) || destroyedDistrictIds.has(districtId)) {
      continue;
    }

    const districtType = resolveStartPhaseResourceDistrictType(district);
    const districtIncomeRule = DISTRICT_MINUTE_INCOME_RULES_EMPIRE2[districtType] || DISTRICT_MINUTE_INCOME_RULES_EMPIRE2.resident;
    const snapshot = getDistrictEconomySnapshot(district);
    cleanMoneyPerMinute += Number(START_PHASE_RESOURCE_SIMULATION.cleanPerMinuteByDistrictType[districtType] || 0)
      + (Number(snapshot.buildingCleanHourlyIncome || 0) / 60);
    dirtyMoneyPerMinute += Number(districtIncomeRule.dirty || 0)
      + (Number(snapshot.buildingDirtyHourlyIncome || 0) / 60);
    influencePerMinute += START_PHASE_RESOURCE_SIMULATION.influencePerMinute
      + (Number(snapshot.buildingInfluencePerHour || 0) / 60);
    heatPerDay += Number(snapshot.passiveHeatPerDay || 0);
    heatPerMinute += Number(snapshot.passiveHeatPerDay || 0) / 1440;
    districtCount += 1;
  }

  return {
    cleanMoneyPerMinute: Math.max(0, cleanMoneyPerMinute * policeIncomeMultiplier),
    dirtyMoneyPerMinute: Math.max(0, dirtyMoneyPerMinute * policeIncomeMultiplier),
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
  if (!shouldRunLocalGameplayRuntime()) {
    setBuildingActionFeedback(root, "warning", `${context.buildingName}: upgrade nejde`, "Lokální upgrade je dostupný jen v development režimu.", `L${mechanics.level}`);
    return;
  }

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

  const simulationPhase = normalizeRuntimeGamePhase(getResolvedPhaseState().gamePhase);
  const districtSnapshot = getCurrentPlayerStartPhaseSourceSnapshot();
  const economyState = getResolvedEconomyState();
  const gangState = getResolvedGangState();

  if (!startPhaseResourceSimulationState || startPhaseResourceSimulationState.phase !== simulationPhase) {
    startPhaseResourceSimulationState = {
      phase: simulationPhase,
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
    phase: simulationPhase,
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
    applyTopbarEconomy(root);
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

function resolveBuildingPopupTarget(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  if (!lookupKey) {
    return null;
  }

  const variantBaseName = resolveDistrictBuildingVariantBaseName(buildingName);
  const variantLookupKey = normalizeBuildingLookupKey(variantBaseName);
  const candidateKeys = [lookupKey, variantLookupKey].filter(Boolean);
  return BUILDING_POPUP_TARGETS.find((target) => candidateKeys.some((candidateKey) => target.lookupKeys.includes(candidateKey))) || null;
}

function shouldOpenGenericDistrictBuildingDetail(buildingName, options = {}) {
  return Boolean(options?.preferGenericDetail) && !resolveBuildingPopupTarget(buildingName);
}

function resolveDistrictBuildingVariantBaseName(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  if (!lookupKey) {
    return "";
  }

  for (const [baseName, variants] of Object.entries(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME || {})) {
    const baseLookupKey = normalizeBuildingLookupKey(baseName);
    if (baseLookupKey === lookupKey) {
      return baseName;
    }

    if (Array.isArray(variants) && variants.some((variantName) => normalizeBuildingLookupKey(variantName) === lookupKey)) {
      return baseName;
    }
  }

  return "";
}

function resolveDistrictBuildingCanonicalLookupKey(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  const variantBaseName = resolveDistrictBuildingVariantBaseName(buildingName);
  const variantLookupKey = normalizeBuildingLookupKey(variantBaseName);

  if (lookupKey && (DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[lookupKey] || DISTRICT_BUILDING_DETAIL_PROFILES[lookupKey])) {
    return lookupKey;
  }
  if (popupLookupKey && (DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[popupLookupKey] || DISTRICT_BUILDING_DETAIL_PROFILES[popupLookupKey])) {
    return popupLookupKey;
  }
  if (variantLookupKey) {
    return variantLookupKey;
  }

  return lookupKey;
}

function isApartmentBlockBuildingName(buildingName) {
  return resolveDistrictBuildingCanonicalLookupKey(buildingName) === "bytovy blok";
}

function getDistrictBuildingDetailProfile(buildingName) {
  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName);
  return DISTRICT_BUILDING_DETAIL_PROFILES[lookupKey] || Object.freeze({
    role: "District asset",
    info: `${buildingName} je pevná budova přiřazená mapou districtu. Ovlivňuje ekonomiku, heat nebo vliv podle typu zóny.`,
    actions: Object.freeze(["Zkontrolovat provoz", "Vybrat lokální výnos", "Prověřit napojení"])
  });
}

function getDistrictBuildingSpecialActionProfile(buildingName, actionIndex) {
  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName);
  const profiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[lookupKey] || [];
  return profiles[actionIndex] || null;
}

function getDistrictBuildingDetailBackgroundPath(district, buildingName, displayName = buildingName, activeBuilding = null) {
  const exactVariantPath = String(
    DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[displayName]
    || DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[buildingName]
    || ""
  ).trim();
  if (exactVariantPath) {
    return exactVariantPath;
  }

  const explicitPath = String(activeBuilding?.imagePath || "").trim();
  if (explicitPath) {
    return explicitPath;
  }

  const baseName = resolveDistrictBuildingVariantBaseName(buildingName)
    || resolveDistrictBuildingVariantBaseName(displayName)
    || String(activeBuilding?.baseName || buildingName || displayName || "").trim();
  const imagePaths = DISTRICT_BUILDING_BACKGROUND_IMAGES_BY_BASE_NAME[baseName] || [];
  if (!Array.isArray(imagePaths) || imagePaths.length <= 0) {
    return null;
  }

  const seed = `${district?.id ?? 0}:${baseName}:${displayName || buildingName}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }
  return imagePaths[hash % imagePaths.length] || imagePaths[0] || null;
}

const districtBuildingDetailContextByShell = new WeakMap();
const districtBuildingDetailLiveRefreshTimers = new WeakMap();
const districtBuildingDetailUpgradeConfirmations = new WeakMap();
const districtBuildingDetailActionConfirmations = new WeakMap();
const DISTRICT_BUILDING_DETAIL_LIVE_REFRESH_MS = 1000;

function getDistrictBuildingRule(ruleSet, buildingName, fallback) {
  const direct = ruleSet?.[buildingName];
  if (direct) {
    return direct;
  }

  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName);
  const matchingKey = Object.keys(ruleSet || {}).find((ruleKey) => normalizeBuildingLookupKey(ruleKey) === lookupKey);
  return matchingKey ? ruleSet[matchingKey] : fallback;
}

function getCasinoDetailUpgrade(level) {
  const safeLevel = Math.max(1, Math.min(CASINO_DETAIL_MAX_LEVEL, Math.floor(Number(level) || 1)));
  return CASINO_DETAIL_UPGRADES[safeLevel] || CASINO_DETAIL_UPGRADES[1];
}

function getCasinoDetailUpgradeCostLabel(level) {
  const upgrade = getCasinoDetailUpgrade(level);
  const parts = [
    upgrade.clean > 0 ? `${formatDistrictBuildingMoney(upgrade.clean)} clean` : "",
    upgrade.techCore > 0 ? `${upgrade.techCore} Tech Core` : "",
    upgrade.combatModule > 0 ? `${upgrade.combatModule} bojový modul` : ""
  ].filter(Boolean);
  return parts.join(" + ") || "Zdarma";
}

function getStoredClinicRecoveryPool() {
  return loadClinicRecoveryPool().filter((entry) => entry && typeof entry === "object");
}

function setStoredClinicRecoveryPool(pool) {
  saveClinicRecoveryPool(pool);
}

function getClinicRecoveryPoolView(now = Date.now()) {
  const pool = getStoredClinicRecoveryPool()
    .map((entry, index) => ({
      id: String(entry.id || `clinic-recovery:${index}`),
      itemType: String(entry.itemType || entry.type || ""),
      amount: Math.max(0, Math.floor(Number(entry.amount || 0))),
      source: String(entry.source || "loss"),
      lostAt: Number.isFinite(Number(entry.lostAt)) ? Number(entry.lostAt) : Date.parse(entry.lostAt || "") || now
    }))
    .filter((entry) => entry.itemType && entry.amount > 0);
  const fresh = pool.filter((entry) => now - entry.lostAt <= CLINIC_POOL_TTL_MS);
  const expired = pool.filter((entry) => now - entry.lostAt > CLINIC_POOL_TTL_MS);
  return {
    fresh,
    expired,
    totalFreshAmount: fresh.reduce((total, entry) => total + entry.amount, 0),
    nextExpiryMs: fresh.length
      ? Math.max(0, Math.min(...fresh.map((entry) => CLINIC_POOL_TTL_MS - (now - entry.lostAt))))
      : 0,
    label: fresh.length
      ? fresh.map((entry) => `${getProductionResourceLabel(entry.itemType)} ${entry.amount}x (${formatDistrictBuildingCooldown(CLINIC_POOL_TTL_MS - (now - entry.lostAt))})`).join(" · ")
      : "Žádné ztráty k léčbě"
  };
}

function normalizeClinicRecoverableItem(itemType) {
  const key = normalizeBuildingLookupKey(itemType);
  const aliases = {
    "gang members": "population",
    population: "population",
    chemicals: "chemicals",
    biomass: "biomass",
    "metal parts": "metal-parts",
    "tech core": "tech-core",
    "combat module": "combat-module",
    "neon dust": "neon-dust",
    "pulse shot": "pulse-shot",
    "velvet smoke": "velvet-smoke",
    "ghost serum": "ghost-serum",
    "overdrive x": "overdrive-x",
    "baseballova palka": "baseball-bat",
    "baseball bat": "baseball-bat",
    "poulicni pistole": "pistol",
    pistol: "pistol",
    granat: "grenade",
    grenade: "grenade",
    samopal: "smg",
    smg: "smg",
    bazuka: "bazooka",
    bazooka: "bazooka",
    "neprustrelna vesta": "vest",
    vest: "vest",
    "ocelove barikady": "barricades",
    barricades: "barricades",
    "bezpecnostni kamery": "cameras",
    cameras: "cameras",
    "automaticke kulometne stanoviste": "defense-tower",
    "defense tower": "defense-tower",
    alarm: "alarm"
  };
  return aliases[key] || String(itemType || "");
}

function getClinicWarehouseCapacityForItem(itemId, capacity) {
  if (!capacity) return 0;
  return Math.max(0, Number(capacity.byResource?.[itemId] || 0));
}

function getActiveDistrictBuildingEffects(district, buildingName, now = Date.now()) {
  const entry = getDistrictBuildingDetailEntry(district, buildingName);
  return (entry.activeEffects || []).filter((effect) => Number(effect.expiresAt || 0) > now);
}

const SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX = "__shared:";

function getSharedDistrictBuildingDetailStorageKey(lookupKey) {
  return `${SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX}${lookupKey || "building"}`;
}

function getDistrictBuildingDetailStorageKey(district, buildingName) {
  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName) || "building";
  return getSharedDistrictBuildingDetailStorageKey(lookupKey);
}

function getStoredDistrictBuildingDetailState() {
  return loadDistrictBuildingDetailState();
}

function setStoredDistrictBuildingDetailState(payload) {
  saveDistrictBuildingDetailState(payload);
}

const SCHOOL_APARTMENT_BOOST_STATE_KEY = "__schoolApartmentBoost";

function getSchoolApartmentBoostDurationMs(level = 1, actionProfile = {}) {
  const baseDurationMs = Math.max(0, Number(actionProfile.durationMs || SCHOOL_CONFIG.eveningCourseDurationMs || 0));
  const durationBonusMsPerLevel = Math.max(0, Number(actionProfile.durationBonusMsPerLevel || SCHOOL_CONFIG.eveningCourseDurationBonusMsPerLevel || 0));
  const levelBonusSteps = Math.max(0, Math.floor(Number(level || 1)) - 1);
  return baseDurationMs + levelBonusSteps * durationBonusMsPerLevel;
}

function getActiveSchoolApartmentBoost(now = Date.now()) {
  const state = getStoredDistrictBuildingDetailState();
  const boost = state[SCHOOL_APARTMENT_BOOST_STATE_KEY];
  if (!boost || typeof boost !== "object") {
    return null;
  }
  const expiresAt = Number(boost.expiresAt || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return null;
  }
  return {
    ...boost,
    expiresAt,
    startedAt: Number.isFinite(Number(boost.startedAt)) ? Number(boost.startedAt) : now,
    apartmentPopulationBoostPct: Math.max(0, Number(boost.apartmentPopulationBoostPct || 0)),
    durationMs: Math.max(0, Number(boost.durationMs || 0))
  };
}

function setActiveSchoolApartmentBoost(payload = {}) {
  const state = getStoredDistrictBuildingDetailState();
  state[SCHOOL_APARTMENT_BOOST_STATE_KEY] = {
    startedAt: Number(payload.startedAt || Date.now()),
    expiresAt: Number(payload.expiresAt || 0),
    durationMs: Number(payload.durationMs || 0),
    apartmentPopulationBoostPct: Math.max(0, Number(payload.apartmentPopulationBoostPct || 0)),
    sourceDistrictId: payload.sourceDistrictId ?? null,
    sourceBuildingName: payload.sourceBuildingName || "Škola"
  };
  setStoredDistrictBuildingDetailState(state);
}

function upsertDistrictBuildingActiveEffect(entry = {}, effect = {}) {
  const label = String(effect.label || "").trim();
  const effects = Array.isArray(entry.activeEffects) ? entry.activeEffects : [];
  return [
    ...effects.filter((item) => String(item?.label || "").trim() !== label),
    effect
  ];
}

function createOpenChannelDealerActiveEffect(expiresAt = 0, actionProfile = {}) {
  return {
    label: "Otevřený kanál",
    expiresAt,
    dealerSalePriceBonusPct: Math.max(0, Number(actionProfile.dealerSalePriceBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerSalePriceBonusPct || 0)),
    dealerSaleSpeedBonusPct: Math.max(0, Number(actionProfile.dealerSaleSpeedBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerSaleSpeedBonusPct || 0)),
    dealerRewardBonusPct: Math.max(0, Number(actionProfile.dealerRewardBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerCompletionRewardBonusPct || 0)),
    streetIncidentFlatRiskPct: Math.max(0, Number(actionProfile.streetIncidentFlatRiskPct || SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct || 0))
  };
}

function applyServerBuildingActionLocalPreviewEffects(context = {}, definition = {}, actionProfile = {}, actionCooldownUntil = 0) {
  if (definition.actionId !== "open_channel") {
    return;
  }
  const now = Date.now();
  const durationMs = Math.max(0, Number(actionProfile.durationMs || SMUGGLING_TUNNEL_CONFIG.openChannelDurationMs || 0));
  const expiresAt = now + durationMs;
  const tunnelActiveEffect = {
    label: "Otevřený kanál",
    expiresAt,
    dirtyIncomeBoostPct: Math.max(0, Number(actionProfile.dirtyIncomeBoostPct || SMUGGLING_TUNNEL_CONFIG.openChannelTunnelDirtyProductionBonusPct || 0)),
    dealerSalePriceBonusPct: Math.max(0, Number(actionProfile.dealerSalePriceBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerSalePriceBonusPct || 0)),
    dealerSaleSpeedBonusPct: Math.max(0, Number(actionProfile.dealerSaleSpeedBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerSaleSpeedBonusPct || 0)),
    dealerRewardBonusPct: Math.max(0, Number(actionProfile.dealerRewardBonusPct || SMUGGLING_TUNNEL_CONFIG.openChannelDealerCompletionRewardBonusPct || 0)),
    streetIncidentFlatRiskPct: Math.max(0, Number(actionProfile.streetIncidentFlatRiskPct || SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct || 0))
  };
  const dealerActiveEffect = createOpenChannelDealerActiveEffect(expiresAt, actionProfile);
  const patchOpenChannelEntry = (buildingName, activeEffect, extra = {}) => {
    updateDistrictBuildingDetailEntry(context.district, buildingName, (entry) => ({
      ...entry,
      ...extra,
      activeEffects: upsertDistrictBuildingActiveEffect(entry, activeEffect),
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        [definition.actionId]: actionCooldownUntil
      }
    }));
  };
  patchOpenChannelEntry("Pašovací tunel", tunnelActiveEffect, { openChannelExpiresAt: expiresAt });
  patchOpenChannelEntry("Pouliční dealeři", dealerActiveEffect);
}

function hasStoredDistrictBuildingDetailEntry(district, buildingName) {
  const state = getStoredDistrictBuildingDetailState();
  const key = getDistrictBuildingDetailStorageKey(district, buildingName);
  return Boolean(state[key] && typeof state[key] === "object");
}

function mergeLegacyDistrictBuildingDetailEntries(entries = []) {
  const merged = {};
  let populationSource = null;
  let studentSource = null;
  let dirtyCashSource = null;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    if (!populationSource || Number(entry.storedPopulation || 0) > Number(populationSource.storedPopulation || 0)) {
      populationSource = entry;
    }
    if (!studentSource || Number(entry.storedStudents || 0) > Number(studentSource.storedStudents || 0)) {
      studentSource = entry;
    }
    if (!dirtyCashSource || Number(entry.storedDirtyCash || 0) > Number(dirtyCashSource.storedDirtyCash || 0)) {
      dirtyCashSource = entry;
    }

    if (entry.actionCooldowns && typeof entry.actionCooldowns === "object") {
      merged.actionCooldowns = merged.actionCooldowns || {};
      for (const [actionId, expiresAt] of Object.entries(entry.actionCooldowns)) {
        if (String(actionId || "") === "openChannelActiveUntil") {
          continue;
        }
        merged.actionCooldowns[actionId] = Math.max(
          Number(merged.actionCooldowns[actionId] || 0),
          Number(expiresAt || 0)
        );
      }
    }

    if (Array.isArray(entry.activeEffects)) {
      merged.activeEffects = [
        ...(merged.activeEffects || []),
        ...entry.activeEffects.filter((effect) => effect && typeof effect === "object")
      ];
    }

    for (const field of [
      "level",
      "lastCollectedAt",
      "schoolEveningCourseExpiresAt",
      "openChannelExpiresAt",
      "silentChannelExpiresAt",
      "populationFullNotifiedAt",
      "studentFullNotifiedAt",
      "smugglingFullNotifiedAt"
    ]) {
      if (Number(entry[field] || 0) > Number(merged[field] || 0)) {
        merged[field] = entry[field];
      }
    }
  }

  if (populationSource) {
    merged.storedPopulation = populationSource.storedPopulation;
    merged.populationLastUpdatedAt = populationSource.populationLastUpdatedAt;
    merged.populationCapacity = populationSource.populationCapacity;
  }
  if (studentSource) {
    merged.storedStudents = studentSource.storedStudents;
    merged.schoolLastUpdatedAt = studentSource.schoolLastUpdatedAt;
    merged.studentCapacity = studentSource.studentCapacity;
  }
  if (dirtyCashSource) {
    merged.storedDirtyCash = dirtyCashSource.storedDirtyCash;
    merged.smugglingLastUpdatedAt = dirtyCashSource.smugglingLastUpdatedAt;
    merged.smugglingBatchCapacity = dirtyCashSource.smugglingBatchCapacity;
  }

  return merged;
}

function getLegacyDistrictBuildingDetailEntry(state = {}, lookupKey = "") {
  const entries = Object.entries(state)
    .filter(([key, value]) => (
      !key.startsWith(SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX)
      && key.endsWith(`:${lookupKey}`)
      && value
      && typeof value === "object"
    ))
    .map(([, value]) => value);

  if (entries.length <= 0) {
    return {};
  }

  return mergeLegacyDistrictBuildingDetailEntries(entries);
}

function getDistrictBuildingDetailEntry(district, buildingName) {
  const state = getStoredDistrictBuildingDetailState();
  const key = getDistrictBuildingDetailStorageKey(district, buildingName);
  const storedEntry = state[key] && typeof state[key] === "object" ? state[key] : null;
  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName) || "building";
  const entry = storedEntry || getLegacyDistrictBuildingDetailEntry(state, lookupKey);
  const now = Date.now();
  const level = Math.max(1, Math.min(DISTRICT_BUILDING_DETAIL_MAX_LEVEL, Math.floor(Number(entry.level || 1))));
  const lastCollectedAt = Number.isFinite(Number(entry.lastCollectedAt))
    ? Number(entry.lastCollectedAt)
    : now - DISTRICT_BUILDING_DETAIL_DEFAULT_ACCRUAL_MS;
  const actionCooldowns = entry.actionCooldowns && typeof entry.actionCooldowns === "object"
    ? { ...entry.actionCooldowns }
    : {};
  for (const actionId of Object.keys(actionCooldowns)) {
    if (String(actionId || "") === "openChannelActiveUntil") {
      delete actionCooldowns[actionId];
    }
  }
  const activeEffects = Array.isArray(entry.activeEffects)
    ? entry.activeEffects
        .filter((effect) => effect && typeof effect === "object")
        .filter((effect) => Number(effect.expiresAt || 0) > now)
    : [];
  return {
    level,
    lastCollectedAt,
    actionCooldowns,
    activeEffects,
    storedPopulation: Math.max(0, Number(entry.storedPopulation || 0)),
    populationLastUpdatedAt: Number.isFinite(Number(entry.populationLastUpdatedAt))
      ? Number(entry.populationLastUpdatedAt)
      : lastCollectedAt,
    populationCapacity: Number.isFinite(Number(entry.populationCapacity))
      ? Math.max(1, Math.floor(Number(entry.populationCapacity)))
      : APARTMENT_BLOCK_BASE_CAPACITY,
    populationFullNotifiedAt: Number.isFinite(Number(entry.populationFullNotifiedAt))
      ? Number(entry.populationFullNotifiedAt)
      : 0,
    storedStudents: Math.max(0, Number(entry.storedStudents || 0)),
    schoolLastUpdatedAt: Number.isFinite(Number(entry.schoolLastUpdatedAt))
      ? Number(entry.schoolLastUpdatedAt)
      : lastCollectedAt,
    studentCapacity: Number.isFinite(Number(entry.studentCapacity))
      ? Math.max(1, Math.floor(Number(entry.studentCapacity)))
      : SCHOOL_CONFIG.baseStudentCapacity,
    studentFullNotifiedAt: Number.isFinite(Number(entry.studentFullNotifiedAt))
      ? Number(entry.studentFullNotifiedAt)
      : 0,
    schoolEveningCourseExpiresAt: Number.isFinite(Number(entry.schoolEveningCourseExpiresAt))
      ? Number(entry.schoolEveningCourseExpiresAt)
      : 0,
    storedDirtyCash: Math.max(0, Number(entry.storedDirtyCash || 0)),
    smugglingLastUpdatedAt: Number.isFinite(Number(entry.smugglingLastUpdatedAt))
      ? Number(entry.smugglingLastUpdatedAt)
      : lastCollectedAt,
    smugglingBatchCapacity: Number.isFinite(Number(entry.smugglingBatchCapacity))
      ? Math.max(0, Math.floor(Number(entry.smugglingBatchCapacity)))
      : SMUGGLING_TUNNEL_CONFIG.baseBatchCapacity,
    smugglingFullNotifiedAt: Number.isFinite(Number(entry.smugglingFullNotifiedAt))
      ? Number(entry.smugglingFullNotifiedAt)
      : 0,
    openChannelExpiresAt: Number.isFinite(Number(entry.openChannelExpiresAt))
      ? Number(entry.openChannelExpiresAt)
      : 0,
    silentChannelExpiresAt: Number.isFinite(Number(entry.silentChannelExpiresAt))
      ? Number(entry.silentChannelExpiresAt)
      : 0
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

function resetOwnedApartmentBlockPopulationEntries(sourceDistrict, populationCapacity = APARTMENT_BLOCK_BASE_CAPACITY) {
  const now = Date.now();
  updateDistrictBuildingDetailEntry(sourceDistrict, "Bytový blok", (entry) => ({
    ...entry,
    storedPopulation: 0,
    populationLastUpdatedAt: now,
    populationCapacity,
    populationFullNotifiedAt: 0,
    lastCollectedAt: now
  }));
}

function resetOwnedSchoolPopulationEntries(sourceDistrict, studentCapacity = SCHOOL_CONFIG.baseStudentCapacity) {
  const now = Date.now();
  updateDistrictBuildingDetailEntry(sourceDistrict, "Škola", (entry) => ({
    ...entry,
    storedStudents: 0,
    schoolLastUpdatedAt: now,
    studentCapacity,
    studentFullNotifiedAt: 0,
    lastCollectedAt: now
  }));
}

function resolveDistrictBuildingDetailMechanicsType(buildingName) {
  const lookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName);
  return DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[lookupKey] || "district-asset";
}

function renderDistrictBuildingInfoSection(infoElement, {
  profile,
  mechanics,
  buildingName,
  entry
}) {
  const viewModel = createBuildingDetailInfoViewModel({
    profile,
    mechanics,
    buildingName,
    entry,
    playerHeat: getResolvedGangState().heat,
    actionProfiles: (Array.isArray(profile.actions) ? profile.actions : []).map((_, actionIndex) => getDistrictBuildingSpecialActionProfile(buildingName, actionIndex)),
    now: Date.now()
  });

  renderBuildingDetailInfoSectionPanel(infoElement, viewModel);
}

function formatNetworkBonusPercent(multiplier = 1) {
  const value = Number(multiplier);
  if (!Number.isFinite(value)) {
    return "";
  }
  const percent = Math.round((value - 1) * 100);
  return percent > 0 ? `+${percent} %` : "";
}

function formatNetworkEffectPart(label = "", multiplier = 1) {
  const bonus = formatNetworkBonusPercent(multiplier);
  return bonus ? `${label} ${bonus}` : "";
}

function joinNetworkEffectParts(prefix = "", parts = []) {
  const text = parts.filter(Boolean).join(", ");
  return text ? `${prefix}: ${text}` : "";
}

function resolveDistrictBuildingNetworkEffectLabel({
  mechanicsType = "",
  arcadeNetwork = null,
  apartmentNetwork = null,
  autoSalonNetwork = null,
  clinicNetwork = null,
  exchangeNetwork = null,
  fitnessClubNetwork = null,
  garageNetwork = null,
  multiplier = 1,
  powerStationNetwork = null,
  recyclingCenterNetwork = null,
  restaurantNetwork = null,
  schoolNetwork = null,
  shoppingMallNetwork = null,
  smugglingTunnelNetwork = null,
  warehouseNetwork = null
} = {}) {
  if (mechanicsType === "apartment-block" && apartmentNetwork) {
    return joinNetworkEffectParts("Síť bytových bloků", [
      formatNetworkEffectPart("produkce", apartmentNetwork.populationProductionMultiplier),
      formatNetworkEffectPart("kapacita", apartmentNetwork.capacityMultiplier)
    ]);
  }
  if (mechanicsType === "school" && schoolNetwork) {
    return joinNetworkEffectParts("Síť škol", [
      formatNetworkEffectPart("populace", schoolNetwork.populationProductionMultiplier),
      formatNetworkEffectPart("kapacita", schoolNetwork.studentCapacityMultiplier),
      formatNetworkEffectPart("income", schoolNetwork.incomeMultiplier)
    ]);
  }
  if (restaurantNetwork) {
    return joinNetworkEffectParts("Síť restaurací", [
      formatNetworkEffectPart("income", restaurantNetwork.incomeMultiplier),
      formatNetworkEffectPart("vliv", restaurantNetwork.influenceMultiplier),
      formatNetworkEffectPart("drby", restaurantNetwork.rumorMultiplier),
      formatNetworkEffectPart("heat", restaurantNetwork.heatMultiplier)
    ]);
  }
  if (shoppingMallNetwork) {
    return joinNetworkEffectParts("Síť obchodních center", [
      formatNetworkEffectPart("clean", shoppingMallNetwork.cleanIncomeMultiplier),
      formatNetworkEffectPart("dirty", shoppingMallNetwork.dirtyIncomeMultiplier),
      formatNetworkEffectPart("vliv", shoppingMallNetwork.influenceMultiplier),
      formatNetworkEffectPart("heat", shoppingMallNetwork.heatMultiplier)
    ]);
  }
  if (autoSalonNetwork) {
    return joinNetworkEffectParts("Síť autosalonů", [
      formatNetworkEffectPart("clean", autoSalonNetwork.cleanIncomeMultiplier),
      formatNetworkEffectPart("dirty", autoSalonNetwork.dirtyIncomeMultiplier),
      formatNetworkEffectPart("heat", autoSalonNetwork.heatMultiplier)
    ]);
  }
  if (fitnessClubNetwork) {
    return joinNetworkEffectParts("Síť fitness clubů", [
      formatNetworkEffectPart("income", fitnessClubNetwork.incomeMultiplier),
      formatNetworkEffectPart("heat", fitnessClubNetwork.heatMultiplier)
    ]);
  }
  if (garageNetwork) {
    return joinNetworkEffectParts("Síť garáží", [
      formatNetworkEffectPart("income", garageNetwork.incomeMultiplier),
      formatNetworkEffectPart("heat", garageNetwork.heatMultiplier)
    ]);
  }
  if (warehouseNetwork) {
    return joinNetworkEffectParts("Síť skladišť", [
      formatNetworkEffectPart("income", warehouseNetwork.incomeMultiplier),
      formatNetworkEffectPart("kapacita", warehouseNetwork.storageCapacityMultiplier),
      formatNetworkEffectPart("heat", warehouseNetwork.heatMultiplier)
    ]);
  }
  if (clinicNetwork) {
    return joinNetworkEffectParts("Síť klinik", [
      formatNetworkEffectPart("income", clinicNetwork.incomeMultiplier),
      formatNetworkEffectPart("heat", clinicNetwork.heatMultiplier)
    ]);
  }
  if (exchangeNetwork) {
    return joinNetworkEffectParts("Síť směnáren", [
      formatNetworkEffectPart("výnos", exchangeNetwork.incomeMultiplier),
      formatNetworkEffectPart("limit praní", exchangeNetwork.launderingLimitMultiplier),
      formatNetworkEffectPart("heat", exchangeNetwork.heatMultiplier)
    ]);
  }
  if (arcadeNetwork) {
    return joinNetworkEffectParts("Síť heren", [
      formatNetworkEffectPart("income", arcadeNetwork.incomeMultiplier),
      formatNetworkEffectPart("limit praní", arcadeNetwork.launderingLimitMultiplier),
      formatNetworkEffectPart("heat", arcadeNetwork.heatMultiplier)
    ]);
  }
  if (smugglingTunnelNetwork) {
    return joinNetworkEffectParts("Síť pašovacích tunelů", [
      formatNetworkEffectPart("dirty", smugglingTunnelNetwork.dirtyProductionMultiplier),
      formatNetworkEffectPart("heat", smugglingTunnelNetwork.heatMultiplier || smugglingTunnelNetwork.passiveHeatMultiplier)
    ]);
  }
  if (powerStationNetwork) {
    return joinNetworkEffectParts("Síť energetických stanic", [
      formatNetworkEffectPart("Income", powerStationNetwork.incomeMultiplier),
      formatNetworkEffectPart("Heat", powerStationNetwork.heatMultiplier)
    ]);
  }
  if (recyclingCenterNetwork) {
    return joinNetworkEffectParts("Síť recyklačních center", [
      formatNetworkEffectPart("Income", recyclingCenterNetwork.incomeMultiplier),
      formatNetworkEffectPart("Heat", recyclingCenterNetwork.heatMultiplier)
    ]);
  }

  const levelBonus = formatNetworkBonusPercent(multiplier);
  return levelBonus ? `Level bonus ${levelBonus}` : "";
}

function resolveDistrictBuildingDetailMechanics(district, buildingName, options = {}) {
  const entry = {
    ...getDistrictBuildingDetailEntry(district, buildingName),
    ...(options.entryOverride || {})
  };
  const mechanicsType = resolveDistrictBuildingDetailMechanicsType(buildingName);
  const buildingLookupKey = resolveDistrictBuildingCanonicalLookupKey(buildingName);
  const ownedBuildingCount = getOwnedDistrictBuildingCountByBaseName(buildingLookupKey);
  const isShoppingMall = buildingLookupKey === "obchodni centrum";
  const isAutoSalon = buildingLookupKey === "autosalon";
  const isFitnessClub = buildingLookupKey === "fitness club";
  const isRecruitmentCenter = mechanicsType === "recruitment-center";
  const isRestaurant = mechanicsType === "restaurant" || buildingLookupKey === "restaurace";
  const isGarage = mechanicsType === "garage";
  const isPowerStation = mechanicsType === "power-plant" || buildingLookupKey === "energeticka stanice";
  const isRecyclingCenter = mechanicsType === "recycling-center" || buildingLookupKey === "recyklacni centrum";
  const income = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2, buildingName, { clean: 0, dirty: 0 });
  const heatRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2, buildingName, { heat: 0 });
  const influenceRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2, buildingName, { influence: 0 });
  const now = Date.now();
  const elapsedMs = Math.min(DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS, Math.max(0, now - entry.lastCollectedAt));
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const localMaxLevel = mechanicsType === "casino"
    ? CASINO_DETAIL_MAX_LEVEL
    : (mechanicsType === "apartment-block" || mechanicsType === "school" || isGarage)
      ? 1
      : DISTRICT_BUILDING_DETAIL_MAX_LEVEL;
  const maxLevel = Math.min(localMaxLevel, getServerAuthoritativeBuildingUpgradeMaxLevel(mechanicsType));
  const level = Math.max(1, Math.min(maxLevel, Math.floor(Number(entry.level || 1))));
  const casinoUpgrade = mechanicsType === "casino" ? getCasinoDetailUpgrade(level) : null;
  const ownedExchangeOffices = mechanicsType === "exchange" ? getOwnedExchangeOfficeCount() : 0;
  const exchangeNetwork = mechanicsType === "exchange" ? getExchangeOfficeNetworkMultipliers(ownedExchangeOffices) : null;
  const ownedArcades = mechanicsType === "arcade" ? getOwnedArcadeCount() : 0;
  const arcadeNetwork = mechanicsType === "arcade" ? getArcadeNetworkMultipliers(ownedArcades) : null;
  const ownedApartmentBlocks = mechanicsType === "apartment-block" ? getOwnedApartmentBlockCount() : 0;
  const apartmentNetwork = mechanicsType === "apartment-block" ? getApartmentBlockNetworkMultipliers(ownedApartmentBlocks) : null;
  const ownedSchools = mechanicsType === "school" ? getOwnedSchoolCount() : 0;
  const schoolNetwork = mechanicsType === "school" ? getSchoolNetworkMultipliers(ownedSchools) : null;
  const schoolEveningCourseActive = mechanicsType === "school" && Number(entry.schoolEveningCourseExpiresAt || 0) > now;
  const schoolApartmentBoost = mechanicsType === "apartment-block" ? getActiveSchoolApartmentBoost(now) : null;
  const schoolApartmentBoostMultiplier = schoolApartmentBoost
    ? 1 + Math.max(0, Number(schoolApartmentBoost.apartmentPopulationBoostPct || 0)) / 100
    : 1;
  const serverStorageSummary = mechanicsType === "warehouse" ? getGameplayStorageSummary() : null;
  const ownedWarehouses = mechanicsType === "warehouse"
    ? serverStorageSummary?.warehouseSummary?.ownedWarehouseCount ?? getOwnedWarehouseCount()
    : 0;
  const warehouseNetwork = mechanicsType === "warehouse" ? getWarehouseNetworkMultipliers(ownedWarehouses) : null;
  const warehouseCapacity = mechanicsType === "warehouse" && !serverStorageSummary
    ? getWarehouseCapacityBreakdown(ownedWarehouses)
    : null;
  const warehouseUsage = mechanicsType === "warehouse" && !serverStorageSummary
    ? getWarehouseStorageUsage(warehouseCapacity)
    : null;
  const warehouseWarnings = mechanicsType === "warehouse" && !serverStorageSummary
    ? getWarehouseCapacityWarnings(warehouseUsage)
    : [];
  const ownedClinics = mechanicsType === "clinic" ? getOwnedClinicCount() : 0;
  const clinicNetwork = mechanicsType === "clinic" ? getClinicNetworkMultipliers(ownedClinics) : null;
  const clinicRecoveryRatePct = mechanicsType === "clinic" ? getClinicRecoveryRatePct(ownedClinics) : 0;
  const recoveryPoolView = mechanicsType === "clinic" || mechanicsType === "recycling-center"
    ? getClinicRecoveryPoolView(now)
    : null;
  const clinicRecoveryPool = mechanicsType === "clinic" ? recoveryPoolView : null;
  const recyclingSalvagePool = mechanicsType === "recycling-center" ? recoveryPoolView : null;
  const ownedShoppingMalls = isShoppingMall ? getOwnedShoppingMallCountForMarket() : 0;
  const shoppingMallMarketDiscount = isShoppingMall ? getShoppingMallMarketDiscountForTab("market") : null;
  const shoppingMallBlackMarketDiscount = isShoppingMall ? getShoppingMallMarketDiscountForTab("black-market") : null;
  const shoppingMallNetwork = isShoppingMall ? getShoppingMallNetworkMultipliers(ownedShoppingMalls) : null;
  const ownedAutoSalons = getOwnedAutoSalonCount();
  const autoSalonNetwork = isAutoSalon ? getAutoSalonNetworkMultipliers(ownedAutoSalons) : null;
  const autoSalonSupport = getAutoSalonSupportStats(ownedAutoSalons);
  const ownedFitnessClubs = isFitnessClub ? getOwnedFitnessClubCount() : 0;
  const fitnessClubNetwork = isFitnessClub ? getFitnessClubNetworkMultipliers(ownedFitnessClubs) : null;
  const fitnessClubSupport = isFitnessClub ? getFitnessClubSupportStats(ownedFitnessClubs) : null;
  const ownedRecruitmentCenters = isRecruitmentCenter ? getOwnedRecruitmentCenterCount() : 0;
  const recruitmentCenterNetwork = isRecruitmentCenter ? getRecruitmentCenterNetworkMultipliers(ownedRecruitmentCenters) : null;
  const recruitmentCenterSupport = isRecruitmentCenter ? getRecruitmentCenterSupportStats(ownedRecruitmentCenters) : null;
  const ownedRestaurants = isRestaurant ? getOwnedRestaurantCount() : 0;
  const restaurantNetwork = isRestaurant ? getRestaurantNetworkMultipliers(ownedRestaurants) : null;
  const ownedGarages = getOwnedGarageCount();
  const garageNetwork = isGarage ? getGarageNetworkMultipliers(ownedGarages) : null;
  const garageSupport = getGarageSupportStats(ownedGarages);
  const ownedSmugglingTunnels = mechanicsType === "smuggling-tunnel" ? getOwnedSmugglingTunnelCount() : 0;
  const smugglingTunnelNetwork = mechanicsType === "smuggling-tunnel" ? getSmugglingTunnelNetworkMultipliers(ownedSmugglingTunnels) : null;
  const ownedPowerStations = isPowerStation ? getOwnedPowerStationCount() : 0;
  const powerStationNetwork = isPowerStation ? getPowerStationNetworkMultipliers(ownedPowerStations) : null;
  const ownedRecyclingCenters = isRecyclingCenter ? getOwnedRecyclingCenterCount() : 0;
  const recyclingCenterNetwork = isRecyclingCenter ? getRecyclingCenterNetworkMultipliers(ownedRecyclingCenters) : null;
  const powerStationBackupActive = isPowerStation && Number(entry.backupGridSwitchExpiresAt || 0) > now;
  const powerStationBackupRemainingMs = Math.max(0, Number(entry.backupGridSwitchExpiresAt || 0) - now);
  const smugglingOpenChannelActive = mechanicsType === "smuggling-tunnel" && Number(entry.openChannelExpiresAt || entry.silentChannelExpiresAt || 0) > now;
  const smugglingTunnelEntryForStreetDealers = mechanicsType === "street-dealers"
    ? getDistrictBuildingDetailEntry(district, "Pašovací tunel")
    : null;
  const streetDealerOpenChannelExpiresAt = smugglingTunnelEntryForStreetDealers
    ? Math.max(
        Number(smugglingTunnelEntryForStreetDealers.openChannelExpiresAt || 0),
        Number(smugglingTunnelEntryForStreetDealers.silentChannelExpiresAt || 0)
      )
    : 0;
  const streetDealerOpenChannelEffect = streetDealerOpenChannelExpiresAt > now
    ? createOpenChannelDealerActiveEffect(streetDealerOpenChannelExpiresAt)
    : null;
  const smugglingDealerSupplyBonusPct = mechanicsType === "smuggling-tunnel"
    ? Math.min(SMUGGLING_TUNNEL_CONFIG.dealerSupplyMaxBonusPct, ownedSmugglingTunnels * SMUGGLING_TUNNEL_CONFIG.dealerSupplyBonusPctPerTunnel)
    : 0;
  const smugglingContrabandFlowLabel = ownedSmugglingTunnels >= 10
    ? "Podzemní síť"
    : ownedSmugglingTunnels >= 6
      ? "Silná podpora"
      : ownedSmugglingTunnels >= 3
        ? "Stabilní podpora"
        : ownedSmugglingTunnels >= 1
          ? "Nízká podpora"
          : "Bez podpory";
  const multiplier = arcadeNetwork
    ? arcadeNetwork.incomeMultiplier
    : exchangeNetwork
    ? exchangeNetwork.incomeMultiplier
    : warehouseNetwork
    ? warehouseNetwork.incomeMultiplier
    : clinicNetwork
    ? clinicNetwork.incomeMultiplier
    : fitnessClubNetwork
    ? fitnessClubNetwork.incomeMultiplier
    : recruitmentCenterNetwork
    ? recruitmentCenterNetwork.incomeMultiplier
    : restaurantNetwork
    ? restaurantNetwork.incomeMultiplier
    : garageNetwork
    ? garageNetwork.incomeMultiplier
    : schoolNetwork
    ? schoolNetwork.incomeMultiplier
    : autoSalonNetwork
    ? autoSalonNetwork.cleanIncomeMultiplier
    : powerStationNetwork
    ? powerStationNetwork.incomeMultiplier
    : recyclingCenterNetwork
    ? recyclingCenterNetwork.incomeMultiplier
    : casinoUpgrade
    ? 1 + (casinoUpgrade.incomeBonusPct / 100)
    : 1 + ((level - 1) * 0.14);
  const cleanHourly = mechanicsType === "smuggling-tunnel" ? 0 : Math.max(0, Math.round(Number(income.clean || 0) * 60 * multiplier));
  const dirtyHourly = mechanicsType === "smuggling-tunnel"
    ? Math.max(0, Math.round(SMUGGLING_TUNNEL_CONFIG.dirtyCashPerMinute * 60 * (smugglingTunnelNetwork?.dirtyProductionMultiplier || 1) * (smugglingOpenChannelActive ? 1 + SMUGGLING_TUNNEL_CONFIG.openChannelTunnelDirtyProductionBonusPct / 100 : 1)))
    : Math.max(0, Math.round(Number(income.dirty || 0) * 60 * (autoSalonNetwork ? autoSalonNetwork.dirtyIncomeMultiplier : multiplier)));
  const storedClean = Math.max(0, Math.floor(cleanHourly * elapsedHours));
  const storedDirty = Math.max(0, Math.floor(dirtyHourly * elapsedHours));
  const memberGain = Math.max(1, Math.floor((level + 1) * Math.max(0.5, elapsedHours)));
  const materialGain = Math.max(1, Math.floor((level + 2) * Math.max(0.75, elapsedHours)));
  const influenceActionGain = Math.max(1, Math.ceil(level * 1.5));
  const quickCashGain = Math.max(50, Math.round((cleanHourly + dirtyHourly) / 4));
  const moneyActionAmount = Math.max(250, level * 650);
  const upgradeCost = level >= maxLevel
    ? 0
    : casinoUpgrade
      ? getCasinoDetailUpgrade(level + 1).clean
      : Math.max(850, Math.round((cleanHourly + dirtyHourly + 120) * (level + 2) * 2.4));
  const nextLevel = level >= maxLevel ? null : level + 1;
  const nextCasinoUpgrade = casinoUpgrade && nextLevel ? getCasinoDetailUpgrade(nextLevel) : null;
  const casinoLaunderingCapacity = casinoUpgrade
    ? Math.round(CASINO_DETAIL_BASE_LAUNDERING_CAPACITY * (1 + casinoUpgrade.launderingLimitBonusPct / 100))
    : 0;
  const casinoLaunderingFeePct = casinoUpgrade
    ? Math.max(0, CASINO_DETAIL_BASE_LAUNDERING_FEE_PCT - casinoUpgrade.launderingFeeReductionPct)
    : 0;
  const exchangeLaunderingCapacity = exchangeNetwork
    ? Math.round(EXCHANGE_OFFICE_BASE_LAUNDERING_CAPACITY * exchangeNetwork.launderingLimitMultiplier)
    : 0;
  const arcadeLaunderingCapacity = arcadeNetwork
    ? Math.round(ARCADE_BASE_LAUNDERING_CAPACITY * arcadeNetwork.launderingLimitMultiplier)
    : 0;
  const apartmentCapacity = apartmentNetwork
    ? Math.max(1, Math.floor(APARTMENT_BLOCK_BASE_CAPACITY * apartmentNetwork.capacityMultiplier))
    : 0;
  const apartmentElapsedMs = mechanicsType === "apartment-block"
    ? Math.max(0, now - Number(entry.populationLastUpdatedAt || entry.lastCollectedAt || now))
    : 0;
  const apartmentStoredBase = mechanicsType === "apartment-block"
    ? Math.min(apartmentCapacity, Math.max(0, Number(entry.storedPopulation || 0)))
    : 0;
  const apartmentBasePopulationPerMinute = apartmentNetwork
    ? APARTMENT_BLOCK_POPULATION_PER_MINUTE * apartmentNetwork.populationProductionMultiplier
    : 0;
  const apartmentPopulationPerMinute = apartmentBasePopulationPerMinute * schoolApartmentBoostMultiplier;
  const apartmentBoostedElapsedMs = schoolApartmentBoost
    ? Math.max(0, now - Math.max(Number(entry.populationLastUpdatedAt || entry.lastCollectedAt || now), Number(schoolApartmentBoost.startedAt || now)))
    : 0;
  const apartmentProducedPopulation = apartmentStoredBase >= apartmentCapacity
    ? 0
    : apartmentBasePopulationPerMinute * apartmentElapsedMs / 60000
      + apartmentBasePopulationPerMinute * (schoolApartmentBoostMultiplier - 1) * apartmentBoostedElapsedMs / 60000;
  const apartmentStoredPopulation = mechanicsType === "apartment-block"
    ? Math.min(apartmentCapacity, apartmentStoredBase + apartmentProducedPopulation)
    : 0;
  const apartmentWholePopulation = Math.max(0, Math.floor(apartmentStoredPopulation));
  const apartmentIsFull = mechanicsType === "apartment-block" && apartmentCapacity > 0 && apartmentStoredPopulation >= apartmentCapacity;
  const apartmentTimeToFullMs = mechanicsType === "apartment-block" && !apartmentIsFull && apartmentPopulationPerMinute > 0
    ? Math.ceil((apartmentCapacity - apartmentStoredPopulation) / apartmentPopulationPerMinute * 60000)
    : 0;
  const schoolCapacity = schoolNetwork
    ? Math.max(1, Math.floor(SCHOOL_CONFIG.baseStudentCapacity * schoolNetwork.studentCapacityMultiplier))
    : 0;
  const schoolElapsedMs = mechanicsType === "school"
    ? Math.max(0, now - Number(entry.schoolLastUpdatedAt || entry.lastCollectedAt || now))
    : 0;
  const schoolStoredBase = mechanicsType === "school"
    ? Math.min(schoolCapacity, Math.max(0, Number(entry.storedStudents || 0)))
    : 0;
  const schoolPopulationPerMinute = schoolNetwork
    ? SCHOOL_CONFIG.populationPerMinute * schoolNetwork.populationProductionMultiplier
    : 0;
  const schoolStoredStudents = mechanicsType === "school"
    ? Math.min(schoolCapacity, schoolStoredBase + (schoolStoredBase >= schoolCapacity ? 0 : schoolPopulationPerMinute * schoolElapsedMs / 60000))
    : 0;
  const schoolWholeStudents = Math.max(0, Math.floor(schoolStoredStudents));
  const schoolIsFull = mechanicsType === "school" && schoolCapacity > 0 && schoolStoredStudents >= schoolCapacity;
  const schoolTimeToFullMs = mechanicsType === "school" && !schoolIsFull && schoolPopulationPerMinute > 0
    ? Math.ceil((schoolCapacity - schoolStoredStudents) / schoolPopulationPerMinute * 60000)
    : 0;
  const smugglingBatchCapacity = smugglingTunnelNetwork
    ? Math.max(0, Math.floor(SMUGGLING_TUNNEL_CONFIG.baseBatchCapacity * smugglingTunnelNetwork.batchCapacityMultiplier))
    : 0;
  const smugglingStoredBase = mechanicsType === "smuggling-tunnel"
    ? Math.min(smugglingBatchCapacity, Math.max(0, Number(entry.storedDirtyCash || 0)))
    : 0;
  const smugglingElapsedMs = mechanicsType === "smuggling-tunnel"
    ? Math.max(0, now - Number(entry.smugglingLastUpdatedAt || entry.lastCollectedAt || now))
    : 0;
  const smugglingDirtyPerMinute = mechanicsType === "smuggling-tunnel"
    ? SMUGGLING_TUNNEL_CONFIG.dirtyCashPerMinute * (smugglingTunnelNetwork?.dirtyProductionMultiplier || 1) * (smugglingOpenChannelActive ? 1 + SMUGGLING_TUNNEL_CONFIG.openChannelTunnelDirtyProductionBonusPct / 100 : 1)
    : 0;
  const smugglingStoredDirtyCash = mechanicsType === "smuggling-tunnel"
    ? Math.min(smugglingBatchCapacity, smugglingStoredBase + (smugglingStoredBase >= smugglingBatchCapacity ? 0 : smugglingDirtyPerMinute * smugglingElapsedMs / 60000))
    : 0;
  const smugglingWholeDirtyCash = Math.max(0, Math.floor(smugglingStoredDirtyCash));
  const smugglingIsFull = mechanicsType === "smuggling-tunnel" && smugglingBatchCapacity > 0 && smugglingStoredDirtyCash >= smugglingBatchCapacity;
  const smugglingTimeToFullMs = mechanicsType === "smuggling-tunnel" && !smugglingIsFull && smugglingDirtyPerMinute > 0
    ? Math.ceil((smugglingBatchCapacity - smugglingStoredDirtyCash) / smugglingDirtyPerMinute * 60000)
    : 0;
  const dailyHeat = Math.round(Number(heatRule.heat || 0) * (smugglingTunnelNetwork?.heatMultiplier || smugglingTunnelNetwork?.passiveHeatMultiplier || powerStationNetwork?.heatMultiplier || recyclingCenterNetwork?.heatMultiplier || garageNetwork?.heatMultiplier || fitnessClubNetwork?.heatMultiplier || recruitmentCenterNetwork?.heatMultiplier || restaurantNetwork?.heatMultiplier || autoSalonNetwork?.heatMultiplier || clinicNetwork?.heatMultiplier || warehouseNetwork?.heatMultiplier || arcadeNetwork?.heatMultiplier || exchangeNetwork?.heatMultiplier || 1) * 1440 * 10) / 10;
  const dailyInfluence = Math.round(Number(influenceRule.influence || 0) * (restaurantNetwork?.influenceMultiplier || 1) * 1440 * 10) / 10;
  const activeEffectsForLabel = [
    ...(entry.activeEffects || []),
    ...(streetDealerOpenChannelEffect && !(entry.activeEffects || []).some((effect) => String(effect?.label || "") === streetDealerOpenChannelEffect.label)
      ? [streetDealerOpenChannelEffect]
      : [])
  ];
  const activeEffectLabels = activeEffectsForLabel
    .map((effect) => formatActiveDistrictBuildingEffectLabel(effect, now))
    .filter(Boolean);
  const canCollect =
    mechanicsType === "apartment-block" ? apartmentWholePopulation >= APARTMENT_BLOCK_MIN_COLLECT_POPULATION
      : mechanicsType === "school" ? schoolWholeStudents > 0
      : false;
  const hasManualCollect =
    mechanicsType === "apartment-block" || mechanicsType === "school";
  const storedOutputLabel = [
    mechanicsType === "apartment-block" ? `${apartmentWholePopulation}/${apartmentCapacity} obyvatel` : "",
    mechanicsType === "school" ? `${schoolWholeStudents}/${schoolCapacity} členů` : ""
  ].filter(Boolean).join(" · ") || "Zatím nic";
  const effectsLabel = [
    cleanHourly > 0 ? `Clean cash +${formatDistrictBuildingMoney(cleanHourly)}/hod` : "",
    dirtyHourly > 0 ? `Dirty cash +${formatDistrictBuildingMoney(dirtyHourly)}/hod` : "",
    mechanicsType === "apartment-block" ? `Populace +${apartmentPopulationPerMinute.toFixed(2)}/min` : "",
    mechanicsType === "school" ? `Populace +${schoolPopulationPerMinute.toFixed(2)}/min` : "",
    mechanicsType === "smuggling-tunnel" ? `Pouliční dealeři +${smugglingDealerSupplyBonusPct}% z pašovacích tunelů` : "",
    isGarage ? `Cooldowny -${garageSupport?.cooldownReductionPct || 0}%` : "",
    apartmentIsFull ? "Plná kapacita · Bytový blok je plný. Obyvatelé čekají na vybrání." : "",
    schoolIsFull ? "Plná kapacita · Škola má naplněnou lokální populační kapacitu." : "",
    mechanicsType === "smuggling-tunnel" && smugglingOpenChannelActive ? `Otevřený kanál aktivní ${formatDistrictBuildingCooldown(Number(entry.openChannelExpiresAt || entry.silentChannelExpiresAt || 0) - now)}` : "",
    isPowerStation && powerStationBackupActive ? `Záložní síť aktivní ${formatDistrictBuildingCooldown(powerStationBackupRemainingMs)}` : "",
    ...warehouseWarnings,
    dailyHeat > 0 ? `Heat +${dailyHeat}/den` : "",
    dailyInfluence > 0 ? `Vliv +${dailyInfluence}/den` : "",
    ...activeEffectLabels,
    resolveDistrictBuildingNetworkEffectLabel({
      mechanicsType,
      arcadeNetwork,
      apartmentNetwork,
      autoSalonNetwork,
      clinicNetwork,
      exchangeNetwork,
      fitnessClubNetwork,
      garageNetwork,
      multiplier,
      restaurantNetwork,
      schoolNetwork,
      shoppingMallNetwork,
      smugglingTunnelNetwork,
      powerStationNetwork,
      recyclingCenterNetwork,
      warehouseNetwork
    })
  ].filter(Boolean).join(" · ");

  return {
    mechanicsType,
    level,
    maxLevel,
    nextLevel,
    upgradeCost,
    upgradeCostLabel: nextLevel
      ? casinoUpgrade
        ? getCasinoDetailUpgradeCostLabel(nextLevel)
        : formatDistrictBuildingMoney(upgradeCost)
      : "Max level",
    casinoLaunderingCapacity,
    casinoLaunderingFeePct,
    casinoActionHeatReductionPct: casinoUpgrade ? casinoUpgrade.actionHeatReductionPct : 0,
    nextCasinoUpgrade,
    ownedExchangeOffices,
    exchangeNetwork,
    exchangeLaunderingCapacity,
    exchangeAuditRisk: mechanicsType === "exchange" ? `${EXCHANGE_OFFICE_BASE_AUDIT_RISK_PCT} %` : "",
    ownedArcades,
    arcadeNetwork,
    arcadeLaunderingCapacity,
    arcadeAuditRisk: mechanicsType === "arcade" ? `${ARCADE_BASE_AUDIT_RISK_PCT} %` : "",
    ownedApartmentBlocks,
    apartmentNetwork,
    apartmentStoredPopulation,
    apartmentCapacity,
    apartmentPopulationPerMinute,
    schoolApartmentBoostActive: Boolean(schoolApartmentBoost),
    schoolApartmentBoostRemainingMs: schoolApartmentBoost ? Math.max(0, Number(schoolApartmentBoost.expiresAt || 0) - now) : 0,
    schoolApartmentBoostPct: schoolApartmentBoost ? Math.max(0, Number(schoolApartmentBoost.apartmentPopulationBoostPct || 0)) : 0,
    apartmentWholePopulation,
    apartmentIsFull,
    apartmentTimeToFullMs,
    ownedSchools,
    schoolNetwork,
    schoolStoredStudents,
    schoolCapacity,
    schoolPopulationPerMinute,
    schoolWholeStudents,
    schoolIsFull,
    schoolTimeToFullMs,
    schoolEveningCourseActive,
    schoolEveningCourseRemainingMs: Math.max(0, Number(entry.schoolEveningCourseExpiresAt || 0) - now),
    ownedWarehouses,
    serverStorageSummary,
    warehouseNetwork,
    warehouseCapacity,
    warehouseUsage,
    warehouseWarnings,
    ownedClinics,
    clinicNetwork,
    clinicRecoveryRatePct,
    clinicRecoveryPool,
    recyclingSalvagePool,
    ownedShoppingMalls,
    shoppingMallMarketDiscount,
    shoppingMallBlackMarketDiscount,
    shoppingMallNetwork,
    ownedAutoSalons,
    autoSalonNetwork,
    autoSalonSupport,
    ownedFitnessClubs,
    fitnessClubNetwork,
    fitnessClubSupport,
    ownedRecruitmentCenters,
    recruitmentCenterNetwork,
    recruitmentCenterSupport,
    ownedRestaurants,
    restaurantNetwork,
    ownedGarages,
    garageNetwork,
    garageSupport,
    ownedSmugglingTunnels,
    smugglingTunnelNetwork,
    ownedPowerStations,
    powerStationNetwork,
    powerStationBackupActive,
    powerStationBackupRemainingMs,
    ownedRecyclingCenters,
    recyclingCenterNetwork,
    recyclingSalvageRatePct: recyclingCenterNetwork?.salvageRatePct || 0,
    smugglingBatchCapacity,
    smugglingStoredDirtyCash,
    smugglingWholeDirtyCash,
    smugglingDirtyPerMinute,
    smugglingIsFull,
    smugglingTimeToFullMs,
    smugglingCollectHeat: getSmugglingTunnelCollectHeat(smugglingWholeDirtyCash),
    smugglingDealerSupplyBonusPct,
    smugglingContrabandFlowLabel,
    smugglingOpenChannelActive,
    smugglingOpenChannelRemainingMs: Math.max(0, Number(entry.openChannelExpiresAt || entry.silentChannelExpiresAt || 0) - now),
    smugglingSilentActive: smugglingOpenChannelActive,
    smugglingSilentRemainingMs: Math.max(0, Number(entry.openChannelExpiresAt || entry.silentChannelExpiresAt || 0) - now),
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
    ownedBuildingCount,
    canCollect,
    hasManualCollect,
    storedOutputLabel,
    effectsLabel,
    actionCooldowns: entry.actionCooldowns
  };
}

const RUNTIME_PASSIVE_PRODUCTION_SYNC_INTERVAL_MS = 30_000;
const PASSIVE_DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES = new Set([
  "apartment-block",
  "school",
  "smuggling-tunnel"
]);
let lastRuntimePassiveProductionSyncAt = 0;

function getDistrictBuildingNameForProductionSync(building) {
  return String(building?.baseName || building?.displayName || building?.name || "").trim();
}

function persistDistrictBuildingDetailProductionSnapshot(district, buildingName, mechanics, now = Date.now()) {
  if (!district || !buildingName || !PASSIVE_DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES.has(mechanics?.mechanicsType)) {
    return false;
  }

  if (mechanics.mechanicsType === "apartment-block") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedPopulation: mechanics.apartmentStoredPopulation,
      populationLastUpdatedAt: now,
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: entry.populationFullNotifiedAt
    }));
    return true;
  }

  if (mechanics.mechanicsType === "school") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedStudents: mechanics.schoolStoredStudents,
      schoolLastUpdatedAt: now,
      studentCapacity: mechanics.schoolCapacity,
      studentFullNotifiedAt: entry.studentFullNotifiedAt
    }));
    return true;
  }

  if (mechanics.mechanicsType === "smuggling-tunnel") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedDirtyCash: mechanics.smugglingStoredDirtyCash,
      smugglingLastUpdatedAt: now,
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: entry.smugglingFullNotifiedAt
    }));
    return true;
  }

  return false;
}

function initializeDistrictBuildingDetailProductionBaseline(district, buildingName, mechanics, now = Date.now()) {
  if (!district || !buildingName || !PASSIVE_DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES.has(mechanics?.mechanicsType)) {
    return false;
  }

  if (mechanics.mechanicsType === "apartment-block") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      lastCollectedAt: now,
      storedPopulation: 0,
      populationLastUpdatedAt: now,
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: 0
    }));
    return true;
  }

  if (mechanics.mechanicsType === "school") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      lastCollectedAt: now,
      storedStudents: 0,
      schoolLastUpdatedAt: now,
      studentCapacity: mechanics.schoolCapacity,
      studentFullNotifiedAt: 0
    }));
    return true;
  }

  if (mechanics.mechanicsType === "smuggling-tunnel") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      lastCollectedAt: now,
      storedDirtyCash: 0,
      smugglingLastUpdatedAt: now,
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: 0
    }));
    return true;
  }

  return false;
}

function syncOwnedDistrictBuildingDetailProduction({ now = Date.now() } = {}) {
  const districtStateApi = typeof window !== "undefined" ? window.empireStreetsDistrictState : null;
  const ownedDistrictIds = normalizeWorldOwnedDistrictIds(getResolvedWorldState());
  let syncedBuildings = 0;

  if (!districtStateApi?.getDistrictById || ownedDistrictIds.length <= 0) {
    return { syncedBuildings };
  }

  for (const districtId of ownedDistrictIds) {
    const district = districtStateApi.getDistrictById(districtId);
    const buildingProfile = district ? resolveDistrictBuildingProfile(district) : null;
    const buildings = Array.isArray(buildingProfile?.buildings) ? buildingProfile.buildings : [];

    for (const building of buildings) {
      const buildingName = getDistrictBuildingNameForProductionSync(building);
      const mechanicsType = resolveDistrictBuildingDetailMechanicsType(buildingName);

      if (!buildingName || !PASSIVE_DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES.has(mechanicsType)) {
        continue;
      }

      try {
        const hasStoredEntry = hasStoredDistrictBuildingDetailEntry(district, buildingName);
        const mechanics = resolveDistrictBuildingDetailMechanics(district, buildingName);
        const didSync = hasStoredEntry
          ? persistDistrictBuildingDetailProductionSnapshot(district, buildingName, mechanics, now)
          : initializeDistrictBuildingDetailProductionBaseline(district, buildingName, mechanics, now);
        if (didSync) {
          syncedBuildings += 1;
        }
      } catch (error) {
        warnRuntimeOrchestrator(`Passive building production sync failed: ${buildingName}`, error);
      }
    }
  }

  return { syncedBuildings };
}

function syncRuntimePassiveProductionState(options = {}) {
  if (!shouldRunLocalGameplayRuntime()) {
    stopLegacyGameplayTimers();
    return { skipped: true, reason: "server-authoritative" };
  }

  const now = Math.max(0, Math.floor(Number(options.now ?? Date.now())));
  const minIntervalMs = Math.max(0, Number(options.minIntervalMs ?? RUNTIME_PASSIVE_PRODUCTION_SYNC_INTERVAL_MS) || 0);
  const force = Boolean(options.force);

  if (!force && lastRuntimePassiveProductionSyncAt > 0 && now - lastRuntimePassiveProductionSyncAt < minIntervalMs) {
    return { skipped: true };
  }

  lastRuntimePassiveProductionSyncAt = now;
  syncCompletedProductionJobs();
  const factory = null;
  const districtBuildings = options.includeDistrictBuildings === false
    ? { syncedBuildings: 0 }
    : syncOwnedDistrictBuildingDetailProduction({ now });

  if (options.scheduleProductionJobs !== false) {
    scheduleStoredProductionJobs(options.root || getDefaultRuntimeRoot());
  }

  return {
    skipped: false,
    factory,
    districtBuildings
  };
}

function syncDistrictBuildingDetailTabs(shell, activeTab) {
  syncBuildingDetailPanelTabs(shell, activeTab === "info" ? "info" : "stats");
}

function refreshDistrictBuildingDetailPopup(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  openGenericDistrictBuildingDetail(root, context.district, context.buildingName, context.displayName);
}

function refreshOpenDistrictBuildingDetailPopups(root) {
  root?.querySelectorAll?.("[data-district-building-detail-popup]")?.forEach((shell) => {
    if (shell instanceof HTMLElement && !shell.hidden) {
      refreshDistrictBuildingDetailPopup(root, shell);
    }
  });
}

function stopDistrictBuildingDetailLiveRefresh(shell) {
  if (!shell) {
    return;
  }

  const timer = districtBuildingDetailLiveRefreshTimers.get(shell);
  if (!timer) {
    return;
  }

  timer.windowRef?.clearInterval?.(timer.timerId);
  districtBuildingDetailLiveRefreshTimers.delete(shell);
}

function syncDistrictBuildingDetailLiveRefresh(root, shell, mechanics = {}) {
  const now = Date.now();
  const hasActiveActionCooldown = Object.values(mechanics.actionCooldowns || {})
    .some((value) => Number(value || 0) > now);
  const shouldRefresh = Boolean(mechanics.hasManualCollect || hasActiveActionCooldown);
  if (!shell || !shouldRefresh) {
    stopDistrictBuildingDetailLiveRefresh(shell);
    return;
  }

  if (districtBuildingDetailLiveRefreshTimers.has(shell)) {
    return;
  }

  const windowRef = root?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  if (!windowRef?.setInterval || !windowRef?.clearInterval) {
    return;
  }

  const timerId = windowRef.setInterval(() => {
    if (!shell.isConnected || shell.hidden) {
      stopDistrictBuildingDetailLiveRefresh(shell);
      return;
    }

    refreshDistrictBuildingDetailPopup(root, shell);
  }, DISTRICT_BUILDING_DETAIL_LIVE_REFRESH_MS);
  districtBuildingDetailLiveRefreshTimers.set(shell, { timerId, windowRef });
}

function dispatchDistrictBuildingProductionCollected(root, context = {}, detail = {}) {
  const ownerDocument = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  ownerDocument?.dispatchEvent?.(new CustomEvent("empire:production-collected", {
    detail: {
      type: "production:collected",
      source: "district-building-detail",
      buildingName: context.buildingName || "",
      districtId: context.district?.id ?? null,
      ...detail
    }
  }));
}

function collectDistrictBuildingDetailOutput(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (!mechanics.canCollect) {
    setBuildingActionFeedback(root, "warning", context.buildingName, "Budova zatím nemá ručně vybratelný výstup.", "Clean, dirty, vliv a heat se připisují automaticky.");
    return;
  }

  const summary = [];

  if (mechanics.mechanicsType === "apartment-block") {
    const collectedPopulation = Math.max(0, Math.floor(Number(mechanics.apartmentStoredPopulation || 0)));
    if (collectedPopulation < APARTMENT_BLOCK_MIN_COLLECT_POPULATION) {
      setBuildingActionFeedback(root, "warning", context.buildingName, `Bytový blok potřebuje alespoň ${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} lidí k výběru.`, `${collectedPopulation}/${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} připraveno`);
      return;
    }
    const gangState = getResolvedGangState();
    const remainingPopulation = 0;
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedPopulation) });
    renderGangMembersState(root);
    summary.push(`${collectedPopulation} členů gangu`);
    resetOwnedApartmentBlockPopulationEntries(context.district, mechanics.apartmentCapacity);
    setBuildingActionFeedback(
      root,
      "success",
      context.buildingName,
      `Vybral jsi ${collectedPopulation} nových členů gangu z Bytového bloku.`,
      `${Math.floor(remainingPopulation)}/${mechanics.apartmentCapacity} zůstává lokálně`
    );
    appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: summary.map((value, index) => ({ label: `Položka ${index + 1}`, value })), meta: "Vybrat obyvatele", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
    dispatchDistrictBuildingProductionCollected(root, context, {
      mechanicsType: mechanics.mechanicsType,
      amount: collectedPopulation,
      itemLabel: "členové gangu"
    });
    refreshDistrictBuildingDetailPopup(root, shell);
    return;
  }

  if (mechanics.mechanicsType === "school") {
    const collectedPopulation = Math.max(0, Math.floor(Number(mechanics.schoolStoredStudents || 0)));
    if (collectedPopulation <= 0) {
      setBuildingActionFeedback(root, "warning", context.buildingName, "Škola zatím nemá připravené členy k výběru.", mechanics.storedOutputLabel);
      return;
    }
    const gangState = getResolvedGangState();
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedPopulation) });
    renderGangMembersState(root);
    summary.push(`${collectedPopulation} členů`);
    resetOwnedSchoolPopulationEntries(context.district, mechanics.schoolCapacity);
    setBuildingActionFeedback(
      root,
      "success",
      context.buildingName,
      `Vybral jsi ${collectedPopulation} členů ze Školy.`,
      `0/${mechanics.schoolCapacity} zůstává lokálně`
    );
    appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: summary.map((value, index) => ({ label: `Položka ${index + 1}`, value })), meta: "Vybrat členy", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
    dispatchDistrictBuildingProductionCollected(root, context, {
      mechanicsType: mechanics.mechanicsType,
      amount: collectedPopulation,
      itemLabel: "členové"
    });
    refreshDistrictBuildingDetailPopup(root, shell);
    return;
  }

  if (mechanics.mechanicsType === "smuggling-tunnel") {
    const collectedDirty = Math.max(0, Math.floor(Number(mechanics.smugglingWholeDirtyCash || 0)));
    if (collectedDirty < SMUGGLING_TUNNEL_CONFIG.minCollectDirty) {
      setBuildingActionFeedback(root, "warning", context.buildingName, `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`, mechanics.storedOutputLabel);
      return;
    }
    const heatGain = getSmugglingTunnelCollectHeat(collectedDirty);
    const economy = getResolvedEconomyState();
    setStoredEconomyState({
      cleanMoney: Math.max(0, Math.floor(Number(economy.cleanMoney || 0))),
      dirtyMoney: Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)) + collectedDirty)
    });
    applyTopbarEconomy(root);
    addGangHeat(root, heatGain, "Vybraná pašovací dávka");
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      storedDirtyCash: 0,
      smugglingLastUpdatedAt: Date.now(),
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: 0,
      lastCollectedAt: Date.now()
    }));
    setBuildingActionFeedback(
      root,
      "success",
      context.buildingName,
      `Vybral jsi ${formatDistrictBuildingMoney(collectedDirty)} dirty cash z Pašovacího tunelu. Heat +${heatGain}.`,
      "Dávka se začíná znovu plnit."
    );
    appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: [{ label: "Dirty cash", value: formatDistrictBuildingMoney(collectedDirty) }, { label: "Heat", value: `+${heatGain}` }], meta: "Vybrat dávku", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
    dispatchDistrictBuildingProductionCollected(root, context, {
      mechanicsType: mechanics.mechanicsType,
      amount: collectedDirty,
      itemLabel: "dirty cash",
      heatGain
    });
    refreshDistrictBuildingDetailPopup(root, shell);
    return;
  }

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    lastCollectedAt: Date.now()
  }));

  appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: summary.map((value, index) => ({ label: `Položka ${index + 1}`, value })), meta: "Výstup budovy", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
  dispatchDistrictBuildingProductionCollected(root, context, {
    mechanicsType: mechanics.mechanicsType
  });
  refreshDistrictBuildingDetailPopup(root, shell);
}

async function upgradeDistrictBuildingDetail(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (mechanics.mechanicsType === "garage") {
    setBuildingActionFeedback(root, "warning", context.buildingName, "Garáž je pasivní budova bez upgradu.", "L1");
    return;
  }
  if (!mechanics.nextLevel) {
    setBuildingActionFeedback(root, "warning", context.buildingName, "Budova je na maximálním levelu.", `L${mechanics.level}`);
    return;
  }

  if (isServerAuthoritativeGameplayRuntimeReady()) {
    const response = await submitServerBuildingUpgradeCommand({ context, mechanics });
    if (!response?.accepted) {
      const message = response?.errors?.map((error) => error?.message || error?.code).filter(Boolean).join(" · ")
        || "Server upgrade odmítl.";
      setBuildingActionFeedback(root, "warning", `${context.buildingName}: upgrade nejde`, message, `L${mechanics.level} → L${mechanics.nextLevel}`);
      return;
    }

    setBuildingActionFeedback(
      root,
      "success",
      `${context.buildingName}: upgrade`,
      `Server potvrdil upgrade na level ${mechanics.nextLevel}.`,
      `Cena ${mechanics.upgradeCostLabel}`
    );
    refreshDistrictBuildingDetailPopup(root, shell);
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
      `Cena upgradu ${mechanics.upgradeCostLabel}`
    );
    return;
  }

  if (mechanics.mechanicsType === "casino") {
    const upgrade = getCasinoDetailUpgrade(mechanics.nextLevel);
    const supplies = getStoredFactorySupplies();
    const techCore = Math.max(0, Math.floor(Number(supplies.techCore || 0)));
    const combatModule = Math.max(0, Math.floor(Number(supplies.combatModule || 0)));
    const missing = [
      techCore < upgrade.techCore ? `${upgrade.techCore - techCore} Tech Core` : "",
      combatModule < upgrade.combatModule ? `${upgrade.combatModule - combatModule} bojový modul` : ""
    ].filter(Boolean);
    if (missing.length > 0) {
      setBuildingActionFeedback(
        root,
        "warning",
        `${context.buildingName}: upgrade nejde`,
        `Chybí ${missing.join(" + ")}.`,
        `Cena upgradu ${mechanics.upgradeCostLabel}`
      );
      return;
    }
    setStoredFactorySupplies({
      ...supplies,
      techCore: techCore - upgrade.techCore,
      combatModule: combatModule - upgrade.combatModule
    });
  }

  setStoredEconomyState({
    cleanMoney: cleanMoney - mechanics.upgradeCost,
    dirtyMoney: Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)))
  });
  applyTopbarEconomy(root);
  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    level: mechanics.nextLevel
  }));

  setBuildingActionFeedback(
    root,
    "success",
    `${context.buildingName}: upgrade`,
    `Budova je teď na levelu ${mechanics.nextLevel}.`,
    `Cena ${mechanics.upgradeCostLabel}`
  );
  refreshDistrictBuildingDetailPopup(root, shell);
}

function getDistrictBuildingDetailUpgradeConfirmation(root, shell) {
  const existing = districtBuildingDetailUpgradeConfirmations.get(shell);
  if (existing) {
    return existing;
  }

  const documentRef = shell?.ownerDocument || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const controller = createBuildingUpgradeConfirmationController({
    documentRef,
    host: shell,
    variant: "district"
  });
  districtBuildingDetailUpgradeConfirmations.set(shell, controller);
  return controller;
}

function getDistrictBuildingUpgradeResourceStatus(mechanics) {
  const economy = getResolvedEconomyState();
  const cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  const missing = [];

  if (cleanMoney < mechanics.upgradeCost) {
    missing.push(`${formatDistrictBuildingMoney(mechanics.upgradeCost - cleanMoney)} clean cash`);
  }

  if (mechanics.mechanicsType === "casino" && mechanics.nextLevel) {
    const upgrade = getCasinoDetailUpgrade(mechanics.nextLevel);
    const supplies = getStoredFactorySupplies();
    const techCore = Math.max(0, Math.floor(Number(supplies.techCore || 0)));
    const combatModule = Math.max(0, Math.floor(Number(supplies.combatModule || 0)));
    if (techCore < upgrade.techCore) {
      missing.push(`${upgrade.techCore - techCore} Tech Core`);
    }
    if (combatModule < upgrade.combatModule) {
      missing.push(`${upgrade.combatModule - combatModule} bojový modul`);
    }
  }

  return {
    canConfirm: missing.length <= 0,
    missing
  };
}

async function confirmDistrictBuildingDetailUpgrade(root, shell) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (mechanics.mechanicsType === "garage" || !mechanics.nextLevel) {
    await upgradeDistrictBuildingDetail(root, shell);
    return;
  }

  const displayLabel = String(context.displayName || context.buildingName || "Budova").trim() || "Budova";
  const resourceStatus = getDistrictBuildingUpgradeResourceStatus(mechanics);
  const nextMechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName, {
    entryOverride: {
      level: mechanics.nextLevel
    }
  });
  let warehouseUpgradePreview = null;
  if (mechanics.mechanicsType === "warehouse" && isServerAuthoritativeGameplayRuntimeReady()) {
    const target = await resolveServerBuildingUpgradeTarget(context, mechanics);
    warehouseUpgradePreview = target.ok ? target.building?.warehouseUpgradePreview || null : null;
  }
  const confirmationViewModel = createBuildingUpgradeConfirmationViewModel({
    buildingName: context.buildingName,
    displayName: displayLabel,
    currentMechanics: mechanics,
    nextMechanics,
    resourceStatus,
    warehouseUpgradePreview
  });
  const confirmation = getDistrictBuildingDetailUpgradeConfirmation(root, shell);
  const confirmed = await confirmation.open({
    ...confirmationViewModel,
    canConfirm: resourceStatus.canConfirm,
    confirmLabel: resourceStatus.canConfirm ? "Potvrdit upgrade" : "Chybí zdroje"
  });

  if (confirmed) {
    await upgradeDistrictBuildingDetail(root, shell);
  }
}

function applyDistrictBuildingSpecialAction(root, context, action, actionProfile, mechanics) {
  if (!hasLegacyBuildingSpecialActionHandler(actionProfile)) {
    setBuildingActionFeedback(root, "warning", action, "Akce zatím nemá bezpečný handler. Odměna nebyla připsána.", context.buildingName);
    console.warn("[Empire Streets] Unknown building special action handler", {
      buildingName: context?.buildingName,
      action,
      actionProfile
    });
    return null;
  }

  const economy = getResolvedEconomyState();
  const gangState = getResolvedGangState();
  let cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  let dirtyMoney = Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)));
  let economyChanged = false;
  let influenceChanged = false;
  let membersChanged = false;
  const summaryParts = [];

  for (const [itemId, amount] of Object.entries(actionProfile.materialCost || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount <= 0) continue;
    const currentAmount = Math.max(0, Math.floor(Number(getInventoryAmount("materials", itemId) || 0)));
    if (currentAmount < safeAmount) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${getProductionResourceLabel(itemId)} x${safeAmount - currentAmount}.`, context.buildingName);
      return null;
    }
  }

  for (const [itemId, amount] of Object.entries(actionProfile.materialCost || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount <= 0) continue;
    setInventoryAmount("materials", itemId, Math.max(0, Math.floor(Number(getInventoryAmount("materials", itemId) || 0)) - safeAmount));
    summaryParts.push(`Cena ${getProductionResourceLabel(itemId)} x${safeAmount}`);
  }

  if (actionProfile.apartmentCollectPopulation) {
    const collectedPopulation = Math.max(0, Math.floor(Number(mechanics.apartmentStoredPopulation || 0)));
    if (collectedPopulation < APARTMENT_BLOCK_MIN_COLLECT_POPULATION) {
      setBuildingActionFeedback(root, "warning", action, `Bytový blok potřebuje alespoň ${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} lidí k výběru.`, `${collectedPopulation}/${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} připraveno`);
      return null;
    }
    const remainingPopulation = 0;
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedPopulation) });
    renderGangMembersState(root);
    resetOwnedApartmentBlockPopulationEntries(context.district, mechanics.apartmentCapacity);
    membersChanged = true;
    summaryParts.push(`Vybral jsi ${collectedPopulation} nových členů gangu z Bytového bloku.`);
    summaryParts.push(`${Math.floor(remainingPopulation)}/${mechanics.apartmentCapacity} lokálně`);
  }

  if (actionProfile.smugglingCollectBatch) {
    const collectedDirty = Math.max(0, Math.floor(Number(mechanics.smugglingWholeDirtyCash || 0)));
    if (collectedDirty < SMUGGLING_TUNNEL_CONFIG.minCollectDirty) {
      setBuildingActionFeedback(root, "warning", action, `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`, context.buildingName);
      return null;
    }
    const heatGain = getSmugglingTunnelCollectHeat(collectedDirty);
    dirtyMoney += collectedDirty;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    addGangHeat(root, heatGain, "Vybraná pašovací dávka");
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      storedDirtyCash: 0,
      smugglingLastUpdatedAt: Date.now(),
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: 0,
      lastCollectedAt: Date.now()
    }));
    economyChanged = true;
    summaryParts.push(`Vybral jsi ${formatDistrictBuildingMoney(collectedDirty)} dirty cash z Pašovacího tunelu. Heat +${heatGain}.`);
  }

  if (actionProfile.smugglingSilentChannel) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.dirtyCost || 0)));
    const activeUntil = Number(mechanics.actionCooldowns?.silentChannelActiveUntil || 0);
    if (activeUntil > Date.now()) {
      setBuildingActionFeedback(root, "warning", action, `Tichý kanál už běží. Zbývá ${formatDistrictBuildingCooldown(activeUntil - Date.now())}.`, context.buildingName);
      return null;
    }
    if (dirtyMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - dirtyMoney)} dirty cash.`, context.buildingName);
      return null;
    }
    dirtyMoney -= cost;
    const expiresAt = Date.now() + SMUGGLING_TUNNEL_CONFIG.silentChannelDurationMs;
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      silentChannelExpiresAt: expiresAt,
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        silentChannel: Date.now() + SMUGGLING_TUNNEL_CONFIG.silentChannelCooldownMs,
        silentChannelActiveUntil: expiresAt
      }
    }));
    economyChanged = true;
    summaryParts.push(`Tichý kanál aktivní na ${formatDistrictBuildingCooldown(SMUGGLING_TUNNEL_CONFIG.silentChannelDurationMs)}.`);
    summaryParts.push(`Riziko zátahu po skončení ${SMUGGLING_TUNNEL_CONFIG.silentChannelRaidChancePct} %.`);
  }

  if (actionProfile.smugglingOpenChannel) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.cleanCost || SMUGGLING_TUNNEL_CONFIG.openChannelCleanCost || 0)));
    const activeRemainingMs = Math.max(0, Number(mechanics.smugglingOpenChannelRemainingMs || 0));
    if (activeRemainingMs > 0) {
      setBuildingActionFeedback(root, "warning", action, `Otevřený kanál už běží. Zbývá ${formatDistrictBuildingCooldown(activeRemainingMs)}.`, context.buildingName);
      return null;
    }
    if (cleanMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - cleanMoney)} clean cash.`, context.buildingName);
      return null;
    }
    cleanMoney -= cost;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    addGangHeat(root, SMUGGLING_TUNNEL_CONFIG.openChannelHeatGain, "Otevřený pašovací kanál");
    const expiresAt = Date.now() + SMUGGLING_TUNNEL_CONFIG.openChannelDurationMs;
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      openChannelExpiresAt: expiresAt,
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        openChannel: Date.now() + SMUGGLING_TUNNEL_CONFIG.openChannelCooldownMs
      }
    }));
    economyChanged = true;
    summaryParts.push(`Otevřený kanál aktivní na ${formatDistrictBuildingCooldown(SMUGGLING_TUNNEL_CONFIG.openChannelDurationMs)}.`);
    summaryParts.push(`Pouliční dealeři: cena +${SMUGGLING_TUNNEL_CONFIG.openChannelDealerSalePriceBonusPct}%, rychlost +${SMUGGLING_TUNNEL_CONFIG.openChannelDealerSaleSpeedBonusPct}%, riziko incidentu +${SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct}%.`);
  }

  if (actionProfile.schoolEveningCourse) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.cleanCost || 0)));
    const activeUntil = Number(mechanics.actionCooldowns?.schoolEveningCourseActiveUntil || 0);
    if (activeUntil > Date.now() || mechanics.schoolEveningCourseActive) {
      const remaining = Math.max(0, Math.max(activeUntil, Date.now() + mechanics.schoolEveningCourseRemainingMs) - Date.now());
      setBuildingActionFeedback(root, "warning", action, `Večerní kurz už běží. Zbývá ${formatDistrictBuildingCooldown(remaining)}.`, context.buildingName);
      return null;
    }
    if (cleanMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - cleanMoney)} clean cash.`, context.buildingName);
      return null;
    }
    cleanMoney -= cost;
    const now = Date.now();
    const durationMs = getSchoolApartmentBoostDurationMs(mechanics.level, actionProfile);
    const apartmentPopulationBoostPct = Math.max(0, Number(actionProfile.apartmentPopulationBoostPct || 0));
    const expiresAt = now + durationMs;
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      schoolEveningCourseExpiresAt: expiresAt,
      schoolLastUpdatedAt: now,
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        schoolEveningCourse: now + SCHOOL_CONFIG.eveningCourseCooldownMs,
        schoolEveningCourseActiveUntil: expiresAt
      }
    }));
    setActiveSchoolApartmentBoost({
      startedAt: now,
      expiresAt,
      durationMs,
      apartmentPopulationBoostPct,
      sourceDistrictId: context.district?.id ?? null,
      sourceBuildingName: context.buildingName
    });
    economyChanged = true;
    summaryParts.push(`Večerní kurz aktivní na ${formatDistrictBuildingCooldown(durationMs)}.`);
    summaryParts.push(`Bytové bloky vyrábí lidi o ${apartmentPopulationBoostPct}% rychleji.`);
  }

  if (actionProfile.clinicStabilizationProtocol) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.cleanCost || 0)));
    if (cleanMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - cleanMoney)} clean cash.`, context.buildingName);
      return null;
    }
    const clinicRecoverableFresh = mechanics.clinicRecoveryPool
      ? mechanics.clinicRecoveryPool.fresh.filter((entry) => CLINIC_RECOVERABLE_ITEMS.includes(normalizeClinicRecoverableItem(entry.itemType)))
      : [];
    const clinicRecyclingFresh = mechanics.clinicRecoveryPool
      ? mechanics.clinicRecoveryPool.fresh.filter((entry) => !CLINIC_RECOVERABLE_ITEMS.includes(normalizeClinicRecoverableItem(entry.itemType)))
      : [];
    if (!mechanics.clinicRecoveryPool || clinicRecoverableFresh.length <= 0) {
      setBuildingActionFeedback(root, "warning", action, "Žádné ztráty k léčbě.", context.buildingName);
      return null;
    }

    cleanMoney -= cost;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);

    const rate = Math.max(0, Number(mechanics.clinicRecoveryRatePct || 0)) / 100;
    const warehouseCapacity = getWarehouseCapacityBreakdown();
    const warehouseUsage = getWarehouseStorageUsage(warehouseCapacity);
    const acceptedByType = {};
    const lostByCapacity = {};
    const expiredCount = mechanics.clinicRecoveryPool.expired.reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry.amount || 0))), 0);
    let recoveredPopulation = 0;
    const rawRecoveryByItem = {};

    for (const entry of clinicRecoverableFresh) {
      const itemId = normalizeClinicRecoverableItem(entry.itemType);
      const entryRate = entry.source === "trap" || entry.source === "toxic_trap"
        ? rate * 0.5
        : rate;
      const rawAmount = Math.max(0, Number(entry.amount || 0)) * entryRate;
      rawRecoveryByItem[itemId] = Math.max(0, Number(rawRecoveryByItem[itemId] || 0)) + rawAmount;
    }

    const groupUsage = { ...warehouseUsage };
    for (const [itemId, rawAmount] of Object.entries(rawRecoveryByItem)) {
      let recoverAmount = Math.floor(rawAmount);
      if (CLINIC_RARE_ITEMS.includes(itemId) && Math.random() < rawAmount - recoverAmount) {
        recoverAmount += 1;
      }
      if (recoverAmount <= 0) continue;

      if (itemId === "population") {
        recoveredPopulation += recoverAmount;
        acceptedByType[itemId] = Math.max(0, Math.floor(Number(acceptedByType[itemId] || 0)) + recoverAmount);
        continue;
      }

      const cap = getClinicWarehouseCapacityForItem(itemId, warehouseCapacity);
      const currentUsage = Math.max(0, Math.floor(Number(groupUsage.byResource?.[itemId] || 0)));
      const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(recoverAmount, cap - currentUsage)) : recoverAmount;
      const overflow = Math.max(0, recoverAmount - accepted);
      if (accepted > 0) {
        groupUsage.byResource[itemId] = currentUsage + accepted;
        acceptedByType[itemId] = Math.max(0, Math.floor(Number(acceptedByType[itemId] || 0)) + accepted);
      }
      if (overflow > 0) {
        lostByCapacity[itemId] = Math.max(0, Math.floor(Number(lostByCapacity[itemId] || 0)) + overflow);
      }
    }

    if (recoveredPopulation > 0) {
      setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + recoveredPopulation) });
      renderGangMembersState(root);
      membersChanged = true;
    }

    const supplies = getStoredFactorySupplies();
    const nextSupplies = { ...supplies };
    for (const [itemId, amount] of Object.entries(acceptedByType)) {
      const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
      if (safeAmount <= 0 || itemId === "gang-members" || itemId === "population") continue;
      if (itemId === "metal-parts") {
        nextSupplies.metalParts = Math.max(0, Math.floor(Number(nextSupplies.metalParts || 0)) + safeAmount);
      } else if (itemId === "tech-core") {
        nextSupplies.techCore = Math.max(0, Math.floor(Number(nextSupplies.techCore || 0)) + safeAmount);
      } else if (itemId === "combat-module") {
        nextSupplies.combatModule = Math.max(0, Math.floor(Number(nextSupplies.combatModule || 0)) + safeAmount);
      } else if (["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"].includes(itemId)) {
        applyInventoryOutput({ inventory: "drugs", itemId, amount: safeAmount });
      } else if (["baseball-bat", "pistol", "grenade", "smg", "bazooka", "vest", "barricades", "cameras", "defense-tower", "alarm"].includes(itemId)) {
        applyInventoryOutput({ inventory: "weapons", itemId, amount: safeAmount });
      } else {
        applyInventoryOutput({ inventory: "materials", itemId, amount: safeAmount });
      }
    }
    setStoredFactorySupplies(nextSupplies);
    setStoredClinicRecoveryPool(clinicRecyclingFresh);

    actionProfile = {
      ...actionProfile,
      heat: Math.max(0, Math.floor(Number(actionProfile.heat || 0)))
    };
    if (recoveredPopulation > 0) summaryParts.push(`Zachráněno členů ${recoveredPopulation}`);
    const returnedItems = Object.entries(acceptedByType)
      .filter(([itemId]) => itemId !== "gang-members" && itemId !== "population")
      .map(([itemId, amount]) => `${getProductionResourceLabel(itemId)} x${amount}`);
    if (returnedItems.length > 0) summaryParts.push(`Vráceno ${returnedItems.join(", ")}`);
    const capacityLoss = Object.values(lostByCapacity).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), 0);
    if (capacityLoss > 0) summaryParts.push(`Propadlo kvůli skladu ${capacityLoss}`);
    const keptForRecycling = clinicRecyclingFresh.reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry.amount || 0))), 0);
    if (keptForRecycling > 0) summaryParts.push(`Pro recyklaci ${keptForRecycling}`);
    if (expiredCount > 0) summaryParts.push(`Expirovalo ${expiredCount}`);
    summaryParts.push(`Cena ${formatDistrictBuildingMoney(cost)}`);
  }

  if (actionProfile.recyclingExtractLosses) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.cleanCost || 0)));
    if (cleanMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - cleanMoney)} clean cash.`, context.buildingName);
      return null;
    }

    const poolView = mechanics.recyclingSalvagePool || getClinicRecoveryPoolView(Date.now());
    const salvageFresh = getRecyclingSalvagePoolView(poolView).fresh;
    if (salvageFresh.length <= 0) {
      setBuildingActionFeedback(root, "warning", action, "Nemáš žádné ztráty k vytěžení.", context.buildingName);
      return null;
    }

    const retainedForClinic = (poolView.fresh || [])
      .filter((entry) => !salvageFresh.some((salvageEntry) => salvageEntry.id === entry.id));
    const acceptedByType = {};
    const lostByCapacity = {};
    const salvageRate = 0.12;
    const warehouseCapacity = getWarehouseCapacityBreakdown();
    const warehouseUsage = getWarehouseStorageUsage(warehouseCapacity);
    const groupUsage = { ...warehouseUsage };

    for (const entry of salvageFresh) {
      const itemId = normalizeClinicRecoverableItem(entry.itemType);
      const rawAmount = Math.max(0, Number(entry.amount || 0)) * salvageRate;
      let recoverAmount = Math.floor(rawAmount);
      if (recoverAmount <= 0 && rawAmount > 0 && Math.random() < rawAmount) {
        recoverAmount = 1;
      }
      if (recoverAmount <= 0) continue;

      const cap = getClinicWarehouseCapacityForItem(itemId, warehouseCapacity);
      const currentUsage = Math.max(0, Math.floor(Number(groupUsage.byResource?.[itemId] || 0)));
      const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(recoverAmount, cap - currentUsage)) : recoverAmount;
      const overflow = Math.max(0, recoverAmount - accepted);
      if (accepted > 0) {
        groupUsage.byResource[itemId] = currentUsage + accepted;
        acceptedByType[itemId] = Math.max(0, Math.floor(Number(acceptedByType[itemId] || 0)) + accepted);
      }
      if (overflow > 0) {
        lostByCapacity[itemId] = Math.max(0, Math.floor(Number(lostByCapacity[itemId] || 0)) + overflow);
      }
    }

    if (Object.keys(acceptedByType).length <= 0) {
      setBuildingActionFeedback(root, "warning", action, "Ztráty jsou zatím příliš malé na vytěžení použitelných itemů.", context.buildingName);
      return null;
    }

    cleanMoney -= cost;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    const supplies = getStoredFactorySupplies();
    const nextSupplies = { ...supplies };
    for (const [itemId, amount] of Object.entries(acceptedByType)) {
      const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
      if (safeAmount <= 0) continue;
      if (itemId === "metal-parts") {
        nextSupplies.metalParts = Math.max(0, Math.floor(Number(nextSupplies.metalParts || 0)) + safeAmount);
      } else if (itemId === "tech-core") {
        nextSupplies.techCore = Math.max(0, Math.floor(Number(nextSupplies.techCore || 0)) + safeAmount);
      } else if (itemId === "combat-module") {
        nextSupplies.combatModule = Math.max(0, Math.floor(Number(nextSupplies.combatModule || 0)) + safeAmount);
      } else if (["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"].includes(itemId)) {
        applyInventoryOutput({ inventory: "drugs", itemId, amount: safeAmount });
      } else if (["baseball-bat", "pistol", "grenade", "smg", "bazooka", "vest", "barricades", "cameras", "defense-tower", "alarm"].includes(itemId)) {
        applyInventoryOutput({ inventory: "weapons", itemId, amount: safeAmount });
      } else {
        applyInventoryOutput({ inventory: "materials", itemId, amount: safeAmount });
      }
    }
    setStoredFactorySupplies(nextSupplies);
    setStoredClinicRecoveryPool(retainedForClinic);
    economyChanged = true;
    summaryParts.push(`Vytěženo ${Object.entries(acceptedByType).map(([itemId, amount]) => `${getProductionResourceLabel(itemId)} x${amount}`).join(", ")}`);
    const capacityLoss = Object.values(lostByCapacity).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), 0);
    if (capacityLoss > 0) summaryParts.push(`Propadlo kvůli skladu ${capacityLoss}`);
    summaryParts.push(`Cena ${formatDistrictBuildingMoney(cost)}`);
  }

  if (actionProfile.casinoQuietBackroom) {
    if (dirtyMoney < Math.max(0, Number(actionProfile.minimumDirty || 0))) {
      setBuildingActionFeedback(root, "warning", action, `Potřebuješ alespoň ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`, context.buildingName);
      return null;
    }
    const laundered = Math.min(
      Math.floor(dirtyMoney * Math.max(0, Number(actionProfile.dirtySharePct || 0)) / 100),
      Math.max(0, Math.floor(Number(mechanics.casinoLaunderingCapacity || actionProfile.maxDirty || 0)))
    );
    const feePct = Number.isFinite(Number(mechanics.casinoLaunderingFeePct))
      ? Number(mechanics.casinoLaunderingFeePct)
      : Number(actionProfile.feePct || 0);
    const heatGain = Math.floor(Number(actionProfile.heat || 0) * (1 - Math.max(0, Number(mechanics.casinoActionHeatReductionPct || 0)) / 100));
    const fee = Math.floor(laundered * Math.max(0, feePct) / 100);
    const cleanGain = Math.max(0, laundered - fee);
    dirtyMoney = Math.max(0, dirtyMoney - laundered);
    cleanMoney += cleanGain;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    summaryParts.push(`Vypráno ${formatDistrictBuildingMoney(laundered)} dirty`);
    summaryParts.push(`Clean +${formatDistrictBuildingMoney(cleanGain)}`);
    summaryParts.push(`Poplatek ${formatDistrictBuildingMoney(fee)}`);
    actionProfile = {
      ...actionProfile,
      heat: heatGain,
      feePct
    };
  }

  if (actionProfile.casinoBribedInspector) {
    const cost = Math.max(0, Math.floor(Number(actionProfile.cleanCost || 0)));
    if (cleanMoney < cost) {
      setBuildingActionFeedback(root, "warning", action, `Chybí ${formatDistrictBuildingMoney(cost - cleanMoney)} clean cash.`, context.buildingName);
      return null;
    }
    cleanMoney -= cost;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    const failed = Math.random() < Math.max(0, Number(actionProfile.failureChancePct || 0)) / 100;
    if (failed) {
      actionProfile = {
        ...actionProfile,
        heat: Math.max(0, Number(actionProfile.heatFailure || 0)),
        influence: 0,
        durationMs: 8 * 60 * 1000,
        auditRiskBoostPct: actionProfile.auditRiskFailurePct
      };
      summaryParts.push("Inspektor selhal");
      summaryParts.push(`Cena propadla ${formatDistrictBuildingMoney(cost)}`);
      summaryParts.push(`Heat +${Math.floor(Number(actionProfile.heat || 0))}`);
      summaryParts.push(`Audit risk +${actionProfile.auditRiskBoostPct}%`);
    } else {
      actionProfile = {
        ...actionProfile,
        heat: Math.floor(Number(actionProfile.heatSuccess || 0)),
        influence: Math.floor(Number(actionProfile.influenceSuccess || 0))
      };
      summaryParts.push("Inspektor uspěl");
      summaryParts.push(`Cena ${formatDistrictBuildingMoney(cost)}`);
      summaryParts.push(`Heat ${actionProfile.heat}`);
      summaryParts.push(`Audit risk relativně -${actionProfile.auditRiskReductionPct}%`);
    }
  }

  if (actionProfile.exchangeOfficeGoodRate) {
    if (dirtyMoney < Math.max(0, Number(actionProfile.minimumDirty || 0))) {
      setBuildingActionFeedback(root, "warning", action, `Potřebuješ alespoň ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`, context.buildingName);
      return null;
    }
    const capacity = Math.max(0, Math.floor(Number(mechanics.exchangeLaunderingCapacity || actionProfile.maxDirty || 0)));
    const laundered = Math.min(
      Math.floor(dirtyMoney * Math.max(0, Number(actionProfile.dirtySharePct || 0)) / 100),
      capacity
    );
    const fee = Math.floor(laundered * Math.max(0, Number(actionProfile.feePct || 0)) / 100);
    const cleanGain = Math.max(0, laundered - fee);
    dirtyMoney = Math.max(0, dirtyMoney - laundered);
    cleanMoney += cleanGain;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    summaryParts.push(`Vypráno ${formatDistrictBuildingMoney(laundered)} dirty`);
    summaryParts.push(`Clean +${formatDistrictBuildingMoney(cleanGain)}`);
    summaryParts.push(`Poplatek ${formatDistrictBuildingMoney(fee)}`);
    summaryParts.push(`Síť ${formatNetworkBonusPercent(mechanics.exchangeNetwork?.incomeMultiplier || 1) || "+0 %"}`);
  }

  if (actionProfile.arcadeBackCashdesk) {
    if (dirtyMoney < Math.max(0, Number(actionProfile.minimumDirty || 0))) {
      setBuildingActionFeedback(root, "warning", action, `Potřebuješ alespoň ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`, context.buildingName);
      return null;
    }
    const capacity = Math.max(0, Math.floor(Number(mechanics.arcadeLaunderingCapacity || actionProfile.maxDirty || 0)));
    const laundered = Math.min(Math.floor(dirtyMoney * Math.max(0, Number(actionProfile.dirtySharePct || 0)) / 100), capacity);
    const fee = Math.floor(laundered * Math.max(0, Number(actionProfile.feePct || 0)) / 100);
    const cleanGain = Math.max(0, laundered - fee);
    dirtyMoney = Math.max(0, dirtyMoney - laundered);
    cleanMoney += cleanGain;
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
    summaryParts.push(`Vypráno ${formatDistrictBuildingMoney(laundered)} dirty`);
    summaryParts.push(`Clean +${formatDistrictBuildingMoney(cleanGain)}`);
    summaryParts.push(`Poplatek ${formatDistrictBuildingMoney(fee)}`);
    summaryParts.push(`Síť ${formatNetworkBonusPercent(mechanics.arcadeNetwork?.incomeMultiplier || 1) || "+0 %"}`);
  }

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
    summaryParts.push(`Dirty cash +${formatDistrictBuildingMoney(actionProfile.dirty)}`);
  }

  if (economyChanged) {
    setStoredEconomyState({ cleanMoney, dirtyMoney });
    applyTopbarEconomy(root);
  }

  if (actionProfile.members) {
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + Math.floor(Number(actionProfile.members || 0))) });
    renderGangMembersState(root);
    membersChanged = true;
    summaryParts.push(`Členové +${Math.floor(Number(actionProfile.members || 0))}`);
  }

  if (actionProfile.influence) {
    const influenceGain = Math.max(0, Number(actionProfile.influence || 0));
    setGangInfluenceValue(Number(gangState.influence || 0) + influenceGain);
    renderSpyResourceState(root, { animate: true });
    influenceChanged = true;
    summaryParts.push(`Vliv +${Number.isInteger(influenceGain) ? String(influenceGain) : influenceGain.toFixed(1).replace(/\.0$/u, "")}`);
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
  const effectDurationMs = Math.max(durationMs, Number(actionProfile.auditRiskDurationMs || 0));
  const activeEffect = effectDurationMs > 0
    ? {
        label: action,
        expiresAt: Date.now() + effectDurationMs,
        incomeBoostPct: Math.max(0, Number(actionProfile.incomeBoostPct || 0)),
        cleanIncomeBoostPct: Math.max(0, Number(actionProfile.cleanIncomeBoostPct || 0)),
        dirtyIncomeBoostPct: Math.max(0, Number(actionProfile.dirtyIncomeBoostPct || 0)),
        influenceBoostPct: Math.max(0, Number(actionProfile.influenceBoostPct || 0)),
        auditRiskBoostPct: Math.max(0, Number(actionProfile.auditRiskBoostPct || 0)),
        auditRiskReductionPct: Math.max(0, Number(actionProfile.auditRiskReductionPct || 0)),
        influencePerDay: Math.max(0, Number(actionProfile.influencePerDay || 0)),
        heatMultiplier: Math.max(0, Number(actionProfile.heatMultiplier || 1)),
        heatPerDay: Math.max(0, Number(actionProfile.heatPerDay || 0)),
        instantHeat: Math.floor(Number(actionProfile.heat || 0)),
        instantInfluence: Number(actionProfile.influence || 0)
      }
    : null;

  if (activeEffect) {
    summaryParts.push(`Efekt ${formatDistrictBuildingCooldown(effectDurationMs)}`);
  }

  return {
    activeEffect,
    summary: summaryParts.join(" · ") || actionProfile.summary || "Akce proběhla."
  };
}

function getDistrictBuildingSpecialActionConfirmation(root, shell) {
  const existing = districtBuildingDetailActionConfirmations.get(shell);
  if (existing) {
    return existing;
  }

  const documentRef = shell?.ownerDocument || root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const controller = createBuildingSpecialActionConfirmationController({
    documentRef,
    host: shell
  });
  districtBuildingDetailActionConfirmations.set(shell, controller);
  return controller;
}

function resolveDistrictBuildingActionRequest(context, request = {}) {
  const actionIndex = Number.isFinite(Number(request?.actionIndex))
    ? Number(request.actionIndex)
    : Number.isFinite(Number(request))
      ? Number(request)
      : -1;
  const profile = getDistrictBuildingDetailProfile(context.buildingName);
  const action = profile.actions[actionIndex];
  const actionProfile = getDistrictBuildingSpecialActionProfile(context.buildingName, actionIndex);
  const definition = resolveBuildingSpecialActionDefinition({
    buildingName: context.buildingName,
    actionLabel: action,
    actionIndex,
    actionProfile
  });
  return {
    actionIndex,
    action,
    actionProfile,
    definition,
    profile
  };
}

async function confirmAndRunDistrictBuildingDetailAction(root, shell, request) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return false;
  }

  const resolved = resolveDistrictBuildingActionRequest(context, request);
  if (!resolved.action) {
    return false;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  const cooldownView = resolveDistrictBuildingActionEffectiveCooldownView(context, resolved, mechanics);
  const rewardSummary = formatBuildingActionOutputProfile(resolved.actionProfile || {}, {
    mechanics,
    formatMoney: formatDistrictBuildingMoney,
    formatCooldown: formatDistrictBuildingCooldown
  }) || resolved.definition.rewardSummary;
  const riskSummary = formatBuildingActionRiskProfile(resolved.actionProfile || {}, {
    mechanics,
    formatMoney: formatDistrictBuildingMoney,
    formatCooldown: formatDistrictBuildingCooldown
  }) || resolved.definition.riskSummary;
  const cooldownUntil = getBuildingSpecialActionCooldownUntil(mechanics.actionCooldowns, resolved.definition.actionId, resolved.actionIndex);
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  let disabledReason = resolved.definition.disabledReason
    || resolveRuntimeBuildingActionPhaseDisabledReason(resolved.definition)
    || (cooldownRemaining > 0 ? `Akce čeká ${formatDistrictBuildingCooldown(cooldownRemaining)}.` : "");
  if (!disabledReason && resolved.definition.handlerId === "server-run-building-action") {
    if (isServerAuthoritativeGameplayRuntimeReady()) {
      const target = await resolveServerBuildingActionTarget(context, resolved.definition);
      if (!target.ok) {
        disabledReason = target.message;
      } else {
        const serverDisabledReason = formatServerBuildingActionDisabledReason(target.actionView);
        if (!target.actionView.enabled || serverDisabledReason) {
          disabledReason = serverDisabledReason || "Server akci teď nepovoluje.";
        }
      }
    }
  }
  const controller = getDistrictBuildingSpecialActionConfirmation(root, shell);
  const confirmed = await controller.open({
    titleLabel: resolved.definition.confirmTitle,
    buildingLabel: context.displayName || context.buildingName,
    districtLabel: context.district?.id ? `District ${context.district.id}` : "",
    description: resolved.definition.confirmBody,
    costSummary: resolved.definition.costSummary,
    rewardSummary,
    inputSummary: resolved.definition.inputSummary,
    riskSummary,
    cooldownLabel: cooldownView.label,
    disabledReason,
    canConfirm: !disabledReason
  });
  if (!confirmed) {
    return false;
  }

  return runDistrictBuildingActionFromContext(root, context, {
    ...request,
    actionIndex: resolved.actionIndex,
    actionId: resolved.definition.actionId
  }, { shell });
}

function runDistrictBuildingDetailAction(root, shell, request) {
  const context = districtBuildingDetailContextByShell.get(shell);
  if (!context) {
    return;
  }

  confirmAndRunDistrictBuildingDetailAction(root, shell, request);
}

function resolveDistrictBuildingActionBaseCooldownMs(actionProfile = {}) {
  return actionProfile && Object.prototype.hasOwnProperty.call(actionProfile, "cooldownMs")
    ? Math.max(0, Number(actionProfile.cooldownMs || 0))
    : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS;
}

function resolveDistrictBuildingActionEffectiveCooldownView(context = {}, resolved = {}, mechanics = {}) {
  const baseCooldownMs = resolveDistrictBuildingActionBaseCooldownMs(resolved.actionProfile || {});
  const garageCategory = resolveGarageCategoryForBuildingAction(
    context.buildingName,
    resolved.action,
    resolved.definition
  );
  const autoSalonCategory = resolveAutoSalonCategoryForBuildingAction(
    context.buildingName,
    resolved.action,
    resolved.definition
  );
  const cooldownReductionView = resolveCombinedEffectiveCooldownMs({
    baseCooldownMs,
    garageSupport: mechanics.garageSupport,
    garageCategory,
    autoSalonSupport: mechanics.autoSalonSupport,
    autoSalonCategory
  });
  const effectiveCooldownMs = cooldownReductionView.effectiveCooldownMs;
  return {
    baseCooldownMs,
    effectiveCooldownMs,
    garageCategory,
    autoSalonCategory,
    garageCooldownReductionPct: cooldownReductionView.garageReductionPct,
    autoSalonCooldownReductionPct: cooldownReductionView.autoSalonReductionPct,
    combinedCooldownReductionPct: cooldownReductionView.combinedReductionPct,
    label: formatGarageEffectiveCooldownLabel({
      baseCooldownMs,
      effectiveCooldownMs,
      formatCooldown: formatDistrictBuildingCooldown
    })
  };
}

async function runDistrictBuildingActionFromContext(root, context, request, options = {}) {
  const resolved = resolveDistrictBuildingActionRequest(context, request);
  const { actionIndex, action, actionProfile, definition } = resolved;
  if (!action) {
    return false;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  if (request?.actionId && request.actionId !== definition.actionId) {
    setBuildingActionFeedback(root, "warning", action, "Neplatná identita akce. Akce nebyla spuštěna.", context.buildingName);
    console.warn("[Empire Streets] Building actionId mismatch", {
      expected: definition.actionId,
      received: request.actionId,
      buildingName: context.buildingName,
      actionIndex
    });
    return false;
  }

  if (definition.status !== "implemented") {
    setBuildingActionFeedback(root, "warning", action, definition.disabledReason || "Akce zatím není připravená.", context.buildingName);
    console.warn("[Empire Streets] Blocked unimplemented building action", {
      actionId: definition.actionId,
      buildingName: context.buildingName
    });
    return false;
  }

  const phaseDisabledReason = resolveRuntimeBuildingActionPhaseDisabledReason(definition);
  if (phaseDisabledReason) {
    setBuildingActionFeedback(root, "warning", action, phaseDisabledReason, context.buildingName);
    return false;
  }

  const cooldownUntil = getBuildingSpecialActionCooldownUntil(mechanics.actionCooldowns, definition.actionId, actionIndex);
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  if (cooldownRemaining > 0) {
    setBuildingActionFeedback(root, "warning", action, `Akce čeká ${formatDistrictBuildingCooldown(cooldownRemaining)}.`, context.buildingName);
    return false;
  }

  const cooldownView = resolveDistrictBuildingActionEffectiveCooldownView(context, resolved, mechanics);
  const actionCooldownMs = cooldownView.effectiveCooldownMs;

  if (definition.handlerId === "server-run-building-action") {
    if (isServerAuthoritativeGameplayRuntimeReady()) {
      const response = await submitServerBuildingActionCommand({
        context,
        actionProfile: actionProfile || {},
        definition
      });
      if (!response?.accepted) {
        const message = response?.errors?.map((error) => error?.message || error?.code).filter(Boolean).join(" · ")
          || "Server akci odmítl.";
        setBuildingActionFeedback(root, "warning", action, message, context.buildingName);
        return false;
      }

      const reportSummary = response?.readModel?.reports?.[0]?.summary
        || response?.readModel?.reports?.[0]?.description
        || response?.readModel?.reports?.[0]?.title
        || actionProfile?.summary
        || definition.rewardSummary
        || "Server akci přijal.";
      const actionCooldownUntil = Date.now() + actionCooldownMs;
      updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
        ...entry,
        actionCooldowns: {
          ...(entry.actionCooldowns || {}),
          [definition.actionId]: actionCooldownUntil
        }
      }));
      applyServerBuildingActionLocalPreviewEffects(context, definition, actionProfile || {}, actionCooldownUntil);
      setBuildingActionFeedback(
        root,
        "success",
        action,
        reportSummary,
        context.district?.id ? `${context.buildingName} · District ${context.district.id}` : context.buildingName
      );
      appendBuildingActionResultEntry(root, "police", {
        title: `${context.buildingName}: ${action}`,
        summary: reportSummary,
        badge: context.district?.id ? `District ${context.district.id}` : "Server",
        tone: "success",
        items: [
          { label: "Budova", value: context.displayName || context.buildingName },
          { label: "Akce", value: action },
          { label: "Handler", value: "Server" },
          { label: "Cooldown", value: cooldownView.label, nowrap: true, countdownUntil: actionCooldownMs > 0 ? actionCooldownUntil : 0 }
        ],
        meta: context.district?.id ? `District ${context.district.id}` : "",
        actionId: definition.actionId,
        buildingTypeId: definition.buildingTypeId
      }, {
        tone: "success",
        title: `${context.buildingName}: ${action}`,
        summary: reportSummary,
        meta: context.district?.id ? `District ${context.district.id}` : "Server"
      }, { syncPreview: true, forceLog: true, refresh: false });
      if (options.shell) {
        refreshDistrictBuildingDetailPopup(root, options.shell);
      }
      return true;
    }
  }

  if (!shouldRunLocalGameplayRuntime()) {
    setBuildingActionFeedback(root, "warning", action, "Lokální fallback je dostupný jen v development režimu.", context.buildingName);
    return false;
  }

  if (!hasLegacyBuildingSpecialActionHandler(actionProfile || {})) {
    const fallbackSummary = definition.rewardSummary && definition.rewardSummary !== "Efekt podle akce"
      ? definition.rewardSummary
      : "Akce je v této fázi hry potvrzená lokálně. Finální serverový efekt se napojí v posledním kroku.";
    const actionCooldownUntil = Date.now() + actionCooldownMs;
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        [definition.actionId]: actionCooldownUntil
      }
    }));
    setBuildingActionFeedback(
      root,
      "success",
      action,
      fallbackSummary,
      context.district?.id ? `${context.buildingName} · District ${context.district.id}` : context.buildingName
    );
    appendBuildingActionResultEntry(root, "police", {
      title: `${context.buildingName}: ${action}`,
      summary: fallbackSummary,
      badge: context.district?.id ? `District ${context.district.id}` : "Lokální fáze",
      tone: "success",
      items: [
        { label: "Budova", value: context.displayName || context.buildingName },
        { label: "Akce", value: action },
        { label: "Režim", value: "Lokální preview" },
        { label: "Cooldown", value: cooldownView.label, nowrap: true, countdownUntil: actionCooldownMs > 0 ? actionCooldownUntil : 0 }
      ],
      meta: context.district?.id ? `District ${context.district.id}` : "",
      actionId: definition.actionId,
      buildingTypeId: definition.buildingTypeId
    }, {
      tone: "success",
      title: `${context.buildingName}: ${action}`,
      summary: fallbackSummary,
      meta: context.district?.id ? `District ${context.district.id}` : "Lokální fáze"
    }, { syncPreview: true, forceLog: true, refresh: false });
    if (options.shell) {
      refreshDistrictBuildingDetailPopup(root, options.shell);
    }
    console.info("[Empire Streets] Ran building action in local setup fallback", {
      actionId: definition.actionId,
      buildingName: context.buildingName
    });
    return true;
  }

  if (actionProfile?.casinoVipNight) {
    const activeVip = getDistrictBuildingDetailEntry(context.district, context.buildingName)
      .activeEffects?.find((effect) => effect.label === action && Number(effect.expiresAt || 0) > Date.now());
    if (activeVip) {
      setBuildingActionFeedback(root, "warning", action, `VIP noc už běží. Zbývá ${formatDistrictBuildingCooldown(Number(activeVip.expiresAt || 0) - Date.now())}.`, context.buildingName);
      return false;
    }
  }
  if (actionProfile?.arcadeNightMachines) {
    const activeArcadeBoost = getDistrictBuildingDetailEntry(context.district, context.buildingName)
      .activeEffects?.find((effect) => effect.label === action && Number(effect.expiresAt || 0) > Date.now());
    if (activeArcadeBoost) {
      setBuildingActionFeedback(root, "warning", action, `Noční automaty už běží. Zbývá ${formatDistrictBuildingCooldown(Number(activeArcadeBoost.expiresAt || 0) - Date.now())}.`, context.buildingName);
      return false;
    }
  }
  const actionResult = applyDistrictBuildingSpecialAction(
    root,
    context,
    action,
    actionProfile || {},
    mechanics
  );

  if (!actionResult) {
    return false;
  }

  const actionCooldownUntil = Date.now() + actionCooldownMs;
  const activeEffectExpiresAt = Number(actionResult.activeEffect?.expiresAt || 0);
  const actionResultItems = [
    { label: "Budova", value: context.displayName || context.buildingName },
    { label: "Akce", value: action },
    ...(activeEffectExpiresAt > Date.now()
      ? [{ label: "Efekt", value: formatDistrictBuildingCooldown(activeEffectExpiresAt - Date.now()), nowrap: true, countdownUntil: activeEffectExpiresAt }]
      : []),
    { label: "Cooldown", value: cooldownView.label, nowrap: true, countdownUntil: actionCooldownMs > 0 ? actionCooldownUntil : 0 }
  ];

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    activeEffects: actionResult.activeEffect
      ? [...(entry.activeEffects || []), actionResult.activeEffect]
      : (entry.activeEffects || []),
    actionCooldowns: {
      ...(entry.actionCooldowns || {}),
      [definition.actionId]: actionCooldownUntil
    }
  }));

  setBuildingActionFeedback(
    root,
    "success",
    action,
    actionResult.summary,
    context.district?.id ? `${context.buildingName} · District ${context.district.id}` : context.buildingName
  );
  appendBuildingActionResultEntry(root, "police", {
    title: `${context.buildingName}: ${action}`,
    summary: actionResult.summary,
    badge: context.district?.id ? `District ${context.district.id}` : "Budova",
    tone: "success",
    items: actionResultItems,
    meta: context.district?.id ? `District ${context.district.id}` : "",
    actionId: definition.actionId,
    buildingTypeId: definition.buildingTypeId
  }, {
    tone: "success",
    title: `${context.buildingName}: ${action}`,
    summary: actionResult.summary,
    meta: context.district?.id ? `District ${context.district.id}` : "Budova"
  }, { syncPreview: true, forceLog: true, refresh: false });
  if (options.shell) {
    refreshDistrictBuildingDetailPopup(root, options.shell);
  }
  return true;
}

function getDistrictBuildingDetailPopupKey(district, buildingName) {
  const districtId = district?.id == null ? "unknown" : String(district.id);
  const buildingKey = normalizeBuildingLookupKey(buildingName) || "building";
  return `${districtId}:${buildingKey}`;
}

function syncBuildingDetailTopbarVisibility(root) {
  const scope = root?.ownerDocument || document;
  const body = scope.body;
  if (!body) {
    return;
  }

  const hasOpenBuildingDetail = Boolean(scope.querySelector([
    "[data-district-building-detail-popup]:not([hidden])",
    "[data-armory-popup]:not([hidden])",
    "[data-pharmacy-popup]:not([hidden])",
    "[data-druglab-popup]:not([hidden])",
    "[data-factory-popup]:not([hidden])"
  ].join(",")));
  body.classList.toggle("building-detail-resources-hidden", hasOpenBuildingDetail);
}

function closeOtherDistrictBuildingDetailPopups(root, activeShell) {
  root.querySelectorAll("[data-district-building-detail-popup]").forEach((candidate) => {
    if (candidate instanceof HTMLElement && candidate !== activeShell) {
      candidate.hidden = true;
      stopDistrictBuildingDetailLiveRefresh(candidate);
    }
  });
}

function ensureDistrictBuildingDetailPopup(root, popupKey = "") {
  return ensureBuildingDetailPanel(root, {
    onClose: (shell) => {
      stopDistrictBuildingDetailLiveRefresh(shell);
      syncBuildingDetailTopbarVisibility(root);
    },
    onCollect: (shell) => collectDistrictBuildingDetailOutput(root, shell),
    onUpgrade: (shell) => confirmDistrictBuildingDetailUpgrade(root, shell),
    onRunAction: (shell, actionIndex) => runDistrictBuildingDetailAction(root, shell, actionIndex)
  }, { popupKey });
}

function openGenericDistrictBuildingDetail(root, district, buildingName, displayName = buildingName) {
  const popupKey = getDistrictBuildingDetailPopupKey(district, buildingName);
  const shell = ensureDistrictBuildingDetailPopup(root, popupKey);
  const profile = getDistrictBuildingDetailProfile(buildingName);
  const mechanics = resolveDistrictBuildingDetailMechanics(district, buildingName);
  const detailEntry = getDistrictBuildingDetailEntry(district, buildingName);
  const buildingProfile = resolveDistrictBuildingProfile(district);
  const displayLabel = String(displayName || buildingName || "Budova").trim() || "Budova";
  const displayLookupKey = normalizeBuildingLookupKey(displayLabel);
  const buildingLookupKey = normalizeBuildingLookupKey(buildingName);
  const variantBaseLookupKey = normalizeBuildingLookupKey(resolveDistrictBuildingVariantBaseName(displayLabel) || resolveDistrictBuildingVariantBaseName(buildingName));
  const activeBuilding = Array.isArray(buildingProfile?.buildings)
    ? buildingProfile.buildings.find((building) => building.displayName === displayLabel || building.baseName === buildingName)
      || buildingProfile.buildings.find((building) => {
        const candidateDisplayKey = normalizeBuildingLookupKey(building?.displayName);
        const candidateBaseKey = normalizeBuildingLookupKey(building?.baseName);
        return candidateDisplayKey === displayLookupKey
          || candidateBaseKey === buildingLookupKey
          || candidateBaseKey === variantBaseLookupKey;
      })
    : null;
  const buildingBackgroundPath = getDistrictBuildingDetailBackgroundPath(district, buildingName, displayLabel, activeBuilding);

  districtBuildingDetailContextByShell.set(shell, { district, buildingName, displayName: displayLabel });
  shell.dataset.districtBuildingDetailKey = popupKey;
  shell.dataset.districtBuildingDetailName = normalizeBuildingLookupKey(buildingName) || "building";
  shell.dataset.districtBuildingDetailDisplayName = displayLabel;
  shell.dataset.districtBuildingDetailDistrictId = district?.id == null ? "unknown" : String(district.id);
  shell.dataset.buildingDistrictType = buildingProfile?.typeKey || district?.districtType || "unknown";
  shell.dataset.buildingMechanicsType = mechanics.mechanicsType;
  closeOtherDistrictBuildingDetailPopups(root, shell);

  const info = shell.querySelector("[data-district-building-detail-info-section]")
    || shell.querySelector("[data-district-building-detail-info]");

  if (mechanics.mechanicsType === "apartment-block") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedPopulation: mechanics.apartmentStoredPopulation,
      populationLastUpdatedAt: Date.now(),
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: entry.populationFullNotifiedAt
    }));
  }

  if (mechanics.mechanicsType === "school") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedStudents: mechanics.schoolStoredStudents,
      schoolLastUpdatedAt: Date.now(),
      studentCapacity: mechanics.schoolCapacity,
      studentFullNotifiedAt: entry.studentFullNotifiedAt
    }));
  }

  if (mechanics.mechanicsType === "smuggling-tunnel") {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedDirtyCash: mechanics.smugglingStoredDirtyCash,
      smugglingLastUpdatedAt: Date.now(),
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: entry.smugglingFullNotifiedAt
    }));
  }

  if (
    mechanics.mechanicsType === "apartment-block"
    && mechanics.apartmentIsFull
    && Number(detailEntry.populationFullNotifiedAt || 0) <= 0
  ) {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedPopulation: mechanics.apartmentStoredPopulation,
      populationLastUpdatedAt: Date.now(),
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: Date.now()
    }));
    setBuildingActionFeedback(root, "warning", displayLabel, "Bytový blok je plný. Obyvatelé čekají na vybrání.", "Plná kapacita");
  }

  if (
    mechanics.mechanicsType === "school"
    && mechanics.schoolIsFull
    && Number(detailEntry.studentFullNotifiedAt || 0) <= 0
  ) {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedStudents: mechanics.schoolStoredStudents,
      schoolLastUpdatedAt: Date.now(),
      studentCapacity: mechanics.schoolCapacity,
      studentFullNotifiedAt: Date.now()
    }));
    setBuildingActionFeedback(root, "warning", displayLabel, "Škola má naplněnou lokální populační kapacitu.", "Plná kapacita");
  }

  if (
    mechanics.mechanicsType === "smuggling-tunnel"
    && mechanics.smugglingIsFull
    && Number(detailEntry.smugglingFullNotifiedAt || 0) <= 0
  ) {
    updateDistrictBuildingDetailEntry(district, buildingName, (entry) => ({
      ...entry,
      storedDirtyCash: mechanics.smugglingStoredDirtyCash,
      smugglingLastUpdatedAt: Date.now(),
      smugglingBatchCapacity: mechanics.smugglingBatchCapacity,
      smugglingFullNotifiedAt: Date.now()
    }));
    setBuildingActionFeedback(root, "warning", displayLabel, "Pašovací tunel je plný. Dirty cash čeká na vybrání.", "Dávka připravena");
  }

  if (info) {
    renderDistrictBuildingInfoSection(info, {
      profile,
      mechanics,
      buildingName,
      entry: detailEntry
    });
  }

  const now = Date.now();
  const viewModel = createBuildingDetailViewModel({
    district,
    buildingName,
    displayName: displayLabel,
    profile,
    mechanics,
    detailEntry,
    buildingProfile,
    buildingBackgroundPath,
    economyState: {
      ...getResolvedEconomyState(),
      materials: getResolvedMaterialInventory()
    },
    playerHeat: getResolvedGangState().heat,
    actionProfiles: (Array.isArray(profile.actions) ? profile.actions : []).map((_, actionIndex) => getDistrictBuildingSpecialActionProfile(buildingName, actionIndex)),
    phaseState: getResolvedPhaseState(),
    now
  });
  renderBuildingDetailPanel({ shell, ...viewModel });
  syncDistrictBuildingDetailLiveRefresh(root, shell, mechanics);
  syncBuildingDetailTopbarVisibility(root);
}

function isDistrictTypeKnownForCurrentPlayer(district, interactionState = {}) {
  const districtId = Number(district?.id || 0);
  if (!districtId) {
    return false;
  }

  if (interactionState.destroyedDistrictIds?.has?.(districtId)) {
    return true;
  }

  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  if (currentPlayerOwnedDistrictIds.has(districtId)) {
    return true;
  }

  const launchOwnerId = interactionState.launchOwnerByDistrictId?.get?.(districtId)
    || START_PHASE_OWNER_BY_DISTRICT_ID.get(districtId);
  if (launchOwnerId && Number(launchOwnerId) === Number(CURRENT_PLAYER_ID)) {
    return true;
  }

  const spyIntel = getResolvedSpyIntel();
  return Array.isArray(spyIntel?.revealedTypeDistrictIds)
    && spyIntel.revealedTypeDistrictIds.map(Number).includes(districtId);
}

function getDistrictAtmosphereMeta(district, interactionState = {}) {
  if (!district || !isDistrictTypeKnownForCurrentPlayer(district, interactionState)) {
    return DISTRICT_ATMOSPHERE_META.unknown;
  }

  const meta = DISTRICT_ATMOSPHERE_META[district.districtType] || DISTRICT_ATMOSPHERE_META.unknown;
  const imagePaths = Array.isArray(meta.imagePaths) ? meta.imagePaths : [];
  if (!imagePaths.length) {
    return meta;
  }

  let hash = 0;
  const seed = `${meta.typeKey || "unknown"}:${district.id || 0}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }

  return {
    ...meta,
    imagePath: imagePaths[hash % imagePaths.length]
  };
}

function applyDistrictAtmosphere({
  card,
  imageElement,
  labelElement,
  moodElement,
  atmosphereMeta
}) {
  const isAtmosphereLocked = atmosphereMeta.typeKey === "unknown";

  if (card) {
    card.dataset.districtType = atmosphereMeta.typeKey || "unknown";
    card.dataset.atmosphereState = isAtmosphereLocked ? "locked" : "revealed";
  }

  if (imageElement instanceof HTMLImageElement) {
    imageElement.src = atmosphereMeta.imagePath;
    imageElement.alt = `${atmosphereMeta.label} – atmosféra města`;
  }

  if (labelElement) {
    labelElement.hidden = isAtmosphereLocked;
    labelElement.textContent = isAtmosphereLocked ? "" : atmosphereMeta.label;
  }

  if (moodElement) {
    moodElement.hidden = isAtmosphereLocked;
    moodElement.textContent = isAtmosphereLocked ? "" : atmosphereMeta.mood;
  }
}

function renderSpyResourceState(root, { animate = false, instant = false } = {}) {
  const scope = root.ownerDocument || document;
  const spyPill = scope.querySelector(TOPBAR_SPY_PILL_SELECTOR);
  const spyState = getResolvedSpyState();
  const displaySnapshot = getDisplayedResourceSnapshot();
  const resourceMode = spyPill?.dataset.resourceMode === "spy" ? "spy" : "influence";

  updateTopbarResources({
    ...displaySnapshot,
    spyAvailable: spyState.available,
    maxSpies: MAX_SPIES,
    resourceMode
  }, {
    root,
    animate,
    instant,
    includeMoney: false,
    formatMoneyAmount: formatDistrictMoneyAmount,
    formatMetricNumber: formatDistrictMetricNumber
  });

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
  const spyOutcome = normalizeSpyOutcome(scenarioLabel);
  const isCapturedOnMajorFail = isSpyCapturedOutcome(spyOutcome);
  const heatGain = getSpyHeatGainForOutcome(spyOutcome);

  if (isCapturedOnMajorFail) {
    setStoredSpyState({
      available: clamp(MAX_SPIES - (remainingMissions.length + 1), 0, MAX_SPIES),
      missions: [
        ...remainingMissions,
        createCapturedSpyMission(mission, { cooldownMs: SPY_CAPTURE_COOLDOWN_MS })
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
  const nextSpyIntel = applySpyIntelOutcome(spyIntel, mission.targetDistrictId, spyOutcome);

  if (scenarioLabel === "Úspěch" || scenarioLabel === "Částečný úspěch") {
    setStoredSpyIntel(nextSpyIntel);
  }

  if (heatGain > 0) {
    addGangHeat(root, heatGain, `Kriticky odhalené špehování District ${mission.targetDistrictId}`);
  }

  recordDistrictIntelEvent({
    type: scenarioLabel === "Úspěch"
      ? "spy_success"
      : scenarioLabel === "Částečný úspěch"
        ? "spy_partial"
        : scenarioLabel === "Kritický neúspěch"
          ? "spy_critical_failed"
          : "spy_failed",
    districtId: mission.targetDistrictId,
    sourceDistrictId: mission.sourceDistrictId,
    intelLevel: "verified",
    scenarioLabel,
    heatGain
  });

  const isUnownedDistrict = isDistrictUnownedForSpyResult(mission.targetDistrictId, mission.ownerLabel);
  const spyResultPayload = getResultPayloadBuilders().createSpyResultPayload({
    mission,
    scenarioLabel,
    knownDefensePower,
    isUnownedDistrict,
    heatGain
  });
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

  if (isCapturedOnMajorFail && isCurrentPlayerOwnedDistrict(mission.targetDistrictId)) {
    queueOrOpenResultModal(root, "spy_alert", createSpyDetectionAlertPayload(mission.targetDistrictId));
  }
}

function scheduleSpyMission(root, mission) {
  if (!shouldRunLocalGameplayRuntime() || !mission?.id || spyMissionTimers.has(mission.id)) {
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
  return showExistingToast(root, SPY_TOAST_SELECTOR);
}

function showAttackToast(root) {
  return showExistingToast(root, ATTACK_TOAST_SELECTOR);
}

function showRobberyToast(root) {
  return showExistingToast(root, ROBBERY_TOAST_SELECTOR);
}

function getDistrictFillStyle(district, isNight, interactionState = {}) {
  const safeDistrict = district && typeof district === "object"
    ? district
    : { id: 0, districtType: MAP_DEFAULT_DISTRICT_TYPE };
  const districtId = safeDistrict.id ?? 0;
  const districtType = String(safeDistrict.districtType || MAP_DEFAULT_DISTRICT_TYPE);

  if (interactionState.destroyedDistrictIds?.has(districtId)) {
    return resolveMapDestroyedFillStyle(isNight);
  }

  const ownedDistrictIds = getEffectiveOwnedDistrictIds(interactionState);
  const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
  const gamePhase = interactionState.gamePhase || "launch";
  const isLaunchPhase = gamePhase === "launch";
  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;
  const launchOwnerId = (isLaunchPhase || gamePhase === "live")
    ? launchOwnerByDistrictId.get(districtId)
    : null;

  if (districtType === MAP_DOWNTOWN_DISTRICT_TYPE && !ownedDistrictIds.has(districtId) && !launchOwnerId) {
    return resolveMapZoneFillStyle(districtType, isNight);
  }

  if (currentPlayerOwnedDistrictIds.has(districtId)) {
    const playerColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
    return applyHexAlpha(playerColor, MAP_OWNER_FILL_ALPHA);
  }

  if (launchOwnerId) {
    const playerColor = getLaunchPlayerColor(launchOwnerId);
    return applyHexAlpha(playerColor, MAP_OWNER_FILL_ALPHA);
  }

  if (!ownedDistrictIds.has(districtId)) {
    return resolveMapLaunchUnownedFillStyle();
  }

  if (ownedDistrictIds.has(districtId)) {
    const playerColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);
    return applyHexAlpha(playerColor, MAP_OWNER_FILL_ALPHA);
  }

  if (isDistrictTypeHidden(safeDistrict, interactionState)) {
    return resolveMapHiddenFillStyle(isNight);
  }

  return resolveMapZoneFillStyle(districtType, isNight);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.src = source;
  });
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

const mapCanvasAnimationRenderers = createMapCanvasAnimationRenderers({
  getPolygonBounds,
  drawDistrictPolygonPath,
  drawDistrictPolygon,
  createSeededRandom,
  clamp,
  getLaunchPlayerColor,
  getCurrentPlayerGangColor,
  getCurrentPlayerFactionGlyph,
  hexToRgbParts,
  currentPlayerId: CURRENT_PLAYER_ID,
  reducedActivityFallbackColor: MAP_REDUCED_ACTIVITY_FALLBACK_COLOR,
  windowRef: typeof window === "undefined" ? null : window
});

const {
  drawAllianceDistrictBadge,
  drawAttackDistrictAnimation,
  drawBountyDistrictBadge,
  drawBountyDistrictHighlight,
  drawCurrentPlayerFactionBadge,
  drawOccupyDistrictAnimation,
  drawPoliceDistrictAnimation,
  drawReducedMapActivityMarker,
  drawRobberyDistrictAnimation,
  drawSpyDistrictAnimation,
  drawTrapDistrictAnimation,
  getAllianceMapBadge,
  getBountyDistrictMarkers,
  getPointOnPolygonPerimeter
} = mapCanvasAnimationRenderers;

const districtCanvasRenderer = createDistrictCanvasRenderer({
  districtGeometryTopInset: MAP_DISTRICT_GEOMETRY_TOP_INSET,
  createDistrictGeometry,
  normalizeMapVisibilityMode,
  getEffectiveOwnedDistrictIds,
  getCurrentPlayerOwnedDistrictIds,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  getAllianceMapBadge,
  getBountyDistrictMarkers,
  getLaunchPlayerColor,
  getDistrictFillStyle,
  drawDistrictPolygon,
  drawAllianceDistrictBadge,
  drawCurrentPlayerFactionBadge,
  drawBountyDistrictHighlight,
  drawBountyDistrictBadge,
  drawReducedMapActivityMarker,
  drawSpyDistrictAnimation,
  drawPoliceDistrictAnimation,
  drawAttackDistrictAnimation,
  drawOccupyDistrictAnimation,
  drawRobberyDistrictAnimation,
  drawTrapDistrictAnimation,
  currentPlayerId: CURRENT_PLAYER_ID,
  reducedActivityColors: MAP_REDUCED_ACTIVITY_COLORS
});

const {
  drawMapImage,
  renderDistrictEffectsCanvas,
  renderDistrictCanvas
} = districtCanvasRenderer;
function bindDistrictCanvas(root) {
  const mapShell = initMapShell({
    root,
    selectors: {
      canvas: DISTRICT_CANVAS_SELECTOR,
      phaseHost: MAP_PHASE_SELECTOR,
      viewport: MAP_VIEWPORT_SELECTOR,
      canvasHost: MAP_CANVAS_SELECTOR,
      tooltip: DISTRICT_TOOLTIP_SELECTOR,
      tooltipValue: DISTRICT_TOOLTIP_VALUE_SELECTOR,
      tooltipType: DISTRICT_TOOLTIP_TYPE_SELECTOR,
      tooltipGossip: DISTRICT_TOOLTIP_GOSSIP_SELECTOR
    },
    classes: {
      effectsCanvas: MAP_EFFECTS_CANVAS_CLASS,
      interactionOverlay: MAP_INTERACTION_OVERLAY_CLASS,
      hoverCanvas: MAP_HOVER_CANVAS_CLASS
    }
  });
  const districtPopupElements = getDistrictPopupElements(root);
  const {
    canvas,
    phaseHost,
    viewport,
    canvasHost,
    mapStage,
    mapMount,
    tooltip,
    tooltipValue,
    tooltipType,
    tooltipGossip,
    overlayControls,
    statusPanel,
    interactionOverlay,
    effectsCanvas,
    hoverCanvas
  } = mapShell;
  const {
    popup, popupCard, popupTitle, popupType, popupOwner, popupOwnerMeta,
    popupOwnerAvatar, popupOwnerAvatarFallback, popupDefense, popupDefensePower,
    popupResidents, popupIncome, popupHeat, popupInfluence, popupFlags, popupToggle,
    popupAtmosphereHero, popupAtmosphereImage, popupAtmosphereLabel, popupAtmosphereMood,
    popupAtmosphereWindow, popupAtmosphereWindowImage, popupAtmosphereWindowLabel,
    popupAtmosphereWindowMood, popupAtmosphereWindowClose, popupBuildings, popupBuildingsMeta,
    popupBuildingsList, popupGossip, popupGossipList, districtActionSectionHead,
    districtActionSection, districtActionsMount, popupCloseElements, buildingsPopupOpenButton,
    buildingsPopup, buildingsPopupTypeMount, buildingsPopupDetailMount, buildingsPopupCloseElements,
    attackSetupPopup, attackSetupCloseElements, attackSourceSelect, attackWeaponInputs,
    attackConfirmButton, attackConfirmPopup, attackConfirmCloseElements, attackConfirmFinalButton,
    robberySetupPopup, robberySetupCloseElements, robberySourceSelect, robberyMemberInput,
    robberyConfirmButton, robberyConfirmPopup, robberyConfirmCloseElements, robberyConfirmFinalButton,
    defenseSetupPopup, defenseSetupCloseElements, defenseWeaponInputs,
    defenseResidentsInput, defenseConfirmButton, trapConfirmPopup,
    trapConfirmCloseElements, trapConfirmButton, spyConfirmPopup,
    spyConfirmCloseElements, spyConfirmButton, occupyConfirmPopup, occupyConfirmCloseElements,
    occupyConfirmButton, spyResultModal, spyResultModalBackdrop, spyResultModalClose,
    spyResultModalOk, spyWarningModal, spyWarningModalBackdrop, spyWarningModalClose,
    spyWarningModalOk, raidResultModal, raidResultModalBackdrop, raidResultModalClose,
    raidResultModalOk, attackResultModal, attackResultModalBackdrop, attackResultModalClose,
    attackResultModalOk, policeActionResultModal, policeActionResultModalBackdrop,
    policeActionResultModalClose, policeActionResultModalOk, buildingActionState,
    buildingActionSummary, buildingActionMeta, gangMembersValue
  } = districtPopupElements;

  if (!mapShell.canRender) {
    return;
  }
  let currentPerformanceMode = detectMobilePerformanceMode({ windowRef: window, documentRef: document });
  applyMobilePerformanceMode(currentPerformanceMode, { windowRef: window, documentRef: document });
  const getCurrentPerformanceMode = () => currentPerformanceMode || detectMobilePerformanceMode({ windowRef: window, documentRef: document });
  const getMapFrameIntervalMs = () => 1000 / Math.max(1, Number(getCurrentPerformanceMode().renderFpsCap || 60));
  const getMapEffectsFrameIntervalMs = () => {
    const mode = getCurrentPerformanceMode();
    const metrics = getPerformanceMetrics(window);
    const defaultFps = mode.active ? 20 : 60;
    const fpsCap = Math.min(defaultFps, Number(metrics.mapEffectsFpsCap || defaultFps));
    return 1000 / Math.max(1, fpsCap);
  };
  const shouldUseReducedMapEffects = (settings = getSettingsState()) => (
    Boolean(settings.reducedMapEffects) || Boolean(getCurrentPerformanceMode().reducedMotion)
  );
  const hoverCanvasContext = hoverCanvas?.getContext?.("2d") || null;
  const effectsCanvasContext = effectsCanvas?.getContext?.("2d") || null;
  const syncHoverCanvasSize = () => {
    if (!hoverCanvas) return;
    if (hoverCanvas.width !== canvas.width) hoverCanvas.width = canvas.width;
    if (hoverCanvas.height !== canvas.height) hoverCanvas.height = canvas.height;
  };
  const clearHoverCanvas = () => {
    if (!hoverCanvas || !hoverCanvasContext) return;
    syncHoverCanvasSize();
    hoverCanvasContext.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
  };
  const renderHoverCanvas = () => {
    clearHoverCanvas();
    if (!hoverCanvasContext || !geometry || !interactionState.hoveredDistrictId) return;
    const hoveredDistrict = geometry.districts.find((district) => district.id === interactionState.hoveredDistrictId);
    if (!hoveredDistrict) return;
    hoverCanvasContext.save();
    drawDistrictPolygon(hoverCanvasContext, hoveredDistrict.polygon);
    hoverCanvasContext.strokeStyle = MAP_HOVER_STROKE_STYLE;
    hoverCanvasContext.lineWidth = 2.4;
    hoverCanvasContext.lineJoin = "round";
    hoverCanvasContext.stroke();
    hoverCanvasContext.restore();
  };

  const initialSettings = getSettingsState();
  const initialWorldState = getResolvedWorldState();
  const initialMissionMarkers = buildMapMissionMarkersViewModel({
    policeActions: getResolvedDistrictPoliceActions(),
    occupyOrders: getStoredOccupyOrders(),
    worldState: initialWorldState,
    now: Date.now()
  });
  const interactionState = {
    hoveredDistrictId: null,
    selectedDistrictId: null,
    borderColor: phaseHost.dataset.borderColor || "white",
    showDistrictBorders: initialSettings.mapDistrictBorders,
    showAllianceSymbols: initialSettings.mapAllianceSymbols,
    reducedMapEffects: shouldUseReducedMapEffects(initialSettings),
    mapVisibilityMode: initialSettings.mapVisibilityMode,
    gamePhase: normalizeRuntimeGamePhase(phaseHost.dataset.gamePhase || initialWorldState.phaseState?.gamePhase || "launch"),
    revealedDistrictIds: new Set(),
    ownedDistrictIds: new Set(initialWorldState.ownedDistrictIds),
    destroyedDistrictIds: new Set(initialWorldState.destroyedDistrictIds),
    launchOwnerByDistrictId: new Map(START_PHASE_OWNER_BY_DISTRICT_ID),
    ...initialMissionMarkers,
    animationTick: 0,
    geometryCache: null
  };
  const syncEffectsCanvasSize = () => {
    if (!effectsCanvas) return;
    if (effectsCanvas.width !== canvas.width) effectsCanvas.width = canvas.width;
    if (effectsCanvas.height !== canvas.height) effectsCanvas.height = canvas.height;
  };
  const clearEffectsCanvas = () => {
    if (!effectsCanvas || !effectsCanvasContext) return;
    syncEffectsCanvasSize();
    effectsCanvasContext.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
  };
  const syncDistrictCanvasResolution = () => {
    const mode = getCurrentPerformanceMode();
    const metrics = getPerformanceMetrics(window);

    if (!mode.active) {
      metrics.mapCanvasPixelRatio = 1;
      metrics.mapCanvasWidth = canvas.width;
      metrics.mapCanvasHeight = canvas.height;
      return false;
    }

    const rect = canvasHost.getBoundingClientRect?.() || {};
    const cssWidth = Number(canvasHost.clientWidth || canvasHost.offsetWidth || rect.width || canvas.width || 0);
    const cssHeight = Number(canvasHost.clientHeight || canvasHost.offsetHeight || rect.height || Math.round(cssWidth * (980 / 1600)) || canvas.height || 0);

    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
      return false;
    }

    const ratio = getCappedDevicePixelRatio(window, mode);
    const targetWidth = clamp(Math.round(cssWidth * ratio), 320, 1200);
    const targetHeight = clamp(Math.round(cssHeight * ratio), 196, 735);
    metrics.mapCanvasPixelRatio = ratio;
    metrics.mapCanvasWidth = targetWidth;
    metrics.mapCanvasHeight = targetHeight;

    if (canvas.width === targetWidth && canvas.height === targetHeight) {
      return false;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    if (hoverCanvas) {
      hoverCanvas.width = targetWidth;
      hoverCanvas.height = targetHeight;
    }
    if (effectsCanvas) {
      effectsCanvas.width = targetWidth;
      effectsCanvas.height = targetHeight;
    }
    interactionState.geometryCache = null;
    return true;
  };
  let geometry = null;
  let imageSet = null;
  let spyAnimationFrameId = null;
  let popupRefreshTimerId = null;
  let isDistrictPopupOverviewEnabled = false;
  let lastTooltipDistrictId = null;
  let tooltipSize = { width: 84, height: 52 };
  let lastMissionAnimationAt = 0;
  let lastMissionMarkerSyncAt = 0;
  let dynamicEffectsReduced = false;
  let consecutiveFastEffectFrames = 0;
  const districtSelectionGesture = {
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClickUntil: 0
  };
  const syncInteractionDistrictAuthorityState = () => {
    const worldState = getResolvedWorldState();
    interactionState.ownedDistrictIds = new Set(worldState.ownedDistrictIds || []);
    interactionState.destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
    interactionState.launchOwnerByDistrictId = new Map(START_PHASE_OWNER_BY_DISTRICT_ID);

    for (const ownedDistrictId of interactionState.ownedDistrictIds) {
      interactionState.launchOwnerByDistrictId.delete(Number(ownedDistrictId));
    }

    for (const destroyedDistrictId of interactionState.destroyedDistrictIds) {
      interactionState.ownedDistrictIds.delete(Number(destroyedDistrictId));
      interactionState.launchOwnerByDistrictId.delete(Number(destroyedDistrictId));
    }
  };

  syncInteractionDistrictAuthorityState();

  const hideTooltip = () => {
    hideDistrictTooltip({ tooltip, gossip: tooltipGossip });
    lastTooltipDistrictId = null;
  };

  const hasActiveDistrictModal = () => hasActiveDistrictPopupModal(districtPopupElements);

  const syncMapInteractionVisualState = (options = {}) => {
    const focusedDistrict = options.focusedDistrict ?? (
      geometry?.districts?.find((district) => district.id === interactionState.selectedDistrictId) || null
    );
    const hasFocus = Boolean(focusedDistrict && hasActiveDistrictModal());
    syncMapShellVisualState({
      interactionOverlay,
      canvasHost,
      viewport,
      mapMount,
      mapStage,
      canvas,
      focusedDistrict,
      hasFocus,
      classes: {
        hasHover: MAP_HAS_HOVER_CLASS,
        focused: MAP_DISTRICT_FOCUSED_CLASS
      }
    });
  };

  const closePopup = () => {
    interactionState.selectedDistrictId = null;
    clearPendingAttackContext();

    if (popupRefreshTimerId !== null) {
      window.clearInterval(popupRefreshTimerId);
      popupRefreshTimerId = null;
    }

    hideDistrictPopupModalStack(districtPopupElements);
    window.EmpireGameplaySliceClient?.closeDistrictSheet?.("legacy district popup closed");

    syncMapInteractionVisualState({
      hoveredDistrict: geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null,
      focusedDistrict: null
    });
    render();
  };

  if (popup instanceof HTMLElement) {
    popup.addEventListener("click", (event) => {
      const target = event.target;
      const closeTrigger = target instanceof HTMLElement
        ? target.closest(DISTRICT_POPUP_CLOSE_SELECTOR)
        : null;
      if (!(closeTrigger instanceof HTMLElement) || closeTrigger.classList.contains("district-popup-backdrop")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closePopup();
    });
  }

  const closeAttackSetupPopup = () => {
    clearPendingAttackContext();
    closeAttackPanel({ popup: attackSetupPopup });
  };

  const closeAttackConfirmPopup = () => {
    clearPendingAttackContext();
    closeAttackPanel({ popup: attackConfirmPopup });
  };

  const {
    closeRobberySetupPopup,
    closeRobberyConfirmPopup,
    closeDefenseSetupPopup,
    closeTrapConfirmPopup,
    closeOccupyConfirmPopup
  } = createDistrictPopupModalClosers(districtPopupElements);

  const closeSpyConfirmPopup = () => {
    closeSpyPanel({ popup: spyConfirmPopup });
  };

  const getSelectedDistrict = () => (
    geometry?.districts?.find((district) => district.id === interactionState.selectedDistrictId) || null
  );

  const {
    getDistrictDefenseState,
    getCurrentPlayerTrapDistrictId,
    getCurrentPlayerTrapMoveCooldownSeconds,
    getDistrictTrapControlState,
    hasKnownDistrictDefense,
    renderDistrictDefenseSummary,
    renderDistrictEconomySummary,
    renderDistrictPopupGossip,
    renderDistrictPopupFlags
  } = createDistrictPopupMetricsRuntime({
    calculateTotalDefensePower,
    currentPlayerId: CURRENT_PLAYER_ID,
    formatDefenseLoadout,
    formatDistrictHeatLabel,
    formatDistrictIncomeLabel,
    formatDistrictInfluenceLabel,
    formatDistrictGossipTimestamp,
    getCurrentPlayerOwnedDistrictIds,
    getDistrictEconomySnapshot,
    ensureDistrictPassiveGossip,
    getDistrictGossipEntries,
    getInteractionState: () => interactionState,
    getResolvedSpyIntel,
    getResolvedWorldState,
    isDistrictGossipDevOnlyMode,
    isDistrictTypeHidden,
    renderDistrictFlags,
    renderDistrictMetricSummary,
    elements: {
      popupDefense,
      popupDefensePower,
      popupFlags,
      popupGossip,
      popupGossipList,
      popupHeat,
      popupIncome,
      popupInfluence,
      popupResidents
    }
  });
  const openDistrictBuildingDetail = (district, buildingName, options = {}) => {
    const safeDistrict = district && geometry?.districts?.length
      ? geometry.districts.find((entry) => Number(entry.id) === Number(district.id)) || district
      : district;
    const buildingLabel = String(buildingName || "Budova").trim() || "Budova";
    const popupTarget = resolveBuildingPopupTarget(buildingLabel);
    const shouldOpenGenericDetail = shouldOpenGenericDistrictBuildingDetail(buildingLabel, options);
    document.dispatchEvent(new CustomEvent("empire:building-opened", {
      detail: {
        districtId: safeDistrict?.id || null,
        buildingName: buildingLabel
      }
    }));

    if (safeDistrict?.id) {
      interactionState.selectedDistrictId = Number(safeDistrict.id);
      render();
      openPopup(safeDistrict);
    }

    if (options.closeBuildingsPopup) {
      closeBuildingsPopup();
    }

    if (!popupTarget || shouldOpenGenericDetail) {
      if (popup) {
        hideDistrictPopupModal(popup);
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

    closeOtherDistrictBuildingDetailPopups(root, null);
    openButton.click();
    if (popup) {
      hideDistrictPopupModal(popup);
    }
    return true;
  };

  const isClinicStabilizationProtocolReady = ({ district, baseName, displayName } = {}) => {
    try {
      const buildingName = baseName || displayName || "Klinika";
      const mechanics = resolveDistrictBuildingDetailMechanics(district, buildingName);
      if (mechanics?.mechanicsType !== "clinic") {
        return false;
      }
      const actionProfile = getDistrictBuildingSpecialActionProfile(buildingName, 0);
      if (!actionProfile?.clinicStabilizationProtocol) {
        return false;
      }
      const actionDefinition = resolveBuildingSpecialActionDefinition({
        buildingName,
        actionLabel: "Stabilizační protokol",
        actionIndex: 0,
        actionProfile
      });
      const cooldownUntil = getBuildingSpecialActionCooldownUntil(mechanics.actionCooldowns, actionDefinition.actionId, 0);
      if (Math.max(0, Number(cooldownUntil || 0) - Date.now()) > 0) {
        return false;
      }
      if (Number(getResolvedEconomyState().cleanMoney || 0) < Number(actionProfile.cleanCost || 0)) {
        return false;
      }
      return (mechanics.clinicRecoveryPool?.fresh || []).some((entry) => (
        CLINIC_RECOVERABLE_ITEMS.includes(normalizeClinicRecoverableItem(entry?.itemType || entry?.itemId))
        && Math.max(0, Math.floor(Number(entry?.amount || 0))) > 0
      ));
    } catch {
      return false;
    }
  };

  const {
    closeBuildingsPopup,
    getActiveBuildingsDistrictType,
    getFirstAvailableBuildingDistrictType,
    getSourceDistrictsForBuildingType,
    openBuildingsPopup,
    renderBuildingsPopup,
    renderBuildingsPopupDetail,
    renderDistrictPopupBuildings,
    selectBuildingsPopupBaseName
  } = createBuildingsPopupRuntime({
    districtBuildingTypeMeta: DISTRICT_BUILDING_TYPE_META,
    districtBuildingTypeOrder: DISTRICT_BUILDING_TYPE_ORDER,
    clearSelectedDistrict() {
      interactionState.selectedDistrictId = null;
      syncMapInteractionVisualState({
        hoveredDistrict: geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null,
        focusedDistrict: null
      });
      render();
    },
    formatDistrictBuildingTierLabel,
    getCurrentPlayerOwnedDistrictIds,
    getDistrictTrapControlState,
    getGeometry: () => geometry,
    getInteractionState: () => interactionState,
    getResolvedSpyIntel,
    isApartmentBlockFull({ district, baseName } = {}) {
      try {
        const mechanics = resolveDistrictBuildingDetailMechanics(district, baseName || "Bytový blok");
        return mechanics?.mechanicsType === "apartment-block"
          && Boolean(mechanics.apartmentIsFull);
      } catch {
        return false;
      }
    },
    isSchoolFull({ district, baseName } = {}) {
      try {
        const mechanics = resolveDistrictBuildingDetailMechanics(district, baseName || "Škola");
        return mechanics?.mechanicsType === "school"
          && Boolean(mechanics.schoolIsFull);
      } catch {
        return false;
      }
    },
    isClinicStabilizationReady: isClinicStabilizationProtocolReady,
    isDemoLiveBuildingCatalogUnlocked: () => normalizeRuntimeGamePhase(getResolvedPhaseState().gamePhase) === "live",
    isDistrictTypeHidden,
    renderBuildingsPopupDetailPanel,
    renderBuildingsPopupTypesPanel,
    renderDistrictBuildingList,
    resolveDistrictBuildingProfile,
    elements: {
      buildingsPopup,
      buildingsPopupDetailMount,
      buildingsPopupTypeMount,
      popupBuildings,
      popupBuildingsList,
      popupBuildingsMeta
    }
  });
  const shouldAutoOpenBuildingsPopupOnRefresh = () => {
    return false;
  };
  const scheduleBuildingsPopupOpenOnRefresh = (attempt = 0) => {
    if (!shouldAutoOpenBuildingsPopupOnRefresh()) {
      return false;
    }
    if (buildingsPopup && !buildingsPopup.hidden) {
      return true;
    }
    if (!geometry && attempt < 8 && typeof window.setTimeout === "function") {
      window.setTimeout(() => scheduleBuildingsPopupOpenOnRefresh(attempt + 1), 80);
      return false;
    }
    openBuildingsPopup();
    return true;
  };
  const applyDistrictPopupOverviewMode = () => {
    if (!popupCard) {
      return;
    }

    popupCard.dataset.overviewEnabled = isDistrictPopupOverviewEnabled ? "true" : "false";
    if (popup) {
      popup.dataset.overviewEnabled = isDistrictPopupOverviewEnabled ? "true" : "false";
    }

    if (popupToggle instanceof HTMLButtonElement) {
      popupToggle.textContent = "Přehled";
      popupToggle.setAttribute("aria-label", isDistrictPopupOverviewEnabled ? "Vypnout přehled districtu" : "Zapnout přehled districtu");
      popupToggle.setAttribute("aria-pressed", isDistrictPopupOverviewEnabled ? "true" : "false");
    }
  };
  const getDestroyedDistrictNotice = () => {
    const body = popupCard?.querySelector?.(".district-popup-body");
    if (!body) {
      return null;
    }

    let notice = body.querySelector("[data-district-popup-destroyed-only]");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "district-popup-destroyed-only";
      notice.dataset.districtPopupDestroyedOnly = "true";
      notice.setAttribute("role", "status");
      body.append(notice);
    }

    return notice;
  };
  const setDestroyedDistrictPopupMode = (enabled) => {
    if (!popupCard) {
      return;
    }

    popupCard.dataset.districtDestroyed = enabled ? "true" : "false";
    const notice = getDestroyedDistrictNotice();
    if (notice) {
      notice.hidden = !enabled;
      notice.textContent = enabled ? "District zničen" : "";
    }
    popupCard.setAttribute("aria-label", enabled ? "District zničen" : "District detail");
  };
  const setDistrictPopupMobilePositionMode = (mode = "default") => {
    const normalizedMode = mode === "raised" ? "raised" : "default";
    if (popup instanceof HTMLElement) {
      popup.dataset.mobilePosition = normalizedMode;
    }
    if (popupCard instanceof HTMLElement) {
      popupCard.dataset.mobilePosition = normalizedMode;
    }
  };
  const scheduleDistrictPopupRefresh = () => {
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
        populateAttackConfirmPopup(refreshedDistrict, getPendingAttackContext());
      }

      if (robberyConfirmPopup && !robberyConfirmPopup.hidden) {
        populateRobberyConfirmPopup(refreshedDistrict);
      }
    }, 1000);
  };

  const {
    clearPendingAttackContext,
    getPendingAttackContext,
    setPendingAttackContext,
    getAvailableAttackPopulation,
    getAdjacentOwnedDistrictIds,
    getPreparedAttackContext,
    renderAttackSummary,
    renderRobberySummary,
    renderDefenseSummary,
    populateAttackSetupPopup,
    populateAttackConfirmPopup,
    populateRobberySetupPopup,
    populateRobberyConfirmPopup,
    populateDefenseSetupPopup,
    populateTrapConfirmPopup,
    populateSpyConfirmPopup,
    populateOccupyConfirmPopup
  } = createDistrictActionPanelRuntime({
    attackCooldownMs: ATTACK_COOLDOWN_MS,
    getAttackSetupWeapons,
    getAttackWeaponLabels,
    calculateAttackDeployment: calculateAttackDeploymentWithRecruitmentSupport,
    calculateTotalDefensePower: calculateTotalDefensePowerWithRecruitmentSupport,
    clamp,
    createRobberySetupPreview,
    estimateDistrictDefense,
    getAdjacentDistrictIdsFromGeometry,
    getCurrentPlayerOwnedDistrictIds,
    getCurrentPlayerTrapDistrictId,
    getCurrentPlayerTrapMoveCooldownSeconds,
    getDistrictAtmosphereMeta,
    getDistrictDefenseState,
    getDistrictOwnerLabel,
    getFactoryAttackBoostContext,
    getGeometry: () => geometry,
    getInteractionState: () => interactionState,
    getResolvedSpyIntel,
    getResolvedSpyState,
    getResolvedWeaponInventory,
    getResolvedWorldState,
    renderAttackPanel,
    renderAttackProgress,
    resolveAttackOutcome,
    robberyCooldownMs: ROBBERY_COOLDOWN_MS,
    getRobberyCooldownView: () => getRobberyActionCooldownView(),
    occupyCooldownMs: OCCUPY_COOLDOWN_MS,
    getOccupyCooldownView: () => getOccupyActionCooldownView(),
    spyCooldownMs: SPY_COOLDOWN_MS,
    validateAttackSelection,
    elements: createDistrictActionConfirmationPanelElements(districtPopupElements)
  });
  const persistDefenseSetup = (selectedDistrict) => {
    if (!selectedDistrict) {
      return;
    }

    if (isServerAuthoritativeGameplayRuntimeReady()) {
      showWarning("Obranu potvrzuje serverový gameplay slice. Legacy lokální defense loadout je vypnutý.");
      return;
    }

    if (!shouldRunLocalGameplayRuntime()) return;

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

  const isDistrictOccupationInProgress = (districtId) => {
    const targetDistrictId = Number(districtId);
    return getStoredOccupyOrders()
      .some((order) => Number(String(order.targetDistrictId || "").replace("district:", "")) === targetDistrictId);
  };

  const isDowntownDistrict = (district) => (
    district?.isDowntown === true
    || String(district?.districtType || district?.zone || "").trim().toLowerCase() === "downtown"
  );
  const isDowntownOccupationLocked = (district) => isDowntownDistrict(district) && !isFinalLockdownActive();
  const getDowntownOccupationLockedMessage = (district) => (
    `District ${district?.id || ""} je downtown a je uzavřený. Obsazení bude možné až ve final lockdown fázi.`
  );

  const setDistrictOccupationLockedFeedback = (selectedDistrict) => {
    if (!selectedDistrict) {
      return;
    }

    if (buildingActionState) {
      buildingActionState.textContent = "Obsazení";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `District ${selectedDistrict.id} je obsazován. Během cooldownu nejdou spustit další akce.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `District ${selectedDistrict.id} · probíhá obsazení`;
    }
  };

  const setDowntownOccupationLockedFeedback = (selectedDistrict) => {
    if (!selectedDistrict) {
      return;
    }

    if (buildingActionState) {
      buildingActionState.textContent = "Downtown";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = getDowntownOccupationLockedMessage(selectedDistrict);
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `District ${selectedDistrict.id} · obsazení až ve final lockdown`;
    }
  };

  const applyAttackAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    if (!shouldRunLocalGameplayRuntime()) return false;

    if (isDistrictOccupationInProgress(selectedDistrict.id)) {
      setDistrictOccupationLockedFeedback(selectedDistrict);
      return false;
    }

    const context = getPendingAttackContext() || getPreparedAttackContext(selectedDistrict);

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
    document.dispatchEvent(new CustomEvent("empire:attack-started", {
      detail: {
        sourceDistrictId: context.sourceDistrictId,
        targetDistrictId: selectedDistrict.id,
        order: createdOrder
      }
    }));
    renderGangMembersState(root);
    scheduleAttackOrder(root, createdOrder);
    recordDistrictIntelEvent({
      type: "attack_started",
      districtId: selectedDistrict.id,
      sourceDistrictId: context.sourceDistrictId,
      intelLevel: "verified"
    });

    renderAttackProgress({
      stateLabel: "Rozkaz",
      summary: createdOrder.hasTrapDefense
        ? `District ${context.sourceDistrictId} zahájí útok na District ${selectedDistrict.id}. Cíl je krytý toxickou pastí. Výzbroj: ${context.selectedWeaponsLabel}.${context.boostContext.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`
        : `District ${context.sourceDistrictId} zahájí útok na District ${selectedDistrict.id}. Výzbroj: ${context.selectedWeaponsLabel}. Výsledek: ${createdOrder.resolvedScenario.label}.${context.boostContext.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`,
      meta: `Síla ${createdOrder.estimatedAttackPower} · Obrana ${createdOrder.targetDefensePower} · Obyvatelé ${context.totalResidents} · cooldown ${context.boostContext.cooldownLabel || formatDurationLabel(context.boostContext.cooldownMs)}`
    }, {
      elements: {
        state: buildingActionState,
        summary: buildingActionSummary,
        meta: buildingActionMeta
      }
    });

    clearPendingAttackContext();
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

    if (!shouldRunLocalGameplayRuntime()) return false;

    if (isDistrictOccupationInProgress(selectedDistrict.id)) {
      setDistrictOccupationLockedFeedback(selectedDistrict);
      return false;
    }

    const worldState = getResolvedWorldState();
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const nextTrapState = { ...(worldState.districtTrapById || {}) };
    const trapActionTimestamp = new Date().toISOString();

    if (currentTrapDistrictId === selectedDistrict.id) {
      return false;
    }

    if (currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id && trapMoveCooldownSeconds > 0) {
      if (buildingActionState) {
        buildingActionState.textContent = "Past";
        buildingActionState.classList.remove("building-action-status__state--idle");
      }

      if (buildingActionSummary) {
        buildingActionSummary.textContent = `Past lze přesunout až za ${formatDurationLabel(trapMoveCooldownSeconds * 1000)}.`;
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
        movedAt: trapActionTimestamp
      };
    }

    nextTrapState[selectedDistrict.id] = {
      ownerId: CURRENT_PLAYER_ID,
      isArmed: true,
      armedAt: trapActionTimestamp,
      movedAt: trapActionTimestamp
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
    document.dispatchEvent(new CustomEvent("empire:onboarding-event", {
      detail: {
        type: currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id ? "trap:moved" : "trap:armed",
        districtId: selectedDistrict.id,
        targetDistrictId: selectedDistrict.id,
        sourceDistrictId: currentTrapDistrictId && currentTrapDistrictId !== selectedDistrict.id ? currentTrapDistrictId : selectedDistrict.id
      }
    }));

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

    if (!shouldRunLocalGameplayRuntime()) return false;

    if (isDistrictOccupationInProgress(selectedDistrict.id)) {
      setDistrictOccupationLockedFeedback(selectedDistrict);
      return false;
    }

    if (isDowntownOccupationLocked(selectedDistrict)) {
      setDowntownOccupationLockedFeedback(selectedDistrict);
      openPopup(selectedDistrict);
      return false;
    }

    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(selectedDistrict);
    const spyIntel = getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(selectedDistrict.id));
    const populationCost = resolveOccupyPopulationCostForOwnedCount(getCurrentPlayerOwnedDistrictIds(interactionState).size);
    const availablePopulation = Math.max(0, Math.floor(Number(getResolvedGangState().members || 0)));

    if (!canOccupyAfterSpy || adjacentOwnedDistrictIds.length <= 0 || availablePopulation < populationCost) {
      return false;
    }

    const occupyCooldownView = getOccupyActionCooldownView();
    const occupyDurationMs = occupyCooldownView.effectiveCooldownMs;
    const occupyDurationLabel = occupyCooldownView.label || formatDurationLabel(occupyDurationMs);
    const createdOrder = {
      id: `occupy-order:${Date.now()}`,
      sourceDistrictId: `district:${adjacentOwnedDistrictIds[0]}`,
      targetDistrictId: `district:${selectedDistrict.id}`,
      createdAt: new Date().toISOString(),
      resolveAt: new Date(Date.now() + occupyDurationMs).toISOString(),
      populationCost,
      failureChance: LEGACY_OCCUPY_FAILURE_CHANCE,
      populationRefundRatio: LEGACY_OCCUPY_POPULATION_REFUND_RATIO,
      status: "cooldown"
    };

    setStoredOccupyOrders([
      ...getStoredOccupyOrders().filter((order) => Number(String(order.targetDistrictId || "").replace("district:", "")) !== Number(selectedDistrict.id)),
      createdOrder
    ]);
    setStoredGangState({
      members: Math.max(0, availablePopulation - populationCost)
    });
    renderGangMembersState(root);
    document.dispatchEvent(new CustomEvent("empire:occupy-started", {
      detail: {
        sourceDistrictId: adjacentOwnedDistrictIds[0],
        targetDistrictId: selectedDistrict.id,
        order: createdOrder
      }
    }));
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
      buildingActionSummary.textContent = `District ${selectedDistrict.id} se obsazuje po spy akci Úspěch. Cena ${populationCost} populace. Neúspěšnost 5 %. Při úspěchu se vrátí 10 % ceny. Obsazení potrvá ${occupyDurationLabel}.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Zdroj District ${adjacentOwnedDistrictIds[0]} · District ${selectedDistrict.id} · cooldown ${occupyDurationLabel}`;
    }

    closeOccupyConfirmPopup();
    closePopup();
    return true;
  };

  const applyRobberyAction = (selectedDistrict) => {
    if (!selectedDistrict) {
      return false;
    }

    if (!shouldRunLocalGameplayRuntime()) return false;

    if (isDistrictOccupationInProgress(selectedDistrict.id)) {
      setDistrictOccupationLockedFeedback(selectedDistrict);
      return false;
    }

    if (isServerAuthoritativeGameplayRuntimeReady()) {
      showWarning("Vykradení potvrzuje serverový gameplay slice. Legacy lokální robbery výsledek je vypnutý.");
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

    const robberyCooldownView = getRobberyActionCooldownView();
    const robberyDurationMs = robberyCooldownView.effectiveCooldownMs;
    const robberyDurationLabel = robberyCooldownView.label || formatDurationLabel(robberyDurationMs);
    const createdOrder = {
      id: `robbery-order:${Date.now()}`,
      playerId: `player:${CURRENT_PLAYER_ID}`,
      targetDistrictId: `district:${selectedDistrict.id}`,
      targetDistrictType: selectedDistrict.districtType,
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
    document.dispatchEvent(new CustomEvent("empire:robbery-started", {
      detail: {
        sourceDistrictId,
        targetDistrictId: selectedDistrict.id,
        order: createdOrder
      }
    }));
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
      buildingActionState.textContent = "Vykrást district";
      buildingActionState.classList.remove("building-action-status__state--idle");
    }

    if (buildingActionSummary) {
      buildingActionSummary.textContent = `District ${sourceDistrictId} spouští Vykrást district na prázdný District ${selectedDistrict.id}. Nasazeno ${deployedMembers} členů gangu. Akce neobsazuje území a běží ${robberyDurationLabel}.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `Vykrást district · Městský loot · Členové ${deployedMembers} · Cíl District ${selectedDistrict.id} · cooldown ${robberyDurationLabel}`;
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

    if (!shouldRunLocalGameplayRuntime()) return false;

    if (isDistrictOccupationInProgress(selectedDistrict.id)) {
      setDistrictOccupationLockedFeedback(selectedDistrict);
      return false;
    }

    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(selectedDistrict);
    const latestSpyState = getResolvedSpyState();
    const activeMissionCount = Array.isArray(latestSpyState.missions) ? latestSpyState.missions.length : 0;

    if (adjacentOwnedDistrictIds.length === 0 || latestSpyState.available <= 0 || activeMissionCount >= MAX_SPIES) {
      return false;
    }

    const spyDurationMs = getSpyActionDurationMs();
    const mission = {
      id: `spy-mission:${Date.now()}`,
      sourceDistrictId: adjacentOwnedDistrictIds[0],
      targetDistrictId: selectedDistrict.id,
      spyCount: LEGACY_SPY_MISSION_SPY_COUNT,
      ownerLabel: getDistrictOwnerLabel(selectedDistrict, interactionState),
      districtType: selectedDistrict.districtType,
      intelQualityPct: 0,
      createdAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + spyDurationMs).toISOString()
    };

    setStoredSpyState({
      available: clamp(MAX_SPIES - (activeMissionCount + 1), 0, MAX_SPIES),
      missions: [...latestSpyState.missions, mission]
    });
    document.dispatchEvent(new CustomEvent("empire:spy-started", {
      detail: {
        sourceDistrictId: mission.sourceDistrictId,
        targetDistrictId: mission.targetDistrictId,
        mission
      }
    }));
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
      buildingActionSummary.textContent = `Špeh byl vyslán z District ${mission.sourceDistrictId} do District ${mission.targetDistrictId}. Report dorazí za ${formatDurationLabel(spyDurationMs)}.`;
    }

    if (buildingActionMeta) {
      buildingActionMeta.textContent = `1 špeh na misi · návrat ${new Date(mission.returnAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    }

    showSpyToast(root);
    closeSpyConfirmPopup();
    closePopup();
    return true;
  };

  const normalizeActionTargetDistrictId = (value) => Number(String(value ?? "").replace("district:", "")) || 0;
  const parseActionCountdownEndsAt = (value) => {
    const timestamp = value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const formatActionCountdownLabel = (remainingMs) => {
    const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `Zbývá ${minutes}:${String(seconds).padStart(2, "0")}`;
  };
  const createActionCountdownView = (endsAtValue) => {
    const endsAt = parseActionCountdownEndsAt(endsAtValue);
    const remainingMs = endsAt - Date.now();
    if (!endsAt || remainingMs <= 0) {
      return null;
    }

    return {
      endsAt,
      label: formatActionCountdownLabel(remainingMs)
    };
  };
  const findActiveActionCountdown = (items, districtId, endsAtKey) => {
    const targetDistrictId = Number(districtId);
    return (Array.isArray(items) ? items : [])
      .filter((item) => normalizeActionTargetDistrictId(item?.targetDistrictId) === targetDistrictId)
      .map((item) => createActionCountdownView(item?.[endsAtKey]))
      .filter(Boolean)
      .sort((left, right) => left.endsAt - right.endsAt)[0] || null;
  };
  const getDistrictActionCountdowns = (districtId) => ({
    attack: findActiveActionCountdown(getStoredAttackOrders(), districtId, "resolveAt"),
    occupy: findActiveActionCountdown(getStoredOccupyOrders(), districtId, "resolveAt"),
    rob: findActiveActionCountdown(getStoredRobberyOrders(), districtId, "resolveAt"),
    spy: findActiveActionCountdown(getResolvedSpyState().missions, districtId, "returnAt")
  });

  const openPopup = (district) => {
    if (!popup || !popupTitle || !popupType || !popupOwner || !district) {
      return;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOccupying = isDistrictOccupationInProgress(district.id);
    const occupyingStatusMessage = isOccupying ? `District ${district.id} je obsazován.` : "";
    const downtownOccupationLocked = isDowntownOccupationLocked(district);
    const downtownOccupationLockedMessage = downtownOccupationLocked ? getDowntownOccupationLockedMessage(district) : "";
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));
    const rawOwnerLabel = getDistrictOwnerLabel(district, interactionState);
    const ownerLabel = isDestroyed
      ? "Nikdo"
      : isOccupying
        ? `District ${district.id} je obsazován`
        : rawOwnerLabel;
    const isOwnedByCurrentPlayer = !isDestroyed && !isOccupying && currentPlayerOwnedDistrictIds.has(Number(district.id));
    document.dispatchEvent(new CustomEvent("empire:district-opened", {
      detail: {
        district,
        districtId: district.id,
        isOwnedByCurrentPlayer
      }
    }));
    const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(geometry, district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
    const spyState = getResolvedSpyState();
    const spyIntel = getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(district.id));
    const currentTrapDistrictId = getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = getCurrentPlayerTrapMoveCooldownSeconds();
    const isUnoccupied = !isOccupying && rawOwnerLabel === "Neobsazeno";
    const isDistrictTypeKnown = isDistrictTypeKnownForCurrentPlayer(district, interactionState);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const previousAtmosphereDistrictId = Number(popupAtmosphereWindow?.dataset?.districtId || NaN);
    const shouldKeepAtmosphereWindowOpen = Boolean(
      popupAtmosphereWindow
      && popupAtmosphereWindow.hidden === false
      && previousAtmosphereDistrictId === Number(district.id)
    );
    const hasKnownDefense = hasKnownDistrictDefense(district);
    const activePoliceAction = getDistrictPoliceAction(district.id);
    const trapControlState = getDistrictTrapControlState(district);
    if (popup instanceof HTMLElement) {
      popup.dataset.districtId = String(district.id);
    }
    if (popupCard instanceof HTMLElement) {
      popupCard.dataset.districtId = String(district.id);
    }
    ensureOnboardingDistrictPopupTopLayer(popup, district, root?.ownerDocument || document);

    if (isDestroyed) {
      setDestroyedDistrictPopupMode(true);
      setDistrictPopupMobilePositionMode("default");
      if (popupTitle) {
        popupTitle.textContent = "District zničen";
      }
      if (popupAtmosphereWindow instanceof HTMLElement) {
        popupAtmosphereWindow.dataset.districtId = String(district.id);
      }
      closeDistrictAtmosphereWindow({
        trigger: popupAtmosphereHero,
        windowElement: popupAtmosphereWindow
      });
      showDistrictPopupModal(popup);
      document.dispatchEvent(new CustomEvent("empire:district-opened", {
        detail: {
          district,
          districtId: district.id,
          isOwnedByCurrentPlayer,
          ownerLabel
        }
      }));
      syncMapInteractionVisualState({
        hoveredDistrict: geometry?.districts?.find((entry) => entry.id === interactionState.hoveredDistrictId) || null,
        focusedDistrict: district
      });
      scheduleDistrictPopupRefresh();
      return;
    }

    setDestroyedDistrictPopupMode(false);

    renderSelectedDistrictSummary(buildSelectedDistrictSummaryViewModel(district, interactionState, {
      atmosphereMeta,
      currentPlayerId: CURRENT_PLAYER_ID,
      factionCatalog: FACTION_CATALOG,
      getLaunchPlayerAvatar,
      getLaunchPlayerFactionId,
      isDistrictTypeKnown,
      spyIntel,
      resolveOwnerLabel: (entry, state) => (
        Number(entry?.id) === Number(district.id) && isOccupying
          ? `District ${district.id} je obsazován`
          : getDistrictOwnerLabel(entry, state)
      )
    }), {
      elements: {
        title: popupTitle,
        type: popupType,
        owner: popupOwner,
        ownerMeta: popupOwnerMeta,
        ownerAvatar: popupOwnerAvatar,
        ownerAvatarFallback: popupOwnerAvatarFallback,
        card: popupCard
      }
    });

    applyDistrictAtmosphere({
      card: popupCard,
      imageElement: popupAtmosphereImage,
      labelElement: popupAtmosphereLabel,
      moodElement: popupAtmosphereMood,
      atmosphereMeta
    });
    if (popupAtmosphereHero instanceof HTMLElement) {
      popupAtmosphereHero.setAttribute("aria-expanded", shouldKeepAtmosphereWindowOpen ? "true" : "false");
      popupAtmosphereHero.dataset.atmosphereState = atmosphereMeta.typeKey === "unknown" ? "locked" : "revealed";
      popupAtmosphereHero.setAttribute(
        "aria-label",
        atmosphereMeta.typeKey === "unknown"
          ? "Zobrazit skrytou atmosféru distriktu."
          : `Zobrazit větší fotku atmosféry: ${atmosphereMeta.label}`
      );
    }
    if (popupAtmosphereWindow instanceof HTMLElement) {
      popupAtmosphereWindow.dataset.districtId = String(district.id);
    }
    if (!shouldKeepAtmosphereWindowOpen) {
      closeDistrictAtmosphereWindow({
        trigger: popupAtmosphereHero,
        windowElement: popupAtmosphereWindow
      });
    }
    if (popupAtmosphereWindowImage instanceof HTMLImageElement) {
      popupAtmosphereWindowImage.src = atmosphereMeta.imagePath;
      popupAtmosphereWindowImage.alt = `${atmosphereMeta.label || "District"} – fotka atmosféry`;
    }
    if (popupAtmosphereWindowLabel) {
      popupAtmosphereWindowLabel.textContent = atmosphereMeta.label || "Atmosféra districtu";
    }
    if (popupAtmosphereWindowMood) {
      popupAtmosphereWindowMood.textContent = atmosphereMeta.mood || "";
    }

    renderDistrictPopupFlags(buildDistrictPopupFlagsViewModel({
      isDestroyed,
      isOwnedByCurrentPlayer,
      ownerLabel,
      adjacentOwnedCount: adjacentOwnedDistrictIds.length,
      hasKnownDefense,
      activePoliceAction,
      isOccupying,
      isDowntownOccupationLocked: downtownOccupationLocked,
      canOccupyAfterSpy,
      hasTrapHere: currentTrapDistrictId === district.id
    }));

    renderDistrictDefenseSummary(district);
    renderDistrictEconomySummary(district);
    renderDistrictPopupBuildings(district);
    renderDistrictPopupGossip(district);

    const resolvedActions = activePoliceAction || isOccupying
      ? []
      : resolveDistrictActions({
          districtId: district.id,
          serverAuthoritative: isServerAuthoritativeGameplayRuntimeReady(),
          isOwnedByCurrentPlayer,
          isDestroyed: interactionState.destroyedDistrictIds.has(district.id),
          hasAdjacentOwnedDistrict: adjacentOwnedDistrictIds.length > 0,
          isUnoccupied,
          canOccupyAfterSpy,
          availableSpies: spyState.available,
          isOccupying,
          isDowntownOccupationLocked: downtownOccupationLocked,
          currentTrapDistrictId,
          trapMoveCooldownSeconds
        }).filter((action) => action.visible);
    const hasEnabledDistrictAction = resolvedActions.some((action) => action.enabled);
    setDistrictPopupMobilePositionMode(
      isOwnedByCurrentPlayer || hasEnabledDistrictAction ? "raised" : "default"
    );

    renderDistrictActionHub(buildDistrictActionViewModel(district, {
      activePoliceAction,
      statusMessage: occupyingStatusMessage,
      noticeMessage: downtownOccupationLockedMessage,
      resolvedActions,
      actionCountdowns: getDistrictActionCountdowns(district.id),
      trapControlState
    }, {
      normalizeReason: normalizeDistrictActionReason
    }), {
      onAction: () => {}
    }, {
      elements: {
        section: districtActionSection,
        head: districtActionSectionHead,
        mount: districtActionsMount
      }
    });
    applyOnboardingDistrictActionHint(district, {
      actionsMount: districtActionsMount
    }, root?.ownerDocument || document);

    showDistrictPopupModal(popup);
    document.dispatchEvent(new CustomEvent("empire:district-opened", {
      detail: {
        district,
        districtId: district.id,
        isOwnedByCurrentPlayer,
        ownerLabel
      }
    }));
    applyDistrictPopupOverviewMode();
    syncMapInteractionVisualState({
      hoveredDistrict: geometry?.districts?.find((entry) => entry.id === interactionState.hoveredDistrictId) || null,
      focusedDistrict: district
    });

    scheduleDistrictPopupRefresh();
  };

  const openPoliceRaidOnlyForDistrict = (district, policeAction = null) => {
    if (!district) {
      return false;
    }

    const activePoliceAction = policeAction || getDistrictPoliceAction(district.id);
    if (!activePoliceAction) {
      return false;
    }

    closePopup();
    hideTooltip();

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const isOwnedDistrict = currentPlayerOwnedDistrictIds.has(Number(district.id));
    const policeRaidPayload = isOwnedDistrict
      ? createOwnedDistrictPoliceRaidAlertPayload(district, activePoliceAction)
      : createDistrictPoliceRaidWarningPayload(district, activePoliceAction);

    queueOrOpenResultModal(root, "police", {
      ...policeRaidPayload,
      syncToBuildingAction: false
    });
    return true;
  };

  const openStoredOwnedPoliceRaidAlert = () => {
    if (!root || root.dataset.ownedPoliceRaidAlertOpened === "true") {
      return false;
    }

    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const activeOwnedPoliceAction = Object.values(getResolvedDistrictPoliceActions())
      .filter((marker) => currentPlayerOwnedDistrictIds.has(Number(marker?.districtId)))
      .sort((left, right) => Number(left?.expiresAt || 0) - Number(right?.expiresAt || 0))[0] || null;
    if (!activeOwnedPoliceAction) {
      return false;
    }

    const district = geometry?.districts?.find((entry) => Number(entry.id) === Number(activeOwnedPoliceAction.districtId))
      || { id: Number(activeOwnedPoliceAction.districtId) };
    const policeRaidPayload = createOwnedDistrictPoliceRaidAlertPayload(district, activeOwnedPoliceAction);
    root.dataset.ownedPoliceRaidAlertOpened = "true";
    openPoliceActionResultModal(root, {
      ...policeRaidPayload,
      syncToBuildingAction: false
    });
    return true;
  };

  const scheduleStoredOwnedPoliceRaidAlert = () => {
    const openAlert = () => openStoredOwnedPoliceRaidAlert();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        if (typeof window.setTimeout === "function") {
          window.setTimeout(openAlert, 0);
        } else {
          openAlert();
        }
      });
      return true;
    }
    openAlert();
    return true;
  };

  const updateTooltip = (event, district) => {
    if (!tooltip || !tooltipValue || !tooltipType || !district || (event?.pointerType && event.pointerType !== "mouse")) {
      hideTooltip();
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const shouldRenderContent = district.id !== lastTooltipDistrictId;
    const tooltipResult = renderDistrictTooltip(buildMapTooltipViewModel(district, interactionState, {
      currentPlayerId: CURRENT_PLAYER_ID,
      getDistrictAtmosphereMeta,
      getLaunchPlayerName,
      isDistrictGossipDevOnlyMode,
      ensureDistrictPassiveGossip,
      spyIntel: getResolvedSpyIntel()
    }), {
      pointerX: event.clientX - viewportRect.left,
      pointerY: event.clientY - viewportRect.top
    }, {
      tooltip,
      value: tooltipValue,
      type: tooltipType,
      gossip: tooltipGossip,
      viewportRect,
      tooltipSize,
      renderContent: shouldRenderContent,
      clamp
    });

    if (shouldRenderContent) {
      lastTooltipDistrictId = district.id;
      tooltipSize = tooltipResult.tooltipSize || tooltipSize;
    }
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

  const renderCanvasOnly = () => {
    syncDistrictCanvasResolution();
    geometry = renderDistrictCanvas(canvas, phaseHost.dataset.mapPhase || "day", interactionState, imageSet, {
      renderActivityEffects: false,
      compactDistrictBorders: Boolean(getCurrentPerformanceMode().active)
    });
    renderMapEffects();
    renderHoverCanvas();
  };

  const buildCurrentMapStatusViewModel = () => buildMapStatusViewModel({
    districts: geometry?.districts || [],
    selectedDistrict: getSelectedDistrict(),
    ownedDistrictIds: getCurrentPlayerOwnedDistrictIds(interactionState),
    destroyedDistrictIds: interactionState.destroyedDistrictIds,
    launchOwnerByDistrictId: interactionState.launchOwnerByDistrictId,
    currentPlayerId: CURRENT_PLAYER_ID,
    overlayState: createDefaultMapOverlayState()
  }, {
    getDistrictDisplayName
  });

  const beginDistrictSelectionGesture = (event) => {
    if (shouldSuppressMapInput(event) || isOverlayOpen()) {
      districtSelectionGesture.pointerId = null;
      return;
    }

    districtSelectionGesture.pointerId = event.pointerId;
    districtSelectionGesture.startX = event.clientX;
    districtSelectionGesture.startY = event.clientY;
    districtSelectionGesture.moved = false;
  };

  const trackDistrictSelectionGesture = (event) => {
    if (shouldSuppressMapInput(event) || isOverlayOpen()) {
      districtSelectionGesture.pointerId = null;
      return;
    }

    if (districtSelectionGesture.pointerId !== event.pointerId || districtSelectionGesture.moved) {
      return;
    }

    const deltaX = event.clientX - districtSelectionGesture.startX;
    const deltaY = event.clientY - districtSelectionGesture.startY;
    if ((deltaX * deltaX) + (deltaY * deltaY) >= MAP_DISTRICT_SELECTION_DRAG_THRESHOLD * MAP_DISTRICT_SELECTION_DRAG_THRESHOLD) {
      districtSelectionGesture.moved = true;
    }
  };

  const endDistrictSelectionGesture = (event) => {
    if (shouldSuppressMapInput(event) || isOverlayOpen()) {
      districtSelectionGesture.pointerId = null;
      districtSelectionGesture.moved = false;
      return;
    }

    if (districtSelectionGesture.pointerId !== event.pointerId) {
      return;
    }

    if (districtSelectionGesture.moved) {
      districtSelectionGesture.suppressClickUntil = window.performance.now() + MAP_DISTRICT_SELECTION_SUPPRESS_MS;
    }

    districtSelectionGesture.pointerId = null;
    districtSelectionGesture.moved = false;
  };

  const syncMapMissionMarkers = (now = Date.now()) => {
    Object.assign(interactionState, buildMapMissionMarkersViewModel({
      spyMissions: getResolvedSpyState().missions,
      policeActions: getResolvedDistrictPoliceActions(),
      attackOrders: getStoredAttackOrders(),
      occupyOrders: getStoredOccupyOrders(),
      robberyOrders: getStoredRobberyOrders(),
      worldState: getResolvedWorldState(),
      now,
      attackCooldownMs: ATTACK_COOLDOWN_MS,
      robberyCooldownMs: ROBBERY_COOLDOWN_MS,
      isSpyMissionActiveOnMap,
      getSpyMissionExpiryTimestamp
    }));
    lastMissionMarkerSyncAt = Number(now) || Date.now();
  };

  const hasActiveMapMissions = () => (
    interactionState.activeSpyDistrictIds.size > 0
    || interactionState.activePoliceDistrictIds.size > 0
    || interactionState.activeAttackDistrictIds.size > 0
    || interactionState.activeOccupyDistrictIds.size > 0
    || interactionState.activeRobberyDistrictIds.size > 0
    || interactionState.activeTrapDistrictIds.size > 0
  );

  const renderMapEffects = () => {
    if (!effectsCanvas || !geometry) {
      return;
    }

    if (getCurrentPerformanceMode().reducedMotion || !hasActiveMapMissions()) {
      clearEffectsCanvas();
      return;
    }

    syncEffectsCanvasSize();
    const startedAt = window.performance?.now?.() ?? Date.now();
    renderDistrictEffectsCanvas(
      effectsCanvas,
      phaseHost.dataset.mapPhase || "day",
      interactionState,
      geometry,
      { reducedMapEffects: interactionState.reducedMapEffects || dynamicEffectsReduced }
    );
    const durationMs = Math.max(0, (window.performance?.now?.() ?? Date.now()) - startedAt);
    const metrics = recordMapEffectRender(window, durationMs);
    const mode = getCurrentPerformanceMode();
    const normalFps = mode.active ? 20 : 60;

    if (durationMs > 16) {
      dynamicEffectsReduced = true;
      consecutiveFastEffectFrames = 0;
      metrics.mapEffectsQuality = "reduced";
      metrics.mapEffectsFpsCap = mode.active ? 15 : 30;
      return;
    }

    consecutiveFastEffectFrames = durationMs < 10 ? consecutiveFastEffectFrames + 1 : 0;
    if (dynamicEffectsReduced && consecutiveFastEffectFrames >= 12) {
      dynamicEffectsReduced = false;
      metrics.mapEffectsQuality = "full";
      metrics.mapEffectsFpsCap = normalFps;
    } else if (!metrics.mapEffectsFpsCap) {
      metrics.mapEffectsQuality = "full";
      metrics.mapEffectsFpsCap = normalFps;
    }
  };

  const performRender = () => {
    syncPhaseHostFromAuthority(phaseHost);
    interactionState.borderColor = phaseHost.dataset.borderColor || "white";
    interactionState.gamePhase = normalizeRuntimeGamePhase(phaseHost.dataset.gamePhase || "launch");
    interactionState.animationTick = Date.now();
    syncMapMissionMarkers(interactionState.animationTick);
    refreshMapAfterStateChange({
      elements: {
        overlayControls,
        statusPanel
      },
      overlayState: createDefaultMapOverlayState(),
      callbacks: {
        redrawMap: renderCanvasOnly,
        buildStatusViewModel: buildCurrentMapStatusViewModel,
        syncShellVisualState: () => syncMapInteractionVisualState({
          hoveredDistrict: geometry?.districts?.find((district) => district.id === interactionState.hoveredDistrictId) || null,
          focusedDistrict: hasActiveDistrictModal() ? getSelectedDistrict() : null
        })
      }
    });

    if (buildingsPopup && !buildingsPopup.hidden) {
      const activeBuildingsDistrictType = getActiveBuildingsDistrictType();
      if (!activeBuildingsDistrictType) {
        return;
      }
      const hasActiveBuildingsDistrictType = activeBuildingsDistrictType
        && getSourceDistrictsForBuildingType(activeBuildingsDistrictType).length > 0;
      const nextType = hasActiveBuildingsDistrictType
        ? activeBuildingsDistrictType
        : getFirstAvailableBuildingDistrictType();

      if (nextType !== activeBuildingsDistrictType) {
        renderBuildingsPopup(nextType);
      }
    }
  };

  const mapRenderScheduler = createMapRenderScheduler({
    windowRef: window,
    documentRef: document,
    frameIntervalMs: getMapFrameIntervalMs(),
    render: performRender,
    onVisible: () => {
      syncInteractionDistrictAuthorityState();
      syncMapMissionMarkers(Date.now());
    }
  });

  const render = (reason = "ui-interaction", options = {}) => {
    mapRenderScheduler.setFrameIntervalMs(getMapFrameIntervalMs());
    return mapRenderScheduler.invalidate(reason, {
      ...options,
      immediate: Boolean(options.immediate || !geometry)
    });
  };

  const createWorldMapFingerprint = () => {
    const worldState = getResolvedWorldState();
    const phaseState = worldState.phaseState || {};
    return JSON.stringify({
      ownedDistrictIds: [...(worldState.ownedDistrictIds || [])].map(Number).sort((left, right) => left - right),
      destroyedDistrictIds: [...(worldState.destroyedDistrictIds || [])].map(Number).sort((left, right) => left - right),
      districtOwnerById: worldState.districtOwnerById || worldState.ownerByDistrictId || {},
      districtTrapById: worldState.districtTrapById || {},
      gamePhase: phaseState.gamePhase || "",
      mapPhase: phaseState.mapPhase || ""
    });
  };
  let lastWorldMapFingerprint = createWorldMapFingerprint();

  const ensureMissionAnimationLoop = () => {
    const hasActiveMissions = hasActiveMapMissions();

    if (document.hidden || getCurrentPerformanceMode().reducedMotion || !hasActiveMissions) {
      if (spyAnimationFrameId !== null) {
        window.cancelAnimationFrame(spyAnimationFrameId);
        spyAnimationFrameId = null;
      }
      if (!hasActiveMissions || getCurrentPerformanceMode().reducedMotion) {
        clearEffectsCanvas();
      }
      lastMissionAnimationAt = 0;
      return;
    }

    if (interactionState.reducedMapEffects) {
      renderMapEffects();
      return;
    }

    if (spyAnimationFrameId !== null) {
      return;
    }

    const animate = (time) => {
      if (document.hidden) {
        spyAnimationFrameId = null;
        return;
      }

      if (time - lastMissionAnimationAt < getMapEffectsFrameIntervalMs()) {
        spyAnimationFrameId = window.requestAnimationFrame(animate);
        return;
      }
      lastMissionAnimationAt = time;
      const now = Date.now();
      if (now - lastMissionMarkerSyncAt >= 1000) {
        syncMapMissionMarkers(now);
      }

      if (!hasActiveMapMissions()) {
        spyAnimationFrameId = null;
        clearEffectsCanvas();
        render("mission-complete");
        return;
      }

      interactionState.animationTick = now;
      renderMapEffects();
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
    getAllDistricts() {
      return Array.isArray(geometry?.districts) ? [...geometry.districts] : [];
    },
    getDistrictBuildingProfile(districtId) {
      const district = districtStateApi.getDistrictById(districtId);
      return district ? resolveDistrictBuildingProfile(district) : null;
    },
    selectDistrict(districtId) {
      const district = districtStateApi.getDistrictById(districtId);
      if (!district) {
        return false;
      }

      interactionState.selectedDistrictId = Number(district.id);
      render();
      return true;
    },
    openDistrict(districtId) {
      const district = districtStateApi.getDistrictById(districtId);
      if (!district) {
        return false;
      }

      const activePoliceAction = getDistrictPoliceAction(district.id);
      if (activePoliceAction) {
        return openPoliceRaidOnlyForDistrict(district, activePoliceAction);
      }

      interactionState.selectedDistrictId = Number(district.id);
      render();
      openPopup(district);
      return true;
    },
    openBuildingDetail(districtIdOrBuildingName, buildingName = "", options = {}) {
      const firstArg = String(districtIdOrBuildingName || "").trim();
      const secondArg = String(buildingName || "").trim();
      const hasNumericDistrict = firstArg !== "" && Number.isFinite(Number(firstArg)) && secondArg !== "";
      let district = hasNumericDistrict
        ? districtStateApi.getDistrictById(Number(firstArg))
        : getSelectedDistrict();
      const resolvedBuildingName = hasNumericDistrict ? secondArg : (firstArg || secondArg);

      if (!district && interactionState.ownedDistrictIds.size > 0) {
        district = districtStateApi.getDistrictById(Array.from(interactionState.ownedDistrictIds)[0]);
      }

      if (!district || !resolvedBuildingName) {
        return false;
      }

      return openDistrictBuildingDetail(district, resolvedBuildingName, {
        preferGenericDetail: true,
        ...options
      });
    },
    openAttackPanel(districtId) {
      const district = districtStateApi.getDistrictById(districtId) || getSelectedDistrict();
      if (!district) {
        return false;
      }

      interactionState.selectedDistrictId = Number(district.id);
      render();
      if (isDistrictOccupationInProgress(district.id)) {
        openPopup(district);
        setDistrictOccupationLockedFeedback(district);
        return false;
      }
      openPopup(district);
      populateAttackSetupPopup(district);
      return openAttackPanel(district, { popup: attackSetupPopup });
    },
    startAttack(districtId) {
      const district = districtStateApi.getDistrictById(districtId) || getSelectedDistrict();
      if (!district) {
        return false;
      }

      interactionState.selectedDistrictId = Number(district.id);
      render();
      if (isDistrictOccupationInProgress(district.id)) {
        openPopup(district);
        setDistrictOccupationLockedFeedback(district);
        return false;
      }
      const preparedContext = getPreparedAttackContext(district);
      if (!preparedContext?.canConfirm) {
        populateAttackSetupPopup(district);
        return false;
      }

      setPendingAttackContext(preparedContext);
      populateAttackConfirmPopup(district, preparedContext);
      return applyAttackAction(district);
    },
    openSpyPanel(districtId) {
      const district = districtStateApi.getDistrictById(districtId) || getSelectedDistrict();
      if (!district) {
        return false;
      }

      interactionState.selectedDistrictId = Number(district.id);
      render();
      if (isDistrictOccupationInProgress(district.id)) {
        openPopup(district);
        setDistrictOccupationLockedFeedback(district);
        return false;
      }
      openPopup(district);
      populateSpyConfirmPopup(district);
      return openSpyPanel(district, { popup: spyConfirmPopup });
    },
    startSpy(districtId) {
      const district = districtStateApi.getDistrictById(districtId) || getSelectedDistrict();
      if (!district) {
        return false;
      }

      interactionState.selectedDistrictId = Number(district.id);
      if (isDistrictOccupationInProgress(district.id)) {
        render();
        openPopup(district);
        setDistrictOccupationLockedFeedback(district);
        return false;
      }
      populateSpyConfirmPopup(district);
      return applySpyAction(district);
    },
    getSelectedDistrict() {
      return getSelectedDistrict();
    },
    refreshSelectedDistrictPanel() {
      const selectedDistrict = getSelectedDistrict();
      if (!selectedDistrict || !popup || popup.hidden) {
        return false;
      }

      openPopup(selectedDistrict);
      return true;
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

  phaseHost.addEventListener("mapphasechange", () => render("ui:map-phase-change"));
  phaseHost.addEventListener("mapphasechange", () => refreshOpenDistrictBuildingDetailPopups(root));
  phaseHost.addEventListener("mapborderchange", () => render("ui:map-border-change"));
  document.addEventListener("empire:settings-changed", (event) => {
    const settings = event.detail?.settings || getSettingsState();
    interactionState.showDistrictBorders = Boolean(settings.mapDistrictBorders);
    interactionState.showAllianceSymbols = Boolean(settings.mapAllianceSymbols);
    interactionState.reducedMapEffects = shouldUseReducedMapEffects(settings);
    interactionState.mapVisibilityMode = normalizeMapVisibilityMode(settings.mapVisibilityMode);
    render("ui:settings-change");
    ensureMissionAnimationLoop();
  });
  phaseHost.addEventListener("gamephasechange", () => render("ui:game-phase-change"));
  window.addEventListener("empire:alliance-state-changed", () => render("ui:alliance-state-change"));
  window.addEventListener("empire:bounty-state-changed", () => render("ui:bounty-state-change"));
  document.addEventListener("empire:world-state-changed", (event) => {
    const nextWorldMapFingerprint = createWorldMapFingerprint();
    if (nextWorldMapFingerprint === lastWorldMapFingerprint) {
      return;
    }
    lastWorldMapFingerprint = nextWorldMapFingerprint;
    syncInteractionDistrictAuthorityState();
    syncRuntimePassiveProductionState({
      root,
      force: Boolean(event?.detail?.ownedDistrictIdsChanged),
      minIntervalMs: 60_000,
      scheduleProductionJobs: false
    });
    render("ui:world-map-state-change");
    ensureMissionAnimationLoop();
  });
  document.addEventListener("empire:police-state-changed", () => {
    render("ui:police-state-change");
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
    const isOwnedDistrict = currentPlayerOwnedDistrictIds.has(Number(marker.districtId));
    const policeRaidPayload = isOwnedDistrict
      ? createOwnedDistrictPoliceRaidAlertPayload(district, marker)
      : createDistrictPoliceRaidWarningPayload(district, marker);

    if (!isOwnedDistrict) {
      return;
    }

    const districtLabel = formatDistrictReference(marker.districtId);
    appendBuildingActionResultEntry(root, "police", policeRaidPayload, {
      tone: "warning",
      title: "Spuštěna policejní razie",
      summary: `${districtLabel} je právě pod policejním zásahem.`,
      meta: policeRaidPayload.badge || "Policejní zásah"
    }, {
      refresh: false,
      syncPreview: true
    });

    openPoliceActionResultModal(root, {
      ...policeRaidPayload,
      syncToBuildingAction: false
    });
  });
  const handleMobilePerformanceModeChange = (event) => {
    currentPerformanceMode = event?.detail && typeof event.detail === "object"
      ? event.detail
      : detectMobilePerformanceMode({ windowRef: window, documentRef: document });
    applyMobilePerformanceMode(currentPerformanceMode, { windowRef: window, documentRef: document });
    interactionState.reducedMapEffects = shouldUseReducedMapEffects(getSettingsState());
    render("mobile-performance-mode");
    ensureMissionAnimationLoop();
  };
  const handleMapVisibilityChange = () => {
    if (document.hidden) {
      if (spyAnimationFrameId !== null) {
        window.cancelAnimationFrame(spyAnimationFrameId);
        spyAnimationFrameId = null;
      }
      return;
    }

    currentPerformanceMode = detectMobilePerformanceMode({ windowRef: window, documentRef: document });
    applyMobilePerformanceMode(currentPerformanceMode, { windowRef: window, documentRef: document });
    interactionState.reducedMapEffects = shouldUseReducedMapEffects(getSettingsState());
    syncInteractionDistrictAuthorityState();
    syncMapMissionMarkers(Date.now());
    render("visibility-return", { immediate: true });
    ensureMissionAnimationLoop();
  };
  let resizeRenderFrameId = null;
  const requestMapResizeRender = () => {
    if (resizeRenderFrameId !== null) {
      return;
    }

    resizeRenderFrameId = window.requestAnimationFrame(() => {
      resizeRenderFrameId = null;
      currentPerformanceMode = detectMobilePerformanceMode({ windowRef: window, documentRef: document });
      applyMobilePerformanceMode(currentPerformanceMode, { windowRef: window, documentRef: document });
      interactionState.reducedMapEffects = shouldUseReducedMapEffects(getSettingsState());
      render("resize");
      ensureMissionAnimationLoop();
    });
  };
  const handleExplicitMapInvalidation = (event) => {
    render(event?.detail?.reason || "ui:explicit-invalidation");
    ensureMissionAnimationLoop();
  };
  const handleMapTransformChange = () => {
    render("ui:map-transform");
    ensureMissionAnimationLoop();
  };
  const handleServerSliceRendered = () => {
    render("server-slice-change");
    ensureMissionAnimationLoop();
  };
  window.addEventListener("empire:mobile-performance-mode-changed", handleMobilePerformanceModeChange);
  document.addEventListener("visibilitychange", handleMapVisibilityChange);
  document.addEventListener("empire:map-invalidate", handleExplicitMapInvalidation);
  document.addEventListener("empire:gameplay-slice-rendered", handleServerSliceRendered);
  window.addEventListener("resize", requestMapResizeRender, { passive: true });
  viewport.addEventListener("empire:map-transform-changed", handleMapTransformChange);
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
      renderHoverCanvas();
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
    if (event.pointerType && event.pointerType !== "mouse") {
      if (interactionState.hoveredDistrictId !== null) {
        interactionState.hoveredDistrictId = null; viewport.style.cursor = "";
        clearHoverCanvas();
      }
      hideTooltip();
      return;
    }
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
      clearHoverCanvas();
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

    if (shouldSuppressMapInput(event) || isOverlayOpen()) {
      return;
    }

    const now = window.performance.now();
    const mapNavigationSuppressUntil = Number(viewport.dataset.mapGestureSuppressUntil || 0);
    if (now < districtSelectionGesture.suppressClickUntil || now < mapNavigationSuppressUntil) {
      districtSelectionGesture.suppressClickUntil = 0;
      delete viewport.dataset.mapGestureSuppressUntil;
      return;
    }

    const district = getDistrictAtPoint(geometry, toCanvasPoint(event));
    if (!isOnboardingDistrictClickAllowed(district, root?.ownerDocument || document)) {
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }

    if (district) {
      const activePoliceAction = getDistrictPoliceAction(district.id);
      if (activePoliceAction) {
        event.preventDefault?.();
        event.stopPropagation?.();
        openPoliceRaidOnlyForDistrict(district, activePoliceAction);
        return;
      }

      interactionState.selectedDistrictId = district.id;
      render();
      openPopup(district);
      const activeAttackMarker = interactionState.activeAttackMarkersByDistrictId.get(district.id);
      if (activeAttackMarker) {
        queueOrOpenResultModal(root, "police", createDistrictAttackInProgressPayload(district, activeAttackMarker));
      }
    } else {
      interactionState.selectedDistrictId = null;
      render();
      closePopup();
    }
  });

  bindDistrictAtmosphereWindowControls({
    trigger: popupAtmosphereHero,
    windowElement: popupAtmosphereWindow,
    closeButton: popupAtmosphereWindowClose
  });

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
      const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
      if (!currentPlayerOwnedDistrictIds.has(Number(selectedDistrict.id))) {
        return;
      }
      if (chipButton.disabled || chipButton.dataset.districtBuildingInteractive === "false") {
        return;
      }

      openDistrictBuildingDetail(selectedDistrict, chipButton.dataset.districtBuildingName || "", {
        displayName: chipButton.dataset.districtBuildingDisplayName || "",
        preferGenericDetail: true
      });
    });
  }

  if (buildingsPopupOpenButton instanceof HTMLButtonElement) {
    buildingsPopupOpenButton.addEventListener("click", openBuildingsPopup);
  }

  scheduleStoredOwnedPoliceRaidAlert();

  const bindBuildingsPopupTap = (mount, handler) => {
    if (!mount || typeof handler !== "function") {
      return;
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchHandledAt = 0;

    mount.addEventListener("click", (event) => {
      if (Date.now() - lastTouchHandledAt < 420) {
        event.preventDefault();
        return;
      }

      handler(event);
    });

    mount.addEventListener("touchstart", (event) => {
      const touch = event.touches?.[0];
      if (!touch || event.touches.length !== 1) {
        touchStartX = 0;
        touchStartY = 0;
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    mount.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      const movedX = Math.abs(touch.clientX - touchStartX);
      const movedY = Math.abs(touch.clientY - touchStartY);
      if (movedX > 18 || movedY > 18) {
        return;
      }

      if (handler(event)) {
        lastTouchHandledAt = Date.now();
        event.preventDefault();
      }
    }, { passive: false });
  };

  const handleBuildingsPopupTypeTap = (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const typeButton = target.closest("[data-buildings-district-type]");
    if (!(typeButton instanceof HTMLElement)) {
      return false;
    }

    if (typeButton instanceof HTMLButtonElement && typeButton.disabled) {
      return false;
    }

    const districtType = String(typeButton.dataset.buildingsDistrictType || "").trim();
    if (!districtType) {
      return false;
    }

    renderBuildingsPopup(districtType);
    return true;
  };

  const handleBuildingsPopupDetailTap = (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const baseButton = target.closest("[data-buildings-select-base-name]");
    if (baseButton instanceof HTMLButtonElement) {
      const selectedBaseName = String(baseButton.dataset.buildingsSelectBaseName || "").trim();
      const selectedType = String(baseButton.dataset.buildingsSelectBaseType || getActiveBuildingsDistrictType() || "").trim();

      if (!selectedBaseName || !selectedType) {
        return false;
      }

      selectBuildingsPopupBaseName(selectedType, selectedBaseName);
      renderBuildingsPopupDetail(selectedType);
      return true;
    }

    const buildingButton = target.closest("[data-buildings-open-building-name]");
    if (buildingButton instanceof HTMLButtonElement) {
      const districtId = Number(buildingButton.dataset.buildingsOpenBuildingDistrictId || 0);
      const district = districtId && geometry?.districts?.length
        ? geometry.districts.find((entry) => Number(entry.id) === districtId) || null
        : null;

      if (!district) {
        return false;
      }

      openDistrictBuildingDetail(district, buildingButton.dataset.buildingsOpenBuildingName || "", {
        displayName: buildingButton.dataset.buildingsOpenBuildingDisplayName || "",
        preferGenericDetail: true
      });
      return true;
    }

    const openButton = target.closest("[data-buildings-open-district-id]");
    if (!(openButton instanceof HTMLButtonElement)) {
      return false;
    }

    const districtId = Number(openButton.dataset.buildingsOpenDistrictId || 0);
    if (!districtId || !geometry?.districts?.length) {
      return false;
    }

    const district = geometry.districts.find((entry) => Number(entry.id) === districtId) || null;
    if (!district) {
      return false;
    }

    interactionState.selectedDistrictId = district.id;
    render();
    closeBuildingsPopup();
    openPopup(district);
    return true;
  };

  bindBuildingsPopupTap(buildingsPopupTypeMount, handleBuildingsPopupTypeTap);
  bindBuildingsPopupTap(buildingsPopupDetailMount, handleBuildingsPopupDetailTap);
  root.ownerDocument?.addEventListener?.("empire:production-collected", () => {
    if (!buildingsPopup || buildingsPopup.hidden) {
      return;
    }
    const activeBuildingsDistrictType = getActiveBuildingsDistrictType();
    if (activeBuildingsDistrictType) {
      renderBuildingsPopupDetail(activeBuildingsDistrictType);
    }
  });

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

      if (isDistrictOccupationInProgress(selectedDistrict.id)) {
        setDistrictOccupationLockedFeedback(selectedDistrict);
        return;
      }

      if (isServerAuthoritativeGameplayRuntimeReady() && ["heist", "occupy", "rob", "spy", "trap"].includes(actionId)) {
        const player = latestGameplaySliceReadModel?.player || {};
        const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(selectedDistrict);
        const sourceDistrictId = adjacentOwnedDistrictIds.length
          ? `district:${adjacentOwnedDistrictIds[0]}`
          : latestGameplaySliceReadModel?.district?.districtId || player.homeDistrictId || "";
        const targetDistrictId = `district:${selectedDistrict.id}`;
        const actionRequest = actionId === "attack"
          ? { type: "attack-district", payload: { districtId: targetDistrictId, sourceDistrictId } }
          : actionId === "heist"
            ? { type: "heist-district", payload: { targetDistrictId, sourceDistrictId, style: "balanced", gangMembersSent: 1 } }
            : actionId === "occupy"
              ? { type: "occupy-district", payload: { districtId: targetDistrictId, sourceDistrictId } }
              : actionId === "rob"
                ? { type: "rob-district", payload: { targetDistrictId, sourceDistrictId } }
                : actionId === "spy"
                  ? { type: "spy-district", payload: { districtId: targetDistrictId, sourceDistrictId } }
                  : { type: "place-trap", payload: { districtId: targetDistrictId } };
        void submitServerDistrictActionCommand({
          ...actionRequest,
          focusDistrictId: targetDistrictId
        }).then((response) => {
          if (response?.accepted) {
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Server akci odmítl.");
          }
        });
        return;
      }

      if (actionId === "defense") {
        populateDefenseSetupPopup(selectedDistrict);

        if (defenseSetupPopup) {
          showDistrictPopupModal(defenseSetupPopup);
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
            buildingActionSummary.textContent = `Past lze přesunout až za ${formatDurationLabel(trapMoveCooldownSeconds * 1000)}.`;
          }

          if (buildingActionMeta) {
            buildingActionMeta.textContent = `Aktivní past v District ${currentTrapDistrictId} · cooldown běží`;
          }

          openPopup(selectedDistrict);
          return;
        }

        populateTrapConfirmPopup(selectedDistrict);

        if (trapConfirmPopup) {
          ensureOnboardingActionConfirmTopLayer(trapConfirmPopup, "trap", selectedDistrict, root?.ownerDocument || document);
          showDistrictPopupModal(trapConfirmPopup);
        }
        return;
      }

      if (actionId === "occupy") {
        populateOccupyConfirmPopup(selectedDistrict);

        if (occupyConfirmPopup) {
          showDistrictPopupModal(occupyConfirmPopup);
        }
        return;
      }

      if (actionId === "attack") {
        populateAttackSetupPopup(selectedDistrict);
        openAttackPanel(selectedDistrict, { popup: attackSetupPopup });
        return;
      }

      if (actionId === "heist") {
        const ownerLabel = getDistrictOwnerLabel(selectedDistrict, interactionState);

        if (buildingActionState) {
          buildingActionState.textContent = "Heist";
          buildingActionState.classList.remove("building-action-status__state--idle");
        }

        if (buildingActionSummary) {
          buildingActionSummary.textContent = `Vykrást hráče cílí na District ${selectedDistrict.id} vlastněný hráčem ${ownerLabel}. Krade část cash/resources, ale nepřebírá vlastnictví districtu. Spy report není povinný, jen zpřesňuje preview.`;
        }

        if (buildingActionMeta) {
          buildingActionMeta.textContent = `Vykrást hráče · PvP loot · Cíl District ${selectedDistrict.id}`;
        }

        showInfo("Vykrást hráče je dostupné proti sousednímu cizímu districtu. Scout report je jen výhoda, ne podmínka.", { root });
        return;
      }

      if (actionId === "spy") {
        populateSpyConfirmPopup(selectedDistrict);
        ensureOnboardingActionConfirmTopLayer(spyConfirmPopup, "spy", selectedDistrict, root?.ownerDocument || document);
        openSpyPanel(selectedDistrict, { popup: spyConfirmPopup });
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
          showDistrictPopupModal(robberySetupPopup);
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

  const getPopulationLimitedAttackInputMaximum = (targetInput) => {
    const weaponId = targetInput?.dataset?.attackWeaponInput;
    const weaponDefinitions = getAttackSetupWeapons();
    const populationRequired = Math.max(1, Number(weaponDefinitions[weaponId]?.residents || 0));
    const ownedInventory = getResolvedWeaponInventory();
    const ownedAmount = Math.max(0, Number(ownedInventory[weaponId] || 0));
    const populationUsedByOtherWeapons = attackWeaponInputs.reduce((total, input) => {
      if (input === targetInput) {
        return total;
      }
      const otherWeaponId = input.dataset.attackWeaponInput;
      const otherPopulationRequired = Math.max(0, Number(weaponDefinitions[otherWeaponId]?.residents || 0));
      const quantity = Math.max(0, Number.parseInt(input.value || "0", 10) || 0);
      return total + quantity * otherPopulationRequired;
    }, 0);
    const availablePopulation = getAvailableAttackPopulation();
    const populationMaximum = Math.floor(Math.max(0, availablePopulation - populationUsedByOtherWeapons) / populationRequired);
    return Math.min(ownedAmount, populationMaximum);
  };

  for (const input of attackWeaponInputs) {
    input.addEventListener("input", () => {
      const maxInventory = getPopulationLimitedAttackInputMaximum(input);
      const normalizedValue = clamp(Number.parseInt(input.value || "0", 10) || 0, 0, maxInventory);
      input.value = String(normalizedValue);
      input.max = String(maxInventory);
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
        adjustStepperInput(attackInput, delta, () => getPopulationLimitedAttackInputMaximum(attackInput));
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

  const districtModalCloseHandlers = {
    closePopup, closeBuildingsPopup, closeAttackSetupPopup, closeAttackConfirmPopup,
    closeRobberySetupPopup, closeRobberyConfirmPopup, closeDefenseSetupPopup,
    closeTrapConfirmPopup, closeSpyConfirmPopup,
    closeOccupyConfirmPopup
  };

  const resultModalClosers = createDistrictResultModalClosers({
    root,
    closeResultModal,
    closePoliceActionResultModal
  });

  bindDistrictPopupPresentationControls({
    documentRef: document,
    elements: districtPopupElements,
    closeHandlers: districtModalCloseHandlers,
    resultHandlers: resultModalClosers
  });

  if (attackConfirmButton) {
    attackConfirmButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();
      const preparedContext = getPreparedAttackContext(selectedDistrict);

      if (!selectedDistrict || !preparedContext?.canConfirm) {
        return;
      }

      setPendingAttackContext(preparedContext);
      populateAttackConfirmPopup(selectedDistrict, preparedContext);
      openAttackPanel(selectedDistrict, { popup: attackConfirmPopup });
    });
  }

  if (attackConfirmFinalButton instanceof HTMLButtonElement) {
    attackConfirmFinalButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      if (isServerAuthoritativeGameplayRuntimeReady()) {
        const context = getPendingAttackContext() || getPreparedAttackContext(selectedDistrict);
        void submitServerDistrictActionCommand({
          type: "attack-district",
          payload: {
            districtId: `district:${selectedDistrict.id}`,
            sourceDistrictId: `district:${context?.sourceDistrictId || ""}`,
            weapons: context?.attackLoadout || {}
          },
          focusDistrictId: `district:${selectedDistrict.id}`
        }).then((response) => {
          if (response?.accepted) {
            closeAttackConfirmPopup();
            closeAttackSetupPopup();
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Útok server odmítl.");
          }
        });
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
        showDistrictPopupModal(robberyConfirmPopup);
      }
    });
  }

  if (robberyConfirmFinalButton instanceof HTMLButtonElement) {
    robberyConfirmFinalButton.addEventListener("click", () => {
      const selectedDistrict = getSelectedDistrict();

      if (!selectedDistrict) {
        return;
      }

      if (isServerAuthoritativeGameplayRuntimeReady()) {
        const sourceDistrictId = robberySourceSelect instanceof HTMLSelectElement ? robberySourceSelect.value : "";
        void submitServerDistrictActionCommand({
          type: "rob-district",
          payload: { targetDistrictId: `district:${selectedDistrict.id}`, sourceDistrictId: `district:${sourceDistrictId}` },
          focusDistrictId: `district:${selectedDistrict.id}`
        }).then((response) => {
          if (response?.accepted) {
            closeRobberyConfirmPopup();
            closeRobberySetupPopup();
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Krádež server odmítl.");
          }
        });
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

      if (isServerAuthoritativeGameplayRuntimeReady()) {
        void submitServerDistrictActionCommand({
          type: "place-trap",
          payload: { districtId: `district:${selectedDistrict.id}` },
          focusDistrictId: `district:${selectedDistrict.id}`
        }).then((response) => {
          if (response?.accepted) {
            closeTrapConfirmPopup();
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Past server odmítl.");
          }
        });
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

      if (isServerAuthoritativeGameplayRuntimeReady()) {
        const sourceDistrictId = getAdjacentOwnedDistrictIds(selectedDistrict)[0];
        void submitServerDistrictActionCommand({
          type: "spy-district",
          payload: { districtId: `district:${selectedDistrict.id}`, sourceDistrictId: `district:${sourceDistrictId || ""}` },
          focusDistrictId: `district:${selectedDistrict.id}`
        }).then((response) => {
          if (response?.accepted) {
            closeSpyConfirmPopup();
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Špehování server odmítl.");
          }
        });
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

      if (isServerAuthoritativeGameplayRuntimeReady()) {
        const sourceDistrictId = getAdjacentOwnedDistrictIds(selectedDistrict)[0];
        void submitServerDistrictActionCommand({
          type: "occupy-district",
          payload: { districtId: `district:${selectedDistrict.id}`, sourceDistrictId: `district:${sourceDistrictId || ""}` },
          focusDistrictId: `district:${selectedDistrict.id}`
        }).then((response) => {
          if (response?.accepted) {
            closeOccupyConfirmPopup();
            closePopup();
          } else {
            showWarning(response?.errors?.[0]?.message || "Obsazení server odmítl.");
          }
        });
        return;
      }

      applyOccupyAction(selectedDistrict);
    });
  }

  render("initial");
  ensureMissionAnimationLoop();
  scheduleBuildingsPopupOpenOnRefresh();

  Promise.all([
    loadImage(DAY_MAP_IMAGE_PATH).catch(() => null),
    loadImage(NIGHT_MAP_IMAGE_PATH).catch(() => null)
  ])
    .then(([day, night]) => {
      imageSet = { day, night };
      render("asset:map-images-loaded");
      ensureMissionAnimationLoop();
    })
    .catch(() => {
      render("asset:map-images-failed");
      ensureMissionAnimationLoop();
    });

  window.addEventListener("beforeunload", () => {
    if (spyAnimationFrameId !== null) {
      window.cancelAnimationFrame(spyAnimationFrameId);
      spyAnimationFrameId = null;
    }
    if (hoverPointerFrameId !== null) {
      window.cancelAnimationFrame(hoverPointerFrameId);
      hoverPointerFrameId = null;
    }
    if (resizeRenderFrameId !== null) {
      window.cancelAnimationFrame(resizeRenderFrameId);
      resizeRenderFrameId = null;
    }
    if (popupRefreshTimerId !== null) {
      window.clearInterval(popupRefreshTimerId);
      popupRefreshTimerId = null;
    }
    mapRenderScheduler.destroy();
    window.removeEventListener("empire:mobile-performance-mode-changed", handleMobilePerformanceModeChange);
    document.removeEventListener("visibilitychange", handleMapVisibilityChange);
    document.removeEventListener("empire:map-invalidate", handleExplicitMapInvalidation);
    document.removeEventListener("empire:gameplay-slice-rendered", handleServerSliceRendered);
    window.removeEventListener("resize", requestMapResizeRender);
    viewport.removeEventListener("empire:map-transform-changed", handleMapTransformChange);
  }, { once: true });
}

const {
  bindBorderColorToggle,
  bindGamePhaseToggle,
  bindMapPhaseToggle
} = createPhaseToggleRuntime({
  getResolvedPhaseState,
  selectors: {
    borderToggle: BORDER_TOGGLE_SELECTOR,
    gamePhaseToggle: GAME_PHASE_TOGGLE_SELECTOR,
    mapPhaseToggle: PHASE_TOGGLE_SELECTOR,
    phaseHost: MAP_PHASE_SELECTOR
  },
  syncPhaseHostFromAuthority,
  onBorderColorChange: ({ borderColor, mapPhaseHost }) => {
    mapPhaseHost.dispatchEvent(new CustomEvent("mapborderchange", { detail: { borderColor } }));
  }
});

const {
  bindBuildingActionStatus
} = createBuildingActionStatusRuntime({
  BUILDING_ACTION_EMPTY_SNAPSHOT,
  MutationObserver: typeof MutationObserver !== "undefined" ? MutationObserver : null,
  buildingActionEmptySnapshot: BUILDING_ACTION_EMPTY_SNAPSHOT,
  buildingActionRemoveSelector: BUILDING_ACTION_REMOVE_SELECTOR,
  clearInterval: typeof window !== "undefined" ? window.clearInterval.bind(window) : null,
  createBuildingActionFingerprint,
  isBuildingActionEntryOpenable,
  openCurrentBuildingActionResultModal,
  queueOrOpenResultModal,
  renderBuildingActionFeed,
  resolveBuildingActionPanel,
  scheduleBuildingActionMutationCapture,
  setInterval: typeof window !== "undefined" ? window.setInterval.bind(window) : null,
  windowRef: typeof window === "undefined" ? null : window
});
const runtimePopupBinders = createRuntimePopupBinders({
  NAV_SETTINGS_SELECTOR, SETTINGS_MODAL_SELECTOR, SETTINGS_MODAL_BACKDROP_SELECTOR, SETTINGS_MODAL_CLOSE_SELECTOR,
  SETTINGS_SAVE_SELECTOR, SETTINGS_MAP_BORDERS_SELECTOR, SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR,
  SETTINGS_MAP_REDUCED_EFFECTS_SELECTOR, SETTINGS_MAP_VISIBILITY_SELECTOR, SETTINGS_LANGUAGE_SELECTOR,
  PLAYER_PROFILE_OPEN_SELECTOR, PLAYER_POPUP_SELECTOR, PLAYER_POPUP_CARD_SELECTOR, PLAYER_POPUP_CLOSE_SELECTOR,
  PLAYER_POPUP_AVATAR_SELECTOR, PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR, PLAYER_POPUP_IDENTITY_SELECTOR,
  PLAYER_POPUP_FACTION_SELECTOR, PLAYER_POPUP_SERVER_SELECTOR, PLAYER_POPUP_START_DISTRICT_SELECTOR,
  PLAYER_POPUP_CLEAN_MONEY_SELECTOR, PLAYER_POPUP_DIRTY_MONEY_SELECTOR, PLAYER_POPUP_INFLUENCE_SELECTOR,
  PLAYER_POPUP_HEAT_SELECTOR, PLAYER_POPUP_PROTECTION_SELECTOR, PLAYER_POPUP_GANG_SELECTOR,
  PLAYER_POPUP_ALLIANCE_SELECTOR, PLAYER_POPUP_DISTRICTS_SELECTOR, ALLIANCE_POPUP_OPEN_SELECTOR,
  ALLIANCE_POPUP_SELECTOR, ALLIANCE_POPUP_CLOSE_SELECTOR, STORAGE_POPUP_OPEN_SELECTOR, STORAGE_POPUP_SELECTOR,
  STORAGE_POPUP_CLOSE_SELECTOR, NAV_LOGOUT_SELECTOR, TOPBAR_SPY_PILL_SELECTOR, TOPBAR_SPY_VALUE_SELECTOR,
  CURRENT_PLAYER_ID, FACTION_CATALOG, normalizeMapVisibilityMode, getSettingsState, applySettingsState,
  getDisplayedResourceSnapshot, getStoredRegistration, getLaunchPlayerAvatar, getCurrentPlayerDistrictSourceSnapshot,
  getCurrentPlayerLaunchStartDistrictId, syncCurrentPlayerDistrictCountDisplays, getResolvedGangState,
  getLaunchPlayerColor, createPlayerProfileViewModel, resolveRuntimeAssetUrl, formatGangHeatProtectionLabel,
  renderPlayerProfilePanel, renderStorageList, getResolvedWeaponInventory, getResolvedMaterialInventory,
  getResolvedDrugInventory, getStoredFactorySupplies, getServerStorageSummary: getGameplayStorageSummary, clearLegacyState, renderSpyResourceState,
  windowRef: typeof window === "undefined" ? null : window
});

const {
  bindAlliancePopup,
  bindLogoutActions,
  bindPlayerProfilePopup,
  bindSettingsModal,
  bindSpyResourceToggle,
  bindStoragePopup
} = runtimePopupBinders;

const {
  applyFactionPreview,
  bindFactionRegistration
} = createAuthRegistrationRuntime({
  DEFAULT_DRUG_INVENTORY,
  DEFAULT_GANG_MEMBERS,
  DEFAULT_MATERIAL_INVENTORY,
  FACTION_CATALOG,
  createCompletedRegistrationStatusViewModel,
  createDefaultMarketPriceState,
  createExistingRegistrationViewModel,
  createFactionPreviewViewModel,
  createLockedRegistrationStatusViewModel,
  createWeaponInventoryFromFaction,
  formatCurrency,
  getStoredRegistration,
  renderAuthStatus,
  renderFactionPreviewPanel,
  selectors: {
    authForm: AUTH_FORM_SELECTOR,
    factionInput: AUTH_FACTION_INPUT_SELECTOR,
    factionOption: FACTION_OPTION_SELECTOR,
    identity: AUTH_IDENTITY_SELECTOR,
    statusMount: AUTH_STATUS_MOUNT_SELECTOR
  },
  setStoredDrugInventory,
  setStoredEconomyState,
  setStoredGangState,
  setStoredMarketPriceState,
  setStoredMaterialInventory,
  setStoredProductionState,
  setStoredRegistration,
  setStoredWeaponInventory
});

function registerDirtyHeatReduction() {
  const gangState = getResolvedGangState();
  const now = Date.now();
  const recent = gangState.dirtyHeatReductionTimestamps
    .filter((timestamp) => now - Number(timestamp) <= GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS);
  recent.push(now);
  setStoredGangState({ dirtyHeatReductionTimestamps: recent });
  return recent;
}

function triggerPoliceActionFromDirtyBribe() {
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
}

const {
  bindGangWantedStatus
} = createGangWantedStatusRuntime({
  cleanActionCost: GANG_HEAT_CLEAN_COST,
  dirtyActionCost: GANG_HEAT_DIRTY_COST,
  influenceActionCost: GANG_HEAT_INFLUENCE_COST,
  formatGangHeatProtectionLabel,
  gangHeatTiers: GANG_HEAT_TIERS,
  getPoliceTierShortEffect,
  getResolvedDistrictPoliceActions,
  getResolvedEconomyState,
  normalizeGangHeatJournal,
  renderHeatBadge,
  renderWantedFeedback,
  renderWantedPanel,
  resolvePoliceHeatFeedback,
  resolveGangHeatTier,
  syncGangHeatDecay,
  onDirtyAction: ({ renderFeedback, root, syncWantedStatus }) => {
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
  },
  onCleanAction: ({ renderFeedback, root, syncWantedStatus }) => {
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
  },
  onInfluenceAction: ({ renderFeedback, root, syncWantedStatus }) => {
    const gangState = getResolvedGangState();
    const currentInfluence = Math.max(0, Math.floor(Number(gangState.influence || 0)));
    if (currentInfluence < GANG_HEAT_INFLUENCE_COST) {
      renderFeedback("warning", `Chybí ${GANG_HEAT_INFLUENCE_COST - currentInfluence} vlivu.`);
      syncWantedStatus();
      return;
    }

    setGangInfluenceValue(currentInfluence - GANG_HEAT_INFLUENCE_COST);
    const nextHeat = setGangHeatValue(getResolvedGangState().heat - GANG_HEAT_INFLUENCE_REDUCTION, {
      reason: "Vlivové kontakty stáhly policejní tlak.",
      type: "fall"
    });
    applyTopbarEconomy(root);
    renderFeedback("success", `Heat snížen na ${nextHeat}. Vlivové kontakty stáhly policejní tlak.`);
    syncWantedStatus();
  },
  onClearLog: ({ renderFeedback, syncWantedStatus }) => {
    clearGangHeatJournal();
    renderFeedback("success", "Heat log je vyčištěný.");
    syncWantedStatus();
  },
  selectors: {
    cleanAction: WANTED_POPUP_CLEAN_ACTION_SELECTOR,
    clearLog: WANTED_POPUP_CLEAR_LOG_SELECTOR,
    dirtyAction: WANTED_POPUP_DIRTY_ACTION_SELECTOR,
    influenceAction: WANTED_POPUP_INFLUENCE_ACTION_SELECTOR,
    gangHeat: GANG_HEAT_SELECTOR,
    gangStar: GANG_STAR_SELECTOR,
    gangStars: GANG_STARS_SELECTOR,
    popup: WANTED_POPUP_SELECTOR,
    popupClose: WANTED_POPUP_CLOSE_SELECTOR,
    popupDescription: WANTED_POPUP_DESCRIPTION_SELECTOR,
    popupFeedback: WANTED_POPUP_FEEDBACK_SELECTOR,
    popupFallList: WANTED_POPUP_FALL_LIST_SELECTOR,
    popupHeat: WANTED_POPUP_HEAT_SELECTOR,
    popupLevel: WANTED_POPUP_LEVEL_SELECTOR,
    popupLevels: WANTED_POPUP_LEVELS_SELECTOR,
    popupProtection: WANTED_POPUP_PROTECTION_SELECTOR,
    popupRiseList: WANTED_POPUP_RISE_LIST_SELECTOR,
    popupTier: WANTED_POPUP_TIER_SELECTOR
  }
});
const {
  bindRegisteredPlayerState
} = createRegisteredPlayerStateRuntime({
  applyTopbarEconomy,
  factionCatalog: FACTION_CATALOG,
  gangHeatSelector: GANG_HEAT_SELECTOR,
  getCurrentPlayerDistrictSourceSnapshot,
  getCurrentPlayerLaunchStartDistrictId,
  getDisplayedResourceSnapshot,
  getRegistrationAccentColor,
  getResolvedGangState,
  getStoredRegistration,
  normalizeRuntimeHexColor,
  playerPopupFactionSelector: PLAYER_POPUP_FACTION_SELECTOR,
  playerPopupGangSelector: PLAYER_POPUP_GANG_SELECTOR,
  playerPopupIdentitySelector: PLAYER_POPUP_IDENTITY_SELECTOR,
  playerPopupServerSelector: PLAYER_POPUP_SERVER_SELECTOR,
  playerPopupStartDistrictSelector: PLAYER_POPUP_START_DISTRICT_SELECTOR,
  renderGangMembersState,
  renderSpyResourceState,
  syncCurrentPlayerDistrictCountDisplays,
  topbarInfluenceSelector: TOPBAR_INFLUENCE_SELECTOR
});
const {
  bindFactoryPopup
} = createFactoryPopupRuntime({
  allowLegacyLocalProduction: isLocalDemoGameplayExecutionMode(),
  allowLegacyProductionUpgrade: isLocalDemoGameplayExecutionMode(),
  isServerAuthoritativeGameplayRuntimeReady,
  FACTORY_CONFIG,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP,
  appendBuildingActionResultEntry,
  applyTopbarEconomy,
  createFactoryBuildingInfoViewModel,
  buildFactoryDashboardViewModel,
  collectFactoryOutputsToSupplies,
  createStorageCollectResultPayload,
  documentRef: typeof document === "undefined" ? null : document,
  formatCurrency,
  formatDurationLabel,
  getFactoryLevelMultiplier,
  getFactoryUpgradeCost,
  getResolvedEconomyState,
  getStoredFactoryState,
  getStoredFactorySupplies,
  normalizeProductionResourceColorKey,
  renderFactoryDashboardPanel,
  renderFactoryBuildingInfoPanel,
  renderServerFactorySlotList,
  renderFactorySlotList,
  selectors: {
    close: FACTORY_POPUP_CLOSE_SELECTOR,
    collect: FACTORY_COLLECT_SELECTOR,
    combat: FACTORY_RESOURCE_COMBAT_SELECTOR,
    effectsLabel: FACTORY_EFFECTS_LABEL_SELECTOR,
    headerLevel: FACTORY_HEADER_LEVEL_SELECTOR,
    level: FACTORY_LEVEL_SELECTOR,
    metal: FACTORY_RESOURCE_METAL_SELECTOR,
    multiplier: FACTORY_MULTIPLIER_SELECTOR,
    open: FACTORY_POPUP_OPEN_SELECTOR,
    ownedCount: FACTORY_OWNED_COUNT_SELECTOR,
    panel: FACTORY_PANEL_SELECTOR,
    popup: FACTORY_POPUP_SELECTOR,
    slotList: FACTORY_SLOT_LIST_SELECTOR,
    supplyCombat: FACTORY_SUPPLY_COMBAT_SELECTOR,
    supplyMetal: FACTORY_SUPPLY_METAL_SELECTOR,
    supplyTech: FACTORY_SUPPLY_TECH_SELECTOR,
    tab: FACTORY_TAB_SELECTOR,
    tech: FACTORY_RESOURCE_TECH_SELECTOR,
    upgrade: FACTORY_UPGRADE_SELECTOR,
    upgradeCost: FACTORY_UPGRADE_COST_SELECTOR
  },
  setBuildingActionFeedback,
  setStoredEconomyState,
  setStoredFactoryState,
  setStoredFactorySupplies,
  getServerFactoryReadModel,
  refreshServerFactoryReadModel: () => {
    const districtId = latestGameplaySliceReadModel?.district?.districtId
      || latestGameplaySliceReadModel?.player?.homeDistrictId
      || null;
    return districtId ? loadServerGameplaySliceForDistrict(districtId, { forceRefresh: true }) : null;
  },
  getServerTickRateMs,
  submitServerFactoryCommand,
  syncBuildingDetailTopbarVisibility,
  syncFactoryProduction
});





const {
  bindCityStatusBar
} = createCityStatusBarRuntime({
  minuteStep: CITY_CLOCK_MINUTES_PER_TICK,
  selectors: {
    clock: CITY_CLOCK_SELECTOR,
    dayPhase: CITY_DAY_PHASE_SELECTOR,
    gamePhase: CITY_GAME_PHASE_SELECTOR,
    phaseHost: MAP_PHASE_SELECTOR,
    production: CITY_PRODUCTION_SELECTOR,
    status: CITY_STATUS_SELECTOR
  },
  syncPhaseHostFromAuthority,
  tickMs: CITY_CLOCK_TICK_MS,
  shouldRunLocalTick: shouldRunLocalGameplayRuntime,
  getTickIntervalMs: (baseIntervalMs) => getRuntimePerformanceDiagnostics()?.getLocalTickIntervalMs?.(baseIntervalMs) || baseIntervalMs,
  onLocalTickActiveChange: (active) => getRuntimePerformanceDiagnostics()?.setLocalTickActive?.("legacy-city-clock", active),
  recordLocalTick: () => getRuntimePerformanceDiagnostics()?.recordLocalTick?.(),
  onInitialSync: ({ root }) => {
    syncDevOnlyDestroyedDistrictState();
    syncStartPhaseDistrictIncome(root);
    syncGangAutoPolicePressure();
    syncDevOnlyPolicePressure();
  },
  onTick: ({ getMapPhaseFromClock, minuteStep, root, updatePhaseStatus }) => {
    syncDevOnlyDestroyedDistrictState();
    syncStartPhaseDistrictIncome(root);

    const worldState = getResolvedWorldState();
    const currentPhaseState = worldState.phaseState || getResolvedPhaseState();
    const nextCityMinutes = ((currentPhaseState.cityMinutes ?? DEFAULT_CITY_MINUTES) + minuteStep) % (24 * 60);

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
  },
  onGamePhaseChange: ({ root }) => {
    syncStartPhaseDistrictIncome(root);
  }
});

function hydrateInitialState(root = getDefaultRuntimeRoot()) {
  const resolvedRoot = resolveRuntimeRoot(root);

  if (resolvedRoot) {
    ensureStartDistrictRecovery();
    syncDevOnlyDestroyedDistrictState();
    syncPhaseHostFromAuthority(resolvedRoot.querySelector(MAP_PHASE_SELECTOR));
  }

  return {
    root: resolvedRoot,
    session: readRuntimeSnapshotValue("authority session", () => getAuthoritySession(), null),
    registration: readRuntimeSnapshotValue("registration", () => getStoredRegistration(), null),
    economy: readRuntimeSnapshotValue("economy", () => getResolvedEconomyState(), null),
    gang: readRuntimeSnapshotValue("gang", () => getResolvedGangState(), null),
    world: readRuntimeSnapshotValue("world", () => getResolvedWorldState(), null),
    spy: readRuntimeSnapshotValue("spy", () => getResolvedSpyState(), null),
    selectedDistrict: readRuntimeSnapshotValue(
      "selected district",
      () => window.empireStreetsDistrictState?.getSelectedDistrict?.() || null,
      null
    )
  };
}

function forceGameHtmlRefreshLivePhase(root = getDefaultRuntimeRoot()) {
  const resolvedRoot = resolveRuntimeRoot(root);
  if (!resolvedRoot) {
    return false;
  }

  const worldState = getResolvedWorldState();
  const phaseState = worldState.phaseState || {};
  const ownedDistrictIds = Array.isArray(worldState.ownedDistrictIds)
    ? worldState.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
  const previousDestroyedDistrictIds = Array.isArray(worldState.destroyedDistrictIds)
    ? worldState.destroyedDistrictIds.map(Number).filter(Boolean)
    : [];
  const destroyedDistrictIds = new Set(previousDestroyedDistrictIds);
  const startDistrictId = Number(getCurrentPlayerLaunchStartDistrictId() || 1);
  const isAlreadyLive = normalizeRuntimeGamePhase(phaseState.gamePhase) === "live";
  destroyedDistrictIds.add(DEV_ONLY_DESTROYED_DISTRICT_ID);
  const shouldKeepCurrentPlayerStartDistrict = startDistrictId > 0
    && !destroyedDistrictIds.has(startDistrictId)
    && (!isAlreadyLive || ownedDistrictIds.length <= 0);
  const liveOwnedDistrictIds = ownedDistrictIds.filter((districtId) => districtId !== DEV_ONLY_DESTROYED_DISTRICT_ID);
  const nextOwnedDistrictIds = shouldKeepCurrentPlayerStartDistrict
    ? Array.from(new Set([...liveOwnedDistrictIds, startDistrictId]))
    : liveOwnedDistrictIds;
  const nextDestroyedDistrictIds = Array.from(destroyedDistrictIds);

  if (
    isAlreadyLive
    && nextOwnedDistrictIds.length === ownedDistrictIds.length
    && previousDestroyedDistrictIds.includes(DEV_ONLY_DESTROYED_DISTRICT_ID)
  ) {
    return false;
  }

  setStoredWorldState({
    ...worldState,
    ownedDistrictIds: nextOwnedDistrictIds,
    destroyedDistrictIds: nextDestroyedDistrictIds,
    devOnlyScenarioDestroyedDistrictId: DEV_ONLY_DESTROYED_DISTRICT_ID,
    phaseState: {
      ...phaseState,
      gamePhase: "live"
    }
  });
  syncPhaseHostFromAuthority(resolvedRoot.querySelector(MAP_PHASE_SELECTOR));
  return true;
}

function refreshAllUi(state = null) {
  const snapshot = state?.root ? state : hydrateInitialState(resolveRuntimeRoot(state));
  const root = snapshot.root;

  if (!root) {
    return snapshot;
  }

  getRuntimePerformanceDiagnostics()?.recordClientStateRecompute?.("legacy-refresh-all-ui");

  const runRefresh = (label, refresh) => {
    try {
      refresh();
    } catch (error) {
      warnRuntimeOrchestrator(`UI refresh failed: ${label}`, error);
    }
  };

  runRefresh("resources panel", () => applyTopbarEconomy(root, { instant: true }));
  runRefresh("gang resources", () => renderGangMembersState(root));
  runRefresh("spy resource", () => renderSpyResourceState(root, { instant: true }));
  runRefresh("selected district panel", () => {
    window.empireStreetsDistrictState?.refreshSelectedDistrictPanel?.();
  });
  runRefresh("bound popup/profile listeners", () => {
    document.dispatchEvent(new CustomEvent("empire:runtime-refresh", { detail: { state: snapshot } }));
  });
  runRefresh("free onboarding", () => {
    onboardingBridgesByRoot.get(root)?.update?.({ type: "runtime:refresh" });
  });
  runRefresh("police feedback", () => {
    policeHeatBridgesByRoot.get(root)?.render?.({ type: "runtime:refresh" });
  });

  return snapshot;
}

function createDevOnlyOnboardingAllianceBoard() {
  const board = DEV_ONLY_ONBOARDING_START_STATE.allianceBoard || {};
  return {
    maxAllianceSize: Math.max(1, Math.floor(Number(board.maxAllianceSize || 4)) || 4),
    currentPlayerId: String(CURRENT_PLAYER_ID),
    activeAlliance: null,
    allianceBadgesByPlayerId: {},
    publicAlliances: [],
    incomingInvites: [],
    eligibleInviteTargets: [],
    canCreateAlliance: board.canCreateAlliance === true,
    createDisabledReason: board.createDisabledReason || "ONBOARDING_NO_ALLIANCE",
    disableDevOnlyActiveAlliance: true
  };
}

function resetDevOnlyOnboardingAllianceState() {
  const allianceBoard = createDevOnlyOnboardingAllianceBoard();
  try {
    window.localStorage?.removeItem?.(LOCAL_ALLIANCE_KEY);
  } catch (_error) {
    // Onboarding must not inherit a deprecated local alliance preview.
  }
  updateStoredPreviewSession((session) => ({
    ...session,
    allianceBoard
  }));
  document.dispatchEvent(new CustomEvent("empire:onboarding-alliance-reset", { detail: { allianceBoard } }));
  window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  return allianceBoard;
}

function completeDevOnlyOnboarding(root = getDefaultRuntimeRoot(), context = {}) {
  forceGameHtmlRefreshLivePhase(root);

  const resolvedRoot = resolveRuntimeRoot(root || getDefaultRuntimeRoot());
  if (resolvedRoot) {
    syncPhaseHostFromAuthority(resolvedRoot.querySelector(MAP_PHASE_SELECTOR));
    refreshAllUi({ root: resolvedRoot });
  }

  if (context?.progress?.skipped === true && typeof window !== "undefined" && typeof window.location?.reload === "function") {
    window.location.reload();
  }

  return true;
}

function applyDevOnlyOnboardingStartState(root = getDefaultRuntimeRoot()) {
  const amount = Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.storageAmount || 0)));
  const worldState = getResolvedWorldState();
  const phaseState = worldState.phaseState || {};
  const ownedDistrictIds = Array.isArray(DEV_ONLY_ONBOARDING_START_STATE.world?.ownedDistrictIds)
    ? DEV_ONLY_ONBOARDING_START_STATE.world.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
  const onboardingStartDistrictId = ownedDistrictIds[0] || 1;
  const nextTrapById = { ...(worldState.districtTrapById || {}) };
  for (const [districtId, trap] of Object.entries(nextTrapById)) {
    if (trap?.isArmed && Number(trap.ownerId) === CURRENT_PLAYER_ID) {
      delete nextTrapById[districtId];
    }
  }
  const nextWorldState = {
    ...worldState,
    ownedDistrictIds,
    destroyedDistrictIds: (worldState.destroyedDistrictIds || [])
      .map(Number)
      .filter((districtId) => districtId && !ownedDistrictIds.includes(districtId)),
    districtPoliceActionById: {},
    districtTrapById: nextTrapById,
    phaseState: {
      ...phaseState,
      gamePhase: DEV_ONLY_ONBOARDING_START_STATE.world?.gamePhase === "launch" ? "launch" : "live"
    }
  };
  const weapons = createFixedInventoryAmountMap(DEFAULT_WEAPON_INVENTORY, amount);
  const materials = createFixedInventoryAmountMap(DEFAULT_MATERIAL_INVENTORY, amount);
  const drugs = createFixedInventoryAmountMap(DEFAULT_DRUG_INVENTORY, amount);
  const factorySupplies = createFixedFactorySupplyAmountMap(amount);

  resetStartPhaseResourceSimulationState();
  updateStoredPreviewSession((session) => ({
    ...session,
    registration: session.registration
      ? {
          ...session.registration,
          preferredStartDistrictId: onboardingStartDistrictId,
          startDistrictId: onboardingStartDistrictId
        }
      : session.registration
  }));
  setStoredEconomyState({
    cleanMoney: Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.economy?.cleanMoney || 0))),
    dirtyMoney: Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.economy?.dirtyMoney || 0)))
  });
  setStoredGangState({
    members: Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.gang?.members || 0))),
    influence: Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.gang?.influence || 0))),
    heat: Math.max(0, Math.floor(Number(DEV_ONLY_ONBOARDING_START_STATE.gang?.heat || 0))),
    alliance: null,
    allianceId: null,
    activeAllianceId: null,
    policeRaidProtectionUntil: 0,
    autoPoliceNextActionAt: 0,
    heatJournal: [],
    dirtyHeatReductionTimestamps: [],
    lastHeatDecayAt: new Date().toISOString()
  });
  resetDevOnlyOnboardingAllianceState();
  setStoredWeaponInventory(weapons);
  setStoredMaterialInventory(materials);
  setStoredDrugInventory(drugs);
  setStoredFactorySupplies(factorySupplies);
  setStoredWorldState(nextWorldState);

  const resolvedRoot = resolveRuntimeRoot(root || getDefaultRuntimeRoot());
  if (resolvedRoot) {
    syncPhaseHostFromAuthority(resolvedRoot.querySelector(MAP_PHASE_SELECTOR));
    renderStorageList({ summary: getGameplayStorageSummary(), weapons, materials, drugs, factorySupplies }, { root: resolvedRoot });
    refreshAllUi({ root: resolvedRoot });
  }

  return getAuthoritySession();
}

function resetOnboardingSpyTargetState(root = getDefaultRuntimeRoot()) {
  const result = resetSpyDistrictState(ONBOARDING_SPY_TARGET_DISTRICT_ID);
  if (!result.changed) {
    return false;
  }

  for (const missionId of result.removedMissionIds || []) {
    const timerId = spyMissionTimers.get(missionId);
    if (timerId === undefined) {
      continue;
    }
    const clearTimer = typeof window !== "undefined" && typeof window.clearTimeout === "function"
      ? window.clearTimeout.bind(window)
      : (typeof clearTimeout === "function" ? clearTimeout : null);
    clearTimer?.(timerId);
    spyMissionTimers.delete(missionId);
  }

  const resolvedRoot = resolveRuntimeRoot(root || getDefaultRuntimeRoot());
  if (resolvedRoot) {
    renderSpyResourceState(resolvedRoot, { instant: true });
    window.empireStreetsDistrictState?.refreshSelectedDistrictPanel?.();
  }

  return true;
}

function resetOnboardingTrapTargetState(root = getDefaultRuntimeRoot()) {
  const worldState = getResolvedWorldState();
  const ownedDistrictIds = [ONBOARDING_ATTACK_TARGET_DISTRICT_ID];
  const destroyedDistrictIds = (worldState.destroyedDistrictIds || [])
    .map(Number)
    .filter((districtId) => districtId && districtId !== ONBOARDING_ATTACK_TARGET_DISTRICT_ID);
  const nextPoliceActionById = { ...(worldState.districtPoliceActionById || {}) };
  const nextTrapById = { ...(worldState.districtTrapById || {}) };

  delete nextPoliceActionById[ONBOARDING_ATTACK_TARGET_DISTRICT_ID];
  delete nextPoliceActionById[String(ONBOARDING_ATTACK_TARGET_DISTRICT_ID)];

  for (const [districtId, trap] of Object.entries(nextTrapById)) {
    if (trap?.isArmed && Number(trap.ownerId) === CURRENT_PLAYER_ID) {
      delete nextTrapById[districtId];
    }
  }

  setStoredWorldState({
    ...worldState,
    ownedDistrictIds,
    destroyedDistrictIds,
    districtPoliceActionById: nextPoliceActionById,
    districtTrapById: nextTrapById,
    devOnlyScenarioDestroyedDistrictId: Number(worldState.devOnlyScenarioDestroyedDistrictId) === ONBOARDING_ATTACK_TARGET_DISTRICT_ID
      ? null
      : worldState.devOnlyScenarioDestroyedDistrictId
  });

  const resolvedRoot = resolveRuntimeRoot(root || getDefaultRuntimeRoot());
  if (resolvedRoot) {
    window.empireStreetsDistrictState?.refreshSelectedDistrictPanel?.();
  }

  return true;
}

function getActiveOnboardingStepId(documentRef = document) {
  return String(documentRef?.documentElement?.dataset?.onboardingStep || documentRef?.body?.dataset?.onboardingStep || "");
}

function isOnboardingDistrictClickAllowed(district, documentRef = document) {
  const activeStepId = getActiveOnboardingStepId(documentRef);
  if (activeStepId === "spy") {
    return Number(district?.id || 0) === ONBOARDING_SPY_TARGET_DISTRICT_ID;
  }
  if (activeStepId === "attack-order") {
    return Number(district?.id || 0) === ONBOARDING_ATTACK_TARGET_DISTRICT_ID;
  }
  return true;
}

function isOnboardingDistrictPopupTopLayerTarget(district, documentRef = document) {
  const activeStepId = getActiveOnboardingStepId(documentRef);
  const districtId = Number(district?.id || 0);
  if (activeStepId === "spy") {
    return districtId === ONBOARDING_SPY_TARGET_DISTRICT_ID;
  }
  if (activeStepId === "attack-order") {
    return districtId === ONBOARDING_ATTACK_TARGET_DISTRICT_ID;
  }
  return false;
}

function ensureOnboardingDistrictPopupTopLayer(popupElement, district, documentRef = document) {
  if (!isOnboardingDistrictPopupTopLayerTarget(district, documentRef)) {
    return false;
  }

  const body = documentRef?.body || popupElement?.ownerDocument?.body || null;
  if (!(popupElement instanceof HTMLElement) || !body || popupElement.parentElement === body) {
    return false;
  }

  body.append(popupElement);
  return true;
}

function getOnboardingDistrictActionHint(district, documentRef = document) {
  const activeStepId = getActiveOnboardingStepId(documentRef);
  const districtId = Number(district?.id || 0);
  if (activeStepId === "spy" && districtId === ONBOARDING_SPY_TARGET_DISTRICT_ID) {
    return {
      actionId: "spy",
      label: "Špehovat"
    };
  }
  if (activeStepId === "attack-order" && districtId === ONBOARDING_ATTACK_TARGET_DISTRICT_ID) {
    return {
      actionId: "trap",
      label: "Přesunout past",
      requiredTrapState: "move"
    };
  }
  return null;
}

function applyOnboardingDistrictActionHint(district, elements = {}, documentRef = document) {
  const actionMount = elements.actionsMount || null;
  if (!actionMount?.querySelectorAll) {
    return false;
  }

  const hint = getOnboardingDistrictActionHint(district, documentRef);
  const actionButtons = actionMount.querySelectorAll("[data-district-action-id]");
  let changed = false;
  for (const button of actionButtons) {
    const buttonActionId = String(button.dataset?.districtActionId || "");
    const hasRequiredTrapState = !hint?.requiredTrapState || button.dataset?.districtTrapState === hint.requiredTrapState;
    const shouldPulse = Boolean(hint && buttonActionId === hint.actionId && hasRequiredTrapState);
    const isTrapHint = buttonActionId === "trap";
    if (button.dataset.onboardingActionHint === "true" !== shouldPulse) {
      changed = true;
    }
    if (shouldPulse) {
      button.dataset.onboardingActionHint = "true";
      if (isTrapHint) {
        button.dataset.onboardingTrapMoveHint = "true";
      }
      button.setAttribute("aria-label", hint.label);
    } else {
      delete button.dataset.onboardingActionHint;
      if (isTrapHint) {
        delete button.dataset.onboardingTrapMoveHint;
      }
      if (button.getAttribute?.("aria-label") === "Špehovat" || button.getAttribute?.("aria-label") === "Přesunout past") {
        button.removeAttribute("aria-label");
      }
    }
  }
  return changed;
}

function isOnboardingActionConfirmTopLayerTarget(actionId, district, documentRef = document) {
  const hint = getOnboardingDistrictActionHint(district, documentRef);
  return Boolean(hint && hint.actionId === String(actionId || ""));
}

function ensureOnboardingActionConfirmTopLayer(confirmPopupElement, actionId, district, documentRef = document) {
  if (!isOnboardingActionConfirmTopLayerTarget(actionId, district, documentRef)) {
    return false;
  }

  const body = documentRef?.body || confirmPopupElement?.ownerDocument?.body || null;
  if (!(confirmPopupElement instanceof HTMLElement) || !body) {
    return false;
  }

  confirmPopupElement.dataset.onboardingActionConfirmLayer = String(actionId || "");
  confirmPopupElement.dataset.districtId = String(district?.id || "");
  if (confirmPopupElement.parentElement !== body) {
    body.append(confirmPopupElement);
  }
  return true;
}

function createFreeSessionUiContext(root) {
  const session = getAuthoritySession();
  const world = getResolvedWorldState();
  const gameplaySlice = latestGameplaySliceReadModel || null;
  const player = gameplaySlice?.player || null;
  return {
    registration: getStoredRegistration(),
    mode: player?.mode || gameplaySlice?.mode?.id || "dev-only",
    gameplaySlice,
    player,
    elimination: player?.elimination || gameplaySlice?.elimination || null,
    finalLockdown: player?.finalLockdown || null,
    world,
    phase: world.phaseState,
    economy: getResolvedEconomyState(),
    gang: getResolvedGangState(),
    production: getResolvedProductionState(),
    policeActions: getResolvedDistrictPoliceActions(),
    inventory: session.inventory || {},
    spy: {
      ...getResolvedSpyState(),
      intel: getResolvedSpyIntel()
    },
    spyIntel: getResolvedSpyIntel(),
    attackOrders: getStoredAttackOrders(),
    selectedDistrict: window.empireStreetsDistrictState?.getSelectedDistrict?.() || null,
    districtState: window.empireStreetsDistrictState?.getState?.() || null,
    districtStateApi: window.empireStreetsDistrictState || null,
    districts: window.empireStreetsDistrictState?.getAllDistricts?.() || [],
    root
  };
}

function ensureStartDistrictRecovery() {
  const registration = getStoredRegistration();
  const startDistrictId = Number.parseInt(String(registration?.startDistrictId || ""), 10) || 0;
  if (!startDistrictId) {
    return false;
  }

  const worldState = getResolvedWorldState();
  const ownedDistrictIds = Array.isArray(worldState.ownedDistrictIds)
    ? worldState.ownedDistrictIds.map(Number).filter(Boolean)
    : [];
  if (ownedDistrictIds.includes(startDistrictId)) {
    return false;
  }

  setStoredWorldState({
    ...worldState,
    ownedDistrictIds: Array.from(new Set([...ownedDistrictIds, startDistrictId]))
  });
  return true;
}

function bindFreeSessionOnboarding(root) {
  if (!root || onboardingBridgesByRoot.has(root)) {
    return false;
  }

  const bridge = createOnboardingBridge({
    root,
    documentRef: document,
    getContext: () => createFreeSessionUiContext(root),
    onWelcomeStart: () => applyDevOnlyOnboardingStartState(root),
    onComplete: (context) => completeDevOnlyOnboarding(root, context),
    onStepEnter: (stepId) => {
      if (stepId === "spy") {
        return resetOnboardingSpyTargetState(root);
      }
      if (stepId === "attack-order") {
        return resetOnboardingTrapTargetState(root);
      }
      return false;
    }
  });
  onboardingBridgesByRoot.set(root, bridge);
  bridge.init();
  return true;
}

function getFreeSessionOnboardingProgress(root = null) {
  const resolvedRoot = resolveRuntimeRoot(root || getDefaultRuntimeRoot());
  if (!resolvedRoot) {
    return null;
  }
  return onboardingBridgesByRoot.get(resolvedRoot)?.getProgress?.() || null;
}

function bindEliminationResultPopupOverlay(root) {
  if (!root || eliminationResultPopupsByRoot.has(root)) {
    return false;
  }

  const popup = bindEliminationResultPopup(root, {
    onClose: () => renderNextPendingResultModal(root)
  });
  if (!popup) {
    return false;
  }

  eliminationResultPopupsByRoot.set(root, popup);
  return true;
}

function bindEliminationPurgeWindow(root) {
  if (!root || eliminationPurgePanelsByRoot.has(root)) {
    return false;
  }

  root.ownerDocument?.addEventListener?.("empire:gameplay-slice-rendered", (event) => {
    latestGameplaySliceReadModel = event?.detail?.gameplaySlice || null;
  });
  const panel = bindEliminationPurgePanel(root, {
    getGameplaySlice: () => latestGameplaySliceReadModel,
    getPlayerView: () => latestGameplaySliceReadModel?.player || createFreeSessionUiContext(root),
    onCountdownElapsed: (result) => {
      const resolvedResult = handleEliminationCountdownResolved(root, result);
      queueOrOpenResultModal(root, "elimination", resolvedResult);
      return resolvedResult;
    },
    openEliminationResultPopup: (result, trigger) => eliminationResultPopupsByRoot.get(root)?.open?.(result, trigger)
  });
  if (!panel) {
    return false;
  }
  eliminationPurgePanelsByRoot.set(root, panel);
  return true;
}

function bindEliminationCountdownWarningOverlay(root) {
  if (!root || eliminationCountdownWarningsByRoot.has(root)) {
    return false;
  }

  const warning = bindEliminationCountdownWarning(root, {
    getPlayerView: () => latestGameplaySliceReadModel?.player || createFreeSessionUiContext(root),
    onCountdownElapsed: (result) => {
      const resolvedResult = handleEliminationCountdownResolved(root, result);
      queueOrOpenResultModal(root, "elimination", resolvedResult);
      return resolvedResult;
    }
  });
  if (!warning) {
    return false;
  }
  eliminationCountdownWarningsByRoot.set(root, warning);
  return true;
}

function bindPoliceHeatFeedback(root) {
  if (!root || policeHeatBridgesByRoot.has(root)) {
    return false;
  }

  const bridge = createPoliceHeatBridge({
    root,
    documentRef: document,
    getState: () => {
      const gangState = getResolvedGangState();
      return {
        gangState,
        heatLevel: resolveGangHeatTier(gangState.heat),
        policeActions: getResolvedDistrictPoliceActions()
      };
    }
  });
  policeHeatBridgesByRoot.set(root, bridge);
  bridge.init();
  return true;
}

function bindEventRumorFeed(root) {
  if (!root || eventRumorBridgesByRoot.has(root)) {
    return false;
  }

  const bridge = createEventRumorBridge({
    root,
    documentRef: document,
    appendBuildingActionResultEntry,
    getLaunchPlayerName,
    getState: () => createFreeSessionUiContext(root)
  });
  eventRumorBridgesByRoot.set(root, bridge);
  bridge.init();
  return true;
}

function handleActionResult(root, result = {}) {
  const resolvedRoot = resolveRuntimeRoot(root);
  if (!resolvedRoot) {
    return false;
  }

  const normalizedResult = normalizeActionResult(result);
  appendBuildingActionResultEntry(
    resolvedRoot,
    normalizedResult.kind,
    normalizedResult.payload,
    normalizedResult.snapshot,
    normalizedResult.options
  );
  return true;
}

function getRuntimeDistrictApi() {
  return typeof window !== "undefined" ? window.empireStreetsDistrictState || null : null;
}

function getPublicRuntimeRoot() {
  return resolveRuntimeRoot(getDefaultRuntimeRoot());
}

function isClickableRuntimeElement(element) {
  return Boolean(
    element
    && typeof element.click === "function"
    && element.hidden !== true
    && element.disabled !== true
    && element.getAttribute?.("aria-hidden") !== "true"
  );
}

function clickFirstRuntimeElement(root, selectors = []) {
  if (!root) {
    return false;
  }

  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll?.(selector) || [])) {
      if (isClickableRuntimeElement(element)) {
        element.click();
        return true;
      }
    }
  }

  return false;
}

function publicSelectDistrict(districtId) {
  return getRuntimeDistrictApi()?.selectDistrict?.(districtId) || false;
}

function publicOpenDistrict(districtId) {
  return getRuntimeDistrictApi()?.openDistrict?.(districtId) || false;
}

function publicOpenBuildingDetail(districtIdOrBuildingName, buildingName = "", options = {}) {
  return getRuntimeDistrictApi()?.openBuildingDetail?.(districtIdOrBuildingName, buildingName, options) || false;
}

function resolveDevBuildingCardAutoOpenKey() {
  if (typeof window === "undefined") {
    return "";
  }
  if (window.navigator?.webdriver || String(window.name || "").includes("empire-e2e-")) {
    return "";
  }
  const params = new URLSearchParams(window.location.search || "");
  const requested = params.get("devBuildingCard")
    || params.get("openBuildingCard")
    || params.get("buildingCard")
    || "";
  const normalized = normalizeBuildingLookupKey(requested);
  if (!normalized || normalized === "0" || normalized === "false" || normalized === "off") {
    return "";
  }
  if (normalized === "1" || normalized === "true" || normalized === "clinic") {
    return "klinika";
  }
  return normalized;
}

function tryOpenDevBuildingCardOnInit() {
  const targetBuildingKey = resolveDevBuildingCardAutoOpenKey();
  if (!targetBuildingKey) {
    return false;
  }

  const districtApi = getRuntimeDistrictApi();
  if (!districtApi?.getDistrictById || !districtApi?.getDistrictBuildingProfile || !districtApi?.getAllDistricts) {
    return false;
  }

  const candidateDistricts = [];
  const seenDistrictIds = new Set();

  const addDistrict = (district) => {
    const districtId = Number(district?.id || 0);
    if (!districtId || seenDistrictIds.has(districtId)) {
      return;
    }
    seenDistrictIds.add(districtId);
    candidateDistricts.push(district);
  };

  addDistrict(districtApi.getSelectedDistrict?.() || null);
  for (const districtId of normalizeWorldOwnedDistrictIds(getResolvedWorldState())) {
    addDistrict(districtApi.getDistrictById(districtId));
  }
  for (const district of districtApi.getAllDistricts()) {
    addDistrict(district);
  }

  for (const district of candidateDistricts) {
    const buildingProfile = districtApi.getDistrictBuildingProfile(district.id);
    const targetBuilding = Array.isArray(buildingProfile?.buildings)
      ? buildingProfile.buildings.find((building) => normalizeBuildingLookupKey(building?.baseName) === targetBuildingKey)
      : null;

    if (!targetBuilding?.baseName) {
      continue;
    }

    return publicOpenBuildingDetail(district.id, targetBuilding.baseName, {
      displayName: targetBuilding.displayName || targetBuilding.baseName,
      preferGenericDetail: true
    });
  }

  return false;
}

function scheduleDevBuildingCardOpen(attempt = 0) {
  if (tryOpenDevBuildingCardOnInit()) {
    return true;
  }

  if (attempt >= 8 || typeof window === "undefined" || typeof window.setTimeout !== "function") {
    return false;
  }

  window.setTimeout(() => {
    scheduleDevBuildingCardOpen(attempt + 1);
  }, 80);
  return false;
}

function publicCollectProduction() {
  const root = getPublicRuntimeRoot();
  const clicked = clickFirstRuntimeElement(root, [
    "[data-district-building-detail-popup]:not([hidden]) [data-district-building-detail-collect]",
    PRODUCTION_BUILDING_COLLECT_SELECTOR,
    FACTORY_COLLECT_SELECTOR
  ]);
  if (clicked) {
    document.dispatchEvent(new CustomEvent("empire:production-collected", {
      detail: {
        type: "production:collected",
        source: "public-handler"
      }
    }));
  }
  return clicked;
}

function publicRunBuildingAction(actionIndex = 0) {
  const root = getPublicRuntimeRoot();
  const normalizedIndex = Math.max(0, Math.floor(Number(actionIndex) || 0));
  return clickFirstRuntimeElement(root, [
    `[data-district-building-detail-popup]:not([hidden]) [data-district-building-detail-action-index="${normalizedIndex}"]`,
    "[data-district-building-detail-popup]:not([hidden]) [data-district-building-detail-action-index]",
    "[data-district-building-detail-popup]:not([hidden]) [data-district-building-detail-collect]"
  ]);
}

function publicCraftItem() {
  const root = getPublicRuntimeRoot();
  return clickFirstRuntimeElement(root, [
    "button[data-armory-slot-start]",
    "button[data-drug-lab-slot-start]",
    "button.pharmacy-slot__btn--start"
  ]);
}

function publicOpenMarket() {
  const root = getPublicRuntimeRoot();
  if (clickFirstRuntimeElement(root, [MARKET_POPUP_OPEN_SELECTOR])) {
    return true;
  }

  const popup = root?.querySelector?.(MARKET_POPUP_SELECTOR) || null;
  return popup ? openMarketPanel(popup) : false;
}

function publicBuyMarketItem() {
  const root = getPublicRuntimeRoot();
  publicOpenMarket();
  return clickFirstRuntimeElement(root, [
    ".market-popup-row__buy",
    ".market-player-listing__buy"
  ]);
}

function publicSellMarketItem() {
  const root = getPublicRuntimeRoot();
  publicOpenMarket();
  return clickFirstRuntimeElement(root, [
    ".market-popup-row__sell",
    ".market-player-sell-button"
  ]);
}

function publicOpenAttackPanel(districtId) {
  return getRuntimeDistrictApi()?.openAttackPanel?.(districtId) || false;
}

function publicStartAttack(districtId) {
  return getRuntimeDistrictApi()?.startAttack?.(districtId) || false;
}

function publicOpenSpyPanel(districtId) {
  return getRuntimeDistrictApi()?.openSpyPanel?.(districtId) || false;
}

function publicStartSpy(districtId) {
  return getRuntimeDistrictApi()?.startSpy?.(districtId) || false;
}

function publicOpenPlayerProfile() {
  const root = getPublicRuntimeRoot();
  return clickFirstRuntimeElement(root, [PLAYER_PROFILE_OPEN_SELECTOR]);
}

function bindUiEvents(root, context = null) {
  if (!root || runtimeUiBoundRoots.has(root)) {
    return false;
  }

  runtimeUiBoundRoots.add(root);
  bindTopbarMoneySkipControls(root);
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
  bindFreeSessionOnboarding(root);
  bindEliminationResultPopupOverlay(root);
  bindEliminationPurgeWindow(root);
  bindEliminationCountdownWarningOverlay(root);
  bindEventRumorFeed(root);
  bindPoliceHeatFeedback(root);
  bindPlayerProfilePopup(root);
  bindAlliancePopup(root);
  bindMarketPopup(root);
  bindLeaderboardPopup(root);
  bindStoragePopup(root);
  bindPharmacyPopup(root);
  bindDrugLabPopup(root);
  bindFactoryPopup(root);
  bindArmoryPopup(root);
  bindCityStatusBar(root);
  bindOverflowTextTooltips(root);
  bindSpyResourceToggle(root);
  bindAttackOrders(root);
  bindOccupyOrders(root);
  bindRobberyOrders(root);
  bindSpyMissions(root);

  if (context) {
    runtimeContextsByRoot.set(root, context);
  }

  return true;
}

function initRuntime(root = getDefaultRuntimeRoot()) {
  const resolvedRoot = resolveRuntimeRoot(root);

  if (!resolvedRoot) {
    return null;
  }

  if (!runtimeInitializedRoots.has(resolvedRoot)) {
    resolvedRoot.ownerDocument?.addEventListener?.("empire:runtime-mode-changed", (event) => {
      if (event?.detail?.runtimeMode === "server-authoritative") {
        stopLegacyGameplayTimers();
      }
    });
  }

  if (runtimeInitializedRoots.has(resolvedRoot)) {
    const context = runtimeContextsByRoot.get(resolvedRoot) || createPageContext(resolvedRoot);
    syncRuntimePassiveProductionState({ root: resolvedRoot, force: true });
    refreshAllUi(hydrateInitialState(resolvedRoot));
    scheduleDevBuildingCardOpen();
    return context;
  }

  forceGameHtmlRefreshLivePhase(resolvedRoot);
  hydrateInitialState(resolvedRoot);
  const context = createPageContext(resolvedRoot);
  window.empireStreetsPage = context;
  markMounts(context);
  bindUiEvents(resolvedRoot, context);
  syncRuntimePassiveProductionState({ root: resolvedRoot, force: true });
  applySettingsState(getSettingsState());
  refreshAllUi(hydrateInitialState(resolvedRoot));
  scheduleDevBuildingCardOpen();
  resolvedRoot.dataset.bootstrap = "ready";
  resolvedRoot.dataset.runtimeInit = "ready";
  document.documentElement.dataset.page = context.name;
  document.body?.classList.remove("game-body--booting");
  runtimeInitializedRoots.add(resolvedRoot);
  runtimeContextsByRoot.set(resolvedRoot, context);
  return context;
}

function bootstrapPage() {
  const root = document.querySelector(PAGE_ROOT_SELECTOR);
  if (!root) {
    return null;
  }

  return initRuntime(root);
}

function initCompatibilityGlobals(options = {}) {
  return initRuntimeCompatibilityGlobals({
    bootstrapPage,
    initRuntime,
    bindUiEvents,
    hydrateInitialState,
    refreshAllUi,
    handleActionResult,
    getFreeSessionOnboardingProgress,
    selectDistrict: publicSelectDistrict,
    openDistrict: publicOpenDistrict,
    openBuildingDetail: publicOpenBuildingDetail,
    collectProduction: publicCollectProduction,
    runBuildingAction: publicRunBuildingAction,
    craftItem: publicCraftItem,
    openMarket: publicOpenMarket,
    buyMarketItem: publicBuyMarketItem,
    sellMarketItem: publicSellMarketItem,
    openAttackPanel: publicOpenAttackPanel,
    startAttack: publicStartAttack,
    openSpyPanel: publicOpenSpyPanel,
    startSpy: publicStartSpy,
    openPlayerProfile: publicOpenPlayerProfile,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearNotifications,
    ...(typeof window !== "undefined" && window.__EMPIRE_E2E__ === true
      ? {
          advanceLocalProductionJobForE2e,
          advanceFactoryProductionForE2e
        }
      : {})
  }, {
    notifications: {
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      clearNotifications,
      renderNotificationList
    },
    wantedPanel: {
      renderHeatBadge,
      renderWantedFeedback,
      renderWantedPanel
    },
    authPanel: {
      renderAuthStatus,
      renderFactionPreviewPanel
    },
    resourcesPanel: {
      renderResourcesPanel: renderResourcesPanelUi,
      renderStorageList,
      updateTopbarResources
    },
    playerProfilePanel: {
      renderPlayerProfilePanel
    },
    buildingDetailPanel: {
      ensureBuildingDetailPanel,
      renderBuildingDetailPanel
    },
    productionPanel: {
      renderProductionPanel: renderProductionPanelUi,
      renderProductionBuildingInfo: renderProductionBuildingInfoPanel,
      renderFactoryBuildingInfo: renderFactoryBuildingInfoPanel,
      renderFactorySlotList
    },
    recipePanel: {
      renderRecipeCard
    },
    buildingPanel: {
      renderBuildingActionRows,
      renderBuildingsPopupDetail: renderBuildingsPopupDetailPanel,
      renderBuildingsPopupTypes: renderBuildingsPopupTypesPanel
    },
    buildingActionUiRegistry: {
      getBuildingActionUi,
      getActionLabel,
      getActionDescription,
      getActionIcon,
      getActionDisabledReason
    },
    buildingActionResultPanel: {
      renderBuildingActionResult
    },
    policeActionResultPanel: {
      renderPoliceActionResultPanel
    },
    onboarding: {
      createOnboardingBridge,
      getProgress: getFreeSessionOnboardingProgress
    },
    policeHeat: {
      createPoliceHeatBridge
    },
    factoryPanel: {
      renderFactoryDashboardPanel
    },
    factoryViewModel: {
      buildFactoryDashboardViewModel
    },
    battleReportPanel: {
      renderBattleReport: renderBattleReportPanel
    },
    attackPanel: {
      renderAttackPanel,
      renderAttackConfirmPanel,
      renderAttackProgress,
      openAttackPanel,
      closeAttackPanel
    },
    spyPanel: {
      renderSpyPanel,
      openSpyPanel,
      closeSpyPanel,
      renderSpyWarningPanel
    },
    districtActionHub: {
      renderDistrictActionHub
    },
    selectedDistrictSummary: {
      renderSelectedDistrictSummary
    },
    districtPopupFlagsViewModel: {
      buildDistrictPopupFlagsViewModel
    },
    mapTooltip: {
      hideDistrictTooltip,
      renderDistrictTooltip
    },
    mapTooltipViewModel: {
      buildMapTooltipViewModel
    },
    mapShell: {
      canRenderMap,
      clearMapShellUi,
      getMapShellElements,
      initMapShell,
      renderMapMissingState,
      setMapBusy,
      setMapError,
      syncMapShellVisualState
    },
    mapOverlayState: {
      createDefaultMapOverlayState,
      normalizeMapOverlayState,
      setActiveOverlay,
      isOverlayEnabled,
      toggleOverlay
    },
    mapOverlayControls: {
      initMapOverlayControls,
      renderMapOverlayControls,
      updateMapOverlayButtonStates
    },
    mapStatusPanel: {
      clearMapStatusPanel,
      renderMapBusyState,
      renderMapErrorState,
      renderMapStatusPanel
    },
    mapStatusViewModel: {
      buildMapStatusViewModel
    },
    mapRefreshPipeline: {
      refreshMapAfterStateChange,
      refreshMapOverlayUi,
      refreshMapStatusUi,
      refreshMapUiShell,
      refreshSelectedDistrictUi
    }
  }, options);
}

initCompatibilityGlobals();

export {
  ARMORY_RECIPES,
  ATTACK_COOLDOWN_MS,
  ATTACK_SETUP_WEAPONS,
  CURRENT_PLAYER_ID,
  DEFAULT_DRUG_INVENTORY,
  DEFAULT_GANG_MEMBERS,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  DEMO_SCENARIOS,
  DEV_ONLY_ONBOARDING_START_STATE,
  DISTRICT_TYPE_GRID,
  DRUGLAB_RECIPES,
  FACTION_CATALOG,
  FACTION_WEAPON_PRESETS,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG,
  MAX_SPIES,
  OCCUPY_COOLDOWN_MS,
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
  appendBuildingActionResultEntry,
  bindAlliancePopup,
  bindLogoutActions,
  bindArmoryPopup,
  bindAttackOrders,
  bindBorderColorToggle,
  bindBuildingActionStatus,
  bindCityStatusBar,
  bindDistrictCanvas,
  bindDrugLabPopup,
  bindEliminationPurgeWindow,
  bindEliminationResultPopupOverlay,
  bindEventRumorFeed,
  bindFactoryPopup,
  bindFactionRegistration,
  bindGamePhaseToggle,
  bindGangWantedStatus,
  bindFreeSessionOnboarding,
  bindLeaderboardPopup,
  bindMapNavigation,
  bindMapPhaseToggle,
  bindMarketPopup,
  bindPharmacyPopup,
  bindPoliceHeatFeedback,
  bindPlayerProfilePopup,
  bindRegisteredPlayerState,
  bindRobberyOrders,
  bindSpyMissions,
  bindSpyResourceToggle,
  bindStoragePopup,
  bindUiEvents,
  bootstrapPage,
  clearNotifications,
  clamp,
  classifyDistrictType,
  closeAttackPanel,
  closeSpyPanel,
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
  createOrganicDistrictPolygon,
  createPageContext,
  createProductionCard,
  createRobberySetupPreview,
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
  getActionDescription,
  getActionDisabledReason,
  getActionIcon,
  getActionLabel,
  getAttackScenarioMemberLoss,
  getBuildingActionUi,
  getCurrentPlayerOwnedDistrictIds,
  getDistrictAtPoint,
  getDistrictBuildingDetailProfile,
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
  getResolvedProductionState,
  getResolvedSpyIntel,
  getResolvedSpyState,
  getResolvedWeaponInventory,
  getRobberyLootForOrder,
  getRobberyRiskLevel,
  getRobberyScenarioMemberLoss,
  getRobberySuccessChance,
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
  handleActionResult,
  hashCell,
  hydrateInitialState,
  initCompatibilityGlobals,
  initRuntime,
  isDistrictTypeHidden,
  isDistrictTypeVisible,
  isDemoScenarioMode,
  isDowntownCell,
  isPointInDistrict,
  resolveBuildingPopupTarget,
  resolveDistrictBuildingCanonicalLookupKey,
  resolveDistrictBuildingDetailMechanicsType,
  loadImage,
  markMounts,
  openAttackPanel,
  openSpyPanel,
  persistProductionJob,
  refreshMarketPricesIfNeeded,
  remapDistrictId,
  remapDistrictType,
  renderDistrictCanvas,
  renderAttackConfirmPanel,
  renderAttackPanel,
  renderAttackProgress,
  renderGangMembersState,
  renderProductionPanel,
  renderBattleReportPanel as renderBattleReport,
  renderBuildingActionResult,
  refreshAllUi,
  renderResourcesPanelUi as renderResourcesPanel,
  renderAuthStatus,
  renderStorageList,
  renderSpyPanel,
  renderSpyWarningPanel,
  renderSpyResourceState,
  replaceListItems,
  resolveAttackScenario,
  resolveRobberyOrderOutcome,
  resolveRobberyScenario,
  resolveSpyScenario,
  scheduleAttackOrder,
  scheduleProductionJob,
  scheduleRobberyOrder,
  scheduleSpyMission,
  setBuildingActionFeedback,
  shouldOpenGenericDistrictBuildingDetail,
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
  submitServerAllianceCommand,
  submitServerBountyCommand,
  updateTopbarResources,
  showAttackToast,
  showError,
  showInfo,
  renderNotificationList,
  showRobberyToast,
  showSuccess,
  showSpyToast,
  showToast,
  showWarning,
  syncCompletedProductionJobs,
  syncFactoryProduction,
  syncOwnedDistrictBuildingDetailProduction,
  syncRuntimePassiveProductionState,
  scheduleStoredProductionJobs
};
