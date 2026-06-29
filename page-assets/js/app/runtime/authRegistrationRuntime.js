function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

export function createAuthRegistrationRuntime(deps = {}) {
  const selectors = deps.selectors || {};

  const applyFactionPreview = (root, factionId) => {
    const faction = deps.FACTION_CATALOG?.[factionId] || deps.FACTION_CATALOG?.mafian;
    deps.renderFactionPreviewPanel?.(root, deps.createFactionPreviewViewModel?.(faction), {
      formatCurrency: deps.formatCurrency
    });
  };

  const bindFactionRegistration = (root) => {
    const authForm = root?.querySelector?.(selectors.authForm);
    const identityInput = root?.querySelector?.(selectors.identity);
    const factionInput = root?.querySelector?.(selectors.factionInput);
    const statusMount = root?.querySelector?.(selectors.statusMount);
    const factionOptions = queryAll(root, selectors.factionOption);

    if (!authForm || !identityInput || !factionInput || factionOptions.length === 0) {
      return false;
    }

    const existingRegistration = deps.getStoredRegistration?.();

    const setActiveFaction = (factionId) => {
      factionInput.value = factionId;

      for (const option of factionOptions) {
        option.classList.toggle("is-active", option.dataset.factionId === factionId);
      }

      applyFactionPreview(root, factionId);
    };

    const existingRegistrationView = deps.createExistingRegistrationViewModel?.(existingRegistration, deps.FACTION_CATALOG);

    if (existingRegistrationView.locked) {
      setActiveFaction(existingRegistrationView.activeFactionId);
      identityInput.value = existingRegistrationView.identityValue;
      identityInput.readOnly = existingRegistrationView.identityReadOnly;

      for (const option of factionOptions) {
        option.disabled = existingRegistrationView.optionsDisabled;
      }

      deps.renderAuthStatus?.(
        statusMount,
        existingRegistrationView.statusTitle,
        existingRegistrationView.statusNote
      );
    } else {
      setActiveFaction(factionInput.value || existingRegistrationView.activeFactionId);

      for (const option of factionOptions) {
        option.addEventListener("click", () => {
          setActiveFaction(option.dataset.factionId || "mafian");
        });
      }

      deps.renderAuthStatus?.(
        statusMount,
        existingRegistrationView.statusTitle,
        existingRegistrationView.statusNote
      );
    }

    authForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const registration = deps.getStoredRegistration?.();

      if (registration?.factionId) {
        const lockedStatus = deps.createLockedRegistrationStatusViewModel?.(registration, deps.FACTION_CATALOG);
        deps.renderAuthStatus?.(
          statusMount,
          lockedStatus.title,
          lockedStatus.note
        );
        return;
      }

      const identity = identityInput.value.trim() || "Host";
      const factionId = factionInput.value in deps.FACTION_CATALOG ? factionInput.value : "mafian";
      const now = new Date().toISOString();
      const defaultEconomy = deps.DEFAULT_ECONOMY_STATE || { cleanMoney: 25000, dirtyMoney: 300 };
      const defaultGangState = deps.DEFAULT_GANG_STATE || { influence: 0, heat: 0 };

      deps.setStoredRegistration?.({ identity, factionId, lockedAt: now });
      deps.setStoredWeaponInventory?.(deps.createWeaponInventoryFromFaction?.(factionId));
      deps.setStoredMaterialInventory?.(deps.DEFAULT_MATERIAL_INVENTORY);
      deps.setStoredDrugInventory?.(deps.DEFAULT_DRUG_INVENTORY);
      deps.setStoredProductionState?.({});
      deps.setStoredEconomyState?.({
        cleanMoney: Number(defaultEconomy.cleanMoney || 0),
        dirtyMoney: Number(defaultEconomy.dirtyMoney || 0)
      });
      deps.setStoredMarketPriceState?.(deps.createDefaultMarketPriceState?.());
      deps.setStoredGangState?.({
        members: deps.DEFAULT_GANG_MEMBERS,
        influence: Number(defaultGangState.influence || 0),
        heat: Number(defaultGangState.heat || 0),
        policeRaidProtectionUntil: 0,
        autoPoliceNextActionAt: 0,
        heatJournal: [],
        dirtyHeatReductionTimestamps: [],
        lastHeatDecayAt: new Date().toISOString()
      });
      identityInput.value = identity;
      identityInput.readOnly = true;

      for (const option of factionOptions) {
        option.disabled = true;
      }

      const completedStatus = deps.createCompletedRegistrationStatusViewModel?.({
        identity,
        factionId,
        lockedAt: now,
        factionCatalog: deps.FACTION_CATALOG
      });
      deps.renderAuthStatus?.(statusMount, completedStatus.title, completedStatus.note);
    });

    return true;
  };

  return {
    applyFactionPreview,
    bindFactionRegistration
  };
}
