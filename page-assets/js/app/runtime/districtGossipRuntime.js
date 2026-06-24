function safeNumber(value, fallback = 0) {
  const numeric = Number.parseInt(String(value ?? fallback).replace("district:", ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getClock(options = {}) {
  return typeof options.now === "function" ? options.now : Date.now;
}

function getRandom(options = {}) {
  return typeof options.random === "function" ? options.random : Math.random;
}

export function normalizeDistrictGossipKey(districtOrId) {
  const rawValue = typeof districtOrId === "object" && districtOrId
    ? (districtOrId.id ?? districtOrId.districtId ?? "")
    : districtOrId;

  return String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.:#]/g, "") || "unknown";
}

export function resolveDistrictNumericId(districtOrId) {
  const rawValue = typeof districtOrId === "object" && districtOrId
    ? (districtOrId.id ?? districtOrId.districtId ?? 0)
    : districtOrId;

  return safeNumber(rawValue, 0) || 0;
}

export function formatDistrictReference(districtOrId) {
  const districtId = resolveDistrictNumericId(districtOrId);
  return districtId > 0 ? `District ${districtId}` : "Neznámý district";
}

export function sanitizeDistrictGossipEntry(rawEntry, options = {}) {
  const now = getClock(options);
  const random = getRandom(options);
  const createdAt = Math.max(0, Math.floor(Number(rawEntry?.createdAt) || now()));
  const text = String(rawEntry?.text || "").trim();

  if (!text) {
    return null;
  }

  const id = String(rawEntry?.id || `${createdAt}-${Math.floor(random() * 1_000_000)}`);
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

export function formatDistrictGossipTimestamp(timestamp) {
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

export function buildDistrictIntelEventText(type, districtOrId, payload = {}) {
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
    case "spy_critical_failed":
      return `Varování: Špeh v ${districtLabel} byl odhalen a akce zvedla heat v ulicích.`;
    case "raid_started":
      return `Potvrzený intel: V ${districtLabel} začala akce Vykrást district na prázdný sousední sektor.`;
    case "raid_success":
      return lootLabel
        ? `Potvrzený intel: ${districtLabel} vydal při akci Vykrást district městský loot: ${lootLabel}.`
        : `Potvrzený intel: ${districtLabel} vydal při akci Vykrást district část městských zásob.`;
    case "raid_empty":
      return `Potvrzený intel: Akce Vykrást district v ${districtLabel} proběhla, ale uvnitř nezůstal žádný použitelný loot.`;
    case "raid_failed":
      return `Potvrzený intel: Akce Vykrást district v ${districtLabel} se rozpadla bez zisku.`;
    case "trap_armed":
    case "trap_moved":
      return "";
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

export function createDistrictGossipRuntime(deps = {}) {
  const maxPerDistrict = Math.max(1, Math.floor(Number(deps.maxPerDistrict || 2)));
  const getWorldState = typeof deps.getWorldState === "function" ? deps.getWorldState : () => ({});
  const setWorldState = typeof deps.setWorldState === "function" ? deps.setWorldState : () => {};
  const isDevMode = typeof deps.isDevMode === "function" ? deps.isDevMode : () => false;
  const seedLibrary = deps.seedLibrary || {};
  const unknownCatalog = seedLibrary.unknown || { rumors: [] };

  // Dev/demo-only fallback. Authoritative City Feed rumors come from the core cityFeed projection.
  const isDistrictGossipDevOnlyMode = () => Boolean(isDevMode());

  const getDistrictGossipEntries = (districtOrId, limit = maxPerDistrict) => {
    if (!isDistrictGossipDevOnlyMode()) {
      return [];
    }

    const districtKey = normalizeDistrictGossipKey(districtOrId);
    const rawEntries = Array.isArray(getWorldState().districtGossipById?.[districtKey])
      ? getWorldState().districtGossipById[districtKey]
      : [];

    return rawEntries
      .map((entry) => sanitizeDistrictGossipEntry(entry))
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, Math.max(1, Math.floor(Number(limit) || 1)));
  };

  const appendDistrictGossip = (districtOrId, text, metadata = {}) => {
    if (!isDistrictGossipDevOnlyMode()) {
      return null;
    }

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

    const worldState = getWorldState();
    const existingEntries = Array.isArray(worldState.districtGossipById?.[districtKey])
      ? worldState.districtGossipById[districtKey]
      : [];
    const nextEntries = [...existingEntries, entry]
      .map((item) => sanitizeDistrictGossipEntry(item))
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, maxPerDistrict);

    setWorldState({
      ...worldState,
      districtGossipById: {
        ...(worldState.districtGossipById || {}),
        [districtKey]: nextEntries
      }
    });

    return entry;
  };

  const buildSeedDistrictGossipEntries = (district) => {
    if (!district || !isDistrictGossipDevOnlyMode()) {
      return [];
    }

    const districtType = String(district.districtType || "unknown").trim().toLowerCase();
    const catalog = seedLibrary[districtType] || unknownCatalog;
    const districtNumber = Math.max(1, resolveDistrictNumericId(district));
    const rumorPool = Array.isArray(catalog.rumors) && catalog.rumors.length > 0
      ? catalog.rumors
      : unknownCatalog.rumors || [];
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
      })
    ].filter(Boolean);
  };

  const ensureDistrictPassiveGossip = (district) => {
    if (!district || !isDistrictGossipDevOnlyMode()) {
      return [];
    }

    const currentEntries = getDistrictGossipEntries(district);
    if (currentEntries.length > 0) {
      return currentEntries;
    }

    const seedEntries = buildSeedDistrictGossipEntries(district);
    const worldState = getWorldState();
    const districtKey = normalizeDistrictGossipKey(district);

    setWorldState({
      ...worldState,
      districtGossipById: {
        ...(worldState.districtGossipById || {}),
        [districtKey]: seedEntries
      }
    });

    return seedEntries;
  };

  const recordDistrictIntelEvent = ({
    type,
    districtId,
    intelLevel = "verified",
    createdAt = Date.now(),
    sourceDistrictId = null,
    sourceBuilding = null,
    scenarioLabel = "",
    lootLabel = ""
  } = {}) => {
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
  };

  return {
    appendDistrictGossip,
    buildSeedDistrictGossipEntries,
    ensureDistrictPassiveGossip,
    getDistrictGossipEntries,
    isDistrictGossipDevOnlyMode,
    recordDistrictIntelEvent
  };
}

if (typeof window !== "undefined") {
  window.EmpireDistrictGossipRuntime = {
    buildDistrictIntelEventText,
    createDistrictGossipRuntime,
    formatDistrictGossipTimestamp,
    formatDistrictReference,
    normalizeDistrictGossipKey,
    resolveDistrictNumericId,
    sanitizeDistrictGossipEntry
  };
}
