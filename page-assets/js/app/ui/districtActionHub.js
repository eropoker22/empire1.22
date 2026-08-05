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

const INLINE_DISABLED_ACTION_IDS = new Set(["occupy", "rob"]);

function resolveDistrictActionPresentation(action = {}) {
  const actionId = String(action.id || "");
  if (action.enabled !== false || !INLINE_DISABLED_ACTION_IDS.has(actionId)) {
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
    disabledTone: "unavailable",
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

  button.addEventListener?.("click", () => {
    if (!button.disabled) {
      callback?.(action);
    }
  });
  return button;
}

export function clearDistrictActionHub(options = {}) {
  const mount = options.mount || options.container || null;
  mount?.replaceChildren?.();
  return Boolean(mount);
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

  clearDistrictActionHub({ mount });
  const actions = Array.isArray(actionViewModel.actions) ? actionViewModel.actions : [];
  mount.dataset.districtActionCount = String(actions.length);

  const statusMessage = actionViewModel.policeMessage || actionViewModel.statusMessage || "";
  if (statusMessage) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const reason = renderDistrictActionDisabledReason(statusMessage, { mount });
    if (actionRow && reason) {
      actionRow.append(reason);
      mount.append(actionRow);
    }
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

  for (const action of actions) {
    const presentation = resolveDistrictActionPresentation(action);
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const callback = callbacks[presentation.id] || callbacks.onAction || null;
    const button = renderDistrictActionButton(presentation, callback, { mount });
    if (!actionRow || !button) {
      continue;
    }

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

  return true;
}
