import {
  GANG_MEMBERS_SELECTOR,
  STORAGE_DRUG_COUNT_SELECTOR,
  STORAGE_FACTORY_COUNT_SELECTOR,
  STORAGE_MATERIAL_COUNT_SELECTOR,
  STORAGE_WEAPON_COUNT_SELECTOR,
  TOPBAR_CLEAN_MONEY_SELECTOR,
  TOPBAR_DIRTY_MONEY_SELECTOR,
  TOPBAR_INFLUENCE_SELECTOR,
  TOPBAR_SPY_LABEL_SELECTOR,
  TOPBAR_SPY_PILL_SELECTOR,
  TOPBAR_SPY_VALUE_SELECTOR
} from "../runtime/constants.js";

const MONEY_STAT_ANIMATION_MS = 1050;
const MONEY_STAT_COUNT_DURATION_MS = 900;
const TOPBAR_STAT_SWITCH_MS = 340;

const moneyStatAnimationTimers = new Map();
const moneyStatCountIntervals = new Map();
let topbarStatSwitchTimer = null;
let lastRenderedCleanMoney = null;
let lastRenderedDirtyMoney = null;
let lastRenderedInfluenceValue = null;
let lastRenderedTopbarMode = null;

function getScope(root) {
  return root?.ownerDocument || (typeof document !== "undefined" ? document : root);
}

function safeQuery(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }

  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function safeQueryAll(root, selector) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function getTimerApi(options = {}) {
  const timerSource = options.timerApi || (typeof window !== "undefined" ? window : globalThis);
  const setTimeoutFn = options.setTimeout || timerSource?.setTimeout;
  const setIntervalFn = options.setInterval || timerSource?.setInterval;
  const clearTimeoutFn = options.clearTimeout || timerSource?.clearTimeout;
  const clearIntervalFn = options.clearInterval || timerSource?.clearInterval;

  return {
    setTimeout: typeof setTimeoutFn === "function" ? setTimeoutFn.bind(timerSource) : null,
    setInterval: typeof setIntervalFn === "function" ? setIntervalFn.bind(timerSource) : null,
    clearTimeout: typeof clearTimeoutFn === "function" ? clearTimeoutFn.bind(timerSource) : null,
    clearInterval: typeof clearIntervalFn === "function" ? clearIntervalFn.bind(timerSource) : null
  };
}

function formatDefaultMoneyAmount(value = 0) {
  return `$${Math.max(0, Math.round(Number(value || 0))).toLocaleString("cs-CZ")}`;
}

function formatDefaultMetricNumber(value = 0, maximumFractionDigits = 1) {
  const safeValue = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
  return safeValue.toLocaleString("cs-CZ", {
    maximumFractionDigits
  });
}

function normalizeCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function stopMoneyStatCounter(element, options = {}) {
  if (!element) {
    return;
  }

  const activeInterval = moneyStatCountIntervals.get(element);
  const { clearInterval } = getTimerApi(options);
  if (activeInterval && clearInterval) {
    clearInterval(activeInterval);
  }
  if (activeInterval) {
    moneyStatCountIntervals.delete(element);
  }
}

function animateMoneyStatValue(element, delta, options = {}) {
  if (!element || !delta) {
    return;
  }

  const { setTimeout, clearTimeout } = getTimerApi(options);
  const nextClass = delta > 0 ? "is-money-up" : "is-money-down";
  element.classList?.remove("is-money-up", "is-money-down");
  void element.offsetWidth;
  element.classList?.add(nextClass);

  const activeTimer = moneyStatAnimationTimers.get(element);
  if (activeTimer && clearTimeout) {
    clearTimeout(activeTimer);
  }

  if (!setTimeout) {
    return;
  }

  const timerId = setTimeout(() => {
    element.classList?.remove("is-money-up", "is-money-down");
    moneyStatAnimationTimers.delete(element);
  }, MONEY_STAT_ANIMATION_MS);
  moneyStatAnimationTimers.set(element, timerId);
}

function animateMoneyStatCounter(element, targetValue, options = {}) {
  if (!element) {
    return;
  }

  const safeTarget = normalizeCount(targetValue);
  const prefix = String(options?.prefix ?? "$");
  const suffix = String(options?.suffix ?? "");
  const currentValue = normalizeCount(element.dataset.moneyDisplay ?? element.dataset.moneyTarget ?? element.textContent);
  element.dataset.moneyTarget = String(safeTarget);
  stopMoneyStatCounter(element, options);
  element.classList?.remove("is-money-up", "is-money-down");

  if (currentValue === safeTarget) {
    element.dataset.moneyDisplay = String(safeTarget);
    element.textContent = `${prefix}${safeTarget}${suffix}`;
    return;
  }

  const { setInterval, clearInterval } = getTimerApi(options);
  if (!setInterval || !clearInterval) {
    element.dataset.moneyDisplay = String(safeTarget);
    element.textContent = `${prefix}${safeTarget}${suffix}`;
    return;
  }

  const direction = safeTarget > currentValue ? 1 : -1;
  const totalSteps = Math.abs(safeTarget - currentValue);
  const maxDuration = Math.max(80, Number(options?.countDurationMs ?? MONEY_STAT_COUNT_DURATION_MS));
  const intervalMs = Math.max(1, Number(options?.countIntervalMs ?? Math.floor(maxDuration / Math.max(1, totalSteps))));
  let displayedValue = currentValue;

  const renderNextValue = () => {
    displayedValue += direction;
    element.dataset.moneyDisplay = String(displayedValue);
    element.textContent = `${prefix}${displayedValue}${suffix}`;

    if (displayedValue === safeTarget) {
      const activeInterval = moneyStatCountIntervals.get(element);
      if (activeInterval) {
        clearInterval(activeInterval);
        moneyStatCountIntervals.delete(element);
      }
    }
  };

  renderNextValue();
  if (displayedValue !== safeTarget) {
    const intervalId = setInterval(renderNextValue, intervalMs);
    moneyStatCountIntervals.set(element, intervalId);
  }
}

function syncMoneyStatToCachedValue(element, value, options = {}) {
  if (!element) {
    return;
  }

  const { clearTimeout } = getTimerApi(options);
  stopMoneyStatCounter(element, options);
  const activeTimer = moneyStatAnimationTimers.get(element);
  if (activeTimer && clearTimeout) {
    clearTimeout(activeTimer);
  }
  if (activeTimer) {
    moneyStatAnimationTimers.delete(element);
  }

  element.classList?.remove("is-money-up", "is-money-down");
  const safeValue = normalizeCount(value);
  const prefix = String(options?.prefix ?? "$");
  const suffix = String(options?.suffix ?? "");
  element.dataset.moneyTarget = String(safeValue);
  element.dataset.moneyDisplay = String(safeValue);
  element.textContent = `${prefix}${safeValue}${suffix}`;
}

export function updateTopbarResources(playerState = {}, options = {}) {
  const root = options.root || getScope();
  const scope = getScope(root);
  if (!scope) {
    return;
  }

  const includeMoney = options.includeMoney !== false;
  const includeSpy = options.includeSpy !== false;
  const instant = Boolean(options.instant);
  const animate = Boolean(options.animate);
  const cleanMoney = normalizeCount(playerState.cleanMoney);
  const dirtyMoney = normalizeCount(playerState.dirtyMoney);
  const influence = normalizeCount(playerState.influence);
  const sourceMode = String(playerState.sourceMode || "stored");
  const isDistrictResourceMode = sourceMode === "district";
  const formatMoneyAmount = typeof options.formatMoneyAmount === "function"
    ? options.formatMoneyAmount
    : formatDefaultMoneyAmount;
  const formatMetricNumber = typeof options.formatMetricNumber === "function"
    ? options.formatMetricNumber
    : formatDefaultMetricNumber;

  if (includeMoney) {
    const topbarCleanMoney = safeQuery(scope, TOPBAR_CLEAN_MONEY_SELECTOR);
    const topbarDirtyMoney = safeQuery(scope, TOPBAR_DIRTY_MONEY_SELECTOR);
    const cleanMoneyPill = topbarCleanMoney?.closest?.(".resource-pill") || null;
    const dirtyMoneyPill = topbarDirtyMoney?.closest?.(".resource-pill") || null;

    if (cleanMoneyPill) {
      cleanMoneyPill.title = isDistrictResourceMode
        ? `Onboarding: čisté peníze běží +${formatMoneyAmount(playerState.cleanMoneyPerMinute)}/min z ${normalizeCount(playerState.districtCount)} distriktů.`
        : "Aktuální stav čistých peněz.";
    }

    if (dirtyMoneyPill) {
      dirtyMoneyPill.title = isDistrictResourceMode
        ? (Number(playerState.dirtyMoneyPerMinute || 0) > 0
            ? `Onboarding: špinavé peníze běží +${formatMoneyAmount(playerState.dirtyMoneyPerMinute)}/min z ${normalizeCount(playerState.districtCount)} distriktů.`
            : "Onboarding: distrikty právě nepřidávají špinavé peníze.")
        : "Aktuální stav špinavých peněz.";
    }

    if (topbarCleanMoney) {
      topbarCleanMoney.dataset.moneyTarget = String(cleanMoney);
      if (instant || lastRenderedCleanMoney === null) {
        syncMoneyStatToCachedValue(topbarCleanMoney, cleanMoney, options);
      } else {
        animateMoneyStatCounter(topbarCleanMoney, cleanMoney, options);
      }
    }

    if (topbarDirtyMoney) {
      topbarDirtyMoney.dataset.moneyTarget = String(dirtyMoney);
      if (instant || lastRenderedDirtyMoney === null) {
        syncMoneyStatToCachedValue(topbarDirtyMoney, dirtyMoney, options);
      } else {
        animateMoneyStatCounter(topbarDirtyMoney, dirtyMoney, options);
      }
    }

    if (!instant && topbarCleanMoney && lastRenderedCleanMoney !== null && cleanMoney !== lastRenderedCleanMoney) {
      animateMoneyStatValue(topbarCleanMoney, cleanMoney - lastRenderedCleanMoney, options);
    }

    if (!instant && topbarDirtyMoney && lastRenderedDirtyMoney !== null && dirtyMoney !== lastRenderedDirtyMoney) {
      animateMoneyStatValue(topbarDirtyMoney, dirtyMoney - lastRenderedDirtyMoney, options);
    }

    lastRenderedCleanMoney = cleanMoney;
    lastRenderedDirtyMoney = dirtyMoney;
  }

  if (!includeSpy) {
    return;
  }

  const spyPill = safeQuery(scope, TOPBAR_SPY_PILL_SELECTOR);
  const spyLabel = safeQuery(scope, TOPBAR_SPY_LABEL_SELECTOR);
  const spyValue = safeQuery(scope, TOPBAR_SPY_VALUE_SELECTOR);
  const influenceValue = safeQuery(scope, TOPBAR_INFLUENCE_SELECTOR);
  const spyAvailable = normalizeCount(playerState.spyAvailable);
  const maxSpies = normalizeCount(playerState.maxSpies);
  const resourceMode = playerState.resourceMode === "spy" ? "spy" : "influence";

  if (influenceValue) {
    influenceValue.dataset.influenceValue = String(influence);
    influenceValue.textContent = String(influence);
  }

  if (!spyPill || !spyLabel || !spyValue) {
    return;
  }

  spyValue.dataset.influenceValue = String(influence);
  spyValue.dataset.spyValue = String(spyAvailable);
  spyLabel.textContent = resourceMode === "spy" ? "Špeh" : "Vliv";

  if (instant) {
    syncMoneyStatToCachedValue(
      spyValue,
      resourceMode === "spy" ? spyAvailable : influence,
      { ...options, prefix: "" }
    );
    lastRenderedInfluenceValue = influence;
    lastRenderedTopbarMode = resourceMode;
  } else if (resourceMode === "spy") {
    stopMoneyStatCounter(spyValue, options);
    spyValue.textContent = String(spyAvailable);
    lastRenderedTopbarMode = resourceMode;
  } else if (lastRenderedTopbarMode === "influence" && lastRenderedInfluenceValue !== null) {
    animateMoneyStatCounter(spyValue, influence, { ...options, prefix: "" });
    if (influence !== lastRenderedInfluenceValue) {
      animateMoneyStatValue(spyValue, influence - lastRenderedInfluenceValue, options);
    }
    lastRenderedTopbarMode = resourceMode;
  } else {
    syncMoneyStatToCachedValue(spyValue, influence, { ...options, prefix: "" });
    lastRenderedTopbarMode = resourceMode;
  }

  lastRenderedInfluenceValue = influence;

  spyPill.classList?.toggle("resource-pill--influence", resourceMode !== "spy");
  spyPill.classList?.toggle("resource-pill--spy", resourceMode === "spy");
  spyPill.classList?.toggle("is-spies", resourceMode === "spy");

  const shownLabel = resourceMode === "spy"
    ? `${spyAvailable} špehů`
    : `${influence} vlivu`;
  const hiddenLabel = resourceMode === "spy"
    ? `${influence} vlivu`
    : `${spyAvailable} špehů`;
  spyPill.setAttribute(
    "aria-label",
    `${shownLabel}. Klikni pro přepnutí na ${hiddenLabel}.`
  );
  spyPill.title = resourceMode === "spy"
    ? (spyAvailable > 0
        ? `Dostupní špehové ${spyAvailable}/${maxSpies}. Klikni pro přepnutí na vliv.`
        : "Všichni špehové jsou právě na misi. Klikni pro přepnutí na vliv.")
    : (isDistrictResourceMode
        ? `Onboarding: vliv běží +${formatMetricNumber(playerState.influencePerMinute, 2)}/min z ${normalizeCount(playerState.districtCount)} distriktů. Klikni pro přepnutí na špehy.`
        : `Vliv: ${influence}. Klikni pro přepnutí na špehy.`);

  if (animate) {
    const { setTimeout, clearTimeout } = getTimerApi(options);
    spyPill.classList?.remove("is-switching");
    void spyPill.offsetWidth;
    spyPill.classList?.add("is-switching");
    if (topbarStatSwitchTimer && clearTimeout) {
      clearTimeout(topbarStatSwitchTimer);
    }
    if (setTimeout) {
      topbarStatSwitchTimer = setTimeout(() => {
        spyPill.classList?.remove("is-switching");
        topbarStatSwitchTimer = null;
      }, TOPBAR_STAT_SWITCH_MS);
    }
  }
}

export function renderResourcesPanel(playerState = {}, options = {}) {
  const root = options.root || getScope();
  if (!root) {
    return;
  }

  if (playerState.gangMembers !== undefined) {
    const gangMembers = safeQuery(root, GANG_MEMBERS_SELECTOR);
    if (gangMembers) {
      gangMembers.textContent = String(normalizeCount(playerState.gangMembers));
    }
  }

  updateTopbarResources(playerState, options);
}

export function syncTopbarMoneyResource(root, kind, value, options = {}) {
  const scope = getScope(root);
  if (!scope) {
    return;
  }

  const isDirty = kind === "dirty";
  const valueElement = safeQuery(scope, isDirty ? TOPBAR_DIRTY_MONEY_SELECTOR : TOPBAR_CLEAN_MONEY_SELECTOR);
  const targetValue = normalizeCount(value);

  syncMoneyStatToCachedValue(valueElement, targetValue, options);
  if (isDirty) {
    lastRenderedDirtyMoney = targetValue;
  } else {
    lastRenderedCleanMoney = targetValue;
  }
}

export function bindTopbarMoneySkipControls(root, options = {}) {
  const scope = getScope(root);
  if (!scope || typeof scope.querySelector !== "function") {
    return;
  }

  const getDisplaySnapshot = typeof options.getDisplaySnapshot === "function"
    ? options.getDisplaySnapshot
    : () => ({ cleanMoney: 0, dirtyMoney: 0 });
  const bindings = [
    {
      kind: "clean",
      label: "Čisté peníze",
      valueElement: safeQuery(scope, TOPBAR_CLEAN_MONEY_SELECTOR)
    },
    {
      kind: "dirty",
      label: "Špinavé peníze",
      valueElement: safeQuery(scope, TOPBAR_DIRTY_MONEY_SELECTOR)
    }
  ];

  for (const binding of bindings) {
    const control = binding.valueElement?.closest?.(".resource-pill") || binding.valueElement;
    if (!control || control.dataset.moneySkipBound === "1") {
      continue;
    }

    control.dataset.moneySkipBound = "1";
    control.dataset.moneyKind = binding.kind;
    control.setAttribute?.("role", "button");
    control.setAttribute?.("tabindex", "0");
    control.setAttribute?.("aria-label", `${binding.label}. Aktuální hodnota zdroje.`);

    const skip = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const displaySnapshot = getDisplaySnapshot() || {};
      const targetValue = binding.kind === "dirty"
        ? displaySnapshot.dirtyMoney
        : displaySnapshot.cleanMoney;
      syncTopbarMoneyResource(root, binding.kind, targetValue, options);
    };

    control.addEventListener?.("click", skip);
    control.addEventListener?.("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      skip(event);
    });
  }
}

export function renderStorageList(storageState = {}, options = {}) {
  const root = options.root || getScope();
  if (!root) {
    return;
  }

  if (renderAuthoritativeStorageList(root, storageState.summary)) {
    return;
  }

  const inventories = {
    weapons: storageState.weapons || {},
    materials: storageState.materials || {},
    drugs: storageState.drugs || {},
    factorySupplies: storageState.factorySupplies || {}
  };
  const counterGroups = [
    { selector: STORAGE_WEAPON_COUNT_SELECTOR, datasetKey: "storageWeaponCount", inventory: inventories.weapons },
    { selector: STORAGE_MATERIAL_COUNT_SELECTOR, datasetKey: "storageMaterialCount", inventory: inventories.materials },
    { selector: STORAGE_DRUG_COUNT_SELECTOR, datasetKey: "storageDrugCount", inventory: inventories.drugs },
    { selector: STORAGE_FACTORY_COUNT_SELECTOR, datasetKey: "storageFactoryCount", inventory: inventories.factorySupplies }
  ];

  for (const group of counterGroups) {
    for (const counter of safeQueryAll(root, group.selector)) {
      const itemId = counter.dataset?.[group.datasetKey];
      if (!itemId) {
        continue;
      }

      counter.textContent = `${normalizeCount(group.inventory[itemId])} ks`;
    }
  }

  const legacyAmounts = {
    ...inventories.weapons,
    ...inventories.materials,
    ...inventories.drugs,
    ...inventories.factorySupplies
  };
  for (const row of safeQueryAll(root, "[data-storage-resource]")) {
    const resourceKey = row.dataset?.storageResource;
    const value = row.querySelector?.("[data-storage-value]");
    if (!resourceKey || !value) continue;
    const legacyKey = resourceKey === "metal-parts"
      ? "metalParts"
      : resourceKey === "tech-core"
        ? "techCore"
        : resourceKey === "combat-module"
          ? "combatModule"
          : resourceKey;
    value.textContent = `${normalizeCount(legacyAmounts[resourceKey] ?? legacyAmounts[legacyKey])} / -`;
  }
}

function renderAuthoritativeStorageList(root, summary) {
  if (!summary || typeof summary !== "object" || !Array.isArray(summary.groups)) {
    const panel = safeQuery(root, "[data-storage-summary]");
    if (panel) panel.hidden = true;
    return false;
  }

  const itemsByKey = new Map();
  for (const group of summary.groups) {
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      if (item?.resourceKey) itemsByKey.set(item.resourceKey, item);
    }
  }

  for (const row of safeQueryAll(root, "[data-storage-resource]")) {
    const item = itemsByKey.get(row.dataset?.storageResource);
    const value = row.querySelector?.("[data-storage-value]");
    if (!item || !value) continue;
    const current = normalizeCount(item.currentAmount);
    const maximum = normalizeCount(item.maxAmount);
    value.textContent = `${current} / ${maximum}`;
    row.dataset.storageState = item.isOverCapacity
      ? "over"
      : item.isFull
        ? "full"
        : item.isNearCapacity
          ? "near"
          : "normal";
    row.title = item.isOverCapacity
      ? "Zásoba překračuje aktuální maximum. Další kusy nelze přijmout."
      : item.isFull
        ? "Kapacita je plná"
        : "";
  }

  const warehouse = summary.warehouseSummary || {};
  const panel = safeQuery(root, "[data-storage-summary]");
  if (panel) panel.hidden = false;
  setText(root, "[data-storage-warehouse-count]", normalizeCount(warehouse.ownedWarehouseCount));
  setText(root, "[data-storage-warehouse-level]", `L${normalizeCount(warehouse.highestWarehouseLevel)}`);
  setText(root, "[data-storage-total-multiplier]", `x${Number(warehouse.totalCapacityMultiplier || 1).toFixed(2)}`);
  setText(root, "[data-storage-capacity-summary]", summary.groups
    .map((group) => `${group.label} ${normalizeCount(group.currentCapacity)}`)
    .join(" | "));
  return true;
}

function setText(root, selector, value) {
  const element = safeQuery(root, selector);
  if (element) element.textContent = String(value);
}
