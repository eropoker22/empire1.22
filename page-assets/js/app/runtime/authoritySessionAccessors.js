export function createAuthoritySessionAccessors(deps = {}) {
  const getAuthoritySession = typeof deps.getAuthoritySession === "function" ? deps.getAuthoritySession : () => ({});
  const updateStoredPreviewSession = typeof deps.updateStoredPreviewSession === "function" ? deps.updateStoredPreviewSession : () => {};
  const documentRef = deps.documentRef || (typeof document === "undefined" ? null : document);
  const CustomEventCtor = deps.CustomEventCtor || globalThis.CustomEvent;
  const defaultEconomyState = deps.defaultEconomyState || { cleanMoney: 25000, dirtyMoney: 300 };

  const getStoredWeaponInventory = () => getAuthoritySession().inventory.weapons;
  const setStoredWeaponInventory = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      weapons: { ...deps.defaultWeaponInventory, ...(payload || {}) }
    }
  }));

  const getStoredMaterialInventory = () => getAuthoritySession().inventory.materials;
  const setStoredMaterialInventory = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      materials: { ...deps.defaultMaterialInventory, ...(payload || {}) }
    }
  }));

  const getResolvedMaterialInventory = () => {
    const storedInventory = getStoredMaterialInventory();
    if (storedInventory) {
      return { ...deps.defaultMaterialInventory, ...storedInventory };
    }
    setStoredMaterialInventory(deps.defaultMaterialInventory);
    return { ...deps.defaultMaterialInventory };
  };

  const getStoredDrugInventory = () => getAuthoritySession().inventory.drugs;
  const setStoredDrugInventory = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    inventory: {
      ...session.inventory,
      drugs: { ...deps.defaultDrugInventory, ...(payload || {}) }
    }
  }));

  const getResolvedDrugInventory = () => {
    const storedInventory = getStoredDrugInventory();
    if (storedInventory) {
      return { ...deps.defaultDrugInventory, ...storedInventory };
    }
    setStoredDrugInventory(deps.defaultDrugInventory);
    return { ...deps.defaultDrugInventory };
  };

  const getStoredProductionState = () => getAuthoritySession().production.jobs;
  const setStoredProductionState = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    production: {
      ...session.production,
      jobs: payload && typeof payload === "object" ? payload : {}
    }
  }));
  const getResolvedProductionState = () => {
    const storedState = getStoredProductionState();
    return storedState && typeof storedState === "object" ? storedState : {};
  };

  const getStoredEconomyState = () => getAuthoritySession().economy;
  const setStoredEconomyState = (payload) => {
    updateStoredPreviewSession((session) => ({ ...session, economy: payload || session.economy }));
    if (documentRef?.dispatchEvent && typeof CustomEventCtor === "function") {
      documentRef.dispatchEvent(new CustomEventCtor("empire:economy-state-changed"));
    }
  };
  const getResolvedEconomyState = () => {
    const storedState = getStoredEconomyState();
    if (storedState && Number.isFinite(storedState.cleanMoney) && Number.isFinite(storedState.dirtyMoney)) {
      return {
        cleanMoney: storedState.cleanMoney,
        dirtyMoney: storedState.dirtyMoney
      };
    }

    const nextState = {
      cleanMoney: Number(defaultEconomyState.cleanMoney || 0),
      dirtyMoney: Number(defaultEconomyState.dirtyMoney || 0)
    };
    setStoredEconomyState(nextState);
    return nextState;
  };

  const getStoredAttackOrders = () => getAuthoritySession().missions.attackOrders;
  const setStoredAttackOrders = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    missions: { ...session.missions, attackOrders: Array.isArray(payload) ? payload : [] }
  }));

  const getStoredOccupyOrders = () => getAuthoritySession().missions.occupyOrders || [];
  const setStoredOccupyOrders = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    missions: { ...session.missions, occupyOrders: Array.isArray(payload) ? payload : [] }
  }));

  const getStoredRobberyOrders = () => getAuthoritySession().missions.robberyOrders;
  const setStoredRobberyOrders = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    missions: { ...session.missions, robberyOrders: Array.isArray(payload) ? payload : [] }
  }));

  const getStoredSpyState = () => getAuthoritySession().missions.spy;
  const setStoredSpyState = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    missions: { ...session.missions, spy: payload || session.missions.spy }
  }));

  const getSpyMissionPhase = (mission) => {
    if (!mission || typeof mission !== "object") {
      return "active";
    }
    return mission.status === "captured" ? "captured" : "active";
  };

  const normalizeDistrictId = (value) => {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) {
      return direct;
    }
    const match = String(value || "").match(/\d+/u);
    const parsed = match ? Number(match[0]) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const getSpyMissionExpiryTimestamp = (mission) => {
    const phase = getSpyMissionPhase(mission);
    const rawTimestamp = phase === "captured" ? mission.cooldownUntil : (mission.returnAt || mission.createdAt);
    const timestamp = new Date(rawTimestamp || Date.now()).getTime();
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  };

  const isSpyMissionActiveOnMap = (mission) => getSpyMissionPhase(mission) === "active";

  const getResolvedSpyState = () => {
    const storedState = getStoredSpyState();
    if (storedState && Array.isArray(storedState.missions)) {
      const now = Date.now();
      const missions = storedState.missions
        .filter((mission) => mission && mission.id)
        .filter((mission) => getSpyMissionPhase(mission) !== "captured" || getSpyMissionExpiryTimestamp(mission) > now);
      const available = deps.clamp(deps.maxSpies - missions.length, 0, deps.maxSpies);

      if (
        missions.length !== storedState.missions.length
        || available !== deps.clamp(Number(storedState.available ?? deps.maxSpies), 0, deps.maxSpies)
      ) {
        setStoredSpyState({ ...storedState, available, missions });
      }

      return { available, missions };
    }

    const nextState = { available: deps.maxSpies, missions: [] };
    setStoredSpyState(nextState);
    return nextState;
  };

  const getStoredSpyIntel = () => getAuthoritySession().missions.spyIntel;
  const setStoredSpyIntel = (payload) => updateStoredPreviewSession((session) => ({
    ...session,
    missions: { ...session.missions, spyIntel: payload || session.missions.spyIntel }
  }));

  const getResolvedSpyIntel = () => {
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
  };

  const resetSpyDistrictState = (districtId) => {
    const targetDistrictId = normalizeDistrictId(districtId);
    if (!targetDistrictId) {
      return {
        changed: false,
        removedMissionIds: [],
        spyIntelChanged: false,
        spyStateChanged: false,
        targetDistrictId: null
      };
    }

    const spyState = getResolvedSpyState();
    const removedMissionIds = [];
    const nextMissions = spyState.missions.filter((mission) => {
      if (normalizeDistrictId(mission?.targetDistrictId) !== targetDistrictId) {
        return true;
      }
      removedMissionIds.push(mission.id);
      return false;
    });
    const nextAvailable = deps.clamp(deps.maxSpies - nextMissions.length, 0, deps.maxSpies);
    const spyStateChanged = nextMissions.length !== spyState.missions.length || nextAvailable !== spyState.available;

    if (spyStateChanged) {
      setStoredSpyState({
        ...spyState,
        available: nextAvailable,
        missions: nextMissions
      });
    }

    const storedSpyIntel = getStoredSpyIntel();
    const spyIntel = storedSpyIntel && typeof storedSpyIntel === "object"
      ? {
          occupiableDistrictIds: Array.isArray(storedSpyIntel.occupiableDistrictIds)
            ? storedSpyIntel.occupiableDistrictIds.map(normalizeDistrictId).filter(Boolean)
            : [],
          revealedTypeDistrictIds: Array.isArray(storedSpyIntel.revealedTypeDistrictIds)
            ? storedSpyIntel.revealedTypeDistrictIds.map(normalizeDistrictId).filter(Boolean)
            : [],
          revealedDefenseDistrictIds: Array.isArray(storedSpyIntel.revealedDefenseDistrictIds)
            ? storedSpyIntel.revealedDefenseDistrictIds.map(normalizeDistrictId).filter(Boolean)
            : []
        }
      : getResolvedSpyIntel();
    const nextSpyIntel = {
      occupiableDistrictIds: spyIntel.occupiableDistrictIds.filter((candidateId) => normalizeDistrictId(candidateId) !== targetDistrictId),
      revealedTypeDistrictIds: spyIntel.revealedTypeDistrictIds.filter((candidateId) => normalizeDistrictId(candidateId) !== targetDistrictId),
      revealedDefenseDistrictIds: spyIntel.revealedDefenseDistrictIds.filter((candidateId) => normalizeDistrictId(candidateId) !== targetDistrictId)
    };
    const spyIntelChanged = (
      nextSpyIntel.occupiableDistrictIds.length !== spyIntel.occupiableDistrictIds.length
      || nextSpyIntel.revealedTypeDistrictIds.length !== spyIntel.revealedTypeDistrictIds.length
      || nextSpyIntel.revealedDefenseDistrictIds.length !== spyIntel.revealedDefenseDistrictIds.length
    );

    if (spyIntelChanged) {
      setStoredSpyIntel(nextSpyIntel);
    }

    return {
      changed: spyStateChanged || spyIntelChanged,
      removedMissionIds,
      spyIntelChanged,
      spyStateChanged,
      targetDistrictId
    };
  };

  const createWeaponInventoryFromFaction = (_factionId) => ({ ...deps.defaultWeaponInventory });

  return {
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
  };
}

if (typeof window !== "undefined") {
  window.EmpireAuthoritySessionAccessors = {
    createAuthoritySessionAccessors
  };
}
