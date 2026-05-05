export function getMissionDistrictId(value) {
  return Number(String(value ?? "").replace("district:", "")) || 0;
}

function resolveNow(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

export function buildSpyMissionMarkers(missions = [], options = {}) {
  const now = resolveNow(options.now);
  const isActive = typeof options.isSpyMissionActiveOnMap === "function"
    ? options.isSpyMissionActiveOnMap
    : () => true;
  const getExpiry = typeof options.getSpyMissionExpiryTimestamp === "function"
    ? options.getSpyMissionExpiryTimestamp
    : (mission) => new Date(mission?.returnAt || mission?.createdAt || now).getTime();
  const visibleMissions = (Array.isArray(missions) ? missions : []).filter(isActive);

  return {
    districtIds: new Set(
      visibleMissions.map((mission) => Number(mission?.targetDistrictId)).filter(Boolean)
    ),
    markersByDistrictId: new Map(
      visibleMissions
        .map((mission) => {
          const districtId = Number(mission?.targetDistrictId);
          if (!districtId) {
            return null;
          }
          return [
            districtId,
            {
              seed: districtId,
              startedAt: new Date(mission.createdAt || now).getTime(),
              expiresAt: getExpiry(mission)
            }
          ];
        })
        .filter(Boolean)
    )
  };
}

export function buildPoliceActionMarkers(actions = {}) {
  const entries = Object.entries(actions || {});
  return {
    districtIds: new Set(
      Object.keys(actions || {}).map(Number).filter(Boolean)
    ),
    markersByDistrictId: new Map(
      entries
        .map(([districtId, marker]) => [Number(districtId), marker])
        .filter(([districtId, marker]) => Boolean(districtId && marker))
    )
  };
}

export function buildAttackOrderMarkers(orders = [], options = {}) {
  const now = resolveNow(options.now);
  const cooldownMs = Number(options.cooldownMs || 0);
  const safeOrders = Array.isArray(orders) ? orders : [];
  return {
    districtIds: new Set(
      safeOrders.map((order) => getMissionDistrictId(order?.targetDistrictId)).filter(Boolean)
    ),
    markersByDistrictId: new Map(
      safeOrders
        .map((order) => {
          const districtId = getMissionDistrictId(order?.targetDistrictId);
          if (!districtId) {
            return null;
          }
          return [
            districtId,
            {
              seed: districtId,
              source: order.status || "attack",
              attackerDistrictId: getMissionDistrictId(order.sourceDistrictId) || null,
              startedAt: new Date(order.createdAt || now).getTime(),
              expiresAt: new Date(order.resolveAt || now + cooldownMs).getTime()
            }
          ];
        })
        .filter(Boolean)
    )
  };
}

export function buildOccupyOrderMarkers(orders = [], options = {}) {
  const now = resolveNow(options.now);
  const safeOrders = Array.isArray(orders) ? orders : [];
  return {
    districtIds: new Set(
      safeOrders.map((order) => getMissionDistrictId(order?.targetDistrictId)).filter(Boolean)
    ),
    countdownByDistrictId: new Map(
      safeOrders.map((order) => ([
        getMissionDistrictId(order?.targetDistrictId),
        Math.max(0, Math.ceil((new Date(order.resolveAt || order.createdAt).getTime() - now) / 1000))
      ]))
    )
  };
}

export function buildRobberyOrderMarkers(orders = [], options = {}) {
  const now = resolveNow(options.now);
  const cooldownMs = Number(options.cooldownMs || 0);
  const safeOrders = Array.isArray(orders) ? orders : [];
  return {
    districtIds: new Set(
      safeOrders.map((order) => getMissionDistrictId(order?.targetDistrictId)).filter(Boolean)
    ),
    markersByDistrictId: new Map(
      safeOrders
        .map((order) => {
          const districtId = getMissionDistrictId(order?.targetDistrictId);
          if (!districtId) {
            return null;
          }
          return [
            districtId,
            {
              seed: districtId,
              startedAt: new Date(order.createdAt || now).getTime(),
              expiresAt: new Date(order.resolveAt || now + cooldownMs).getTime()
            }
          ];
        })
        .filter(Boolean)
    )
  };
}

export function buildTrapDistrictMarkers(worldState = {}) {
  return {
    districtIds: new Set(
      Object.entries(worldState?.districtTrapById || {})
        .filter(([, trap]) => trap?.isArmed)
        .map(([districtId]) => Number(districtId))
        .filter(Boolean)
    )
  };
}

export function buildMapMissionMarkersViewModel({
  spyMissions = [],
  policeActions = {},
  attackOrders = [],
  occupyOrders = [],
  robberyOrders = [],
  worldState = {},
  now = Date.now(),
  attackCooldownMs = 0,
  robberyCooldownMs = 0,
  isSpyMissionActiveOnMap,
  getSpyMissionExpiryTimestamp
} = {}) {
  const spy = buildSpyMissionMarkers(spyMissions, {
    now,
    isSpyMissionActiveOnMap,
    getSpyMissionExpiryTimestamp
  });
  const police = buildPoliceActionMarkers(policeActions);
  const attack = buildAttackOrderMarkers(attackOrders, { now, cooldownMs: attackCooldownMs });
  const occupy = buildOccupyOrderMarkers(occupyOrders, { now });
  const robbery = buildRobberyOrderMarkers(robberyOrders, { now, cooldownMs: robberyCooldownMs });
  const trap = buildTrapDistrictMarkers(worldState);

  return {
    activeSpyDistrictIds: spy.districtIds,
    activeSpyMarkersByDistrictId: spy.markersByDistrictId,
    activePoliceDistrictIds: police.districtIds,
    activePoliceMarkersByDistrictId: police.markersByDistrictId,
    activeAttackDistrictIds: attack.districtIds,
    activeAttackMarkersByDistrictId: attack.markersByDistrictId,
    activeOccupyDistrictIds: occupy.districtIds,
    activeOccupyCountdownByDistrictId: occupy.countdownByDistrictId,
    activeRobberyDistrictIds: robbery.districtIds,
    activeRobberyMarkersByDistrictId: robbery.markersByDistrictId,
    activeTrapDistrictIds: trap.districtIds
  };
}
