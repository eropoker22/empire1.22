import { resolveDistrictActions } from "./legacy/district-action-policy.js";
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
import { formatDurationLabel } from "../../../packages/game-core/src/legacy-page/production-preview-rules.js";
import { resolveSpyScenario } from "../../../packages/game-core/src/legacy-page/spy-preview-rules.js";
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
  DEV_ONLY_POLICE_INTERVAL_MS,
  LAUNCH_PLAYER_AVATAR_BY_FACTION_ID,
  LAUNCH_PLAYER_FACTION_ORDER,
  START_PHASE_OWNER_COORDINATES,
  START_PHASE_PLAYER_COLORS,
  START_PHASE_PLAYER_NAMES,
  START_PHASE_RESOURCE_SIMULATION,
  isDemoScenarioMode
} from "./dev/demoScenarios.js";
import { bindLeaderboardPopup } from "./features/leaderboard.js";
import { bindMapNavigation } from "./map-navigation.js";
import { createMapCanvasAnimationRenderers } from "./map/mapCanvasAnimations.js";
import { createDistrictCanvasRenderer } from "./map/districtCanvasRenderer.js";
import {
  DISTRICT_ATMOSPHERE_META,
  DISTRICT_BUILDING_TYPE_META,
  DISTRICT_BUILDING_TYPE_ORDER,
  MAP_DEFAULT_DISTRICT_TYPE,
  MAP_DISTRICT_FOCUSED_CLASS,
  MAP_DISTRICT_SELECTION_DRAG_THRESHOLD,
  MAP_DISTRICT_SELECTION_SUPPRESS_MS,
  MAP_DOWNTOWN_DISTRICT_TYPE,
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
import { buildMapStatusViewModel } from "./map/mapStatusViewModel.js";
import {
  hideDistrictTooltip,
  renderDistrictTooltip
} from "./map/mapTooltip.js";
import { buildMapTooltipViewModel } from "./map/mapTooltipViewModel.js";
import { buildMapMissionMarkersViewModel } from "./map/mapMissionMarkersViewModel.js";
import { getPoliceTierShortEffect, resolvePoliceTierImpact } from "./police-raid-config.js";
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
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DISTRICT_MINUTE_INCOME_RULES_EMPIRE2,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  formatDistrictBuildingTierLabel
} from "./runtime/districtBuildingData.js";
import {
  APARTMENT_BLOCK_BASE_CAPACITY,
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
  SCHOOL_CONFIG,
  SHOPPING_MALL_NETWORK_CONFIG,
  SMUGGLING_TUNNEL_CONFIG,
  WAREHOUSE_BASE_STORAGE_CAPACITIES,
  WAREHOUSE_NETWORK_CONFIG
} from "./runtime/buildingDetailData.js";
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
  syncBuildingDetailTabs as syncBuildingDetailPanelTabs
} from "./ui/buildingDetailPanel.js";
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
import { createDistrictPopupMetricsRuntime } from "./runtime/districtPopupMetricsRuntime.js";
import { createBuildingsPopupRuntime } from "./runtime/buildingsPopupRuntime.js";
import { createBuildingActionStatusRuntime } from "./runtime/buildingActionStatusRuntime.js";
import { createRegisteredPlayerStateRuntime } from "./runtime/registeredPlayerStateRuntime.js";
import { createGangWantedStatusRuntime } from "./runtime/gangWantedStatusRuntime.js";
import { createCityStatusBarRuntime } from "./runtime/cityStatusBarRuntime.js";
import { createPhaseToggleRuntime } from "./runtime/phaseToggleRuntime.js";
import { createProductionBuildingPopupRuntime } from "./runtime/productionBuildingPopupRuntime.js";
import { createFactoryPopupRuntime } from "./runtime/factoryPopupRuntime.js";
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
import { createEventRumorBridge } from "./runtime/eventRumorBridge.js";
import { renderRecipeCard } from "./ui/recipePanel.js";
import {
  getActionDescription,
  getActionDisabledReason,
  getActionIcon,
  getActionLabel,
  getBuildingActionUi
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
  normalizeBuildingActionSnapshot
} from "./ui/eventFeedPanel.js";
import { renderPlayerProfilePanel } from "./ui/playerProfilePanel.js";
// Legacy static-page preview runtime; browser-local only when no server authority is present.
const BUILDING_ACTION_LOG_LIMIT = 30;
const MONEY_STAT_COUNT_TICK_MS = 26;
const CITY_CLOCK_MINUTES_PER_TICK = 1;
const DISTRICT_GOSSIP_MAX_PER_DISTRICT = 2;
const buildingActionPanels = new WeakMap();
const attackMissionTimers = new Map();
const occupyMissionTimers = new Map();
const robberyMissionTimers = new Map();
const spyMissionTimers = new Map();
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
  "tech-core": "techCore"
});

function getFactorySupplyKeyForMaterial(itemId) {
  return FACTORY_SUPPLY_MATERIAL_KEY_MAP[itemId] || null;
}

const {
  createWeaponInventoryFromFaction,
  getResolvedDrugInventory,
  getResolvedEconomyState,
  getResolvedMaterialInventory,
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
  const operationKey = resolvePoliceOperationType(options.operationType)?.key
    || resolveRandomPoliceOperationType(tier.id, options.source)
    || "warning_notice";
  const operationMeta = resolvePoliceOperationType(operationKey) || POLICE_OPERATION_TYPES.warning_notice;
  const specialtyKey = resolvePoliceSpecialty(options.raidSpecialtyKey || operationMeta.specialtyKey || resolveRandomPoliceSpecialtyKey()).key;
  const now = Date.now();
  const durationMs = Math.max(60_000, Number(options.durationMs || GANG_HEAT_POLICE_DURATION_MS) || GANG_HEAT_POLICE_DURATION_MS);
  const impact = options.skipImpact === true
    ? { rows: [] }
    : applyPoliceActionImpact(tier);
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
  const isLaunchPhase = isDemoScenarioMode(phaseState);
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
  return getDistrictGossipRuntime().recordDistrictIntelEvent(payload);
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

function applyPoliceActionImpact(tier) {
  const tierImpact = resolvePoliceTierImpact(tier.id);

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
    tierId: tier.id,
    durationMs: tierImpact.durationMs,
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
  openPoliceActionResultModal,
  renderBattleReportPanel,
  renderSimpleResultModal,
  renderSpyWarningPanel,
  selectors: {
    attackResult: ATTACK_RESULT_MODAL_SELECTOR,
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

function appendBuildingActionResultEntry(root, kind, payload, snapshot = {}, options = {}) {
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

function renderBuildingActionFeed(root, { syncPreview = false, previewSnapshot = null } = {}) {
  const panel = resolveBuildingActionPanel(root);
  if (!panel) {
    return;
  }

  panel.feedElement.replaceChildren(
    ...panel.entries
      .map((entry) => createBuildingActionFeedItemElement(root.ownerDocument || document, entry, {
        removeSelector: BUILDING_ACTION_REMOVE_SELECTOR,
        onOpenResult: (selectedEntry) => queueOrOpenResultModal(root, selectedEntry.resultKind, selectedEntry.resultPayload)
      }))
      .filter(Boolean)
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

  const { raidTone, raidResultPayload } = getResultPayloadBuilders().createRobberyResultPayload({
    order,
    deployedMembers,
    memberLoss,
    lootEntries
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
  const items = [];

  for (const recipeId of Object.keys(recipes || {})) {
    const jobKey = `${buildingName}:${recipeId}`;
    const job = getProductionJob(jobKey);

    if (!job || job.status !== "ready") {
      continue;
    }

    applyInventoryOutput(job.output);
    clearProductionJob(jobKey);
    const amount = Math.max(0, Number(job.output?.amount || 0));
    collected += amount;
    items.push({ label: getProductionResourceLabel(job.output?.itemId), amount });
  }

  return { total: collected, items };
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
  getProductionBuildingEffectsLabel,
  getProductionBuildingMultiplier,
  getProductionBuildingReadyCount,
  getProductionBuildingUpgradeCost,
  getProductionJob,
  getProductionResourceLabel,
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
  setBuildingActionFeedback,
  setStoredEconomyState,
  setStoredProductionBuildingState,
  syncBuildingDetailTopbarVisibility,
  syncCompletedProductionJobs
});

function collectFactoryOutputsToSupplies() {
  const syncResult = syncFactoryProduction(getStoredFactoryState());
  const nextState = syncResult.state;
  const nextSupplies = getStoredFactorySupplies();
  let collected = 0;
  const items = [];

  for (const slot of nextState.slots || []) {
    const amount = Math.max(0, Math.floor(Number(slot?.producedAmount || 0)));

    if (amount <= 0 || !slot?.resourceKey) {
      continue;
    }

    nextSupplies[slot.resourceKey] = Math.max(0, Math.floor(Number(nextSupplies[slot.resourceKey] || 0) + amount));
    slot.producedAmount = 0;
    collected += amount;
    items.push({ label: FACTORY_SLOT_CONFIG.find((entry) => entry.resourceKey === slot.resourceKey)?.label || getProductionResourceLabel(slot.resourceKey), amount });
  }

  setStoredFactoryState(nextState);
  setStoredFactorySupplies(nextSupplies);
  return { total: collected, items };
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
  syncMarketTabs,
  windowRef: typeof window === "undefined" ? null : window
});

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
  downtownDistrictType: MAP_DOWNTOWN_DISTRICT_TYPE,
  downtownFixedPackagesByDistrictId: DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  getCurrentPlayerOwnedDistrictIds,
  getEffectiveOwnedDistrictIds,
  getResolvedSpyIntel,
  hashCell,
  remapDistrictId,
  remapDistrictType,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  variantNamesByBaseName: DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME
});

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
  getOwnedApartmentBlockCount,
  getOwnedArcadeCount,
  getOwnedAutoSalonCount,
  getOwnedClinicCount,
  getOwnedExchangeOfficeCount,
  getOwnedFitnessClubCount,
  getOwnedSchoolCount,
  getOwnedShoppingMallCountForMarket,
  getOwnedSmugglingTunnelCount,
  getOwnedWarehouseCount,
  getSchoolNetworkMultipliers,
  getSchoolTalentChancePct,
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
  getCurrentPlayerOwnedDistrictIds,
  getDistrictResourceCatalog,
  getResolvedWorldState,
  getStoredDrugInventory,
  getStoredFactorySupplies,
  getStoredMaterialInventory,
  getStoredWeaponInventory,
  normalizeBuildingLookupKey,
  resolveDistrictBuildingProfile,
  schoolConfig: SCHOOL_CONFIG,
  shoppingMallNetworkConfig: SHOPPING_MALL_NETWORK_CONFIG,
  smugglingTunnelConfig: SMUGGLING_TUNNEL_CONFIG,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  warehouseBaseStorageCapacities: WAREHOUSE_BASE_STORAGE_CAPACITIES,
  warehouseNetworkConfig: WAREHOUSE_NETWORK_CONFIG
});

function applyShoppingMallMarketDiscountToPrice(basePrice, discount) {
  const safeBasePrice = Math.max(1, Math.round(Number(basePrice || 1)));
  const discounted = safeBasePrice * (1 - Math.max(0, Number(discount?.discountPct || 0)) / 100);
  return Math.max(1, Math.ceil(Math.max(discounted, safeBasePrice * Math.max(0, Number(discount?.minFinalPriceMultiplier || 0.7)))));
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
  return isDemoScenarioMode(phaseState);
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

  return BUILDING_POPUP_TARGETS.find((target) => target.lookupKeys.includes(lookupKey)) || null;
}

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

function getDistrictBuildingSpecialActionProfile(buildingName, actionIndex) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  const profiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[lookupKey] || DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[popupLookupKey] || [];
  return profiles[actionIndex] || null;
}

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

function getCasinoDetailUpgrade(level) {
  const safeLevel = Math.max(1, Math.min(CASINO_DETAIL_MAX_LEVEL, Math.floor(Number(level) || 1)));
  return CASINO_DETAIL_UPGRADES[safeLevel] || CASINO_DETAIL_UPGRADES[1];
}

function getCasinoDetailUpgradeCostLabel(level) {
  const upgrade = getCasinoDetailUpgrade(level);
  const parts = [
    upgrade.clean > 0 ? `${formatDistrictBuildingMoney(upgrade.clean)} clean` : "",
    upgrade.techCore > 0 ? `${upgrade.techCore} Tech Core` : "",
    upgrade.combatModule > 0 ? `${upgrade.combatModule} Combat Module` : ""
  ].filter(Boolean);
  return parts.join(" + ") || "Zdarma";
}

function getSchoolTalentLabel(talentId) {
  const labels = {
    technician: "Technik",
    informant: "Informátor",
    medic: "Medik",
    negotiator: "Vyjednavač",
    organizer: "Organizátor",
    protector: "Ochránce"
  };
  return labels[talentId] || "Talent";
}

function getSchoolTalentSummary(talentId) {
  const summaries = {
    technician: "Technik umí zrychlit výrobu ve Zbrojovce nebo Továrně.",
    informant: "Informátor přinesl slabý civilní drb z okolí Školy.",
    medic: "Medik zná levnější postup pro stabilizaci zraněných.",
    negotiator: "Vyjednavač umí vytěžit z města drobný vliv.",
    organizer: "Organizátor umí zkrátit logistické zdržení.",
    protector: "Ochránce umí krátce podržet obranu nejbližšího vlastního districtu."
  };
  return summaries[talentId] || "malá výhoda zapsaná do uličních zpráv";
}

function rollSchoolTalent(chancePct, eveningCourseActive = false) {
  if (Math.random() >= Math.max(0, Number(chancePct || 0)) / 100) {
    return null;
  }
  const regularPool = ["technician", "informant", "medic", "negotiator", "organizer", "protector"];
  const betterPool = ["technician", "medic", "organizer", "protector", "negotiator", "informant"];
  const pool = eveningCourseActive && Math.random() < 0.2 ? betterPool : regularPool;
  const talentId = pool[Math.floor(Math.random() * pool.length)] || "informant";
  return {
    id: talentId,
    label: getSchoolTalentLabel(talentId),
    summary: getSchoolTalentSummary(talentId)
  };
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
      : "Recovery pool je prázdný"
  };
}

function normalizeClinicRecoverableItem(itemType) {
  const key = normalizeBuildingLookupKey(itemType);
  const aliases = {
    "gang members": "gang-members",
    population: "gang-members",
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
  if (!capacity) return Number.POSITIVE_INFINITY;
  switch (itemId) {
    case "chemicals": return capacity.chemicals;
    case "biomass": return capacity.biomass;
    case "metal-parts": return capacity.metalParts;
    case "tech-core": return capacity.techCore;
    case "combat-module": return capacity.combatModule;
    case "neon-dust":
    case "pulse-shot":
    case "velvet-smoke":
    case "ghost-serum":
    case "overdrive-x":
      return capacity.drugsAndBoosts;
    case "baseball-bat":
    case "pistol":
    case "grenade":
    case "smg":
    case "bazooka":
    case "vest":
    case "barricades":
    case "cameras":
    case "defense-tower":
    case "alarm":
      return capacity.weaponsAndDefense;
    default:
      return capacity.genericResources;
  }
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
  return loadDistrictBuildingDetailState();
}

function setStoredDistrictBuildingDetailState(payload) {
  saveDistrictBuildingDetailState(payload);
}

function getDistrictBuildingDetailEntry(district, buildingName) {
  const state = getStoredDistrictBuildingDetailState();
  const key = getDistrictBuildingDetailStorageKey(district, buildingName);
  const entry = state[key] && typeof state[key] === "object" ? state[key] : {};
  const isApartmentBlock = normalizeBuildingLookupKey(buildingName) === "bytovy blok";
  const isSchool = normalizeBuildingLookupKey(buildingName) === "skola";
  const level = Math.max(1, Math.min(DISTRICT_BUILDING_DETAIL_MAX_LEVEL, Math.floor(Number(entry.level || 1))));
  const lastCollectedAt = Number.isFinite(Number(entry.lastCollectedAt))
    ? Number(entry.lastCollectedAt)
    : isApartmentBlock || isSchool
      ? Date.now()
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
    activeEffects,
    storedPopulation: Math.max(0, Number(entry.storedPopulation || 0)),
    populationLastUpdatedAt: Number.isFinite(Number(entry.populationLastUpdatedAt))
      ? Number(entry.populationLastUpdatedAt)
      : isApartmentBlock
        ? Date.now()
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
      : isSchool
        ? Date.now()
        : lastCollectedAt,
    studentCapacity: Number.isFinite(Number(entry.studentCapacity))
      ? Math.max(1, Math.floor(Number(entry.studentCapacity)))
      : SCHOOL_CONFIG.baseStudentCapacity,
    studentFullNotifiedAt: Number.isFinite(Number(entry.studentFullNotifiedAt))
      ? Number(entry.studentFullNotifiedAt)
      : 0,
    schoolEveningCourseExpiresAt: Number.isFinite(Number(entry.schoolEveningCourseExpiresAt))
      ? Number(entry.schoolEveningCourseExpiresAt)
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

function resolveDistrictBuildingDetailMechanicsType(buildingName) {
  const lookupKey = normalizeBuildingLookupKey(buildingName);
  const popupTarget = resolveBuildingPopupTarget(buildingName);
  const popupLookupKey = popupTarget ? normalizeBuildingLookupKey(popupTarget.label) : "";
  return DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[lookupKey] || DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[popupLookupKey] || "district-asset";
}

function createDistrictBuildingInfoLine(label, value) {
  const row = document.createElement("div");
  row.className = "district-building-detail-mechanic-row district-building-detail-info-line";
  const rowLabel = document.createElement("span");
  rowLabel.textContent = label;
  const rowValue = document.createElement("strong");
  rowValue.textContent = value;
  row.append(rowLabel, rowValue);
  return row;
}

function renderDistrictBuildingInfoSection(infoElement, {
  profile,
  mechanics,
  buildingName,
  entry
}) {
  const section = infoElement?.closest(".building-info-card__section") || infoElement?.parentElement;
  if (!section) {
    return;
  }

  const viewModel = createBuildingDetailInfoViewModel({
    profile,
    mechanics,
    buildingName,
    entry,
    playerHeat: getResolvedGangState().heat,
    actionProfiles: (Array.isArray(profile.actions) ? profile.actions : []).map((_, actionIndex) => getDistrictBuildingSpecialActionProfile(buildingName, actionIndex)),
    now: Date.now()
  });

  const title = document.createElement("h5");
  title.textContent = viewModel.title;

  const intro = document.createElement("p");
  intro.className = "building-detail-info-text";
  intro.textContent = viewModel.intro;

  const overview = document.createElement("div");
  overview.className = "building-detail-mechanics district-building-detail-mechanics district-building-detail-info-grid";
  overview.replaceChildren(...viewModel.rows.map((row) => createDistrictBuildingInfoLine(row.label, row.value)));

  const actionsTitle = document.createElement("h5");
  actionsTitle.textContent = viewModel.actionsTitle;

  const actionList = document.createElement("div");
  actionList.className = "building-info-card__actions district-building-detail-actions district-building-detail-info-actions";
  for (const action of viewModel.actions) {
    const row = document.createElement("div");
    row.className = "building-info-action-row";
    const rowTitle = document.createElement("strong");
    rowTitle.className = "building-info-action-row__title";
    rowTitle.textContent = action.title;
    const desc = document.createElement("span");
    desc.className = "building-info-action-row__desc";
    desc.textContent = action.description;
    const result = document.createElement("span");
    result.className = "building-info-action-row__cooldown";
    result.textContent = action.result;
    row.append(rowTitle, desc, result);
    actionList.append(row);
  }

  const children = [title, intro, overview];
  if (viewModel.actions.length > 0) {
    children.push(actionsTitle, actionList);
  }
  section.replaceChildren(...children);
}

function resolveDistrictBuildingDetailMechanics(district, buildingName) {
  const entry = getDistrictBuildingDetailEntry(district, buildingName);
  const mechanicsType = resolveDistrictBuildingDetailMechanicsType(buildingName);
  const buildingLookupKey = normalizeBuildingLookupKey(buildingName);
  const isShoppingMall = buildingLookupKey === "obchodni centrum";
  const isAutoSalon = buildingLookupKey === "autosalon";
  const isFitnessClub = buildingLookupKey === "fitness club";
  const income = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INCOME_RULES_EMPIRE2, buildingName, { clean: 0, dirty: 0 });
  const heatRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_HEAT_RULES_EMPIRE2, buildingName, { heat: 0 });
  const influenceRule = getDistrictBuildingRule(DISTRICT_BUILDING_MINUTE_INFLUENCE_RULES_EMPIRE2, buildingName, { influence: 0 });
  const now = Date.now();
  const elapsedMs = Math.min(DISTRICT_BUILDING_DETAIL_COLLECT_CAP_MS, Math.max(0, now - entry.lastCollectedAt));
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const maxLevel = mechanicsType === "casino"
    ? CASINO_DETAIL_MAX_LEVEL
    : mechanicsType === "apartment-block"
      ? 1
      : mechanicsType === "school"
        ? 1
      : DISTRICT_BUILDING_DETAIL_MAX_LEVEL;
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
  const schoolTalentChancePct = mechanicsType === "school" ? getSchoolTalentChancePct(ownedSchools, schoolEveningCourseActive) : 0;
  const ownedWarehouses = mechanicsType === "warehouse" ? getOwnedWarehouseCount() : 0;
  const warehouseNetwork = mechanicsType === "warehouse" ? getWarehouseNetworkMultipliers(ownedWarehouses) : null;
  const warehouseCapacity = mechanicsType === "warehouse" ? getWarehouseCapacityBreakdown(ownedWarehouses) : null;
  const warehouseUsage = mechanicsType === "warehouse" ? getWarehouseStorageUsage(warehouseCapacity) : null;
  const warehouseWarnings = mechanicsType === "warehouse" ? getWarehouseCapacityWarnings(warehouseUsage) : [];
  const ownedClinics = mechanicsType === "clinic" ? getOwnedClinicCount() : 0;
  const clinicNetwork = mechanicsType === "clinic" ? getClinicNetworkMultipliers(ownedClinics) : null;
  const clinicRecoveryRatePct = mechanicsType === "clinic" ? getClinicRecoveryRatePct(ownedClinics) : 0;
  const clinicRecoveryPool = mechanicsType === "clinic" ? getClinicRecoveryPoolView(now) : null;
  const ownedShoppingMalls = isShoppingMall ? getOwnedShoppingMallCountForMarket() : 0;
  const shoppingMallMarketDiscount = isShoppingMall ? getShoppingMallMarketDiscountForTab("market") : null;
  const shoppingMallBlackMarketDiscount = isShoppingMall ? getShoppingMallMarketDiscountForTab("black-market") : null;
  const shoppingMallNetwork = isShoppingMall ? getShoppingMallNetworkMultipliers(ownedShoppingMalls) : null;
  const ownedAutoSalons = isAutoSalon ? getOwnedAutoSalonCount() : 0;
  const autoSalonNetwork = isAutoSalon ? getAutoSalonNetworkMultipliers(ownedAutoSalons) : null;
  const autoSalonSupport = isAutoSalon ? getAutoSalonSupportStats(ownedAutoSalons) : null;
  const ownedFitnessClubs = isFitnessClub ? getOwnedFitnessClubCount() : 0;
  const fitnessClubNetwork = isFitnessClub ? getFitnessClubNetworkMultipliers(ownedFitnessClubs) : null;
  const fitnessClubSupport = isFitnessClub ? getFitnessClubSupportStats(ownedFitnessClubs) : null;
  const ownedSmugglingTunnels = mechanicsType === "smuggling-tunnel" ? getOwnedSmugglingTunnelCount() : 0;
  const smugglingTunnelNetwork = mechanicsType === "smuggling-tunnel" ? getSmugglingTunnelNetworkMultipliers(ownedSmugglingTunnels) : null;
  const smugglingSilentActive = mechanicsType === "smuggling-tunnel" && Number(entry.silentChannelExpiresAt || 0) > now;
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
    : schoolNetwork
    ? schoolNetwork.incomeMultiplier * (schoolEveningCourseActive ? SCHOOL_CONFIG.eveningCourseCleanIncomeMultiplier : 1)
    : autoSalonNetwork
    ? autoSalonNetwork.cleanIncomeMultiplier
    : casinoUpgrade
    ? 1 + (casinoUpgrade.incomeBonusPct / 100)
    : 1 + ((level - 1) * 0.14);
  const cleanHourly = mechanicsType === "smuggling-tunnel" ? 0 : Math.max(0, Math.round(Number(income.clean || 0) * 60 * multiplier));
  const dirtyHourly = mechanicsType === "smuggling-tunnel"
    ? Math.max(0, Math.round(SMUGGLING_TUNNEL_CONFIG.dirtyCashPerMinute * 60 * (smugglingTunnelNetwork?.dirtyProductionMultiplier || 1) * (smugglingSilentActive ? SMUGGLING_TUNNEL_CONFIG.silentChannelDirtyProductionMultiplier : 1)))
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
  const apartmentPopulationPerMinute = apartmentNetwork
    ? APARTMENT_BLOCK_POPULATION_PER_MINUTE * apartmentNetwork.populationProductionMultiplier
    : 0;
  const apartmentStoredPopulation = mechanicsType === "apartment-block"
    ? Math.min(apartmentCapacity, apartmentStoredBase + (apartmentStoredBase >= apartmentCapacity ? 0 : apartmentPopulationPerMinute * apartmentElapsedMs / 60000))
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
    ? SCHOOL_CONFIG.populationPerMinute * schoolNetwork.populationProductionMultiplier * (schoolEveningCourseActive ? SCHOOL_CONFIG.eveningCoursePopulationMultiplier : 1)
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
    ? Math.max(1, Math.floor(SMUGGLING_TUNNEL_CONFIG.baseBatchCapacity * smugglingTunnelNetwork.batchCapacityMultiplier * (smugglingSilentActive ? SMUGGLING_TUNNEL_CONFIG.silentChannelBatchCapacityMultiplier : 1)))
    : 0;
  const smugglingStoredBase = mechanicsType === "smuggling-tunnel"
    ? Math.min(smugglingBatchCapacity, Math.max(0, Number(entry.storedDirtyCash || 0)))
    : 0;
  const smugglingElapsedMs = mechanicsType === "smuggling-tunnel"
    ? Math.max(0, now - Number(entry.smugglingLastUpdatedAt || entry.lastCollectedAt || now))
    : 0;
  const smugglingDirtyPerMinute = mechanicsType === "smuggling-tunnel"
    ? SMUGGLING_TUNNEL_CONFIG.dirtyCashPerMinute * (smugglingTunnelNetwork?.dirtyProductionMultiplier || 1) * (smugglingSilentActive ? SMUGGLING_TUNNEL_CONFIG.silentChannelDirtyProductionMultiplier : 1)
    : 0;
  const smugglingStoredDirtyCash = mechanicsType === "smuggling-tunnel"
    ? Math.min(smugglingBatchCapacity, smugglingStoredBase + (smugglingStoredBase >= smugglingBatchCapacity ? 0 : smugglingDirtyPerMinute * smugglingElapsedMs / 60000))
    : 0;
  const smugglingWholeDirtyCash = Math.max(0, Math.floor(smugglingStoredDirtyCash));
  const smugglingIsFull = mechanicsType === "smuggling-tunnel" && smugglingBatchCapacity > 0 && smugglingStoredDirtyCash >= smugglingBatchCapacity;
  const smugglingTimeToFullMs = mechanicsType === "smuggling-tunnel" && !smugglingIsFull && smugglingDirtyPerMinute > 0
    ? Math.ceil((smugglingBatchCapacity - smugglingStoredDirtyCash) / smugglingDirtyPerMinute * 60000)
    : 0;
  const dailyHeat = Math.round(Number(heatRule.heat || 0) * (smugglingTunnelNetwork?.passiveHeatMultiplier || fitnessClubNetwork?.heatMultiplier || autoSalonNetwork?.heatMultiplier || clinicNetwork?.heatMultiplier || warehouseNetwork?.heatMultiplier || arcadeNetwork?.heatMultiplier || exchangeNetwork?.heatMultiplier || 1) * (smugglingSilentActive ? SMUGGLING_TUNNEL_CONFIG.silentChannelHeatMultiplier : 1) * 1440 * 10) / 10;
  const dailyInfluence = Math.round(Number(influenceRule.influence || 0) * 1440 * 10) / 10;
  const activeEffectLabels = (entry.activeEffects || [])
    .map((effect) => `${effect.label || "Efekt"} ${formatDistrictBuildingCooldown(Number(effect.expiresAt || 0) - Date.now())}`)
    .filter(Boolean);
  const canCollect =
    mechanicsType === "apartment-block" && apartmentWholePopulation > 0
    || mechanicsType === "school" && schoolWholeStudents > 0
    || mechanicsType === "smuggling-tunnel" && smugglingWholeDirtyCash >= SMUGGLING_TUNNEL_CONFIG.minCollectDirty;
  const hasManualCollect =
    mechanicsType === "apartment-block"
    || mechanicsType === "school"
    || mechanicsType === "smuggling-tunnel";
  const storedOutputLabel = [
    mechanicsType === "apartment-block" ? `${apartmentWholePopulation}/${apartmentCapacity} obyvatel` : "",
    mechanicsType === "school" ? `${schoolWholeStudents}/${schoolCapacity} studentů` : "",
    mechanicsType === "smuggling-tunnel" ? `${formatDistrictBuildingMoney(smugglingWholeDirtyCash)}/${formatDistrictBuildingMoney(smugglingBatchCapacity)} dirty` : ""
  ].filter(Boolean).join(" · ") || "Zatím nic";
  const effectsLabel = [
    cleanHourly > 0 ? `Clean cash +${formatDistrictBuildingMoney(cleanHourly)}/hod` : "",
    dirtyHourly > 0 ? `Dirty cash +${formatDistrictBuildingMoney(dirtyHourly)}/hod` : "",
    mechanicsType === "apartment-block" ? `Populace +${apartmentPopulationPerMinute.toFixed(2)}/min` : "",
    mechanicsType === "school" ? `Studenti +${schoolPopulationPerMinute.toFixed(2)}/min` : "",
    mechanicsType === "smuggling-tunnel" ? `Dávka +${formatDistrictBuildingMoney(smugglingDirtyPerMinute)}/min` : "",
    apartmentIsFull ? "Plná kapacita · Bytový blok je plný. Obyvatelé čekají na vybrání." : "",
    schoolIsFull ? "Plná kapacita · Škola je plná. Studenti čekají na vybrání." : "",
    smugglingIsFull ? "Dávka připravena · Pašovací tunel je plný. Dirty cash čeká na vybrání." : "",
    mechanicsType === "school" ? `Talent chance ${schoolTalentChancePct}%` : "",
    ...warehouseWarnings,
    dailyHeat > 0 ? `Heat +${dailyHeat}/den` : "",
    dailyInfluence > 0 ? `Vliv +${dailyInfluence}/den` : "",
    ...activeEffectLabels,
    `Level multiplier x${multiplier.toFixed(2)}`
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
    schoolTalentChancePct,
    schoolEveningCourseActive,
    schoolEveningCourseRemainingMs: Math.max(0, Number(entry.schoolEveningCourseExpiresAt || 0) - now),
    ownedWarehouses,
    warehouseNetwork,
    warehouseCapacity,
    warehouseUsage,
    warehouseWarnings,
    ownedClinics,
    clinicNetwork,
    clinicRecoveryRatePct,
    clinicRecoveryPool,
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
    ownedSmugglingTunnels,
    smugglingTunnelNetwork,
    smugglingBatchCapacity,
    smugglingStoredDirtyCash,
    smugglingWholeDirtyCash,
    smugglingDirtyPerMinute,
    smugglingIsFull,
    smugglingTimeToFullMs,
    smugglingCollectHeat: getSmugglingTunnelCollectHeat(smugglingWholeDirtyCash),
    smugglingSilentActive,
    smugglingSilentRemainingMs: Math.max(0, Number(entry.silentChannelExpiresAt || 0) - now),
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
    hasManualCollect,
    storedOutputLabel,
    effectsLabel,
    actionCooldowns: entry.actionCooldowns
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
    if (collectedPopulation <= 0) {
      setBuildingActionFeedback(root, "warning", context.buildingName, "Bytový blok zatím nemá obyvatele k vybrání.", "Počkej na další produkci.");
      return;
    }
    const gangState = getResolvedGangState();
    const remainingPopulation = Math.max(0, Number(mechanics.apartmentStoredPopulation || 0) - collectedPopulation);
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedPopulation) });
    renderGangMembersState(root);
    summary.push(`${collectedPopulation} členů gangu`);
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      storedPopulation: remainingPopulation,
      populationLastUpdatedAt: Date.now(),
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: 0,
      lastCollectedAt: Date.now()
    }));
    setBuildingActionFeedback(
      root,
      "success",
      context.buildingName,
      `Vybral jsi ${collectedPopulation} nových členů gangu z Bytového bloku.`,
      `${Math.floor(remainingPopulation)}/${mechanics.apartmentCapacity} zůstává lokálně`
    );
    appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: summary.map((value, index) => ({ label: `Položka ${index + 1}`, value })), meta: "Vybrat obyvatele", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
    refreshDistrictBuildingDetailPopup(root, shell);
    return;
  }

  if (mechanics.mechanicsType === "school") {
    const collectedStudents = Math.max(0, Math.floor(Number(mechanics.schoolStoredStudents || 0)));
    if (collectedStudents <= 0) {
      setBuildingActionFeedback(root, "warning", context.buildingName, "Škola zatím nemá studenty k vybrání.", "Počkej na další produkci.");
      return;
    }
    const gangState = getResolvedGangState();
    const talent = rollSchoolTalent(mechanics.schoolTalentChancePct, mechanics.schoolEveningCourseActive);
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedStudents) });
    renderGangMembersState(root);
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      storedStudents: 0,
      schoolLastUpdatedAt: Date.now(),
      studentCapacity: mechanics.schoolCapacity,
      studentFullNotifiedAt: 0,
      lastCollectedAt: Date.now()
    }));
    const talentLine = talent
      ? `Uliční zpráva: ${talent.label} · ${talent.summary}`
      : `Talent nepadl (${mechanics.schoolTalentChancePct}% šance).`;
    setBuildingActionFeedback(
      root,
      "success",
      context.buildingName,
      `Vybral jsi ${collectedStudents} obyvatel ze Školy.`,
      talentLine
    );
    appendBuildingActionResultEntry(root, "police", {
      tone: talent ? "positive" : "event",
      title: `${context.buildingName}: Talent Pool`,
      badge: "Škola",
      summary: talent
        ? `${talent.label}: ${talent.summary}`
        : `Vybral jsi ${collectedStudents} obyvatel ze Školy. Talent tentokrát nepadl.`,
      rows: [
        { label: "Budova", value: context.buildingName },
        context.district?.id ? { label: "District", value: `District ${context.district.id}` } : null,
        { label: "Vybráno", value: `${collectedStudents} obyvatel`, nowrap: true },
        { label: "Talent", value: talent ? talent.label : "nepadl", nowrap: true },
        talent ? { label: "Uliční zpráva", value: talent.summary } : null
      ].filter(Boolean)
    }, {}, { syncPreview: true, forceLog: true });
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
    refreshDistrictBuildingDetailPopup(root, shell);
    return;
  }

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    lastCollectedAt: Date.now()
  }));

  appendBuildingActionResultEntry(root, "police", createStorageCollectResultPayload({ buildingLabel: context.buildingName, items: summary.map((value, index) => ({ label: `Položka ${index + 1}`, value })), meta: "Výstup budovy", districtLabel: context.district?.id ? `District ${context.district.id}` : "Fixed building" }), {}, { syncPreview: true, forceLog: true });
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
      combatModule < upgrade.combatModule ? `${upgrade.combatModule - combatModule} Combat Module` : ""
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

function applyDistrictBuildingSpecialAction(root, context, action, actionProfile, mechanics) {
  const economy = getResolvedEconomyState();
  const gangState = getResolvedGangState();
  let cleanMoney = Math.max(0, Math.floor(Number(economy.cleanMoney || 0)));
  let dirtyMoney = Math.max(0, Math.floor(Number(economy.dirtyMoney || 0)));
  let economyChanged = false;
  let influenceChanged = false;
  let membersChanged = false;
  const summaryParts = [];

  if (actionProfile.apartmentCollectPopulation) {
    const collectedPopulation = Math.max(0, Math.floor(Number(mechanics.apartmentStoredPopulation || 0)));
    if (collectedPopulation <= 0) {
      setBuildingActionFeedback(root, "warning", action, "Bytový blok zatím nemá obyvatele k vybrání.", context.buildingName);
      return null;
    }
    const remainingPopulation = Math.max(0, Number(mechanics.apartmentStoredPopulation || 0) - collectedPopulation);
    setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + collectedPopulation) });
    renderGangMembersState(root);
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      storedPopulation: remainingPopulation,
      populationLastUpdatedAt: Date.now(),
      populationCapacity: mechanics.apartmentCapacity,
      populationFullNotifiedAt: 0,
      lastCollectedAt: Date.now()
    }));
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
    const expiresAt = Date.now() + SCHOOL_CONFIG.eveningCourseDurationMs;
    updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
      ...entry,
      schoolEveningCourseExpiresAt: expiresAt,
      schoolLastUpdatedAt: Date.now(),
      actionCooldowns: {
        ...(entry.actionCooldowns || {}),
        schoolEveningCourse: Date.now() + SCHOOL_CONFIG.eveningCourseCooldownMs,
        schoolEveningCourseActiveUntil: expiresAt
      }
    }));
    economyChanged = true;
    summaryParts.push(`Večerní kurz aktivní na ${formatDistrictBuildingCooldown(SCHOOL_CONFIG.eveningCourseDurationMs)}.`);
    summaryParts.push(`Studenti +${actionProfile.populationBoostPct}% · talent +${actionProfile.talentChanceBonusPct}% · clean income +${actionProfile.cleanIncomeBoostPct}%.`);
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
      setBuildingActionFeedback(root, "warning", action, "Recovery pool je prázdný. Klinika nemá co zachránit.", context.buildingName);
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
    let recoveredMembers = 0;

    const groupUsage = { ...warehouseUsage };
    for (const entry of clinicRecoverableFresh) {
      const itemId = normalizeClinicRecoverableItem(entry.itemType);
      const entryRate = entry.source === "trap" || entry.source === "toxic_trap"
        ? rate * 0.5
        : rate;
      const rawAmount = Math.max(0, Number(entry.amount || 0)) * entryRate;
      let recoverAmount = Math.floor(rawAmount);
      if (CLINIC_RARE_ITEMS.includes(itemId) && Math.random() < rawAmount - recoverAmount) {
        recoverAmount += 1;
      }
      if (recoverAmount <= 0) continue;

      if (itemId === "gang-members") {
        recoveredMembers += recoverAmount;
        acceptedByType[itemId] = Math.max(0, Math.floor(Number(acceptedByType[itemId] || 0)) + recoverAmount);
        continue;
      }

      const cap = getClinicWarehouseCapacityForItem(itemId, warehouseCapacity);
      const usageKey = itemId === "chemicals" || itemId === "biomass"
        ? itemId
        : itemId === "metal-parts"
          ? "metalParts"
          : itemId === "tech-core"
            ? "techCore"
            : itemId === "combat-module"
              ? "combatModule"
              : ["neon-dust", "pulse-shot", "velvet-smoke", "ghost-serum", "overdrive-x"].includes(itemId)
                ? "drugsAndBoosts"
                : ["baseball-bat", "pistol", "grenade", "smg", "bazooka", "vest", "barricades", "cameras", "defense-tower", "alarm"].includes(itemId)
                  ? "weaponsAndDefense"
                  : "genericResources";
      const currentUsage = Math.max(0, Math.floor(Number(groupUsage[usageKey] || 0)));
      const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(recoverAmount, cap - currentUsage)) : recoverAmount;
      const overflow = Math.max(0, recoverAmount - accepted);
      if (accepted > 0) {
        groupUsage[usageKey] = currentUsage + accepted;
        acceptedByType[itemId] = Math.max(0, Math.floor(Number(acceptedByType[itemId] || 0)) + accepted);
      }
      if (overflow > 0) {
        lostByCapacity[itemId] = Math.max(0, Math.floor(Number(lostByCapacity[itemId] || 0)) + overflow);
      }
    }

    if (recoveredMembers > 0) {
      setStoredGangState({ members: Math.max(0, Math.floor(Number(gangState.members || 0)) + recoveredMembers) });
      renderGangMembersState(root);
      membersChanged = true;
    }

    const supplies = getStoredFactorySupplies();
    const nextSupplies = { ...supplies };
    for (const [itemId, amount] of Object.entries(acceptedByType)) {
      const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
      if (safeAmount <= 0 || itemId === "gang-members") continue;
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
    summaryParts.push(`Zachráněno členů ${recoveredMembers}`);
    const returnedItems = Object.entries(acceptedByType)
      .filter(([itemId]) => itemId !== "gang-members")
      .map(([itemId, amount]) => `${getProductionResourceLabel(itemId)} x${amount}`);
    if (returnedItems.length > 0) summaryParts.push(`Vráceno ${returnedItems.join(", ")}`);
    const capacityLoss = Object.values(lostByCapacity).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), 0);
    if (capacityLoss > 0) summaryParts.push(`Propadlo kvůli skladu ${capacityLoss}`);
    const keptForRecycling = clinicRecyclingFresh.reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry.amount || 0))), 0);
    if (keptForRecycling > 0) summaryParts.push(`Pro recyklaci ${keptForRecycling}`);
    if (expiredCount > 0) summaryParts.push(`Expirovalo ${expiredCount}`);
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
    summaryParts.push(`Síť x${mechanics.exchangeNetwork?.incomeMultiplier?.toFixed(2) || "1.00"}`);
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
    summaryParts.push(`Síť x${mechanics.arcadeNetwork?.incomeMultiplier?.toFixed(2) || "1.00"}`);
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
    summaryParts.push(`Dirty +${formatDistrictBuildingMoney(actionProfile.dirty)}`);
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
        auditRiskBoostPct: Math.max(0, Number(actionProfile.auditRiskBoostPct || 0)),
        auditRiskReductionPct: Math.max(0, Number(actionProfile.auditRiskReductionPct || 0)),
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

  runDistrictBuildingActionFromContext(root, context, actionIndex, { shell });
}

function runDistrictBuildingActionFromContext(root, context, actionIndex, options = {}) {
  const profile = getDistrictBuildingDetailProfile(context.buildingName);
  const action = profile.actions[actionIndex];
  if (!action) {
    return false;
  }

  const mechanics = resolveDistrictBuildingDetailMechanics(context.district, context.buildingName);
  const cooldownUntil = Number(mechanics.actionCooldowns?.[actionIndex] || 0);
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  if (cooldownRemaining > 0) {
    setBuildingActionFeedback(root, "warning", action, `Akce má cooldown ${formatDistrictBuildingCooldown(cooldownRemaining)}.`, context.buildingName);
    return false;
  }

  const actionProfile = getDistrictBuildingSpecialActionProfile(context.buildingName, actionIndex);
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
  const actionCooldownMs = actionProfile && Object.prototype.hasOwnProperty.call(actionProfile, "cooldownMs")
    ? Math.max(0, Number(actionProfile.cooldownMs || 0))
    : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS;
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

  updateDistrictBuildingDetailEntry(context.district, context.buildingName, (entry) => ({
    ...entry,
    activeEffects: actionResult.activeEffect
      ? [...(entry.activeEffects || []), actionResult.activeEffect]
      : (entry.activeEffects || []),
    actionCooldowns: {
      ...(entry.actionCooldowns || {}),
      [actionIndex]: Date.now() + actionCooldownMs
    }
  }));

  setBuildingActionFeedback(
    root,
    "success",
    action,
    actionResult.summary,
    context.district?.id ? `${context.buildingName} · District ${context.district.id}` : context.buildingName
  );
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
    }
  });
}

function ensureDistrictBuildingDetailPopup(root, popupKey = "") {
  return ensureBuildingDetailPanel(root, {
    onClose: () => syncBuildingDetailTopbarVisibility(root),
    onCollect: (shell) => collectDistrictBuildingDetailOutput(root, shell),
    onUpgrade: (shell) => upgradeDistrictBuildingDetail(root, shell),
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

  districtBuildingDetailContextByShell.set(shell, { district, buildingName, displayName: displayLabel });
  shell.dataset.districtBuildingDetailKey = popupKey;
  shell.dataset.districtBuildingDetailName = normalizeBuildingLookupKey(buildingName) || "building";
  shell.dataset.districtBuildingDetailDistrictId = district?.id == null ? "unknown" : String(district.id);
  shell.dataset.buildingMechanicsType = mechanics.mechanicsType;
  closeOtherDistrictBuildingDetailPopups(root, shell);

  const info = shell.querySelector("[data-district-building-detail-info]");

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
    setBuildingActionFeedback(root, "warning", displayLabel, "Škola je plná. Studenti čekají na vybrání.", "Plná kapacita");
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
    economyState: getResolvedEconomyState(),
    playerHeat: getResolvedGangState().heat,
    actionProfiles: (Array.isArray(profile.actions) ? profile.actions : []).map((_, actionIndex) => getDistrictBuildingSpecialActionProfile(buildingName, actionIndex)),
    now
  });
  renderBuildingDetailPanel({ shell, ...viewModel });
  syncBuildingDetailTopbarVisibility(root);
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
  const spyResultPayload = getResultPayloadBuilders().createSpyResultPayload({
    mission,
    scenarioLabel,
    knownDefensePower,
    isUnownedDistrict
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
  const gamePhase = interactionState.gamePhase || "launch";

  if (gamePhase === "launch" && !ownedDistrictIds.has(districtId)) {
    return resolveMapLaunchUnownedFillStyle();
  }

  const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || START_PHASE_OWNER_BY_DISTRICT_ID;
  const launchOwnerId = gamePhase === "launch"
    ? launchOwnerByDistrictId.get(districtId)
    : null;

  if (launchOwnerId) {
    const playerColor = getLaunchPlayerColor(launchOwnerId);
    return applyHexAlpha(playerColor, MAP_OWNER_FILL_ALPHA);
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
  drawOccupyCountdownLabel,
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
  createDistrictGeometry,
  normalizeMapVisibilityMode,
  getEffectiveOwnedDistrictIds,
  getCurrentPlayerOwnedDistrictIds,
  startPhaseOwnerByDistrictId: START_PHASE_OWNER_BY_DISTRICT_ID,
  getAllianceMapBadge,
  getBountyDistrictMarkers,
  getLaunchPlayerColor,
  getLaunchPlayerLabel,
  getDistrictFillStyle,
  drawDistrictPolygon,
  drawAllianceDistrictBadge,
  drawCurrentPlayerFactionBadge,
  drawBountyDistrictHighlight,
  drawBountyDistrictBadge,
  drawReducedMapActivityMarker,
  drawOccupyCountdownLabel,
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
      interactionOverlay: MAP_INTERACTION_OVERLAY_CLASS,
      hoverCanvas: MAP_HOVER_CANVAS_CLASS
    }
  });
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
    hoverCanvas
  } = mapShell;
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

  if (!mapShell.canRender) {
    return;
  }
  const hoverCanvasContext = hoverCanvas?.getContext?.("2d") || null;
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
    reducedMapEffects: initialSettings.reducedMapEffects,
    mapVisibilityMode: initialSettings.mapVisibilityMode,
    gamePhase: phaseHost.dataset.gamePhase || "launch",
    revealedDistrictIds: new Set(),
    ownedDistrictIds: new Set(initialWorldState.ownedDistrictIds),
    destroyedDistrictIds: new Set(initialWorldState.destroyedDistrictIds),
    launchOwnerByDistrictId: new Map(START_PHASE_OWNER_BY_DISTRICT_ID),
    ...initialMissionMarkers,
    animationTick: 0,
    geometryCache: null
  };
  let geometry = null;
  let imageSet = null;
  let spyAnimationFrameId = null;
  let popupRefreshTimerId = null;
  let isDistrictPopupOverviewEnabled = false;
  let lastTooltipDistrictId = null;
  let tooltipSize = { width: 84, height: 52 };
  let lastMissionAnimationAt = 0;
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
    clearPendingAttackContext();
    closeAttackPanel({ popup: attackSetupPopup });
  };

  const closeAttackConfirmPopup = () => {
    clearPendingAttackContext();
    closeAttackPanel({ popup: attackConfirmPopup });
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
    closeSpyPanel({ popup: spyConfirmPopup });
  };

  const closeOccupyConfirmPopup = () => {
    if (occupyConfirmPopup) {
      occupyConfirmPopup.hidden = true;
    }
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
    const popupTarget = options.preferGenericDetail ? null : resolveBuildingPopupTarget(buildingLabel);
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
    formatDistrictBuildingTierLabel,
    getCurrentPlayerOwnedDistrictIds,
    getDistrictTrapControlState,
    getGeometry: () => geometry,
    getInteractionState: () => interactionState,
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
  const applyDistrictPopupOverviewMode = () => {
    if (!popupCard) {
      return;
    }

    popupCard.dataset.overviewEnabled = isDistrictPopupOverviewEnabled ? "true" : "false";

    if (popupToggle instanceof HTMLButtonElement) {
      popupToggle.textContent = "Přehled";
      popupToggle.setAttribute("aria-label", isDistrictPopupOverviewEnabled ? "Vypnout přehled districtu" : "Zapnout přehled districtu");
      popupToggle.setAttribute("aria-pressed", isDistrictPopupOverviewEnabled ? "true" : "false");
    }
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
    attackSetupWeapons: ATTACK_SETUP_WEAPONS,
    attackWeaponLabels: ATTACK_WEAPON_LABELS,
    calculateAttackDeployment,
    calculateTotalDefensePower,
    clamp,
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
    renderAttackConfirmPanel,
    renderAttackPanel,
    renderAttackProgress,
    renderSpyPanel,
    resolveAttackOutcome,
    robberyCooldownMs: ROBBERY_COOLDOWN_MS,
    spyCooldownMs: SPY_COOLDOWN_MS,
    validateAttackSelection,
    elements: {
      attackAvailablePopulation,
      attackConfirmButton,
      attackConfirmCard,
      attackConfirmDuration,
      attackConfirmFinalButton,
      attackConfirmMembers,
      attackConfirmNote,
      attackConfirmPopup,
      attackConfirmPower,
      attackConfirmScenario,
      attackConfirmSource,
      attackConfirmTitle,
      attackEstimatedPower,
      attackOwnedElements,
      attackRequiredPopulation,
      attackSetupAtmosphereImage,
      attackSetupAtmosphereLabel,
      attackSetupCard,
      attackSetupPopup,
      attackSourceSelect,
      attackStatus,
      attackTargetTitle,
      attackWeaponInputs,
      defenseConfirmButton,
      defenseEstimatedPower,
      defenseOwnedElements,
      defenseResidentsInput,
      defenseSetupAtmosphereImage,
      defenseSetupAtmosphereLabel,
      defenseSetupCard,
      defenseSetupPopup,
      defenseStatus,
      defenseTargetTitle,
      defenseWeaponInputs,
      gangMembersValue,
      occupyConfirmButton,
      occupyConfirmCondition,
      occupyConfirmDuration,
      occupyConfirmNote,
      occupyConfirmSource,
      occupyConfirmTitle,
      occupyConfirmAtmosphereImage,
      occupyConfirmAtmosphereLabel,
      occupyConfirmCard,
      robberyAvailableMembers,
      robberyConfirmButton,
      robberyConfirmDuration,
      robberyConfirmFinalButton,
      robberyConfirmMembers,
      robberyConfirmNote,
      robberyConfirmSource,
      robberyConfirmTitle,
      robberyConfirmAtmosphereImage,
      robberyConfirmAtmosphereLabel,
      robberyConfirmCard,
      robberyMemberInput,
      robberySetupAtmosphereImage,
      robberySetupAtmosphereLabel,
      robberySetupCard,
      robberySetupPopup,
      robberySourceSelect,
      robberyStatus,
      robberyTargetTitle,
      spyConfirmAvailable,
      spyConfirmButton,
      spyConfirmCard,
      spyConfirmDuration,
      spyConfirmAtmosphereImage,
      spyConfirmAtmosphereLabel,
      spyConfirmNote,
      spyConfirmPopup,
      spyConfirmSource,
      spyConfirmTitle,
      trapConfirmAtmosphereImage,
      trapConfirmAtmosphereLabel,
      trapConfirmButton,
      trapConfirmCard,
      trapConfirmCooldown,
      trapConfirmNote,
      trapConfirmTitle
    }
  });
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

  const applyAttackAction = (selectedDistrict) => {
    if (!selectedDistrict) {
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
      meta: `Síla ${createdOrder.estimatedAttackPower} · Obrana ${createdOrder.targetDefensePower} · Obyvatelé ${context.totalResidents} · cooldown ${Math.ceil(context.boostContext.cooldownMs / 1000)}s`
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
    const ownerLabel = getDistrictOwnerLabel(district, interactionState);
    const isOwnedByCurrentPlayer = currentPlayerOwnedDistrictIds.has(district.id);
    const isDestroyed = interactionState.destroyedDistrictIds.has(Number(district.id));
    const hasKnownDefense = hasKnownDistrictDefense(district);
    const activePoliceAction = getDistrictPoliceAction(district.id);
    const trapControlState = getDistrictTrapControlState(district);

    renderSelectedDistrictSummary(buildSelectedDistrictSummaryViewModel(district, interactionState, {
      atmosphereMeta,
      currentPlayerId: CURRENT_PLAYER_ID,
      factionCatalog: FACTION_CATALOG,
      getLaunchPlayerAvatar,
      getLaunchPlayerFactionId,
      resolveOwnerLabel: getDistrictOwnerLabel
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

    renderDistrictPopupFlags(buildDistrictPopupFlagsViewModel({
      isDestroyed,
      isOwnedByCurrentPlayer,
      ownerLabel,
      adjacentOwnedCount: adjacentOwnedDistrictIds.length,
      hasKnownDefense,
      activePoliceAction,
      isOccupying,
      canOccupyAfterSpy,
      hasTrapHere: currentTrapDistrictId === district.id
    }));

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

    renderDistrictActionHub(buildDistrictActionViewModel(district, {
      activePoliceAction,
      resolvedActions,
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

    popup.hidden = false;
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
      ensureDistrictPassiveGossip
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
    geometry = renderDistrictCanvas(canvas, phaseHost.dataset.mapPhase || "day", interactionState, imageSet);
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
    if ((deltaX * deltaX) + (deltaY * deltaY) >= MAP_DISTRICT_SELECTION_DRAG_THRESHOLD * MAP_DISTRICT_SELECTION_DRAG_THRESHOLD) {
      districtSelectionGesture.moved = true;
    }
  };

  const endDistrictSelectionGesture = (event) => {
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
  };

  const render = () => {
    syncPhaseHostFromAuthority(phaseHost);
    interactionState.borderColor = phaseHost.dataset.borderColor || "white";
    interactionState.gamePhase = phaseHost.dataset.gamePhase || "launch";
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

    if (interactionState.reducedMapEffects || !hasActiveMissions) {
      if (spyAnimationFrameId !== null) {
        window.cancelAnimationFrame(spyAnimationFrameId);
        spyAnimationFrameId = null;
      }
      lastMissionAnimationAt = 0;
      return;
    }

    if (spyAnimationFrameId !== null) {
      return;
    }

    const animate = (time) => {
      if (time - lastMissionAnimationAt < 66) {
        spyAnimationFrameId = window.requestAnimationFrame(animate);
        return;
      }
      lastMissionAnimationAt = time;
      syncMapMissionMarkers(Date.now());

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

  phaseHost.addEventListener("mapphasechange", render);
  phaseHost.addEventListener("mapborderchange", render);
  document.addEventListener("empire:settings-changed", (event) => {
    const settings = event.detail?.settings || getSettingsState();
    interactionState.showDistrictBorders = Boolean(settings.mapDistrictBorders);
    interactionState.showAllianceSymbols = Boolean(settings.mapAllianceSymbols);
    interactionState.reducedMapEffects = Boolean(settings.reducedMapEffects);
    interactionState.mapVisibilityMode = normalizeMapVisibilityMode(settings.mapVisibilityMode);
    render();
    ensureMissionAnimationLoop();
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

    const now = window.performance.now();
    const mapNavigationSuppressUntil = Number(viewport.dataset.mapGestureSuppressUntil || 0);
    if (now < districtSelectionGesture.suppressClickUntil || now < mapNavigationSuppressUntil) {
      districtSelectionGesture.suppressClickUntil = 0;
      delete viewport.dataset.mapGestureSuppressUntil;
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
        const selectedType = String(baseButton.dataset.buildingsSelectBaseType || getActiveBuildingsDistrictType() || "").trim();

        if (!selectedBaseName || !selectedType) {
          return;
        }

        selectBuildingsPopupBaseName(selectedType, selectedBaseName);
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
        openAttackPanel(selectedDistrict, { popup: attackSetupPopup });
        return;
      }

      if (actionId === "spy") {
        populateSpyConfirmPopup(selectedDistrict);
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
  },
  onGamePhaseToggle: ({ gamePhase, updateGamePhaseLabel }) => {
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
    updateGamePhaseLabel();
  }
});

const {
  bindBuildingActionStatus
} = createBuildingActionStatusRuntime({
  BUILDING_ACTION_EMPTY_SNAPSHOT,
  MutationObserver: typeof MutationObserver !== "undefined" ? MutationObserver : null,
  buildingActionEmptySnapshot: BUILDING_ACTION_EMPTY_SNAPSHOT,
  buildingActionRemoveSelector: BUILDING_ACTION_REMOVE_SELECTOR,
  createBuildingActionFingerprint,
  openCurrentBuildingActionResultModal,
  queueOrOpenResultModal,
  renderBuildingActionFeed,
  resolveBuildingActionPanel,
  scheduleBuildingActionMutationCapture
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
  getResolvedDrugInventory, getStoredFactorySupplies, clearLegacyState, renderSpyResourceState,
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
  onClearLog: ({ renderFeedback, syncWantedStatus }) => {
    clearGangHeatJournal();
    renderFeedback("success", "Heat log je vyčištěný.");
    syncWantedStatus();
  },
  selectors: {
    cleanAction: WANTED_POPUP_CLEAN_ACTION_SELECTOR,
    clearLog: WANTED_POPUP_CLEAR_LOG_SELECTOR,
    dirtyAction: WANTED_POPUP_DIRTY_ACTION_SELECTOR,
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
  getResolvedGangState,
  getStoredRegistration,
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
  tickMs: 1000,
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
    const nextCityMinutes = ((currentPhaseState.cityMinutes ?? (22 * 60 + 14)) + minuteStep) % (24 * 60);

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

function refreshAllUi(state = null) {
  const snapshot = state?.root ? state : hydrateInitialState(resolveRuntimeRoot(state));
  const root = snapshot.root;

  if (!root) {
    return snapshot;
  }

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

function createFreeSessionUiContext(root) {
  const session = getAuthoritySession();
  return {
    registration: getStoredRegistration(),
    world: getResolvedWorldState(),
    inventory: session.inventory || {},
    spy: {
      ...getResolvedSpyState(),
      intel: getResolvedSpyIntel()
    },
    spyIntel: getResolvedSpyIntel(),
    attackOrders: getStoredAttackOrders(),
    selectedDistrict: window.empireStreetsDistrictState?.getSelectedDistrict?.() || null,
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
    getContext: () => createFreeSessionUiContext(root)
  });
  onboardingBridgesByRoot.set(root, bridge);
  bridge.init();
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

  if (runtimeInitializedRoots.has(resolvedRoot)) {
    const context = runtimeContextsByRoot.get(resolvedRoot) || createPageContext(resolvedRoot);
    refreshAllUi(hydrateInitialState(resolvedRoot));
    return context;
  }

  const initialState = hydrateInitialState(resolvedRoot);
  const context = createPageContext(resolvedRoot);
  window.empireStreetsPage = context;
  markMounts(context);
  bindUiEvents(resolvedRoot, context);
  applySettingsState(getSettingsState());
  refreshAllUi(initialState);
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
    clearNotifications
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
      createOnboardingBridge
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
  getActionDescription,
  getActionDisabledReason,
  getActionIcon,
  getActionLabel,
  getAttackScenarioMemberLoss,
  getBuildingActionUi,
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
  syncCompletedProductionJobs
};
