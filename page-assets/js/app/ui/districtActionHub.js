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

  const hasCallback = typeof callback === "function";
  button.type = "button";
  button.dataset.districtActionId = action.id || "";
  button.dataset.districtActionLabel = action.label || "";
  if (action.id) {
    button.dataset.testid = `district-action-${action.id}`;
  }
  if (action.disabledTone) {
    button.dataset.districtActionDisabledTone = String(action.disabledTone);
  }
  if (action.countdownLabel) {
    button.dataset.districtActionCountdown = "true";
    if (action.countdownEndsAt) {
      button.dataset.districtActionCountdownEndsAt = String(action.countdownEndsAt);
    }
  }
  button.disabled = Boolean(action.countdownLabel) || !action.enabled || !hasCallback;

  if (action.stacked || action.countdownLabel) {
    if (action.stacked) {
      button.classList.add("district-popup-action--stacked");
    }
    if (action.countdownLabel) {
      button.classList.add("district-popup-action--countdown");
    }
    if (action.trapState) {
      button.dataset.districtTrapState = action.trapState;
    }

    const label = createElement(mount, "span", "district-popup-action__label");
    if (label) {
      label.textContent = action.label || "";
      button.append(label);
    }

    if (action.subtitle || action.countdownLabel) {
      const subtitle = createElement(
        mount,
        "span",
        action.countdownLabel
          ? "district-popup-action__sub district-popup-action__countdown"
          : "district-popup-action__sub"
      );
      if (subtitle) {
        subtitle.textContent = action.countdownLabel || action.subtitle;
        button.append(subtitle);
      }
    }
  } else {
    button.textContent = action.label || "";
  }

  if (action.title) {
    button.title = action.title;
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

  const actions = Array.isArray(actionViewModel.actions) ? actionViewModel.actions : [];
  for (const action of actions) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const callback = callbacks[action.id] || callbacks.onAction || null;
    const button = renderDistrictActionButton(action, callback, { mount });
    if (!actionRow || !button) {
      continue;
    }

    actionRow.append(button);

    if (action.reason) {
      const reason = renderDistrictActionDisabledReason(action.reason, { mount });
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
