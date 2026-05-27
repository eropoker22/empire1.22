import { addAuditEvent } from "./audit-log";
import { addHeat, getOwnedBuildingTypes, getOwnedDistricts, isCooldownReady, isRareBuildingType, sumNonCashResources } from "./state-helpers";
import type { SeededRng } from "./seeded-rng";
import type { FreeBrPlayer, FreeBrSimulationState } from "./types";

export const tryCraft = (state: FreeBrSimulationState, rng: SeededRng, player: FreeBrPlayer): boolean => {
  const ownedBuildingTypes = new Set(getOwnedBuildingTypes(state, player.id));
  const craftBuildings = getCraftBuildings(state)
    .filter((building) => ownedBuildingTypes.has(building.buildingType));
  if (craftBuildings.length === 0) return false;

  const buildingConfig = rng.pick(craftBuildings);
  const recipes = buildingConfig.recipes
    .filter(([recipeId]) => isCooldownReady(state, player, `craft:${buildingConfig.buildingType}:${recipeId}`));
  if (recipes.length === 0) return false;
  const [recipeId, recipe] = rng.pick(recipes);
  const cooldownTicks = Math.max(1, Math.ceil(recipe.durationTicks * state.config.balance.cooldownMultiplier));
  const cashCost = Object.values(recipe.inputCosts).reduce((sum, value) => sum + value * 8, 0);
  player.cooldowns[`craft:${buildingConfig.buildingType}:${recipeId}`] = state.tick + cooldownTicks;
  player.resources[recipe.outputResourceKey] = (player.resources[recipe.outputResourceKey] ?? 0) + recipe.outputAmount;
  player.resources.cash = Math.max(0, (player.resources.cash ?? 0) - cashCost);
  player.lastActionTick = state.tick;
  state.stats[player.id].craftActions += 1;
  addAuditEvent(state, {
    player,
    actionType: "craft-item",
    result: recipeId,
    cashDelta: -cashCost,
    notes: `${buildingConfig.buildingType}: ${recipe.label} (${cooldownTicks} ticks cooldown approximation)`
  });
  return true;
};

export const tryBuildingAction = (
  state: FreeBrSimulationState,
  rng: SeededRng,
  player: FreeBrPlayer,
  preferredBuildingTypes: string[] = []
): boolean => {
  const buildingActionsByType = getBuildingActionsByType(state);
  const ownedBuildingTypes = preferredBuildingTypes.length > 0
    ? preferredBuildingTypes
    : getOwnedBuildingTypes(state, player.id);
  const actions = ownedBuildingTypes
    .flatMap((buildingType) => buildingActionsByType[buildingType] ?? [])
    .filter((action) => preferredBuildingTypes.length === 0 || (state.ownedBuildingTypeCountsByPlayer[player.id]?.[action.buildingType] ?? 0) > 0)
    .filter((action) => isCooldownReady(state, player, `building:${action.actionId}`));
  if (actions.length === 0) return false;
  const action = rng.pick(actions);
  const cooldownTicks = Math.max(1, Math.ceil((action.cooldownMs / state.config.tickRateMs) * state.config.balance.cooldownMultiplier));
  const cashGain = action.outputGain.cash ?? 0;
  const dirtyCashGain = action.outputGain["dirty-cash"] ?? 0;
  player.cooldowns[`building:${action.actionId}`] = state.tick + cooldownTicks;
  player.lastActionTick = state.tick;
  for (const [resourceKey, amount] of Object.entries(action.outputGain ?? {})) {
    player.resources[resourceKey] = (player.resources[resourceKey] ?? 0) + amount;
  }
  for (const [resourceKey, amount] of Object.entries(action.inputCost ?? {})) {
    player.resources[resourceKey] = Math.max(0, (player.resources[resourceKey] ?? 0) - amount);
  }
  player.resources.influence = (player.resources.influence ?? 0) + (action.influenceChange ?? 0);
  state.stats[player.id].buildingActions += 1;
  state.stats[player.id].cashEarned += cashGain;
  state.stats[player.id].dirtyCashEarned += dirtyCashGain;
  state.hourlyCounters.buildingActions += 1;
  if (isRareBuildingType(action.buildingType)) state.counters.rareBuildingActions += 1;
  addHeat(state, player, action.heatGain ?? 0, getOwnedDistricts(state, player.id).find((district) => district.buildingType === action.buildingType) ?? null);
  addAuditEvent(state, {
    player,
    actionType: "run-building-action",
    result: action.actionId,
    heatDelta: action.heatGain ?? 0,
    cashDelta: cashGain,
    dirtyCashDelta: dirtyCashGain,
    influenceDelta: action.influenceChange ?? 0,
    notes: `${action.buildingType}: ${action.label}`
  });
  return true;
};

export const maybeAssistAlly = (state: FreeBrSimulationState, rng: SeededRng, player: FreeBrPlayer): void => {
  if (!player.allianceId || !rng.chance(player.alliancePreference * 0.2)) return;
  const ally = state.players.find((candidate) => candidate.status === "active" && candidate.allianceId === player.allianceId && candidate.id !== player.id);
  if (!ally) return;
  ally.resources.cash = (ally.resources.cash ?? 0) + 180;
  ally.resources["metal-parts"] = (ally.resources["metal-parts"] ?? 0) + 1;
  const alliance = state.alliances.find((candidate) => candidate.id === player.allianceId);
  if (alliance) alliance.helpedActions += 1;
  addAuditEvent(state, {
    player,
    actionType: "assist-ally",
    targetPlayerId: ally.id,
    result: "support-sent",
    cashDelta: -180,
    notes: "alliance danger-zone support"
  });
};

export const maybeRunPoliceRaids = (state: FreeBrSimulationState, rng: SeededRng): void => {
  const police = state.config.balance.police;
  if (!police) return;
  const activeRaidKey = "police-raid-active";
  let activeRaidCount = state.players.filter((player) => (player.cooldowns[activeRaidKey] ?? 0) > state.tick).length;
  const phase = resolveSimulationDayNightPhase(state);
  const maxConcurrentRaids = Math.max(
    0,
    Math.floor(Number(police.maxConcurrentRaidsByPhase?.[phase] ?? police.maxPendingRaidsPerPlayer ?? 1))
  );
  const raidDurationTicks = Math.max(1, Math.floor(Number(police.raidDurationTicks || police.pendingRaidTtlTicks || 1)));
  for (const player of state.players.filter((candidate) => candidate.status === "active")) {
    const cooldownKey = "police-raid";
    if (!isCooldownReady(state, player, cooldownKey)) continue;
    if (activeRaidCount >= maxConcurrentRaids) continue;
    const pressure = player.heat;
    const threshold = police.highPressureRaidThreshold;
    if (pressure < threshold) continue;
    const severity = pressure >= police.extremePressureRaidThreshold ? "extreme" : "high";
    const chance = severity === "extreme" ? 0.42 : 0.18;
    if (!rng.chance(chance)) continue;
    const dirtySeized = Math.floor((player.resources["dirty-cash"] ?? 0) * (police.dirtyCashSeizurePercentBySeverity[severity] ?? 0));
    const resourceSeized = Math.floor(sumNonCashResources(player) * (police.resourceSeizurePercentBySeverity[severity] ?? 0));
    player.resources["dirty-cash"] = Math.max(0, (player.resources["dirty-cash"] ?? 0) - dirtySeized);
    player.heat = Math.max(0, player.heat - (police.heatReductionBySeverity[severity] ?? 0));
    player.cooldowns[cooldownKey] = state.tick + police.raidCooldownTicks;
    player.cooldowns[activeRaidKey] = state.tick + raidDurationTicks;
    activeRaidCount += 1;
    state.stats[player.id].policeRaidsReceived += 1;
    state.counters.dirtyCashSeized += dirtySeized;
    state.counters.resourceSeized += resourceSeized;
    addAuditEvent(state, {
      player,
      actionType: "police-raid",
      result: severity,
      dirtyCashDelta: -dirtySeized,
      notes: `dirty seized ${dirtySeized}, abstract resources seized ${resourceSeized}`
    });
  }
};

const resolveSimulationDayNightPhase = (state: FreeBrSimulationState): "day" | "night" => {
  const dayTicks = Math.max(1, Math.floor(Number(state.config.balance.dayLengthTicks || 1)));
  const nightTicks = Math.max(1, Math.floor(Number(state.config.balance.nightLengthTicks || 1)));
  const cycleTick = state.tick % (dayTicks + nightTicks);
  return cycleTick < dayTicks ? "day" : "night";
};

type CraftBuildingConfig = NonNullable<FreeBrSimulationState["config"]["balance"]["craftBuildings"]>[string];
type CraftRecipeConfig = CraftBuildingConfig["recipes"][string];
type BuildingActionConfig = NonNullable<FreeBrSimulationState["config"]["balance"]["buildingActions"]>[string];

const craftBuildingsCache = new WeakMap<object, Array<{ buildingType: string; recipes: Array<[string, CraftRecipeConfig]> }>>();
const buildingActionsByTypeCache = new WeakMap<object, Record<string, BuildingActionConfig[]>>();

const getCraftBuildings = (state: FreeBrSimulationState): Array<{ buildingType: string; recipes: Array<[string, CraftRecipeConfig]> }> => {
  const balance = state.config.balance as object;
  const cached = craftBuildingsCache.get(balance);
  if (cached) return cached;
  const entries = Object.entries(state.config.balance.craftBuildings ?? {}).map(([buildingType, buildingConfig]) => ({
    buildingType,
    recipes: Object.entries(buildingConfig.recipes ?? {})
  }));
  craftBuildingsCache.set(balance, entries);
  return entries;
};

const getBuildingActionsByType = (state: FreeBrSimulationState): Record<string, BuildingActionConfig[]> => {
  const balance = state.config.balance as object;
  const cached = buildingActionsByTypeCache.get(balance);
  if (cached) return cached;
  const grouped: Record<string, BuildingActionConfig[]> = {};
  for (const action of Object.values(state.config.balance.buildingActions ?? {})) {
    grouped[action.buildingType] ??= [];
    grouped[action.buildingType].push(action);
  }
  buildingActionsByTypeCache.set(balance, grouped);
  return grouped;
};

export const applyPassiveIncomeAndHeatDecay = (state: FreeBrSimulationState, stepTicks: number): void => {
  const hours = stepTicks * state.config.tickRateMs / (60 * 60 * 1000);
  const fixedBuildings = state.config.balance.fixedBuildings ?? {};
  for (const district of state.districts) {
    if (!district.ownerPlayerId || district.status === "destroyed") continue;
    const owner = state.players.find((player) => player.id === district.ownerPlayerId && player.status === "active");
    if (!owner) continue;
    const profile = fixedBuildings[district.buildingType] ?? null;
    const clean = (profile?.cleanPerHour ?? district.value * 25) * hours * state.config.balance.incomeMultiplier;
    const dirty = (profile?.dirtyPerHour ?? district.value * 8) * hours * state.config.balance.incomeMultiplier;
    const influence = ((profile?.influencePerDay ?? district.value * 12) / 24) * hours;
    const heat = ((profile?.heatPerDay ?? district.value * 5) / 24) * hours;
    owner.resources.cash = (owner.resources.cash ?? 0) + clean;
    owner.resources["dirty-cash"] = (owner.resources["dirty-cash"] ?? 0) + dirty;
    owner.resources.influence = (owner.resources.influence ?? 0) + influence;
    district.influence += influence * 0.1;
    district.heat += heat;
    owner.heat += heat * 0.35;
    state.stats[owner.id].cashEarned += clean;
    state.stats[owner.id].dirtyCashEarned += dirty;
  }
  const police = state.config.balance.police;
  for (const player of state.players) {
    const decay = police?.heatDecay?.playerDecayByWantedLevel?.[0] ?? 2;
    player.heat = Math.max(0, player.heat - decay * hours * 2);
  }
  for (const district of state.districts) {
    const decay = police?.heatDecay?.districtBaseDecay ?? 2;
    district.heat = Math.max(0, district.heat - decay * hours);
  }
};
