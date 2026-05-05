const DEFAULT_TOAST_DURATION_MS = 1800;
const DEFAULT_TOAST_HIDE_DELAY_MS = 220;
const DYNAMIC_NOTIFICATION_SELECTOR = "[data-runtime-notification]";
const NOTIFICATION_ROOT_SELECTORS = Object.freeze([
  "[data-notification-root]",
  '[data-mount-role="notifications"]',
  "#game-toast-root"
]);

const legacyToastTimers = new WeakMap();
const dynamicNotificationTimers = new WeakMap();

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

function safeMatches(element, selector) {
  if (!element || typeof element.matches !== "function") {
    return false;
  }

  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function getDocument(root) {
  if (root?.nodeType === 9) {
    return root;
  }

  if (root?.ownerDocument) {
    return root.ownerDocument;
  }

  if (typeof document !== "undefined") {
    return document;
  }

  return null;
}

function getTimerApi(options = {}) {
  const timerSource = options.timerApi || (typeof window !== "undefined" ? window : globalThis);
  const setTimeoutFn = options.setTimeout || timerSource?.setTimeout;
  const clearTimeoutFn = options.clearTimeout || timerSource?.clearTimeout;

  return {
    setTimeout: typeof setTimeoutFn === "function" ? setTimeoutFn.bind(timerSource) : null,
    clearTimeout: typeof clearTimeoutFn === "function" ? clearTimeoutFn.bind(timerSource) : null
  };
}

function normalizeToastType(type) {
  const normalizedType = String(type || "info").toLowerCase();
  return ["success", "error", "warning", "info"].includes(normalizedType) ? normalizedType : "info";
}

function resolveNotificationRoot(options = {}) {
  if (options.container && typeof options.container.append === "function") {
    return options.container;
  }

  const root = options.root || getDocument(options.container);

  for (const selector of NOTIFICATION_ROOT_SELECTORS) {
    if (safeMatches(root, selector)) {
      return root;
    }

    const found = safeQuery(root, selector);
    if (found) {
      return found;
    }
  }

  return null;
}

function appendElement(parent, child) {
  if (typeof parent.append === "function") {
    parent.append(child);
    return;
  }

  if (typeof parent.appendChild === "function") {
    parent.appendChild(child);
  }
}

function removeElement(element) {
  if (!element) {
    return;
  }

  if (typeof element.remove === "function") {
    element.remove();
    return;
  }

  if (element.parentNode && typeof element.parentNode.removeChild === "function") {
    element.parentNode.removeChild(element);
  }
}

function clearLegacyToastTimer(toast, clearTimeoutFn) {
  const timers = legacyToastTimers.get(toast);
  if (!timers || !clearTimeoutFn) {
    return;
  }

  if (timers.visibilityTimerId !== undefined) {
    clearTimeoutFn(timers.visibilityTimerId);
  }
  if (timers.hideTimerId !== undefined) {
    clearTimeoutFn(timers.hideTimerId);
  }
}

export function showExistingToast(root, selector, options = {}) {
  const toast = safeQuery(root, selector);

  if (!toast) {
    return null;
  }

  const { setTimeout, clearTimeout } = getTimerApi(options);
  const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : DEFAULT_TOAST_DURATION_MS;
  const hideDelayMs = Number.isFinite(options.hideDelayMs) ? options.hideDelayMs : DEFAULT_TOAST_HIDE_DELAY_MS;

  clearLegacyToastTimer(toast, clearTimeout);

  toast.hidden = false;
  toast.classList?.remove("is-visible");
  void toast.offsetWidth;
  toast.classList?.add("is-visible");

  if (!setTimeout || durationMs <= 0) {
    legacyToastTimers.delete(toast);
    return toast;
  }

  const visibilityTimerId = setTimeout(() => {
    toast.classList?.remove("is-visible");

    if (!setTimeout || hideDelayMs <= 0) {
      toast.hidden = true;
      legacyToastTimers.delete(toast);
      return;
    }

    const hideTimerId = setTimeout(() => {
      toast.hidden = true;
      legacyToastTimers.delete(toast);
    }, hideDelayMs);

    legacyToastTimers.set(toast, { hideTimerId });
  }, durationMs);

  legacyToastTimers.set(toast, { visibilityTimerId });
  return toast;
}

export function showToast(message, type = "info", options = {}) {
  const container = resolveNotificationRoot(options);
  if (!container) {
    return null;
  }

  const ownerDocument = options.document || getDocument(container);
  if (!ownerDocument || typeof ownerDocument.createElement !== "function") {
    return null;
  }

  const normalizedType = normalizeToastType(type);
  const toast = ownerDocument.createElement("div");
  toast.className = `runtime-notification runtime-notification--${normalizedType}`;
  toast.textContent = String(message ?? "");
  toast.hidden = false;
  toast.setAttribute("data-runtime-notification", "true");
  toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", normalizedType === "error" ? "assertive" : "polite");

  appendElement(container, toast);

  const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : DEFAULT_TOAST_DURATION_MS;
  const { setTimeout, clearTimeout } = getTimerApi(options);

  if (setTimeout && durationMs > 0) {
    const timerId = setTimeout(() => {
      dynamicNotificationTimers.delete(toast);
      removeElement(toast);
    }, durationMs);
    dynamicNotificationTimers.set(toast, { timerId, clearTimeout });
  }

  return toast;
}

export function showSuccess(message, options = {}) {
  return showToast(message, "success", options);
}

export function showError(message, options = {}) {
  return showToast(message, "error", options);
}

export function showWarning(message, options = {}) {
  return showToast(message, "warning", options);
}

export function showInfo(message, options = {}) {
  return showToast(message, "info", options);
}

export function renderNotificationList(items = [], options = {}) {
  clearNotifications(options);

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return showToast(item, "info", options);
      }

      return showToast(item?.message ?? "", item?.type || "info", {
        ...options,
        ...(item?.options || {})
      });
    })
    .filter(Boolean);
}

export function clearNotifications(options = {}) {
  const root = options.container || resolveNotificationRoot(options) || options.root || getDocument();
  const notifications = safeQueryAll(root, DYNAMIC_NOTIFICATION_SELECTOR);

  for (const notification of notifications) {
    const timer = dynamicNotificationTimers.get(notification);
    if (timer?.clearTimeout && timer.timerId !== undefined) {
      timer.clearTimeout(timer.timerId);
    }

    dynamicNotificationTimers.delete(notification);
    removeElement(notification);
  }

  return notifications.length;
}
