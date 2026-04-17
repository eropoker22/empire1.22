window.Empire = window.Empire || {};
window.Empire.UIScenarios = window.Empire.UIScenarios || {};

window.Empire.UIScenarios.createIndexWarScenarioHelpers = function createIndexWarScenarioHelpers(deps = {}) {
  const {
    scenarioKey = "index-war",
    resolveScenarioSourceDistricts = () => [],
    normalizeOwnerName = (value) => String(value || "").trim().toLowerCase(),
    buildDemoDistrictOwnerMeta = () => ({}),
    getDistrictBounds = () => null,
    distanceFromMapCenter = () => Number.POSITIVE_INFINITY,
    getPlayer = () => null,
    getCachedProfile = () => null,
    readStoredGuestUsername = () => "",
    readStoredGangName = () => "",
    resolveMapBorderPlayerColor = () => "#22d3ee"
  } = deps;

  const REQUIRED_PLAYER_BUILDINGS = ["Lékárna", "Továrna", "Drug lab", "Zbrojovka"];
  const PLAYER_DISTRICT_TARGET = 6;
  const ENEMY_DISTRICT_TARGET = 4;
  const ENEMY_ALLIANCE_NAME = "Noční pakt";
  const ENEMY_ALLIANCE_ICON_KEY = "snake_dagger";
  const ENEMY_OWNERS = ["Ledovec", "Mariah"];

  function normalizeEdgeKey(from, to) {
    const first = `${Number(from?.[0] || 0).toFixed(4)},${Number(from?.[1] || 0).toFixed(4)}`;
    const second = `${Number(to?.[0] || 0).toFixed(4)},${Number(to?.[1] || 0).toFixed(4)}`;
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  }

  function buildDistrictAdjacency(districts) {
    const adjacency = new Map((districts || []).map((district) => [district.id, new Set()]));
    const edgeOwners = new Map();
    (districts || []).forEach((district) => {
      const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
      if (polygon.length < 2) return;
      for (let index = 0; index < polygon.length; index += 1) {
        const from = polygon[index];
        const to = polygon[(index + 1) % polygon.length];
        const edgeKey = normalizeEdgeKey(from, to);
        if (!edgeOwners.has(edgeKey)) edgeOwners.set(edgeKey, []);
        edgeOwners.get(edgeKey).push(district.id);
      }
    });
    edgeOwners.forEach((districtIds) => {
      if (districtIds.length < 2) return;
      for (let index = 0; index < districtIds.length; index += 1) {
        for (let neighborIndex = index + 1; neighborIndex < districtIds.length; neighborIndex += 1) {
          const firstId = districtIds[index];
          const secondId = districtIds[neighborIndex];
          adjacency.get(firstId)?.add(secondId);
          adjacency.get(secondId)?.add(firstId);
        }
      }
    });
    return adjacency;
  }

  function resolvePlayerOwnerName() {
    const player = getPlayer() || {};
    const cachedProfile = getCachedProfile() || {};
    return [
      player?.gangName,
      cachedProfile?.gangName,
      player?.username,
      cachedProfile?.username,
      readStoredGangName(),
      readStoredGuestUsername()
    ].map((value) => String(value || "").trim()).find(Boolean) || "Tvůj gang";
  }

  function isAssignableDistrict(district) {
    return String(district?.type || "").trim().toLowerCase() !== "downtown";
  }

  function hasBuilding(district, buildingName) {
    const wanted = normalizeOwnerName(buildingName);
    const buildings = Array.isArray(district?.buildings) ? district.buildings : [];
    return buildings.some((building) => normalizeOwnerName(building) === wanted);
  }

  function pickBestCenterDistrict(candidates, bounds) {
    return [...candidates].sort((left, right) => {
      const leftDistance = distanceFromMapCenter(left, bounds);
      const rightDistance = distanceFromMapCenter(right, bounds);
      if (leftDistance === rightDistance) return Number(left?.id || 0) - Number(right?.id || 0);
      return leftDistance - rightDistance;
    })[0] || null;
  }

  function pickAdjacentDistrict(availableIds, sourceIds, adjacency, districtsById, bounds) {
    const sourceSet = new Set(sourceIds);
    const adjacentCandidates = Array.from(availableIds)
      .map((districtId) => districtsById.get(districtId))
      .filter((district) => {
        if (!district) return false;
        const neighbors = adjacency.get(district.id);
        if (!neighbors || !neighbors.size) return false;
        for (const neighborId of neighbors) {
          if (sourceSet.has(neighborId)) return true;
        }
        return false;
      });
    return pickBestCenterDistrict(adjacentCandidates, bounds);
  }

  function growCluster(seedDistrict, targetSize, availableIds, adjacency, districtsById, bounds) {
    const clusterIds = [];
    const queued = new Set();
    const queue = [];
    const enqueue = (districtId) => {
      if (!availableIds.has(districtId) || queued.has(districtId)) return;
      queued.add(districtId);
      queue.push(districtId);
    };

    if (seedDistrict?.id != null) enqueue(seedDistrict.id);

    while (queue.length && clusterIds.length < targetSize) {
      queue.sort((leftId, rightId) => {
        const leftDistrict = districtsById.get(leftId);
        const rightDistrict = districtsById.get(rightId);
        const leftDistance = distanceFromMapCenter(leftDistrict, bounds);
        const rightDistance = distanceFromMapCenter(rightDistrict, bounds);
        if (leftDistance === rightDistance) return Number(leftId || 0) - Number(rightId || 0);
        return leftDistance - rightDistance;
      });
      const districtId = queue.shift();
      if (!availableIds.has(districtId)) continue;
      availableIds.delete(districtId);
      clusterIds.push(districtId);
      const neighbors = adjacency.get(districtId);
      if (!neighbors || !neighbors.size) continue;
      neighbors.forEach((neighborId) => enqueue(neighborId));
    }

    while (clusterIds.length < targetSize && availableIds.size) {
      const fallbackDistrict = pickBestCenterDistrict(
        Array.from(availableIds).map((districtId) => districtsById.get(districtId)).filter(Boolean),
        bounds
      );
      if (!fallbackDistrict) break;
      availableIds.delete(fallbackDistrict.id);
      clusterIds.push(fallbackDistrict.id);
      const neighbors = adjacency.get(fallbackDistrict.id);
      if (!neighbors || !neighbors.size) continue;
      neighbors.forEach((neighborId) => enqueue(neighborId));
    }

    return clusterIds;
  }

  function buildProfilePatch(playerDistricts, playerOwnerName, districtsById) {
    const influence = playerDistricts.reduce((sum, districtId) => {
      const district = districtsById.get(districtId);
      return sum + Math.max(0, Math.floor(Number(district?.influence || 0)));
    }, 0);
    return {
      gangName: playerOwnerName,
      alliance: "Žádná",
      districts: playerDistricts.length,
      influence,
      gangColor: resolveMapBorderPlayerColor()
    };
  }

  function resolveScenarioState(requestedScenarioKey) {
    const normalizedKey = String(requestedScenarioKey || "").trim().toLowerCase();
    if (normalizedKey !== String(scenarioKey || "").trim().toLowerCase()) return null;

    const districts = resolveScenarioSourceDistricts();
    if (!Array.isArray(districts) || !districts.length) return null;

    const districtsById = new Map(districts.map((district) => [district.id, district]));
    const assignableDistricts = districts.filter(isAssignableDistrict);
    if (!assignableDistricts.length) return null;

    const bounds = getDistrictBounds(assignableDistricts);
    const adjacency = buildDistrictAdjacency(districts);
    const playerOwnerName = resolvePlayerOwnerName();
    const availableIds = new Set(assignableDistricts.map((district) => district.id));
    const playerDistrictIds = [];

    REQUIRED_PLAYER_BUILDINGS.forEach((buildingName) => {
      const candidate = pickBestCenterDistrict(
        assignableDistricts.filter((district) => availableIds.has(district.id) && hasBuilding(district, buildingName)),
        bounds
      );
      if (!candidate) return;
      availableIds.delete(candidate.id);
      playerDistrictIds.push(candidate.id);
    });

    while (playerDistrictIds.length < Math.min(PLAYER_DISTRICT_TARGET, assignableDistricts.length)) {
      const adjacentCandidate = pickAdjacentDistrict(
        availableIds,
        playerDistrictIds,
        adjacency,
        districtsById,
        bounds
      );
      const fallbackCandidate = adjacentCandidate || pickBestCenterDistrict(
        Array.from(availableIds).map((districtId) => districtsById.get(districtId)).filter(Boolean),
        bounds
      );
      if (!fallbackCandidate) break;
      availableIds.delete(fallbackCandidate.id);
      playerDistrictIds.push(fallbackCandidate.id);
    }

    const enemySeed = pickAdjacentDistrict(availableIds, playerDistrictIds, adjacency, districtsById, bounds)
      || pickBestCenterDistrict(
        Array.from(availableIds).map((districtId) => districtsById.get(districtId)).filter(Boolean),
        bounds
      );
    const enemyDistrictIds = growCluster(
      enemySeed,
      Math.min(ENEMY_DISTRICT_TARGET, availableIds.size),
      availableIds,
      adjacency,
      districtsById,
      bounds
    );

    const enemyOwnerByDistrictId = new Map();
    enemyDistrictIds.forEach((districtId, index) => {
      enemyOwnerByDistrictId.set(districtId, ENEMY_OWNERS[index % ENEMY_OWNERS.length]);
    });

    const ownerAllianceEntries = new Map([[normalizeOwnerName(ENEMY_ALLIANCE_NAME), ENEMY_ALLIANCE_ICON_KEY]]);
    const playerColor = resolveMapBorderPlayerColor();
    const profilePatch = buildProfilePatch(playerDistrictIds, playerOwnerName, districtsById);
    const playerOwnerKey = normalizeOwnerName(playerOwnerName);

    const nextDistricts = districts.map((district) => {
      let ownerName = "";
      if (playerDistrictIds.includes(district.id)) ownerName = playerOwnerName;
      else if (enemyOwnerByDistrictId.has(district.id)) ownerName = enemyOwnerByDistrictId.get(district.id);

      if (!ownerName) {
        return {
          ...district,
          owner: null,
          ownerNick: null,
          ownerPlayerId: null,
          ownerAllianceName: null,
          ownerAllianceIconKey: null,
          ownerFaction: null,
          ownerStructure: null,
          owner_structure: null,
          ownerAvatar: null,
          ownerAtmosphere: null,
          ownerColor: null
        };
      }

      const normalizedOwner = normalizeOwnerName(ownerName);
      const ownerAllianceName = normalizedOwner === playerOwnerKey ? null : ENEMY_ALLIANCE_NAME;
      const ownerMeta = buildDemoDistrictOwnerMeta(ownerName, district);
      return {
        ...district,
        owner: ownerName,
        ownerNick: normalizedOwner === playerOwnerKey ? "Ty" : ownerName,
        ownerPlayerId: null,
        ownerAllianceName,
        ownerAllianceIconKey: ownerAllianceName ? ownerAllianceEntries.get(normalizeOwnerName(ownerAllianceName)) || null : null,
        ownerFaction: ownerMeta?.ownerFaction || ownerMeta?.ownerStructure || district?.ownerFaction || null,
        ownerStructure: ownerMeta?.ownerStructure || ownerMeta?.ownerFaction || district?.ownerStructure || null,
        owner_structure: ownerMeta?.ownerStructure || ownerMeta?.ownerFaction || district?.owner_structure || null,
        ownerAvatar: ownerMeta?.ownerAvatar || null,
        ownerAtmosphere: ownerMeta?.ownerAtmosphere || null,
        ownerColor: normalizedOwner === playerOwnerKey
          ? playerColor
          : (ownerMeta?.ownerColor || district?.ownerColor || null)
      };
    });

    return {
      key: scenarioKey,
      ownerName: playerOwnerName,
      uniqueOwnerColors: true,
      districts: nextDistricts,
      playerProfilePatch: profilePatch,
      alliedOwners: [],
      enemyOwners: ENEMY_OWNERS,
      allianceIcons: [[ENEMY_ALLIANCE_NAME, ENEMY_ALLIANCE_ICON_KEY]]
    };
  }

  return {
    scenarioKey,
    resolveScenarioState
  };
};
