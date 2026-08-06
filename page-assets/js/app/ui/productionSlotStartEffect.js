const PRODUCTION_SLOT_START_EFFECT_MS = 900;
const startEffectExpiryByMount = new WeakMap();

function getEffectStore(mount) {
  if (!mount || (typeof mount !== "object" && typeof mount !== "function")) {
    return null;
  }
  let store = startEffectExpiryByMount.get(mount);
  if (!store) {
    store = new Map();
    startEffectExpiryByMount.set(mount, store);
  }
  return store;
}

function restartStartEffect(card) {
  if (!card?.classList) return false;
  card.classList.remove("production-slot--start-flash");
  void card.offsetWidth;
  card.classList.add("production-slot--start-flash");
  card.dataset.productionStartEffect = "true";

  const clearEffect = () => {
    card.classList.remove("production-slot--start-flash");
    delete card.dataset.productionStartEffect;
  };
  card.addEventListener?.("animationend", clearEffect, { once: true });
  card.ownerDocument?.defaultView?.setTimeout?.(clearEffect, PRODUCTION_SLOT_START_EFFECT_MS + 100);
  return true;
}

export function triggerProductionSlotStartEffect(mount, slotKey, card, now = Date.now()) {
  const normalizedSlotKey = String(slotKey || "").trim();
  const store = getEffectStore(mount);
  if (store && normalizedSlotKey) {
    store.set(normalizedSlotKey, Number(now) + PRODUCTION_SLOT_START_EFFECT_MS);
  }
  return restartStartEffect(card);
}

export function applyPendingProductionSlotStartEffect(mount, slotKey, card, now = Date.now()) {
  const normalizedSlotKey = String(slotKey || "").trim();
  const store = getEffectStore(mount);
  if (!store || !normalizedSlotKey) return false;
  const expiresAt = Number(store.get(normalizedSlotKey) || 0);
  if (expiresAt <= Number(now)) {
    store.delete(normalizedSlotKey);
    return false;
  }
  return restartStartEffect(card);
}
