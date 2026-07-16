import type {
  AdminProjectionHealth,
  AdminProjectionSource,
  AdminRuntimeDetailProjection,
  AdminRuntimeDistrictProjection,
  AdminRuntimeEventProjection,
  AdminRuntimeOrderProjection,
  AdminRuntimePendingRaidProjection,
  AdminRuntimePlayerProjection,
  AdminRuntimeProductionBuildingProjection,
  AdminRuntimeProductionProjection,
  AdminRuntimeResourceHolderProjection
} from "@empire/shared-types";
import { sharedCitySpawnPool } from "../../bootstrap/gameplay-slice-shared-city-seed";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import {
  sanitizeAdminMonitoringPayloadPreview,
  sanitizeAdminMonitoringText
} from "./admin-monitoring-sanitizer";
import { createAdminLivenessProjection } from "./admin-liveness-projection";

const STALE_AFTER_SECONDS = 30;
const MAX_EVENT_ROWS = 50;
const MAX_ORDER_ROWS = 80;
const ORDER_COOLDOWN_PREFIXES = ["spy:", "attack:", "occupy:", "rob:", "rob-source:", "heist:", "heist-source:"];
const KEY_RESOURCE_ORDER = [
  "cash",
  "dirty-cash",
  "materials",
  "weapons",
  "chemicals",
  "biomass",
  "metal-parts",
  "tech-core",
  "combat-module"
];

export const createAdminRuntimeDetailProjection = (
  runtimes: ServerInstanceRuntime[],
  nowIso: string
): AdminRuntimeDetailProjection => {
  const selectedRuntime = runtimes[0] ?? null;
  const selectedInstanceId = selectedRuntime?.record.id ?? null;
  const players = runtimes.flatMap(createPlayerProjections);
  const orders = runtimes.flatMap(createOrderProjections).slice(0, MAX_ORDER_ROWS);
  const districts = runtimes.flatMap((runtime) => createDistrictProjections(runtime, orders));
  const production = createProductionProjection(runtimes);
  const police = createPoliceProjection(runtimes);
  const events = createRuntimeEvents(runtimes);
  const economy = createEconomyProjection(runtimes);
  const stale = createStaleState(runtimes, nowIso);
  const liveness = createAdminLivenessProjection(runtimes);

  return {
    generatedAt: nowIso,
    selectedInstanceId,
    source: runtimes.length > 0 ? "runtime" : "pending",
    stale,
    projectionHealth: createProjectionHealth({
      nowIso,
      players,
      districts,
      production,
      police,
      orders,
      events,
      runtimes
    }),
    liveness,
    players,
    districts,
    economy,
    production,
    police,
    orders,
    events
  };
};

const createPlayerProjections = (
  runtime: ServerInstanceRuntime
): AdminRuntimePlayerProjection[] =>
  runtime.state.root.playerIds
    .map((playerId) => runtime.state.playersById[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .map((player) => {
      const resourceState = runtime.state.resourceStatesById[player.resourceStateId]
        ?? findResourceState(runtime, "player", player.id);
      const policeState = runtime.state.policeStatesById[player.policeStateId];
      const ownedDistricts = Object.values(runtime.state.districtsById)
        .filter((district) => district.ownerPlayerId === player.id);
      const cooldowns = runtime.state.cooldownStatesById[player.cooldownStateId]?.cooldowns ?? {};
      const activeOrdersCount = Object.entries(cooldowns)
        .filter(([key, expiresAtTick]) => isOrderCooldownKey(key) && Number(expiresAtTick) > runtime.state.root.tick)
        .length;
      const resources = sanitizeResourceBalances(resourceState?.balances ?? {});
      const heat = Math.max(0, Number(policeState?.heat || 0));
      const wantedLevel = Math.max(0, Number(policeState?.wantedLevel || 0));
      const ownedInfluence = ownedDistricts.reduce((sum, district) => sum + Math.max(0, Number(district.influence || 0)), 0);
      const warnings = [
        ...(player.homeDistrictId ? [] : ["Player has no home district / spawn selection incomplete."]),
        ...(heat >= 120 ? ["High player heat."] : []),
        ...(wantedLevel >= 4 ? ["Wanted level close to raid pressure."] : []),
        ...createNegativeResourceWarnings(resources)
      ];

      return {
        playerId: sanitizeAdminMonitoringText(player.id),
        displayName: sanitizeAdminMonitoringText(player.name),
        factionId: sanitizeAdminMonitoringText(player.factionId),
        factionName: sanitizeAdminMonitoringText(player.factionId),
        status: player.status,
        homeDistrictId: player.homeDistrictId,
        ownedDistrictCount: ownedDistricts.length,
        ownedDistrictIds: ownedDistricts.map((district) => sanitizeAdminMonitoringText(district.id)),
        resources,
        keyResources: pickKeyResources(resources),
        cash: Math.max(0, Number(resources.cash || 0)),
        dirtyCash: Math.max(0, Number(resources["dirty-cash"] || 0)),
        population: Math.max(0, Number(player.population || 0)),
        influence: ownedInfluence,
        heat,
        wantedLevel,
        onboarding: {
          status: player.homeDistrictId ? "ready_to_play" : "awaiting_spawn_selection",
          progressLabel: player.homeDistrictId ? "server spawn ready" : "spawn pending",
          source: "runtime",
          note: player.homeDistrictId
            ? "Server confirms home district. Browser-local onboarding step is not authority."
            : "Server has not assigned a home district yet."
        },
        activeOrdersCount,
        activeMissionsCount: activeOrdersCount,
        lastActionAt: player.lastActionAt,
        warnings,
        source: "runtime"
      };
    });

const createDistrictProjections = (
  runtime: ServerInstanceRuntime,
  orders: AdminRuntimeOrderProjection[]
): AdminRuntimeDistrictProjection[] => {
  const spawnCandidateIds = new Set(sharedCitySpawnPool.map((candidate) => candidate.districtId));

  return runtime.state.root.districtIds
    .map((districtId) => runtime.state.districtsById[districtId])
    .filter((district): district is NonNullable<typeof district> => Boolean(district))
    .map((district) => {
      const owner = district.ownerPlayerId ? runtime.state.playersById[district.ownerPlayerId] : null;
      const buildings = district.buildingIds
        .map((buildingId) => runtime.state.buildingsById[buildingId])
        .filter((building): building is NonNullable<typeof building> => Boolean(building));
      const activeBuildingActionsCount = buildings.reduce(
        (sum, building) => sum + Object.values(building.actionCooldowns ?? {})
          .filter((expiresAtTick) => Number(expiresAtTick) > runtime.state.root.tick).length,
        0
      );
      const productionCount = buildings.filter((building) =>
        Boolean(runtime.config.balance.productionBuildings?.[building.buildingTypeId])
      ).length;
      const craftCount = buildings.filter((building) => building.processing).length;
      const activeOrderCount = orders.filter((order) =>
        order.sourceDistrictId === district.id || order.targetDistrictId === district.id
      ).length;
      const warnings = [
        ...(district.status === "locked" ? ["District locked."] : []),
        ...(district.status === "destroyed" ? ["District destroyed."] : []),
        ...(district.lockdownUntilTick && district.lockdownUntilTick > runtime.state.root.tick ? ["Police lockdown active."] : []),
        ...(district.heat >= 100 ? ["High district heat."] : []),
        ...(district.zone === "downtown" ? ["Downtown district: closed until final lockdown rules allow it."] : [])
      ];

      return {
        districtId: sanitizeAdminMonitoringText(district.id),
        name: sanitizeAdminMonitoringText(district.name),
        zone: sanitizeAdminMonitoringText(district.zone),
        ownerPlayerId: owner?.id ?? null,
        ownerName: owner ? sanitizeAdminMonitoringText(owner.name) : null,
        status: district.status,
        population: owner?.population ?? null,
        influence: Math.max(0, Number(district.influence || 0)),
        heat: Math.max(0, Number(district.heat || 0)),
        buildingCount: buildings.length,
        activeBuildingActionsCount,
        productionStatus: productionCount > 0 || craftCount > 0
          ? `${productionCount} production / ${craftCount} craft`
          : "no active production projection",
        activeOrderCount,
        isSpawnCandidate: spawnCandidateIds.has(district.id),
        isDowntown: district.zone === "downtown",
        warnings,
        source: "runtime"
      };
    });
};

const createEconomyProjection = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeDetailProjection["economy"] => {
  const totals: Record<string, number> = {};
  const holders: AdminRuntimeResourceHolderProjection[] = [];
  const productionOutputSummary: Record<string, number> = {};

  for (const runtime of runtimes) {
    for (const player of Object.values(runtime.state.playersById)) {
      const balances = sanitizeResourceBalances(
        (runtime.state.resourceStatesById[player.resourceStateId]
          ?? findResourceState(runtime, "player", player.id))?.balances ?? {}
      );

      for (const [resourceKey, amount] of Object.entries(balances)) {
        totals[resourceKey] = Math.max(0, Number(totals[resourceKey] || 0)) + Math.max(0, Number(amount || 0));
        holders.push({
          playerId: sanitizeAdminMonitoringText(player.id),
          displayName: sanitizeAdminMonitoringText(player.name),
          resourceKey: sanitizeAdminMonitoringText(resourceKey),
          amount: Math.max(0, Number(amount || 0))
        });
      }
    }

    for (const building of Object.values(runtime.state.buildingsById)) {
      const profile = runtime.config.balance.productionBuildings?.[building.buildingTypeId];
      if (!profile) continue;
      const buildingResource = findResourceState(runtime, "building", building.id);
      const stored = Math.max(0, Number(buildingResource?.balances?.[profile.resourceKey] || 0));
      productionOutputSummary[profile.resourceKey] = Math.max(0, Number(productionOutputSummary[profile.resourceKey] || 0)) + stored;
    }
  }

  return {
    source: runtimes.length > 0 ? "runtime" : "pending",
    totalCleanCash: Math.max(0, Number(totals.cash || 0)),
    totalDirtyCash: Math.max(0, Number(totals["dirty-cash"] || 0)),
    totalResources: totals,
    topResourceHolders: holders
      .filter((holder) => holder.amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 10),
    productionOutputSummary,
    marketRiskNotes: [
      "Admin v1.1 only observes totals. It does not price or rebalance the market.",
      "Resource grants remain locked."
    ],
    warnings: createEconomyWarnings(totals)
  };
};

const createProductionProjection = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeProductionProjection => {
  const activeProductionBuildings: AdminRuntimeProductionBuildingProjection[] = [];
  const activeCraftJobs: AdminRuntimeProductionProjection["activeCraftJobs"] = [];
  const cooldowns: AdminRuntimeProductionProjection["cooldowns"] = [];

  for (const runtime of runtimes) {
    for (const building of Object.values(runtime.state.buildingsById)) {
      const productionProfile = runtime.config.balance.productionBuildings?.[building.buildingTypeId];
      if (productionProfile) {
        const buildingResource = findResourceState(runtime, "building", building.id);
        const stored = Math.max(0, Number(buildingResource?.balances?.[productionProfile.resourceKey] || 0));
        const storageCap = Math.max(0, Number(productionProfile.storageCap || 0));
        activeProductionBuildings.push({
          buildingId: sanitizeAdminMonitoringText(building.id),
          buildingTypeId: sanitizeAdminMonitoringText(building.buildingTypeId),
          displayName: sanitizeAdminMonitoringText(building.displayName ?? building.buildingTypeId),
          districtId: sanitizeAdminMonitoringText(building.districtId),
          ownerPlayerId: sanitizeAdminMonitoringText(building.ownerPlayerId),
          resourceKey: sanitizeAdminMonitoringText(productionProfile.resourceKey),
          resourceLabel: sanitizeAdminMonitoringText(productionProfile.resourceLabel),
          stored,
          storageCap,
          readyToCollect: stored > 0,
          storageFull: storageCap > 0 && stored >= storageCap,
          source: "runtime"
        });
      }

      if (building.processing) {
        const craftProfile = runtime.config.balance.craftBuildings?.[building.buildingTypeId];
        const recipe = craftProfile?.recipes[building.processing.recipeId];
        const remainingTicks = Math.max(0, building.processing.completesAtTick - runtime.state.root.tick);
        activeCraftJobs.push({
          buildingId: sanitizeAdminMonitoringText(building.id),
          buildingTypeId: sanitizeAdminMonitoringText(building.buildingTypeId),
          districtId: sanitizeAdminMonitoringText(building.districtId),
          ownerPlayerId: sanitizeAdminMonitoringText(building.ownerPlayerId),
          recipeId: sanitizeAdminMonitoringText(building.processing.recipeId),
          recipeLabel: sanitizeAdminMonitoringText(recipe?.label ?? building.processing.recipeId),
          startedTick: building.processing.startedAtTick,
          completesTick: building.processing.completesAtTick,
          remainingTicks,
          remainingLabel: formatRemaining(remainingTicks, runtime.config.tickRateMs),
          source: "runtime"
        });
      }

      for (const [key, expiresAtTick] of Object.entries(building.actionCooldowns ?? {})) {
        const remainingTicks = Math.max(0, Number(expiresAtTick) - runtime.state.root.tick);
        if (remainingTicks <= 0) continue;
        cooldowns.push({
          ownerType: "building",
          ownerId: sanitizeAdminMonitoringText(building.id),
          key: sanitizeAdminMonitoringText(key),
          remainingTicks,
          remainingLabel: formatRemaining(remainingTicks, runtime.config.tickRateMs),
          source: "runtime"
        });
      }
    }
  }

  const storageFullCount = activeProductionBuildings.filter((building) => building.storageFull).length;

  return {
    source: runtimes.length > 0 ? "runtime" : "pending",
    activeProductionBuildings,
    readyCollectCount: activeProductionBuildings.filter((building) => building.readyToCollect).length,
    storageFullCount,
    activeCraftJobs,
    bottleneckResources: createBottleneckResources(runtimes),
    cooldowns,
    warnings: [
      ...(storageFullCount > 0 ? [`${storageFullCount} production storage slot(s) are full.`] : []),
      ...(activeProductionBuildings.length === 0 ? ["No production buildings are visible in runtime state yet."] : [])
    ]
  };
};

const createPoliceProjection = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeDetailProjection["police"] => {
  const wantedPlayers = runtimes.flatMap((runtime) =>
    Object.values(runtime.state.policeStatesById)
      .map((policeState) => {
        const player = runtime.state.playersById[policeState.ownerPlayerId];
        return {
          playerId: sanitizeAdminMonitoringText(policeState.ownerPlayerId),
          displayName: sanitizeAdminMonitoringText(player?.name ?? policeState.ownerPlayerId),
          heat: Math.max(0, Number(policeState.heat || 0)),
          wantedLevel: Math.max(0, Number(policeState.wantedLevel || 0)),
          activeFlags: (policeState.activeFlags ?? []).map(sanitizeAdminMonitoringText)
        };
      })
      .sort((left, right) => right.heat - left.heat)
  );
  const districtHotspots = runtimes.flatMap((runtime) =>
    Object.values(runtime.state.districtsById)
      .filter((district) => Math.max(0, Number(district.heat || 0)) > 0)
      .map((district) => ({
        districtId: sanitizeAdminMonitoringText(district.id),
        name: sanitizeAdminMonitoringText(district.name),
        heat: Math.max(0, Number(district.heat || 0)),
        ownerPlayerId: district.ownerPlayerId
      }))
  ).sort((left, right) => right.heat - left.heat).slice(0, 12);
  const pendingRaids: AdminRuntimePendingRaidProjection[] = runtimes.flatMap((runtime) =>
    Object.values(runtime.state.policeStatesById).flatMap((policeState) =>
      (policeState.pendingRaids ?? [])
        .filter((raid) => raid.status === "pending" || raid.status === "acknowledged")
        .map((raid) => ({
          raidId: sanitizeAdminMonitoringText(raid.raidId),
          playerId: sanitizeAdminMonitoringText(raid.playerId),
          targetDistrictId: raid.targetDistrictId ? sanitizeAdminMonitoringText(raid.targetDistrictId) : null,
          severity: raid.severity,
          status: raid.status,
          reason: sanitizeAdminMonitoringText(raid.reason),
          createdAtTick: raid.createdAtTick,
          expiresAtTick: raid.expiresAtTick,
          remainingTicks: Math.max(0, raid.expiresAtTick - runtime.state.root.tick),
          sourcePressure: Math.max(0, Number(raid.sourcePressure || 0))
        }))
    )
  );
  const maxHeat = wantedPlayers[0]?.heat ?? 0;

  return {
    source: runtimes.length > 0 ? "runtime" : "pending",
    heatPressure: maxHeat >= 140 ? "extreme" : maxHeat >= 90 ? "high" : maxHeat >= 40 ? "medium" : maxHeat > 0 ? "low" : "none",
    wantedPlayers,
    districtHotspots,
    pendingRaids,
    pendingRaidCount: pendingRaids.length,
    resolvedRecentEvents: createPoliceEvents(runtimes).filter((event) => event.summary.includes("resolved")).slice(0, 8),
    warnings: [
      ...(pendingRaids.length > 0 ? [`${pendingRaids.length} pending raid(s) visible.`] : []),
      ...(maxHeat >= 90 ? ["High heat pressure among active testers."] : [])
    ]
  };
};

const createOrderProjections = (
  runtime: ServerInstanceRuntime
): AdminRuntimeOrderProjection[] =>
  Object.values(runtime.state.playersById).flatMap((player) => {
    const cooldownState = runtime.state.cooldownStatesById[player.cooldownStateId];
    if (!cooldownState) return [];

    const orders: AdminRuntimeOrderProjection[] = [];
    for (const [key, expiresAtTick] of Object.entries(cooldownState.cooldowns)) {
      const remainingTicks = Math.max(0, Number(expiresAtTick) - runtime.state.root.tick);
      if (remainingTicks <= 0) continue;
      const parsed = parseOrderCooldownKey(key);
      if (!parsed) continue;

      orders.push({
        id: `cooldown:${player.id}:${key}`,
        type: parsed.type,
        playerId: sanitizeAdminMonitoringText(player.id),
        playerName: sanitizeAdminMonitoringText(player.name),
        sourceDistrictId: parsed.sourceDistrictId,
        targetDistrictId: parsed.targetDistrictId,
        status: "cooldown / action running",
        startedAtTick: null,
        resolvesAtTick: Number(expiresAtTick),
        remainingTicks,
        remainingLabel: formatRemaining(remainingTicks, runtime.config.tickRateMs),
        result: "pending",
        warnings: parsed.type === "attack" && remainingTicks * runtime.config.tickRateMs >= 20 * 60 * 1000
          ? ["Long attack/order wait; verify visible feedback in gameplay UI."]
          : [],
        source: "runtime"
      });
    }

    return orders;
  });

const createRuntimeEvents = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeEventProjection[] => [
  ...runtimes.flatMap((runtime) =>
    Object.values(runtime.state.eventsById).map((event) => ({
      id: sanitizeAdminMonitoringText(event.id),
      type: sanitizeAdminMonitoringText(event.eventTypeId),
      severity: event.eventTypeId.includes("raid") || event.eventTypeId.includes("police")
        ? "warning" as const
        : "notice" as const,
      createdAt: `tick:${event.startTick}`,
      tick: event.startTick,
      playerId: event.scope === "player" ? sanitizeAdminMonitoringText(event.targetIds[0] ?? "") : null,
      districtId: event.scope === "district" ? sanitizeAdminMonitoringText(event.targetIds[0] ?? "") : null,
      summary: sanitizeAdminMonitoringText(`${event.eventTypeId} · ${event.status}`),
      payloadPreview: sanitizeAdminMonitoringPayloadPreview(event.payload),
      source: "runtime" as const
    }))
  ),
  ...createPoliceEvents(runtimes),
  ...runtimes.flatMap((runtime) =>
    Object.values(runtime.state.notificationsById).map((notification) => ({
      id: sanitizeAdminMonitoringText(notification.id),
      type: sanitizeAdminMonitoringText(notification.category),
      severity: notification.category.includes("raid") || notification.category.includes("police")
        ? "warning" as const
        : "notice" as const,
      createdAt: sanitizeAdminMonitoringText(notification.createdAt),
      tick: typeof notification.payload?.tick === "number" ? notification.payload.tick : null,
      playerId: notification.recipientType === "player" ? sanitizeAdminMonitoringText(notification.recipientId) : null,
      districtId: typeof notification.payload?.districtId === "string"
        ? sanitizeAdminMonitoringText(notification.payload.districtId)
        : typeof notification.payload?.targetDistrictId === "string"
          ? sanitizeAdminMonitoringText(notification.payload.targetDistrictId)
          : null,
      summary: sanitizeAdminMonitoringText(notification.title),
      payloadPreview: sanitizeAdminMonitoringPayloadPreview(notification.payload),
      source: "runtime" as const
    }))
  )
].sort((left, right) => (right.tick ?? 0) - (left.tick ?? 0)).slice(0, MAX_EVENT_ROWS);

const createPoliceEvents = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeEventProjection[] =>
  runtimes.flatMap((runtime) =>
    Object.values(runtime.state.policeStatesById).flatMap((policeState) =>
      (policeState.policeEvents ?? []).map((event) => ({
        id: sanitizeAdminMonitoringText(event.id),
        type: sanitizeAdminMonitoringText(event.type),
        severity: event.severity === "high" || event.severity === "extreme" ? "warning" as const : "notice" as const,
        createdAt: `tick:${event.createdAtTick}`,
        tick: event.createdAtTick,
        playerId: sanitizeAdminMonitoringText(event.playerId),
        districtId: event.districtId ? sanitizeAdminMonitoringText(event.districtId) : null,
        summary: sanitizeAdminMonitoringText(event.message),
        payloadPreview: sanitizeAdminMonitoringPayloadPreview(event.payload ?? {}),
        source: "runtime" as const
      }))
    )
  );

const createProjectionHealth = (input: {
  nowIso: string;
  players: AdminRuntimePlayerProjection[];
  districts: AdminRuntimeDistrictProjection[];
  production: AdminRuntimeProductionProjection;
  police: AdminRuntimeDetailProjection["police"];
  orders: AdminRuntimeOrderProjection[];
  events: AdminRuntimeEventProjection[];
  runtimes: ServerInstanceRuntime[];
}): AdminProjectionHealth[] => {
  const source: AdminProjectionSource = input.runtimes.length > 0 ? "runtime" : "pending";
  return [
    health("servers", input.runtimes.length > 0 ? "ok" : "pending", input.nowIso, source, input.runtimes.length > 0 ? [] : ["instances"], input.runtimes.length > 0 ? "Runtime instances visible." : "No runtime instances available."),
    health("players", input.players.length > 0 ? "ok" : "pending", input.nowIso, source, input.players.length > 0 ? [] : ["players"], input.players.length > 0 ? "Player summaries projected." : "No players are present yet."),
    health("districts", input.districts.length > 0 ? "ok" : "pending", input.nowIso, source, input.districts.length > 0 ? [] : ["districts"], input.districts.length > 0 ? "District summaries projected." : "No district runtime state visible."),
    health("economy", input.players.length > 0 ? "ok" : "pending", input.nowIso, source, input.players.length > 0 ? [] : ["player resources"], input.players.length > 0 ? "Economy totals derive from resource states." : "Needs player resource states."),
    health("production", input.production.activeProductionBuildings.length > 0 ? "ok" : "warning", input.nowIso, source, input.production.activeProductionBuildings.length > 0 ? [] : ["production buildings"], input.production.activeProductionBuildings.length > 0 ? "Production storage projected." : "No production building storage visible."),
    health("police", input.police.wantedPlayers.length > 0 ? "ok" : "pending", input.nowIso, source, input.police.wantedPlayers.length > 0 ? [] : ["police states"], input.police.wantedPlayers.length > 0 ? "Heat and wanted states projected." : "No police state visible."),
    health("orders", "ok", input.nowIso, source, [], input.orders.length > 0 ? "Active cooldown/order rows visible." : "No active order cooldowns right now."),
    health("events", input.events.length > 0 ? "ok" : "warning", input.nowIso, source, input.events.length > 0 ? [] : ["events"], input.events.length > 0 ? "Runtime events/notifications projected." : "No runtime events available.")
  ];
};

const health = (
  name: string,
  status: AdminProjectionHealth["status"],
  lastUpdatedAt: string,
  source: AdminProjectionSource,
  missingFields: string[],
  message: string
): AdminProjectionHealth => ({
  name,
  status,
  lastUpdatedAt,
  missingFields,
  source,
  message
});

const createStaleState = (
  runtimes: ServerInstanceRuntime[],
  nowIso: string
): AdminRuntimeDetailProjection["stale"] => {
  const newestTickIso = runtimes
    .map((runtime) => runtime.runtimeHealth.lastTickCompletedAt ?? runtime.runtimeHealth.lastTickStartedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? nowIso;
  const ageSeconds = Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(newestTickIso)) / 1000));
  const isStale = ageSeconds > STALE_AFTER_SECONDS;

  return {
    isStale,
    thresholdSeconds: STALE_AFTER_SECONDS,
    ageSeconds,
    checkedAt: nowIso,
    source: runtimes.length > 0 ? "runtime" : "pending",
    reason: isStale
      ? `Latest runtime tick is ${ageSeconds}s old.`
      : `Latest runtime tick is within ${STALE_AFTER_SECONDS}s.`
  };
};

const parseOrderCooldownKey = (
  key: string
): Pick<AdminRuntimeOrderProjection, "type" | "sourceDistrictId" | "targetDistrictId"> | null => {
  if (key.startsWith("spy:")) return { type: "spy", sourceDistrictId: null, targetDistrictId: sanitizeAdminMonitoringText(key.slice(4)) };
  if (key.startsWith("attack:")) return { type: "attack", sourceDistrictId: null, targetDistrictId: sanitizeAdminMonitoringText(key.slice(7)) };
  if (key.startsWith("occupy:")) return { type: "occupy", sourceDistrictId: null, targetDistrictId: sanitizeAdminMonitoringText(key.slice(7)) };
  if (key.startsWith("rob-source:")) return { type: "rob", sourceDistrictId: sanitizeAdminMonitoringText(key.slice(11)), targetDistrictId: null };
  if (key.startsWith("rob:")) return { type: "rob", sourceDistrictId: null, targetDistrictId: sanitizeAdminMonitoringText(key.slice(4)) };
  if (key.startsWith("heist-source:")) return { type: "heist", sourceDistrictId: sanitizeAdminMonitoringText(key.slice(13)), targetDistrictId: null };
  if (key.startsWith("heist:")) return { type: "heist", sourceDistrictId: null, targetDistrictId: sanitizeAdminMonitoringText(key.slice(6)) };
  return null;
};

const isOrderCooldownKey = (key: string): boolean =>
  ORDER_COOLDOWN_PREFIXES.some((prefix) => key.startsWith(prefix));

const findResourceState = (
  runtime: ServerInstanceRuntime,
  ownerType: "player" | "building",
  ownerId: string
) =>
  Object.values(runtime.state.resourceStatesById)
    .find((resourceState) => resourceState.ownerType === ownerType && resourceState.ownerId === ownerId);

const sanitizeResourceBalances = (
  balances: Record<string, number>
): Record<string, number> =>
  Object.fromEntries(Object.entries(balances).map(([key, value]) => [
    sanitizeAdminMonitoringText(key),
    Number.isFinite(Number(value)) ? Number(value) : 0
  ]));

const pickKeyResources = (
  balances: Record<string, number>
): Record<string, number> => {
  const picked: Record<string, number> = {};
  for (const key of KEY_RESOURCE_ORDER) {
    if (Object.prototype.hasOwnProperty.call(balances, key)) {
      picked[key] = Math.max(0, Number(balances[key] || 0));
    }
  }
  return picked;
};

const createNegativeResourceWarnings = (
  balances: Record<string, number>
): string[] =>
  Object.entries(balances)
    .filter(([, amount]) => Number(amount) < 0)
    .map(([resourceKey]) => `Negative ${resourceKey} balance detected.`);

const createEconomyWarnings = (
  totals: Record<string, number>
): string[] => [
  ...createNegativeResourceWarnings(totals),
  ...(Math.max(0, Number(totals.cash || 0)) <= 0 ? ["No clean cash visible in runtime projection."] : [])
];

const createBottleneckResources = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeProductionProjection["bottleneckResources"] => {
  const totals = createEconomyProjection(runtimes).totalResources;
  return KEY_RESOURCE_ORDER
    .filter((key) => key !== "cash" && key !== "dirty-cash")
    .map((resourceKey) => ({
      resourceKey,
      total: Math.max(0, Number(totals[resourceKey] || 0)),
      warning: Math.max(0, Number(totals[resourceKey] || 0)) <= 0
        ? "No stock visible."
        : "Stock visible."
    }))
    .filter((entry) => entry.total <= 5)
    .slice(0, 8);
};

const formatRemaining = (
  remainingTicks: number,
  tickRateMs: number
): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingTicks * Math.max(1, tickRateMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
