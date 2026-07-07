export function normalizeBorderColor(borderColor) {
  const color = String(borderColor || "").trim().toLowerCase();
  return color === "black" || color === "red" ? "black" : "white";
}

export function getMapPhaseToggleLabel(phaseState = {}) {
  return phaseState.mapPhase === "day" ? "Fáze: DEN" : "Fáze: NOC";
}

export function getGamePhaseToggleLabel(phaseState = {}) {
  return phaseState.gamePhase === "launch" ? "Fáze hry: DEV-ONLY" : "Fáze hry: LIVE";
}

export function getBorderColorToggleLabel(borderColor) {
  return "HRANY";
}

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

export function createPhaseToggleRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const CustomEventCtor = deps.CustomEventCtor || (typeof CustomEvent !== "undefined" ? CustomEvent : null);

  const syncPhase = (phaseHost) => deps.syncPhaseHostFromAuthority?.(phaseHost) || {};

  const bindMapPhaseToggle = (root) => {
    const mapPhaseHost = query(root, selectors.phaseHost);
    const toggleButton = query(root, selectors.mapPhaseToggle);

    if (!mapPhaseHost || !toggleButton) {
      return false;
    }

    toggleButton.textContent = getMapPhaseToggleLabel(syncPhase(mapPhaseHost));
    toggleButton.disabled = true;
    toggleButton.title = "Fáze se nyní řídí autoritativním backend stavem.";
    return true;
  };

  const bindBorderColorToggle = (root) => {
    const mapPhaseHost = query(root, selectors.phaseHost);
    const toggleButton = query(root, selectors.borderToggle);

    if (!mapPhaseHost || !toggleButton) {
      return false;
    }

    const setBorderColor = (borderColor) => {
      const normalizedBorderColor = normalizeBorderColor(borderColor);
      mapPhaseHost.dataset.borderColor = normalizedBorderColor;
      toggleButton.textContent = getBorderColorToggleLabel(normalizedBorderColor);
      toggleButton.dataset.borderColor = normalizedBorderColor;
      toggleButton.setAttribute?.("aria-label", normalizedBorderColor === "black"
        ? "Hrany districtů jsou černé"
        : "Hrany districtů jsou bílé");
      toggleButton.title = normalizedBorderColor === "black"
        ? "Hrany districtů jsou černé"
        : "Hrany districtů jsou bílé";
      return normalizedBorderColor;
    };

    setBorderColor(mapPhaseHost.dataset.borderColor || "white");

    toggleButton.addEventListener("click", () => {
      const nextBorderColor = normalizeBorderColor(mapPhaseHost.dataset.borderColor) === "black" ? "white" : "black";
      const normalizedBorderColor = setBorderColor(nextBorderColor);

      if (deps.onBorderColorChange) {
        deps.onBorderColorChange({ borderColor: normalizedBorderColor, mapPhaseHost });
        return;
      }

      if (CustomEventCtor) {
        mapPhaseHost.dispatchEvent(new CustomEventCtor("mapborderchange", {
          detail: { borderColor: normalizedBorderColor }
        }));
      }
    });

    return true;
  };

  const bindGamePhaseToggle = (root) => {
    const mapPhaseHost = query(root, selectors.phaseHost);
    const toggleButton = query(root, selectors.gamePhaseToggle);

    if (!mapPhaseHost || !toggleButton) {
      return false;
    }

    const updateGamePhaseLabel = () => {
      const phaseState = syncPhase(mapPhaseHost);
      toggleButton.textContent = getGamePhaseToggleLabel(phaseState);
      return phaseState;
    };

    updateGamePhaseLabel();
    toggleButton.disabled = false;
    toggleButton.title = "Přepnout fázi hry";

    toggleButton.addEventListener("click", () => {
      const currentPhaseState = deps.getResolvedPhaseState?.() || {};
      const nextGamePhase = currentPhaseState.gamePhase === "launch" ? "live" : "launch";

      deps.onGamePhaseToggle?.({
        gamePhase: nextGamePhase,
        mapPhaseHost,
        updateGamePhaseLabel
      });
    });

    return true;
  };

  return {
    bindBorderColorToggle,
    bindGamePhaseToggle,
    bindMapPhaseToggle
  };
}
