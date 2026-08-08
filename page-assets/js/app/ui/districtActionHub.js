function getElementDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const scope = getElementDocument(scopeElement);
  if (!scope || typeof scope.createElement !== "function") {
    return null;
  }
  const element = scope.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

const districtActionButtonBindingByElement = new WeakMap();
const districtActionHubStateByMount = new WeakMap();

function resolveDistrictActionPresentation(action = {}) {
  if (action.enabled !== false) {
    return action;
  }

  const inlineReason = String(
    action.reason
    || action.title
    || action.subtitle
    || "Akce teď není dostupná."
  ).trim();
  return {
    ...action,
    stacked: true,
    subtitle: inlineReason,
    disabledTone: action.disabledTone || "unavailable",
    reason: ""
  };
}

export function renderDistrictActionDisabledReason(reason = "", options = {}) {
  const mount = options.mount || options.container || null;
  const reasonElement = createElement(mount, "p", "district-popup-action-reason");
  if (!reasonElement) {
    return null;
  }
  reasonElement.textContent = String(reason || "");
  return reasonElement;
}

export function renderDistrictActionButton(action = {}, callback = null, options = {}) {
  const mount = options.mount || options.container || null;
  const button = createElement(mount, "button", "button district-popup-action");
  if (!button) {
    return null;
  }

  const presentation = resolveDistrictActionPresentation(action);
  const hasCallback = typeof callback === "function";
  button.type = "button";
  button.dataset.districtActionId = presentation.id || "";
  if (presentation.key) {
    button.dataset.districtActionKey = String(presentation.key);
  }
  if (presentation.targetDistrictId) {
    button.dataset.districtActionTargetId = String(presentation.targetDistrictId);
  }
  button.dataset.districtActionLabel = presentation.label || "";
  if (presentation.id) {
    button.dataset.testid = `district-action-${presentation.key || presentation.id}`;
  }
  if (presentation.disabledTone) {
    button.dataset.districtActionDisabledTone = String(presentation.disabledTone);
  }
  if (presentation.countdownLabel) {
    button.dataset.districtActionCountdown = "true";
    if (presentation.countdownEndsAt) {
      button.dataset.districtActionCountdownEndsAt = String(presentation.countdownEndsAt);
    }
  }
  button.disabled = Boolean(presentation.countdownLabel) || !presentation.enabled || !hasCallback;

  if (presentation.stacked || presentation.countdownLabel) {
    if (presentation.stacked) {
      button.classList.add("district-popup-action--stacked");
    }
    if (presentation.countdownLabel) {
      button.classList.add("district-popup-action--countdown");
    }
    if (presentation.trapState) {
      button.dataset.districtTrapState = presentation.trapState;
    }

    const label = createElement(mount, "span", "district-popup-action__label");
    if (label) {
      label.textContent = presentation.label || "";
      button.append(label);
    }

    if (presentation.subtitle || presentation.countdownLabel) {
      const subtitle = createElement(
        mount,
        "span",
        presentation.countdownLabel
          ? "district-popup-action__sub district-popup-action__countdown"
          : "district-popup-action__sub"
      );
      if (subtitle) {
        subtitle.textContent = presentation.countdownLabel || presentation.subtitle;
        button.append(subtitle);
      }
    }
  } else {
    button.textContent = presentation.label || "";
  }

  if (presentation.title) {
    button.title = presentation.title;
  }

  districtActionButtonBindingByElement.set(button, {
    action,
    callback: hasCallback ? callback : null
  });
  button.addEventListener?.("click", () => {
    const binding = districtActionButtonBindingByElement.get(button);
    if (!button.disabled && typeof binding?.callback === "function") {
      binding.callback(binding.action);
    }
  });
  return button;
}

export function clearDistrictActionHub(options = {}) {
  const mount = options.mount || options.container || null;
  mount?.replaceChildren?.();
  if (mount) {
    districtActionHubStateByMount.delete(mount);
  }
  return Boolean(mount);
}

function resolveDistrictActionEntries(actions = [], callbacks = {}) {
  return actions.map((action) => {
    const presentation = resolveDistrictActionPresentation(action);
    const callback = callbacks[presentation.id] || callbacks.onAction || null;
    return {
      action: presentation,
      callback: typeof callback === "function" ? callback : null
    };
  });
}

function createDistrictActionHubFingerprint(actionViewModel = {}, entries = []) {
  return JSON.stringify({
    emptyText: String(actionViewModel.emptyText || ""),
    headHidden: Boolean(actionViewModel.headHidden),
    hidden: Boolean(actionViewModel.hidden),
    noticeMessage: String(actionViewModel.noticeMessage || ""),
    statusMessage: String(
      actionViewModel.policeMessage || actionViewModel.statusMessage || ""
    ),
    actions: entries.map(({ action, callback }) => ({
      callbackAvailable: typeof callback === "function",
      countdownEndsAt: action.countdownLabel && action.countdownEndsAt
        ? String(action.countdownEndsAt)
        : "",
      countdownLabel: String(action.countdownLabel || ""),
      disabledTone: String(action.disabledTone || ""),
      enabled: Boolean(action.enabled),
      id: String(action.id || ""),
      key: String(action.key || ""),
      label: String(action.label || ""),
      reason: String(action.reason || ""),
      stacked: Boolean(action.stacked),
      subtitle: String(action.subtitle || ""),
      targetDistrictId: String(action.targetDistrictId || ""),
      title: String(action.title || ""),
      trapState: String(action.trapState || "")
    }))
  });
}

function getExpectedDistrictActionChildCount(actionViewModel = {}, actionCount = 0) {
  const statusMessage = actionViewModel.policeMessage || actionViewModel.statusMessage || "";
  if (statusMessage) {
    return 1;
  }
  return (actionViewModel.noticeMessage ? 1 : 0)
    + actionCount
    + (actionCount <= 0 && actionViewModel.emptyText ? 1 : 0);
}

function canReuseDistrictActionHub(mount, state, fingerprint, expectedChildCount, actionCount) {
  if (
    !state
    || state.fingerprint !== fingerprint
    || state.expectedChildCount !== expectedChildCount
    || Number(mount.children?.length || 0) !== expectedChildCount
    || state.buttons.length !== actionCount
  ) {
    return false;
  }
  return typeof mount.contains !== "function"
    || state.buttons.every((button) => mount.contains(button));
}

function updateDistrictActionButtonBindings(buttons = [], entries = []) {
  entries.forEach((entry, index) => {
    const button = buttons[index];
    if (!button) return;
    districtActionButtonBindingByElement.set(button, {
      action: entry.action,
      callback: entry.callback
    });
  });
}

function rememberDistrictActionHub(
  mount,
  fingerprint,
  expectedChildCount,
  buttons
) {
  districtActionHubStateByMount.set(mount, {
    buttons,
    expectedChildCount,
    fingerprint
  });
}

export function renderDistrictActionHub(actionViewModel = {}, callbacks = {}, options = {}) {
  const elements = options.elements || {};
  const section = elements.section || options.section || null;
  const head = elements.head || options.head || null;
  const mount = elements.mount || options.mount || options.container || null;

  if (section) {
    section.hidden = Boolean(actionViewModel.hidden);
    section.style.display = section.hidden ? "none" : "";
  }
  if (head) {
    head.hidden = Boolean(actionViewModel.headHidden);
  }
  if (!mount) {
    return false;
  }

  const actions = Array.isArray(actionViewModel.actions) ? actionViewModel.actions : [];
  const entries = resolveDistrictActionEntries(actions, callbacks);
  const statusMessage = actionViewModel.policeMessage || actionViewModel.statusMessage || "";
  const renderedEntries = statusMessage ? [] : entries;
  const fingerprint = createDistrictActionHubFingerprint(actionViewModel, renderedEntries);
  const expectedChildCount = getExpectedDistrictActionChildCount(
    actionViewModel,
    entries.length
  );
  mount.dataset.districtActionCount = String(actions.length);
  const previousState = districtActionHubStateByMount.get(mount);
  if (canReuseDistrictActionHub(
    mount,
    previousState,
    fingerprint,
    expectedChildCount,
    renderedEntries.length
  )) {
    updateDistrictActionButtonBindings(previousState.buttons, renderedEntries);
    return true;
  }

  clearDistrictActionHub({ mount });
  const renderedButtons = [];

  if (statusMessage) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const reason = renderDistrictActionDisabledReason(statusMessage, { mount });
    if (actionRow && reason) {
      actionRow.append(reason);
      mount.append(actionRow);
    }
    rememberDistrictActionHub(
      mount,
      fingerprint,
      expectedChildCount,
      renderedButtons
    );
    return true;
  }

  if (actionViewModel.noticeMessage) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const reason = renderDistrictActionDisabledReason(actionViewModel.noticeMessage, { mount });
    if (actionRow && reason) {
      actionRow.append(reason);
      mount.append(actionRow);
    }
  }

  for (const entry of entries) {
    const presentation = entry.action;
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const button = renderDistrictActionButton(presentation, entry.callback, { mount });
    if (!actionRow || !button) {
      continue;
    }

    renderedButtons.push(button);
    actionRow.append(button);

    if (presentation.reason) {
      const reason = renderDistrictActionDisabledReason(presentation.reason, { mount });
      if (reason) {
        actionRow.append(reason);
      }
    }

    mount.append(actionRow);
  }

  if (actions.length <= 0 && actionViewModel.emptyText) {
    const empty = renderDistrictActionDisabledReason(actionViewModel.emptyText, { mount });
    if (empty) {
      mount.append(empty);
    }
  }

  rememberDistrictActionHub(
    mount,
    fingerprint,
    expectedChildCount,
    renderedButtons
  );

  return true;
}
